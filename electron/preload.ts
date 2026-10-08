import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { TudApi } from '../src/types/domain'

const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
const api: TudApi = {
  condominios: {
    list: all => invoke('condominios:list', all), create: input => invoke('condominios:create', input),
    update: (id, input) => invoke('condominios:update', id, input), archive: id => invoke('condominios:archive', id), restore: id => invoke('condominios:restore', id)
  },
  atendimentos: {
    list: filters => invoke('atendimentos:list', filters), get: id => invoke('atendimentos:get', id), create: input => invoke('atendimentos:create', input),
    update: (id, input) => invoke('atendimentos:update', id, input), setStatus: (id, status) => invoke('atendimentos:status', id, status),
    updates: id => invoke('atendimentos:updates', id), addUpdate: (id, input) => invoke('atendimentos:add-update', id, input), removeUpdate: (id, updateIds) => invoke('atendimentos:remove-update', id, updateIds),
    related: id => invoke('atendimentos:related', id), link: (id, relatedId) => invoke('atendimentos:link', id, relatedId), unlink: (id, relatedId) => invoke('atendimentos:unlink', id, relatedId),
    remove: id => invoke('atendimentos:remove', id), undoRemove: id => invoke('atendimentos:undo', id)
  },
  anexos: {
    addFiles: (id, files) => invoke('anexos:add-paths', id, files.map(file => webUtils.getPathForFile(file))),
    addBuffer: (id, bytes, mime, name) => invoke('anexos:add-buffer', id, bytes, mime, name), remove: id => invoke('anexos:remove', id),
    reveal: path => invoke('anexos:reveal', path), copyToClipboard: path => invoke('anexos:copy', path)
  },
  dashboard: { summary: period => invoke('dashboard:summary', period) },
  lembretes: { list: includeCompleted => invoke('lembretes:list', includeCompleted), create: input => invoke('lembretes:create', input), setDone: (id, done) => invoke('lembretes:done', id, done), remove: id => invoke('lembretes:remove', id) },
  contatos: { list: (search, tipo) => invoke('contatos:list', search, tipo), create: input => invoke('contatos:create', input), update: (id, input) => invoke('contatos:update', id, input), remove: id => invoke('contatos:remove', id) },
  quickAdd: { create: input => invoke('quick:create', input) },
  backup: { create: folder => invoke('backup:create', folder), restore: () => invoke('backup:restore') },
  export: { csv: condominioId => invoke('export:csv', condominioId) },
  settings: { get: () => invoke('settings:get'), set: patch => invoke('settings:set', patch) },
  app: {
    version: () => invoke('app:version'), openDataFolder: () => invoke('app:data-folder'), setTheme: theme => invoke('app:set-theme', theme), checkForUpdates: () => invoke('app:check-updates'), installUpdate: () => invoke('app:install-update'),
    onGlobalQuickAdd: callback => { const listener = () => callback(); ipcRenderer.on('global-quick-add', listener); return () => ipcRenderer.removeListener('global-quick-add', listener) },
    onOpenReminders: callback => { const listener = () => callback(); ipcRenderer.on('open-reminders', listener); return () => ipcRenderer.removeListener('open-reminders', listener) },
    onUpdateState: callback => { const listener = (_event: Electron.IpcRendererEvent, state: Parameters<typeof callback>[0]) => callback(state); ipcRenderer.on('app-update-state', listener); return () => ipcRenderer.removeListener('app-update-state', listener) }
  }
}
contextBridge.exposeInMainWorld('tud', api)
