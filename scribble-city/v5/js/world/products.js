import * as THREE from 'three';
import { makeSurface, srgb, lin3 } from '../render/materials.js';
import { nextId } from './kit.js';
import { labels } from './labels.js';

// (v5, ROADMAP 13.13) The things a shop sells, made the way they are: a bottle has its foot, its
// body, the label round it, its shoulder, its neck and its cap; a can its rims and its lid; a jar its
// glass and its lid; a box of cereal its printed front and its sides; a bag of chips is a pillow
// sealed at both ends; a carton of milk has its gable and its fin. Each is a model in its own frame
// (the middle of its foot at the origin, +y up, +z its front, towards whoever stands at the shelf),
// made once, and copied into a shop's soup wherever it stands - its colours, its label's cell in the
// atlas (world/labels.js) and its ids (the inker draws round every can, and round the cap on it).
//
// The pens a product is drawn with (productPens) are the city's own - the same shaders - but they
// lay their strokes in the thing's own surface: round a bottle and up it, along a box's faces (kind
// 'uv', the uv in metres along the surface), so that the strokes describe its volume; and the light
// a room's lamps give it is put into its colours as an illustrator shades a thing (bake): the face
// towards the light lighter, the side away and the foot in its own shadow darker.

// ------------------------------------------------------------------ the pens
const PENS = new Map();
// indoor: true (a room behind a shop window) or 'store' (a store in a mall, under its white light)
export function productPens(indoor = true) {
  const key = String(indoor);
  if (PENS.has(key)) return PENS.get(key);
  const A = labels();
  const P = {
    plain: makeSurface({ kind: 'uv', vcolor: true, objMask: true, indoor, wash: 0.76, ang: 0.32, density: 0.92, line: 0.82 }),
    print: makeSurface({ kind: 'uv', vcolor: true, objMask: true, indoor, map: A.tex, wash: 0.9, ang: 0.32, density: 0.5, line: 0.82 }),
    gloss: makeSurface({ kind: 'uv', vcolor: true, objMask: true, indoor, gloss: 0.5, wash: 0.82, ang: 0.32, density: 0.8, line: 0.8 }),
    glow: makeSurface({ kind: 'neon', vcolor: true, emVColor: true, color: srgb(1, 1, 1), emissive: new THREE.Color(1.5, 1.5, 1.5), indoor, line: 0.4, objMask: true }),
    // (a screen with a picture on it: the atlas, alight)
    screen: makeSurface({ kind: 'uv', vcolor: true, objMask: true, indoor, map: A.tex, emMap: A.tex, emissive: new THREE.Color(0.9, 0.9, 0.9), wash: 0.95, density: 0.25, line: 0.6 }),
  };
  PENS.set(key, P);
  return P;
}
export const PEN_KEYS = ['plain', 'print', 'gloss', 'glow', 'screen'];

// ------------------------------------------------------------------ a model
class Part {
  constructor(pen, col, sub) {
    this.pen = pen;
    // (sRGB; null: the product's own colour, its tint)
    this.col = col;
    this.sub = sub;
    this.P = [];
    this.N = [];
    this.U = [];
    this.X = [];
  }

  get n() {
    return this.P.length / 3;
  }

  vert(x, y, z, nx, ny, nz, u, v) {
    this.P.push(x, y, z);
    this.N.push(nx, ny, nz);
    this.U.push(u, v);
    return this.n - 1;
  }

  // (a triangle always wound to face the way its corners' normals do: the shapes below need not
  // care which way round they go)
  tri(a, b, c) {
    const P = this.P;
    const N = this.N;
    const ax = P[a * 3];
    const ay = P[a * 3 + 1];
    const az = P[a * 3 + 2];
    const e1x = P[b * 3] - ax;
    const e1y = P[b * 3 + 1] - ay;
    const e1z = P[b * 3 + 2] - az;
    const e2x = P[c * 3] - ax;
    const e2y = P[c * 3 + 1] - ay;
    const e2z = P[c * 3 + 2] - az;
    const fx = e1y * e2z - e1z * e2y;
    const fy = e1z * e2x - e1x * e2z;
    const fz = e1x * e2y - e1y * e2x;
    const nx = N[a * 3] + N[b * 3] + N[c * 3];
    const ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1];
    const nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
    if (fx * nx + fy * ny + fz * nz < 0) this.X.push(a, c, b);
    else this.X.push(a, b, c);
  }

  quad(a, b, c, d) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }
}

export class Model {
  constructor(name) {
    this.name = name;
    this.parts = [];
    this.subs = 1;
    // its size (w along x, h up, d along z) and the label's kind in the atlas (world/labels.js)
    this.size = [0.1, 0.1, 0.1];
  }

  part(pen, col = null, sub = 0) {
    const p = new Part(pen, col, sub);
    this.parts.push(p);
    this.subs = Math.max(this.subs, sub + 1);
    return p;
  }

  get verts() {
    let n = 0;
    for (const p of this.parts) n += p.n;
    return n;
  }
}

// ------------------------------------------------------------------ the shapes they are made of
// a body turned on a lathe: prof [[r, y], ...] from the foot up; the uv in metres round it (u) and
// up it (v) - or, for a label (o.label: [y0, y1]), the label's own square, round once from the back
// (u 0..1) and up its band (v 0..1). The seam is at the back (-z).
export function lathe(part, prof, seg, o = {}) {
  const base = part.n;
  const lab = o.label;
  // the normals along the profile: from the slope at each ring
  const nr = [];
  let arc = 0;
  const arcs = [];
  for (let i = 0; i < prof.length; i++) {
    const a = prof[Math.max(0, i - 1)];
    const b = prof[Math.min(prof.length - 1, i + 1)];
    const dr = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dr, dy) || 1;
    nr.push([dy / l, -dr / l]);
    if (i) arc += Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]);
    arcs.push(arc);
  }
  let rAvg = 0;
  for (const p of prof) rAvg += p[0];
  rAvg /= prof.length;
  for (let i = 0; i < prof.length; i++) {
    const [r, y] = prof[i];
    const [cr, cy] = o.flat ? [1, 0] : nr[i];
    for (let s = 0; s <= seg; s++) {
      // (from the back, round by the right, to the back again: the front is the middle)
      const a = -Math.PI / 2 - (s / seg) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const u = lab ? s / seg : (s / seg) * Math.PI * 2 * rAvg;
      const v = lab ? (y - lab[0]) / (lab[1] - lab[0]) : arcs[i];
      part.vert(ca * r, y, sa * r, ca * cr, cy, sa * cr, u, v);
    }
  }
  const row = seg + 1;
  for (let i = 0; i < prof.length - 1; i++) {
    for (let s = 0; s < seg; s++) {
      const a = base + i * row + s;
      const b = a + row;
      part.quad(a, a + 1, b + 1, b);
    }
  }
  return part;
}

// a flat disc closing a lathe (up: facing +y, else -y), its uv in metres
export function disc(part, r, y, seg, up = true, r0 = 0) {
  const c = part.vert(0, y, 0, 0, up ? 1 : -1, 0, 0, 0);
  const base = part.n;
  for (let s = 0; s <= seg; s++) {
    const a = -Math.PI / 2 - (s / seg) * Math.PI * 2;
    part.vert(Math.cos(a) * r, y, Math.sin(a) * r, 0, up ? 1 : -1, 0, Math.cos(a) * r, Math.sin(a) * r);
  }
  void r0;
  for (let s = 0; s < seg; s++) {
    if (up) part.tri(c, base + s, base + s + 1);
    else part.tri(c, base + s + 1, base + s);
  }
  return part;
}

// a box (x0..x1, y0..y1, z0..z1) with its faces: o.skip: faces left out ('px','nx','py','ny','pz',
// 'nz'); o.label: the face that carries the label's square ('pz' the front, 'nz' the back, 'px'/'nx'
// the sides; several: an array); the rest in metres
export function box(part, x0, y0, z0, x1, y1, z1, o = {}) {
  const skip = o.skip || [];
  const lab = [].concat(o.label || []);
  const F = [
    ['pz', [0, 0, 1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    ['nz', [0, 0, -1], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
    ['px', [1, 0, 0], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
    ['nx', [-1, 0, 0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
    ['py', [0, 1, 0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]],
    ['ny', [0, -1, 0], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
  ];
  for (const [k, n, a, b, c, d] of F) {
    if (skip.includes(k)) continue;
    const isLab = lab.includes(k);
    const w = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const h = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    const uv = isLab ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [w, 0], [w, h], [0, h]];
    const i0 = part.vert(a[0], a[1], a[2], n[0], n[1], n[2], uv[0][0], uv[0][1]);
    part.vert(b[0], b[1], b[2], n[0], n[1], n[2], uv[1][0], uv[1][1]);
    part.vert(c[0], c[1], c[2], n[0], n[1], n[2], uv[2][0], uv[2][1]);
    part.vert(d[0], d[1], d[2], n[0], n[1], n[2], uv[3][0], uv[3][1]);
    part.quad(i0, i0 + 1, i0 + 2, i0 + 3);
  }
  return part;
}

// a bag sealed at both ends: its two faces bulging out (w wide, h high, d deep at the most), a crimp
// along the top and the bottom; the front (+z) carries the label's square
export function pillow(front, back, w, h, d, o = {}) {
  const nu = o.nu || 6;
  const nv = o.nv || 8;
  const seal = o.seal || 0.018;
  for (const side of [1, -1]) {
    const part = side > 0 ? front : back;
    const base = part.n;
    for (let j = 0; j <= nv; j++) {
      const t = j / nv;
      const y = seal + t * (h - seal * 2);
      const ky = 1 - Math.pow(Math.abs(t * 2 - 1), 3);
      for (let i = 0; i <= nu; i++) {
        const s = i / nu;
        const x = (s - 0.5) * w * (0.96 + 0.04 * ky);
        const kx = 1 - Math.pow(Math.abs(s * 2 - 1), 2.2);
        const z = side * (d / 2) * kx * ky + side * 0.001;
        // (the normal: from the bulge's slope)
        const dzdx = side * (d / 2) * ky * -2.2 * Math.pow(Math.abs(s * 2 - 1), 1.2) * Math.sign(s * 2 - 1) * (2 / w);
        const dzdy = side * (d / 2) * kx * -3 * Math.pow(Math.abs(t * 2 - 1), 2) * Math.sign(t * 2 - 1) * (2 / (h - seal * 2));
        const nx = -dzdx;
        const ny = -dzdy;
        const nz = side;
        const l = Math.hypot(nx, ny, nz);
        const u = side > 0 ? s : (1 - s) * w;
        const v = side > 0 ? t : t * h;
        part.vert(x, y, z, nx / l, ny / l, nz / l, u, v);
      }
    }
    const row = nu + 1;
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = base + j * row + i;
        if (side > 0) part.quad(a, a + 1, a + row + 1, a + row);
        else part.quad(a, a + row, a + row + 1, a + 1);
      }
    }
  }
  // the crimped seals, thin plates seen from either side
  for (const y of [0, h - seal]) box(back, -w / 2, y, -0.003, w / 2, y + seal, 0.003, { skip: ['px', 'nx', 'ny', y ? 'ny' : 'py'] });
}

// a ball, squashed (sy) - a fruit, a knob
export function ball(part, cx, cy, cz, r, sy = 1, lat = 6, lon = 8, o = {}) {
  const base = part.n;
  for (let j = 0; j <= lat; j++) {
    const v = (j / lat) * Math.PI;
    const sv = Math.sin(v);
    const cv = Math.cos(v);
    for (let i = 0; i <= lon; i++) {
      const u = -Math.PI / 2 - (i / lon) * Math.PI * 2;
      const nx = Math.cos(u) * sv;
      const nz = Math.sin(u) * sv;
      // (a dimple at the top and the bottom: an apple, a tomato)
      const dim = o.dimple ? 1 - o.dimple * Math.pow(Math.abs(cv), 8) : 1;
      part.vert(cx + nx * r * dim, cy + cv * r * sy * dim, cz + nz * r * dim, nx, cv / sy, nz, (i / lon) * Math.PI * 2 * r, v * r);
    }
  }
  const row = lon + 1;
  for (let j = 0; j < lat; j++) {
    for (let i = 0; i < lon; i++) {
      const a = base + j * row + i;
      part.quad(a, a + row, a + row + 1, a + 1);
    }
  }
  return part;
}

// a tube along a curve (pts [[x, y, z], ...]), radius r - a banana, a handle, a hanger's hook
export function tube(part, pts, r, seg = 6, o = {}) {
  const base = part.n;
  const rr = typeof r === 'function' ? r : () => r;
  let len = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[Math.min(pts.length - 1, i + 1)];
    const m = pts[Math.max(0, i - 1)];
    const t = [q[0] - m[0], q[1] - m[1], q[2] - m[2]];
    const tl = Math.hypot(t[0], t[1], t[2]) || 1;
    t[0] /= tl;
    t[1] /= tl;
    t[2] /= tl;
    // a frame round the tangent
    const up = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let bx = t[1] * up[2] - t[2] * up[1];
    let by = t[2] * up[0] - t[0] * up[2];
    let bz = t[0] * up[1] - t[1] * up[0];
    const bl = Math.hypot(bx, by, bz) || 1;
    bx /= bl;
    by /= bl;
    bz /= bl;
    const cx = by * t[2] - bz * t[1];
    const cy = bz * t[0] - bx * t[2];
    const cz = bx * t[1] - by * t[0];
    if (i) len += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1], p[2] - pts[i - 1][2]);
    const ri = rr(i / (pts.length - 1));
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const nx = bx * Math.cos(a) + cx * Math.sin(a);
      const ny = by * Math.cos(a) + cy * Math.sin(a);
      const nz = bz * Math.cos(a) + cz * Math.sin(a);
      part.vert(p[0] + nx * ri, p[1] + ny * ri, p[2] + nz * ri, nx, ny, nz, (s / seg) * Math.PI * 2 * ri, len);
    }
  }
  const row = seg + 1;
  for (let i = 0; i < pts.length - 1; i++) {
    for (let s = 0; s < seg; s++) {
      const a = base + i * row + s;
      part.quad(a, a + 1, a + row + 1, a + row);
    }
  }
  void o;
  return part;
}

// ------------------------------------------------------------------ the catalogue
// Each maker of a model: (low) -> Model. seg: how round (fewer on a phone)
const MAKERS = {};
const CACHE = new Map();
export function model(name, low = false) {
  const key = `${name}|${low ? 1 : 0}`;
  let m = CACHE.get(key);
  if (!m) {
    const fn = MAKERS[name];
    if (!fn) throw new Error(`no product ${name}`);
    m = fn(low);
    m.name = name;
    CACHE.set(key, m);
  }
  return m;
}
export function hasModel(name) {
  return !!MAKERS[name];
}

const STEEL = [0.78, 0.8, 0.84];
const WHITE = [0.96, 0.95, 0.92];

// a bottle of pop, half a litre: clear plastic coloured by what is in it, the label round its middle,
// the shoulder, the neck with its ring, the cap
MAKERS.soda = (low) => {
  const m = new Model();
  const seg = low ? 6 : 9;
  const r = 0.031;
  m.size = [r * 2, 0.212, r * 2];
  m.label = 'bottle';
  // (the foot: the five lobes of a bottle of pop, as a slight waist)
  lathe(m.part('gloss', null, 0), [[0.022, 0], [r, 0.012], [r * 0.97, 0.032], [r, 0.058]], seg);
  disc(m.part('gloss', null, 0), 0.022, 0.0, seg, false);
  lathe(m.part('print', null, 1), [[r + 0.0006, 0.058], [r + 0.0006, 0.13]], seg, { label: [0.058, 0.13], flat: true });
  lathe(m.part('gloss', null, 0), [[r, 0.13], [r * 0.9, 0.153], [r * 0.6, 0.174], [0.0125, 0.187], [0.0125, 0.193]], seg);
  lathe(m.part('plain', WHITE, 2), [[0.0155, 0.192], [0.0155, 0.195]], seg, { flat: true });
  const cap = m.part('plain', 'cap', 3);
  lathe(cap, [[0.0145, 0.195], [0.0148, 0.2], [0.0145, 0.21], [0.0135, 0.212]], seg);
  disc(cap, 0.0135, 0.212, seg, true);
  return m;
};

// a big bottle of water, a litre and a half: ribs round the bottle, a blue cap
MAKERS.water = (low) => {
  const m = new Model();
  const seg = low ? 6 : 9;
  const r = 0.043;
  m.size = [r * 2, 0.31, r * 2];
  m.label = 'bottle';
  const prof = [[0.03, 0], [r, 0.012]];
  for (let k = 0; k < 3; k++) prof.push([r, 0.025 + k * 0.028], [r * 0.95, 0.039 + k * 0.028]);
  prof.push([r, 0.11]);
  lathe(m.part('gloss', null, 0), prof, seg);
  disc(m.part('gloss', null, 0), 0.03, 0, seg, false);
  lathe(m.part('print', null, 1), [[r + 0.0006, 0.11], [r + 0.0006, 0.19]], seg, { label: [0.11, 0.19], flat: true });
  lathe(m.part('gloss', null, 0), [[r, 0.19], [r * 0.97, 0.215], [r * 0.82, 0.245], [r * 0.5, 0.27], [0.014, 0.285], [0.014, 0.292]], seg);
  const cap = m.part('plain', 'cap', 2);
  lathe(cap, [[0.016, 0.291], [0.0165, 0.3], [0.016, 0.31]], seg);
  disc(cap, 0.016, 0.31, seg, true);
  return m;
};

// a bottle of juice: a wide neck, a fat cap
MAKERS.juice = (low) => {
  const m = new Model();
  const seg = low ? 6 : 9;
  const r = 0.038;
  m.size = [r * 2, 0.24, r * 2];
  m.label = 'bottle';
  lathe(m.part('gloss', null, 0), [[0.03, 0], [r, 0.01], [r, 0.05]], seg);
  disc(m.part('gloss', null, 0), 0.03, 0, seg, false);
  lathe(m.part('print', null, 1), [[r + 0.0006, 0.05], [r + 0.0006, 0.15]], seg, { label: [0.05, 0.15], flat: true });
  lathe(m.part('gloss', null, 0), [[r, 0.15], [r * 0.96, 0.18], [r * 0.7, 0.205], [0.021, 0.215], [0.021, 0.22]], seg);
  const cap = m.part('plain', 'cap', 2);
  lathe(cap, [[0.023, 0.219], [0.0235, 0.234], [0.022, 0.24]], seg);
  disc(cap, 0.022, 0.24, seg, true);
  return m;
};

// a squeezy bottle of sauce, standing on its cap's flat top
MAKERS.sauce = (low) => {
  const m = new Model();
  const seg = low ? 6 : 9;
  const r = 0.034;
  m.size = [r * 2, 0.2, r * 2];
  m.label = 'bottle';
  lathe(m.part('plain', null, 0), [[0.024, 0], [r, 0.012], [r, 0.04]], seg);
  disc(m.part('plain', null, 0), 0.024, 0, seg, false);
  lathe(m.part('print', null, 1), [[r + 0.0006, 0.04], [r + 0.0006, 0.125]], seg, { label: [0.04, 0.125], flat: true });
  lathe(m.part('plain', null, 0), [[r, 0.125], [r * 0.95, 0.15], [r * 0.7, 0.165], [0.018, 0.17]], seg);
  const cap = m.part('plain', 'cap', 2);
  lathe(cap, [[0.019, 0.169], [0.019, 0.188], [0.012, 0.196], [0.006, 0.2]], seg);
  return m;
};

// a can of pop: the steel rims, the lid with its ring pull, the label round all of it
MAKERS.can = (low) => {
  const m = new Model();
  const seg = low ? 6 : 9;
  const r = 0.033;
  m.size = [r * 2, 0.122, r * 2];
  m.label = 'can';
  const s = m.part('plain', STEEL, 0);
  lathe(s, [[0.026, 0], [0.03, 0.002], [r, 0.009]], seg);
  disc(s, 0.026, 0.0, seg, false);
  lathe(m.part('print', null, 1), [[r, 0.009], [r, 0.108]], seg, { label: [0.009, 0.108], flat: true });
  const t = m.part('plain', STEEL, 2);
  lathe(t, [[r, 0.108], [0.029, 0.116], [0.0285, 0.121], [0.0275, 0.122], [0.026, 0.119]], seg);
  disc(t, 0.026, 0.119, seg, true);
  // the ring pull
  box(m.part('plain', [0.66, 0.68, 0.72], 3), -0.006, 0.1195, -0.004, 0.006, 0.1205, 0.014, { skip: ['ny'] });
  return m;
};

// a tin of food: wider, its rims ridged
MAKERS.tin = (low) => {
  const m = new Model();
  const seg = low ? 6 : 9;
  const r = 0.038;
  m.size = [r * 2, 0.112, r * 2];
  m.label = 'can';
  const s = m.part('plain', STEEL, 0);
  lathe(s, [[r * 0.94, 0], [r, 0.004], [r * 0.97, 0.008], [r, 0.011]], seg);
  disc(s, r * 0.94, 0, seg, false);
  lathe(m.part('print', null, 1), [[r + 0.0004, 0.011], [r + 0.0004, 0.101]], seg, { label: [0.011, 0.101], flat: true });
  const t = m.part('plain', STEEL, 2);
  lathe(t, [[r, 0.101], [r * 0.97, 0.104], [r, 0.108], [r * 0.96, 0.112]], seg);
  disc(t, r * 0.96, 0.11, seg, true);
  return m;
};

// a jar: the glass (the colour of what is in it), the label, the metal lid
MAKERS.jar = (low) => {
  const m = new Model();
  const seg = low ? 6 : 9;
  const r = 0.04;
  m.size = [r * 2, 0.12, r * 2];
  m.label = 'jar';
  lathe(m.part('gloss', null, 0), [[0.032, 0], [r, 0.008], [r, 0.025]], seg);
  disc(m.part('gloss', null, 0), 0.032, 0, seg, false);
  lathe(m.part('print', null, 1), [[r + 0.0006, 0.025], [r + 0.0006, 0.085]], seg, { label: [0.025, 0.085], flat: true });
  lathe(m.part('gloss', null, 0), [[r, 0.085], [r * 0.96, 0.095], [r * 0.85, 0.1]], seg);
  const lid = m.part('plain', 'cap', 2);
  lathe(lid, [[r * 0.9, 0.099], [r * 0.9, 0.118], [r * 0.85, 0.12]], seg, { flat: false });
  disc(lid, r * 0.85, 0.12, seg, true);
  return m;
};

// a bottle of oil: tall, a long neck
MAKERS.oil = (low) => {
  const m = new Model();
  const seg = low ? 6 : 9;
  const r = 0.034;
  m.size = [r * 2, 0.29, r * 2];
  m.label = 'bottle';
  lathe(m.part('gloss', null, 0), [[0.028, 0], [r, 0.01], [r, 0.07]], seg);
  disc(m.part('gloss', null, 0), 0.028, 0, seg, false);
  lathe(m.part('print', null, 1), [[r + 0.0006, 0.07], [r + 0.0006, 0.16]], seg, { label: [0.07, 0.16], flat: true });
  lathe(m.part('gloss', null, 0), [[r, 0.16], [r * 0.9, 0.2], [0.015, 0.24], [0.013, 0.262]], seg);
  const cap = m.part('plain', 'cap', 2);
  lathe(cap, [[0.0145, 0.26], [0.0145, 0.284], [0.012, 0.29]], seg);
  disc(cap, 0.012, 0.29, seg, true);
  return m;
};

// a box (cereal, crackers, pasta): the printed front and back, the sides with what is in it
function boxModel(w, h, d, label) {
  return () => {
    const m = new Model();
    m.size = [w, h, d];
    m.label = label;
    box(m.part('print', [1, 1, 1], 1), -w / 2, 0, -d / 2, w / 2, h, d / 2, { skip: ['px', 'nx', 'py', 'ny'], label: ['pz', 'nz'] });
    // (the sides: their own cell, what is in it)
    box(m.part('print', [1, 1, 1], 2), -w / 2, 0, -d / 2, w / 2, h, d / 2, { skip: ['pz', 'nz', 'py', 'ny'], label: ['px', 'nx'] }).cell = 'side';
    box(m.part('plain', null, 0), -w / 2, 0, -d / 2, w / 2, h, d / 2, { skip: ['pz', 'nz', 'px', 'nx'] });
    return m;
  };
}
MAKERS.cereal = boxModel(0.19, 0.28, 0.068, 'box');
MAKERS.dry = boxModel(0.16, 0.22, 0.06, 'box');
MAKERS.small = boxModel(0.13, 0.09, 0.062, 'small');

// a bag of chips: a pillow sealed top and bottom
function bagModel(w, h, d, label) {
  return (low) => {
    const m = new Model();
    m.size = [w, h, d];
    m.label = label;
    pillow(m.part('print', [1, 1, 1], 1), m.part('plain', null, 0), w, h, d, { nu: low ? 3 : 5, nv: low ? 4 : 6 });
    return m;
  };
}
MAKERS.chips = bagModel(0.18, 0.26, 0.08, 'bag');
MAKERS.coffee = bagModel(0.13, 0.21, 0.07, 'bag');
MAKERS.loaf = (low) => {
  // (a loaf in its bag, lying on its side)
  const m = new Model();
  const w = 0.3;
  const h = 0.12;
  const d = 0.12;
  m.size = [w, h, d];
  m.label = 'bag';
  const front = m.part('print', [1, 1, 1], 1);
  const back = m.part('plain', null, 0);
  const seg = low ? 6 : 10;
  // (a rounded loaf: a lathe along x, its top domed)
  const prof = [];
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    prof.push([0.055 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.35) + 0.002, t * w]);
  }
  const p = lathe(front, prof, seg, { label: [0, w] });
  // (turned to lie along x, the dome up, its foot flat)
  for (let i = 0; i < p.P.length; i += 3) {
    const x = p.P[i];
    const y = p.P[i + 1];
    const z = p.P[i + 2];
    p.P[i] = y - w / 2;
    p.P[i + 1] = Math.max(0, x * 1.0 + 0.055) * (x > 0 ? 1 : 0.9);
    p.P[i + 2] = z;
    const nx = p.N[i];
    const ny = p.N[i + 1];
    p.N[i] = ny;
    p.N[i + 1] = nx;
  }
  // (x and y swapped is a mirror: its triangles turned round again)
  for (let t = 0; t < p.X.length; t += 3) {
    const k = p.X[t + 1];
    p.X[t + 1] = p.X[t + 2];
    p.X[t + 2] = k;
  }
  // (the twist of the bag at one end)
  tube(back, [[w / 2, 0.055, 0], [w / 2 + 0.03, 0.06, 0], [w / 2 + 0.05, 0.065, 0]], (t) => 0.02 * (1 - t) + 0.006, 5);
  return m;
};

// a carton (milk, juice): four printed sides, the gable, the fin on top
MAKERS.carton = () => {
  const m = new Model();
  const w = 0.075;
  const h = 0.19;
  m.size = [w, h + 0.04, w];
  m.label = 'carton';
  box(m.part('print', [1, 1, 1], 1), -w / 2, 0, -w / 2, w / 2, h, w / 2, { skip: ['py', 'ny'], label: ['pz', 'nz', 'px', 'nx'] });
  const g = m.part('plain', null, 0);
  // the two slopes of the gable and its ends
  const t = h + 0.032;
  for (const s of [1, -1]) {
    const nz = s * 0.7;
    const ny = 0.7;
    const a = g.vert(-w / 2, h, (s * w) / 2, 0, ny, nz, 0, 0);
    g.vert(w / 2, h, (s * w) / 2, 0, ny, nz, w, 0);
    g.vert(w / 2, t, 0, 0, ny, nz, w, 0.05);
    g.vert(-w / 2, t, 0, 0, ny, nz, 0, 0.05);
    if (s > 0) g.quad(a, a + 1, a + 2, a + 3);
    else g.quad(a, a + 3, a + 2, a + 1);
  }
  for (const s of [1, -1]) {
    const a = g.vert((s * w) / 2, h, -w / 2, s, 0, 0, 0, 0);
    g.vert((s * w) / 2, h, w / 2, s, 0, 0, w, 0);
    g.vert((s * w) / 2, t, 0, s, 0, 0, w / 2, 0.03);
    if (s > 0) g.tri(a, a + 2, a + 1);
    else g.tri(a, a + 1, a + 2);
  }
  box(m.part('plain', null, 2), -w / 2, t - 0.002, -0.003, w / 2, t + 0.012, 0.003);
  return m;
};

// a jug of detergent: a handle at its top, the spout and its cap
MAKERS.jug = (low) => {
  const m = new Model();
  const w = 0.15;
  const h = 0.25;
  const d = 0.09;
  m.size = [w, h + 0.04, d];
  m.label = 'jug';
  box(m.part('print', [1, 1, 1], 1), -w / 2, 0, -d / 2, w / 2, h, d / 2, { skip: ['py', 'ny', 'px', 'nx', 'nz'], label: ['pz'] });
  box(m.part('plain', null, 0), -w / 2, 0, -d / 2, w / 2, h, d / 2, { skip: ['pz'] });
  // the handle: a loop over the back corner
  tube(m.part('plain', null, 0), [[-w / 2 + 0.02, h - 0.01, 0], [-w / 2 + 0.02, h + 0.035, 0], [-w / 2 + 0.07, h + 0.04, 0], [-w / 2 + 0.085, h, 0]], 0.011, low ? 4 : 6);
  const cap = m.part('plain', 'cap', 2);
  lathe(cap, [[0.022, h], [0.022, h + 0.03], [0.018, h + 0.034]], low ? 8 : 10);
  for (let i = 0; i < cap.P.length; i += 3) cap.P[i] += w / 2 - 0.035;
  return m;
};

// a cup of yoghurt: its foil lid in the maker's colour
MAKERS.yogurt = (low) => {
  const m = new Model();
  const seg = low ? 6 : 9;
  m.size = [0.07, 0.07, 0.07];
  m.label = 'can';
  lathe(m.part('print', [1, 1, 1], 1), [[0.028, 0], [0.035, 0.068]], seg, { label: [0, 0.068] });
  disc(m.part('plain', null, 0), 0.036, 0.069, seg, true);
  return m;
};

// a bar of chocolate standing in its box at the till
MAKERS.candy = () => {
  const m = new Model();
  m.size = [0.035, 0.13, 0.015];
  m.label = 'candy';
  // (the wrapper's cell is long across: stood up, the label is turned a quarter, its length up the bar)
  box(m.part('print', [1, 1, 1], 1), -0.0175, 0, -0.0075, 0.0175, 0.13, 0.0075, { skip: ['ny'], label: ['pz'] });
  m.turnLabel = true;
  return m;
};

// fruit and vegetables (the colour is the product's: tint)
MAKERS.apple = (low) => {
  const m = new Model();
  const r = 0.037;
  m.size = [r * 2, r * 1.8, r * 2];
  ball(m.part('plain', null, 0), 0, r * 0.9, 0, r, 0.9, low ? 4 : 6, low ? 6 : 9, { dimple: 0.12 });
  tube(m.part('plain', [0.36, 0.24, 0.12], 1), [[0, r * 1.7, 0], [0.003, r * 1.95, 0.002]], 0.0025, 4);
  return m;
};
MAKERS.orange = (low) => {
  const m = new Model();
  const r = 0.04;
  m.size = [r * 2, r * 2, r * 2];
  ball(m.part('plain', null, 0), 0, r, 0, r, 0.97, low ? 4 : 6, low ? 6 : 9);
  return m;
};
MAKERS.lemon = (low) => {
  const m = new Model();
  const r = 0.03;
  m.size = [r * 2.6, r * 2, r * 2];
  const p = ball(m.part('plain', null, 0), 0, r, 0, r, 1, low ? 4 : 6, low ? 6 : 8);
  // (long, pointed at its ends: along x)
  for (let i = 0; i < p.P.length; i += 3) {
    const y = p.P[i + 1] - r;
    p.P[i] *= 1.35;
    p.P[i + 1] = r + y * 0.95;
  }
  return m;
};
MAKERS.tomato = (low) => {
  const m = new Model();
  const r = 0.035;
  m.size = [r * 2, r * 1.6, r * 2];
  ball(m.part('plain', null, 0), 0, r * 0.8, 0, r, 0.8, low ? 4 : 6, low ? 6 : 9, { dimple: 0.1 });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    tube(m.part('plain', [0.24, 0.5, 0.2], 1), [[0, r * 1.58, 0], [Math.cos(a) * 0.012, r * 1.62, Math.sin(a) * 0.012]], 0.0025, 3);
  }
  return m;
};
MAKERS.avocado = (low) => {
  const m = new Model();
  const r = 0.035;
  m.size = [r * 2, r * 2.6, r * 2];
  const p = ball(m.part('plain', null, 0), 0, r * 1.25, 0, r, 1.25, low ? 4 : 6, low ? 6 : 8);
  for (let i = 0; i < p.P.length; i += 3) {
    const y = p.P[i + 1];
    const k = 1 - 0.35 * Math.max(0, (y - r * 1.25) / (r * 1.25));
    p.P[i] *= k;
    p.P[i + 2] *= k;
  }
  return m;
};
MAKERS.banana = (low) => {
  // a hand of bananas: four curved fingers from one crown
  const m = new Model();
  m.size = [0.2, 0.08, 0.14];
  const body = m.part('plain', null, 0);
  for (let k = 0; k < 4; k++) {
    const pts = [];
    const off = (k - 1.5) * 0.022;
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const a = -0.6 + t * 1.6;
      pts.push([Math.sin(a) * 0.09, 0.025 + (1 - Math.cos(a)) * 0.04 + k * 0.004, off + Math.cos(a) * 0.01]);
    }
    tube(body, pts, (t) => 0.016 * Math.sin(Math.PI * Math.min(1, 0.08 + t * 0.92)) + 0.004, low ? 4 : 6);
  }
  tube(m.part('plain', [0.4, 0.3, 0.14], 1), [[-0.05, 0.03, 0], [-0.07, 0.035, 0]], 0.008, 4);
  return m;
};
MAKERS.pepper = (low) => {
  const m = new Model();
  const r = 0.036;
  m.size = [r * 2, r * 2.2, r * 2];
  const p = ball(m.part('plain', null, 0), 0, r * 1.05, 0, r, 1.05, low ? 4 : 6, low ? 8 : 12);
  // (its lobes)
  for (let i = 0; i < p.P.length; i += 3) {
    const a = Math.atan2(p.P[i + 2], p.P[i]);
    const k = 1 + 0.08 * Math.cos(a * 4);
    p.P[i] *= k;
    p.P[i + 2] *= k;
  }
  tube(m.part('plain', [0.24, 0.5, 0.2], 1), [[0, r * 2.05, 0], [0.004, r * 2.35, 0]], 0.005, 4);
  return m;
};
MAKERS.onion = (low) => {
  const m = new Model();
  const r = 0.036;
  m.size = [r * 2, r * 2.2, r * 2];
  const p = ball(m.part('plain', null, 0), 0, r, 0, r, 1, low ? 4 : 6, low ? 6 : 9);
  for (let i = 0; i < p.P.length; i += 3) {
    const y = p.P[i + 1];
    if (y > r * 1.5) {
      const k = 1 - (y - r * 1.5) / (r * 0.6);
      p.P[i] *= Math.max(0.15, k);
      p.P[i + 2] *= Math.max(0.15, k);
      p.P[i + 1] += (y - r * 1.5) * 0.6;
    }
  }
  return m;
};

// ------------------------------------------------------------------ what a clothes shop sells
// A shirt on its hanger, as it hangs on a rail: the two panels of its body with the folds the cloth
// falls in (deeper towards the hem), its shoulders sloping from the collar, the sleeves hanging at
// its sides, the collar round the neck; the hanger's bar across the shoulders and its hook. Its foot
// (the hem) at the origin, the hook's top at size[1] (m.hang: where it rests on the rail's bar); its
// front +z. The cloth is the product's colour (tint), or a pattern printed on it (cell: cloth.*)
function shirtModel(o) {
  return (low) => {
    const m = new Model();
    const W = o.w || 0.46;
    const H = o.h || 0.72;
    const nu = low ? 4 : 7;
    const nv = low ? 5 : 8;
    const hook = 0.13;
    m.size = [W + 0.08, H + hook, 0.12];
    m.hang = H + hook - 0.02;
    m.label = 'cloth';
    const body = m.part(o.print ? 'print' : 'plain', o.print ? [1, 1, 1] : null, 0);
    const slope = o.slope || 0.09;
    // (the panels: z of the cloth at (x, y) - the folds, the chest's fullness)
    const zAt = (x, y, side) => {
      const k = 1 - y / H;
      const fold = Math.sin((x / W) * Math.PI * (o.folds || 5) + side * 0.6 + y * 3.1) * 0.012 * Math.pow(k, 1.4);
      const full = 0.016 * Math.sin(Math.PI * Math.min(1, Math.max(0, x / W + 0.5))) * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, y / H)));
      return side * (0.006 + full) + fold;
    };
    for (const side of [1, -1]) {
      const base = body.n;
      for (let j = 0; j <= nv; j++) {
        const t = j / nv;
        for (let i = 0; i <= nu; i++) {
          const s = i / nu;
          const x = (s - 0.5) * W * (0.94 + 0.06 * t);
          // (the top edge falls from the collar to the shoulders)
          const yTop = H - slope * Math.abs(x / (W / 2));
          const y = t * yTop + (1 - t) * (Math.sin(s * 9.4 + side) * 0.006);
          const z = zAt(x, y, side);
          const e = 0.004;
          const nx = -(zAt(x + e, y, side) - z) / e;
          const ny = -(zAt(x, y + e, side) - z) / e;
          const l = Math.hypot(nx, ny, side);
          body.vert(x, y, z, nx / l, ny / l, side / l, o.print ? s : x, o.print ? t : y);
        }
      }
      const row = nu + 1;
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a = base + j * row + i;
        body.quad(a, a + 1, a + row + 1, a + row);
      }
    }
    // the sides closed: a strip down each, from front to back
    const side = m.part(o.print ? 'print' : 'plain', o.print ? [1, 1, 1] : null, 0);
    for (const sx of [-1, 1]) {
      const pts = [];
      for (let j = 0; j <= nv; j++) {
        const y = (j / nv) * (H - slope);
        pts.push([sx * (W / 2) * (0.94 + 0.06 * (j / nv)), y]);
      }
      for (let j = 0; j < pts.length - 1; j++) {
        const [x0, y0] = pts[j];
        const [x1, y1] = pts[j + 1];
        const a = side.vert(x0, y0, zAt(x0, y0, 1), sx, 0, 0, 0, y0);
        side.vert(x0, y0, zAt(x0, y0, -1), sx, 0, 0, 0.03, y0);
        side.vert(x1, y1, zAt(x1, y1, -1), sx, 0, 0, 0.03, y1);
        side.vert(x1, y1, zAt(x1, y1, 1), sx, 0, 0, 0, y1);
        side.quad(a, a + 1, a + 2, a + 3);
      }
    }
    // the sleeves, hanging at the sides, a little forward
    if (o.sleeves !== false) {
      const sl = m.part(o.print ? 'print' : 'plain', o.print ? [1, 1, 1] : null, 1);
      const len = o.sleeve || 0.5;
      for (const sx of [-1, 1]) {
        const x0 = sx * (W / 2 - 0.02);
        const y0 = H - slope - 0.02;
        const pts = [];
        for (let k = 0; k <= 5; k++) {
          const t = k / 5;
          pts.push([x0 + sx * (0.03 * Math.sin(t * Math.PI) + 0.01 * t), y0 - t * len, 0.012 + 0.02 * Math.sin(t * 2.4)]);
        }
        tube(sl, pts, (t) => 0.052 - 0.012 * t, low ? 5 : 7);
      }
    }
    // the collar, round the neck
    const col = m.part(o.print ? 'print' : 'plain', o.print ? [1, 1, 1] : null, 2);
    const cpts = [];
    for (let k = 0; k <= 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      cpts.push([Math.cos(a) * 0.075, H - 0.012 + Math.max(0, Math.sin(a)) * -0.004, Math.sin(a) * 0.035]);
    }
    tube(col, cpts, 0.011, low ? 4 : 5);
    // the hanger: its bar along the shoulders, its hook over the collar
    const hg = m.part('plain', o.hanger || [0.16, 0.14, 0.13], 3);
    tube(hg, [[-W / 2 + 0.03, H - slope - 0.005, 0], [-0.1, H - slope * 0.45, 0], [0, H - 0.005, 0], [0.1, H - slope * 0.45, 0], [W / 2 - 0.03, H - slope - 0.005, 0]], 0.009, low ? 4 : 5);
    const hk = [];
    for (let k = 0; k <= 6; k++) {
      const a = (k / 6) * Math.PI * 1.25 - Math.PI * 0.25;
      hk.push([Math.sin(a) * 0.028, H + 0.075 + Math.cos(a) * 0.028, 0]);
    }
    hk.unshift([0, H, 0], [0, H + 0.045, 0]);
    tube(m.part('plain', [0.72, 0.74, 0.78], 4), hk, 0.0035, 4);
    return m;
  };
}
MAKERS.shirt = shirtModel({});
MAKERS.shirtPrint = shirtModel({ print: true });
MAKERS.tee = shirtModel({ w: 0.5, h: 0.66, sleeve: 0.2, folds: 4 });
MAKERS.dress = shirtModel({ w: 0.42, h: 1.08, sleeve: 0.16, folds: 7, slope: 0.07 });
MAKERS.coat = shirtModel({ w: 0.52, h: 0.86, sleeve: 0.58, folds: 4, slope: 0.1, hanger: [0.42, 0.28, 0.16] });

// trousers folded over their hanger's bar: two legs side by side, a crease down each
MAKERS.trousers = (low) => {
  const m = new Model();
  const W = 0.38;
  const H = 0.52;
  const hook = 0.13;
  m.size = [W, H + hook, 0.06];
  m.hang = H + hook - 0.02;
  m.label = 'cloth';
  const legs = m.part('plain', null, 0);
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 5; k++) pts.push([sx * 0.088, (k / 5) * H, 0.004 * Math.sin(k * 1.7)]);
    tube(legs, pts, (t) => 0.082 + 0.006 * t, low ? 5 : 8);
    // (flattened: a leg of a pair of trousers is a folded tube)
    const last = legs.P.length / 3;
    for (let v = last - (6 * ((low ? 5 : 8) + 1)); v < last; v++) legs.P[v * 3 + 2] *= 0.32;
  }
  // the fold over the bar
  tube(m.part('plain', null, 0), [[-W / 2 + 0.01, H, 0], [W / 2 - 0.01, H, 0]], 0.022, low ? 5 : 7);
  tube(m.part('plain', [0.16, 0.14, 0.13], 3), [[-W / 2 + 0.02, H + 0.005, 0], [W / 2 - 0.02, H + 0.005, 0]], 0.008, 4);
  const hk = [];
  for (let k = 0; k <= 6; k++) {
    const a = (k / 6) * Math.PI * 1.25 - Math.PI * 0.25;
    hk.push([Math.sin(a) * 0.028, H + 0.075 + Math.cos(a) * 0.028, 0]);
  }
  hk.unshift([0, H, 0], [0, H + 0.045, 0]);
  tube(m.part('plain', [0.72, 0.74, 0.78], 4), hk, 0.0035, 4);
  return m;
};

// a shirt folded on a table: its body, the collar's fold on top, the crease across
MAKERS.folded = (low) => {
  const m = new Model();
  const w = 0.3;
  const h = 0.045;
  const d = 0.24;
  m.size = [w, h, d];
  m.label = 'cloth';
  const b = m.part('plain', null, 0);
  // (a flat pillow, its top a little full)
  const nu = low ? 2 : 4;
  const nv = low ? 2 : 3;
  const base = b.n;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const x = (i / nu - 0.5) * w;
      const z = (j / nv - 0.5) * d;
      const k = (1 - Math.pow(Math.abs(i / nu * 2 - 1), 3)) * (1 - Math.pow(Math.abs(j / nv * 2 - 1), 3));
      b.vert(x, h * (0.8 + 0.2 * k), z, 0, 1, 0, x, z);
    }
  }
  const row = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = base + j * row + i;
    b.quad(a, a + row, a + row + 1, a + 1);
  }
  box(m.part('plain', null, 0), -w / 2, 0, -d / 2, w / 2, h * 0.8, d / 2, { skip: ['py', 'ny'] });
  // the collar's fold, a half ring near the back
  const c = [];
  for (let k = 0; k <= 6; k++) {
    const a = (k / 6) * Math.PI;
    c.push([Math.cos(a) * 0.06, h + 0.004, -d / 2 + 0.05 - Math.sin(a) * 0.03]);
  }
  tube(m.part('plain', null, 1), c, 0.008, 4);
  return m;
};

// a shoe: its sole (a footprint, rubber, in two layers), the upper over it, open at the ankle, the
// laces across the instep, the heel's counter; its toe +z
MAKERS.shoe = (low) => {
  const m = new Model();
  const L = 0.27;
  const Wd = 0.1;
  m.size = [Wd, 0.11, L];
  m.label = 'shoe';
  // the footprint: a width at each step from the heel (-L/2) to the toe (+L/2)
  const n = low ? 6 : 10;
  const prof = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const w = Wd / 2 * (0.62 + 0.38 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) ** 0.6) * (t > 0.8 ? 1 - (t - 0.8) * 1.6 : 1);
    prof.push([(t - 0.5) * L, Math.max(0.012, w)]);
  }
  const sole = m.part('plain', 'cap', 0);
  // (the sole: its top, its bottom, its edge all round)
  for (const [y, up] of [[0.028, true], [0, false]]) {
    const c = sole.vert(0, y, 0, 0, up ? 1 : -1, 0, 0, 0);
    const ring = [];
    for (const [z, w] of prof) ring.push([w, z]);
    for (let k = prof.length - 1; k >= 0; k--) ring.push([-prof[k][1], prof[k][0]]);
    const b0 = sole.n;
    for (const [x, z] of ring) sole.vert(x, y, z, 0, up ? 1 : -1, 0, x, z);
    for (let k = 0; k < ring.length; k++) sole.tri(c, b0 + k, b0 + ((k + 1) % ring.length));
  }
  {
    const ring = [];
    for (const [z, w] of prof) ring.push([w, z]);
    for (let k = prof.length - 1; k >= 0; k--) ring.push([-prof[k][1], prof[k][0]]);
    for (let k = 0; k < ring.length; k++) {
      const [x0, z0] = ring[k];
      const [x1, z1] = ring[(k + 1) % ring.length];
      const nx = z1 - z0;
      const nz = -(x1 - x0);
      const l = Math.hypot(nx, nz) || 1;
      const a = sole.vert(x0, 0, z0, nx / l, 0, nz / l, k * 0.02, 0);
      sole.vert(x1, 0, z1, nx / l, 0, nz / l, (k + 1) * 0.02, 0);
      sole.vert(x1, 0.028, z1, nx / l, 0, nz / l, (k + 1) * 0.02, 0.028);
      sole.vert(x0, 0.028, z0, nx / l, 0, nz / l, k * 0.02, 0.028);
      sole.quad(a, a + 1, a + 2, a + 3);
    }
  }
  // the upper: rings across the foot from the heel to the toe, an arch each - high at the ankle,
  // low at the toe; open on top behind the laces
  const up = m.part('plain', null, 1);
  const nr = low ? 6 : 10;
  const na = low ? 5 : 8;
  const base = up.n;
  for (let k = 0; k <= nr; k++) {
    const t = k / nr;
    const z = (t - 0.5) * L * 0.96;
    const pi = Math.min(prof.length - 1, Math.round(t * (prof.length - 1)));
    const w = prof[pi][1] * 0.97;
    const h = 0.028 + (t < 0.35 ? 0.085 : 0.085 - (t - 0.35) * 0.1) * (t > 0.85 ? 1 - (t - 0.85) * 3.5 : 1);
    for (let i = 0; i <= na; i++) {
      const a = (i / na) * Math.PI;
      const x = Math.cos(a) * w;
      const y = 0.026 + Math.sin(a) * (h - 0.026);
      up.vert(x, y, z, Math.cos(a), Math.sin(a) * 0.8, 0, a * w, z);
    }
  }
  const row = na + 1;
  for (let k = 0; k < nr; k++) for (let i = 0; i < na; i++) {
    const t = k / nr;
    // (the opening for the foot: the top of the upper behind the instep)
    if (t < 0.3 && i > na * 0.25 && i < na * 0.75) continue;
    const a = base + k * row + i;
    up.quad(a, a + 1, a + row + 1, a + row);
  }
  // the laces across the instep
  const lc = m.part('plain', [0.96, 0.95, 0.92], 2);
  for (let k = 0; k < (low ? 3 : 5); k++) {
    const z = (0.3 + k * 0.08 - 0.5) * L;
    const y = 0.11 - k * 0.012;
    tube(lc, [[-0.026, y - 0.004, z], [0, y + 0.004, z + 0.004], [0.026, y - 0.004, z]], 0.0028, 3);
  }
  return m;
};

// ------------------------------------------------------------------ what an electronics shop sells
// a phone lying on its back on a demo table: its body with rounded edges (a lathe of its outline),
// the screen lit with a picture (screen: the atlas, alight), the camera's bump on its back
MAKERS.phone = (low) => {
  const m = new Model();
  const w = 0.072;
  const l = 0.15;
  const t = 0.009;
  m.size = [w, t, l];
  m.label = 'screen';
  const body = m.part('plain', null, 0);
  box(body, -w / 2, 0, -l / 2, w / 2, t, l / 2, { skip: ['py'] });
  // the screen, a little in from the edges, its glass; the rim round it
  const sc = m.part('screen', [1, 1, 1], 1);
  const e = 0.004;
  const a = sc.vert(-w / 2 + e, t + 0.0005, l / 2 - e, 0, 1, 0, 0, 0);
  sc.vert(w / 2 - e, t + 0.0005, l / 2 - e, 0, 1, 0, 1, 0);
  sc.vert(w / 2 - e, t + 0.0005, -l / 2 + e, 0, 1, 0, 1, 1);
  sc.vert(-w / 2 + e, t + 0.0005, -l / 2 + e, 0, 1, 0, 0, 1);
  sc.quad(a, a + 1, a + 2, a + 3);
  box(m.part('plain', [0.08, 0.08, 0.09], 2), -w / 2, t, -l / 2, w / 2, t + 0.0004, l / 2, { skip: ['ny'] });
  void low;
  return m;
};

// a laptop open on a table: the base with its keys, the lid at an angle with the screen lit
MAKERS.laptop = (low) => {
  const m = new Model();
  const w = 0.33;
  const d = 0.23;
  m.size = [w, 0.22, d];
  m.label = 'screen';
  const base = m.part('plain', null, 0);
  box(base, -w / 2, 0, -d / 2, w / 2, 0.016, d / 2, {});
  // the keys: a darker field, the trackpad
  box(m.part('plain', [0.16, 0.16, 0.18], 1), -w / 2 + 0.02, 0.016, -d / 2 + 0.02, w / 2 - 0.02, 0.0175, 0.02, { skip: ['ny'] });
  box(m.part('plain', [0.62, 0.64, 0.68], 1), -0.05, 0.016, 0.04, 0.05, 0.0172, 0.1, { skip: ['ny'] });
  // the lid, leaning back 105 degrees: its back and its screen
  const a = (105 * Math.PI) / 180;
  const h = 0.21;
  const lid = m.part('plain', null, 2);
  const sc = m.part('screen', [1, 1, 1], 3);
  // (from the hinge at the back edge, up and back)
  const z0 = -d / 2;
  const top = [0, 0.016 + Math.sin(a) * h, z0 + Math.cos(a) * h];
  const n = [0, -Math.cos(a), Math.sin(a)];
  const nl = Math.hypot(n[1], n[2]);
  const nf = [0, n[1] / nl, n[2] / nl];
  const q = sc.vert(-w / 2 + 0.012, 0.03, z0 + 0.004, nf[0], nf[1], nf[2], 0, 0);
  sc.vert(w / 2 - 0.012, 0.03, z0 + 0.004, nf[0], nf[1], nf[2], 1, 0);
  sc.vert(w / 2 - 0.012, top[1] - 0.012, top[2] + 0.004, nf[0], nf[1], nf[2], 1, 1);
  sc.vert(-w / 2 + 0.012, top[1] - 0.012, top[2] + 0.004, nf[0], nf[1], nf[2], 0, 1);
  sc.quad(q, q + 1, q + 2, q + 3);
  const b = lid.vert(-w / 2, 0.016, z0, -nf[0], -nf[1], -nf[2], 0, 0);
  lid.vert(w / 2, 0.016, z0, -nf[0], -nf[1], -nf[2], w, 0);
  lid.vert(w / 2, top[1], top[2], -nf[0], -nf[1], -nf[2], w, h);
  lid.vert(-w / 2, top[1], top[2], -nf[0], -nf[1], -nf[2], 0, h);
  lid.quad(b, b + 1, b + 2, b + 3);
  // (the lid's front face, dark round the screen)
  const c = lid.vert(-w / 2, 0.016, z0 + 0.003, nf[0], nf[1], nf[2], 0, 0);
  lid.vert(w / 2, 0.016, z0 + 0.003, nf[0], nf[1], nf[2], w, 0);
  lid.vert(w / 2, top[1], top[2] + 0.003, nf[0], nf[1], nf[2], w, h);
  lid.vert(-w / 2, top[1], top[2] + 0.003, nf[0], nf[1], nf[2], 0, h);
  lid.quad(c, c + 1, c + 2, c + 3);
  void low;
  return m;
};

// headphones on a stand: the headband's arc, the two cushions on their yokes, the joints
MAKERS.headphones = (low) => {
  const m = new Model();
  m.size = [0.2, 0.32, 0.1];
  const seg = low ? 6 : 10;
  // the stand: its foot and its post, the curved rest
  const st = m.part('plain', [0.2, 0.2, 0.22], 0);
  lathe(st, [[0.06, 0], [0.06, 0.01], [0.008, 0.012], [0.008, 0.22]], seg);
  // the headband over the rest
  const band = m.part('plain', null, 1);
  const pts = [];
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI * (k / 10);
    pts.push([Math.cos(a) * 0.085, 0.2 + Math.sin(a) * 0.09, 0]);
  }
  tube(band, pts, 0.011, low ? 4 : 6);
  // the yokes and the cups, their cushions
  for (const sx of [-1, 1]) {
    tube(m.part('plain', [0.7, 0.72, 0.76], 2), [[sx * 0.085, 0.2, 0], [sx * 0.092, 0.16, 0]], 0.005, 4);
    const cup = m.part('plain', null, 3);
    const p = lathe(cup, [[0.0, -0.016], [0.04, -0.016], [0.045, -0.006], [0.045, 0.006], [0.04, 0.016], [0.0, 0.016]], seg);
    // (turned to face in: along x)
    for (let i = 0; i < p.P.length; i += 3) {
      const x = p.P[i];
      const y = p.P[i + 1];
      const nx = p.N[i];
      const ny = p.N[i + 1];
      p.P[i] = sx * 0.095 + y * -sx;
      p.P[i + 1] = 0.13 + x;
      p.N[i] = ny * -sx;
      p.N[i + 1] = nx;
    }
    // (on the left the turn is a mirror: its triangles turned round again)
    if (sx < 0) {
      for (let t = 0; t < p.X.length; t += 3) {
        const k = p.X[t + 1];
        p.X[t + 1] = p.X[t + 2];
        p.X[t + 2] = k;
      }
    }
    const cu = m.part('plain', [0.1, 0.1, 0.11], 4);
    ball(cu, sx * 0.075, 0.13, 0, 0.036, 1, 3, seg);
  }
  return m;
};

// a television on its foot: the thin body, the screen lit, the stand
MAKERS.tv = (low) => {
  const m = new Model();
  const w = 0.98;
  const h = 0.58;
  m.size = [w, h + 0.1, 0.22];
  m.label = 'screen';
  box(m.part('plain', [0.1, 0.1, 0.11], 0), -w / 2, 0.08, -0.025, w / 2, 0.08 + h, 0.012);
  const sc = m.part('screen', [1, 1, 1], 1);
  const a = sc.vert(-w / 2 + 0.012, 0.092, 0.0125, 0, 0, 1, 0, 0);
  sc.vert(w / 2 - 0.012, 0.092, 0.0125, 0, 0, 1, 1, 0);
  sc.vert(w / 2 - 0.012, 0.068 + h, 0.0125, 0, 0, 1, 1, 1);
  sc.vert(-w / 2 + 0.012, 0.068 + h, 0.0125, 0, 0, 1, 0, 1);
  sc.quad(a, a + 1, a + 2, a + 3);
  const st = m.part('plain', [0.16, 0.16, 0.18], 2);
  box(st, -0.03, 0.01, -0.03, 0.03, 0.09, 0.0);
  box(st, -0.2, 0, -0.11, 0.2, 0.012, 0.1);
  void low;
  return m;
};

// ------------------------------------------------------------------ what a jeweller sells
// a ring: its band (a torus), the stone set on it, its claws
MAKERS.ring = (low) => {
  const m = new Model();
  const r = 0.011;
  m.size = [0.026, 0.03, 0.01];
  const band = m.part('plain', null, 0);
  const pts = [];
  for (let k = 0; k <= (low ? 10 : 16); k++) {
    const a = (k / (low ? 10 : 16)) * Math.PI * 2;
    pts.push([Math.cos(a) * r, r + Math.sin(a) * r, 0]);
  }
  tube(band, pts, 0.0018, 4);
  ball(m.part('gloss', 'cap', 1), 0, r * 2 + 0.003, 0, 0.0042, 0.8, 3, low ? 5 : 8);
  return m;
};
// a necklace on its velvet bust: the bust (the neck and the shoulders), the chain round the neck, the
// pendant hanging at the front
MAKERS.necklace = (low) => {
  const m = new Model();
  m.size = [0.22, 0.34, 0.12];
  const seg = low ? 8 : 12;
  const bust = m.part('plain', 'cap', 0);
  lathe(bust, [[0.08, 0], [0.085, 0.01], [0.1, 0.12], [0.11, 0.2], [0.07, 0.24], [0.036, 0.26], [0.034, 0.34], [0.0, 0.345]], seg);
  for (let i = 0; i < bust.P.length; i += 3) bust.P[i + 2] *= 0.55;
  const chain = m.part('plain', null, 1);
  const pts = [];
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI * (k / 12);
    pts.push([Math.cos(a) * 0.05, 0.23 - Math.sin(a) * 0.05, 0.02 + Math.sin(a) * 0.022]);
  }
  tube(chain, pts, 0.0016, 3);
  ball(m.part('gloss', null, 2), 0, 0.172, 0.045, 0.008, 1.3, 3, low ? 5 : 8);
  return m;
};
// a watch lying on its cushion: the face, the bezel, the strap round the cushion
MAKERS.watch = (low) => {
  const m = new Model();
  m.size = [0.06, 0.05, 0.08];
  const seg = low ? 8 : 14;
  const cushion = m.part('plain', [0.92, 0.9, 0.86], 0);
  ball(cushion, 0, 0.022, 0, 0.026, 0.85, 3, seg);
  const strap = m.part('plain', 'cap', 1);
  const pts = [];
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI * 2 * (k / 12);
    pts.push([0, 0.022 + Math.sin(a) * 0.028, Math.cos(a) * 0.028]);
  }
  tube(strap, pts, 0.008, 4);
  for (let i = 0; i < strap.P.length; i += 3) strap.P[i] *= 2.4;
  const face = m.part('gloss', null, 2);
  lathe(face, [[0.018, 0.048], [0.019, 0.052], [0.0, 0.054]], seg);
  // (all of it up off the floor of its tray: the strap hangs below the cushion)
  for (const q of m.parts) for (let i = 1; i < q.P.length; i += 3) q.P[i] += 0.014;
  return m;
};
// a velvet tray, a ring box (open, its lid up, a ring in its slot)
MAKERS.tray = () => {
  const m = new Model();
  m.size = [0.3, 0.025, 0.2];
  box(m.part('plain', null, 0), -0.15, 0, -0.1, 0.15, 0.025, 0.1);
  return m;
};
MAKERS.ringBox = (low) => {
  const m = new Model();
  m.size = [0.06, 0.08, 0.06];
  box(m.part('plain', null, 0), -0.03, 0, -0.03, 0.03, 0.04, 0.03);
  box(m.part('plain', null, 1), -0.03, 0.04, -0.034, 0.03, 0.095, -0.028);
  const ring = model('ring', low);
  for (const p of ring.parts) {
    const q = m.part(p.pen, p.col, 2);
    for (let i = 0; i < p.P.length; i += 3) q.vert(p.P[i], p.P[i + 1] + 0.032, p.P[i + 2], p.N[i], p.N[i + 1], p.N[i + 2], p.U[(i / 3) * 2], p.U[(i / 3) * 2 + 1]);
    for (const x of p.X) q.X.push(x);
  }
  return m;
};

// a mannequin standing in an outfit: the stand, the legs (the trousers' colour: cap), the body (the
// top's: tint) from the hips to the shoulders, the arms down at its sides, the neck and the head, plain
MAKERS.mannequin = (low) => {
  const m = new Model();
  m.size = [0.46, 1.86, 0.3];
  const seg = low ? 8 : 12;
  const st = m.part('plain', [0.2, 0.2, 0.22], 0);
  lathe(st, [[0.17, 0], [0.18, 0.012], [0.17, 0.025], [0.012, 0.03], [0.012, 0.1]], seg);
  disc(st, 0.17, 0, seg, false);
  const legs = m.part('plain', 'cap', 1);
  for (const sx of [-1, 1]) tube(legs, [[sx * 0.075, 0.08, 0], [sx * 0.08, 0.48, 0.01], [sx * 0.085, 0.9, 0]], (t) => 0.05 + t * 0.022, low ? 6 : 8);
  const body = m.part('plain', null, 2);
  lathe(body, [[0.12, 0.88], [0.15, 0.92], [0.145, 1.02], [0.125, 1.12], [0.15, 1.24], [0.165, 1.34], [0.16, 1.42], [0.11, 1.46], [0.05, 1.48]], seg);
  for (let i = 0; i < body.P.length; i += 3) body.P[i + 2] *= 0.68;
  for (const sx of [-1, 1]) tube(body, [[sx * 0.17, 1.42, 0], [sx * 0.21, 1.14, 0.01], [sx * 0.215, 0.88, 0.04]], (t) => 0.045 - t * 0.012, low ? 5 : 7);
  const skin = m.part('plain', [0.93, 0.91, 0.88], 3);
  lathe(skin, [[0.045, 1.47], [0.042, 1.56]], seg, { flat: true });
  ball(skin, 0, 1.68, 0.01, 0.1, 1.22, low ? 4 : 6, seg);
  for (const sx of [-1, 1]) ball(skin, sx * 0.215, 0.85, 0.045, 0.035, 1.2, 3, 6);
  return m;
};

// a shop's basket: the plastic grid of its walls, its two handles
MAKERS.basket = (low) => {
  const m = new Model();
  const w = 0.42;
  const h = 0.22;
  const d = 0.3;
  m.size = [w, h, d];
  m.label = 'basket';
  const wall = m.part('print', null, 1);
  const t = 0.004;
  // (its four walls, out and in, sloping a little; the bottom)
  const k = 0.03;
  for (const [x0, z0, x1, z1] of [[-w / 2, d / 2, w / 2, d / 2], [w / 2, -d / 2, -w / 2, -d / 2], [w / 2, d / 2, w / 2, -d / 2], [-w / 2, -d / 2, -w / 2, d / 2]]) {
    for (const io of [1, -1]) {
      const nx = (z1 - z0) * io;
      const nz = -(x1 - x0) * io;
      const nl = Math.hypot(nx, nz) || 1;
      const sx = x0 > 0 ? -k : x0 < 0 ? k : 0;
      const sz = z0 > 0 ? -k : z0 < 0 ? k : 0;
      const sx1 = x1 > 0 ? -k : x1 < 0 ? k : 0;
      const sz1 = z1 > 0 ? -k : z1 < 0 ? k : 0;
      const o = io > 0 ? 0 : -t;
      const a = wall.vert(x0 + sx + (nx / nl) * o, 0, z0 + sz + (nz / nl) * o, nx / nl, 0, nz / nl, 0, 0);
      wall.vert(x1 + sx1 + (nx / nl) * o, 0, z1 + sz1 + (nz / nl) * o, nx / nl, 0, nz / nl, 1, 0);
      wall.vert(x1 + (nx / nl) * o, h, z1 + (nz / nl) * o, nx / nl, 0, nz / nl, 1, 1);
      wall.vert(x0 + (nx / nl) * o, h, z0 + (nz / nl) * o, nx / nl, 0, nz / nl, 0, 1);
      if (io > 0) wall.quad(a, a + 1, a + 2, a + 3);
      else wall.quad(a, a + 3, a + 2, a + 1);
    }
  }
  box(m.part('plain', null, 0), -w / 2 + k, 0, -d / 2 + k, w / 2 - k, 0.006, d / 2 - k);
  // the rim
  const rim = m.part('plain', null, 0);
  box(rim, -w / 2, h - 0.012, d / 2 - 0.008, w / 2, h, d / 2);
  box(rim, -w / 2, h - 0.012, -d / 2, w / 2, h, -d / 2 + 0.008);
  box(rim, -w / 2, h - 0.012, -d / 2, -w / 2 + 0.008, h, d / 2);
  box(rim, w / 2 - 0.008, h - 0.012, -d / 2, w / 2, h, d / 2);
  // the handles, folded down to either side
  const hd = m.part('plain', [0.14, 0.14, 0.16], 2);
  for (const s of [1, -1]) tube(hd, [[-w * 0.3, h, s * d * 0.5], [-w * 0.25, h + 0.04, s * d * 0.56], [w * 0.25, h + 0.04, s * d * 0.56], [w * 0.3, h, s * d * 0.5]], 0.007, low ? 4 : 5);
  return m;
};

// a market's paper bag: its printed front and back, its plain sides, open at the top, the top's edge
// folded over
MAKERS.paperBag = () => {
  const m = new Model();
  const w = 0.27;
  const h = 0.31;
  const d = 0.16;
  m.size = [w, h, d];
  m.label = 'bag';
  box(m.part('print', [1, 1, 1], 1), -w / 2, 0, -d / 2, w / 2, h, d / 2, { skip: ['py', 'ny', 'px', 'nx'], label: ['pz', 'nz'] });
  box(m.part('plain', null, 0), -w / 2, 0, -d / 2, w / 2, h, d / 2, { skip: ['py', 'pz', 'nz'] });
  // (the fold along the top, and the inside, darker)
  const f = m.part('plain', null, 2);
  box(f, -w / 2 - 0.002, h - 0.025, d / 2 - 0.004, w / 2 + 0.002, h, d / 2 + 0.003, { skip: ['ny'] });
  box(f, -w / 2 - 0.002, h - 0.025, -d / 2 - 0.003, w / 2 + 0.002, h, -d / 2 + 0.004, { skip: ['ny'] });
  box(m.part('plain', [0.42, 0.3, 0.18], 3), -w / 2 + 0.004, 0.01, -d / 2 + 0.004, w / 2 - 0.004, h - 0.01, d / 2 - 0.004, { skip: ['py'] });
  return m;
};

// the cardboard box the stock comes in: its printed sides, the flaps closed and taped
MAKERS.stockBox = () => {
  const m = new Model();
  const w = 0.42;
  const h = 0.27;
  const d = 0.3;
  m.size = [w, h, d];
  m.label = 'box';
  box(m.part('print', [1, 1, 1], 1), -w / 2, 0, -d / 2, w / 2, h, d / 2, { skip: ['py', 'ny', 'px', 'nx'], label: ['pz', 'nz'] });
  box(m.part('plain', null, 0), -w / 2, 0, -d / 2, w / 2, h, d / 2, { skip: ['pz', 'nz'] });
  box(m.part('plain', [0.82, 0.74, 0.58], 2), -0.03, h, -d / 2 - 0.002, 0.03, h + 0.002, d / 2 + 0.002, { skip: ['ny'] });
  return m;
};

// ------------------------------------------------------------------ the soup they go into
// Per pen: the corners (their places, normals, uvs, colours, ids) of every product put in it - into
// the room's batch as one geometry each (kit.js Batch, { soup: true })
export class PSoup {
  constructor() {
    this.bufs = {};
    this.n = 0;
    // (the room's light: world/products.js roomLight)
    this.light = null;
  }

  buf(pen) {
    let b = this.bufs[pen];
    if (!b) b = this.bufs[pen] = { P: [], N: [], U: [], C: [], I: [], X: [], n: 0 };
    return b;
  }

  get verts() {
    let n = 0;
    for (const b of Object.values(this.bufs)) n += b.n;
    return n;
  }

  geometry(pen) {
    const b = this.bufs[pen];
    if (!b || !b.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.C, 3));
    g.setAttribute('aId', new THREE.Float32BufferAttribute(b.I, 1));
    g.setIndex(b.n > 65535 ? new THREE.Uint32BufferAttribute(b.X, 1) : new THREE.Uint16BufferAttribute(b.X, 1));
    return g;
  }

  // into a batch (kit.js Batch), each pen's soup one geometry
  flushTo(B, pens) {
    for (const pen of Object.keys(this.bufs)) {
      const g = this.geometry(pen);
      if (g) B.add(pens[pen], g, null, nextId(), { soup: true });
    }
    this.bufs = {};
  }
}

// a quad of a cell of the atlas (or of a plain colour, cell null) into a soup: corners a, b, c, d
// (world, counter-clockwise seen from where it faces), its normal n
export function quadInto(S, pen, a, b, c, d, n, col, uv = null, id = nextId()) {
  const B = S.buf(pen);
  const o = B.n;
  const L = lin(col);
  const U = uv ? [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]] : [[0, 0], [Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), 0], [Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2])], [0, Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2])]];
  [a, b, c, d].forEach((p, i) => {
    B.P.push(p[0], p[1], p[2]);
    B.N.push(n[0], n[1], n[2]);
    B.U.push(U[i][0], U[i][1]);
    B.C.push(L[0], L[1], L[2]);
    B.I.push(id);
  });
  B.X.push(o, o + 1, o + 2, o, o + 2, o + 3);
  B.n += 4;
  return id;
}

const _lin = new Map();
export function lin(c) {
  const k = c[0] * 1e6 + c[1] * 1e3 + c[2];
  let v = _lin.get(k);
  if (!v) {
    v = lin3(c[0], c[1], c[2]);
    _lin.set(k, v);
  }
  return v;
}

// ------------------------------------------------------------------ the light put into the colours
// An illustrator's light for a room: from over the shop's front, a little from the left (L, world;
// set per room: setLight). The face towards it a little lighter than the colour, the side away from
// it darker, and the foot of a thing (its lowest tenth) in its own shadow.
const LIGHT = { x: 0, y: 0.86, z: 0.5 };
// the light of the room a soup is for (S.light, world), from over its front, a little from the left
export function roomLight(f) {
  const x = -f.ux * 0.32 + f.nx * 0.48;
  const z = -f.uz * 0.32 + f.nz * 0.48;
  const l = Math.hypot(x, 0.86, z);
  return { x: x / l, y: 0.86 / l, z: z / l };
}
function bake(Lt, nx, ny, nz, foot, dim) {
  const d = nx * Lt.x + ny * Lt.y + nz * Lt.z;
  const k = 0.74 + 0.32 * Math.max(0, d) + 0.05 * ny - 0.06 * Math.max(0, -d);
  return k * (0.8 + 0.2 * foot) * dim;
}

/**
 * A product into soup S: model m (model()), its foot's middle at (x, y, z), turned yaw (its front,
 * +z, towards (sin yaw, cos yaw)), o: { tint: sRGB (the colour of its body), cap: sRGB, cell: the
 * label's cell name, side: the side's cell name, scale, dim: how much of the room's light reaches it
 * (a bottom shelf, the back of a shelf: less), lean: a tilt forward (radians) }
 * Returns the id of its body.
 */
// (counted for the tests: how many corners each model puts in the shops)
export const STATS = { on: false, by: {} };

export function place(S, m, x, y, z, yaw, o = {}) {
  if (S.off) return 0;
  if (STATS.on) STATS.by[m.name] = (STATS.by[m.name] || 0) + m.verts;
  const A = labels();
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const sc = o.scale || 1;
  const dim = o.dim || 1;
  const h = m.size[1] * sc;
  const ids = [];
  for (let k = 0; k < m.subs; k++) ids.push(nextId());
  const tint = o.tint || [0.8, 0.8, 0.8];
  const cell = o.cell ? A.cells.get(o.cell) : null;
  const sideCell = o.side ? A.cells.get(o.side) : null;
  const lean = o.lean || 0;
  const Lt = S.light || LIGHT;
  const cl = Math.cos(lean);
  const sl = Math.sin(lean);
  for (const p of m.parts) {
    const pen = p.pen === 'print' && !(p.cell === 'side' ? sideCell : cell) ? 'plain' : p.pen;
    const B = S.buf(pen);
    const o0 = B.n;
    // (a label with no cell: the product's colour where it would be)
    const col = p.col === null || pen !== p.pen ? tint : p.col === 'cap' ? o.cap || tint : p.col;
    const L = lin(col);
    const uvc = p.pen === 'print' ? (p.cell === 'side' ? sideCell : cell) : null;
    const nv = p.n;
    for (let i = 0; i < nv; i++) {
      let px = p.P[i * 3] * sc;
      let py = p.P[i * 3 + 1] * sc;
      let pz = p.P[i * 3 + 2] * sc;
      let nx = p.N[i * 3];
      let ny = p.N[i * 3 + 1];
      let nz = p.N[i * 3 + 2];
      if (lean) {
        const ty = py * cl - pz * sl;
        const tz = py * sl + pz * cl;
        py = ty;
        pz = tz;
        const ny2 = ny * cl - nz * sl;
        const nz2 = ny * sl + nz * cl;
        ny = ny2;
        nz = nz2;
      }
      // (turned: +z to (sin yaw, cos yaw))
      const wx = px * cy + pz * sy;
      const wz = -px * sy + pz * cy;
      const wnx = nx * cy + nz * sy;
      const wnz = -nx * sy + nz * cy;
      B.P.push(x + wx, y + py, z + wz);
      B.N.push(wnx, ny, wnz);
      let u = p.U[i * 2];
      let v = p.U[i * 2 + 1];
      if (uvc) {
        if (m.turnLabel) {
          const t = u;
          u = v;
          v = 1 - t;
        }
        u = uvc.uv[0] + (uvc.uv[2] - uvc.uv[0]) * Math.min(1, Math.max(0, u));
        v = uvc.uv[1] + (uvc.uv[3] - uvc.uv[1]) * Math.min(1, Math.max(0, v));
      }
      B.U.push(u, v);
      const k = bake(Lt, wnx, ny, wnz, Math.min(1, py / Math.max(0.01, h * 0.12)), dim);
      B.C.push(L[0] * k, L[1] * k, L[2] * k);
      B.I.push(ids[p.sub] || ids[0]);
    }
    for (const xi of p.X) B.X.push(o0 + xi);
    B.n += nv;
  }
  S.n++;
  return ids[0];
}

// ------------------------------------------------------------------ what each kind of product looks like
// Products by what they are (the shelves' categories): the model, its label's cells (picked from in
// turn), the colours of its body and its cap (sRGB). A shelf of a category takes them in groups of
// the same, side by side (world/market.js).
export const LINES = {
  soda: { model: 'soda', cells: [0, 1, 2, 3, 4, 5].map((i) => `bottle.soda${i}`), tints: [[0.42, 0.16, 0.1], [0.62, 0.86, 0.4], [0.98, 0.56, 0.16], [0.42, 0.16, 0.42], [0.16, 0.1, 0.08], [0.98, 0.74, 0.56]], caps: [[0.86, 0.14, 0.18], [0.24, 0.62, 0.3], [0.96, 0.5, 0.14], [0.5, 0.2, 0.55], [0.14, 0.14, 0.16], [0.98, 0.62, 0.42]] },
  water: { model: 'water', cells: ['bottle.water0', 'bottle.water1'], tints: [[0.78, 0.9, 0.98], [0.7, 0.84, 0.96]], caps: [[0.24, 0.46, 0.86], [0.12, 0.3, 0.7]] },
  cans: { model: 'can', cells: [0, 1, 2, 3, 4, 5].map((i) => `can.soda${i}`).concat(['can.energy0']), tints: [[0.8, 0.8, 0.8]] },
  juice: { model: 'juice', cells: ['bottle.juice0', 'bottle.juice1'], tints: [[0.98, 0.64, 0.12], [0.86, 0.62, 0.26]], caps: [[0.2, 0.55, 0.22], [0.86, 0.2, 0.2]] },
  cartons: { model: 'carton', cells: ['carton.milk0', 'carton.milk1', 'carton.juice0', 'carton.juice1'], tints: [[0.96, 0.96, 0.94], [0.96, 0.96, 0.94], [0.98, 0.84, 0.4], [0.94, 0.86, 0.72]] },
  yogurt: { model: 'yogurt', cells: ['can.soda5', 'can.soda3', 'can.soda1'], tints: [[0.97, 0.94, 0.9], [0.9, 0.82, 0.92], [0.92, 0.95, 0.86]] },
  tins: { model: 'tin', cells: [0, 1, 2, 3, 4, 5].map((i) => `can.tin${i}`), tints: [[0.8, 0.8, 0.8]] },
  jars: { model: 'jar', cells: [0, 1, 2, 3, 4].map((i) => `jar.${i}`), tints: [[0.55, 0.08, 0.12], [0.62, 0.38, 0.16], [0.42, 0.56, 0.2], [0.86, 0.56, 0.12], [0.8, 0.26, 0.12]], caps: [[0.86, 0.84, 0.8], [0.2, 0.36, 0.7], [0.86, 0.2, 0.2], [0.9, 0.7, 0.2], [0.2, 0.2, 0.22]] },
  sauce: { model: 'sauce', cells: ['bottle.sauce0'], tints: [[0.72, 0.1, 0.08]], caps: [[0.96, 0.95, 0.92]] },
  oil: { model: 'oil', cells: ['bottle.sauce1'], tints: [[0.86, 0.72, 0.2]], caps: [[0.2, 0.42, 0.14]] },
  cereal: { model: 'cereal', cells: [0, 1, 2, 3].map((i) => `box.cereal${i}`), side: 'side.light', tints: [[0.9, 0.62, 0.14], [0.2, 0.42, 0.78], [0.36, 0.22, 0.14], [0.88, 0.82, 0.64]] },
  dry: { model: 'dry', cells: [0, 1, 2, 3].map((i) => `box.dry${i}`), side: 'side.light', tints: [[0.14, 0.36, 0.66], [0.84, 0.28, 0.12], [0.94, 0.9, 0.82], [0.2, 0.38, 0.7]] },
  small: { model: 'small', cells: [0, 1, 2, 3].map((i) => `small.${i}`), side: 'side.dark', tints: [[0.18, 0.3, 0.24], [0.9, 0.82, 0.42], [0.6, 0.34, 0.14], [0.26, 0.66, 0.54]] },
  meds: { model: 'small', cells: [0, 1, 2, 3].map((i) => `small.med${i}`), side: 'side.light', tints: [[0.96, 0.96, 0.94], [0.94, 0.78, 0.56], [0.36, 0.5, 0.8], [0.96, 0.7, 0.18]] },
  chips: { model: 'chips', cells: [0, 1, 2, 3].map((i) => `bag.chips${i}`), tints: [[0.9, 0.74, 0.14], [0.46, 0.18, 0.12], [0.2, 0.54, 0.3], [0.16, 0.3, 0.56]] },
  coffee: { model: 'coffee', cells: [0, 1, 2, 3].map((i) => `bag.dry${i}`), tints: [[0.16, 0.12, 0.1], [0.94, 0.92, 0.86], [0.96, 0.95, 0.92], [0.9, 0.86, 0.78]] },
  bread: { model: 'loaf', cells: ['bag.bread0', 'bag.bread1'], tints: [[0.94, 0.88, 0.76], [0.95, 0.93, 0.88]] },
  clean: { model: 'jug', cells: ['jug.0', 'jug.1', 'jug.2'], tints: [[0.18, 0.42, 0.82], [0.88, 0.84, 0.96], [0.18, 0.66, 0.38]], caps: [[0.96, 0.95, 0.92], [0.55, 0.42, 0.8], [0.98, 0.9, 0.3]] },
  candy: { model: 'candy', cells: [0, 1, 2, 3, 4, 5].map((i) => `candy.${i}`), tints: [[0.8, 0.8, 0.8]] },
};

// the fruit and vegetables: the model, its colours (a little different, each one)
export const PRODUCE = {
  apple: { model: 'apple', cols: [[0.82, 0.16, 0.14], [0.86, 0.24, 0.16], [0.7, 0.12, 0.12], [0.88, 0.32, 0.18]], card: 0 },
  greenApple: { model: 'apple', cols: [[0.56, 0.78, 0.26], [0.62, 0.82, 0.3], [0.5, 0.72, 0.22]], card: 0 },
  orange: { model: 'orange', cols: [[0.98, 0.56, 0.1], [0.96, 0.6, 0.14], [0.98, 0.5, 0.08]], card: 1 },
  banana: { model: 'banana', cols: [[0.98, 0.84, 0.26], [0.96, 0.86, 0.32], [0.9, 0.8, 0.22]], card: 2 },
  lemon: { model: 'lemon', cols: [[0.98, 0.88, 0.24], [0.96, 0.84, 0.2]], card: 3 },
  tomato: { model: 'tomato', cols: [[0.86, 0.16, 0.1], [0.8, 0.14, 0.08], [0.9, 0.24, 0.12]], card: 4 },
  avocado: { model: 'avocado', cols: [[0.24, 0.34, 0.14], [0.2, 0.3, 0.12], [0.3, 0.4, 0.16]], card: 5 },
  onion: { model: 'onion', cols: [[0.82, 0.6, 0.36], [0.78, 0.56, 0.32], [0.62, 0.24, 0.36]], card: 6 },
  lime: { model: 'lemon', cols: [[0.42, 0.7, 0.18], [0.36, 0.64, 0.16]], card: 7 },
  pepper: { model: 'pepper', cols: [[0.86, 0.14, 0.1], [0.96, 0.78, 0.12], [0.3, 0.6, 0.2]], card: 8 },
};
