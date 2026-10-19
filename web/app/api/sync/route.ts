import { del, list, put } from '@vercel/blob'
import { gunzipSync } from 'node:zlib'
import { WEB_SNAPSHOT_VERSION, type WebSnapshot } from '../../../../shared/web-snapshot'
import { isSyncAuthenticated } from '@/lib/auth'
import { MEDIA_PREFIX, SNAPSHOT_PATH } from '@/lib/snapshot'

export const runtime = 'nodejs'
const MAX_BYTES = 3_800_000

function validSnapshot(value: unknown): value is WebSnapshot {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<WebSnapshot>
  return item.schemaVersion === WEB_SNAPSHOT_VERSION && typeof item.generatedAt === 'string' && Array.isArray(item.condominiums) && Array.isArray(item.tickets) && item.tickets.length <= 100_000
}

async function removeUnusedMedia(keep: Set<string>) {
  const unused: string[] = []
  let cursor: string | undefined
  do {
    const page = await list({ prefix: MEDIA_PREFIX, limit: 1000, cursor })
    unused.push(...page.blobs.filter(blob => !keep.has(blob.pathname)).map(blob => blob.url))
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  if (unused.length) await del(unused)
}

export async function POST(request: Request) {
  if (!isSyncAuthenticated(request)) return Response.json({ error: 'Chave de sincronização inválida.' }, { status: 401 })
  if (request.headers.get('content-encoding') !== 'gzip') return Response.json({ error: 'Formato de sincronização inválido.' }, { status: 415 })
  const compressed = Buffer.from(await request.arrayBuffer())
  if (!compressed.length || compressed.byteLength > MAX_BYTES) return Response.json({ error: 'A sincronização ultrapassa o limite permitido.' }, { status: 413 })
  let snapshot: WebSnapshot
  try { snapshot = JSON.parse(gunzipSync(compressed).toString('utf8')) as WebSnapshot }
  catch { return Response.json({ error: 'O pacote de sincronização está corrompido.' }, { status: 400 }) }
  if (!validSnapshot(snapshot)) return Response.json({ error: 'Versão de sincronização incompatível.' }, { status: 400 })

  const keep = new Set(snapshot.tickets.flatMap(ticket => ticket.attachments.map(attachment => `${MEDIA_PREFIX}${attachment.mediaKey}.webp`)))
  await put(SNAPSHOT_PATH, compressed, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/gzip' })
  await removeUnusedMedia(keep)
  return Response.json({ ok: true, generatedAt: snapshot.generatedAt, tickets: snapshot.tickets.length, attachments: keep.size })
}

