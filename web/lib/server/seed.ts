import type { Device, Protocol, Run, Sample, StoreShape, User, Dish } from '../domain/types'
import type { EnvSample } from '../science/cmi'
import { drawInoculum, hash, rng } from '../science/colonies'

/** Demo organisation. Personas come from the Petricor research archetypes. */
const USERS: User[] = [
  { id: 'u_alex', name: 'Dr. Alex Morgan', role: 'microbiologist', title: 'Senior Microbiologist', initials: 'AM', badge: '0412-7781' },
  { id: 'u_emily', name: 'Dr. Emily Thompson', role: 'mycologist', title: 'Senior Mycologist', initials: 'ET', badge: '0412-7790' },
  { id: 'u_jane', name: 'Dr. Jane Miller', role: 'mycologist', title: 'Environmental Mycologist', initials: 'JM', badge: '0412-7802' },
  { id: 'u_michael', name: 'Dr. Michael Brown', role: 'director', title: 'Lab Director', initials: 'MB', badge: '0412-7655' },
  { id: 'u_sam', name: 'Sam Ortiz', role: 'technician', title: 'Lab Technician', initials: 'SO', badge: '0412-8120' },
]

const PROTOCOLS: Protocol[] = [
  { id: 'p_ym', name: 'Yeast & mold enumeration', medium: 'DRBC agar', tempC: 25, rh: 85, durationH: 120, captureEveryH: 2,
    channels: ['white', 'transillum'], description: 'Surface-spread product samples. Counts and presumptive genus per dish at every capture.' },
  { id: 'p_air', name: 'Environmental air monitoring', medium: 'Sabouraud dextrose agar', tempC: 25, rh: 80, durationH: 168, captureEveryH: 4,
    channels: ['white', 'uv365'], description: 'Settle plates or active air samples from monitored rooms. Trend view by location.' },
  { id: 'p_qc', name: 'Reference strain QC', medium: 'Potato dextrose agar', tempC: 25, rh: 85, durationH: 96, captureEveryH: 1,
    channels: ['white', 'uv365', 'transillum', 'ir850'], description: 'Single-point inoculation of a reference strain. Radial growth rate vs. expected.' },
  { id: 'p_clin', name: 'Clinical isolate culture', medium: 'Sabouraud dextrose agar', tempC: 30, rh: 85, durationH: 72, captureEveryH: 2,
    channels: ['white', 'ir850'], description: 'Primary culture of submitted isolates for morphology review by a mycologist.' },
]

export function envLog(hours: number, setT: number, setRH: number, seed: number, from = 0): EnvSample[] {
  const r = rng(seed)
  const out: EnvSample[] = []
  for (let h = from; h <= hours + 1e-9; h += 0.25) {
    const warm = 1 - Math.exp(-h / 0.35)
    out.push({
      h: +h.toFixed(2),
      T: +(22 + (setT - 22) * warm + (r() - 0.5) * 0.12).toFixed(2),
      RH: +(48 + (setRH - 48) * warm + (r() - 0.5) * 1.2).toFixed(1),
    })
  }
  return out
}

function device(id: string, serial: string, name: string, location: string, over: Partial<Device> = {}): Device {
  return {
    id, serial, name, location, model: 'PC-6', firmware: '1.4.2', simulated: true, state: 'idle', doorOpen: false,
    carouselAngle: 0, stationPos: 1, printer: { labelsLeft: 412, busy: false },
    telemetry: { T: 22, RH: 46, setT: 25, setRH: 85, ambientT: 22, reservoirPct: 78, hepaHours: 1640, uvcCycles: 212, tecPct: 0, fanPct: 20, mistPct: 0 },
    activeRunId: null, speed: 120, simClock: Date.now(), lastSeen: Date.now(), online: true, syncQueue: 0, activity: null,
    ...over,
  }
}

let bc = 30_417
const barcode = () => `PC${(bc++).toString().padStart(8, '0')}`

function sample(label: string, source: Sample['source'], location: string, collectedAt: number, by: string, ref?: string): Sample {
  const b = barcode()
  return {
    id: `s_${b.toLowerCase()}`, barcode: b, label, source, location, collectedAt, collectedBy: by, referenceSpecies: ref,
    custody: [{ at: collectedAt, event: 'Collected', by }],
  }
}

function mkRun(id: string, name: string, deviceId: string, protocol: Protocol, operatorId: string, samples: Sample[],
  startedAt: number, elapsedH: number, state: Run['state']): Run {
  const dishes: Dish[] = samples.map((s, i) => ({
    position: i + 1, sampleId: s.id, barcode: s.barcode,
    printedAt: startedAt - 40 * 60e3, scannedAt: startedAt - 30 * 60e3 + i * 20e3, loadedAt: startedAt - 20 * 60e3 + i * 25e3,
    truth: drawInoculum(hash(id + s.id), s.source, s.referenceSpecies),
  }))
  const env = envLog(elapsedH, protocol.tempC, protocol.rh, hash(id))
  const captures: number[] = []
  for (let h = 0; h <= elapsedH + 1e-9; h += protocol.captureEveryH) captures.push(+h.toFixed(2))
  for (const s of samples) {
    s.custody.push({ at: startedAt - 40 * 60e3, event: 'Label printed', by: operatorId, deviceId })
    s.custody.push({ at: startedAt - 30 * 60e3, event: 'Scanned at side reader', by: operatorId, deviceId })
    s.custody.push({ at: startedAt - 20 * 60e3, event: `Loaded — ${name}`, by: operatorId, deviceId })
  }
  return {
    id, name, deviceId, protocolId: protocol.id, operatorId, state, createdAt: startedAt - 60 * 60e3, startedAt,
    completedAt: state === 'complete' ? startedAt + elapsedH * 3600e3 : null, elapsedH, dishes, env, captures,
    events: [{ h: 0, at: startedAt, kind: 'start', text: `Incubation started at ${protocol.tempC} °C / ${protocol.rh}% RH` }],
    review: { status: state === 'complete' ? 'pending' : 'pending' },
  }
}

export function seed(version: number): StoreShape {
  bc = 30_417
  const now = Date.now()
  const day = 86400e3
  const devices = [
    device('dev_a', 'PC6-24-00117', 'Bench A', 'Microbiology · Room 2.14'),
    device('dev_b', 'PC6-24-00121', 'Bench B', 'Microbiology · Room 2.14'),
    device('dev_c', 'PC6-24-00093', 'Env Lab', 'Environmental · Room 1.03', { online: false, state: 'offline', lastSeen: now - 3 * 3600e3, syncQueue: 14 }),
  ]
  const samples: Sample[] = []
  const runs: Run[] = []

  // 1 — completed & approved air-monitoring run (last week)
  const airS = ['Cleanroom A — settle', 'Cleanroom A — active', 'Gowning room', 'Corridor 2', 'Packaging hall', 'Warehouse dock']
    .map((l, i) => sample(l, 'air', l, now - 9 * day + i * 600e3, 'u_jane'))
  samples.push(...airS)
  const r1 = mkRun('run_air_0917', 'Air monitoring — wk 38', 'dev_b', PROTOCOLS[1], 'u_jane', airS, now - 8 * day, 168, 'complete')
  r1.review = { status: 'approved', by: 'u_alex', at: now - 0.8 * day, note: 'Counts within alert limits except Warehouse dock — trend flagged.' }
  runs.push(r1)

  // 2 — completed product run awaiting review
  const prodS = ['Lot 4471 — yogurt', 'Lot 4471 — yogurt (dup)', 'Lot 4472 — fruit prep', 'Lot 4472 — fruit prep (dup)', 'Line swab — filler', 'Negative control']
    .map((l, i) => sample(l, i === 5 ? 'reference' : i === 4 ? 'surface' : 'product', l, now - 6.5 * day + i * 300e3, 'u_sam', i === 5 ? undefined : undefined))
  samples.push(...prodS)
  const r2 = mkRun('run_ym_0922', 'Yeast & mold — lots 4471/4472', 'dev_b', PROTOCOLS[0], 'u_sam', prodS, now - 6 * day, 120, 'complete')
  r2.dishes[5].truth = [] // negative control stays clean
  runs.push(r2)

  // 3 — reference QC run in progress on Bench A (live-simulated by the device twin)
  const qcS = [
    sample('A. niger — ref strain', 'reference', 'QC fridge 3', now - 3 * day, 'u_emily', 'aspergillus_niger'),
    sample('P. expansum — ref strain', 'reference', 'QC fridge 3', now - 3 * day, 'u_emily', 'penicillium_expansum'),
    sample('A. flavus — ref strain', 'reference', 'QC fridge 3', now - 3 * day, 'u_emily', 'aspergillus_flavus'),
    sample('Surface swab — BSC 2', 'surface', 'Biosafety cabinet 2', now - 3 * day, 'u_emily'),
    sample('Air — incubator room', 'air', 'Room 2.14', now - 3 * day, 'u_emily'),
    sample('Water — DI loop', 'water', 'DI water point 4', now - 3 * day, 'u_emily'),
  ]
  samples.push(...qcS)
  const r3 = mkRun('run_qc_0928', 'Reference QC + env swabs', 'dev_a', PROTOCOLS[2], 'u_emily', qcS, now - 1.4 * day, 30, 'incubating')
  runs.push(r3)
  devices[0].state = 'incubating'
  devices[0].activeRunId = r3.id
  devices[0].telemetry = { ...devices[0].telemetry, T: 25, RH: 85, setT: 25, setRH: 85, tecPct: 8, fanPct: 35, mistPct: 12, reservoirPct: 61 }

  // unassigned samples waiting at the bench
  samples.push(
    sample('Cleanroom B — settle', 'air', 'Cleanroom B', now - 2 * 3600e3, 'u_jane'),
    sample('Cleanroom B — active', 'air', 'Cleanroom B', now - 2 * 3600e3, 'u_jane'),
    sample('Lot 4480 — yogurt', 'product', 'Line 1', now - 3600e3, 'u_sam'),
    sample('Lot 4480 — yogurt (dup)', 'product', 'Line 1', now - 3600e3, 'u_sam'),
    sample('Isolate #2291', 'clinical', 'Ward 4 — submitted', now - 5 * 3600e3, 'u_alex'),
    sample('Isolate #2292', 'clinical', 'Ward 4 — submitted', now - 5 * 3600e3, 'u_alex'),
  )

  return {
    version,
    users: USERS,
    devices,
    protocols: PROTOCOLS,
    samples,
    runs,
    alerts: [
      { id: 'al_1', deviceId: 'dev_c', level: 'warning', code: 'OFFLINE', text: 'Env Lab has not checked in for 3 h. 14 records queued on device.', at: now - 3 * 3600e3 },
      { id: 'al_2', deviceId: 'dev_b', level: 'info', code: 'HEPA_DUE', text: 'HEPA filter approaching its service interval.', at: now - 20 * 3600e3 },
    ],
    audit: [
      { id: 'au_1', at: now - 0.8 * day, actor: 'u_alex', action: 'run.approve', target: r1.id, detail: r1.review.note },
      { id: 'au_2', at: now - 1.4 * day, actor: 'u_emily', action: 'run.start', target: r3.id },
    ],
  }
}
