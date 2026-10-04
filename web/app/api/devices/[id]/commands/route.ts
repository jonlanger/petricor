import { command, CommandError, type Command } from '@/lib/server/twin'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = (await req.json()) as Command
  try {
    return Response.json(command(id, body))
  } catch (e) {
    const status = e instanceof CommandError ? e.status : 500
    return Response.json({ error: (e as Error).message }, { status })
  }
}
