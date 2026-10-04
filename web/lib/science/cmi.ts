/**
 * Cardinal Model with Inflection (CMI) — Rosso, Lobry & Flandrois (1993), J. Theor. Biol. 162:447–463.
 * Used for fungal radial growth by e.g. Gougouli & Koutsoumanis (2010), Int. J. Food Microbiol. 140:254–262.
 *
 *            (T − Tmax)(T − Tmin)²
 * μ(T) = μopt · ───────────────────────────────────────────────────────────────
 *            (Topt − Tmin)[(Topt − Tmin)(T − Topt) − (Topt − Tmax)(Topt + Tmin − 2T)]
 *
 * for Tmin < T < Tmax, and 0 outside.
 */
export interface Cardinal {
  Tmin: number
  Topt: number
  Tmax: number
}

export function cmiFactor(T: number, c: Cardinal): number {
  const { Tmin, Topt, Tmax } = c
  if (T <= Tmin || T >= Tmax) return 0
  const num = (T - Tmax) * (T - Tmin) ** 2
  const den = (Topt - Tmin) * ((Topt - Tmin) * (T - Topt) - (Topt - Tmax) * (Topt + Tmin - 2 * T))
  const f = num / den
  return Number.isFinite(f) && f > 0 ? f : 0
}

/** radial growth rate, mm/h */
export function mu(T: number, c: Cardinal, muOpt: number): number {
  return muOpt * cmiFactor(T, c)
}

/**
 * Lag. Gougouli & Koutsoumanis (2010) report that cardinal values for 1/λ were very close to those for μ,
 * so we model 1/λ(T) = (1/λopt) · CMI(T). Prediction under changing temperature uses their cumulative-lag
 * approach: lag ends when ∫ dt / λ(T(t)) reaches 1, after which growth adopts μ(T) instantaneously.
 */
export function inverseLag(T: number, c: Cardinal, lagOptH: number): number {
  return cmiFactor(T, c) / lagOptH
}

export interface EnvSample {
  h: number // hours since run start
  T: number // °C
  RH: number // %
}

/** Cumulative integrals of growth (mm) and lag progress for a species over an environment log. */
export function integrate(env: EnvSample[], c: Cardinal, muOpt: number, lagOptH: number) {
  const A = new Float64Array(env.length) // ∫ μ dt  (mm)
  const B = new Float64Array(env.length) // ∫ 1/λ dt (–)
  for (let i = 1; i < env.length; i++) {
    const dt = env[i].h - env[i - 1].h
    const Tm = (env[i].T + env[i - 1].T) / 2
    A[i] = A[i - 1] + mu(Tm, c, muOpt) * dt
    B[i] = B[i - 1] + inverseLag(Tm, c, lagOptH) * dt
  }
  return { A, B }
}

/** Interpolate a cumulative series at hour h. */
export function at(env: EnvSample[], series: Float64Array, h: number): number {
  if (env.length === 0) return 0
  if (h <= env[0].h) return series[0]
  const last = env.length - 1
  if (h >= env[last].h) return series[last]
  let lo = 0, hi = last
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if (env[m].h <= h) lo = m
    else hi = m
  }
  const t = (h - env[lo].h) / (env[hi].h - env[lo].h)
  return series[lo] + (series[hi] - series[lo]) * t
}

/** First hour at which a cumulative series reaches `target` (or null). */
export function crossing(env: EnvSample[], series: Float64Array, target: number): number | null {
  for (let i = 1; i < env.length; i++) {
    if (series[i] >= target) {
      const t = (target - series[i - 1]) / Math.max(series[i] - series[i - 1], 1e-12)
      return env[i - 1].h + t * (env[i].h - env[i - 1].h)
    }
  }
  return null
}
