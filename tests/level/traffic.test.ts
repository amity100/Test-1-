import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildHalcyon } from '../../src/world/halcyon';

describe('Halcyon traffic culling', () => {
  it('keeps every train car, launch, swift and walker inside its mesh\'s fixed culling sphere, all the way round', () => {
    const L = buildHalcyon(null, false, { headless: true });
    const ims: THREE.InstancedMesh[] = [];
    L.root.traverse((o) => {
      if ((o as THREE.InstancedMesh).isInstancedMesh && o.name.startsWith('traffic:')) ims.push(o as THREE.InstancedMesh);
    });
    expect(ims.map((m) => m.name).sort()).toEqual(['traffic:carGlow', 'traffic:cars', 'traffic:launches', 'traffic:people', 'traffic:swifts']);
    L.root.updateMatrixWorld(true);
    const m = new THREE.Matrix4(), s = new THREE.Sphere();
    let worst = 0;
    // (past a full loop of the slowest mover: a launch at 1 m/s round its 840 m)
    for (let t = 0; t < 900; t += 0.37) {
      for (const f of L.animated) f(t);
      for (const im of ims) {
        expect(im.frustumCulled, im.name).toBe(true);
        const bound = im.boundingSphere!.clone().applyMatrix4(im.matrixWorld);
        const g = im.geometry.boundingSphere!;
        for (let i = 0; i < im.count; i++) {
          im.getMatrixAt(i, m);
          s.copy(g).applyMatrix4(m.premultiply(im.matrixWorld));
          const reach = s.center.distanceTo(bound.center) + s.radius;
          worst = Math.max(worst, reach / bound.radius);
          expect(reach - bound.radius, `${im.name} #${i} at t ${t.toFixed(2)}`).toBeLessThanOrEqual(1e-3);
        }
      }
    }
    // (and not needlessly loose: some instance reaches most of the way out)
    expect(worst).toBeGreaterThan(0.6);
  });
});
