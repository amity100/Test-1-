import * as THREE from 'three';
import { fmt } from './money.js';

// (v5, ROADMAP 16.5) Trying a pair on in a shoe shop (world/shoestore.js) - a part of the shop's life
// (game/shoplife.js ShopLife: this.tries).
//
// The shoe on the wall is a sample. A customer who likes it sits down on a bench with it and asks for
// a size; the one who works here goes into the stock room, comes back out with the box, kneels and
// puts it down at their feet. They try them - bent down over the laces a while - get up, walk to the
// low mirror and look at their feet in it, a turn of the heel; then back to the bench: the box taken,
// to the till, or left on the bench (the seller takes it back to the stock room later). The sample
// goes back on its shelf either way.
//
// And you: a shoe taken off the wall - "your size from the back" - and the seller brings the box out to
// you, wherever you are in the shop; it is paid for at the till.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const _a = new THREE.Vector3();

const SAY = {
  ask: ['Do you have these in a nine?', 'Could I try these in a ten?', 'Have you got an eight and a half?', 'These, in a nine, please?'],
  fetch: ['Let me check in the back!', 'One moment - I\'ll get your size.', 'Sure, be right back!'],
  give: ['Here you go - a nine.', 'Here they are! Try them on.', 'Last pair in that size!'],
  fit: ['They fit!', 'Oh, these are comfy.', 'Perfect.', 'I love them!'],
  nofit: ['A bit tight...', 'Hmm, not for me.', 'Too big.'],
  you: ['Sure! I\'ll get your size from the back.', 'Good choice - one moment, I\'ll bring a pair out.'],
  yours: ['Here you go - try them at the bench if you like.', 'There you are! Pay at the till when you\'re ready.'],
  ball: ['Good bounce!', 'Nice grip on this one.', 'This one\'s for the court.'],
  tread: ['Whew!', 'This one\'s smooth.', 'I could get used to this.'],
  bike: ['Nice bike!', 'How much is that one?', 'Look at those wheels.'],
};
// the balls in the sports shop's bins, in their order there (world/sportstore.js): the model, its skin,
// its seams, its radius
const BALLS = [['basketball', [0.9, 0.42, 0.14], [0.14, 0.1, 0.08], 0.12], ['football', [0.97, 0.97, 0.95], [0.12, 0.12, 0.14], 0.11], ['volleyball', [0.98, 0.86, 0.3], [0.2, 0.36, 0.7], 0.105]];

export class TryLife {
  // (one only where the room has its benches, its bins, its treadmill: world/shoestore.js,
  // world/sportstore.js marks)
  static for(life) {
    const M = life.marks || {};
    return M['try.0'] || M['bin.0'] || M['tread.on'] || M.bikes ? new TryLife(life) : null;
  }

  constructor(life) {
    this.life = life;
    this.game = life.game;
    this.M = life.marks;
    this.seats = [];
    for (let i = 0; i < 16; i++) {
      const m = this.M[`try.${i}`];
      if (!m) break;
      this.seats.push({ m, v: null });
    }
    this.mirrors = [];
    for (let i = 0; i < 8; i++) {
      const m = this.M[`lowMirror.${i}`];
      if (!m) break;
      this.mirrors.push(m);
    }
    // who waits for a box (a visitor at a seat, or you: v null); the boxes left on the benches
    this.queue = [];
    this.left = [];
    this.mine = null;
    // (a sports shop: the treadmill's belt - its slats, running while somebody walks on it; who is on it)
    this.slats = [];
    this.tread = null;
    this.belt = 0;
    const a = this.M['tread.a'];
    const b = this.M['tread.b'];
    if (a && b) {
      const L = Math.hypot(b.x - a.x, b.z - a.z);
      this.beltL = L;
      for (let i = 0; i < 9; i++) {
        const it = life.movers.add({ line: 'deco', model: 'slat', cell: null }, false);
        this.slats.push({ it, s: (i / 9) * L });
      }
      this.placeSlats();
    }
  }

  // what this part of the shop's life looks after (game/shoplife.js 'svc')
  has(svc) {
    return svc === 'try' || svc === 'ball' || svc === 'tread' || svc === 'bikes';
  }

  // (into a customer's plan in a sports shop: a ball from a bin, the treadmill, the bikes)
  plan(v, list) {
    const at = Math.min(list.length, 1);
    if (this.M['bin.0'] && Math.random() < 0.35) list.splice(at, 0, { svc: 'ball' });
    if (this.M['tread.on'] && !this.tread && Math.random() < 0.25) list.push({ svc: 'tread' });
    if (this.M.bikes && Math.random() < 0.25) list.push({ svc: 'bikes' });
  }

  // ---------------------------------------------------------------- the customers
  // after a look at a sample (game/shoplife.js 'examine'): sat down with it and a size asked for - or
  // not today (null: the shop's own way on)
  decide(v) {
    const L = v.L;
    if (!L.item || Math.random() < 0.4) return false;
    const free = this.seats.filter((q) => !q.v);
    if (!free.length) return false;
    const seat = pick(free);
    seat.v = v;
    if (L.zone && L.zone.busy === v) L.zone.busy = null;
    L.svc = 'try';
    L.S = { st: 'toSeat', seat, t: 0 };
    L.st = 'svc';
    L.t = 0;
    v.pts = null;
    return true;
  }

  visit(v, dt) {
    const L = v.L;
    const c = v.c;
    const f = c.fig;
    const S = L.S || (L.S = { st: L.svc === 'try' ? 'toSeat' : 'go', t: 0 });
    S.t += dt;
    if (L.svc === 'ball') return this.visitBall(v, S, dt);
    if (L.svc === 'tread') return this.visitTread(v, S, dt);
    if (L.svc === 'bikes') return this.visitBikes(v, S, dt);
    const seat = S.seat;
    if (!seat) return this.done(v);
    const m = seat.m;
    switch (S.st) {
      case 'toSeat': {
        const mv = this.walk(S, c, m.x + Math.sin(m.yaw) * 0.35, m.z + Math.cos(m.yaw) * 0.35);
        if (mv) return mv;
        S.st = 'sit';
        S.t = 0;
        return null;
      }
      case 'sit': {
        this.seatOn(c, m, dt);
        if (L.item) L.item.at = { c, how: 'grip' };
        if (S.t > 0.6 && !S.req) {
          S.req = { v, seat, look: L.item ? L.item.look : null, st: 'wait', box: null };
          this.queue.push(S.req);
          this.say(c, pick(SAY.ask), 0.95);
        }
        if (S.req && S.req.st === 'given') {
          S.st = 'tryOn';
          S.t = 0;
        }
        // (nobody came: up, and the sample back where it was - a box on its way goes back to the stock room)
        if (S.t > 150) {
          if (S.req) S.req.dead = true;
          this.queue = this.queue.filter((q) => q !== S.req);
          return this.getUp(v, false);
        }
        // (a look at the sample, turned in the hand, while waiting)
        if (L.item) f.reachR = _a.set(c.pos.x + Math.sin(c.yaw) * 0.32, c.pos.y + 0.78, c.pos.z + Math.cos(c.yaw) * 0.32);
        return null;
      }
      case 'tryOn': {
        // bent down over the laces, the sample put down on the bench beside them
        this.seatOn(c, m, dt);
        if (L.item) L.item.at = { x: m.x + Math.cos(m.yaw) * 0.32, y: this.life.room.floor + 0.45, z: m.z - Math.sin(m.yaw) * 0.32, yaw: m.yaw + 1.2 };
        const k = Math.sin(S.t * 3.2);
        f.reachR = _a.set(c.pos.x + Math.sin(c.yaw) * (0.42 + k * 0.04), this.life.room.floor + 0.14, c.pos.z + Math.cos(c.yaw) * (0.42 + k * 0.04));
        f.lookAt = f.reachR;
        if (S.t < 3.4) return null;
        f.reachR = null;
        f.lookAt = null;
        S.st = 'stand';
        S.t = 0;
        return null;
      }
      case 'stand': {
        f.sit = Math.max(0, (f.sit || 0) - dt * 3);
        if (f.sit > 0) return null;
        const mi = this.mirrors.length ? this.mirrors.reduce((a, b) => (Math.hypot(a.x - c.pos.x, a.z - c.pos.z) < Math.hypot(b.x - c.pos.x, b.z - c.pos.z) ? a : b)) : null;
        S.mirror = mi;
        S.st = mi ? 'toMirror' : 'decide';
        S.t = 0;
        S.pts = null;
        return null;
      }
      case 'toMirror': {
        const mi = S.mirror;
        const mv = this.walk(S, c, mi.x, mi.z);
        if (mv) return { ...mv, speed: 0.85 };
        S.st = 'feet';
        S.t = 0;
        return null;
      }
      case 'feet': {
        // the feet looked at in the low mirror, a turn of the heel
        const mi = S.mirror;
        c.faceYaw = mi.yaw + Math.sin(S.t * 1.6) * 0.3;
        f.lookAt = _a.set(mi.x + Math.sin(mi.yaw) * 0.75, this.life.room.floor + 0.25, mi.z + Math.cos(mi.yaw) * 0.75);
        if (S.t > 1.8 && !S.said) {
          S.said = true;
          S.keep = Math.random() < 0.55;
          this.say(c, pick(S.keep ? SAY.fit : SAY.nofit), 0.8);
        }
        if (S.t < 3.2) return null;
        f.lookAt = null;
        S.st = 'back';
        S.t = 0;
        S.pts = null;
        return null;
      }
      case 'decide':
        S.keep = Math.random() < 0.55;
        S.st = 'back';
        return null;
      case 'back': {
        // to the bench again: the box taken (or left), the sample picked up
        const mv = this.walk(S, c, m.x + Math.sin(m.yaw) * 0.35, m.z + Math.cos(m.yaw) * 0.35);
        if (mv) return mv;
        c.faceYaw = m.yaw + Math.PI;
        c.crouchW = 0.7;
        const box = S.req && S.req.box;
        if (box) f.reachR = _a.set(box.pos.x, box.pos.y + 0.08, box.pos.z);
        if (S.t < 0.8) return null;
        c.crouchW = 0;
        f.reachR = null;
        if (L.item) L.item.at = { c, how: 'grip' };
        return this.getUp(v, S.keep);
      }
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------- a sports shop's
  // a ball out of its bin: bounced on the floor three or four times, caught, put back
  visitBall(v, S, dt) {
    const c = v.c;
    const f = c.fig;
    if (S.st === 'go') {
      const n = [0, 1, 2].filter((i) => this.M[`bin.${i}`]);
      if (!n.length) return this.done(v);
      S.k = pick(n);
      S.m = this.M[`bin.${S.k}`];
      S.st = 'toBin';
    }
    const m = S.m;
    switch (S.st) {
      case 'toBin': {
        const mv = this.walk(S, c, m.x, m.z);
        if (mv) return mv;
        S.st = 'dig';
        S.t = 0;
        return null;
      }
      case 'dig': {
        c.faceYaw = m.yaw;
        const bx = m.x + Math.sin(m.yaw) * 0.72;
        const bz = m.z + Math.cos(m.yaw) * 0.72;
        f.reachR = _a.set(bx, m.y - 0.12, bz);
        f.lookAt = f.reachR;
        if (S.t < 0.7) return null;
        const K = BALLS[S.k % BALLS.length];
        S.ball = this.life.movers.add({ line: 'ball', model: K[0], cell: null, tint: K[1], cap: K[2] }, true);
        S.r = K[3];
        S.st = 'bounce';
        S.t = 0;
        // (a step back from the bin, into the aisle)
        return null;
      }
      case 'bounce': {
        // down to the floor and up to the hand, a little less each time; the eyes on it
        c.faceYaw = m.yaw;
        const fl = this.life.room.floor;
        const hx = c.pos.x + Math.sin(c.yaw) * 0.42 + Math.cos(c.yaw) * 0.12;
        const hz = c.pos.z + Math.cos(c.yaw) * 0.42 - Math.sin(c.yaw) * 0.12;
        const k = Math.abs(Math.cos(S.t * 4.2));
        const top = 0.95 - S.t * 0.05;
        const y = fl + S.r + k * (top - S.r);
        if (S.ball) S.ball.at = { x: hx, y: y - S.r, z: hz, yaw: S.t * 3 };
        f.reachR = _a.set(hx, Math.max(fl + 0.75, y + S.r), hz);
        f.lookAt = _a.set(hx, y, hz);
        // (the slap of it on the floor)
        const ph = Math.floor((S.t * 4.2) / Math.PI + 0.5);
        if (ph !== S.ph) {
          S.ph = ph;
          if (ph > 0) this.life.open.sound('bounce', 0.18, 8);
        }
        if (S.t > 1.2 && !S.said) {
          S.said = true;
          this.say(c, pick(SAY.ball), 0.35);
        }
        if (S.t < 3) return null;
        S.st = 'putBall';
        S.t = 0;
        return null;
      }
      case 'putBall': {
        c.faceYaw = m.yaw;
        const bx = m.x + Math.sin(m.yaw) * 0.72;
        const bz = m.z + Math.cos(m.yaw) * 0.72;
        f.reachR = _a.set(bx, m.y - 0.05, bz);
        if (S.ball) S.ball.at = { x: bx, y: m.y - 0.15, z: bz, yaw: 0 };
        if (S.t < 0.6) return null;
        if (S.ball) this.life.movers.remove(S.ball);
        S.ball = null;
        f.reachR = null;
        f.lookAt = null;
        return this.done(v);
      }
      default:
        return this.done(v);
    }
  }

  // on the treadmill a while, walking (the belt running under the feet), the screen looked at
  visitTread(v, S, dt) {
    const c = v.c;
    const f = c.fig;
    const on = this.M['tread.on'];
    const off = this.M['tread.off'];
    if (!on || !off) return this.done(v);
    switch (S.st) {
      case 'go': {
        if (this.tread && this.tread !== v) return this.done(v);
        this.tread = v;
        S.st = 'toTread';
        return null;
      }
      case 'toTread': {
        const mv = this.walk(S, c, off.x, off.z);
        if (mv) return mv;
        S.st = 'walk';
        S.t = 0;
        S.dur = 7 + Math.random() * 6;
        return null;
      }
      case 'walk': {
        // (held where the belt is: walking, but going nowhere)
        c.pos.x = on.x;
        c.pos.z = on.z;
        c.noCollide = true;
        c.faceYaw = on.yaw;
        this.belt = 1.25;
        if (S.t > 2 && !S.said) {
          S.said = true;
          this.say(c, pick(SAY.tread), 0.4);
        }
        if (S.t > 1.5 && S.t < 3.5) f.lookAt = _a.set(on.x + Math.sin(on.yaw) * 0.9, this.life.room.floor + 1.3, on.z + Math.cos(on.yaw) * 0.9);
        else f.lookAt = null;
        if (S.t < S.dur) return { x: on.x + Math.sin(on.yaw) * 2, z: on.z + Math.cos(on.yaw) * 2, speed: 1.25 };
        // (off at the back, the belt stopping)
        this.belt = 0;
        f.lookAt = null;
        c.pos.x = off.x;
        c.pos.z = off.z;
        c.noCollide = false;
        if (this.tread === v) this.tread = null;
        return this.done(v);
      }
      default:
        return this.done(v);
    }
  }

  // a look up at the bikes on the wall, a hand on a wheel
  visitBikes(v, S, dt) {
    const c = v.c;
    const f = c.fig;
    const m = this.M.bikes;
    if (!m) return this.done(v);
    if (S.st === 'go') {
      S.x = m.x + Math.cos(m.yaw) * (Math.random() - 0.5) * 2.4;
      S.z = m.z - Math.sin(m.yaw) * (Math.random() - 0.5) * 2.4;
      S.st = 'toBikes';
    }
    if (S.st === 'toBikes') {
      const mv = this.walk(S, c, S.x, S.z);
      if (mv) return mv;
      S.st = 'look';
      S.t = 0;
      return null;
    }
    c.faceYaw = m.yaw;
    const wx = c.pos.x + Math.sin(m.yaw) * 1.25;
    const wz = c.pos.z + Math.cos(m.yaw) * 1.25;
    f.lookAt = _a.set(wx, this.life.room.floor + 1.75, wz);
    f.reachR = S.t > 1.2 && S.t < 2.6 ? _a.set(c.pos.x + Math.sin(m.yaw) * 0.7, this.life.room.floor + 1.45, c.pos.z + Math.cos(m.yaw) * 0.7) : null;
    if (S.t > 1 && !S.said) {
      S.said = true;
      this.say(c, pick(SAY.bike), 0.4);
    }
    if (S.t < 4) return null;
    f.lookAt = null;
    f.reachR = null;
    return this.done(v);
  }

  // the belt's slats along it, each where its turn round the belt has it (under the deck going back)
  placeSlats() {
    const a = this.M['tread.a'];
    const b = this.M['tread.b'];
    if (!a || !b) return;
    const L = this.beltL;
    const dx = (b.x - a.x) / L;
    const dz = (b.z - a.z) / L;
    const yaw = Math.atan2(dx, dz) + Math.PI / 2;
    for (const q of this.slats) {
      // (a slat runs from the console's end to the back: the walker's feet push it back)
      const s = L - (((q.s % L) + L) % L);
      q.it.at = { x: a.x + dx * s, y: a.y, z: a.z + dz * s, yaw };
    }
  }

  // sat on the bench at a mark: down onto it, facing out
  seatOn(c, m, dt) {
    c.pos.x = m.x;
    c.pos.z = m.z;
    c.faceYaw = m.yaw;
    c.fig.sit = Math.min(1, (c.fig.sit || 0) + dt * 3);
  }

  // off the bench: the box kept (to the till) or left for the seller; the sample back to its shelf
  getUp(v, keep) {
    const L = v.L;
    const S = L.S;
    const c = v.c;
    c.fig.sit = 0;
    c.fig.reachR = null;
    c.fig.lookAt = null;
    const req = S && S.req;
    const box = req && req.box;
    if (box) {
      if (keep) {
        box.at = { c, how: L.item ? 'armful' : 'grip' };
        box.price = this.life.prof.prices.shoe || 89;
        L.got.push(box);
      } else {
        this.left.push(box);
      }
    }
    this.queue = this.queue.filter((q) => q !== req);
    if (S && S.seat && S.seat.v === v) S.seat.v = null;
    L.S = null;
    L.svc = null;
    L.t = 0;
    v.pts = null;
    // (the sample back on the wall: to where it came from, and onto its shelf)
    const s = L.slot;
    if (L.item && s && s.zx !== null && s.zx !== undefined) {
      L.st = 'toRail';
      this.life.go(v, s.zx, s.zz);
    } else if (L.item) L.st = 'putBack';
    else L.st = 'afterItem';
    return null;
  }

  done(v) {
    const L = v.L;
    if (L.S && L.S.seat && L.S.seat.v === v) L.S.seat.v = null;
    L.S = null;
    L.svc = null;
    L.st = 'next';
    L.t = 0;
    v.pts = null;
    return null;
  }

  // a customer let go of (frightened, gone): their seat, their place in the line, the treadmill
  release(v) {
    for (const s of this.seats) if (s.v === v) s.v = null;
    if (this.tread === v) {
      this.tread = null;
      v.c.noCollide = false;
    }
    const S = v.L && v.L.S;
    if (S && S.ball) {
      this.life.movers.remove(S.ball);
      S.ball = null;
    }
    for (const q of this.queue) {
      if (q.v !== v) continue;
      if (q.box) this.left.push(q.box);
      q.dead = true;
    }
    this.queue = this.queue.filter((q) => !q.dead);
  }

  // ---------------------------------------------------------------- the one who works here
  // between other jobs (game/shoplife.js stockerWork 'idle'): a box wanted, a box left on a bench
  job(c, S) {
    const req = this.queue.find((q) => q.st === 'wait');
    if (req) {
      req.st = 'fetch';
      S.job = { kind: 'try', req };
      S.st = 'tryStock';
      const m = this.M.stock;
      if (!m) {
        req.st = 'wait';
        return undefined;
      }
      this.life.goS(c, m.x, m.z);
      this.say(c, pick(SAY.fetch), 0.7);
      return null;
    }
    const box = this.left.find((b) => !b.claimed);
    if (box) {
      box.claimed = true;
      S.job = { kind: 'tidyBox', box };
      S.st = 'tryTidy';
      this.life.goS(c, box.pos.x, box.pos.z, 0.45);
      return null;
    }
    return undefined;
  }

  staff(c, S, dt) {
    const f = c.fig;
    S.t += dt;
    const walk = () => this.life.open.follow(S);
    const J = S.job || {};
    switch (S.st) {
      case 'tryStock': {
        const mv = walk();
        if (mv) return { ...mv, speed: 1.3 };
        // into the stock room a moment, for the size
        const m = this.M.stock;
        c.faceYaw = m.yaw + Math.PI;
        S.st = 'tryIn';
        S.t = 0;
        return null;
      }
      case 'tryIn': {
        if (S.t > 0.3 && !S.hid) {
          S.hid = true;
          c.inside = true;
          f.setVisible(false);
        }
        if (S.t < 2.6) return null;
        S.hid = false;
        c.inside = false;
        f.setVisible(true);
        const req = J.req;
        if (!req || req.dead) return this.idle(S);
        // out again with the shoe box under the arm
        const col = pick([[0.9, 0.46, 0.16], [0.14, 0.14, 0.16], [0.95, 0.94, 0.9], [0.78, 0.18, 0.18], [0.2, 0.36, 0.7]]);
        J.box = this.life.movers.add({ line: 'box', model: 'shoeBox', cell: null, tint: col, cap: [0.97, 0.97, 0.95] }, true);
        J.box.at = { c, how: 'grip' };
        f.carry = 'held';
        S.st = 'tryBring';
        S.t = 0;
        this.toCustomer(c, S, req);
        return null;
      }
      case 'tryBring': {
        const req = J.req;
        if (!req || req.dead) {
          // (whoever it was for has gone: back into the stock room with it)
          if (!J.box) return this.idle(S);
          S.st = 'tryShelve';
          S.t = 0;
          const m = this.M.stock;
          if (m) this.life.goS(c, m.x, m.z);
          return null;
        }
        // (you move about: followed)
        if (!req.v && (S.t > 1.5 || !S.pts || !S.pts.length)) {
          const P = this.game.player;
          if (Math.hypot(P.pos.x - c.pos.x, P.pos.z - c.pos.z) > 1.3) {
            this.toCustomer(c, S, req);
            S.t = 0;
          }
        }
        const mv = walk();
        if (mv) return { ...mv, speed: 1.2 };
        if (!req.v) {
          const P = this.game.player;
          if (Math.hypot(P.pos.x - c.pos.x, P.pos.z - c.pos.z) > 1.5) {
            this.toCustomer(c, S, req);
            return null;
          }
        }
        S.st = 'tryGive';
        S.t = 0;
        return null;
      }
      case 'tryGive': {
        const req = J.req;
        if (!req) return this.idle(S);
        if (!req.v) {
          // into your hands
          const P = this.game.player;
          c.faceYaw = Math.atan2(P.pos.x - c.pos.x, P.pos.z - c.pos.z);
          f.reachR = _a.set(P.pos.x, P.pos.y + 1.0, P.pos.z);
          if (S.t < 0.5) return null;
          f.reachR = null;
          f.carry = null;
          this.giveYou(J.box, req);
          J.box = null;
          this.say(c, pick(SAY.yours), 0.9);
          return this.idle(S);
        }
        // kneeling at their feet: the box down on the floor before them
        const m = req.seat.m;
        c.faceYaw = Math.atan2(m.x - c.pos.x, m.z - c.pos.z);
        c.crouchW = Math.min(0.85, S.t * 2);
        const bx = m.x + Math.sin(m.yaw) * 0.45 + Math.cos(m.yaw) * 0.18;
        const bz = m.z + Math.cos(m.yaw) * 0.45 - Math.sin(m.yaw) * 0.18;
        f.reachR = _a.set(bx, this.life.room.floor + 0.12, bz);
        if (S.t < 0.9) return null;
        if (J.box) {
          J.box.at = { x: bx, y: this.life.room.floor, z: bz, yaw: m.yaw + 0.3 };
          req.box = J.box;
          J.box = null;
        }
        req.st = 'given';
        f.carry = null;
        f.reachR = null;
        c.crouchW = 0;
        this.say(c, pick(SAY.give), 0.8);
        return this.idle(S);
      }
      case 'tryTidy': {
        const b = J.box;
        if (!b) return this.idle(S);
        const mv = walk();
        if (mv) return mv;
        c.crouchW = Math.min(0.75, S.t * 2);
        f.reachR = _a.set(b.pos.x, b.pos.y + 0.08, b.pos.z);
        if (S.t < 0.8) return null;
        c.crouchW = 0;
        f.reachR = null;
        b.at = { c, how: 'grip' };
        f.carry = 'held';
        this.left = this.left.filter((q) => q !== b);
        S.st = 'tryShelve';
        S.t = 0;
        const m = this.M.stock;
        if (m) this.life.goS(c, m.x, m.z);
        return null;
      }
      case 'tryShelve': {
        const mv = walk();
        if (mv) return mv;
        if (J.box) this.life.movers.remove(J.box);
        J.box = null;
        f.carry = null;
        return this.idle(S);
      }
      default:
        return this.idle(S);
    }
  }

  idle(S) {
    S.st = 'idle';
    S.t = 0;
    S.job = null;
    S.pts = null;
    return null;
  }

  // to stand before whoever it is for: before the bench at their seat, or by you
  toCustomer(c, S, req) {
    if (req.v) {
      const m = req.seat.m;
      this.life.goS(c, m.x + Math.sin(m.yaw) * 0.85, m.z + Math.cos(m.yaw) * 0.85);
      return;
    }
    const P = this.game.player;
    this.life.goS(c, P.pos.x, P.pos.z, 0.9);
  }

  // ---------------------------------------------------------------- you
  // a shoe off the wall (game/shopper.js take): the sample stays; your size comes from the back
  forYou(s, price) {
    const life = this.life;
    if (!life.S || !life.S.c || !life.S.c.alive) return false;
    if (this.mine) return true;
    const req = { v: null, seat: null, look: s.look, what: s.what, price, heb: life.prof.heb[s.what] || 'נעליים', st: 'wait', box: null };
    this.queue.unshift(req);
    this.mine = req;
    this.say(life.S.c, pick(SAY.you), 1);
    this.game.hud.toast('המוכר הולך להביא לכם את המידה מהמחסן', 'info', 2.6);
    return true;
  }

  giveYou(box, req) {
    const life = this.life;
    const you = life.you;
    this.mine = null;
    this.queue = this.queue.filter((q) => q !== req);
    if (!box) return;
    box.price = req.price;
    you.items.push({ it: box, s: null, what: req.what, price: req.price, heb: req.heb, look: req.look });
    you.arrange();
    this.game.hud.toast(`הקופסה אצלכם (${fmt(req.price)}) — משלמים בקופה`, 'good', 2.6);
  }

  update(dt = 1 / 30) {
    // (the treadmill's belt: running while somebody walks on it, slowing to a stop after)
    if (this.slats.length) {
      if (!this.tread) this.belt = Math.max(0, this.belt - dt * 1.5);
      if (this.belt > 0) {
        for (const q of this.slats) q.s += this.belt * dt;
        this.placeSlats();
      }
    }
    // (you gone out before the box came: the request dropped)
    if (this.mine && !this.life.room.inside(this.game.player.pos.x, this.game.player.pos.z, 0.3, this.game.player.pos.y)) {
      this.mine.dead = true;
      this.queue = this.queue.filter((q) => q !== this.mine);
      this.mine = null;
    }
  }

  // ---------------------------------------------------------------- the small things
  walk(S, c, x, z) {
    if (Math.hypot(c.pos.x - x, c.pos.z - z) < 0.3) {
      S.pts = null;
      return null;
    }
    if (!S.pts || S.to !== `${x.toFixed(2)},${z.toFixed(2)}`) {
      S.pts = this.life.room.path(c.pos.x, c.pos.z, x, z);
      S.to = `${x.toFixed(2)},${z.toFixed(2)}`;
      S.wt = 0;
    }
    S.wt = (S.wt || 0) + 1 / 30;
    const m = this.life.open.follow({ c, pts: S.pts, t: S.wt });
    if (m) return m;
    c.pos.x = x;
    c.pos.z = z;
    S.pts = null;
    return null;
  }

  say(c, text, chance = 1) {
    if (c) this.life.say(c, text, chance);
  }

  dispose() {
    for (const q of this.slats) this.life.movers.remove(q.it);
    this.slats = [];
    for (const b of this.left) this.life.movers.remove(b);
    this.left = [];
    for (const q of this.queue) if (q.box) this.life.movers.remove(q.box);
    this.queue = [];
    this.mine = null;
  }
}
