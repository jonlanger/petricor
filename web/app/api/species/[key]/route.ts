import { SPECIES_BY_KEY } from '@/lib/science/species'
import { commonsImages, gbifSummary } from '@/lib/server/opendata'

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params
  const sp = SPECIES_BY_KEY[key]
  if (!sp) return Response.json({ error: 'Unknown species' }, { status: 404 })
  const [gbif, media] = await Promise.allSettled([gbifSummary(sp.gbifKey), commonsImages(sp.commonsQuery)])
  return Response.json({
    species: sp,
    gbif: gbif.status === 'fulfilled' ? gbif.value : { error: String(gbif.reason) },
    media: media.status === 'fulfilled' ? media.value : { error: String(media.reason), images: [] },
  })
}
