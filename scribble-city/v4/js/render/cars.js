import * as THREE from 'three';
import { makeSurface, srgb, lin3 } from './materials.js';

// The cars of the city: the first boulevard's low sports car (glossy paint full of the sunset, a
// bar of red light across the back), and its family - a sedan, a taxi, a police cruiser with its
// light bar, a van. Every kind of part is one batch for all the cars, so the streets can be full.
//
// A car's own frame: x to the right, y up, z forward (the nose). Its wheels touch y = 0.

// ---- the shapes: every car is lofted from cross-sections along its length, the way a real body
// is drawn - a lower body (sills, wheel arches, the hood and the deck) and a glasshouse on top
// of it (the windscreen, the side windows and their pillars, the rear glass, a painted roof).
// t runs along the car from the tail (0) to the nose (1).

// a smooth curve through [t, value] knots (Catmull-Rom, the ends held)
function curve(knots) {
  return (t) => {
    const n = knots.length;
    if (t <= knots[0][0]) return knots[0][1];
    if (t >= knots[n - 1][0]) return knots[n - 1][1];
    let i = 1;
    while (knots[i][0] < t) i++;
    const p0 = knots[Math.max(0, i - 2)];
    const p1 = knots[i - 1];
    const p2 = knots[i];
    const p3 = knots[Math.min(n - 1, i + 1)];
    const k = (t - p1[0]) / (p2[0] - p1[0]);
    const d1 = ((p2[1] - p0[1]) / Math.max(1e-6, p2[0] - p0[0])) * (p2[0] - p1[0]);
    const d2 = ((p3[1] - p1[1]) / Math.max(1e-6, p3[0] - p1[0])) * (p2[0] - p1[0]);
    const k2 = k * k;
    const k3 = k2 * k;
    return (2 * k3 - 3 * k2 + 1) * p1[1] + (k3 - 2 * k2 + k) * d1 + (-2 * k3 + 3 * k2) * p2[1] + (k3 - k2) * d2;
  };
}

const se = (c, n) => Math.sign(c) * Math.pow(Math.abs(c), 2 / n);

const KINDS = {
  // a low sports coupe, wide over its rear wheels, a long nose, a bar of red light across the tail
  sports: {
    len: 4.55, W: 1.98, r: 0.35, wheels: [0.2, 0.79], clear: 0.22, n: 3.4,
    halfW: [[0, 0.8], [0.06, 0.95], [0.2, 0.99], [0.36, 0.97], [0.6, 0.94], [0.79, 0.96], [0.93, 0.9], [1, 0.7]],
    belt: [[0, 0.6], [0.04, 0.8], [0.16, 0.86], [0.3, 0.84], [0.6, 0.8], [0.8, 0.7], [0.95, 0.6], [1, 0.48]],
    glass: { tA: 0.17, tB: 0.36, tC: 0.5, tD: 0.66, R: 1.16, w0: 0.9, w1: 0.64, pillars: [0.43] },
    tail: { y: -0.13, w: 0.92 }, head: { y: -0.1, w: 0.36, h: 0.07 },
  },
  sedan: {
    len: 4.75, W: 1.86, r: 0.34, wheels: [0.19, 0.8], clear: 0.25, n: 3.2,
    halfW: [[0, 0.82], [0.05, 0.91], [0.2, 0.93], [0.5, 0.93], [0.8, 0.93], [0.95, 0.88], [1, 0.76]],
    belt: [[0, 0.84], [0.04, 0.97], [0.22, 1.0], [0.3, 0.98], [0.66, 0.94], [0.85, 0.9], [0.97, 0.84], [1, 0.7]],
    glass: { tA: 0.21, tB: 0.33, tC: 0.56, tD: 0.69, R: 1.47, w0: 0.92, w1: 0.72, pillars: [0.45] },
    tail: { y: -0.12, w: 0.9 }, head: { y: -0.1, w: 0.4, h: 0.08 },
  },
  suv: {
    len: 4.8, W: 1.95, r: 0.38, wheels: [0.19, 0.81], clear: 0.34, n: 4,
    halfW: [[0, 0.88], [0.05, 0.96], [0.5, 0.97], [0.9, 0.95], [1, 0.85]],
    belt: [[0, 0.98], [0.04, 1.1], [0.3, 1.12], [0.72, 1.08], [0.9, 1.02], [1, 0.86]],
    glass: { tA: 0.03, tB: 0.08, tC: 0.61, tD: 0.72, R: 1.8, w0: 0.94, w1: 0.84, pillars: [0.24, 0.47] },
    tail: { y: -0.16, w: 0.86 }, head: { y: -0.12, w: 0.4, h: 0.1 },
  },
  // a delivery van: the box behind, the cab in front
  van: {
    len: 5.0, W: 2.0, r: 0.36, wheels: [0.17, 0.82], clear: 0.3, n: 5,
    halfW: [[0, 0.98], [0.03, 1.0], [0.85, 1.0], [0.95, 0.94], [1, 0.84]],
    belt: [[0, 2.06], [0.02, 2.12], [0.56, 2.12], [0.585, 1.25], [0.75, 1.2], [0.88, 1.12], [0.97, 1.0], [1, 0.84]],
    glass: { tA: 0.6, tB: 0.62, tC: 0.73, tD: 0.86, R: 2.12, w0: 0.99, w1: 0.95, pillars: [] },
    tail: { y: -1.3, w: 0.8, low: 0.95 }, head: { y: -0.12, w: 0.42, h: 0.1 },
  },
  // a city bus: a long box, a band of windows along each side, a big windscreen
  bus: {
    len: 11.6, W: 2.5, r: 0.5, wheels: [0.2, 0.82], clear: 0.32, n: 6,
    halfW: [[0, 1.2], [0.01, 1.25], [0.99, 1.25], [1, 1.2]],
    belt: [[0, 1.2], [0.01, 1.28], [0.99, 1.28], [1, 1.2]],
    glass: { tA: 0.004, tB: 0.012, tC: 0.975, tD: 0.997, R: 3.05, w0: 1.0, w1: 0.99, pillars: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.85], frame: 0.06 },
    tail: { y: -0.4, w: 0.8, low: 0.7 }, head: { y: -0.4, w: 0.36, h: 0.12 },
  },
};

// the colours of the city's cars (sRGB), and which kinds they come in
export const CAR_COLORS = [
  [0.42, 0.18, 0.6], [0.86, 0.12, 0.16], [0.95, 0.95, 0.96], [0.1, 0.55, 0.62], [1.0, 0.75, 0.25], [0.2, 0.22, 0.3],
  [0.98, 0.45, 0.62], [0.3, 0.75, 0.55], [0.35, 0.5, 0.92], [0.98, 0.62, 0.3], [0.62, 0.86, 0.95], [0.85, 0.85, 0.82],
  [0.08, 0.08, 0.1], [0.55, 0.56, 0.6],
];

export const TAXI_YELLOW = [1.0, 0.78, 0.18];
const VAN_COLORS = [[0.95, 0.95, 0.96], [0.62, 0.86, 0.95], [1.0, 0.75, 0.25], [0.86, 0.12, 0.16], [0.3, 0.75, 0.55], [0.35, 0.5, 0.92]];

// what drives around the city: sedans, taxis, SUVs, some vans and low sports cars
export function randomCarSpec(r = Math.random) {
  const pickR = (l) => l[Math.floor(r() * l.length)];
  const k = r();
  if (k < 0.18) return { kind: 'sedan', color: TAXI_YELLOW, taxi: true };
  if (k < 0.33) return { kind: 'sports', color: pickR(CAR_COLORS) };
  if (k < 0.44) return { kind: 'van', color: pickR(VAN_COLORS) };
  if (k < 0.62) return { kind: 'suv', color: pickR(CAR_COLORS) };
  return { kind: 'sedan', color: pickR(CAR_COLORS) };
}

// the body below the windows: closed rounded sections (sills, wheel arches, hood, deck)
function lowerBody(K) {
  const L = K.len;
  const hw = curve(K.halfW);
  const belt = curve(K.belt);
  const arch = (z) => {
    let b = K.clear;
    for (const t of K.wheels) {
      const dz = (z - (t * L - L / 2)) / (K.r * 1.22);
      if (Math.abs(dz) < 1) b = Math.max(b, K.r * 1.12 * Math.sqrt(1 - dz * dz) + K.r * 0.15);
    }
    return b;
  };
  // the sections: closer together round the wheels, so the arches come out round
  const ts = [];
  for (let i = 0; i <= 44; i++) ts.push(i / 44);
  for (const t of K.wheels) for (let k = -6; k <= 6; k++) ts.push(t + (k / 6) * ((K.r * 1.3) / L));
  ts.sort((a, b) => a - b);
  const uniq = ts.filter((t, i) => t >= 0 && t <= 1 && (i === 0 || t - ts[i - 1] > 1e-4));
  const N = 22;
  const pos = [];
  for (const t of uniq) {
    const z = t * L - L / 2;
    const a = hw(t);
    const top = belt(t);
    const bot = Math.min(arch(z), top - 0.08);
    const yc = (top + bot) / 2;
    const hb = (top - bot) / 2;
    for (let k = 0; k < N; k++) {
      const th = (k / N) * Math.PI * 2;
      // (a little narrower at the sills than at the shoulder)
      const yy = Math.sin(th);
      const x = a * se(Math.cos(th), K.n) * (yy < 0 ? 1 - 0.06 * -yy : 1);
      pos.push(x, yc + hb * se(yy, K.n), z);
    }
  }
  const idx = [];
  const S = uniq.length;
  for (let i = 0; i + 1 < S; i++) {
    for (let k = 0; k < N; k++) {
      const a = i * N + k;
      const b = i * N + ((k + 1) % N);
      const c = (i + 1) * N + k;
      const d = (i + 1) * N + ((k + 1) % N);
      idx.push(a, b, c, b, d, c);
    }
  }
  // the end caps
  const cap = (i, flip) => {
    const c = pos.length / 3;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let k = 0; k < N; k++) {
      cx += pos[(i * N + k) * 3];
      cy += pos[(i * N + k) * 3 + 1];
      cz += pos[(i * N + k) * 3 + 2];
    }
    pos.push(cx / N, cy / N, cz / N + (flip ? 0.04 : -0.04));
    for (let k = 0; k < N; k++) {
      const a = i * N + k;
      const b = i * N + ((k + 1) % N);
      if (flip) idx.push(c, a, b);
      else idx.push(c, b, a);
    }
  };
  cap(0, false);
  cap(S - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// the glasshouse: one surface from sill to sill over the roof; its quads go to the glass or to
// the paint (the roof, the frames round the windows, the pillars)
function glassHouse(K) {
  const L = K.len;
  const G = K.glass;
  const hw = curve(K.halfW);
  const belt = curve(K.belt);
  const roofAt = (t) => {
    if (t <= G.tA || t >= G.tD) return 0;
    if (t < G.tB) {
      const k = (t - G.tA) / (G.tB - G.tA);
      return Math.sin(k * Math.PI * 0.5);
    }
    if (t > G.tC) {
      const k = (G.tD - t) / (G.tD - G.tC);
      return Math.sin(k * Math.PI * 0.5);
    }
    return 1;
  };
  const NT = 26;
  const NH = 14;
  const ts = [];
  for (let i = 0; i <= NT; i++) ts.push(G.tA + ((G.tD - G.tA) * i) / NT);
  const pos = [];
  const tw = 0.36; // the band of side windows: theta from 0 up to tw (and its mirror)
  for (const t of ts) {
    const z = t * L - L / 2;
    const yb = belt(t) - 0.04;
    const yr = Math.max(yb + 0.02, yb + (G.R - yb) * roofAt(t));
    const h = yr - yb;
    const a = hw(t);
    for (let j = 0; j <= NH; j++) {
      const th = (j / NH) * Math.PI;
      const sy = Math.pow(Math.abs(Math.sin(th)), 2 / 3);
      const y = yb + h * sy;
      const w = a * (G.w0 + (G.w1 - G.w0) * sy);
      pos.push(w * se(Math.cos(th), 3), y, z);
    }
  }
  const glass = [];
  const paint = [];
  const frames = [];
  const fr = G.frame || 0.035;
  for (let i = 0; i < NT; i++) {
    const tm = (ts[i] + ts[i + 1]) / 2;
    for (let j = 0; j < NH; j++) {
      const thm = ((j + 0.5) / NH) * Math.PI;
      const side = thm < Math.PI * tw || thm > Math.PI * (1 - tw);
      const roof = tm > G.tB + 0.01 && tm < G.tC - 0.01 && !side;
      // the frame along the top of the side windows, the pillars between them
      const edge = Math.abs(thm - Math.PI * tw) < Math.PI / NH * 0.6 || Math.abs(thm - Math.PI * (1 - tw)) < Math.PI / NH * 0.6;
      const pillar = side && (G.pillars || []).some((p) => Math.abs(tm - p) < fr * 0.5);
      const sill = j === 0 || j === NH - 1;
      const a = i * (NH + 1) + j;
      const b = a + 1;
      const c = a + NH + 1;
      const d = c + 1;
      // (the roof in the body's colour, the frames round the glass in black trim)
      (roof ? paint : edge || pillar || sill ? frames : glass).push(a, b, c, b, d, c);
    }
  }
  const make = (idx) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g.toNonIndexed();
  };
  return { glass: make(glass), roof: make(paint), frames: make(frames) };
}

const box = (w, h, d, x, y, z, rx = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  return g.toNonIndexed();
};

function build(kind) {
  const K = KINDS[kind];
  const L = K.len;
  const off = L / 2;
  const hw = curve(K.halfW);
  const belt = curve(K.belt);
  const lower = lowerBody(K).toNonIndexed();
  const gh = glassHouse(K);
  const body = merge([lower, gh.roof]);
  // the lamps: a bar of red light across the tail, the headlamps, a grille, the plates, mirrors
  const tb = belt(0.02);
  const tailY = (K.tail.low !== undefined ? K.tail.low : tb + K.tail.y);
  const tail = box(hw(0.02) * 2 * K.tail.w, 0.07, 0.05, 0, tailY, -off + 0.015);
  const heads = [];
  const hb = belt(0.98);
  for (const sd of [-1, 1]) heads.push(box(K.head.w, K.head.h, 0.08, sd * (hw(0.98) - K.head.w / 2 - 0.1), hb + K.head.y, off - 0.03, 0.3));
  const trimParts = [gh.frames];
  // the grille and the bumpers' dark lips
  trimParts.push(box(hw(1) * 1.1, Math.min(0.16, hb * 0.25), 0.04, 0, hb * 0.55, off + 0.005));
  trimParts.push(box(hw(1) * 1.5, 0.06, 0.06, 0, K.clear + 0.06, off - 0.02));
  trimParts.push(box(hw(0) * 1.5, 0.06, 0.06, 0, K.clear + 0.06, -off + 0.02));
  // the wheel wells: dark under the arches, so you never see through under a fender
  for (const t of K.wheels) {
    const z = t * L - off;
    const top = K.r * 1.27 + K.r * 0.12;
    const inset = hw(t) - 0.34;
    trimParts.push(box(inset * 2, top - K.clear + 0.06, K.r * 2.5, 0, (top + K.clear) / 2, z));
  }
  // the mirrors at the foot of the windscreen
  if (kind !== 'bus') {
    const tm = K.glass.tD - 0.01;
    for (const sd of [-1, 1]) trimParts.push(box(0.16, 0.1, 0.2, sd * (hw(tm) + 0.08), belt(tm) + 0.12, tm * L - off - 0.05));
  }
  const plates = [box(0.52, 0.12, 0.02, 0, tailY - 0.2, -off - 0.01), box(0.52, 0.12, 0.02, 0, hb * 0.38, off + 0.01)];
  const wheels = K.wheels.flatMap((t) => [-1, 1].map((sd) => ({ z: t * L - off, x: sd * (hw(t) - 0.16), r: K.r, sd })));
  K.roofY = K.glass.R;
  return { body, glass: gh.glass, tail, head: merge(heads), trim: merge(trimParts), plate: merge(plates), wheels, K };
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
    this.iClip = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iX', this.iX);
    g.setAttribute('iClip', this.iClip);
    this.mesh = new THREE.InstancedMesh(g, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3).setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.userData.dynamic = true;
    scene.add(this.mesh);
    this.n = 0;
  }

  // rv: a drawn car still turning from the drawing into the car ({ sweep: [x, y, z, front], band })
  push(m, color, part = 0, rv = null) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    m.toArray(this.mesh.instanceMatrix.array, i * 16);
    const c = this.mesh.instanceColor.array;
    c[i * 3] = color[0];
    c[i * 3 + 1] = color[1];
    c[i * 3 + 2] = color[2];
    this.iX.array[i * 4 + 1] = part;
    this.iX.array[i * 4 + 3] = rv ? 1 + rv.band : 0;
    const k = this.iClip.array;
    if (rv) {
      k[i * 4] = rv.sweep[0];
      k[i * 4 + 1] = rv.sweep[1];
      k[i * 4 + 2] = rv.sweep[2];
      k[i * 4 + 3] = rv.sweep[3];
    } else k[i * 4] = k[i * 4 + 1] = k[i * 4 + 2] = k[i * 4 + 3] = 0;
  }

  end() {
    this.mesh.count = this.n;
    // (nothing of this kind on the screen: no draw call at all)
    this.mesh.visible = this.n > 0;
    for (const at of [this.mesh.instanceMatrix, this.mesh.instanceColor, this.iX, this.iClip]) {
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
      glass: S({ kind: 'glass', color: srgb(0.24, 0.26, 0.4), gloss: 0.95, lit: 0, line: 0.8, side: THREE.DoubleSide }),
      tyre: S({ kind: 'cyl', color: srgb(0.08, 0.07, 0.1), partR: 0.36, line: 0.9 }),
      rim: S({ kind: 'box', color: srgb(0.75, 0.75, 0.8), gloss: 0.5 }),
      tail: S({ kind: 'neon', color: srgb(1, 0.15, 0.2), emissive: new THREE.Color(5.0, 0.25, 0.3), line: 0.5 }),
      head: S({ kind: 'neon', color: srgb(1, 0.95, 0.85), emissive: new THREE.Color(3.2, 3.0, 2.6), line: 0.5 }),
      light: S({ kind: 'neon', color: srgb(1, 1, 1), emissive: new THREE.Color(3.0, 3.0, 3.0), emVColor: true, line: 0.4 }),
      trim: S({ kind: 'box', gloss: 0.3 }),
      dark: S({ kind: 'box', color: srgb(0.06, 0.06, 0.08), gloss: 0.4, line: 0.7 }),
      plate: S({ kind: 'box', color: srgb(0.95, 0.94, 0.86), line: 0.6 }),
    };
    this.mats = mats;
    const cap = 140;
    this.kinds = {};
    for (const kind of Object.keys(KINDS)) {
      const b = build(kind);
      const n = kind === 'bus' ? 12 : cap;
      this.kinds[kind] = {
        b,
        body: new Pool(scene, b.body, mats.paint, n),
        glass: new Pool(scene, b.glass, mats.glass, n),
        tail: new Pool(scene, b.tail, mats.tail, n),
        head: new Pool(scene, b.head, mats.head, n),
        trim: new Pool(scene, b.trim, mats.dark, n),
        plate: new Pool(scene, b.plate, mats.plate, n),
      };
    }
    const tyre = new THREE.CylinderGeometry(1, 1, 0.3, 20).rotateZ(Math.PI / 2);
    // the rim: a dished disc and five spokes
    const rimParts = [new THREE.CylinderGeometry(0.7, 0.7, 0.02, 16).rotateZ(Math.PI / 2).toNonIndexed(), new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10).rotateZ(Math.PI / 2).translate(0.02, 0, 0).toNonIndexed()];
    for (let k = 0; k < 5; k++) {
      const sp = new THREE.BoxGeometry(0.04, 0.6, 0.14);
      sp.translate(0.015, 0.33, 0);
      sp.rotateX((k / 5) * Math.PI * 2);
      rimParts.push(sp.toNonIndexed());
    }
    const rim = merge(rimParts);
    this.tyres = new Pool(scene, tyre, mats.tyre, cap * 4);
    this.rims = new Pool(scene, rim, mats.rim, cap * 4);
    // a taxi's sign, a police car's light bar and its stripe, a van's roof rack
    this.lightBox = new Pool(scene, new THREE.BoxGeometry(1, 1, 1), mats.light, cap * 3);
    this.trimBox = new Pool(scene, new THREE.BoxGeometry(1, 1, 1), mats.trim, cap * 4);
    this.paintColor = new Map();
  }

  // the box round a car of this kind, in its own frame
  boxOf(kind) {
    const K = (this.kinds[kind] || this.kinds.sedan).b.K;
    return new THREE.Box3(new THREE.Vector3(-K.W / 2, 0, -K.len / 2), new THREE.Vector3(K.W / 2, K.roofY + 0.04, K.len / 2));
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
   *      lift (bounce), tilt, roll, reveal: a drawn car turning from the drawing into the car
   *      ({ pre: world matrix pressing it flat, sweep, band }) }
   */
  draw(kind, color, x, y, z, yaw, o = {}) {
    const P = this.kinds[kind] || this.kinds.sedan;
    const K = P.b.K;
    const s = o.scale || 1;
    const rv = o.reveal || null;
    _e.set(o.tilt || 0, yaw, o.roll || 0, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y + (o.lift || 0), z), _q, _s.set(s, s * (o.squash || 1), s));
    if (rv) _m.premultiply(rv.pre);
    const part = ((Math.abs(x * 0.37 + z * 0.11) % 1) + 1) % 1;
    P.body.push(_m, this.col(color), part, rv);
    P.glass.push(_m, WHITE, part + 0.3, rv);
    P.tail.push(_m, WHITE, part + 0.5, rv);
    P.head.push(_m, WHITE, part + 0.6, rv);
    P.trim.push(_m, WHITE, part + 0.55, rv);
    P.plate.push(_m, WHITE, part + 0.65, rv);
    // the wheels: they roll, the front ones steer
    for (const w of P.b.wheels) {
      _e.set(o.spin || 0, w.z > 0 ? o.steer || 0 : 0, 0, 'YXZ');
      _q.setFromEuler(_e);
      _w.compose(_p.set(w.x, w.r, w.z), _q, _s.set(1, w.r, w.r));
      _w.premultiply(_m);
      this.tyres.push(_w, WHITE, part + 0.7, rv);
      _w.compose(_p.set(w.x + w.sd * 0.165, w.r, w.z), _q, _s.set(1, w.r, w.r));
      _w.premultiply(_m);
      this.rims.push(_w, WHITE, part + 0.8, rv);
    }
    const top = K.roofY;
    if (o.extra === 'taxi') {
      this.box(this.lightBox, _m, 0, top + 0.13, -0.1, 0.8, 0.24, 0.3, [0.85, 0.7, 0.22], rv);
    } else if (o.extra === 'police') {
      const blink = o.siren !== undefined ? o.siren : -1;
      const red = blink < 0 ? [0.5, 0.06, 0.08] : blink ? [3.2, 0.25, 0.3] : [0.5, 0.06, 0.08];
      const blue = blink < 0 ? [0.08, 0.12, 0.5] : blink ? [0.08, 0.12, 0.5] : [0.3, 0.5, 3.2];
      this.box(this.lightBox, _m, -0.32, top + 0.1, -0.15, 0.6, 0.16, 0.3, red, rv);
      this.box(this.lightBox, _m, 0.32, top + 0.1, -0.15, 0.6, 0.16, 0.3, blue, rv);
      // the black stripe along the doors (the car itself is white)
      for (const sd of [-1, 1]) this.box(this.trimBox, _m, sd * (K.W / 2 - 0.02), 0.66, 0, 0.04, 0.3, K.len * 0.5, [0.04, 0.05, 0.1], rv);
    } else if (o.extra === 'bus') {
      // the band of colour under the windows, the route sign over the windscreen, the doors
      for (const sd of [-1, 1]) this.box(this.trimBox, _m, sd * (K.W / 2 - 0.02), 1.55, -0.2, 0.04, 0.22, K.len * 0.94, [0.97, 0.96, 0.92], rv);
      this.box(this.lightBox, _m, 0, 2.86, K.len / 2 - 0.12, 1.5, 0.26, 0.06, [1.6, 1.2, 0.3], rv);
      for (const z of [K.len / 2 - 1.4, -0.4]) this.box(this.trimBox, _m, K.W / 2 + 0.005, 1.5, z, 0.02, 2.2, 1.1, [0.2, 0.22, 0.28], rv);
    } else if (kind === 'van' && o.extra !== 'plain') {
      this.box(this.trimBox, _m, 0, top + 0.06, -0.3, K.W * 0.8, 0.06, K.len * 0.55, [0.25, 0.25, 0.3], rv);
    }
  }

  box(pool, base, x, y, z, w, h, d, color, rv = null) {
    _w.makeScale(w, h, d).setPosition(x, y, z);
    _w.premultiply(base);
    pool.push(_w, color, 0, rv);
  }

  end() {
    for (const P of Object.values(this.kinds)) for (const k of ['body', 'glass', 'tail', 'head', 'trim', 'plate']) P[k].end();
    this.tyres.end();
    this.rims.end();
    this.lightBox.end();
    this.trimBox.end();
  }
}

export { KINDS };
