/**
 * Stochastic 3D hyphal network: the 2D neighbour-sensing model (hyphae.ts) extended into a 3D density field.
 *
 * Substrate hyphae grow over the agar surface (z ≈ 0) exactly as in 2D — tips read the field gradient and turn away
 * from existing mycelium (negative autotropism), keep heading outward at the colony edge, branch sub-apically once per
 * internode and stop where the field saturates. Behind the advancing margin, some branches leave the surface as
 * aerial hyphae: they rise with a weak negative gravitropism, wander, avoid one another in 3D, branch less often and
 * droop as they lengthen — which is what builds the cottony dome of a real colony. Units are µm and minutes, +z up.
 * Parameters are illustrative, not fitted to any strain.
 */
import type { HyphaParams } from './hyphae'

export interface Hypha3Params extends HyphaParams {
  aerial: number // 0..1 propensity of branches to leave the agar
  aerialLen: number // µm, typical aerial hypha length
}

export const DEFAULTS_3D: Hypha3Params = {
  speed: 3, internode: 60, branchDeg: 45, autotropism: 0.6, persistence: 0.85, wiggle: 0.12, saturation: 2.2, anastomosis: true, germTubes: 2,
  aerial: 0.4, aerialLen: 440,
}

interface Tip3 {
  x: number; y: number; z: number
  dx: number; dy: number; dz: number
  since: number; alive: boolean; gen: number; aerial: boolean; len: number; maxLen: number
  ex: number; ey: number; ez: number; elen: number // last emitted vertex, length since
}

/** Flat segment list for the renderer: x0 y0 z0 x1 y1 z1 gen aerial(0|1), 8 floats each. */
export const SEG_STRIDE = 8

export class Mycelium3D {
  p: Hypha3Params
  tips: Tip3[] = []
  t = 0
  length = 0
  branches = 0
  fusions: { x: number; y: number; t: number }[] = []
  history: { t: number; tips: number; length: number; radius: number }[] = []
  radius = 0
  height = 0
  aerialTips = 0
  aerialLength = 0
  /** first time (sim minutes) each growth milestone happened */
  events: { firstBranch: number | null; firstAerial: number | null; firstFusion: number | null; edge: number | null } = { firstBranch: null, firstAerial: null, firstFusion: null, edge: null }
  /** segments produced by the last step(), SEG_STRIDE floats each */
  segs = new Float32Array(SEG_STRIDE * 4096)
  nSegs = 0
  readonly R: number
  readonly Z = 560
  private cell = 16
  private G: number
  private GZ: number
  private z0 = -32
  private field: Float32Array
  // fine surface field for substrate hyphae (same cell and scaling as the 2D model)
  private sc = 8
  private SG: number
  private surf: Float32Array
  private rnd: () => number

  constructor(p: Hypha3Params, R = 1200, seed = 7) {
    this.p = p
    this.R = R
    this.G = Math.ceil((2 * R) / this.cell)
    this.GZ = Math.ceil((this.Z - this.z0) / this.cell) + 1
    this.field = new Float32Array(this.G * this.G * this.GZ)
    this.SG = Math.ceil((2 * R) / this.sc)
    this.surf = new Float32Array(this.SG * this.SG)
    let s = seed >>> 0 || 1
    this.rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296 }
    const n = Math.max(1, p.germTubes)
    const a0 = this.rnd() * Math.PI * 2
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * 2 * Math.PI) / n + (this.rnd() - 0.5) * 0.6
      this.tips.push(this.tip(0, 0, 0, Math.cos(a), Math.sin(a), 0, 0, false))
    }
  }

  private tip(x: number, y: number, z: number, dx: number, dy: number, dz: number, gen: number, aerial: boolean): Tip3 {
    return { x, y, z, dx, dy, dz, since: 0, alive: true, gen, aerial, len: 0, maxLen: aerial ? this.p.aerialLen * (0.45 + 0.9 * this.rnd()) : Infinity, ex: x, ey: y, ez: z, elen: 0 }
  }

  private gauss() { return Math.sqrt(-2 * Math.log(this.rnd() + 1e-9)) * Math.cos(2 * Math.PI * this.rnd()) }

  /** trilinear field sample */
  sample(x: number, y: number, z: number) {
    const c = this.cell, G = this.G, GZ = this.GZ
    const fx = (x + this.R) / c - 0.5, fy = (y + this.R) / c - 0.5, fz = (z - this.z0) / c - 0.5
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz)
    const tx = fx - i, ty = fy - j, tz = fz - k
    const f = this.field
    const at = (a: number, b: number, d: number) => (a < 0 || b < 0 || d < 0 || a >= G || b >= G || d >= GZ ? 0 : f[(d * G + b) * G + a])
    const c00 = at(i, j, k) * (1 - tx) + at(i + 1, j, k) * tx, c10 = at(i, j + 1, k) * (1 - tx) + at(i + 1, j + 1, k) * tx
    const c01 = at(i, j, k + 1) * (1 - tx) + at(i + 1, j, k + 1) * tx, c11 = at(i, j + 1, k + 1) * (1 - tx) + at(i + 1, j + 1, k + 1) * tx
    return (c00 * (1 - ty) + c10 * ty) * (1 - tz) + (c01 * (1 - ty) + c11 * ty) * tz
  }

  /** bilinear sample of the surface field */
  sampleS(x: number, y: number) {
    const fx = (x + this.R) / this.sc - 0.5, fy = (y + this.R) / this.sc - 0.5
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, G = this.SG, f = this.surf
    const at = (i: number, j: number) => (i < 0 || j < 0 || i >= G || j >= G ? 0 : f[j * G + i])
    return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty
  }

  private depositS(x: number, y: number, amt: number) {
    const fx = (x + this.R) / this.sc - 0.5, fy = (y + this.R) / this.sc - 0.5
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, G = this.SG
    const add = (i: number, j: number, w: number) => { if (i >= 0 && j >= 0 && i < G && j < G) this.surf[j * G + i] += amt * w }
    add(x0, y0, (1 - tx) * (1 - ty)); add(x0 + 1, y0, tx * (1 - ty)); add(x0, y0 + 1, (1 - tx) * ty); add(x0 + 1, y0 + 1, tx * ty)
  }

  private deposit(x: number, y: number, z: number, amt: number) {
    const c = this.cell, G = this.G, GZ = this.GZ
    const fx = (x + this.R) / c - 0.5, fy = (y + this.R) / c - 0.5, fz = (z - this.z0) / c - 0.5
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz)
    const tx = fx - i, ty = fy - j, tz = fz - k
    for (let dk = 0; dk < 2; dk++) for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
      const a = i + di, b = j + dj, d = k + dk
      if (a < 0 || b < 0 || d < 0 || a >= G || b >= G || d >= GZ) continue
      this.field[(d * G + b) * G + a] += amt * (di ? tx : 1 - tx) * (dj ? ty : 1 - ty) * (dk ? tz : 1 - tz)
    }
  }

  get hgu() { return this.length / Math.max(1, this.p.germTubes + this.branches) }

  /** Coalesce a hypha's steps into ~10 µm render segments; force at branch points and when the tip stops. */
  private emit(t: Tip3, x1: number, y1: number, z1: number, L: number, force = false) {
    t.elen += L
    if (!force && t.elen < 10) return
    t.elen = 0
    if ((this.nSegs + 1) * SEG_STRIDE > this.segs.length) {
      const n = new Float32Array(this.segs.length * 2); n.set(this.segs); this.segs = n
    }
    const o = this.nSegs++ * SEG_STRIDE, s = this.segs
    s[o] = t.ex; s[o + 1] = t.ey; s[o + 2] = t.ez; s[o + 3] = x1; s[o + 4] = y1; s[o + 5] = z1; s[o + 6] = t.gen; s[o + 7] = t.aerial ? 1 : 0
    t.ex = x1; t.ey = y1; t.ez = z1
  }

  step(dt: number) {
    const p = this.p
    this.nSegs = 0
    const born: Tip3[] = []
    const maxTips = 3500, maxAerial = 2600
    const aerialOn = Math.min(1, Math.max(0, (this.t - 90) / 240)) // aerial mycelium develops behind a young colony
    const e = 20
    for (const tip of this.tips) {
      if (!tip.alive) continue
      if (!tip.aerial) {
        // --- substrate hypha: the 2D model on the agar surface, on its own fine field
        const here = this.sampleS(tip.x, tip.y)
        const es = 12
        const gx = this.sampleS(tip.x + es, tip.y) - this.sampleS(tip.x - es, tip.y)
        const gy = this.sampleS(tip.x, tip.y + es) - this.sampleS(tip.x, tip.y - es)
        let a = Math.atan2(tip.dy, tip.dx)
        const rOut = Math.hypot(tip.x, tip.y)
        if (rOut > 20) {
          let d0 = Math.atan2(tip.y, tip.x) - a
          d0 = Math.atan2(Math.sin(d0), Math.cos(d0))
          a += d0 * 0.02 * dt * p.autotropism
        }
        if (gx || gy) {
          let d = Math.atan2(-gy, -gx) - a
          d = Math.atan2(Math.sin(d), Math.cos(d))
          a += d * p.autotropism * Math.min(1, Math.hypot(gx, gy) * 2) * (1 - p.persistence) * 3
        }
        a += this.gauss() * p.wiggle * Math.sqrt(dt)
        const L = p.speed * dt * (0.8 + 0.4 * this.rnd())
        const nx = tip.x + Math.cos(a) * L, ny = tip.y + Math.sin(a) * L
        const nz = Math.max(-10, Math.min(3, tip.z + this.gauss() * 0.5)) // hugs the surface, dipping just under it
        if (Math.hypot(nx, ny) > this.R * 0.98 || here > p.saturation) { tip.alive = false; this.emit(tip, tip.x, tip.y, tip.z, 0, true); continue }
        const ahead = this.sampleS(nx + Math.cos(a) * 6, ny + Math.sin(a) * 6)
        if (p.anastomosis && tip.since > 30 && ahead > 1.1 && this.rnd() < 0.35) {
          this.fusions.push({ x: nx, y: ny, t: this.t })
          this.events.firstFusion ??= this.t
          this.emit(tip, nx, ny, nz, L, true)
          tip.alive = false
          continue
        }
        this.emit(tip, nx, ny, nz, L)
        this.lay(tip.x, tip.y, tip.z, nx, ny, nz, L)
        const ss = Math.max(1, Math.ceil(L / (this.sc * 0.7)))
        for (let k = 1; k <= ss; k++) this.depositS(tip.x + ((nx - tip.x) * k) / ss, tip.y + ((ny - tip.y) * k) / ss, (0.3 / ss) * (L / this.sc))
        tip.x = nx; tip.y = ny; tip.z = nz; tip.dx = Math.cos(a); tip.dy = Math.sin(a); tip.dz = 0
        tip.since += L
        this.radius = Math.max(this.radius, Math.hypot(nx, ny))
        if (tip.since > p.internode * (0.7 + 0.6 * this.rnd()) && here < p.saturation * 0.35 && this.rnd() < 0.8) {
          this.emit(tip, nx, ny, nz, 0, true) // vertex at the branch point
          const side = this.rnd() < 0.5 ? -1 : 1
          const ba = a + side * (p.branchDeg * Math.PI / 180) * (0.75 + 0.5 * this.rnd())
          const goAerial = rOut > 60 && this.rnd() < p.aerial * 0.28 * aerialOn && this.aerialTips + born.length < maxAerial && this.aerialLength < 2.2e6 * p.aerial
          this.events.firstBranch ??= this.t
          if (goAerial) {
            this.events.firstAerial ??= this.t
            // leave the agar steeply, roughly along the branch direction
            const el = (40 + 40 * this.rnd()) * Math.PI / 180
            born.push(this.tip(tip.x, tip.y, 1, Math.cos(ba) * Math.cos(el), Math.sin(ba) * Math.cos(el), Math.sin(el), tip.gen + 1, true))
            this.branches++
          } else if (this.tips.length + born.length < maxTips) {
            born.push(this.tip(tip.x - Math.cos(a) * 4, tip.y - Math.sin(a) * 4, 0, Math.cos(ba), Math.sin(ba), 0, tip.gen + 1, false))
            this.branches++
          }
          tip.since = 0
        }
      } else {
        // --- aerial hypha: free 3D growth, rising, self-avoiding, drooping with length
        const here = this.sample(tip.x, tip.y, tip.z)
        const gx = this.sample(tip.x + e, tip.y, tip.z) - this.sample(tip.x - e, tip.y, tip.z)
        const gy = this.sample(tip.x, tip.y + e, tip.z) - this.sample(tip.x, tip.y - e, tip.z)
        const gz = this.sample(tip.x, tip.y, tip.z + e) - this.sample(tip.x, tip.y, tip.z - e)
        const w = p.wiggle * 1.3 * Math.sqrt(dt)
        let dx = tip.dx + this.gauss() * w, dy = tip.dy + this.gauss() * w, dz = tip.dz + this.gauss() * w
        const gm = Math.hypot(gx, gy, gz)
        if (gm > 0) { const k = p.autotropism * Math.min(1, gm * 2) * 0.25 / gm; dx -= gx * k; dy -= gy * k; dz -= gz * k }
        const frac = tip.len / tip.maxLen
        dz += (0.05 * (1 - tip.z / this.Z) - 0.05 * frac * frac) * dt // negative gravitropism, then droop
        const n = Math.hypot(dx, dy, dz) || 1
        dx /= n; dy /= n; dz /= n
        const L = p.speed * 0.7 * dt * (0.8 + 0.4 * this.rnd())
        const nx = tip.x + dx * L, ny = tip.y + dy * L, nz = tip.z + dz * L
        if (tip.len > tip.maxLen || nz > this.Z || (nz < 2 && tip.len > 30) || Math.hypot(nx, ny) > this.R * 0.98 || here > p.saturation * 1.4) { tip.alive = false; this.aerialTips--; this.emit(tip, tip.x, tip.y, tip.z, 0, true); continue }
        this.emit(tip, nx, ny, nz, L)
        this.lay(tip.x, tip.y, tip.z, nx, ny, nz, L)
        this.aerialLength += L
        tip.x = nx; tip.y = ny; tip.z = nz; tip.dx = dx; tip.dy = dy; tip.dz = dz
        tip.since += L; tip.len += L
        this.height = Math.max(this.height, nz)
        if (tip.since > p.internode * 1.6 * (0.7 + 0.6 * this.rnd()) && this.rnd() < 0.45 && this.aerialTips + born.length < maxAerial) {
          this.emit(tip, nx, ny, nz, 0, true)
          // rotate the direction by the branch angle around a random perpendicular
          let px = -dy, py = dx, pz = 0
          if (this.rnd() < 0.5) { px = dx * dz; py = dy * dz; pz = -(dx * dx + dy * dy) }
          const pn = Math.hypot(px, py, pz) || 1
          const ang = (p.branchDeg * Math.PI / 180) * (0.7 + 0.6 * this.rnd()) * (this.rnd() < 0.5 ? -1 : 1)
          const c = Math.cos(ang), s = Math.sin(ang)
          born.push(this.tip(nx, ny, nz, dx * c + (px / pn) * s, dy * c + (py / pn) * s, dz * c + (pz / pn) * s, tip.gen + 1, true))
          this.branches++
          tip.since = 0
        }
      }
    }
    for (const b of born) { this.tips.push(b); if (b.aerial) this.aerialTips++ }
    if (this.tips.length > 2 * (maxTips + maxAerial)) this.tips = this.tips.filter((t) => t.alive)
    if (this.radius > this.R * 0.9) this.events.edge ??= this.t
    this.t += dt
    let alive = 0
    for (const t of this.tips) if (t.alive) alive++
    if (!this.history.length || this.t - this.history[this.history.length - 1].t >= 5) this.history.push({ t: this.t, tips: alive, length: this.length, radius: this.radius })
    return alive
  }

  private lay(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, L: number) {
    const steps = Math.max(1, Math.ceil(L / (this.cell * 0.6)))
    const amt = (0.3 * L) / 32 / steps // ≈ the 2D model's areal density scaling, for a 16 µm cell
    for (let k = 1; k <= steps; k++) this.deposit(x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps, z0 + ((z1 - z0) * k) / steps, amt)
    this.length += L
  }

  get aliveTips() { return this.tips.filter((t) => t.alive) }
}
