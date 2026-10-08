'use client'
import { useState } from 'react'
import type { User } from '@/lib/domain/types'

/** Native form post: signs in even before hydration (cold starts), and the server redirects into the app. */
export default function LoginPicker({ users, next }: { users: User[]; next: string }) {
  const [pending, setPending] = useState<string | null>(null)
  return (
    <form method="post" action="/api/session" onSubmit={(e) => setPending(((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value ?? null)} className="mt-8 max-w-md space-y-2">
      <input type="hidden" name="next" value={next} />
      {users.map((u) => (
        <button key={u.id} type="submit" name="userId" value={u.id} disabled={!!pending && pending !== u.id} aria-busy={pending === u.id} className="card flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:border-blue disabled:opacity-50">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-blue font-mono text-[13px] font-semibold text-white">{u.initials}</span>
          <span className="flex-1"><span className="block font-medium">{u.name}</span><span className="block text-[13px] text-muted">{u.title}</span></span>
          <span className="font-mono text-[11px] uppercase text-muted">{pending === u.id ? 'Signing in…' : u.role}</span>
        </button>
      ))}
    </form>
  )
}
