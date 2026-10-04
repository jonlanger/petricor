import { db } from '@/lib/server/store'
import { PageHead } from '@/components/app/ui'

export const metadata = { title: 'Audit trail' }

export default async function Audit() {
  const s = db()
  const who = (u: string) => s.users.find((x) => x.id === u)?.name ?? u
  return (
    <div>
      <PageHead crumbs={[{ href: '/app', label: 'Overview' }, { label: 'Audit trail' }]} eyebrow="Compliance" title="Audit trail" sub="Append-only record of who did what, when — run lifecycle, sign-offs, sample events and alert acknowledgements." />
      <div className="p-5 sm:p-8">
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-muted"><tr>{['Time', 'Actor', 'Action', 'Target', 'Detail'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {s.audit.slice(0, 300).map((e) => (
                <tr key={e.id}><td className="px-4 py-2.5 font-mono text-[12px] tabular">{new Date(e.at).toLocaleString('en-GB')}</td><td className="px-4 py-2.5">{who(e.actor)}</td><td className="px-4 py-2.5 font-mono text-[12px]">{e.action}</td><td className="px-4 py-2.5 font-mono text-[12px] text-muted">{e.target}</td><td className="px-4 py-2.5 text-ink/75">{e.detail}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
