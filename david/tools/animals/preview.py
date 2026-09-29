"""
Quick shaded previews of a triangle mesh (embree ray casting through trimesh) for shape iteration.

    python3 tools/animals/preview.py mesh.npz out.png [views]
"""
from __future__ import annotations

import sys

import numpy as np
from PIL import Image


def look_at(eye, target, up=(0, 1, 0)):
    eye = np.asarray(eye, dtype=np.float64)
    f = np.asarray(target, dtype=np.float64) - eye
    f /= np.linalg.norm(f)
    r = np.cross(f, up)
    r /= np.linalg.norm(r)
    u = np.cross(r, f)
    return eye, f, r, u


def render(verts, faces, eye, target, fov=30.0, size=(640, 480), colors=None, light=(0.4, 0.8, 0.45), bg=(0.18, 0.2, 0.23), ortho=None):
    import trimesh
    mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
    try:
        from trimesh.ray.ray_pyembree import RayMeshIntersector
        ray = RayMeshIntersector(mesh)
    except Exception:
        ray = mesh.ray
    W, H = size
    eye, f, r, u = look_at(eye, target)
    ys, xs = np.mgrid[0:H, 0:W]
    sx = (xs + 0.5) / W * 2 - 1
    sy = 1 - (ys + 0.5) / H * 2
    aspect = W / H
    if ortho:
        origins = eye + (sx.reshape(-1, 1) * ortho * aspect) * r + (sy.reshape(-1, 1) * ortho) * u
        dirs = np.repeat(f[None, :], W * H, axis=0)
    else:
        t = np.tan(np.radians(fov) / 2)
        dirs = f + (sx.reshape(-1, 1) * t * aspect) * r + (sy.reshape(-1, 1) * t) * u
        dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
        origins = np.repeat(eye[None, :], W * H, axis=0)
    locs, idx_ray, idx_tri = ray.intersects_location(origins, dirs, multiple_hits=False)
    img = np.tile(np.array(bg, dtype=np.float64), (W * H, 1))
    if len(idx_ray):
        fn = mesh.face_normals[idx_tri]
        # smooth normal via barycentric interpolation of vertex normals
        vn = mesh.vertex_normals
        tri = mesh.triangles[idx_tri]
        bary = trimesh.triangles.points_to_barycentric(tri, locs)
        n = (vn[faces[idx_tri]] * bary[:, :, None]).sum(axis=1)
        n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
        flip = (n * dirs[idx_ray]).sum(1) > 0
        n[flip] *= -1
        L = np.asarray(light, dtype=np.float64)
        L /= np.linalg.norm(L)
        ndl = np.clip(n @ L, 0, 1)
        hemi = 0.5 + 0.5 * n[:, 1]
        V = -dirs[idx_ray]
        rim = np.clip(1 - (n * V).sum(1), 0, 1) ** 3
        base = np.array([0.78, 0.66, 0.5])
        if colors is not None:
            base = (colors[faces[idx_tri]] * bary[:, :, None]).sum(axis=1)
        c = base * (0.18 + 0.22 * hemi[:, None] + 0.75 * ndl[:, None]) + 0.12 * rim[:, None]
        img[idx_ray] = c
    img = np.clip(img, 0, 1) ** (1 / 2.2)
    return (img.reshape(H, W, 3) * 255).astype(np.uint8)


def views_sheet(verts, faces, out, center=(0, 0.6, 0.05), dist=4.2, size=(560, 400), colors=None, which=None):
    c = np.asarray(center, dtype=np.float64)
    V = {
        'side': (c + [dist, 0.05, 0.0], None),
        'front': (c + [0.0, 0.1, dist], None),
        'q34': (c + [dist * 0.62, 0.5, dist * 0.72], None),
        'top': (c + [0.0001, dist, 0.0], None),
        'rear34': (c + [-dist * 0.6, 0.4, -dist * 0.7], None),
        'low': (c + [dist * 0.7, -0.25, dist * 0.55], None),
    }
    which = which or ['side', 'front', 'q34', 'top', 'rear34', 'low']
    tiles = []
    for k in which:
        eye, _ = V[k]
        tiles.append(render(verts, faces, eye, c, fov=26, size=size, colors=colors))
    cols = 3
    rows = (len(tiles) + cols - 1) // cols
    sheet = np.zeros((rows * size[1], cols * size[0], 3), dtype=np.uint8)
    for i, t in enumerate(tiles):
        rr, cc = divmod(i, cols)
        sheet[rr * size[1]:(rr + 1) * size[1], cc * size[0]:(cc + 1) * size[0]] = t
    Image.fromarray(sheet).save(out)


def closeup(verts, faces, out, target, eye, fov=22, size=(800, 600), colors=None):
    Image.fromarray(render(verts, faces, eye, target, fov=fov, size=size, colors=colors)).save(out)


if __name__ == '__main__':
    d = np.load(sys.argv[1])
    views_sheet(d['v'], d['f'], sys.argv[2])
