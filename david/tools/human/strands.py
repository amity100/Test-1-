"""Hair-strand generators for eyelashes and eyebrows (rendered as camera-facing ribbons at runtime)."""
from __future__ import annotations

import numpy as np
from scipy.spatial import cKDTree


class Surface:
    """Nearest-vertex projection onto a (dense) skin mesh."""

    def __init__(self, pos, nrm, mask=None):
        self.pos, self.nrm = pos, nrm
        self.ids = np.arange(len(pos)) if mask is None else np.nonzero(mask)[0]
        self.tree = cKDTree(pos[self.ids])

    def project(self, x, k=6):
        d, i = self.tree.query(x, k=k)
        i = self.ids[i]
        w = 1.0 / (d + 1e-5) ** 2
        w /= w.sum(-1, keepdims=True)
        p = np.sum(self.pos[i] * w[..., None], -2)
        n = np.sum(self.nrm[i] * w[..., None], -2)
        n /= np.linalg.norm(n, axis=-1, keepdims=True)
        x2 = x - n * np.sum((x - p) * n, -1, keepdims=True)
        return x2, n, i[..., 0]


def _smooth_noise(rng, n):
    return rng.normal(0, 1, n)


def lashes(loop_pos, eye_center, side: int, rng, upper=True, count=110, length=(0.0098, 0.0042), width=0.00019):
    """Eyelash strands rooted along a lid-margin polyline (ordered medial -> lateral).

    Returns list of strands, each (K,3) centerline, plus root parameters (for weights lookup).
    """
    P = np.asarray(loop_pos)
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    L = cum[-1]
    strands, roots, widths = [], [], []
    up = np.array([0, 1.0, 0]) if upper else np.array([0, -1.0, 0])
    for k in range(count):
        # denser & longer in the middle-lateral third, sparse at the inner corner
        s = rng.random() ** (1.1 if upper else 1.0)
        s = 0.06 + 0.9 * s
        if rng.random() < 0.35:
            s = 0.35 + 0.55 * rng.random()
        t = s * L
        j = min(np.searchsorted(cum, t) - 1, len(P) - 2)
        a = (t - cum[j]) / max(seg[j], 1e-9)
        root = P[j] * (1 - a) + P[j + 1] * a
        tang = P[j + 1] - P[j]
        tang /= np.linalg.norm(tang)
        out = root - eye_center
        out /= np.linalg.norm(out)
        # lid "up" direction perpendicular to the margin within the lid surface
        lid_up = up - tang * np.dot(up, tang)
        lid_up -= out * np.dot(lid_up, out) * 0.5
        lid_up /= np.linalg.norm(lid_up)
        prof = np.sin(np.pi * np.clip((s - 0.02) / 0.98, 0, 1)) ** 0.6
        lat_bias = 0.75 + 0.35 * s
        ln = (length[0] if upper else length[1]) * (0.45 + 0.55 * prof) * lat_bias * (0.8 + 0.4 * rng.random())
        # lashes fan laterally toward the outer corner
        fan = tang * (0.25 * (s - 0.35)) * (1 if upper else 0.6)
        # face pass 2: the root sits ON the lid margin, a little toward the opening (was +0.35 mm out, +0.25 mm up the
        # lid: with the lid-margin strip (the pocket island) in front of the eyeball the lash line read ~1.5 mm above
        # the upper margin and below the lower one)
        root = root + out * 0.0001 - lid_up * (0.0007 if upper else 0.0006)
        K = 6
        pts = []
        d0 = out * 0.9 + lid_up * (0.12 if upper else 0.1) + fan
        d0 /= np.linalg.norm(d0)
        curl = (1.5 if upper else 0.9) * (0.8 + 0.4 * rng.random())
        p = root.copy()
        d = d0.copy()
        step = ln / (K - 1)
        for i in range(K):
            pts.append(p.copy())
            # curl toward lid_up (upper lashes curl up, lower curl down)
            d = d + lid_up * curl * step * 20 * (i / (K - 1)) ** 0.7 + rng.normal(0, 0.04, 3)
            d /= np.linalg.norm(d)
            p = p + d * step
        strands.append(np.asarray(pts))
        roots.append(root)
        widths.append(width * (0.8 + 0.4 * rng.random()) * (1.0 if upper else 0.75))
    return strands, np.asarray(roots), np.asarray(widths)


def brows(surface: Surface, eye_center, side: int, lid_loop_pos, rng, density=1.0, thickness=1.0, count=620, width=0.000125, lift=0.0):
    """Eyebrow strands lying on the skin above the eye.  side: +1 left (+X), -1 right."""
    c = np.asarray(eye_center)
    P = np.asarray(lid_loop_pos)
    lat = (P[:, 0] - c[0]) * side
    inner = lat.min()
    outer = lat.max()
    top = (P[:, 1] - c[1]).max()
    # brow centreline in the frontal plane (metres relative to the eye centre, x lateral)
    x0 = inner - 0.0035
    x1 = outer + 0.0075
    def centre(s):
        # low, fairly straight male brow with a soft peak ~65% laterally
        y = top + 0.0085 + lift + 0.0030 * np.sin(np.pi * np.clip(s / 0.68, 0, 1) * 0.5) - 0.0045 * np.clip((s - 0.68) / 0.32, 0, 1) ** 1.6
        return y
    def half_h(s):
        base = 0.0046 * thickness
        return base * (1.0 - 0.1 * s) * (1 - 0.72 * np.clip((s - 0.6) / 0.4, 0, 1) ** 1.3) * (0.85 + 0.15 * np.clip(s / 0.1, 0, 1))
    strands, roots, widths = [], [], []
    n = int(count * density)
    tries = 0
    while len(strands) < n and tries < n * 20:
        tries += 1
        s = rng.random()
        v = rng.random() * 2 - 1  # -1 bottom .. 1 top
        # soft edges: accept with a falloff
        edge = 1 - np.abs(v) ** 3
        if rng.random() > edge * (0.35 + 0.65 * (1 - 0.8 * max(0, s - 0.75) / 0.25)):
            continue
        x = x0 + s * (x1 - x0)
        y = centre(s) + v * half_h(s)
        guess = c + np.array([side * x, y, 0.03])
        # frontal projection: march back until close to the surface
        p, nrm, _ = surface.project(guess)
        for _ in range(3):
            p, nrm, _ = surface.project(np.array([side * x + c[0], y + c[1], p[2]]))
        # growth direction in the frontal plane
        if s < 0.14:
            ang = np.deg2rad(80 - 180 * s)  # medial hairs point up, fanning laterally
        else:
            ang = np.deg2rad(22 - 30 * s)  # lateral hairs flatten out / point slightly down at the tail
        ang -= v * np.deg2rad(18) * (0.4 + s)  # herringbone: upper hairs point down, lower up
        ang += rng.normal(0, np.deg2rad(8))
        d2 = np.array([side * np.cos(ang), np.sin(ang), 0.0])
        ln = (0.0068 - 0.0022 * s) * (0.75 + 0.5 * rng.random()) * (1.1 if s < 0.14 else 1.0)
        K = 5
        pts = []
        q = p + nrm * 0.00025
        d = d2 - nrm * np.dot(d2, nrm)
        d /= np.linalg.norm(d)
        step = ln / (K - 1)
        for i in range(K):
            pts.append(q.copy())
            qn = q + d * step
            qs, nn, _ = surface.project(qn)
            lift = 0.00025 + 0.00055 * (i + 1) / (K - 1)
            q2 = qs + nn * lift
            d = q2 - q
            d /= np.linalg.norm(d)
            q = q2
        strands.append(np.asarray(pts))
        roots.append(p)
        widths.append(width * (0.75 + 0.5 * rng.random()))
    return strands, np.asarray(roots), np.asarray(widths)


def ribbon_arrays(strands, widths, rng):
    """Pack strands into ribbon vertex arrays: 2 verts per centerline point.

    Returns dict: pos (N,3) centerline, dir (N,3) strand tangent, strand (N,4)=(side, t, width, rand),
    tris (M,3), root_idx (N,) strand index per vertex.
    """
    pos, dirs, attr, tris, sidx = [], [], [], [], []
    base = 0
    for si, (S, w) in enumerate(zip(strands, widths)):
        K = len(S)
        d = np.gradient(S, axis=0)
        d /= np.linalg.norm(d, axis=1, keepdims=True) + 1e-12
        r = rng.random()
        for i in range(K):
            t = i / (K - 1)
            for side in (-1.0, 1.0):
                pos.append(S[i])
                dirs.append(d[i])
                attr.append((side, t, w, r))
                sidx.append(si)
        for i in range(K - 1):
            a = base + 2 * i
            tris.append((a, a + 1, a + 2))
            tris.append((a + 1, a + 3, a + 2))
        base += 2 * K
    return {
        "pos": np.asarray(pos), "dir": np.asarray(dirs), "strand": np.asarray(attr),
        "tris": np.asarray(tris, np.int64), "sidx": np.asarray(sidx),
    }
