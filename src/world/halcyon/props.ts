import * as THREE from 'three';
import type { PropDef } from '../../core/contracts';
import { Builder, V } from '../tower/kit';
import { CITY } from './kit';

/**
 * Halcyon's dynamic props, same contract as the tower's makePropFactory
 * (origin at the bottom centre, +X the length, ONE mesh with ONE material per
 * prop, templates cached per kind and size):
 *   barrel  a Kessler rift-fuel cask: red lacquer, brass bands, an orange sight-glass
 *   crate   a steamer trunk: oxblood leather, brass corners, dark timber slats
 *   load    the airship's cargo pod: navy, riveted, brass bands, the gold emblem
 */
export function makeCityPropFactory(materials: Record<string, THREE.Material>, mobile: boolean) {
  const cache = new Map<string, THREE.Object3D>();
  const seg = mobile ? 10 : 18;
  const key = 'prop';
  const brass = CITY.brass;

  const build = (def: PropDef): THREE.Object3D => {
    const b = new Builder();
    const s = def.size;
    const hx = s.x / 2, hz = s.z / 2, h = s.y;
    switch (def.kind) {
      case 'barrel': {
        const r = Math.min(s.x, s.z) / 2;
        b.cylinder(key, V(0, 0, 0), V(0, h, 0), r * 0.94, def.explosive ? 0x9e1f1c : 0x1d2b45, seg, 1.2, true, r * 0.94);
        for (const y of [0.06, h * 0.5, h - 0.06]) b.cylinder(key, V(0, y - 0.04, 0), V(0, y + 0.04, 0), r, brass, seg, 1, true);
        // the sight-glass: a lit orange slot (it is fuel)
        b.box(key, r * 0.9, h * 0.22, -0.06, r * 0.99, h * 0.42, 0.06, def.explosive ? 0xff8a2a : 0x9fdfff, 1, { ao: 0 });
        b.cylinder(key, V(0, h, 0), V(0, h + 0.03, 0), r * 0.5, CITY.iron, seg, 1, true);
        b.cylinder(key, V(r * 0.4, h, 0), V(r * 0.4, h + 0.07, 0), 0.05, brass, 6, 1, true);
        break;
      }
      case 'crate': {
        // a steamer trunk
        b.box(key, -hx + 0.02, 0, -hz + 0.02, hx - 0.02, h - 0.02, hz - 0.02, 0x6a3524, 1.2, { ao: 0.3 });
        for (const y of [h * 0.3, h * 0.72]) b.box(key, -hx, y, -hz, hx, y + 0.07, hz, 0x3a2518, 1, { ao: 0 });
        for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const x0 = ax < 0 ? -hx : hx - 0.12, z0 = az < 0 ? -hz : hz - 0.12;
          b.box(key, x0, 0, z0, x0 + 0.12, 0.14, z0 + 0.12, brass, 1, { ao: 0 });
          b.box(key, x0, h - 0.14, z0, x0 + 0.12, h, z0 + 0.12, brass, 1, { ao: 0 });
        }
        b.box(key, -0.1, h * 0.52, hz - 0.01, 0.1, h * 0.66, hz + 0.02, brass, 1, { ao: 0 });
        b.box(key, -0.25, h, -0.04, 0.25, h + 0.05, 0.04, 0x3a2a1e, 1, { ao: 0 });
        break;
      }
      case 'load': {
        // the cargo pod: a riveted navy shell on a brass skid, bands, the emblem, an amber status strip, a lifting eye
        b.box(key, -hx, 0, -hz, hx, 0.14, hz, brass, 1, { ao: 0 });
        b.box(key, -hx + 0.08, 0.14, -hz + 0.08, hx - 0.08, h - 0.12, hz - 0.08, 0x1d2b45, 1.2, { ao: 0.3 });
        b.box(key, -hx + 0.3, h - 0.12, -hz + 0.3, hx - 0.3, h, hz - 0.3, 0x243650, 1, { ao: 0 });
        for (const y of [h * 0.28, h * 0.78]) b.box(key, -hx + 0.04, y, -hz + 0.04, hx - 0.04, y + 0.1, hz - 0.04, brass, 1, { ao: 0 });
        for (const [x, z] of [[-hx + 0.04, -hz + 0.04], [hx - 0.2, -hz + 0.04], [-hx + 0.04, hz - 0.2], [hx - 0.2, hz - 0.2]]) b.box(key, x, 0.14, z, x + 0.16, h - 0.12, z + 0.16, brass, 1, { ao: 0 });
        b.box(key, -hx + 0.06, h * 0.52, -hz + 0.06, hx - 0.06, h * 0.56, hz - 0.06, 0xffb04a, 1, { ao: 0 });
        for (const sx of [-1, 1]) {
          const ring = new THREE.TorusGeometry(0.42, 0.05, 4, 16).rotateY(Math.PI / 2).translate(sx * (hx - 0.06), h * 0.62, 0);
          b.geo(key, ring, CITY.gilt);
          ring.dispose();
          b.box(key, sx * (hx - 0.06) - 0.02, h * 0.62 - 0.55, -0.04, sx * (hx - 0.06) + 0.02, h * 0.62 + 0.55, 0.04, CITY.gilt, 1, { ao: 0 });
        }
        const eye = new THREE.TorusGeometry(0.22, 0.05, 4, 12).translate(0, h + 0.2, 0);
        b.geo(key, eye, CITY.iron);
        eye.dispose();
        break;
      }
      default: {
        b.box(key, -hx, 0, -hz, hx, h, hz, 0x6e5034, 1.2, { ao: 0.3 });
        b.box(key, -hx - 0.01, h * 0.45, -hz - 0.01, hx + 0.01, h * 0.55, hz + 0.01, brass, 1, { ao: 0 });
      }
    }
    const g = b.build(materials, { name: `prop:${def.kind}` });
    // unwrap: a single-material group becomes its one mesh
    const mesh = g.children[0] as THREE.Mesh;
    g.remove(mesh);
    return mesh;
  };

  return (def: PropDef): THREE.Object3D => {
    const k = `${def.kind}:${def.size.x.toFixed(2)}:${def.size.y.toFixed(2)}:${def.size.z.toFixed(2)}:${def.explosive ? 1 : 0}`;
    let t = cache.get(k);
    if (!t) {
      t = build(def);
      cache.set(k, t);
    }
    const o = t.clone();
    o.name = `prop:${def.id}`;
    o.userData.propId = def.id;
    o.position.copy(def.pos);
    o.rotation.set(0, def.yaw, 0);
    return o;
  };
}
