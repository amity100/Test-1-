import * as THREE from 'three';
import { M_AVES, M_STREETS } from '../world/mainland/plan.js';
import { CAR_COLORS, TAXI_YELLOW } from '../render/cars.js';
import { NODES, laneOffsets, stopDist } from '../world/roads.js';
import { civilianLook } from './looks.js';

// (GTA IV) The mainland's curbs, as its blocks come and go (world/mainland/stream.js): the cars
// parked along both curbs of every narrow street - the streets' asphalt has their lane painted
// on it, and until now nobody parked in it - nose to tail with a gap here and there, more of them
// in town than up in the hills; the cars standing in the blocks' own lots and driveways (the
// kits put them there, with their boxes, and nobody drew them: you walked into cars you could not
// see); and the blocks' bus stops, for the buses to stop at (game/traffic.js busStop).
//
// Each block's cars are the traffic's parked cars while the block is there (you can take one,
// shoot one, rub one out, as on the island) and go with the block when it is let go of. The
// curb's own cars are the block's dice: the same street has the same cars every time you come.
//
// And the curbs are used, anywhere you are: now and then somebody walks up the sidewalk to one of
// the parked cars, round its back to the driver's door, gets in - and a moment later it signals,
// pulls out of its space and joins the traffic; now and then a car of the traffic slows on a
// street, signals, finds a gap at the curb and pulls into it, and its driver gets out and walks
// off. (Those parked by the traffic stay while you are anywhere near.)

// (a seeded dice, as game/workers.js has)
function dice(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.pick = (l) => l[Math.floor(f() * l.length)];
  return f;
}

// how full a district's curbs are (of every place a car could stand, how many have one)
const FULL = { downtown: 0.82, brickton: 0.76, havana: 0.84, paintwood: 0.62, inkwood: 0.74, valley: 0.6, belcrest: 0.42, beach: 0.72 };
// the colours parked cars come in: a street's worth is mostly white, black, silver and grey, with
// the city's own bright ones among them
const STREET_COLORS = [
  [0.95, 0.95, 0.96], [0.95, 0.95, 0.96], [0.08, 0.08, 0.1], [0.08, 0.08, 0.1], [0.72, 0.73, 0.76], [0.72, 0.73, 0.76],
  [0.45, 0.46, 0.5], [0.45, 0.46, 0.5], [0.2, 0.22, 0.3], [0.5, 0.12, 0.14], [0.16, 0.28, 0.46], [0.85, 0.85, 0.82],
];
const VAN_COLORS = [[0.95, 0.95, 0.96], [0.95, 0.95, 0.96], [0.62, 0.86, 0.95], [0.86, 0.12, 0.16], [0.3, 0.75, 0.55]];
const CLASSIC = [[0.98, 0.62, 0.72], [0.55, 0.88, 0.78], [0.55, 0.78, 0.98], [0.98, 0.94, 0.8]];
// (the blocks that are not streets of their own: the landmarks' sidewalks are theirs)
const BARE = new Set(['pier', 'beach', 'point', 'bayfront', 'arena']);

// a car for the curb (the dice's: the same one every time)
function curbSpec(r, district) {
  const k = r();
  if (k < 0.03) return { kind: 'sedan', color: TAXI_YELLOW, taxi: true };
  if (k < 0.15) return { kind: 'van', color: r.pick(VAN_COLORS), extra: r() < 0.5 ? 'plain' : undefined };
  if (k < 0.4) return { kind: 'suv', color: r.pick(STREET_COLORS) };
  if (k < 0.5) return { kind: 'sports', color: r.pick(r() < 0.5 ? CAR_COLORS : STREET_COLORS) };
  // (the old cruisers of Little Havana, and of the beach)
  if (k < (district === 'havana' || district === 'beach' ? 0.62 : 0.53)) return { kind: 'classic', color: r.pick(CLASSIC), extra: 'classic' };
  return { kind: 'sedan', color: r.pick(r() < 0.75 ? STREET_COLORS : CAR_COLORS) };
}

const HALF_LEN = { sedan: 2.3, suv: 2.35, sports: 2.25, van: 2.5, classic: 2.65 };

export class Curbs {
  constructor(traffic) {
    this.traffic = traffic;
    this.game = traffic.game;
    // block id -> what it gave the traffic: { cars, stops, boxes }
    this.byBlock = new Map();
    // (counted for the tests)
    this.stats = { curb: 0, lots: 0, stops: 0, blocks: 0, left: 0, parked: 0 };
    // the cars somebody is walking up to (to drive off in), the ones the traffic parked
    this.leaving = [];
    this.visitors = [];
    this.outT = 6;
    this.inT = 4;
    const ml = this.game.world.mainland;
    this.on = !this.game.classic && !!ml && !!ml.on && !!ml.listen;
    if (!this.on) return;
    ml.listen((live, on) => (on ? this.add(live) : this.drop(live)));
    if (ml.blocks) for (const live of ml.blocks.values()) this.add(live);
  }

  // a parked car of the traffic's (game/traffic.js Traffic.parked)
  car(x, z, yaw, spec, box, o = {}) {
    const K = HALF_LEN[spec.kind] || 2.3;
    return {
      x,
      z,
      yaw,
      spec,
      box,
      pos: new THREE.Vector3(x, 0, z),
      halfLen: o.halfLen || K,
      halfWid: o.halfWid || 0.98,
      ink: 110,
      parkedCar: true,
      speed: 0,
      wheel: 0,
      curb: !!o.curb,
    };
  }

  // a block shown: its curbs filled, its lots' cars drawn, its bus stops served
  add(live) {
    const b = live.block;
    if (!b || this.byBlock.has(b.id)) return;
    const T = this.traffic;
    const world = this.game.world;
    const col = world.collision;
    const bc = live.bctx;
    const rec = { cars: [], stops: [], boxes: [], strips: [] };
    this.byBlock.set(b.id, rec);
    this.stats.blocks++;
    // the bus stops on its sidewalks (world/mainland/sidewalks.js)
    if (bc && bc.busStops) {
      for (const st of bc.busStops) {
        T.stops.push(st);
        rec.stops.push(st);
        this.stats.stops++;
      }
    }
    // the cars the kits parked in its lots and driveways (world/kits.js parkCar): their boxes are
    // the block's (in the city now, by the numbers the city gave them)
    if (bc && bc.parked) {
      for (const sp of bc.parked) {
        const lb = bc.col.boxes[sp.box];
        if (!lb || !lb.alive) continue;
        const c = this.car(sp.x, sp.z, sp.yaw, sp.spec, lb.id);
        // (a shot into its box dents it: game/damage.js carOfBox)
        lb.data = lb.data || { parked: true };
        lb.data.car = c;
        rec.cars.push(c);
        T.parked.push(c);
        this.stats.lots++;
      }
    }
    // the curbs of the narrow streets along its north and south ends (the side of each that is
    // the block's: the street's other side is the next block's)
    if (!BARE.has(b.kind)) {
      const ae = M_AVES[b.col];
      const aw = M_AVES[b.col + 1];
      const r = dice(b.seed * 13 + 5);
      const full = FULL[b.district] || 0.6;
      for (const [s, side] of [[M_STREETS[b.row], 1], [M_STREETS[b.row + 1], -1]]) {
        if (!s || !ae || !aw || s.half !== 6 || s.median) continue;
        if (aw.x < s.x0 - 0.5 || ae.x > s.x1 + 0.5) continue;
        // between the crossings' zebras (and a car's length clear of them)
        const xa = aw.x + aw.half + 3.4 + 2.7;
        const xb = ae.x - ae.half - 3.4 - 2.7;
        // (the south curb: the cars face east, with the traffic beside them; the north curb: west)
        const z = s.z + side * 4.75;
        const yaw = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        let x = xa + r() * 2;
        while (x < xb) {
          const spec = curbSpec(r, b.district);
          const hl = HALF_LEN[spec.kind] || 2.3;
          // (a gap where a car has just left, a driveway, a hydrant)
          const take = r() < full;
          const jx = (r() - 0.5) * 0.5;
          const jz = (r() - 0.5) * 0.22;
          const jy = (r() - 0.5) * 0.05;
          if (take && x + hl < xb + 2.4) {
            const cx = x + hl + jx;
            const cz = z + jz;
            const box = { x0: cx - hl, z0: cz - 0.98, x1: cx + hl, z1: cz + 0.98, y0: 0, y1: 1.45, tag: 'car', data: { parked: true, car: null } };
            const id = col.adopt(box);
            const c = this.car(cx, cz, yaw + jy, spec, id, { curb: true, halfLen: hl });
            box.data.car = c;
            rec.boxes.push(id);
            rec.cars.push(c);
            T.parked.push(c);
            this.stats.curb++;
          }
          x += hl * 2 + 0.7 + r() * 1.3;
        }
        // (where people can walk, round them: world/collision.js NavGrid)
        rec.strips.push([xa - 3, z - 1.4, xb + 3, z + 1.4]);
        if (world.nav && world.nav.queueRefresh) world.nav.queueRefresh(xa - 3, z - 1.4, xb + 3, z + 1.4);
      }
    }
    if (rec.cars.length) T.parkedVer = (T.parkedVer || 0) + 1;
  }

  // ------------------------------------------------------------------ in and out of the spaces
  // (Traffic.update, every 0.8 s round p)
  tick(p) {
    if (!this.on) return;
    const game = this.game;
    // (those the traffic parked, far behind you now: gone)
    if (this.visitors.length) {
      let gone = null;
      for (const c of this.visitors) if (c.taken || Math.abs(c.pos.x - p.x) + Math.abs(c.pos.z - p.z) > 330) (gone || (gone = [])).push(c);
      if (gone) for (const c of gone) this.unvisit(c);
    }
    if (p.x > -330) return;
    this.outT -= 0.8;
    this.inT -= 0.8;
    if (this.outT <= 0) {
      this.outT = (game.touch ? 15 : 8) + Math.random() * 8;
      if (this.leaving.length < (game.touch ? 1 : 2)) this.leaveOne(p);
    }
    if (this.inT <= 0) {
      this.inT = (game.touch ? 13 : 7) + Math.random() * 7;
      this.seekOne(p);
    }
  }

  // the street a curb car stands on, and the crossings either end of its stretch of it: the way it
  // goes (dx, dz), its lane, how far over from it the car stands
  edgeOf(c) {
    const dx = Math.abs(Math.sin(c.yaw)) > 0.7 ? Math.sign(Math.sin(c.yaw)) : 0;
    const dz = dx ? 0 : Math.sign(Math.cos(c.yaw));
    let A = null;
    let best = -Infinity;
    for (const n of NODES) {
      // (on its road: the line of the crossings through it, a curb's width off)
      const side = Math.abs((c.pos.x - n.x) * dz - (c.pos.z - n.z) * dx);
      if (side > 9) continue;
      const along = (n.x - c.pos.x) * dx + (n.z - c.pos.z) * dz;
      if (along < -2 && along > best) {
        best = along;
        A = n;
      }
    }
    if (!A) return null;
    const B = A.nb.find((m) => Math.sign(m.x - A.x) === dx && Math.sign(m.z - A.z) === dz);
    if (!B) return null;
    const t = -best;
    const len = Math.abs(B.x - A.x) + Math.abs(B.z - A.z);
    const alongZ = dz !== 0;
    if (t < stopDist(A, alongZ) + 2 || t > len - stopDist(B, alongZ) - 4) return null;
    const offs = laneOffsets(A, dx, dz);
    const off = offs[offs.length - 1];
    const lat = (c.pos.x - A.x) * -dz + (c.pos.z - A.z) * dx;
    if (lat - off < 1.6) return null;
    return { A, B, dx, dz, t, off, lane: offs.length - 1, lat };
  }

  // somebody up the sidewalk to one of the parked cars in front of you, to drive off in it
  leaveOne(p) {
    const T = this.traffic;
    const game = this.game;
    const cam = game.camera;
    const fwd = cam.getWorldDirection(this._fwd || (this._fwd = new THREE.Vector3()));
    const pick = [];
    for (const c of T.parked) {
      if (!c.curb || c.taken || c.leaving || c.flat || c.wrecked || c.poofT !== undefined || (c.dmg && c.dmg.burnt)) continue;
      const vx = c.pos.x - cam.position.x;
      const vz = c.pos.z - cam.position.z;
      const d = Math.hypot(vx, vz);
      if (d < 16 || d > 80 || (vx * fwd.x + vz * fwd.z) / d < 0.35) continue;
      pick.push(c);
    }
    if (!pick.length) return false;
    const c = pick[Math.floor(Math.random() * pick.length)];
    const E = this.edgeOf(c);
    if (!E) return false;
    // (the lane beside it clear a way back and a little ahead)
    for (const o of T.list) {
      const a = (o.pos.x - E.A.x) * E.dx + (o.pos.z - E.A.z) * E.dz;
      const l = (o.pos.x - E.A.x) * -E.dz + (o.pos.z - E.A.z) * E.dx;
      if (Math.abs(l - E.off) < 2.2 && a > E.t - 26 && a < E.t + 10) return false;
    }
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const rx = -fz;
    const rz = fx;
    const hl = c.halfLen;
    // the walk: along the sidewalk from behind, past its back, round to the driver's door (on the
    // road's side)
    const P = (u, v) => [c.pos.x + fx * u + rx * v, c.pos.z + fz * u + rz * v];
    const legs = [P(-hl - 1.2, 1.9), P(-hl - 0.9, -1.75), P(0.35, -(c.halfWid + 0.55))];
    const start = P(-hl - 7 - Math.random() * 4, 2.3);
    const look = civilianLook();
    const w = game.civilians.spawnScripted(start[0], start[1], look, this);
    w.speed = 1.35;
    w.noCollide = true;
    if (Math.random() < 0.5) w.fig.carry = Math.random() < 0.5 ? 'phone' : 'coffee';
    const L = { c, E, w, legs, leg: 0, t: 0, phase: 'walk', look, go: { x: 0, z: 0, speed: 1.35 } };
    L.ctrl = (me) => this.walkTo(L, me);
    w.ctrl = L.ctrl;
    c.leaving = L;
    this.leaving.push(L);
    return true;
  }

  // a walker's next leg (game/civilians.js ctrl)
  walkTo(L, me) {
    if (L.phase !== 'walk') return null;
    const q = L.legs[L.leg];
    const dx = me.pos.x - q[0];
    const dz = me.pos.z - q[1];
    if (dx * dx + dz * dz < 0.2 || L.t > 30) {
      if (++L.leg >= L.legs.length || L.t > 30) {
        L.phase = 'in';
        L.t = 0;
        if (L.c) me.faceYaw = L.c.yaw;
      }
      return null;
    }
    L.go.x = q[0];
    L.go.z = q[1];
    return L.go;
  }

  // (every frame, Traffic.update: the ones walking up to their cars)
  update(dt) {
    const civs = this.game.civilians;
    for (let i = this.leaving.length - 1; i >= 0; i--) {
      const L = this.leaving[i];
      const c = L.c;
      const w = L.w;
      L.t += dt;
      const lost = !w || !w.alive || w.panicT > 0 || civs.list.indexOf(w) < 0 || w.ctrl !== L.ctrl;
      if (c.taken || c.dropped || c.poofT !== undefined || c.wrecked || lost) {
        // (called off: the car taken, the walker frightened or hurt)
        if (w && !lost) {
          civs.release(w);
          w.scripted = false;
          civs.rejoin(w);
        }
        c.leaving = null;
        this.leaving.splice(i, 1);
        continue;
      }
      if (L.phase === 'in' && L.t > 0.6) {
        // in, the door shut: the parked car joins the traffic where it stands
        civs.remove(w);
        this.leaving.splice(i, 1);
        c.leaving = null;
        this.pullOut(L);
      }
    }
  }

  // the parked car c into the traffic: a car of the traffic in its lane beside it, standing where
  // c stood (eased over from the lane as far as c is), that signals and pulls out as it rolls
  pullOut(L) {
    const T = this.traffic;
    const c = L.c;
    const E = L.E;
    T.unpark(c);
    c.taken = true;
    const nc = T.newCar(c.spec, { speed: 0 });
    if (nc.driver) nc.driver.look = L.look;
    T.placeOnEdge(nc, E.A, E.B, E.lane, E.t);
    nc.pullK = 1;
    nc.pull = false;
    nc.pullTo = E.lat - E.off;
    nc.side = nc.pullTo;
    nc.pos.x += -Math.cos(nc.yaw) * nc.side;
    nc.pos.z += Math.sin(nc.yaw) * nc.side;
    nc.sigT = 3;
    nc.sigDir = 1;
    if (c.dmg) nc.dmg = c.dmg;
    T.list.push(nc);
    this.stats.left++;
  }

  // a car of the traffic on a street near you, to look for a space at the curb
  seekOne(p) {
    const T = this.traffic;
    let best = null;
    let bd = Infinity;
    for (const c of T.list) {
      if (c.seekPark || c.bus || c.police || c.emergency || c.garbage || c.delivery || c.curb || c.pickup || c.fare || c.drop || c.pulled || c.tstop || c.lineStop) continue;
      if (c.mode !== 'drive' || !c.path || !c.driver || c.wrecked || c.stopped || c.spec.taxi || c.spec.kind === 'moto' || c.spec.kind === 'truck' || c.spec.kind === 'limo') continue;
      const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
      if (d < 25 || d > 110) continue;
      // (on a street with a parking lane: room at the curb beside its lane)
      const g = c.path.gates[0];
      if (!g || g.dz !== 0 || g.from.street.half !== 6 || g.from.street.median) continue;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    if (!best) return false;
    best.seekPark = { phase: 'look', t: 0, lookT: 0, left: 0, run: 0 };
    return true;
  }

  // how fast a car looking for a space may go (Traffic.drive): slowly along; a gap a little way on,
  // and over into it
  wantPark(c, dt) {
    const S = c.seekPark;
    S.t += dt;
    if (S.phase === 'look') {
      if (S.t > 28) {
        c.seekPark = null;
        return Infinity;
      }
      S.lookT -= dt;
      if (S.lookT <= 0) {
        S.lookT = 0.4;
        for (const ahead of [12, 16, 20]) {
          const room = this.traffic.curbRoom(c, ahead);
          if (room > 2.4) {
            S.phase = 'in';
            S.left = ahead;
            S.run = 0;
            c.pull = true;
            c.pullTo = room;
            break;
          }
        }
      }
      // (slower, looking)
      return 6;
    }
    S.run += c.speed * dt;
    c.sig2 = -1;
    const dist = S.left - S.run;
    if (S.t > 50) {
      // (no getting into it: on it goes)
      c.seekPark = null;
      c.pull = false;
      return Infinity;
    }
    if (dist < 0.6 && c.speed < 0.25) {
      if (c.pullK > 0.86) this.parkIt(c);
      return 0;
    }
    return dist < 0.5 ? 0 : Math.max(0.6, Math.sqrt(2 * 3.6 * Math.max(0, dist)) * 0.8);
  }

  // stopped in its space: a parked car now, where it stands; the driver out and off along the
  // sidewalk
  parkIt(c) {
    const T = this.traffic;
    const game = this.game;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const ax = Math.abs(fx) > 0.7;
    const hx = ax ? c.halfLen : c.halfWid;
    const hz = ax ? c.halfWid : c.halfLen;
    const box = { x0: c.pos.x - hx, z0: c.pos.z - hz, x1: c.pos.x + hx, z1: c.pos.z + hz, y0: 0, y1: 1.45, tag: 'car', data: { parked: true, car: null } };
    const id = game.world.collision.adopt(box);
    const pc = this.car(c.pos.x, c.pos.z, c.yaw, c.spec, id, { curb: true, halfLen: c.halfLen, halfWid: c.halfWid });
    box.data.car = pc;
    pc.visitor = true;
    pc.boxId = id;
    if (c.dmg) pc.dmg = c.dmg;
    T.parked.push(pc);
    this.visitors.push(pc);
    if (game.world.nav && game.world.nav.queueRefresh) game.world.nav.queueRefresh(box.x0 - 1, box.z0 - 1, box.x1 + 1, box.z1 + 1);
    // the driver out of the door and round the front onto the sidewalk
    const look = c.driver ? c.driver.look : civilianLook();
    T.removeCar(c);
    c.gone = true;
    const rx = -fz;
    const rz = fx;
    const P = (u, v) => [c.pos.x + fx * u + rx * v, c.pos.z + fz * u + rz * v];
    const door = P(0.35, -(c.halfWid + 0.5));
    const w = game.civilians.spawnScripted(door[0], door[1], look, this);
    w.speed = 1.3;
    w.noCollide = true;
    w.yaw = c.yaw - Math.PI / 2;
    const L = { legs: [P(c.halfLen + 0.9, -(c.halfWid + 0.5)), P(c.halfLen + 0.9, 2.2)], leg: 0, t: 0, phase: 'walk', go: { x: 0, z: 0, speed: 1.3 } };
    L.ctrl = (me, dt) => {
      L.t += dt;
      const r = this.walkTo(L, me);
      if (L.phase !== 'walk') {
        // (on the sidewalk: one of the street's own from here)
        game.civilians.release(me);
        me.scripted = false;
        game.civilians.rejoin(me);
      }
      return r;
    };
    w.ctrl = L.ctrl;
    this.stats.parked++;
  }

  // one the traffic parked, gone (far behind you, or taken)
  unvisit(c) {
    const T = this.traffic;
    const k = this.visitors.indexOf(c);
    if (k >= 0) this.visitors.splice(k, 1);
    T.parked = T.parked.filter((o) => o !== c);
    // (its box let go of for good: taken, it was only put out of use - Traffic.unpark)
    if (c.boxId !== undefined) this.game.world.collision.release([c.boxId]);
    c.box = undefined;
  }

  // a block let go of: its cars, its stops and its boxes with it
  drop(live) {
    const b = live.block;
    const rec = b && this.byBlock.get(b.id);
    if (!rec) return;
    this.byBlock.delete(b.id);
    const T = this.traffic;
    const world = this.game.world;
    if (rec.cars.length) {
      const gone = new Set(rec.cars);
      // (one somebody is walking up to goes with it: the walk is called off)
      for (const c of rec.cars) c.dropped = true;
      T.parked = T.parked.filter((c) => !gone.has(c));
      T.parkedVer = (T.parkedVer || 0) + 1;
    }
    if (rec.stops.length) {
      const gone = new Set(rec.stops);
      T.stops = T.stops.filter((s) => !gone.has(s));
    }
    if (rec.boxes.length) {
      // (the lots' boxes are the block's: it lets them go itself)
      world.collision.release(rec.boxes);
      if (world.nav && world.nav.queueRefresh) for (const q of rec.strips) world.nav.queueRefresh(q[0], q[1], q[2], q[3]);
    }
  }
}
