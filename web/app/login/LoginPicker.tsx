'use client'
import { useRouter } from 'next/navigation'
import type { User } from '@/lib/domain/types'

export default function LoginPicker({ users, next }: { users: User[]; next: string }) {
  const router = useRouter()
  const go = async (id: string) => {
    await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id }) })
    router.push(next.startsWith('/app') ? next : '/app')
  }
  return (
    <div className="mt-8 max-w-md space-y-2">
      {users.map((u) => (
        <button key={u.id} onClick={() => go(u.id)} className="card flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:border-blue">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-blue font-mono text-[13px] font-semibold text-white">{u.initials}</span>
          <span className="flex-1"><span className="block font-medium">{u.name}</span><span className="block text-[13px] text-muted">{u.title}</span></span>
          <span className="font-mono text-[11px] uppercase text-muted">{u.role}</span>
        </button>
      ))}
    </div>
  )
}
