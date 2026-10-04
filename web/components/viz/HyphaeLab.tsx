'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { DEFAULTS, Mycelium, type HyphaParams } from '@/lib/viz/hyphae'
import type { Hypha3Params } from '@/lib/viz/hyphae3d'
import type { MyceliumStats, ViewApi } from '@/components/three/Mycelium3D'
import { useRouter } from 'next/navigation'
import ExploreBar from './ExploreBar'
import { SPECIES } from '@/lib/science/species'
import { LineChart } from './charts'

type Mode = 'fluorescence' | 'brightfield'
type View = '3d' | '2d'

const Mycelium3D = dynamic(() => import('@/components/three/Mycelium3D'), { ssr: false, loading: () => <div className="grid h-full place-items-center font-mono text-[12px] text-white/40">Loading 3D model…</div> })

function presetFor(key: string): HyphaParams {
  const s = SPECIES.find((x) => x.key === key)!
  const h = s.morph.hyphae
  return { ...DEFAULTS, speed: 3 * h.speed, internode: h.internode, branchDeg: h.branchDeg, germTubes: s.kind === 'yeast' ? 1 : 2, autotropism: 0.55 + 0.1 * h.aerial }
}

/** Mycelium lab for one species. Changing the species preset navigates to that species' lab page. */
export default function HyphaeLab({ speciesKey: initialKey = 'aspergillus_niger' }: { speciesKey?: string }) {
  const router = useRouter()
  const base = useRef<HTMLCanvasElement>(null)
  const tipsC = useRef<HTMLCanvasElement>(null)
  const sim = useRef<Mycelium | null>(null)
  const speciesKey = initialKey
  const [params, setParams] = useState<HyphaParams>(() => presetFor(initialKey))
  const [explore, setExplore] = useState(false)
  const [spin, setSpin] = useState(true)
  const [pitch, setPitch] = useState(40)
  const [api, setApi] = useState<ViewApi | null>(null)
  useEffect(() => {
    if (!explore) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setExplore(false) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [explore])
  useEffect(() => { api?.setAutoRotate(spin) }, [api, spin])
  const [running, setRunning] = useState(true)
  const [mode, setMode] = useState<Mode>('fluorescence')
  const [view, setView] = useState<View>('3d')
  const [seed, setSeed] = useState(7)
  const [pace, setPace] = useState(1)
  const [stats, setStats] = useState({ t: 0, tips: 0, length: 0, radius: 0, branches: 0, fusions: 0, hgu: 0 })
  const [hist, setHist] = useState<{ t: number; tips: number; length: number; radius: number }[]>([])
  const S = 900

  const reset = useCallback(() => {
    sim.current = new Mycelium(params, 1200, seed)
    if (!base.current) return
    const c = base.current.getContext('2d')!
    c.fillStyle = mode === 'fluorescence' ? '#050608' : '#eef0ea'
    c.fillRect(0, 0, S, S)
    if (mode === 'brightfield') {
      const g = c.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.62)
      g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(1, 'rgba(120,120,110,0.35)')
      c.fillStyle = g; c.fillRect(0, 0, S, S)
    }
  }, [params, seed, mode])

  useEffect(() => { reset() }, [reset, view])

  useEffect(() => {
    let raf = 0, frame = 0
    const loop = () => {
      const m = sim.current
      if (m && running && view === '2d' && base.current && tipsC.current) {
        const bc = base.current!.getContext('2d')!
        const k = S / (2 * m.R)
        for (let i = 0; i < pace; i++) {
          const alive = m.step(0.75)
          const segs = m.newSegs
          bc.lineCap = 'round'
          for (const s of segs) {
            const age = Math.min(1, s.gen / 12)
            bc.strokeStyle = mode === 'fluorescence' ? `hsla(${165 - age * 75}, 90%, ${66 - age * 20}%, ${0.55 - age * 0.25})` : `rgba(${40 + age * 50}, ${45 + age * 40}, ${52 + age * 30}, ${0.5 - age * 0.2})`
            bc.lineWidth = s.gen === 0 ? 1.6 : 1.0
            bc.beginPath(); bc.moveTo(S / 2 + s.x0 * k, S / 2 + s.y0 * k); bc.lineTo(S / 2 + s.x1 * k, S / 2 + s.y1 * k); bc.stroke()
          }
          if (!alive) { setRunning(false); break }
        }
        // tips + fusions overlay
        const tc = tipsC.current!.getContext('2d')!
        tc.clearRect(0, 0, S, S)
        tc.fillStyle = mode === 'fluorescence' ? '#ffffff' : '#3a44ff'
        for (const t of m.tips) if (t.alive) { tc.beginPath(); tc.arc(S / 2 + t.x * k, S / 2 + t.y * k, 1.6, 0, Math.PI * 2); tc.fill() }
        tc.strokeStyle = '#ffb020'; tc.lineWidth = 1.2
        for (const f of m.fusions.slice(-400)) { tc.beginPath(); tc.arc(S / 2 + f.x * k, S / 2 + f.y * k, 3, 0, Math.PI * 2); tc.stroke() }
        if (frame++ % 6 === 0) {
          setStats({ t: m.t, tips: m.aliveTips.length, length: m.length, radius: m.radius, branches: m.branches, fusions: m.fusions.length, hgu: m.hgu })
          setHist([...m.history])
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, mode, pace, view])

  const aerial = SPECIES.find((x) => x.key === speciesKey)!.morph.hyphae.aerial
  const params3: Hypha3Params = useMemo(() => ({ ...params, aerial: 0.15 + 0.6 * aerial, aerialLen: 260 + 380 * aerial }), [params, aerial])
  const on3D = useCallback((x: MyceliumStats) => {
    setStats({ t: x.t, tips: x.tips, length: x.length, radius: x.radius, branches: x.branches, fusions: x.fusions, hgu: x.hgu })
    setHist([...x.history])
  }, [])
  const set = (k: keyof HyphaParams, v: number | boolean) => setParams((p) => ({ ...p, [k]: v }))
  const hgu = stats.hgu

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <div className={`relative mx-auto aspect-square w-full max-w-[860px] overflow-hidden rounded-2xl bg-black transition-shadow ${explore && view === '3d' ? 'ring-2 ring-blue shadow-[0_0_0_6px_rgba(58,68,255,0.15)]' : ''}`}>
          {view === '3d' ? (
            <Mycelium3D key={`${seed}:${JSON.stringify(params3)}`} className="absolute inset-0" params={params3} seed={seed} rate={22 * pace} running={running}
              controls interactive={explore} framing="lab" onStats={on3D} onDone={() => setRunning(false)}
              onReady={setApi} onView={(v) => setPitch(v.pitch)} />
          ) : (<>
            <canvas ref={base} width={S} height={S} className="absolute inset-0 h-full w-full" />
            <canvas ref={tipsC} width={S} height={S} className="absolute inset-0 h-full w-full" />
          </>)}
          {view === '3d' && <ExploreBar on={explore} onToggle={setExplore} api={api} pitch={pitch} autoRotate={spin} onAutoRotate={setSpin} />}
          <div className="pointer-events-none absolute left-4 top-4 font-mono text-[12px] text-white/80 mix-blend-difference">
            <div className="text-[22px] font-semibold tabular">{(stats.t / 60).toFixed(1)} h</div>
            <div>{stats.tips.toLocaleString()} active tips</div>
          </div>
          <div className={`pointer-events-none absolute bottom-4 right-4 font-mono text-[11px] text-white mix-blend-difference ${view === '3d' ? 'hidden' : ''}`}>
            <div className="mb-1 h-[2px] bg-white" style={{ width: `${(500 / 2400) * 100}%`, minWidth: 60 }} />500 µm
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <div className="card p-4"><div className="mb-2 text-[12.5px] font-medium">Active tips</div><LineChart series={[{ key: 'n', label: 'Tips', color: '#2a78d6', points: hist.map((h) => ({ x: h.t / 60, y: h.tips })) }]} xFormat={(x) => `${x.toFixed(0)}h`} yFormat={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)} height={130} /></div>
          <div className="card p-4"><div className="mb-2 text-[12.5px] font-medium">Total hyphal length (mm)</div><LineChart series={[{ key: 'L', label: 'Length', color: '#2a78d6', points: hist.map((h) => ({ x: h.t / 60, y: h.length / 1000 })) }]} xFormat={(x) => `${x.toFixed(0)}h`} yFormat={(v) => v.toFixed(0)} height={130} /></div>
          <div className="card p-4"><div className="mb-2 text-[12.5px] font-medium">Colony radius (µm)</div><LineChart series={[{ key: 'r', label: 'Radius', color: '#2a78d6', points: hist.map((h) => ({ x: h.t / 60, y: h.radius })) }]} xFormat={(x) => `${x.toFixed(0)}h`} yFormat={(v) => v.toFixed(0)} height={130} /></div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="card p-5">
          <div className="grid grid-cols-2 gap-4 font-mono">
            {[['Hyphal length', `${(stats.length / 1000).toFixed(1)} mm`], ['Active tips', stats.tips.toLocaleString()], ['HGU (length / tips)', `${hgu.toFixed(0)} µm`], ['Branch events', stats.branches.toLocaleString()], ['Anastomoses', stats.fusions.toLocaleString()], ['Radius', `${stats.radius.toFixed(0)} µm`]].map(([k, v]) => (
              <div key={k}><div className="eyebrow">{k}</div><div className="mt-0.5 text-[20px] font-semibold tabular">{v}</div></div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => setRunning((r) => !r)} className="h-9 rounded-lg bg-blue px-4 text-[13px] font-medium text-white">{running ? 'Pause' : 'Run'}</button>
            <button onClick={() => { setSeed((s) => s + 1); setRunning(true) }} className="h-9 rounded-lg border border-line px-4 text-[13px] font-medium">New spore</button>
            <div className="flex rounded-lg border border-line p-0.5">
              {[1, 3, 8].map((v) => <button key={v} onClick={() => setPace(v)} className={`rounded-md px-2.5 py-1 font-mono text-[12px] ${pace === v ? 'bg-ink text-white' : 'text-ink/70'}`}>{v}×</button>)}
            </div>
            <div className="flex rounded-lg border border-line p-0.5">
              {(['3d', '2d'] as View[]).map((v) => <button key={v} onClick={() => { setView(v); setRunning(true) }} className={`rounded-md px-2.5 py-1 font-mono text-[12px] uppercase ${view === v ? 'bg-ink text-white' : 'text-ink/70'}`}>{v}</button>)}
            </div>
            <div className={`flex rounded-lg border border-line p-0.5 ${view === '3d' ? 'hidden' : ''}`}>
              {(['fluorescence', 'brightfield'] as Mode[]).map((m) => <button key={m} onClick={() => { setMode(m); setRunning(true) }} className={`rounded-md px-2.5 py-1 text-[12px] capitalize ${mode === m ? 'bg-ink text-white' : 'text-ink/70'}`}>{m}</button>)}
            </div>
          </div>
        </div>
        <div className="card space-y-4 p-5 text-[13px]">
          <label className="block"><span className="eyebrow">Preset from species</span>
            <select value={speciesKey} onChange={(e) => router.push(`/app/lab/${e.target.value}`)} className="mt-1 h-9 w-full rounded-lg border border-line bg-white px-2">
              {SPECIES.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </label>
          {([['speed', 'Tip extension', 0.5, 8, 0.1, 'µm/min'], ['internode', 'Internode length', 15, 200, 1, 'µm'], ['branchDeg', 'Branch angle', 10, 90, 1, '°'], ['autotropism', 'Negative autotropism', 0, 1, 0.01, ''], ['persistence', 'Direction persistence', 0.5, 0.99, 0.01, ''], ['wiggle', 'Random turning', 0, 0.5, 0.01, ''], ['saturation', 'Density limit', 0.8, 5, 0.1, '']] as [keyof HyphaParams, string, number, number, number, string][]).map(([k, label, min, max, step, unit]) => (
            <label key={k} className="block">
              <span className="flex justify-between"><span>{label}</span><span className="font-mono tabular text-muted">{(params[k] as number).toFixed(step < 1 ? 2 : 0)} {unit}</span></span>
              <input type="range" min={min} max={max} step={step} value={params[k] as number} onChange={(e) => { set(k, +e.target.value); setRunning(true) }} className="mt-1 w-full accent-[#3a44ff]" />
            </label>
          ))}
          <label className="flex items-center gap-2"><input type="checkbox" checked={params.anastomosis} onChange={(e) => { set('anastomosis', e.target.checked); setRunning(true) }} className="accent-[#3a44ff]" />Hyphal fusion (anastomosis)</label>
        </div>
        <p className="text-[12px] leading-relaxed text-muted">
          3D view: substrate hyphae follow the 2D rules on the agar while some branches leave it as aerial hyphae that rise, avoid each other in 3D and droop with length. A stochastic model in the spirit of the Neighbour-Sensing model (Meškauskas, Fricker &amp; Moore, Mycol. Res. 2004): each hypha lays down a field; tips turn away from it and stop branching where it saturates.
          HGU is the hyphal growth unit of Trinci (J. Gen. Microbiol. 1974). Presets change branching geometry and speed for comparison — they are illustrative, not fitted to strains.
        </p>
      </div>
    </div>
  )
}
