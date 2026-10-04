'use client'
import PlateCanvas from '@/components/viz/PlateCanvas'
export default function SpeciesThumb({ speciesKey, r = 24 }: { speciesKey: string; r?: number }) {
  return <PlateCanvas colonies={[{ id: `thumb-${speciesKey}`, x: 0, y: 0, r, key: speciesKey }]} resolution={260} className="mx-auto w-[180px]" />
}
