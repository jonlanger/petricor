"""Render product shots from hardware/petricor.blend.

Blender -b hardware/petricor.blend --python hardware/blender/render_petricor.py -- [shots...] [--samples N] [--scale S] [--out DIR]
Shots: hero, hero_blue, open, open_blue, front, side, rear, exploded, exploded_side, interior, section,
       d_carousel, d_imaging, d_console, d_scanner, d_climate, d_rear_io, top
"""
import bpy, math, os, sys
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pc_lib import MM, mat, srgb, extrude_yz, thick_polyline, box, coll

ROOT = os.path.abspath(os.path.join(HERE, '..'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
opts = {'samples': 256, 'scale': 1.0, 'out': os.path.join(ROOT, 'renders'), 'ui': os.path.join(ROOT, 'textures', 'screen_ui.png')}
shots = []
i = 0
while i < len(argv):
    a = argv[i]
    if a.startswith('--'):
        opts[a[2:]] = argv[i + 1]; i += 2
    else:
        shots.append(a); i += 1
os.makedirs(opts['out'], exist_ok=True)
SAMPLES = int(opts['samples']); SCALE = float(opts['scale'])

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    sc.cycles.device = 'GPU'
except Exception as e:
    print('GPU unavailable', e)
print('DEVICE', sc.cycles.device, [d.name for d in prefs.devices if d.use])
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.cycles.max_bounces = 12
sc.cycles.transmission_bounces = 12
sc.cycles.glossy_bounces = 6
sc.cycles.diffuse_bounces = 8   # aerial mycelium needs the extra bounces to read white
sc.cycles.caustics_reflective = False
sc.cycles.caustics_refractive = False
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Punchy'
sc.view_settings.exposure = -0.3
sc.render.resolution_percentage = 100
sc.render.film_transparent = False
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGB'

# swap screen texture if a fresh UI capture exists
if os.path.exists(opts['ui']):
    m = bpy.data.materials.get('Screen UI')
    if m:
        m.node_tree.nodes['UI'].image = bpy.data.images.load(opts['ui'], check_existing=False)

# ------------------------------------------------------------------ studio rig
STUDIO = coll('Studio')
rig = bpy.data.objects.new('Rig', None)
STUDIO.objects.link(rig)
path = [(-5000, 0), (1500, 0)] + [(1500 + 1100 * math.sin(math.radians(a)), 1100 - 1100 * math.cos(math.radians(a))) for a in range(6, 91, 6)] + [(2600, 5000)]
cyc = extrude_yz('Cyclorama', thick_polyline(path, -20), -6000, 6000, STUDIO)
for p in cyc.data.polygons:
    p.use_smooth = True
bd_mat = bpy.data.materials.new('Backdrop'); bd_mat.use_nodes = True
bd_bsdf = bd_mat.node_tree.nodes['Principled BSDF']; bd_bsdf.inputs['Roughness'].default_value = 0.85
cyc.data.materials.append(bd_mat)
cyc.parent = rig


def area(name, size, power, loc, target, color=(1, 1, 1), shape='RECTANGLE', sy=None):
    L = bpy.data.lights.new(name, 'AREA')
    L.energy = power; L.color = color
    L.shape = shape; L.size = size; L.size_y = sy or size
    ob = bpy.data.objects.new(name, L)
    STUDIO.objects.link(ob)
    ob.location = Vector(loc)
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    ob.parent = rig
    return ob


key = area('Key', 1.6, 260, (-1.6, -1.4, 1.9), (0, 0, 0.2), (1.0, 0.97, 0.93))
fill = area('Fill', 2.2, 70, (1.9, -1.0, 0.9), (0, 0, 0.2), (0.93, 0.96, 1.0))
rim = area('Rim', 1.2, 220, (0.9, 1.9, 1.6), (0, 0, 0.3))
top = area('Top', 2.0, 45, (0, -0.2, 2.6), (0, 0, 0))
kick = area('Kicker', 0.6, 45, (-1.4, 0.8, 0.35), (0, 0, 0.2))

clamp = bpy.data.lights.new('ChamberLamp', 'AREA'); clamp.shape = 'RECTANGLE'; clamp.size = 0.30; clamp.size_y = 0.02
clamp.energy = 22.0; clamp.color = (1.0, 0.97, 0.92)
chamber_lamp = bpy.data.objects.new('ChamberLamp', clamp); STUDIO.objects.link(chamber_lamp)
chamber_lamp.location = (0, 0.030, 0.382)
world = bpy.data.worlds.new('World'); sc.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.5, 0.5, 0.52, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.25

cam_data = bpy.data.cameras.new('Cam'); cam = bpy.data.objects.new('Cam', cam_data)
STUDIO.objects.link(cam); sc.camera = cam
cam_data.sensor_width = 36

# ------------------------------------------------------------------ state helpers
DEV = bpy.data.collections['Device']
objs = [o for o in DEV.all_objects]
home = {o.name: o.matrix_world.copy() for o in objs}
pivot = bpy.data.objects['Door_pivot']


def reset_state():
    pivot.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    for o in objs:
        o.matrix_world = home[o.name]
        o.hide_render = False
        for m in list(o.modifiers):
            if m.name.startswith('Section'):
                o.modifiers.remove(m)
    bpy.context.view_layer.update()


def door(angle):
    pivot.rotation_euler = (math.radians(-angle), 0, 0)


def hide_groups(*groups, names=()):
    for o in objs:
        if o.get('pc_group') in groups or o.name in names or any(o.name.startswith(n) for n in names):
            o.hide_render = True


def explode(f=1.0, skip=(), key='pc_explode', only=None, lift=0.0):
    bpy.context.view_layer.update()
    for o in objs:
        if only and o.get('pc_group') not in only:
            continue
        e = o.get(key)
        if not e or o.get('pc_group') in skip:
            continue
        mw = home[o.name].copy()
        mw.translation += Vector(e) * MM * f + Vector((0, 0, lift))
        o.matrix_world = mw
    bpy.context.view_layer.update()


def apply_section(x=0.0, groups=('Enclosure', 'Console', 'Chamber', 'Door', 'Base', 'Humidity'), names=()):
    cut = bpy.data.objects.get('SectionCutter')
    if cut is None:
        cut = box('SectionCutter', (600, 1400, 1400), (-300 + x, 0, 300), STUDIO)
        cut.hide_render = True
        cut.display_type = 'WIRE'
    for o in objs:
        if o.type == 'MESH' and (o.get('pc_group') in groups or o.name in names):
            m = o.modifiers.new('Section', 'BOOLEAN')
            m.operation = 'DIFFERENCE'; m.solver = 'FAST'; m.object = cut


def backdrop(color_hex):
    bd_bsdf.inputs['Base Color'].default_value = srgb(color_hex)


def shoot(name, cam_loc, target, lens=70, res=(1920, 1200), bg='#e4e5ea', rig_follow=True, dof=None, exposure=-0.3):
    cam.location = Vector(cam_loc)
    d = Vector(target) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam_data.lens = lens
    cam_data.clip_start = 0.01
    if dof:
        cam_data.dof.use_dof = True
        cam_data.dof.focus_distance = (Vector(dof[0]) - cam.location).length
        cam_data.dof.aperture_fstop = dof[1]
    else:
        cam_data.dof.use_dof = False
    if rig_follow:
        az = math.atan2(cam_loc[1], cam_loc[0])
        rig.rotation_euler = (0, 0, az + math.pi / 2)
    backdrop(bg)
    sc.render.resolution_x = int(res[0] * SCALE)
    sc.render.resolution_y = int(res[1] * SCALE)
    sc.render.filepath = os.path.join(opts['out'], name + '.png')
    sc.view_settings.exposure = exposure
    bpy.ops.render.render(write_still=True)
    sc.view_settings.exposure = -0.3
    print('RENDERED', sc.render.filepath)


BLUE = '#6268f2'
GREY = '#e4e5ea'
DARK = '#16171c'

SHOTS = {}


def shot(fn):
    SHOTS[fn.__name__] = fn
    return fn


@shot
def hero():
    reset_state(); shoot('hero', (0.95, -1.45, 0.62), (0.0, 0.0, 0.19), 62)


@shot
def hero_blue():
    reset_state(); shoot('hero_blue', (0.95, -1.45, 0.62), (0.0, 0.0, 0.19), 62, bg=BLUE)


@shot
def open():
    reset_state(); door(78); shoot('open', (0.85, -1.35, 0.95), (0.0, 0.0, 0.24), 58)


@shot
def open_blue():
    reset_state(); door(78); shoot('open_blue', (0.85, -1.35, 0.95), (0.0, 0.0, 0.24), 58, bg=BLUE)


@shot
def front():
    reset_state(); shoot('front', (0.0, -1.9, 0.42), (0.0, 0.0, 0.2), 70, res=(1600, 1600))


@shot
def side():
    reset_state(); door(78); shoot('side', (2.1, 0.0, 0.4), (0.0, 0.0, 0.3), 70)


@shot
def rear():
    reset_state(); shoot('rear', (-0.9, 1.4, 0.55), (0.0, 0.05, 0.18), 62)


@shot
def top():
    reset_state(); door(78); shoot('top', (0.0, 0.05, 2.0), (0.0, 0.05, 0.0), 58, res=(1600, 1600))


@shot
def top_closed():
    reset_state(); shoot('top_closed', (0.0, 0.05, 2.0), (0.0, 0.05, 0.0), 58, res=(1600, 1600))


@shot
def d_corner():
    reset_state(); shoot('d_corner', (0.5, -1.0, 0.1), (0.18, -0.25, 0.05), 100)


@shot
def exploded():
    reset_state(); explode(1.0, lift=0.5); hide_groups('Wiring')
    shoot('exploded', (2.55, -3.1, 1.55), (0.0, -0.12, 0.72), 50, res=(1600, 2000))


@shot
def exploded_blue():
    reset_state(); explode(1.0, lift=0.5); hide_groups('Wiring')
    shoot('exploded_blue', (2.55, -3.1, 1.55), (0.0, -0.12, 0.72), 50, res=(1600, 2000), bg=BLUE)


@shot
def exploded_side():
    reset_state(); explode(1.0, lift=0.5); hide_groups('Wiring')
    shoot('exploded_side', (3.3, -0.9, 0.9), (0.0, -0.1, 0.78), 50, res=(1920, 1600))


def isolate(groups):
    for o in objs:
        if o.get('pc_group') not in groups:
            o.hide_render = True


@shot
def x_imaging():
    reset_state(); isolate(('Imaging',)); explode(0.7, key='pc_explode_sub', only=('Imaging',), lift=0.0)
    for o in objs:
        if o.name.startswith('Backlight'):
            o.hide_render = True
    shoot('x_imaging', (0.42, -0.28, 0.5), (0.0, 0.154, 0.405), 60, res=(1600, 1920))


@shot
def x_carousel():
    reset_state(); isolate(('Carousel', 'Dishes')); explode(1.0, key='pc_explode_sub', only=('Carousel', 'Dishes'), lift=0.12)
    shoot('x_carousel', (0.72, -0.9, 0.62), (0.02, 0.05, 0.27), 50, res=(1600, 1920))


@shot
def x_climate():
    reset_state(); isolate(('Climate', 'Humidity')); explode(0.7, key='pc_explode_sub', only=('Climate', 'Humidity'), lift=0.1)
    shoot('x_climate', (0.48, -0.32, 0.42), (-0.06, 0.19, 0.17), 45)


@shot
def x_console():
    reset_state(); isolate(('Console', 'Printer')); explode(0.6, key='pc_explode_sub', only=('Console', 'Printer'))
    shoot('x_console', (0.75, -0.95, 0.45), (-0.02, -0.33, 0.12), 55)


@shot
def interior():
    reset_state(); door(78); hide_groups('Enclosure', 'Console', 'Chamber', 'Door')
    shoot('interior', (0.8, -1.05, 0.95), (0.0, 0.03, 0.15), 50)


@shot
def section():
    reset_state(); apply_section(0.0); door(0)
    shoot('section', (-1.35, -1.0, 0.72), (0.0, 0.02, 0.2), 55)


@shot
def d_carousel():
    reset_state(); door(78)
    shoot('d_carousel', (0.18, -0.46, 0.52), (0.0, 0.03, 0.18), 50, dof=((0.0, -0.05, 0.18), 5.6), exposure=-1.6)


@shot
def d_imaging():
    reset_state(); hide_groups('Enclosure', 'Door', 'Console', 'Wiring', names=('Insul_', 'Chamber_liner', 'Door_gasket', 'Chamber_trim', 'Air_baffle', 'UVC_'))
    apply_section(0.0, groups=(), names=('Imaging_head_housing', 'Ring_diffuser', 'Imaging_window', 'Ring_light_pcb', 'Lens_barrel', 'Imaging_heater', 'Camera_board'))
    shoot('d_imaging', (-0.32, 0.02, 0.36), (0.0, 0.154, 0.345), 70, dof=((0.0, 0.154, 0.35), 5.6))


@shot
def d_console():
    reset_state(); shoot('d_console', (0.12, -0.72, 0.36), (0.02, -0.19, 0.13), 70)


@shot
def d_scanner():
    reset_state(); shoot('d_scanner', (0.75, -0.2, 0.2), (0.24, 0.08, 0.06), 80)


@shot
def d_climate():
    reset_state(); hide_groups('Enclosure', 'Chamber', 'Door', 'Carousel', 'Dishes', 'Imaging', 'Console', names=('Deck_',))
    shoot('d_climate', (-0.55, 0.62, 0.42), (0.0, 0.12, 0.07), 45)


@shot
def d_rear_io():
    reset_state(); shoot('d_rear_io', (0.35, 0.7, 0.16), (0.15, 0.25, 0.05), 85)


@shot
def dbg_dish():
    reset_state(); isolate(('Dishes',))
    for o in objs:
        if o.name.endswith('_lid'): o.hide_render = True
    shoot('dbg_dish', (0.0, 0.154, 0.45), (0.0, 0.154, 0.17), 50, res=(800, 800))


def lids_off(*dishes):
    for o in objs:
        if o.name.endswith('_lid') and (not dishes or any(o.name.startswith(f'Dish_{d}_') for d in dishes)):
            o.hide_render = True


@shot
def d_culture():
    """Fusarium plate (dish 3), lid lifted, raking light across the aerial mycelium."""
    reset_state(); door(78); lids_off(3)
    shoot('d_culture', (-0.03, -0.075, 0.265), (-0.088, 0.001, 0.178), 55, dof=((-0.088, 0.001, 0.178), 5.6), exposure=-3.4)


@shot
def d_culture_b():
    """Aspergillus niger / Penicillium plate (dish 1) under the imaging station, lid lifted."""
    reset_state(); door(78); lids_off(1)
    shoot('d_culture_b', (0.0, 0.035, 0.27), (0.0, 0.154, 0.178), 55, dof=((0.0, 0.154, 0.178), 5.6), exposure=-3.4)


@shot
def plates_top():
    """All six cultures from above, lids off, overhead softbox off so the wet agar doesn't mirror it."""
    reset_state(); isolate(('Dishes', 'Carousel')); lids_off()
    tl = bpy.data.objects['Top'].data; e = tl.energy; tl.energy = 0
    shoot('plates_top', (0.0, 0.052, 0.95), (0.0, 0.052, 0.17), 60, res=(1600, 1600), exposure=-3.0)
    tl.energy = e


@shot
def d_handhold():
    reset_state(); shoot('d_handhold', (0.72, -0.22, 0.12), (0.235, 0.05, 0.04), 70)


@shot
def d_reveal():
    reset_state(); shoot('d_reveal', (0.62, 0.72, 0.62), (0.2, 0.2, 0.38), 85)


@shot
def d_scoop():
    reset_state(); shoot('d_scoop', (0.25, -0.62, 0.34), (0.0, -0.13, 0.2), 85)


@shot
def x_insulation():
    """Moulded EPP insulation set around the liner, pulled apart to show the dimpled outboard faces."""
    reset_state()
    for o in objs:
        if not (o.name.startswith('Insul_') or o.name.startswith('Chamber_liner') or o.name.startswith('Side_Panel_R')):
            o.hide_render = True
    explode(0.55, only=('Chamber', 'Enclosure'))
    shoot('x_insulation', (1.25, 0.95, 0.95), (0.05, 0.02, 0.33), 45)


@shot
def d_foam():
    reset_state()
    for o in objs:
        if not o.name.startswith('Insul_side_R'):
            o.hide_render = True
    shoot('d_foam', (0.62, -0.18, 0.36), (0.25, 0.06, 0.27), 60)


todo = shots or ['hero', 'open', 'exploded', 'section', 'interior']
for s in todo:
    SHOTS[s]()
print('DONE')
