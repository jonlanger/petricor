import 'server-only'
import { db, save, uid } from './store'
import { emit } from './bus'
import type { Alert, Device, Dish, Run, Sample, SourceType } from '../domain/types'
import { drawInoculum, hash } from '../science/colonies'

/**
 * Device twin — a stand-in for PC-6 firmware so the full system runs without hardware.
 *
 * Real device split (see docs/ARCHITECTURE.md):
 *   • Real-time MCU: PID climate loops, stepper motion, interlocks, over-temp cut-out.
 *   • Compute module: UI, camera pipeline, colony detection, store-and-forward sync.
 * The twin emulates the observable behaviour of both at an accelerated simulated clock.
 */

const TICK_MS = 250
const IMAGING_DWELL_MS = 650
const CAROUSEL_DEG_PER_S = 120
const ENV_STEP_H = 0.25

interface Mech {
  targetAngle: number
  imaging: null | { queue: number[]; dwellUntil: number; h: number }
  printQueue: string[]
  printUntil: number
  decontUntil: number
  lastEnvH: number
  doorOpenedAtSim: number | null
  tempAlarmRaised: boolean
}

type G = typeof globalThis & { __pcTwinToken?: symbol; __pcTwinTimer?: NodeJS.Timeout; __pcMech?: Map<string, Mech> }
const g = globalThis as G
const TOKEN = Symbol('twin')
const mech: Map<string, Mech> = g.__pcMech ?? (g.__pcMech = new Map())

function m(d: Device): Mech {
  let x = mech.get(d.id)
  if (!x) {
    x = { targetAngle: d.carouselAngle, imaging: null, printQueue: [], printUntil: 0, decontUntil: 0, lastEnvH: -1, doorOpenedAtSim: null, tempAlarmRaised: false }
    mech.set(d.id, x)
  }
  return x
}

export function ensureTwin() {
  if (g.__pcTwinToken === TOKEN && g.__pcTwinTimer) return
  if (g.__pcTwinTimer) clearInterval(g.__pcTwinTimer)
  g.__pcTwinToken = TOKEN
  let last = Date.now()
  g.__pcTwinTimer = setInterval(() => {
    const now = Date.now()
    const dt = Math.min((now - last) / 1000, 1)
    last = now
    try {
      tick(dt, now)
    } catch (e) {
      console.error('[twin] tick failed', e)
    }
  }, TICK_MS)
}

const approach = (x: number, target: number, dt: number, tau: number) => target + (x - target) * Math.exp(-dt / tau)
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
const jitter = (s: number) => (Math.random() - 0.5) * s

export function activeRun(d: Device): Run | undefined {
  return d.activeRunId ? db().runs.find((r) => r.id === d.activeRunId) : undefined
}

export function protocolOf(r: Run) {
  return db().protocols.find((p) => p.id === r.protocolId)!
}

function tick(dtReal: number, now: number) {
  const store = db()
  for (const d of store.devices) {
    if (!d.simulated || !d.online) continue
    const x = m(d)
    // imaging a dish takes real seconds; cap the clock during a sequence so scheduled slots are never skipped
    const dtSim = dtReal * (x.imaging ? Math.min(d.speed, 60) : d.speed)
    d.simClock += dtSim * 1000
    d.lastSeen = now
    const run = activeRun(d)
    stepClimate(d, run, dtSim)
    stepCarousel(d, x, dtReal)
    stepPrinter(d, x, now)
    if (run) stepRun(d, run, x, dtSim, now)
    if (d.state === 'decontaminating' && now > x.decontUntil) {
      d.state = 'idle'
      d.activity = null
      d.cycle = null
      d.telemetry.uvcCycles += 1
      audit('device', 'uvc.complete', d.id)
    }
    emit({ type: 'device', deviceId: d.id, data: d })
  }
  save()
}

function stepClimate(d: Device, run: Run | undefined, dt: number) {
  const t = d.telemetry
  const controlled = !!run && ['incubating', 'imaging', 'paused', 'loading', 'ready'].includes(d.state)
  if (d.doorOpen) {
    t.T = approach(t.T, t.ambientT, dt, 240)
    t.RH = approach(t.RH, 45, dt, 120)
    t.tecPct = approach(t.tecPct, 0, dt, 30)
    t.mistPct = 0
    t.fanPct = 15
  } else if (controlled) {
    t.T = approach(t.T, t.setT, dt, 900)
    t.RH = approach(t.RH, t.setRH, dt, 600)
    t.tecPct = clamp((t.setT - t.T) * 60 + (t.setT - t.ambientT) * 2, -100, 100)
    t.mistPct = clamp((t.setRH - t.RH) * 8 + 10, 0, 100)
    t.fanPct = 35
    t.reservoirPct = Math.max(0, t.reservoirPct - (t.mistPct / 100) * dt * (50 / 86400))
    t.hepaHours += dt / 3600
  } else {
    t.T = approach(t.T, t.ambientT, dt, 3600)
    t.RH = approach(t.RH, 48, dt, 1800)
    t.tecPct = approach(t.tecPct, 0, dt, 60)
    t.mistPct = 0
    t.fanPct = 10
  }
  t.T = +(t.T + jitter(0.01)).toFixed(3)
  t.RH = +clamp(t.RH + jitter(0.08), 0, 100).toFixed(2)
  if (t.reservoirPct < 15) raise(d, 'RESERVOIR_LOW', 'warning', 'Humidifier reservoir below 15 %. Refill through the rear hatch.')
}

function stepCarousel(d: Device, x: Mech, dtReal: number) {
  const diff = ((x.targetAngle - d.carouselAngle + 540) % 360) - 180
  const step = CAROUSEL_DEG_PER_S * dtReal
  if (Math.abs(diff) <= step) d.carouselAngle = x.targetAngle
  else d.carouselAngle = (d.carouselAngle + Math.sign(diff) * step + 360) % 360
  d.stationPos = (Math.round(d.carouselAngle / 60) % 6) + 1
}

function stepPrinter(d: Device, x: Mech, now: number) {
  if (!x.printQueue.length) {
    if (d.printer.busy) { d.printer.busy = false; if (d.activity?.startsWith('Printing')) d.activity = null }
    return
  }
  d.printer.busy = true
  if (now < x.printUntil) return
  const b = x.printQueue.shift()!
  d.printer.labelsLeft -= 1
  d.activity = x.printQueue.length ? `Printing label ${b}` : null
  x.printUntil = now + 900
  const run = activeRun(d)
  const dish = run?.dishes.find((dd) => dd.barcode === b)
  if (dish) dish.printedAt = now
  emit({ type: 'print', deviceId: d.id, barcodes: [b] })
}

function stepRun(d: Device, run: Run, x: Mech, dtSim: number, now: number) {
  const p = protocolOf(run)
  if (run.state === 'incubating') {
    run.elapsedH += dtSim / 3600
    // environment log
    const slot = Math.floor(run.elapsedH / ENV_STEP_H) * ENV_STEP_H
    const lastLogged = run.env.length ? run.env[run.env.length - 1].h : -1
    if (slot > lastLogged + 1e-9) {
      run.env.push({ h: +slot.toFixed(2), T: +d.telemetry.T.toFixed(2), RH: +d.telemetry.RH.toFixed(1) })
    }
    // temperature deviation alarm (ignore 30 sim-min after door events)
    const settled = x.doorOpenedAtSim === null || d.simClock - x.doorOpenedAtSim > 30 * 60e3
    if (settled && Math.abs(d.telemetry.T - d.telemetry.setT) > 1.0 && !x.tempAlarmRaised) {
      x.tempAlarmRaised = true
      raise(d, 'TEMP_DEVIATION', 'critical', `Chamber at ${d.telemetry.T.toFixed(1)} °C, setpoint ${d.telemetry.setT} °C.`, run.id)
    }
    if (Math.abs(d.telemetry.T - d.telemetry.setT) < 0.5) x.tempAlarmRaised = false
    // capture schedule
    const lastCap = run.captures.length ? run.captures[run.captures.length - 1] : -Infinity
    if (!x.imaging && run.elapsedH >= lastCap + p.captureEveryH - 1e-6 && !d.doorOpen) startImaging(d, run, x, now, lastCap + p.captureEveryH)
    if (run.elapsedH >= p.durationH) {
      run.elapsedH = p.durationH
      run.state = 'complete'
      run.completedAt = now
      run.events.push({ h: run.elapsedH, at: now, kind: 'complete', text: 'Incubation complete' })
      d.state = 'complete'
      d.activity = 'Run complete — ready to unload'
      raise(d, 'RUN_COMPLETE', 'info', `${run.name} is complete and ready for review.`, run.id)
      audit('device', 'run.complete', run.id)
      emit({ type: 'run', runId: run.id, data: summary(run) })
    }
  }
  if (x.imaging) stepImaging(d, run, x, now)
}

function startImaging(d: Device, run: Run, x: Mech, now: number, slot?: number) {
  // scheduled captures are recorded at their planned slot; manual ones at the current time
  const h = +(slot ?? run.elapsedH).toFixed(2)
  const order = [0, 1, 2, 3, 4, 5].map((i) => ((d.stationPos - 1 + i) % 6) + 1).filter((pos) => run.dishes.some((dd) => dd.position === pos))
  x.imaging = { queue: order, dwellUntil: 0, h }
  d.state = 'imaging'
}

function stepImaging(d: Device, run: Run, x: Mech, now: number) {
  const im = x.imaging!
  if (!im.queue.length) {
    x.imaging = null
    run.captures.push(im.h)
    d.state = run.state === 'incubating' ? 'incubating' : d.state
    d.activity = null
    emit({ type: 'capture', runId: run.id, h: im.h })
    emit({ type: 'run', runId: run.id, data: summary(run) })
    return
  }
  const pos = im.queue[0]
  const target = (pos - 1) * 60
  x.targetAngle = target
  if (Math.abs(((d.carouselAngle - target + 540) % 360) - 180) < 0.5) {
    if (!im.dwellUntil) im.dwellUntil = now + IMAGING_DWELL_MS
    d.activity = `Imaging dish ${pos} · ${protocolOf(run).channels.length} channels`
    if (now >= im.dwellUntil) { im.queue.shift(); im.dwellUntil = 0 }
  } else {
    d.activity = `Indexing to dish ${pos}`
  }
}

// ------------------------------------------------------------------ alerts / audit

export function raise(d: Device, code: string, level: Alert['level'], text: string, runId?: string) {
  const store = db()
  const open = store.alerts.find((a) => a.deviceId === d.id && a.code === code && !a.ackAt)
  if (open) return
  const a: Alert = { id: uid('al'), deviceId: d.id, runId, level, code, text, at: Date.now() }
  store.alerts.unshift(a)
  emit({ type: 'alert', data: a })
}

export function audit(actor: string, action: string, target: string, detail?: string) {
  const e = { id: uid('au'), at: Date.now(), actor, action, target, detail }
  db().audit.unshift(e)
  if (db().audit.length > 2000) db().audit.length = 2000
  emit({ type: 'audit', data: e })
}

export function summary(r: Run) {
  const { dishes, env, ...rest } = r
  return { ...rest, dishes: dishes.map(({ truth, ...dd }) => ({ ...dd, n: truth.length })), envTail: env.slice(-1)[0] }
}

// ------------------------------------------------------------------ commands

export class CommandError extends Error {
  status = 409
}

export type Command =
  | { type: 'door'; open: boolean }
  | { type: 'new_run'; protocolId: string; name?: string; operatorId: string; sampleIds: string[] }
  | { type: 'add_sample'; label: string; source: SourceType; location?: string; operatorId: string; referenceSpecies?: string }
  | { type: 'print_labels' }
  | { type: 'scan'; barcode: string; operatorId?: string }
  | { type: 'present'; position: number }
  | { type: 'load'; position: number; operatorId?: string }
  | { type: 'start'; operatorId: string }
  | { type: 'capture_now' }
  | { type: 'pause' } | { type: 'resume' }
  | { type: 'abort'; operatorId: string }
  | { type: 'unload'; operatorId: string }
  | { type: 'decontaminate' }
  | { type: 'speed'; speed: number }
  | { type: 'refill' }
  | { type: 'cancel_setup'; operatorId: string }

export function command(deviceId: string, c: Command) {
  ensureTwin()
  const store = db()
  const d = store.devices.find((x) => x.id === deviceId)
  if (!d) throw Object.assign(new CommandError('Unknown device'), { status: 404 })
  if (!d.online) throw new CommandError('Device is offline')
  const x = m(d)
  const run = activeRun(d)
  const now = Date.now()
  const need = (ok: unknown, msg: string) => { if (!ok) throw new CommandError(msg) }

  switch (c.type) {
    case 'door': {
      need(!x.imaging || !c.open, 'Door is locked while imaging')
      need(d.state !== 'decontaminating' || !c.open, 'Door is locked during UV-C decontamination')
      d.doorOpen = c.open
      if (c.open && run?.state === 'incubating') {
        x.doorOpenedAtSim = d.simClock
        run.events.push({ h: run.elapsedH, at: now, kind: 'door', text: 'Door opened during incubation' })
        raise(d, 'DOOR_OPEN', 'warning', 'Door opened during incubation — chamber conditions disturbed.', run.id)
      }
      if (!c.open) {
        x.doorOpenedAtSim = d.simClock
        if (d.activity?.startsWith('Dishes removed')) d.activity = null
        const a = store.alerts.find((al) => al.deviceId === d.id && al.code === 'DOOR_OPEN' && !al.ackAt)
        if (a) { a.ackAt = now; a.ackBy = 'device' }
      }
      break
    }
    case 'add_sample': {
      const b = nextBarcode()
      const s: Sample = {
        id: `s_${b.toLowerCase()}`, barcode: b, label: c.label, source: c.source, location: c.location ?? '', collectedAt: now,
        collectedBy: c.operatorId, referenceSpecies: c.referenceSpecies, custody: [{ at: now, event: 'Registered at device', by: c.operatorId, deviceId }],
      }
      store.samples.unshift(s)
      audit(c.operatorId, 'sample.create', s.id, s.label)
      return { sample: s }
    }
    case 'new_run': {
      need(!run || ['complete', 'aborted'].includes(run.state), 'A run is already active on this device')
      need(c.sampleIds.length >= 1 && c.sampleIds.length <= 6, 'Choose 1–6 samples')
      const p = store.protocols.find((pp) => pp.id === c.protocolId)
      need(p, 'Unknown protocol')
      const id = uid('run')
      const dishes: Dish[] = c.sampleIds.map((sid, i) => {
        const s = store.samples.find((ss) => ss.id === sid)!
        return { position: i + 1, sampleId: sid, barcode: s.barcode, truth: [] }
      })
      const r: Run = {
        id, name: c.name || `${p!.name} — ${new Date(now).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`,
        deviceId, protocolId: p!.id, operatorId: c.operatorId, state: 'setup', createdAt: now, startedAt: null, completedAt: null,
        elapsedH: 0, dishes, env: [], captures: [], events: [], review: { status: 'pending' },
      }
      store.runs.unshift(r)
      d.activeRunId = id
      d.state = 'preparing'
      d.telemetry.setT = p!.tempC
      d.telemetry.setRH = p!.rh
      audit(c.operatorId, 'run.create', id, r.name)
      emit({ type: 'run', runId: id, data: summary(r) })
      return { run: summary(r) }
    }
    case 'print_labels': {
      need(run && run.state === 'setup', 'No run in setup')
      x.printQueue.push(...run!.dishes.filter((dd) => !dd.printedAt).map((dd) => dd.barcode))
      d.activity = 'Printing labels'
      break
    }
    case 'scan': {
      emit({ type: 'scan', deviceId, barcode: c.barcode })
      const dish = run?.dishes.find((dd) => dd.barcode === c.barcode)
      need(dish, `Barcode ${c.barcode} is not part of the active run`)
      dish!.scannedAt = now
      const s = store.samples.find((ss) => ss.id === dish!.sampleId)
      s?.custody.push({ at: now, event: 'Scanned at side reader', by: c.operatorId ?? 'device', deviceId })
      if (run!.dishes.every((dd) => dd.scannedAt)) { run!.state = 'loading'; d.state = 'loading' }
      return { dish }
    }
    case 'present': {
      // bring position p to the front loading bay (180° from the imaging station)
      x.targetAngle = (((c.position - 1) * 60 + 180) % 360)
      d.activity = `Presenting position ${c.position}`
      break
    }
    case 'load': {
      need(d.doorOpen, 'Open the door to load dishes')
      const dish = run?.dishes.find((dd) => dd.position === c.position)
      need(dish, 'No dish assigned to that position')
      need(dish!.scannedAt, `Scan dish ${c.position} (${dish!.barcode}) at the side reader first`)
      dish!.loadedAt = now
      const s = store.samples.find((ss) => ss.id === dish!.sampleId)
      s?.custody.push({ at: now, event: `Loaded at position ${c.position}`, by: c.operatorId ?? 'device', deviceId })
      if (run!.dishes.every((dd) => dd.loadedAt)) { d.state = 'ready'; d.activity = 'All dishes loaded — close the door to start' }
      break
    }
    case 'start': {
      need(run && ['setup', 'loading'].includes(run.state) || d.state === 'ready', 'Nothing to start')
      need(!d.doorOpen, 'Close the door to start incubation')
      need(run!.dishes.every((dd) => dd.scannedAt && dd.loadedAt), 'Scan and load every dish first')
      for (const dd of run!.dishes) {
        const s = store.samples.find((ss) => ss.id === dd.sampleId)!
        dd.truth = drawInoculum(hash(run!.id + dd.sampleId), s.source, s.referenceSpecies)
      }
      run!.state = 'incubating'
      run!.startedAt = now
      run!.env = [{ h: 0, T: d.telemetry.T, RH: d.telemetry.RH }]
      run!.events.push({ h: 0, at: now, kind: 'start', text: `Incubation started at ${d.telemetry.setT} °C / ${d.telemetry.setRH}% RH` })
      d.state = 'incubating'
      d.activity = null
      x.targetAngle = 0
      startImaging(d, run!, x, now) // t0 capture
      audit(c.operatorId, 'run.start', run!.id)
      emit({ type: 'run', runId: run!.id, data: summary(run!) })
      break
    }
    case 'capture_now': {
      need(run?.state === 'incubating' && !x.imaging, 'Imaging is only available during incubation')
      need(!d.doorOpen, 'Close the door first')
      startImaging(d, run!, x, now)
      break
    }
    case 'pause': need(run?.state === 'incubating', 'Not incubating'); run!.state = 'paused'; d.state = 'paused'; run!.events.push({ h: run!.elapsedH, at: now, kind: 'pause', text: 'Paused' }); break
    case 'resume': need(run?.state === 'paused', 'Not paused'); run!.state = 'incubating'; d.state = 'incubating'; run!.events.push({ h: run!.elapsedH, at: now, kind: 'resume', text: 'Resumed' }); break
    case 'abort': {
      need(run && !['complete', 'aborted'].includes(run.state), 'No active run')
      run!.state = 'aborted'; run!.completedAt = now
      run!.events.push({ h: run!.elapsedH, at: now, kind: 'abort', text: 'Run aborted' })
      d.state = 'complete'; d.activity = 'Run aborted — unload dishes'
      x.imaging = null
      audit(c.operatorId, 'run.abort', run!.id)
      break
    }
    case 'cancel_setup': {
      need(run && ['setup', 'loading'].includes(run.state), 'Nothing to cancel')
      store.runs = store.runs.filter((r) => r.id !== run!.id)
      d.activeRunId = null; d.state = 'idle'; d.activity = null
      audit(c.operatorId, 'run.cancel', run!.id)
      break
    }
    case 'unload': {
      need(d.state === 'complete', 'Run is not complete')
      need(d.doorOpen, 'Open the door to unload')
      for (const dd of run?.dishes ?? []) {
        store.samples.find((ss) => ss.id === dd.sampleId)?.custody.push({ at: now, event: 'Unloaded', by: c.operatorId, deviceId })
      }
      d.activeRunId = null
      d.state = 'idle'
      d.activity = 'Dishes removed — close door to run UV-C'
      audit(c.operatorId, 'run.unload', run?.id ?? '-')
      break
    }
    case 'decontaminate': {
      need(!run || ['complete', 'aborted'].includes(run.state), 'Not while a run is active')
      need(!d.doorOpen, 'Close the door first')
      d.state = 'decontaminating'
      d.activity = 'UV-C surface decontamination'
      x.decontUntil = now + 12_000
      d.cycle = { kind: 'uvc', startedAt: now, endsAt: x.decontUntil }
      break
    }
    case 'speed': d.speed = clamp(c.speed, 1, 20000); break
    case 'refill': d.telemetry.reservoirPct = 100; { const a = store.alerts.find((al) => al.deviceId === d.id && al.code === 'RESERVOIR_LOW' && !al.ackAt); if (a) { a.ackAt = now; a.ackBy = 'device' } } break
  }
  save()
  emit({ type: 'device', deviceId, data: d })
  return { device: d, run: activeRun(d) ? summary(activeRun(d)!) : null }
}

function nextBarcode() {
  const nums = db().samples.map((s) => parseInt(s.barcode.slice(2), 10)).filter(Number.isFinite)
  return `PC${(Math.max(30_000, ...nums) + 1).toString().padStart(8, '0')}`
}
