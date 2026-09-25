import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DeathKind, LocomotionInput } from '../../src/core/contracts';
import { Character, CLIP_NAMES, CULL_SPHERE_GROW, loadAnimLibrary, type AnimLibrary, type CharacterAsset, type Look } from '../../src/game/characters';
import { loadSoldier, readAnimsJson } from './soldier';

let asset: CharacterAsset;
let lib: AnimLibrary;

beforeAll(async () => {
  asset = await loadSoldier();
  lib = loadAnimLibrary(readAnimsJson(), asset);
});

const loco = (o: Partial<LocomotionInput> = {}): LocomotionInput => ({ speed: 0, grounded: true, vy: 0, crouch: 0, aim: 0, ...o });

function skinnedOf(c: Character) {
  const out: THREE.SkinnedMesh[] = [];
  c.root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) out.push(o as THREE.SkinnedMesh);
  });
  return out;
}

/**
 * Per bone, how far from it (in its own frame, bind pose) any vertex weighted to it lies. A skinned
 * vertex is a weighted mix of its bones' rigid transforms, so it is never further from a point than
 * the furthest of (bone position + reach): a bound on the posed mesh from the bones alone.
 */
function boneReach(meshes: THREE.SkinnedMesh[]) {
  const reach = new Map<THREE.Bone, number>();
  const v = new THREE.Vector3(), b = new THREE.Vector3();
  for (const m of meshes) {
    const pos = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix);
      for (let k = 0; k < 4; k++) {
        if (sw.getComponent(i, k) <= 0) continue;
        const j = si.getComponent(i, k);
        b.copy(v).applyMatrix4(m.skeleton.boneInverses[j]);
        const bone = m.skeleton.bones[j];
        reach.set(bone, Math.max(reach.get(bone) ?? 0, b.length()));
      }
    }
  }
  return reach;
}

describe('character culling sphere', () => {
  for (const look of ['rifleman', 'brute'] as Look[]) {
    it(`${look}: every pose stays inside the sphere it is culled against`, () => {
      const c = new Character(asset, lib, look);
      const meshes = skinnedOf(c);
      expect(meshes.length).toBeGreaterThanOrEqual(2); // body + visor
      c.root.updateMatrixWorld(true);
      // one sphere for all of them (the visor's is the body's), in the same space
      for (const m of meshes) {
        expect(m.frustumCulled).toBe(true);
        expect(m.boundingSphere!.equals(meshes[0].boundingSphere!)).toBe(true);
        expect(m.matrixWorld.equals(meshes[0].matrixWorld)).toBe(true);
      }
      const reach = boneReach(meshes);
      const sphere = new THREE.Sphere();
      const p = new THREE.Vector3();
      let worst = 0, worstWhat = '', steps = 0;
      const check = (what: string) => {
        c.root.updateMatrixWorld(true);
        sphere.copy(meshes[0].boundingSphere!).applyMatrix4(meshes[0].matrixWorld);
        for (const [bone, r] of reach) {
          const d = bone.getWorldPosition(p).distanceTo(sphere.center) + r * bone.matrixWorld.getMaxScaleOnAxis();
          const k = d / sphere.radius;
          if (k > worst) (worst = k), (worstWhat = what);
        }
        steps++;
      };
      const dt = 1 / 20;
      for (const clip of CLIP_NAMES) {
        c.revive();
        c.play(clip, { hold: true });
        for (let t = 0; t < lib.info[clip].duration + 0.3; t += dt) {
          c.update(dt, loco({ aim: 1, weaponUp: 1 }));
          check(clip);
        }
      }
      for (const s of [0, 1.5, 3, 5, 8]) {
        for (const o of [{}, { crouch: 1 }, { aim: 1 }, { weaponUp: 1 }, { grounded: false, vy: 6 }, { grounded: false, vy: -8 }]) {
          c.revive();
          for (let i = 0; i < 24; i++) {
            c.update(dt, loco({ speed: s, ...o }));
            check(`loco ${s} ${JSON.stringify(o)}`);
          }
        }
      }
      for (const kind of ['shot', 'blast', 'fall', 'cut', 'drown'] as DeathKind[]) {
        c.revive();
        c.die(kind);
        for (let i = 0; i < 70; i++) {
          c.update(dt, loco());
          check('death ' + kind);
        }
      }
      c.revive();
      for (let i = 0; i < 60; i++) {
        c.update(dt, loco({ downed: i < 40 }));
        check('downed / get up');
      }
      c.revive();
      for (let i = 0; i < 40; i++) {
        c.update(dt, loco({ speed: 2, grounded: false, swimming: true }));
        check('swim');
      }
      // thrown: any orientation about the hips, alive or dying
      const q = new THREE.Quaternion();
      for (const dying of [false, true]) {
        c.revive();
        if (dying) c.die('blast');
        for (let i = 0; i < 120; i++) {
          q.setFromEuler(new THREE.Euler(i * 0.37, i * 0.21, i * 0.11));
          c.setTumble(q);
          c.update(dt, loco({ grounded: false, vy: -4 }));
          check('tumble');
        }
      }
      expect(steps).toBeGreaterThan(800);
      // inside, with room to spare, but not the old slack (twice the T-pose sphere plus a margin)
      expect(worst, worstWhat).toBeLessThan(0.95);
      expect(worst).toBeGreaterThan(0.75);
      expect(CULL_SPHERE_GROW).toBeLessThanOrEqual(1.5);
    });
  }
});
