import * as THREE from 'three';
import { makeSurface, srgb, lin3 } from './materials.js';

// The cars of the city: the first boulevard's low sports car (glossy paint full of the sunset, a
// bar of red light across the back), and its family - a sedan, a taxi, a police cruiser with its
// light bar, a van. Every kind of part is one batch for all the cars, so the streets can be full.
//
// A car's own frame: x to the right, y up, z forward (the nose). Its wheels touch y = 0.

function sportsProfile() {
  // side view, x from the tail (0) to the nose (4.5), y up (the first boulevard's car)
  const s = new THREE.Shape();
  s.moveTo(0.06, 0.3);
  s.lineTo(0.0, 0.62);
  s.quadraticCurveTo(0.04, 0.9, 0.38, 0.96);
  s.lineTo(1.2, 1.0);
  s.quadraticCurveTo(1.62, 1.2, 2.05, 1.23);
  s.lineTo(2.6, 1.21);
  s.quadraticCurveTo(2.98, 1.12, 3.38, 0.9);
  s.lineTo(4.22, 0.72);
  s.quadraticCurveTo(4.5, 0.66, 4.52, 0.46);
  s.lineTo(4.44, 0.3);
  s.lineTo(0.06, 0.3);
  return s;
}

function sedanProfile() {
  const s = new THREE.Shape();
  s.moveTo(0.08, 0.32);
  s.lineTo(0.02, 0.75);
  s.quadraticCurveTo(0.05, 0.98, 0.4, 1.02);
  s.lineTo(1.05, 1.06);
  s.lineTo(1.45, 1.52);
  s.lineTo(2.85, 1.54);
  s.lineTo(3.4, 1.08);
  s.lineTo(4.25, 0.98);
  s.quadraticCurveTo(4.55, 0.92, 4.56, 0.6);
  s.lineTo(4.48, 0.32);
  s.lineTo(0.08, 0.32);
  return s;
}

function vanProfile() {
  const s = new THREE.Shape();
  s.moveTo(0.06, 0.34);
  s.lineTo(0.02, 2.0);
  s.quadraticCurveTo(0.05, 2.12, 0.3, 2.14);
  s.lineTo(3.55, 2.14);
  s.quadraticCurveTo(3.95, 2.1, 4.2, 1.35);
  s.lineTo(4.62, 1.1);
  s.quadraticCurveTo(4.74, 1.0, 4.74, 0.7);
  s.lineTo(4.66, 0.34);
  s.lineTo(0.06, 0.34);
  return s;
}

// side windows of each kind (in the profile's own x / y)
function sideWindow(kind) {
  const w = new THREE.Shape();
  if (kind === 'sports') {
    w.moveTo(1.35, 1.0);
    w.quadraticCurveTo(1.7, 1.15, 2.05, 1.17);
    w.lineTo(2.55, 1.16);
    w.quadraticCurveTo(2.88, 1.08, 3.2, 0.92);
    w.lineTo(1.35, 0.94);
  } else if (kind === 'van') {
    w.moveTo(0.4, 1.35);
    w.lineTo(0.4, 1.95);
    w.lineTo(3.5, 1.95);
    w.lineTo(3.85, 1.4);
    w.lineTo(0.4, 1.35);
  } else {
    w.moveTo(1.2, 1.1);
    w.lineTo(1.55, 1.47);
    w.lineTo(2.8, 1.48);
    w.lineTo(3.25, 1.1);
    w.lineTo(1.2, 1.1);
  }
  return w;
}

const KINDS = {
  sports: { profile: sportsProfile, len: 4.52, W: 1.95, wheels: [0.82, 3.62], r: 0.36, screen: [3.36, 0.91, 2.62, 1.215], rear: [2.0, 1.225, 1.24, 1.005], tailY: 0.78, headY: 0.6 },
  sedan: { profile: sedanProfile, len: 4.56, W: 1.9, wheels: [0.9, 3.65], r: 0.36, screen: [3.38, 1.1, 2.84, 1.52], rear: [1.46, 1.51, 1.08, 1.08], tailY: 0.86, headY: 0.74 },
  van: { profile: vanProfile, len: 4.74, W: 2.0, wheels: [0.85, 3.85], r: 0.38, screen: [4.18, 1.38, 3.58, 2.08], rear: null, tailY: 0.9, headY: 0.8 },
};

// the colours of the city's cars (sRGB), and which kinds they come in
export const CAR_COLORS = [
  [0.42, 0.18, 0.6], [0.86, 0.12, 0.16], [0.95, 0.95, 0.96], [0.1, 0.55, 0.62], [1.0, 0.75, 0.25], [0.2, 0.22, 0.3],
  [0.98, 0.45, 0.62], [0.3, 0.75, 0.55], [0.35, 0.5, 0.92], [0.98, 0.62, 0.3], [0.62, 0.86, 0.95], [0.85, 0.85, 0.82],
];

export const TAXI_YELLOW = [1.0, 0.78, 0.18];
const VAN_COLORS = [[0.95, 0.95, 0.96], [0.62, 0.86, 0.95], [1.0, 0.75, 0.25], [0.86, 0.12, 0.16], [0.3, 0.75, 0.55], [0.35, 0.5, 0.92]];

// what drives around the city: mostly sedans, taxis, some vans and low sports cars
export function randomCarSpec(r = Math.random) {
  const pickR = (l) => l[Math.floor(r() * l.length)];
  const k = r();
  if (k < 0.22) return { kind: 'sedan', color: TAXI_YELLOW, taxi: true };
  if (k < 0.36) return { kind: 'sports', color: pickR(CAR_COLORS) };
  if (k < 0.5) return { kind: 'van', color: pickR(VAN_COLORS) };
  return { kind: 'sedan', color: pickR(CAR_COLORS) };
}

function build(kind) {
  const K = KINDS[kind];
  const off = K.len / 2;
  const Wd = K.W;
  const ext = new THREE.ExtrudeGeometry(K.profile(), { depth: Wd - 0.3, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.08, bevelSegments: 3, curveSegments: 10 });
  ext.translate(-off, 0, -(Wd - 0.3) / 2);
  // profile x -> forward (z), extrude depth -> across (x)
  const toCar = new THREE.Matrix4().makeRotationY(-Math.PI / 2);
  ext.applyMatrix4(toCar);
  const body = ext.toNonIndexed();
  const glassParts = [];
  for (const sd of [-1, 1]) {
    const g = new THREE.ShapeGeometry(sideWindow(kind));
    g.translate(-off, 0, 0);
    if (sd < 0) g.scale(1, 1, -1);
    g.translate(0, 0, sd * (Wd / 2 + 0.01));
    g.applyMatrix4(toCar);
    glassParts.push(g.toNonIndexed());
  }
  const slopeQuad = (xa, ya, xb, yb, half) => {
    const nx = yb - ya;
    const ny = -(xb - xa);
    const l = Math.hypot(nx, ny);
    const n = [nx / l, ny / l];
    const o = 0.02;
    const A = [xa - off + n[0] * o, ya + n[1] * o];
    const Bp = [xb - off + n[0] * o, yb + n[1] * o];
    const pos = [A[0], A[1], -half, Bp[0], Bp[1], -half, Bp[0], Bp[1], half, A[0], A[1], -half, Bp[0], Bp[1], half, A[0], A[1], half];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 2, 3, 4, 5].flatMap(() => [n[0], n[1], 0]), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
    g.applyMatrix4(toCar);
    return g;
  };
  glassParts.push(slopeQuad(K.screen[0], K.screen[1], K.screen[2], K.screen[3], Wd / 2 - 0.22));
  if (K.rear) glassParts.push(slopeQuad(K.rear[0], K.rear[1], K.rear[2], K.rear[3], Wd / 2 - 0.3));
  const glass = merge(glassParts);
  // the bar of red light across the tail, the headlamps
  const tail = new THREE.BoxGeometry(Wd - 0.35, 0.08, 0.06);
  tail.translate(0, K.tailY, -off - 0.01);
  const heads = [];
  for (const sd of [-1, 1]) {
    const h = new THREE.BoxGeometry(0.38, 0.06, 0.1);
    h.rotateX(0.4);
    h.translate(sd * 0.62, K.headY, off - 0.06);
    heads.push(h.toNonIndexed());
  }
  const wheels = K.wheels.flatMap((x) => [-1, 1].map((sd) => ({ z: x - off, x: sd * (Wd / 2 - 0.12), r: K.r, sd })));
  return { body, glass, tail: tail.toNonIndexed(), head: merge(heads), wheels, K };
}

function merge(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  let k = 0;
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.attributes.normal) g.computeVertexNormals();
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, k * 3);
    nor.set(g.attributes.normal.array, k * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, k * 2);
    k += c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

class Pool {
  constructor(scene, geo, mat, cap) {
    this.cap = cap;
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.aId) g.setAttribute('aId', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    this.iX = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iX', this.iX);
    g.setAttribute('iClip', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4));
    this.mesh = new THREE.InstancedMesh(g, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3).setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.userData.dynamic = true;
    scene.add(this.mesh);
    this.n = 0;
  }

  push(m, color, part = 0) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    m.toArray(this.mesh.instanceMatrix.array, i * 16);
    const c = this.mesh.instanceColor.array;
    c[i * 3] = color[0];
    c[i * 3 + 1] = color[1];
    c[i * 3 + 2] = color[2];
    this.iX.array[i * 4 + 1] = part;
  }

  end() {
    this.mesh.count = this.n;
    for (const at of [this.mesh.instanceMatrix, this.mesh.instanceColor, this.iX]) {
      at.clearUpdateRanges();
      at.addUpdateRange(0, Math.max(1, this.n) * at.itemSize);
      at.needsUpdate = true;
    }
    this.n = 0;
  }
}

const _m = new THREE.Matrix4();
const _w = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const WHITE = [1, 1, 1];

export class CarRenderer {
  constructor(scene) {
    const S = (o) => makeSurface(o);
    const mats = {
      paint: S({ kind: 'paint', gloss: 0.55, ang: 0.1 }),
      glass: S({ kind: 'glass', color: srgb(0.14, 0.13, 0.24), gloss: 0.95, lit: 0, line: 0.8, side: THREE.DoubleSide }),
      tyre: S({ kind: 'cyl', color: srgb(0.08, 0.07, 0.1), partR: 0.36, line: 0.9 }),
      rim: S({ kind: 'box', color: srgb(0.75, 0.75, 0.8), gloss: 0.5 }),
      tail: S({ kind: 'neon', color: srgb(1, 0.15, 0.2), emissive: new THREE.Color(5.0, 0.25, 0.3), line: 0.5 }),
      head: S({ kind: 'neon', color: srgb(1, 0.95, 0.85), emissive: new THREE.Color(3.2, 3.0, 2.6), line: 0.5 }),
      light: S({ kind: 'neon', color: srgb(1, 1, 1), emissive: new THREE.Color(3.0, 3.0, 3.0), emVColor: true, line: 0.4 }),
      trim: S({ kind: 'box', gloss: 0.3 }),
    };
    this.mats = mats;
    const cap = 140;
    this.kinds = {};
    for (const kind of Object.keys(KINDS)) {
      const b = build(kind);
      this.kinds[kind] = {
        b,
        body: new Pool(scene, b.body, mats.paint, cap),
        glass: new Pool(scene, b.glass, mats.glass, cap),
        tail: new Pool(scene, b.tail, mats.tail, cap),
        head: new Pool(scene, b.head, mats.head, cap),
      };
    }
    const tyre = new THREE.CylinderGeometry(1, 1, 0.3, 16).rotateZ(Math.PI / 2);
    const rim = new THREE.CylinderGeometry(0.66, 0.66, 0.02, 12).rotateZ(Math.PI / 2);
    this.tyres = new Pool(scene, tyre, mats.tyre, cap * 4);
    this.rims = new Pool(scene, rim, mats.rim, cap * 4);
    // a taxi's sign, a police car's light bar and its stripe, a van's roof rack
    this.lightBox = new Pool(scene, new THREE.BoxGeometry(1, 1, 1), mats.light, cap * 3);
    this.trimBox = new Pool(scene, new THREE.BoxGeometry(1, 1, 1), mats.trim, cap * 4);
    this.paintColor = new Map();
  }

  col(c) {
    const key = c.join(',');
    let v = this.paintColor.get(key);
    if (!v) {
      v = lin3(c[0], c[1], c[2]);
      this.paintColor.set(key, v);
    }
    return v;
  }

  /**
   * One car: kind (sports | sedan | van), its colour (sRGB), where it is and where it points.
   * o: { spin (wheel angle), steer, extra: 'taxi' | 'police', siren: 0..1 blink phase, scale,
   *      lift (bounce), tilt, roll }
   */
  draw(kind, color, x, y, z, yaw, o = {}) {
    const P = this.kinds[kind] || this.kinds.sedan;
    const K = P.b.K;
    const s = o.scale || 1;
    _e.set(o.tilt || 0, yaw, o.roll || 0, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y + (o.lift || 0), z), _q, _s.set(s, s * (o.squash || 1), s));
    const part = ((Math.abs(x * 0.37 + z * 0.11) % 1) + 1) % 1;
    P.body.push(_m, this.col(color), part);
    P.glass.push(_m, WHITE, part + 0.3);
    P.tail.push(_m, WHITE, part + 0.5);
    P.head.push(_m, WHITE, part + 0.6);
    // the wheels: they roll, the front ones steer
    for (const w of P.b.wheels) {
      _e.set(o.spin || 0, w.z > 0 ? o.steer || 0 : 0, 0, 'YXZ');
      _q.setFromEuler(_e);
      _w.compose(_p.set(w.x, w.r, w.z), _q, _s.set(1, w.r, w.r));
      _w.premultiply(_m);
      this.tyres.push(_w, WHITE, part + 0.7);
      _w.compose(_p.set(w.x + w.sd * 0.165, w.r, w.z), _q, _s.set(1, w.r, w.r));
      _w.premultiply(_m);
      this.rims.push(_w, WHITE, part + 0.8);
    }
    const top = kind === 'van' ? 2.14 : kind === 'sports' ? 1.23 : 1.54;
    if (o.extra === 'taxi') {
      this.box(this.lightBox, _m, 0, top + 0.13, -0.1, 0.8, 0.24, 0.3, [1.4, 1.2, 0.4]);
    } else if (o.extra === 'police') {
      const blink = o.siren !== undefined ? o.siren : -1;
      const red = blink < 0 ? [0.5, 0.06, 0.08] : blink ? [3.2, 0.25, 0.3] : [0.5, 0.06, 0.08];
      const blue = blink < 0 ? [0.08, 0.12, 0.5] : blink ? [0.08, 0.12, 0.5] : [0.3, 0.5, 3.2];
      this.box(this.lightBox, _m, -0.32, top + 0.1, -0.15, 0.6, 0.16, 0.3, red);
      this.box(this.lightBox, _m, 0.32, top + 0.1, -0.15, 0.6, 0.16, 0.3, blue);
      // the black stripe along the doors (the car itself is white)
      for (const sd of [-1, 1]) this.box(this.trimBox, _m, sd * (K.W / 2 + 0.08), 0.62, 0, 0.04, 0.32, K.len * 0.62, [0.04, 0.05, 0.1]);
    } else if (kind === 'van' && o.extra !== 'plain') {
      this.box(this.trimBox, _m, 0, top + 0.06, -0.3, K.W * 0.8, 0.06, K.len * 0.55, [0.25, 0.25, 0.3]);
    }
  }

  box(pool, base, x, y, z, w, h, d, color) {
    _w.makeScale(w, h, d).setPosition(x, y, z);
    _w.premultiply(base);
    pool.push(_w, color);
  }

  end() {
    for (const P of Object.values(this.kinds)) for (const k of ['body', 'glass', 'tail', 'head']) P[k].end();
    this.tyres.end();
    this.rims.end();
    this.lightBox.end();
    this.trimBox.end();
  }
}

export { KINDS };
