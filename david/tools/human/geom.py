"""Geometry helpers: Catmull-Clark stencils (face-varying UVs), normals, tangents, ambient occlusion."""
from __future__ import annotations

import numpy as np
import scipy.sparse as sp
from scipy.spatial import cKDTree


# ------------------------------------------------------------------------------------------ subdivision
class CCResult:
    """One Catmull-Clark level on a closed quad mesh.

    S      : sparse (Vn x V) stencil so that new_positions = S @ old_positions (works for any
             per-vertex linear data: positions, morph deltas, skin weights...)
    quads  : (4F, 4) new quads (position indices)
    uvq    : (4F, 4) new quads (uv indices)
    US     : sparse (Tn x T) uv stencil (face-varying *linear* interpolation, seams preserved)
    """

    def __init__(self, S, quads, US, uvq):
        self.S, self.quads, self.US, self.uvq = S, quads, US, uvq


def catmull_clark(quads: np.ndarray, nV: int, uvq: np.ndarray, nT: int) -> CCResult:
    F = len(quads)
    # ---- edges
    e = np.stack([quads, np.roll(quads, -1, axis=1)], -1).reshape(-1, 2)  # (4F,2) face-edge i: corner k -> k+1
    ekey = np.sort(e, axis=1)
    uniq, einv = np.unique(ekey, axis=0, return_inverse=True)
    einv = einv.ravel()
    E = len(uniq)
    # each edge must have exactly 2 faces (closed manifold)
    cnt = np.bincount(einv, minlength=E)
    assert cnt.min() == 2 and cnt.max() == 2, "mesh must be closed & manifold"
    face_of_fe = np.repeat(np.arange(F), 4)
    # ---- face points: (F x V)
    rows = np.repeat(np.arange(F), 4)
    Fm = sp.csr_matrix((np.full(4 * F, 0.25), (rows, quads.ravel())), shape=(F, nV))
    # ---- edge midpoints (E x V)
    Mid = sp.csr_matrix((np.full(2 * E, 0.5), (np.repeat(np.arange(E), 2), uniq.ravel())), shape=(E, nV))
    # edge -> adjacent faces (E x F) with 0.5 each
    EF = sp.csr_matrix((np.full(4 * F, 0.5), (einv, face_of_fe)), shape=(E, F))
    # edge points = (a + b + f1 + f2) / 4 = 0.5*mid + 0.5*avg(faces)
    Ep = 0.5 * Mid + 0.5 * (EF @ Fm)
    # ---- vertex points: (Q + 2R + (n-3)P)/n
    val = np.bincount(uniq.ravel(), minlength=nV).astype(float)  # valence (edges per vertex)
    # vertex -> faces
    VF = sp.csr_matrix((np.ones(4 * F), (quads.ravel(), rows)), shape=(nV, F))
    fcount = np.asarray(VF.sum(1)).ravel()
    Q = sp.diags(1.0 / fcount) @ VF @ Fm
    VE = sp.csr_matrix((np.ones(2 * E), (uniq.ravel(), np.repeat(np.arange(E), 2))), shape=(nV, E))
    R = sp.diags(1.0 / val) @ VE @ Mid
    n = val
    Vp = sp.diags(1.0 / n) @ (Q + 2 * R) + sp.diags((n - 3) / n)
    S = sp.vstack([Vp, Ep, Fm]).tocsr()  # new index: [V | E | F]
    # ---- new quads: for each face, corners k: (v_k, e_k, f, e_{k-1})
    fe = einv.reshape(F, 4)  # edge index of edge (k -> k+1)
    fidx = np.arange(F)
    new = []
    for k in range(4):
        vk = quads[:, k]
        ek = nV + fe[:, k]
        ekm = nV + fe[:, (k - 1) % 4]
        fk = nV + E + fidx
        new.append(np.stack([vk, ek, fk, ekm], 1))
    newq = np.stack(new, 1).reshape(-1, 4)
    # ---- face-varying uv (linear)
    ue = np.stack([uvq, np.roll(uvq, -1, axis=1)], -1).reshape(-1, 2)
    uekey = np.sort(ue, axis=1)
    uuniq, ueinv = np.unique(uekey, axis=0, return_inverse=True)
    ueinv = ueinv.ravel()
    UE = len(uuniq)
    UFm = sp.csr_matrix((np.full(4 * F, 0.25), (rows, uvq.ravel())), shape=(F, nT))
    UMid = sp.csr_matrix((np.full(2 * UE, 0.5), (np.repeat(np.arange(UE), 2), uuniq.ravel())), shape=(UE, nT))
    US = sp.vstack([sp.identity(nT, format="csr"), UMid, UFm]).tocsr()
    ufe = ueinv.reshape(F, 4)
    newuq = []
    for k in range(4):
        newuq.append(np.stack([uvq[:, k], nT + ufe[:, k], nT + UE + fidx, nT + ufe[:, (k - 1) % 4]], 1))
    newuq = np.stack(newuq, 1).reshape(-1, 4)
    return CCResult(S, newq, US, newuq)


def limit_stencil(quads: np.ndarray, nV: int) -> sp.csr_matrix:
    """Catmull-Clark limit-position stencil (pushes control points onto the limit surface)."""
    F = len(quads)
    e = np.sort(np.stack([quads, np.roll(quads, -1, axis=1)], -1).reshape(-1, 2), axis=1)
    uniq = np.unique(e, axis=0)
    E = len(uniq)
    n = np.bincount(uniq.ravel(), minlength=nV).astype(float)
    # limit: (n^2 P + 4 sum(edge neighbours) + sum(face diagonals)) / (n(n+5))
    VE = sp.csr_matrix((np.ones(2 * E), (np.concatenate([uniq[:, 0], uniq[:, 1]]), np.concatenate([uniq[:, 1], uniq[:, 0]]))), shape=(nV, nV))
    diag_r = np.concatenate([quads[:, 0], quads[:, 1], quads[:, 2], quads[:, 3]])
    diag_c = np.concatenate([quads[:, 2], quads[:, 3], quads[:, 0], quads[:, 1]])
    VD = sp.csr_matrix((np.ones(4 * F), (diag_r, diag_c)), shape=(nV, nV))
    denom = n * (n + 5)
    L = sp.diags(n * n / denom) + sp.diags(4 / denom) @ VE + sp.diags(1 / denom) @ VD
    return L.tocsr()


# ------------------------------------------------------------------------------------------ normals / tangents
def tri_from_quads(q: np.ndarray) -> np.ndarray:
    return np.concatenate([q[:, [0, 1, 2]], q[:, [0, 2, 3]]], 0)


def vertex_normals(v: np.ndarray, tris: np.ndarray) -> np.ndarray:
    a, b, c = v[tris[:, 0]], v[tris[:, 1]], v[tris[:, 2]]
    fn = np.cross(b - a, c - a)
    n = np.zeros_like(v)
    for k in range(3):
        np.add.at(n, tris[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-20)


def tangents(pos: np.ndarray, nrm: np.ndarray, uv: np.ndarray, tris: np.ndarray) -> np.ndarray:
    """Per-vertex tangent (xyz + handedness w) from UV derivatives (MikkTSpace-like accumulation)."""
    p0, p1, p2 = pos[tris[:, 0]], pos[tris[:, 1]], pos[tris[:, 2]]
    w0, w1, w2 = uv[tris[:, 0]], uv[tris[:, 1]], uv[tris[:, 2]]
    e1, e2 = p1 - p0, p2 - p0
    d1, d2 = w1 - w0, w2 - w0
    r = d1[:, 0] * d2[:, 1] - d2[:, 0] * d1[:, 1]
    r = np.where(np.abs(r) < 1e-14, 1e-14, r)
    sdir = (e1 * d2[:, 1:2] - e2 * d1[:, 1:2]) / r[:, None]
    tdir = (e2 * d1[:, 0:1] - e1 * d2[:, 0:1]) / r[:, None]
    # weight by face area in uv to be robust
    T = np.zeros_like(pos)
    B = np.zeros_like(pos)
    for k in range(3):
        np.add.at(T, tris[:, k], sdir)
        np.add.at(B, tris[:, k], tdir)
    t = T - nrm * np.sum(nrm * T, 1, keepdims=True)
    t /= np.linalg.norm(t, axis=1, keepdims=True) + 1e-20
    w = np.where(np.sum(np.cross(nrm, t) * B, 1) < 0, -1.0, 1.0)
    return np.concatenate([t, w[:, None]], 1)


# ------------------------------------------------------------------------------------------ ambient occlusion
def disk_ao(pos: np.ndarray, nrm: np.ndarray, area: np.ndarray, radius: float, passes: int = 2, max_nb: int = 400) -> np.ndarray:
    """Bunnell-style disk-to-disk ambient occlusion on a point cloud (local occlusion within `radius`).

    Returns accessibility in [0,1] (1 = unoccluded).
    """
    tree = cKDTree(pos)
    N = len(pos)
    acc = np.ones(N)
    nbrs = tree.query_ball_point(pos, radius)
    # flatten neighbour lists
    ii, jj = [], []
    for i, lst in enumerate(nbrs):
        if len(lst) > max_nb:
            lst = lst[:: int(np.ceil(len(lst) / max_nb))]
        ii.extend([i] * len(lst))
        jj.extend(lst)
    ii = np.asarray(ii)
    jj = np.asarray(jj)
    m = ii != jj
    ii, jj = ii[m], jj[m]
    d = pos[jj] - pos[ii]
    d2 = np.sum(d * d, 1) + 1e-12
    dl = np.sqrt(d2)
    dn = d / dl[:, None]
    cos_r = np.clip(np.sum(nrm[ii] * dn, 1), 0, 1)  # receiver sees emitter in front
    cos_e = np.clip(-np.sum(nrm[jj] * dn, 1), 0, 1)  # emitter faces receiver?  (use |cos| for back faces)
    cos_e_any = np.abs(np.sum(nrm[jj] * dn, 1))
    a = area[jj]
    # form factor of a disk
    ff = (1 - 1 / np.sqrt(a / (np.pi * d2) + 1)) * np.clip(4 * cos_r, 0, 1) * np.maximum(cos_e, 0.35 * cos_e_any)
    falloff = np.clip(1 - dl / radius, 0, 1) ** 1.5
    ff *= falloff
    for _ in range(passes):
        occ = np.bincount(ii, weights=ff * acc[jj], minlength=N)
        acc = np.clip(1 - occ, 0, 1)
    return acc
