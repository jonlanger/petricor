import { bus, type BusEvent } from '@/lib/server/bus'
import { ensureTwin } from '@/lib/server/twin'

/** Server-Sent Events: device telemetry, run progress, captures, alerts, audit. Filter with ?device=dev_a */
export async function GET(req: Request) {
  ensureTwin()
  const device = new URL(req.url).searchParams.get('device')
  const enc = new TextEncoder()
  let cleanup = () => {}
  const stream = new ReadableStream({
    start(ctrl) {
      const lastSent = new Map<string, number>()
      const send = (e: BusEvent) => {
        if (device && 'deviceId' in e && e.deviceId !== device) return
        if (e.type === 'device') {
          // throttle telemetry to ~4 Hz per device
          const t = Date.now(), k = e.deviceId
          if (t - (lastSent.get(k) ?? 0) < 240) return
          lastSent.set(k, t)
        }
        try { ctrl.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`)) } catch { cleanup() }
      }
      const ping = setInterval(() => { try { ctrl.enqueue(enc.encode(`: ping\n\n`)) } catch { cleanup() } }, 15000)
      bus.on('event', send)
      cleanup = () => { bus.off('event', send); clearInterval(ping) }
      ctrl.enqueue(enc.encode(`event: hello\ndata: {}\n\n`))
    },
    cancel() { cleanup() },
  })
  req.signal.addEventListener('abort', () => cleanup())
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  })
}
