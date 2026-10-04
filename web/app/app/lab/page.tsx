import Link from 'next/link'
import fs from 'node:fs'
import path from 'node:path'
import { PageHead } from '@/components/app/ui'
import { SPECIES } from '@/lib/science/species'
import { LAB_NOTES } from '@/lib/science/labNotes'

export const metadata = { title: 'Mycelium lab' }

export default function Lab() {
  const hasThumb = (k: string) => fs.existsSync(path.join(process.cwd(), 'public/lab', `${k}.jpg`))
  return (
    <div>
      <PageHead crumbs={[{ href: '/app', label: 'Overview' }, { label: 'Mycelium lab' }]} eyebrow="Study" title="Mycelium lab"
        sub="Choose a specimen to watch its colony build itself from a single spore, in 3D: tip extension, branching, self-avoidance, fusion and aerial hyphae." />
      <div className="p-4 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SPECIES.map((s) => {
            const h = s.morph.hyphae
            return (
              <Link key={s.key} href={`/app/lab/${s.key}`} className="card group flex flex-col overflow-hidden transition-[border-color,box-shadow] hover:border-blue hover:shadow-[0_10px_30px_-12px_rgba(58,68,255,0.35)]">
                <div className="relative aspect-[16/10] overflow-hidden bg-[#06070a]">
                  {hasThumb(s.key)
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={`/lab/${s.key}.jpg`} alt={`3D mycelium of ${s.name}`} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                    : <div className="grid h-full place-items-center font-mono text-[12px] text-white/40">3D preview</div>}
                  <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 font-mono text-[11px] text-white/80 backdrop-blur">{s.kind === 'yeast' ? 'Yeast' : 'Mould'}</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[17px] font-semibold italic">{s.name}</div>
                      <div className="mt-0.5 text-[12.5px] text-muted">{s.family}</div>
                    </div>
                    <span className="mt-1 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-blue">→</span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-[13.5px] leading-relaxed text-ink/70">{LAB_NOTES[s.key]?.character}</p>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-4 font-mono text-[11px] text-ink/65">
                    <span className="rounded-md bg-paper px-2 py-1">{h.branchDeg}° branches</span>
                    <span className="rounded-md bg-paper px-2 py-1">{h.internode} µm internode</span>
                    <span className="rounded-md bg-paper px-2 py-1">{(3 * h.speed).toFixed(1)} µm/min</span>
                    <span className="rounded-md bg-paper px-2 py-1">aerial {Math.round(h.aerial * 100)}%</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
        <p className="mt-6 max-w-3xl text-[12px] leading-relaxed text-muted">Presets change branching geometry, speed and aerial growth so the species can be compared side by side. They are illustrative, not fitted to strains.</p>
      </div>
    </div>
  )
}
