/**
 * Colony-level simulation: turns inoculum ground truth + the run's temperature log into what the imaging
 * pipeline would observe at hour h. Radial growth follows the CMI with cumulative lag (see cmi.ts).
 *
 * The identification "classifier" here is a SIMULATION: confidence rises as colonies mature. It exists so the
 * product's review workflow can be exercised end-to-end; it is not a trained model.
 */
import { at, crossing, integrate, type EnvSample } from './cmi'
import { SPECIES_BY_KEY, cardinal } from './species'
import type { ColonyObs, ColonyTruth, DishObs, SourceType } from '../domain/types'
import { SOURCE_POOLS } from './species'

export const DISH_R = 43 // usable agar radius, mm
export const DETECT_R = 0.15 // mm radius (0.3 mm diameter) ≈ 12 px at ~25 µm/px

export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    return ((s >>> 0) % 1_000_000) / 1_000_000
  }
}

export function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

function poisson(r: () => number, mean: number) {
  const L = Math.exp(-mean)
  let k = 0, p = 1
  do { k++; p *= r() } while (p > L)
  return k - 1
}

function pick(r: () => number, pool: [string, number][]) {
  const tot = pool.reduce((a, [, w]) => a + w, 0)
  let x = r() * tot
  for (const [k, w] of pool) { if ((x -= w) <= 0) return k }
  return pool[pool.length - 1][0]
}

/** Draw a plausible inoculum for a dish (demo sampling model). */
export function drawInoculum(seed: number, source: SourceType, referenceSpecies?: string): ColonyTruth[] {
  const r = rng(seed)
  const out: ColonyTruth[] = []
  if (source === 'reference' && referenceSpecies) {
    out.push({ id: `c${seed.toString(36)}0`, species: referenceSpecies, x: 0, y: 0, lagScale: 1, muScale: 1, seed: seed + 1 })
    return out
  }
  const cfg = SOURCE_POOLS[source]
  if (!cfg.pool.length) return out // e.g. negative control
  const n = Math.max(1, Math.min(14, poisson(r, cfg.mean)))
  let tries = 0
  while (out.length < n && tries++ < 400) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * (DISH_R - 6)
    const x = Math.cos(a) * d, y = Math.sin(a) * d
    if (out.some((c) => Math.hypot(c.x - x, c.y - y) < 7)) continue
    out.push({
      id: `c${seed.toString(36)}${out.length}`,
      species: pick(r, cfg.pool),
      x, y,
      lagScale: 0.75 + r() * 0.6,
      muScale: 0.85 + r() * 0.3,
      seed: Math.floor(r() * 1e9),
    })
  }
  return out
}

type Integrals = { A: Float64Array; B: Float64Array }
const cache = new WeakMap<EnvSample[], Map<string, Integrals>>()

function integralsFor(env: EnvSample[], species: string): Integrals {
  let m = cache.get(env)
  if (!m) { m = new Map(); cache.set(env, m) }
  const k = `${species}:${env.length}`
  let v = m.get(k)
  if (!v) {
    const s = SPECIES_BY_KEY[species]
    v = integrate(env, cardinal(s), s.growth.muOpt.value, s.growth.lagOpt.value)
    m.set(k, v)
  }
  return v
}

/** Unconstrained radius of one colony at hour h. */
export function colonyRadius(env: EnvSample[], c: ColonyTruth, h: number): { r: number; lagEnd: number | null } {
  const I = integralsFor(env, c.species)
  const lagEnd = crossing(env, I.B, c.lagScale)
  if (lagEnd === null || h <= lagEnd) return { r: 0, lagEnd }
  const r = (at(env, I.A, h) - at(env, I.A, lagEnd)) * c.muScale
  return { r, lagEnd }
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** Everything the pipeline would report for one dish at hour h (deterministic). */
export function observeDish(env: EnvSample[], truth: ColonyTruth[], position: number, h: number): DishObs {
  const raw = truth.map((c) => ({ c, ...colonyRadius(env, c, h) }))
  // contact inhibition: colonies stop at the dish wall and meet neighbours halfway
  const radii = raw.map(({ c, r }) => {
    let lim = DISH_R - Math.hypot(c.x, c.y)
    for (const o of raw) {
      if (o.c === c || o.r <= 0) continue
      const d = Math.hypot(o.c.x - c.x, o.c.y - c.y)
      if (r + o.r > d) lim = Math.min(lim, Math.max(d * (r / (r + o.r)), 0.5))
    }
    return Math.max(0, Math.min(r, lim))
  })
  const colonies: ColonyObs[] = []
  let area = 0
  raw.forEach(({ c, lagEnd }, i) => {
    const r = radii[i]
    if (r < DETECT_R) return
    area += Math.PI * r * r
    const s = SPECIES_BY_KEY[c.species]
    const R = rng(c.seed ^ Math.floor(h * 4))
    const noise = 1 + (R() - 0.5) * 0.04
    // simulated identification: morphology matures with size
    const r50 = s.kind === 'yeast' ? 0.8 : 2.2
    const pTrue = clamp01(0.25 + 0.72 / (1 + Math.exp(-(r - r50) / (r50 * 0.35))) + (R() - 0.5) * 0.06)
    const others = s.confusedWith.slice(0, 2)
    const rest = 1 - pTrue
    const guesses = [{ key: c.species, p: pTrue }, ...others.map((k, j) => ({ key: k, p: rest * (j === 0 ? 0.65 : 0.35) }))]
      .sort((a, b) => b.p - a.p)
    const firstSeen = lagEnd === null ? h : lagEnd + DETECT_R / Math.max(1e-6, (r / Math.max(h - lagEnd, 1e-6)))
    colonies.push({
      id: c.id,
      x: c.x, y: c.y,
      r: r * noise,
      guesses,
      firstSeenH: Math.min(h, firstSeen),
      circularity: s.morph.style === 'yeast' ? 0.97 : 0.82 + R() * 0.12,
    })
  })
  return { position, h, colonies, coverage: Math.min(1, area / (Math.PI * DISH_R * DISH_R)) }
}

/** Colony count series for a dish across capture hours. */
export function countSeries(env: EnvSample[], truth: ColonyTruth[], position: number, hours: number[]) {
  return hours.map((h) => ({ h, n: observeDish(env, truth, position, h).colonies.length }))
}
