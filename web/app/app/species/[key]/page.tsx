import { notFound } from 'next/navigation'
import { SPECIES_BY_KEY, CITATIONS } from '@/lib/science/species'
import SpeciesDetail from './SpeciesDetail'

export default async function Page({ params }: PageProps<'/app/species/[key]'>) {
  const { key } = await params
  const s = SPECIES_BY_KEY[key]
  if (!s) notFound()
  return <SpeciesDetail species={s} citations={CITATIONS} />
}
