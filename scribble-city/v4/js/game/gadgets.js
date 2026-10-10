import * as THREE from 'three';
import { damp } from '../core/util.js';
import { groundHeight } from '../world/layout.js';
import { Route } from '../world/roofs.js';
import { Kit, itemMats, linC } from './items.js';
import { RAMPS, rampAt } from './vehicles.js';

// (ROADMAP 9.2, not with ?classic) Drawings that solve problems.
//   - a ladder: drawn facing a building's wall, it stands against it up to the roof (over the
//     parapet, if there is one); E at its foot climbs it, like the ladders of the fire escapes.
//   - a ramp: on the road in front of you, its low end toward you: drive up it and fly.
//   - a bridge: from the edge you stand at straight across the gap to the other side at about
//     your height - roof to roof over an alley or a street, the sea wall to the pier; over the
//     bay with nothing across, a jetty out over the water.
//   - an umbrella: in your hand when it rains (out under the sky the rain runs the ink of a
//     drawing in the air - under the umbrella it does not), and open over your head in a fall: you
//     come down slowly (not as slowly as with a parachute).
//   - a key that fits every lock: a parked car opens with no alarm and nobody thinks twice; a shop
//     shut for the night rolls its shutter up for it - and the till inside is there for the taking
//     (a crime: the alarm may go off, and anyone who sees calls the police).
// What is put up stays where it was put, three of each at most (a fourth takes the place of the
// oldest), and in the save.

export const PLACED = new Set(['ladder', 'ramp', 'bridge']);
const MAX_EACH = 3;
const RUNG = 0.32;
// how fast a drawn umbrella lets you come down (m/s; a fall hurts from 17)
const SINK = { perfect: 3.6, good: 4.4, wonky: 5.8, fail: 8.5 };
// how many locks a drawn key opens before it bends in one
const KEY_USES = { perfect: 99, good: 8, wonky: 3, fail: 1 };
// the rain on a drawing made in the air out under the sky: points off it (at full rain)
const SMUDGE = 14;
// what a shut shop's till holds at night
const TILL = [40, 160];

const WHY = {
  wall: 'סולם מציירים מול קיר של בניין (קרוב אליו)',
  low: 'הקיר הזה נמוך: קופצים עליו (רווח)',
  high: 'גבוה מדי לסולם מצויר',
  top: 'למעלה, בקצה הגג, עומד משהו גבוה מדי: נסו קיר אחר',
  way: 'משהו בולט מהקיר בדרך למעלה: נסו קצת הצידה',
  foot: 'אין מקום לרגלי הסולם כאן',
  roof: 'אין על הגג הזה איפה לרדת מהסולם',
  near: 'כבר יש כאן סולם',
  ramp: 'רמפה מציירים על הכביש, מול שטח ישר ופנוי (בלי מכוניות)',
  edge: 'גשר מציירים בקצה: של גג, של הטיילת או של המזח',
  far: 'אין צד שני קרוב מספיק (עד 28 מטר), בגובה שלכם',
  short: 'הצד השני קרוב מאוד: אפשר פשוט לקפוץ',
  noroofs: 'אין כאן לאן לטפס',
};

const _d = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// a number 0..1 for a seed
function hash(n) {
  const s = Math.sin(n * 12.9898 + 4.1414) * 43758.5453;
  return s - Math.floor(s);
}

// a box turned about its own x axis (a plank up a slope): its middle, its size, the turn
function tbox(K, mat, cx, cy, cz, sx, sy, sz, rx, color, ry = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  g.translate(cx, cy, cz);
  return K.add(mat, g, color);
}

// ------------------------------------------------------------------ the things, as things
const WOOD = linC(0.66, 0.46, 0.27);
const WOOD_LIGHT = linC(0.8, 0.62, 0.4);
const WOOD_DARK = linC(0.42, 0.28, 0.16);
const RAMP_WOOD = linC(0.8, 0.64, 0.42);
const RAMP_STRIPE = linC(0.98, 0.8, 0.12);
const RAMP_LEG = linC(0.24, 0.24, 0.27);
const BRASS = linC(0.86, 0.66, 0.24);
const CANOPY = [0.2, 0.28, 0.62];
const FIG_CANOPY = [0.24, 0.3, 0.66];

// the ladder, in its own frame: x along the wall, y up from its foot, z out of the wall (s: the spot)
function ladderModel(K, M, s, grade) {
  const W = s.W;
  const yt = s.over - s.y;
  const y1 = yt + 1.0;
  const half = 0.25;
  const bend = grade === 'fail' ? 0.06 : grade === 'wonky' ? 0.03 : 0;
  for (const u of [-half, half]) {
    K.box(M.matte, u - 0.035, 0, W - 0.035, u + 0.035, y1, W + 0.035, WOOD);
    // (over the edge and down onto the roof: the ends that hold it)
    K.box(M.matte, u - 0.035, y1 - 0.035, -0.58, u + 0.035, y1 + 0.035, W + 0.035, WOOD);
    K.box(M.matte, u - 0.035, s.top - s.y, -0.6, u + 0.035, y1, -0.53, WOOD);
  }
  let i = 0;
  for (let y = 0.25; y < y1 - 0.08; y += RUNG) {
    // (a ladder drawn crooked has crooked rungs)
    const dy = bend ? (hash(i * 3.1) - 0.5) * bend * 2 : 0;
    tbox(K, M.matte, 0, y + dy, W, half * 2, 0.04, 0.04, 0, WOOD_LIGHT, bend ? (hash(i * 7.7) - 0.5) * bend * 3 : 0);
    i++;
  }
}

// the ramp, in its own frame: from its low end at the origin up along z
function rampModel(K, M, s) {
  const slope = Math.atan2(s.h, s.len);
  const plank = Math.hypot(s.h, s.len);
  tbox(K, M.matte, 0, s.h / 2 + 0.06, s.len / 2, s.w, 0.12, plank, -slope, RAMP_WOOD);
  for (const u of [0.3, 0.62, 0.9]) tbox(K, M.matte, 0, s.h * u + 0.13, s.len * u, s.w * 0.96, 0.02, 0.22, -slope, RAMP_STRIPE);
  for (const x of [-1, 1]) {
    K.box(M.matte, x * (s.w / 2 - 0.2) - 0.08, 0, s.len - 0.28, x * (s.w / 2 - 0.2) + 0.08, s.h, s.len - 0.12, RAMP_LEG);
    K.box(M.matte, x * (s.w / 2 - 0.2) - 0.06, 0, s.len * 0.5 - 0.06, x * (s.w / 2 - 0.2) + 0.06, s.h * 0.5, s.len * 0.5 + 0.06, RAMP_LEG);
  }
}

// the bridge, in its own frame: from its near end at the origin along z, its deck at y (the far
// end dy higher); planks across, a rail either side
function bridgeModel(K, M, s, grade) {
  const L = s.sB - s.sA;
  const dy = s.yE - s.yA;
  const slope = Math.atan2(dy, L);
  const y = (t) => (dy * t) / L;
  const jit = grade === 'fail' ? 0.05 : grade === 'wonky' ? 0.025 : 0;
  let i = 0;
  for (let t = 0.02; t < L - 0.1; t += 0.33) {
    i++;
    // (a bridge drawn badly has a plank missing here and there)
    if (grade === 'fail' && i % 6 === 3 && t > 1 && t < L - 1) continue;
    const j = jit ? (hash(i * 1.37) - 0.5) * jit : 0;
    const c = hash(i * 5.3) * 0.12;
    tbox(K, M.matte, 0, y(t + 0.14) - 0.03 + j, t + 0.14, 1.7, 0.06, 0.29, -slope, linC(0.72 - c, 0.52 - c, 0.31 - c * 0.6), j * 2);
  }
  for (const x of [-0.62, 0.62]) tbox(K, M.matte, x, dy / 2 - 0.16, L / 2, 0.12, 0.2, Math.hypot(L, dy), -slope, WOOD_DARK);
  for (const x of [-0.84, 0.84]) {
    const n = Math.max(2, Math.round(L / 1.6));
    for (let k = 0; k <= n; k++) {
      const t = (k / n) * (L - 0.1) + 0.05;
      K.box(M.matte, x - 0.045, y(t) - 0.06, t - 0.045, x + 0.045, y(t) + 1.05, t + 0.045, WOOD_DARK);
    }
    tbox(K, M.matte, x, dy / 2 + 1.02, L / 2, 0.08, 0.07, Math.hypot(L, dy), -slope, WOOD);
    tbox(K, M.matte, x, dy / 2 + 0.52, L / 2, 0.05, 0.05, Math.hypot(L, dy), -slope, WOOD);
  }
  if (s.jetty) {
    // the piles under its end, down into the bay, and a ladder down to the water
    for (const t of [L * 0.5, L - 0.25]) for (const x of [-0.7, 0.7]) K.box(M.matte, x - 0.1, -3.2, t - 0.1, x + 0.1, -0.05, t + 0.1, WOOD_DARK);
    for (const x of [-0.25, 0.25]) K.box(M.matte, x - 0.03, -1.9, L + 0.05, x + 0.03, 0.9, L + 0.11, WOOD);
    for (let yy = -1.7; yy < 0.7; yy += RUNG) K.box(M.matte, -0.25, yy - 0.02, L + 0.06, 0.25, yy + 0.02, L + 0.1, WOOD_LIGHT);
  }
}

// the umbrella and the key, as they fly to you (as drawn, side on: x across, y up, z the way the
// drawing points)
function umbrellaModel(K, M) {
  const g = new THREE.SphereGeometry(0.62, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.45);
  g.scale(1, 0.55, 1);
  g.translate(0, 0.86, 0);
  K.add(M.paint, g, linC(...CANOPY));
  K.cyl(M.metal, 0.014, 0.014, 0, 1.24, linC(0.2, 0.2, 0.24), { axis: 'y' });
  K.torus(M.round, 0.055, 0.014, 0.055, 0, 0, WOOD_DARK, 0, 0);
}

function keyModel(K, M) {
  K.torus(M.metal, 0.05, 0.013, 0, 0, 0, BRASS, Math.PI / 2, Math.PI / 2);
  K.cyl(M.metal, 0.011, 0.011, 0.05, 0.21, BRASS);
  K.box(M.metal, -0.008, -0.045, 0.165, 0.008, -0.008, 0.205, BRASS);
  K.box(M.metal, -0.008, -0.03, 0.13, 0.008, -0.008, 0.15, BRASS);
}

export class Gadgets {
  constructor(game) {
    this.game = game;
    // what was put up: { id, grade, s (the spot, as saved), group, route?, ramp?, boxes? }
    this.placed = [];
    // the ramps among them, for the traffic (game/traffic.js: in the way like a stopped car)
    this.ramps = [];
    this.umbrella = null; // { grade }
    this.key = null; // { grade, uses }
    // (the umbrella holding a fall this frame: game/player.js asks)
    this.falling = false;
    this.rainSaid = false;
    // the shutters opened with the key (game/shutters.js keeps them up)
    this.forced = [];
    this.stats = { ladder: 0, ramp: 0, bridge: 0, keys: 0, tills: 0, smudged: 0, slowFalls: 0, fizzled: 0 };
  }

  places(id) {
    return PLACED.has(id);
  }

  // the way the camera looks, level
  look() {
    const g = this.game;
    const d = g.camera.getWorldDirection(_d);
    d.y = 0;
    if (d.lengthSq() < 1e-6) d.set(Math.sin(g.player.yaw), 0, Math.cos(g.player.yaw));
    return d.normalize();
  }

  // the highest floor under (x, z) no higher than y, up here and down there (skip: a tag left out)
  floorAt(x, z, y, skip = null) {
    const g = this.game;
    let f = groundHeight(x, z);
    const fn = (b) => {
      if (b.tag !== skip && b.y1 <= y + 0.05 && b.y1 > f && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) f = b.y1;
      return false;
    };
    g.world.collision.forEachIn(x - 0.05, z - 0.05, x + 0.05, z + 0.05, fn);
    if (g.world.roofs) g.world.roofs.col.forEachIn(x - 0.05, z - 0.05, x + 0.05, z + 0.05, fn);
    return f;
  }

  // ---------------------------------------------------------------- where it would go
  // a thing to put up: where it goes from here ({ ok, ... }), or why it cannot ({ why })
  spot(id) {
    if (id === 'ladder') return this.ladderSpot();
    if (id === 'ramp') return this.rampSpot();
    if (id === 'bridge') return this.bridgeSpot();
    return { ok: true };
  }

  // before the drawing starts: why it would come to nothing here (null: it would not)
  cannot(id) {
    if (!PLACED.has(id)) return null;
    const s = this.spot(id);
    return s.ok ? null : s.why;
  }

  ladderSpot() {
    const g = this.game;
    const P = g.player;
    if (!g.climb || !g.world.roofs) return { why: WHY.noroofs };
    const d = this.look();
    const h = g.world.collision.raycast(P.pos.x, P.pos.y + 1.0, P.pos.z, d.x, 0, d.z, 3.2);
    if (!h || !h.box || h.box.tag !== 'wall' || Math.abs(h.ny) > 0.5) return { why: WHY.wall };
    // (the city's boxes stand square to its streets: so does the face)
    const nx = Math.round(h.nx);
    const nz = Math.round(h.nz);
    if (Math.abs(nx) + Math.abs(nz) !== 1) return { why: WHY.wall };
    let first = null;
    for (const sh of [0, 0.9, -0.9, 1.8, -1.8, 2.7, -2.7]) {
      const s = this.ladderAt(h.x + nz * sh, h.z - nx * sh, nx, nz, P.pos.y);
      if (s.ok) return s;
      if (!first) first = s;
    }
    return first;
  }

  ladderAt(x, z, nx, nz, y) {
    const g = this.game;
    const col = g.world.collision;
    const RC = g.world.roofs.col;
    const climb = g.climb;
    const rx = nz;
    const rz = -nx;
    const at = (u, w) => [x + rx * u + nx * w, z + rz * u + nz * w];
    // the top of the wall: the highest of the building's boxes just behind its face
    const [ix, iz] = at(0, -0.25);
    let top = -Infinity;
    col.forEachIn(ix - 0.02, iz - 0.02, ix + 0.02, iz + 0.02, (b) => {
      if (b.tag === 'wall' && ix >= b.x0 && ix <= b.x1 && iz >= b.z0 && iz <= b.z1) top = Math.max(top, b.y1);
      return false;
    });
    if (top === -Infinity) return { why: WHY.wall };
    if (top < y + 2.4) return { why: WHY.low };
    if (top - y > 21) return { why: WHY.high };
    // what stands at the edge up there (a parapet, a cornice): over it, and out round it
    let over = top;
    let out = 0;
    const [ax, az] = at(-0.45, -1.2);
    const [bx, bz] = at(0.45, 0.75);
    const x0 = Math.min(ax, bx);
    const x1 = Math.max(ax, bx);
    const z0 = Math.min(az, bz);
    const z1 = Math.max(az, bz);
    const edge = (b) => {
      if (b.y1 <= top + 0.05 || b.y0 >= top + 2.2 || b.x1 < x0 || b.x0 > x1 || b.z1 < z0 || b.z0 > z1) return false;
      over = Math.max(over, b.y1);
      // (how far it stands out of the face)
      const o = nx > 0 ? b.x1 - x : nx < 0 ? x - b.x0 : nz > 0 ? b.z1 - z : z - b.z0;
      out = Math.max(out, o);
      return false;
    };
    col.forEachIn(x0, z0, x1, z1, edge);
    RC.forEachIn(x0, z0, x1, z1, edge);
    if (over - top > 1.7) return { why: WHY.top };
    // the rails a hand's width out of the wall (out round a cornice); the feet a step out of them
    const W = Math.max(0.15, out + 0.14);
    const [fx, fz] = at(0, W + 0.28);
    const fy = climb.floorAt(fx, fz, y + 0.5);
    if (Math.abs(fy - y) > 0.6 || !climb.roomAt(fx, fy, fz, 0.28, 1.7)) return { why: WHY.foot };
    // nothing standing out of the wall on the way up (a balcony, a sign, a fire escape): just
    // outside the rails, clear of the wall itself
    const [cx, cz] = at(0, W + 0.12);
    for (let yy = fy + 0.6; yy < over - 0.3; yy += 0.7) {
      if (col.pointInside(cx, yy, cz, 0.06) || RC.pointInside(cx, yy, cz, 0.06)) return { why: WHY.way };
    }
    // off it onto the roof: room to stand, on the roof itself
    const inn = over > top + 0.1 ? 1.25 : 0.9;
    let lw = null;
    for (const w of [inn, inn + 0.8]) {
      const [lx, lz] = at(0, -w);
      if (Math.abs(climb.floorAt(lx, lz, top + 0.3) - top) < 0.12 && climb.roomAt(lx, top, lz, 0.3, 1.7)) {
        lw = w;
        break;
      }
    }
    if (lw === null) return { why: WHY.roof };
    // (one is enough here)
    for (const it of this.placed) if (it.id === 'ladder' && Math.hypot(it.s.x - x, it.s.z - z) < 1.4) return { why: WHY.near };
    const r2 = (v) => Math.round(v * 100) / 100;
    return { ok: true, id: 'ladder', x: r2(x), z: r2(z), nx, nz, y: r2(fy), top: r2(top), over: r2(over), W: r2(W), lw };
  }

  rampSpot() {
    const g = this.game;
    const P = g.player;
    const col = g.world.collision;
    const d = this.look();
    const fx = d.x;
    const fz = d.z;
    const rx = fz;
    const rz = -fx;
    const L = 5.5;
    const W = 3.2;
    const H = 1.35;
    const cars = [...g.traffic.list, ...(g.traffic.parked || []), ...g.vehicles.list.filter((v) => !v.dead)];
    for (const a0 of [1.6, 3, 4.5, 6]) {
      const x0 = P.pos.x + fx * a0;
      const z0 = P.pos.z + fz * a0;
      let ok = true;
      for (let a = 0; a <= L + 0.01 && ok; a += L / 4) {
        for (const b of [-W / 2, 0, W / 2]) {
          const px = x0 + fx * a + rx * b;
          const pz = z0 + fz * a + rz * b;
          // (on the road, where the cars are; nothing standing there, no ramp already)
          if (groundHeight(px, pz) !== 0 || col.pointInside(px, 0.6, pz, 0.2) || col.pointInside(px, 1.4, pz, 0.2) || rampAt(px, pz) > 0) {
            ok = false;
            break;
          }
        }
      }
      const mx = x0 + fx * (L / 2);
      const mz = z0 + fz * (L / 2);
      if (ok && cars.some((c) => !c.gone && Math.hypot(c.pos.x - mx, c.pos.z - mz) < 4.4)) ok = false;
      if (ok) {
        const r2 = (v) => Math.round(v * 100) / 100;
        return { ok: true, id: 'ramp', x: r2(x0), z: r2(z0), yaw: Math.round(Math.atan2(fx, fz) * 1e4) / 1e4, len: L, w: W, h: H };
      }
    }
    return { why: WHY.ramp };
  }

  bridgeSpot() {
    const g = this.game;
    const P = g.player;
    const climb = g.climb;
    const col = g.world.collision;
    const d = this.look();
    // (straight across, along the city's grid)
    let dx = 0;
    let dz = 0;
    if (Math.abs(d.x) >= Math.abs(d.z)) dx = Math.sign(d.x);
    else dz = Math.sign(d.z);
    const y0 = P.pos.y;
    const px = P.pos.x;
    const pz = P.pos.z;
    const floor = (s, yMax, skip = null) => this.floorAt(px + dx * s, pz + dz * s, yMax, skip);
    const water = (s) => groundHeight(px + dx * s, pz + dz * s) < -0.5;
    // the edge: where the floor drops away in front of you (and what stands on it: a parapet - the
    // bridge starts on top of that; the promenade's railing - it starts past it, you climb over)
    let s0 = null;
    let lip = y0;
    for (let s = 0.4; s <= 3.6; s += 0.2) {
      const f = floor(s, y0 + 1.7, 'bound');
      if (f < y0 - 1.2 || (water(s) && f < y0 - 0.5)) {
        s0 = s;
        break;
      }
      lip = Math.max(lip, f);
    }
    if (s0 === null) return { why: WHY.edge };
    // (its planks a finger over what they lie on)
    const yA = lip + 0.04;
    // the other side: the first floor at about your height (not the water), with room to stand;
    // not through a wall (one higher than any landing there could be)
    const wall = col.raycast(px + dx * s0, yA + 3.6, pz + dz * s0, dx, 0, dz, 28);
    const limit = s0 + (wall ? wall.t : 28);
    let sE = null;
    let yE = null;
    for (let s = s0 + 0.5; s <= limit; s += 0.25) {
      if (water(s)) continue;
      const f = floor(s, yA + 3.4);
      if (f < yA - 3.4) continue;
      const x = px + dx * s;
      const z = pz + dz * s;
      if (!climb || climb.roomAt(x, f, z, 0.3, 1.7)) {
        sE = s;
        yE = f + 0.04;
      }
      break;
    }
    let jetty = false;
    if (sE === null) {
      if (!water(s0 + 0.6)) return { why: WHY.far };
      // (over the bay with nothing across: a jetty out over the water)
      jetty = true;
      sE = s0 + 12;
      yE = yA;
    }
    if (sE - s0 < 1.1) return { why: WHY.short };
    const r2 = (v) => Math.round(v * 100) / 100;
    return { ok: true, id: 'bridge', x: r2(px), z: r2(pz), dx, dz, sA: r2(Math.max(0.3, s0 - 0.7)), sB: r2(sE + (jetty ? 0 : 0.7)), yA: r2(yA), yE: r2(yE), jetty };
  }

  // ---------------------------------------------------------------- the thing itself
  // { group (built in its own frame), O (where its origin goes), q (its turn) }; s null: one to
  // show in the air (a drawing that came to nothing here)
  model(id, grade, s) {
    const M = itemMats();
    const K = new Kit();
    const O = new THREE.Vector3();
    const q = new THREE.Quaternion();
    if (id === 'ladder') {
      const sp = s || { W: 0.15, y: 0, top: 2.6, over: 2.6 };
      ladderModel(K, M, sp, grade);
      if (s) {
        O.set(s.x, s.y, s.z);
        // (x along the wall, y up, z out of it)
        q.setFromRotationMatrix(_m.makeBasis(_v.set(s.nz, 0, -s.nx), UP, new THREE.Vector3(s.nx, 0, s.nz)));
      }
    } else if (id === 'ramp') {
      const sp = s || { len: 2.4, w: 1.4, h: 0.6 };
      rampModel(K, M, sp);
      if (s) {
        O.set(s.x, 0, s.z);
        q.setFromAxisAngle(UP, s.yaw);
      }
    } else if (id === 'bridge') {
      const sp = s || { sA: 0, sB: 3, yA: 0, yE: 0 };
      bridgeModel(K, M, sp, grade);
      if (s) {
        O.set(s.x + s.dx * s.sA, s.yA, s.z + s.dz * s.sA);
        q.setFromAxisAngle(UP, Math.atan2(s.dx, s.dz));
      }
    } else if (id === 'umbrella') umbrellaModel(K, M);
    else keyModel(K, M);
    const group = K.build({ seed: 0.31 });
    group.matrixAutoUpdate = false;
    return { group, O, q };
  }

  // put up where it was planned (game/game.js, as the drawing lands; the save): group is in the
  // scene already, where it goes
  place(id, grade, s, group) {
    const g = this.game;
    const it = { id, grade, s, group };
    if (id === 'ladder') {
      const f = {
        nx: s.nx,
        nz: s.nz,
        p: (u, v, w) => [s.x + s.nz * u + s.nx * w, v, s.z - s.nx * u + s.nz * w],
      };
      const P = (w, y) => ({ x: s.x + s.nx * w, y, z: s.z + s.nz * w });
      const r = new Route('ladder');
      r.start(P(s.W + 0.28, s.y));
      r.ladder(P(s.W + 0.28, s.over + 0.15), Math.atan2(-s.nx, -s.nz), f, 0, s.W);
      r.walk(P(s.over > s.top + 0.1 ? -0.5 : -0.15, s.over + 0.3));
      r.walk(P(-s.lw, s.top));
      r.f = f;
      r.drawn = true;
      g.world.roofs.routes.push(r);
      it.route = r;
    } else if (id === 'ramp') {
      const R = { x: s.x, z: s.z, yaw: s.yaw, len: s.len, w: s.w, h: s.h, drawn: true };
      RAMPS.push(R);
      it.ramp = R;
      const fx = Math.sin(s.yaw);
      const fz = Math.cos(s.yaw);
      it.near = { cx: s.x + fx * (s.len / 2), cz: s.z + fz * (s.len / 2), r: s.w / 2 - 0.98 + 0.8, back: s.len / 2 - 2.3 + 0.3 };
      this.ramps.push(it.near);
    } else if (id === 'bridge') {
      // the deck to walk on and the rails either side, in short lengths (up its slope)
      const col = g.world.collision;
      const L = s.sB - s.sA;
      const boxes = (it.boxes = []);
      const n = Math.max(1, Math.ceil(L / 0.5));
      const along = (t0, t1, c0, c1, y0, y1, tag) => {
        const ax = s.x + s.dx * (s.sA + t0);
        const bx = s.x + s.dx * (s.sA + t1);
        const az = s.z + s.dz * (s.sA + t0);
        const bz = s.z + s.dz * (s.sA + t1);
        // (across: the deck's own sideways, x for a bridge along z and z for one along x)
        const cx0 = s.dx ? Math.min(ax, bx) : s.x + c0;
        const cx1 = s.dx ? Math.max(ax, bx) : s.x + c1;
        const cz0 = s.dz ? Math.min(az, bz) : s.z + c0;
        const cz1 = s.dz ? Math.max(az, bz) : s.z + c1;
        boxes.push(col.addBox(cx0, cz0, cx1, cz1, y0, y1, tag));
      };
      for (let k = 0; k < n; k++) {
        const t0 = (k / n) * L;
        const t1 = ((k + 1) / n) * L;
        const y = s.yA + ((s.yE - s.yA) * (t0 + t1)) / 2 / L;
        along(t0, t1, -0.85, 0.85, y - 0.3, y, 'prop');
        along(t0, t1, -0.9, -0.78, y, y + 1.05, 'prop');
        along(t0, t1, 0.78, 0.9, y, y + 1.05, 'prop');
      }
    }
    this.placed.push(it);
    this.stats[id] = (this.stats[id] || 0) + 1;
    // (three of each at most: the oldest goes)
    const same = this.placed.filter((o) => o.id === id);
    if (same.length > MAX_EACH) this.remove(same[0], true);
    return it;
  }

  remove(it, puff = false) {
    const g = this.game;
    const i = this.placed.indexOf(it);
    if (i < 0) return;
    this.placed.splice(i, 1);
    if (it.group) {
      if (puff) {
        const b = new THREE.Box3().setFromObject(it.group);
        const c = b.getCenter(_v);
        g.fx.crumbs(c.x, c.y, c.z, 18, 3);
        g.audio.play('erase', 0.4);
      }
      g.scene.remove(it.group);
      it.group.traverse((m) => m.geometry && m.geometry.dispose());
    }
    if (it.route) {
      const R = g.world.roofs.routes;
      const k = R.indexOf(it.route);
      if (k >= 0) R.splice(k, 1);
      if (g.climb && g.climb.on && g.climb.on.route === it.route) g.climb.off(false);
    }
    if (it.ramp) {
      const k = RAMPS.indexOf(it.ramp);
      if (k >= 0) RAMPS.splice(k, 1);
      const j = this.ramps.indexOf(it.near);
      if (j >= 0) this.ramps.splice(j, 1);
    }
    if (it.boxes) for (const id of it.boxes) g.world.collision.remove(id);
  }

  // into the scene where it goes, and up (the save)
  build(id, grade, s) {
    const m = this.model(id, grade, s);
    m.group.matrix.compose(m.O, m.q, _v.set(1, 1, 1));
    m.group.matrixWorldNeedsUpdate = true;
    this.game.scene.add(m.group);
    return this.place(id, grade, s, m.group);
  }

  // the umbrella or the key, in your hands now (game/game.js, once it has flown to you)
  take(id, grade) {
    const g = this.game;
    if (id === 'umbrella') {
      this.umbrella = { grade };
      g.hud.toast('יש לכם מטריה! בגשם היא נפתחת מעליכם (והציורים באוויר לא נמרחים), ובנפילה מגובה היא מאטה אתכם', 'good', 4.2);
    } else if (id === 'key') {
      this.key = { grade, uses: KEY_USES[grade] || KEY_USES.good };
      g.hud.toast('יש לכם מפתח שמתאים לכל מנעול: מכונית חונה נפתחת בלי אזעקה, וחנות סגורה בלילה נפתחת', 'good', 4.2);
    }
    g.audio.play('cheer', 0.6);
  }

  // ---------------------------------------------------------------- the umbrella
  // (game/player.js, each step of a fall) open over your head: the fastest you may come down;
  // null: no umbrella, or no fall to speak of
  fall(P) {
    const U = this.umbrella;
    if (!U || P.onGround || P.mode !== 'foot' || P.inVehicle) return null;
    if (!this.falling) {
      const g = this.game;
      const below = g.climb ? g.climb.floorAt(P.pos.x, P.pos.z, P.pos.y + 0.05) : groundHeight(P.pos.x, P.pos.z);
      if (!(P.vel.y < -6 && P.pos.y - below > 2.2)) return null;
      this.stats.slowFalls++;
      g.audio.play('chute', 0.35);
    }
    this.falling = true;
    return SINK[U.grade] || SINK.good;
  }

  // out under the sky in the rain, a drawing in the air: the points the rain runs off it (0: dry -
  // under the umbrella, a roof, indoors)
  smudge() {
    const g = this.game;
    const rain = g.weather && g.weather.cur ? g.weather.cur.rain : 0;
    if (rain < 0.12 || this.sheltered()) return 0;
    this.stats.smudged++;
    return Math.round(SMUDGE * Math.min(1, rain + 0.25));
  }

  sheltered() {
    const g = this.game;
    const P = g.player;
    if (this.umbrella || P.indoor || (g.weather && g.weather.indoors)) return true;
    return !!g.world.collision.raycast(P.pos.x, P.pos.y + 1.9, P.pos.z, 0, 1, 0, 40);
  }

  // (game/game.js, a drawing begun) the rain will run it: said once a shower
  rainHint() {
    const g = this.game;
    const rain = g.weather && g.weather.cur ? g.weather.cur.rain : 0;
    if (rain < 0.12) {
      this.rainSaid = false;
      return;
    }
    if (this.rainSaid || this.sheltered()) return;
    this.rainSaid = true;
    g.hud.toast('יורד גשם: הוא ימרח קצת את הדיו. מטריה מצוירת (או גג מעליכם) תשמור על הציור', 'info', 3.6);
  }

  // ---------------------------------------------------------------- the key
  useKey() {
    const K = this.key;
    if (!K || K.uses <= 0) return false;
    K.uses--;
    this.stats.keys++;
    if (K.uses <= 0) {
      this.key = null;
      this.game.hud.toast('המפתח המצויר התעקם במנעול. אפשר לצייר חדש', 'info', 2.8);
    }
    return true;
  }

  // a shop's shutter down for the night, the front in front of you (game/shutters.js)
  shutterAt() {
    const S = this.game.shutters;
    if (!S || !this.key) return null;
    const p = this.game.player.pos;
    for (const e of S.list) {
      if (e.down < 1 || e.forced) continue;
      const L2 = e.ax.lengthSq();
      const t = Math.max(-0.5, Math.min(0.5, ((p.x - e.x) * e.ax.x + (p.z - e.z) * e.ax.z) / L2));
      if (Math.hypot(p.x - (e.x + e.ax.x * t), p.z - (e.z + e.ax.z * t)) < 1.9) return e;
    }
    return null;
  }

  // in a shop opened with the key: its till, by where the keeper stands by day
  tillAt() {
    const p = this.game.player.pos;
    for (const e of this.forced) {
      if (e.tillTaken || !e.room.inside(p.x, p.z, 0)) continue;
      const k = e.room.keeper;
      if (k && Math.hypot(k.x - p.x, k.z - p.z) < 2.4) return e;
    }
    return null;
  }

  // what E would do here: { label } (game/game.js, the prompt)
  target() {
    const P = this.game.player;
    if (P.mode !== 'foot' || P.inVehicle) return null;
    if (this.tillAt()) return { label: 'לרוקן את הקופה' };
    if (this.shutterAt()) return { label: 'לפתוח את החנות הסגורה במפתח' };
    return null;
  }

  interact() {
    const g = this.game;
    const P = g.player;
    if (P.mode !== 'foot' || P.inVehicle) return false;
    const t = this.tillAt();
    if (t) {
      t.tillTaken = true;
      const n = Math.round(TILL[0] + Math.random() * (TILL[1] - TILL[0]));
      if (g.money) g.money.earn(n, 'הקופה של חנות סגורה');
      g.audio.play('till', 0.7);
      g.hud.toast(`$${n} מהקופה`, 'good', 2);
      this.stats.tills++;
      g.onCrime('burglary', P.pos.x, P.pos.z);
      return true;
    }
    const e = this.shutterAt();
    if (!e || !this.useKey()) return false;
    e.forced = true;
    if (!this.forced.includes(e)) this.forced.push(e);
    g.audio.play('shutter', 0.7);
    // (one shop in three has an alarm on the shutter)
    if (Math.random() < 0.34) {
      g.audio.play('alarm', 0.7);
      g.hud.toast('אזעקה! המשטרה בדרך', 'bad', 2.2);
      g.onCrime('alarm', e.x, e.z);
      g.enemies.noise(_v.set(e.x, 1, e.z), 40, 'alarm');
    } else g.hud.toast('התריס עולה בשקט…', 'info', 2);
    return true;
  }

  // ---------------------------------------------------------------- each frame
  update(dt) {
    const g = this.game;
    const P = g.player;
    const fig = P.fig;
    // the umbrella: in the left hand in the rain (and while it holds a fall), not while the hands
    // are busy
    if (this.umbrella && fig) {
      const rain = g.weather && g.weather.cur ? g.weather.cur.rain : 0;
      const busy = fig.aim || fig.guard > 0.01 || fig.punch >= 0 || fig.kick >= 0 || fig.melee >= 0 || fig.surrender > 0;
      const want = (P.mode === 'foot' || P.mode === 'draw') && !P.inVehicle && !busy && (this.falling || (rain > 0.12 && !P.indoor));
      if (want && (!fig.carryL || fig.carryL === 'umbrella')) {
        fig.carryL = 'umbrella';
        fig.umbrellaColor = FIG_CANOPY;
      } else if (!want && fig.carryL === 'umbrella') fig.carryL = null;
      fig.umbrellaUp = damp(fig.umbrellaUp || 0, this.falling ? 1 : 0, 8, dt);
    }
    if (P.onGround || P.mode !== 'foot') this.falling = false;
    // the shops opened with the key: shut again once you are well away, or open in the morning
    if (this.forced.length) {
      const R = g.rhythm;
      this.forced = this.forced.filter((e) => {
        const far = Math.hypot(e.x - P.pos.x, e.z - P.pos.z) > 45;
        if (far || (R && R.open(e.shop.kind))) {
          e.forced = false;
          e.tillTaken = false;
          return false;
        }
        return true;
      });
    }
  }

  // ---------------------------------------------------------------- the save (game/save.js)
  save() {
    if (!this.placed.length && !this.umbrella && !this.key) return null;
    return {
      placed: this.placed.map((it) => ({ id: it.id, grade: it.grade, s: it.s })),
      umbrella: this.umbrella ? this.umbrella.grade : null,
      key: this.key ? { grade: this.key.grade, uses: this.key.uses } : null,
    };
  }

  load(s) {
    if (!s) return;
    for (const it of s.placed || []) {
      if (!it || !PLACED.has(it.id) || !it.s) continue;
      try {
        this.build(it.id, it.grade || 'good', it.s);
      } catch (e) {
        // (a spot that no longer fits: left out)
      }
    }
    if (s.umbrella) this.umbrella = { grade: s.umbrella };
    if (s.key && s.key.uses > 0) this.key = { grade: s.key.grade || 'good', uses: s.key.uses };
  }
}
