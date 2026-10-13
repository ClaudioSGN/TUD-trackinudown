import { app, BrowserWindow, dialog, globalShortcut, protocol, net, Tray, Menu, Notification, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fs from 'node:fs'
import { TudDatabase } from './db/database'
import { FileService } from './services/files'
import { registerIpc } from './ipc'
import { createBackup, restoreBackup } from './services/data'

const dirname = path.dirname(fileURLToPath(import.meta.url))
let mainWindow: BrowserWindow | null = null
let database: TudDatabase | null = null
let tray: Tray | null = null
let allowQuit = false
let dataRoot: string | null = null
let pendingPortablePath = findPortableArgument(process.argv)
let importingPortable = false
const { autoUpdater } = electronUpdater
protocol.registerSchemesAsPrivileged([{ scheme: 'tud-media', privileges: { secure: true, supportFetchAPI: true, standard: true } }])

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus() }
    const portablePath = findPortableArgument(argv)
    if (portablePath) { pendingPortablePath = portablePath; void openPortableArchive(portablePath) }
  })
  app.whenReady().then(start)
}

async function start() {
  app.setAppUserModelId('com.pessoal.tud')
  const root = prepareDataDirectory(); dataRoot = root
  database = new TudDatabase(root); const files = new FileService(root, database); files.purgePending(); registerIpc(database, files, root)
  const settings = database.settings()
  const dark = settings.theme === 'dark'
  protocol.handle('tud-media', request => {
    try { const relative = decodeURIComponent(new URL(request.url).pathname.replace(/^\/+/, '')); return net.fetch(pathToFileURL(files.resolve(relative)).toString()) }
    catch { return new Response('Not found', { status: 404 }) }
  })
  const saved = database.settings().windowBounds
  mainWindow = new BrowserWindow({
    width: saved?.width || 1280, height: saved?.height || 800, x: saved?.x, y: saved?.y,
    minWidth: 1040, minHeight: 680, backgroundColor: dark ? '#101116' : '#f9f8f6', show: false,
    title: 'TUD', titleBarStyle: 'hidden', titleBarOverlay: { color: dark ? '#101116' : '#f9f8f6', symbolColor: dark ? '#f4f2ef' : '#222222', height: 40 },
    webPreferences: { preload: path.join(dirname, '../preload/preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false, backgroundThrottling: true }
  })
  mainWindow.setMenu(null)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', event => event.preventDefault())
  mainWindow.once('ready-to-show', () => { if (saved?.maximized) mainWindow?.maximize(); mainWindow?.show() })
  if (process.env.ELECTRON_RENDERER_URL) await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await mainWindow.loadFile(path.join(dirname, '../renderer/index.html'))
  if (pendingPortablePath) { const portablePath = pendingPortablePath; pendingPortablePath = null; setTimeout(() => void openPortableArchive(portablePath), 500) }
  configureAutoUpdates(root)
  mainWindow.on('close', event => { if (!database || !mainWindow) return; const b = mainWindow.getBounds(); database.setSettings({ windowBounds: { ...b, maximized: mainWindow.isMaximized() } }); if (!allowQuit && database.settings().closeBehavior === 'tray') { event.preventDefault(); mainWindow.hide() } })
  if (settings.globalShortcut) globalShortcut.register('CommandOrControl+Alt+T', () => { mainWindow?.show(); mainWindow?.focus(); mainWindow?.webContents.send('global-quick-add') })
  app.setLoginItemSettings({ openAtLogin: settings.startWithWindows })
  if (settings.tray) {
    const icon = app.isPackaged ? path.join(process.resourcesPath, 'icon.ico') : path.join(process.cwd(), 'resources', 'icon.ico')
    tray = new Tray(icon); tray.setToolTip('TUD — Tracking u Down')
    tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Abrir TUD', click: () => { mainWindow?.show(); mainWindow?.focus() } }, { label: 'Registrar atendimento', click: () => { mainWindow?.show(); mainWindow?.focus(); mainWindow?.webContents.send('global-quick-add') } }, { type: 'separator' }, { label: 'Sair', click: () => { void (async () => { if (database?.db.open && database.settings().autoBackup) await createBackup(database, root, database.settings().backupFolder); allowQuit = true; app.quit() })() } }]))
    tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
  }
  const notifyDueReminders = () => {
    if (!database || !Notification.isSupported()) return
    for (const reminder of database.dueReminders()) {
      const link = reminder.atendimento_id ? `TUD-${String(reminder.atendimento_id).padStart(4, '0')} · ${reminder.atendimento_titulo || 'Atendimento'}` : ''
      const notification = new Notification({ title: reminder.titulo, body: reminder.observacoes || link || 'Você tem um lembrete no TUD.' })
      notification.on('click', () => { mainWindow?.show(); mainWindow?.focus(); mainWindow?.webContents.send('open-reminders') })
      notification.show(); database.markReminderNotified(reminder.id)
    }
  }
  notifyDueReminders()
  setInterval(notifyDueReminders, 30_000).unref()
}

function findPortableArgument(args: string[]) {
  return args.find(argument => path.extname(argument).toLowerCase() === '.tud' && path.isAbsolute(argument) && fs.existsSync(argument)) || null
}

async function openPortableArchive(filePath: string) {
  if (importingPortable) return
  if (!database || !dataRoot) { pendingPortablePath = filePath; return }
  importingPortable = true
  try {
    const restored = await restoreBackup(database, dataRoot, filePath)
    if (restored) { allowQuit = true; app.relaunch(); app.exit(0) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível importar o arquivo TUD.'
    dialog.showErrorBox('Falha ao importar arquivo TUD', message)
    if (!database.db.open) { allowQuit = true; app.relaunch(); app.exit(1) }
  } finally { importingPortable = false }
}

function configureAutoUpdates(root: string) {
  if (!app.isPackaged || !mainWindow) return
  const send = (state: Record<string, unknown>) => mainWindow?.webContents.send('app-update-state', state)
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => send({ status: 'checking' }))
  autoUpdater.on('update-available', info => send({ status: 'available', version: info.version }))
  autoUpdater.on('download-progress', progress => send({ status: 'downloading', percent: Math.round(progress.percent) }))
  autoUpdater.on('update-not-available', () => send({ status: 'idle' }))
  autoUpdater.on('update-downloaded', info => send({ status: 'ready', version: info.version }))
  autoUpdater.on('error', error => { console.error('Falha na atualização automática:', error); send({ status: 'error', message: 'Não foi possível verificar atualizações agora.' }) })
  ipcMain.handle('app:check-updates', async () => { await autoUpdater.checkForUpdates() })
  ipcMain.handle('app:install-update', async () => {
    if (database?.db.open && database.settings().autoBackup) await createBackup(database, root, database.settings().backupFolder)
    allowQuit = true; autoUpdater.quitAndInstall(false, true)
  })
  setTimeout(() => { void autoUpdater.checkForUpdates().catch(error => console.error(error)) }, 8_000)
  setInterval(() => { void autoUpdater.checkForUpdates().catch(error => console.error(error)) }, 4 * 60 * 60 * 1000).unref()
}

function prepareDataDirectory() {
  const root = path.join(app.getPath('documents'), 'TUD Dados')
  const legacy = app.getPath('userData')
  fs.mkdirSync(root, { recursive: true })
  if (!fs.existsSync(path.join(root, 'tud.db')) && fs.existsSync(path.join(legacy, 'tud.db'))) {
    for (const name of ['tud.db', 'tud.db-wal', 'tud.db-shm']) {
      const source = path.join(legacy, name); if (fs.existsSync(source)) fs.copyFileSync(source, path.join(root, name))
    }
    for (const name of ['anexos', 'miniaturas', 'backups']) {
      const source = path.join(legacy, name); const destination = path.join(root, name)
      if (fs.existsSync(source) && !fs.existsSync(destination)) fs.cpSync(source, destination, { recursive: true })
    }
  }
  const guide = path.join(root, 'LEIA-ME - Restaurar dados.txt')
  fs.writeFileSync(guide, 'DADOS DO TUD\r\n\r\nMÉTODO RECOMENDADO\r\nEm Preferências > Dados, clique em "Criar arquivo portátil". Copie o arquivo .tud para o outro computador, instale o TUD e abra o arquivo com dois cliques.\r\n\r\nMÉTODO MANUAL\r\nFeche o TUD e copie esta pasta completa para a pasta Documentos do Windows, mantendo o nome "TUD Dados". Depois, instale ou abra o TUD novamente.\r\n\r\nNão altere os arquivos tud.db ou anexos separadamente.\r\n', 'utf8')
  return root
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', event => {
  if (allowQuit || !database?.db.open || !dataRoot || !database.settings().autoBackup) return
  event.preventDefault(); allowQuit = true
  void createBackup(database, dataRoot, database.settings().backupFolder).finally(() => app.quit())
})
app.on('will-quit', () => { globalShortcut.unregisterAll(); database?.close() })
