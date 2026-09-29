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


def pv(albedo, nrm, name):
    if PREVIEW:
        os.makedirs(PREVIEW, exist_ok=True)
        shade_preview(albedo, nrm, os.path.join(PREVIEW, name + '_lit.jpg'), reps=2, size=1024)
        preview_tiled(albedo, os.path.join(PREVIEW, name + '_albedo.jpg'), reps=2, size=1024)


def save_pair(name, albedo, h, nrm_strength, ao, alpha_a=None, q=86):
    """albedo (n,n,3) sRGB; h height 0..1 (goes to albedo alpha unless alpha_a given); ao 0..1 -> normal alpha."""
    nrm = normal_map(h * nrm_strength, 1.0)
    save_webp(albedo, name + '_a.webp', q=q, alpha=h if alpha_a is None else alpha_a)
    save_webp(nrm, name + '_n.webp', q=90, alpha=ao)
    pv(albedo, nrm, name)
    return nrm


# ============================================================================= limestone
def limestone(n=SIZE):
    """Weathered Judean limestone: cream-grey crust, heavily pitted by solution (dark holes of many sizes),
    knobbly dissolution relief, fine grain, hairline cracks, dark crustose + orange lichen.
    Tile ~2.4 m in world space."""
    s = n / 1024.0
    wx = (spectral(n, 2.0, 141, fmin=2) - 0.5) * 0.05
    wy = (spectral(n, 2.0, 142, fmin=2) - 0.5) * 0.05
    base = spectral(n, 2.3, 11, fmin=1)
    mid = spectral(n, 1.7, 12, fmin=5)
    knob = spectral(n, 1.2, 13, fmin=18, fmax=140 * s)
    fine = spectral(n, 0.8, 14, fmin=60)
    # where the rock is heavily pitted vs smoother crust
    pitty = smooth(0.25, 0.75, spectral(n, 2.0, 15, fmin=2))
    p_big = cups(n, 70, 0.018, 0.05, 16, density=0.35 + 0.65 * pitty, power=2.0, warp=(wx, wy), sharp=1.6)
    p_mid = cups(n, 900, 0.006, 0.02, 17, density=0.15 + 0.85 * pitty, power=1.5, warp=(wx, wy), sharp=1.8)
    p_small = cups(n, 5200, 0.0025, 0.007, 18, density=0.25 + 0.75 * pitty, power=1.2, warp=(wx * 0.5, wy * 0.5), sharp=2.2)
    # hairline cracks along a few joint directions
    rng = np.random.default_rng(19)
    (f1, f2), _ = worley(n, rng.random((22, 2)), warp=(wx * 2, wy * 2))
    crack = (1.0 - smooth(0.0, 0.0028, f2 - f1)) * smooth(0.45, 0.7, spectral(n, 2.0, 20, fmin=2))
    # karren: faint dissolution flutes
    karren = spectral(n, 2.0, 21, fmin=3, aspect=(0.3, 1.8), rot=0.4)

    h = (0.42 * base + 0.2 * mid + 0.16 * knob + 0.05 * fine + 0.08 * karren
         - 0.34 * p_big - 0.22 * p_mid - 0.12 * p_small - 0.1 * crack)
    h = norm01(h)
    cav = cavity(h, sigmas=(1.5 * s, 5 * s, 14 * s), weights=(0.45, 0.35, 0.2))
    cav = np.clip(cav * 9.0, -1, 1)
    ao = np.clip(1.0 - np.maximum(cav, 0) * 1.35 - p_big * 0.35 - p_mid * 0.25, 0.25, 1.0)

    # --- colour: warm cream-grey crust, cooler grey weathered areas, dirt in pits
    c_crust = col('#d5cfc0')
    c_warm = col('#d9ccb2')
    c_grey = col('#a9a498')
    c_dark = col('#7d776c')
    c_pit = col('#4f463c')
    c_dirt = col('#6f5a44')
    albedo = lerp(c_grey, c_crust, smooth(0.25, 0.75, 0.6 * base + 0.4 * mid))
    albedo = lerp(albedo, c_warm, smooth(0.55, 0.85, spectral(n, 2.2, 22, fmin=2)) * 0.6)
    albedo = lerp(albedo, c_dark, smooth(0.55, 0.95, 1 - mid) * 0.28)
    albedo *= (0.9 + 0.2 * knob)[..., None]
    albedo *= (0.94 + 0.12 * fine)[..., None]
    pit = np.clip(p_big * 1.1 + p_mid * 0.95 + p_small * 0.8, 0, 1)
    albedo = lerp(albedo, c_dirt, smooth(0.15, 0.6, pit) * 0.55)
    albedo = lerp(albedo, c_pit, smooth(0.45, 0.95, pit) * 0.75)
    albedo = lerp(albedo, c_pit, crack * 0.6)
    albedo *= (1.0 - np.maximum(cav, 0) * 0.55)[..., None]
    albedo *= (1.0 + np.maximum(-cav, 0) * 0.25)[..., None]  # sun-bleached knobs
    # lichen: dark grey-black crustose patches and small orange Xanthoria rosettes on the crust
    lich = spectral(n, 1.7, 23, fmin=5)
    lichen_mask = smooth(0.66, 0.74, lich) * smooth(0.25, 0.6, fine + knob * 0.5) * (1 - pit)
    albedo = lerp(albedo, col('#4d4d45'), lichen_mask * 0.75)
    lich2 = smooth(0.7, 0.76, spectral(n, 1.6, 24, fmin=8)) * (1 - pit)
    albedo = lerp(albedo, col('#8f9483'), lich2 * 0.45)
    (o1,), _ = worley(n, np.random.default_rng(25).random((2600, 2)), k=1)
    orange = (1 - smooth(0.0, 0.0045, o1)) * smooth(0.6, 0.72, spectral(n, 2.0, 26, fmin=3)) * (1 - pit)
    albedo = lerp(albedo, col('#c2843a'), orange * 0.85)
    return save_pair("limestone", np.clip(albedo, 0, 1), h, 38.0 * s, ao)


# ============================================================================= main
TEXTURES = {
    'limestone': limestone,
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
