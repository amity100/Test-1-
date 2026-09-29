"""Shared helpers for the DAVID world texture generator (all periodic -> seamless tiling).

Everything here is our own procedural code (numpy / scipy / Pillow); no third-party images.
"""
import math
import os

import numpy as np
from PIL import Image, ImageFilter
from scipy.spatial import cKDTree
from scipy import ndimage

F32 = np.float32


# ----------------------------------------------------------------------------- basic noise
def spectral(n, beta=2.0, seed=0, fmin=1.0, fmax=None, aspect=(1.0, 1.0), rot=0.0):
    """Tileable fractal noise via FFT filtering, normalised to 0..1.
    beta: spectral slope (2 = smooth / brownian, 1 = rougher). aspect stretches features (x, y)."""
    rng = np.random.default_rng(seed)
    white = rng.standard_normal((n, n)).astype(F32)
    f = np.fft.rfft2(white)
    fy = (np.fft.fftfreq(n)[:, None] * n).astype(F32)
    fx = (np.fft.rfftfreq(n)[None, :] * n).astype(F32)
    if rot:
        c, s = math.cos(rot), math.sin(rot)
        fx, fy = fx * c - fy * s, fx * s + fy * c
    fx = fx * aspect[0]
    fy = fy * aspect[1]
    r = np.sqrt(fx * fx + fy * fy)
    r[0, 0] = 1.0
    amp = 1.0 / np.power(r, beta / 2.0)
    amp[r < fmin] = 0.0
    if fmax is not None:
        amp *= np.exp(-np.power(r / fmax, 4.0))
    out = np.fft.irfft2(f * amp, s=(n, n)).astype(F32)
    out -= out.min()
    out /= out.max() + 1e-9
    return out


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def col(hexstr):
    hexstr = hexstr.lstrip('#')
    return np.array([int(hexstr[i:i + 2], 16) for i in (0, 2, 4)], dtype=F32) / 255.0


def srgb_to_lin(c):
    c = np.asarray(c, dtype=F32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(np.asarray(c, dtype=F32), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def lerp(a, b, t):
    t = np.asarray(t, dtype=F32)
    if t.ndim == 2:
        t = t[..., None]
    return a + (b - a) * t


def norm01(a):
    a = a - a.min()
    return a / (a.max() + 1e-9)


def grid(n):
    ys, xs = np.mgrid[0:n, 0:n].astype(F32)
    return (xs + 0.5) / n, (ys + 0.5) / n


# ----------------------------------------------------------------------------- periodic cells
def worley(n, pts, scale=(1.0, 1.0), warp=None, k=2):
    """Periodic Voronoi over the unit square (optionally anisotropic `scale`).
    pts: (m,2) in 0..1. Returns (dists[k], ids[k]) as (n,n) arrays in scaled units."""
    sx, sy = scale
    tree = cKDTree(np.mod(pts, 1.0) * np.array([sx, sy]), boxsize=[sx, sy])
    xs, ys = grid(n)
    if warp is not None:
        xs = xs + warp[0]
        ys = ys + warp[1]
    q = np.stack([np.mod(xs.ravel(), 1.0) * sx, np.mod(ys.ravel(), 1.0) * sy], axis=1)
    d, idx = tree.query(q, k=k, workers=2)
    if k == 1:
        d = d[:, None]
        idx = idx[:, None]
    return [d[:, i].reshape(n, n).astype(F32) for i in range(k)], [idx[:, i].reshape(n, n) for i in range(k)]


def cups(n, count, rmin, rmax, seed, density=None, power=1.0, warp=None, sharp=2.0):
    """Solution pits: periodic round depressions of varying radius (0..1 depth map, 1 = deepest).
    density: optional (n,n) 0..1 map; pits are kept with that probability at their centre."""
    rng = np.random.default_rng(seed)
    pts = rng.random((count, 2)).astype(F32)
    radii = (rmin + (rmax - rmin) * rng.random(count) ** power).astype(F32)
    if density is not None:
        ix = (pts[:, 0] * n).astype(int) % n
        iy = (pts[:, 1] * n).astype(int) % n
        keep = rng.random(count) < density[iy, ix]
        pts, radii = pts[keep], radii[keep]
    tree = cKDTree(pts, boxsize=[1.0, 1.0])
    xs, ys = grid(n)
    if warp is not None:
        xs = xs + warp[0]
        ys = ys + warp[1]
    q = np.stack([np.mod(xs.ravel(), 1.0), np.mod(ys.ravel(), 1.0)], axis=1)
    kk = min(6, len(pts))
    d, idx = tree.query(q, k=kk, workers=2)
    rel = d / radii[idx]
    t = np.clip(1.0 - rel, 0, 1)
    depth = np.max(t ** (1.0 / sharp) * np.minimum(1.0, radii[idx] / rmax * 1.6), axis=1)
    return depth.reshape(n, n).astype(F32)


# ----------------------------------------------------------------------------- filters (wrap)
def blur(a, sigma):
    return ndimage.gaussian_filter(a, sigma, mode='wrap').astype(F32)


def cavity(h, sigmas=(2, 6, 16), weights=(0.5, 0.3, 0.2)):
    """Concavity (ambient occlusion-ish): positive where the point lies below its neighbourhood."""
    c = np.zeros_like(h)
    for s, w in zip(sigmas, weights):
        c += w * (blur(h, s) - h)
    return c


def normal_map(h, strength=4.0):
    """h in 'texel' height units * strength. OpenGL convention (+Y up in tangent space)."""
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 0.5
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 0.5
    nx = -dx * strength
    ny = dy * strength
    nz = np.ones_like(h)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / ln, ny / ln, nz / ln], axis=-1) * 0.5 + 0.5


def dilate_rgb(rgb, alpha, iters=24):
    """Bleed opaque colours into transparent texels (avoids dark fringes when mip-mapping cut-outs)."""
    rgb = rgb.copy()
    known = alpha > 0.02
    acc = rgb * known[..., None]
    w = known.astype(F32)
    out = rgb.copy()
    filled = known.copy()
    for _ in range(iters):
        acc_b = ndimage.uniform_filter(acc, size=(3, 3, 1), mode='wrap')
        w_b = ndimage.uniform_filter(w, size=3, mode='wrap')
        newly = (~filled) & (w_b > 1e-4)
        out[newly] = acc_b[newly] / w_b[newly, None]
        filled |= newly
        acc = out * filled[..., None]
        w = filled.astype(F32)
        if filled.all():
            break
    if not filled.all():
        mean = rgb[known].mean(axis=0) if known.any() else np.array([0.5, 0.5, 0.5], F32)
        out[~filled] = mean
    return out


# ----------------------------------------------------------------------------- output
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'world')


def save_webp(arr, name, q=88, alpha=None, lossless=False, out=None):
    """arr: (n,n,3) floats 0..1 (sRGB encoded values), optional alpha (n,n) 0..1."""
    out = out or OUT
    os.makedirs(out, exist_ok=True)
    rgb = (np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)
    if alpha is not None:
        a = (np.clip(alpha, 0, 1) * 255 + 0.5).astype(np.uint8)
        img = Image.fromarray(np.dstack([rgb, a]), 'RGBA')
    else:
        img = Image.fromarray(rgb, 'RGB')
    path = os.path.join(out, name)
    img.save(path, 'WEBP', quality=q, method=6, lossless=lossless, exact=alpha is not None)
    print('wrote %-28s %7.1f KB' % (name, os.path.getsize(path) / 1024))
    return path


def preview_tiled(arr, path, reps=2, size=None):
    rgb = (np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)
    t = np.tile(rgb, (reps, reps, 1))
    img = Image.fromarray(t, 'RGB')
    if size:
        img = img.resize((size, size), Image.LANCZOS)
    img.save(path, quality=90)
    return path


def shade_preview(albedo, nrm01, path, light=(0.55, 0.45, 0.7), reps=2, size=None, ambient=0.35):
    """Quick lambert preview of albedo+normal for inspecting a material under a low sun."""
    n = nrm01 * 2 - 1
    L = np.array(light, dtype=F32)
    L /= np.linalg.norm(L)
    ndl = np.clip((n * L).sum(-1), 0, 1)
    lin = srgb_to_lin(albedo) * (ambient + 1.6 * ndl[..., None])
    return preview_tiled(lin_to_srgb(lin / 1.25), path, reps, size)
