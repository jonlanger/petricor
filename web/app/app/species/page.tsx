import Link from 'next/link'
import { SPECIES, growthProvenance } from '@/lib/science/species'
import { PageHead, Pill } from '@/components/app/ui'
import SpeciesThumb from './SpeciesThumb'

export const metadata = { title: 'Species library' }

export default function SpeciesIndex() {
  return (
    <div>
      <PageHead crumbs={[{ href: '/app', label: 'Overview' }, { label: 'Species library' }]} eyebrow="Reference" title="Species library" sub="Taxonomy and occurrence data from GBIF, openly-licensed photographs from Wikimedia Commons, and growth models with cited parameters." />
      <div className="grid gap-5 p-5 sm:p-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {SPECIES.map((s) => {
          const prov = growthProvenance(s)
          return (
            <Link key={s.key} href={`/app/species/${s.key}`} className="card group overflow-hidden transition-colors hover:border-blue">
              <div className="bg-graphite p-6"><SpeciesThumb speciesKey={s.key} /></div>
              <div className="p-5">
                <div className="text-[17px] font-semibold italic">{s.name}</div>
                <div className="text-[12.5px] text-muted">{s.authority} · {s.family}</div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Pill tone={prov === 'literature' ? 'ok' : prov === 'derived' ? 'blue' : 'warn'}>{prov === 'literature' ? 'Cited growth model' : prov === 'derived' ? 'Partly cited model' : 'Demo parameters'}</Pill>
                  <Pill tone="mute">GBIF {s.gbifKey}</Pill>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
