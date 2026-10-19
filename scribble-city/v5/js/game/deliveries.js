import { civilianLook, modest } from './looks.js';
import { groundHeight } from '../world/layout.js';

// (GTA IV) The deliveries: a van or a box truck of one of the city's firms comes along the curb
// lane in the working hours and pulls up by a shop - double-parked, its hazards going, as close to
// the curb as the parked cars let it (in the parking lane where there is a gap). The driver gets
// out on the road side, walks round to the back, takes a box, crosses the sidewalk between the
// parked cars, carries it in through the shop's door; comes back out empty-handed for the next
// one, two or three of them; gets back in, the hazards off, the left signal on, and off it goes
// to the next shop on its round. The cars stuck behind it (on a street of one lane each way) sit
// there and lean on their horns (game/traffic.js mind); on an avenue they go round it.
//
// The driver is one of the street's own while out of the van (game/civilians.js: a scripted one):
// hit them, scare them, and they drop it all and run, the van left standing where it is. Nobody
// near to see it: the boxes are in, a while later, without anybody walking them in.
// (?classic: none of it - game/fleet.js)

// the firms (their vans' colours, their people's): parody names, said at the door
const FIRMS = [
  { name: 'Parcello', van: [0.46, 0.31, 0.19], shirt: [0.5, 0.34, 0.21], cap: [0.38, 0.25, 0.14], truck: true },
  { name: 'QuickInk Express', van: [0.97, 0.97, 0.98], shirt: [0.86, 0.2, 0.2], cap: [0.86, 0.2, 0.2], truck: false },
  { name: 'Sunny Fresh Produce', van: [0.98, 0.82, 0.26], shirt: [0.97, 0.76, 0.2], cap: [0.16, 0.3, 0.58], truck: true },
  { name: 'Bodega Supply Co.', van: [0.22, 0.56, 0.5], shirt: [0.2, 0.5, 0.46], cap: [0.14, 0.2, 0.24], truck: true },
  { name: 'Box & Bow', van: [0.95, 0.95, 0.96], shirt: [0.26, 0.36, 0.62], cap: [0.26, 0.36, 0.62], truck: false },
];
const AT_DOOR = ['Delivery!', 'Morning! Where do you want it?', 'Sign here, please.', 'Three boxes today.', 'Coming through!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const DECEL = 3.6;

function workerLook(firm) {
  const L = civilianLook({ kind: 'worker' });
  L.top = { kind: 'polo', color: firm.shirt, sleeves: L.fem ? 'long' : 'short' };
  L.bottom = L.fem ? { kind: 'wide', color: [0.17, 0.18, 0.22] } : { kind: 'cargo', color: [0.2, 0.2, 0.23] };
  L.hat = { kind: 'cap', color: firm.cap };
  L.acc = L.fem ? ['earrings'] : [];
  return modest(L);
}

export class Deliveries {
  constructor(fleet) {
    this.fleet = fleet;
    this.game = fleet.game;
    this.t = 8;
    this.stats = { vans: 0, stops: 0, boxes: 0, abandoned: 0 };
  }

  get traffic() {
    return this.game.traffic;
  }

  // ------------------------------------------------------------------ the vans on their rounds
  // a van now and then, in the working hours, round you (Fleet.specials, every 2 s)
  specials(p, h) {
    this.t -= 2;
    if (this.t > 0 || h < 6.5 || h > 20) return;
    const game = this.game;
    const tr = this.traffic;
    let n = 0;
    for (const c of tr.list) if (c.delivery && Math.abs(c.pos.x - p.x) + Math.abs(c.pos.z - p.z) < 300) n++;
    if (n >= (game.touch ? 1 : 2)) {
      this.t = 6;
      return;
    }
    const firm = pick(FIRMS);
    const spec = { kind: firm.truck && Math.random() < 0.45 ? 'truck' : 'van', color: firm.van, extra: 'plain', curb: true };
    const c = tr.spawnCar(p, 45, 150, spec, { maxSpeed: 7.4 + Math.random() * 1.6 });
    this.t = c ? 18 + Math.random() * 22 : 6;
    if (c) this.dress(c, firm);
  }

  dress(c, firm) {
    c.delivery = { state: 'drive', firm, done: new Set(), shop: null, target: null, lookT: 0, t: 0, cool: 3, worker: null, driver: null, n: 1, trips: 0, said: false };
    this.stats.vans++;
  }

  // (for the tests: a van up the curb lane to the shop s now, in plain view)
  sendTo(s) {
    const tr = this.traffic;
    const firm = pick(FIRMS);
    const c = tr.approach(s.door[0] - s.nx * 0.6, s.door[2] - s.nz * 0.6, Math.atan2(s.nx, s.nz), { kind: 'van', color: firm.van, extra: 'plain', curb: true }, { near: true, maxSpeed: 7 });
    if (!c) return null;
    this.dress(c, firm);
    c.delivery.cool = 0;
    return c;
  }

  // how fast the van may go (Traffic.drive, through Fleet.want)
  want(c, dt) {
    const D = c.delivery;
    if (D.state === 'stop' || D.state === 'out' || D.state === 'gone') return 0;
    if (D.state === 'leave') {
      c.sig2 = 1;
      return D.t < 1.4 ? 0 : Infinity;
    }
    if (D.cool > 0) return Infinity;
    // (a shop found is kept till it is reached - or rolled past)
    D.lookT -= dt;
    if (!D.target && D.lookT <= 0) {
      D.lookT = 0.4;
      D.target = this.find(c);
    }
    const s = D.target;
    if (!s) return Infinity;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    // (its back doors a step past the shop's door)
    const along = (s.door[0] - c.pos.x) * fx + (s.door[2] - c.pos.z) * fz;
    const dist = along + c.halfLen - 1.1;
    if (dist < -2) {
      D.done.add(s);
      D.target = null;
      c.pull = false;
      return Infinity;
    }
    if (dist < 34) c.sig2 = -1;
    // (over towards the curb as it slows: in the parking lane where there is a gap by the shop)
    if (dist < 16 && !c.pull) {
      c.pull = true;
      c.pullTo = this.traffic.curbRoom(c, Math.max(0, dist));
    }
    if (dist < 0.5 && c.speed < 0.4) {
      this.stopAt(c, s);
      return 0;
    }
    return dist < 0.5 ? 0 : Math.sqrt(2 * DECEL * dist) * 0.85;
  }

  // the next shop on its right, its front to the road, the way clear to it before the crossing
  find(c) {
    const D = c.delivery;
    const shops = this.game.world.shops;
    const g = c.path && c.path.gates[0];
    if (!g) return null;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const room = g.s - c.s;
    let best = null;
    let bd = Infinity;
    for (let i = 0; i < shops.length; i++) {
      const s = shops[i];
      if (!s.door || !s.room || s.cart || s.stand || D.done.has(s) || (s.kind && s.kind.startsWith('home'))) continue;
      const dx = s.door[0] - c.pos.x;
      const dz = s.door[2] - c.pos.z;
      if (Math.abs(dx) + Math.abs(dz) > 60) continue;
      const along = dx * fx + dz * fz;
      const right = -dx * fz + dz * fx;
      if (along < 9 || along > 44 || right < 3 || right > 15) continue;
      // (its door on the road's side: its front looks back at the van)
      if (s.nx * fz - s.nz * fx < 0.7) continue;
      if (along + 2 * c.halfLen + 3 > room) continue;
      if (along < bd) {
        bd = along;
        best = s;
      }
    }
    return best;
  }

  // pulled up by shop s: over to the curb, the hazards on
  stopAt(c, s) {
    const D = c.delivery;
    D.state = 'stop';
    D.shop = s;
    D.target = null;
    D.done.add(s);
    D.t = 0;
    D.n = 1 + Math.floor(Math.random() * 3);
    D.trips = 0;
    D.said = false;
    c.hazard = true;
    if (!c.pull) {
      c.pull = true;
      c.pullTo = this.traffic.curbRoom(c);
    }
    this.stats.stops++;
  }

  // ------------------------------------------------------------------ every frame (Fleet.update)
  tend(c, dt) {
    const D = c.delivery;
    const game = this.game;
    D.t += dt;
    if (D.cool > 0) D.cool -= dt;
    if (D.state === 'stop') {
      // (settled at the curb: out they get, if anybody is near to see it)
      if (D.t > 1.6 && c.speed < 0.2) {
        const cam = game.camera.position;
        if (Math.hypot(c.pos.x - cam.x, c.pos.z - cam.z) < 95 && game.civilians) this.out(c);
        else if (D.t > 22) this.leave(c);
      }
    } else if (D.state === 'out') {
      const w = D.worker;
      const civs = game.civilians;
      if (!w || !w.alive || w.panicT > 0 || w.headless || civs.list.indexOf(w) < 0 || w.ctrl !== D.ctrl) {
        // (hurt, frightened, gone: the van left where it stands, its hazards going)
        if (w && w.alive && civs.list.indexOf(w) >= 0) {
          if (w.inside) {
            w.inside = false;
            w.fig.setVisible(true);
          }
          w.fig.carry = null;
          if (w.ctrl === D.ctrl) civs.release(w);
          w.scripted = false;
          civs.rejoin(w);
        }
        D.worker = null;
        D.state = 'gone';
        c.stopped = true;
        this.stats.abandoned++;
      }
    } else if (D.state === 'leave') {
      if (D.t > 1.2) {
        c.pull = false;
        c.hazard = false;
      }
      if (D.t > 4.5) {
        D.state = 'drive';
        D.cool = 14 + Math.random() * 20;
      }
    }
  }

  // the hazards off, out into the lane again
  leave(c) {
    const D = c.delivery;
    D.state = 'leave';
    D.t = 0;
    D.shop = null;
  }

  // the driver out of the cab, and round to the back
  out(c) {
    const D = c.delivery;
    const game = this.game;
    const civs = game.civilians;
    const s = D.shop;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const rx = -fz;
    const rz = fx;
    // the cab's door (its left: the road's side), the back doors, the way across to the sidewalk
    const cab = [c.pos.x + fx * (c.halfLen * 0.42) - rx * (c.halfWid + 0.5), c.pos.z + fz * (c.halfLen * 0.42) - rz * (c.halfWid + 0.5)];
    const rear = [c.pos.x - fx * (c.halfLen + 0.75), c.pos.z - fz * (c.halfLen + 0.75)];
    const way = this.wayIn(c, rear, fx, fz, rx, rz);
    const w = civs.spawnScripted(cab[0], cab[1], workerLook(D.firm), this);
    w.noCollide = true;
    w.speed = 1.45;
    w.yaw = c.yaw + Math.PI / 2;
    D.worker = w;
    D.driver = c.driver;
    c.driver = null;
    // the walk, a leg at a time: round the back, across, to the door and in; and back the same way
    D.cab = cab;
    D.rear = rear;
    // (the legs of the walk in, as points: the way across, then the door; and inside it)
    D.legs = (way || []).concat([[s.door[0], s.door[2]]]);
    D.inside = s.inside ? [s.inside[0], s.inside[2]] : [s.door[0] - s.nx * 2.4, s.door[2] - s.nz * 2.4];
    D.leg = 0;
    D.phase = 'toRear';
    D.pt = 0;
    D.state = 'out';
    D.go = { x: 0, z: 0, speed: 0 };
    D.ctrl = (me, dt) => this.work(c, me, dt);
    w.ctrl = D.ctrl;
  }

  // from the van's back doors across to the sidewalk: straight over to the right, or - a car
  // parked there - along the van a little first, to the gap between two of them
  wayIn(c, rear, fx, fz, rx, rz) {
    for (const k of [0, -2.6, 2.6, -5.2, 5.2, -7.8]) {
      const sx = rear[0] + fx * k;
      const sz = rear[1] + fz * k;
      // (where the sidewalk begins, to the right)
      let d = 0;
      for (let step = 0.5; step < 14; step += 0.5) {
        if (groundHeight(sx + rx * step, sz + rz * step) > 0.05) {
          d = step;
          break;
        }
      }
      if (!d) return null;
      const ex = sx + rx * (d + 1.0);
      const ez = sz + rz * (d + 1.0);
      if (this.clear(sx, sz, ex, ez)) return k === 0 ? [[ex, ez]] : [[sx, sz], [ex, ez]];
    }
    return null;
  }

  // nothing parked across the way from (x0, z0) to (x1, z1)?
  clear(x0, z0, x1, z1) {
    const T = this.traffic;
    const P = T.parked;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (p.taken || Math.abs(p.pos.x - x0) + Math.abs(p.pos.z - z0) > 18) continue;
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        if (T.boxDist(p, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t) < 0.45) return false;
      }
    }
    return true;
  }

  // the driver's walk (game/civilians.js ctrl): where to go next, or null to stand
  work(c, me, dt) {
    const D = c.delivery;
    const game = this.game;
    const f = me.fig;
    const L = D.legs;
    D.pt += dt;
    const carrying = f.carry === 'box';
    const v = carrying ? 1.25 : 1.6;
    switch (D.phase) {
      case 'toRear':
        if (this.at(me, D.rear, 0.4) || D.pt > 12) {
          D.phase = 'load';
          D.pt = 0;
          return null;
        }
        return this.go(D, D.rear, 1.6);
      case 'load':
        // the back doors: a bend, and a box in both hands
        me.faceYaw = c.yaw + Math.PI;
        f.crouch = D.pt < 0.5 ? Math.min(1, D.pt * 3) * 0.7 : 0;
        if (D.pt > 0.45 && !carrying) f.carry = 'box';
        if (D.pt > 0.8) {
          f.crouch = 0;
          D.phase = 'in';
          D.leg = 0;
          D.pt = 0;
        }
        return null;
      case 'in': {
        const q = L[D.leg];
        if (this.at(me, q, D.leg === L.length - 1 ? 0.45 : 0.6) || D.pt > 14) {
          D.pt = 0;
          if (++D.leg >= L.length) {
            D.phase = 'enter';
            if (!D.said && Math.random() < 0.6 && Math.hypot(me.pos.x - game.player.pos.x, me.pos.z - game.player.pos.z) < 24) {
              D.said = true;
              game.bubbles.say(me, pick(AT_DOOR));
            }
          }
          return null;
        }
        return this.go(D, q, v);
      }
      case 'enter':
        // in through the door, out of sight a moment (the box put down inside)
        if (this.at(me, D.inside, 0.45) || D.pt > 5) {
          me.inside = true;
          f.setVisible(false);
          D.phase = 'inside';
          D.pt = 0;
          return null;
        }
        return this.go(D, D.inside, 1.2);
      case 'inside':
        if (D.pt > 1.7) {
          me.inside = false;
          f.setVisible(true);
          f.carry = null;
          me.pos.set(D.inside[0], me.pos.y, D.inside[1]);
          me.vel.set(0, 0, 0);
          D.trips++;
          this.stats.boxes++;
          D.phase = 'back';
          D.leg = L.length - 1;
          D.pt = 0;
        }
        return null;
      case 'back': {
        // out of the door and back the way it came (the legs in, the other way round), to the back
        // doors - for the next box, or round to the cab
        if (D.leg < 0) {
          if (this.at(me, D.rear, 0.4) || D.pt > 12) {
            D.pt = 0;
            D.phase = D.trips < D.n ? 'load' : 'toCab';
            return null;
          }
          return this.go(D, D.rear, v);
        }
        const q = L[D.leg];
        if (this.at(me, q, 0.6) || D.pt > 14) {
          D.leg--;
          D.pt = 0;
          return null;
        }
        return this.go(D, q, v);
      }
      case 'toCab':
        if (this.at(me, D.cab, 0.5) || D.pt > 12) {
          // in, and off
          game.civilians.remove(me);
          D.worker = null;
          c.driver = D.driver || c.driver;
          this.leave(c);
          return null;
        }
        return this.go(D, D.cab, 1.6);
      default:
        return null;
    }
  }

  // (the walk's next point, in the one object the driver is given every frame)
  go(D, q, v) {
    const o = D.go;
    o.x = q[0];
    o.z = q[1];
    o.speed = v;
    return o;
  }

  at(me, q, r) {
    const dx = me.pos.x - q[0];
    const dz = me.pos.z - q[1];
    return dx * dx + dz * dz < r * r;
  }

  // the van gone from the traffic (taken, or far behind you): its driver let go of, out on the
  // street as anybody else
  forget(c) {
    const D = c.delivery;
    if (!D) return;
    const w = D.worker;
    D.worker = null;
    if (!w) return;
    const civs = this.game.civilians;
    if (civs.list.indexOf(w) < 0) return;
    if (w.inside) {
      w.inside = false;
      w.fig.setVisible(true);
    }
    w.fig.carry = null;
    w.fig.crouch = 0;
    civs.release(w);
    w.scripted = false;
    civs.rejoin(w);
  }
}
