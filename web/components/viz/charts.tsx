'use client'
import { useEffect, useMemo, useRef, useState } from 'react'

/** Validated categorical order (dataviz reference palette), fixed per entity — never by rank. */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
export const OTHER = '#9a9da6'

export interface Series {
  key: string
  label: string
  color: string
  points: { x: number; y: number }[]
}

interface LineProps {
  series: Series[]
  height?: number
  yLabel?: string
  xFormat?: (x: number) => string
  yFormat?: (y: number) => string
  yDomain?: [number, number]
  xDomain?: [number, number]
  band?: { from: number; to: number; label?: string } // target band (e.g. setpoint ±)
  marker?: number | null // vertical marker (current frame)
  dark?: boolean
  area?: boolean
  onScrub?: (x: number) => void
}

function ticks(min: number, max: number, n = 4) {
  const span = max - min || 1
  const step0 = span / n
  const mag = 10 ** Math.floor(Math.log10(step0))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n + 0.5) ?? mag * 10
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9 && out.length < 50; v += step) out.push(+v.toFixed(6))
  return [...new Set(out)]
}

export function LineChart({ series, height = 180, yLabel, xFormat = (x) => `${Math.round(x)}h`, yFormat = (y) => `${+y.toFixed(1)}`,
  yDomain, xDomain, band, marker = null, dark = false, area = false, onScrub }: LineProps) {
  const ref = useRef<SVGSVGElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [W, setW] = useState(640)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = height, pl = 40, pr = 12, pt = 10, pb = 22
  const all = series.flatMap((s) => s.points)
  const xs = all.map((p) => p.x)
  const [x0, x1] = xDomain ?? (xs.length ? [Math.min(...xs), Math.max(Math.max(...xs), Math.min(...xs) + 1)] : [0, 1])
  let [y0, y1] = yDomain ?? [Math.min(...all.map((p) => p.y)), Math.max(...all.map((p) => p.y))]
  if (!Number.isFinite(y0)) { y0 = 0; y1 = 1 }
  if (y1 - y0 < 1e-6) { y0 -= 1; y1 += 1 }
  const sx = (x: number) => pl + ((x - x0) / (x1 - x0 || 1)) * (W - pl - pr)
  const sy = (y: number) => pt + (1 - (y - y0) / (y1 - y0)) * (H - pt - pb)
  const yt = useMemo(() => ticks(y0, y1, 4), [y0, y1])
  const xt = useMemo(() => ticks(x0, x1, Math.max(3, Math.min(8, Math.floor(W / 90)))), [x0, x1, W])
  const ink = dark ? 'rgba(255,255,255,0.55)' : '#6b7080'
  const grid = dark ? 'rgba(255,255,255,0.08)' : '#eceef2'
  const surface = dark ? '#1d1f24' : '#ffffff'

  const nearest = (s: Series, x: number) => {
    let best = s.points[0], bd = Infinity
    for (const p of s.points) { const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = p } }
    return best
  }
  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const x = x0 + ((px - pl) / (W - pl - pr)) * (x1 - x0)
    const cx = Math.max(x0, Math.min(x1, x))
    setHover(cx)
    if (e.buttons && onScrub) onScrub(cx)
  }

  return (
    <div ref={box} className="relative w-full select-none">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full touch-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => { onMove(e); if (onScrub && hover !== null) onScrub(hover) }} role="img" aria-label={yLabel}>
        {band && (
          <g>
            <rect x={pl} width={W - pl - pr} y={sy(Math.min(band.to, y1))} height={Math.max(0, sy(Math.max(band.from, y0)) - sy(Math.min(band.to, y1)))} fill={dark ? 'rgba(58,68,255,0.14)' : 'rgba(58,68,255,0.07)'} />
          </g>
        )}
        {yt.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={sy(t)} y2={sy(t)} stroke={grid} strokeWidth={1} />
            <text x={pl - 6} y={sy(t) + 3.5} textAnchor="end" fontSize={10} fill={ink} className="font-mono tabular">{yFormat(t)}</text>
          </g>
        ))}
        {xt.map((t) => (
          <text key={t} x={sx(t)} y={H - 6} textAnchor="middle" fontSize={10} fill={ink} className="font-mono tabular">{xFormat(t)}</text>
        ))}
        {series.map((s) => {
          if (!s.points.length) return null
          const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('')
          const last = s.points[s.points.length - 1]
          return (
            <g key={s.key}>
              {area && <path d={`${d}L${sx(last.x)},${sy(y0)}L${sx(s.points[0].x)},${sy(y0)}Z`} fill={s.color} opacity={0.1} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <circle cx={sx(last.x)} cy={sy(last.y)} r={4} fill={s.color} stroke={surface} strokeWidth={2} />
            </g>
          )
        })}
        {marker !== null && <line x1={sx(marker)} x2={sx(marker)} y1={pt} y2={H - pb} stroke={dark ? '#fff' : '#0d0e11'} strokeWidth={1} opacity={0.5} />}
        {hover !== null && (
          <g>
            <line x1={sx(hover)} x2={sx(hover)} y1={pt} y2={H - pb} stroke={ink} strokeWidth={1} />
            {series.map((s) => { const p = s.points.length ? nearest(s, hover) : null; return p ? <circle key={s.key} cx={sx(p.x)} cy={sy(p.y)} r={4} fill={s.color} stroke={surface} strokeWidth={2} /> : null })}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className={`pointer-events-none absolute top-1 z-10 rounded-lg px-2.5 py-1.5 text-[11px] shadow-lg font-mono tabular ${dark ? 'bg-graphite-4 text-white' : 'bg-ink text-white'}`}
          style={{ left: `${Math.min(78, (sx(hover) / W) * 100)}%` }}>
          <div className="opacity-60">{xFormat(hover)}</div>
          {series.map((s) => { const p = s.points.length ? nearest(s, hover) : null; return p ? (
            <div key={s.key} className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}<b className="ml-auto pl-3">{yFormat(p.y)}</b></div>
          ) : null })}
        </div>
      )}
      {series.length > 1 && (
        <div className={`mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] ${dark ? 'text-white/60' : 'text-muted'}`}>
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5"><span className="inline-block h-[2px] w-3 rounded" style={{ background: s.color }} />{s.label}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Sparkline({ values, color = '#3a44ff', width = 120, height = 28, band }: { values: number[]; color?: string; width?: number; height?: number; band?: [number, number] }) {
  if (values.length < 2) return <svg width={width} height={height} />
  let min = Math.min(...values), max = Math.max(...values)
  if (band) { min = Math.min(min, band[0]); max = Math.max(max, band[1]) }
  if (max - min < 1e-6) { min -= 0.5; max += 0.5 }
  const sx = (i: number) => (i / (values.length - 1)) * (width - 4) + 2
  const sy = (v: number) => 2 + (1 - (v - min) / (max - min)) * (height - 4)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join('')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {band && <rect x={0} width={width} y={sy(band[1])} height={sy(band[0]) - sy(band[1])} fill={color} opacity={0.08} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={sx(values.length - 1)} cy={sy(values[values.length - 1])} r={2.5} fill={color} />
    </svg>
  )
}

/** Horizontal bars (magnitude by category) with value at the tip. */
export function Bars({ rows, dark = false, format = (v: number) => String(v) }: { rows: { label: string; value: number; color: string; sub?: string }[]; dark?: boolean; format?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3 text-[12px]">
          <div className={`truncate ${dark ? 'text-white/70' : 'text-ink/80'}`} title={r.label}>{r.label}</div>
          <div className="flex items-center gap-2">
            <div className="h-3 rounded-r-[4px]" style={{ width: `${(r.value / max) * 100}%`, minWidth: 3, background: r.color }} />
            <span className={`font-mono tabular text-[11px] ${dark ? 'text-white/70' : 'text-muted'}`}>{format(r.value)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
