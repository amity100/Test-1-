"""
Shape iteration helper: polygonise the bear sculpt at a coarse resolution and render preview sheets.

    python3 tools/animals/shape_preview.py <out_dir> [h=0.006]
"""
from __future__ import annotations

import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import bear_design as B  # noqa: E402
from sdf import narrow_band_grid, polygonise  # noqa: E402
from preview import views_sheet, closeup  # noqa: E402


def main():
    out = sys.argv[1]
    h = float(sys.argv[2]) if len(sys.argv) > 2 else 0.006
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    prims = B.sculpt()
    vol, org, hh = narrow_band_grid(prims, B.BBOX_LO, B.BBOX_HI, h, coarse_factor=4)
    v, f = polygonise(vol, org, hh)
    print(f'mesh {len(v)} verts {len(f)} tris in {time.time() - t0:.1f}s')
    np.savez_compressed(os.path.join(out, 'shape.npz'), v=v, f=f)
    views_sheet(v, f, os.path.join(out, 'sheet.png'), center=(0, 0.55, 0.05), dist=5.2)
    hc = B.SOCKETS['headCenter'][1]
    closeup(v, f, os.path.join(out, 'head34.png'), hc, hc + np.array([0.55, 0.12, 0.75]), fov=30)
    closeup(v, f, os.path.join(out, 'headside.png'), hc, hc + np.array([1.0, 0.02, 0.05]), fov=26)
    closeup(v, f, os.path.join(out, 'headfront.png'), hc, hc + np.array([0.0, 0.05, 1.0]), fov=26)
    closeup(v, f, os.path.join(out, 'paws.png'), np.array([0, 0.12, 0.0]), np.array([1.1, 0.35, 1.5]), fov=32)
    print(f'done {time.time() - t0:.1f}s')


if __name__ == '__main__':
    main()
