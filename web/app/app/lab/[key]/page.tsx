import { notFound } from 'next/navigation'
import { Btn, Card, PageHead } from '@/components/app/ui'
import HyphaeLab from '@/components/viz/HyphaeLab'
import PlateCanvas from '@/components/viz/PlateCanvas'
import { SPECIES_BY_KEY } from '@/lib/science/species'
import { LAB_NOTES } from '@/lib/science/labNotes'

export async function generateMetadata({ params }: PageProps<'/app/lab/[key]'>) {
  const { key } = await params
  return { title: `${SPECIES_BY_KEY[key]?.name ?? 'Specimen'} · Mycelium lab` }
}

export default async function LabSpecimen({ params }: PageProps<'/app/lab/[key]'>) {
  const { key } = await params
  const s = SPECIES_BY_KEY[key]
  if (!s) notFound()
  const h = s.morph.hyphae
  const note = LAB_NOTES[key]
  return (
    <div>
      <PageHead crumbs={[{ href: '/app', label: 'Overview' }, { href: '/app/lab', label: 'Mycelium lab' }, { label: s.name }]}
        eyebrow={`Mycelium lab · ${s.family}`} title={<span className="italic">{s.name}</span>} sub={note?.character}>
        <Btn href={`/app/species/${s.key}`}>Species reference →</Btn>
      </PageHead>
      <div className="space-y-6 p-4 sm:p-8">
        <HyphaeLab speciesKey={s.key} />
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="On the plate">
            <div className="flex items-center gap-4">
              <div className="w-28 shrink-0"><PlateCanvas colonies={[{ id: `lab-${s.key}`, x: 0, y: 0, r: 20, key: s.key }]} resolution={240} className="w-full" /></div>
              <p className="text-[13px] leading-relaxed text-ink/70">The same species as the imaging pipeline draws it at 5–7 days: the macroscopic colony that this network of hyphae builds.</p>
            </div>
          </Card>
          <Card title="Under the microscope">
            <p className="text-[13.5px] leading-relaxed text-ink/75">{note?.microscope}</p>
          </Card>
          <Card title="Preset">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-[13px]">
              {[['Branch angle', `${h.branchDeg}°`], ['Internode', `${h.internode} µm`], ['Tip extension', `${(3 * h.speed).toFixed(1)} µm/min`], ['Aerial growth', `${Math.round(h.aerial * 100)} %`]].map(([k, v]) => (
                <div key={k}><dt className="eyebrow">{k}</dt><dd className="mt-0.5 font-semibold">{v}</dd></div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}
