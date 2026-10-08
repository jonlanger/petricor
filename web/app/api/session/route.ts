import { cookies } from 'next/headers'
import { SESSION_COOKIE } from '@/lib/server/session'
import { db } from '@/lib/server/store'

/** Accepts a native form post from the login picker (works before hydration) or JSON. Form posts redirect into the app. */
export async function POST(req: Request) {
  const isForm = !req.headers.get('content-type')?.includes('application/json')
  const body = isForm ? Object.fromEntries(await req.formData()) : await req.json()
  const userId = String(body.userId ?? '')
  if (!db().users.some((u) => u.id === userId)) {
    if (isForm) return Response.redirect(new URL('/login', req.url), 303)
    return Response.json({ error: 'Unknown user' }, { status: 400 })
  }
  ;(await cookies()).set(SESSION_COOKIE, userId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12 })
  if (!isForm) return Response.json({ ok: true })
  const next = String(body.next ?? '')
  return Response.redirect(new URL(next.startsWith('/app') ? next : '/app', req.url), 303)
}

export async function DELETE() {
  ;(await cookies()).delete(SESSION_COOKIE)
  return Response.json({ ok: true })
}
