import * as THREE from 'three';
import { NODES, lightAt, laneOffsets, stopDist, lanePoint, exitsFrom } from '../world/roads.js';
import { randomCarSpec, drawWipers, wiperSweep, KINDS } from '../render/cars.js';
import { civilianLook, copLook, swatLook } from './looks.js';
import { damp, dampAngle, angleDiff } from '../core/util.js';
import { Curbs } from './curbs.js';

// The traffic of the city: sedans, taxis, vans and low sports cars in the right-hand lanes of
// every avenue and street, turning at the crossings and waiting for the lights; the cars parked
// along the curbs; the police cruisers on patrol (and, when it comes to that, on your tail).
// Nobody turns across anybody: left turns only where nothing comes the other way.
//
// A car in traffic rides its lane exactly (a path of points through the crossings ahead of it);
// one that is wrecked, chasing you or taken off its path moves on its own.
//
// (GTA IV) And the street's manners: the buses run to the stops where people wait (one is sent
// along the avenue to a stop near you now and then, and keeps straight on to it); a car pulling
// over (a taxi for a fare, a van with a delivery, one stopped by the police) signals, eases over
// to the curb - into the parking lane where there is a gap - and puts its hazards on; a car
// turning at a crossing waits at its line while people are on the zebra it turns across; at a
// green light the first in the line is not always quick off the mark (on the phone), and the one
// behind lets it know; behind a van double-parked in a lane of its own, the horns. The mainland's
// curbs, its lots' cars and its bus stops come and go with its blocks (game/curbs.js); and its
// traffic is spent where you look: the cars far behind you, out of sight, give way to new ones
// coming in ahead of you, and what is off to the side of the view is not drawn.

const POLICE_WHITE = [0.95, 0.95, 0.97];
// the city's buses: orange, with a blue band along the windows (drawn by the car batches)
const BUS_COLORS = [[0.98, 0.56, 0.22], [0.25, 0.55, 0.85], [0.95, 0.3, 0.38]];
const WRECK = [0.13, 0.11, 0.13];

// where the driver sits, in car-local (forward u, to the right s)
export const DRIVER_SEAT = { u: -0.2, s: -0.42 };

// the rest of the street's traffic (game/fleet.js): as long and as wide as their shapes
const BIG = new Set(['truck', 'garbage', 'limo', 'classic', 'ambulance', 'firetruck']);

const LOOK_AHEAD = 1.3;
const DECEL = 3.6;
// (GTA IV) how steeply a car eases over to the curb or back out into its lane: metres over for a
// metre on (Traffic.mind; one parking, or pulling out of a space, turns more sharply)
const PULL_STEEP = 0.4;
// what the drivers stuck behind shout (GTA IV)
const JAMMED = ['Come on!', 'Move!', 'Unbelievable...', 'Today, please!'];
const PARKED_UP = ['Double-parked again?!', 'Move the van!', "You can't stop there!", 'Every single day...'];

// A lane to follow: points with the distance along them, a speed cap at each, and the stop lines
// (gates) of the crossings on the way.
class Path {
  constructor() {
    this.x = [];
    this.z = [];
    this.cum = [];
    this.cap = [];
    this.gates = [];
    this.len = 0;
  }

  push(p, cap) {
    const n = this.x.length;
    if (n) {
      const d = Math.hypot(p[0] - this.x[n - 1], p[1] - this.z[n - 1]);
      if (d < 0.05) {
        this.cap[n - 1] = Math.min(this.cap[n - 1], cap);
        return;
      }
      this.len += d;
    }
    this.x.push(p[0]);
    this.z.push(p[1]);
    this.cum.push(this.len);
    this.cap.push(cap);
  }

  // forget the points long behind
  trim(s) {
    let k = 0;
    while (k < this.cum.length - 2 && this.cum[k + 1] < s - 8) k++;
    if (k > 6) {
      this.x.splice(0, k);
      this.z.splice(0, k);
      this.cum.splice(0, k);
      this.cap.splice(0, k);
    }
  }

  sample(s, out) {
    const c = this.cum;
    const n = c.length;
    if (s <= c[0]) {
      out[0] = this.x[0];
      out[1] = this.z[0];
      return out;
    }
    let i = 0;
    while (i < n - 2 && c[i + 1] < s) i++;
    const seg = c[i + 1] - c[i] || 1;
    const t = Math.min(1, (s - c[i]) / seg);
    out[0] = this.x[i] + (this.x[i + 1] - this.x[i]) * t;
    out[1] = this.z[i] + (this.z[i + 1] - this.z[i]) * t;
    return out;
  }
}

const _a = [0, 0];
const _b = [0, 0];
const _p = [0, 0];

// what is in front of a car (Traffic.ahead): its state, the test of one thing, the answer
const _ahead = { c: null, fx: 0, fz: 0, best: Infinity, why: null, nose: 0, o: null };
const _aheadOut = { d: 0, why: null, o: null };
// (o: the car it is, when it is one of the traffic's: who is holding everybody up)
function aheadTest(x, z, r, w, back, o = null) {
  const A = _ahead;
  const c = A.c;
  const dx = x - c.pos.x;
  const dz = z - c.pos.z;
  const along = dx * A.fx + dz * A.fz - A.nose - back;
  if (along < 0.5 || along > 13 || along > A.best) return;
  const side = Math.abs(dx * A.fz - dz * A.fx);
  if (side < 1.45 + r + (c.halfWid - 0.98)) {
    A.best = along;
    A.why = w;
    A.o = o;
  }
}
const _drawOpts = { spin: 0, steer: 0, extra: null, siren: undefined, scale: 1, squash: 1 };

export class Traffic {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.t = 0;
    this.time = 0;
    // (counted for the tests: ROADMAP 4.4)
    this.stats = { overtakes: 0, bailed: 0, crashes: 0 };
    // the cars along the curbs (the city placed them; they stay where they are until taken)
    this.parked = (game.world.parked || []).map((sp) => ({
      ...sp,
      pos: new THREE.Vector3(sp.x, 0, sp.z),
      halfLen: 2.3,
      halfWid: 0.98,
      ink: 110,
      parkedCar: true,
      speed: 0,
      wheel: 0,
    }));
    // (GTA IV) the bus stops the buses stop at: the island's, and the mainland's as its blocks
    // come and go (game/curbs.js); the cars parked along the mainland's curbs and in its lots
    this.stops = (game.world.busStops || []).slice();
    this.curbs = new Curbs(this);
    // (the next bus sent along to a stop near you; how far off the parked cars are drawn)
    this.busT = 5;
    this.parkR = 190;
    this.lineStats = { sent: 0, served: 0, yields: 0, slow: 0, taps: 0 };
  }

  get cars() {
    return this.game.cars;
  }

  reset() {
    for (const c of this.list) this.removeCar(c);
    this.list = [];
  }

  removeCar(c) {
    if ((c.rider || c.garbage || c.pickup || c.delivery || c.pulled || c.tstop) && this.game.fleet) this.game.fleet.forget(c);
    if (c.driver && c.driver.fig) c.driver.fig.dispose();
    c.driver = null;
    if (c.crew) for (const m of c.crew) if (m.fig) m.fig.dispose();
    c.crew = null;
    this.unpark(c);
  }

  // ------------------------------------------------------------------ lanes
  newCar(spec, o = {}) {
    const bus = spec.kind === 'bus';
    const K = BIG.has(spec.kind) ? KINDS[spec.kind] : null;
    const moto = spec.kind === 'moto';
    const c = {
      spec,
      bus,
      pos: new THREE.Vector3(),
      yaw: 0,
      speed: o.speed || 0,
      maxSpeed: o.maxSpeed || (bus ? 8.5 : 9.5 + Math.random() * 4.5),
      halfLen: bus ? 5.8 : K ? K.len / 2 : moto ? 1.1 : spec.kind === 'van' ? 2.5 : 2.3,
      halfWid: bus ? 1.25 : K ? K.W / 2 : moto ? 0.45 : 0.98,
      ink: 120,
      driver: o.driver === false ? null : { look: civilianLook(), fig: null },
      crew: null,
      police: !!spec.police,
      mode: 'drive',
      path: null,
      route: null,
      s: 0,
      blockedT: 0,
      stuckT: 0,
      wheel: Math.random() * 6,
      steer: 0,
      wrecked: false,
      stopped: false,
    };
    // (a fire engine on its way to a fire: its turns, from the first one - ROADMAP 8.4)
    if (o.respond) c.respond = o.respond;
    // (a truck, a motorbike, an ambulance...: game/fleet.js)
    if (!this.game.classic && this.game.fleet) {
      this.game.fleet.dress(c);
      // (one driver in twenty takes the amber, and a red just turned: ROADMAP 4.4)
      if (!c.police && !c.emergency && Math.random() < 0.05) c.runner = true;
    }
    return c;
  }

  // put c on the lane from node A to node B, t metres out of A
  placeOnEdge(c, A, B, laneIdx, t) {
    const dx = Math.sign(B.x - A.x);
    const dz = Math.sign(B.z - A.z);
    const offs = laneOffsets(A, dx, dz);
    const off = offs[Math.min(laneIdx, offs.length - 1)];
    const len = Math.abs(B.x - A.x) + Math.abs(B.z - A.z);
    const path = new Path();
    path.push(lanePoint(A, dx, dz, off, t - 2), c.maxSpeed);
    const end = len - stopDist(B, dz !== 0);
    path.push(lanePoint(A, dx, dz, off, Math.max(end, t + 1)), c.maxSpeed);
    path.gates.push({ s: path.len, node: B, axis: dz !== 0 ? 'ns' : 'ew', from: A, dx, dz, off });
    c.path = path;
    c.route = { to: B, dx, dz, off };
    c.s = 2;
    path.sample(c.s, _p);
    c.pos.set(_p[0], 0, _p[1]);
    c.yaw = Math.atan2(dx, dz);
    this.extend(c);
  }

  // add the next crossing (and the road after it) to the path
  extend(c) {
    const path = c.path;
    const { to: B, dx, dz, off } = c.route;
    const ex = exitsFrom(B, dx, dz);
    if (!ex.length) return false;
    let e = ex[0];
    if (c.respond) {
      // (ROADMAP 8.4: a fire engine on its way - at each crossing the way that takes it nearer,
      // across the traffic too)
      const R = c.respond;
      const far = (o) => Math.abs(o.to.x - R.x) + Math.abs(o.to.z - R.z);
      e = exitsFrom(B, dx, dz, true).reduce((a, b) => (far(b) < far(a) ? b : a));
    } else if (c.lineStop && ex.some((o) => o.turn === 0) && this.stopAhead(c.lineStop, B, dx, dz)) {
      // (GTA IV: a bus sent to a stop keeps straight on along the avenue to it)
      e = ex.find((o) => o.turn === 0);
    } else if (ex.length > 1) {
      const w = ex.map((o) => (o.turn === 0 ? 0.55 : o.turn > 0 ? 0.3 : 0.3));
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < ex.length; i++) {
        r -= w[i];
        if (r <= 0) {
          e = ex[i];
          break;
        }
      }
    }
    // (the turn signal, from 35 m before the crossing: game/fleet.js... ROADMAP 4.3)
    if (e.turn !== 0 && !this.game.classic) {
      const gs = path.gates.length ? path.gates[path.gates.length - 1].s : path.len;
      // (and the zebra it turns across: the far side of the crossing, on the road it turns into -
      // it waits at its line while somebody is on it)
      (c.turns || (c.turns = [])).push({ s: gs, dir: e.turn > 0 ? -1 : 1, node: B, ex: e.dx, ez: e.dz });
    }
    const offs = laneOffsets(B, e.dx, e.dz);
    let off2 = offs[0];
    if (e.turn > 0 || c.bus || c.curb) off2 = offs[offs.length - 1];
    else if (e.turn === 0) off2 = offs.reduce((a, b) => (Math.abs(b - off) < Math.abs(a - off) ? b : a), offs[0]);
    const vmax = c.maxSpeed;
    const X = lanePoint(B, e.dx, e.dz, off2, stopDist(B, e.dz !== 0));
    if (e.turn === 0) {
      path.push(X, vmax);
    } else {
      // a curve between the two lanes, round the point where they cross
      const E = [path.x[path.x.length - 1], path.z[path.z.length - 1]];
      const C = dz !== 0 ? [E[0], X[1]] : [X[0], E[1]];
      const cap = e.turn > 0 ? 5.2 : 6.8;
      for (let k = 1; k <= 10; k++) {
        const t = k / 10;
        const u = 1 - t;
        path.push([u * u * E[0] + 2 * u * t * C[0] + t * t * X[0], u * u * E[1] + 2 * u * t * C[1] + t * t * X[1]], cap);
      }
    }
    // on along the next road to its stop line
    const D = e.to;
    const len = Math.abs(D.x - B.x) + Math.abs(D.z - B.z);
    path.push(lanePoint(B, e.dx, e.dz, off2, len - stopDist(D, e.dz !== 0)), vmax);
    path.gates.push({ s: path.len, node: D, axis: e.dz !== 0 ? 'ns' : 'ew', from: B, dx: e.dx, dz: e.dz, off: off2 });
    c.route = { to: D, dx: e.dx, dz: e.dz, off: off2 };
    return true;
  }

  // a random lane somewhere between minD and maxD from p (out of sight when close)
  spawnCar(p, minD, maxD, spec = null, o = {}) {
    const cam = this.game.camera;
    const fwd = cam.getWorldDirection(this._fwd || (this._fwd = new THREE.Vector3()));
    const near = NODES.filter((n) => Math.hypot(n.x - p.x, n.z - p.z) < maxD + 80);
    if (!near.length) return null;
    // (o.toward: heading for p - the fire engine, ROADMAP 8.4; o.ahead: on your side of the city,
    // the way you look - GTA IV, the mainland: not far behind you, where nobody sees it)
    for (let tries = 0; tries < (o.toward ? 30 : o.ahead ? 12 : 8); tries++) {
      const A = near[Math.floor(Math.random() * near.length)];
      const B = A.nb[Math.floor(Math.random() * A.nb.length)];
      if (o.toward && Math.hypot(B.x - p.x, B.z - p.z) >= Math.hypot(A.x - p.x, A.z - p.z)) continue;
      const alongZ = B.z !== A.z;
      const len = Math.abs(B.x - A.x) + Math.abs(B.z - A.z);
      const t0 = stopDist(A, alongZ) + 3;
      const t1 = len - stopDist(B, alongZ) - 6;
      if (t1 - t0 < 4) continue;
      const t = t0 + Math.random() * (t1 - t0);
      const dx = Math.sign(B.x - A.x);
      const dz = Math.sign(B.z - A.z);
      const offs = laneOffsets(A, dx, dz);
      // (a bus keeps to the curb lane, where its stops are)
      const li = spec && (spec.kind === 'bus' || spec.curb) ? offs.length - 1 : Math.floor(Math.random() * offs.length);
      const q = lanePoint(A, dx, dz, offs[li], t);
      const d = Math.hypot(q[0] - p.x, q[1] - p.z);
      if (d < minD || d > maxD) continue;
      // don't pop up in plain view
      if (!o.anywhere && d < 110) {
        const vx = q[0] - cam.position.x;
        const vz = q[1] - cam.position.z;
        if ((vx * fwd.x + vz * fwd.z) / (Math.hypot(vx, vz) || 1) > 0.2) continue;
      }
      if (o.ahead && d > 60) {
        const vx = q[0] - cam.position.x;
        const vz = q[1] - cam.position.z;
        if ((vx * fwd.x + vz * fwd.z) / (Math.hypot(vx, vz) || 1) < -0.3) continue;
      }
      if (this.list.some((c) => Math.hypot(c.pos.x - q[0], c.pos.z - q[1]) < (spec && (spec.kind === 'bus' || spec.curb || spec.emergency) ? 18 : 10))) continue;
      // (what drives about: the city's own mix; with the trucks, the motorbikes... game/fleet.js)
      const c = this.newCar(spec || (this.game.classic || !this.game.fleet ? randomCarSpec() : this.game.fleet.spec()), o);
      this.placeOnEdge(c, A, B, li, t);
      this.list.push(c);
      return c;
    }
    return null;
  }

  // (v5, ROADMAP 11.17) a place in a lane of the roads round p (the island's or the mainland's),
  // between minD and maxD from it, out of sight of it, the way to p: { x, z, yaw } or null (the
  // police cars sent to you come from there)
  roadSpot(p, minD, maxD, sight = null) {
    const col = this.game.world.collision;
    const near = NODES.filter((n) => Math.hypot(n.x - p.x, n.z - p.z) < maxD + 60);
    if (!near.length) return null;
    for (let tries = 0; tries < 24; tries++) {
      const A = near[Math.floor(Math.random() * near.length)];
      const B = A.nb[Math.floor(Math.random() * A.nb.length)];
      if (!B) continue;
      // (driving toward p along the road: from the end farther from it)
      const [S, E] = Math.hypot(A.x - p.x, A.z - p.z) > Math.hypot(B.x - p.x, B.z - p.z) ? [A, B] : [B, A];
      const alongZ = E.z !== S.z;
      const len = Math.abs(E.x - S.x) + Math.abs(E.z - S.z);
      const t0 = stopDist(S, alongZ) + 3;
      const t1 = len - stopDist(E, alongZ) - 6;
      if (t1 - t0 < 4) continue;
      const t = t0 + Math.random() * (t1 - t0);
      const dx = Math.sign(E.x - S.x);
      const dz = Math.sign(E.z - S.z);
      const offs = laneOffsets(S, dx, dz);
      const q = lanePoint(S, dx, dz, offs[0], t);
      const d = Math.hypot(q[0] - p.x, q[1] - p.z);
      if (d < minD || d > maxD) continue;
      if (sight && col.lineOfSight(sight.x, sight.y + 1.6, sight.z, q[0], 1.4, q[1])) continue;
      if (this.list.some((c) => Math.hypot(c.pos.x - q[0], c.pos.z - q[1]) < 9)) continue;
      return { x: q[0], z: q[1], yaw: Math.atan2(dx, dz), node: E };
    }
    return null;
  }

  // the first boulevard's own four cars, where they were
  seedFirst() {
    const blvd = NODES.filter((n) => n.ave.blvd);
    const at = (j) => blvd.find((n) => n.j === j);
    const put = (color, A, B, li, t, speed) => {
      const c = this.newCar({ kind: 'sports', color }, { maxSpeed: speed + 2, speed });
      this.placeOnEdge(c, A, B, li, t);
      this.list.push(c);
    };
    // northbound, away from you (their tail-lights in the wet street), and one coming south
    put([0.42, 0.18, 0.6], at(3), at(2), 0, 45, 8.5);
    put([0.86, 0.12, 0.16], at(3), at(2), 1, 63, 10.5);
    put([0.95, 0.95, 0.96], at(3), at(2), 0, 109, 9);
    put([0.1, 0.55, 0.62], at(1), at(2), 0, 103, 9);
  }

  update(dt) {
    const game = this.game;
    const p = game.anchorPos();
    this.time += dt;
    this.t -= dt;
    if (!this.seeded) {
      this.seeded = true;
      this.seedFirst();
    }
    if (this.t <= 0) {
      this.t = 0.8;
      const cam = game.camera.position;
      const fwd = game.camera.getWorldDirection(this._fwd2 || (this._fwd2 = new THREE.Vector3()));
      // (GTA IV: on the mainland the traffic is kept nearer you - see below)
      const far = !game.classic && p.x < -330 ? 180 : 210;
      for (const c of this.list) {
        const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
        // empty police cars go when the chase is over and you are gone
        const done = c.police && !game.police.hostile && (c.mode === 'parked' || c.mode === 'leave') && d > 60;
        // a car stuck behind a wreck (or you) gives up once nobody is looking
        const vx = c.pos.x - cam.x;
        const vz = c.pos.z - cam.z;
        const seen = Math.hypot(vx, vz) < 120 && (vx * fwd.x + vz * fwd.z) > -6;
        const stuck = c.stuckT > 9 && !seen;
        if (d > far || done || stuck || (c.wrecked && d > 120)) {
          this.removeCar(c);
          c.gone = true;
        }
      }
      this.list = this.list.filter((c) => !c.gone);
      // (the rush hours: the most cars there are; at night few: game/rhythm.js)
      // (GTA IV: the mainland's grid is wide and its blocks big - more cars on it, nearer you, or
      // its avenues look empty)
      const main = !game.classic && p.x < -330;
      const max = Math.round((game.touch ? (main ? 20 : 16) : main ? 44 : 32) * (game.rhythm ? game.rhythm.cars : 1));
      let n = 0;
      let buses = 0;
      for (const c of this.list) {
        if (!c.police) n++;
        if (c.bus) buses++;
      }
      if (n > max + 1) {
        // (fewer cars about at this hour than there were: some of those out of sight go home)
        for (const c of this.list) {
          if (n <= max) break;
          if (c.police || c.mode !== 'drive' || !c.driver || c.wrecked || c.poofT !== undefined) continue;
          const vx = c.pos.x - cam.x;
          const vz = c.pos.z - cam.z;
          const d = Math.hypot(vx, vz) || 1;
          if (d < 50 || (vx * fwd.x + vz * fwd.z) / d > 0) continue;
          this.removeCar(c);
          c.gone = true;
          n--;
          if (c.bus) buses--;
        }
        this.list = this.list.filter((c) => !c.gone);
      }
      const first = game.state === 'title' || this.time < 3;
      if (main && !first && n >= max - 1) {
        // (GTA IV) the cars are spent where you look: two of those far behind you, out of sight
        // (nothing they are in the middle of - a fare, a delivery, a stop), go, and the new ones
        // come in ahead of you instead
        let k = 0;
        for (const c of this.list) {
          if (k >= 2) break;
          if (c.police || c.bus || c.emergency || c.delivery || c.garbage || c.fare || c.pickup || c.drop || c.pulled || c.seekPark || c.mode !== 'drive' || !c.driver || c.poofT !== undefined) continue;
          const vx = c.pos.x - cam.x;
          const vz = c.pos.z - cam.z;
          const d = Math.hypot(vx, vz) || 1;
          if (d < 75 || (vx * fwd.x + vz * fwd.z) / d > -0.35) continue;
          this.removeCar(c);
          c.gone = true;
          n--;
          k++;
        }
        if (k) this.list = this.list.filter((c) => !c.gone);
      }
      for (let k = 0; k < 3 && n < max; k++) {
        // now and then a city bus
        const spec = buses < 2 && Math.random() < 0.1 ? { kind: 'bus', color: BUS_COLORS[Math.floor(Math.random() * BUS_COLORS.length)] } : null;
        if (this.spawnCar(p, first ? 30 : main ? 40 : 60, main ? 140 : 190, spec, { anywhere: first, ahead: main && !first })) {
          n++;
          if (spec) buses++;
        }
      }
      // (GTA IV) the curbs: somebody off in a parked car, somebody parking (game/curbs.js)
      if (!first) this.curbs.tick(p);
      // (GTA IV) and a bus along to a stop near you where people wait
      if (!game.classic && !first) {
        this.busT -= 0.8;
        if (this.busT <= 0) this.busT = this.sendBus(p) ? (game.touch ? 40 : 26) + Math.random() * 20 : 6;
      }
    }
    // (the list as it was when the loop began, as for...of would)
    const cars = this.list;
    if (!game.classic) {
      // (the sirens about, for the drivers to make way: ROADMAP 4.4)
      const S = this._sirens || (this._sirens = []);
      S.length = 0;
      for (let i = 0; i < cars.length; i++) if (cars[i].emergency && cars[i].siren && !cars[i].wrecked) S.push(cars[i]);
    }
    for (let i = 0; i < cars.length; i++) if (!cars[i].gone) this.updateCar(cars[i], dt);
    // (GTA IV: the ones walking up to their parked cars - game/curbs.js)
    if (this.curbs.leaving.length) this.curbs.update(dt);
    if (!game.classic) this.crashes(dt);
    // (rubbed out; or let go of this frame - a car that parked at the curb, game/curbs.js parkIt: a
    // parked car of its own now, and out of the list before anything else bumps into it)
    let gone = false;
    for (let i = 0; i < this.list.length; i++) if (this.list[i].gone || (this.list[i].poofT !== undefined && this.list[i].poofT > 0.45)) gone = true;
    if (gone) {
      this.list = this.list.filter((c) => {
        if (c.gone) return false;
        if (c.poofT === undefined || c.poofT <= 0.45) return true;
        this.removeCar(c);
        return false;
      });
    }
    for (const c of this.parked) if (c.poofT !== undefined && c.poofT <= 0.45) c.poofT += dt;
  }

  // what is in front of c (within 9 m, in its lane): { d, why } (the same object every time:
  // read it at once), or null
  ahead(c) {
    const game = this.game;
    const A = _ahead;
    A.c = c;
    A.fx = Math.sin(c.yaw);
    A.fz = Math.cos(c.yaw);
    A.best = Infinity;
    A.why = null;
    A.o = null;
    // (distances from c's nose to the back of what is in front)
    A.nose = c.halfLen - 2.3;
    const pl = game.player;
    if (!pl.inVehicle && pl.mode !== 'dead') aheadTest(pl.pos.x, pl.pos.z, 0.3, 'player', 0);
    const vs = game.vehicles.list;
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i];
      if (!v.dead && !(v.flies && v.alt > 2)) aheadTest(v.pos.x, v.pos.z, v.radius * 0.6, v.driver ? 'player' : 'car', 0);
    }
    const os = this.list;
    // (the one it is swinging out round, ROADMAP 4.4: not in the way)
    const by = c.passBy && c.s < c.passUntil ? c.passBy : null;
    // (a siren swung out to pass: not the ones pulled over for it - ROADMAP 8.4)
    const pass = c.emergency && c.passK > 0.5;
    // (GTA IV: the mainland's traffic is thicker - what is plainly too far off on either axis to be
    // within 13 m in front, a bus's length allowed for, is passed over before it is measured)
    const cx = c.pos.x;
    const cz = c.pos.z;
    for (let i = 0; i < os.length; i++) {
      const o = os[i];
      const ox = o.pos.x - cx;
      const oz = o.pos.z - cz;
      if (ox > 23 || ox < -23 || oz > 23 || oz < -23) continue;
      if (o !== c && o !== by && !(pass && o.yieldK > 0.5)) aheadTest(o.pos.x, o.pos.z, 0.8 + (o.halfWid - 0.98), 'car', o.halfLen - 2.3, o);
    }
    const es = game.enemies.list;
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (e.alive) aheadTest(e.pos.x, e.pos.z, 0.4, 'other', 0);
    }
    // (a ramp drawn in the road, ROADMAP 9.2: in the way like a car stopped there)
    const G = game.gadgets;
    if (G) for (let i = 0; i < G.ramps.length; i++) aheadTest(G.ramps[i].cx, G.ramps[i].cz, G.ramps[i].r, 'car', G.ramps[i].back);
    const hs = game.civilians.list;
    for (let i = 0; i < hs.length; i++) {
      const h = hs[i];
      const hx = h.pos.x - cx;
      const hz = h.pos.z - cz;
      if (hx > 20 || hx < -20 || hz > 20 || hz < -20) continue;
      if (!h.inside && h.alive !== false) aheadTest(h.pos.x, h.pos.z, 0.3, 'other', 0);
    }
    if (!A.why) return null;
    _aheadOut.d = A.best;
    _aheadOut.why = A.why;
    _aheadOut.o = A.o;
    return _aheadOut;
  }

  updateCar(c, dt) {
    // (ROADMAP 11.28: held by a thing of the pen - stopped by a bolt, under a net, spun on oil, on a
    // harpoon: moved by it - game/gear.js)
    if (c.gear && this.game.gear && this.game.gear.holdCar(c, dt)) {
      c.wheel += (c.speed * dt) / 0.36;
      return;
    }
    if (c.tail && c.poofT === undefined && !c.wrecked) {
      // after another car, the way it went (game/events.js: the police after a getaway car)
      this.follow(c, dt);
    } else if (c.police && c.mode !== 'patrol' && c.mode !== 'drive' && c.poofT === undefined && !c.wrecked) {
      this.updatePolice(c, dt);
      this.moveFree(c, dt);
    } else if (c.poofT !== undefined) {
      // rubbed out: shrinks into a puff of eraser crumbs
      c.poofT += dt;
      c.speed = damp(c.speed, 0, 6, dt);
      this.moveFree(c, dt);
    } else if (c.wrecked || c.stopped || !c.path) {
      // (after a crash the drivers get out: ROADMAP 4.4)
      if (c.outT && this.game.time > c.outT && c.driver && !c.driverOut) {
        c.driverOut = true;
        this.game.ejectDriver(c.driver, c.pos, c.yaw, false);
        c.driver = null;
      }
      c.speed = damp(c.speed, 0, c.wrecked ? 3 : 8, dt);
      if (c.wrecked && Math.random() < dt * 2) this.game.fx.smoke(c.pos.x, 1.6, c.pos.z, 1.2);
      this.moveFree(c, dt);
    } else {
      this.drive(c, dt);
    }
    c.wheel += (c.speed * dt) / 0.36;
  }

  moveFree(c, dt) {
    c.pos.x += Math.sin(c.yaw) * c.speed * dt;
    c.pos.z += Math.cos(c.yaw) * c.speed * dt;
  }

  // keep 9-14 m behind c.tail along the points it passed (so through the same turns)
  follow(c, dt) {
    const L = c.tail;
    if (L.gone || L.poofT !== undefined || this.list.indexOf(L) < 0) {
      c.tail = null;
      c.mode = 'leave';
      c.siren = false;
      return;
    }
    const tr = c.trail || (c.trail = []);
    const last = tr[tr.length - 1];
    if (!last || Math.hypot(L.pos.x - last[0], L.pos.z - last[1]) > 1.5) tr.push([L.pos.x, L.pos.z]);
    while (tr.length > 1 && Math.hypot(tr[0][0] - c.pos.x, tr[0][1] - c.pos.z) < 3.5) tr.shift();
    const gap = Math.hypot(L.pos.x - c.pos.x, L.pos.z - c.pos.z);
    const want = L.wrecked || L.stopped ? (gap > 9 ? 4 : 0) : gap > 15 ? L.speed + 3 : gap < 9 ? Math.max(0, L.speed - 3) : L.speed;
    c.speed = damp(c.speed, want, 2.5, dt);
    const tgt = tr[0];
    const yaw = Math.atan2(tgt[0] - c.pos.x, tgt[1] - c.pos.z);
    c.steer = damp(c.steer, angleDiff(c.yaw, yaw) * 4, 8, dt);
    if (c.speed > 0.3) c.yaw = dampAngle(c.yaw, yaw, 5, dt);
    this.moveFree(c, dt);
  }

  // along the lane: slow for the curves, stop for the lights and for whatever is in front
  drive(c, dt) {
    const path = c.path;
    if (path.len - c.s < 60) this.extend(c);
    let want = c.maxSpeed;
    // (a signal of its own this frame: a bus pulling in to its stop or out of it, a car pulling
    // over or out of its space - busStop, game/fleet.js, game/curbs.js)
    c.sig2 = 0;
    if (c.sigT > 0) {
      c.sigT -= dt;
      c.sig2 = c.sigDir;
    }
    // curves ahead
    for (let i = 0; i < path.cum.length; i++) {
      const d = path.cum[i] - c.s;
      if (d < -1) continue;
      if (d > 40) break;
      if (path.cap[i] < want) want = Math.min(want, Math.sqrt(path.cap[i] * path.cap[i] + 2 * DECEL * Math.max(0, d)));
    }
    // the lights (a getaway car runs them: game/events.js)
    const front = c.s + c.halfLen;
    while (path.gates.length && path.gates[0].s < front - 0.6) path.gates.shift();
    const g = path.gates[0];
    if (g && !c.reckless) {
      const light = lightAt(g.node, g.axis, this.time);
      const dist = g.s - front - 0.4;
      // (a few drivers take the amber, and a red just turned: ROADMAP 4.4)
      const runs = c.runner && (light === 'y' || (light === 'r' && lightAt(g.node, g.axis, this.time - 1.2) !== 'r'));
      if (light !== 'g' && dist < 45 && !runs) {
        if (c.emergency) {
          // (an ambulance, a fire engine: slow, a look, and through: game/fleet.js)
          want = Math.min(want, Math.max(5, dist * 0.45));
        } else {
          const canStop = dist > (c.speed * c.speed) / (2 * 6.5);
          if (light === 'r' || canStop) want = Math.min(want, dist < 0.3 ? 0 : Math.sqrt(2 * DECEL * dist) * 0.9);
        }
      }
      if (!this.game.classic && !c.emergency) {
        // (GTA IV) the light just turned green: off the mark in a moment - or, one driver in eight
        // (on the phone), not before the one behind has had to say so (Traffic.mind)
        if (light === 'g' && c.lit && c.lit !== 'g' && dist < 7 && c.speed < 0.5) {
          const slow = Math.random() < 0.12;
          c.reactT = slow ? 2.4 + Math.random() * 2.2 : 0.25 + Math.random() * 0.7;
          if (slow) this.lineStats.slow++;
        }
        c.lit = light;
        // (GTA IV) turning at the crossing: not across the zebra while somebody is on it - it
        // waits at its line
        const T = c.turns && c.turns.length ? c.turns[0] : null;
        if (T && T.node === g.node && dist < 26 && dist > -0.5 && this.zebraBusy(T)) {
          want = Math.min(want, dist < 0.3 ? 0 : Math.sqrt(2 * DECEL * Math.max(0, dist)) * 0.9);
          if (!c.yielding) this.lineStats.yields++;
          c.yielding = true;
        } else c.yielding = false;
      }
    }
    if (c.reactT > 0) {
      c.reactT -= dt;
      want = 0;
    }
    // a bus pulls up at its stops
    if (c.bus) want = Math.min(want, this.busStop(c, dt));
    // (GTA IV) a car after a space at the curb (game/curbs.js)
    if (c.seekPark) want = Math.min(want, this.curbs.wantPark(c, dt));
    // a taxi pulling over, the garbage truck at a bin (game/fleet.js)
    if (c.garbage || c.pickup || c.dropT !== undefined || c.drop || c.delivery || c.pulled || c.tstop || c.goT > 0) want = Math.min(want, this.game.fleet.want(c, dt));
    // whatever is in front (not for a driver looking elsewhere: game/events.js, the bump)
    const a = c.distracted ? null : this.ahead(c);
    if (c.brakeT > 0) {
      c.brakeT -= dt;
      want = 0;
    }
    // (ROADMAP 4.4: round what is stopped, honking in a jam, out of the way of a siren)
    if (!this.game.classic) want = Math.min(want, this.mind(c, dt, a, g, front));
    if (a) {
      const keep = a.why === 'car' ? 6.4 : 4.6;
      want = Math.min(want, Math.max(0, (a.d - keep) * 1.3));
      if (a.why === 'player') {
        c.blockedT += dt;
        if (c.blockedT > 1.2) {
          c.blockedT = -2.5;
          this.game.audio.play('honk', 0.6);
          if (c.driver && Math.random() < 0.5) this.game.bubbles.say(this.driverAnchor(c), pick(['Move it!', 'Hey, buddy!', "C'mon!", 'Get outta the road!']));
        }
      } else c.blockedT = Math.min(c.blockedT, 0);
    } else c.blockedT = Math.min(c.blockedT, 0);
    if (want < c.speed) c.speed = Math.max(want, c.speed - 9 * dt);
    else c.speed = Math.min(want, c.speed + 3.0 * dt);
    c.stuckT = a && c.speed < 0.3 && a.why !== 'player' ? c.stuckT + dt : 0;
    c.s += c.speed * dt;
    if (c.turns) {
      c.signal = 0;
      for (const t of c.turns) if (c.s > t.s - 35 && c.s < t.s + 10) c.signal = t.dir;
      if (c.turns.length && c.turns[0].s < c.s - 12) c.turns.shift();
    }
    if (c.sig2) c.signal = c.sig2;
    path.trim(c.s);
    path.sample(c.s, _p);
    path.sample(c.s - LOOK_AHEAD, _a);
    path.sample(c.s + LOOK_AHEAD, _b);
    c.pos.set(_p[0], 0, _p[1]);
    const yaw = Math.atan2(_b[0] - _a[0], _b[1] - _a[1]);
    // (GTA IV) easing over to the side of its lane or back into it (to the curb, out of a space, out
    // of a siren's way): its nose turned the way it is going, not slid along sideways
    let tilt = 0;
    if (!this.game.classic) {
      const s1 = c.side || 0;
      const vs = (s1 - (c.side0 === undefined ? s1 : c.side0)) / Math.max(dt, 1e-3);
      c.side0 = s1;
      if (vs > 0.03 || vs < -0.03) tilt = Math.max(-0.32, Math.min(0.32, -Math.atan2(vs, Math.max(c.speed, 1.2))));
    }
    c.steer = damp(c.steer, angleDiff(c.yaw, yaw + tilt) * 6, 8, dt);
    c.yaw = yaw + tilt;
    // (pulled over to the right for a siren; a siren passing on the left)
    if (c.side) {
      c.pos.x += -Math.cos(yaw) * c.side;
      c.pos.z += Math.sin(yaw) * c.side;
    }
  }

  // ------------------------------------------------------------------ the drivers (ROADMAP 4.4)
  // How fast this one may go, by what its driver makes of the road: a siren behind (pull over
  // to the right and stop; the siren swings out to pass), stuck behind something stopped on a
  // green light (honk; on a road of two lanes, over into the other one and round it), fleeing
  // shots (faster, through the lights). (?classic: none of it)
  mind(c, dt, a, g, front) {
    let want = Infinity;
    // a siren coming up behind
    const S = this._sirens;
    let yieldTo = false;
    let passing = false;
    if (S && S.length) {
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      for (const e of S) {
        if (e === c) continue;
        const dx = c.pos.x - e.pos.x;
        const dz = c.pos.z - e.pos.z;
        const along = dx * fx + dz * fz;
        const side = Math.abs(-dx * fz + dz * fx);
        const same = Math.sin(e.yaw) * fx + Math.cos(e.yaw) * fz > 0.7;
        if (same && along > 0 && along < 45 && side < 3.5) yieldTo = true;
      }
      if (c.emergency) {
        // (swinging out round the ones that pulled over)
        for (const o of this.list) {
          if (o === c || !(o.yieldK > 0.3)) continue;
          const d = Math.hypot(o.pos.x - c.pos.x, o.pos.z - c.pos.z);
          if (d < 16) passing = true;
        }
      }
    }
    c.yieldK = THREE.MathUtils.damp(c.yieldK || 0, yieldTo ? 1 : 0, yieldTo ? 2.2 : 1.2, dt);
    const passK = c.emergency ? (c.passK = THREE.MathUtils.damp(c.passK || 0, passing ? 1 : 0, 3, dt)) : 0;
    // (GTA IV) over to the curb (a fare, a delivery, the police behind it, a space to park in): as
    // far as Traffic.curbRoom found room for, and back out into the lane after. Steered, as it
    // rolls: so many metres over for every metre on (pullV), turned into and out of gently - a car
    // standing still does not slide sideways, and its nose is turned the way it goes
    // (Traffic.drive). Into the parking lane only where it is free beside it (roomBeside): round
    // the end of the car parked behind the space, not through it.
    let pullS = 0;
    if (c.pull || c.pullS > 0.001) {
      let to = c.pull ? c.pullTo || 0 : 0;
      if (to > 0.9) {
        c.roomT = (c.roomT || 0) - dt;
        if (c.roomT <= 0) {
          c.roomT = 0.1;
          c.roomHere = this.roomBeside(c);
        }
        to = Math.min(to, c.roomHere);
      }
      const steep = c.pullMax || PULL_STEEP;
      const ds = c.speed * dt;
      const cur = c.pullS || 0;
      const v = c.pullV || 0;
      const wantV = Math.max(-steep, Math.min(steep, steep * 1.5 * (to - cur)));
      const nv = v + Math.max(-steep * 0.8 * ds, Math.min(steep * 0.8 * ds, wantV - v));
      c.pullV = nv;
      pullS = c.pullS = Math.max(0, cur + nv * ds);
      if (!c.pull && pullS < 0.02 && Math.abs(nv) < 0.02) c.pullS = c.pullV = c.pullMax = pullS = 0;
    }
    c.side = Math.max(1.5 * c.yieldK, pullS) - 1.0 * passK;
    if (c.yieldK > 0.05) want = Math.min(want, 9 * (1 - c.yieldK) + 0.5);
    // fleeing shots: faster, the lights be damned
    if (c.fleeT > 0) {
      c.fleeT -= dt;
      c.reckless = c.fleeT > 0;
      if (c.fleeT <= 0) c.maxSpeed = c.maxSpeed0 || c.maxSpeed;
    }
    // stuck behind a car that does not go on a green light
    const light = g ? lightAt(g.node, g.axis, this.time) : 'g';
    const toGate = g ? g.s - front : 99;
    if (a && a.why === 'car' && c.speed < 0.6 && (light === 'g' || toGate > 30)) {
      c.jamT = (c.jamT || 0) + dt;
      // (GTA IV) the one in front still sitting there at the green: a tap on the horn
      if (a.o && a.o.reactT > 0.6 && c.jamT > 1.1 && !c.tapped && c.driver) {
        c.tapped = true;
        this.lineStats.taps++;
        if (this.near(c, 45)) {
          this.game.audio.play('honk', 0.3);
          if (Math.random() < 0.35) this.game.bubbles.say(this.driverAnchor(c), pick(["It's green!", 'Hello? Green!', 'Wake up!']));
        }
      }
      if (c.jamT > 1.8 && !c.laneTried && g && toGate > 22) {
        c.laneTried = true;
        this.overtake(c, g);
      }
      if (c.jamT > 5 && c.driver) {
        c.jamT = 2.5 + Math.random() * 2;
        if (this.near(c, 45)) {
          this.game.audio.play('honk', 0.45);
          // (stuck behind a van double-parked, a car the police stopped, a taxi letting somebody out)
          const parkedUp = a.o && (a.o.delivery || a.o.hazard || a.o.pulled || a.o.pickup || a.o.dropT !== undefined);
          if (Math.random() < (parkedUp ? 0.55 : 0.3)) this.game.bubbles.say(this.driverAnchor(c), pick(parkedUp ? PARKED_UP : JAMMED));
        }
      }
    } else {
      c.jamT = 0;
      if (!a) c.laneTried = false;
      if (c.speed > 2) c.tapped = false;
    }
    return want;
  }

  // over into the other lane of this road, round what is stopped in front (a road of two lanes
  // going this way, the other lane clear by it)
  overtake(c, g) {
    const offs = laneOffsets(g.from, g.dx, g.dz);
    if (offs.length < 2 || g.off === undefined) return false;
    const off = offs.reduce((b, o) => (Math.abs(o - g.off) > Math.abs(b - g.off) ? o : b), offs[0]);
    if (Math.abs(off - g.off) < 0.5) return false;
    const A = g.from;
    const B = g.node;
    const along = (c.pos.x - A.x) * g.dx + (c.pos.z - A.z) * g.dz;
    // the other lane clear from a little behind to well in front
    const tx = A.x + g.dx * along;
    const tz = A.z + g.dz * along;
    for (const o of this.list) {
      if (o === c) continue;
      const oa = (o.pos.x - A.x) * g.dx + (o.pos.z - A.z) * g.dz;
      if (oa < along - 10 || oa > along + 16) continue;
      // (its offset to the right of the road's middle)
      const os = (o.pos.x - tx) * -g.dz + (o.pos.z - tz) * g.dx;
      if (Math.abs(os - off) < 2.4) return false;
    }
    const len = Math.abs(B.x - A.x) + Math.abs(B.z - A.z);
    const end = len - stopDist(B, g.dz !== 0);
    if (end - along < 20) return false;
    // what it is going round: the nearest in front, in its lane
    let by = null;
    let bd = 16;
    for (const o of this.list) {
      if (o === c) continue;
      const oa = (o.pos.x - A.x) * g.dx + (o.pos.z - A.z) * g.dz - along;
      const os = (o.pos.x - tx) * -g.dz + (o.pos.z - tz) * g.dx;
      if (oa > 0 && oa < bd && Math.abs(os - g.off) < 1.6) {
        bd = oa;
        by = o;
      }
    }
    const path = new Path();
    path.push(lanePoint(A, g.dx, g.dz, g.off, along - 2), c.maxSpeed);
    path.push(lanePoint(A, g.dx, g.dz, g.off, along), c.maxSpeed);
    for (let k = 1; k <= 5; k++) {
      const u = k / 5;
      const sm = u * u * (3 - 2 * u);
      path.push(lanePoint(A, g.dx, g.dz, g.off + (off - g.off) * sm, along + k * 1.8), 5.5);
    }
    path.push(lanePoint(A, g.dx, g.dz, off, end), c.maxSpeed);
    path.gates.push({ s: path.len, node: B, axis: g.axis, from: A, dx: g.dx, dz: g.dz, off });
    c.path = path;
    c.s = 2;
    c.route = { to: B, dx: g.dx, dz: g.dz, off };
    c.turns = [];
    c.signal = 0;
    c.passBy = by;
    c.passUntil = c.s + 9 + (by ? by.halfLen * 2 + 4 : 0);
    this.extend(c);
    this.stats.overtakes++;
    return true;
  }

  // shots, a bang near the street (Civilians.panic): some put their foot down, some get out
  // and run, some freeze
  scare(pos, radius) {
    const game = this.game;
    if (game.classic) return;
    const r = Math.min(radius, 35);
    for (const c of this.list) {
      if (!c.driver || c.police || c.emergency || c.mode !== 'drive' || c.wrecked || c.stopped || (c.scaredT || 0) > game.time) continue;
      if (Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) > r) continue;
      c.scaredT = game.time + 12;
      const k = Math.random();
      if (k < 0.45) {
        c.fleeT = 8;
        c.maxSpeed0 = c.maxSpeed0 || c.maxSpeed;
        c.maxSpeed = c.maxSpeed0 * 1.45;
        if (this.near(c, 40)) game.audio.play('honk', 0.4);
      } else if (k < 0.75 && c.speed < 7) {
        c.stopped = true;
        c.driverOut = true;
        game.ejectDriver(c.driver, c.pos, c.yaw, false);
        c.driver = null;
        this.stats.bailed++;
      } else c.brakeT = 3 + Math.random() * 3;
    }
  }

  // (ROADMAP 4.7) a shot's path (o + d t, t from 0 to maxT) through a car of the traffic, or
  // through one of yours standing about (not skip, the one the shooter sits in): the nearest,
  // where, the side it went in by (in the world), and whether the car is yours
  segmentHit(ox, oy, oz, dx, dy, dz, maxT, skip = null) {
    let best = null;
    let bt = maxT;
    const dd = dx * dx + dz * dz || 1e-9;
    const test = (c, hl, hw, h, own) => {
      if (c === skip) return;
      const cx = c.pos.x;
      const cz = c.pos.z;
      // (nowhere near the shot's path)
      const tq = Math.max(0, Math.min(bt, ((cx - ox) * dx + (cz - oz) * dz) / dd));
      if (Math.hypot(ox + dx * tq - cx, oz + dz * tq - cz) > hl + 0.8) return;
      const cy = Math.cos(c.yaw);
      const sy = Math.sin(c.yaw);
      const px = ox - cx;
      const pz = oz - cz;
      const lo = [px * cy - pz * sy, oy - (c.pos.y || 0), px * sy + pz * cy];
      const ld = [dx * cy - dz * sy, dy, dx * sy + dz * cy];
      const lo0 = [-hw, 0.12, -hl];
      const hi0 = [hw, h, hl];
      let t0 = 0;
      let t1 = bt;
      let axis = -1;
      let sgn = 0;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(ld[k]) < 1e-9) {
          if (lo[k] < lo0[k] || lo[k] > hi0[k]) return;
          continue;
        }
        let ta = (lo0[k] - lo[k]) / ld[k];
        let tb = (hi0[k] - lo[k]) / ld[k];
        let s0 = -1;
        if (ta > tb) {
          const tt = ta;
          ta = tb;
          tb = tt;
          s0 = 1;
        }
        if (ta > t0) {
          t0 = ta;
          axis = k;
          sgn = s0;
        }
        if (tb < t1) t1 = tb;
        if (t0 > t1) return;
      }
      if (t0 < bt) {
        bt = t0;
        // (the face it went in by, back in the world: local x is the car's left, z its front)
        const nx = axis === 0 ? sgn * cy : axis === 2 ? sgn * sy : 0;
        const nz = axis === 0 ? -sgn * sy : axis === 2 ? sgn * cy : 0;
        best = { car: c, t: t0, own, nx, ny: axis === 1 ? sgn : 0, nz };
      }
    };
    for (const c of this.list) {
      if (c.gone || c.poofT !== undefined) continue;
      const K = KINDS[c.spec.kind];
      test(c, c.halfLen, c.halfWid, K ? K.roofY || 1.5 : 1.4, false);
    }
    for (const v of this.game.vehicles.list) {
      if (v.kind !== 'car' || v.dead) continue;
      const K = KINDS[v.carKind] || KINDS.sedan;
      test(v, v.halfLen || K.len / 2, v.halfWid || K.W / 2, K.roofY || 1.45, true);
    }
    return best;
  }

  // a car of the traffic shot at: the driver runs or floors it (the police take it personally)
  shotAt(c, owner) {
    const game = this.game;
    if (owner !== 'player') return;
    if (c.police) {
      game.onCrime('hurtCop', c.pos.x, c.pos.z);
      return;
    }
    if ((c.scaredT || 0) > game.time) return;
    this.scare(c.pos, 3);
  }

  // two cars of the traffic run into each other (a red light taken, a car pushed off its lane):
  // a crunch, both stopped with their hazards going, the drivers out
  crashes(dt) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const A = L[i];
      if (A.poofT !== undefined || A.gone || A.spec.kind === 'moto' || A.speed < 2.5 || A.crashed || A.police || A.tail) continue;
      for (let j = 0; j < L.length; j++) {
        const B = L[j];
        if (B === A || B.poofT !== undefined || B.gone || B.crashed || B.spec.kind === 'moto' || B.police || B.tail) continue;
        const dx = B.pos.x - A.pos.x;
        const dz = B.pos.z - A.pos.z;
        const reach = A.halfLen + B.halfLen;
        if (dx * dx + dz * dz > reach * reach) continue;
        // (the boxes: does the corner of one reach into the other?)
        if (this.boxDist(B, A.pos.x + Math.sin(A.yaw) * A.halfLen * 0.8, A.pos.z + Math.cos(A.yaw) * A.halfLen * 0.8) > 0.1) continue;
        // (one behind the other in a queue is not a crash)
        if (Math.abs(Math.sin(A.yaw - B.yaw)) < 0.4 && Math.cos(A.yaw - B.yaw) > 0) continue;
        this.crash(A, B);
        break;
      }
    }
  }

  crash(A, B) {
    const game = this.game;
    const x = (A.pos.x + B.pos.x) / 2;
    const z = (A.pos.z + B.pos.z) / 2;
    const v = Math.max(A.speed, B.speed);
    for (const c of [A, B]) {
      c.crashed = true;
      c.stopped = true;
      c.path = null;
      c.speed *= 0.2;
      c.hazard = true;
    }
    this.stats.crashes++;
    const d = Math.hypot(x - game.player.pos.x, z - game.player.pos.z);
    if (d < 70) game.audio.play('crash', Math.max(0.25, 1 - d / 70));
    game.fx.sparks(x, 0.7, z, 10, [0.9, 0.9, 0.95]);
    game.fx.crumbs(x, 0.5, z, 12, 2.4);
    if (game.damage) {
      game.damage.hit(A, x, 0.7, z, v * 1.6);
      game.damage.hit(B, x, 0.7, z, v * 1.6);
    }
    if (game.reactions) game.reactions.note('crash', x, z);
    // the drivers get out a moment later
    for (const c of [A, B]) c.outT = game.time + 1.8 + Math.random() * 1.5;
  }

  // how fast a bus may go to stop at the next bus stop on its right (and wait there a while)
  busStop(c, dt) {
    if (c.dwell > 0) {
      c.dwell -= dt;
      c.dwellT = (c.dwellT || 0) + dt;
      // (GTA IV: its hazards on at the stop; the ones still on their way to its door waited for,
      // a while - game/routines.js)
      if (!this.game.classic) {
        c.sig2 = 2;
        if (c.dwell <= 0 && c.dwellT < 14 && this.boarding(c)) c.dwell = 0.3;
      }
      if (c.dwell <= 0) {
        this.game.audio.play && this.near(c, 30) && this.game.audio.play('click', 0.3);
        c.dwellT = 0;
        // (and out into the traffic again, the left signal on)
        c.leaveT = 2.6;
        if (c.lineStop && c.lineStop === c.lastStop) {
          c.lineStop = null;
          this.lineStats.served++;
        }
      }
      return 0;
    }
    if (c.leaveT > 0) {
      c.leaveT -= dt;
      if (!this.game.classic) c.sig2 = 1;
    }
    const stops = this.stops;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    let best = null;
    let bd = 40;
    for (let i = 0; i < stops.length; i++) {
      const st = stops[i];
      if (st === c.lastStop) continue;
      const dx = st.x - c.pos.x;
      const dz = st.z - c.pos.z;
      const along = dx * fx + dz * fz;
      // (its right is (-fz, fx))
      const right = -dx * fz + dz * fx;
      if (right < 1.5 || right > 4.8 || along < 0 || along > bd) continue;
      bd = along;
      best = st;
    }
    if (!best) return Infinity;
    // the front doors by the shelter
    const dist = bd - (c.halfLen - 1.5);
    // (pulling in: the right signal)
    if (dist < 32 && !this.game.classic) c.sig2 = -1;
    if (dist < 0.6 && c.speed < 0.6) {
      c.dwell = 4 + Math.random() * 3;
      c.dwellT = 0;
      c.lastStop = best;
      return 0;
    }
    return Math.max(0, Math.sqrt(2 * DECEL * Math.max(0, dist)) * 0.85);
  }

  // (GTA IV) somebody still walking up to this bus's front door (game/routines.js: getting on)
  boarding(c) {
    const R = this.game.routines;
    if (!R || !R.people || !R.people.size) return false;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const dx = c.pos.x + fx * (c.halfLen - 1.4) - fz * 1.5;
    const dz = c.pos.z + fz * (c.halfLen - 1.4) + fx * 1.5;
    for (const v of R.people) if (v.phase === 'board' && v.door && Math.abs(v.door.x - dx) + Math.abs(v.door.z - dz) < 3) return true;
    return false;
  }

  // ------------------------------------------------------------------ the buses' rounds (GTA IV)
  // is bus stop st on the road on from crossing B along (dx, dz), ahead of it?
  stopAhead(st, B, dx, dz) {
    const along = (st.x - B.x) * dx + (st.z - B.z) * dz;
    const side = Math.abs((st.x - B.x) * dz - (st.z - B.z) * dx);
    return along > 0 && along < 400 && side < 16;
  }

  // a bus along to one of the stops near p: the ones where people wait first (game/routines.js),
  // none that a bus is already on its way to, not more buses round you than a city has
  sendBus(p) {
    const game = this.game;
    let buses = 0;
    for (const c of this.list) if (c.bus && Math.abs(c.pos.x - p.x) + Math.abs(c.pos.z - p.z) < 330) buses++;
    if (buses >= (game.touch ? 2 : 3)) return false;
    const R = game.routines;
    let best = null;
    let bs = -Infinity;
    for (const st of this.stops) {
      const d = Math.hypot(st.x - p.x, st.z - p.z);
      if (d > 170) continue;
      let due = false;
      for (const c of this.list) if (c.bus && c.lineStop === st) due = true;
      if (due) continue;
      let waiting = 0;
      if (R) {
        for (const pl of R.places) {
          if (pl.kind !== 'bus' || pl.stop !== st || !pl.active) continue;
          for (const sp of pl.seats) if (sp.who) waiting++;
          for (const sp of pl.stands) if (sp.who) waiting++;
        }
      }
      const score = waiting * 30 - d + Math.random() * 25;
      if (score > bs) {
        bs = score;
        best = st;
      }
    }
    return !!(best && this.busTo(best));
  }

  // a bus in the curb lane of stop st's road, far enough back along it to come up to the stop
  // from out of sight (o.near: close, in plain view - the tests'); it keeps straight on to it
  busTo(st, o = {}) {
    const c = this.approach(st.x, st.z, st.yaw, { kind: 'bus', color: BUS_COLORS[Math.floor(Math.random() * BUS_COLORS.length)] }, o);
    if (!c) return null;
    c.lineStop = st;
    this.lineStats.sent++;
    return c;
  }

  // a new car of the traffic (spec) in the curb lane of the road beside the place (x, z) whose
  // front looks at the road along yaw (a bus stop, a shop), some way back along the road so that
  // it comes up to it with the place on its right: out of sight of you, or (o.near) close by
  approach(x, z, yaw, spec, o = {}) {
    const tx = Math.sin(yaw);
    const tz = Math.cos(yaw);
    // (the way the traffic goes past it: with the place on its right)
    const dx = Math.round(-tz);
    const dz = Math.round(tx);
    if (Math.abs(dx) + Math.abs(dz) !== 1) return null;
    // the crossing of its road just behind the place, and the one after it
    let A = null;
    let aBest = Infinity;
    for (const n of NODES) {
      const side = Math.abs((x - n.x) * dz - (z - n.z) * dx);
      if (side > 24) continue;
      const along = (x - n.x) * dx + (z - n.z) * dz;
      if (along > 8 && along < aBest) {
        aBest = along;
        A = n;
      }
    }
    if (!A) return null;
    const step = (n, sx, sz) => n.nb.find((m) => Math.sign(m.x - n.x) === sx && Math.sign(m.z - n.z) === sz) || null;
    const B = step(A, dx, dz);
    const P = step(A, -dx, -dz);
    if (!B) return null;
    const alongZ = dz !== 0;
    const cam = this.game.camera;
    const fwd = cam.getWorldDirection(this._fwd || (this._fwd = new THREE.Vector3()));
    for (const D of o.near ? [34, 46, 60] : [80, 100, 125, 150, 175]) {
      // (D metres back from it: on A's road to it, or on the one before A)
      let E0 = A;
      let E1 = B;
      let t = aBest - D;
      if (t < stopDist(A, alongZ) + 3) {
        if (!P) continue;
        E0 = P;
        E1 = A;
        const len = Math.abs(A.x - P.x) + Math.abs(A.z - P.z);
        t = len + t;
        if (t > len - stopDist(A, alongZ) - 8 || t < stopDist(P, alongZ) + 3) continue;
      }
      const offs = laneOffsets(E0, dx, dz);
      const q = lanePoint(E0, dx, dz, offs[offs.length - 1], t);
      if (!o.near) {
        const vx = q[0] - cam.position.x;
        const vz = q[1] - cam.position.z;
        const d = Math.hypot(vx, vz) || 1;
        if (d < 110 && (vx * fwd.x + vz * fwd.z) / d > 0.15) continue;
      }
      let clear = true;
      for (const c of this.list) if (Math.abs(c.pos.x - q[0]) + Math.abs(c.pos.z - q[1]) < 16) clear = false;
      if (!clear) continue;
      const c = this.newCar(spec, o.maxSpeed ? { maxSpeed: o.maxSpeed } : {});
      // (straight on along the road to it: game/traffic.js extend)
      c.lineStop = { x, z };
      this.placeOnEdge(c, E0, E1, offs.length - 1, t);
      c.lineStop = null;
      this.list.push(c);
      return c;
    }
    return null;
  }

  // (for the tests: a bus up to stop st now, in plain view)
  debugBus(st) {
    return this.busTo(st, { near: true });
  }

  // ------------------------------------------------------------------ the zebras (GTA IV)
  // is somebody on the zebra across the road car-turn T turns into (or stepping onto it)?
  zebraBusy(T) {
    const n = T.node;
    // (the road it turns into goes along (T.ex, T.ez) out of the crossing; its zebra is just past
    // the crossing's own box, the width of the road across)
    const alongX = T.ex !== 0;
    const t0 = (alongX ? n.ave.half : n.street.half) + 0.1;
    const half = (alongX ? n.street.half : n.ave.half) + 0.9;
    const pl = this.game.player;
    if (!pl.inVehicle && pl.mode !== 'dead' && onZebra(n, T.ex, T.ez, t0, half, pl.pos.x, pl.pos.z)) return true;
    const hs = this.game.civilians.list;
    for (let i = 0; i < hs.length; i++) {
      const h = hs[i];
      if (h.inside || h.alive === false) continue;
      if (onZebra(n, T.ex, T.ez, t0, half, h.pos.x, h.pos.z)) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ pulling over (GTA IV)
  // how far c may ease over to its right from its lane, where it will be ahead metres on: to a
  // hand's width off the curb; on a street, into the parking lane where nobody is parked beside it
  // (and not at all inside a crossing)
  curbRoom(c, ahead = 0) {
    const g = c.path && c.path.gates[0];
    if (!g || g.off === undefined) return 0;
    const A = g.from;
    const px = c.pos.x + g.dx * ahead;
    const pz = c.pos.z + g.dz * ahead;
    // (on the road from A to the gate's crossing, in its lane? not turning through a crossing)
    const along = (px - A.x) * g.dx + (pz - A.z) * g.dz;
    const lat = (px - A.x) * -g.dz + (pz - A.z) * g.dx;
    const len = Math.abs(g.node.x - A.x) + Math.abs(g.node.z - A.z);
    const alongZ = g.dz !== 0;
    if (along < stopDist(A, alongZ) + 1 || along > len - stopDist(g.node, alongZ) || Math.abs(lat - g.off - (c.side || 0)) > 1.2) return 0;
    // (from the curb lane only: not across the lane beside it)
    const offs = laneOffsets(A, g.dx, g.dz);
    if (Math.abs(g.off - offs[offs.length - 1]) > 0.3) return 0;
    const road = alongZ ? A.ave : A.street;
    let room = road.half - g.off - c.halfWid - 0.3;
    if (room < 0.15) return 0;
    if (room > 1.0) {
      // (the parked cars beside it and a little way ahead and behind)
      const fx = g.dx;
      const fz = g.dz;
      const P = this.parked;
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        if (p.taken || p.flat) continue;
        const dx = p.pos.x - px;
        const dz = p.pos.z - pz;
        if (Math.abs(dx) + Math.abs(dz) > 14) continue;
        const pa = dx * fx + dz * fz;
        const ps = dx * -fz + dz * fx;
        if (Math.abs(pa) > c.halfLen + p.halfLen + 1.2 || ps < 0.5) continue;
        room = Math.min(room, ps - p.halfWid - c.halfWid - 0.35);
      }
    }
    return Math.max(0, Math.min(room, 3));
  }

  // (GTA IV) how far over to its right c may be where it is now (from its lane's line): to a
  // hand's width off the curb, or off the cars parked beside it. Its nose is turned in as it
  // goes (pullV: metres over for a metre on), so what must clear a parked car is the part of it
  // level with that car's end: the end of the car behind a space is driven round, not through.
  roomBeside(c) {
    const g = c.path && c.path.gates[0];
    if (!g || g.off === undefined) return 0;
    const road = g.dz !== 0 ? g.from.ave : g.from.street;
    let room = road.half - g.off - c.halfWid - 0.3;
    if (room <= 1.0) return Math.max(0, room);
    const fx = g.dx;
    const fz = g.dz;
    const s0 = c.side || 0;
    const slope = c.pullV || 0;
    const P = this.parked;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (p.taken || p.flat || p.poofT !== undefined) continue;
      const dx = p.pos.x - c.pos.x;
      const dz = p.pos.z - c.pos.z;
      if (Math.abs(dx) + Math.abs(dz) > 14) continue;
      const pa = dx * fx + dz * fz;
      // (how far right of its lane's line: its own side shift taken off)
      const ps = dx * -fz + dz * fx + s0;
      if (ps < 1.0 || Math.abs(pa) > c.halfLen + p.halfLen + 0.4) continue;
      // (the part of it level with that car's nearer end: its nose for one in front, else the
      // other's front end)
      const u = pa >= 0 ? c.halfLen : Math.max(-c.halfLen, Math.min(c.halfLen, pa + p.halfLen));
      room = Math.min(room, ps - p.halfWid - c.halfWid - 0.25 - u * slope);
    }
    return Math.max(0, Math.min(room, 3));
  }

  near(c, r) {
    const p = this.game.player.pos;
    return Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < r;
  }

  // a talking point above the car (for the driver's shouting)
  driverAnchor(c) {
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    if (!c._anchor) c._anchor = { pos: new THREE.Vector3(), fig: null, alive: true };
    c._anchor.pos.set(c.pos.x + fx * DRIVER_SEAT.u + fz * 0.42, 0.2, c.pos.z + fz * DRIVER_SEAT.u - fx * 0.42);
    return c._anchor;
  }

  // put a seated figure in a car at pos/yaw: side 1 = driver (left), -1 = passenger; S: the
  // kind's own seat (render/cars.js K.seat: the car you drive, its windows down, ROADMAP 4.5)
  seat(fig, pos, yaw, dt, side = 1, S = null) {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const rx = -fz;
    const rz = fx;
    const u = S ? S.u : DRIVER_SEAT.u;
    const s = (S ? S.s : -DRIVER_SEAT.s) * side; // "right" points away from the driver's seat
    const y = S ? S.y : -0.12;
    fig.pos.set(pos.x + fx * u - rx * s, pos.y + y, pos.z + fz * u - rz * s);
    fig.yaw = yaw;
    fig.sit = 1;
    fig.speed = 0;
    if (!fig.wheel) fig.wheel = new THREE.Vector3();
    fig.wheel.set(pos.x + fx * (u + 0.55) - rx * s, pos.y + y + 1.04, pos.z + fz * (u + 0.55) - rz * s);
    fig.reachR = side > 0 && !fig.shootOut ? fig.wheel : null;
    // (shooting out of the window: the left hand on the wheel instead, ROADMAP 4.7)
    if (fig.shootOut) fig.reachL = side > 0 ? fig.wheel : null;
    fig.update(dt);
  }

  // ------------------------------------------------------------------ police cars
  makeCrew(types) {
    return types.map((type) => ({ type, look: type === 'swat' ? swatLook() : copLook(), fig: null }));
  }

  policeCar(x, z, yaw, crewTypes, mode) {
    const c = this.newCar({ kind: 'sedan', color: POLICE_WHITE, police: true }, { driver: false, maxSpeed: 11 });
    c.mode = mode;
    c.pos.set(x, 0, z);
    c.yaw = yaw;
    c.speed = mode === 'pursuit' ? 10 : 0;
    c.ink = 200;
    c.crew = this.makeCrew(crewTypes);
    c.siren = mode === 'pursuit';
    c.chase = null;
    c.chaseI = 0;
    c.chaseT = 0;
    this.list.push(c);
    return c;
  }

  spawnPolice(x, z, yaw, crewTypes) {
    for (const c of this.list) if (Math.hypot(c.pos.x - x, c.pos.z - z) < 7) return null;
    return this.policeCar(x, z, yaw, crewTypes, 'pursuit');
  }

  // a patrol car doing its rounds near (but not right next to) you
  spawnPatrol() {
    const p = this.game.anchorPos();
    // (GTA IV: cruising, slower than the traffic round it - a look at the street as it goes; ?classic:
    // as it always did)
    const c = this.spawnCar(p, 50, 130, { kind: 'sedan', color: POLICE_WHITE, police: true }, { driver: false, maxSpeed: this.game.classic ? 10 : 7.4 + Math.random() * 1.4 });
    if (!c) return null;
    c.mode = 'patrol';
    c.patrol = true;
    c.crew = this.makeCrew(['cop', 'cop']);
    c.ink = 200;
    return c;
  }

  // chase: follow a path to where the police think you are, pull up and let them out
  updatePolice(c, dt) {
    const game = this.game;
    const P = game.police;
    // (with you in a car: up behind you and into your back wheel - ROADMAP 6.1, game/chase.js)
    if (c.mode === 'pursuit' && game.chase && game.chase.drive(c, dt)) return;
    if (c.mode === 'pursuit') {
      c.siren = true;
      c.path = null;
      // (v5, ROADMAP 11.17: lost you - to its corner of the box round where you were last seen)
      const T = P.searching && c.cordon ? c.cordon : P.target();
      const d = Math.hypot(T.x - c.pos.x, T.z - c.pos.z);
      c.chaseT -= dt;
      if (!c.chase || c.chaseT <= 0) {
        c.chaseT = 1.4;
        const path = game.enemies.pf.find(c.pos.x, c.pos.z, T.x, T.z, 3000);
        if (path) {
          c.chase = path;
          c.chaseI = 0;
        }
      }
      let wx = T.x;
      let wz = T.z;
      if (c.chase) {
        while (c.chaseI < c.chase.length - 1 && Math.hypot(c.chase[c.chaseI][0] - c.pos.x, c.chase[c.chaseI][1] - c.pos.z) < 4) c.chaseI++;
        wx = c.chase[c.chaseI][0];
        wz = c.chase[c.chaseI][1];
      }
      const want = Math.atan2(wx - c.pos.x, wz - c.pos.z);
      const turn = Math.abs(angleDiff(c.yaw, want));
      const before = c.yaw;
      c.yaw = dampAngle(c.yaw, want, 3.2, dt);
      c.steer = damp(c.steer, angleDiff(before, c.yaw) / Math.max(dt, 1e-3) * 0.3, 8, dt);
      const a = this.ahead(c);
      const why = a && a.d < 8 ? a.why : null;
      const p = game.player;
      const pp = p.inVehicle ? p.inVehicle.pos : p.pos;
      const sees = d < 30 && game.world.collision.lineOfSight(c.pos.x, 1.4, c.pos.z, pp.x, pp.y + 1.2, pp.z);
      if (d < 14 || (sees && d < 24) || why === 'player') {
        c.speed = damp(c.speed, 0, 5, dt);
        if (c.speed < 2) {
          this.park(c);
          P.deploy(c);
        }
      } else {
        // (after you in a car: as fast as the stars let it, ROADMAP 6.1)
        const vmax = (game.chase && game.chase.pathSpeed()) || (d < 35 ? 9 : 17);
        c.speed = damp(c.speed, vmax * (turn > 0.9 ? 0.3 : turn > 0.4 ? 0.65 : 1), why ? 6 : 1.4, dt);
        if (why === 'car' || why === 'other') c.speed = Math.min(c.speed, 3);
      }
      // the world's walls stop a car like anybody else
      const col = game.world.collision;
      if (col.pointInside(c.pos.x + Math.sin(c.yaw) * 2.4, 0.8, c.pos.z + Math.cos(c.yaw) * 2.4, 0.3)) c.speed = Math.min(c.speed, 1.5);
    } else {
      // parked with the lights on while the chase lasts, or leaving
      c.siren = c.mode === 'parked' && P.hostile;
      c.speed = damp(c.speed, 0, 6, dt);
      if (c.mode === 'patrol' && !c.path) c.mode = 'leave';
    }
  }

  // a stopped police car is real cover: bullets hit it and officers crouch behind it
  park(c) {
    if (c.box !== undefined) return;
    const game = this.game;
    const fx = Math.abs(Math.sin(c.yaw));
    const fz = Math.abs(Math.cos(c.yaw));
    const hx = fx * c.halfLen + fz * c.halfWid;
    const hz = fz * c.halfLen + fx * c.halfWid;
    c.box = game.world.collision.addBox(c.pos.x - hx, c.pos.z - hz, c.pos.x + hx, c.pos.z + hz, 0, 1.45, 'car', { car: c });
    if (game.enemies.cover) game.enemies.cover.addBox(game.world.collision.boxes[c.box]);
    if (game.world.nav) game.world.nav.refresh(c.pos.x - hx - 1, c.pos.z - hz - 1, c.pos.x + hx + 1, c.pos.z + hz + 1);
  }

  unpark(c) {
    if (c.box === undefined || c.box === null) return;
    const game = this.game;
    const b = game.world.collision.boxes[c.box];
    game.world.collision.remove(c.box);
    if (game.world.nav && b) game.world.nav.refresh(b.x0 - 1, b.z0 - 1, b.x1 + 1, b.z1 + 1);
    c.box = undefined;
  }

  // ------------------------------------------------------------------ drawing
  draw(camPos) {
    const cars = this.game.cars;
    if (!cars) return;
    const cam = this.game.camera;
    const fwd = cam.getWorldDirection(this._fwd3 || (this._fwd3 = new THREE.Vector3()));
    this._blink = Math.floor(this.game.time * 5) % 2;
    // (GTA IV: what is in the width of the view, and a little - the camera's own angle, so the
    // phone's too; cosA -1: everything in front, looking straight down)
    const hl = Math.hypot(fwd.x, fwd.z) || 1;
    const hx = fwd.x / hl;
    const hz = fwd.z / hl;
    let cosA = -1;
    if (hl > 0.5 && cam.isPerspectiveCamera) {
      const half = Math.atan(Math.tan((cam.fov * Math.PI) / 360) * cam.aspect) + 0.3;
      if (half < Math.PI / 2) cosA = Math.cos(half);
    }
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.gone || !this.inSight(c, 260, camPos, fwd)) continue;
      const vx = c.pos.x - camPos.x;
      const vz = c.pos.z - camPos.z;
      const d = Math.hypot(vx, vz);
      if (d > 14 && vx * hx + vz * hz < cosA * d - c.halfLen - 6) continue;
      this.drawOne(cars, c);
    }
    // in the rain the wipers of the cars near you go (the parked ones' stay down)
    const w = this.game.weather;
    const rain = w ? w.cur.rain : 0;
    if (rain > 0.15) {
      const fr = this.game.figures;
      const t = this.game.time;
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c.wrecked || c.poofT !== undefined || c.spec.kind === 'bus' || c.spec.kind === 'moto') continue;
        const dx = c.pos.x - camPos.x;
        const dz = c.pos.z - camPos.z;
        if (dx * dx + dz * dz > 26 * 26 || dx * fwd.x + dz * fwd.z < -4) continue;
        // (not on a car that was not drawn, off to the side of the view)
        const d = Math.hypot(dx, dz);
        if (d > 14 && dx * hx + dz * hz < cosA * d - c.halfLen - 6) continue;
        if (c.wipeOff === undefined) c.wipeOff = Math.random();
        drawWipers(fr, c.spec.kind, c.pos.x, c.pos.y || 0, c.pos.z, c.yaw, wiperSweep(t, rain, c.wipeOff), i * 7.1);
      }
    }
    // (GTA IV) the parked cars - the mainland's curbs are full of them now: the ones within a
    // radius of you, as many as the cars' batches have room for (the tyres' fill first, four a
    // car), with room kept for the cars you drive and the motorbikes; more of them wanted than
    // there was room for, and the radius is drawn in a little for next time (out again when there
    // is room)
    // (and only those in the width of the view, as above: a street's worth of them off to the
    // side of the screen are not drawn for nothing)
    // (on a phone, out to 110 m: further off they are a few dots on its screen, and each costs
    // the same to draw as one beside you)
    const parked = this.parked;
    const T = cars.tyres;
    const room = T && T.cap ? Math.floor((T.cap - T.n - 48) / 4) : 1e9;
    const maxR = this.game.touch ? 110 : 190;
    const R = Math.min(this.parkR, maxR);
    const R2 = R * R;
    let shown = 0;
    let wanted = 0;
    for (let i = 0; i < parked.length; i++) {
      const c = parked[i];
      if (c.taken || (c.poofT !== undefined && c.poofT > 0.45)) continue;
      const vx = c.pos.x - camPos.x;
      const vz = c.pos.z - camPos.z;
      const d2 = vx * vx + vz * vz;
      if (d2 > R2 || (d2 > 196 && vx * hx + vz * hz < cosA * Math.sqrt(d2) - 6)) continue;
      wanted++;
      if (shown >= room) continue;
      this.drawOne(cars, c);
      shown++;
    }
    this.parkShown = shown;
    // (parkRFreeze: the tests', to measure what they cost)
    if (this.parkRFreeze) return;
    if (wanted > room) this.parkR = Math.max(50, R * 0.9);
    else if (wanted < room * 0.8 && R < maxR) this.parkR = Math.min(maxR, R * 1.04 + 1);
  }

  inSight(c, far, camPos, fwd) {
    const vx = c.pos.x - camPos.x;
    const vz = c.pos.z - camPos.z;
    const d = Math.hypot(vx, vz);
    return d < far && (d < 14 || vx * fwd.x + vz * fwd.z > -12);
  }

  drawOne(cars, c) {
    const spec = c.spec;
    // (a motorbike and its rider: game/fleet.js)
    if (spec.kind === 'moto') return;
    let scale = 1;
    let squash = 1;
    if (c.poofT !== undefined) {
      const k = Math.max(0.01, 1 - c.poofT / 0.45);
      scale = k;
      squash = k;
    }
    if (c.flat) squash = 0.42;
    // (one set of options for every car: the cars read it at once)
    const o = _drawOpts;
    o.spin = c.wheel || 0;
    o.steer = Math.max(-0.5, Math.min(0.5, c.steer || 0));
    o.extra = spec.police ? 'police' : spec.taxi ? 'taxi' : spec.extra || (spec.kind === 'van' ? null : spec.kind === 'bus' ? 'bus' : 'plain');
    o.siren = spec.police || spec.siren ? (c.siren || c.lights ? this._blink : -1) : undefined;
    // (dents, the glass, a flat: game/damage.js; the turn signal, or the hazards)
    o.dmg = c.dmg || null;
    o.signal = c.hazard ? 2 : c.signal || 0;
    // (a taxi with somebody in it: the sign on the roof dark)
    o.busy = !!c.fare;
    o.scale = scale;
    o.squash = squash;
    // (ROADMAP 11.20: square wheels drawn onto it go round in place of its own - game/fuse.js)
    o.noWheels = !!c.fuseNoWheels;
    cars.draw(spec.kind, c.wrecked ? WRECK : spec.color, c.pos.x, c.pos.y || 0, c.pos.z, c.yaw, o);
  }

  // ------------------------------------------------------------------ the player and cars
  *all() {
    for (const c of this.list) if (c.poofT === undefined) yield c;
    for (const c of this.parked) if (!c.taken && c.poofT === undefined) yield c;
  }

  // a car whose door the player is standing at
  nearestDoor(pos, maxD = 1.6) {
    let best = null;
    let bd = maxD;
    for (let li = 0; li < 2; li++) {
      const list = li === 0 ? this.list : this.parked;
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c.poofT !== undefined || c.gone || (li === 1 && c.taken)) continue;
        // (nobody drives off with a bus)
        if (c.flat || c.bus) continue;
        const d = this.boxDist(c, pos.x, pos.z);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
    }
    return best;
  }

  boxDist(c, x, z) {
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const dx = x - c.pos.x;
    const dz = z - c.pos.z;
    const along = Math.abs(dx * fx + dz * fz) - c.halfLen;
    const side = Math.abs(dx * fz - dz * fx) - c.halfWid;
    return Math.hypot(Math.max(0, along), Math.max(0, side));
  }

  // pull the car out of traffic (or off the curb) for the player to drive (the caller makes the
  // vehicle)
  take(c) {
    if (c.parkedCar) {
      c.taken = true;
      this.unpark(c);
      return { spec: c.spec, pos: c.pos.clone(), yaw: c.yaw, driver: null, crew: null, police: false, parked: true, wrecked: c.wrecked, dmg: c.dmg };
    }
    const i = this.list.indexOf(c);
    if (i >= 0) this.list.splice(i, 1);
    this.unpark(c);
    if ((c.rider || c.garbage || c.pickup || c.delivery || c.pulled || c.tstop) && this.game.fleet) this.game.fleet.forget(c);
    const driver = c.driver;
    const crew = c.crew;
    c.driver = null;
    c.crew = null;
    return { spec: c.spec, pos: c.pos.clone(), yaw: c.yaw, driver, crew, police: !!c.police, wrecked: c.wrecked, dmg: c.dmg };
  }

  // in front of the swinging eraser
  inArc(pos, fwd, reach) {
    let best = null;
    let bd = reach;
    for (const c of this.all()) {
      // (in front of the eraser only now and then: the plain loop is not needed here)
      const d = this.boxDist(c, pos.x, pos.z);
      if (d > bd) continue;
      const dx = c.pos.x - pos.x;
      const dz = c.pos.z - pos.z;
      if ((dx * fwd.x + dz * fwd.z) / (Math.hypot(dx, dz) || 1) < 0.2 && d > 0.5) continue;
      bd = d;
      best = c;
    }
    return best;
  }

  // the eraser rubs at a car; when it runs out of ink it is gone (the driver jumps out first)
  rub(c, amount, at) {
    c.ink -= amount;
    c.stopped = true;
    this.game.world.objects.addSpot(at.x, at.y, at.z, 0.4);
    this.game.fx.crumbs(at.x, at.y, at.z, 12, 2.6);
    if (c.driver && !c.driverOut) {
      c.driverOut = true;
      this.game.ejectDriver(c.driver, c.pos, c.yaw, false);
      c.driver = null;
    }
    if (c.ink <= 0 && c.poofT === undefined) {
      c.poofT = 0;
      if (c.parkedCar) this.unpark(c);
      this.game.fx.crumbs(c.pos.x, 1, c.pos.z, 50, 4);
      this.game.fx.smoke(c.pos.x, 1, c.pos.z, 2.4);
      this.game.audio.play('erase', 1);
      if (this.game.onCrime) this.game.onCrime('vandal', c.pos.x, c.pos.z);
    }
  }

  // keep the player's vehicles out of traffic cars (a tank flattens what it rolls over)
  collideVehicle(v) {
    if (v.flies && v.alt > 2) return;
    for (const c of this.list) {
      if (c.poofT !== undefined) continue;
      const dx = v.pos.x - c.pos.x;
      const dz = v.pos.z - c.pos.z;
      const d = Math.hypot(dx, dz);
      const r = v.radius + 1.5;
      if (d < r && d > 1e-3) {
        const push = r - d;
        v.pos.x += (dx / d) * push * 0.7;
        v.pos.z += (dz / d) * push * 0.7;
        c.pos.x -= (dx / d) * push * 0.3;
        c.pos.z -= (dz / d) * push * 0.3;
        // knocked off its lane: it stays where it was hit
        c.path = null;
        // (ROADMAP 11.12) what is drawn on it where they met: a spring bumper at its front throws the
        // car off (and it is not hurt); a blade at its back wrecks whoever rams it from behind
        const ahead = (c.pos.x - v.pos.x) * Math.sin(v.yaw) + (c.pos.z - v.pos.z) * Math.cos(v.yaw);
        if (v.bumper && ahead > 0 && Math.abs(v.speed) > 3) {
          const k = Math.min(6, Math.abs(v.speed) * 0.35 * v.bumper.k);
          c.pos.x -= (dx / d) * k;
          c.pos.z -= (dz / d) * k;
          c.yaw += (Math.random() - 0.5) * 1.2;
          if (Math.abs(v.speed) > 9) c.wrecked = true;
          v.speed *= -0.3;
          this.game.audio.play('jump', 0.7);
          this.game.camRig.addShake(0.2);
          continue;
        }
        if (v.blades && v.blades.rear && ahead < 0 && !c.wrecked) {
          c.wrecked = true;
          this.game.fx.sparks(c.pos.x, 0.9, c.pos.z, 10, [0.9, 0.9, 0.95]);
          this.game.audio.play('crash', 0.7);
          if (this.game.onCrime) this.game.onCrime('vandal', c.pos.x, c.pos.z);
        }
        // (a police car after you shoves you round instead: ROADMAP 6.1, game/chase.js)
        if (this.game.chase && this.game.chase.contact(v, c)) continue;
        if (Math.abs(v.speed) > 6) {
          // (dented where they met: game/damage.js)
          if (!this.game.classic && this.game.damage) this.game.damage.crash(v, c, Math.abs(v.speed));
          // (a blade drawn at its front, ROADMAP 11.10: it rams - the other car wrecked sooner, itself
          // hurt less)
          const ram = !!v.ram && (c.pos.x - v.pos.x) * Math.sin(v.yaw) + (c.pos.z - v.pos.z) * Math.cos(v.yaw) > 0;
          if (!c.wrecked && (v.kind === 'tank' || v.crush || Math.abs(v.speed) > (ram ? 14 / v.ram.k : 14))) {
            c.wrecked = true;
            this.game.fx.sprite('fx_crash', c.pos.x, 1.2, c.pos.z, { size: 2.4, life: 0.4 });
            this.game.audio.play('crash', 0.8);
            if (c.driver && !c.driverOut) {
              c.driverOut = true;
              this.game.ejectDriver(c.driver, c.pos, c.yaw, false);
              c.driver = null;
            }
            if (this.game.onCrime) this.game.onCrime('vandal', c.pos.x, c.pos.z);
          } else {
            this.game.audio.play('crash', 0.5);
          }
          // (people come to look: game/reactions.js)
          if (this.game.reactions) this.game.reactions.note('crash', c.pos.x, c.pos.z);
          // (a ram shielded with armour: hardly hurt at all - ROADMAP 11.12)
          if (v.kind !== 'tank') v.hurt(Math.abs(v.speed) * (ram ? (v.ram.shield ? 0.25 : 0.8) / v.ram.k : v.crush ? 0.4 : 0.8));
          v.speed *= v.kind === 'tank' || v.crush ? 0.8 : ram ? 0.7 : 0.4;
        }
      }
    }
    // (and over the parked ones: a tank - and tracks, giant wheels, ROADMAP 11.12)
    if ((v.kind === 'tank' || v.crush) && Math.abs(v.speed) > 1.5) {
      for (const c of this.parked) {
        if (c.taken || c.flat || c.poofT !== undefined) continue;
        if (this.boxDist(c, v.pos.x, v.pos.z) < 1.2) {
          c.flat = true;
          c.wrecked = true;
          this.unpark(c);
          this.game.fx.sprite('fx_crash', c.pos.x, 1.0, c.pos.z, { size: 2.6, life: 0.45 });
          this.game.fx.crumbs(c.pos.x, 0.8, c.pos.z, 24, 3);
          this.game.audio.play('crash', 0.9);
          this.game.camRig.addShake(0.25);
          if (this.game.onCrime) this.game.onCrime('vandal', c.pos.x, c.pos.z);
        }
      }
    }
  }

  // walkers bump into traffic like into parked cars
  pushOut(p, r) {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.poofT !== undefined) continue;
      const dx = p.x - c.pos.x;
      const dz = p.z - c.pos.z;
      if (dx * dx + dz * dz > 16) continue;
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      const along = dx * fx + dz * fz;
      const side = dx * fz - dz * fx;
      const hl = c.halfLen + r;
      const hw = c.halfWid + r;
      if (Math.abs(along) < hl && Math.abs(side) < hw && p.y < 1.5) {
        const pa = hl - Math.abs(along);
        const ps = hw - Math.abs(side);
        if (pa < ps) {
          const s = Math.sign(along) || 1;
          p.x += fx * pa * s;
          p.z += fz * pa * s;
        } else {
          const s = Math.sign(side) || 1;
          p.x += fz * ps * s;
          p.z -= fx * ps * s;
        }
      }
    }
  }

  // (ROADMAP 5.5) a car going faster than min (m/s) that runs into somebody at p: its front at them
  hitter(p, r, min) {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.poofT !== undefined || Math.abs(c.speed) < min) continue;
      const dx = p.x - c.pos.x;
      const dz = p.z - c.pos.z;
      if (dx * dx + dz * dz > 16) continue;
      const sg = Math.sign(c.speed);
      const fx = Math.sin(c.yaw) * sg;
      const fz = Math.cos(c.yaw) * sg;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > c.halfLen * 0.3 && along < c.halfLen + r && side < c.halfWid + r && p.y < 1.5) return c;
    }
    return null;
  }

  // correction fluid over the cars: rubbed off the page (more the nearer they are)
  whiteOut(x, y, z, radius, power) {
    const at = { x, y: 1, z };
    for (const list of [this.list, this.parked]) {
      for (const c of list) {
        if (c.taken || c.poofT !== undefined) continue;
        const d = Math.hypot(c.pos.x - x, c.pos.z - z);
        if (d > radius) continue;
        at.x = c.pos.x + (x - c.pos.x) * 0.3;
        at.z = c.pos.z + (z - c.pos.z) * 0.3;
        c.path = null;
        this.rub(c, power * (1.1 - (d / radius) * 0.6), at);
      }
    }
  }

  explosion(x, z, radius) {
    // (dents and broken glass; close to it, a fire that blows up in turn: game/damage.js)
    const dmg = !this.game.classic && this.game.damage;
    for (const c of this.list) {
      if (Math.hypot(c.pos.x - x, c.pos.z - z) < radius + 1.5) {
        if (dmg) dmg.blast(c, x, z, radius);
        else c.wrecked = true;
        c.path = null;
      }
    }
    for (const c of this.parked) {
      if (c.taken || c.poofT !== undefined) continue;
      if (Math.hypot(c.pos.x - x, c.pos.z - z) < radius + 1.5) {
        if (dmg) dmg.blast(c, x, z, radius);
        else c.wrecked = true;
      }
    }
  }
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// (x, z) on the zebra across the road out of crossing n along (ex, ez): from t0 past its middle,
// three metres of stripes, the road's half-width either side (and a step onto it from the curb)
function onZebra(n, ex, ez, t0, half, x, z) {
  const a = (x - n.x) * ex + (z - n.z) * ez - t0;
  if (a < -0.6 || a > 3.6) return false;
  return Math.abs((x - n.x) * ez - (z - n.z) * ex) < half;
}
