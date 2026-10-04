'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useLive, sendCommand, fmtDur } from '@/lib/client/live'
import { Btn, Card, Kpi, PageHead, Pill, stateTone } from '@/components/app/ui'
import { LineChart } from '@/components/viz/charts'
import { CarouselMap } from '@/components/device/parts'

export default function DeviceDetail({ id }: { id: string }) {
  const { state, events } = useLive(id)
  const [err, setErr] = useState<string | null>(null)
  const d = state?.devices.find((x) => x.id === id)
  if (!state || !d) return <PageHead crumbs={[{ href: '/app', label: 'Overview' }, { href: '/app/devices', label: 'Instruments' }, { label: 'Instrument' }]} title="Instrument" sub="Loading…" />
  const run = state.runs.find((r) => r.id === d.activeRunId)
  const p = run && state.protocols.find((x) => x.id === run.protocolId)
  const env = run ? state.env[run.id] ?? [] : []
  const history = state.runs.filter((r) => r.deviceId === id)
  const act = async (c: Record<string, unknown>) => { setErr(null); try { await sendCommand(id, c) } catch (e) { setErr((e as Error).message) } }
  const latest = run ? state.latest[run.id] ?? [] : []

  return (
    <div>
      <PageHead crumbs={[{ href: '/app', label: 'Overview' }, { href: '/app/devices', label: 'Instruments' }, { label: d.name }]} eyebrow={`${d.model} · ${d.serial}`} title={d.name} sub={<span className="flex items-center gap-2"><Pill tone={stateTone(d.state)}>{d.state}</Pill>{d.location}{d.activity && <span>· {d.activity}</span>}</span>}>
        <Btn href={`/device?id=${d.id}`}>Open touchscreen ↗</Btn>
        {run?.state === 'incubating' && <Btn onClick={() => act({ type: 'capture_now' })}>Capture now</Btn>}
        {run?.state === 'incubating' && <Btn onClick={() => act({ type: 'pause' })}>Pause</Btn>}
        {run?.state === 'paused' && <Btn kind="primary" onClick={() => act({ type: 'resume' })}>Resume</Btn>}
      </PageHead>
      {err && <div className="mx-8 mt-4 rounded-lg bg-crit-50 px-4 py-2 text-[13px] text-crit">{err}</div>}
      {!d.online ? (
        <div className="p-8"><Card title="Offline"><p className="text-[14px]">Last check-in {new Date(d.lastSeen).toLocaleString('en-GB')}. The instrument keeps running its protocol locally and stores <b>{d.syncQueue}</b> records, which upload automatically when the network returns.</p></Card></div>
      ) : (
        <div className="space-y-6 p-5 sm:p-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Chamber" value={<>{d.telemetry.T.toFixed(2)}<span className="text-[16px] text-muted"> °C</span></>} sub={`Setpoint ${d.telemetry.setT} °C · ambient ${d.telemetry.ambientT} °C`} tone={Math.abs(d.telemetry.T - d.telemetry.setT) > 1 && run ? 'warn' : undefined} />
            <Kpi label="Humidity" value={<>{d.telemetry.RH.toFixed(1)}<span className="text-[16px] text-muted"> %</span></>} sub={`Setpoint ${d.telemetry.setRH} % · atomiser ${d.telemetry.mistPct.toFixed(0)} %`} />
            <Kpi label="Heat pump" value={<>{d.telemetry.tecPct.toFixed(0)}<span className="text-[16px] text-muted"> %</span></>} sub={d.telemetry.tecPct >= 0 ? 'Heating' : 'Cooling'} />
            <Kpi label="Door" value={d.doorOpen ? 'Open' : 'Closed'} tone={d.doorOpen && run?.state === 'incubating' ? 'warn' : undefined} sub={`Carousel at dish ${d.stationPos}`} />
          </div>
          <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
            <div className="space-y-6">
              {run && p && (
                <Card title="Active run" action={<Link href={`/app/runs/${run.id}`} className="text-[13px] font-medium text-blue">Open →</Link>}>
                  <div className="text-[16px] font-semibold">{run.name}</div>
                  <div className="mt-1 text-[13px] text-muted">{fmtDur(run.elapsedH)} of {p.durationH} h · {run.captures.length} image sets · every {p.captureEveryH} h</div>
                  <div className="mt-5"><div className="mb-1 text-[13px] font-medium">Temperature (°C) · live</div><LineChart series={[{ key: 'T', label: 'Chamber', color: '#2a78d6', points: env.map((e) => ({ x: e.h, y: e.T })) }]} band={{ from: d.telemetry.setT - 0.5, to: d.telemetry.setT + 0.5 }} yFormat={(v) => v.toFixed(1)} height={160} /></div>
                  <div className="mt-5"><div className="mb-1 text-[13px] font-medium">Relative humidity (%) · live</div><LineChart series={[{ key: 'RH', label: 'RH', color: '#2a78d6', points: env.map((e) => ({ x: e.h, y: e.RH })) }]} band={{ from: d.telemetry.setRH - 3, to: d.telemetry.setRH + 3 }} yFormat={(v) => v.toFixed(0)} height={160} /></div>
                </Card>
              )}
              <Card title="Run history" pad={false}>
                {history.map((r) => (
                  <Link key={r.id} href={`/app/runs/${r.id}`} className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-0 hover:bg-paper">
                    <span><span className="font-medium">{r.name}</span><span className="block font-mono text-[12px] text-muted">{r.startedAt ? new Date(r.startedAt).toLocaleDateString('en-GB') : 'not started'} · {r.elapsedH.toFixed(0)} h</span></span>
                    <Pill tone={stateTone(r.state)}>{r.state}</Pill>
                  </Link>
                ))}
              </Card>
            </div>
            <div className="space-y-6">
              <Card title="Carousel · live">
                <div className="flex justify-center rounded-xl bg-graphite py-4">
                  <CarouselMap angle={d.carouselAngle} size={320} dishes={[1, 2, 3, 4, 5, 6].map((pos) => ({ position: pos, state: run?.dishes.some((x) => x.position === pos) ? 'loaded' as const : 'empty' as const, latest: latest.find((l) => l.position === pos) }))} />
                </div>
              </Card>
              <Card title="Consumables & service">
                <dl className="space-y-3 text-[13px]">
                  {[['Humidifier reservoir', `${d.telemetry.reservoirPct.toFixed(0)} %`, d.telemetry.reservoirPct / 100], ['Label roll', `${d.printer.labelsLeft} labels`, d.printer.labelsLeft / 500], ['HEPA filter', `${d.telemetry.hepaHours.toFixed(0)} h`, null], ['UV-C cycles', String(d.telemetry.uvcCycles), null], ['Firmware', d.firmware, null], ['Simulation speed', `${d.speed}×`, null]].map(([k, v, f]) => (
                    <div key={k as string}>
                      <div className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="font-mono tabular">{v}</dd></div>
                      {typeof f === 'number' && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper"><div className={`h-full ${f < 0.2 ? 'bg-warn' : 'bg-blue'}`} style={{ width: `${Math.min(100, f * 100)}%` }} /></div>}
                    </div>
                  ))}
                </dl>
              </Card>
              <Card title="Event stream" pad={false}>
                <div className="max-h-72 overflow-y-auto">
                  {events.length ? events.map((e, i) => (
                    <div key={i} className="flex gap-3 border-b border-line px-5 py-2 font-mono text-[12px] last:border-0"><span className="text-muted tabular">{new Date(e.at).toLocaleTimeString('en-GB')}</span><span className="font-semibold">{e.type}</span><span className="truncate text-muted">{summarise(e.data)}</span></div>
                  )) : <div className="px-5 py-4 text-[13px] text-muted">Listening for events…</div>}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function summarise(d: unknown) {
  const x = d as { h?: number; barcode?: string; barcodes?: string[]; data?: { code?: string; action?: string; target?: string } }
  if (x.h !== undefined) return `capture at ${x.h.toFixed(1)} h`
  if (x.barcode) return x.barcode
  if (x.barcodes) return x.barcodes.join(', ')
  if (x.data?.code) return x.data.code
  if (x.data?.action) return `${x.data.action} ${x.data.target}`
  return ''
}
