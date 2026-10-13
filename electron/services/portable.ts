import fs from 'node:fs'
import path from 'node:path'
import { ZipArchive } from 'archiver'
import { unzipSync } from 'fflate'
import type { TudDatabase } from '../db/database'

const FORMAT = 'tud-portable-backup'
const FORMAT_VERSION = 1

export interface PortableManifest {
  format: typeof FORMAT
  formatVersion: number
  appVersion: string
  createdAt: string
  tickets: number
  attachments: number
}

const part = (value: number) => String(value).padStart(2, '0')
export function portableFileName(date = new Date(), prefix = 'TUD-backup') {
  const stamp = `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}_${part(date.getHours())}-${part(date.getMinutes())}-${part(date.getSeconds())}`
  return `${prefix}-${stamp}.tud`
}

export async function createPortableArchive(database: TudDatabase, root: string, outputPath: string, appVersion: string) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  const snapshot = path.join(root, `.backup-${Date.now()}-${Math.random().toString(16).slice(2)}.db`)
  const temporaryOutput = `${outputPath}.tmp`
  await database.db.backup(snapshot)
  const manifest: PortableManifest = {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    appVersion,
    createdAt: new Date().toISOString(),
    tickets: Number((database.db.prepare('SELECT COUNT(*) total FROM atendimentos WHERE excluido_em IS NULL').get() as { total: number }).total),
    attachments: Number((database.db.prepare('SELECT COUNT(*) total FROM anexos').get() as { total: number }).total)
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(temporaryOutput)
      const archive = new ZipArchive({ zlib: { level: 9 } })
      output.on('close', resolve)
      output.on('error', reject)
      archive.on('error', reject)
      archive.pipe(output)
      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })
      archive.file(snapshot, { name: 'tud.db' })
      const attachments = path.join(root, 'anexos')
      if (fs.existsSync(attachments)) archive.directory(attachments, 'anexos')
      void archive.finalize()
    })
    fs.rmSync(outputPath, { force: true })
    fs.renameSync(temporaryOutput, outputPath)
    return outputPath
  } finally {
    fs.rmSync(snapshot, { force: true })
    fs.rmSync(temporaryOutput, { force: true })
  }
}

function safeArchiveName(name: string) {
  const normalized = name.replace(/\\/g, '/')
  return !normalized.startsWith('/') && !normalized.split('/').includes('..') && !/^[a-z]:/i.test(normalized)
}

export function inspectPortableArchive(filePath: string, requireManifest = path.extname(filePath).toLowerCase() === '.tud') {
  let entries: Record<string, Uint8Array>
  try { entries = unzipSync(new Uint8Array(fs.readFileSync(filePath))) }
  catch { throw new Error('O arquivo não é um pacote TUD válido ou está corrompido.') }
  for (const name of Object.keys(entries)) if (!safeArchiveName(name)) throw new Error('O pacote contém um caminho inseguro e não pode ser importado.')
  const database = entries['tud.db']
  if (!database || Buffer.from(database).subarray(0, 16).toString('utf8') !== 'SQLite format 3\0') throw new Error('O pacote não contém um banco de dados válido do TUD.')
  let manifest: PortableManifest | null = null
  if (entries['manifest.json']) {
    try { manifest = JSON.parse(Buffer.from(entries['manifest.json']).toString('utf8')) as PortableManifest }
    catch { throw new Error('O manifesto do pacote TUD está corrompido.') }
    if (manifest.format !== FORMAT || manifest.formatVersion !== FORMAT_VERSION) throw new Error('Esta versão do arquivo TUD não é compatível com o aplicativo.')
  } else if (requireManifest) throw new Error('O arquivo não contém a identificação de um pacote TUD válido.')
  return { entries, manifest }
}

export async function restorePortableArchive(database: TudDatabase, root: string, filePath: string, appVersion: string) {
  const { entries } = inspectPortableArchive(filePath)
  const backups = path.join(root, 'backups')
  await createPortableArchive(database, root, path.join(backups, portableFileName(new Date(), 'TUD-antes-da-importacao')), appVersion)

  const stage = fs.mkdtempSync(path.join(root, '.restore-'))
  const stagedDatabase = path.join(stage, 'tud.db')
  const stagedAttachments = path.join(stage, 'anexos')
  fs.writeFileSync(stagedDatabase, entries['tud.db'])
  fs.mkdirSync(stagedAttachments, { recursive: true })
  for (const [name, bytes] of Object.entries(entries)) {
    const normalized = name.replace(/\\/g, '/')
    if (!normalized.startsWith('anexos/') || normalized.endsWith('/')) continue
    const relative = normalized.slice('anexos/'.length)
    const target = path.resolve(stagedAttachments, relative)
    if (!target.startsWith(path.resolve(stagedAttachments) + path.sep)) throw new Error('O pacote contém um anexo com caminho inválido.')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, bytes)
  }

  const currentDatabase = path.join(root, 'tud.db')
  const currentAttachments = path.join(root, 'anexos')
  const previousDatabase = path.join(root, `.previous-${Date.now()}.db`)
  const previousAttachments = path.join(root, `.previous-anexos-${Date.now()}`)
  database.close()
  try {
    for (const suffix of ['-wal', '-shm']) fs.rmSync(`${currentDatabase}${suffix}`, { force: true })
    if (fs.existsSync(currentDatabase)) fs.renameSync(currentDatabase, previousDatabase)
    if (fs.existsSync(currentAttachments)) fs.renameSync(currentAttachments, previousAttachments)
    fs.renameSync(stagedDatabase, currentDatabase)
    fs.renameSync(stagedAttachments, currentAttachments)
    fs.rmSync(previousDatabase, { force: true })
    fs.rmSync(previousAttachments, { recursive: true, force: true })
  } catch (error) {
    fs.rmSync(currentDatabase, { force: true })
    fs.rmSync(currentAttachments, { recursive: true, force: true })
    if (fs.existsSync(previousDatabase)) fs.renameSync(previousDatabase, currentDatabase)
    if (fs.existsSync(previousAttachments)) fs.renameSync(previousAttachments, currentAttachments)
    throw error
  } finally {
    fs.rmSync(stage, { recursive: true, force: true })
  }
}
