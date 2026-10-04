import Link from 'next/link'
import type { ReactNode } from 'react'

export interface Crumb { href?: string; label: string }

/** Back button to the parent page plus the trail. Mobile shows only the back button and the parent's name. */
export function Breadcrumbs({ crumbs, className = '' }: { crumbs: Crumb[]; className?: string }) {
  const parent = [...crumbs.slice(0, -1)].reverse().find((c) => c.href)
  return (
    <nav aria-label="Breadcrumb" className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      {parent && (
        <Link href={parent.href!} aria-label={`Back to ${parent.label}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-white text-ink/70 transition-colors hover:border-line-2 hover:bg-paper hover:text-ink">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M10 3.5 5.5 8 10 12.5" /></svg>
        </Link>
      )}
      {parent && <Link href={parent.href!} className="truncate text-[13px] text-muted hover:text-ink sm:hidden">{parent.label}</Link>}
      <ol className="hidden min-w-0 items-center gap-1.5 text-[13px] sm:flex">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={i} className={`flex min-w-0 items-center gap-1.5 ${last ? 'min-w-0' : 'shrink-0'}`}>
              {i > 0 && <span className="text-line-2">/</span>}
              {c.href && !last ? <Link href={c.href} className="text-muted hover:text-ink">{c.label}</Link> : <span aria-current={last ? 'page' : undefined} className="truncate text-ink/80">{c.label}</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function PageHead({ eyebrow, title, children, sub, crumbs }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; children?: ReactNode; crumbs?: Crumb[] }) {
  return (
    <div className="flex flex-col gap-4 border-b border-line bg-white px-5 py-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {crumbs && <Breadcrumbs crumbs={crumbs} className="mb-4" />}
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="mt-1 font-mono text-[26px] font-semibold tracking-tight sm:text-[30px]">{title}</h1>
        {sub && <div className="mt-1 text-[14px] text-muted">{sub}</div>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

export function Pill({ tone = 'mute', children }: { tone?: 'ok' | 'warn' | 'crit' | 'blue' | 'mute' | 'uv'; children: ReactNode }) {
  const t = {
    ok: 'bg-ok-50 text-[#127a3b]', warn: 'bg-warn-50 text-[#8a5300]', crit: 'bg-crit-50 text-[#b4252a]',
    blue: 'bg-blue-50 text-blue', mute: 'bg-paper text-ink/65', uv: 'bg-[#f1ecff] text-[#5b3fd1]',
  }[tone]
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-[11.5px] font-medium ${t}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{children}</span>
}

export function Card({ title, action, children, className = '', pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card min-w-0 ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="font-mono text-[13px] font-semibold uppercase tracking-wide text-ink/80">{title}</h2>
          {action}
        </div>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'warn' | 'crit' | 'ok' }) {
  return (
    <div className="card px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className={`mt-2 font-mono text-[34px] font-semibold leading-none tabular ${tone === 'warn' ? 'text-warn' : tone === 'crit' ? 'text-crit' : ''}`}>{value}</div>
      {sub && <div className="mt-2 text-[12.5px] text-muted">{sub}</div>}
    </div>
  )
}

export function Btn({ children, href, onClick, kind = 'ghost', disabled, type }: { children: ReactNode; href?: string; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; type?: 'submit' }) {
  const cls = `inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition-colors disabled:opacity-40 ${
    kind === 'primary' ? 'bg-blue text-white hover:bg-blue-600' : kind === 'danger' ? 'border border-crit/30 text-crit hover:bg-crit-50' : 'border border-line bg-white hover:border-line-2 hover:bg-paper'}`
  if (href) return <a href={href} className={cls}>{children}</a>
  return <button type={type ?? 'button'} onClick={onClick} disabled={disabled} className={cls}>{children}</button>
}

export const stateTone = (s: string) =>
  ({ incubating: 'blue', imaging: 'blue', complete: 'ok', approved: 'ok', idle: 'mute', offline: 'crit', paused: 'warn', pending: 'warn', changes: 'crit', aborted: 'crit', setup: 'mute', loading: 'mute', preparing: 'mute', ready: 'blue', decontaminating: 'uv' } as const)[s] ?? 'mute'
