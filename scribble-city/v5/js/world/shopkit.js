import * as THREE from 'three';
import { nextId } from './kit.js';
import { model, place, lin, LINES, PRODUCE, PEN_KEYS } from './products.js';
import { labels } from './labels.js';
import { LAYERS } from '../render/materials.js';

// (v5, ROADMAP 14.4) The pieces a shop of the new kind is built from (world/market.js, and the
// other kinds after it): boxes and printed faces in a run's frame (world/stock.js Run: s along it, t
// out of it towards the people, y up), lit as an illustrator lights them (world/products.js bake);
// the products on a shelf, a group of the same side by side; and the live ones - the products a
// hand will take (game/shoplife.js): each one where it stands, drawn apart from the rest so that it
// can leave its place and come back to it (LiveSet).

// ------------------------------------------------------------------ the run's frame in the world
// the world's direction of a run's (s, t) direction
export function wdir(R, du, dd) {
  const f = R.f;
  return [f.ux * du + f.nx * dd, f.uz * du + f.nz * dd];
}

// the yaw that turns a product's front (+z) to face out of the run, to where people stand
export function yawOut(R, run) {
  const [x, z] = wdir(R, run.ou, run.od);
  return Math.atan2(x, z);
}

// a point of the run in the world
export function wp(R, run, s, y, t) {
  const [u, d] = run.ud(s, t);
  return R.P(u, y, d);
}

const _l = { x: 0, y: 0.86, z: 0.5 };
function shade(S, nx, ny, nz, k = 1) {
  const L = S.light || _l;
  const d = nx * L.x + ny * L.y + nz * L.z;
  return (0.74 + 0.32 * Math.max(0, d) + 0.05 * ny - 0.06 * Math.max(0, -d)) * k;
}

// an axis-aligned box in the world into soup S's pen: its faces (world), each its own shade of col,
// its uv in metres; skip: the world faces left out ('px', 'nx', 'py', 'ny', 'pz', 'nz')
export function wbox(S, pen, a, b, col, o = {}) {
  if (S.off) return 0;
  const x0 = Math.min(a[0], b[0]);
  const x1 = Math.max(a[0], b[0]);
  const y0 = Math.min(a[1], b[1]);
  const y1 = Math.max(a[1], b[1]);
  const z0 = Math.min(a[2], b[2]);
  const z1 = Math.max(a[2], b[2]);
  const skip = o.skip || [];
  const B = S.buf(pen);
  const L = lin(col);
  const id = o.id || nextId();
  const F = [
    ['pz', [0, 0, 1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    ['nz', [0, 0, -1], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
    ['px', [1, 0, 0], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
    ['nx', [-1, 0, 0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
    ['py', [0, 1, 0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]],
    ['ny', [0, -1, 0], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
  ];
  for (const [k, n, p0, p1, p2, p3] of F) {
    if (skip.includes(k)) continue;
    const w = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    const h = Math.hypot(p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]);
    const sh = shade(S, n[0], n[1], n[2], o.dim || 1);
    // (the foot of a tall face a little darker: what stands on the floor sits in its shadow)
    const foot = o.foot ? 0.86 : 1;
    const o0 = B.n;
    const uv = [[0, 0], [w, 0], [w, h], [0, h]];
    [p0, p1, p2, p3].forEach((p, i) => {
      B.P.push(p[0], p[1], p[2]);
      B.N.push(n[0], n[1], n[2]);
      B.U.push(uv[i][0] + (o.u0 || 0), uv[i][1]);
      const kk = sh * (i < 2 && n[1] === 0 ? foot : 1);
      B.C.push(L[0] * kk, L[1] * kk, L[2] * kk);
      B.I.push(id);
    });
    B.X.push(o0, o0 + 1, o0 + 2, o0, o0 + 2, o0 + 3);
    B.n += 4;
  }
  return id;
}

// the run's faces as the world's (for wbox's skip): BACK, FRONT, START, END, TOP, BOTTOM
export function wfaces(R, run, list) {
  const out = [];
  const ax = (x, z) => (Math.abs(x) > 0.5 ? (x > 0 ? 'px' : 'nx') : z > 0 ? 'pz' : 'nz');
  for (const k of list) {
    if (k === 'top') out.push('py');
    else if (k === 'bottom') out.push('ny');
    else {
      const [du, dd] = k === 'back' ? [-run.ou, -run.od] : k === 'front' ? [run.ou, run.od] : k === 'start' ? [-run.au, -run.ad] : [run.au, run.ad];
      const [x, z] = wdir(R, du, dd);
      out.push(ax(x, z));
    }
  }
  return out;
}

// (ROADMAP 16.2) what is up against a wall of the room - a bay, a screen, a sign, a panel, a shelf:
// kept (in the room's own frame, the heights the world's), so that a mural is not painted over it
// (game/shopmural.js through the room's wallBusy, world/rooms.js)
function onWall(R, run, s0, y0, t0, s1, y1, t1) {
  if (R.ua === undefined || !R.P) return;
  const [ua, da] = run.ud(s0, t0);
  const [ub, db] = run.ud(s1, t1);
  const u0 = Math.min(ua, ub);
  const u1 = Math.max(ua, ub);
  const d0 = Math.min(da, db);
  const d1 = Math.max(da, db);
  const near = 0.3;
  if (u0 > R.ua + near && u1 < R.ub - near && d0 > R.db + near) return;
  const ya = R.P(u0, Math.min(y0, y1), d0)[1];
  const yb = R.P(u0, Math.max(y0, y1), d0)[1];
  (R.wallStuff || (R.wallStuff = [])).push([u0, d0, u1, d1, ya, yb]);
}

// a box in a run's frame into soup S (pen 'plain' unless o.pen)
export function rbox(R, S, run, s0, y0, t0, s1, y1, t1, col, o = {}) {
  onWall(R, run, s0, y0, t0, s1, y1, t1);
  const a = wp(R, run, s0, y0, t0);
  const b = wp(R, run, s1, y1, t1);
  return wbox(S, o.pen || 'plain', a, b, col, { ...o, skip: o.skip ? wfaces(R, run, o.skip) : [] });
}

// a printed face standing in the run at t, facing out (to the people), s0..s1 by y0..y1: the atlas
// cell's square (uv: a part of it [u0, v0, u1, v1] in the cell's own 0..1), or a plain colour
export function rprint(R, S, run, s0, y0, s1, y1, t, cell, o = {}) {
  onWall(R, run, s0, y0, t, s1, y1, t);
  const A = labels();
  const c = cell ? A.cells.get(cell) : null;
  const pen = o.pen || (c ? 'print' : 'plain');
  const [nx, nz] = wdir(R, run.ou, run.od);
  const n = [nx, 0, nz];
  let p0 = wp(R, run, s0, y0, t);
  let p1 = wp(R, run, s1, y0, t);
  let p2 = wp(R, run, s1, y1, t);
  let p3 = wp(R, run, s0, y1, t);
  const part = o.part || [0, 0, 1, 1];
  const uv = c ? [[part[0], part[1]], [part[2], part[1]], [part[2], part[3]], [part[0], part[3]]].map(([u, v]) => [c.uv[0] + (c.uv[2] - c.uv[0]) * u, c.uv[1] + (c.uv[3] - c.uv[1]) * v]) : [[0, 0], [Math.abs(s1 - s0), 0], [Math.abs(s1 - s0), y1 - y0], [0, y1 - y0]];
  // (wound to face out, its picture the right way round: seen from there, the left edge first - if
  // s runs to the left, its corners are taken the other way round, the picture's not)
  const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const e2 = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
  const cx = e1[1] * e2[2] - e1[2] * e2[1];
  const cz = e1[0] * e2[1] - e1[1] * e2[0];
  if (cx * n[0] + cz * n[2] < 0) [p0, p1, p2, p3] = [p1, p0, p3, p2];
  quad(S, pen, p0, p1, p2, p3, n, o.col || [1, 1, 1], uv, o);
}

// a printed face lying on its back at height y (its top towards +t: read from in front)
export function rprintUp(R, S, run, s0, t0, s1, t1, y, cell, o = {}) {
  const A = labels();
  const c = cell ? A.cells.get(cell) : null;
  const pen = o.pen || (c ? 'print' : 'plain');
  let p0 = wp(R, run, s0, y, t1);
  let p1 = wp(R, run, s1, y, t1);
  let p2 = wp(R, run, s1, y, t0);
  let p3 = wp(R, run, s0, y, t0);
  const uv = c ? [[c.uv[0], c.uv[1]], [c.uv[2], c.uv[1]], [c.uv[2], c.uv[3]], [c.uv[0], c.uv[3]]] : [[0, 0], [1, 0], [1, 1], [0, 1]];
  const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const e2 = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
  if (e1[2] * e2[0] - e1[0] * e2[2] < 0) [p0, p1, p2, p3] = [p1, p0, p3, p2];
  quad(S, pen, p0, p1, p2, p3, [0, 1, 0], o.col || [1, 1, 1], uv, o);
}

function quad(S, pen, a, b, c, d, n, col, uv, o = {}) {
  if (S.off) return 0;
  const B = S.buf(pen);
  const L = lin(col);
  const k = pen === 'glow' || pen === 'screen' ? 1 : shade(S, n[0], n[1], n[2], o.dim || 1);
  const id = o.id || nextId();
  const base = B.n;
  [a, b, c, d].forEach((p, i) => {
    B.P.push(p[0], p[1], p[2]);
    B.N.push(n[0], n[1], n[2]);
    B.U.push(uv[i][0], uv[i][1]);
    B.C.push(L[0] * k, L[1] * k, L[2] * k);
    B.I.push(id);
  });
  B.X.push(base, base + 1, base + 2, base, base + 2, base + 3);
  B.n += 4;
  return id;
}

// an upright cylinder at a run's (s, t), into soup S (a post, a pole, a tub)
export function rcyl(R, S, run, s, t, r, y0, h, col, o = {}) {
  onWall(R, run, s - r, y0, t - r, s + r, y0 + h, t + r);
  if (S.off) return 0;
  const p = wp(R, run, s, y0, t);
  const B = S.buf(o.pen || 'plain');
  const L = lin(col);
  const seg = o.seg || 10;
  const id = o.id || nextId();
  const base = B.n;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    const k = shade(S, nx, 0, nz, o.dim || 1);
    for (const y of [p[1], p[1] + h]) {
      B.P.push(p[0] + nx * r, y, p[2] + nz * r);
      B.N.push(nx, 0, nz);
      B.U.push((i / seg) * Math.PI * 2 * r, y - p[1]);
      const kk = y === p[1] ? k * 0.88 : k;
      B.C.push(L[0] * kk, L[1] * kk, L[2] * kk);
      B.I.push(id);
    }
  }
  for (let i = 0; i < seg; i++) {
    const a = base + i * 2;
    B.X.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  B.n += (seg + 1) * 2;
  if (o.top !== false) {
    const c = B.n;
    const k = shade(S, 0, 1, 0, o.dim || 1);
    B.P.push(p[0], p[1] + h, p[2]);
    B.N.push(0, 1, 0);
    B.U.push(0, 0);
    B.C.push(L[0] * k, L[1] * k, L[2] * k);
    B.I.push(id);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      B.P.push(p[0] + Math.cos(a) * r, p[1] + h, p[2] + Math.sin(a) * r);
      B.N.push(0, 1, 0);
      B.U.push(Math.cos(a) * r, Math.sin(a) * r);
      B.C.push(L[0] * k, L[1] * k, L[2] * k);
      B.I.push(id);
    }
    for (let i = 0; i < seg; i++) B.X.push(c, c + 2 + i, c + 1 + i);
    B.n += seg + 2;
  }
  return id;
}

// ------------------------------------------------------------------ the plans' small helpers
// what is streamed in, a piece at a time (world/rooms.js buildStock runs a stock's jobs a few a frame;
// anywhere else, now)
export function later(R, fn) {
  if (R.jobs) R.jobs.push(fn);
  else fn();
}

// how many live products each place to stand has (the ones a hand reaches for)
export function liveOk(spot, most = 6) {
  if (!spot) return false;
  spot.nLive = spot.nLive || 0;
  if (spot.nLive >= most) return false;
  spot.nLive++;
  return true;
}

// the room's width, depth, where its door is (and on which side of the middle)
// how long a counter by the window can be: from the wall on the side away from the door to the way in
// (R.lane, kept clear, and a little room besides) - 0 when not even min fits there
export function counterLen(R, fr, want, min) {
  const wall = fr.left ? R.ub - 0.3 : R.ua + 0.3;
  const room = fr.left ? wall - (R.lane[1] + 0.45) : R.lane[0] - 0.45 - wall;
  const len = Math.min(want, room);
  return len >= min ? len : 0;
}

export function frameOf(R) {
  const W = R.ub - R.ua;
  const D = R.da - R.db;
  const door = R.openings.find((o) => o.kind === 'door');
  const du = door ? (door.u0 + door.u1) / 2 : R.ua + 1;
  return { W, D, du, left: du < (R.ua + R.ub) / 2, door };
}

// a curtain hanging in folds across a run from s0 to s1 (t: its line), its rail over it
export function curtain(R, S, run, s0, s1, t, y0, y1, col, o = {}) {
  if (S.off) return;
  const n = Math.max(6, Math.round((s1 - s0) / 0.05));
  const ny = 4;
  const fold = (s) => Math.sin(((s - s0) / 0.11) * Math.PI) * 0.035;
  const B = S.buf('plain');
  const L = lin(col);
  const id = nextId();
  const base = B.n;
  const [ox, oz] = wdir(R, run.ou, run.od);
  for (let j = 0; j <= ny; j++) {
    const y = y0 + ((y1 - y0) * j) / ny;
    for (let i = 0; i <= n; i++) {
      const s = s0 + ((s1 - s0) * i) / n;
      const tt = t + fold(s) * (0.7 + 0.3 * (1 - j / ny));
      const p = wp(R, run, s, y, tt);
      // (the normal: out, turned by the fold's slope)
      const dz = (fold(s + 0.004) - fold(s - 0.004)) / 0.008;
      const [ax, az] = wdir(R, run.au, run.ad);
      let nx = ox - ax * dz;
      let nz = oz - az * dz;
      const l = Math.hypot(nx, nz) || 1;
      nx /= l;
      nz /= l;
      const k = shade(S, nx, 0, nz, 1) * (0.86 + 0.14 * Math.cos(((s - s0) / 0.11) * Math.PI));
      B.P.push(p[0], p[1], p[2]);
      B.N.push(nx, 0, nz);
      B.U.push(s - s0, y - y0);
      B.C.push(L[0] * k, L[1] * k, L[2] * k);
      B.I.push(id);
    }
  }
  const row = n + 1;
  // (wound to face out: which way round depends on the run's along and out)
  const [ax0, az0] = wdir(R, run.au, run.ad);
  const flip = -az0 * ox + ax0 * oz < 0;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < n; i++) {
      const a = base + j * row + i;
      if (flip) B.X.push(a, a + row + 1, a + 1, a, a + row, a + row + 1);
      else B.X.push(a, a + 1, a + row + 1, a, a + row + 1, a + row);
    }
  }
  B.n += (n + 1) * (ny + 1);
  // (and its back, so it is a curtain from inside the cubicle too)
  if (o.back !== false) {
    const b2 = B.n;
    for (let v = base; v < b2; v++) {
      B.P.push(B.P[v * 3], B.P[v * 3 + 1], B.P[v * 3 + 2]);
      B.N.push(-B.N[v * 3], 0, -B.N[v * 3 + 2]);
      B.U.push(B.U[v * 2], B.U[v * 2 + 1]);
      B.C.push(B.C[v * 3] * 0.8, B.C[v * 3 + 1] * 0.8, B.C[v * 3 + 2] * 0.8);
      B.I.push(id);
    }
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < n; i++) {
        const a = b2 + j * row + i;
        if (flip) B.X.push(a, a + 1, a + row + 1, a, a + row + 1, a + row);
        else B.X.push(a, a + row + 1, a + 1, a, a + row, a + row + 1);
      }
    }
    B.n += b2 - base;
  }
}

// ------------------------------------------------------------------ the products' looks
// the k-th look of a line (world/products.js LINES): its model, its label's cell, its colours
export function lookOf(line, k) {
  const L = LINES[line];
  const i = ((k % L.cells.length) + L.cells.length) % L.cells.length;
  return { line, model: L.model, cell: L.cells[i], side: L.side || null, tint: L.tints[i % L.tints.length], cap: L.caps ? L.caps[i % L.caps.length] : null, k: i };
}

// a fruit's look (world/products.js PRODUCE): its colour, a little different each one
export function fruitOf(kind, rng) {
  const P = PRODUCE[kind];
  const c = P.cols[Math.floor(rng() * P.cols.length)];
  const j = 0.94 + rng() * 0.08;
  return { line: kind, model: P.model, cell: null, tint: [Math.min(1, c[0] * j), Math.min(1, c[1] * j), Math.min(1, c[2] * j)], fruit: true };
}

// a product into the room: the goods' soup, or - live - the live set (a hand may take it)
export function put(R, look, p, yaw, o = {}) {
  // (round 22b: a stock's goods - world/rooms.js buildStock - put on the shelves a product a job, a few
  // milliseconds of them a frame: a whole counter's at once, as the room was furnished or a shelf
  // filled, held a phone's frame for tens of milliseconds. Nothing put here is read back before the
  // jobs are done, and what it is given is its own)
  if (R.jobs && !R.putNow) {
    R.jobs.push(() => {
      R.putNow = true;
      try {
        put(R, look, p, yaw, o);
      } finally {
        R.putNow = false;
      }
    });
    return -1;
  }
  if (o.live && R.live) return R.live.add(R, look, p, yaw, o);
  const S = R.psoup(true);
  if (S.off) return -1;
  // (the ones in the rows behind: a little less round - they are mostly hidden)
  const m = model(look.model, !!R.low || !!o.back);
  place(S, m, p[0], p[1], p[2], yaw, { ...look, dim: o.dim, lean: o.lean, scale: o.scale });
  return -1;
}

// a soup's corners as meshes of their own, one a pen (a stock's goods: not through the batch - they
// are many, and theirs alone), every corner with the shop's id (obj: drawn in with it)
export function soupMeshes(S, pens, parent, obj = 0) {
  const out = [];
  for (const k of PEN_KEYS) {
    const b = S.bufs[k];
    if (!b || !b.n) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.C, 3));
    g.setAttribute('aId', new THREE.Float32BufferAttribute(b.I, 1));
    g.setAttribute('aObj', new THREE.Float32BufferAttribute(new Float32Array(b.n).fill(obj), 1));
    g.setIndex(b.n > 65535 ? new THREE.Uint32BufferAttribute(b.X, 1) : new THREE.Uint16BufferAttribute(b.X, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, pens[k]);
    m.name = `goods ${k}`;
    m.matrixAutoUpdate = false;
    m.renderOrder = 1;
    m.userData.static = true;
    m.userData.indoor = true;
    m.userData.pens = [pens[k]];
    parent.add(m);
    out.push(m);
  }
  S.bufs = {};
  return out;
}

// ------------------------------------------------------------------ the live products
// The products within a hand's reach of the places people stand, each drawn apart (a few draws for
// the whole shop: one a pen), so that one can go - taken from the shelf, put in a basket, on the
// counter, into a bag - and come back (put back, or the shelf filled again by the staff): its
// corners squeezed into a point while it is away, and put back when it is back. And the doors that
// open: a fridge's, swung round its hinge.
export class LiveSet {
  constructor(light) {
    this.S = { bufs: {}, light, n: 0, buf(pen) {
      let b = this.bufs[pen];
      if (!b) b = this.bufs[pen] = { P: [], N: [], U: [], C: [], I: [], X: [], n: 0 };
      return b;
    } };
    this.slots = [];
    this.doors = [];
    this.meshes = null;
    this.geos = {};
  }

  // the corners each pen has now (to know which are a slot's)
  mark() {
    const m = {};
    for (const k of PEN_KEYS) m[k] = this.S.bufs[k] ? this.S.bufs[k].n : 0;
    return m;
  }

  span(before) {
    const r = {};
    for (const k of PEN_KEYS) {
      const n = this.S.bufs[k] ? this.S.bufs[k].n : 0;
      if (n > before[k]) r[k] = [before[k], n];
    }
    return r;
  }

  // a product that may be taken: where it stands, how it looks (o.spot: the place people stand to
  // reach it, o.row: its shelf's height over the floor)
  add(R, look, p, yaw, o = {}) {
    const m = model(look.model, !!R.low);
    const b = this.mark();
    place(this.S, m, p[0], p[1], p[2], yaw, { ...look, dim: o.dim, lean: o.lean, scale: o.scale });
    const slot = { i: this.slots.length, look, x: p[0], y: p[1], z: p[2], yaw, h: m.size[1] * (o.scale || 1), w: m.size[0], ranges: this.span(b), state: 'shelf', shown: true, what: o.what || look.line, fridge: o.fridge || 0, kind: o.kind || 'product', zx: null, zz: null };
    // (the place people stand to reach it, in the world: the shop's people find it by where it is)
    if (o.zone) {
      const q = R.P(o.zone.u, R.y0, o.zone.d);
      slot.zx = q[0];
      slot.zz = q[2];
    }
    this.slots.push(slot);
    return slot.i;
  }

  // a door that opens (a fridge's): built by fn into the set, hinged at (hx, hz), opening by turning
  // the way sign says (+1: the hinge's yaw grows)
  door(build, hx, hz, sign) {
    const b = this.mark();
    build(this.S);
    const d = { i: this.doors.length, hx, hz, sign, ranges: this.span(b), open: 0, want: 0 };
    this.doors.push(d);
    return d.i;
  }

  // the set's meshes (one a pen), every corner with the shop's id (obj: drawn in with it)
  build(pens, parent, obj = 0) {
    this.meshes = [];
    for (const k of PEN_KEYS) {
      const b = this.S.bufs[k];
      if (!b || !b.n) continue;
      const g = new THREE.BufferGeometry();
      const pos = new THREE.Float32BufferAttribute(b.P, 3);
      pos.setUsage(THREE.DynamicDrawUsage);
      const nor = new THREE.Float32BufferAttribute(b.N, 3);
      nor.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('position', pos);
      g.setAttribute('normal', nor);
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.U, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.C, 3));
      g.setAttribute('aId', new THREE.Float32BufferAttribute(b.I, 1));
      g.setAttribute('aObj', new THREE.Float32BufferAttribute(new Float32Array(b.n).fill(obj), 1));
      g.setIndex(b.n > 65535 ? new THREE.Uint32BufferAttribute(b.X, 1) : new THREE.Uint16BufferAttribute(b.X, 1));
      g.computeBoundingSphere();
      // (a little bigger: a door swung open stays in it)
      g.boundingSphere.radius += 1;
      const mesh = new THREE.Mesh(g, pens[k]);
      mesh.name = `live ${k}`;
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = 1;
      mesh.userData.dynamic = true;
      mesh.userData.live = true;
      // (inside a shop: out of the sun's map and the street's mirror - render/pipeline.js swapDepth,
      // notInMirror; on the layer the mirror's camera does not see, as the shop's still goods are put
      // by pipeline addStatic, which passes over what moves)
      mesh.userData.indoor = true;
      mesh.layers.set(LAYERS.MIRRORLESS);
      parent.add(mesh);
      this.meshes.push(mesh);
      this.geos[k] = g;
      // (the corners as they were built: put back from here)
      b.rest = new Float32Array(b.P);
      b.restN = new Float32Array(b.N);
    }
    this.S.bufs = Object.fromEntries(Object.entries(this.S.bufs).map(([k, v]) => [k, { n: v.n, rest: v.rest, restN: v.restN }]));
    return this.meshes;
  }

  get verts() {
    let n = 0;
    for (const b of Object.values(this.S.bufs)) n += b.n;
    return n;
  }

  // the slot's product gone from its place (taken) or back in it
  setShown(i, on) {
    const s = this.slots[i];
    if (!s || !this.meshes) return;
    s.shown = on;
    for (const [k, [a, b]] of Object.entries(s.ranges)) {
      const g = this.geos[k];
      if (!g) continue;
      const P = g.attributes.position.array;
      const rest = this.S.bufs[k].rest;
      if (on) P.set(rest.subarray(a * 3, b * 3), a * 3);
      else for (let v = a; v < b; v++) {
        P[v * 3] = s.x;
        P[v * 3 + 1] = s.y + 0.01;
        P[v * 3 + 2] = s.z;
      }
      g.attributes.position.needsUpdate = true;
    }
  }

  // a door turned open by k (0 shut .. 1 wide open: 100 degrees)
  setDoor(i, k) {
    const d = this.doors[i];
    if (!d || !this.meshes || Math.abs(d.open - k) < 1e-3) return;
    d.open = k;
    const a = d.sign * k * 1.75;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (const [pk, [v0, v1]] of Object.entries(d.ranges)) {
      const g = this.geos[pk];
      if (!g) continue;
      const P = g.attributes.position.array;
      const N = g.attributes.normal.array;
      const rest = this.S.bufs[pk].rest;
      const restN = this.S.bufs[pk].restN;
      for (let v = v0; v < v1; v++) {
        const x = rest[v * 3] - d.hx;
        const z = rest[v * 3 + 2] - d.hz;
        P[v * 3] = d.hx + x * ca + z * sa;
        P[v * 3 + 1] = rest[v * 3 + 1];
        P[v * 3 + 2] = d.hz - x * sa + z * ca;
        const nx = restN[v * 3];
        const nz = restN[v * 3 + 2];
        N[v * 3] = nx * ca + nz * sa;
        N[v * 3 + 2] = -nx * sa + nz * ca;
      }
      g.attributes.position.needsUpdate = true;
      g.attributes.normal.needsUpdate = true;
    }
  }

  dispose() {
    for (const m of this.meshes || []) {
      m.geometry.dispose();
      if (m.parent) m.parent.remove(m);
    }
    this.meshes = null;
  }
}
