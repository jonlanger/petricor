import Link from 'next/link'
import type { Metadata } from 'next'
import Logo from '@/components/brand/Logo'
import LoopPlate from '@/components/marketing/LoopPlate'
import CmiCompare from '@/components/marketing/CmiCompare'
import HeroMycelium from '@/components/marketing/HeroMycelium'
import ScreenStory, { type Story } from '@/components/marketing/ScreenStory'
import SyncFlow from '@/components/marketing/SyncFlow'
import Reveal from '@/components/marketing/Reveal'
import { CITATIONS } from '@/lib/science/species'

export const metadata: Metadata = {
  title: 'Petricor — every dish, watched',
  description: 'Petricor runs culture imaging end to end: the PC-6 touchscreen guides the bench, and Petricor Cloud turns every frame into tracked colonies, reviewed results and a signed report.',
}

const S = (n: string) => `/shots/${n}.jpg`

const DEVICE: Story[] = [
  { key: 'protocol', title: 'Choose a protocol', body: 'Temperature, humidity, duration, imaging interval and light channels in one saved recipe, picked with a tap.', src: S('device-protocol'), alt: 'Touchscreen: choose a protocol' },
  { key: 'samples', title: 'Assign samples', body: 'Pick up to six samples from the bench queue, or register a new one on the spot.', src: S('device-samples'), alt: 'Touchscreen: assign samples to dishes' },
  { key: 'print', title: 'Print a label per dish', body: 'The built-in printer issues one barcode per dish, linked to its sample record.', src: S('device-printing'), alt: 'Touchscreen: printing dish labels' },
  { key: 'scan', title: 'Scan at the side reader', body: 'Hold each dish to the reader. Barcodes that are not part of the run are rejected before anything is loaded.', src: S('device-scan'), alt: 'Touchscreen: scan each dish' },
  { key: 'load', title: 'Load, pocket by pocket', body: 'The carousel turns each pocket to the door and highlights it. Tap to confirm, close the door, start.', src: S('device-load'), alt: 'Touchscreen: place dish in position 1' },
  { key: 'incubate', title: 'Incubate and image', body: 'Live chamber conditions, the next image set, and every dish on the carousel at a glance.', src: S('device-incubation'), alt: 'Touchscreen: incubation in progress' },
  { key: 'inspect', title: 'Inspect any dish', body: 'Tap a dish for its latest capture, colony list and presumptive IDs, in any of the four light channels.', src: S('device-dish'), alt: 'Touchscreen: dish detail with labelled colonies' },
]

const CLOUD: Story[] = [
  { key: 'overview', title: 'Live overview', body: 'Every instrument, run and alert in one place, streaming as the instruments capture.', src: S('cloud-overview'), alt: 'Petricor Cloud overview', path: '/app', spot: { x: 42, y: 61, label: 'Six dishes, streaming live' } },
  { key: 'run', title: 'Timelapse and colony tracking', body: 'Scrub every image set. Each colony keeps its identity across frames: first-seen time, diameter and radial rate.', src: S('cloud-run'), alt: 'Run workspace with labelled colonies and a growth curve', path: '/app/runs/run_qc_0928', spot: { x: 83, y: 50, label: 'Growth curve per colony', side: 'left' } },
  { key: 'compare', title: 'All six, same hour', body: 'Compare every dish in a run side by side, in any light channel.', src: S('cloud-compare'), alt: 'All six dishes compared at the same hour', path: '/app/runs/run_qc_0928', spot: { x: 59, y: 61, label: 'Same hour, every dish' } },
  { key: 'review', title: 'Review and sign-off', body: 'Presumptive IDs are flagged for review. Approval is role-based and recorded with a note.', src: S('cloud-review'), alt: 'Completed run awaiting review', path: '/app/runs/run_ym_0922', spot: { x: 57, y: 66, label: 'Confirm the presumptive ID' } },
  { key: 'report', title: 'Signed report', body: 'A per-run report with every dish, count and composition, ready to print or save as PDF.', src: S('cloud-report'), alt: 'Run report', path: '/app/runs/run_air_0917/report' },
  { key: 'samples', title: 'Chain of custody', body: 'Collected, printed, scanned, loaded, unloaded: every event on the sample record.', src: S('cloud-samples'), alt: 'Sample traceability list', path: '/app/samples' },
  { key: 'lab', title: 'Mycelium lab', body: 'Grow a colony from one spore in 3D: branching, self-avoidance, fusion and aerial hyphae at microscope scale.', src: S('cloud-lab'), alt: '3D mycelium simulation in the Mycelium lab', path: '/app/lab' },
]

const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>

export default function Home() {
  return (
    <main className="bg-paper text-ink">
      <nav className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#06070a]/[0.94] text-white backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-8 px-5 sm:px-8">
          <Link href="/"><Logo className="h-7 text-[17px]" inverted /></Link>
          <div className="hidden gap-7 text-[14px] text-white/65 md:flex">
            <a href="#touchscreen" className="hover:text-white">Touchscreen</a>
            <a href="#cloud" className="hover:text-white">Cloud</a>
            <a href="#science" className="hover:text-white">Science</a>
            <Link href="/hardware" className="hover:text-white">Hardware</Link>
          </div>
          <div className="ml-auto flex gap-2">
            <Link href="/app" className="hidden h-9 items-center rounded-full px-4 text-[14px] font-medium ring-1 ring-white/20 hover:bg-white/10 sm:inline-flex">Cloud</Link>
            <Link href="/device" className="inline-flex h-9 items-center rounded-full bg-white px-4 text-[14px] font-medium text-ink hover:bg-blue hover:text-white">Live demo</Link>
          </div>
        </div>
      </nav>

      {/* HERO — the 3D colony lives in its own column; text and buttons never sit on top of it */}
      <section className="relative overflow-hidden bg-[#06070a] text-white">
        <div className="relative mx-auto grid max-w-[1320px] lg:min-h-[calc(100svh-64px)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="relative z-10 flex flex-col justify-center px-5 pb-10 pt-16 sm:px-8 sm:pt-20 lg:py-24 lg:pr-10">
            <div className="animate-rise font-mono text-[12px] uppercase tracking-[0.14em] text-white/50">Petricor · culture imaging, end to end</div>
            <h1 className="animate-rise mt-5 font-mono text-[15vw] font-semibold leading-[0.9] tracking-[-0.05em] sm:text-[88px] lg:text-[72px] xl:text-[84px]" style={{ animationDelay: '80ms' }}>
              Every dish,<br /><span className="text-[#7c84ff]">watched.</span>
            </h1>
            <p className="animate-rise mt-7 max-w-[480px] text-[18px] leading-relaxed text-white/70" style={{ animationDelay: '160ms' }}>
              PC-6 incubates and photographs six culture dishes on a schedule. Its touchscreen guides the bench through every step, and Petricor Cloud turns each frame into tracked colonies, reviewed results and a signed report.
            </p>
            <div className="animate-rise mt-9 flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
              <Link href="/device" className="inline-flex h-12 items-center rounded-full bg-blue px-6 text-[15px] font-medium text-white hover:bg-blue-600">Try the touchscreen →</Link>
              <Link href="/app" className="inline-flex h-12 items-center rounded-full bg-white/[0.06] px-6 text-[15px] font-medium text-white ring-1 ring-white/15 hover:bg-white/[0.12]">Open Petricor Cloud</Link>
            </div>
            <div className="animate-rise mt-12 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[12px] text-white/40" style={{ animationDelay: '320ms' }}>
              <span>6 dishes · 4 light channels</span><span>Barcode chain of custody</span><span>Runs live in your browser</span>
            </div>
          </div>
          <HeroMycelium className="h-[88svh] min-h-[600px] lg:absolute lg:min-h-0 lg:inset-y-0 lg:left-[44%] lg:right-[calc(50%-50vw)] lg:h-auto" />
        </div>
      </section>

      {/* SYSTEM */}
      <section className="bg-white py-24 sm:py-28">
        <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
          <Reveal className="max-w-3xl">
            <div className="eyebrow">One system</div>
            <h2 className="mt-3 font-mono text-[40px] font-semibold leading-[1] tracking-tight sm:text-[56px]">One instrument, two screens, one record.</h2>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink/65">What happens at the bench and what happens in review are the same run. Start it on the touchscreen and it is already in the cloud.</p>
          </Reveal>
          <Reveal delay={120} className="mt-14">
            <SyncFlow nodes={[
              { k: 'At the bench', t: 'PC-6 touchscreen', d: 'Protocol, labels, scan, load and incubate, step by step, with the carousel and door doing the remembering.', icon: <Icon d="M3 5h18v11H3zM8 20h8M12 16v4" /> },
              { k: 'In review', t: 'Petricor Cloud', d: 'Live timelapse, colony tracking, comparison across dishes, and role-based sign-off.', icon: <Icon d="M7 18a4 4 0 0 1-.6-7.96A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z" /> },
              { k: 'On record', t: 'Report and exports', d: 'Every dish traced by barcode from sample to report. CSV, JSON and an event stream for LIMS.', icon: <Icon d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" /> },
            ]} />
          </Reveal>
        </div>
      </section>

      {/* TOUCHSCREEN */}
      <section id="touchscreen" className="scroll-mt-16 bg-graphite py-24 text-white sm:py-32">
        <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
          <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="font-mono text-[12px] uppercase tracking-[0.14em] text-white/50">On the instrument</div>
              <h2 className="mt-3 font-mono text-[40px] font-semibold leading-[0.98] tracking-tight sm:text-[60px]">A touchscreen that<br />runs the bench.</h2>
            </div>
            <p className="max-w-md text-[16px] leading-relaxed text-white/60">A 10.1″ display on the angled console. The machine state decides the screen, so the operator only ever sees the next thing to do.</p>
          </Reveal>
          <Reveal delay={100} className="mt-14">
            <ScreenStory steps={DEVICE} frame="device" dark />
          </Reveal>
          <Reveal className="mt-12">
            <Link href="/device" className="inline-flex h-12 items-center rounded-full bg-white px-6 text-[15px] font-medium text-ink hover:bg-white/90">Use the live touchscreen →</Link>
          </Reveal>
        </div>
      </section>

      {/* CLOUD */}
      <section id="cloud" className="scroll-mt-16 py-24 sm:py-32">
        <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
          <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="eyebrow">Petricor Cloud</div>
              <h2 className="mt-3 font-mono text-[40px] font-semibold leading-[0.98] tracking-tight sm:text-[60px]">See growth,<br />not just endpoints.</h2>
            </div>
            <p className="max-w-md text-[16px] leading-relaxed text-ink/65">Every frame from every dish, organised by run and sample, so review happens on the whole timelapse rather than one photo at the end.</p>
          </Reveal>
          <Reveal delay={100} className="mt-14">
            <ScreenStory steps={CLOUD} frame="browser" reverse />
          </Reveal>
          <div className="mt-16 grid gap-px overflow-hidden rounded-2xl bg-line sm:grid-cols-3">
            {[
              ['Role-based review', 'Technicians load and run; microbiologists approve. Every sign-off is in an append-only audit trail.'],
              ['Open exports', 'Per-colony CSV and JSON for LIMS import, plus a live event stream for everything else.'],
              ['Honest by design', 'Simulated parts of the demo are labelled as simulated, and every growth parameter shows its source.'],
            ].map(([k, v], i) => (
              <Reveal key={k} delay={i * 90} className="bg-white p-7">
                <div className="font-mono text-[17px] font-semibold tracking-tight">{k}</div>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink/65">{v}</p>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10">
            <Link href="/app" className="inline-flex h-12 items-center rounded-full bg-ink px-6 text-[15px] font-medium text-white hover:bg-blue">Open Petricor Cloud →</Link>
          </Reveal>
        </div>
      </section>

      {/* SCIENCE */}
      <section id="science" className="scroll-mt-16 bg-ink py-24 text-white sm:py-32">
        <div className="mx-auto grid max-w-[1320px] items-center gap-14 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <Reveal className="relative mx-auto w-full max-w-[500px]">
            <div className="rounded-full bg-white/[0.04] p-3 ring-1 ring-white/10"><LoopPlate seed={77} source="air" resolution={460} showClock={false} overlay="outline" /></div>
            <div className="mt-4 flex justify-between font-mono text-[12px] text-white/40"><span>Simulated air-monitoring dish · 25 °C</span><span>0 → 120 h</span></div>
          </Reveal>
          <Reveal delay={120}>
            <div className="font-mono text-[12px] uppercase tracking-[0.14em] text-white/50">Grounded in published models</div>
            <h2 className="mt-3 font-mono text-[40px] font-semibold leading-[0.98] tracking-tight sm:text-[56px]">Every colony, tracked against the literature.</h2>
            <p className="mt-6 max-w-lg text-[16.5px] leading-relaxed text-white/65">
              Radial growth follows the Cardinal Model with Inflection, driven by the chamber&apos;s own temperature log, and each colony is drawn zone by zone: margin, sporulating body, aged centre and diffusing pigment. Where a parameter comes from a paper, the paper is cited next to it.
            </p>
            <div className="mt-8 rounded-2xl bg-white p-5 text-ink sm:p-6">
              <div className="font-mono text-[12.5px] font-semibold uppercase tracking-wide">Radial growth rate vs temperature · mm/day</div>
              <div className="mt-4"><CmiCompare /></div>
              <p className="mt-4 text-[12px] leading-relaxed text-muted">
                Cardinal parameters from {CITATIONS.gougouli2010.short}, <i>Int. J. Food Microbiol.</i> 140:254–262. Model: {CITATIONS.rosso1993.short}, <i>J. Theor. Biol.</i> 162:447–463.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[14px]">
              <Link href="/app/species" className="text-[#9aa1ff] hover:text-white">Species library →</Link>
              <Link href="/app/lab" className="text-[#9aa1ff] hover:text-white">Mycelium lab, in 3D →</Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* HARDWARE — one compact section */}
      <section className="bg-[#e4e5ea] py-24 sm:py-28">
        <div className="mx-auto grid max-w-[1320px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <Reveal>
            <div className="eyebrow">The instrument</div>
            <h2 className="mt-3 font-mono text-[40px] font-semibold leading-[0.98] tracking-tight sm:text-[52px]">Built around the dish.</h2>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink/65">A conditioned chamber with a sealed imaging head, a six-position carousel, a label printer and a side reader, all reached from one angled console.</p>
            <dl className="mt-8 grid max-w-md grid-cols-2 gap-x-6 gap-y-5">
              {[['6 × 90 mm', 'dishes on the carousel'], ['4', 'light channels'], ['10.1″', 'touchscreen'], ['1', 'barcode per dish']].map(([n, l]) => (
                <div key={l}><dt className="font-mono text-[28px] font-semibold leading-none tracking-tight">{n}</dt><dd className="mt-1.5 text-[13.5px] text-ink/60">{l}</dd></div>
              ))}
            </dl>
            <Link href="/hardware" className="mt-9 inline-flex items-center gap-2 font-mono text-[14px] font-semibold text-blue">Explore the hardware in 3D →</Link>
          </Reveal>
          <Reveal delay={120}>
            <div className="overflow-hidden rounded-3xl bg-[#e4e5ea]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/renders/open.png" alt="PC-6 with the gull-wing door raised, showing six dishes on the carousel" loading="lazy" className="aspect-[16/10] w-full object-cover" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#06070a] text-white">
        <div className="mx-auto max-w-[1320px] px-5 py-24 sm:px-8 sm:py-28">
          <Reveal>
            <h2 className="font-mono text-[40px] font-semibold leading-[1] tracking-tight sm:text-[76px]">The whole system<br />runs in your browser.</h2>
            <p className="mt-6 max-w-xl text-[17px] text-white/60">A software twin of the PC-6 drives the touchscreen and the cloud at the same time. Start a run on one and watch it land in the other.</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/device" className="inline-flex h-12 items-center rounded-full bg-blue px-6 text-[15px] font-medium hover:bg-blue-600">PC-6 touchscreen →</Link>
              <Link href="/app" className="inline-flex h-12 items-center rounded-full bg-white/10 px-6 text-[15px] font-medium ring-1 ring-white/20 hover:bg-white/15">Petricor Cloud</Link>
              <Link href="/hardware" className="inline-flex h-12 items-center rounded-full bg-white/10 px-6 text-[15px] font-medium ring-1 ring-white/20 hover:bg-white/15">Hardware</Link>
            </div>
          </Reveal>
        </div>
        <footer className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-5 py-8 text-[13px] text-white/45 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <Logo className="h-6 text-[15px]" inverted />
            <p className="max-w-2xl">Petricor is a product design concept. The PC-6 is shown as rendered from its parametric model, the software runs against a simulated instrument, and the mycelium is a stochastic growth model. Presumptive identifications in the demo are simulated.</p>
          </div>
        </footer>
      </section>
    </main>
  )
}
