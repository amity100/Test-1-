#!/usr/bin/env python3
"""
DAVID human pipeline — builds runtime assets for realistic humans from MakeHuman (CC0) data.

    python3 tools/human/build_human.py [preset ...]        (default: david saul man)

For each preset (tools/human/presets/<name>.json) it
  1. applies the MakeHuman macro + regional modifiers (morph targets),
  2. scales the body to the requested height (metres, feet on y = 0 in the rest pose),
  3. builds the MakeHuman default skeleton (163 bones -> pruned to ~130) from the morphed joint helpers,
  4. computes a rest pose with arms hanging straight down and straight vertical legs,
  5. extracts the body, bakes skin weights, and writes two geometry tiers:
       base  : MakeHuman hm08 body (13 380 verts, quads -> tris)
       sub1  : one Catmull-Clark level (limit-projected), weights/uvs subdivided (~53k verts)
  6. adds eyes (+ cornea), tear lines, eyelashes, eyebrows (strand ribbons), teeth,
  7. converts the MakeHuman face pose units (BVH) into bone rotations for expressions,
  8. writes src/assets/human/<preset>/{rig.json, base.bin, sub1.bin} and bake inputs for bake_skin.py.

Coordinates: metres, +Y up, the character faces +Z, its left is +X.
"""
from __future__ import annotations

import json
import os
import struct
import sys
import time

import numpy as np
import scipy.sparse as sp
from scipy.spatial import cKDTree
from scipy.spatial.transform import Rotation as Rot

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from mh_data import CACHE, fetch, load_obj, load_skeleton, load_weights, load_bvh_rotations  # noqa: E402
from modifiers import macro_targets, regional_targets, apply_targets  # noqa: E402
from geom import catmull_clark, limit_stencil, vertex_normals, tangents, tri_from_quads, disk_ao  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "src", "assets", "human")
WORK = os.path.join(CACHE, "work")
NBODY = 13380

# bones dropped entirely (no body weights; we do not build a tongue)
DROP_PREFIX = ("tongue",)
# bones merged into another bone (weights are added to the target)
MERGE = {"breast.L": "spine02", "breast.R": "spine02"}
for side in ("L", "R"):
    for t in range(1, 6):
        for k in (2, 3):
            MERGE[f"toe{t}-{k}.{side}"] = f"toe{t}-1.{side}"


# ------------------------------------------------------------------------------------------ helpers
def qmul(a, b):
    return (Rot.from_quat(a) * Rot.from_quat(b)).as_quat()


def rot_between_frames(a1, a2, b1, b2) -> Rot:
    """Rotation R with R*a1 = b1 exactly and R*a2 ~ b2 (a2/b2 orthogonalised)."""
    def frame(x, y):
        x = x / np.linalg.norm(x)
        y = y - x * np.dot(x, y)
        y = y / np.linalg.norm(y)
        z = np.cross(x, y)
        return np.stack([x, y, z], 1)
    Fa = frame(np.asarray(a1, float), np.asarray(a2, float))
    Fb = frame(np.asarray(b1, float), np.asarray(b2, float))
    return Rot.from_matrix(Fb @ Fa.T)


def rot_min(a, b) -> Rot:
    a = np.asarray(a, float) / np.linalg.norm(a)
    b = np.asarray(b, float) / np.linalg.norm(b)
    ax = np.cross(a, b)
    s = np.linalg.norm(ax)
    if s < 1e-9:
        return Rot.identity()
    ang = np.arctan2(s, np.dot(a, b))
    return Rot.from_rotvec(ax / s * ang)


def signed_angle(a, b, axis):
    axis = axis / np.linalg.norm(axis)
    a = a - axis * np.dot(a, axis)
    b = b - axis * np.dot(b, axis)
    return np.arctan2(np.dot(np.cross(a, b), axis), np.dot(a, b))


# ------------------------------------------------------------------------------------------ morph
def morph_preset(base_v, preset, overrides=None):
    macro = dict(preset["macro"])
    mods = dict(preset.get("modifiers", {}))
    if overrides:
        macro.update(overrides.get("macro", {}))
        mods.update(overrides.get("modifiers", {}))
    tl = macro_targets(macro) + regional_targets(mods)
    return apply_targets(base_v, tl)


class Human:
    """Morphed + normalised MakeHuman body with skeleton, weights and rest pose."""

    def __init__(self, preset: dict, overrides=None, ref: "Human | None" = None):
        t0 = time.time()
        self.preset = preset
        self.obj = obj = load_obj(fetch("data/3dobjs/base.obj"))
        self.bones_def, self.joints_def, _ = load_skeleton()
        v = morph_preset(obj.v, preset, overrides)
        body_v = v[:NBODY]
        if ref is None:
            # uniform scale to the requested height, origin under the pelvis
            top, bot = body_v[:, 1].max(), body_v[:, 1].min()
            self.scale = preset.get("height_m", 1.75) / (top - bot)
            pelvis = v[self.joints_def["spine05____head"]].mean(0)
            self.origin = np.array([0.0, bot, pelvis[2]])
        else:  # variation morphs share the reference normalisation
            self.scale, self.origin = ref.scale, ref.origin.copy()
        self.v_all = (v - self.origin) * self.scale  # metres, incl. helpers
        self._build_skeleton()
        if ref is None:
            self._build_weights()
            self._build_rest_pose()
            # put the soles on y = 0 in the rest pose
            rest = self.skin(self.v_all[:NBODY], self.rest_world_rot, self.rest_world_pos)
            dy = rest[:, 1].min()
            self.v_all[:, 1] -= dy
            self.origin[1] += dy / self.scale
            self._build_skeleton()
            self._build_rest_pose()
        print(f"  human built in {time.time() - t0:.1f}s  scale={self.scale:.5f}")

    # ---------------------------------------------------------------- skeleton
    def joint(self, name):
        return self.v_all[self.joints_def[name]].mean(0)

    def _build_skeleton(self):
        names, parents, heads, tails = [], [], [], []
        idx = {}
        for b in self.bones_def:
            if b.name.startswith(DROP_PREFIX) or b.name in MERGE:
                continue
            idx[b.name] = len(names)
            names.append(b.name)
            parents.append(idx[b.parent] if b.parent else -1)
            heads.append(self.joint(b.head))
            tails.append(self.joint(b.tail))
        self.names = names
        self.index = idx
        self.parents = np.asarray(parents)
        self.heads = np.asarray(heads)
        self.tails = np.asarray(tails)

    def _build_weights(self):
        """Dense (NV_all x NB) weight matrix with merges applied."""
        W = load_weights()
        nb = len(self.names)
        Wd = np.zeros((len(self.v_all), nb), np.float32)
        for bname, lst in W.items():
            tgt = MERGE.get(bname, bname)
            if tgt.startswith(DROP_PREFIX) or tgt not in self.index:
                # tongue weights on the body (mouth floor) go to the jaw
                tgt = "jaw" if bname.startswith("tongue") else None
                if tgt is None:
                    continue
            a = np.asarray(lst, float)
            np.add.at(Wd[:, self.index[tgt]], a[:, 0].astype(int), a[:, 1])
        s = Wd.sum(1, keepdims=True)
        s[s == 0] = 1
        self.Wd = Wd / s

    # ---------------------------------------------------------------- rest pose
    def _build_rest_pose(self):
        nb = len(self.names)
        rho = [Rot.identity() for _ in range(nb)]
        world = {}  # aligned rest world rotations we want for specific bones
        I = self.index
        J = self.joint
        for s, S in ((1, "L"), (-1, "R")):
            A = J(f"upperarm01.{S}____head")
            E = J(f"lowerarm01.{S}____head")
            Wr = J(f"wrist.{S}____head")
            ua = E - A
            fa = Wr - E
            hinge = np.cross(ua, fa)
            hinge /= np.linalg.norm(hinge)
            down = np.array([0.0, -1.0, 0.0])
            hx = np.array([-1.0, 0.0, 0.0])
            a_ua = rot_between_frames(ua, hinge, down, hx)
            a_fa = rot_between_frames(fa, hinge, down, hx)
            # hand frame in bind
            idx_mcp = J(f"finger2-1.{S}____head")
            pky_mcp = J(f"finger5-1.{S}____head")
            mid_mcp = J(f"finger3-1.{S}____head")
            f = mid_mcp - Wr
            r = idx_mcp - pky_mcp
            palm = s * np.cross(f, r)
            palm /= np.linalg.norm(palm)
            palm_target = np.array([-s * 1.0, 0.0, -0.3])
            palm_target /= np.linalg.norm(palm_target)
            carried = a_fa.apply(palm)
            twist = signed_angle(carried, palm_target, down)
            tw = lambda k: Rot.from_rotvec(down * twist * k)  # noqa: E731
            a_fa1 = tw(0.45) * a_fa
            a_fa2 = tw(1.0) * a_fa
            # hand: straight along the forearm with a hint of ulnar deviation & relaxed extension
            f_t = np.array([s * 0.10, -1.0, 0.04])
            a_hd = rot_between_frames(f, palm, f_t, palm_target)
            # the deltoid (shoulder01) follows part of the arm's swing down from the A-pose
            world[f"shoulder01.{S}"] = Rot.from_rotvec(a_ua.as_rotvec() * 0.4)
            world[f"upperarm01.{S}"] = a_ua
            world[f"upperarm02.{S}"] = a_ua
            world[f"lowerarm01.{S}"] = a_fa1
            world[f"lowerarm02.{S}"] = a_fa2
            world[f"wrist.{S}"] = a_hd
            # legs: vertical thighs & shins, feet keep their bind orientation (flat, pointing +Z)
            H = J(f"upperleg01.{S}____head")
            K = J(f"lowerleg01.{S}____head")
            Ak = J(f"foot.{S}____head")
            a_th = rot_min(K - H, down)
            a_sh = rot_min(Ak - K, down)
            world[f"upperleg01.{S}"] = a_th
            world[f"upperleg02.{S}"] = a_th
            world[f"lowerleg01.{S}"] = a_sh
            world[f"lowerleg02.{S}"] = a_sh
            world[f"foot.{S}"] = Rot.identity()
        # propagate: bones not listed inherit their parent's world rotation (rigid children)
        wr = [None] * nb
        for i, n in enumerate(self.names):
            p = self.parents[i]
            if n in world:
                wr[i] = world[n]
            else:
                wr[i] = wr[p] if p >= 0 else Rot.identity()
        for i in range(nb):
            p = self.parents[i]
            rho[i] = (wr[p].inv() * wr[i]) if p >= 0 else wr[i]
        self.rest_local = rho
        self.rest_world_rot = wr
        # world positions by FK
        pos = np.zeros((nb, 3))
        for i in range(nb):
            p = self.parents[i]
            pos[i] = self.heads[i] if p < 0 else pos[p] + wr[p].apply(self.heads[i] - self.heads[p])
        self.rest_world_pos = pos

    def skin(self, verts, wrot, wpos, W=None):
        """Linear blend skinning of bind-pose verts (rows of self.Wd) into a pose."""
        W = self.Wd[: len(verts)] if W is None else W
        out = np.zeros_like(verts)
        for i in range(len(self.names)):
            w = W[:, i]
            nz = np.nonzero(w)[0]
            if len(nz) == 0:
                continue
            p = wrot[i].apply(verts[nz] - self.heads[i]) + wpos[i]
            out[nz] += p * w[nz, None]
        return out


# ------------------------------------------------------------------------------------------ weights
def top4(W: np.ndarray, k: int = 4):
    """Dense weights -> (idx uint8/16 x k, w float32 x k), renormalised (k = 4 or 8)."""
    idx = np.argsort(-W, axis=1)[:, :k]
    w = np.take_along_axis(W, idx, 1)
    w[w < 0.004] = 0
    s = w.sum(1, keepdims=True)
    s[s == 0] = 1
    w = w / s
    idx[w == 0] = 0
    return idx.astype(np.uint16), w.astype(np.float32)


# ------------------------------------------------------------------------------------------ mesh tiers
class Tier:
    def __init__(self, name, pos, nrm, uv, tris, weights_dense, posidx, extra=None):
        self.name = name
        self.pos, self.nrm, self.uv, self.tris = pos, nrm, uv, tris
        self.Wd = weights_dense
        self.posidx = posidx  # render vertex -> welded position index
        self.extra = extra or {}


def build_body_tiers(h: Human, levels=(0, 1)):
    obj = h.obj
    bf = obj.group_faces("body")
    quads = obj.faces[bf]
    uvq = obj.faces_t[bf]
    P = h.v_all[:NBODY]
    UV = obj.vt
    Wb = h.Wd[:NBODY]
    tiers = {}
    stencils = {}
    for lev in levels:
        q, uq, S, US = quads, uvq, sp.identity(NBODY, format="csr"), sp.identity(len(UV), format="csr")
        for _ in range(lev):
            cc = catmull_clark(q, S.shape[0], uq, US.shape[0])
            S = cc.S @ S
            US = cc.US @ US
            q, uq = cc.quads, cc.uvq
        if lev > 0:
            S = limit_stencil(q, S.shape[0]) @ S
        pos_w = S @ P
        uv_w = US @ UV
        tri_p = tri_from_quads(q)
        tri_t = tri_from_quads(uq)
        nrm_w = vertex_normals(pos_w, tri_p)
        # split render vertices by (pos, uv)
        pair = np.stack([tri_p.ravel(), tri_t.ravel()], 1)
        uniq, inv = np.unique(pair, axis=0, return_inverse=True)
        tris = inv.reshape(-1, 3).astype(np.int64)
        pidx = uniq[:, 0]
        tidx = uniq[:, 1]
        Wd = np.asarray(S @ Wb) if lev > 0 else Wb
        name = "base" if lev == 0 else f"sub{lev}"
        tiers[name] = Tier(name, pos_w[pidx], nrm_w[pidx], uv_w[tidx], tris, Wd[pidx], pidx)
        tiers[name].welded = (pos_w, tri_p, nrm_w)
        stencils[name] = S
        print(f"  tier {name}: {len(pidx)} verts, {len(tris)} tris")
    return tiers, stencils


# ------------------------------------------------------------------------------------------ face pose units
def face_poseunits(h: Human):
    names, frames, _ = load_bvh_rotations("data/poseunits/face-poseunits.bvh")
    meta = json.load(open(fetch("data/poseunits/face-poseunits.json"), encoding="utf-8"))
    units = {}
    for fi, uname in enumerate(meta["framemapping"]):
        if fi == 0 or fi >= len(frames):
            continue
        rots = {}
        for bname, M in frames[fi].items():
            if bname not in h.index:
                continue
            r = Rot.from_matrix(M)
            ang = r.magnitude()
            if ang < 1e-4:
                continue
            q = r.as_quat()
            rots[bname] = [round(float(x), 6) for x in q]
        if rots:
            units[uname] = rots
    return units


# ------------------------------------------------------------------------------------------ eyes etc.
def eye_data(h: Human):
    """Eyeball centres/radii fitted to the eye helpers + the lid-margin loops of the body mesh."""
    obj = h.obj
    res = {}
    for S, g in (("L", "helper-l-eye"), ("R", "helper-r-eye")):
        gv = obj.group_verts(g)
        c = h.joint(f"eye.{S}____head")
        r = float(np.linalg.norm(h.v_all[gv] - c, axis=1).mean())
        res[S] = {"center": c, "radius": r}
    return res


def uv_islands(obj, faces_idx):
    from scipy.sparse.csgraph import connected_components
    ft = obj.faces_t[faces_idx]
    n = len(faces_idx)
    rows = np.repeat(np.arange(n), 4)
    nT = len(obj.vt)
    A = sp.coo_matrix((np.ones(4 * n), (rows, ft.ravel() + n)), shape=(n + nT, n + nT))
    _, lab = connected_components(A + A.T, directed=False)
    return lab[:n]


def lid_margin(h: Human, S: str):
    """Ordered loop of body vertices forming the eye opening = seam between the eye-socket pocket
    (its own UV island in hm08) and the face.  Returns (loop vertex ids, pocket face mask over body faces)."""
    obj = h.obj
    bf = obj.group_faces("body")
    q = obj.faces[bf]
    lab = uv_islands(obj, bf)
    c = h.joint(f"eye.{S}____head")
    fc = h.v_all[q].mean(1)
    near = np.linalg.norm(fc - c, axis=1) < 0.03
    # the pocket island: most frequent island label among faces very close to the eye centre
    cand, cnt = np.unique(lab[near], return_counts=True)
    sizes = {l: (lab == l).sum() for l in cand}
    pocket_label = min(cand, key=lambda l: sizes[l])  # the small island (the face island is huge)
    pocket = lab == pocket_label
    from collections import defaultdict
    efaces = defaultdict(list)
    for fi, quad in enumerate(q):
        for k in range(4):
            a, b = quad[k], quad[(k + 1) % 4]
            efaces[(min(a, b), max(a, b))].append(fi)
    bedges = [e for e, fs in efaces.items() if len(fs) == 2 and pocket[fs[0]] != pocket[fs[1]]]
    adj = defaultdict(list)
    for a, b in bedges:
        adj[a].append(b)
        adj[b].append(a)
    start = bedges[0][0]
    loop = [start]
    prev, cur = None, start
    while True:
        nxt = [x for x in adj[cur] if x != prev]
        prev, cur = cur, nxt[0]
        if cur == start or len(loop) > 400:
            break
        loop.append(cur)
    loop = np.asarray(loop)
    # orient: start at the inner (medial) corner, go along the upper lid first
    P = h.v_all[loop]
    lat = P[:, 0] * (1 if S == "L" else -1)
    i0 = int(np.argmin(lat))
    loop = np.roll(loop, -i0)
    P = h.v_all[loop]
    if P[len(loop) // 4, 1] < P[3 * len(loop) // 4, 1]:
        loop = np.concatenate([loop[:1], loop[1:][::-1]])
    return loop, pocket


# ------------------------------------------------------------------------------------------ export
class BinWriter:
    def __init__(self):
        self.chunks = []
        self.layout = {}
        self.off = 0

    def add(self, name, arr: np.ndarray, dtype, itemSize, normalized=False, extra=None):
        a = np.ascontiguousarray(arr.astype(dtype))
        pad = (-self.off) % 4
        if pad:
            self.chunks.append(b"\0" * pad)
            self.off += pad
        b = a.tobytes()
        entry = {"offset": self.off, "count": int(a.size // itemSize), "itemSize": itemSize, "type": np.dtype(dtype).name,
                 "normalized": normalized}
        if extra:
            entry.update(extra)
        self.layout[name] = entry
        self.chunks.append(b)
        self.off += len(b)

    def add_quant(self, name, arr, itemSize):
        """Quantise a float array to int16 per component with min/scale (dequantised at load)."""
        a = np.asarray(arr, np.float64).reshape(-1, itemSize)
        lo = a.min(0)
        hi = a.max(0)
        sc = np.where(hi - lo < 1e-12, 1.0, (hi - lo))
        qv = np.round((a - lo) / sc * 65535.0) - 32768
        self.add(name, qv.astype(np.int16), np.int16, itemSize, extra={"quant": {"min": lo.tolist(), "range": sc.tolist()}})

    def bytes(self):
        return b"".join(self.chunks)


def write_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))



# ------------------------------------------------------------------------------------------ landmarks
def landmarks(h: Human):
    v = h.v_all[:NBODY]
    Wh = h.Wd[:NBODY, h.index["head"]] + h.Wd[:NBODY, h.index["jaw"]]
    headv = np.nonzero(Wh > 0.5)[0]
    top = v[headv[np.argmax(v[headv, 1])]]
    # chin: most forward point of the lower face in the midline
    jawv = np.nonzero((h.Wd[:NBODY, h.index["jaw"]] > 0.5) & (np.abs(v[:, 0]) < 0.004))[0]
    chin_i = jawv[np.argmin(v[jawv, 1] - 0.35 * v[jawv, 2])]
    chin = v[chin_i]
    # crown seat: head cross-section ~2.5 cm above the brow line (eye centre + ~3.2 cm)
    ey = h.joint("eye.L____head")[1]
    band = headv[np.abs(v[headv, 1] - (ey + 0.034)) < 0.004]
    cx = v[band, 0]
    cz = v[band, 2]
    crown = np.array([0.0, ey + 0.034, (cz.max() + cz.min()) / 2])
    nose_v = np.nonzero(np.abs(v[:, 0]) < 0.004)[0]
    nose_v = nose_v[(v[nose_v, 1] > ey - 0.06) & (v[nose_v, 1] < ey)]
    nose = v[nose_v[np.argmax(v[nose_v, 2])]]
    return {
        "headTop": top.tolist(), "chin": chin.tolist(), "noseTip": nose.tolist(),
        "crown": crown.tolist(), "crownRadius": [float((cx.max() - cx.min()) / 2), float((cz.max() - cz.min()) / 2)],
    }


# ------------------------------------------------------------------------------------------ build
def weights_for_points(tier: Tier, pts: np.ndarray, k=3):
    tree = cKDTree(tier.pos)
    d, i = tree.query(pts, k=k)
    w = 1.0 / (d + 1e-4)
    w /= w.sum(1, keepdims=True)
    return np.einsum("nk,nkb->nb", w, tier.Wd[i])


def build_strands(h: Human, tier: Tier, eyes, rng_seed=1, density=1.0):
    from strands import Surface, lashes, brows, ribbon_arrays
    rng = np.random.default_rng(rng_seed)
    pos_w, tri_p, nrm_w = tier.welded
    preset = h.preset
    bcfg = preset.get("brows", {})
    head_w = tier.Wd[:, h.index["head"]]
    # front-facing skin of the upper face (exclude the eye-socket pocket, which faces the eyeball)
    allpos, allnrm = tier.pos, tier.nrm
    out = []
    for S, side in (("L", 1), ("R", -1)):
        c = eyes[S]["center"]
        loop = eyes[S]["loop_pos"]
        # split loop at the lateral corner
        lat = (loop[:, 0] - c[0]) * side
        io = int(np.argmax(lat))
        upper_l = loop[: io + 1]
        lower_l = np.concatenate([loop[io:], loop[:1]])[::-1]
        up_s, up_r, up_w = lashes(upper_l, c, side, rng, upper=True, count=int(175 * density))
        lo_s, lo_r, lo_w = lashes(lower_l, c, side, rng, upper=False, count=int(55 * density))
        mask = (allnrm[:, 2] > 0.15) & (allpos[:, 1] > c[1] + 0.002) & (np.abs(allpos[:, 0] - c[0]) < 0.05)
        surf = Surface(allpos, allnrm, mask)
        br_s, br_r, br_w = brows(surf, c, side, loop, rng, density=bcfg.get("density", 1.0) * density,
                                 thickness=bcfg.get("thickness", 1.0))
        out.append(("lash", up_s + lo_s, np.concatenate([up_r, lo_r]), np.concatenate([up_w, lo_w])))
        out.append(("brow", br_s, br_r, br_w))
    groups = {}
    for kind, strands_, roots, widths in out:
        g = groups.setdefault(kind, {"strands": [], "roots": [], "widths": []})
        g["strands"] += strands_
        g["roots"].append(roots)
        g["widths"].append(widths)
    res = {}
    for kind, g in groups.items():
        rib = ribbon_arrays(g["strands"], np.concatenate(g["widths"]), rng)
        rib["nstrands"] = len(g["strands"])
        rib["points"] = len(g["strands"][0])
        roots = np.concatenate(g["roots"])
        # skin weights: lashes follow the nearest lid-margin skin, brows the skin under the root
        Wr = weights_for_points(tier, roots, k=2 if kind == "lash" else 4)
        rib["Wd"] = Wr[rib["sidx"]]
        # skin normal at root (for shading)
        _, ni = cKDTree(tier.pos).query(roots)
        rib["nrm"] = tier.nrm[ni][rib["sidx"]]
        res[kind] = rib
        print(f"    {kind}: {len(g['strands'])} strands, {len(rib['pos'])} verts")
    return res


def build_tearline(h: Human, tier: Tier, eyes):
    """Wet meniscus strip along each lid margin, resting on the eyeball."""
    pos, tris, Ws = [], [], []
    base = 0
    for S in ("L", "R"):
        c = eyes[S]["center"]
        r = eyes[S]["radius"]
        loop = eyes[S]["loop_pos"]
        n = len(loop)
        # centre of the opening
        oc = loop.mean(0)
        for i in range(n):
            m = loop[i]
            d = (m - c) / np.linalg.norm(m - c)
            on_ball = c + d * (r + 0.00012)
            toward = oc - m
            toward -= d * np.dot(toward, d)
            toward /= np.linalg.norm(toward) + 1e-9
            a = m + (on_ball - m) * 0.85 - d * 0.0001
            b = on_ball + toward * 0.0009
            pos += [m + d * 0.00005, a, b]
        for i in range(n):
            j = (i + 1) % n
            for k in range(2):
                a0, a1 = base + 3 * i + k, base + 3 * i + k + 1
                b0, b1 = base + 3 * j + k, base + 3 * j + k + 1
                tris += [(a0, b0, a1), (a1, b0, b1)]
        base += 3 * n
    pos = np.asarray(pos)
    Wd = weights_for_points(tier, pos, k=2)
    return {"pos": pos, "tris": np.asarray(tris), "Wd": Wd}


def build_teeth(h: Human):
    """Procedural dentition fitted to MakeHuman's teeth helpers: 2 x 14 crowns + gums, rigid to head / jaw."""
    out_pos, out_nrm, out_col, out_tri, out_bone = [], [], [], [], []
    base = 0
    for which in ("upper", "lower"):
        gv = h.obj.group_verts(f"helper-{which}-teeth")
        P = h.v_all[gv]
        x_half = np.abs(P[:, 0]).max()
        z_front = P[:, 2].max()
        z_back = P[np.abs(P[:, 0]) > x_half * 0.9, 2].mean()
        y_hi, y_lo = P[:, 1].max(), P[:, 1].min()
        up = which == "upper"
        # labial arch: z(x) = zf - (zf - zb) * (x / xh)^2.2
        def arch(x):
            return z_front - (z_front - z_back) * np.abs(x / x_half) ** 2.2
        xs = np.linspace(0, x_half, 400)
        zs = arch(xs)
        seg = np.hypot(np.diff(xs), np.diff(zs))
        cum = np.concatenate([[0], np.cumsum(seg)])
        if up:
            widths = [8.6, 6.7, 7.8, 7.0, 6.7, 10.2, 9.2]
            heights = [10.5, 9.0, 10.2, 8.4, 7.6, 7.0, 6.4]
            thick = [6.8, 6.0, 7.8, 9.0, 9.0, 10.8, 10.2]
            edge_y = y_lo + 0.0006
        else:
            widths = [5.3, 5.9, 6.9, 7.0, 7.2, 11.0, 10.4]
            heights = [9.0, 9.4, 10.8, 8.2, 7.8, 7.4, 7.0]
            thick = [6.0, 6.2, 7.4, 8.0, 8.4, 10.4, 10.0]
            edge_y = y_hi - 0.0018
        scale = cum[-1] * 0.93 / (sum(widths) * 0.001)
        widths = [w * 0.001 * scale for w in widths]
        heights = [v * 0.001 * scale for v in heights]
        thick = [v * 0.001 * scale for v in thick]
        inset = 0.0 if up else 0.0022  # lower incisors sit behind the upper ones (overjet)
        for side in (1, -1):
            s0 = 0.0
            for k in range(7):
                w, hh, th = widths[k], heights[k], thick[k]
                sc = s0 + w / 2
                s0 += w
                x = np.interp(sc, cum, xs) * side
                z = np.interp(sc, cum, zs)
                dx = 0.001
                t = np.array([side * dx, 0, arch(abs(x) + dx) - arch(abs(x))])
                t /= np.linalg.norm(t)
                nlab = np.array([t[2] * -side * 0 + 0, 0, 0])
                nlab = np.cross(t, np.array([0, 1.0, 0])) * side
                if nlab[2] < 0:
                    nlab = -nlab
                nlab /= np.linalg.norm(nlab)
                c = np.array([x, 0, z]) - nlab * (th / 2 + inset)
                kind = "inc" if k < 2 else "can" if k == 2 else "pm" if k < 5 else "mol"
                rings = 7
                segs = 18
                gum_y = edge_y + (hh if up else -hh) * (1 if up else 1)
                ys = np.linspace(0, 1, rings)
                pts = []
                for r_i, v in enumerate(ys):
                    # v: 0 at the gum line, 1 at the incisal edge / cusp
                    yy = gum_y + (edge_y - gum_y) * v
                    a = w / 2 * (0.82 + 0.18 * np.sin(np.pi * min(v * 1.3, 1)))
                    b = th / 2 * (1.0 - 0.25 * v)
                    if kind == "inc":
                        b = th / 2 * (1.0 - 0.72 * v ** 1.4)
                    elif kind == "can":
                        a = a * (1 - 0.55 * v ** 2)
                        b = th / 2 * (1.0 - 0.5 * v ** 1.5)
                    for j in range(segs):
                        ang = 2 * np.pi * j / segs
                        ca, sa = np.cos(ang), np.sin(ang)
                        e = 3.0 if kind in ("pm", "mol") else 2.5
                        px = np.sign(ca) * abs(ca) ** (2 / e) * a
                        pz = np.sign(sa) * abs(sa) ** (2 / e) * b
                        pts.append(c + t * px + nlab * pz + np.array([0, yy, 0]))
                # cap at the edge
                capc = c + np.array([0, edge_y + (0.0004 if not up else -0.0004), 0])
                pts.append(capc)
                pts = np.asarray(pts)
                tri = []
                for r_i in range(rings - 1):
                    for j in range(segs):
                        a0 = r_i * segs + j
                        a1 = r_i * segs + (j + 1) % segs
                        b0 = (r_i + 1) * segs + j
                        b1 = (r_i + 1) * segs + (j + 1) % segs
                        tri += [(a0, b0, a1), (a1, b0, b1)]
                ci = len(pts) - 1
                for j in range(segs):
                    tri.append(((rings - 1) * segs + j, ci, (rings - 1) * segs + (j + 1) % segs))
                tri = np.asarray(tri)
                if not up:
                    tri = tri[:, [0, 2, 1]]
                # colour: enamel, darker toward the gums and the back of the mouth
                depth = np.clip((z_front - pts[:, 2]) / (z_front - z_back), 0, 1)
                gumw = np.clip(np.abs(pts[:, 1] - edge_y) / hh, 0, 1)
                col = np.array([0.86, 0.8, 0.68])[None] * (1 - 0.55 * depth[:, None] ** 1.2) * (1 - 0.25 * gumw[:, None] ** 3)
                out_pos.append(pts)
                out_col.append(col)
                out_tri.append(tri + base)
                out_bone.append(np.full(len(pts), 0 if up else 1))
                base += len(pts)
        # gum ridge: a tube along the arch at the gum line
        n_g = 60
        gpts = []
        for i in range(n_g + 1):
            u = -1 + 2 * i / n_g
            x = u * x_half * 0.98
            z = arch(x)
            yy = (edge_y + (np.mean(heights[:3]) if up else -np.mean(heights[:3])) * 0.92)
            gpts.append(np.array([x, yy, z - 0.0035]))
        gpts = np.asarray(gpts)
        ring = 10
        rad = 0.0042
        tube = []
        for i, g in enumerate(gpts):
            tan = gpts[min(i + 1, n_g)] - gpts[max(i - 1, 0)]
            tan /= np.linalg.norm(tan)
            nn = np.cross(tan, np.array([0, 1.0, 0]))
            nn /= np.linalg.norm(nn)
            bb = np.cross(tan, nn)
            for j in range(ring):
                ang = 2 * np.pi * j / ring
                tube.append(g + (nn * np.cos(ang) * 1.0 + bb * np.sin(ang) * 1.3) * rad)
        tube = np.asarray(tube)
        tri = []
        for i in range(n_g):
            for j in range(ring):
                a0, a1 = i * ring + j, i * ring + (j + 1) % ring
                b0, b1 = (i + 1) * ring + j, (i + 1) * ring + (j + 1) % ring
                tri += [(a0, b0, a1), (a1, b0, b1)]
        depth = np.clip((z_front - tube[:, 2]) / (z_front - z_back), 0, 1)
        col = np.array([0.62, 0.3, 0.3])[None] * (1 - 0.6 * depth[:, None])
        out_pos.append(tube)
        out_col.append(col)
        out_tri.append(np.asarray(tri) + base)
        out_bone.append(np.full(len(tube), 0 if up else 1))
        base += len(tube)
    pos = np.concatenate(out_pos)
    tris = np.concatenate(out_tri)
    from geom import vertex_normals
    nrm = vertex_normals(pos, tris)
    bone = np.concatenate(out_bone)
    W = np.zeros((len(pos), len(h.names)), np.float32)
    W[bone == 0, h.index["head"]] = 1
    W[bone == 1, h.index["jaw"]] = 1
    return {"pos": pos, "nrm": nrm, "col": np.concatenate(out_col), "tris": tris, "Wd": W}


def pack_skinned(bw: BinWriter, prefix: str, pos, Wd, tris, nrm=None, uv=None, tan=None, extra=None):
    bw.add_quant(prefix + "position", pos, 3)
    if nrm is not None:
        n = nrm / (np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12)
        bw.add(prefix + "normal", np.round(n * 32767), np.int16, 3, normalized=True)
    if uv is not None:
        bw.add(prefix + "uv", np.round(np.clip(uv, 0, 1) * 65535), np.uint16, 2, normalized=True)
    if tan is not None:
        bw.add(prefix + "tangent", np.round(np.clip(tan, -1, 1) * 127), np.int8, 4, normalized=True)
    si, sw = top4(Wd)
    bw.add(prefix + "skinIndex", si, np.uint8 if si.max() < 256 else np.uint16, 4)
    bw.add(prefix + "skinWeight", np.round(sw * 65535), np.uint16, 4, normalized=True)
    idx = np.asarray(tris).ravel()
    bw.add(prefix + "index", idx, np.uint16 if len(pos) < 65536 else np.uint32, 1)
    for k, (arr, dt, isz, normed) in (extra or {}).items():
        bw.add(prefix + k, arr, dt, isz, normalized=normed)


def build_preset(name: str, tiers=("base", "sub1")):
    t0 = time.time()
    print(f"== {name}")
    preset = json.load(open(os.path.join(HERE, "presets", f"{name}.json"), encoding="utf-8"))
    h = Human(preset)
    outdir = os.path.join(OUT, name)
    os.makedirs(outdir, exist_ok=True)
    levels = tuple(0 if t == "base" else int(t[3:]) for t in tiers)
    T, stencils = build_body_tiers(h, levels)
    # eyes
    ed = eye_data(h)
    eyes = {}
    for S in ("L", "R"):
        loop, pocket = lid_margin(h, S)
        c = ed[S]["center"]
        lp = h.v_all[loop]
        # fit the eyeball to the lid margin: centre on the joint's z axis (may sit slightly behind the joint)
        from scipy.optimize import least_squares
        fit = least_squares(lambda x: np.linalg.norm(lp - (c + np.array([0, 0, x[0]])), axis=1) - x[1], [0.0, 0.014])
        dz = float(np.clip(fit.x[0], -0.003, 0.001))
        cc = c + np.array([0, 0, dz])
        r = float(np.linalg.norm(lp - cc, axis=1).min()) - 0.00025
        eyes[S] = {"center": c, "radius": r, "offset": [0.0, 0.0, dz], "loop": loop, "loop_pos": lp}
    # face pose units
    units = face_poseunits(h)
    rig = {
        "version": 1,
        "preset": name,
        "description": preset.get("description", ""),
        "height": preset.get("height_m", 1.75),
        "bones": [
            {"n": n, "p": int(h.parents[i]), "h": [round(float(x), 6) for x in h.heads[i]],
             "t": [round(float(x), 6) for x in h.tails[i]],
             "r": [round(float(x), 7) for x in h.rest_local[i].as_quat()]}
            for i, n in enumerate(h.names)
        ],
        "poseunits": units,
        "eyes": {S: {"center": [float(x) for x in eyes[S]["center"]], "radius": eyes[S]["radius"], "bone": f"eye.{S}", "offset": eyes[S]["offset"],
                     "opening": [[round(float(x), 6) for x in p] for p in eyes[S]["loop_pos"]]} for S in ("L", "R")},
        "landmarks": landmarks(h),
        "skin": preset.get("skin", {}),
        "brows": preset.get("brows", {}),
        "irisStyle": preset.get("eyes", {}),
        "tiers": {},
    }
    # variations (seedable morphs) — body deltas + joint deltas
    variations = preset.get("variations", {})
    var_data = {}
    for vname, ov in variations.items():
        hv = Human(preset, overrides=ov, ref=h)
        dv = hv.v_all[:NBODY] - h.v_all[:NBODY]
        dj = hv.heads - h.heads
        var_data[vname] = (dv, dj)
    # ---- single compact binary: control mesh (quads) + strands + tear line + variation morphs.
    # The runtime triangulates the control mesh (tier "base") or subdivides it once (tier "sub1").
    obj = h.obj
    bf = obj.group_faces("body")
    bw = BinWriter()
    bw.add_quant("mesh.position", h.v_all[:NBODY], 3)
    bw.add("mesh.quads", obj.faces[bf], np.uint16, 4)
    bw.add("mesh.quadsUV", obj.faces_t[bf], np.uint16, 4)
    bw.add("mesh.uv", np.round(np.clip(obj.vt, 0, 1) * 65535), np.uint16, 2, normalized=True)
    # MakeHuman's default weights use up to 8 bones per vertex around the shoulders and hips; truncating to 4
    # drops different bones on neighbouring vertices and tears the skin under large rotations -> keep 8
    si, sw = top4(h.Wd[:NBODY], 8)
    bw.add("mesh.skinIndex", si, np.uint8, 8)
    bw.add("mesh.skinWeight", np.round(sw * 65535), np.uint16, 8, normalized=True)
    hi_tier = T["sub1"] if "sub1" in T else T["base"]
    st = build_strands(h, hi_tier, eyes, rng_seed=preset.get("skin", {}).get("seed", 1), density=1.0)
    rig["strands"] = {k: {"strands": int(r["nstrands"]), "points": int(r["points"])} for k, r in st.items()}
    for kind, rib in st.items():
        pack_skinned(bw, kind + ".", rib["pos"], rib["Wd"], rib["tris"], nrm=rib["nrm"], extra={
            "dir": (np.round(rib["dir"] * 127), np.int8, 3, True),
            "strand": (rib["strand"].astype(np.float32), np.float32, 4, False),
        })
    tl = build_tearline(h, T["base"], eyes)
    pack_skinned(bw, "tear.", tl["pos"], tl["Wd"], tl["tris"])
    th = build_teeth(h)
    pack_skinned(bw, "teeth.", th["pos"], th["Wd"], th["tris"], nrm=th["nrm"], extra={
        "color": (np.round(np.clip(th["col"], 0, 1) * 255), np.uint8, 3, True),
    })
    for vname, (dv, dj) in var_data.items():
        bw.add_quant(f"var.{vname}.position", dv, 3)
        bw.add(f"var.{vname}.joints", dj.astype(np.float32), np.float32, 3)
    data = bw.bytes()
    import gzip
    gz = gzip.compress(data, compresslevel=9, mtime=0)
    with open(os.path.join(outdir, "human.binz"), "wb") as f:
        f.write(gz)
    if os.path.exists(os.path.join(outdir, "human.bin")):
        os.remove(os.path.join(outdir, "human.bin"))
    rig["bin"] = {"file": "human.binz", "bytes": len(data), "gzipBytes": len(gz), "layout": bw.layout}
    rig["tierStats"] = {k: {"vertices": int(len(t.pos)), "triangles": int(len(t.tris))} for k, t in T.items()}
    print(f"  wrote human.binz: {len(data) / 1e6:.2f} MB raw, {len(gz) / 1e6:.2f} MB gzip")
    rig["variations"] = list(variations.keys())
    write_json(os.path.join(outdir, "rig.json"), rig)
    print(f"  done in {time.time() - t0:.1f}s")
    return h, T, eyes


if __name__ == "__main__":
    presets = sys.argv[1:] or ["david", "saul", "man"]
    for p in presets:
        build_preset(p)
