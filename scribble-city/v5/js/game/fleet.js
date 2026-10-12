import * as THREE from 'three';
import { Doodle } from './doodle.js';
import { civilianLook } from './looks.js';
import { randomCarSpec, TAXI_YELLOW } from '../render/cars.js';
import { groundHeight } from '../world/layout.js';

// The rest of the street's traffic (ROADMAP 4.1), besides the sedans, the taxis, the SUVs, the
// vans, the sports cars, the buses and the police:
//   trucks, limousines, classic cars   now and then among the cars
//   motorbikes                         a rider in a helmet, hands on the bars, leaning a little
//                                      into the turns
//   the garbage truck                  in the mornings, along the curb lane: it stops by the
//                                      bins on the sidewalk, the worker on its back step hops
//                                      off, takes the bag out, throws it in the back (a crash,
//                                      the compactor's whirr), hops back on, and on it goes
//   taxis                              somebody on the curb waves one down: it pulls over, they
//                                      get in, the sign on the roof goes dark; a while later it
//                                      stops and lets them out
//   an ambulance, a fire engine        now and then, the siren going, the lights flashing,
//                                      faster than the rest; at a red light they slow down and
//                                      go through
// (?classic: none of it)

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const TRUCK_COLORS = [[0.96, 0.96, 0.97], [0.96, 0.96, 0.97], [0.85, 0.86, 0.88], [0.3, 0.45, 0.8], [0.86, 0.18, 0.2], [0.98, 0.72, 0.2]];
const CLASSIC_COLORS = [[0.98, 0.62, 0.72], [0.55, 0.88, 0.78], [0.55, 0.78, 0.98], [0.98, 0.94, 0.8], [0.82, 0.1, 0.16], [0.2, 0.75, 0.78], [0.99, 0.82, 0.4]];
const LIMO_COLORS = [[0.06, 0.06, 0.07], [0.06, 0.06, 0.07], [0.96, 0.96, 0.97]];
const MOTO_COLORS = [[0.86, 0.14, 0.16], [0.08, 0.08, 0.1], [0.2, 0.4, 0.86], [0.98, 0.78, 0.18], [0.95, 0.95, 0.96], [0.2, 0.6, 0.35]];
const HELMETS = [[0.08, 0.08, 0.1], [0.95, 0.95, 0.96], [0.86, 0.14, 0.16], [0.2, 0.4, 0.86], [0.98, 0.78, 0.18]];
const AMBULANCE = { kind: 'ambulance', color: [0.97, 0.97, 0.98], extra: 'ambulance', siren: true, emergency: true };
const FIRE = { kind: 'firetruck', color: [0.86, 0.1, 0.12], extra: 'fire', siren: true, emergency: true };
const GARBAGE = { kind: 'garbage', color: [0.22, 0.56, 0.36], extra: 'garbage', curb: true };
const SEAT = 0.84;
const WHEEL_R = 0.32;
const MOTO_DARK = [0.1, 0.1, 0.12];
const MOTO_STEEL = [0.66, 0.68, 0.72];
const MOTO_CHROME = [0.86, 0.87, 0.9];
const MOTO_LAMP = [1.0, 0.95, 0.75];
const MOTO_TAIL = [0.9, 0.12, 0.14];
const WHITE = [1, 1, 1];
const DECEL = 3.6;

const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const _c = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _mb = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const ZA = new THREE.Vector3(0, 0, 1);
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Fleet {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.garbageT = 20;
    // (no dice drawn here: with ?classic the city's dice must fall as they always did)
    this.sirenT = 150;
    this.taxiT = 0;
    // (counted for the tests)
    this.stats = { motos: 0, trucks: 0, classics: 0, limos: 0, garbage: 0, bins: 0, emergency: 0, hails: 0, pickups: 0, dropoffs: 0 };
  }

  get traffic() {
    return this.game.traffic;
  }

  // what a new car in the traffic is (Traffic.spawnCar, when nothing in particular is asked for)
  spec() {
    const r = Math.random();
    if (r < 0.045) {
      this.stats.trucks++;
      return { kind: 'truck', color: pick(TRUCK_COLORS), extra: 'plain' };
    }
    if (r < 0.075) {
      this.stats.classics++;
      return { kind: 'classic', color: pick(CLASSIC_COLORS), extra: 'classic' };
    }
    if (r < 0.088) {
      this.stats.limos++;
      return { kind: 'limo', color: pick(LIMO_COLORS), extra: 'limo' };
    }
    if (r < 0.16) {
      this.stats.motos++;
      return { kind: 'moto', color: pick(MOTO_COLORS) };
    }
    return randomCarSpec();
  }

  // a car of the fleet's, as it joins the traffic (Traffic.newCar)
  dress(c) {
    const k = c.spec.kind;
    if (k === 'moto') {
      c.maxSpeed = 11 + Math.random() * 4;
      if (c.driver) c.driver.look.hat = { kind: 'helmet', color: pick(HELMETS) };
      c.lean = 0;
    } else if (k === 'truck' || k === 'garbage' || k === 'firetruck') c.maxSpeed = Math.min(c.maxSpeed, 8.5);
    else if (k === 'limo') c.maxSpeed = Math.min(c.maxSpeed, 9);
    if (c.spec.curb) c.curb = true;
    if (c.spec.emergency) {
      c.emergency = true;
      c.siren = true;
      c.maxSpeed = 14 + Math.random() * 2;
    }
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    if (game.classic || game.inBar) return;
    const tr = this.traffic;
    const p = game.anchorPos();
    // the special ones, now and then
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 2;
      this.specials(p);
    }
    // taxis: somebody waves, somebody gets out
    this.taxiT -= dt;
    const look = this.taxiT <= 0;
    if (look) this.taxiT = 1;
    let siren = Infinity;
    let sirenKind = 'yelp';
    const cam = game.camera.position;
    for (const c of tr.list) {
      if (c.gone || c.poofT !== undefined) continue;
      const off = c.mode !== 'drive' || c.wrecked || c.stopped || !c.path;
      if (c.spec.taxi && !c.police) {
        if (off || !c.driver) {
          if (c.pickup) this.letGo(c);
          c.dropT = undefined;
        } else this.taxi(c, dt, look, p);
      }
      if (c.garbage) {
        if (off) this.manOff(c);
        else this.garbage(c, dt);
      }
      if (c.spec.kind === 'moto') this.rider(c, dt);
      if (c.emergency && c.siren && !c.wrecked) {
        const d = Math.hypot(c.pos.x - cam.x, c.pos.z - cam.z);
        if (d < siren) {
          siren = d;
          sirenKind = c.spec.kind === 'firetruck' ? 'wail' : 'yelp';
        }
      }
    }
    game.audio.siren2(siren < 150 ? 1 - siren / 150 : 0, sirenKind);
  }

  // a garbage truck in the mornings; an ambulance or a fire engine now and then
  specials(p) {
    const game = this.game;
    const tr = this.traffic;
    const h = game.daynight ? game.daynight.hour : 12;
    this.garbageT -= 2;
    if (this.garbageT <= 0 && h > 5.5 && h < 11.5 && !tr.list.some((c) => c.garbage)) {
      const c = tr.spawnCar(p, 50, 140, { ...GARBAGE }, { maxSpeed: 7 });
      this.garbageT = c ? 120 : 10;
      if (c) {
        c.garbage = { state: 'drive', done: new Set(), bin: null, t: 0, man: null, x: 0, z: 0 };
        this.stats.garbage++;
      }
    }
    this.sirenT -= 2;
    if (this.sirenT <= 0 && !(game.police && game.police.hostile)) {
      const c = tr.spawnCar(p, 90, 180, { ...(Math.random() < 0.6 ? AMBULANCE : FIRE) }, { anywhere: true });
      this.sirenT = c ? 150 + Math.random() * 150 : 15;
      if (c) this.stats.emergency++;
    }
  }

  // how fast a car of the fleet's may go now (Traffic.drive)
  want(c, dt) {
    if (c.garbage) return this.garbageWant(c);
    if (c.pickup) return this.stopFor(c, c.pickup.along0 - c.pickup.run);
    if (c.dropT !== undefined) return 0;
    return Infinity;
  }

  // slow to a stop dist metres on
  stopFor(c, dist) {
    if (dist < 0.4) return 0;
    return Math.max(0, Math.sqrt(2 * DECEL * dist) * 0.85);
  }

  // ------------------------------------------------------------------ taxis
  taxi(c, dt, look, p) {
    const game = this.game;
    const civs = game.civilians;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    // (its right: (-fz, fx); the curb is there when the sidewalk is within a few metres)
    if (c.pickup) {
      const P = c.pickup;
      const w = P.who;
      P.run += c.speed * dt;
      if (!w.alive || w.gone || w.panicT > 0 || civs.list.indexOf(w) < 0 || P.t > 25) {
        this.letGo(c);
        return;
      }
      P.t += dt;
      // pulled up: in they get, at the back door on the curb side
      if (c.speed < 0.3 && P.along0 - P.run < 1.5) {
        P.stopped = true;
        const dx = c.pos.x - fx * 0.7 - fz * (c.halfWid + 0.45);
        const dz = c.pos.z - fz * 0.7 + fx * (c.halfWid + 0.45);
        P.door.set(dx, 0, dz);
        if (Math.hypot(w.pos.x - dx, w.pos.z - dz) < 0.5) {
          c.fare = w.fig.look;
          c.fareT = 35 + Math.random() * 60;
          civs.remove(w);
          this.near(c, 30) && game.audio.play('click', 0.5);
          c.pickup = null;
          c.goT = 1.2;
          this.stats.pickups++;
        }
      }
      return;
    }
    if (c.goT > 0) {
      c.goT -= dt;
      c.brakeT = Math.max(c.brakeT || 0, 0.05);
      return;
    }
    if (c.fare) {
      c.fareT -= dt;
      if (c.dropT !== undefined) {
        c.dropT -= dt;
        if (c.dropT <= 0 && c.speed < 0.3) {
          // out on the curb side, and off along the sidewalk
          const x = c.pos.x - fx * 0.7 - fz * (c.halfWid + 0.55);
          const z = c.pos.z - fz * 0.7 + fx * (c.halfWid + 0.55);
          const w = civs.spawnAt(x, z, c.fare);
          if (w) w.yaw = c.yaw;
          this.near(c, 30) && game.audio.play('click', 0.5);
          c.fare = null;
          c.dropT = undefined;
          c.goT = 1.5;
          this.stats.dropoffs++;
        }
        return;
      }
      if (c.fareT <= 0 && c.speed > 2 && this.curbSide(c)) {
        // nobody to see it: they were let out somewhere else
        if (!this.near(c, 80)) {
          c.fare = null;
          return;
        }
        c.dropT = 1.2;
      }
      return;
    }
    if (!look || c.speed < 2 || !this.curbSide(c) || !this.near(c, 90)) return;
    // somebody on the curb ahead, waving
    let best = null;
    let bAlong = 0;
    for (const w of civs.list) {
      if (!civs.plain(w) || w.convo || (w.hailedT || 0) > game.time) continue;
      const dx = w.pos.x - c.pos.x;
      const dz = w.pos.z - c.pos.z;
      const along = dx * fx + dz * fz;
      const right = -dx * fz + dz * fx;
      if (along < 12 || along > 32 || right < 2.2 || right > 8) continue;
      if (!best || along < bAlong) {
        best = w;
        bAlong = along;
      }
    }
    if (!best) return;
    best.hailedT = game.time + 60;
    if (Math.random() > 0.35) return;
    this.hail(c, best, bAlong);
  }

  // the arm up, facing the road; then over to the back door when it stops
  hail(c, w, along) {
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const P = { who: w, along0: along + 0.7, run: 0, t: 0, stopped: false, door: new THREE.Vector3(), arm: new THREE.Vector3() };
    c.pickup = P;
    const roadYaw = Math.atan2(fz, -fx);
    w.ctrl = (me) => {
      if (!P.stopped) {
        me.faceYaw = roadYaw;
        // the arm up and out towards the road
        P.arm.set(me.pos.x + fz * 0.45 + fx * 0.2, me.pos.y + 2.05 * (me.fig.scale || 1), me.pos.z - fx * 0.45 + fz * 0.2);
        me.fig.reachR = P.arm;
        return null;
      }
      if (me.fig.reachR === P.arm) me.fig.reachR = null;
      return { x: P.door.x, z: P.door.z, speed: 1.7 };
    };
    this.stats.hails++;
    if (this.near(c, 40)) this.game.bubbles.say(w, pick(['Taxi!', 'Taxi! Over here!', 'Hey, taxi!']));
  }

  letGo(c) {
    const P = c.pickup;
    c.pickup = null;
    if (!P) return;
    const w = P.who;
    if (w.ctrl && !w.scripted) w.ctrl = null;
    if (w.fig && w.fig.reachR === P.arm) w.fig.reachR = null;
    w.faceYaw = null;
  }

  // is the sidewalk right by its right side? (the curb lane)
  curbSide(c) {
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    // (on a street the parked cars' lane is between)
    const x = c.pos.x - fz * (c.halfWid + 3.6);
    const z = c.pos.z + fx * (c.halfWid + 3.6);
    return groundHeight(x, z) > 0.05;
  }

  near(c, r) {
    const p = this.game.player.pos;
    return Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < r;
  }

  // ------------------------------------------------------------------ the garbage truck
  garbageWant(c) {
    const G = c.garbage;
    if (G.state !== 'drive') return 0;
    if (G.t > 0) return Infinity;
    // the next bin by the curb on its right, alongside the back of the truck
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    let best = null;
    let bd = Infinity;
    for (const o of this.bins()) {
      if (G.done.has(o)) continue;
      const dx = o.x - c.pos.x;
      const dz = o.z - c.pos.z;
      const along = dx * fx + dz * fz;
      const right = -dx * fz + dz * fx;
      if (right < 1.8 || right > 6.5 || along < -c.halfLen || along > 40) continue;
      if (along < bd) {
        bd = along;
        best = o;
      }
    }
    if (!best) return Infinity;
    const dist = bd - (-c.halfLen + 1.2);
    if (dist < 0.5 && c.speed < 0.5) {
      G.bin = best;
      G.done.add(best);
      G.state = 'off';
      G.t = 0;
      return 0;
    }
    if (dist < -1.5) {
      // (rolled past it)
      G.done.add(best);
      return Infinity;
    }
    return this.stopFor(c, dist);
  }

  // the sidewalk's bins near the truck (the city's, still there)
  bins() {
    const objs = this.game.world.objects.list;
    if (!this._bins) {
      this._bins = [];
      for (const o of objs) if (o && o.kind === 'trash') this._bins.push(o);
    }
    return this._bins.filter((o) => o.state === 'here');
  }

  // the worker: on the back step, or off for the bin
  garbage(c, dt) {
    const G = c.garbage;
    const game = this.game;
    const cam = game.camera.position;
    const d = Math.hypot(c.pos.x - cam.x, c.pos.z - cam.z);
    if (!G.man && d < 90) {
      const look = civilianLook({ kind: 'worker' });
      look.hat = { kind: 'cap', color: [0.98, 0.6, 0.15] };
      G.man = new Doodle(game.figures, look, { seed: Math.random() * 100 });
    } else if (G.man && d > 110) {
      G.man.dispose();
      G.man = null;
    }
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const rx = -fz;
    const rz = fx;
    // the back step, on the curb side
    const sx = c.pos.x - fx * (c.halfLen + 0.55) + rx * 0.75;
    const sz = c.pos.z - fz * (c.halfLen + 0.55) + rz * 0.75;
    const f = G.man;
    G.t -= dt;
    if (G.state === 'drive') {
      if (f) {
        f.pos.set(sx, 0.42, sz);
        f.yaw = c.yaw;
        f.speed = 0;
        f.carryL = null;
        if (!G.grab) G.grab = new THREE.Vector3();
        G.grab.set(sx - fx * 0.15, 1.75, sz - fz * 0.15);
        f.reachL = G.grab;
        f.update(dt);
      }
      G.x = sx;
      G.z = sz;
      return;
    }
    if (!f) {
      // (nobody to see the work: done in a moment)
      if (G.t < -6) this.binDone(c);
      return;
    }
    f.reachL = null;
    const walk = (tx, tz, v) => {
      const dx = tx - G.x;
      const dz = tz - G.z;
      const l = Math.hypot(dx, dz);
      const step = Math.min(l, v * dt);
      if (l > 0.01) {
        G.x += (dx / l) * step;
        G.z += (dz / l) * step;
        f.yaw = Math.atan2(dx, dz);
      }
      f.pos.set(G.x, groundHeight(G.x, G.z), G.z);
      f.speed = l > 0.05 ? v : 0;
      return l < 0.08;
    };
    const bin = G.bin;
    // where the bag goes in: behind the hopper
    const hx = c.pos.x - fx * (c.halfLen + 0.95);
    const hz = c.pos.z - fz * (c.halfLen + 0.95);
    if (G.state === 'off') {
      // down off the step
      G.x = sx;
      G.z = sz;
      f.pos.set(sx, Math.max(groundHeight(sx, sz), 0.42 + G.t * 1.4), sz);
      if (G.t < -0.3) {
        G.state = 'go';
        G.t = 0;
      }
    } else if (G.state === 'go') {
      // to the bin (stopping short of it)
      const dx = bin.x - G.x;
      const dz = bin.z - G.z;
      const l = Math.hypot(dx, dz) || 1;
      if (walk(bin.x - (dx / l) * 0.55, bin.z - (dz / l) * 0.55, 2.2) || G.t < -8) {
        G.state = 'grab';
        G.t = 0;
        f.yaw = Math.atan2(dx, dz);
      }
    } else if (G.state === 'grab') {
      f.speed = 0;
      f.crouch = Math.min(1, -G.t * 3) * (G.t > -0.6 ? 1 : 0);
      if (G.t < -0.5) f.carryL = 'trashbag';
      if (G.t < -0.8) {
        f.crouch = 0;
        G.state = 'back';
        G.t = 0;
      }
    } else if (G.state === 'back') {
      if (walk(hx, hz, 2.2) || G.t < -8) {
        G.state = 'toss';
        G.t = 0;
        f.yaw = c.yaw;
      }
    } else if (G.state === 'toss') {
      f.speed = 0;
      f.armsUp = G.t > -0.35 ? 1 : 0;
      if (G.t < -0.25 && f.carryL) {
        f.carryL = null;
        if (this.near(c, 45)) {
          game.audio.play('crash', 0.25);
          game.audio.play('pour', 0.3);
        }
        this.stats.bins++;
      }
      if (G.t < -0.7) {
        f.armsUp = 0;
        G.state = 'on';
        G.t = 0;
      }
    } else if (G.state === 'on') {
      if (walk(sx, sz, 2.4) || G.t < -6) {
        G.state = 'hop';
        G.t = 0;
      }
    } else if (G.state === 'hop') {
      f.pos.set(sx, Math.min(0.42, groundHeight(sx, sz) - G.t * 1.6), sz);
      f.yaw = c.yaw;
      if (G.t < -0.3) this.binDone(c);
    }
    f.update(dt);
  }

  // the truck wrecked or rubbed out: the worker jumps down and runs
  manOff(c) {
    const G = c.garbage;
    if (!G.man) return;
    const civs = this.game.civilians;
    const w = civs.spawnAt(G.x, G.z, G.man.look);
    if (w) {
      w.panicT = 5;
      w.fearX = c.pos.x;
      w.fearZ = c.pos.z;
    }
    G.man.dispose();
    G.man = null;
    c.garbage = null;
  }

  // a car leaving the traffic (Traffic.removeCar, Traffic.take): its rider, its worker, its fare
  forget(c) {
    if (c.rider) {
      c.rider.dispose();
      c.rider = null;
    }
    if (c.garbage && c.garbage.man) {
      c.garbage.man.dispose();
      c.garbage.man = null;
    }
    if (c.pickup) this.letGo(c);
  }

  binDone(c) {
    const G = c.garbage;
    G.state = 'drive';
    G.bin = null;
    G.t = 3;
    if (G.man) {
      G.man.carryL = null;
      G.man.crouch = 0;
      G.man.armsUp = 0;
    }
  }

  // ------------------------------------------------------------------ motorbikes
  // the rider: made when the bike comes near, let go when it is far
  rider(c, dt) {
    const game = this.game;
    const cam = game.camera.position;
    const d = Math.hypot(c.pos.x - cam.x, c.pos.z - cam.z);
    // leaning a little into the turns
    c.lean = THREE.MathUtils.damp(c.lean || 0, Math.max(-0.22, Math.min(0.22, -(c.steer || 0) * 0.12)), 6, dt);
    if (!c.rider && d < 85 && c.driver) c.rider = new Doodle(game.figures, c.driver.look, { seed: Math.random() * 100 });
    else if (c.rider && (d > 100 || !c.driver)) {
      c.rider.dispose();
      c.rider = null;
    }
    const f = c.rider;
    if (!f) return;
    this._cur = c;
    this.frame(c);
    f.pos.copy(this.at(0, SEAT - 0.48, -0.32, _p));
    f.yaw = c.yaw;
    f.sit = 1;
    f.speed = 0;
    if (!c.grips) c.grips = [new THREE.Vector3(), new THREE.Vector3()];
    this.at(-0.3, 1.1, 0.5, c.grips[0]);
    this.at(0.3, 1.1, 0.5, c.grips[1]);
    // (its right is -x in the rider's frame: the right hand on the right grip)
    f.reachR = c.grips[0];
    f.reachL = c.grips[1];
    f.update(dt);
  }

  // the bike's own frame for this frame (forward, right, up: leaning)
  frame(c) {
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    _f.set(fx, 0, fz);
    const a = c.lean || 0;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // right (-fz, fx) and up, turned about the forward axis by the lean
    _r.set(-fz * ca, -sa, fx * ca);
    _u.set(-fz * sa, ca, fx * sa);
  }

  at(x, y, z, out) {
    const c = this._cur;
    return out.set(c.pos.x + _r.x * x + _u.x * y + _f.x * z, (c.pos.y || 0) + _r.y * x + _u.y * y, c.pos.z + _r.z * x + _u.z * y + _f.z * z);
  }

  // ------------------------------------------------------------------ drawing
  draw(fr) {
    const game = this.game;
    if (game.classic) return;
    const cam = game.camera.position;
    const fwd = game.camera.getWorldDirection(_a);
    const fx0 = fwd.x;
    const fz0 = fwd.z;
    for (const c of this.traffic.list) {
      if (c.gone || c.poofT !== undefined) continue;
      const dx = c.pos.x - cam.x;
      const dz = c.pos.z - cam.z;
      const d = Math.hypot(dx, dz);
      const seen = d < 160 && (d < 12 || (dx * fx0 + dz * fz0) / (d || 1) > -0.3);
      if (c.spec.kind === 'moto') {
        if (c.rider) c.rider.setVisible(seen);
        if (seen) this.drawMoto(fr, c, d);
      } else if (c.garbage && c.garbage.man) {
        c.garbage.man.setVisible(seen && d < 90);
        if (seen && d < 90) c.garbage.man.draw(cam);
      }
    }
  }

  // a motorbike: the wheels (the cars' tyres, thinner), the tank and the seat, the engine, the
  // headlamp, the forks and the bars, the exhaust; and its rider
  drawMoto(fr, c, d) {
    const game = this.game;
    const cars = game.cars;
    const bodies = game.figures.bodies;
    this._cur = c;
    this.frame(c);
    const col = c.wrecked ? [0.13, 0.11, 0.13] : c.spec.color;
    // the wheels: they roll, the front one steers (in the bike's frame: turned, leaning)
    const spin = (c.wheel || 0) * 1.12;
    const steer = Math.max(-0.4, Math.min(0.4, (c.steer || 0) * 0.3));
    _q.setFromAxisAngle(UP, c.yaw);
    _q2.setFromAxisAngle(ZA, c.lean || 0);
    _q.multiply(_q2);
    _mb.compose(_p.set(c.pos.x, c.pos.y || 0, c.pos.z), _q, _s.set(1, 1, 1));
    for (const [wz, front] of [[-0.62, false], [0.78, true]]) {
      _q2.setFromEuler(_e.set(spin, front ? steer : 0, 0, 'YXZ'));
      _m.compose(_p.set(0, WHEEL_R, wz), _q2, _s.set(0.42, WHEEL_R, WHEEL_R)).premultiply(_mb);
      cars.tyres.push(_m, WHITE, 0.7);
      _m.compose(_p.set(0, WHEEL_R, wz), _q2, _s.set(0.5, WHEEL_R * 0.72, WHEEL_R * 0.72)).premultiply(_mb);
      cars.rims.push(_m, WHITE, 0.8);
    }
    const blob = (x, y, z, sx, sy, sz, color) => {
      this.at(x, y, z, _c);
      bodies.blob(_c, _r, _u, _f, sx, sy, sz, color);
    };
    // the tank, the seat, the tail; the engine and its case; the headlamp's cowl and the lamp
    blob(0, 0.82, 0.16, 0.15, 0.11, 0.25, col);
    blob(0, 0.86, -0.32, 0.13, 0.05, 0.27, MOTO_DARK);
    blob(0, 0.8, -0.66, 0.1, 0.07, 0.17, col);
    blob(0, 0.46, 0.02, 0.15, 0.15, 0.24, MOTO_STEEL);
    blob(0, 0.36, -0.2, 0.1, 0.1, 0.16, MOTO_DARK);
    blob(0, 0.98, 0.66, 0.14, 0.13, 0.11, col);
    blob(0, 0.95, 0.76, 0.065, 0.065, 0.035, MOTO_LAMP);
    blob(0, 0.78, -0.84, 0.05, 0.03, 0.02, MOTO_TAIL);
    // the exhaust along the right
    blob(-0.17, 0.42, -0.38, 0.05, 0.05, 0.3, MOTO_CHROME);
    // the forks, the bars (pen lines: thinner further off)
    const w = Math.max(1, Math.min(4, 55 / Math.max(1, d)));
    const L = (x0, y0, z0, x1, y1, z1, color, wd, k) => {
      this.at(x0, y0, z0, _a);
      this.at(x1, y1, z1, _b);
      fr.lineXYZ(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, color, wd, 2000 + k, 1, 0.003, 0.004);
    };
    for (const s of [-1, 1]) L(s * 0.08, 0.98, 0.64, s * 0.08, WHEEL_R, 0.78, MOTO_STEEL, w * 1.3, s);
    L(-0.31, 1.1, 0.52, 0.31, 1.1, 0.52, MOTO_DARK, w * 1.2, 3);
    L(0, 0.98, 0.62, 0, 1.1, 0.52, MOTO_DARK, w * 1.2, 4);
    if (c.rider && d < 100) c.rider.draw(game.camera.position);
  }
}

export { TAXI_YELLOW };
