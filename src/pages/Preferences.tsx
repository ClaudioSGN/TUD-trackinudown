import { Archive, Cloud, Copy, FileSpreadsheet, FolderOpen, KeyRound, Moon, PackageOpen, RefreshCw, RotateCcw, Sun } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { AppSettings, Condominio } from '../types/domain'
import { dateTime } from '../lib/format'

export function Preferences({ settings }: { settings: AppSettings }) {
  const query = useQueryClient()
  const [draft, setDraft] = useState(settings)
  const [newCategory, setNewCategory] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportPath, setExportPath] = useState('')
  const [exportError, setExportError] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupPath, setBackupPath] = useState('')
  const [backupError, setBackupError] = useState('')
  const [syncUrl, setSyncUrl] = useState(settings.webSyncUrl)
  const [syncToken, setSyncToken] = useState(settings.webSyncToken)
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncError, setSyncError] = useState('')
  const { data: all = [] } = useQuery({ queryKey: ['condominios', 'all'], queryFn: () => window.tud.condominios.list(true) })
  const { data: version = '…' } = useQuery({ queryKey: ['app-version'], queryFn: () => window.tud.app.version() })
  const archived = all.filter((item: Condominio) => item.arquivado)

  useEffect(() => {
    setDraft(settings)
    setSyncUrl(settings.webSyncUrl)
    setSyncToken(settings.webSyncToken)
  }, [settings])

  const update = async (patch: Partial<AppSettings>) => {
    const next = await window.tud.settings.set(patch)
    setDraft(next)
    await query.invalidateQueries({ queryKey: ['settings'] })
    return next
  }
  const addCategory = () => {
    const name = newCategory.trim()
    if (!name || draft.categories.some(item => item.toLowerCase() === name.toLowerCase())) return
    setNewCategory('')
    void update({ categories: [...draft.categories, name] })
  }
  const exportCsv = async () => {
    setExporting(true); setExportPath(''); setExportError('')
    try { const saved = await window.tud.export.csv(); if (saved) setExportPath(saved) }
    catch (error) { setExportError(error instanceof Error ? error.message : 'Não foi possível exportar o CSV.') }
    finally { setExporting(false) }
  }
  const createPortable = async () => {
    setBackupBusy(true); setBackupPath(''); setBackupError('')
    try { const saved = await window.tud.backup.createPortable(); if (saved) setBackupPath(saved) }
    catch (error) { setBackupError(error instanceof Error ? error.message : 'Não foi possível criar o arquivo TUD.') }
    finally { setBackupBusy(false) }
  }
  const restorePortable = async () => {
    setBackupBusy(true); setBackupError('')
    try { await window.tud.backup.restore() }
    catch (error) { setBackupError(error instanceof Error ? error.message : 'Não foi possível importar o arquivo TUD.') }
    finally { setBackupBusy(false) }
  }
  const generateSyncKey = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    setSyncToken(Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''))
    setSyncMessage('Chave criada. Use a mesma chave na variável TUD_SYNC_TOKEN da Vercel.')
    setSyncError('')
  }
  const saveSync = async () => {
    setSyncError(''); setSyncMessage('')
    if (!syncUrl.trim() || !syncToken.trim()) { setSyncError('Informe o endereço publicado e a chave de sincronização.'); return }
    try {
      await update({ webSyncUrl: syncUrl.trim(), webSyncToken: syncToken.trim() })
      setSyncMessage('Conexão salva neste computador.')
    } catch (error) { setSyncError(error instanceof Error ? error.message : 'Não foi possível salvar a conexão.') }
  }
  const syncNow = async () => {
    setSyncBusy(true); setSyncError(''); setSyncMessage('')
    try {
      if (!syncUrl.trim() || !syncToken.trim()) throw new Error('Informe o endereço publicado e a chave de sincronização.')
      await update({ webSyncUrl: syncUrl.trim(), webSyncToken: syncToken.trim() })
      const result = await window.tud.webSync.run()
      setSyncMessage(`${result.tickets} chamados e ${result.attachments} anexos sincronizados. ${result.uploadedAttachments} arquivos enviados agora.`)
      await query.invalidateQueries({ queryKey: ['settings'] })
    } catch (error) { setSyncError(error instanceof Error ? error.message : 'Não foi possível sincronizar o painel.') }
    finally { setSyncBusy(false) }
  }
  const toggleWebSync = async (enabled: boolean) => {
    setSyncError('')
    if (enabled && (!syncUrl.trim() || !syncToken.trim())) { setSyncError('Salve o endereço e a chave antes de ativar a sincronização automática.'); return }
    await update({ webSyncEnabled: enabled, webSyncUrl: syncUrl.trim(), webSyncToken: syncToken.trim() })
  }

  return <div className="page preferences">
    <span className="eyebrow">Configuração</span><h1 className="display md"><em>Preferências</em></h1><p className="support">Ajuste o ritmo, os dados e o comportamento do TUD no Windows.</p>

    <section className="pref-section"><h2>Aparência</h2><p className="muted">Escolha o tema e a densidade mais confortáveis para trabalhar.</p><div className="pref-row"><span>Tema</span><div className="segmented"><button className={draft.theme === 'light' ? 'active' : ''} onClick={() => update({ theme: 'light' })}><Sun size={15}/> Claro</button><button className={draft.theme === 'dark' ? 'active' : ''} onClick={() => update({ theme: 'dark' })}><Moon size={15}/> Escuro</button></div></div><div className="pref-row"><span>Densidade</span><div className="segmented"><button className={draft.density === 'comfortable' ? 'active' : ''} onClick={() => update({ density: 'comfortable' })}>Confortável</button><button className={draft.density === 'compact' ? 'active' : ''} onClick={() => update({ density: 'compact' })}>Compacto</button></div></div></section>

    <section className="pref-section"><h2>Animações</h2><div className="pref-row"><span>Nível de animação</span><div className="segmented">{([['full', 'Completas'], ['reduced', 'Reduzidas'], ['off', 'Desligadas']] as const).map(([value, label]) => <button key={value} className={draft.animation === value ? 'active' : ''} onClick={() => update({ animation: value })}>{label}</button>)}</div></div><Toggle label="Efeitos de fundo" value={draft.backgroundEffects} onChange={value => update({ backgroundEffects: value })}/><Toggle label="Abertura animada" value={draft.splash} onChange={value => update({ splash: value })}/><Toggle label="Partículas ao registrar" value={draft.particles} onChange={value => update({ particles: value })}/></section>

    <section className="pref-section"><h2>Categorias</h2><p className="muted">Categorias usadas nos formulários e filtros.</p><div className="category-list">{draft.categories.map(name => <span className="chip" key={name}>{name}<button className="icon-button" style={{ width: 22, height: 22 }} onClick={() => update({ categories: draft.categories.filter(item => item !== name) })}>×</button></span>)}</div><div className="category-edit"><input className="quick-input" value={newCategory} onChange={event => setNewCategory(event.target.value)} placeholder="Nova categoria" onKeyDown={event => { if (event.key === 'Enter') addCategory() }}/><button className="secondary" onClick={addCategory}>Adicionar</button></div></section>

    <section className="pref-section web-sync-section">
      <div className="pref-title-row"><div><h2>Visualização online</h2><p className="muted">Publique uma cópia somente para leitura dos chamados e anexos. O TUD local continua sendo a única fonte que pode editar os dados.</p></div><Cloud size={24}/></div>
      <div className="sync-field"><label htmlFor="sync-url">Endereço do painel publicado</label><input id="sync-url" value={syncUrl} onChange={event => setSyncUrl(event.target.value)} placeholder="https://seu-painel.vercel.app"/></div>
      <div className="sync-field"><label htmlFor="sync-token">Chave privada de sincronização</label><div className="sync-secret"><input id="sync-token" type="password" autoComplete="off" value={syncToken} onChange={event => setSyncToken(event.target.value)} placeholder="Use a mesma chave configurada na Vercel"/><button className="secondary" onClick={generateSyncKey}><KeyRound size={15}/> Gerar</button><button className="secondary" disabled={!syncToken} onClick={() => navigator.clipboard.writeText(syncToken)}><Copy size={15}/> Copiar</button></div></div>
      <div className="intro-actions"><button className="secondary" onClick={saveSync}>Salvar conexão</button><button className="primary" disabled={syncBusy || !syncUrl.trim() || !syncToken.trim()} onClick={syncNow}><RefreshCw size={16}/>{syncBusy ? 'Sincronizando…' : 'Sincronizar agora'}</button></div>
      <Toggle label="Sincronizar automaticamente a cada 10 minutos" value={draft.webSyncEnabled} onChange={toggleWebSync}/>
      {draft.webSyncLastAt && <p className="sync-last">Última sincronização: <strong>{dateTime(draft.webSyncLastAt)}</strong></p>}
      {syncMessage && <div className="export-result" role="status"><Cloud size={20}/><span><strong>Visualização online</strong><small>{syncMessage}</small></span></div>}
      {(syncError || draft.webSyncLastError) && <div className="save-error" role="alert"><strong>Falha na sincronização</strong><small>{syncError || draft.webSyncLastError}</small></div>}
    </section>

    <section className="pref-section"><h2>Dados</h2><p className="muted">Crie um único arquivo <strong>.tud</strong> para levar todos os chamados, anexos e configurações a outro computador. Com o TUD instalado, basta abrir esse arquivo para importar tudo.</p><div className="intro-actions"><button className="secondary" disabled={backupBusy} onClick={createPortable}><Archive size={16}/>{backupBusy ? 'Preparando…' : 'Criar arquivo portátil'}</button><button className="secondary" disabled={backupBusy} onClick={restorePortable}><PackageOpen size={16}/>Importar arquivo TUD</button><button className="secondary" disabled={exporting} onClick={exportCsv}><FileSpreadsheet size={16}/>{exporting ? 'Gerando CSV…' : 'Exportar relatório detalhado'}</button><button className="secondary" onClick={() => window.tud.app.openDataFolder()}><FolderOpen size={16}/> Abrir pasta de dados</button></div>{backupPath && <div className="export-result" role="status"><Archive size={20}/><span><strong>Arquivo portátil criado</strong><small>{backupPath}</small></span></div>}{backupError && <div className="error-text" role="alert">{backupError}</div>}{exportPath && <div className="export-result" role="status"><FileSpreadsheet size={20}/><span><strong>Relatório exportado</strong><small>{exportPath}</small></span></div>}{exportError && <div className="error-text" role="alert">{exportError}</div>}<Toggle label="Backup automático ao fechar" value={draft.autoBackup} onChange={value => update({ autoBackup: value })}/><p className="muted">Backups automáticos também usam o formato .tud e ficam em Documentos\TUD Dados\backups.</p>{archived.length > 0 && <><h2 style={{ marginTop: 28 }}>Condomínios arquivados</h2>{archived.map((item: Condominio) => <div className="pref-row" key={item.id}><span>{item.nome}</span><button className="secondary" onClick={async () => { await window.tud.condominios.restore(item.id); await query.invalidateQueries() }}><RotateCcw size={15}/> Restaurar</button></div>)}</>}</section>

    <section className="pref-section"><h2>Sistema</h2><Toggle label="Iniciar com o Windows" value={draft.startWithWindows} onChange={value => update({ startWithWindows: value })}/><Toggle label="Atalho global Ctrl+Alt+T" value={draft.globalShortcut} onChange={value => update({ globalShortcut: value })}/><Toggle label="Usar ícone na bandeja" value={draft.tray} onChange={value => update({ tray: value })}/><div className="pref-row"><span>Ao fechar</span><div className="segmented"><button className={draft.closeBehavior === 'quit' ? 'active' : ''} onClick={() => update({ closeBehavior: 'quit' })}>Sair</button><button className={draft.closeBehavior === 'tray' ? 'active' : ''} onClick={() => update({ closeBehavior: 'tray', tray: true })}>Minimizar para bandeja</button></div></div><p className="muted">Mudanças de integração com o Windows entram em vigor na próxima abertura.</p></section>
    <section className="pref-section"><h2>Sobre</h2><p className="muted">TUD — Tracking u Down · versão {version}<br/>Dados locais por padrão. A visualização online só é ativada quando você configura e habilita a sincronização.</p></section>
  </div>
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => unknown | Promise<unknown> }) {
  return <div className="pref-row"><span>{label}</span><button className={`toggle ${value ? 'on' : ''}`} onClick={() => onChange(!value)} role="switch" aria-checked={value}><i/></button></div>
}
