import * as THREE from 'three';
import { Scene } from './vignettes.js';
import { civilianLook, copLook, elderLook, modest } from './looks.js';
import { sidewalkLoop } from './civilians.js';
import { groundHeight, BLOCK_TYPES } from '../world/layout.js';
import { randomCarSpec } from '../render/cars.js';

// Things that happen in the city now and then, not on any map (ROADMAP 3.4). Every 20-45 s the
// city may start one near you, picked by where you are, the hour and how busy it is:
//   a hold-up      somebody in a hood goes into a shop, holds the keeper up with a pen and runs
//                  out with the till; catch up with him (or hit him) and he gives it back
//   a bump         a driver looking elsewhere runs into the car in front; both get out and argue
//                  in the road, then drive on
//   a chase        a car racing through the red lights with a police car on its tail and its
//                  siren on (nothing to do with you)
//   help           somebody has fallen on the sidewalk and asks you to help them up (E)
//   a street show  a juggler, and the people passing stop round them, clap and cheer
//   a protest      a march along the sidewalk with placards, chanting, a policeman alongside
//   a wedding      in the park: an arch of flowers, the couple, the guests, and confetti
// (?classic: none of it)

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;
const _fwd = new THREE.Vector3();
const _v = new THREE.Vector3();
const INK = [0.12, 0.11, 0.14];
const WOOD = [0.5, 0.36, 0.22];
const WHITE = [0.97, 0.96, 0.93];
const BALLS = [[0.95, 0.3, 0.3], [0.98, 0.8, 0.2], [0.3, 0.6, 0.95]];
const SIGNS = [[0.98, 0.9, 0.35], [0.55, 0.85, 0.55], [0.98, 0.6, 0.7], [0.6, 0.8, 0.98], [0.98, 0.98, 0.95]];
const FLOWERS = [[0.95, 0.4, 0.55], [0.98, 0.85, 0.35], [0.98, 0.98, 0.95], [0.7, 0.45, 0.9]];
const SLOGANS = [['What do we want?', 'Green parks!', 'When do we want it?', 'Now!'], ['Save our pier!', 'Save our pier!'], ['More trees!', 'Less noise!'], ['Bike lanes now!', 'Bike lanes now!']];

// what may happen, when, how often (s between two of a kind) and how likely
const KINDS = {
  robbery: { hours: [9, 23], cool: 240, w: 2 },
  bump: { hours: [6, 24], cool: 150, w: 2 },
  chase: { hours: [0, 24], cool: 300, w: 1 },
  help: { hours: [7, 21], cool: 200, w: 2 },
  show: { hours: [10, 21], cool: 240, w: 2 },
  protest: { hours: [10, 18], cool: 480, w: 1 },
  wedding: { hours: [11, 18], cool: 900, w: 1 },
};

// a scene of the city's: the people it borrowed from the street go back to it, the ones it brought
// walk off and are counted with the street's own
class Happening extends Scene {
  letGo() {
    const civs = this.game.civilians;
    for (const a of this.actors) {
      if (a.owner !== this) continue;
      a.fig.hunch = 0;
      a.fig.stagger = 0;
      a.fig.armsUp = 0;
      a.fig.dance = 0;
      a.fig.dead = 0;
      a.fig.reachR = null;
      a.fig.reachL = null;
      a.brave = false;
      civs.release(a);
      a.scripted = false;
      civs.rejoin(a);
    }
  }

  // somebody from the street joins the scene
  borrow(c) {
    c.scripted = true;
    c.owner = this;
    c.goal = null;
    c.ctrl = (civ) => civ.goal;
    this.actors.push(c);
    return c;
  }

  // walk a list of points
  *walkPath(a, pts, speed = 1.3) {
    for (const p of pts) yield* this.walk(a, p.x, p.z, speed, 0.4);
  }

  // gone from sight: then gone
  *vanish(a, maxT = 60) {
    let t = 0;
    while (t < maxT && !this.dir.unseen(a.pos.x, a.pos.z, 35)) {
      t += 0.5;
      yield 0.5;
    }
    if (a.owner === this) {
      this.game.civilians.remove(a);
      this.actors = this.actors.filter((o) => o !== a);
    }
  }
}

export class Events {
  constructor(game) {
    this.game = game;
    this.active = [];
    // (the first one a while after you start)
    this.t = 30;
    this.cool = {};
    this.helpMe = null;
    // (counted for the tests)
    this.stats = { started: {}, caught: 0, escaped: 0, helped: 0, bumps: 0 };
  }

  get hour() {
    const d = this.game.daynight;
    return d ? d.hour : 12;
  }

  unseen(x, z, far = 45) {
    const cam = this.game.camera;
    const fwd = cam.getWorldDirection(_fwd);
    const dx = x - cam.position.x;
    const dz = z - cam.position.z;
    const d = Math.hypot(dx, dz) || 1;
    return d > far || (dx * fwd.x + dz * fwd.z) / d < 0.1;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    if (game.classic || game.inBar) return;
    const p = game.anchorPos();
    for (const e of this.active) {
      e.update(dt);
      const d = Math.hypot(e.def.x - p.x, e.def.z - p.z);
      if (e.finished || d > (e.def.far || 110)) {
        if (e.onDone) e.onDone();
        e.dispose();
        e.gone = true;
      }
    }
    if (this.active.some((e) => e.gone)) this.active = this.active.filter((e) => !e.gone);
    if (this.helpMe && this.helpMe.gone) this.helpMe = null;
    this.siren(p);
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 20 + Math.random() * 25;
    if (this.active.length >= (game.touch ? 1 : 2) || (game.police && game.police.level > 0)) return;
    this.start();
  }

  // pick one of what may happen here and now, and set it going
  start(only = null) {
    const game = this.game;
    const h = this.hour;
    const rain = game.weather ? game.weather.cur.rain : 0;
    const now = game.time;
    const opts = [];
    for (const [k, o] of Object.entries(KINDS)) {
      if (only && k !== only) continue;
      if (!only && (h < o.hours[0] || h >= o.hours[1] || (this.cool[k] || 0) > now)) continue;
      if (!only && rain > 0.3 && k !== 'chase' && k !== 'bump' && k !== 'robbery') continue;
      if (this.active.some((e) => e.kind === k)) continue;
      opts.push([k, o.w]);
    }
    // a few tries: the first pick may have nowhere to happen here
    for (let tries = 0; tries < 4 && opts.length; tries++) {
      let r = Math.random() * opts.reduce((a, b) => a + b[1], 0);
      let i = 0;
      for (; i < opts.length - 1; i++) {
        r -= opts[i][1];
        if (r <= 0) break;
      }
      const [k] = opts[i];
      const e = this['make_' + k]();
      if (e) {
        e.kind = k;
        this.active.push(e);
        this.cool[k] = now + KINDS[k].cool;
        this.stats.started[k] = (this.stats.started[k] || 0) + 1;
        return e;
      }
      opts.splice(i, 1);
    }
    return null;
  }

  scene(def, script) {
    return new Happening(this, { ...def, script });
  }

  draw(fr) {
    if (this.game.classic) return;
    for (const e of this.active) e.draw(fr);
  }

  // a siren for the chase (the police's own siren has nothing to say when nobody is after you)
  siren(p) {
    let near = Infinity;
    for (const e of this.active) {
      const c = e.cop;
      if (c && c.siren && !c.gone) near = Math.min(near, Math.hypot(c.pos.x - p.x, c.pos.z - p.z));
    }
    if (near < Infinity || this.sirenOn) {
      this.sirenOn = near < 120;
      if (!(this.game.police && this.game.police.level > 0)) this.game.audio.siren(near < 120 ? 1 - near / 120 : 0);
    }
  }

  // ------------------------------------------------------------------ you and the scene
  // the prompt when somebody near you needs a hand
  prompt() {
    const h = this.helpMe;
    if (!h || h.gone || h.helped || !h.who) return null;
    const p = this.game.player;
    if (p.mode !== 'foot' || Math.hypot(h.who.pos.x - p.pos.x, h.who.pos.z - p.pos.z) > 2.4) return null;
    return 'לעזור לקום';
  }

  interact() {
    if (!this.prompt()) return false;
    this.helpMe.helped = true;
    return true;
  }

  // somebody the eraser hit who was up to no good (no crime to hit him)
  hurt(c) {
    for (const e of this.active) if (e.robber === c) e.caught = true;
  }

  // ------------------------------------------------------------------ a hold-up
  make_robbery() {
    const game = this.game;
    const p = game.player.pos;
    let best = null;
    let bd = 60;
    for (const a of game.streetlife.active.values()) {
      const s = a.shop;
      if (!a.room || !a.paySpot || !a.open || s.kind === 'lobby' || s.kind === 'bar') continue;
      const d = Math.hypot(s.door[0] - p.x, s.door[2] - p.z);
      if (d < bd && d > 12) {
        bd = d;
        best = a;
      }
    }
    if (!best) return null;
    const s = best.shop;
    // he comes along the sidewalk from the side you are not on
    const side = (p.x - s.door[0]) * s.rx + (p.z - s.door[2]) * s.rz > 0 ? -1 : 1;
    const x = s.door[0] + s.rx * side * 14 + s.nx * 0.8;
    const z = s.door[2] + s.rz * side * 14 + s.nz * 0.8;
    const e = this.scene({ x: s.door[0], z: s.door[2], open: best, side, sx: x, sz: z }, robberyScene);
    return e;
  }

  // ------------------------------------------------------------------ a bump in the traffic
  make_bump() {
    const game = this.game;
    const T = game.traffic;
    const p = game.anchorPos();
    for (const A of T.list) {
      if (A.police || A.bus || !A.path || A.stopped || A.wrecked || A.speed < 4 || !A.driver) continue;
      const d = Math.hypot(A.pos.x - p.x, A.pos.z - p.z);
      if (d < 22 || d > 75) continue;
      const fx = Math.sin(A.yaw);
      const fz = Math.cos(A.yaw);
      for (const B of T.list) {
        if (B === A || B.police || B.bus || !B.path || B.stopped || B.wrecked || !B.driver) continue;
        const dx = A.pos.x - B.pos.x;
        const dz = A.pos.z - B.pos.z;
        const along = dx * fx + dz * fz;
        const side = Math.abs(dx * fz - dz * fx);
        if (along < 6 || along > 22 || side > 0.8 || Math.abs(Math.sin(A.yaw - B.yaw)) > 0.15) continue;
        return this.scene({ x: A.pos.x, z: A.pos.z, A, B, far: 140 }, bumpScene);
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ a chase
  make_chase() {
    const game = this.game;
    const T = game.traffic;
    const p = game.anchorPos();
    const spec = randomCarSpec();
    if (spec.kind === 'bus' || spec.police) return null;
    const car = T.spawnCar(p, 70, 140, spec, { maxSpeed: 16, speed: 12 });
    if (!car) return null;
    car.reckless = true;
    car.maxSpeed = 16;
    // the police right behind it, its siren on
    const bx = car.pos.x - Math.sin(car.yaw) * 11;
    const bz = car.pos.z - Math.cos(car.yaw) * 11;
    const cop = T.policeCar(bx, bz, car.yaw, ['cop', 'cop'], 'tail');
    cop.tail = car;
    cop.siren = true;
    cop.speed = 12;
    const e = this.scene({ x: car.pos.x, z: car.pos.z, car, far: 230 }, chaseScene);
    e.cop = cop;
    return e;
  }

  // ------------------------------------------------------------------ somebody fell
  make_help() {
    const game = this.game;
    const p = game.player.pos;
    // a sidewalk in front of you, 9-25 m off
    const fwd = game.camera.getWorldDirection(_fwd);
    const near = [];
    for (let col = -1; col < 3; col++) {
      for (let row = 0; row < 5; row++) {
        const L = sidewalkLoop(col, row);
        for (let i = 0; i < L.length; i++) {
          const a = L[i];
          const b = L[(i + 1) % L.length];
          for (let t = 0.1; t < 1; t += 0.1) {
            const x = a[0] + (b[0] - a[0]) * t;
            const z = a[1] + (b[1] - a[1]) * t;
            const dx = x - p.x;
            const dz = z - p.z;
            const d = Math.hypot(dx, dz);
            if (d > 9 && d < 25 && (dx * fwd.x + dz * fwd.z) / d > 0.5) near.push({ x, z, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) });
          }
        }
      }
    }
    if (!near.length) return null;
    const at = pick(near);
    const e = this.scene({ x: at.x, z: at.z, yaw: at.yaw }, helpScene);
    this.helpMe = e;
    return e;
  }

  // ------------------------------------------------------------------ a street show
  make_show() {
    const game = this.game;
    const p = game.player.pos;
    const w = game.world;
    const spots = [];
    for (const f of w.fountains || []) spots.push({ x: f.x + 9, z: f.z, yaw: -Math.PI / 2 });
    for (const pk of w.parks || []) spots.push({ x: pk.cx, z: pk.cz + 3, yaw: Math.PI });
    for (let z = -360; z < 230; z += 45) spots.push({ x: 17.5, z, yaw: -Math.PI / 2 });
    let best = null;
    let bd = 55;
    for (const s of spots) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d < bd && d > 10 && this.clear(s.x, s.z, 2.2)) {
        bd = d;
        best = s;
      }
    }
    if (!best || !this.unseen(best.x, best.z, 30)) return null;
    return this.scene({ x: best.x, z: best.z, yaw: best.yaw }, showScene);
  }

  // nothing standing within r of (x, z)
  clear(x, z, r) {
    let ok = true;
    this.game.world.collision.forEachIn(x - r, z - r, x + r, z + r, (b) => {
      if (b.y1 > 0.3) {
        ok = false;
        return true;
      }
      return false;
    });
    return ok;
  }

  // ------------------------------------------------------------------ a protest march
  make_protest() {
    const game = this.game;
    const p = game.player.pos;
    const ok = new Set(['towers', 'plaza', 'shops', 'first', 'hotels']);
    // a side of a block near you, walked from one end to the other
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 5; row++) {
        if (!ok.has(BLOCK_TYPES[row][col])) continue;
        const L = sidewalkLoop(col, row);
        for (let i = 0; i < L.length; i++) {
          const a = L[i];
          const b = L[(i + 1) % L.length];
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (len < 60) continue;
          const mx = (a[0] + b[0]) / 2;
          const mz = (a[1] + b[1]) / 2;
          const d = Math.hypot(mx - p.x, mz - p.z);
          if (d > 45) continue;
          // start at the end you are not looking at
          const [s, t] = this.unseen(a[0], a[1], 40) ? [a, b] : this.unseen(b[0], b[1], 40) ? [b, a] : [null, null];
          if (!s) continue;
          return this.scene({ x: mx, z: mz, from: { x: s[0], z: s[1] }, to: { x: t[0], z: t[1] }, far: 150 }, protestScene);
        }
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ a wedding in the park
  make_wedding() {
    const game = this.game;
    const p = game.player.pos;
    for (const pk of game.world.parks || []) {
      // the lawn in the park's south-west quarter
      const x = (pk.x0 + pk.cx) / 2 - 1;
      const z = (pk.cz + pk.z1) / 2 + 2;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d > 75 || d < 12 || !this.unseen(x, z, 35) || !this.clear(x, z, 3)) continue;
      return this.scene({ x, z, far: 120 }, weddingScene);
    }
    return null;
  }
}

// ======================================================================== the scripts

// ------------------------------------------------------------------ the hold-up
function robberLook() {
  const L = civilianLook({ kind: 'street', fem: false });
  L.top = { kind: 'hoodie', color: pick([[0.14, 0.14, 0.16], [0.25, 0.27, 0.3], [0.3, 0.2, 0.18]]), sleeves: 'long' };
  L.bottom = { kind: 'pants', color: [0.12, 0.12, 0.14] };
  L.hat = { kind: 'beanie', color: [0.1, 0.1, 0.12] };
  L.face.glasses = 'shades';
  return L;
}

function* robberyScene(sc, def) {
  const game = sc.game;
  const a = def.open;
  const s = a.shop;
  const R = a.room;
  const r = sc.spawn(robberLook(), def.sx, def.sz, Math.atan2(-s.rx * def.side, -s.rz * def.side));
  // (he doesn't run when the shooting starts, and hitting him is no crime)
  r.brave = true;
  r.criminal = true;
  r.speed = 1.4;
  sc.robber = r;
  // (rubbed out on the run: the till is back all the same)
  sc.onBreak = () => {
    if (sc.robbed && !r.alive && !sc.caught) {
      sc.caught = true;
      sc.dir.stats.caught++;
      game.hud.toast('השודד נעצר. הכסף חוזר לחנות', 'good', 3);
    }
  };
  yield* sc.walk(r, s.door[0], s.door[2], 1.5, 0.45);
  if (!a.open) return;
  r.noCollide = true;
  r.fig.carry = 'pencil';
  yield* sc.walkPath(r, [R.door, ...R.path(R.door.x, R.door.z, a.paySpot.x, a.paySpot.z)], 1.5);
  const k = a.keeper;
  if (!a.open || !k || !k.alive) return;
  // hands up
  sc.face(r, k);
  r.fig.reachR = k.fig.j.headC;
  k.fig.armsUp = 1;
  sc.say(r, pick(['Hands up! The till, now!', 'Nobody move! Cash, now!', 'Easy... Just the money!']), 'alarm');
  game.audio.play('alarm', 0.3);
  yield 1.4;
  if (k.alive) sc.say(k, pick(['Okay, okay! Take it!', "Please, don't hurt me!", 'Take it and go!']), 'alarm');
  yield 2.6;
  // the till into the bag, and out
  r.fig.reachR = null;
  r.fig.carryL = 'bag';
  if (k.alive) k.fig.armsUp = 0;
  sc.robbed = true;
  r.speed = 4.4;
  yield* sc.walkPath(r, [...R.path(r.pos.x, r.pos.z, R.door.x, R.door.z), { x: s.door[0], z: s.door[2] }], 3.6);
  r.noCollide = false;
  if (k.alive && k.owner === a) sc.say(k, pick(['Stop! Thief!', 'Somebody stop him!', 'Help! Police!']), 'alarm');
  game.civilians.panic(new THREE.Vector3(s.door[0], 0, s.door[2]), 12);
  // away along the sidewalk, away from you
  const p = game.player.pos;
  const away = (p.x - s.door[0]) * s.rx + (p.z - s.door[2]) * s.rz > 0 ? -1 : 1;
  const fx = s.door[0] + s.rx * away * 70 + s.nx * 1.2;
  const fz = s.door[2] + s.rz * away * 70 + s.nz * 1.2;
  r.goal = { x: fx, z: fz, speed: 4.6 };
  let t = 0;
  while (t < 22 && !sc.caught) {
    const pl = game.player;
    if (!pl.inVehicle && Math.hypot(pl.pos.x - r.pos.x, pl.pos.z - r.pos.z) < 1.9) sc.caught = true;
    if (Math.hypot(r.pos.x - fx, r.pos.z - fz) < 2) break;
    t += 0.1;
    yield 0.1;
  }
  r.goal = null;
  if (sc.caught && r.alive) {
    // caught: the bag back, hands up
    sc.dir.stats.caught++;
    r.fig.carry = null;
    r.fig.carryL = null;
    r.fig.armsUp = 1;
    sc.props.bag = { x: r.pos.x + 0.5, z: r.pos.z, draw: drawDroppedBag };
    sc.say(r, pick(['Okay! Okay! Take it!', "Don't hurt me! Here!", 'Fine, fine, I give up!']), 'alarm');
    game.hud.toast('עצרתם את השודד! הכסף חוזר לחנות', 'good', 3);
    yield 2.5;
    if (k && k.alive && k.owner === a) sc.say(k, pick(['Thank you, hero!', 'You got him! Thank you!']));
    // he sits down on the curb to wait for the police
    r.fig.armsUp = 0;
    r.fig.sit = 1;
    r.baseY = -0.42;
    yield 8;
    r.baseY = 0;
    r.fig.sit = 0;
    yield* sc.vanish(r, 40);
  } else {
    sc.dir.stats.escaped++;
    if (r.alive) yield* sc.vanish(r, 30);
  }
}

// the bag he dropped, on the ground
function drawDroppedBag(fr, sc) {
  const b = sc.props.bag;
  const gy = groundHeight(b.x, b.z) + 0.02;
  for (let i = 0; i < 6; i++) {
    const u = (i / 5 - 0.5) * 0.3;
    fr.lineXYZ(b.x + u, gy, b.z - 0.12, b.x + u * 0.8, gy + 0.22, b.z, [0.78, 0.62, 0.42], 7, 900 + i, 1, 0.004, 0);
  }
  fr.lineXYZ(b.x - 0.12, gy + 0.22, b.z, b.x + 0.12, gy + 0.22, b.z, INK, 2, 910, 1, 0.004, 0);
}

// ------------------------------------------------------------------ the bump
function* bumpScene(sc, def) {
  const game = sc.game;
  const T = game.traffic;
  const { A, B } = def;
  const alive = (c) => !c.gone && !c.wrecked && c.poofT === undefined && T.list.indexOf(c) >= 0;
  const restore = () => {
    for (const c of [A, B]) {
      c.distracted = false;
      c.stopped = false;
      c.brakeT = 0;
    }
  };
  sc.onDispose = restore;
  // the one in front brakes hard; the one behind is looking at its phone
  A.brakeT = 2.2;
  B.distracted = true;
  let t = 0;
  let hit = false;
  while (t < 6) {
    if (!alive(A) || !alive(B)) {
      restore();
      return;
    }
    const fx = Math.sin(A.yaw);
    const fz = Math.cos(A.yaw);
    const gap = (A.pos.x - B.pos.x) * fx + (A.pos.z - B.pos.z) * fz - A.halfLen - B.halfLen;
    if (gap < 0.25) {
      hit = true;
      break;
    }
    t += 0.05;
    yield 0.05;
  }
  B.distracted = false;
  if (!hit) {
    restore();
    return;
  }
  // crunch
  sc.dir.stats.bumps++;
  A.stopped = true;
  B.stopped = true;
  A.speed *= 0.3;
  B.speed = 0;
  const fx = Math.sin(A.yaw);
  const fz = Math.cos(A.yaw);
  const cx = A.pos.x - fx * A.halfLen;
  const cz = A.pos.z - fz * A.halfLen;
  const pl = game.player.pos;
  const d = Math.hypot(cx - pl.x, cz - pl.z);
  if (d < 60) game.audio.play('crash', Math.max(0.2, 1 - d / 60));
  game.fx.sparks(cx, 0.6, cz, 8, [0.9, 0.9, 0.95]);
  game.fx.crumbs(cx, 0.5, cz, 10, 2);
  if (game.reactions) game.reactions.note('crash', cx, cz);
  // (the back of the one, the front of the other, dented: game/damage.js)
  if (game.damage) {
    game.damage.hit(A, cx, 0.6, cz, 9);
    game.damage.hit(B, cx, 0.6, cz, 8);
  }
  sc.props.hazard = { draw: (fr) => drawHazards(fr, sc, [A, B]) };
  yield 1.6;
  if (!alive(A) || !alive(B) || !A.driver || !B.driver) {
    restore();
    return;
  }
  // out of the cars, to the side of the road between them
  const rx = -fz;
  const rz = fx;
  const door = (c) => ({ x: c.pos.x + Math.sin(c.yaw) * -0.2 - Math.cos(c.yaw) * -1.3, z: c.pos.z + Math.cos(c.yaw) * -0.2 + Math.sin(c.yaw) * -1.3 });
  const da = door(A);
  const db = door(B);
  const keepA = A.driver;
  const keepB = B.driver;
  const ma = sc.spawn(keepA.look, da.x, da.z, A.yaw);
  const mb = sc.spawn(keepB.look, db.x, db.z, B.yaw);
  ma.brave = true;
  mb.brave = true;
  A.driver = null;
  B.driver = null;
  // (back into the cars at the end, whatever happens to the scene)
  sc.onDispose = () => {
    if (alive(A) && !A.driver) A.driver = keepA;
    if (alive(B) && !B.driver) B.driver = keepB;
    restore();
  };
  // (in the road beside the cars, on the drivers' side)
  const mx = cx - rx * 1.4;
  const mz = cz - rz * 1.4;
  game.audio.play('click', 0.3);
  ma.goal = { x: mx + fx * 0.55, z: mz + fz * 0.55, speed: 1.6 };
  mb.goal = { x: mx - fx * 0.55, z: mz - fz * 0.55, speed: 1.6 };
  yield 2.2;
  ma.goal = null;
  mb.goal = null;
  // the argument
  const linesA = ["Didn't you see me stop?!", 'Look at my bumper!', 'Were you on your phone?', 'Unbelievable!', "You're paying for this!"];
  const linesB = ['You stopped dead!', "It's just a scratch!", 'Who brakes like that?!', 'Calm down!', 'My insurance will call yours.'];
  for (let i = 0; i < 8; i++) {
    const who = i % 2 ? mb : ma;
    const other = i % 2 ? ma : mb;
    sc.face(ma, mb);
    sc.face(mb, ma);
    // a hand thrown up at the other
    who.fig.reachR = _gesture(who, other);
    sc.say(who, pick(i % 2 ? linesB : linesA), 'alarm');
    yield 1.4 + Math.random() * 0.8;
    who.fig.reachR = null;
    yield 0.3;
  }
  sc.say(ma, pick(['Forget it.', 'Whatever. Just drive.']));
  yield 1.5;
  // back in, and off
  ma.goal = { x: da.x, z: da.z, speed: 1.6 };
  mb.goal = { x: db.x, z: db.z, speed: 1.6 };
  yield 2.5;
  for (const m of [ma, mb]) game.civilians.remove(m);
  sc.actors = [];
  if (alive(A)) A.driver = keepA;
  if (alive(B)) B.driver = keepB;
  game.audio.play('click', 0.3);
  delete sc.props.hazard;
  A.stopped = false;
  yield 1.5;
  B.stopped = false;
  sc.onDispose = null;
}

// a hand towards the other's face, a little above it
function _gesture(who, other) {
  const v = who._gv || (who._gv = new THREE.Vector3());
  return v.copy(other.fig.j.headC).sub(who.fig.j.shoulderR).multiplyScalar(0.5).add(who.fig.j.shoulderR).add(_v.set(0, 0.25, 0));
}

// the hazard lights, blinking
function drawHazards(fr, sc, cars) {
  if (Math.floor(sc.game.time * 2.5) % 2) return;
  for (const c of cars) {
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    for (const u of [-1, 1]) {
      for (const s of [-1, 1]) {
        const x = c.pos.x + fx * u * (c.halfLen - 0.1) - fz * s * 0.75;
        const z = c.pos.z + fz * u * (c.halfLen - 0.1) + fx * s * 0.75;
        fr.lineXYZ(x - 0.06, 0.78, z, x + 0.06, 0.78, z, [1, 0.62, 0.15], 10, 920 + u + s * 3, 1, 0.002, 0);
      }
    }
  }
}

// ------------------------------------------------------------------ the chase
function* chaseScene(sc, def) {
  const T = sc.game.traffic;
  const car = def.car;
  const cop = sc.cop;
  let t = 0;
  while (t < 120) {
    // where it is now (the manager forgets it once it is far)
    sc.def.x = car.pos.x;
    sc.def.z = car.pos.z;
    if (car.gone || T.list.indexOf(car) < 0 || cop.gone || T.list.indexOf(cop) < 0) break;
    t += 0.25;
    yield 0.25;
  }
  cop.siren = false;
}

// ------------------------------------------------------------------ somebody fell
function* helpScene(sc, def) {
  const game = sc.game;
  const look = chance(0.4) ? elderLook(chance(0.5)) : civilianLook();
  const v = sc.spawn(look, def.x, def.z, def.yaw);
  v.noCollide = true;
  v.fig.dead = 0.92;
  sc.who = v;
  sc.say(v, pick(['Ow! My ankle!', 'Ouch... I slipped.', 'Oh no, my knee!']), 'alarm');
  game.audio.play('hurt', 0.25);
  let t = 0;
  let askT = 3;
  while (t < 70 && !sc.helped) {
    askT -= 0.25;
    if (askT <= 0) {
      askT = 6 + Math.random() * 3;
      const p = game.player.pos;
      if (Math.hypot(p.x - v.pos.x, p.z - v.pos.z) < 18) sc.say(v, pick(['Could you help me up?', 'Excuse me... a hand, please?', 'Anyone? Please?']));
    }
    t += 0.25;
    yield 0.25;
  }
  // up again (with your hand, or slowly on their own)
  const helped = sc.helped;
  if (helped) {
    const pl = game.player;
    pl.fig.reachR = v.fig.j.handR;
    sc.face(v, pl);
  }
  for (let k = 0; k < 15; k++) {
    v.fig.dead = Math.max(0, 0.92 * (1 - (k + 1) / 15));
    yield 0.1;
  }
  v.fig.dead = 0;
  if (helped) {
    game.player.fig.reachR = null;
    sc.dir.stats.helped++;
    sc.say(v, pick(['Thank you so much!', "You're very kind!", 'Bless you, dear.']));
    const pl = game.player;
    pl.hp = Math.min(pl.maxHp, pl.hp + 15);
    game.hud.toast('עזרתם למישהו לקום. +15 חיים, ממצב הרוח הטוב', 'good', 3);
    yield 2.5;
  } else {
    sc.say(v, "I'm fine, I'm fine...");
    yield 1.5;
  }
  v.fig.stagger = 0.6;
}

// ------------------------------------------------------------------ the street show
function jugglerLook() {
  const L = civilianLook({ kind: 'street' });
  L.top = { kind: 'tee', color: pick([[0.95, 0.35, 0.35], [0.35, 0.6, 0.95], [0.98, 0.78, 0.2]]), sleeves: 'long' };
  L.bottom = { kind: 'pants', color: [0.18, 0.18, 0.22] };
  L.hat = { kind: 'beret', color: [0.75, 0.18, 0.2] };
  L.face.mouth = 'smile';
  return modest(L);
}

function* showScene(sc, def) {
  const game = sc.game;
  const civs = game.civilians;
  const j = sc.spawn(jugglerLook(), def.x, def.z, def.yaw);
  j.noCollide = true;
  sc.juggler = j;
  sc.hat = { x: def.x + Math.sin(def.yaw) * 0.9 + Math.cos(def.yaw) * 0.5, z: def.z + Math.cos(def.yaw) * 0.9 - Math.sin(def.yaw) * 0.5 };
  sc.props.juggle = { draw: drawJuggling };
  sc.juggling = true;
  sc.hR = new THREE.Vector3();
  sc.hL = new THREE.Vector3();
  sc.onTick = () => {
    if (!sc.juggling || !j.alive || j.owner !== sc) {
      j.fig.reachR = null;
      j.fig.reachL = null;
      return;
    }
    // the hands going up and down in turn, the balls between them
    const k = sc.t * 2.6;
    j.fig.toWorld(0.22, 1.08 + Math.max(0, Math.sin(k)) * 0.16, 0.3, sc.hR);
    j.fig.toWorld(-0.22, 1.08 + Math.max(0, -Math.sin(k)) * 0.16, 0.3, sc.hL);
    j.fig.reachR = sc.hR;
    j.fig.reachL = sc.hL;
  };
  sc.say(j, pick(['Ladies and gentlemen!', 'Gather round, gather round!', 'Watch this!']));
  // the people passing stop to watch, in a ring in front
  const ring = [];
  for (let i = 0; i < 7; i++) {
    const a = def.yaw + ((i - 3) / 3) * 1.1;
    ring.push({ x: def.x + Math.sin(a) * 3.4, z: def.z + Math.cos(a) * 3.4, who: null });
  }
  const crowd = [];
  for (let t = 0; t < 40; t += 2) {
    const free = ring.find((s) => !s.who);
    if (free && crowd.length < (game.touch ? 4 : 7)) {
      let best = null;
      let bd = 24;
      for (const c of civs.list) {
        if (c.scripted || c.ctrl || !c.alive || c.panicT > 0 || c.headless || c.dog || c.buddy || c.buddyOf || c.jog || c.inside || c.photo) continue;
        const d = Math.hypot(c.pos.x - def.x, c.pos.z - def.z);
        if (d < bd && d > 3) {
          bd = d;
          best = c;
        }
      }
      if (best) {
        sc.borrow(best);
        free.who = best;
        best.goal = { x: free.x, z: free.z, speed: best.speed };
        best.spot = free;
        crowd.push(best);
      }
    }
    for (const c of crowd) {
      if (c.goal && Math.hypot(c.pos.x - c.goal.x, c.pos.z - c.goal.z) < 0.5) c.goal = null;
      if (!c.goal) sc.face(c, j);
    }
    if (t === 12) sc.say(j, pick(['Three balls... easy!', 'And now, behind the back!', 'Hup!']));
    if (t === 24 && crowd.length) sc.say(pick(crowd), pick(['Wow!', 'How does he do that?', 'Amazing!']));
    // claps now and then
    if (t % 6 === 4) for (const c of crowd) if (!c.goal) clap(sc, c);
    yield 2;
  }
  // the end: a bow, applause, a coin or two in the hat
  sc.juggling = false;
  sc.say(j, pick(['Ta-da!', 'Thank you, thank you!']));
  j.fig.hunch = 0.8;
  for (const c of crowd) if (!c.goal) clap(sc, c);
  const pl = game.player.pos;
  const d = Math.hypot(def.x - pl.x, def.z - pl.z);
  if (d < 35) game.audio.play('cheer', 0.6 * (1 - d / 35));
  if (crowd.length) sc.say(pick(crowd), pick(['Bravo!', 'More!', 'Encore!']));
  sc.coins = Math.min(5, crowd.length);
  yield 1.2;
  j.fig.hunch = 0;
  yield 2.5;
  // off they go
  for (const c of crowd) {
    if (c.owner !== sc) continue;
    c.fig.reachR = null;
    c.fig.reachL = null;
    civs.release(c);
    c.scripted = false;
    civs.rejoin(c);
  }
  yield 2;
  sc.props = {};
  yield* sc.vanish(j, 40);
}

// both hands together in front of the chest a few times
function clap(sc, c) {
  const v = c._clap || (c._clap = new THREE.Vector3());
  let n = 0;
  const prev = sc.onTick;
  const t0 = sc.t;
  sc.onTick = (dt) => {
    if (prev) prev(dt);
    if (n < 0) return;
    const k = sc.t - t0;
    if (k > 1.6 || c.owner !== sc) {
      c.fig.reachR = null;
      c.fig.reachL = null;
      n = -1;
      return;
    }
    c.fig.toWorld(0, 1.25, 0.32 + Math.abs(Math.sin(k * 12)) * 0.06, v);
    c.fig.reachR = v;
    c.fig.reachL = v;
  };
}

// three balls going round between the juggler's hands; the hat on the ground with its coins
function drawJuggling(fr, sc) {
  const j = sc.juggler;
  const h = sc.hat;
  if (h) {
    const gy = groundHeight(h.x, h.z);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const b = ((i + 1) / 8) * Math.PI * 2;
      fr.lineXYZ(h.x + Math.cos(a) * 0.17, gy + 0.03, h.z + Math.sin(a) * 0.17, h.x + Math.cos(b) * 0.17, gy + 0.03, h.z + Math.sin(b) * 0.17, INK, 4, 940 + i, 1, 0.003, 0);
      fr.lineXYZ(h.x + Math.cos(a) * 0.1, gy + 0.03, h.z + Math.sin(a) * 0.1, h.x + Math.cos(a) * 0.1, gy + 0.11, h.z + Math.sin(a) * 0.1, [0.2, 0.2, 0.24], 5, 950 + i, 1, 0.003, 0);
    }
    for (let i = 0; i < (sc.coins || 0); i++) {
      const a = i * 2.1;
      fr.lineXYZ(h.x + Math.cos(a) * 0.05 - 0.02, gy + 0.12, h.z + Math.sin(a) * 0.05, h.x + Math.cos(a) * 0.05 + 0.02, gy + 0.12, h.z + Math.sin(a) * 0.05, [0.98, 0.82, 0.25], 6, 960 + i, 1, 0.002, 0);
    }
  }
  if (!sc.juggling || !j || !j.alive || j.owner !== sc) return;
  const f = j.fig;
  const t = sc.t * 2.6;
  const rx = f.right.x;
  const rz = f.right.z;
  for (let i = 0; i < 3; i++) {
    // up over the head from one hand and down into the other, the three in turn; a little trail
    // behind each
    for (let tr = 2; tr >= 0; tr--) {
      const ph = (((t - tr * 0.12) / Math.PI + i * 0.667) % 2) / 2;
      const side = ph < 0.5 ? 1 : -1;
      const k = (ph % 0.5) / 0.5;
      const u = side * (0.26 - 0.52 * k);
      const y = 1.2 + Math.sin(k * Math.PI) * 0.85;
      f.toWorld(u, y, 0.36, _v);
      const r = tr ? 0.03 : 0.075;
      const al = tr ? 0.45 / tr : 1;
      for (let s = 0; s < (tr ? 1 : 4); s++) {
        const a = (s / 4) * Math.PI;
        const cx = Math.cos(a) * r;
        fr.lineXYZ(_v.x - rx * cx, _v.y - Math.sin(a) * r, _v.z - rz * cx, _v.x + rx * cx, _v.y + Math.sin(a) * r, _v.z + rz * cx, BALLS[i], 13, 970 + i * 8 + s + tr * 4, al, 0.002, 0);
      }
      if (!tr) {
        // its outline in ink
        for (let s = 0; s < 6; s++) {
          const a0 = (s / 6) * Math.PI * 2;
          const a1 = ((s + 1) / 6) * Math.PI * 2;
          fr.lineXYZ(_v.x + rx * Math.cos(a0) * r, _v.y + Math.sin(a0) * r, _v.z + rz * Math.cos(a0) * r, _v.x + rx * Math.cos(a1) * r, _v.y + Math.sin(a1) * r, _v.z + rz * Math.cos(a1) * r, INK, 1.6, 1000 + i * 6 + s, 1, 0.002, 0);
        }
      }
    }
  }
}

// ------------------------------------------------------------------ the protest
function* protestScene(sc, def) {
  const game = sc.game;
  const n = game.touch ? 5 : 9;
  const fx = def.to.x - def.from.x;
  const fz = def.to.z - def.from.z;
  const len = Math.hypot(fx, fz) || 1;
  const ux = fx / len;
  const uz = fz / len;
  const yaw = Math.atan2(ux, uz);
  // three abreast, rows a metre and a half apart
  const offs = [];
  for (let i = 0; i < n; i++) offs.push({ side: ((i % 3) - 1) * 0.9, back: Math.floor(i / 3) * 1.5 });
  const people = [];
  for (let i = 0; i < n; i++) {
    const o = offs[i];
    const x = def.from.x - ux * o.back - uz * o.side;
    const z = def.from.z - uz * o.back + ux * o.side;
    const c = sc.spawn(civilianLook({ kind: pick(['street', 'denim', 'knit', 'smart']) }), x, z, yaw);
    c.sign = { color: pick(SIGNS), hand: new THREE.Vector3() };
    c.speed = 1.0;
    people.push(c);
  }
  const cop = sc.spawn(copLook(), def.from.x - uz * 2.4, def.from.z + ux * 2.4, yaw);
  sc.marchers = people;
  sc.props.signs = { draw: drawSigns };
  sc.onTick = () => {
    for (const c of people) {
      if (c.owner !== sc) continue;
      // the placard held up high
      c.fig.toWorld(0.14, 1.75, 0.18, c.sign.hand);
      c.fig.reachR = c.sign.hand;
    }
  };
  const slogan = pick(SLOGANS);
  let lead = 0;
  let chant = 0;
  let chantT = 2;
  const end = len - 4;
  while (lead < end) {
    lead += 0.9 * 0.25;
    const lx = def.from.x + ux * lead;
    const lz = def.from.z + uz * lead;
    for (let i = 0; i < people.length; i++) {
      const o = offs[i];
      people[i].goal = { x: lx - ux * o.back - uz * o.side, z: lz - uz * o.back + ux * o.side, speed: 1.2 };
    }
    cop.goal = { x: lx - ux * 1.5 - uz * 2.4, z: lz - uz * 1.5 + ux * 2.4, speed: 1.2 };
    sc.def.x = lx;
    sc.def.z = lz;
    chantT -= 0.25;
    if (chantT <= 0) {
      chantT = 2.2;
      const line = slogan[chant % slogan.length];
      // the call by the one in front, the answer by two at the back
      const who = chant % 2 ? [pick(people.slice(3)), pick(people.slice(3))] : [people[1]];
      for (const c of who) if (c) sc.say(c, line);
      chant++;
    }
    yield 0.25;
  }
  // the end of the march: they go their ways, the placards under their arms
  sc.props = {};
  for (const c of people) c.fig.reachR = null;
}

// a placard on a stick above each marcher: a coloured board with a scribbled slogan
function drawSigns(fr, sc) {
  const cam = sc.game.camera.position;
  for (const c of sc.marchers) {
    if (c.owner !== sc || !c.alive) continue;
    const h = c.fig.j.handR;
    const f = c.fig.forward;
    const r = c.fig.right;
    const top = h.y + 0.75;
    fr.lineXYZ(h.x, h.y - 0.15, h.z, h.x, top + 0.3, h.z, WOOD, 3, c.fig.seed + 980, 1, 0.003, 0);
    // the board, filled with strokes close enough together from where you look
    const d = Math.hypot(cam.x - h.x, cam.z - h.z);
    const gap = Math.min(0.05, Math.max(0.012, d * 0.0045));
    const n = Math.min(36, Math.ceil(0.36 / gap));
    const bx = h.x + f.x * 0.02;
    const bz = h.z + f.z * 0.02;
    for (let i = 0; i <= n; i++) {
      const y = top - 0.18 + (0.36 * i) / n;
      fr.lineXYZ(bx - r.x * 0.32, y, bz - r.z * 0.32, bx + r.x * 0.32, y, bz + r.z * 0.32, c.sign.color, 6, c.fig.seed + 1000 + (i & 31), 1, 0.002, 0);
    }
    // the slogan: two rows of scribble
    for (let k = 0; k < 2; k++) {
      const y = top + 0.07 - k * 0.14;
      fr.lineXYZ(bx + f.x * 0.01 - r.x * 0.24, y, bz + f.z * 0.01 - r.z * 0.24, bx + f.x * 0.01 + r.x * (0.24 - k * 0.1), y, bz + f.z * 0.01 + r.z * (0.24 - k * 0.1), INK, 3.2, c.fig.seed + 1040 + k, 1, 0.03, 0.02);
    }
  }
}

// ------------------------------------------------------------------ the wedding
function brideLook() {
  const L = civilianLook({ fem: true, kind: 'chic' });
  // (all in white, sleeves to the wrist, the skirt to the ground)
  L.top = { kind: 'blouse', color: [0.98, 0.97, 0.95], sleeves: 'long' };
  L.bottom = { kind: 'skirt', color: [0.98, 0.97, 0.95] };
  L.boots = null;
  L.shoes = [0.97, 0.96, 0.94];
  L.hair = { style: pick(['bun', 'long', 'curly']), color: L.hair.color };
  L.hat = null;
  L.acc = ['earrings'];
  L.face.mouth = 'smile';
  return L;
}

function groomLook() {
  const L = civilianLook({ fem: false, kind: 'office' });
  L.top = { kind: 'suit', color: [0.14, 0.15, 0.2], sleeves: 'long', shirt: [0.97, 0.97, 0.96], tie: [0.75, 0.2, 0.3] };
  L.bottom = { kind: 'pants', color: [0.14, 0.15, 0.2] };
  L.face.mouth = 'smile';
  L.acc = [];
  return L;
}

function* weddingScene(sc, def) {
  const game = sc.game;
  const { x, z } = def;
  // facing north: the arch, the couple under it, the one who marries them in front
  sc.arch = { x, z: z - 1.2 };
  sc.props.arch = { draw: drawArch };
  const bride = sc.spawn(brideLook(), x + 0.45, z - 0.4, Math.PI);
  const groom = sc.spawn(groomLook(), x - 0.45, z - 0.4, Math.PI);
  bride.fig.carry = 'bouquet';
  const officiant = sc.spawn(civilianLook({ kind: 'smart' }), x, z - 2.1, 0);
  officiant.fig.carry = 'book';
  const guests = [];
  const nG = game.touch ? 4 : 8;
  for (let i = 0; i < nG; i++) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const gx = x + (col < 2 ? -1 : 1) * (1.1 + (col % 2) * 0.8);
    const gz = z + 1.8 + row * 1.1;
    const g = sc.spawn(civilianLook({ kind: pick(['chic', 'smart', 'office']) }), gx, gz, Math.PI);
    guests.push(g);
  }
  for (const a of sc.actors) a.noCollide = true;
  sc.face(bride, officiant);
  sc.face(groom, officiant);
  for (const g of guests) sc.face(g, bride);
  // wait until you are near enough to see it
  let t = 0;
  while (t < 90) {
    const p = game.player.pos;
    if (Math.hypot(p.x - x, p.z - z) < 30) break;
    t += 0.5;
    yield 0.5;
  }
  sc.say(officiant, 'Dearly beloved, we are gathered here today...');
  yield 4;
  sc.face(bride, groom);
  sc.face(groom, bride);
  sc.say(officiant, 'Do you take each other, for better and for worse?');
  yield 3.5;
  sc.say(groom, 'I do!');
  yield 2;
  sc.say(bride, 'I do!');
  yield 2;
  sc.say(officiant, 'Then I now pronounce you married!');
  yield 1.2;
  // hooray
  const p = game.player.pos;
  const d = Math.hypot(p.x - x, p.z - z);
  if (d < 45) game.audio.play('cheer', 0.8 * (1 - d / 45));
  game.fx.confetti(x, 2.4, z - 0.3, 70, 4);
  for (const g of guests) sc.hop(g, 1.6, 0.18);
  sc.say(pick(guests), pick(['Hooray!', 'Mazal tov!', 'Congratulations!']));
  yield 2;
  game.fx.confetti(x, 2.2, z - 0.4, 40, 3);
  sc.say(pick(guests), pick(['Speech! Speech!', 'You look beautiful!', 'To the happy couple!']));
  yield 6;
  // they walk out together, the guests after them
  bride.goal = { x: x + 0.4, z: z + 6, speed: 1.0 };
  groom.goal = { x: x - 0.4, z: z + 6, speed: 1.0 };
  yield 5;
  sc.props = {};
}

// the arch of flowers: two white posts, a round top, flowers along it
function drawArch(fr, sc) {
  const { x, z } = sc.arch;
  const gy = groundHeight(x, z);
  const w = 1.1;
  for (const s of [-1, 1]) fr.lineXYZ(x + s * w, gy, z, x + s * w, gy + 2.0, z, WHITE, 9, 1100 + s, 1, 0.003, 0);
  let px = x - w;
  let py = gy + 2.0;
  for (let i = 1; i <= 12; i++) {
    const a = Math.PI - (i / 12) * Math.PI;
    const nx = x + Math.cos(a) * w;
    const ny = gy + 2.0 + Math.sin(a) * 0.7;
    fr.lineXYZ(px, py, z, nx, ny, z, WHITE, 9, 1110 + i, 1, 0.003, 0);
    const c = FLOWERS[i % FLOWERS.length];
    fr.lineXYZ(nx - 0.08, ny, z + 0.02, nx + 0.08, ny + 0.04, z + 0.02, c, 16, 1130 + i, 1, 0.004, 0);
    px = nx;
    py = ny;
  }
  for (let i = 0; i < 6; i++) {
    const s = i % 2 ? 1 : -1;
    const y = gy + 0.4 + i * 0.28;
    fr.lineXYZ(x + s * w - 0.07, y, z + 0.02, x + s * w + 0.07, y + 0.05, z + 0.02, FLOWERS[i % FLOWERS.length], 15, 1150 + i, 1, 0.004, 0);
  }
}
