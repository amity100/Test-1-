#!/usr/bin/env python3
"""
Textures of the Gilgal film set (src/film/gilgal), all procedural (no third-party data):

  palm_frond.webp   RGBA 512x1024  one date-palm leaf (Phoenix dactylifera): u across (rachis at u = 0.5), v from the
                                   base (v = 0: bare petiole with spines) to the tip; stiff glaucous grey-green pinnae
                                   in a V, alpha-tested
  palm_trunk.webp   RGB  256x512   the trunk's armour of old leaf bases (a spiral lattice of cut petiole stubs, fibre),
  palm_trunk_n.webp RGB  256x512   its normal map (tangent space)

Usage: python3 tools/gilgal/gen_gilgal_textures.py
"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'src', 'assets', 'gilgal'))
rng = np.random.default_rng(1207)


def save(img, name, q=90, lossless=False):
    path = os.path.join(OUT, name)
    img.save(path, 'WEBP', quality=q, lossless=lossless, method=6)
    print(name, os.path.getsize(path))


def frond():
    W, H = 512, 1024
    S = 2  # supersample
    w, h = W * S, H * S
    alpha = np.zeros((h, w), np.float32)
    col = np.zeros((h, w, 3), np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    v = yy / h  # 0 base .. 1 tip
    u = xx / w
    cx = 0.5
    # rachis: wide at the base, tapering
    rw = (0.035 * (1 - v) + 0.006) * 1.0
    rach = np.abs(u - cx) < rw * 0.5
    alpha[rach & (v < 0.995)] = 1
    rcol = np.stack([0.55 + 0.1 * (1 - v), 0.55 + 0.05 * (1 - v), 0.40 + 0.0 * v], -1)
    col[rach] = rcol[rach]
    # spines on the petiole (v < 0.18) and pinnae beyond
    n_pin = 120
    for side in (-1, 1):
        for k in range(n_pin):
            v0 = 0.05 + (k + rng.uniform(-0.3, 0.3)) / n_pin * 0.93
            if v0 < 0.17:
                # spine: short, stiff, pale
                L = 0.07 + 0.05 * v0 / 0.17
                width = 0.004
                ang = np.radians(rng.uniform(35, 55))
                c0 = np.array([0.72, 0.66, 0.46])
            else:
                t = (v0 - 0.17) / 0.83
                L = 0.46 * np.sin(np.pi * (0.18 + 0.8 * t)) ** 0.7 + 0.04
                width = 0.012 * (1 - 0.4 * t) + 0.004
                ang = np.radians(rng.uniform(28, 40) + 10 * t)
                g = rng.uniform(-0.05, 0.05)
                c0 = np.array([0.40 + g, 0.47 + g, 0.36 + g * 0.5])
            # leaflet as a thin tapered blade from the rachis, angled toward the tip
            x0 = cx + side * rw_at(v0) * 0.5
            dx = side * np.sin(ang) * L
            dy = np.cos(ang) * L * (w / h)  # v units (the card is 1:2)
            x1, y1 = x0 + dx, v0 + dy
            # rasterise: distance from segment
            px0, py0, px1, py1 = x0 * w, v0 * h, x1 * w, y1 * h
            minx, maxx = int(max(0, min(px0, px1) - 12)), int(min(w - 1, max(px0, px1) + 12))
            miny, maxy = int(max(0, min(py0, py1) - 12)), int(min(h - 1, max(py0, py1) + 12))
            if maxx <= minx or maxy <= miny:
                continue
            sx, sy = xx[miny:maxy, minx:maxx], yy[miny:maxy, minx:maxx]
            ex, ey = px1 - px0, py1 - py0
            ll = ex * ex + ey * ey + 1e-6
            tt = np.clip(((sx - px0) * ex + (sy - py0) * ey) / ll, 0, 1)
            dxp, dyp = sx - (px0 + tt * ex), sy - (py0 + tt * ey)
            d = np.sqrt(dxp * dxp + dyp * dyp)
            half = width * w * 0.5 * (1 - tt) ** 0.6 * np.minimum(1, tt * 8 + 0.3)
            m = d < half
            a = alpha[miny:maxy, minx:maxx]
            c = col[miny:maxy, minx:maxx]
            # midrib lighter, blade edges darker; faint lengthwise gloss
            shade = (0.82 + 0.25 * (1 - np.clip(d / np.maximum(half, 1e-3), 0, 1))) * (0.92 + 0.12 * tt)
            new = c0[None, None, :] * shade[..., None]
            # dry tips
            dry = np.clip((tt - 0.85) / 0.15, 0, 1)[..., None] * 0.6
            new = new * (1 - dry) + np.array([0.62, 0.55, 0.38]) * dry
            c[m] = new[m]
            a[m] = 1
    # fine noise
    n = ndimage.gaussian_filter(rng.standard_normal((h, w)).astype(np.float32), 1.2) * 0.06
    col = np.clip(col * (1 + n[..., None]), 0, 1)
    # downsample with coverage alpha
    img = np.dstack([col, alpha])
    img = img.reshape(H, S, W, S, 4).mean(axis=(1, 3))
    rgb = img[..., :3] / np.maximum(img[..., 3:4], 1e-3)
    # bleed colour into transparent texels (mip-friendly)
    mask = img[..., 3] > 0.05
    idx = ndimage.distance_transform_edt(~mask, return_distances=False, return_indices=True)
    rgb = rgb[tuple(idx)]
    out = np.dstack([np.clip(rgb, 0, 1), np.clip(img[..., 3] * 1.25, 0, 1)])
    save(Image.fromarray((out * 255).astype(np.uint8), 'RGBA'), 'palm_frond.webp', q=92)


def rw_at(v):
    return 0.035 * (1 - v) + 0.006


def trunk():
    W, H = 256, 512
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u, v = xx / W, yy / H
    # spiral lattice of leaf bases: 6 around, 9 up per tile (diamond cells), tileable
    nu, nv = 6, 9
    a = u * nu + v * nv * 0.5
    b = -u * nu + v * nv * 0.5
    fa, fb = a - np.floor(a), b - np.floor(b)
    # each cell: the stub of a cut petiole = a boss, bulging at the bottom edge, fibrous gaps between
    da, db = np.abs(fa - 0.5), np.abs(fb - 0.5)
    edge = np.maximum(da, db)  # 0 centre .. 0.5 edge
    cell_id = (np.floor(a) * 7 + np.floor(b) * 13) % 17
    var = (cell_id / 17.0)
    # height: bosses with a sharp lower lip (cut surface faces down / outward)
    lower = np.clip(0.5 - (fa + fb) * 0.5, -0.5, 0.5)  # >0 toward the lower corner of the diamond
    hgt = (1 - np.clip(edge / 0.5, 0, 1) ** 1.6) * 0.8 + np.clip(lower, 0, 1) * 0.5
    fib = ndimage.gaussian_filter(rng.standard_normal((H, W)).astype(np.float32), (4, 0.6), mode='wrap')
    hgt = hgt + fib * 0.08
    gaps = np.clip((edge - 0.38) / 0.12, 0, 1)
    base = np.array([0.42, 0.36, 0.28])
    fibre = np.array([0.30, 0.24, 0.17])
    cut = np.array([0.55, 0.48, 0.37])
    c = base[None, None] * (0.85 + 0.3 * var[..., None]) * (1 - gaps[..., None]) + fibre[None, None] * gaps[..., None]
    c = c * (1 - np.clip(lower, 0, 1)[..., None] * 0.6) + cut[None, None] * np.clip(lower, 0, 1)[..., None] * 0.6
    c *= (0.85 + 0.25 * hgt[..., None])
    c *= 1 + fib[..., None] * 0.35
    c = np.clip(c * 1.05, 0, 1)
    save(Image.fromarray((c * 255).astype(np.uint8), 'RGB'), 'palm_trunk.webp', q=88)
    gx = ndimage.sobel(hgt, axis=1, mode='wrap') * 2.2
    gy = ndimage.sobel(hgt, axis=0, mode='wrap') * 2.2
    nrm = np.dstack([-gx, gy, np.ones_like(gx)])
    nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
    save(Image.fromarray(((nrm * 0.5 + 0.5) * 255).astype(np.uint8), 'RGB'), 'palm_trunk_n.webp', q=90)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    frond()
    trunk()
