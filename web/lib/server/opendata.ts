import 'server-only'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Open-data connectors. Everything here is fetched live from public APIs and cached on disk:
 *   • GBIF (Global Biodiversity Information Facility) — taxonomy + occurrence statistics. https://www.gbif.org/developer
 *   • Wikimedia Commons — openly-licensed culture photographs, with licence + attribution preserved.
 */
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache')
const TTL = 7 * 86400e3
const UA = 'Petricor/0.1 (research prototype; contact via repository)'

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T & { _cachedAt: number }> {
  const f = path.join(CACHE_DIR, key.replace(/[^a-z0-9_.-]/gi, '_') + '.json')
  try {
    const raw = JSON.parse(fs.readFileSync(f, 'utf8'))
    if (Date.now() - raw._cachedAt < TTL) return raw
  } catch {}
  const v = await fn()
  const out = { ...(v as object), _cachedAt: Date.now() } as T & { _cachedAt: number }
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(f, JSON.stringify(out))
  return out
}

async function getJSON(url: string) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json()
}

export interface GbifSummary {
  key: number
  scientificName: string
  canonicalName: string
  rank: string
  taxonomicStatus: string
  classification: { rank: string; name: string }[]
  occurrences: number
  withImages: number
  countries: { code: string; count: number }[]
  basisOfRecord: { name: string; count: number }[]
  years: { year: number; count: number }[]
  vernacular: string[]
  source: string
}

export function gbifSummary(key: number) {
  return cached<GbifSummary>(`gbif_${key}`, async () => {
    const base = 'https://api.gbif.org/v1'
    const [sp, occ, img, facets, vern] = await Promise.all([
      getJSON(`${base}/species/${key}`),
      getJSON(`${base}/occurrence/search?taxonKey=${key}&limit=0`),
      getJSON(`${base}/occurrence/search?taxonKey=${key}&limit=0&mediaType=StillImage`),
      getJSON(`${base}/occurrence/search?taxonKey=${key}&limit=0&facet=country&facet=basisOfRecord&facet=year&country.facetLimit=12&year.facetLimit=60&basisOfRecord.facetLimit=10`),
      getJSON(`${base}/species/${key}/vernacularNames?limit=50`).catch(() => ({ results: [] })),
    ])
    const facet = (name: string) => (facets.facets ?? []).find((f: { field: string }) => f.field === name)?.counts ?? []
    const ranks = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'] as const
    return {
      key,
      scientificName: sp.scientificName,
      canonicalName: sp.canonicalName,
      rank: sp.rank,
      taxonomicStatus: sp.taxonomicStatus,
      classification: ranks.filter((r) => sp[r]).map((r) => ({ rank: r, name: sp[r] })),
      occurrences: occ.count,
      withImages: img.count,
      countries: facet('COUNTRY').map((c: { name: string; count: number }) => ({ code: c.name, count: c.count })),
      basisOfRecord: facet('BASIS_OF_RECORD').map((c: { name: string; count: number }) => ({ name: c.name, count: c.count })),
      years: facet('YEAR').map((c: { name: string; count: number }) => ({ year: +c.name, count: c.count })).sort((a: { year: number }, b: { year: number }) => a.year - b.year),
      vernacular: [...new Set<string>((vern.results ?? []).filter((v: { language: string }) => v.language === 'eng').map((v: { vernacularName: string }) => v.vernacularName))].slice(0, 4),
      source: `https://www.gbif.org/species/${key}`,
    }
  })
}

export interface CommonsImage {
  title: string
  thumb: string
  width: number
  height: number
  page: string
  license: string
  licenseUrl?: string
  artist: string
  credit: string
}

const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

export function commonsImages(query: string) {
  return cached<{ images: CommonsImage[]; query: string }>(`commons_${query}`, async () => {
    const u = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
      action: 'query', generator: 'search', gsrsearch: `${query} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '16',
      prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '640', format: 'json', origin: '*',
    })
    const d = await getJSON(u)
    const pages = Object.values(d.query?.pages ?? {}) as { title: string; index: number; imageinfo: { thumburl: string; thumbwidth: number; thumbheight: number; descriptionurl: string; mime: string; extmetadata: Record<string, { value: string }> }[] }[]
    const images = pages
      .sort((a, b) => a.index - b.index)
      .map((p) => {
        const ii = p.imageinfo?.[0]
        const md = ii?.extmetadata ?? {}
        return {
          title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
          thumb: ii?.thumburl, width: ii?.thumbwidth, height: ii?.thumbheight, page: ii?.descriptionurl, mime: ii?.mime,
          license: strip(md.LicenseShortName?.value), licenseUrl: md.LicenseUrl?.value,
          artist: strip(md.Artist?.value) || 'Unknown', credit: strip(md.Credit?.value),
        }
      })
      .filter((i) => i.thumb && /^image\/(jpeg|png|webp)/.test(i.mime ?? '') && /(CC|Public domain|PD)/i.test(i.license))
      .map(({ mime, ...rest }) => { void mime; return rest })
      .slice(0, 8)
    return { images, query }
  })
}
