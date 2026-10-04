import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/server/session'
import { ensureTwin } from '@/lib/server/twin'
import Shell from '@/components/app/Shell'

export default async function AppLayout({ children }: LayoutProps<'/app'>) {
  const user = await currentUser()
  if (!user) redirect('/login')
  ensureTwin()
  return <Shell user={user}>{children}</Shell>
}
