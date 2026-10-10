import * as THREE from 'three';

// Things doodle people carry around: a cane, a coffee, an umbrella, a pizza box, a bouquet...
// Poses put the hands where the thing needs them; shapes are the solid parts (ray-traced like
// the bodies), strokes the pen lines drawn over them.

const RAINBOW = [[0.92, 0.3, 0.32], [0.98, 0.62, 0.22], [0.98, 0.86, 0.3], [0.42, 0.75, 0.4], [0.35, 0.58, 0.92], [0.62, 0.42, 0.85]];
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _m = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const INK = [0.08, 0.08, 0.1];
const WOOD = [0.38, 0.24, 0.13];
const CARD = [0.78, 0.62, 0.42];
const STEAM = [0.55, 0.55, 0.6];

// held with both hands (the left hand follows the right one's item)
const TWO_HANDED = new Set(['pizzaBox', 'laundry', 'book', 'newspaper', 'dough', 'guitar', 'broom', 'dumbbell']);

export function heldIn(fig, side) {
  if (side === 1) return fig.carry;
  return fig.carryL || (TWO_HANDED.has(fig.carry) ? fig.carry : null);
}

// where the hand goes for this item (body space: x right, y up, z forward); false = swing freely
export function carryPose(fig, item, side, hipY, ny, nz, out) {
  const t = fig.carryT;
  const R = side === 1;
  let x;
  let y;
  let z;
  switch (item) {
    case 'cane':
      if (!R) return false;
      [x, y, z] = [0.2, hipY - 0.06, 0.24];
      break;
    case 'umbrella':
      if (!R) return false;
      [x, y, z] = [0.1, ny - 0.12, 0.22];
      break;
    case 'coffee':
      [x, y, z] = [side * 0.17, hipY + 0.2, 0.24];
      break;
    case 'icecream':
    case 'apple':
      [x, y, z] = [side * 0.12, ny - 0.1, 0.27];
      break;
    case 'flower':
    case 'bouquet':
      [x, y, z] = [side * 0.13, hipY + 0.24, 0.26];
      break;
    case 'balloon':
      [x, y, z] = [side * 0.22, ny - 0.02, 0.14];
      break;
    case 'phone':
      if (!R) return false;
      [x, y, z] = [0.15, ny + 0.13, 0.04];
      break;
    case 'tray':
      if (!R) return false;
      [x, y, z] = [0.26, ny + 0.02, 0.2];
      break;
    case 'leash':
      [x, y, z] = [side * 0.16, hipY + 0.06, 0.32];
      break;
    case 'pizzaBox':
      [x, y, z] = [side * 0.17, hipY + 0.12, 0.3];
      break;
    case 'laundry':
      [x, y, z] = [side * 0.21, hipY + 0.05, 0.27];
      break;
    case 'book':
      [x, y, z] = [side * 0.1, ny - 0.17, 0.3];
      break;
    case 'newspaper':
      [x, y, z] = [side * 0.21, ny - 0.1, 0.32];
      break;
    case 'letters':
      [x, y, z] = [side * 0.17, hipY + 0.22, 0.25];
      break;
    case 'camera':
      if (!R) return false;
      [x, y, z] = [0.1, ny - 0.24, 0.2];
      break;
    case 'dough': {
      // tossing: the hands bounce up as the dough flies
      const k = Math.max(0, Math.sin(t * 4.2));
      [x, y, z] = [side * 0.13, ny + 0.12 + k * 0.22, 0.24];
      break;
    }
    case 'guitar': {
      const strum = Math.sin(t * 9) * 0.04;
      if (R) [x, y, z] = [0.06, hipY + 0.1 + strum, 0.22];
      else [x, y, z] = [-0.4, hipY + 0.26, 0.2];
      break;
    }
    case 'broom': {
      const sw = Math.sin(t * 2.6) * 0.16;
      if (R) [x, y, z] = [0.06 + sw * 0.5, hipY - 0.12, 0.3 + sw];
      else [x, y, z] = [-0.02 + sw * 0.3, hipY + 0.28, 0.22 + sw * 0.4];
      break;
    }
    case 'dumbbell': {
      const k = Math.max(0, Math.sin(t * 3 + (R ? 0 : Math.PI)));
      [x, y, z] = [side * 0.22, hipY + 0.06 + k * 0.38, 0.16 + k * 0.08];
      break;
    }
    default:
      return false;
  }
  fig.toWorld(x, y, z, out);
  return true;
}

// a horizontal frame around the body (keeps umbrellas and trays level when the body leans)
function hframe(fig) {
  _x.copy(fig.right);
  _z.copy(fig.forward);
  return [_x, UP, _z];
}

function handOf(fig, side) {
  return side === 1 ? fig.j.handR : fig.j.handL;
}

function armOk(fig, side) {
  return fig.parts[side === 1 ? 'armR' : 'armL'] > 0.5;
}

export function carryShapes(fig, ax, rgt, fwd, S) {
  for (const side of [1, -1]) {
    const item = side === 1 ? fig.carry : fig.carryL;
    if (!item || !armOk(fig, side)) continue;
    shapesFor(fig, item, side, S);
  }
}

function shapesFor(fig, item, side, S) {
  const part = side === 1 ? 'armR' : 'armL';
  const bone = side === 1 ? 'handR' : 'handL';
  const h = handOf(fig, side);
  const [X, Y, Z] = hframe(fig);
  const e = (c, rx, ry, rz, col) => fig.ellipsoid(part, bone, c, X, Y, Z, rx * S, ry * S, rz * S, col);
  switch (item) {
    case 'umbrella': {
      const col = fig.umbrellaColor || [0.82, 0.22, 0.24];
      _a.copy(h).addScaledVector(UP, 0.9 * S);
      const dome = e(_a, 0.62, 0.3, 0.62, col);
      fig.clip(dome, _b.set(0, -1, 0), _a, 0);
      break;
    }
    case 'coffee':
      _a.copy(h).addScaledVector(UP, -0.01 * S);
      _b.copy(h).addScaledVector(UP, 0.09 * S);
      fig.capsule(part, bone, _a, _b, 0.036 * S, [0.96, 0.95, 0.92]);
      _a.copy(h).addScaledVector(UP, 0.04 * S);
      e(_a, 0.041, 0.022, 0.041, [0.62, 0.42, 0.28]);
      break;
    case 'icecream':
      _a.copy(h).addScaledVector(UP, 0.15 * S);
      e(_a, 0.055, 0.05, 0.055, fig.scoopColor || [0.98, 0.66, 0.74]);
      break;
    case 'apple':
      _a.copy(h).addScaledVector(UP, 0.035 * S).addScaledVector(Z, 0.02 * S);
      e(_a, 0.042, 0.04, 0.042, [0.85, 0.16, 0.16]);
      break;
    case 'flower':
      _a.copy(h).addScaledVector(UP, 0.32 * S);
      e(_a, 0.05, 0.05, 0.05, fig.flowerColor || [0.9, 0.25, 0.35]);
      break;
    case 'bouquet': {
      _a.copy(h).addScaledVector(UP, 0.09 * S);
      e(_a, 0.06, 0.12, 0.06, [0.9, 0.86, 0.7]);
      const cols = [[0.92, 0.25, 0.35], [0.98, 0.8, 0.25], [0.75, 0.4, 0.85], [0.98, 0.55, 0.7], [0.95, 0.95, 0.9]];
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26;
        _a.copy(h).addScaledVector(UP, (0.27 + (i % 2) * 0.05) * S).addScaledVector(X, Math.cos(a) * 0.06 * S).addScaledVector(Z, Math.sin(a) * 0.05 * S);
        e(_a, 0.042, 0.04, 0.042, cols[i]);
      }
      break;
    }
    case 'bag':
      _a.copy(h).addScaledVector(UP, -0.14 * S);
      e(_a, 0.11, 0.15, 0.07, CARD);
      break;
    case 'letters':
      _a.copy(h).addScaledVector(UP, 0.06 * S).addScaledVector(Z, 0.02 * S);
      e(_a, 0.105, 0.065, 0.022, [0.97, 0.95, 0.9]);
      break;
    case 'laundry': {
      if (side !== 1) break;
      _m.addVectors(fig.j.handR, fig.j.handL).multiplyScalar(0.5).addScaledVector(UP, 0.05 * S);
      const b = e(_m, 0.24, 0.11, 0.17, [0.7, 0.55, 0.36]);
      fig.clip(b, _b.set(0, 1, 0), _m, 0.06 * S);
      const cols = [[0.3, 0.5, 0.85], [0.95, 0.95, 0.9], [0.9, 0.4, 0.45]];
      for (let i = 0; i < 3; i++) {
        _a.copy(_m).addScaledVector(UP, 0.08 * S).addScaledVector(X, (i - 1) * 0.11 * S);
        e(_a, 0.08, 0.05, 0.1, cols[i]);
      }
      break;
    }
    case 'tray': {
      _a.copy(h).addScaledVector(UP, 0.05 * S);
      e(_a, 0.19, 0.012, 0.19, [0.72, 0.72, 0.75]);
      for (const k of [-1, 1]) {
        _b.copy(_a).addScaledVector(X, k * 0.07 * S).addScaledVector(UP, 0.01 * S);
        _c.copy(_b).addScaledVector(UP, 0.08 * S);
        fig.capsule(part, bone, _b, _c, 0.032 * S, [0.96, 0.95, 0.92]);
      }
      break;
    }
    case 'dough': {
      if (side !== 1) break;
      const k = Math.max(0, Math.sin(fig.carryT * 4.2));
      _m.addVectors(fig.j.handR, fig.j.handL).multiplyScalar(0.5).addScaledVector(UP, (0.08 + k * 0.5) * S);
      // spinning disc: wobble the axes a little
      const sp = fig.carryT * 9;
      _b.copy(X).multiplyScalar(Math.cos(sp)).addScaledVector(Z, Math.sin(sp));
      _c.copy(Z).multiplyScalar(Math.cos(sp)).addScaledVector(X, -Math.sin(sp));
      fig.ellipsoid(part, bone, _m, _b, UP, _c, 0.19 * S, 0.016 * S, 0.17 * S, [0.97, 0.9, 0.72]);
      break;
    }
    case 'guitar': {
      if (side !== 1) break;
      guitarFrame(fig, S);
      fig.ellipsoid(part, bone, _m, _x, _y, _z, 0.19 * S, 0.15 * S, 0.06 * S, [0.66, 0.38, 0.18]);
      _a.copy(_m).addScaledVector(_x, 0.17 * S);
      fig.ellipsoid(part, bone, _a, _x, _y, _z, 0.12 * S, 0.11 * S, 0.055 * S, [0.66, 0.38, 0.18]);
      _a.copy(_m).addScaledVector(_x, 0.09 * S).addScaledVector(_z, 0.045 * S);
      fig.ellipsoid(part, bone, _a, _x, _y, _z, 0.035 * S, 0.035 * S, 0.01 * S, [0.1, 0.08, 0.06]);
      break;
    }
    case 'dumbbell': {
      for (const k of [-1, 1]) {
        _a.copy(h).addScaledVector(X, k * 0.09 * S);
        e(_a, 0.03, 0.05, 0.05, [0.2, 0.2, 0.24]);
      }
      break;
    }
    case 'phone':
      _a.copy(h).addScaledVector(Z, 0.01 * S);
      e(_a, 0.02, 0.055, 0.03, [0.1, 0.1, 0.12]);
      break;
    case 'camera':
      // a black camera, its lens forward
      _a.copy(h).addScaledVector(Z, 0.02 * S);
      e(_a, 0.065, 0.042, 0.035, [0.12, 0.12, 0.14]);
      _b.copy(_a).addScaledVector(Z, 0.04 * S);
      e(_b, 0.026, 0.026, 0.026, [0.34, 0.34, 0.38]);
      break;
    default:
      break;
  }
}

// the guitar hangs across the belly, neck up to the left hand
function guitarFrame(fig, S) {
  const j = fig.j;
  _m.copy(j.hip).addScaledVector(fig.forward, 0.17 * S).addScaledVector(fig.right, 0.05 * S).addScaledVector(UP, 0.08 * S);
  _x.copy(fig.right).multiplyScalar(-0.85).addScaledVector(UP, 0.45).normalize();
  _z.copy(fig.forward);
  _y.crossVectors(_z, _x).normalize();
}

export function carryStrokes(fig, w) {
  for (const side of [1, -1]) {
    const item = side === 1 ? fig.carry : fig.carryL;
    if (!item || !armOk(fig, side)) continue;
    strokesFor(fig, item, side, w);
  }
}

function line(fig, a, b, col, w, seed) {
  fig.stroke(a, b, col, w, 200 + seed);
}

function strokesFor(fig, item, side, w) {
  const S = fig.scale;
  const h = handOf(fig, side);
  const [X, , Z] = hframe(fig);
  const ink = fig.look.pen.ink;
  const t = fig.carryT;
  const sd = side === 1 ? 0 : 50;
  switch (item) {
    case 'cane': {
      _a.copy(h).addScaledVector(UP, 0.07 * S);
      _b.set(h.x + Z.x * 0.06 * S, fig.pos.y + 0.02, h.z + Z.z * 0.06 * S);
      line(fig, _a, _b, WOOD, w * 2.6, sd + 1);
      // the crook
      let px = _a.x;
      let py = _a.y;
      let pz = _a.z;
      for (let i = 1; i <= 4; i++) {
        const k = (i / 4) * Math.PI;
        _c.copy(h).addScaledVector(UP, 0.07 * S + Math.sin(k) * 0.06 * S).addScaledVector(Z, (1 - Math.cos(k)) * 0.05 * S);
        fig.fr.lineXYZ(px, py, pz, _c.x, _c.y, _c.z, WOOD, w * 2.6, fig.seed + 210 + i, 1, 0.01, 0.004);
        px = _c.x;
        py = _c.y;
        pz = _c.z;
      }
      break;
    }
    case 'umbrella': {
      const top = _a.copy(h).addScaledVector(UP, 1.2 * S);
      _b.copy(h).addScaledVector(UP, -0.1 * S);
      line(fig, _b, top, ink, w * 1.4, sd + 2);
      // J handle
      _c.copy(_b).addScaledVector(UP, -0.05 * S).addScaledVector(X, 0.04 * S);
      line(fig, _b, _c, ink, w * 1.6, sd + 3);
      _d.copy(_c).addScaledVector(UP, 0.04 * S).addScaledVector(X, 0.04 * S);
      line(fig, _c, _d, ink, w * 1.6, sd + 4);
      // ribs and rim
      const cy = h.y + 0.9 * S;
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2;
        const a1 = ((i + 1) / 8) * Math.PI * 2;
        _c.set(h.x + Math.cos(a0) * 0.62 * S, cy, h.z + Math.sin(a0) * 0.62 * S);
        _d.set(h.x + Math.cos(a1) * 0.62 * S, cy, h.z + Math.sin(a1) * 0.62 * S);
        line(fig, _c, _d, ink, w, sd + 5 + i);
        _b.set(h.x + Math.cos(a0) * 0.3 * S, cy + 0.26 * S, h.z + Math.sin(a0) * 0.3 * S);
        line(fig, top.set(h.x, cy + 0.3 * S, h.z), _b, ink, w * 0.7, sd + 15 + i);
        line(fig, _b, _c, ink, w * 0.7, sd + 25 + i);
      }
      break;
    }
    case 'coffee': {
      // lid and a curl of steam
      for (let i = 0; i < 2; i++) {
        let px = h.x + (i - 0.5) * 0.03 * S;
        let py = h.y + 0.12 * S;
        let pz = h.z;
        for (let k = 1; k <= 4; k++) {
          const nx = h.x + (i - 0.5) * 0.03 * S + Math.sin(t * 3 + k * 1.3 + i) * 0.02 * S;
          const ny = h.y + (0.12 + k * 0.045) * S;
          fig.fr.lineXYZ(px, py, pz, nx, ny, pz, STEAM, w * 0.7, fig.seed + 240 + k + i * 5, 0.7 - k * 0.12, 0.01, 0);
          px = nx;
          py = ny;
        }
      }
      break;
    }
    case 'icecream': {
      // the cone: a crisp waffle triangle under the scoop
      _a.copy(h).addScaledVector(UP, 0.11 * S).addScaledVector(X, -0.04 * S);
      _b.copy(h).addScaledVector(UP, 0.11 * S).addScaledVector(X, 0.04 * S);
      _c.copy(h).addScaledVector(UP, -0.06 * S);
      line(fig, _a, _b, [0.86, 0.66, 0.36], w * 3.4, sd + 41);
      _d.lerpVectors(_a, _b, 0.5).lerp(_c, 0.45);
      line(fig, _d, _c, [0.86, 0.66, 0.36], w * 3.2, sd + 42);
      line(fig, _a, _c, ink, w * 0.9, sd + 43);
      line(fig, _b, _c, ink, w * 0.9, sd + 44);
      break;
    }
    case 'flower':
      _a.copy(h).addScaledVector(UP, 0.3 * S);
      line(fig, h, _a, [0.25, 0.55, 0.25], w * 1.3, sd + 45);
      break;
    case 'bouquet':
      for (let i = 0; i < 3; i++) {
        _a.copy(h).addScaledVector(UP, 0.26 * S).addScaledVector(X, (i - 1) * 0.05 * S);
        line(fig, h, _a, [0.25, 0.55, 0.25], w * 1.1, sd + 46 + i);
      }
      break;
    case 'bag':
      _a.copy(h).addScaledVector(UP, -0.02 * S).addScaledVector(X, -0.05 * S);
      _b.copy(h).addScaledVector(UP, -0.02 * S).addScaledVector(X, 0.05 * S);
      line(fig, h, _a, ink, w, sd + 50);
      line(fig, h, _b, ink, w, sd + 51);
      if (fig.bagBread) {
        _a.copy(h).addScaledVector(UP, -0.05 * S).addScaledVector(Z, 0.03 * S);
        _b.copy(_a).addScaledVector(UP, 0.22 * S).addScaledVector(X, 0.04 * S);
        line(fig, _a, _b, [0.86, 0.66, 0.36], w * 3.6, sd + 52);
      }
      break;
    case 'pizzaBox': {
      if (side !== 1) break;
      _m.addVectors(fig.j.handR, fig.j.handL).multiplyScalar(0.5).addScaledVector(UP, 0.03 * S);
      boxStrokes(fig, _m, X, Z, 0.24 * S, 0.24 * S, 0.06 * S, CARD, ink, w);
      // a red logo blob
      _a.copy(_m).addScaledVector(UP, 0.065 * S).addScaledVector(X, -0.05 * S);
      _b.copy(_a).addScaledVector(X, 0.08 * S);
      line(fig, _a, _b, [0.8, 0.2, 0.18], w * 3, 60);
      break;
    }
    case 'book': {
      if (side !== 1) break;
      _m.addVectors(fig.j.handR, fig.j.handL).multiplyScalar(0.5).addScaledVector(Z, 0.02 * S);
      for (const k of [-1, 1]) {
        // two pages tilted up toward the reader
        _a.copy(_m).addScaledVector(X, k * 0.15 * S).addScaledVector(UP, 0.05 * S);
        _b.copy(_m).addScaledVector(UP, -0.02 * S);
        for (let i = 0; i < 4; i++) {
          _c.copy(_a).addScaledVector(UP, (i - 1.5) * 0.04 * S);
          _d.copy(_b).addScaledVector(UP, (i - 1.5) * 0.04 * S);
          line(fig, _c, _d, i === 0 || i === 3 ? ink : [0.97, 0.96, 0.92], i === 0 || i === 3 ? w : w * 4, 62 + i + (k > 0 ? 5 : 0));
        }
      }
      break;
    }
    case 'newspaper': {
      if (side !== 1) break;
      _m.addVectors(fig.j.handR, fig.j.handL).multiplyScalar(0.5).addScaledVector(UP, 0.08 * S);
      for (let i = 0; i < 6; i++) {
        _a.copy(_m).addScaledVector(X, -0.21 * S).addScaledVector(UP, (0.14 - i * 0.055) * S);
        _b.copy(_a).addScaledVector(X, 0.42 * S);
        line(fig, _a, _b, [0.93, 0.92, 0.88], w * 5.5, 70 + i);
      }
      for (let i = 0; i < 5; i++) {
        _a.copy(_m).addScaledVector(X, -0.17 * S).addScaledVector(UP, (0.12 - i * 0.06) * S).addScaledVector(Z, -0.01 * S);
        _b.copy(_a).addScaledVector(X, (i === 0 ? 0.34 : 0.14) * S);
        line(fig, _a, _b, i === 0 ? ink : [0.5, 0.5, 0.55], i === 0 ? w * 1.6 : w * 0.7, 80 + i);
      }
      break;
    }
    case 'laundry':
      break;
    case 'letters': {
      // the bundle's edges, the rubber band round it, the top envelope's flap
      _m.copy(h).addScaledVector(UP, 0.06 * S).addScaledVector(Z, 0.045 * S);
      const hw = 0.1 * S;
      const hh = 0.06 * S;
      for (const [u0, v0, u1, v1] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
        _a.copy(_m).addScaledVector(X, u0 * hw).addScaledVector(UP, v0 * hh);
        _b.copy(_m).addScaledVector(X, u1 * hw).addScaledVector(UP, v1 * hh);
        line(fig, _a, _b, ink, w * 0.8, sd + 140 + u0 + v0 * 2);
      }
      _a.copy(_m).addScaledVector(UP, -hh * 1.05);
      _b.copy(_m).addScaledVector(UP, hh * 1.05);
      line(fig, _a, _b, [0.85, 0.2, 0.2], w * 1.4, sd + 146);
      _a.copy(_m).addScaledVector(X, -hw).addScaledVector(UP, hh);
      _b.copy(_m).addScaledVector(UP, hh * 0.1);
      line(fig, _a, _b, ink, w * 0.6, sd + 147);
      _a.copy(_m).addScaledVector(X, hw).addScaledVector(UP, hh);
      line(fig, _b, _a, ink, w * 0.6, sd + 148);
      break;
    }
    case 'broom': {
      if (side !== 1) break;
      const hl = fig.j.handL;
      _d.subVectors(h, hl).normalize();
      _b.copy(h).addScaledVector(_d, Math.max(0.1, (h.y - fig.pos.y - 0.18) / Math.max(0.2, -_d.y)));
      _b.y = Math.max(_b.y, fig.pos.y + 0.18);
      _a.copy(hl).addScaledVector(_d, -0.1 * S);
      line(fig, _a, _b, WOOD, w * 1.8, 90);
      for (let i = 0; i < 5; i++) {
        _c.copy(_b).addScaledVector(X, (i - 2) * 0.06 * S);
        _c.y = fig.pos.y + 0.02;
        line(fig, _b, _c, [0.86, 0.72, 0.3], w * 1.6, 91 + i);
      }
      break;
    }
    case 'guitar': {
      if (side !== 1) break;
      guitarFrame(fig, S);
      _a.copy(_m).addScaledVector(_x, 0.26 * S);
      _b.copy(_m).addScaledVector(_x, 0.68 * S);
      line(fig, _a, _b, [0.3, 0.18, 0.1], w * 2.6, 100);
      _c.copy(_b).addScaledVector(_x, 0.1 * S);
      line(fig, _b, _c, [0.2, 0.12, 0.08], w * 3.4, 101);
      for (let i = -1; i <= 1; i++) {
        _a.copy(_m).addScaledVector(_y, i * 0.012 * S).addScaledVector(_z, 0.06 * S);
        _b.copy(_a).addScaledVector(_x, 0.7 * S);
        line(fig, _a, _b, [0.85, 0.85, 0.8], w * 0.5, 102 + i);
      }
      break;
    }
    case 'dumbbell':
      _a.copy(h).addScaledVector(X, -0.09 * S);
      _b.copy(h).addScaledVector(X, 0.09 * S);
      line(fig, _a, _b, [0.45, 0.45, 0.5], w * 1.6, sd + 110);
      break;
    case 'pencil': {
      // a big drawing pencil, tip forward along the forearm
      const el = side === 1 ? fig.j.elbowR : fig.j.elbowL;
      _d.subVectors(h, el).normalize();
      _a.copy(h).addScaledVector(_d, -0.1 * S);
      _b.copy(h).addScaledVector(_d, 0.2 * S);
      line(fig, _a, _b, [0.96, 0.78, 0.22], w * 3.6, sd + 120);
      _c.copy(_b).addScaledVector(_d, 0.07 * S);
      line(fig, _b, _c, [0.25, 0.22, 0.2], w * 2, sd + 121);
      _c.copy(_a).addScaledVector(_d, -0.05 * S);
      line(fig, _a, _c, [0.95, 0.6, 0.66], w * 3.6, sd + 122);
      break;
    }
    case 'magicPencil': {
      // a pencil striped in every colour, a twinkle at its tip
      const el = side === 1 ? fig.j.elbowR : fig.j.elbowL;
      _d.subVectors(h, el).normalize();
      for (let i = 0; i < 6; i++) {
        _a.copy(h).addScaledVector(_d, (-0.1 + i * 0.05) * S);
        _b.copy(h).addScaledVector(_d, (-0.05 + i * 0.05) * S);
        line(fig, _a, _b, RAINBOW[i], w * 3.4, sd + 160 + i);
      }
      _a.copy(h).addScaledVector(_d, 0.2 * S);
      _c.copy(_a).addScaledVector(_d, 0.06 * S);
      line(fig, _a, _c, [0.96, 0.84, 0.66], w * 2.2, sd + 167);
      const k = 0.5 + 0.5 * Math.sin(t * 9);
      const s2 = (0.03 + 0.035 * k) * S;
      _a.copy(_c).addScaledVector(UP, s2);
      _b.copy(_c).addScaledVector(UP, -s2);
      line(fig, _a, _b, [1, 0.86, 0.3], w * 1.3, sd + 168);
      _a.copy(_c).addScaledVector(X, s2);
      _b.copy(_c).addScaledVector(X, -s2);
      line(fig, _a, _b, [1, 0.86, 0.3], w * 1.3, sd + 169);
      break;
    }
    case 'eraser': {
      // a pink-and-blue eraser block, rubbing
      const el = side === 1 ? fig.j.elbowR : fig.j.elbowL;
      _d.subVectors(h, el).normalize();
      _a.copy(h).addScaledVector(_d, -0.02 * S);
      _b.copy(h).addScaledVector(_d, 0.07 * S);
      line(fig, _a, _b, [0.95, 0.6, 0.66], w * 6, sd + 125);
      _c.copy(_b).addScaledVector(_d, 0.06 * S);
      line(fig, _b, _c, [0.42, 0.55, 0.88], w * 6, sd + 126);
      break;
    }
    case 'leash':
      if (fig.leashTo) line(fig, h, fig.leashTo, [0.7, 0.2, 0.2], w * 1.1, sd + 130);
      break;
    case 'scissors': {
      const k = Math.abs(Math.sin(t * 10)) * 0.5;
      for (const s of [-1, 1]) {
        _a.copy(h).addScaledVector(UP, s * k * 0.03 * S);
        _b.copy(h).addScaledVector(Z, 0.12 * S).addScaledVector(UP, -s * k * 0.05 * S);
        line(fig, _a, _b, [0.72, 0.74, 0.78], w * 1.3, sd + 140 + s);
      }
      break;
    }
    case 'phone':
      break;
    case 'camera':
      // its strap round the neck
      line(fig, h, fig.j.neck, [0.15, 0.15, 0.18], w * 0.8, sd + 150);
      break;
    default:
      break;
  }
}

// a cardboard box: top face hatched in its colour, edges in ink
function boxStrokes(fig, c, X, Z, hx, hz, hy, col, ink, w) {
  const P = (u, v, y, out) => out.copy(c).addScaledVector(X, u * hx).addScaledVector(Z, v * hz).addScaledVector(UP, y);
  for (let i = 0; i < 4; i++) {
    const v = -0.75 + i * 0.5;
    P(-0.9, v, hy, _a);
    P(0.9, v, hy, _b);
    fig.stroke(_a, _b, col, w * 4.5, 300 + i);
  }
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let i = 0; i < 4; i++) {
    const [u0, v0] = corners[i];
    const [u1, v1] = corners[(i + 1) % 4];
    P(u0, v0, hy, _a);
    P(u1, v1, hy, _b);
    fig.stroke(_a, _b, ink, w, 310 + i);
    P(u0, v0, 0, _a);
    P(u1, v1, 0, _b);
    fig.stroke(_a, _b, col, w * 2.5, 320 + i);
    P(u0, v0, 0, _a);
    P(u0, v0, hy, _b);
    fig.stroke(_a, _b, ink, w * 0.8, 330 + i);
  }
}
