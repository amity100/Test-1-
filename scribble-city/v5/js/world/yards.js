import * as THREE from 'three';
import { srgb, addLight } from '../render/materials.js';
import { nextId, seeded, Facade } from './kit.js';
import { fbox } from './deco.js';
import { strut, parkCar } from './kits.js';
import { palm } from './palms.js';
import { shadeTree, clump } from './streetscape.js';
import { CURB } from './layout.js';

// (v5, ROADMAP 11.2ג) The yards. A real city is not a wall of fronts on the sidewalk and a wall of
// backs on the alley: the hotels and the flats stand back behind a forecourt or a garden, the towers
// stand free with a strip of lawn either side, and nearly every lot keeps a piece of ground behind
// its building on the alley - a garden with a tree, the washing on a line and a table under it; a
// yard of concrete with the bins, the pallets and the delivery van; a place to park - each behind
// a fence of its own: stucco on blocks, boards, chain link, a hedge, the bougainvillea over it.
// Built once a row's buildings stand (world/sobe.js), by dice of each lot's own (by where it is),
// so the buildings themselves are what they were.

const GRASS = [srgb(0.46, 0.7, 0.4), srgb(0.5, 0.74, 0.42), srgb(0.55, 0.72, 0.38), srgb(0.6, 0.69, 0.4)];
const CONCRETE = [srgb(0.73, 0.72, 0.69), srgb(0.67, 0.66, 0.64), srgb(0.77, 0.75, 0.71)];
const PAVE = srgb(0.9, 0.86, 0.78);
const STAIN = srgb(0.52, 0.5, 0.5);
const WOOD = [srgb(0.62, 0.49, 0.36), srgb(0.7, 0.58, 0.45), srgb(0.53, 0.43, 0.35), srgb(0.92, 0.91, 0.88)];
const STEEL = srgb(0.62, 0.64, 0.68);
const HEDGES = [srgb(0.26, 0.5, 0.28), srgb(0.3, 0.55, 0.3), srgb(0.24, 0.46, 0.3), srgb(0.33, 0.52, 0.27)];
const STUCCO = [srgb(0.95, 0.93, 0.89), srgb(0.86, 0.85, 0.82), srgb(0.96, 0.88, 0.8), srgb(0.88, 0.91, 0.86), srgb(0.95, 0.85, 0.85), srgb(0.84, 0.88, 0.92)];
// bougainvillea (magenta, pink), ixora (orange-red), allamanda (yellow), hibiscus (red)
const BLOOM = [srgb(0.86, 0.2, 0.55), srgb(0.93, 0.36, 0.6), srgb(0.95, 0.42, 0.26), srgb(0.97, 0.84, 0.3), srgb(0.88, 0.16, 0.2)];
const CLOTHES = [srgb(0.95, 0.95, 0.92), srgb(0.3, 0.5, 0.85), srgb(0.95, 0.55, 0.6), srgb(1.0, 0.85, 0.3), srgb(0.5, 0.75, 0.55), srgb(0.6, 0.45, 0.75), srgb(0.2, 0.22, 0.3)];
const BINS = [srgb(0.2, 0.42, 0.3), srgb(0.2, 0.3, 0.56), srgb(0.28, 0.28, 0.3)];
const DUMPSTERS = [srgb(0.24, 0.5, 0.4), srgb(0.3, 0.38, 0.62), srgb(0.62, 0.3, 0.3)];
const WHITE = srgb(0.95, 0.95, 0.93);

const OPEN = new Set(['lot', 'vacant', 'plot']);
// (the ones that keep their own yard in front: the garden flats)
const OWN_FRONT = new Set(['apt', 'aptU']);

// a lot's own dice, by where it is
export function diceAt(x, z, salt = 0) {
  const h = Math.abs(Math.round(x * 13.7) * 7919 + Math.round(z * 7.3) * 104729 + salt * 31337);
  return seeded(1 + (h % 2147483640));
}

// many boxes as one shape (the boards of a fence, the courses of tiles on a roof)
export class BoxSet {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.idx = [];
  }

  add(mn, mx) {
    const [x0, y0, z0] = mn;
    const [x1, y1, z1] = mx;
    const P = this.pos;
    const N = this.nor;
    const I = this.idx;
    const quad = (a, b, c, d, n) => {
      const o = P.length / 3;
      P.push(...a, ...b, ...c, ...d);
      for (let i = 0; i < 4; i++) N.push(...n);
      I.push(o, o + 1, o + 2, o, o + 2, o + 3);
    };
    quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]);
    quad([x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0]);
    quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]);
    quad([x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [0, -1, 0]);
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
  }

  fb(f, u0, v0, w0, u1, v1, w1) {
    this.add(...f.box(u0, v0, w0, u1, v1, w1));
  }

  flush(ctx, mat, color, id = nextId()) {
    if (!this.pos.length) return id;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setIndex(this.idx);
    ctx.B.add(mat, g, null, id, { color });
    return id;
  }
}

// flat ground over u0..u1, w0..w1 of a front (grass, concrete, a path), at the height y
function ground(ctx, mat, f, u0, w0, u1, w1, y, color) {
  if (u1 - u0 < 0.2 || w1 - w0 < 0.2) return;
  const g = new THREE.PlaneGeometry(u1 - u0, w1 - w0).rotateX(-Math.PI / 2);
  g.rotateY(Math.atan2(f.nx, f.nz));
  const c = f.p((u0 + u1) / 2, 0, (w0 + w1) / 2);
  g.translate(c[0], y, c[2]);
  ctx.B.add(mat, g, null, nextId(), { color });
}

// the pieces of a..b left between the cuts ([c0, c1] each)
function runs(a, b, cuts, min = 0.4) {
  const out = [];
  let s = a;
  for (const [c0, c1] of cuts.slice().sort((p, q) => p[0] - q[0])) {
    if (c1 <= s || c0 >= b) continue;
    if (c0 - s >= min) out.push([s, c0]);
    s = Math.max(s, c1);
  }
  if (b - s >= min) out.push([s, b]);
  return out;
}

// an upright cylinder from y0, h high
function post(ctx, mat, x, y0, z, rad, h, color, id = nextId(), seg = 6) {
  const g = new THREE.CylinderGeometry(rad, rad, h, seg);
  g.translate(x, y0 + h / 2, z);
  ctx.B.add(mat, g, null, id, { color });
}

// ------------------------------------------------------------------ a clipped hedge
// (v5, ROADMAP 11.18) A hedge the gardener keeps: the shape of a box, but its top edges rounded
// off, its faces not quite flat (the leaves stand out here and there, a hollow there), lit as the
// round thing it is so the pen draws its outline and not its facets. In the front's frame (u along
// it, w out of it); the bottom on the ground, square.
export function softBox(f, u0, y0, w0, u1, y1, w1, o = {}) {
  const a = (u1 - u0) / 2;
  const b = (y1 - y0) / 2;
  const c = (w1 - w0) / 2;
  const rr = Math.min(o.round || 0.2, a * 0.9, b * 0.9, c * 0.9);
  const amp = o.amp !== undefined ? o.amp : 0.045;
  const seed = o.seed || 0;
  const g = new THREE.BoxGeometry(2 * a, 2 * b, 2 * c, Math.max(2, Math.round(a / 0.16)), Math.max(2, Math.round(b / 0.16)), Math.max(2, Math.round(c / 0.16)));
  const P = g.attributes.position;
  const N = g.attributes.normal;
  const cu = (u0 + u1) / 2;
  const cy = (y0 + y1) / 2;
  const cw = (w0 + w1) / 2;
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i);
    let y = P.getY(i);
    let z = P.getZ(i);
    // (onto the rounded box: the nearest point of the box inside it, pushed out by the round)
    const qx = Math.max(-a + rr, Math.min(a - rr, x));
    const qy = Math.max(-b, Math.min(b - rr, y));
    const qz = Math.max(-c + rr, Math.min(c - rr, z));
    let dx = x - qx;
    let dy = y - qy;
    let dz = z - qz;
    const l = Math.hypot(dx, dy, dz);
    let nx = N.getX(i);
    let ny = N.getY(i);
    let nz = N.getZ(i);
    if (l > 1e-6) {
      dx /= l;
      dy /= l;
      dz /= l;
      x = qx + dx * rr;
      y = qy + dy * rr;
      z = qz + dz * rr;
      nx = dx;
      ny = dy;
      nz = dz;
    }
    // (the leaves: out and in a little, never at the ground)
    if (y > -b + 1e-4) {
      const k = amp * Math.min(1, (y + b) / 0.25) * (Math.sin(x * 3.7 + seed) * Math.cos(z * 4.1 + seed * 0.7) + 0.6 * Math.sin(y * 5.3 + x * 1.7 + seed * 1.3) + 0.45 * Math.sin((x - z) * 9.1 + y * 7.7 + seed * 2.1));
      x += nx * k;
      y += ny * k;
      z += nz * k;
    }
    const pw = f.p(cu + x, cy + y, cw + z);
    P.setXYZ(i, pw[0], pw[1], pw[2]);
    N.setXYZ(i, f.ux * nx + f.nx * nz, ny, f.uz * nx + f.nz * nz);
  }
  // (a front whose u, up and w turn the other way round: the faces' winding turned with it)
  if (f.ux * f.nz - f.uz * f.nx < 0) {
    const I = g.index;
    for (let i = 0; i < I.count; i += 3) {
      const t = I.getX(i + 1);
      I.setX(i + 1, I.getX(i + 2));
      I.setX(i + 2, t);
    }
  }
  return g;
}

// ------------------------------------------------------------------ fences
/**
 * A fence from (x0, z0) to (x1, z1): 'wall' (stucco on blocks, a cap, a pier every few metres),
 * 'wood' (boards on two rails), 'chain' (chain link on steel posts, now and then a green screen on
 * it), 'hedge', 'picket' (the low white one of a house's garden); o: { h, color, bloom }
 */
export function fence(ctx, r, x0, z0, x1, z1, type, o = {}) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.5) return;
  const ux = (x1 - x0) / len;
  const uz = (z1 - z0) / len;
  const f = new Facade(x0, z0, ux, uz, -uz, ux);
  const M = ctx.M;
  const id = nextId();
  const solid = (u0, w0, u1, h, w1, tag) => {
    const [mn, mx] = f.box(u0, 0, w0, u1, CURB + h, w1);
    ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, mx[1], tag);
  };
  const h = o.h || 1.8;
  let top = CURB + h;
  if (type === 'wall') {
    const c = o.color || r.pick(STUCCO);
    fbox(ctx, f, M.wall, 0, CURB, -0.1, len, CURB + h, 0.1, c, id);
    fbox(ctx, f, M.wall, -0.03, CURB + h, -0.14, len + 0.03, CURB + h + 0.08, 0.14, c.clone().multiplyScalar(0.88), id);
    const n = Math.max(1, Math.round(len / 3.4));
    for (let k = 0; k <= n; k++) {
      const u = Math.min(len - 0.17, Math.max(0.17, (len * k) / n));
      fbox(ctx, f, M.wall, u - 0.17, CURB, -0.15, u + 0.17, CURB + h + 0.16, 0.15, c, id);
    }
    // (a wall a spray can finds: game/graffiti.js)
    solid(0, -0.15, len, h + 0.1, 0.15, 'wall');
    top += 0.08;
  } else if (type === 'wood' || type === 'picket') {
    const pick = type === 'picket';
    const c = o.color || (pick ? WHITE : r.pick(WOOD));
    const S = new BoxSet();
    const step = pick ? 1.8 : 2.4;
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k <= n; k++) {
      const u = Math.min(len - 0.05, Math.max(0.05, (len * k) / n));
      S.fb(f, u - 0.05, CURB, -0.1, u + 0.05, CURB + h + 0.04, -0.0);
    }
    for (const v of pick ? [0.18, h - 0.2] : [0.32, h - 0.32]) S.fb(f, 0, CURB + v, -0.09, len, CURB + v + 0.08, -0.03);
    const bw = pick ? 0.09 : 0.24;
    const gap = pick ? 0.07 : 0.02;
    for (let u = 0.01; u < len - 0.03; u += bw + gap) S.fb(f, u, CURB + 0.05, -0.03, Math.min(len, u + bw), CURB + h - (pick ? 0 : 0), 0.0);
    S.flush(ctx, M.prop, c, id);
    solid(0, -0.1, len, h, 0.04, 'prop');
  } else if (type === 'chain') {
    const n = Math.max(1, Math.round(len / 2.6));
    const step = len / n;
    for (let k = 0; k <= n; k++) {
      const p = f.p(step * k, 0, 0);
      post(ctx, M.rail, p[0], CURB, p[2], 0.04, h, STEEL, id);
    }
    strut(ctx, M.rail, f.p(0, CURB + h, 0), f.p(len, CURB + h, 0), 0.05, STEEL, id);
    strut(ctx, M.rail, f.p(0, CURB + 0.1, 0), f.p(len, CURB + 0.1, 0), 0.03, STEEL, id);
    for (let k = 0; k < n; k++) {
      const a = step * k;
      for (let j = 0; j < 3; j++) {
        const t0 = a + (step * j) / 3;
        const t1 = a + (step * (j + 1)) / 3;
        strut(ctx, M.rail, f.p(t0, CURB + 0.1, 0.01), f.p(t1, CURB + h, 0.01), 0.015, STEEL, id);
        strut(ctx, M.rail, f.p(t1, CURB + 0.1, 0.01), f.p(t0, CURB + h, 0.01), 0.015, STEEL, id);
      }
    }
    // (now and then a green screen on it, the way the lots behind the shops hide what is in them)
    if (o.screen) fbox(ctx, f, M.prop, 0, CURB + 0.12, -0.02, len, CURB + h - 0.06, -0.005, srgb(0.2, 0.34, 0.27));
    solid(0, -0.06, len, h, 0.06, 'prop');
  } else if (type === 'hedge') {
    const t = o.t || 0.42;
    const base = o.color || r.pick(HEDGES);
    if (h >= 1.3) {
      // a tall one: the body of it, and over it the leaves in rounded clumps, none quite the size
      // of the next (the gardener has not been for a while)
      ctx.B.add(M.leaf, softBox(f, 0, CURB, -t, len, CURB + h - 0.3, t, { round: 0.12, seed: r() * 100 }), null, nextId(), { color: base });
      for (let u = r.range(0.2, 0.5); u < len - 0.15; u += r.range(0.75, 1.05)) {
        const p = f.p(u, 0, r.range(-0.08, 0.08));
        clump(ctx, r, p[0], CURB + h - 0.36 + r.range(-0.08, 0.12), p[2], r.range(0.5, 0.66), 0.82, base.clone().multiplyScalar(r.range(0.9, 1.12)), M.leaf, false);
      }
    } else {
      let u = 0;
      while (u < len - 0.05) {
        const seg = Math.min(len - u, r.range(1.3, 2.6));
        const hh = h * r.range(0.86, 1.1);
        const tt = t * r.range(0.9, 1.12);
        // (each stretch clipped a little differently: its top rounded, its faces leafy)
        ctx.B.add(M.leaf, softBox(f, u - 0.04, CURB, -tt, u + seg + 0.04, CURB + hh, tt, { round: Math.min(0.26, tt * 0.75), seed: r() * 100, amp: 0.05 }), null, nextId(), { color: base.clone().multiplyScalar(r.range(0.9, 1.08)) });
        u += seg;
      }
    }
    solid(0, -t, len, h, t, 'prop');
  }
  // the bougainvillea: clumps of magenta (or of another flower) tumbling over a stretch of it
  if (o.bloom && len > 2) {
    const col = o.bloomCol || BLOOM[0];
    const a = r.range(0, len * 0.4);
    const b = Math.min(len, a + r.range(2.5, Math.max(3, len * 0.7)));
    for (let u = a + 0.4; u < b - 0.3; u += r.range(0.6, 1.0)) {
      const p = f.p(u, 0, r.range(-0.2, 0.2));
      const green = r() < 0.3;
      clump(ctx, r, p[0], top + r.range(-0.25, 0.1), p[2], r.range(0.42, 0.7), 0.7, green ? r.pick(HEDGES) : col.clone().multiplyScalar(r.range(0.9, 1.08)), M.leaf);
    }
  }
}

// a fence along a front's u at depth w (u0..u1)
function fenceU(ctx, r, f, u0, u1, w, type, o) {
  const a = f.p(u0, 0, w);
  const b = f.p(u1, 0, w);
  fence(ctx, r, a[0], a[2], b[0], b[2], type, o);
}

// ------------------------------------------------------------------ what is in a yard
// a tree in a yard: lighter than the street's (fewer clumps), leaning away from the wall (away: a
// direction out of the yard); not where something already stands. The yards' kinds: live oaks,
// mahoganies, royal poincianas (half of them in flower), sea grapes
const YARD_TREES = [['oak', 0.36], ['mahogany', 0.22], ['poinciana', 0.27], ['grape', 0.15]];
function yardKind(r) {
  let t = r();
  for (const [k, p] of YARD_TREES) {
    t -= p;
    if (t <= 0) return k;
  }
  return 'oak';
}
function yardTree(ctx, r, x, z, away, size, kind = null) {
  if (ctx.col.pointInside(x, 1.0, z, 0.7)) return null;
  return shadeTree(ctx, r, x, z, { lite: true, away, size, kind: kind || yardKind(r) });
}

// a palm in a yard (o.royal: a royal palm, straight and grey, the towers' kind)
const ROYAL = srgb(0.8, 0.78, 0.74);
function yardPalm(ctx, r, x, z, o = {}) {
  if (ctx.col.pointInside(x, 1.0, z, 0.5)) return;
  palm(ctx, r, x, z, o.h || r.range(6.5, 10), o.royal ? { y0: CURB, royal: ROYAL, lean: 0.12 } : { y0: CURB });
}

// a bush, or a flowering one
export function bush(ctx, r, x, z, s = 1, color = null) {
  if (ctx.col.pointInside(x, 0.6, z, 0.3)) return;
  const id = ctx.objects.begin(ctx, 'bush', x, z);
  const c = color || r.pick(HEDGES);
  clump(ctx, r, x, CURB + 0.48 * s, z, 0.72 * s, 0.78, c.clone().multiplyScalar(r.range(0.92, 1.08)), ctx.M.leaf);
  if (r() < 0.65) clump(ctx, r, x + r.range(-0.45, 0.45) * s, CURB + 0.4 * s, z + r.range(-0.45, 0.45) * s, 0.52 * s, 0.82, c.clone().multiplyScalar(r.range(0.95, 1.12)), ctx.M.leaf);
  ctx.col.addCircle(x, z, 0.55 * s, 0, 1.0 * s, 'prop');
  ctx.objects.end(ctx, id);
}

// the washing on a line between two T-posts (the line along u, at w)
function clothesline(ctx, r, f, u0, u1, w) {
  const M = ctx.M;
  const grey = srgb(0.6, 0.6, 0.64);
  const c = f.p((u0 + u1) / 2, 0, w);
  const id = ctx.objects.begin(ctx, 'pole', c[0], c[2]);
  for (const u of [u0, u1]) {
    const p = f.p(u, 0, w);
    post(ctx, M.pole, p[0], CURB, p[2], 0.04, 2.1, grey);
    strut(ctx, M.pole, f.p(u, CURB + 2.0, w - 0.5), f.p(u, CURB + 2.0, w + 0.5), 0.05, grey);
    ctx.col.addCircle(p[0], p[2], 0.06, 0, CURB + 2.1, 'pole');
  }
  for (const dw of [-0.42, 0, 0.42]) strut(ctx, M.rail, f.p(u0, CURB + 1.98, w + dw), f.p(u1, CURB + 1.98, w + dw), 0.015, srgb(0.86, 0.86, 0.86));
  const n = r.int(3, 7);
  for (let k = 0; k < n; k++) {
    const ww = r.range(0.35, 0.9);
    const u = r.range(u0 + 0.2 + ww / 2, u1 - 0.2 - ww / 2);
    const dw = r.pick([-0.42, 0, 0.42]);
    const hh = r.range(0.35, 0.95);
    fbox(ctx, f, M.prop, u - ww / 2, CURB + 1.97 - hh, w + dw - 0.012, u + ww / 2, CURB + 1.97, w + dw + 0.012, r.pick(CLOTHES));
  }
  ctx.objects.end(ctx, id);
}

// a round table and its plastic chairs (now and then a sunshade over them)
function patioSet(ctx, r, x, z) {
  if (ctx.col.pointInside(x, 0.6, z, 1.3)) return;
  const M = ctx.M;
  const id = ctx.objects.begin(ctx, 'chair', x, z);
  const top = new THREE.CylinderGeometry(0.5, 0.5, 0.04, 14);
  top.translate(x, CURB + 0.72, z);
  ctx.B.add(M.propCyl, top, null, nextId(), { color: WHITE });
  const leg = new THREE.CylinderGeometry(0.04, 0.07, 0.72, 6);
  leg.translate(x, CURB + 0.36, z);
  ctx.B.add(M.propCyl, leg, null, nextId(), { color: WHITE });
  const col = r() < 0.7 ? WHITE : r.pick(CLOTHES);
  const n = r.int(2, 4);
  const a0 = r() * Math.PI * 2;
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * Math.PI * 2 + r.range(-0.3, 0.3);
    const cx = x + Math.cos(a) * 0.86;
    const cz = z + Math.sin(a) * 0.86;
    const yaw = Math.atan2(Math.cos(a), Math.sin(a));
    for (const [sx, sy, sz, ox, oy, oz] of [[0.46, 0.06, 0.44, 0, 0.44, 0], [0.46, 0.46, 0.05, 0, 0.7, 0.2], [0.42, 0.42, 0.38, 0, 0.21, 0]]) {
      const g = new THREE.BoxGeometry(sx, sy, sz);
      g.translate(ox, oy, oz);
      g.rotateY(yaw);
      g.translate(cx, CURB, cz);
      ctx.B.add(M.prop, g, null, nextId(), { color: col });
    }
  }
  if (r() < 0.45) {
    post(ctx, M.pole, x, CURB + 0.7, z, 0.025, 1.6, WHITE);
    const shade = new THREE.ConeGeometry(1.25, 0.45, 10, 1, true);
    shade.translate(x, CURB + 2.35, z);
    ctx.B.add(M.awning, shade, null, nextId(), { color: r.pick([srgb(0.95, 0.35, 0.4), srgb(0.25, 0.65, 0.84), srgb(1.0, 0.8, 0.25), srgb(0.55, 0.85, 0.5), srgb(0.96, 0.95, 0.9)]) });
  }
  ctx.col.addCircle(x, z, 0.55, 0, 0.75, 'prop');
  ctx.objects.end(ctx, id);
}

// a little shed in a corner: boards or tin, its roof sloping back (u0..u1, w0..w1 of the front)
function shed(ctx, r, f, u0, w0, u1, w1) {
  const M = ctx.M;
  const c = r.pick([srgb(0.92, 0.9, 0.85), srgb(0.62, 0.72, 0.6), srgb(0.66, 0.55, 0.44), srgb(0.75, 0.8, 0.86)]);
  const p = f.p((u0 + u1) / 2, 0, (w0 + w1) / 2);
  const id = ctx.objects.begin(ctx, 'crate', p[0], p[2]);
  fbox(ctx, f, M.wall, u0, CURB, w0, u1, CURB + 2.1, w1, c);
  fbox(ctx, f, M.awning, u0 - 0.12, CURB + 2.1, w0 - 0.15, u1 + 0.12, CURB + 2.22, w1 + 0.15, r.pick([srgb(0.55, 0.57, 0.6), srgb(0.3, 0.45, 0.36), srgb(0.62, 0.32, 0.26)]));
  // the door, toward the house (w1)
  const um = (u0 + u1) / 2;
  fbox(ctx, f, M.frame, um - 0.45, CURB, w1, um + 0.45, CURB + 1.9, w1 + 0.04, c.clone().multiplyScalar(0.7));
  const [mn, mx] = f.box(u0, 0, w0, u1, CURB + 2.22, w1);
  ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, mx[1], 'prop');
  ctx.objects.end(ctx, id);
}

// the bins (a household's carts, or a dumpster's worth behind the shops), against a fence: n of
// them along u from u0 at w (their backs to w + back)
function bins(ctx, r, f, u0, w, n, back) {
  const M = ctx.M;
  const c0 = f.p(u0, 0, w);
  const id = ctx.objects.begin(ctx, 'trash', c0[0], c0[2]);
  for (let k = 0; k < n; k++) {
    const u = u0 + k * 0.78;
    const col = r.pick(BINS);
    fbox(ctx, f, M.prop, u - 0.3, CURB + 0.05, w - 0.36, u + 0.3, CURB + 1.02, w + 0.36, col);
    fbox(ctx, f, M.prop, u - 0.33, CURB + 1.02, w - 0.4, u + 0.33, CURB + 1.08, w + 0.4, col.clone().multiplyScalar(0.8));
    // (the wheels on the fence's side: an axle along it)
    strut(ctx, M.prop, f.p(u - 0.33, CURB + 0.1, w + back * 0.3), f.p(u + 0.33, CURB + 0.1, w + back * 0.3), 0.2, srgb(0.12, 0.12, 0.14));
  }
  const [mn, mx] = f.box(u0 - 0.35, 0, w - 0.4, u0 + (n - 1) * 0.78 + 0.35, CURB + 1.08, w + 0.4);
  ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, mx[1], 'prop');
  ctx.objects.end(ctx, id);
}

// a dumpster against the alley's fence (its long side along u)
function dumpsterIn(ctx, r, f, u, w) {
  const M = ctx.M;
  const c = f.p(u, 0, w);
  const id = ctx.objects.begin(ctx, 'dumpster', c[0], c[2]);
  const col = r.pick(DUMPSTERS);
  fbox(ctx, f, M.prop, u - 1.0, CURB, w - 0.8, u + 1.0, CURB + 1.25, w + 0.8, col);
  fbox(ctx, f, M.prop, u - 1.05, CURB + 1.25, w - 0.85, u + 1.05, CURB + 1.33, w + 0.85, col.clone().multiplyScalar(0.8));
  const [mn, mx] = f.box(u - 1.0, 0, w - 0.8, u + 1.0, CURB + 1.33, w + 0.8);
  ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, mx[1], 'prop');
  ctx.hideSpots.push({ x: c[0], z: c[2], r: 1.6, kind: 'dumpster' });
  ctx.objects.end(ctx, id);
}

// pallets leaning and stacked, a crate or two
function pallets(ctx, r, f, u, w) {
  const M = ctx.M;
  const c = f.p(u, 0, w);
  const id = ctx.objects.begin(ctx, 'crate', c[0], c[2]);
  const wood = srgb(0.7, 0.55, 0.38);
  const n = r.int(2, 5);
  for (let k = 0; k < n; k++) fbox(ctx, f, M.prop, u - 0.6, CURB + k * 0.15, w - 0.5, u + 0.6, CURB + k * 0.15 + 0.13, w + 0.5, wood.clone().multiplyScalar(r.range(0.85, 1.05)));
  if (r() < 0.6) fbox(ctx, f, M.prop, u + 0.9, CURB, w - 0.35, u + 1.6, CURB + 0.7, w + 0.35, srgb(0.72, 0.52, 0.34));
  const [mn, mx] = f.box(u - 0.6, 0, w - 0.5, u + 1.6, CURB + Math.max(0.7, n * 0.15), w + 0.5);
  ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, mx[1], 'prop');
  ctx.objects.end(ctx, id);
}

// a swimming pool behind a house: its coping, the water, a deck round it, a lounger or two
function pool(ctx, r, f, u0, w0, u1, w1) {
  const M = ctx.M;
  const deck = r.pick([PAVE, srgb(0.86, 0.84, 0.8), srgb(0.78, 0.66, 0.54)]);
  ground(ctx, M.court, f, u0 - 1.0, w0 - 1.0, u1 + 1.0, w1 + 1.0, CURB + 0.03, deck);
  fbox(ctx, f, M.wallSolid, u0, CURB, w0, u1, CURB + 0.32, w1, srgb(0.97, 0.97, 0.95));
  const g = new THREE.PlaneGeometry(u1 - u0 - 0.5, w1 - w0 - 0.5).rotateX(-Math.PI / 2);
  g.rotateY(Math.atan2(f.nx, f.nz));
  const c = f.p((u0 + u1) / 2, 0, (w0 + w1) / 2);
  g.translate(c[0], CURB + 0.33, c[2]);
  ctx.B.add(M.pool, g, null, nextId());
  const [mn, mx] = f.box(u0, 0, w0, u1, CURB + 0.32, w1);
  ctx.col.addBox(mn[0], mn[2], mx[0], mx[2], 0, mx[1], 'prop');
  if (ctx.footprints) ctx.footprints.push({ x0: mn[0], z0: mn[2], x1: mx[0], z1: mx[2], pool: true });
  // the loungers along one side
  const n = r.int(1, 3);
  for (let k = 0; k < n; k++) {
    const u = u0 + 0.6 + k * 1.1;
    if (u > u1 - 0.4) break;
    const lc = f.p(u, 0, w1 + 0.55);
    const id = ctx.objects.begin(ctx, 'chair', lc[0], lc[2]);
    const col = r() < 0.6 ? WHITE : r.pick(CLOTHES);
    fbox(ctx, f, M.prop, u - 0.32, CURB + 0.25, w1 + 0.15, u + 0.32, CURB + 0.33, w1 + 1.95, col);
    fbox(ctx, f, M.prop, u - 0.32, CURB + 0.3, w1 + 1.6, u + 0.32, CURB + 0.85, w1 + 1.95, col);
    fbox(ctx, f, M.prop, u - 0.28, CURB, w1 + 0.25, u + 0.28, CURB + 0.25, w1 + 1.85, srgb(0.7, 0.7, 0.72));
    ctx.objects.end(ctx, id);
  }
}

// ------------------------------------------------------------------ a row's yards
/**
 * The yards of a row, once its buildings stand (world/sobe.js). lots: north to south, each
 * { kind, f (its front on the sidewalk's line), L, za, zb, front (how far its building stands back),
 * back (how far back it reaches), gapA, gapB (the free strips at u = 0 and u = L, a tower's), info };
 * o: the row's { x, side, D, street, type, back }
 */
export function rowYards(ctx, lots, o) {
  const home = o.street === 'meridian' || o.street === 'west';
  const D = o.D;
  const side = o.side;
  for (const lot of lots) {
    lot.r = diceAt(o.x, (lot.za + lot.zb) / 2, 11);
    const r = lot.r;
    const open = OPEN.has(lot.kind);
    lot.open = open;
    lot.backYard = !open && lot.back < D - 0.6 ? D - lot.back : 0;
    lot.gapA = lot.gapA || 0;
    lot.gapB = lot.gapB || 0;
    // (the ends of the lot: which is north, which south)
    lot.gapN = side > 0 ? lot.gapB : lot.gapA;
    lot.gapS = side > 0 ? lot.gapA : lot.gapB;
    // what its ground is for: a garden (where people live), a service yard, a place to park
    const homeKind = lot.kind === 'house' || lot.kind === 'apt' || lot.kind === 'aptU' || lot.kind === 'condo';
    if (open) lot.use = null;
    else if (homeKind || (home && (lot.kind === 'med' || lot.kind === 'mimo'))) lot.use = 'garden';
    else if (home && r() < 0.5) lot.use = 'garden';
    else lot.use = lot.backYard >= 5.6 && o.alley !== false && r() < 0.4 ? 'parking' : 'service';
  }
  // the fences between neighbours (and at the ends of the row, on the cross streets)
  const x = (w) => o.x - side * w;
  for (let i = 0; i <= lots.length; i++) {
    const A = lots[i - 1] || null; // north of the line
    const B = lots[i] || null; // south of it
    const z = A ? A.zb : B.za;
    // (into the lot a little at the row's ends: the fence on the lot, not on the sidewalk)
    const zf = !A ? z + 0.15 : !B ? z - 0.15 : z;
    const r = (B || A).r;
    const solidA = A && !A.open && !A.gapS ? [A.front, A.back] : null;
    const solidB = B && !B.open && !B.gapN ? [B.front, B.back] : null;
    const builtA = A && !A.open;
    const builtB = B && !B.open;
    if (!builtA && !builtB) continue;
    // along the line from the sidewalk to the alley, but where a building's side wall is: in
    // front of the buildings a low hedge between two gardens (nothing between forecourts), behind
    // them a fence a man's height
    const fmin = Math.min(builtA ? A.front : Infinity, builtB ? B.front : Infinity);
    const cover = [solidA, solidB].filter(Boolean);
    const segs = runs(0.5, D - 0.24, cover, 0.6);
    const uses = [A && A.use, B && B.use];
    const garden = uses.every((u) => !u || u === 'garden');
    const street = !A || !B;
    for (const [s0, s1] of segs) {
      const parts = [];
      if (s0 < fmin - 0.3) parts.push([s0, Math.min(s1, fmin), true]);
      if (s1 > fmin + 0.3) parts.push([Math.max(s0, fmin), s1, false]);
      for (const [w0, w1, front] of parts) {
        if (w1 - w0 < 0.6) continue;
        let type;
        let h = 1.8;
        if (front) {
          if (!home || street) continue;
          type = 'hedge';
          h = 0.95;
        } else if (street) type = garden && r() < 0.45 ? 'hedge' : 'wall';
        else if (garden) type = r() < 0.55 ? 'wood' : r() < 0.6 ? 'hedge' : 'wall';
        else type = r() < 0.5 ? 'wall' : 'chain';
        if (type === 'hedge' && !front) h = r.range(1.6, 2.2);
        fence(ctx, r, x(w0), zf, x(w1), zf, type, { h, t: front ? 0.3 : 0.42, bloom: garden && type !== 'hedge' && r() < 0.35, bloomCol: r.pick(BLOOM) });
      }
    }
  }
  for (const lot of lots) {
    if (lot.open) {
      if (lot.kind === 'vacant') overgrown(ctx, lot, o);
      continue;
    }
    if (lot.backYard > 0.6) backYard(ctx, lot, o, home);
    if (lot.front > 0.8 && !OWN_FRONT.has(lot.kind)) frontYard(ctx, lot, o, home);
    if (lot.gapA > 0.6 || lot.gapB > 0.6) sideYards(ctx, lot, o);
  }
}

// ------------------------------------------------------------------ behind the building
function backYard(ctx, lot, o, home) {
  const r = lot.r;
  const M = ctx.M;
  const f = lot.f;
  const L = lot.L;
  const D = o.D;
  const wb = -lot.back; // the building's back wall
  const wa = -D + 0.24; // the alley's fence (its inner face)
  const depth = wb - wa;
  const u0 = lot.gapA > 0.6 ? 0.2 : 0.15;
  const u1 = L - 0.15;
  // the way through to the alley: in line with the back door (world/deco.js backFront puts it at
  // a third of the back's own length from its end)
  const uGate = Math.min(L - 1.4, Math.max(1.4, L * 0.65));
  const use = lot.use;
  const alley = o.alley !== false;
  // the ground
  if (use === 'garden') {
    ground(ctx, M.grass, f, u0, wa, u1, wb, CURB + 0.02, r.pick(GRASS));
    if (depth > 2.6) ground(ctx, M.court, f, Math.max(u0, uGate - 1.7), wb - 2.2, Math.min(u1, uGate + 1.7), wb, CURB + 0.03, r.pick(CONCRETE));
    if (depth > 3.6 && alley) ground(ctx, M.court, f, uGate - 0.5, wa, uGate + 0.5, wb - 2.2, CURB + 0.03, PAVE);
  } else {
    const c = r.pick(CONCRETE);
    ground(ctx, M.court, f, u0, wa, u1, wb, CURB + 0.02, use === 'parking' ? c.clone().multiplyScalar(0.8) : c);
    // (oil, the rain's dirt)
    for (let k = r.int(1, 3); k > 0; k--) {
      const u = r.range(u0 + 1, u1 - 1);
      const w = r.range(wa + 0.8, wb - 0.8);
      const s = r.range(0.5, 1.3);
      ground(ctx, M.court, f, u - s, w - s * 0.6, u + s, w + s * 0.6, CURB + 0.025, STAIN);
    }
  }
  // the fence on the alley (or at the city's edge), its gate
  {
    let type;
    if (use === 'garden') type = home ? r.pick(['wood', 'wood', 'wall', 'hedge']) : r.pick(['wall', 'wood']);
    else type = r.pick(['wall', 'chain', 'chain']);
    let gate = null;
    if (use === 'parking') gate = [Math.max(u0, uGate - 2.9), Math.min(u1, uGate + 2.9)];
    else if (alley && (use === 'garden' || r() < 0.5)) gate = use === 'garden' ? [uGate - 0.6, uGate + 0.6] : [uGate - 1.5, uGate + 1.5];
    const parts = runs(0, L, gate ? [gate] : [], 0.5);
    const bloom = use === 'garden' && type !== 'hedge' && r() < 0.35;
    const bloomCol = r.pick(BLOOM);
    for (const [a, b] of parts) {
      fenceU(ctx, r, f, a, b, -D + 0.12, type, { h: type === 'hedge' ? r.range(1.7, 2.2) : 1.8, bloom: bloom && b - a > 3, bloomCol, screen: type === 'chain' && r() < 0.4 });
      // (a wall of stucco on the alley: the kids' tags find it, world/alleys.js)
      if (type === 'wall' && alley) {
        const pa = f.p(a, 0, -D + 0.02);
        const pb = f.p(b, 0, -D + 0.02);
        (ctx.alleyFences = ctx.alleyFences || []).push({ x: pa[0], face: Math.sign(-f.nx), z0: Math.min(pa[2], pb[2]), z1: Math.max(pa[2], pb[2]), top: CURB + 1.88 });
      }
    }
    // (a gate in it: a frame of steel, the leaf standing open)
    if (gate && use !== 'parking' && type !== 'hedge') {
      const [ga, gb] = gate;
      for (const u of [ga, gb]) {
        const p = f.p(u, 0, -D + 0.12);
        post(ctx, M.rail, p[0], CURB, p[2], 0.05, 1.85, srgb(0.3, 0.3, 0.34));
      }
      strut(ctx, M.rail, f.p(gb, CURB + 0.1, -D + 0.12), f.p(gb - 0.3, CURB + 0.1, -D + 0.12 + (gb - ga) * 0.9), 0.04, srgb(0.3, 0.3, 0.34));
      strut(ctx, M.rail, f.p(gb, CURB + 1.75, -D + 0.12), f.p(gb - 0.3, CURB + 1.75, -D + 0.12 + (gb - ga) * 0.9), 0.04, srgb(0.3, 0.3, 0.34));
    }
  }
  // what is in it
  const away = [-f.nx, -f.nz]; // out of the yard, over the alley
  if (use === 'garden') {
    // a tree by the alley's fence (its limbs out over the alley), away from the gate; or a palm
    let treeU = null;
    if (depth >= 3.4 && L >= 6) {
      const sideU = uGate > L / 2 ? r.range(1.6, Math.max(1.7, uGate - 2.6)) : r.range(Math.min(L - 1.7, uGate + 2.6), L - 1.6);
      const c = f.p(sideU, 0, wa + Math.min(2.1, depth * 0.42));
      if (r() < 0.72) {
        if (yardTree(ctx, r, c[0], c[2], away, Math.min(1.25, 0.6 + depth * 0.09))) treeU = sideU;
      } else {
        yardPalm(ctx, r, c[0], c[2]);
        treeU = sideU;
      }
    } else if (depth >= 2.4 && r() < 0.5) {
      const u = r.range(1.2, L - 1.2);
      if (Math.abs(u - uGate) > 1.6) {
        const c = f.p(u, 0, wa + depth * 0.5);
        yardPalm(ctx, r, c[0], c[2], { h: r.range(5.5, 8.5) });
      }
    }
    // bushes along the side fences
    for (let k = r.int(0, 3); k > 0; k--) {
      const u = r() < 0.5 ? u0 + 0.7 : u1 - 0.7;
      const c = f.p(u, 0, r.range(wa + 0.7, wb - 0.7));
      bush(ctx, r, c[0], c[2], r.range(0.7, 1.15), r() < 0.35 ? r.pick(BLOOM) : null);
    }
    // the washing, a table and its chairs, a shed in a corner
    if (depth >= 3.6 && L >= 8 && r() < 0.34) {
      const span = r.range(3, Math.min(5.5, L - 3));
      const ua = treeU !== null && treeU < L / 2 ? L - 1.2 - span : 1.2;
      clothesline(ctx, r, f, ua, ua + span, wb - Math.min(depth - 1.0, r.range(2.6, 3.6)));
    }
    if (depth >= 2.8 && r() < 0.4) {
      const c = f.p(Math.min(u1 - 1.4, uGate + r.range(-1.2, 1.2) + (uGate > L / 2 ? -2.2 : 2.2)), 0, wb - 1.2);
      patioSet(ctx, r, c[0], c[2]);
    }
    if (depth >= 4.4 && L >= 10 && r() < 0.2) {
      const a = uGate > L / 2 ? u0 + 0.3 : u1 - 2.7;
      shed(ctx, r, f, a, wa + 0.25, a + 2.4, wa + 2.3);
    }
    // the household's bins by the gate, on the yard's side
    if (alley && r() < 0.7) bins(ctx, r, f, Math.min(u1 - 0.5, uGate + 1.2), wa + 0.5, r.int(1, 3), -1);
    // a pool behind a house (its deck by the back door, the loungers along it)
    if (lot.kind === 'house' && depth >= 5.4 && r() < 0.8) {
      const pw = Math.min(L - 4.5, r.range(5.5, 8.5));
      const pd = Math.min(depth - 2.9, r.range(3.0, 4.2));
      const pu = (L - pw) / 2 + r.range(-0.8, 0.8);
      if (pd > 2.5 && pw > 3.5) pool(ctx, r, f, pu, wb - 1.7 - pd, pu + pw, wb - 1.7);
    }
  } else if (use === 'parking') {
    // a car or two nose to the building, the gate open behind them
    const n = L >= 13 && depth >= 5.6 ? r.int(1, 2) : 1;
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? uGate : uGate + (k ? 1.5 : -1.5);
      if (r() < 0.82) parkCar(ctx, r, f, u, wb - 2.6, 1);
    }
    // a wheel stop at each bay
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? uGate : uGate + (k ? 1.5 : -1.5);
      fbox(ctx, f, M.prop, u - 0.8, CURB, wb - 0.6, u + 0.8, CURB + 0.12, wb - 0.4, srgb(0.85, 0.82, 0.7));
    }
  } else {
    // the service yard: a dumpster or the bins, pallets, now and then a tree that seeded itself
    if (depth >= 2.4) {
      const u = uGate > L / 2 ? r.range(1.3, Math.max(1.4, uGate - 3)) : r.range(Math.min(L - 1.4, uGate + 3), L - 1.3);
      if (r() < 0.55 && L >= 5) dumpsterIn(ctx, r, f, Math.min(L - 1.2, Math.max(1.2, u)), wa + 0.9);
      else bins(ctx, r, f, Math.max(u0 + 0.5, u - 1), wa + 0.5, r.int(2, 4), -1);
    }
    if (depth >= 2.8 && r() < 0.45) {
      const u = r.range(1.2, L - 2.2);
      const c = f.p(u, 0, wb - 0.7);
      if (!ctx.col.pointInside(c[0], 0.5, c[2], 1.2)) pallets(ctx, r, f, u, wb - 0.7);
    }
    if (depth >= 3.6 && r() < 0.4) {
      const u = r() < 0.5 ? u0 + 1.2 : u1 - 1.2;
      const c = f.p(u, 0, wa + Math.min(1.8, depth * 0.4));
      yardTree(ctx, r, c[0], c[2], away, r.range(0.75, 1.0));
    }
  }
}

// ------------------------------------------------------------------ in front of it
function frontYard(ctx, lot, o, home) {
  const r = lot.r;
  const M = ctx.M;
  const f = lot.f;
  const L = lot.L;
  const fr = lot.front;
  const info = lot.info || {};
  // where the doors are (the paths go to them)
  const doors = [];
  const doorOf = (p) => {
    const u = f.toU(p[0], p[2]);
    if (u > 0.3 && u < L - 0.3 && !doors.some((q) => Math.abs(q - u) < 1.5)) doors.push(u);
  };
  for (const p of info.doors || []) doorOf(p);
  if (info.shop && info.shop.door) doorOf(info.shop.door);
  if (!doors.length) doors.push(L / 2);
  const drive = info.drive || null;
  const ua = lot.gapA > 0.6 ? 0 : 0.15;
  const ub = lot.gapB > 0.6 ? L : L - 0.15;
  const garden = home || lot.kind === 'house' || lot.kind === 'condo' || lot.use === 'garden';
  const pathW = lot.kind === 'house' ? 0.65 : 1.0;
  const cuts = doors.map((u) => [u - pathW, u + pathW]).concat(drive ? [drive] : []);
  if (garden) {
    // the lawn, the paths to the doors, the drive
    const lawn = r.pick(GRASS);
    for (const [a, b] of runs(ua, ub, cuts, 0.3)) ground(ctx, M.grass, f, a, -fr + 0.1, b, -0.3, CURB + 0.02, lawn);
    for (const u of doors) ground(ctx, M.court, f, u - pathW, -fr, u + pathW, 0, CURB + 0.025, PAVE);
    if (drive) ground(ctx, M.court, f, drive[0], -fr - (info.driveIn || 0), drive[1], 0, CURB + 0.025, r.pick(CONCRETE));
    // the edge on the sidewalk: a hedge, a low wall, a picket fence, or open lawn
    const q = r();
    const edge = lot.kind === 'house' ? (q < 0.3 ? 'picket' : q < 0.55 ? 'hedge' : q < 0.75 ? 'wall' : null) : lot.kind === 'condo' ? (q < 0.5 ? 'hedge' : null) : q < 0.38 ? 'hedge' : q < 0.62 ? 'wall' : null;
    if (edge) {
      const gaps = doors.map((u) => [u - pathW - 0.15, u + pathW + 0.15]).concat(drive ? [[drive[0] - 0.2, drive[1] + 0.2]] : []);
      const h = edge === 'hedge' ? r.range(0.8, 1.15) : edge === 'picket' ? 0.95 : 0.7;
      const bloom = edge !== 'hedge' && r() < 0.3;
      const col = edge === 'wall' && info.pal && info.pal.trim ? info.pal.trim.clone().lerp(WHITE, 0.4) : null;
      for (const [a, b] of runs(ua, ub, gaps, 0.5)) fenceU(ctx, r, f, a, b, -0.3, edge, { h, bloom, bloomCol: r.pick(BLOOM), t: 0.32, color: col });
    }
    // plants: a tree or palms in the lawn, flowering bushes under the windows
    const away = [f.nx, f.nz];
    const free = runs(ua + 0.8, ub - 0.8, cuts.map(([a, b]) => [a - 0.8, b + 0.8]), 1.2);
    if (lot.kind === 'condo') {
      // (the towers' royal palms, in a line along the lawn)
      for (const [a, b] of free) {
        for (let u = a + 1.2; u < b - 0.6; u += r.range(4.5, 6.5)) {
          const c = f.p(u, 0, -fr * 0.5);
          yardPalm(ctx, r, c[0], c[2], { royal: true, h: r.range(10, 14) });
        }
      }
    } else if (free.length) {
      const [a, b] = r.pick(free);
      const u = r.range(a, b);
      const c = f.p(u, 0, -Math.max(1.2, fr * 0.5));
      if (fr >= 3.2 && b - a > 2 && r() < 0.55) yardTree(ctx, r, c[0], c[2], away, Math.min(1.0, 0.6 + fr * 0.08));
      else if (fr >= 1.8 && r() < 0.75) yardPalm(ctx, r, c[0], c[2]);
    }
    if (fr >= 1.6) {
      const bloom = r() < 0.6;
      const col = r.pick(BLOOM);
      for (const [a, b] of runs(ua + 0.5, ub - 0.5, cuts.map(([p, q]) => [p - 0.4, q + 0.4]), 1.0)) {
        for (let u = a + 0.5; u < b - 0.3; u += r.range(1.4, 2.4)) {
          const c = f.p(u, 0, -fr + 0.65);
          if (r() < 0.7) bush(ctx, r, c[0], c[2], r.range(0.6, 0.9), bloom && r() < 0.6 ? col : null);
        }
      }
    }
  } else {
    // a forecourt: the pavers, a lawn either side of the way in with a palm in it, a low hedge
    // round the lawns
    const wIn = -fr + 0.5;
    const wOut = -0.5;
    if (fr >= 2.2) {
      const lawn = r.pick(GRASS);
      for (const [a, b] of runs(ua + 0.4, ub - 0.4, doors.map((u) => [u - 2.0, u + 2.0]), 1.4)) {
        ground(ctx, M.grass, f, a, wIn, b, wOut, CURB + 0.03, lawn);
        fbox(ctx, f, M.prop, a - 0.08, CURB, wIn - 0.08, b + 0.08, CURB + 0.12, wIn, WHITE);
        fbox(ctx, f, M.prop, a - 0.08, CURB, wOut, b + 0.08, CURB + 0.12, wOut + 0.08, WHITE);
        const c = f.p((a + b) / 2, 0, (wIn + wOut) / 2);
        if (b - a >= 2.2) yardPalm(ctx, r, c[0], c[2], { royal: o.street === 'collins' && r() < 0.6, h: r.range(8, 12) });
        else bush(ctx, r, c[0], c[2], 0.8);
      }
    }
  }
}

// ------------------------------------------------------------------ either side of a tower
function sideYards(ctx, lot) {
  const r = lot.r;
  const M = ctx.M;
  const f = lot.f;
  const L = lot.L;
  const lawn = r.pick(GRASS);
  for (const [a, b] of [[0.15, lot.gapA], [L - lot.gapB, L - 0.15]]) {
    if (b - a < 0.5) continue;
    ground(ctx, M.grass, f, a, -lot.back, b, -lot.front, CURB + 0.02, lawn);
    // a palm or two, bushes along it
    for (let w = -lot.front - r.range(1.5, 3); w > -lot.back + 1.2; w -= r.range(5, 8)) {
      const c = f.p((a + b) / 2, 0, w);
      if (r() < 0.55) yardPalm(ctx, r, c[0], c[2], { h: r.range(7, 11) });
      else bush(ctx, r, c[0], c[2], r.range(0.7, 1.0));
    }
  }
}

// ------------------------------------------------------------------ an empty lot, grown over
function overgrown(ctx, lot, o) {
  const r = lot.r;
  const f = lot.f;
  const L = lot.L;
  const D = o.D;
  // (the sea grapes and the young trees that take an empty lot in a year or two; bushes along the
  // fence and against the neighbours' walls)
  const n = L > 10 ? r.int(1, 2) : r.int(0, 1);
  for (let k = 0; k < n; k++) {
    const u = r.range(2, L - 2);
    const c = f.p(u, 0, -r.range(D * 0.45, D - 2.5));
    yardTree(ctx, r, c[0], c[2], [-f.nx, -f.nz], r.range(0.6, 0.9));
  }
  for (let k = r.int(3, 6); k > 0; k--) {
    const u = r() < 0.5 ? r.range(0.8, 1.6) : r.range(L - 1.6, L - 0.8);
    const c = f.p(u, 0, -r.range(2.5, D - 1.2));
    bush(ctx, r, c[0], c[2], r.range(0.7, 1.3), r() < 0.15 ? BLOOM[0] : srgb(0.36, 0.5, 0.26));
  }
}

// ------------------------------------------------------------------ the bay's edge
/**
 * (v5, ROADMAP 11.2ג) Behind the houses of the western row, down to the bay: a strip of lawn and
 * sea grapes, the sea wall's cap, a dock now and then with a boat tied to it. Only to be seen:
 * the city's edge is short of it.
 */
export function bayEdge(ctx, x0, x1, z0, z1) {
  const M = ctx.M;
  const r = diceAt(x0, z0, 5);
  // the lawn over the pavers (a patch of it greener here and there), the sea wall's cap at the water
  const g = new THREE.PlaneGeometry(x1 - x0 - 0.6, z1 - z0).rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2 + 0.3, CURB + 0.02, (z0 + z1) / 2);
  ctx.B.add(M.grass, g, null, nextId(), { color: srgb(0.45, 0.64, 0.37) });
  for (let k = Math.round((z1 - z0) / 18); k > 0; k--) {
    const cx = r.range(x0 + 6, x1 - 3);
    const cz = r.range(z0 + 3, z1 - 3);
    const sx = r.range(2, 5);
    const sz = r.range(3, 8);
    const pg = new THREE.PlaneGeometry(sx, sz).rotateX(-Math.PI / 2);
    pg.translate(cx, CURB + 0.025, cz);
    ctx.B.add(M.grass, pg, null, nextId(), { color: r.pick([srgb(0.4, 0.6, 0.33), srgb(0.52, 0.66, 0.38)]) });
  }
  ctx.B.box(M.wallSolid, x0 - 0.1, -0.9, z0, x0 + 0.5, CURB + 0.25, z1, nextId(), { color: srgb(0.86, 0.84, 0.8) });
  // the walk along the water: pavers, a bench now and then looking out over the bay, a lamp
  const wx0 = x0 + 1.4;
  const wx1 = x0 + 4.0;
  {
    const wg = new THREE.PlaneGeometry(wx1 - wx0, z1 - z0).rotateX(-Math.PI / 2);
    wg.translate((wx0 + wx1) / 2, CURB + 0.03, (z0 + z1) / 2);
    ctx.B.add(M.court, wg, null, nextId(), { color: srgb(0.88, 0.82, 0.74) });
  }
  for (let z = z0 + r.range(6, 14); z < z1 - 4; z += r.range(20, 30)) {
    const x = wx0 - 0.5;
    const wood = srgb(0.6, 0.46, 0.34);
    const iron = srgb(0.16, 0.16, 0.2);
    ctx.B.box(M.prop, x - 0.25, CURB + 0.42, z - 0.9, x + 0.25, CURB + 0.48, z + 0.9, nextId(), { color: wood });
    ctx.B.box(M.prop, x + 0.2, CURB + 0.48, z - 0.9, x + 0.26, CURB + 0.9, z + 0.9, nextId(), { color: wood });
    for (const dz of [-0.75, 0.75]) ctx.B.box(M.prop, x - 0.22, CURB, z + dz - 0.04, x + 0.24, CURB + 0.42, z + dz + 0.04, nextId(), { color: iron });
  }
  for (let z = z0 + r.range(4, 10); z < z1 - 2; z += r.range(22, 28)) {
    const x = wx1 + 0.4;
    post(ctx, M.pole, x, CURB, z, 0.07, 3.8, srgb(0.16, 0.16, 0.2), nextId(), 8);
    const lamp = new THREE.SphereGeometry(0.24, 10, 8);
    lamp.translate(x, CURB + 3.95, z);
    ctx.B.add(M.lampGlass, lamp, null, nextId());
    addLight(x, CURB + 3.8, z, 9, srgb(1, 0.85, 0.6), 0.6);
  }
  // trees along it, in clumps of two or three (oaks, poincianas, sea grapes, a leaning coconut palm)
  for (let z = z0 + r.range(3, 8); z < z1 - 3; z += r.range(8, 16)) {
    const n = r() < 0.4 ? 1 : r.int(2, 3);
    for (let k = 0; k < n; k++) {
      const x = r.range(wx1 + 2.5, x1 - 3.5);
      const zz = z + r.range(-3, 3);
      if (r() < 0.62) shadeTree(ctx, r, x, zz, { lite: true, kind: r.pick(['oak', 'oak', 'poinciana', 'grape', 'mahogany']), size: r.range(0.9, 1.25) });
      else palm(ctx, r, x, zz, r.range(8, 12), { y0: CURB, lean: 1.4 });
    }
  }
  for (let z = z0 + 2; z < z1 - 2; z += r.range(3, 7)) {
    if (r() < 0.45) continue;
    const x = x0 + r.range(0.7, 1.1);
    clump(ctx, r, x, CURB + 0.6, z, r.range(0.7, 1.0), 0.75, srgb(0.42, 0.62, 0.32).multiplyScalar(r.range(0.9, 1.1)), M.leaf);
  }
  // a dock or two out over the water, a boat at one
  for (let z = z0 + r.range(12, 30); z < z1 - 10; z += r.range(40, 70)) {
    const len = r.range(6, 10);
    const wood = srgb(0.62, 0.5, 0.38);
    ctx.B.box(M.prop, x0 - len, CURB - 0.1, z - 1.0, x0 - 0.1, CURB + 0.05, z + 1.0, nextId(), { color: wood });
    for (let x = x0 - len + 0.3; x < x0; x += 2.2) {
      for (const dz of [-0.9, 0.9]) post(ctx, M.pole, x, -1.2, z + dz, 0.1, 1.5, wood.clone().multiplyScalar(0.8), nextId(), 6);
    }
    if (r() < 0.7) {
      // a little motorboat tied along it: a white hull, a blue stripe, a windshield
      const bz = z + 2.6;
      const bx = x0 - len * 0.55;
      const hull = new THREE.BoxGeometry(6.2, 0.9, 2.2);
      hull.translate(bx, -0.55, bz);
      ctx.B.add(M.prop, hull, null, nextId(), { color: WHITE });
      const bow = new THREE.ConeGeometry(1.1, 1.6, 4, 1).rotateZ(-Math.PI / 2).rotateX(Math.PI / 4);
      bow.scale(1, 0.58, 1.0);
      bow.translate(bx - 3.9, -0.55, bz);
      ctx.B.add(M.prop, bow, null, nextId(), { color: WHITE });
      ctx.B.box(M.prop, bx - 3.0, -0.25, bz - 1.11, bx + 3.1, -0.12, bz + 1.11, nextId(), { color: srgb(0.18, 0.36, 0.7) });
      ctx.B.box(M.frame, bx - 0.6, -0.1, bz - 0.9, bx - 0.5, 0.45, bz + 0.9, nextId(), { color: srgb(0.3, 0.35, 0.5) });
    }
  }
}
