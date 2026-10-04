import { resetStore } from '@/lib/server/store'

/** Resets the demo dataset (seed). */
export async function POST() {
  resetStore()
  ;(globalThis as { __pcMech?: Map<string, unknown> }).__pcMech?.clear()
  return Response.json({ ok: true })
}
