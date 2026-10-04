/**
 * Procedural plate renderer.
 *
 * Draws what a PC-6 capture of a 90 mm dish looks like, from colony observations (centre, radius, presumptive
 * species). It uses the same zone model as the product renders (hardware/blender/pc_textures.py, v6), driven by
 * the per-species `zones` presets in lib/science/species.ts, and is growth-aware:
 *   • submerged fringe — fine radial hyphae just under the agar, past the visible edge,
 *   • young margin — white, non-sporulating mycelium; a young colony is all margin,
 *   • sporulating body — conidial colour with daily zonation rings and radial furrows, anchored in mm,
 *   • aged centre — darker conidia, raised umbo or folded (cerebriform) centre,
 *   • reverse pigment — diffusible pigment that stains the agar around the colony as it matures,
 *   • aerial mycelium, conidial heads / sporangia and exudate droplets where the species has them.
 * Neighbouring colonies stop at a thin barrier line instead of overlapping. A height field (mm) is shaded with a key
 * light. Channels emulate the ring-light modes: white reflectance, UV-A 365 nm, transillumination, NIR 850 nm.
 * This is a visual simulation — not a photograph.
 */
import { SPECIES_BY_KEY, type Zones } from '../science/species'
import type { Channel } from '../domain/types'
import { fbm, hashStr, hex, smooth, vnoise } from './noise'

export interface PlateColony {
  id: string
  x: number // mm
  y: number
  r: number // mm
  key: string
}

export interface PlateOpts {
  channel?: Channel
  dishMM?: number // visible inner diameter (mm)
  agar?: string
  background?: string
  rim?: boolean
}

/** PDA/SDA: pale straw-amber, translucent (matches the render agar). */
export const AGAR_HEX = '#dbc48c'
const AGAR = hex(AGAR_HEX)
const REF_R = 18 // mm — zone fractions in the presets are for a mature colony of about this radius

export function renderPlate(canvas: HTMLCanvasElement, colonies: PlateColony[], opts: PlateOpts = {}) {
  const W = canvas.width, H = canvas.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const channel = opts.channel ?? 'white'
  const dishMM = opts.dishMM ?? 90
  const S = Math.min(W, H)
  const pxPerMM = (S * 0.94) / dishMM
  const cx = W / 2, cy = H / 2
  const R = (dishMM / 2) * pxPerMM
  const agarR = R * 0.972
  const img = ctx.createImageData(W, H)
  const px = img.data
  const N = W * H
  const height = new Float32Array(N)
  const gloss = new Float32Array(N)
  const soft = new Float32Array(N) // aerial mycelium scatters light: flattens shading
  const col = new Float32Array(N * 3)
  const agar = (opts.agar ? hex(opts.agar) : AGAR).map((v) => v / 255)
  const bg = hex(opts.background ?? (channel === 'uv365' ? '#0b0a14' : channel === 'transillum' ? '#0e0f13' : '#16171b'))

  // --- agar base (wet and glossy, slight thickness variation, meniscus at the wall)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const dx = x - cx, dy = y - cy
      const rr = Math.sqrt(dx * dx + dy * dy)
      if (rr > agarR) continue
      const u = rr / agarR
      const n = fbm(x / pxPerMM / 9, y / pxPerMM / 9, 3, 3)
      const men = smooth(0.88, 1.0, u) ** 2
      const k = (0.95 + 0.07 * n) * (1 - 0.12 * men)
      col[i * 3] = agar[0] * k
      col[i * 3 + 1] = agar[1] * k
      col[i * 3 + 2] = agar[2] * k
      height[i] = 0.9 * men
      gloss[i] = 0.8
    }
  }

  const k: Ctx = { W, H, cx, cy, pxPerMM, agarR, col, height, gloss, soft }
  const cols = colonies.map((c) => prepare(c, k)).filter((c): c is Prep => c !== null)

  // --- pass 1: ownership. Each pixel belongs to the colony with the smallest normalised radius u.
  const best = new Float32Array(N).fill(9), second = new Float32Array(N).fill(9)
  const owner = new Int16Array(N).fill(-1)
  cols.forEach((c, ci) => {
    for (let y = c.y0; y <= c.y1; y++) {
      for (let x = c.x0; x <= c.x1; x++) {
        const u = c.u[(y - c.y0) * c.bw + (x - c.x0)]
        const i = y * W + x
        if (u < best[i]) { second[i] = best[i]; best[i] = u; owner[i] = ci } else if (u < second[i]) second[i] = u
      }
    }
  })

  // --- diffusible pigments stain the agar first (seen through the translucent medium)
  for (const c of cols) stain(c, k)
  // --- pass 2: build each colony where it owns the agar
  cols.forEach((c, ci) => drawColony(c, ci, k, owner, best, second))
  for (const c of cols) drawDrops(c, k, owner, cols.indexOf(c))

  // --- shading + channel mapping
  const L = normalize3([-0.55, -0.65, 0.85])
  const Hh = normalize3([L[0], L[1], L[2] + 1])
  const slope = pxPerMM / 2 * 1.4 // mm-space gradient, mild exaggeration
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 4
      const dx = x - cx, dy = y - cy
      const rr = Math.sqrt(dx * dx + dy * dy)
      if (rr > agarR) {
        // dish wall + background
        const wall = smooth(agarR, agarR + 2, rr) * (1 - smooth(R, R + 3, rr))
        const base = channel === 'transillum' ? 0.35 : 0.7
        px[o] = bg[0] + (base * 255 - bg[0]) * wall * 0.5
        px[o + 1] = bg[1] + (base * 255 - bg[1]) * wall * 0.5
        px[o + 2] = bg[2] + (base * 255 - bg[2]) * wall * 0.55
        px[o + 3] = 255
        continue
      }
      const h = height[i]
      const hx = ((x < W - 1 ? height[i + 1] : h) - (x > 0 ? height[i - 1] : h)) * slope
      const hy = ((y < H - 1 ? height[i + W] : h) - (y > 0 ? height[i - W] : h)) * slope
      const nrm = normalize3([-hx, -hy, 1])
      const lam = Math.max(0, nrm[0] * L[0] + nrm[1] * L[1] + nrm[2] * L[2])
      const shade = (0.62 + 0.5 * lam) * (1 - soft[i]) + 1.02 * soft[i]
      const spec = gloss[i] * Math.pow(Math.max(0, nrm[0] * Hh[0] + nrm[1] * Hh[1] + nrm[2] * Hh[2]), 60) * (h > 0.05 ? 0.55 : 0)
      let r = col[i * 3], g = col[i * 3 + 1], b = col[i * 3 + 2]
      const thick = h - 0.9 * smooth(0.88, 1.0, rr / agarR) ** 2 // colony thickness above the agar
      if (channel === 'white') {
        r = r * shade + spec; g = g * shade + spec; b = b * shade + spec
      } else if (channel === 'transillum') {
        // backlight: agar glows (tinted by any pigment), colonies attenuate by thickness; young margins stay translucent
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        const att = Math.exp(-Math.max(0, thick) * 2.4) * (0.55 + 0.45 * lum)
        const glow = 0.92
        r = glow * att * Math.min(1.1, col[i * 3] / agar[0] * 0.3 + 0.7)
        g = glow * att * 0.97 * Math.min(1.1, col[i * 3 + 1] / agar[1] * 0.3 + 0.7)
        b = glow * att * 0.9 * Math.min(1.1, col[i * 3 + 2] / agar[2] * 0.3 + 0.7)
      } else if (channel === 'uv365') {
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        const f = thick > 0.02 ? 0.25 + 0.55 * (1 - lum) * 0.3 + 0.35 * lum : 0.12
        r = f * 0.45 * shade; g = f * 0.42 * shade; b = f * 1.0 * shade
      } else if (channel === 'ir850') {
        const lum = 0.35 * r + 0.45 * g + 0.2 * b
        const v = (0.25 + 0.75 * lum) * (0.55 + 0.6 * lam)
        r = g = b = v
      }
      // glass rim highlight
      const hl = smooth(0.955, 0.99, rr / agarR) * (1 - smooth(0.99, 1.0, rr / agarR)) * smooth(0.2, 1, (-dx - dy) / (rr + 1e-6))
      px[o] = Math.min(255, (r + hl * 0.5) * 255)
      px[o + 1] = Math.min(255, (g + hl * 0.5) * 255)
      px[o + 2] = Math.min(255, (b + hl * 0.55) * 255)
      px[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return { pxPerMM, cx, cy, R }
}

function normalize3(v: number[]) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

const rgb = (c: string) => hex(c).map((v) => v / 255)

/** Periodic 1-D noise around a colony (n lobes) at angle th — no seam at ±π. */
function ringNoise(seed: number, n: number, th: number) {
  const t = ((th / (2 * Math.PI)) % 1 + 1) % 1 * n
  const i = Math.floor(t), f = t - i
  const a = vnoise(i % n, 0, seed), b = vnoise((i + 1) % n, 0, seed)
  const s = f * f * (3 - 2 * f)
  return a + (b - a) * s
}

interface Ctx {
  W: number; H: number; cx: number; cy: number; pxPerMM: number; agarR: number
  col: Float32Array; height: Float32Array; gloss: Float32Array; soft: Float32Array
}

interface Prep {
  c: PlateColony; z: Zones; seed: number
  myc: number[]; spore: number[]; old: number[]; accent: number[]; rev: number[]
  ccx: number; ccy: number; rPx: number
  x0: number; x1: number; y0: number; y1: number; bw: number
  u: Float32Array // normalised radius (lobed margin) over the bbox
  marginMM: number; matureR: number; age: number // 0 fresh … 1 mature (≈REF_R)
}

function prepare(c: PlateColony, k: Ctx): Prep | null {
  const sp = SPECIES_BY_KEY[c.key]
  if (!sp || c.r <= 0) return null
  const m = sp.morph, z = m.zones
  const seed = hashStr(c.id) % 10000
  const rPx = c.r * k.pxPerMM
  const ccx = k.cx + c.x * k.pxPerMM, ccy = k.cy + c.y * k.pxPerMM
  const halo = z.fuzz > 0.5 ? z.fuzzLen * 0.35 : 0
  const pad = rPx * (1.12 + z.fringe * 1.4) + (halo + 0.4) * k.pxPerMM + 2
  const x0 = Math.max(0, Math.floor(ccx - pad)), x1 = Math.min(k.W - 1, Math.ceil(ccx + pad))
  const y0 = Math.max(0, Math.floor(ccy - pad)), y1 = Math.min(k.H - 1, Math.ceil(ccy + pad))
  if (x1 < x0 || y1 < y0) return null
  const bw = x1 - x0 + 1
  const u = new Float32Array(bw * (y1 - y0 + 1))
  const lobed = z.profile !== 'yeast'
  const lobeAmp = (lobed ? 1 : 0.25) * Math.min(1, c.r / 6) // young colonies are round; lobes develop with size
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - ccx, dy = y - ccy
      const th = Math.atan2(dy, dx)
      const wob = (0.05 * (ringNoise(seed, 7, th) - 0.5) + 0.035 * (ringNoise(seed + 1, 19, th) - 0.5)) * lobeAmp
      const nm = fbm(x / k.pxPerMM * 0.16, y / k.pxPerMM * 0.16, seed + 2, 3)
      const edge = Math.max(rPx * (1 + wob + (lobed ? 0.05 : 0.01) * (nm - 0.5) * lobeAmp), 0.6)
      u[(y - y0) * bw + (x - x0)] = Math.sqrt(dx * dx + dy * dy) / edge
    }
  }
  const marginMM = z.margin > 0 ? Math.max(0.9, z.margin * REF_R) : 0
  return {
    c, z, seed, myc: rgb(m.margin), spore: rgb(m.body), old: rgb(m.center), accent: rgb(m.accent), rev: rgb(m.reverse),
    ccx, ccy, rPx, x0, x1, y0, y1, bw, u, marginMM,
    matureR: Math.max(0, c.r - marginMM - 0.6), age: Math.min(1, c.r / REF_R),
  }
}

function stain(p: Prep, k: Ctx) {
  if (!p.z.pigment) return
  const [s0, spread] = p.z.pigment
  const s = s0 * smooth(2.5, 12, p.c.r) // pigment builds up as the colony matures
  if (s < 0.005) return
  const reach = (p.c.r * 0.6 + spread * 3.5) * k.pxPerMM
  const x0 = Math.max(0, Math.floor(p.ccx - reach)), x1 = Math.min(k.W - 1, Math.ceil(p.ccx + reach))
  const y0 = Math.max(0, Math.floor(p.ccy - reach)), y1 = Math.min(k.H - 1, Math.ceil(p.ccy + reach))
  const r2 = k.agarR * k.agarR
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const gx = x - k.cx, gy = y - k.cy
      if (gx * gx + gy * gy > r2) continue
      const dd = Math.hypot(x - p.ccx, y - p.ccy) / k.pxPerMM
      const nlo = fbm(x / k.pxPerMM / 9, y / k.pxPerMM / 9, 7, 2)
      const t = Math.min(0.85, 1.6 * s * Math.exp(-Math.max(dd - p.c.r * 0.6, 0) / spread) * (0.85 + 0.3 * nlo)) // reads stronger than the render, where it is seen through 4 mm of agar
      if (t < 0.002) continue
      const i = (y * k.W + x) * 3
      k.col[i] += (p.rev[0] - k.col[i]) * t
      k.col[i + 1] += (p.rev[1] - k.col[i + 1]) * t
      k.col[i + 2] += (p.rev[2] - k.col[i + 2]) * t
    }
  }
}

function drawColony(p: Prep, ci: number, k: Ctx, owner: Int16Array, best: Float32Array, second: Float32Array) {
  const { z, seed, c } = p
  const ph = [vnoise(seed, 1) * 6.28, vnoise(seed, 2) * 6.28, vnoise(seed, 3) * 6.28]
  const zonPeriod = 3.0 + vnoise(seed, 4) * 1.4 // mm per growth period
  const [nFur, furDepth] = z.furrows
  const furGate = smooth(3, 8, c.r)
  const wrinkleGate = smooth(4, 10, c.r)
  const r2 = k.agarR * k.agarR
  const edgeSoftPx = Math.max(1, 0.04 * p.rPx)
  const fuzzHalo = z.fuzz > 0.5 ? z.fuzzLen * 0.35 * smooth(1, 6, c.r) : 0 // cottony overhang past the edge (mm)
  const headCell = 0.32 // mm grid for conidial heads / sporangia
  for (let y = p.y0; y <= p.y1; y++) {
    for (let x = p.x0; x <= p.x1; x++) {
      const gx = x - k.cx, gy = y - k.cy
      if (gx * gx + gy * gy > r2) continue
      const i = y * k.W + x
      const u = p.u[(y - p.y0) * p.bw + (x - p.x0)]
      const mine = owner[i] === ci
      if (!mine && u > 1.0) continue
      const dx = x - p.ccx, dy = y - p.ccy
      const dPx = Math.sqrt(dx * dx + dy * dy)
      const dMM = dPx / k.pxPerMM
      const th = Math.atan2(dy, dx)
      const mmx = x / k.pxPerMM, mmy = y / k.pxPerMM
      const edgePx = dPx / Math.max(u, 1e-6)

      // coverage: soft edge in px; a thin barrier line where two colonies meet
      const barrier = second[i] < 1.05 ? smooth(0.0, 0.05, second[i] - best[i]) : 1
      const cov = mine ? (1 - smooth(edgePx - edgeSoftPx, edgePx + 0.5, dPx)) * barrier : 0
      const nm = fbm(mmx * 0.16, mmy * 0.16, seed + 2, 3)

      // submerged fringe: fine radial hyphae just past the edge, faint and flat
      if (z.fringe && mine && u > 0.94) {
        const streak = ringNoise(seed + 5, 1400, th) * 0.5 + ringNoise(seed + 6, 500, th) * 0.5
        const reach = 1 + z.fringe * (0.4 + 0.9 * nm) * (0.5 + ringNoise(seed + 7, 23, th)) * Math.min(1, c.r / 4)
        const fr = smooth(0.45, 0.8, streak) * (1 - smooth(0.97, reach, u)) * (1 - cov)
        if (fr > 0) {
          const t = 0.22 * fr
          k.col[i * 3] += (p.myc[0] - k.col[i * 3]) * t
          k.col[i * 3 + 1] += (p.myc[1] - k.col[i * 3 + 1]) * t
          k.col[i * 3 + 2] += (p.myc[2] - k.col[i * 3 + 2]) * t
          k.height[i] = Math.max(k.height[i], 0.02 * fr)
        }
      }

      // aerial overhang (floccose / cottony species): wisps reach out past the colony edge
      if (fuzzHalo > 0 && mine && u >= 0.9 && cov < 1) {
        const out = (dPx - edgePx) / k.pxPerMM
        const fib = smooth(0.35, 0.75, vnoise(th * c.r * 2.2, dMM * 0.9, seed + 8))
        const w = (1 - smooth(-0.2, fuzzHalo * (0.5 + 0.7 * nm), out)) * (0.35 + 0.65 * fib) * z.fuzz * 0.55 * (1 - cov)
        if (w > 0) {
          k.col[i * 3] += (p.myc[0] - k.col[i * 3]) * w
          k.col[i * 3 + 1] += (p.myc[1] - k.col[i * 3 + 1]) * w
          k.col[i * 3 + 2] += (p.myc[2] - k.col[i * 3 + 2]) * w
          k.soft[i] = Math.max(k.soft[i], 0.6 * w)
          k.gloss[i] *= 1 - w
        }
      }
      if (cov <= 0) continue
      const uc = Math.min(1, u)

      // zones: sporulating body behind the white margin (absolute mm, so young colonies stay white)
      let spor = z.margin > 0 ? (p.matureR > 0 ? 1 - smooth(p.matureR - 1.0, p.matureR + 0.4, dMM) : 0) : 1
      if (z.zon) spor *= 1 - z.zon * (0.5 + 0.5 * Math.sin((dMM / zonPeriod) * 2 * Math.PI + ph[0] + 2.5 * (nm - 0.5)))
      const nx = fbm(mmx * 2.3, mmy * 2.3, seed + 11, 2) // conidial grain (~0.4 mm)
      const nh = fbm(mmx * 0.7, mmy * 0.7, seed + 9, 3) // ~1.4 mm features
      if (z.gran) spor *= 1 - 0.28 * z.gran * (1 - smooth(0.30, 0.62, nx * 0.75 + nh * 0.25))
      spor = Math.max(0, spor)
      // aged centre: older conidia darken/smoke toward the inoculation point
      const tcen = (1 - smooth(0, Math.max(p.matureR * 0.55, 0.5), dMM)) * smooth(2, 8, c.r)
      let r = p.spore[0] + (p.old[0] - p.spore[0]) * tcen
      let g = p.spore[1] + (p.old[1] - p.spore[1]) * tcen
      let b = p.spore[2] + (p.old[2] - p.spore[2]) * tcen
      r = p.myc[0] * (1 - spor) + r * spor
      g = p.myc[1] * (1 - spor) + g * spor
      b = p.myc[2] * (1 - spor) + b * spor

      // height profile (mm), scaled down while the colony is young and thin
      const prof = z.profile === 'plateau' ? smooth(1.0, 0.82, u) * (0.85 + 0.15 * (1 - uc * uc))
        : z.profile === 'dome' ? Math.sqrt(Math.max(0, 1 - uc * uc))
        : z.profile === 'umbo' ? smooth(1.0, 0.8, u) * (0.75 + 0.25 * (1 - uc * uc)) + 0.35 * (1 - smooth(0, 0.22, u))
        : Math.sqrt(Math.max(0, 1 - uc ** 4))
      let h = z.h0 * prof * (z.profile === 'yeast' ? Math.min(1, 0.45 + c.r / 3) : 0.35 + 0.65 * smooth(0.5, 8, c.r))
      if (nFur && furGate > 0) {
        let fur = Math.abs(Math.sin((th * nFur) / 2 + 3.0 * (nm - 0.5) + ph[1]))
        fur = smooth(0.75, 1.0, fur) * smooth(0.1, 0.35, u) * (1 - smooth(0.7, 0.9, u)) * furGate
        r *= 1 - 0.1 * fur; g *= 1 - 0.1 * fur; b *= 1 - 0.1 * fur
        h -= furDepth * fur
      }
      if (z.wrinkle && wrinkleGate > 0) {
        const ridge = 1 - Math.abs(2 * nh - 1)
        const cen = (1 - smooth(0.2, 0.5, u)) * wrinkleGate
        h += z.wrinkle * cen * smooth(0.55, 0.9, ridge)
        const v = 1 - cen + cen * (0.88 + 0.18 * ridge)
        r *= v; g *= v; b *= v
      }
      if (z.gran) h += 0.12 * z.gran * smooth(0.45, 0.75, nx) * spor
      const grain = 0.93 + 0.12 * nx
      r *= grain; g *= grain; b *= grain

      // aerial mycelium: soft white wisps over the colony; hides sporulation where it's dense
      let fz = 0
      if (z.fuzz) {
        fz = z.fuzz * (0.55 + 0.45 * smooth(0.3, 0.7, nm)) * (1 - 0.6 * spor * (z.margin < 0.3 ? 1 : 0))
        const fib = smooth(0.3, 0.8, vnoise(th * c.r * 2.2, dMM * 0.9, seed + 8)) * 0.5 + fbm(mmx * 9, mmy * 9, seed + 12, 2) * 0.5
        const w = Math.min(0.85, fz * (0.25 + 0.5 * fib) * Math.min(1, z.fuzzLen / 1.5 + 0.3))
        r += (p.myc[0] * 1.03 - r) * w; g += (p.myc[1] * 1.03 - g) * w; b += (p.myc[2] * 1.03 - b) * w
        h += z.fuzzLen * 0.12 * fz * (0.35 + 0.65 * (1 - uc)) * fib
      }
      // conidial heads / sporangia: dark dots on stalks, sparse at the margin
      if (z.heads && spor > 0.05) {
        const gxh = Math.floor(mmx / headCell), gyh = Math.floor(mmy / headCell)
        const jx = vnoise(gxh * 7.1, gyh * 3.3, seed + 20), jy = vnoise(gxh * 2.9, gyh * 8.7, seed + 21)
        const pres = vnoise(gxh * 5.3, gyh * 1.7, seed + 22)
        if (pres < z.heads * Math.min(1, spor) * 0.75) {
          const ddx = mmx - (gxh + 0.2 + 0.6 * jx) * headCell, ddy = mmy - (gyh + 0.2 + 0.6 * jy) * headCell
          const dot = 1 - smooth(0.06, 0.13, Math.sqrt(ddx * ddx + ddy * ddy))
          const a = dot * 0.85 * Math.min(1, c.r / 3)
          r += (p.accent[0] - r) * a; g += (p.accent[1] - g) * a; b += (p.accent[2] - b) * a
          h += 0.15 * dot
        }
      }

      k.col[i * 3] = k.col[i * 3] * (1 - cov) + r * cov
      k.col[i * 3 + 1] = k.col[i * 3 + 1] * (1 - cov) + g * cov
      k.col[i * 3 + 2] = k.col[i * 3 + 2] * (1 - cov) + b * cov
      k.height[i] = Math.max(k.height[i], h * cov)
      k.gloss[i] = k.gloss[i] * (1 - cov) + z.gloss * cov
      k.soft[i] = Math.max(k.soft[i], Math.min(0.6, fz * 0.5) * cov)
    }
  }
}

/** Exudate droplets on a mature colony (e.g. the yellow drops on P. chrysogenum): small glossy domes. */
function drawDrops(p: Prep, k: Ctx, owner: Int16Array, ci: number) {
  const n = Math.round(p.z.drops * smooth(8, 18, p.c.r))
  for (let j = 0; j < n; j++) {
    const a = vnoise(j, 1, p.seed + 30) * 2 * Math.PI
    const rr = p.c.r * (0.22 + 0.45 * vnoise(j, 2, p.seed + 30))
    const rd = (0.18 + 0.4 * vnoise(j, 3, p.seed + 30)) * Math.sqrt(p.c.r / 20) // mm
    const dx0 = p.ccx + Math.cos(a) * rr * k.pxPerMM, dy0 = p.ccy + Math.sin(a) * rr * k.pxPerMM
    const rp = rd * k.pxPerMM
    for (let y = Math.max(0, Math.floor(dy0 - rp - 1)); y <= Math.min(k.H - 1, Math.ceil(dy0 + rp + 1)); y++) {
      for (let x = Math.max(0, Math.floor(dx0 - rp - 1)); x <= Math.min(k.W - 1, Math.ceil(dx0 + rp + 1)); x++) {
        const i = y * k.W + x
        if (owner[i] !== ci) continue
        const d = Math.hypot(x - dx0, y - dy0) / Math.max(rp, 0.5)
        const cov = 1 - smooth(0.85, 1.05, d)
        if (cov <= 0) continue
        const t = cov * 0.75
        k.col[i * 3] += (p.accent[0] - k.col[i * 3]) * t
        k.col[i * 3 + 1] += (p.accent[1] - k.col[i * 3 + 1]) * t
        k.col[i * 3 + 2] += (p.accent[2] - k.col[i * 3 + 2]) * t
        k.height[i] += rd * 0.6 * Math.sqrt(Math.max(0, 1 - d * d)) * cov
        k.gloss[i] = Math.max(k.gloss[i], cov)
        k.soft[i] *= 1 - cov
      }
    }
  }
}
