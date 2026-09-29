#!/usr/bin/env python3
"""
Procedural textures for Saul's house at Gibeah (src/palace). numpy / scipy / Pillow only, fully seeded.

Outputs (src/assets/palace/, WebP):
  plaster_a / plaster_n   1024  mud-lime wall plaster: trowel strokes, sand grain, straw, hairline cracks (tileable)
  wood_a / wood_n         512x1024  adzed, age-darkened timber, grain along V, drying checks (tileable)
  floor_a / floor_n       1024  beaten-earth floor with lime patches, grit, trodden sheen (tileable)
  textile_a               1024  2x2 atlas of Iron Age wool weaves in scarlet (shani), purple (argaman),
                                blue (tekhelet) on cream wool - bands, lozenges, zigzags (cells are tileable
                                horizontally; see PalaceMaterials.ts for the cell meaning)
  weave_n                 256   micro weave normal (tileable, used at high repeat on every textile)
  tamarisk                1024  2x2 atlas of Tamarix aphylla sprays (RGBA cut-out), grey-green jointed twigs
  clay_a / clay_n         512   wheel-thrown pottery (buff / terracotta), throwing rings along V
  fleece_a / fleece_n     512   sheepskin locks (tileable)
  reed_a / reed_n         512   ceiling of split branches / reeds bedded in clay (tileable, reeds along U)

Normal maps: OpenGL convention (+Y up), tangent space, RGB. Albedo maps: sRGB. No alpha except tamarisk.
Run:  python3 tools/palace/gen_palace_textures.py
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'palace')
os.makedirs(OUT, exist_ok=True)
RNG = np.random.default_rng(1020)


# ------------------------------------------------------------------------------------------ helpers
def fnoise(h, w, beta=2.0, seed=0, lo=1.0):
    """Tileable fractal noise by spectral synthesis (1/f^beta), normalised to 0..1."""
    r = np.random.default_rng(seed)
    wn = r.standard_normal((h, w))
    F = np.fft.fft2(wn)
    fy = np.fft.fftfreq(h)[:, None] * h
    fx = np.fft.fftfreq(w)[None, :] * w
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    amp = 1.0 / np.maximum(f, lo) ** (beta / 2.0)
    amp[0, 0] = 0
    n = np.real(np.fft.ifft2(F * amp))
    n -= n.min()
    return n / max(n.max(), 1e-9)


def band(h, w, fmin, fmax, seed=0, aniso=(1.0, 1.0)):
    """Tileable band-limited noise (frequencies in cycles per image), 0..1."""
    r = np.random.default_rng(seed)
    F = np.fft.fft2(r.standard_normal((h, w)))
    fy = np.fft.fftfreq(h)[:, None] * h * aniso[1]
    fx = np.fft.fftfreq(w)[None, :] * w * aniso[0]
    f = np.sqrt(fx * fx + fy * fy)
    m = np.exp(-((np.log(np.maximum(f, 1e-3)) - np.log(np.sqrt(fmin * fmax))) ** 2) / (2 * (np.log(fmax / fmin) / 2.5) ** 2))
    m[0, 0] = 0
    n = np.real(np.fft.ifft2(F * m))
    n -= n.min()
    return n / max(n.max(), 1e-9)


def wrap_blur(a, s):
    return ndimage.gaussian_filter(a, s, mode='wrap')


def normal_from_height(h, strength):
    gy, gx = np.gradient(np.pad(h, 1, mode='wrap'))
    gx = gx[1:-1, 1:-1]
    gy = gy[1:-1, 1:-1]
    nx = -gx * strength
    ny = gy * strength  # image rows go down: +Y (OpenGL) is up
    nz = np.ones_like(h)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    n = np.stack([nx / l, ny / l, nz / l], -1)
    return (n * 0.5 + 0.5)


def save_rgb(name, rgb, q=88):
    img = Image.fromarray(np.clip(rgb * 255 + 0.5, 0, 255).astype(np.uint8), 'RGB')
    img.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=q, method=6)
    print('wrote', name, img.size, os.path.getsize(os.path.join(OUT, name + '.webp')) // 1024, 'KB')


def save_rgba(name, rgba, q=90):
    img = Image.fromarray(np.clip(rgba * 255 + 0.5, 0, 255).astype(np.uint8), 'RGBA')
    img.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=q, method=6)
    print('wrote', name, img.size, os.path.getsize(os.path.join(OUT, name + '.webp')) // 1024, 'KB')


def lerp(a, b, t):
    return a + (b - a) * t


def col(hexs):
    hexs = hexs.lstrip('#')
    return np.array([int(hexs[i:i + 2], 16) / 255.0 for i in (0, 2, 4)])


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def cracks(h, w, n, seed, length=(40, 160), jitter=0.9):
    """Tileable hairline crack mask (random walks)."""
    r = np.random.default_rng(seed)
    m = np.zeros((h, w), np.float32)
    for _ in range(n):
        y, x = r.uniform(0, h), r.uniform(0, w)
        a = r.uniform(0, 2 * np.pi)
        L = int(r.uniform(*length))
        wdt = r.uniform(0.5, 1.0)
        for i in range(L):
            a += r.normal(0, jitter * 0.35)
            y += np.sin(a)
            x += np.cos(a)
            m[int(y) % h, int(x) % w] = max(m[int(y) % h, int(x) % w], wdt * (1 - i / L * 0.5))
            if r.random() < 0.012:  # branch
                a += r.choice([-1, 1]) * r.uniform(0.6, 1.2)
    return np.clip(wrap_blur(m, 0.6) * 2.2, 0, 1)


# ------------------------------------------------------------------------------------------ plaster
def plaster():
    S = 1024
    big = fnoise(S, S, 2.6, 11, 2)
    mid = band(S, S, 8, 40, 12)
    grain = band(S, S, 180, 480, 13)
    # trowel strokes: anisotropic smooth ridges in random directions (patches)
    strokes = np.zeros((S, S))
    for k, ang in enumerate(np.linspace(0, np.pi, 5, endpoint=False)):
        ca, sa = np.cos(ang), np.sin(ang)
        b = band(S, S, 6, 26, 20 + k, aniso=(1.0, 4.0))
        b = ndimage.rotate(np.tile(b, (2, 2)), np.degrees(ang), reshape=False, mode='wrap')[S // 2:S // 2 + S, S // 2:S // 2 + S]
        wgt = band(S, S, 2, 5, 30 + k) ** 3
        strokes += b * wgt
    strokes /= strokes.max()
    # tileability of the rotated strokes is not exact: fade the seam with a wrapped blur mix
    strokes = wrap_blur(strokes, 1.2)
    ck = cracks(S, S, 26, 7)
    pits = (band(S, S, 90, 200, 14) > 0.82).astype(float) * band(S, S, 60, 120, 15)
    pits = wrap_blur(pits, 0.8)
    # straw fibres (mud plaster temper)
    straw = np.zeros((S, S))
    r = np.random.default_rng(16)
    for _ in range(900):
        y, x = r.uniform(0, S, 2)
        a = r.uniform(0, np.pi)
        L = r.uniform(6, 22)
        for t in np.linspace(0, L, int(L * 2)):
            straw[int(y + np.sin(a) * t) % S, int(x + np.cos(a) * t) % S] = 1
    straw = wrap_blur(straw, 0.5)
    h = big * 0.5 + mid * 0.25 + strokes * 0.35 + grain * 0.06 - ck * 0.35 - pits * 0.25 + straw * 0.05
    base = col('#cdb894')
    warm = col('#b89a70')
    pale = col('#ddd0b4')
    t = np.clip(big * 1.6 - 0.35, 0, 1)[..., None]
    alb = lerp(warm, pale, t)
    alb = alb * (0.9 + 0.2 * mid[..., None]) * (0.96 + 0.08 * grain[..., None])
    alb = lerp(alb, base * 0.55, ck[..., None] * 0.8)
    alb = lerp(alb, col('#8a6f48'), straw[..., None] * 0.55)
    alb = lerp(alb, alb * 0.72, pits[..., None])
    save_rgb('plaster_a', alb)
    save_rgb('plaster_n', normal_from_height(h, 7.0))


# ------------------------------------------------------------------------------------------ timber
def wood():
    W, H = 512, 1024
    # grain: strongly anisotropic noise (long along V)
    g1 = band(H, W, 20, 90, 21, aniso=(1.0, 0.06))
    g2 = band(H, W, 60, 260, 22, aniso=(1.0, 0.04))
    rings = np.sin((g1 * 18 + band(H, W, 2, 6, 23) * 6) * np.pi) * 0.5 + 0.5
    # drying checks: long dark splits along the grain
    checks = np.zeros((H, W))
    r = np.random.default_rng(24)
    for _ in range(26):
        x = r.uniform(0, W)
        y0 = r.uniform(0, H)
        L = r.uniform(80, 520)
        wdt = r.uniform(0.6, 2.2)
        for i in range(int(L)):
            y = y0 + i
            x += r.normal(0, 0.15)
            v = np.sin(np.pi * i / L)
            checks[int(y) % H, int(x) % W] = max(checks[int(y) % H, int(x) % W], v * wdt)
    checks = np.clip(wrap_blur(checks, [0.8, 0.5]), 0, 1)
    # adze scallops across the grain
    adze = band(H, W, 10, 22, 25, aniso=(0.35, 1.0))
    adze = np.abs(np.sin(adze * 9.0))
    h = g1 * 0.35 + g2 * 0.25 + rings * 0.15 + adze * 0.35 - checks * 0.9
    dark = col('#4a3726')
    mid = col('#7a5d40')
    light = col('#9c7c58')
    t = np.clip(g1 * 0.8 + rings * 0.35 - 0.1, 0, 1)[..., None]
    alb = lerp(dark, lerp(mid, light, np.clip(g2[..., None] * 1.2 - 0.2, 0, 1)), t)
    grime = fnoise(H, W, 2.4, 26, 2)[..., None]
    alb = alb * (0.72 + 0.4 * grime)
    alb = lerp(alb, col('#1c140d'), checks[..., None] * 0.85)
    save_rgb('wood_a', alb)
    save_rgb('wood_n', normal_from_height(h, 5.0))


# ------------------------------------------------------------------------------------------ floor
def floor():
    S = 1024
    big = fnoise(S, S, 2.8, 31, 1.5)
    mid = band(S, S, 10, 50, 32)
    fine = band(S, S, 200, 500, 33)
    # grit and small pebbles
    r = np.random.default_rng(34)
    peb = np.zeros((S, S))
    pcol = np.zeros((S, S))
    for _ in range(2600):
        y, x = r.uniform(0, S, 2)
        rad = r.uniform(0.8, 3.2) if r.random() < 0.9 else r.uniform(3, 7)
        yy, xx = np.ogrid[-8:9, -8:9]
        d = np.sqrt(yy * yy + xx * xx * r.uniform(0.6, 1.4))
        blob = np.clip(1 - d / rad, 0, 1) ** 0.6
        ys = (np.arange(-8, 9) + int(y)) % S
        xs = (np.arange(-8, 9) + int(x)) % S
        sub = peb[np.ix_(ys, xs)]
        peb[np.ix_(ys, xs)] = np.maximum(sub, blob)
        cs = pcol[np.ix_(ys, xs)]
        pcol[np.ix_(ys, xs)] = np.where(blob > 0.05, r.uniform(0.3, 1), cs)
    lime = np.clip((band(S, S, 3, 10, 35) - 0.55) * 4, 0, 1)
    wear = np.clip((fnoise(S, S, 3.0, 36, 1) - 0.45) * 3, 0, 1)
    ck = cracks(S, S, 14, 37, (30, 120))
    h = big * 0.4 + mid * 0.2 + fine * 0.05 + peb * 0.35 - ck * 0.25 - wear * 0.1
    earth = col('#8b6a4c')
    earth2 = col('#a4825f')
    alb = lerp(earth, earth2, np.clip(mid * 1.5 - 0.3, 0, 1)[..., None])
    alb = lerp(alb, col('#c9b89a'), lime[..., None] * 0.6)
    alb = alb * (0.85 + 0.3 * big[..., None])
    stone = lerp(col('#9b8f7c'), col('#d8cdb4'), pcol[..., None])
    alb = lerp(alb, stone, (peb[..., None] > 0.25) * np.clip(peb[..., None] * 1.5, 0, 1))
    alb = lerp(alb, alb * 0.6, ck[..., None])
    alb = alb * (0.95 + 0.1 * fine[..., None])
    save_rgb('floor_a', alb)
    save_rgb('floor_n', normal_from_height(h, 6.0))


# ------------------------------------------------------------------------------------------ textiles
CREAM = col('#e4d6b8')
CREAM2 = col('#d2c19c')
SCARLET = col('#a3201a')    # kermes (tola'at shani)
SCARLET2 = col('#c0392b')
PURPLE = col('#5b1f45')     # murex argaman (red-purple)
BLUE = col('#27406e')       # tekhelet (blue-violet)
MADDER = col('#8e3a22')
UMBER = col('#4b3423')


def textile_cell(kind, S=512):
    y, x = np.mgrid[0:S, 0:S] / S
    img = np.zeros((S, S, 3))
    img[:] = CREAM
    # slub: uneven hand-spun yarn -> streaks along the weft (horizontal) and warp
    slub = band(S, S, 30, 120, 40 + kind, aniso=(0.1, 1.0)) * 0.6 + band(S, S, 30, 120, 50 + kind, aniso=(1.0, 0.1)) * 0.4
    if kind == 0:
        # hanging: broad scarlet field with purple and blue bands, lozenge (diamond) border rows, cream ground
        img[:] = CREAM
        def bandy(y0, y1, c):
            m = ((y >= y0) & (y < y1))[..., None]
            return np.where(m, c, img)
        img = bandy(0.18, 0.82, SCARLET)
        img = bandy(0.22, 0.25, CREAM)
        img = bandy(0.75, 0.78, CREAM)
        img = bandy(0.30, 0.36, PURPLE)
        img = bandy(0.64, 0.70, PURPLE)
        img = bandy(0.47, 0.53, BLUE)
        # lozenge row in the central band
        per = 1 / 8
        dx = np.abs(((x / per) % 1) - 0.5) * 2
        dy = np.abs((y - 0.5) / 0.1)
        loz = (dx * 0.5 + dy * 0.5 < 0.5) & (np.abs(y - 0.5) < 0.1)
        inner = (dx * 0.5 + dy * 0.5 < 0.28) & (np.abs(y - 0.5) < 0.1)
        img = np.where(loz[..., None], CREAM, img)
        img = np.where(inner[..., None], BLUE, img)
        # zigzags in the purple bands
        for yc in (0.33, 0.67):
            zz = np.abs(((x * 16) % 1) - 0.5) * 2 * 0.03
            m = np.abs(y - (yc - 0.015 + zz)) < 0.006
            img = np.where(m[..., None], SCARLET2, img)
        # thin cream ticks in the scarlet
        tick = (np.abs(((x * 32) % 1) - 0.5) < 0.06) & ((np.abs(y - 0.2) < 0.012) | (np.abs(y - 0.8) < 0.012))
        img = np.where(tick[..., None], CREAM, img)
        # dark edge selvedges
        img = np.where(((y < 0.03) | (y > 0.97))[..., None], MADDER, img)
    elif kind == 1:
        # rug / kilim: stepped lozenges and stripes (madder, blue, cream, umber)
        img[:] = MADDER
        stripe = (y * 20).astype(int)
        img = np.where(((stripe % 5) == 0)[..., None], UMBER, img)
        img = np.where(((y > 0.08) & (y < 0.12) | (y > 0.88) & (y < 0.92))[..., None], CREAM, img)
        per = 1 / 4
        cx = ((x / per) % 1) - 0.5
        cy = (y - 0.5) / 0.32
        step = np.floor(np.abs(cx) * 10) / 10 + np.floor(np.abs(cy) * 10) / 10
        m = (np.abs(cy) < 1.0)
        img = np.where((m & (step < 0.55))[..., None], CREAM, img)
        img = np.where((m & (step < 0.42))[..., None], BLUE, img)
        img = np.where((m & (step < 0.26))[..., None], SCARLET2, img)
        img = np.where((m & (step < 0.12))[..., None], CREAM, img)
    elif kind == 2:
        # cushion: argaman purple with scarlet and cream stripes
        img[:] = PURPLE
        s = (y * 12) % 1
        img = np.where(((s > 0.1) & (s < 0.18))[..., None], SCARLET, img)
        img = np.where(((s > 0.2) & (s < 0.23))[..., None], CREAM, img)
        img = np.where(((s > 0.6) & (s < 0.64))[..., None], BLUE * 1.2, img)
    else:
        # plain cream wool mantle with a woven blue (tekhelet) and scarlet stripe near the edge
        img[:] = CREAM
        img = np.where(((y > 0.86) & (y < 0.9))[..., None], BLUE, img)
        img = np.where(((y > 0.91) & (y < 0.925))[..., None], SCARLET, img)
        img = np.where(((y > 0.08) & (y < 0.1))[..., None], UMBER, img)
    # dye unevenness (natural dyes are never flat), hand-spun slubs, a little wear / fading
    dye = band(S, S, 3, 12, 60 + kind)[..., None]
    img = img * (0.86 + 0.24 * dye) * (0.9 + 0.2 * slub[..., None])
    fade = np.clip(fnoise(S, S, 2.5, 70 + kind, 2) - 0.55, 0, 1)[..., None]
    img = lerp(img, CREAM2 * 0.95, fade * 0.35)
    # soften hard pattern edges a touch (threads interlock)
    img = ndimage.gaussian_filter(img, [0.7, 0.7, 0], mode='wrap')
    return img


def textiles():
    S = 512
    atlas = np.zeros((2 * S, 2 * S, 3))
    for k in range(4):
        cell = textile_cell(k, S)
        r0, c0 = (k // 2) * S, (k % 2) * S
        atlas[r0:r0 + S, c0:c0 + S] = cell
    save_rgb('textile_a', atlas, 90)
    # micro weave: plain (tabby) weave of slightly irregular hand-spun yarns, 8 x 8 threads per tile
    T = 256
    y, x = np.mgrid[0:T, 0:T] / T
    n = 8
    warp_phase = (x * n) % 1
    weft_phase = (y * n) % 1
    ci = (np.floor(x * n) + np.floor(y * n)) % 2
    warp = np.sin(np.pi * warp_phase) ** 0.7
    weft = np.sin(np.pi * weft_phase) ** 0.7
    over = np.where(ci > 0, warp * (0.6 + 0.4 * np.sin(np.pi * weft_phase)), weft * (0.6 + 0.4 * np.sin(np.pi * warp_phase)))
    fuzz = band(T, T, 40, 120, 80)
    h = over + fuzz * 0.25
    save_rgb('weave_n', normal_from_height(h, 5.0))


# ------------------------------------------------------------------------------------------ tamarisk
def tamarisk():
    """Tamarix aphylla foliage: masses of fine, jointed, drooping grey-green branchlets hanging from a few twigs.
    Each cell hangs from its top edge (the card is attached at v = 1)."""
    S = 1024
    SS = 2
    C = S // 2 * SS
    atlas = Image.new('RGBA', (S * SS, S * SS), (0, 0, 0, 0))
    r = np.random.default_rng(90)
    for ci, (cx, cy) in enumerate([(0, 0), (1, 0), (0, 1), (1, 1)]):
        cell = Image.new('RGBA', (C, C), (0, 0, 0, 0))
        d = ImageDraw.Draw(cell)
        # a few woody twigs along the top
        twigs = []
        for t in range(4):
            x0 = r.uniform(0.1, 0.9) * C
            y0 = r.uniform(0.0, 0.06) * C
            x1 = x0 + r.uniform(-0.3, 0.3) * C
            y1 = y0 + r.uniform(0.08, 0.2) * C
            d.line([(x0, y0), (x1, y1)], fill=(92, 80, 66, 255), width=int(SS * 2.5))
            twigs.append(((x0, y0), (x1, y1)))
        n = 150 if ci < 3 else 190
        for k in range(n):
            (ax, ay), (bx, by) = twigs[k % len(twigs)]
            t = r.uniform(0, 1)
            x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            L = r.uniform(0.35, 0.92) * C
            a = np.pi / 2 + r.normal(0, 0.18)
            tone = r.uniform(0, 1)
            gcol = lerp(np.array([122, 132, 118]), np.array([168, 172, 152]), tone)
            steps = 30
            for s_ in range(steps):
                a += r.normal(0, 0.03)
                nx, ny = x + np.cos(a) * L / steps, y + np.sin(a) * L / steps
                shade = 0.8 + 0.28 * ((s_ % 3) == 0)
                c = tuple(int(v) for v in np.clip(gcol * shade, 0, 255)) + (255,)
                d.line([(x, y), (nx, ny)], fill=c, width=max(2, int(SS * (1.9 - 0.8 * s_ / steps))))
                # tiny side branchlets
                if r.random() < 0.18:
                    a2 = a + r.choice([-1, 1]) * r.uniform(0.3, 0.7)
                    l2 = r.uniform(0.02, 0.06) * C
                    d.line([(x, y), (x + np.cos(a2) * l2, y + np.sin(a2) * l2)], fill=c, width=max(1, SS))
                x, y = nx, ny
        cell = cell.filter(ImageFilter.GaussianBlur(0.35))
        atlas.paste(cell, (cx * C, cy * C))
    atlas = atlas.resize((S, S), Image.LANCZOS)
    a = np.asarray(atlas).astype(np.float32) / 255
    rgb = a[..., :3].copy()
    al = a[..., 3]
    mask = al > 0.05
    if (~mask).any():
        idx = ndimage.distance_transform_edt(~mask, return_distances=False, return_indices=True)
        rgb = rgb[idx[0], idx[1]]
    out = np.concatenate([rgb, al[..., None]], -1)
    save_rgba('tamarisk', out)


# ------------------------------------------------------------------------------------------ pottery
def clay():
    S = 512
    y, x = np.mgrid[0:S, 0:S] / S
    rings = band(S, S, 30, 140, 101, aniso=(0.02, 1.0))
    speck = (band(S, S, 150, 250, 102) > 0.78).astype(float)
    big = fnoise(S, S, 2.6, 103, 2)
    h = rings * 0.6 + big * 0.2 + speck * 0.15
    c1 = col('#b97f55')
    c2 = col('#d0a47a')
    alb = lerp(c1, c2, np.clip(big * 1.4 - 0.2, 0, 1)[..., None])
    alb = alb * (0.9 + 0.18 * rings[..., None])
    alb = lerp(alb, col('#5a3a26'), speck[..., None] * 0.5)
    fire = np.clip(band(S, S, 2, 5, 104) - 0.6, 0, 1)[..., None] * 2  # firing clouds
    alb = lerp(alb, col('#6e5140'), fire * 0.5)
    save_rgb('clay_a', alb)
    save_rgb('clay_n', normal_from_height(h, 3.0))


# ------------------------------------------------------------------------------------------ fleece
def fleece():
    S = 512
    r = np.random.default_rng(110)
    h = np.zeros((S, S))
    colv = np.zeros((S, S))
    yy, xx = np.mgrid[-12:13, -12:13]
    for _ in range(2600):
        y, x = r.uniform(0, S, 2)
        rad = r.uniform(4, 10)
        tw = r.uniform(0, np.pi)
        u = xx * np.cos(tw) + yy * np.sin(tw)
        v = -xx * np.sin(tw) + yy * np.cos(tw)
        d = np.sqrt((u / rad) ** 2 + (v / (rad * 0.6)) ** 2)
        blob = np.clip(1 - d, 0, 1) ** 0.5 * (0.7 + 0.3 * np.sin(u * 1.4 + v * 0.3))
        ys = (np.arange(-12, 13) + int(y)) % S
        xs = (np.arange(-12, 13) + int(x)) % S
        sub = h[np.ix_(ys, xs)]
        h[np.ix_(ys, xs)] = np.maximum(sub, blob)
        cs = colv[np.ix_(ys, xs)]
        colv[np.ix_(ys, xs)] = np.where(blob >= sub, r.uniform(0, 1), cs)
    fine = band(S, S, 100, 250, 111)
    h = h + fine * 0.2
    c = lerp(col('#b7a585'), col('#e8dfcb'), colv[..., None])
    alb = c * (0.55 + 0.5 * h[..., None] / h.max())
    alb = lerp(alb, col('#6b5a44'), np.clip(0.35 - h, 0, 1)[..., None] * 1.5)
    save_rgb('fleece_a', alb)
    save_rgb('fleece_n', normal_from_height(h, 4.0))


# ------------------------------------------------------------------------------------------ reed / branch ceiling
def reed():
    S = 512
    y, x = np.mgrid[0:S, 0:S] / S
    n = 22
    jitter = band(S, S, 2, 8, 120, aniso=(0.05, 1.0))
    ph = (y * n + jitter * 1.5) % 1
    idx = np.floor(y * n + jitter * 1.5)
    cyl = np.sqrt(np.clip(1 - (ph * 2 - 1) ** 2, 0, 1))
    nodes = (np.abs(((x * 3 + np.sin(idx * 12.9) * 0.5) % 1) - 0.5) < 0.012).astype(float)
    grain = band(S, S, 60, 200, 121, aniso=(0.05, 1.0))
    clay_m = np.clip((band(S, S, 4, 14, 122) - 0.58) * 5, 0, 1)
    h = cyl * 0.8 - nodes * 0.2 + grain * 0.1
    h = lerp(h, 0.45 + band(S, S, 20, 60, 123) * 0.2, clay_m)
    tone = (np.sin(idx * 7.13) * 0.5 + 0.5)[..., None]
    alb = lerp(col('#6d5234'), col('#9b7c52'), tone) * (0.55 + 0.5 * cyl[..., None])
    alb = lerp(alb, col('#8d7355'), clay_m[..., None])
    alb = alb * (0.9 + 0.2 * grain[..., None])
    save_rgb('reed_a', alb)
    save_rgb('reed_n', normal_from_height(h, 4.0))


import sys
if __name__ == '__main__':
    if len(sys.argv) > 1:
        for n in sys.argv[1:]: globals()[n]()
        raise SystemExit
    plaster()
    wood()
    floor()
    textiles()
    tamarisk()
    clay()
    fleece()
    reed()
