import * as THREE from 'three';

// A dog out for its walk, made like the people (rounded parts in one batch): a body and a deep
// chest, a head with a snout, floppy ears, a wagging tail, four legs that trot.

const _c = new THREE.Vector3();
const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const _f = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();
const _x = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const BLACK = [0.06, 0.05, 0.06];

export const DOG_COATS = [
  { body: [0.62, 0.42, 0.24], ear: [0.42, 0.26, 0.15] },
  { body: [0.88, 0.78, 0.58], ear: [0.72, 0.58, 0.38] },
  { body: [0.16, 0.14, 0.14], ear: [0.1, 0.09, 0.09] },
  { body: [0.95, 0.94, 0.9], ear: [0.35, 0.25, 0.18] },
  { body: [0.5, 0.48, 0.5], ear: [0.3, 0.28, 0.3] },
];

export function newDog(x, z, size = 0.8 + Math.random() * 0.4) {
  return { x, z, y: 0.15, yaw: 0, t: Math.random() * 10, speed: 0, moving: 0, wag: 0, size, coat: DOG_COATS[Math.floor(Math.random() * DOG_COATS.length)] };
}

// trot towards (tx, tz) at up to speed
export function steerDog(dog, tx, tz, speed, dt) {
  const dx = tx - dog.x;
  const dz = tz - dog.z;
  const d = Math.hypot(dx, dz);
  dog.t += dt;
  const want = d > 0.25 ? Math.min(speed, d * 2.2) : 0;
  dog.speed += (want - dog.speed) * Math.min(1, dt * 5);
  if (d > 0.05) {
    const a = Math.atan2(dx, dz);
    let da = a - dog.yaw;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    dog.yaw += da * Math.min(1, dt * 6);
  }
  dog.x += Math.sin(dog.yaw) * dog.speed * dt;
  dog.z += Math.cos(dog.yaw) * dog.speed * dt;
  dog.moving = Math.min(1, dog.speed / 1.2);
  dog.wag += dt * (dog.speed > 0.2 ? 9 : 14);
}

// where the leash clips on (the collar)
export function dogCollar(dog, out) {
  const s = dog.size;
  return out.set(dog.x + Math.sin(dog.yaw) * 0.26 * s, dog.y + 0.56 * s, dog.z + Math.cos(dog.yaw) * 0.26 * s);
}

// the dog's parts into the people's batch
export function drawDog(bodies, dog) {
  const s = dog.size;
  const col = dog.coat.body;
  const ear = dog.coat.ear;
  _f.set(Math.sin(dog.yaw), 0, Math.cos(dog.yaw));
  _r.set(_f.z, 0, -_f.x);
  _u.copy(UP);
  const bob = Math.abs(Math.sin(dog.t * 9)) * 0.02 * dog.moving * s;
  const P = (side, up, fwd, out) => out.set(dog.x + _r.x * side * s + _f.x * fwd * s, dog.y + up * s + bob, dog.z + _r.z * side * s + _f.z * fwd * s);
  // the body and the chest
  bodies.blob(P(0, 0.42, -0.04, _c), _r, _u, _f, 0.12 * s, 0.12 * s, 0.27 * s, col);
  bodies.blob(P(0, 0.44, 0.16, _c), _r, _u, _f, 0.12 * s, 0.14 * s, 0.13 * s, col);
  // the neck, the head, the snout and its nose
  bodies.blob(P(0, 0.54, 0.25, _c), _r, _u, _f, 0.075 * s, 0.1 * s, 0.08 * s, col);
  bodies.blob(P(0, 0.64, 0.31, _c), _r, _u, _f, 0.095 * s, 0.09 * s, 0.1 * s, col);
  bodies.blob(P(0, 0.61, 0.42, _c), _r, _u, _f, 0.05 * s, 0.045 * s, 0.075 * s, col);
  bodies.blob(P(0, 0.625, 0.495, _c), _r, _u, _f, 0.022 * s, 0.018 * s, 0.015 * s, BLACK);
  for (const sd of [-1, 1]) {
    bodies.blob(P(sd * 0.04, 0.665, 0.39, _c), _r, _u, _f, 0.013 * s, 0.013 * s, 0.01 * s, BLACK);
    // floppy ears
    _a.copy(_u).multiplyScalar(-1).addScaledVector(_r, sd * 0.3).normalize();
    _x.crossVectors(_a, _f).normalize();
    bodies.blob(P(sd * 0.08, 0.64, 0.29, _c), _x, _a, _f, 0.018 * s, 0.07 * s, 0.045 * s, ear);
  }
  // the tail, wagging
  _a.copy(_u).multiplyScalar(0.75).addScaledVector(_f, -0.6).addScaledVector(_r, Math.sin(dog.wag) * 0.45).normalize();
  _x.crossVectors(_a, _f).normalize();
  _d.crossVectors(_x, _a).normalize();
  P(0, 0.5, -0.3, _b);
  _c.copy(_b).addScaledVector(_a, 0.1 * s);
  bodies.blob(_c, _x, _a, _d, 0.022 * s, 0.11 * s, 0.022 * s, col);
  // the legs, trotting (diagonal pairs together)
  const run = dog.t * 9;
  const legs = [[0.07, 0.17, 0], [-0.07, 0.17, Math.PI], [0.07, -0.22, Math.PI], [-0.07, -0.22, 0]];
  for (const [side, fwd, ph] of legs) {
    const sw = Math.sin(run + ph) * 0.11 * dog.moving;
    const lift = Math.max(0, Math.cos(run + ph)) * 0.05 * dog.moving;
    P(side, 0.38, fwd, _a);
    P(side, 0.02 + lift, fwd + sw, _b);
    _b.y -= bob;
    _c.addVectors(_a, _b).multiplyScalar(0.5);
    _d.subVectors(_a, _b);
    const L = _d.length();
    _d.divideScalar(L || 1);
    _x.crossVectors(_d, _f).normalize();
    if (_x.lengthSq() < 0.5) _x.copy(_r);
    const zz = _a.crossVectors(_x, _d).normalize();
    bodies.blob(_c, _x, _d, zz, 0.032 * s, L / 2 + 0.01 * s, 0.035 * s, col);
    // the paw
    _c.copy(_b).addScaledVector(_f, 0.02 * s);
    _c.y = Math.max(_c.y, dog.y + 0.02 * s);
    bodies.blob(_c, _r, _u, _f, 0.036 * s, 0.022 * s, 0.05 * s, col);
  }
}
