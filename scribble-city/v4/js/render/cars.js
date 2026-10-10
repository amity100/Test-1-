import * as THREE from 'three';
import { makeSurface, srgb, lin3, LAYERS, mergedSurface, penRow } from './materials.js';

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
  // (ROADMAP 4.1: the rest of the street's traffic)
  // a box truck: a tall box behind, the cab in front, two axles at the back
  truck: {
    len: 7.4, W: 2.35, r: 0.46, wheels: [0.14, 0.27, 0.84], clear: 0.36, n: 6,
    halfW: [[0, 1.17], [0.01, 1.18], [0.97, 1.16], [1, 1.06]],
    belt: [[0, 3.1], [0.01, 3.18], [0.68, 3.18], [0.695, 1.42], [0.8, 1.4], [0.92, 1.32], [0.97, 1.18], [1, 0.98]],
    glass: { tA: 0.705, tB: 0.72, tC: 0.83, tD: 0.93, R: 2.72, w0: 0.99, w1: 0.95, pillars: [] },
    tail: { y: -2.5, w: 0.8, low: 0.95 }, head: { y: -0.16, w: 0.44, h: 0.13 },
  },
  // a garbage truck: the rounded body of the compactor, the cab in front
  garbage: {
    len: 8.2, W: 2.45, r: 0.5, wheels: [0.13, 0.27, 0.85], clear: 0.4, n: 3.4,
    halfW: [[0, 1.16], [0.02, 1.22], [0.97, 1.2], [1, 1.1]],
    belt: [[0, 2.7], [0.03, 3.1], [0.72, 3.2], [0.735, 1.5], [0.86, 1.46], [0.95, 1.36], [1, 1.1]],
    glass: { tA: 0.745, tB: 0.76, tC: 0.86, tD: 0.95, R: 2.75, w0: 0.99, w1: 0.95, pillars: [] },
    tail: { y: -2.2, w: 0.85, low: 0.9 }, head: { y: -0.18, w: 0.46, h: 0.14 },
  },
  // a stretched limousine: a long run of dark windows
  limo: {
    len: 7.1, W: 1.96, r: 0.35, wheels: [0.13, 0.87], clear: 0.22, n: 3.4,
    halfW: [[0, 0.84], [0.04, 0.93], [0.15, 0.96], [0.5, 0.96], [0.85, 0.96], [0.96, 0.9], [1, 0.78]],
    belt: [[0, 0.82], [0.03, 0.95], [0.15, 0.98], [0.3, 0.97], [0.75, 0.95], [0.9, 0.9], [0.98, 0.84], [1, 0.7]],
    glass: { tA: 0.14, tB: 0.22, tC: 0.71, tD: 0.8, R: 1.44, w0: 0.92, w1: 0.74, pillars: [0.33, 0.46, 0.6] },
    tail: { y: -0.12, w: 0.9 }, head: { y: -0.1, w: 0.4, h: 0.08 },
  },
  // a fifties cruiser: a long hood, a short deck with fins, round everywhere
  classic: {
    len: 5.4, W: 2.0, r: 0.36, wheels: [0.19, 0.78], clear: 0.2, n: 2.6,
    halfW: [[0, 0.86], [0.04, 0.96], [0.2, 0.98], [0.5, 0.97], [0.8, 0.97], [0.95, 0.92], [1, 0.8]],
    belt: [[0, 0.98], [0.035, 1.04], [0.11, 0.92], [0.3, 0.86], [0.6, 0.86], [0.82, 0.83], [0.96, 0.78], [1, 0.62]],
    glass: { tA: 0.29, tB: 0.37, tC: 0.54, tD: 0.63, R: 1.42, w0: 0.9, w1: 0.74, pillars: [0.46] },
    tail: { y: -0.22, w: 0.5 }, head: { y: -0.16, w: 0.3, h: 0.14 },
  },
  // an ambulance: the box of the back, the cab in front
  ambulance: {
    len: 6.1, W: 2.2, r: 0.38, wheels: [0.17, 0.82], clear: 0.32, n: 5,
    halfW: [[0, 1.07], [0.02, 1.1], [0.88, 1.08], [0.96, 1.0], [1, 0.88]],
    belt: [[0, 2.5], [0.02, 2.6], [0.66, 2.6], [0.675, 1.3], [0.8, 1.24], [0.9, 1.14], [0.97, 1.0], [1, 0.84]],
    glass: { tA: 0.69, tB: 0.71, tC: 0.8, tD: 0.9, R: 2.25, w0: 0.99, w1: 0.95, pillars: [] },
    tail: { y: -1.9, w: 0.8, low: 0.95 }, head: { y: -0.12, w: 0.42, h: 0.1 },
  },
  // a fire engine: a long red body, the crew cab in front, the ladder on top
  firetruck: {
    len: 8.6, W: 2.5, r: 0.5, wheels: [0.14, 0.28, 0.84], clear: 0.42, n: 6,
    halfW: [[0, 1.2], [0.01, 1.25], [0.97, 1.23], [1, 1.12]],
    belt: [[0, 2.15], [0.02, 2.3], [0.7, 2.3], [0.715, 1.62], [0.88, 1.56], [0.96, 1.42], [1, 1.16]],
    glass: { tA: 0.725, tB: 0.74, tC: 0.9, tD: 0.965, R: 2.95, w0: 0.99, w1: 0.96, pillars: [0.82] },
    tail: { y: -1.4, w: 0.85, low: 0.95 }, head: { y: -0.2, w: 0.46, h: 0.14 },
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
  // where the turn signals blink: the front and back corners (ROADMAP 4.3)
  K.sig = { fx: hw(0.97) - 0.14, fy: hb + K.head.y, fz: off - 0.05, rx: hw(0.03) - 0.14, ry: tailY, rz: -off + 0.05 };
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
  constructor(scene, geo, mat, cap, dents = false) {
    this.cap = cap;
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.aId) g.setAttribute('aId', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    this.iX = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iClip = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iX', this.iX);
    g.setAttribute('iClip', this.iClip);
    // (a car's shell and glass: its dents, game/damage.js)
    this.iD0 = null;
    this.iD1 = null;
    if (dents) {
      this.iD0 = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
      this.iD1 = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('iDent0', this.iD0);
      g.setAttribute('iDent1', this.iD1);
    }
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
  push(m, color, part = 0, rv = null, dmg = null) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    if (this.iD0) {
      const a = this.iD0.array;
      const b = this.iD1.array;
      const d0 = dmg && dmg.d0;
      const d1 = dmg && dmg.d1;
      for (let k = 0; k < 4; k++) {
        a[i * 4 + k] = d0 ? d0[k] : 0;
        b[i * 4 + k] = d1 ? d1[k] : 0;
      }
      // (burnt out: the shader turns its lamps off)
      if (dmg && dmg.burnt) b[i * 4 + 3] += 10;
    }
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
    const ats = this._ats || (this._ats = this.iD0 ? [this.mesh.instanceMatrix, this.mesh.instanceColor, this.iX, this.iClip, this.iD0, this.iD1] : [this.mesh.instanceMatrix, this.mesh.instanceColor, this.iX, this.iClip]);
    for (let i = 0; i < ats.length; i++) {
      const at = ats[i];
      at.clearUpdateRanges();
      at.addUpdateRange(0, Math.max(1, this.n) * at.itemSize);
      at.needsUpdate = true;
    }
    this.n = 0;
  }
}

const PARTS = ['shell', 'glass'];
// the lights and trims (the same arrays every frame)
const TAXI_LIGHT = [0.85, 0.7, 0.22];
const TAXI_BUSY = [0.32, 0.27, 0.12];
const AMBER_ON = [3.2, 1.7, 0.25];
const HAZARD_SIDES = [-1, 1];
const LEFT_SIDE = [1];
const RIGHT_SIDE = [-1];
const AMBER_OFF = [0.45, 0.28, 0.08];
// the glass of a car that was hit (game/damage.js): crazed white, or gone (the dark inside)
const GLASS_CRACKED = [3.1, 3.0, 2.5];
const GLASS_BROKEN = [0.3, 0.3, 0.32];
const RED_OFF = [0.5, 0.06, 0.08];
const RED_ON = [3.2, 0.25, 0.3];
const BLUE_OFF = [0.08, 0.12, 0.5];
const BLUE_ON = [0.3, 0.5, 3.2];
const POLICE_STRIPE = [0.04, 0.05, 0.1];
const BUS_BAND = [0.97, 0.96, 0.92];
const BUS_SIGN = [1.6, 1.2, 0.3];
const BUS_DOOR = [0.2, 0.22, 0.28];
const VAN_RACK = [0.25, 0.25, 0.3];
const AMB_RED = [0.86, 0.1, 0.14];
const AMB_ORANGE = [1.0, 0.55, 0.12];
const WHITE_ON = [3.0, 3.0, 2.9];
const WHITE_OFF = [0.5, 0.5, 0.52];
const STEEL_BAR = [0.78, 0.8, 0.84];
const CHROME = [0.9, 0.91, 0.95];
const FIRE_BAND = [0.97, 0.95, 0.88];
const GARBAGE_DARK = [0.05, 0.05, 0.06];
const GARBAGE_STRIPE = [0.98, 0.84, 0.2];
const _m = new THREE.Matrix4();
const _w = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const WHITE = [1, 1, 1];

// ---- the wipers (in the rain): two pen strokes sweeping the windscreen, pivoting at its foot
const wiperRigs = {};
function wiperRig(kind) {
  if (wiperRigs[kind]) return wiperRigs[kind];
  const K = KINDS[kind] || KINDS.sedan;
  const G = K.glass;
  const belt = curve(K.belt);
  const hw = curve(K.halfW);
  const L = K.len;
  // the windscreen runs from its foot (tD) up to the roof (tC)
  const zD = G.tD * L - L / 2;
  const yD = belt(G.tD) - 0.04;
  const zC = G.tC * L - L / 2;
  const S = Math.hypot(zD - zC, G.R - yD);
  const half = hw(G.tD) * G.w0;
  const rig = { zD, yD, zC, yC: G.R, S, len: Math.min(0.62, half * 0.62), x0: [-half * 0.55, half * 0.08] };
  wiperRigs[kind] = rig;
  return rig;
}
const _wa = new THREE.Vector3();
const _wb = new THREE.Vector3();
const WIPER = [0.05, 0.05, 0.07];
// (the light caught along the blade: on the dark glass a black line alone would not show)
const WIPER_GLINT = [0.78, 0.82, 0.92];
// a point of the windscreen: x across it, s metres up its slope (in the car's own frame)
function onGlass(rig, x, s, out) {
  const k = Math.max(0, Math.min(1, s / rig.S));
  out.set(x, rig.yD + (rig.yC - rig.yD) * Math.sin(k * Math.PI * 0.5) + 0.03, rig.zD - (rig.zD - rig.zC) * k);
  return out;
}
// how far up the glass the wipers are at time t in this rain: in a drizzle a sweep now and then,
// in the rain back and forth all the time (quicker the harder it rains)
export function wiperSweep(t, rain, off) {
  if (rain < 0.45) {
    const f = (t * 0.45 + off) % 1;
    return f < 0.5 ? Math.sin(2 * Math.PI * f) : 0;
  }
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * (t * (0.55 + 0.6 * rain) + off));
}

/**
 * A car's wipers (fr: game/figure.js lines), at the car's place and heading; sweep: 0 lying at
 * the foot of the glass .. 1 standing up it
 */
export function drawWipers(fr, kind, x, y, z, yaw, sweep, seed) {
  const rig = wiperRig(kind);
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const th = sweep * 1.45;
  const ct = Math.cos(th);
  const st = Math.sin(th);
  const toWorld = (v) => v.set(x + v.x * c + v.z * sn, y + v.y, z - v.x * sn + v.z * c);
  for (let i = 0; i < 2; i++) {
    const x0 = rig.x0[i];
    const s0 = 0.06;
    // the blade, in two strokes so it follows the glass's curve, and the light along its top
    for (let pass = 0; pass < 2; pass++) {
      const lift = pass ? 0.025 : 0;
      toWorld(onGlass(rig, x0 - st * lift, s0 + ct * lift, _wa));
      for (let j = 1; j <= 2; j++) {
        const r = (rig.len * j) / 2;
        toWorld(onGlass(rig, x0 + r * ct - st * lift, s0 + r * st + ct * lift, _wb));
        if (pass) fr.lineXYZ(_wa.x, _wa.y, _wa.z, _wb.x, _wb.y, _wb.z, WIPER_GLINT, 1.3, seed + i * 3 + j + 40, 0.8, 0.005, 0.01);
        else fr.lineXYZ(_wa.x, _wa.y, _wa.z, _wb.x, _wb.y, _wb.z, WIPER, 3.4, seed + i * 3 + j, 1, 0.005, 0.01);
        _wa.copy(_wb);
      }
    }
  }
}

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
    // a car's shell (body, lamps, trims, plates) is one shape: each part keeps its own pen (a row
    // of the pen table) and its own number for the ink, and only the body takes the car's colour
    // - a kind of car is two draws (the shell and the glass, which is seen from both sides)
    const shellPen = mergedSurface(mats.paint, { vcolor: false, tint: true });
    // (dents: the shell and the glass pressed in where a car was hit, game/damage.js)
    shellPen.defines.USE_DENTS = '';
    mats.glass.defines.USE_DENTS = '';
    const shellParts = [['body', mats.paint, 0, 1], ['tail', mats.tail, 0.5, 0], ['head', mats.head, 0.6, 0], ['trim', mats.dark, 0.55, 0], ['plate', mats.plate, 0.65, 0]];
    for (const kind of Object.keys(KINDS)) {
      const b = build(kind);
      const n = kind === 'bus' ? 12 : cap;
      const shell = merge(shellParts.map(([k]) => b[k]));
      const cnt = shell.attributes.position.count;
      const ids = new Float32Array(cnt);
      const rows = new Float32Array(cnt);
      const tint = new Float32Array(cnt);
      let o = 0;
      for (const [k, mat, part, t] of shellParts) {
        const c = (b[k].index ? b[k].index.count : b[k].attributes.position.count);
        ids.fill(part, o, o + c);
        rows.fill(penRow(mat), o, o + c);
        tint.fill(t, o, o + c);
        o += c;
      }
      shell.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
      shell.setAttribute('aMat', new THREE.BufferAttribute(rows, 1));
      shell.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
      // (what the sun sees of a car: all its parts in one shape, drawn with the shell's own
      // instances - every part of a car has the car's matrix - so a kind of car is one draw in
      // the sun's view)
      const sun = merge([b.body, b.glass, b.tail, b.head, b.trim, b.plate]);
      const P = (this.kinds[kind] = {
        b,
        shell: new Pool(scene, shell, shellPen, n, true),
        glass: new Pool(scene, b.glass, mats.glass, n, true),
      });
      for (const k of PARTS) P[k].mesh.userData.noShadow = true;
      P.sun = new THREE.InstancedMesh(sun, mats.paint.userData.depth, n);
      P.sun.instanceMatrix = P.shell.mesh.instanceMatrix;
      P.sun.frustumCulled = false;
      P.sun.count = 0;
      P.sun.visible = false;
      P.sun.layers.set(LAYERS.SUN);
      P.sun.userData.dynamic = true;
      scene.add(P.sun);
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
    // (a rim's shadow is inside its tyre's; in the mirror it is a smear inside the tyre's)
    this.rims.mesh.userData.noShadow = true;
    this.rims.mesh.userData.noReflect = true;
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
    // (a car's colour array keeps its linear copy: no key to build every frame)
    if (c._carLin) return c._carLin;
    const key = c.join(',');
    let v = this.paintColor.get(key);
    if (!v) {
      v = lin3(c[0], c[1], c[2]);
      this.paintColor.set(key, v);
    }
    c._carLin = v;
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
    // (damage, game/damage.js: dents, the glass, a flat tyre that drops its corner)
    const D = o.dmg || null;
    let tilt = o.tilt || 0;
    let roll = o.roll || 0;
    const flat = D && D.flat >= 0 ? P.b.wheels[D.flat] : null;
    if (flat) {
      tilt += flat.z > 0 ? 0.035 : -0.035;
      roll -= flat.sd * 0.04;
    }
    _e.set(tilt, yaw, roll, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y + (o.lift || 0), z), _q, _s.set(s, s * (o.squash || 1), s));
    if (rv) _m.premultiply(rv.pre);
    const part = ((Math.abs(x * 0.37 + z * 0.11) % 1) + 1) % 1;
    P.shell.push(_m, this.col(color), part, rv, D);
    P.glass.push(_m, D && D.glass ? (D.glass > 1 ? GLASS_BROKEN : GLASS_CRACKED) : WHITE, part + 0.3, rv, D);
    // the wheels: they roll, the front ones steer
    const wheels = P.b.wheels;
    for (let wi = 0; wi < wheels.length; wi++) {
      const w = wheels[wi];
      _e.set(o.spin || 0, w.z > 0 ? o.steer || 0 : 0, 0, 'YXZ');
      _q.setFromEuler(_e);
      // (a flat one sits squashed on its rim)
      const wr = w === flat ? w.r * 0.74 : w.r;
      _w.compose(_p.set(w.x, wr, w.z), _q, _s.set(1, wr, w.r));
      _w.premultiply(_m);
      this.tyres.push(_w, WHITE, part + 0.7, rv);
      _w.compose(_p.set(w.x + w.sd * 0.165, wr, w.z), _q, _s.set(1, w.r, w.r));
      _w.premultiply(_m);
      this.rims.push(_w, WHITE, part + 0.8, rv);
    }
    const top = K.roofY;
    // the turn signal blinking on that side (1: its left, -1: its right)
    if (o.signal) {
      const on = Math.floor(performance.now() / 350) % 2 === 0;
      const S = K.sig;
      // (2: both sides, the hazards)
      for (const sd of o.signal === 2 ? HAZARD_SIDES : o.signal > 0 ? LEFT_SIDE : RIGHT_SIDE) {
        this.box(this.lightBox, _m, sd * S.fx, S.fy, S.fz, 0.16, 0.08, 0.05, on ? AMBER_ON : AMBER_OFF, rv);
        this.box(this.lightBox, _m, sd * S.rx, S.ry, S.rz, 0.16, 0.08, 0.05, on ? AMBER_ON : AMBER_OFF, rv);
      }
    }
    if (o.extra === 'taxi') {
      this.box(this.lightBox, _m, 0, top + 0.13, -0.1, 0.8, 0.24, 0.3, o.busy ? TAXI_BUSY : TAXI_LIGHT, rv);
    } else if (o.extra === 'police') {
      const blink = o.siren !== undefined ? o.siren : -1;
      const red = blink < 0 ? RED_OFF : blink ? RED_ON : RED_OFF;
      const blue = blink < 0 ? BLUE_OFF : blink ? BLUE_OFF : BLUE_ON;
      this.box(this.lightBox, _m, -0.32, top + 0.1, -0.15, 0.6, 0.16, 0.3, red, rv);
      this.box(this.lightBox, _m, 0.32, top + 0.1, -0.15, 0.6, 0.16, 0.3, blue, rv);
      // the black stripe along the doors (the car itself is white)
      for (let sd = -1; sd <= 1; sd += 2) this.box(this.trimBox, _m, sd * (K.W / 2 - 0.02), 0.66, 0, 0.04, 0.3, K.len * 0.5, POLICE_STRIPE, rv);
    } else if (o.extra === 'bus') {
      // the band of colour under the windows, the route sign over the windscreen, the doors
      for (let sd = -1; sd <= 1; sd += 2) this.box(this.trimBox, _m, sd * (K.W / 2 - 0.02), 1.55, -0.2, 0.04, 0.22, K.len * 0.94, BUS_BAND, rv);
      this.box(this.lightBox, _m, 0, 2.86, K.len / 2 - 0.12, 1.5, 0.26, 0.06, BUS_SIGN, rv);
      this.box(this.trimBox, _m, K.W / 2 + 0.005, 1.5, K.len / 2 - 1.4, 0.02, 2.2, 1.1, BUS_DOOR, rv);
      this.box(this.trimBox, _m, K.W / 2 + 0.005, 1.5, -0.4, 0.02, 2.2, 1.1, BUS_DOOR, rv);
    } else if (kind === 'van' && o.extra !== 'plain') {
      this.box(this.trimBox, _m, 0, top + 0.06, -0.3, K.W * 0.8, 0.06, K.len * 0.55, VAN_RACK, rv);
    } else if (o.extra === 'ambulance') {
      // a red band and an orange one along the box, the lights on its front corners and on the cab
      const blink = o.siren !== undefined ? o.siren : -1;
      for (let sd = -1; sd <= 1; sd += 2) {
        this.box(this.trimBox, _m, sd * (K.W / 2 - 0.0), 1.05, -0.35, 0.04, 0.24, K.len * 0.62, AMB_RED, rv);
        this.box(this.trimBox, _m, sd * (K.W / 2 - 0.0), 1.86, -0.35, 0.04, 0.12, K.len * 0.62, AMB_ORANGE, rv);
        this.box(this.lightBox, _m, sd * 0.78, 2.66, K.len * 0.16, 0.34, 0.14, 0.22, blink < 0 ? RED_OFF : (blink ? sd > 0 : sd < 0) ? RED_ON : RED_OFF, rv);
      }
      this.box(this.lightBox, _m, 0, top + 0.08, K.len / 2 - 1.55, 0.9, 0.13, 0.26, blink < 0 ? WHITE_OFF : blink ? WHITE_ON : RED_ON, rv);
    } else if (o.extra === 'fire') {
      // the white band along the body, the ladder on top, the light bar on the cab
      const blink = o.siren !== undefined ? o.siren : -1;
      // (the ladder lies on two supports over the body, out over the cab's roof)
      const ly = top + 0.16;
      const lz = -0.35;
      const ll = K.len * 0.8;
      for (let sd = -1; sd <= 1; sd += 2) {
        this.box(this.trimBox, _m, sd * (K.W / 2 - 0.0), 1.28, -0.4, 0.04, 0.16, K.len * 0.66, FIRE_BAND, rv);
        this.box(this.trimBox, _m, sd * 0.42, ly, lz, 0.08, 0.14, ll, STEEL_BAR, rv);
      }
      const n = 16;
      for (let i = 0; i <= n; i++) this.box(this.trimBox, _m, 0, ly, lz - ll / 2 + (ll * i) / n, 0.84, 0.06, 0.06, STEEL_BAR, rv);
      for (const z of [-K.len * 0.38, K.len * 0.02]) this.box(this.trimBox, _m, 0, (2.3 + ly) / 2, z, 0.5, ly - 2.3, 0.18, GARBAGE_DARK, rv);
      this.box(this.lightBox, _m, -0.36, top + 0.09, K.len * 0.4 - 0.15, 0.62, 0.16, 0.26, blink < 0 ? RED_OFF : blink ? RED_ON : RED_OFF, rv);
      this.box(this.lightBox, _m, 0.36, top + 0.09, K.len * 0.4 - 0.15, 0.62, 0.16, 0.26, blink < 0 ? RED_OFF : blink ? RED_OFF : RED_ON, rv);
    } else if (o.extra === 'garbage') {
      // the hopper at the back, a yellow stripe along the body
      this.box(this.trimBox, _m, 0, 1.25, -K.len / 2 - 0.25, K.W * 0.92, 1.7, 0.5, GARBAGE_DARK, rv);
      this.box(this.trimBox, _m, 0, 0.62, -K.len / 2 - 0.42, K.W * 0.9, 0.08, 0.4, STEEL_BAR, rv);
      for (let sd = -1; sd <= 1; sd += 2) this.box(this.trimBox, _m, sd * (K.W / 2 + 0.01), 1.1, -0.6, 0.04, 0.16, K.len * 0.6, GARBAGE_STRIPE, rv);
    } else if (o.extra === 'classic') {
      // chrome bumpers, a white stripe down the sides
      this.box(this.trimBox, _m, 0, K.clear + 0.2, K.len / 2 + 0.03, K.W * 0.92, 0.13, 0.12, CHROME, rv);
      this.box(this.trimBox, _m, 0, K.clear + 0.2, -K.len / 2 - 0.03, K.W * 0.92, 0.13, 0.12, CHROME, rv);
      for (let sd = -1; sd <= 1; sd += 2) this.box(this.trimBox, _m, sd * (K.W / 2 - 0.01), 0.62, 0.1, 0.03, 0.07, K.len * 0.78, FIRE_BAND, rv);
    } else if (o.extra === 'limo') {
      for (let sd = -1; sd <= 1; sd += 2) this.box(this.trimBox, _m, sd * (K.W / 2 - 0.03), 0.6, 0, 0.03, 0.05, K.len * 0.86, CHROME, rv);
    }
  }

  box(pool, base, x, y, z, w, h, d, color, rv = null) {
    _w.makeScale(w, h, d).setPosition(x, y, z);
    _w.premultiply(base);
    pool.push(_w, color, 0, rv);
  }

  end() {
    const kinds = this._kindList || (this._kindList = Object.values(this.kinds));
    for (let i = 0; i < kinds.length; i++) {
      const P = kinds[i];
      P.shell.end();
      P.glass.end();
      P.sun.count = P.shell.mesh.count;
      P.sun.visible = P.shell.mesh.visible;
    }
    this.tyres.end();
    this.rims.end();
    this.lightBox.end();
    this.trimBox.end();
  }
}

export { KINDS };
