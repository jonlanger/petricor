/**
 * Species library.
 *
 * Every growth parameter carries provenance:
 *  - 'literature'  : taken directly from a cited source (abstract-level values, see `source`)
 *  - 'derived'     : computed from a cited range (e.g. midpoint), with the rule stated
 *  - 'demo'        : NOT from literature — a placeholder so the simulator can run. Always flagged in the UI.
 *
 * GBIF usage keys were resolved against https://api.gbif.org/v1/species/match (exact matches).
 * Morphology presets (margin = young mycelium, body = conidial colour, center = aged centre, accent = heads/exudate,
 * reverse = diffusible pigment) drive the procedural renderer only; they are visual approximations, not diagnostic criteria.
 */
import type { Cardinal } from './cmi'

export type Provenance = 'literature' | 'derived' | 'demo'

export interface Citation {
  short: string
  full: string
  doi?: string
  pmid?: string
  note?: string
}

export const CITATIONS: Record<string, Citation> = {
  gougouli2010: {
    short: 'Gougouli & Koutsoumanis 2010',
    full: 'Gougouli M, Koutsoumanis KP. Modelling growth of Penicillium expansum and Aspergillus niger at constant and fluctuating temperature conditions. Int J Food Microbiol. 2010;140:254–262.',
    doi: '10.1016/j.ijfoodmicro.2010.03.021',
    pmid: '20413170',
    note: 'Malt extract agar, pH 4.2, aw 0.997. Isolates from a yogurt production environment.',
  },
  yogendrarajah2016: {
    short: 'Yogendrarajah et al. 2016',
    full: 'Yogendrarajah P, Vermeulen A, Jacxsens L, et al. Mycotoxin production and predictive modelling kinetics on the growth of Aspergillus flavus and Aspergillus parasiticus isolates in whole black peppercorns (Piper nigrum L). Int J Food Microbiol. 2016;228:44–57.',
    doi: '10.1016/j.ijfoodmicro.2016.03.015',
    pmid: '27088871',
    note: 'Substrate: whole black peppercorns (aw-limited). Reported as ranges across isolates; not directly transferable to agar.',
  },
  rosso1993: {
    short: 'Rosso, Lobry & Flandrois 1993',
    full: 'Rosso L, Lobry JR, Flandrois JP. An unexpected correlation between cardinal temperatures of microbial growth highlighted by a new model. J Theor Biol. 1993;162:447–463.',
    pmid: '8412234',
  },
  trinci1974: {
    short: 'Trinci 1974',
    full: 'Trinci AP. A study of the kinetics of hyphal extension and branch initiation of fungal mycelia. J Gen Microbiol. 1974;81:225–236.',
    doi: '10.1099/00221287-81-1-225',
    pmid: '4274556',
  },
  meskauskas2004: {
    short: 'Meškauskas, Fricker & Moore 2004',
    full: 'Meškauskas A, Fricker MD, Moore D. Simulating colonial growth of fungi with the Neighbour-Sensing model of hyphal growth. Mycol Res. 2004;108:1241–1256.',
    pmid: '15587058',
  },
}

export interface Param {
  value: number
  provenance: Provenance
  source?: keyof typeof CITATIONS
  rule?: string
}

export interface GrowthParams {
  Tmin: Param
  Topt: Param
  Tmax: Param
  muOpt: Param // mm/h radial growth rate at Topt
  lagOpt: Param // h, apparent lag at Topt
}

export type Style = 'granular' | 'velvet' | 'furrowed' | 'floccose' | 'cottony' | 'woolly' | 'yeast'

/**
 * Colony zones, mirroring hardware/blender/pc_textures.py (v6) so the cloud, touchscreen and renders agree.
 * Fractions are of a mature (~18 mm) colony radius unless noted.
 */
export interface Zones {
  margin: number // white, non-sporulating margin width
  fringe: number // submerged radial hyphae reach past the visible edge
  zon: number // daily zonation ring amplitude
  furrows: [number, number] // radial furrow count, depth (mm)
  wrinkle: number // cerebriform centre relief (mm)
  gran: number // granular conidial-head texture
  h0: number // colony height (mm)
  profile: 'plateau' | 'dome' | 'umbo' | 'yeast'
  gloss: number // 0 dry/velvety … 1 wet/glossy
  fuzz: number // aerial mycelium density
  fuzzLen: number // aerial mycelium length (mm)
  heads: number // visible conidial heads / sporangia (dots, `accent` colour)
  pigment: [number, number] | null // diffusible reverse pigment: strength, spread (mm)
  drops: number // exudate droplets on a mature colony (`accent` colour)
}

export interface Morphology {
  style: Style
  margin: string
  body: string
  center: string
  accent: string
  reverse: string
  zones: Zones
  /** hyphal sim preset: branch angle (deg), mean internode (µm), tip speed scale */
  hyphae: { branchDeg: number; internode: number; speed: number; aerial: number }
}

export interface Species {
  key: string
  name: string
  authority: string
  gbifKey: number
  family: string
  order: string
  kind: 'mould' | 'yeast'
  growth: GrowthParams
  morph: Morphology
  confusedWith: string[]
  commonsQuery: string
}

const lit = (value: number, source: keyof typeof CITATIONS): Param => ({ value, provenance: 'literature', source })
const der = (value: number, source: keyof typeof CITATIONS, rule: string): Param => ({ value, provenance: 'derived', source, rule })
const demo = (value: number): Param => ({ value, provenance: 'demo' })
const LAG_DEMO = (v: number): Param => ({ value: v, provenance: 'demo', rule: 'Lag at optimum not reported in the cited abstract; placeholder.' })

export const SPECIES: Species[] = [
  {
    key: 'aspergillus_niger', name: 'Aspergillus niger', authority: 'Tiegh.', gbifKey: 3465658,
    family: 'Aspergillaceae', order: 'Eurotiales', kind: 'mould',
    growth: {
      Tmin: lit(10.13, 'gougouli2010'), Topt: lit(31.44, 'gougouli2010'), Tmax: lit(43.13, 'gougouli2010'),
      muOpt: lit(0.84, 'gougouli2010'), lagOpt: LAG_DEMO(14),
    },
    morph: { style: 'granular', margin: '#f2ebc7', body: '#16130f', center: '#0d0b0a', accent: '#0f0d0b', reverse: '#edd16b',
      zones: { margin: .07, fringe: .07, zon: .04, furrows: [0, 0], wrinkle: 0, gran: .7, h0: .9, profile: 'plateau', gloss: .05, fuzz: .18, fuzzLen: .7, heads: 1, pigment: [.30, 4.4], drops: 0 },
      hyphae: { branchDeg: 45, internode: 60, speed: 1.0, aerial: 0.3 } },
    confusedWith: ['aspergillus_flavus', 'rhizopus_stolonifer'],
    commonsQuery: 'Aspergillus niger agar',
  },
  {
    key: 'penicillium_expansum', name: 'Penicillium expansum', authority: 'Link', gbifKey: 2597789,
    family: 'Aspergillaceae', order: 'Eurotiales', kind: 'mould',
    growth: {
      Tmin: lit(-5.74, 'gougouli2010'), Topt: lit(22.08, 'gougouli2010'), Tmax: lit(30.97, 'gougouli2010'),
      muOpt: lit(0.221, 'gougouli2010'), lagOpt: LAG_DEMO(20),
    },
    morph: { style: 'furrowed', margin: '#f7f7f2', body: '#3d8075', center: '#456963', accent: '#f0d27a', reverse: '#efd98a',
      zones: { margin: .14, fringe: .05, zon: .16, furrows: [11, .45], wrinkle: .25, gran: .15, h0: 1.0, profile: 'umbo', gloss: .1, fuzz: .04, fuzzLen: .4, heads: 0, pigment: [.15, 6], drops: 8 },
      hyphae: { branchDeg: 40, internode: 45, speed: 0.55, aerial: 0.15 } },
    confusedWith: ['penicillium_chrysogenum', 'aspergillus_fumigatus'],
    commonsQuery: 'Penicillium expansum colony',
  },
  {
    key: 'aspergillus_flavus', name: 'Aspergillus flavus', authority: 'Link', gbifKey: 5259820,
    family: 'Aspergillaceae', order: 'Eurotiales', kind: 'mould',
    growth: {
      Tmin: der(13.5, 'yogendrarajah2016', 'Midpoint of reported 11–16 °C'),
      Topt: der(31.5, 'yogendrarajah2016', 'Midpoint of reported 30–33 °C'),
      Tmax: demo(44),
      muOpt: der(0.071, 'yogendrarajah2016', 'Midpoint of 0.75–2.65 mm/day across isolates, ÷24'),
      lagOpt: LAG_DEMO(18),
    },
    morph: { style: 'granular', margin: '#f2f0d6', body: '#a8b34d', center: '#7a8538', accent: '#c2c96a', reverse: '#dbbd6b',
      zones: { margin: .10, fringe: .06, zon: .14, furrows: [14, .25], wrinkle: 0, gran: .6, h0: .8, profile: 'plateau', gloss: .07, fuzz: .08, fuzzLen: .5, heads: 0, pigment: [.15, 3.5], drops: 0 },
      hyphae: { branchDeg: 45, internode: 60, speed: 0.9, aerial: 0.3 } },
    confusedWith: ['aspergillus_niger', 'penicillium_expansum'],
    commonsQuery: 'Aspergillus flavus culture',
  },
  {
    key: 'aspergillus_fumigatus', name: 'Aspergillus fumigatus', authority: 'Fresen.', gbifKey: 5260010,
    family: 'Aspergillaceae', order: 'Eurotiales', kind: 'mould',
    growth: { Tmin: demo(12), Topt: demo(37), Tmax: demo(52), muOpt: demo(0.25), lagOpt: LAG_DEMO(12) },
    morph: { style: 'velvet', margin: '#f2f2eb', body: '#578075', center: '#4d5e5c', accent: '#6f8d85', reverse: '#e8e2d0',
      zones: { margin: .07, fringe: .05, zon: .06, furrows: [0, 0], wrinkle: .10, gran: .25, h0: .5, profile: 'plateau', gloss: .07, fuzz: .04, fuzzLen: .4, heads: 0, pigment: null, drops: 0 },
      hyphae: { branchDeg: 45, internode: 50, speed: 0.8, aerial: 0.2 } },
    confusedWith: ['penicillium_expansum', 'cladosporium_cladosporioides'],
    commonsQuery: 'Aspergillus fumigatus Sabouraud',
  },
  {
    key: 'penicillium_chrysogenum', name: 'Penicillium chrysogenum', authority: 'Thom', gbifKey: 3466349,
    family: 'Aspergillaceae', order: 'Eurotiales', kind: 'mould',
    growth: { Tmin: demo(4), Topt: demo(24), Tmax: demo(33), muOpt: demo(0.18), lagOpt: LAG_DEMO(22) },
    morph: { style: 'furrowed', margin: '#f7f7f2', body: '#3d8075', center: '#456963', accent: '#f5c738', reverse: '#f5cc38',
      zones: { margin: .14, fringe: .05, zon: .16, furrows: [11, .45], wrinkle: .25, gran: .15, h0: 1.0, profile: 'umbo', gloss: .1, fuzz: .04, fuzzLen: .4, heads: 0, pigment: [.40, 9.7], drops: 22 },
      hyphae: { branchDeg: 40, internode: 45, speed: 0.5, aerial: 0.15 } },
    confusedWith: ['penicillium_expansum', 'aspergillus_fumigatus'],
    commonsQuery: 'Penicillium chrysogenum',
  },
  {
    key: 'cladosporium_cladosporioides', name: 'Cladosporium cladosporioides', authority: '(Fresen.) G.A.de Vries', gbifKey: 2620657,
    family: 'Cladosporiaceae', order: 'Capnodiales', kind: 'mould',
    growth: { Tmin: demo(0), Topt: demo(24), Tmax: demo(32), muOpt: demo(0.07), lagOpt: LAG_DEMO(30) },
    morph: { style: 'velvet', margin: '#707859', body: '#454a33', center: '#26281c', accent: '#3a4029', reverse: '#24291c',
      zones: { margin: .04, fringe: .03, zon: .05, furrows: [8, .35], wrinkle: .7, gran: .12, h0: 1.3, profile: 'dome', gloss: .1, fuzz: .08, fuzzLen: .4, heads: 0, pigment: [.50, 2.6], drops: 0 },
      hyphae: { branchDeg: 35, internode: 35, speed: 0.35, aerial: 0.1 } },
    confusedWith: ['alternaria_alternata', 'aspergillus_fumigatus'],
    commonsQuery: 'Cladosporium colony',
  },
  {
    key: 'alternaria_alternata', name: 'Alternaria alternata', authority: '(Fr.) Keissl.', gbifKey: 2616163,
    family: 'Pleosporaceae', order: 'Pleosporales', kind: 'mould',
    growth: { Tmin: demo(3), Topt: demo(26), Tmax: demo(36), muOpt: demo(0.2), lagOpt: LAG_DEMO(16) },
    morph: { style: 'woolly', margin: '#b3b3a8', body: '#52544a', center: '#1f211c', accent: '#6f7264', reverse: '#2b2e26',
      zones: { margin: .18, fringe: .06, zon: .13, furrows: [0, 0], wrinkle: .15, gran: .1, h0: 1.3, profile: 'dome', gloss: .07, fuzz: .6, fuzzLen: 1.4, heads: 0, pigment: [.55, 3.5], drops: 0 },
      hyphae: { branchDeg: 50, internode: 55, speed: 0.7, aerial: 0.5 } },
    confusedWith: ['cladosporium_cladosporioides', 'aspergillus_niger'],
    commonsQuery: 'Alternaria alternata colony',
  },
  {
    key: 'fusarium_oxysporum', name: 'Fusarium oxysporum', authority: 'Schltdl.', gbifKey: 5251961,
    family: 'Nectriaceae', order: 'Hypocreales', kind: 'mould',
    growth: { Tmin: demo(5), Topt: demo(27), Tmax: demo(36), muOpt: demo(0.35), lagOpt: LAG_DEMO(12) },
    morph: { style: 'floccose', margin: '#faf5f7', body: '#f0d6e8', center: '#cc94c2', accent: '#fff8fb', reverse: '#994d94',
      zones: { margin: .45, fringe: .10, zon: .05, furrows: [0, 0], wrinkle: 0, gran: 0, h0: 1.6, profile: 'dome', gloss: .05, fuzz: 1, fuzzLen: 3.2, heads: 0, pigment: [.45, 12.3], drops: 0 },
      hyphae: { branchDeg: 55, internode: 70, speed: 1.1, aerial: 0.8 } },
    confusedWith: ['rhizopus_stolonifer', 'alternaria_alternata'],
    commonsQuery: 'Fusarium oxysporum culture',
  },
  {
    key: 'rhizopus_stolonifer', name: 'Rhizopus stolonifer', authority: '(Ehrenb.) Vuill.', gbifKey: 2558944,
    family: 'Rhizopodaceae', order: 'Mucorales', kind: 'mould',
    growth: { Tmin: demo(5), Topt: demo(26), Tmax: demo(33), muOpt: demo(1.2), lagOpt: LAG_DEMO(8) },
    morph: { style: 'cottony', margin: '#ebebe6', body: '#d6d6d1', center: '#bdbdb8', accent: '#141414', reverse: '#f2eee0',
      zones: { margin: .6, fringe: .12, zon: 0, furrows: [0, 0], wrinkle: 0, gran: 0, h0: 1.2, profile: 'plateau', gloss: .05, fuzz: 1, fuzzLen: 6, heads: .5, pigment: null, drops: 0 },
      hyphae: { branchDeg: 70, internode: 140, speed: 1.8, aerial: 1.0 } },
    confusedWith: ['fusarium_oxysporum', 'aspergillus_niger'],
    commonsQuery: 'Rhizopus stolonifer',
  },
  {
    key: 'candida_albicans', name: 'Candida albicans', authority: '(C.P.Robin) Berkhout', gbifKey: 2599597,
    family: 'Debaryomycetaceae', order: 'Saccharomycetales', kind: 'yeast',
    growth: { Tmin: demo(10), Topt: demo(37), Tmax: demo(45), muOpt: demo(0.02), lagOpt: LAG_DEMO(10) },
    morph: { style: 'yeast', margin: '#f7f2e0', body: '#f5edd6', center: '#ede3c9', accent: '#fbf8ef', reverse: '#f1e9d6',
      zones: { margin: 0, fringe: .03, zon: 0, furrows: [0, 0], wrinkle: 0, gran: 0, h0: .9, profile: 'yeast', gloss: .85, fuzz: 0, fuzzLen: 0, heads: 0, pigment: null, drops: 0 },
      hyphae: { branchDeg: 30, internode: 25, speed: 0.2, aerial: 0 } },
    confusedWith: ['penicillium_expansum'],
    commonsQuery: 'Candida albicans colonies agar',
  },
]

export const SPECIES_BY_KEY: Record<string, Species> = Object.fromEntries(SPECIES.map((s) => [s.key, s]))

export function cardinal(s: Species): Cardinal {
  return { Tmin: s.growth.Tmin.value, Topt: s.growth.Topt.value, Tmax: s.growth.Tmax.value }
}

export function growthProvenance(s: Species): Provenance {
  const ps = [s.growth.Tmin, s.growth.Topt, s.growth.Tmax, s.growth.muOpt]
  if (ps.every((p) => p.provenance === 'literature')) return 'literature'
  if (ps.some((p) => p.provenance === 'demo')) return 'demo'
  return 'derived'
}

/** Which species an isolation source tends to yield in the simulator (demo sampling model, not epidemiology). */
export const SOURCE_POOLS: Record<string, { mean: number; pool: [string, number][] }> = {
  air: { mean: 7, pool: [['cladosporium_cladosporioides', 4], ['penicillium_chrysogenum', 3], ['aspergillus_niger', 2], ['alternaria_alternata', 2], ['aspergillus_fumigatus', 1], ['rhizopus_stolonifer', 0.3]] },
  surface: { mean: 5, pool: [['penicillium_expansum', 3], ['cladosporium_cladosporioides', 2], ['aspergillus_niger', 2], ['candida_albicans', 1], ['fusarium_oxysporum', 1]] },
  water: { mean: 3, pool: [['fusarium_oxysporum', 3], ['penicillium_chrysogenum', 2], ['aspergillus_fumigatus', 1], ['candida_albicans', 1]] },
  product: { mean: 4, pool: [['penicillium_expansum', 3], ['aspergillus_niger', 3], ['rhizopus_stolonifer', 1], ['aspergillus_flavus', 1]] },
  clinical: { mean: 4, pool: [['candida_albicans', 5], ['aspergillus_fumigatus', 2], ['aspergillus_flavus', 1]] },
  reference: { mean: 1, pool: [] },
}
