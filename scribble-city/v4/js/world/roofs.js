import * as THREE from 'three';
import { srgb } from '../render/materials.js';
import { nextId, quadGeo } from './kit.js';
import { Collision } from './collision.js';
import { CURB, groundHeight } from './layout.js';
import { FH, GROUND } from './deco.js';
import { BLUEPRINT_MORE } from '../game/blueprints.js';

// (ROADMAP 5.1; never with ?classic) Up on the roofs.
//
// The fire escapes on the side streets become ones you climb: a ladder hangs from the first
// landing over the sidewalk, the stairs go up from landing to landing (through a hatch in the one
// above, world/deco.js), and at the top a ladder bends over the edge onto the roof. Some buildings
// have a ladder up the back wall, in the alley. Up there what stands on the roof is solid: the
// parapet over the street, the fin, the stairs' little house, the air conditioners, the water tank
// on its legs (you can stand under it). On some roofs people have made themselves a place: a deck,
// deck chairs, a sunshade, plants in pots, a string of bulbs, the washing on a line. The album's
// new pages (ROADMAP 4.8) are up there too, on boards you photograph from the roofs.
//
// A way up (a route) is a line of points where the feet go: on a ladder you climb it, facing the
// wall; elsewhere you walk (along a landing, up the stairs, over the edge). game/climb.js moves you
// along it.

const IRON = srgb(0.16, 0.14, 0.2);
const RUNG = 0.32;
// along a landing, beside the hatch; the stairs' line, by the wall (world/deco.js fireEscape)
const WALK = 0.88;
const STAIR = 0.37;

// a number 0..1 for a place (the city's own dice are not touched: the city stays as it was)
function hash(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function fb(ctx, f, mat, u0, v0, w0, u1, v1, w1, color, id) {
  const [mn, mx] = f.box(u0, v0, w0, u1, v1, w1);
  ctx.B.box(mat, mn[0], mn[1], mn[2], mx[0], mx[1], mx[2], id, { color });
}

// many boxes as one shape (a ladder's rails and rungs: one part for the batch, not fifty; each
// face's corners shared, as a box of its own would have them)
class Boxes {
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

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setIndex(this.idx);
    return g;
  }
}

// ------------------------------------------------------------------ the ways up
export class Route {
  constructor(kind) {
    this.kind = kind;
    this.pts = [];
    this.segs = [];
    this.len = 0;
    // where a landing is on the way (a fall onto one catches you there)
    this.stops = [];
    this.bottom = true;
  }

  start(p) {
    this.pts.push(p);
  }

  seg(p, kind, o = null) {
    const a = this.pts[this.pts.length - 1];
    const len = Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z);
    this.segs.push({ a, b: p, kind, len, s0: this.len, ...o });
    this.len += len;
    this.pts.push(p);
  }

  // up a ladder: the climber faces the wall (face), its rails' middle at (lx, lz)
  ladder(p, face, f, u, w) {
    const c = f.p(u, 0, w);
    this.seg(p, 'ladder', { face, lx: c[0], lz: c[2] });
  }

  walk(p) {
    this.seg(p, 'walk');
  }

  stop() {
    this.stops.push(this.len);
  }

  get first() {
    return this.pts[0];
  }

  get last() {
    return this.pts[this.pts.length - 1];
  }

  // the point s metres along it (out: { x, y, z, seg })
  at(s, out) {
    s = Math.max(0, Math.min(this.len, s));
    let g = this.segs[this.segs.length - 1];
    for (const sg of this.segs) {
      if (s <= sg.s0 + sg.len) {
        g = sg;
        break;
      }
    }
    const k = g.len > 1e-6 ? (s - g.s0) / g.len : 1;
    out.x = g.a.x + (g.b.x - g.a.x) * k;
    out.y = g.a.y + (g.b.y - g.a.y) * k;
    out.z = g.a.z + (g.b.z - g.a.z) * k;
    out.seg = g;
    return out;
  }
}

// a ladder up a wall: two rails and the rungs, w out of the wall, stand-offs back to it; over: its
// rails bend over the edge of the roof (at w = 0) and come down onto it there (a gooseneck)
function ladder(ctx, f, u, w, y0, y1, o = {}) {
  const X = new Boxes();
  const half = 0.25;
  for (const s of [-half, half]) X.fb(f, u + s - 0.03, y0, w - 0.03, u + s + 0.03, y1, w + 0.03);
  for (let y = y0 + 0.25; y < y1 - 0.08; y += RUNG) X.fb(f, u - half, y - 0.018, w - 0.018, u + half, y + 0.018, w + 0.018);
  if (o.standoff !== false) {
    for (let y = y0 + 0.8; y < y1 - 0.4; y += 2.6) for (const s of [-half, half]) X.fb(f, u + s - 0.02, y - 0.02, 0, u + s + 0.02, y + 0.02, w);
  }
  if (o.over !== undefined) {
    for (const s of [-half, half]) {
      X.fb(f, u + s - 0.03, y1 - 0.03, -0.58, u + s + 0.03, y1 + 0.03, w + 0.03);
      X.fb(f, u + s - 0.03, o.over, -0.58, u + s + 0.03, y1, -0.52);
    }
  }
  ctx.B.add(ctx.M.pole, X.geometry(), null, nextId(), { color: IRON });
}

// the fire escape up a side wall, from the sidewalk to the roof
function escapeRoute(ctx, RC, e) {
  const { sf, u0, w, floors, info } = e;
  if (!info) return null;
  const top = info.top;
  const yl = (fl) => CURB + GROUND + (fl - 1) * FH + 0.55;
  const P = (u, y, d) => {
    const p = sf.p(u, 0, d);
    return { x: p[0], y, z: p[2] };
  };
  const face = Math.atan2(-sf.nx, -sf.nz);
  const ua = u0 + 0.45;
  const ub = u0 + w - 0.45;
  const base = P(ua, 0, 1.6);
  const gy = groundHeight(base.x, base.z);
  // (the ladder down to the sidewalk, if nothing stands under it)
  const clear = gy > -0.3 && !ctx.col.pointInside(base.x, gy + 1.0, base.z, 0.35);
  const y1 = yl(1);
  if (clear) {
    ladder(ctx, sf, ua, 1.32, gy + 0.32, y1 + 1.05, { standoff: false });
    // its hooks over the landing's rail
    const id = nextId();
    for (const s of [-0.25, 0.25]) fb(ctx, sf, ctx.M.pole, ua + s - 0.025, y1 + 1.0, 1.1, ua + s + 0.025, y1 + 1.05, 1.32, IRON, id);
  }
  const yt = yl(floors - 1);
  ladder(ctx, sf, ub, 0.12, yt, top + 1.0, { over: top });
  const r = new Route('escape');
  r.bottom = clear;
  r.start(P(ua, gy, 1.6));
  r.ladder(P(ua, y1 + 1.05, 1.6), face, sf, ua, 1.32);
  r.walk(P(ua, y1 + 1.12, 1.22));
  r.walk(P(ua, y1, WALK));
  r.stop();
  for (let fl = 1; fl < floors - 1; fl++) {
    const y = yl(fl);
    r.walk(P(u0 + w - 0.45, y, WALK));
    r.walk(P(u0 + w - 0.4, y + 0.12, STAIR));
    r.walk(P(u0 + 0.6, yl(fl + 1) + 0.02, STAIR));
    r.walk(P(u0 + 0.75, yl(fl + 1), WALK));
    r.stop();
  }
  r.walk(P(ub, yt, WALK));
  r.walk(P(ub, yt, 0.4));
  r.ladder(P(ub, top + 0.15, 0.4), face, sf, ub, 0.12);
  r.walk(P(ub, top + 0.3, -0.15));
  r.walk(P(ub, top, -0.9));
  // the landings: you land on one, and you are on the way down (or up)
  for (let fl = 1; fl < floors; fl++) {
    const [mn, mx] = sf.box(u0, yl(fl) - 0.3, 0, u0 + w, yl(fl), 1.15);
    RC.addBox(mn[0], mn[2], mx[0], mx[2], mn[1], mx[1], 'escape', { route: r, s: r.stops[fl - 1] });
  }
  r.info = info;
  r.f = sf;
  return r;
}

// a ladder up the back wall, from the alley to the roof
function backRoute(ctx, b) {
  const { bf, L, info } = b;
  if (!info || info.floors > 5) return null;
  const top = info.top;
  const ul = L - 0.65;
  const P = (u, y, d) => {
    const p = bf.p(u, 0, d);
    return { x: p[0], y, z: p[2] };
  };
  const base = P(ul, 0, 0.43);
  const gy = groundHeight(base.x, base.z);
  if (gy < -0.3 || gy > 0.5) return null;
  // (room for it in the alley: nothing in the way at its foot, nor a step behind it)
  const out = P(ul, 0, 1.4);
  if (ctx.col.pointInside(base.x, gy + 1.0, base.z, 0.4) || ctx.col.pointInside(out.x, gy + 1.0, out.z, 0.4)) return null;
  ladder(ctx, bf, ul, 0.15, gy + 0.15, top + 1.0, { over: top });
  const face = Math.atan2(-bf.nx, -bf.nz);
  const r = new Route('ladder');
  r.start(P(ul, gy, 0.43));
  r.ladder(P(ul, top + 0.15, 0.43), face, bf, ul, 0.15);
  r.walk(P(ul, top + 0.3, -0.15));
  r.walk(P(ul, top, -0.9));
  r.info = info;
  r.f = bf;
  return r;
}

// what stands on a roof is solid
function roofSolids(RC, info) {
  const { f, L, h, top } = info;
  const add = (mn, mx, tag = 'prop') => RC.addBox(mn[0], mn[2], mx[0], mx[2], mn[1], mx[1], tag);
  // the parapet over the street and its cornice, the pilasters at the corners, the fin
  add(...f.box(0.7, top - 0.5, -0.3, L - 0.7, h + 1.32, 0.5), 'wall');
  add(...f.box(0, top - 0.5, -0.2, 0.7, top + 0.6, 0.28), 'wall');
  add(...f.box(L - 0.7, top - 0.5, -0.2, L, top + 0.6, 0.28), 'wall');
  if (info.fin) add(...f.box(L / 2 - 0.9, top - 0.5, -1.2, L / 2 + 0.9, h + 3.2, 0.35), 'wall');
  for (const [mn, mx] of info.props) add(mn, mx);
}

// a free place on a roof for something sw x sd (in the roof's own frame), near the top of a way
// up but not in front of it; null if there is none
function roofSpot(RC, info, ex, ez, sw, sd, minD = 2.6, ok = null) {
  const { f, L, D, top } = info;
  let best = null;
  let bd = Infinity;
  const tops = info.tops || [];
  // (what stands on this roof, gathered once - and again when something more is put on it)
  if (!info.solid) {
    const [a, b] = f.box(0, top, -D, L, top + 2, 0);
    const list = (info.solid = []);
    RC.forEachIn(a[0] - 1, a[2] - 1, b[0] + 1, b[2] + 1, (q) => {
      if (q.y1 > top + 0.05 && q.y0 < top + 2) list.push(q);
      return false;
    });
  }
  for (let u = 1.2 + sw / 2; u <= L - 1.2 - sw / 2; u += 0.8) {
    for (let w = -1.6 - sd / 2; w >= -D + 1.2 + sd / 2; w -= 0.8) {
      const c = f.p(u, 0, w);
      const d = Math.hypot(c[0] - ex, c[2] - ez);
      if (d < minD + Math.max(sw, sd) / 2 || d > bd) continue;
      // (nor in front of the top of another way up onto this roof)
      if (tops.some((t) => Math.hypot(c[0] - t.x, c[2] - t.z) < 1.6 + Math.max(sw, sd) / 2)) continue;
      if (ok && !ok(c[0], c[2])) continue;
      const [mn, mx] = f.box(u - sw / 2 - 0.4, top, w - sd / 2 - 0.4, u + sw / 2 + 0.4, top + 2, w + sd / 2 + 0.4);
      if (info.solid.some((b) => b.x1 > mn[0] && b.x0 < mx[0] && b.z1 > mn[2] && b.z0 < mx[2])) continue;
      bd = d;
      best = { u, w, x: c[0], z: c[2] };
    }
  }
  return best;
}

// ------------------------------------------------------------------ the album's boards up there
function roofBoardOf(ctx, RC, r, id) {
  const info = r.info;
  const e = r.last;
  // (facing west, the way the city's boards do: the sun is over the bay all day, and a page turned
  // to it is too bright to read; best east of the top of the way up, so you see it as you come)
  // (it is long north to south: in the roof's own frame that is along its front or across it)
  const [sw, sd] = Math.abs(info.f.ux) > 0.5 ? [1.2, 4.6] : [4.6, 1.2];
  const s = roofSpot(RC, info, e.x, e.z, sw, sd, 3.0, (x) => x > e.x + 1.5) || roofSpot(RC, info, e.x, e.z, sw, sd, 3.0);
  if (!s) return false;
  const M = ctx.M;
  const top = info.top;
  const nx = -1;
  const nz = 0;
  const rx = nz;
  const rz = -nx;
  const w = 4.2;
  const h = 2.1;
  const legH = 0.9;
  const cy = top + legH + h / 2;
  const id0 = nextId();
  const steel = srgb(0.42, 0.4, 0.48);
  for (const k of [-0.36, 0.36]) {
    const lx = s.x + rx * w * k - nx * 0.12;
    const lz = s.z + rz * w * k - nz * 0.12;
    ctx.B.box(M.steel, lx - 0.07, top, lz - 0.07, lx + 0.07, top + legH + h, lz + 0.07, id0, { color: steel });
    RC.addBox(lx - 0.12, lz - 0.12, lx + 0.12, lz + 0.12, top, top + legH + h, 'prop');
  }
  // the frame behind the page, the page, a lamp over it
  const yaw = Math.atan2(nx, nz);
  const fr = new THREE.BoxGeometry(w + 0.25, h + 0.25, 0.12);
  fr.rotateY(yaw);
  fr.translate(s.x - nx * 0.08, cy, s.z - nz * 0.08);
  ctx.B.add(M.steel, fr, null, id0, { color: srgb(0.95, 0.94, 0.92) });
  const lamp = new THREE.BoxGeometry(1.2, 0.1, 0.2);
  lamp.rotateY(yaw);
  lamp.translate(s.x + nx * 0.25, cy + h / 2 + 0.25, s.z + nz * 0.25);
  ctx.B.add(M.lampGlass, lamp, null, id0);
  const uv = ctx.atlas.rects[`bb_${id}`];
  const mat = M.board;
  const x = s.x + nx * 0.0;
  const z = s.z + nz * 0.0;
  const a = [x - rx * w / 2, cy - h / 2, z - rz * w / 2];
  const b = [x + rx * w / 2, cy - h / 2, z + rz * w / 2];
  const c = [x + rx * w / 2, cy + h / 2, z + rz * w / 2];
  const d = [x - rx * w / 2, cy + h / 2, z - rz * w / 2];
  ctx.B.add(mat, quadGeo(a, b, c, d, [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]]), null, id0);
  // (the page and its frame behind it stop you, and bullets)
  const xs = [a[0], b[0], a[0] - nx * 0.2, b[0] - nx * 0.2];
  const zs = [a[2], b[2], a[2] - nz * 0.2, b[2] - nz * 0.2];
  RC.addBox(Math.min(...xs) - 0.05, Math.min(...zs) - 0.05, Math.max(...xs) + 0.05, Math.max(...zs) + 0.05, cy - h / 2 - 0.15, cy + h / 2 + 0.15, 'board');
  ctx.billboards.push({ id, x: x + nx * 0.03, y: cy, z: z + nz * 0.03, nx, nz, w, h, rx, rz, roof: true, top });
  info.board = id;
  info.solid = null;
  return true;
}

// ------------------------------------------------------------------ a place of their own
// the parts of one thing, a few shapes for the batch instead of fifty: what has the same pen and
// the same colour is one shape
class Parts {
  constructor() {
    this.groups = new Map();
  }

  put(mat, geo, color) {
    const k = `${mat.uuid}|${color ? (color.isColor ? `${color.r},${color.g},${color.b}` : color.join(',')) : ''}`;
    if (!this.groups.has(k)) this.groups.set(k, { mat, color, geos: [] });
    this.groups.get(k).geos.push(geo);
  }

  // a box from (x0, y0, z0) to (x1, y1, z1) in the world
  box(mat, mn, mx, color) {
    const g = new THREE.BoxGeometry(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
    g.translate((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2);
    this.put(mat, g, color);
  }

  flush(ctx, id) {
    for (const { mat, color, geos } of this.groups.values()) {
      let n = 0;
      let ni = 0;
      for (const q of geos) {
        if (!q.attributes.normal) q.computeVertexNormals();
        n += q.attributes.position.count;
        ni += q.index ? q.index.count : q.attributes.position.count;
      }
      const pos = new Float32Array(n * 3);
      const nor = new Float32Array(n * 3);
      const idx = new Uint32Array(ni);
      let o = 0;
      let oi = 0;
      for (const q of geos) {
        const c = q.attributes.position.count;
        pos.set(q.attributes.position.array, o * 3);
        nor.set(q.attributes.normal.array, o * 3);
        if (q.index) for (let i = 0; i < q.index.count; i++) idx[oi++] = q.index.array[i] + o;
        else for (let i = 0; i < c; i++) idx[oi++] = o + i;
        o += c;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      ctx.B.add(mat, g, null, id, color ? { color } : {});
    }
  }
}

const CANVAS = [srgb(0.95, 0.35, 0.4), srgb(0.25, 0.65, 0.84), srgb(1.0, 0.8, 0.25), srgb(0.55, 0.85, 0.5)];
const CLOTHES = [srgb(0.95, 0.95, 0.92), srgb(0.3, 0.5, 0.85), srgb(0.95, 0.55, 0.6), srgb(1.0, 0.85, 0.3), srgb(0.5, 0.75, 0.55), srgb(0.6, 0.45, 0.75)];
function terrace(ctx, RC, r, k) {
  const info = r.info;
  const e = r.last;
  const s = roofSpot(RC, info, e.x, e.z, 4.4, 3.4, 2.4);
  if (!s) return false;
  const M = ctx.M;
  const f = info.f;
  const top = info.top;
  const id = nextId();
  const X = new Parts();
  const add = (mn, mx) => {
    RC.addBox(mn[0], mn[2], mx[0], mx[2], mn[1], mx[1], 'prop');
    info.solid = null;
  };
  // (a box in the roof's frame, about the spot)
  const B = (mat, u0, v0, w0, u1, v1, w1, color) => X.box(mat, ...f.box(s.u + u0, top + v0, s.w + w0, s.u + u1, top + v1, s.w + w1), color);
  const col = CANVAS[Math.floor(k * 7) % CANVAS.length];
  // the deck, its planks drawn on it (a plain pen: no picture of its own, so no draw of its own)
  B(M.frame, -2.2, 0, -1.7, 2.2, 0.08, 1.7, srgb(0.72, 0.5, 0.32));
  for (let w = -1.7 + 0.42; w < 1.7; w += 0.42) B(M.frame, -2.2, 0.08, w - 0.012, 2.2, 0.085, w + 0.012, srgb(0.45, 0.3, 0.2));
  // two deck chairs, side by side
  for (const du of [-1.4, -0.5]) {
    B(M.frame, du - 0.3, 0.08, -0.9, du - 0.26, 0.45, 0.5, srgb(0.85, 0.82, 0.78));
    B(M.frame, du + 0.26, 0.08, -0.9, du + 0.3, 0.45, 0.5, srgb(0.85, 0.82, 0.78));
    B(M.awning, du - 0.27, 0.36, -0.75, du + 0.27, 0.42, 0.35, col);
    // the back, leaning
    const [a, b] = f.box(s.u + du - 0.27, top + 0.4, s.w + 0.3, s.u + du + 0.27, top + 1.15, s.w + 0.36);
    const g = new THREE.BoxGeometry(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const c = f.p(s.u + du, top + 0.75, s.w + 0.48);
    const tilt = 0.45;
    // (leaning away from the seat: about the frame's u axis)
    g.applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(f.ux, 0, f.uz), f.ux * f.nz - f.uz * f.nx > 0 ? tilt : -tilt));
    g.translate(c[0], c[1], c[2]);
    X.put(M.awning, g, col);
    add(...f.box(s.u + du - 0.32, top, s.w - 0.9, s.u + du + 0.32, top + 0.6, s.w + 0.6));
  }
  // a little table and a sunshade over it
  const tc = f.p(s.u + 1.0, 0, s.w - 0.2);
  const tbl = new THREE.CylinderGeometry(0.42, 0.42, 0.05, 14);
  tbl.translate(tc[0], top + 0.72, tc[2]);
  X.put(M.propCyl, tbl, srgb(0.96, 0.96, 0.94));
  X.box(M.pole, [tc[0] - 0.03, top + 0.08, tc[2] - 0.03], [tc[0] + 0.03, top + 2.3, tc[2] + 0.03], srgb(0.9, 0.9, 0.9));
  const shade = new THREE.ConeGeometry(1.25, 0.45, 12, 1, true);
  shade.translate(tc[0], top + 2.25, tc[2]);
  X.put(M.awning, shade, col);
  add([tc[0] - 0.45, top, tc[2] - 0.45], [tc[0] + 0.45, top + 0.75, tc[2] + 0.45]);
  // plants in pots along the back of the deck
  for (const du of [-1.9, 0.4, 1.9]) {
    const pc = f.p(s.u + du, 0, s.w + 1.45);
    const pot = new THREE.CylinderGeometry(0.24, 0.18, 0.42, 10);
    pot.translate(pc[0], top + 0.29, pc[2]);
    X.put(M.propCyl, pot, srgb(0.78, 0.42, 0.3));
    const leaf = new THREE.SphereGeometry(0.38, 9, 7);
    leaf.scale(1, du === 0.4 ? 1.6 : 1.1, 1);
    leaf.translate(pc[0], top + (du === 0.4 ? 1.0 : 0.78), pc[2]);
    X.put(M.leaf, leaf, srgb(0.35, 0.68, 0.38));
    add([pc[0] - 0.3, top, pc[2] - 0.3], [pc[0] + 0.3, top + 1.2, pc[2] + 0.3]);
  }
  // a string of bulbs from pole to pole over it (lit when the city's lights are)
  const p0 = f.p(s.u - 2.1, 0, s.w - 1.6);
  const p1 = f.p(s.u + 2.1, 0, s.w + 1.6);
  for (const p of [p0, p1]) {
    X.box(M.pole, [p[0] - 0.035, top + 0.08, p[2] - 0.035], [p[0] + 0.035, top + 2.5, p[2] + 0.035], IRON);
    add([p[0] - 0.1, top, p[2] - 0.1], [p[0] + 0.1, top + 2.5, p[2] + 0.1]);
  }
  const n = 10;
  let prev = null;
  const dir = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = p0[0] + (p1[0] - p0[0]) * t;
    const z = p0[2] + (p1[2] - p0[2]) * t;
    const y = top + 2.45 - Math.sin(t * Math.PI) * 0.45;
    if (prev) {
      const len = Math.hypot(x - prev[0], y - prev[1], z - prev[2]);
      const g = new THREE.BoxGeometry(0.015, 0.015, len);
      g.lookAt(dir.set(x - prev[0], y - prev[1], z - prev[2]));
      g.translate((x + prev[0]) / 2, (y + prev[1]) / 2, (z + prev[2]) / 2);
      X.put(M.pole, g, IRON);
    }
    if (i > 0 && i < n) {
      const bulb = new THREE.SphereGeometry(0.06, 6, 5);
      bulb.translate(x, y - 0.08, z);
      X.put(M.bulb, bulb, srgb(1, 0.92, 0.7));
    }
    prev = [x, y, z];
  }
  // now and then, the washing on a line across the roof
  if (k > 0.5) {
    const q = roofSpot(RC, info, e.x, e.z, 3.6, 0.6, 2.0);
    if (q) {
      const a = f.p(q.u - 1.8, 0, q.w);
      const b = f.p(q.u + 1.8, 0, q.w);
      for (const p of [a, b]) {
        X.box(M.pole, [p[0] - 0.03, top, p[2] - 0.03], [p[0] + 0.03, top + 1.9, p[2] + 0.03], srgb(0.85, 0.85, 0.88));
        add([p[0] - 0.1, top, p[2] - 0.1], [p[0] + 0.1, top + 1.9, p[2] + 0.1]);
      }
      X.box(M.pole, ...f.box(q.u - 1.8, top + 1.84, q.w - 0.008, q.u + 1.8, top + 1.86, q.w + 0.008), srgb(0.9, 0.9, 0.9));
      // a towel, shirts, a long skirt, a sheet (all on pegs)
      const items = [[-1.4, 0.5, 0.75], [-0.75, 0.48, 0.6], [-0.15, 0.46, 0.62], [0.45, 0.42, 0.95], [1.15, 0.7, 1.05]];
      items.forEach(([du, wd, ht], i) => {
        const c = CLOTHES[(i + Math.floor(k * 13)) % CLOTHES.length];
        X.box(M.awning, ...f.box(q.u + du - wd / 2, top + 1.84 - ht, q.w - 0.015, q.u + du + wd / 2, top + 1.84, q.w + 0.015), c);
      });
      add(...f.box(q.u - 1.8, top + 0.75, q.w - 0.08, q.u + 1.8, top + 1.9, q.w + 0.08));
    }
  }
  X.flush(ctx, id);
  return { x: s.x, z: s.z, top, route: r };
}

// ------------------------------------------------------------------ all of it
export function buildRoofs(ctx) {
  const R = ctx.roofs;
  if (!R) return;
  const t0 = performance.now();
  const RC = new Collision();
  for (const info of R.buildings) roofSolids(RC, info);
  const routes = [];
  for (const e of R.escapes) {
    const r = escapeRoute(ctx, RC, e);
    if (r) routes.push(r);
  }
  // a ladder up the back of some of those that have no fire escape (about a third of them)
  const done = new Set(routes.map((r) => r.info));
  for (const b of R.backs) {
    if (!b.info || done.has(b.info)) continue;
    const c = b.bf.p(b.L * 0.5, 0, 0);
    if (hash(c[0], c[2]) > 0.34) continue;
    const r = backRoute(ctx, b);
    if (r) {
      routes.push(r);
      done.add(b.info);
    }
  }
  for (const r of routes) (r.info.tops || (r.info.tops = [])).push(r.last);
  // the album's new pages: on roofs spread over the city, the first not far from where you start
  const boards = [];
  const more = BLUEPRINT_MORE.slice();
  if (more.length && routes.length && ctx.atlas.rects[`bb_${more[0]}`]) {
    const chosen = [];
    const far = (r) => (chosen.length ? Math.min(...chosen.map((c) => Math.hypot(c.last.x - r.last.x, c.last.z - r.last.z))) : 1e9);
    // (the first: the nearest to the start that is a little way off, up a ladder you can reach)
    const near = routes.filter((r) => r.bottom).sort((a, b) => Math.abs(Math.hypot(a.last.x, a.last.z) - 60) - Math.abs(Math.hypot(b.last.x, b.last.z) - 60));
    for (const id of more) {
      const pool = chosen.length ? routes.filter((r) => r.bottom && !chosen.includes(r)).sort((a, b) => far(b) - far(a)) : near;
      for (const r of pool) {
        if (roofBoardOf(ctx, RC, r, id)) {
          chosen.push(r);
          boards.push({ id, route: r });
          break;
        }
      }
    }
  }
  // a place of their own on about a third of the roofs you can get onto
  const terraces = [];
  for (const r of routes) {
    if (r.info.board || r.info.terrace) continue;
    const k = hash(r.last.x * 1.7, r.last.z * 0.9);
    if (k > 0.34) continue;
    const t = terrace(ctx, RC, r, k / 0.34);
    if (t) {
      terraces.push(t);
      r.info.terrace = t;
    }
  }
  ctx.roofWorld = { col: RC, routes, boards, terraces, ms: performance.now() - t0 };
}
