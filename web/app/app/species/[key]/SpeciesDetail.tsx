'use client'
import { useEffect, useMemo, useState } from 'react'
import type { Species, Citation, Param } from '@/lib/science/species'
import { cardinal } from '@/lib/science/species'
import { mu, inverseLag, cmiFactor } from '@/lib/science/cmi'
import type { GbifSummary, CommonsImage } from '@/lib/server/opendata'
import { Card, PageHead, Pill } from '@/components/app/ui'
import { LineChart, Bars } from '@/components/viz/charts'
import PlateCanvas from '@/components/viz/PlateCanvas'

const regionName = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null

export default function SpeciesDetail({ species: s, citations }: { species: Species; citations: Record<string, Citation> }) {
  const [data, setData] = useState<{ gbif: GbifSummary & { error?: string }; media: { images: CommonsImage[]; error?: string } } | null>(null)
  const [T, setT] = useState(25)
  useEffect(() => { fetch(`/api/species/${s.key}`).then((r) => r.json()).then(setData) }, [s.key])

  const c = cardinal(s)
  const muOpt = s.growth.muOpt.value, lagOpt = s.growth.lagOpt.value
  const curve = useMemo(() => {
    const pts = []
    for (let t = Math.floor(c.Tmin) - 3; t <= Math.ceil(c.Tmax) + 3; t += 0.25) pts.push({ x: t, y: mu(t, c, muOpt) * 24 })
    return pts
  }, [c.Tmin, c.Tmax, muOpt]) // eslint-disable-line react-hooks/exhaustive-deps
  const rate = mu(T, c, muOpt) // mm/h
  const lag = cmiFactor(T, c) > 0 ? 1 / inverseLag(T, c, lagOpt) : Infinity
  const days = [1, 2, 3, 5, 7]
  const radius = (d: number) => Math.max(0, Math.min(43, (d * 24 - lag) * rate))
  const citeList = [...new Set(Object.values(s.growth).map((p) => p.source).filter(Boolean))] as string[]

  return (
    <div>
      <PageHead crumbs={[{ href: '/app', label: 'Overview' }, { href: '/app/species', label: 'Species library' }, { label: s.name }]} eyebrow={`${s.family} · ${s.order}`} title={<span className="italic">{s.name}</span>} sub={<>{s.authority} · GBIF usage key <a className="text-blue" href={`https://www.gbif.org/species/${s.gbifKey}`} target="_blank" rel="noreferrer">{s.gbifKey}</a></>} />
      <div className="grid gap-6 p-5 sm:p-8 xl:grid-cols-2">
        <Card title="Growth model · Cardinal Model with Inflection">
          <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
            <div>
              <div className="mb-1 text-[13px] font-medium">Radial growth rate μ(T), mm / day</div>
              <LineChart series={[{ key: 'mu', label: 'μ', color: '#2a78d6', points: curve }]} xFormat={(x) => `${Math.round(x)}°`} yFormat={(v) => v.toFixed(1)} marker={T} height={210} area onScrub={(x) => setT(Math.round(x * 2) / 2)} />
              <label className="mt-4 block text-[13px]">
                <span className="flex justify-between"><span className="font-medium">Incubation temperature</span><span className="font-mono tabular">{T.toFixed(1)} °C</span></span>
                <input type="range" min={Math.floor(c.Tmin) - 2} max={Math.ceil(c.Tmax) + 2} step={0.5} value={T} onChange={(e) => setT(+e.target.value)} className="mt-2 w-full accent-[#3a44ff]" />
              </label>
            </div>
            <div className="space-y-3 font-mono text-[12.5px]">
              <div><div className="text-muted">μ at {T} °C</div><div className="text-[22px] font-semibold tabular">{(rate * 24).toFixed(2)} <span className="text-[13px] text-muted">mm/d</span></div></div>
              <div><div className="text-muted">Apparent lag</div><div className="text-[22px] font-semibold tabular">{Number.isFinite(lag) ? `${lag.toFixed(0)} h` : 'no growth'}</div></div>
              <div><div className="text-muted">Diameter at day 7</div><div className="text-[22px] font-semibold tabular">{(radius(7) * 2).toFixed(0)} mm</div></div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-5 gap-3 rounded-xl bg-graphite p-4">
            {days.map((d) => (
              <div key={d} className="text-center">
                <PlateCanvas colonies={radius(d) > 0.15 ? [{ id: `pv-${s.key}`, x: 0, y: 0, r: radius(d), key: s.key }] : []} resolution={200} />
                <div className="mt-1.5 font-mono text-[11px] text-white/70">day {d} · ⌀ {(radius(d) * 2).toFixed(0)} mm</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted">Single central colony on a 90 mm dish at constant temperature. Morphology rendering is a visual approximation.</p>
          <table className="mt-6 w-full text-[13px]">
            <thead className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-muted"><tr><th className="py-2 font-medium">Parameter</th><th className="py-2 font-medium">Value</th><th className="py-2 font-medium">Provenance</th></tr></thead>
            <tbody className="divide-y divide-line">
              {([['Tmin', s.growth.Tmin, '°C'], ['Topt', s.growth.Topt, '°C'], ['Tmax', s.growth.Tmax, '°C'], ['μopt', s.growth.muOpt, 'mm/h'], ['λopt (lag)', s.growth.lagOpt, 'h']] as [string, Param, string][]).map(([k, p, u]) => (
                <tr key={k}><td className="py-2 font-mono">{k}</td><td className="py-2 font-mono tabular">{p.value} {u}</td>
                  <td className="py-2"><Pill tone={p.provenance === 'literature' ? 'ok' : p.provenance === 'derived' ? 'blue' : 'warn'}>{p.provenance === 'literature' ? citations[p.source!].short : p.provenance === 'derived' ? `derived · ${citations[p.source!].short}` : 'demo placeholder'}</Pill>
                    {p.rule && <div className="mt-1 text-[11.5px] text-muted">{p.rule}</div>}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 space-y-2 text-[12px] text-muted">
            {citeList.map((k) => <p key={k}><b className="text-ink/80">{citations[k].short}.</b> {citations[k].full} {citations[k].doi && <a className="text-blue" href={`https://doi.org/${citations[k].doi}`} target="_blank" rel="noreferrer">doi:{citations[k].doi}</a>} {citations[k].note}</p>)}
            <p><b className="text-ink/80">Model.</b> {citations.rosso1993.full}</p>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="GBIF · Global Biodiversity Information Facility" action={<a className="text-[12.5px] text-blue" href={`https://www.gbif.org/species/${s.gbifKey}`} target="_blank" rel="noreferrer">gbif.org ↗</a>}>
            {!data ? <div className="text-[13px] text-muted">Fetching live data…</div> : data.gbif.error ? <div className="text-[13px] text-crit">GBIF unavailable: {data.gbif.error}</div> : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                  {data.gbif.classification.map((c, i) => <span key={c.rank} className="flex items-center gap-1.5">{i > 0 && <span className="text-line-2">›</span>}<span><span className="text-muted">{c.rank} </span><span className={c.rank === 'species' || c.rank === 'genus' ? 'italic' : ''}>{c.name}</span></span></span>)}
                </div>
                <div className="grid grid-cols-3 gap-4 font-mono">
                  <div><div className="eyebrow">Occurrences</div><div className="text-[22px] font-semibold tabular">{data.gbif.occurrences.toLocaleString()}</div></div>
                  <div><div className="eyebrow">With images</div><div className="text-[22px] font-semibold tabular">{data.gbif.withImages.toLocaleString()}</div></div>
                  <div><div className="eyebrow">Status</div><div className="text-[15px] font-semibold capitalize">{data.gbif.taxonomicStatus?.toLowerCase()}</div></div>
                </div>
                <div className="overflow-hidden rounded-xl border border-line">
                  <div className="grid grid-cols-2">
                    {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => (
                      <div key={`${x}${y}`} className="relative aspect-square">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt="" className="absolute inset-0 h-full w-full" src={`https://tile.gbif.org/3857/omt/1/${x}/${y}@1x.png?style=gbif-light`} />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt="" className="absolute inset-0 h-full w-full" src={`https://api.gbif.org/v2/map/occurrence/density/1/${x}/${y}@1x.png?taxonKey=${s.gbifKey}&bin=hex&hexPerTile=48&style=classic-noborder.poly`} style={{ opacity: 0.85 }} />
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-line px-3 py-2 text-[11.5px] text-muted">Occurrence density, all GBIF records. Map tiles © GBIF, OpenMapTiles, OpenStreetMap contributors.</div>
                </div>
                <div>
                  <div className="mb-2 text-[13px] font-medium">Records by country · top {data.gbif.countries.length}</div>
                  <Bars rows={data.gbif.countries.map((c) => ({ label: regionName?.of(c.code) ?? c.code, value: c.count, color: '#2a78d6' }))} format={(v) => v.toLocaleString()} />
                </div>
                <div>
                  <div className="mb-2 text-[13px] font-medium">Records per year</div>
                  <LineChart series={[{ key: 'y', label: 'Records', color: '#2a78d6', points: data.gbif.years.filter((y) => y.year >= 1970).map((y) => ({ x: y.year, y: y.count })) }]} xFormat={(x) => String(Math.round(x))} yFormat={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)} height={150} area />
                </div>
                <div className="flex flex-wrap gap-1.5">{data.gbif.basisOfRecord.map((b) => <Pill key={b.name} tone="mute">{b.name.toLowerCase().replace(/_/g, ' ')} · {b.count.toLocaleString()}</Pill>)}</div>
                <p className="text-[11.5px] text-muted">Live from api.gbif.org, cached for 7 days. Retrieved {new Date((data.gbif as unknown as { _cachedAt: number })._cachedAt).toLocaleDateString('en-GB')}.</p>
              </div>
            )}
          </Card>

          <Card title="Culture photographs · Wikimedia Commons">
            {!data ? <div className="text-[13px] text-muted">Searching Commons…</div> : data.media.images.length === 0 ? <div className="text-[13px] text-muted">No openly-licensed images matched “{s.commonsQuery}”.</div> : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.media.images.map((im) => (
                  <a key={im.page} href={im.page} target="_blank" rel="noreferrer" className="group block">
                    <div className="aspect-square overflow-hidden rounded-lg bg-paper">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={im.thumb} alt={im.title} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    </div>
                    <div className="mt-1 line-clamp-2 text-[11.5px] leading-snug">{im.title}</div>
                    <div className="text-[10.5px] text-muted">{im.artist.slice(0, 40)} · {im.license}</div>
                  </a>
                ))}
              </div>
            )}
            <p className="mt-3 text-[11.5px] text-muted">Search results are matched by keyword; verify identity and licence on each file page before reuse.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
