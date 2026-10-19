import { get } from '@vercel/blob'
import { NextResponse, type NextRequest } from 'next/server'
import { isViewerAuthenticated } from '@/lib/auth'
import { MEDIA_PREFIX } from '@/lib/snapshot'

export async function GET(request: NextRequest) {
  if (!(await isViewerAuthenticated())) return new NextResponse('Não autorizado.', { status: 401 })
  const key = request.nextUrl.searchParams.get('key') || ''
  if (!/^[a-f0-9]{64}$/.test(key)) return new NextResponse('Arquivo inválido.', { status: 400 })
  const result = await get(`${MEDIA_PREFIX}${key}.webp`, { access: 'private', ifNoneMatch: request.headers.get('if-none-match') || undefined })
  if (!result) return new NextResponse('Não encontrado.', { status: 404 })
  if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers: { ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' } })
  if (result.statusCode !== 200) return new NextResponse('Não encontrado.', { status: 404 })
  return new NextResponse(result.stream, { headers: { 'Content-Type': result.blob.contentType || 'image/webp', 'X-Content-Type-Options': 'nosniff', ETag: result.blob.etag, 'Cache-Control': 'private, no-cache' } })
}

