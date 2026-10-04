import { db, save } from '@/lib/server/store'
import { currentUser } from '@/lib/server/session'
import { audit } from '@/lib/server/twin'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const u = await currentUser()
  const a = db().alerts.find((x) => x.id === id)
  if (!a) return Response.json({ error: 'Not found' }, { status: 404 })
  a.ackAt = Date.now(); a.ackBy = u?.id ?? 'unknown'
  audit(a.ackBy, 'alert.ack', a.id, a.code)
  save()
  return Response.json(a)
}
