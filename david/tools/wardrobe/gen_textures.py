#!/usr/bin/env python3
"""
Wardrobe texture generator (numpy + Pillow; everything procedural, CC0 by construction).

    python3 tools/wardrobe/gen_textures.py            # all textures -> src/assets/wardrobe/
    python3 tools/wardrobe/gen_textures.py weave_coarse leather   # only some

Every texture is TILEABLE (periodic noise / periodic thread layouts) and NEUTRAL in colour where the runtime tints it
(dyes, leather tones): the shader in src/characters/wardrobe/ClothMaterial.ts multiplies by the garment colour.

Packing (all .webp):
  <name>_a_<res>.webp  RGBA  sRGB   rgb = albedo (neutral / pre-coloured), a = coverage (threads 1, gaps 0)
  <name>_n_<res>.webp  RGBA  linear r,g = tangent normal xy (0.5 = flat), b = ambient occlusion, a = height
"""
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'src', 'assets', 'wardrobe')


# ----------------------------------------------------------------------------------------------- helpers
def periodic_noise(shape, cells, rng, octaves=4, persistence=0.5, aniso=(1.0, 1.0)):
    """Tileable value-noise fBm on an (h, w) grid; `cells` = lattice cells across the tile for octave 0."""
    h, w = shape
    out = np.zeros(shape, np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        cy = max(1, int(round(cells * aniso[0] * 2 ** o)))
        cx = max(1, int(round(cells * aniso[1] * 2 ** o)))
        lat = rng.random((cy, cx)).astype(np.float32)
        ys = np.arange(h, dtype=np.float32) * cy / h
        xs = np.arange(w, dtype=np.float32) * cx / w
        y0 = np.floor(ys).astype(int)
        x0 = np.floor(xs).astype(int)
        fy = ys - y0
        fx = xs - x0
        fy = fy * fy * (3 - 2 * fy)
        fx = fx * fx * (3 - 2 * fx)
        y1 = (y0 + 1) % cy
        x1 = (x0 + 1) % cx
        y0 %= cy
        x0 %= cx
        a = lat[y0][:, x0]
        b = lat[y0][:, x1]
        c = lat[y1][:, x0]
        d = lat[y1][:, x1]
        fxr = fx[None, :]
        fyr = fy[:, None]
        v = (a * (1 - fxr) + b * fxr) * (1 - fyr) + (c * (1 - fxr) + d * fxr) * fyr
        out += v * amp
        tot += amp
        amp *= persistence
    return out / tot


def noise1d_periodic(n, cells, rng, octaves=3):
    """Tileable 1D fBm, n samples, values ~[0,1]."""
    out = np.zeros(n, np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        c = cells * 2 ** o
        lat = rng.random(c).astype(np.float32)
        xs = np.arange(n, dtype=np.float32) * c / n
        x0 = np.floor(xs).astype(int)
        f = xs - x0
        f = f * f * (3 - 2 * f)
        v = lat[x0 % c] * (1 - f) + lat[(x0 + 1) % c] * f
        out += v * amp
        tot += amp
        amp *= 0.5
    return out / tot


def normal_from_height(hgt, strength):
    """Periodic central differences -> tangent-space normal (x right = +u, y up = +v in texture space)."""
    dx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * 0.5
    dy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * 0.5
    # image rows go DOWN while v goes UP (three.js flipY) -> +v derivative is -dy
    nx = -dx * strength
    ny = dy * strength
    nz = np.ones_like(hgt)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    return nx / ln, ny / ln, nz / ln


def blur_periodic(a, r):
    """Cheap separable box blur (periodic), r passes of 3-tap."""
    for _ in range(r):
        a = (np.roll(a, 1, 0) + a + np.roll(a, -1, 0)) / 3
        a = (np.roll(a, 1, 1) + a + np.roll(a, -1, 1)) / 3
    return a


def ao_from_height(hgt, radius_px):
    """Crude ambient occlusion: how far below the local (blurred) surroundings a texel sits."""
    passes = max(1, int(radius_px))
    avg = blur_periodic(hgt, passes)
    ao = 1.0 - np.clip((avg - hgt) * 3.0, 0, 1)
    return ao


def save_pair(name, res, albedo, alpha, nrm, ao, height, q=80):
    os.makedirs(OUT, exist_ok=True)
    a = np.dstack([np.clip(albedo, 0, 1), np.clip(alpha, 0, 1)])
    img = Image.fromarray((a * 255 + 0.5).astype(np.uint8), 'RGBA')
    tag = f'{res // 1024}k' if res >= 1024 else f'{res}'
    img.save(os.path.join(OUT, f'{name}_a_{tag}.webp'), 'WEBP', quality=q, method=6, alpha_quality=90)
    nx, ny, nz = nrm
    n = np.dstack([nx * 0.5 + 0.5, ny * 0.5 + 0.5, np.clip(ao, 0, 1), np.clip(height, 0, 1)])
    img = Image.fromarray((n * 255 + 0.5).astype(np.uint8), 'RGBA')
    img.save(os.path.join(OUT, f'{name}_n_{tag}.webp'), 'WEBP', quality=q - 10, method=6, alpha_quality=70)
    print('  wrote', name, tag)


def resample(arr, res):
    if arr.shape[0] == res:
        return arr
    img = Image.fromarray(arr.astype(np.float32), 'F')
    return np.asarray(img.resize((res, res), Image.LANCZOS), np.float32)


# ----------------------------------------------------------------------------------------------- weaves
def weave(res, threads, width_frac, slub, wander, seed, fuzz=0.25, gap_jitter=0.18, height_boost=1.0, twill=False):
    """
    Plain (or 2/1 twill) weave of `threads` warp x `threads` weft yarns over one tile, periodic.
    Returns height [0..1], coverage [0..1], per-pixel yarn tone, fibre streak map.
    """
    rng = np.random.default_rng(seed)
    pitch = res / threads
    yy, xx = np.mgrid[0:res, 0:res].astype(np.float32)
    height = np.full((res, res), -1.0, np.float32)
    cover = np.zeros((res, res), np.float32)
    tone = np.ones((res, res), np.float32)
    streak = np.zeros((res, res), np.float32)
    fibre_hi = periodic_noise((res, res), threads * 3, rng, octaves=2, aniso=(4.0, 0.25))  # along y (warp)
    fibre_hi2 = periodic_noise((res, res), threads * 3, rng, octaves=2, aniso=(0.25, 4.0))  # along x (weft)
    base_pos = (np.arange(threads) + 0.5 + (rng.random(threads) - 0.5) * gap_jitter * 2) * pitch
    base_pos_w = (np.arange(threads) + 0.5 + (rng.random(threads) - 0.5) * gap_jitter * 2) * pitch
    tones_warp = 1.0 + (rng.random(threads) - 0.5) * 0.22
    tones_weft = 1.0 + (rng.random(threads) - 0.5) * 0.22
    # a few darker / browner yarns (natural fleece variation)
    for arr in (tones_warp, tones_weft):
        k = rng.random(threads) < 0.12
        arr[k] *= 0.8
    halfw = pitch * width_frac * 0.5
    band = int(np.ceil(pitch * 1.3))
    for axis in (0, 1):  # 0: warp (vertical yarns, vary along y), 1: weft (horizontal)
        pos = base_pos if axis == 0 else base_pos_w
        tones = tones_warp if axis == 0 else tones_weft
        for i in range(threads):
            slubn = noise1d_periodic(res, max(2, threads // 3), rng, 3)
            wand = (noise1d_periodic(res, max(2, threads // 4), rng, 2) - 0.5) * 2 * wander * pitch
            wid = halfw * (1.0 + (slubn - 0.5) * 2 * slub)
            c = pos[i]
            lo = int(np.floor(c - band))
            idx = np.arange(lo, lo + 2 * band + 1) % res
            if axis == 0:
                # columns idx, all rows
                X = (np.arange(lo, lo + 2 * band + 1)[None, :].astype(np.float32))
                d = np.abs(X - (c + wand[:, None]))
                w = wid[:, None]
                along = yy[:, :1]  # rows
                ph = (along[:, 0] / pitch)
            else:
                X = (np.arange(lo, lo + 2 * band + 1)[:, None].astype(np.float32))
                d = np.abs(X - (c + wand[None, :]))
                w = wid[None, :]
                ph = xx[0, :] / pitch
            t = np.clip(d / w, 0, 1.5)
            prof = np.sqrt(np.clip(1 - t * t, 0, 1))  # round yarn cross-section
            # over/under undulation: plain weave -> alternate each crossing
            crossing_phase = (ph - 0.5 - (base_pos_w[0] / pitch - 0.5 if axis == 0 else base_pos[0] / pitch - 0.5))
            if twill:
                und = np.cos(np.pi * 2 / 3 * (crossing_phase + i))
            else:
                und = np.cos(np.pi * (crossing_phase + i))
            und = und if axis == 0 else -und
            if axis == 0:
                h = prof * 0.62 + 0.28 * und[:, None] * prof
            else:
                h = prof * 0.62 + 0.28 * und[None, :] * prof
            h = np.where(t < 1, h, -1)
            if axis == 0:
                sub_h = height[:, idx]
                m = h > sub_h
                sub_h = np.where(m, h, sub_h)
                height[:, idx] = sub_h
                cov = np.clip((1.0 - t) * 3.5, 0, 1)
                cover[:, idx] = np.maximum(cover[:, idx], cov)
                tsub = tone[:, idx]
                tone[:, idx] = np.where(m, tones[i] * (0.93 + 0.14 * slubn[:, None]), tsub)
                ssub = streak[:, idx]
                streak[:, idx] = np.where(m, fibre_hi[:, idx], ssub)
            else:
                sub_h = height[idx, :]
                m = h > sub_h
                height[idx, :] = np.where(m, h, sub_h)
                cov = np.clip((1.0 - t) * 3.5, 0, 1)
                cover[idx, :] = np.maximum(cover[idx, :], cov)
                tsub = tone[idx, :]
                tone[idx, :] = np.where(m, tones[i] * (0.93 + 0.14 * slubn[None, :]), tsub)
                ssub = streak[idx, :]
                streak[idx, :] = np.where(m, fibre_hi2[idx, :], ssub)
    height = np.clip(height, 0, 1) * height_boost
    # fuzz: stray fibres partly bridging the gaps
    fz = periodic_noise((res, res), threads * 2, rng, octaves=3)
    cover = np.clip(cover + np.clip(fz - (1 - fuzz), 0, 1) * 2.0, 0, 1)
    return height, cover, tone, streak


def gen_weave(name, res_list, threads, width_frac, slub, wander, seed, base_rgb, fuzz, normal_strength, gap_jitter=0.18, twill=False, gap_dark=0.35):
    hi = max(res_list)
    height, cover, tone, streak = weave(hi, threads, width_frac, slub, wander, seed, fuzz, gap_jitter, twill=twill)
    rng = np.random.default_rng(seed + 99)
    height = height + (streak - 0.5) * 0.12 * (height > 0)
    low = periodic_noise((hi, hi), 3, rng, octaves=4)  # large-scale blotch (tileable)
    br = np.array(base_rgb, np.float32)
    lum = tone * (0.9 + 0.2 * streak) * (0.94 + 0.12 * low)
    albedo = br[None, None, :] * lum[:, :, None]
    # gaps (where coverage is partial) darker: seen-through shadowed interior
    albedo *= (gap_dark + (1 - gap_dark) * np.clip(height * 1.6 + 0.25, 0, 1))[:, :, None]
    ao = ao_from_height(height, max(2, hi // threads // 3)) * (0.55 + 0.45 * np.clip(height * 1.5, 0, 1))
    for res in res_list:
        f = lambda a: resample(a, res)
        h = blur_periodic(f(height), 1)
        n = normal_from_height(h, normal_strength * res / 1024)
        alb = np.dstack([f(albedo[:, :, c]) for c in range(3)])
        save_pair(name, res, alb, f(cover), n, f(ao), h)


# ----------------------------------------------------------------------------------------------- fringe (frayed hem)
def gen_fringe(res_w=512, res_h=256, threads=40, seed=5):
    """Hanging loose warp threads for hems / cuffs. Top rows = the last weft picks, then free threads."""
    rng = np.random.default_rng(seed)
    h, w = res_h, res_w
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    v = yy / h  # 0 top .. 1 bottom
    cover = np.zeros((h, w), np.float32)
    hgt = np.zeros((h, w), np.float32)
    tone = np.ones((h, w), np.float32)
    pitch = w / threads
    for i in range(threads * 2):
        cx = (i * 0.5 + rng.random() * 0.5) * pitch
        length = 0.25 + rng.random() ** 0.7 * 0.75  # fraction of card height
        wid = pitch * (0.16 + rng.random() * 0.14)
        wav_a = rng.random() * pitch * 0.35
        wav_f = 1.5 + rng.random() * 3
        ph = rng.random() * 6.28
        curl = (rng.random() - 0.5) * pitch * 1.5
        centre = cx + np.sin(v * wav_f * 6.28 + ph) * wav_a * v + curl * v * v
        d = np.abs(((xx - centre[:, :1] if False else xx - centre) + w / 2) % w - w / 2)
        taper = np.clip((length - v) / 0.08, 0, 1)
        ww = wid * (0.55 + 0.45 * taper) * (1 - 0.35 * v)
        t = d / np.maximum(ww, 0.3)
        prof = np.clip(1 - t * t, 0, 1)
        m = (v < length) & (prof > 0)
        tn = 0.85 + rng.random() * 0.3
        cover = np.where(m, np.maximum(cover, np.clip(prof * 2.5, 0, 1) * taper), cover)
        hgt = np.where(m & (prof > hgt), prof, hgt)
        tone = np.where(m, tn, tone)
    # the last few weft picks at the very top (so the card blends into the woven hem)
    for k in range(3):
        y0 = (0.02 + k * 0.045 + rng.random() * 0.01) * h
        wv = periodic_noise((1, w), 12, rng, 2)[0] * 3
        d = np.abs(yy - (y0 + wv))
        prof = np.clip(1 - (d / (pitch * 0.45)) ** 2, 0, 1)
        broken = periodic_noise((1, w), 9, rng, 2)[0] > 0.3 + k * 0.12
        prof = prof * broken[None, :]
        cover = np.maximum(cover, np.clip(prof * 3, 0, 1))
        hgt = np.maximum(hgt, prof)
    fib = periodic_noise((h, w), 30, rng, 2, aniso=(3.0, 0.3))
    alb = (0.78 + 0.22 * fib) * tone * (1 - 0.25 * v)
    albedo = np.dstack([alb, alb, alb])
    n = normal_from_height(hgt, 2.0)
    save_pair('fringe', 512, albedo, cover, n, 0.6 + 0.4 * hgt, hgt)


# ----------------------------------------------------------------------------------------------- leather
def gen_leather(res_list=(1024, 512), seed=11):
    hi = max(res_list)
    rng = np.random.default_rng(seed)
    grain = periodic_noise((hi, hi), 64, rng, octaves=3, persistence=0.55)
    cells = periodic_noise((hi, hi), 22, rng, octaves=2)
    ridges = 1 - np.abs(periodic_noise((hi, hi), 9, rng, octaves=4) * 2 - 1)  # crease network
    creases = np.clip((ridges - 0.9) * 5, 0, 1)
    pores = np.clip((periodic_noise((hi, hi), 180, rng, octaves=1) - 0.72) * 5, 0, 1)
    height = 0.55 + 0.25 * grain + 0.12 * cells - 0.35 * creases - 0.08 * pores
    low = periodic_noise((hi, hi), 4, rng, octaves=4)
    lum = 0.78 + 0.28 * low + 0.08 * grain - 0.22 * creases - 0.05 * pores
    albedo = np.dstack([lum, lum, lum])
    ao = ao_from_height(height, 4) * (1 - 0.3 * creases)
    rough = 0.5 + 0.3 * low
    for res in res_list:
        f = lambda a: resample(a, res)
        h = f(height)
        n = normal_from_height(h, 5.0 * res / 1024)
        save_pair('leather', res, np.dstack([f(albedo[:, :, c]) for c in range(3)]), f(rough), n, f(ao), h)


# ----------------------------------------------------------------------------------------------- ropes
def gen_rope(res=256, seed=21):
    """u = around the cord (1 tile), v = along the cord. 3-ply twist; albedo neutral, alpha = ply id tone."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:res, 0:res].astype(np.float32)
    u = xx / res
    v = yy / res
    plies = 3
    twist = 4.0  # turns per tile
    s = (u * plies + v * twist * plies) % 1.0
    ply = np.floor((u * plies + v * twist * plies) % plies)
    prof = np.sin(s * np.pi) ** 0.7
    fib = periodic_noise((res, res), 24, rng, 2, aniso=(1.0, 1.0))
    # fibres along each ply: diagonal streaks at a steeper angle
    fs = np.sin(((u * 20 + v * twist * 26) % 1.0) * 6.28) * 0.5 + 0.5
    height = prof * 0.8 + fs * 0.12 * prof + fib * 0.08
    lum = 0.7 + 0.3 * prof + 0.08 * (fs - 0.5)
    tone_ply = np.array([1.0, 0.86, 0.94], np.float32)[ply.astype(int)]
    albedo = np.dstack([lum, lum, lum])
    n = normal_from_height(height, 6.0)
    save_pair('rope', res, albedo, tone_ply / 1.0, n, 0.45 + 0.55 * prof, height)


def gen_braid(res=256, seed=23):
    """Flat 3/4-strand plait (sling cords): chevrons along v."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:res, 0:res].astype(np.float32)
    u = xx / res
    v = yy / res
    k = 6.0  # chevrons per tile
    a = np.abs(((u * 2) % 1.0) - 0.5) * 2  # 0 at strand centre line ... 1 at the flanks
    s = (v * k + a * 0.6) % 1.0
    prof = np.sin(s * np.pi) ** 0.8
    side = (np.floor(u * 2) % 2)
    fib = periodic_noise((res, res), 32, rng, 2)
    height = prof * 0.85 + fib * 0.1
    lum = 0.72 + 0.28 * prof + (side - 0.5) * 0.06
    albedo = np.dstack([lum, lum, lum])
    n = normal_from_height(height, 5.0)
    save_pair('braid', res, albedo, np.ones_like(lum), n, 0.5 + 0.5 * prof, height)


# ----------------------------------------------------------------------------------------------- wood / bark (staff, spear)
def gen_wood(res_list=(1024, 512), seed=31):
    """RGB = worn wood (grain along v), A = bark mask base noise; normal from grain + bark fissures in _n."""
    hi = max(res_list)
    rng = np.random.default_rng(seed)
    grain = periodic_noise((hi, hi), 10, rng, octaves=5, aniso=(0.12, 3.0))  # streaks along v (rows)
    fine = periodic_noise((hi, hi), 60, rng, octaves=2, aniso=(0.1, 2.0))
    fiss = 1 - np.abs(periodic_noise((hi, hi), 14, rng, octaves=3, aniso=(0.2, 1.4)) * 2 - 1)
    fissures = np.clip((fiss - 0.7) * 4, 0, 1)
    plates = periodic_noise((hi, hi), 8, rng, octaves=3, aniso=(0.5, 1.5))
    bark_h = 0.6 + 0.3 * plates - 0.55 * fissures
    wood_h = 0.5 + 0.08 * (grain - 0.5) + 0.05 * (fine - 0.5)
    lines = np.clip((np.sin((grain * 22.0) * 6.28) * 0.5 + 0.5) ** 6, 0, 1)
    lum = 0.62 + 0.3 * grain - 0.18 * lines + 0.06 * fine
    albedo = np.dstack([lum * 1.0, lum * 0.78, lum * 0.58])
    barkmask = periodic_noise((hi, hi), 5, rng, octaves=4, aniso=(0.6, 1.0))
    for res in res_list:
        f = lambda a: resample(a, res)
        # normal map encodes BOTH: rg = worn wood normal, the bark relief goes to height (a) and AO (b)
        n = normal_from_height(f(wood_h), 3.0 * res / 1024)
        save_pair('wood', res, np.dstack([f(albedo[:, :, c]) for c in range(3)]), f(barkmask), n, f(0.35 + 0.65 * np.clip(bark_h, 0, 1)), f(np.clip(bark_h, 0, 1)))
        nb = normal_from_height(f(bark_h), 7.0 * res / 1024)
        # bark: separate small texture (normal + ao)
        bl = 0.45 + 0.25 * f(plates) - 0.25 * f(fissures)
        save_pair('bark', res, np.dstack([bl * 0.95, bl * 0.82, bl * 0.7]), np.ones_like(bl), nb, f(0.4 + 0.6 * np.clip(bark_h, 0, 1)), f(np.clip(bark_h, 0, 1)))


# ----------------------------------------------------------------------------------------------- metal breakup + scales
def gen_scratches(res=512, seed=41):
    rng = np.random.default_rng(seed)
    img = np.zeros((res, res), np.float32)
    yy, xx = np.mgrid[0:res, 0:res].astype(np.float32)
    for _ in range(260):
        x0, y0 = rng.random(2) * res
        ang = rng.random() * np.pi
        ln = 10 + rng.random() * 80
        dx, dy = np.cos(ang), np.sin(ang)
        # distance to segment (periodic by evaluating around the wrap)
        px = (xx - x0 + res / 2) % res - res / 2
        py = (yy - y0 + res / 2) % res - res / 2
        t = np.clip(px * dx + py * dy, 0, ln)
        d = np.hypot(px - t * dx, py - t * dy)
        img = np.maximum(img, np.clip(1 - d / (0.6 + rng.random() * 0.8), 0, 1) * (0.3 + rng.random() * 0.7))
    blot = periodic_noise((res, res), 6, rng, octaves=5)
    grain = periodic_noise((res, res), 90, rng, octaves=2)
    h = 0.5 - img * 0.3 + (grain - 0.5) * 0.1
    n = normal_from_height(h, 2.0)
    alb = np.dstack([blot, grain, img])  # r = low blotches, g = fine grain, b = scratches (data, not colour)
    save_pair('metal', res, alb, np.ones_like(blot), n, 1 - img * 0.3, h)


def gen_scales(res=512, seed=51):
    """Bronze scale armour: rows of overlapping rounded lamellae (8 across x 6 rows per tile)."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:res, 0:res].astype(np.float32)
    cols, rows = 8, 6
    cw, rh = res / cols, res / rows
    height = np.full((res, res), -1.0, np.float32)
    tone = np.ones((res, res), np.float32)
    # draw from the top row down: lower rows overlap the upper ones (their top edge hides under)
    for r in range(rows + 1):
        off = (r % 2) * 0.5 * cw
        for c in range(cols + 1):
            cx = c * cw + off
            top = r * rh - rh * 0.7
            bot = r * rh + rh * 0.55
            px = (xx - cx + res / 2) % res - res / 2
            py = ((yy - top) + res / 2) % res - res / 2 + res / 2 - res / 2
            yl = (yy - top) % res
            hw = cw * 0.52
            inside_x = np.abs(px) < hw
            length = bot - top
            # rounded bottom
            yb = length - hw + np.sqrt(np.clip(hw * hw - px * px, 0, None))
            inside = inside_x & (yl < yb) & (yl >= 0)
            dome = np.sqrt(np.clip(1 - (px / hw) ** 2, 0, 1)) * 0.6 + 0.3 * (yl / length)
            ridge = np.clip(1 - np.abs(px) / (hw * 0.12), 0, 1) * 0.15
            hh = dome + ridge + r * 0.001
            m = inside & (hh + 0.0 * yl > -1)
            # lower row always wins where it overlaps the one above
            height = np.where(m, hh, height)
            tone = np.where(m, 0.85 + rng.random() * 0.3, tone)
    cover = (height > -0.5).astype(np.float32)
    height = np.clip(height, 0, 1)
    ao = ao_from_height(height, 6)
    lum = tone * (0.75 + 0.25 * height)
    albedo = np.dstack([lum, lum, lum])
    n = normal_from_height(blur_periodic(height, 1), 7.0)
    save_pair('scales', res, albedo, cover, n, ao, height)


JOBS = {
    # David's tunic: loose, slubby, open grid weave (oatmeal), ~3.2 mm pitch over a 16 cm tile
    'weave_coarse': lambda: gen_weave('weave_coarse', (1024, 512), 50, 0.8, 0.32, 0.10, 7, (0.86, 0.80, 0.68), 0.12, 7.0, 0.22, gap_dark=0.3),
    # under-layer / plain wool tunics (court): tighter, still hand-spun (neutral: dyed at runtime)
    'weave_medium': lambda: gen_weave('weave_medium', (1024, 512), 64, 0.9, 0.22, 0.06, 13, (0.9, 0.9, 0.9), 0.2, 5.0, 0.12, gap_dark=0.55),
    # fine wool twill / linen (Saul's robe and undertunic): neutral, dyed at runtime
    'weave_fine': lambda: gen_weave('weave_fine', (1024, 512), 96, 0.95, 0.12, 0.04, 17, (0.92, 0.92, 0.92), 0.25, 3.5, 0.06, twill=True, gap_dark=0.7),
    'fringe': gen_fringe,
    'leather': gen_leather,
    'rope': gen_rope,
    'braid': gen_braid,
    'wood': gen_wood,
    'metal': gen_scratches,
    'scales': gen_scales,
}

if __name__ == '__main__':
    names = sys.argv[1:] or list(JOBS)
    for n in names:
        print(n)
        JOBS[n]()
