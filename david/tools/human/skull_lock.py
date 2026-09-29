"""
Skull lock: reshape a preset's face / jaw / body while keeping the cranium (the groomed scalp) where it was.

The hair teammate grooms strand hair on the scalp of a preset.  When the face or the macro build of that preset
changes later, MakeHuman's macro targets also move the cranium by several millimetres.  `save_ref()` stores the
body vertices of a preset as a reference; a preset with

    "skull_lock": {"ref": "ref/david_skull.npz"}

then gets its cranium / scalp / nape vertices blended back to the reference shape (rigidly carried by the new head
joint), with a smooth falloff into the face, so the scalp stays within ~1 mm of the reference while the face,
cheeks, jaw and body take the new shape.

    python3 tools/human/skull_lock.py save david          # snapshot the current preset (before editing it)
    python3 tools/human/skull_lock.py check david         # max scalp displacement of the edited preset vs the ref
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
NBODY = 13380


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def lock_weight(v: np.ndarray, head_w: np.ndarray, eye_c: np.ndarray, crown: np.ndarray) -> np.ndarray:
    """Per body vertex 0..1: 1 on the cranium / scalp / ears / nape, 0 on the face and the body."""
    fy = v[:, 1] - eye_c[1]
    phi = np.abs(np.degrees(np.arctan2(v[:, 0] - crown[0], v[:, 2] - crown[2])))  # 0 = front, 180 = back
    # lowest height (relative to the eye centres) that must stay locked, as a function of the angle around the head:
    # forehead above the brow ridge, the temples, the sideburns / ears, the nape
    floor = np.interp(phi, [0, 40, 60, 72, 85, 100, 125, 150, 180], [0.05, 0.047, 0.03, 0.0, -0.05, -0.07, -0.1, -0.115, -0.12])
    w = smoothstep(floor - 0.022, floor, fy)
    # only the head and the upper neck (never the shoulders / trapezius)
    w *= np.clip(head_w, 0.0, 1.0)
    return w


def head_region_weight(h) -> np.ndarray:
    names = h.names
    cols_h = [i for i, n in enumerate(names) if n in ("head", "jaw") or n.startswith(("eye", "ear", "levator", "oris",
              "orbicularis", "temporalis", "risorius", "special", "tongue", "nose", "cheek", "brow", "lid"))]
    cols_n = [i for i, n in enumerate(names) if n.startswith("neck")]
    W = h.Wd[:NBODY]
    return np.clip(W[:, cols_h].sum(1) + 0.9 * W[:, cols_n].sum(1), 0, 1)


def save_ref(preset_name: str, path: str | None = None):
    sys.path.insert(0, HERE)
    from build_human import Human  # noqa: E402
    preset = json.load(open(os.path.join(HERE, "presets", f"{preset_name}.json"), encoding="utf-8"))
    preset.pop("skull_lock", None)
    h = Human(preset)
    path = path or os.path.join(HERE, "ref", f"{preset_name}_skull.npz")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    eye_c = (h.joint("eye.L____head") + h.joint("eye.R____head")) / 2
    np.savez_compressed(path, v=h.v_all[:NBODY].astype(np.float64), head=h.joint("head____head"), eye=eye_c)
    print(f"saved {path}")


def apply(h, cfg: dict):
    """Blend the cranium of Human `h` (after normalisation) back to the reference.  Returns (weights, max_disp)."""
    path = cfg["ref"]
    if not os.path.isabs(path):
        path = os.path.join(HERE, path)
    ref = np.load(path)
    v_ref, head_ref = ref["v"], ref["head"]
    v = h.v_all[:NBODY]
    head_new = h.joint("head____head")
    eye_c = (h.joint("eye.L____head") + h.joint("eye.R____head")) / 2
    lm_crown = np.array([0.0, eye_c[1] + 0.034, eye_c[2] - 0.04])
    w = lock_weight(v, head_region_weight(h), eye_c, lm_crown) * float(cfg.get("strength", 1.0))
    target = v_ref + (head_new - head_ref)
    before = np.linalg.norm(v - target, axis=1)
    h.v_all[:NBODY] = v * (1 - w[:, None]) + target * w[:, None]
    return w, before


def check(preset_name: str):
    sys.path.insert(0, HERE)
    from build_human import Human  # noqa: E402
    preset = json.load(open(os.path.join(HERE, "presets", f"{preset_name}.json"), encoding="utf-8"))
    h = Human(preset)
    ref = np.load(os.path.join(HERE, "ref", f"{preset_name}_skull.npz"))
    v = h.v_all[:NBODY]
    eye_c = (h.joint("eye.L____head") + h.joint("eye.R____head")) / 2
    crown = np.array([0.0, eye_c[1] + 0.034, eye_c[2] - 0.04])
    # scalp = the bake_skin.py hairline region
    fy = v[:, 1] - eye_c[1]
    phi = np.abs(np.degrees(np.arctan2(v[:, 0] - crown[0], v[:, 2] - crown[2])))
    hl = np.interp(phi, [0, 30, 45, 62, 72, 80, 100, 120, 140, 180], [0.072, 0.07, 0.064, 0.05, 0.036, -0.04, -0.028, -0.05, -0.08, -0.09])
    scalp = (fy > hl) & (head_region_weight(h) > 0.5)
    d_abs = np.linalg.norm(v - ref["v"], axis=1)
    d_rel = np.linalg.norm((v - h.joint("head____head")) - (ref["v"] - ref["head"]), axis=1)
    print(f"scalp verts {scalp.sum()}: |d| world max {d_abs[scalp].max() * 1000:.2f} mm mean {d_abs[scalp].mean() * 1000:.2f} mm;"
          f" head-relative max {d_rel[scalp].max() * 1000:.2f} mm mean {d_rel[scalp].mean() * 1000:.2f} mm;"
          f" eye centre moved {np.linalg.norm(eye_c - ref['eye']) * 1000:.2f} mm, head joint {np.linalg.norm(h.joint('head____head') - ref['head']) * 1000:.2f} mm")
    return d_abs, scalp


if __name__ == "__main__":
    cmd, name = sys.argv[1], sys.argv[2]
    if cmd == "save":
        save_ref(name)
    else:
        check(name)
