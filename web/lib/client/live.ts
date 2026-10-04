'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Alert, Device, Protocol, Sample, User, Run } from '../domain/types'
import type { EnvSample } from '../science/cmi'

export type RunSummary = Omit<Run, 'dishes' | 'env'> & {
  dishes: (Omit<Run['dishes'][number], 'truth'> & { n: number })[]
  envTail?: EnvSample
}

export interface LatestDish {
  position: number
  barcode: string
  sampleId: string
  h: number
  count: number
  coverage: number
  bySpecies: Record<string, number>
  colonies: { id: string; x: number; y: number; r: number; key: string; p: number }[]
}

export interface LiveState {
  devices: Device[]
  protocols: Protocol[]
  users: User[]
  samples: Sample[]
  runs: RunSummary[]
  alerts: Alert[]
  latest: Record<string, LatestDish[]>
  env: Record<string, EnvSample[]>
}

/** Snapshot + SSE stream. Telemetry merges in place; run/capture/alert events trigger a debounced refetch. */
export function useLive(deviceId?: string) {
  const [state, setState] = useState<LiveState | null>(null)
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState<{ type: string; at: number; data: unknown }[]>([])
  const refetchT = useRef<ReturnType<typeof setTimeout> | null>(null)
  const q = deviceId ? `?device=${deviceId}` : ''

  const refetch = useCallback(async () => {
    const r = await fetch(`/api/state${q}`, { cache: 'no-store' })
    if (r.ok) setState(await r.json())
  }, [q])

  const soon = useCallback(() => {
    if (refetchT.current) return
    refetchT.current = setTimeout(() => { refetchT.current = null; refetch() }, 250)
  }, [refetch])

  useEffect(() => {
    // subscribing to an external system (initial snapshot + SSE) is the intended use of an effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetch()
    const es = new EventSource(`/api/stream${q}`)
    es.addEventListener('hello', () => setConnected(true))
    es.onerror = () => setConnected(false)
    es.addEventListener('device', (e) => {
      const { data } = JSON.parse((e as MessageEvent).data) as { data: Device }
      setState((s) => {
        if (!s) return s
        const prev = s.devices.find((d) => d.id === data.id)
        const env = { ...s.env }
        // keep a rolling live tail of telemetry for sparklines while a run is active
        if (data.activeRunId && prev) {
          const tail = env[data.activeRunId] ?? []
          const run = s.runs.find((r) => r.id === data.activeRunId)
          if (run && run.state === 'incubating') {
            const h = run.elapsedH
            if (!tail.length || h - tail[tail.length - 1].h >= 0.05) env[data.activeRunId] = [...tail.slice(-600), { h, T: data.telemetry.T, RH: data.telemetry.RH }]
          }
        }
        return { ...s, env, devices: s.devices.map((d) => (d.id === data.id ? data : d)) }
      })
    })
    for (const t of ['run', 'capture', 'alert', 'print', 'scan', 'audit']) {
      es.addEventListener(t, (e) => {
        const data = JSON.parse((e as MessageEvent).data)
        setEvents((ev) => [{ type: t, at: Date.now(), data }, ...ev].slice(0, 30))
        if (t === 'run') {
          // advance elapsed hours locally for smooth progress between refetches
          setState((s) => (s ? { ...s, runs: s.runs.map((r) => (r.id === data.runId ? { ...r, ...data.data } : r)) } : s))
        }
        if (t !== 'print' && t !== 'scan') soon()
      })
    }
    // periodic refresh keeps elapsed time / latest frames fresh
    const iv = setInterval(refetch, 4000)
    return () => { es.close(); clearInterval(iv) }
  }, [q, refetch, soon])

  return { state, connected, events, refetch }
}

export async function sendCommand(deviceId: string, cmd: Record<string, unknown>) {
  const r = await fetch(`/api/devices/${deviceId}/commands`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error ?? 'Command failed')
  return j
}

export const fmtDur = (h: number) => {
  const d = Math.floor(h / 24), hh = Math.floor(h % 24), mm = Math.floor((h * 60) % 60)
  return d ? `${d}d ${hh}h ${mm.toString().padStart(2, '0')}m` : `${hh}h ${mm.toString().padStart(2, '0')}m`
}
