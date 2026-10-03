"""Build the Petricor PC-6 benchtop incubator/imager as a fully-parted Blender model.

Run:  Blender -b --python hardware/blender/build_petricor.py
Outputs: hardware/petricor.blend, hardware/export/petricor.glb, hardware/export/parts.json
"""
import bpy, bmesh, math, os, sys, json, random
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import importlib, pc_lib, pc_textures
importlib.reload(pc_lib); importlib.reload(pc_textures)
from pc_lib import *
import numpy as np

ROOT = os.path.abspath(os.path.join(HERE, '..'))
TEX = os.path.join(ROOT, 'textures'); os.makedirs(TEX, exist_ok=True)
EXPORT = os.path.join(ROOT, 'export'); os.makedirs(EXPORT, exist_ok=True)
FONT_PATH = os.path.expanduser('~/Library/Fonts/RedditMono-SemiBold.ttf')
FONT_REG = os.path.expanduser('~/Library/Fonts/RedditMono-Medium.ttf')

reset_scene()
M = build_materials()
FONT = bpy.data.fonts.load(FONT_PATH) if os.path.exists(FONT_PATH) else None
FONT_R = bpy.data.fonts.load(FONT_REG) if os.path.exists(FONT_REG) else FONT
random.seed(7)

DEV = coll('Device')
C = {k: coll(k, DEV) for k in [
    'Enclosure', 'Door', 'Console', 'Chamber', 'Carousel', 'Dishes', 'Imaging', 'Climate', 'Humidity',
    'Electronics', 'Printer', 'Scanner', 'RearIO', 'Base', 'Wiring']}

# ======================================================================= DESIGN DRIVERS
# Form thesis: a calm white laboratory block whose one expressive gesture is the dark 47.5° console rising
# into a glass hood — the dishes are the display. Lineage: Braun rationality + Dyson "function made visible".
# Every driver is a named constant so an iteration is a diff here, not a rewrite.
# v3 "rounder": the side roll (every edge where the side meets the profile, incl. the plan corners) grows R24 → R44 and
# the back shoulder R48 → R72, after the sketch's soft, pebble-like block. The body widens 480 → 520 mm to pay for it,
# so the chamber, door and console keep their size and sit between the rounded shoulders.
R_PRIMARY = 72      # back-top shoulder
R_KNEE = 56         # slope-to-front knee under the console
R_SECONDARY = 24    # top-front, console junction (concave)
R_ROLL = 44         # side roll: all side edges and the plan corners
R_DETAIL = 8        # foot of the lip, base, windows, hatches
R_BREAK = 1.0       # edge break on every moulded edge
WALL = 3.0          # PC/ABS nominal for a large cover (upper end of the PC/ABS range; confirm with molder)
GAP_DOOR = 1.5      # moving door: constant all round
REVEAL = 0.8        # fixed part breaks (dressed shadow line over a step lip)
LIP_T, LIP_W = 1.5, 6.0          # step lip under each reveal: thickness, half-width
BOSS_STANDOFF = 2.5             # bosses stand off the A-surface wall, tied in by 1 mm gussets (no thick section → no sink)
W = 260                          # half width
SPLIT_X = W - R_ROLL             # side panel / saddle break, on the tangent of the side roll (light breaks there)
D_HALF = SPLIT_X - REVEAL / 2    # door + console openings end on the break, so the reveal runs into the door gap
DRAFT_WINDOW, DRAFT_POCKET = 1.5, 2.0   # draft on through-openings in the ±X-pulled side panels (°)
SCAN_WIN = None  # set after rrect is available

# Side profile of the body (Y, Z) in mm. -Y is the front of the device.
P = [(250, -40), (250, 400), (-120, 400), (-120, 196), (-248, 56), (-248, -40)]  # runs below z=0 so the side roll
# never reaches the base: the cover is trimmed at z=12 and meets the tray with a crisp edge (no pillowed tuck-under)
P_R = [R_DETAIL, R_PRIMARY, R_SECONDARY, R_SECONDARY, R_KNEE, R_DETAIL]


def _profile(d, seg=14):
    """Side profile offset inward by d, with radii propagated (convex − d, concave + d)."""
    base = offset_polygon(P, d) if d else P
    radii = [max(r - d, 1.5) if i != 3 else r + d for i, r in enumerate(P_R)]
    return fillet_polygon(base, radii, seg=seg)


def envelope(name, inset, x_half, roll_steps=12):
    """Body solid inset by `inset` everywhere, lofted ring by ring (the idkit.rounded_box approach):
    the side roll is a true R_ROLL−inset quarter-round — no bevel modifier, so nothing clamps or
    self-overlaps and the solid stays watertight for booleans."""
    r = R_ROLL - inset
    stations = []  # (x, offset)
    for k in range(roll_steps, -1, -1):          # left roll: from the cap (θ=90°) to the tangent (θ=0)
        th = math.pi / 2 * k / roll_steps
        stations.append((-(x_half - r) - r * math.sin(th), inset + r * (1 - math.cos(th))))
    for k in range(0, roll_steps + 1):           # right roll: tangent → cap
        th = math.pi / 2 * k / roll_steps
        stations.append(((x_half - r) + r * math.sin(th), inset + r * (1 - math.cos(th))))
    bm = bmesh.new()
    rings = []
    for x, d in stations:
        rings.append([bm.verts.new((x * MM, y * MM, z * MM)) for (y, z) in _profile(d)])
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); C['Enclosure'].objects.link(ob)
    smooth(ob)
    return ob


# ----------------------------------------------------------------- outer cover (split into parts below)
cover = envelope('Cover', 0, W)
inner = envelope('Cover_inner', WALL, W - WALL)
boolean(cover, inner)
boolean(cover, box('cut', (700, 900, 60), (0, 0, -18)))                      # bottom opening
boolean(cover, box('cut', (2 * D_HALF, 220, 190), (0, -210, 12 + 95 - 1)))  # console bay
boolean(cover, box('cut', (2 * D_HALF, 380, 320), (0, 58 - 190, 199.5 + 160)))  # door opening
# rear: exhaust grille (hot-side fan) + I/O bay + reservoir hatch (left side)
slots = [box(f's{i}', (5, 30, 74), (-42 + i * 10, 248, 72), bev=0) for i in range(9)]
boolean(cover, join(slots, 'slots'))
boolean(cover, box('cut', (128, 30, 64), (152, 248, 50), bev=0))
# side scanner window (right) inside the navy accent
SCAN_WIN = rrect(96, 38, R_DETAIL, 80, 72)
scan_cut = loft_yz_draft('cut', SCAN_WIN, W - 15, W + 10, DRAFT_WINDOW)
boolean(cover, scan_cut)
# navy side accent pockets (1 mm deep) both sides
ACCENT = fillet_polygon([(-200, 12), (-60, 150), (170, 150), (200, 120), (200, 12)], [0, 40, 30, 24, 0], 12)  # stays on the flat, clear of the R44 roll
boolean(cover, extrude_yz('cut', ACCENT, -(W + 5), -(W - 1)))
boolean(cover, extrude_yz('cut', ACCENT, W - 1, W + 5))
# rear reservoir hatch opening
hcut = box('cut', (100, 20, 88), (-168, 248, 60)); bevel(hcut, 6, 4, angle=80, harden=False); apply_mods(hcut)
boolean(cover, hcut)
# lift handholds: a moulded pocket under each side inlay (touch point: "hold here" — the first thing hands find)
HH = rrect(160, 70, R_DETAIL, 50, 9)          # (y, z) outline: y −30…130, opening up to z 44
for sx in (-1, 1):
    boolean(cover, loft_yz_draft('cut', HH, sx * (W - 14), sx * (W + 10), DRAFT_POCKET))


def part_slab(src, name, x0, x1):
    """One manufactured part = the cover intersected with an X slab."""
    ob = src.copy(); ob.data = src.data.copy(); ob.name = name
    C['Enclosure'].objects.link(ob)
    boolean(ob, box('cut', (x1 - x0, 1400, 1400), ((x0 + x1) / 2, 0, 200)), op='INTERSECT')
    return ob


def boss(name, x, y, z0, h, od=7.0, pilot=2.9, gussets=(), coll_=None):
    """Thread-forming screw boss (M3.5 PT: OD ≈ 2×d, pilot ≈ 0.8×d, 1 mm gussets to the wall)."""
    b = cyl(name, od / 2, h, (x, y, z0 + h / 2), coll_ or C['Enclosure'], verts=32)
    parts_ = [b] + [box(f'{name}_g{i}', gs[:3], gs[3:], coll_ or C['Enclosure']) for i, gs in enumerate(gussets)]
    b = join(parts_, name)
    boolean(b, cyl('cut', pilot / 2, h * 0.85, (x, y, z0 + h * 0.85 / 2 - 0.01), verts=20))
    return b


# ---- part break: side panels (pulled ±X, one family tool) + top/back saddle (pulled on the 45° diagonal)
side_L = part_slab(cover, 'Side_Panel_L', -300, -SPLIT_X - REVEAL / 2)
side_R = part_slab(cover, 'Side_Panel_R', SPLIT_X + REVEAL / 2, 300)
saddle = part_slab(cover, 'Top_Saddle', -SPLIT_X + REVEAL / 2, SPLIT_X - REVEAL / 2)
bpy.data.objects.remove(cover)

# step lip under each reveal, moulded on the saddle: blocks light and dust, lets the parts self-locate
lip = envelope('Saddle_lip', WALL, W - WALL)
boolean(lip, envelope('cut', WALL + LIP_T, W - WALL - LIP_T))
for c_ in (box('cut', (2 * D_HALF, 380, 330), (0, -132, 364)), box('cut', (2 * D_HALF, 220, 196), (0, -210, 104)), box('cut', (700, 900, 60), (0, 0, -18))):
    boolean(lip, c_)
strips = []
for sx in (-1, 1):
    st = lip.copy(); st.data = lip.data.copy(); C['Enclosure'].objects.link(st)
    # the lip projects past the break under the side panel; only 1 mm overlaps the saddle wall (no thick section behind the A-surface)
    x0_, x1_ = SPLIT_X - REVEAL / 2 - 1.0, SPLIT_X + LIP_W
    boolean(st, box('cut', (x1_ - x0_, 1400, 1400), (sx * (x0_ + x1_) / 2, 0, 200)), op='INTERSECT')
    strips.append(st)
bpy.data.objects.remove(lip)
# stiffening ribs under the top (1.5 mm = 0.5 × wall, 5 mm tall ≤ 3 × wall) + two rear bosses
ribs = [box(f'rib{i}', (2 * SPLIT_X - 40, 1.5, 5), (0, yv, 400 - WALL - 2.5)) for i, yv in enumerate((70, 110, 150, 190))]
ribs += [box(f'ribl{i}', (1.5, 170, 5), (xv, 145, 400 - WALL - 2.5)) for i, xv in ((0, -100), (1, 100))]
RB_Y = 250 - WALL - 3.5 - BOSS_STANDOFF
rbosses = [boss(f'sb{i}', xv, RB_Y, 12, 22, gussets=[(1.0, 6.5, 16, xv + 3.2, RB_Y + 3.25, 20), (1.0, 6.5, 16, xv - 3.2, RB_Y + 3.25, 20)])
           for i, xv in enumerate((-70, 70))]
saddle = join([saddle] + strips + ribs + rbosses, 'Top_Saddle')

sides = {}
for sx, sp in ((-1, side_L), (1, side_R)):
    bx = sx * (W - WALL - 3.5 - BOSS_STANDOFF)
    bs = [boss(f'bb{sx}{i}', bx, yv, 12, 22, gussets=[(6.5, 1.0, 16, bx + sx * 3.25, yv + 3.2, 20), (6.5, 1.0, 16, bx + sx * 3.25, yv - 3.2, 20)])
          for i, yv in enumerate((-150, 175))]
    sides[sx] = join([sp] + bs, sp.name)
side_L, side_R = sides[-1], sides[1]

for o in (side_L, side_R, saddle):
    o.data.materials.clear(); o.data.materials.append(M['shell'])
    bevel(o, R_BREAK, 2, angle=40)
PANEL_SPEC = 'PC/ABS, 3.0 mm wall, MT-11010 · Lab White #ECEEF2'
for sx, o in ((-1, side_L), (1, side_R)):
    tag(o, 'Enclosure', 'Side panel', 'Mirrored pair from one family tool, pulled along X. Carries the full side profile and the R44 roll; '
        'the parting line sits on the roll tangent and meets the saddle in a 0.8 mm reveal. Two M3.5 thread-forming screws into gusseted '
        'bosses from under the base — no visible fasteners.', (sx * 110, 0, 420), PANEL_SPEC)
    o['pc_process'] = 'Injection moulded (family tool, pull ±X)'
tag(saddle, 'Enclosure', 'Top saddle', 'Top and back in one L-shaped moulding pulled on the 45° diagonal so both faces draft. Step lips run '
    'under both reveals; ribs stiffen the 430 mm span; two rear bosses take the screws from below.', (0, 0, 420), PANEL_SPEC)
saddle['pc_process'] = 'Injection moulded (pull on Y+Z diagonal)'

# handhold liners close the pockets (graphite, matches the console family)
for sx in (-1, 1):
    liner_ = loft_yz_draft(f'Lift_pocket_{"L" if sx < 0 else "R"}', rrect(166, 76, R_DETAIL + 3, 50, 9), sx * (W - 17), sx * (W - WALL), DRAFT_POCKET, C['Enclosure'])
    boolean(liner_, loft_yz_draft('cut', HH, sx * (W - 14), sx * (W + 10), DRAFT_POCKET))
    boolean(liner_, box('cut', (700, 900, 60), (0, 0, -18)))
    liner_.data.materials.append(M['graphite_matte'])
    bevel(liner_, R_BREAK, 2)
    tag(liner_, 'Enclosure', 'Lift handhold', 'Moulded pocket under each side inlay, sized for four fingers; the lift points are where hands '
        'naturally land, away from the door and screen.', (sx * 110, 0, 420), 'PC/ABS, 2.0 mm, MT-11020 · Graphite #141518')

for sx in (-1, 1):
    acc = extrude_yz(f'Accent_{"L" if sx < 0 else "R"}', ACCENT, (W - 1) * sx, W * sx, C['Enclosure'])
    boolean(acc, loft_yz_draft('cut', SCAN_WIN, W - 15, W + 10, DRAFT_WINDOW)) if sx > 0 else None
    boolean(acc, loft_yz_draft('cut', HH, sx * (W - 14), sx * (W + 10), DRAFT_POCKET))
    acc.data.materials.append(M['navy'])
    bevel(acc, 0.6, 2)
    tag(acc, 'Enclosure', 'Side accent inlay', 'Navy inlay insert-moulded into the side panel; the colour break marks the grip zone above the handhold.',
        (sx * 90, 0, 420), 'PC, 1.0 mm, SPI-B1 · Petricor Navy #191C55')

# ----------------------------------------------------------------- base chassis
base = extrude_xy('Base_tray', rrect(2 * (W - 6), 488, R_ROLL - 6, 0, 1), 4, 12, C['Base'], )  # follows the R44 plan corners
base.data.materials.append(M['sheet'])
bevel(base, 1.5, 2)
tag(base, 'Base', 'Base tray', 'Zinc-plated steel tray; mounts deck posts, PSU and air handler. Ground bond point.', (0, 0, -260), '1.5 mm SECC')
for i, (fx, fy) in enumerate([(-200, -210), (200, -210), (-200, 215), (200, 215)]):
    f = lathe(f'Foot_{i}', [(0, 0), (13, 0), (14, 1), (14, 3.5), (12, 4.5), (0, 4.5)], C['Base'], M['rubber'], 40, (fx, fy, 0))
    tag(f, 'Base', 'Anti-vibration foot', 'Silicone foot, Shore 40A — damps bench vibration during imaging.', (0, 0, -300))
BX_ = W - WALL - 3.5 - BOSS_STANDOFF
for i, (fx, fy) in enumerate([(-BX_, -150), (-BX_, 175), (BX_, -150), (BX_, 175), (-70, RB_Y), (70, RB_Y)]):
    sc_ = join([cyl(f'Fastener_{i}', 1.75, 16, (fx, fy, 12), C['Base'], M['steel'], verts=16),
                cyl(f'Fastener_{i}_head', 3.4, 2.2, (fx, fy, 2.9), C['Base'], M['steel'], verts=24)], f'Fastener_{i}')
    tag(sc_, 'Base', 'Thread-forming screw', 'M3.5 × 16 thread-forming screw (PT-style) from under the base into a moulded boss; '
        'heads sit on the underside, never on an A-surface. Confirm pilot and boss OD with the screw maker.', (0, 0, -380), 'M3.5 × 16 PT, pilot Ø2.9')
deck = extrude_xy('Deck_plate', rrect(462, 350, 10, 0, 68), 126, 128, C['Base'])
boolean(deck, cyl('cut', 14, 10, (0, 52, 127)))
boolean(deck, box('cut', (230, 120, 10), (0, 175, 127)))
deck.data.materials.append(M['sheet'])
bevel(deck, 0.6, 1)
tag(deck, 'Base', 'Internal deck', 'Structural deck separating the dry electronics bay from the conditioned chamber.', (0, 0, -40))
for i, (px, py) in enumerate([(-220, -95), (220, -95), (-220, 235), (220, 235)]):
    p = box(f'Deck_post_{i}', (12, 12, 114), (px, py, 69), C['Base'], M['sheet'], bev=0.8)
    tag(p, 'Base', 'Deck post', 'Folded steel standoff.', (0, 0, -150))

# ======================================================================= CONSOLE (front graphite)
fp = fillet_polygon(P, P_R, seg=12)
band = [p for p in fp if p[0] < -100 and 12 <= p[1] <= 198.5]
band = sorted(band, key=lambda p: -p[1])
band = [(-119.99, 198.5)] + band + [(band[-1][0], 12)] if band[-1][1] > 12 else [(-119.99, 198.5)] + band
con_poly = thick_polyline(band, WALL)
console = extrude_yz('Console', con_poly, -(D_HALF - REVEAL), D_HALF - REVEAL, C['Console'])
# openings: screen recess and printer door on the slope
SL_A, SL_B = Vector((-120, 196)), Vector((-248, 56))
SL_D = (SL_B - SL_A).normalized()
SL_N = Vector((-SL_D.y, SL_D.x))  # outward normal (towards front/up)
if SL_N.y < 0:
    SL_N = -SL_N
SL_ANG = math.atan2(SL_D.y, SL_D.x)
slope_rot = math.degrees(math.atan2(SL_N.y, SL_N.x))


def on_slope(t, h=0.0):
    """point at distance t (mm) down the slope from the top junction, h above the surface"""
    p = SL_A + SL_D * t + SL_N * h
    return p.y if False else (p.x, p.y)


def slope_box(name, size, x, t, h, coll_, mat_, bev_=0.0):
    """box whose local XY lies on the slope (Z = slope normal)."""
    y, z = on_slope(t, h)
    ob = box(name, size, (x, y, z), coll_, mat_, bev=bev_)
    ob.rotation_euler = (math.atan2(-SL_N.x, SL_N.y), 0, 0)
    return ob


# normal vector in (y,z) = SL_N ; rotation about X that maps +Z to (0, n.y, n.z)
NRX = math.atan2(-SL_N.x, SL_N.y)
SCREEN_T = 96  # distance along slope for screen centre (kept off the R56 knee)
SCREEN_X, PRINTER_X = 88, -130  # re-centred for the 430 mm console between the shoulders
screen_cut = box('cut', (238, 158, 30), (0, 0, 0), bev=0)
screen_cut.data.transform(Matrix.Translation((0, 0, 0)))
y, z = on_slope(SCREEN_T, 0)
screen_cut.location = (SCREEN_X * MM, y * MM, z * MM)
screen_cut.rotation_euler = (NRX, 0, 0)
bevel(screen_cut, 6, 4, angle=80, harden=False)
apply_mods(screen_cut)
boolean(console, screen_cut)
y, z = on_slope(SCREEN_T, 0)
pr_cut = box('cut', (150, 150, 30), (0, 0, 0))
pr_cut.location = (PRINTER_X * MM, y * MM, z * MM)
pr_cut.rotation_euler = (NRX, 0, 0)
bevel(pr_cut, 8, 4, angle=80, harden=False); apply_mods(pr_cut)
boolean(console, pr_cut)
scoop = lathe('cut', [(0, -94), (4.5, -92.8), (7.8, -89.5), (9, -85), (9, 85), (7.8, 89.5), (4.5, 92.8), (0, 94)], None, None, 48,
             (0, -126, 199.5), rot=(0, 90, 0))
boolean(console, scoop)  # touch point: a scoop reads "pry / lift here"; fingers hook the door's under-rail lip
console.data.materials.append(M['graphite'])
bevel(console, R_BREAK, 2, angle=40)
tag(console, 'Console', 'Front console', 'Graphite PC console angled at 47.5° so the screen and label printer face the operator at the bench.',
    (0, -300, -30), 'PC/ABS, 3.0 mm wall, MT-11020 · Graphite #141518')

# status light pipe along console top
lp = box('Status_lightpipe', (180, 2.2, 2.2), (0, -247.9, 24), C['Console'], M['blue_glow'], bev=0.5)
tag(lp, 'Console', 'Status light pipe', 'Run-state line along the foot of the console, readable across the lab and kept out of the finger scoop.', (0, -300, -30))

# ----------------------------------------------------------------- touchscreen module
y, z = on_slope(SCREEN_T, -1.2)
scr_glass = box('Screen_coverglass', (234, 154, 1.8), (SCREEN_X, y, z), C['Console'], M['screen_off'], bev=0.6)
scr_glass.rotation_euler = (NRX, 0, 0)
tag(scr_glass, 'Console', '10.1" touchscreen', 'Optically-bonded 10.1" 1280×800 IPS with glove-mode capacitive touch and a chemically-strengthened cover glass.',
    (0, -420, 60), '10.1" 1280×800, PCAP')
y, z = on_slope(SCREEN_T, -0.2)
scr_active = box('Screen_display', (217, 136, 0.4), (SCREEN_X, y, z), C['Console'], M['screen_off'])
scr_active.rotation_euler = (NRX, 0, 0)
scr_active.location = Vector(scr_active.location) + Vector((0, SL_N.x, SL_N.y)) * 0.0
tag(scr_active, 'Console', 'Display surface', 'Active area', (0, -420, 60))
y, z = on_slope(SCREEN_T, -7.5)
lcd = box('Screen_LCD_module', (228, 148, 5.5), (SCREEN_X, y, z), C['Console'], M['alu'], bev=0.8)
lcd.rotation_euler = (NRX, 0, 0)
tag(lcd, 'Console', 'LCD module', 'Backlit IPS panel in steel frame.', (0, -370, 45))
y, z = on_slope(SCREEN_T, -12.5)
tcon = box('Screen_driver_board', (140, 70, 1.6), (SCREEN_X, y, z), C['Console'], M['pcb'], bev=0.3)
tcon.rotation_euler = (NRX, 0, 0)
tag(tcon, 'Console', 'Display driver board', 'eDP/MIPI bridge + touch controller, FFC to compute module.', (0, -330, 30))

# UI image plane on display (emissive) — texture swapped by render.py when available
ui_img_path = os.path.join(TEX, 'screen_ui.png')
if not os.path.exists(ui_img_path):
    arr = np.zeros((800, 1280, 4), np.float32); arr[..., :3] = (0.06, 0.065, 0.08); arr[..., 3] = 1
    arr[60:130, 60:700, :3] = (0.23, 0.27, 1.0)
    pc_textures.save_png(ui_img_path, arr)
m_ui = bpy.data.materials.new('Screen UI')
m_ui.use_nodes = True
nt = m_ui.node_tree
bsdf = nt.nodes['Principled BSDF']
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(ui_img_path); tex.name = 'UI'
bsdf.inputs['Base Color'].default_value = (0, 0, 0, 1)
bsdf.inputs['Roughness'].default_value = 0.08
bsdf.inputs['Coat Weight'].default_value = 0.35
bsdf.inputs['Coat Roughness'].default_value = 0.08
nt.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
bsdf.inputs['Emission Strength'].default_value = 2.4
scr_active.data.materials.clear(); scr_active.data.materials.append(m_ui)
# UVs for the display plane: planar map on local XY
me = scr_active.data
uv = me.uv_layers.new(name='UVMap')
for poly in me.polygons:
    for li in poly.loop_indices:
        v = me.vertices[me.loops[li].vertex_index].co
        uv.data[li].uv = (v.x / (217 * MM) + 0.5, v.y / (136 * MM) + 0.5)

# ======================================================================= PRINTER
y, z = on_slope(SCREEN_T, -1.0)
pdoor = box('Printer_door', (146, 146, 3), (PRINTER_X, y, z), C['Printer'], M['graphite_matte'], bev=1.0)
pdoor.rotation_euler = (NRX, 0, 0)
dy, dz = on_slope(SCREEN_T + 50, 0.5 + 31.5)
dimple = lathe('cut', [(0, -32.5)] + [(32.5 * math.sin(math.radians(a)), -32.5 * math.cos(math.radians(a))) for a in range(6, 180, 6)] + [(0, 32.5)],
               None, None, 64, (PRINTER_X, dy, dz))
boolean(pdoor, dimple)
bevel(pdoor, R_BREAK, 2)
tag(pdoor, 'Printer', 'Printer door', 'Push-to-open door with a concave Ø16 mm press dimple; label roll drops in, no threading.', (0, -360, 0),
    'PC/ABS, MT-11020')
# exit slot
y2, z2 = on_slope(SCREEN_T - 52, 0.0)
slot = box('Printer_exit_slot', (68, 4, 1.4), (PRINTER_X, y2, z2), C['Printer'], M['chip'], bev=0.6)
slot.rotation_euler = (NRX, 0, 0)
tag(slot, 'Printer', 'Label exit + tear bar', 'Serrated tear bar; labels presented at the operator.', (0, -380, 0))
# mechanism behind — authored in a slope-local frame (X across, Y up-slope, Z out of the slope)
pr_frame = bpy.data.objects.new('Printer_frame', None)
C['Printer'].objects.link(pr_frame)
y, z = on_slope(SCREEN_T, -46)
pr_frame.location = Vector((PRINTER_X, y, z)) * MM
pr_frame.rotation_euler = (NRX, 0, 0)
pch = box('Printer_chassis', (92, 84, 64), (0, 0, 0), C['Printer'], M['sheet'], bev=0.8)
boolean(pch, box('cut', (86, 90, 64), (0, 0, 5)))
tag(pch, 'Printer', 'Printer chassis', 'Folded steel chassis carrying a direct-thermal line printer mechanism.', (-40, -250, 40), '58 mm media, 203 dpi')
roll = lathe('Label_roll', [(12.7, -30), (29, -30), (29, 30), (12.7, 30)], C['Printer'], M['label'], 64, (0, -6, 2), rot=(0, 90, 0))
tag(roll, 'Printer', 'Label roll', 'Chemical-resistant synthetic labels sized for 90 mm dish side-walls. Drop-in loading.', (-120, -300, 90))
core = lathe('Label_core', [(11, -31), (12.8, -31), (12.8, 31), (11, 31)], C['Printer'], M['shell_inner'], 48, (0, -6, 2), rot=(0, 90, 0))
tag(core, 'Printer', 'Label roll', '', (-120, -300, 90))
platen = cyl('Platen_roller', 6, 72, (0, 30, 26), C['Printer'], M['rubber'], axis='X')
tag(platen, 'Printer', 'Platen roller', 'Silicone platen, stepper-driven.', (-40, -330, 70))
head = box('Thermal_head', (74, 14, 6), (0, 30, 16), C['Printer'], M['ceramic'], bev=0.6)
tag(head, 'Printer', 'Thermal print head', 'Direct-thermal line head.', (-40, -310, 60))
pmot = cyl('Printer_motor', 12, 26, (58, 24, 10), C['Printer'], M['alu'], axis='X', bev=0.6)
tag(pmot, 'Printer', 'Feed motor', 'PM stepper for label feed.', (20, -250, 40))
for o in (pch, roll, core, platen, head, pmot):
    o.parent = pr_frame

# ======================================================================= DOOR
DOOR = coll('Door', DEV)
pivot = bpy.data.objects.new('Door_pivot', None)
pivot.empty_display_size = 0.05
pivot.location = Vector((0, 58 - GAP_DOOR / 2, 396)) * MM
DOOR.objects.link(pivot)
arc = [(-94 + 26 * math.cos(math.radians(a)), 374 + 26 * math.sin(math.radians(a))) for a in range(90, 181, 6)]
dpath = [(58 - GAP_DOOR, 400)] + arc + [(-120, 198.5 + GAP_DOOR)]
door_poly = thick_polyline(dpath, 4.0)
DW = D_HALF - GAP_DOOR  # door half-width
frame = extrude_yz('Door_frame', door_poly, -DW, DW, DOOR)
# side caps to close the L
fw = extrude_xy('cut', rrect(2 * (DW - 24.5), 146, 10, 0, 294), 90, 140)
fw.rotation_euler = (math.radians(90), 0, 0); apply_mods(fw)
fw.data.transform(Matrix.Rotation(math.radians(90), 4, 'X')); fw.rotation_euler = (0, 0, 0)
boolean(frame, fw)
tw = extrude_xy('cut', rrect(2 * (DW - 24.5), 124, 10, 0, -30), 380, 420)
boolean(frame, tw)
frame.data.materials.append(M['graphite'])
bevel(frame, R_BREAK, 3, angle=40)
tag(frame, 'Door', 'Gull-wing door frame', 'Graphite PC frame on damped torque hinges — opens up and back so both hands stay free for dishes.',
    (0, -80, 560))
g1 = box('Door_glass_front', (2 * (DW - 21.5), 5, 152), (0, -113.5, 294), DOOR, M['glass_tint'], bev=1.0)
tag(g1, 'Door', 'Heated front glazing', 'Double-glazed with a heated inner pane so condensation does not obscure the view of the dishes.',
    (0, -170, 560))
g2 = box('Door_glass_top', (2 * (DW - 21.5), 130, 5), (0, -30, 393.5), DOOR, M['glass_tint'], bev=1.0)
tag(g2, 'Door', 'Heated top glazing', 'Top window gives a clear overhead view of all six dishes.', (0, -80, 640))
for i, sx in enumerate((-1, 1)):
    h1 = cyl(f'Hinge_{i}', 3.8, 34, (sx * (DW - 34.5), 58, 396), DOOR, M['alu_black'], axis='X', bev=0.6)
    tag(h1, 'Door', 'Torque hinge', 'Constant-torque friction hinge, holds the door at any angle.', (sx * 20, 40, 500))
grip = box('Door_grip', (170, 7, 2.0), (0, -121.5, 199.4), DOOR, M['graphite_matte'], bev=0.6)
tag(grip, 'Door', 'Finger pull', 'Lip under the door rail that fingers hook from the console scoop; works with gloved hands.', (0, -80, 560))
logo_bg = box('Logo_badge', (64, 1.2, 14), (0, -120.6, 211), DOOR, M['blue'], bev=0.4)
tag(logo_bg, 'Door', 'Brand badge', '', (0, -80, 560))
lt = text('Logo_text', 'PetriCor', 9.6, (0, -121.3, 211), (90, 0, 0), DOOR, mat('Logo white', '#ffffff', 0.4), FONT, 0.12)
tag(lt, 'Door', 'Brand badge', '', (0, -80, 560))
mag = box('Door_magnet', (10, 4, 6), (DW - 54.5, -116, 205), DOOR, M['alu'], bev=0.5)
tag(mag, 'Door', 'Interlock magnet', 'Pairs with a Hall sensor; UV-C and carousel motion stop when the door opens.', (0, -80, 560))
bpy.context.view_layer.update()
for o in list(DOOR.objects):
    if o is not pivot:
        parent_keep(o, pivot)

# ======================================================================= CHAMBER
liner = box('Liner_outer', (394.4, 324.4, 238.4), (0, 53, 268), C['Chamber'], bev=0)
bevel(liner, 11, 6, angle=60, harden=False); apply_mods(liner)
lin_in = box('cut', (392, 322, 236), (0, 53, 268)); bevel(lin_in, 10, 6, angle=60, harden=False); apply_mods(lin_in)
boolean(liner, lin_in)
boolean(liner, box('cut', (380, 220, 200), (0, -70, 306)))
liner.name = 'Chamber_liner'
liner.data.materials.append(M['steel'])
smooth(liner)
tag(liner, 'Chamber', 'Chamber liner', 'Electropolished 316L stainless with 10 mm coved corners and no internal fasteners, for straightforward wipe-down.',
    (0, 0, 70), '316L stainless')
# rear air baffle with perforations
baf = box('Air_baffle', (300, 1.2, 190), (0, 204, 272), C['Chamber'], M['steel'])
holes = []
for r_ in range(14):
    for c_ in range(24):
        holes.append(cyl('h', 2.2, 6, (-138 + c_ * 12, 204, 190 + r_ * 12), verts=10, axis='Y'))
boolean(baf, join(holes, 'holes'))
tag(baf, 'Chamber', 'Laminar air baffle', 'Perforated rear plenum that spreads low-velocity airflow across all six dishes.',
    (0, 90, 140))
gasket = tube('Door_gasket', [(-194, -111, 206), (-194, -111, 390), (-194, 40, 390), (194, 40, 390),
                                (194, -111, 390), (194, -111, 206), (-194, -111, 206)], 3.2, C['Chamber'], M['rubber_grey'], 1)
for bp in gasket.data.splines[0].bezier_points:
    bp.handle_left_type = bp.handle_right_type = 'VECTOR'
tag(gasket, 'Chamber', 'Door gasket', 'Food-grade silicone D-profile seal.', (0, -40, 140))

# chamber front trim — hides the insulation between liner and cover at the door opening
tr_top = box('Chamber_trim_top', (2 * D_HALF, 170, 3), (0, -27, 394.5), C['Chamber'])
boolean(tr_top, box('cut', (382, 154, 30), (0, -35, 394)))
tr_front = box('Chamber_trim_front', (2 * D_HALF, 3, 200), (0, -111.5, 298), C['Chamber'])
boolean(tr_front, box('cut', (382, 20, 200), (0, -111, 307)))
trim = join([tr_top, tr_front], 'Chamber_trim')
trim.data.materials.clear(); trim.data.materials.append(M['shell'])
bevel(trim, 0.8, 2)
tag(trim, 'Chamber', 'Chamber trim', 'Moulded trim closing the chamber to the cover; carries the door gasket seat.', (0, 0, 110))
clb = box('Chamber_lightbar', (300, 8, 3), (0, 30, 384.5), C['Chamber'], M['white_glow'], bev=0.8)
tag(clb, 'Chamber', 'Chamber light', 'Dimmable white LED bar for viewing dishes through the door; switched off automatically during imaging.', (0, 0, 140))
# sensors
sht = lathe('THR_probe', [(0, 0), (5, 0), (5, 18), (4.2, 19), (4.2, 26), (0, 26)], C['Chamber'], M['alu'], 32,
            (-196, 110, 320), rot=(0, 90, 0))
tag(sht, 'Chamber', 'Temp / RH probe', 'Digital temperature and humidity sensor behind a PTFE membrane, with an independent over-temperature sensor.',
    (-120, 0, 120))
sht_cap = lathe('THR_probe_filter', [(0, 0), (4.3, 0), (4.3, 7), (0, 7)], C['Chamber'], M['hepa'], 32,
                (-196 + 26, 110, 320), rot=(0, 90, 0))
tag(sht_cap, 'Chamber', 'PTFE filter cap', '', (-120, 0, 120))
uv = box('UVC_bar', (200, 14, 4), (0, 60, 384), C['Chamber'], M['alu_black'], bev=0.8)
tag(uv, 'Chamber', 'UV-C decontamination bar', 'UV-C LED bar runs a surface decontamination cycle between experiments; door-interlocked.',
    (0, 0, 240), '275 nm LEDs')
for i in range(8):
    led = box(f'UVC_led_{i}', (5, 5, 1.2), (-84 + i * 24, 60, 381.6), C['Chamber'], M['uvc_glow'])
    tag(led, 'Chamber', 'UV-C decontamination bar', '', (0, 0, 240))

# insulation: moulded EPP (expanded polypropylene) bead foam, not cut PIR board — a moulded part can follow the R44 roll and
# the R72 shoulder, so the thickened side walls are filled right into the corners. Dimpled on the outboard face only
# (the smooth face seats flat on the liner): the dimples trap still air against the cover, act as crush points that take up
# cover tolerance, and cut mass ~15 %. Ø10 × 2.5 mm hemispherical dimples on a 13 mm hex pitch, moulded by the EPP tool.
INS_GAP = WALL + LIP_T + 0.5          # clear of the cover wall and the step lip under the reveal
DIMPLE_D, DIMPLE_DEPTH, DIMPLE_PITCH = 10.0, 2.5, 13.0


def conform(ob):
    """Trim a foam blank to the inside of the cover (the skin inset by INS_GAP), so it follows the rolls."""
    boolean(ob, envelope('cut', INS_GAP, W - INS_GAP), op='INTERSECT')
    return ob


def dimples(ob, axis, face, u_rng, v_rng, keep=lambda u, v: True):
    """Hex array of spherical dimples cut into the plane `axis`=face (sign of `face` = outward)."""
    r = (DIMPLE_D ** 2 / 4 + DIMPLE_DEPTH ** 2) / (2 * DIMPLE_DEPTH)
    c = face + math.copysign(r - DIMPLE_DEPTH, face if axis != 'z' else -1)
    bm = bmesh.new()
    row = 0
    v = v_rng[0]
    while v <= v_rng[1]:
        u = u_rng[0] + (DIMPLE_PITCH / 2 if row % 2 else 0)
        while u <= u_rng[1]:
            if keep(u, v):
                loc = {'x': (c, u, v), 'y': (u, c, v), 'z': (u, v, c)}[axis]
                bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=7, radius=r * MM,
                                          matrix=Matrix.Translation(Vector(loc) * MM))
            u += DIMPLE_PITCH
        v += DIMPLE_PITCH * math.sqrt(3) / 2
        row += 1
    me = bpy.data.meshes.new('dimples'); bm.to_mesh(me); bm.free()
    cutter = bpy.data.objects.new('dimples', me); bpy.context.scene.collection.objects.link(cutter)
    boolean(ob, cutter)
    return ob


FOAM_SPEC = 'EPP 45 g/L moulded bead foam, dimpled outer face (Ø10 × 2.5 on 13 hex)'
FOAM_DESC = ('Moulded EPP bead foam that follows the rounded shell, so the thickened side walls are insulated right into the '
             'corners. The outboard face is dimpled: the dimples hold a still-air layer against the cover and act as crush '
             'points that take up cover tolerance. The smooth face seats on the liner.')
SIDE_IN = 199                          # liner outer face + 1.8 mm
for sx in (-1, 1):
    p = box(f'Insul_side_{"L" if sx < 0 else "R"}', (W - SIDE_IN, 324, 242), (sx * (W + SIDE_IN) / 2, 54, 269), C['Chamber'])
    conform(p)
    face = W - INS_GAP
    # dimple only the flat of the side: stay off the top roll (z < 400 − R_ROLL) and the back shoulder
    dimples(p, 'x', sx * face, (-100, 198), (156, 400 - R_ROLL - 6),
            keep=lambda u, v: not (u > 178 and v > 328 and math.hypot(u - 178, v - 328) > 22))
    p.data.materials.append(M['foam']); smooth(p, False)
    tag(p, 'Chamber', 'Insulation panel', FOAM_DESC, (sx * 110, 0, 60), FOAM_SPEC)
pb = box('Insul_back', (2 * W, 26, 205), (0, 230, 246), C['Chamber'])
conform(pb)
dimples(pb, 'y', 243, (-(SPLIT_X - 8), SPLIT_X - 8), (152, 340))
pb.data.materials.append(M['foam']); smooth(pb, False)
tag(pb, 'Chamber', 'Insulation panel', '', (0, 110, 60), FOAM_SPEC)
pt = box('Insul_top', (440, 150, 3.5), (0, 122, 389.75), C['Chamber'], M['aerogel'], bev=0.8)
tag(pt, 'Chamber', 'Insulation blanket', 'Only 3.5 mm between the liner and the saddle ribs — too thin to mould in EPP, so the top '
    'uses a silica-aerogel blanket bonded to the liner.', (0, 0, 380), '3.5 mm silica aerogel blanket, PET-faced')
pbot = box('Insul_floor', (2 * W, 320, 18), (0, 70, 139), C['Chamber'])
conform(pbot)
boolean(pbot, cyl('cut', 14, 40, (0, 52, 139)))
boolean(pbot, box('cut', (230, 64, 40), (0, 200, 139)))
dimples(pbot, 'z', 130, (-(SPLIT_X + 30), SPLIT_X + 30), (-80, 150), keep=lambda u, v: not (abs(u) < 125 and v > 158) and math.hypot(u, v - 52) > 22)
pbot.data.materials.append(M['foam']); smooth(pbot, False)
tag(pbot, 'Chamber', 'Insulation panel', '', (0, 0, 20), FOAM_SPEC)

# ======================================================================= CAROUSEL
CX, CY = 0, 52
RING = 102
plate = cyl('Carousel_plate', 155, 4, (CX, CY, 168), C['Carousel'], M['alu_anod'], verts=160)
cuts = []
for k in range(6):
    a = math.radians(90 + 60 * k)
    px, py = CX + RING * math.cos(a), CY + RING * math.sin(a)
    cuts.append(cyl('c', 38, 10, (px, py, 168), verts=72))
    cuts.append(cyl('c', 46.2, 2, (px, py, 170.0), verts=96))
    cuts.append(box('c', (14, 8, 3), (px + 46 * math.cos(a), py + 46 * math.sin(a), 170), rot=(0, 0, math.degrees(a))))
for k in range(6):  # lightening windows between pockets
    a = math.radians(120 + 60 * k)
    cuts.append(cyl('c', 9, 10, (CX + 128 * math.cos(a), CY + 128 * math.sin(a), 168), verts=32))
boolean(plate, join(cuts, 'pockets'))
bevel(plate, 0.6, 2, angle=40)
tag(plate, 'Carousel', 'Six-position carousel', 'Anodised aluminium turntable indexes each dish under the imaging head. Lifts out tool-free for cleaning.',
    (0, 0, 190), 'Ø310 mm, 6 × 90 mm dishes')
for k in range(6):
    a = math.radians(90 + 60 * k)
    px, py = CX + 138 * math.cos(a + math.radians(22)), CY + 138 * math.sin(a + math.radians(22))
    t_ = text(f'Pos_{k+1}', str(k + 1), 9, (px, py, 170.05), (0, 0, math.degrees(a) - 90), C['Carousel'], M['graphite'], FONT, 0.0)
    tag(t_, 'Carousel', 'Position index', 'Laser-etched position numbers match the on-screen map.', (0, 0, 190))
hub = lathe('Carousel_knob', [(0, 170), (22, 170), (22, 172), (18, 180), (16, 186), (12, 188), (0, 188)], C['Carousel'], M['graphite_matte'],
            64, (CX, CY, 0))
kn = []
for k in range(30):
    g_ = box(f'kn{k}', (1.4, 6, 8.5), (0, 0, 0))
    g_.data.transform(Matrix.Translation((0, 21.5 * MM, 0)))
    g_.data.transform(Matrix.Rotation(2 * math.pi * k / 30, 4, 'Z'))
    g_.location = (CX * MM, CY * MM, 176.5 * MM)
    kn.append(g_)
boolean(hub, join(kn, 'knurl'))
tag(hub, 'Carousel', 'Quick-release knob', 'Knurled quarter-turn knob (30 flutes = "rotate") releases the carousel from the drive hub.', (0, 0, 260))
shaft = cyl('Drive_shaft', 4, 78, (CX, CY, 129), C['Carousel'], M['steel'], verts=24)
tag(shaft, 'Carousel', 'Drive shaft', 'Ground stainless shaft through a sealed bearing.', (0, 0, 30))
brg = lathe('Shaft_seal_housing', [(4.2, 146), (16, 146), (16, 150), (12, 154), (4.2, 154)], C['Carousel'], M['alu'], 48, (CX, CY, 0))
tag(brg, 'Carousel', 'Sealed bearing', 'Lip-sealed bearing keeps humid chamber air out of the drive bay.', (0, 0, 40))
bigp = lathe('Drive_pulley', [(4, 104), (30, 104), (30.5, 106), (30.5, 114), (30, 116), (4, 116)], C['Carousel'], M['alu_black'], 96, (CX, CY, 0))
tag(bigp, 'Carousel', 'Drive pulley', 'GT2 60T pulley driven from a 16T motor pulley (1:3.75).', (0, 0, -20))
MX, MY = CX + 78, CY - 10
mot = box('Stepper_motor', (42.3, 42.3, 40), (MX, MY, 78), C['Carousel'], M['chip'], bev=3)
tag(mot, 'Carousel', 'Carousel stepper', 'NEMA 17 closed-loop stepper with magnetic encoder — detects a jammed dish and stops.', (60, 0, -60),
    'NEMA17, 0.9°, encoder')
for zz in (58.5, 97.5):
    cap = box(f'Stepper_cap_{int(zz)}', (42.3, 42.3, 1.2), (MX, MY, zz), C['Carousel'], M['alu'], bev=2.5)
    tag(cap, 'Carousel', 'Carousel stepper', '', (60, 0, -60))
smp = lathe('Motor_pulley', [(2.5, 104), (8, 104), (8.4, 106), (8.4, 114), (8, 116), (2.5, 116)], C['Carousel'], M['alu_black'], 40, (MX, MY, 0))
tag(smp, 'Carousel', 'Motor pulley', 'GT2 16T', (60, 0, -30))
ms = cyl('Motor_shaft', 2.5, 20, (MX, MY, 108), C['Carousel'], M['steel'], verts=16)
tag(ms, 'Carousel', 'Motor pulley', '', (60, 0, -30))


def belt(name, c1, r1, c2, r2, z0, z1, t=1.4):
    def loop(ra, rb):
        c1v, c2v = Vector(c1), Vector(c2)
        d = c2v - c1v; L = d.length; u = d.normalized()
        ang = math.acos((ra - rb) / L)
        base_a = math.atan2(u.y, u.x)
        pts = []
        for i in range(49):
            a = base_a + ang + (2 * math.pi - 2 * ang) * i / 48
            pts.append((c1v.x + ra * math.cos(a), c1v.y + ra * math.sin(a)))
        for i in range(25):
            a = base_a - ang + (2 * ang) * i / 24
            pts.append((c2v.x + rb * math.cos(a), c2v.y + rb * math.sin(a)))
        return pts
    outer = extrude_xy(name, loop(r1 + t, r2 + t), z0, z1, C['Carousel'])
    boolean(outer, extrude_xy('cut', loop(r1, r2), z0 - 1, z1 + 1))
    return outer


bl = belt('Drive_belt', (CX, CY), 30.6, (MX, MY), 8.5, 106.5, 113.5)
bl.data.materials.append(M['rubber'])
tag(bl, 'Carousel', 'GT2 belt', 'Glass-fibre reinforced timing belt.', (30, 0, -20))
opto = box('Home_sensor', (14, 10, 12), (CX - 40, CY, 109), C['Carousel'], M['chip'], bev=0.8)
tag(opto, 'Carousel', 'Home sensor', 'Slotted optical switch homes the carousel on every start.', (-40, 0, -20))
mbr = box('Motor_bracket', (60, 60, 2), (MX, MY, 100.6), C['Carousel'], M['sheet'], bev=0.5)
tag(mbr, 'Carousel', 'Motor bracket', '', (60, 0, -40))

# transillumination panel under the imaging station (rear dish)
IMG = (CX, CY + RING)
bl_pan = box('Backlight_panel', (100, 100, 5), (IMG[0], IMG[1], 158), C['Imaging'], M['acrylic_frost'], bev=1.2)
tag(bl_pan, 'Imaging', 'Transillumination panel', 'Edge-lit LED panel under the imaging station; back-lighting reveals translucent and early micro-colonies.',
    (0, 60, 150))
bl_led = box('Backlight_emitter', (96, 96, 0.5), (IMG[0], IMG[1], 155.2), C['Imaging'], M['white_glow'])
tag(bl_led, 'Imaging', 'Transillumination panel', '', (0, 60, 150))

# ======================================================================= IMAGING HEAD
IH = Vector((IMG[0], IMG[1], 356))
ih = box('Imaging_head_housing', (118, 96, 56), tuple(IH), C['Imaging'], M['shell'], bev=6)
boolean(ih, cyl('cut', 40, 20, tuple(IH + Vector((0, 0, -28))), verts=96))
tag(ih, 'Imaging', 'Imaging head', 'Sealed, heated optical head. Fixed working distance to the dish plane — no autofocus drift between time-points.',
    (0, 0, 330))
win = cyl('Imaging_window', 40.5, 2, tuple(IH + Vector((0, 0, -27))), C['Imaging'], M['glass'], verts=96)
tag(win, 'Imaging', 'Anti-fog window', 'AR-coated window, heated 2 °C above chamber air.', (0, 0, 250))
ring = lathe('Ring_light_pcb', [(18, -1), (37, -1), (37, 0.6), (18, 0.6)], C['Imaging'], M['pcb_black'], 96,
             tuple(IH + Vector((0, 0, -20))))
tag(ring, 'Imaging', 'Multispectral ring light', '24 LEDs in four channels (white, 365 nm UV, 470 nm, 850 nm IR) for pigment, fluorescence and texture contrast.',
    (0, 0, 290))
for k in range(24):
    a = 2 * math.pi * k / 24
    chan = [M['white_glow'], M['uvc_glow'], M['blue_glow'], M['chip']][k % 4]
    led = box(f'Ring_led_{k}', (3.5, 3.5, 1.4), tuple(IH + Vector((27.5 * math.cos(a), 27.5 * math.sin(a), -21.5))), C['Imaging'], chan)
    led.rotation_euler = (0, 0, a)
    tag(led, 'Imaging', 'Multispectral ring light', '', (0, 0, 290))
dif = lathe('Ring_diffuser', [(17, -8), (38, -8), (38, -6), (17, -6)], C['Imaging'], M['acrylic_frost'], 96, tuple(IH + Vector((0, 0, -18))))
tag(dif, 'Imaging', 'Cross-polarised diffuser', 'Diffuser with linear polariser; paired with a lens polariser to kill agar glare.', (0, 0, 270))
lens = lathe('Lens_barrel', [(0, -18), (7, -18), (7.5, -16), (8, -14)] + [(8.5 if i % 2 else 9.2, -12 + i * 1.5) for i in range(12)] +
             [(12, 7), (12, 12), (0, 12)], C['Imaging'], M['alu_black'], 64, tuple(IH + Vector((0, 0, -6))))
tag(lens, 'Imaging', 'Fixed-focal lens', 'Low-distortion lens stopped down for full-dish depth of field.', (0, 0, 350))
le = cyl('Lens_element', 6.2, 1.5, tuple(IH + Vector((0, 0, -23.6))), C['Imaging'], M['lens'], verts=48)
tag(le, 'Imaging', 'Fixed-focal lens', '', (0, 0, 350))
cam = box('Camera_board', (38, 38, 1.6), tuple(IH + Vector((0, 0, 8))), C['Imaging'], M['pcb'], bev=0.3)
tag(cam, 'Imaging', 'Image sensor board', '12 MP colour sensor; about 25 µm per pixel across a 100 mm field of view.', (0, 0, 400),
    '12 MP, 4056×3040')
sens = box('Image_sensor', (12, 12, 1.4), tuple(IH + Vector((0, 0, 6.6))), C['Imaging'], M['chip'])
tag(sens, 'Imaging', 'Image sensor board', '', (0, 0, 400))
ffc = box('Camera_FFC', (16, 50, 0.3), tuple(IH + Vector((0, 45, 12))), C['Imaging'], M['ribbon'])  # shortened to clear the R72 shoulder
tag(ffc, 'Imaging', 'Camera ribbon', 'MIPI CSI-2 flat flex to compute module.', (0, 60, 400))
hs = box('Imaging_heater', (60, 50, 1), tuple(IH + Vector((0, -10, 24))), C['Imaging'], M['copper'])
tag(hs, 'Imaging', 'Head heater', 'Polyimide heater keeps optics above dew point.', (0, 0, 430))

# ======================================================================= DISHES
dish_mats = []
for k, colonies in enumerate(pc_textures.PLATES):
    rgba, h = pc_textures.plate(colonies, 1024, seed=11 + k)
    cpath = os.path.join(TEX, f'plate_{k+1}_color.png')
    hpath = os.path.join(TEX, f'plate_{k+1}_height.png')
    pc_textures.save_png(cpath, rgba)
    hh = np.dstack([h, h, h, np.ones_like(h)])
    pc_textures.save_png(hpath, hh)
    dish_mats.append((cpath, hpath))


def barcode_png(path, seed):
    rng = np.random.default_rng(seed)
    w, hgt = 900, 260
    a = np.ones((hgt, w, 4), np.float32)
    x = 40
    while x < w - 60:
        bw = rng.integers(2, 9)
        if rng.random() > 0.45:
            a[30:200, x:x + bw, :3] = 0.05
        x += bw + rng.integers(2, 7)
    a[215:245, 40:500, :3] = 0.35
    pc_textures.save_png(path, a)


for k in range(6):
    a = math.radians(90 + 60 * k)
    px, py = CX + RING * math.cos(a), CY + RING * math.sin(a)
    z0 = 170.0 - 2.0 + 2.0  # seated in 2 mm counterbore -> base bottom at 168+2
    zb = 169.0
    dbase = lathe(f'Dish_{k+1}_base', [(0, 0), (43.5, 0), (44.6, 0.6), (45, 1.4), (45, 14.2), (44, 14.2), (44, 1.2), (0, 1.2)],
                  C['Dishes'], M['ps_clear'], 96, (px, py, zb))
    tag(dbase, 'Dishes', f'Dish {k+1}', 'Standard 90 mm polystyrene Petri dish. Seats in a counterbored pocket that locates it under the camera.',
        (0, 0, 300))
    dlid = lathe(f'Dish_{k+1}_lid', [(0, 13.2), (46.8, 13.2), (47.3, 13.8), (47.3, 22.2), (46.3, 22.2), (46.3, 14.2), (0, 14.2)],
                 C['Dishes'], M['ps_clear'], 96, (px, py, zb + 0.8))
    tag(dlid, 'Dishes', f'Dish {k+1} lid', '', (0, 0, 380))
    # agar with displaced top
    bm = bmesh.new()
    bm.loops.layers.uv.new('UVMap')
    bmesh.ops.create_grid(bm, x_segments=180, y_segments=180, size=44 * MM, calc_uvs=True)
    for v in list(bm.verts):
        if v.co.length > 43.8 * MM:
            bm.verts.remove(v)
    me = bpy.data.meshes.new(f'Agar_{k+1}')
    bm.to_mesh(me); bm.free()
    agar = bpy.data.objects.new(f'Dish_{k+1}_agar', me)
    C['Dishes'].objects.link(agar)
    agar.location = (px * MM, py * MM, (zb + 5.8) * MM)
    agar.rotation_euler = (0, 0, a)
    cpath, hpath = dish_mats[k]
    himg = bpy.data.images.load(hpath); himg.colorspace_settings.name = 'Non-Color'
    tx = bpy.data.textures.new(f'H{k}', 'IMAGE'); tx.image = himg; tx.extension = 'CLIP'
    dm = agar.modifiers.new('Displace', 'DISPLACE'); dm.texture = tx; dm.texture_coords = 'UV'; dm.strength = 2.4 * MM
    dm.mid_level = 0.0
    smooth(agar)
    am = bpy.data.materials.new(f'Agar plate {k+1}')
    am.use_nodes = True
    nt = am.node_tree; b = nt.nodes['Principled BSDF']
    ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = bpy.data.images.load(cpath)
    nt.links.new(ti.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.5
    b.inputs['Coat Weight'].default_value = 0.08
    agar.data.materials.append(am)
    tag(agar, 'Dishes', f'Dish {k+1} culture', 'Synthetic illustration of colony morphology used for rendering — not a photograph.', (0, 0, 300))
    body = lathe(f'Dish_{k+1}_agar_body', [(0, 1.2), (43.9, 1.2), (43.9, 5.5), (0, 5.5)], C['Dishes'],
                 mat('Agar body', '#d9a45a', 0.3, transmission=0.55, sss=0.4, ior=1.34), 72, (px, py, zb))
    tag(body, 'Dishes', f'Dish {k+1} culture', '', (0, 0, 300))
    # barcode label wrapped on dish side wall (outward-facing)
    bpath = os.path.join(TEX, f'label_{k+1}.png')
    if not os.path.exists(bpath):
        barcode_png(bpath, 100 + k)
    bm = bmesh.new()
    segs = 24; span = math.radians(70)
    verts = []
    for i in range(segs + 1):
        th = a - span / 2 + span * i / segs
        for zz in (2.2, 12.6):
            verts.append(bm.verts.new((45.15 * MM * math.cos(th), 45.15 * MM * math.sin(th), zz * MM)))
    uvl = bm.loops.layers.uv.new('UVMap')
    for i in range(segs):
        f = bm.faces.new((verts[2 * i], verts[2 * i + 2], verts[2 * i + 3], verts[2 * i + 1]))
        for lp_, (uu, vv) in zip(f.loops, [(i / segs, 0), ((i + 1) / segs, 0), ((i + 1) / segs, 1), (i / segs, 1)]):
            lp_[uvl].uv = (1 - uu, vv)
    me = bpy.data.meshes.new(f'Label_{k+1}'); bm.to_mesh(me); bm.free()
    lab = bpy.data.objects.new(f'Dish_{k+1}_label', me); C['Dishes'].objects.link(lab)
    lab.location = (px * MM, py * MM, zb * MM)
    lm = bpy.data.materials.new(f'Barcode label {k+1}'); lm.use_nodes = True
    ti = lm.node_tree.nodes.new('ShaderNodeTexImage'); ti.image = bpy.data.images.load(bpath)
    lm.node_tree.links.new(ti.outputs['Color'], lm.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    lm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.5
    lab.data.materials.append(lm)
    smooth(lab)
    sol = lab.modifiers.new('Solidify', 'SOLIDIFY'); sol.thickness = 0.12 * MM
    tag(lab, 'Dishes', f'Dish {k+1} barcode', 'Printed on-device, applied to the dish wall; the side scanner links it to the run.', (0, 0, 300))

# ======================================================================= CLIMATE (under deck)
TE = Vector((-10, 172, 0))
duct = box('Air_handler_duct', (210, 88, 50), (TE.x, TE.y, 100), C['Climate'], M['graphite_matte'], bev=4)
boolean(duct, box('cut', (204, 82, 50), (TE.x, TE.y, 104)))
boolean(duct, box('cut', (84, 44, 10), (TE.x - 20, TE.y, 76)))
tag(duct, 'Climate', 'Air handler', 'Sealed duct: chamber air is pulled through the floor return, conditioned, HEPA-filtered and returned via the rear baffle.',
    (0, 60, -30))
cold = box('Cold_sink_base', (80, 60, 4), (TE.x - 20, TE.y, 82), C['Climate'], M['alu'], bev=0.6)
fins = [box(f'f{i}', (1.2, 58, 26), (TE.x - 58 + i * 4, TE.y, 97)) for i in range(20)]
cold = join([cold] + fins, 'Cold_side_heatsink')
tag(cold, 'Climate', 'Cold-side heat exchanger', 'Inside the sealed duct; the Peltier heat pump can both heat and cool the chamber.',
    (0, 60, 40))
for i, dx in enumerate((-40, 0)):
    tec = box(f'TEC_{i}', (40, 40, 3.8), (TE.x - 20 + dx + 20, TE.y, 78), C['Climate'], M['ceramic'], bev=0.3)
    tag(tec, 'Climate', 'Peltier module', 'Thermoelectric module — solid state, no refrigerant, reversible for heating.', (0, 60, -10),
        '2 × 60 W TEC')
    for j, mt in enumerate((M['wire_red'], M['wire_black'])):
        w_ = tube(f'TEC_{i}_lead_{j}', [(TE.x + dx + 20, TE.y - 20 - j * 4, 78), (TE.x + dx, TE.y - 60 - j * 4, 60),
                                        (-100, -30 + j * 4, 34)], 0.7, C['Wiring'], mt)
        tag(w_, 'Wiring', 'Harness', '', (0, 60, -40))
hot = box('Hot_sink_base', (100, 80, 5), (TE.x - 20, TE.y - 10, 73.5), C['Climate'], M['alu'], bev=0.6)
hf = [box(f'f{i}', (1.4, 78, 44), (TE.x - 68 + i * 4.8, TE.y - 10, 49)) for i in range(21)]
hot = join([hot] + hf, 'Hot_side_heatsink')
tag(hot, 'Climate', 'Hot-side heatsink', 'Extruded aluminium sink exhausting through the rear grille.', (0, 60, -110))
FANX = -2
fan = box('Exhaust_fan_frame', (80, 25, 80), (FANX, 232, 72), C['Climate'], M['chip'], bev=3)
boolean(fan, cyl('cut', 38, 40, (FANX, 232, 72), axis='Y', verts=64))
tag(fan, 'Climate', 'Exhaust fan', '80 mm PWM fan, speed-controlled on hot-side temperature.', (0, 180, -80))
fh = cyl('Exhaust_fan_hub', 14, 20, (FANX, 232, 72), C['Climate'], M['chip'], axis='Y', verts=40)
blades = []
for k in range(7):
    bb = box(f'b{k}', (22, 2, 12), (0, 0, 0))
    bb.data.transform(Matrix.Translation((26 * MM, 0, 0)))
    bb.data.transform(Matrix.Rotation(math.radians(25), 4, 'X'))
    bb.data.transform(Matrix.Rotation(2 * math.pi * k / 7, 4, 'Y'))
    bb.location = (FANX * MM, 232 * MM, 72 * MM)
    blades.append(bb)
fh = join([fh] + blades, 'Exhaust_fan_rotor')
fh.data.materials.clear(); fh.data.materials.append(M['chip'])
tag(fh, 'Climate', 'Exhaust fan', '', (0, 180, -80))
blower = lathe('Recirc_blower', [(0, 76), (26, 76), (27, 80), (27, 120), (0, 120)], C['Climate'], M['chip'], 64, (TE.x + 70, TE.y, 0))
tag(blower, 'Climate', 'Recirculation blower', 'Low-velocity centrifugal blower recirculating chamber air.', (60, 60, -10))
ptc = box('PTC_heater', (24, 60, 10), (TE.x + 30, TE.y, 108), C['Climate'], M['ceramic'], bev=0.8)
tag(ptc, 'Climate', 'PTC safety heater', 'Self-limiting PTC element for warm-up.', (30, 60, 40))
hepa = box('HEPA_cartridge', (30, 76, 44), (TE.x - 88, TE.y, 104), C['Climate'], M['alu'], bev=1)
boolean(hepa, box('cut', (26, 72, 50), (TE.x - 88, TE.y, 104)))
pleats = []
for i in range(14):
    pl = box(f'p{i}', (24, 0.6, 42), (TE.x - 88, TE.y - 34 + i * 5, 104))
    pl.rotation_euler = (0, 0, math.radians(18 if i % 2 else -18)); apply_mods(pl)
    pleats.append(pl)
pl_ = join(pleats, 'HEPA_media'); pl_.data.materials.append(M['hepa']); link(pl_, C['Climate'])
tag(hepa, 'Climate', 'HEPA filter', 'H13 HEPA on the return air to capture airborne spores released by mature colonies.',
    (-60, 60, 60), 'H13')
tag(pl_, 'Climate', 'HEPA filter', '', (-60, 60, 60))

# ======================================================================= HUMIDITY
HX, HY = -168, 178
tank = box('Water_reservoir', (96, 110, 84), (HX, HY, 60), C['Humidity'], M['tank'], bev=6)
tag(tank, 'Humidity', 'Water reservoir', 'Slide-out reservoir behind a rear hatch; float sensor warns before it runs dry.',
    (-60, 240, -20), '600 mL')
hatch = box('Reservoir_hatch', (98, 3, 86), (-168, 248.3, 60), C['Humidity'], M['graphite_matte'], bev=5)
boolean(hatch, box('cut', (30, 10, 6), (-168, 250.5, 94)))
bevel(hatch, 0.6, 2)
tag(hatch, 'Humidity', 'Reservoir hatch', 'Rear hatch — refill without opening the chamber.', (-60, 300, -20))
water = box('Reservoir_water', (88, 102, 50), (HX, HY, 45), C['Humidity'], M['water'], bev=4)
tag(water, 'Humidity', 'Water reservoir', '', (-60, 240, -20))
cap = cyl('Reservoir_cap', 14, 8, (HX, HY - 30, 106), C['Humidity'], M['blue'], bev=1)
tag(cap, 'Humidity', 'Fill cap', '', (-60, 240, 20))
mist = lathe('Ultrasonic_transducer', [(0, 0), (12, 0), (12, 3), (10, 5), (0, 5)], C['Humidity'], M['steel'], 48, (HX, HY + 20, 20))
tag(mist, 'Humidity', 'Ultrasonic atomiser', 'Ultrasonic piezo atomiser — humidifies without a heating element.',
    (-230, 0, -60))
mt_ = tube('Mist_tube', [(HX, HY + 20, 102), (HX + 20, HY + 10, 124), (HX + 60, HY - 20, 140), (HX + 80, HY - 30, 151)], 5, C['Humidity'],
           mat('Silicone tube', '#e9ecef', 0.4, transmission=0.4))
tag(mt_, 'Humidity', 'Mist tube', 'Silicone line into the air handler outlet.', (-160, 0, 20))
lvl = box('Float_sensor', (8, 8, 40), (HX + 36, HY + 40, 60), C['Humidity'], M['chip'], bev=1)
tag(lvl, 'Humidity', 'Level sensor', '', (-60, 240, -20))

# ======================================================================= ELECTRONICS


def pcb(name, size, loc, coll_, mat_=None, chips=12, seed=0, explode=(0, 0, 0), title='', desc='', spec=None):
    rng = random.Random(seed)
    b = box(name, (size[0], size[1], 1.6), loc, coll_, mat_ or M['pcb'], bev=0.3)
    parts = [b]
    for i in range(chips):
        w, d, h = rng.choice([(8, 8, 1.2), (14, 14, 1.4), (5, 3, 1), (20, 12, 2), (4, 4, 0.9), (10, 6, 1.1)])
        x = loc[0] + rng.uniform(-size[0] / 2 + w, size[0] / 2 - w)
        y = loc[1] + rng.uniform(-size[1] / 2 + d, size[1] / 2 - d)
        c = box(f'{name}_ic{i}', (w, d, h), (x, y, loc[2] + 0.8 + h / 2), coll_, M['chip'], bev=0.2)
        parts.append(c)
    for i in range(chips * 2):
        x = loc[0] + rng.uniform(-size[0] / 2 + 3, size[0] / 2 - 3)
        y = loc[1] + rng.uniform(-size[1] / 2 + 3, size[1] / 2 - 3)
        c = box(f'{name}_p{i}', (1.6, 0.8, 0.6), (x, y, loc[2] + 1.1), coll_, M['ceramic'])
        parts.append(c)
    for o in parts:
        tag(o, coll_.name, title or name, desc, explode, spec)
    return b


MB = (100, -60, 24)
pcb('Compute_carrier', (170, 105), MB, C['Electronics'], chips=10, seed=1, explode=(40, -40, -180),
    title='Compute board', desc='Quad-core ARM compute module: UI, camera pipeline, on-device colony detection, encrypted store-and-forward sync.',
    spec='4× A76, 8 GB, 64 GB eMMC, TPM')
cm = box('Compute_module', (55, 40, 4.5), (MB[0] - 20, MB[1], MB[2] + 3.2), C['Electronics'], M['pcb'], bev=0.3)
tag(cm, 'Electronics', 'Compute board', '', (40, -40, -180))
hsk = box('CM_heatsink', (50, 38, 3), (MB[0] - 20, MB[1], MB[2] + 7), C['Electronics'], M['alu_black'], bev=0.3)
hsf = [box(f'hf{i}', (1.2, 38, 10), (MB[0] - 44 + i * 4, MB[1], MB[2] + 13)) for i in range(13)]
hsk = join([hsk] + hsf, 'CM_heatsink'); hsk.data.materials.clear(); hsk.data.materials.append(M['alu_black'])
tag(hsk, 'Electronics', 'Compute board', '', (40, -40, -180))
for i in range(2):
    j = box(f'Compute_conn_{i}', (16, 14, 13), (MB[0] + 70, MB[1] - 30 + i * 22, MB[2] + 7.5), C['Electronics'], M['steel'], bev=0.5)
    tag(j, 'Electronics', 'Compute board', '', (40, -40, -180))
MC = (-128, -58, 24)
pcb('Control_board', (116, 92), MC, C['Electronics'], chips=9, seed=2, explode=(-60, -40, -180),
    title='Real-time control board', desc='Safety MCU runs PID climate control, stepper motion and interlocks independent of the UI computer.',
    spec='Cortex-M7, watchdog, independent over-temp cut-out')
for i in range(4):
    mf = box(f'Driver_heatsink_{i}', (14, 10, 12), (MC[0] + 30, MC[1] - 30 + i * 16, MC[2] + 7), C['Electronics'], M['alu_black'], bev=0.5)
    tag(mf, 'Electronics', 'Real-time control board', '', (-60, -40, -180))
psu = box('PSU', (120, 86, 38), (132, 176, 33), C['Electronics'], M['sheet'], bev=1.5)
vh = [cyl('v', 2.2, 10, (90 + (i % 10) * 9, 150 + (i // 10) * 9, 52), verts=10) for i in range(30)]
boolean(psu, join(vh, 'vents'))
tag(psu, 'Electronics', 'Power supply', 'Enclosed 24 V power supply, universal input.', (160, 40, -120), '100–240 V~')
io_b = box('IO_board', (118, 1.6, 50), (152, 236, 46), C['RearIO'], M['pcb'], bev=0.3)
tag(io_b, 'RearIO', 'Rear I/O board', '', (0, 200, -40))
iop = box('IO_plate', (124, 2, 60), (152, 245.5, 50), C['RearIO'], M['alu_black'], bev=0.6)
cut_io = [box('c', (27, 10, 22), (110, 245, 50), bev=0), box('c', (16, 10, 14), (143, 245, 58), bev=0),
          box('c', (14, 10, 6.5), (143, 245, 40), bev=0), box('c', (14, 10, 6.5), (162, 245, 40), bev=0),
          box('c', (9, 10, 3.4), (162, 245, 58), bev=0), box('c', (14, 10, 22), (192, 245, 50), bev=0)]
boolean(iop, join(cut_io, 'iocuts'))
tag(iop, 'RearIO', 'Rear I/O', 'IEC inlet with fused switch, Gigabit Ethernet, 2× USB-A (scanner/keyboard/export), USB-C service port.',
    (0, 220, -40), 'IEC C14, RJ45 1 GbE, 2× USB-A, USB-C')
iec = box('IEC_inlet', (25, 18, 20), (110, 238, 50), C['RearIO'], M['chip'], bev=1)
tag(iec, 'RearIO', 'Rear I/O', '', (0, 210, -40))
rj = box('RJ45', (15, 20, 13), (143, 236, 58), C['RearIO'], M['steel'], bev=0.4)
tag(rj, 'RearIO', 'Rear I/O', '', (0, 210, -40))
for i, xx in enumerate((143, 162)):
    u_ = box(f'USB_A_{i}', (13, 16, 5.8), (xx, 238, 40), C['RearIO'], M['steel'], bev=0.3)
    tag(u_, 'RearIO', 'Rear I/O', '', (0, 210, -40))
sw = box('Power_switch', (13, 14, 20), (192, 240, 50), C['RearIO'], M['chip'], bev=1)
tag(sw, 'RearIO', 'Rear I/O', '', (0, 210, -40))
for i, (txt, xx) in enumerate([('~ IN', 110), ('LAN', 143), ('USB', 152), ('I/O', 192)]):
    tt = text(f'IO_label_{i}', txt, 3.2, (xx, 246.6, 66 if i != 2 else 32), (90, 0, 180), C['RearIO'], mat('Print white', '#d8dae0', 0.6), FONT_R)
    tag(tt, 'RearIO', 'Rear I/O', '', (0, 220, -40))

# ======================================================================= SCANNER (right side)
sw_ = extrude_yz('Scanner_window', rrect(95, 37, 7.5, 80, 72), W - 3, W - 1, C['Scanner'], M['glass_tint'])
tag(sw_, 'Scanner', 'Side barcode scanner', 'Present a labelled dish to the side window — 1D/2D imager reads it without opening the door.',
    (180, 0, 0), '1D + 2D (DataMatrix, QR)')
eng = box('Scanner_engine', (22, 32, 14), (W - 18, 80, 72), C['Scanner'], M['chip'], bev=1)
tag(eng, 'Scanner', 'Imager engine', 'Area imager with red aimer and white illumination.', (120, 0, 0))
aim = box('Scanner_aimer', (1, 6, 3), (W - 6.5, 80, 72), C['Scanner'], mat('Aimer red', '#ff2a2a', 0.3, emission='#ff2020', strength=12))
tag(aim, 'Scanner', 'Imager engine', '', (120, 0, 0))
sp = box('Scanner_board', (1.6, 44, 40), (W - 31, 80, 72), C['Scanner'], M['pcb'], bev=0.3)
tag(sp, 'Scanner', 'Imager engine', '', (90, 0, 0))
st = text('Scanner_hint', 'SCAN BARCODE HERE', 4.2, (W + 0.3, 80, 98), (90, 0, 90), C['Scanner'], mat('Print grey', '#b8bbd6', 0.6), FONT_R)
tag(st, 'Scanner', 'Side barcode scanner', '', (180, 0, 0))

# ======================================================================= WIRING (visible harnesses)
harness = [
    ([(MC[0] + 50, MC[1] + 30, 30), (MC[0] + 80, 20, 60), (MX - 20, MY - 30, 70), (MX - 21, MY - 5, 70)], M['wire_black'], 1.2),
    ([(MC[0], MC[1] + 40, 30), (-120, 60, 40), (HX + 20, HY - 40, 30), (HX + 20, HY - 20, 22)], M['wire_blue'], 1.0),
    ([(MB[0] - 70, MB[1] + 40, 30), (0, 40, 60), (40, 120, 110), (0, 190, 124)], M['ribbon'], 0.9),
    ([(MB[0] + 40, MB[1] + 50, 30), (130, 80, 40), (132, 132, 45)], M['wire_red'], 1.4),
    ([(MB[0] + 50, MB[1] + 50, 30), (200, 60, 40), (W - 46, 80, 50)], M['wire_white'], 0.9),
    ([(MB[0] + 10, MB[1] - 50, 30), (60, -140, 60), (60, -160, 110)], M['ribbon'], 1.0),
    ([(MC[0] - 20, MC[1] - 45, 30), (-132, -150, 60), (-132, -170, 90)], M['wire_yellow'], 0.9),
]
for i, (pts, mt, r) in enumerate(harness):
    w_ = tube(f'Harness_{i}', pts, r, C['Wiring'], mt)
    tag(w_, 'Wiring', 'Harness', 'Keyed, latching connectors throughout — every sub-assembly is field-swappable.', (0, 0, -120))


IMG_STACK = {'Imaging_window': -40, 'Ring_diffuser': 0, 'Ring_led': 30, 'Ring_light': 30, 'Lens_element': 70, 'Lens_barrel': 80,
             'Image_sensor': 125, 'Camera_board': 125, 'Camera_FFC': 125, 'Imaging_heater': 165, 'Imaging_head_housing': 230,
             'Backlight_': -150}
CAR_STACK = {'Dish_': 130, 'Carousel_knob': 150, 'Pos_': 40, 'Carousel_plate': 40, 'Shaft_seal': 0, 'Drive_shaft': -30,
             'Drive_pulley': -70, 'Drive_belt': -70, 'Motor_pulley': -70, 'Motor_shaft': -70, 'Home_sensor': -70,
             'Motor_bracket': -100, 'Stepper_': -140}
# ======================================================================= EXPLODE LAYOUT (shared by renders + web viewer)
# Layer-cake explode: base drops, dry bay mid, conditioned chamber rises, cover + door lift, front modules slide forward.
BAY = (0, 0, -250)
LAYER = {
    'Base': (0, 0, -440), 'Electronics': BAY, 'Climate': BAY, 'Humidity': BAY, 'Wiring': BAY,
    'RearIO': (0, 180, -250), 'Scanner': (200, 0, -250), 'Chamber': (0, 0, 140), 'Imaging': (0, 0, 140),
    'Carousel': (0, 0, 140), 'Dishes': (0, 0, 140), 'Enclosure': (0, 0, 560), 'Door': (0, -60, 760),
    'Console': (0, -380, 0), 'Printer': (0, -380, 0),
}
OVR = {
    'Deck_plate': (0, 0, -110), 'Deck_post': (0, 0, -330), 'Foot_': (0, 0, -490),
    'Insul_side_L': (-140, 0, 140), 'Insul_side_R': (140, 0, 140), 'Insul_back': (0, 140, 140), 'Insul_top': (0, 0, 330),
    'Insul_floor': (0, 0, 30), 'Air_baffle': (0, 70, 140),
    'Stepper_': BAY, 'Motor_': BAY, 'Drive_pulley': BAY, 'Drive_belt': BAY, 'Home_sensor': BAY, 'Drive_shaft': (0, 0, -60),
    'Door_glass_front': (0, -170, 760), 'Door_glass_top': (0, -60, 860),
    'Screen_coverglass': (0, -490, 70), 'Screen_display': (0, -490, 70), 'Screen_LCD': (0, -450, 50), 'Screen_driver': (0, -415, 30),
    'Printer_door': (0, -440, 30), 'Printer_exit': (0, -440, 30), 'Label_': (-160, -330, 40),
    'Reservoir_hatch': (0, 120, -250), 'Scanner_window': (240, 0, -250), 'Accent_L': (-260, 0, 560), 'Accent_R': (260, 0, 560),
    'Side_Panel_L': (-250, 0, 560), 'Side_Panel_R': (250, 0, 560), 'Lift_pocket_L': (-250, 0, 560), 'Lift_pocket_R': (250, 0, 560),
    'Top_Saddle': (0, 60, 660), 'Fastener_': (0, 0, -380),
}
for o in DEV.all_objects:
    if 'pc_group' not in o:
        continue
    off = LAYER.get(o['pc_group'], (0, 0, 0))
    best = ''
    for k, v in OVR.items():
        if o.name.startswith(k) and len(k) > len(best):
            best, off = k, v
    if o.name.endswith('_lid'):
        off = (off[0], off[1], off[2] + 70)
    o['pc_explode_sub'] = list(o['pc_explode'])
    for k, z_ in IMG_STACK.items():
        if o.name.startswith(k):
            o['pc_explode_sub'] = [0.0, 0.0, float(z_)]
    for k, z_ in CAR_STACK.items():
        if o.name.startswith(k):
            o['pc_explode_sub'] = [0.0, 0.0, float(z_)] if not o.name.endswith('_lid') else [0.0, 0.0, float(z_) + 60]
    o['pc_explode'] = [float(v) for v in off]

# ======================================================================= studio + save
for o in DEV.all_objects:
    o['pc_home'] = [o.location.x, o.location.y, o.location.z]

bpy.context.scene.render.engine = 'CYCLES'
blend = os.path.join(ROOT, 'petricor.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend)

# parts manifest for the web viewer
parts = {}
for o in DEV.all_objects:
    if 'pc_group' not in o:
        continue
    t = o['pc_title']
    e = parts.setdefault(t, dict(title=t, group=o['pc_group'], desc=o['pc_desc'], spec=o.get('pc_spec', ''), objects=[]))
    if o['pc_desc'] and not e['desc']:
        e['desc'] = o['pc_desc']
    if o.get('pc_spec') and not e['spec']:
        e['spec'] = o['pc_spec']
    e['objects'].append(o.name)
with open(os.path.join(EXPORT, 'parts.json'), 'w') as f:
    json.dump(sorted(parts.values(), key=lambda p: p['group']), f, indent=1)
print('BUILD OK', len(list(DEV.all_objects)), 'objects,', len(parts), 'named parts')
