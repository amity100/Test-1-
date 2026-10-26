// (ROADMAP 11.31, the mock-ups) The great mall in three looks, sketched in the game itself for
// pictures to choose from: a palace of glass, Miami's art deco, the future. It stands where it
// would - the mall's block and the next one west, Second Avenue between them closed - two and a
// half times the old mall, five floors round a court and a nave open to the roof, and a crown
// seen from far off. Only for the pictures: the test page (harness.js) builds it, photographs it
// and lets it go. Nothing of it is in the game.
import * as THREE from 'three';
import { srgb, hex, makeSurface } from '/v5/js/render/materials.js';
import { Facade, nextId, seeded } from '/v5/js/world/kit.js';
import { palm } from '/v5/js/world/palms.js';
import { blockCtx } from '/v5/js/world/mainland/blocks.js';
import { CURB, M_BLOCKS } from '/v5/js/world/mainland/plan.js';
import { sign } from '/v5/js/world/mainland/mall.js';

// the two blocks and the avenue between them; the building inside it
export const LOT = { x0: -958, x1: -802, z0: -92, z1: 18 };
export const SITE = { x0: -956, x1: -804, z0: -88, z1: 14, blocks: [105, 106] };
export const CX = (SITE.x0 + SITE.x1) / 2;
export const CZ = (SITE.z0 + SITE.z1) / 2;
const G = CURB;
const FH = 5.4;
const NF = 5;
export const ROOF = G + NF * FH;
const LV = Array.from({ length: NF + 1 }, (_, k) => G + k * FH);
// the void through the floors: an oval court in the middle, a nave east and west of it
export const VOID = { rx: 24, rz: 20, x0: SITE.x0 + 22, x1: SITE.x1 - 22, hw: 8 };
const GAL = 4.2;
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ shapes
function area(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % pts.length];
    a += x0 * z1 - x1 * z0;
  }
  return a / 2;
}

// each corner's way out (the mitre of its two sides)
function normals(pts) {
  const s = area(pts) > 0 ? 1 : -1;
  const n = pts.length;
  const e = (a, b) => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    return [(s * dz) / l, (-s * dx) / l];
  };
  const out = [];
  for (let i = 0; i < n; i++) {
    const n1 = e(pts[(i - 1 + n) % n], pts[i]);
    const n2 = e(pts[i], pts[(i + 1) % n]);
    let mx = n1[0] + n2[0];
    let mz = n1[1] + n2[1];
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml;
    mz /= ml;
    const k = 1 / Math.max(0.4, mx * n1[0] + mz * n1[1]);
    out.push([mx * k, mz * k]);
  }
  return out;
}

const offset = (pts, d) => {
  const N = normals(pts);
  return pts.map(([x, z], i) => [x + N[i][0] * d, z + N[i][1] * d]);
};

export function roundRect(x0, z0, x1, z1, r, seg = 8) {
  const pts = [];
  const cs = [[x1 - r, z0 + r, -Math.PI / 2, 0], [x1 - r, z1 - r, 0, Math.PI / 2], [x0 + r, z1 - r, Math.PI / 2, Math.PI], [x0 + r, z0 + r, Math.PI, 1.5 * Math.PI]];
  for (const [cx, cz, a0, a1] of cs) for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg;
    pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return pts;
}

function superellipse(cx, cz, a, b, n = 2.6, seg = 96) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const t = (i / seg) * TAU;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push([cx + a * Math.sign(c) * Math.abs(c) ** (2 / n), cz + b * Math.sign(s) * Math.abs(s) ** (2 / n)]);
  }
  return pts;
}

const ellipse = (cx, cz, rx, rz, seg = 64) => Array.from({ length: seg }, (_, i) => [cx + rx * Math.cos((i / seg) * TAU), cz + rz * Math.sin((i / seg) * TAU)]);

// the void's outline, d further out: the nave's two sides, the court's two arcs
export function voidPath(d = 0, n = 28) {
  const rx = VOID.rx + d;
  const rz = VOID.rz + d;
  const hw = VOID.hw + d;
  const x0 = VOID.x0 - d;
  const x1 = VOID.x1 + d;
  const a = Math.asin(Math.min(0.999, hw / rz));
  const xi = rx * Math.cos(a);
  const pts = [[x0, CZ - hw], [CX - xi, CZ - hw]];
  for (let i = 1; i < n; i++) {
    const t = Math.PI + a + ((Math.PI - 2 * a) * i) / n;
    pts.push([CX + rx * Math.cos(t), CZ + rz * Math.sin(t)]);
  }
  pts.push([CX + xi, CZ - hw], [x1, CZ - hw], [x1, CZ + hw], [CX + xi, CZ + hw]);
  for (let i = 1; i < n; i++) {
    const t = a + ((Math.PI - 2 * a) * i) / n;
    pts.push([CX + rx * Math.cos(t), CZ + rz * Math.sin(t)]);
  }
  pts.push([CX - xi, CZ + hw], [x0, CZ + hw]);
  return pts;
}

// where the nave meets the court (x either side of the middle)
const navesJoin = () => VOID.rx * Math.cos(Math.asin(VOID.hw / VOID.rz));

// points along a line every step metres (closed: round to the start), with how far along
function resample(pts, step) {
  const out = [];
  const n = pts.length;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.max(1, Math.ceil(L / step));
    for (let j = 0; j < k; j++) out.push({ p: [a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k], s: s + (L * j) / k });
    s += L;
  }
  return { pts: out, len: s };
}

function geoFrom(pos) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// a strip standing along a line from y0 to y1, both faces (closed: round to the start)
function strip(pts, y0, y1, closed = true) {
  const pos = [];
  const n = pts.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[(i + 1) % n];
    pos.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y0, az, bx, y1, bz, ax, y1, az);
    pos.push(ax, y0, az, bx, y1, bz, bx, y0, bz, ax, y0, az, ax, y1, az, bx, y1, bz);
  }
  return geoFrom(pos);
}

// a flat shape (with holes) from y0 to y1 - or one face at y0 (y1 null)
function plate(outer, holes, y0, y1 = null) {
  const shape = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  const g = y1 === null ? new THREE.ShapeGeometry(shape) : new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

// a box on the segment a-b: from y0 to y1, w0..w1 out from it (sg: which side is out)
function segGeo(a, b, y0, y1, w0, w1, sg) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  if (len < 1e-3) return null;
  const tx = dx / len;
  const tz = dz / len;
  const nx = sg * tz;
  const nz = -sg * tx;
  const g = new THREE.BoxGeometry(len + 0.03, Math.max(0.01, y1 - y0), Math.max(0.01, Math.abs(w1 - w0)));
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(tx, 0, tz), UP, new THREE.Vector3(-tz, 0, tx));
  m.setPosition((a[0] + b[0]) / 2 + (nx * (w0 + w1)) / 2, (y0 + y1) / 2, (a[1] + b[1]) / 2 + (nz * (w0 + w1)) / 2);
  return g.applyMatrix4(m);
}

// the faces turned in (a dome seen from under it)
function flip(g) {
  if (g.index) g = g.toNonIndexed();
  const p = g.attributes.position.array;
  for (let i = 0; i < p.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      const t = p[i + 3 + k];
      p[i + 3 + k] = p[i + 6 + k];
      p[i + 6 + k] = t;
    }
  }
  g.computeVertexNormals();
  return g;
}

function tube(pts, r, closed = false, segs = 0) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), closed);
  return new THREE.TubeGeometry(curve, segs || pts.length * 3, r, 5, closed);
}

// a profile [[across, up], ...] drawn out along x (a nave's roof) or along z (an arch's)
function vault(profile, axis, a0, a1, c, y0) {
  const pos = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const [p0, h0] = profile[i];
    const [p1, h1] = profile[i + 1];
    const P = (along, across, h) => (axis === 'x' ? [along, y0 + h, c + across] : [c + across, y0 + h, along]);
    const q = [P(a0, p0, h0), P(a1, p0, h0), P(a1, p1, h1), P(a0, p1, h1)];
    pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
    pos.push(...q[0], ...q[2], ...q[1], ...q[0], ...q[3], ...q[2]);
  }
  return geoFrom(pos);
}

const arc = (hw, h, n = 16) => Array.from({ length: n + 1 }, (_, i) => {
  const t = Math.PI - (Math.PI * i) / n;
  return [hw * Math.cos(t), h * Math.sin(t)];
});

// a wall's face: shapes in its own (u along it, v up), w out from it
function onWall(a, b, sg, w, tris) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const L = Math.hypot(dx, dz) || 1;
  const tx = dx / L;
  const tz = dz / L;
  const nx = sg * tz;
  const nz = -sg * tx;
  const pos = [];
  for (const [u, v] of tris) pos.push(a[0] + tx * u + nx * w, v, a[1] + tz * u + nz * w);
  const n = pos.length / 9;
  // (both faces)
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    pos.push(pos[o], pos[o + 1], pos[o + 2], pos[o + 6], pos[o + 7], pos[o + 8], pos[o + 3], pos[o + 4], pos[o + 5]);
  }
  return geoFrom(pos);
}

const rectUV = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]];
const fanUV = (u, v, r0, r1, a0, a1, n) => {
  const t = [];
  for (let i = 0; i < n; i++) {
    const A = a0 + ((a1 - a0) * i) / n;
    const B = a0 + ((a1 - a0) * (i + 1)) / n;
    const p = (r, x) => [u + Math.cos(x) * r, v + Math.sin(x) * r];
    if (r0 <= 0) t.push([u, v], p(r1, A), p(r1, B));
    else t.push(p(r0, A), p(r1, A), p(r1, B), p(r0, A), p(r1, B), p(r0, B));
  }
  return t;
};

// the straight runs of a line (longer than min)
function straights(pts, min = 12) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L >= min) out.push({ a, b, L });
  }
  return out;
}

// ------------------------------------------------------------------ the pens
let PENS = null;
function pens(M) {
  if (PENS) return PENS;
  const glass = (c) => makeSurface({ kind: 'glass', color: c, gloss: 0.85, lit: 0.3 });
  PENS = {
    gold: makeSurface({ kind: 'box', vcolor: true, gloss: 0.9, line: 0.55 }),
    goldIn: makeSurface({ kind: 'box', vcolor: true, gloss: 0.9, indoor: true, wash: 0.7, line: 0.55 }),
    sky: glass(srgb(0.66, 0.84, 0.97)),
    mid: glass(srgb(0.42, 0.66, 0.9)),
    deep: glass(srgb(0.22, 0.4, 0.68)),
    aqua: glass(srgb(0.44, 0.86, 0.88)),
    teal: glass(srgb(0.16, 0.52, 0.6)),
    rose: glass(srgb(0.95, 0.72, 0.8)),
    dark: glass(srgb(0.12, 0.14, 0.22)),
  };
  return PENS;
}

// ------------------------------------------------------------------ the inside (all three)
// the floors round the void: their edges dressed, glass rails, the stores behind, columns, the
// court's centre and the roof over it seen from below (the look's own)
function inside(c, T) {
  const { R, M, P } = c;
  const add = (mat, g, col) => g && R.add(mat, g, null, nextId(), col ? { color: col } : undefined);
  const vp = voidPath(0);
  const sg = area(vp) > 0 ? 1 : -1;
  const inner = T.inner || roundRect(SITE.x0 + 1.5, SITE.z0 + 1.5, SITE.x1 - 1.5, SITE.z1 - 1.5, 6);
  // the ground floor, its stone, and the rings set in it round the court
  add(M.inGloss, plate(inner, [], G + 0.03), T.floor);
  for (const [d, w, col] of T.inlays || []) add(P.goldIn, plate(ellipse(CX, CZ, VOID.rx - d, VOID.rz - d), [ellipse(CX, CZ, VOID.rx - d - w, VOID.rz - d - w)], G + 0.045), col);
  for (let k = 1; k < NF; k++) {
    const y = LV[k];
    add(M.inBox, plate(inner, [vp], y - 0.55, y), T.slab);
    // the edge: its face, a line of gold, a line of light under it
    add(M.inBox, strip(offset(vp, -0.04), y - 1.15, y + 0.04), typeof T.fascia === 'function' ? T.fascia(k) : T.fascia);
    add(P.goldIn, strip(offset(vp, -0.08), y - 0.08, y + 0.03), T.edge);
    add(M.inLamp, strip(offset(vp, -0.08), y - 1.22, y - 1.12), typeof T.led === 'function' ? T.led(k) : T.led);
    // the rail: glass, its top
    add(M.glint, strip(offset(vp, 0.12), y, y + 1.1));
    for (let i = 0; i < vp.length; i++) add(P.goldIn, segGeo(vp[i], vp[(i + 1) % vp.length], y + 1.06, y + 1.16, 0.06, 0.2, sg), T.rail);
  }
  // the stores on every floor: a front of glass lit from inside, its sign above, a pier between
  const { pts: sp } = resample(voidPath(GAL), 1.25);
  const MOD = 7.6;
  const acc = new Map();
  const quad = (mat, col, a, b, y0, y1) => {
    const key = `${mat.uuid}|${col.r.toFixed(3)},${col.g.toFixed(3)},${col.b.toFixed(3)}`;
    if (!acc.has(key)) acc.set(key, { mat, col, pos: [] });
    const p = acc.get(key).pos;
    p.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]);
    p.push(a[0], y0, a[1], b[0], y1, b[1], b[0], y0, b[1], a[0], y0, a[1], a[0], y1, a[1], b[0], y1, b[1]);
  };
  for (let k = 0; k < NF; k++) {
    const y = LV[k];
    const top = (k < NF - 1 ? LV[k + 1] - 0.55 : ROOF - 0.6);
    for (let i = 0; i < sp.length; i++) {
      const A = sp[i];
      const Bp = sp[(i + 1) % sp.length];
      const m = Math.floor((A.s + 0.6) / MOD);
      const u = (A.s + 0.6) % MOD;
      if (u < 0.95) quad(M.inBox, T.pier, A.p, Bp.p, y, top);
      else {
        quad(M.inLamp, T.glow[(m * 7 + k * 3) % T.glow.length], A.p, Bp.p, y + 0.1, y + 3.5);
        quad(M.inBox, T.signs[(m * 5 + k * 2) % T.signs.length], A.p, Bp.p, y + 3.55, y + 4.4);
        quad(M.inBox, T.wallIn, A.p, Bp.p, y + 4.4, top);
      }
    }
  }
  for (const { mat, col, pos } of acc.values()) R.add(mat, geoFrom(pos), null, nextId(), { color: col });
  // columns at the void's edge, full height, their capitals at every floor
  if (T.column) {
    const { pts: cp } = resample(voidPath(1.1), 11);
    for (const { p } of cp) {
      const g = new THREE.CylinderGeometry(0.42, 0.42, ROOF - G, 14);
      g.translate(p[0], (ROOF + G) / 2, p[1]);
      add(M.inGloss, g, T.column);
      for (let k = 1; k < NF; k++) {
        const cap = new THREE.CylinderGeometry(0.6, 0.48, 0.35, 14);
        cap.translate(p[0], LV[k] - 1.35, p[1]);
        add(P.goldIn, cap, T.capital || T.edge);
      }
    }
  }
}

// a dome over the court: its glass in bands (darker low, lighter high), ribs, rings, the sky in it
function dome(c, o) {
  const { B, R, M, P } = c;
  const { rx, rz, y0, h, ribs = 24, bands } = o;
  const n = bands.length;
  for (let i = 0; i < n; i++) {
    const t0 = (Math.PI / 2) * (1 - (i + 1) / n);
    const t1 = (Math.PI / 2) * (1 - i / n);
    const g = new THREE.SphereGeometry(1, 56, 3, 0, TAU, t0, t1 - t0);
    g.scale(rx, h, rz);
    g.translate(CX, y0, CZ);
    B.add(bands[i], g, null, nextId());
  }
  // (from under it: the sky)
  const s = new THREE.SphereGeometry(1, 48, 10, 0, TAU, 0, Math.PI / 2);
  s.scale(rx - 0.3, h - 0.3, rz - 0.3);
  s.translate(CX, y0, CZ);
  R.add(M.neonSoft, flip(s), null, nextId(), { color: o.skyIn || srgb(0.34, 0.52, 0.78) });
  const P3 = (th, ph, k = 1.012) => [CX + rx * k * Math.sin(th) * Math.cos(ph), y0 + h * k * Math.cos(th), CZ + rz * k * Math.sin(th) * Math.sin(ph)];
  for (let i = 0; i < ribs; i++) {
    const ph = (i / ribs) * TAU;
    const pts = [];
    for (let j = 0; j <= 12; j++) pts.push(P3((Math.PI / 2) * (j / 12), ph));
    B.add(o.ribPen || P.gold, tube(pts, o.ribR || 0.28), null, nextId(), { color: o.rib });
    // (and under it)
    const pi = [];
    for (let j = 0; j <= 12; j++) pi.push(P3((Math.PI / 2) * (j / 12), ph, 0.975));
    R.add(P.goldIn, tube(pi, 0.2), null, nextId(), { color: o.ribIn || o.rib });
  }
  for (const th of o.rings || [0.6, 1.05, Math.PI / 2 - 0.02]) {
    const pts = [];
    for (let j = 0; j < 48; j++) pts.push(P3(th, (j / 48) * TAU));
    B.add(o.ribPen || P.gold, tube(pts, (o.ribR || 0.28) * 1.2, true, 96), null, nextId(), { color: o.rib });
  }
  if (o.led) {
    const pts = [];
    for (let j = 0; j < 48; j++) pts.push(P3(Math.PI / 2 - 0.03, (j / 48) * TAU, 1.03));
    B.add(M.neon, tube(pts, 0.16, true, 96), null, nextId(), { color: o.led });
  }
}

// a nave's roof of glass west and east of the court: profile across, ribs, the sky under it
function naveRoofs(c, o) {
  const { B, R, M, P } = c;
  const xi = navesJoin();
  const runs = [[VOID.x0 - 0.5, CX - xi + 2], [CX + xi - 2, VOID.x1 + 0.5]];
  const prof = o.profile;
  for (const [a0, a1] of runs) {
    B.add(o.glass, vault(prof, 'x', a0, a1, CZ, ROOF), null, nextId());
    R.add(M.neonSoft, vault(prof.map(([p, h]) => [p * 0.97, h - 0.15]), 'x', a0, a1, CZ, ROOF), null, nextId(), { color: o.skyIn || srgb(0.34, 0.52, 0.78) });
    for (let x = a0 + 1; x < a1; x += o.ribStep || 4) B.add(o.ribPen || P.gold, tube(prof.map(([p, h]) => [x, ROOF + h + 0.06, CZ + p]), 0.2), null, nextId(), { color: o.rib });
    B.add(o.ribPen || P.gold, tube([[a0, ROOF + o.ridge + 0.08, CZ], [a1, ROOF + o.ridge + 0.08, CZ]], 0.26, false, 4), null, nextId(), { color: o.rib });
  }
}

// a fountain: basins one over the other, water in them, a jet
function fountain(c, x, z, tiers, o) {
  const { B, M } = c;
  let y = G;
  for (const [r, h] of tiers) {
    const g = new THREE.CylinderGeometry(r, r * 0.92, h, 32);
    g.translate(x, y + h / 2, z);
    B.add(o.stonePen || M.frame, g, null, nextId(), { color: o.stone });
    const rim = new THREE.TorusGeometry(r, 0.12, 6, 40).rotateX(Math.PI / 2);
    rim.translate(x, y + h, z);
    B.add(o.rimPen, rim, null, nextId(), { color: o.rim });
    const w = new THREE.CircleGeometry(r - 0.2, 32).rotateX(-Math.PI / 2);
    w.translate(x, y + h - 0.12, z);
    B.add(M.pool, w, null, nextId());
    y += h + (o.gap || 0.9);
  }
  const jet = new THREE.CylinderGeometry(0.18, 0.32, o.jet || 3, 10);
  jet.translate(x, y + (o.jet || 3) / 2 - 0.9, z);
  B.add(M.neonSoft, jet, null, nextId(), { color: srgb(0.8, 0.92, 1) });
}

// (no walls of their own: the pictures only)
const NOCOL = { addCircle() {}, addBox() {} };
function palms(c, list, h0, h1, col, y0 = G) {
  const pc = { B: c.B, M: c.M, col: NOCOL };
  for (const [x, z] of list) palm(pc, c.rng, x, z, c.rng.range(h0, h1), { royal: col, y0 });
}

// lit letters on a wall facing n (reads left to right for whoever faces it)
function letters(c, text, x, z, nx, nz, v, h, col, w = 0.25) {
  sign({ B: c.B }, new Facade(x, z, nz, -nx, nx, nz), c.M.neon, text, 0, v, w, h, col);
}

// the paving round the building: the two blocks' and the avenue's ground
function ground(c, col) {
  const g = new THREE.PlaneGeometry(LOT.x1 - LOT.x0 + 6, LOT.z1 - LOT.z0 + 6).rotateX(-Math.PI / 2);
  g.translate((LOT.x0 + LOT.x1) / 2, G + 0.014, (LOT.z0 + LOT.z1) / 2);
  const uv = g.attributes.uv;
  const p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 8, -p.getZ(i) / 8);
  c.B.add(c.M.plaza, g, null, nextId(), col ? { color: col } : undefined);
}

// ------------------------------------------------------------------ A: the palace of glass
const A = {
  name: 'palace',
  build(c) {
    const { B, M, P } = c;
    const add = (mat, g, col) => g && B.add(mat, g, null, nextId(), col ? { color: col } : undefined);
    const STONE = hex('#f6f1e7');
    const STONE2 = hex('#e8dfcd');
    const GOLD = hex('#d8a740');
    const GOLD2 = hex('#ffd779');
    const WARM = srgb(1, 0.86, 0.6);
    ground(c);
    const foot = roundRect(SITE.x0, SITE.z0, SITE.x1, SITE.z1, 14, 10);
    const sg = area(foot) > 0 ? 1 : -1;
    const up = offset(foot, -1.8);
    // the base: two floors of white stone, arched windows, pilasters, the cornice
    add(M.wallSolid, strip(foot, G - 0.2, LV[2]), STONE);
    for (const { a, b, L } of straights(foot, 20)) {
      const n = Math.floor((L - 6) / 9);
      const u0 = (L - (n - 1) * 9) / 2;
      for (let i = 0; i < n; i++) {
        const u = u0 + i * 9;
        // (the north front's middle: the great doors' arch)
        const mx = a[0] + ((b[0] - a[0]) * u) / L;
        const mz = a[1] + ((b[1] - a[1]) * u) / L;
        if (Math.abs(mz - SITE.z0) < 1 && Math.abs(mx - CX) < 19) continue;
        add(P.deep, onWall(a, b, sg, 0.1, rectUV(u - 2.9, G + 0.8, u + 2.9, G + 4.4)));
        add(P.mid, onWall(a, b, sg, 0.1, rectUV(u - 2.9, G + 4.4, u + 2.9, G + 7.4)));
        add(P.sky, onWall(a, b, sg, 0.1, fanUV(u, G + 7.4, 0, 2.9, 0, Math.PI, 12)));
        add(M.glint, onWall(a, b, sg, 0.16, rectUV(u - 2.9, G + 0.8, u + 2.9, G + 7.4)));
        add(M.frame, onWall(a, b, sg, 0.2, fanUV(u, G + 7.4, 2.9, 3.6, 0, Math.PI, 12)), STONE2);
        add(P.gold, onWall(a, b, sg, 0.24, rectUV(u - 0.35, G + 10.25, u + 0.35, G + 11.2)), GOLD);
        // the pier between, its gold capital
        const pu = u + 4.5;
        if (pu < L - 2) {
          const p0 = [a[0] + ((b[0] - a[0]) * (pu - 0.7)) / L, a[1] + ((b[1] - a[1]) * (pu - 0.7)) / L];
          const p1 = [a[0] + ((b[0] - a[0]) * (pu + 0.7)) / L, a[1] + ((b[1] - a[1]) * (pu + 0.7)) / L];
          add(M.wallSolid, segGeo(p0, p1, G, LV[2] - 0.7, 0, 0.55, sg), STONE2);
          add(P.gold, segGeo(p0, p1, LV[2] - 1.4, LV[2] - 1.05, 0, 0.7, sg), GOLD);
        }
      }
    }
    for (let i = 0; i < foot.length; i++) {
      const a = foot[i];
      const b = foot[(i + 1) % foot.length];
      add(M.wallSolid, segGeo(a, b, LV[2] - 0.65, LV[2] + 0.05, -0.2, 1.3, sg), STONE);
      add(P.gold, segGeo(a, b, LV[2] - 0.82, LV[2] - 0.65, 1.15, 1.32, sg), GOLD);
      add(M.neonSoft, segGeo(a, b, LV[2] - 1.0, LV[2] - 0.9, 0.7, 0.8, sg), WARM);
      // the upper floors' cornice, its gold, its light
      add(M.wallSolid, segGeo(up[i], up[(i + 1) % up.length], ROOF - 0.45, ROOF + 0.95, -0.3, 1.7, sg), STONE);
      add(P.gold, segGeo(up[i], up[(i + 1) % up.length], ROOF - 0.62, ROOF - 0.45, 1.5, 1.72, sg), GOLD);
      add(M.neonSoft, segGeo(up[i], up[(i + 1) % up.length], ROOF - 0.82, ROOF - 0.72, 1.0, 1.1, sg), WARM);
      // the floors' fins across the glass
      for (const k of [3, 4]) {
        add(M.wallSolid, segGeo(up[i], up[(i + 1) % up.length], LV[k] - 0.16, LV[k] + 0.12, 0, 0.95, sg), STONE);
        add(P.gold, segGeo(up[i], up[(i + 1) % up.length], LV[k] - 0.18, LV[k] - 0.1, 0.9, 1.0, sg), GOLD);
      }
    }
    // the terrace on the base: its floor, planters along its edge
    add(M.wallSolid, plate(foot, [up], LV[2] - 0.2, LV[2] + 0.06), STONE);
    for (const { a, b, L } of straights(foot, 20)) for (let u = 4; u < L - 3; u += 5.5) {
      const p0 = [a[0] + ((b[0] - a[0]) * (u - 1.2)) / L, a[1] + ((b[1] - a[1]) * (u - 1.2)) / L];
      const p1 = [a[0] + ((b[0] - a[0]) * (u + 1.2)) / L, a[1] + ((b[1] - a[1]) * (u + 1.2)) / L];
      add(M.wallSolid, segGeo(p0, p1, LV[2], LV[2] + 0.7, -1.2, -0.4, sg), STONE2);
      add(M.leaf, segGeo(p0, p1, LV[2] + 0.6, LV[2] + 1.5, -1.15, -0.45, sg), srgb(0.32, 0.6, 0.3));
    }
    // the upper floors: glass all round, darker low and lighter high, the glint of it, mullions
    const bands = [P.deep, P.mid, P.sky];
    for (let k = 2; k < NF; k++) {
      add(bands[k - 2], strip(up, LV[k], LV[k + 1]));
      add(M.glint, strip(offset(up, 0.06), LV[k] + 0.2, LV[k + 1] - 0.2));
    }
    for (const { a, b, L } of straights(up, 8)) for (let u = 1.5; u < L; u += 3) {
      const p0 = [a[0] + ((b[0] - a[0]) * (u - 0.09)) / L, a[1] + ((b[1] - a[1]) * (u - 0.09)) / L];
      const p1 = [a[0] + ((b[0] - a[0]) * (u + 0.09)) / L, a[1] + ((b[1] - a[1]) * (u + 0.09)) / L];
      add(M.frame, segGeo(p0, p1, LV[2], ROOF, 0, 0.32, sg), STONE);
    }
    for (const p of up.filter((_, i) => i % 2 === 0)) {
      const g = new THREE.BoxGeometry(0.2, ROOF - LV[2], 0.2);
      g.translate(p[0], (ROOF + LV[2]) / 2, p[1]);
      add(M.frame, g, STONE);
    }
    // the roof, its parapet
    add(M.wallSolid, plate(up, [voidPath(0)], ROOF - 0.6, ROOF), STONE2);
    add(M.wallSolid, strip(offset(up, -0.4), ROOF, ROOF + 1.3), STONE);
    // the dome on its drum: glass in bands, gold ribs, a lantern, its spire
    const DR = { rx: VOID.rx + 1.2, rz: VOID.rz + 1.2 };
    const drum = ellipse(CX, CZ, DR.rx, DR.rz, 64);
    add(P.mid, strip(drum, ROOF, ROOF + 7.5));
    add(M.glint, strip(offset(drum, 0.08), ROOF + 0.3, ROOF + 7.2));
    for (let i = 0; i < 32; i++) {
      const t = (i / 32) * TAU;
      const g = new THREE.BoxGeometry(0.8, 7.5, 0.8);
      g.translate(CX + Math.cos(t) * (DR.rx + 0.1), ROOF + 3.75, CZ + Math.sin(t) * (DR.rz + 0.1));
      add(M.wallSolid, g, STONE);
    }
    add(M.wallSolid, strip(ellipse(CX, CZ, DR.rx + 0.6, DR.rz + 0.6, 64), ROOF + 7.5, ROOF + 8.4), STONE);
    add(P.gold, strip(ellipse(CX, CZ, DR.rx + 0.75, DR.rz + 0.75, 64), ROOF + 8.2, ROOF + 8.5), GOLD);
    const DY = ROOF + 8.4;
    const DH = 25;
    dome(c, { rx: DR.rx, rz: DR.rz, y0: DY, h: DH, bands: [P.deep, P.mid, P.mid, P.sky, P.sky], rib: GOLD, ribs: 24, rings: [0.5, 0.95, 1.3], led: WARM });
    const lan = new THREE.CylinderGeometry(3.2, 3.2, 4.4, 24);
    lan.translate(CX, DY + DH + 2.0, CZ);
    add(P.sky, lan);
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * TAU;
      const g = new THREE.BoxGeometry(0.35, 4.4, 0.35);
      g.translate(CX + Math.cos(t) * 3.25, DY + DH + 2.0, CZ + Math.sin(t) * 3.25);
      add(P.gold, g, GOLD);
    }
    const cap = new THREE.SphereGeometry(3.7, 24, 8, 0, TAU, 0, Math.PI / 2);
    cap.scale(1, 0.75, 1);
    cap.translate(CX, DY + DH + 4.2, CZ);
    add(P.gold, cap, GOLD);
    const spire = new THREE.ConeGeometry(0.45, 9, 10);
    spire.translate(CX, DY + DH + 11.4, CZ);
    add(P.gold, spire, GOLD2);
    const orb = new THREE.SphereGeometry(0.75, 14, 10);
    orb.translate(CX, DY + DH + 7.2, CZ);
    add(P.gold, orb, GOLD2);
    // the naves' glass roofs, their gold ribs
    naveRoofs(c, { glass: P.mid, profile: arc(VOID.hw + 0.8, 7.5, 14), ridge: 7.5, rib: GOLD, ribStep: 3 });
    // a garden on the roof: lawns either side of the naves, palms in planters, a path round the dome
    for (const s of [-1, 1]) {
      const z0 = s < 0 ? SITE.z0 + 9 : CZ + VOID.hw + 4;
      const z1 = s < 0 ? CZ - VOID.hw - 4 : SITE.z1 - 9;
      for (const [x0, x1] of [[SITE.x0 + 22, CX - DR.rx - 6], [CX + DR.rx + 6, SITE.x1 - 22]]) {
        const lw = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
        lw.translate((x0 + x1) / 2, ROOF + 0.05, (z0 + z1) / 2);
        add(M.grass, lw, srgb(0.46, 0.74, 0.4));
        const roofPalms = [];
        for (let x = x0 + 4; x < x1 - 2; x += 9) roofPalms.push([x, (z0 + z1) / 2 + (((x - x0) / 9) % 2 ? 2.5 : -2.5)]);
        palms(c, roofPalms, 7, 9, srgb(0.7, 0.68, 0.62), ROOF);
      }
    }
    const pathRing = ellipse(CX, CZ, DR.rx + 4.5, DR.rz + 4.5, 64);
    add(M.wallSolid, plate(pathRing, [ellipse(CX, CZ, DR.rx + 1.2, DR.rz + 1.2, 64)], ROOF + 0.02, ROOF + 0.12), hex('#efe4cf'));
    // the four corners' cupolas
    for (const [x, z] of [[SITE.x0 + 13, SITE.z0 + 13], [SITE.x1 - 13, SITE.z0 + 13], [SITE.x0 + 13, SITE.z1 - 13], [SITE.x1 - 13, SITE.z1 - 13]]) {
      const d = new THREE.CylinderGeometry(4.2, 4.2, 5, 20);
      d.translate(x, ROOF + 2.5, z);
      add(M.wallSolid, d, STONE);
      const w = new THREE.CylinderGeometry(4.25, 4.25, 2.6, 20, 1, true);
      w.translate(x, ROOF + 2.7, z);
      add(P.mid, w);
      const dm = new THREE.SphereGeometry(4.6, 20, 8, 0, TAU, 0, Math.PI / 2);
      dm.scale(1, 0.9, 1);
      dm.translate(x, ROOF + 5, z);
      add(P.gold, dm, GOLD);
      const f = new THREE.ConeGeometry(0.3, 3.2, 8);
      f.translate(x, ROOF + 10.4, z);
      add(P.gold, f, GOLD2);
    }
    // the great doors: an arch of glass three floors high standing out of the north front
    const AW = 15;
    const AH = 21;
    const az0 = SITE.z0 - 11;
    const az1 = SITE.z0 + 0.5;
    const ap = arc(AW, AH, 20);
    add(P.mid, vault(ap, 'z', az0, az1, CX, G));
    for (let z = az0; z <= az1 + 0.01; z += 2.3) add(P.gold, tube(ap.map(([p, h]) => [CX + p * 1.01, G + h * 1.01, z]), 0.24), GOLD);
    // its face: glass, rays of gold out from over the doors, the frame
    const fa = [CX - AW, az0];
    const fb = [CX + AW, az0];
    const fsg = 1;
    const face = [];
    for (let i = 0; i < 24; i++) {
      const t0 = Math.PI - (Math.PI * i) / 24;
      const t1 = Math.PI - (Math.PI * (i + 1)) / 24;
      face.push([AW, 0], [AW + AW * Math.cos(t0), AH * Math.sin(t0)], [AW + AW * Math.cos(t1), AH * Math.sin(t1)]);
    }
    add(P.deep, onWall(fa, fb, fsg, 0.05, face.map(([u, v]) => [u, G + v])));
    add(M.glint, onWall(fa, fb, fsg, 0.12, face.map(([u, v]) => [u, G + v])));
    for (let i = 1; i < 12; i++) {
      const t = Math.PI - (Math.PI * i) / 12;
      const ux = Math.cos(t);
      const vy = Math.sin(t);
      const nx = -vy * 0.13;
      const ny = ux * 0.13;
      const a0 = [AW + ux * 6 + nx, G + 0.2 + vy * 5.4 + ny];
      const a1 = [AW + ux * 6 - nx, G + 0.2 + vy * 5.4 - ny];
      const b0 = [AW + ux * AW * 0.98 + nx, G + vy * AH * 0.98 + ny];
      const b1 = [AW + ux * AW * 0.98 - nx, G + vy * AH * 0.98 - ny];
      add(P.gold, onWall(fa, fb, fsg, 0.18, [a0, b0, b1, a0, b1, a1]), GOLD);
    }
    add(P.gold, onWall(fa, fb, fsg, 0.2, fanUV(AW, G, AW - 0.5, AW + 0.4, 0, Math.PI, 24).map(([u, v]) => [u, G + (v - G) * (AH / AW)])), GOLD);
    add(P.dark, onWall(fa, fb, fsg, 0.22, rectUV(AW - 5.5, G, AW + 5.5, G + 4.8)));
    add(P.gold, onWall(fa, fb, fsg, 0.26, rectUV(AW - 5.8, G + 4.8, AW + 5.8, G + 5.2)), GOLD);
    add(P.gold, onWall(fa, fb, fsg, 0.26, fanUV(AW, G + 0.2, 5.6, 6.2, 0, Math.PI, 16)), GOLD);
    // the name, in gold light over the doors
    letters(c, 'DOWNTOWN GALLERIA', CX, SITE.z0 + 1.45, 0, -1, ROOF - 4.05, 2.7, GOLD2, 0.3);
    // the plaza: its fountains, its royal palms, steps up to the doors
    for (let i = 0; i < 3; i++) add(M.wallSolid, segGeo([CX - 21 + i * 0.4, az0 - 1.2 - i * 1.1], [CX + 21 - i * 0.4, az0 - 1.2 - i * 1.1], G - 0.1, G + 0.18 - i * 0.06, -0.55, 0.55, 1), STONE);
    for (const x of [CX - 33, CX + 33]) fountain(c, x, SITE.z0 - 8, [[5.4, 0.7], [2.6, 0.5], [1.2, 0.4]], { stone: STONE, rim: GOLD, rimPen: P.gold, jet: 3.4 });
    const pl = [];
    for (let x = SITE.x0 + 6; x < SITE.x1 - 4; x += 10) if (Math.abs(x - CX) > 22) pl.push([x, SITE.z0 - 13.5]);
    for (let z = SITE.z0 + 10; z < SITE.z1 - 6; z += 12) pl.push([SITE.x0 - 3, z], [SITE.x1 + 3, z]);
    palms(c, pl, 12, 15, srgb(0.7, 0.68, 0.62));
    // ...inside
    inside(c, {
      floor: hex('#cfd3d9'),
      inlays: [[-1.5, 0.6, GOLD], [-4.5, 0.25, hex('#2b2a2e')], [-6.5, 0.5, GOLD]],
      slab: hex('#eceef2'),
      fascia: hex('#f4f6f9'),
      edge: GOLD,
      led: srgb(1, 0.88, 0.66),
      rail: GOLD,
      pier: hex('#6b5238'),
      wallIn: hex('#dfe2e7'),
      glow: [srgb(0.42, 0.36, 0.3), srgb(0.46, 0.42, 0.36), srgb(0.38, 0.33, 0.28), srgb(0.4, 0.4, 0.42)],
      signs: [hex('#1d4a38'), hex('#7a1c2c'), hex('#1b2d5a'), hex('#141416'), hex('#b8892d'), hex('#3b2a52')],
      column: hex('#e8ecf1'),
      capital: GOLD,
    });
    // the court: a fountain of three basins under the dome, four palms through the floors, the
    // chandelier hung from the dome
    const I = { ...c, B: c.R };
    fountain(I, CX, CZ, [[7, 0.8], [4, 0.6], [2, 0.5]], { stonePen: M.inGloss, stone: hex('#fbf8f2'), rim: GOLD, rimPen: P.goldIn, jet: 4 });
    palms(I, [[CX - 15, CZ - 9], [CX + 15, CZ - 9], [CX - 15, CZ + 9], [CX + 15, CZ + 9]], 17, 20, srgb(0.72, 0.7, 0.64));
    for (const [r, y, n] of [[7, ROOF + 2, 36], [4.6, ROOF + 0.4, 26], [2.4, ROOF - 1.2, 16]]) for (let i = 0; i < n; i++) {
      const t = (i / n) * TAU;
      const s = new THREE.SphereGeometry(0.3, 8, 6);
      s.translate(CX + Math.cos(t) * r, y, CZ + Math.sin(t) * r * 0.85);
      c.R.add(M.inLamp, s, null, nextId(), { color: srgb(1, 0.9, 0.7) });
    }
  },
  night: true,
};

// ------------------------------------------------------------------ B: Miami's art deco
const DECO = {
  name: 'deco',
  build(c) {
    const { B, M, P } = c;
    const add = (mat, g, col) => g && B.add(mat, g, null, nextId(), col ? { color: col } : undefined);
    const CREAM = hex('#fff1d8');
    const PINK = hex('#f4a3bd');
    const MINT = hex('#9ee0c6');
    const TEAL = hex('#22b7b5');
    const YEL = hex('#ffd36b');
    const CHROME = hex('#d9e0e8');
    const LAV = hex('#c3aef0');
    const NPINK = srgb(1, 0.35, 0.72);
    const NTEAL = srgb(0.25, 1, 0.92);
    const NPURP = srgb(0.68, 0.45, 1);
    ground(c, hex('#f3e2d0'));
    const foot = roundRect(SITE.x0, SITE.z0, SITE.x1, SITE.z1, 11, 10);
    const sg = area(foot) > 0 ? 1 : -1;
    // every floor: a band of colour, a ribbon of windows set in, an eyebrow over them, neon under it
    for (let k = 0; k < NF; k++) {
      const y = LV[k];
      add(M.wallSolid, strip(foot, y - (k ? 0 : 0.2), y + 1.1), k % 2 ? PINK : CREAM);
      add(P.aqua, strip(offset(foot, -0.45), y + 1.1, y + 4.15));
      add(M.glint, strip(offset(foot, -0.38), y + 1.3, y + 4.0));
      add(M.wallSolid, strip(foot, y + 4.15, LV[k + 1]), CREAM);
      for (let i = 0; i < foot.length; i++) {
        const a = foot[i];
        const b = foot[(i + 1) % foot.length];
        add(M.wallSolid, segGeo(a, b, y + 4.18, y + 4.42, 0, 1.15, sg), hex('#ffffff'));
        add(M.neon, segGeo(a, b, y + 4.1, y + 4.18, 1.0, 1.12, sg), k % 2 ? NPINK : NTEAL);
      }
    }
    // the parapet: stepped, a band of pink, its top
    add(M.wallSolid, strip(foot, ROOF, ROOF + 1.8), CREAM);
    add(M.wallSolid, strip(offset(foot, 0.05), ROOF + 0.5, ROOF + 0.95), PINK);
    for (let i = 0; i < foot.length; i++) add(M.neon, segGeo(foot[i], foot[(i + 1) % foot.length], ROOF + 1.8, ROOF + 1.92, -0.1, 0.1, sg), NPURP);
    add(M.wallSolid, plate(foot, [voidPath(0)], ROOF - 0.6, ROOF), hex('#efe2cf'));
    // the fins: three together, pink, up past the parapet, neon on their edges
    for (const { a, b, L } of straights(foot, 30)) {
      for (let u = 12; u < L - 10; u += 22) for (const du of [-0.9, 0, 0.9]) {
        const p0 = [a[0] + ((b[0] - a[0]) * (u + du - 0.16)) / L, a[1] + ((b[1] - a[1]) * (u + du - 0.16)) / L];
        const p1 = [a[0] + ((b[0] - a[0]) * (u + du + 0.16)) / L, a[1] + ((b[1] - a[1]) * (u + du + 0.16)) / L];
        add(M.wallSolid, segGeo(p0, p1, G, ROOF + 3.2, 0, 1.5, sg), du ? PINK : LAV);
        add(M.neon, segGeo(p0, p1, G + 0.5, ROOF + 3.2, 1.5, 1.6, sg), du ? NPINK : NPURP);
      }
    }
    // the tower over the doors: three steps up, stripes, neon on its edges, fins and a mast
    const tiers = [[20, SITE.z0 - 3, SITE.z0 + 16, ROOF + 8], [13, SITE.z0 + 1, SITE.z0 + 13, ROOF + 18], [7.5, SITE.z0 + 3.5, SITE.z0 + 10.5, ROOF + 28]];
    let ybase = G;
    const TIERC = [CREAM, MINT, PINK];
    for (const [hw, z0, z1, y1] of tiers) {
      const t = roundRect(CX - hw, z0, CX + hw, z1, 2.5, 4);
      add(M.wallSolid, plate(t, [], ybase - 0.2, y1), TIERC[tiers.findIndex((q) => q[0] === hw)]);
      for (const s of [-1, 1]) for (const dx of [hw * 0.28, hw * 0.62]) {
        const g = new THREE.BoxGeometry(1.1, y1 - ybase - 1.5, 0.3);
        g.translate(CX + s * dx, (ybase + y1) / 2, z0 - 0.12);
        add(M.wallSolid, g, s * dx > hw * 0.5 || s * dx < -hw * 0.5 ? MINT : PINK);
      }
      for (const s of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.16, y1 - ybase, 0.16);
        g.translate(CX + s * (hw + 0.05), (ybase + y1) / 2, z0 - 0.05);
        add(M.neon, g, NPINK);
      }
      const cap = new THREE.BoxGeometry(hw * 2 + 0.6, 0.6, z1 - z0 + 0.6);
      cap.translate(CX, y1 + 0.3, (z0 + z1) / 2);
      add(M.wallSolid, cap, hex('#ffffff'));
      const ln = new THREE.BoxGeometry(hw * 2 + 0.7, 0.14, 0.14);
      ln.translate(CX, y1 + 0.05, z0 - 0.35);
      add(M.neon, ln, NTEAL);
      ybase = y1;
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const g = new THREE.BoxGeometry(dx ? 5.5 : 0.5, 13, dz ? 5.5 : 0.5);
      g.translate(CX + dx * 2.75, ybase + 6.5, SITE.z0 + 7 + dz * 2.75);
      add(M.wallSolid, g, CREAM);
      const e = new THREE.BoxGeometry(dx ? 0.14 : 0.6, 12.6, dz ? 0.14 : 0.6);
      e.translate(CX + dx * 5.5, ybase + 6.5, SITE.z0 + 7 + dz * 5.5);
      add(M.neon, e, NTEAL);
    }
    const mast = new THREE.CylinderGeometry(0.12, 0.35, 11, 8);
    mast.translate(CX, ybase + 18, SITE.z0 + 7);
    add(M.frame, mast, CHROME);
    const ball = new THREE.SphereGeometry(0.9, 14, 10);
    ball.translate(CX, ybase + 13.4, SITE.z0 + 7);
    add(M.neon, ball, NPINK);
    // its name down its face, letter by letter, on a panel of deep teal
    const pnl = new THREE.BoxGeometry(4.6, 26, 0.3);
    pnl.translate(CX, ROOF + 7.4 - 13.6, SITE.z0 - 3.2);
    add(M.wallSolid, pnl, hex('#16707a'));
    const word = 'GALLERIA';
    for (let i = 0; i < word.length; i++) letters(c, word[i], CX, SITE.z0 - 3.35, 0, -1, ROOF + 5.1 - i * 3.05, 2.6, NPINK, 0.3);
    letters(c, 'DOWNTOWN', CX, SITE.z0 + 0.65, 0, -1, ROOF + 14.6, 1.6, NTEAL, 0.3);
    // the doors: a sunburst over them, its rays in the colours, the chrome round it, a marquee
    const fa = [CX - 20, SITE.z0 - 3];
    const fb = [CX + 20, SITE.z0 - 3];
    const RAYS = [YEL, PINK, CREAM, MINT, YEL, LAV];
    for (let i = 0; i < 18; i++) add(M.wallSolid, onWall(fa, fb, 1, 0.1, fanUV(20, G + 0.4, 2.2, 9.2, Math.PI - (Math.PI * i) / 18, Math.PI - (Math.PI * (i + 1)) / 18, 1)), RAYS[i % RAYS.length]);
    add(M.frame, onWall(fa, fb, 1, 0.16, fanUV(20, G + 0.4, 9.2, 9.9, 0, Math.PI, 24)), CHROME);
    add(M.neon, onWall(fa, fb, 1, 0.2, fanUV(20, G + 0.4, 9.9, 10.1, 0, Math.PI, 24)), NPINK);
    add(P.dark, onWall(fa, fb, 1, 0.14, fanUV(20, G + 0.4, 0, 2.2, 0, Math.PI, 12)));
    add(P.dark, onWall(fa, fb, 1, 0.18, rectUV(14.5, G, 25.5, G + 3.4)));
    const mq = new THREE.BoxGeometry(16, 0.9, 4.5);
    mq.translate(CX, G + 3.9, SITE.z0 - 5.2);
    add(M.wallSolid, mq, TEAL);
    for (let x = -7.8; x <= 7.8; x += 0.6) {
      const bb = new THREE.SphereGeometry(0.11, 6, 4);
      bb.translate(CX + x, G + 3.9, SITE.z0 - 7.5);
      add(M.bulb, bb, srgb(1, 0.92, 0.7));
    }
    // the corner towers: round, banded, portholes, a neon crown
    for (const x of [SITE.x0 + 10, SITE.x1 - 10]) {
      const z = SITE.z0 + 10;
      for (let i = 0; i < 14; i++) {
        const g = new THREE.CylinderGeometry(8, 8, 2.7, 32, 1, true);
        g.translate(x, G + 1.35 + i * 2.7, z);
        add(M.wallSolid, g, i % 2 ? MINT : CREAM);
      }
      for (let i = 1; i < 13; i += 2) for (let j = 0; j < 10; j++) {
        const t = (j / 10) * TAU;
        const d = new THREE.CircleGeometry(0.55, 14);
        d.lookAt(new THREE.Vector3(Math.cos(t), 0, Math.sin(t)));
        d.translate(x + Math.cos(t) * 8.06, G + 1.35 + i * 2.7, z + Math.sin(t) * 8.06);
        add(P.dark, d);
      }
      const top = G + 14 * 2.7;
      let yc = top;
      for (const [r, h, col] of [[8.6, 0.7, hex('#ffffff')], [6, 2.4, PINK], [4, 2, CREAM], [2.2, 1.6, YEL]]) {
        const g = new THREE.CylinderGeometry(r, r, h, 32);
        g.translate(x, yc + h / 2, z);
        add(M.wallSolid, g, col);
        yc += h;
      }
      for (const [r, y] of [[8.7, top + 0.75], [6.1, top + 3.15]]) add(M.neon, tube(ellipse(x, z, r, r, 40).map(([px, pz]) => [px, y, pz]), 0.12, true, 80), NTEAL);
    }
    // the crown over the court: octagons stepping up, glass sides, neon on their edges
    const oct = (r) => Array.from({ length: 8 }, (_, i) => {
      const t = Math.PI / 8 + (i * Math.PI) / 4;
      return [CX + Math.cos(t) * r * 1.18, CZ + Math.sin(t) * r];
    });
    const CR = [[21, 6.5], [14.5, 5], [8.5, 4]];
    let yb = ROOF;
    for (let j = 0; j < CR.length; j++) {
      const [r, h] = CR[j];
      add(P.rose, strip(oct(r), yb, yb + h));
      c.R.add(M.neonSoft, strip(oct(r - 0.25), yb, yb + h), null, nextId(), { color: srgb(0.4, 0.55, 0.78) });
      const next = CR[j + 1];
      add(M.wallSolid, plate(oct(r + 0.6), next ? [oct(next[0] - 0.1)] : [], yb + h, yb + h + 0.6), CREAM);
      const ring = oct(r + 0.62);
      for (let i = 0; i < 8; i++) add(M.neon, tube([[ring[i][0], yb + h + 0.62, ring[i][1]], [ring[(i + 1) % 8][0], yb + h + 0.62, ring[(i + 1) % 8][1]]], 0.12, false, 2), i % 2 ? NPINK : NTEAL);
      yb += h + 0.6;
    }
    const fin = new THREE.ConeGeometry(2.2, 7, 8);
    fin.translate(CX, yb + 3.5, CZ);
    add(P.gold, fin, YEL);
    // the naves: pitched glass roofs, chrome ribs
    naveRoofs(c, { glass: P.aqua, profile: [[-(VOID.hw + 0.8), 0], [0, 5.5], [VOID.hw + 0.8, 0]], ridge: 5.5, rib: CHROME, ribPen: M.frame, ribStep: 3 });
    // the plaza: rings of colour round the doors, palms
    for (let i = 0; i < 6; i++) {
      const g = new THREE.RingGeometry(10 + i * 3, 12.6 + i * 3, 40, 1, 0, Math.PI).rotateX(-Math.PI / 2);
      g.translate(CX, G + 0.03 + i * 0.001, SITE.z0 - 3);
      B.add(M.court, g, null, nextId(), { color: [PINK, MINT, CREAM, LAV, YEL, MINT][i] });
    }
    const pl = [];
    for (let x = SITE.x0 + 6; x < SITE.x1 - 4; x += 11) if (Math.abs(x - CX) > 30) pl.push([x, SITE.z0 - 12]);
    for (let z = SITE.z0 + 22; z < SITE.z1 - 6; z += 13) pl.push([SITE.x0 - 3, z], [SITE.x1 + 3, z]);
    palms(c, pl, 11, 14, srgb(0.74, 0.7, 0.62));
    inside(c, {
      floor: hex('#f0d6c0'),
      inlays: [[-1.5, 0.7, PINK], [-3, 0.7, MINT], [-4.5, 0.7, YEL], [-7, 0.4, TEAL]],
      slab: hex('#fff6ea'),
      fascia: (k) => (k % 2 ? PINK : MINT),
      edge: CHROME,
      led: (k) => (k % 2 ? srgb(1, 0.42, 0.78) : srgb(0.3, 1, 0.9)),
      rail: CHROME,
      pier: hex('#2aa6a3'),
      wallIn: hex('#ffe9d8'),
      glow: [srgb(0.46, 0.38, 0.42), srgb(0.36, 0.46, 0.44), srgb(0.46, 0.42, 0.34)],
      signs: [TEAL, PINK, LAV, YEL, hex('#ff8a7a'), MINT],
      column: CREAM,
      capital: CHROME,
    });
    // the court: a round fountain stepped in pastel, and the chandelier of neon rings under the crown
    const I = { ...c, B: c.R };
    fountain(I, CX, CZ, [[8, 0.6], [5.5, 0.5], [3, 0.5]], { stonePen: M.inGloss, stone: PINK, rim: CHROME, rimPen: P.goldIn, jet: 3.5 });
    for (const [r, y, col] of [[9, ROOF - 2.5, srgb(1, 0.4, 0.75)], [6.5, ROOF - 4, srgb(0.3, 1, 0.9)], [4, ROOF - 5.4, srgb(1, 0.85, 0.4)], [2, ROOF - 6.6, srgb(0.7, 0.5, 1)]]) {
      c.R.add(M.inLamp, tube(ellipse(CX, CZ, r * 1.15, r, 40).map(([x, z]) => [x, y, z]), 0.16, true, 80), null, nextId(), { color: col });
    }
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * TAU;
      c.R.add(P.goldIn, tube([[CX + Math.cos(t) * 10.35, ROOF + 6, CZ + Math.sin(t) * 9], [CX + Math.cos(t) * 10.35, ROOF - 2.5, CZ + Math.sin(t) * 9]], 0.05, false, 2), null, nextId(), { color: CHROME });
    }
  },
};

// ------------------------------------------------------------------ C: the future
const FUTURE = {
  name: 'future',
  build(c) {
    const { B, M, P } = c;
    const add = (mat, g, col) => g && B.add(mat, g, null, nextId(), col ? { color: col } : undefined);
    const WHITE = hex('#f6f8fb');
    const PEARL = hex('#e4ebf2');
    const NCYAN = srgb(0.2, 0.95, 1);
    const NMAG = srgb(1, 0.3, 0.85);
    const GREEN = srgb(0.36, 0.66, 0.36);
    ground(c, hex('#e8ecf0'));
    // the floors' plates: each its own soft-cornered oval, sliding a little from the one below
    const plates = [];
    for (let k = 0; k <= NF; k++) {
      const shrink = k >= 4 ? (k - 3) * 6 : 0;
      plates.push(superellipse(CX + Math.sin(k * 1.3) * 2.5, CZ + Math.cos(k * 0.9) * 1.5, 76 - shrink - 1.5, 51 - shrink * 0.7 - 1.5, 2.7, 120));
    }
    for (let k = 1; k <= NF; k++) {
      const pk = plates[k];
      const sg = area(pk) > 0 ? 1 : -1;
      add(M.wallSolid, plate(pk, k < NF ? [voidPath(0)] : [voidPath(0)], LV[k] - 0.7, LV[k] + 0.1), WHITE);
      add(M.wallSolid, strip(pk, LV[k] - 1.25, LV[k] + 0.1), WHITE);
      add(M.neon, strip(offset(pk, 0.02), LV[k] - 1.36, LV[k] - 1.25), k % 2 ? NCYAN : NMAG);
      // (glass round the floor below it, set back under it)
      add(k % 2 ? P.teal : P.mid, strip(offset(pk, -3.2), LV[k - 1], LV[k] - 0.7));
      add(M.glint, strip(offset(pk, -3.1), LV[k - 1] + 0.3, LV[k] - 0.9));
      // the terraces where the floor above draws in: planters, little trees
      if (k >= 3 && k < NF) {
        const ed = offset(pk, -1.1);
        add(M.wallSolid, strip(ed, LV[k] + 0.1, LV[k] + 0.9), PEARL);
        add(M.leaf, strip(offset(pk, -1.6), LV[k] + 0.7, LV[k] + 1.5), GREEN);
        const { pts } = resample(ed, 9);
        for (const { p } of pts) {
          const tr = new THREE.CylinderGeometry(0.12, 0.16, 2.4, 6);
          tr.translate(p[0], LV[k] + 1.2, p[1]);
          add(M.pole, tr, srgb(0.4, 0.32, 0.26));
          const cr = new THREE.SphereGeometry(1.3, 10, 7);
          cr.translate(p[0], LV[k] + 2.9, p[1]);
          add(M.leaf, cr, srgb(0.3, 0.6 + 0.1 * Math.sin(p[0]), 0.32));
        }
      }
      if (k === NF) add(M.wallSolid, strip(offset(pk, -0.3), LV[k] + 0.1, LV[k] + 1.2), WHITE);
      void sg;
    }
    // the bubble of glass over the void: white lines across it, light round its foot
    const bx = (VOID.x1 - VOID.x0) / 2 + 1.5;
    const bz = VOID.rz + 2;
    const bub = new THREE.SphereGeometry(1, 64, 10, 0, TAU, 0, Math.PI / 2);
    bub.scale(bx, 11, bz);
    bub.translate(CX, ROOF + 0.1, CZ);
    add(P.sky, bub);
    const bi = new THREE.SphereGeometry(1, 48, 8, 0, TAU, 0, Math.PI / 2);
    bi.scale(bx - 0.3, 10.7, bz - 0.3);
    bi.translate(CX, ROOF + 0.1, CZ);
    c.R.add(M.neonSoft, flip(bi), null, nextId(), { color: srgb(0.36, 0.56, 0.82) });
    const BP = (th, ph, k = 1.01) => [CX + bx * k * Math.sin(th) * Math.cos(ph), ROOF + 0.1 + 11 * k * Math.cos(th), CZ + bz * k * Math.sin(th) * Math.sin(ph)];
    for (let i = 0; i < 28; i++) {
      const ph = (i / 28) * TAU;
      const pts = [];
      const pts2 = [];
      for (let j = 0; j <= 10; j++) {
        pts.push(BP((Math.PI / 2) * (j / 10), ph + j * 0.06));
        pts2.push(BP((Math.PI / 2) * (j / 10), ph - j * 0.06));
      }
      add(M.frame, tube(pts, 0.14), WHITE);
      add(M.frame, tube(pts2, 0.14), WHITE);
    }
    add(M.neon, tube(ellipse(CX, CZ, bx + 0.3, bz + 0.3, 72).map(([x, z]) => [x, ROOF + 0.4, z]), 0.16, true, 144), NCYAN);
    // the spire: a tower turning as it rises, its floors lit at the edge, a halo at the top
    const sx = SITE.x1 - 17;
    const sz = SITE.z0 + 17;
    const N = 24;
    for (let i = 0; i < N; i++) {
      const y = G + i * 3;
      const rot = (i / N) * (Math.PI / 2);
      const w = 13 - Math.max(0, i - 16) * 0.5;
      const g = new THREE.BoxGeometry(w - 1, 2.6, w - 1);
      g.rotateY(rot);
      g.translate(sx, y + 1.5, sz);
      add(i % 2 ? P.teal : P.mid, g);
      const s = new THREE.BoxGeometry(w, 0.4, w);
      s.rotateY(rot);
      s.translate(sx, y + 2.9, sz);
      add(M.wallSolid, s, WHITE);
      const e = new THREE.BoxGeometry(w + 0.1, 0.1, w + 0.1);
      e.rotateY(rot);
      e.translate(sx, y + 2.68, sz);
      add(M.neon, e, i % 3 ? NCYAN : NMAG);
    }
    const halo = new THREE.TorusGeometry(9, 0.45, 8, 64).rotateX(Math.PI / 2);
    halo.translate(sx, G + N * 3 + 4, sz);
    add(M.neon, halo, NCYAN);
    for (let i = 0; i < 4; i++) {
      const t = (i / 4) * TAU + Math.PI / 4;
      add(M.frame, tube([[sx + Math.cos(t) * 5, G + N * 3, sz + Math.sin(t) * 5], [sx + Math.cos(t) * 9, G + N * 3 + 4, sz + Math.sin(t) * 9]], 0.12, false, 2), WHITE);
    }
    const mast = new THREE.CylinderGeometry(0.1, 0.3, 14, 8);
    mast.translate(sx, G + N * 3 + 7, sz);
    add(M.frame, mast, WHITE);
    // the doors' canopy: a shell sweeping out over the plaza on slender legs, light under it
    const sh = new THREE.SphereGeometry(1, 48, 10, Math.PI, Math.PI, 0, Math.PI / 2);
    sh.scale(32, 7, 15);
    sh.translate(CX, G + 6.5, SITE.z0 + 1);
    add(M.wallSolid, sh, WHITE);
    const shi = new THREE.SphereGeometry(1, 40, 8, Math.PI, Math.PI, 0, Math.PI / 2);
    shi.scale(31.7, 6.8, 14.7);
    shi.translate(CX, G + 6.5, SITE.z0 + 1);
    add(M.wallSolid, flip(shi), PEARL);
    for (let i = 1; i < 12; i++) {
      const ph = Math.PI + (Math.PI * i) / 12;
      const pts = [];
      for (let j = 0; j <= 8; j++) {
        const th = (Math.PI / 2) * (j / 8);
        pts.push([CX + 31.5 * Math.sin(th) * -Math.cos(ph), G + 6.5 + 6.7 * Math.cos(th) - 0.1, SITE.z0 + 1 + 14.5 * Math.sin(th) * Math.sin(ph)]);
      }
      add(M.neon, tube(pts, 0.08), NCYAN);
    }
    for (const [dx, dz] of [[-24, -8], [-12, -12.5], [12, -12.5], [24, -8]]) {
      const leg = new THREE.CylinderGeometry(0.22, 0.35, 6.5, 10);
      leg.translate(CX + dx, G + 3.25, SITE.z0 + 1 + dz);
      add(M.frame, leg, WHITE);
    }
    add(P.dark, strip([[CX - 12, SITE.z0 + 1.6], [CX + 12, SITE.z0 + 1.6]], G, G + 5, false));
    const zN = Math.min(...plates[NF].map(([, z]) => z)) + 1.2;
    const bar = new THREE.BoxGeometry(44, 0.5, 0.6);
    bar.translate(CX, ROOF + 1.45, zN + 0.2);
    add(M.wallSolid, bar, WHITE);
    letters(c, 'DOWNTOWN GALLERIA', CX, zN, 0, -1, ROOF + 1.7, 2.4, NCYAN, 0.3);
    // the plaza: curving beds of green, light posts
    for (const [r, w] of [[24, 3], [34, 2.5]]) {
      const g = new THREE.RingGeometry(r, r + w, 48, 1, Math.PI * 0.08, Math.PI * 0.84).rotateX(-Math.PI / 2);
      g.translate(CX, G + 0.04, SITE.z0 - 2);
      B.add(M.grass, g, null, nextId(), { color: srgb(0.42, 0.72, 0.4) });
    }
    for (let i = 0; i < 9; i++) {
      const t = Math.PI * 1.1 + (Math.PI * 0.8 * i) / 8;
      const x = CX + Math.cos(t) * 30;
      const z = SITE.z0 - 2 + Math.sin(t) * 30 * 0.45;
      const pole = new THREE.CylinderGeometry(0.08, 0.12, 6, 8);
      pole.translate(x, G + 3, z);
      add(M.frame, pole, WHITE);
      const r = new THREE.TorusGeometry(0.6, 0.07, 6, 20).rotateX(Math.PI / 2);
      r.translate(x, G + 6, z);
      add(M.neon, r, i % 2 ? NCYAN : NMAG);
    }
    inside(c, {
      inner: plates[1].map(([x, z]) => [x + (CX - x) * 0.02, z + (CZ - z) * 0.02]),
      floor: hex('#cdd8e3'),
      inlays: [[-2, 0.3, srgb(0.2, 0.9, 1)], [-6, 0.3, srgb(1, 0.3, 0.85)]],
      slab: hex('#e6edf4'),
      fascia: hex('#f2f6fa'),
      edge: hex('#dfe8ef'),
      led: (k) => (k % 2 ? srgb(0.3, 0.95, 1) : srgb(1, 0.35, 0.85)),
      rail: hex('#e8eef4'),
      pier: hex('#2a3140'),
      wallIn: hex('#dce4ec'),
      glow: [srgb(0.36, 0.44, 0.5), srgb(0.4, 0.42, 0.46), srgb(0.32, 0.4, 0.48)],
      signs: [hex('#ffffff'), hex('#1c2230'), hex('#3fd8f0'), hex('#ff5ad1'), hex('#e6ecf2'), hex('#6c7cff')],
      column: null,
    });
    // the court: a ring of light hung in it, a tree under it, the green wall
    const I = { ...c, B: c.R };
    const ring = new THREE.TorusGeometry(10, 0.7, 12, 72).rotateX(Math.PI / 2);
    ring.scale(1.15, 1, 1);
    ring.translate(CX, LV[3] + 1.5, CZ);
    c.R.add(M.inGloss, ring, null, nextId(), { color: hex('#ffffff') });
    const ri = new THREE.TorusGeometry(9.3, 0.18, 8, 72).rotateX(Math.PI / 2);
    ri.scale(1.15, 1, 1);
    ri.translate(CX, LV[3] + 1.5, CZ);
    c.R.add(M.inLamp, ri, null, nextId(), { color: srgb(0.3, 0.95, 1) });
    for (let i = 0; i < 6; i++) {
      const t = (i / 6) * TAU;
      c.R.add(M.inBox, tube([[CX + Math.cos(t) * 11.5, LV[3] + 1.5, CZ + Math.sin(t) * 10], [CX + Math.cos(t) * 11.5, ROOF + 6, CZ + Math.sin(t) * 10]], 0.03, false, 2), null, nextId(), { color: hex('#c8d0d8') });
    }
    palms(I, [[CX, CZ]], 14, 15, srgb(0.7, 0.7, 0.66));
    const bed = new THREE.CylinderGeometry(6, 6.3, 0.8, 40);
    bed.translate(CX, G + 0.4, CZ);
    c.R.add(M.inGloss, bed, null, nextId(), { color: hex('#ffffff') });
    const gr = new THREE.CircleGeometry(5.7, 40).rotateX(-Math.PI / 2);
    gr.translate(CX, G + 0.82, CZ);
    c.R.add(M.grass, gr, null, nextId(), { color: srgb(0.4, 0.7, 0.38) });
    void I;
  },
};

export const LOOKS = { palace: A, deco: DECO, future: FUTURE };

// ------------------------------------------------------------------ build, let go
/** Builds a look into the city; returns { group, verts }. */
export function buildConcept(world, name) {
  const look = LOOKS[name];
  const b = M_BLOCKS.find((q) => q.id === SITE.blocks[0]);
  const bctx = blockCtx(world, b);
  const c = { B: bctx.B, R: bctx.R, M: bctx.M, P: pens(bctx.M), rng: seeded(4207 + name.length * 31) };
  look.build(c);
  const group = new THREE.Group();
  group.name = `concept ${name}`;
  const meshes = bctx.B.flush(group, { static: true, merge: world.merge });
  const rooms = bctx.R.flush(group, { static: true, indoor: true, merge: world.merge });
  for (const m of rooms) m.renderOrder = 1;
  return { group, verts: bctx.B.vcount + bctx.R.vcount, meshes: meshes.length + rooms.length };
}

export function dropConcept(group) {
  group.traverse((m) => {
    if (m.isMesh) m.geometry.dispose();
  });
}
