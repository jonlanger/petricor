import { cookies } from 'next/headers'
import { SESSION_COOKIE } from '@/lib/server/session'
import { db } from '@/lib/server/store'

export async function POST(req: Request) {
  const { userId } = await req.json()
  if (!db().users.some((u) => u.id === userId)) return Response.json({ error: 'Unknown user' }, { status: 400 })
  ;(await cookies()).set(SESSION_COOKIE, userId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12 })
  return Response.json({ ok: true })
}

export async function DELETE() {
  ;(await cookies()).delete(SESSION_COOKIE)
  return Response.json({ ok: true })
}
