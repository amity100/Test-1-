"""
Procedural surface anatomy for the DAVID humans: a height field (metres) painted over the body in the REST pose
(arms hanging, palms toward the thighs, thumbs forward; legs straight), added to the baked normal map.

MakeHuman's hm08 mesh only faintly models muscle separations, tendons and bony landmarks, which is a big part
of why an untextured MakeHuman body reads as a mannequin.  Every feature is a curve or blob whose control points
are placed relative to the rest-pose joints / torso proportions (so it follows each preset) and found on the skin
of one body region by ray casting:

  neck      sternocleidomastoid, jugular notch, larynx, supraclavicular hollows, clavicles
  torso     sternal groove, pectoral lower border (overhanging edge), deltopectoral groove, linea alba, tendinous
            intersections, linea semilunaris, iliac furrow, serratus digitations, spine groove, scapulae
  arms      deltoid borders & insertion, lateral bicipital groove, olecranon, brachioradialis border, ulnar border,
            wrist flexor tendons, ulnar styloid
  hands     dorsal extensor tendons, knuckle heads, anatomical snuffbox, dorsal veins
  legs      patella, patellar tendon & fat-pad dimples, vastus medialis, tibial crest & tuberosity,
            tibialis anterior, gastrocnemius heads, Achilles tendon, malleoli
  feet      dorsal tendons, dorsal venous arch

Coordinates: metres, +Y up, the character faces +Z, its left is +X; `s` = +1 for the left side, -1 for the right.
"""
from __future__ import annotations

import numpy as np
from scipy.spatial import cKDTree


def _catmull(P: np.ndarray, n: int) -> np.ndarray:
    P = np.asarray(P, float)
    if len(P) == 2:
        t = np.linspace(0, 1, n)[:, None]
        return P[0] * (1 - t) + P[1] * t
    Q = np.concatenate([P[:1] * 2 - P[1:2], P, P[-1:] * 2 - P[-2:-1]])
    segs = len(P) - 1
    out = []
    for k in range(n):
        u = k / (n - 1) * segs
        i = min(int(u), segs - 1)
        t = u - i
        p0, p1, p2, p3 = Q[i], Q[i + 1], Q[i + 2], Q[i + 3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    return np.asarray(out)


def _smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


class Anatomy:
    def __init__(self, verts, tris, vreg: dict, texel_pos, texel_reg: dict, joints: dict):
        from geom import vertex_normals
        self.V = np.asarray(verts, float)
        self.T = np.asarray(tris)
        self.N = vertex_normals(self.V, self.T)
        self.vreg = vreg
        self.tp = np.asarray(texel_pos, float)
        self.treg = texel_reg
        self.J = joints
        self.H = np.zeros(len(self.tp), np.float32)
        self._trees = {}
        self._rays = {}

    # ------------------------------------------------------------------ helpers
    def j(self, name):
        return np.asarray(self.J[name], float)

    @staticmethod
    def _key(region):
        return (region,) if isinstance(region, str) else tuple(region)

    def _w(self, regs, table, pos):
        # region names may carry a side suffix (":L" = +X half, ":R" = -X half) so rays never hit the other limb
        out = 0.0
        for r in self._key(regs):
            base, _, side = r.partition(":")
            w = table[base]
            if side:
                w = w * ((pos[:, 0] > 0) if side == "L" else (pos[:, 0] < 0))
            out = out + w
        return out

    def _vw(self, region):
        return self._w(region, self.vreg, self.V)

    def _tree(self, region):
        k = self._key(region)
        if k not in self._trees:
            ids = np.nonzero(self._vw(region) > 0.5)[0]
            self._trees[k] = (cKDTree(self.V[ids]), ids)
        return self._trees[k]

    def _ray(self, region):
        k = self._key(region)
        if k not in self._rays:
            import trimesh
            from trimesh.ray.ray_pyembree import RayMeshIntersector
            w = self._vw(region)
            keep = np.all(w[self.T] > 0.3, 1)
            m = trimesh.Trimesh(self.V, self.T[keep], process=False)
            self._rays[k] = RayMeshIntersector(m)
        return self._rays[k]

    def proj(self, pts, region):
        """Nearest-surface projection (for points already close to the skin)."""
        tree, ids = self._tree(region)
        pts = np.atleast_2d(np.asarray(pts, float))
        d, i = tree.query(pts, k=4)
        i = ids[i]
        w = 1.0 / (d + 1e-6) ** 2
        w /= w.sum(1, keepdims=True)
        p = np.einsum("nk,nkc->nc", w, self.V[i])
        n = np.einsum("nk,nkc->nc", w, self.N[i])
        n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
        return pts - n * np.sum((pts - p) * n, 1, keepdims=True)

    def pt(self, p, d, region):
        """Skin point hit by a ray through p along direction d (starting 0.6 m before p)."""
        d = np.asarray(d, float)
        d = d / np.linalg.norm(d)
        o = np.asarray(p, float) - d * 0.6
        loc, _, _ = self._ray(region).intersects_location(o[None], d[None], multiple_hits=True)
        if len(loc) == 0:
            return self.proj(p, region)[0]
        return loc[np.argmin(np.linalg.norm(loc - o, axis=1))]

    def curve(self, pts, region, n=64):
        c = _catmull(np.asarray(pts, float), n)
        return self.proj(c, region)

    def _texels(self, region, lo, hi):
        w = self._w(region, self.treg, self.tp)
        m = (w > 0.05) & np.all(self.tp >= lo, 1) & np.all(self.tp <= hi, 1)
        idx = np.nonzero(m)[0]
        return idx, np.clip(w[idx], 0, 1)

    def _closest(self, curve, q):
        c = np.asarray(curve, float)
        a, b = c[:-1], c[1:]
        ab = b - a
        L = np.linalg.norm(ab, axis=1)
        cum = np.concatenate([[0], np.cumsum(L)])
        best = np.full(len(q), np.inf)
        tpar = np.zeros(len(q))
        foot = np.zeros_like(q)
        tang = np.zeros_like(q)
        for k in range(len(a)):
            t = np.clip(((q - a[k]) @ ab[k]) / (L[k] ** 2 + 1e-12), 0, 1)
            f = a[k] + t[:, None] * ab[k]
            d = np.linalg.norm(q - f, axis=1)
            better = d < best
            best = np.where(better, d, best)
            tpar = np.where(better, (cum[k] + t * L[k]) / cum[-1], tpar)
            foot = np.where(better[:, None], f, foot)
            tang = np.where(better[:, None], ab[k] / (L[k] + 1e-12), tang)
        return best, tpar, foot, tang

    @staticmethod
    def _env(tpar, taper):
        t0, t1, t2, t3 = taper
        e = np.clip((tpar - t0) / max(t1 - t0, 1e-6), 0, 1) * np.clip((t3 - tpar) / max(t3 - t2, 1e-6), 0, 1)
        return e * e * (3 - 2 * e)

    # ------------------------------------------------------------------ primitives
    def line(self, curve, region, width, amp, taper=(0.0, 0.15, 0.85, 1.0)):
        """Gaussian ridge (amp > 0) or groove (amp < 0) along a polyline."""
        c = np.asarray(curve, float)
        idx, w = self._texels(region, c.min(0) - width * 3, c.max(0) + width * 3)
        if len(idx) == 0:
            return
        d, tpar, _, _ = self._closest(c, self.tp[idx])
        self.H[idx] += (amp * np.exp(-(d / width) ** 2) * self._env(tpar, taper) * w).astype(np.float32)

    def edge(self, curve, region, width, amp, side, taper=(0.0, 0.15, 0.85, 1.0)):
        """Muscle border: the positive side (direction `side`) rises by `amp` right at the curve with a rounded
        shoulder that relaxes back to the base surface ~3 widths away (the pec's overhang, a deltoid rim)."""
        c = np.asarray(curve, float)
        pad = width * 5
        idx, w = self._texels(region, c.min(0) - pad, c.max(0) + pad)
        if len(idx) == 0:
            return
        q = self.tp[idx]
        d, tpar, foot, tang = self._closest(c, q)
        sd = np.sign(np.sum((q - foot) * np.asarray(side, float), 1)) * d
        prof = 1.0 / (1.0 + np.exp(-sd / (0.35 * width))) * np.exp(-(np.maximum(sd, 0) / (2.5 * width)) ** 2)
        prof -= 0.18 * np.exp(-((sd + 1.2 * width) / width) ** 2)  # slight crease under the overhang
        self.H[idx] += (amp * prof * self._env(tpar, taper) * w).astype(np.float32)

    def blob(self, center, region, radii, amp, axes=None):
        c = np.asarray(center, float)
        r = np.asarray(radii, float)
        idx, w = self._texels(region, c - r.max() * 3, c + r.max() * 3)
        if len(idx) == 0:
            return
        d = self.tp[idx] - c
        if axes is not None:
            d = d @ np.asarray(axes, float).T
        self.H[idx] += (amp * np.exp(-np.sum((d / r) ** 2, 1)) * w).astype(np.float32)

    # ------------------------------------------------------------------ the body
    def build(self, strength=1.0, veins=1.0, rng=None):
        rng = rng or np.random.default_rng(1)
        J = self.j
        mm = 0.001 * strength
        F, B = (0, 0, -1), (0, 0, 1)  # ray directions: onto the front / back skin
        neck0, head, sp5 = J("neck01"), J("head"), J("spine05")
        Tt = neck0[1] - sp5[1]  # torso height unit (~0.54 m)
        y_notch = neck0[1] - 0.11 * Tt
        y_pec = neck0[1] - 0.465 * Tt
        y_nav = sp5[1] + 0.2 * Tt
        y_asis = sp5[1] + 0.085 * Tt
        Wsh = J("upperarm01.L")[0]  # shoulder half width (~0.2 m)
        TOR, NK, PEL = ("torso",), ("neck", "torso"), ("pelvis", "torso")
        # ================= midline
        notch = self.pt([0, y_notch, 0], F, NK)
        self.blob(notch, NK, (0.013, 0.011, 0.015), -2.6 * mm)
        lar = self.pt([0, head[1] - 0.105, 0], F, ("neck",))
        self.blob(lar, ("neck",), (0.008, 0.013, 0.012), 2.0 * mm)
        stern = self.curve([self.pt([0, y, 0], F, TOR) for y in np.linspace(y_notch - 0.02, y_pec - 0.005, 5)], TOR)
        self.line(stern, TOR, 0.01, -1.3 * mm, taper=(0.0, 0.2, 0.75, 1.0))
        alba = self.curve([self.pt([0, y, 0], F, TOR) for y in np.linspace(y_pec - 0.01, y_nav + 0.012, 6)], TOR)
        self.line(alba, TOR, 0.008, -1.9 * mm, taper=(0.0, 0.1, 0.9, 1.0))
        alba2 = self.curve([self.pt([0, y, 0], F, PEL) for y in np.linspace(y_nav - 0.015, y_asis - 0.03, 4)], PEL)
        self.line(alba2, PEL, 0.007, -0.9 * mm, taper=(0.0, 0.2, 0.6, 1.0))
        spn = self.curve([self.pt([0, y, 0], B, ("torso", "pelvis", "neck")) for y in np.linspace(neck0[1] - 0.06, sp5[1] - 0.02, 7)], ("torso", "pelvis"))
        self.line(spn, ("torso", "pelvis"), 0.013, -2.4 * mm, taper=(0.0, 0.1, 0.85, 1.0))
        for s in (1, -1):
            S = "L" if s > 0 else "R"
            sh, el, wr = J(f"upperarm01.{S}"), J(f"lowerarm01.{S}"), J(f"wrist.{S}")
            kn, an = J(f"lowerleg01.{S}"), J(f"foot.{S}")
            LAT, MED = (-s, 0, 0), (s, 0, 0)  # rays onto the lateral / medial skin of a limb
            UA, FA, HD, TH, SH, FT = (f"uarm:{S}",), (f"farm:{S}",), (f"hand:{S}",), (f"thigh:{S}",), (f"shin:{S}",), (f"foot:{S}",)
            # ================= neck & collar
            mast = self.pt(head + np.array([s * 0.045, -0.05, -0.045]), LAT, ("head", "neck"))
            nh = [mast, self.pt([s * 0.045, neck0[1] + 0.005, neck0[2] + 0.02], F, NK), self.pt([s * 0.022, y_notch + 0.02, 0], F, NK), self.pt([s * 0.012, y_notch - 0.005, 0], F, NK)]
            scm = self.curve(nh, NK)
            self.line(scm, NK, 0.012, 3.0 * mm, taper=(0.1, 0.35, 0.8, 1.0))
            self.line(scm + np.array([-s * 0.006, 0, 0.0]), NK, 0.006, -0.8 * mm, taper=(0.3, 0.5, 0.8, 0.95))  # anterior border
            self.blob(self.pt([s * 0.065, y_notch + 0.012, 0], F, NK), NK, (0.02, 0.012, 0.02), -2.0 * mm)  # supraclavicular fossa
            acro = self.pt(sh + np.array([-s * 0.02, 0.07, 0.0]), (0, -1, 0), ("torso", f"uarm:{S}", "neck"))
            clav = self.curve([self.pt([s * 0.02, y_notch - 0.003, 0], F, TOR), self.pt([s * 0.065, y_notch + 0.004, 0], F, TOR),
                               self.pt([s * 0.11, y_notch + 0.012, 0], F, TOR), acro + np.array([0, -0.004, 0.012])], ("torso", "neck", f"uarm:{S}"))
            self.line(clav, ("torso", "neck", f"uarm:{S}"), 0.0065, 2.4 * mm, taper=(0.0, 0.08, 0.85, 1.0))
            self.line(clav - np.array([0, 0.013, -0.002]), TOR, 0.008, -0.9 * mm, taper=(0.1, 0.3, 0.7, 0.9))
            # ================= chest: pectoral lower border (overhanging edge), deltopectoral groove
            pts = [self.pt([s * x, y_pec + dy, 0], F, TOR) for x, dy in ((0.02, 0.012), (0.06, -0.004), (0.1, -0.002), (0.135, 0.012), (0.8 * Wsh, 0.045))]
            pts.append(self.pt([s * 0.86 * Wsh, y_pec + 0.075, 0], F, ("torso", f"uarm:{S}")))
            pec = self.curve(pts, ("torso", f"uarm:{S}"))
            self.edge(pec, ("torso", f"uarm:{S}"), 0.009, 3.2 * mm, side=(0, 1, 0.25), taper=(0.0, 0.12, 0.85, 1.0))
            dp = self.curve([self.pt([s * 0.68 * Wsh, y_notch - 0.01, 0], F, ("torso", f"uarm:{S}")), self.pt([s * 0.8 * Wsh, y_notch - 0.07, 0], F, ("torso", f"uarm:{S}")),
                             self.pt([s * 0.88 * Wsh, y_pec + 0.07, 0], F, ("torso", f"uarm:{S}"))], ("torso", f"uarm:{S}"))
            self.line(dp, ("torso", f"uarm:{S}"), 0.009, -1.8 * mm, taper=(0.0, 0.2, 0.7, 1.0))
            # ================= abdomen
            semi = self.curve([self.pt([s * x, y, 0], F, PEL) for x, y in ((0.085, y_pec - 0.02), (0.083, y_nav + 0.05), (0.07, y_nav - 0.03), (0.045, y_asis - 0.05))], PEL)
            self.line(semi, PEL, 0.013, -1.9 * mm, taper=(0.0, 0.2, 0.75, 1.0))
            ys = (y_pec - 0.005, y_pec - 0.055, y_pec - 0.11, y_nav + 0.03, y_asis - 0.02)
            for k in range(4):  # rectus abdominis segments: soft convex pads between the intersections
                yc = 0.5 * (ys[k] + ys[k + 1])
                self.blob(self.pt([s * 0.042, yc, 0], F, PEL), PEL, (0.03, 0.5 * (ys[k] - ys[k + 1]) * 0.9, 0.025), (1.3 - 0.25 * k) * mm)
            for k, yy in enumerate((y_pec - 0.055, y_pec - 0.11, y_nav + 0.03)):
                inter = self.curve([self.pt([s * x, yy + dy, 0], F, TOR) for x, dy in ((0.004, 0.0), (0.035, 0.004), (0.068, 0.012))], TOR)
                self.line(inter, TOR, 0.0075, -(1.7 - 0.3 * k) * mm, taper=(0.0, 0.2, 0.8, 1.0))
            ili = self.curve([self.pt([s * x, y, 0], F, ("pelvis", "torso", f"thigh:{S}")) for x, y in ((0.12, y_asis + 0.02), (0.1, y_asis - 0.03), (0.07, y_asis - 0.08), (0.04, y_asis - 0.12))],
                             ("pelvis", "torso", f"thigh:{S}"))
            self.edge(ili, ("pelvis", "torso", f"thigh:{S}"), 0.01, 2.2 * mm, side=(s * 0.7, 0.7, 0), taper=(0.0, 0.2, 0.7, 1.0))
            for k in range(4):  # serratus digitations on the lateral ribcage
                y0 = y_pec + 0.02 - k * 0.026
                a = self.pt([s * 0.4, y0 + 0.014, -0.005], LAT, TOR)
                b = self.pt([s * 0.4, y0 - 0.006, 0.03], LAT, TOR)
                if a is not None and b is not None:
                    self.line(self.curve([a, b], TOR, 12), TOR, 0.006, -1.0 * mm, taper=(0.0, 0.3, 0.6, 1.0))
            # ================= back: scapulae, lumbar dimples
            sc = self.curve([self.pt([s * x, y, 0], B, TOR) for x, y in ((0.07, neck0[1] - 0.085), (0.075, neck0[1] - 0.15), (0.1, neck0[1] - 0.225))], TOR)
            self.edge(sc, TOR, 0.012, 1.8 * mm, side=(s, 0, 0), taper=(0.0, 0.2, 0.8, 1.0))
            ssp = self.curve([self.pt([s * 0.075, neck0[1] - 0.09, 0], B, TOR), self.pt([s * 0.13, neck0[1] - 0.065, 0], B, TOR), self.pt(sh + np.array([0, 0.06, 0]), B, ("torso", f"uarm:{S}"))],
                             ("torso", f"uarm:{S}"))
            self.line(ssp, ("torso", f"uarm:{S}"), 0.0065, 1.3 * mm, taper=(0.0, 0.15, 0.85, 1.0))
            self.blob(self.pt([s * 0.035, sp5[1] + 0.015, 0], B, PEL), PEL, (0.012, 0.011, 0.02), -2.0 * mm)
            # ================= upper arm (hanging, thumb forward): deltoid, bicipital groove
            ins = self.pt(sh + np.array([0, -0.14, 0.0]), LAT, UA)
            dfront = self.curve([self.pt(sh + np.array([0, 0.0, 0.0]), (0, 0, -1), (f"uarm:{S}", "torso")), self.pt(sh + np.array([0, -0.08, 0]), (-s * 0.7, 0, -0.7), UA), ins], UA)
            dback = self.curve([self.pt(sh + np.array([0, 0.0, 0.0]), (0, 0, 1), (f"uarm:{S}", "torso")), self.pt(sh + np.array([0, -0.08, 0]), (-s * 0.7, 0, 0.7), UA), ins], UA)
            self.edge(dfront, UA, 0.008, 2.0 * mm, side=(s * 0.6, 0.5, -0.6), taper=(0.1, 0.25, 0.85, 1.0))
            self.edge(dback, UA, 0.008, 2.0 * mm, side=(s * 0.6, 0.5, 0.6), taper=(0.1, 0.25, 0.85, 1.0))
            lat = self.curve([ins, self.pt(el + np.array([0, 0.035, 0.0]), LAT, UA)], UA)
            self.line(lat, UA, 0.009, -1.5 * mm, taper=(0.0, 0.2, 0.7, 1.0))
            # ================= elbow & forearm (flexor side = medial, extensor = lateral, radial = front)
            self.blob(self.pt(el + np.array([0, -0.008, 0]), B, (f"farm:{S}", f"uarm:{S}")), (f"farm:{S}", f"uarm:{S}"), (0.009, 0.013, 0.01), 2.0 * mm)  # olecranon
            br = self.curve([self.pt(el + np.array([0, -0.02, 0]), (s * 0.5, 0, -0.85), FA), self.pt(el + np.array([0, -0.08, 0]), (s * 0.6, 0, -0.8), FA),
                             self.pt(el * 0.45 + wr * 0.55, (s * 0.55, 0, -0.85), FA)], FA)
            self.line(br, FA, 0.01, -1.4 * mm, taper=(0.0, 0.2, 0.65, 1.0))
            uln = self.curve([self.pt(el + np.array([0, -0.03, 0]), B, FA), self.pt(el * 0.5 + wr * 0.5, (-s * 0.3, 0, 1), FA), self.pt(wr + np.array([0, 0.02, 0]), (-s * 0.5, 0, 0.85), FA)], FA)
            self.line(uln, FA, 0.007, -1.0 * mm, taper=(0.0, 0.2, 0.8, 1.0))
            for dz in (0.007, -0.005):  # flexor carpi radialis / palmaris longus
                tend = self.curve([self.pt(wr + np.array([0, 0.08, dz]), MED, FA), self.pt(wr + np.array([0, 0.012, dz]), MED, FA)], FA)
                self.line(tend, FA, 0.003, 0.7 * mm, taper=(0.0, 0.4, 0.85, 1.0))
            self.blob(self.pt(wr + np.array([0, 0.01, -0.012]), (-s * 0.6, 0, 0.8), (f"farm:{S}", f"hand:{S}")), (f"farm:{S}", f"hand:{S}"), (0.005, 0.0055, 0.005), 1.6 * mm)  # ulnar styloid
            # ================= hand dorsum (faces +s X)
            for k in (2, 3, 4, 5):
                mcp = J(f"finger{k}-1.{S}")
                start = wr + np.array([0, -0.012, 0.012 - 0.008 * (k - 2)])
                tend = self.curve([self.pt(start, LAT, HD), self.pt(start * 0.5 + mcp * 0.5, LAT, HD), self.pt(mcp + np.array([0, 0.006, 0]), LAT, HD)], HD)
                self.line(tend, HD, 0.0026, 0.8 * mm, taper=(0.1, 0.3, 0.8, 0.98))
                self.blob(self.pt(mcp + np.array([0, 0.002, 0]), LAT, HD), HD, (0.006, 0.0055, 0.006), 1.2 * mm)
            th2 = J(f"finger1-2.{S}")
            epl = self.curve([self.pt(wr + np.array([0, 0.0, 0.012]), LAT, (f"hand:{S}", f"farm:{S}")), self.pt(th2, (-s * 0.7, 0, -0.7), HD)], (f"hand:{S}", f"farm:{S}"))
            self.line(epl, (f"hand:{S}", f"farm:{S}"), 0.0028, 0.8 * mm, taper=(0.0, 0.2, 0.7, 1.0))
            self.blob(self.pt(wr + np.array([0, -0.005, 0.02]), F, (f"hand:{S}", f"farm:{S}")), (f"hand:{S}", f"farm:{S}"), (0.006, 0.007, 0.006), -1.2 * mm)  # snuffbox
            if veins > 0:
                for k in range(3):
                    a0 = J(f"finger{k + 2}-1.{S}") * 0.5 + J(f"finger{k + 3}-1.{S}") * 0.5
                    pts = [a0 + np.array([0, 0.012, 0]), a0 * 0.6 + wr * 0.4 + np.array([0, 0.0, rng.uniform(-0.006, 0.006)]),
                           wr + np.array([0, 0.004, 0.012 - k * 0.012]), wr + np.array([0, 0.05, 0.02 - k * 0.018])]
                    v = self.curve([self.pt(p, LAT, (f"hand:{S}", f"farm:{S}")) for p in pts], (f"hand:{S}", f"farm:{S}"))
                    self.line(v, (f"hand:{S}", f"farm:{S}"), 0.0024, 0.75 * mm * veins, taper=(0.0, 0.15, 0.85, 1.0))
            # ================= knee & lower leg (front = +Z)
            LEG = (f"thigh:{S}", f"shin:{S}")
            pat = self.pt(kn + np.array([0, 0.012, 0]), F, LEG)
            self.blob(pat, LEG, (0.022, 0.026, 0.02), 3.0 * mm)
            self.blob(pat + np.array([0, -0.046, -0.006]), SH, (0.008, 0.022, 0.014), 1.0 * mm)  # patellar tendon
            for sx in (1, -1):
                self.blob(self.pt(pat + np.array([sx * 0.024, -0.042, 0]), F, LEG), LEG, (0.01, 0.013, 0.014), -1.7 * mm)
            self.blob(self.pt(kn + np.array([-s * 0.03, 0.09, 0]), (s * 0.5, 0, -0.85), TH), TH, (0.024, 0.036, 0.024), 2.3 * mm)  # vastus medialis
            tub = self.pt(kn + np.array([0, -0.065, 0]), F, SH)
            self.blob(tub, SH, (0.009, 0.011, 0.01), 1.3 * mm)
            crest = self.curve([tub, self.pt(kn * 0.5 + an * 0.5 + np.array([-s * 0.008, 0, 0]), F, SH), self.pt(an + np.array([-s * 0.018, 0.07, 0]), F, SH)], SH)
            self.line(crest, SH, 0.008, 0.6 * mm, taper=(0.0, 0.1, 0.8, 1.0))
            ta = self.curve([self.pt(kn + np.array([s * 0.028, -0.08, 0]), F, SH), self.pt(kn * 0.45 + an * 0.55 + np.array([s * 0.014, 0, 0]), F, SH)], SH)
            self.line(ta, SH, 0.013, 1.3 * mm, taper=(0.0, 0.25, 0.6, 1.0))
            gm = self.curve([self.pt(kn + np.array([0, -0.04, 0]), B, SH), self.pt(kn + np.array([0, -0.17, 0]), B, SH)], SH)
            self.line(gm, SH, 0.009, -1.4 * mm, taper=(0.0, 0.2, 0.7, 1.0))
            for sx, yb in ((-1, 0.215), (1, 0.19)):  # lower borders of the medial (lower) and lateral heads
                g = self.curve([self.pt(kn + np.array([0, -yb, 0]), (-sx * s * 0.8, 0, 0.6), SH), self.pt(kn + np.array([0, -yb - 0.05, 0]), B, SH)], SH)
                self.edge(g, SH, 0.01, 1.8 * mm, side=(0, 1, 0), taper=(0.0, 0.25, 0.7, 1.0))
            ach = self.curve([self.pt(an + np.array([0, 0.19, 0]), B, (f"shin:{S}", f"foot:{S}")), self.pt(an + np.array([0, 0.035, 0]), B, (f"shin:{S}", f"foot:{S}"))], (f"shin:{S}", f"foot:{S}"))
            self.line(ach, (f"shin:{S}", f"foot:{S}"), 0.0065, 1.6 * mm, taper=(0.0, 0.2, 0.8, 1.0))
            for sx in (1, -1):
                self.line(ach + np.array([sx * 0.014, 0, 0.006]), (f"shin:{S}", f"foot:{S}"), 0.006, -1.5 * mm, taper=(0.1, 0.35, 0.8, 1.0))
            self.blob(self.pt(an + np.array([0, 0.012, 0.0]), MED, (f"shin:{S}", f"foot:{S}")), (f"shin:{S}", f"foot:{S}"), (0.01, 0.011, 0.011), 2.6 * mm)  # medial malleolus
            self.blob(self.pt(an + np.array([0, -0.004, -0.01]), LAT, (f"shin:{S}", f"foot:{S}")), (f"shin:{S}", f"foot:{S}"), (0.009, 0.011, 0.01), 2.6 * mm)  # lateral malleolus
            # ================= foot dorsum
            big = J(f"toe1-1.{S}")
            D = (0, -1, -0.35)
            tib = self.curve([self.pt(an + np.array([-s * 0.012, 0.06, 0.03]), F, (f"foot:{S}", f"shin:{S}")), self.pt(an + np.array([-s * 0.02, 0.0, 0.05]), D, (f"foot:{S}", f"shin:{S}")),
                              self.pt(an * 0.45 + big * 0.55 + np.array([-s * 0.03, 0.0, 0]), D, FT)], (f"foot:{S}", f"shin:{S}"))
            self.line(tib, (f"foot:{S}", f"shin:{S}"), 0.0045, 0.9 * mm, taper=(0.0, 0.2, 0.75, 1.0))
            ehl = self.curve([self.pt(an + np.array([0.0, 0.0, 0.05]), D, FT), self.pt(big + np.array([0, 0.0, -0.02]), D, FT)], FT)
            self.line(ehl, FT, 0.0035, 0.55 * mm, taper=(0.1, 0.3, 0.8, 1.0))
            for k in (2, 3, 4, 5):
                toe = J(f"toe{k}-1.{S}")
                e = self.curve([self.pt(an + np.array([s * 0.012, 0.0, 0.05]), D, FT), self.pt(toe + np.array([0, 0.0, -0.018]), D, FT)], FT)
                self.line(e, FT, 0.003, 0.28 * mm, taper=(0.15, 0.35, 0.8, 1.0))
            if veins > 0:
                arch = self.curve([self.pt(an + np.array([-s * 0.03, -0.02, 0.06]), D, FT), self.pt(an * 0.5 + big * 0.5, D, FT), self.pt(an + np.array([s * 0.035, -0.03, 0.07]), D, FT)], FT)
                self.line(arch, FT, 0.0032, 0.55 * mm * veins, taper=(0.0, 0.2, 0.8, 1.0))
        return self.H
