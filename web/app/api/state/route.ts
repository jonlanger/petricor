import { db } from '@/lib/server/store'
import { ensureTwin, summary } from '@/lib/server/twin'
import { latest } from '@/lib/server/pipeline'

/** Snapshot for dashboards and the device UI (no ground truth). */
export async function GET(req: Request) {
  ensureTwin()
  const s = db()
  const device = new URL(req.url).searchParams.get('device')
  const devices = device ? s.devices.filter((d) => d.id === device) : s.devices
  const runs = s.runs.filter((r) => !device || r.deviceId === device)
  const active = devices.map((d) => s.runs.find((r) => r.id === d.activeRunId)).filter(Boolean)
  return Response.json({
    devices,
    protocols: s.protocols,
    users: s.users,
    samples: s.samples.slice(0, 200),
    runs: runs.map(summary),
    alerts: s.alerts.filter((a) => !device || a.deviceId === device).slice(0, 50),
    latest: Object.fromEntries(active.map((r) => [r!.id, r!.captures.length ? latest(r!) : []])),
    env: Object.fromEntries(active.map((r) => [r!.id, r!.env.slice(-400)])),
  })
}
