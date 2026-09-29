"""
Small signed-distance-field sculpting library (numpy, float64 math on float32 point sets).

Used by tools/animals/*.py to sculpt the animals offline. A sculpt is an ordered list of `Prim`s; every
primitive carries an axis-aligned bounding box so it is only evaluated where it can change the result
(narrow-band evaluation keeps a 3-4 mm grid over a 2 m bear tractable in numpy).

Conventions: metres, +Y up, the animal faces +Z, +X is the animal's left.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable, Optional, Sequence

import numpy as np

BIG = 1e3


# ----------------------------------------------------------------------------------------------- frames

def rot_x(a: float) -> np.ndarray:
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], dtype=np.float64)


def rot_y(a: float) -> np.ndarray:
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], dtype=np.float64)


def rot_z(a: float) -> np.ndarray:
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], dtype=np.float64)


def euler(x: float = 0.0, y: float = 0.0, z: float = 0.0) -> np.ndarray:
    """Rotation matrix for intrinsic XYZ Euler angles (three.js default order): R = Rx * Ry * Rz."""
    return rot_x(x) @ rot_y(y) @ rot_z(z)


@dataclass
class Frame:
    """Rigid frame: world = R @ local + o."""
    o: np.ndarray = field(default_factory=lambda: np.zeros(3))
    R: np.ndarray = field(default_factory=lambda: np.eye(3))

    def to_world(self, p) -> np.ndarray:
        return (self.R @ np.asarray(p, dtype=np.float64).T).T + self.o

    def pt(self, x: float, y: float, z: float) -> np.ndarray:
        return self.R @ np.array([x, y, z], dtype=np.float64) + self.o

    def dir(self, x: float, y: float, z: float) -> np.ndarray:
        return self.R @ np.array([x, y, z], dtype=np.float64)

    def child(self, o_local, R_local=None) -> "Frame":
        R2 = self.R if R_local is None else self.R @ R_local
        return Frame(self.pt(*o_local), R2)


# ----------------------------------------------------------------------------------------------- primitives

def _local(P: np.ndarray, c: np.ndarray, R: Optional[np.ndarray]) -> np.ndarray:
    Q = P - c
    if R is not None:
        Q = Q @ R  # R^T applied to row vectors: (R^T q^T)^T = q R
    return Q


def sd_ellipsoid(P: np.ndarray, c, r, R=None) -> np.ndarray:
    """Inigo Quilez' ellipsoid bound (exact on the surface, good near it)."""
    Q = _local(P, np.asarray(c, dtype=np.float64), R)
    r = np.asarray(r, dtype=np.float64)
    k0 = np.linalg.norm(Q / r, axis=1)
    k1 = np.linalg.norm(Q / (r * r), axis=1)
    k1 = np.maximum(k1, 1e-9)
    return k0 * (k0 - 1.0) / k1


def sd_round_cone(P: np.ndarray, a, b, r1: float, r2: float) -> np.ndarray:
    """Exact SDF of a round cone (sphere r1 at a swept to sphere r2 at b)."""
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    ba = b - a
    l2 = float(ba @ ba)
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pa = P - a
    y = pa @ ba
    z = y - l2
    x = pa * l2 - np.outer(y, ba)
    x2 = np.einsum('ij,ij->i', x, x)
    y2 = y * y * l2
    z2 = z * z * l2
    k = math.copysign(1.0, rr) * rr * rr * x2
    out = (np.sqrt(np.maximum(x2 * a2 * il2, 0.0)) + y * rr) * il2 - r1
    m1 = np.sign(z) * a2 * z2 > k
    m2 = np.sign(y) * a2 * y2 < k
    out = np.where(m2, np.sqrt(x2 + y2) * il2 - r1, out)
    out = np.where(m1, np.sqrt(x2 + z2) * il2 - r2, out)
    return out


def sd_capsule(P, a, b, r):
    return sd_round_cone(P, a, b, r, r)


def sd_box(P, c, half, R=None, round_r: float = 0.0):
    Q = np.abs(_local(P, np.asarray(c, dtype=np.float64), R)) - (np.asarray(half) - round_r)
    outside = np.linalg.norm(np.maximum(Q, 0.0), axis=1)
    inside = np.minimum(np.max(Q, axis=1), 0.0)
    return outside + inside - round_r


def sd_plane(P, n, d):
    n = np.asarray(n, dtype=np.float64)
    n = n / np.linalg.norm(n)
    return P @ n - d


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.maximum(k - np.abs(a - b), 0.0) / k
    return np.minimum(a, b) - h * h * k * 0.25


def smax(a, b, k):
    return -smin(-a, -b, k)


# ----------------------------------------------------------------------------------------------- sculpt

@dataclass
class Prim:
    """One sculpt operation.

    op: 'add' (smooth union), 'sub' (smooth subtraction), 'int' (smooth intersection with the result so far).
    bones: skin-weight rule -> list of (bone, weight) pairs, or a callable P -> (N, nb) handled by the caller.
    sigma: fall-off (m) of this primitive's influence on skin weights.
    """
    name: str
    fn: Callable[[np.ndarray], np.ndarray]
    lo: np.ndarray
    hi: np.ndarray
    k: float = 0.0
    op: str = 'add'
    bones: object = None
    sigma: float = 0.012
    group: str = ''

    def in_box(self, P: np.ndarray, margin: float) -> np.ndarray:
        m = margin + self.k
        return np.all((P >= self.lo - m) & (P <= self.hi + m), axis=1)


def _bbox_pts(pts: Sequence[np.ndarray], pad: float):
    A = np.array(pts, dtype=np.float64)
    return A.min(axis=0) - pad, A.max(axis=0) + pad


def ellipsoid(name, c, r, R=None, k=0.0, op='add', bones=None, sigma=0.012, group=''):
    c = np.asarray(c, dtype=np.float64)
    r = np.asarray(r, dtype=np.float64)
    ext = float(np.max(r))
    if R is not None:
        # bound of a rotated ellipsoid: |R| @ r
        ext_v = np.abs(R) @ r
    else:
        ext_v = r
    lo, hi = c - ext_v, c + ext_v
    Rm = None if R is None else np.asarray(R, dtype=np.float64)
    return Prim(name, lambda P: sd_ellipsoid(P, c, r, Rm), lo, hi, k, op, bones, sigma, group)


def round_cone(name, a, b, r1, r2, k=0.0, op='add', bones=None, sigma=0.012, group=''):
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    lo = np.minimum(a - r1, b - r2)
    hi = np.maximum(a + r1, b + r2)
    return Prim(name, lambda P: sd_round_cone(P, a, b, r1, r2), lo, hi, k, op, bones, sigma, group)


def capsule(name, a, b, r, **kw):
    return round_cone(name, a, b, r, r, **kw)


def box(name, c, half, R=None, round_r=0.0, k=0.0, op='add', bones=None, sigma=0.012, group=''):
    c = np.asarray(c, dtype=np.float64)
    half = np.asarray(half, dtype=np.float64)
    ext_v = (np.abs(R) @ half) if R is not None else half
    return Prim(name, lambda P: sd_box(P, c, half, R, round_r), c - ext_v, c + ext_v, k, op, bones, sigma, group)


def custom(name, fn, lo, hi, k=0.0, op='add', bones=None, sigma=0.012, group=''):
    return Prim(name, fn, np.asarray(lo, dtype=np.float64), np.asarray(hi, dtype=np.float64), k, op, bones, sigma, group)


def evaluate(prims: Sequence[Prim], P: np.ndarray, margin: float = 0.03) -> np.ndarray:
    """Evaluate the sculpt at points P (N,3). Primitives are skipped where their (padded) bbox misses."""
    P = np.asarray(P, dtype=np.float64)
    d = np.full(len(P), BIG, dtype=np.float64)
    for pr in prims:
        m = pr.in_box(P, margin)
        if not m.any():
            continue
        idx = np.nonzero(m)[0]
        v = pr.fn(P[idx])
        cur = d[idx]
        if pr.op == 'add':
            d[idx] = smin(cur, v, pr.k)
        elif pr.op == 'sub':
            d[idx] = smax(cur, -v, pr.k)
        elif pr.op == 'int':
            d[idx] = smax(cur, v, pr.k)
        else:
            raise ValueError(pr.op)
    return d


def part_distances(prims: Sequence[Prim], P: np.ndarray, margin: float = 0.05) -> np.ndarray:
    """Distances of every 'add' primitive (rows) at P (cols); BIG outside the padded bbox."""
    P = np.asarray(P, dtype=np.float64)
    adds = [p for p in prims if p.op == 'add']
    D = np.full((len(adds), len(P)), BIG, dtype=np.float64)
    for i, pr in enumerate(adds):
        m = pr.in_box(P, margin + 3 * pr.sigma)
        if m.any():
            idx = np.nonzero(m)[0]
            D[i, idx] = pr.fn(P[idx])
    return D


def gradient(prims, P, eps=5e-4, margin=0.03):
    """Central-difference gradient (tetrahedral, 4 evaluations) and the value at P."""
    P = np.asarray(P, dtype=np.float64)
    k = np.array([[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]], dtype=np.float64)
    vals = [evaluate(prims, P + kk * eps, margin) for kk in k]
    g = sum(kk[None, :] * v[:, None] for kk, v in zip(k, vals))
    d = sum(vals) * 0.25
    n = np.linalg.norm(g, axis=1, keepdims=True)
    return g / np.maximum(n, 1e-12), d


def project(prims, P, iters=3, eps=5e-4):
    """Newton-project points onto the zero level set; returns (points, normals)."""
    Q = np.asarray(P, dtype=np.float64).copy()
    for _ in range(iters):
        n, d = gradient(prims, Q, eps)
        Q -= n * np.clip(d, -0.01, 0.01)[:, None]
    n, _ = gradient(prims, Q, eps)
    return Q, n


# ----------------------------------------------------------------------------------------------- grid + polygonise

def narrow_band_grid(prims, lo, hi, h, coarse_factor=4, band=None, log=print):
    """Sample the sculpt on a regular grid with spacing h, evaluating exactly only near the surface.

    Returns (volume[nx,ny,nz] float32, origin, h). Far voxels get the (sign-correct) coarse value.
    """
    lo = np.asarray(lo, dtype=np.float64)
    hi = np.asarray(hi, dtype=np.float64)
    n = np.ceil((hi - lo) / h).astype(int) + 1
    H = h * coarse_factor
    nc = np.ceil((n - 1) / coarse_factor).astype(int) + 1
    gx = [lo[i] + np.arange(nc[i]) * H for i in range(3)]
    C = np.stack(np.meshgrid(*gx, indexing='ij'), axis=-1).reshape(-1, 3)
    log(f'  coarse grid {tuple(nc)} = {len(C)} pts')
    dc = evaluate(prims, C).reshape(tuple(nc)).astype(np.float32)
    band = band if band is not None else H * 1.5
    # coarse cells that may contain surface
    from scipy.ndimage import minimum_filter, maximum_filter
    near = np.abs(dc) < band
    near = maximum_filter(near.astype(np.uint8), size=3).astype(bool)
    vol = np.empty(tuple(n), dtype=np.float32)
    # fill from coarse (nearest coarse sample) — sign is what matters away from the band
    ii = [np.minimum(np.round(np.arange(n[i]) / coarse_factor).astype(int), nc[i] - 1) for i in range(3)]
    vol[:] = dc[np.ix_(ii[0], ii[1], ii[2])]
    # fine evaluation inside near coarse cells
    fine_mask = near[np.ix_(ii[0], ii[1], ii[2])]
    idx = np.nonzero(fine_mask)
    log(f'  fine grid {tuple(n)}: evaluating {len(idx[0])} of {vol.size} voxels')
    Pf = np.stack([lo[0] + idx[0] * h, lo[1] + idx[1] * h, lo[2] + idx[2] * h], axis=1)
    CH = 1_500_000
    out = np.empty(len(Pf), dtype=np.float32)
    for s in range(0, len(Pf), CH):
        out[s:s + CH] = evaluate(prims, Pf[s:s + CH])
    vol[idx] = out
    return vol, lo, h


def polygonise(vol, origin, h):
    from skimage.measure import marching_cubes
    verts, faces, _, _ = marching_cubes(vol, level=0.0, spacing=(h, h, h), allow_degenerate=False)
    verts = verts + origin
    # skimage returns faces wound so that normals point toward increasing values (outside for an SDF)
    return verts.astype(np.float64), faces.astype(np.int64)
