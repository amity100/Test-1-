"""
Surface fields of the Syrian brown bear: regions, fur length / flow, fur mask, base colours, micro normals.

All functions take bind-pose positions P (N,3), normals N (N,3) and per-point bone weights W (N, nBones)
(interpolated from the skin weights), so they can be evaluated at mesh vertices *and* at texels.
Colours are returned in *linear* RGB.
"""
from __future__ import annotations

import numpy as np

import bear_design as B
from sdf import sd_ellipsoid

BI = B.BONE_INDEX


def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(np.asarray(c, dtype=np.float64), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def wsum(W, names):
    return sum(W[:, BI[n]] for n in names)


def regions(W):
    """soft region weights from skin weights"""
    r = {}
    r['head'] = wsum(W, ['head', 'lipU', 'earL', 'earR'])
    r['jaw'] = wsum(W, ['jaw'])
    r['ear'] = wsum(W, ['earL', 'earR'])
    r['neck'] = wsum(W, ['neck1', 'neck2'])
    r['torso'] = wsum(W, ['hips', 'spine1', 'spine2'])
    r['tail'] = wsum(W, ['tail'])
    r['foreUp'] = wsum(W, ['scapL', 'scapR', 'humL', 'humR'])
    r['foreLo'] = wsum(W, ['foreL', 'foreR'])
    r['forePaw'] = wsum(W, ['wristL', 'wristR', 'toesL', 'toesR'])
    r['hindUp'] = wsum(W, ['femL', 'femR'])
    r['hindLo'] = wsum(W, ['tibL', 'tibR'])
    r['hindPaw'] = wsum(W, ['ankleL', 'ankleR', 'htoesL', 'htoesR'])
    return r


# ----------------------------------------------------------------------------------------------- local frames

def to_head(P):
    return B.HEAD.to_local(P)


def to_jaw(P):
    return B.JAWF.to_local(P)


def dir_to_head(D):
    return D @ B.HEAD.R


def dir_to_jaw(D):
    return D @ B.JAWF.R


# ----------------------------------------------------------------------------------------------- face features

def nose_mask(P):
    """1 on the bare rhinarium (nose pad)."""
    Q = to_head(P)
    d = sd_ellipsoid(Q, (0, -0.002, 0.33), (0.044, 0.035, 0.028))
    front = smoothstep(0.295, 0.312, Q[:, 2])
    return (1 - smoothstep(0.0, 0.006, d)) * front


def mouth_fields(P, N, W):
    """returns (interior 0..1, lip band 0..1): interior = gums / palate / tongue, lip = bare lip margin.
    W (skin weights) separates the upper jaw (head) from the lower jaw (jaw bone)."""
    jw = smoothstep(0.3, 0.7, W[:, BI['jaw']])
    Qh = to_head(P)
    Nh = dir_to_head(N)
    Qj = to_jaw(P)
    Nj = dir_to_jaw(N)
    # upper jaw: everything below the lip line (palate between the lips, the lips' lower margin)
    up_band = smoothstep(-0.052, -0.059, Qh[:, 1]) * smoothstep(0.11, 0.14, Qh[:, 2]) * (1 - smoothstep(0.058, 0.068, np.abs(Qh[:, 0])))
    up_in = up_band * smoothstep(0.15, 0.6, -Nh[:, 1]) * (1 - smoothstep(0.034, 0.046, np.abs(Qh[:, 0]))) * (1 - smoothstep(0.325, 0.345, Qh[:, 2]))
    # lower jaw: the top of the mandible (tongue, gums) and the lower lip margin
    lo_band = smoothstep(-0.003, 0.003, Qj[:, 1]) * (1 - smoothstep(0.028, 0.038, Qj[:, 1])) \
        * smoothstep(0.0, 0.03, Qj[:, 2]) * (1 - smoothstep(0.2, 0.215, Qj[:, 2])) * (1 - smoothstep(0.05, 0.06, np.abs(Qj[:, 0])))
    lo_in = lo_band * smoothstep(0.15, 0.6, Nj[:, 1]) * (1 - smoothstep(0.031, 0.042, np.abs(Qj[:, 0])))
    up_band *= 1 - jw
    up_in *= 1 - jw
    lo_band *= jw
    lo_in *= jw
    interior = np.clip(np.maximum(up_in, lo_in), 0, 1)
    lip = np.clip(np.maximum(up_band, lo_band), 0, 1)
    return interior, lip


def eye_mask(P):
    """1 on the bare eyelid rim around each eye."""
    Q = to_head(P)
    m = np.zeros(len(P))
    for s in (1, -1):
        c = np.array([0.061 * s, 0.047, 0.192])
        d = np.linalg.norm((Q - c) / np.array([1.0, 1.25, 1.0]), axis=1)
        m = np.maximum(m, 1 - smoothstep(0.016, 0.024, d))
    return m


def pad_mask(P, N, W):
    """1 on the bare soles / toe pads."""
    r = regions(W)
    paw = np.clip(r['forePaw'] + r['hindPaw'], 0, 1)
    down = smoothstep(0.45, 0.8, -N[:, 1])
    low = 1 - smoothstep(0.03, 0.06, P[:, 1])
    return paw * down * low


# ----------------------------------------------------------------------------------------------- fur


def fur_length(P, N, W):
    """fur length (m) at bind positions."""
    r = regions(W)
    Qh = to_head(P)
    y = P[:, 1]
    L = np.zeros(len(P))
    # torso: long guard hair on the hump / back / belly, shorter on the flanks
    flank = np.abs(N[:, 0])
    belly = smoothstep(0.2, 0.8, -N[:, 1])
    back = smoothstep(0.3, 0.9, N[:, 1])
    hump = np.exp(-((P[:, 2] - 0.26) ** 2) / 0.05) * back
    torso = 0.085 + 0.02 * back + 0.02 * hump + 0.022 * belly - 0.01 * flank
    L += r['torso'] * torso + r['tail'] * 0.05
    L += r['neck'] * (0.095 + 0.015 * smoothstep(-0.2, 0.6, -N[:, 1]))
    # legs: long on the upper limbs, "feathering" behind the forearms, short on the paws
    behind = smoothstep(0.0, 0.8, -N[:, 2])
    L += r['foreUp'] * (0.085 + 0.015 * behind)
    L += r['foreLo'] * (0.062 + 0.03 * behind * smoothstep(0.12, 0.32, y))
    L += r['forePaw'] * (0.018 + 0.02 * smoothstep(0.05, 0.11, y))
    L += r['hindUp'] * (0.085 + 0.01 * behind)
    L += r['hindLo'] * (0.055 + 0.015 * behind)
    L += r['hindPaw'] * (0.015 + 0.015 * smoothstep(0.05, 0.12, y))
    # head
    zh = Qh[:, 2]
    muzzle = smoothstep(0.16, 0.24, zh)
    cheek = smoothstep(0.04, 0.09, np.abs(Qh[:, 0])) * (1 - smoothstep(0.14, 0.2, zh)) * (1 - smoothstep(0.03, 0.08, Qh[:, 1]))
    head = 0.032 * (1 - muzzle) + 0.011 * muzzle + 0.03 * cheek
    head *= 1 - 0.6 * smoothstep(0.26, 0.31, zh)
    L += r['head'] * head
    ear = 0.028
    L = L * (1 - r['ear']) + r['ear'] * ear
    # jaw: short on the lower lip, long "beard" ruff under the chin / throat
    Qj = to_jaw(P)
    beard = smoothstep(-0.02, -0.06, Qj[:, 1]) * (1 - smoothstep(0.12, 0.18, Qj[:, 2]))
    L += r['jaw'] * (0.012 + 0.05 * beard)
    # bare skin
    interior, lip = mouth_fields(P, N, W)
    bare = np.maximum.reduce([nose_mask(P), lip, eye_mask(P) * 0.9, pad_mask(P, N, W)])
    L *= 1 - bare
    return np.clip(L, 0, 0.13)


def fur_flow(P, N, W):
    """combing direction (unit, tangent to the surface) in bind space."""
    r = regions(W)
    n = len(P)
    F = np.zeros((n, 3))
    flank = np.clip(np.abs(N[:, 0]), 0, 1)[:, None]
    down = np.array([0.0, -1.0, 0.0])
    backw = np.array([0.0, 0.0, -1.0])
    torso = backw * 1.0 + down * (0.25 + 0.9 * flank)
    F += r['torso'][:, None] * torso + r['tail'][:, None] * (backw + down * 0.8)
    F += r['neck'][:, None] * (backw * 0.9 + down * (0.35 + 0.8 * flank))
    legdir = np.array([0.0, -1.0, -0.18])
    F += (r['foreUp'] + r['foreLo'] + r['forePaw'])[:, None] * legdir
    F += (r['hindUp'] + r['hindLo'] + r['hindPaw'])[:, None] * np.array([0.0, -1.0, 0.12])
    # head: from the nose back over the skull; cheeks sweep back and out; ears point up/out
    Hback = B.HEAD.dir(0, 0.15, -1.0)
    Qh = to_head(P)
    side = np.sign(Qh[:, 0])[:, None]
    cheek_out = np.stack([side[:, 0] * 0.5, np.zeros(n) - 0.35, np.zeros(n)], axis=1) @ B.HEAD.R.T
    ch = (smoothstep(0.04, 0.09, np.abs(Qh[:, 0])) * (1 - smoothstep(0.02, 0.07, Qh[:, 1])))[:, None]
    F += r['head'][:, None] * (Hback + ch * cheek_out)
    Jback = B.JAWF.dir(0, -0.5, -1.0)
    F += r['jaw'][:, None] * Jback
    F += r['ear'][:, None] * B.HEAD.dir(0, 1.0, -0.3) * 2.0
    # project to the tangent plane
    F -= (F * N).sum(1, keepdims=True) * N
    ln = np.linalg.norm(F, axis=1, keepdims=True)
    fallback = np.cross(N, np.array([1.0, 0.0, 0.0]))
    F = np.where(ln > 1e-6, F / np.maximum(ln, 1e-9), fallback / np.maximum(np.linalg.norm(fallback, axis=1, keepdims=True), 1e-9))
    return F


# ----------------------------------------------------------------------------------------------- colour

def fur_colour(P, N, W, noise):
    """linear base colour of the pelt (colour at mid-shaft) — pale straw / golden-tawny with darker legs."""
    r = regions(W)
    y = P[:, 1]
    straw = srgb_to_lin([0.70, 0.57, 0.38])
    golden = srgb_to_lin([0.63, 0.49, 0.31])
    tawny = srgb_to_lin([0.48, 0.35, 0.22])
    brown = srgb_to_lin([0.32, 0.22, 0.14])
    dark = srgb_to_lin([0.2, 0.14, 0.09])
    back = smoothstep(0.0, 0.9, N[:, 1])[:, None]
    belly = smoothstep(0.35, 0.95, -N[:, 1])[:, None] * 0.8
    body = golden * (1 - back) + straw * back
    body = body * (1 - belly) + tawny * belly
    # legs darken toward the paws
    # darker legs: the colour deepens gradually from the elbows / knees down to the paws
    legs = (r['foreUp'] + r['foreLo'] + r['forePaw'] + r['hindUp'] + r['hindLo'] + r['hindPaw'])[:, None] * smoothstep(0.62, 0.36, y)[:, None]
    lk = smoothstep(0.42, 0.1, y)[:, None]
    legc = tawny * (1 - lk) + (brown * 0.6 + dark * 0.4) * lk
    C = body * (1 - legs) + legc * legs
    C = C * (1 - r['tail'][:, None] * 0.35)
    # head: golden forehead, pale cheeks, tan muzzle darkening to the nose, darker ears
    Qh = to_head(P)
    hw = np.clip(r['head'] + r['jaw'], 0, 1)[:, None]
    muzzle = smoothstep(0.17, 0.28, Qh[:, 2])[:, None]
    headc = golden * 1.05 * (1 - muzzle) + (tawny * 0.75 + brown * 0.25) * muzzle
    cheek = (smoothstep(0.05, 0.1, np.abs(Qh[:, 0])) * (1 - smoothstep(0.0, 0.05, Qh[:, 1])))[:, None]
    headc = headc * (1 - cheek * 0.5) + straw * cheek * 0.5
    eyes = (1 - smoothstep(0.02, 0.05, np.min([np.linalg.norm(Qh - np.array([0.061 * s, 0.047, 0.192]), axis=1) for s in (1, -1)], axis=0)))[:, None]
    headc = headc * (1 - 0.45 * eyes)
    earc = brown * 0.8 + tawny * 0.2
    headc = headc * (1 - r['ear'][:, None]) + earc * r['ear'][:, None]
    C = C * (1 - hw) + headc * hw
    # large-scale variation: sun-bleached patches, darker saddle
    C = C * (0.93 + 0.14 * noise[:, None])
    return C
