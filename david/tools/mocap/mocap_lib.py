"""
Motion-capture pipeline for DAVID: CMU BVH (Bruce Hahne's MotionBuilder-friendly conversion) -> MakeHuman skeleton.

Conventions (shared with src/characters/human/HumanRig.ts):
  * character space: +Y up, faces +Z, the character's left is +X, metres.
  * every MakeHuman bone i has a rest world rotation Q_i (arms-down rest pose) and a rest world position.
    A pose is a per-bone world *delta* C_i (bone world rotation = C_i * Q_i).  Local controls are
    c_i = C_parent^-1 * C_i ("aligned" frame: character axes), and HumanRig writes bone.quaternion = P_i c_i Q_i.
  * quaternions are numpy arrays [..., 4] = (x, y, z, w).

Retargeting is *direction exact*: every mapped bone points exactly where the actor's bone points (the source T-pose
of frame 1 only fixes the twist reference); limb-length differences are absorbed by scaling the root motion by the
leg-length ratio and by an offline foot-lock IK pass on OUR skeleton (no sliding on our proportions).
"""
from __future__ import annotations

import gzip
import json
import math
import struct
from dataclasses import dataclass, field

import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.spatial.transform import Rotation

# ------------------------------------------------------------------------------------------------ quaternion math


def qmul(a, b):
    ax, ay, az, aw = np.moveaxis(np.asarray(a, dtype=np.float64), -1, 0)
    bx, by, bz, bw = np.moveaxis(np.asarray(b, dtype=np.float64), -1, 0)
    return np.stack([
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ], axis=-1)


def qinv(q):
    q = np.asarray(q, dtype=np.float64)
    return q * np.array([-1, -1, -1, 1.0])


def qnorm(q):
    q = np.asarray(q, dtype=np.float64)
    return q / np.linalg.norm(q, axis=-1, keepdims=True)


def qrot(q, v):
    q = np.asarray(q, dtype=np.float64)
    v = np.asarray(v, dtype=np.float64)
    u = q[..., :3]
    w = q[..., 3:4]
    t = 2.0 * np.cross(u, v)
    return v + w * t + np.cross(u, t)


def qident(shape=()):
    q = np.zeros(tuple(shape) + (4,))
    q[..., 3] = 1
    return q


def qaxis(axis, angle):
    axis = np.asarray(axis, dtype=np.float64)
    axis = axis / np.linalg.norm(axis, axis=-1, keepdims=True)
    angle = np.asarray(angle, dtype=np.float64)[..., None]
    return np.concatenate([axis * np.sin(angle / 2), np.cos(angle / 2)], axis=-1)


def qminarc(u, v):
    """Shortest rotation taking unit vector u onto unit vector v."""
    u = np.asarray(u, dtype=np.float64)
    v = np.asarray(v, dtype=np.float64)
    u = u / np.linalg.norm(u, axis=-1, keepdims=True)
    v = v / np.linalg.norm(v, axis=-1, keepdims=True)
    d = np.sum(u * v, axis=-1, keepdims=True)
    c = np.cross(u, v)
    q = np.concatenate([c, 1 + d], axis=-1)
    bad = (1 + d[..., 0]) < 1e-8
    if np.any(bad):
        # opposite vectors: rotate 180 deg about any perpendicular axis
        perp = np.cross(u, np.array([1.0, 0, 0]))
        perp = np.where(np.linalg.norm(perp, axis=-1, keepdims=True) < 1e-6, np.cross(u, np.array([0, 0, 1.0])), perp)
        q = np.where(bad[..., None], np.concatenate([perp, np.zeros_like(d)], axis=-1), q)
    return qnorm(q)


def qpow(q, t):
    """q^t (fraction of the rotation), shortest path."""
    q = np.asarray(q, dtype=np.float64)
    q = np.where(q[..., 3:4] < 0, -q, q)
    w = np.clip(q[..., 3], -1, 1)
    ang = 2 * np.arccos(w)
    s = np.sqrt(np.maximum(1 - w * w, 0))
    axis = np.where(s[..., None] > 1e-9, q[..., :3] / np.maximum(s[..., None], 1e-12), np.array([1.0, 0, 0]))
    t = np.asarray(t, dtype=np.float64)
    return np.concatenate([axis * np.sin(ang * t / 2)[..., None], np.cos(ang * t / 2)[..., None]], axis=-1)


def qslerp(a, b, t):
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    d = np.sum(a * b, axis=-1, keepdims=True)
    b = np.where(d < 0, -b, b)
    return qnorm(qmul(a, qpow(qmul(qinv(a), b), t)))


def swing_twist(q, axis):
    """q = swing * twist, twist about `axis` (unit, same frame as q)."""
    axis = np.asarray(axis, dtype=np.float64)
    p = np.sum(q[..., :3] * axis, axis=-1, keepdims=True) * axis
    tw = np.concatenate([p, q[..., 3:4]], axis=-1)
    n = np.linalg.norm(tw, axis=-1, keepdims=True)
    tw = np.where(n > 1e-9, tw / np.maximum(n, 1e-12), qident(q.shape[:-1]))
    sw = qmul(q, qinv(tw))
    return sw, tw


def twist_frac(tw, axis, f):
    """Continuous fraction of a twist track [F, 4] about `axis` (angle unwrapped along time: no 180-degree pops)."""
    ang = 2 * np.arctan2(np.sum(tw[..., :3] * axis, axis=-1), tw[..., 3])
    if ang.ndim == 1 and len(ang) > 1:
        ang = np.unwrap(ang)
        # keep the whole track in (-2pi, 2pi) around zero
        ang -= 2 * np.pi * np.round(np.median(ang) / (2 * np.pi))
    return qaxis(np.broadcast_to(axis, ang.shape + (3,)), ang * f)


def qcontinuous(q):
    """Flip signs along axis 0 so consecutive quaternions stay in one hemisphere."""
    q = q.copy()
    for i in range(1, len(q)):
        d = np.sum(q[i] * q[i - 1], axis=-1)
        q[i] = np.where(d[..., None] < 0, -q[i], q[i])
    return q


def qsmooth(q, sigma):
    """Gaussian low-pass on a quaternion track (axis 0 = time)."""
    if sigma <= 0:
        return q
    q = qcontinuous(q)
    return qnorm(gaussian_filter1d(q, sigma, axis=0, mode='nearest'))


def yaw_of(q):
    """Heading of the rotated +Z axis about +Y."""
    f = qrot(q, np.array([0, 0, 1.0]))
    return np.arctan2(f[..., 0], f[..., 2])


# ------------------------------------------------------------------------------------------------ BVH

@dataclass
class Bvh:
    names: list
    parents: list
    offsets: np.ndarray
    channels: list  # per joint list of channel names
    ends: dict  # joint index -> end-site offset
    frames: np.ndarray  # [F, C]
    frame_time: float
    index: dict = field(default_factory=dict)

    def fk(self, frames=None):
        """World rotations [F, J, 4] and positions [F, J, 3] (source units)."""
        mot = self.frames if frames is None else self.frames[frames]
        F = mot.shape[0]
        J = len(self.names)
        G = np.zeros((F, J, 4))
        P = np.zeros((F, J, 3))
        col = 0
        L = np.zeros((F, J, 4))
        L[..., 3] = 1
        rootpos = np.zeros((F, 3))
        for j in range(J):
            ch = self.channels[j]
            rot_axes = [c[0] for c in ch if c.endswith('rotation')]
            rot_cols = [col + k for k, c in enumerate(ch) if c.endswith('rotation')]
            pos_cols = {c[0]: col + k for k, c in enumerate(ch) if c.endswith('position')}
            if pos_cols:
                rootpos = np.stack([mot[:, pos_cols['X']], mot[:, pos_cols['Y']], mot[:, pos_cols['Z']]], axis=-1)
            if rot_axes:
                L[:, j] = Rotation.from_euler(''.join(rot_axes).upper(), mot[:, rot_cols], degrees=True).as_quat()
            col += len(ch)
        for j in range(J):
            p = self.parents[j]
            if p < 0:
                G[:, j] = L[:, j]
                P[:, j] = rootpos + self.offsets[j]
            else:
                G[:, j] = qmul(G[:, p], L[:, j])
                P[:, j] = P[:, p] + qrot(G[:, p], self.offsets[j])
        return G, P


def load_bvh(path) -> Bvh:
    toks = open(path).read().split()
    i = 0
    names, parents, offsets, channels, ends = [], [], [], [], {}
    stack = []
    last = -1
    while toks[i] != 'MOTION':
        t = toks[i]
        if t in ('ROOT', 'JOINT'):
            names.append(toks[i + 1])
            parents.append(stack[-1] if stack else -1)
            offsets.append([0, 0, 0])
            channels.append([])
            last = len(names) - 1
            i += 2
        elif t == 'End':
            # End Site { OFFSET x y z }
            j = i
            while toks[j] != 'OFFSET':
                j += 1
            ends[stack[-1]] = np.array([float(toks[j + 1]), float(toks[j + 2]), float(toks[j + 3])])
            while toks[j] != '}':
                j += 1
            i = j + 1
            last = -2
        elif t == '{':
            stack.append(last)
            i += 1
        elif t == '}':
            stack.pop()
            i += 1
        elif t == 'OFFSET':
            offsets[last] = [float(toks[i + 1]), float(toks[i + 2]), float(toks[i + 3])]
            i += 4
        elif t == 'CHANNELS':
            n = int(toks[i + 1])
            channels[last] = toks[i + 2:i + 2 + n]
            i += 2 + n
        else:
            i += 1
    i += 1
    assert toks[i] == 'Frames:'
    nf = int(toks[i + 1])
    assert toks[i + 2] == 'Frame' and toks[i + 3] == 'Time:'
    ft = float(toks[i + 4])
    vals = np.array(toks[i + 5:], dtype=np.float64)
    nc = sum(len(c) for c in channels)
    frames = vals[: nf * nc].reshape(nf, nc)
    b = Bvh(names, parents, np.array(offsets, dtype=np.float64), channels, ends, frames, ft)
    b.index = {n: k for k, n in enumerate(names)}
    return b


# ------------------------------------------------------------------------------------------------ target skeleton

class Target:
    """MakeHuman skeleton from src/assets/human/<preset>/rig.json (rest pose exactly as HumanRig builds it)."""

    def __init__(self, rig_path):
        rig = json.load(open(rig_path))
        self.bones = rig['bones']
        self.names = [b['n'] for b in self.bones]
        self.idx = {n: i for i, n in enumerate(self.names)}
        self.parent = [b['p'] for b in self.bones]
        n = len(self.bones)
        self.Q = np.zeros((n, 4))
        self.pos = np.zeros((n, 3))
        self.tail = np.zeros((n, 3))
        for i, b in enumerate(self.bones):
            rl = np.array(b['r'], dtype=np.float64)
            h = np.array(b['h'], dtype=np.float64)
            p = b['p']
            if p >= 0:
                self.Q[i] = qmul(self.Q[p], rl)
                bind = h - np.array(self.bones[p]['h'])
                self.pos[i] = self.pos[p] + qrot(self.Q[p], bind)
            else:
                self.Q[i] = rl
                self.pos[i] = h
            self.tail[i] = self.pos[i] + qrot(self.Q[i], np.array(b['t']) - h)
        self.pelvis = self.pos[self.idx['spine05']].copy()

    def P(self, name):
        return self.pos[self.idx[name]]

    def leg_length(self):
        L = self.P('upperleg01.L')
        K = self.P('lowerleg01.L')
        A = self.P('foot.L')
        return np.linalg.norm(K - L) + np.linalg.norm(A - K)


# exported bones (order = data layout).  toes share one channel ("toes.L" -> every toeN-1.L at runtime)
EXPORT_BONES = [
    'root', 'spine05', 'spine04', 'spine03', 'spine02', 'spine01', 'neck01', 'neck02', 'neck03', 'head',
    'clavicle.L', 'shoulder01.L', 'upperarm01.L', 'upperarm02.L', 'lowerarm01.L', 'lowerarm02.L', 'wrist.L',
    'clavicle.R', 'shoulder01.R', 'upperarm01.R', 'upperarm02.R', 'lowerarm01.R', 'lowerarm02.R', 'wrist.R',
    'upperleg01.L', 'upperleg02.L', 'lowerleg01.L', 'lowerleg02.L', 'foot.L', 'toes.L',
    'upperleg01.R', 'upperleg02.R', 'lowerleg01.R', 'lowerleg02.R', 'foot.R', 'toes.R',
]
# parent of each exported bone in the aligned chain (for locals)
EXPORT_PARENT = {
    'root': None, 'spine05': 'root', 'spine04': 'spine05', 'spine03': 'spine04', 'spine02': 'spine03', 'spine01': 'spine02',
    'neck01': 'spine01', 'neck02': 'neck01', 'neck03': 'neck02', 'head': 'neck03',
}
for _s in 'LR':
    EXPORT_PARENT.update({
        f'clavicle.{_s}': 'spine01', f'shoulder01.{_s}': f'clavicle.{_s}', f'upperarm01.{_s}': f'shoulder01.{_s}',
        f'upperarm02.{_s}': f'upperarm01.{_s}', f'lowerarm01.{_s}': f'upperarm02.{_s}', f'lowerarm02.{_s}': f'lowerarm01.{_s}',
        f'wrist.{_s}': f'lowerarm02.{_s}', f'upperleg01.{_s}': 'root', f'upperleg02.{_s}': f'upperleg01.{_s}',
        f'lowerleg01.{_s}': f'upperleg02.{_s}', f'lowerleg02.{_s}': f'lowerleg01.{_s}', f'foot.{_s}': f'lowerleg02.{_s}',
        f'toes.{_s}': f'foot.{_s}',
    })


# ------------------------------------------------------------------------------------------------ retarget

SIDE = {'L': 'Left', 'R': 'Right'}


@dataclass
class Clip:
    name: str
    fps: float
    C: dict  # logical world deltas per exported bone name [F, 4]
    hips: np.ndarray  # [F, 3] pelvis world position (character space of the clip)
    meta: dict = field(default_factory=dict)
    contacts: np.ndarray | None = None  # [F, 4] heelL ballL heelR ballR
    loop: bool = False
    traj: np.ndarray | None = None  # [F, 3] x, z, yaw


def limb_dirs(tg: Target, s):
    P = tg.P
    return {
        'ua': P(f'lowerarm01.{s}') - P(f'upperarm01.{s}'),
        'fa': P(f'wrist.{s}') - P(f'lowerarm01.{s}'),
        'hd': P(f'finger3-1.{s}') - P(f'wrist.{s}'),
        'th': P(f'lowerleg01.{s}') - P(f'upperleg01.{s}'),
        'sh': P(f'foot.{s}') - P(f'lowerleg01.{s}'),
        'ft': P(f'toe3-1.{s}') - P(f'foot.{s}'),
        'toe': tg.tail[tg.idx[f'toe3-1.{s}']] - P(f'toe3-1.{s}'),
    }


def retarget(bvh: Bvh, tg: Target, start=None, end=None, sigma120=1.6, head_pitch=0.0, spine_pitch=0.0):
    """Retarget BVH frames [start, end) (motion frames at 120 fps, the T-pose frame 0 is the reference) and
    return a Clip at 30 fps with world deltas per exported bone and the pelvis trajectory (metres)."""
    ix = bvh.index
    Gall, Pall = bvh.fk()
    G0, P0 = Gall[0], Pall[0]
    F0 = 1 if start is None else 1 + start
    F1 = len(Gall) if end is None else min(len(Gall), 1 + end)
    G, Pp = Gall[F0:F1], Pall[F0:F1]
    D = qmul(G, qinv(G0)[None])  # world delta from the T-pose per source joint

    def d(name):
        return D[:, ix[name]]

    # scale: leg-length ratio
    src_leg = 0.5 * sum(np.linalg.norm(bvh.offsets[ix[f'{SIDE[s]}Leg']]) + np.linalg.norm(bvh.offsets[ix[f'{SIDE[s]}Foot']]) for s in 'LR')
    scale = tg.leg_length() / src_leg

    def srcdir(a, b):
        return P0[ix[b]] - P0[ix[a]]

    C = {}
    # torso: identity alignment (the rest torso ~ the T-pose torso; T-pose neck/head were compensated by B. Hahne)
    C['root'] = d('Hips')
    C['spine05'] = qslerp(d('Hips'), d('LowerBack'), 0.45)
    C['spine04'] = qslerp(d('Hips'), d('LowerBack'), 0.8)
    C['spine03'] = d('LowerBack')
    C['spine02'] = qslerp(d('LowerBack'), d('Spine'), 0.85)
    C['spine01'] = qslerp(d('Spine'), d('Spine1'), 0.8)
    C['neck01'] = qslerp(d('Spine1'), d('Neck'), 0.7)
    C['neck02'] = qslerp(d('Neck'), d('Neck1'), 0.5)
    C['neck03'] = d('Neck1')
    C['head'] = d('Head')
    if spine_pitch:
        for k, f in (('spine03', 0.3), ('spine02', 0.65), ('spine01', 1.0), ('neck01', 1), ('neck02', 1), ('neck03', 1), ('head', 1)):
            C[k] = qmul(C[k], qaxis([1, 0, 0], spine_pitch * f))
    if head_pitch:
        for k, f in (('neck02', 0.3), ('neck03', 0.6), ('head', 1.0)):
            C[k] = qmul(C[k], qaxis([1, 0, 0], head_pitch * f))

    for s in 'LR':
        S = SIDE[s]
        dirs = limb_dirs(tg, s)
        # ---- arms: hierarchical min-arc alignment of our rest arm to the actor's T-pose arm
        A_ua = qminarc(dirs['ua'], srcdir(f'{S}Arm', f'{S}ForeArm'))
        A_fa = qmul(qminarc(qrot(A_ua, dirs['fa']), srcdir(f'{S}ForeArm', f'{S}Hand')), A_ua)
        A_hd = qmul(qminarc(qrot(A_fa, dirs['hd']), srcdir(f'{S}FingerBase', f'{S}HandIndex1')), A_fa)
        C_ua = qmul(d(f'{S}Arm'), A_ua[None])
        C_fa = qmul(d(f'{S}ForeArm'), A_fa[None])
        C_hd = qmul(d(f'{S}FingerBase'), A_hd[None])
        # clavicle / scapula: CMU does not capture the clavicles -> scapulohumeral rhythm like HumanRig
        sg = 1 if s == 'L' else -1
        chest = C['spine01']
        adir = qrot(qmul(qinv(chest), C_ua), dirs['ua'] / np.linalg.norm(dirs['ua']))
        elev = np.arccos(np.clip(-adir[:, 1], -1, 1))
        lift = 0.34 * np.maximum(0, elev - 0.5)
        protract = 0.18 * np.maximum(0, adir[:, 2]) * np.minimum(1, elev)
        retract = 0.10 * np.maximum(0, -adir[:, 2]) * np.minimum(1, elev)
        clav = qmul(qaxis([0, 0, 1], sg * lift), qaxis([0, 1, 0], -sg * (protract - retract)))
        C[f'clavicle.{s}'] = qmul(chest, clav)
        # the deltoid bone takes 30 % of the arm swing (relative to the clavicle)
        r = qmul(qinv(C[f'clavicle.{s}']), C_ua)
        sw, tw = swing_twist(r, dirs['ua'] / np.linalg.norm(dirs['ua']))
        C[f'shoulder01.{s}'] = qmul(C[f'clavicle.{s}'], qpow(sw, 0.3))
        C[f'arm.{s}'] = C_ua
        C[f'forearm.{s}'] = C_fa
        C[f'hand.{s}'] = C_hd
        # ---- legs
        A_th = qminarc(dirs['th'], srcdir(f'{S}UpLeg', f'{S}Leg'))
        A_sh = qmul(qminarc(qrot(A_th, dirs['sh']), srcdir(f'{S}Leg', f'{S}Foot')), A_th)
        A_ft = qmul(qminarc(qrot(A_sh, dirs['ft']), srcdir(f'{S}Foot', f'{S}ToeBase')), A_sh)
        toe_end = P0[ix[f'{S}ToeBase']] + qrot(G0[ix[f'{S}ToeBase']], bvh.ends[ix[f'{S}ToeBase']])
        A_toe = qmul(qminarc(qrot(A_ft, dirs['toe']), toe_end - P0[ix[f'{S}ToeBase']]), A_ft)
        C[f'thigh.{s}'] = qmul(d(f'{S}UpLeg'), A_th[None])
        C[f'shin.{s}'] = qmul(d(f'{S}Leg'), A_sh[None])
        C[f'foot.{s}'] = qmul(d(f'{S}Foot'), A_ft[None])
        C[f'toes.{s}'] = qmul(d(f'{S}ToeBase'), A_toe[None])

    # pelvis: follow the actor's hip-joint midpoint (scaled), so our leg roots move with the actor's leg roots
    mid_src = 0.5 * (Pp[:, ix['LeftUpLeg']] + Pp[:, ix['RightUpLeg']])
    mid_tg = 0.5 * (tg.P('upperleg01.L') + tg.P('upperleg01.R'))
    hips = mid_src * scale + qrot(C['root'], tg.pelvis - mid_tg)

    # low-pass at 120 fps, then decimate to 30 fps
    step = max(1, int(round((1 / 30) / bvh.frame_time)))
    for k in C:
        C[k] = qsmooth(C[k], sigma120)[::step]
    hips = gaussian_filter1d(hips, sigma120, axis=0, mode='nearest')[::step]
    fps = float(round(1.0 / (bvh.frame_time * step)))
    return Clip('', fps, C, hips, meta={'scale': float(scale), 'srcLeg': float(src_leg)})


# ------------------------------------------------------------------------------------------------ locals + FK

def locals_from(clip: Clip, tg: Target):
    """Local aligned rotations per exported bone [F, B, 4] (twist distribution like HumanRig)."""
    C = clip.C
    F = len(clip.hips)
    out = {}
    for k in ['root', 'spine05', 'spine04', 'spine03', 'spine02', 'spine01', 'neck01', 'neck02', 'neck03', 'head']:
        p = EXPORT_PARENT[k]
        out[k] = C[k] if p is None else qmul(qinv(C[p]), C[k])
    for s in 'LR':
        dirs = limb_dirs(tg, s)
        ua = dirs['ua'] / np.linalg.norm(dirs['ua'])
        fa = dirs['fa'] / np.linalg.norm(dirs['fa'])
        out[f'clavicle.{s}'] = qmul(qinv(C['spine01']), C[f'clavicle.{s}'])
        out[f'shoulder01.{s}'] = qmul(qinv(C[f'clavicle.{s}']), C[f'shoulder01.{s}'])
        r = qmul(qinv(C[f'shoulder01.{s}']), C[f'arm.{s}'])
        sw, tw = swing_twist(r, ua)
        out[f'upperarm01.{s}'] = qmul(sw, twist_frac(tw, ua, 0.5))
        out[f'upperarm02.{s}'] = twist_frac(tw, ua, 0.5)
        rf = qmul(qinv(C[f'arm.{s}']), C[f'forearm.{s}'])
        rh = qmul(qinv(C[f'forearm.{s}']), C[f'hand.{s}'])
        # CMU hands are noisy: keep the wrist inside anatomical range (<= 80 deg) and smooth it a little more
        rh = qcontinuous(rh)
        ang = 2 * np.arccos(np.clip(np.abs(rh[:, 3]), 0, 1))
        lim = np.radians(80)
        k = np.where(ang > lim, lim / np.maximum(ang, 1e-9), 1.0)
        rh = qpow(rh, k)
        rh = qsmooth(rh, 1.0)
        swF, twF = swing_twist(rf, fa)
        swH, twH = swing_twist(rh, fa)
        T = qmul(twF, twH)
        out[f'lowerarm01.{s}'] = qmul(swF, twist_frac(T, fa, 0.35))
        out[f'lowerarm02.{s}'] = twist_frac(T, fa, 0.65)
        out[f'wrist.{s}'] = qmul(qinv(twH), rh)
        th = dirs['th'] / np.linalg.norm(dirs['th'])
        sh = dirs['sh'] / np.linalg.norm(dirs['sh'])
        r = qmul(qinv(C['root']), C[f'thigh.{s}'])
        sw, tw = swing_twist(r, th)
        out[f'upperleg01.{s}'] = qmul(sw, twist_frac(tw, th, 0.5))
        out[f'upperleg02.{s}'] = twist_frac(tw, th, 0.5)
        r = qmul(qinv(C[f'thigh.{s}']), C[f'shin.{s}'])
        sw, tw = swing_twist(r, sh)
        out[f'lowerleg01.{s}'] = qmul(sw, twist_frac(tw, sh, 0.5))
        out[f'lowerleg02.{s}'] = twist_frac(tw, sh, 0.5)
        out[f'foot.{s}'] = qmul(qinv(C[f'shin.{s}']), C[f'foot.{s}'])
        out[f'toes.{s}'] = qmul(qinv(C[f'foot.{s}']), C[f'toes.{s}'])
    L = np.stack([out[b] for b in EXPORT_BONES], axis=1)
    L = despike(L)
    L = np.where(L[..., 3:4] < 0, -L, L)
    return qnorm(L)


def despike(L, thr_deg=40.0):
    """Replace isolated frame-to-frame jumps (> thr per 1/30 s) of any bone by interpolation between the
    neighbouring good frames (CMU marker dropouts / decomposition flips)."""
    F, B = L.shape[0], L.shape[1]
    L = L.copy()
    thr = np.radians(thr_deg)
    for b in range(B):
        q = qcontinuous(L[:, b])
        d = 2 * np.arccos(np.clip(np.abs(np.sum(q[1:] * q[:-1], axis=-1)), 0, 1))
        bad = np.zeros(F, dtype=bool)
        for f in np.nonzero(d > thr)[0]:
            bad[max(0, f - 1):min(F, f + 3)] = True
        if not bad.any() or bad.all():
            continue
        good = np.nonzero(~bad)[0]
        for f in np.nonzero(bad)[0]:
            lo = good[good < f]
            hi = good[good > f]
            if len(lo) and len(hi):
                a, c = lo[-1], hi[0]
                q[f] = qslerp(q[a], q[c], (f - a) / (c - a))
            elif len(lo):
                q[f] = q[lo[-1]]
            else:
                q[f] = q[hi[0]]
        L[:, b] = q
    return L


def fk_points(clip: Clip, tg: Target):
    """World joint positions of the retargeted pose on OUR skeleton (character space), dict name -> [F, 3]."""
    C = clip.C
    P = tg.P
    out = {'pelvis': clip.hips}
    hips = clip.hips

    def at(parent_pos, parent_rest, Cq, rest):
        return parent_pos + qrot(Cq, rest - parent_rest)

    out['chest'] = at(hips, tg.pelvis, C['spine03'], P('spine02'))
    out['neck'] = at(out['chest'], P('spine02'), C['spine02'], P('spine01'))
    out['neck'] = at(out['neck'], P('spine01'), C['spine01'], P('neck01'))
    out['headj'] = at(out['neck'], P('neck01'), C['neck02'], P('head'))
    out['headtop'] = at(out['headj'], P('head'), C['head'], tg.tail[tg.idx['head']])
    for s in 'LR':
        sh = at(out['neck'], P('neck01'), C['spine01'], P(f'clavicle.{s}'))
        sh = at(sh, P(f'clavicle.{s}'), C[f'clavicle.{s}'], P(f'shoulder01.{s}'))
        sh = at(sh, P(f'shoulder01.{s}'), C[f'shoulder01.{s}'], P(f'upperarm01.{s}'))
        el = at(sh, P(f'upperarm01.{s}'), C[f'arm.{s}'], P(f'lowerarm01.{s}'))
        wr = at(el, P(f'lowerarm01.{s}'), C[f'forearm.{s}'], P(f'wrist.{s}'))
        fi = at(wr, P(f'wrist.{s}'), C[f'hand.{s}'], P(f'finger3-1.{s}'))
        hp = at(hips, tg.pelvis, C['root'], P(f'upperleg01.{s}'))
        kn = at(hp, P(f'upperleg01.{s}'), C[f'thigh.{s}'], P(f'lowerleg01.{s}'))
        an = at(kn, P(f'lowerleg01.{s}'), C[f'shin.{s}'], P(f'foot.{s}'))
        ball = at(an, P(f'foot.{s}'), C[f'foot.{s}'], P(f'toe3-1.{s}'))
        tip = at(ball, P(f'toe3-1.{s}'), C[f'toes.{s}'], tg.tail[tg.idx[f'toe3-1.{s}']])
        heel_rest = P(f'foot.{s}') * np.array([1, 0, 1]) + np.array([0, 0, -0.045])
        heel = at(an, P(f'foot.{s}'), C[f'foot.{s}'], heel_rest)
        ball_sole = at(an, P(f'foot.{s}'), C[f'foot.{s}'], P(f'toe3-1.{s}') * np.array([1, 0, 1]))
        out.update({f'sh{s}': sh, f'el{s}': el, f'wr{s}': wr, f'fi{s}': fi, f'hip{s}': hp, f'kn{s}': kn, f'an{s}': an,
                    f'ball{s}': ball, f'tip{s}': tip, f'heel{s}': heel, f'bsole{s}': ball_sole})
    return out


# ------------------------------------------------------------------------------------------------ cleanup

def normalize_start(clip: Clip):
    """Move/rotate the clip so its (smoothed) trajectory starts at the origin facing +Z."""
    yaw0 = float(np.median(np.unwrap(yaw_of(clip.C['root'][: max(3, int(clip.fps * 0.2))]))))
    p0 = clip.hips[0].copy()
    R = qaxis([0, 1, 0], -yaw0)
    for k in clip.C:
        clip.C[k] = qmul(R[None], clip.C[k])
    h = clip.hips - np.array([p0[0], 0, p0[2]])
    clip.hips = qrot(R[None], h)


def ground(clip: Clip, tg: Target):
    """Shift the clip vertically so planted soles touch y = 0."""
    pts = fk_points(clip, tg)
    soles = np.stack([pts['heelL'][:, 1], pts['bsoleL'][:, 1], pts['heelR'][:, 1], pts['bsoleR'][:, 1]], axis=1)
    lowest = soles.min(axis=1)
    off = np.percentile(lowest, 10)
    clip.hips[:, 1] -= off
    return off


def detect_contacts(clip: Clip, tg: Target, h_thr=0.035, v_thr=0.35):
    pts = fk_points(clip, tg)
    F = len(clip.hips)
    out = np.zeros((F, 4), dtype=bool)
    for k, name in enumerate(['heelL', 'bsoleL', 'heelR', 'bsoleR']):
        p = pts[name]
        v = np.zeros(F)
        v[1:-1] = np.linalg.norm((p[2:, [0, 2]] - p[:-2, [0, 2]]), axis=1) * clip.fps / 2
        v[0], v[-1] = v[1], v[-2]
        c = (p[:, 1] < h_thr) & (v < v_thr)
        # remove 1-frame blips / fill 1-frame gaps
        c2 = c.copy()
        for i in range(1, F - 1):
            if c[i - 1] and c[i + 1]:
                c2[i] = True
            if not c[i - 1] and not c[i + 1]:
                c2[i] = False
        out[:, k] = c2
    return out


def two_bone_ik(hip, knee, ankle, target, pole_hint):
    """Returns new knee position for a 2-bone chain reaching target (keeps segment lengths)."""
    a = np.linalg.norm(knee - hip)
    b = np.linalg.norm(ankle - knee)
    d = target - hip
    L = np.linalg.norm(d)
    L = min(max(L, abs(a - b) + 1e-4), a + b - 1e-4)
    dn = d / max(np.linalg.norm(d), 1e-9)
    # knee lies in the plane (hip, target, pole)
    pole = pole_hint - hip
    pole = pole - np.dot(pole, dn) * dn
    if np.linalg.norm(pole) < 1e-6:
        pole = np.array([0, 0, 1.0]) - np.dot([0, 0, 1.0], dn) * dn
    pole /= np.linalg.norm(pole)
    x = (a * a - b * b + L * L) / (2 * L)
    y = math.sqrt(max(a * a - x * x, 0))
    return hip + dn * x + pole * y, hip + dn * L


def foot_lock(clip: Clip, tg: Target, contacts, blend=3):
    """Pin planted sole points (heel while the heel is down, then the ball during roll-off) in world space and
    re-solve each leg with 2-bone IK (thigh + shin world deltas; the foot keeps its world orientation).  The pelvis
    is lowered (smoothly) where a leg would otherwise over-extend."""
    F = len(clip.hips)
    pts = fk_points(clip, tg)
    P = tg.P
    targets = {}
    for s, (hk, bk) in (('L', (0, 1)), ('R', (2, 3))):
        heel, ball = pts[f'heel{s}'], pts[f'bsole{s}']
        anyc = contacts[:, hk] | contacts[:, bk]
        off = np.zeros((F, 3))
        w = np.zeros(F)
        i = 0
        while i < F:
            if not anyc[i]:
                i += 1
                continue
            j = i
            while j < F and anyc[j]:
                j += 1
            state = 'heel' if contacts[i, hk] else 'ball'
            anchor = (heel[i] if state == 'heel' else ball[i]).copy()
            anchor[1] = 0.0
            hmin = heel[i][1]
            for f in range(i, j):
                hmin = min(hmin, heel[f][1])
                if state == 'heel' and (not contacts[f, hk] or (contacts[f, bk] and heel[f][1] - hmin > 0.012)):
                    # roll-off: keep the ball where the pinned foot left it (continuous offset, no pop)
                    state = 'ball'
                    anchor = ball[f - 1] + off[f - 1] if f > i else ball[f].copy()
                    anchor[1] = 0.0
                pt = heel[f] if state == 'heel' else ball[f]
                off[f] = anchor - pt
                if state == 'ball' and not contacts[f, bk]:
                    off[f][1] = 0.0
                w[f] = 1
            i = j
        wb = w.copy()
        src = np.full(F, -1)
        for f in range(F):
            if w[f] > 0:
                continue
            best = None
            for g in range(max(0, f - blend), min(F, f + blend + 1)):
                if w[g] > 0 and (best is None or abs(g - f) < abs(best - f)):
                    best = g
            if best is not None:
                wb[f] = 0.5 * (1 + math.cos(math.pi * abs(best - f) / (blend + 1)))
                src[f] = best
        for f in range(F):
            if src[f] >= 0:
                off[f] = off[src[f]]
        off = gaussian_filter1d(off, 0.7, axis=0, mode='nearest') * wb[:, None]
        targets[s] = (pts[f'an{s}'] + off, np.linalg.norm(off, axis=1) > 1e-5)
    # pelvis drop where a leg cannot reach its target
    reach = tg.leg_length() * 0.997
    drop = np.zeros(F)
    for s in 'LR':
        tgt, act = targets[s]
        hip = pts[f'hip{s}']
        for f in np.nonzero(act)[0]:
            dxz = tgt[f] - hip[f]
            h2 = reach * reach - dxz[0] ** 2 - dxz[2] ** 2
            need = hip[f][1] - (tgt[f][1] + math.sqrt(max(h2, 0.0)))
            drop[f] = max(drop[f], need)
    if drop.max() > 0:
        from scipy.ndimage import maximum_filter1d
        drop = gaussian_filter1d(maximum_filter1d(drop, 5), 1.5)
        clip.hips[:, 1] -= drop
        pts = fk_points(clip, tg)
    clip.meta['pelvisDropMax'] = float(drop.max())
    for s in 'LR':
        tgt, act = targets[s]
        hip, knee, ank = pts[f'hip{s}'], pts[f'kn{s}'], pts[f'an{s}']
        d_th = P(f'lowerleg01.{s}') - P(f'upperleg01.{s}')
        d_sh = P(f'foot.{s}') - P(f'lowerleg01.{s}')
        newth = clip.C[f'thigh.{s}'].copy()
        newsh = clip.C[f'shin.{s}'].copy()
        for f in range(F):
            if np.linalg.norm(tgt[f] - ank[f]) < 1e-5:
                continue
            kn2, an2 = two_bone_ik(hip[f], knee[f], ank[f], tgt[f], knee[f] + qrot(clip.C[f'shin.{s}'][f], np.array([0, 0, 0.3])))
            cur_th = qrot(clip.C[f'thigh.{s}'][f], d_th)
            r1 = qminarc(cur_th, kn2 - hip[f])
            newth[f] = qmul(r1, clip.C[f'thigh.{s}'][f])
            cur_sh = qrot(qmul(r1, clip.C[f'shin.{s}'][f]), d_sh)
            r2 = qminarc(cur_sh, an2 - kn2)
            newsh[f] = qmul(r2, qmul(r1, clip.C[f'shin.{s}'][f]))
        clip.C[f'thigh.{s}'] = qnorm(newth)
        clip.C[f'shin.{s}'] = qnorm(newsh)
    return pts


def smooth_traj(clip: Clip, sigma_s=0.35, linear=False):
    F = len(clip.hips)
    yaw = np.unwrap(yaw_of(clip.C['root']))
    xz = clip.hips[:, [0, 2]]
    if linear:
        t = np.linspace(0, 1, F)[:, None]
        xz_s = xz[0] + (xz[-1] - xz[0]) * t
        yaw_s = yaw[0] + (yaw[-1] - yaw[0]) * t[:, 0]
    else:
        sig = max(1.0, sigma_s * clip.fps)
        xz_s = gaussian_filter1d(xz, sig, axis=0, mode='nearest')
        yaw_s = gaussian_filter1d(yaw, sig, mode='nearest')
    clip.traj = np.concatenate([xz_s, yaw_s[:, None]], axis=1)


def find_loop(clip: Clip, tg: Target, min_len_s, max_len_s, search_start_s=0.0, stationary=False):
    """Best (a, b) so that frame b ~ frame a (pose + pelvis velocity + relative pelvis height); b exclusive."""
    L = locals_from(clip, tg)
    F = L.shape[0]
    rel = clip.hips.copy()
    vel = np.gradient(clip.hips, axis=0) * clip.fps
    # compare body-relative quantities: locals (except root yaw) + pelvis height + root pitch/roll + speed
    feat = [L[:, 1:, :].reshape(F, -1) * 1.0]
    yaw = np.unwrap(yaw_of(clip.C['root']))
    Ry = qaxis(np.array([0, 1, 0]), -yaw)
    rootrel = qmul(Ry, clip.C['root'])
    rootrel = np.where(rootrel[:, 3:4] < 0, -rootrel, rootrel)
    feat.append(rootrel * 2)
    feat.append(rel[:, 1:2] * 8)
    vloc = qrot(Ry, vel)
    feat.append(vloc * 0.6)
    X = np.concatenate(feat, axis=1)
    best = (1e9, 0, F - 1)
    a0 = int(search_start_s * clip.fps)
    mn, mx = int(min_len_s * clip.fps), int(max_len_s * clip.fps)
    for a in range(a0, F - mn):
        for b in range(a + mn, min(F, a + mx + 1)):
            dd = np.sum((X[a] - X[b]) ** 2) + 0.5 * np.sum((X[a + 1] - X[b + 1 if b + 1 < F else b]) ** 2)
            if stationary:
                # idles: the loop must also close in heading and position
                dd += 6.0 * (yaw[b] - yaw[a]) ** 2 + 40.0 * float(np.sum((clip.hips[b, [0, 2]] - clip.hips[a, [0, 2]]) ** 2))
            if dd < best[0]:
                best = (dd, a, b)
    return best


def make_loop(clip: Clip, tg: Target, a, b, K=None):
    """Cut [a, b) and cross-fade the last K frames into the frames preceding a, so b-1 -> a is seamless.
    The pelvis is blended relative to the (linear) trajectory."""
    K = K or max(3, min(a, int(0.25 * clip.fps)))
    K = min(K, a)
    F = b - a
    yaw = np.unwrap(yaw_of(clip.C['root']))
    # relative frames: express everything relative to the heading/position of the frame
    def rel_state(f):
        R = qaxis(np.array([0, 1, 0]), -yaw[f])
        return R
    newC = {k: v[a:b].copy() for k, v in clip.C.items()}
    newH = clip.hips[a:b].copy()
    if K > 0:
        # displacement/heading per cycle
        dyaw = yaw[b] - yaw[a]
        Rc = qaxis(np.array([0, 1, 0]), dyaw)
        for i in range(K):
            f_tail = b - K + i  # frames at the end of the loop
            f_pre = a - K + i  # frames that flow into a
            w = 0.5 * (1 - math.cos(math.pi * (i + 1) / (K + 1)))
            # the pre-frames moved into the next cycle's frame: rotate by one cycle heading, translate by the cycle
            for k in newC:
                pre = qmul(Rc, clip.C[k][f_pre])
                newC[k][f_tail - a] = qslerp(clip.C[k][f_tail], pre, w)
            pre_h = qrot(Rc, clip.hips[f_pre] - clip.hips[a] * np.array([1, 0, 1])) + clip.hips[b] * np.array([1, 0, 1])
            newH[f_tail - a] = clip.hips[f_tail] * (1 - w) + pre_h * w
    clip.C = newC
    clip.hips = newH
    clip.loop = True
    # the frame after the last one is frame a of the next cycle
    clip.meta['cycleYaw'] = float(yaw[b] - yaw[a])
    clip.meta['cycleStart'] = clip.hips[0].copy()
    return clip


def straighten_loop(clip: Clip):
    """Remove the per-cycle heading drift of a locomotion loop (spread linearly over the cycle), so the cycle
    repeats in a straight line; frame F (next cycle) still equals frame 0."""
    dy = clip.meta.get('cycleYaw', 0.0)
    F = len(clip.hips)
    if abs(dy) < 1e-6:
        return
    ang = -dy * np.arange(F) / F
    R = qaxis(np.array([0, 1, 0]), ang)
    for k in clip.C:
        clip.C[k] = qmul(R, clip.C[k])
    c0 = clip.hips[0] * np.array([1, 0, 1])
    clip.hips = qrot(R, clip.hips - c0) + c0
    clip.meta['cycleYaw'] = 0.0


def cut(clip: Clip, a, b):
    clip.C = {k: v[a:b].copy() for k, v in clip.C.items()}
    clip.hips = clip.hips[a:b].copy()
    if clip.contacts is not None:
        clip.contacts = clip.contacts[a:b]


# ------------------------------------------------------------------------------------------------ export

def quant(q):
    return np.clip(np.round(q[..., :3] * 32767), -32767, 32767).astype(np.int16)


def export_clip(clip: Clip, tg: Target, out_path, extra_meta):
    """Binary layout (little endian), gzip'ed as .binz:
       'MCP1' u32 jsonLen, json (utf8, padded to 4), then per-frame blocks, delta-coded along time per channel:
         rot   int16 [F, B, 3]   quaternion xyz * 32767 (w >= 0 reconstructed)
         hips  int16 [F, 3]      pelvis relative to the trajectory frame, 0.1 mm units
         traj  float32 [F, 3]    x, z (m), yaw (rad) of the root-motion trajectory (starts at 0,0,0)
         contact uint8 [F]       bits: heelL 1, ballL 2, heelR 4, ballR 8
    """
    L = locals_from(clip, tg)
    F, B = L.shape[0], L.shape[1]
    # root: express relative to the trajectory yaw (in-place pose); traj carries the heading
    yawT = clip.traj[:, 2]
    RyInv = qaxis(np.array([0, 1, 0]), -yawT)
    L[:, 0] = qmul(RyInv, L[:, 0])
    L = np.where(L[..., 3:4] < 0, -L, L)
    rel = clip.hips - np.stack([clip.traj[:, 0], np.zeros(F), clip.traj[:, 1]], axis=1)
    rel = qrot(RyInv, rel)
    rot = quant(L)
    hips = np.clip(np.round(rel * 10000), -32767, 32767).astype(np.int16)
    c = clip.contacts if clip.contacts is not None else np.zeros((F, 4), dtype=bool)
    cb = (c[:, 0] * 1 + c[:, 1] * 2 + c[:, 2] * 4 + c[:, 3] * 8).astype(np.uint8)

    def delta(a):
        a = a.astype(np.int32)
        d = np.diff(a, axis=0, prepend=np.zeros_like(a[:1]))
        return ((d + 32768) % 65536 - 32768).astype(np.int16)

    meta = {
        'v': 1, 'name': clip.name, 'fps': clip.fps, 'frames': F, 'loop': clip.loop, 'bones': EXPORT_BONES,
        'legLength': float(tg.leg_length()),
    }
    meta.update(extra_meta)
    js = json.dumps(meta, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    body = b'MCP1' + struct.pack('<I', len(js)) + js
    body += delta(rot.reshape(F, -1)).tobytes()
    body += delta(hips).tobytes()
    body += clip.traj.astype(np.float32).tobytes()
    body += cb.tobytes()
    raw = gzip.compress(body, 9, mtime=0)
    open(out_path, 'wb').write(raw)
    return len(raw), len(body)
