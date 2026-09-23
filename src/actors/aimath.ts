import * as THREE from 'three';
import type { CollisionWorld } from '../world/collision';

/** Small allocation-free math used by the Kessler AI. */

const TAU = Math.PI * 2;

export function wrapAngle(a: number) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** Signed shortest turn from a to b. */
export function angleDiff(a: number, b: number) {
  return wrapAngle(b - a);
}

export function dampAngle(a: number, b: number, lambda: number, dt: number) {
  return a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));
}

/** Turn from a toward b by at most maxStep radians. */
export function stepAngle(a: number, b: number, maxStep: number) {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= maxStep) return wrapAngle(b);
  return wrapAngle(a + Math.sign(d) * maxStep);
}

/** Yaw (0 = +Z) from a toward b. */
export function yawTo(a: THREE.Vector3, b: THREE.Vector3) {
  return Math.atan2(b.x - a.x, b.z - a.z);
}

export function hdist(a: THREE.Vector3, b: THREE.Vector3) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/** |angle| between yaw and the horizontal direction a→b. */
export function offAxis(yaw: number, a: THREE.Vector3, b: THREE.Vector3) {
  return Math.abs(angleDiff(yaw, yawTo(a, b)));
}

/** Launch velocity that carries a point from `from` to `to` in T seconds under gravity g (down). */
export function solveLob(from: THREE.Vector3, to: THREE.Vector3, T: number, g: number, out: THREE.Vector3) {
  return out.set((to.x - from.x) / T, (to.y - from.y) / T + 0.5 * g * T, (to.z - from.z) / T);
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** Samples the lob arc and checks each chord for world hits. */
export function lobClear(world: CollisionWorld, from: THREE.Vector3, vel: THREE.Vector3, T: number, g: number, steps = 5) {
  _a.copy(from);
  for (let i = 1; i <= steps; i++) {
    const t = (T * i) / steps;
    _b.set(from.x + vel.x * t, from.y + vel.y * t - 0.5 * g * t * t, from.z + vel.z * t);
    // the last chord ends at the target's feet: stop short of the floor
    if (i === steps) _b.y += 0.3;
    if (!world.lineOfSight(_a, _b)) return false;
    _a.copy(_b);
  }
  return true;
}

/** Deterministic PRNG (tests and replays stay stable). */
export function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
