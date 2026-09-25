import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { beginRenderFrame } from '../../src/render/frameonce';
import { frontToBack, type SortItem } from '../../src/render/renderer';
import { Game } from '../../src/game/game';

describe('once-per-frame render work', () => {
  it('computes a skeleton once per frame, however many views render it', () => {
    const bone = new THREE.Bone();
    const sk = new THREE.Skeleton([bone]);
    beginRenderFrame();
    bone.position.set(1, 0, 0);
    bone.updateMatrixWorld(true);
    sk.update();
    expect(sk.boneMatrices![12]).toBeCloseTo(1);
    // (a second view in the same frame: nothing has moved, nothing is recomputed)
    bone.position.set(2, 0, 0);
    bone.updateMatrixWorld(true);
    sk.update();
    expect(sk.boneMatrices![12]).toBeCloseTo(1);
    // the next frame sees the new pose
    beginRenderFrame();
    sk.update();
    expect(sk.boneMatrices![12]).toBeCloseTo(2);
  });

  it("brings the scene's matrices up to date once, before the rift views and the main view", () => {
    const scene = new THREE.Scene();
    scene.matrixWorldAutoUpdate = false;
    const man = new THREE.Object3D();
    scene.add(man);
    const seen: [string, number][] = [];
    let updates = 0;
    const umw = scene.updateMatrixWorld.bind(scene);
    scene.updateMatrixWorld = (force?: boolean) => {
      updates++;
      umw(force);
    };
    const u = () => ({ value: 0 });
    const renderer = {
      renderer: { shadowMap: {}, getPixelRatio: () => 1 },
      dynres: {},
      renderScale: 1,
      width: 64,
      height: 64,
      sceneWidth: 64,
      sceneHeight: 64,
      grade: { uniforms: { uFocus: u(), uFlash: u(), uDamage: u() } },
      render: () => seen.push(['main', man.matrixWorld.elements[12]]),
    };
    const rifts = { aiming: false, preallocate() {}, renderViews: () => seen.push(['rifts', man.matrixWorld.elements[12]]) };
    const g = Object.assign(Object.create(Game.prototype), {
      scene,
      camera: new THREE.PerspectiveCamera(),
      renderer,
      rifts,
      mode: 'playing',
      exporter: { recording: false },
      fx: { setPixelRatio() {} },
      wideLines: [],
      helpers: [],
      hp: 100,
      pixelScale: -1,
      fullRes: false,
    }) as any;
    for (const x of [3, 5]) {
      man.position.x = x;
      g.render(1 / 60);
    }
    expect(seen).toEqual([['rifts', 3], ['main', 3], ['rifts', 5], ['main', 5]]);
    expect(updates).toBe(2);
  });
});

describe('opaque draw order', () => {
  const item = (o: Partial<SortItem>): SortItem => ({ groupOrder: 0, renderOrder: 0, z: 0.5, material: { id: 1 }, id: 1, ...o });
  it('draws nearer surfaces first, whatever their material', () => {
    const near = item({ z: 0.2, material: { id: 9 }, id: 2 });
    const far = item({ z: 0.8, material: { id: 1 }, id: 3 });
    expect([far, near].sort(frontToBack)).toEqual([near, far]);
  });
  it('keeps render order and groups ahead of depth (the sky and skylines after the world)', () => {
    const sky = item({ renderOrder: 1000, z: 0.01 });
    const wall = item({ z: 0.9, id: 4 });
    expect([sky, wall].sort(frontToBack)).toEqual([wall, sky]);
    const grouped = item({ groupOrder: 1, z: 0.01 });
    expect([grouped, wall].sort(frontToBack)).toEqual([wall, grouped]);
  });
  it('is a total order: equal depths fall back to material, then id', () => {
    const a = item({ material: { id: 2 }, id: 7 }), b = item({ material: { id: 1 }, id: 8 }), c = item({ material: { id: 1 }, id: 5 });
    expect([a, b, c].sort(frontToBack)).toEqual([c, b, a]);
  });
});
