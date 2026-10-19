import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import sharp from 'sharp'
import { WEB_SNAPSHOT_VERSION, type WebAttachment, type WebSnapshot } from '../../shared/web-snapshot'
import type { Anexo, AppSettings, Atendimento, AtendimentoAtualizacao, Condominio } from '../../src/types/domain'
import type { TudDatabase } from '../db/database'

const MAX_UPLOAD_BYTES = 3_800_000

export interface WebSyncResult {
  syncedAt: string
  tickets: number
  attachments: number
  uploadedAttachments: number
}

type PreparedAttachment = { attachment: WebAttachment; bytes: Buffer }

function endpoint(base: string, route: string) {
  const url = new URL(base.trim())
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('A visualização online precisa usar um endereço HTTPS.')
  }
  return new URL(route, `${url.origin}/`).toString()
}

async function request(url: string, token: string, init: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) }
    })
    if (!response.ok) {
      const message = await response.text().catch(() => '')
      throw new Error(message || `O servidor respondeu com o código ${response.status}.`)
    }
    return response
  } finally { clearTimeout(timeout) }
}

async function webImage(root: string, attachment: Anexo): Promise<PreparedAttachment> {
  const source = path.resolve(root, attachment.caminho.replace(/^\/+/, ''))
  const safeRoot = `${path.resolve(root)}${path.sep}`
  if (!source.startsWith(safeRoot) || !fs.existsSync(source)) throw new Error(`Anexo não encontrado: ${attachment.nome_original}`)

  let bytes = await sharp(source).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
  if (bytes.byteLength > MAX_UPLOAD_BYTES) bytes = await sharp(source).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).webp({ quality: 62 }).toBuffer()
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new Error(`O anexo ${attachment.nome_original} ficou grande demais para a versão web.`)
  const mediaKey = crypto.createHash('sha256').update(bytes).digest('hex')
  return {
    bytes,
    attachment: {
      id: attachment.id,
      updateId: attachment.atualizacao_id,
      name: attachment.nome_original,
      mediaKey,
      createdAt: attachment.criado_em
    }
  }
}

export async function buildWebSnapshot(database: TudDatabase, root: string, appVersion: string) {
  const condominiumRows = database.listCondominios(true)
  const ticketRows = database.listAtendimentos({ sort: 'id' })
  const prepared: PreparedAttachment[] = []
  const tickets = [] as WebSnapshot['tickets']

  for (const row of ticketRows) {
    const ticket = database.getAtendimento(row.id) as Atendimento
    const attachments: WebAttachment[] = []
    for (const item of ticket.anexos || []) {
      const converted = await webImage(root, item)
      attachments.push(converted.attachment)
      prepared.push(converted)
    }
    tickets.push({
      id: ticket.id,
      condominiumId: ticket.condominio_id,
      condominiumName: ticket.condominio_nome,
      title: ticket.titulo,
      description: ticket.descricao,
      category: ticket.categoria,
      status: ticket.status,
      priority: ticket.prioridade,
      serviceAt: ticket.data_atendimento,
      createdAt: ticket.criado_em,
      updatedAt: ticket.atualizado_em,
      completedAt: ticket.concluido_em,
      relatedIds: database.relatedAtendimentos(ticket.id).map(related => related.id).sort((a, b) => a - b),
      updates: database.listUpdates(ticket.id).sort((a, b) => a.criado_em.localeCompare(b.criado_em) || a.id - b.id).map((update: AtendimentoAtualizacao) => ({
        id: update.id,
        type: update.tipo,
        text: update.texto,
        previousValue: update.valor_anterior,
        nextValue: update.valor_novo,
        createdAt: update.criado_em
      })),
      attachments
    })
  }

  const completed = tickets.filter(ticket => ticket.status === 'Concluído').length
  const snapshot: WebSnapshot = {
    schemaVersion: WEB_SNAPSHOT_VERSION,
    generatedAt: new Date().toISOString(),
    appVersion,
    summary: {
      total: tickets.length,
      open: tickets.filter(ticket => ticket.status === 'Aberto').length,
      inProgress: tickets.filter(ticket => ticket.status === 'Em andamento').length,
      completed,
      condominiums: condominiumRows.filter(condominium => !condominium.arquivado).length,
      completionRate: tickets.length ? Math.round((completed / tickets.length) * 100) : 0
    },
    condominiums: condominiumRows.map((condominium: Condominio) => ({
      id: condominium.id,
      name: condominium.nome,
      address: condominium.endereco,
      generalContact: condominium.contato,
      managerName: condominium.gestor_nome,
      managerContact: condominium.gestor_contato,
      itName: condominium.ti_nome,
      itContact: condominium.ti_contato,
      notes: condominium.observacoes,
      archived: Boolean(condominium.arquivado)
    })),
    tickets
  }
  return { snapshot, prepared }
}

export class WebSyncService {
  private active: Promise<WebSyncResult> | null = null

  constructor(private root: string, private database: TudDatabase, private appVersion: string) {}

  run() {
    if (this.active) return this.active
    this.active = this.perform().finally(() => { this.active = null })
    return this.active
  }

  private async perform(): Promise<WebSyncResult> {
    const settings = this.database.settings()
    const base = settings.webSyncUrl.trim()
    const token = settings.webSyncToken.trim()
    if (!base || !token) throw new Error('Informe o endereço do painel e a chave de sincronização.')
    try {
      const { snapshot, prepared } = await buildWebSnapshot(this.database, this.root, this.appVersion)
      const prepare = await request(endpoint(base, '/api/sync/prepare'), token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaKeys: prepared.map(item => item.attachment.mediaKey) })
      })
      const { missing = [] } = await prepare.json() as { missing?: string[] }
      const missingSet = new Set(missing)
      const uploadedKeys = new Set<string>()
      let uploadedAttachments = 0
      for (const item of prepared) {
        if (!missingSet.has(item.attachment.mediaKey) || uploadedKeys.has(item.attachment.mediaKey)) continue
        await request(endpoint(base, `/api/sync/media?key=${encodeURIComponent(item.attachment.mediaKey)}`), token, {
          method: 'POST',
          headers: { 'Content-Type': 'image/webp' },
          body: new Uint8Array(item.bytes)
        })
        uploadedKeys.add(item.attachment.mediaKey)
        uploadedAttachments += 1
      }
      const body = gzipSync(Buffer.from(JSON.stringify(snapshot), 'utf8'))
      if (body.byteLength > MAX_UPLOAD_BYTES) throw new Error('O volume de chamados ficou grande demais para uma única sincronização. Contate o suporte do TUD.')
      await request(endpoint(base, '/api/sync'), token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
        body: new Uint8Array(body)
      })
      const result = { syncedAt: snapshot.generatedAt, tickets: snapshot.tickets.length, attachments: prepared.length, uploadedAttachments }
      this.database.setSettings({ webSyncLastAt: result.syncedAt, webSyncLastError: '' })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida na sincronização online.'
      this.database.setSettings({ webSyncLastError: message })
      throw new Error(message)
    }
  }
}

export function webSyncConfigured(settings: AppSettings) {
  return settings.webSyncEnabled && Boolean(settings.webSyncUrl.trim() && settings.webSyncToken.trim())
}

