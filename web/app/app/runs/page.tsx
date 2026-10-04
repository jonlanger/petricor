import Link from 'next/link'
import { db } from '@/lib/server/store'
import { PageHead, Pill, stateTone } from '@/components/app/ui'
import { observeDish } from '@/lib/science/colonies'

export const metadata = { title: 'Runs' }

export default async function Runs() {
  const s = db()
  const rows = s.runs.map((r) => {
    const h = r.captures[r.captures.length - 1] ?? 0
    const counts = r.dishes.map((d) => observeDish(r.env, d.truth, d.position, h).colonies.length)
    return { r, total: counts.reduce((a, b) => a + b, 0), counts }
  })
  return (
    <div>
      <PageHead crumbs={[{ href: '/app', label: 'Overview' }, { label: 'Runs' }]} eyebrow="Experiments" title="Runs" sub={`${s.runs.length} runs across ${s.devices.length} instruments`} />
      <div className="p-5 sm:p-8">
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13.5px]">
            <thead className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
              <tr>{['Run', 'Instrument', 'Protocol', 'Started', 'Progress', 'Colonies / dish', 'Status', 'Review'].map((h) => <th key={h} className="px-4 py-3 font-mono font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ r, counts }) => {
                const p = s.protocols.find((x) => x.id === r.protocolId)!
                const d = s.devices.find((x) => x.id === r.deviceId)!
                return (
                  <tr key={r.id} className="hover:bg-paper">
                    <td className="px-4 py-3"><Link href={`/app/runs/${r.id}`} className="font-medium hover:text-blue">{r.name}</Link><div className="font-mono text-[11.5px] text-muted">{r.id}</div></td>
                    <td className="px-4 py-3">{d.name}</td>
                    <td className="px-4 py-3">{p.name}<div className="text-[12px] text-muted">{p.tempC} °C · {p.durationH} h</div></td>
                    <td className="px-4 py-3 font-mono text-[12.5px]">{r.startedAt ? new Date(r.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</td>
                    <td className="px-4 py-3"><div className="h-1.5 w-28 overflow-hidden rounded-full bg-paper"><div className="h-full bg-blue" style={{ width: `${(r.elapsedH / p.durationH) * 100}%` }} /></div><div className="mt-1 font-mono text-[11.5px] text-muted">{r.elapsedH.toFixed(0)} / {p.durationH} h</div></td>
                    <td className="px-4 py-3 font-mono text-[12.5px] tabular">{counts.join(' · ') || '—'}</td>
                    <td className="px-4 py-3"><Pill tone={stateTone(r.state)}>{r.state}</Pill></td>
                    <td className="px-4 py-3">{r.state === 'complete' ? <Pill tone={stateTone(r.review.status)}>{r.review.status}</Pill> : <span className="text-muted">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
