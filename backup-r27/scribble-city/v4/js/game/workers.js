import * as THREE from 'three';
import { civilianLook, copLook, shopkeeperLook, modest } from './looks.js';
import { sidewalkLoop } from './civilians.js';
import { RIDE } from './doodle.js';
import { AVES, STREETS, BLOCK_TYPES, blockRect, groundHeight, NORTH_EDGE, SOUTH_EDGE, CURB } from '../world/layout.js';
import { NODES, lightAt } from '../world/roads.js';

// People at work in the street (ROADMAP 3.2):
//   a street sweeper   in an orange vest, a broom and a wheeled bin, slowly along the curb; now and
//                      then a stop to sweep a spot and tip the dustpan into the bin
//   the postman        a satchel and a bundle of letters, from door to door along the shops
//   bike couriers      a box on the back, along the curb lane of the avenues; they stop at the red
//                      light, ring at you if you stand in the way, and leave the bike lying in the
//                      road if something frightens them
//   a traffic officer  on the corner of a crossing with lights, waving the cars that have the green
//                      on, the other hand up to the ones that wait, a whistle when it changes
//   road works         a fenced hole by the curb in a few blocks (always there); in working hours
//                      one man at it with a jackhammer, another with a shovel
//   the market         a seller behind every stall (and at the ice cream kiosk in the park), calling
//                      out; people come in from the street, look, buy and go with a bag
// Only round you, and only at the hours they work (no sweeping in the rain, nobody at night).
// (?classic: none of them)

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const POST_BLUE = [0.22, 0.4, 0.72];
const HIVIS = [0.97, 0.55, 0.16];
// a bike of one's own: the frame's colour
const BIKES = [[0.2, 0.55, 0.86], [0.95, 0.95, 0.96], [0.12, 0.12, 0.14], [0.3, 0.7, 0.45], [0.98, 0.5, 0.6], [0.92, 0.28, 0.24]];
const COURIERS = [[0.98, 0.55, 0.18], [0.16, 0.62, 0.58], [0.86, 0.24, 0.32]];
const INK = [0.12, 0.11, 0.14];
const STEEL = [0.55, 0.56, 0.6];
const RED = [0.86, 0.2, 0.2];
const WHITE = [0.97, 0.96, 0.93];
const CONE = [0.98, 0.5, 0.15];
const DIRT = [0.52, 0.38, 0.25];
const HOLE = [0.22, 0.19, 0.18];
const BIN = [0.26, 0.46, 0.33];
const JACK = [0.96, 0.74, 0.16];
const WHEEL_R = 0.34;
// the bike, in its rider's body units (up y, forward z, from the feet): the axles, the saddle,
// the top and the foot of the head tube, the bars (the crank is the rig's: doodle.js RIDE)
const BK = { rear: -0.46, front: 0.62, seatY: 0.86, seatZ: -0.06, headY: 0.95, headZ: 0.5, footY: 0.66, footZ: 0.55, barY: 1.02, barZ: 0.46, grip: 0.24 };
const _fwd = new THREE.Vector3();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _p = new THREE.Vector3();
// (ROADMAP 8.4) a car through the road works' fence: put back up when nobody has looked for a while
const REPAIR_T = 150;

// a seeded dice (the road works are where they are, every time)
function dice(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// leg k of the walk round a block: its ends, its direction, and the side away from the block
function legOf(L, k) {
  const n = L.length;
  const a = L[k % n];
  const b = L[(k + 1) % n];
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  // (round a block the walk goes clockwise; the houses west of Coral Ave face east)
  return { a, b, ux, uz, ox: n === 2 ? 1 : uz, oz: n === 2 ? 0 : -ux, len };
}

// the walk round a block moved out towards the curb by off
function curbLoop(L, off) {
  const n = L.length;
  if (n === 2) return L.map(([x, z]) => [x + off, z]);
  return L.map(([x, z], i) => {
    const g0 = legOf(L, (i + n - 1) % n);
    const g1 = legOf(L, i);
    return [x + (g0.ox + g1.ox) * off, z + (g0.oz + g1.oz) * off];
  });
}

// the walks round the blocks that pass within maxD of p
function nearLoops(p, maxD) {
  const out = [];
  for (let col = -1; col < 3; col++) {
    for (let row = 0; row < 5; row++) {
      const L = sidewalkLoop(col, row);
      let d = Infinity;
      for (let i = 0; i < L.length; i++) {
        const a = L[i];
        const b = L[(i + 1) % L.length];
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
        d = Math.min(d, Math.hypot(a[0] + dx * t - p.x, a[1] + dz * t - p.z));
      }
      if (d < maxD) out.push({ col, row, L });
    }
  }
  return out;
}

// ------------------------------------------------------------------ how they are dressed
function sweeperLook() {
  const L = civilianLook({ kind: 'street' });
  L.top = { kind: 'vest', color: HIVIS, sleeves: 'long', under: [0.3, 0.38, 0.34] };
  L.bottom = { kind: 'pants', color: [0.28, 0.36, 0.3] };
  L.hat = { kind: 'cap', color: [0.28, 0.36, 0.3] };
  L.acc = L.fem ? ['earrings'] : [];
  return modest(L);
}

function postLook() {
  const L = civilianLook({ kind: 'smart' });
  L.top = { kind: 'polo', color: POST_BLUE, sleeves: L.fem ? 'long' : 'short' };
  L.bottom = L.fem ? { kind: 'wide', color: [0.16, 0.2, 0.32] } : { kind: 'pants', color: [0.16, 0.2, 0.32] };
  L.hat = { kind: 'cap', color: POST_BLUE };
  L.acc = L.fem ? ['earrings', 'tote'] : ['tote'];
  L.bagColor = [0.5, 0.34, 0.2];
  return modest(L);
}

function courierLook(color) {
  const L = civilianLook({ kind: 'sporty' });
  L.top = { kind: 'track', color, sleeves: 'long' };
  L.bottom = { kind: 'pants', color: [0.14, 0.14, 0.17] };
  L.hat = { kind: 'cap', color };
  L.acc = L.fem ? ['earrings'] : [];
  return modest(L);
}

function trafficCopLook() {
  const L = copLook();
  // the high-visibility vest over the uniform
  L.top = { kind: 'vest', color: [0.86, 0.95, 0.3], sleeves: 'long', under: L.top.color };
  return modest(L);
}

function roadLook() {
  const L = civilianLook({ kind: 'worker', fem: false });
  L.top = { kind: 'vest', color: HIVIS, sleeves: 'short', under: pick([[0.9, 0.9, 0.88], [0.3, 0.42, 0.6]]) };
  L.hat = { kind: 'hardhat', color: [0.96, 0.8, 0.2] };
  return modest(L);
}

// the stall keepers (the market's stalls: what is for sale; the kiosk sells ice cream)
const STALL_KEEPER = { fruit: 'grocery', flowers: 'flowers', fish: 'sushi', bread: 'bagel', clothes: 'boutique', icecream: 'icecream' };
const STALL_CALLS = {
  fruit: ['Fresh peaches!', 'Sweet melons!', 'Two kilos, one price!'],
  flowers: ['Roses! Tulips!', 'Something for your sweetheart?', 'Fresh from the field!'],
  fish: ['Fresh fish! Caught this morning!', 'Sea bream, today only!'],
  bread: ['Warm bread!', 'Still hot from the oven!'],
  clothes: ['Everything half price!', 'Try it on, it\'s your size!'],
  icecream: ['Ice cream! Cold ice cream!', 'Two scoops for one!'],
};
const STALL_ITEM = { fruit: 'bag', flowers: 'bouquet', fish: 'bag', bread: 'bag', clothes: 'bag', icecream: 'icecream' };

// ------------------------------------------------------------------ the road works
// a few places by the curb (the middle of one side of a block, a seeded dice says which), where
// nothing else stands
function roadWorkSites(world) {
  const r = dice(4242);
  const out = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const type = BLOCK_TYPES[row][col];
      const R = blockRect(col, row);
      const side = Math.floor(r() * 4);
      const shift = (r() - 0.5) * 16;
      const keep = r() < 0.6;
      if (type === 'park' || type === 'gang' || !keep) continue;
      let x;
      let z;
      let ux = 0;
      let uz = 0;
      let ox = 0;
      let oz = 0;
      if (side === 0) [x, z, ux, oz] = [(R.x0 + R.x1) / 2 + shift, R.z0 - 3.75, 1, -1];
      else if (side === 1) [x, z, uz, ox] = [R.x1 + 3.75, (R.z0 + R.z1) / 2 + shift, 1, 1];
      else if (side === 2) [x, z, ux, oz] = [(R.x0 + R.x1) / 2 + shift, R.z1 + 3.75, 1, 1];
      else [x, z, uz, ox] = [R.x0 - 3.75, (R.z0 + R.z1) / 2 + shift, 1, -1];
      const hx = Math.abs(ux) * 1.7 + Math.abs(ox) * 0.75;
      const hz = Math.abs(uz) * 1.7 + Math.abs(oz) * 0.75;
      let clear = true;
      world.collision.forEachIn(x - hx - 0.4, z - hz - 0.4, x + hx + 0.4, z + hz + 0.4, (b) => {
        if (b.y1 > 0.2) {
          clear = false;
          return true;
        }
        return false;
      });
      if (!clear) continue;
      out.push({ x, z, ux, uz, ox, oz, x0: x - hx, z0: z - hz, x1: x + hx, z1: z + hz, men: null, drillT: 0, dustT: 0 });
    }
  }
  return out;
}

// the stalls: where the keeper stands, where a customer stands, what is on the counter
function stallsOf(world) {
  const out = [];
  for (const s of world.stands || []) {
    if (!s.f) continue;
    if (s.keeper) {
      const heap = s.f.p(1.6, CURB + 1.0, -0.6);
      out.push({ s, kind: s.kind, kx: s.keeper.x, kz: s.keeper.z, yaw: Math.atan2(s.nx, s.nz), fx: s.x, fz: s.z, heap: new THREE.Vector3(heap[0], heap[1], heap[2]), seller: null, buyer: null, callT: 3 + Math.random() * 6, workT: 2 });
    } else if (s.kind === 'icecream') {
      // the kiosk: the seller at the end of the counter, outside
      const k = s.f.p(3.3, CURB, 0.5);
      const heap = s.f.p(2.4, CURB + 1.05, 0.15);
      out.push({ s, kind: 'icecream', kx: k[0], kz: k[2], yaw: Math.atan2(s.x - k[0], s.z - k[2]), fx: s.x, fz: s.z, heap: new THREE.Vector3(heap[0], heap[1], heap[2]), seller: null, buyer: null, callT: 3 + Math.random() * 6, workT: 2, kiosk: true });
    }
  }
  return out;
}

export class Workers {
  constructor(game) {
    this.game = game;
    this.crew = []; // the sweepers, the postmen, the couriers out now
    this.fallen = []; // bikes left lying where their riders jumped off
    this.cop = null;
    this.copT = 2;
    this.hireT = 2;
    this.sites = null; // (worked out on the first frame: ?classic never needs them)
    this.stalls = null;
    this.shoppers = [];
    this.shopT = 2;
    // (counted for the tests)
    this.stats = { swept: 0, posted: 0, rode: 0, sold: 0, waved: 0, crashed: 0 };
  }

  get hour() {
    const d = this.game.daynight;
    return d ? d.hour : 12;
  }

  get rain() {
    const w = this.game.weather;
    return w ? w.cur.rain : 0;
  }

  // somewhere the camera does not see (behind it, or far)
  unseen(x, z, far = 48) {
    const cam = this.game.camera;
    const fwd = cam.getWorldDirection(_fwd);
    const dx = x - cam.position.x;
    const dz = z - cam.position.z;
    const d = Math.hypot(dx, dz) || 1;
    return d > far || (dx * fwd.x + dz * fwd.z) / d < 0.1;
  }

  near(c, r) {
    const p = this.game.player.pos;
    return Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < r;
  }

  say(c, list, r = 22) {
    if (this.near(c, r) && this.game.bubbles) this.game.bubbles.say(c, pick(list));
  }

  sound(x, z, name, r, vol = 1) {
    const p = this.game.player.pos;
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < r) this.game.audio.play(name, vol * (1 - d / r));
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    if (game.classic || game.inBar) return;
    if (!this.sites) this.setup();
    const p = game.anchorPos();
    for (const w of this.crew.slice()) this.tend(w, dt, p);
    this.updateCop(dt, p);
    this.updateSites(dt, p);
    this.updateStalls(dt, p);
    if (this.fallen.length) {
      for (const b of this.fallen) b.t += dt;
      this.fallen = this.fallen.filter((b) => b.t < 45 && Math.hypot(b.x - p.x, b.z - p.z) < 130);
    }
    this.hireT -= dt;
    if (this.hireT <= 0) {
      this.hireT = 3 + Math.random() * 4;
      this.hire(p);
    }
  }

  setup() {
    const w = this.game.world;
    this.sites = roadWorkSites(w);
    this.stalls = stallsOf(w);
    // the fences round the holes are there for good (you walk round them)
    for (const s of this.sites) {
      s.box = w.collision.addBox(s.x0, s.z0, s.x1, s.z1, 0, 1.1, 'prop');
      if (w.nav) w.nav.refresh(s.x0 - 1, s.z0 - 1, s.x1 + 1, s.z1 + 1);
    }
  }

  // somebody new at work round you (one at a time)
  hire(p) {
    const h = this.hour;
    const rain = this.rain;
    const n = (k) => this.crew.filter((w) => w.kind === k).length;
    if (h > 6 && h < 19.5 && rain < 0.3 && n('sweep') < 1) this.newSweeper(p);
    else if (h > 8 && h < 17.5 && rain < 0.5 && n('post') < 1) this.newPostie(p);
    else if (h > 7 && h < 23 && rain < 0.4 && n('bike') < (this.game.touch ? 1 : 3)) this.newCourier(p);
  }

  // the crew: the frightened or hurt drop what they do; the far ones go home
  tend(w, dt, p) {
    const c = w.c;
    w.life -= dt;
    // (sent home by the city: it does that to whoever walks too far from you)
    if (this.game.civilians.list.indexOf(c) < 0) {
      this.crew.splice(this.crew.indexOf(w), 1);
      return;
    }
    if (!c.alive || c.headless || c.owner !== this || c.panicT > 0) {
      this.drop(w);
      return;
    }
    const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
    if (d > (w.kind === 'bike' ? 130 : 100) || (w.life < 0 && this.unseen(c.pos.x, c.pos.z))) {
      this.dismiss(w);
      return;
    }
    if (w.kind === 'sweep') this.sweepFx(w, dt);
  }

  // dropped: the bike falls, the broom stays in the hand, they are one of the street's own now
  drop(w) {
    const c = w.c;
    this.crew.splice(this.crew.indexOf(w), 1);
    if (w.kind === 'bike') {
      this.fallen.push({ x: c.pos.x, z: c.pos.z, yaw: c.yaw, color: w.color, t: 0, box: !w.casual });
      c.fig.ride = 0;
      c.fig.reachR = null;
      c.fig.reachL = null;
    }
    if (c.owner === this) {
      this.game.civilians.release(c);
      c.scripted = false;
    }
  }

  dismiss(w) {
    this.crew.splice(this.crew.indexOf(w), 1);
    this.game.civilians.remove(w.c);
  }

  // ------------------------------------------------------------------ the street sweeper
  newSweeper(p) {
    const loops = nearLoops(p, 60);
    if (!loops.length) return;
    const { L } = pick(loops);
    const n = L.length;
    const k = Math.floor(Math.random() * (n === 2 ? 1 : n));
    const g = legOf(L, k);
    for (let tries = 0; tries < 6; tries++) {
      const t = 3 + Math.random() * Math.max(1, g.len - 6);
      const x = g.a[0] + g.ux * t + g.ox * 1.1;
      const z = g.a[1] + g.uz * t + g.oz * 1.1;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < 12 || d > 70 || !this.unseen(x, z)) continue;
      const c = this.game.civilians.spawnScripted(x, z, sweeperLook(), this);
      // (counted with the people of the street: the city sends out one walker fewer)
      c.scripted = false;
      c.fig.carry = 'broom';
      const dir = Math.random() < 0.5 ? 1 : -1;
      const path = curbLoop(L, 1.1);
      const w = { kind: 'sweep', c, path, dir, target: dir > 0 ? (k + 1) % n : k, stopT: 4 + Math.random() * 5, pause: 0, bin: { x: x - g.ux * dir, z: z - g.uz * dir }, dustT: 0, swishT: 0, life: 110 + Math.random() * 90, stuckT: 0, last: { x, z }, tip: new THREE.Vector3() };
      if (n === 2) w.target = dir > 0 ? 1 : 0;
      c.yaw = Math.atan2(g.ux * dir, g.uz * dir);
      c.ctrl = (civ, dt) => this.sweep(w, dt);
      this.crew.push(w);
      return;
    }
  }

  sweep(w, dt) {
    const c = w.c;
    const f = c.fig;
    // the bin trails behind, by the curb
    const bx = c.pos.x - f.forward.x * 0.95 - f.right.x * 0.35;
    const bz = c.pos.z - f.forward.z * 0.95 - f.right.z * 0.35;
    w.bin.x += (bx - w.bin.x) * Math.min(1, dt * 2.5);
    w.bin.z += (bz - w.bin.z) * Math.min(1, dt * 2.5);
    // a stop now and then: sweep the spot, tip the dustpan into the bin
    if (w.pause > 0) {
      w.pause -= dt;
      if (w.pause < 1.0 && w.pause > 0.3) f.reachL = w.tip.set(w.bin.x, groundHeight(w.bin.x, w.bin.z) + 1.0, w.bin.z);
      else f.reachL = null;
      if (w.pause <= 0) this.stats.swept++;
      return null;
    }
    w.stopT -= dt;
    if (w.stopT <= 0) {
      w.stopT = 6 + Math.random() * 9;
      w.pause = 2.6 + Math.random() * 2.4;
    }
    const P = w.path;
    let tgt = P[w.target];
    if (Math.hypot(tgt[0] - c.pos.x, tgt[1] - c.pos.z) < 0.8) {
      w.target = (w.target + w.dir + P.length) % P.length;
      tgt = P[w.target];
    }
    // held up by something (the fence of the road works, a parked car): back the other way
    w.stuckT += dt;
    if (w.stuckT > 3) {
      if (Math.hypot(c.pos.x - w.last.x, c.pos.z - w.last.z) < 0.4) {
        w.dir = -w.dir;
        w.target = (w.target + w.dir + P.length) % P.length;
      }
      w.stuckT = 0;
      w.last.x = c.pos.x;
      w.last.z = c.pos.z;
    }
    return { x: tgt[0], z: tgt[1], speed: 0.55 };
  }

  // dust off the broom, its swish
  sweepFx(w, dt) {
    const c = w.c;
    const cam = this.game.camera.position;
    const d = Math.hypot(c.pos.x - cam.x, c.pos.z - cam.z);
    if (d > 30) return;
    w.dustT -= dt;
    if (w.dustT <= 0) {
      w.dustT = 0.8 + Math.random() * 0.6;
      const f = c.fig;
      this.game.fx.crumbs(c.pos.x + f.forward.x * 0.55, c.pos.y + 0.08, c.pos.z + f.forward.z * 0.55, 2, 0.5, true);
    }
    w.swishT -= dt;
    if (w.swishT <= 0) {
      w.swishT = 1.2;
      this.sound(c.pos.x, c.pos.z, 'sweep', 12, 0.8);
    }
  }

  // ------------------------------------------------------------------ the postman
  newPostie(p) {
    const shops = this.game.world.shops || [];
    const loops = nearLoops(p, 55).sort(() => Math.random() - 0.5);
    for (const { L } of loops) {
      const n = L.length;
      for (let k = 0; k < (n === 2 ? 1 : n); k++) {
        const g = legOf(L, k);
        // the doors along this side of the block
        const doors = [];
        for (const s of shops) {
          const dx = s.door[0] - g.a[0];
          const dz = s.door[2] - g.a[1];
          const along = dx * g.ux + dz * g.uz;
          const across = Math.abs(dx * g.ox + dz * g.oz);
          if (along > 2 && along < g.len - 2 && across < 3.5) doors.push({ s, along });
        }
        if (doors.length < 2) continue;
        const dir = Math.random() < 0.5 ? 1 : -1;
        doors.sort((a, b) => (a.along - b.along) * dir);
        const first = doors[0];
        const back = 7;
        const t0 = first.along - back * dir;
        const x = g.a[0] + g.ux * t0;
        const z = g.a[1] + g.uz * t0;
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < 10 || d > 75 || !this.unseen(x, z)) continue;
        const c = this.game.civilians.spawnScripted(x, z, postLook(), this);
        c.scripted = false;
        c.fig.carryL = 'letters';
        c.yaw = Math.atan2(g.ux * dir, g.uz * dir);
        const stops = doors.slice(0, 6).map(({ s }) => ({ x: s.door[0] - s.nx * 0.25, z: s.door[2] - s.nz * 0.25, yaw: s.face + Math.PI, slot: new THREE.Vector3(s.door[0] - s.nx * 1.05, s.door[1] + 1.15, s.door[2] - s.nz * 1.05) }));
        const w = { kind: 'post', c, stops, i: 0, phase: 'go', t: 0, life: 160, said: false };
        c.ctrl = (civ, dt) => this.post(w, dt);
        this.crew.push(w);
        return;
      }
    }
  }

  post(w, dt) {
    const c = w.c;
    w.t += dt;
    const s = w.stops[w.i];
    if (!s) {
      // the round done: off along the sidewalk like anybody else
      this.crew.splice(this.crew.indexOf(w), 1);
      this.game.civilians.release(c);
      c.scripted = false;
      this.game.civilians.rejoin(c);
      return null;
    }
    if (w.phase === 'go') {
      if (Math.hypot(c.pos.x - s.x, c.pos.z - s.z) < 0.45 || w.t > 25) {
        w.phase = 'post';
        w.t = 0;
      } else return { x: s.x, z: s.z, speed: 1.35 };
    }
    // at the door: the letters through the slot (or into the hand of whoever is there)
    c.faceYaw = s.yaw;
    c.fig.reachR = w.t > 0.4 && w.t < 1.7 ? s.slot : null;
    if (w.t > 0.7 && !w.said) {
      w.said = true;
      this.stats.posted++;
      if (Math.random() < 0.35) this.say(c, ['Mail!', 'Post!', 'Morning!', 'Package for you!', 'Sign here, please.']);
    }
    if (w.t > 2.1) {
      w.i++;
      w.phase = 'go';
      w.t = 0;
      w.said = false;
      c.fig.reachR = null;
    }
    return null;
  }

  // ------------------------------------------------------------------ the bike couriers
  newCourier(p) {
    const aves = AVES.filter((a) => !a.blvd && Math.abs(a.x - p.x) < 80);
    if (!aves.length) return;
    const ave = pick(aves);
    const dz = Math.random() < 0.5 ? 1 : -1;
    const x = ave.x - dz * (ave.half - 0.45);
    for (let tries = 0; tries < 6; tries++) {
      const z = p.z + (Math.random() < 0.5 ? -1 : 1) * (35 + Math.random() * 45);
      if (z < NORTH_EDGE + 25 || z > SOUTH_EDGE - 25) continue;
      if (STREETS.some((s) => Math.abs(z - s.z) < s.half + 7)) continue;
      if (!this.unseen(x, z)) continue;
      // (now and then just somebody riding a bike, no box on the back: ROADMAP 4.1)
      const casual = Math.random() < 0.5;
      const color = casual ? pick(BIKES) : pick(COURIERS);
      const c = this.game.civilians.spawnScripted(x, z, casual ? civilianLook({ kind: pick(['sporty', 'street', 'denim', 'summer']) }) : courierLook(color), this);
      c.scripted = false;
      c.noCollide = true;
      c.fig.ride = 1;
      c.yaw = dz > 0 ? 0 : Math.PI;
      const nodes = STREETS.map((s) => NODES.find((m) => m.ave === ave && m.street === s));
      const w = { kind: 'bike', casual, c, ave, x, dz, nodes, v: 3, want: casual ? 4.2 + Math.random() * 1.2 : 5.2 + Math.random() * 1.8, color, bellT: 0, spin: 0, life: 240, gripR: new THREE.Vector3(), gripL: new THREE.Vector3() };
      c.ctrl = (civ, dt) => this.ride(w, dt);
      this.crew.push(w);
      this.stats.rode++;
      return;
    }
  }

  ride(w, dt) {
    const c = w.c;
    const f = c.fig;
    let want = w.want;
    // the next crossing: stop at its line while it is not green
    const time = this.game.traffic ? this.game.traffic.time : 0;
    for (let i = 0; i < STREETS.length; i++) {
      const s = STREETS[i];
      const ahead = (s.z - c.pos.z) * w.dz;
      const stop = s.half + 3.8;
      if (ahead > stop - 0.6 && ahead < stop + 30) {
        const n = w.nodes[i];
        if (n && lightAt(n, 'ns', time) !== 'g') want = Math.min(want, Math.max(0, (ahead - stop) * 0.7));
        break;
      }
    }
    // you, in the way: brake and ring
    const pl = this.game.player;
    const ax = (pl.pos.z - c.pos.z) * w.dz;
    if (!pl.inVehicle && ax > 0 && ax < 7 && Math.abs(pl.pos.x - c.pos.x) < 1.1) {
      want = Math.min(want, Math.max(0, (ax - 1.6) * 0.9));
      w.bellT -= dt;
      if (w.bellT <= 0) {
        w.bellT = 1.6;
        this.sound(c.pos.x, c.pos.z, 'bikebell', 25);
        if (Math.random() < 0.4) this.say(c, ['Coming through!', 'Watch out!', 'Bike lane, pal!']);
      }
    }
    w.v += Math.max(-5 * dt, Math.min(2.2 * dt, want - w.v));
    // the pedals go round with the wheels (none while it rolls to a stop)
    if (w.v > 0.3) f.crank += (w.v * dt) / (WHEEL_R * 2.4);
    w.spin += (w.v * dt) / WHEEL_R;
    // the hands on the bars (where they will be after this step)
    const vx = c.vel.x * dt;
    const vz = c.vel.z * dt;
    f.toWorld(BK.grip, BK.barY, BK.barZ, w.gripR).add(_v.set(vx, 0, vz));
    f.toWorld(-BK.grip, BK.barY, BK.barZ, w.gripL).add(_v);
    f.reachR = w.gripR;
    f.reachL = w.gripL;
    return { x: w.x, z: c.pos.z + w.dz * 5, speed: w.v };
  }

  // ------------------------------------------------------------------ the traffic officer
  updateCop(dt, p) {
    const game = this.game;
    const h = this.hour;
    const ok = h > 7 && h < 19 && this.rain < 0.35 && !(game.police && game.police.hostile);
    const cop = this.cop;
    if (cop) {
      const c = cop.c;
      if (!c.alive || c.headless || c.panicT > 0 || c.owner !== this || game.civilians.list.indexOf(c) < 0) {
        if (c.owner === this) {
          game.civilians.release(c);
          c.scripted = false;
        }
        this.cop = null;
        return;
      }
      const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
      if (d > 110 || (!ok && this.unseen(c.pos.x, c.pos.z))) {
        game.civilians.remove(c);
        this.cop = null;
      }
      return;
    }
    if (!ok) return;
    this.copT -= dt;
    if (this.copT > 0) return;
    this.copT = 3;
    // the nearest crossing with lights (not the boulevard's)
    let best = null;
    let bd = 80;
    for (const n of NODES) {
      if (!n.signal || n.ave.blvd) continue;
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    if (!best) return;
    // on the corner on your side of it
    const sx = Math.sign(p.x - best.x) || 1;
    const sz = Math.sign(p.z - best.z) || 1;
    const x = best.x + sx * (best.ave.half + 0.9);
    const z = best.z + sz * (best.street.half + 0.9);
    if (Math.hypot(x - p.x, z - p.z) < 25 && !this.unseen(x, z)) return;
    const c = game.civilians.spawnScripted(x, z, trafficCopLook(), this);
    c.noCollide = true;
    c.still = true;
    const me = { c, n: best, x, z, t: Math.random() * 5, last: '', armR: new THREE.Vector3(), armL: new THREE.Vector3() };
    c.ctrl = (civ, dt) => this.direct(me, dt);
    this.cop = me;
  }

  // the cars that have the green waved on with one arm, the others held with a raised hand
  direct(me, dt) {
    const c = me.c;
    const f = c.fig;
    const n = me.n;
    me.t += dt;
    c.pos.x += (me.x - c.pos.x) * Math.min(1, dt * 4);
    c.pos.z += (me.z - c.pos.z) * Math.min(1, dt * 4);
    const cx = n.x - c.pos.x;
    const cz = n.z - c.pos.z;
    c.faceYaw = Math.atan2(cx, cz);
    const time = this.game.traffic ? this.game.traffic.time : 0;
    const ns = lightAt(n, 'ns', time);
    const ew = lightAt(n, 'ew', time);
    const state = ns === 'g' ? 'ns' : ew === 'g' ? 'ew' : 'stop';
    if (state !== me.last) {
      if (me.last) {
        this.sound(c.pos.x, c.pos.z, 'whistle', 40);
        this.stats.waved++;
        if (Math.random() < 0.3) this.say(c, state === 'stop' ? ['Hold it!', 'Stop right there!'] : ['Go, go, go!', 'Keep it moving!', 'Come on through!'], 26);
      }
      me.last = state;
    }
    const j = f.j;
    const k = 0.5 + 0.5 * Math.sin(me.t * 3.4);
    // (towards the middle of the crossing, level)
    const l = Math.hypot(cx, cz) || 1;
    const fx = cx / l;
    const fz = cz / l;
    if (state === 'stop') {
      // both hands up: everybody waits
      me.armR.copy(j.shoulderR).add(_v.set(fx * 0.3, 0.42, fz * 0.3));
      me.armL.copy(j.shoulderL).add(_v.set(fx * 0.3, 0.42, fz * 0.3));
    } else {
      // along the road that has the green: towards the middle of the crossing; the other road's
      // direction gets the palm
      let gx = state === 'ns' ? 0 : 1;
      let gz = state === 'ns' ? 1 : 0;
      if (gx * fx + gz * fz < 0) {
        gx = -gx;
        gz = -gz;
      }
      let hx = state === 'ns' ? 1 : 0;
      let hz = state === 'ns' ? 0 : 1;
      if (hx * fx + hz * fz < 0) {
        hx = -hx;
        hz = -hz;
      }
      // which hand is on which side
      const rx = f.right.x;
      const rz = f.right.z;
      const goRight = gx * rx + gz * rz > hx * rx + hz * rz;
      const go = goRight ? me.armR : me.armL;
      const hold = goRight ? me.armL : me.armR;
      const sg = goRight ? j.shoulderR : j.shoulderL;
      const sh = goRight ? j.shoulderL : j.shoulderR;
      // the waving arm sweeps from out along the road in to the front
      go.copy(sg).add(_v.set(gx * 0.55 * (0.45 + 0.55 * k) + fx * 0.25 * (1 - k), 0.02 + 0.1 * k, gz * 0.55 * (0.45 + 0.55 * k) + fz * 0.25 * (1 - k)));
      hold.copy(sh).add(_v.set(hx * 0.42, 0.34, hz * 0.42));
    }
    f.reachR = me.armR;
    f.reachL = me.armL;
    return null;
  }

  // ------------------------------------------------------------------ the road works
  updateSites(dt, p) {
    const h = this.hour;
    const working = h > 7 && h < 17.5 && this.rain < 0.3;
    for (const s of this.sites) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      // (driven through: the boards fly and come down; put back up later - ROADMAP 8.4)
      if (s.broken) {
        this.boardsStep(s, dt);
        if (this.game.time - s.broken.t > REPAIR_T && d > 60 && this.unseen(s.x, s.z)) this.repair(s);
        continue;
      }
      if (s.men) {
        const lost = s.men.some((m) => !m.c.alive || m.c.panicT > 0 || m.c.owner !== this || this.game.civilians.list.indexOf(m.c) < 0);
        if (lost || d > 100 || (!working && this.unseen(s.x, s.z))) this.leaveSite(s, lost);
        else this.digging(s, dt, d);
      } else if (working && d < 75 && d > 14 && this.unseen(s.x, s.z, 40)) this.staffSite(s);
    }
  }

  // ------------------------------------------------------------------ (ROADMAP 8.4) through the fence
  // a car driven through the fence round a hole (game/knock.js sweep): the boards fly and come
  // down in the road, the legs go over, the cones go off on their own (game/knock.js), the men
  // run. The hole stays, open now
  crash(s, v) {
    if (s.broken) return;
    const game = this.game;
    const w = game.world;
    w.collision.remove(s.box);
    if (w.nav) w.nav.refresh(s.x0 - 1, s.z0 - 1, s.x1 + 1, s.z1 + 1);
    const sp = Math.abs(v.speed);
    const sg = Math.sign(v.speed) || 1;
    const fx = v.fwd.x * sg;
    const fz = v.fwd.z * sg;
    const gy = groundHeight(s.x, s.z);
    const B = { t: game.time, boards: [], legs: [], gone: false };
    const C = [[s.x0, s.z0], [s.x1, s.z0], [s.x1, s.z1], [s.x0, s.z1]];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = C[i];
      const [bx, bz] = C[(i + 1) % 4];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(2, Math.round(len / 0.45));
      // each side's two rails, in one piece or two
      const parts = n > 4 ? 2 : 1;
      for (const y of [0.55, 0.95]) {
        for (let j = 0; j < parts; j++) {
          const k0 = Math.round((n * j) / parts);
          const k1 = Math.round((n * (j + 1)) / parts);
          const t0 = k0 / n;
          const t1 = k1 / n;
          const cx = ax + ((bx - ax) * (t0 + t1)) / 2;
          const cz = az + ((bz - az) * (t0 + t1)) / 2;
          // flung the way the car went, the harder the nearer its bumper
          const near = Math.max(0.3, 1 - Math.hypot(cx - v.pos.x, cz - v.pos.z) / 6);
          const push = sp * (0.55 + Math.random() * 0.45) * near;
          B.boards.push({
            x: cx, y: gy + y, z: cz,
            d: new THREE.Vector3((bx - ax) / len, 0, (bz - az) / len),
            hl: (len * (t1 - t0)) / 2,
            v: new THREE.Vector3(fx * push + (Math.random() - 0.5) * 2, 1.4 + Math.random() * 2.2 + sp * 0.08, fz * push + (Math.random() - 0.5) * 2),
            w: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 10),
            k0, k1, n, rest: false, seed: i * 40 + k0 + y * 10,
          });
        }
      }
      // the legs: over, the way the car went
      B.legs.push({ x: ax, z: az, yaw: Math.atan2(fx + (Math.random() - 0.5) * 0.9, fz + (Math.random() - 0.5) * 0.9), a: 0.08, w: 1.5 + Math.random() * 2 });
    }
    s.broken = B;
    // the cones at the ends: on their own now (the one the car hit, off it goes)
    const KN = game.knock;
    if (KN) {
      for (const e of [-1, 1]) {
        const cx = s.x + s.ux * e * 2.15 - s.ox * 0.3;
        const cz = s.z + s.uz * e * 2.15 - s.oz * 0.3;
        const c = KN.cone(cx, cz, B);
        if (c && Math.hypot(cx - v.pos.x, cz - v.pos.z) < 4) KN.launch(c, v);
      }
    }
    if (s.men) this.leaveSite(s, true);
    this.stats.crashed++;
    game.audio.play('crash', Math.min(1, 0.4 + sp / 25));
    game.audio.play('clang', 0.5);
    game.fx.crumbs(s.x, gy + 0.6, s.z, 12, 3);
    game.camRig.addShake(0.25);
    game.civilians.panic(new THREE.Vector3(s.x, 0, s.z), 9);
    // (the car feels it, a little)
    v.speed *= 0.86;
    if (v.vx !== undefined) {
      v.vx *= 0.86;
      v.vz *= 0.86;
    }
    if (v.hurt) v.hurt(4);
  }

  // the boards in the air: down, turning, a bounce or two, and they lie flat in the road; the legs
  // go over round their feet
  boardsStep(s, dt) {
    const B = s.broken;
    const col = this.game.world.collision;
    for (const b of B.boards) {
      if (b.rest) continue;
      b.v.y -= 14 * dt;
      b.x += b.v.x * dt;
      b.y += b.v.y * dt;
      b.z += b.v.z * dt;
      b.d.addScaledVector(_w.copy(b.w).cross(b.d), dt).normalize();
      // (off the walls)
      _p.set(b.x, b.y - 0.1, b.z);
      const res = col.resolveCylinder(_p, 0.15, 0.2, 0.3);
      if (res.hitWall) {
        b.x = _p.x;
        b.z = _p.z;
        const vn = b.v.x * res.nx + b.v.z * res.nz;
        if (vn < 0) {
          b.v.x -= 1.5 * vn * res.nx;
          b.v.z -= 1.5 * vn * res.nz;
        }
      }
      const g = groundHeight(b.x, b.z) + 0.04;
      const low = b.y - Math.abs(b.d.y) * b.hl;
      if (low < g) {
        b.y += g - low;
        if (b.v.y < -2.2) {
          b.v.y *= -0.3;
          b.v.x *= 0.6;
          b.v.z *= 0.6;
          b.w.multiplyScalar(0.45);
          b.d.y *= 0.5;
          b.d.normalize();
        } else {
          b.v.y = Math.max(0, b.v.y);
          const fr = Math.exp(-6 * dt);
          b.v.x *= fr;
          b.v.z *= fr;
          b.w.multiplyScalar(Math.exp(-6 * dt));
          b.d.y *= Math.exp(-8 * dt);
          b.d.normalize();
          if (b.v.x * b.v.x + b.v.z * b.v.z < 0.04) {
            b.rest = true;
            b.d.y = 0;
            b.d.normalize();
            b.y = g;
          }
        }
      }
    }
    for (const L of B.legs) {
      if (L.a >= Math.PI / 2 - 0.06) continue;
      L.w += 9 * Math.sin(L.a) * dt;
      L.a = Math.min(Math.PI / 2 - 0.06, L.a + L.w * dt);
    }
  }

  // put back up, as it was (the cones by it go when you are far: game/knock.js)
  repair(s) {
    const w = this.game.world;
    s.broken.gone = true;
    s.broken = null;
    s.box = w.collision.addBox(s.x0, s.z0, s.x1, s.z1, 0, 1.1, 'prop');
    if (w.nav) w.nav.refresh(s.x0 - 1, s.z0 - 1, s.x1 + 1, s.z1 + 1);
  }

  staffSite(s) {
    const civs = this.game.civilians;
    // the man with the jackhammer in the hole, the one with the shovel at its end
    const a = civs.spawnScripted(s.x + s.ux * 0.6, s.z + s.uz * 0.6, roadLook(), this);
    const b = civs.spawnScripted(s.x - s.ux * 1.05 + s.ox * 0.15, s.z - s.uz * 1.05 + s.oz * 0.15, roadLook(), this);
    for (const c of [a, b]) {
      c.noCollide = true;
      c.still = true;
    }
    a.yaw = Math.atan2(-s.ux, -s.uz);
    b.yaw = Math.atan2(s.ux, s.uz);
    const men = [
      { c: a, job: 'drill', x: a.pos.x, z: a.pos.z, yaw: a.yaw, t: 0, hR: new THREE.Vector3(), hL: new THREE.Vector3() },
      { c: b, job: 'dig', x: b.pos.x, z: b.pos.z, yaw: b.yaw, t: Math.random() * 3, hR: new THREE.Vector3(), hL: new THREE.Vector3() },
    ];
    for (const m of men) m.c.ctrl = (civ, dt) => this.work(s, m, dt);
    s.men = men;
  }

  leaveSite(s, lost) {
    for (const m of s.men) {
      const c = m.c;
      if (c.owner !== this) continue;
      if (lost && c.alive) {
        c.fig.reachR = null;
        c.fig.reachL = null;
        this.game.civilians.release(c);
        c.scripted = false;
      } else this.game.civilians.remove(c);
    }
    s.men = null;
  }

  // the jackhammer shakes the one holding it (and everything round it sounds of it); the shovel
  // goes in, comes up with earth, swings it onto the heap
  work(s, m, dt) {
    const c = m.c;
    const f = c.fig;
    m.t += dt;
    c.faceYaw = m.yaw;
    const fx = Math.sin(m.yaw);
    const fz = Math.cos(m.yaw);
    const gy = groundHeight(m.x, m.z);
    if (m.job === 'drill') {
      // bursts of a few seconds, a breather between
      const on = m.t % 6 < 4.2;
      m.on = on;
      const jx = on ? (Math.random() - 0.5) * 0.025 : 0;
      const jz = on ? (Math.random() - 0.5) * 0.025 : 0;
      c.pos.x = m.x + jx;
      c.pos.z = m.z + jz;
      // the handles at the hips, the tool straight down in front
      m.hR.set(m.x + fx * 0.36 + fz * 0.17, gy + 0.95 + jx * 2, m.z + fz * 0.36 - fx * 0.17);
      m.hL.set(m.x + fx * 0.36 - fz * 0.17, gy + 0.95 + jz * 2, m.z + fz * 0.36 + fx * 0.17);
      f.reachR = m.hR;
      f.reachL = m.hL;
      return null;
    }
    // digging: down, lift, swing to the side
    c.pos.x = m.x;
    c.pos.z = m.z;
    const ph = (m.t % 3.2) / 3.2;
    const down = ph < 0.35 ? ph / 0.35 : ph < 0.6 ? 1 - (ph - 0.35) / 0.25 : 0;
    const side = ph > 0.6 && ph < 0.85 ? Math.sin(((ph - 0.6) / 0.25) * Math.PI) : 0;
    const rx = -fz;
    const rz = fx;
    m.hR.set(m.x + fx * (0.45 + down * 0.15) + rx * side * 0.4, gy + 1.0 - down * 0.55 + side * 0.2, m.z + fz * (0.45 + down * 0.15) + rz * side * 0.4);
    m.hL.set(m.x + fx * 0.2 + rx * (side * 0.2 - 0.12), gy + 1.15 - down * 0.4 + side * 0.15, m.z + fz * 0.2 + rz * (side * 0.2 - 0.12));
    f.reachR = m.hR;
    f.reachL = m.hL;
    m.dig = { down, side };
    if (ph > 0.75 && !m.tossed) {
      m.tossed = true;
      if (this.near(c, 30)) this.game.fx.crumbs(m.hR.x + rx * 0.3, m.hR.y - 0.5, m.hR.z + rz * 0.3, 4, 0.8, true);
    } else if (ph < 0.5) m.tossed = false;
    return null;
  }

  digging(s, dt, d) {
    const m = s.men[0];
    if (!m.on || d > 40) return;
    s.drillT -= dt;
    if (s.drillT <= 0) {
      s.drillT = 0.45;
      this.sound(s.x, s.z, 'drill', 45, 0.9);
    }
    s.dustT -= dt;
    if (s.dustT <= 0 && d < 30) {
      s.dustT = 0.35 + Math.random() * 0.3;
      const fx = Math.sin(m.yaw);
      const fz = Math.cos(m.yaw);
      this.game.fx.crumbs(m.x + fx * 0.4, groundHeight(m.x, m.z) + 0.1, m.z + fz * 0.4, 3, 1.1, true);
      if (Math.random() < 0.25) this.game.fx.smoke(m.x + fx * 0.4, groundHeight(m.x, m.z) + 0.25, m.z + fz * 0.4, 0.5);
    }
  }

  // ------------------------------------------------------------------ the market
  updateStalls(dt, p) {
    const h = this.hour;
    const open = h > 7 && h < 20 && this.rain < 0.5;
    // (a seller at the stalls nearest you: a few, fewer on a phone)
    this.rankT = (this.rankT || 0) - dt;
    if (this.rankT <= 0) {
      this.rankT = 1;
      const most = this.game.touch ? 4 : 8;
      const near = this.stalls.map((st) => [Math.hypot(st.fx - p.x, st.fz - p.z), st]).filter((o) => o[0] < 48).sort((a, b) => a[0] - b[0]);
      for (const st of this.stalls) st.wanted = false;
      for (let i = 0; i < near.length && i < most; i++) near[i][1].wanted = true;
    }
    for (const st of this.stalls) {
      const d = Math.hypot(st.fx - p.x, st.fz - p.z);
      const c = st.seller;
      if (c) {
        if (!c.alive || c.headless || c.panicT > 0 || c.owner !== this || this.game.civilians.list.indexOf(c) < 0) {
          if (c.owner === this) {
            this.game.civilians.release(c);
            c.scripted = false;
          }
          st.seller = null;
          st.gone = true;
        } else if (d > 80 || ((!open || !st.wanted) && this.unseen(st.kx, st.kz, 30))) {
          if (st.buyer) this.shopDone(st.buyer);
          this.game.civilians.remove(c);
          st.seller = null;
        }
      } else if (open && st.wanted && !st.gone) {
        const s = this.game.civilians.spawnScripted(st.kx, st.kz, shopkeeperLook(STALL_KEEPER[st.kind] || 'shop'), this);
        s.noCollide = true;
        s.still = true;
        s.yaw = st.yaw;
        s.ctrl = (civ, dt) => this.sell(st, dt);
        st.seller = s;
      }
      if (st.gone && d > 120) st.gone = false;
    }
    // shoppers from the street, while the market is open round you
    for (const v of this.shoppers.slice()) this.shopping(v, dt);
    this.shopT -= dt;
    if (this.shopT > 0) return;
    this.shopT = 2.5 + Math.random() * 3;
    const most = this.game.touch ? 2 : 6;
    if (this.shoppers.length >= most) return;
    const stalls = this.stalls.filter((s) => s.seller && !s.buyer);
    if (!stalls.length) return;
    const st = pick(stalls);
    // somebody walking near the stall comes over
    let best = null;
    let bd = st.kiosk ? 26 : 34;
    for (const c of this.game.civilians.list) {
      if (c.scripted || c.ctrl || !c.alive || c.panicT > 0 || c.headless || c.dog || c.buddy || c.buddyOf || c.jog || c.inside) continue;
      if (c.fig.parts.legL < 0.5 || c.fig.parts.legR < 0.5 || c.fig.carryL) continue;
      const dd = Math.hypot(c.pos.x - st.fx, c.pos.z - st.fz);
      if (dd < bd && dd > 4) {
        bd = dd;
        best = c;
      }
    }
    if (!best) return;
    best.scripted = true;
    best.owner = this;
    const v = { c: best, st, phase: 'go', t: 0, visits: 0, spot: { x: st.fx + (Math.random() - 0.5) * 0.8, z: st.fz + (Math.random() - 0.5) * 0.4 } };
    st.buyer = v;
    best.ctrl = (civ, dt) => this.shop(v, dt);
    this.shoppers.push(v);
  }

  // the seller: tidies the goods, calls out, hands over what was bought
  sell(st, dt) {
    const c = st.seller;
    const f = c.fig;
    c.faceYaw = st.yaw;
    c.pos.x += (st.kx - c.pos.x) * Math.min(1, dt * 4);
    c.pos.z += (st.kz - c.pos.z) * Math.min(1, dt * 4);
    const v = st.buyer;
    if (v && v.phase === 'pay') {
      // across the counter to the customer's hand
      c.faceYaw = Math.atan2(v.c.pos.x - c.pos.x, v.c.pos.z - c.pos.z);
      f.reachR = v.c.fig.j.handR;
      return null;
    }
    st.workT -= dt;
    f.reachR = st.workT < 0.9 && st.workT > 0 ? st.heap : null;
    if (st.workT <= 0) st.workT = 3 + Math.random() * 4;
    st.callT -= dt;
    if (st.callT <= 0) {
      st.callT = 7 + Math.random() * 7;
      this.say(c, STALL_CALLS[st.kind] || ['Fresh! Cheap!'], 18);
    }
    return null;
  }

  shopping(v, dt) {
    const c = v.c;
    if (!c.alive || c.panicT > 0 || c.headless || c.owner !== this || this.game.civilians.list.indexOf(c) < 0 || !v.st.seller) this.shopDone(v);
  }

  shop(v, dt) {
    const c = v.c;
    const st = v.st;
    v.t += dt;
    if (v.phase === 'go') {
      if (Math.hypot(c.pos.x - v.spot.x, c.pos.z - v.spot.z) < 0.5 || v.t > 30) {
        v.phase = 'look';
        v.t = 0;
        v.stay = 3 + Math.random() * 5;
      } else return { x: v.spot.x, z: v.spot.z, speed: c.speed };
    }
    if (v.phase === 'leave') {
      if (Math.hypot(c.pos.x - v.out.x, c.pos.z - v.out.z) < 1 || v.t > 30) {
        this.shopDone(v);
        return null;
      }
      return { x: v.out.x, z: v.out.z, speed: c.speed };
    }
    // at the counter, facing the goods
    c.faceYaw = Math.atan2(st.heap.x - c.pos.x, st.heap.z - c.pos.z);
    if (v.phase === 'look') {
      c.fig.reachR = v.t % 3 > 2.1 ? st.heap : null;
      if (v.t > v.stay) {
        v.phase = 'pay';
        v.t = 0;
        c.fig.reachR = null;
        if (Math.random() < 0.4) this.say(c, ['How much?', 'Two of those, please.', 'This one, please.', 'Looks great!'], 18);
      }
      return null;
    }
    // paying, and what was bought in the hand
    if (v.t > 1.6) {
      const item = STALL_ITEM[st.kind] || 'bag';
      if (item === 'icecream') c.fig.carry = 'icecream';
      else c.fig.carryL = item;
      c.fig.bagBread = st.kind === 'bread';
      c.carryUntil = this.game.time + 60;
      this.stats.sold++;
      if (Math.random() < 0.5 && st.seller) this.say(st.seller, ['Thank you!', 'Enjoy!', 'Come again!'], 18);
      st.buyer = null;
      // out to the sidewalk nearest
      const g = this.game.civilians.nearestBlock(c.pos.x, c.pos.z);
      const L = g[0] === 'prom' ? null : sidewalkLoop(g[0], g[1]);
      v.out = L ? closestOn(L, c.pos.x, c.pos.z) : { x: c.pos.x + 6, z: c.pos.z };
      v.phase = 'leave';
      v.t = 0;
    }
    return null;
  }

  shopDone(v) {
    const i = this.shoppers.indexOf(v);
    if (i >= 0) this.shoppers.splice(i, 1);
    if (v.st.buyer === v) v.st.buyer = null;
    const c = v.c;
    c.fig.reachR = null;
    if (c.owner === this) {
      this.game.civilians.release(c);
      c.scripted = false;
      this.game.civilians.rejoin(c);
    }
  }

  // ------------------------------------------------------------------ drawing
  draw(fr) {
    const game = this.game;
    if (game.classic || !this.sites) return;
    const cam = game.camera.position;
    const fwd = game.camera.getWorldDirection(_fwd);
    const seen = (x, z, far) => {
      const dx = x - cam.x;
      const dz = z - cam.z;
      const d = Math.hypot(dx, dz);
      return d < far && (d < 8 || dx * fwd.x + dz * fwd.z > -4);
    };
    for (const w of this.crew) {
      if (w.kind === 'bike' && seen(w.c.pos.x, w.c.pos.z, 120)) this.drawBike(fr, w.c.fig, w.color, w.spin, null, !w.casual);
      else if (w.kind === 'sweep' && seen(w.bin.x, w.bin.z, 70)) this.drawBin(fr, w);
    }
    for (const b of this.fallen) if (seen(b.x, b.z, 100)) this.drawBike(fr, null, b.color, 0, b, b.box !== false);
    for (const s of this.sites) {
      if (!seen(s.x, s.z, 110)) continue;
      this.drawSite(fr, s);
      if (s.men) this.drawTools(fr, s);
    }
  }

  // a bike: two wheels, the frame in the courier's colour, the bars, the saddle, the cranks, and
  // the box on the rack; under its rider (fig), or lying in the road (lie: { x, z, yaw })
  drawBike(fr, fig, color, spin, lie, box = true) {
    let P;
    if (fig) P = (x, y, z, out) => fig.toWorld(x, y, z, out);
    else {
      const fx = Math.sin(lie.yaw);
      const fz = Math.cos(lie.yaw);
      const gy = groundHeight(lie.x, lie.z);
      // on its side: what was up is now along the ground to the right
      P = (x, y, z, out) => out.set(lie.x + fx * z - fz * y, gy + 0.05 + (x + 0.25) * 0.5, lie.z + fz * z + fx * y);
    }
    const seed = fig ? fig.seed * 7 : lie.x;
    const a = _v;
    const b = _w;
    const L = (x0, y0, z0, x1, y1, z1, col, wd, k) => {
      P(x0, y0, z0, a);
      P(x1, y1, z1, b);
      fr.lineXYZ(a.x, a.y, a.z, b.x, b.y, b.z, col, wd, seed + k, 1, 0.004, 0.005);
    };
    // the wheels and a few spokes going round
    for (const [wz, k0] of [[BK.rear, 0], [BK.front, 40]]) {
      let py = WHEEL_R * 2;
      let pz = wz;
      for (let i = 1; i <= 14; i++) {
        const t = (i / 14) * Math.PI * 2;
        const y = WHEEL_R + WHEEL_R * Math.cos(t);
        const z = wz + WHEEL_R * Math.sin(t);
        L(0, py, pz, 0, y, z, INK, 3, k0 + i);
        py = y;
        pz = z;
      }
      for (let i = 0; i < 3; i++) {
        const t = spin + (i / 3) * Math.PI;
        L(0, WHEEL_R + WHEEL_R * 0.92 * Math.cos(t), wz + WHEEL_R * 0.92 * Math.sin(t), 0, WHEEL_R - WHEEL_R * 0.92 * Math.cos(t), wz - WHEEL_R * 0.92 * Math.sin(t), STEEL, 1, k0 + 20 + i);
      }
    }
    const cy = RIDE.crankY;
    const cz = RIDE.crankZ;
    // the frame
    L(0, cy, cz, 0, BK.seatY, BK.seatZ, color, 3.4, 60);
    L(0, BK.seatY - 0.04, BK.seatZ, 0, BK.headY - 0.04, BK.headZ, color, 3.4, 61);
    L(0, cy, cz, 0, BK.footY, BK.footZ, color, 3.4, 62);
    L(0, cy, cz, 0, WHEEL_R, BK.rear, color, 2.6, 63);
    L(0, BK.seatY - 0.06, BK.seatZ, 0, WHEEL_R, BK.rear, color, 2.6, 64);
    L(0, BK.headY, BK.headZ, 0, BK.footY, BK.footZ, color, 3.6, 65);
    L(0, BK.footY, BK.footZ, 0, WHEEL_R, BK.front, STEEL, 2.6, 66);
    // the stem, the bars, the saddle
    L(0, BK.headY, BK.headZ, 0, BK.barY, BK.barZ, INK, 2.6, 67);
    L(-BK.grip, BK.barY, BK.barZ, BK.grip, BK.barY, BK.barZ, INK, 2.8, 68);
    L(0, BK.seatY + 0.03, BK.seatZ - 0.1, 0, BK.seatY + 0.03, BK.seatZ + 0.08, INK, 5, 69);
    // the cranks and the pedals
    const ca = fig ? fig.crank : 0.6;
    for (const [s, off] of [[1, 0], [-1, Math.PI]]) {
      const py = cy - Math.cos(ca + off) * RIDE.crank;
      const pz = cz - Math.sin(ca + off) * RIDE.crank;
      L(s * 0.07, cy, cz, s * 0.08, py, pz, STEEL, 2.2, 70 + (s > 0 ? 0 : 2));
      L(s * 0.05, py, pz, s * 0.15, py, pz, INK, 3, 71 + (s > 0 ? 0 : 2));
    }
    if (!box) return;
    // the box on the rack: its edges, its sides filled with strokes of the colour (close enough
    // together to fill it from where you look), a white stripe
    const x0 = -0.2;
    const x1 = 0.2;
    const y0 = 0.64;
    const y1 = 1.02;
    const z0 = -0.8;
    const z1 = -0.3;
    P(0, 0.8, -0.55, a);
    const cam = this.game.camera.position;
    const gap = Math.min(0.06, Math.max(0.014, Math.hypot(cam.x - a.x, cam.y - a.y, cam.z - a.z) * 0.0045));
    L(0, 0.62, z0 + 0.05, 0, BK.seatY - 0.1, BK.seatZ - 0.05, INK, 1.6, 74);
    const nz = Math.ceil((z1 - z0) / gap);
    for (let i = 0; i <= nz; i++) {
      const z = z0 + ((z1 - z0) * i) / nz;
      L(x1 + 0.005, y0, z, x1 + 0.005, y1, z, color, 6, 80 + (i & 15));
      L(x0 - 0.005, y0, z, x0 - 0.005, y1, z, color, 6, 96 + (i & 15));
    }
    const nx = Math.ceil((x1 - x0) / gap);
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx;
      L(x, y0, z0 - 0.005, x, y1, z0 - 0.005, color, 6, 140 + (i & 15));
      L(x, y1 + 0.005, z0, x, y1 + 0.005, z1, color, 6, 160 + (i & 15));
    }
    L(x1 + 0.01, (y0 + y1) / 2, z0 + 0.04, x1 + 0.01, (y0 + y1) / 2, z1 - 0.04, WHITE, 3, 120);
    L(x0 - 0.01, (y0 + y1) / 2, z0 + 0.04, x0 - 0.01, (y0 + y1) / 2, z1 - 0.04, WHITE, 3, 121);
    const E = [[x0, y0, z0, x1, y0, z0], [x0, y1, z0, x1, y1, z0], [x0, y0, z1, x1, y0, z1], [x0, y1, z1, x1, y1, z1], [x0, y0, z0, x0, y1, z0], [x1, y0, z0, x1, y1, z0], [x0, y0, z1, x0, y1, z1], [x1, y0, z1, x1, y1, z1], [x0, y0, z0, x0, y0, z1], [x1, y0, z0, x1, y0, z1], [x0, y1, z0, x0, y1, z1], [x1, y1, z0, x1, y1, z1]];
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      L(e[0], e[1], e[2], e[3], e[4], e[5], INK, 1.8, 180 + i);
    }
  }

  // the sweeper's wheeled bin: a green drum on two wheels with a handle
  drawBin(fr, w) {
    const c = w.c;
    const x = w.bin.x;
    const z = w.bin.z;
    const gy = groundHeight(x, z);
    const fx = c.fig.forward.x;
    const fz = c.fig.forward.z;
    const rx = c.fig.right.x;
    const rz = c.fig.right.z;
    const seed = c.fig.seed * 5;
    const r = 0.28;
    const h = 0.95;
    // the drum: upright strokes round the half of it facing you, close enough together to fill it
    const cam = this.game.camera.position;
    const vx = cam.x - x;
    const vz = cam.z - z;
    const cd = Math.hypot(vx, vz) || 1;
    const gap = Math.min(0.07, Math.max(0.014, cd * 0.0045));
    const n = Math.min(60, Math.ceil((Math.PI * r) / gap));
    const a0 = Math.atan2(vz, vx) - Math.PI / 2;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * Math.PI;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      fr.lineXYZ(px, gy + 0.18, pz, px, gy + h, pz, BIN, 7, seed + (i & 31), 1, 0.003, 0);
    }
    let qx = x + r;
    let qz = z;
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      fr.lineXYZ(qx, gy + h, qz, px, gy + h, pz, INK, 2, seed + 40 + i, 1, 0.003, 0);
      fr.lineXYZ(qx, gy + 0.18, qz, px, gy + 0.18, pz, INK, 1.6, seed + 60 + i, 1, 0.003, 0);
      qx = px;
      qz = pz;
    }
    // the lid: strokes across it
    const nl = Math.min(40, Math.ceil((2 * r) / gap));
    const lx = -vz / cd;
    const lz = vx / cd;
    for (let i = 0; i <= nl; i++) {
      const t = (i / nl) * 2 - 1;
      const half = Math.sqrt(Math.max(0, 1 - t * t)) * r;
      const px = x + (vx / cd) * t * r;
      const pz = z + (vz / cd) * t * r;
      fr.lineXYZ(px - lx * half, gy + h + 0.01, pz - lz * half, px + lx * half, gy + h + 0.01, pz + lz * half, [0.2, 0.36, 0.26], 6, seed + 120 + (i & 31), 1, 0.002, 0);
    }
    // the wheels, the handle towards the sweeper
    for (const s of [1, -1]) {
      const wx = x + rx * s * 0.3 - fx * 0.1;
      const wz = z + rz * s * 0.3 - fz * 0.1;
      let px = wx + fx * 0.14;
      let py = gy + 0.14;
      let pz = wz + fz * 0.14;
      for (let i = 1; i <= 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const nx = wx + fx * 0.14 * Math.cos(a);
        const ny = gy + 0.14 + 0.14 * Math.sin(a);
        const nz = wz + fz * 0.14 * Math.cos(a);
        fr.lineXYZ(px, py, pz, nx, ny, nz, INK, 2.6, seed + 80 + i + (s > 0 ? 0 : 10), 1, 0.003, 0);
        px = nx;
        py = ny;
        pz = nz;
      }
    }
    fr.lineXYZ(x + fx * r, gy + h - 0.1, z + fz * r, x + fx * (r + 0.35), gy + h + 0.12, z + fz * (r + 0.35), STEEL, 2.4, seed + 100, 1, 0.003, 0);
  }

  // the fence round the hole (red and white boards on legs), the hole, the heap of earth, a cone
  // at either end, the sign
  drawSite(fr, s) {
    const seed = s.x * 3.1 + s.z;
    const gy = groundHeight(s.x, s.z);
    const C = [[s.x0, s.z0], [s.x1, s.z0], [s.x1, s.z1], [s.x0, s.z1]];
    // (driven through: its pieces where they lie - ROADMAP 8.4)
    if (s.broken) this.drawBroken(fr, s, gy, seed);
    for (let i = 0; i < 4 && !s.broken; i++) {
      const [ax, az] = C[i];
      const [bx, bz] = C[(i + 1) % 4];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(2, Math.round(len / 0.45));
      for (const y of [0.55, 0.95]) {
        for (let k = 0; k < n; k++) {
          const t0 = k / n;
          const t1 = (k + 1) / n;
          fr.lineXYZ(ax + (bx - ax) * t0, gy + y, az + (bz - az) * t0, ax + (bx - ax) * t1, gy + y, az + (bz - az) * t1, k % 2 ? WHITE : RED, 7, seed + i * 40 + k + y * 10, 1, 0.002, 0);
        }
      }
      // the legs at the corners
      fr.lineXYZ(ax, gy, az, ax, gy + 1.02, az, STEEL, 2.6, seed + 200 + i, 1, 0.003, 0);
    }
    // the hole: dark, hatched across
    const hx = s.ux * 1.1;
    const hz = s.uz * 1.1;
    const ox = s.ox * 0.42;
    const oz = s.oz * 0.42;
    for (let k = 0; k <= 9; k++) {
      const t = k / 9 - 0.5;
      fr.lineXYZ(s.x + hx * t * 2 - ox, gy + 0.03, s.z + hz * t * 2 - oz, s.x + hx * t * 2 + ox, gy + 0.03, s.z + hz * t * 2 + oz, HOLE, 9, seed + 300 + k, 1, 0.004, 0);
    }
    // the heap of earth at the far end
    const ex = s.x - s.ux * 1.35 - s.ox * 0.2;
    const ez = s.z - s.uz * 1.35 - s.oz * 0.2;
    for (let k = 0; k < 5; k++) {
      const t = (k - 2) * 0.09;
      fr.lineXYZ(ex + s.ox * t - s.ux * 0.2, gy + 0.03, ez + s.oz * t - s.uz * 0.2, ex + s.ox * t * 0.5, gy + 0.32 - Math.abs(t), ez + s.oz * t * 0.5, DIRT, 8, seed + 320 + k, 1, 0.006, 0);
      fr.lineXYZ(ex + s.ox * t * 0.5, gy + 0.32 - Math.abs(t), ez + s.oz * t * 0.5, ex + s.ox * t + s.ux * 0.2, gy + 0.03, ez + s.oz * t + s.uz * 0.2, DIRT, 8, seed + 330 + k, 1, 0.006, 0);
    }
    // the cones, one past each end (on the sidewalk side): strokes from the tip down round the
    // side facing you, close enough together to fill it, a white band
    const cam = this.game.camera.position;
    for (const e of s.broken ? [] : [-1, 1]) {
      const cx = s.x + s.ux * e * 2.15 - s.ox * 0.3;
      const cz = s.z + s.uz * e * 2.15 - s.oz * 0.3;
      const vx = cam.x - cx;
      const vz = cam.z - cz;
      const gap = Math.min(0.06, Math.max(0.012, Math.hypot(vx, vz) * 0.0045));
      const n = Math.min(40, Math.ceil((Math.PI * 0.16) / gap));
      const a0 = Math.atan2(vz, vx) - Math.PI / 2;
      for (let k = 0; k <= n; k++) {
        const a = a0 + (k / n) * Math.PI;
        const c = Math.cos(a);
        const d = Math.sin(a);
        fr.lineXYZ(cx + c * 0.16, gy + 0.03, cz + d * 0.16, cx + c * 0.012, gy + 0.64, cz + d * 0.012, CONE, 6, seed + 400 + (k & 31) + e * 40, 1, 0.002, 0);
        if (k < n) {
          const a2 = a0 + ((k + 1) / n) * Math.PI;
          fr.lineXYZ(cx + c * 0.1, gy + 0.3, cz + d * 0.1, cx + Math.cos(a2) * 0.1, gy + 0.3, cz + Math.sin(a2) * 0.1, WHITE, 7, seed + 480 + (k & 31) + e * 40, 1, 0.002, 0);
        }
      }
    }
    // the sign: a red triangle on a post, a man digging drawn in it
    const px = s.x + s.ux * 1.75 - s.ox * 0.95;
    const pz = s.z + s.uz * 1.75 - s.oz * 0.95;
    fr.lineXYZ(px, gy, pz, px, gy + 1.15, pz, STEEL, 2.6, seed + 430, 1, 0.003, 0);
    const tri = [[-0.3, 1.15], [0.3, 1.15], [0, 1.65]];
    for (let k = 0; k < 3; k++) {
      const [u0, y0] = tri[k];
      const [u1, y1] = tri[(k + 1) % 3];
      fr.lineXYZ(px + s.ux * u0, gy + y0, pz + s.uz * u0, px + s.ux * u1, gy + y1, pz + s.uz * u1, RED, 5, seed + 440 + k, 1, 0.003, 0);
    }
    fr.lineXYZ(px - s.ux * 0.07, gy + 1.22, pz - s.uz * 0.07, px + s.ux * 0.05, gy + 1.38, pz + s.uz * 0.05, INK, 2.4, seed + 450, 1, 0.003, 0);
    fr.lineXYZ(px + s.ux * 0.05, gy + 1.38, pz + s.uz * 0.05, px + s.ux * 0.02, gy + 1.48, pz + s.uz * 0.02, INK, 2.4, seed + 451, 1, 0.003, 0);
  }

  // the fence driven through: the boards (red and white as they were) where they flew, the legs over
  drawBroken(fr, s, gy, seed) {
    for (const b of s.broken.boards) {
      const m = b.k1 - b.k0;
      for (let k = 0; k < m; k++) {
        const t0 = ((k / m) * 2 - 1) * b.hl;
        const t1 = (((k + 1) / m) * 2 - 1) * b.hl;
        fr.lineXYZ(b.x + b.d.x * t0, b.y + b.d.y * t0, b.z + b.d.z * t0, b.x + b.d.x * t1, b.y + b.d.y * t1, b.z + b.d.z * t1, (b.k0 + k) % 2 ? WHITE : RED, 7, seed + b.seed + k, 1, 0.002, 0);
      }
    }
    for (let i = 0; i < s.broken.legs.length; i++) {
      const L = s.broken.legs[i];
      const r = Math.sin(L.a) * 1.02;
      fr.lineXYZ(L.x, gy, L.z, L.x + Math.sin(L.yaw) * r, gy + Math.cos(L.a) * 1.02 + 0.03, L.z + Math.cos(L.yaw) * r, STEEL, 2.6, seed + 200 + i, 1, 0.003, 0);
    }
  }

  // the jackhammer and the shovel in the workers' hands
  drawTools(fr, s) {
    const [a, b] = s.men;
    const seed = s.x * 2.3 + s.z;
    if (a && a.c.owner === this) {
      const m = a;
      const fx = Math.sin(m.yaw);
      const fz = Math.cos(m.yaw);
      const gy = groundHeight(m.x, m.z);
      const jx = m.on ? (Math.random() - 0.5) * 0.02 : 0;
      const x = m.x + fx * 0.36;
      const z = m.z + fz * 0.36;
      // the T of the handles, the yellow body, the steel bit into the ground
      fr.lineXYZ(m.hR.x, m.hR.y, m.hR.z, m.hL.x, m.hL.y, m.hL.z, INK, 4, seed + 1, 1, 0.003, 0);
      fr.lineXYZ(x + jx, gy + 0.95, z, x, gy + 0.4, z, JACK, 16, seed + 2, 1, 0.003, 0);
      fr.lineXYZ(x + jx, gy + 0.62, z, x, gy + 0.56, z, INK, 17, seed + 4, 1, 0.003, 0);
      fr.lineXYZ(x, gy + 0.4, z, x + jx, gy + 0.02, z, STEEL, 4, seed + 3, 1, 0.003, 0);
    }
    if (b && b.c.owner === this && b.dig) {
      const m = b;
      // the shaft from the upper hand through the lower one, the blade at its end
      const dx = m.hR.x - m.hL.x;
      const dy = m.hR.y - m.hL.y;
      const dz = m.hR.z - m.hL.z;
      const l = Math.hypot(dx, dy, dz) || 1;
      const ex = m.hR.x + (dx / l) * 0.55;
      const ey = Math.max(groundHeight(m.x, m.z) + 0.05, m.hR.y + (dy / l) * 0.55);
      const ez = m.hR.z + (dz / l) * 0.55;
      fr.lineXYZ(m.hL.x - (dx / l) * 0.12, m.hL.y - (dy / l) * 0.12, m.hL.z - (dz / l) * 0.12, ex, ey, ez, [0.5, 0.34, 0.2], 3.4, seed + 10, 1, 0.003, 0);
      const fx = Math.sin(m.yaw);
      const fz = Math.cos(m.yaw);
      fr.lineXYZ(ex - fz * 0.11, ey, ez + fx * 0.11, ex + fz * 0.11, ey, ez - fx * 0.11, STEEL, 9, seed + 11, 1, 0.003, 0);
      if (m.dig.side > 0.2) fr.lineXYZ(ex - fz * 0.08, ey + 0.05, ez + fx * 0.08, ex + fz * 0.08, ey + 0.05, ez - fx * 0.08, DIRT, 7, seed + 12, 1, 0.004, 0);
    }
  }
}

// the point of a walk round a block nearest (x, z)
function closestOn(L, x, z) {
  let best = null;
  let bd = Infinity;
  for (let i = 0; i < L.length; i++) {
    const a = L[i];
    const b = L[(i + 1) % L.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    const px = a[0] + dx * t;
    const pz = a[1] + dz * t;
    const d = Math.hypot(px - x, pz - z);
    if (d < bd) {
      bd = d;
      best = { x: px, z: pz };
    }
  }
  return best;
}
