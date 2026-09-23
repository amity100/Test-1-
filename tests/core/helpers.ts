import * as THREE from 'three';
import type { DynBody, ImpactInfo, PhysicsEvents, RiftEnd, RiftEndKind, TrapTarget } from '../../src/core/contracts';
import { CollisionWorld } from '../../src/world/collision';
import { RiftSystem } from '../../src/game/portals';
import { Physics } from '../../src/sim/physics';
import { orientFrame, RiftFrame } from '../../src/game/portalMath';
import { FEEL } from '../../src/config';
import { LAW } from '../../src/core/contracts';

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A world with a big ground slab (top at y = 0). */
export function makeWorld(ground = true) {
  const w = new CollisionWorld();
  if (ground) w.add(V(-60, -2, -60), V(60, 0, 60), { tag: 'ground' });
  return w;
}

export function makeRifts(world: CollisionWorld) {
  return new RiftSystem(new THREE.Scene(), null, world, { portalScale: 0.5, lightCount: 2, maxViews: 2 });
}

export function makePhysics(world: CollisionWorld, rifts: RiftSystem, opts: Partial<{ seaY: number; isSea: (p: THREE.Vector3) => boolean; killYAt: (p: THREE.Vector3) => number }> = {}) {
  return new Physics(world, rifts, { seaY: opts.seaY ?? -1.2, isSea: opts.isSea ?? (() => false), killYAt: opts.killYAt ?? (() => -200) });
}

/** A level-style frame: `normal` is the front; doors are person-sized, flat ends square. */
export function frame(pos: THREE.Vector3, normal: THREE.Vector3, kind: RiftEndKind, upHint = V(0, 0, 1)): RiftFrame & { kind: RiftEndKind } {
  const flat = Math.abs(normal.y) > 0.5;
  return {
    position: pos.clone(),
    quaternion: orientFrame(normal, flat ? upHint : V(0, 1, 0)),
    width: flat ? LAW.floorEndSize : FEEL.portalWidth,
    height: flat ? LAW.floorEndSize : FEEL.portalHeight,
    kind,
  };
}

export interface Log {
  crossed: { b: DynBody; from: RiftEnd; to: RiftEnd; speed: number; vel: THREE.Vector3; loops: number; pos: THREE.Vector3 }[];
  impacts: { b: DynBody; e: ImpactInfo }[];
  touches: { a: DynBody; b: DynBody; rel: number }[];
  splash: DynBody[];
  fellOut: DynBody[];
}

export function recorder(): PhysicsEvents & { log: Log } {
  const log: Log = { crossed: [], impacts: [], touches: [], splash: [], fellOut: [] };
  return {
    log,
    crossed(b, from, to, speed) {
      log.crossed.push({ b, from, to, speed, vel: b.vel.clone(), loops: b.loops, pos: b.pos.clone() });
    },
    impact(b, e) {
      log.impacts.push({ b, e });
    },
    touch(a, b, rel) {
      log.touches.push({ a, b, rel });
    },
    splash(b) {
      log.splash.push(b);
    },
    fellOut(b) {
      log.fellOut.push(b);
    },
  };
}

/** Runs physics for `seconds`; returns the end time. */
export function run(phys: Physics, ev: PhysicsEvents, seconds: number, t0 = 0, dt = 1 / 60, until?: () => boolean) {
  let t = t0;
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    t += dt;
    phys.step(dt, ev, t);
    if (until?.()) break;
  }
  return t;
}

export function target(key: string, pos: THREE.Vector3, o: Partial<TrapTarget> = {}): TrapTarget {
  return { key, pos: pos.clone(), radius: 0.4, height: 1.8, canFall: false, steady: false, ...o };
}
