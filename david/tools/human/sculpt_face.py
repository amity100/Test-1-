#!/usr/bin/env python3
"""
Face sculpt deltas (face pass 2): real bone / fat structure for the MakeHuman heads.

MakeHuman's modifiers alone leave generic faces. This tool morphs a preset's FACE partially toward the geometry of a
real human head — the Infinite-Realities "Lee Perry-Smith" photoscan (CC BY 3.0, the same scan the skin detail comes
from, tools/human/photoscan_detail.py) — and adds explicit, named landmark goals (cheekbone width, jaw angle, chin,
brow ridge, temples, lids ...) on top.

  1. The 14 face landmarks (eye corners, brow, nose tip, subnasale, alar, mouth corners, lips, chin) of the preset
     and of the scan drive a similarity transform (umeyama) MakeHuman -> scan, then a thin-plate warp of the residuals
     in the FRONTAL PLANE ONLY (x, y): the features line up in the picture plane but the depth profile of the scan
     (brow ridge, sockets, cheekbones, nose projection, chin) is kept — that depth profile is the structure we want.
  2. Every face vertex takes the NORMAL component of its offset to the nearest scan surface point; the offset field is
     masked (the face in front of the ears, below the hairline so the skull lock / groom stay valid, above the neck,
     zero on the lids so the eyeballs stay seated) and low-passed on the mesh (Laplacian, ~6-10 mm) — bone and fat,
     not skin detail (the detail is in the normal maps).
  3. Named goals (Gaussian pushes in head space, millimetres) sculpt what the reference asks for.
  4. The result is a per-vertex delta (metres, every base-mesh vertex incl. helpers: teeth follow the mouth, the
     eyeballs and the cranium do not move) saved to tools/human/ref/sculpt_<preset>.npz. A preset with
        "sculpt": {"file": "ref/sculpt_<preset>.npz", "amount": 1.0}
     gets it applied by build_human.Human before the skeleton / weights / rest pose / skull lock (all consistent).

    python3 tools/human/sculpt_face.py <preset>        # writes ref/sculpt_<preset>.npz (settings: SETTINGS below)
    then: python3 tools/human/build_human.py <preset> && python3 tools/human/bake_skin.py <preset>
"""
from __future__ import annotations

import json
import os
import sys
import time

import numpy as np
from scipy.interpolate import RBFInterpolator
from scipy.spatial import cKDTree
import scipy.sparse as sp

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from build_human import Human, NBODY, head_mask, landmarks, eye_data  # noqa: E402
import photoscan_detail as PD  # noqa: E402

LM_IDX = os.path.join(HERE, "ref", "lps_lm_idx.json")

# per preset: fraction of the scan's structure, and named goals: (centre relative to the eye midpoint E [m],
# radii [m], push [mm] along a direction: 'out' = away from the midline in x, 'fwd' = +z, 'up' = +y, or a vector)
SETTINGS: dict[str, dict] = {
    # David (visual-bible 3.13, the reference image): a youth ~17 — some real structure (brow ridge, cheekbones,
    # nose bridge, chin) but young, full cheeks; the reference's face is WIDER at the cheekbones and the jaw than ours,
    # with a defined square-ish chin and full, defined lips.
    "david": {"amount": 0.8, "scanLow": 0.15, "goals": [
        ("cheekbone", (0.043, -0.026, -0.018), (0.016, 0.012, 0.02), 3.6, "out"),
        ("cheekboneFwd", (0.036, -0.024, -0.004), (0.012, 0.01, 0.014), 1.8, "fwd"),
        ("jawAngle", (0.05, -0.085, -0.045), (0.014, 0.016, 0.02), 4.0, "out"),
        ("jawLine", (0.035, -0.1, -0.01), (0.02, 0.012, 0.03), 1.6, "out"),
        ("chin", (0.0, -0.112, 0.012), (0.016, 0.012, 0.012), 1.6, "fwd"),
        ("browRidge", (0.02, 0.019, 0.012), (0.022, 0.007, 0.012), 1.8, "fwd"),
        ("browOuter", (0.042, 0.016, 0.0), (0.012, 0.008, 0.012), 1.2, "out"),
        ("upperLip", (0.0, -0.062, 0.02), (0.012, 0.005, 0.008), 0.8, "fwd"),
        ("lowerLip", (0.0, -0.075, 0.018), (0.012, 0.005, 0.008), 1.0, "fwd"),
        ("cheekUnder", (0.04, -0.055, 0.0), (0.012, 0.012, 0.016), -1.0, "out"),
        ("lidHood", (0.03, 0.0125, 0.012), (0.011, 0.0035, 0.008), 0.6, "fwd", "lid"),
    ]},
    # Saul (visual-bible 3.2): strikingly handsome, strong regular features, deep-set eyes, high cheekbones, strong jaw
    "saul": {"amount": 0.55, "goals": [
        ("cheekbone", (0.045, -0.024, -0.016), (0.016, 0.012, 0.02), 2.0, "out"),
        ("browRidge", (0.02, 0.017, 0.012), (0.024, 0.008, 0.012), 1.2, "fwd"),
        ("jawAngle", (0.052, -0.085, -0.045), (0.014, 0.016, 0.02), 2.0, "out"),
        ("lidHood", (0.031, 0.0125, 0.012), (0.012, 0.0035, 0.008), 0.9, "fwd", "lid"),
    ]},
    # Samuel (visual-bible 3.1): looks ~70 — sunken temples, hollow cheeks, heavy lids, prominent cheekbones, deep folds
    "samuel": {"amount": 0.6, "goals": [
        ("temples", (0.055, 0.02, -0.03), (0.012, 0.016, 0.018), -3.4, "out"),
        ("cheekHollow", (0.042, -0.055, -0.01), (0.014, 0.014, 0.02), -3.0, "out"),
        ("cheekbone", (0.045, -0.024, -0.016), (0.012, 0.009, 0.016), 1.2, "out"),
        ("browHeavy", (0.02, 0.014, 0.012), (0.02, 0.007, 0.012), 1.4, "fwd"),
        ("lidHood", (0.03, 0.0125, 0.012), (0.012, 0.004, 0.008), 1.5, "fwd", "lid"),
        ("nasolabial", (0.028, -0.05, 0.016), (0.006, 0.014, 0.008), -0.9, "fwd"),
        ("underEye", (0.032, -0.02, 0.008), (0.012, 0.004, 0.008), -0.8, "fwd"),
    ]},
    "elder": {"amount": 0.5, "goals": [
        ("temples", (0.055, 0.02, -0.03), (0.012, 0.016, 0.018), -1.8, "out"),
        ("cheekHollow", (0.042, -0.055, -0.01), (0.014, 0.014, 0.02), -1.6, "out"),
    ]},
    "man": {"amount": 0.4, "goals": []},
}


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def vertex_normals(V, faces):
    n = np.zeros_like(V)
    for a, b, c in ((0, 1, 2), (0, 2, 3)):
        fn = np.cross(V[faces[:, b]] - V[faces[:, a]], V[faces[:, c]] - V[faces[:, a]])
        for k in (a, b, c):
            np.add.at(n, faces[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)


def adjacency(faces, nv):
    e = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 3]], faces[:, [3, 0]]])
    e = e[(e[:, 0] < nv) & (e[:, 1] < nv) & (e[:, 0] != e[:, 1])]
    A = sp.coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(nv, nv))
    A = ((A + A.T) > 0).astype(np.float64).tocsr()
    deg = np.asarray(A.sum(1)).ravel()
    return sp.diags(1.0 / np.maximum(deg, 1)) @ A


def landmark_indices():
    """Vertex index of each named MakeHuman landmark (picked once on the reference head, shared topology)."""
    if os.path.exists(LM_IDX):
        return json.load(open(LM_IDX))
    Bk = PD.mh_head()
    E = Bk.E
    fM = (float(E[0]), float(E[1]) - 0.03, 0.2 / 1024)
    head = Bk.island == 2
    MP = Bk.tp[head].astype(np.float64)
    tree = cKDTree(Bk.h.v_all[:NBODY])
    out = {}
    for k in PD.LM_NAMES:
        if PD.LM_MH.get(k) is None:
            continue
        p = PD.pick3d(MP, fM, PD.LM_MH[k])
        out[k] = int(tree.query(p)[1])
    json.dump(out, open(LM_IDX, "w"), indent=1)
    return out


def scan_landmarks(P):
    fL = (0.0, 1.3, 4.0 / 1024)
    nose_l, chin_l = PD.lps_auto(P)
    B = {}
    for k in PD.LM_NAMES + ["chin"]:
        if k == "noseTip":
            B[k] = nose_l
        elif k == "chin":
            B[k] = chin_l
        else:
            B[k] = PD.pick3d(P, fL, PD.LM_LPS[k])
    return B


def build(name: str):
    t0 = time.time()
    cfg = SETTINGS[name]
    preset = json.load(open(os.path.join(HERE, "presets", f"{name}.json"), encoding="utf-8"))
    preset.pop("sculpt", None)  # the delta is measured on the un-sculpted head
    h = Human(preset)
    V = h.v_all.copy()
    faces = h.obj.faces
    body_faces = faces[(faces < NBODY).all(1)]
    Nv = vertex_normals(V[:NBODY], body_faces)
    lm = landmarks(h)
    ed = eye_data(h)
    eL, eR = np.asarray(ed["L"]["center"]), np.asarray(ed["R"]["center"])
    E = (eL + eR) / 2
    idx = landmark_indices()
    names = [k for k in PD.LM_NAMES + ["chin"] if k in idx or k in ("noseTip", "chin")]
    A = np.array([np.asarray(lm[k]) if k in ("noseTip", "chin") else V[idx[k]] for k in names])
    # ---- the scan
    L = PD.lps_texels()
    P, N = L["P"], L["N"]
    Bd = scan_landmarks(P)
    B = np.array([Bd[k] for k in names])
    s, R, t = PD.umeyama(A, B)
    Ai = (s * (R @ A.T)).T + t
    print(f"  similarity scale {s:.3f}  rms {np.sqrt(((Ai - B) ** 2).sum(1).mean()) / s * 1000:.1f} mm")
    # frontal-plane thin-plate warp (depth residual dropped: the depth profile is the structure we transfer)
    r = B - Ai
    r[:, 2] = 0.0
    ring = []
    c = B.mean(0)
    for a in np.linspace(0, 2 * np.pi, 12, endpoint=False):
        for yy in (-2.5, 0.0, 2.5):
            ring.append(c + np.array([3.2 * np.cos(a), yy, 3.2 * np.sin(a) - 1.0]))
    ring = np.array(ring)
    rbf = RBFInterpolator(np.concatenate([Ai, ring]), np.concatenate([r, np.zeros_like(ring)]),
                          kernel="thin_plate_spline", smoothing=0.02)
    # ---- face region (body vertices)
    hm = head_mask(len(V))[:NBODY]
    f = V[:NBODY] - E
    crown = np.asarray(lm["crown"])
    phi = np.abs(np.degrees(np.arctan2(V[:NBODY, 0] - crown[0], V[:NBODY, 2] - crown[2])))
    chin = np.asarray(lm["chin"])
    de = np.minimum(np.linalg.norm(V[:NBODY] - eL, axis=1), np.linalg.norm(V[:NBODY] - eR, axis=1))
    w = (hm > 0.5) * ss(88, 60, phi) * ss(0.055, 0.032, f[:, 1]) * ss(chin[1] - E[1] - 0.035, chin[1] - E[1] - 0.008, f[:, 1])
    w_eye = ss(0.0145, 0.019, de)
    sel = np.nonzero(w > 1e-3)[0]
    Q = (s * (R @ V[sel].T)).T + t
    Qw = Q + rbf(Q)
    Nq = (R @ Nv[sel].T).T
    tree = cKDTree(P)
    d, j = tree.query(Qw, k=1, workers=4)
    o = P[j] - Qw
    on = np.einsum("ij,ij->i", o, Nq)
    ok = (np.abs(on) < 0.012 * s) & (np.einsum("ij,ij->i", N[j], Nq) > 0.5) & (d < 0.02 * s)
    on = np.where(ok, on, 0.0)
    D = np.zeros((NBODY, 3))
    D[sel] = (R.T @ (on[:, None] * Nq).T).T / s  # back to MakeHuman metres
    # the similarity alignment leaves a mean offset (the two faces are different sizes): only the SHAPE counts
    wsel = w[sel] * w_eye[sel] * ok
    mean_n = (np.einsum("ij,ij->i", D[sel], Nv[sel]) * wsel).sum() / max(wsel.sum(), 1e-9)
    D[sel] -= mean_n * Nv[sel]
    D *= (w * w_eye)[:, None]
    if os.environ.get("SCULPT_DBG"):
        dn = np.einsum("ij,ij->i", D, Nv) * 1000
        m = (w * w_eye) > 0.5
        print("  raw normal offsets (mm) on the face: p5 %.1f p50 %.1f p95 %.1f, ok %.0f%%" % (*np.percentile(dn[m], [5, 50, 95]), ok.mean() * 100))
        from PIL import Image
        img = np.full((400, 400, 3), 128, np.uint8)
        px = ((f[:, 0] + 0.1) / 0.2 * 400).astype(int)
        py = ((0.06 - f[:, 1]) / 0.2 * 400).astype(int)
        keep = (px >= 0) & (px < 400) & (py >= 0) & (py < 400) & (w > 0.01) & (f[:, 2] > -0.03)
        v = np.clip(dn / 6.0, -1, 1)
        col = np.stack([128 + 127 * np.clip(v, 0, 1), 128 - 60 * np.abs(v), 128 + 127 * np.clip(-v, 0, 1)], 1).astype(np.uint8)
        img[py[keep], px[keep]] = col[keep]
        Image.fromarray(img).resize((800, 800), Image.NEAREST).save(os.environ["SCULPT_DBG"])
    # low-pass on the mesh: bone and fat, not skin detail
    M = adjacency(body_faces, NBODY)
    for _ in range(24):
        D = 0.5 * D + 0.5 * (M @ D)
    D *= (w * np.maximum(w_eye, 0.0))[:, None] ** 0.5
    raw_max = np.linalg.norm(D, axis=1).max() * 1000
    # the scan's lower face may be narrower than the look we want (David: a defined, not a narrow jaw) — per preset
    # the scan's share below the mouth ('scanLow', 1 = same as above)
    D *= (cfg["amount"] * (cfg.get("scanLow", 1.0) + (1.0 - cfg.get("scanLow", 1.0)) * ss(-0.085, -0.06, f[:, 1])))[:, None]
    # ---- named goals (Gaussians in head space, both sides mirrored)
    G = np.zeros((NBODY, 3))
    Gl = np.zeros((NBODY, 3))  # 'lid' goals: the fold above the upper-lid crease (no eye mask, gated above the crease)
    for goal in cfg["goals"]:
        gname, cen, rad, mm, dirn = goal[:5]
        lidgoal = len(goal) > 5 and goal[5] == "lid"
        cen = np.asarray(cen, float)
        rad = np.asarray(rad, float)
        for side in ((1, -1) if cen[0] != 0 else (1,)):
            cc = cen * np.array([side, 1, 1])
            g = np.exp(-0.5 * (((f - cc) / rad) ** 2).sum(1))
            if dirn == "out":
                dv = np.stack([np.sign(f[:, 0]) * 1.0, 0 * f[:, 0], 0 * f[:, 0]], 1)
                dv = dv * (np.sign(f[:, 0]) == side)[:, None]
            elif dirn == "fwd":
                dv = np.tile([0.0, 0.0, 1.0], (NBODY, 1))
            elif dirn == "up":
                dv = np.tile([0.0, 1.0, 0.0], (NBODY, 1))
            else:
                dv = np.tile(np.asarray(dirn, float), (NBODY, 1))
            # push along the surface normal's share of the direction (a bulge / hollow, no shearing)
            k = np.einsum("ij,ij->i", dv, Nv)
            (Gl if lidgoal else G)[:] += (g * k * mm / 1000.0)[:, None] * Nv
    for _ in range(6):
        G = 0.5 * G + 0.5 * (M @ G)
        Gl = 0.5 * Gl + 0.5 * (M @ Gl)
    G *= (w * w_eye)[:, None]
    # the hood: only skin clearly above the upper lid's crease (> 8.5 mm above the eye centre) and in front of it
    fyE = V[:NBODY, 1] - E[1]
    Gl *= (w * ss(0.0075, 0.0095, fyE) * ss(0.014, 0.0165, de) ** 0 )[:, None]
    D += G + Gl
    # ---- helpers (teeth / tongue / joint cubes): nearest body vertices; eyeballs stay (their lids do not move)
    full = np.zeros_like(V)
    full[:NBODY] = D
    if len(V) > NBODY:
        dd, nn = cKDTree(V[:NBODY]).query(V[NBODY:], k=6)
        wt = 1.0 / (dd + 1e-4)
        full[NBODY:] = (D[nn] * wt[..., None]).sum(1) / wt.sum(1, keepdims=True)
        for S in (eL, eR):
            near = np.linalg.norm(V[NBODY:] - S, axis=1) < 0.016
            full[NBODY:][near] = 0.0
    out = os.path.join(HERE, "ref", f"sculpt_{name}.npz")
    tmp = out + ".tmp.npz"
    np.savez_compressed(tmp, delta=full.astype(np.float32), info=json.dumps({"preset": name, **{k: v for k, v in cfg.items() if k != "goals"}, "goals": [g[0] for g in cfg["goals"]], "scan": "Infinite-Realities Lee Perry-Smith, CC BY 3.0"}))
    os.replace(tmp, out)
    mag = np.linalg.norm(full[:NBODY], axis=1) * 1000
    print(f"  {name}: scan offsets (low-passed, before amount) max {raw_max:.1f} mm; final delta max {mag.max():.1f} mm, "
          f"mean on the face {mag[w > 0.5].mean():.2f} mm; {time.time() - t0:.0f}s -> {out}")
    for k, i in idx.items():
        print(f"    {k:10s} {np.linalg.norm(full[i]) * 1000:5.2f} mm")


if __name__ == "__main__":
    for n in sys.argv[1:] or ["david"]:
        build(n)
