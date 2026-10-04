import { db } from '@/lib/server/store'
import { observations } from '@/lib/server/pipeline'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const run = db().runs.find((r) => r.id === id)
  if (!run) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ...observations(run), env: run.env, elapsedH: run.elapsedH, state: run.state })
}
