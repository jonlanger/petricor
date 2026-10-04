import Link from 'next/link'
import { db } from '@/lib/server/store'
import { PageHead, Pill } from '@/components/app/ui'

export const metadata = { title: 'Samples' }

// desktop columns after the chevron: barcode · sample · source · location · run
const COLS = 'md:grid-cols-[7.5rem_minmax(0,1.5fr)_6.5rem_minmax(0,1fr)_minmax(0,1.3fr)]'

export default async function Samples() {
  const s = db()
  const runOf = (sid: string) => s.runs.find((r) => r.dishes.some((d) => d.sampleId === sid))
  const who = (u: string) => s.users.find((x) => x.id === u)?.name ?? u
  const tone = (src: string) => (src === 'reference' ? 'uv' : src === 'clinical' ? 'crit' : 'mute')
  return (
    <div>
      <PageHead crumbs={[{ href: '/app', label: 'Overview' }, { label: 'Samples' }]} eyebrow="Traceability" title="Samples" sub="Every dish is linked to its sample by a printed barcode, scanned at the side reader before loading." />
      <div className="p-4 sm:p-8">
        <div className="card overflow-hidden">
          <div className={`hidden gap-x-6 border-b border-line bg-paper/60 py-2.5 pl-[52px] pr-5 md:grid ${COLS}`}>
            {['Barcode', 'Sample', 'Source', 'Location', 'Run'].map((h) => <span key={h} className="eyebrow">{h}</span>)}
          </div>
          <div className="divide-y divide-line">
            {s.samples.map((smp) => {
              const run = runOf(smp.id)
              const lastEvent = smp.custody[smp.custody.length - 1]
              return (
                <details key={smp.id} className="group">
                  <summary className="grid cursor-pointer list-none grid-cols-[20px_minmax(0,1fr)] items-start gap-x-3 px-4 py-3.5 hover:bg-paper sm:px-5 [&::-webkit-details-marker]:hidden">
                    {/* chevron: always left, aligned to the first line */}
                    <svg viewBox="0 0 16 16" className="mt-[3px] h-4 w-4 text-muted transition-transform duration-200 group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 3.5 10.5 8 6 12.5" /></svg>
                    <div className={`min-w-0 md:grid md:items-baseline md:gap-x-6 ${COLS}`}>
                      <span className="hidden truncate font-mono text-[12.5px] text-muted md:block">{smp.barcode}</span>
                      <span className="block min-w-0 truncate font-medium leading-snug md:whitespace-normal">{smp.label}</span>
                      {/* mobile: barcode, source and location on one wrapped meta line; desktop: their own columns */}
                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-muted md:contents">
                        <span className="font-mono md:hidden">{smp.barcode}</span>
                        <span className="md:block"><Pill tone={tone(smp.source)}>{smp.source}</Pill></span>
                        <span className="min-w-0 truncate md:block md:text-[13px]">{smp.location}</span>
                      </div>
                      <span className="mt-1.5 block min-w-0 truncate text-[13px] md:mt-0">
                        {run ? <Link href={`/app/runs/${run.id}`} className="text-blue hover:underline">{run.name}</Link> : <span className="text-muted">Awaiting run</span>}
                      </span>
                    </div>
                  </summary>
                  <div className="pb-4 pl-[48px] pr-4 sm:pl-[52px] sm:pr-5">
                    <div className="mb-2.5 font-mono text-[11px] uppercase tracking-wider text-muted">Chain of custody · {smp.custody.length} events{lastEvent ? ` · last: ${lastEvent.event.toLowerCase()}` : ''}</div>
                    <ol className="relative space-y-2.5 border-l border-line pl-5">
                      {smp.custody.map((c, i) => (
                        <li key={i} className="relative text-[13px] leading-snug">
                          <span className="absolute -left-[24.5px] top-[5px] h-2 w-2 rounded-full bg-blue ring-2 ring-white" />
                          <span className="font-medium">{c.event}</span>
                          <span className="block text-muted sm:ml-2 sm:inline">{new Date(c.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {who(c.by)}{c.deviceId ? ` · ${s.devices.find((d) => d.id === c.deviceId)?.name}` : ''}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </details>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
