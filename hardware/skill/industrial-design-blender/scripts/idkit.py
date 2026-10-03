"""
idkit — industrial-design helpers for Blender 4.x (bpy), millimetre-native.

1 Blender unit = 1 mm. Every function takes/returns mm and degrees.
Works headless (`blender -b -P build.py` or `python build.py` with the `bpy` wheel).

Typical flow (see ../examples/example_speaker.py):

    import idkit as ik
    ik.reset_scene()
    shell = ik.rounded_box("Body", 90, 90, 60, r_plan=18, r_edge=6)
    ik.apply_draft(shell, parting_z=0, deg=1.0)
    top, bot = ik.clamshell(shell, parting_z=0, wall=2.0, lip_h=2.5, clearance=0.08,
                            reveal=(0.6, 0.4))
    ik.boss_pair(top, bot, (30, 30), parting_z=0, wall=2.0, screw_d=2.5)
    ...
    ik.assign(top, ik.mat_plastic("PC/ABS warm grey", "#8C8984", texture="MT-11010"))
    ik.studio(); ik.render("out/hero.png")
    ik.explode([top, bot, ...], axis=(0,0,1), gap=25); ik.render("out/exploded.png")
    ik.write_report("out/spec.json", parts=[...])

Design intent: booleans are applied immediately so every object stays a plain,
inspectable mesh (no hidden modifier stacks). Keep part counts small; EXACT booleans
on dense meshes are slow — prefer 24–48 segments on radii.
"""
from __future__ import annotations

import json
import math
import os
from typing import Iterable, Sequence

import bpy  # must come first when using the pip `bpy` wheel
import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

SEG = 24  # default bevel/cylinder resolution; raise to 48 for final renders
DIMS = []      # callout dimensions for the viewer/drawing: see dim()
EXPLODE = {}   # explicit explode offsets for the viewer: see explode_hint()


def dim(label, p0, p1, view="front"):
    """Register a callout dimension (Blender mm coords) shown in the 3D viewer's
    Dimensions overlay and on the Drawing sheet in `view` (front | top | right).
    Use for the numbers a reviewer cares about: parting-line height, button pitch,
    grille diameter, wall-to-feature distances."""
    DIMS.append({"label": label, "from": [round(c, 3) for c in p0], "to": [round(c, 3) for c in p1], "view": view})


def explode_hint(obj, offset):
    """Explicit explode offset (mm, Blender axes) for obj at slider = 1 in the viewer."""
    EXPLODE[obj.name] = [float(c) for c in offset]


# ---------------------------------------------------------------- scene ----
def reset_scene(seg: int = 24):
    """Empty the file and set millimetre units."""
    global SEG
    SEG = seg
    DIMS.clear()
    EXPLODE.clear()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    us = sc.unit_settings
    us.system = "METRIC"
    us.scale_length = 0.001
    us.length_unit = "MILLIMETERS"
    return sc


def _link(obj, collection: str | None = None):
    coll = bpy.context.scene.collection
    if collection:
        coll = bpy.data.collections.get(collection) or bpy.data.collections.new(collection)
        if coll.name not in bpy.context.scene.collection.children:
            bpy.context.scene.collection.children.link(coll)
    coll.objects.link(obj)
    return obj


def _obj_from_bm(name: str, bm: bmesh.types.BMesh, collection=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    return _link(ob, collection)


def delete(*objs):
    for o in objs:
        if o and o.name in bpy.data.objects:
            bpy.data.objects.remove(o, do_unlink=True)


def duplicate(obj, name=None):
    ob = obj.copy()
    ob.data = obj.data.copy()
    ob.name = name or obj.name + "_dup"
    for c in obj.users_collection:
        c.objects.link(ob)
    return ob


def apply_mods(obj):
    """Bake the modifier stack into mesh data (context-free)."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    old = obj.data
    obj.modifiers.clear()
    obj.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return obj


def bake_transform(obj):
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    return obj


def smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def finish(objs, angle_deg=30.0):
    """Call once before render/export. Marks edges sharper than angle_deg and adds a
    live face-area Weighted Normal modifier so big flat faces shade dead flat and
    fillets shade smooth (the standard hard-surface shading fix). Not applied, so
    later booleans are unaffected; glTF export applies it."""
    lim = math.radians(angle_deg)
    for o in objs:
        me = o.data
        bm = bmesh.new()
        bm.from_mesh(me)
        for f in bm.faces:
            f.smooth = True
        for ed in bm.edges:
            ed.smooth = not (len(ed.link_faces) == 2 and ed.calc_face_angle(0) > lim)
        bm.to_mesh(me)
        bm.free()
        if not any(m.type == "WEIGHTED_NORMAL" for m in o.modifiers):
            m = o.modifiers.new("wn", "WEIGHTED_NORMAL")
            m.mode = "FACE_AREA"
            m.weight = 50
            m.keep_sharp = True
    return objs


# ---------------------------------------------------------- primitives ----
def _plan_outline(a, b, r, seg, plan="rect", n=4.0):
    """Closed plan outline (CCW) as [(x, y, nx, ny)] for half-extents a, b.
    plan="rect": rounded rectangle, corner radius r (tangent-discontinuous G1).
    plan="squircle": superellipse |x/a|^n + |y/b|^n = 1 (continuous curvature, the
    'Apple corner' look); r is ignored, n≈4–5 reads as a soft squircle."""
    pts = []
    if plan == "squircle":
        N = seg * 4
        for i in range(N):
            t = 2 * math.pi * i / N
            c, s = math.cos(t), math.sin(t)
            x = a * math.copysign(abs(c) ** (2 / n), c)
            y = b * math.copysign(abs(s) ** (2 / n), s)
            gx = math.copysign(abs(x / a) ** (n - 1), x) / a if x else 0.0
            gy = math.copysign(abs(y / b) ** (n - 1), y) / b if y else 0.0
            L = math.hypot(gx, gy) or 1.0
            pts.append((x, y, gx / L, gy / L))
        return pts
    r = max(0.0, min(r, a, b))
    for k, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        cx, cy = sx * (a - r), sy * (b - r)
        for j in range(seg + 1):
            th = math.pi / 2 * k + math.pi / 2 * j / seg
            nx, ny = math.cos(th), math.sin(th)
            p = (cx + r * nx, cy + r * ny, nx, ny)
            if not pts or math.hypot(p[0] - pts[-1][0], p[1] - pts[-1][1]) > 1e-6:
                pts.append(p)
    if math.hypot(pts[0][0] - pts[-1][0], pts[0][1] - pts[-1][1]) < 1e-6:
        pts.pop()
    return pts


def rounded_box(name, x, y, z, r_plan=0.0, r_edge=0.0, center=(0, 0, 0), seg=None,
                plan="rect", n=4.0, r_edge_bottom=None, draft_deg=0.0, parting_z=None,
                collection=None):
    """Clean quad-lofted housing solid, x*y*z mm, centred on `center`.

    r_plan        plan-view corner radius (rect plans)
    plan/n        "rect" or "squircle" (superellipse exponent n)
    r_edge        top perimeter fillet;  r_edge_bottom defaults to r_edge
    draft_deg     side-wall draft, tapering AWAY from parting_z (local z, default 0)
                  so both mold halves release; a vertex ring is placed at the parting
                  plane so the draft breaks exactly there.
    Built ring-by-ring (no bevel booleans) so offsets and EXACT booleans stay robust."""
    seg = seg or SEG
    a, b, h = x / 2, y / 2, z / 2
    rt = min(r_edge, h - 1e-3, r_plan if plan == "rect" and r_plan > 0 else 1e9)
    rb = min(r_edge if r_edge_bottom is None else r_edge_bottom, h - 1e-3,
             r_plan if plan == "rect" and r_plan > 0 else 1e9)
    m = max(3, seg // 3)
    rings = []  # (z, inset)
    if rb > 0:
        rings += [(-h + rb * (1 - math.cos(p)), rb * (1 - math.sin(p)))
                  for p in (math.pi / 2 * i / m for i in range(m + 1))]
    else:
        rings.append((-h, 0.0))
    pz = 0.0 if parting_z is None else parting_z - center[2]
    if draft_deg and -h + rb + 1e-3 < pz < h - rt - 1e-3:
        rings.append((pz, 0.0))
    if rt > 0:
        rings += [(h - rt * (1 - math.cos(p)), rt * (1 - math.sin(p)))
                  for p in (math.pi / 2 * i / m for i in reversed(range(m + 1)))]
    else:
        rings.append((h, 0.0))
    rings.sort(key=lambda t: t[0])
    tn = math.tan(math.radians(draft_deg))
    base = _plan_outline(a, b, r_plan, seg, plan, n)
    bm = bmesh.new()
    loops = []
    for zr, ins in rings:
        ins += abs(zr - pz) * tn
        loops.append([bm.verts.new((px - nx * ins, py - ny * ins, zr)) for px, py, nx, ny in base])
    N = len(base)
    for l0, l1 in zip(loops, loops[1:]):
        for i in range(N):
            j = (i + 1) % N
            bm.faces.new((l0[i], l0[j], l1[j], l1[i]))
    for lp, zc in ((loops[0], rings[0][0]), (loops[-1], rings[-1][0])):
        c = bm.verts.new((0, 0, zc))
        for i in range(N):
            bm.faces.new((c, lp[(i + 1) % N], lp[i]))
    _clean(bm)
    bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
    ob = smooth(_obj_from_bm(name, bm, collection))
    if draft_deg:
        ob["draft_deg"] = draft_deg
    return ob


def _clean(bm, dist=1e-4):
    """Bevel corners leave coincident verts / zero-area faces; they break offsets and
    make EXACT booleans silently no-op. Always clean before offsetting."""
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bmesh.ops.dissolve_degenerate(bm, dist=dist, edges=bm.edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)


def cylinder(name, d, h, center=(0, 0, 0), axis="Z", seg=None, collection=None,
             draft_deg=0.0, root="bottom"):
    """Cylinder d×h. draft_deg tapers it (root end = full d) — use on bosses/pins."""
    seg = seg or max(SEG, 32)
    bm = bmesh.new()
    d2 = d - 2 * h * math.tan(math.radians(draft_deg))
    r1, r2 = (d / 2, d2 / 2) if root == "bottom" else (d2 / 2, d / 2)
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=h)
    if axis == "X":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "Y"))
    elif axis == "Y":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
    bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
    return smooth(_obj_from_bm(name, bm, collection))


def capsule_plan(name, length, width, z, r_edge=0.0, center=(0, 0, 0), collection=None):
    """Stadium/pill in plan (full-round ends) — the classic remote/handheld plan form."""
    return rounded_box(name, length, width, z, r_plan=width / 2 - 1e-3, r_edge=r_edge,
                       center=center, collection=collection)


def box(name, x, y, z, center=(0, 0, 0), rot_z_deg=0.0, collection=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(x, y, z), verts=bm.verts)
    if rot_z_deg:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0),
                         matrix=Matrix.Rotation(math.radians(rot_z_deg), 3, "Z"))
    bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
    return _obj_from_bm(name, bm, collection)


# ------------------------------------------------------------ booleans ----
def boolean(target, cutter, op="DIFFERENCE", keep_cutter=False, solver="EXACT"):
    m = target.modifiers.new("bool", "BOOLEAN")
    m.operation = op
    m.solver = solver
    m.object = cutter
    apply_mods(target)
    if not keep_cutter:
        delete(cutter)
    return target


def union_all(name, objs: Sequence):
    base = objs[0]
    for o in objs[1:]:
        boolean(base, o, "UNION")
    base.name = name
    return base


def join(name, objs: Sequence):
    """Cheap mesh join (no boolean) — use for batching many cutters into one."""
    bm = bmesh.new()
    for o in objs:
        me = o.data.copy()
        me.transform(o.matrix_world)
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    delete(*objs)
    return _obj_from_bm(name, bm)


def slab(z0, z1, size=2000.0, name="slab"):
    return box(name, size, size, z1 - z0, center=(0, 0, (z0 + z1) / 2))


def clip_z(obj, z0, z1):
    """Keep only the part of obj between z0 and z1."""
    return boolean(obj, slab(z0, z1), "INTERSECT")


# --------------------------------------------------------------- offset ----
def offset_solid(obj, d, name=None):
    """Return a new object offset along vertex normals by d (negative = inward),
    with even-thickness correction. Good for smooth/beveled closed solids."""
    ob = duplicate(obj, name or obj.name + f"_off{d:+.2f}")
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.normal_update()
    moves = []
    for v in bm.verts:
        n = v.normal
        if n.length < 1e-9:
            moves.append(Vector())
            continue
        cos_min = min((max(0.2, n.dot(f.normal)) for f in v.link_faces), default=1.0)
        moves.append(n * (d / cos_min))
    for v, mv in zip(bm.verts, moves):
        v.co += mv
    bm.to_mesh(ob.data)
    bm.free()
    return ob


def hollow(obj, wall):
    """Shell a closed solid inward to `wall` mm (in place)."""
    inner = offset_solid(obj, -wall)
    return boolean(obj, inner, "DIFFERENCE")


# ---------------------------------------------------------------- draft ----
def apply_draft(obj, parting_z=0.0, deg=1.0, axis="Z"):
    """Taper an EXISTING mesh's side walls away from the parting plane (adds a loop
    at the plane first). Prefer rounded_box(..., draft_deg=, parting_z=) for housings.
    Verts move toward the pull axis by |z - parting_z| * tan(deg). Apply to the
    exterior solid BEFORE hollowing so the inner wall inherits the same draft
    (uniform wall). Corners keep their radius because the offset is uniform."""
    t = math.tan(math.radians(deg))
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-4,
                           plane_co=(0, 0, parting_z), plane_no=(0, 0, 1))
    bm.to_mesh(obj.data)
    bm.free()
    for v in obj.data.vertices:
        dz = abs(v.co.z - parting_z)
        dx = math.copysign(min(abs(v.co.x), dz * t), v.co.x) if abs(v.co.x) > 1e-6 else 0
        dy = math.copysign(min(abs(v.co.y), dz * t), v.co.y) if abs(v.co.y) > 1e-6 else 0
        v.co.x -= dx
        v.co.y -= dy
    obj.data.update()
    return obj


# ------------------------------------------------------------ clamshell ----
def clamshell(solid, parting_z, wall=2.0, lip_h=None, clearance=0.08, reveal=None,
              names=("Top_Housing", "Bottom_Housing")):
    """Split a closed exterior solid into two hollow housings with a step lip.

    - wall:      nominal wall (mm). Consumer electronics PC/ABS: 1.5–2.5.
    - lip_h:     lip engagement height, default 1.2*wall.
    - clearance: per-side gap between lip and step (0.05–0.10 typical).
    - reveal:    (width, depth) of a cosmetic shadow-line groove centred on the
                 parting line, e.g. (0.6, 0.4). Hides step/mismatch between halves.
    Lip lives on the BOTTOM part (inner half of wall), step is cut in the TOP part.
    Returns (top, bottom)."""
    lip_h = lip_h or 1.2 * wall
    ext = solid
    inner = offset_solid(ext, -wall, "inner")
    half_out = offset_solid(ext, -(wall / 2 + clearance / 2), "half_out")
    half_in = offset_solid(ext, -(wall / 2 - clearance / 2), "half_in")
    deep = offset_solid(ext, -(wall + 0.5), "deep")

    shell = duplicate(ext, "shell")
    boolean(shell, inner, keep_cutter=True)  # hollow

    top = duplicate(shell, names[0])
    bot = duplicate(shell, names[1])
    delete(shell)
    clip_z(top, parting_z, 1e5)
    clip_z(bot, -1e5, parting_z)

    # lip ring on bottom: between half_out and inner, z in [pz, pz+lip_h]
    lip = duplicate(half_out, "lip")
    boolean(lip, duplicate(inner, "inner_c"))
    clip_z(lip, parting_z - 0.01, parting_z + lip_h)
    boolean(bot, lip, "UNION")

    # step cut in top: between half_in and deep, z in [pz, pz+lip_h+clearance]
    step = duplicate(half_in, "step")
    boolean(step, duplicate(deep, "deep_c"))
    clip_z(step, parting_z - 0.5, parting_z + lip_h + clearance)
    boolean(top, step, "DIFFERENCE")

    if reveal:
        w, dpt = reveal
        band = duplicate(ext, "rev")
        boolean(band, offset_solid(ext, -dpt, "rev_in"))
        clip_z(band, parting_z - w / 2, parting_z + w / 2)
        boolean(top, duplicate(band, "rev_t"))
        boolean(bot, band)

    delete(inner, half_out, half_in, deep)
    for o in (top, bot):
        smooth(o)
        o["process"] = "Injection molded"
        o["wall_mm"] = wall
    return top, bot


def raycast_z(obj, x, y, from_above=True):
    """Z of obj's surface at (x, y) seen from above/below, or None."""
    bvh = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
    dirn = Vector((0, 0, -1 if from_above else 1))
    for r in (0, 1, 2, 3.5, 5, 7):  # ring fallback when (x, y) sits over a hole
        zs = []
        for k in range(1 if r == 0 else 8):
            a = k * math.pi / 4
            hit = bvh.ray_cast(Vector((x + r * math.cos(a), y + r * math.sin(a),
                                       1e4 if from_above else -1e4)), dirn)
            if hit[0]:
                zs.append(hit[0].z)
        if zs:
            return max(zs) if from_above else min(zs)
    return None


def inner_z(obj, x, y, from_above=True):
    """Z of the inside surface (2nd hit) at (x, y)."""
    bvh = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
    dirn = Vector((0, 0, -1 if from_above else 1))
    o = Vector((x, y, 1e4 if from_above else -1e4))
    hit = bvh.ray_cast(o, dirn)
    if not hit[0]:
        return None
    hit2 = bvh.ray_cast(hit[0] + dirn * 0.01, dirn)
    return hit2[0].z if hit2[0] else None


# --------------------------------------------------- internal features ----
def boss_pair(top, bot, xy, parting_z, wall=2.0, screw_d=2.5, gussets=4, head_d=None,
              meet_gap=0.0):
    """Hidden-fastener clamshell joint: screw enters from the BOTTOM (under a foot
    or label), passes a clearance tower, and threads into a pilot boss in the TOP.

    Thread-forming screw (PT/Delta PT style) starting points — confirm with the
    screw supplier's data for the actual resin:
      pilot  ≈ 0.8 × d        boss OD ≈ 2.0–2.5 × d
      engagement ≥ 2 × d      clearance hole ≈ d + 0.3
    """
    x, y = xy
    head_d = head_d or 2.0 * screw_d
    od = 2.3 * screw_d
    pilot = 0.8 * screw_d
    ceil = inner_z(top, x, y, from_above=True)
    floor = inner_z(bot, x, y, from_above=False)
    outer_bot = raycast_z(bot, x, y, from_above=False)
    if ceil is None or floor is None:
        raise ValueError(f"boss at {xy} is outside the housing")
    zm = parting_z + meet_gap
    # top pilot boss
    tb = cylinder("tboss", od, ceil - zm + 0.3, center=(x, y, (ceil + 0.3 + zm) / 2),
                  draft_deg=0.5, root="top")
    boolean(top, tb, "UNION")
    boolean(top, cylinder("pilot", pilot, ceil - zm - 0.6, center=(x, y, (ceil - 0.6 + zm) / 2)))
    # bottom clearance tower + counterbore
    bb = cylinder("bboss", od + 0.4, zm - floor + 0.3 - 0.05,
                  center=(x, y, (zm - 0.05 + floor - 0.3) / 2), draft_deg=0.5, root="bottom")
    boolean(bot, bb, "UNION")
    boolean(bot, cylinder("clr", screw_d + 0.3, 1e3, center=(x, y, 0)))
    cb_depth = (floor - outer_bot) * 0.6 + 1.0
    boolean(bot, cylinder("cbore", head_d + 0.4, cb_depth * 2, center=(x, y, outer_bot)))
    if gussets:
        gh = min(0.6 * (ceil - zm), 6)
        gl = od / 2 + 2.0
        g_t = 0.6 * wall
        cut = []
        for i in range(gussets):
            a = 360 / gussets * i + 45
            ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
            cut.append(box("g", gl, g_t, gh, center=(x + ca * gl / 2, y + sa * gl / 2, ceil - gh / 2),
                           rot_z_deg=a))
        g = join("gussets", cut)
        clip_z(g, zm + 0.5, ceil + 0.3)
        boolean(top, g, "UNION")
    for o, spec in ((top, "pilot boss"), (bot, "clearance tower")):
        lst = json.loads(o.get("fasteners", "[]"))
        lst.append({"xy": [x, y], "screw": f"thread-forming Ø{screw_d}", "feature": spec,
                    "boss_od": round(od, 2), "pilot": round(pilot, 2)})
        o["fasteners"] = json.dumps(lst)


def rib(part, p0, p1, height, thickness, from_ceiling=True):
    """Straight rib between two XY points, hanging from the ceiling (top part) or
    rising from the floor (bottom part). Thickness ≈ 0.5–0.6 × wall; height ≤ 3 × wall."""
    (x0, y0), (x1, y1) = p0, p1
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    L = math.hypot(x1 - x0, y1 - y0)
    ang = math.degrees(math.atan2(y1 - y0, x1 - x0))
    z_ref = inner_z(part, mx, my, from_above=from_ceiling)
    zc = z_ref - height / 2 + 0.2 if from_ceiling else z_ref + height / 2 - 0.2
    r = box("rib", L, thickness, height + 0.4, center=(mx, my, zc), rot_z_deg=ang)
    return boolean(part, r, "UNION")


def aperture_button(shell, xy, size, shape="round", gap=0.15, proud=0.6, flange=0.8,
                    cap_name="Button_Cap", corner_r=None):
    """Cut an opening in `shell` from above and create a matching button cap.
    gap:    per-side clearance cap↔opening (0.10–0.20 typical for molded parts).
    proud:  how far the cap stands above the surrounding surface (negative = recessed).
    flange: retention skirt under the wall (stops the cap falling out)."""
    x, y = xy
    zs = raycast_z(shell, x, y, True)
    zi = inner_z(shell, x, y, True)
    t = zs - zi
    w, l = (size, size) if isinstance(size, (int, float)) else size
    if shape == "round":
        cutter = cylinder("ap", w + 2 * gap, t * 4, center=(x, y, zs))
        cap = cylinder(cap_name, w, t + proud + 0.01, center=(x, y, zi + (t + proud) / 2))
        fl = cylinder("fl", w + 2 * flange, 0.8, center=(x, y, zi - 0.4 - 0.05))
    else:
        rr = corner_r if corner_r is not None else min(w, l) * 0.25
        cutter = rounded_box("ap", w + 2 * gap, l + 2 * gap, t * 4, r_plan=rr + gap, center=(x, y, zs))
        cap = rounded_box(cap_name, w, l, t + proud, r_plan=rr, r_edge=min(0.4, (t + proud) / 3),
                          center=(x, y, zi + (t + proud) / 2))
        fl = rounded_box("fl", w + 2 * flange, l + 2 * flange, 0.8, r_plan=rr + flange,
                         center=(x, y, zi - 0.4 - 0.05))
    boolean(shell, cutter)
    boolean(cap, fl, "UNION")
    cap["process"] = "Injection molded"
    cap["gap_mm"] = gap
    return cap


def perforate(shell, center_xy, radius, hole_d=1.2, pitch=2.2, from_above=True, pattern="hex"):
    """Speaker/vent perforation: hex-packed holes within a circle, one boolean."""
    cx, cy = center_xy
    holes = []
    row = 0
    yv = -radius
    while yv <= radius:
        off = (pitch / 2) if (pattern == "hex" and row % 2) else 0
        xv = -radius + off
        while xv <= radius:
            if math.hypot(xv, yv) <= radius - hole_d / 2:
                holes.append(cylinder("h", hole_d, 200, center=(cx + xv, cy + yv, 0), seg=12))
            xv += pitch
        yv += pitch * (math.sqrt(3) / 2 if pattern == "hex" else 1)
        row += 1
    if holes:
        boolean(shell, join("holes", holes))
    shell["perforation"] = f"{len(holes)} × Ø{hole_d} @ {pitch} pitch"
    return len(holes)


def foot(bot, xy, d=8.0, h=1.2, recess=0.6, name="Foot_TPE"):
    """Recessed TPE foot pad on the underside."""
    x, y = xy
    zb = raycast_z(bot, x, y, from_above=False)
    boolean(bot, cylinder("fr", d + 0.3, recess * 2, center=(x, y, zb)))
    f = cylinder(name, d, h, center=(x, y, zb + recess - h / 2))
    f["process"] = "TPE (die-cut or molded), Shore A 50–70"
    return f


# ------------------------------------------------------------ analysis ----
def _is_exterior(bvh, f, centre, diag):
    """Cosmetic-skin test that also works for open shells (housings, covers, saddles): the face's outward
    ray must escape the part AND its normal must point away from the part's centre. Without the second
    condition, inner faces of an open shell count as skin because their rays leave through the opening."""
    if (f.center - centre).dot(f.normal) <= 0:
        return False
    return bvh.ray_cast(f.center + f.normal * 0.02, f.normal, diag)[0] is None


def draft_report(obj, pull=(0, 0, 1), min_deg=0.5, tol_deg=0.05):
    """Draft check relative to the pull axis, split so features don't mask (or fake) a skin problem.

    exterior   faces whose outward normal escapes the part (the cosmetic skin) — this is the number
               to hold near 0 %.
    features   inward-facing side walls: lip, boss and rib sides, apertures, perforations. Through-holes
               and short apertures are often formed by zero-draft core pins, so a non-zero value here is
               expected; list it rather than hide it.
    A face is under-drafted if its angle to the pull axis is below (min_deg - tol_deg); the tolerance
    stops 0.5° bosses failing a 0.5° check on floating-point noise.
    Read percentages together with the *_flagged_mm2 areas: for parts pulled on a diagonal, almost all of the
    skin is at ≥30° and only narrow end/shut-off faces count as "side walls", so a high % can be a sliver."""
    p = Vector(pull).normalized()
    s = math.sin(math.radians(max(0.0, min_deg - tol_deg)))
    bvh = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
    diag = Vector(obj.dimensions).length or 1.0
    centre = sum((Vector(c) for c in obj.bound_box), Vector()) / 8
    acc = {"exterior": [0.0, 0.0], "features": [0.0, 0.0]}
    obj.data.calc_loop_triangles()
    for f in obj.data.loop_triangles:
        d = abs(f.normal.dot(p))
        if d >= 0.5:  # caps/floors, not side walls
            continue
        k = "exterior" if _is_exterior(bvh, f, centre, diag) else "features"
        acc[k][0] += f.area
        if d < s:
            acc[k][1] += f.area
    pct = lambda t, b: round(100 * b / t, 1) if t else 0.0
    tot = acc["exterior"][0] + acc["features"][0]
    bad = acc["exterior"][1] + acc["features"][1]
    return {"part": obj.name, "min_draft_deg": min_deg,
            "side_area_mm2": round(tot, 1), "under_drafted_pct": pct(tot, bad),
            "exterior_area_mm2": round(acc["exterior"][0], 1), "exterior_under_drafted_pct": pct(*acc["exterior"]),
            "exterior_flagged_mm2": round(acc["exterior"][1], 1),
            "feature_area_mm2": round(acc["features"][0], 1), "feature_under_drafted_pct": pct(*acc["features"]),
            "feature_flagged_mm2": round(acc["features"][1], 1),
            "surface_area_mm2": round(sum(f.area for f in obj.data.polygons), 1)}


def wall_report(obj, nominal, samples=600, seed=1):
    """Ray-sample local wall thickness inward from points spread uniformly by AREA over the surface
    (per-polygon sampling over-weights fillets and small features). Flags thick sections
    (>1.3× nominal → sink/void risk) and thin (<0.6× → short-shot risk).
    `skin_*` repeats the stats for points on the exterior (cosmetic) skin only — rays from ribs, bosses and
    lips measure the feature, not the wall. A skin ray that runs into a rib root reads wall + rib height;
    that's the classic sink location, so a few % thick on the skin is expected where ribs meet it."""
    import random
    rnd = random.Random(seed)
    bvh = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
    diag = Vector(obj.dimensions).length or 1.0
    centre = sum((Vector(c) for c in obj.bound_box), Vector()) / 8
    me = obj.data
    me.calc_loop_triangles()  # proper triangulation: boolean results leave concave n-gons a fan would cut wrongly
    V = me.vertices
    tris = [(lt.area, V[lt.vertices[0]].co, V[lt.vertices[1]].co, V[lt.vertices[2]].co, lt)
            for lt in me.loop_triangles if lt.area > 1e-9]
    if not tris:
        return {"part": obj.name, "samples": 0}
    total = sum(t[0] for t in tris)
    cum, acc_ = [], 0.0
    for t in tris:
        acc_ += t[0]; cum.append(acc_)
    import bisect
    vals, skin = [], []
    for _ in range(samples):
        ar, a, b, c, f = tris[min(bisect.bisect_left(cum, rnd.random() * total), len(tris) - 1)]
        u, v = rnd.random(), rnd.random()
        if u + v > 1:
            u, v = 1 - u, 1 - v
        pt = a + (b - a) * u + (c - a) * v
        hit = bvh.ray_cast(pt - f.normal * 0.01, -f.normal, nominal * 5)
        if hit[0] is None:
            continue
        t = hit[3] + 0.01
        vals.append(t)
        if (pt - centre).dot(f.normal) > 0 and bvh.ray_cast(pt + f.normal * 0.02, f.normal, diag)[0] is None:
            skin.append(t)
    if not vals:
        return {"part": obj.name, "samples": 0}

    def stats(v):
        v = sorted(v); n = len(v)
        return {"samples": n, "p10": round(v[n // 10], 2), "median": round(v[n // 2], 2), "p90": round(v[9 * n // 10], 2),
                "thick_pct": round(100 * sum(x > 1.3 * nominal for x in v) / n, 1),
                "thin_pct": round(100 * sum(x < 0.6 * nominal for x in v) / n, 1)}
    out = {"part": obj.name, "nominal_mm": nominal, **stats(vals)}
    if skin:
        out.update({f"skin_{k}": v for k, v in stats(skin).items()})
    return out


def dims(obj):
    bb = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    mn = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
    mx = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
    return [round(a, 2) for a in (mx - mn)]


def volume_cm3(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    v = bm.calc_volume(signed=False)
    bm.free()
    return round(v / 1000, 2)


def is_manifold(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    ok = all(e.is_manifold for e in bm.edges)
    bm.free()
    return ok


# ----------------------------------------------------------------- CMF ----
DENSITY = {"PC/ABS": 1.15, "ABS": 1.05, "PC": 1.20, "PA66-GF30": 1.36, "PP": 0.90,
           "TPE": 1.10, "TPU": 1.20, "PMMA": 1.19, "Al6063": 2.70, "Al6061": 2.70,
           "Zn-Zamak3": 6.60, "SS304": 7.93, "Glass": 2.50, "Silicone": 1.15, "Fabric": 0.40}


def _hex(h):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), 1.0)


def _principled(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    return m, nt, bsdf


def _bump(nt, bsdf, scale, strength, detail=2.0, kind="noise"):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    if kind == "voronoi":
        tex = nt.nodes.new("ShaderNodeTexVoronoi")
        tex.inputs["Scale"].default_value = scale
        src = tex.outputs["Distance"]
    elif kind == "wave":
        tex = nt.nodes.new("ShaderNodeTexWave")
        tex.inputs["Scale"].default_value = scale
        tex.inputs["Distortion"].default_value = 0.5
        src = tex.outputs["Fac"]
    else:
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = scale
        tex.inputs["Detail"].default_value = detail
        src = tex.outputs["Fac"]
    nt.links.new(tc.outputs["Object"], tex.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = 0.02
    nt.links.new(src, bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


# texture presets approximate the look of common mold-texture families.
TEXTURES = {
    "SPI-A2": dict(rough=0.04, bump=None),                 # high polish / piano gloss
    "SPI-B1": dict(rough=0.18, bump=None),                 # semi-gloss
    "SPI-C1": dict(rough=0.38, bump=(8.0, 0.05)),          # stone matte
    "MT-11000": dict(rough=0.42, bump=(6.0, 0.08)),        # very fine matte (≈1° extra draft)
    "MT-11010": dict(rough=0.52, bump=(4.0, 0.12)),        # fine matte (≈1.5°)
    "MT-11020": dict(rough=0.62, bump=(2.5, 0.18)),        # medium matte (≈3°)
    "VDI-27": dict(rough=0.55, bump=(3.0, 0.15)),          # EDM spark finish, medium
    "VDI-33": dict(rough=0.68, bump=(1.8, 0.25)),          # coarse
}


def mat_plastic(name, color_hex, texture="MT-11010", coat=0.0):
    m, nt, b = _principled(name)
    t = TEXTURES.get(texture, TEXTURES["MT-11010"])
    b.inputs["Base Color"].default_value = _hex(color_hex)
    b.inputs["Roughness"].default_value = t["rough"]
    b.inputs["Coat Weight"].default_value = coat
    if t["bump"]:
        _bump(nt, b, *t["bump"])
    m["cmf"] = f"Plastic {color_hex} {texture}"
    return m


def mat_softtouch(name, color_hex):
    m, nt, b = _principled(name)
    b.inputs["Base Color"].default_value = _hex(color_hex)
    b.inputs["Roughness"].default_value = 0.78
    b.inputs["Sheen Weight"].default_value = 0.25
    _bump(nt, b, 10.0, 0.05)
    m["cmf"] = f"TPE / soft-touch {color_hex}"
    return m


def mat_anodized(name, color_hex, finish="bead-blast"):
    m, nt, b = _principled(name)
    b.inputs["Base Color"].default_value = _hex(color_hex)
    b.inputs["Metallic"].default_value = 1.0
    b.inputs["Roughness"].default_value = {"bead-blast": 0.35, "brushed": 0.25, "polished": 0.08}.get(finish, 0.35)
    if finish == "brushed":
        b.inputs["Anisotropic"].default_value = 0.8
    _bump(nt, b, 40.0, 0.04)
    m["cmf"] = f"Anodized Al {color_hex} {finish}"
    return m


def mat_fabric(name, color_hex):
    m, nt, b = _principled(name)
    b.inputs["Base Color"].default_value = _hex(color_hex)
    b.inputs["Roughness"].default_value = 0.9
    b.inputs["Sheen Weight"].default_value = 0.6
    _bump(nt, b, 1.2, 0.35, kind="wave")
    m["cmf"] = f"Knit fabric {color_hex}"
    return m


def mat_clear(name, tint_hex="#FFFFFF", rough=0.02, smoked=0.0):
    m, nt, b = _principled(name)
    b.inputs["Base Color"].default_value = _hex(tint_hex)
    b.inputs["Transmission Weight"].default_value = 1.0 - smoked
    b.inputs["Roughness"].default_value = rough
    b.inputs["IOR"].default_value = 1.49
    m["cmf"] = f"PMMA/PC clear {tint_hex} smoked={smoked}"
    return m


def mat_emissive(name, color_hex="#FFFFFF", strength=4.0):
    m, nt, b = _principled(name)
    b.inputs["Emission Color"].default_value = _hex(color_hex)
    b.inputs["Emission Strength"].default_value = strength
    return m


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    obj["cmf"] = mat.get("cmf", mat.name)
    return obj


# -------------------------------------------------------------- render ----
def _emitter(name, w, h, loc, look_at, strength):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    bmesh.ops.scale(bm, vec=(w, h, 1), verts=bm.verts)
    ob = _obj_from_bm(name, bm, "Studio")
    ob.location = loc
    d = Vector(look_at) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    m, nt, b = _principled(name + "_m")
    b.inputs["Base Color"].default_value = (0, 0, 0, 1)
    b.inputs["Emission Color"].default_value = (1, 1, 1, 1)
    b.inputs["Emission Strength"].default_value = strength
    ob.data.materials.append(m)
    ob.visible_camera = False
    return ob


def studio(objs=None, backdrop_hex=None, key=6.0, fill=1.5, rim=8.0, world=0.15, preset="studio"):
    """Scale-independent studio: emissive softboxes (radiance doesn't fall off with
    unit scale), a curved sweep, and a camera framed to the parts.
    preset: "studio" (light sweep) | "graphite" (dark sweep) | "desk" (oak top + warm
    wall) | "shelf" (pale shelf board against a sage wall) — matches the viewer's scenes."""
    backdrop_hex = backdrop_hex or {"graphite": "#2A2C2F", "desk": "#E9E3D8", "shelf": "#C9D0C6"}.get(preset, "#E9E7E3")
    if preset == "graphite":
        key, fill, rim = key * 1.3, fill * 0.6, rim * 1.2
    objs = objs or [o for o in bpy.context.scene.objects if o.type == "MESH"]
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (mn + mx) / 2
    R = max((mx - mn).length / 2, 10)
    for o in list(bpy.data.collections.get("Studio").objects) if bpy.data.collections.get("Studio") else []:
        delete(o)
    # sweep: open L-profile with a large cove, extruded along X (front stays open)
    z0, Rs = mn.z - (R * 0.26 if preset in ("desk", "shelf") else 0.01), R * 6
    back = c.y + R * 2.5 + Rs  # cove starts well behind the product
    prof = [(y, z0) for y in (back - R * 60, back - Rs)]
    prof += [(back - Rs + Rs * math.sin(a), z0 + Rs - Rs * math.cos(a))
             for a in (math.pi / 2 * i / 16 for i in range(1, 17))]
    prof.append((back, z0 + R * 40))
    bm = bmesh.new()
    rows = [[bm.verts.new((xx, y, z)) for (y, z) in prof] for xx in (c.x - R * 40, c.x + R * 40)]
    for i in range(len(prof) - 1):
        bm.faces.new((rows[0][i], rows[1][i], rows[1][i + 1], rows[0][i + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    sw = smooth(_obj_from_bm("Sweep", bm, "Studio"))
    m, nt, b = _principled("Sweep_m")
    b.inputs["Base Color"].default_value = _hex(backdrop_hex)
    b.inputs["Roughness"].default_value = 0.9
    sw.data.materials.append(m)
    if preset in ("desk", "shelf"):
        wood = "#B98E5E" if preset == "desk" else "#D8C2A0"
        w_, d_ = (R * 8, R * 5) if preset == "desk" else (R * 9, (mx.y - mn.y) + R * 0.9)
        th = R * (0.25 if preset == "desk" else 0.1)
        top = box("Surface", w_, d_, th, center=(c.x, c.y if preset == "desk" else mn.y - R * 0.25 + d_ / 2, mn.z - th / 2 - 0.02))
        for coll in top.users_collection:
            coll.objects.unlink(top)
        _link(top, "Studio")
        m2, nt2, b2 = _principled("Surface_m")
        b2.inputs["Base Color"].default_value = _hex(wood)
        b2.inputs["Roughness"].default_value = 0.55
        _bump(nt2, b2, 0.08, 0.25, kind="wave")
        top.data.materials.append(m2)
    _emitter("Key", R * 4, R * 4, c + Vector((-R * 3, -R * 3, R * 4)), c, key)
    _emitter("Fill", R * 5, R * 3, c + Vector((R * 4, -R * 2, R * 1)), c, fill)
    _emitter("Rim", R * 4, R * 1.2, c + Vector((R * 1, R * 4, R * 3)), c, rim)
    _emitter("Top", R * 4, R * 4, c + Vector((0, 0, R * 6)), c, key * 0.4)
    # world
    w = bpy.data.worlds.new("W")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[1].default_value = world
    bpy.context.scene.world = w
    # camera
    cam = bpy.data.objects.get("Cam")
    if not cam:
        cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
        _link(cam, "Studio")
    bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = 1200, 900
    cam.data.lens = 85
    cam.data.clip_start = 1
    cam.data.clip_end = R * 200
    set_view(cam, c, R)
    bpy.context.scene.camera = cam
    return cam


def set_view(cam, target, R, az_deg=-35, el_deg=25, fill=0.75):
    """Place camera on a sphere around target, fitted so the part fills `fill` of frame."""
    r = bpy.context.scene.render
    short = 36 * min(r.resolution_x, r.resolution_y) / max(r.resolution_x, r.resolution_y)
    lens_fov = 2 * math.atan(short / 2 / cam.data.lens)  # fit to the short side
    dist = R / math.tan(lens_fov / 2) / fill
    az, el = math.radians(az_deg), math.radians(el_deg)
    pos = Vector(target) + dist * Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    cam.location = pos
    cam.rotation_euler = (Vector(target) - pos).to_track_quat("-Z", "Y").to_euler()


def frame(objs, az_deg=-35, el_deg=25, fill=0.75):
    cam = bpy.context.scene.camera
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    set_view(cam, (mn + mx) / 2, (mx - mn).length / 2, az_deg, el_deg, fill)


def _gpu_device():
    """Use the fastest available Cycles backend (Metal / OptiX / CUDA / HIP / oneAPI); fall back to CPU.
    Forcing CPU made every still several times slower on GPU machines (e.g. Apple silicon)."""
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for backend in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
            try:
                prefs.compute_device_type = backend
            except TypeError:
                continue
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type != "CPU"]
            if gpus:
                for d in prefs.devices:
                    d.use = True
                return "GPU"
    except Exception:
        pass
    return "CPU"


def render(path, res=(1200, 900), samples=32):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = _gpu_device()
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.max_bounces = 6
    try:
        sc.cycles.use_denoising = True
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    sc.render.filepath = os.path.abspath(path)
    bpy.ops.render.render(write_still=True)
    return path


def explode(objs: Iterable, axis=(0, 0, 1), gap=20.0, order=None):
    """Offset parts along `axis` for an exploded view. `order` = list of step
    indices (same length as objs); default spreads them symmetrically."""
    objs = list(objs)
    a = Vector(axis).normalized()
    order = order or [i - (len(objs) - 1) / 2 for i in range(len(objs))]
    saved = {o.name: o.location.copy() for o in objs}
    for o, k in zip(objs, order):
        o.location = o.location + a * gap * k
    return saved


def restore(saved):
    for n, loc in saved.items():
        bpy.data.objects[n].location = loc


# -------------------------------------------------------------- export ----
def export_glb(path, objs=None, draco=False):
    """GLB for the viewer. draco=True compresses meshes (the viewer decodes it) — use it for
    products with many parts or dense meshes so the packaged viewer stays under ~14 MB."""
    objs = objs or [o for o in bpy.context.scene.objects if o.type == "MESH" and
                    not any(c.name == "Studio" for c in o.users_collection)]
    for o in bpy.context.scene.objects:
        o.select_set(o in objs)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(path), use_selection=True,
                              export_yup=True, export_apply=True,
                              export_draco_mesh_compression_enable=draco,
                              export_draco_mesh_compression_level=6)
    return path


def write_report(path, parts, extra=None):
    """parts: list of dicts {obj, material_code, process, notes}. Adds dims,
    volume, est. mass, manifold check, draft + wall analysis from object props."""
    rows = []
    for p in parts:
        o = p["obj"]
        mat = p.get("material_code", "PC/ABS")
        vol = volume_cm3(o)
        row = {"part": o.name, "process": p.get("process", o.get("process", "")),
               "material": mat, "cmf": o.get("cmf", ""), "bbox_mm": dims(o),
               "volume_cm3": vol, "mass_g": round(vol * DENSITY.get(mat, 1.1), 1),
               "manifold": is_manifold(o), "notes": p.get("notes", "")}
        if o.get("wall_mm"):
            row["wall"] = wall_report(o, o["wall_mm"])
            row["draft"] = draft_report(o, min_deg=p.get("min_draft", 0.5))
        if o.get("fasteners"):
            row["fasteners"] = json.loads(o["fasteners"])
        for k in ("gap_mm", "perforation"):
            if o.get(k) is not None:
                row[k] = o[k]
        rows.append(row)
    data = {"units": "mm", "parts": rows, "dims": DIMS, "explode": EXPLODE, **(extra or {})}
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    return data


def save_blend(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(path))
