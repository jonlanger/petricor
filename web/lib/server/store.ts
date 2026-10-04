import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import type { StoreShape } from '../domain/types'
import { seed } from './seed'

/**
 * Document store persisted to data/store.json (atomic rename, debounced).
 * Route handlers, the twin and server components share this one store; swapping it for Postgres is a change to this module + seed.
 */
/** Writable data dir: the deployment bundle is read-only on Vercel, so persist to /tmp there (per-instance, ephemeral). */
export const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'petricor') : path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'store.json')
const VERSION = 4

type G = typeof globalThis & { __pcStore?: StoreShape; __pcSaveTimer?: NodeJS.Timeout }
const g = globalThis as G

export function db(): StoreShape {
  if (g.__pcStore) return g.__pcStore
  let data: StoreShape | null = null
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')) as StoreShape
    if (raw.version === VERSION) data = raw
  } catch {
    /* first boot */
  }
  if (!data) {
    data = seed(VERSION)
    g.__pcStore = data
    flush()
  }
  g.__pcStore = data
  return data
}

export function save() {
  if (g.__pcSaveTimer) return
  g.__pcSaveTimer = setTimeout(() => {
    g.__pcSaveTimer = undefined
    flush()
  }, 800)
}

export function flush() {
  if (!g.__pcStore) return
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true })
    const tmp = FILE + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(g.__pcStore))
    fs.renameSync(tmp, FILE)
  } catch (e) {
    console.error('[store] flush failed; keeping in-memory state', e)
  }
}

export function resetStore() {
  g.__pcStore = seed(VERSION)
  flush()
  return g.__pcStore
}

export const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
