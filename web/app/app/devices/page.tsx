import Link from 'next/link'
import { db } from '@/lib/server/store'
import { PageHead, Pill, stateTone } from '@/components/app/ui'

export const metadata = { title: 'Instruments' }

export default async function Devices() {
  const s = db()
  return (
    <div>
      <PageHead crumbs={[{ href: '/app', label: 'Overview' }, { label: 'Instruments' }]} eyebrow="Fleet" title="Instruments" sub="PC-6 benchtop incubator-imagers registered to this lab" />
      <div className="grid gap-5 p-5 sm:p-8 md:grid-cols-2 xl:grid-cols-3">
        {s.devices.map((d) => {
          const run = s.runs.find((r) => r.id === d.activeRunId)
          return (
            <Link key={d.id} href={`/app/devices/${d.id}`} className="card group overflow-hidden transition-colors hover:border-blue">
              <div className="relative aspect-[16/10] bg-[#e4e5ea]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/renders/hero.png" alt="PC-6" className={`h-full w-full object-cover ${d.online ? '' : 'grayscale opacity-60'}`} />
                <div className="absolute left-3 top-3"><Pill tone={stateTone(d.state)}>{d.state}</Pill></div>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between"><div className="text-[17px] font-semibold">{d.name}</div><span className="font-mono text-[12px] text-muted">{d.serial}</span></div>
                <div className="text-[13px] text-muted">{d.location}</div>
                <div className="mt-4 grid grid-cols-3 gap-3 font-mono text-[12px]">
                  <div><div className="text-muted">Chamber</div><div className="text-[15px] font-semibold tabular">{d.online ? `${d.telemetry.T.toFixed(1)} °C` : '—'}</div></div>
                  <div><div className="text-muted">RH</div><div className="text-[15px] font-semibold tabular">{d.online ? `${d.telemetry.RH.toFixed(0)} %` : '—'}</div></div>
                  <div><div className="text-muted">Run</div><div className="truncate text-[15px] font-semibold">{run ? `${run.elapsedH.toFixed(0)} h` : 'none'}</div></div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
