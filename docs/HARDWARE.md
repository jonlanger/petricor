# PC-6 hardware

The PC-6 is modelled part by part in Blender from one parametric script (`hardware/blender/build_petricor.py`). The same build produces the renders, the interactive web model (`petricor.glb`) and the parts manifest (`parts.json`). Specifications are **design intent** for this concept, not measured performance.

- **Envelope:** 520 W × 498 D × 400 H mm (door closed).
- **Form (v3):** R44 side roll on every side edge and plan corner, R72 back shoulder, R56 knee under the console. The door and console sit between the rounded shoulders; the side-panel reveal runs straight into the door gap.
- **Capacity:** 6 × 90 mm Petri dishes on a removable carousel.
- **Build:** `Blender -b --python hardware/blender/build_petricor.py` → `hardware/petricor.blend`

## Design lineage

It keeps the language of the original Petricor concept: white body, graphite console, gull-wing glass door, integrated label printer and side barcode reader, electric-blue identity. The interior is resolved as a real instrument would need it. References are the common bench-top instrument families: glass-door lab incubators (coved stainless chambers, gaskets, forced-air plenum), automated plate imagers and colony counters (fixed-geometry overhead optics, ring lights, transillumination), and bench label printers and imagers (direct-thermal media, area-imager scan windows).

## Layout

```
          ┌────────────── cover (PC/ABS) ────────────────┐
  door ─▶ │  glazing          imaging head ▼   UV-C bar   │
          │  ┌──────── 316L chamber ─────────┐  EPP      │
 console  │  │  6-dish carousel over backlight│  foam     │
 (47.5°)  │  └────── perforated rear baffle ──┘           │
 screen + ├──────────────── steel deck ──────────────────┤
 printer  │ compute · MCU · stepper+belt · air handler    │ ◀ side reader (right)
          │ (TEC/HEPA/blower) · PSU · reservoir · I/O     │ ◀ rear: grille, hatch, I/O
          └──────────────── steel base + feet ───────────┘
```

**Conditioned zone above the deck, dry zone below.** Every electronic part sits in the dry bay. The chamber holds only the liner, carousel, sensors, imaging head (sealed and heated), baffle and UV-C bar.

## Subsystems

| Subsystem | Parts (model names) | Notes |
|---|---|---|
| Enclosure | `Cover`, `Accent_L/R` | One-piece cover over a steel base. Navy inlays mark the lift points and host the reader window. |
| Door | `Door_frame`, `Door_glass_front/top`, `Hinge_*`, `Door_magnet`, `Logo_*` | Gull-wing L-door on torque hinges. Heated double glazing. Hall interlock. |
| Console | `Console`, `Screen_*`, `Status_lightpipe` | 47.5° console. Optically-bonded 10.1″ panel. Run-state light pipe. |
| Printer | `Printer_*`, `Label_*`, `Platen_roller`, `Thermal_head` | Direct-thermal, drop-in roll, tear bar at the operator. |
| Chamber | `Chamber_liner`, `Air_baffle`, `Door_gasket`, `Chamber_trim`, `THR_probe*`, `UVC_*`, `Chamber_lightbar`, `Insul_*` | Electropolished 316L with coved corners. Perforated return plenum. Molded EPP insulation (45 g/L) shaped to the shell, dimpled outer faces (Ø10 × 2.5 mm, 13 mm hex); 3.5 mm aerogel blanket over the top. |
| Carousel | `Carousel_plate`, `Carousel_knob`, `Drive_*`, `Stepper_*`, `Motor_*`, `Home_sensor`, `Shaft_seal_housing` | Counterbored pockets with through-holes for transillumination. Quick-release knob. 60T/16T belt drive. Sealed shaft. |
| Imaging | `Imaging_head_housing`, `Imaging_window`, `Ring_*`, `Lens_*`, `Camera_*`, `Image_sensor`, `Imaging_heater`, `Backlight_*` | Fixed-geometry head over the rear pocket (the "imaging station"). 24-LED ring in four channels. Edge-lit backlight below. |
| Climate | `Air_handler_duct`, `Cold_side_heatsink`, `TEC_*`, `Hot_side_heatsink`, `Exhaust_fan_*`, `Recirc_blower`, `PTC_heater`, `HEPA_*` | Peltier heat pump across a sealed duct. Blower recirculation. H13 HEPA on return air. |
| Humidity | `Water_reservoir`, `Reservoir_*`, `Ultrasonic_transducer`, `Mist_tube`, `Float_sensor` | Ultrasonic atomiser. Reservoir refilled through a rear hatch. |
| Electronics | `Compute_*`, `CM_heatsink`, `Control_board*`, `Driver_heatsink_*`, `PSU` | Compute module separated from the safety MCU (see ARCHITECTURE.md). |
| Rear I/O | `IO_plate`, `IEC_inlet`, `RJ45`, `USB_A_*`, `Power_switch`, `IO_board` | |
| Side reader | `Scanner_window`, `Scanner_engine`, `Scanner_aimer`, `Scanner_board` | Area imager behind a tinted window inside the right-hand inlay. |
| Base | `Base_tray`, `Foot_*`, `Deck_plate`, `Deck_post_*` | Steel tray and deck. Silicone feet. |

The full list with descriptions is in `hardware/export/parts.json`, which drives the `/hardware` parts table and the viewer tooltips.

## Manufacturing intent

| Part family | Process | Material |
|---|---|---|
| Cover, console, door frame, imaging housing | Injection molding, textured | PC/ABS (white), PC (graphite) |
| Side inlays | Overmold / insert | PC, navy |
| Chamber liner, baffle | Deep draw / fold + weld, electropolish | 316L stainless |
| Base tray, deck, posts, printer chassis, brackets | Laser-cut and folded sheet | Zinc-plated steel (SECC) |
| Carousel | CNC or stamped + anodised | Aluminium |
| Heat sinks | Extrusion | Aluminium |
| Glazing | Tempered, with conductive heater coating on the inner pane | Glass |
| Gasket | Extruded D-profile | Silicone |

## Renders

`hardware/blender/render_petricor.py` renders named shots with Cycles (Metal GPU, AgX view):

| Shot | Content |
|---|---|
| `hero`, `hero_blue`, `front`, `side`, `rear`, `top` | Exteriors (grey and brand-blue studio) |
| `open`, `open_blue` | Door raised, dishes visible |
| `exploded`, `exploded_blue`, `exploded_side` | Full layer-cake explode |
| `section` | Centre-line cut of enclosure, chamber and base |
| `interior` | Enclosure and chamber hidden |
| `x_imaging`, `x_carousel`, `x_climate`, `x_console` | Sub-assembly explodes |
| `x_insulation`, `d_foam` | EPP insulation panels and the dimpled outer face |
| `d_carousel`, `d_imaging`, `d_console`, `d_scanner`, `d_climate`, `d_rear_io` | Detail close-ups (the imaging head is sectioned) |
| `d_handhold`, `d_reveal`, `d_scoop`, `d_corner` | Form details: finger recess, hood/door reveals, door pull, console corner |
| `plates_top`, `d_culture`, `d_culture_b` | Cultures: carousel top-down and two macro shots (low exposure, DOF) |

```bash
Blender -b hardware/petricor.blend --python hardware/blender/render_petricor.py -- hero exploded --samples 192
Blender -b hardware/petricor.blend --python hardware/blender/export_glb.py
```

The touchscreen shows a real capture of the device UI (`hardware/textures/screen_ui.png`, made with `web/scripts/capture.mjs`); the render script swaps in the latest capture at render time, but the GLB bakes in whatever was on disk at build, so re-export after a new capture. Dish cultures are procedural morphology textures (`pc_textures.py`), not photographs. The web plate renderer (`web/lib/viz/plate.ts`) uses the same v6 zone model (fringe, margin, sporulating body, aged centre, reverse pigment, aerial mycelium, heads, exudate) from the per-species `zones` presets in `web/lib/science/species.ts`, so the touchscreen, cloud and renders agree. v6 renders live in `hardware/renders/v6/` and are copied to `web/public/renders/`.
