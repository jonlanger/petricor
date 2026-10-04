'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { renderPlate, type PlateColony } from '@/lib/viz/plate'
import type { Channel } from '@/lib/domain/types'
import { shortName, speciesColor } from '@/lib/viz/speciesColor'

interface Props {
  colonies: PlateColony[]
  channel?: Channel
  size?: number // CSS px (square)
  resolution?: number // canvas px
  overlay?: 'none' | 'outline' | 'label'
  selected?: string | null
  onSelect?: (id: string | null) => void
  className?: string
  dark?: boolean
  showScale?: boolean
}

/** Renders a simulated capture of one 90 mm dish with optional detection overlay. */
export default function PlateCanvas({ colonies, channel = 'white', resolution = 420, overlay = 'none', selected = null, onSelect, className = '', showScale }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [geom, setGeom] = useState<{ pxPerMM: number; cx: number; cy: number } | null>(null)
  const key = useMemo(() => colonies.map((c) => `${c.id}:${c.r.toFixed(2)}:${c.key}`).join('|') + channel + resolution, [colonies, channel, resolution])

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    let cancelled = false
    const run = () => {
      if (cancelled) return
      cv.width = resolution; cv.height = resolution
      const g = renderPlate(cv, colonies, { channel })
      setGeom({ pxPerMM: g.pxPerMM, cx: g.cx, cy: g.cy })
    }
    const id = requestAnimationFrame(run)
    return () => { cancelled = true; cancelAnimationFrame(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const S = resolution
  return (
    <div className={`relative aspect-square ${className}`}>
      <canvas ref={ref} className="absolute inset-0 h-full w-full rounded-full" />
      {geom && overlay !== 'none' && (
        <svg viewBox={`0 0 ${S} ${S}`} className="absolute inset-0 h-full w-full" onClick={() => onSelect?.(null)}>
          {colonies.map((c) => {
            const x = geom.cx + c.x * geom.pxPerMM, y = geom.cy + c.y * geom.pxPerMM, r = Math.max(c.r * geom.pxPerMM + 3, 5)
            const sel = selected === c.id
            return (
              <g key={c.id} onClick={(e) => { e.stopPropagation(); onSelect?.(sel ? null : c.id) }} className="cursor-pointer">
                <circle cx={x} cy={y} r={r + 6} fill="transparent" />
                <circle cx={x} cy={y} r={r} fill="none" stroke={sel ? '#fff' : speciesColor(c.key)} strokeWidth={sel ? 2.5 : 1.5} strokeDasharray={sel ? '' : '4 3'} />
                {overlay === 'label' && (c.r * geom.pxPerMM > 7 || sel) && (
                  <g transform={`translate(${x + r * 0.72},${y - r * 0.72})`}>
                    <rect x={0} y={-11} rx={4} width={shortName(c.key).length * 6.1 + 12} height={16} fill="rgba(13,14,17,0.82)" />
                    <circle cx={6} cy={-3} r={3} fill={speciesColor(c.key)} />
                    <text x={12} y={1} fontSize={10} fill="#fff" className="font-mono">{shortName(c.key)}</text>
                  </g>
                )}
              </g>
            )
          })}
          {showScale && (
            <g transform={`translate(${S * 0.12},${S * 0.93})`}>
              <line x1={0} x2={10 * geom.pxPerMM} y1={0} y2={0} stroke="#fff" strokeWidth={2} />
              <text x={0} y={-5} fontSize={10} fill="#fff" className="font-mono">10 mm</text>
            </g>
          )}
        </svg>
      )}
    </div>
  )
}
