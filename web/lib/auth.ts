import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'tud_viewer_session'

export function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function viewerSessionValue() {
  const password = process.env.TUD_VIEWER_PASSWORD || ''
  const secret = process.env.TUD_SESSION_SECRET || ''
  if (!password || !secret) return ''
  return createHmac('sha256', secret).update(`tud-viewer:${password}`).digest('hex')
}

export async function isViewerAuthenticated() {
  const expected = viewerSessionValue()
  const actual = (await cookies()).get(SESSION_COOKIE)?.value || ''
  return Boolean(expected && actual && safeEqual(actual, expected))
}

export function isSyncAuthenticated(request: Request) {
  const expected = process.env.TUD_SYNC_TOKEN || ''
  const actual = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  return Boolean(expected && actual && safeEqual(actual, expected))
}

