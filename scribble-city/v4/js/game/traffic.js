import * as THREE from 'three';
import { NODES, lightAt, laneOffsets, stopDist, lanePoint, exitsFrom } from '../world/roads.js';
import { randomCarSpec, drawWipers, wiperSweep, KINDS } from '../render/cars.js';
import { civilianLook, copLook, swatLook } from './looks.js';
import { damp, dampAngle, angleDiff } from '../core/util.js';

// The traffic of the city: sedans, taxis, vans and low sports cars in the right-hand lanes of
// every avenue and street, turning at the crossings and waiting for the lights; the cars parked
// along the curbs; the police cruisers on patrol (and, when it comes to that, on your tail).
// Nobody turns across anybody: left turns only where nothing comes the other way.
//
// A car in traffic rides its lane exactly (a path of points through the crossings ahead of it);
// one that is wrecked, chasing you or taken off its path moves on its own.

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
const _ahead = { c: null, fx: 0, fz: 0, best: Infinity, why: null, nose: 0 };
const _aheadOut = { d: 0, why: null };
function aheadTest(x, z, r, w, back) {
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
  }

  get cars() {
    return this.game.cars;
  }

  reset() {
    for (const c of this.list) this.removeCar(c);
    this.list = [];
  }

  removeCar(c) {
    if ((c.rider || c.garbage || c.pickup) && this.game.fleet) this.game.fleet.forget(c);
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
      (c.turns || (c.turns = [])).push({ s: gs, dir: e.turn > 0 ? -1 : 1 });
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
    // (o.toward: heading for p - the fire engine, ROADMAP 8.4)
    for (let tries = 0; tries < (o.toward ? 30 : 8); tries++) {
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
      if (this.list.some((c) => Math.hypot(c.pos.x - q[0], c.pos.z - q[1]) < (spec && (spec.kind === 'bus' || spec.curb || spec.emergency) ? 18 : 10))) continue;
      // (what drives about: the city's own mix; with the trucks, the motorbikes... game/fleet.js)
      const c = this.newCar(spec || (this.game.classic || !this.game.fleet ? randomCarSpec() : this.game.fleet.spec()), o);
      this.placeOnEdge(c, A, B, li, t);
      this.list.push(c);
      return c;
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
      for (const c of this.list) {
        const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
        // empty police cars go when the chase is over and you are gone
        const done = c.police && !game.police.hostile && (c.mode === 'parked' || c.mode === 'leave') && d > 60;
        // a car stuck behind a wreck (or you) gives up once nobody is looking
        const vx = c.pos.x - cam.x;
        const vz = c.pos.z - cam.z;
        const seen = Math.hypot(vx, vz) < 120 && (vx * fwd.x + vz * fwd.z) > -6;
        const stuck = c.stuckT > 9 && !seen;
        if (d > 210 || done || stuck || (c.wrecked && d > 120)) {
          this.removeCar(c);
          c.gone = true;
        }
      }
      this.list = this.list.filter((c) => !c.gone);
      // (the rush hours: the most cars there are; at night few: game/rhythm.js)
      const max = Math.round((game.touch ? 14 : 26) * (game.rhythm ? game.rhythm.cars : 1));
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
      for (let k = 0; k < 3 && n < max; k++) {
        // now and then a city bus
        const spec = buses < 2 && Math.random() < 0.1 ? { kind: 'bus', color: BUS_COLORS[Math.floor(Math.random() * BUS_COLORS.length)] } : null;
        if (this.spawnCar(p, first ? 30 : 60, 190, spec, { anywhere: first })) {
          n++;
          if (spec) buses++;
        }
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
    for (let i = 0; i < cars.length; i++) this.updateCar(cars[i], dt);
    if (!game.classic) this.crashes(dt);
    let gone = false;
    for (let i = 0; i < this.list.length; i++) if (this.list[i].poofT !== undefined && this.list[i].poofT > 0.45) gone = true;
    if (gone) {
      this.list = this.list.filter((c) => {
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
    for (let i = 0; i < os.length; i++) {
      const o = os[i];
      if (o !== c && o !== by && !(pass && o.yieldK > 0.5)) aheadTest(o.pos.x, o.pos.z, 0.8 + (o.halfWid - 0.98), 'car', o.halfLen - 2.3);
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
      if (!h.inside && h.alive !== false) aheadTest(h.pos.x, h.pos.z, 0.3, 'other', 0);
    }
    if (!A.why) return null;
    _aheadOut.d = A.best;
    _aheadOut.why = A.why;
    return _aheadOut;
  }

  updateCar(c, dt) {
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
    }
    // a bus pulls up at its stops
    if (c.bus) want = Math.min(want, this.busStop(c, dt));
    // a taxi pulling over, the garbage truck at a bin (game/fleet.js)
    if (c.garbage || c.pickup || c.dropT !== undefined) want = Math.min(want, this.game.fleet.want(c, dt));
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
    path.trim(c.s);
    path.sample(c.s, _p);
    path.sample(c.s - LOOK_AHEAD, _a);
    path.sample(c.s + LOOK_AHEAD, _b);
    c.pos.set(_p[0], 0, _p[1]);
    const yaw = Math.atan2(_b[0] - _a[0], _b[1] - _a[1]);
    c.steer = damp(c.steer, angleDiff(c.yaw, yaw) * 6, 8, dt);
    c.yaw = yaw;
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
    c.side = 1.5 * c.yieldK - 1.0 * passK;
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
      if (c.jamT > 1.8 && !c.laneTried && g && toGate > 22) {
        c.laneTried = true;
        this.overtake(c, g);
      }
      if (c.jamT > 5 && c.driver) {
        c.jamT = 2.5 + Math.random() * 2;
        if (this.near(c, 45)) {
          this.game.audio.play('honk', 0.45);
          if (Math.random() < 0.3) this.game.bubbles.say(this.driverAnchor(c), pick(['Come on!', 'Move!', 'Unbelievable...', 'Today, please!']));
        }
      }
    } else {
      c.jamT = 0;
      if (!a) c.laneTried = false;
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
      if (A.poofT !== undefined || A.spec.kind === 'moto' || A.speed < 2.5 || A.crashed || A.police || A.tail) continue;
      for (let j = 0; j < L.length; j++) {
        const B = L[j];
        if (B === A || B.poofT !== undefined || B.crashed || B.spec.kind === 'moto' || B.police || B.tail) continue;
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
      if (c.dwell <= 0) this.game.audio.play && this.near(c, 30) && this.game.audio.play('click', 0.3);
      return 0;
    }
    const stops = this.game.world.busStops || [];
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    let best = null;
    let bd = 40;
    for (const st of stops) {
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
    if (dist < 0.6 && c.speed < 0.6) {
      c.dwell = 4 + Math.random() * 3;
      c.lastStop = best;
      return 0;
    }
    return Math.max(0, Math.sqrt(2 * DECEL * Math.max(0, dist)) * 0.85);
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
    const c = this.spawnCar(p, 50, 130, { kind: 'sedan', color: POLICE_WHITE, police: true }, { driver: false, maxSpeed: 10 });
    if (!c) return null;
    c.mode = 'patrol';
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
      const T = P.target();
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
    const list = this.list;
    for (let i = 0; i < list.length; i++) if (this.inSight(list[i], 260, camPos, fwd)) this.drawOne(cars, list[i]);
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
        if (c.wipeOff === undefined) c.wipeOff = Math.random();
        drawWipers(fr, c.spec.kind, c.pos.x, c.pos.y || 0, c.pos.z, c.yaw, wiperSweep(t, rain, c.wipeOff), i * 7.1);
      }
    }
    const parked = this.parked;
    for (let i = 0; i < parked.length; i++) {
      const c = parked[i];
      if (c.taken || (c.poofT !== undefined && c.poofT > 0.45)) continue;
      if (this.inSight(c, 190, camPos, fwd)) this.drawOne(cars, c);
    }
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
    o.siren = spec.police || spec.siren ? (c.siren ? this._blink : -1) : undefined;
    // (dents, the glass, a flat: game/damage.js; the turn signal, or the hazards)
    o.dmg = c.dmg || null;
    o.signal = c.hazard ? 2 : c.signal || 0;
    // (a taxi with somebody in it: the sign on the roof dark)
    o.busy = !!c.fare;
    o.scale = scale;
    o.squash = squash;
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
        if (c.poofT !== undefined || (li === 1 && c.taken)) continue;
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
    if ((c.rider || c.garbage || c.pickup) && this.game.fleet) this.game.fleet.forget(c);
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
        // (a police car after you shoves you round instead: ROADMAP 6.1, game/chase.js)
        if (this.game.chase && this.game.chase.contact(v, c)) continue;
        if (Math.abs(v.speed) > 6) {
          // (dented where they met: game/damage.js)
          if (!this.game.classic && this.game.damage) this.game.damage.crash(v, c, Math.abs(v.speed));
          if (!c.wrecked && (v.kind === 'tank' || Math.abs(v.speed) > 14)) {
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
          if (v.kind !== 'tank') v.hurt(Math.abs(v.speed) * 0.8);
          v.speed *= v.kind === 'tank' ? 0.8 : 0.4;
        }
      }
    }
    if (v.kind === 'tank' && Math.abs(v.speed) > 1.5) {
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
