"""Tiny numpy/Pillow software rasterizer for quick offline previews of meshes (no GPU needed)."""
from __future__ import annotations

import numpy as np
from PIL import Image


def render(v: np.ndarray, tris: np.ndarray, normals: np.ndarray | None = None, colors: np.ndarray | None = None,
           view: str = "front", size=(600, 900), bbox=None, light=(0.4, 0.5, 0.75)) -> Image.Image:
    """Orthographic render. view: front (+Z toward camera), back, left (+X toward camera), right."""
    v = np.asarray(v, float)
    if view == "front":
        p = np.stack([v[:, 0], v[:, 1], v[:, 2]], 1)
    elif view == "back":
        p = np.stack([-v[:, 0], v[:, 1], -v[:, 2]], 1)
    elif view == "left":  # character's left side (+X) toward the camera
        p = np.stack([-v[:, 2], v[:, 1], v[:, 0]], 1)
    elif view == "right":
        p = np.stack([v[:, 2], v[:, 1], -v[:, 0]], 1)
    else:
        raise ValueError(view)
    if normals is None:
        a, b, c = v[tris[:, 0]], v[tris[:, 1]], v[tris[:, 2]]
        fn = np.cross(b - a, c - a)
        normals = np.zeros_like(v)
        for k in range(3):
            np.add.at(normals, tris[:, k], fn)
        normals /= np.linalg.norm(normals, axis=1, keepdims=True) + 1e-12
    n = normals
    if view == "front":
        nv = n
    elif view == "back":
        nv = np.stack([-n[:, 0], n[:, 1], -n[:, 2]], 1)
    elif view == "left":
        nv = np.stack([-n[:, 2], n[:, 1], n[:, 0]], 1)
    else:
        nv = np.stack([n[:, 2], n[:, 1], -n[:, 0]], 1)
    L = np.asarray(light, float)
    L /= np.linalg.norm(L)
    shade = np.clip(nv @ L, 0, 1) * 0.8 + 0.2
    W, H = size
    if bbox is None:
        lo, hi = p[:, :2].min(0), p[:, :2].max(0)
    else:
        lo, hi = np.asarray(bbox[0], float), np.asarray(bbox[1], float)
    scale = min((W - 20) / (hi[0] - lo[0]), (H - 20) / (hi[1] - lo[1]))
    cx = (lo[0] + hi[0]) / 2
    cy = (lo[1] + hi[1]) / 2
    sx = (p[:, 0] - cx) * scale + W / 2
    sy = H / 2 - (p[:, 1] - cy) * scale
    sz = p[:, 2]
    zbuf = np.full((H, W), -1e9)
    img = np.zeros((H, W, 3))
    img[:] = (0.12, 0.13, 0.15)
    col = np.ones((len(v), 3)) * np.array([0.85, 0.72, 0.62]) if colors is None else colors
    for t in tris:
        xs, ys = sx[t], sy[t]
        x0, x1 = int(max(0, np.floor(xs.min()))), int(min(W - 1, np.ceil(xs.max())))
        y0, y1 = int(max(0, np.floor(ys.min()))), int(min(H - 1, np.ceil(ys.max())))
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, bx, cx_), (ay, by, cy_) = xs, ys
        den = (by - cy_) * (ax - cx_) + (cx_ - bx) * (ay - cy_)
        if abs(den) < 1e-12:
            continue
        w0 = ((by - cy_) * (gx - cx_) + (cx_ - bx) * (gy - cy_)) / den
        w1 = ((cy_ - ay) * (gx - cx_) + (ax - cx_) * (gy - cy_)) / den
        w2 = 1 - w0 - w1
        m = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not m.any():
            continue
        z = w0 * sz[t[0]] + w1 * sz[t[1]] + w2 * sz[t[2]]
        sub = zbuf[y0:y1 + 1, x0:x1 + 1]
        upd = m & (z > sub)
        if not upd.any():
            continue
        sub[upd] = z[upd]
        s = (w0 * shade[t[0]] + w1 * shade[t[1]] + w2 * shade[t[2]])[upd]
        c = (w0[..., None] * col[t[0]] + w1[..., None] * col[t[1]] + w2[..., None] * col[t[2]])[upd]
        img[y0:y1 + 1, x0:x1 + 1][upd] = c * s[:, None]
    return Image.fromarray((np.clip(img, 0, 1) ** (1 / 1.4) * 255).astype(np.uint8))


def quads_to_tris(q: np.ndarray) -> np.ndarray:
    return np.concatenate([q[:, [0, 1, 2]], q[:, [0, 2, 3]]], 0)
