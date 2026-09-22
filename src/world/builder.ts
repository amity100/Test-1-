import * as THREE from 'three';

/**
 * Accumulates axis-aligned boxes into one merged geometry per material, with
 * world-space UVs so textures tile at a constant density regardless of box
 * size. Keeps draw calls tiny (important on phones).
 */
export class MeshBuilder {
  private buckets = new Map<string, { pos: number[]; nrm: number[]; uv: number[]; col: number[]; idx: number[] }>();

  private bucket(key: string) {
    let b = this.buckets.get(key);
    if (!b) {
      b = { pos: [], nrm: [], uv: [], col: [], idx: [] };
      this.buckets.set(key, b);
    }
    return b;
  }

  /**
   * Box with world-space UVs. `uvScale` = metres per texture repeat.
   * `skipBottom` avoids invisible faces on ground-resting boxes.
   */
  box(key: string, min: THREE.Vector3Like, max: THREE.Vector3Like, color: THREE.ColorRepresentation = 0xffffff, uvScale = 4, opts: { skipBottom?: boolean; skipTop?: boolean; uvRotate?: boolean } = {}) {
    const b = this.bucket(key);
    const c = new THREE.Color(color);
    const x0 = min.x, y0 = min.y, z0 = min.z, x1 = max.x, y1 = max.y, z1 = max.z;
    const faces: [number[], number[], number[][]][] = [
      // normal, [u axis, v axis], corners
      [[1, 0, 0], [2, 1], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]]],
      [[-1, 0, 0], [2, 1], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]],
      [[0, 1, 0], [0, 2], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]]],
      [[0, -1, 0], [0, 2], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]],
      [[0, 0, 1], [0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]],
      [[0, 0, -1], [0, 1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]],
    ];
    for (const [n, axes, corners] of faces) {
      if (opts.skipBottom && n[1] === -1) continue;
      if (opts.skipTop && n[1] === 1) continue;
      const base = b.pos.length / 3;
      // subtle baked ambient occlusion: darken bottoms of vertical faces
      for (const p of corners) {
        b.pos.push(p[0], p[1], p[2]);
        b.nrm.push(n[0], n[1], n[2]);
        let u = p[axes[0]] / uvScale, v = p[axes[1]] / uvScale;
        if (opts.uvRotate) [u, v] = [v, u];
        b.uv.push(u, v);
        const ao = n[1] === 0 ? THREE.MathUtils.lerp(0.55, 1, THREE.MathUtils.clamp((p[1] - y0) / 1.2 + (y0 > 0.1 ? 0.6 : 0), 0, 1)) : 1;
        b.col.push(c.r * ao, c.g * ao, c.b * ao);
      }
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  /** Arbitrary geometry (already positioned) merged into a bucket. */
  geometry(key: string, g: THREE.BufferGeometry, color: THREE.ColorRepresentation = 0xffffff) {
    const b = this.bucket(key);
    const c = new THREE.Color(color);
    const gi = g.index ? g : g.toNonIndexed();
    const pos = gi.getAttribute('position');
    const nrm = gi.getAttribute('normal');
    const uv = gi.getAttribute('uv');
    const base = b.pos.length / 3;
    for (let i = 0; i < pos.count; i++) {
      b.pos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      b.nrm.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
      b.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      b.col.push(c.r, c.g, c.b);
    }
    if (gi.index) for (let i = 0; i < gi.index.count; i++) b.idx.push(base + gi.index.getX(i));
    else for (let i = 0; i < pos.count; i++) b.idx.push(base + i);
  }

  build(materials: Record<string, THREE.Material>, opts: { castShadow?: boolean; receiveShadow?: boolean } = {}) {
    const group = new THREE.Group();
    for (const [key, b] of this.buckets) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.setIndex(b.idx);
      g.computeBoundingSphere();
      const mat = materials[key];
      if (!mat) throw new Error(`No material for bucket ${key}`);
      const m = new THREE.Mesh(g, mat);
      m.castShadow = opts.castShadow ?? true;
      m.receiveShadow = opts.receiveShadow ?? true;
      m.name = `static:${key}`;
      group.add(m);
    }
    return group;
  }
}
