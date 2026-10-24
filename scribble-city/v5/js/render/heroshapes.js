import * as THREE from 'three';

// (v5, ROADMAP 11.29) The hero's own body. The passers-by are drawn in a few round shapes (a ball
// for a head, a barrel for a chest, tubes for limbs, a blob for a hand); the hero, always near the
// camera, gets real ones, each made here once, in metres, for a man of 1.78 m:
//  - a head carved like a head: the skull, a jaw with its angles, the brow over two eye sockets,
//    cheekbones, a nose with its wings, lips and a chin - and his hair cut short on top of it;
//  - a bomber jacket: a chest and shoulders under it, the trapezius up to the collar, a ribbed hem,
//    sleeves with ribbed cuffs, the zip, the tee's white in the V of the collar, two welt pockets;
//  - jeans: the seat, thighs, the shins, a hem stacked over the shoes; low sneakers on thick soles;
//  - hands with four fingers and a thumb, a little curled, as a hand hangs.
// render/people.js puts them on the rig every frame, in the same pens as everyone else.

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

// a section of a body: half its width across (w), how far it reaches in front (df) and behind (db),
// its middle moved forward by z, how square it is (n: 2 an ellipse, more a rounded box)
function section(t, w, df, db, n, out) {
  const s = Math.sin(t);
  const c = Math.cos(t);
  const e = 2 / n;
  out[0] = w * Math.sign(s) * Math.abs(s) ** e;
  out[1] = Math.sign(c) * Math.abs(c) ** e * (c >= 0 ? df : db);
  return out;
}

// along y through the rows [y, w, df, db, z, n]; closed at both ends unless open
function loft(rows, seg = 20, open = false) {
  const pos = [];
  const uv = [];
  const idx = [];
  const seams = [];
  const q = [0, 0];
  const R = rows.length;
  for (let r = 0; r < R; r++) {
    const [y, w, df, db, z = 0, n = 2] = rows[r];
    for (let i = 0; i <= seg; i++) {
      // (the seam at the back: t = pi)
      const t = Math.PI + (i / seg) * Math.PI * 2;
      section(t, w, df, db, n, q);
      pos.push(q[0], y, q[1] + z);
      uv.push(i / seg, r / (R - 1));
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
function headSdf(x, y, z) {
  // (the eyes half way down the head; brow, nose and chin a hand's third of the face each)
  let f = sdEll(x, y, z, 0, 0.024, -0.012, 0.075, 0.094, 0.101); // the skull
  f = smin(f, sdEll(x, y, z, 0, -0.04, 0.026, 0.06, 0.064, 0.072), 0.03); // the face
  f = smin(f, sdEll(x, y, z, 0, -0.056, -0.006, 0.066, 0.046, 0.064), 0.03); // the jaw, square at its angles
  f = smin(f, sdEll(x, y, z, 0, 0.038, 0.07, 0.058, 0.014, 0.022), 0.015); // the brow
  const ax = Math.abs(x);
  f = smin(f, sdEll(ax, y, z, 0.047, 0.002, 0.05, 0.025, 0.017, 0.028), 0.015); // cheekbones
  f = smin(f, sdEll(x, y, z, 0, -0.092, 0.066, 0.026, 0.017, 0.021), 0.012); // the chin
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
function headR(dx, dy, dz) {
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
  return finish(make(pos, uv, idx), (x, y, z, out) => ((out[0] = 0), (out[1] = 0), (out[2] = 0), out), seams);
}

// the hair: cut short, a little fuller on top, faded to nothing at the sides; the hairline high on
// the forehead, a little in at the temples, over the ears, low at the nape
function hairline(phi) {
  // (by the angle round the head, 0 ahead: the forehead, the temples a little receded, the
  // sideburns down in front of the ears, over the ears, down to the nape)
  const K = [[0, 0.62], [0.55, 0.56], [1.1, 1.0], [1.33, 1.5], [1.5, 1.45], [1.72, 1.12], [2.2, 1.5], [Math.PI, 1.92]];
  const a = Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi)));
  let i = 0;
  while (i < K.length - 2 && K[i + 1][0] < a) i++;
  const t = (a - K[i][0]) / (K[i + 1][0] - K[i][0]);
  const u = t * t * (3 - 2 * t);
  return K[i][1] + (K[i + 1][1] - K[i][1]) * u;
}

// (two parts, two colours: the top, kept longer, and the faded sides and back, cut close)
const FADE = 0.95;
function hairTop(phi) {
  return Math.min(hairline(phi), FADE + 0.2 * Math.max(0, Math.cos(phi)));
}
export function heroHairGeo() {
  const rings = 12;
  const seg = 44;
  const { pos, uv, idx, seams } = polar(rings, seg, hairTop, (th, phi) => {
    const t = th / hairTop(phi);
    const top = Math.max(0, Math.cos(th));
    const thick = (0.004 + 0.011 * top * top) * (1 - 0.7 * t ** 4) + 0.0008;
    return headR(Math.sin(th) * Math.sin(phi), Math.cos(th), Math.sin(th) * Math.cos(phi)) + thick;
  });
  return finish(make(pos, uv, idx), (x, y, z, out) => ((out[0] = 0), (out[1] = 0), (out[2] = 0), out), seams);
}
export function heroFadeGeo() {
  // (a band from under the top's edge down to the hairline, close to the skin)
  const pos = [];
  const uv = [];
  const idx = [];
  const seg = 44;
  const rows = 6;
  for (let r = 0; r <= rows; r++) {
    for (let i = 0; i <= seg; i++) {
      const phi = Math.PI + (i / seg) * Math.PI * 2;
      const a = hairTop(phi) - 0.06;
      const b = hairline(phi);
      const th = a + ((b - a) * r) / rows;
      const R = headR(Math.sin(th) * Math.sin(phi), Math.cos(th), Math.sin(th) * Math.cos(phi)) + 0.0022 * (1 - (r / rows) ** 2) + 0.0005;
      pos.push(Math.sin(th) * Math.sin(phi) * R, Math.cos(th) * R, Math.sin(th) * Math.cos(phi) * R);
      uv.push(i / seg, r / rows);
    }
  }
  const seams = [];
  for (let r = 0; r <= rows; r++) seams.push([r * (seg + 1), r * (seg + 1) + seg]);
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < seg; i++) {
      const a = r * (seg + 1) + i;
      idx.push(a, a + seg + 1, a + 1, a + 1, a + seg + 1, a + seg + 2);
    }
  }
  return finish(make(pos, uv, idx), (x, y, z, out) => ((out[0] = 0), (out[1] = 0), (out[2] = 0), out), seams);
}

// the neck: from inside the back of the head, under the skull, down into the collar - a little
// wider than deep, wider below (the muscles from behind the ears to the collarbones)
export function heroNeckGeo() {
  return loft(
    [
      [0.02, 0.02, 0.018, 0.02],
      [0.01, 0.043, 0.04, 0.044],
      [0.0, 0.047, 0.044, 0.048],
      [-0.07, 0.054, 0.05, 0.052],
      [-0.13, 0.06, 0.054, 0.058],
      [-0.17, 0.066, 0.058, 0.062],
      [-0.185, 0.05, 0.045, 0.048],
      [-0.192, 0.02, 0.02, 0.02],
    ],
    20,
  );
}

// the bomber's ribbed collar: a thick band standing round the neck, a little open at the throat
export function heroCollarGeo() {
  const prof = [];
  const ri = 0.061;
  const ro = 0.075;
  const h = 0.046;
  // (a rounded box in section, round the y axis)
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= 3; i++) {
      const a = a0 + (i / 3) * (Math.PI / 2);
      prof.push(new THREE.Vector2(cx + Math.cos(a) * 0.004, cy + Math.sin(a) * 0.004));
    }
  };
  corner(ro - 0.004, 0.004, -Math.PI / 2);
  corner(ro - 0.006, h - 0.004, 0);
  corner(ri + 0.004, h - 0.004, Math.PI / 2);
  corner(ri + 0.004, 0.004, Math.PI);
  prof.push(prof[0].clone());
  const g = new THREE.LatheGeometry(prof, 30);
  g.scale(1, 1, 0.92);
  g.deleteAttribute('normal');
  const rc = (ri + ro) / 2;
  return finish(g, (x, y, z, out) => {
    const l = Math.hypot(x, z / 0.92) || 1;
    out[0] = (x / l) * rc;
    out[1] = h / 2;
    out[2] = ((z / 0.92) / l) * rc * 0.92;
    return out;
  });
}

// ------------------------------------------------------------------ the jacket and what is under it
// (the torso from the hip joint, y 0, to the neck's, y 0.5: stretched to the rig's own length)
const TORSO = [
  [-0.04, 0.14, 0.095, 0.092, 0, 2.4],
  [-0.032, 0.158, 0.108, 0.104, 0, 2.4],
  [-0.01, 0.163, 0.112, 0.108, 0, 2.4],
  [0.02, 0.166, 0.115, 0.11, 0, 2.4],
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
  return loft(TORSO, 28);
}
// the ribbed hem: a band round the bottom of it, a shade darker
export function heroHemGeo() {
  const rows = [];
  for (const [y, k] of [[-0.045, 0.93], [-0.04, 1.0], [-0.025, 1.02], [-0.01, 1.03], [0.005, 1.03], [0.018, 1.01], [0.024, 0.985]]) {
    const [w, df, db, z, n] = rowAt(TORSO, Math.max(-0.032, y));
    rows.push([y, w * k + 0.003, df * k + 0.003, db * k + 0.003, z, n]);
  }
  return loft(rows, 28, true);
}
// the zip from the hem up to the V, the tee's white in the V of the collar, two welt pockets
export function heroZipGeo() {
  return patch(TORSO, -0.03, 0.4, () => -0.0045, () => 0.0045, 0.0028, 1, 16);
}
export function heroTeeGeo() {
  return patch(TORSO, 0.388, 0.49, (y) => -0.036 * Math.min(1, (y - 0.388) / 0.09), (y) => 0.036 * Math.min(1, (y - 0.388) / 0.09), 0.0022, 4, 6);
}
export function heroWeltGeo() {
  const one = (sd) =>
    patch(
      TORSO,
      0.07,
      0.15,
      (y) => sd * (0.088 + (y - 0.07) * 0.62) - 0.0065,
      (y) => sd * (0.088 + (y - 0.07) * 0.62) + 0.0065,
      0.0025,
      1,
      6,
    );
  return merge([one(1), one(-1)]);
}

// the jeans from the waist (under the jacket) down to the crotch, about the hip joint
export function heroPelvisGeo() {
  return loft(
    [
      [0.08, 0.1, 0.07, 0.07],
      [0.074, 0.152, 0.098, 0.1, 0, 2.3],
      [0.04, 0.162, 0.104, 0.108, 0, 2.3],
      [0.0, 0.17, 0.11, 0.115, 0, 2.3],
      [-0.05, 0.168, 0.105, 0.12, 0, 2.3],
      [-0.09, 0.15, 0.095, 0.112, 0, 2.2],
      [-0.115, 0.112, 0.08, 0.092, 0, 2.1],
      [-0.13, 0.062, 0.05, 0.06],
      [-0.137, 0.012, 0.012, 0.012],
    ].reverse(),
    24,
  );
}

// a sleeve from the shoulder joint (y 0) to the elbow (y -0.31): the deltoid under it, then the arm
export function heroUpperGeo() {
  return loft(
    [
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
    ],
    18,
  );
}
// the forearm in its sleeve, from the elbow (y 0) to the wrist (y -0.29), blousing over the cuff
export function heroForeGeo() {
  return loft(
    [
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
    ],
    18,
  );
}
// the ribbed cuff
export function heroCuffGeo() {
  const rows = [];
  const R = [[-0.244, 0.041], [-0.25, 0.0425], [-0.258, 0.041], [-0.266, 0.0418], [-0.274, 0.0402], [-0.282, 0.0405], [-0.289, 0.037], [-0.292, 0.031]];
  for (const [y, r] of R) rows.push([y, r, r, r]);
  return loft(rows, 18, true);
}

// jeans: the thigh from the hip joint (y 0) to the knee (y -0.47)
export function heroThighGeo() {
  return loft(
    [
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
    ],
    20,
  );
}
// and from the knee (y 0) to the ankle (y -0.47), the hem stacked over the shoe
export function heroShinGeo() {
  return loft(
    [
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
    ],
    20,
  );
}

// ------------------------------------------------------------------ the shoes
// (along z, heel to toe, about the rig's shoe point; y up: rows [z, w, below, above, -, n])
function alongZ(rows, seg) {
  const g = loft(rows.map(([z, w, lo, hi, , n]) => [z, w, lo, hi, 0, n]), seg);
  // (the loft runs up y with its front at +z: turned so y runs ahead and +z points down)
  return g.rotateX(Math.PI / 2);
}
export function heroShoeGeo() {
  return alongZ(
    [
      [-0.128, 0.012, 0.012, 0.016, 0, 2.2],
      [-0.122, 0.034, 0.026, 0.045, 0, 2.5],
      [-0.108, 0.042, 0.028, 0.06, 0, 2.6],
      [-0.07, 0.047, 0.028, 0.063, 0, 2.6],
      [-0.02, 0.05, 0.028, 0.052, 0, 2.6],
      [0.03, 0.052, 0.028, 0.041, 0, 2.6],
      [0.08, 0.051, 0.028, 0.031, 0, 2.6],
      [0.113, 0.045, 0.027, 0.023, 0, 2.6],
      [0.133, 0.031, 0.024, 0.016, 0, 2.4],
      [0.142, 0.01, 0.012, 0.006, 0, 2],
    ],
    18,
  );
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
