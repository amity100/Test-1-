import * as THREE from 'three';
import type { PropDef } from '../../core/contracts';
import { Builder, PALETTE, V } from './kit';

/**
 * Mesh factory for dynamic props. Local origin = bottom centre (same as a
 * DynBody's `pos`), +X = the prop's length; the returned object starts at
 * def.pos / def.yaw. Every prop is ONE mesh with ONE material (one draw call);
 * templates are cached per kind + size, so each call is a cheap clone that
 * shares geometry and materials.
 */
export function makePropFactory(materials: Record<string, THREE.Material>, mobile: boolean) {
  const cache = new Map<string, THREE.Object3D>();
  const seg = mobile ? 10 : 18;

  /** Yellow/black striped band around a vertical cylinder (vertex colours). */
  const stripes = (b: Builder, key: string, r: number, y0: number, y1: number, n: number) => {
    const yel = new THREE.Color(0xf2b21c), blk = new THREE.Color(0x1c1c1c);
    const tmp = new THREE.BufferGeometry();
    tmp.setIndex([0, 2, 1, 0, 3, 2]);
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      const pos: number[] = [], nrm: number[] = [], uv: number[] = [];
      for (const [a, y] of [[a0, y0], [a1, y0], [a1, y1], [a0, y1]]) {
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
        nrm.push(Math.cos(a), 0, Math.sin(a));
        uv.push(a, y);
      }
      tmp.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      tmp.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      tmp.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      b.geo(key, tmp, k % 2 ? blk : yel, 1, () => 1);
    }
    tmp.dispose();
  };

  const build = (def: PropDef): THREE.Object3D => {
    const b = new Builder();
    const s = def.size;
    let key = 'steel';
    switch (def.kind) {
      case 'barrel': {
        const r = Math.min(s.x, s.z) / 2, h = s.y;
        const body = def.explosive ? 0xc8321e : 0x2a64b8;
        b.cylinder(key, V(0, 0, 0), V(0, h, 0), r, body, seg, 1.2, true);
        for (const y of [h * 0.3, h * 0.68]) b.cylinder(key, V(0, y - 0.02, 0), V(0, y + 0.02, 0), r + 0.012, new THREE.Color(body).multiplyScalar(0.8), seg, 1, false);
        b.cylinder(key, V(0, h - 0.03, 0), V(0, h + 0.01, 0), r - 0.02, 0x3a3e44, seg, 1, true);
        if (def.explosive) stripes(b, key, r + 0.006, h * 0.42, h * 0.58, mobile ? 10 : 16);
        b.cylinder(key, V(r * 0.45, h, 0), V(r * 0.45, h + 0.03, 0), 0.04, 0x9aa0a6, 6, 1, true);
        break;
      }
      case 'crate': {
        key = 'wood';
        const hx = s.x / 2, hz = s.z / 2, h = s.y, f = 0.08;
        b.box(key, -hx + 0.03, 0, -hz + 0.03, hx - 0.03, h - 0.02, hz - 0.03, 0xe6cfa4, 1.2, { ao: 0.4 });
        const dk = 0xb08a5c;
        for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const x0 = ax < 0 ? -hx : hx - f, z0 = az < 0 ? -hz : hz - f;
          b.box(key, x0, 0, z0, x0 + f, h, z0 + f, dk, 1.2, { ao: 0 });
        }
        b.box(key, -hx, h - f, -hz, hx, h, hz, dk, 1.2, { ao: 0 });
        b.box(key, -hx, 0, -hz, hx, f, hz, dk, 1.2, { ao: 0 });
        b.beam(key, V(-hx + f, f, hz + 0.005), V(hx - f, h - f, hz + 0.005), 0.1, 0.02, dk, 1.2);
        b.beam(key, V(-hx + f, f, -hz - 0.005), V(hx - f, h - f, -hz - 0.005), 0.1, 0.02, dk, 1.2);
        b.box(key, -hx * 0.5, h * 0.35, hz + 0.008, hx * 0.2, h * 0.5, hz + 0.012, 0x1d2a38, 1, { ao: 0 });
        break;
      }
      case 'container': {
        key = 'container';
        const hx = s.x / 2, hz = s.z / 2, h = s.y;
        let hsh = 0;
        for (const ch of def.id) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
        const color = PALETTE.containers[hsh % PALETTE.containers.length];
        const dark = new THREE.Color(color).multiplyScalar(0.55).getHex();
        b.box(key, -hx + 0.02, 0, -hz + 0.02, hx - 0.02, h - 0.02, hz - 0.02, color, 2.4, { ao: 0.3 });
        const p = 0.16;
        for (const cx of [-hx, hx - p]) for (const cz of [-hz, hz - p]) b.box(key, cx, 0, cz, cx + p, h, cz + p, dark, 2, { ao: 0 });
        for (const cz of [-hz - 0.01, hz - 0.1]) {
          b.box(key, -hx, h - 0.14, cz, hx, h, cz + 0.11, dark, 2, { ao: 0 });
          b.box(key, -hx, 0, cz, hx, 0.16, cz + 0.11, dark, 2, { ao: 0 });
        }
        for (let k = 0; k < 4; k++) {
          const z = -hz + 0.35 + k * 0.58;
          b.box(key, hx + 0.01, 0.2, z, hx + 0.05, h - 0.2, z + 0.05, 0x9aa0a6, 2, { ao: 0 });
        }
        for (const x of [-hx + 0.3, hx - 0.3]) for (const z of [-hz + 0.3, hz - 0.3]) b.box(key, x - 0.08, h, z - 0.08, x + 0.08, h + 0.06, z + 0.08, 0x2b2f34, 1, { ao: 0 });
        break;
      }
      case 'beamBundle': {
        const L = s.x, hz = s.z / 2, h = s.y;
        const n = Math.max(2, Math.round(s.z / 0.42));
        const rows = Math.max(1, Math.round(h / 0.42));
        const bh = h / rows;
        for (let r = 0; r < rows; r++) {
          for (let i = 0; i < n; i++) {
            const z = -hz + (s.z / n) * (i + 0.5);
            const y = r * bh + bh / 2;
            if (mobile) b.box(key, -L / 2, y - bh / 2, z - s.z / n / 2 + 0.02, L / 2, y + bh / 2, z + s.z / n / 2 - 0.02, PALETTE.primer, 1.5, { ao: 0 });
            else b.ibeam(key, V(-L / 2, y, z), V(L / 2, y, z), s.z / n - 0.04, bh - 0.02, PALETTE.primer, 1.5);
          }
        }
        for (const x of [-L * 0.3, L * 0.3]) b.box(key, x - 0.06, -0.01, -hz - 0.02, x + 0.06, h + 0.01, hz + 0.02, PALETTE.orange, 1, { ao: 0 });
        break;
      }
      case 'load':
      default: {
        // a packaged rooftop plant unit in a yellow lifting frame
        const hx = s.x / 2, hz = s.z / 2, h = s.y;
        b.box(key, -hx, 0, -hz, hx, 0.18, hz, 0x3a3e44, 1, { ao: 0 });
        b.box(key, -hx + 0.1, 0.18, -hz + 0.1, hx - 0.1, h - 0.1, hz - 0.1, 0xc8ccd0, 1.5, { ao: 0.3 });
        b.box(key, -hx + 0.05, h * 0.3, -hz + 0.05, hx - 0.05, h * 0.36, hz - 0.05, PALETTE.kessler, 1, { ao: 0 });
        for (const [x, z] of [[-hx, -hz], [hx - 0.1, -hz], [-hx, hz - 0.1], [hx - 0.1, hz - 0.1]]) {
          b.box(key, x, 0, z, x + 0.1, h, z + 0.1, PALETTE.crane, 1, { ao: 0 });
          b.beam(key, V(x + 0.05, h, z + 0.05), V(0, h + 1.1, 0), 0.03, 0.03, 0x2b2f34, 1);
        }
        b.box(key, -hx, h - 0.1, -hz, hx, h, hz, PALETTE.crane, 1, { ao: 0 });
        if (!mobile) b.cylinder(key, V(0, h - 0.1, 0), V(0, h + 0.02, 0), Math.min(hx, hz) * 0.6, 0x2b2f34, 16, 1, true);
        b.box(key, -0.12, h + 1.0, -0.12, 0.12, h + 1.25, 0.12, 0x2b2f34, 1, { ao: 0 });
        break;
      }
    }
    const g = b.build(materials, { name: `prop:${def.kind}` });
    // unwrap: a single-material group becomes its one mesh
    const mesh = g.children[0] as THREE.Mesh;
    g.remove(mesh);
    return mesh;
  };

  return (def: PropDef): THREE.Object3D => {
    const key = `${def.kind}:${def.size.x.toFixed(2)}:${def.size.y.toFixed(2)}:${def.size.z.toFixed(2)}:${def.explosive ? 1 : 0}:${def.kind === 'container' ? def.id : ''}`;
    let t = cache.get(key);
    if (!t) {
      t = build(def);
      cache.set(key, t);
    }
    const o = t.clone();
    o.name = `prop:${def.id}`;
    o.userData.propId = def.id;
    o.position.copy(def.pos);
    o.rotation.set(0, def.yaw, 0);
    return o;
  };
}
