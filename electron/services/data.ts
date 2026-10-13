import fs from 'node:fs'
import path from 'node:path'
import { app, dialog, shell } from 'electron'
import type { TudDatabase } from '../db/database'
import { buildDetailedCsv, detailedCsvFileName } from './csv'
import { createPortableArchive, inspectPortableArchive, portableFileName, restorePortableArchive } from './portable'

export async function createBackup(database: TudDatabase, root: string, requested?: string) {
  const backupDir = requested || path.join(root, 'backups')
  return createPortableArchive(database, root, path.join(backupDir, portableFileName()), app.getVersion())
}

export async function createPortableBackup(database: TudDatabase, root: string) {
  const defaultPath = path.join(app.getPath('downloads'), portableFileName())
  const selected = await dialog.showSaveDialog({ title: 'Criar arquivo portátil do TUD', defaultPath, filters: [{ name: 'Arquivo portátil do TUD', extensions: ['tud'] }] })
  if (selected.canceled || !selected.filePath) return null
  const outputPath = selected.filePath.toLowerCase().endsWith('.tud') ? selected.filePath : `${selected.filePath}.tud`
  await createPortableArchive(database, root, outputPath, app.getVersion())
  shell.showItemInFolder(outputPath)
  return outputPath
}

export async function restoreBackup(database: TudDatabase, root: string, requestedPath?: string) {
  let filePath = requestedPath
  if (!filePath) {
    const picked = await dialog.showOpenDialog({ title: 'Importar dados do TUD', properties: ['openFile'], filters: [{ name: 'Arquivos do TUD', extensions: ['tud', 'zip'] }] })
    if (picked.canceled || !picked.filePaths[0]) return false
    filePath = picked.filePaths[0]
  }
  const { manifest } = inspectPortableArchive(filePath)
  const contents = manifest ? `\n\nConteúdo: ${manifest.tickets} chamado${manifest.tickets === 1 ? '' : 's'} e ${manifest.attachments} anexo${manifest.attachments === 1 ? '' : 's'}.` : ''
  const confirmation = await dialog.showMessageBox({
    type: 'warning', title: 'Importar arquivo TUD',
    message: 'Substituir os dados atuais pelos dados deste arquivo?',
    detail: `${path.basename(filePath)}${contents}\n\nTodos os chamados, anexos e configurações atuais serão substituídos. Um backup de segurança será criado automaticamente antes da importação.`,
    buttons: ['Cancelar', 'Importar e substituir'], defaultId: 0, cancelId: 0, noLink: true
  })
  if (confirmation.response !== 1) return false
  await restorePortableArchive(database, root, filePath, app.getVersion())
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
