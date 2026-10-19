import { put } from '@vercel/blob'
import { type NextRequest } from 'next/server'
import { isSyncAuthenticated } from '@/lib/auth'
import { MEDIA_PREFIX } from '@/lib/snapshot'

export const runtime = 'nodejs'
const MAX_BYTES = 3_800_000

export async function POST(request: NextRequest) {
  if (!isSyncAuthenticated(request)) return Response.json({ error: 'Chave de sincronização inválida.' }, { status: 401 })
  const key = request.nextUrl.searchParams.get('key') || ''
  if (!/^[a-f0-9]{64}$/.test(key) || request.headers.get('content-type') !== 'image/webp') return Response.json({ error: 'Anexo inválido.' }, { status: 400 })
  const bytes = Buffer.from(await request.arrayBuffer())
  if (!bytes.length || bytes.byteLength > MAX_BYTES) return Response.json({ error: 'O anexo ultrapassa o limite da visualização online.' }, { status: 413 })
  await put(`${MEDIA_PREFIX}${key}.webp`, bytes, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'image/webp' })
  return Response.json({ ok: true })
}

