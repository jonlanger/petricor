import 'server-only'
import { EventEmitter } from 'node:events'

export type BusEvent =
  | { type: 'device'; deviceId: string; data: unknown }
  | { type: 'run'; runId: string; data: unknown }
  | { type: 'capture'; runId: string; h: number }
  | { type: 'alert'; data: unknown }
  | { type: 'audit'; data: unknown }
  | { type: 'print'; deviceId: string; barcodes: string[] }
  | { type: 'scan'; deviceId: string; barcode: string }

type G = typeof globalThis & { __pcBus?: EventEmitter }
const g = globalThis as G
export const bus: EventEmitter = g.__pcBus ?? (g.__pcBus = new EventEmitter().setMaxListeners(200))

export const emit = (e: BusEvent) => bus.emit('event', e)
