import fs from 'node:fs'
import path from 'node:path'
import { ZipArchive } from 'archiver'
import { unzipSync } from 'fflate'
import { app, dialog, shell } from 'electron'
import type { TudDatabase } from '../db/database'
import { buildDetailedCsv, detailedCsvFileName } from './csv'

export async function createBackup(database: TudDatabase, root: string, requested?: string) {
  const backupDir = requested || path.join(root, 'backups'); fs.mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-')
  const outputPath = path.join(backupDir, `TUD-${stamp}.zip`)
  const snapshot = path.join(root, `.backup-${Date.now()}.db`)
  await database.db.backup(snapshot)
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(outputPath); const zip = new ZipArchive({ zlib: { level: 9 } })
    output.on('close', resolve); output.on('error', reject); zip.on('error', reject); zip.pipe(output)
    zip.file(snapshot, { name: 'tud.db' }); const attachments = path.join(root, 'anexos'); if (fs.existsSync(attachments)) zip.directory(attachments, 'anexos'); void zip.finalize()
  })
  fs.rmSync(snapshot, { force: true }); return outputPath
}

export async function restoreBackup(database: TudDatabase, root: string) {
  const picked = await dialog.showOpenDialog({ title: 'Restaurar backup', properties: ['openFile'], filters: [{ name: 'Backup do TUD', extensions: ['zip'] }] })
  if (picked.canceled || !picked.filePaths[0]) return false
  const entries = unzipSync(new Uint8Array(fs.readFileSync(picked.filePaths[0])))
  if (!entries['tud.db']) throw new Error('O arquivo não contém um backup válido do TUD.')
  for (const name of Object.keys(entries)) if (name.includes('..') || path.isAbsolute(name)) throw new Error('O backup contém um caminho inválido.')
  await createBackup(database, root)
  database.close()
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(path.join(root, `tud.db${suffix}`), { force: true })
  const dbTemp = path.join(root, '.restore-tud.db'); fs.writeFileSync(dbTemp, entries['tud.db']); fs.renameSync(dbTemp, path.join(root, 'tud.db'))
  const attachments = path.join(root, 'anexos'); fs.rmSync(attachments, { recursive: true, force: true }); fs.mkdirSync(attachments, { recursive: true })
  for (const [name, bytes] of Object.entries(entries)) {
    if (!name.startsWith('anexos/') || name.endsWith('/')) continue
    const target = path.resolve(root, name); if (!target.startsWith(path.resolve(attachments) + path.sep)) continue
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes)
  }
  return true
}

export async function exportCsv(database: TudDatabase, condominioId?: number) {
  const condominiumName = condominioId ? database.listCondominios(true).find(item => item.id === condominioId)?.nome : undefined
  const defaultPath = path.join(app.getPath('downloads'), detailedCsvFileName(new Date(), condominiumName))
  const result = await dialog.showSaveDialog({ title: 'Exportar relatório detalhado de atendimentos', defaultPath, filters: [{ name: 'Planilha CSV', extensions: ['csv'] }] })
  if (result.canceled || !result.filePath) return null
  fs.writeFileSync(result.filePath, '\ufeff' + buildDetailedCsv(database, condominioId), 'utf8')
  shell.showItemInFolder(result.filePath)
  return result.filePath
}
