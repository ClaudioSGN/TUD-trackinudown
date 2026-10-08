import { ArrowLeft, ArrowUpRight, Check, CirclePlus, Copy, Link2, MessageSquarePlus, MoreHorizontal, Paperclip, RefreshCw, Search, Send, Tag, Trash2, Unlink, X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useState } from 'react'
import type { Anexo, Atendimento, AtendimentoAtualizacao, AtendimentoFilters, Condominio, Status } from '../types/domain'
import { dateTime, mediaUrl, ticketId } from '../lib/format'
import { useUi } from '../stores/ui'

export function AttendancesPage({ condominios, categories, condominioId }: { condominios: Condominio[]; categories: string[]; condominioId?: number }) {
  const condo = condominios.find(x => x.id === condominioId)
  const all = !condominioId
  const [filters, setFilters] = useState<AtendimentoFilters>({ sort: 'id' })
  const [detailId, setDetailId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ id: number; title: string } | null>(null)
  const queryClient = useQueryClient()
  const { openDrawer, openCondo } = useUi()
  const query = { ...filters, condominioId }
  const { data: rows = [] } = useQuery({ queryKey: ['atendimentos', query], queryFn: () => window.tud.atendimentos.list(query) })
  const invalidate = () => queryClient.invalidateQueries()
  const remove = async (item: Atendimento) => {
    await window.tud.atendimentos.remove(item.id)
    setDetailId(null); setToast({ id: item.id, title: item.titulo }); void invalidate()
    setTimeout(() => setToast(current => current?.id === item.id ? null : current), 5_000)
  }
  const undo = async () => { if (!toast) return; await window.tud.atendimentos.undoRemove(toast.id); setToast(null); void invalidate() }

  return <div className="page two-column">
    <section className="sticky-intro">
      <span className="eyebrow">{all ? 'Todos' : 'Condomínio'}</span>
      <h1 className="display sm">{all ? <><em>Todos</em> os atendimentos</> : italicFirst(condo?.nome || 'Condomínio')}</h1>
      {condo && <div className="condo-profile-info"><div className="contact"><div>{condo.endereco || 'Endereço não informado'}</div><div>{condo.contato || 'Contato geral não informado'} {condo.contato && <button className="icon-button inline-copy" onClick={() => navigator.clipboard.writeText(condo.contato)} aria-label="Copiar contato geral"><Copy size={15}/></button>}</div></div><div className="profile-people"><ProfileContact label="Gestor responsável" name={condo.gestor_nome} contact={condo.gestor_contato}/><ProfileContact label="Equipe de T.I." name={condo.ti_nome} contact={condo.ti_contato}/></div></div>}
      <p className="muted">{rows.length} atendimento{rows.length === 1 ? '' : 's'}{condo ? ` · ${condo.abertos} em aberto` : ''}</p>
      <div className="intro-actions"><button className="primary" onClick={() => openDrawer()}>Novo atendimento</button>{condo && <button className="secondary" onClick={() => openCondo(condo.id)} aria-label="Editar condomínio"><MoreHorizontal size={18}/></button>}</div>
    </section>
    <section>
      <div className="toolbar"><label className="search"><Search size={17}/><input value={filters.search || ''} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Buscar por título ou ID…" aria-label="Buscar atendimentos por título ou ID"/></label><Filter label="Status" value={filters.status || ''} onChange={value => setFilters({ ...filters, status: value as any })} options={['Aberto', 'Em andamento', 'Concluído']}/><Filter label="Categoria" value={filters.categoria || ''} onChange={value => setFilters({ ...filters, categoria: value })} options={categories}/><Filter label="Prioridade" value={filters.prioridade || ''} onChange={value => setFilters({ ...filters, prioridade: value as any })} options={['Baixa', 'Normal', 'Alta']}/><Filter label="Período" value={filters.periodo || ''} onChange={value => setFilters({ ...filters, periodo: value as any })} options={['7d', '30d', '90d', 'ano', 'tudo']}/><select className="chip" value={filters.sort} onChange={e => setFilters({ ...filters, sort: e.target.value as any })}><option value="id">ID crescente</option><option value="recentes">Mais recentes</option><option value="antigos">Mais antigos</option><option value="prioridade">Prioridade</option><option value="status">Status</option></select></div>
      {rows.length ? <div className="accordion">{rows.map(item => <AttendanceRow key={item.id} item={item} all={all} onOpen={() => setDetailId(item.id)}/>)}</div> : <div className="empty"><div><h2>Nenhum <em>atendimento</em> por aqui.</h2><p>{Object.values(filters).some(Boolean) ? 'Nada encontrado com esses filtros.' : 'Crie o primeiro atendimento para começar.'}</p><button className="ghost" onClick={() => setFilters({ sort: 'id' })}>Limpar filtros</button></div></div>}
    </section>
    {detailId !== null && <AttendanceDetail id={detailId} categories={categories} onClose={() => setDetailId(null)} onOpenRelated={setDetailId} onRemove={remove} onChange={invalidate}/>} 
    {toast && <div className="toast"><span>“{toast.title}” foi excluído.</span><button className="ghost" onClick={undo}>Desfazer</button></div>}
  </div>
}

function italicFirst(name: string) { const [first, ...rest] = name.split(' '); return <><em>{first}</em>{rest.length ? ` ${rest.join(' ')}` : ''}</> }
function ProfileContact({ label, name, contact }: { label: string; name: string; contact: string }) { return <div className="profile-person"><span className="eyebrow">{label}</span><strong>{name || 'Não informado'}</strong>{contact && <span>{contact}<button className="icon-button inline-copy" onClick={() => navigator.clipboard.writeText(contact)} aria-label={`Copiar contato de ${label}`}><Copy size={14}/></button></span>}</div> }
function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <select className={`chip ${value ? 'active' : ''}`} value={value} onChange={e => onChange(e.target.value)} aria-label={label}><option value="">{label}</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select> }

function AttendanceRow({ item, all, onOpen }: { item: Atendimento; all: boolean; onOpen: () => void }) {
  return <div className="attendance-row"><button className="row-summary" onClick={onOpen} aria-label={`Abrir atendimento ${ticketId(item.id)} ${item.titulo} em tela cheia`}><i className={`dot ${item.status === 'Concluído' ? 'done' : item.status === 'Em andamento' ? 'progress' : ''}`}/><span><span className="ticket-id">{ticketId(item.id)}</span><span className="row-title">{item.titulo}</span><span className="row-preview">{item.descricao || 'Sem descrição'}</span></span>{all && <span className="badge">{item.condominio_nome}</span>}<span className="badge">{item.categoria}</span><span className="row-date">{item.anexo_count > 0 && <><Paperclip size={13}/> {item.anexo_count} · </>}{dateTime(item.data_atendimento)}</span><ArrowUpRight size={18}/></button></div>
}

function AttendanceDetail({ id, categories, onClose, onOpenRelated, onRemove, onChange }: { id: number; categories: string[]; onClose: () => void; onOpenRelated: (id: number) => void; onRemove: (item: Atendimento) => void; onChange: () => void }) {
  const queryClient = useQueryClient()
  const [linkId, setLinkId] = useState('')
  const [linkError, setLinkError] = useState('')
  const [updateText, setUpdateText] = useState('')
  const [updateStatus, setUpdateStatus] = useState<Status>('Aberto')
  const [updateCategory, setUpdateCategory] = useState('')
  const [updateError, setUpdateError] = useState('')
  const [sendingUpdate, setSendingUpdate] = useState(false)
  const [viewer, setViewer] = useState<number | null>(null)
  const { data: item } = useQuery({ queryKey: ['atendimento', id], queryFn: () => window.tud.atendimentos.get(id) })
  const { data: updates = [] } = useQuery({ queryKey: ['atendimento-updates', id], queryFn: () => window.tud.atendimentos.updates(id) })
  const { data: related = [] } = useQuery({ queryKey: ['atendimento-related', id], queryFn: () => window.tud.atendimentos.related(id) })
  const { data: candidates = [] } = useQuery({ queryKey: ['atendimentos', 'relation-candidates'], queryFn: () => window.tud.atendimentos.list({ limit: 1000 }) })
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && viewer === null) onClose() }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key) }, [onClose, viewer])
  useEffect(() => { setLinkId(''); setLinkError(''); setUpdateText(''); setUpdateError('') }, [id])
  useEffect(() => { if (item) { setUpdateStatus(item.status); setUpdateCategory(item.categoria) } }, [item?.status, item?.categoria])
  if (!item) return null

  const available = candidates.filter(candidate => candidate.id !== item.id && !related.some(current => current.id === candidate.id))
  const categoryOptions = [...new Set([item.categoria, ...categories])]
  const chronological = [...updates].sort((a, b) => a.criado_em.localeCompare(b.criado_em) || a.id - b.id)
  const creation = chronological.find(update => update.tipo === 'criacao')
  const firstStatusChange = chronological.find(update => update.tipo === 'status')
  const firstCategoryChange = chronological.find(update => update.tipo === 'categoria')
  const initialStatus = (creation?.valor_anterior || firstStatusChange?.valor_anterior || item.status) as Status
  const initialCategory = creation?.valor_novo || firstCategoryChange?.valor_anterior || item.categoria
  const activity = groupUpdates(chronological.filter(update => update.tipo !== 'criacao'))
  const changed = updateStatus !== item.status || updateCategory !== item.categoria
  const canSend = Boolean(updateText.trim() || changed)
  const refresh = async () => { await queryClient.invalidateQueries(); onChange() }
  const changeStatus = async () => { await window.tud.atendimentos.setStatus(item.id, item.status === 'Concluído' ? 'Aberto' : 'Concluído'); await refresh() }
  const sendUpdate = async (event: FormEvent) => {
    event.preventDefault(); if (!canSend || sendingUpdate) return
    setSendingUpdate(true); setUpdateError('')
    try { await window.tud.atendimentos.addUpdate(item.id, { text: updateText.trim(), status: updateStatus, categoria: updateCategory }); setUpdateText(''); await refresh() }
    catch (error) { setUpdateError(error instanceof Error ? error.message : 'Não foi possível registrar a atualização.') }
    finally { setSendingUpdate(false) }
  }
  const link = async () => {
    const match = linkId.trim().match(/^(?:TUD[-\s]?|#)?0*(\d+)$/i)
    const targetId = match ? Number(match[1]) : 0
    if (!available.some(candidate => candidate.id === targetId)) { setLinkError('Informe o ID de um atendimento disponível.'); return }
    await window.tud.atendimentos.link(item.id, targetId); setLinkId(''); setLinkError(''); await refresh()
  }
  const unlink = async (relatedId: number) => { await window.tud.atendimentos.unlink(item.id, relatedId); await refresh() }
  const removeUpdate = async (group: UpdateGroup) => {
    if (!confirm('Excluir esta atualização? O status e a categoria atuais não serão alterados.')) return
    await window.tud.atendimentos.removeUpdate(item.id, group.ids); await refresh()
  }

  return <div className="detail-screen"><div className="detail-page">
    <header className="detail-header"><button className="secondary" onClick={onClose}><ArrowLeft size={17}/> Voltar à lista</button><div className="detail-actions"><button className={`done-button ${item.status === 'Concluído' ? 'done' : ''}`} onClick={changeStatus}><span className="check">{item.status === 'Concluído' && <Check size={13}/>}</span>{item.status === 'Concluído' ? 'Reabrir' : 'Marcar como concluído'}</button></div></header>
    <section className="detail-hero"><span className="eyebrow">Atendimento {ticketId(item.id)} · {item.condominio_nome}</span><h1 className="display md">{italicFirst(item.titulo)}</h1><div className="detail-badges"><span className="badge"><i className={`dot ${item.status === 'Concluído' ? 'done' : item.status === 'Em andamento' ? 'progress' : ''}`}/>{item.status}</span><span className="badge">{item.categoria}</span><span className="badge">Prioridade {item.prioridade.toLowerCase()}</span><span className="muted">{dateTime(item.data_atendimento)}</span></div></section>
    <div className="detail-grid"><main>
      <section className="activity-stream" aria-label="Atualizações do atendimento">
        <article className="activity-entry creation-entry"><span className="activity-marker"><CirclePlus size={18}/></span><div className="activity-message"><header><div><span className="eyebrow">Mensagem inicial</span><h2>Criação do chamado</h2></div><time>{dateTime(creation?.criado_em || item.criado_em)}</time></header><p className="creation-description">{item.descricao || 'Nenhuma descrição informada.'}</p><dl className="creation-details"><div><dt>Título</dt><dd>{item.titulo}</dd></div><div><dt>Condomínio</dt><dd>{item.condominio_nome}</dd></div><div><dt>Categoria</dt><dd>{initialCategory}</dd></div><div><dt>Status</dt><dd>{initialStatus}</dd></div><div><dt>Prioridade</dt><dd>{item.prioridade}</dd></div><div><dt>Data e hora</dt><dd>{dateTime(item.data_atendimento)}</dd></div></dl><div className="creation-attachments"><span className="eyebrow">Anexos</span>{item.anexos?.length ? <div className="detail-thumbs">{item.anexos.map((attachment, index) => <button key={attachment.id} onClick={() => setViewer(index)}><img src={mediaUrl(attachment.miniatura)} alt={attachment.nome_original}/><span>{attachment.nome_original}</span></button>)}</div> : <p className="muted">Nenhuma imagem anexada.</p>}</div></div></article>
        {activity.map(group => <article className="activity-entry" key={group.at}><span className="activity-marker"><MessageSquarePlus size={18}/></span><div className="activity-message"><header><h2>Atualização</h2><div className="activity-message-actions"><time>{dateTime(group.at)}</time><button className="icon-button update-delete" onClick={() => removeUpdate(group)} title="Excluir atualização" aria-label={`Excluir atualização de ${dateTime(group.at)}`}><Trash2 size={16}/></button></div></header>{group.notes.map(note => <p className="activity-note" key={note.id}>{note.texto}</p>)}{group.changes.length > 0 && <div className="activity-changes">{group.changes.map(change => <div key={change.id}><span>{change.tipo === 'status' ? <RefreshCw size={15}/> : <Tag size={15}/>} {change.tipo === 'status' ? 'Status' : 'Categoria'}</span><strong>{change.valor_anterior}</strong><ArrowUpRight size={14}/><strong>{change.valor_novo}</strong></div>)}</div>}</div></article>)}
      </section>
      <article className="card detail-card update-card"><span className="eyebrow">Nova atualização</span><h2>Adicionar ao chamado</h2><form className="update-form" onSubmit={sendUpdate}><textarea value={updateText} maxLength={5000} onChange={event => { setUpdateText(event.target.value); setUpdateError('') }} onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} placeholder="Escreva testes realizados, retornos, decisões ou próximos passos…" aria-label="Texto da nova atualização"/><div className="update-fields"><label><span>Categoria</span><select value={updateCategory} onChange={event => setUpdateCategory(event.target.value)}>{categoryOptions.map(category => <option key={category}>{category}</option>)}</select></label><label><span>Status</span><select value={updateStatus} onChange={event => setUpdateStatus(event.target.value as Status)}><option>Aberto</option><option>Em andamento</option><option>Concluído</option></select></label></div><div className="update-form-footer"><span>{updateText.length}/5000 · Ctrl+Enter para enviar</span><button className="primary" disabled={!canSend || sendingUpdate}><Send size={16}/>{sendingUpdate ? 'Enviando…' : 'Adicionar atualização'}</button></div>{updateError && <div className="error-text">{updateError}</div>}</form></article>
    </main><aside className="card related-card"><span className="eyebrow">Atendimentos relacionados</span><h2>Conectar outro chamado</h2><p className="muted">Digite o ID para acompanhar retornos, reincidências ou etapas do mesmo problema.</p><div className="relation-picker"><input list={`relation-options-${item.id}`} value={linkId} onChange={event => { setLinkId(event.target.value); setLinkError('') }} placeholder="Ex.: TUD-0042" aria-label="ID do atendimento a vincular"/><datalist id={`relation-options-${item.id}`}>{available.map(candidate => <option key={candidate.id} value={ticketId(candidate.id)}>{candidate.condominio_nome} · {candidate.titulo}</option>)}</datalist><button className="primary" disabled={!linkId.trim()} onClick={link}><Link2 size={16}/> Vincular por ID</button>{linkError && <div className="error-text">{linkError}</div>}</div><div className="related-list">{related.map(current => <div className="related-item" key={current.id}><button onClick={() => onOpenRelated(current.id)}><i className={`dot ${current.status === 'Concluído' ? 'done' : current.status === 'Em andamento' ? 'progress' : ''}`}/><span><strong><span className="ticket-id">{ticketId(current.id)}</span> {current.titulo}</strong><small>{current.condominio_nome} · {dateTime(current.data_atendimento)}</small></span><ArrowUpRight size={16}/></button><button className="icon-button" onClick={() => unlink(current.id)} aria-label={`Desvincular ${ticketId(current.id)} ${current.titulo}`}><Unlink size={15}/></button></div>)}{related.length === 0 && <div className="relation-empty">Nenhum atendimento vinculado.</div>}</div></aside></div>
    <footer className="detail-footer"><button className="ghost danger" onClick={() => onRemove(item)}>Excluir atendimento</button></footer>
  </div>{viewer !== null && item.anexos && <Viewer attachments={item.anexos} index={viewer} setIndex={setViewer} onClose={() => setViewer(null)}/>}</div>
}

type UpdateGroup = { at: string; ids: number[]; notes: AtendimentoAtualizacao[]; changes: AtendimentoAtualizacao[] }

function groupUpdates(updates: AtendimentoAtualizacao[]): UpdateGroup[] {
  const groups = new Map<string, UpdateGroup>()
  for (const update of updates) {
    const group = groups.get(update.criado_em) || { at: update.criado_em, ids: [], notes: [], changes: [] }
    group.ids.push(update.id)
    if (update.tipo === 'nota') group.notes.push(update); else group.changes.push(update)
    groups.set(update.criado_em, group)
  }
  return [...groups.values()]
}

function Viewer({ attachments, index, setIndex, onClose }: { attachments: Anexo[]; index: number; setIndex: (index: number) => void; onClose: () => void }) {
  const item = attachments[index]
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); if (event.key === 'ArrowLeft') setIndex((index - 1 + attachments.length) % attachments.length); if (event.key === 'ArrowRight') setIndex((index + 1) % attachments.length) }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key) }, [attachments.length, index, onClose, setIndex])
  return <div className="viewer" onClick={onClose}><img src={mediaUrl(item.caminho)} alt={item.nome_original} onClick={event => event.stopPropagation()}/><div className="viewer-actions"><button className="secondary" onClick={event => { event.stopPropagation(); void window.tud.anexos.copyToClipboard(item.caminho) }}>Copiar</button><button className="secondary" onClick={event => { event.stopPropagation(); void window.tud.anexos.reveal(item.caminho) }}>Mostrar na pasta</button><button className="secondary" onClick={onClose}><X size={17}/></button></div><button className="icon-button" style={{ position: 'absolute', left: 24, color: 'white' }} onClick={event => { event.stopPropagation(); setIndex((index - 1 + attachments.length) % attachments.length) }}>‹</button><button className="icon-button" style={{ position: 'absolute', right: 24, color: 'white' }} onClick={event => { event.stopPropagation(); setIndex((index + 1) % attachments.length) }}>›</button><div className="viewer-info">{index + 1} / {attachments.length} · {item.nome_original}</div></div>
}
