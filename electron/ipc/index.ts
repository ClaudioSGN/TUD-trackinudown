import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { z } from 'zod'
import type { TudDatabase } from '../db/database'
import type { FileService } from '../services/files'
import { createBackup, exportCsv, restoreBackup } from '../services/data'

const id = z.number().int().positive()
const condo = z.object({ nome: z.string().min(1).max(120), endereco: z.string().optional(), contato: z.string().optional(), observacoes: z.string().optional() })
const attendance = z.object({ condominioId: id, titulo: z.string().min(1).max(200), descricao: z.string().optional(), categoria: z.string().optional(), status: z.enum(['Aberto','Em andamento','Concluído']).optional(), prioridade: z.enum(['Baixa','Normal','Alta']).optional(), dataAtendimento: z.string().optional() })
const attendanceUpdate = z.object({ text: z.string().trim().max(5000).optional(), categoria: z.string().trim().min(1).max(120).optional(), status: z.enum(['Aberto','Em andamento','Concluído']).optional() })
const reminder = z.object({ titulo: z.string().trim().min(1).max(200), observacoes: z.string().max(2000).optional(), lembreteEm: z.string().datetime(), atendimentoId: id.optional() })

export function registerIpc(database: TudDatabase, files: FileService, root: string) {
  const handle = (channel: string, fn: (...args: any[]) => any) => ipcMain.handle(channel, async (_event, ...args) => fn(...args))
  handle('condominios:list', (all?: boolean) => database.listCondominios(Boolean(all)))
  handle('condominios:create', (input: unknown) => database.createCondominio(condo.parse(input)))
  handle('condominios:update', (rawId: unknown, input: unknown) => database.updateCondominio(id.parse(rawId), condo.parse(input)))
  handle('condominios:archive', (rawId: unknown) => database.archiveCondominio(id.parse(rawId), true))
  handle('condominios:restore', (rawId: unknown) => database.archiveCondominio(id.parse(rawId), false))
  handle('atendimentos:list', (filters: any) => database.listAtendimentos(filters || {}))
  handle('atendimentos:get', (rawId: unknown) => database.getAtendimento(id.parse(rawId)))
  handle('atendimentos:create', (input: unknown) => database.createAtendimento(attendance.parse(input)))
  handle('atendimentos:update', (rawId: unknown, input: unknown) => database.updateAtendimento(id.parse(rawId), attendance.parse(input)))
  handle('atendimentos:status', (rawId: unknown, status: unknown) => database.setStatus(id.parse(rawId), z.enum(['Aberto','Em andamento','Concluído']).parse(status)))
  handle('atendimentos:updates', (rawId: unknown) => database.listUpdates(id.parse(rawId)))
  handle('atendimentos:add-update', (rawId: unknown, input: unknown) => database.addUpdate(id.parse(rawId), attendanceUpdate.parse(input)))
  handle('atendimentos:remove-update', (rawId: unknown, rawUpdateIds: unknown) => database.removeUpdates(id.parse(rawId), z.array(id).min(1).max(100).parse(rawUpdateIds)))
  handle('atendimentos:related', (rawId: unknown) => database.relatedAtendimentos(id.parse(rawId)))
  handle('atendimentos:link', (rawId: unknown, rawRelatedId: unknown) => database.linkAtendimento(id.parse(rawId), id.parse(rawRelatedId)))
  handle('atendimentos:unlink', (rawId: unknown, rawRelatedId: unknown) => database.unlinkAtendimento(id.parse(rawId), id.parse(rawRelatedId)))
  handle('atendimentos:remove', (rawId: unknown) => { const parsed = id.parse(rawId); database.removeAtendimento(parsed); setTimeout(() => files.purgeAttendance(parsed), 5_000) })
  handle('atendimentos:undo', (rawId: unknown) => database.undoRemove(id.parse(rawId)))
  handle('quick:create', (input: unknown) => database.createAtendimento(attendance.pick({ condominioId: true, titulo: true }).parse(input)))
  handle('anexos:add-paths', (rawId: unknown, paths: unknown) => files.addPaths(id.parse(rawId), z.array(z.string()).max(20).parse(paths)))
  handle('anexos:add-buffer', (rawId: unknown, bytes: Uint8Array, mime: unknown, name: unknown) => files.addBuffer(id.parse(rawId), bytes, z.string().parse(mime), z.string().parse(name)))
  handle('anexos:remove', (rawId: unknown) => files.remove(id.parse(rawId)))
  handle('anexos:reveal', (relative: unknown) => files.reveal(z.string().parse(relative)))
  handle('anexos:copy', (relative: unknown) => files.copy(z.string().parse(relative)))
  handle('dashboard:summary', (period: any) => database.dashboard(z.enum(['7d','30d','90d','ano','tudo']).parse(period)))
  handle('lembretes:list', (includeCompleted?: boolean) => database.listReminders(Boolean(includeCompleted)))
  handle('lembretes:create', (input: unknown) => database.createReminder(reminder.parse(input)))
  handle('lembretes:done', (rawId: unknown, done: unknown) => database.setReminderDone(id.parse(rawId), z.boolean().parse(done)))
  handle('lembretes:remove', (rawId: unknown) => database.removeReminder(id.parse(rawId)))
  handle('settings:get', () => database.settings())
  handle('settings:set', (patch: any) => database.setSettings(patch))
  handle('backup:create', (folder?: string) => createBackup(database, root, folder))
  handle('backup:restore', async () => { const restored = await restoreBackup(database, root); if (restored) { app.relaunch(); app.exit(0) } return restored })
  handle('export:csv', (condominioId?: number) => exportCsv(database, condominioId))
  handle('app:version', () => app.getVersion())
  handle('app:data-folder', () => shell.openPath(root))
  ipcMain.handle('app:set-theme', (event, rawTheme: unknown) => {
    const theme = z.enum(['light', 'dark']).parse(rawTheme)
    const window = BrowserWindow.fromWebContents(event.sender)
    const dark = theme === 'dark'
    window?.setBackgroundColor(dark ? '#101116' : '#f9f8f6')
    window?.setTitleBarOverlay({ color: dark ? '#101116' : '#f9f8f6', symbolColor: dark ? '#f4f2ef' : '#222222', height: 40 })
  })
}
