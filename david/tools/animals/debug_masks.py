"""
Debug renders of the per-vertex fields (mouth / nose / eye / pad masks, fur length, skin weights).

    python3 tools/animals/debug_masks.py <out_dir>
"""
from __future__ import annotations

import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bear_design as B  # noqa: E402
import bear_paint as BP  # noqa: E402
import build_bear as BB  # noqa: E402
from preview import render  # noqa: E402
from PIL import Image  # noqa: E402


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    d = np.load(os.path.join(BB.CACHE, 'bear_lod0.npz'))
    V, F, N = d['V'], d['F'], d['N']
    prims = B.sculpt()
    W = BB.skin_weights(prims, V, F)
    nose = BP.nose_mask(V)
    interior, lip = BP.mouth_fields(V, N, W)
    eye = BP.eye_mask(V)
    pad = BP.pad_mask(V, N, W)
    FL = BP.fur_length(V, N, W)
    hc = B.SOCKETS['headCenter'][1]
    C = np.stack([interior, lip * (1 - interior), nose], axis=1) * 0.9 + 0.05
    C = np.maximum(C, eye[:, None] * np.array([1.0, 1.0, 1.0]))
    tiles = []
    for eye_off, fov in (((0.45, 0.05, 0.55), 30), ((0.6, -0.12, 0.2), 28), ((0.0, 0.02, 0.7), 28), ((0.3, -0.45, 0.35), 30)):
        tiles.append(render(V, F, hc + np.array(eye_off), hc + np.array([0, -0.03, 0.12]), fov=fov, size=(480, 360), colors=C))
    # fur length heat map
    fl = FL / 0.12
    Cf = np.stack([fl, fl * 0.6, 1 - fl], axis=1)
    c = np.array([0, 0.55, 0.05])
    tiles.append(render(V, F, c + np.array([3.6, 0.5, 1.2]), c, fov=30, size=(480, 360), colors=Cf))
    tiles.append(render(V, F, c + np.array([-2.0, -0.6, -3.0]), c, fov=30, size=(480, 360), colors=Cf))
    # pads
    Cp = np.stack([pad, pad * 0.3, 1 - pad], axis=1)
    tiles.append(render(V, F, np.array([1.2, -0.25, 1.2]), np.array([0, 0.05, 0.0]), fov=40, size=(480, 360), colors=Cp))
    # dominant bone colours
    rng = np.random.default_rng(3)
    pal = rng.random((len(B.BONES), 3)) * 0.8 + 0.2
    Cb = W @ pal
    tiles.append(render(V, F, c + np.array([3.4, 0.9, 1.8]), c, fov=32, size=(480, 360), colors=Cb))
    tiles.append(render(V, F, hc + np.array([0.5, 0.1, 0.4]), hc, fov=30, size=(480, 360), colors=Cb))
    rows = [np.concatenate(tiles[i:i + 3], axis=1) for i in range(0, 9, 3)]
    Image.fromarray(np.concatenate(rows, axis=0)).save(os.path.join(out, 'masks.png'))
    print('ok')


if __name__ == '__main__':
    main()
