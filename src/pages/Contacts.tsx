import { BookUser, Building2, Mail, Pencil, Phone, Plus, Search, Trash2, UserRound, UsersRound, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Condominio, Contato, ContatoInput, ContatoTipo } from '../types/domain'

const emptyContact = (): ContatoInput => ({ tipo: 'Gestor', nome: '', empresa: '', telefone: '', email: '', condominioId: null, observacoes: '' })

export function Contacts({ condominios }: { condominios: Condominio[] }) {
  const queryClient = useQueryClient()
  const { data: contacts = [] } = useQuery({ queryKey: ['contatos'], queryFn: () => window.tud.contatos.list() })
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ContatoTipo | ''>('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<ContatoInput>(emptyContact)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const filtered = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean)
    return contacts.filter(contact => (!filter || contact.tipo === filter) && terms.every(term => normalize([contact.nome, contact.tipo, contact.empresa, contact.telefone, contact.email, contact.condominio_nome, contact.observacoes].filter(Boolean).join(' ')).includes(term)))
  }, [contacts, filter, search])
  const managers = contacts.filter(contact => contact.tipo === 'Gestor').length
  const teams = contacts.length - managers

  const reset = () => { setEditingId(null); setDraft(emptyContact()); setError('') }
  const edit = (contact: Contato) => {
    setEditingId(contact.id)
    setDraft({ tipo: contact.tipo, nome: contact.nome, empresa: contact.empresa, telefone: contact.telefone, email: contact.email, condominioId: contact.condominio_id, observacoes: contact.observacoes })
    setError('')
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!draft.nome.trim()) { setError('Informe o nome do contato ou da equipe.'); return }
    setSaving(true)
    try {
      if (editingId) await window.tud.contatos.update(editingId, draft)
      else await window.tud.contatos.create(draft)
      await queryClient.invalidateQueries({ queryKey: ['contatos'] }); reset()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o contato.') }
    finally { setSaving(false) }
  }
  const remove = async (contact: Contato) => {
    if (!confirm(`Excluir “${contact.nome}” da agenda?`)) return
    await window.tud.contatos.remove(contact.id)
    if (editingId === contact.id) reset()
    await queryClient.invalidateQueries({ queryKey: ['contatos'] })
  }

  return <div className="page contacts-page">
    <div className="page-top"><div><span className="eyebrow">Agenda interna</span><h1 className="display md"><em>Contatos</em></h1><p className="support">Centralize gestores e equipes de T.I. para encontrar rapidamente quem acionar.</p></div><div className="contact-totals"><span><strong>{managers}</strong> gestor{managers === 1 ? '' : 'es'}</span><span><strong>{teams}</strong> equipe{teams === 1 ? '' : 's'} de T.I.</span></div></div>
    <div className="contacts-toolbar"><label className="search"><Search/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar nome, condomínio, telefone…"/></label><div className="segmented"><button className={!filter ? 'active' : ''} onClick={() => setFilter('')}>Todos</button><button className={filter === 'Gestor' ? 'active' : ''} onClick={() => setFilter('Gestor')}>Gestores</button><button className={filter === 'Equipe de T.I.' ? 'active' : ''} onClick={() => setFilter('Equipe de T.I.')}>Equipes de T.I.</button></div><button className="primary" onClick={reset}><Plus size={17}/> Novo contato</button></div>
    <div className="contacts-layout"><section className="contact-list">
      {filtered.length ? filtered.map(contact => <article className="contact-card" key={contact.id}><div className={`contact-avatar ${contact.tipo === 'Equipe de T.I.' ? 'team' : ''}`}>{contact.tipo === 'Gestor' ? <UserRound/> : <UsersRound/>}</div><div className="contact-main"><div className="contact-title"><div><span className="badge">{contact.tipo}</span><h2>{contact.nome}</h2>{contact.empresa && <p>{contact.empresa}</p>}</div><div className="contact-actions"><button className="icon-button" onClick={() => edit(contact)} title="Editar contato" aria-label={`Editar ${contact.nome}`}><Pencil/></button><button className="icon-button danger" onClick={() => remove(contact)} title="Excluir contato" aria-label={`Excluir ${contact.nome}`}><Trash2/></button></div></div><div className="contact-details">{contact.telefone && <span><Phone/>{contact.telefone}</span>}{contact.email && <span><Mail/>{contact.email}</span>}{contact.condominio_nome && <span><Building2/>{contact.condominio_nome}</span>}</div>{contact.observacoes && <p className="contact-notes">{contact.observacoes}</p>}</div></article>) : <div className="contact-empty"><BookUser/><h2>{contacts.length ? 'Nenhum resultado encontrado.' : 'Sua agenda está vazia.'}</h2><p>{contacts.length ? 'Tente outro termo ou filtro.' : 'Cadastre o primeiro gestor ou a primeira equipe de T.I.'}</p></div>}
    </section><aside className="card contact-compose"><div className="contact-form-head"><div><span className="eyebrow">{editingId ? 'Editar contato' : 'Novo contato'}</span><h2>{editingId ? 'Atualizar dados' : 'Quem você quer lembrar?'}</h2></div>{editingId && <button className="icon-button" onClick={reset} aria-label="Cancelar edição"><X/></button>}</div><form onSubmit={submit}>
      <label><span>Tipo</span><select value={draft.tipo} onChange={event => setDraft({ ...draft, tipo: event.target.value as ContatoTipo })}><option>Gestor</option><option>Equipe de T.I.</option></select></label>
      <label><span>Nome</span><input autoFocus value={draft.nome} maxLength={160} onChange={event => setDraft({ ...draft, nome: event.target.value })} placeholder={draft.tipo === 'Gestor' ? 'Ex.: Ana Ribeiro' : 'Ex.: Suporte N1'}/></label>
      <label><span>Empresa / equipe — opcional</span><input value={draft.empresa} maxLength={160} onChange={event => setDraft({ ...draft, empresa: event.target.value })} placeholder="Ex.: Administração Central"/></label>
      <div className="contact-field-grid"><label><span>Telefone — opcional</span><input value={draft.telefone} maxLength={80} onChange={event => setDraft({ ...draft, telefone: event.target.value })} placeholder="(00) 00000-0000"/></label><label><span>E-mail — opcional</span><input type="email" value={draft.email} maxLength={200} onChange={event => setDraft({ ...draft, email: event.target.value })} placeholder="nome@empresa.com"/></label></div>
      <label><span>Condomínio — opcional</span><select value={draft.condominioId ?? ''} onChange={event => setDraft({ ...draft, condominioId: event.target.value ? Number(event.target.value) : null })}><option value="">Contato geral</option>{condominios.map(condominio => <option key={condominio.id} value={condominio.id}>{condominio.nome}</option>)}</select></label>
      <label><span>Observações — opcional</span><textarea value={draft.observacoes} maxLength={3000} onChange={event => setDraft({ ...draft, observacoes: event.target.value })} placeholder="Horário de atendimento, especialidade, contexto…"/></label>
      {error && <div className="error-text">{error}</div>}<button className="primary" disabled={saving || !draft.nome.trim()}>{saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Adicionar à agenda'}</button>
    </form></aside></div>
  </div>
}

function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim() }
