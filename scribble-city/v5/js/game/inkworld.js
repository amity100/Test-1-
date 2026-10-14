import * as THREE from 'three';
import { groundHeight, WATER_X, PIER } from '../world/layout.js';
import { clamp } from '../core/util.js';
import { Kit, itemMats, linC } from './items.js';
import { RAMPS } from './vehicles.js';

// (ROADMAP 11.6, the test of "the line becomes matter") Drawing on the world itself.
//
// In the pen (ui/inkpen.js: Q, or the pencil on a phone) the city slows almost to a stop and the
// screen is the page: a line drawn over it lands on the city, and becomes a real thing there, in
// its shape. What it becomes is read from where it was drawn and how:
//   - a line along the ground: a wall standing on it (it stops a car, a police car crashes into it)
//   - a line from the road up into the sky: a ramp, as high as the line went up
//   - a line from one high place to another over a drop (roof to roof, the promenade to the pier),
//     or from the street up to a roof: a bridge, or stairs, from end to end
//   - a line up a building's wall: a ladder
//   - a ring round somebody (or a car): a cage
//   - a ring on the ground: a pillar rising out of it (under you: up to the roof beside it)
// and by the ink it is drawn in (1-4): the pencil's grey (solid), rubber (it bounces: walls throw
// back, a ring on the ground is a trampoline, a ramp throws higher), ice (a line or a ring on the
// ground is a slick: cars spin, people slip; round somebody, a block of ice) and glue (on the
// ground it holds whatever drives or walks into it; round somebody, glued to the spot).
// Every line takes ink (game/ink.js), and what was drawn lasts a while, then is rubbed away.

export const INKS = {
  pencil: { id: 'pencil', name: 'עיפרון', css: '#43454f', color: linC(0.36, 0.37, 0.42), dark: linC(0.2, 0.2, 0.24), mat: 'matte', life: 60 },
  rubber: { id: 'rubber', name: 'גומי', css: '#e24d68', color: linC(0.93, 0.36, 0.46), dark: linC(0.62, 0.16, 0.25), mat: 'paint', life: 45 },
  ice: { id: 'ice', name: 'קרח', css: '#5fb8e8', color: linC(0.7, 0.9, 1.0), dark: linC(0.36, 0.62, 0.86), mat: 'glass', life: 25 },
  glue: { id: 'glue', name: 'דבק', css: '#d9b21e', color: linC(0.99, 0.9, 0.5), dark: linC(0.82, 0.66, 0.18), mat: 'paint', life: 30 },
};
export const INK_ORDER = ['pencil', 'rubber', 'ice', 'glue'];

// how far a line may land (from the camera) and how far from you what it makes may stand
const RANGE = 80;
const REACH = 62;
// no more than this many drawn things at once: the oldest goes
const MAX_LIVE = 16;
// (s) a drawn thing this new, the drivers have not seen yet: they do not brake for it, they drive
// into it (game/chase.js, game/traffic.js)
const SURPRISE = 1.6;
// a trampoline's throw (m/s): higher each bounce that lands back on it
const TRAMP_V = [13.5, 16.5, 19.5];
// what each thing takes from the pen (game/ink.js: 100 in a full HB pencil)
const COST = { wall: 2.0, wallBase: 4, strip: 1.0, stripBase: 3, bridge: 1.4, bridgeBase: 6, ramp: 14, pillar: 12, pillarM: 1.0, tramp: 12, slick: 8, cage: 10, ladder: 12 };
// how long a ring round somebody holds them (s)
const HOLD = { pencil: 12, rubber: 8, ice: 7, glue: 9 };
const WALL_H = { pencil: 2.6, rubber: 2.1 };
const WALL_T = { pencil: 0.36, rubber: 0.55 };

const _ndc = new THREE.Vector2();
const _ray = new THREE.Raycaster();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const r2 = (v) => Math.round(v * 100) / 100;

// a point in polygon (screen points [x, y])
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi) inside = !inside;
  }
  return inside;
}

// Ramer-Douglas-Peucker on [x, y, z] points (xz distance), then no piece longer than step
function simplify(pts, eps, step) {
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = pts[a][0];
    const az = pts[a][2];
    const dx = pts[b][0] - ax;
    const dz = pts[b][2] - az;
    const L2 = dx * dx + dz * dz || 1e-9;
    let best = -1;
    let bd = eps;
    for (let i = a + 1; i < b; i++) {
      const t = clamp(((pts[i][0] - ax) * dx + (pts[i][2] - az) * dz) / L2, 0, 1);
      const d = Math.hypot(pts[i][0] - ax - dx * t, pts[i][2] - az - dz * t);
      if (d > bd) {
        bd = d;
        best = i;
      }
    }
    if (best > 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (!keep[i]) continue;
    const p = pts[i];
    const q = out[out.length - 1];
    if (q) {
      const d = Math.hypot(p[0] - q[0], p[2] - q[2]);
      const n = Math.ceil(d / step);
      for (let k = 1; k < n; k++) out.push([q[0] + ((p[0] - q[0]) * k) / n, q[1] + ((p[1] - q[1]) * k) / n, q[2] + ((p[2] - q[2]) * k) / n]);
      if (d < 0.05) continue;
    }
    out.push(p.slice());
  }
  return out;
}

function pathLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
  return L;
}

// distance from (x, z) to a polyline of [x, y, z]
function distToLine(x, z, pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1][0];
    const az = pts[i - 1][2];
    const dx = pts[i][0] - ax;
    const dz = pts[i][2] - az;
    const L2 = dx * dx + dz * dz || 1e-9;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) best = d;
  }
  return best;
}

export class InkWorld {
  constructor(game) {
    this.game = game;
    this.list = [];
    // (game/traffic.js ahead) where the drawn things stand in the road: { x, z, r }
    this.blocks = [];
    // (game/vehicles.js drive) the decks a car may drive on: bridges, the tops of pillars
    this.decks = [];
    this.seq = 0;
    // what was tried, for the test's card (ui/inkpen.js)
    this.done = { wallStop: false, rampJump: false, bridge: false, up: false, caged: false, drove: false };
    this.stats = { drawn: 0, wall: 0, strip: 0, pad: 0, ramp: 0, bridge: 0, cage: 0, ladder: 0, crashes: 0, bounces: 0, slips: 0, stuck: 0, failed: 0 };
    this.onDone = null;
    // (the player's car leaving a rubber ramp: thrown higher)
    this.vRamp = null;
  }

  // ------------------------------------------------------------------ where a point of the screen lands
  // { p (Vector3), kind: 'ground' | 'water' | 'top' (a flat top: a roof, a ledge, what was drawn) |
  //   'wall' | 'under' | 'sky', t, box, n }
  hitAt(sx, sy) {
    const g = this.game;
    const cam = g.camera;
    _ndc.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    _ray.setFromCamera(_ndc, cam);
    const o = _ray.ray.origin;
    const d = _ray.ray.direction;
    let best = null;
    const take = (h, from) => {
      if (!h || (best && h.t >= best.t)) return;
      best = { t: h.t, kind: h.ny > 0.6 ? 'top' : h.ny < -0.6 ? 'under' : 'wall', box: h.box, n: [h.nx, h.ny, h.nz], from };
    };
    take(g.world.collision.raycast(o.x, o.y, o.z, d.x, d.y, d.z, RANGE, 'car'), 'city');
    const R = g.world.roofs && g.world.roofs.col;
    if (R) take(R.raycast(o.x, o.y, o.z, d.x, d.y, d.z, RANGE), 'roofs');
    const tg = this.groundT(o, d, best ? best.t : RANGE);
    if (tg !== null && (!best || tg < best.t)) {
      const x = o.x + d.x * tg;
      const z = o.z + d.z * tg;
      best = { t: tg, kind: groundHeight(x, z) < -0.5 ? 'water' : 'ground', box: null, n: [0, 1, 0], from: 'ground' };
    }
    if (!best) return { kind: 'sky', t: RANGE, p: new THREE.Vector3().copy(o).addScaledVector(d, RANGE), box: null, n: [0, 0, 0] };
    best.p = new THREE.Vector3().copy(o).addScaledVector(d, best.t);
    return best;
  }

  // where the ray first goes under the ground (or the bay's surface): the ground is flat in pieces
  // (the road, the kerb, the sand), so a step along it and then halving the last one
  groundT(o, d, maxT) {
    if (o.y <= groundHeight(o.x, o.z)) return 0;
    if (d.y >= 0) return null;
    let prev = 0;
    const step = 0.5;
    for (let t = step; t <= maxT + step; t += step) {
      const tt = Math.min(t, maxT);
      if (o.y + d.y * tt <= groundHeight(o.x + d.x * tt, o.z + d.z * tt)) {
        let a = prev;
        let b = tt;
        for (let i = 0; i < 14; i++) {
          const m = (a + b) / 2;
          if (o.y + d.y * m <= groundHeight(o.x + d.x * m, o.z + d.z * m)) b = m;
          else a = m;
        }
        return b;
      }
      prev = tt;
      if (tt >= maxT) break;
    }
    return null;
  }

  // ------------------------------------------------------------------ what a line becomes
  // pts: the line on the screen ([x, y] css px, as drawn), hits: where each lands (hitAt), ink.
  // Returns a plan { type, ink, cost, label, ... } or { why }
  read(pts, hits, ink) {
    if (pts.length < 3) return { why: 'קצר מדי' };
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    let len = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      if (i) len += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
    }
    const diag = Math.hypot(x1 - x0, y1 - y0);
    if (diag < 14 && len < 30) return { why: 'קצר מדי' };
    const ends = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
    const closed = pts.length >= 8 && ends < Math.max(34, diag * 0.32) && len > diag * 1.7;
    let plan = closed ? this.readRing(pts, hits, ink) : this.readLine(pts, hits, ink, { x0, y0, x1, y1 });
    if (plan.why) return plan;
    plan.ink = ink;
    plan.cost = Math.round(this.cost(plan));
    return plan;
  }

  readRing(pts, hits, ink) {
    const g = this.game;
    // somebody (or some car) inside the ring, near enough
    const caught = this.inside(pts);
    if (caught.length) {
      const name = ink === 'ice' ? 'גוש קרח' : ink === 'glue' ? 'דבק' : ink === 'rubber' ? 'בועת גומי' : 'כלוב';
      return { type: 'cage', targets: caught, label: caught.length > 1 ? `${name} ×${caught.length}` : name };
    }
    // a ring on the ground (or on a flat top): what rises, or lies, inside it
    const on = hits.filter((h) => h.kind === 'ground' || h.kind === 'top');
    if (on.length < hits.length * 0.55) return { why: 'עיגול צריך להקיף מישהו, או להיות כולו על הקרקע' };
    const ys = on.map((h) => h.p.y).sort((a, b) => a - b);
    const y = ys[Math.floor(ys.length / 2)];
    const same = on.filter((h) => Math.abs(h.p.y - y) < 0.7);
    if (same.length < on.length * 0.7) return { why: 'העיגול על כמה גבהים שונים' };
    let cx = 0;
    let cz = 0;
    for (const h of same) {
      cx += h.p.x;
      cz += h.p.z;
    }
    cx /= same.length;
    cz /= same.length;
    let r = 0;
    for (const h of same) r += Math.hypot(h.p.x - cx, h.p.z - cz);
    r /= same.length;
    const P = g.player.inVehicle ? g.player.inVehicle.pos : g.player.pos;
    if (Math.hypot(cx - P.x, cz - P.z) > REACH) return { why: 'רחוק מדי' };
    if (ink === 'ice' || ink === 'glue') {
      r = clamp(r, 1.2, 5);
      return { type: 'pad', kind: ink === 'ice' ? 'rink' : 'puddle', x: r2(cx), y: r2(y), z: r2(cz), r: r2(r), label: ink === 'ice' ? 'משטח קרח' : 'שלולית דבק' };
    }
    if (ink === 'rubber') {
      r = clamp(r, 1.0, 2.4);
      return { type: 'pad', kind: 'tramp', x: r2(cx), y: r2(y), z: r2(cz), r: r2(r), h: 0.5, label: 'טרמפולינה' };
    }
    r = clamp(r, 0.85, 2.6);
    // a pillar: beside a building, up to its roof (or the nearest ledge over you); else a step up
    const top = this.roofNear(cx, cz, r + 2.6, y);
    const h = top ? clamp(top - y, 1.2, 18) : 2.6;
    return { type: 'pad', kind: 'pillar', x: r2(cx), y: r2(y), z: r2(cz), r: r2(r), h: r2(h), label: top ? `עמוד עד הגג (${Math.round(h)} מ')` : 'עמוד' };
  }

  // the people and the cars whose middle is inside the ring on the screen (and not far)
  inside(pts) {
    const g = this.game;
    const cam = g.camera;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const P = g.player.inVehicle ? g.player.inVehicle.pos : g.player.pos;
    const out = [];
    const test = (pos, y, kind, o) => {
      if (Math.hypot(pos.x - P.x, pos.z - P.z) > 48) return;
      _v.set(pos.x, (pos.y || 0) + y, pos.z).project(cam);
      if (_v.z > 1 || _v.z < -1) return;
      const sx = ((_v.x + 1) / 2) * W;
      const sy = ((1 - _v.y) / 2) * H;
      if (inPoly(sx, sy, pts)) out.push({ kind, o });
    };
    for (const e of g.enemies.list) if (e.alive && !e.isMonster && e.dying < 0) test(e.pos, 1.0, 'person', e);
    for (const h of g.civilians.list) if (h.alive !== false && !h.inside && !h.gone) test(h.pos, 1.0, 'person', h);
    for (const c of g.traffic.list) if (c.poofT === undefined) test(c.pos, 0.8, 'car', c);
    return out.slice(0, 5);
  }

  // the roof (or the ledge) of what stands round (x, z), within reach, over y: its height, or 0
  roofNear(x, z, rad, y) {
    const g = this.game;
    let top = 0;
    const fn = (b) => {
      if ((b.tag === 'wall' || b.tag === 'roomwall') && b.y1 > y + 1.5 && b.y1 < y + 18.5 && b.y1 > top) top = b.y1;
      return false;
    };
    g.world.collision.forEachIn(x - rad, z - rad, x + rad, z + rad, fn);
    return top;
  }

  // what stands at a roof's edge where a bridge comes onto it (a parapet, a cornice): from (x, z)
  // out along (dx, dz), the way the bridge comes from. { top, out }: its top (y if nothing there,
  // nothing more than two metres over y), and how far out its outer face is
  lip(x, z, dx, dz, y) {
    let top = y;
    let out = 0;
    let hit = false;
    const fn = (b) => {
      if (b.tag !== 'ink' && b.y1 > y + 0.05 && b.y1 < y + 2.2 && b.y0 < y + 2.2) {
        top = Math.max(top, b.y1);
        hit = true;
      }
      return false;
    };
    const R = this.game.world.roofs && this.game.world.roofs.col;
    for (let k = 0; k <= 8; k++) {
      const o = k * 0.25 - 0.5;
      const px = x + dx * o;
      const pz = z + dz * o;
      hit = false;
      this.game.world.collision.forEachIn(px - 0.1, pz - 0.1, px + 0.1, pz + 0.1, fn);
      if (R) R.forEachIn(px - 0.1, pz - 0.1, px + 0.1, pz + 0.1, fn);
      if (hit) out = o;
    }
    return top === y ? { top: y, out: 0 } : { top: top + 0.05, out };
  }

  readLine(pts, hits, ink, bb) {
    const g = this.game;
    const P = g.player.inVehicle ? g.player.inVehicle.pos : g.player.pos;
    const n = hits.length;
    const valid = hits.filter((h) => h.kind !== 'sky');
    if (valid.length < 2) return { why: 'הקו לא נגע בשום דבר' };
    // a line up a building's wall: a ladder (the pencil's; the others' inks make a pencil one too)
    const onWall = hits.filter((h) => h.kind === 'wall');
    if (onWall.length > n * 0.6 && bb.y1 - bb.y0 > (bb.x1 - bb.x0) * 1.4) return this.readLadder(onWall);
    const A = valid[0];
    const B = valid[valid.length - 1];
    const ground = (h) => h.kind === 'ground' || h.kind === 'top';
    // 1. from the ground up off it - into the sky, or up the face of what stands beyond: a ramp
    let head = 0;
    while (head < n && ground(hits[head])) head++;
    let off = 0;
    for (let i = head; i < n; i++) if (hits[i].kind === 'sky' || hits[i].kind === 'wall' || hits[i].kind === 'under') off++;
    if (head >= 2 && head >= n * 0.12 && n - head >= 3 && off >= (n - head) * 0.8 && pts[n - 1][1] < pts[head - 1][1] - 30) return this.readRamp(pts, hits, head, (pts[0][1] - pts[n - 1][1]) / window.innerHeight);
    // 2. from one place to another over a drop (or up onto something higher): a bridge, or stairs
    // (one that cannot be says why - unless the stroke is a ramp's, 2b)
    let bridgeWhy = null;
    if (A !== B && A.kind !== 'water' && B.kind !== 'water' && A.kind !== 'under' && B.kind !== 'under') {
      const dx = B.p.x - A.p.x;
      const dz = B.p.z - A.p.z;
      const D = Math.hypot(dx, dz);
      const dy = B.p.y - A.p.y;
      let gap = false;
      for (const h of hits) {
        if (h === A || h === B) continue;
        if (h.kind === 'sky' || h.kind === 'water') {
          gap = true;
          break;
        }
        const t = clamp(((h.p.x - A.p.x) * dx + (h.p.z - A.p.z) * dz) / (D * D || 1), 0, 1);
        if (h.p.y < A.p.y + dy * t - 1.3) {
          gap = true;
          break;
        }
      }
      const upOnto = Math.abs(dy) > 1.6 && (A.kind === 'top' || A.kind === 'ground') && (B.kind === 'top' || B.kind === 'ground');
      if ((gap || upOnto) && D > 2.2) {
        const br = this.readBridge(hits, A, B, P);
        if (!br.why) return br;
        bridgeWhy = br.why;
      }
    }
    // 2b. a stroke up the page from the road - the way a ramp goes up, though in the picture it all
    // lies on the road further on (pencil, rubber: ice and glue lie along the road as they are)
    const up = pts[0][1] - pts[n - 1][1];
    if ((ink === 'pencil' || ink === 'rubber') && ground(hits[0]) && up > 60 && Math.abs(pts[n - 1][0] - pts[0][0]) < up * 0.6) {
      let k = 0;
      while (k < n && ground(hits[k])) k++;
      return this.readRamp(pts, hits, Math.max(2, k), up / window.innerHeight);
    }
    if (bridgeWhy) return { why: bridgeWhy };
    // 3. along the ground: a wall (ice and glue: a slick, a line of glue)
    const on = [];
    for (const h of hits) {
      if (!ground(h)) continue;
      if (on.length && Math.abs(h.p.y - on[on.length - 1][1]) > 0.8) continue;
      on.push([h.p.x, h.p.y, h.p.z]);
    }
    if (on.length < Math.max(2, n * 0.5)) return { why: 'קו על הקרקע, או מעל רווח' };
    const line = simplify(on, 0.22, ink === 'ice' || ink === 'glue' ? 1.4 : 0.9);
    const L = pathLen(line);
    if (L < 1.2) return { why: 'קצר מדי' };
    if (L > 34) return { why: 'ארוך מדי (עד 34 מטר)' };
    for (const p of line) if (Math.hypot(p[0] - P.x, p[2] - P.z) > REACH) return { why: 'רחוק מדי' };
    if (ink === 'ice' || ink === 'glue') return { type: 'strip', pts: line, len: r2(L), w: ink === 'ice' ? 2.4 : 2.0, label: `${ink === 'ice' ? 'רצועת קרח' : 'פס דבק'} (${Math.round(L)} מ')` };
    return { type: 'wall', pts: line, len: r2(L), label: `${ink === 'rubber' ? 'קיר גומי' : 'קיר'} (${Math.round(L)} מ')` };
  }

  // a bridge from A to B (where the line left the one and came onto the other), over what is
  // between; or why not
  readBridge(hits, A, B, P) {
    const g = this.game;
    const dx = B.p.x - A.p.x;
    const dz = B.p.z - A.p.z;
    const D = Math.hypot(dx, dz);
    const dy = B.p.y - A.p.y;
    if (D > 42) return { why: 'גשר עד 40 מטר' };
    if (Math.abs(dy) > D * 1.15) return { why: 'תלול מדי' };
    if (Math.hypot(A.p.x - P.x, A.p.z - P.z) > REACH || Math.hypot(B.p.x - P.x, B.p.z - P.z) > REACH) return { why: 'רחוק מדי' };
    // (nothing standing in the way between its ends)
    const col = g.world.collision;
    const mid = 0.9;
    const blocked = col.raycast(A.p.x, A.p.y + mid, A.p.z, dx, dy, dz, Math.max(0.1, Math.hypot(D, dy) - 0.6), 'car');
    if (blocked && blocked.box && blocked.box.tag !== 'ink' && blocked.t > 0.6) return { why: 'יש משהו בדרך' };
    // (its ends where it leaves one top and comes onto the other - a roof's edge - not where the
    // pen happened to start or stop on it: level with the edge, the way on is level too)
    let ia = hits.indexOf(A);
    let ib = hits.lastIndexOf(B);
    if (A.kind === 'top') while (ia + 1 < ib && hits[ia + 1].kind === 'top' && Math.abs(hits[ia + 1].p.y - A.p.y) < 0.3) ia++;
    if (B.kind === 'top') while (ib - 1 > ia && hits[ib - 1].kind === 'top' && Math.abs(hits[ib - 1].p.y - B.p.y) < 0.3) ib--;
    const ea = hits[ia].p;
    const eb = hits[ib].p;
    const ex = eb.x - ea.x;
    const ez = eb.z - ea.z;
    const E = Math.hypot(ex, ez);
    if (E < 1.5) return { why: 'קרוב מדי: אפשר לקפוץ' };
    // (half a metre onto each top, so there is no step between)
    const ka = A.kind === 'top' ? 0.5 / E : 0;
    const kb = B.kind === 'top' ? 0.5 / E : 0;
    const a = [r2(ea.x - ex * ka), r2(A.p.y), r2(ea.z - ez * ka)];
    const b = [r2(eb.x + ex * kb), r2(B.p.y), r2(eb.z + ez * kb)];
    // (over what stands at a roof's edge - a parapet, a cornice: its ends on top of that)
    // (the end on top of it, at its outer face: off the bridge onto it, and down onto the roof)
    if (A.kind === 'top') {
      const L = this.lip(a[0], a[2], ex / E, ez / E, a[1]);
      if (L.top > a[1]) {
        a[0] = r2(a[0] + (ex / E) * (L.out + 0.2));
        a[2] = r2(a[2] + (ez / E) * (L.out + 0.2));
        a[1] = r2(L.top);
      }
    }
    if (B.kind === 'top') {
      const L = this.lip(b[0], b[2], -ex / E, -ez / E, b[1]);
      if (L.top > b[1]) {
        b[0] = r2(b[0] - (ex / E) * (L.out + 0.2));
        b[2] = r2(b[2] - (ez / E) * (L.out + 0.2));
        b[1] = r2(L.top);
      }
    }
    const DD = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const dy2 = b[1] - a[1];
    const steep = Math.abs(dy2) / DD > 0.55;
    if (Math.abs(dy2) > DD * 1.15) return { why: 'תלול מדי' };
    const w = g.player.inVehicle ? 3.8 : 2.4;
    const label = steep ? 'מדרגות' : Math.abs(dy2) > 1.6 ? `${dy2 > 0 ? 'עלייה' : 'ירידה'} (${Math.round(DD)} מ')` : `גשר (${Math.round(DD)} מ')`;
    return { type: 'bridge', a, b, w, steps: steep, label };

  }

  // a ramp from where the line starts on the road, the way it goes, as high as it went up the page
  readRamp(pts, hits, head, rise) {
    const g = this.game;
    const P = g.player.inVehicle ? g.player.inVehicle.pos : g.player.pos;
    const a = hits[0].p;
    // (the cars ride a ramp from the street: game/vehicles.js rampAt)
    if (a.y > 0.6) return { why: 'רמפה מתחילה בכביש' };
    if (Math.hypot(a.x - P.x, a.z - P.z) > REACH) return { why: 'רחוק מדי' };
    // the way it goes: along the ground part of the line, its first few metres
    let e = hits[Math.min(head, hits.length) - 1].p;
    for (let i = 1; i < head; i++) {
      if (Math.hypot(hits[i].p.x - a.x, hits[i].p.z - a.z) > 6) {
        e = hits[i].p;
        break;
      }
    }
    let fx = e.x - a.x;
    let fz = e.z - a.z;
    let fl = Math.hypot(fx, fz);
    if (fl < 1.5) {
      // (only a little of it on the ground: the way the camera looks)
      const c = g.camera.getWorldDirection(_w);
      fx = c.x;
      fz = c.z;
      fl = Math.hypot(fx, fz) || 1;
    }
    fx /= fl;
    fz /= fl;
    const h = clamp(0.9 + rise * 3.2, 1.0, 2.8);
    const len = 5.5 + h * 0.9;
    return { type: 'ramp', x: r2(a.x), y: r2(Math.max(0, a.y)), z: r2(a.z), yaw: Math.atan2(fx, fz), len: r2(len), w: 3.6, h: r2(h), label: `רמפה (${h.toFixed(1)} מ')` };
  }

  readLadder(onWall) {
    const g = this.game;
    const G = g.gadgets;
    if (!G || !g.climb || !g.world.roofs) return { why: 'אין כאן לאן לטפס' };
    // the lowest point on the face, the face's way out (the city stands square to its streets)
    let low = onWall[0];
    for (const h of onWall) if (h.p.y < low.p.y) low = h;
    const nx = Math.round(low.n[0]);
    const nz = Math.round(low.n[2]);
    if (Math.abs(nx) + Math.abs(nz) !== 1) return { why: 'סולם מציירים על קיר ישר של בניין' };
    const y = groundHeight(low.p.x + nx * 0.6, low.p.z + nz * 0.6);
    const s = G.ladderAt(low.p.x, low.p.z, nx, nz, y);
    if (!s.ok) return { why: s.why };
    return { type: 'ladder', s, label: `סולם (${Math.round(s.top - s.y)} מ')` };
  }

  // what a plan takes from the pen
  cost(p) {
    if (p.type === 'wall') return COST.wallBase + COST.wall * p.len * (p.ink === 'rubber' ? 1.2 : 1);
    if (p.type === 'strip') return COST.stripBase + COST.strip * p.len;
    if (p.type === 'bridge') return COST.bridgeBase + COST.bridge * Math.hypot(p.b[0] - p.a[0], p.b[2] - p.a[2]) * (p.w > 3 ? 1.3 : 1);
    if (p.type === 'ramp') return COST.ramp + p.h * 2;
    if (p.type === 'pad') return p.kind === 'pillar' ? COST.pillar + COST.pillarM * p.h : p.kind === 'tramp' ? COST.tramp : COST.slick + p.r;
    if (p.type === 'cage') return COST.cage * p.targets.length;
    if (p.type === 'ladder') return COST.ladder;
    return 10;
  }

  // ------------------------------------------------------------------ the thing itself
  // make the plan real (its ink already paid for): the thing in the city, its weight in the world
  make(plan) {
    const g = this.game;
    const it = { id: ++this.seq, type: plan.type, ink: plan.ink, plan, age: 0, life: INKS[plan.ink].life, born: performance.now(), bornT: g.time, boxes: [], group: null, grow: 0, fade: -1 };
    if (plan.type === 'wall') this.makeWall(it, plan);
    else if (plan.type === 'strip') this.makeStrip(it, plan);
    else if (plan.type === 'pad') this.makePad(it, plan);
    else if (plan.type === 'ramp') this.makeRamp(it, plan);
    else if (plan.type === 'bridge') this.makeBridge(it, plan);
    else if (plan.type === 'cage') this.makeCage(it, plan);
    else if (plan.type === 'ladder') {
      const G = g.gadgets;
      it.gadget = G.build('ladder', 'good', plan.s);
      // (ours, not the gadgets' own three: it goes when its time is up)
      const k = G.placed.indexOf(it.gadget);
      if (k >= 0) G.placed.splice(k, 1);
      it.group = it.gadget.group;
      it.life = 50;
    }
    if (it.group && it.type !== 'ladder') {
      it.group.matrixAutoUpdate = true;
      it.group.scale.set(1, 0.01, 1);
      g.scene.add(it.group);
    }
    this.list.push(it);
    this.bounds(it);
    this.stats.drawn++;
    this.stats[it.type] = (this.stats[it.type] || 0) + 1;
    this.rebuildBlocks();
    // (the ways round it, for the police and the people on foot: once they have seen it)
    it.navT = g.time + SURPRISE;
    // (too many: the oldest goes)
    while (this.list.filter((o) => o.fade < 0).length > MAX_LIVE) {
      const old = this.list.find((o) => o.fade < 0);
      if (!old) break;
      this.startFade(old);
    }
    // the sound and the puff of it coming into the world
    const c = this.centre(it);
    g.fx.crumbs(c.x, c.y + 0.4, c.z, 14, 2.5);
    g.audio.play(plan.ink === 'rubber' ? 'rubber' : plan.ink === 'glue' ? 'glue' : plan.ink === 'ice' ? 'magic' : 'plop', 0.7);
    return it;
  }

  centre(it) {
    const p = it.plan;
    if (p.type === 'wall' || p.type === 'strip') return _w.set(p.pts[0][0], p.pts[0][1], p.pts[0][2]);
    if (p.type === 'bridge') return _w.set((p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, (p.a[2] + p.b[2]) / 2);
    if (p.type === 'cage') {
      const t = p.targets[0].o.pos;
      return _w.set(t.x, t.y || 0, t.z);
    }
    if (p.type === 'ladder') return _w.set(p.s.x, p.s.y, p.s.z);
    return _w.set(p.x, p.y || 0, p.z);
  }

  // (feel: which of the city's cars are near enough a drawn thing to test) where its boxes are
  bounds(it) {
    const col = this.game.world.collision;
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    let low = false;
    for (const id of it.boxes) {
      const b = col.boxes[id];
      if (!b) continue;
      x0 = Math.min(x0, b.x0);
      z0 = Math.min(z0, b.z0);
      x1 = Math.max(x1, b.x1);
      z1 = Math.max(z1, b.z1);
      // (only what stands in the street's way: not a bridge high over it)
      if (b.y0 < 1.2 && b.y1 > 0.4) low = true;
    }
    it.bb = low && x0 < x1 ? [x0, z0, x1, z1] : null;
  }

  // (game/chase.js, game/traffic.js) a box of a drawn thing so new the drivers have not seen it
  unseen(b) {
    return !!b && b.tag === 'ink' && !!b.data && this.game.time - b.data.it.bornT < SURPRISE;
  }

  // a box in the world for a drawn thing (what stops a walker, a car, a bullet). step: one of the
  // steps a walker goes up a ramp or a bridge on (a car rides those by their height instead)
  box(it, x0, z0, x1, z1, y0, y1, step = false) {
    const id = this.game.world.collision.addBox(x0, z0, x1, z1, y0, y1, 'ink', { ink: it.ink, it, bouncy: it.ink === 'rubber' && !step, step });
    it.boxes.push(id);
    return id;
  }

  makeWall(it, p) {
    const I = INKS[p.ink];
    const M = itemMats();
    const mat = M[I.mat];
    const H = WALL_H[p.ink] || 2.6;
    const T = WALL_T[p.ink] || 0.36;
    const o = p.pts[0];
    const K = new Kit();
    const base = Math.min(...p.pts.map((q) => q[1]));
    it.base = base;
    for (let i = 1; i < p.pts.length; i++) {
      const a = p.pts[i - 1];
      const b = p.pts[i];
      const dx = b[0] - a[0];
      const dz = b[2] - a[2];
      const L = Math.hypot(dx, dz);
      if (L < 0.02) continue;
      const g = new THREE.BoxGeometry(T, H, L + T * 0.3);
      g.rotateY(Math.atan2(dx, dz));
      g.translate((a[0] + b[0]) / 2 - o[0], base + H / 2 - o[1], (a[2] + b[2]) / 2 - o[2]);
      K.add(mat, g, I.color);
      // the top's own ink, darker, a finger over it
      const t = new THREE.BoxGeometry(T * 1.12, 0.12, L + T * 0.3);
      t.rotateY(Math.atan2(dx, dz));
      t.translate((a[0] + b[0]) / 2 - o[0], base + H + 0.04 - o[1], (a[2] + b[2]) / 2 - o[2]);
      K.add(mat, t, I.dark);
      // the boxes it stands in the world as: no piece longer than half a metre
      const n = Math.max(1, Math.ceil(L / 0.5));
      for (let k = 0; k < n; k++) {
        const ax = a[0] + (dx * k) / n;
        const az = a[2] + (dz * k) / n;
        const bx = a[0] + (dx * (k + 1)) / n;
        const bz = a[2] + (dz * (k + 1)) / n;
        this.box(it, Math.min(ax, bx) - T / 2, Math.min(az, bz) - T / 2, Math.max(ax, bx) + T / 2, Math.max(az, bz) + T / 2, base - 0.2, base + H);
      }
    }
    // round posts at its ends and its turns, so it stands whole
    for (const q of p.pts) K.cyl(mat, T * 0.62, T * 0.62, 0, H + 0.1, I.dark, { axis: 'y', x: q[0] - o[0], z: q[2] - o[2], segs: 8 });
    const group = K.build({ seed: (it.id * 0.37) % 1 });
    group.position.set(o[0], o[1], o[2]);
    it.group = group;
    it.lineW = T;
  }

  makeStrip(it, p) {
    const I = INKS[p.ink];
    const M = itemMats();
    const mat = M[I.mat];
    const o = p.pts[0];
    const K = new Kit();
    for (let i = 1; i < p.pts.length; i++) {
      const a = p.pts[i - 1];
      const b = p.pts[i];
      const dx = b[0] - a[0];
      const dz = b[2] - a[2];
      const L = Math.hypot(dx, dz);
      if (L < 0.02) continue;
      const g = new THREE.BoxGeometry(p.w, 0.05, L + p.w * 0.5);
      g.rotateY(Math.atan2(dx, dz));
      g.translate((a[0] + b[0]) / 2 - o[0], Math.max(a[1], b[1]) + 0.025 - o[1], (a[2] + b[2]) / 2 - o[2]);
      K.add(mat, g, I.color);
    }
    // (glue: a few drops of it along the line)
    if (p.ink === 'glue') for (let i = 0; i < p.pts.length; i += 2) K.sphere(mat, 0.22, p.pts[i][0] - o[0], p.pts[i][1] + 0.06 - o[1], p.pts[i][2] - o[2], I.dark, 1, 0.35, 1, 8);
    const group = K.build({ seed: (it.id * 0.37) % 1 });
    group.position.set(o[0], o[1], o[2]);
    it.group = group;
    it.area = { line: p.pts, r: p.w / 2 };
  }

  makePad(it, p) {
    const I = INKS[p.ink];
    const M = itemMats();
    const mat = M[I.mat];
    const K = new Kit();
    if (p.kind === 'pillar') {
      K.cyl(mat, p.r, p.r, 0, p.h, I.color, { axis: 'y', segs: 10 });
      K.cyl(M.matte, p.r * 1.06, p.r * 1.06, p.h - 0.12, p.h + 0.04, I.dark, { axis: 'y', segs: 10 });
      // (rings round it, drawn one over the other as it went up)
      for (let y = 0.9; y < p.h - 0.4; y += 1.3) K.cyl(M.matte, p.r * 1.03, p.r * 1.03, y, y + 0.07, I.dark, { axis: 'y', segs: 10 });
      const s = p.r * 0.86;
      it.lift = this.box(it, p.x - s, p.z - s, p.x + s, p.z + s, p.y - 0.2, p.y + 0.05);
      it.rise = 0;
      it.blocksR = p.r + 0.4;
      this.decks.push((it.deck = { kind: 'disc', x: p.x, z: p.z, r: p.r * 0.92, y: p.y + 0.05, it }));
    } else if (p.kind === 'tramp') {
      // a ring on legs, the rubber stretched over it
      K.torus(mat, p.r, 0.12, 0, p.h, 0, I.dark, Math.PI / 2, 0);
      K.cyl(mat, p.r * 0.98, p.r * 0.98, p.h - 0.08, p.h - 0.02, I.color, { axis: 'y', segs: 18 });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        K.cyl(M.matte, 0.06, 0.06, 0, p.h, I.dark, { axis: 'y', x: Math.cos(a) * p.r * 0.9, z: Math.sin(a) * p.r * 0.9, segs: 6 });
      }
      const s = p.r * 0.8;
      this.box(it, p.x - s, p.z - s, p.x + s, p.z + s, p.y - 0.2, p.y + p.h - 0.05);
      it.tramp = { x: p.x, z: p.z, r: p.r, top: p.y + p.h - 0.05, n: 0, at: -9 };
      it.blocksR = p.r + 0.3;
      this.decks.push((it.deck = { kind: 'disc', x: p.x, z: p.z, r: p.r * 0.92, y: p.y + p.h - 0.05, it, bounce: true }));
    } else {
      // a slick of ice, a puddle of glue: flat on the ground
      K.cyl(mat, p.r, p.r, 0, 0.05, I.color, { axis: 'y', segs: 20 });
      K.cyl(mat, p.r * 0.6, p.r * 0.6, 0.05, 0.07, I.dark, { axis: 'y', segs: 14 });
      it.area = { disc: [p.x, p.z], r: p.r };
    }
    const group = K.build({ seed: (it.id * 0.37) % 1 });
    group.position.set(p.x, p.y, p.z);
    it.group = group;
  }

  makeRamp(it, p) {
    const I = INKS[p.ink];
    const M = itemMats();
    const mat = M[I.mat];
    const K = new Kit();
    const slope = Math.atan2(p.h, p.len);
    const plank = Math.hypot(p.h, p.len);
    // the plank, up its length; stripes of the ink's darker shade; the trestle under its high end
    const g = new THREE.BoxGeometry(p.w, 0.16, plank);
    g.rotateX(-slope);
    g.translate(0, p.h / 2 + 0.08, p.len / 2);
    K.add(mat, g, I.color);
    for (const u of [0.25, 0.55, 0.85]) {
      const s = new THREE.BoxGeometry(p.w * 0.94, 0.03, 0.3);
      s.rotateX(-slope);
      s.translate(0, p.h * u + 0.17, p.len * u);
      K.add(mat, s, I.dark);
    }
    for (const x of [-1, 1]) {
      K.box(M.matte, x * (p.w / 2 - 0.25) - 0.1, 0, p.len - 0.32, x * (p.w / 2 - 0.25) + 0.1, p.h, p.len - 0.12, I.dark);
      K.box(M.matte, x * (p.w / 2 - 0.25) - 0.08, 0, p.len * 0.5 - 0.08, x * (p.w / 2 - 0.25) + 0.08, p.h * 0.5, p.len * 0.5 + 0.08, I.dark);
    }
    const group = K.build({ seed: (it.id * 0.37) % 1 });
    group.position.set(p.x, p.y, p.z);
    group.rotation.set(0, p.yaw, 0);
    it.group = group;
    // the cars ride it (game/vehicles.js rampAt); a walker goes up it in short steps
    const R = { x: p.x, z: p.z, yaw: p.yaw, len: p.len, w: p.w, h: p.h, drawn: true, ink: p.ink, it };
    RAMPS.push(R);
    it.ramp = R;
    const fx = Math.sin(p.yaw);
    const fz = Math.cos(p.yaw);
    const rx = fz;
    const rz = -fx;
    const n = Math.ceil(p.len / 0.45);
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * p.len;
      const a1 = ((k + 1) / n) * p.len;
      const y1 = p.y + (a1 / p.len) * p.h;
      // (as narrow as it is wide only when it runs along the city's grid: else in two halves)
      for (const [s0, s1] of [[-p.w / 2, 0], [0, p.w / 2]]) {
        const xs = [p.x + fx * a0 + rx * s0, p.x + fx * a1 + rx * s0, p.x + fx * a0 + rx * s1, p.x + fx * a1 + rx * s1];
        const zs = [p.z + fz * a0 + rz * s0, p.z + fz * a1 + rz * s0, p.z + fz * a0 + rz * s1, p.z + fz * a1 + rz * s1];
        this.box(it, Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), p.y - 0.3, y1, true);
      }
    }
    it.blocksR = 2.2;
  }

  makeBridge(it, p) {
    const I = INKS[p.ink];
    const M = itemMats();
    const mat = M[I.mat];
    const K = new Kit();
    const [ax, ay, az] = p.a;
    const [bx, by, bz] = p.b;
    const dx = bx - ax;
    const dz = bz - az;
    const D = Math.hypot(dx, dz);
    const dy = by - ay;
    const yaw = Math.atan2(dx, dz);
    const slope = Math.atan2(dy, D);
    const L = Math.hypot(D, dy);
    // in its own frame: from a along z, up by dy over D
    if (p.steps) {
      const n = Math.max(3, Math.round(Math.abs(dy) / 0.3));
      for (let k = 0; k < n; k++) {
        const z0 = (k / n) * D;
        const z1 = ((k + 1) / n) * D;
        const y1 = (dy * (k + 1)) / n;
        const yb = dy > 0 ? (dy * k) / n - 0.25 : y1 - 0.25;
        K.box(mat, -p.w / 2, Math.min(yb, y1 - 0.25), z0, p.w / 2, y1, z1 + 0.02, k % 2 ? I.color : I.dark);
      }
    } else {
      const g = new THREE.BoxGeometry(p.w, 0.18, L + 0.3);
      g.rotateX(-slope);
      g.translate(0, dy / 2 - 0.09, D / 2);
      K.add(mat, g, I.color);
      // planks across it, every half metre
      const n = Math.max(2, Math.floor(L / 0.5));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        K.box(mat, -p.w / 2 - 0.02, dy * t - 0.01, D * t - 0.05, p.w / 2 + 0.02, dy * t + 0.03, D * t + 0.05, I.dark);
      }
    }
    // a rail either side, on posts (a walker's bridge; a car's has a kerb)
    const railH = p.w > 3 ? 0.35 : 1.0;
    for (const s of [-1, 1]) {
      const x = s * (p.w / 2 - 0.06);
      const r = new THREE.BoxGeometry(0.09, 0.09, L);
      r.rotateX(-slope);
      r.translate(x, dy / 2 + railH, D / 2);
      K.add(M.matte, r, I.dark);
      const posts = Math.max(2, Math.round(L / 1.6));
      for (let k = 0; k <= posts; k++) {
        const t = k / posts;
        K.box(M.matte, x - 0.05, dy * t, D * t - 0.05, x + 0.05, dy * t + railH, D * t + 0.05, I.dark);
      }
    }
    const group = K.build({ seed: (it.id * 0.37) % 1 });
    group.position.set(ax, ay, az);
    group.rotation.set(0, yaw, 0);
    it.group = group;
    // the deck to walk on, in short lengths up its slope
    const fx = dx / D;
    const fz = dz / D;
    const rx = fz;
    const rz = -fx;
    // (stairs in shorter steps: no step higher than a foot goes up)
    const n = Math.max(1, Math.ceil(D / (p.steps ? 0.3 : 0.45)));
    for (let k = 0; k < n; k++) {
      const t0 = k / n;
      const t1 = (k + 1) / n;
      const y = ay + dy * t1;
      for (const [s0, s1] of [[-p.w / 2, 0], [0, p.w / 2]]) {
        const xs = [ax + dx * t0 + rx * s0, ax + dx * t1 + rx * s0, ax + dx * t0 + rx * s1, ax + dx * t1 + rx * s1];
        const zs = [az + dz * t0 + rz * s0, az + dz * t1 + rz * s0, az + dz * t0 + rz * s1, az + dz * t1 + rz * s1];
        this.box(it, Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), y - 0.3, y, true);
      }
      // its rails (a car's bridge: a kerb that keeps the wheels on it)
      const rh = p.w > 3 ? 0.55 : 1.05;
      for (const s of [-1, 1]) {
        const c0 = s * (p.w / 2 - 0.02);
        const c1 = s * (p.w / 2 + 0.1);
        const xs = [ax + dx * t0 + rx * c0, ax + dx * t1 + rx * c0, ax + dx * t0 + rx * c1, ax + dx * t1 + rx * c1];
        const zs = [az + dz * t0 + rz * c0, az + dz * t1 + rz * c0, az + dz * t0 + rz * c1, az + dz * t1 + rz * c1];
        this.box(it, Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), y - 0.05, y + rh);
      }
    }
    // (and to drive on: game/vehicles.js asks deckAt)
    this.decks.push((it.deck = { kind: 'line', ax, ay, az, bx, by, bz, w: p.w, it }));
    it.bridge = { ax, az, bx, bz, ay, by };
  }

  makeCage(it, p) {
    const I = INKS[p.ink];
    const M = itemMats();
    const mat = M[I.mat];
    const g = this.game;
    const K = new Kit();
    const o = p.targets[0].o.pos;
    const ox = o.x;
    const oz = o.z;
    const oy = groundHeight(ox, oz);
    const hold = HOLD[p.ink] || 10;
    it.life = hold;
    it.holds = [];
    for (const T of p.targets) {
      const t = T.o;
      const car = T.kind === 'car';
      const R = car ? Math.max(2.4, (t.halfLen || 2.3) + 0.5) : 0.78;
      const H = car ? 2.4 : 2.3;
      const cx = t.pos.x - ox;
      const cz = t.pos.z - oz;
      const y0 = groundHeight(t.pos.x, t.pos.z) - oy;
      if (p.ink === 'pencil') {
        const bars = car ? 16 : 10;
        for (let k = 0; k < bars; k++) {
          const a = (k / bars) * Math.PI * 2;
          K.cyl(mat, 0.05, 0.05, y0, y0 + H, I.color, { axis: 'y', x: cx + Math.cos(a) * R, z: cz + Math.sin(a) * R, segs: 6 });
        }
        for (const yy of [0.06, H * 0.5, H]) K.torus(mat, R, 0.07, cx, y0 + yy, cz, I.dark, Math.PI / 2, 0);
        // (what stops whoever is inside: bars a hand apart)
        const nb = car ? 14 : 8;
        for (let k = 0; k < nb; k++) {
          const a = (k / nb) * Math.PI * 2;
          const bx = t.pos.x + Math.cos(a) * R;
          const bz = t.pos.z + Math.sin(a) * R;
          this.box(it, bx - 0.12, bz - 0.12, bx + 0.12, bz + 0.12, oy + y0 - 0.2, oy + y0 + H);
        }
      } else if (p.ink === 'ice') {
        K.box(mat, cx - R, y0, cz - R, cx + R, y0 + H * 0.9, cz + R, I.color);
        K.box(mat, cx - R * 0.7, y0 + H * 0.9, cz - R * 0.7, cx + R * 0.7, y0 + H, cz + R * 0.7, I.dark);
      } else if (p.ink === 'glue') {
        K.cyl(mat, R * 1.1, R * 1.1, y0, y0 + 0.06, I.color, { axis: 'y', x: cx, z: cz, segs: 14 });
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + 0.4;
          K.cyl(mat, 0.07, 0.03, y0, y0 + (car ? 1.0 : 0.8), I.dark, { axis: 'y', x: cx + Math.cos(a) * R * 0.55, z: cz + Math.sin(a) * R * 0.55, segs: 6 });
        }
      } else {
        // rubber: a bubble round them
        K.sphere(mat, car ? R * 0.95 : 1.05, cx, y0 + (car ? 1.0 : 1.0), cz, I.color, 1, car ? 0.62 : 1, 1, 18);
      }
      it.holds.push({ T, until: hold });
      if (car) {
        // the car stops where it is (and its police, if any, are out of the chase)
        t.inkHold = hold;
        t.speed = 0;
      } else {
        t.glueT = Math.max(t.glueT || 0, p.ink === 'pencil' ? 0.6 : hold);
      }
    }
    const group = K.build({ seed: (it.id * 0.37) % 1 });
    group.position.set(ox, oy, oz);
    it.group = group;
    this.done.caged = true;
    this.note('caged');
    void g;
  }

  // the police and the people will find their ways round it (enemies' paths, game/enemies.js)
  navAround(it) {
    const nav = this.game.world.nav;
    if (!nav || !it.boxes.length) return;
    const col = this.game.world.collision;
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (const id of it.boxes) {
      const b = col.boxes[id];
      if (!b) continue;
      x0 = Math.min(x0, b.x0);
      z0 = Math.min(z0, b.z0);
      x1 = Math.max(x1, b.x1);
      z1 = Math.max(z1, b.z1);
    }
    if (x0 < x1) nav.refresh(x0 - 1, z0 - 1, x1 + 1, z1 + 1);
  }

  // (game/traffic.js) where the drawn things stand in the road, for the drivers to stop short of
  rebuildBlocks() {
    const B = (this.blocks = []);
    for (const it of this.list) {
      if (it.fade >= 0) continue;
      const p = it.plan;
      if (it.type === 'wall') {
        const L = pathLen(p.pts);
        const n = Math.max(1, Math.ceil(L / 1.6));
        for (let k = 0; k <= n; k++) {
          const q = this.along(p.pts, (k / n) * L);
          B.push({ x: q[0], z: q[2], r: 1.2, t: it.bornT });
        }
      } else if (it.type === 'pad' && it.blocksR) B.push({ x: p.x, z: p.z, r: it.blocksR, t: it.bornT });
      else if (it.type === 'ramp') {
        const fx = Math.sin(p.yaw);
        const fz = Math.cos(p.yaw);
        B.push({ x: p.x + fx * p.len * 0.5, z: p.z + fz * p.len * 0.5, r: 2.2, t: it.bornT });
      }
    }
  }

  along(pts, s) {
    for (let i = 1; i < pts.length; i++) {
      const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
      if (s <= L || i === pts.length - 1) {
        const t = L > 0 ? clamp(s / L, 0, 1) : 0;
        return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1], pts[i - 1][2] + (pts[i][2] - pts[i - 1][2]) * t];
      }
      s -= L;
    }
    return pts[pts.length - 1];
  }

  // ------------------------------------------------------------------ going
  startFade(it) {
    if (it.fade >= 0) return;
    it.fade = 0;
    const g = this.game;
    const col = g.world.collision;
    for (const id of it.boxes) col.remove(id);
    this.navAround(it);
    if (it.ramp) {
      const k = RAMPS.indexOf(it.ramp);
      if (k >= 0) RAMPS.splice(k, 1);
    }
    if (it.deck) {
      const k = this.decks.indexOf(it.deck);
      if (k >= 0) this.decks.splice(k, 1);
    }
    if (it.holds) {
      for (const h of it.holds) {
        const t = h.T.o;
        if (h.T.kind === 'car') t.inkHold = 0;
        else if (it.ink !== 'pencil') t.glueT = Math.min(t.glueT || 0, 0.2);
        // (a rubber bubble pops: whoever was in it hops)
        if (it.ink === 'rubber' && h.T.kind !== 'car' && t.vel) t.vel.y = 4;
      }
    }
    it.boxes = [];
    this.rebuildBlocks();
    const c = this.centre(it);
    g.fx.crumbs(c.x, c.y + 0.5, c.z, 16, 3);
    g.audio.play(it.ink === 'ice' ? 'poof' : 'erase', 0.35);
  }

  dispose(it) {
    const g = this.game;
    if (it.gadget) {
      g.gadgets.placed.push(it.gadget);
      g.gadgets.remove(it.gadget, false);
    } else if (it.group) {
      g.scene.remove(it.group);
      it.group.traverse((m) => m.geometry && m.geometry.dispose());
    }
  }

  // the last one drawn, taken back (Backspace in the pen): half its ink back
  undo() {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const it = this.list[i];
      if (it.fade < 0) {
        this.startFade(it);
        if (this.game.ink) this.game.ink.fill((it.plan.cost || 0) * 0.5);
        return true;
      }
    }
    return false;
  }

  clear() {
    for (const it of this.list) {
      this.startFade(it);
      this.dispose(it);
    }
    this.list = [];
    this.blocks = [];
    this.decks = [];
  }

  // ------------------------------------------------------------------ the world on it
  // (game/vehicles.js drive) the highest deck under a car at (x, z) no higher than its wheels can
  // climb to from y: a bridge's, a pillar's top (-Infinity: none)
  deckAt(x, z, y) {
    let best = -Infinity;
    for (const d of this.decks) {
      let h;
      if (d.kind === 'disc') {
        if (Math.hypot(x - d.x, z - d.z) > d.r) continue;
        h = d.y;
      } else {
        const dx = d.bx - d.ax;
        const dz = d.bz - d.az;
        const L2 = dx * dx + dz * dz || 1e-9;
        const t = ((x - d.ax) * dx + (z - d.az) * dz) / L2;
        if (t < -0.02 || t > 1.02) continue;
        const across = Math.abs((x - d.ax) * dz - (z - d.az) * dx) / Math.sqrt(L2);
        if (across > d.w / 2) continue;
        h = d.ay + (d.by - d.ay) * clamp(t, 0, 1);
      }
      if (h <= y + 0.9 && h > best) best = h;
    }
    return best;
  }

  // (game/vehicles.js collideWorld) a car into a drawn wall: true when it is handled here (rubber
  // throws it back, unhurt)
  vehicleHit(v, res) {
    const d = res.box && res.box.data;
    if (!d || !d.bouncy) return false;
    const nx = res.nx;
    const nz = res.nz;
    const vx = v.vx !== undefined ? v.vx : Math.sin(v.yaw) * v.speed;
    const vz = v.vz !== undefined ? v.vz : Math.cos(v.yaw) * v.speed;
    const into = vx * nx + vz * nz;
    if (into >= 0) return true;
    // (reflected, a little lost; a spin of the tyres. game/vehicles.js drive takes it as it is)
    const k = 1.75;
    const bx = vx - nx * into * k;
    const bz = vz - nz * into * k;
    v.bounceV = [bx, bz];
    v.vx = bx;
    v.vz = bz;
    v.speed = (bx * Math.sin(v.yaw) + bz * Math.cos(v.yaw)) * 0.9;
    v.spinT = Math.max(v.spinT || 0, 0.35);
    if (-into > 4 && this.game.time - (this.bounceAt || 0) > 0.3) {
      this.bounceAt = this.game.time;
      this.game.audio.play('rubber', Math.min(1, -into / 18));
      this.game.camRig.addShake(0.15);
      this.stats.bounces++;
    }
    return true;
  }

  // which drawn thing's flat area (a slick, a line of glue) is under (x, z), and its ink
  areaAt(x, z, y) {
    for (const it of this.list) {
      const A = it.area;
      if (!A || it.fade >= 0) continue;
      const py = it.type === 'pad' ? it.plan.y : it.plan.pts[0][1];
      if (Math.abs(y - py) > 1.2) continue;
      if (A.disc) {
        if (Math.hypot(x - A.disc[0], z - A.disc[1]) < A.r) return it;
      } else if (distToLine(x, z, A.line) < A.r) return it;
    }
    return null;
  }

  note(what) {
    if (this.onDone) this.onDone(what);
  }

  update(dt) {
    if (!this.list.length) {
      this.vRamp = null;
      return;
    }
    const g = this.game;
    const now = performance.now();
    let gone = false;
    for (const it of this.list) {
      // coming into the world (real time: as quick in the pen's slow time as out of it)
      if (it.grow < 1 && it.group && it.type !== 'ladder') {
        it.grow = Math.min(1, (now - it.born) / 280);
        const k = it.grow - 1;
        const s = Math.max(0.01, 1 + 2.4 * k * k * k + 1.4 * k * k);
        if (it.type === 'wall' || it.type === 'pad' || it.type === 'cage') it.group.scale.set(1, s, 1);
        else it.group.scale.setScalar(Math.min(1, 0.2 + it.grow * 0.8));
      }
      if (it.fade >= 0) {
        it.fade += dt > 0 ? Math.max(dt, 0.016) : 0.016;
        if (it.group && it.type !== 'ladder') it.group.scale.set(Math.max(0.01, 1 - it.fade * 1.4), Math.max(0.01, 1 - it.fade * 1.6), Math.max(0.01, 1 - it.fade * 1.4));
        if (it.fade > 0.65) {
          this.dispose(it);
          it.dead = true;
          gone = true;
        }
        continue;
      }
      it.age += dt;
      if (it.age > it.life) {
        this.startFade(it);
        continue;
      }
      if (it.navT && g.time >= it.navT) {
        it.navT = 0;
        this.navAround(it);
      }
      // a pillar rising (in the game's own time: slow in the pen)
      if (it.lift !== undefined && it.rise < 1) {
        it.rise = Math.min(1, it.rise + dt / 1.6);
        const p = it.plan;
        const e = 1 - Math.pow(1 - it.rise, 2);
        const top = p.y + 0.05 + p.h * e;
        const b = g.world.collision.boxes[it.lift];
        if (b) b.y1 = top;
        if (it.deck) it.deck.y = top;
        if (it.group) it.group.scale.set(1, Math.max(0.01, e), 1);
        it.grow = 1;
      }
      // what holds somebody: let go when its time is up
      if (it.holds) for (const h of it.holds) if (h.T.kind === 'car') h.T.o.speed = 0;
    }
    if (gone) this.list = this.list.filter((it) => !it.dead);
    this.feel(dt);
  }

  // what the drawn things do to you, your car, the cars and the people on them
  feel(dt) {
    if (dt <= 0) return;
    const g = this.game;
    const P = g.player;
    // (up a drawn ladder: game/climb.js. On the roof, that counts as up by what was drawn)
    const on = g.climb && g.climb.on;
    if (on && this.list.some((it) => it.gadget && it.gadget.route === on.route)) this.lastInkUp = g.time;
    // on foot: a trampoline throws you up; ice under you and you slide; glue holds you
    if (P.mode === 'foot' && !P.inVehicle) {
      for (const it of this.list) {
        const T = it.tramp;
        if (!T || it.fade >= 0) continue;
        if (Math.hypot(P.pos.x - T.x, P.pos.z - T.z) < T.r * 0.85 && Math.abs(P.pos.y - T.top) < 0.25 && P.vel.y <= 0.5) {
          // (straight back down onto it: a bounce higher than the last)
          T.n = g.time - (T.at || -9) < 2.6 ? Math.min(TRAMP_V.length - 1, T.n + 1) : 0;
          T.at = g.time;
          P.vel.y = TRAMP_V[T.n];
          P.onGround = false;
          P.pos.y = T.top + 0.05;
          g.audio.play('rubber', 0.6 + T.n * 0.15);
          g.audio.play('jump', 0.5);
          this.stats.bounces++;
          this.lastInkUp = g.time;
        }
      }
      const a = this.areaAt(P.pos.x, P.pos.z, P.pos.y);
      if (a && a.ink === 'glue') {
        P.vel.x *= Math.exp(-14 * dt);
        P.vel.z *= Math.exp(-14 * dt);
        if (P.vel.y > 0) P.vel.y = 0;
        if (!this.stuckSaid || g.time - this.stuckSaid > 6) {
          this.stuckSaid = g.time;
          g.hud.toast('נדבקתם! זה יתייבש בעוד רגע', 'info', 1.6);
        }
      } else if (a && a.ink === 'ice') {
        // (the step's own push hardly holds: what you were doing goes on)
        const pv = this.pv || (this.pv = { x: 0, z: 0 });
        const kx = pv.x + (P.vel.x - pv.x) * 0.08;
        const kz = pv.z + (P.vel.z - pv.z) * 0.08;
        P.pos.x += (kx - P.vel.x) * dt;
        P.pos.z += (kz - P.vel.z) * dt;
        P.vel.x = kx;
        P.vel.z = kz;
      }
      const pv = this.pv || (this.pv = { x: 0, z: 0 });
      pv.x = P.vel.x;
      pv.z = P.vel.z;
      // up high on something drawn
      if (!this.done.up && P.onGround && P.pos.y > 4.5) {
        const f = g.world.collision.pointInside(P.pos.x, P.pos.y - 0.15, P.pos.z, 0.25);
        if (f && f.tag === 'ink') {
          this.done.up = true;
          this.note('up');
        } else if (this.lastInkUp && g.time - this.lastInkUp < 4) {
          this.done.up = true;
          this.note('up');
        }
      }
      // (walked across a bridge: from one end to the other)
      for (const it of this.list) {
        const B = it.bridge;
        if (!B || it.fade >= 0 || this.done.bridge) continue;
        const dx = B.bx - B.ax;
        const dz = B.bz - B.az;
        const L2 = dx * dx + dz * dz || 1;
        const t = ((P.pos.x - B.ax) * dx + (P.pos.z - B.az) * dz) / L2;
        const across = Math.abs((P.pos.x - B.ax) * dz - (P.pos.z - B.az) * dx) / Math.sqrt(L2);
        if (across < it.plan.w / 2 + 0.3) {
          if (t < 0.2) it.crossFrom = it.crossFrom || 'a';
          if (t > 0.8) it.crossFrom = it.crossFrom || 'b';
          if ((it.crossFrom === 'a' && t > 0.9) || (it.crossFrom === 'b' && t < 0.1)) {
            this.done.bridge = true;
            this.note('bridge');
            if (Math.max(B.ay, B.by) > 3) this.lastInkUp = g.time;
          }
        }
      }
      for (const it of this.list) if (it.lift !== undefined && it.fade < 0 && Math.hypot(P.pos.x - it.plan.x, P.pos.z - it.plan.z) < it.plan.r && P.pos.y > it.plan.y + 2) this.lastInkUp = g.time;
    }
    // your car on ice slides, in glue it is held; off a rubber ramp it flies higher
    const v = P.inVehicle;
    if (v && !v.dead && !v.flies) {
      const a = this.areaAt(v.pos.x, v.pos.z, v.pos.y || 0);
      if (a && a.ink === 'ice') v.spinT = Math.max(v.spinT || 0, 0.2);
      else if (a && a.ink === 'glue') {
        const k = Math.exp(-5 * dt);
        if (v.vx !== undefined) {
          v.vx *= k;
          v.vz *= k;
        }
        v.speed *= k;
      }
      let onRamp = null;
      for (const R of RAMPS) {
        if (!R.it) continue;
        const dx = v.pos.x - R.x;
        const dz = v.pos.z - R.z;
        const fx = Math.sin(R.yaw);
        const fz = Math.cos(R.yaw);
        const al = dx * fx + dz * fz;
        if (al >= 0 && al <= R.len && Math.abs(-dx * fz + dz * fx) <= R.w / 2) onRamp = R;
      }
      if (onRamp) this.vRamp = onRamp;
      else if (this.vRamp && v.air) {
        // off the end of a drawn ramp: flying (and higher off a rubber one)
        if (this.vRamp.ink === 'rubber') {
          v.vy = (v.vy || 0) + 7;
          this.game.audio.play('rubber', 0.7);
        }
        if (Math.abs(v.speed) > 8) {
          this.done.rampJump = true;
          this.note('rampJump');
        }
        this.vRamp = null;
      } else if (!v.air) this.vRamp = null;
      // a rubber trampoline under a car: up it goes
      for (const it of this.list) {
        const T = it.tramp;
        if (!T || it.fade >= 0 || v.air) continue;
        if (Math.hypot(v.pos.x - T.x, v.pos.z - T.z) < T.r && Math.abs(v.pos.y - T.top) < 0.4) {
          v.air = true;
          v.vy = 13;
          this.game.audio.play('rubber', 0.9);
        }
      }
      // driven across a bridge
      if (!this.done.bridge) {
        for (const it of this.list) {
          const B = it.bridge;
          if (!B || it.fade >= 0) continue;
          const dx = B.bx - B.ax;
          const dz = B.bz - B.az;
          const L2 = dx * dx + dz * dz || 1;
          const t = ((v.pos.x - B.ax) * dx + (v.pos.z - B.az) * dz) / L2;
          const across = Math.abs((v.pos.x - B.ax) * dz - (v.pos.z - B.az) * dx) / Math.sqrt(L2);
          if (across < it.plan.w / 2 + 0.5 && t > 0.4 && t < 0.6 && Math.abs((v.pos.y || 0) - (B.ay + (B.by - B.ay) * t)) < 0.6) {
            this.done.bridge = true;
            this.note('bridge');
          }
        }
      }
    }
    // the city's cars: into a wall at speed they crash (into rubber: thrown back); on ice they spin
    // out; in glue they stop; caged, they wait
    const cars = g.traffic.list;
    const col = g.world.collision;
    const pp = v ? v.pos : P.pos;
    // (only what stands in the street, and what lies on it, is tested)
    const stand = this.list.filter((it) => it.bb && it.fade < 0);
    const flat = this.list.some((it) => it.area && it.fade < 0);
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (c.poofT !== undefined) continue;
      if (Math.abs(c.pos.x - pp.x) > 90 || Math.abs(c.pos.z - pp.z) > 90) continue;
      if (c.inkHold > 0) {
        c.inkHold -= dt;
        c.speed = 0;
        if (c.path) c.brakeT = Math.max(c.brakeT || 0, 0.3);
        continue;
      }
      if (c.wrecked) continue;
      const sp = Math.abs(c.speed || 0);
      if (sp > 1 && stand.length && this.wallAhead(c, sp, dt, stand, col)) continue;
      // (the ones driving their lanes stop short of a wall: game/traffic.js ahead. A police car
      // stopped behind it counts too)
      if (!this.done.wallStop && sp < 0.5 && c.police && stand.length) {
        for (const B of this.blocks) {
          if (Math.hypot(B.x - c.pos.x, B.z - c.pos.z) < 6.5 + B.r) {
            this.done.wallStop = true;
            this.note('wallStop');
            break;
          }
        }
      }
      if (!flat) continue;
      const a = this.areaAt(c.pos.x, c.pos.z, 0);
      if (!a) continue;
      if (a.ink === 'glue' && sp > 0.5) {
        c.speed *= Math.exp(-6 * dt);
        if (c.path) c.brakeT = Math.max(c.brakeT || 0, 2);
        if (!c.glued) {
          c.glued = true;
          this.stats.stuck++;
          g.audio.play('glue', 0.5);
          if (c.police || c.siren) {
            this.done.wallStop = true;
            this.note('wallStop');
          }
        }
      } else if (a.ink === 'ice' && sp > 5 && !c.iced) {
        c.iced = true;
        this.stats.slips++;
        g.audio.play('skid', 0.7);
        if (!c.path) {
          // (a car out of its lane - after you - spins off the road)
          c.yaw += (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random());
          if (sp > 10) this.crash(c, sp * 0.6);
          if (c.police || c.siren) {
            this.done.wallStop = true;
            this.note('wallStop');
          }
        } else c.brakeT = Math.max(c.brakeT || 0, 3);
      }
    }
    // the people on the ground's slicks and glue
    const people = flat ? [g.enemies.list, g.civilians.list] : [];
    for (const L of people) {
      for (let i = 0; i < L.length; i++) {
        const h = L[i];
        if (h.alive === false || h.inside || h.dying >= 0) continue;
        if (Math.abs(h.pos.x - pp.x) > 60 || Math.abs(h.pos.z - pp.z) > 60) continue;
        const a = this.areaAt(h.pos.x, h.pos.z, h.pos.y || 0);
        if (!a) {
          h.inkOn = null;
          continue;
        }
        if (h.inkOn === a) continue;
        h.inkOn = a;
        if (a.ink === 'glue') {
          h.glueT = Math.max(h.glueT || 0, 5);
          this.stats.stuck++;
        } else {
          // (on the ice: feet out from under them for a moment)
          h.glueT = Math.max(h.glueT || 0, 1.4);
          this.stats.slips++;
          if (g.bubbles && Math.random() < 0.4) g.bubbles.say(h, ['Whoa!', 'Whoa, ice!', 'Slippery!'][Math.floor(Math.random() * 3)]);
        }
      }
    }
  }

  // a city car's nose into a drawn wall (swept along this frame's way: however fast it goes), and
  // what that does to it. True when it met one
  wallAhead(c, sp, dt, stand, col) {
    const s = Math.sign(c.speed || 1);
    const fx = Math.sin(c.yaw) * s;
    const fz = Math.cos(c.yaw) * s;
    const hl = c.halfLen || 2.3;
    const reach = hl + 0.25 + sp * Math.max(dt, 1 / 60);
    let near = false;
    for (let i = 0; i < stand.length && !near; i++) {
      const b = stand[i].bb;
      near = c.pos.x > b[0] - reach - 1 && c.pos.x < b[2] + reach + 1 && c.pos.z > b[1] - reach - 1 && c.pos.z < b[3] + reach + 1;
    }
    if (!near) return false;
    const h = col.raycast(c.pos.x, 0.8, c.pos.z, fx, 0, fz, reach, 'car');
    if (!h || !h.box || h.box.tag !== 'ink') return false;
    const g = this.game;
    // (back to where its nose meets it)
    const back = Math.max(0, hl + 0.05 - h.t);
    c.pos.x -= fx * back;
    c.pos.z -= fz * back;
    if (h.box.data && h.box.data.bouncy) {
      // thrown back off the rubber (one in its lane: back a car's length, and it waits)
      if (c.path) {
        c.s = Math.max(0, (c.s || 0) - 1.2);
        c.speed = 0;
        c.brakeT = Math.max(c.brakeT || 0, 1.2);
      } else {
        c.speed = -c.speed * 0.55;
        c.yaw += (Math.random() - 0.5) * 0.8;
      }
      g.audio.play('rubber', Math.min(1, sp / 16));
      this.stats.bounces++;
    } else if (sp > 6) this.crash(c, sp);
    else {
      c.speed = 0;
      if (c.path) c.brakeT = Math.max(c.brakeT || 0, 0.5);
    }
    if (c.police || c.siren) {
      this.done.wallStop = true;
      this.note('wallStop');
    }
    return true;
  }

  // a city car into a drawn wall at speed: wrecked where it stands
  crash(c, sp) {
    const g = this.game;
    c.wrecked = true;
    c.speed = 0;
    c.siren = false;
    this.stats.crashes++;
    g.fx.sprite('fx_crash', c.pos.x, 1.2, c.pos.z, { size: 2.4, life: 0.45 });
    g.fx.smoke(c.pos.x, 1.4, c.pos.z, 1.6);
    g.audio.play('crash', Math.min(1, sp / 18));
    g.camRig.addShake(Math.min(0.4, sp * 0.02));
    if (c.outT === undefined) c.outT = g.time + 1.2;
  }
}
