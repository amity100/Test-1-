#!/usr/bin/env python3
"""
Crowd mesh baker (DAVID opening film, the armies of shots 4 and 6-9).

Input : the bind-pose dump of the MakeHuman `man` body dressed with the wardrobe's real garments
        (dev/crowd-export.html, driven headless by tools/crowd/export.mjs -> JSON).
Output: src/assets/crowd/<army>.binz — one gzip'ed file per army with 3 LODs of ONE master soldier mesh. Every optional
        piece (headband, head-cloth, jerkin, sandals, dagger, spear, shields, bow, quiver, bedroll, waterskin, reed
        crown, helmet, greaves, beard) is a vertex REGION that the crowd shader switches per instance, so a whole army
        is one draw call per LOD.

Per vertex: position (bind pose, f32x3), normal (i8x3), 4 bone indices into MOCAP_BONES (u8x4), 4 weights (u8x4),
region (u8), base colour (u8x3: body albedo sampled from the MakeHuman texture / prop material colour / 255 for dyed
cloth), prop mode (u8: 0 skinned, 1 spear in the right hand, built in the shader from the grip frame).

    python3 tools/crowd/bake_crowd.py <export.json>

Needs numpy, scipy, Pillow, pyfqmr (MIT; pip install --user pyfqmr).
"""
import base64
import gzip
import json
import math
import os
import struct
import sys

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
import pyfqmr

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "src", "assets", "crowd")

MOCAP_BONES = ['root', 'spine05', 'spine04', 'spine03', 'spine02', 'spine01', 'neck01', 'neck02', 'neck03', 'head',
               'clavicle.L', 'shoulder01.L', 'upperarm01.L', 'upperarm02.L', 'lowerarm01.L', 'lowerarm02.L', 'wrist.L',
               'clavicle.R', 'shoulder01.R', 'upperarm01.R', 'upperarm02.R', 'lowerarm01.R', 'lowerarm02.R', 'wrist.R',
               'upperleg01.L', 'upperleg02.L', 'lowerleg01.L', 'lowerleg02.L', 'foot.L', 'toes.L',
               'upperleg01.R', 'upperleg02.R', 'lowerleg01.R', 'lowerleg02.R', 'foot.R', 'toes.R']
BI = {n: i for i, n in enumerate(MOCAP_BONES)}

# regions (keep in sync with src/film/crowd/crowdShader.ts)
R = dict(skin=0, scalp=1, eye=2, tunic=3, belt=4,  # always drawn (no mask bit)
         hair=5, beard=6, jerkin=7, headband=8, headcloth=9, sandals=10, dagger=11, spearShaft=12, spearHead=13,
         shieldArm=14, shieldBack=15, bow=16, quiver=17, bedroll=18, waterskin=19, crown=20, helmet=21, greaves=22,
         sword=23, boss=24, bossBack=25)

rig = json.load(open(os.path.join(ROOT, "src/assets/human/man/rig.json")))
RB = rig["bones"]
RNAMES = [b["n"] for b in RB]
HEADS = {b["n"]: np.array(b["h"], dtype=np.float64) for b in RB}


def to_mocap(name):
    j = RNAMES.index(name)
    while True:
        n = RNAMES[j]
        if n in BI:
            return BI[n]
        if n.startswith("toe") and n.endswith("-1.L"):
            return BI["toes.L"]
        if n.startswith("toe") and n.endswith("-1.R"):
            return BI["toes.R"]
        j = RB[j]["p"]


def dec(s, dt, cols):
    a = np.frombuffer(base64.b64decode(s), dtype=dt)
    return a.reshape(-1, cols) if cols > 1 else a


class Piece:
    """a mesh piece: positions (bind), faces, per-vertex weights (N x 36 dense), region, colour, prop mode"""

    def __init__(self, P, F, W, region, color, prop=0, name=""):
        self.P = np.asarray(P, np.float64)
        self.F = np.asarray(F, np.int64)
        self.W = np.asarray(W, np.float32)
        self.region = np.broadcast_to(np.asarray(region, np.uint8), (len(self.P),)).copy()
        c = np.asarray(color, np.float32)
        self.C = np.broadcast_to(c, (len(self.P), 3)).copy() if c.ndim == 1 else c.copy()
        self.prop = prop
        self.name = name


def dense_weights(part, n):
    bones = part["bones"]
    remap = np.array([to_mocap(b) for b in bones])
    si = dec(part["si"], np.float32, 4).astype(np.int64)
    sw = dec(part["sw"], np.float32, 4)
    W = np.zeros((n, len(MOCAP_BONES)), np.float32)
    for k in range(4):
        np.add.at(W, (np.arange(n), remap[si[:, k]]), sw[:, k])
    if "si2" in part:
        si2 = dec(part["si2"], np.float32, 4).astype(np.int64)
        sw2 = dec(part["sw2"], np.float32, 4)
        for k in range(4):
            np.add.at(W, (np.arange(n), remap[si2[:, k]]), sw2[:, k])
    W /= np.maximum(W.sum(1, keepdims=True), 1e-6)
    return W


def rigid_weights(n, bone):
    W = np.zeros((n, len(MOCAP_BONES)), np.float32)
    W[:, bone] = 1
    return W


def weld(P, F, eps=1e-5):
    key = np.round(P / eps).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.reshape(-1)
    F2 = inv[F]
    ok = (F2[:, 0] != F2[:, 1]) & (F2[:, 1] != F2[:, 2]) & (F2[:, 0] != F2[:, 2])
    return first, inv, F2[ok]


def simplify(piece: Piece, target, border=True, agg=6):
    """quadric decimation (pyfqmr) of a welded piece, attributes transferred by averaging the source vertices that
    are nearest to each output vertex (weights, colours) and nearest-vertex region"""
    first, inv, Fw = weld(piece.P, piece.F)
    Pw = piece.P[first]
    if len(Fw) <= target:
        Pn, Fn = Pw, Fw
    else:
        s = pyfqmr.Simplify()
        s.setMesh(Pw.astype(np.float64), Fw.astype(np.int32))
        s.simplify_mesh(target_count=int(target), aggressiveness=agg, preserve_border=border, verbose=0)
        Pn, Fn, _ = s.getMesh()
        Pn = np.asarray(Pn, np.float64)
        Fn = np.asarray(Fn, np.int64)
    tree = cKDTree(Pn)
    _, near = tree.query(piece.P)
    n = len(Pn)
    cnt = np.bincount(near, minlength=n).astype(np.float32)
    W = np.zeros((n, piece.W.shape[1]), np.float32)
    np.add.at(W, near, piece.W)
    C = np.zeros((n, 3), np.float32)
    np.add.at(C, near, piece.C)
    miss = cnt == 0
    if miss.any():
        _, nn = cKDTree(piece.P).query(Pn[miss])
        W[miss] = piece.W[nn]
        C[miss] = piece.C[nn]
        cnt[miss] = 1
    W /= np.maximum(W.sum(1, keepdims=True), 1e-6)
    C /= cnt[:, None]
    _, nn = cKDTree(piece.P).query(Pn)
    reg = piece.region[nn]
    return Piece(Pn, Fn, W, reg, C, piece.prop, piece.name)


def normals(P, F):
    N = np.zeros_like(P)
    fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    for k in range(3):
        np.add.at(N, F[:, k], fn)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)


def mat4(a):
    return np.array(a, np.float64).reshape(4, 4).T


def xform(M, P):
    return P @ M[:3, :3].T + M[:3, 3]


def bind_of(bone):
    M = np.eye(4)
    M[:3, 3] = HEADS[bone]
    return M


def rest_to_bind(D, bone):
    """matrix taking rest-pose world coordinates of something rigidly attached to `bone` into bind space"""
    Wr = mat4(D["bonesRest"][bone])
    return bind_of(bone) @ np.linalg.inv(Wr)


# ---------------------------------------------------------------------------------------------------- primitives
def tube(path, radius, sides=6, cap=True):
    """a tube along a polyline (Nx3); radius scalar or per point"""
    path = np.asarray(path, np.float64)
    rad = np.broadcast_to(np.asarray(radius, np.float64), (len(path),))
    P, F = [], []
    up = np.array([0.0, 0.0, 1.0])
    for i, p in enumerate(path):
        t = path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]
        t /= np.linalg.norm(t)
        a = np.cross(t, up)
        if np.linalg.norm(a) < 1e-3:
            a = np.cross(t, [1.0, 0, 0])
        a /= np.linalg.norm(a)
        b = np.cross(t, a)
        for k in range(sides):
            th = 2 * math.pi * k / sides
            P.append(p + rad[i] * (math.cos(th) * a + math.sin(th) * b))
    for i in range(len(path) - 1):
        for k in range(sides):
            a0, a1 = i * sides + k, i * sides + (k + 1) % sides
            b0, b1 = a0 + sides, a1 + sides
            F += [[a0, a1, b1], [a0, b1, b0]]
    if cap:
        for end, sgn in ((0, -1), (len(path) - 1, 1)):
            c = len(P)
            P.append(path[end])
            for k in range(sides):
                a0, a1 = end * sides + k, end * sides + (k + 1) % sides
                F.append([c, a1, a0] if sgn < 0 else [c, a0, a1])
    return np.array(P), np.array(F)


def ellipsoid(c, r, nu=8, nv=5):
    P, F = [], []
    for j in range(nv + 1):
        v = math.pi * j / nv
        for i in range(nu):
            u = 2 * math.pi * i / nu
            P.append([c[0] + r[0] * math.sin(v) * math.cos(u), c[1] + r[1] * math.cos(v), c[2] + r[2] * math.sin(v) * math.sin(u)])
    for j in range(nv):
        for i in range(nu):
            a, b = j * nu + i, j * nu + (i + 1) % nu
            F += [[a, b, b + nu], [a, b + nu, a + nu]]
    return np.array(P), np.array(F)


def frame_place(P, origin, x, y, z):
    M = np.stack([x, y, z], 1)
    return P @ M.T + origin


# ---------------------------------------------------------------------------------------------------- build
HAIRLINE_PHI = [0, 30, 45, 62, 72, 80, 100, 120, 140, 180]
HAIRLINE_HL = [0.072, 0.07, 0.064, 0.052, 0.036, -0.04, -0.028, -0.05, -0.08, -0.09]


def sample_albedo(uv, img):
    h, w = img.shape[:2]
    x = np.clip((uv[:, 0] % 1.0) * (w - 1), 0, w - 1).astype(int)
    y = np.clip((1 - (uv[:, 1] % 1.0)) * (h - 1), 0, h - 1).astype(int)
    return img[y, x, :3] / 255.0


def build(D, army):
    israel = army == "israel"
    pieces = []
    alb = np.asarray(Image.open(os.path.join(ROOT, "src/assets/human/man/albedo_1k.webp")).convert("RGB"), np.float32)
    lm = rig["landmarks"]
    eyeY = rig["eyes"]["L"]["center"][1]
    crown = np.array(lm["crown"])
    for p in D["parts"]:
        name = p["name"]
        mat = p["mats"][0]
        if name in ("brow", "lash", "tearLines", "teeth") or mat == "HumanWet":
            continue
        P = dec(p["pos"], np.float32, 3).astype(np.float64)
        F = dec(p["idx"], np.uint32, 3).astype(np.int64)
        n = len(P)
        col = np.array([((p["colors"][0] >> 16) & 255) / 255, ((p["colors"][0] >> 8) & 255) / 255, (p["colors"][0] & 255) / 255], np.float32)
        if p["kind"] == "skinned":
            W = dense_weights(p, n)
        elif p["kind"] == "rigid":
            W = rigid_weights(n, to_mocap(p["bone"]))
        if name == "body":
            uv = dec(p["uv"], np.float32, 2)
            C = sample_albedo(uv, alb)
            # hair / beard regions of the skin (painted hairline table of tools/human/bake_skin.py)
            reg = np.zeros(n, np.uint8)
            headw = W[:, BI["head"]] + W[:, BI["neck03"]] * 0.5
            rel = P - crown
            phi = np.degrees(np.arctan2(np.abs(rel[:, 0]), rel[:, 2]))  # 0 = front, 180 = back
            hl = np.interp(phi, HAIRLINE_PHI, HAIRLINE_HL)
            scalp = (headw > 0.5) & (P[:, 1] - eyeY > hl)
            reg[scalp] = R["scalp"]
            chin = np.array(lm["chin"])
            nose = np.array(lm["noseTip"])
            mouthY = nose[1] - 0.028
            beard = (headw > 0.3) & (P[:, 1] < nose[1] - 0.012) & (P[:, 1] > chin[1] - 0.055) & (P[:, 2] > crown[2] - 0.005) & ~scalp
            # keep the lips clear
            lips = (np.abs(P[:, 0]) < 0.024) & (np.abs(P[:, 1] - mouthY) < 0.009) & (P[:, 2] > chin[2] + 0.01)
            beard &= ~lips
            # sideburns up to the ear lobe
            side = (headw > 0.5) & (np.abs(P[:, 0]) > 0.055) & (P[:, 1] < eyeY + 0.01) & (P[:, 1] > chin[1]) & (P[:, 2] > crown[2] - 0.035) & (P[:, 2] < crown[2] + 0.05)
            beard |= side & ~scalp
            if israel:
                reg[beard] = R["beard"]
            pieces.append(Piece(P, F, W, reg, C, 0, "body"))
            if army == "philistine":
                # bronze greaves (17:6 "מִצְחַת נְחֹשֶׁת עַל־רַגְלָיו"): front of the shins, knee to ankle
                shin = (W[:, BI["lowerleg01.L"]] + W[:, BI["lowerleg02.L"]] + W[:, BI["lowerleg01.R"]] + W[:, BI["lowerleg02.R"]]) > 0.6
                Nn = normals(P, F)
                sel = shin & (P[:, 1] > 0.12) & (P[:, 1] < 0.5)
                fsel = sel[F].all(1)
                Fs = F[fsel]
                used = np.unique(Fs)
                m = -np.ones(n, np.int64)
                m[used] = np.arange(len(used))
                pieces.append(Piece(P[used] + Nn[used] * 0.007, m[Fs], W[used], R["greaves"], [0.55, 0.37, 0.2], 0, "greaves"))
            continue
        if mat == "HumanEye":
            pieces.append(Piece(P, F, W, R["eye"], [0.75, 0.72, 0.66], 0, "eye"))
            continue
        if p["kind"] == "rigid":
            if mat == "headband":
                pieces.append(Piece(P, F, W, R["headband"], [1, 1, 1], 0, "headband"))
            elif mat == "headcloth":
                pieces.append(Piece(P, F, W, R["headcloth"], [1, 1, 1], 0, "headcloth"))
            else:  # dagger / sword on the belt
                pieces.append(Piece(P, F, W, R["dagger"] if israel else R["sword"], col, 0, name))
            continue
        if p["kind"] == "skinned":
            if name.startswith("tunic"):
                pieces.append(Piece(P, F, W, R["tunic"], [1, 1, 1], 0, name))
            elif name.startswith("jerkin"):
                pieces.append(Piece(P, F, W, R["jerkin"], [0.42, 0.29, 0.19], 0, name))
            elif name == "belt":
                pieces.append(Piece(P, F, W, R["belt"], col, 0, name))
            elif name == "sandals":
                pieces.append(Piece(P, F, W, R["sandals"], [0.36, 0.24, 0.15], 0, name))
            continue
    # ------------------------------------------------------------------ props
    grip = mat4(D["sockets"]["handGripR"])        # rest pose world
    gripBind = rest_to_bind(D, "wrist.R") @ grip  # bind-space grip frame (shader: S_wristR * gripBind)
    spear = [p for p in D["parts"] if p["kind"] == "prop" and p["bone"] == "spear"]
    for i, p in enumerate(spear):
        P = dec(p["pos"], np.float32, 3).astype(np.float64)
        F = dec(p["idx"], np.uint32, 3).astype(np.int64)
        c = p["colors"][0]
        col = [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]
        metal = "5c5a57" in format(c, "06x")
        reg = R["spearHead"] if metal else R["spearShaft"]
        if metal:
            col = [0.33, 0.31, 0.29] if israel else [0.30, 0.29, 0.28]
        # prop vertices stay in the grip frame (x, y along the shaft, z); weights = wrist.R
        pieces.append(Piece(P, F, rigid_weights(len(P), BI["wrist.R"]), reg, col, 1, "spear"))
    # shield: strapped on the LEFT forearm (face outward, +X = the character's left) and a copy slung on the back
    sh = [p for p in D["parts"] if p["kind"] == "prop" and p["bone"] == "shield"]
    handle = mat4(D["propInfo"]["shieldHandle"])
    la0 = mat4(D["bonesRest"]["lowerarm01.L"])[:3, 3]
    wr = mat4(D["bonesRest"]["wrist.L"])[:3, 3]
    ax = (wr - la0) / np.linalg.norm(wr - la0)  # down the forearm
    out = np.array([1.0, 0, 0])
    out -= ax * out.dot(ax)
    out /= np.linalg.norm(out)
    fwd = np.cross(ax, out)
    if fwd[2] < 0:
        fwd = -fwd
    centre = la0 + (wr - la0) * 0.62 + out * 0.07
    Mb = rest_to_bind(D, "lowerarm01.L")
    sp = mat4(D["sockets"]["spineUpper"])[:3, 3]
    for p in sh:
        P = dec(p["pos"], np.float32, 3).astype(np.float64)
        F = dec(p["idx"], np.uint32, 3).astype(np.int64)
        c = p["colors"][0]
        col = np.array([((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255])
        boss = np.linalg.norm(P[:, :2], axis=1).max() < 0.12
        # shield frame: +Z face, +Y up (the handle runs along X)
        Pa = frame_place(P, centre, fwd, -ax, out)
        pieces.append(Piece(xform(Mb, Pa), F, rigid_weights(len(P), BI["lowerarm01.L"]), R["boss"] if boss else R["shieldArm"], col, 0, "shieldArm"))
        # on the back: face -Z, centred on the upper back
        Pb = frame_place(P, sp + np.array([0.0, -0.08, -0.16]), np.array([-1.0, 0, 0]), np.array([0, 1.0, 0]), np.array([0, 0.25, -1.0]) / np.linalg.norm([0, 0.25, -1.0]))
        pieces.append(Piece(xform(rest_to_bind(D, "spine01"), Pb), F, rigid_weights(len(P), BI["spine01"]), R["bossBack"] if boss else R["shieldBack"], col, 0, "shieldBack"))
    back = sp + np.array([0.0, 0.0, -0.13])
    Ms = rest_to_bind(D, "spine01")
    Wsp = lambda n: rigid_weights(n, BI["spine01"])
    if israel:
        # bow: a simple self bow (≈1.2 m) slung diagonally across the back; quiver of reed arrows on the right shoulder
        tt = np.linspace(-1, 1, 9)
        d = np.array([0.55, 0.83, 0.0])
        d /= np.linalg.norm(d)
        n2 = np.array([-d[1], d[0], 0.0])
        path = back[None, :] + np.outer(tt * 0.6, d) + np.outer((1 - tt ** 2) * 0.09, n2) + np.array([0, 0, -0.03])
        P, F = tube(path, 0.011, 5)
        pieces.append(Piece(xform(Ms, P), F, Wsp(len(P)), R["bow"], [0.36, 0.24, 0.13], 0, "bow"))
        q0 = back + np.array([-0.12, -0.2, -0.03])
        q1 = back + np.array([0.08, 0.36, -0.07])
        P, F = tube(np.linspace(q0, q1, 3), [0.045, 0.05, 0.052], 7)
        pieces.append(Piece(xform(Ms, P), F, Wsp(len(P)), R["quiver"], [0.33, 0.22, 0.14], 0, "quiver"))
        P, F = tube(np.linspace(q1, q1 + (q1 - q0) / np.linalg.norm(q1 - q0) * 0.14, 2), 0.04, 6)
        pieces.append(Piece(xform(Ms, P), F, Wsp(len(P)), R["quiver"], [0.78, 0.74, 0.62], 0, "fletch"))
        # bedroll (rolled mantle) across the upper back, tied
        b0 = back + np.array([-0.2, 0.08, -0.05])
        b1 = back + np.array([0.2, 0.08, -0.05])
        P, F = tube(np.linspace(b0, b1, 4), [0.06, 0.075, 0.075, 0.06], 8)
        pieces.append(Piece(xform(Ms, P), F, Wsp(len(P)), R["bedroll"], [1, 1, 1], 0, "bedroll"))
        # waterskin on the right hip
        pel = mat4(D["bonesRest"]["root"])[:3, 3]
        P, F = ellipsoid(pel + np.array([-0.2, -0.12, -0.02]), [0.05, 0.1, 0.07], 7, 5)
        pieces.append(Piece(xform(rest_to_bind(D, "root"), P), F, rigid_weights(len(P), BI["root"]), R["waterskin"], [0.3, 0.2, 0.12], 0, "waterskin"))
    else:
        # reed / feather crown (Medinet Habu Peleset): vertical strips on a band, flaring upward
        ca = mat4(D["sockets"]["crownAnchor"])[:3, 3]
        rx, rz = D["metrics"]["crownRadius"]
        P, F = [], []
        nb = 22
        for k in range(nb + 1):
            th = 2 * math.pi * k / nb
            for (h, s) in ((-0.035, 1.12), (0.02, 1.2), (0.13, 1.45)):
                P.append(ca + np.array([math.sin(th) * rx * s, h, math.cos(th) * rz * s]))
        for k in range(nb):
            for r in range(2):
                a, b = k * 3 + r, (k + 1) * 3 + r
                F += [[a, b, b + 1], [a, b + 1, a + 1]]
        P = np.array(P)
        pieces.append(Piece(P, np.array(F), rigid_weights(len(P), BI["head"]), R["crown"], [0.86, 0.8, 0.62], 0, "crown"))
        # bronze helmet (17:5 "וְכוֹבַע נְחֹשֶׁת"): a rounded cap with a low ridge
        P, F = ellipsoid(ca + np.array([0, -0.005, -0.005]), [rx * 1.2, 0.12, rz * 1.16], 12, 7)
        keep = P[:, 1] > ca[1] - 0.04
        idx = -np.ones(len(P), np.int64)
        idx[keep] = np.arange(keep.sum())
        Fk = np.array([f for f in F if keep[f].all()])
        P = P[keep]
        pieces.append(Piece(P, idx[Fk], rigid_weights(len(P), BI["head"]), R["helmet"], [0.6, 0.4, 0.22], 0, "helmet"))
    return pieces, gripBind


LOD_TARGET = {
    # piece name -> triangles per LOD (0, 1, 2); None = drop at that LOD
    "body": (2400, 900, 300), "tunicUpper": (700, 260, 70), "tunicSkirt": (560, 200, 60), "tunicSleeves": (240, 60, None),
    "jerkinUpper": (400, 150, 60), "jerkinSkirt": (150, 60, None), "belt": (80, 30, None), "sandals": (160, 40, None),
    "headband": (60, 24, None), "headcloth": (80, 30, 12), "eye": (24, None, None), "spear": (60, 24, 10),
    "shieldArm": (70, 36, 16), "shieldBack": (70, 36, 16), "bow": (60, 30, 12), "quiver": (70, 30, 12), "fletch": (12, 12, None),
    "bedroll": (48, 24, 12), "waterskin": (40, 20, None), "crown": (88, 44, 22), "helmet": (100, 50, 24), "greaves": (160, 60, None),
    "hair": (400, 160, 60), "beard": (200, 80, 30), "rigid": (40, 16, None),
}


def shells(body: Piece, israel: bool):
    """hair (scalp) and beard volumes: the body's region surface pushed out along the normal"""
    out = []
    N = normals(body.P, body.F)
    for reg, name, th in ((R["scalp"], "hair", 0.016), (R["beard"], "beard", 0.02)):
        if name == "beard" and not israel:
            continue
        sel = body.region == reg
        fsel = sel[body.F].sum(1) >= 2
        Fs = body.F[fsel]
        used = np.unique(Fs)
        m = -np.ones(len(body.P), np.int64)
        m[used] = np.arange(len(used))
        P = body.P[used].copy()
        t = np.full(len(used), th)
        if name == "beard":
            chin = np.array(rig["landmarks"]["chin"])
            # fuller at the chin and jaw, short on the cheeks
            t = th * (0.45 + 1.4 * np.clip((chin[1] + 0.04 - P[:, 1]) / 0.06 + 0.5, 0, 1.2))
            P[:, 1] -= np.clip((chin[1] + 0.01 - P[:, 1]) / 0.05, 0, 1) * 0.025
        else:
            # a little more volume at the back of the head and the nape
            t = th * (1 + 0.5 * np.clip(-(P[:, 2] - 0.02) / 0.08, 0, 1))
        P += N[used] * t[:, None]
        out.append(Piece(P, m[Fs], body.W[used], R["hair"] if name == "hair" else R["beard"], [1, 1, 1], 0, name))
    return out


def pack_lod(pieces):
    Ps, Ns, Js, Ws, Rs, Cs, Ms, Fs = [], [], [], [], [], [], [], []
    base = 0
    for pc in pieces:
        n = len(pc.P)
        Ps.append(pc.P.astype(np.float32))
        Nn = normals(pc.P, pc.F) if pc.prop == 0 else normals(pc.P, pc.F)
        Ns.append(np.clip(np.round(Nn * 127), -127, 127).astype(np.int8))
        idx = np.argsort(-pc.W, axis=1)[:, :4]
        w = np.take_along_axis(pc.W, idx, 1)
        w /= np.maximum(w.sum(1, keepdims=True), 1e-6)
        wq = np.round(w * 255).astype(np.int32)
        wq[:, 0] += 255 - wq.sum(1)
        Js.append(idx.astype(np.uint8))
        Ws.append(np.clip(wq, 0, 255).astype(np.uint8))
        Rs.append(pc.region.astype(np.uint8))
        Cs.append(np.clip(np.round(pc.C * 255), 0, 255).astype(np.uint8))
        Ms.append(np.full(n, pc.prop, np.uint8))
        Fs.append(pc.F + base)
        base += n
    P = np.concatenate(Ps)
    return dict(position=P, normal=np.concatenate(Ns), joints=np.concatenate(Js), weights=np.concatenate(Ws),
                region=np.concatenate(Rs), color=np.concatenate(Cs), prop=np.concatenate(Ms),
                index=np.concatenate(Fs).astype(np.uint16 if base < 65536 else np.uint32).reshape(-1))


def main():
    src = sys.argv[1]
    E = json.load(open(src))
    os.makedirs(OUT, exist_ok=True)
    for army in ("israel", "philistine"):
        D = E[army]
        pieces, gripBind = build(D, army)
        header = {"army": army, "bones": MOCAP_BONES, "gripBind": gripBind.T.reshape(-1).tolist(), "lods": [],
                  "regions": R, "heads": {b: HEADS[b].tolist() for b in MOCAP_BONES if b in HEADS}}
        blobs = []
        off = 0
        for lod in range(3):
            lp = []
            for pc in pieces:
                key = pc.name if pc.name in LOD_TARGET else ("eye" if pc.name == "eye" else "rigid")
                tgt = LOD_TARGET.get(key, LOD_TARGET["rigid"])[lod]
                if tgt is None:
                    continue
                if pc.name == "eye" and lod > 0:
                    continue
                s = simplify(pc, tgt, border=(lod == 0), agg=6 if lod == 0 else 8)
                lp.append(s)
                if pc.name == "body":
                    lp.extend(simplify(x, LOD_TARGET[x.name][lod], border=(lod == 0)) for x in shells(s, army == "israel") if LOD_TARGET[x.name][lod])
            packed = pack_lod(lp)
            entry = {"vertices": int(len(packed["position"])), "triangles": int(len(packed["index"]) // 3), "attrs": {}}
            for k, a in packed.items():
                b = np.ascontiguousarray(a).tobytes()
                entry["attrs"][k] = {"offset": off, "bytes": len(b), "type": str(a.dtype), "itemSize": int(a.shape[1]) if a.ndim > 1 else 1}
                blobs.append(b)
                off += len(b)
                pad = (-off) % 4
                if pad:
                    blobs.append(b"\0" * pad)
                    off += pad
            header["lods"].append(entry)
            print(f"{army} LOD{lod}: {entry['vertices']} verts, {entry['triangles']} tris", {pc.name: len(pc.F) for pc in lp} if lod == 2 else "")
        hj = json.dumps(header, separators=(",", ":")).encode()
        hj += b" " * ((-len(hj)) % 4)
        data = struct.pack("<I", len(hj)) + hj + b"".join(blobs)
        gz = gzip.compress(data, 9)
        with open(os.path.join(OUT, f"{army}.binz"), "wb") as f:
            f.write(gz)
        print(f"  wrote {army}.binz {len(data) / 1e3:.0f} KB raw, {len(gz) / 1e3:.0f} KB gzip")


if __name__ == "__main__":
    main()
