import { db } from '@/lib/server/store'
import { observations } from '@/lib/server/pipeline'
import { SPECIES_BY_KEY } from '@/lib/science/species'

/** Results export for LIMS import. ?format=csv (default) | json. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const s = db()
  const run = s.runs.find((r) => r.id === id)
  if (!run) return Response.json({ error: 'Not found' }, { status: 404 })
  const obs = observations(run)
  const fmt = new URL(req.url).searchParams.get('format') ?? 'csv'
  const rows = obs.dishes.flatMap((d) => {
    const dish = run.dishes.find((x) => x.position === d.position)!
    const sample = s.samples.find((x) => x.id === dish.sampleId)
    const last = d.frames[d.frames.length - 1]
    return (last?.colonies ?? []).map((c) => ({
      run_id: run.id, run_name: run.name, position: d.position, barcode: dish.barcode, sample: sample?.label ?? '',
      source: sample?.source ?? '', capture_h: last.h, colony_id: c[0], x_mm: c[1], y_mm: c[2], diameter_mm: +(c[3] * 2).toFixed(2),
      first_seen_h: c[10], presumptive_id: SPECIES_BY_KEY[c[4]]?.name ?? c[4], confidence: c[5],
      review_status: run.review.status, reviewed_by: run.review.by ?? '', simulated: true,
    }))
  })
  if (fmt === 'json') return Response.json({ run: { id: run.id, name: run.name, protocolId: run.protocolId, review: run.review }, colonies: rows })
  const head = Object.keys(rows[0] ?? { run_id: '' })
  const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`
  const csv = [head.join(','), ...rows.map((r) => head.map((k) => esc((r as Record<string, unknown>)[k])).join(','))].join('\n')
  return new Response(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${run.id}.csv"` } })
}
