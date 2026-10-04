'use client'
import PlateCanvas from '@/components/viz/PlateCanvas'
import type { ColonyRow } from '@/lib/server/pipeline'

export default function ReportPlates({ plates }: { plates: { pos: number; label: string; cols: ColonyRow[] }[] }) {
  return (
    <div className="mt-6 grid grid-cols-6 gap-3">
      {plates.map((p) => (
        <div key={p.pos}>
          <div className="rounded-full bg-graphite p-0.5"><PlateCanvas colonies={p.cols.map((c) => ({ id: c[0], x: c[1], y: c[2], r: c[3], key: c[4] }))} resolution={200} /></div>
          <div className="mt-1 truncate text-center font-mono text-[10.5px]">#{p.pos} {p.label}</div>
        </div>
      ))}
    </div>
  )
}
