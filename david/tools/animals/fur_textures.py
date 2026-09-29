"""
Tileable fur textures for shell fur (bear, goats): strands + clumps.

    python3 tools/animals/fur_textures.py

fur_strands.png (RGB, 512²):
  R  strand profile: 1 on the strand axis -> 0 at its edge (per-shell threshold = tapered strands)
  G  strand length relative to the local fur length (under-fur 0.35-0.72, guard hairs 0.82-1.0)
  B  per-strand random (colour / density test)
fur_clumps.png (RGB, 256²):
  RG vector from the texel to its clump centre (0.5 = none), in units of CLUMP_R texels
  B  clump length factor (also used for clump colour variation)
No alpha channel on purpose: browsers may premultiply on decode, destroying RGB where alpha is 0.
"""
from __future__ import annotations

import math
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'src', 'assets', 'animals')
CLUMP_R = 14.0  # max clump radius in clump-texture texels (the shader must use the same value)


def strands(res=512, seed=7, spacing=5.0):
    rng = np.random.default_rng(seed)
    prof = np.zeros((res, res))
    hgt = np.zeros((res, res))
    var = np.zeros((res, res))
    guardm = np.zeros((res, res))
    # Poisson-disk-ish: jittered grid with rejection keeps strands from merging into blobs
    n = int(res / spacing)
    pts = []
    for gy in range(n):
        for gx in range(n):
            pts.append(((gx + 0.5 + (rng.random() - 0.5) * 0.85) * spacing, (gy + 0.5 + (rng.random() - 0.5) * 0.85) * spacing))
    rng.shuffle(pts)
    for cx, cy in pts:
        guard = rng.random() < 0.16
        r = (2.1 if guard else 1.6) * (0.85 + 0.3 * rng.random())
        h = (0.82 + 0.18 * rng.random()) if guard else (0.35 + 0.37 * rng.random())
        v = rng.random()
        x0, x1 = int(math.floor(cx - r - 1)), int(math.ceil(cx + r + 1))
        y0, y1 = int(math.floor(cy - r - 1)), int(math.ceil(cy + r + 1))
        ys, xs = np.mgrid[y0:y1 + 1, x0:x1 + 1]
        d = np.hypot(xs + 0.5 - cx, ys + 0.5 - cy) / r
        m = d < 1
        ty, tx = ys[m] % res, xs[m] % res
        p = 1 - d[m]
        # taller strands win where they overlap (they are what is seen at the top shells)
        take = (h > hgt[ty, tx]) | (p > prof[ty, tx] + 0.35)
        ty, tx, p = ty[take], tx[take], p[take]
        prof[ty, tx] = p
        hgt[ty, tx] = h
        var[ty, tx] = v
        guardm[ty, tx] = 1.0 if guard else 0.0
    return np.stack([prof, hgt, var], axis=-1)


def clumps(res=256, seed=11, cell=18.0):
    """Voronoi clumps on a jittered grid (tileable)."""
    rng = np.random.default_rng(seed)
    n = int(round(res / cell))
    cellp = res / n
    cx = (np.arange(n)[None, :] + 0.5 + (rng.random((n, n)) - 0.5) * 0.8) * cellp
    cy = (np.arange(n)[:, None] + 0.5 + (rng.random((n, n)) - 0.5) * 0.8) * cellp
    ln = 0.6 + 0.6 * rng.random((n, n))
    cv = rng.random((n, n))
    ys, xs = np.mgrid[0:res, 0:res] + 0.5
    best = np.full((res, res), 1e9)
    vx = np.zeros((res, res))
    vy = np.zeros((res, res))
    L = np.zeros((res, res))
    C = np.zeros((res, res))
    for gy in range(n):
        for gx in range(n):
            for oy in (-res, 0, res):
                for ox in (-res, 0, res):
                    px, py = cx[gy, gx] + ox, cy[gy, gx] + oy
                    dx, dy = px - xs, py - ys
                    d = dx * dx + dy * dy
                    m = d < best
                    best[m] = d[m]
                    vx[m] = dx[m]
                    vy[m] = dy[m]
                    L[m] = ln[gy, gx]
                    C[m] = cv[gy, gx]
    vx = np.clip(vx / CLUMP_R, -1, 1)
    vy = np.clip(vy / CLUMP_R, -1, 1)
    return np.stack([vx * 0.5 + 0.5, vy * 0.5 + 0.5, (L - 0.6) / 0.6], axis=-1)


def save(img, name):
    a = (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(a, 'RGB').save(os.path.join(OUT, name), optimize=True)
    print(name, os.path.getsize(os.path.join(OUT, name)) // 1024, 'KB')


if __name__ == '__main__':
    save(strands(), 'fur_strands.png')
    save(clumps(), 'fur_clumps.png')
