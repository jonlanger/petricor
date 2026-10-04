"""Petricor hardware — Blender helper library.

All model dimensions are authored in millimetres and converted with MM.
Axes: +X right, -Y front of device, +Z up. Origin = centre of footprint on the bench.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix

MM = 0.001

# ---------------------------------------------------------------- scene / collections

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = 'METRIC'
    s.unit_settings.length_unit = 'MILLIMETERS'


def coll(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def link(obj, collection):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def tag(obj, group, title=None, desc=None, explode=(0, 0, 0), spec=None):
    """Metadata carried into the .blend and the glTF export (extras)."""
    obj["pc_group"] = group
    obj["pc_title"] = title or obj.name
    obj["pc_desc"] = desc or ""
    obj["pc_explode"] = [float(v) for v in explode]
    if spec:
        obj["pc_spec"] = spec
    return obj

# ---------------------------------------------------------------- materials

_mats = {}

def srgb(h):
    """'#rrggbb' -> linear RGBA"""
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, 1.0)


def mat(name, color='#ffffff', rough=0.5, metal=0.0, **kw):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(color) if isinstance(color, str) else color
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    for k, v in kw.items():
        key = {
            'transmission': 'Transmission Weight', 'ior': 'IOR', 'coat': 'Coat Weight',
            'coat_rough': 'Coat Roughness', 'emission': 'Emission Color', 'strength': 'Emission Strength',
            'sss': 'Subsurface Weight', 'sss_radius': 'Subsurface Radius', 'alpha': 'Alpha',
            'specular': 'Specular IOR Level', 'aniso': 'Anisotropic', 'sheen': 'Sheen Weight',
            'sheen_tint': 'Sheen Tint',
        }[k]
        if k == 'emission' and isinstance(v, str):
            v = srgb(v)
        b.inputs[key].default_value = v
    if kw.get('alpha', 1.0) < 1.0:
        m.blend_method = 'BLEND'
    if kw.get('transmission', 0) >= 0.5:
        shadow_transparent(m)
    _mats[name] = m
    return m


def shadow_transparent(m):
    """Thin glass: let shadow rays through so interiors behind glazing/lids are lit (caustics are off)."""
    nt = m.node_tree
    out = nt.nodes['Material Output']
    b = nt.nodes['Principled BSDF']
    lp = nt.nodes.new('ShaderNodeLightPath')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Shadow Ray'], mix.inputs['Fac'])
    nt.links.new(b.outputs['BSDF'], mix.inputs[1])
    nt.links.new(tr.outputs['BSDF'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])


def build_materials():
    M = {}
    M['shell'] = mat('PC-ABS White (textured)', '#eceef2', 0.42, coat=0.15, coat_rough=0.3)
    M['shell_inner'] = mat('PC-ABS White (raw)', '#d9dbe0', 0.7)
    M['graphite'] = mat('PC Graphite', '#121316', 0.55, specular=0.25, coat=0.08, coat_rough=0.4)
    M['graphite_matte'] = mat('PC Graphite matte', '#17181c', 0.72, specular=0.25)
    M['navy'] = mat('Accent Navy', '#191c55', 0.5, coat=0.1)
    M['blue'] = mat('Petricor Blue', '#3a44ff', 0.35)
    M['blue_glow'] = mat('Petricor Blue light', '#3a44ff', 0.3, emission='#4f58ff', strength=6.0)
    M['white_glow'] = mat('LED white', '#ffffff', 0.3, emission='#fff6ea', strength=18.0)
    M['uvc_glow'] = mat('LED UV-C', '#9a7bff', 0.3, emission='#8f6bff', strength=4.0)
    M['glass'] = mat('Borosilicate glass', '#ffffff', 0.02, transmission=1.0, ior=1.47)
    M['glass_tint'] = mat('Glass smoked (ITO)', '#a9b0c4', 0.03, transmission=1.0, ior=1.5)
    M['ps_clear'] = mat('Polystyrene clear', '#ffffff', 0.04, transmission=1.0, ior=1.59)
    M['acrylic_frost'] = mat('Acrylic frosted', '#ffffff', 0.45, transmission=0.9, ior=1.49)
    M['alu'] = mat('Aluminium bead-blasted', '#c9ccd1', 0.38, 1.0)
    M['alu_anod'] = mat('Aluminium anodised clear', '#b8bcc4', 0.28, 1.0, aniso=0.3)
    M['alu_black'] = mat('Aluminium anodised black', '#1a1b1f', 0.35, 1.0)
    M['steel'] = mat('Stainless 316L satin', '#c9ccd1', 0.32, 1.0, aniso=0.5)
    M['sheet'] = mat('Zinc sheet steel', '#9ea3ab', 0.45, 1.0)
    M['copper'] = mat('Copper', '#d88a5a', 0.3, 1.0)
    M['gold'] = mat('ENIG gold', '#e2b457', 0.25, 1.0)
    M['pcb'] = mat('PCB soldermask', '#11261d', 0.35, coat=0.6, coat_rough=0.15)
    M['pcb_black'] = mat('PCB soldermask black', '#101113', 0.35, coat=0.6, coat_rough=0.15)
    M['chip'] = mat('IC package', '#141416', 0.55)
    M['rubber'] = mat('Silicone rubber', '#16171a', 0.85)
    M['rubber_grey'] = mat('Silicone gasket grey', '#5b5f66', 0.8)
    M['foam'] = mat('EPP bead foam', '#e8d7a2', 0.9, sheen=0.3)
    M['aerogel'] = mat('Aerogel blanket', '#d7dadf', 0.95)
    M['hepa'] = mat('HEPA media', '#f1efe8', 0.95)
    M['tank'] = mat('PP translucent', '#dfe8f5', 0.25, transmission=0.7, ior=1.49)
    M['water'] = mat('Water', '#dff1ff', 0.0, transmission=1.0, ior=1.333)
    M['label'] = mat('Thermal label', '#f7f7f2', 0.6)
    M['ceramic'] = mat('Alumina ceramic', '#f0eee8', 0.5)
    M['wire_red'] = mat('Wire red', '#c21d1d', 0.5)
    M['wire_black'] = mat('Wire black', '#111111', 0.5)
    M['wire_blue'] = mat('Wire blue', '#2146c7', 0.5)
    M['wire_white'] = mat('Wire white', '#e8e8e8', 0.5)
    M['wire_yellow'] = mat('Wire yellow', '#d9b21e', 0.5)
    M['ribbon'] = mat('FFC ribbon', '#c9a45a', 0.4)
    M['lens'] = mat('Lens coated', '#10131a', 0.02, 0.0, transmission=0.6, ior=1.7, coat=1.0, coat_rough=0.0)
    M['screen_off'] = mat('Display glass off', '#050608', 0.05, coat=1.0, coat_rough=0.02)
    M['backdrop'] = mat('Studio backdrop', '#e9eaee', 0.9)
    return M

# ---------------------------------------------------------------- mesh utilities

def _obj_from_bm(name, bm, collection, material=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    if material is not None:
        me.materials.append(material)
    return ob


def smooth(ob, on=True):
    for p in ob.data.polygons:
        p.use_smooth = on
    return ob


def bevel(ob, width, segments=3, angle=35, harden=True, clamp=True):
    m = ob.modifiers.new('Bevel', 'BEVEL')
    m.width = width * MM
    m.segments = segments
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    m.use_clamp_overlap = clamp
    m.harden_normals = harden
    smooth(ob, True)
    return m


def apply_mods(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return ob


def boolean(ob, cutter, op='DIFFERENCE', apply=True, keep_cutter=False):
    m = ob.modifiers.new('Bool', 'BOOLEAN')
    m.operation = op
    m.solver = 'EXACT'
    m.object = cutter
    if apply:
        apply_mods(ob)
        if not keep_cutter:
            bpy.data.objects.remove(cutter, do_unlink=True)
    return ob


def join(objs, name=None):
    """Join meshes into first object (no bpy.ops)."""
    base = objs[0]
    bm = bmesh.new()
    for o in objs:
        tmp = o.data.copy()
        tmp.transform(o.matrix_world)
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    inv = base.matrix_world.inverted()
    bm.transform(inv)
    me = bpy.data.meshes.new((name or base.name))
    bm.to_mesh(me)
    bm.free()
    for mt in base.data.materials:
        me.materials.append(mt)
    for o in objs[1:]:
        bpy.data.objects.remove(o, do_unlink=True)
    base.data = me
    if name:
        base.name = name
    return base

# ---------------------------------------------------------------- primitives (mm)

def box(name, size, loc=(0, 0, 0), collection=None, material=None, bev=0.0, seg=3, rot=None):
    sx, sy, sz = [v * MM / 2 for v in size]
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * 2 * sx, v.co.y * 2 * sy, v.co.z * 2 * sz))
    ob = _obj_from_bm(name, bm, collection or bpy.context.scene.collection, material)
    ob.location = Vector(loc) * MM
    if rot:
        ob.rotation_euler = [math.radians(a) for a in rot]
    if bev > 0:
        bevel(ob, bev, seg)
    return ob


def cyl(name, r, h, loc=(0, 0, 0), collection=None, material=None, verts=48, bev=0.0, seg=2,
        rot=None, r2=None, axis='Z'):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts,
                          radius1=r * MM, radius2=(r2 if r2 is not None else r) * MM, depth=h * MM)
    ob = _obj_from_bm(name, bm, collection or bpy.context.scene.collection, material)
    ob.location = Vector(loc) * MM
    if axis == 'X':
        ob.rotation_euler = (0, math.radians(90), 0)
    elif axis == 'Y':
        ob.rotation_euler = (math.radians(90), 0, 0)
    if rot:
        ob.rotation_euler = [math.radians(a) for a in rot]
    if bev > 0:
        bevel(ob, bev, seg, angle=50)
    else:
        smooth(ob)
        _flat_caps(ob)
    return ob


def _flat_caps(ob):
    for p in ob.data.polygons:
        if len(p.vertices) > 4:
            p.use_smooth = False


def lathe(name, profile, collection=None, material=None, segs=64, loc=(0, 0, 0), rot=None, closed=True):
    """Surface of revolution around Z. profile = [(r, z), ...] in mm, ordered around the section."""
    bm = bmesh.new()
    rings = []
    for (r, z) in profile:
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            ring.append(bm.verts.new((max(r, 0.0001) * MM * math.cos(a), max(r, 0.0001) * MM * math.sin(a), z * MM)))
        rings.append(ring)
    n = len(rings) if closed else len(rings) - 1
    for j in range(n):
        a_ring, b_ring = rings[j], rings[(j + 1) % len(rings)]
        for i in range(segs):
            try:
                bm.faces.new((a_ring[i], a_ring[(i + 1) % segs], b_ring[(i + 1) % segs], b_ring[i]))
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.00002)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _obj_from_bm(name, bm, collection or bpy.context.scene.collection, material)
    ob.location = Vector(loc) * MM
    if rot:
        ob.rotation_euler = [math.radians(a) for a in rot]
    smooth(ob)
    return ob


def extrude_yz(name, pts, x0, x1, collection=None, material=None):
    """Polygon in the YZ plane (mm) extruded along X from x0 to x1."""
    bm = bmesh.new()
    a = [bm.verts.new((x0 * MM, y * MM, z * MM)) for (y, z) in pts]
    b = [bm.verts.new((x1 * MM, y * MM, z * MM)) for (y, z) in pts]
    n = len(pts)
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    for i in range(n):
        bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj_from_bm(name, bm, collection or bpy.context.scene.collection, material)


def loft_yz_draft(name, pts, x_in, x_out, deg, collection=None, material=None):
    """Through-opening cutter along X with molding draft: the outline at x_out is grown by
    |x_out − x_in|·tan(deg), so the opening is larger on the cavity (outside) face."""
    grow = abs(x_out - x_in) * math.tan(math.radians(deg))
    outer = offset_polygon(pts, -grow)
    bm = bmesh.new()
    a = [bm.verts.new((x_in * MM, y * MM, z * MM)) for (y, z) in pts]
    b = [bm.verts.new((x_out * MM, y * MM, z * MM)) for (y, z) in outer]
    n = len(pts)
    bm.faces.new(a[::-1]); bm.faces.new(b)
    for i in range(n):
        bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj_from_bm(name, bm, collection or bpy.context.scene.collection, material)


def extrude_xy(name, pts, z0, z1, collection=None, material=None, loc=(0, 0, 0)):
    """Polygon in the XY plane (mm) extruded along Z."""
    bm = bmesh.new()
    a = [bm.verts.new((x * MM, y * MM, z0 * MM)) for (x, y) in pts]
    b = [bm.verts.new((x * MM, y * MM, z1 * MM)) for (x, y) in pts]
    n = len(pts)
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    for i in range(n):
        bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _obj_from_bm(name, bm, collection or bpy.context.scene.collection, material)
    ob.location = Vector(loc) * MM
    return ob

# ---------------------------------------------------------------- 2D geometry

def offset_polygon(pts, t):
    """Inward offset of a CCW-or-CW simple polygon by t (mm) via offset-line intersection."""
    n = len(pts)
    area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n)) / 2
    sgn = 1 if area > 0 else -1
    lines = []
    for i in range(n):
        p, q = Vector(pts[i]), Vector(pts[(i + 1) % n])
        d = (q - p).normalized()
        nrm = Vector((-d.y, d.x)) * sgn  # inward for CCW
        lines.append((p + nrm * t, d))
    out = []
    for i in range(n):
        p1, d1 = lines[i - 1]
        p2, d2 = lines[i]
        den = d1.x * d2.y - d1.y * d2.x
        if abs(den) < 1e-9:
            out.append(tuple(p2))
            continue
        s = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den
        out.append(tuple(p1 + d1 * s))
    return out


def fillet_polygon(pts, radii, seg=8):
    """Round each vertex of a polygon with its radius (0 = sharp)."""
    n = len(pts)
    out = []
    for i in range(n):
        r = radii[i] if isinstance(radii, (list, tuple)) else radii
        p0, p1, p2 = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % n])
        if r <= 0:
            out.append(tuple(p1))
            continue
        a = (p0 - p1).normalized()
        b = (p2 - p1).normalized()
        ang = math.acos(max(-1, min(1, a.dot(b))))
        tlen = r / math.tan(ang / 2)
        tlen = min(tlen, (p0 - p1).length * 0.49, (p2 - p1).length * 0.49)
        r_eff = tlen * math.tan(ang / 2)
        s, e = p1 + a * tlen, p1 + b * tlen
        bis = (a + b).normalized()
        c = p1 + bis * (r_eff / math.sin(ang / 2))
        v0, v1 = s - c, e - c
        a0, a1 = math.atan2(v0.y, v0.x), math.atan2(v1.y, v1.x)
        da = a1 - a0
        while da > math.pi: da -= 2 * math.pi
        while da < -math.pi: da += 2 * math.pi
        for k in range(seg + 1):
            t = a0 + da * k / seg
            out.append((c.x + r_eff * math.cos(t), c.y + r_eff * math.sin(t)))
    return out


def rrect(w, h, r, cx=0, cy=0, seg=8):
    pts = [(cx - w / 2, cy - h / 2), (cx + w / 2, cy - h / 2), (cx + w / 2, cy + h / 2), (cx - w / 2, cy + h / 2)]
    return fillet_polygon(pts, r, seg)


def thick_polyline(pts, t):
    """Open polyline -> closed band polygon offset t to the left side (mm)."""
    left = []
    n = len(pts)
    for i in range(n):
        p = Vector(pts[i])
        if i == 0:
            d = (Vector(pts[1]) - p).normalized()
        elif i == n - 1:
            d = (p - Vector(pts[i - 1])).normalized()
        else:
            d = ((p - Vector(pts[i - 1])).normalized() + (Vector(pts[i + 1]) - p).normalized()).normalized()
        nrm = Vector((-d.y, d.x))
        left.append(tuple(p + nrm * t))
    return list(pts) + left[::-1]

# ---------------------------------------------------------------- curves

def tube(name, pts, radius, collection=None, material=None, res=6):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius * MM
    cu.bevel_resolution = 3
    cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = Vector(p) * MM
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    sp.resolution_u = res
    ob = bpy.data.objects.new(name, cu)
    (collection or bpy.context.scene.collection).objects.link(ob)
    if material:
        cu.materials.append(material)
    return ob


def text(name, body, size, loc, rot=(90, 0, 0), collection=None, material=None, font=None,
         extrude=0.0, align='CENTER'):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size * MM
    cu.extrude = extrude * MM
    cu.align_x = align
    cu.align_y = 'CENTER'
    if font:
        cu.font = font
    ob = bpy.data.objects.new(name, cu)
    (collection or bpy.context.scene.collection).objects.link(ob)
    ob.location = Vector(loc) * MM
    ob.rotation_euler = [math.radians(a) for a in rot]
    if material:
        cu.materials.append(material)
    return ob


def parent_keep(child, parent):
    mw = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = mw
    return child
