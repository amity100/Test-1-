"""Vectorised 3D noise for texture baking (gradient noise, fBm, ridged, cellular splats)."""
from __future__ import annotations

import numpy as np

_GRAD = np.array([
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1], [1, 1, 0], [-1, 1, 0], [0, -1, 1], [0, -1, -1],
], np.float32)


def _hash(ix, iy, iz, seed):
    h = (ix * np.int64(73856093)) ^ (iy * np.int64(19349663)) ^ (iz * np.int64(83492791)) ^ np.int64(seed * 2654435761 & 0x7FFFFFFF)
    h = (h ^ (h >> np.int64(13))) * np.int64(1274126177)
    h = h ^ (h >> np.int64(16))
    return h


def gnoise(p: np.ndarray, seed: int = 0) -> np.ndarray:
    """3D gradient (Perlin) noise, roughly in [-1, 1]. p: (N,3) float."""
    p = np.asarray(p, np.float64)
    pi = np.floor(p).astype(np.int64)
    f = (p - pi).astype(np.float32)
    u = f * f * f * (f * (f * 6 - 15) + 10)
    out = np.zeros(len(p), np.float32)
    for dx in (0, 1):
        wx = u[:, 0] if dx else 1 - u[:, 0]
        for dy in (0, 1):
            wy = u[:, 1] if dy else 1 - u[:, 1]
            for dz in (0, 1):
                wz = u[:, 2] if dz else 1 - u[:, 2]
                h = _hash(pi[:, 0] + dx, pi[:, 1] + dy, pi[:, 2] + dz, seed) & 15
                g = _GRAD[h]
                d = f - np.array([dx, dy, dz], np.float32)
                out += wx * wy * wz * np.sum(g * d, 1)
    return out * 1.1


def fbm(p, octaves=4, lac=2.03, gain=0.5, seed=0):
    s = np.zeros(len(p), np.float32)
    a = 1.0
    norm = 0.0
    q = np.asarray(p, np.float64)
    for o in range(octaves):
        s += a * gnoise(q, seed + o * 31)
        norm += a
        q = q * lac + 17.17
        a *= gain
    return s / norm


def ridged(p, octaves=3, seed=0):
    """1 at the ridges (noise zero crossings), for vein / crease networks."""
    s = np.zeros(len(p), np.float32)
    a = 1.0
    norm = 0.0
    q = np.asarray(p, np.float64)
    for o in range(octaves):
        s += a * (1 - np.abs(gnoise(q, seed + o * 13)))
        norm += a
        q = q * 2.1 + 5.3
        a *= 0.5
    return s / norm


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)
