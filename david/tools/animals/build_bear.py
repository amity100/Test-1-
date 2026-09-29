"""
Offline build of the Syrian brown bear (Ursus arctos syriacus) for DAVID, chapter 1.

    python3 tools/animals/build_bear.py [--h 0.0036] [--tris 52000] [--tex 2048] [--stage all|mesh|bake]

Pipeline (all our own code + permissive build-time libraries, see CREDITS.md):
  1. SDF sculpt (bear_design.py) -> narrow-band grid -> marching cubes (scikit-image)
  2. quadric decimation (fast-simplification) + tangential relaxation + projection back onto the SDF
  3. UV atlas (xatlas), skin weights from the sculpt primitives (smoothed on the mesh graph),
     fur length / combing direction fields (bear_paint.py), per-vertex AO (embree rays)
  4. LOD index buffers with meshoptimizer (seam-aware, one shared vertex buffer / texture set)
  5. extras: eyeballs, claws and teeth (parametric, rigidly skinned)
  6. texture bake (albedo / tangent-space normal / mask = AO, roughness, fur density) at 2k and 1k
  7. export: src/assets/animals/bear.json (rig), bear_mesh.binz (gzip), bear_*_{2k,1k}.webp, fur_strands.png
"""
from __future__ import annotations

import argparse
import gzip
import json
import math
import os
import struct
import subprocess
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bear_design as B  # noqa: E402
import bear_paint as BP  # noqa: E402
from noise3 import fbm, streaks, vnoise, worley  # noqa: E402
from sdf import evaluate, gradient, narrow_band_grid, part_distances, polygonise, project  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'src', 'assets', 'animals')
CACHE = os.environ.get('ANIMALS_CACHE', '/tmp/claude-0/-home-user-Test-1-/aa9d8085-4598-5292-aa4e-bfc8e4c43335/scratchpad/animals/cache')
NODE_PATH = os.environ.get('MESHOPT_NODE_PATH', '/tmp/claude-0/-home-user-Test-1-/aa9d8085-4598-5292-aa4e-bfc8e4c43335/scratchpad/animals/node_modules')

T0 = time.time()


def log(*a):
    print(f'[{time.time() - T0:7.1f}s]', *a, flush=True)


# ============================================================================================ mesh helpers

def largest_component(V, F):
    import scipy.sparse as sp
    from scipy.sparse.csgraph import connected_components
    n = len(V)
    A = sp.coo_matrix((np.ones(len(F) * 3), (F[:, [0, 1, 2]].ravel(), F[:, [1, 2, 0]].ravel())), shape=(n, n))
    nc, lab = connected_components(A, directed=False)
    if nc == 1:
        return V, F
    keep = np.argmax(np.bincount(lab))
    vm = lab == keep
    remap = -np.ones(n, dtype=np.int64)
    remap[vm] = np.arange(vm.sum())
    Fk = F[vm[F[:, 0]]]
    log(f'  removed {nc - 1} floating components')
    return V[vm], remap[Fk]


def adjacency(F, n):
    import scipy.sparse as sp
    i = np.concatenate([F[:, 0], F[:, 1], F[:, 2], F[:, 1], F[:, 2], F[:, 0]])
    j = np.concatenate([F[:, 1], F[:, 2], F[:, 0], F[:, 0], F[:, 1], F[:, 2]])
    A = sp.coo_matrix((np.ones(len(i)), (i, j)), shape=(n, n)).tocsr()
    A.data[:] = 1.0
    deg = np.asarray(A.sum(1)).ravel()
    return A, deg


def smooth_field(X, A, deg, iters=3, alpha=0.5):
    X = X.copy()
    for _ in range(iters):
        avg = (A @ X) / np.maximum(deg, 1)[:, None] if X.ndim == 2 else (A @ X) / np.maximum(deg, 1)
        X = X * (1 - alpha) + avg * alpha
    return X


def vertex_normals(V, F):
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    N = np.zeros_like(V)
    for k in range(3):
        np.add.at(N, F[:, k], fn)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)


def relax(prims, V, F, iters=3, lam=0.5):
    """tangential Laplacian relaxation (better triangle shapes) + re-projection onto the SDF"""
    A, deg = adjacency(F, len(V))
    N = vertex_normals(V, F)
    for _ in range(iters):
        avg = (A @ V) / np.maximum(deg, 1)[:, None]
        d = avg - V
        d -= (d * N).sum(1, keepdims=True) * N
        V = V + lam * d
        V, N = project(prims, V, iters=2)
    return V, N


# ============================================================================================ stage: mesh

def stage_mesh(args):
    prims = B.sculpt()
    log('sculpt:', len(prims), 'primitives')
    vol, org, hh = narrow_band_grid(prims, B.BBOX_LO, B.BBOX_HI, args.h, coarse_factor=4, log=log)
    Vh, Fh = polygonise(vol, org, hh)
    del vol
    Vh, Fh = largest_component(Vh, Fh)
    log(f'marching cubes: {len(Vh)} verts, {len(Fh)} tris')

    import fast_simplification
    red = 1.0 - args.tris / len(Fh)
    Vd, Fd = fast_simplification.simplify(Vh.astype(np.float32), Fh.astype(np.int32), target_reduction=red, agg=5)
    Vd = Vd.astype(np.float64)
    Fd = Fd.astype(np.int64)
    Vd, Fd = largest_component(Vd, Fd)
    log(f'decimated: {len(Vd)} verts, {len(Fd)} tris')
    Vd, Nd = relax(prims, Vd, Fd, iters=3)
    # fix winding consistency with the SDF normals
    fn = np.cross(Vd[Fd[:, 1]] - Vd[Fd[:, 0]], Vd[Fd[:, 2]] - Vd[Fd[:, 0]])
    agree = (fn * (Nd[Fd[:, 0]] + Nd[Fd[:, 1]] + Nd[Fd[:, 2]])).sum(1)
    if (agree < 0).mean() > 0.5:
        Fd = Fd[:, [0, 2, 1]]
        log('  flipped winding')
    np.savez_compressed(os.path.join(CACHE, 'bear_lod0.npz'), V=Vd, F=Fd, N=Nd)
    log('relaxed + projected')
    return prims


# ============================================================================================ skin weights

def skin_weights(prims, V, F):
    adds = [p for p in prims if p.op == 'add']
    D = part_distances(prims, V)
    Dmin = D.min(axis=0)
    nb = len(B.BONES)
    W = np.zeros((len(V), nb))
    for i, p in enumerate(adds):
        rel = (D[i] - Dmin) / p.sigma
        w = np.exp(-rel * rel)
        w[D[i] >= 1e2] = 0
        if not np.any(w > 1e-4):
            continue
        rule = p.bones
        if rule is None:
            raise ValueError(f'primitive {p.name} has no bone rule')
        if isinstance(rule, str):
            W[:, B.BONE_INDEX[rule]] += w
        elif isinstance(rule, list):
            for b, bw in rule:
                W[:, B.BONE_INDEX[b]] += w * bw
        elif isinstance(rule, tuple) and rule[0] == 'axial':
            _, a, b, knots = rule
            ab = b - a
            t = ((V - a) @ ab) / (ab @ ab)
            ts = np.array([k[0] for k in knots], dtype=np.float64)
            tc = np.clip(t, ts[0], ts[-1])
            seg = np.clip(np.searchsorted(ts, tc, side='right') - 1, 0, len(ts) - 2)
            u = (tc - ts[seg]) / np.maximum(ts[seg + 1] - ts[seg], 1e-9)
            sm = u * u * (3 - 2 * u)
            names = [k[1] for k in knots]
            for k in range(len(knots)):
                wk = np.where(seg == k, 1 - sm, 0.0) + np.where(seg + 1 == k, sm, 0.0)
                W[:, B.BONE_INDEX[names[k]]] += w * wk
        else:
            raise ValueError(rule)
    W /= np.maximum(W.sum(1, keepdims=True), 1e-12)
    A, deg = adjacency(F, len(V))
    W = smooth_field(W, A, deg, iters=4, alpha=0.5)
    # top 4
    idx = np.argsort(-W, axis=1)[:, :4]
    w4 = np.take_along_axis(W, idx, axis=1)
    w4[w4 < 0.02] = 0
    w4 /= np.maximum(w4.sum(1, keepdims=True), 1e-12)
    Wf = np.zeros_like(W)
    np.put_along_axis(Wf, idx, w4, axis=1)
    return Wf


def quantize_weights(W):
    idx = np.argsort(-W, axis=1)[:, :4]
    w4 = np.take_along_axis(W, idx, axis=1)
    q = np.floor(w4 * 255 + 0.5).astype(np.int64)
    # force the sum to 255 (fix on the largest)
    q[:, 0] += 255 - q.sum(1)
    idx = np.where(q > 0, idx, 0)
    return idx.astype(np.uint8), q.astype(np.uint8)


# ============================================================================================ AO

def vertex_ao(V, N, F, rays=64, maxd=0.35, seed=3):
    import trimesh
    from trimesh.ray.ray_pyembree import RayMeshIntersector
    mesh = trimesh.Trimesh(vertices=V, faces=F, process=False)
    ray = RayMeshIntersector(mesh)
    rng = np.random.default_rng(seed)
    # cosine-weighted hemisphere samples in a fixed frame, rotated per vertex
    u1, u2 = rng.random(rays), rng.random(rays)
    r = np.sqrt(u1)
    th = 2 * np.pi * u2
    S = np.stack([r * np.cos(th), r * np.sin(th), np.sqrt(1 - u1)], axis=1)
    t = np.cross(N, np.array([0.0, 1.0, 0.0]))
    bad = np.linalg.norm(t, axis=1) < 1e-3
    t[bad] = np.cross(N[bad], np.array([1.0, 0.0, 0.0]))
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    b = np.cross(N, t)
    ao = np.zeros(len(V))
    CH = 4000
    for s in range(0, len(V), CH):
        e = min(len(V), s + CH)
        n = e - s
        D = (S[None, :, 0:1] * t[s:e, None, :] + S[None, :, 1:2] * b[s:e, None, :] + S[None, :, 2:3] * N[s:e, None, :]).reshape(-1, 3)
        O = np.repeat(V[s:e] + N[s:e] * 0.002, rays, axis=0)
        loc, ir, _ = ray.intersects_location(O, D, multiple_hits=False)
        occ = np.zeros(n * rays)
        if len(ir):
            dist = np.linalg.norm(loc - O[ir], axis=1)
            occ[ir] = np.clip(1 - dist / maxd, 0, 1) ** 0.5 * (dist < maxd)
        ao[s:e] = 1 - occ.reshape(n, rays).mean(1)
    return ao


# ============================================================================================ tangents

def compute_tangents(V, N, UV, F):
    p0, p1, p2 = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    w0, w1, w2 = UV[F[:, 0]], UV[F[:, 1]], UV[F[:, 2]]
    e1, e2 = p1 - p0, p2 - p0
    d1, d2 = w1 - w0, w2 - w0
    r = d1[:, 0] * d2[:, 1] - d2[:, 0] * d1[:, 1]
    r = np.where(np.abs(r) < 1e-14, 1e-14, r)
    sd = (e1 * d2[:, 1:2] - e2 * d1[:, 1:2]) / r[:, None]
    td = (e2 * d1[:, 0:1] - e1 * d2[:, 0:1]) / r[:, None]
    T = np.zeros_like(V)
    Bt = np.zeros_like(V)
    for k in range(3):
        np.add.at(T, F[:, k], sd)
        np.add.at(Bt, F[:, k], td)
    T -= N * (N * T).sum(1, keepdims=True)
    T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-12)
    w = np.where((np.cross(N, T) * Bt).sum(1) < 0, -1.0, 1.0)
    return T, w


# ============================================================================================ extras

def lathe_tube(path_pts, radii, frames_up, seg=10, squash=1.0):
    """tube along path_pts with radii; frames_up = reference 'up' vector for the elliptical section."""
    V, Nn, T = [], [], []
    n = len(path_pts)
    for i in range(n):
        p = path_pts[i]
        tan = path_pts[min(i + 1, n - 1)] - path_pts[max(i - 1, 0)]
        tan /= np.linalg.norm(tan)
        up = frames_up - tan * (frames_up @ tan)
        up /= np.linalg.norm(up)
        side = np.cross(tan, up)
        for j in range(seg):
            a = 2 * np.pi * j / seg
            d = np.cos(a) * side + np.sin(a) * up * squash
            V.append(p + d * radii[i])
            nn = np.cos(a) * side + np.sin(a) * up / max(squash, 1e-3)
            Nn.append(nn / np.linalg.norm(nn))
            T.append(i / (n - 1))
    Fc = []
    for i in range(n - 1):
        for j in range(seg):
            a, b = i * seg + j, i * seg + (j + 1) % seg
            c, d = a + seg, b + seg
            Fc += [[a, c, b], [b, c, d]]
    # tip cap
    tip = len(V)
    last = path_pts[-1] + (path_pts[-1] - path_pts[-2]) * 0.3
    V.append(last)
    tn = path_pts[-1] - path_pts[-2]
    Nn.append(tn / np.linalg.norm(tn))
    T.append(1.0)
    for j in range(seg):
        a, b = (n - 1) * seg + j, (n - 1) * seg + (j + 1) % seg
        Fc.append([a, tip, b])
    return np.array(V), np.array(Nn), np.array(Fc), np.array(T)


def uv_sphere(c, r, nu=20, nv=14):
    V, N = [], []
    for i in range(nv + 1):
        th = np.pi * i / nv
        for j in range(nu):
            ph = 2 * np.pi * j / nu
            d = np.array([np.sin(th) * np.cos(ph), np.cos(th), np.sin(th) * np.sin(ph)])
            V.append(c + d * r)
            N.append(d)
    F = []
    for i in range(nv):
        for j in range(nu):
            a, b = i * nu + j, i * nu + (j + 1) % nu
            c2, d = a + nu, b + nu
            F += [[a, b, c2], [b, d, c2]]
    return np.array(V), np.array(N), np.array(F)


def build_extras(prims):
    """eyes (kind 0), claws (kind 1), teeth (kind 2). Returns dict of arrays."""
    parts = []  # (V, N, F, bone, kind, t, axis)

    # ---- eyes: seat each eyeball in its orbit, protruding a little past the lids
    for s, side in ((1, 'L'), (-1, 'R')):
        ax = B.HEAD.R @ (np.array([np.sin(0.52 * s), 0.08, np.cos(0.52)]))
        ax /= np.linalg.norm(ax)
        c0 = B.HEAD.pt(0.056 * s, 0.047, 0.18)
        # march outward from inside the head to the surface along the eye axis
        ts = np.linspace(0, 0.06, 241)
        pts = c0[None, :] + ts[:, None] * ax[None, :]
        d = evaluate(prims, pts)
        out = np.argmax(d > 0)
        surf = pts[out]
        r = 0.0128 * B.HEAD_S
        c = surf - ax * r * 0.42
        V, N, F = uv_sphere(np.zeros(3), r, 24, 16)
        # orient the sphere pole (+Y of the lathe) along the eye axis
        up = np.array([0.0, 1.0, 0.0])
        v = np.cross(up, ax)
        sn, cs = np.linalg.norm(v), up @ ax
        if sn > 1e-6:
            k = v / sn
            K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
            R = np.eye(3) + K * sn + K @ K * (1 - cs)
        else:
            R = np.eye(3)
        V = V @ R.T + c
        N = N @ R.T
        parts.append((V, N, F, 'head', 0, np.zeros(len(V)), ax, c))
        B.SOCKETS['eye' + side] = ('head', c)

    # ---- claws: long, pale, curved (front 5-6.5 cm, hind ~3.5 cm)
    for key, bone, L0, r0 in (('fL', 'toesL', 0.062, 0.0085), ('fR', 'toesR', 0.062, 0.0085), ('hL', 'htoesL', 0.036, 0.0068), ('hR', 'htoesR', 0.036, 0.0068)):
        for i, (c, r, Rp) in enumerate(B.TOES[key]):
            fwd = Rp @ np.array([0.0, 0.0, 1.0])
            L = L0 * (0.82 if i in (0, 4) else 1.0) * (1.06 if i == 2 else 1.0)
            root = c + fwd * (r * 1.0) + np.array([0, 0.008, 0])
            n = 9
            pts = []
            for k in range(n):
                u = k / (n - 1)
                # sweeps forward, then curls down toward the ground
                pts.append(root + fwd * (L * 0.82 * u) - np.array([0, 1.0, 0]) * (L * (0.12 * u + 0.5 * u * u)))
            pts = np.array(pts)
            radii = r0 * (1 - np.linspace(0, 1, n)) ** 0.8 + 0.0008
            V, N, F, T = lathe_tube(pts, radii, np.array([0.0, 1.0, 0.0]), seg=8, squash=1.35)
            parts.append((V, N, F, bone, 1, T, fwd, root))

    # ---- teeth (upper on the head, lower on the jaw)
    def tooth(base, direction, L, rb, bone, curve=0.15, seg=7):
        direction = direction / np.linalg.norm(direction)
        bend = np.cross(direction, np.cross(np.array([0, 0, 1.0]), direction))
        if np.linalg.norm(bend) < 1e-6:
            bend = np.array([0, 0, 1.0])
        bend /= np.linalg.norm(bend)
        n = 6
        pts = np.array([base + direction * L * (k / (n - 1)) - bend * curve * L * (k / (n - 1)) ** 2 for k in range(n)])
        radii = rb * (1 - np.linspace(0, 1, n) ** 1.3) + 0.0006
        V, N, F, T = lathe_tube(pts, radii, np.array([1.0, 0, 0]), seg=seg, squash=1.0)
        parts.append((V, N, F, bone, 2, T, direction, base))

    HS = B.HEAD_S
    hd = B.HEAD.dir(0, -1, 0.12)
    jd = B.JAWF.dir(0, 1, 0.1)
    for s in (1, -1):
        # upper canine
        tooth(B.HEAD.pt(0.024 * s, -0.036, 0.285), hd + B.HEAD.dir(0.08 * s, 0, 0), 0.032 * HS, 0.0068 * HS, 'head', curve=-0.12)
        # lower canine (sits in front of the upper one when closed)
        tooth(B.JAWF.pt(0.021 * s, -0.012, 0.162), jd + B.JAWF.dir(0.1 * s, 0, 0.15), 0.026 * HS, 0.006 * HS, 'jaw', curve=-0.15)
        # incisors
        for k, dx in enumerate((0.004, 0.0105, 0.017)):
            tooth(B.HEAD.pt(dx * s, -0.038, 0.303 - 0.004 * k), hd, (0.011 + 0.002 * (k == 2)) * HS, (0.0028 + 0.0006 * (k == 2)) * HS, 'head', curve=0.0, seg=6)
            tooth(B.JAWF.pt(dx * 0.9 * s, -0.012, 0.172 - 0.004 * k), jd, 0.009 * HS, 0.0025 * HS, 'jaw', curve=0.0, seg=6)
        # cheek teeth (premolars / molars): blunt cones along the tooth rows
        for k in range(4):
            z = 0.255 - 0.03 * k
            tooth(B.HEAD.pt(0.029 * s, -0.036, z), hd, (0.008 + 0.002 * k) * HS, (0.005 + 0.0012 * k) * HS, 'head', curve=0.0, seg=7)
            zj = 0.135 - 0.028 * k
            tooth(B.JAWF.pt(0.026 * s, -0.012, zj), jd, (0.007 + 0.0018 * k) * HS, (0.0048 + 0.001 * k) * HS, 'jaw', curve=0.0, seg=7)

    Vs, Ns, Fs, bones, aux = [], [], [], [], []
    off = 0
    for V, N, F, bone, kind, T, axis, c in parts:
        Vs.append(V)
        Ns.append(N)
        Fs.append(F + off)
        bones.append(np.full(len(V), B.BONE_INDEX[bone]))
        a = np.zeros((len(V), 4))
        a[:, 0] = kind
        a[:, 1] = T
        if kind == 0:
            a[:, 1:4] = axis  # eye axis for iris shading
        aux.append(a)
        off += len(V)
    return {
        'V': np.concatenate(Vs), 'N': np.concatenate(Ns), 'F': np.concatenate(Fs),
        'bone': np.concatenate(bones), 'aux': np.concatenate(aux),
    }


# ============================================================================================ bake

def rasterize(uv_px, F, W, H):
    from numba import njit

    @njit(cache=False)
    def _r(uv, F, W, H, tid, bar):
        for t in range(F.shape[0]):
            a, b, c = F[t, 0], F[t, 1], F[t, 2]
            x0, y0 = uv[a, 0], uv[a, 1]
            x1, y1 = uv[b, 0], uv[b, 1]
            x2, y2 = uv[c, 0], uv[c, 1]
            area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
            if abs(area) < 1e-12:
                continue
            mnx = max(int(math.floor(min(x0, x1, x2))) - 1, 0)
            mxx = min(int(math.ceil(max(x0, x1, x2))) + 1, W - 1)
            mny = max(int(math.floor(min(y0, y1, y2))) - 1, 0)
            mxy = min(int(math.ceil(max(y0, y1, y2))) + 1, H - 1)
            for py in range(mny, mxy + 1):
                sy = py + 0.5
                for px in range(mnx, mxx + 1):
                    sx = px + 0.5
                    w0 = ((x1 - sx) * (y2 - sy) - (x2 - sx) * (y1 - sy)) / area
                    w1 = ((x2 - sx) * (y0 - sy) - (x0 - sx) * (y2 - sy)) / area
                    w2 = 1.0 - w0 - w1
                    if w0 >= -1e-4 and w1 >= -1e-4 and w2 >= -1e-4:
                        tid[py, px] = t
                        bar[py, px, 0] = w0
                        bar[py, px, 1] = w1
                        bar[py, px, 2] = w2

    tid = -np.ones((H, W), dtype=np.int64)
    bar = np.zeros((H, W, 3), dtype=np.float64)
    _r(uv_px.astype(np.float64), F.astype(np.int64), W, H, tid, bar)
    return tid, bar


def dilate(img, valid, iters=None):
    """fill invalid texels with the nearest valid texel (seam padding)"""
    from scipy.ndimage import distance_transform_edt
    _, (iy, ix) = distance_transform_edt(~valid, return_indices=True)
    return img[iy, ix]


def bake(prims, mesh, res, log=log):
    V, N, T, Tw, UV, F, W, fur_len, fur_dir, ao = (mesh[k] for k in ('V', 'N', 'T', 'Tw', 'UV', 'F', 'W', 'fur_len', 'fur_dir', 'ao'))
    Hh = Ww = res
    uv_px = np.stack([UV[:, 0] * Ww, (1 - UV[:, 1]) * Hh], axis=1)
    tid, bar = rasterize(uv_px, F, Ww, Hh)
    valid = tid >= 0
    ys, xs = np.nonzero(valid)
    log(f'  bake {res}: {len(ys)} texels ({len(ys) / (res * res) * 100:.1f}% coverage)')
    t = tid[ys, xs]
    b = bar[ys, xs]
    fv = F[t]

    def interp(A):
        return A[fv[:, 0]] * b[:, 0:1] + A[fv[:, 1]] * b[:, 1:2] + A[fv[:, 2]] * b[:, 2:3] if A.ndim == 2 else \
            A[fv[:, 0]] * b[:, 0] + A[fv[:, 1]] * b[:, 1] + A[fv[:, 2]] * b[:, 2]

    albedo = np.zeros((Hh, Ww, 3))
    normal = np.zeros((Hh, Ww, 3))
    maskt = np.zeros((Hh, Ww, 3))
    CH = 400_000
    for s in range(0, len(ys), CH):
        e = min(len(ys), s + CH)
        sl = slice(s, e)
        bb = b[sl]
        f3 = fv[sl]

        def ip(A):
            if A.ndim == 2:
                return A[f3[:, 0]] * bb[:, 0:1] + A[f3[:, 1]] * bb[:, 1:2] + A[f3[:, 2]] * bb[:, 2:3]
            return A[f3[:, 0]] * bb[:, 0] + A[f3[:, 1]] * bb[:, 1] + A[f3[:, 2]] * bb[:, 2]

        P = ip(V)
        Nn = ip(N)
        Nn /= np.linalg.norm(Nn, axis=1, keepdims=True)
        Tt = ip(T)
        Tt -= Nn * (Nn * Tt).sum(1, keepdims=True)
        Tt /= np.maximum(np.linalg.norm(Tt, axis=1, keepdims=True), 1e-12)
        sgn = np.sign(ip(Tw))
        sgn[sgn == 0] = 1
        Bt = np.cross(Nn, Tt) * sgn[:, None]
        Wt = ip(W)
        FL = ip(fur_len)
        FD = ip(fur_dir)
        FD -= Nn * (FD * Nn).sum(1, keepdims=True)
        FD /= np.maximum(np.linalg.norm(FD, axis=1, keepdims=True), 1e-9)
        AO = ip(ao)
        # ---- exact surface normal from the SDF (captures detail lost by decimation)
        Ns, _ = gradient(prims, P)
        # ---- region masks
        nose = BP.nose_mask(P)
        interior, lip = BP.mouth_fields(P, Ns, Wt)
        eyem = BP.eye_mask(P)
        pad = BP.pad_mask(P, Ns, Wt)
        bare = np.clip(np.maximum.reduce([nose, lip, eyem, pad]), 0, 1)
        # ---- micro normal detail as a height field (m), differentiated along T/B
        mn = nose > 0.01
        mp = pad > 0.01
        ml = lip > 0.01
        mi = interior > 0.01

        def height(Q):
            h = np.zeros(len(Q))
            # nose: cobblestone pebbling
            if mn.any():
                f1, f2, _ = worley(Q[mn] * 520.0, seed=5)
                h[mn] += nose[mn] * (np.clip(f2 - f1, 0, 1) ** 0.5) * 0.0006
            # pads: coarse knobbly papillae
            if mp.any():
                f1b, f2b, _ = worley(Q[mp] * 300.0, seed=9)
                h[mp] += pad[mp] * (np.clip(f2b - f1b, 0, 1) ** 0.6) * 0.0009
            # lips / gums: fine wrinkles
            if ml.any():
                h[ml] += lip[ml] * (1 - interior[ml]) * (fbm(Q[ml] * 900.0, 2, seed=13) - 0.5) * 0.0005
            # palate ridges (rugae) + tongue papillae
            if mi.any():
                Qm = Q[mi]
                Qh = BP.to_head(Qm)
                rug = 0.5 + 0.5 * np.sin(Qh[:, 2] * 2 * np.pi / 0.008 + 3 * fbm(Qm * 120.0, 2, 3))
                h[mi] += interior[mi] * rug * 0.0006 * (Qh[:, 1] > -0.05)
                h[mi] += interior[mi] * (fbm(Qm * 1500.0, 2, 21) - 0.5) * 0.0003
            # fur: streaky clumps along the combing direction (the base under the shells)
            fs = streaks(Q, FD, 260.0, 18.0, seed=31, octaves=2)
            h += (1 - bare) * (fs - 0.5) * 0.0016
            return h

        eps = 0.0004
        h_t = (height(P + Tt * eps) - height(P - Tt * eps)) / (2 * eps)
        h_b = (height(P + Bt * eps) - height(P - Bt * eps)) / (2 * eps)
        Nd = Ns - h_t[:, None] * Tt - h_b[:, None] * Bt
        Nd /= np.linalg.norm(Nd, axis=1, keepdims=True)
        # tangent space
        nx, ny, nz = (Nd * Tt).sum(1), (Nd * Bt).sum(1), (Nd * Nn).sum(1)
        tn = np.stack([nx, ny, nz], axis=1)
        tn /= np.linalg.norm(tn, axis=1, keepdims=True)
        normal[ys[sl], xs[sl]] = tn * 0.5 + 0.5
        # ---- colour
        base_noise = fbm(P * 7.0, 3, seed=41)
        C = BP.fur_colour(P, Ns, Wt, base_noise)
        # streak / clump variation in the pelt
        st = streaks(P, FD, 180.0, 12.0, seed=51)
        st2 = streaks(P, FD, 40.0, 3.5, seed=57)
        C *= (0.84 + 0.24 * st)[:, None] * (0.92 + 0.16 * st2)[:, None]
        # skin colours
        nose_c = BP.srgb_to_lin([0.05, 0.043, 0.04]) * (0.8 + 0.4 * fbm(P * 300.0, 2, 71))[:, None]
        lip_c = BP.srgb_to_lin([0.09, 0.07, 0.065])
        gum_c = BP.srgb_to_lin([0.46, 0.25, 0.25])
        pig = BP.smoothstep(0.45, 0.62, fbm(P * 90.0, 3, 81))[:, None]
        gum_c = gum_c * (1 - pig) + BP.srgb_to_lin([0.16, 0.1, 0.1]) * pig
        Qj = BP.to_jaw(P)
        tongue = (BP.smoothstep(0.004, -0.004, np.abs(Qj[:, 0]) - 0.026) * BP.smoothstep(-0.006, 0.004, Qj[:, 1]))[:, None] * (interior[:, None])
        tongue_c = BP.srgb_to_lin([0.66, 0.38, 0.38]) * (0.85 + 0.3 * fbm(P * 400.0, 2, 91))[:, None]
        mouth_c = gum_c * (1 - tongue) + tongue_c * tongue
        pad_c = BP.srgb_to_lin([0.1, 0.085, 0.075]) * (0.8 + 0.4 * fbm(P * 200.0, 2, 95))[:, None]
        eye_c = BP.srgb_to_lin([0.05, 0.035, 0.03])
        skin = lip_c * np.ones((len(P), 1))
        skin = skin * (1 - nose[:, None]) + nose_c * nose[:, None]
        skin = skin * (1 - interior[:, None]) + mouth_c * interior[:, None]
        skin = skin * (1 - pad[:, None]) + pad_c * pad[:, None]
        skin = skin * (1 - eyem[:, None] * (1 - nose[:, None])) + eye_c * eyem[:, None] * (1 - nose[:, None])
        col = C * (1 - bare[:, None]) + skin * bare[:, None]
        albedo[ys[sl], xs[sl]] = col
        # ---- mask: AO, roughness, fur density
        cav = np.clip(AO, 0, 1) ** 1.2
        rough = 0.72 * (1 - bare) + bare * (0.62 * lip + 0.0)
        rough = np.where(nose > 0.5, 0.26 + 0.12 * fbm(P * 150.0, 2, 101), rough)
        rough = np.where(interior > 0.5, 0.3, rough)
        rough = np.where(pad > 0.5, 0.82, rough)
        rough = np.where(eyem * (1 - nose) > 0.5, 0.45, rough)
        dens = np.clip(1 - bare, 0, 1) * BP.smoothstep(0.002, 0.012, FL)
        maskt[ys[sl], xs[sl]] = np.stack([cav, rough, dens], axis=1)
        log(f'    {e}/{len(ys)}')
    albedo = dilate(albedo, valid)
    normal = dilate(normal, valid)
    maskt = dilate(maskt, valid)
    return albedo, normal, maskt, valid


# ============================================================================================ export

def write_binz(path, arrays: dict, meta: dict):
    """container: 'BRZ1' | u32 jsonLen | json | pad4 | blobs (each 4-byte aligned). gzip compressed."""
    blobs = []
    offset = 0
    entries = {}
    for name, (arr, item, norm) in arrays.items():
        a = np.ascontiguousarray(arr)
        raw = a.tobytes()
        pad = (-len(raw)) % 4
        entries[name] = {'type': str(a.dtype), 'itemSize': item, 'normalized': norm, 'offset': offset, 'count': int(a.size // item), 'byteLength': len(raw)}
        blobs.append(raw + b'\0' * pad)
        offset += len(raw) + pad
    meta = dict(meta)
    meta['arrays'] = entries
    js = json.dumps(meta, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    data = b'BRZ1' + struct.pack('<I', len(js)) + js + b''.join(blobs)
    with open(path, 'wb') as f:
        f.write(gzip.compress(data, 9, mtime=0))
    return len(data)


def save_webp(path, img_lin_or_raw, srgb=False, quality=88, size=None):
    from PIL import Image
    a = np.clip(img_lin_or_raw, 0, 1)
    if srgb:
        a = BP.lin_to_srgb(a)
    im = Image.fromarray((a * 255 + 0.5).astype(np.uint8))
    if size and size != im.width:
        im = im.resize((size, size), Image.LANCZOS)
    im.save(path, 'WEBP', quality=quality, method=6)
    return os.path.getsize(path)


# ============================================================================================ main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--h', type=float, default=0.0036)
    ap.add_argument('--tris', type=int, default=52000)
    ap.add_argument('--tex', type=int, default=2048)
    ap.add_argument('--stage', default='all')
    ap.add_argument('--lods', default='20000,8000')
    args = ap.parse_args()
    os.makedirs(CACHE, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)

    if args.stage in ('all', 'mesh'):
        prims = stage_mesh(args)
    else:
        prims = B.sculpt()
    d = np.load(os.path.join(CACHE, 'bear_lod0.npz'))
    Vd, Fd, Nd = d['V'], d['F'], d['N']

    # ---- per-vertex fields on the welded mesh
    W = skin_weights(prims, Vd, Fd)
    log('skin weights')
    A, deg = adjacency(Fd, len(Vd))
    FL = BP.fur_length(Vd, Nd, W)
    FL = smooth_field(FL, A, deg, iters=3, alpha=0.5)
    FDIR = BP.fur_flow(Vd, Nd, W)
    FDIR = smooth_field(FDIR, A, deg, iters=4, alpha=0.5)
    FDIR -= Nd * (FDIR * Nd).sum(1, keepdims=True)
    FDIR /= np.maximum(np.linalg.norm(FDIR, axis=1, keepdims=True), 1e-9)
    AO = vertex_ao(Vd, Nd, Fd)
    AO = smooth_field(AO, A, deg, iters=2, alpha=0.5)
    log('fur fields + AO')

    # ---- UV atlas
    import xatlas
    atlas = xatlas.Atlas()
    atlas.add_mesh(Vd.astype(np.float32), Fd.astype(np.uint32), Nd.astype(np.float32))
    co = xatlas.ChartOptions()
    co.max_iterations = 2
    co.max_cost = 2.5
    co.normal_deviation_weight = 1.5
    co.roundness_weight = 0.02
    co.straightness_weight = 4.0
    po = xatlas.PackOptions()
    po.resolution = args.tex
    po.padding = 6
    po.bilinear = True
    po.rotate_charts = True
    atlas.generate(co, po)
    vmap, Fuv, UV = atlas.get_mesh(0)
    vmap = vmap.astype(np.int64)
    Fuv = Fuv.reshape(-1, 3).astype(np.int64)
    log(f'xatlas: {atlas.chart_count} charts, {len(vmap)} verts (from {len(Vd)}), utilization {atlas.utilization[0] if hasattr(atlas.utilization, "__len__") else atlas.utilization}')
    V = Vd[vmap]
    N = Nd[vmap]
    Wv = W[vmap]
    FLv = FL[vmap]
    FDv = FDIR[vmap]
    AOv = AO[vmap]
    UV = UV.astype(np.float64)
    T, Tw = compute_tangents(V, N, UV, Fuv)
    # texel density -> metres per UV unit
    a3 = 0.5 * np.linalg.norm(np.cross(V[Fuv[:, 1]] - V[Fuv[:, 0]], V[Fuv[:, 2]] - V[Fuv[:, 0]]), axis=1).sum()
    e1, e2 = UV[Fuv[:, 1]] - UV[Fuv[:, 0]], UV[Fuv[:, 2]] - UV[Fuv[:, 0]]
    a2 = 0.5 * np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]).sum()
    m_per_uv = math.sqrt(a3 / a2)
    log(f'surface {a3:.3f} m2, uv area {a2:.3f}, {m_per_uv:.3f} m per uv unit')

    # fur direction in tangent space
    Bt = np.cross(N, T) * Tw[:, None]
    fdx = (FDv * T).sum(1)
    fdy = (FDv * Bt).sum(1)

    # ---- LODs (meshoptimizer, seam aware)
    tmp_in = os.path.join(CACHE, 'lod_in.bin')
    tmp_out = os.path.join(CACHE, 'lod_out.bin')
    with open(tmp_in, 'wb') as f:
        f.write(struct.pack('<II', len(V), Fuv.size))
        f.write(V.astype(np.float32).tobytes())
        f.write(Fuv.astype(np.uint32).tobytes())
    env = dict(os.environ, NODE_PATH=NODE_PATH)
    r = subprocess.run(['node', os.path.join(HERE, 'meshopt_lod.mjs'), tmp_in, tmp_out, args.lods, '0.08'], capture_output=True, text=True, env=env, cwd=HERE)
    print(r.stdout, r.stderr)
    raw = open(tmp_out, 'rb').read()
    lods = [Fuv]
    p = 0
    while p < len(raw):
        (cnt,) = struct.unpack_from('<I', raw, p)
        p += 4
        lods.append(np.frombuffer(raw, dtype=np.uint32, count=cnt, offset=p).reshape(-1, 3).astype(np.int64))
        p += cnt * 4
    log('LOD tris: ' + ', '.join(str(len(l)) for l in lods))

    def furred(Fx):
        m = FLv[Fx].max(1) > 0.004
        return Fx[m]

    # ---- extras
    ex = build_extras(prims)
    log(f'extras: {len(ex["V"])} verts {len(ex["F"])} tris')

    # ---- bake
    mesh = {'V': V, 'N': N, 'T': T, 'Tw': Tw, 'UV': UV, 'F': Fuv, 'W': Wv, 'fur_len': FLv, 'fur_dir': FDv, 'ao': AOv}
    if args.stage in ('all', 'bake'):
        albedo, normal, maskt, valid = bake(prims, mesh, args.tex)
        np.savez_compressed(os.path.join(CACHE, 'bake.npz'), albedo=albedo.astype(np.float32), normal=normal.astype(np.float32), mask=maskt.astype(np.float32))
        sizes = {}
        for res, tag in ((args.tex, '2k'), (args.tex // 2, '1k')):
            sizes[f'albedo_{tag}'] = save_webp(os.path.join(OUT, f'bear_albedo_{tag}.webp'), albedo, srgb=True, quality=90, size=res)
            sizes[f'normal_{tag}'] = save_webp(os.path.join(OUT, f'bear_normal_{tag}.webp'), normal, quality=92, size=res)
            sizes[f'mask_{tag}'] = save_webp(os.path.join(OUT, f'bear_mask_{tag}.webp'), maskt, quality=90, size=res)
        log('textures: ' + ', '.join(f'{k} {v / 1024:.0f}KB' for k, v in sizes.items()))
        import fur_textures
        fur_textures.save(fur_textures.strands(), 'fur_strands.png')
        fur_textures.save(fur_textures.clumps(), 'fur_clumps.png')
        log('fur strand / clump textures')

    # ---- export mesh
    si, sw = quantize_weights(Wv)
    exi = np.zeros((len(ex['V']), 4), dtype=np.uint8)
    exi[:, 0] = ex['bone']
    exw = np.zeros((len(ex['V']), 4), dtype=np.uint8)
    exw[:, 0] = 255

    def i8(x):
        return np.clip(np.round(x * 127), -127, 127).astype(np.int8)

    nrm4 = np.zeros((len(V), 4), dtype=np.int8)
    nrm4[:, :3] = i8(N)
    tan4 = np.zeros((len(V), 4), dtype=np.int8)
    tan4[:, :3] = i8(T)
    tan4[:, 3] = np.where(Tw < 0, -127, 127)
    uvq = np.clip(np.round(UV * 65535), 0, 65535).astype(np.uint16)
    fur = np.zeros((len(V), 4), dtype=np.uint8)
    fur[:, 0] = np.clip(np.round((fdx * 0.5 + 0.5) * 255), 0, 255)
    fur[:, 1] = np.clip(np.round((fdy * 0.5 + 0.5) * 255), 0, 255)
    FUR_MAX = 0.13
    fur[:, 2] = np.clip(np.round(FLv / FUR_MAX * 255), 0, 255)
    fur[:, 3] = np.clip(np.round(AOv * 255), 0, 255)
    exn = np.zeros((len(ex['V']), 4), dtype=np.int8)
    exn[:, :3] = i8(ex['N'])
    idx_t = np.uint16 if len(V) < 65536 else np.uint32
    arrays = {
        'position': (V.astype(np.float32), 3, False),
        'normal': (nrm4, 4, True),
        'tangent': (tan4, 4, True),
        'uv': (uvq, 2, True),
        'skinIndex': (si, 4, False),
        'skinWeight': (sw, 4, True),
        'fur': (fur, 4, True),
    }
    meta_lods = []
    for i, Fx in enumerate(lods):
        arrays[f'index{i}'] = (Fx.astype(idx_t).ravel(), 1, False)
        fs = furred(Fx)
        arrays[f'shell{i}'] = (fs.astype(idx_t).ravel(), 1, False)
        meta_lods.append({'tris': int(len(Fx)), 'shellTris': int(len(fs))})
    arrays['exPosition'] = (ex['V'].astype(np.float32), 3, False)
    arrays['exNormal'] = (exn, 4, True)
    arrays['exSkinIndex'] = (exi, 4, False)
    arrays['exSkinWeight'] = (exw, 4, True)
    arrays['exAux'] = (ex['aux'].astype(np.float32), 4, False)
    arrays['exIndex'] = (ex['F'].astype(np.uint16).ravel(), 1, False)
    raw_len = write_binz(os.path.join(OUT, 'bear_mesh.binz'), arrays, {'lods': meta_lods, 'furMax': FUR_MAX})
    log(f'bear_mesh.binz: raw {raw_len / 1024:.0f}KB, gz {os.path.getsize(os.path.join(OUT, "bear_mesh.binz")) / 1024:.0f}KB')

    # ---- rig json
    bones = []
    for name, parent in B.BONES:
        bones.append({'name': name, 'parent': parent, 'pos': [round(float(x), 5) for x in B.J[name]]})
    rig = {
        'version': 1,
        'bones': bones,
        'sockets': {k: {'bone': v[0], 'pos': [round(float(x), 5) for x in v[1]]} for k, v in B.SOCKETS.items()},
        'headPitch': B.HEAD_PITCH,
        'jawRest': B.JAW_REST,
        'metersPerUV': m_per_uv,
        'furMax': FUR_MAX,
        'lods': meta_lods,
        'extrasTris': int(len(ex['F'])),
        'bounds': {'min': [float(x) for x in V.min(0)], 'max': [float(x) for x in V.max(0)]},
    }
    with open(os.path.join(OUT, 'bear.json'), 'w') as f:
        json.dump(rig, f, indent=1)
    log('done')


if __name__ == '__main__':
    main()
