"""Procedural agar-plate textures (colour + height) for the render dishes.

These are SYNTHETIC illustrations of macroscopic colony morphology, used only for product
renders. Morphology cues follow standard descriptive mycology (margin, zonation, radial
furrows, conidial colour, floccose vs velvety texture); they are not photographs or data.
"""
import numpy as np

# Colour palettes are sRGB 0-1. Each species: (margin, body, center, extra/speckle)
SPECIES = {
    'aspergillus_niger':      dict(margin=(.93, .92, .86), body=(.10, .09, .08), center=(.05, .045, .04), speck=(.25, .22, .18), style='granular'),
    'aspergillus_fumigatus':  dict(margin=(.95, .95, .93), body=(.36, .47, .43), center=(.30, .36, .35), speck=(.42, .52, .48), style='velvet'),
    'aspergillus_flavus':     dict(margin=(.95, .94, .86), body=(.62, .66, .28), center=(.50, .55, .22), speck=(.72, .74, .35), style='granular'),
    'penicillium':            dict(margin=(.97, .97, .95), body=(.27, .48, .44), center=(.22, .40, .38), speck=(.95, .84, .38), style='furrowed'),
    'cladosporium':           dict(margin=(.40, .42, .30), body=(.22, .26, .17), center=(.15, .17, .12), speck=(.28, .30, .20), style='velvet'),
    'fusarium':               dict(margin=(.98, .96, .96), body=(.93, .80, .86), center=(.78, .52, .70), speck=(.99, .95, .97), style='floccose'),
    'rhizopus':               dict(margin=(.88, .88, .86), body=(.80, .80, .78), center=(.70, .70, .68), speck=(.08, .08, .08), style='cottony'),
    'alternaria':             dict(margin=(.62, .63, .58), body=(.26, .27, .23), center=(.10, .11, .10), speck=(.45, .46, .40), style='woolly'),
    'candida':                dict(margin=(.97, .95, .88), body=(.96, .93, .84), center=(.94, .90, .80), speck=(.98, .96, .90), style='yeast'),
}


def _noise(rng, size, cells):
    g = rng.random((cells + 1, cells + 1))
    x = np.linspace(0, cells, size, endpoint=False)
    i = x.astype(int); f = x - i
    f = f * f * (3 - 2 * f)
    a = g[i][:, i]; b = g[i][:, i + 1]; c = g[i + 1][:, i]; d = g[i + 1][:, i + 1]
    fx = f[None, :]; fy = f[:, None]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(rng, size, base=4, octaves=5):
    out = np.zeros((size, size)); amp = 1.0; tot = 0
    for o in range(octaves):
        out += _noise(rng, size, base * 2 ** o) * amp
        tot += amp; amp *= 0.5
    return out / tot


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def plate(colonies, size=1024, seed=0, agar=(.87, .74, .50)):
    """colonies: list of (species_key, cx, cy, radius) in dish-normalised coords (-1..1).
    Returns (rgba float32 HxWx4, height float32 HxW)."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    xx = xx / size * 2 - 1; yy = yy / size * 2 - 1
    rr = np.sqrt(xx ** 2 + yy ** 2)
    n_lo = fbm(rng, size, 3, 4); n_hi = fbm(rng, size, 48, 3); n_mid = fbm(rng, size, 12, 4)
    col = np.zeros((size, size, 3), np.float32)
    col[:] = agar
    col *= (0.94 + 0.08 * n_lo)[..., None]
    # meniscus darkening near the wall
    col *= (1 - 0.18 * smoothstep(0.86, 1.0, rr))[..., None]
    height = np.zeros((size, size), np.float32)
    for (sp, cx, cy, R) in colonies:
        P = SPECIES[sp]
        dx, dy = xx - cx, yy - cy
        d = np.sqrt(dx ** 2 + dy ** 2)
        th = np.arctan2(dy, dx)
        ph = rng.random(6) * 6.28
        wob = (0.035 * np.sin(3 * th + ph[0]) + 0.025 * np.sin(7 * th + ph[1]) + 0.015 * np.sin(13 * th + ph[2]))
        edge_noise = 0.06 * (n_mid - 0.5)
        if P['style'] in ('floccose', 'cottony', 'woolly'):
            edge_noise *= 2.2
        if P['style'] == 'yeast':
            wob *= 0.25; edge_noise *= 0.3
        u = d / (R * (1 + wob + edge_noise))  # 0 center .. 1 margin
        cover = 1 - smoothstep(0.9, 1.0, u)
        if P['style'] in ('floccose', 'cottony'):
            cover = 1 - smoothstep(0.75, 1.05, u + 0.12 * (n_hi - 0.5))
        m = np.array(P['margin']); b = np.array(P['body']); c = np.array(P['center']); s = np.array(P['speck'])
        margin_w = {'granular': 0.14, 'velvet': 0.12, 'furrowed': 0.16, 'floccose': 0.5, 'cottony': 0.6,
                    'woolly': 0.3, 'yeast': 0.0}[P['style']]
        tmar = smoothstep(1 - margin_w - 0.05, 1 - margin_w + 0.05, u) if margin_w > 0 else np.zeros_like(u)
        tcen = 1 - smoothstep(0.0, 0.55, u)
        cc = b[None, None, :] * (1 - tcen[..., None]) + c[None, None, :] * tcen[..., None]
        cc = cc * (1 - tmar[..., None]) + m[None, None, :] * tmar[..., None]
        # concentric zonation (daily growth rings)
        zon = 0.5 + 0.5 * np.sin(u * (18 + rng.random() * 8) + ph[3])
        zamp = 0.03 if P['style'] == 'yeast' else 0.10
        cc *= (1 - zamp + zamp * zon)[..., None]
        h = (1 - u ** 2) * cover
        if P['style'] == 'granular':
            g = smoothstep(0.55, 0.8, n_hi)
            cc = cc * (1 - 0.5 * g[..., None] * (1 - tmar[..., None])) + s * 0.5 * g[..., None] * (1 - tmar[..., None])
            h = h * 0.6 + 0.25 * g * cover
        elif P['style'] == 'furrowed':
            fur = np.abs(np.sin(th * (9 + int(rng.random() * 5)) + 2.0 * n_mid))
            fur = smoothstep(0.85, 1.0, fur) * smoothstep(0.1, 0.6, u) * (1 - tmar)
            cc *= (1 - 0.16 * fur)[..., None]
            h = h * 0.7 - 0.15 * fur
            drops = smoothstep(0.80, 0.86, n_hi) * smoothstep(0.2, 0.3, u) * (1 - smoothstep(0.6, 0.7, u))
            cc = cc * (1 - drops[..., None]) + s * drops[..., None]
            h += 0.2 * drops
        elif P['style'] == 'velvet':
            cc *= (0.9 + 0.2 * n_hi)[..., None]
            h = h * 0.55 + 0.08 * n_hi * cover
        elif P['style'] in ('floccose', 'cottony', 'woolly'):
            fl = fbm(rng, size, 90, 2)
            cc = cc * (0.85 + 0.25 * fl[..., None])
            h = h * 1.2 + 0.35 * fl * cover
            if P['style'] == 'cottony':
                sporangia = smoothstep(0.83, 0.9, n_hi) * cover
                cc = cc * (1 - sporangia[..., None]) + s * sporangia[..., None]
        elif P['style'] == 'yeast':
            h = np.sqrt(np.clip(1 - u ** 2, 0, 1)) * cover * 1.2
            cc *= (0.96 + 0.06 * n_hi)[..., None]
        a = cover[..., None]
        col = col * (1 - a) + cc * a
        height = np.maximum(height, h * R * 6)
    inside = (rr <= 1.0).astype(np.float32)
    rgba = np.concatenate([np.clip(col, 0, 1), inside[..., None]], axis=2)
    height = height * inside
    return rgba.astype(np.float32), (height / max(height.max(), 1e-6)).astype(np.float32)


# six plates: the dish lineup seen in the product renders
PLATES = [
    [('aspergillus_niger', -0.25, 0.1, 0.38), ('aspergillus_niger', 0.45, -0.45, 0.16), ('penicillium', 0.42, 0.42, 0.2)],
    [('penicillium', 0.0, 0.0, 0.52), ('penicillium', -0.6, 0.55, 0.14), ('cladosporium', 0.55, -0.55, 0.12)],
    [('fusarium', 0.05, 0.05, 0.62)],
    [('cladosporium', -0.35, -0.2, 0.2), ('cladosporium', 0.3, 0.3, 0.24), ('alternaria', 0.35, -0.45, 0.2),
     ('aspergillus_fumigatus', -0.4, 0.45, 0.16)],
    [('aspergillus_fumigatus', 0.0, 0.0, 0.45), ('aspergillus_flavus', -0.55, -0.5, 0.16)],
    [('candida', x, y, r) for (x, y, r) in [(-.4, -.3, .07), (.1, -.5, .06), (.45, .1, .08), (-.1, .35, .07), (.3, .55, .05),
                                              (-.55, .3, .05), (0.05, 0.02, .09), (.55, -.35, .05), (-.25, -.65, .05)]] +
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
