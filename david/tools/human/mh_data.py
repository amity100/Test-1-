"""
MakeHuman data access for the DAVID human pipeline.

Downloads (and caches) the CC0 MakeHuman 1.1 assets we need from the official GitHub repository
(makehumancommunity/makehuman, folder makehuman/data) and parses them:

  * base.obj            -- the hm08 base mesh (body + helper geometry)
  * *.target            -- morph targets (sparse vertex offsets)
  * default.mhskel      -- skeleton definition (joints are means of helper vertices)
  * default_weights.mhw -- skin weights
  * face-poseunits.bvh  -- facial pose units (FACS-like), used to build expressions
  * high-poly eye proxy -- (only used as a reference for eye placement)

All MakeHuman assets are CC0 1.0 (see license.txt in the MakeHuman repository).
Only the math of MakeHuman's (AGPL) program logic is re-implemented here; no code is copied.
"""
from __future__ import annotations

import json
import os
import re
import urllib.request
from dataclasses import dataclass, field

import numpy as np

MH_RAW = "https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/"
CACHE = os.environ.get(
    "MH_CACHE",
    "/tmp/claude-0/-home-user-Test-1-/aa9d8085-4598-5292-aa4e-bfc8e4c43335/scratchpad/human-cache",
)


def fetch(rel: str, optional: bool = False) -> str | None:
    """Return the local path of a MakeHuman data file, downloading it on first use."""
    local = os.path.join(CACHE, rel)
    if os.path.exists(local):
        return local
    os.makedirs(os.path.dirname(local), exist_ok=True)
    url = MH_RAW + rel
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            data = r.read()
    except Exception as e:  # 404 etc.
        if optional:
            return None
        raise RuntimeError(f"cannot fetch {url}: {e}")
    with open(local + ".part", "wb") as f:
        f.write(data)
    os.replace(local + ".part", local)
    return local


# ------------------------------------------------------------------------------------------ OBJ
@dataclass
class ObjMesh:
    v: np.ndarray  # (N,3) float64, decimetres
    vt: np.ndarray  # (T,2)
    faces: np.ndarray  # (F,4) vertex indices (all quads in hm08)
    faces_t: np.ndarray  # (F,4) uv indices
    face_group: np.ndarray  # (F,) group id
    groups: list[str] = field(default_factory=list)

    def group_faces(self, name: str) -> np.ndarray:
        gid = [i for i, g in enumerate(self.groups) if g == name]
        return np.nonzero(np.isin(self.face_group, gid))[0]

    def group_verts(self, name: str) -> np.ndarray:
        return np.unique(self.faces[self.group_faces(name)].ravel())


def load_obj(path: str) -> ObjMesh:
    vs, vts, fs, fts, fg = [], [], [], [], []
    groups: list[str] = []
    gidx = {}
    cur = -1
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("v "):
                vs.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("vt "):
                vts.append([float(x) for x in line.split()[1:3]])
            elif line.startswith("g "):
                name = line.split()[1].strip()
                if name not in gidx:
                    gidx[name] = len(groups)
                    groups.append(name)
                cur = gidx[name]
            elif line.startswith("f "):
                parts = line.split()[1:]
                vi, ti = [], []
                for p in parts:
                    a = p.split("/")
                    vi.append(int(a[0]) - 1)
                    ti.append(int(a[1]) - 1 if len(a) > 1 and a[1] else -1)
                if len(vi) == 3:  # never happens in hm08, but keep the arrays rectangular
                    vi.append(vi[2])
                    ti.append(ti[2])
                fs.append(vi)
                fts.append(ti)
                fg.append(cur)
    return ObjMesh(
        np.asarray(vs, np.float64), np.asarray(vts, np.float64), np.asarray(fs, np.int64),
        np.asarray(fts, np.int64), np.asarray(fg, np.int64), groups,
    )


# ------------------------------------------------------------------------------------------ targets
_target_cache: dict[str, tuple[np.ndarray, np.ndarray] | None] = {}


def load_target(rel: str, optional: bool = True):
    """Load a .target file -> (indices, offsets[dm]) or None if it does not exist."""
    if rel in _target_cache:
        return _target_cache[rel]
    path = fetch("data/targets/" + rel, optional=optional)
    if path is None:
        _target_cache[rel] = None
        return None
    idx, off = [], []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            p = line.split()
            idx.append(int(p[0]))
            off.append([float(p[1]), float(p[2]), float(p[3])])
    res = (np.asarray(idx, np.int64), np.asarray(off, np.float64).reshape(-1, 3))
    _target_cache[rel] = res
    return res


# ------------------------------------------------------------------------------------------ skeleton
@dataclass
class MHBone:
    name: str
    parent: str | None
    head: str
    tail: str
    plane: object


def load_skeleton():
    path = fetch("data/rigs/default.mhskel")
    d = json.load(open(path, "r", encoding="utf-8"))
    bones_raw = d["bones"]
    # breadth-first order (parents before children)
    order: list[str] = []
    while len(order) < len(bones_raw):
        n0 = len(order)
        for name, b in bones_raw.items():
            if name in order:
                continue
            if not b.get("parent") or b["parent"] in order:
                order.append(name)
        if len(order) == n0:
            raise RuntimeError("skeleton has bones with missing parents")
    bones = [
        MHBone(n, bones_raw[n].get("parent"), bones_raw[n]["head"], bones_raw[n]["tail"], bones_raw[n].get("rotation_plane"))
        for n in order
    ]
    return bones, d["joints"], d.get("planes", {})


def load_weights():
    path = fetch("data/rigs/default_weights.mhw")
    d = json.load(open(path, "r", encoding="utf-8"))
    return d["weights"]  # bone -> [[vidx, w], ...]


# ------------------------------------------------------------------------------------------ BVH
def _euler_static(ai, aj, ak, axes: str):
    """Rotation matrix for static-frame euler angles, axes like 'syzx' (first axis gets ai)."""
    def R(axis, a):
        c, s = np.cos(a), np.sin(a)
        if axis == "x":
            return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
        if axis == "y":
            return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
        return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    a = axes[1:]
    return R(a[2], ak) @ R(a[1], aj) @ R(a[0], ai)


def load_bvh_rotations(rel: str):
    """Parse a MakeHuman (Z-up) BVH -> (joint names, frames[F][joint] -> 3x3 rotation in MH Y-up axes).

    Implements MakeHuman's convention: a BVH joint rotation is a rotation in *global* axes applied at
    that joint (the BVH skeleton has no rest rotations), converted from Z-up to Y-up.
    """
    path = fetch(rel)
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    hier, motion = text.split("MOTION")
    joints = []  # (name, channels)
    stack = []
    tokens = hier.split("\n")
    pending = None
    offsets = {}
    parents = {}
    for line in tokens:
        w = line.strip().split()
        if not w:
            continue
        if w[0] in ("ROOT", "JOINT"):
            pending = w[1]
            parents[pending] = stack[-1] if stack else None
        elif w[0] == "End":
            pending = "__end__"
        elif w[0] == "{":
            stack.append(pending)
        elif w[0] == "}":
            stack.pop()
        elif w[0] == "OFFSET" and pending and pending != "__end__":
            offsets[pending] = [float(x) for x in w[1:4]]
        elif w[0] == "CHANNELS":
            joints.append((stack[-1], w[2:]))
    # Z-up detection (MakeHuman auto-guess): spine goes along Z in this file
    lines = [l for l in motion.strip().split("\n")[2:] if l.strip()]
    frames = []
    for l in lines:
        data = [float(x) for x in l.split()]
        k = 0
        fr = {}
        for name, ch in joints:
            vals = data[k:k + len(ch)]
            k += len(ch)
            ang = {}
            for c, v in zip(ch, vals):
                ang[c] = np.deg2rad(v)
            ax, ay, az = ang.get("Xrotation", 0.0), ang.get("Yrotation", 0.0), ang.get("Zrotation", 0.0)
            # Z-up -> Y-up: M = Rx(ax) * Rz(-ay) * Ry(az)   (channel order X Y Z)
            order = [c for c in ch if c.endswith("rotation")]
            assert order == ["Xrotation", "Yrotation", "Zrotation"], order
            fr[name] = _euler_static(az, -ay, ax, "syzx")
        frames.append(fr)
    return [n for n, _ in joints], frames, parents


# ------------------------------------------------------------------------------------------ mhclo
def load_mhclo(rel: str):
    """Parse a MakeHuman proxy fitting file (used for the eye proxy reference)."""
    path = fetch(rel)
    verts = []
    scales = {}
    obj = None
    mode = None
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            w = s.split()
            if w[0] == "verts":
                mode = "verts"
                continue
            if w[0] in ("x_scale", "y_scale", "z_scale"):
                scales[w[0]] = (int(w[1]), int(w[2]), float(w[3]))
                continue
            if w[0] == "obj_file":
                obj = w[1]
                continue
            if mode == "verts":
                if len(w) == 9:
                    verts.append((int(w[0]), int(w[1]), int(w[2]), float(w[3]), float(w[4]), float(w[5]), float(w[6]), float(w[7]), float(w[8])))
                elif len(w) == 1:
                    verts.append((int(w[0]), int(w[0]), int(w[0]), 1.0, 0.0, 0.0, 0.0, 0.0, 0.0))
                else:
                    mode = None
    return verts, scales, obj


def fit_mhclo(verts, scales, base_v):
    """MakeHuman proxy fitting: v = sum(w_i * ref_i) + offset * scale (scale per axis from ref distances)."""
    sc = np.ones(3)
    for i, key in enumerate(("x_scale", "y_scale", "z_scale")):
        if key in scales:
            a, b, d = scales[key]
            sc[i] = abs(base_v[a][i] - base_v[b][i]) / d
    out = np.zeros((len(verts), 3))
    for k, (a, b, c, wa, wb, wc, ox, oy, oz) in enumerate(verts):
        out[k] = wa * base_v[a] + wb * base_v[b] + wc * base_v[c] + np.array([ox, oy, oz]) * sc
    return out
