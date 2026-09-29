"""
Syrian brown bear (Ursus arctos syriacus) — anatomy sculpt, skeleton and skin-weight rules.

Rest pose: standing on all fours, head slightly lowered, jaw open by JAW_REST (so the mesh has separate
upper / lower lips and a mouth interior that opens cleanly). The SDF describes the *under-coat* surface:
the fur shells add 1-11 cm on top, so the base is deliberately slimmer than the silhouette of a real bear.

Adult male proportions (Syrian subspecies is the smallest brown bear): ~1.85 m nose to tail, ~1.0 m at
the shoulder hump, ~2.05 m standing. Conventions: metres, +Y up, faces +Z, +X = the bear's left.
"""
from __future__ import annotations

import math

import numpy as np

from sdf import Frame, Prim, custom, ellipsoid, euler, rot_x, rot_y, rot_z, round_cone, capsule, sd_ellipsoid, smin

# ----------------------------------------------------------------------------------------------- skeleton

HEAD_PITCH = 0.30      # skull axis tilted nose-down (rad)
JAW_REST = 0.17        # rest-pose jaw opening (rad); "closed" at runtime = -JAW_REST

J: dict[str, np.ndarray] = {}


def _j(name, x, y, z):
    J[name] = np.array([x, y, z], dtype=np.float64)


_j('root', 0, 0, 0)
# v2 polish: the body sits LIFT higher on longer legs (less deep in side view, as in a real brown bear)
LIFT = 0.05
_j('hips', 0, 0.80 + LIFT, -0.50)
_j('spine1', 0, 0.84 + LIFT, -0.20)
_j('spine2', 0, 0.87 + LIFT, 0.12)
_j('neck1', 0, 0.86 + LIFT, 0.42)
_j('neck2', 0, 0.81 + LIFT, 0.60)
_j('head', 0, 0.77 + LIFT, 0.75)

HEAD_S = 1.1           # uniform scale of the head (design units below are for a 1.0 head)
HEAD = Frame(J['head'], rot_x(HEAD_PITCH), HEAD_S)
_j('jaw', *HEAD.pt(0, -0.055, 0.105))
JAWF = Frame(J['jaw'], HEAD.R @ rot_x(JAW_REST), HEAD_S)
_j('lipU', *HEAD.pt(0, -0.02, 0.31))
_j('earL', *HEAD.pt(0.1, 0.085, 0.032))
_j('earR', *HEAD.pt(-0.1, 0.085, 0.032))
_j('tail', 0, 0.80 + LIFT, -0.82)

# face landmarks (head design units) shared with bear_paint.py / build_bear.py
EYE = (0.0635, 0.043, 0.193)      # left eye centre, on the side of the skull at the stop (x mirrored for the right)
EYE_YAW = 0.5                      # eye axis turned out from the skull axis (rad)
EYE_R = 0.0112                     # eyeball radius (design units)
NOSE = (0.0, 0.004, 0.355)         # rhinarium centre
NOSE_R = (0.032, 0.025, 0.024)
NOSE_TIP_Z = NOSE[2] + NOSE_R[2]
MUZZLE_Z0 = 0.215                  # where the short muzzle hair begins (head z)

for s, side in ((1, 'L'), (-1, 'R')):
    _j('scap' + side, 0.115 * s, 0.93 + LIFT, 0.25)
    _j('hum' + side, 0.19 * s, 0.63 + LIFT, 0.40)
    _j('fore' + side, 0.19 * s, 0.37 + 0.5 * LIFT, 0.31)
    _j('wrist' + side, 0.18 * s, 0.10, 0.365)
    _j('toes' + side, 0.18 * s, 0.035, 0.47)
    _j('fem' + side, 0.155 * s, 0.74 + LIFT, -0.53)
    _j('tib' + side, 0.19 * s, 0.45 + 0.5 * LIFT, -0.37)
    _j('ankle' + side, 0.18 * s, 0.13, -0.575)
    _j('htoes' + side, 0.18 * s, 0.035, -0.36)

# (bone, parent) in hierarchy order (parents first)
BONES: list[tuple[str, str | None]] = [
    ('root', None), ('hips', 'root'), ('spine1', 'hips'), ('spine2', 'spine1'), ('neck1', 'spine2'),
    ('neck2', 'neck1'), ('head', 'neck2'), ('jaw', 'head'), ('lipU', 'head'), ('earL', 'head'), ('earR', 'head'),
    ('tail', 'hips'),
]
for side in ('L', 'R'):
    BONES += [('scap' + side, 'spine2'), ('hum' + side, 'scap' + side), ('fore' + side, 'hum' + side),
              ('wrist' + side, 'fore' + side), ('toes' + side, 'wrist' + side)]
for side in ('L', 'R'):
    BONES += [('fem' + side, 'hips'), ('tib' + side, 'fem' + side), ('ankle' + side, 'tib' + side),
              ('htoes' + side, 'ankle' + side)]
BONE_INDEX = {b: i for i, (b, _) in enumerate(BONES)}

# sockets (parent bone, world rest position) used by gameplay
SOCKETS = {
    'mouth': ('head', HEAD.pt(0, -0.05, 0.25)),          # between the canines, where a lamb's back is gripped
    'beard': ('jaw', JAWF.pt(0, -0.085, 0.12)),          # chin / throat ruff David seizes (1 Sam 17:35)
    'headCenter': ('head', HEAD.pt(0, 0.02, 0.13)),
    'nose': ('head', HEAD.pt(0, NOSE[1], NOSE_TIP_Z - 0.01)),
    'eyeL': ('head', HEAD.pt(EYE[0], EYE[1], EYE[2])),
    'eyeR': ('head', HEAD.pt(-EYE[0], EYE[1], EYE[2])),
}

# ----------------------------------------------------------------------------------------------- helpers


def axial(a, b, knots):
    """skin rule: blend bones along segment a→b; knots = [(t, bone), ...] with t in segment units."""
    return ('axial', np.asarray(a, dtype=np.float64), np.asarray(b, dtype=np.float64), knots)


def H(x, y, z):
    return HEAD.pt(x, y, z)


def JW(x, y, z):
    return JAWF.pt(x, y, z)


def hell(name, c, r, Rl=None, **kw):
    """ellipsoid in head space (radii in head design units)"""
    R = HEAD.R if Rl is None else HEAD.R @ Rl
    return ellipsoid(name, H(*c), np.asarray(r) * HEAD_S, R=R, **kw)


def jell(name, c, r, Rl=None, **kw):
    """ellipsoid in jaw space"""
    R = JAWF.R if Rl is None else JAWF.R @ Rl
    return ellipsoid(name, JW(*c), np.asarray(r) * HEAD_S, R=R, **kw)


def mirror(fn):
    """call fn(s, side) for both sides and flatten"""
    out = []
    for s, side in ((1, 'L'), (-1, 'R')):
        out += fn(s, side)
    return out


# ----------------------------------------------------------------------------------------------- sculpt


def torso() -> list[Prim]:
    L = LIFT
    sp = axial(J['hips'] + [0, 0, -0.25], J['neck1'], [(0.0, 'hips'), (0.33, 'spine1'), (0.62, 'spine2'), (0.95, 'spine2'), (1.05, 'neck1')])
    P = [
        # rib cage: deep, keel-shaped chest (v2: less deep, the belly line sits higher)
        ellipsoid('ribs', (0, 0.672 + L, 0.10), (0.258, 0.252, 0.37), bones=sp, sigma=0.03, group='torso'),
        # belly: tucked up toward the flank, still broad
        ellipsoid('belly', (0, 0.628 + L, -0.24), (0.262, 0.222, 0.33), k=0.12, bones=sp, sigma=0.03, group='torso'),
        # rump / pelvis
        ellipsoid('rump', (0, 0.705 + L, -0.55), (0.226, 0.212, 0.25), k=0.12, bones='hips', sigma=0.03, group='torso'),
        # long back muscles: keep the top line continuous from the hump to the tail
        capsule('back', (0, 0.83 + L, 0.12), (0, 0.812 + L, -0.58), 0.125, k=0.14, bones=sp, sigma=0.03, group='torso'),
        # the shoulder hump (digging muscles over the withers) — the brown bear's hallmark, the highest point
        ellipsoid('hump', (0, 0.905 + L, 0.27), (0.15, 0.15, 0.25), R=rot_x(0.1), k=0.14, bones=[('spine2', 0.8), ('neck1', 0.2)], sigma=0.03, group='torso'),
        # the dip behind the hump before the long, level back
        # brisket between the forelegs
        ellipsoid('brisket', (0, 0.585 + L, 0.40), (0.18, 0.15, 0.13), k=0.1, bones=[('spine2', 1.0)], sigma=0.025, group='torso'),
        # tail stub
        ellipsoid('tail', (0, 0.775 + L, -0.79), (0.038, 0.042, 0.06), R=rot_x(0.5), k=0.05, bones='tail', sigma=0.015, group='tail'),
    ]
    return P


def neck() -> list[Prim]:
    L = LIFT
    ax = axial(J['spine2'] + [0, 0, 0.18], J['head'] + [0, 0, 0.04], [(0.0, 'spine2'), (0.3, 'neck1'), (0.7, 'neck2'), (1.0, 'head')])
    return [
        round_cone('neck', (0, 0.78 + L, 0.36), (0, 0.765 + L, 0.71), 0.195, 0.13, k=0.12, bones=ax, sigma=0.03, group='neck'),
        # throat / dewlap under the neck
        ellipsoid('throat', (0, 0.672 + L, 0.59), (0.115, 0.1, 0.15), R=rot_x(-0.25), k=0.1, bones=ax, sigma=0.025, group='neck'),
        # neck ruff on top continuing into the hump
        ellipsoid('nape', (0, 0.87 + L, 0.52), (0.12, 0.08, 0.16), R=rot_x(0.2), k=0.12, bones=ax, sigma=0.025, group='neck'),
    ]


def head() -> list[Prim]:
    """Brown-bear skull: broad, low cranium with a crest, raised forehead over the eyes, and a long, tapering
    muzzle whose top line dips below the forehead (the 'dished' profile) and ends in a moderate, wet rhinarium."""
    hd = 'head'
    HS = HEAD_S
    ex, ey, ez = EYE
    P = [
        # cranium: broad and low
        hell('cranium', (0, 0.02, 0.078), (0.108, 0.09, 0.122), k=0.08, bones=hd, sigma=0.01, group='head'),
        # sagittal crest / temporal muscles: a low ridge along the crown
        hell('crest', (0, 0.07, 0.045), (0.042, 0.045, 0.095), k=0.06, bones=hd, sigma=0.01, group='head'),
        # the raised forehead (frontal sinuses) above and between the eyes
        hell('forehead', (0, 0.06, 0.15), (0.06, 0.05, 0.062), k=0.05, bones=hd, sigma=0.01, group='head'),
        # zygomatic arches + masseters: the broad cheeks behind and below the eyes
        hell('cheekL', (0.078, -0.01, 0.1), (0.058, 0.058, 0.085), Rl=rot_y(0.25), k=0.05, bones=hd, sigma=0.01, group='head'),
        hell('cheekR', (-0.078, -0.01, 0.1), (0.058, 0.058, 0.085), Rl=rot_y(-0.25), k=0.05, bones=hd, sigma=0.01, group='head'),
        # muzzle: long and tapering
        round_cone('muzzle', H(0, 0.018, 0.165), H(0, -0.004, 0.33), 0.058 * HS, 0.036 * HS, k=0.05, bones=hd, sigma=0.008, group='muzzle'),
        # nasal bridge: a straight / faintly concave top line from the stop to the nose
        round_cone('nasal', H(0, 0.046, 0.19), H(0, 0.024, 0.345), 0.026 * HS, 0.015 * HS, k=0.03, bones=hd, sigma=0.008, group='muzzle'),
        # upper lips hanging over the lower jaw
        hell('lipUL', (0.024, -0.039, 0.27), (0.027, 0.024, 0.075), Rl=rot_y(0.1), k=0.02, bones=[('head', 0.6), ('lipU', 0.4)], sigma=0.006, group='muzzle'),
        hell('lipUR', (-0.024, -0.039, 0.27), (0.027, 0.024, 0.075), Rl=rot_y(-0.1), k=0.02, bones=[('head', 0.6), ('lipU', 0.4)], sigma=0.006, group='muzzle'),
        # rhinarium (the wet nose pad), slightly upturned at the end of the dished line
        hell('nosepad', NOSE, NOSE_R, k=0.018, bones=[('head', 0.8), ('lipU', 0.2)], sigma=0.006, group='nose'),
        # heavy brows over deep-set eyes
        hell('browL', (ex - 0.002, ey + 0.029, ez - 0.01), (0.034, 0.02, 0.03), k=0.025, bones=hd, sigma=0.008, group='head'),
        hell('browR', (-ex + 0.002, ey + 0.029, ez - 0.01), (0.034, 0.02, 0.03), k=0.025, bones=hd, sigma=0.008, group='head'),
    ]
    # nostrils: comma-shaped openings on the front / sides of the pad
    nx, ny, nz = NOSE
    for s in (1, -1):
        P.append(hell('nostril' + ('L' if s > 0 else 'R'), (0.0145 * s, ny + 0.003, NOSE_TIP_Z - 0.006), (0.0078, 0.0058, 0.012), Rl=euler(0.2, 0.55 * s, 0.5 * s), k=0.004, op='sub', group='nose'))
    # eye sockets (the eyeballs are separate geometry): deep-set under the brows
    for s in (1, -1):
        P.append(hell('orbit' + ('L' if s > 0 else 'R'), (ex * s, ey, ez + 0.003), (0.0155, 0.0108, 0.013), Rl=rot_y(EYE_YAW * s), k=0.008, op='sub', group='head'))
    # philtrum groove down the front of the pad to the lip
    P.append(hell('philtrum', (0, ny - 0.025, NOSE_TIP_Z - 0.006), (0.0028, 0.02, 0.008), k=0.004, op='sub', group='nose'))
    return P


def jaw() -> list[Prim]:
    jw = 'jaw'
    HS = HEAD_S
    return [
        # mandible: long, tapering to the chin (ends well behind the nose, as in bears)
        round_cone('mandible', JW(0, -0.026, 0.02), JW(0, -0.028, 0.19), 0.04 * HS, 0.024 * HS, k=0.03, bones=jw, sigma=0.006, group='jaw'),
        # lower lips
        jell('lipL', (0, -0.01, 0.16), (0.034, 0.014, 0.056), k=0.015, bones=jw, sigma=0.006, group='jaw'),
        # chin + the throat ruff ("beard") under it
        jell('chin', (0, -0.038, 0.15), (0.026, 0.02, 0.036), k=0.02, bones=jw, sigma=0.008, group='jaw'),
        jell('beard', (0, -0.05, 0.05), (0.046, 0.036, 0.085), k=0.04, bones=[('jaw', 0.8), ('head', 0.2)], sigma=0.012, group='jaw'),
    ]


def mouth_parts() -> list[Prim]:
    """tongue on the floor of the mouth (added after the jaws so it stays inside)."""
    return [
        jell('tongue', (0, 0.006, 0.115), (0.026, 0.012, 0.08), k=0.012, bones='jaw', sigma=0.005, group='mouth'),
    ]


def ears() -> list[Prim]:
    P = []
    for s, side in ((1, 'L'), (-1, 'R')):
        b = 'ear' + side
        # rounded, thick, cupped ear set wide on the corners of the skull, opening forward-outward
        R = HEAD.R @ euler(-0.25, 0.72 * s, -0.72 * s)
        c = HEAD.pt(0.115 * s, 0.11, 0.03)
        P.append(ellipsoid('ear' + side, c, np.array((0.033, 0.034, 0.021)) * HEAD_S, R=R, k=0.045, bones=[(b, 0.85), ('head', 0.15)], sigma=0.008, group='ear'))
        # the ear cup (concave front)
        cc = c + R @ np.array([0.0, 0.007, 0.018]) * HEAD_S
        P.append(ellipsoid('earcup' + side, cc, np.array((0.021, 0.022, 0.011)) * HEAD_S, R=R, k=0.008, op='sub', group='ear'))
    return P


def forelegs() -> list[Prim]:
    def one(s, side):
        up = axial(J['hum' + side] + [0, 0.1, 0], J['fore' + side], [(0.0, 'scap' + side), (0.35, 'hum' + side), (0.95, 'hum' + side), (1.12, 'fore' + side)])
        lo = axial(J['fore' + side], J['wrist' + side], [(-0.08, 'hum' + side), (0.1, 'fore' + side), (0.9, 'fore' + side), (1.05, 'wrist' + side)])
        yaw = -0.14 * s  # paws turned slightly inward
        Rp = rot_y(yaw)
        x = 0.19 * s
        P = [
            # shoulder blade + deltoid mass rolling over the chest wall
            ellipsoid('shoulder' + side, (0.18 * s, 0.72 + LIFT, 0.33), (0.1, 0.2, 0.155), R=rot_x(-0.35), k=0.1,
                      bones=[('scap' + side, 0.75), ('spine2', 0.25)], sigma=0.025, group='foreleg'),
            # upper arm + the big triceps behind it
            round_cone('arm' + side, (x, 0.64 + LIFT, 0.40), (x, 0.40 + 0.5 * LIFT, 0.325), 0.118, 0.098, k=0.07, bones=up, sigma=0.02, group='foreleg'),
            ellipsoid('triceps' + side, (0.188 * s, 0.53 + 0.75 * LIFT, 0.30), (0.095, 0.155, 0.1), R=rot_x(0.25), k=0.06, bones=up, sigma=0.02, group='foreleg'),
            ellipsoid('elbow' + side, (0.19 * s, 0.385 + 0.5 * LIFT, 0.275), (0.058, 0.058, 0.05), k=0.05, bones=[('hum' + side, 0.5), ('fore' + side, 0.5)], sigma=0.015, group='foreleg'),
            # forearm, muscular at the top, narrowing to the wrist
            round_cone('forearm' + side, (x, 0.37 + 0.5 * LIFT, 0.32), (0.18 * s, 0.125, 0.37), 0.09, 0.064, k=0.05, bones=lo, sigma=0.018, group='foreleg'),
            ellipsoid('forearmM' + side, (0.19 * s, 0.3 + 0.3 * LIFT, 0.355), (0.078, 0.125, 0.076), R=rot_x(-0.12), k=0.05, bones=lo, sigma=0.018, group='foreleg'),
            # wrist + broad front paw (plantigrade: pads under the palm and toes)
            ellipsoid('wrist' + side, (0.18 * s, 0.09, 0.372), (0.06, 0.05, 0.058), k=0.04, bones=[('fore' + side, 0.35), ('wrist' + side, 0.65)], sigma=0.012, group='paw'),
            ellipsoid('paw' + side, (0.18 * s + 0.004 * s, 0.047, 0.432), (0.076, 0.044, 0.072), R=Rp, k=0.035, bones='wrist' + side, sigma=0.012, group='paw'),
        ]
        # five toes in an arc (digit I medial & set back, IV-V the largest)
        cx, cz = 0.18 * s, 0.438
        for i, (dx, dz, r) in enumerate([(-0.052, 0.05, 0.019), (-0.027, 0.066, 0.021), (0.0, 0.071, 0.022), (0.027, 0.066, 0.022), (0.052, 0.052, 0.021)]):
            v = Rp @ np.array([dx * s, 0, dz])  # dx < 0 = medial (toward the body centre)
            c = np.array([cx, 0.036, cz]) + v
            TOES['f' + side].append((c, r, Rp))
            P.append(ellipsoid(f'toe{i}{side}', c, (r * 1.05, 0.022, r * 1.3), R=Rp, k=0.01, bones='toes' + side, sigma=0.008, group='paw'))
        return P
    return mirror(one)


def hindlegs() -> list[Prim]:
    def one(s, side):
        th = axial(J['fem' + side] + [0, 0.08, 0.02], J['tib' + side], [(0.0, 'hips'), (0.25, 'fem' + side), (0.95, 'fem' + side), (1.12, 'tib' + side)])
        sh = axial(J['tib' + side], J['ankle' + side], [(-0.1, 'fem' + side), (0.08, 'tib' + side), (0.9, 'tib' + side), (1.05, 'ankle' + side)])
        yaw = -0.05 * s
        Rp = rot_y(yaw)
        P = [
            # haunch: thigh muscles blending into the rump
            ellipsoid('thigh' + side, (0.175 * s, 0.6 + 0.85 * LIFT, -0.5), (0.13, 0.215, 0.2), R=rot_x(-0.25), k=0.1, bones=th, sigma=0.025, group='hindleg'),
            ellipsoid('ham' + side, (0.16 * s, 0.6 + 0.85 * LIFT, -0.64), (0.1, 0.165, 0.1), R=rot_x(0.3), k=0.08, bones=th, sigma=0.025, group='hindleg'),
            ellipsoid('knee' + side, (0.18 * s, 0.455 + 0.5 * LIFT, -0.37), (0.06, 0.06, 0.065), k=0.06, bones=[('fem' + side, 0.5), ('tib' + side, 0.5)], sigma=0.015, group='hindleg'),
            # shank with the calf behind
            round_cone('shank' + side, (0.19 * s, 0.44 + 0.5 * LIFT, -0.385), (0.18 * s, 0.15, -0.565), 0.073, 0.05, k=0.05, bones=sh, sigma=0.018, group='hindleg'),
            ellipsoid('calf' + side, (0.185 * s, 0.34 + 0.3 * LIFT, -0.49), (0.068, 0.115, 0.073), R=rot_x(0.55), k=0.05, bones=sh, sigma=0.018, group='hindleg'),
            # heel and the long plantigrade sole
            ellipsoid('heel' + side, (0.18 * s, 0.085, -0.585), (0.046, 0.06, 0.05), k=0.035, bones=[('tib' + side, 0.2), ('ankle' + side, 0.8)], sigma=0.012, group='hpaw'),
            ellipsoid('sole' + side, (0.18 * s, 0.042, -0.47), (0.062, 0.036, 0.122), R=Rp, k=0.035, bones='ankle' + side, sigma=0.012, group='hpaw'),
        ]
        cx, cz = 0.18 * s, -0.465
        for i, (dx, dz, r) in enumerate([(-0.045, 0.095, 0.016), (-0.023, 0.112, 0.018), (0.0, 0.117, 0.019), (0.023, 0.112, 0.019), (0.045, 0.098, 0.018)]):
            v = Rp @ np.array([dx * s, 0, dz])
            c = np.array([cx, 0.034, cz]) + v
            TOES['h' + side].append((c, r, Rp))
            P.append(ellipsoid(f'htoe{i}{side}', c, (r * 1.05, 0.02, r * 1.25), R=Rp, k=0.01, bones='htoes' + side, sigma=0.008, group='hpaw'))
        return P
    return mirror(one)


# toe ellipsoids (centre, radius, paw rotation) per paw: filled by sculpt(); used to place the claws
TOES: dict[str, list] = {}


def sculpt() -> list[Prim]:
    for k in ('fL', 'fR', 'hL', 'hR'):
        TOES[k] = []
    prims: list[Prim] = []
    prims += torso()
    prims += neck()
    prims += forelegs()
    prims += hindlegs()
    prims += head()
    prims += jaw()
    prims += ears()
    prims += mouth_parts()
    return prims


BBOX_LO = np.array([-0.40, -0.02, -0.98])
BBOX_HI = np.array([0.40, 1.16, 1.22])
