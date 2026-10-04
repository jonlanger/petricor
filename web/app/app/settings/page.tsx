import { db } from '@/lib/server/store'
import { Card, PageHead, Pill } from '@/components/app/ui'
import ResetDemo from './ResetDemo'

export const metadata = { title: 'Settings' }

const PERMS: [string, string[]][] = [
  ['Operate instruments (load, start, pause)', ['technician', 'microbiologist', 'mycologist', 'director']],
  ['Register samples', ['technician', 'microbiologist', 'mycologist', 'director']],
  ['Review & sign off results', ['microbiologist', 'mycologist', 'director']],
  ['Edit protocols', ['microbiologist', 'director']],
  ['Manage users & integrations', ['director']],
]

export default async function Settings() {
  const s = db()
  const roles = ['technician', 'microbiologist', 'mycologist', 'director']
  return (
    <div>
      <PageHead crumbs={[{ href: '/app', label: 'Overview' }, { label: 'Settings' }]} eyebrow="Workspace" title="Settings" />
      <div className="grid gap-6 p-5 sm:p-8 xl:grid-cols-2">
        <Card title="People & roles" pad={false}>
          {s.users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-0">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-blue font-mono text-[11px] font-semibold text-white">{u.initials}</span>
              <span className="flex-1"><span className="block text-[14px] font-medium">{u.name}</span><span className="text-[12px] text-muted">{u.title} · badge {u.badge}</span></span>
              <Pill tone="blue">{u.role}</Pill>
            </div>
          ))}
        </Card>
        <Card title="Role permissions" pad={false}>
          <table className="w-full text-[13px]">
            <thead className="border-b border-line font-mono text-[10.5px] uppercase tracking-wider text-muted"><tr><th className="px-5 py-2.5 text-left font-medium">Capability</th>{roles.map((r) => <th key={r} className="px-2 py-2.5 font-medium">{r.slice(0, 5)}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{PERMS.map(([k, rs]) => <tr key={k}><td className="px-5 py-2.5">{k}</td>{roles.map((r) => <td key={r} className="text-center">{rs.includes(r) ? '●' : <span className="text-line-2">○</span>}</td>)}</tr>)}</tbody>
          </table>
        </Card>
        <Card title="Protocols" pad={false}>
          {s.protocols.map((p) => (
            <div key={p.id} className="border-b border-line px-5 py-3 last:border-0">
              <div className="flex items-center justify-between"><span className="font-medium">{p.name}</span><span className="font-mono text-[12px] text-muted">{p.tempC} °C · {p.rh}% · {p.durationH} h · /{p.captureEveryH} h</span></div>
              <div className="text-[12.5px] text-muted">{p.medium} — {p.description}</div>
            </div>
          ))}
        </Card>
        <Card title="Integrations">
          <div className="space-y-4 text-[13px]">
            <div><div className="font-medium">Results export (LIMS import)</div><p className="text-muted">Per-run CSV and JSON at <code className="font-mono text-[12px]">/api/runs/&#123;id&#125;/export</code> — one row per colony with sample, barcode, diameter, first-seen time and review status.</p></div>
            <div><div className="font-medium">Event stream</div><p className="text-muted">Server-Sent Events at <code className="font-mono text-[12px]">/api/stream</code>: telemetry, captures, alerts, audit. Filter with <code className="font-mono text-[12px]">?device=</code>.</p></div>
            <div><div className="font-medium">Open reference data</div><p className="text-muted">Taxonomy and occurrence statistics from GBIF; openly-licensed culture photographs from Wikimedia Commons, with attribution retained.</p></div>
          </div>
        </Card>
        <Card title="Demo data"><ResetDemo /></Card>
      </div>
    </div>
  )
}
