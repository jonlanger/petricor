'use client'
import type { ReactNode } from 'react'
import PlateCanvas from '@/components/viz/PlateCanvas'
import type { LatestDish } from '@/lib/client/live'

export function Btn({ children, onClick, kind = 'primary', disabled, className = '', big }: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'light' | 'ok'; disabled?: boolean; className?: string; big?: boolean
}) {
  const k = {
    primary: 'bg-blue text-white hover:bg-blue-600 active:bg-blue-700',
    ghost: 'bg-transparent text-white ring-1 ring-inset ring-white/20 hover:bg-white/5',
    danger: 'bg-transparent text-[#ff8a8d] ring-1 ring-inset ring-[#ff8a8d]/40 hover:bg-[#ff8a8d]/10',
    light: 'bg-white text-ink hover:bg-white/90',
    ok: 'bg-ok text-white hover:brightness-105',
  }[kind]
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-mono font-semibold tracking-tight transition-all disabled:opacity-30 disabled:pointer-events-none ${big ? 'h-16 px-8 text-[19px]' : 'h-14 px-6 text-[16px]'} ${k} ${className}`}>
      {children}
    </button>
  )
}

export function Chip({ children, tone = 'ok', pulse }: { children: ReactNode; tone?: 'ok' | 'blue' | 'warn' | 'crit' | 'mute'; pulse?: boolean }) {
  const t = {
    ok: 'bg-ok/15 text-[#5fe08e] ring-[#5fe08e]/30',
    blue: 'bg-blue/20 text-[#aab0ff] ring-[#8f97ff]/30',
    warn: 'bg-warn/15 text-[#ffc266] ring-[#ffc266]/30',
    crit: 'bg-crit/15 text-[#ff9c9f] ring-[#ff9c9f]/30',
    mute: 'bg-white/5 text-white/60 ring-white/10',
  }[tone]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[12px] font-medium ring-1 ring-inset ${t}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${pulse ? 'animate-pc-pulse' : ''}`} />
      {children}
    </span>
  )
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`flex h-8 items-center gap-2 rounded-full pl-1 pr-3 font-mono text-[12px] ${i === current ? 'bg-white text-ink' : i < current ? 'bg-ok/15 text-[#5fe08e]' : 'bg-white/5 text-white/40'}`}>
            <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${i === current ? 'bg-blue text-white' : i < current ? 'bg-ok text-white' : 'bg-white/10'}`}>{i < current ? '✓' : i + 1}</span>
            {s}
          </div>
          {i < steps.length - 1 && <div className={`h-px w-4 ${i < current ? 'bg-ok/50' : 'bg-white/10'}`} />}
        </div>
      ))}
    </div>
  )
}

/**
 * Top-down carousel map. Position p is at the imaging station (top, rear) when angle = (p-1)·60°,
 * and at the loading bay (bottom, behind the door) when angle = (p-1)·60° + 180°.
 */
export function CarouselMap({ angle, size = 360, dishes, highlight, onPick, labels = true }: {
  angle: number
  size?: number
  dishes: { position: number; state: 'empty' | 'assigned' | 'scanned' | 'loaded'; latest?: LatestDish }[]
  highlight?: number | null
  onPick?: (p: number) => void
  labels?: boolean
}) {
  const c = size / 2, ring = size * 0.31, dishR = size * 0.135
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <circle cx={c} cy={c} r={size * 0.47} fill="#23252b" stroke="rgba(255,255,255,0.08)" />
        {/* imaging station marker */}
        <g transform={`translate(${c},${c - ring})`}>
          <circle r={dishR + 9} fill="none" stroke="#3a44ff" strokeWidth={2} strokeDasharray="3 5" />
        </g>
        <text x={c} y={16} textAnchor="middle" fontSize={11} fill="#8f97ff" className="font-mono">IMAGING STATION</text>
        <text x={c} y={size - 6} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.4)" className="font-mono">DOOR · LOADING BAY</text>
        <circle cx={c} cy={c} r={size * 0.06} fill="#111215" />
      </svg>
      {dishes.map((d) => {
        const a = ((-(90 + 60 * (d.position - 1) - angle)) * Math.PI) / 180
        const x = c + Math.cos(a) * ring, y = c + Math.sin(a) * ring
        const hl = highlight === d.position
        return (
          <button key={d.position} onClick={() => onPick?.(d.position)}
            className={`absolute grid place-items-center rounded-full transition-shadow ${hl ? 'ring-4 ring-blue shadow-[0_0_40px_rgba(58,68,255,0.6)]' : ''}`}
            style={{ left: x - dishR, top: y - dishR, width: dishR * 2, height: dishR * 2 }}>
            {d.latest ? (
              <PlateCanvas colonies={d.latest.colonies} resolution={Math.round(dishR * 2.4)} className="h-full w-full" />
            ) : (
              <div className={`h-full w-full rounded-full ${d.state === 'empty' ? 'border-2 border-dashed border-white/15' : d.state === 'loaded' ? 'bg-[#dbc48c]/90' : 'border-2 border-white/30 bg-white/5'}`} />
            )}
            {labels && (
              <span className="absolute -bottom-1 -right-1 grid h-7 min-w-7 place-items-center rounded-full bg-ink px-1.5 font-mono text-[12px] font-semibold text-white ring-2 ring-graphite">
                {d.position}
              </span>
            )}
            {d.latest && labels && (
              <span className="absolute -top-1 -left-1 rounded-full bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-ink">{d.latest.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function Stat({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub?: ReactNode; tone?: 'ok' | 'warn' }) {
  return (
    <div>
      <div className="font-mono text-[12px] uppercase tracking-wider text-white/45">{label}</div>
      <div className="mt-1 flex items-baseline gap-1 font-mono">
        <span className={`text-[44px] font-semibold leading-none tabular ${tone === 'warn' ? 'text-[#ffc266]' : 'text-white'}`}>{value}</span>
        {unit && <span className="text-[18px] text-white/50">{unit}</span>}
      </div>
      {sub && <div className="mt-2 text-[13px] text-white/50">{sub}</div>}
    </div>
  )
}
