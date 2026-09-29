#!/usr/bin/env python3
"""
Procedural skin texture baker for the DAVID humans (MakeHuman hm08 UV layout).

    python3 tools/human/bake_skin.py [--size 2048] [--common] [preset ...]

For every texel of the UV layout we know the 3D surface point (bind pose, metres), its normal, its rest-pose
position (arms down), skin weights (anatomical regions) and a set of anatomical masks derived from MakeHuman's
own modelling targets (lips, nostrils, nose tip, ears, cheeks, eye bags, lid folds, laugh lines, nipples,
navel, chin, temples...).  From that we paint, physically motivated:

  albedo  : melanin (base tone + sun tan with tan lines from the preset's clothing), haemoglobin (ruddy "admoni"
            flush of cheeks/nose/ears/lips/knuckles/knees/palms/soles), freckles & moles, veins, beard shadow,
            painted scalp & eyebrow density under the strand hair, lips, nails, areolae, eye sockets / mouth
            interior, dust on feet & hands, fine body-hair tone.
  normal  : tangent-space from a height field (lip lines, knuckle & joint creases, palm creases, raised veins,
            forehead / crow's-feet / laugh lines scaled by age, areola bumps, fine skin relief).
  mask    : R ambient occlusion (embree ray-cast) x cavity, G roughness, B thickness (ray-cast through the
            body -> translucency), A pore strength.

Common textures (--common): tiling pore/micro-wrinkle detail normal, eye (sclera + iris) textures.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_human import Human, build_body_tiers, eye_data, lid_margin, landmarks, NBODY, OUT, uv_islands  # noqa: E402
from mh_data import load_target  # noqa: E402
from texnoise import gnoise, fbm, ridged, smoothstep  # noqa: E402

COMMON = os.path.join(OUT, "common")


def srgb_to_lin(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


REGIONS = {
    "head": lambda n: n in ("head", "jaw") or n.startswith(("eye.", "special", "oris", "levator", "orbicularis", "oculi", "temporalis", "risorius")),
    "neck": lambda n: n.startswith("neck"),
    "torso": lambda n: n.startswith(("spine", "clavicle")) or n == "root",
    "pelvis": lambda n: n.startswith("pelvis"),
    "uarm": lambda n: n.startswith(("shoulder01", "upperarm")),
    "farm": lambda n: n.startswith("lowerarm"),
    "hand": lambda n: n.startswith(("wrist", "metacarpal", "finger")),
    "thigh": lambda n: n.startswith("upperleg"),
    "shin": lambda n: n.startswith("lowerleg"),
    "foot": lambda n: n.startswith(("foot", "toe")),
}


# painted scalp hairline: height above the eye centres (m) vs the angle around the head (deg, 0 = front, 180 = back)
HAIRLINE_PHI = [0, 30, 45, 62, 72, 80, 100, 120, 140, 180]
HAIRLINE_HL = [0.072, 0.07, 0.064, 0.052, 0.036, -0.04, -0.028, -0.05, -0.08, -0.09]


class Baker:
    def __init__(self, preset_name: str, size: int):
        t0 = time.time()
        self.name = preset_name
        self.size = size
        self.preset = json.load(open(os.path.join(HERE, "presets", f"{preset_name}.json"), encoding="utf-8"))
        self.skin = self.preset.get("skin", {})
        self.rng = np.random.default_rng(self.skin.get("seed", 1))
        h = self.h = Human(self.preset)
        T, S = build_body_tiers(h, (0, 1))
        self.sub = T["sub1"]
        self.S1 = S["sub1"]
        P, tri_p, Nw = self.sub.welded
        self.P, self.N = P, Nw
        self.Wd = np.asarray(self.S1 @ h.Wd[:NBODY], np.float32)
        # rest-pose positions (arms down) for tan lines & limb-aligned patterns
        self.R = self.skin_rest(P)
        # region weights per welded vertex
        names = h.names
        self.reg = {}
        for k, f in REGIONS.items():
            cols = [i for i, n in enumerate(names) if f(n)]
            self.reg[k] = self.Wd[:, cols].sum(1)
        self.eyes = eye_data(h)
        self.lm = landmarks(h)
        self.E = (self.eyes["L"]["center"] + self.eyes["R"]["center"]) / 2
        print(f"  setup {time.time() - t0:.1f}s")

    # ------------------------------------------------------------------ geometry helpers
    def skin_rest(self, P):
        h = self.h
        out = np.zeros_like(P)
        for i in range(len(h.names)):
            w = self.Wd[:, i]
            nz = np.nonzero(w > 1e-5)[0]
            if len(nz) == 0:
                continue
            out[nz] += (h.rest_world_rot[i].apply(P[nz] - h.heads[i]) + h.rest_world_pos[i]) * w[nz, None]
        return out

    def target_mask(self, rel, power=1.0):
        """Per welded vertex mask (0..1) from a MakeHuman target's displacement magnitude."""
        t = load_target(rel + ".target")
        m = np.zeros(len(self.h.v_all))
        if t is not None:
            m[t[0]] = np.linalg.norm(t[1], axis=1)
        m = m[:NBODY]
        m = m / (m.max() + 1e-12)
        return np.clip(np.asarray(self.S1 @ m), 0, 1) ** power

    # ------------------------------------------------------------------ rasterisation
    def rasterize(self):
        t0 = time.time()
        S = self.size
        sub = self.sub
        uv = sub.uv
        tris = sub.tris
        tid = np.full((S, S), -1, np.int32)
        bary = np.zeros((S, S, 3), np.float32)
        px = uv[:, 0] * S - 0.5
        py = (1 - uv[:, 1]) * S - 0.5
        X = px[tris]
        Y = py[tris]
        x0 = np.clip(np.floor(X.min(1)).astype(int), 0, S - 1)
        x1 = np.clip(np.ceil(X.max(1)).astype(int), 0, S - 1)
        y0 = np.clip(np.floor(Y.min(1)).astype(int), 0, S - 1)
        y1 = np.clip(np.ceil(Y.max(1)).astype(int), 0, S - 1)
        for t in range(len(tris)):
            gx, gy = np.meshgrid(np.arange(x0[t], x1[t] + 1), np.arange(y0[t], y1[t] + 1))
            ax, bx, cx = X[t]
            ay, by, cy = Y[t]
            den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(den) < 1e-12:
                continue
            w0 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / den
            w1 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / den
            w2 = 1 - w0 - w1
            m = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
            if not m.any():
                continue
            yy, xx = gy[m], gx[m]
            tid[yy, xx] = t
            bary[yy, xx, 0] = w0[m]
            bary[yy, xx, 1] = w1[m]
            bary[yy, xx, 2] = w2[m]
        self.valid = tid >= 0
        self.vy, self.vx = np.nonzero(self.valid)
        self.tid = tid[self.valid]
        self.bary = bary[self.valid]
        self.widx = sub.posidx[tris[self.tid]]  # (n,3) welded indices
        # island id per texel
        lab = self._render_islands()
        self.island = lab[self.tid]
        # per-texel world scale (metres per uv unit along u and v) from the triangle jacobian
        p = self.P
        a, b, c = self.widx[:, 0], self.widx[:, 1], self.widx[:, 2]
        t_uv = uv[tris[self.tid]]
        e1, e2 = p[b] - p[a], p[c] - p[a]
        d1, d2 = t_uv[:, 1] - t_uv[:, 0], t_uv[:, 2] - t_uv[:, 0]
        r = d1[:, 0] * d2[:, 1] - d2[:, 0] * d1[:, 1]
        r = np.where(np.abs(r) < 1e-14, 1e-14, r)
        dPdu = (e1 * d2[:, 1:2] - e2 * d1[:, 1:2]) / r[:, None]
        dPdv = (e2 * d1[:, 0:1] - e1 * d2[:, 0:1]) / r[:, None]
        self.mpu = np.linalg.norm(dPdu, axis=1)  # metres per uv unit
        self.mpv = np.linalg.norm(dPdv, axis=1)
        self.dPdu, self.dPdv = dPdu.astype(np.float32), dPdv.astype(np.float32)
        print(f"  raster {S}: {len(self.tid)} texels in {time.time() - t0:.1f}s")
        # per-texel geometry
        self.tp = self.interp(self.P)
        n = self.interp(self.N)
        self.tn = n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)
        self.tr = self.interp(self.R)
        self.treg = {k: self.interp(v) for k, v in self.reg.items()}

    def _render_islands(self):
        from scipy.sparse.csgraph import connected_components
        import scipy.sparse as sp
        tris = self.sub.tris
        n = len(tris)
        nv = len(self.sub.uv)
        rows = np.repeat(np.arange(n), 3)
        A = sp.coo_matrix((np.ones(3 * n), (rows, tris.ravel() + n)), shape=(n + nv, n + nv))
        _, lab = connected_components(A + A.T, directed=False)
        lab = lab[:n]
        # name the islands by their uv bounding box centre
        uvc = self.sub.uv[tris].mean(1)
        names = np.zeros(n, np.int32)
        for l in np.unique(lab):
            m = lab == l
            u, v = uvc[m].mean(0)
            cnt = m.sum()
            if cnt > 20000:
                k = 1 if u < 0.6 else 2  # 1 body, 2 head
            elif 0.75 < u < 0.93 and v < 0.15:
                k = 3  # mouth interior
            elif u < 0.16 and 0.5 < v < 0.66:
                k = 4  # eye socket pocket
            elif v < 0.2 and 0.35 < u < 0.77:
                k = 5  # hands
            elif v < 0.2 and u < 0.37:
                k = 6  # feet
            else:
                k = 1
            names[m] = k
        return names

    def interp(self, vals):
        v = np.asarray(vals)
        if v.ndim == 1:
            return np.sum(v[self.widx] * self.bary, 1).astype(np.float32)
        return np.einsum("nk,nkc->nc", self.bary, v[self.widx]).astype(np.float32)

    def image(self, vals, fill=0.0):
        vals = np.asarray(vals, np.float32)
        S = self.size
        if vals.ndim == 1:
            img = np.full((S, S), fill, np.float32)
        else:
            img = np.full((S, S, vals.shape[1]), fill, np.float32)
        img[self.vy, self.vx] = vals
        return img

    def dilate(self, img, it=12):
        """Grow valid texels outward (so mip-maps / bilinear lookups never see the background)."""
        valid = self.valid.copy()
        img = img.copy()
        for _ in range(it):
            if img.ndim == 2:
                acc = np.zeros_like(img)
            else:
                acc = np.zeros_like(img)
            cnt = np.zeros(valid.shape, np.float32)
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                sv = np.roll(np.roll(valid, dy, 0), dx, 1)
                si = np.roll(np.roll(img, dy, 0), dx, 1)
                if img.ndim == 2:
                    acc += np.where(sv, si, 0)
                else:
                    acc += np.where(sv[..., None], si, 0)
                cnt += sv
            grow = (~valid) & (cnt > 0)
            if img.ndim == 2:
                img[grow] = acc[grow] / cnt[grow]
            else:
                img[grow] = acc[grow] / cnt[grow][:, None]
            valid = valid | grow
        return img

    # ------------------------------------------------------------------ ray-cast AO and thickness (embree)
    def ao_thickness(self):
        t0 = time.time()
        import trimesh
        from trimesh.ray.ray_pyembree import RayMeshIntersector
        P, tri, N = self.sub.welded
        mesh = trimesh.Trimesh(P, tri, process=False)
        ri = RayMeshIntersector(mesh)
        rng = np.random.default_rng(5)
        nv = len(P)
        K = 48
        # cosine-weighted hemisphere directions (shared set, rotated per vertex by the normal frame)
        u1, u2 = rng.random(K), rng.random(K)
        r = np.sqrt(u1)
        th = 2 * np.pi * u2
        local = np.stack([r * np.cos(th), r * np.sin(th), np.sqrt(1 - u1)], 1)
        tangent = np.cross(N, np.array([0.0, 1.0, 0.0]))
        bad = np.linalg.norm(tangent, axis=1) < 1e-3
        tangent[bad] = np.cross(N[bad], np.array([1.0, 0.0, 0.0]))
        tangent /= np.linalg.norm(tangent, axis=1, keepdims=True)
        bit = np.cross(N, tangent)
        maxd = 0.12
        occ = np.zeros(nv)
        chunk = 6000
        for s in range(0, nv, chunk):
            e = min(nv, s + chunk)
            n = e - s
            d = (local[None, :, 0:1] * tangent[s:e, None] + local[None, :, 1:2] * bit[s:e, None] + local[None, :, 2:3] * N[s:e, None]).reshape(-1, 3)
            o = np.repeat(P[s:e] + N[s:e] * 0.0006, K, 0)
            loc, ir, _ = ri.intersects_location(o, d, multiple_hits=False)
            dist = np.full(n * K, np.inf)
            dist[ir] = np.linalg.norm(loc - o[ir], axis=1)
            w = np.clip(1 - dist / maxd, 0, 1) ** 0.7
            occ[s:e] = w.reshape(n, K).mean(1)
        ao = np.clip(1 - occ * 1.15, 0, 1)
        # thickness: rays into the body within a 35 degree cone around -N; first exit distance
        K2 = 12
        u1, u2 = rng.random(K2), rng.random(K2)
        ct = 1 - u1 * (1 - np.cos(np.deg2rad(35)))
        st = np.sqrt(1 - ct * ct)
        ph = 2 * np.pi * u2
        loc2 = np.stack([st * np.cos(ph), st * np.sin(ph), -ct], 1)
        thick = np.zeros(nv)
        for s in range(0, nv, chunk):
            e = min(nv, s + chunk)
            n = e - s
            d = (loc2[None, :, 0:1] * tangent[s:e, None] + loc2[None, :, 1:2] * bit[s:e, None] + loc2[None, :, 2:3] * N[s:e, None]).reshape(-1, 3)
            o = np.repeat(P[s:e] - N[s:e] * 0.0004, K2, 0)
            loc, ir, _ = ri.intersects_location(o, d, multiple_hits=False)
            dist = np.full(n * K2, 0.2)
            dist[ir] = np.linalg.norm(loc - o[ir], axis=1)
            thick[s:e] = np.median(dist.reshape(n, K2), 1)
        self.v_ao = ao
        self.v_thick = thick
        print(f"  ao/thickness {time.time() - t0:.1f}s  ao mean {ao.mean():.2f}")

    # ------------------------------------------------------------------ lips (vermilion) from the mouth seam
    def lip_mask(self):
        """Vermilion mask built around the lips' contact line (the seam between the face and the mouth-interior
        UV island): upper lip ~Hu tall with a cupid's bow, lower lip ~Hl, both tapering into the commissures.
        Returns (vermilion 0..1, contact-line 0..1, lateral coordinate normalised to the half mouth width)."""
        from collections import defaultdict
        h = self.h
        obj = h.obj
        bf = obj.group_faces("body")
        q = obj.faces[bf]
        lab = uv_islands(obj, bf)
        mc = (np.array(self.lm["chin"]) + np.array(self.lm["noseTip"])) / 2
        fc = h.v_all[q].mean(1)
        near = np.linalg.norm(fc - (mc + np.array([0, 0, -0.01])), axis=1) < 0.02
        cand = np.unique(lab[near])
        mouth = lab == min(cand, key=lambda l: (lab == l).sum())
        ef = defaultdict(list)
        for fi, quad in enumerate(q):
            for k in range(4):
                a, b = quad[k], quad[(k + 1) % 4]
                ef[(min(a, b), max(a, b))].append(fi)
        verts = np.unique(np.array([e for e, fs in ef.items() if len(fs) == 2 and mouth[fs[0]] != mouth[fs[1]]]).ravel())
        L = h.v_all[verts]
        W = np.abs(L[:, 0]).max()
        sk = self.skin
        Hu = float(sk.get("lip_upper", 0.0082))
        Hl = float(sk.get("lip_lower", 0.0098))
        p = self.tp
        out = np.zeros(len(p), np.float32)
        seam = np.zeros(len(p), np.float32)
        xs = np.zeros(len(p), np.float32)
        idx = np.nonzero((np.linalg.norm(p - L.mean(0), axis=1) < 0.035) & (self.treg["head"] > 0.3) & (self.island != 3))[0]
        from scipy.spatial import cKDTree
        d, j = cKDTree(L).query(p[idx])
        x = p[idx, 0]
        t = np.clip(np.abs(x) / W, 0, 1)
        above = p[idx, 1] > L[j, 1] + 0.0002
        bow = 1 - 0.16 * np.exp(-(x / 0.0028) ** 2) + 0.07 * np.exp(-((np.abs(x) - 0.0068) / 0.0032) ** 2)
        hu = Hu * np.clip(1 - t ** 2.4, 0, 1) ** 0.55 * bow
        hl = Hl * np.clip(1 - t ** 2.0, 0, 1) ** 0.5
        hh = np.where(above, hu, hl)
        m = smoothstep(hh + 0.0006, hh - 0.0008, d) * smoothstep(1.02, 0.9, t)
        out[idx] = m
        seam[idx] = np.exp(-(d / 0.0011) ** 2) * smoothstep(1.05, 0.7, t)
        xs[idx] = t
        return out, seam, xs

    # ------------------------------------------------------------------ form definition (geometry unsharp mask)
    def definition(self, iters=24):
        """Mid-frequency form of the body itself (muscle bellies, separations, bony landmarks): vertex normal minus
        the normal of a Taubin-smoothed copy (volume preserving, ~4-6 cm kernel).  Added to the normal map so the
        anatomy MakeHuman models only faintly reads under grazing sun light."""
        import scipy.sparse as sp
        from geom import vertex_normals
        P, tri, N = self.sub.welded
        V = len(P)
        i = np.concatenate([tri[:, 0], tri[:, 1], tri[:, 2], tri[:, 1], tri[:, 2], tri[:, 0]])
        j = np.concatenate([tri[:, 1], tri[:, 2], tri[:, 0], tri[:, 0], tri[:, 1], tri[:, 2]])
        A = sp.coo_matrix((np.ones(len(i)), (i, j)), shape=(V, V)).tocsr()
        A.data[:] = 1.0
        L = sp.diags(1.0 / np.asarray(A.sum(1)).ravel()) @ A
        Ps = P.copy()
        for _ in range(iters):
            Ps = Ps + 0.5 * (L @ Ps - Ps)
            Ps = Ps - 0.53 * (L @ Ps - Ps)
        Ns = vertex_normals(Ps, tri)
        D = N - Ns
        d = self.interp(D)
        n = self.tn
        T = self.dPdu - n * np.sum(n * self.dPdu, 1, keepdims=True)
        T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-12
        B = np.cross(n, T)
        B *= np.where(np.sum(B * self.dPdv, 1) < 0, -1.0, 1.0)[:, None]
        self.def_xy = np.stack([np.sum(d * T, 1), np.sum(d * B, 1)], 1).astype(np.float32)

    # ------------------------------------------------------------------ painting
    def _tick(self, label):
        now = time.time()
        if os.environ.get("BAKE_PROFILE"):
            print(f"    {label}: {now - self._t:.1f}s")
        self._t = now

    def paint(self):
        t0 = time.time()
        self._t = t0
        sk = self.skin
        rng = self.rng
        seed = int(sk.get("seed", 1))
        p, n, rp = self.tp, self.tn, self.tr
        R = self.treg
        isl = self.island
        head = R["head"]
        E = self.E
        f = p - E  # face frame (bind): x lateral(+L), y up, z forward
        ntex = len(p)
        # ---------------- anatomical masks (per texel)
        tm = lambda rel, pw=1.0: self.interp(self.target_mask(rel, pw))  # noqa: E731
        m_lips_u = tm("mouth/mouth-upperlip-volume-incr")
        m_lips_l = tm("mouth/mouth-lowerlip-volume-incr")
        m_nostril = tm("nose/nose-nostrils-width-incr")
        m_nosetip = tm("nose/nose-point-width-incr")
        m_nose = tm("nose/nose-scale-horiz-incr")
        m_ear = np.maximum(tm("ears/l-ear-scale-incr"), tm("ears/r-ear-scale-incr"))
        m_lobe = np.maximum(tm("ears/l-ear-lobe-incr"), tm("ears/r-ear-lobe-incr"))
        m_cheek = np.maximum(tm("cheek/l-cheek-volume-incr"), tm("cheek/r-cheek-volume-incr"))
        m_cheekbone = np.maximum(tm("cheek/l-cheek-bones-incr"), tm("cheek/r-cheek-bones-incr"))
        m_bag = np.maximum(tm("eyes/l-eye-bag-incr"), tm("eyes/r-eye-bag-incr"))
        m_fold = np.maximum(tm("eyes/l-eye-eyefold-convex"), tm("eyes/r-eye-eyefold-convex"))
        m_laugh = tm("mouth/mouth-laugh-lines-in")
        m_chin = tm("chin/chin-prominent-incr")
        m_philtrum = tm("mouth/mouth-philtrum-volume-incr")
        m_nipple = tm("breast/nipple-size-incr")
        m_navel = tm("stomach/stomach-navel-in")
        m_temple = tm("forehead/forehead-temple-incr")
        # lip vermilion: target masks are soft; sharpen into a vermilion shape with a crisp border
        lips_raw = np.maximum(m_lips_u, m_lips_l)
        # ear masks include the scalp behind the ear; keep the ear itself (thin parts / lateral)
        self._tick("before regions")
        # ---------------- regions
        body_isl = (isl == 1) | (isl == 5) | (isl == 6) | (isl == 2)
        mouth_isl = isl == 3
        pocket_isl = isl == 4
        hand = R["hand"]
        foot = R["foot"]
        farm, uarm, shin, thigh, torso, neck = R["farm"], R["uarm"], R["shin"], R["thigh"], R["torso"], R["neck"]
        # palm / dorsal per hand (bind pose)
        palm_side = np.zeros(ntex, np.float32)
        h = self.h
        J = h.joint
        for s, S in ((1, "L"), (-1, "R")):
            wr = J(f"wrist.{S}____head")
            mid = J(f"finger3-1.{S}____head")
            idx = J(f"finger2-1.{S}____head")
            pky = J(f"finger5-1.{S}____head")
            fdir = mid - wr
            rdir = idx - pky
            palm = s * np.cross(fdir, rdir)
            palm /= np.linalg.norm(palm)
            side = (p[:, 0] * s) > 0.25
            palm_side = np.where(side, n @ palm, palm_side)
        palm_m = hand * smoothstep(0.05, 0.45, palm_side)
        dorsal_m = hand * smoothstep(0.1, 0.5, -palm_side)
        sole_m = foot * smoothstep(0.35, 0.75, -n[:, 1])
        self._tick("before sun exposure")
        # ---------------- sun exposure (tan) incl. clothing tan lines, from rest-pose positions
        shoulder_y = h.rest_world_pos[h.index["upperarm01.L"]][1]
        knee_y = h.rest_world_pos[h.index["lowerleg01.L"]][1]
        ankle_y = h.rest_world_pos[h.index["foot.L"]][1]
        wrist_y = h.rest_world_pos[h.index["wrist.L"]][1]
        neck_y = h.rest_world_pos[h.index["neck01"]][1]
        ry = rp[:, 1]
        tl = sk.get("tan_lines", "tunic_short")
        noise_edge = fbm(rp * 60.0, 2, seed=seed + 3) * 0.012
        if tl == "robe":
            sleeve = smoothstep(wrist_y + 0.05, wrist_y + 0.02, ry + noise_edge)
            hem = smoothstep(ankle_y + 0.12, ankle_y + 0.06, ry + noise_edge)
            vneck = smoothstep(neck_y - 0.02, neck_y + 0.01, ry) * (rp[:, 2] > -0.02)
        else:
            # loose tunic: the sleeve and hem move, so the tan lines are soft and ragged
            sleeve = smoothstep(shoulder_y - 0.08, shoulder_y - 0.17, ry + noise_edge * 2.0)
            hem = smoothstep(knee_y + 0.15, knee_y + 0.05, ry + noise_edge * 2.0)
            vd = neck_y - ry  # depth below neck base
            vw = np.clip(0.07 - vd * 0.35, 0, 1)
            vneck = smoothstep(0.0, 0.012, vw - np.abs(rp[:, 0])) * smoothstep(0.16, 0.12, vd) * (rp[:, 2] > 0.0) + smoothstep(neck_y - 0.03, neck_y + 0.0, ry)
        expo = np.clip(head + neck * np.maximum(smoothstep(neck_y - 0.05, neck_y, ry), 0.5) + hand + farm * (1 if tl != "robe" else 0)
                       + foot + shin * (1 if tl != "robe" else 0.0), 0, 1)
        expo = np.maximum(expo, (uarm + farm) * sleeve)
        expo = np.maximum(expo, (thigh + shin) * hem)
        expo = np.maximum(expo, (torso + neck) * np.clip(vneck, 0, 1))
        expo = np.clip(expo, 0, 1)
        expo *= np.where(palm_m > 0.3, 0.35, 1.0)  # palms don't tan
        expo *= 1 - 0.7 * sole_m
        # under-chin / neck-underside less exposed
        expo *= 1 - 0.35 * smoothstep(-0.2, -0.7, n[:, 1]) * (head + neck)
        self._tick("before melanin")
        # ---------------- melanin / base tone (linear)
        tone = srgb_to_lin(sk.get("tone", [0.64, 0.45, 0.33]))
        pale = srgb_to_lin(np.clip(np.array(sk.get("tone", [0.64, 0.45, 0.33])) * np.array([1.05, 1.06, 1.08]), 0, 1))
        tan_amt = sk.get("tan", 0.5)
        tanned = tone * np.array([0.84, 0.79, 0.75]) ** (tan_amt * 1.5)
        mel = np.clip(expo, 0, 1)[:, None]
        col = pale * (1 - mel) + tanned * mel
        # large-scale tone variation (mottling), subtle
        mott = fbm(p * 9.0, 4, seed=seed + 11)
        mott2 = fbm(p * 45.0, 3, seed=seed + 12)
        col *= (1 + 0.1 * mott[:, None] * np.array([1.0, 1.1, 1.25]) + 0.05 * mott2[:, None])
        # hue drift: ruddier vs more olive/yellow patches (1-3 cm)
        hue = fbm(p * 30.0, 3, seed=seed + 15)
        col *= np.exp(-0.06 * hue[:, None] * np.array([-0.5, 0.4, 1.0]))
        # mid-frequency blotches (3-6 mm) and fine grain (~1 mm): living skin is never flat
        mid = fbm(p * 220.0, 3, seed=seed + 13)
        grain = fbm(p * 900.0, 2, seed=seed + 14)
        col *= (1 + 0.08 * mid[:, None] * np.array([0.85, 1.08, 1.25]) + 0.03 * grain[:, None])
        self._tick("before haemoglobin")
        # ---------------- haemoglobin: ruddiness ("admoni")
        ruddy = sk.get("ruddy", 0.4)
        red = (0.95 * m_cheek ** 0.8 * smoothstep(-0.02, 0.2, n[:, 2]) + 0.8 * np.maximum(m_nosetip, m_nostril * 0.8) + 0.25 * m_nose
               + 0.75 * m_ear * smoothstep(0.03, 0.06, np.abs(f[:, 0])) + 0.6 * m_lobe + 0.35 * m_chin + 0.3 * m_cheekbone
               + 0.25 * m_bag * float(sk.get("age", 0.0)))  # red lower lids read as tired / sore eyes on the young
        red += head * 0.1 * smoothstep(-0.12, 0.02, f[:, 1]) * smoothstep(0.0, 0.3, n[:, 2])  # whole face slightly flushed
        # forehead mild
        red += head * 0.12 * smoothstep(0.02, 0.06, f[:, 1]) * smoothstep(0.1, 0.5, n[:, 2]) * (0.6 + 0.4 * fbm(p * 25, 2, seed=seed + 4))
        # knuckles, fingertips, palms, elbows, knees, heels, toes
        bind_heads = h.heads
        def near_joint(names, r, dorsal=None, w=1.0):
            out = np.zeros(ntex, np.float32)
            for nm in names:
                if nm not in h.index:
                    continue
                c = bind_heads[h.index[nm]]
                d = np.linalg.norm(p - c, axis=1)
                v = np.exp(-(d / r) ** 2)
                out = np.maximum(out, v)
            if dorsal is not None:
                out *= dorsal
            return out * w
        fingers = [f"finger{k}-{j}.{S}" for k in range(1, 6) for j in (1, 2, 3) for S in "LR"]
        knuckle = near_joint(fingers, 0.009, dorsal_m + 0.4 * palm_m)
        tips = hand * np.clip(sum(near_joint([f"finger{k}-3.{S}" for S in "LR"], 0.014) for k in range(1, 6)), 0, 1)
        elbow = near_joint(["lowerarm01.L", "lowerarm01.R"], 0.035)
        knee = near_joint(["lowerleg01.L", "lowerleg01.R"], 0.05)
        red += 0.55 * knuckle + 0.4 * tips + 0.35 * palm_m + 0.25 * elbow + 0.3 * knee * smoothstep(0.0, 0.5, n[:, 2])
        red += foot * (0.35 * smoothstep(-0.02, 0.04, -f[:, 2] * 0) + 0.25)  # feet generally pinker
        red *= 0.65 + 0.35 * (fbm(p * 30.0, 3, seed=seed + 7) * 0.5 + 0.5)
        speck = smoothstep(0.35, 0.75, fbm(p * 520.0, 2, seed=seed + 8)) * np.clip(m_nose + m_nosetip + m_cheek * 0.8 + m_chin * 0.4, 0, 1)
        red += 0.35 * speck
        red = np.clip(red, 0, 1.3) * (0.25 + 0.45 * ruddy)
        # haemoglobin absorbs green & blue (Beer-Lambert in linear RGB): pinkish-red flush, not orange
        col = col * np.exp(-red[:, None] * np.array([-0.03, 0.22, 0.14]))
        # face zoning: forehead a little yellower (thicker skin, less blood), temples/jawline a little cooler
        fz = head * smoothstep(0.015, 0.045, f[:, 1]) * smoothstep(0.1, 0.5, n[:, 2])
        col = col * (1 + fz[:, None] * np.array([0.015, 0.01, -0.05]))
        jz = head * smoothstep(0.03, 0.06, np.abs(f[:, 0])) * smoothstep(-0.02, -0.06, f[:, 1])
        col = col * (1 + jz[:, None] * np.array([-0.03, -0.01, 0.02]))
        self._tick("before palms & soles")
        # ---------------- palms & soles: less melanin, more yellow-pink
        pl = np.clip(palm_m + sole_m, 0, 1)[:, None]
        col = col * (1 - pl) + pale * np.array([1.08, 0.98, 0.9]) * pl
        self._tick("before freckles")
        # ---------------- freckles & moles (splats in 3D)
        tree = cKDTree(p)
        fr_amt = sk.get("freckles", 0.2)
        melf = np.zeros(ntex, np.float32)
        if fr_amt > 0:
            pw = self.reg["head"] * 1.0 + self.reg["farm"] * 0.6 + self.reg["hand"] * 0.5 + self.reg["uarm"] * 0.25 + self.reg["torso"] * 0.15 + self.reg["neck"] * 0.4
            face_front = (self.N[:, 2] > 0.25) & (np.abs(self.P[:, 1] - E[1]) < 0.05)
            pw = pw * np.where(face_front, 2.2, 1.0)
            nosebr = np.exp(-((self.P[:, 0]) ** 2 + (self.P[:, 1] - E[1] + 0.02) ** 2) / 0.03 ** 2)
            pw = pw + 3 * nosebr * self.reg["head"]
            pw = np.clip(pw, 0, None)
            pw /= pw.sum()
            nfr = int(19000 * fr_amt)
            pick = rng.choice(len(self.P), nfr, p=pw)
            centers = self.P[pick] + rng.normal(0, 0.004, (nfr, 3))
            rad = rng.uniform(0.0002, 0.00048, nfr)
            inten = rng.uniform(0.1, 0.45, nfr) ** 1.3
            for c, r, it in zip(centers, rad, inten):
                ids = tree.query_ball_point(c, r * 1.8)
                if not ids:
                    continue
                d = np.linalg.norm(p[ids] - c, axis=1)
                melf[ids] = np.maximum(melf[ids], it * smoothstep(r * 1.8, r * 0.6, d))
        # moles
        nm = 7
        mw = self.reg["torso"] + self.reg["farm"] * 0.5 + self.reg["uarm"] * 0.5 + 0.002
        pick = rng.choice(len(self.P), nm, p=mw / mw.sum())
        mole = np.zeros(ntex, np.float32)
        for c in self.P[pick]:
            r = rng.uniform(0.0008, 0.0018)
            ids = tree.query_ball_point(c, r * 1.6)
            if ids:
                d = np.linalg.norm(p[ids] - c, axis=1)
                mole[ids] = np.maximum(mole[ids], smoothstep(r * 1.6, r * 0.7, d))
        col = col * (1 - melf[:, None] * np.array([0.18, 0.28, 0.38])) * (1 - mole[:, None] * np.array([0.55, 0.62, 0.66]))
        self._tick("before veins")
        # ---------------- veins (bluish, raised) on forearms, hands, feet, temples
        vein_mask = np.clip(farm * smoothstep(-0.1, 0.4, -palm_side * 0 + 1) + dorsal_m * 0.5 + foot * smoothstep(0.2, 0.7, n[:, 1]) * 0.9
                            + m_temple * 0.4 * head, 0, 1)
        vein_mask *= 1 - palm_m
        rq = rp * np.array([55.0, 14.0, 55.0])  # stretched along the limbs (rest pose: limbs vertical)
        vn = ridged(rq, 2, seed=seed + 21)
        vein = smoothstep(0.86, 0.975, vn) * vein_mask * (0.35 + 0.65 * smoothstep(-0.2, 0.4, fbm(rp * 20, 2, seed=seed + 22)))
        col = col * (1 - vein[:, None] * np.array([0.07, 0.035, -0.02]))
        self._tick("before beard shadow")
        # ---------------- beard shadow & body hair tone
        bs = sk.get("beard_shadow", 0.0)
        ax = np.abs(f[:, 0])
        # beard line: sideburn (x=6.4cm, y=0) -> mouth corner (x=2.6cm, y=-5.8cm)
        line_y = np.interp(ax, [0.0, 0.026, 0.064, 0.09], [-0.058, -0.058, -0.005, 0.02])
        chin_y = self.lm["chin"][1] - E[1]
        beard = head * smoothstep(line_y + 0.008, line_y - 0.014, f[:, 1]) * smoothstep(-0.035, 0.0, f[:, 2] + 0.06 - ax * 0.4)
        must = head * smoothstep(0.03, 0.022, ax) * smoothstep(-0.066, -0.06, f[:, 1]) * smoothstep(-0.043, -0.05, f[:, 1])
        under = (head + neck) * smoothstep(chin_y + 0.005, chin_y - 0.01, f[:, 1]) * smoothstep(chin_y - 0.075, chin_y - 0.05, f[:, 1]) * smoothstep(-0.2, 0.2, n[:, 2] + 0.3)
        beard = np.clip(np.maximum(np.maximum(beard, must), under), 0, 1)
        lips_v, lip_seam, lip_t = self.lip_mask()
        beard *= 1 - lips_v
        beard *= 1 - smoothstep(0.1, 0.4, m_nostril)
        speck = smoothstep(-0.1, 0.6, fbm(p * 2600, 1, seed=seed + 33))
        stub = beard * bs * (0.45 + 0.35 * (fbm(p * 400, 2, seed=seed + 31) * 0.5 + 0.5) + 0.3 * speck) * (0.8 + 0.2 * fbm(p * 60, 2, seed=seed + 32))
        stub = np.clip(stub, 0, 1)
        stub_col = srgb_to_lin(np.array(self.preset.get("brows", {}).get("color", [0.2, 0.17, 0.16])) * 0.9 + 0.04)
        col = col * (1 - stub[:, None] * np.array([0.58, 0.56, 0.5])) + stub_col * stub[:, None] * 0.22
        bh = sk.get("body_hair", 0.2)
        hair_m = (farm * 0.8 + shin * 1.0 + thigh * 0.4 + dorsal_m * 0.3 + torso * 0.15 * bh) * bh
        streak = fbm(rp * np.array([900.0, 180.0, 900.0]), 2, seed=seed + 41) * 0.5 + 0.5
        col = col * (1 - (hair_m * streak * 0.18)[:, None])
        self._tick("before scalp")
        # ---------------- scalp (under the strand hair) and painted eyebrows
        hair_col = srgb_to_lin(np.array(sk.get("hair_color", np.array(self.preset.get("brows", {}).get("color", [0.12, 0.07, 0.04])) * 1.2)))
        crown = np.array(self.lm["crown"])
        phi = np.abs(np.degrees(np.arctan2(p[:, 0] - crown[0], p[:, 2] - crown[2])))  # 0 = front, 180 = back
        # hairline height (relative to the eye centres) as a function of the angle around the head
        # natural, uncut hairline: full temples and sideburns down to the ear lobe, hair right up to the ear and down
        # the nape (no modern fade; "ye shall not round the corners of your heads", Lev 19:27).  Same table format as
        # src/characters/hair/HeadSurface.ts (PHI knots unchanged, HAIRLINE_HL values below).
        hl_tab = sk.get("hairline", HAIRLINE_HL)
        # (averaged over +-5 deg so the steep temple -> sideburn step is a soft edge, not a painted helmet line)
        hl = (np.interp(phi - 5, HAIRLINE_PHI, hl_tab) + np.interp(phi, HAIRLINE_PHI, hl_tab) + np.interp(phi + 5, HAIRLINE_PHI, hl_tab)) / 3
        hl = hl + fbm(p * 90, 2, seed=seed + 50) * 0.004
        scalp = (head + neck * 0.5) * smoothstep(hl - 0.003, hl + 0.01, f[:, 1])
        # the ear itself stays bare: a thin flap (ray-cast thickness) lateral to the skull
        thick_t = self.interp(self.v_thick)
        ear_flap = smoothstep(0.024, 0.013, thick_t) * smoothstep(0.05, 0.062, np.abs(f[:, 0])) * smoothstep(0.08, 0.25, m_ear)
        scalp *= 1 - ear_flap
        scalp = np.clip(scalp, 0, 1)
        # grey at the temples (mature men): salt-and-pepper over the sides, a little everywhere
        grey = float(sk.get("grey_temples", 0.0))
        if grey > 0:
            gm = grey * (0.3 + 0.7 * smoothstep(48, 68, phi) * smoothstep(135, 105, phi)) * (0.6 + 0.4 * (fbm(p * 700, 2, seed=seed + 53) * 0.5 + 0.5))
            hair_col = hair_col[None, :] * (1 - gm[:, None]) + srgb_to_lin(np.array([0.56, 0.54, 0.51]))[None, :] * gm[:, None]
        # close-cropped roots: fine grain (not a felt-like blotch) so hair cards on top can hide gaps
        scalp_n = 0.7 + 0.3 * (0.6 * fbm(p * 1400, 2, seed=seed + 52) + 0.4 * fbm(p * 300, 2, seed=seed + 51))
        col = col * (1 - (scalp * 0.7 * scalp_n)[:, None]) + hair_col * (scalp * 0.5 * scalp_n)[:, None]
        self._tick("before eyebrows ")
        # eyebrows (same shape as the strand generator)
        brow = np.zeros(ntex, np.float32)
        for S, sgn in (("L", 1), ("R", -1)):
            c = self.eyes[S]["center"]
            loop, _ = lid_margin(h, S)
            lp = h.v_all[loop]
            lat = (lp[:, 0] - c[0]) * sgn
            inner, outer = lat.min(), lat.max()
            topl = (lp[:, 1] - c[1]).max()
            x0, x1 = inner - 0.0035, outer + 0.0075
            xl = (p[:, 0] - c[0]) * sgn
            s = (xl - x0) / (x1 - x0)
            sc = np.clip(s, 0, 1)
            cy = topl + 0.0085 + 0.003 * np.sin(np.pi * np.clip(sc / 0.68, 0, 1) * 0.5) - 0.0045 * np.clip((sc - 0.68) / 0.32, 0, 1) ** 1.6
            th = self.preset.get("brows", {}).get("thickness", 1.0)
            hh = 0.0046 * th * (1 - 0.1 * sc) * (1 - 0.72 * np.clip((sc - 0.6) / 0.4, 0, 1) ** 1.3) * (0.85 + 0.15 * np.clip(sc / 0.1, 0, 1))
            dy = (p[:, 1] - c[1]) - cy
            inside = smoothstep(1.15, 0.6, np.abs(dy) / np.maximum(hh, 1e-4)) * smoothstep(-0.05, 0.03, s) * smoothstep(1.05, 0.9, s)
            brow = np.maximum(brow, inside * head * (p[:, 2] > c[2] - 0.005))
        brow_n = 0.6 + 0.4 * fbm(np.stack([p[:, 0] * 400, p[:, 1] * 1600, p[:, 2] * 400], 1), 2, seed=seed + 61)
        brow *= brow_n
        col = col * (1 - brow[:, None] * 0.72) + hair_col * brow[:, None] * 0.3
        self._tick("before lips")
        # ---------------- lips
        lipc = srgb_to_lin(sk.get("lip_color", [0.6, 0.34, 0.31]))
        seam = lip_seam
        lipn = 0.9 + 0.1 * fbm(np.stack([p[:, 0] * 900, p[:, 1] * 150, p[:, 2] * 900], 1), 2, seed=seed + 71)
        # vermilion: redder centre, a slightly darker border (the lip line) and darker, browner commissures
        border = smoothstep(0.35, 0.05, lips_v) * smoothstep(0.0, 0.2, lips_v)
        lipcol = lipc * lipn[:, None] * (1 - 0.18 * border[:, None]) * (1 - 0.3 * smoothstep(0.55, 1.0, lip_t)[:, None] * np.array([0.8, 1.0, 1.0]))
        # lips keep some of the underlying skin tone (natural, not lipstick)
        lip_mix = (lips_v * 0.8)[:, None]
        col = col * (1 - lip_mix) + (lipcol * 0.72 + col * np.array([0.95, 0.72, 0.72]) * 0.28) * lip_mix
        # the contact line between the lips is in shadow and slightly wet-dark
        col = col * (1 - 0.55 * seam[:, None])
        # ---------------- eyelids (thin, slightly purple/pink), under-eye
        lid = smoothstep(0.024, 0.012, np.minimum(np.linalg.norm(p - self.eyes["L"]["center"], axis=1), np.linalg.norm(p - self.eyes["R"]["center"], axis=1))) * head
        col = col * (1 - lid[:, None] * np.array([0.06, 0.08, 0.04])) * (1 - m_bag[:, None] * np.array([0.03, 0.06, 0.02]) * (1 + sk.get("age", 0)))
        self.lid_m = lid
        # lash line: dense lash roots darken the lid margin (upper lid much more than the lower)
        lashl = np.zeros(ntex, np.float32)
        for S, sgn in (("L", 1), ("R", -1)):
            c = self.eyes[S]["center"]
            loop, _ = lid_margin(h, S)
            lp = h.v_all[loop]
            io = int(np.argmax((lp[:, 0] - c[0]) * sgn))
            idx = np.nonzero((np.linalg.norm(p - c, axis=1) < 0.03) & (head > 0.3) & ~pocket_isl)[0]
            if len(idx) == 0:
                continue
            q = p[idx]
            best = np.full(len(idx), 1.0)
            upper = np.zeros(len(idx), bool)
            nseg = len(lp)
            for k in range(nseg):
                a, b = lp[k], lp[(k + 1) % nseg]
                ab = b - a
                t = np.clip((q - a) @ ab / (ab @ ab + 1e-12), 0, 1)
                d = np.linalg.norm(q - (a + t[:, None] * ab), axis=1)
                better = d < best
                best = np.where(better, d, best)
                upper = np.where(better, k < io, upper)
            lashl[idx] = np.exp(-(best / 0.0008) ** 2) * np.where(upper, 1.0, 0.45)
        col = col * (1 - 0.72 * lashl[:, None])
        # ---------------- nipples / areolae, navel
        are = smoothstep(0.25, 0.7, m_nipple)
        col = col * (1 - are[:, None] * np.array([0.3, 0.42, 0.45]))
        col = col * (1 - smoothstep(0.3, 0.9, m_navel)[:, None] * 0.25)
        self._tick("before nails")
        # ---------------- nails
        nails = np.zeros(ntex, np.float32)
        for S, sgn in (("L", 1), ("R", -1)):
            for k in range(1, 6):
                bn = f"finger{k}-3.{S}"
                bi = h.index[bn]
                hd, tl_ = h.heads[bi], h.tails[bi]
                d = tl_ - hd
                L = np.linalg.norm(d)
                d /= L
                t = (p - hd) @ d / L
                wd = self.interp(self.Wd[:, bi])
                dors = (-palm_side) if True else None
                nails = np.maximum(nails, wd * smoothstep(0.3, 0.42, t) * smoothstep(0.55, 0.72, dors) * (np.abs(p[:, 0]) > 0.2))
        toe_nail = foot * smoothstep(0.6, 0.85, n[:, 1] + 0.3 * n[:, 2]) * smoothstep(-0.02, 0.0, (p[:, 2] - self._toe_front(p)))
        nails = np.maximum(nails, toe_nail)
        nail_col = srgb_to_lin([0.86, 0.66, 0.6])
        lunula = nails * 0  # (kept simple)
        col = col * (1 - nails[:, None] * 0.7) + nail_col * nails[:, None] * 0.7 * (1 + lunula[:, None])
        self._tick("before dust")
        # ---------------- dust & grime (shepherd) — feet, ankles, hands, knees
        dust = sk.get("dust", 0.0)
        dust_m = np.clip(foot * 1.0 + shin * smoothstep(0.2, 0.08, rp[:, 1]) * 0.8 + palm_m * 0.35 + dorsal_m * 0.15 + knee * 0.35, 0, 1)
        dust_m *= 0.55 + 0.45 * (fbm(p * 70, 3, seed=seed + 81) * 0.5 + 0.5)
        dust_col = srgb_to_lin([0.66, 0.57, 0.46])
        col = col * (1 - (dust * dust_m * 0.5)[:, None]) + dust_col * (dust * dust_m * 0.5)[:, None]
        # ---------------- eye pocket (conjunctiva / caruncle) and mouth interior
        # conjunctiva / caruncle: moist pale pink, not orange-red (it reads as sore, tired eyes under a warm sun)
        col = np.where(pocket_isl[:, None], srgb_to_lin([0.78, 0.6, 0.56]), col)
        dm = smoothstep(1.2, 0.6, np.linalg.norm(p - self._mouth_centre(), axis=1) / 0.03)
        col = np.where(mouth_isl[:, None], srgb_to_lin([0.36, 0.12, 0.11]) * (0.15 + 0.85 * (1 - dm))[:, None], col)
        self.albedo = np.clip(col, 0, 1)
        self._tick("before height field")
        # ================= height field (metres) =================
        age = sk.get("age", 0.0)
        H = np.zeros(ntex, np.float32)
        # lip vertical lines
        lipline = np.sin(p[:, 0] * 2 * np.pi / 0.0011 + fbm(p * 500, 2, seed=seed + 91) * 3.0)
        H += lips_v * (1 - seam) * lipline * 0.00004
        # knuckle wrinkles (dorsal PIP/DIP/MCP), finger flexion creases (palmar)
        for S in "LR":
            for k in range(1, 6):
                for j in (1, 2, 3):
                    bn = f"finger{k}-{j}.{S}"
                    if bn not in h.index:
                        continue
                    bi = h.index[bn]
                    hd = h.heads[bi]
                    d = h.tails[bi] - hd
                    d /= np.linalg.norm(d)
                    dist = np.linalg.norm(p - hd, axis=1)
                    near = np.exp(-(dist / 0.009) ** 2) * hand
                    along = (p - hd) @ d
                    wr = np.sin(along * 2 * np.pi / 0.0014) * np.exp(-(along / 0.004) ** 2)
                    H -= near * dorsal_m * np.abs(wr) * 0.00012
                    crease = np.exp(-(along / 0.0006) ** 2)
                    H -= near * palm_m * crease * 0.00025
        self._tick("before palm creases")
        # palm creases: three main lines as curves in a palm frame
        H -= self._palm_creases(p, palm_m) * 0.0003
        self._tick("before elbows / knees")
        # elbows / knees wrinkle patches
        for jn, r, amp in (("lowerarm01.L", 0.03, 0.00015), ("lowerarm01.R", 0.03, 0.00015), ("lowerleg01.L", 0.045, 0.0001), ("lowerleg01.R", 0.045, 0.0001)):
            c = h.rest_world_pos[h.index[jn]]
            d = np.linalg.norm(rp - c, axis=1)
            patch = np.exp(-(d / r) ** 2)
            wl = np.sin(rp[:, 1] * 2 * np.pi / 0.004 + fbm(rp * 200, 2, seed=seed + 5) * 2)
            H -= patch * np.abs(wl) * amp * (smoothstep(0.0, -0.6, n[:, 2]) if "arm" in jn else smoothstep(0.2, 0.7, n[:, 2]))
        # raised veins
        H += vein * 0.00035
        # forehead lines, crow's feet, laugh lines (age)
        fl = np.sin(f[:, 1] * 2 * np.pi / 0.0095 + fbm(p * 60, 2, seed=seed + 95) * 1.5)
        forehead = head * smoothstep(0.035, 0.045, f[:, 1]) * smoothstep(0.075, 0.06, f[:, 1]) * smoothstep(0.045, 0.02, ax)
        H -= forehead * np.clip(-fl, 0, 1) * (0.00003 + 0.00018 * age)
        for S, sgn in (("L", 1), ("R", -1)):
            c = self.eyes[S]["center"]
            corner = c + np.array([sgn * 0.02, -0.002, -0.006])
            d = p - corner
            r = np.linalg.norm(d[:, :2], axis=1)
            ang = np.arctan2(d[:, 1], d[:, 0] * sgn)
            cf = np.exp(-(r / 0.012) ** 2) * (np.abs(ang) < 1.0) * (np.linalg.norm(d, axis=1) < 0.02)
            H -= cf * np.abs(np.sin(ang * 9)) * (0.00001 + 0.00012 * age)
        H -= m_laugh * (0.00006 + 0.0003 * age)
        # areola bumps, neck rings
        H += are * (fbm(p * 1500, 2, seed=seed + 97) * 0.5 + 0.5) * 0.0001
        ring = np.sin(rp[:, 1] * 2 * np.pi / 0.018) * neck * smoothstep(0.1, 0.5, n[:, 2])
        H -= np.clip(ring, 0, 1) * (0.00002 + 0.00008 * age)
        # micro relief: fine bumps / follicle texture (resolved by the 2K map on the face), strongest on the
        # nose, cheeks, chin and forehead; the pores themselves come from the tiling detail normal at runtime
        zone = np.clip(m_nose * 1.2 + m_nosetip + m_cheek + m_chin * 0.7 + head * 0.35, 0, 1)
        amp = 0.000012 + 0.000030 * zone
        relief = fbm(p * 600.0, 2, seed=seed + 98) * 0.7 + fbm(p * 1100.0, 2, seed=seed + 99) * 0.5
        H += relief * amp * (1 - lips_v) * (1 - nails) * (1 + 0.6 * age)
        # procedural surface anatomy (tendons, bony landmarks, muscle separations, structured veins)
        an_str = float(self.preset.get("anatomy", 1.0))
        if an_str > 0:
            from anatomy import Anatomy
            joints = {nm: h.rest_world_pos[i] for nm, i in h.index.items()}
            an = Anatomy(self.R, self.sub.welded[1], self.reg, rp, self.treg, joints)
            H_an = an.build(strength=an_str, veins=float(sk.get("veins", 1.0)), rng=np.random.default_rng(seed + 123))
            self._tick("anatomy")
        else:
            H_an = np.zeros_like(H)
        # the procedural anatomy is kept apart: it is low-passed before it enters the normal map and only a fraction
        # of it darkens the cavity term (sharp grooves turned into ink-like streaks on the 1K maps)
        self.height = H
        self.height_an = H_an.astype(np.float32)
        self._tick("before roughness")
        # ================= roughness (0..1 mapped to [0.15, 0.85] at runtime) =================
        rough = np.full(ntex, 0.5, np.float32)
        tzone = head * (np.exp(-((f[:, 0] / 0.02) ** 2 + ((f[:, 1] + 0.035) / 0.035) ** 2)) + smoothstep(0.02, 0.05, f[:, 1]) * smoothstep(0.03, 0.0, ax) * 0.7
                        + m_chin * 0.6)
        rough -= np.clip(tzone, 0, 1) * 0.14
        rough -= m_nosetip * 0.08
        rough += m_cheek * 0.04
        rough = np.where(lips_v > 0.5, 0.3 + 0.12 * (lipline * 0.5 + 0.5), rough * (1 - lips_v) + 0.3 * lips_v)
        rough += 0.1 * (farm + uarm + thigh + shin + torso * 0.5) + 0.12 * palm_m + 0.15 * foot + 0.12 * knee + 0.1 * elbow
        rough += dust * dust_m * 0.25
        rough = rough * (1 - nails) + 0.22 * nails
        rough += fbm(p * 150, 2, seed=seed + 101) * 0.04
        rough += fbm(p * 700, 2, seed=seed + 102) * 0.06 * np.clip(head + neck, 0, 1)  # ~1 mm specular breakup
        rough = np.where(pocket_isl | mouth_isl, 0.08, rough)
        rough = np.where(scalp > 0.5, rough + 0.1 * scalp, rough)
        self.rough = np.clip(rough, 0, 1)
        # ================= pore strength =================
        pores = 0.35 * (torso + uarm + thigh + neck * 0.8) + 0.25 * (farm + shin + hand + foot)
        pores += head * (0.55 + 0.4 * np.clip(m_nose * 1.5 + m_nosetip + m_cheek + m_chin * 0.6, 0, 1))
        pores *= 1 - lips_v
        pores *= 1 - 0.7 * lid
        pores = pores * (1 - palm_m * 0.8) * (1 - sole_m * 0.8) * (1 - nails)
        self.pores = np.clip(pores * (1 + 0.3 * age), 0, 1)
        self.masks = {"lips": lips_v, "beard": beard, "scalp": scalp, "brow": brow, "nails": nails, "palm": palm_m, "expo": expo, "red": red}
        print(f"  paint {time.time() - t0:.1f}s")

    def _toe_front(self, p):
        # z of the toe tips (per side), bind pose
        v = self.h.v_all[:NBODY]
        out = np.zeros(len(p), np.float32)
        for sgn in (1, -1):
            sel = (v[:, 1] < 0.08) & (v[:, 0] * sgn > 0)
            zmax = v[sel, 2].max()
            out = np.where(p[:, 0] * sgn > 0, zmax - 0.013, out)
        return out

    def _mouth_centre(self):
        lm = self.lm
        return (np.array(lm["chin"]) + np.array(lm["noseTip"])) / 2 + np.array([0, 0, -0.03])

    def _palm_creases(self, p, palm_m):
        h = self.h
        J = h.joint
        out = np.zeros(len(p), np.float32)
        for S, sgn in (("L", 1), ("R", -1)):
            wr = J(f"wrist.{S}____head")
            idx = J(f"finger2-1.{S}____head")
            pky = J(f"finger5-1.{S}____head")
            mid = J(f"finger3-1.{S}____head")
            th = J(f"finger1-1.{S}____head")
            # curves as polylines (bind pose), each a list of points
            curves = [
                [pky * 0.75 + wr * 0.25 + (mid - wr) * 0.12, (pky + idx) / 2 * 0.8 + wr * 0.2 + (mid - wr) * 0.1, idx * 0.85 + mid * 0.15 - (mid - wr) * 0.05],  # heart line
                [idx * 0.7 + th * 0.3 - (mid - wr) * 0.12, (pky + idx) / 2 * 0.55 + wr * 0.45, pky * 0.55 + wr * 0.45],  # head line
                [idx * 0.6 + th * 0.4 - (mid - wr) * 0.15, th * 0.5 + wr * 0.5 + (pky - idx) * 0.12, wr * 0.85 + th * 0.15],  # life line
            ]
            side = (p[:, 0] * sgn > 0.2)
            for cv in curves:
                cv = np.asarray(cv)
                best = np.full(len(p), 1.0)
                for a, b in zip(cv[:-1], cv[1:]):
                    ab = b - a
                    t = np.clip((p - a) @ ab / (ab @ ab), 0, 1)
                    d = np.linalg.norm(p - (a + t[:, None] * ab), axis=1)
                    best = np.minimum(best, d)
                out = np.maximum(out, np.exp(-(best / 0.0009) ** 2) * side)
        return out * palm_m

    # ------------------------------------------------------------------ output
    def normal_from_height(self, S):
        """Tangent-space normal map image (S x S x 3, 0..1) from the height field."""
        Himg = self.dilate(self.image(self.height), 6)
        if S != self.size:
            raise ValueError
        if getattr(self, "height_an", None) is not None:
            Han = self.dilate(self.image(self.height_an), 8)
            Himg = Himg + ndimage.gaussian_filter(Han, 1.1 * S / 1024.0)
        gy, gx = np.gradient(Himg)  # per texel
        # per texel metres: du = 1/S uv units -> mpu/S metres
        mpu = self.dilate(self.image(self.mpu, 1.0), 6)
        mpv = self.dilate(self.image(self.mpv, 1.0), 6)
        dhdx = gx / np.maximum(mpu / S, 1e-7)  # along +u
        dhdy = -gy / np.maximum(mpv / S, 1e-7)  # along +v (image rows go down = -v)
        nrm = np.stack([-dhdx, -dhdy, np.ones_like(dhdx)], -1)
        nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
        return nrm * 0.5 + 0.5

    def write(self):
        t0 = time.time()
        outdir = os.path.join(OUT, self.name)
        os.makedirs(outdir, exist_ok=True)
        S = self.size
        alb = self.dilate(self.image(lin_to_srgb(self.albedo)), 16)
        nrm = self.normal_from_height(S)
        if getattr(self, "def_xy", None) is not None:
            R = self.treg
            gain = (1.5 * (R["torso"] + R["pelvis"] + R["uarm"] + R["farm"] + R["thigh"] + R["shin"] + R["neck"])
                    + 0.45 * R["head"] + 0.8 * (R["hand"] + R["foot"]))
            gain *= float(self.preset.get("definition", 1.0))
            gain = np.where((self.island == 3) | (self.island == 4), 0.0, gain)
            dxy = self.image(self.def_xy * gain[:, None])
            n3 = nrm * 2 - 1
            n3[..., :2] += dxy
            n3 /= np.linalg.norm(n3, axis=-1, keepdims=True)
            nrm = n3 * 0.5 + 0.5
        nrm = self.dilate(np.where(self.valid[..., None], nrm, 0.5), 16)
        # AO x cavity
        ao = self.interp(self.v_ao)
        Himg = self.image(self.height)
        if getattr(self, "height_an", None) is not None:
            Himg = Himg + ndimage.gaussian_filter(self.dilate(self.image(self.height_an), 8), 2.0 * S / 1024.0) * 0.2
        k = S / 1024.0
        lap = ndimage.laplace(ndimage.gaussian_filter(self.dilate(Himg, 4), 1.0 * k))
        cav_t = np.clip(1 + lap[self.vy, self.vx] * 2500.0 * k * k, 0.72, 1.0)
        aoc = np.clip(ao * cav_t, 0, 1)
        aoc = np.where(self.island == 4, aoc * 0.55, aoc)  # eye-socket pocket is occluded by the eyeball
        aoc = np.where(self.island == 3, aoc * 0.25, aoc)  # mouth interior
        thick = self.interp(self.v_thick)
        # translucency: ears, nostril wings, lids and finger edges glow; cheeks (over the mouth cavity) barely
        trans = np.clip(np.exp(-(thick - 0.003) / 0.0065), 0, 1)
        trans = np.where((self.island == 3) | (self.island == 4), 0.0, trans)  # no glow from mouth / socket interiors
        if getattr(self, "lid_m", None) is not None:
            trans = trans * (1 - 0.7 * self.lid_m)  # thin lids would glow orange-red in a low sun
        mask = np.stack([aoc, self.rough, trans], 1)
        mask = self.dilate(self.image(mask), 16)
        pores = self.dilate(self.image(self.pores), 16)
        mimg = (np.clip(mask, 0, 1) * 255 + 0.5).astype(np.uint8)
        aimg = (np.clip(alb, 0, 1) * 255 + 0.5).astype(np.uint8)
        # normal map: xy = tangent-space normal, z = pore strength (the shader rebuilds nz = sqrt(1 - x^2 - y^2))
        nimg_xy = np.clip(nrm[..., :2], 0, 1)
        outs = [(S, {2048: "2k", 1024: "1k", 4096: "4k"}.get(S, f"{S}"))]
        if S > 1024:
            outs.append((1024, "1k"))
        for sz, tag in outs:
            def rs(a, mode):
                im = Image.fromarray(a, mode)
                return im if sz == S else im.resize((sz, sz), Image.LANCZOS)
            rs(aimg, "RGB").save(os.path.join(outdir, f"albedo_{tag}.webp"), quality=90, method=6)
            if sz == S:
                xy = nimg_xy
                pr = pores
            else:
                # downsample the normal as a vector field, then renormalise
                n3 = nrm * 2 - 1
                n3 = np.asarray(Image.fromarray(((n3 * 0.5 + 0.5) * 255).astype(np.uint8), "RGB").resize((sz, sz), Image.LANCZOS)).astype(np.float32) / 255 * 2 - 1
                n3 /= np.linalg.norm(n3, axis=-1, keepdims=True) + 1e-6
                xy = n3[..., :2] * 0.5 + 0.5
                pr = np.asarray(Image.fromarray((np.clip(pores, 0, 1) * 255).astype(np.uint8), "L").resize((sz, sz), Image.LANCZOS)).astype(np.float32) / 255
            nimg = np.concatenate([xy, pr[..., None]], -1)
            Image.fromarray((np.clip(nimg, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB").save(os.path.join(outdir, f"normal_{tag}.webp"), quality=92, method=6)
            rs(mimg, "RGB").save(os.path.join(outdir, f"mask_{tag}.webp"), quality=90, method=6)
        nimg = (np.clip(np.concatenate([nimg_xy, pores[..., None]], -1), 0, 1) * 255).astype(np.uint8)
        # debug previews (scratch)
        dbg = os.path.join(os.environ.get("HUMAN_DEBUG", "/tmp"), f"{self.name}_masks.png")
        try:
            prev = np.concatenate([aimg[::4, ::4], (np.stack([mimg[::4, ::4, 0]] * 3, -1)), nimg[::4, ::4]], 1)
            Image.fromarray(prev).save(dbg)
        except Exception:
            pass
        print(f"  write {time.time() - t0:.1f}s")


# ------------------------------------------------------------------------------------------ common textures
def _periodic_noise(S, freq, seed):
    """Smooth periodic noise in [-1, 1] (band-limited to `freq` cycles per tile)."""
    g = np.random.default_rng(seed).normal(size=(freq, freq))
    F = np.fft.fft2(g)
    out = np.zeros((S, S), complex)
    h = freq // 2
    out[:h, :h] = F[:h, :h]
    out[:h, -h:] = F[:h, -h:]
    out[-h:, :h] = F[-h:, :h]
    out[-h:, -h:] = F[-h:, -h:]
    n = np.real(np.fft.ifft2(out))
    return n / (np.abs(n).max() + 1e-9)


def _poisson_sites(S, spacing, rng):
    """Dart-throwing blue-noise sites on a periodic S x S domain."""
    cand = rng.random((int((S / spacing) ** 2 * 3), 2)) * S
    keep = []
    cell = spacing / np.sqrt(2)
    G = int(np.ceil(S / cell))
    grid = -np.ones((G, G), int)
    for p in cand:
        gx, gy = int(p[0] / cell), int(p[1] / cell)
        ok = True
        for dx in (-2, -1, 0, 1, 2):
            for dy in (-2, -1, 0, 1, 2):
                j = grid[(gx + dx) % G, (gy + dy) % G]
                if j >= 0:
                    d = np.abs(keep[j] - p)
                    d = np.minimum(d, S - d)
                    if d[0] * d[0] + d[1] * d[1] < spacing * spacing:
                        ok = False
                        break
            if not ok:
                break
        if ok:
            grid[gx % G, gy % G] = len(keep)
            keep.append(p)
    return np.asarray(keep)


def _furrows(S, ncell, rng, warp, aniso, width):
    """Distance-to-border of a warped, anisotropic periodic Voronoi diagram -> groove profile (0..1)."""
    from scipy.spatial import cKDTree
    cs = S / ncell
    gy, gx = np.mgrid[0:ncell, 0:ncell]
    sites = np.stack([(gx + 0.5 + (rng.random(gx.shape) - 0.5) * 0.95) * cs,
                      (gy + 0.5 + (rng.random(gy.shape) - 0.5) * 0.95) * cs], -1).reshape(-1, 2)
    allp = np.concatenate([sites + np.array([dx * S, dy * S]) for dx in (-1, 0, 1) for dy in (-1, 0, 1)])
    an = np.asarray(aniso, float)
    tree = cKDTree(allp * an)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    q = np.stack([((xx + warp[0]) % S).ravel(), ((yy + warp[1]) % S).ravel()], 1) * an
    d, _ = tree.query(q, k=2)
    e = (d[:, 1] - d[:, 0]).reshape(S, S)
    return np.exp(-(e / width) ** 2)


def bake_detail_normal(size=1024, seed=3):
    """Tileable skin micro-relief (the tile spans ~2 cm of skin, 0.02 mm per texel at 1024):
    blue-noise follicle pores (log-normal size/depth, slightly elongated, with a raised rim), the polygonal
    furrow network of the stratum corneum (primary ~0.8 mm cells, broken up by noise; secondary ~0.3 mm)
    and an orange-peel grain.  RG = tangent-space normal, B = micro cavity (1 = open skin, 0 = pore floor)."""
    rng = np.random.default_rng(seed)
    S = size
    sp = S / 1024.0
    # ---- pores: visible follicle funnels ~0.1-0.25 mm across, ~0.45 mm apart
    pts = _poisson_sites(S, 22.0 * sp, rng)
    n = len(pts)
    radii = np.exp(rng.normal(np.log(3.4 * sp), 0.3, n))
    depths = np.exp(rng.normal(0.0, 0.4, n))
    ang = rng.random(n) * np.pi
    elo = 1 + rng.random(n) * 0.45
    P = np.zeros((S, S), np.float32)
    for (cx, cy), r, d, a, e in zip(pts, radii, depths, ang, elo):
        x0, x1 = int(cx - 4 * r), int(cx + 4 * r) + 1
        y0, y1 = int(cy - 4 * r), int(cy + 4 * r) + 1
        gx, gy = np.meshgrid(np.arange(x0, x1), np.arange(y0, y1))
        dx, dy = gx - cx, gy - cy
        ca, sa = np.cos(a), np.sin(a)
        u, v = (dx * ca + dy * sa) / e, (-dx * sa + dy * ca) * e
        d2 = (u * u + v * v) / (r * r)
        # funnel: a steep pit with a soft conical surround and a faint raised rim
        P[gy % S, gx % S] += -d * (0.75 * np.exp(-d2 * 2.2) + 0.35 * np.exp(-d2 * 0.55)) + 0.1 * d * np.exp(-((np.sqrt(d2) - 1.9) / 0.5) ** 2)
    # ---- furrow network
    warp = (_periodic_noise(S, 12, seed + 11) * 14 * sp, _periodic_noise(S, 12, seed + 12) * 14 * sp)
    F = -_furrows(S, 24, rng, warp, (1.0, 1.35), 2.2 * sp) * np.clip(_periodic_noise(S, 40, seed + 13) * 1.2 + 0.55, 0, 1)
    warp2 = (warp[0] * 0.5, warp[1] * 0.5)
    F += -0.4 * _furrows(S, 60, rng, warp2, (1.2, 1.0), 1.4 * sp) * np.clip(_periodic_noise(S, 60, seed + 14) + 0.6, 0, 1)
    # ---- orange-peel grain
    G = _periodic_noise(S, 200, seed + 15) * 0.6 + _periodic_noise(S, 90, seed + 16) * 0.4
    H = 0.6 * P + 0.4 * F + 0.2 * G
    H = ndimage.gaussian_filter(H, 0.7 * sp, mode="wrap")
    gy, gx = np.gradient(np.pad(H, 1, mode="wrap"))
    gy, gx = gy[1:-1, 1:-1] / sp, gx[1:-1, 1:-1] / sp
    strength = 1.2
    nrm = np.stack([-gx * strength, gy * strength, np.ones_like(H)], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    cav = np.clip(1.0 + np.minimum(H - np.median(H), 0) * 0.9, 0, 1)
    img = np.concatenate([nrm[..., :2] * 0.5 + 0.5, cav[..., None]], -1)
    os.makedirs(COMMON, exist_ok=True)
    Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB").save(os.path.join(COMMON, "skin_detail_normal.webp"), quality=92, method=6)


def _polar_noise(nth, nr, fth, fr, seed):
    """Band-limited noise on a (radius x angle) grid, periodic in angle: fth cycles around, fr along the radius."""
    rng = np.random.default_rng(seed)
    g = rng.normal(size=(2 * fr, fth))
    F = np.fft.fft2(g)
    out = np.zeros((2 * nr, nth), complex)
    hr, ht = fr, fth // 2
    out[:hr, :ht] = F[:hr, :ht]
    out[:hr, -ht:] = F[:hr, -ht:]
    out[-hr:, :ht] = F[-hr:, :ht]
    out[-hr:, -ht:] = F[-hr:, -ht:]
    n = np.real(np.fft.ifft2(out))[:nr]
    return n / (np.abs(n).max() + 1e-9)


def _sample_polar(img, t, a):
    """Bilinear lookup of a (nr x nth) polar image at radius t (0..1) and angle a (radians)."""
    nr, nth = img.shape
    y = np.clip(t, 0, 1) * (nr - 1)
    x = ((a / (2 * np.pi)) % 1.0) * nth
    y0 = np.floor(y).astype(int)
    x0 = np.floor(x).astype(int)
    fy, fx = y - y0, x - x0
    y1 = np.minimum(y0 + 1, nr - 1)
    x0 %= nth
    x1 = (x0 + 1) % nth
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x1] * fx * (1 - fy) + img[y1, x0] * (1 - fx) * fy + img[y1, x1] * fx * fy)


IRIS_STYLES = {
    # sRGB: pupillary zone, collarette highlight, ciliary zone, ciliary periphery, limbal ring
    "brown_hazel": ([0.42, 0.33, 0.15], [0.54, 0.40, 0.19], [0.34, 0.21, 0.11], [0.21, 0.125, 0.07], [0.075, 0.05, 0.035]),
    "dark_brown": ([0.24, 0.14, 0.07], [0.31, 0.19, 0.09], [0.19, 0.11, 0.06], [0.13, 0.08, 0.045], [0.05, 0.035, 0.03]),
    # hazel-green (David, per the reference): amber-gold around the pupil, olive-green mid zone, brown periphery
    "hazel_green": ([0.46, 0.34, 0.14], [0.47, 0.43, 0.22], [0.31, 0.30, 0.17], [0.22, 0.17, 0.09], [0.07, 0.055, 0.04]),
}


def bake_eye(style: str, size=1024, seed=3):
    """Front-projected eyeball texture: sclera (conjunctival vessels, limbal shading) and a layered iris
    (pupillary ruff, radial trabecular fibres, collarette, crypts, contraction furrows, dark limbal ring)."""
    rng = np.random.default_rng(seed + sum(map(ord, style)))
    S = size
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    x = (xx + 0.5) / S * 2 - 1
    y = 1 - (yy + 0.5) / S * 2
    r = np.sqrt(x * x + y * y)
    a = np.arctan2(y, x)
    IR = 0.37  # iris radius in texture units (runtime uTexIrisR)
    col = np.zeros((S, S, 3), np.float32)
    # ---- sclera: warm off-white, pinker/yellower toward the canthi, fine tortuous vessels
    z = np.sqrt(np.clip(1 - r * r, 0, 1))
    P3 = np.stack([x, y, z], -1).reshape(-1, 3)
    n1 = fbm(P3 * 5.0, 4, seed=seed).reshape(S, S)
    scl = srgb_to_lin([0.80, 0.76, 0.71])
    col[:] = scl * (1 + 0.035 * n1[..., None])
    canth = smoothstep(0.42, 0.95, np.abs(x)) * smoothstep(0.75, 0.15, np.abs(y))
    col *= 1 - canth[..., None] * np.array([0.03, 0.17, 0.16])
    vn = ridged(P3 * 6.5, 3, seed=seed + 5).reshape(S, S)
    vn2 = ridged(P3 * 14.0, 2, seed=seed + 6).reshape(S, S)
    veins = (smoothstep(0.935, 0.99, vn) + 0.6 * smoothstep(0.95, 0.995, vn2)) * smoothstep(IR * 1.35, 0.85, r) * (0.25 + 0.75 * canth)
    col = col * (1 - np.clip(veins, 0, 1)[..., None] * np.array([0.08, 0.5, 0.5]))
    # limbal shadow (the sclera darkens and greys toward the cornea edge)
    limb = smoothstep(IR * 0.98, IR * 1.02, r) * smoothstep(IR * 1.3, IR * 1.02, r)
    col *= 1 - 0.3 * limb[..., None]
    # ---- iris
    c_pup, c_col, c_cil, c_per, c_limb = (srgb_to_lin(c) for c in IRIS_STYLES.get(style, IRIS_STYLES["brown_hazel"]))
    t = np.clip(r / IR, 0, 1)
    nth, nr = 2048, 256
    fib = _polar_noise(nth, nr, 220, 5, seed + 21) * 0.6 + _polar_noise(nth, nr, 520, 9, seed + 22) * 0.4
    fib_s = _sample_polar(fib, t, a)
    wav = _sample_polar(_polar_noise(nth, nr, 14, 2, seed + 23), t * 0 + 0.5, a) * 0.035
    tc = 0.52 + wav  # collarette radius (fraction of the iris radius)
    # colour zones: the pupillary zone fades from the pupil colour into the collarette, the ciliary zone darkens outward
    inner = c_pup + (c_col - c_pup) * smoothstep(0.3, tc, t)[..., None]
    outer = c_cil + (c_per - c_cil) * smoothstep(0.6, 0.98, t)[..., None]
    zone = smoothstep(tc - 0.04, tc + 0.1, t)[..., None]
    base = inner * (1 - zone) + outer * zone
    # trabecular fibres: dark gaps and bright light-catching ridges
    ridge = np.clip(fib_s, 0, 1) ** 1.5
    gap = np.clip(-fib_s, 0, 1)
    iris = base * (1 + 0.9 * ridge[..., None] - 0.45 * gap[..., None])
    collar = smoothstep(tc - 0.04, tc, t) * smoothstep(tc + 0.06, tc, t)
    iris = iris * (1 + 0.3 * collar[..., None])
    # crypts (dark lacunae just outside the collarette), elongated radially
    cr = _sample_polar(_polar_noise(nth, nr, 60, 7, seed + 24), t, a)
    crypt = smoothstep(0.4, 0.8, cr) * smoothstep(tc, tc + 0.08, t) * smoothstep(0.88, 0.65, t)
    iris *= 1 - 0.4 * crypt[..., None]
    # contraction furrows (concentric, broken) in the periphery
    brk = smoothstep(-0.1, 0.4, _sample_polar(_polar_noise(nth, nr, 30, 4, seed + 25), t, a))
    fur = (np.cos((t - 0.7) * 2 * np.pi * 9) * 0.5 + 0.5) ** 6 * smoothstep(0.66, 0.78, t) * smoothstep(0.97, 0.9, t) * brk
    iris *= 1 - 0.35 * fur[..., None]
    # dark limbal ring
    lr = smoothstep(0.84, 0.99, t)
    iris = iris * (1 - lr[..., None]) + c_limb * lr[..., None]
    # pupil (texture pupil radius = 0.28 of the iris) + pupillary ruff
    pup = smoothstep(0.295, 0.275, t)
    ruff = smoothstep(0.27, 0.29, t) * smoothstep(0.33, 0.295, t) * (0.6 + 0.4 * _sample_polar(fib, t, a * 3))
    iris = iris * (1 - 0.65 * ruff[..., None])
    iris = iris * (1 - pup[..., None]) + np.array([0.003, 0.0025, 0.0025]) * pup[..., None]
    irm = smoothstep(IR * 1.012, IR * 0.992, r)
    col = col * (1 - irm[..., None]) + iris * irm[..., None]
    img = (lin_to_srgb(col) * 255 + 0.5).astype(np.uint8)
    os.makedirs(COMMON, exist_ok=True)
    Image.fromarray(img, "RGB").save(os.path.join(COMMON, f"eye_{style}.webp"), quality=92, method=6)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("presets", nargs="*", default=[])
    ap.add_argument("--size", type=int, default=2048)
    ap.add_argument("--common", action="store_true")
    a = ap.parse_args()
    if a.common:
        bake_detail_normal()
        for st in ("brown_hazel", "dark_brown", "hazel_green"):
            bake_eye(st)
        print("common textures written")
    for p in a.presets:
        t0 = time.time()
        print(f"== bake {p}")
        b = Baker(p, a.size)
        b.rasterize()
        b.ao_thickness()
        b.definition()
        b.paint()
        b.write()
        print(f"  total {time.time() - t0:.1f}s")
