# Architecture, part breaks, armatures & fasteners

Items marked [RoT] are practitioner rules of thumb, not sourced numbers — confirm with engineering.

## Clamshell variants — pick deliberately

| Architecture | When | Watch-outs |
|---|---|---|
| **Top/bottom (horizontal break)** | Desk objects, speakers, hubs, routers | Where the line sits on the silhouette; draft on tall side walls |
| **Front/back (vertical break)** | Handhelds, remotes, controllers, phones | Line runs through the grip — dress it or move it to the side face |
| **Sandwich / midframe** | Premium devices; metal band or plastic frame carries load, covers are cosmetic | More parts, but each can be a different CMF (glass + Al + PC) |
| **Sleeve / tube + end caps** | Cylindrical speakers, lights, batteries | Extruded/rolled sleeve (Al, fabric over frame) with molded caps; tolerance at cap joints |
| **Tub + lid/bezel** | Displays, tablets, remotes | Bezel carries buttons; tub is the structure |
| **Unibody + door/window** | Premium metal (CNC) products | Internal access via a single cover; expensive machining |

## Part-break decision guide
1. **Function first**: which parts must be different materials/colors/finishes, transparent, soft, or serviceable? Each difference is a part — or a 2K shot.
2. **Pull direction**: can each part release in one straight pull? If not, split, or pay for an action.
3. **Where does the eye land?** Put breaks where light breaks anyway — at a shoulder, a tangent edge's back side, a color change, or a groove that's part of the design language.
4. **Assembly**: every break is a joint. Joints need location (lip, pins), retention (screws/snaps), and sealing if needed (gasket, lip-over-lip for splash).
5. **Count**: fewer parts = cheaper, fewer tolerances. Consolidate (living hinges, 2K, snap-in features) but not at the expense of one horrible tool.

## Dressing the joint
- **Step lip (idkit default)**: inner half of the wall rises on one part (lip), outer half on the other. Lip height ≈ 1–1.5 × wall, lip thickness ≈ wall/2, clearance 0.05–0.10 per side [RoT]. Blocks light leaks and dust; lets halves self-locate.
- **Tongue & groove**: centered tongue in a groove; better for sealing/ultrasonic welding (energy director on tongue).
- **Reveal / shadow line**: 0.4–1.0 mm wide, 0.3–0.6 mm deep groove centred on the break [RoT]; hides mismatch and flash, reads as intent.
- **Intentional step**: offset the cosmetic part 0.05–0.1 mm inboard so worst-case never proud [RoT].
- **Color break**: the joint coincides with a CMF change — the line becomes the design.
- **Over-lap (skirt)**: one part wraps over the other's edge — the joint lives on the underside.

## Internal armature / chassis
Use when: loads (drop, press, twist) exceed what a 2 mm shell can take; heavy parts (drivers, batteries, weights) need anchoring; heat spreading; acoustic volumes need sealing; or the exterior is fabric/soft and can't be structure.
- **Plastic chassis/carrier** (PC-GF, PA-GF): holds PCB, battery, speakers; exterior shells hang on it. Enables fabric/soft exteriors.
- **Sheet-metal frame** (SUS/Al, 0.5–1.0 mm): stiffness + EMI ground + heat spreading; tabs and PEM-style fasteners.
- **Die-cast / MIM midframe** (Mg, Al, Zn): premium handhelds; thin sections with a lot of stiffness; machined datums.
- **Weights**: zinc or steel ballast low in desk products for stability and perceived quality.
Design the chassis first; the skin follows with a constant clearance (≥0.3–0.5 mm to moving/flexing parts [RoT]).

## Internal layout checklist
- PCB: standoffs/bosses on a grid, 3 mm+ keep-out from board edge components [RoT]; board datum by two pins (one round, one slotted).
- Battery: swelling allowance (commonly ~8–10% thickness for Li-poly pouches [RoT, check cell datasheet]), no sharp features against it, foam pads.
- Antennas: keep metal and ground planes away; plastic windows or breaks in metal bands.
- Buttons: switch under cap with over-travel; light pipes need a sealed channel to stop bleed.
- Acoustic: sealed back volume, grille open area (perforation 20–40% typical [RoT]), mesh/fabric behind.
- Thermal: vents on B-surfaces, not where fingers or dust go.

## Fastener catalog
| Method | Use | Notes |
|---|---|---|
| Thread-forming screw into boss | Default clamshell | Hidden heads under feet/labels; limited re-assembly cycles |
| Machine screw + heat-set/ultrasonic insert | Serviceable joints | More cost; many re-assembly cycles |
| Cantilever / annular snaps | Tool-less, low-cost, covers & doors | Molding needs lifters or pass-through cores; plan the release path |
| Ultrasonic welding | Sealed, permanent (chargers, pods) | Energy director on tongue; unserviceable |
| Heat staking | Holding PCBs, windows, meshes | Cheap, permanent |
| PSA / adhesive | Glass, fabric, trim, badges | Surface prep and bond line; fixture during cure |
| Press-fit pins / dowels | Location, not retention | Pair with snaps or screws |
Hide fasteners by default in consumer products; expose them only as a deliberate aesthetic (tool/rugged/TE-style honesty) — and then make them beautiful: consistent head style, symmetric placement, flush or evenly recessed.

## Assembly & service
Write the assembly sequence as numbered steps top-down in Z. Each step: part in, how it's located, how it's retained. Flag anything that needs a fixture, adhesive cure, or blind assembly. Say which parts a user or repair tech can reach and how (right-to-repair expectations are rising; hidden screws under peel-off feet are common).
