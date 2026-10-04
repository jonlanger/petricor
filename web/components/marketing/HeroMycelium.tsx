'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MyceliumStats, ViewApi } from '@/components/three/Mycelium3D'

const Mycelium3D = dynamic(() => import('@/components/three/Mycelium3D'), { ssr: false })

const T = 18 * 60 // timeline span, sim minutes
const PLAY = 20 // playback speed, sim minutes per second
const HOLD = 6 // seconds to rest on a grown colony before regrowing from a new spore

/**
 * Hero visual: a colony grown in 3D from one spore. The whole growth is precomputed a few seconds ahead, so the
 * timeline can be scrubbed backwards and forwards; playback then loops with a new spore.
 */
export default function HeroMycelium({ className = '' }: { className?: string }) {
  const [s, setS] = useState<MyceliumStats | null>(null)
  const [v, setV] = useState(0) // playhead, sim minutes
  const [playing, setPlaying] = useState(true)
  const api = useRef<ViewApi | null>(null)
  const lastT = useRef(0)
  const computed = useRef(0)
  const done = useRef(false)
  const reduce = useRef(false)

  const onStats = useCallback((x: MyceliumStats) => {
    // a new spore restarts the clock
    if (x.t < lastT.current - 10) { setV(0); setPlaying(!reduce.current) }
    lastT.current = x.t
    computed.current = x.t
    done.current = !!x.done
    setS(x)
    if (reduce.current) setV(x.t)
  }, [])

  useEffect(() => {
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce.current) setPlaying(false)
  }, [])

  // playback: advance the playhead through the precomputed growth; rest at the end, then regrow
  useEffect(() => {
    if (!playing) return
    let raf = 0, last = performance.now(), rest = 0
    const f = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now
      setV((p) => {
        const n = Math.min(p + dt * PLAY, computed.current)
        if (done.current && n >= computed.current - 0.01) {
          rest += dt
          if (rest > HOLD) { rest = -1e9; api.current?.respawn() }
        }
        return n
      })
      raf = requestAnimationFrame(f)
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const grown = s?.t ?? 0
  const ev = s?.events
  const phase = v < (ev?.firstBranch ?? Infinity) ? 'Germ tubes emerge from the spore'
    : v < (ev?.firstAerial ?? Infinity) ? 'Hyphae branch out across the agar'
    : v < (ev?.edge ?? Infinity) ? 'Aerial hyphae rise into a dome'
    : 'The colony reaches the edge of the dish'
  const hist = s?.history ?? []
  // readout at the playhead, from the growth history (every 5 sim minutes)
  const idx = hist.findIndex((h) => h.t >= v)
  const at = hist.length ? hist[idx < 0 ? hist.length - 1 : idx] : null
  const maxTips = Math.max(1, ...hist.map((h) => h.tips))
  const spark = hist.length > 1 ? hist.map((h, i) => `${i ? 'L' : 'M'}${((h.t / T) * 1000).toFixed(1)},${(40 - (h.tips / maxTips) * 36).toFixed(1)}`).join('') : ''
  const area = spark ? `${spark}L${((hist[hist.length - 1].t / T) * 1000).toFixed(1)},40L0,40Z` : ''
  const marks = ev ? (([['First branch', ev.firstBranch], ['Hyphal fusion', ev.firstFusion], ['Aerial hyphae', ev.firstAerial], ['Dish edge', ev.edge]] as [string, number | null][])
    .filter(([, t]) => t != null) as [string, number][]).sort((a, b) => a[1] - b[1]) : []
  const atEnd = !!s?.done && v >= grown - 0.5

  const seek = (t: number) => setV(Math.max(0, Math.min(t, grown)))
  const togglePlay = () => {
    if (playing) setPlaying(false)
    else { if (atEnd) setV(0); setPlaying(true) }
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="relative min-h-0 flex-1">
        <Mycelium3D className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,#000_10%)] lg:[mask-image:linear-gradient(to_right,transparent,#000_18%)]"
          precompute cut={v} framing="hero" onStats={onStats} onReady={(a) => { api.current = a }} background="#06070a" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#06070a] to-transparent" />
      </div>

      {/* growth timeline */}
      <div className="relative z-10 px-5 pb-7 sm:px-7 lg:pb-10 lg:pl-[12%]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <button onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play growth'} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition-colors hover:bg-white/20">
            {playing
              ? <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
              : <svg viewBox="0 0 16 16" className="ml-0.5 h-3.5 w-3.5" fill="currentColor"><path d="M4 2.5v11a.6.6 0 0 0 .9.5l9-5.5a.6.6 0 0 0 0-1l-9-5.5a.6.6 0 0 0-.9.5z" /></svg>}
          </button>
          <div className="min-w-0">
            <div className="font-mono text-[22px] font-semibold leading-none tabular text-white">{(v / 60).toFixed(1)}<span className="ml-1 text-[13px] font-normal text-white/45">h</span></div>
            <div className="mt-1 truncate text-[13px] text-white/55">{phase}</div>
          </div>
          {at && <div className="ml-auto hidden font-mono text-[11.5px] tabular text-white/45 sm:block">{at.tips.toLocaleString()} tips · {(at.length / 1000).toFixed(0)} mm hyphae · {Math.round(at.radius)} µm radius</div>}
        </div>

        {/* track: sparkline of active tips, precomputed range, playhead, milestones */}
        <div className="group relative mt-4 h-[58px]">
          <svg viewBox="0 0 1000 40" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-[40px] w-full">
            <defs>
              <linearGradient id="spk" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#4fd8d0" stopOpacity="0.35" /><stop offset="1" stopColor="#4fd8d0" stopOpacity="0" /></linearGradient>
              <clipPath id="spk-cut"><rect x="0" y="0" width={(v / T) * 1000} height="40" /></clipPath>
            </defs>
            {spark && <>
              <path d={area} fill="url(#spk)" opacity="0.35" />
              <path d={spark} fill="none" stroke="#4fd8d0" strokeOpacity="0.3" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
              <g clipPath="url(#spk-cut)">
                <path d={area} fill="url(#spk)" />
                <path d={spark} fill="none" stroke="#4fd8d0" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              </g>
            </>}
          </svg>
          <div className="absolute inset-x-0 top-[47px] h-[3px] rounded-full bg-white/10">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/20 transition-[width] duration-300" style={{ width: `${Math.min(100, (grown / T) * 100)}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-[#7c84ff]" style={{ width: `${Math.min(100, (v / T) * 100)}%` }} />
            {marks.map(([k, t]) => <span key={k} title={k} className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white/70 ring-2 ring-[#06070a]" style={{ left: `${(t / T) * 100}%` }} />)}
          </div>
          <div className="pointer-events-none absolute top-0 h-[52px] w-px bg-white/40" style={{ left: `${Math.min(100, (v / T) * 100)}%` }} />
          <input type="range" min={0} max={T} step={1} value={Math.round(v)} aria-label="Colony growth time"
            aria-valuetext={`${(v / 60).toFixed(1)} hours — ${phase}`}
            onChange={(e) => { setPlaying(false); seek(+e.target.value) }}
            className="peer absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
          <span className="pointer-events-none absolute top-[48.5px] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_4px_rgba(124,132,255,0.35)] transition-transform group-hover:scale-110 peer-focus-visible:ring-2 peer-focus-visible:ring-[#7c84ff]" style={{ left: `${Math.min(100, (v / T) * 100)}%` }} />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10.5px] text-white/30"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span></div>

        <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[11.5px]">
          {marks.length > 0 && <span className="text-white/35">Jump to</span>}
          {marks.map(([k, t]) => (
            <button key={k} onClick={() => { setPlaying(false); seek(t) }} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-white/70 ring-1 ring-white/10 transition-colors hover:bg-white/[0.12] hover:text-white">
              {k} <span className="text-white/40">{(t / 60).toFixed(1)} h</span>
            </button>
          ))}
          <Link href="/app/lab" className="ml-auto text-white/45 underline-offset-4 hover:text-white hover:underline">Open the Mycelium lab →</Link>
        </div>
      </div>
    </div>
  )
}
