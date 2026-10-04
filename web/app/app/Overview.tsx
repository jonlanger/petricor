'use client'
import Link from 'next/link'
import { useLive, fmtDur } from '@/lib/client/live'
import { Card, Kpi, PageHead, Pill, stateTone, Btn } from '@/components/app/ui'
import PlateCanvas from '@/components/viz/PlateCanvas'
import { Sparkline } from '@/components/viz/charts'
import { shortName, speciesColor } from '@/lib/viz/speciesColor'

export default function Overview() {
  const { state, connected } = useLive()
  if (!state) return <PageHead title="Overview" sub="Loading…" />
  const online = state.devices.filter((d) => d.online)
  const active = state.runs.filter((r) => ['incubating', 'paused'].includes(r.state))
  const review = state.runs.filter((r) => r.state === 'complete' && r.review.status === 'pending')
  const alerts = state.alerts.filter((a) => !a.ackAt)
  const user = (id: string) => state.users.find((u) => u.id === id)

  return (
    <div>
      <PageHead eyebrow="Demo Microbiology Lab" title="Overview" sub={<span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${connected ? 'bg-ok' : 'bg-warn'}`} />{connected ? 'Live — streaming from instruments' : 'Reconnecting…'}</span>}>
        <Btn href="/device" kind="primary">Open PC-6 touchscreen ↗</Btn>
      </PageHead>
      <div className="space-y-6 p-5 sm:p-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Instruments online" value={`${online.length}/${state.devices.length}`} sub={state.devices.filter((d) => !d.online).map((d) => `${d.name} offline`).join(', ') || 'All reporting'} tone={online.length < state.devices.length ? 'warn' : undefined} />
          <Kpi label="Runs incubating" value={active.length} sub={active.map((r) => r.name).join(' · ') || '—'} />
          <Kpi label="Awaiting review" value={review.length} sub="Completed runs pending sign-off" tone={review.length ? 'warn' : undefined} />
          <Kpi label="Open alerts" value={alerts.length} sub={alerts[0]?.code.replace('_', ' ').toLowerCase() ?? 'None'} tone={alerts.some((a) => a.level === 'critical') ? 'crit' : alerts.length ? 'warn' : undefined} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            {active.map((r) => {
              const d = state.devices.find((x) => x.id === r.deviceId)!
              const p = state.protocols.find((x) => x.id === r.protocolId)!
              const latest = state.latest[r.id] ?? []
              const env = state.env[r.id] ?? []
              return (
                <Card key={r.id} title={<>Live run · {d.name}</>} action={<Link href={`/app/runs/${r.id}`} className="text-[13px] font-medium text-blue">Open run →</Link>}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-[18px] font-semibold">{r.name}</div>
                      <div className="mt-1 text-[13px] text-muted">{p.name} · {p.medium} · {user(r.operatorId)?.name}</div>
                    </div>
                    <div className="flex items-center gap-2"><Pill tone={stateTone(d.state)}>{d.state}</Pill>{d.activity && <span className="text-[12px] text-muted">{d.activity}</span>}</div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-blue transition-[width] duration-700" style={{ width: `${(r.elapsedH / p.durationH) * 100}%` }} /></div>
                  <div className="mt-1.5 flex justify-between font-mono text-[12px] text-muted tabular"><span>{fmtDur(r.elapsedH)} elapsed</span><span>{fmtDur(Math.max(0, p.durationH - r.elapsedH))} left · {r.captures.length} image sets</span></div>
                  <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
                    {r.dishes.map((dish) => {
                      const l = latest.find((x) => x.position === dish.position)
                      const s = state.samples.find((x) => x.id === dish.sampleId)
                      return (
                        <Link key={dish.position} href={`/app/runs/${r.id}?dish=${dish.position}`} className="group">
                          <div className="rounded-full bg-graphite p-1 transition-transform group-hover:scale-[1.03]">
                            <PlateCanvas colonies={l?.colonies ?? []} resolution={180} />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[12px]"><span className="font-mono text-muted">#{dish.position}</span><span className="font-mono font-semibold tabular">{l?.count ?? 0}</span></div>
                          <div className="truncate text-[12px] text-ink/70" title={s?.label}>{s?.label}</div>
                        </Link>
                      )
                    })}
                  </div>
                  <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3">
                      <div><div className="eyebrow">Chamber temperature</div><div className="font-mono text-[22px] font-semibold tabular">{d.telemetry.T.toFixed(2)} <span className="text-[14px] text-muted">°C / set {d.telemetry.setT}</span></div></div>
                      <Sparkline values={env.slice(-200).map((e) => e.T)} band={[d.telemetry.setT - 0.5, d.telemetry.setT + 0.5]} width={140} height={34} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div><div className="eyebrow">Relative humidity</div><div className="font-mono text-[22px] font-semibold tabular">{d.telemetry.RH.toFixed(1)} <span className="text-[14px] text-muted">% / set {d.telemetry.setRH}</span></div></div>
                      <Sparkline values={env.slice(-200).map((e) => e.RH)} band={[d.telemetry.setRH - 3, d.telemetry.setRH + 3]} width={140} height={34} />
                    </div>
                  </div>
                </Card>
              )
            })}

            <Card title="Instruments" pad={false}>
              <div className="divide-y divide-line">
                {state.devices.map((d) => (
                  <Link key={d.id} href={`/app/devices/${d.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5 hover:bg-paper">
                    <div className="min-w-[180px] flex-1"><div className="font-medium">{d.name}</div><div className="font-mono text-[12px] text-muted">{d.serial} · {d.location}</div></div>
                    <Pill tone={stateTone(d.state)}>{d.state}</Pill>
                    <div className="w-28 font-mono text-[13px] tabular">{d.online ? `${d.telemetry.T.toFixed(1)} °C · ${d.telemetry.RH.toFixed(0)}%` : '—'}</div>
                    <div className="w-40 text-[12px] text-muted">{d.online ? `Reservoir ${d.telemetry.reservoirPct.toFixed(0)} %` : `Last seen ${new Date(d.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${d.syncQueue} queued`}</div>
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Review queue" pad={false}>
              {review.length ? review.map((r) => {
                const totals: Record<string, number> = {}
                return (
                  <Link key={r.id} href={`/app/runs/${r.id}`} className="block border-b border-line px-5 py-4 last:border-0 hover:bg-paper">
                    <div className="flex items-center justify-between gap-2"><div className="font-medium">{r.name}</div><Pill tone="warn">pending</Pill></div>
                    <div className="mt-1 text-[12.5px] text-muted">Completed {r.completedAt ? new Date(r.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''} · {r.dishes.length} dishes · {user(r.operatorId)?.name}</div>
                    {Object.keys(totals).length > 0 && <div />}
                  </Link>
                )
              }) : <div className="px-5 py-6 text-[13px] text-muted">Nothing waiting for sign-off.</div>}
            </Card>
            <Card title="Alerts" pad={false}>
              {alerts.length ? alerts.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-start gap-3 border-b border-line px-5 py-3 last:border-0">
                  <Pill tone={a.level === 'critical' ? 'crit' : a.level === 'warning' ? 'warn' : 'blue'}>{a.level}</Pill>
                  <div className="min-w-0 flex-1 text-[13px]"><div className="font-mono text-[12px] font-semibold">{a.code}</div><div className="text-ink/75">{a.text}</div></div>
                  <button onClick={() => fetch(`/api/alerts/${a.id}`, { method: 'POST' })} className="text-[12px] font-medium text-blue">Ack</button>
                </div>
              )) : <div className="px-5 py-6 text-[13px] text-muted">No open alerts.</div>}
            </Card>
            <Card title="Presumptive IDs · live runs">
              {(() => {
                const m: Record<string, number> = {}
                for (const r of active) for (const l of state.latest[r.id] ?? []) for (const [k, n] of Object.entries(l.bySpecies)) m[k] = (m[k] ?? 0) + n
                const rows = Object.entries(m).sort((a, b) => b[1] - a[1])
                const max = Math.max(1, ...rows.map((r) => r[1]))
                return rows.length ? (
                  <div className="space-y-2.5">
                    {rows.map(([k, n]) => (
                      <div key={k} className="grid grid-cols-[9rem_1fr] items-center gap-3 text-[12.5px]">
                        <span className="flex items-center gap-2 truncate italic"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: speciesColor(k) }} />{shortName(k)}</span>
                        <span className="flex items-center gap-2"><span className="h-2.5 rounded-r-[4px]" style={{ width: `${(n / max) * 100}%`, background: speciesColor(k) }} /><span className="font-mono tabular text-muted">{n}</span></span>
                      </div>
                    ))}
                    <p className="pt-2 text-[11.5px] text-muted">Counts of colonies by top presumptive ID. The identification model in this demo is simulated.</p>
                  </div>
                ) : <div className="text-[13px] text-muted">No colonies detected yet.</div>
              })()}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
