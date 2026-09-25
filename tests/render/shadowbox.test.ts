import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ShadowBox } from '../../src/render/shadowbox';

// the two worlds' suns (halcyon, harbour)
const SUNS = [new THREE.Vector3(0.7, 0.41, 0.59).normalize(), new THREE.Vector3(-0.87, 0.27, -0.22).normalize()];
const EXT = 50, MAP = 2048, TEXEL = (2 * EXT) / MAP;

/** A sun placed as the game places it: 140 m back along its direction from the box centre. */
function sunAt(dir: THREE.Vector3, centre: THREE.Vector3) {
  const sun = new THREE.DirectionalLight();
  const sc = sun.shadow.camera;
  sc.left = -EXT; sc.right = EXT; sc.top = EXT; sc.bottom = -EXT; sc.near = 1; sc.far = 260;
  sc.updateProjectionMatrix();
  sun.shadow.mapSize.set(MAP, MAP);
  sun.position.copy(centre).addScaledVector(dir, 140);
  sun.target.position.copy(centre);
  sun.updateMatrixWorld();
  sun.target.updateMatrixWorld();
  sun.shadow.updateMatrices(sun);
  return sun;
}

/** Shadow-map texel coordinates of a world point. */
function texelOf(sun: THREE.DirectionalLight, p: THREE.Vector3) {
  const v = p.clone().project(sun.shadow.camera);
  return [(v.x * 0.5 + 0.5) * MAP, (v.y * 0.5 + 0.5) * MAP];
}

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('ShadowBox', () => {
  it("uses the shadow camera's own axes", () => {
    for (const dir of SUNS) {
      const box = new ShadowBox();
      box.setSun(dir);
      const sun = sunAt(dir, new THREE.Vector3(12, 3, -40));
      const r = new THREE.Vector3(), u = new THREE.Vector3(), b = new THREE.Vector3();
      sun.shadow.camera.matrixWorld.extractBasis(r, u, b);
      expect(r.distanceTo(box.right)).toBeLessThan(1e-9);
      expect(u.distanceTo(box.up)).toBeLessThan(1e-9);
      expect(b.distanceTo(box.back)).toBeLessThan(1e-9);
    }
  });

  it('moves the box by whole texels only: fixed world points keep their texels (no crawl)', () => {
    for (const dir of SUNS) {
      const box = new ShadowBox();
      box.setSun(dir);
      const pts = Array.from({ length: 12 }, () => new THREE.Vector3(rnd() * 60 - 30, rnd() * 20, rnd() * 60 - 30));
      const at = new THREE.Vector3(3, 1, 4);
      let prev: number[][] | null = null, prevRaw: number[][] | null = null;
      let rawFractional = 0;
      for (let i = 0; i < 40; i++) {
        // walking and turning: the look-ahead swings the box centre around
        at.x += rnd() * 0.37 - 0.1;
        at.z += rnd() * 0.29 - 0.08;
        at.y = 1 + Math.sin(i * 0.3) * 0.4;
        const c = box.place(at, TEXEL, new THREE.Vector3());
        const cur = pts.map((p) => texelOf(sunAt(dir, c), p));
        const raw = pts.map((p) => texelOf(sunAt(dir, at), p));
        if (prev && prevRaw) {
          for (let k = 0; k < pts.length; k++)
            for (const a of [0, 1]) {
              const d = cur[k][a] - prev[k][a];
              expect(Math.abs(d - Math.round(d))).toBeLessThan(1e-4);
              const dr = raw[k][a] - prevRaw[k][a];
              if (Math.abs(dr - Math.round(dr)) > 0.01) rawFractional++;
            }
        }
        prev = cur;
        prevRaw = raw;
      }
      // (without the snap, the same walk slides the texel grid under the world: the crawl)
      expect(rawFractional).toBeGreaterThan(100);
    }
  });

  it('stays within half a texel of the wanted centre, and keeps its depth along the light', () => {
    for (const dir of SUNS) {
      const box = new ShadowBox();
      box.setSun(dir);
      for (let i = 0; i < 200; i++) {
        const at = new THREE.Vector3(rnd() * 400 - 200, rnd() * 40, rnd() * 400 - 200);
        const c = box.place(at, TEXEL, new THREE.Vector3());
        const d = c.clone().sub(at);
        expect(Math.abs(d.dot(box.right))).toBeLessThanOrEqual(TEXEL / 2 + 1e-9);
        expect(Math.abs(d.dot(box.up))).toBeLessThanOrEqual(TEXEL / 2 + 1e-9);
        expect(Math.abs(d.dot(box.back))).toBeLessThan(1e-9);
      }
      // (in place, and a zero texel leaves it alone)
      const p = new THREE.Vector3(1.234, 5, -6.789);
      expect(box.place(p.clone(), 0, new THREE.Vector3()).distanceTo(p)).toBe(0);
      const q = p.clone();
      expect(box.place(q, TEXEL, q)).toBe(q);
    }
  });
});
