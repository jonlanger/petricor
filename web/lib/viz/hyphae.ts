/**
 * Stochastic 2D hyphal network model for teaching and exploration.
 *
 * Inspired by the Neighbour-Sensing concept (Meškauskas, Fricker & Moore 2004): every hypha emits a field that
 * decays with distance; tips read the local field and its gradient to decide direction (negative autotropism
 * — growing away from existing mycelium) and whether to branch. Branching is sub-apical once a tip has grown
 * one internode since its last branch, echoing the hyphal growth unit (HGU = total length / tips) of Trinci (1974).
 * Units are micrometres and minutes. Parameters are illustrative, not fitted to any strain.
 */
export interface HyphaParams {
  speed: number // tip extension, µm/min
  internode: number // µm between successive branches on a hypha
  branchDeg: number // mean branch angle
  autotropism: number // 0..1 strength of turning away from denser mycelium
  persistence: number // 0..1 directional memory
  wiggle: number // random turning, rad/√min
  saturation: number // local density at which tips stop
  anastomosis: boolean
  germTubes: number
}

export interface Tip { x: number; y: number; a: number; since: number; alive: boolean; gen: number; born: number }
export interface Segment { x0: number; y0: number; x1: number; y1: number; t: number; gen: number }

export const DEFAULTS: HyphaParams = { speed: 3, internode: 60, branchDeg: 45, autotropism: 0.6, persistence: 0.85, wiggle: 0.12, saturation: 2.2, anastomosis: true, germTubes: 2 }

export class Mycelium {
  p: HyphaParams
  tips: Tip[] = []
  t = 0 // minutes
  length = 0 // µm
  branches = 0
  fusions: { x: number; y: number; t: number }[] = []
  newSegs: Segment[] = []
  history: { t: number; tips: number; length: number; radius: number }[] = []
  radius = 0
  readonly R: number // domain radius (µm)
  private G: number // grid cells per side
  private cell: number
  private field: Float32Array
  private rnd: () => number

  constructor(p: HyphaParams, R = 1200, seed = 7) {
    this.p = p
    this.R = R
    this.cell = 8
    this.G = Math.ceil((2 * R) / this.cell)
    this.field = new Float32Array(this.G * this.G)
    let s = seed >>> 0 || 1
    this.rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296 }
    const n = Math.max(1, p.germTubes)
    const a0 = this.rnd() * Math.PI * 2
    for (let i = 0; i < n; i++) this.tips.push({ x: 0, y: 0, a: a0 + (i * 2 * Math.PI) / n + (this.rnd() - 0.5) * 0.6, since: 0, alive: true, gen: 0, born: 0 })
  }

  private gauss() { return Math.sqrt(-2 * Math.log(this.rnd() + 1e-9)) * Math.cos(2 * Math.PI * this.rnd()) }

  private idx(x: number, y: number) {
    const gx = Math.floor((x + this.R) / this.cell), gy = Math.floor((y + this.R) / this.cell)
    if (gx < 0 || gy < 0 || gx >= this.G || gy >= this.G) return -1
    return gy * this.G + gx
  }

  /** bilinear field sample (smooth gradients avoid grid-aligned growth artefacts) */
  sample(x: number, y: number) {
    const fx = (x + this.R) / this.cell - 0.5, fy = (y + this.R) / this.cell - 0.5
    const x0 = Math.floor(fx), y0 = Math.floor(fy)
    const tx = fx - x0, ty = fy - y0
    const G = this.G
    const at = (i: number, j: number) => (i < 0 || j < 0 || i >= G || j >= G ? 0 : this.field[j * G + i])
    return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty
  }

  private deposit(x: number, y: number, amt: number) {
    const fx = (x + this.R) / this.cell - 0.5, fy = (y + this.R) / this.cell - 0.5
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, G = this.G
    const add = (i: number, j: number, w: number) => { if (i >= 0 && j >= 0 && i < G && j < G) this.field[j * G + i] += amt * w }
    add(x0, y0, (1 - tx) * (1 - ty)); add(x0 + 1, y0, tx * (1 - ty)); add(x0, y0 + 1, (1 - tx) * ty); add(x0 + 1, y0 + 1, tx * ty)
  }

  /** Trinci's hyphal growth unit: total hyphal length divided by the number of tips the mycelium has produced. */
  get hgu() { return this.length / Math.max(1, this.p.germTubes + this.branches) }

  step(dt: number) {
    const p = this.p
    this.newSegs = []
    const born: Tip[] = []
    const maxTips = 3500
    for (const tip of this.tips) {
      if (!tip.alive) continue
      // neighbour sensing: gradient of the field around the tip
      const e = 12
      const gx = this.sample(tip.x + e, tip.y) - this.sample(tip.x - e, tip.y)
      const gy = this.sample(tip.x, tip.y + e) - this.sample(tip.x, tip.y - e)
      // leading hyphae at the colony edge keep heading outward (the field is weakest there)
      const rOut = Math.hypot(tip.x, tip.y)
      if (rOut > 20) {
        let d0 = Math.atan2(tip.y, tip.x) - tip.a
        d0 = Math.atan2(Math.sin(d0), Math.cos(d0))
        tip.a += d0 * 0.02 * dt * p.autotropism
      }
      const here = this.sample(tip.x, tip.y)
      let a = tip.a
      if (gx || gy) {
        const away = Math.atan2(-gy, -gx)
        let d = away - a
        d = Math.atan2(Math.sin(d), Math.cos(d))
        a += d * p.autotropism * Math.min(1, Math.hypot(gx, gy) * 2) * (1 - p.persistence) * 3
      }
      a += this.gauss() * p.wiggle * Math.sqrt(dt)
      const L = p.speed * dt * (0.8 + 0.4 * this.rnd())
      const nx = tip.x + Math.cos(a) * L, ny = tip.y + Math.sin(a) * L
      // stop at the domain edge or in saturated mycelium
      if (Math.hypot(nx, ny) > this.R * 0.98 || here > p.saturation) { tip.alive = false; continue }
      // anastomosis: tip meets an existing hypha that is not its own trail
      const ahead = this.sample(nx + Math.cos(a) * 6, ny + Math.sin(a) * 6)
      if (p.anastomosis && tip.since > 25 && ahead > 1.1 && this.rnd() < 0.35) {
        this.fusions.push({ x: nx, y: ny, t: this.t })
        this.newSegs.push({ x0: tip.x, y0: tip.y, x1: nx, y1: ny, t: this.t, gen: tip.gen })
        tip.alive = false
        continue
      }
      this.newSegs.push({ x0: tip.x, y0: tip.y, x1: nx, y1: ny, t: this.t, gen: tip.gen })
      const steps = Math.max(1, Math.ceil(L / (this.cell * 0.7)))
      for (let k = 1; k <= steps; k++) this.deposit(tip.x + ((nx - tip.x) * k) / steps, tip.y + ((ny - tip.y) * k) / steps, (0.3 / steps) * (L / this.cell))
      tip.x = nx; tip.y = ny; tip.a = a
      tip.since += L
      this.length += L
      this.radius = Math.max(this.radius, Math.hypot(nx, ny))
      // sub-apical branching after one internode, suppressed where mycelium is dense
      if (tip.since > p.internode * (0.7 + 0.6 * this.rnd()) && here < p.saturation * 0.35 && this.rnd() < 0.8 && this.tips.length + born.length < maxTips) {
        const side = this.rnd() < 0.5 ? -1 : 1
        const ba = a + side * (p.branchDeg * Math.PI / 180) * (0.75 + 0.5 * this.rnd())
        born.push({ x: tip.x - Math.cos(a) * 4, y: tip.y - Math.sin(a) * 4, a: ba, since: 0, alive: true, gen: tip.gen + 1, born: this.t })
        tip.since = 0
        this.branches++
      }
    }
    this.tips.push(...born)
    if (this.tips.length > 2 * maxTips) this.tips = this.tips.filter((t) => t.alive)
    this.t += dt
    const alive = this.tips.reduce((n, t) => n + (t.alive ? 1 : 0), 0)
    if (!this.history.length || this.t - this.history[this.history.length - 1].t >= 5) this.history.push({ t: this.t, tips: alive, length: this.length, radius: this.radius })
    return alive
  }

  get aliveTips() { return this.tips.filter((t) => t.alive) }
}
