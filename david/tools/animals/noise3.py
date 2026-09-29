"""Vectorised 3D noise helpers (numpy) for texture baking: value noise, fbm, Worley F1/F2."""
from __future__ import annotations

import numpy as np


def _hash3(ix, iy, iz, seed=0):
    h = (ix.astype(np.int64) * 73856093) ^ (iy.astype(np.int64) * 19349663) ^ (iz.astype(np.int64) * 83492791) ^ (seed * 2654435761)
    h = (h ^ (h >> 13)) * 1274126177
    h = h ^ (h >> 16)
    return (h & 0xFFFFFF).astype(np.float64) / float(0xFFFFFF)


def vnoise(P, seed=0):
    """smooth value noise in [0,1] at points P (N,3) (cell size 1)."""
    P = np.asarray(P, dtype=np.float64)
    i = np.floor(P).astype(np.int64)
    f = P - i
    u = f * f * (3 - 2 * f)
    x, y, z = i[:, 0], i[:, 1], i[:, 2]
    ux, uy, uz = u[:, 0], u[:, 1], u[:, 2]

    def c(dx, dy, dz):
        return _hash3(x + dx, y + dy, z + dz, seed)

    x00 = c(0, 0, 0) * (1 - ux) + c(1, 0, 0) * ux
    x10 = c(0, 1, 0) * (1 - ux) + c(1, 1, 0) * ux
    x01 = c(0, 0, 1) * (1 - ux) + c(1, 0, 1) * ux
    x11 = c(0, 1, 1) * (1 - ux) + c(1, 1, 1) * ux
    y0 = x00 * (1 - uy) + x10 * uy
    y1 = x01 * (1 - uy) + x11 * uy
    return y0 * (1 - uz) + y1 * uz


def fbm(P, octaves=4, seed=0, lac=2.03, gain=0.5):
    s = np.zeros(len(P))
    a = 0.5
    tot = 0.0
    Q = np.asarray(P, dtype=np.float64)
    for o in range(octaves):
        s += a * vnoise(Q, seed + o * 17)
        tot += a
        Q = Q * lac + 17.17
        a *= gain
    return s / tot


def worley(P, seed=0, jitter=0.9):
    """Worley F1, F2 distances and the id of the nearest feature point (cell size 1)."""
    P = np.asarray(P, dtype=np.float64)
    i = np.floor(P).astype(np.int64)
    f1 = np.full(len(P), 9.0)
    f2 = np.full(len(P), 9.0)
    idn = np.zeros(len(P))
    for dz in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                cx, cy, cz = i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz
                fx = cx + 0.5 + (_hash3(cx, cy, cz, seed) - 0.5) * jitter
                fy = cy + 0.5 + (_hash3(cx, cy, cz, seed + 1) - 0.5) * jitter
                fz = cz + 0.5 + (_hash3(cx, cy, cz, seed + 2) - 0.5) * jitter
                d = np.sqrt((fx - P[:, 0]) ** 2 + (fy - P[:, 1]) ** 2 + (fz - P[:, 2]) ** 2)
                closer = d < f1
                f2 = np.where(closer, f1, np.minimum(f2, d))
                idn = np.where(closer, _hash3(cx, cy, cz, seed + 3), idn)
                f1 = np.where(closer, d, f1)
    return f1, f2, idn


def streaks(P, F, freq_across, freq_along, seed=0, octaves=3):
    """noise stretched along unit directions F (hair streaks)."""
    P = np.asarray(P, dtype=np.float64)
    along = (P * F).sum(1, keepdims=True)
    Q = (P - F * along) * freq_across + F * along * freq_along
    return fbm(Q, octaves, seed)
