# Science, open data and what is simulated

Petricor's rule: **every number has a stated origin.** Parameters are tagged `literature`, `derived` or `demo` in `web/lib/science/species.ts`, and the UI shows the tag next to the value.

## Growth model

**Cardinal Model with Inflection.** Rosso L, Lobry JR, Flandrois JP. *An unexpected correlation between cardinal temperatures of microbial growth highlighted by a new model.* J Theor Biol. 1993;162:447–463. PMID 8412234.

```
μ(T) = μopt · (T − Tmax)(T − Tmin)² / { (Topt − Tmin)[(Topt − Tmin)(T − Topt) − (Topt − Tmax)(Topt + Tmin − 2T)] }
```

Colony radius is linear in time after an apparent lag. Under changing temperature, μ adapts instantly and lag accumulates as ∫dt/λ(T). This follows the approach validated by Gougouli & Koutsoumanis (2010) for these two species.

## Species parameters

| Species | Tmin | Topt | Tmax | μopt | Source |
|---|---|---|---|---|---|
| *Aspergillus niger* | 10.13 °C | 31.44 °C | 43.13 °C | 0.840 mm/h | Gougouli & Koutsoumanis 2010 |
| *Penicillium expansum* | −5.74 °C | 22.08 °C | 30.97 °C | 0.221 mm/h | Gougouli & Koutsoumanis 2010 |
| *Aspergillus flavus* | 13.5 °C † | 31.5 °C † | 44 °C (demo) | 0.071 mm/h † | Yogendrarajah et al. 2016 |
| All others | demo | demo | demo | demo | — |

† Derived as the midpoint of reported ranges (Tmin 11–16 °C, Topt 30–33 °C, μopt 0.75–2.65 mm/day) on whole black peppercorns, an aw-limited substrate. These are not directly transferable to agar, and the UI says so.

- Gougouli M, Koutsoumanis KP. *Modelling growth of Penicillium expansum and Aspergillus niger at constant and fluctuating temperature conditions.* Int J Food Microbiol. 2010;140:254–262. doi:10.1016/j.ijfoodmicro.2010.03.021. Malt extract agar, pH 4.2, aw 0.997.
- Yogendrarajah P, et al. *Mycotoxin production and predictive modelling kinetics on the growth of Aspergillus flavus and Aspergillus parasiticus isolates in whole black peppercorns.* Int J Food Microbiol. 2016;228:44–57. doi:10.1016/j.ijfoodmicro.2016.03.015.

**Lag at optimum (λopt)** is a demo placeholder for every species: none of the cited abstracts report it.

## Hyphal network model (Mycelium lab)

A stochastic 2D model in the spirit of the **Neighbour-Sensing model**: Meškauskas A, Fricker MD, Moore D. *Simulating colonial growth of fungi with the Neighbour-Sensing model of hyphal growth.* Mycol Res. 2004;108:1241–1256. PMID 15587058.

- Each hypha deposits into a density field. Tips steer down its gradient (negative autotropism), stop where it saturates, and may fuse (anastomosis) when they meet older hyphae.
- Branching is sub-apical after one internode. The lab reports the **hyphal growth unit** (total length ÷ tips produced): Trinci AP. *A study of the kinetics of hyphal extension and branch initiation of fungal mycelia.* J Gen Microbiol. 1974;81:225–236. doi:10.1099/00221287-81-1-225.
- Presets per species change geometry and speed for comparison. They are illustrative, not fitted.

## Open data (live)

| Source | Used for | Endpoint |
|---|---|---|
| GBIF species API | Taxonomy, status, vernacular names | `api.gbif.org/v1/species/{key}` |
| GBIF occurrence API | Record counts, records with images, facets by country / year / basis of record | `api.gbif.org/v1/occurrence/search?taxonKey=…&limit=0&facet=…` |
| GBIF maps API | Hex-binned occurrence density over GBIF base tiles | `api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png` |
| Wikimedia Commons | Openly-licensed culture photographs, with licence, author and file page | `commons.wikimedia.org/w/api.php` |

GBIF usage keys were resolved with `api.gbif.org/v1/species/match` (all exact matches). Responses are cached on disk for 7 days (`web/data/cache`). Commons results are keyword matches, so the UI asks users to verify identity and licence on the file page before reuse.

Datasets considered for a future detector: **AGAR** (18,000 annotated plate photos, bacterial colonies) and **OpenFungi** (macroscopic and microscopic fungal genera). Neither is bundled here.

## What is simulated

| Item | Status |
|---|---|
| Instrument behaviour | Simulated by the device twin |
| Chamber temperature/RH | Simulated first-order dynamics with door disturbances |
| Colony growth | CMI with the parameters above, on the simulated temperature log |
| Colony positions and counts per sample | Demo sampling model by source type (not epidemiology) |
| Presumptive identification | **Simulated classifier**, always labelled |
| Plate images (app) | Procedural renderings of colony records, not photographs |
| Plate textures (Blender renders) | Procedural morphology illustrations, not photographs |
| GBIF, Commons data | Real, fetched live |
