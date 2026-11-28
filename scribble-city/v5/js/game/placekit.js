import * as THREE from 'three';
import { letter } from '../world/letters.js';

// (ROADMAP 29.5) The little shapes the finds' places are built of (game/places.js), drawn the way the prologue's car park is
// (game/prologue/carpark.js): flat faces turned the way they look, paint laid on floors, lettering a stroke a box, boxes
// turned about the vertical, round beams from a point to a point. Everything goes into a Kit (game/items.js) and is merged
// there, a mesh a pen.

// a growing list of triangles, each face turned the way it looks
export class Tris {
  constructor() {
    this.p = [];
  }

  // a, b, c, d round a face; out: a direction it looks
  quad(a, b, c, d, out) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (nx * out[0] + ny * out[1] + nz * out[2] >= 0) this.p.push(...a, ...b, ...c, ...a, ...c, ...d);
    else this.p.push(...a, ...c, ...b, ...a, ...d, ...c);
  }

  tri(a, b, c, out) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (nx * out[0] + ny * out[1] + nz * out[2] >= 0) this.p.push(...a, ...b, ...c);
    else this.p.push(...a, ...c, ...b);
  }

  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.computeVertexNormals();
    const n = this.p.length / 3;
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    return g;
  }
}

// a flat quad on a floor at height y (corners [x, z] round it), looking up
export function floorQuad(K, mat, color, c, y) {
  const T = new Tris();
  T.quad([c[0][0], y, c[0][1]], [c[1][0], y, c[1][1]], [c[2][0], y, c[2][1]], [c[3][0], y, c[3][1]], [0, 1, 0]);
  K.add(mat, T.geo(), color);
}

// a strip of paint on a floor from (x0, z0) to (x1, z1), w wide
export function floorLine(K, mat, color, x0, z0, x1, z1, w, y) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const L = Math.hypot(dx, dz) || 1;
  const px = (-dz / L) * (w / 2);
  const pz = (dx / L) * (w / 2);
  floorQuad(K, mat, color, [[x0 + px, z0 + pz], [x1 + px, z1 + pz], [x1 - px, z1 - pz], [x0 - px, z0 - pz]], y);
}

// an arc of paint on a floor (a tyre's black mark): centre (cx, cz), radius R, from angle a0 to a1, w wide
export function floorArc(K, mat, color, cx, cz, R, a0, a1, w, y, n = 8) {
  let px = cx + Math.cos(a0) * R;
  let pz = cz + Math.sin(a0) * R;
  for (let i = 1; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const nx = cx + Math.cos(a) * R;
    const nz = cz + Math.sin(a) * R;
    floorLine(K, mat, color, px, pz, nx, nz, w, y);
    px = nx;
    pz = nz;
  }
}

// a disc of paint (a stain) on a floor
export function floorDisc(K, mat, color, cx, cz, r, y, segs = 10, sx = 1, sz = 1) {
  const g = new THREE.CircleGeometry(r, segs).rotateX(-Math.PI / 2);
  g.scale(sx, 1, sz);
  g.translate(cx, y, cz);
  K.add(mat, g, color);
}

// a ring of paint on a floor
export function floorRing(K, mat, color, cx, cz, r0, r1, y, segs = 40) {
  const g = new THREE.RingGeometry(r0, r1, segs).rotateX(-Math.PI / 2);
  g.translate(cx, y, cz);
  K.add(mat, g, color);
}

// words painted on a floor, read by whoever comes along (fx, fz): their foot towards them, centred at (cx, cz)
export function floorWord(K, mat, color, text, size, cx, cz, fx, fz, y) {
  const rx = -fz;
  const rz = fx;
  const T = new Tris();
  letter(text, size, (a0, b0, a1, b1) => {
    const p = (a, b) => [cx + rx * a + fx * (b - size / 2), y, cz + rz * a + fz * (b - size / 2)];
    T.quad(p(a0, b0), p(a1, b0), p(a1, b1), p(a0, b1), [0, 1, 0]);
  });
  if (T.p.length) K.add(mat, T.geo(), color);
}

// an arrow painted on a floor at (cx, cz), pointing along (fx, fz)
export function floorArrow(K, mat, color, cx, cz, fx, fz, y, len = 4.2, w = 0.32) {
  floorLine(K, mat, color, cx - fx * len * 0.5, cz - fz * len * 0.5, cx + fx * len * 0.12, cz + fz * len * 0.12, w, y);
  const tx = cx + fx * len * 0.5;
  const tz = cz + fz * len * 0.5;
  const bx = cx + fx * len * 0.08;
  const bz = cz + fz * len * 0.08;
  const rx = -fz;
  const rz = fx;
  const T = new Tris();
  T.tri([tx, y, tz], [bx + rx * w * 2.4, y, bz + rz * w * 2.4], [bx - rx * w * 2.4, y, bz - rz * w * 2.4], [0, 1, 0]);
  K.add(mat, T.geo(), color);
}

// words on a wall facing (nx, nz), their foot at height y, centred at (cx, cz), d out from it: a flat face a stroke. Its
// length back
export function wallWord(K, mat, color, text, size, cx, y, cz, nx, nz, d = 0.03) {
  const rx = nz;
  const rz = -nx;
  const T = new Tris();
  const len = letter(text, size, (a0, b0, a1, b1) => {
    const p = (a, b) => [cx + rx * a + nx * d, y + b, cz + rz * a + nz * d];
    T.quad(p(a0, b0), p(a1, b0), p(a1, b1), p(a0, b1), [nx, 0, nz]);
  });
  if (T.p.length) K.add(mat, T.geo(), color);
  return len;
}

// the same, each stroke a thin box out from the wall (neon tubes, letters cut from a board): seen from the side too
export function wallLetters(K, mat, color, text, size, cx, y, cz, nx, nz, d0 = 0.02, d1 = 0.08) {
  const rx = nz;
  const rz = -nx;
  return letter(text, size, (a0, b0, a1, b1) => {
    const xa = cx + rx * a0 + nx * d0;
    const xb = cx + rx * a1 + nx * d1;
    const za = cz + rz * a0 + nz * d0;
    const zb = cz + rz * a1 + nz * d1;
    K.box(mat, Math.min(xa, xb), y + b0, Math.min(za, zb), Math.max(xa, xb), y + b1, Math.max(za, zb), color);
  });
}

export function wordLen(text, size) {
  return letter(text, size, () => {});
}

// a box w x h x d about its middle (cx, cy, cz), turned yaw about the vertical (its d along (sin yaw, cos yaw))
export function yawBox(K, mat, cx, cy, cz, w, h, d, yaw, color) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (yaw) g.rotateY(yaw);
  g.translate(cx, cy, cz);
  return K.add(mat, g, color);
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
// a round beam from a to b
export function beam(K, mat, a, b, r, color, segs = 8) {
  _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _v.length();
  const g = new THREE.CylinderGeometry(r, r, len, segs, 1);
  _q.setFromUnitVectors(UP, _v.normalize());
  g.applyQuaternion(_q);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return K.add(mat, g, color);
}

// a flat beam (a box) from a to b, w across (level) and h deep
export function bar(K, mat, a, b, w, h, color) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const L = Math.hypot(dx, dy, dz) || 1;
  const g = new THREE.BoxGeometry(w, h, L);
  // (along z, then pitched and turned to lie from a to b)
  const yaw = Math.atan2(dx, dz);
  const pitch = Math.atan2(dy, Math.hypot(dx, dz));
  g.rotateX(-pitch);
  g.rotateY(yaw);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return K.add(mat, g, color);
}

// a tyre lying on its side (a stack's) or standing (axis 'x' / 'z'), its middle at (x, y, z)
export function tyre(K, mat, x, y, z, R, w, color, axis = 'y', segs = 14) {
  const g = new THREE.CylinderGeometry(R, R, w, segs, 1);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  else if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return K.add(mat, g, color);
}

// a little repeatable dice
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// a frame on the ground: an origin, the way its front looks (fx, fz) - u along to its right, w out of its front. p(u, y, w)
// gives the world point, box(...) the world box of a box in it (both ways round a quarter turn only: fx, fz one of the four)
export function frame(ox, oz, fx, fz) {
  const rx = -fz;
  const rz = fx;
  return {
    ox,
    oz,
    fx,
    fz,
    rx,
    rz,
    p: (u, y, w) => [ox + rx * u + fx * w, y, oz + rz * u + fz * w],
    x: (u, w) => ox + rx * u + fx * w,
    z: (u, w) => oz + rz * u + fz * w,
    box(K, mat, u0, y0, w0, u1, y1, w1, color) {
      const xa = ox + rx * u0 + fx * w0;
      const xb = ox + rx * u1 + fx * w1;
      const za = oz + rz * u0 + fz * w0;
      const zb = oz + rz * u1 + fz * w1;
      return K.box(mat, Math.min(xa, xb), Math.min(y0, y1), Math.min(za, zb), Math.max(xa, xb), Math.max(y0, y1), Math.max(za, zb), color);
    },
    // the world rectangle [x0, z0, x1, z1] of one in it
    rect(u0, w0, u1, w1) {
      const xa = ox + rx * u0 + fx * w0;
      const xb = ox + rx * u1 + fx * w1;
      const za = oz + rz * u0 + fz * w0;
      const zb = oz + rz * u1 + fz * w1;
      return [Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)];
    },
  };
}

// a round part along x, from x0 to x1, its axis at (y, z)
export function cylX(K, mat, r, x0, x1, y, z, color, segs = 14) {
  const g = new THREE.CylinderGeometry(r, r, Math.abs(x1 - x0), segs, 1);
  g.rotateZ(Math.PI / 2);
  g.translate((x0 + x1) / 2, y, z);
  return K.add(mat, g, color);
}
