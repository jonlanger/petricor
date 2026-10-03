# Petricor

Automated fungal culture incubation and imaging. It covers a benchtop instrument (**PC-6**), its touchscreen workflow, a cloud platform for review and traceability, and a science layer that models colony growth from published parameters.

This is a product design concept, built as a working system:

| | Where | What |
|---|---|---|
| Hardware | `hardware/` | Parametric Blender model (257 objects, 101 named parts), Cycles renders, exploded views, GLB for the web |
| Marketing site | `web/app/page.tsx`, `/hardware` | Bold, minimalist homepage; interactive 3D explode; render gallery; parts list |
| On-device UI | `web/app/device`, `web/components/device` | 1280×800 touchscreen: sign-in, six-step run wizard, incubation dashboard, dish detail, unload + UV-C, service |
| Cloud app | `web/app/app` | Overview, instruments, runs (timelapse, colony tracking, review, report, export), samples + custody, species library, Mycelium lab, audit, settings |
| Device twin | `web/lib/server/twin.ts` | Firmware stand-in: climate dynamics, carousel, printer, reader, imaging cadence, interlocks, alarms |
| Science | `web/lib/science` | Cardinal Model with Inflection with cited parameters, colony observation model, species library with GBIF keys |
| Visualisation | `web/lib/viz` | Growth-aware procedural plate renderer (4 light channels), stochastic hyphal network simulator |

## Run it

```bash
cd web && npm install && npm run dev
```

Then open:
- `http://localhost:3000`: homepage
- `http://localhost:3000/device`: the PC-6 touchscreen, with the physical-actions panel
- `http://localhost:3000/app`: Petricor Cloud (choose a persona)

The seeded lab has three instruments. Bench A is mid-way through a reference-strain QC run, Bench B is idle, and Env Lab is offline. Simulation speed defaults to 120× and can be changed in the touchscreen's Service view or the bench panel. Reset from **Settings → Demo data**.

A short demo:
1. On `/device`, sign in, open **Service** and set 3600× to watch the carousel index and the dishes grow.
2. In a second window, open `/app` as Dr. Alex Morgan. The same run streams live on the Overview.
3. Open the run to scrub the timelapse, switch channels, and click a colony for its growth curve and alternatives.
4. When it completes, approve it, then open **Report** or **Export CSV**.
5. Back on `/device`: lift the door, confirm *Dishes removed*, close it, run UV-C, then **New run** to go through print → scan → load → start.

## Hardware pipeline

```bash
Blender -b --python hardware/blender/build_petricor.py
Blender -b hardware/petricor.blend --python hardware/blender/render_petricor.py -- hero open exploded section --samples 192
Blender -b hardware/petricor.blend --python hardware/blender/export_glb.py
node web/scripts/capture.mjs "http://localhost:3000/device?kiosk=1&operator=u_emily" hardware/textures/screen_ui.png
# homepage story screenshots (reset the demo + fast-forward Bench A to ~day 3 first), from web/:
node scripts/capture-story.mjs http://localhost:3000
# Mycelium lab specimen thumbnails (public/lab/*.jpg), from web/:
node scripts/capture-lab-thumbs.mjs http://localhost:3000
```

Tested with Blender 4.1 (Cycles, Metal). The display texture in the renders is a real capture of the device UI.

## Docs

- [Architecture](docs/ARCHITECTURE.md): system diagram, firmware split, state machine, API, data model, production path
- [Hardware](docs/HARDWARE.md): subsystems, parts, manufacturing intent, render shots
- [User flows](docs/USER-FLOWS.md): device and cloud flows by persona
- [Science & data](docs/SCIENCE-AND-DATA.md): models, citations, live open-data sources, and exactly what is simulated

## Honesty notes

Only *A. niger* and *P. expansum* use fully cited growth parameters; *A. flavus* is partly derived from a cited range, and every other species uses flagged demo placeholders. Identification is a simulated classifier. Plate images are procedural renderings of colony records. GBIF and Wikimedia Commons data are real and fetched live.
# petricor
