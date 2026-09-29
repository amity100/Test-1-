"""World texture generator for DAVID (Judean hills east of Bethlehem, golden hour).

Run from the david/ folder:
    python3 tools/world/gen_world_textures.py [name ...] [--preview DIR] [--size N]

Writes seamless PBR-ish textures to src/assets/world/:
  <name>_a.webp   albedo (sRGB) + height/coverage in alpha where noted
  <name>_n.webp   tangent-space normal (OpenGL, +Y up) + ambient occlusion / cavity in alpha
Every texture is generated from periodic noise (FFT / periodic Voronoi), so it tiles exactly.
All content is procedural and our own; no photographs or third-party images are used.
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from texlib import (F32, col, cups, cavity, blur, lerp, norm01, normal_map, save_webp, shade_preview,  # noqa: E402
                    smooth, spectral, worley, grid, preview_tiled)

PREVIEW = None
SIZE = 1024


def pv(albedo, nrm, name, ao=None):
    if PREVIEW:
        os.makedirs(PREVIEW, exist_ok=True)
        shade_preview(albedo, nrm, os.path.join(PREVIEW, name + '_lit.jpg'), reps=2, size=1024, ao=ao)
        preview_tiled(albedo, os.path.join(PREVIEW, name + '_albedo.jpg'), reps=2, size=1024)


def save_pair(name, albedo, h, nrm_strength, ao, alpha_a=None, q=86):
    """albedo (n,n,3) sRGB; h height 0..1 (goes to albedo alpha unless alpha_a given); ao 0..1 -> normal alpha."""
    nrm = normal_map(h * nrm_strength, 1.0)
    save_webp(albedo, name + '_a.webp', q=q, alpha=h if alpha_a is None else alpha_a)
    save_webp(nrm, name + '_n.webp', q=90, alpha=ao)
    pv(albedo, nrm, name, ao)
    return nrm


# ============================================================================= limestone
def limestone(n=SIZE):
    """Weathered Judean limestone as in the reference: rounded cream-white lumps, pocked by distinct
    solution holes (dark, steep-walled cups of 2-6 cm), a few shallow basins, tiny pores, hairline cracks,
    sparse dark crustose and orange lichen. Tile ~2.4 m in world space."""
    s = n / 1024.0
    wx = (spectral(n, 2.0, 141, fmin=2) - 0.5) * 0.04
    wy = (spectral(n, 2.0, 142, fmin=2) - 0.5) * 0.04
    base = spectral(n, 2.4, 11, fmin=1)
    lumps = spectral(n, 2.0, 12, fmin=4, fmax=70 * s)
    knob = spectral(n, 1.5, 13, fmin=16, fmax=160 * s)
    fine = spectral(n, 0.9, 14, fmin=80)
    pitty = smooth(0.3, 0.72, spectral(n, 2.0, 15, fmin=2))
    holes = cups(n, 900, 0.0045, 0.016, 17, density=0.45 + 0.55 * pitty, power=1.8, warp=(wx, wy), sharp=2.6)
    basins = cups(n, 36, 0.03, 0.075, 16, density=0.3 + 0.7 * pitty, power=2.0, warp=(wx, wy), sharp=1.1)
    pores = cups(n, 2600, 0.0022, 0.005, 18, density=0.08 + 0.92 * pitty, power=1.2, sharp=2.6)
    rng = np.random.default_rng(19)
    (f1, f2), _ = worley(n, rng.random((18, 2)), warp=(wx * 2.5, wy * 2.5))
    crack = (1.0 - smooth(0.0, 0.0024, f2 - f1)) * smooth(0.5, 0.72, spectral(n, 2.0, 20, fmin=2))

    h = (0.42 * base + 0.38 * lumps + 0.14 * knob + 0.025 * fine
         - 0.14 * basins - 0.42 * holes - 0.08 * pores - 0.07 * crack)
    h = norm01(h)
    cav = cavity(h, sigmas=(1.5 * s, 5 * s, 16 * s), weights=(0.4, 0.35, 0.25))
    cav = np.clip(cav * 8.0, -1, 1)
    ao = np.clip(1.0 - np.maximum(cav, 0) * 0.9 - smooth(0.05, 0.9, holes) * 0.45 - pores * 0.2, 0.4, 1.0)

    c_crust = col('#dcd4c1')
    c_warm = col('#d8c8a9')
    c_grey = col('#b3aea2')
    c_rim = col('#8a7a64')
    c_hole = col('#3a322a')
    albedo = lerp(c_grey, c_crust, smooth(0.2, 0.7, 0.55 * base + 0.45 * lumps))
    albedo = lerp(albedo, c_warm, smooth(0.5, 0.85, spectral(n, 2.2, 22, fmin=2)) * 0.55)
    albedo *= (0.93 + 0.1 * knob)[..., None]
    albedo *= (0.96 + 0.07 * fine)[..., None]
    albedo = lerp(albedo, c_rim, smooth(0.02, 0.35, holes) * 0.35 + smooth(0.1, 0.6, pores) * 0.25)
    albedo = lerp(albedo, c_hole, smooth(0.5, 0.95, holes) * 0.3)
    albedo = lerp(albedo, c_rim, smooth(0.2, 0.9, basins) * 0.25)
    albedo = lerp(albedo, c_hole, crack * 0.55)
    albedo *= (1.0 - np.maximum(cav, 0) * 0.35)[..., None]
    # sparse lichen: dark grey crusts, pale grey-green crusts, tiny orange Xanthoria rosettes
    clean = 1 - np.clip(holes * 2 + pores, 0, 1)
    lichen_mask = smooth(0.7, 0.77, spectral(n, 1.7, 23, fmin=5)) * clean
    albedo = lerp(albedo, col('#55544b'), lichen_mask * 0.7)
    lich2 = smooth(0.72, 0.78, spectral(n, 1.6, 24, fmin=8)) * clean
    albedo = lerp(albedo, col('#9ba08f'), lich2 * 0.4)
    (o1,), _ = worley(n, np.random.default_rng(25).random((1800, 2)), k=1)
    orange = (1 - smooth(0.0, 0.004, o1)) * smooth(0.62, 0.72, spectral(n, 2.0, 26, fmin=3)) * clean
    albedo = lerp(albedo, col('#c2843a'), orange * 0.8)
    return save_pair('limestone', np.clip(albedo, 0, 1), h, 30.0 * s, ao)


# ============================================================================= drawing helpers
from PIL import Image, ImageDraw  # noqa: E402


def c255(c, a=255):
    return tuple(int(v) for v in np.clip(np.asarray(c) * 255, 0, 255)) + ((a,) if a is not None else ())


def wrap_draw(fn, n, x, y, margin):
    """Call fn(dx, dy) for every periodic copy of a primitive near the tile border."""
    for ox in (-n, 0, n):
        if not (-margin < x + ox < n + margin):
            continue
        for oy in (-n, 0, n):
            if -margin < y + oy < n + margin:
                fn(ox, oy)


def img_to_arr(img):
    return np.asarray(img, dtype=F32) / 255.0


# ============================================================================= dry grass ground
def ground(n=SIZE):
    """Dry golden grassland seen from above (tile ~4 m): brown soil between tussocks, straw litter,
    radial grass clumps with pale tips, a few grey-green rosettes and limestone chips."""
    rng = np.random.default_rng(31)
    S = 2
    N = n * S
    soil = spectral(n, 2.0, 32, fmin=2)
    soil_c = lerp(col('#7c6247'), col('#9b7d59'), soil)
    base = Image.fromarray((np.clip(soil_c, 0, 1) * 255).astype(np.uint8), 'RGB').resize((N, N), Image.BILINEAR)
    hmap = Image.new('L', (N, N), 30)
    d = ImageDraw.Draw(base)
    dh = ImageDraw.Draw(hmap)
    straw = [col(c) for c in ('#cdb275', '#dcc68e', '#b8995d', '#e6d6a6', '#a98c57', '#a79e84', '#c4a86a')]
    dirf = spectral(64, 2.4, 33, fmin=1) * math.tau * 1.4

    def strand(x, y, a, L, c, w, hv, shadow=True):
        x1, y1 = x + math.cos(a) * L, y + math.sin(a) * L

        def f(ox, oy):
            if shadow:
                d.line([(x + ox + 2 * S, y + oy + 2 * S), (x1 + ox + 2 * S, y1 + oy + 2 * S)], fill=c255(col('#3e3024') * 1.0, None), width=w)
            d.line([(x + ox, y + oy), (x1 + ox, y1 + oy)], fill=c255(c, None), width=w)
            dh.line([(x + ox, y + oy), (x1 + ox, y1 + oy)], fill=hv, width=w)
        wrap_draw(f, N, x, y, L + 8)

    # 1) flattened litter everywhere (direction field -> natural lodged swirls)
    for i in range(int(46000 * (n / 1024) ** 2)):
        x, y = rng.random() * N, rng.random() * N
        a = dirf[int(y / N * 64) % 64, int(x / N * 64) % 64] + rng.normal(0, 0.6)
        c = straw[rng.integers(len(straw))] * rng.uniform(0.75, 1.0)
        strand(x, y, a, rng.uniform(10, 32) * S, c, S if rng.random() < 0.75 else 2 * S, int(rng.uniform(70, 150)))
    # 2) tussocks: radial bursts seen from above, dark heart, bright tips
    for i in range(int(1500 * (n / 1024) ** 2)):
        cx, cy = rng.random() * N, rng.random() * N
        R = rng.uniform(12, 40) * S
        m = int(rng.uniform(18, 40))
        cc = straw[rng.integers(len(straw))]
        for k in range(m):
            a = rng.uniform(0, math.tau)
            L = R * rng.uniform(0.5, 1.0)
            c = cc * rng.uniform(0.85, 1.12)
            strand(cx + rng.normal(0, 2) * S, cy + rng.normal(0, 2) * S, a, L, c, S if rng.random() < 0.7 else 2 * S, int(rng.uniform(150, 255)))
    # 3) grey-green rosettes (dry-season herbs) and small dark shrublets
    for i in range(int(120 * (n / 1024) ** 2)):
        cx, cy = rng.random() * N, rng.random() * N
        r = rng.uniform(4, 11) * S
        c = col('#7c7f63') * rng.uniform(0.8, 1.1)
        for k in range(9):
            a = k / 9 * math.tau + rng.normal(0, 0.2)
            ex, ey = cx + math.cos(a) * r * 0.6, cy + math.sin(a) * r * 0.6

            def f(ox, oy, ex=ex, ey=ey):
                d.ellipse([ex + ox - r * 0.45, ey + oy - r * 0.3, ex + ox + r * 0.45, ey + oy + r * 0.3], fill=c255(c, None))
                dh.ellipse([ex + ox - r * 0.45, ey + oy - r * 0.3, ex + ox + r * 0.45, ey + oy + r * 0.3], fill=110)
            wrap_draw(f, N, ex, ey, r + 4)
    img = base.resize((n, n), Image.LANCZOS)
    arr = img_to_arr(img)
    h = img_to_arr(hmap.resize((n, n), Image.LANCZOS))
    # 4) limestone chips / pebbles
    pts = np.random.default_rng(34).random((1300, 2))
    (f1,), (i1,) = worley(n, pts, k=1)
    size = np.random.default_rng(35).uniform(0.002, 0.0065, 1300).astype(F32)
    peb = 1 - smooth(0.6, 1.0, f1 / size[i1])
    keep = (np.random.default_rng(36).random(1300) < 0.55)[i1]
    peb *= keep
    arr = lerp(arr, lerp(col('#b9b1a0'), col('#d8d0bf'), np.random.default_rng(37).random(1300).astype(F32)[i1]), peb * 0.95)
    h = np.maximum(blur(h, 0.7), peb * 0.75)
    arr *= (0.9 + 0.2 * spectral(n, 1.3, 38, fmin=16))[..., None]
    ao = np.clip(1.0 - np.maximum(cavity(h, (1.5, 4, 10), (0.5, 0.3, 0.2)), 0) * 5.0, 0.35, 1.0)
    arr *= (0.7 + 0.3 * ao)[..., None]
    return save_pair('ground', np.clip(arr, 0, 1), h, 6.0, ao)


# ============================================================================= terra rossa
def soil(n=SIZE):
    """Terra rossa (red Mediterranean soil on limestone), dry and dusty, with angular limestone chips,
    fine cracks, a few straw bits (tile ~4 m)."""
    c1 = spectral(n, 2.1, 41, fmin=2)
    c2 = spectral(n, 1.4, 42, fmin=16)
    c3 = spectral(n, 1.0, 43, fmin=60)
    albedo = lerp(col('#76493a'), col('#8f5f47'), c1)
    albedo = lerp(albedo, col('#a48670'), smooth(0.45, 0.9, c2) * 0.6)  # dust
    albedo *= (0.9 + 0.18 * c3)[..., None]
    rng = np.random.default_rng(44)
    m = 2400
    pts = rng.random((m, 2))
    (f1, f2), (i1, _) = worley(n, pts)
    size = rng.uniform(0.0015, 0.0065, m).astype(F32)
    keep = rng.random(m) < 0.22
    # angular chips: use F2-F1 (cell interior) scaled, gives faceted shapes
    rel = f1 / size[i1]
    chip = (rel < 1.0) & keep[i1]
    facet = np.clip(1 - rel, 0, 1) ** 0.6
    shade = rng.uniform(0.72, 1.05, m).astype(F32)[i1]
    chip_c = lerp(col('#a29783'), col('#cbc1ae'), rng.random(m).astype(F32)[i1]) * shade[..., None]
    albedo = np.where(chip[..., None], chip_c, albedo)
    ring = (rel < 1.3) & ~chip & keep[i1]
    albedo = np.where(ring[..., None], albedo * 0.72, albedo)
    # desiccation cracks
    (g1, g2), _ = worley(n, rng.random((160, 2)))
    crack = (1 - smooth(0.0, 0.0022, g2 - g1)) * smooth(0.4, 0.7, spectral(n, 2.0, 45, fmin=3))
    albedo = lerp(albedo, col('#4a2a1c'), crack * 0.7)
    h = 0.35 * c1 + 0.12 * c2 + 0.06 * c3 + 0.9 * np.where(chip, facet, 0) - 0.25 * crack
    h = norm01(h)
    ao = np.clip(1.0 - np.maximum(cavity(h, (1.5, 4, 10), (0.5, 0.3, 0.2)), 0) * 6.0, 0.35, 1.0)
    return save_pair('soil', np.clip(albedo, 0, 1), h, 7.0, ao)


# ============================================================================= wadi gravel
def gravel(n=SIZE):
    """Dry stream bed: rounded limestone and flint pebbles/cobbles of mixed size in pale silt (tile ~3 m)."""
    rng = np.random.default_rng(51)
    h = np.zeros((n, n), F32)
    albedo = lerp(col('#9c8466'), col('#b39c7e'), spectral(n, 2.0, 52, fmin=2))
    albedo *= (0.9 + 0.15 * spectral(n, 1.0, 53, fmin=50))[..., None]
    xs, ys = grid(n)
    for layer, (count, rmin, rmax, keep_p) in enumerate(((150, 0.02, 0.045, 0.8), (900, 0.008, 0.02, 0.75), (3200, 0.003, 0.008, 0.7))):
        pts = rng.random((count, 2)).astype(F32)
        rad = rng.uniform(rmin, rmax, count).astype(F32)
        ang = rng.uniform(0, math.pi, count).astype(F32)
        elong = rng.uniform(1.0, 1.6, count).astype(F32)
        keep = rng.random(count) < keep_p
        kind = rng.random(count)

        def pal(a, b):
            t = rng.random(count).astype(F32)[:, None]
            return col(a) + (col(b) - col(a)) * t
        pc = np.where((kind < 0.6)[:, None], pal('#bdb29c', '#d6cdba'),
                      np.where((kind < 0.84)[:, None], pal('#8f887e', '#aaa294'), pal('#6a5344', '#88705a')))
        _, ids = worley(n, pts, k=4)
        best = np.zeros((n, n), F32)
        best_id = np.zeros((n, n), np.int64)
        best_r2 = np.ones((n, n), F32) * 9
        for i1 in ids:
            dx = (xs - pts[i1, 0] + 0.5) % 1.0 - 0.5
            dy = (ys - pts[i1, 1] + 0.5) % 1.0 - 0.5
            ca, sa = np.cos(ang[i1]), np.sin(ang[i1])
            u = (dx * ca + dy * sa) / (rad[i1] * elong[i1])
            v = (-dx * sa + dy * ca) / rad[i1]
            r2 = u * u + v * v
            dome = np.sqrt(np.clip(1 - r2, 0, 1)) * (rad[i1] / rmax) * (1.0 - layer * 0.22) * keep[i1]
            better = dome > best
            best = np.where(better, dome, best)
            best_id = np.where(better, i1, best_id)
            best_r2 = np.where(better, r2, best_r2)
        top = (best > 0) & (best > h - 0.015)
        pcol = pc[best_id] * (0.82 + 0.22 * np.clip(best * 3, 0, 1))[..., None]
        pcol = np.where((best_r2 > 0.72)[..., None], pcol * 0.84, pcol)
        albedo = np.where(top[..., None], pcol, albedo)
        h = np.where(top, np.maximum(h, best), h)
    h = norm01(blur(h, 0.6))
    ao = np.clip(1.0 - np.maximum(cavity(h, (2, 5, 12), (0.5, 0.3, 0.2)), 0) * 5.0, 0.3, 1.0)
    albedo *= (0.65 + 0.35 * ao)[..., None]
    return save_pair('gravel', np.clip(albedo, 0, 1), h, 9.0, ao)


# ============================================================================= stone walls
def _course_wall(name, n, seed, rows, hvar, wmin, wmax, gap, rnd_edge, corner, stone_cols, mortar_col,
                 shrink=0.0, wobble=0.004, flat=0.0, chink=True, q=86, strength=14.0, bevel=0.014):
    """Stones laid in horizontal courses (rounded, irregular rectangles), periodic in x and y.
    Units: fraction of the tile. gap: joint half-width; rnd_edge: edge irregularity; shrink: random per-stone
    shrink (bigger voids, dry-stone look)."""
    rng = np.random.default_rng(seed)
    xs, ys = grid(n)
    rows_h = rng.uniform(1 - hvar, 1 + hvar, rows)
    rows_h = rows_h / rows_h.sum()
    y_edges = np.concatenate([[0.0], np.cumsum(rows_h)])
    wob = (spectral(n, 2.2, seed + 1, fmin=2) - 0.5) * wobble * 2
    yw = np.mod(ys + wob, 1.0)
    row = np.clip(np.searchsorted(y_edges, yw, side='right') - 1, 0, rows - 1)
    y0 = y_edges[row]
    y1 = y_edges[row + 1]
    edge_noise = ((spectral(n, 2.3, seed + 2, fmin=3) - 0.5) * rnd_edge * 2
                  + (spectral(n, 1.4, seed + 6, fmin=24) - 0.5) * 0.003)
    dist = np.zeros((n, n), F32)
    stone_id = np.zeros((n, n), np.int64)
    sid = 0
    tone = []
    for r in range(rows):
        widths = []
        acc = 0.0
        while acc < 1.0:
            w = rng.uniform(wmin, wmax)
            widths.append(w)
            acc += w
        widths = np.array(widths) / acc
        x_edges = np.concatenate([[0.0], np.cumsum(widths)])
        phase = rng.random()
        m = row == r
        xr = np.mod(xs[m] - phase, 1.0)
        k = np.clip(np.searchsorted(x_edges, xr, side='right') - 1, 0, len(widths) - 1)
        sh = rng.uniform(0, shrink, len(widths))
        shv = rng.uniform(0, shrink, len(widths))
        dx = np.minimum(xr - x_edges[k], x_edges[k + 1] - xr) - sh[k] * widths[k] * 0.5
        dy = np.minimum(yw[m] - y0[m], y1[m] - yw[m]) - shv[k] * rows_h[r] * 0.5
        rc = corner
        cx = np.clip(rc - dx, 0, None)
        cy = np.clip(rc - dy, 0, None)
        dd = np.where((dx < rc) & (dy < rc), rc - np.sqrt(cx * cx + cy * cy), np.minimum(dx, dy))
        dist[m] = dd
        stone_id[m] = sid + k
        sid += len(widths)
    dist = dist + edge_noise
    stone_tone = rng.random(sid).astype(F32)
    stone_warm = rng.random(sid).astype(F32)
    stone_h = rng.uniform(0.75, 1.0, sid).astype(F32)
    g = 1 - smooth(gap * 0.5, gap * 1.5, dist)
    bulge = smooth(gap * 0.6, gap + bevel, dist) ** (0.5 + flat) * (0.85 + 0.15 * smooth(0, 0.05, dist)) * stone_h[stone_id]
    det = spectral(n, 1.3, seed + 3, fmin=12)
    pits = cups(n, 1600, 0.0018, 0.0055, seed + 4, sharp=2.4)
    h = bulge * 0.8 + det * 0.1 - pits * 0.1
    if chink:
        cpts = rng.random((900, 2)).astype(F32)
        (c1,), (ci,) = worley(n, cpts, k=1)
        csz = rng.uniform(0.004, 0.012, 900).astype(F32)
        chk = (c1 < csz[ci]) & (g > 0.5)
        ch = 0.3 + 0.25 * np.sqrt(np.clip(1 - c1 / csz[ci], 0, 1))
        h = np.where(chk, np.maximum(h, ch), h)
        g = np.where(chk, 0.0, g)
    h = np.where(g > 0.5, h * (1 - g) - 0.1 * g, h)
    h = norm01(h)
    base = lerp(stone_cols[0], stone_cols[1], stone_tone[stone_id])
    base = lerp(base, stone_cols[2], smooth(0.65, 1.0, stone_warm[stone_id]) * 0.7)
    albedo = base * (0.86 + 0.2 * det)[..., None]
    albedo = lerp(albedo, col('#6d6252'), pits * 0.5)
    lich = smooth(0.66, 0.74, spectral(n, 1.8, seed + 5, fmin=5)) * bulge
    albedo = lerp(albedo, col('#5b5b4d'), lich * 0.5)
    albedo = lerp(albedo, mortar_col, g)
    ao = np.clip(1.0 - g * 0.8 - np.maximum(cavity(h, (2, 6, 14), (0.5, 0.3, 0.2)), 0) * 3.0, 0.12, 1.0)
    albedo *= (0.75 + 0.25 * ao)[..., None]
    return save_pair(name, np.clip(albedo, 0, 1), h, strength, ao, q=q)


def drywall(n=SIZE):
    """Dry-stone terrace wall face (no mortar): irregular, mostly flat-laid fieldstones in rough courses,
    dark voids, chinking stones, lichen. Tile ~2.4 m wide x 2.4 m tall (about 9 courses)."""
    return _course_wall('drywall', n, 61, rows=9, hvar=0.45, wmin=0.09, wmax=0.3, gap=0.0035, rnd_edge=0.012,
                        corner=0.035, stone_cols=(col('#a39c8e'), col('#d4ccbb'), col('#cbb89a')),
                        mortar_col=col('#4a3f35'), shrink=0.07, wobble=0.014, chink=False, bevel=0.016)


def masonry(n=SIZE):
    """House wall of roughly dressed fieldstones laid in courses with mud mortar (Iron Age Judah).
    Tile ~3 m x 3 m (about 12 courses)."""
    return _course_wall('masonry', n, 71, rows=11, hvar=0.4, wmin=0.07, wmax=0.24, gap=0.003, rnd_edge=0.008,
                        corner=0.025, stone_cols=(col('#ab9d86'), col('#d6c9af'), col('#c9ae86')),
                        mortar_col=col('#9a8566'), shrink=0.03, wobble=0.01, flat=0.5, strength=11.0, chink=False, bevel=0.009)


# ============================================================================= olive bark
def bark(n=512):
    """Old olive bark: grey, deeply fissured along twisting fibres, knobbly, with pale patches and lichen.
    U wraps around the limb, V runs along it."""
    fis = 1.0 - np.abs(spectral(n, 2.2, 81, fmin=2, aspect=(1.0, 3.5)) * 2 - 1)
    fis2 = 1.0 - np.abs(spectral(n, 2.0, 82, fmin=4, aspect=(1.0, 3.0)) * 2 - 1)
    knobs = cups(n, 60, 0.02, 0.06, 83, sharp=0.7)
    fine = spectral(n, 1.1, 84, fmin=24, aspect=(1.0, 3.0))
    h = 0.55 * (1 - fis ** 8) + 0.25 * (1 - fis2 ** 8) + 0.08 * fine + 0.2 * knobs
    h = norm01(h)
    albedo = lerp(col('#403830'), col('#9d968a'), smooth(0.1, 0.6, h))
    albedo = lerp(albedo, col('#a8a293'), smooth(0.6, 0.8, spectral(n, 2.0, 85, fmin=3)) * smooth(0.5, 0.9, h) * 0.5)
    lich = smooth(0.66, 0.74, spectral(n, 1.8, 86, fmin=5)) * smooth(0.4, 0.8, h)
    albedo = lerp(albedo, col('#8f9479'), lich * 0.5)
    ao = np.clip(0.35 + 0.65 * smooth(0.1, 0.7, h), 0, 1)
    return save_pair('bark', np.clip(albedo, 0, 1), h, 10.0, ao)


# ============================================================================= foliage atlases
def _leaf_poly(bx, by, ang, L, W, shape=1.2, curve=0.0, steps=10):
    ca, sa = math.cos(ang), math.sin(ang)
    left, right = [], []
    for s in range(steps + 1):
        t = s / steps
        w = math.sin(math.pi * min(1.0, t * 1.02)) ** shape * W / 2
        bend = curve * t * t * L
        px = bx + ca * L * t - sa * bend
        py = by + sa * L * t + ca * bend
        left.append((px - sa * w, py + ca * w))
        right.append((px + sa * w, py - ca * w))
    return left + right[::-1], (bx + ca * L * 0.92 - sa * curve * L * 0.85, by + sa * L * 0.92 + ca * curve * L * 0.85)


def _twig(d, rng, x, y, a, L, width, twig_col, leaf_fn, depth=0, max_depth=2, n_side=(2, 4), spread=0.7, seg=8):
    """Recursive twig drawn as a polyline; leaf_fn(x, y, angle, t, depth) decorates it."""
    pts = [(x, y)]
    for k in range(1, seg + 1):
        a += rng.normal(0, 0.07)
        x += math.cos(a) * L / seg
        y += math.sin(a) * L / seg
        pts.append((x, y))
    d.line(pts, fill=c255(twig_col), width=max(1, int(round(width))))
    for k in range(1, seg + 1):
        leaf_fn(pts[k][0], pts[k][1], a, k / seg, depth)
    if depth < max_depth:
        nb = int(rng.integers(n_side[0], n_side[1] + 1))
        for b in range(nb):
            k = int(rng.integers(1, seg))
            side = 1 if (b + depth) % 2 == 0 else -1
            _twig(d, rng, pts[k][0], pts[k][1], a + side * rng.uniform(0.35, 0.85) * spread / 0.7,
                  L * rng.uniform(0.4, 0.62), width * 0.65, twig_col, leaf_fn, depth + 1, max_depth, n_side, spread, seg)


def _fan(d, rng, cx, cy, c, S, twig_col, leaf_fn, n_twigs=5, fan=1.1, length=0.62, max_depth=2, n_side=(2, 4), spread=0.7):
    """A leafy cluster: several twigs fanning upward from the bottom-centre of a cell (fills the card)."""
    m = 0.1 * c

    def lf(px, py, a, t, depth):
        if m < px < c - m and m < py < c - m * 0.3:
            leaf_fn(px, py, a, t, depth)
    for i in range(n_twigs):
        a = -math.pi / 2 + (i / max(1, n_twigs - 1) - 0.5) * 2 * fan * 0.8 + rng.normal(0, 0.12)
        L = c * length * rng.uniform(0.75, 1.0) * (1.0 - 0.25 * abs(i / max(1, n_twigs - 1) - 0.5) * 2)
        _twig(d, rng, cx + rng.normal(0, c * 0.02), cy, a, L, 2.6 * S, twig_col, lf, 0, max_depth, n_side, spread)


def _atlas(name, n, cells, draw_cell, q=90):
    """cells x cells atlas of RGBA sprays; each cell drawn on its own clipped canvas."""
    S = 2
    N = n * S
    cell = N // cells
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    for i in range(cells * cells):
        sub = Image.new('RGBA', (cell, cell), (0, 0, 0, 0))
        d = ImageDraw.Draw(sub)
        draw_cell(d, np.random.default_rng(1000 + i * 17 + sum(map(ord, name))), 0, 0, cell, S, i)
        img.paste(sub, ((i % cells) * cell, (i // cells) * cell))
    img = img.resize((n, n), Image.LANCZOS)
    arr = np.asarray(img, dtype=F32) / 255.0
    rgb, a = arr[..., :3], arr[..., 3]
    rgb = _dilate(rgb, a)
    save_webp(rgb, name + '.webp', q=q, alpha=a)
    if PREVIEW:
        bg = np.ones_like(rgb) * np.array([0.55, 0.62, 0.72], F32)
        preview_tiled(rgb * a[..., None] + bg * (1 - a[..., None]), os.path.join(PREVIEW, name + '_prev.jpg'), reps=1, size=1024)
    print('   coverage %.2f' % a.mean())


def _dilate(rgb, a):
    from texlib import dilate_rgb
    return dilate_rgb(rgb, a, iters=40)


def olive_atlas(n=SIZE):
    """Olive sprays: narrow lanceolate leaves in opposite pairs, dark grey-green above, silvery below."""
    top = [col('#46513a'), col('#515c3f'), col('#5b6646'), col('#434c36')]
    under = [col('#a7ae98'), col('#b6bca7'), col('#9aa48c')]

    def cell(d, rng, x0, y0, c, S, idx):
        def leaf(px, py, a, t, depth):
            for side in (-1, 1):
                if rng.random() < 0.12:
                    continue
                L = rng.uniform(0.07, 0.11) * c * (1.0 - 0.18 * depth)
                ang = a + side * rng.uniform(0.3, 0.75)
                W = L * rng.uniform(0.15, 0.2)
                poly, tip = _leaf_poly(px, py, ang, L, W, shape=1.1, curve=side * rng.uniform(-0.05, 0.12))
                silver = rng.random() < 0.35
                base = (under if silver else top)[rng.integers(3)] * rng.uniform(0.85, 1.12)
                d.polygon(poly, fill=c255(np.clip(base, 0, 1)))
                d.line([(px, py), tip], fill=c255(np.clip(base * (1.22 if not silver else 1.05), 0, 1)), width=max(1, S // 2 + 1))
            if t > 0.95:
                poly, tip = _leaf_poly(px, py, a, 0.08 * c, 0.014 * c, shape=1.1)
                d.polygon(poly, fill=c255(top[1]))
        _fan(d, rng, c * 0.5, c * 0.97, c, S, col('#6b5b47'), leaf, n_twigs=4 + idx % 2, fan=1.0, length=0.6, max_depth=2, n_side=(2, 3))
    _atlas('olive_leaves', n, 2, cell)


def cypress_atlas(n=SIZE):
    """Mediterranean cypress: dense, finely divided scale-leaf sprays (tiny overlapping scales on
    branchlets), very dark green with slightly lighter, yellower growing tips."""
    greens = [col('#223019'), col('#2a381e'), col('#324224'), col('#3c4c2a')]
    tip = col('#58683a')

    def cell(d, rng, x0, y0, c, S, idx):
        def leaf(px, py, a, t, depth):
            if depth < 1:
                return
            for k in range(4):
                u = rng.uniform(-0.5, 0.5)
                qx = px - math.cos(a) * u * c * 0.02
                qy = py - math.sin(a) * u * c * 0.02
                r = rng.uniform(0.005, 0.009) * c
                g = lerp(greens[rng.integers(4)] * rng.uniform(0.85, 1.15), tip, (t * 0.6 if depth >= 2 else 0.1) * rng.random())
                ca, sa = math.cos(a + rng.normal(0, 0.4)), math.sin(a + rng.normal(0, 0.4))
                pts = [(qx + ca * r * 1.8, qy + sa * r * 1.8), (qx - sa * r, qy + ca * r), (qx - ca * r * 1.2, qy - sa * r * 1.2), (qx + sa * r, qy - ca * r)]
                d.polygon(pts, fill=c255(np.clip(g, 0, 1)))
        _fan(d, rng, c * 0.5, c * 0.98, c, S, col('#3e3226'), leaf, n_twigs=5, fan=0.75, length=0.66, max_depth=3, n_side=(3, 4), spread=0.55)
    _atlas('cypress_leaves', n, 2, cell)


def broadleaf_atlas(n=SIZE):
    """Cells: 0/1 Palestine oak (Quercus calliprinos: small leathery, spiny-edged leaves),
    2 carob (pinnate, round glossy leaflets), 3 terebinth (Pistacia palaestina: pinnate, pointed leaflets)."""
    oak_top = [col('#33402a'), col('#3b4a2e'), col('#445333')]
    oak_under = [col('#69734f'), col('#747d5a')]
    carob = [col('#2c3e25'), col('#33472a'), col('#3d5331')]
    tere = [col('#44532e'), col('#506035'), col('#5a6839'), col('#6a573a')]

    def cell(d, rng, x0, y0, c, S, idx):
        if idx < 2:
            def leaf(px, py, a, t, depth):
                for side in (-1, 1):
                    if rng.random() < 0.1:
                        continue
                    L = rng.uniform(0.04, 0.06) * c
                    ang = a + side * rng.uniform(0.4, 1.1)
                    W = L * rng.uniform(0.5, 0.65)
                    poly, tip = _leaf_poly(px, py, ang, L, W, shape=0.7)
                    poly = [(x + rng.normal(0, S * 0.8), y + rng.normal(0, S * 0.8)) for (x, y) in poly]
                    under = rng.random() < 0.22
                    base = (oak_under if under else oak_top)[rng.integers(2)] * rng.uniform(0.85, 1.15)
                    d.polygon(poly, fill=c255(np.clip(base, 0, 1)))
                    d.line([(px, py), tip], fill=c255(np.clip(base * 1.2, 0, 1)), width=max(1, S // 2))
            _fan(d, rng, c * 0.5, c * 0.97, c, S, col('#5a4a3a'), leaf, n_twigs=5, fan=1.1, length=0.58, max_depth=2, n_side=(3, 4))
        else:
            pal = carob if idx == 2 else tere

            def leaf(px, py, a, t, depth):
                if rng.random() < 0.35 or t < 0.15:
                    return
                side = rng.choice([-1, 1])
                ra = a + side * rng.uniform(0.5, 1.0)
                RL = rng.uniform(0.12, 0.17) * c
                ex, ey = px + math.cos(ra) * RL, py + math.sin(ra) * RL
                d.line([(px, py), (ex, ey)], fill=c255(col('#5d5037')), width=max(1, S))
                pairs = 3 if idx == 2 else 5
                for k in range(pairs):
                    tt = (k + 1) / (pairs + 0.5)
                    qx, qy = px + (ex - px) * tt, py + (ey - py) * tt
                    for s2 in (-1, 1):
                        L = (rng.uniform(0.045, 0.06) if idx == 2 else rng.uniform(0.04, 0.055)) * c
                        W = L * (0.75 if idx == 2 else 0.38)
                        poly, tip = _leaf_poly(qx, qy, ra + s2 * 1.1, L, W, shape=0.6 if idx == 2 else 1.0)
                        base = pal[rng.integers(len(pal))] * rng.uniform(0.85, 1.15)
                        d.polygon(poly, fill=c255(np.clip(base, 0, 1)))
                if idx == 3:
                    poly, tip = _leaf_poly(ex, ey, ra, 0.045 * c, 0.018 * c)
                    d.polygon(poly, fill=c255(pal[1]))
            _fan(d, rng, c * 0.5, c * 0.97, c, S, col('#5d4c3a'), leaf, n_twigs=4, fan=1.0, length=0.55, max_depth=2, n_side=(2, 3))
    _atlas('broadleaf_leaves', n, 2, cell)


def shrub_atlas(n=SIZE):
    """Cells: 0 thorny burnet (Sarcopoterium spinosum) cushion, 1 Greek sage (Salvia fruticosa),
    2 dry thistle (Notobasis / Silybum, early summer), 3 wild oats / barley grass tuft with seed heads.
    Side views (cards stand upright), ground line at the bottom of each cell."""
    def cell(d, rng, x0, y0, c, S, idx):
        gx, gy = c * 0.5, c * 0.985
        if idx == 0:
            # dome of tangled grey twigs with thorns and tiny grey-green leaflets, a few rusty tips
            cy0 = gy
            for k in range(900):
                u, v = rng.uniform(-1, 1), rng.uniform(0, 1)
                if u * u + v * v > 1:
                    continue
                x = gx + u * 0.46 * c
                y = cy0 - v * 0.52 * c
                a = rng.uniform(0, math.tau)
                L = rng.uniform(0.02, 0.06) * c
                d.line([(x, y), (x + math.cos(a) * L, y + math.sin(a) * L)], fill=c255(col('#7a6b5a') * rng.uniform(0.75, 1.1)), width=max(1, S // 2 + 1))
            greens = [col('#7b8465'), col('#8c9574'), col('#6d785a'), col('#9e9169'), col('#8a5f47')]
            for k in range(2600):
                u, v = rng.uniform(-1, 1), rng.uniform(0, 1)
                rr = u * u + v * v
                if rr > 1:
                    continue
                x = gx + u * 0.47 * c
                y = cy0 - v * 0.54 * c
                s_ = rng.uniform(1.6, 3.6) * S
                g = greens[min(4, int(rng.random() ** 2.5 * 5))] * rng.uniform(0.8, 1.15) * (0.75 + 0.4 * math.sqrt(rr))
                d.ellipse([x - s_, y - s_ * 0.7, x + s_, y + s_ * 0.7], fill=c255(np.clip(g, 0, 1)))
        elif idx == 1:
            sage = [col('#87907a'), col('#97a088'), col('#788369'), col('#a4ab95')]
            for k in range(34):
                sx = gx + rng.normal(0, 0.1) * c
                a = -math.pi / 2 + rng.normal(0, 0.38)
                L = rng.uniform(0.35, 0.8) * c
                pts = [(sx, gy)]
                x, y = sx, gy
                for j in range(8):
                    a += rng.normal(0, 0.06)
                    x += math.cos(a) * L / 8
                    y += math.sin(a) * L / 8
                    pts.append((x, y))
                d.line(pts, fill=c255(col('#8a7a62')), width=max(1, S))
                for j in range(1, 9):
                    px, py = pts[j]
                    for side in (-1, 1):
                        if rng.random() < 0.25:
                            continue
                        LL = rng.uniform(0.045, 0.085) * c * (1.1 - j / 12)
                        poly, tip = _leaf_poly(px, py, a + side * rng.uniform(0.5, 1.0), LL, LL * 0.38, shape=0.8)
                        g = sage[rng.integers(4)] * rng.uniform(0.85, 1.12)
                        d.polygon(poly, fill=c255(np.clip(g, 0, 1)))
        elif idx == 2:
            straw = [col('#ad9467'), col('#c1a775'), col('#977f57')]
            for k in range(9):
                a = -math.pi / 2 + rng.normal(0, 0.25)
                L = rng.uniform(0.45, 0.9) * c
                sx = gx + rng.normal(0, 0.06) * c
                ex, ey = sx + math.cos(a) * L, gy + math.sin(a) * L
                d.line([(sx, gy), (ex, ey)], fill=c255(straw[0]), width=max(1, int(1.6 * S)))
                for j in range(6):
                    tt = rng.uniform(0.05, 0.85)
                    px, py = sx + (ex - sx) * tt, gy + (ey - gy) * tt
                    side = rng.choice([-1, 1])
                    poly, tip = _leaf_poly(px, py, a + side * rng.uniform(0.6, 1.3), 0.11 * c * (1.2 - tt), 0.04 * c, shape=0.5)
                    poly = [(x + rng.normal(0, 2.5 * S), y + rng.normal(0, 2.5 * S)) for (x, y) in poly]
                    d.polygon(poly, fill=c255(straw[rng.integers(3)] * rng.uniform(0.8, 1.05)))
                # spiny head: involucre of stiff bracts, remains of the florets
                r = rng.uniform(0.024, 0.038) * c
                for j in range(26):
                    b = rng.uniform(0, math.tau)
                    d.line([(ex, ey), (ex + math.cos(b) * r * 1.9, ey + math.sin(b) * r * 1.5)], fill=c255(col('#a48d64')), width=max(1, S // 2 + 1))
                d.ellipse([ex - r, ey - r * 0.9, ex + r, ey + r * 0.9], fill=c255(col('#7e6846')))
                fl = col('#d8cdb6') if rng.random() < 0.5 else col('#6e4a5c')
                d.ellipse([ex - r * 0.6, ey - r * 1.35, ex + r * 0.6, ey - r * 0.35], fill=c255(fl))
        else:
            gold = [col('#d2b97e'), col('#c5a766'), col('#dfcc98'), col('#b69659')]
            for k in range(56):
                sx = gx + rng.normal(0, 0.09) * c
                a = -math.pi / 2 + rng.normal(0, 0.2)
                L = rng.uniform(0.45, 0.92) * c
                pts = [(sx, gy)]
                x, y = sx, gy
                bend = rng.normal(0, 0.012)
                for j in range(10):
                    a += bend
                    x += math.cos(a) * L / 10
                    y += math.sin(a) * L / 10
                    pts.append((x, y))
                g = gold[rng.integers(4)] * rng.uniform(0.85, 1.1)
                d.line(pts, fill=c255(np.clip(g, 0, 1)), width=max(1, S))
                if rng.random() < 0.75:
                    if rng.random() < 0.5:
                        for j in range(9):
                            tt = j / 9
                            px, py = x + math.cos(a) * 0.1 * c * tt, y + math.sin(a) * 0.1 * c * tt
                            for side in (-1, 1):
                                poly, tip = _leaf_poly(px, py, a + side * 0.35, 0.03 * c, 0.012 * c, shape=0.8)
                                d.polygon(poly, fill=c255(np.clip(g * 1.05, 0, 1)))
                                d.line([tip, (tip[0] + math.cos(a + side * 0.25) * 0.08 * c, tip[1] + math.sin(a + side * 0.25) * 0.08 * c)], fill=c255(np.clip(g * 1.1, 0, 1)), width=1)
                    else:
                        for j in range(7):
                            b = a + rng.normal(0, 0.9)
                            Lb = rng.uniform(0.04, 0.09) * c
                            bx, by = x + math.cos(b) * Lb, y + math.sin(b) * Lb
                            d.line([(x, y), (bx, by)], fill=c255(np.clip(g, 0, 1)), width=1)
                            poly, tip = _leaf_poly(bx, by, math.pi / 2 + rng.normal(0, 0.3), 0.035 * c, 0.012 * c)
                            d.polygon(poly, fill=c255(np.clip(g * 1.08, 0, 1)))
                if rng.random() < 0.6:
                    poly, tip = _leaf_poly(sx, gy - 0.02 * c, a + rng.normal(0, 0.5), 0.25 * c, 0.02 * c, shape=0.9, curve=rng.normal(0, 0.15))
                    d.polygon(poly, fill=c255(gold[3] * 0.85))
    _atlas('shrub_leaves', n, 2, cell)


# ============================================================================= main
TEXTURES = {
    'limestone': limestone,
    'ground': ground,
    'soil': soil,
    'gravel': gravel,
    'drywall': drywall,
    'masonry': masonry,
    'bark': lambda n: bark(512),
    'olive': olive_atlas,
    'cypress': cypress_atlas,
    'broadleaf': broadleaf_atlas,
    'shrub': shrub_atlas,
}

if __name__ == '__main__':
    args = sys.argv[1:]
    if '--preview' in args:
        i = args.index('--preview')
        PREVIEW = args[i + 1]
        del args[i:i + 2]
    if '--size' in args:
        i = args.index('--size')
        SIZE = int(args[i + 1])
        del args[i:i + 2]
    names = args or list(TEXTURES)
    for nm in names:
        TEXTURES[nm](SIZE)
