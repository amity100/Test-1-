"""Procedural, tileable texture generator for DAVID.

Run:  python3 tools/gen_textures.py   (from the david/ folder)
Needs: numpy, pillow, scipy

Every texture is generated from periodic (FFT / periodic-Voronoi) noise so it
tiles seamlessly. Albedo + normal maps are written to src/assets/textures/.
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.spatial import cKDTree

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'textures')
os.makedirs(OUT, exist_ok=True)


# ----------------------------------------------------------------------------- noise helpers
def spectral(n, beta=2.0, seed=0, fmin=1.0, fmax=None, aspect=(1.0, 1.0)):
    """Tileable fractal noise via FFT filtering. aspect stretches features (x, y)."""
    rng = np.random.default_rng(seed)
    white = rng.standard_normal((n, n))
    f = np.fft.fft2(white)
    fy = np.fft.fftfreq(n)[:, None] * n * aspect[1]
    fx = np.fft.fftfreq(n)[None, :] * n * aspect[0]
    r = np.sqrt(fx * fx + fy * fy)
    r[0, 0] = 1.0
    amp = 1.0 / np.power(r, beta / 2.0)
    amp[r < fmin] = 0.0
    if fmax is not None:
        amp *= np.exp(-np.power(r / fmax, 4.0))
    out = np.real(np.fft.ifft2(f * amp))
    out -= out.min()
    out /= out.max() + 1e-9
    return out


def worley(n, count, seed=0, scale=(1.0, 1.0), jitter_rows=None, warp=None):
    """Periodic Voronoi. Returns F1, F2 (in 0..1 texture units) and nearest cell id.
    warp: optional (dx, dy) arrays (n x n) offsetting the lookup coordinates."""
    rng = np.random.default_rng(seed)
    if jitter_rows is None:
        pts = rng.random((count, 2))
    else:
        pts = jitter_rows(rng)
    sx, sy = scale
    pts_s = pts * np.array([sx, sy])
    tree = cKDTree(pts_s, boxsize=[sx, sy])
    ys, xs = np.mgrid[0:n, 0:n] / n
    if warp is not None:
        xs = xs + warp[0]
        ys = ys + warp[1]
    q = np.stack([xs.ravel() * sx, ys.ravel() * sy], axis=1)
    q = np.mod(q, [sx, sy])
    d, idx = tree.query(q, k=2)
    f1 = d[:, 0].reshape(n, n)
    f2 = d[:, 1].reshape(n, n)
    cid = idx[:, 0].reshape(n, n)
    return f1, f2, cid


def normal_map(h, strength=4.0):
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 0.5
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 0.5
    nx = -dx * strength
    ny = dy * strength  # OpenGL convention (+Y up in tangent space)
    nz = np.ones_like(h)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.stack([nx / ln, ny / ln, nz / ln], axis=-1) * 0.5 + 0.5
    return (rgb * 255).clip(0, 255).astype(np.uint8)


def lerp(a, b, t):
    t = np.asarray(t)[..., None] if np.ndim(t) == 2 else t
    return a + (b - a) * t


def col(hexstr):
    hexstr = hexstr.lstrip('#')
    return np.array([int(hexstr[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64) / 255.0


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def save_rgb(arr, name, q=88):
    img = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), 'RGB')
    img.save(os.path.join(OUT, name), quality=q, optimize=True)
    print('wrote', name)


def save_normal(nrm, name, q=90):
    Image.fromarray(nrm, 'RGB').save(os.path.join(OUT, name), quality=q, optimize=True)
    print('wrote', name)


def blur(a, radius):
    img = Image.fromarray((np.clip(a, 0, 1) * 65535).astype(np.uint16).astype(np.int32), 'I')
    # wrap-around blur: tile 3x3, blur, crop
    n = a.shape[0]
    big = np.tile(a, (3, 3))
    im = Image.fromarray((big * 255).clip(0, 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(im, dtype=np.float64)[n:2 * n, n:2 * n] / 255.0


# ----------------------------------------------------------------------------- limestone
def limestone(n=1024):
    base = spectral(n, 2.2, 11, fmin=1)
    mid = spectral(n, 1.6, 12, fmin=4)
    fine = spectral(n, 1.0, 13, fmin=40)
    wx = (spectral(n, 2.0, 141, fmin=2) - 0.5) * 0.09
    wy = (spectral(n, 2.0, 142, fmin=2) - 0.5) * 0.09
    f1, f2, _ = worley(n, 260, 14, warp=(wx, wy))
    rngp = np.random.default_rng(143)
    pits = (1.0 - smooth(0.0, 0.012, f1)) * 0.8     # small solution pits
    g1, g2, _ = worley(n, 28, 15, warp=(wx * 1.6, wy * 1.6))
    cracks = (1.0 - smooth(0.0, 0.0035, g2 - g1)) * smooth(0.35, 0.6, spectral(n, 2.0, 144, fmin=2))
    karren = spectral(n, 2.0, 16, fmin=3, aspect=(0.35, 1.6))  # fluting grooves

    h = 0.55 * base + 0.25 * mid + 0.08 * fine + 0.12 * karren - 0.22 * pits - 0.18 * cracks
    h = (h - h.min()) / (h.max() - h.min())

    c_light = col('#d8d0bd')
    c_mid = col('#bdb29c')
    c_dark = col('#8f8676')
    c_pit = col('#5d564b')
    t = smooth(0.25, 0.8, 0.6 * base + 0.4 * mid)
    albedo = lerp(c_mid, c_light, t)
    albedo = lerp(albedo, c_dark, smooth(0.45, 0.9, 1 - mid) * 0.35)
    albedo = lerp(albedo, c_pit, np.clip(pits * 0.8 + cracks * 0.7, 0, 1))
    # lichen: dark grey-green crusts + small orange (Xanthoria-like) spots
    lich = spectral(n, 1.8, 17, fmin=6)
    lmask = smooth(0.66, 0.72, lich) * smooth(0.3, 0.6, fine + 0.3)
    albedo = lerp(albedo, col('#5f6154'), lmask * 0.7)
    o1, _, _ = worley(n, 900, 18)
    orange = (1 - smooth(0.0, 0.006, o1)) * smooth(0.55, 0.7, spectral(n, 2.0, 19, fmin=3))
    albedo = lerp(albedo, col('#b87a3c'), orange * 0.8)
    albedo *= (0.92 + 0.16 * fine)[..., None]
    save_rgb(albedo, 'rock_albedo.jpg')
    save_normal(normal_map(h, 9.0), 'rock_normal.jpg')


# ----------------------------------------------------------------------------- dry grass ground
def dry_grass(n=1024):
    rng = np.random.default_rng(21)
    soil = spectral(n, 2.0, 22, fmin=2)
    base = lerp(col('#7a5a3c'), col('#9c7a52'), soil)
    img = Image.fromarray((base * 255).astype(np.uint8), 'RGB')
    hmap = Image.new('L', (n, n), 40)
    d = ImageDraw.Draw(img)
    dh = ImageDraw.Draw(hmap)
    straw = [col('#c9a55a'), col('#dcc283'), col('#b08a48'), col('#e3cf98'), col('#9e7c45'), col('#8b8a4e')]
    # direction field so strands clump in natural "lodged" swirls
    dirf = spectral(n // 8, 2.4, 23, fmin=1) * math.tau * 1.5
    for i in range(26000):
        x, y = rng.random() * n, rng.random() * n
        a = dirf[int(y) // 8 % (n // 8), int(x) // 8 % (n // 8)] + rng.normal(0, 0.5)
        L = rng.uniform(10, 34)
        c = straw[rng.integers(len(straw))] * rng.uniform(0.8, 1.1)
        cc = tuple((np.clip(c, 0, 1) * 255).astype(int))
        w = 1 if rng.random() < 0.8 else 2
        hv = int(rng.uniform(120, 255))
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                x0, y0 = x + ox, y + oy
                x1, y1 = x0 + math.cos(a) * L, y0 + math.sin(a) * L
                if -40 < min(x0, x1) < n + 40 and -40 < min(y0, y1) < n + 40:
                    d.line([(x0, y0), (x1, y1)], fill=cc, width=w)
                    dh.line([(x0, y0), (x1, y1)], fill=hv, width=w)
    # small pebbles
    f1, _, _ = worley(n, 700, 24)
    peb = 1 - smooth(0.0, 0.0045, f1)
    arr = np.asarray(img, dtype=np.float64) / 255.0
    arr = lerp(arr, col('#cfc6b2'), peb * 0.9)
    h = np.asarray(hmap, dtype=np.float64) / 255.0
    h = blur(h, 0.8) * 0.8 + peb * 0.5
    arr *= (0.9 + 0.2 * spectral(n, 1.2, 25, fmin=20))[..., None]
    save_rgb(arr, 'grass_albedo.jpg')
    save_normal(normal_map(h, 5.0), 'grass_normal.jpg')


# ----------------------------------------------------------------------------- terra rossa soil
def terra_rossa(n=1024):
    c1 = spectral(n, 2.1, 31, fmin=2)
    c2 = spectral(n, 1.4, 32, fmin=16)
    albedo = lerp(col('#744632'), col('#9a6446'), c1)
    albedo = lerp(albedo, col('#6b3a26'), smooth(0.6, 0.9, c2) * 0.5)
    f1, f2, cid = worley(n, 1600, 33)
    rng = np.random.default_rng(34)
    keep = rng.random(1600) < 0.28
    size = rng.uniform(0.004, 0.011, 1600)
    stone = (f1 < size[cid]) & keep[cid]
    bulge = np.where(stone, 1 - (f1 / size[cid]) ** 2, 0)
    shade = rng.uniform(0.75, 1.05, 1600)[cid]
    stone_col = lerp(col('#b9ae98'), col('#ddd5c3'), rng.random(1600)[cid])
    albedo = np.where(stone[..., None], stone_col * shade[..., None], albedo)
    # thin shadow ring around pebbles
    ring = (f1 < size[cid] * 1.35) & ~stone & keep[cid]
    albedo = np.where(ring[..., None], albedo * 0.7, albedo)
    h = 0.35 * c1 + 0.2 * c2 + 0.9 * bulge
    save_rgb(albedo, 'soil_albedo.jpg')
    save_normal(normal_map(h, 6.0), 'soil_normal.jpg')


# ----------------------------------------------------------------------------- dry-stone terrace wall
def stone_wall(n=1024):
    rng = np.random.default_rng(41)
    rows = 9

    def jitter(r):
        pts = []
        for i in range(rows):
            y = (i + 0.5) / rows
            x = r.random()
            start = x
            while x < start + 1.0 - 0.05:
                pts.append((x % 1.0, (y + r.normal(0, 0.01)) % 1.0))
                x += r.uniform(0.06, 0.15)
        return np.array(pts)

    f1, f2, cid = worley(n, 0, 42, scale=(1.0, 1.9), jitter_rows=jitter)
    ncell = cid.max() + 1
    edge = f2 - f1
    gap = 1 - smooth(0.004, 0.016, edge)
    bulge = smooth(0.0, 0.07, edge)
    tone = rng.uniform(0.0, 1.0, ncell)[cid]
    albedo = lerp(col('#a89c86'), col('#d6ccb6'), tone)
    albedo = lerp(albedo, col('#8a7f6c'), smooth(0.5, 0.9, spectral(n, 1.8, 43, fmin=6)) * 0.5)
    fine = spectral(n, 1.1, 44, fmin=30)
    albedo *= (0.85 + 0.25 * fine)[..., None]
    lich = smooth(0.62, 0.7, spectral(n, 1.9, 45, fmin=5)) * bulge
    albedo = lerp(albedo, col('#62624f'), lich * 0.6)
    albedo = lerp(albedo, col('#2b241d'), gap)
    h = bulge * 0.8 + fine * 0.15 - gap * 0.5
    save_rgb(albedo, 'wall_albedo.jpg')
    save_normal(normal_map(h, 7.0), 'wall_normal.jpg')


# ----------------------------------------------------------------------------- linen / wool weave
def linen(n=512):
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float64)
    period = 8.0
    slub_x = spectral(n, 2.0, 51, fmin=1, aspect=(1.0, 0.08))
    slub_y = spectral(n, 2.0, 52, fmin=1, aspect=(0.08, 1.0))
    wx = xs / period * math.tau + slub_x * 2.0
    wy = ys / period * math.tau + slub_y * 2.0
    warp = 0.5 + 0.5 * np.cos(wx)          # vertical threads profile
    weft = 0.5 + 0.5 * np.cos(wy)
    over = (np.floor(xs / period) + np.floor(ys / period)) % 2
    h = np.where(over > 0, warp * 0.8 + weft * 0.2, weft * 0.8 + warp * 0.2)
    h *= 0.85 + 0.3 * spectral(n, 1.0, 53, fmin=40)
    thick = spectral(n, 1.5, 54, fmin=3)
    albedo = lerp(col('#cdbd9a'), col('#e4d8bb'), smooth(0.2, 0.9, h * 0.7 + thick * 0.3))
    dirt = smooth(0.55, 0.95, spectral(n, 2.2, 55, fmin=1))
    albedo = lerp(albedo, col('#9c876a'), dirt * 0.35)
    albedo *= (0.82 + 0.22 * h)[..., None]
    save_rgb(albedo, 'linen_albedo.jpg')
    save_normal(normal_map(h, 3.0), 'linen_normal.jpg')


# ----------------------------------------------------------------------------- leather
def leather(n=512):
    f1, f2, _ = worley(n, 2600, 61)
    grain = smooth(0.0, 0.01, f2 - f1)
    big = spectral(n, 2.0, 62, fmin=2)
    scratches = spectral(n, 2.0, 63, fmin=4, aspect=(0.1, 2.0))
    albedo = lerp(col('#4f3019'), col('#7a4d2a'), big)
    albedo = lerp(albedo, col('#9a6a3f'), smooth(0.75, 0.9, scratches) * 0.5)
    albedo *= (0.85 + 0.18 * grain)[..., None]
    h = grain * 0.6 + big * 0.3 - smooth(0.8, 0.92, scratches) * 0.3
    save_rgb(albedo, 'leather_albedo.jpg')
    save_normal(normal_map(h, 4.0), 'leather_normal.jpg')


# ----------------------------------------------------------------------------- olive bark
def bark(n=512):
    fis = 1.0 - np.abs(spectral(n, 2.0, 71, fmin=3, aspect=(1.0, 7.0)) * 2 - 1)
    fis2 = 1.0 - np.abs(spectral(n, 1.8, 75, fmin=6, aspect=(1.0, 5.0)) * 2 - 1)
    fine = spectral(n, 1.2, 72, fmin=20, aspect=(1.0, 3.0))
    h = 0.55 * (1 - fis ** 3) + 0.3 * (1 - fis2 ** 4) + 0.2 * fine
    h = (h - h.min()) / (h.max() - h.min())
    albedo = lerp(col('#3b342c'), col('#8a8173'), smooth(0.2, 0.85, h))
    lich = smooth(0.64, 0.72, spectral(n, 1.8, 74, fmin=5))
    albedo = lerp(albedo, col('#8f9479'), lich * 0.55)
    save_rgb(albedo, 'bark_albedo.jpg')
    save_normal(normal_map(h, 6.0), 'bark_normal.jpg')


# ----------------------------------------------------------------------------- foliage cards
def foliage(name, n=1024, seed=0, leaf_len=(26, 44), leaf_w=0.16, top=('#56613a', '#6b7648'),
            under=('#a4ad92', '#8e9a7c'), count=900, twig='#5a4a3a', radius=0.46, round_leaf=False):
    rng = np.random.default_rng(seed)
    S = 2  # supersample
    N = n * S
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = N / 2
    # twigs radiating from centre
    tips = []
    for i in range(34):
        a = rng.uniform(0, math.tau)
        r = rng.uniform(0.3, radius) * N
        pts = [(cx, cy)]
        x, y = cx, cy
        for k in range(1, 7):
            t = k / 6
            x = cx + math.cos(a + math.sin(t * 3 + i) * 0.25) * r * t
            y = cy + math.sin(a + math.sin(t * 3 + i) * 0.25) * r * t
            pts.append((x, y))
        d.line(pts, fill=tuple(int(c * 255) for c in col(twig)) + (255,), width=int(3 * S))
        tips.append(pts)
    tc = [col(c) for c in top]
    uc = [col(c) for c in under]
    for i in range(count):
        tw = tips[rng.integers(len(tips))]
        p = tw[rng.integers(1, len(tw))]
        a = rng.uniform(0, math.tau)
        L = rng.uniform(*leaf_len) * S
        W = L * (leaf_w if not round_leaf else leaf_w * 2.2)
        # base of leaf near the twig point
        bx = p[0] + rng.normal(0, 26 * S)
        by = p[1] + rng.normal(0, 26 * S)
        if math.hypot(bx - cx, by - cy) > radius * N:
            continue
        ca, sa = math.cos(a), math.sin(a)
        poly = []
        steps = 10
        for s in range(steps + 1):
            t = s / steps
            w = math.sin(math.pi * t) ** (0.8 if round_leaf else 1.2) * W / 2
            poly.append((bx + ca * L * t - sa * w, by + sa * L * t + ca * w))
        for s in range(steps, -1, -1):
            t = s / steps
            w = math.sin(math.pi * t) ** (0.8 if round_leaf else 1.2) * W / 2
            poly.append((bx + ca * L * t + sa * w, by + sa * L * t - ca * w))
        is_under = rng.random() < 0.3
        base = (uc if is_under else tc)[rng.integers(2)] * rng.uniform(0.8, 1.15)
        # lighter towards cluster edge (sun-lit outer leaves)
        edge = math.hypot(bx - cx, by - cy) / (radius * N)
        base = base * (0.85 + 0.3 * edge)
        c = tuple(int(v) for v in np.clip(base * 255, 0, 255)) + (255,)
        d.polygon(poly, fill=c)
        # midrib
        d.line([(bx, by), (bx + ca * L * 0.9, by + sa * L * 0.9)],
               fill=tuple(int(v) for v in np.clip(base * 255 * 1.18, 0, 255)) + (255,), width=max(1, S))
    img = img.resize((n, n), Image.LANCZOS)
    img.save(os.path.join(OUT, name), 'WEBP', quality=90, method=6)
    print('wrote', name)


def shrub_card(name='shrub_leaves.webp', n=512, seed=91):
    """Thorny burnet (Sarcopoterium spinosum) — dense grey-green dwarf shrub with thorny twigs."""
    rng = np.random.default_rng(seed)
    S = 2
    N = n * S
    img = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = N / 2
    for i in range(260):
        a = rng.uniform(0, math.tau)
        r = rng.uniform(0.1, 0.47) * N
        x0, y0 = cx + math.cos(a) * r * 0.2, cy + math.sin(a) * r * 0.2
        x1, y1 = cx + math.cos(a) * r, cy + math.sin(a) * r
        d.line([(x0, y0), (x1, y1)], fill=(96, 78, 60, 255), width=2 * S)
        # thorny side branches
        for k in range(3):
            t = rng.uniform(0.3, 1.0)
            bx, by = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            b = a + rng.choice([-1, 1]) * rng.uniform(0.6, 1.1)
            L = rng.uniform(8, 20) * S
            d.line([(bx, by), (bx + math.cos(b) * L, by + math.sin(b) * L)], fill=(120, 96, 70, 255), width=S)
    greens = [col('#7f8a67'), col('#95a07c'), col('#6e7a58'), col('#a39a6a')]
    for i in range(2600):
        a = rng.uniform(0, math.tau)
        r = math.sqrt(rng.random()) * 0.47 * N
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        s = rng.uniform(2.5, 5.5) * S
        c = greens[rng.integers(len(greens))] * rng.uniform(0.8, 1.2) * (0.85 + 0.3 * r / (0.47 * N))
        d.ellipse([x - s, y - s * 0.7, x + s, y + s * 0.7], fill=tuple(int(v) for v in np.clip(c * 255, 0, 255)) + (255,))
    img = img.resize((n, n), Image.LANCZOS)
    img.save(os.path.join(OUT, name), 'WEBP', quality=90, method=6)
    print('wrote', name)


if __name__ == '__main__':
    limestone()
    dry_grass()
    terra_rossa()
    stone_wall()
    linen()
    leather()
    bark()
    foliage('olive_leaves.webp', seed=81, leaf_len=(24, 40), leaf_w=0.17,
            top=('#58633c', '#66704a'), under=('#aab29a', '#98a386'), count=5200)
    foliage('oak_leaves.webp', seed=82, leaf_len=(18, 30), leaf_w=0.3,
            top=('#3e4a27', '#4d5a30'), under=('#6d7a4f', '#5f6b43'), count=4200, round_leaf=True)
    shrub_card()
