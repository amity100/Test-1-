import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { describe, expect, it } from 'vitest';
import { CLIP_NAMES, loadAnimLibrary, shortBoneName } from '../../src/game/characters';
import { fileSize, loadSoldier, readAnimsJson, soldierNodeNames } from './soldier';

const json = readAnimsJson();

describe('anims.json (extract-anims output)', () => {
  it('is compact', () => {
    expect(fileSize('anims.json')).toBeLessThan(1.5 * 1024 * 1024);
  });

  it('contains every ClipName', () => {
    for (const c of CLIP_NAMES) expect(json.clips[c], c).toBeTruthy();
  });

  it('only references Soldier bones', () => {
    const names = new Set(soldierNodeNames().map(shortBoneName));
    expect(json.bones.length).toBeGreaterThan(20);
    for (const b of json.bones) expect(names.has(b), b).toBe(true);
    for (const b of ['Hips', 'Spine', 'Spine2', 'Head', 'LeftArm', 'RightForeArm', 'LeftUpLeg', 'RightFoot']) expect(json.bones).toContain(b);
  });

  it('has normalized quaternions, ordered keys and a Hips position track per clip', () => {
    for (const name of CLIP_NAMES) {
      const c = json.clips[name];
      let hipsPos = 0;
      for (const t of c.tracks) {
        expect(t.b).toBeGreaterThanOrEqual(0);
        expect(t.b).toBeLessThan(json.bones.length);
        const n = t.p === 'q' ? 4 : 3;
        expect(t.v.length).toBe(t.k.length * n);
        for (let i = 1; i < t.k.length; i++) expect(t.k[i]).toBeGreaterThan(t.k[i - 1]);
        expect(t.k[0]).toBe(0);
        expect(t.k[t.k.length - 1]).toBeLessThan(c.frames);
        if (t.p === 'q') {
          for (let i = 0; i < t.v.length; i += 4) {
            const l = Math.hypot(t.v[i], t.v[i + 1], t.v[i + 2], t.v[i + 3]) / json.qScale;
            expect(Math.abs(l - 1), `${name} bone ${json.bones[t.b]}`).toBeLessThan(2e-3);
          }
        } else {
          expect(json.bones[t.b]).toBe('Hips');
          hipsPos++;
        }
      }
      expect(hipsPos, name).toBe(1);
    }
  });

  it('has sane durations', () => {
    for (const name of CLIP_NAMES) {
      const c = json.clips[name];
      expect(c.duration, name).toBeGreaterThanOrEqual(0);
      expect(c.duration, name).toBeLessThan(4);
      expect(c.frames, name).toBe(Math.round(c.duration * json.fps) + 1);
      if (name !== 'aim') expect(c.duration, name).toBeGreaterThan(0.25);
    }
    for (const n of ['walk', 'run', 'sprint', 'crouchWalk']) expect(json.clips[n].speed, n).toBeGreaterThan(0.3);
    expect(json.clips.walk.speed).toBeLessThan(json.clips.run.speed);
    expect(json.clips.run.speed).toBeLessThan(json.clips.sprint.speed);
    for (const n of ['idle', 'walk', 'run', 'sprint', 'crouchIdle', 'crouchWalk', 'jumpLoop', 'swimIdle', 'swim']) expect(json.clips[n].loop, n).toBe(true);
    for (const n of ['strike', 'punch', 'death', 'roll', 'jumpStart', 'jumpLand', 'hitChest', 'shoot']) expect(json.clips[n].loop, n).toBe(false);
  });
});

describe('loadAnimLibrary', () => {
  it('builds THREE clips bound to the Soldier skeleton', async () => {
    const asset = await loadSoldier();
    const lib = loadAnimLibrary(json, asset);
    expect(lib.bones.length).toBe(json.bones.length);
    for (const name of CLIP_NAMES) {
      const clip = lib.clips[name];
      expect(clip).toBeInstanceOf(THREE.AnimationClip);
      expect(clip.name).toBe(name);
      expect(clip.tracks.length).toBeGreaterThan(1);
      expect(Math.abs(clip.duration - Math.max(lib.info[name].duration, 1 / json.fps))).toBeLessThan(1e-6);
      expect(clip.validate()).toBe(true);
      for (const t of clip.tracks) {
        const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(t.name);
        const node = THREE.PropertyBinding.findNode(asset.scene, nodeName);
        expect(node, t.name).toBeTruthy();
        expect((node as THREE.Bone).isBone, t.name).toBe(true);
        expect(['quaternion', 'position']).toContain(propertyName);
      }
    }
  });

  it('plays through a stock AnimationMixer', async () => {
    const asset = await loadSoldier();
    const lib = loadAnimLibrary(json, asset);
    const scene = SkeletonUtils.clone(asset.scene);
    const mixer = new THREE.AnimationMixer(scene);
    const hips = scene.getObjectByName(lib.boneNodes[lib.bones.indexOf('Hips')])!;
    const y0 = hips.position.clone();
    const a = mixer.clipAction(lib.clips.death);
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.play();
    mixer.update(lib.info.death.duration + 0.1);
    // lying down: hips close to the floor (Soldier units: cm, Z-up under the scaled root)
    expect(hips.position.z).toBeLessThan(y0.z * 0.4);
    mixer.stopAllAction();
  });

  it('rejects malformed input', async () => {
    const asset = await loadSoldier();
    expect(() => loadAnimLibrary({}, asset)).toThrow();
    const broken = JSON.parse(JSON.stringify(json));
    delete broken.clips.roll;
    expect(() => loadAnimLibrary(broken, asset)).toThrow(/roll/);
  });
});
