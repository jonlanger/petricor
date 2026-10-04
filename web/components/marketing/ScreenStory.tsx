'use client'
import { useEffect, useRef, useState } from 'react'

export interface Story {
  key: string
  title: string
  body: string
  src: string
  alt: string
  /** browser frame address bar */
  path?: string
  /** optional callout on the screenshot, in % of the image */
  spot?: { x: number; y: number; label: string; side?: 'left' | 'right' }
}

/**
 * Auto-advancing product story: a step list on one side, the matching real screenshot in a device or browser frame
 * on the other. Advances only while on screen and not hovered; every step is also a button.
 */
export default function ScreenStory({ steps, frame, interval = 5200, dark = false, reverse = false }: { steps: Story[]; frame: 'device' | 'browser'; interval?: number; dark?: boolean; reverse?: boolean }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [inView, setInView] = useState(false)
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 })
    if (host.current) io.observe(host.current)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (paused || !inView) return
    const t = setTimeout(() => setI((x) => (x + 1) % steps.length), interval)
    return () => clearTimeout(t)
  }, [i, paused, inView, interval, steps.length])

  const s = steps[i]
  const ink = dark ? 'text-white' : 'text-ink'
  const sub = dark ? 'text-white/60' : 'text-ink/65'
  const rail = dark ? 'bg-white/10' : 'bg-black/[0.08]'

  return (
    <div ref={host} className={`grid items-center gap-10 lg:gap-14 ${reverse ? 'lg:grid-cols-[1.45fr_1fr]' : 'lg:grid-cols-[1fr_1.45fr]'}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <ol className={`order-2 space-y-1 ${reverse ? 'lg:order-2' : 'lg:order-1'}`}>
        {steps.map((x, k) => {
          const on = k === i
          return (
            <li key={x.key}>
              <button onClick={() => setI(k)} className={`group relative w-full rounded-xl px-4 py-3.5 text-left transition-colors ${on ? (dark ? 'bg-white/[0.06]' : 'bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)] ring-1 ring-black/[0.06]') : ''}`} aria-current={on}>
                <div className="flex items-baseline gap-3">
                  <span className={`font-mono text-[12px] tabular ${on ? 'text-blue' : dark ? 'text-white/35' : 'text-ink/35'}`}>{String(k + 1).padStart(2, '0')}</span>
                  <span className={`font-mono text-[17px] font-semibold tracking-tight ${on ? ink : dark ? 'text-white/55 group-hover:text-white/80' : 'text-ink/55 group-hover:text-ink/80'}`}>{x.title}</span>
                </div>
                <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${on ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                  <p className={`overflow-hidden pl-[34px] text-[14.5px] leading-relaxed ${sub}`}><span className="block pt-1.5">{x.body}</span></p>
                </div>
                {on && (
                  <span className={`absolute inset-x-4 bottom-0 h-[2px] overflow-hidden rounded-full ${rail}`}>
                    <span key={`${i}-${paused}-${inView}`} className={`block h-full bg-blue ${paused || !inView ? '' : 'animate-progress'}`} style={{ ['--dur' as string]: `${interval}ms`, transform: paused || !inView ? 'scaleX(0)' : undefined }} />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>

      <div className={`order-1 min-w-0 ${reverse ? 'lg:order-1' : 'lg:order-2'}`}>
        <Frame kind={frame} path={s.path}>
          {steps.map((x, k) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={x.key} src={x.src} alt={x.alt} loading={k < 2 ? 'eager' : 'lazy'} decoding="async"
              className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-700 ease-out ${k === i ? 'opacity-100' : 'opacity-0'}`} />
          ))}
          {s.spot && <Spot key={s.key} {...s.spot} />}
        </Frame>
      </div>
    </div>
  )
}

function Frame({ kind, path, children }: { kind: 'device' | 'browser'; path?: string; children: React.ReactNode }) {
  if (kind === 'device') {
    return (
      <div className="relative rounded-[30px] bg-gradient-to-b from-[#24262d] to-[#0c0d10] p-[14px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.06)_inset]">
        <div className="relative aspect-[16/10] overflow-hidden rounded-[16px] bg-graphite ring-1 ring-black">
          {children}
          {/* cover-glass reflection */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0)_38%)]" />
        </div>
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_40px_80px_-40px_rgba(16,18,40,0.35)] ring-1 ring-black/[0.08]">
      <div className="flex h-10 items-center gap-2 border-b border-black/[0.06] bg-[#f7f8fa] px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-black/10" /><span className="h-2.5 w-2.5 rounded-full bg-black/10" /><span className="h-2.5 w-2.5 rounded-full bg-black/10" />
        <div className="mx-auto flex h-6 min-w-0 max-w-[60%] flex-1 items-center justify-center rounded-md bg-white px-3 font-mono text-[11px] text-ink/45 ring-1 ring-black/[0.06]">
          <span className="truncate">petricor cloud {path ?? ''}</span>
        </div>
        <span className="w-[52px]" />
      </div>
      <div className="relative aspect-[16/10] overflow-hidden bg-paper">{children}</div>
    </div>
  )
}

function Spot({ x, y, label, side = 'right' }: { x: number; y: number; label: string; side?: 'left' | 'right' }) {
  return (
    <div className="pointer-events-none absolute animate-rise" style={{ left: `${x}%`, top: `${y}%`, animationDelay: '450ms' }}>
      <span className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-blue/50 animate-ping-soft" />
      <span className="absolute -left-[5px] -top-[5px] h-[10px] w-[10px] rounded-full bg-blue ring-2 ring-white" />
      <span className={`absolute top-[-13px] whitespace-nowrap rounded-full bg-ink/90 px-3 py-1 font-mono text-[11.5px] text-white shadow-lg backdrop-blur ${side === 'right' ? 'left-4' : 'right-4'}`}>{label}</span>
    </div>
  )
}
