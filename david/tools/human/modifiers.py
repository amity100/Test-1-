"""
MakeHuman modifier evaluation (macro + regional), re-implemented from the MakeHuman 1.1 semantics.

Macro variables (all 0..1 like in MakeHuman):
  gender (0 female .. 1 male), age (0 = 1y, 0.1875 = 11y, 0.5 = 25y, 1 = 90y), muscle, weight,
  height, proportions (0 uncommon .. 0.5 regular .. 1 ideal), african/asian/caucasian (sum = 1).

Regional modifiers use MakeHuman's full names: "group/target-min|max" (value -1..1) or
"group/target" (value 0..1).  "(lr)" inside a key is expanded to both the "l" and "r" sides.
"""
from __future__ import annotations

import itertools

import numpy as np

from mh_data import load_target


def age_value_from_years(years: float) -> float:
    if years <= 25:
        return (years - 1.0) / 48.0
    return 0.5 + (years - 25.0) / 130.0


def macro_vals(m: dict) -> dict[str, float]:
    g = m.get("gender", 1.0)
    age = m["age"] if "age" in m else age_value_from_years(m.get("age_years", 25))
    vals: dict[str, float] = {"male": g, "female": 1 - g}
    if age < 0.5:
        young = max(0.0, (age - 0.1875) * 3.2)
        vals.update(old=0.0, baby=max(0.0, 1 - age * 5.333), young=young, child=max(0.0, min(1.0, 5.333 * age) - young))
    else:
        old = max(0.0, age * 2 - 1)
        vals.update(child=0.0, baby=0.0, old=old, young=1 - old)
    for key, lo, mid, hi in (("muscle", "minmuscle", "averagemuscle", "maxmuscle"), ("weight", "minweight", "averageweight", "maxweight")):
        x = m.get(key, 0.5)
        vals[hi] = max(0.0, x * 2 - 1)
        vals[lo] = max(0.0, 1 - x * 2)
        vals[mid] = 1 - (vals[hi] + vals[lo])
    h = m.get("height", 0.5)
    vals["maxheight"] = max(0.0, h * 2 - 1)
    vals["minheight"] = max(0.0, 1 - h * 2)
    p = m.get("proportions", 0.5)
    vals["idealproportions"] = max(0.0, p * 2 - 1)
    vals["uncommonproportions"] = max(0.0, 1 - p * 2)
    eth = np.array([m.get("african", 1 / 3), m.get("asian", 1 / 3), m.get("caucasian", 1 / 3)], float)
    eth = eth / eth.sum()
    vals.update(african=eth[0], asian=eth[1], caucasian=eth[2])
    return vals


def macro_targets(m: dict) -> list[tuple[str, float]]:
    v = macro_vals(m)
    out: list[tuple[str, float]] = []
    genders = [g for g in ("female", "male") if v[g] > 1e-6]
    ages = [a for a in ("baby", "child", "young", "old") if v[a] > 1e-6]
    muscles = [x for x in ("minmuscle", "averagemuscle", "maxmuscle") if v[x] > 1e-6]
    weights = [x for x in ("minweight", "averageweight", "maxweight") if v[x] > 1e-6]
    for race in ("african", "asian", "caucasian"):
        for g, a in itertools.product(genders, ages):
            w = v[race] * v[g] * v[a]
            if w > 1e-6:
                out.append((f"macrodetails/{race}-{g}-{a}.target", w))
    for g, a, mu, we in itertools.product(genders, ages, muscles, weights):
        base = v[g] * v[a] * v[mu] * v[we]
        if base < 1e-6:
            continue
        out.append((f"macrodetails/universal-{g}-{a}-{mu}-{we}.target", base))
        for hk in ("minheight", "maxheight"):
            if v[hk] > 1e-6:
                out.append((f"macrodetails/height/{g}-{a}-{mu}-{we}-{hk}.target", base * v[hk]))
        for pk in ("idealproportions", "uncommonproportions"):
            if v[pk] > 1e-6:
                out.append((f"macrodetails/proportions/{g}-{a}-{mu}-{we}-{pk}.target", base * v[pk]))
    return out


def regional_targets(mods: dict[str, float]) -> list[tuple[str, float]]:
    out: list[tuple[str, float]] = []
    for key, val in mods.items():
        keys = [key.replace("(lr)", s) for s in ("l", "r")] if "(lr)" in key else [key]
        for k in keys:
            group, name = k.split("/", 1)
            if "|" in name:
                left_right = name.split("-")
                # "target-min|max": the extremes are the last dash-separated token
                ext = left_right[-1]
                target = "-".join(left_right[:-1])
                lo, hi = ext.split("|")
                if val < 0:
                    out.append((f"{group}/{target}-{lo}.target", -val))
                elif val > 0:
                    out.append((f"{group}/{target}-{hi}.target", val))
            else:
                if val != 0:
                    out.append((f"{group}/{name}.target", val))
    return out


def apply_targets(base_v: np.ndarray, targets: list[tuple[str, float]], verbose=False) -> np.ndarray:
    v = base_v.copy()
    for rel, w in targets:
        t = load_target(rel)
        if t is None:
            print(f"  [warn] missing target {rel}")
            continue
        idx, off = t
        v[idx] += off * w
        if verbose:
            print(f"  {w:6.3f}  {rel}")
    return v


def target_delta(nverts: int, targets: list[tuple[str, float]]) -> np.ndarray:
    d = np.zeros((nverts, 3))
    for rel, w in targets:
        t = load_target(rel)
        if t is None:
            continue
        d[t[0]] += t[1] * w
    return d
