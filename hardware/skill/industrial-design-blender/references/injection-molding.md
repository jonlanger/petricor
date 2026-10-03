# Injection-molding DFM for consumer electronics

Source tags: **[PL]** Protolabs design tips · **[RJC]** RJC Mold boss guide · **[EPD]** engineeringproductdesign.com screw guide · **[ESS]** Essengold snap-fit guide · **[AV]** Avient GLS TPE overmold guide · **[MT]** Kemal/Mold-Tech texture tables · **[RoT]** industry rule of thumb, not from a retrieved source — confirm with the molder.

Contents: 1 Walls · 2 Draft · 3 Texture draft · 4 Ribs · 5 Bosses & screws · 6 Heat-set inserts · 7 Snap fits · 8 Overmold / 2K · 9 Gates, knit lines, ejectors · 10 Sink & A-surfaces · 11 Undercuts & actions · 12 Parting lines · 13 Tolerances

## 1. Nominal wall
Uniform walls cool evenly; thickness changes cause sink, warp and voids. Transition gradually (3:1 taper length) where change is unavoidable [RoT].

| Resin | Wall range [PL] (converted) | Typical CE housing [RoT] |
|---|---|---|
| ABS | 1.1–3.6 mm | 1.8–2.5 |
| PC | 1.0–3.8 mm | 1.5–2.5 |
| PC/ABS | (between PC and ABS) | 1.5–2.2 |
| Nylon (PA) | 0.8–2.9 mm | 1.2–2.0 (often GF for chassis) |
| Acetal (POM) | 0.8–3.0 mm | mechanisms, latches |
| PP | 0.6–3.8 mm | living hinges, low-cost |
| Acrylic (PMMA) | 0.6–12.7 mm | lenses/light pipes |
| PPS / LCP | 0.5–4.6 / 0.8–3.0 mm | thin-wall, high-temp |

Secondary features (ribs, boss walls) should be **40–60% of the adjacent wall** [PL].

## 2. Draft
- Minimum 0.5° on all vertical faces; 1–2° is comfortable; ~1° per 25 mm of depth as a rule [PL].
- Metal-on-metal shutoffs: ≥3° [PL].
- Minimum-thickness/draft pairings [PL]: 6 mm deep → 1.0 mm/0.5°; 13 mm → 1.0 mm/1° or 1.5 mm/0.5°; 25 mm → 1.5 mm/2° or 2.0 mm/1°.
- Draft tapers away from the parting line on both halves. Silhouette cost: offset per side = depth × tan(draft) — 40 mm × tan 1° = 0.70 mm.
- Inner (core) walls usually need a touch more draft than outer walls because parts shrink onto the core [RoT].

## 3. Texture adds draft
Draft grows with texture depth [MT]:

| Texture depth | Typical draft |
|---|---|
| 0.010–0.025 mm | 1–1.5° |
| 0.038–0.051 mm | 2.5–3° |
| 0.064–0.076 mm | 4–4.5° |
| 0.10–0.13 mm | 6–7.5° |

Light texture (PM-T1) ≥3°, heavy (PM-T2) ≥5° per Protolabs' own finishes [PL]. The common rule "1° per 0.025 mm (0.001") of texture depth, on top of base draft" is [RoT] — always confirm with the texture house for the exact code. Mold-Tech series A = fine (electronics housings), C = coarse/grip [MT].

## 4. Ribs
- Thickness 40–60% of wall [PL]; 0.5–0.6 × wall is the usual target on cosmetic parts [RoT].
- Height ≤ 3 × wall; spacing ≥ 2 × wall; base fillet 0.25–0.5 × wall; 0.5–1° draft per side [RoT].
- Prefer several short ribs to one tall one. Run ribs to walls/bosses to stiffen but break them 0.5–1 mm short of an A-surface wall if sink shows.

## 5. Bosses & thread-forming screws
- Boss OD ≈ 2 × screw nominal d (M3 → 6 mm) [RJC]; boss wall 0.4–0.6 × nominal wall to avoid sink [RJC]. These two conflict for small screws in thin walls — resolve by: attaching the boss to the wall via thin ribs (~1 mm) rather than merging [RJC], coring the base, putting the boss behind a non-cosmetic or textured face, or accepting and stating the sink risk.
- Boss height ≤ 2.5–3 × OD [RJC]; draft 0.5–1° per side, 1–2° for tall bosses [RJC]; base radius 0.25–0.5 × wall [RJC].
- Thread-forming screws (PT, Delta PT, Hi-Lo): engagement length 2–2.5 × d [EPD]; ~75–80% thread engagement in stiff resins [EPD]; boss OD ≈ 2.5–3 × pilot [EPD]. Starting pilot ≈ 0.8 × d [RoT] — **screw makers (EJOT, Stanley/Semblex) publish resin-specific pilot/OD tables; use those for final**.
- Strip-to-drive torque ratio ≥3:1, ~5:1 for automated assembly [EPD].
- Add a 0.3–0.5 mm counterbore/lead-in at the boss top so the first thread doesn't split the boss [RoT].
- Clearance hole in the mating part: d + 0.2–0.4 mm [RoT]. Hide heads under feet, labels, battery doors or trim.

## 6. Heat-set inserts (when disassembly matters)
From [RJC]: hole = insert guide Ø + 0.05; boss OD = hole + 2 × 0.6T; bottom clearance ≥ 0.5 mm; floor under insert 0.6–0.8T; entry chamfer ≈ 0.2 × 0.2 mm; boss height ≈ 2–5T. Use inserts for machine screws where users/service open the product repeatedly.

## 7. Cantilever snap fits
- Root strain: **ε = 3·h·y / (2·L²)** (h root thickness, y undercut/deflection, L arm length) [ESS].
- One-time allowable strain typically 2–8% depending on resin [ESS]; design well below it for repeated use. Get the grade's value from the resin datasheet (Covestro, SABIC, etc.).
- Root fillet ≥ 0.5 × h [ESS]; taper arm to ~0.5 h at the tip to spread strain [ESS]; lead-in 25–35° [ESS]; retention face ~90° for permanent, shallower (35–45°) for releasable [ESS/RoT].
- PC stress-whitens — use generous root fillets [ESS]. PA shifts with moisture [ESS].
- Tooling: hooks need a lifter/slide, or a **pass-through core** (a window in the wall behind the hook so steel can form the undercut in the straight pull) — the window is often the cheaper choice [RoT].
- Pair snaps with a locating feature (pins, lip) so the snap only holds, never locates.

## 8. Overmold / 2K (grips, bumpers, buttons, seals)
From [AV]:
- TPE thickness 1.5–3.0 mm for bonding; >1.0 mm for soft-touch perception; TPE ≤ substrate thickness (warpage).
- Shut-off groove on the substrate 0.38–0.76 mm deep at TPE edges — positive steel shut-off to stop flash.
- Min corner radius 0.5 mm; flow length/thickness ≤ 150:1.
- Chemical bonding families: Versaflex/Versollan-type TPEs to PC, ABS, PC/ABS, PA; Dynaflex-type to PP/PE — pair resin + TPE by the supplier's bond chart.
- Insert molding roughly < 250 k units/yr; two-shot above that [AV].
- Add mechanical interlocks (through-holes, undercut channels) when chemical bond is marginal [RoT].
- Grip durometer commonly Shore A 40–70; softer = more grip but more wear/dust [RoT].

## 9. Gates, knit lines, ejectors [RoT]
- Gate into the thickest section, on a B-surface or under a feature that hides the vestige (behind a label, inside a lip). Tunnel/sub gates auto-degate for cosmetic parts.
- Knit (weld) lines form where flow fronts meet around holes (grilles!, button openings). Keep them off A-surface highlights and away from snap roots/bosses under load.
- Ejector pins land on ribs, boss bases and flat B-surfaces — plan flat pads for them; never on the A-side.

## 10. Sink & A-surface protection
Sink appears opposite thick sections: rib/boss roots, wall intersections. Countermeasures: thinner ribs, cored bosses, textured A-surface (hides ~0.02–0.05 mm sink better than gloss) [RoT], decorative grooves over the rib line, gas-assist for thick handles.

## 11. Undercuts & actions
Every undercut costs a slide, lifter or collapsing core (tool cost and cycle). Prefer: pass-through cores, bump-offs for small flexible undercuts (TPE, PP), rotating the pull direction, or splitting the part. Side-actions are normal on premium CE (side ports, buttons in side walls) — just make each one deliberate and list it.

## 12. Parting lines
Put them on edges or tangent breaks where a small witness/flash disappears; the inside edge after a radius hides better than the apex [Core77 discussion]. A parting line on a big convex radius needs side actions or accepts a visible line — decide early. Premium makers hand-finish or polish out lines; that isn't affordable for most products, so design so it isn't needed.

## 13. Tolerances & fits [RoT — confirm with molder]
- General molded dims: ±0.05–0.1 mm on small features, ±0.1–0.2 mm on ~100 mm housings (resin and tool dependent; PC/ABS ~0.5–0.7% shrink, PP 1.5–2%).
- Lip & groove clearance 0.05–0.10 mm per side; button gap 0.10–0.20 mm per side; flush/step between halves 0.05–0.10 mm intentional step.
- Stack-ups: add worst-case and RSS for anything that must be flush or have an even gap.
