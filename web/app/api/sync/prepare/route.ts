import { list } from '@vercel/blob'
import { isSyncAuthenticated } from '@/lib/auth'
import { MEDIA_PREFIX } from '@/lib/snapshot'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isSyncAuthenticated(request)) return Response.json({ error: 'Chave de sincronização inválida.' }, { status: 401 })
  const body = await request.json().catch(() => null) as { mediaKeys?: unknown } | null
  if (!body || !Array.isArray(body.mediaKeys) || body.mediaKeys.length > 10_000 || body.mediaKeys.some(key => typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key))) {
    return Response.json({ error: 'Lista de anexos inválida.' }, { status: 400 })
  }
  const existing = new Set<string>()
  let cursor: string | undefined
  do {
    const page = await list({ prefix: MEDIA_PREFIX, limit: 1000, cursor })
    for (const blob of page.blobs) {
      const match = blob.pathname.match(/^tud\/media\/([a-f0-9]{64})\.webp$/)
      if (match) existing.add(match[1])
    }
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  return Response.json({ missing: body.mediaKeys.filter((key): key is string => typeof key === 'string' && !existing.has(key)) })
}

