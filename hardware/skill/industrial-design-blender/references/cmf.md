# CMF — color, material, finish

Tags: **[MT]** Mold-Tech/texture tables · **[AV]** Avient · **[RoT]** rule of thumb / general industry practice, verify with suppliers.

## Resin quick-pick for CE [RoT]
| Resin | Why pick it | Watch |
|---|---|---|
| PC/ABS | Default housing: tough, paintable, good texture, flame-retardant grades | Chemical resistance (sunscreen, cleaners) varies by grade |
| PC | Clear parts, impact, high gloss | Stress cracking, scratches, whitening at snap roots |
| ABS | Cheap, crisp texture detail [MT] | Lower impact/heat than PC/ABS |
| PA-GF | Chassis, brackets, stiff clips | Moisture changes dims; glass shows on surface |
| POM | Gears, sliders, latches | Hard to bond/paint |
| PP | Living hinges, low cost | Poor paint adhesion, loses fine texture [MT] |
| PMMA | Light pipes, lenses, windows | Brittle; scratches |
| TPE/TPU | Grips, feet, bumpers, seals, 2K buttons | Bond compatibility [AV], dust pickup, discoloring in light colors |
| Silicone (LSR) | Keypads, straps, skin-contact | Separate process, attracts lint |
| Al 6063/6061 anodized | Premium shells, bands, knobs | Anodize color matching across batches; RF shielding |
| Zinc die-cast | Weight, knobs, bases | Needs plating/paint |
| Knit/woven fabric | Speakers, soft-tech home products | Needs frame; acoustic transparency spec |

## Finishes on molded plastic
- **SPI (polish)**: A1–A3 mirror/gloss (lenses, piano black trims), B1–B3 semi-gloss, C1–C3 stone, D1–D3 blasted.
- **Mold-Tech (chemical etch)**: A-series fine (electronics housings), B general, C coarse/grip, D high-relief [MT]. Codes like MT-11000/11010/11020 are common fine-to-medium matte references — confirm exact depth & draft with the texture house.
- **VDI 3400 (EDM spark)**: numbered by roughness (e.g. VDI 12 fine … VDI 45 coarse); common in EU tooling [RoT].
- Gloss shows sink, knit lines, fingerprints and scratches; matte texture hides them. Gloss is a statement — use it small (a trim, a key, a lens).

## Secondary operations
Soft-touch paint (velvety, can wear/stick over years), UV hard-coat (scratch), metallic/NCVM (metal look, RF-transparent), IMD/IML (graphics in the mold), pad print / screen print (legends), laser etch (legends through paint), PVD (metal coatings), anodize dye + laser (Al), hairline/brushing & bead-blast before anodize.

## Color strategy
- **Neutral body + one accent** is the dominant premium-CE formula: warm greys, off-whites, charcoals, with a single signal color on the primary control (the TE/Braun/Nothing move).
- **Warm neutrals** (greige, sand, oat) read domestic/soft-tech; **cool greys/black** read pro/tech.
- Match across materials by *perceived* color, not hex: fabric reads darker/softer than plastic; texture reads lighter than gloss; transparent parts shift with what's behind them.
- Name every color with intent: "Chalk #E9E6DF — blends with walls, hides dust" beats "white".
- Specify production color by a physical standard (Pantone, RAL, NCS, or a supplier color chip); hex values are for renders only.

## Current trend signals (as observed from Lemanoosh/Core77 — verify recency before citing)
- Soft electronics: textiles integrated on CE surfaces for tactile, living-room-friendly products (Lemanoosh "Soft Electronics" article).
- Transparency and high-contrast mechanical detailing (Nothing-style exposed internals).
- Sustainable materials: recycled resins, bio-based plastics, recycled fabrics — expect specks/variation; design colors that tolerate it.

## Blender mapping (idkit presets)
| idkit | Real-world spec to write |
|---|---|
| `mat_plastic(hex, "SPI-A2")` | Gloss, SPI A2 polish |
| `mat_plastic(hex, "SPI-B1")` | Semi-gloss |
| `mat_plastic(hex, "MT-11000/11010/11020")` | Fine → medium Mold-Tech etch, add texture draft |
| `mat_plastic(hex, "VDI-27/33")` | EDM spark medium/coarse |
| `mat_softtouch(hex)` | TPE overmold or soft-touch paint |
| `mat_anodized(hex, "bead-blast"/"brushed"/"polished")` | Al 6063, finish + anodize type II color |
| `mat_fabric(hex)` | Knit acoustic fabric over frame |
| `mat_clear(tint, rough, smoked)` | PMMA/PC lens, SPI A1–A2, tint % |
| `mat_emissive(hex)` | LED/light pipe glow for status |
These are look approximations for review renders, not physically measured appearance.
