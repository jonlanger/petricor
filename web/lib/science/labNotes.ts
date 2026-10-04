/**
 * Plain-language notes for the Mycelium lab specimen pages. They describe what each simulation preset is meant to
 * evoke (branching density, speed, aerial growth). They are illustrative, not identification criteria.
 */
export const LAB_NOTES: Record<string, { character: string; microscope: string }> = {
  aspergillus_niger: { character: 'Fast, evenly branched mycelium that fills the dish quickly; sparse aerial hyphae carry the black conidial heads.', microscope: 'Septate hyphae with regular branching at about 45°.' },
  penicillium_expansum: { character: 'Slower, tightly branched colony with short internodes and little aerial growth, giving a dense velvety mat.', microscope: 'Fine septate hyphae; branches close together.' },
  aspergillus_flavus: { character: 'Similar branching to A. niger with a slightly slower front.', microscope: 'Septate hyphae, roughly 45° branching.' },
  aspergillus_fumigatus: { character: 'Moderately fast with a low, velvety canopy.', microscope: 'Narrow septate hyphae with acute-angle branching.' },
  penicillium_chrysogenum: { character: 'Dense, slow, short-internode network; a compact colony.', microscope: 'Fine septate hyphae; branches close together.' },
  cladosporium_cladosporioides: { character: 'The slowest mold here: very short internodes and narrow branch angles build a tight, compact colony.', microscope: 'Short cells, frequent narrow-angle branching.' },
  alternaria_alternata: { character: 'Wide branch angles and a woolly aerial layer over a moderately fast front.', microscope: 'Septate hyphae; branches at wider angles.' },
  fusarium_oxysporum: { character: 'Fast, wide-angled branching with a tall floccose aerial mycelium.', microscope: 'Septate hyphae with long internodes and wide branching.' },
  rhizopus_stolonifer: { character: 'The fastest grower: long internodes, near-perpendicular branches and abundant cottony aerial hyphae that rise high above the agar.', microscope: 'Broad, largely aseptate hyphae; long runs between branches.' },
  candida_albicans: { character: 'A yeast: most growth is budding cells, not hyphae. Shown here as slow pseudohyphal growth with no aerial layer, for comparison.', microscope: 'Budding cells and short pseudohyphae.' },
}
