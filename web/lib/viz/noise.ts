/** Small deterministic value-noise + fbm, fast enough for per-pixel colony shading in the browser. */
function h2(x: number, y: number, s: number) {
  let n = (x * 374761393 + y * 668265263 + s * 144665) | 0
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

export function vnoise(x: number, y: number, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y)
  let xf = x - xi, yf = y - yi
  xf = xf * xf * (3 - 2 * xf)
  yf = yf * yf * (3 - 2 * yf)
  const a = h2(xi, yi, seed), b = h2(xi + 1, yi, seed), c = h2(xi, yi + 1, seed), d = h2(xi + 1, yi + 1, seed)
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
}

export function fbm(x: number, y: number, seed = 0, oct = 4) {
  let v = 0, amp = 0.5, f = 1, tot = 0
  for (let i = 0; i < oct; i++) {
    v += vnoise(x * f, y * f, seed + i * 17) * amp
    tot += amp
    amp *= 0.5
    f *= 2.03
  }
  return v / tot
}

export function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

export function hashStr(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
