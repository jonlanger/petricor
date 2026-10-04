import type { EnvSample } from '../science/cmi'

export type Role = 'technician' | 'microbiologist' | 'mycologist' | 'director'

export interface User {
  id: string
  name: string
  role: Role
  title: string
  initials: string
  badge: string
}

export type DeviceState =
  | 'offline' | 'idle' | 'preparing' | 'loading' | 'ready' | 'incubating' | 'imaging'
  | 'paused' | 'complete' | 'unloading' | 'decontaminating' | 'error'

export interface Telemetry {
  T: number
  RH: number
  setT: number
  setRH: number
  ambientT: number
  reservoirPct: number
  hepaHours: number
  uvcCycles: number
  tecPct: number // -100 (cooling) .. +100 (heating)
  fanPct: number
  mistPct: number
}

export interface Device {
  id: string
  serial: string
  name: string
  location: string
  model: 'PC-6'
  firmware: string
  simulated: boolean
  state: DeviceState
  doorOpen: boolean
  carouselAngle: number // degrees; position p is at the imaging station when angle = (p-1)*60
  stationPos: number // 1..6 at imaging station
  printer: { labelsLeft: number; busy: boolean }
  telemetry: Telemetry
  activeRunId: string | null
  speed: number // simulated seconds per real second
  simClock: number // epoch ms of the device's simulated clock
  lastSeen: number
  online: boolean
  syncQueue: number
  activity: string | null // human-readable current mechanical activity
  /** timed maintenance cycle in progress (epoch ms), e.g. UV-C, so screens can show real progress */
  cycle?: { kind: 'uvc'; startedAt: number; endsAt: number } | null
}

export type Channel = 'white' | 'uv365' | 'transillum' | 'ir850'

export interface Protocol {
  id: string
  name: string
  medium: string
  tempC: number
  rh: number
  durationH: number
  captureEveryH: number
  channels: Channel[]
  description: string
}

export type SourceType = 'air' | 'surface' | 'water' | 'product' | 'clinical' | 'reference'

export interface CustodyEvent {
  at: number
  event: string
  by: string
  deviceId?: string
}

export interface Sample {
  id: string
  barcode: string
  label: string
  source: SourceType
  location: string
  collectedAt: number
  collectedBy: string
  referenceSpecies?: string
  custody: CustodyEvent[]
}

/** Server-side ground truth for a simulated inoculum. Never shipped to the device UI as "results". */
export interface ColonyTruth {
  id: string
  species: string
  x: number // mm from dish centre
  y: number
  lagScale: number
  muScale: number
  seed: number
}

export interface Dish {
  position: number
  sampleId: string
  barcode: string
  printedAt?: number
  scannedAt?: number
  loadedAt?: number
  truth: ColonyTruth[]
}

export type RunState = 'setup' | 'loading' | 'incubating' | 'paused' | 'complete' | 'aborted'

export interface Review {
  status: 'pending' | 'approved' | 'changes'
  by?: string
  at?: number
  note?: string
}

export interface Run {
  id: string
  name: string
  deviceId: string
  protocolId: string
  operatorId: string
  state: RunState
  createdAt: number
  startedAt: number | null // real/sim epoch at incubation start
  completedAt: number | null
  elapsedH: number // simulated hours incubated
  dishes: Dish[]
  env: EnvSample[]
  captures: number[] // hours at which image sets were captured
  events: { h: number; at: number; kind: string; text: string }[]
  review: Review
}

export interface SpeciesGuess {
  key: string
  p: number
}

export interface ColonyObs {
  id: string
  x: number
  y: number
  r: number // mm
  guesses: SpeciesGuess[]
  firstSeenH: number
  circularity: number
}

export interface DishObs {
  position: number
  h: number
  colonies: ColonyObs[]
  coverage: number // fraction of agar area covered
}

export type AlertLevel = 'info' | 'warning' | 'critical'

export interface Alert {
  id: string
  deviceId: string
  runId?: string
  level: AlertLevel
  code: string
  text: string
  at: number
  ackBy?: string
  ackAt?: number
}

export interface AuditEvent {
  id: string
  at: number
  actor: string
  action: string
  target: string
  detail?: string
}

export interface StoreShape {
  version: number
  users: User[]
  devices: Device[]
  protocols: Protocol[]
  samples: Sample[]
  runs: Run[]
  alerts: Alert[]
  audit: AuditEvent[]
}
