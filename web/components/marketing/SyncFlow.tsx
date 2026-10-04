import type { ReactNode } from 'react'

/** Instrument → cloud → record, with data packets travelling between them. */
export default function SyncFlow({ nodes }: { nodes: { k: string; t: string; d: string; icon: ReactNode }[] }) {
  return (
    <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center md:gap-0">
      {nodes.map((n, i) => (
        <div key={n.k} className="contents">
          <div className="card relative flex-1 p-6 md:max-w-[360px]">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue">{n.icon}</div>
            <div className="mt-5 font-mono text-[12px] uppercase tracking-[0.1em] text-muted">{n.k}</div>
            <div className="mt-1 font-mono text-[20px] font-semibold tracking-tight">{n.t}</div>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink/65">{n.d}</p>
          </div>
          {i < nodes.length - 1 && (
            <div aria-hidden className="relative mx-auto h-10 w-px md:mx-0 md:h-px md:w-auto md:min-w-[56px] md:flex-[0.35]">
              <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none">
                <line x1="0" y1="50%" x2="100%" y2="50%" className="hidden md:block" stroke="#3a44ff" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="4 8" />
                <line x1="50%" y1="0" x2="50%" y2="100%" className="md:hidden" stroke="#3a44ff" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="4 8" />
              </svg>
              <span className="absolute top-1/2 hidden h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue shadow-[0_0_12px_#3a44ff] md:block animate-travel" style={{ animationDelay: `${i * 1.4}s` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
