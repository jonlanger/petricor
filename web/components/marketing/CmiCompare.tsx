'use client'
import { LineChart } from '@/components/viz/charts'
import { mu } from '@/lib/science/cmi'
import { SPECIES_BY_KEY, cardinal } from '@/lib/science/species'
import { speciesColor } from '@/lib/viz/speciesColor'

/** Radial growth rate vs temperature for the two species with fully cited CMI parameters. */
export default function CmiCompare() {
  const keys = ['aspergillus_niger', 'penicillium_expansum']
  const series = keys.map((k) => {
    const s = SPECIES_BY_KEY[k]
    const pts = []
    for (let t = -6; t <= 45; t += 0.5) pts.push({ x: t, y: mu(t, cardinal(s), s.growth.muOpt.value) * 24 })
    return { key: k, label: s.name, color: speciesColor(k), points: pts }
  })
  return <LineChart series={series} xFormat={(x) => `${Math.round(x)} °C`} yFormat={(v) => v.toFixed(0)} height={230} />
}
