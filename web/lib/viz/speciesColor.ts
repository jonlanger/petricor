import { SPECIES } from '../science/species'

/** Fixed categorical slot per species (validated palette order). Species past slot 8 fold into "Other". */
const SLOTS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const ORDER = ['aspergillus_niger', 'penicillium_expansum', 'cladosporium_cladosporioides', 'aspergillus_fumigatus',
  'fusarium_oxysporum', 'alternaria_alternata', 'penicillium_chrysogenum', 'aspergillus_flavus']

export function speciesColor(key: string) {
  const i = ORDER.indexOf(key)
  return i >= 0 ? SLOTS[i] : '#9a9da6'
}

export function shortName(key: string) {
  const s = SPECIES.find((x) => x.key === key)
  if (!s) return key
  const [g, e] = s.name.split(' ')
  return `${g[0]}. ${e}`
}
