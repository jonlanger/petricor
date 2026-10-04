import Link from 'next/link'
import fs from 'node:fs'
import path from 'node:path'
import Logo from '@/components/brand/Logo'
import ViewerIsland from '@/components/marketing/ViewerIsland'
import { GROUP_LABEL } from '@/components/three/labels'

export const metadata = { title: 'Hardware' }

interface Part { title: string; group: string; desc: string; spec: string; objects: string[] }

const SHOTS: [string, string, string][] = [
  ['exploded', 'Exploded assembly', 'Base, dry electronics bay, conditioned chamber, cover and door as separate layers; console and screen pulled forward.'],
  ['section', 'Section', 'Half the enclosure, chamber and base cut away at the centreline.'],
  ['interior', 'Interior', 'Enclosure, console and chamber hidden to show the internal layout.'],
  ['x_imaging', 'Imaging head, exploded', 'Window, diffuser, ring light, lens, sensor board, heater and housing.'],
  ['x_carousel', 'Carousel & drive, exploded', 'Dishes and lids, turntable, quick-release knob, shaft seal, belt drive and stepper.'],
  ['x_climate', 'Climate & humidity, exploded', 'Duct, heat exchangers, Peltier modules, blower, PTC heater, HEPA, reservoir and atomiser.'],
  ['x_console', 'Console, exploded', 'Cover glass, display, LCD module, driver board, printer door and mechanism.'],
  ['x_insulation', 'Insulation, exploded', 'Moulded EPP panels follow the rounded shell; the dimpled outer faces hold a still-air layer against the cover.'],
  ['plates_top', 'Carousel, top down', 'Six dishes of illustrative mould cultures on the anodised turntable.'],
  ['d_culture', 'Culture, macro', 'Fusarium: floccose aerial mycelium (rendered as hair) over a violet centre and diffusing pigment.'],
  ['d_culture_b', 'Culture, macro', 'A. niger: black conidial heads behind a white margin, with satellite colonies; a sulcate Penicillium behind.'],
  ['d_carousel', 'Chamber', 'Six dishes under the chamber light.'],
  ['d_imaging', 'Imaging head, sectioned', ''],
  ['d_console', 'Console', 'Label printer door and touchscreen.'],
  ['d_climate', 'Dry bay', ''],
  ['d_scanner', 'Side reader', ''],
  ['d_rear_io', 'Rear I/O', 'IEC inlet, Ethernet, USB-A ×2, power switch.'],
  ['d_handhold', 'Side reader & handhold', 'Reader window in the navy grip inlay, finger recess below for lifting.'],
  ['d_reveal', 'Reveals', 'Hood and door share one radius; the saddle between reveals.'],
  ['d_scoop', 'Door pull', 'Recessed pull under the badge, above the printer door and touchscreen.'],
  ['d_foam', 'Insulation', 'Dimpled EPP panel against the cover.'],
  ['d_corner', 'Console corner', 'R30 console corner and the status light in the base band.'],
  ['rear', 'Rear', 'Exhaust grille, reservoir hatch and I/O.'],
  ['side', 'Side profile', ''],
  ['top', 'Top, door open', ''],
  ['hero_blue', 'PC-6', ''],
  ['open_blue', 'PC-6, door open', ''],
  ['exploded_side', 'Exploded, side', ''],
]

export default function Hardware() {
  const parts = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/models/parts.json'), 'utf8')) as Part[]
  const shots = SHOTS.filter(([n]) => fs.existsSync(path.join(process.cwd(), 'public/renders', `${n}.png`)))
  const groups = [...new Set(parts.map((p) => p.group))].filter((g) => g !== 'Wiring')
  return (
    <main className="bg-paper">
      <nav className="sticky top-0 z-40 border-b border-black/[0.06] bg-paper/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-6 px-5 sm:px-8">
          <Link href="/"><Logo className="h-7 text-[17px]" /></Link>
          <span className="font-mono text-[13px] text-muted">/ Hardware</span>
          <Link href="/device" className="ml-auto inline-flex h-9 items-center rounded-full bg-ink px-4 text-[14px] font-medium text-white hover:bg-blue">Live demo</Link>
        </div>
      </nav>
      <section className="mx-auto max-w-[1320px] px-5 pt-16 sm:px-8">
        <div className="eyebrow">PC-6 hardware</div>
        <h1 className="mt-3 font-mono text-[48px] font-semibold leading-[0.95] tracking-tight sm:text-[84px]">Every part,<br />accounted for.</h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink/70">The PC-6 is modelled part-by-part in Blender from a parametric script. The same model produces these renders and the interactive viewer, so what you explore is what was rendered.</p>
        <ViewerIsland height="h-[600px] sm:h-[760px]" />
      </section>

      <section className="mx-auto mt-24 max-w-[1320px] px-5 sm:px-8">
        <h2 className="font-mono text-[32px] font-semibold tracking-tight">Renders</h2>
        <div className="mt-8 columns-1 gap-5 sm:columns-2 lg:columns-3">
          {shots.map(([n, t, d]) => (
            <a key={n} href={`/renders/${n}.png`} target="_blank" className="mb-5 block break-inside-avoid overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/renders/${n}.png`} alt={t} loading="lazy" className="w-full" />
              <div className="p-4"><div className="font-mono text-[14px] font-semibold">{t}</div>{d && <div className="mt-1 text-[13px] text-muted">{d}</div>}</div>
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-[1320px] px-5 pb-28 sm:px-8">
        <h2 className="font-mono text-[32px] font-semibold tracking-tight">Parts</h2>
        <p className="mt-2 text-[14px] text-muted">{parts.length} named parts from the model. Specifications are design intent for this concept, not measured performance.</p>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {groups.map((g) => (
            <div key={g} className="card overflow-hidden">
              <div className="border-b border-line bg-paper/60 px-5 py-3 font-mono text-[13px] font-semibold uppercase tracking-wide">{GROUP_LABEL[g] ?? g}</div>
              <div className="divide-y divide-line">
                {parts.filter((p) => p.group === g).map((p) => (
                  <div key={p.title} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-4"><span className="font-medium">{p.title}</span>{p.spec && <span className="text-right font-mono text-[11.5px] text-blue">{p.spec}</span>}</div>
                    {p.desc && <p className="mt-0.5 text-[13px] leading-snug text-ink/65">{p.desc}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
