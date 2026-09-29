#!/usr/bin/env python3
"""
Rough Iron Age fieldstone masonry for the citadel of Gibeah (Tell el-Ful): large, roughly dressed limestone
blocks laid in irregular, wavy rough courses, with small chinking stones packed into the wider joints and a
recessed mud mortar. Tileable. numpy / scipy / Pillow only, seeded.

Outputs (src/assets/palace/, WebP, 1024 x 1024, one tile = FIELDSTONE_TILE metres, see palaceMaterials.ts):
  fortstone_a   RGBA  albedo (sRGB) + height in alpha (0 = deepest mortar, 1 = most proud stone face)
  fortstone_n   RGBA  tangent-space normal (OpenGL, +Y up) + ambient occlusion in alpha
Run: python3 tools/palace/gen_fieldstone.py
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'palace')
S = 1024
TILE = 4.8          # metres per tile
PX = TILE / S       # metres per pixel
rng = np.random.default_rng(1025)


def band(h, w, fmin, fmax, seed=0, aniso=(1.0, 1.0)):
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


# ---------------------------------------------------------------------------------------------- stone layout
# rough courses: heights 0.32..0.66 m, wavy bed lines; stones 0.45..1.35 m long, some split into two stacked
# smaller stones, some tall "orthostat-like" stones spanning 1.5 courses; joints 2..7 cm.
stones = []  # (cx, cy, a, b, rot, p, seed, kind)
y = 0.0
courses = []
while y < TILE - 0.2:
    h = rng.uniform(0.3, 0.85)
    courses.append(h)
    y += h
courses = np.array(courses) * (TILE / sum(courses))
wave_ph = rng.uniform(0, 2 * np.pi, 3)
def wave(x):
    return 0.09 * np.sin(2 * np.pi * x / TILE * 1 + wave_ph[0]) + 0.05 * np.sin(2 * np.pi * x / TILE * 3 + wave_ph[1]) + 0.03 * np.sin(2 * np.pi * x / TILE * 5 + wave_ph[2])

y0 = 0.0
for ci, ch in enumerate(courses):
    x = rng.uniform(0, 1.0)
    lens = []
    tot = 0
    while tot < TILE - 0.3:
        L = rng.uniform(0.55, 1.6) if rng.random() > 0.2 else rng.uniform(0.32, 0.55)
        lens.append(L)
        tot += L
    lens = np.array(lens) * (TILE / sum(lens))
    for L in lens:
        cx = x + L / 2
        gapx = rng.uniform(0.012, 0.045)
        gapy = rng.uniform(0.012, 0.04)
        cyb = y0 + ch / 2 + wave(cx)
        r = rng.random()
        if r < 0.16 and L > 0.5:
            # two stacked smaller stones
            h1 = ch * rng.uniform(0.4, 0.6)
            for (yy, hh) in ((y0 + h1 / 2, h1), (y0 + h1 + (ch - h1) / 2, ch - h1)):
                stones.append((cx + rng.uniform(-0.03, 0.03), yy + wave(cx), L / 2 - gapx / 2 - rng.uniform(0, 0.05), hh / 2 - gapy / 2, rng.uniform(-0.08, 0.08), rng.uniform(3.5, 5.5), rng.integers(1 << 30), 1))
        else:
            tall = 1.0 + (rng.uniform(0.3, 0.75) if r > 0.72 else 0.0)
            stones.append((cx, cyb + (tall - 1) * ch * 0.5 * rng.choice([-1, 1]) + rng.uniform(-0.05, 0.05), L / 2 - gapx / 2, ch * tall / 2 - gapy / 2, rng.uniform(-0.06, 0.06), rng.uniform(4.0, 7.0), rng.integers(1 << 30), 0))
        x += L
    y0 += ch

# ---------------------------------------------------------------------------------------------- rasterise
best = np.full((S, S), 9.0, np.float32)     # normalised distance of the owning stone
owner = np.full((S, S), -1, np.int32)
face = np.zeros((S, S), np.float32)          # per-stone face relief
yy, xx = np.mgrid[0:S, 0:S]


def raster(i, cx, cy, a, b, rot, p, seed, amp_irreg=0.09):
    r = np.random.default_rng(seed)
    R = max(a, b) * 1.25
    x0 = int(np.floor((cx - R) / PX)); x1 = int(np.ceil((cx + R) / PX))
    y0_ = int(np.floor((cy - R) / PX)); y1 = int(np.ceil((cy + R) / PX))
    gx = np.arange(x0, x1); gy = np.arange(y0_, y1)
    X, Y = np.meshgrid(gx * PX + PX / 2 - cx, gy * PX + PX / 2 - cy)
    c, s = np.cos(rot), np.sin(rot)
    u = c * X + s * Y
    v = -s * X + c * Y
    th = np.arctan2(v / b, u / a)
    irr = 1.0
    for k in range(2, 7):
        irr = irr + r.uniform(0, amp_irreg / k ** 0.6) * np.sin(k * th + r.uniform(0, 6.283))
    d = ((np.abs(u) / a) ** p + (np.abs(v) / b) ** p) ** (1 / p) * irr
    # angular outline: 3..6 cut corners (half-planes) -> roughly dressed polygonal blocks
    for _k in range(r.integers(2, 6)):
        ang = r.uniform(0, 2 * np.pi)
        nu_, nv_ = np.cos(ang), np.sin(ang)
        off = r.uniform(0.87, 0.99)
        d = np.maximum(d, (u / a * nu_ + v / b * nv_) / off)
    # face relief: flattish dressed face + knapped facets (piecewise planes) + a slight bulge
    bul = r.uniform(0.3, 0.6)
    rel = bul * np.sqrt(np.clip(1 - np.minimum(d, 1) ** 4, 0, 1))
    fac = np.full(u.shape, -9.0)
    for _k in range(4):
        fa = r.uniform(-1, 1, 2) * 0.35
        fc = r.uniform(-0.1, 0.1)
        fac = np.maximum(fac, fa[0] * u / a + fa[1] * v / b + fc)
    rel = rel + 0.55 * np.minimum(fac, 0.25)
    iy = np.mod(gy, S)[:, None].repeat(len(gx), 1)
    ix = np.mod(gx, S)[None, :].repeat(len(gy), 0)
    cur = best[iy, ix]
    m = d < cur
    best[iy[m], ix[m]] = d[m]
    owner[iy[m], ix[m]] = i
    face[iy[m], ix[m]] = rel[m]


for i, st in enumerate(stones):
    raster(i, *st[:7])

stone_mask = best < 1.0
# chinking stones where the joint is wide: distance to the nearest stone (periodic)
dist = ndimage.distance_transform_edt(np.tile(~stone_mask, (3, 3)))[S:2 * S, S:2 * S] * PX
cand = np.argwhere(dist > 0.03)
rng.shuffle(cand)
nb = len(stones)
chinks = []
occupied = np.zeros((S, S), bool)
for (cy_, cx_) in cand[:6000]:
    if occupied[cy_, cx_]:
        continue
    rr = min(dist[cy_, cx_] * rng.uniform(1.0, 1.3), 0.12)
    if rr < 0.02:
        continue
    cxm, cym = cx_ * PX + PX / 2, cy_ * PX + PX / 2
    a = rr * rng.uniform(1.3, 2.2); b = rr * rng.uniform(0.55, 0.85)
    st = (cxm, cym, a, b, rng.uniform(-0.3, 0.3), rng.uniform(3.0, 4.5), rng.integers(1 << 30), 2)
    chinks.append(st)
    k = int(rr / PX) + 2
    ys = np.arange(cy_ - k, cy_ + k) % S; xs = np.arange(cx_ - k, cx_ + k) % S
    occupied[np.ix_(ys, xs)] = True
for j, st in enumerate(chinks):
    raster(nb + j, *st[:7], amp_irreg=0.14)
allst = stones + chinks
stone_mask = best < 1.0
print('stones', len(stones), 'chinking', len(chinks))

# ---------------------------------------------------------------------------------------------- height
n_fine = band(S, S, 60, 260, 3)
n_mid = band(S, S, 14, 60, 4)
n_pit = band(S, S, 120, 400, 5)
pits = np.clip((n_pit - 0.62) * 5, 0, 1) ** 1.5         # karstic pitting (the "pitted limestone" look)
edge = np.clip((1.0 - best) / 0.07, 0, 1)               # 0 at the stone edge -> 1 inside
edge_prof = np.sin(np.clip(edge, 0, 1) * np.pi / 2) ** 0.7
kind = np.array([s[7] for s in allst] + [3])
own_kind = kind[owner]
base = np.where(own_kind == 2, 0.42, 0.55)
h_st = base + 0.3 * face * edge_prof + 0.10 * edge_prof + 0.06 * (n_mid - 0.5) + 0.05 * (n_fine - 0.5) - 0.07 * pits
mortar = 0.16 + 0.06 * (n_mid - 0.5) + 0.05 * (n_fine - 0.5) - 0.06 * np.clip(1 - np.minimum(dist, 0.05) / 0.05, 0, 1) * 0
# mortar is deeper away from the stones (squeezed out near them)
mortar = mortar + 0.06 * np.exp(-dist / 0.012)
height = np.where(stone_mask, h_st, mortar)
height = ndimage.gaussian_filter(height, 0.8, mode='wrap')
height = np.clip(height, 0, 1)

# ---------------------------------------------------------------------------------------------- albedo
def c(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
pal = [c('#cfc6b2'), c('#c6bca8'), c('#d6ccb8'), c('#c2b294'), c('#b8ae9c'), c('#d0c2a2'), c('#aca290')]
prng = np.random.default_rng(77)
stone_col = np.array([pal[prng.integers(len(pal))] * prng.uniform(0.92, 1.04) for _ in range(len(allst))] + [np.zeros(3)])
alb = stone_col[owner]
# tonal variation within a stone, lichen blotches, dark pits, weathering toward the edges (dust in the joints)
var = band(S, S, 8, 40, 11)[..., None]
alb = alb * (0.86 + 0.24 * var) * (0.93 + 0.12 * n_fine[..., None])
lich = np.clip((band(S, S, 30, 120, 12) - 0.7) * 6, 0, 1)[..., None] * np.clip((band(S, S, 4, 16, 13) - 0.45) * 4, 0, 1)[..., None]
alb = alb * (1 - 0.45 * lich)
lich2 = np.clip((band(S, S, 40, 160, 14) - 0.78) * 8, 0, 1)[..., None]
alb = alb * (1 - lich2 * 0.3) + lich2 * 0.3 * c('#a08c62')
alb = alb * (1 - 0.35 * pits[..., None])
alb = alb * (0.78 + 0.22 * edge_prof[..., None])
# streaks of darker weathering running down the faces
streak = band(S, S, 20, 80, 15, aniso=(1.0, 0.08))[..., None]
alb = alb * (0.92 + 0.12 * streak)
mud = c('#6f5c47') * (0.82 + 0.3 * band(S, S, 20, 90, 16))[..., None]
grit = (band(S, S, 200, 500, 17) > 0.7)[..., None]
mud = np.where(grit, mud * 1.35, mud)
mud = mud * (0.7 + 0.3 * np.clip(dist / 0.03, 0, 1))[..., None]
alb = np.where(stone_mask[..., None], alb, mud)
alb = ndimage.gaussian_filter(alb, [0.6, 0.6, 0], mode='wrap')

# ---------------------------------------------------------------------------------------------- normal + AO
hm = height * 0.14  # metres of relief represented by the 0..1 height
gy, gx = np.gradient(np.pad(hm, 1, mode='wrap'))
gx = gx[1:-1, 1:-1] / PX; gy = gy[1:-1, 1:-1] / PX
nx = -gx; ny = gy; nz = np.ones_like(hm)
l = np.sqrt(nx * nx + ny * ny + nz * nz)
nrm = np.stack([nx / l, ny / l, nz / l], -1) * 0.5 + 0.5
ao = 1.0 - np.clip((ndimage.gaussian_filter(height, 6, mode='wrap') - height) * 3.2, 0, 0.7)
ao = ao * (0.75 + 0.25 * np.clip(dist / 0.02, 0, 1) * 0 + 0.25)
ao = np.clip(ao, 0, 1)


def save(name, rgba):
    img = Image.fromarray(np.clip(rgba * 255 + 0.5, 0, 255).astype(np.uint8), 'RGBA')
    p = os.path.join(OUT, name + '.webp')
    img.save(p, 'WEBP', quality=90, method=6)
    print('wrote', name, img.size, os.path.getsize(p) // 1024, 'KB')


save('fortstone_a', np.concatenate([alb, height[..., None]], -1))
save('fortstone_n', np.concatenate([nrm, ao[..., None]], -1))
