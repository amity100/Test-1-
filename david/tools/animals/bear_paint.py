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
    r = np.array(B.NOSE_R) + 0.001
    d = sd_ellipsoid(Q, B.NOSE, r)
    front = smoothstep(B.NOSE_TIP_Z - 0.05, B.NOSE_TIP_Z - 0.034, Q[:, 2])
    return (1 - smoothstep(0.0, 0.005, d)) * front


def mouth_fields(P, N, W):
    """returns (interior 0..1, lip band 0..1): interior = gums / palate / tongue, lip = bare lip margin.
    W (skin weights) separates the upper jaw (head) from the lower jaw (jaw bone)."""
    jw = smoothstep(0.3, 0.7, W[:, BI['jaw']])
    Qh = to_head(P)
    Nh = dir_to_head(N)
    Qj = to_jaw(P)
    Nj = dir_to_jaw(N)
    # upper jaw: everything below the lip line (palate between the lips, the lips' lower margin)
    zt = B.NOSE_TIP_Z
    up_band = smoothstep(-0.047, -0.055, Qh[:, 1]) * smoothstep(0.11, 0.14, Qh[:, 2]) * (1 - smoothstep(0.056, 0.066, np.abs(Qh[:, 0])))
    up_in = up_band * smoothstep(0.15, 0.6, -Nh[:, 1]) * (1 - smoothstep(0.032, 0.044, np.abs(Qh[:, 0]))) * (1 - smoothstep(zt - 0.045, zt - 0.025, Qh[:, 2]))
    # lower jaw: the top of the mandible (tongue, gums) and the lower lip margin
    lo_band = smoothstep(-0.003, 0.003, Qj[:, 1]) * (1 - smoothstep(0.028, 0.038, Qj[:, 1])) \
        * smoothstep(0.0, 0.03, Qj[:, 2]) * (1 - smoothstep(0.222, 0.237, Qj[:, 2])) * (1 - smoothstep(0.05, 0.06, np.abs(Qj[:, 0])))
    lo_in = lo_band * smoothstep(0.15, 0.6, Nj[:, 1]) * (1 - smoothstep(0.031, 0.042, np.abs(Qj[:, 0])))
    up_band *= 1 - jw
    up_in *= 1 - jw
    lo_band *= jw
    lo_in *= jw
    interior = np.clip(np.maximum(up_in, lo_in), 0, 1)
    lip = np.clip(np.maximum(up_band, lo_band), 0, 1)
    return interior, lip


def eye_dist(P):
    """distance (head design units) to the nearest eye centre, squashed vertically (almond-shaped lids)."""
    Q = to_head(P)
    d = np.full(len(P), 9.0)
    for s in (1, -1):
        c = np.array([B.EYE[0] * s, B.EYE[1], B.EYE[2]])
        d = np.minimum(d, np.linalg.norm((Q - c) / np.array([1.0, 1.3, 1.0]), axis=1))
    return d


def eye_mask(P):
    """1 on the bare, dark eyelid rim around each eye (the eyeball itself is separate geometry)."""
    return 1 - smoothstep(0.0145, 0.0195, eye_dist(P))


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
    # torso: long guard hair on the hump / back, shorter on the flanks and the (sparser) belly
    flank = np.abs(N[:, 0])
    belly = smoothstep(0.2, 0.8, -N[:, 1])
    back = smoothstep(0.3, 0.9, N[:, 1])
    hump = np.exp(-((P[:, 2] - 0.26) ** 2) / 0.05) * back
    torso = 0.082 + 0.022 * back + 0.024 * hump - 0.012 * belly - 0.01 * flank
    L += r['torso'] * torso + r['tail'] * 0.05
    L += r['neck'] * (0.095 + 0.01 * smoothstep(-0.2, 0.6, -N[:, 1]))
    # legs: long on the upper limbs, "feathering" behind the forearms, short on the paws
    behind = smoothstep(0.0, 0.8, -N[:, 2])
    L += r['foreUp'] * (0.082 + 0.018 * behind)
    L += r['foreLo'] * (0.058 + 0.032 * behind * smoothstep(0.12, 0.34, y))
    L += r['forePaw'] * (0.018 + 0.02 * smoothstep(0.05, 0.11, y))
    L += r['hindUp'] * (0.082 + 0.012 * behind)
    L += r['hindLo'] * (0.052 + 0.016 * behind)
    L += r['hindPaw'] * (0.015 + 0.015 * smoothstep(0.05, 0.12, y))
    # head: dense 3-4 cm pelt on the skull, a ruff on the cheeks behind the eyes, very short hair on the muzzle
    zh = Qh[:, 2]
    ax_ = np.abs(Qh[:, 0])
    muzzle = smoothstep(B.MUZZLE_Z0 - 0.02, B.MUZZLE_Z0 + 0.06, zh)
    cheek = smoothstep(0.045, 0.1, ax_) * (1 - smoothstep(0.12, 0.19, zh)) * (1 - smoothstep(0.02, 0.07, Qh[:, 1]))
    crown = smoothstep(0.04, 0.1, Qh[:, 1]) * (1 - smoothstep(0.12, 0.17, zh))
    head = 0.03 * (1 - muzzle) + 0.0125 * muzzle + 0.038 * cheek + 0.008 * crown
    head *= 1 - 0.4 * smoothstep(B.NOSE_TIP_Z - 0.09, B.NOSE_TIP_Z - 0.035, zh)
    # clear the eyes: short hair around the lids (longer only well away, so no hair leans over the eyeball);
    # the clearing reaches further toward the nose because the head hair is combed backward over the eye
    Qe = Qh.copy()
    ed = np.full(len(P), 9.0)
    for s in (1, -1):
        dq = Qe - np.array([B.EYE[0] * s, B.EYE[1], B.EYE[2]])
        dq[:, 2] *= np.where(dq[:, 2] > 0, 0.55, 1.0)
        ed = np.minimum(ed, np.linalg.norm(dq, axis=1))
    head *= 0.12 + 0.88 * smoothstep(0.016, 0.05, ed)
    L += r['head'] * head
    # ears: thick, furry (longest on the back and the rim) so they read as rounded tufts, not discs
    ear = 0.04
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
    for s in (1, -1):
        ec = B.HEAD.pt(0.115 * s, 0.11, 0.03)
        ev = P - ec
        ev /= np.maximum(np.linalg.norm(ev, axis=1, keepdims=True), 1e-6)
        side_w = (np.sign(P[:, 0]) == s).astype(np.float64)[:, None]
        F += (r['ear'][:, None] * side_w) * (ev + B.HEAD.dir(0, 0.6, -0.4)) * 2.0
    # around the eyes the hair radiates away from the lids (backward-outward), never over the eyeball
    for s in (1, -1):
        c = B.HEAD.pt(B.EYE[0] * s, B.EYE[1], B.EYE[2])
        dv = P - c
        dl = np.linalg.norm(dv, axis=1, keepdims=True)
        w = (1 - smoothstep(0.02, 0.06, dl[:, 0]))[:, None] * r['head'][:, None]
        radial = dv / np.maximum(dl, 1e-6) + B.HEAD.dir(0, 0.1, -0.6)
        F = F * (1 - w) + radial * w * 1.5
    # project to the tangent plane
    F -= (F * N).sum(1, keepdims=True) * N
    ln = np.linalg.norm(F, axis=1, keepdims=True)
    fallback = np.cross(N, np.array([1.0, 0.0, 0.0]))
    F = np.where(ln > 1e-6, F / np.maximum(ln, 1e-9), fallback / np.maximum(np.linalg.norm(fallback, axis=1, keepdims=True), 1e-9))
    return F


# ----------------------------------------------------------------------------------------------- colour

def fur_colour(P, N, W, noise, noise2=None):
    """linear base colour of the pelt (colour at mid-shaft) — pale straw / golden-tawny with darker legs,
    a darker nape line, a dusky leathery muzzle, darker eye patches and ear backs, dusty / matted patches."""
    r = regions(W)
    y = P[:, 1]
    L = B.LIFT
    straw = srgb_to_lin([0.68, 0.55, 0.36])
    golden = srgb_to_lin([0.60, 0.46, 0.28])
    tawny = srgb_to_lin([0.46, 0.33, 0.2])
    brown = srgb_to_lin([0.30, 0.2, 0.125])
    dark = srgb_to_lin([0.17, 0.115, 0.075])
    back = smoothstep(0.0, 0.9, N[:, 1])[:, None]
    belly = smoothstep(0.35, 0.95, -N[:, 1])[:, None] * 0.85
    body = golden * (1 - back) + straw * back
    body = body * (1 - belly) + (tawny * 0.8 + brown * 0.2) * belly
    # a darker line along the nape and over the withers (the pelt parts there)
    nape = (np.exp(-(P[:, 0] / 0.06) ** 2) * smoothstep(0.2, 0.7, N[:, 1]) * smoothstep(0.05, 0.3, P[:, 2]) * (1 - smoothstep(0.62, 0.78, P[:, 2])))[:, None]
    body = body * (1 - 0.45 * nape) + tawny * 0.45 * nape
    # darker legs: the colour deepens from the elbows / knees down to the paws
    legs = (r['foreUp'] + r['foreLo'] + r['forePaw'] + r['hindUp'] + r['hindLo'] + r['hindPaw'])[:, None] * smoothstep(0.66 + L, 0.38 + L * 0.5, y)[:, None]
    lk = smoothstep(0.44, 0.1, y)[:, None]
    legc = (tawny * 0.7 + brown * 0.3) * (1 - lk) + (brown * 0.55 + dark * 0.45) * lk
    C = body * (1 - legs) + legc * legs
    C = C * (1 - r['tail'][:, None] * 0.35)
    # head: golden crown, pale cheek ruff, dusky-brown muzzle darkening to the nose, dark eye patches and ears
    Qh = to_head(P)
    hw = np.clip(r['head'] + r['jaw'], 0, 1)[:, None]
    muzzle = smoothstep(B.MUZZLE_Z0 - 0.02, B.MUZZLE_Z0 + 0.1, Qh[:, 2])[:, None]
    tip = smoothstep(B.NOSE_TIP_Z - 0.1, B.NOSE_TIP_Z - 0.03, Qh[:, 2])[:, None]
    muzc = (tawny * 0.7 + brown * 0.3) * (1 - tip) + (brown * 0.7 + dark * 0.3) * tip
    headc = golden * 1.02 * (1 - muzzle) + muzc * muzzle
    cheek = (smoothstep(0.05, 0.1, np.abs(Qh[:, 0])) * (1 - smoothstep(0.0, 0.05, Qh[:, 1])) * (1 - smoothstep(0.15, 0.2, Qh[:, 2])))[:, None]
    headc = headc * (1 - cheek * 0.5) + straw * cheek * 0.5
    ed = eye_dist(P)[:, None]
    eyes = 1 - smoothstep(0.018, 0.045, ed)
    headc = headc * (1 - 0.35 * eyes) + brown * 0.35 * eyes
    # the lower jaw and chin: dusky, the throat ruff paler
    Qj = to_jaw(P)
    chin = (r['jaw'] * smoothstep(0.08, 0.16, Qj[:, 2]))[:, None]
    headc = headc * (1 - 0.6 * chin) + (brown * 0.7 + tawny * 0.3) * 0.6 * chin
    earc = golden * 0.55 + tawny * 0.45
    headc = headc * (1 - r['ear'][:, None]) + earc * r['ear'][:, None]
    C = C * (1 - hw) + headc * hw
    # large-scale variation: sun-bleached patches, darker saddle
    C = C * (0.9 + 0.2 * noise[:, None])
    if noise2 is not None:
        # dusty / matted patches: terra-rossa dust on the lower body and legs, darker matted clumps elsewhere
        low = (1 - smoothstep(0.35, 0.75, y))[:, None]
        dust = smoothstep(0.52, 0.72, noise2)[:, None] * (0.35 + 0.65 * low) * (1 - hw)
        dust_c = srgb_to_lin([0.55, 0.38, 0.27])
        C = C * (1 - 0.5 * dust) + dust_c * 0.5 * dust
        matted = smoothstep(0.62, 0.8, 1 - noise2)[:, None] * (1 - hw) * 0.4
        C = C * (1 - 0.35 * matted)
    return C
