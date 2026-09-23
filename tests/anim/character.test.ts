import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { CharacterPose, LocomotionInput } from '../../src/core/contracts';
import { Character, loadAnimLibrary, type AnimLibrary, type CharacterAsset, type Look } from '../../src/game/characters';
import { env, loadSoldier, readAnimsJson } from './soldier';

let asset: CharacterAsset;
let lib: AnimLibrary;

beforeAll(async () => {
  asset = await loadSoldier();
  lib = loadAnimLibrary(readAnimsJson(), asset);
});

const loco = (o: Partial<LocomotionInput> = {}): LocomotionInput => ({ speed: 0, grounded: true, vy: 0, crouch: 0, aim: 0, ...o });

/** All animated bone rotations + hips position, flattened. */
function snapshot(c: Character): number[] {
  const out: number[] = [];
  for (const b of lib.bones) out.push(...c.bones[b].quaternion.toArray());
  out.push(...c.bones.Hips.position.toArray());
  return out;
}

function maxDiff(a: number[], b: number[]) {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

function worldPos(c: Character, bone: string) {
  c.root.updateMatrixWorld(true);
  return c.bones[bone].getWorldPosition(new THREE.Vector3());
}

describe('Character', () => {
  it('builds every look', () => {
    const looks: Look[] = ['hero', 'rifleman', 'grenadier', 'warden', 'brute', 'sniper', 'jammer', 'boss', 'hologram'];
    for (const look of looks) {
      const c = new Character(asset, lib, look, look === 'hologram' ? new THREE.MeshBasicMaterial() : undefined);
      c.update(1 / 60, loco({ speed: 2 }));
      expect(c.root.children.length).toBe(1);
      c.dispose();
    }
    const brute = new Character(asset, lib, 'brute');
    expect(brute.scale).toBeCloseTo(1.25);
    const w = new Character(asset, lib, 'warden');
    expect(w.attachments.shield).toBeTruthy();
    expect(new Character(asset, lib, 'hero').attachments.core).toBeTruthy();
    expect(new Character(asset, lib, 'rifleman').attachments.rifle).toBeTruthy();
  });

  it('stands on the floor facing +Z', () => {
    const c = new Character(asset, lib, 'rifleman');
    for (let i = 0; i < 30; i++) c.update(1 / 30, loco());
    const toe = worldPos(c, 'LeftToeBase');
    const heel = worldPos(c, 'LeftFoot');
    const head = worldPos(c, 'Head');
    expect(Math.min(toe.y, heel.y)).toBeGreaterThan(-0.03);
    expect(Math.min(toe.y, heel.y)).toBeLessThan(0.06);
    expect(toe.z).toBeGreaterThan(heel.z); // toes point forward (+Z)
    expect(head.y).toBeGreaterThan(1.4);
    // character's left is +X when facing +Z
    expect(worldPos(c, 'LeftArm').x).toBeGreaterThan(worldPos(c, 'RightArm').x);
  });

  it('does not skate: planted feet stay put while moving', () => {
    for (const [speed, crouch] of [
      [1.14, 0],
      [3.1, 0],
      [6.0, 0],
      [1.9, 1],
    ]) {
      const c = new Character(asset, lib, 'rifleman');
      const dt = 1 / 60;
      let z = 0;
      for (let i = 0; i < 120; i++) {
        z += speed * dt;
        c.root.position.z = z;
        c.update(dt, loco({ speed, crouch }));
      }
      const samples: { y: number; z: number }[] = [];
      for (let i = 0; i < 180; i++) {
        z += speed * dt;
        c.root.position.z = z;
        c.update(dt, loco({ speed, crouch }));
        const l = worldPos(c, 'LeftToeBase');
        samples.push({ y: l.y, z: l.z });
      }
      const minY = Math.min(...samples.map((s) => s.y));
      const v: number[] = [];
      for (let i = 1; i < samples.length; i++) {
        if (samples[i].y < minY + 0.02 && samples[i - 1].y < minY + 0.02) v.push(Math.abs(samples[i].z - samples[i - 1].z) / dt);
      }
      v.sort((a, b) => a - b);
      const median = v[Math.floor(v.length / 2)];
      if (env('SKATE_DEBUG')) console.log(`speed ${speed} crouch ${crouch}: planted toe median ${median.toFixed(3)} m/s over ${v.length} frames`);
      expect(v.length, `stance frames at ${speed}`).toBeGreaterThan(5);
      expect(median, `planted toe speed at ${speed} m/s`).toBeLessThan(Math.max(0.15, speed * 0.05));
    }
  });

  it('getPose/setPose reproduce a frame exactly, without side effects', () => {
    const a = new Character(asset, lib, 'rifleman');
    const b = new Character(asset, lib, 'rifleman');
    const script: [number, Partial<LocomotionInput>, (c: Character) => void][] = [
      [0.4, { speed: 2.5 }, () => {}],
      [0.2, { speed: 3.1, weaponUp: 1 }, (c) => c.play('shoot')],
      [0.3, { speed: 0.5, crouch: 1 }, () => {}],
      [0.25, { speed: 0, grounded: false, vy: -12 }, (c) => c.setTumble(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 1, 0)))],
      [0.4, { speed: 1, aim: 1 }, (c) => (c.setTumble(null), c.play('punch'))],
    ];
    for (const [secs, input, action] of script) {
      action(a);
      for (let t = 0; t < secs; t += 1 / 60) a.update(1 / 60, loco(input));
      const pose = a.getPose();
      b.setPose(JSON.parse(JSON.stringify(pose)) as CharacterPose);
      expect(maxDiff(snapshot(a), snapshot(b))).toBeLessThan(1e-5);
      expect(b.root.children[0].quaternion.toArray()).toEqual(a.root.children[0].quaternion.toArray());
      // no side effects: same pose again, same result; the pose round-trips
      const before = snapshot(b);
      b.setPose(pose);
      expect(maxDiff(before, snapshot(b))).toBe(0);
      expect(b.getPose()).toEqual(pose);
    }
  });

  it('plays one-shot overlays with fade and hold', () => {
    const c = new Character(asset, lib, 'hero');
    c.update(1 / 30, loco());
    c.play('punch', { fade: 0.1 });
    c.update(0.05, loco());
    expect(c.getPose().clip).toBe('punch');
    for (let t = 0; t < lib.info.punch.duration + 0.2; t += 1 / 30) c.update(1 / 30, loco());
    expect(c.getPose().clip).toBeNull();

    c.play('interact', { hold: true });
    for (let t = 0; t < lib.info.interact.duration + 1; t += 1 / 30) c.update(1 / 30, loco());
    let p = c.getPose();
    expect(p.clip).toBe('interact');
    expect(p.clipW).toBe(1);
    expect(p.clipT).toBeCloseTo(lib.info.interact.duration);
    c.stop('punch'); // not the active clip: ignored
    c.update(0.1, loco());
    expect(c.getPose().clip).toBe('interact');
    c.stop();
    for (let t = 0; t < 1; t += 1 / 30) c.update(1 / 30, loco());
    expect(c.getPose().clip).toBeNull();

    c.play('roll', { speed: 2 });
    for (let t = 0; t < lib.info.roll.duration / 2 + 0.1; t += 1 / 30) c.update(1 / 30, loco());
    expect(c.getPose().clip).toBeNull();
  });

  it('dies, freezes and revives', () => {
    const c = new Character(asset, lib, 'rifleman');
    c.update(1 / 30, loco({ speed: 3 }));
    c.die('shot');
    c.play('punch'); // ignored when dead
    for (let t = 0; t < 4; t += 1 / 30) c.update(1 / 30, loco({ speed: 3 }));
    const p = c.getPose();
    expect(p.dead).toBe(true);
    expect(p.deathKind).toBe('shot');
    expect(p.clip).toBe('death');
    expect(worldPos(c, 'Hips').y).toBeLessThan(0.35);
    const still = snapshot(c);
    c.update(1, loco({ speed: 5 }));
    expect(maxDiff(still, snapshot(c))).toBe(0);
    c.revive();
    const r = c.getPose();
    expect(r.dead).toBe(false);
    expect(r.clip).toBeNull();
    expect(r.tumble).toBeNull();
    expect(worldPos(c, 'Hips').y).toBeGreaterThan(0.85);

    for (const kind of ['fall', 'blast', 'cut', 'drown'] as const) {
      const d = new Character(asset, lib, 'grenadier');
      d.die(kind);
      for (let t = 0; t < 3; t += 1 / 30) d.update(1 / 30, loco());
      expect(d.getPose().deathKind).toBe(kind);
      if (kind !== 'drown') expect(worldPos(d, 'Hips').y).toBeLessThan(0.35);
      else expect(d.getPose().clip).toBe('swimIdle');
    }
  });

  it('goes down and gets back up', () => {
    const c = new Character(asset, lib, 'warden');
    for (let t = 0; t < 2.5; t += 1 / 30) c.update(1 / 30, loco({ downed: true }));
    expect(c.getPose().loco.downed).toBe(true);
    expect(worldPos(c, 'Hips').y).toBeLessThan(0.35);
    for (let t = 0; t < 2; t += 1 / 30) c.update(1 / 30, loco({ downed: false }));
    expect(c.getPose().clip).toBeNull();
    expect(worldPos(c, 'Hips').y).toBeGreaterThan(0.85);
  });

  it('tumbles around the hips and blends airborne / swimming', () => {
    const c = new Character(asset, lib, 'hero');
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    c.setTumble(q);
    c.update(0.5, loco({ grounded: false }));
    expect(c.getPose().tumble).toEqual(q.toArray());
    // upside down: head below the hips
    expect(worldPos(c, 'Head').y).toBeLessThan(worldPos(c, 'Hips').y);
    c.setTumble(null);
    for (let t = 0; t < 1; t += 1 / 30) c.update(1 / 30, loco({ swimming: true, speed: 1.2 }));
    expect((c.getPose() as any).swim).toBeGreaterThan(0.95);
  });

  it('aims the gauntlet forward and holds the rifle up', () => {
    const h = new Character(asset, lib, 'hero');
    for (let t = 0; t < 1; t += 1 / 30) h.update(1 / 30, loco({ aim: 1 }));
    const hand = worldPos(h, 'LeftHand');
    const shoulder = worldPos(h, 'LeftArm');
    expect(hand.z - shoulder.z).toBeGreaterThan(0.4);
    expect(Math.abs(hand.y - shoulder.y)).toBeLessThan(0.2);
    expect(h.gauntletPos().z).toBeGreaterThan(0.4);

    const r = new Character(asset, lib, 'rifleman');
    for (let t = 0; t < 1; t += 1 / 30) r.update(1 / 30, loco({ weaponUp: 1, speed: 1.5 }));
    const muzzle = r.muzzlePos();
    const grip = worldPos(r, 'RightHand');
    expect(muzzle.z - grip.z).toBeGreaterThan(0.3);
    expect(muzzle.y).toBeGreaterThan(1.2);
  });
});
