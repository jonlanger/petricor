'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import DeviceApp from '@/components/device/DeviceApp'
import { sendCommand, type LiveState } from '@/lib/client/live'
import { Mark } from '@/components/brand/Logo'

/** The 10.1" 1280×800 panel, scaled to fit, with a "physical world" panel for hands-on actions. */
export default function DeviceStation({ deviceId, kiosk, operator }: { deviceId: string; kiosk: boolean; operator?: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [state, setState] = useState<LiveState | null>(null)
  const onState = useCallback((s: LiveState | null) => setState(s), [])

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setScale(Math.min(width / 1280, height / 800))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const screen = (
    <div ref={wrap} className="relative h-full w-full">
      <div className="absolute left-1/2 top-1/2 overflow-hidden rounded-[10px] shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
        style={{ width: 1280, height: 800, transform: `translate(-50%,-50%) scale(${scale})` }} data-screen>
        <DeviceApp deviceId={deviceId} onState={onState} operator={operator} />
      </div>
    </div>
  )
  if (kiosk) return <div className="h-screen w-screen bg-black">{screen}</div>

  return (
    <div className="flex h-screen flex-col bg-[#0b0c0e] text-white lg:flex-row">
      <div className="flex min-h-[60vh] flex-1 flex-col p-4 lg:p-8">
        <div className="mb-4 flex items-center gap-3 text-[13px] text-white/50">
          <Link href="/" className="flex items-center gap-2 text-white/80"><Mark className="h-6 w-6" />Petricor</Link>
          <span>/</span><span className="font-mono">PC-6 touchscreen · 10.1″ 1280×800</span>
          <Link href="/app" className="ml-auto rounded-md px-2 py-1 font-mono text-white/70 ring-1 ring-white/15 hover:bg-white/5">Open cloud ↗</Link>
        </div>
        <div className="min-h-0 flex-1 rounded-[28px] bg-[#1a1b1f] p-5 ring-1 ring-white/5">{screen}</div>
      </div>
      <PhysicalPanel deviceId={deviceId} state={state} />
    </div>
  )
}

function PhysicalPanel({ deviceId, state }: { deviceId: string; state: LiveState | null }) {
  const [msg, setMsg] = useState<string | null>(null)
  const d = state?.devices.find((x) => x.id === deviceId)
  const run = state?.runs.find((r) => r.id === d?.activeRunId)
  const act = async (c: Record<string, unknown>, ok?: string) => {
    try { await sendCommand(deviceId, c); if (ok) setMsg(ok) } catch (e) { setMsg((e as Error).message) }
    setTimeout(() => setMsg(null), 2500)
  }
  if (!d) return <aside className="w-full border-white/5 p-6 lg:w-[360px] lg:border-l" />
  const printed = run && ['setup', 'loading'].includes(run.state) ? run.dishes.filter((x) => x.printedAt) : []
  return (
    <aside className="scrollbar-thin w-full overflow-y-auto border-white/5 p-6 lg:w-[360px] lg:border-l">
      <div className="eyebrow !text-white/40">At the bench</div>
      <h2 className="mt-1 font-mono text-[20px] font-semibold">Physical actions</h2>
      <p className="mt-1 text-[13px] text-white/45">Things you do with your hands. The touchscreen reacts the way the instrument would.</p>

      <Section title="Door">
        <button onClick={() => act({ type: 'door', open: !d.doorOpen })}
          className={`h-11 w-full rounded-lg font-mono text-[14px] ${d.doorOpen ? 'bg-warn text-ink' : 'bg-white/10 hover:bg-white/15'}`}>
          {d.doorOpen ? 'Close door' : 'Lift door'}
        </button>
      </Section>

      <Section title="Printer output">
        {printed.length ? (
          <div className="space-y-2">
            {printed.map((x) => (
              <div key={x.barcode} className="flex items-center gap-3 rounded-md bg-white px-3 py-2 text-ink">
                <Barcode code={x.barcode} />
                <div className="min-w-0 flex-1 font-mono text-[11px]"><div className="font-semibold">{x.barcode}</div><div className="text-ink/50">Dish {x.position}</div></div>
                <button disabled={!!x.scannedAt} onClick={() => act({ type: 'scan', barcode: x.barcode }, `Read ${x.barcode}`)}
                  className="rounded bg-ink px-2 py-1 font-mono text-[11px] text-white disabled:bg-ok">{x.scannedAt ? '✓ Scanned' : 'Scan'}</button>
              </div>
            ))}
          </div>
        ) : <Empty>Labels appear here after printing.</Empty>}
        <p className="mt-2 text-[12px] text-white/40">“Scan” holds the labelled dish to the side reader window on the right of the instrument.</p>
      </Section>

      <Section title="Rear hatch">
        <button onClick={() => act({ type: 'refill' }, 'Reservoir filled')} className="h-11 w-full rounded-lg bg-white/10 font-mono text-[14px] hover:bg-white/15">
          Refill reservoir ({d.telemetry.reservoirPct.toFixed(0)} %)
        </button>
      </Section>

      <Section title="Simulation">
        <div className="grid grid-cols-4 gap-1.5">
          {[60, 600, 3600, 14400].map((s) => (
            <button key={s} onClick={() => act({ type: 'speed', speed: s })} className={`h-9 rounded-md font-mono text-[12px] ${d.speed === s ? 'bg-blue' : 'bg-white/5 hover:bg-white/10'}`}>{s}×</button>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-white/40">Simulated seconds per real second. At 3600×, one hour of incubation passes each second.</p>
      </Section>
      {msg && <div className="mt-4 rounded-lg bg-white/10 px-3 py-2 font-mono text-[12px]">{msg}</div>}
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-6"><div className="mb-2 font-mono text-[12px] uppercase tracking-wider text-white/40">{title}</div>{children}</div>
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[12px] text-white/35">{children}</div>
}
function Barcode({ code }: { code: string }) {
  let x = 0
  const bars: { x: number; w: number }[] = []
  for (const ch of code) {
    const n = ch.charCodeAt(0)
    for (let i = 0; i < 4; i++) { const w = ((n >> i) & 1) + 1; if (i % 2 === 0) bars.push({ x, w }); x += w + 1 }
  }
  return <svg viewBox={`0 0 ${x} 20`} className="h-6 w-20" preserveAspectRatio="none">{bars.map((b, i) => <rect key={i} x={b.x} width={b.w} height={20} fill="#0d0e11" />)}</svg>
}
