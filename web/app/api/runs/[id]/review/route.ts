import { db, save } from '@/lib/server/store'
import { audit } from '@/lib/server/twin'
import { can, currentUser } from '@/lib/server/session'
import { emit } from '@/lib/server/bus'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await currentUser()
  if (!can.review(user)) return Response.json({ error: 'Your role cannot sign off results' }, { status: 403 })
  const { status, note } = (await req.json()) as { status: 'approved' | 'changes'; note?: string }
  const run = db().runs.find((r) => r.id === id)
  if (!run) return Response.json({ error: 'Not found' }, { status: 404 })
  if (run.state !== 'complete') return Response.json({ error: 'Only completed runs can be reviewed' }, { status: 409 })
  run.review = { status, note, by: user!.id, at: Date.now() }
  audit(user!.id, status === 'approved' ? 'run.approve' : 'run.request_changes', run.id, note)
  emit({ type: 'run', runId: run.id, data: { review: run.review } })
  save()
  return Response.json({ review: run.review })
}
