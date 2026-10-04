import { notFound } from 'next/navigation'
import { db } from '@/lib/server/store'
import { can, currentUser } from '@/lib/server/session'
import { summary } from '@/lib/server/twin'
import RunWorkspace from './RunWorkspace'

export default async function RunPage({ params, searchParams }: PageProps<'/app/runs/[id]'>) {
  const { id } = await params
  const sp = await searchParams
  const s = db()
  const run = s.runs.find((r) => r.id === id)
  if (!run) notFound()
  const user = await currentUser()
  const protocol = s.protocols.find((p) => p.id === run.protocolId)!
  const device = s.devices.find((d) => d.id === run.deviceId)!
  const samples = run.dishes.map((d) => s.samples.find((x) => x.id === d.sampleId)!)
  return (
    <RunWorkspace run={summary(run)} protocol={protocol} device={device} samples={samples} users={s.users}
      canReview={can.review(user)} initialDish={Number(sp.dish) || 1} />
  )
}
