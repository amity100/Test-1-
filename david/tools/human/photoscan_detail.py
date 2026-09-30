#!/usr/bin/env python3
"""
Photoscan skin detail transfer: Infinite-Realities "Lee Perry-Smith" head scan (CC BY 3.0) -> MakeHuman hm08 UV.

    python3 tools/human/photoscan_detail.py build          # mapping + high-pass layers (preset independent)
    python3 tools/human/photoscan_detail.py apply david    # blend them into the preset's baked 2K/1K maps
    python3 tools/human/photoscan_detail.py views          # debug: front renders of both heads (landmark picking)

Only the HIGH-FREQUENCY part of the scan is transferred (pores, fine wrinkles, lip lines, micro relief, albedo and
specular variation); every preset keeps its own colour, age, freckles and anatomy from bake_skin.py.

Method
  1. The scan (tools/human/ref/lps/, downloaded from raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/
     gltf/LeePerrySmith/) is rasterised in its own UV space: per texel 3D position.
  2. Its tangent-space normal map is integrated (FFT Poisson) to a height field; height, log-luminance and specular
     are high-passed (Gaussian, ~2.5 mm) so only detail remains.
  3. Landmarks picked on front renders of both heads (eye corners, brow, nose, mouth, chin) give a similarity
     transform + a thin-plate-spline warp of the MakeHuman head into the scan; each MakeHuman texel of the head
     island is then mapped to the nearest scan surface texel (KD-tree) and samples the detail there.
  4. The detail is stored in MakeHuman UV space (tools/human/ref/lps_detail_2048.npz) with a confidence weight
     (face and scalp-free zones only, faded at the scan's holes / neck cut / ears / eyeballs).
  5. `apply` blends it into the preset's baked maps: albedo *= exp(k_a * detail), height detail -> tangent normal
     (whiteout-blended), mask G (roughness) and R (cavity) modulated; 1K maps are downsampled from the 2K result
     (phones get the detail at no runtime cost). Pristine pre-transfer maps are kept in tools/human/ref/pre_lps/.
"""
from __future__ import annotations

import json
import os
import shutil
import struct
import sys
import time
import urllib.request

import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.interpolate import RBFInterpolator
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
LPS = os.path.join(HERE, "ref", "lps")
URL = "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/LeePerrySmith/"
FILES = ["LeePerrySmith.glb", "Map-COL.jpg", "Map-SPEC.jpg", "Infinite-Level_02_Tangent_SmoothUV.jpg"]
DETAIL = os.path.join(HERE, "ref", "lps_detail_2048.npz")
PRE = os.path.join(HERE, "ref", "pre_lps")
OUT = os.path.join(HERE, "..", "..", "src", "assets", "human")
DBG = os.environ.get("LPS_DBG", "/tmp")

# Landmarks, picked on the front orthographic renders written by `views` (pixel coords in a 512 x 512 image whose
# frame is given by the 'frame' entry: centre x/y and metres per pixel). Order matters (same list for both heads).
LM_NAMES = ["eyeInR", "eyeOutR", "eyeInL", "eyeOutL", "browMid", "noseTip", "subnasale", "mouthR", "mouthL",
            "upperLip", "lowerLip", "chin", "alarR", "alarL"]


def fetch():
    os.makedirs(LPS, exist_ok=True)
    for f in FILES:
        p = os.path.join(LPS, f)
        if not os.path.exists(p):
            print("  download", f)
            urllib.request.urlretrieve(URL + f, p)


def load_glb(path):
    b = open(path, "rb").read()
    _, _, L = struct.unpack("<III", b[:12])
    off, chunks = 12, []
    while off < L:
        cl, ct = struct.unpack("<II", b[off:off + 8])
        chunks.append(b[off + 8:off + 8 + cl])
        off += 8 + cl
    J = json.loads(chunks[0])
    binc = chunks[1]

    def acc(i):
        a = J["accessors"][i]
        bv = J["bufferViews"][a["bufferView"]]
        dt = {5123: np.uint16, 5125: np.uint32, 5126: np.float32}[a["componentType"]]
        nc = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[a["type"]]
        o = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        arr = np.frombuffer(binc, dt, a["count"] * nc, o)
        return arr.reshape(-1, nc) if nc > 1 else arr

    pr = J["meshes"][0]["primitives"][0]
    pos = acc(pr["attributes"]["POSITION"]).astype(np.float64)
    uv = acc(pr["attributes"]["TEXCOORD_0"]).astype(np.float64)
    nrm = acc(pr["attributes"]["NORMAL"]).astype(np.float64)
    idx = acc(pr["indices"]).astype(np.int64).reshape(-1, 3)
    return pos, nrm, uv, idx


def raster_uv(uv, tris, S, flipv):
    """Per texel triangle id + barycentrics of a mesh in its own UV space (glTF: v down; MakeHuman: v up)."""
    tid = np.full((S, S), -1, np.int32)
    bary = np.zeros((S, S, 3), np.float32)
    px = uv[:, 0] * S - 0.5
    py = (uv[:, 1] if not flipv else 1 - uv[:, 1]) * S - 0.5
    X, Y = px[tris], py[tris]
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
        tid[gy[m], gx[m]] = t
        bary[gy[m], gx[m]] = np.stack([w0[m], w1[m], w2[m]], -1)
    return tid, bary


def lps_texels():
    """The scan in metres, facing +z, y up, eyes near the origin; per-texel (1024^2) positions + validity."""
    pos, nrm, uv, tris = load_glb(os.path.join(LPS, "LeePerrySmith.glb"))
    S = 1024
    tid, bary = raster_uv(uv, tris, S, flipv=True)
    valid = tid >= 0
    t = tid[valid]
    P = np.einsum("nk,nkc->nc", bary[valid], pos[tris[t]])
    N = np.einsum("nk,nkc->nc", bary[valid], nrm[tris[t]])
    N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
    # per texel metric (scan units per uv unit) for the normal-map integration
    e1 = pos[tris[t, 1]] - pos[tris[t, 0]]
    e2 = pos[tris[t, 2]] - pos[tris[t, 0]]
    d1 = uv[tris[t, 1]] - uv[tris[t, 0]]
    d2 = uv[tris[t, 2]] - uv[tris[t, 0]]
    r = d1[:, 0] * d2[:, 1] - d2[:, 0] * d1[:, 1]
    r = np.where(np.abs(r) < 1e-14, 1e-14, r)
    dPdu = (e1 * d2[:, 1:2] - e2 * d1[:, 1:2]) / r[:, None]
    dPdv = (e2 * d1[:, 0:1] - e1 * d2[:, 0:1]) / r[:, None]
    return dict(pos=pos, nrm=nrm, uv=uv, tris=tris, S=S, valid=valid, P=P, N=N,
                mpu=np.linalg.norm(dPdu, axis=1), mpv=np.linalg.norm(dPdv, axis=1))


def ortho_front(P, col, frame, size=512, axes=(0, 1, 2)):
    """Point-splat orthographic front render (z-buffered). frame = (cx, cy, metres per pixel)."""
    cx, cy, mpp = frame
    x = ((P[:, axes[0]] - cx) / mpp + size / 2).astype(int)
    y = (size / 2 - (P[:, axes[1]] - cy) / mpp).astype(int)
    z = P[:, axes[2]]
    m = (x >= 0) & (x < size) & (y >= 0) & (y < size)
    x, y, z, c = x[m], y[m], z[m], col[m]
    o = np.argsort(z)  # far first, near overwrites
    img = np.zeros((size, size, 3), np.float32)
    zb = np.full((size, size), -1e9)
    img[y[o], x[o]] = c[o]
    zb[y[o], x[o]] = z[o]
    return img, zb


def mh_head():
    from bake_skin import Baker
    B = Baker("david", 2048)
    B.rasterize()
    return B


# Landmark picks. LPS: pixels of a 1024^2 front render, frame centre (0, 1.3) scan units, 4/1024 units per pixel.
# MH (david, preset independent enough - every preset shares the hm08 topology/UVs): 1024^2 render, frame centre
# (E.x, E.y - 0.03) m, 0.2/1024 m per pixel. noseTip / chin of MH come from build_human.landmarks().
LM_LPS = {"eyeOutR": (260, 420), "eyeInR": (415, 427), "eyeInL": (565, 427), "eyeOutL": (720, 418),
          "browMid": (490, 365), "noseTip": (490, 568), "subnasale": (490, 618), "mouthR": (382, 743),
          "mouthL": (602, 743), "upperLip": (490, 710), "lowerLip": (490, 762), "chin": None,
          "alarR": (422, 590), "alarL": (558, 590)}
LM_MH = {"eyeOutR": (285, 370), "eyeInR": (410, 368), "eyeInL": (614, 368), "eyeOutL": (739, 370),
         "browMid": (512, 312), "noseTip": None, "subnasale": (512, 585), "mouthR": (390, 715),
         "mouthL": (637, 715), "upperLip": (512, 658), "lowerLip": (512, 755), "chin": None,
         "alarR": (442, 555), "alarL": (582, 555)}
LPS_UNIT = 0.0496  # metres per scan unit (eye fissure 3.0 cm)


def pick3d(P, frame, px, size=1024, radius=3):
    """3D point of the front-most surface under pixel px of an ortho_front render."""
    cx, cy, mpp = frame
    x, y = px
    X = (x - size / 2) * mpp + cx
    Y = cy - (y - size / 2) * mpp
    d = np.hypot(P[:, 0] - X, P[:, 1] - Y)
    m = d < radius * mpp
    if not m.any():
        m = d < 4 * radius * mpp
    return np.array([X, Y, P[m, 2].max()])


def lps_auto(P):
    """Nose tip (most forward midline point between eyes and mouth) and chin of the scan (scan units)."""
    mid = np.abs(P[:, 0]) < 0.03
    band = mid & (P[:, 1] > 0.2) & (P[:, 1] < 1.2)
    nose = P[band][np.argmax(P[band, 2])]
    low = mid & (P[:, 1] < -0.05) & (P[:, 1] > -0.8)
    chin = P[low][np.argmax(P[low, 2] - 0.35 * P[low, 1])]
    return nose, chin


def umeyama(A, B):
    """s, R, t minimising |s R A + t - B|."""
    ma, mb = A.mean(0), B.mean(0)
    A0, B0 = A - ma, B - mb
    U, S, Vt = np.linalg.svd(B0.T @ A0 / len(A))
    D = np.eye(3)
    if np.linalg.det(U @ Vt) < 0:
        D[2, 2] = -1
    R = U @ D @ Vt
    s = np.trace(np.diag(S) @ D) / (A0 ** 2).sum(1).mean()
    return s, R, mb - s * R @ ma


def integrate(gx, gy, valid):
    """Least-squares height from per-texel gradients (FFT Poisson, periodic), zero-mean."""
    gx = np.where(valid, gx, 0.0)
    gy = np.where(valid, gy, 0.0)
    H, W = gx.shape
    # divergence (backward differences of forward-difference gradients)
    div = (gx - np.roll(gx, 1, 1)) + (gy - np.roll(gy, 1, 0))
    ky = np.fft.fftfreq(H)[:, None]
    kx = np.fft.fftfreq(W)[None, :]
    den = (2 * np.cos(2 * np.pi * kx) - 2) + (2 * np.cos(2 * np.pi * ky) - 2)
    den[0, 0] = 1
    Hf = np.fft.fft2(div) / den
    Hf[0, 0] = 0
    return np.real(np.fft.ifft2(Hf))


def masked_blur(img, valid, sigma):
    w = ndimage.gaussian_filter(valid.astype(np.float64), sigma)
    return ndimage.gaussian_filter(np.where(valid, img, 0.0), sigma) / np.maximum(w, 1e-6)


def build():
    t0 = time.time()
    fetch()
    L = lps_texels()
    S = L["S"]
    valid = L["valid"]
    vy, vx = np.nonzero(valid)
    P = L["P"]
    # ---- scan detail layers (scan UV space)
    col = np.asarray(Image.open(os.path.join(LPS, "Map-COL.jpg")).convert("RGB"), np.float64) / 255
    col = np.where(col <= 0.04045, col / 12.92, ((col + 0.055) / 1.055) ** 2.4)
    spec = np.asarray(Image.open(os.path.join(LPS, "Map-SPEC.jpg")).convert("L"), np.float64) / 255
    nm = np.asarray(Image.open(os.path.join(LPS, "Infinite-Level_02_Tangent_SmoothUV.jpg")).convert("RGB"), np.float64) / 255 * 2 - 1
    mpu = np.zeros((S, S))
    mpv = np.zeros((S, S))
    mpu[vy, vx] = L["mpu"] * LPS_UNIT / S  # metres per texel step
    mpv[vy, vx] = L["mpv"] * LPS_UNIT / S
    nz = np.maximum(nm[..., 2], 0.2)
    sgn = float(os.environ.get("LPS_NSIGN", "1"))
    gx = -nm[..., 0] / nz * mpu
    gy = sgn * nm[..., 1] / nz * mpv  # image rows run along -v
    er = ndimage.binary_erosion(valid, iterations=3)
    h = integrate(gx, gy, er)
    tex_mm = float(np.median(L["mpu"])) * LPS_UNIT / S * 1000
    print(f"  scan texel ~{tex_mm:.3f} mm")
    s1 = 1.1 / tex_mm  # ~1.1 mm: pores, micro relief
    s2 = 4.5 / tex_mm  # ~4.5 mm: fine wrinkles, lip lines, creases
    hb1 = masked_blur(h, er, s1)
    hb2 = masked_blur(h, er, s2)
    lum = np.log(np.maximum(col @ np.array([0.2126, 0.7152, 0.0722]), 1e-3))
    lb1 = masked_blur(lum, er, s1)
    lb2 = masked_blur(lum, er, s2)
    rg = np.log(np.maximum(col[..., 0], 1e-3) / np.maximum(col[..., 1], 1e-3))
    rgb2 = masked_blur(rg, er, s2)
    sl = np.log(np.maximum(spec, 0.02))
    sb2 = masked_blur(sl, er, s2)
    layers = np.stack([h - hb1, hb1 - hb2, lum - lb1, lb1 - lb2, rg - rgb2, sl - sb2], -1)
    layers[~er] = 0
    # ---- landmarks and warp
    fL = (0.0, 1.3, 4.0 / 1024)
    B = np.load(os.path.join(DBG, "mh_tex.npz")) if os.environ.get("LPS_CACHE") else None
    if B is None:
        Bk = mh_head()
        mh = dict(vy=Bk.vy, vx=Bk.vx, tp=Bk.tp, tn=Bk.tn, island=Bk.island, E=Bk.E, mpu=Bk.mpu, mpv=Bk.mpv)
        lmh = Bk.lm
    else:
        mh = dict(B)
        lmh = json.loads(str(B["lm"]))
    E = mh["E"]
    fM = (float(E[0]), float(E[1]) - 0.03, 0.2 / 1024)
    head = mh["island"] == 2
    MP = mh["tp"][head].astype(np.float64)
    MN = mh["tn"][head].astype(np.float64)
    nose_l, chin_l = lps_auto(P)
    A, Bp = [], []
    for k in LM_NAMES + ["chin"]:
        if k in ("noseTip", "chin"):
            a = np.array(lmh[k])
            b = nose_l if k == "noseTip" else chin_l
        else:
            a = pick3d(MP, fM, LM_MH[k])
            b = pick3d(P, fL, LM_LPS[k])
        A.append(a)
        Bp.append(b)
    A, Bp = np.array(A), np.array(Bp)
    s, R, t = umeyama(A, Bp)
    Ai = (s * (R @ A.T)).T + t
    print("  similarity scale", s, "rms landmark err (scan units)", np.sqrt(((Ai - Bp) ** 2).sum(1).mean()))
    for k, e in zip(LM_NAMES + ["chin"], np.linalg.norm(Ai - Bp, axis=1)):
        print(f"    {k:10s} {e * LPS_UNIT * 1000:5.1f} mm")
    # thin-plate warp of the residuals (face) + an identity anchor ring far away (skull) so the back stays rigid
    Q = (s * (R @ MP.T)).T + t
    ring = []
    c = Bp.mean(0)
    for a in np.linspace(0, 2 * np.pi, 12, endpoint=False):
        for yy in (-2.5, 0.0, 2.5):
            ring.append(c + np.array([3.2 * np.cos(a), yy, 3.2 * np.sin(a) - 1.0]))
    ring = np.array(ring)
    src = np.concatenate([Ai, ring])
    dst = np.concatenate([Bp, ring])
    rbf = RBFInterpolator(src, dst - src, kernel="thin_plate_spline", smoothing=0.02)
    Qw = Q + rbf(Q)
    Nw = (R @ MN.T).T
    tree = cKDTree(P)
    d, j = tree.query(Qw, k=1, workers=4)
    ok = (d < 0.25) & (np.einsum("ij,ij->i", Nw, L["N"][j]) > 0.35)
    # confidence: full on the face, less on the scalp / back (hair covers it anyway), faded near the eyes' openings
    # (the scan's lashes), and zero on the ear backs / where the match is poor
    w = np.clip(1 - (d - 0.08) / 0.17, 0, 1) * ok
    eL = pick3d(MP, fM, ((LM_MH["eyeInL"][0] + LM_MH["eyeOutL"][0]) / 2, 369))
    eR = pick3d(MP, fM, ((LM_MH["eyeInR"][0] + LM_MH["eyeOutR"][0]) / 2, 369))
    de = np.minimum(np.linalg.norm(MP - eL, axis=1), np.linalg.norm(MP - eR, axis=1))
    w *= np.clip((de - 0.012) / 0.008, 0, 1) * 0.75 + 0.25 * np.clip((de - 0.008) / 0.004, 0, 1)
    out = np.zeros((2048, 2048, 9), np.float32)
    ly, lx = vy[j], vx[j]
    hy, hx = mh["vy"][head], mh["vx"][head]
    vals = layers[ly, lx]
    vals[:, :2] *= 1000  # height layers in mm (float16 friendly)
    out[hy, hx, :6] = vals
    out[hy, hx, 6] = w
    # MakeHuman texel size (mm per texel step along +u / +v) for the height -> normal conversion
    out[mh["vy"], mh["vx"], 7] = mh["mpu"] / 2048 * 1000
    out[mh["vy"], mh["vx"], 8] = mh["mpv"] / 2048 * 1000
    np.savez_compressed(DETAIL, detail=out.astype(np.float16), info=json.dumps({"s": s, "tex_mm": tex_mm}))
    print(f"  wrote {DETAIL} in {time.time() - t0:.0f}s, matched {ok.mean() * 100:.1f}% of head texels")
    # debug views: the mapped albedo detail and height detail in MH UV
    dbg = np.clip(0.5 + 6 * (out[..., 2] + out[..., 3]) * out[..., 6], 0, 1)
    Image.fromarray((dbg * 255).astype(np.uint8)).resize((1024, 1024)).save(os.path.join(DBG, "lps_albedo_hp.png"))
    hd = (out[..., 0] + out[..., 1]) * out[..., 6]
    dbg = np.clip(0.5 + hd / (np.percentile(np.abs(hd[hy, hx]), 99) + 1e-9) * 0.5, 0, 1)
    Image.fromarray((dbg * 255).astype(np.uint8)).resize((1024, 1024)).save(os.path.join(DBG, "lps_height_hp.png"))
    hs = h - hb2
    Image.fromarray((np.clip(0.5 + hs / (np.percentile(np.abs(hs[er]), 99) + 1e-9) * 0.5, 0, 1) * 255).astype(np.uint8)).save(os.path.join(DBG, "lps_scan_height.png"))


# per preset strengths: fine height (pores/micro), mid height (fine wrinkles), fine / mid albedo, redness, specular.
# David is a youth (1 Sam 17:33,42): full micro detail, few wrinkles; Saul mature (older than David by a generation,
# a king in his reign's middle years), Samuel very old (1 Sam 12:2 "וַאֲנִי זָקַנְתִּי וָשַׂבְתִּי").
STRENGTH = {
    "david": dict(hf=1.0, hm=0.3, af=0.75, am=0.2, rg=0.35, sp=0.6, cav=0.6),
    "saul": dict(hf=1.1, hm=0.95, af=0.9, am=0.55, rg=0.5, sp=0.7, cav=1.0),
    "man": dict(hf=1.0, hm=0.8, af=0.85, am=0.5, rg=0.45, sp=0.6, cav=0.9),
    "elder": dict(hf=1.1, hm=1.2, af=0.9, am=0.7, rg=0.5, sp=0.5, cav=1.1),
    "samuel": dict(hf=1.1, hm=1.3, af=0.9, am=0.75, rg=0.5, sp=0.5, cav=1.2),
}


def _srgb2lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _lin2srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def apply(preset, refresh=False):
    """Blend the scan detail into src/assets/human/<preset>/{albedo,normal,mask}_{2k,1k}.webp (idempotent: always
    starts from the pristine pre-transfer maps; refresh=True re-snapshots them, used right after a new bake)."""
    t0 = time.time()
    if not os.path.exists(DETAIL):
        build()
    D = np.load(DETAIL)["detail"].astype(np.float32)
    k = STRENGTH.get(preset, STRENGTH["man"])
    src = os.path.join(OUT, preset)
    pre = os.path.join(PRE, preset)
    os.makedirs(pre, exist_ok=True)
    for f in ("albedo_2k.webp", "normal_2k.webp", "mask_2k.webp"):
        if refresh or not os.path.exists(os.path.join(pre, f)):
            shutil.copy2(os.path.join(src, f), os.path.join(pre, f))
    alb = np.asarray(Image.open(os.path.join(pre, "albedo_2k.webp")).convert("RGB"), np.float32) / 255
    nrm = np.asarray(Image.open(os.path.join(pre, "normal_2k.webp")).convert("RGB"), np.float32) / 255 * 2 - 1
    msk = np.asarray(Image.open(os.path.join(pre, "mask_2k.webp")).convert("RGB"), np.float32) / 255
    if alb.shape[0] != 2048:
        raise SystemExit("expected 2K maps")
    w = D[..., 6]
    # albedo: luminance (log) detail + a little redness variation, clamped so the preset's own colour survives
    lum = np.clip(w * (k["af"] * D[..., 2] + k["am"] * D[..., 3]), -0.35, 0.3)
    rg = np.clip(w * k["rg"] * D[..., 4], -0.15, 0.15)
    lin = _srgb2lin(alb) * np.exp(lum)[..., None]
    lin[..., 0] *= np.exp(0.5 * rg)
    lin[..., 1] *= np.exp(-0.35 * rg)
    lin[..., 2] *= np.exp(-0.25 * rg)
    alb2 = _lin2srgb(lin)
    # normal: height detail (mm) -> tangent-space slopes, whiteout-blended onto the baked normal
    H = w * (k["hf"] * D[..., 0] + k["hm"] * D[..., 1])
    gy, gx = np.gradient(H)
    mpu = np.maximum(D[..., 7], 0.05)
    mpv = np.maximum(D[..., 8], 0.05)
    dx = gx / mpu
    dy = -gy / mpv
    n2 = np.stack([nrm[..., 0] - dx, nrm[..., 1] - dy, nrm[..., 2]], -1)
    n2 /= np.linalg.norm(n2, axis=-1, keepdims=True) + 1e-9
    # mask: R (AO x cavity) darkens in the fine creases, G (roughness) follows the scan's specular variation
    Hs = H / (np.percentile(np.abs(H[w > 0.5]), 95) + 1e-6)
    m2 = msk.copy()
    m2[..., 0] *= np.clip(1 + 0.08 * k["cav"] * np.minimum(Hs, 0.6), 0.84, 1.04)
    m2[..., 1] = np.clip(msk[..., 1] * np.exp(-0.45 * k["sp"] * w * np.clip(D[..., 5], -0.8, 0.8)), 0.2, 1)
    save = lambda a, n, q: Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB").save(os.path.join(src, n), quality=q, method=6)
    save(alb2, "albedo_2k.webp", 90)
    save(n2 * 0.5 + 0.5, "normal_2k.webp", 92)
    save(m2, "mask_2k.webp", 90)
    half = lambda a: np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB").resize((1024, 1024), Image.LANCZOS)).astype(np.float32) / 255
    save(half(alb2), "albedo_1k.webp", 90)
    n1 = half(n2 * 0.5 + 0.5) * 2 - 1
    n1 /= np.linalg.norm(n1, axis=-1, keepdims=True) + 1e-9
    save(n1 * 0.5 + 0.5, "normal_1k.webp", 92)
    save(half(m2), "mask_1k.webp", 90)
    print(f"  {preset}: scan detail applied in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    if cmd == "build":
        build()
    elif cmd == "apply":
        for p in sys.argv[2:]:
            apply(p)
