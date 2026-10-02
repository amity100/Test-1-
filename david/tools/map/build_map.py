#!/usr/bin/env python3
"""
Build the assets of the opening film's REALISTIC 3D MAP (CUT v5, P4 'map-exodus' + P5 'map-tribes';
src/film/map/MapSet.ts): real elevation and real natural colour of the region from the Nile delta and the Gulf of
Suez to the Galilee and the Bashan, restored to ~1000 BCE (nothing modern), baked into small textures per tier.

    python3 tools/map/build_map.py [--cache DIR] [--preview DIR]

Inputs (downloaded into --cache when missing; all public domain):
  * elevation: AWS Open Data "Terrain Tiles" (s3://elevation-tiles-prod, terrarium PNG encoding:
    h = R*256 + G + B/256 - 32768 m) — SRTM 3" on land, ETOPO1 / GMTED / GEBCO-derived bathymetry at sea.
    z9 tiles over the map region (~270 m / px), z5 tiles for the far globe at the horizon.
  * natural colour: Natural Earth I "NE1_HR_LC" (land cover, 1 arc-minute, NO baked shading; public domain,
    naturalearth.s3.amazonaws.com/10m_raster/NE1_HR_LC.zip) — an idealised natural-vegetation colouring of the land
    (no cities, roads, fields). Its pale "map" palette is darkened into a satellite-like albedo below.
  * rivers / lakes: Natural Earth 10m physical vectors (rivers_lake_centerlines, lakes; public domain) — only the
    Nile, its Rosetta and Damietta branches and the Jordan are drawn (the Suez and Ismailiya canals are left out).

RESTORED TO ~1000 BCE (the brief: nothing modern; tools/land/build_dem.py for the Dead Sea level):
  * the Dead Sea at DEAD_SEA_LEVEL (-398 m, Iron Age level after Migowski et al. 2006 / Bookman et al. 2004): every
    rift cell below it that connects to the northern basin is lake — the SOUTHERN BASIN is under water (the modern
    evaporation ponds are gone);
  * Lake Hula and its marshes restored (drained 1951-58): a lake of ~5 x 4 km at the south of the Hula valley with
    the papyrus marsh north of it (outline after the pre-1950 survey maps, approximate);
  * the Nile delta green; its eastern PELUSIAC branch drawn from the apex past Bubastis (Tell Basta) and Pi-Ramesses
    (Qantir) and Daphnae (Tell Defenneh) to Pelusium (Tell el-Farama) after the standard reconstructions (Bietak 1975,
    Sneh & Weissbrod 1973); the canals (Suez, Ismailiya, Nubariya) are not drawn and the Suez Canal's line is filled
    in the elevation; the Bitter Lakes and Lake Timsah are salt marsh, never a canal;
  * no cities, roads, fields or centre-pivot circles: NE1 has none of them at its scale, and any irrigation green
    outside the natural Nile floodplain (desert reclamation, the pivots of Tabuk / Disi) is replaced by the desert
    around it;
  * the coastline as today otherwise (the 1st-millennium BCE coast differed by a few km at most at this scale).

Outputs (src/assets/map/; local frame = lon/lat equirectangular over BBOX):
  map_color_{hi,lo}.webp   RGBA: sRGB albedo (water: its depth colour); A = water mask (255 = water)
  map_shade_{hi,lo}.webp   L: the baked morning sun (Lambert x soft relief shadow) on the EXAGGERATED relief
  map_height_{hi,lo}.webp  L lossless: height at the mesh vertices, h = H_MIN + (H_MAX - H_MIN) * (q / 255)^2
                           (water surfaces at their level: sea 0, Dead Sea -398, Kinneret -210, Hula 70)
  map_globe.webp           RGB: the far globe (lon GLOBE[0..1], lat GLOBE[2..3]): the same palette and morning sun on
                           its z6 relief, stored relative to flat ground and halved in linear light (the shader doubles)
The constants below are mirrored in src/film/map/mapData.ts (keep them identical).
"""
import argparse
import io
import math
import os
import sys
import urllib.request
import zipfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'src', 'assets', 'map')

# ---- the frame (mirror in mapData.ts) -------------------------------------------------------------------------
BBOX = (29.5, 37.5, 27.0, 34.5)          # lon0, lon1, lat0, lat1 (Lebanon and the Bashan in, so no edge shows in P5)
GLOBE = (5.0, 65.0, 5.0, 55.0)           # the far globe texture
EXAG = 2.6                               # relief exaggeration (mesh and baked shade)
H_MIN, H_MAX = -430.0, 2900.0            # height map range (m, before exaggeration)
SUN_AZ, SUN_EL = 104.0, 11.0             # the morning sun: azimuth from north (deg, clockwise), elevation (deg)
DEAD_SEA_LEVEL = -398.0                  # tools/land/build_dem.py
KINNERET_LEVEL = -210.0
HULA_LEVEL = 70.0

COLOR_W = {'hi': 2048, 'lo': 1024}
SKIP_INSET = False
# THE INSET: ~56 m texels over the coastal plain, the Shephelah, Judah and the north of the Salt Sea — where the lens is
# low: P4's first second (above Rachel's tomb) and P5's descent toward Ashdod (mirror in mapData.ts)
INSET = (34.40, 35.62, 31.38, 32.02)
INSET_W = {'hi': 2048, 'lo': 1024}
MESH_W = {'hi': 769, 'lo': 385}          # vertices across (the height map holds the vertex values)

TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
NE1_URL = 'https://naturalearth.s3.amazonaws.com/10m_raster/NE1_HR_LC.zip'
NE_VEC = 'https://naturalearth.s3.amazonaws.com/10m_physical/{name}.zip'


# ------------------------------------------------------------------------------------------------- helpers
def log(*a):
    print('[map]', *a, flush=True)


def fetch(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.part'
    with urllib.request.urlopen(url, timeout=120) as r, open(tmp, 'wb') as f:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
    os.replace(tmp, path)
    return path


def merc_px(lon, lat, z):
    n = 256.0 * (2 ** z)
    x = (lon + 180.0) / 360.0 * n
    la = np.radians(lat)
    y = (1.0 - np.log(np.tan(la) + 1.0 / np.cos(la)) / math.pi) / 2.0 * n
    return x, y


def terrarium_mosaic(cache, z, lon0, lon1, lat0, lat1):
    """mosaic of terrarium tiles covering the box; returns (heights, px0, py0) in global pixel coordinates"""
    x0, y1 = merc_px(lon0, lat0, z)
    x1, y0 = merc_px(lon1, lat1, z)
    tx0, tx1 = int(x0 // 256), int(x1 // 256)
    ty0, ty1 = int(y0 // 256), int(y1 // 256)
    W, H = (tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256
    m = np.zeros((H, W), np.float32)
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            p = fetch(TERRARIUM.format(z=z, x=tx, y=ty), os.path.join(cache, f't{z}', f'{tx}_{ty}.png'))
            a = np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
            h = a[..., 0] * 256.0 + a[..., 1] + a[..., 2] / 256.0 - 32768.0
            m[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = h
    return m, tx0 * 256, ty0 * 256


def grid(lon0, lon1, lat0, lat1, w, h, centers=True):
    """lon / lat of a w x h equirectangular grid (pixel centres, or the inclusive corner grid of the mesh)"""
    if centers:
        lons = lon0 + (np.arange(w) + 0.5) * (lon1 - lon0) / w
        lats = lat1 - (np.arange(h) + 0.5) * (lat1 - lat0) / h
    else:
        lons = lon0 + np.arange(w) * (lon1 - lon0) / (w - 1)
        lats = lat1 - np.arange(h) * (lat1 - lat0) / (h - 1)
    return np.meshgrid(lons, lats)


def sample_merc(m, px0, py0, z, LON, LAT, order=1):
    x, y = merc_px(LON, LAT, z)
    return ndimage.map_coordinates(m, [y - py0 - 0.5, x - px0 - 0.5], order=order, mode='nearest')


def save_preview(arr, path, lo=None, hi=None):
    a = arr.astype(np.float32)
    lo = np.nanmin(a) if lo is None else lo
    hi = np.nanmax(a) if hi is None else hi
    Image.fromarray(np.clip((a - lo) / max(1e-6, hi - lo) * 255, 0, 255).astype(np.uint8)).save(path)


def srgb_to_lin(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def fbm(h, w, seed, octaves=5, base=8.0):
    """deterministic value-noise fbm in [-1, 1] on an h x w grid"""
    rng = np.random.RandomState(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    f = base
    for _ in range(octaves):
        gh, gw = int(h / f) + 3, int(w / f) + 3
        g = rng.uniform(-1, 1, (gh, gw)).astype(np.float32)
        yy = np.linspace(1, gh - 2, h)
        xx = np.linspace(1, gw - 2, w)
        Y, X = np.meshgrid(yy, xx, indexing='ij')
        out += amp * ndimage.map_coordinates(g, [Y, X], order=3, mode='reflect')
        tot += amp
        amp *= 0.55
        f /= 2.0
        if f < 1.0:
            break
    return out / tot


# ------------------------------------------------------------------------------------------------- inputs
def load_ne1(cache, lon0, lon1, lat0, lat1):
    """NE1_HR_LC crop (uint8 RGB, 60 px / degree; pixel centres at -179.99167 + i / 60)"""
    zp = fetch(NE1_URL, os.path.join(cache, 'NE1_HR_LC.zip'))
    tif = os.path.join(cache, 'ne1', 'NE1_HR_LC.tif')
    if not os.path.exists(tif):
        with zipfile.ZipFile(zp) as z:
            z.extract('NE1_HR_LC.tif', os.path.join(cache, 'ne1'))
    import tifffile
    a = tifffile.memmap(tif)
    x0 = int(math.floor((lon0 + 180) * 60)) - 2
    x1 = int(math.ceil((lon1 + 180) * 60)) + 2
    y0 = int(math.floor((90 - lat1) * 60)) - 2
    y1 = int(math.ceil((90 - lat0) * 60)) + 2
    crop = np.array(a[y0:y1, x0:x1]).astype(np.float32) / 255.0
    # pixel (row r, col c) centre: lon = -180 + (x0 + c + 0.5) / 60, lat = 90 - (y0 + r + 0.5) / 60
    return crop, x0, y0


def sample_ne1(crop, x0, y0, LON, LAT, order=1):
    c = (LON + 180) * 60 - x0 - 0.5
    r = (90 - LAT) * 60 - y0 - 0.5
    return np.stack([ndimage.map_coordinates(crop[..., k], [r, c], order=order, mode='nearest') for k in range(3)], -1)


def load_lines(cache):
    """Natural Earth rivers (only the natural ones of the brief) as lists of (lon, lat) polylines"""
    import shapefile  # pyshp
    out = {}
    for name in ('ne_10m_rivers_lake_centerlines',):
        zp = fetch(NE_VEC.format(name=name), os.path.join(cache, name + '.zip'))
        d = os.path.join(cache, 'vec')
        with zipfile.ZipFile(zp) as z:
            z.extractall(d)
        r = shapefile.Reader(os.path.join(d, name))
        flds = [f[0] for f in r.fields[1:]]
        for sr in r.iterShapeRecords():
            rec = dict(zip(flds, sr.record))
            nm = rec.get('name') or ''
            if nm not in ('Nile', 'Rosetta Branch', 'Damietta Branch', 'Jordan'):
                continue  # the Suez / Ismailiya / Nubariya canals are modern
            pts = sr.shape.points
            parts = list(sr.shape.parts) + [len(pts)]
            for i in range(len(parts) - 1):
                out.setdefault(nm, []).append(pts[parts[i]:parts[i + 1]])
    return out


# ------------------------------------------------------------------------------------------------- places
def ll_px(lon, lat, W, H):
    lon0, lon1, lat0, lat1 = BBOX
    return (lon - lon0) / (lon1 - lon0) * W, (lat1 - lat) / (lat1 - lat0) * H


# the eastern (Pelusiac) branch of the Nile, after Bietak 1975 / Sneh & Weissbrod 1973 (approximate): from the delta
# apex north of On (Heliopolis) past Bubastis (Tell Basta), Pi-Ramesses (Qantir), Daphnae (Tell Defenneh) to Pelusium
PELUSIAC = [(31.22, 30.17), (31.33, 30.33), (31.51, 30.57), (31.68, 30.70), (31.83, 30.80), (31.98, 30.86),
            (32.17, 30.87), (32.33, 30.93), (32.47, 31.00), (32.55, 31.05)]
# Lake Hula (drained 1951-58) and the papyrus marsh north of it (approximate outline of the pre-1950 survey maps)
HULA_LAKE = (35.612, 33.074, 0.0215, 0.0235)     # lon, lat, semi-axes (deg)
HULA_MARSH = (35.608, 33.122, 0.030, 0.034)
# the Suez Canal's corridor (filled in the elevation; no water connects the two seas); the Bitter Lakes / Timsah basins
CANAL_BAND = (32.22, 32.66, 29.97, 31.22)
BITTER = [(32.38, 30.33, 0.10, 0.075), (32.53, 30.20, 0.045, 0.04), (32.29, 30.565, 0.03, 0.02)]   # ellipses: salt marsh
# basalt fields (dark): the Golan / Bashan / Hauran plateau and the Harrat ash-Sham (visible in any satellite image)
BASALT = [(35.80, 32.98, 0.12, 0.21)]
# the natural floodplain of the Nile (delta + valley): green only here in Egypt; elsewhere irrigation green is modern
DELTA_POLY = [(29.95, 31.35), (30.35, 31.55), (31.0, 31.62), (31.85, 31.55), (32.35, 31.30), (32.62, 31.08),
              (32.30, 30.70), (31.95, 30.45), (31.55, 30.20), (31.30, 30.03), (31.10, 30.05), (30.85, 30.30),
              (30.45, 30.75), (30.10, 31.05)]


def ellipse_mask(LON, LAT, e, soft=0.25):
    cx, cy, ax, ay = e
    r = np.sqrt(((LON - cx) / ax) ** 2 + ((LAT - cy) / ay) ** 2)
    return 1.0 - smoothstep(1.0 - soft, 1.0 + soft, r)


def poly_mask(poly, W, H, blur=0.0):
    im = Image.new('L', (W, H), 0)
    ImageDraw.Draw(im).polygon([ll_px(lo, la, W, H) for lo, la in poly], fill=255)
    if blur > 0:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(im).astype(np.float32) / 255.0


def lines_mask(lines, W, H, width):
    """anti-aliased polylines (supersampled x4)"""
    S = 4
    im = Image.new('L', (W * S, H * S), 0)
    d = ImageDraw.Draw(im)
    for ln in lines:
        pts = [ll_px(lo, la, W * S, H * S) for lo, la in ln]
        if len(pts) > 1:
            d.line(pts, fill=255, width=max(1, int(round(width * S))), joint='curve')
    im = im.resize((W, H), Image.BOX)
    return np.asarray(im).astype(np.float32) / 255.0


# ------------------------------------------------------------------------------------------------- the bake
def build(cache, preview=None):
    lon0, lon1, lat0, lat1 = BBOX
    W = COLOR_W['hi']
    H = int(round(W * (lat1 - lat0) / (lon1 - lon0)))
    LON, LAT = grid(lon0, lon1, lat0, lat1, W, H)
    log(f'grid {W}x{H}')

    # ---- elevation (z9 terrarium, ~270 m / px) on the colour grid
    m, px0, py0 = terrarium_mosaic(cache, 9, lon0, lon1, lat0, lat1)
    D = sample_merc(ndimage.gaussian_filter(m, 0.6), px0, py0, 9, LON, LAT).astype(np.float32)
    # a one-row seam of the source data east of the Arabah (lat ~29.05): a vertical median over the band
    seam = (LON > 35.7) & (LAT > 28.9) & (LAT < 29.2)
    D = np.where(seam, ndimage.median_filter(D, size=(7, 1)), D)
    # the Suez Canal's corridor: fill its cut (a 3 px running max-then-min = closing along the corridor)
    cb = (LON > CANAL_BAND[0]) & (LON < CANAL_BAND[1]) & (LAT > CANAL_BAND[2]) & (LAT < CANAL_BAND[3])
    closed = ndimage.grey_closing(D, size=(5, 5))
    D = np.where(cb, np.maximum(D, closed), D)

    # ---- water ----------------------------------------------------------------------------------------------
    sea_c = D <= 0.0
    sea_c &= ~(cb & (LAT < 31.12))                      # no water corridor between the two seas
    lab, n = ndimage.label(sea_c)
    seeds = [lab[0, 0], lab[H - 1, int(W * 0.47)], lab[H - 1, int(W * 0.68)]]   # the Great Sea, the gulfs of Suez / Aqaba
    sea = np.isin(lab, [s for s in seeds if s > 0])
    # Lake Bardawil (Sirbonis) — a lagoon behind its sand bar (SRTM gives it +1..4 m)
    bard = (LON > 32.62) & (LON < 33.5) & (LAT > 31.02) & (LAT < 31.24) & (D <= 3.5)
    lab3, n3 = ndimage.label(bard)
    if n3:
        sz = ndimage.sum(bard, lab3, range(1, n3 + 1))
        bard = np.isin(lab3, [i + 1 for i, s in enumerate(sz) if s > 40])
    sea |= bard
    # the Dead Sea at the Iron Age level, the southern basin under water
    ds_c = (D <= DEAD_SEA_LEVEL) & (LON > 35.2) & (LON < 35.7) & (LAT > 30.9) & (LAT < 31.9)
    south = (LON > 35.34) & (LON < 35.56) & (LAT > 30.98) & (LAT < 31.27) & (D <= -386.0)   # the basin floor (ponds)
    ds_c |= south
    lab2, n2 = ndimage.label(ds_c)
    j, i = int((lat1 - 31.5) / (lat1 - lat0) * H), int((35.5 - lon0) / (lon1 - lon0) * W)
    ds = lab2 == lab2[j, i]
    ds = ndimage.binary_closing(ds, iterations=2) & ((D <= -330) | ds)
    # the Kinneret
    kn_c = (D <= KINNERET_LEVEL + 4) & (LON > 35.45) & (LON < 35.7) & (LAT > 32.65) & (LAT < 32.95)
    lab4, _ = ndimage.label(kn_c)
    j, i = int((lat1 - 32.82) / (lat1 - lat0) * H), int((35.59 - lon0) / (lon1 - lon0) * W)
    kn = lab4 == lab4[j, i]
    # Lake Hula restored
    hula = ellipse_mask(LON, LAT, HULA_LAKE, 0.12) > 0.5
    hmarsh = ellipse_mask(LON, LAT, HULA_MARSH, 0.35)
    lakes = ds | kn | hula
    water = sea | lakes
    # the water surface levels in the elevation (the mesh is flat there)
    Dw = D.copy()
    Dw[sea] = 0.0
    Dw[ds] = DEAD_SEA_LEVEL
    Dw[kn] = KINNERET_LEVEL
    Dw[hula] = HULA_LEVEL
    land = ~water
    Dl = np.where(land, np.maximum(D, -420.0), Dw)
    # the land just around the lakes never below their surface
    Dl[land] = np.maximum(Dl[land], -395.0)
    log('water', round(float(sea.mean()), 3), 'dead sea px', int(ds.sum()), 'kinneret px', int(kn.sum()))

    # ---- metric derivatives (real relief) ------------------------------------------------------------------
    dxm = (lon1 - lon0) / W * 111320.0 * np.cos(np.radians(LAT))
    dym = (lat1 - lat0) / H * 110574.0
    Hs = np.where(land, Dl, Dw)
    gy, gx = np.gradient(Hs)
    slope = np.sqrt((gx / dxm) ** 2 + (gy / dym) ** 2)                       # m / m
    valley1 = ndimage.gaussian_filter(Hs, 2.0) - Hs                         # > 0 in valleys / wadis (fine)
    valley2 = ndimage.gaussian_filter(Hs, 6.0) - Hs
    rough = ndimage.gaussian_filter(np.abs(valley1), 2.0)

    # ---- natural colour: NE1 land cover, transferred to a satellite albedo ---------------------------------
    crop, x0, y0 = load_ne1(cache, lon0 - 0.2, lon1 + 0.2, lat0 - 0.2, lat1 + 0.2)
    # NE1's water is white: fill it from the nearest land pixel before sampling
    wmask = crop.min(-1) > 0.985
    idx = ndimage.distance_transform_edt(wmask, return_distances=False, return_indices=True)
    crop = crop[idx[0], idx[1]]
    crop = ndimage.gaussian_filter(crop, (1.0, 1.0, 0))
    ne = sample_ne1(crop, x0, y0, LON, LAT, order=3)
    R, G, B = ne[..., 0], ne[..., 1], ne[..., 2]
    veg = smoothstep(0.085, 0.175, G - B)                                    # NE1's vegetation (yellow-green)
    red = smoothstep(0.02, 0.09, R - G)                                       # NE1's rock pink
    # (red sandstone / granite: Edom and Midian east of the rift, the granite massif of southern Sinai)
    red *= np.clip(smoothstep(35.38, 35.6, LON) + (1 - smoothstep(28.9, 29.4, LAT)), 0, 1) * 0.85 + 0.15
    lum = (R + G + B) / 3.0
    bright = smoothstep(0.86, 0.96, lum)                                     # sand seas / playas
    # regions
    levant = smoothstep(34.15, 34.6, LON) * smoothstep(30.75, 31.3, LAT)   # the land of Israel, Transjordan's west
    egypt = 1.0 - smoothstep(32.3, 32.8, LON)
    vegE = smoothstep(0.06, 0.15, G - B)
    delta = poly_mask(DELTA_POLY, W, H, blur=14.0) * (1.0 - smoothstep(14.0, 34.0, D)) * vegE
    # the Nile valley floor south of the apex and the Faiyum: NE1's green inside the corridor
    corr = ((LON > 30.55) & (LON < 31.55) & (LAT < 30.15)).astype(np.float32)
    nile_v = ndimage.gaussian_filter(corr, 4.0) * vegE * (1.0 - smoothstep(30.0, 52.0, D))
    flood = np.clip(np.maximum(delta, nile_v) * 1.25, 0, 1)
    flood *= np.clip(0.86 + 0.22 * fbm(H, W, 5, 4, 6.0), 0, 1)
    # arid colours (sRGB 0-1): sand, limestone desert, dark rock, red sandstone/granite
    def c(*v):
        return np.array(v, np.float32) / 255.0
    sand = c(224, 203, 162)
    desert = c(196, 168, 128)
    lime = c(204, 190, 160)
    rock = c(128, 100, 80)
    redrock = c(150, 98, 72)
    steppe = c(160, 142, 104)
    medit = c(108, 108, 74)
    green = c(70, 92, 48)
    basaltc = c(78, 72, 64)
    marsh = c(58, 74, 44)
    salt = c(190, 182, 160)
    A = np.empty((H, W, 3), np.float32)
    n1 = fbm(H, W, 11, 6, 64.0)
    n2 = fbm(H, W, 23, 4, 8.0)
    # base desert: sand <-> desert by NE1 brightness, limestone where light and rough, red rock by NE1's pink
    k_sand = np.clip(bright * (1.0 - smoothstep(0.02, 0.08, slope)) + 0.15 * n1, 0, 1)
    base = desert[None, None] * (1 - k_sand[..., None]) + sand[None, None] * k_sand[..., None]
    k_rock = np.clip(smoothstep(0.035, 0.16, slope) * 0.85 + 0.25 * smoothstep(8.0, 30.0, rough), 0, 1)
    rockc = rock[None, None] * (1 - red[..., None]) + redrock[None, None] * red[..., None]
    base = base * (1 - k_rock[..., None]) + rockc * k_rock[..., None]
    # the limestone hills of the Negev / the Judean desert: lighter, chalky
    k_lime = levant * (1 - veg) * smoothstep(250.0, 650.0, D) * (1 - k_rock) * 0.6
    base = base * (1 - k_lime[..., None]) + lime[None, None] * k_lime[..., None]
    # vegetation: steppe -> Mediterranean maquis / fields (the Levant only); the floodplain green (Egypt)
    v_lev = veg * levant
    vegc = steppe[None, None] * (1 - smoothstep(0.3, 0.9, v_lev)[..., None]) + medit[None, None] * smoothstep(0.3, 0.9, v_lev)[..., None]
    k_veg = np.clip(v_lev * 0.95, 0, 1)
    A = base * (1 - k_veg[..., None]) + vegc * k_veg[..., None]
    nf = fbm(H, W, 7, 3, 3.0)
    greenv = green[None, None] * (1.0 + 0.12 * nf[..., None]) + c(18, 10, -6)[None, None] * smoothstep(0.2, 0.7, n2)[..., None]
    A = A * (1 - flood[..., None]) + greenv * flood[..., None]
    # basalt
    bas = np.clip(np.maximum.reduce([ellipse_mask(LON, LAT, e, 0.5) for e in BASALT]), 0, 1) * smoothstep(350.0, 600.0, D)
    A = A * (1 - 0.5 * bas[..., None]) + basaltc[None, None] * 0.5 * bas[..., None] * (1 - 0.35 * v_lev[..., None]) \
        + medit[None, None] * 0.5 * bas[..., None] * 0.35 * v_lev[..., None]
    # Hula marsh, the Bitter Lakes as salt marsh (sabkha)
    A = A * (1 - hmarsh[..., None] * 0.9) + marsh[None, None] * hmarsh[..., None] * 0.9
    sab = np.clip(np.maximum.reduce([ellipse_mask(LON, LAT, e, 0.3) for e in BITTER]), 0, 1) * (D < 12.0)
    A = A * (1 - sab[..., None] * 0.6) + salt[None, None] * sab[..., None] * 0.6
    # wadis: arid beds lighter (gravel / sand), humid valleys a little greener; fine mottling
    arid = 1.0 - np.clip(v_lev + flood, 0, 1)
    wadi = smoothstep(2.0, 14.0, valley1) * arid
    A = A * (1 + 0.16 * wadi[..., None]) + 0.02 * wadi[..., None]
    A = A * (1.0 + 0.10 * n1[..., None] + 0.06 * n2[..., None])
    # crests and dark slopes (desert varnish) a touch darker; valleys of the humid hills greener
    A *= (1.0 - 0.10 * smoothstep(-2.0, -14.0, valley1) * arid)[..., None]
    hum = smoothstep(2.0, 12.0, valley1) * v_lev
    A = A * (1 - 0.25 * hum[..., None]) + green[None, None] * 0.25 * hum[..., None]
    A = np.clip(A, 0.0, 1.0)

    # ---- rivers: the Nile, its branches (incl. the Pelusiac), the Jordan
    riv = load_lines(cache)
    nile = lines_mask(riv.get('Nile', []) + riv.get('Rosetta Branch', []) + riv.get('Damietta Branch', []) + [PELUSIAC], W, H, 1.1)
    jordan = lines_mask(riv.get('Jordan', []), W, H, 0.8)
    jordan_thicket = ndimage.gaussian_filter(jordan, 1.6)
    A = A * (1 - np.clip(jordan_thicket * 2.2, 0, 0.7)[..., None]) + green[None, None] * np.clip(jordan_thicket * 2.2, 0, 0.7)[..., None]
    nile_band = ndimage.gaussian_filter(nile, 1.8) * (1 - smoothstep(31.45, 31.6, LAT))
    A = A * (1 - np.clip(nile_band * 1.6, 0, 0.6)[..., None]) + green[None, None] * np.clip(nile_band * 1.6, 0, 0.6)[..., None]
    rivers = np.clip(nile + jordan * 0.8, 0, 1) * land
    riverc = c(52, 66, 58)
    A = A * (1 - rivers[..., None] * 0.85) + riverc[None, None] * rivers[..., None] * 0.85

    # ---- water colour by depth (bathymetry): deep navy, shelf blue, shallow teal; lakes their own
    depth = np.clip(-ndimage.gaussian_filter(np.where(sea, np.minimum(D, 0.0), 0.0), 3.0), 0, 3000)
    deep = c(12, 27, 58)
    shelf = c(20, 48, 82)
    shallow = c(40, 92, 104)
    kd = smoothstep(0.0, 22.0, depth)
    kk = smoothstep(25.0, 600.0, depth)
    sea_col = shallow[None, None] * (1 - kd[..., None]) + shelf[None, None] * kd[..., None]
    sea_col = sea_col * (1 - kk[..., None]) + deep[None, None] * kk[..., None]
    # the Nile's plume off the delta: greener, silty shallows
    plume = ellipse_mask(LON, LAT, (31.6, 31.65, 1.0, 0.25), 0.6) * (1 - kk)
    sea_col = sea_col * (1 - 0.5 * plume[..., None]) + c(60, 92, 78)[None, None] * 0.5 * plume[..., None]
    A = np.where(sea[..., None], sea_col, A)
    A = np.where(ds[..., None], c(22, 52, 62)[None, None], A)            # the Dead Sea: dark blue-green
    A = np.where(kn[..., None], c(24, 52, 78)[None, None], A)
    A = np.where(hula[..., None], c(34, 58, 62)[None, None], A)
    wm = water.astype(np.float32)
    # coast: a narrow pale beach line where sand meets the sea (Philistia, northern Sinai)
    beach = np.clip(ndimage.gaussian_filter(wm, 0.8) - wm, 0, 1) * (LAT > 30.9) * (LON < 35.0) * (LON > 32.0)
    A = A * (1 - beach[..., None] * 0.8) + c(232, 214, 176)[None, None] * beach[..., None] * 0.8

    # ---- baked sun on the exaggerated relief: Lambert x soft horizon shadow --------------------------------
    He = np.where(land, Dl, 0.0) * EXAG
    He = np.where(water, Dw * EXAG, He)
    gy, gx = np.gradient(He)
    nx, ny = -gx / dxm, gy / dym                                            # +x east, +y north
    nl = np.sqrt(nx ** 2 + ny ** 2 + 1)
    az, el = math.radians(SUN_AZ), math.radians(SUN_EL)
    L = (math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))
    lam = np.clip((nx * L[0] + ny * L[1] + L[2]) / nl, 0, 1)
    # horizon angle toward the sun (steps of 1..2 px out to ~70 km)
    sx, sy = math.sin(az), -math.cos(az)                                    # pixel step toward the sun (rows grow south)
    hor = np.full((H, W), -1.0, np.float32)
    jj, ii = np.mgrid[0:H, 0:W].astype(np.float32)
    dist = 0.0
    step = 1.0
    dpx_m = np.sqrt((sx * dxm) ** 2 + (sy * dym) ** 2)                      # metres per pixel step
    k = 0
    while dist < 170:
        dist += step
        k += 1
        hs = ndimage.map_coordinates(He, [jj + sy * dist, ii + sx * dist], order=1, mode='nearest')
        ang = (hs - He) / (dist * dpx_m)
        np.maximum(hor, ang, out=hor)
        step = 1.0 if dist < 24 else 2.0 if dist < 80 else 4.0
    tan_el = math.tan(el)
    pen = math.tan(math.radians(2.6))                                       # soft penumbra
    shadow = smoothstep(-pen, pen, tan_el - hor)
    sun = lam * shadow
    sun = np.where(water, math.sin(el) * 1.0, sun)
    log('shade', k, 'steps; lit fraction', round(float((shadow > 0.5).mean()), 3))
    # sky visibility (cheap AO): valleys a little darker under the sky
    ao = np.clip(1.0 - 0.0035 * np.maximum(ndimage.gaussian_filter(He, 5.0) - He, 0), 0.55, 1.0)
    shade = np.clip(sun * 0.86 + 0.14 * ao * (1 - wm), 0, 1)

    # ---- outputs ---------------------------------------------------------------------------------------------
    os.makedirs(OUT, exist_ok=True)
    inset_sizes = {} if SKIP_INSET else build_inset(cache, A, land, W, H, riv=load_lines(cache), preview=preview)
    rgba = np.dstack([np.clip(A * 255 + 0.5, 0, 255).astype(np.uint8), np.clip(ndimage.gaussian_filter(wm, 0.6) * 255 + 0.5, 0, 255).astype(np.uint8)])
    sh8 = np.clip(np.sqrt(shade) * 255 + 0.5, 0, 255).astype(np.uint8)      # sqrt: more codes in the shadows
    sizes = {}
    for tier, w in COLOR_W.items():
        h = int(round(w * (lat1 - lat0) / (lon1 - lon0)))
        im = Image.fromarray(rgba, 'RGBA')
        sh = Image.fromarray(sh8, 'L')
        if w != W:
            # (RGB and A apart: Pillow resizes RGBA premultiplied, which would blacken the land under alpha 0)
            rgb = Image.fromarray(rgba[..., :3], 'RGB').resize((w, h), Image.LANCZOS)
            al = Image.fromarray(rgba[..., 3], 'L').resize((w, h), Image.LANCZOS)
            im = Image.merge('RGBA', (*rgb.split(), al))
            sh = sh.resize((w, h), Image.LANCZOS)
        p = os.path.join(OUT, f'map_color_{tier}.webp')
        # exact: keep the RGB under alpha 0 (lossy WebP otherwise discards the colour of 'transparent' pixels)
        im.save(p, 'WEBP', quality=84 if tier == 'hi' else 80, alpha_quality=100, method=6, exact=True)
        sizes[p] = os.path.getsize(p)
        p = os.path.join(OUT, f'map_shade_{tier}.webp')
        sh.save(p, 'WEBP', quality=82 if tier == 'hi' else 78, method=6)
        sizes[p] = os.path.getsize(p)
        # the height map at the mesh vertices (inclusive corner grid)
        mw = MESH_W[tier]
        mh = int(round((mw - 1) * (lat1 - lat0) / (lon1 - lon0))) + 1
        MLON, MLAT = grid(lon0, lon1, lat0, lat1, mw, mh, centers=False)
        fx = (MLON - lon0) / (lon1 - lon0) * W - 0.5
        fy = (lat1 - MLAT) / (lat1 - lat0) * H - 0.5
        hsrc = ndimage.gaussian_filter(np.where(water, Dw, Dl), max(0.5, 0.5 * W / mw))
        # water vertices exactly at their level (the sea flat at 0 out to the edges)
        hv = ndimage.map_coordinates(hsrc, [fy, fx], order=1, mode='nearest')
        wv = ndimage.map_coordinates(wm, [fy, fx], order=1, mode='nearest')
        lv = ndimage.map_coordinates(np.where(water, Dw, 0.0), [fy, fx], order=0, mode='nearest')
        hv = np.where(wv > 0.5, lv, np.maximum(hv, lv * (wv > 0.02)))
        q = np.sqrt(np.clip((hv - H_MIN) / (H_MAX - H_MIN), 0, 1)) * 255.0
        p = os.path.join(OUT, f'map_height_{tier}.webp')
        Image.fromarray(np.clip(q + 0.5, 0, 255).astype(np.uint8), 'L').save(p, 'WEBP', lossless=True, quality=100, method=6)
        sizes[p] = os.path.getsize(p)
        log(f'{tier}: colour {w}x{h}, mesh {mw}x{mh}')

    # ---- the far globe (land colour + sea, a coarse relief-free cap for the horizon)
    # the far globe: the same palette as the map (NE1 transfer, rock on the rougher relief) and the same morning sun on
    # its (coarser, z5) relief, stored RELATIVE to flat ground and halved (rgb = albedo * shade / flat * 0.5): lit as
    # flat ground by the shader, it continues the map's look past the box edges (no seam where the box meets it)
    gl0, gl1, gb0, gb1 = GLOBE
    GW, GH = 2048, int(round(2048 * (gb1 - gb0) / (gl1 - gl0)))
    GLON, GLAT = grid(gl0, gl1, gb0, gb1, GW, GH)
    gm, gx0, gy0 = terrarium_mosaic(cache, 6, gl0, gl1, gb0, gb1)
    GD = sample_merc(gm, gx0, gy0, 6, GLON, GLAT).astype(np.float32)
    gcrop, cx0, cy0 = load_ne1(cache, gl0, gl1, gb0, gb1)
    gw = gcrop.min(-1) > 0.985
    gidx = ndimage.distance_transform_edt(gw, return_distances=False, return_indices=True)
    gcrop = ndimage.gaussian_filter(gcrop[gidx[0], gidx[1]], (1.0, 1.0, 0))
    gne = sample_ne1(gcrop, cx0, cy0, GLON, GLAT)
    gveg = smoothstep(0.085, 0.175, gne[..., 1] - gne[..., 2])
    gred = smoothstep(0.02, 0.09, gne[..., 0] - gne[..., 1])
    gbr = smoothstep(0.86, 0.96, gne.mean(-1))
    gsea = GD <= 0.0
    gland = ~gsea
    gdx = (gl1 - gl0) / GW * 111320.0 * np.cos(np.radians(GLAT))
    gdy = (gb1 - gb0) / GH * 110574.0
    gHe = np.where(gland, np.maximum(GD, 0.0), 0.0) * EXAG
    ggy, ggx = np.gradient(gHe)
    gslope = np.sqrt((ggx / gdx) ** 2 + (ggy / gdy) ** 2) / EXAG
    grough = ndimage.gaussian_filter(np.abs(ndimage.gaussian_filter(gHe, 1.5) - gHe), 1.0) / EXAG
    gA = desert[None, None] * (1 - gbr[..., None]) + sand[None, None] * gbr[..., None]
    gk = np.clip(smoothstep(0.01, 0.05, gslope) * 0.7 + 0.3 * smoothstep(20.0, 80.0, grough), 0, 1)
    grock = rock[None, None] * (1 - gred[..., None]) + redrock[None, None] * gred[..., None]
    gA = gA * (1 - gk[..., None]) + grock * gk[..., None]
    gA = gA * (1 - gveg[..., None]) + medit[None, None] * gveg[..., None]
    gnx, gny = -ggx / gdx, ggy / gdy
    glam = np.clip((gnx * L[0] + gny * L[1] + L[2]) / np.sqrt(gnx ** 2 + gny ** 2 + 1), 0, 1)
    gshade = glam * 0.86 + 0.14
    flat = math.sin(el) * 0.86 + 0.14
    rel = np.clip(gshade / flat, 0.0, 2.0)
    gdeep = smoothstep(25.0, 600.0, -GD)
    gs = shelf[None, None] * (1 - gdeep[..., None]) + deep[None, None] * gdeep[..., None]
    gA = np.where(gsea[..., None], gs, gA)
    rel = np.where(gsea, 1.0, rel)
    # halved in LINEAR light (the GPU decodes the sRGB texture to linear; the shader doubles it)
    genc = lin_to_srgb(srgb_to_lin(gA) * rel[..., None] * 0.5)
    gim = Image.fromarray(np.clip(genc * 255 + 0.5, 0, 255).astype(np.uint8), 'RGB')
    p = os.path.join(OUT, 'map_globe.webp')
    gim.save(p, 'WEBP', quality=76, method=6)
    sizes[p] = os.path.getsize(p)
    p = os.path.join(OUT, 'map_globe_lo.webp')                               # phones
    gim.resize((GW // 2, GH // 2), Image.LANCZOS).save(p, 'WEBP', quality=76, method=6)
    sizes[p] = os.path.getsize(p)

    sizes.update(inset_sizes)
    tot = {'hi': 0, 'lo': 0}
    for p, s in sizes.items():
        log(f'{os.path.basename(p):24s} {s / 1024:8.1f} KB')
        for t in tot:
            if f'_{t}.' in p or (p.endswith('map_globe.webp') and t == 'hi'):
                tot[t] += s
    log('download per tier (KB):', {k: round(v / 1024) for k, v in tot.items()})

    if preview:
        os.makedirs(preview, exist_ok=True)
        lin = srgb_to_lin(A)
        sunc = np.array([1.0, 0.86, 0.68], np.float32)
        skyc = np.array([0.32, 0.38, 0.5], np.float32)
        lit = lin * (sun[..., None] * sunc * 2.2 + (0.25 + 0.75 * ao)[..., None] * skyc * 0.55 * (1 - wm[..., None])) + lin * wm[..., None] * 0.9
        Image.fromarray(np.clip(lin_to_srgb(lit) * 255, 0, 255).astype(np.uint8)).save(os.path.join(preview, 'lit.png'))
        Image.fromarray(np.clip(A * 255, 0, 255).astype(np.uint8)).save(os.path.join(preview, 'albedo.png'))
        save_preview(shade, os.path.join(preview, 'shade.png'), 0, 1)
    return sizes


def build_inset(cache, A, land, W, H, riv, preview=None):
    """the high-resolution inset: z12 elevation (~38 m) resampled to ~56 m texels, the region's albedo for the large
    scale (so the inset melts into the map) + detail from the fine relief, the coast's dune belt, the water at this
    resolution, the morning sun baked with shadows cast from beyond the inset (Moab's shadow on the Salt Sea)"""
    lon0, lon1, lat0, lat1 = BBOX
    a0, a1, b0, b1 = INSET
    IW = INSET_W['hi']
    kx = 111320.0 * math.cos(math.radians((b0 + b1) / 2))
    IH = int(round(IW * (b1 - b0) * 110574.0 / ((a1 - a0) * kx)))
    # the shadow / relief computation runs on a box extended toward the sun (east) and around it
    ext = 0.45
    ea1 = a1 + ext
    EW = int(round(IW * (ea1 - (a0 - 0.05)) / (a1 - a0)))
    EH = int(round(IH * ((b1 + 0.05) - (b0 - 0.05)) / (b1 - b0)))
    ELON, ELAT = grid(a0 - 0.05, ea1, b0 - 0.05, b1 + 0.05, EW, EH)
    m, px0, py0 = terrarium_mosaic(cache, 12, a0 - 0.06, ea1 + 0.01, b0 - 0.06, b1 + 0.06)
    E = sample_merc(ndimage.gaussian_filter(m, 0.5), px0, py0, 12, ELON, ELAT).astype(np.float32)
    # crop indices of the inset inside the extended grid
    ox = int(round(0.05 / (ea1 - (a0 - 0.05)) * EW))
    oy = int(round(0.05 / ((b1 + 0.05) - (b0 - 0.05)) * EH))
    log(f'inset {IW}x{IH} (ext {EW}x{EH}), z12 mosaic {m.shape}')
    # ---- water at this resolution
    sea_c = E <= 0.0
    lab, _ = ndimage.label(sea_c)
    sea = np.isin(lab, [v for v in np.unique(lab[:, 0]) if v > 0])
    ds_c = (E <= DEAD_SEA_LEVEL) & (ELON > 35.3)
    lab2, n2 = ndimage.label(ds_c)
    ds = np.zeros_like(ds_c)
    if n2:
        sz = ndimage.sum(ds_c, lab2, range(1, n2 + 1))
        ds = lab2 == (int(np.argmax(sz)) + 1)
    ds = ndimage.binary_closing(ds, iterations=2) & ((E <= -330) | ds)
    water = sea | ds
    Ew = np.where(sea, 0.0, np.where(ds, DEAD_SEA_LEVEL, E))
    Ew = np.where(water, Ew, np.maximum(E, -395.0))
    # ---- relief derivatives (metres)
    LATc = ELAT
    dxm = (ea1 - (a0 - 0.05)) / EW * 111320.0 * np.cos(np.radians(LATc))
    dym = ((b1 + 0.05) - (b0 - 0.05)) / EH * 110574.0
    gy, gx = np.gradient(Ew)
    slope = np.sqrt((gx / dxm) ** 2 + (gy / dym) ** 2)
    v1 = ndimage.gaussian_filter(Ew, 1.5) - Ew        # fine valleys (>0) / crests (<0)
    v2 = ndimage.gaussian_filter(Ew, 5.0) - Ew
    # ---- the sun on the exaggerated relief (as the base bake)
    He = Ew * EXAG
    gy, gx = np.gradient(He)
    nx, ny = -gx / dxm, gy / dym
    nl = np.sqrt(nx ** 2 + ny ** 2 + 1)
    az, el = math.radians(SUN_AZ), math.radians(SUN_EL)
    L = (math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))
    lam = np.clip((nx * L[0] + ny * L[1] + L[2]) / nl, 0, 1)
    sx, sy = math.sin(az), -math.cos(az)
    jj, ii = np.mgrid[0:EH, 0:EW].astype(np.float32)
    dpx = np.sqrt((sx * dxm) ** 2 + (sy * dym) ** 2)
    hor = np.full((EH, EW), -1.0, np.float32)
    dist, step = 0.0, 1.0
    while dist < 700:
        dist += step
        hs = ndimage.map_coordinates(He, [jj + sy * dist, ii + sx * dist], order=1, mode='nearest')
        np.maximum(hor, (hs - He) / (dist * dpx), out=hor)
        step = 1.0 if dist < 40 else 2.0 if dist < 160 else 5.0
    pen = math.tan(math.radians(2.6))
    shadow = smoothstep(-pen, pen, math.tan(el) - hor)
    sun = lam * shadow
    ao = np.clip(1.0 - 0.0035 * np.maximum(ndimage.gaussian_filter(He, 9.0) - He, 0), 0.55, 1.0)
    wm = water.astype(np.float32)
    sun = np.where(water, math.sin(el), sun)
    shade = np.clip(sun * 0.86 + 0.14 * ao * (1 - wm), 0, 1)
    # ---- colour: the region's albedo (land filled under its coarse coastline) + fine detail
    Al = A.copy()
    fill = ~land
    idx = ndimage.distance_transform_edt(fill, return_distances=False, return_indices=True)
    Al = Al[idx[0], idx[1]]
    widx = ndimage.distance_transform_edt(land, return_distances=False, return_indices=True)
    Aw = A[widx[0], widx[1]]                                                   # the base's water colours, filled
    fx = (ELON - lon0) / (lon1 - lon0) * W - 0.5
    fy = (lat1 - ELAT) / (lat1 - lat0) * H - 0.5
    base = np.stack([ndimage.map_coordinates(Al[..., k], [fy, fx], order=3, mode='nearest') for k in range(3)], -1)
    base = np.clip(base, 0, 1)
    def c(*v):
        return np.array(v, np.float32) / 255.0
    n1 = fbm(EH, EW, 31, 5, 24.0)
    n2 = fbm(EH, EW, 37, 3, 4.0)
    east = smoothstep(35.22, 35.38, ELON)                                    # the rain shadow: the Judean desert
    hills = smoothstep(150.0, 400.0, E)
    # limestone exposures on the steeper hill slopes (grey-white in the hills, chalky in the desert)
    k_rock = smoothstep(0.08, 0.32, slope) * hills
    lime = c(196, 188, 168) * (1 - east[..., None]) + c(214, 200, 168) * east[..., None]
    Ai = base * (1 - 0.55 * k_rock[..., None]) + lime * 0.55 * k_rock[..., None]
    # valleys: the hills' terra rossa and green bottoms; the desert's pale wadi beds
    val = smoothstep(1.0, 9.0, v1)
    Ai = Ai * (1 - (0.35 * val * (1 - east))[..., None]) + c(92, 98, 62) * (0.35 * val * (1 - east))[..., None]
    Ai = Ai * (1 + (0.18 * val * east)[..., None])
    # crests a touch darker (scrub, soil) in the hills
    Ai *= (1 - 0.08 * smoothstep(-2.0, -10.0, v1) * hills)[..., None]
    # the coastal dune belt (Philistia's kurkar and sands): bright sand within ~3.5 km of the shore, low ground
    dsea = ndimage.distance_transform_edt(~sea) * float(np.mean(dxm))
    dune = (1 - smoothstep(1200.0, 4200.0, dsea)) * (1 - smoothstep(40.0, 90.0, E)) * (~water)
    dune *= np.clip(0.75 + 0.5 * n1, 0, 1)
    Ai = Ai * (1 - (0.75 * dune)[..., None]) + c(226, 206, 160) * (0.75 * dune)[..., None]
    # the plain: a mosaic of tilled patches and grazing around the towns (soft, no geometric fields)
    plain = (1 - smoothstep(60.0, 160.0, E)) * (~water) * (1 - dune)
    Ai *= (1 + (0.10 * plain * n2)[..., None])
    # fine mottling everywhere on land
    Ai *= (1 + 0.07 * n2[..., None] + 0.05 * n1[..., None])
    # the Jordan and its thicket (the zor)
    jor = lines_mask_box(riv.get('Jordan', []), (a0 - 0.05, ea1, b0 - 0.05, b1 + 0.05), EW, EH, 1.2)
    th = ndimage.gaussian_filter(jor, 5.0) * 3.0
    Ai = Ai * (1 - np.clip(th, 0, 0.75)[..., None]) + c(62, 80, 44) * np.clip(th, 0, 0.75)[..., None]
    Ai = Ai * (1 - (jor * 0.9)[..., None]) + c(52, 66, 58) * (jor * 0.9)[..., None]
    # water colours
    depth = np.clip(-ndimage.gaussian_filter(np.where(sea, np.minimum(E, 0.0), 0.0), 4.0), 0, 3000)
    kd = smoothstep(0.0, 22.0, depth)
    kk = smoothstep(25.0, 600.0, depth)
    sc = c(40, 92, 104)[None, None] * (1 - kd[..., None]) + c(20, 48, 82)[None, None] * kd[..., None]
    sc = sc * (1 - kk[..., None]) + c(12, 27, 58)[None, None] * kk[..., None]
    basew = np.stack([ndimage.map_coordinates(Aw[..., k], [fy, fx], order=1, mode='nearest') for k in range(3)], -1)
    Ai = np.where(sea[..., None], basew, Ai)
    del sc
    Ai = np.where(ds[..., None], c(22, 52, 62)[None, None], Ai)
    beach = np.clip(ndimage.gaussian_filter(sea.astype(np.float32), 1.2) - sea, 0, 1)
    Ai = Ai * (1 - (beach * 0.8)[..., None]) + c(234, 218, 182) * (beach * 0.8)[..., None]
    Ai = np.clip(Ai, 0, 1)
    # crop to the inset
    sl = (slice(oy, oy + IH), slice(ox, ox + IW))
    rgba = np.dstack([np.clip(Ai[sl] * 255 + 0.5, 0, 255).astype(np.uint8),
                      np.clip(ndimage.gaussian_filter(wm, 0.7)[sl] * 255 + 0.5, 0, 255).astype(np.uint8)])
    sh8 = np.clip(np.sqrt(shade[sl]) * 255 + 0.5, 0, 255).astype(np.uint8)
    sizes = {}
    for tier, w in INSET_W.items():
        h = int(round(w * IH / IW))
        rgb = Image.fromarray(rgba[..., :3], 'RGB')
        al = Image.fromarray(rgba[..., 3], 'L')
        sh = Image.fromarray(sh8, 'L')
        if w != IW:
            rgb, al, sh = rgb.resize((w, h), Image.LANCZOS), al.resize((w, h), Image.LANCZOS), sh.resize((w, h), Image.LANCZOS)
        p = os.path.join(OUT, f'map_inset_color_{tier}.webp')
        Image.merge('RGBA', (*rgb.split(), al)).save(p, 'WEBP', quality=82 if tier == 'hi' else 78, alpha_quality=100, method=6, exact=True)
        sizes[p] = os.path.getsize(p)
        p = os.path.join(OUT, f'map_inset_shade_{tier}.webp')
        sh.save(p, 'WEBP', quality=80 if tier == 'hi' else 76, method=6)
        sizes[p] = os.path.getsize(p)
    if preview:
        lin = srgb_to_lin(Ai[sl])
        sunc = np.array([1.0, 0.86, 0.68], np.float32)
        skyc = np.array([0.32, 0.38, 0.5], np.float32)
        s2 = shade[sl]
        lit = lin * (s2[..., None] * sunc * 2.2 + 0.55 * skyc * (1 - wm[sl][..., None])) + lin * wm[sl][..., None] * 0.9
        Image.fromarray(np.clip(lin_to_srgb(lit) * 255, 0, 255).astype(np.uint8)).save(os.path.join(preview, 'inset_lit.png'))
    return sizes


def lines_mask_box(lines, box, W, H, width):
    """anti-aliased polylines on an arbitrary lon / lat box"""
    l0, l1, b0, b1 = box
    S = 2
    im = Image.new('L', (W * S, H * S), 0)
    d = ImageDraw.Draw(im)
    for ln in lines:
        pts = [((lo - l0) / (l1 - l0) * W * S, (b1 - la) / (b1 - b0) * H * S) for lo, la in ln]
        if len(pts) > 1:
            d.line(pts, fill=255, width=max(1, int(round(width * S))), joint='curve')
    im = im.resize((W, H), Image.BOX)
    return np.asarray(im).astype(np.float32) / 255.0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--cache', default=os.path.join(ROOT, '..', '.map_cache'), help='download / cache directory')
    ap.add_argument('--preview', default=None, help='write preview PNGs here')
    ap.add_argument('--skip-inset', action='store_true', help='keep the existing inset files (the slow part)')
    a = ap.parse_args()
    global SKIP_INSET
    SKIP_INSET = a.skip_inset
    build(os.path.abspath(a.cache), a.preview)


if __name__ == '__main__':
    main()
