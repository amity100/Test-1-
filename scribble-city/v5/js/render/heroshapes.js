import * as THREE from 'three';
import { FACE, JK, PT } from './heroink.js';

// (v5, ROADMAP 11.29, 13.1) The hero's own body. The passers-by are drawn in a few round shapes (a
// ball for a head, a barrel for a chest, tubes for limbs, a blob for a hand); the hero, always near
// the camera, gets real ones, each made here once, in metres, for a man of 1.78 m, each laid on its
// place in his drawings (render/heroink.js):
//  - a head carved like a head: the skull, a square jaw, the brow over two eye sockets, cheekbones,
//    a nose with its wings, lips and a chin - his face drawn on it from the front; his hair thick
//    and tousled over it, and its locks out of it (the fringe, the top, the sides, the nape);
//  - a leather jacket worn open: a chest and shoulders under it, its collar folded over, its front
//    edges standing proud, the flaps of its chest pockets; the shirt and the belt between them;
//  - cargo trousers: the seat, thighs with a pocket on each side, the shins, the hem over the boots;
//    laced boots on thick soles;
//  - hands with four fingers and a thumb, a little curled, as a hand hangs; the chain's points.
// render/people.js puts them on the rig every frame, in pens of his own.

// ------------------------------------------------------------------ building blocks
function make(pos, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// the triangles turned to face out (from `inside(x, y, z)`, a point inside near each), then the
// normals; and the duplicated seam of a ring smoothed over
function finish(g, inside, seams = null) {
  const p = g.attributes.position.array;
  const ix = g.index.array;
  let out = 0;
  let inn = 0;
  const c = [0, 0, 0];
  for (let i = 0; i < ix.length; i += 3) {
    const a = ix[i] * 3;
    const b = ix[i + 1] * 3;
    const d = ix[i + 2] * 3;
    const ux = p[b] - p[a];
    const uy = p[b + 1] - p[a + 1];
    const uz = p[b + 2] - p[a + 2];
    const vx = p[d] - p[a];
    const vy = p[d + 1] - p[a + 1];
    const vz = p[d + 2] - p[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const mx = (p[a] + p[b] + p[d]) / 3;
    const my = (p[a + 1] + p[b + 1] + p[d + 1]) / 3;
    const mz = (p[a + 2] + p[b + 2] + p[d + 2]) / 3;
    inside(mx, my, mz, c);
    const s = nx * (mx - c[0]) + ny * (my - c[1]) + nz * (mz - c[2]);
    if (s > 0) out++;
    else if (s < 0) inn++;
  }
  if (inn > out) {
    for (let i = 0; i < ix.length; i += 3) {
      const t = ix[i + 1];
      ix[i + 1] = ix[i + 2];
      ix[i + 2] = t;
    }
  }
  g.computeVertexNormals();
  if (seams) {
    const n = g.attributes.normal.array;
    for (const [a, b] of seams) {
      const x = n[a * 3] + n[b * 3];
      const y = n[a * 3 + 1] + n[b * 3 + 1];
      const z = n[a * 3 + 2] + n[b * 3 + 2];
      const l = Math.hypot(x, y, z) || 1;
      n[a * 3] = n[b * 3] = x / l;
      n[a * 3 + 1] = n[b * 3 + 1] = y / l;
      n[a * 3 + 2] = n[b * 3 + 2] = z / l;
    }
  }
  return g;
}

// several parts into one shape (each keeps its own normals)
function merge(list) {
  const pos = [];
  const uv = [];
  const idx = [];
  let base = 0;
  for (const g of list) {
    const p = g.attributes.position.array;
    const u = g.attributes.uv.array;
    const n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) pos.push(p[i]);
    for (let i = 0; i < u.length; i++) uv.push(u[i]);
    for (const i of g.index.array) idx.push(i + base);
    g._n = n;
    base += p.length / 3;
  }
  const g = make(pos, uv, idx);
  const nor = [];
  for (const q of list) for (let i = 0; i < q._n.length; i++) nor.push(q._n[i]);
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// (v5, ROADMAP 13.1) a part's place in its picture (render/heroart.js): its (u, v) into [u0, v0,
// u1, v1]; swap: the part's length (v) along the picture's x
function region(g, r, swap = false) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    let u = uv.getX(i);
    let v = uv.getY(i);
    if (swap) [u, v] = [v, u];
    uv.setXY(i, r[0] + u * (r[2] - r[0]), r[1] + v * (r[3] - r[1]));
  }
  uv.needsUpdate = true;
  return g;
}

// a section of a body: half its width across (w), how far it reaches in front (df) and behind (db),
// its middle moved forward by z, how square it is (n: 2 an ellipse, more a rounded box)
export function section(t, w, df, db, n, out) {
  const s = Math.sin(t);
  const c = Math.cos(t);
  const e = 2 / n;
  out[0] = w * Math.sign(s) * Math.abs(s) ** e;
  out[1] = Math.sign(c) * Math.abs(c) ** e * (c >= 0 ? df : db);
  return out;
}

// along y through the rows [y, w, df, db, z, n]; closed at both ends unless open. (vy: v runs with
// the height from the first row to the last, not by rows - a picture laid on it stays in proportion)
function loft(rows, seg = 20, open = false, vy = false) {
  const pos = [];
  const uv = [];
  const idx = [];
  const seams = [];
  const q = [0, 0];
  const R = rows.length;
  const ya = rows[0][0];
  const yb = rows[R - 1][0];
  for (let r = 0; r < R; r++) {
    const [y, w, df, db, z = 0, n = 2] = rows[r];
    for (let i = 0; i <= seg; i++) {
      // (the seam at the back: t = pi)
      const t = Math.PI + (i / seg) * Math.PI * 2;
      section(t, w, df, db, n, q);
      pos.push(q[0], y, q[1] + z);
      uv.push(i / seg, vy ? (y - ya) / (yb - ya) : r / (R - 1));
    }
    seams.push([r * (seg + 1), r * (seg + 1) + seg]);
  }
  for (let r = 0; r < R - 1; r++) {
    for (let i = 0; i < seg; i++) {
      const a = r * (seg + 1) + i;
      const b = a + 1;
      const c = a + seg + 1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  if (!open) {
    for (const r of [0, R - 1]) {
      const [y, , , , z = 0] = rows[r];
      const pole = pos.length / 3;
      pos.push(0, y, z);
      uv.push(0.5, r ? 1 : 0);
      for (let i = 0; i < seg; i++) idx.push(pole, r * (seg + 1) + i, r * (seg + 1) + i + 1);
    }
  }
  // (inside: the row's own middle at that height)
  const mid = (x, y, zz, out) => {
    let k = 0;
    while (k < R - 2 && (rows[0][0] < rows[R - 1][0] ? rows[k + 1][0] < y : rows[k + 1][0] > y)) k++;
    out[0] = 0;
    out[1] = y;
    out[2] = rows[k][4] || 0;
    return out;
  };
  return finish(make(pos, uv, idx), mid, seams);
}

// the rows' section at height y (between the two rows about it)
function rowAt(rows, y) {
  let k = 0;
  while (k < rows.length - 2 && rows[k + 1][0] < y) k++;
  const a = rows[k];
  const b = rows[k + 1];
  const t = Math.max(0, Math.min(1, (y - a[0]) / (b[0] - a[0] || 1)));
  const out = [];
  for (let i = 1; i < 6; i++) out.push((a[i] ?? (i === 4 ? 0 : 2)) + ((b[i] ?? (i === 4 ? 0 : 2)) - (a[i] ?? (i === 4 ? 0 : 2))) * t);
  return out; // [w, df, db, z, n]
}

// a patch on the front of a section-lofted body: across x in [x0(y), x1(y)], y from ya to yb, lifted
// off it by `lift` (a zip, the tee in a V, a pocket's welt)
function patch(rows, ya, yb, x0, x1, lift, nx = 4, ny = 8) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (let r = 0; r <= ny; r++) {
    const y = ya + ((yb - ya) * r) / ny;
    const [w, df, , z, n] = rowAt(rows, y);
    const a = x0(y);
    const b = x1(y);
    for (let i = 0; i <= nx; i++) {
      const x = a + ((b - a) * i) / nx;
      const u = Math.min(0.999, Math.abs(x) / w);
      const zz = df * (1 - u ** n) ** (1 / n) + z + lift;
      pos.push(x, y, zz);
      uv.push(i / nx, r / ny);
    }
  }
  for (let r = 0; r < ny; r++) {
    for (let i = 0; i < nx; i++) {
      const a = r * (nx + 1) + i;
      idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
  }
  return finish(make(pos, uv, idx), (x, y, z, out) => ((out[0] = 0), (out[1] = y), (out[2] = 0), out));
}

// a capsule from a to b (points), radius r0 at a and r1 at b, for fingers
function capsule(a, b, r0, r1, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a);
  const L = d.length();
  const rows = [
    [r0, 0.001, 0.001, 0.001],
    [r0 * 0.7, r0 * 0.71, r0 * 0.71, r0 * 0.71],
    [0, r0, r0, r0],
    [-L, r1, r1, r1],
    [-L - r1 * 0.7, r1 * 0.71, r1 * 0.71, r1 * 0.71],
    [-L - r1, 0.001, 0.001, 0.001],
  ];
  const g = loft(rows, seg);
  // (the loft runs down -y from a: turned to run along d)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

// ------------------------------------------------------------------ the head
const sdEll = (x, y, z, cx, cy, cz, rx, ry, rz) => {
  const px = (x - cx) / rx;
  const py = (y - cy) / ry;
  const pz = (z - cz) / rz;
  const k0 = Math.hypot(px, py, pz);
  const k1 = Math.hypot(px / rx, py / ry, pz / rz);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
};
const sdBall = (x, y, z, cx, cy, cz, r) => Math.hypot(x - cx, y - cy, z - cz) - r;
const sdCap = (x, y, z, ax, ay, az, bx, by, bz, r) => {
  const px = x - ax;
  const py = y - ay;
  const pz = z - az;
  const ux = bx - ax;
  const uy = by - ay;
  const uz = bz - az;
  const h = Math.max(0, Math.min(1, (px * ux + py * uy + pz * uz) / (ux * ux + uy * uy + uz * uz)));
  return Math.hypot(px - ux * h, py - uy * h, pz - uz * h) - r;
};
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => -smin(-a, -b, k);

// (x right, y up, z ahead; the middle of the head at 0)
export function headSdf(x, y, z) {
  const ax = Math.abs(x);
  // (the eyes half way down the head; brow, nose and chin a hand's third of the face each)
  let f = sdEll(x, y, z, 0, 0.026, -0.012, 0.076, 0.094, 0.101); // the skull, full at the temples
  f = smin(f, sdEll(x, y, z, 0, -0.034, 0.028, 0.061, 0.06, 0.07), 0.03); // the face, narrower below
  // (ROADMAP 13.5) the jaw as a man's: its body under the ears narrower than the cheekbones, its
  // angles under the ears, the jawline from them down to a square chin a little forward - not a
  // round jowl as wide as the cheeks
  f = smin(f, sdEll(x, y, z, 0, -0.062, -0.006, 0.053, 0.042, 0.06), 0.03);
  f = smin(f, sdEll(ax, y, z, 0.043, -0.075, -0.006, 0.012, 0.014, 0.016), 0.03);
  f = smin(f, sdCap(ax, y, z, 0.043, -0.079, -0.004, 0.02, -0.099, 0.06, 0.0105), 0.026);
  f = smin(f, sdEll(x, y, z, 0, 0.038, 0.07, 0.058, 0.014, 0.022), 0.015); // the brow
  f = smin(f, sdEll(ax, y, z, 0.05, 0.006, 0.048, 0.026, 0.016, 0.029), 0.015); // cheekbones, high
  f = smin(f, sdEll(x, y, z, 0, -0.094, 0.067, 0.03, 0.017, 0.019), 0.026); // the chin, square
  // the nose: its bridge, its tip, its wings
  let n = sdCap(x, y, z, 0, 0.028, 0.087, 0, -0.02, 0.111, 0.0085);
  n = smin(n, sdBall(x, y, z, 0, -0.023, 0.107, 0.0145), 0.006);
  n = smin(n, sdBall(ax, y, z, 0.0155, -0.027, 0.096, 0.0095), 0.006);
  f = smin(f, n, 0.008);
  // lips
  f = smin(f, sdEll(x, y, z, 0, -0.046, 0.089, 0.023, 0.0075, 0.012), 0.006);
  f = smin(f, sdEll(x, y, z, 0, -0.059, 0.086, 0.02, 0.0085, 0.011), 0.006);
  // the eye sockets, under the brow
  f = smax(f, -sdEll(ax, y, z, 0.032, 0.018, 0.09, 0.021, 0.013, 0.016), 0.008);
  return f;
}

// how far from the middle, in the direction (dx, dy, dz), the head's surface is
export function headR(dx, dy, dz) {
  let lo = 0.004;
  let hi = 0.26;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (headSdf(dx * m, dy * m, dz * m) < 0) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

// a sphere of rows from the crown (theta 0) down; r(theta, phi) its radius; phi 0 ahead, the seam behind
function polar(rings, seg, thetaEnd, radius) {
  const pos = [];
  const uv = [];
  const idx = [];
  const seams = [];
  pos.push(0, radius(0, 0), 0);
  uv.push(0.5, 0);
  for (let r = 1; r <= rings; r++) {
    for (let i = 0; i <= seg; i++) {
      const phi = Math.PI + (i / seg) * Math.PI * 2;
      const th = (r / rings) * thetaEnd(phi);
      const R = radius(th, phi);
      pos.push(Math.sin(th) * Math.sin(phi) * R, Math.cos(th) * R, Math.sin(th) * Math.cos(phi) * R);
      uv.push(i / seg, r / rings);
    }
    seams.push([1 + (r - 1) * (seg + 1), 1 + (r - 1) * (seg + 1) + seg]);
  }
  for (let i = 0; i < seg; i++) idx.push(0, 1 + i, 2 + i);
  for (let r = 0; r < rings - 1; r++) {
    for (let i = 0; i < seg; i++) {
      const a = 1 + r * (seg + 1) + i;
      const c = a + seg + 1;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  return { pos, uv, idx, seams };
}

export function heroHeadGeo() {
  const rings = 34;
  const seg = 44;
  const { pos, uv, idx, seams } = polar(rings, seg, () => Math.PI * 0.999, (th, phi) =>
    headR(Math.sin(th) * Math.sin(phi), Math.cos(th), Math.sin(th) * Math.cos(phi)),
  );
  // (the bottom closed under the jaw, where the neck goes in)
  const last = 1 + (rings - 1) * (seg + 1);
  const pole = pos.length / 3;
  pos.push(0, -headR(0, -1, 0), 0);
  uv.push(0.5, 1);
  for (let i = 0; i < seg; i++) idx.push(pole, last + i + 1, last + i);
  // (v5, ROADMAP 13.1) his face is a drawing (render/heroink.js paintFace) seen from the front: every
  // point of the head takes the picture's point straight ahead of it - the right of the head on the
  // picture's left, as a portrait is drawn
  const g = finish(make(pos, uv, idx), (x, y, z, out) => ((out[0] = 0), (out[1] = 0), (out[2] = 0), out), seams);
  faceMap(g);
  return g;
}

// the hairline: high on the forehead, a little in at the temples, over the ears, low at the nape
function hairline(phi) {
  // (by the angle round the head, 0 ahead: the forehead, the temples a little receded, the
  // sideburns down in front of the ears, over the ears, down to the nape)
  const K = [[0, 0.62], [0.55, 0.56], [1.1, 0.93], [1.33, 1.38], [1.5, 1.36], [1.72, 1.1], [2.2, 1.5], [Math.PI, 1.92]];
  const a = Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi)));
  let i = 0;
  while (i < K.length - 2 && K[i + 1][0] < a) i++;
  const t = (a - K[i][0]) / (K[i + 1][0] - K[i][0]);
  const u = t * t * (3 - 2 * t);
  return K[i][1] + (K[i + 1][1] - K[i][1]) * u;
}

// (v5, ROADMAP 13.1) his hair as the drawing has it: thick, dark, tousled - full on top and
// standing a little, the sides and the back shorter over the ears and the nape; its edge broken
// into clumps. A cap of it over the head (here), and locks out of it (heroLocksGeo)
const wav = (a, b) => Math.sin(a * 3.1 + b * 1.7) * 0.5 + Math.sin(a * 5.3 - b * 2.9 + 1.3) * 0.3 + Math.sin(a * 9.7 + b * 4.1 + 2.1) * 0.2;
export function hairEdge(phi) {
  // (the hairline, the front a little lower over the forehead, broken into clumps)
  return hairline(phi) + 0.07 * Math.max(0, Math.cos(phi)) ** 2 + 0.045 * wav(phi * 2.2, 0.3);
}
export function hairThick(th, phi) {
  const top = Math.max(0, Math.cos(th));
  const t = th / hairEdge(phi);
  const base = 0.007 + 0.026 * top ** 1.2 + 0.008 * Math.max(0, Math.cos(phi)) * top;
  return (base * (1 + 0.32 * wav(phi * 3.3, th * 5.1)) * (1 - 0.8 * t ** 4)) + 0.001;
}
export function heroHairGeo() {
  const rings = 16;
  const seg = 56;
  const { pos, uv, idx, seams } = polar(rings, seg, hairEdge, (th, phi) => headR(Math.sin(th) * Math.sin(phi), Math.cos(th), Math.sin(th) * Math.cos(phi)) + hairThick(th, phi));
  const g = finish(make(pos, uv, idx), (x, y, z, out) => ((out[0] = 0), (out[1] = 0), (out[2] = 0), out), seams);
  return region(g, [0, 0, 1, 0.92]);
}

// the locks: clumps of it lying on the cap, each a flattened strand from inside the mass of it,
// over it a little and back into it at its tip - combed over on top, falling over the forehead,
// down over the temples and the nape (lying on it, never standing off it)
function hairRng(seed) {
  let a = seed;
  return () => {
    a = (a * 16807) % 2147483647;
    return (a - 1) / 2147483646;
  };
}
// the hair's outside in a direction: the cap's, or below its edge (the fringe over the forehead) the skin's
function capR(x, y, z) {
  const L = Math.hypot(x, y, z) || 1;
  const th = Math.acos(Math.max(-1, Math.min(1, y / L)));
  const phi = Math.atan2(x, z);
  return headR(x / L, y / L, z / L) + (th < hairEdge(phi) ? hairThick(th, phi) : 0.0015);
}
// (the locks' lines, made with them: render/herolines.js draws along them - its middle, its edge)
export const LOCKS = [];
export function heroLocksGeo() {
  LOCKS.length = 0;
  const R = hairRng(4242);
  const pos = [];
  const uv = [];
  const idx = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const RINGS = 6;
  const AROUND = 5;
  // a point of the lock at s along it, on the hair: a little under its outside at both ends, over
  // it in the middle (a clump, not a spike); never into the skin
  const onHair = (C, s, rise) => {
    const r = C.length();
    const want = Math.max(capR(C.x, C.y, C.z) - 0.0025 + rise * Math.sin(Math.PI * Math.min(1, s * 1.15)), headR(C.x / r, C.y / r, C.z / r) + 0.0025);
    return C.multiplyScalar(want / r);
  };
  const lock = (phi, th, kind) => {
    const n = V(Math.sin(th) * Math.sin(phi), Math.cos(th), Math.sin(th) * Math.cos(phi));
    const tTh = V(Math.cos(th) * Math.sin(phi), -Math.sin(th), Math.cos(th) * Math.cos(phi));
    const tPh = V(Math.cos(phi), 0, -Math.sin(phi));
    const p0 = n.clone().multiplyScalar(capR(n.x, n.y, n.z));
    let d;
    let L;
    let w;
    let rise;
    const side = (R() - 0.5) * 2;
    if (kind === 'fringe') {
      // (a few strands over the forehead, swept to one side - the brow and the forehead clear)
      d = tTh.clone().addScaledVector(tPh, 0.55 + side * 0.5);
      L = 0.022 + 0.02 * R();
      w = 0.012 + 0.005 * R();
      rise = 0.004;
    } else if (kind === 'top') {
      // (over the front of it, combed to the side and back rather than down onto the face)
      const front = Math.max(0, Math.cos(phi));
      d = tTh.clone().multiplyScalar((0.8 + 0.3 * R()) * (1 - 0.75 * front)).addScaledVector(tPh, side * 0.9 + 0.6 * front);
      L = 0.04 + 0.03 * R();
      w = 0.014 + 0.006 * R();
      rise = 0.0035 + 0.002 * R();
    } else {
      d = tTh.clone().addScaledVector(tPh, side * 0.4);
      L = kind === 'side' ? 0.026 + 0.018 * R() : 0.024 + 0.014 * R();
      w = 0.011;
      rise = 0.0025;
    }
    d.normalize();
    // (over and down: the fringe and the sides fall)
    const p1 = p0.clone().addScaledVector(d, L * 0.5);
    const p2 = p0.clone().addScaledVector(d, L);
    if (kind === 'fringe' || kind === 'side') p2.y -= L * 0.3;
    const mid = [];
    const edge = [];
    const base = pos.length / 3;
    const C = new THREE.Vector3();
    const Tn = new THREE.Vector3();
    for (let r = 0; r < RINGS; r++) {
      const s = r / (RINGS - 1);
      const a = (1 - s) * (1 - s);
      const b = 2 * s * (1 - s);
      const c = s * s;
      C.set(a * p0.x + b * p1.x + c * p2.x, a * p0.y + b * p1.y + c * p2.y, a * p0.z + b * p1.z + c * p2.z);
      onHair(C, s, rise);
      Tn.set(2 * (1 - s) * (p1.x - p0.x) + 2 * s * (p2.x - p1.x), 2 * (1 - s) * (p1.y - p0.y) + 2 * s * (p2.y - p1.y), 2 * (1 - s) * (p1.z - p0.z) + 2 * s * (p2.z - p1.z)).normalize();
      const nOut = C.clone().normalize();
      const B = new THREE.Vector3().crossVectors(Tn, nOut).normalize();
      const N = new THREE.Vector3().crossVectors(B, Tn).normalize();
      const rw = w * (1 - s * 0.6) + 0.0005;
      for (let j = 0; j < AROUND; j++) {
        const an = (j / AROUND) * Math.PI * 2;
        pos.push(C.x + B.x * Math.cos(an) * rw + N.x * Math.sin(an) * rw * 0.3, C.y + B.y * Math.cos(an) * rw + N.y * Math.sin(an) * rw * 0.3, C.z + B.z * Math.cos(an) * rw + N.z * Math.sin(an) * rw * 0.3);
        uv.push(0.42 + (j / AROUND) * 0.16, 0.25 + s * 0.6);
      }
      // (its lines just over it: along its middle, and along one edge of it)
      if (r % 2 === 0 || r === RINGS - 1) {
        mid.push(C.clone().addScaledVector(N, rw * 0.3 + 0.0012).toArray());
        edge.push(C.clone().addScaledVector(B, rw * 0.55).addScaledVector(N, rw * 0.2 + 0.0012).toArray());
      }
    }
    LOCKS.push({ mid, edge, n: n.toArray(), w, kind });
    for (let r = 0; r < RINGS - 1; r++) {
      for (let j = 0; j < AROUND; j++) {
        const a = base + r * AROUND + j;
        const b = base + r * AROUND + ((j + 1) % AROUND);
        const c = a + AROUND;
        const e = b + AROUND;
        // (wound to face out: round the ring is B to N, and B x N runs back down the strand)
        idx.push(a, c, b, b, c, e);
      }
    }
  };
  for (let i = 0; i < 11; i++) lock(-0.85 + (i / 10) * 1.7 + (R() - 0.5) * 0.12, 0.5 + R() * 0.18, 'fringe');
  for (let i = 0; i < 30; i++) lock(R() * Math.PI * 2, 0.06 + R() * 0.55, 'top');
  for (const sd of [-1, 1]) for (let i = 0; i < 8; i++) lock(sd * (1.0 + R() * 1.1), 0.8 + R() * 0.38, 'side');
  for (let i = 0; i < 10; i++) lock(Math.PI + (R() - 0.5) * 1.3, 1.2 + R() * 0.45, 'back');
  const g = make(pos, uv, idx);
  g.computeVertexNormals();
  return g;
}
// (v5, ROADMAP 13.1) the neck: from inside the back of the head, under the skull, down into the collar
// - as wide as a man's (narrower than his jaw's angles: ROADMAP 13.5), wider below (the muscles
// from behind the ears to the collarbones), the nape thicker than the throat. Drawn in the face's picture (render/heroink.js: its skin, the
// stubble to the beard's line, the shadow under the jaw), as the head is: front on, its back from
// the picture's edges
export const NECK_ROWS = [
  [0.02, 0.03, 0.028, 0.034],
  [0.01, 0.046, 0.044, 0.052],
  [0.0, 0.048, 0.046, 0.055],
  [-0.05, 0.049, 0.047, 0.057],
  [-0.1, 0.053, 0.049, 0.06],
  [-0.14, 0.064, 0.054, 0.066],
  [-0.17, 0.078, 0.058, 0.072],
  [-0.185, 0.064, 0.05, 0.06],
  [-0.192, 0.02, 0.02, 0.02],
];
// (the neck's top in the head's frame: its y 0 is the head's -0.025 - render/people.js drawHero)
export const NECK_Y = -0.025;
export function heroNeckGeo() {
  const g = loft(NECK_ROWS, 24);
  faceMap(g, NECK_Y);
  return g;
}

// (ROADMAP 13.5) an ear: a shell against the side of the head - its rim (the helix) curled round from
// over the cheek, up and back and down to the lobe, the bowl inside it, the whole standing out a
// little more behind than in front (the side it is on: sd, +1 out along +x). y up, z back
export function heroEarGeo(sd = 1) {
  const NR = 8;
  const NT = 24;
  const Ry = 0.031;
  const Rz = 0.0175;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= NR; i++) {
    const r = i / NR;
    for (let j = 0; j <= NT; j++) {
      const th = (j / NT) * Math.PI * 2;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      // (the outline: fuller below for the lobe, narrower there)
      const y = Ry * r * c * (c < 0 ? 1 + 0.1 * -c : 1);
      const z = Rz * r * sn * (c < -0.4 ? 0.82 : 1);
      // (out from the head: more behind; the rim curled at the edge but at the front, where it runs
      // into the cheek; the bowl in the middle; a thin edge)
      const flare = 0.003 + 0.0075 * Math.max(0, sn) * (c > -0.4 ? 1 : 0.55);
      const rim = 0.0042 * Math.exp(-(((r - 0.86) / 0.11) ** 2)) * (sn > -0.55 ? 1 : 0.25);
      const bowl = -0.0028 * Math.max(0, 1 - (r / 0.72) ** 2);
      const edge = r > 0.96 ? (1 - r) / 0.04 : 1;
      const x = (flare * Math.min(1, r * 1.5) + rim + bowl) * edge;
      pos.push(sd * x, y, z);
      uv.push(j / NT, r);
    }
  }
  for (let i = 0; i < NR; i++) {
    for (let j = 0; j < NT; j++) {
      const a = i * (NT + 1) + j;
      const b = a + 1;
      const c = a + NT + 1;
      const d = c + 1;
      if (sd > 0) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const g = make(pos, uv, idx);
  g.computeVertexNormals();
  return g;
}

// the face's picture laid on a part from the front (render/heroink.js FACE): what is behind the ears
// from the picture's side edges, so the face is not seen again on the back of the head
function faceMap(g, dy = 0) {
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i) + dy;
    const z = p.getZ(i);
    let u = 0.5 - x / FACE.W;
    const back = Math.max(0, Math.min(1, (0.02 - z) / 0.04));
    u += ((x >= 0 ? 0.015 : 0.985) - u) * back * back * (3 - 2 * back);
    uv.setXY(i, u, 0.5 + (y - FACE.YC) / FACE.H);
  }
  uv.needsUpdate = true;
}

// (v5, ROADMAP 13.1) the leather jacket's collar: a stand round the neck, folded over and down, its
// points spread out over the chest; open at the throat. Both its sides drawn (it is seen from
// inside where it opens). In the collar's frame: the neck's base at y 0, z ahead
export function heroCollarGeo() {
  const pos = [];
  const uv = [];
  const idx = [];
  const COLS = 26;
  const ROWS = 9;
  const open = 0.42;
  const vert = (u, v, out) => {
    // u from one point round the back to the other; v from the stand's foot up, over the fold,
    // down to the fall's edge
    const phi = open + u * (Math.PI * 2 - 2 * open);
    const tip = Math.max(0, 1 - Math.min(u, 1 - u) / 0.16);
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const yf = 0.085 + 0.012 * Math.abs(cp) * (cp < 0 ? 1 : 0) - 0.024 * tip;
    const rs = 0.068;
    let r;
    let y;
    if (v < 0.42) {
      const t = v / 0.42;
      r = rs - 0.002 * t;
      y = -0.012 + (yf + 0.012) * t;
    } else {
      const t = (v - 0.42) / 0.58;
      const drop = 0.042 + 0.06 * tip * tip;
      r = rs + 0.004 + (0.016 + 0.05 * tip) * t;
      y = yf - drop * t * (0.85 + 0.15 * t);
    }
    // (the front points lie forward on the chest)
    out[0] = sp * r;
    out[1] = y;
    out[2] = cp * r * 0.94 + (cp > 0 ? 0.012 * tip * (v > 0.42 ? (v - 0.42) / 0.58 : 0) : 0);
    return out;
  };
  const q = [0, 0, 0];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let r = 0; r <= ROWS; r++) {
      for (let i = 0; i <= COLS; i++) {
        const u = i / COLS;
        const v = r / ROWS;
        vert(u, v, q);
        // (the inner face a little inside the outer)
        const k = side > 0 ? 1 : 1 - 0.035;
        pos.push(q[0] * k, q[1], q[2] * k);
        uv.push(u, v);
      }
    }
    for (let r = 0; r < ROWS; r++) {
      for (let i = 0; i < COLS; i++) {
        const a = base + r * (COLS + 1) + i;
        const b = a + 1;
        const c = a + COLS + 1;
        const d = c + 1;
        if (side > 0) idx.push(a, c, b, b, c, d);
        else idx.push(a, b, c, b, d, c);
      }
    }
  }
  const g = make(pos, uv, idx);
  g.computeVertexNormals();
  return region(g, JK.collar);
}

// ------------------------------------------------------------------ the jacket and what is under it
// (the torso from the hip joint, y 0, to the neck's, y 0.5: stretched to the rig's own length)
export const TORSO = [
  [-0.088, 0.168, 0.118, 0.114, 0, 2.4],
  [-0.084, 0.171, 0.121, 0.117, 0, 2.4],
  [-0.05, 0.17, 0.12, 0.116, 0, 2.4],
  [-0.01, 0.168, 0.117, 0.112, 0, 2.4],
  [0.02, 0.168, 0.117, 0.111, 0, 2.4],
  [0.06, 0.172, 0.12, 0.112, 0, 2.4],
  [0.14, 0.175, 0.123, 0.113, 0, 2.4],
  [0.23, 0.182, 0.13, 0.117, 0, 2.4],
  [0.3, 0.19, 0.134, 0.121, 0, 2.5],
  [0.36, 0.197, 0.127, 0.12, -0.002, 2.6],
  [0.405, 0.196, 0.112, 0.112, -0.006, 2.6],
  [0.437, 0.178, 0.096, 0.1, -0.008, 2.4],
  [0.462, 0.135, 0.08, 0.088, -0.01, 2.2],
  [0.482, 0.092, 0.07, 0.075, -0.008, 2],
  [0.497, 0.07, 0.061, 0.066, -0.006, 2],
  [0.503, 0.045, 0.04, 0.044, -0.006, 2],
];
export function heroTorsoGeo() {
  return region(loft(TORSO, 32, false, true), JK.torso);
}
// (v5, ROADMAP 13.1) the jacket worn open: its two front edges standing a little proud of the body,
// widening into the lapels under the collar; the shirt and the belt between them; the chest
// pockets' flaps
export function heroZipGeo() {
  const one = (sd) => {
    const g = patch(
      TORSO,
      -0.086,
      0.455,
      (y) => sd * 0.043,
      (y) => sd * (0.058 + Math.max(0, y - 0.33) * 0.42),
      0.0062,
      2,
      18,
    );
    return region(g, JK.edge, true);
  };
  return merge([one(1), one(-1)]);
}
export function heroTeeGeo() {
  // (up to the collar's foot: not up the neck)
  const g = patch(TORSO, -0.086, 0.43, () => -0.047, () => 0.047, 0.0032, 4, 18);
  return region(g, PT.front, true);
}
export function heroWeltGeo() {
  const one = (sd) => region(patch(TORSO, 0.302, 0.345, () => sd * 0.052, () => sd * 0.122, 0.0058, 4, 3), JK.flap);
  return merge([one(1), one(-1)]);
}

// the jeans from the waist (under the jacket) down to the crotch, about the hip joint
export function heroPelvisGeo() {
  return region(heroPelvisLoft(), PT.pelvis);
}
export const PELVIS_ROWS = [
  [0.08, 0.1, 0.07, 0.07],
  [0.074, 0.152, 0.098, 0.1, 0, 2.3],
  [0.04, 0.162, 0.104, 0.108, 0, 2.3],
  [0.0, 0.17, 0.11, 0.115, 0, 2.3],
  [-0.05, 0.168, 0.105, 0.12, 0, 2.3],
  [-0.09, 0.15, 0.095, 0.112, 0, 2.2],
  [-0.115, 0.112, 0.08, 0.092, 0, 2.1],
  [-0.13, 0.062, 0.05, 0.06],
  [-0.137, 0.012, 0.012, 0.012],
].reverse();
function heroPelvisLoft() {
  return loft(
    PELVIS_ROWS,
    24,
    false,
    true,
  );
}

// a sleeve from the shoulder joint (y 0) to the elbow (y -0.31): the deltoid under it, then the arm
export function heroUpperGeo() {
  return region(heroUpperLoft(), JK.upper);
}
export const UPPER_ROWS = [
  [0.04, 0.014, 0.014, 0.014],
  [0.032, 0.042, 0.044, 0.044],
  [0.017, 0.058, 0.06, 0.06],
  [0.0, 0.064, 0.063, 0.063],
  [-0.06, 0.062, 0.06, 0.058],
  [-0.15, 0.058, 0.055, 0.055],
  [-0.24, 0.054, 0.05, 0.05],
  [-0.3, 0.05, 0.048, 0.048],
  [-0.33, 0.045, 0.044, 0.044],
  [-0.352, 0.03, 0.03, 0.03],
  [-0.362, 0.008, 0.008, 0.008],
];
function heroUpperLoft() {
  return loft(
    UPPER_ROWS,
    18,
    false,
    true,
  );
}
// the forearm in its sleeve, from the elbow (y 0) to the wrist (y -0.29), blousing over the cuff
export function heroForeGeo() {
  return region(heroForeLoft(), JK.fore);
}
export const FORE_ROWS = [
  [0.048, 0.01, 0.01, 0.01],
  [0.036, 0.036, 0.036, 0.036],
  [0.014, 0.048, 0.048, 0.048],
  [0.0, 0.05, 0.05, 0.05],
  [-0.07, 0.053, 0.051, 0.051],
  [-0.17, 0.05, 0.048, 0.048],
  [-0.232, 0.048, 0.046, 0.046],
  [-0.248, 0.043, 0.042, 0.042],
  [-0.256, 0.03, 0.03, 0.03],
  [-0.26, 0.008, 0.008, 0.008],
];
function heroForeLoft() {
  return loft(
    FORE_ROWS,
    18,
    false,
    true,
  );
}
// jeans: the thigh from the hip joint (y 0) to the knee (y -0.47)
export function heroThighGeo() {
  return merge([region(heroThighLoft(), PT.thigh), cargoPocket(1), cargoPocket(-1)]);
}
// (v5, ROADMAP 13.1) a cargo pocket on the side of the thigh, a little forward (the thigh's frame:
// x ahead, z to the right; sd 1 its right side, -1 its left) - both legs are the same shape, so each
// has one on both its sides
function cargoPocket(sd) {
  // (from the knee up: rowAt walks up the rows)
  const rows = THIGH_ROWS.slice().reverse();
  const pos = [];
  const uv = [];
  const idx = [];
  const NX = 5;
  const NY = 7;
  const q = [0, 0];
  const ya = -0.31;
  const yb = -0.13;
  for (let r = 0; r <= NY; r++) {
    const y = ya + ((yb - ya) * r) / NY;
    const [w, df, db, z, n] = rowAt(rows, y);
    for (let i = 0; i <= NX; i++) {
      const s = i / NX;
      // (round the side: from a little behind it to well forward of it)
      const t = sd > 0 ? Math.PI * 2 - 0.42 + s * 1.05 : Math.PI + 0.42 - s * 1.05;
      section(t, w, df, db, n, q);
      const bulge = 0.0045 + 0.0045 * Math.sin(Math.PI * s) * Math.sin((Math.PI * r) / NY) + (r === NY ? 0.002 : 0);
      const L = Math.hypot(q[0], q[1]) || 1;
      pos.push(q[0] * (1 + bulge / L), y, (q[1] + z) * (1 + bulge / L));
      uv.push(s, r / NY);
    }
  }
  for (let r = 0; r < NY; r++) {
    for (let i = 0; i < NX; i++) {
      const a = r * (NX + 1) + i;
      idx.push(a, a + NX + 1, a + 1, a + 1, a + NX + 1, a + NX + 2);
    }
  }
  const g = finish(make(pos, uv, idx), (x, y, z, out) => ((out[0] = 0), (out[1] = y), (out[2] = 0), out));
  return region(g, PT.pocket);
}
export const THIGH_ROWS = [
      [0.062, 0.012, 0.012, 0.012],
      [0.05, 0.058, 0.058, 0.058],
      [0.025, 0.079, 0.08, 0.08],
      [0.0, 0.085, 0.088, 0.09],
      [-0.1, 0.083, 0.086, 0.085],
      [-0.22, 0.076, 0.078, 0.076],
      [-0.34, 0.066, 0.068, 0.064],
      [-0.43, 0.058, 0.062, 0.057],
      [-0.47, 0.056, 0.06, 0.056],
      [-0.5, 0.045, 0.047, 0.045],
      [-0.52, 0.022, 0.022, 0.022],
      [-0.526, 0.006, 0.006, 0.006],
    ];
function heroThighLoft() {
  return loft(THIGH_ROWS, 20, false, true);
}
// and from the knee (y 0) to the ankle (y -0.47), the hem stacked over the shoe
export function heroShinGeo() {
  return region(heroShinLoft(), PT.shin);
}
export const SHIN_ROWS = [
  [0.044, 0.012, 0.012, 0.012],
  [0.032, 0.045, 0.045, 0.045],
  [0.012, 0.056, 0.057, 0.057],
  [0.0, 0.058, 0.06, 0.058],
  [-0.1, 0.057, 0.057, 0.06],
  [-0.2, 0.055, 0.055, 0.058],
  [-0.32, 0.052, 0.053, 0.054],
  [-0.39, 0.0535, 0.0555, 0.055],
  [-0.415, 0.056, 0.058, 0.057],
  [-0.43, 0.0545, 0.057, 0.056],
  [-0.445, 0.0575, 0.06, 0.059],
  [-0.452, 0.04, 0.042, 0.042],
  [-0.455, 0.008, 0.008, 0.008],
];
function heroShinLoft() {
  return loft(
    SHIN_ROWS,
    20,
    false,
    true,
  );
}

// ------------------------------------------------------------------ the shoes
// (along z, heel to toe, about the rig's shoe point; y up: rows [z, w, below, above, -, n])
function alongZ(rows, seg) {
  const g = loft(rows.map(([z, w, lo, hi, , n]) => [z, w, lo, hi, 0, n]), seg, false, true);
  // (the loft runs up y with its front at +z: turned so y runs ahead and +z points down)
  return g.rotateX(Math.PI / 2);
}
// (v5, ROADMAP 13.1) his boots: dark leather, laced, a shaft up over the ankle (under the trousers'
// hem), a rounded toe on a thick sole
export function heroShoeGeo() {
  const g = alongZ(
    [
      [-0.13, 0.014, 0.012, 0.03, 0, 2.2],
      [-0.124, 0.038, 0.026, 0.1, 0, 2.5],
      [-0.108, 0.046, 0.028, 0.118, 0, 2.6],
      [-0.075, 0.05, 0.028, 0.122, 0, 2.6],
      [-0.04, 0.053, 0.028, 0.1, 0, 2.6],
      [0.0, 0.055, 0.028, 0.068, 0, 2.6],
      [0.04, 0.056, 0.028, 0.05, 0, 2.6],
      [0.085, 0.054, 0.028, 0.038, 0, 2.6],
      [0.116, 0.048, 0.027, 0.031, 0, 2.6],
      [0.136, 0.034, 0.024, 0.022, 0, 2.4],
      [0.146, 0.012, 0.012, 0.008, 0, 2],
    ],
    20,
  );
  return g;
}
export function heroSoleGeo() {
  const rows = [];
  for (const [z, w] of [[-0.134, 0.012], [-0.13, 0.036], [-0.115, 0.046], [-0.06, 0.051], [0.0, 0.054], [0.06, 0.056], [0.11, 0.05], [0.136, 0.036], [0.146, 0.012]]) rows.push([z, w, 0.0105, 0.0105, 0, 5]);
  const g = alongZ(rows, 18);
  g.translate(0, -0.036, 0);
  return g;
}

// ------------------------------------------------------------------ the hands
// (the right one: from the wrist, y 0, down -y to the fingertips; its thumb towards +x, its palm
// towards -z; the left one is its mirror)
export function heroHandGeo(left = false) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const parts = [];
  // the palm and the back of the hand
  parts.push(
    loft(
      [
        [0.012, 0.012, 0.008, 0.01, 0, 2],
        [0.004, 0.03, 0.012, 0.016, 0, 2.2],
        [-0.02, 0.036, 0.012, 0.017, 0, 2.6],
        [-0.055, 0.041, 0.012, 0.016, 0, 2.8],
        [-0.085, 0.043, 0.011, 0.014, 0, 2.8],
        [-0.096, 0.04, 0.01, 0.012, 0, 2.4],
        [-0.102, 0.03, 0.008, 0.008, 0, 2],
      ].reverse(),
      16,
    ),
  );
  // four fingers, a little curled towards the palm
  const fingers = [
    [0.027, 0.074, 0.0086],
    [0.009, 0.081, 0.0088],
    [-0.009, 0.077, 0.0084],
    [-0.027, 0.062, 0.0076],
  ];
  for (const [x, len, r] of fingers) {
    const a = V(x, -0.094, -0.002);
    const l1 = len * 0.55;
    const l2 = len * 0.45;
    const d1 = V(0, -Math.cos(0.22), -Math.sin(0.22));
    const b = a.clone().addScaledVector(d1, l1);
    const d2 = V(0, -Math.cos(0.62), -Math.sin(0.62));
    const c = b.clone().addScaledVector(d2, l2);
    parts.push(capsule(a, b, r, r * 0.95, 8));
    parts.push(capsule(b, c, r * 0.95, r * 0.82, 8));
  }
  // the thumb, from the heel of the hand, along the fingers and in front of them
  const t0 = V(0.03, -0.028, -0.008);
  const t1 = t0.clone().addScaledVector(V(0.45, -0.8, -0.4).normalize(), 0.038);
  const t2 = t1.clone().addScaledVector(V(0.15, -0.85, -0.5).normalize(), 0.032);
  parts.push(capsule(t0, t1, 0.0115, 0.0098, 8));
  parts.push(capsule(t1, t2, 0.0098, 0.0085, 8));
  const g = merge(parts);
  if (left) {
    // (mirrored front to back: the left hand's palm towards +z, its thumb still ahead)
    g.scale(1, 1, -1);
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) {
      const t = ix[i + 1];
      ix[i + 1] = ix[i + 2];
      ix[i + 2] = t;
    }
    g.computeVertexNormals();
  }
  return g;
}

// (v5, ROADMAP 13.1) his chain: round the neck under the collar, down at the front onto the shirt
// (points in the torso's frame: from the hip, x right, y up, z ahead; render/people.js strings them)
export function heroChainPts() {
  const pts = [];
  const N = 18;
  for (let i = 0; i <= N; i++) {
    const a = -Math.PI + (i / N) * Math.PI * 2;
    const front = Math.max(0, Math.cos(a));
    const y = 0.47 - 0.085 * front ** 2.2;
    const [w, df, db, z] = rowAt(TORSO, y);
    // (out over the body's surface at that height, the shirt's thickness and a little more)
    const ex = Math.sin(a);
    const ez = Math.cos(a);
    const rx = Math.min(w, 0.075 + 0.02 * front);
    const rz = (ez >= 0 ? df : db) + 0.0065;
    pts.push([ex * rx * (front > 0.2 ? 0.55 + 0.45 * (1 - front) : 1), y, ez * rz + z]);
  }
  return pts;
}
