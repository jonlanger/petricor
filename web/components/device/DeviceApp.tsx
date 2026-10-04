'use client'
import { useEffect, useMemo, useState } from 'react'
import { useLive, sendCommand, fmtDur, type LiveState, type RunSummary } from '@/lib/client/live'
import type { Device, SourceType, User } from '@/lib/domain/types'
import { Btn, CarouselMap, Chip, Stat, Stepper } from './parts'
import { Sparkline } from '@/components/viz/charts'
import PlateCanvas from '@/components/viz/PlateCanvas'
import { shortName, speciesColor } from '@/lib/viz/speciesColor'
import { SPECIES } from '@/lib/science/species'
import Logo from '@/components/brand/Logo'

type Screen = 'home' | 'wizard' | 'run' | 'maintenance'

export default function DeviceApp({ deviceId, onState, operator }: { deviceId: string; onState?: (s: LiveState | null) => void; operator?: string }) {
  const { state, connected } = useLive(deviceId)
  const [picked, setPicked] = useState<User | null>(null)
  const [locked, setLocked] = useState(false)
  const [maint, setMaint] = useState(false)
  const [wantWizard, setWantWizard] = useState(false)
  const [toast, setToast] = useState<{ text: string; tone: 'crit' | 'ok' } | null>(null)
  useEffect(() => { onState?.(state) }, [state, onState])

  const d = state?.devices.find((x) => x.id === deviceId)
  const run = state?.runs.find((r) => r.id === d?.activeRunId)
  // kiosk demos can pre-select an operator (?operator=u_emily) until someone locks the screen
  const user = picked ?? (!locked && operator ? state?.users.find((u) => u.id === operator) ?? null : null)
  // the machine state decides the screen; the operator can only add the service view or start the wizard
  const screen: Screen = !d ? 'home'
    : maint ? 'maintenance'
    : ['preparing', 'loading', 'ready'].includes(d.state) || (wantWizard && d.state === 'idle') ? 'wizard'
    : ['incubating', 'imaging', 'paused', 'complete'].includes(d.state) && run ? 'run'
    : 'home'

  const cmd = async (c: Record<string, unknown>) => {
    try {
      const r = await sendCommand(deviceId, { operatorId: user?.id, ...c })
      return r
    } catch (e) {
      setToast({ text: (e as Error).message, tone: 'crit' })
      setTimeout(() => setToast(null), 3500)
    }
  }

  if (!state || !d) return <div className="grid h-full place-items-center bg-graphite font-mono text-white/40">Connecting to PC-6…</div>

  return (
    <div className="relative flex h-full flex-col bg-graphite text-white">
      <TopBar d={d} user={user} connected={connected} onLock={() => { setPicked(null); setLocked(true); setMaint(false) }} alerts={state.alerts.filter((a) => !a.ackAt).length} onMaint={() => setMaint((m) => !m)} />
      <div className="relative min-h-0 flex-1">
        {!user ? (
          <Lock users={state.users} onPick={setPicked} d={d} />
        ) : screen === 'maintenance' ? (
          <Maintenance d={d} cmd={cmd} onBack={() => setMaint(false)} />
        ) : screen === 'wizard' ? (
          <Wizard d={d} run={run} state={state} user={user} cmd={cmd} onBack={() => setWantWizard(false)} />
        ) : screen === 'run' && run ? (
          <RunScreen d={d} run={run} state={state} cmd={cmd} />
        ) : (
          <Home d={d} state={state} user={user} cmd={cmd} onNew={() => setWantWizard(true)} />
        )}
      </div>
      {toast && (
        <div className="absolute bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-crit px-5 py-3 font-mono text-[15px] text-white shadow-2xl">{toast.text}</div>
      )}
      {state.alerts.filter((a) => !a.ackAt && a.level !== 'info' && a.deviceId === deviceId).slice(0, 1).map((a) => (
        <div key={a.id} className={`absolute left-6 right-6 top-[68px] z-40 flex items-center gap-3 rounded-xl px-5 py-3 font-mono text-[14px] ${a.level === 'critical' ? 'bg-crit text-white' : 'bg-warn text-ink'}`}>
          <span className="font-bold">{a.code.replace('_', ' ')}</span><span className="opacity-80">{a.text}</span>
        </div>
      ))}
    </div>
  )
}

function simTime(d: Device) {
  return new Date(d.simClock).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function TopBar({ d, user, connected, onLock, alerts, onMaint }: { d: Device; user: User | null; connected: boolean; onLock: () => void; alerts: number; onMaint: () => void }) {
  const stateTone = { incubating: 'blue', imaging: 'blue', idle: 'mute', complete: 'ok', paused: 'warn', error: 'crit', decontaminating: 'blue' } as Record<string, 'blue' | 'mute' | 'ok' | 'warn' | 'crit'>
  return (
    <div className="flex h-[60px] shrink-0 items-center gap-4 border-b border-white/[0.06] px-6">
      <Logo className="h-6" inverted />
      <span className="font-mono text-[13px] text-white/40">{d.name} · {d.serial}</span>
      <Chip tone={stateTone[d.state] ?? 'blue'} pulse={d.state === 'imaging'}>{d.state === 'imaging' ? 'Imaging' : d.state[0].toUpperCase() + d.state.slice(1)}</Chip>
      {d.activity && <span className="truncate font-mono text-[13px] text-white/60">{d.activity}</span>}
      <div className="ml-auto flex items-center gap-4 font-mono text-[13px]">
        <span className={connected ? 'text-[#5fe08e]' : 'text-[#ffc266]'}>{connected ? '● Cloud sync' : '○ Offline — queued'}</span>
        {alerts > 0 && <span className="rounded-md bg-warn/20 px-2 py-1 text-[#ffc266]">{alerts} alert{alerts > 1 ? 's' : ''}</span>}
        <button onClick={onMaint} className="rounded-md px-2 py-1 text-white/60 hover:bg-white/5">⚙ Service</button>
        <span className="tabular text-white/80">{simTime(d)}</span>
        {user && (
          <button onClick={onLock} className="flex items-center gap-2 rounded-full bg-white/5 py-1 pl-1 pr-3 hover:bg-white/10">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-blue text-[11px] font-bold">{user.initials}</span>
            <span className="text-white/70">Lock</span>
          </button>
        )}
      </div>
    </div>
  )
}

function Lock({ users, onPick, d }: { users: User[]; onPick: (u: User) => void; d: Device }) {
  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col justify-center pl-16">
        <div className="font-mono text-[15px] text-white/40">{new Date(d.simClock).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <div className="mt-2 font-mono text-[120px] font-semibold leading-none tracking-tighter tabular">{simTime(d)}</div>
        <div className="mt-8 flex gap-10">
          <Stat label="Chamber" value={d.telemetry.T.toFixed(1)} unit="°C" />
          <Stat label="Humidity" value={d.telemetry.RH.toFixed(0)} unit="% RH" />
        </div>
      </div>
      <div className="flex w-[480px] flex-col justify-center gap-3 border-l border-white/[0.06] px-12">
        <div className="font-mono text-[22px] font-semibold">Tap your badge</div>
        <div className="mb-3 text-[15px] text-white/50">Hold your ID to the side reader, or choose your profile.</div>
        {users.map((u) => (
          <button key={u.id} onClick={() => onPick(u)} className="flex items-center gap-4 rounded-xl bg-white/[0.04] px-4 py-3 text-left ring-1 ring-inset ring-white/[0.06] hover:bg-white/[0.08]">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-blue font-mono text-[14px] font-bold">{u.initials}</span>
            <span><span className="block text-[16px] font-medium">{u.name}</span><span className="block font-mono text-[12px] text-white/40">{u.title} · badge {u.badge}</span></span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Home({ d, state, user, cmd, onNew }: { d: Device; state: LiveState; user: User; cmd: (c: Record<string, unknown>) => Promise<unknown>; onNew: () => void }) {
  const recent = state.runs.filter((r) => r.state === 'complete').slice(0, 3)
  const decont = d.state === 'decontaminating'
  return (
    <div className="grid h-full grid-cols-[1fr_420px] gap-10 p-10">
      <div className="flex flex-col">
        <div className="font-mono text-[14px] text-white/40">Good {new Date(d.simClock).getHours() < 12 ? 'morning' : 'afternoon'}, {user.name.split(' ').slice(-2, -1)[0] ?? user.name}</div>
        <h1 className="mt-2 whitespace-pre-line font-mono text-[52px] font-semibold leading-[1.02] tracking-tight">{decont ? 'UV-C decontamination\nin progress' : d.activity ?? 'Chamber ready for\na new run'}</h1>
        {decont && <UvcProgress d={d} className="mt-7 w-[560px]" />}
        <div className="mt-10 flex gap-12">
          <Stat label="Chamber" value={d.telemetry.T.toFixed(1)} unit="°C" sub={`Ambient ${d.telemetry.ambientT} °C`} />
          <Stat label="Humidity" value={d.telemetry.RH.toFixed(0)} unit="%" sub={`Reservoir ${d.telemetry.reservoirPct.toFixed(0)} %`} />
          <Stat label="Labels" value={String(d.printer.labelsLeft)} sub="on roll" />
        </div>
        <div className="mt-auto flex gap-3">
          <Btn big onClick={onNew} disabled={decont}>＋ New run</Btn>
          <Btn big kind="ghost" disabled={decont || d.doorOpen} onClick={() => cmd({ type: 'decontaminate' })}>UV-C cycle</Btn>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <CarouselMap angle={d.carouselAngle} size={380} dishes={[1, 2, 3, 4, 5, 6].map((p) => ({ position: p, state: 'empty' as const }))} />
        <div className="font-mono text-[12px] uppercase tracking-wider text-white/40">Recent runs</div>
        {recent.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3">
            <div className="truncate text-[14px]">{r.name}</div>
            <Chip tone={r.review.status === 'approved' ? 'ok' : 'warn'}>{r.review.status === 'approved' ? 'Approved' : 'In review'}</Chip>
          </div>
        ))}
      </div>
    </div>
  )
}

const STEPS = ['Protocol', 'Samples', 'Print', 'Scan', 'Load', 'Start']

function Wizard({ d, run, state, user, cmd, onBack }: { d: Device; run?: RunSummary; state: LiveState; user: User; cmd: (c: Record<string, unknown>) => Promise<unknown>; onBack: () => void }) {
  const [protocolId, setProtocolId] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [adding, setAdding] = useState(false)

  const step = !run ? (protocolId ? 1 : 0)
    : run.dishes.some((x) => !x.printedAt) ? 2
    : run.dishes.some((x) => !x.scannedAt) ? 3
    : run.dishes.some((x) => !x.loadedAt) ? 4 : 5
  const busySamples = new Set(state.runs.filter((r) => !['complete', 'aborted'].includes(r.state)).flatMap((r) => r.dishes.map((x) => x.sampleId)))
  const queue = state.samples.filter((s) => !busySamples.has(s.id) && !s.custody.some((c) => c.event.startsWith('Loaded')))
  const protocol = state.protocols.find((p) => p.id === (run?.protocolId ?? protocolId))

  // present the next dish at the loading bay automatically
  const nextToLoad = run?.dishes.find((x) => !x.loadedAt)?.position
  useEffect(() => {
    if (step === 4 && nextToLoad) cmd({ type: 'present', position: nextToLoad })
  }, [step, nextToLoad]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full flex-col px-10 pb-8 pt-6">
      <div className="flex items-center justify-between">
        <Stepper steps={STEPS} current={step} />
        {run && <Btn kind="ghost" className="!h-10 !text-[13px]" onClick={() => cmd({ type: 'cancel_setup' })}>Cancel run</Btn>}
      </div>

      {step === 0 && (
        <div className="mt-8 flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between"><h2 className="font-mono text-[34px] font-semibold tracking-tight">Choose a protocol</h2><Btn kind="ghost" onClick={onBack}>Back</Btn></div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            {state.protocols.map((p) => (
              <button key={p.id} onClick={() => setProtocolId(p.id)} className="rounded-2xl bg-white/[0.04] p-5 text-left ring-1 ring-inset ring-white/[0.07] hover:bg-white/[0.08]">
                <div className="font-mono text-[19px] font-semibold">{p.name}</div>
                <div className="mt-1 text-[14px] text-white/50">{p.medium}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Chip tone="blue">{p.tempC} °C</Chip><Chip tone="blue">{p.rh}% RH</Chip><Chip tone="mute">{p.durationH / 24} days</Chip><Chip tone="mute">image every {p.captureEveryH} h</Chip>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="mt-8 flex min-h-0 flex-1 flex-col">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-mono text-[34px] font-semibold tracking-tight">Assign samples <span className="text-white/40">{picked.length}/6</span></h2>
              <div className="mt-1 text-[15px] text-white/50">{protocol?.name} · {protocol?.medium}</div>
            </div>
            <div className="flex gap-3">
              <Btn kind="ghost" onClick={() => setProtocolId(null)}>Back</Btn>
              <Btn kind="ghost" onClick={() => setAdding(true)}>Register sample</Btn>
              <Btn disabled={!picked.length} onClick={async () => { if (await cmd({ type: 'new_run', protocolId, sampleIds: picked, operatorId: user.id })) onBack() }}>Create run →</Btn>
            </div>
          </div>
          <div className="scrollbar-thin mt-6 grid min-h-0 flex-1 auto-rows-min grid-cols-3 gap-3 overflow-y-auto pr-2">
            {queue.map((s) => {
              const on = picked.includes(s.id)
              return (
                <button key={s.id} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s.id) : p.length < 6 ? [...p, s.id] : p))}
                  className={`rounded-xl p-4 text-left ring-1 ring-inset transition-colors ${on ? 'bg-blue/20 ring-blue' : 'bg-white/[0.04] ring-white/[0.07] hover:bg-white/[0.07]'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] text-white/45">{s.barcode}</span>
                    {on && <span className="grid h-6 w-6 place-items-center rounded-full bg-blue font-mono text-[12px]">{picked.indexOf(s.id) + 1}</span>}
                  </div>
                  <div className="mt-1 text-[16px] font-medium">{s.label}</div>
                  <div className="mt-1 font-mono text-[12px] uppercase text-white/40">{s.source} · {s.location}</div>
                </button>
              )
            })}
          </div>
          {adding && <AddSample onClose={() => setAdding(false)} onAdd={async (label, source, ref) => {
            const r = (await cmd({ type: 'add_sample', label, source, referenceSpecies: ref, operatorId: user.id })) as { sample?: { id: string } } | undefined
            if (r?.sample) setPicked((p) => [...p, r.sample!.id].slice(0, 6))
            setAdding(false)
          }} />}
        </div>
      )}

      {step >= 2 && run && (
        <div className="mt-8 grid min-h-0 flex-1 grid-cols-[1fr_420px] gap-10">
          <div className="flex min-h-0 flex-col">
            {step === 2 && (<>
              <h2 className="font-mono text-[34px] font-semibold tracking-tight">Print dish labels</h2>
              <p className="mt-2 max-w-[560px] text-[16px] text-white/55">One label per dish. Apply it to the side wall of the dish base — not the lid — so it stays with the culture.</p>
              <div className="mt-6"><Btn big disabled={d.printer.busy} onClick={() => cmd({ type: 'print_labels' })}>{d.printer.busy ? 'Printing…' : `Print ${run.dishes.filter((x) => !x.printedAt).length} labels`}</Btn></div>
            </>)}
            {step === 3 && (<>
              <h2 className="font-mono text-[34px] font-semibold tracking-tight">Scan each dish</h2>
              <p className="mt-2 max-w-[560px] text-[16px] text-white/55">Hold each labelled dish to the window on the right side of the instrument. The reader confirms it belongs to this run.</p>
              <div className="mt-6 flex items-center gap-3 font-mono text-[14px] text-[#aab0ff]"><span className="h-3 w-3 animate-pc-pulse rounded-full bg-[#ff3b3b]" />Side reader armed</div>
            </>)}
            {step === 4 && (<>
              <h2 className="font-mono text-[34px] font-semibold tracking-tight">{d.doorOpen ? `Place dish in position ${nextToLoad}` : 'Open the door'}</h2>
              <p className="mt-2 max-w-[560px] text-[16px] text-white/55">{d.doorOpen ? 'The carousel has brought the position to the front. Seat the dish base in the pocket, label facing out, lid on.' : 'Lift the door from the finger pull. The carousel will present each position in turn.'}</p>
              {d.doorOpen && nextToLoad && <div className="mt-6"><Btn big onClick={() => cmd({ type: 'load', position: nextToLoad })}>Dish {nextToLoad} placed ✓</Btn></div>}
            </>)}
            {step === 5 && (<>
              <h2 className="font-mono text-[34px] font-semibold tracking-tight">{d.doorOpen ? 'Close the door to start' : 'Ready to incubate'}</h2>
              <p className="mt-2 max-w-[560px] text-[16px] text-white/55">{protocol?.tempC} °C · {protocol?.rh}% RH · {protocol && protocol.durationH / 24} days. A baseline image set is captured the moment incubation starts.</p>
              <div className="mt-6"><Btn big kind="ok" disabled={d.doorOpen} onClick={() => cmd({ type: 'start' })}>Start incubation</Btn></div>
            </>)}
            <div className="scrollbar-thin mt-8 min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
              {run.dishes.map((x) => {
                const s = state.samples.find((ss) => ss.id === x.sampleId)
                return (
                  <div key={x.position} className={`flex items-center gap-4 rounded-xl px-4 py-3 ${step === 4 && x.position === nextToLoad ? 'bg-blue/20 ring-1 ring-inset ring-blue' : 'bg-white/[0.04]'}`}>
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 font-mono font-semibold">{x.position}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[15px]">{s?.label}</span><span className="font-mono text-[12px] text-white/40">{x.barcode}</span></span>
                    <Chip tone={x.printedAt ? 'ok' : 'mute'}>Printed</Chip>
                    <Chip tone={x.scannedAt ? 'ok' : 'mute'}>Scanned</Chip>
                    <Chip tone={x.loadedAt ? 'ok' : 'mute'}>Loaded</Chip>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            <CarouselMap angle={d.carouselAngle} size={400} highlight={step === 4 ? nextToLoad : null}
              dishes={[1, 2, 3, 4, 5, 6].map((p) => {
                const x = run.dishes.find((dd) => dd.position === p)
                return { position: p, state: !x ? 'empty' : x.loadedAt ? 'loaded' : x.scannedAt ? 'scanned' : 'assigned' }
              })} />
            <div className="flex gap-3 font-mono text-[13px]">
              <Chip tone={d.doorOpen ? 'warn' : 'ok'}>Door {d.doorOpen ? 'open' : 'closed'}</Chip>
              <Chip tone="mute">{d.telemetry.T.toFixed(1)} °C</Chip>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AddSample({ onClose, onAdd }: { onClose: () => void; onAdd: (label: string, source: SourceType, ref?: string) => void }) {
  const [label, setLabel] = useState('')
  const [source, setSource] = useState<SourceType>('air')
  const [ref, setRef] = useState(SPECIES[0].key)
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/60">
      <div className="w-[640px] rounded-2xl bg-graphite-2 p-8 ring-1 ring-white/10">
        <div className="font-mono text-[24px] font-semibold">Register sample</div>
        <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Sample name or ID"
          className="mt-5 h-14 w-full rounded-xl bg-white/5 px-4 font-mono text-[17px] outline-none ring-1 ring-white/10 focus:ring-blue" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {(['air', 'surface', 'water', 'product', 'clinical', 'reference'] as SourceType[]).map((s) => (
            <button key={s} onClick={() => setSource(s)} className={`h-12 rounded-lg font-mono text-[14px] capitalize ${source === s ? 'bg-blue' : 'bg-white/5 hover:bg-white/10'}`}>{s}</button>
          ))}
        </div>
        {source === 'reference' && (
          <select value={ref} onChange={(e) => setRef(e.target.value)} className="mt-4 h-12 w-full rounded-lg bg-white/5 px-3 font-mono text-[15px] ring-1 ring-white/10">
            {SPECIES.map((s) => <option key={s.key} value={s.key} className="bg-graphite">{s.name}</option>)}
          </select>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
          <Btn disabled={!label.trim()} onClick={() => onAdd(label.trim(), source, source === 'reference' ? ref : undefined)}>Register</Btn>
        </div>
      </div>
    </div>
  )
}

function RunScreen({ d, run, state, cmd }: { d: Device; run: RunSummary; state: LiveState; cmd: (c: Record<string, unknown>) => Promise<unknown> }) {
  const [open, setOpen] = useState<number | null>(null)
  const [confirmAbort, setConfirmAbort] = useState(false)
  const p = state.protocols.find((x) => x.id === run.protocolId)!
  const latest = state.latest[run.id] ?? []
  const env = state.env[run.id] ?? []
  const pct = Math.min(1, run.elapsedH / p.durationH)
  const lastCap = run.captures[run.captures.length - 1] ?? 0
  const nextCap = Math.max(0, lastCap + p.captureEveryH - run.elapsedH)
  const total = latest.reduce((a, x) => a + x.count, 0)
  const done = d.state === 'complete'
  const tempTone = Math.abs(d.telemetry.T - d.telemetry.setT) > 0.8 ? 'warn' : undefined

  return (
    <div className="grid h-full grid-cols-[1fr_440px]">
      <div className="flex min-h-0 flex-col px-10 py-7">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="font-mono text-[13px] uppercase tracking-wider text-white/40">{p.name}</div>
            <h1 className="mt-1 truncate font-mono text-[38px] font-semibold tracking-tight">{done ? (run.state === 'aborted' ? 'Run aborted' : 'Incubation complete') : d.state === 'paused' ? 'Paused' : 'Incubation'}</h1>
          </div>
          <div className="flex shrink-0 gap-2">
            {!done && <Btn kind="ghost" disabled={d.state === 'imaging' || d.doorOpen} onClick={() => cmd({ type: 'capture_now' })}>Capture now</Btn>}
            {!done && d.state !== 'paused' && <Btn kind="ghost" onClick={() => cmd({ type: 'pause' })}>Pause</Btn>}
            {d.state === 'paused' && <Btn onClick={() => cmd({ type: 'resume' })}>Resume</Btn>}
            {!done && <Btn kind="danger" onClick={() => setConfirmAbort(true)}>Abort</Btn>}
          </div>
        </div>

        <div className="mt-6">
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-blue transition-[width] duration-700" style={{ width: `${pct * 100}%` }} />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[15px] tabular">
            <span><b className="text-white">{fmtDur(run.elapsedH)}</b> <span className="text-white/40">elapsed</span></span>
            <span><b className="text-white">{fmtDur(Math.max(0, p.durationH - run.elapsedH))}</b> <span className="text-white/40">remaining</span></span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-8">
          <div>
            <Stat label="Temperature" value={d.telemetry.T.toFixed(1)} unit="°C" tone={tempTone} sub={<>Set {d.telemetry.setT} °C</>} />
            <div className="mt-3"><Sparkline values={env.slice(-160).map((e) => e.T)} band={[d.telemetry.setT - 0.5, d.telemetry.setT + 0.5]} color="#8f97ff" width={220} height={40} /></div>
          </div>
          <div>
            <Stat label="Humidity" value={d.telemetry.RH.toFixed(0)} unit="%" sub={<>Set {d.telemetry.setRH} %</>} />
            <div className="mt-3"><Sparkline values={env.slice(-160).map((e) => e.RH)} band={[d.telemetry.setRH - 3, d.telemetry.setRH + 3]} color="#8f97ff" width={220} height={40} /></div>
          </div>
          <div>
            <Stat label={done ? 'Image sets' : 'Next image set'} value={done ? String(run.captures.length) : d.state === 'imaging' ? 'now' : fmtDur(nextCap).replace(/^0h /, '')} sub={<>{run.captures.length} captured · every {p.captureEveryH} h</>} />
          </div>
        </div>

        {!done && (() => {
          const cam = latest.find((l) => l.position === d.stationPos)
          const sample = state.samples.find((s) => s.id === run.dishes.find((x) => x.position === d.stationPos)?.sampleId)
          return (
            <div className="mt-6 flex min-h-0 flex-1 items-center gap-6 rounded-2xl bg-white/[0.03] p-4">
              <div className="relative h-[190px] w-[190px] shrink-0">
                {cam ? <PlateCanvas colonies={cam.colonies} resolution={260} className="h-full w-full" /> : <div className="h-full w-full rounded-full bg-white/5" />}
                {d.state === 'imaging' && <div className="pointer-events-none absolute inset-0 animate-pc-pulse rounded-full ring-2 ring-blue" />}
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[12px] uppercase tracking-wider text-white/40">Under the camera</div>
                <div className="mt-1 font-mono text-[26px] font-semibold">Dish {d.stationPos}</div>
                <div className="truncate text-[15px] text-white/60">{sample?.label}</div>
                <div className="mt-3 font-mono text-[13px] text-white/45">{cam ? `${cam.count} colonies · last frame ${cam.h.toFixed(1)} h` : 'Waiting for first frame'}</div>
                <div className="mt-1 font-mono text-[13px] text-white/45">{p.channels.length} channels · {p.channels.map((c) => ({ white: 'white', transillum: 'backlit', uv365: 'UV 365', ir850: 'NIR 850' }[c])).join(' · ')}</div>
              </div>
            </div>
          )
        })()}

        <div className="mt-auto pt-6">
          {done ? (
            <div className="flex items-center gap-4 rounded-2xl bg-white/[0.04] p-5">
              <div className="flex-1">
                <div className="font-mono text-[18px] font-semibold">{d.doorOpen ? 'Remove all dishes, then confirm' : 'Open the door to unload'}</div>
                <div className="mt-1 text-[14px] text-white/50">Results are synced for review. Dishes can go to the bench for confirmation work.</div>
              </div>
              <Btn big disabled={!d.doorOpen} onClick={() => cmd({ type: 'unload' })}>Dishes removed</Btn>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4 font-mono">
              <MiniStat k="Colonies detected" v={String(total)} />
              <MiniStat k="Carousel at" v={`Dish ${d.stationPos}`} />
              <MiniStat k="Heat pump" v={`${d.telemetry.tecPct > 0 ? 'Heat' : 'Cool'} ${Math.abs(d.telemetry.tecPct).toFixed(0)} %`} />
              <MiniStat k="Reservoir" v={`${d.telemetry.reservoirPct.toFixed(0)} %`} />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center border-l border-white/[0.06] bg-black/20 py-6">
        <CarouselMap angle={d.carouselAngle} size={400} onPick={setOpen}
          dishes={run.dishes.map((x) => ({ position: x.position, state: 'loaded' as const, latest: latest.find((l) => l.position === x.position) }))} />
        <div className="mt-2 font-mono text-[13px] text-white/40">Tap a dish for detail</div>
        <div className="mt-4 w-[360px] space-y-1.5">
          {topSpecies(latest).map(([k, n]) => (
            <div key={k} className="flex items-center gap-2 text-[13px]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: speciesColor(k) }} />
              <span className="italic text-white/75">{shortName(k)}</span>
              <span className="ml-auto font-mono tabular text-white/60">{n}</span>
            </div>
          ))}
          {!!latest.length && <div className="pt-2 font-mono text-[11px] text-white/30">Presumptive IDs from a simulated classifier — confirm by review.</div>}
        </div>
      </div>

      {open !== null && <DishDetail pos={open} run={run} latest={latest.find((l) => l.position === open)} state={state} onClose={() => setOpen(null)} />}
      {confirmAbort && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/60">
          <div className="w-[560px] rounded-2xl bg-graphite-2 p-8 ring-1 ring-white/10">
            <div className="font-mono text-[24px] font-semibold">Abort this run?</div>
            <p className="mt-2 text-white/60">Incubation stops and the run is closed. Captured images and data are kept.</p>
            <div className="mt-6 flex justify-end gap-3"><Btn kind="ghost" onClick={() => setConfirmAbort(false)}>Keep running</Btn><Btn kind="danger" onClick={() => { cmd({ type: 'abort' }); setConfirmAbort(false) }}>Abort run</Btn></div>
          </div>
        </div>
      )}
    </div>
  )
}

function topSpecies(latest: { bySpecies: Record<string, number> }[]) {
  const m: Record<string, number> = {}
  for (const l of latest) for (const [k, n] of Object.entries(l.bySpecies)) m[k] = (m[k] ?? 0) + n
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
}

function MiniStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-white/40">{k}</div>
      <div className="mt-1 text-[20px] font-semibold tabular">{v}</div>
    </div>
  )
}

function DishDetail({ pos, run, latest, state, onClose }: { pos: number; run: RunSummary; latest?: LiveState['latest'][string][number]; state: LiveState; onClose: () => void }) {
  const [channel, setChannel] = useState<'white' | 'transillum' | 'uv365' | 'ir850'>('white')
  const dish = run.dishes.find((x) => x.position === pos)!
  const s = state.samples.find((x) => x.id === dish.sampleId)
  const p = state.protocols.find((x) => x.id === run.protocolId)!
  const cols = useMemo(() => latest?.colonies ?? [], [latest])
  return (
    <div className="absolute inset-0 z-30 flex bg-graphite">
      <div className="flex w-[760px] items-center justify-center bg-black/40">
        <PlateCanvas colonies={cols} channel={channel} resolution={640} overlay="label" className="w-[640px]" showScale />
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[13px] text-white/40">Dish {pos} · {dish.barcode}</div>
            <div className="mt-1 text-[26px] font-semibold">{s?.label}</div>
            <div className="mt-1 font-mono text-[12px] uppercase text-white/40">{s?.source} · {s?.location}</div>
          </div>
          <Btn kind="ghost" onClick={onClose}>Close</Btn>
        </div>
        <div className="mt-6 flex gap-2">
          {p.channels.map((c) => (
            <button key={c} onClick={() => setChannel(c)} className={`h-10 rounded-lg px-3 font-mono text-[13px] ${channel === c ? 'bg-white text-ink' : 'bg-white/5 text-white/70'}`}>
              {{ white: 'White', transillum: 'Backlit', uv365: 'UV 365', ir850: 'NIR 850' }[c]}
            </button>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 font-mono">
          <MiniStat k="Colonies" v={String(latest?.count ?? 0)} />
          <MiniStat k="Plate coverage" v={`${((latest?.coverage ?? 0) * 100).toFixed(1)} %`} />
        </div>
        <div className="scrollbar-thin mt-6 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {cols.sort((a, b) => b.r - a.r).map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2 text-[14px]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: speciesColor(c.key) }} />
              <span className="italic">{shortName(c.key)}</span>
              <span className="ml-auto font-mono tabular text-white/50">⌀ {(c.r * 2).toFixed(1)} mm</span>
              <span className="w-14 text-right font-mono tabular text-white/70">{Math.round(c.p * 100)} %</span>
            </div>
          ))}
        </div>
        <div className="pt-3 font-mono text-[11px] text-white/30">Simulated capture at {latest?.h.toFixed(1) ?? 0} h · presumptive IDs are simulated.</div>
      </div>
    </div>
  )
}

function Maintenance({ d, cmd, onBack }: { d: Device; cmd: (c: Record<string, unknown>) => Promise<unknown>; onBack: () => void }) {
  const rows: [string, string, string?][] = [
    ['Humidifier reservoir', `${d.telemetry.reservoirPct.toFixed(0)} %`, d.telemetry.reservoirPct < 20 ? 'Refill via rear hatch' : undefined],
    ['HEPA filter', `${d.telemetry.hepaHours.toFixed(0)} h in service`],
    ['UV-C cycles', String(d.telemetry.uvcCycles)],
    ['Labels on roll', String(d.printer.labelsLeft)],
    ['Firmware', d.firmware],
    ['Serial', d.serial],
    ['Heat pump output', `${d.telemetry.tecPct.toFixed(0)} %`],
    ['Recirculation fan', `${d.telemetry.fanPct.toFixed(0)} %`],
  ]
  return (
    <div className="grid h-full grid-cols-[1fr_1fr] gap-10 p-10">
      <div>
        <h2 className="font-mono text-[34px] font-semibold tracking-tight">Service</h2>
        <div className="mt-6 divide-y divide-white/[0.06] rounded-2xl bg-white/[0.03]">
          {rows.map(([k, v, note]) => (
            <div key={k} className="flex items-center justify-between px-5 py-4">
              <span className="text-white/60">{k}</span>
              <span className="font-mono tabular">{v}{note && <span className="ml-3 text-[#ffc266]">{note}</span>}</span>
            </div>
          ))}
        </div>
        <div className="mt-6"><Btn kind="ghost" onClick={onBack}>← Back</Btn></div>
      </div>
      <div>
        <div className="font-mono text-[13px] uppercase tracking-wider text-white/40">Simulation speed (demo)</div>
        <p className="mt-2 text-[14px] text-white/50">This PC-6 is a software twin. Speed sets how many simulated seconds pass per real second.</p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[60, 600, 3600, 14400].map((s) => (
            <button key={s} onClick={() => cmd({ type: 'speed', speed: s })} className={`h-14 rounded-xl font-mono text-[15px] ${d.speed === s ? 'bg-blue' : 'bg-white/5 hover:bg-white/10'}`}>{s}×</button>
          ))}
        </div>
        <div className="mt-8 font-mono text-[13px] uppercase tracking-wider text-white/40">Checks</div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Btn kind="ghost" onClick={() => cmd({ type: 'present', position: 1 })}>Home carousel</Btn>
          <Btn kind="ghost" disabled={d.doorOpen || !!d.activeRunId || d.state === 'decontaminating'} onClick={() => cmd({ type: 'decontaminate' })}>Run UV-C</Btn>
        </div>
        {d.state === 'decontaminating' && <UvcProgress d={d} className="mt-6 max-w-[560px]" />}
      </div>
    </div>
  )
}

/** Determinate UV-C cycle progress: elapsed bar, time remaining, and the door interlock reminder. */
function UvcProgress({ d, className = '' }: { d: Device; className?: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(iv)
  }, [])
  const c = d.cycle
  const total = c ? c.endsAt - c.startedAt : 1
  const done = c ? Math.min(1, Math.max(0, (now - c.startedAt) / total)) : 0
  const left = c ? Math.max(0, Math.ceil((c.endsAt - now) / 1000)) : 0
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between font-mono">
        <span className="text-[13px] uppercase tracking-wider text-[#b9a6ff]">UV-C 275 nm · door locked</span>
        <span className="text-[22px] font-semibold tabular">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}<span className="ml-1.5 text-[13px] font-normal text-white/45">remaining</span></span>
      </div>
      <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="UV-C cycle" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(done * 100)}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#6b4dff] to-[#b9a6ff] shadow-[0_0_18px_rgba(143,107,255,0.6)] transition-[width] duration-100 ease-linear" style={{ width: `${done * 100}%` }} />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[12px] text-white/40"><span>{Math.round(done * 100)} % complete</span><span>Surfaces, carousel and chamber walls</span></div>
    </div>
  )
}
