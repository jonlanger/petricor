"""DFM analysis + interactive-viewer export for the PC-6, using the industrial-design-blender skill's idkit.

  Blender -b hardware/petricor.blend --python hardware/blender/dfm_viewer.py -- OUT_DIR
  Blender -b --python hardware/blender/dfm_viewer.py -- OUT_DIR --glb path/to/older.glb   (ingest a previous version)

Writes OUT_DIR/model.glb (mm, one mesh per manufactured part, Draco) and OUT_DIR/spec.json in the skill's
schema (parts[], dims[], explode{}), ready for skill/.../scripts/make_viewer.py.
"""
import bpy, bmesh, json, math, os, re, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'skill', 'industrial-design-blender', 'scripts'))
import idkit as ik  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else os.path.join(HERE, '..', 'export', 'viewer'))
GLB_IN = argv[argv.index('--glb') + 1] if '--glb' in argv else None
os.makedirs(OUT, exist_ok=True)

if GLB_IN:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(GLB_IN))
    objs = [o for o in bpy.context.scene.objects]
else:
    objs = list(bpy.data.collections['Device'].all_objects)
    for o in list(bpy.data.objects):
        if o not in objs:
            bpy.data.objects.remove(o, do_unlink=True)

# ---------------------------------------------------------------- bake everything to plain meshes in mm
dg = bpy.context.evaluated_depsgraph_get()
S = Matrix.Scale(1000.0, 4)
baked = []
for o in objs:
    if o.type not in ('MESH', 'CURVE', 'FONT') or o.hide_render and not GLB_IN:
        continue
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    me.transform(S @ o.matrix_world)
    n = bpy.data.objects.new(o.name, me)
    for k in o.keys():
        if k.startswith('pc_'):
            n[k] = o[k]
    bpy.context.scene.collection.objects.link(n)
    baked.append(n)
for o in objs:
    if o.name in bpy.data.objects and o not in baked:
        bpy.data.objects.remove(o, do_unlink=True)
for o in baked:
    o.name = o.name  # names are unique already

# ---------------------------------------------------------------- DFM checks on molded parts (before joining)
SLOPE_N = (0.0, -0.737, 0.674)
MOLDED = {  # base name: (pull axis in Blender coords, nominal wall mm, resin)
    'Side_Panel_L': ((1, 0, 0), 3.0, 'PC/ABS'), 'Side_Panel_R': ((1, 0, 0), 3.0, 'PC/ABS'),
    'Top_Saddle': ((0, 1, 1), 3.0, 'PC/ABS'), 'Console': ((0, -0.8, 0.6), 3.0, 'PC/ABS'),
    'Door_frame': ((0, -1, 1), 4.0, 'PC'), 'Lift_pocket_L': ((1, 0, 0), 3.0, 'PC/ABS'),
    'Lift_pocket_R': ((1, 0, 0), 3.0, 'PC/ABS'), 'Printer_door': (SLOPE_N, 3.0, 'PC/ABS'),
    'Base_band': ((0, 0, -1), 3.0, 'PC/ABS'), 'Accent_L': ((1, 0, 0), 1.0, 'PC'), 'Accent_R': ((1, 0, 0), 1.0, 'PC'), 'Cover': ((0, 0, 1), 3.5, 'PC/ABS'),
}
checks = {}
for o in baked:
    base = re.sub(r'\.\d+$', '', o.name)
    if base in MOLDED and o.type == 'MESH':
        pull, wall, resin = MOLDED[base]
        checks[base] = {'pull': pull, 'resin': resin, 'manifold': ik.is_manifold(o),
                        'wall': ik.wall_report(o, wall, samples=900), 'draft': ik.draft_report(o, pull=pull, min_deg=1.0)}
        dr = checks[base]['draft']
        print('DFM', base, checks[base]['manifold'], checks[base]['wall'].get('median'), f"ext {dr['exterior_flagged_mm2']:.0f}/{dr['surface_area_mm2']:.0f} mm2", f"feat {dr['feature_flagged_mm2']:.0f} mm2")

# ---------------------------------------------------------------- one object per manufactured part
groups = {}
for o in baked:
    title = o.get('pc_title') or re.sub(r'[_.]\d+$', '', o.name)
    key = (title, tuple(round(v, 1) for v in (o.get('pc_explode') or [0, 0, 0])))
    groups.setdefault(key, []).append(o)
parts, used = [], {}
for (title, exp), members in groups.items():
    base = re.sub(r'[^A-Za-z0-9]+', '_', title).strip('_') or 'Part'
    side = ''
    if len([k for k in groups if k[0] == title]) > 1:
        side = '_L' if exp[0] < 0 else '_R' if exp[0] > 0 else f'_{len(used.get(base, []))}'
    name = base + side
    used.setdefault(base, []).append(name)
    if len(members) > 1:
        with bpy.context.temp_override(active_object=members[0], selected_editable_objects=members, object=members[0]):
            bpy.ops.object.join()
    p = members[0]
    p.name = name
    parts.append(p)

# ---------------------------------------------------------------- spec.json (skill schema)
def density(o):
    m = (o.data.materials[0].name if o.data.materials else '').lower()
    for k, v in (('stainless', 7.93), ('zinc sheet', 7.85), ('aluminium', 2.70), ('copper', 8.9), ('glass', 2.5), ('pir', 0.035), ('epp', 0.045), ('aerogel', 0.15),
                 ('pcb', 1.85), ('silicone', 1.15), ('polystyrene', 1.05), ('agar', 1.0), ('water', 1.0), ('hepa', 0.3), ('label', 0.9),
                 ('ceramic', 3.8), ('ic package', 1.9), ('pc-abs', 1.15), ('graphite', 1.15), ('navy', 1.2), ('pp ', 0.9)):
        if k in m:
            return v
    return 1.2


rows = []
for p in parts:
    vol = ik.volume_cm3(p)
    src = [c for c in checks if p.get('pc_title') and c in {o for o in checks}]
    row = {'part': p.name, 'process': p.get('pc_process', ''), 'material': p.get('pc_spec', ''), 'cmf': p.get('pc_spec', ''),
           'bbox_mm': ik.dims(p), 'volume_cm3': vol, 'mass_g': round(vol * density(p), 1), 'manifold': ik.is_manifold(p),
           'notes': p.get('pc_desc', ''), 'group': p.get('pc_group', '')}
    rows.append(row)
# attach per-part DFM results (checks were keyed by the original object name)
name_map = {'Side_Panel_L': 'Side_panel_L', 'Side_Panel_R': 'Side_panel_R', 'Top_Saddle': 'Top_saddle', 'Console': 'Front_console',
            'Door_frame': 'Gull_wing_door_frame', 'Lift_pocket_L': 'Lift_handhold_L', 'Lift_pocket_R': 'Lift_handhold_R',
            'Printer_door': 'Printer_door', 'Base_band': 'Base_band', 'Accent_L': 'Side_accent_inlay_L', 'Accent_R': 'Side_accent_inlay_R', 'Cover': 'Outer_cover'}
for base, c in checks.items():
    for r in rows:
        if r['part'] == name_map.get(base):
            r['wall'] = c['wall']; r['draft'] = c['draft']; r['pull_axis'] = c['pull']; r['manifold'] = c['manifold']
            r['process'] = r['process'] or 'Injection molded'
            r['wall']['part'] = r['part']; r['draft']['part'] = r['part']

explode = {p.name: list(p.get('pc_explode') or [0, 0, 0]) for p in parts}
ik.DIMS.clear()
if not GLB_IN:
    ik.dim('Saddle between reveals', (-215.6, 150, 404), (215.6, 150, 404), 'top')
    ik.dim('Door gap 1.5', (214.1, -122, 300), (215.6, -122, 300), 'front')
    ik.dim('Finger recess', (263, 50, 4), (263, 50, 20), 'right')
    ik.dim('Band reveal (z 28)', (263, -260, 0), (263, -260, 28), 'right')
    ik.dim('Hood R34 = door, concentric', (263, -120, 366), (263, -86, 400), 'right')
    ik.dim('Body width 520 (R44 roll)', (-260, 0, 200), (260, 0, 200), 'front')
    ik.dim('Dish plane', (263, 154, 0), (263, 154, 170), 'right')
    ik.dim('Console face (47.5°)', (263, -120, 196), (263, -248, 56), 'right')
data = {'units': 'mm', 'parts': rows, 'dims': ik.DIMS, 'explode': explode,
        'product': 'Petricor PC-6', 'total_mass_est_g': round(sum(r['mass_g'] for r in rows), 0)}
with open(os.path.join(OUT, 'spec.json'), 'w') as f:
    json.dump(data, f, indent=1)

# ---------------------------------------------------------------- GLB (mm, Draco)
for o in bpy.context.scene.objects:
    o.select_set(o in parts)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'model.glb'), use_selection=True, export_yup=True, export_apply=True,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                          export_image_format='JPEG', export_extras=False)
print('VIEWER EXPORT', len(parts), 'parts', os.path.getsize(os.path.join(OUT, 'model.glb')) // 1024, 'KB', 'mass', data['total_mass_est_g'])
