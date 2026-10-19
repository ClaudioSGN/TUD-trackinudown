import { NextResponse } from 'next/server'
import { SESSION_COOKIE, safeEqual, viewerSessionValue } from '@/lib/auth'

export async function POST(request: Request) {
  const form = await request.formData()
  const password = String(form.get('password') || '')
  const expected = process.env.TUD_VIEWER_PASSWORD || ''
  if (!expected || !password || !safeEqual(password, expected)) return NextResponse.redirect(new URL('/?error=senha', request.url), 303)
  const response = NextResponse.redirect(new URL('/', request.url), 303)
  response.cookies.set(SESSION_COOKIE, viewerSessionValue(), { httpOnly: true, secure: new URL(request.url).protocol === 'https:', sameSite: 'strict', path: '/', maxAge: 60 * 60 * 12 })
  return response
}

