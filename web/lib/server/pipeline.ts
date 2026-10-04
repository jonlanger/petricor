import 'server-only'
import type { Run } from '../domain/types'
import { observeDish } from '../science/colonies'

/**
 * Imaging pipeline output. On hardware, the compute module segments each capture and syncs these records;
 * in the twin they are derived from the simulated inoculum so every surface consumes the same payload.
 *
 * Compact frame row: [id, x, y, r, key1, p1, key2, p2, key3, p3, firstSeenH]
 */
export type ColonyRow = [string, number, number, number, string, number, string, number, string, number, number]

export interface ObservationBundle {
  runId: string
  captures: number[]
  dishes: { position: number; frames: { h: number; coverage: number; colonies: ColonyRow[] }[] }[]
}

const memo = new Map<string, ObservationBundle>()

export function observations(run: Run): ObservationBundle {
  const k = `${run.id}:${run.captures.length}:${run.env.length}`
  const hit = memo.get(k)
  if (hit) return hit
  const r2 = (x: number) => Math.round(x * 100) / 100
  const bundle: ObservationBundle = {
    runId: run.id,
    captures: run.captures,
    dishes: run.dishes.map((d) => ({
      position: d.position,
      frames: run.captures.map((h) => {
        const o = observeDish(run.env, d.truth, d.position, h)
        return {
          h,
          coverage: r2(o.coverage),
          colonies: o.colonies.map((c) => {
            const g = c.guesses
            return [c.id, r2(c.x), r2(c.y), r2(c.r), g[0]?.key ?? '', r2(g[0]?.p ?? 0), g[1]?.key ?? '', r2(g[1]?.p ?? 0), g[2]?.key ?? '', r2(g[2]?.p ?? 0), r2(c.firstSeenH)] as ColonyRow
          }),
        }
      }),
    })),
  }
  memo.set(k, bundle)
  if (memo.size > 64) memo.delete(memo.keys().next().value!)
  return bundle
}

/** Latest-frame digest per dish for dashboards. */
export function latest(run: Run) {
  const h = run.captures[run.captures.length - 1] ?? 0
  return run.dishes.map((d) => {
    const o = observeDish(run.env, d.truth, d.position, h)
    const bySpecies: Record<string, number> = {}
    for (const c of o.colonies) bySpecies[c.guesses[0].key] = (bySpecies[c.guesses[0].key] ?? 0) + 1
    return { position: d.position, barcode: d.barcode, sampleId: d.sampleId, h, count: o.colonies.length, coverage: o.coverage, bySpecies,
      colonies: o.colonies.map((c) => ({ id: c.id, x: c.x, y: c.y, r: c.r, key: c.guesses[0].key, p: c.guesses[0].p })) }
  })
}
