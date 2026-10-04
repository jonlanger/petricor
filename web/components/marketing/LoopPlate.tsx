'use client'
import { useEffect, useMemo, useState } from 'react'
import PlateCanvas from '@/components/viz/PlateCanvas'
import { drawInoculum, observeDish } from '@/lib/science/colonies'
import type { EnvSample } from '@/lib/science/cmi'
import type { SourceType } from '@/lib/domain/types'

/** Looping simulated timelapse of one dish at a constant 25 °C. */
export default function LoopPlate({ seed = 42, source = 'air', hours = 120, resolution = 420, className = '', showClock = true, overlay = 'none' }: {
  seed?: number; source?: SourceType; hours?: number; resolution?: number; className?: string; showClock?: boolean; overlay?: 'none' | 'outline' | 'label'
}) {
  const env = useMemo<EnvSample[]>(() => Array.from({ length: hours * 4 + 1 }, (_, i) => ({ h: i / 4, T: 25, RH: 85 })), [hours])
  const truth = useMemo(() => drawInoculum(seed, source), [seed, source])
  const [h, setH] = useState(hours * 0.55)
  useEffect(() => {
    const iv = setInterval(() => setH((x) => (x >= hours ? 6 : x + 1.5)), 140)
    return () => clearInterval(iv)
  }, [hours])
  const obs = observeDish(env, truth, 1, h)
  return (
    <div className={`relative ${className}`}>
      <PlateCanvas colonies={obs.colonies.map((c) => ({ id: c.id, x: c.x, y: c.y, r: c.r, key: c.guesses[0].key }))} resolution={resolution} overlay={overlay} />
      {showClock && <div className="absolute left-0 top-0 font-mono text-[12px] text-white/70 tabular">{h.toFixed(0).padStart(3, '0')} h · {obs.colonies.length} colonies</div>}
    </div>
  )
}
