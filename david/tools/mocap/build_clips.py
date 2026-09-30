#!/usr/bin/env python3
"""
Build the DAVID mocap clip library: CMU BVH takes -> retarget onto the MakeHuman skeleton -> clean -> .binz

  python3 tools/mocap/build_clips.py              # every clip in CLIPS (downloads missing takes)
  python3 tools/mocap/build_clips.py walk idle_*  # a subset (fnmatch patterns)
  python3 tools/mocap/build_clips.py --list

Sources: the Microsoft Rocketbox animation library (MIT, src='rb:<stem>', tools/mocap/rocketbox.py) and the
CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu, "free for use in research and commercial
projects"), BVH conversion by Bruce Hahne (cgspeed), mirrored at github.com/una-dinosauria/cmu-mocap.
Takes are cached in $MOCAP_CACHE (default: the scratchpad cache) and never shipped raw: only retargeted,
filtered, quantized clips are written to src/assets/mocap/.
"""
from __future__ import annotations

import fnmatch
import json
import math
import os
import subprocess
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from mocap_lib import (Target, detect_contacts, export_clip, find_loop, foot_lock, ground, load_bvh,  # noqa: E402
                       make_loop, normalize_start, qaxis, qmul, qrot, retarget, smooth_traj, straighten_loop)
from clips import CLIPS  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'src', 'assets', 'mocap')
CACHE = os.environ.get('MOCAP_CACHE', '/tmp/claude-0/-home-user-Test-1-/aa9d8085-4598-5292-aa4e-bfc8e4c43335/scratchpad/mocap-cache/bvh')
URL = 'https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/{s:03d}/{t}.bvh'

_bvh_cache: dict = {}


def take(t):
    if t in _bvh_cache:
        return _bvh_cache[t]
    if t.startswith('rb:'):
        # Microsoft Rocketbox (MIT): 'rb:<file stem>' (tools/mocap/rocketbox.py)
        import rocketbox
        b = rocketbox.load(t[3:])
        _bvh_cache[t] = b
        return b
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, t + '.bvh')
    if not os.path.exists(p):
        s = int(t.split('_')[0])
        subprocess.check_call(['curl', '-sS', '--retry', '3', '-o', p + '.part', URL.format(s=s, t=t)])
        os.replace(p + '.part', p)
    b = load_bvh(p)
    _bvh_cache[t] = b
    return b


def rezero(clip):
    """Make the trajectory start exactly at (0, 0, yaw 0)."""
    x0, z0, y0 = clip.traj[0]
    R = qaxis(np.array([0, 1, 0]), -y0)
    for k in clip.C:
        clip.C[k] = qmul(R[None], clip.C[k])
    clip.hips = qrot(R[None], clip.hips - np.array([x0, 0, z0]))
    xz = np.stack([clip.traj[:, 0] - x0, np.zeros(len(clip.traj)), clip.traj[:, 1] - z0], axis=1)
    xz = qrot(R[None], xz)
    clip.traj = np.stack([xz[:, 0], xz[:, 2], clip.traj[:, 2] - y0], axis=1)


def build(spec, tg, verbose=True):
    t0 = time.time()
    b = take(spec['src'])
    fps_src = 1.0 / b.frame_time
    nmot = b.frames.shape[0] - 1
    s = int(spec.get('start', 0) * fps_src)
    e = int(spec['end'] * fps_src) if spec.get('end') else nmot
    e = min(e, nmot)
    # low-pass (in source frames): CMU 120 fps sigma 1.6; Rocketbox (30 fps, already clean) 0.6
    sigma = spec.get('sigma', 1.6 if fps_src > 60 else 0.6)
    clip = retarget(b, tg, s, e, sigma120=sigma, head_pitch=spec.get('headPitch', 0.0), spine_pitch=spec.get('spinePitch', 0.0))
    clip.name = spec['name']
    normalize_start(clip)
    ground(clip, tg)
    loop = spec.get('loop')
    con = detect_contacts(clip, tg, v_thr=spec.get('contactSpeed', 0.35))
    if spec.get('lock', True):
        foot_lock(clip, tg, con)
    info = {}
    if loop:
        lo, hi = loop
        stationary = 'idle' in spec.get('tags', [])
        if spec.get('loopWhole'):
            # a take that IS one cycle whose last frame repeats the first (Rocketbox walks): loop [0, F-1)
            a, bb, cost = 0, len(clip.hips) - 1, 0.0
        else:
            cost, a, bb = find_loop(clip, tg, lo, hi, search_start_s=spec.get('loopSearch', 0.3), stationary=stationary)
        make_loop(clip, tg, a, bb)
        if spec.get('straight', 'loco' in spec.get('tags', []) or stationary):
            straighten_loop(clip)
        info['loopCost'] = round(float(cost), 3)
        info['loopRange'] = [a, bb]
        smooth_traj(clip, linear=True)
    else:
        smooth_traj(clip, sigma_s=spec.get('trajSigma', 0.35))
    rezero(clip)
    clip.contacts = detect_contacts(clip, tg, v_thr=spec.get('contactSpeed', 0.35) + 0.1)
    F = len(clip.hips)
    dur = F / clip.fps
    if loop:
        # distance per cycle: the next cycle starts where frame F would be (linear trajectory extrapolated)
        step = (clip.traj[-1] - clip.traj[0]) * F / max(F - 1, 1)
    else:
        step = clip.traj[-1] - clip.traj[0]
    dist = float(math.hypot(step[0], step[1]))
    meta = {
        'src': spec['src'], 'desc': spec.get('desc', ''), 'tags': spec.get('tags', []), 'duration': round(dur, 4),
        'distance': round(dist, 4), 'speed': round(dist / dur, 4), 'turn': round(float(step[2]), 4),
        'cycle': [round(float(step[0]), 4), round(float(step[1]), 4), round(float(step[2]), 5)] if loop else None,
        'range': [round(s / fps_src, 3), round(e / fps_src, 3)],
    }
    meta.update(info)
    os.makedirs(OUT, exist_ok=True)
    nbytes, raw = export_clip(clip, tg, os.path.join(OUT, spec['name'] + '.binz'), meta)
    meta.update({'file': spec['name'] + '.binz', 'bytes': nbytes, 'frames': F, 'loop': bool(loop), 'fps': clip.fps,
                 'pelvisDropMax': round(clip.meta.get('pelvisDropMax', 0.0), 4)})
    if verbose:
        print(f"{spec['name']:<24} {spec['src']:<7} {dur:6.2f}s {F:4d}f loop={bool(loop)!s:<5} v={meta['speed']:.2f}m/s "
              f"turn={math.degrees(meta['turn']):6.1f} {nbytes/1024:6.1f}KB drop={meta['pelvisDropMax']:.3f} "
              f"{info.get('loopCost', '')} ({time.time()-t0:.1f}s)")
    return meta


def main(argv):
    if '--list' in argv:
        for c in CLIPS:
            print(f"{c['name']:<24} {c['src']:<7} {c.get('desc', '')}")
        return
    pats = [a for a in argv if not a.startswith('-')]
    tg = Target(os.path.join(ROOT, 'src', 'assets', 'human', 'david', 'rig.json'))
    idx_path = os.path.join(OUT, 'index.json')
    index = json.load(open(idx_path)) if os.path.exists(idx_path) else {}
    names = {c['name'] for c in CLIPS}
    index = {k: v for k, v in index.items() if k in names}
    for spec in CLIPS:
        if pats and not any(fnmatch.fnmatch(spec['name'], p) for p in pats):
            continue
        m = build(spec, tg)
        index[spec['name']] = {k: m[k] for k in ('file', 'src', 'desc', 'tags', 'duration', 'frames', 'fps', 'loop',
                                                   'speed', 'distance', 'turn', 'cycle', 'bytes', 'range')}
    order = [c['name'] for c in CLIPS if c['name'] in index]
    index = {k: index[k] for k in order}
    json.dump(index, open(idx_path, 'w'), indent=1)
    # remove stale clip files
    for f in os.listdir(OUT):
        if f.endswith('.binz') and f[:-5] not in index:
            os.remove(os.path.join(OUT, f))
    total = sum(v['bytes'] for v in index.values())
    print(f'{len(index)} clips, {total/1024:.0f} KB total -> {OUT}')


if __name__ == '__main__':
    main(sys.argv[1:])
