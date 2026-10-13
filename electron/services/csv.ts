import type { AtendimentoAtualizacao, Condominio } from '../../src/types/domain'
import type { TudDatabase } from '../db/database'

const ticketId = (id: number) => `TUD-${String(id).padStart(4, '0')}`

const formatDate = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date).replace(',', '')
}

const escapeCsv = (value: unknown) => {
  const text = String(value ?? '').replace(/\0/g, '')
  const safe = /^\s*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

const groupUpdates = (updates: AtendimentoAtualizacao[]) => {
  const groups = new Map<string, AtendimentoAtualizacao[]>()
  for (const update of [...updates].sort((a, b) => a.criado_em.localeCompare(b.criado_em) || a.id - b.id)) {
    const group = groups.get(update.criado_em) || []
    group.push(update)
    groups.set(update.criado_em, group)
  }
  return [...groups.entries()]
}

const updateHistory = (updates: AtendimentoAtualizacao[]) => groupUpdates(updates).map(([date, group]) => {
  const details = group.flatMap(update => {
    if (update.tipo === 'criacao') return ['Criação do chamado']
    if (update.tipo === 'nota') return update.texto ? [`Nota: ${update.texto}`] : []
    if (update.tipo === 'status') return [`Status: ${update.valor_anterior || '—'} → ${update.valor_novo || '—'}`]
    if (update.tipo === 'categoria') return [`Categoria: ${update.valor_anterior || '—'} → ${update.valor_novo || '—'}`]
    return []
  })
  return `[${formatDate(date)}] ${details.join(' | ')}`
}).join('\n')

const headers = [
  'ID do chamado', 'Condomínio', 'Título', 'Descrição inicial',
  'Categoria inicial', 'Categoria atual', 'Status inicial', 'Status atual', 'Prioridade',
  'Data e hora do atendimento', 'Criado em', 'Última atualização', 'Concluído em',
  'Quantidade de atualizações', 'Histórico completo',
  'Quantidade de anexos', 'Nomes dos anexos', 'Chamados relacionados',
  'Endereço do condomínio', 'Contato geral', 'Gestor responsável', 'Contato do gestor',
  'Equipe de T.I.', 'Contato da equipe de T.I.', 'Observações do condomínio'
]

export function buildDetailedCsv(database: TudDatabase, condominioId?: number) {
  const condominios = new Map(database.listCondominios(true).map(item => [item.id, item] as const))
  const rows = database.listAtendimentos(condominioId ? { condominioId } : {})
  const body = rows.map(row => {
    const item = database.getAtendimento(row.id) || row
    const condo = condominios.get(row.condominio_id) as Condominio | undefined
    const updates = database.listUpdates(row.id)
    const creation = updates.find(update => update.tipo === 'criacao')
    const initialStatus = creation?.valor_anterior || updates.find(update => update.tipo === 'status')?.valor_anterior || row.status
    const initialCategory = creation?.valor_novo || updates.find(update => update.tipo === 'categoria')?.valor_anterior || row.categoria
    const additionalUpdates = new Set(updates.filter(update => update.tipo !== 'criacao').map(update => update.criado_em)).size
    const attachments = item.anexos || []
    const related = database.relatedAtendimentos(row.id).map(relatedItem => ticketId(relatedItem.id)).sort().join(' | ')
    return [
      ticketId(row.id), row.condominio_nome, row.titulo, row.descricao,
      initialCategory, row.categoria, initialStatus, row.status, row.prioridade,
      formatDate(row.data_atendimento), formatDate(row.criado_em), formatDate(row.atualizado_em), formatDate(row.concluido_em),
      additionalUpdates, updateHistory(updates),
      attachments.length, attachments.map(attachment => attachment.nome_original).join(' | '), related,
      condo?.endereco, condo?.contato, condo?.gestor_nome, condo?.gestor_contato,
      condo?.ti_nome, condo?.ti_contato, condo?.observacoes
    ].map(escapeCsv).join(';')
  })
  return [headers.map(escapeCsv).join(';'), ...body].join('\r\n')
}

export function detailedCsvFileName(date = new Date(), condominiumName?: string) {
  const part = (value: number) => String(value).padStart(2, '0')
  const stamp = `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}_${part(date.getHours())}-${part(date.getMinutes())}`
  const scope = condominiumName?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  return `TUD-atendimentos${scope ? `-${scope}` : ''}-${stamp}.csv`
}
