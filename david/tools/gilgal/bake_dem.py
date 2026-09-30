#!/usr/bin/env python3
"""
Bake the real terrain of the lower Jordan Valley around Gilgal (Josh 4:19 "at the eastern edge of Jericho") for the
Gilgal film set (src/film/gilgal).

Input : NASA SRTM GL1 (1 arc-second, public domain) tile N31E035 (.hgt or .hgt.gz), path as argv[1]
        (default: the scratch copy used during development).
Output: src/assets/gilgal/jordan_dem.binz      gzip( int16[N*N] ), row-major, row = +Z (south), col = +X (east);
                                              value = (elevation - ORIGIN_ELEV) * 4   (0.25 m steps)
        src/assets/gilgal/gilgal_features.json grid meta, the Jordan's course (thalweg of the Zor, lightly meandered),
                                              Iron Age Dead Sea level (conjecture, see below)

Set frame: metres, +X = east, +Z = south, +Y = up, origin = the Gilgal site at lat 31.862 N, lon 35.470 E
(between Tel Jericho and the Jordan; the exact site of Gilgal is unknown - Josh 4:19 only says "the eastern edge of
Jericho" - this is a representative spot ~3 km east of Tel es-Sultan). y = 0 at the site's ground (-266 m ASL).
"""
import gzip
import json
import math
import os
import sys

import numpy as np
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'src', 'assets', 'gilgal')

LAT0, LON0 = 31.862, 35.470
N = 1024
DX = 48.0
X0, Z0 = -25000.0, -17000.0
# Dead Sea level c. 1000 BCE: lake-level curves (Migowski et al. 2006; Bookman et al. 2004) put the Iron Age lake
# some 20-30 m above the modern (2000 CE) -415 m surface; -395 m is used (conjecture, stated in the report)
DEAD_SEA_ASL = -395.0


def load_tile(path):
    raw = gzip.open(path).read() if path.endswith('.gz') else open(path, 'rb').read()
    n = int(round(math.sqrt(len(raw) // 2)))
    a = np.frombuffer(raw, dtype='>i2').reshape(n, n).astype(np.float32)
    a[a < -1000] = np.nan
    if np.isnan(a).any():
        idx = ndimage.distance_transform_edt(np.isnan(a), return_distances=False, return_indices=True)
        a = a[tuple(idx)]
    return a, n


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/-home-user-Test-1-/aa9d8085-4598-5292-aa4e-bfc8e4c43335/scratchpad/gilgal/N31E035.hgt.gz'
    a, n = load_tile(src)
    a = ndimage.gaussian_filter(a, 0.8)
    mx = 111320.0 * math.cos(math.radians(LAT0))
    mz = 110900.0
    xs = X0 + np.arange(N) * DX
    zs = Z0 + np.arange(N) * DX
    X, Z = np.meshgrid(xs, zs)
    lat = LAT0 - Z / mz
    lon = LON0 + X / mx
    row = (32.0 - lat) * (n - 1)
    col = (lon - 35.0) * (n - 1)
    h = ndimage.map_coordinates(a, [row, col], order=1, mode='nearest')
    elev0 = float(ndimage.map_coordinates(a, [[(32.0 - LAT0) * (n - 1)], [(LON0 - 35.0) * (n - 1)]], order=1)[0])
    print('origin elevation', elev0, 'range', h.min(), h.max())
    rel = h - elev0
    q = np.clip(np.round(rel * 4.0), -32767, 32767).astype('<i2')
    os.makedirs(OUT, exist_ok=True)
    with gzip.open(os.path.join(OUT, 'jordan_dem.binz'), 'wb', compresslevel=9) as f:
        f.write(q.tobytes())

    # ---- the Jordan: lowest line of the Zor per row, north of the Dead Sea
    sm = ndimage.gaussian_filter(h, 2.0)
    pts = []
    cx = None
    for j in range(N):
        z = zs[j]
        if z > 14000:
            break
        lo, hi = (3000.0, 11000.0) if cx is None else (cx - 700.0, cx + 700.0)
        i0 = max(0, int((lo - X0) / DX))
        i1 = min(N - 1, int((hi - X0) / DX))
        seg = sm[j, i0:i1]
        i = i0 + int(np.argmin(seg))
        x = xs[i]
        if sm[j, i] <= DEAD_SEA_ASL + 1.0:
            break  # reached the lake
        cx = x if cx is None else 0.7 * cx + 0.3 * x
        pts.append([float(cx), float(z)])
    p = np.array(pts)
    p[:, 0] = ndimage.gaussian_filter1d(p[:, 0], 6.0, mode='nearest')
    # the river's own meanders inside the Zor (the DEM only resolves the floodplain): two superposed sine trains
    zz = p[:, 1]
    mea = 120.0 * np.sin(zz / 260.0 + 0.8) * (0.6 + 0.4 * np.sin(zz / 1300.0)) + 45.0 * np.sin(zz / 97.0 + 2.1)
    p[:, 0] += mea
    river = [[round(float(x), 1), round(float(z), 1)] for x, z in p[::2]]

    # ---- land-cover mask (RGBA, same grid, lossless): R = the Jordan thicket (ge'on ha-Yarden: tamarisk, willow,
    # poplar, cane), G = the pale marl badlands (qattara) between the plain and the Zor, B = the oasis of Jericho
    # (spring-fed gardens and palm groves), A = the Dead Sea (Iron Age level)
    from PIL import Image
    rmask = np.zeros((N, N), np.uint8)
    for x, z in p:
        i, j = int((x - X0) / DX), int((z - Z0) / DX)
        if 0 <= i < N and 0 <= j < N:
            rmask[j, i] = 1
    dist = ndimage.distance_transform_edt(rmask == 0) * DX
    rng = np.random.default_rng(3)
    noise = ndimage.gaussian_filter(rng.standard_normal((N, N)), 3.0)
    noise = noise / (np.abs(noise).max() + 1e-6)
    zor_floor = (h < -345.0).astype(np.float32)
    thicket = np.clip(1.0 - (dist - 60.0) / (330.0 + 180.0 * noise), 0, 1) * zor_floor
    thicket = np.maximum(thicket, zor_floor * np.clip(0.35 + noise * 0.6, 0, 1) * np.clip(1 - dist / 1400.0, 0, 1))
    gy, gx = np.gradient(sm, DX)
    slope = np.sqrt(gx * gx + gy * gy)
    near_river = np.clip(1.0 - (dist - 1500.0) / 1800.0, 0, 1)
    marl = np.clip((slope - 0.03) / 0.07, 0, 1) * near_river * ((h > -380) & (h < -250)).astype(np.float32)
    marl = ndimage.gaussian_filter(np.maximum(marl, near_river * ((h > -372) & (h < -300)) * 0.55), 1.0)
    # the oasis: Ein es-Sultan (31.871 N, 35.444 E) and the Wadi Qelt fan (Tulul Abu el-Alayiq, 31.852 N, 35.425 E)
    def at(la, lo):
        return (lo - LON0) * mx, (LAT0 - la) * mz
    oasis = np.zeros((N, N), np.float32)
    for (la, lo, r) in [(31.871, 35.444, 2300.0), (31.852, 35.428, 1500.0), (31.862, 35.462, 1300.0)]:
        cx0, cz0 = at(la, lo)
        d = np.sqrt((X - cx0) ** 2 + (Z - cz0) ** 2)
        oasis = np.maximum(oasis, np.clip(1 - (d - r * 0.55) / (r * 0.45 + 400 * noise), 0, 1))
    oasis *= ((h > -300) & (h < -120) & (slope < 0.06)).astype(np.float32)
    sea = (h < DEAD_SEA_ASL + 0.5).astype(np.float32) * (Z > 5000)
    sea = ndimage.gaussian_filter(sea, 0.8)
    img = np.dstack([thicket, np.clip(marl, 0, 1), np.clip(oasis, 0, 1), np.clip(sea, 0, 1)])
    Image.fromarray((img * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, 'jordan_mask.png'), optimize=True)

    # ---- relief map (RG, lossless): R = cavity (0.5 neutral, < 0.5 hollows / wadi beds, > 0.5 ridges and spurs) from
    # the Laplacian of the DEM at two scales; G = drainage (D8 flow accumulation, log-scaled): the wadis that cut the
    # desert and the plain, lined with acacia, tamarisk and retama - they make the land readable from the air
    lap = ndimage.gaussian_laplace(h, 1.2) * 0.6 + ndimage.gaussian_laplace(h, 4.0) * 1.6
    cav = np.clip(0.5 - lap / 6.0, 0, 1)
    hs = ndimage.gaussian_filter(h, 0.7)
    order = np.argsort(-hs, axis=None)
    acc = np.ones(N * N, np.float64)
    flat = hs.ravel()
    offs = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    # lowest neighbour per cell (vectorised), then accumulate in elevation order
    pad = np.pad(hs, 1, mode='edge')
    best = np.full((N, N), -1, np.int64)
    bestv = hs.copy()
    jj, ii = np.mgrid[0:N, 0:N]
    for dj, di in offs:
        nb = pad[1 + dj:N + 1 + dj, 1 + di:N + 1 + di]
        w = 1.0 / np.hypot(dj, di)
        better = (hs - nb) * w > (hs - bestv) * 1.0 + 1e-6
        tj = np.clip(jj + dj, 0, N - 1)
        ti = np.clip(ii + di, 0, N - 1)
        upd = better & (nb < bestv)
        best[upd] = (tj * N + ti)[upd]
        bestv = np.where(upd, nb, bestv)
    bflat = best.ravel()
    for k in order:
        b = bflat[k]
        if b >= 0:
            acc[b] += acc[k]
    acc = acc.reshape(N, N)
    drain = np.clip((np.log(acc) - 2.5) / 5.0, 0, 1)
    drain = ndimage.gaussian_filter(drain, 0.6)
    rel = np.dstack([cav, drain, np.zeros_like(cav)])
    Image.fromarray((np.clip(rel, 0, 1) * 255).astype(np.uint8), 'RGB').save(os.path.join(OUT, 'jordan_relief.webp'), 'WEBP', quality=88, method=6)

    # ---- palm positions of the oasis (far groves, drawn as low-detail palms), clustered in groves
    prng = np.random.default_rng(77)
    grove = ndimage.gaussian_filter(prng.standard_normal((N, N)), 6.0)
    grove = grove / (np.abs(grove).max() + 1e-6)
    palms = []
    tries = 0
    while len(palms) < 2600 and tries < 400000:
        tries += 1
        x = prng.uniform(-6500, 1500)
        z = prng.uniform(-5000, 3500)
        i, j = int((x - X0) / DX), int((z - Z0) / DX)
        o = oasis[j, i]
        g = grove[j, i]
        if o < 0.3 or g < 0.05 or prng.random() > o * min(1.0, g * 6.0):
            continue
        if abs(x) < 450 and abs(z) < 300:
            continue  # the set itself places its own palms near the site
        palms.append([int(round(x)), int(round(z))])
    feats_palms = [v for p2 in palms for v in p2]
    feats = {
        'origin': {'lat': LAT0, 'lon': LON0, 'elevation': round(elev0, 2)},
        'grid': {'n': N, 'dx': DX, 'x0': X0, 'z0': Z0, 'scale': 0.25, 'file': 'jordan_dem.binz'},
        'deadSeaY': round(DEAD_SEA_ASL - elev0, 2),
        'jordan': river,
        'palms': feats_palms,
        'source': 'NASA SRTM GL1 v3 (1 arc-second), tile N31E035, public domain; baked by tools/gilgal/bake_dem.py',
    }
    with open(os.path.join(OUT, 'gilgal_features.json'), 'w') as f:
        json.dump(feats, f, separators=(',', ':'))
    print('river points', len(river), 'first', river[0], 'last', river[-1])
    print('wrote', os.path.getsize(os.path.join(OUT, 'jordan_dem.binz')), 'bytes')


if __name__ == '__main__':
    main()
