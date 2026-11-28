import { NODES } from '../world/roads.js';
import { AVES, STREETS, NORTH_EDGE, SOUTH_EDGE, WEST_EDGE, BLVD } from '../world/layout.js';

// The GPS (ROADMAP 2.2): a destination marked on the city's map, and the way there along the
// roads, drawn on the map and on the minimap. The way is found on the traffic's own plan of the
// roads (world/roads.js): every crossing, plus the ends of the roads past the last crossing (the
// boulevard runs on north and south, the streets west past Coral Ave). A turn costs a little, so
// the way is the simple one (and the same one from moment to moment); it is found again a few
// times a second, so it follows you when you leave it.

const TURN = 14; // metres a turn is worth
const UTURN = 45; // starting the other way from where the car faces
const AGAIN = 0.35; // seconds between new routes
const ARRIVE_FOOT = 9;
const ARRIVE_CAR = 16;

// the plan: the crossings and the roads' ends, joined along the roads
const GN = NODES.map((n) => ({ x: n.x, z: n.z, nb: [] }));
const EDGES = [];
function join(a, b) {
  const len = Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  a.nb.push({ to: b, len });
  b.nb.push({ to: a, len });
  EDGES.push([a, b]);
}
NODES.forEach((n, i) => {
  for (const m of n.nb) if (m.id > n.id) join(GN[i], GN[m.id]);
});
GN.forEach((g, i) => (g.id = i));
{
  const end = (x, z, to) => {
    const g = { id: GN.length, x, z, nb: [] };
    GN.push(g);
    join(g, to);
  };
  const at = (i, j) => GN[j * AVES.length + i];
  // the streets go on west of Coral Ave, the boulevard north and south of the last streets
  for (let j = 0; j < STREETS.length; j++) end(WEST_EDGE - 2, STREETS[j].z, at(0, j));
  const b = AVES.indexOf(BLVD);
  end(BLVD.x, NORTH_EDGE - 55, at(b, 0));
  end(BLVD.x, SOUTH_EDGE + 25, at(b, STREETS.length - 1));
}

// the nearest point on a road: { a, b, x, z, d }
function nearestRoad(x, z) {
  let best = null;
  for (const [a, b] of EDGES) {
    let px;
    let pz;
    if (a.x === b.x) {
      px = a.x;
      pz = Math.min(Math.max(z, Math.min(a.z, b.z)), Math.max(a.z, b.z));
    } else {
      pz = a.z;
      px = Math.min(Math.max(x, Math.min(a.x, b.x)), Math.max(a.x, b.x));
    }
    const d = Math.hypot(px - x, pz - z);
    if (!best || d < best.d) best = { a, b, x: px, z: pz, d };
  }
  return best;
}

// (the search's own arrays, made once: a node reached going each of the four ways)
const COST = new Float64Array(GN.length * 4);
const PREV = new Int32Array(GN.length * 4);
const DONE = new Uint8Array(GN.length * 4);

function dirOf(ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 0 : 1;
  return dz >= 0 ? 2 : 3;
}
function turnCost(d0, d1) {
  if (d0 < 0 || d0 === d1) return 0;
  // (0/1 and 2/3 are opposite ways)
  return (d0 >> 1) === (d1 >> 1) ? UTURN : TURN;
}

// the way from (x0, z0) to (x1, z1) along the roads; head: the way the car faces (or null)
export function findRoute(x0, z0, x1, z1, head = null) {
  const S = nearestRoad(x0, z0);
  const E = nearestRoad(x1, z1);
  if (!S || !E) return null;
  const n = GN.length;
  const cost = COST.fill(Infinity);
  const prev = PREV.fill(-1);
  const done = DONE.fill(0);
  const hd = head ? dirOf(0, 0, head[0], head[1]) : -1;
  let best = Infinity;
  let bestEnd = -2;
  // straight along the one road both are on
  if ((S.a === E.a && S.b === E.b) || (S.a === E.b && S.b === E.a)) {
    const d = Math.abs(S.x - E.x) + Math.abs(S.z - E.z);
    best = d + (hd >= 0 && d > 1 ? turnCost(hd, dirOf(S.x, S.z, E.x, E.z)) : 0);
    bestEnd = -1;
  }
  for (const g of [S.a, S.b]) {
    const len = Math.abs(g.x - S.x) + Math.abs(g.z - S.z);
    if (len > 0.5) {
      const d = dirOf(S.x, S.z, g.x, g.z);
      const c = len + (hd >= 0 ? turnCost(hd, d) : 0);
      if (c < cost[g.id * 4 + d]) cost[g.id * 4 + d] = c;
    } else {
      // standing on a crossing: any way out (a car keeps the way it faces)
      for (let d = 0; d < 4; d++) if (hd < 0 || d === hd) cost[g.id * 4 + d] = 0;
    }
  }
  // (a small plan: the plain way of looking for the cheapest state is quick enough)
  for (;;) {
    let k = -1;
    let c = Infinity;
    for (let i = 0; i < n * 4; i++) {
      if (!done[i] && cost[i] < c) {
        c = cost[i];
        k = i;
      }
    }
    if (k < 0 || c >= best) break;
    done[k] = 1;
    const g = GN[k >> 2];
    const d0 = k & 3;
    // off the plan at the destination's road
    if (g === E.a || g === E.b) {
      const len = Math.abs(g.x - E.x) + Math.abs(g.z - E.z);
      const t = c + len + (len > 0.5 ? turnCost(d0, dirOf(g.x, g.z, E.x, E.z)) : 0);
      if (t < best) {
        best = t;
        bestEnd = k;
      }
    }
    for (const e of g.nb) {
      const d1 = dirOf(g.x, g.z, e.to.x, e.to.z);
      if ((d0 >> 1) === (d1 >> 1) && d0 !== d1) continue; // no turning back at a crossing
      const k1 = e.to.id * 4 + d1;
      const c1 = c + e.len + turnCost(d0, d1);
      if (c1 < cost[k1]) {
        cost[k1] = c1;
        prev[k1] = k;
      }
    }
  }
  if (bestEnd === -2) return null;
  const pts = [[S.x, S.z]];
  if (bestEnd >= 0) {
    const chain = [];
    for (let k = bestEnd; k >= 0; k = prev[k]) chain.push(GN[k >> 2]);
    for (let i = chain.length - 1; i >= 0; i--) pts.push([chain[i].x, chain[i].z]);
  }
  pts.push([E.x, E.z]);
  // (no points on top of each other, no straight-on points in the middle of a line)
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (q && Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) < 0.3) continue;
    const r = out[out.length - 2];
    if (r && q && ((r[0] === q[0] && q[0] === p[0]) || (r[1] === q[1] && q[1] === p[1]))) out[out.length - 1] = p;
    else out.push(p);
  }
  let len = 0;
  for (let i = 1; i < out.length; i++) len += Math.abs(out[i][0] - out[i - 1][0]) + Math.abs(out[i][1] - out[i - 1][1]);
  return { pts: out, from: [x0, z0], to: [x1, z1], lead: S.d, tail: E.d, len: len + S.d + E.d };
}

export class GPS {
  constructor(game) {
    this.game = game;
    this.target = null; // { x, z, name }
    this.route = null;
    this.t = 0;
    this.distEl = document.getElementById('gps-dist');
    this.shown = '';
  }

  where() {
    const p = this.game.player;
    const v = p.inVehicle;
    return v ? { x: v.pos.x, z: v.pos.z, v } : { x: p.pos.x, z: p.pos.z, v: null };
  }

  set(x, z, name = null) {
    this.target = { x, z, name };
    this.t = 0;
    this.find();
    if (this.game.audio) this.game.audio.play('click', 0.6);
  }

  clear() {
    this.target = null;
    this.route = null;
    this.show('');
  }

  find() {
    const w = this.where();
    let head = null;
    if (w.v && Math.abs(w.v.speed || 0) > 2) {
      const s = Math.sign(w.v.speed);
      head = [Math.sin(w.v.yaw) * s, Math.cos(w.v.yaw) * s];
    }
    this.route = findRoute(w.x, w.z, this.target.x, this.target.z, head);
  }

  update(dt) {
    if (!this.target) return;
    const w = this.where();
    const d = Math.hypot(w.x - this.target.x, w.z - this.target.z);
    if (d < (w.v ? ARRIVE_CAR : ARRIVE_FOOT)) {
      const name = this.target.name;
      this.clear();
      const hud = this.game.hud;
      if (hud) hud.toast(name ? `הגעתם: ${name}` : 'הגעתם ליעד!', 'good', 2.4);
      if (this.game.audio) this.game.audio.play('ding', 0.7);
      return;
    }
    this.t -= dt;
    if (this.t <= 0) {
      this.t = AGAIN;
      this.find();
    }
    const len = this.route ? this.route.len : d;
    this.show(len < 1000 ? `${Math.max(10, Math.round(len / 10) * 10)} מ׳` : `${(len / 1000).toFixed(1)} ק״מ`);
  }

  // the distance under the minimap (written only when it changes)
  show(text) {
    if (text === this.shown || !this.distEl) return;
    this.shown = text;
    this.distEl.textContent = text;
    this.distEl.classList.toggle('hidden', !text);
  }
}

export { nearestRoad };
