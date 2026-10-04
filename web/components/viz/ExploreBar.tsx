'use client'
import type { ReactNode } from 'react'
import type { ViewApi, ViewPreset } from '@/components/three/Mycelium3D'

/**
 * Toolbar for a 3D viewer's explore mode. Off: one button, and the page scrolls over the canvas as normal.
 * On: rotate / pitch / zoom / view presets / reset, and drag, wheel and pinch go to the camera.
 */
export default function ExploreBar({ on, onToggle, api, pitch, autoRotate, onAutoRotate }: {
  on: boolean; onToggle: (v: boolean) => void; api: ViewApi | null; pitch: number; autoRotate: boolean; onAutoRotate: (v: boolean) => void
}) {
  if (!on) {
    return (
      <button onClick={() => onToggle(true)} className="absolute right-3 top-3 z-10 inline-flex h-9 items-center gap-2 rounded-full bg-white/10 px-3.5 font-mono text-[12px] text-white ring-1 ring-white/20 backdrop-blur transition-colors hover:bg-white/20">
        <Ico d="M12 2 3 7v10l9 5 9-5V7zM3 7l9 5 9-5M12 12v10" />Explore in 3D
      </button>
    )
  }
  return (
    <>
      <div className="pointer-events-none absolute right-3 top-3 z-10 max-w-[60%] rounded-lg bg-black/50 px-3 py-2 text-right font-mono text-[11px] leading-relaxed text-white/70 backdrop-blur">
        Drag to rotate · right-drag or two fingers to pan · scroll or pinch to zoom
      </div>
      <div className="absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-center gap-1.5 rounded-xl bg-black/60 p-1.5 text-white ring-1 ring-white/10 backdrop-blur-md">
        <Tool active={autoRotate} onClick={() => onAutoRotate(!autoRotate)} label="Auto-rotate"><Ico d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" /></Tool>
        <Sep />
        {(['angle', 'top', 'side'] as ViewPreset[]).map((v) => (
          <button key={v} onClick={() => api?.preset(v)} className="h-8 rounded-lg px-2.5 font-mono text-[12px] capitalize text-white/80 hover:bg-white/10 hover:text-white">{v}</button>
        ))}
        <Sep />
        <label className="flex h-8 items-center gap-2 px-1.5 font-mono text-[11.5px] text-white/60">
          Pitch
          <input type="range" min={2} max={88} value={Math.round(pitch)} onChange={(e) => api?.setPitch(+e.target.value)} className="w-20 accent-[#7c84ff] sm:w-28" aria-label="Camera pitch" />
          <span className="w-8 tabular text-white/80">{Math.round(pitch)}°</span>
        </label>
        <Sep />
        <Tool onClick={() => api?.zoom(1 / 1.25)} label="Zoom out"><Ico d="M5 12h14" /></Tool>
        <Tool onClick={() => api?.zoom(1.25)} label="Zoom in"><Ico d="M12 5v14M5 12h14" /></Tool>
        <Tool onClick={() => api?.reset()} label="Reset view"><Ico d="M4 4v6h6M4.5 15a8 8 0 1 0 1.9-8.3L4 10" /></Tool>
        <button onClick={() => onToggle(false)} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 font-mono text-[12px] font-medium text-ink hover:bg-white/90">Done</button>
      </div>
    </>
  )
}

function Tool({ children, onClick, label, active }: { children: ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} aria-pressed={active}
      className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${active ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>{children}</button>
  )
}
const Sep = () => <span className="mx-0.5 hidden h-5 w-px bg-white/15 sm:block" />
const Ico = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
