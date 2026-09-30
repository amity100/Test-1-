#!/usr/bin/env python3
"""
Build the real-elevation assets of the opening film's land sets (src/film/land).

Source: NASA SRTM 1 arc-second (SRTMGL1, public domain), tiles N31E034 + N31E035 as served by the Mapzen / AWS
"skadi" open-data set (mirrored as release assets of github.com/shalomfr/amshinov-terrain-tiles).

    python3 tools/land/build_dem.py [--dem DIR] [--preview DIR]

Outputs (src/assets/land/):
  <tile>.binz      gzip( 'LDEM' | int32 w | int32 h | f32 x0 | f32 z0 | f32 dx | f32 dz | int16[h*w] decimetres )
  <tile>_lc.webp   lossless RGBA landcover: R aridity, G drainage (wadis), B water, A valley depth (mist)

Local frame: metres, origin Bethlehem (31.7054 N, 35.2024 E), +X east, +Z south (-Z north), sea level y = 0.
"""
import argparse
import gzip
import os
import struct
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'src', 'assets', 'land')

LAT0, LON0 = 31.7054, 35.2024
KX = 111320.0 * np.cos(np.radians(LAT0))  # metres per degree of longitude
KZ = 110574.0                              # metres per degree of latitude
# Iron Age I-IIA Dead Sea level: higher than the 2000 CE SRTM surface (-415 m); lake-level reconstructions
# (Migowski et al. 2006, Bookman et al. 2004) put the early 1st millennium BCE lake around -400 m or higher.
DEAD_SEA_LEVEL = -398.0

TILES = {
    # name: (x0, x1, z0, z1, spacing)  in local metres
    'region': (-80000.0, 72000.0, -32400.0, 48000.0, 150.0),
    'judah': (-9000.0, 17000.0, -13000.0, 9000.0, 30.0),
    # Ashdod, its dunes and shore, and the plain east of it (the host marches inland from the city)
    'coast': (-60000.0, -44000.0, -12000.0, 4000.0, 30.0),
    'ramah': (-1500.0, 7500.0, -20500.0, -11500.0, 30.0),
}


def load_mosaic(dem_dir):
    tiles = {}
    for name in ('N31E034', 'N31E035'):
        p = os.path.join(dem_dir, name + '.hgt.gz')
        with gzip.open(p, 'rb') as f:
            a = np.frombuffer(f.read(), dtype='>i2').reshape(3601, 3601).astype(np.float32)
        a[a < -1000] = np.nan
        tiles[name] = a
    m = np.concatenate([tiles['N31E034'][:, :3600], tiles['N31E035']], axis=1)  # lat 32..31 (rows), lon 34..36
    # voids: fill by nearest valid
    bad = np.isnan(m)
    if bad.any():
        idx = ndimage.distance_transform_edt(bad, return_distances=False, return_indices=True)
        m = m[tuple(idx)]
    return m  # shape (3601, 7201); row r -> lat 32 - r/3600 ; col c -> lon 34 + c/3600


def sample(m, x, z):
    lon = LON0 + x / KX
    lat = LAT0 - z / KZ
    r = (32.0 - lat) * 3600.0
    c = (lon - 34.0) * 3600.0
    r = np.clip(r, 0, 3600)
    c = np.clip(c, 0, 7200)
    return ndimage.map_coordinates(m, [r, c], order=1, mode='nearest')


def build_tile(m, name, x0, x1, z0, z1, dx, preview=None):
    w = int(round((x1 - x0) / dx)) + 1
    h = int(round((z1 - z0) / dx)) + 1
    xs = x0 + np.arange(w) * dx
    zs = z0 + np.arange(h) * dx
    X, Z = np.meshgrid(xs, zs)
    lon = LON0 + X / KX
    lat = LAT0 - Z / KZ
    # pre-filter a little when down-sampling (anti-alias the 30 m source)
    src = m
    if dx > 40:
        src = ndimage.gaussian_filter(m, sigma=(dx / 30.0) * 0.45)
    H = sample(src, X, Z).astype(np.float32)
    outside = (lat > 32.0) | (lat < 31.0) | (lon < 34.0) | (lon > 36.0)
    # --- water ----------------------------------------------------------------------------------------------
    # Mediterranean: at / below 0 m and connected to the west edge
    seaCand = (H <= 0.6) & (X < -30000)
    lab, n = ndimage.label(seaCand)
    west = set(np.unique(lab[:, 0])) - {0}
    sea = np.isin(lab, list(west)) if west else np.zeros_like(seaCand)
    # Dead Sea at the Iron Age level: everything in the rift below the level, connected to the deepest basin
    dsCand = (H <= DEAD_SEA_LEVEL) & (X > 15000)
    lab2, n2 = ndimage.label(dsCand)
    if n2:
        sizes = ndimage.sum(dsCand, lab2, range(1, n2 + 1))
        keep = [i + 1 for i, s in enumerate(sizes) if s > 50]
        ds = np.isin(lab2, keep)
    else:
        ds = np.zeros_like(dsCand)
    water = sea | ds
    Hs = H.copy()
    Hs[sea] = np.minimum(Hs[sea], -6.0)                         # sea floor just below the water plane
    Hs[ds] = np.minimum(Hs[ds], DEAD_SEA_LEVEL - 8.0)
    # --- aridity: rain shadow east of the Judean watershed; the rift floor is desert; the Moab plateau is steppe
    sm = ndimage.gaussian_filter(H, sigma=max(1.0, 2500.0 / dx))
    ws = np.zeros(h, dtype=np.float32)
    for j in range(h):
        sel = (xs > -25000) & (xs < 14000)
        if sel.sum() < 3:
            ws[j] = 3000.0
            continue
        row = sm[j, sel]
        ws[j] = xs[sel][int(np.argmax(row))]
    ws = ndimage.gaussian_filter1d(ws, sigma=max(1.0, 3000.0 / dx))
    WS = ws[:, None]
    ar_east = np.clip((X - WS - 1500.0) / 13000.0, 0, 1) ** 0.8
    ar_rift = np.clip((200.0 - H) / 350.0, 0, 1) * (X > 10000)
    moab = (X > 32000) & (H > 450)
    ar_moab = np.where(moab, np.clip(1.0 - (H - 450) / 700.0, 0.45, 1.0), 1.0)
    arid = np.maximum(ar_east, ar_rift)
    arid = np.where(X > 32000, np.minimum(arid, ar_moab) * (H > -300) + (H <= -300), arid)
    # the coastal plain and Shephelah: semi-humid, sandier toward the sea
    arid = np.where(X < WS - 1500, 0.08 + 0.18 * np.clip((WS - 1500 - X) / 40000.0, 0, 1), arid)
    arid = ndimage.gaussian_filter(arid, sigma=max(1.0, 800.0 / dx))
    # --- drainage (D8 flow accumulation on the filled surface) ---------------------------------------------------
    acc = flow_accumulation(Hs, dx)
    drain = np.clip(np.log1p(acc * dx * dx / 1e6) / np.log1p(40.0), 0, 1)  # upstream area, km^2 scale
    # --- valley depth (for dawn mist) -------------------------------------------------------------------------
    blur = ndimage.gaussian_filter(Hs, sigma=max(1.0, 700.0 / dx))
    vd = np.clip(blur - Hs, 0, 250.0) / 250.0
    vd[water] = 0
    lc = np.stack([
        np.clip(arid * 255, 0, 255),
        np.clip(drain * 255, 0, 255),
        np.where(water, 255, 0),
        np.clip(vd * 255, 0, 255),
    ], axis=-1).astype(np.uint8)
    # outside the data (north of 32 N): mirrored terrain, flagged by nothing; the runtime fades it into haze
    # --- write ---------------------------------------------------------------------------------------------
    dm = np.clip(np.round(Hs * 10.0), -32768, 32767).astype('<i2')
    head = b'LDEM' + struct.pack('<ii', w, h) + struct.pack('<ffff', x0, z0, dx, dx)
    with gzip.open(os.path.join(OUT, name + '.binz'), 'wb', compresslevel=9) as f:
        f.write(head + dm.tobytes())
    Image.fromarray(lc, 'RGBA').save(os.path.join(OUT, name + '_lc.webp'), lossless=True, quality=100, method=6)
    sz = os.path.getsize(os.path.join(OUT, name + '.binz')) + os.path.getsize(os.path.join(OUT, name + '_lc.webp'))
    print(f'{name}: {w}x{h} @ {dx:.0f} m, h {Hs.min():.0f}..{Hs.max():.0f} m, water {water.mean()*100:.1f}%, {sz/1024:.0f} KB',
          f'(outside data {outside.mean()*100:.1f}%)')
    if preview:
        shade = hillshade(Hs, dx)
        rgb = np.stack([shade * (0.55 + 0.45 * arid), shade * (0.75 - 0.2 * arid + 0.25 * drain), shade * (0.6 - 0.3 * arid)], -1)
        rgb[water] = [0.1, 0.25, 0.45]
        Image.fromarray(np.clip(rgb * 255, 0, 255).astype(np.uint8)).save(os.path.join(preview, name + '_preview.png'))


def hillshade(H, dx, az=100.0, el=25.0):
    gy, gx = np.gradient(H, dx)
    nx, nz, ny = -gx, -gy, np.ones_like(H)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    a, e = np.radians(az), np.radians(el)
    sx, sz, sy = np.sin(a) * np.cos(e), -np.cos(a) * np.cos(e), np.sin(e)  # az from north, clockwise
    return np.clip((nx * sx + ny * sy + nz * sz) / l, 0, 1) * 0.85 + 0.15


def flow_accumulation(H, dx):
    h, w = H.shape
    # fill small pits by a smoothed surface blend (good enough for visual wadis)
    Hf = np.maximum(H, ndimage.minimum_filter(ndimage.maximum_filter(H, 3), 3) - 0.01)
    pad = np.pad(Hf, 1, mode='edge')
    best = np.zeros((h, w), dtype=np.int64)
    bestDrop = np.zeros((h, w), dtype=np.float32)
    offs = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    ii, jj = np.meshgrid(np.arange(h), np.arange(w), indexing='ij')
    for k, (di, dj) in enumerate(offs):
        nb = pad[1 + di:1 + di + h, 1 + dj:1 + dj + w]
        drop = (Hf - nb) / (np.hypot(di, dj))
        better = drop > bestDrop
        bestDrop = np.where(better, drop, bestDrop)
        best = np.where(better, k + 1, best)
    di = np.array([0] + [o[0] for o in offs])[best]
    dj = np.array([0] + [o[1] for o in offs])[best]
    ti = np.clip(ii + di, 0, h - 1)
    tj = np.clip(jj + dj, 0, w - 1)
    target = (ti * w + tj).ravel()
    has = (best > 0).ravel()
    order = np.argsort(-Hf.ravel(), kind='stable')
    acc = np.ones(h * w, dtype=np.float64)
    tgt = target
    for idx in order:  # highest first: pass accumulated area downhill
        if has[idx]:
            acc[tgt[idx]] += acc[idx]
    return acc.reshape(h, w)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dem', default='/tmp/claude-0/-home-user-Test-1-/aa9d8085-4598-5292-aa4e-bfc8e4c43335/scratchpad/land/dem')
    ap.add_argument('--preview', default=None)
    ap.add_argument('tiles', nargs='*')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    if a.preview:
        os.makedirs(a.preview, exist_ok=True)
    m = load_mosaic(a.dem)
    print('mosaic', m.shape, float(np.nanmin(m)), float(np.nanmax(m)))
    for name, (x0, x1, z0, z1, dx) in TILES.items():
        if a.tiles and name not in a.tiles:
            continue
        build_tile(m, name, x0, x1, z0, z1, dx, a.preview)


if __name__ == '__main__':
    sys.exit(main())
