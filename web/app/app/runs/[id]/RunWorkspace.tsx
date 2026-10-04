'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { Channel, Device, Protocol, Sample, User } from '@/lib/domain/types'
import type { RunSummary } from '@/lib/client/live'
import type { ObservationBundle, ColonyRow } from '@/lib/server/pipeline'
import type { EnvSample } from '@/lib/science/cmi'
import PlateCanvas from '@/components/viz/PlateCanvas'
import { LineChart, type Series } from '@/components/viz/charts'
import { Btn, Card, PageHead, Pill, stateTone } from '@/components/app/ui'
import { shortName, speciesColor } from '@/lib/viz/speciesColor'
import { SPECIES_BY_KEY } from '@/lib/science/species'

type Obs = ObservationBundle & { env: EnvSample[]; elapsedH: number; state: string }
const CH: Record<Channel, string> = { white: 'White', transillum: 'Backlit', uv365: 'UV 365 nm', ir850: 'NIR 850 nm' }

export default function RunWorkspace({ run, protocol, device, samples, users, canReview, initialDish }: {
  run: RunSummary; protocol: Protocol; device: Device; samples: Sample[]; users: User[]; canReview: boolean; initialDish: number
}) {
  const [obs, setObs] = useState<Obs | null>(null)
  const [dish, setDish] = useState(initialDish)
  const [frame, setFrame] = useState<number | null>(null)
  const [channel, setChannel] = useState<Channel>('white')
  const [overlay, setOverlay] = useState<'none' | 'outline' | 'label'>('label')
  const [sel, setSel] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [tab, setTab] = useState<'colonies' | 'growth' | 'environment' | 'sample'>('colonies')
  const [view, setView] = useState<'dish' | 'compare'>('dish')
  const [review, setReview] = useState(run.review)
  const [note, setNote] = useState('')
  const live = run.state === 'incubating' || run.state === 'paused'

  useEffect(() => {
    let alive = true
    const load = async () => {
      const r = await fetch(`/api/runs/${run.id}/observations`, { cache: 'no-store' })
      if (r.ok && alive) setObs(await r.json())
    }
    load()
    const iv = live ? setInterval(load, 5000) : undefined
    return () => { alive = false; if (iv) clearInterval(iv) }
  }, [run.id, live])

  const nFrames = obs?.captures.length ?? 0
  const fi = frame === null ? nFrames - 1 : Math.min(frame, nFrames - 1)
  const h = obs?.captures[fi] ?? 0
  const dObs = obs?.dishes.find((d) => d.position === dish)
  const fr = dObs?.frames[fi]
  const colonies = useMemo(() => (fr?.colonies ?? []).map(rowToCol), [fr])

  // playback
  const tRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!playing) return
    tRef.current = setInterval(() => setFrame((f) => { const n = (f ?? 0) + 1; if (n >= nFrames) { setPlaying(false); return nFrames - 1 } return n }), 220)
    return () => { if (tRef.current) clearInterval(tRef.current) }
  }, [playing, nFrames])

  const sample = samples.find((s) => s.id === run.dishes.find((d) => d.position === dish)?.sampleId)
  const selRow = colonies.find((c) => c.id === sel)

  const growthSeries: Series[] = useMemo(() => {
    if (!dObs) return []
    const last = dObs.frames[dObs.frames.length - 1]?.colonies ?? []
    const top = [...last].sort((a, b) => b[3] - a[3]).slice(0, 8)
    return top.map((row) => ({
      key: row[0], label: `${shortName(row[4])} · ${row[0].slice(-3)}`, color: speciesColor(row[4]),
      points: dObs.frames.map((f) => ({ x: f.h, y: 2 * (f.colonies.find((c) => c[0] === row[0])?.[3] ?? 0) })),
    }))
  }, [dObs])

  const countSeries: Series[] = useMemo(() => dObs ? [{ key: 'n', label: 'Colonies', color: '#2a78d6', points: dObs.frames.map((f) => ({ x: f.h, y: f.colonies.length })) }] : [], [dObs])
  const env = obs?.env ?? []
  const envStep = Math.max(1, Math.floor(env.length / 500))
  const tSeries: Series[] = [{ key: 'T', label: 'Chamber °C', color: '#2a78d6', points: env.filter((_, i) => i % envStep === 0).map((e) => ({ x: e.h, y: e.T })) }]
  const rhSeries: Series[] = [{ key: 'RH', label: 'RH %', color: '#2a78d6', points: env.filter((_, i) => i % envStep === 0).map((e) => ({ x: e.h, y: e.RH })) }]

  const submitReview = async (status: 'approved' | 'changes') => {
    const r = await fetch(`/api/runs/${run.id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, note }) })
    const j = await r.json()
    if (r.ok) setReview(j.review)
    else alert(j.error)
  }
  const who = (id?: string) => users.find((u) => u.id === id)?.name ?? id

  return (
    <div>
      <PageHead crumbs={[{ href: '/app', label: 'Overview' }, { href: '/app/runs', label: 'Runs' }, { label: run.name }]} eyebrow={<>{protocol.name} · {device.name}</>} title={run.name}
        sub={<span className="flex flex-wrap items-center gap-2"><Pill tone={stateTone(run.state)}>{run.state}</Pill>{run.state === 'complete' && <Pill tone={stateTone(review.status)}>review: {review.status}</Pill>}<span>{protocol.medium} · {protocol.tempC} °C · {protocol.rh}% RH · image every {protocol.captureEveryH} h · operator {who(run.operatorId)}</span></span>}>
        <Btn href={`/api/runs/${run.id}/export?format=csv`}>Export CSV</Btn>
        <Btn href={`/api/runs/${run.id}/export?format=json`}>JSON</Btn>
        <Btn href={`/app/runs/${run.id}/report`} kind="primary">Report</Btn>
      </PageHead>

      <div className="grid gap-6 p-5 sm:p-8 2xl:grid-cols-[minmax(0,1fr)_480px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-line bg-white p-0.5">
              {(['dish', 'compare'] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 text-[13px] capitalize ${view === v ? 'bg-ink text-white' : 'text-ink/70'}`}>{v === 'dish' ? 'Single dish' : 'All six'}</button>)}
            </div>
            <div className="flex rounded-lg border border-line bg-white p-0.5">
              {protocol.channels.concat((['white', 'transillum', 'uv365', 'ir850'] as Channel[]).filter((c) => !protocol.channels.includes(c))).map((c) => (
                <button key={c} disabled={!protocol.channels.includes(c)} onClick={() => setChannel(c)} title={protocol.channels.includes(c) ? '' : 'Not captured by this protocol'}
                  className={`rounded-md px-3 py-1.5 text-[13px] disabled:opacity-30 ${channel === c ? 'bg-blue text-white' : 'text-ink/70'}`}>{CH[c]}</button>
              ))}
            </div>
            <div className="flex rounded-lg border border-line bg-white p-0.5">
              {(['none', 'outline', 'label'] as const).map((o) => <button key={o} onClick={() => setOverlay(o)} className={`rounded-md px-3 py-1.5 text-[13px] capitalize ${overlay === o ? 'bg-ink text-white' : 'text-ink/70'}`}>{o === 'none' ? 'Raw' : o === 'outline' ? 'Detections' : 'Labels'}</button>)}
            </div>
            <span className="ml-auto font-mono text-[12px] text-muted">Simulated capture · procedural rendering</span>
          </div>

          <div className="overflow-hidden rounded-2xl bg-graphite">
            {view === 'dish' ? (
              <div className="grid gap-0 md:grid-cols-[88px_1fr]">
                <div className="flex gap-2 overflow-x-auto p-3 md:flex-col md:overflow-visible">
                  {run.dishes.map((d) => {
                    const f = obs?.dishes.find((x) => x.position === d.position)?.frames[fi]
                    return (
                      <button key={d.position} onClick={() => { setDish(d.position); setSel(null) }} className={`relative w-16 shrink-0 rounded-full p-0.5 ${dish === d.position ? 'ring-2 ring-blue' : 'opacity-70 hover:opacity-100'}`}>
                        <PlateCanvas colonies={(f?.colonies ?? []).map(rowToCol)} resolution={96} />
                        <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-ink font-mono text-[10px] text-white">{d.position}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="relative flex items-center justify-center p-4 sm:p-6">
                  <PlateCanvas colonies={colonies} channel={channel} resolution={620} overlay={overlay} selected={sel} onSelect={setSel} className="w-full max-w-[620px]" showScale />
                  <div className="absolute left-5 top-5 font-mono text-white">
                    <div className="text-[11px] uppercase tracking-wider text-white/50">Dish {dish} · {sample?.barcode}</div>
                    <div className="text-[28px] font-semibold tabular">{h.toFixed(1)} h</div>
                    <div className="text-[12px] text-white/60">{colonies.length} colonies · {((fr?.coverage ?? 0) * 100).toFixed(1)} % covered</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
                {run.dishes.map((d) => {
                  const f = obs?.dishes.find((x) => x.position === d.position)?.frames[fi]
                  const s = samples.find((x) => x.id === d.sampleId)
                  return (
                    <button key={d.position} onClick={() => { setDish(d.position); setView('dish') }} className="text-left">
                      <PlateCanvas colonies={(f?.colonies ?? []).map(rowToCol)} channel={channel} resolution={300} overlay={overlay === 'none' ? 'none' : 'outline'} />
                      <div className="mt-2 flex justify-between font-mono text-[12px] text-white/70"><span>#{d.position} {s?.label}</span><span className="tabular">{f?.colonies.length ?? 0}</span></div>
                    </button>
                  )
                })}
              </div>
            )}
            <div className="border-t border-white/10 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <button onClick={() => { if (fi >= nFrames - 1) setFrame(0); setPlaying((p) => !p) }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-ink">{playing ? '❚❚' : '▶'}</button>
                <input type="range" min={0} max={Math.max(0, nFrames - 1)} value={Math.max(0, fi)} onChange={(e) => { setPlaying(false); setFrame(+e.target.value) }} className="w-full accent-[#3a44ff]" aria-label="Capture" />
                <span className="w-28 shrink-0 text-right font-mono text-[12px] text-white/70 tabular">{fi + 1}/{nFrames} · {h.toFixed(0)} h</span>
                {live && <button onClick={() => setFrame(null)} className={`shrink-0 rounded-md px-2 py-1 font-mono text-[11px] ${frame === null ? 'bg-ok text-white' : 'bg-white/10 text-white/70'}`}>LIVE</button>}
              </div>
            </div>
          </div>
          <p className="text-[12px] text-muted">Captures are rendered from the imaging pipeline&apos;s colony records (position, size, presumptive ID). Growth follows the Cardinal Model with Inflection on the logged chamber temperature. Identification confidence comes from a simulated classifier.</p>
        </div>

        <div className="min-w-0 space-y-6">
          <div className="card">
            <div className="flex border-b border-line">
              {(['colonies', 'growth', 'environment', 'sample'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`flex-1 border-b-2 px-3 py-3 text-[13px] font-medium capitalize ${tab === t ? 'border-blue text-blue' : 'border-transparent text-muted hover:text-ink'}`}>{t}</button>)}
            </div>
            <div className="p-5">
              {tab === 'colonies' && (
                <div>
                  {selRow && <ColonyDetail c={selRow} dObs={dObs} onClose={() => setSel(null)} />}
                  <table className="w-full text-[12.5px]">
                    <thead className="text-left text-[11px] uppercase tracking-wider text-muted"><tr><th className="pb-2 font-mono font-medium">ID</th><th className="pb-2 font-mono font-medium">Presumptive</th><th className="pb-2 text-right font-mono font-medium">⌀ mm</th><th className="pb-2 text-right font-mono font-medium">Conf.</th><th className="pb-2 text-right font-mono font-medium">Seen</th></tr></thead>
                    <tbody className="divide-y divide-line">
                      {[...colonies].sort((a, b) => b.r - a.r).map((c) => (
                        <tr key={c.id} onClick={() => setSel(c.id)} className={`cursor-pointer ${sel === c.id ? 'bg-blue-50' : 'hover:bg-paper'}`}>
                          <td className="py-2 font-mono text-muted">{c.id.slice(-4)}</td>
                          <td className="py-2"><span className="inline-flex items-center gap-2 italic"><span className="h-2 w-2 rounded-full" style={{ background: speciesColor(c.key) }} />{shortName(c.key)}</span></td>
                          <td className="py-2 text-right font-mono tabular">{(c.r * 2).toFixed(1)}</td>
                          <td className="py-2 text-right font-mono tabular">{Math.round(c.p * 100)}%</td>
                          <td className="py-2 text-right font-mono tabular text-muted">{c.first.toFixed(0)} h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!colonies.length && <div className="py-6 text-center text-[13px] text-muted">No colonies detected at this time-point.</div>}
                </div>
              )}
              {tab === 'growth' && (
                <div className="space-y-6">
                  <div><div className="mb-2 text-[13px] font-medium">Colony diameter (mm) · largest 8</div><LineChart series={growthSeries} yFormat={(v) => v.toFixed(0)} marker={h} onScrub={(x) => setFrame(nearestIdx(obs?.captures ?? [], x))} height={220} /></div>
                  <div><div className="mb-2 text-[13px] font-medium">Colonies detected</div><LineChart series={countSeries} yFormat={(v) => v.toFixed(0)} marker={h} onScrub={(x) => setFrame(nearestIdx(obs?.captures ?? [], x))} height={150} /></div>
                </div>
              )}
              {tab === 'environment' && (
                <div className="space-y-6">
                  <div><div className="mb-2 text-[13px] font-medium">Chamber temperature (°C) <span className="text-muted">· band = setpoint ± 0.5</span></div><LineChart series={tSeries} band={{ from: protocol.tempC - 0.5, to: protocol.tempC + 0.5 }} yFormat={(v) => v.toFixed(1)} marker={h} height={170} /></div>
                  <div><div className="mb-2 text-[13px] font-medium">Relative humidity (%) <span className="text-muted">· band = setpoint ± 3</span></div><LineChart series={rhSeries} band={{ from: protocol.rh - 3, to: protocol.rh + 3 }} yFormat={(v) => v.toFixed(0)} marker={h} height={170} /></div>
                  <div className="space-y-1.5">{run.events.map((e, i) => <div key={i} className="flex gap-3 text-[12.5px]"><span className="w-14 font-mono text-muted tabular">{e.h.toFixed(1)} h</span><span>{e.text}</span></div>)}</div>
                </div>
              )}
              {tab === 'sample' && sample && (
                <div className="space-y-4 text-[13px]">
                  <div><div className="eyebrow">Sample</div><div className="mt-1 text-[16px] font-semibold">{sample.label}</div><div className="font-mono text-[12px] text-muted">{sample.barcode} · {sample.source} · {sample.location}</div></div>
                  <div><div className="eyebrow mb-2">Chain of custody</div>
                    <ol className="relative space-y-3 border-l border-line pl-4">
                      {sample.custody.map((c, i) => <li key={i}><div className="absolute -left-[4.5px] mt-1.5 h-2 w-2 rounded-full bg-blue" /><div className="font-medium">{c.event}</div><div className="text-[12px] text-muted">{new Date(c.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {who(c.by)}</div></li>)}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Card title="Review & sign-off">
            {run.state !== 'complete' ? <p className="text-[13px] text-muted">Available once incubation completes.</p> : review.status !== 'pending' ? (
              <div className="text-[13px]"><Pill tone={stateTone(review.status)}>{review.status === 'approved' ? 'Approved' : 'Changes requested'}</Pill><p className="mt-2">{review.note}</p><p className="mt-1 text-muted">{who(review.by)} · {review.at && new Date(review.at).toLocaleString('en-GB')}</p></div>
            ) : canReview ? (
              <div className="space-y-3">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Review note (recorded in the audit trail)" className="h-20 w-full rounded-lg border border-line p-3 text-[13px] outline-none focus:border-blue" />
                <div className="flex gap-2"><Btn kind="primary" onClick={() => submitReview('approved')}>Approve results</Btn><Btn kind="danger" onClick={() => submitReview('changes')}>Request changes</Btn></div>
              </div>
            ) : <p className="text-[13px] text-muted">Your role can view but not sign off results.</p>}
          </Card>
        </div>
      </div>
    </div>
  )
}

interface Col { id: string; x: number; y: number; r: number; key: string; p: number; alts: { key: string; p: number }[]; first: number }
function rowToCol(r: ColonyRow): Col { return { id: r[0], x: r[1], y: r[2], r: r[3], key: r[4], p: r[5], alts: [{ key: r[6], p: r[7] }, { key: r[8], p: r[9] }], first: r[10] } }
function nearestIdx(xs: number[], x: number) { let b = 0; xs.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(xs[b] - x)) b = i }); return b }

function ColonyDetail({ c, dObs, onClose }: { c: Col; dObs?: ObservationBundle['dishes'][number]; onClose: () => void }) {
  const sp = SPECIES_BY_KEY[c.key]
  const pts = dObs?.frames.map((f) => ({ x: f.h, y: 2 * (f.colonies.find((k) => k[0] === c.id)?.[3] ?? 0) })) ?? []
  const grow = pts.filter((p) => p.y > 0)
  const rate = grow.length > 3 ? (grow[grow.length - 1].y - grow[Math.floor(grow.length / 2)].y) / 2 / Math.max(1e-6, grow[grow.length - 1].x - grow[Math.floor(grow.length / 2)].x) : 0
  return (
    <div className="mb-5 rounded-xl border border-blue/30 bg-blue-50/50 p-4">
      <div className="flex items-start justify-between">
        <div><div className="font-mono text-[11px] text-muted">Colony {c.id}</div><div className="text-[16px] font-semibold italic">{sp?.name}</div></div>
        <button onClick={onClose} className="text-muted">✕</button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 font-mono text-[12px]">
        <div><div className="text-muted">Diameter</div><div className="text-[16px] font-semibold tabular">{(c.r * 2).toFixed(2)} mm</div></div>
        <div><div className="text-muted">Radial rate</div><div className="text-[16px] font-semibold tabular">{(rate * 24).toFixed(2)} mm/d</div></div>
        <div><div className="text-muted">Position</div><div className="text-[16px] font-semibold tabular">{c.x.toFixed(0)}, {c.y.toFixed(0)}</div></div>
      </div>
      <div className="mt-3 space-y-1 text-[12px]">
        {[{ key: c.key, p: c.p }, ...c.alts].filter((g) => g.key).map((g) => (
          <div key={g.key} className="flex items-center gap-2"><span className="w-40 truncate italic">{SPECIES_BY_KEY[g.key]?.name}</span><span className="h-1.5 flex-1 rounded-full bg-white"><span className="block h-full rounded-full bg-blue" style={{ width: `${g.p * 100}%` }} /></span><span className="w-10 text-right font-mono tabular">{Math.round(g.p * 100)}%</span></div>
        ))}
      </div>
      <div className="mt-3"><LineChart series={[{ key: 'd', label: 'Diameter mm', color: speciesColor(c.key), points: pts }]} height={120} yFormat={(v) => v.toFixed(0)} /></div>
      <Link href={`/app/species/${c.key}`} className="mt-2 inline-block text-[12.5px] font-medium text-blue">Species reference & growth model →</Link>
    </div>
  )
}
