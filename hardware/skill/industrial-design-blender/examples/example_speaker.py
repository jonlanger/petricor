"""
Reference build: compact smart speaker, 96 × 96 × 64 mm, PC/ABS clamshell.
Run:  python example_speaker.py OUT_DIR     (bpy wheel)   or
      blender -b -P example_speaker.py -- OUT_DIR

Decisions (the "why" is what the skill cares about):
- Parting line at z = +10 (upper third), not mid-height: the break sits on the
  shoulder where the top radius begins, so the reveal reads as a deliberate line
  under the control surface rather than a belt around the middle.
- Wall 2.0 mm PC/ABS; 1° draft both halves off the parting plane; MT-11010 texture
  on the body (needs ≥1.5°: 1° base draft + texture spec to be confirmed with the
  texture house — flagged in the report).
- Hidden fasteners: 4 × thread-forming Ø2.5 from underneath, heads under TPE feet.
- Controls: 3 round caps on the top plane, 0.15 mm gap, 0.4 mm proud.
- Grille: hex perforation on the front quadrant of the top shell.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import idkit as ik  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
OUT = os.path.abspath(args[0] if args else "out_speaker")

ik.reset_scene(seg=24)
W, D, H, PZ, WALL = 96, 96, 64, 10.0, 2.0

body = ik.rounded_box("Body", W, D, H, r_plan=22, r_edge=8, r_edge_bottom=3,
                      draft_deg=1.0, parting_z=PZ)
top, bot = ik.clamshell(body, parting_z=PZ, wall=WALL, clearance=0.08, reveal=(0.6, 0.4))
ik.delete(body)

for sx, sy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
    ik.boss_pair(top, bot, (sx * 30, sy * 30), parting_z=PZ, wall=WALL, screw_d=2.5)

ik.rib(bot, (-30, 0), (30, 0), height=5, thickness=1.2, from_ceiling=False)

caps = [ik.aperture_button(top, (x, 18), 9, gap=0.15, proud=0.4, cap_name=f"Button_{i}")
        for i, x in enumerate((-14, 0, 14))]
ik.perforate(top, (0, -18), radius=16, hole_d=1.2, pitch=2.2)
feet = [ik.foot(bot, (sx * 30, sy * 30), d=10, name=f"Foot_{i}")
        for i, (sx, sy) in enumerate(((1, 1), (-1, 1), (1, -1), (-1, -1)))]

body_m = ik.mat_plastic("Body PC/ABS Warm Grey", "#B9B4AB", texture="MT-11010")
base_m = ik.mat_plastic("Base PC/ABS Charcoal", "#3A3A3C", texture="MT-11020")
cap_m = ik.mat_plastic("Cap PC Signal Orange", "#E8561E", texture="SPI-B1")
foot_m = ik.mat_softtouch("Foot TPE", "#2A2A2A")
ik.assign(top, body_m)
ik.assign(bot, base_m)
for c in caps:
    ik.assign(c, cap_m)
for f in feet:
    ik.assign(f, foot_m)

# callout dims for the viewer / drawing sheet (Blender mm coords)
ik.dim("Parting line", (W / 2 + 6, 0, -H / 2), (W / 2 + 6, 0, PZ), view="front")
ik.dim("Button pitch", (-14, 18, H / 2 + 3), (0, 18, H / 2 + 3), view="top")
ik.dim("Grille Ø", (-16, -18, H / 2 + 3), (16, -18, H / 2 + 3), view="top")
for c in caps:
    ik.explode_hint(c, (0, 0, 60))
ik.explode_hint(top, (0, 0, 40))
for f in feet:
    ik.explode_hint(f, (0, 0, -25))

parts = [top, bot] + caps + feet
ik.finish(parts)
ik.studio(parts, preset="studio")
ik.write_report(os.path.join(OUT, "spec.json"), [
    {"obj": top, "material_code": "PC/ABS", "notes": "A-surface MT-11010; confirm draft ≥1.5° w/ texture house"},
    {"obj": bot, "material_code": "PC/ABS", "notes": "B-surface MT-11020; screw heads under feet"},
    *[{"obj": c, "material_code": "PC", "process": "Injection molded"} for c in caps],
    *[{"obj": f, "material_code": "TPE"} for f in feet],
], extra={"product": "Compact smart speaker", "parting_z_mm": PZ})
ik.export_glb(os.path.join(OUT, "model.glb"), parts)
if "--norender" in sys.argv:
    ik.save_blend(os.path.join(OUT, "model.blend"))
    sys.exit(0)
ik.render(os.path.join(OUT, "hero.png"), samples=32)
saved = ik.explode([bot, top] + caps, gap=28, order=[0, 1.6, 2.4, 2.4, 2.4])
ik.frame(parts, el_deg=18, fill=0.7)
ik.render(os.path.join(OUT, "exploded.png"), samples=32)
ik.restore(saved)
ik.frame([bot], az_deg=20, el_deg=65, fill=0.8)
top.hide_render = True
for c in caps:
    c.hide_render = True
ik.render(os.path.join(OUT, "internals.png"), samples=24)
top.hide_render = False
for c in caps:
    c.hide_render = False

ik.save_blend(os.path.join(OUT, "model.blend"))
print("DONE", OUT)
