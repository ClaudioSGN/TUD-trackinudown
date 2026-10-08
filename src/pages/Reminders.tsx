import { Bell, CalendarClock, Check, Link2, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { dateTime, ticketId } from '../lib/format'
import type { Lembrete } from '../types/domain'

export function Reminders() {
  const queryClient = useQueryClient()
  const { data: reminders = [] } = useQuery({ queryKey: ['lembretes', 'all'], queryFn: () => window.tud.lembretes.list(true) })
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [when, setWhen] = useState(defaultReminderTime)
  const [attendance, setAttendance] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pending = reminders.filter(reminder => !reminder.concluido)
  const completed = reminders.filter(reminder => reminder.concluido)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lembretes'] })
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    const match = attendance.trim().match(/^(?:TUD[-\s]?|#)?0*(\d+)$/i)
    if (attendance.trim() && !match) { setError('Informe um ID como TUD-0001.'); return }
    const date = new Date(when)
    if (!title.trim() || Number.isNaN(date.getTime())) { setError('Informe o título e a data do lembrete.'); return }
    setSaving(true)
    try {
      await window.tud.lembretes.create({ titulo: title.trim(), observacoes: notes.trim(), lembreteEm: date.toISOString(), atendimentoId: match ? Number(match[1]) : undefined })
      setTitle(''); setNotes(''); setAttendance(''); setWhen(defaultReminderTime()); await invalidate()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível criar o lembrete.') }
    finally { setSaving(false) }
  }
  const setDone = async (reminder: Lembrete, done: boolean) => { await window.tud.lembretes.setDone(reminder.id, done); await invalidate() }
  const remove = async (reminder: Lembrete) => { if (!confirm(`Excluir o lembrete “${reminder.titulo}”?`)) return; await window.tud.lembretes.remove(reminder.id); await invalidate() }
  return <div className="page reminders-page">
    <div className="page-top"><div><span className="eyebrow">Organização</span><h1 className="display md"><em>Lembretes</em></h1><p className="support">Agende retornos e tarefas sem perder o vínculo com os atendimentos.</p></div><div className="reminder-summary"><strong>{pending.length}</strong><span>pendente{pending.length === 1 ? '' : 's'}</span></div></div>
    <div className="reminder-layout"><section className="reminder-list"><ReminderGroup title="Pendentes" reminders={pending} onDone={setDone} onRemove={remove}/>{completed.length > 0 && <><button className="ghost completed-toggle" onClick={() => setShowCompleted(value => !value)}>{showCompleted ? 'Ocultar concluídos' : `Mostrar concluídos (${completed.length})`}</button>{showCompleted && <ReminderGroup title="Concluídos" reminders={completed} onDone={setDone} onRemove={remove}/>}</>}</section>
      <aside className="card reminder-compose"><span className="eyebrow">Novo lembrete</span><h2>O que precisa ser lembrado?</h2><form onSubmit={submit}><label><span>Título</span><input autoFocus value={title} maxLength={200} onChange={event => { setTitle(event.target.value); setError('') }} placeholder="Ex.: Retornar para o síndico"/></label><label><span>Data e hora</span><input type="datetime-local" value={when} onChange={event => setWhen(event.target.value)}/></label><label><span>Atendimento — opcional</span><input value={attendance} onChange={event => { setAttendance(event.target.value); setError('') }} placeholder="Ex.: TUD-0042"/></label><label><span>Observações — opcional</span><textarea value={notes} maxLength={2000} onChange={event => setNotes(event.target.value)} placeholder="Adicione algum contexto…"/></label>{error && <div className="error-text">{error}</div>}<button className="primary" disabled={saving || !title.trim()}><Bell size={16}/>{saving ? 'Salvando…' : 'Criar lembrete'}</button></form></aside></div>
  </div>
}

function ReminderGroup({ title, reminders, onDone, onRemove }: { title: string; reminders: Lembrete[]; onDone: (reminder: Lembrete, done: boolean) => void; onRemove: (reminder: Lembrete) => void }) {
  return <div className="reminder-group"><div className="reminder-group-title"><h2>{title}</h2><span className="badge">{reminders.length}</span></div>{reminders.length ? reminders.map(reminder => <ReminderRow key={reminder.id} reminder={reminder} onDone={onDone} onRemove={onRemove}/>) : <div className="reminder-empty"><Bell/><h3>Nenhum lembrete pendente.</h3><p>Use o formulário ao lado para criar o primeiro.</p></div>}</div>
}

function ReminderRow({ reminder, onDone, onRemove }: { reminder: Lembrete; onDone: (reminder: Lembrete, done: boolean) => void; onRemove: (reminder: Lembrete) => void }) {
  const overdue = !reminder.concluido && new Date(reminder.lembrete_em).getTime() < Date.now()
  return <article className={`reminder-row ${reminder.concluido ? 'completed' : ''} ${overdue ? 'overdue' : ''}`}><button className={`reminder-check ${reminder.concluido ? 'done' : ''}`} onClick={() => onDone(reminder, !reminder.concluido)} aria-label={reminder.concluido ? 'Reabrir lembrete' : 'Concluir lembrete'}>{reminder.concluido ? <Check size={16}/> : null}</button><div className="reminder-copy"><h3>{reminder.titulo}</h3>{reminder.observacoes && <p>{reminder.observacoes}</p>}<div className="reminder-meta"><span className={overdue ? 'danger' : ''}><CalendarClock size={14}/>{overdue ? 'Atrasado · ' : ''}{dateTime(reminder.lembrete_em)}</span>{reminder.atendimento_id && <span><Link2 size={14}/>{ticketId(reminder.atendimento_id)}{reminder.condominio_nome ? ` · ${reminder.condominio_nome}` : ''}</span>}</div></div><button className="icon-button reminder-delete" onClick={() => onRemove(reminder)} aria-label={`Excluir ${reminder.titulo}`}><Trash2 size={16}/></button></article>
}

function defaultReminderTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000)
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
