"""Procedural agar plates (colour, height, surface maps + 3D scatter data) for the render dishes.

These are SYNTHETIC illustrations of macroscopic colony morphology, used only for product renders. v6 builds each
colony from the zones a mycologist reads on a 5–7 day plate (25 °C, SDA/PDA):

  submerged fringe  → fine radial hyphae just under the agar surface, past the visible edge
  young margin      → white, non-sporulating mycelium (width is species-specific)
  sporulating body  → the conidial colour, with daily zonation rings and radial furrows (sulcate)
  aged centre       → darker / smokier conidia, raised umbo or folded (cerebriform) centre
  reverse pigment   → diffusible pigment that stains the agar around and under the colony

Neighbouring colonies stop at a thin barrier line instead of overlapping. Besides the maps, each plate returns
per-texel aerial-mycelium density/length (for hair), conidial-head density (for instanced heads) and exudate droplets.
They are not photographs or data.
"""
import numpy as np

AGAR = (.86, .77, .55)   # PDA/SDA: pale straw-amber, translucent

# myc: young mycelium / margin · spore: conidial colour · old: aged centre · rev: (colour, strength, spread in dish radii)
# margin: white zone width (fraction of R) · fringe: submerged fringe reach past R · zon: zonation amplitude
# furrows: (count, depth mm) · wrinkle: cerebriform centre (mm) · gran: granular conidial heads · h0: height mm
# profile: plateau | dome | umbo | yeast · rough: surface roughness · sheen: velvet sheen
# fuzz: aerial mycelium density · fuzzlen: aerial mycelium length (mm) · heads: instanced conidial heads · drops: exudate
SPECIES = {
    'aspergillus_niger': dict(myc=(.95, .92, .78), spore=(.085, .075, .062), old=(.05, .045, .04), rev=((.93, .82, .42), .30, .10),
                              margin=.07, fringe=.07, zon=.04, furrows=(0, 0), wrinkle=0, gran=.7, h0=.9, profile='plateau',
                              rough=.95, sheen=.15, fuzz=.18, fuzzlen=.7, heads=1.0, drops=None),
    'aspergillus_fumigatus': dict(myc=(.95, .95, .92), spore=(.34, .50, .46), old=(.30, .37, .36), rev=None,
                                  margin=.07, fringe=.05, zon=.06, furrows=(0, 0), wrinkle=.10, gran=.25, h0=.5, profile='plateau',
                                  rough=.93, sheen=.65, fuzz=.04, fuzzlen=.4, heads=0, drops=None),
    'aspergillus_flavus': dict(myc=(.95, .94, .84), spore=(.66, .70, .30), old=(.48, .52, .22), rev=((.86, .74, .42), .15, .08),
                               margin=.10, fringe=.06, zon=.14, furrows=(14, .25), wrinkle=0, gran=.6, h0=.8, profile='plateau',
                               rough=.93, sheen=.4, fuzz=.08, fuzzlen=.5, heads=0, drops=None),
    'penicillium': dict(myc=(.97, .97, .95), spore=(.24, .50, .46), old=(.27, .41, .39), rev=((.96, .80, .22), .40, .22),
                        margin=.14, fringe=.05, zon=.16, furrows=(11, .45), wrinkle=.25, gran=.15, h0=1.0, profile='umbo',
                        rough=.9, sheen=.6, fuzz=.04, fuzzlen=.4, heads=0, drops=((.96, .78, .22), 22)),
    'cladosporium': dict(myc=(.44, .47, .35), spore=(.27, .29, .20), old=(.15, .155, .11), rev=((.14, .16, .11), .50, .06),
                         margin=.04, fringe=.03, zon=.05, furrows=(8, .35), wrinkle=.7, gran=.12, h0=1.3, profile='dome',
                         rough=.9, sheen=.7, fuzz=.08, fuzzlen=.4, heads=0, drops=None),
    'fusarium': dict(myc=(.98, .96, .97), spore=(.94, .84, .91), old=(.80, .58, .76), rev=((.60, .30, .58), .45, .28),
                     margin=.45, fringe=.10, zon=.05, furrows=(0, 0), wrinkle=0, gran=0, h0=1.6, profile='dome',
                     rough=.95, sheen=.5, fuzz=1.0, fuzzlen=3.2, heads=0, drops=None),
    'rhizopus': dict(myc=(.92, .92, .90), spore=(.84, .84, .82), old=(.74, .74, .72), rev=None,
                     margin=.6, fringe=.12, zon=0, furrows=(0, 0), wrinkle=0, gran=0, h0=1.2, profile='plateau',
                     rough=.95, sheen=.4, fuzz=1.0, fuzzlen=6.0, heads=.5, drops=None),
    'alternaria': dict(myc=(.70, .70, .66), spore=(.32, .33, .29), old=(.12, .13, .11), rev=((.17, .18, .15), .55, .08),
                       margin=.18, fringe=.06, zon=.13, furrows=(0, 0), wrinkle=.15, gran=.1, h0=1.3, profile='dome',
                       rough=.93, sheen=.5, fuzz=.6, fuzzlen=1.4, heads=0, drops=None),
    'candida': dict(myc=(.97, .95, .88), spore=(.96, .93, .84), old=(.93, .89, .79), rev=None,
                    margin=0, fringe=.03, zon=0, furrows=(0, 0), wrinkle=0, gran=0, h0=.9, profile='yeast',
                    rough=.16, sheen=0, fuzz=0, fuzzlen=0, heads=0, drops=None),
}


def _noise(rng, size, cells):
    g = rng.random((cells + 1, cells + 1)).astype(np.float32)
    x = np.linspace(0, cells, size, endpoint=False)
    i = x.astype(int); f = (x - i).astype(np.float32)
    f = f * f * (3 - 2 * f)
    a = g[i][:, i]; b = g[i][:, i + 1]; c = g[i + 1][:, i]; d = g[i + 1][:, i + 1]
    fx = f[None, :]; fy = f[:, None]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(rng, size, base=4, octaves=5):
    out = np.zeros((size, size), np.float32); amp = 1.0; tot = 0
    for o in range(octaves):
        out += _noise(rng, size, base * 2 ** o) * amp
        tot += amp; amp *= 0.5
    return out / tot


def ring_noise(rng, n, th):
    """Periodic 1-D noise around a colony (n lobes), sampled at angle th."""
    g = rng.random(n + 1); g[-1] = g[0]
    return np.interp((th / (2 * np.pi) % 1.0) * n, np.arange(n + 1), g).astype(np.float32)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a * (1 - t[..., None]) + np.asarray(b, np.float32) * t[..., None]


def plate(colonies, size=2048, seed=0, agar=AGAR):
    """colonies: list of (species_key, cx, cy, radius) in dish-normalised coords (-1..1, dish radius 1 = 44 mm).
    Returns a dict of HxW maps (row 0 = y −1) plus a droplet list [(x, y, r_norm, colour)]."""
    rng = np.random.default_rng(seed)
    lin = (np.arange(size, dtype=np.float32) + 0.5) / size * 2 - 1
    xx, yy = np.meshgrid(lin, lin)
    rr = np.sqrt(xx ** 2 + yy ** 2)
    n_lo = fbm(rng, size, 3, 4); n_mid = fbm(rng, size, 14, 4); n_hi = fbm(rng, size, 64, 3); n_xhi = fbm(rng, size, 200, 2)

    col = np.empty((size, size, 3), np.float32); col[:] = agar
    col *= (0.95 + 0.07 * n_lo)[..., None]
    height = np.zeros((size, size), np.float32)
    rough = np.full((size, size), .08, np.float32)        # fresh agar is wet and glossy
    cov_all = np.zeros((size, size), np.float32)
    sheen = np.zeros_like(cov_all); fuzz = np.zeros_like(cov_all); fuzzlen = np.zeros_like(cov_all); heads = np.zeros_like(cov_all)
    drops = []

    # ---- pass 1: each colony's normalised radius u (with a lobed, species-specific margin), ownership + barrier
    params, us = [], []
    best = np.full((size, size), 9.0, np.float32); second = np.full_like(best, 9.0); owner = np.full(best.shape, -1, np.int16)
    for ci, (sp, cx, cy, R) in enumerate(colonies):
        P = SPECIES[sp]
        reach = R * (1.25 + P['fringe'])
        j0, j1 = [int(np.clip((v + 1) / 2 * size, 0, size)) for v in (cx - reach, cx + reach)]
        i0, i1 = [int(np.clip((v + 1) / 2 * size, 0, size)) for v in (cy - reach, cy + reach)]
        sl = (slice(i0, i1), slice(j0, j1))
        dx, dy = xx[sl] - cx, yy[sl] - cy
        d = np.sqrt(dx ** 2 + dy ** 2); th = np.arctan2(dy, dx)
        lobed = P['profile'] != 'yeast'
        wob = (0.05 * (ring_noise(rng, 7, th) - .5) + 0.035 * (ring_noise(rng, 19, th) - .5)) * (1 if lobed else 0.25)
        u = d / (R * (1 + wob + (0.05 if lobed else 0.01) * (n_mid[sl] - .5)))
        params.append((sl, d, th, P, R, cx, cy)); us.append(u)
        b_, s_, o_ = best[sl], second[sl], owner[sl]
        closer = u < b_
        s_[:] = np.where(closer, b_, np.minimum(s_, u))
        o_[:] = np.where(closer, ci, o_)
        b_[:] = np.minimum(b_, u)

    # ---- diffusible pigments stain the agar first (seen through the translucent medium)
    for (sl, d, th, P, R, cx, cy) in params:
        if P['rev']:
            c_, s_, spread = P['rev']
            dd = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
            t = s_ * np.exp(-np.maximum(dd - R * 0.6, 0) / spread) * (0.85 + 0.3 * n_lo)
            col[:] = lerp(col, c_, np.clip(t, 0, 1))

    # ---- pass 2: build each colony where it owns the agar
    for ci, ((sl, d, th, P, R, cx, cy), u) in enumerate(zip(params, us)):
        mine = (owner[sl] == ci)
        barrier = smoothstep(0.0, 0.05, second[sl] - best[sl])           # thin inhibition line where two colonies meet
        cov = (1 - smoothstep(0.96, 1.0, u)) * mine * np.where(second[sl] < 1.05, barrier, 1)
        nm, nh, nx = n_mid[sl], n_hi[sl], n_xhi[sl]
        ph = rng.random(4) * 6.28

        # zones: sporulating body behind a white margin, darker aged centre, daily zonation rings
        spor = 1 - smoothstep(1 - P['margin'] - 0.08, 1 - P['margin'] + 0.03, u) if P['margin'] > 0 else np.ones_like(u)
        if P['zon']:
            spor = spor * (1 - P['zon'] * (0.5 + 0.5 * np.sin(u * (16 + rng.random() * 8) * np.pi / 2 + ph[0] + 2.5 * (nm - .5))))
        if P['gran']:
            g = smoothstep(0.30, 0.62, nx * 0.75 + nh * 0.25)
            spor = spor * (1 - 0.28 * P['gran'] * (1 - g))
        tcen = 1 - smoothstep(0.0, 0.55, u)
        spore_c = lerp(np.broadcast_to(np.asarray(P['spore'], np.float32), u.shape + (3,)), P['old'], tcen)
        c = np.broadcast_to(np.asarray(P['myc'], np.float32), u.shape + (3,)).copy()
        c = c * (1 - spor[..., None]) + spore_c * spor[..., None]

        # height profile (mm)
        uc = np.clip(u, 0, 1)
        prof = {'plateau': smoothstep(1.0, 0.82, u) * (0.85 + 0.15 * (1 - uc ** 2)),
                'dome': np.sqrt(np.clip(1 - uc ** 2, 0, 1)),
                'umbo': smoothstep(1.0, 0.8, u) * (0.75 + 0.25 * (1 - uc ** 2)) + 0.35 * (1 - smoothstep(0, 0.22, u)),
                'yeast': np.clip(1 - uc ** 4, 0, 1) ** 0.5}[P['profile']]
        h = P['h0'] * prof
        n_f, depth = P['furrows']
        if n_f:
            fur = np.abs(np.sin(th * n_f / 2 + 3.0 * (nm - .5) + ph[1]))
            fur = smoothstep(0.75, 1.0, fur) * smoothstep(0.1, 0.35, u) * (1 - smoothstep(0.7, 0.9, u))
            c *= (1 - 0.10 * fur)[..., None]
            h -= depth * fur
        if P['wrinkle']:
            ridge = 1 - np.abs(2 * nh - 1)
            w = (1 - smoothstep(0.2, 0.5, u)) * smoothstep(0.55, 0.9, ridge)
            h += P['wrinkle'] * w
            c *= (0.88 + 0.18 * ridge * (1 - smoothstep(0.2, 0.5, u)))[..., None]
        if P['gran']:
            h += 0.12 * P['gran'] * smoothstep(0.45, 0.75, nx) * spor
        c *= (0.93 + 0.12 * nx)[..., None]                               # conidial/hyphal grain

        # submerged fringe: fine radial hyphae just past the edge, faint and flat
        fr = np.zeros_like(u)
        if P['fringe']:
            streak = ring_noise(rng, 1400, th) * 0.5 + ring_noise(rng, 500, th) * 0.5
            reach = 1.0 + P['fringe'] * (0.4 + 0.9 * nm) * (0.5 + ring_noise(rng, 23, th))
            fr = smoothstep(0.45, 0.8, streak) * smoothstep(0.94, 1.0, u) * (1 - smoothstep(0.97, reach, u)) * mine
            col[sl] = lerp(col[sl], P['myc'], 0.2 * fr * (1 - cov))

        col[sl] = col[sl] * (1 - cov[..., None]) + c * cov[..., None]
        height[sl] = np.maximum(height[sl], h * cov + 0.02 * fr)
        rough[sl] = rough[sl] * (1 - cov) + P['rough'] * cov
        sheen[sl] = np.maximum(sheen[sl], P['sheen'] * cov)
        cov_all[sl] = np.maximum(cov_all[sl], cov)
        if P['fuzz']:
            fz = P['fuzz'] * cov * (0.55 + 0.45 * smoothstep(0.3, 0.7, nm)) * (1 - 0.6 * spor * (P['margin'] < .3))
            fuzz[sl] = np.maximum(fuzz[sl], fz)
            fuzzlen[sl] = np.maximum(fuzzlen[sl], P['fuzzlen'] * cov * (0.35 + 0.65 * (1 - uc)))
        if P['heads']:
            heads[sl] = np.maximum(heads[sl], P['heads'] * cov * np.clip(spor, 0, 1))
        if P['drops']:
            dc, n = P['drops']
            for _ in range(int(round(n * min(1.0, (R / 0.45) ** 2)))):
                a_ = rng.random() * 2 * np.pi; r_ = R * (0.22 + 0.45 * rng.random())
                drops.append((cx + r_ * np.cos(a_), cy + r_ * np.sin(a_), (0.004 + 0.009 * rng.random()) * (R / 0.5) ** 0.5, dc))

    # meniscus: agar climbs ~1 mm up the dish wall and darkens slightly
    men = smoothstep(0.88, 1.0, rr) ** 2
    height += 0.9 * men
    col *= (1 - 0.12 * men)[..., None]
    inside = (rr <= 1.0).astype(np.float32)
    rgba = np.concatenate([np.clip(col, 0, 1), inside[..., None]], axis=2).astype(np.float32)
    return dict(rgba=rgba, height=height * inside, rough=rough, sheen=sheen, cov=cov_all, fuzz=fuzz, fuzzlen=fuzzlen,
                heads=heads, drops=drops)


def _sat(rng, sp, cx, cy, R, n, spread, rmin, rmax):
    """Satellite colonies from spores thrown off the parent (secondary spread)."""
    out = []
    for _ in range(n):
        a = rng.random() * 2 * np.pi; r = R + spread * (0.3 + rng.random())
        out.append((sp, cx + r * np.cos(a), cy + r * np.sin(a), rmin + (rmax - rmin) * rng.random()))
    return [c for c in out if np.hypot(c[1], c[2]) + c[3] < 0.9]


_r = np.random.default_rng(42)
# six plates: the dish lineup seen in the product renders
PLATES = [
    [('aspergillus_niger', -0.22, 0.08, 0.40), ('aspergillus_niger', 0.48, -0.42, 0.15), ('penicillium', 0.40, 0.45, 0.22)]
    + _sat(_r, 'aspergillus_niger', -0.22, 0.08, 0.40, 3, 0.2, 0.03, 0.06),
    [('penicillium', 0.0, 0.0, 0.50), ('penicillium', -0.58, 0.55, 0.15), ('cladosporium', 0.55, -0.55, 0.13)]
    + _sat(_r, 'penicillium', 0.0, 0.0, 0.50, 4, 0.18, 0.03, 0.05),
    [('fusarium', 0.05, 0.05, 0.62)],
    [('cladosporium', -0.35, -0.2, 0.2), ('cladosporium', 0.3, 0.3, 0.24), ('alternaria', 0.35, -0.45, 0.2),
     ('aspergillus_fumigatus', -0.4, 0.45, 0.16), ('cladosporium', -0.05, 0.65, 0.06), ('cladosporium', 0.65, 0.0, 0.05)],
    [('aspergillus_fumigatus', 0.0, 0.0, 0.45), ('aspergillus_flavus', -0.55, -0.5, 0.16)]
    + _sat(_r, 'aspergillus_fumigatus', 0.0, 0.0, 0.45, 3, 0.15, 0.025, 0.045),
    [('candida', x, y, r) for (x, y, r) in [(-.4, -.3, .07), (.1, -.5, .06), (.45, .1, .08), (-.1, .35, .07), (.3, .55, .05),
                                              (-.55, .3, .05), (0.05, 0.02, .09), (.55, -.35, .05), (-.25, -.65, .05),
                                              (.62, .38, .035), (-.68, -.05, .03), (.2, -.2, .04)]] +
    [('alternaria', -0.2, -0.05, 0.22)],
]


def save_png(path, rgba):
    """Write RGBA float array via Blender image API (called from inside Blender)."""
    import bpy
    h, w, _ = rgba.shape
    img = bpy.data.images.new(path.split('/')[-1], w, h, alpha=True, float_buffer=False)
    img.pixels.foreach_set(np.flipud(rgba).ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    return img
