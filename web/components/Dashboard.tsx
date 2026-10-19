'use client'

import { ArrowLeft, ArrowUpRight, Building2, CheckCircle2, ChevronRight, CircleDot, Clock3, Eye, FileImage, Link2, LogOut, Search, ShieldCheck, Tag, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { WebAttachment, WebSnapshot, WebTicket, WebTicketUpdate } from '../../shared/web-snapshot'

const ticketId = (id: number) => `TUD-${String(id).padStart(4, '0')}`
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value))

export function Dashboard({ snapshot }: { snapshot: WebSnapshot | null }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [condominium, setCondominium] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  if (!snapshot) return <EmptySync/>
  const categories = [...new Set(snapshot.tickets.map(ticket => ticket.category))].sort()
  const condominiums = snapshot.condominiums.filter(item => !item.archived)
  const selected = snapshot.tickets.find(ticket => ticket.id === selectedId) || null
  const normalized = search.trim().toLocaleLowerCase('pt-BR')
  const filtered = snapshot.tickets.filter(ticket => {
    const searchable = `${ticketId(ticket.id)} ${ticket.title} ${ticket.description} ${ticket.condominiumName}`.toLocaleLowerCase('pt-BR')
    return (!normalized || searchable.includes(normalized)) && (!status || ticket.status === status) && (!category || ticket.category === category) && (!condominium || String(ticket.condominiumId) === condominium)
  })

  return <div className="viewer-shell">
    <aside className="viewer-sidebar">
      <div className="brand-mark">tud.</div>
      <div className="readonly-pill"><Eye size={15}/><span>Somente leitura</span></div>
      <nav><a href="#overview" className="active"><CircleDot size={17}/> Visão geral</a><a href="#tickets"><Clock3 size={17}/> Atendimentos</a></nav>
      <div className="sync-info"><ShieldCheck size={18}/><span>Sincronizado em<strong>{formatDate(snapshot.generatedAt)}</strong></span></div>
      <form action="/api/logout" method="post"><button className="logout"><LogOut size={16}/> Sair</button></form>
    </aside>
    <main className="viewer-main">
      <header className="viewer-header"><div><span className="eyebrow">Acompanhamento executivo</span><h1>Operação em <em>perspectiva.</em></h1><p>Chamados publicados pelo TUD local · versão {snapshot.appVersion}</p></div><div className="header-stamp"><span>Atualizado</span><strong>{formatDate(snapshot.generatedAt)}</strong></div></header>
      <section id="overview" className="metric-grid">
        <Metric label="Atendimentos" value={snapshot.summary.total} note="registros publicados"/>
        <Metric label="Em aberto" value={snapshot.summary.open} note="aguardando conclusão" tone="orange"/>
        <Metric label="Em andamento" value={snapshot.summary.inProgress} note="em execução" tone="blue"/>
        <Metric label="Concluídos" value={`${snapshot.summary.completionRate}%`} note={`${snapshot.summary.completed} finalizados`} tone="green"/>
      </section>
      <section id="tickets" className="ticket-section">
        <div className="section-heading"><div><span className="eyebrow">Registro completo</span><h2>Atendimentos</h2></div><span>{filtered.length} de {snapshot.tickets.length}</span></div>
        <div className="filters"><label className="search-box"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por ID, título, descrição ou condomínio"/></label><select value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos os status</option><option>Aberto</option><option>Em andamento</option><option>Concluído</option></select><select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas as categorias</option>{categories.map(item => <option key={item}>{item}</option>)}</select><select value={condominium} onChange={event => setCondominium(event.target.value)}><option value="">Todos os condomínios</option>{condominiums.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
        <div className="ticket-table"><div className="table-head"><span>Chamado</span><span>Condomínio</span><span>Status</span><span>Categoria</span><span>Data</span><span/></div>{filtered.map(ticket => <button className="ticket-row" key={ticket.id} onClick={() => setSelectedId(ticket.id)}><span className="ticket-main"><strong>{ticketId(ticket.id)}</strong><b>{ticket.title}</b><small>{ticket.description || 'Sem descrição informada'}</small></span><span>{ticket.condominiumName}</span><span><Status value={ticket.status}/></span><span>{ticket.category}</span><span>{formatDate(ticket.serviceAt)}</span><ChevronRight size={18}/></button>)}{filtered.length === 0 && <div className="no-results"><Search size={24}/><strong>Nenhum atendimento encontrado.</strong><span>Ajuste os filtros para ampliar a busca.</span></div>}</div>
      </section>
    </main>
    {selected && <TicketDetail ticket={selected} snapshot={snapshot} onClose={() => setSelectedId(null)} onSelect={setSelectedId}/>} 
  </div>
}

function Metric({ label, value, note, tone = '' }: { label: string; value: string | number; note: string; tone?: string }) {
  return <article className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}

function Status({ value }: { value: WebTicket['status'] }) {
  return <span className={`status ${value === 'Concluído' ? 'done' : value === 'Em andamento' ? 'progress' : 'open'}`}><i/>{value}</span>
}

function EmptySync() {
  return <main className="empty-sync"><div className="brand-mark">tud.</div><CloudOff/><span className="eyebrow">Painel conectado</span><h1>Aguardando a primeira sincronização.</h1><p>No aplicativo TUD, abra <strong>Preferências → Visualização online</strong> e clique em <strong>Sincronizar agora</strong>.</p><form action="/api/logout" method="post"><button>Sair</button></form></main>
}

function CloudOff() { return <div className="empty-symbol"><ArrowUpRight size={28}/></div> }

type Group = { at: string; ids: number[]; notes: WebTicketUpdate[]; changes: WebTicketUpdate[]; attachments: WebAttachment[] }

function groups(ticket: WebTicket) {
  const map = new Map<string, Group>()
  for (const update of ticket.updates.filter(item => item.type !== 'criacao')) {
    const group = map.get(update.createdAt) || { at: update.createdAt, ids: [], notes: [], changes: [], attachments: [] }
    group.ids.push(update.id)
    if (update.type === 'nota') group.notes.push(update); else group.changes.push(update)
    map.set(update.createdAt, group)
  }
  for (const group of map.values()) group.attachments = ticket.attachments.filter(attachment => attachment.updateId !== null && group.ids.includes(attachment.updateId))
  return [...map.values()].sort((a, b) => a.at.localeCompare(b.at))
}

function TicketDetail({ ticket, snapshot, onClose, onSelect }: { ticket: WebTicket; snapshot: WebSnapshot; onClose: () => void; onSelect: (id: number) => void }) {
  const [media, setMedia] = useState<WebAttachment | null>(null)
  const creation = ticket.updates.find(update => update.type === 'criacao')
  const timeline = useMemo(() => groups(ticket), [ticket])
  const creationAttachments = ticket.attachments.filter(attachment => attachment.updateId === null)
  const condominium = snapshot.condominiums.find(item => item.id === ticket.condominiumId)
  return <div className="detail-overlay" role="dialog" aria-modal="true" aria-label={`Atendimento ${ticketId(ticket.id)}`}>
    <header className="detail-top"><button onClick={onClose}><ArrowLeft size={17}/> Voltar ao painel</button><div><span className="readonly-pill"><Eye size={14}/> Somente leitura</span><button className="close-detail" onClick={onClose} aria-label="Fechar"><X size={20}/></button></div></header>
    <main className="detail-content">
      <section className="detail-title"><span className="eyebrow">Atendimento {ticketId(ticket.id)} · {ticket.condominiumName}</span><h1>{ticket.title}</h1><div className="detail-meta"><Status value={ticket.status}/><span className="plain-pill">{ticket.category}</span><span className="plain-pill">Prioridade {ticket.priority.toLowerCase()}</span><time>{formatDate(ticket.serviceAt)}</time></div></section>
      <div className="detail-layout"><div className="timeline"><TimelineCard title="Criação do chamado" date={creation?.createdAt || ticket.createdAt} marker="create"><p>{ticket.description || 'Nenhuma descrição informada.'}</p><dl className="ticket-facts"><div><dt>Título</dt><dd>{ticket.title}</dd></div><div><dt>Condomínio</dt><dd>{ticket.condominiumName}</dd></div><div><dt>Categoria inicial</dt><dd>{creation?.nextValue || ticket.category}</dd></div><div><dt>Status inicial</dt><dd>{creation?.previousValue || ticket.status}</dd></div><div><dt>Prioridade</dt><dd>{ticket.priority}</dd></div><div><dt>Data e hora</dt><dd>{formatDate(ticket.serviceAt)}</dd></div></dl><Attachments items={creationAttachments} onOpen={setMedia}/></TimelineCard>
      {timeline.map(group => <TimelineCard key={group.at} title="Atualização" date={group.at}>{group.notes.filter(note => note.text).map(note => <p key={note.id}>{note.text}</p>)}{group.changes.length > 0 && <div className="change-list">{group.changes.map(change => <div key={change.id}><span>{change.type === 'status' ? <CircleDot size={15}/> : <Tag size={15}/>} {change.type === 'status' ? 'Status' : 'Categoria'}</span><strong>{change.previousValue}</strong><ArrowUpRight size={14}/><strong>{change.nextValue}</strong></div>)}</div>}<Attachments items={group.attachments} onOpen={setMedia}/></TimelineCard>)}</div>
      <aside className="context-card"><span className="eyebrow">Condomínio</span><h2>{condominium?.name || ticket.condominiumName}</h2><Info label="Endereço" value={condominium?.address}/><Info label="Contato geral" value={condominium?.generalContact}/><Info label="Gestor responsável" value={[condominium?.managerName, condominium?.managerContact].filter(Boolean).join(' · ')}/><Info label="Equipe de T.I." value={[condominium?.itName, condominium?.itContact].filter(Boolean).join(' · ')}/>{condominium?.notes && <Info label="Observações" value={condominium.notes}/>}<div className="related-box"><span className="eyebrow"><Link2 size={13}/> Atendimentos relacionados</span>{ticket.relatedIds.length ? ticket.relatedIds.map(id => { const related = snapshot.tickets.find(item => item.id === id); return related ? <button key={id} onClick={() => onSelect(id)}><span><strong>{ticketId(id)}</strong>{related.title}</span><ChevronRight size={16}/></button> : null }) : <p>Nenhum atendimento vinculado.</p>}</div></aside></div>
    </main>
    {media && <div className="lightbox" onClick={() => setMedia(null)}><button onClick={() => setMedia(null)} aria-label="Fechar imagem"><X size={20}/></button><img src={`/api/media?key=${media.mediaKey}`} alt={media.name} onClick={event => event.stopPropagation()}/><span>{media.name}</span></div>}
  </div>
}

function TimelineCard({ title, date, marker = 'update', children }: { title: string; date: string; marker?: string; children: React.ReactNode }) {
  return <article className="timeline-entry"><span className={`timeline-marker ${marker}`}>{marker === 'create' ? <CheckCircle2 size={18}/> : <Clock3 size={17}/>}</span><div className="timeline-card"><header><h2>{title}</h2><time>{formatDate(date)}</time></header>{children}</div></article>
}

function Attachments({ items, onOpen }: { items: WebAttachment[]; onOpen: (item: WebAttachment) => void }) {
  if (!items.length) return null
  return <div className="web-attachments"><span className="eyebrow"><FileImage size={13}/> Anexos</span><div>{items.map(item => <button key={item.id} onClick={() => onOpen(item)}><img src={`/api/media?key=${item.mediaKey}`} alt={item.name}/><span>{item.name}</span></button>)}</div></div>
}

function Info({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return <div className="context-info"><span>{label}</span><p>{value}</p></div>
}

