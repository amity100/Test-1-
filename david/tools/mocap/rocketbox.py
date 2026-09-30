"""
Microsoft Rocketbox animation library (MIT licence, (c) 2020 Microsoft,
https://github.com/microsoft/Microsoft-Rocketbox) as a motion source for the DAVID retarget pipeline.

Clip specs in clips.py name a Rocketbox take as src='rb:<file stem>' (e.g. 'rb:m_cheer_01'). `load(stem)` returns an
object with the interface `mocap_lib.retarget` expects from a BVH take (names / index / offsets / ends / frames /
frame_time / fk()), so the whole CMU pipeline (direction-exact retarget, grounding, contacts, foot lock, loops,
export) runs unchanged on it:

  * the FBX (3ds Max biped "Bip01" skeleton, 30 fps) is fetched by exact path from raw.githubusercontent.com into the
    cache and converted by tools/mocap/rocketbox_export.mjs (three's FBXLoader in Node) into world joint tracks;
  * frame 0 is the reference pose (the bind pose of the avatar Male_Adult_01) — every joint's rotation is measured
    as a delta from it, like the T-pose frame of the CMU takes;
  * joint names are mapped onto the CMU names the retarget reads (Hips, LowerBack, Spine, Spine1, Neck, Neck1, Head,
    <Side>Arm/ForeArm/Hand/FingerBase/HandIndex1, <Side>UpLeg/Leg/Foot/ToeBase + the toe end site);
    Neck1 (absent in the biped) is synthesised half-way between Neck and Head.
Only the retargeted, filtered and quantised clips are shipped (src/assets/mocap/*.binz); the FBX never are.
"""
from __future__ import annotations

import base64
import json
import os
import subprocess

import numpy as np

from mocap_lib import qinv, qmul, qrot, qslerp

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
CACHE = os.environ.get('RB_CACHE', '/tmp/claude-0/-home-user-Test-1-/aa9d8085-4598-5292-aa4e-bfc8e4c43335/scratchpad/mocap-cache/rocketbox')
BASE = 'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/'
AVATAR = 'Assets/Avatars/Adults/Male_Adult_01/Export/Male_Adult_01.fbx'
# the library keeps each take in one of three motion-extraction folders
FOLDERS = ('all_animations_max_motextr_static', 'all_animations_max_motextr_xy', 'all_animations_max_motextr_xyz')


def _curl(url, out):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    r = subprocess.run(['curl', '-sSf', '--retry', '3', '-o', out + '.part', url])
    if r.returncode == 0:
        os.replace(out + '.part', out)
        return True
    if os.path.exists(out + '.part'):
        os.remove(out + '.part')
    return False


def fetch_fbx(stem):
    p = os.path.join(CACHE, 'fbx', stem + '.fbx')
    if os.path.exists(p):
        return p
    for f in FOLDERS:
        if _curl(f'{BASE}Assets/Animations/{f}/{stem}.max.fbx', p):
            return p
    raise FileNotFoundError(f'Rocketbox take not found: {stem}')


def export_json(stem):
    j = os.path.join(CACHE, 'json', stem + '.json')
    if os.path.exists(j):
        return j
    fbx = fetch_fbx(stem)
    av = os.path.join(CACHE, 'Male_Adult_01.fbx')
    if not os.path.exists(av):
        _curl(BASE + AVATAR, av)
    subprocess.check_call(['node', os.path.join(HERE, 'rocketbox_export.mjs'), av, os.path.join(CACHE, 'json'), fbx])
    return j


class RocketboxTake:
    """A Rocketbox take with the attribute interface of mocap_lib.Bvh (frame 0 = reference pose)."""

    def __init__(self, stem):
        d = json.load(open(export_json(stem)))
        F = d['frames']
        raw = np.frombuffer(base64.b64decode(d['data']), dtype=np.float32).astype(np.float64)
        raw = raw.reshape(F, len(d['joints']), d['stride'])
        src = {n: k for k, n in enumerate(d['joints'])}
        Q = raw[..., :4]
        P = raw[..., 4:7]

        def jq(n):
            return Q[:, src[n]]

        def jp(n):
            return P[:, src[n]]

        G, Pw, names = [], [], []

        def add(name, q, p):
            names.append(name)
            G.append(q)
            Pw.append(p)

        add('Root', jq('Root'), jp('Root'))
        add('Hips', jq('Hips'), jp('Hips'))
        add('LowerBack', jq('LowerBack'), jp('LowerBack'))
        add('Spine', jq('Spine'), jp('Spine'))
        add('Spine1', jq('Spine1'), jp('Spine1'))
        add('Neck', jq('Neck'), jp('Neck'))
        add('Neck1', qslerp(jq('Neck'), jq('Head'), 0.5), 0.5 * (jp('Neck') + jp('Head')))
        add('Head', jq('Head'), jp('Head'))
        for S in ('Left', 'Right'):
            add(f'{S}Shoulder', jq(f'{S}Shoulder'), jp(f'{S}Shoulder'))
            add(f'{S}Arm', jq(f'{S}Arm'), jp(f'{S}Arm'))
            add(f'{S}ForeArm', jq(f'{S}ForeArm'), jp(f'{S}ForeArm'))
            add(f'{S}Hand', jq(f'{S}Hand'), jp(f'{S}Hand'))
            # the hand's direction: wrist -> the knuckle of the middle finger (CMU: FingerBase -> HandIndex1)
            add(f'{S}FingerBase', jq(f'{S}Hand'), jp(f'{S}Hand'))
            add(f'{S}HandIndex1', jq(f'{S}HandMiddle'), jp(f'{S}HandMiddle'))
            add(f'{S}UpLeg', jq(f'{S}UpLeg'), jp(f'{S}UpLeg'))
            add(f'{S}Leg', jq(f'{S}Leg'), jp(f'{S}Leg'))
            add(f'{S}Foot', jq(f'{S}Foot'), jp(f'{S}Foot'))
            add(f'{S}ToeBase', jq(f'{S}ToeBase'), jp(f'{S}ToeBase'))
        self.names = names
        self.index = {n: k for k, n in enumerate(names)}
        self._G = np.stack(G, axis=1)
        self._P = np.stack(Pw, axis=1)
        self.frame_time = 1.0 / d['fps']
        self.frames = np.zeros((F, 1))  # only the shape is read (frame count incl. the reference frame)
        # bone offsets (reference pose, world) for the leg-length ratio: |Leg - UpLeg|, |Foot - Leg|
        P0 = self._P[0]
        self.offsets = np.zeros((len(names), 3))
        for S in ('Left', 'Right'):
            self.offsets[self.index[f'{S}Leg']] = P0[self.index[f'{S}Leg']] - P0[self.index[f'{S}UpLeg']]
            self.offsets[self.index[f'{S}Foot']] = P0[self.index[f'{S}Foot']] - P0[self.index[f'{S}Leg']]
        # toe end sites in the toe's local frame (reference pose)
        self.ends = {}
        for S in ('Left', 'Right'):
            k = self.index[f'{S}ToeBase']
            end = raw[0, src[f'{S}ToeEnd'], 4:7] - P0[k]
            self.ends[k] = qrot(qinv(self._G[0, k]), end)
        self.parents = [-1] * len(names)
        self.units = d.get('units', 'cm')

    def fk(self, frames=None):
        if frames is None:
            return self._G, self._P
        return self._G[frames], self._P[frames]


_cache: dict = {}


def load(stem) -> RocketboxTake:
    if stem not in _cache:
        _cache[stem] = RocketboxTake(stem)
    return _cache[stem]


def _selftest():
    t = load('m_walk_cool_01')
    G, P = t.fk()
    print(t.names)
    print('frames', G.shape, 'fps', 1 / t.frame_time)
    print('hips y ref', P[0, t.index['Hips']], 'frame1', P[1, t.index['Hips']])
    print('delta check', qmul(G[1], qinv(G[0]))[t.index['Head']])


if __name__ == '__main__':
    _selftest()
