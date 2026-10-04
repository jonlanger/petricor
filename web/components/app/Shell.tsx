'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import type { User } from '@/lib/domain/types'
import Logo from '@/components/brand/Logo'

const NAV = [
  { href: '/app', label: 'Overview', icon: 'M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z' },
  { href: '/app/devices', label: 'Instruments', icon: 'M4 5h16v10H4zM8 19h8M12 15v4' },
  { href: '/app/runs', label: 'Runs', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 3' },
  { href: '/app/samples', label: 'Samples', icon: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3' },
  { href: '/app/species', label: 'Species library', icon: 'M12 2c3 4 3 8 0 12-3-4-3-8 0-12zM5 13c4 0 7 3 7 9M19 13c-4 0-7 3-7 9' },
  { href: '/app/lab', label: 'Mycelium lab', icon: 'M12 21V11M12 11 7 6M12 11l5-5M7 6 4 5M7 6l-1-3M17 6l3-1M17 6l1-3M12 15l-4 2M12 15l4 2' },
  { href: '/app/audit', label: 'Audit trail', icon: 'M5 4h14v16H5zM9 8h6M9 12h6M9 16h4' },
  { href: '/app/settings', label: 'Settings', icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM2 12h3M19 12h3M12 2v3M12 19v3' },
]

export default function Shell({ user, children }: { user: User; children: ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const logout = async () => { await fetch('/api/session', { method: 'DELETE' }); router.push('/login') }
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-white px-3 py-5 md:flex">
        <Link href="/" className="px-2"><Logo className="h-7 text-[17px]" /></Link>
        <div className="eyebrow mt-6 px-3">Demo Microbiology Lab</div>
        <nav className="mt-2 space-y-0.5">
          {NAV.map((n) => {
            const on = n.href === '/app' ? path === '/app' : path.startsWith(n.href)
            return (
              <Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors ${on ? 'bg-blue-50 font-medium text-blue' : 'text-ink/75 hover:bg-paper'}`}>
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
                {n.label}
              </Link>
            )
          })}
        </nav>
        <Link href="/device" target="_blank" className="mt-6 flex items-center justify-between rounded-lg bg-graphite px-3 py-2.5 text-[13px] text-white hover:bg-graphite-3">
          <span className="font-mono">PC-6 touchscreen</span><span>↗</span>
        </Link>
        <div className="mt-auto flex items-center gap-3 rounded-lg p-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-blue font-mono text-[12px] font-semibold text-white">{user.initials}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{user.name}</span><span className="block truncate text-[12px] text-muted">{user.title}</span></span>
          <button onClick={logout} title="Sign out" className="rounded-md p-1.5 text-muted hover:bg-paper">⏻</button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur md:hidden">
          <Logo className="h-6 text-[15px]" />
          <select className="ml-auto rounded-md border border-line bg-white px-2 py-1 text-[13px]" value={NAV.find((n) => (n.href === '/app' ? path === '/app' : path.startsWith(n.href)))?.href} onChange={(e) => router.push(e.target.value)}>
            {NAV.map((n) => <option key={n.href} value={n.href}>{n.label}</option>)}
          </select>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
