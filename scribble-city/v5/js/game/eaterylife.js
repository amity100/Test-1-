import * as THREE from 'three';
import { ShopLife } from './shoplife.js';
import { MENUS } from '../world/menus.js';
import { EATEN } from '../world/foods.js';
import { forkToMouth } from './venuelife.js';
import { fmt } from './money.js';

// (v5, ROADMAP 16.3) An eatery's day (world/eatery.js): a shop's life (game/shoplife.js) - its till,
// its things in motion, you with a gun at its till (game/shopper.js) - but what is sold here is made.
//
// A customer comes in, stops to read the board, joins the line; at the till says what they want; the
// cashier rings it up, the card to the reader. Then they wait where the orders come out. The cook goes
// to make it, one place in the kitchen after another - the grinder, the espresso machine, the milk; the
// prep table, the oven, the board it is cut on; the grill, the pass - a hand at work at each; brings it
// to the counter and draws it there in the air, and it comes true: a real plate, a real cup, there. The
// customer takes it: to a table, to sit and eat it - bite after bite, the plate emptier, the cup lifted
// to the lips and put down - or out of the door with it. The plates left on the tables are cleared.
//
// You order at the till the same way (a dialog with the board's menu and its prices), pay, and wait;
// yours is drawn for you; you take it - to eat it here (sit at a free table: what it does for you,
// game/shopper.js USE) or to take it with you, eaten when you need it (game/player.js meals).

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const _a = new THREE.Vector3();
const DRINKS = new Set(['mug', 'cupGo', 'juiceCup', 'shake', 'sodaCup']);
// what steams while it is worked (white, off the milk and the cups and the pots) and what smokes (the
// grill, the oil, the wok): how often a puff, how big, how high over the hand (game/fx.js sprites)
const STEAM = {
  espresso: { every: 0.16, size: 0.14, dy: 0.12, alpha: 0.55, tint: [1, 1, 1] },
  milk: { every: 0.1, size: 0.16, dy: 0.08, alpha: 0.6, tint: [1, 1, 1] },
  coffee: { every: 0.3, size: 0.13, dy: 0.12, alpha: 0.45, tint: [1, 1, 1] },
  pots: { every: 0.2, size: 0.22, dy: 0.25, alpha: 0.5, tint: [1, 1, 1] },
  rice: { every: 0.3, size: 0.18, dy: 0.2, alpha: 0.45, tint: [1, 1, 1] },
  grill: { every: 0.12, size: 0.26, dy: 0.06, alpha: 0.4, tint: [0.78, 0.76, 0.74] },
  fryer: { every: 0.2, size: 0.2, dy: 0.1, alpha: 0.35, tint: [0.85, 0.84, 0.8] },
  wok: { every: 0.1, size: 0.24, dy: 0.12, alpha: 0.45, tint: [0.82, 0.8, 0.78] },
  oven: { every: 0.5, size: 0.2, dy: 0.22, alpha: 0.3, tint: [0.7, 0.68, 0.66] },
};
const SAY = {
  order: ['Hi! One {}, please.', 'Can I get a {}?', 'A {} for me.', '{}, please!', 'I\'ll have the {}.'],
  ring: ['Coming right up!', 'Sure thing!', 'Good choice.', 'That\'ll be ready in a minute.'],
  ready: ['Order up!', 'Here you go!', 'Enjoy!', 'One {} - fresh!'],
  thanks: ['Thanks!', 'Smells amazing.', 'Yum.', 'Perfect, thank you!'],
  eat: ['Mmm.', 'So good.', 'Best in town.', 'I needed this.'],
  bye: ['See you!', 'Thanks, bye!', 'Have a good one!'],
  cook: ['Two minutes!', 'Hot pan!', 'Behind you!', 'Almost there...'],
};

export class EateryLife extends ShopLife {
  constructor(open) {
    super(open);
    this.food = true;
    this.menu = MENUS[this.shop.kind] || MENUS.cafe;
    // orders: { v (a visitor, or null: yours), item, st: 'new' | 'cook' | 'ready' | 'taken', it }
    this.orders = [];
    // the plates and cups left on the tables: { it, until }
    this.left = [];
    this.mine = null;
    this.refill = [];
    this.muralOn = true;
  }

  // ---------------------------------------------------------------- the people
  enlist(v, o = {}) {
    const R = this.room;
    const L = (v.L = { st: 'enter', t: 0, seed: Math.random() * 10, look: new THREE.Vector3(), reach: new THREE.Vector3(), reachL: new THREE.Vector3(), got: [], list: [], item: null, order: null, seat: null, dish: null });
    // (the hands at the plate: forkToMouth keeps its vectors on the visitor)
    v.hand = v.hand || new THREE.Vector3();
    v.handL = v.handL || new THREE.Vector3();
    v.forkT = Math.random() * 3;
    v.forkP = 2.4 + Math.random() * 1.4;
    if (o.already && v.mode === 'seat' && v.spot) {
      // (here before you came: at a table, halfway through what they ordered)
      L.item = pick(this.menu);
      L.seat = v.spot;
      L.st = 'eat';
      L.t = Math.random() * 10;
      L.dur = 25 + Math.random() * 30;
      L.dish = this.serveAt(L.item, v.spot);
      v.c.fig.sit = 1;
      return L;
    }
    if (o.already) {
      // (standing by the counter, reading the board: in line soon)
      L.st = 'read';
      L.dur = 1 + Math.random() * 3;
      return L;
    }
    const p = R.door;
    L.orient = { x: p.x - this.shop.nx * 1.3, z: p.z - this.shop.nz * 1.3 };
    v.pts = null;
    return L;
  }

  // a dish on the table before a seat
  serveAt(item, seat) {
    const it = this.movers.add(this.lookOf(item), false);
    const fx = Math.sin(seat.yaw);
    const fz = Math.cos(seat.yaw);
    it.at = { x: seat.x + fx * 0.42, y: this.room.floor + 0.745, z: seat.z + fz * 0.42, yaw: seat.yaw + Math.PI };
    it.item = item;
    it.stage = 0;
    return it;
  }

  lookOf(item) {
    return { line: 'food', model: item.model, cell: null, tint: item.tint || null, cap: item.cap || null };
  }

  // a free seat (not one somebody is in, nor one a plate was left at)
  freeSeat(near) {
    const used = new Set(this.open.visitors.map((v) => v.L && v.L.seat).filter(Boolean));
    if (this.mine && this.mine.seat) used.add(this.mine.seat);
    let best = null;
    let bd = Infinity;
    for (const s of this.room.seats) {
      if (used.has(s)) continue;
      if (this.left.some((l) => l.seat === s)) continue;
      const d = near ? Math.hypot(s.x - near.x, s.z - near.z) : Math.random();
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  visit(v, dt) {
    const c = v.c;
    const f = c.fig;
    const L = v.L;
    L.t += dt;
    const R = this.room;
    switch (L.st) {
      case 'enter': {
        if (!v.pts) v.pts = [{ x: this.shop.door[0], z: this.shop.door[2], bell: true }, { x: R.door.x, z: R.door.z, inRoom: true }, ...R.path(R.door.x, R.door.z, L.orient.x, L.orient.z)];
        const m = this.open.follow(v);
        if (m) return m;
        L.st = 'read';
        L.t = 0;
        L.dur = 1.4 + Math.random() * 2;
        return null;
      }
      case 'read': {
        // the board over the kitchen: a long look at it
        const b = this.marks['st.case'] || this.marks.cook;
        if (b) {
          L.look.set(b.x, R.floor + 2.4, b.z);
          f.lookAt = L.look;
        }
        if (L.t < L.dur) return null;
        f.lookAt = null;
        L.item = pick(this.menu);
        L.st = 'queue';
        if (!this.queue.includes(v)) this.queue.push(v);
        L.qi = -1;
        L.t = 0;
        return null;
      }
      case 'queue': {
        const i = this.queue.indexOf(v);
        const ps = R.pay;
        if (i < 0 || !ps || !this.open.open) {
          this.goOut(v);
          return null;
        }
        if (i === 0 && (!this.payer || this.payer === v || !this.payer.c.alive)) {
          this.queue.shift();
          this.payer = v;
          L.st = 'toTill';
          this.go(v, ps.x, ps.z);
          return null;
        }
        const qd = R.queueDir || [-Math.sin(ps.yaw), -Math.cos(ps.yaw)];
        const tx = ps.x + qd[0] * 0.85 * (i + 1);
        const tz = ps.z + qd[1] * 0.85 * (i + 1);
        if (L.qi !== i) {
          L.qi = i;
          this.go(v, tx, tz);
        }
        const m = this.open.follow(v);
        if (m) return m;
        c.faceYaw = Math.atan2(ps.x - c.pos.x, ps.z - c.pos.z);
        return null;
      }
      case 'toTill': {
        const m = this.open.follow(v);
        if (m) return m;
        L.st = 'order';
        L.t = 0;
        this.say(c, pick(SAY.order).replace('{}', L.item.name.toLowerCase()), 0.85);
        return null;
      }
      case 'order':
        c.faceYaw = R.pay.yaw;
        if (this.open.keeper && this.open.keeper.alive) f.lookAt = this.open.keeper.fig.j.headC;
        if (L.t < 1.6) return null;
        L.st = 'pay';
        L.t = 0;
        return null;
      case 'pay': {
        // the card to the reader, a beep
        const r = this.marks.reader;
        c.faceYaw = R.pay.yaw;
        f.carry = 'card';
        if (r) {
          f.reachR = L.reach.set(r.x, r.y + 0.02, r.z);
          f.lookAt = f.reachR;
        }
        if (L.t > 0.9 && !L.paid) {
          L.paid = true;
          this.open.sound('beep', 0.7, 12);
          this.stats.bought++;
          L.order = { v, item: L.item, st: 'new', it: null };
          this.orders.push(L.order);
        }
        if (L.t < 1.4) return null;
        f.reachR = null;
        f.lookAt = null;
        f.carry = null;
        if (this.payer === v) this.payer = null;
        L.st = 'wait';
        L.t = 0;
        const po = this.marks['pickup.out'];
        if (po) this.go(v, po.x + (Math.random() - 0.5) * 0.8, po.z + (Math.random() - 0.5) * 0.5);
        return null;
      }
      case 'wait': {
        // where the orders come out: watching the kitchen, a look at the phone
        const m = this.open.follow(v);
        if (m) return m;
        const pu = this.marks.pickup;
        if (pu) c.faceYaw = Math.atan2(pu.x - c.pos.x, pu.z - c.pos.z);
        if (!f.carry && Math.random() < 0.003) f.carry = 'phone';
        const o = L.order;
        if (o && o.st === 'ready' && o.it) {
          f.carry = null;
          L.st = 'take';
          L.t = 0;
        }
        if (L.t > 90) this.goOut(v);
        return null;
      }
      case 'take': {
        const o = L.order;
        const pu = this.marks.pickup;
        const po = this.marks['pickup.out'];
        if (po && Math.hypot(c.pos.x - po.x, c.pos.z - po.z) > 0.5 && L.t < 4) {
          return { x: po.x, z: po.z, speed: 1.1 };
        }
        if (pu) {
          c.faceYaw = Math.atan2(pu.x - c.pos.x, pu.z - c.pos.z);
          f.reachR = L.reach.set(o.it.pos.x, o.it.pos.y + 0.05, o.it.pos.z);
          f.lookAt = f.reachR;
        }
        if (L.t < 0.6) return null;
        o.st = 'taken';
        o.it.at = { c, how: 'grip' };
        f.reachR = null;
        f.lookAt = null;
        f.carry = 'held';
        L.dish = o.it;
        this.say(c, pick(SAY.thanks), 0.4);
        // (to a table with it, or out with it)
        const seat = !L.item.go || Math.random() < 0.35 ? (v.mode === 'seat' && v.spot ? v.spot : this.freeSeat(c.pos)) : null;
        if (seat) {
          L.seat = seat;
          L.st = 'toSeat';
          this.go(v, seat.x, seat.z);
        } else {
          L.st = 'out';
          c.carryUntil = this.game.time + 40;
          this.goOut(v, true);
        }
        L.t = 0;
        return null;
      }
      case 'toSeat': {
        const m = this.open.follow(v);
        if (m) return m;
        // sat down, the dish put down before them
        const s = L.seat;
        c.pos.x = s.x;
        c.pos.z = s.z;
        c.faceYaw = s.yaw;
        f.carry = null;
        if (L.dish) {
          const fx = Math.sin(s.yaw);
          const fz = Math.cos(s.yaw);
          L.dish.at = { x: s.x + fx * 0.42, y: R.floor + 0.745, z: s.z + fz * 0.42, yaw: s.yaw + Math.PI };
          L.dish = this.unbox(L.dish);
          L.dish.stage = 0;
        }
        L.st = 'eat';
        L.t = 0;
        L.dur = 25 + Math.random() * 30;
        return null;
      }
      case 'eat':
        return this.eat(v, dt);
      default:
        return null;
    }
  }

  // at the table: a bite at a time (the plate emptier), or the cup up to the lips and down
  eat(v, dt) {
    const c = v.c;
    const f = c.fig;
    const L = v.L;
    const s = L.seat;
    c.pos.x = s.x;
    c.pos.z = s.z;
    c.faceYaw = s.yaw;
    f.sit = Math.min(1, f.sit + dt * 3);
    const it = L.dish;
    const drink = it && DRINKS.has(it.look.model);
    if (drink) {
      // (the cup lifted: in the hand a moment, back on the table)
      L.sip = (L.sip === undefined ? 1 + Math.random() * 3 : L.sip) - dt;
      if (L.sip < 0 && it) {
        if (!L.sipping) {
          L.sipping = true;
          L.home = it.at;
          it.at = { c, how: 'grip' };
        }
        f.drinkT = Math.min(1, -L.sip / 0.6);
        if (L.sip < -1.6) {
          L.sipping = false;
          it.at = L.home;
          f.drinkT = -1;
          L.sip = 3 + Math.random() * 4;
        }
      }
    } else forkToMouth(v, s, this.room.floor, dt);
    // (emptier as it goes)
    if (it && !drink) {
      const steps = EATEN[it.look.model] || [];
      const k = L.t / L.dur;
      const want = Math.min(steps.length, Math.floor(k * (steps.length + 1)));
      if (want > (it.stage || 0) && steps[want - 1] !== undefined) this.swapDish(L, steps[want - 1]);
    }
    if (Math.random() < 0.0015) this.say(c, pick(SAY.eat), 0.6);
    if (L.t < L.dur) return null;
    // done: up, what is left on the table, out
    f.reachR = null;
    f.reachL = null;
    f.drinkT = -1;
    if (L.dish) {
      if (L.sipping) L.dish.at = L.home;
      const steps = EATEN[L.dish.look.model] || [null];
      const last = steps[steps.length - 1];
      if (last) {
        this.swapDish(L, last);
        this.left.push({ it: L.dish, seat: s, until: this.game.time + 60 });
      } else this.movers.remove(L.dish);
      L.dish = null;
    }
    f.sit = 0;
    if (Math.random() < 0.5) this.say(c, pick(SAY.bye), 0.5);
    L.seat = null;
    this.goOut(v);
    return null;
  }

  // what is on the plate now
  swapDish(L, model) {
    const old = L.dish;
    if (!old) return;
    if (model === null) {
      this.movers.remove(old);
      L.dish = null;
      return;
    }
    const it = this.movers.add({ line: 'food', model, cell: null, tint: old.look.tint, cap: old.look.cap }, false);
    it.at = old.at;
    it.stage = (old.stage || 0) + 1;
    it.item = old.item;
    this.movers.remove(old);
    L.dish = it;
  }

  // the box opened on the table: what was in it, where it was
  unbox(it) {
    if (!it || !it.boxed) return it;
    const n = this.movers.add(this.lookOf(it.item), false);
    n.at = it.at;
    n.item = it.item;
    n.stage = 0;
    this.movers.remove(it);
    return n;
  }

  // out of the door (keep: what they carry goes with them)
  goOut(v, keep = false) {
    const L = v.L;
    const c = v.c;
    const qi = this.queue.indexOf(v);
    if (qi >= 0) this.queue.splice(qi, 1);
    if (this.payer === v) this.payer = null;
    if (L.order && L.order.st !== 'taken') {
      // (gone before it was ready: the order dropped; what was made of it, put away)
      if (L.order.it) this.movers.remove(L.order.it);
      this.orders = this.orders.filter((o) => o !== L.order);
    }
    if (L.dish && !keep) {
      this.movers.remove(L.dish);
      L.dish = null;
    }
    c.fig.reachR = null;
    c.fig.reachL = null;
    c.fig.lookAt = null;
    c.fig.sit = 0;
    if (c.fig.carry === 'held' && !keep) c.fig.carry = null;
    L.st = 'gone';
    v.life = false;
    this.open.leave(v);
  }

  release(v) {
    const L = v.L;
    if (!L) return;
    const c = v.c;
    const qi = this.queue.indexOf(v);
    if (qi >= 0) this.queue.splice(qi, 1);
    if (this.payer === v) this.payer = null;
    if (L.dish) this.drop(L.dish, c.pos.x, c.pos.z);
    L.dish = null;
    if (L.order && L.order.st !== 'taken') this.orders = this.orders.filter((o) => o !== L.order);
    c.fig.sit = 0;
    if (c.fig.carry === 'held') c.fig.carry = null;
    L.st = 'gone';
    v.life = false;
  }

  // ---------------------------------------------------------------- the cashier
  keeper(c, dt) {
    const f = c.fig;
    const K = (this.K = this.K || { st: 'idle', t: 0, act: 'look', actT: 0, reach: new THREE.Vector3(), look: new THREE.Vector3() });
    // (held up: game/shopper.js; and between customers what a cashier does: game/shoplife.js)
    if (this.you.rob && this.you.rob.k === c) return super.keeper(c, dt);
    const pv = this.payer;
    const ordering = pv && pv.L && (pv.L.st === 'order' || pv.L.st === 'pay');
    const mine = this.mine && (this.mine.st === 'order' || this.mine.st === 'pay');
    if (!ordering && !mine) {
      // (no cook here: the cashier makes what was ordered)
      if (!this.S && this.orders.some((o) => o.st === 'new' || (o.st === 'cook' && o.by === c))) return this.cook(c, dt);
      return super.keeper(c, dt);
    }
    K.t += dt;
    const home = this.open.home;
    const who = mine ? this.game.player : pv.c;
    f.lookAt = who.fig.j.headC;
    c.faceYaw = Math.atan2(who.pos.x - c.pos.x, who.pos.z - c.pos.z);
    // (the order into the till: a few keys)
    const m = this.marks.keys;
    if (m && ((pv && pv.L.t > 0.6) || mine)) {
      const k = Math.floor(K.t * 3.5);
      f.reachR = K.reach.set(m.x + ((k * 37) % 5) * 0.012 - 0.02, m.y + 0.02 + (K.t * 3.5 - k < 0.4 ? 0 : 0.03), m.z + ((k * 13) % 3) * 0.015);
    } else f.reachR = null;
    if (pv && pv.L.st === 'order' && pv.L.t > 1.2 && !pv.L.rung) {
      pv.L.rung = true;
      this.say(c, pick(SAY.ring), 0.7);
      this.open.sound('till', 0.3, 12);
    }
    return { x: home.x, z: home.z, speed: 0.6 };
  }

  // ---------------------------------------------------------------- the cook
  // (the shop's second pair of hands: game/streetlife.js spawnStaff - here they cook)
  stockerWork(c, dt) {
    if (this.orders.some((o) => o.st === 'new' || (o.st === 'cook' && o.by === c))) return this.cook(c, dt);
    return this.tidy(c, dt);
  }

  // the next order: from one station to the next, a while at each; to the counter, and drawn there
  cook(c, dt) {
    const f = c.fig;
    let o = this.orders.find((q) => q.st === 'cook' && q.by === c);
    if (!o) {
      o = this.orders.find((q) => q.st === 'new');
      if (!o) return null;
      o.st = 'cook';
      o.by = c;
      o.step = 0;
      o.t = 0;
      o.stations = [...o.item.at];
      if (Math.random() < 0.3) this.say(c, pick(SAY.cook), 0.5);
    }
    o.t += dt;
    if (o.step < o.stations.length) {
      const name = o.stations[o.step];
      const st = this.marks[`st.${name}`];
      const hand = this.marks[`at.${name}`];
      if (!st) {
        o.step++;
        o.t = 0;
        return null;
      }
      if (Math.hypot(c.pos.x - st.x, c.pos.z - st.z) > 0.3) {
        if (!o.pts || o.ptsFor !== name) {
          o.pts = this.room.path(c.pos.x, c.pos.z, st.x, st.z);
          o.ptsFor = name;
        }
        const m = this.open.follow({ c, pts: o.pts, t: o.t });
        if (m) return { ...m, speed: 1.3 };
        c.pos.x = st.x;
        c.pos.z = st.z;
      }
      o.pts = null;
      // at work: the hands at it
      if (!o.at0) {
        o.at0 = true;
        o.t = 0;
        this.workSound(name);
        if (name === 'case') this.fromCase(o, c);
      }
      if (hand) {
        this.puff(name, hand, dt, 'work');
        c.faceYaw = Math.atan2(hand.x - c.pos.x, hand.z - c.pos.z);
        const w = Math.sin(o.t * 7) * 0.05;
        f.reachR = _a.set(hand.x + w, hand.y + Math.abs(Math.sin(o.t * 5)) * 0.04, hand.z);
        f.reachL = o.reachL || (o.reachL = new THREE.Vector3());
        f.reachL.set(hand.x - 0.12 - w * 0.5, hand.y, hand.z + 0.05);
        f.lookAt = f.reachR;
      }
      if (o.t > (name === 'oven' ? 3.2 : name === 'grill' ? 2.8 : 1.8)) {
        f.reachL = null;
        o.step++;
        o.t = 0;
        o.at0 = false;
      }
      return null;
    }
    // to the counter, where the orders go out; drawn there
    const pin = this.marks['pickup.in'];
    const pu = this.marks.pickup;
    if (pin && Math.hypot(c.pos.x - pin.x, c.pos.z - pin.z) > 0.3 && !o.drawn) {
      if (!o.pts || o.ptsFor !== 'pickup') {
        o.pts = this.room.path(c.pos.x, c.pos.z, pin.x, pin.z);
        o.ptsFor = 'pickup';
      }
      const m = this.open.follow({ c, pts: o.pts, t: o.t });
      if (m) return { ...m, speed: 1.3 };
      c.pos.x = pin.x;
      c.pos.z = pin.z;
    }
    if (!pu) {
      this.ready(o, c);
      return null;
    }
    c.faceYaw = Math.atan2(pu.x - c.pos.x, pu.z - c.pos.z);
    if (!o.drawn) {
      o.drawn = true;
      f.reachL = null;
      if (o.held) {
        // (out of the case: it is there already, in the hand)
        this.movers.remove(o.held);
        o.held = null;
      }
      const at = _a.set(pu.x, pu.y + 0.32, pu.z).clone();
      const sk = this.game.airsketch ? this.game.airsketch.draw({ shape: o.item.shape, at, size: 0.42, author: c, target: new THREE.Vector3(pu.x, pu.y + 0.05, pu.z), targetScale: 0.2, dur: 1.4, onPlop: () => this.ready(o, c) }) : null;
      if (!sk) this.ready(o, c);
      o.t = 0;
    }
    if (o.st === 'cook' && o.t > 6) this.ready(o, c);
    return null;
  }

  // what the work sounds like
  workSound(name) {
    const S = { espresso: 'pour', milk: 'pour', grinder: 'drill', soda: 'pour', blenders: 'drill', shake: 'drill', fryer: 'pour', grill: 'clank', pots: 'pour', wok: 'clank', cutting: 'snip', prep: 'snip', oven: 'clank', deck: 'clank', boxes: 'snip' };
    const s = S[name];
    if (s) this.open.sound(s, 0.35, 12);
  }

  // a thing that is ready already (a muffin, a slice, a scoop): taken out of the case
  fromCase(o, c) {
    if (!this.live) return;
    // (the gelato's tubs stay where they are: the scoop goes into them - only the hand reaches in)
    const s = this.live.slots.find((q) => q.state === 'shelf' && q.what === o.item.id);
    if (!s) return;
    this.setSlot(s, 'held');
    const it = this.movers.add(s.look, false);
    it.slot = s;
    it.at = { c, how: 'grip' };
    o.held = it;
    // (a fresh one in its place a while after, from the kitchen)
    this.refill.push({ s, at: this.game.time + 50 });
  }

  // the order on the counter, real: who ordered it can take it
  ready(o, c) {
    if (o.st !== 'cook') return;
    const pu = this.marks.pickup;
    // (a whole pie comes out in its box: opened at the table - toSeat, sitMine)
    const bx = o.item.boxed;
    const it = this.movers.add(bx ? { line: 'food', model: bx.model, cell: null, tint: null, cap: bx.cap || null } : this.lookOf(o.item), false);
    it.boxed = !!bx;
    it.at = pu ? { x: pu.x, y: pu.y, z: pu.z, yaw: this.open.homeYaw + Math.PI } : { c, how: 'grip' };
    it.item = o.item;
    o.it = it;
    o.st = 'ready';
    o.readyT = this.game.time;
    this.open.sound('ding', 0.4, 14);
    this.say(c, pick(SAY.ready).replace('{}', o.item.name.toLowerCase()), 0.6);
    c.fig.reachR = null;
    c.fig.lookAt = null;
  }

  // between orders: the plates left on the tables taken to the sink, the line wiped
  tidy(c, dt) {
    const f = c.fig;
    const T = (this.T = this.T || { t: 0, job: null });
    T.t += dt;
    if (!T.job) {
      const l = this.left.find((q) => !q.by);
      if (l) {
        l.by = c;
        T.job = { l, st: 'go', pts: null };
      }
    }
    if (T.job) {
      const J = T.job;
      const it = J.l.it;
      if (J.st === 'go') {
        if (!J.pts) J.pts = this.room.path(c.pos.x, c.pos.z, it.pos.x, it.pos.z);
        const m = this.open.follow({ c, pts: J.pts, t: T.t });
        if (m && Math.hypot(c.pos.x - it.pos.x, c.pos.z - it.pos.z) > 0.65) return { ...m, speed: 1.2 };
        f.reachR = _a.set(it.pos.x, it.pos.y + 0.03, it.pos.z);
        f.lookAt = f.reachR;
        c.faceYaw = Math.atan2(it.pos.x - c.pos.x, it.pos.z - c.pos.z);
        J.wait = (J.wait || 0) + dt;
        if (J.wait < 0.6) return null;
        it.at = { c, how: 'grip' };
        f.reachR = null;
        f.carry = 'held';
        J.st = 'back';
        const sk = this.marks['st.sink'] || this.marks.cook;
        J.pts = sk ? this.room.path(c.pos.x, c.pos.z, sk.x, sk.z) : null;
        return null;
      }
      const m = J.pts ? this.open.follow({ c, pts: J.pts, t: T.t }) : null;
      if (m) return { ...m, speed: 1.2 };
      this.movers.remove(it);
      this.left = this.left.filter((q) => q !== J.l);
      f.carry = null;
      this.open.sound('clank', 0.25, 10);
      T.job = null;
      return null;
    }
    // (the cook's place, a wipe along the line now and then)
    const home = this.marks.cook;
    if (home && Math.hypot(c.pos.x - home.x, c.pos.z - home.z) > 0.4) return { x: home.x, z: home.z, speed: 0.9 };
    const h = this.marks['at.' + (this.lineName || 'prep')] || this.marks.wipe;
    if (h && Math.sin(T.t * 0.3) > 0.2) {
      f.reachR = _a.set(h.x + Math.sin(T.t * 3) * 0.2, h.y - 0.1, h.z);
      f.carry = 'cloth';
      c.faceYaw = Math.atan2(h.x - c.pos.x, h.z - c.pos.z);
    } else {
      f.reachR = null;
      if (f.carry === 'cloth') f.carry = null;
    }
    return null;
  }

  // a puff of steam (or of smoke) over a station; each kind of puff on its own clock
  puff(name, at, dt, clock) {
    const fx = this.game.fx;
    const P = STEAM[name];
    if (!fx || !P || !at) return;
    const T = (this.puffs = this.puffs || {});
    const key = clock + name;
    T[key] = (T[key] || 0) - dt;
    if (T[key] > 0) return;
    T[key] = P.every * (0.7 + Math.random() * 0.6) * (clock === 'idle' ? 4 : 1);
    fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', at.x + (Math.random() - 0.5) * 0.1, at.y + P.dy, at.z + (Math.random() - 0.5) * 0.1, { size: P.size, grow: 0.55, life: 1.2 + Math.random() * 0.5, vy: 0.3, vx: (Math.random() - 0.5) * 0.06, alpha: P.alpha * (clock === 'idle' ? 0.7 : 1), tint: P.tint, fadeIn: 0.15 });
  }

  // ---------------------------------------------------------------- every frame
  update(dt) {
    super.update(dt);
    const g = this.game;
    // (the pots simmer and the oven breathes whether or not anyone is cooking: while you are near)
    const pp = g.player.pos;
    const c1 = this.room.center;
    if (Math.abs(pp.x - c1.x) + Math.abs(pp.z - c1.z) < 16) {
      for (const n of ['pots', 'rice', 'oven']) {
        const m = this.marks[`at.${n}`];
        if (m) this.puff(n, m, dt, 'idle');
      }
    }
    // (the plates nobody came for: cleared by the shop in the end)
    if (this.left.length && !this.S) {
      for (const l of this.left) if (g.time > l.until) this.movers.remove(l.it);
      this.left = this.left.filter((l) => g.time <= l.until);
    }
    // (an order left on the counter too long: whoever ordered it is gone)
    for (const o of this.orders) {
      if (o.st === 'ready' && o.v && (!o.v.c.alive || o.v.L.st === 'gone') && g.time - o.readyT > 20) {
        this.movers.remove(o.it);
        o.st = 'taken';
      }
    }
    this.orders = this.orders.filter((o) => o.st !== 'taken');
    if (this.refill.length) {
      for (const r of this.refill) if (g.time > r.at && r.s.state !== 'shelf') this.setSlot(r.s, 'shelf');
      this.refill = this.refill.filter((r) => g.time <= r.at);
    }
    // (taken away: in the hand down the street a while, then gone)
    const c0 = this.room.center;
    for (const it of [...this.movers.items]) {
      const at = it.at;
      if (at && at.c && !at.c.player && (!at.c.alive || Math.hypot(at.c.pos.x - c0.x, at.c.pos.z - c0.z) > 30)) this.movers.remove(it);
    }
    this.updateMine(dt);
  }

  // ---------------------------------------------------------------- you
  // (no taking things off the shelves here: you order)
  target() {
    return null;
  }

  // at the till: the board's menu, its prices
  order() {
    const g = this.game;
    if (this.mine) return;
    const k = this.open.keeper;
    if (!k || !k.alive || !this.open.open) {
      g.hud.toast('אין אף אחד בקופה', 'info', 2);
      return;
    }
    if (Math.random() < 0.8) this.say(k, pick(['Hi! What can I get you?', 'Hey there! What\'ll it be?', 'Welcome! Ready to order?']), 1);
    const choices = this.menu.map((it) => ({
      label: `${it.heb} · ${fmt(it.price)}`,
      fn: () => this.chose(it),
    }));
    choices.push({ label: 'לא עכשיו', fn: null });
    g.dialog.show(this.shop.name || 'תפריט', 'מה להזמין?', choices);
  }

  chose(item) {
    const g = this.game;
    const M = g.money;
    const name = this.shop.name || 'הזמנה';
    if (M && !M.pay(item.price, name)) {
      M.refuse(name, item.price, false, () => {});
      return;
    }
    const k = this.open.keeper;
    if (k) this.say(k, pick(SAY.ring), 0.9);
    this.open.sound('till', 0.4, 12);
    this.stats.bought++;
    const o = { v: null, item, st: 'new', it: null };
    this.orders.push(o);
    this.mine = { st: 'wait', t: 0, order: o, item, seat: null, eatT: 0 };
    g.hud.toast(`הזמנתם ${item.heb}. מחכים ליד הדלפק…`, 'info', 2.5);
  }

  // yours: ready, taken; eaten at a table, or taken with you
  updateMine(dt) {
    const g = this.game;
    const P = g.player;
    const m = this.mine;
    if (!m) return;
    m.t += dt;
    const o = m.order;
    const inside = this.room.inside(P.pos.x, P.pos.z, 0.3, P.pos.y);
    if (m.st === 'wait' && o.st === 'ready' && o.it) {
      const pu = this.marks.pickup;
      if (!pu || Math.hypot(P.pos.x - pu.x, P.pos.z - pu.z) < 2.6) {
        // (yours, in your hand)
        o.st = 'taken';
        o.it.at = { c: this.you.me, how: 'grip' };
        m.it = o.it;
        m.st = 'carry';
        m.t = 0;
        P.fig.carry = 'held';
        g.hud.toast(`${m.item.heb}! שבו ליד שולחן פנוי (E) או צאו איתו לדרך`, 'good', 3.2);
      } else if (!m.told) {
        m.told = true;
        g.hud.toast('ההזמנה שלכם מוכנה על הדלפק', 'info', 2.5);
      }
    }
    if (m.st === 'carry' && !inside) {
      // (out of the door with it: it goes with you - eaten when you need it, game/player.js)
      this.takeAway(m);
      return;
    }
    if (m.st === 'eat') {
      const s = m.seat;
      m.eatT += dt;
      // (the seat lets go when you get up: what is left stays on the table)
      if (!P.seat) {
        this.finishMine(m, false);
        return;
      }
      const dur = DRINKS.has(m.item.model) ? 10 : 14;
      const steps = EATEN[m.item.model] || [];
      const want = Math.min(steps.length, Math.floor((m.eatT / dur) * (steps.length + 1)));
      if (want > (m.stage || 0) && steps[want - 1] !== undefined) {
        m.stage = want;
        const L = { dish: m.it };
        this.swapDish(L, steps[want - 1]);
        m.it = L.dish;
      }
      // (a bite now and then: the hand up from the plate)
      const f = P.fig;
      const k = (m.eatT % 2.6) / 2.6;
      if (m.it && k > 0.4 && k < 0.6) f.reachR = _a.set(f.j.headC.x + Math.sin(s.yaw) * 0.12, f.j.headC.y - 0.08, f.j.headC.z + Math.cos(s.yaw) * 0.12);
      else f.reachR = null;
      if (m.eatT > dur) this.finishMine(m, true);
    }
    if (m.st === 'wait' && !inside && m.t > 2) {
      // (left before it was ready: it waits for nobody)
      this.orders = this.orders.filter((q) => q !== o);
      this.mine = null;
    }
  }

  // at a free seat with it: sit, put it down, eat
  sitMine(seat) {
    const g = this.game;
    const P = g.player;
    const m = this.mine;
    if (!m || m.st !== 'carry') return;
    m.seat = seat;
    m.st = 'eat';
    m.eatT = 0;
    m.stage = 0;
    P.seat = { x: seat.x, z: seat.z, yaw: seat.yaw };
    P.fig.carry = null;
    const fx = Math.sin(seat.yaw);
    const fz = Math.cos(seat.yaw);
    m.it.at = { x: seat.x + fx * 0.42, y: this.room.floor + 0.745, z: seat.z + fz * 0.42, yaw: seat.yaw + Math.PI };
    m.it = this.unbox(m.it);
  }

  finishMine(m, all) {
    const g = this.game;
    const P = g.player;
    P.fig.reachR = null;
    if (all) {
      this.eatEffect(m.item);
      const steps = EATEN[m.item.model] || [null];
      const last = steps[steps.length - 1];
      if (m.it && last) {
        const L = { dish: m.it };
        if (m.it.look.model !== last) this.swapDish(L, last);
        this.left.push({ it: L.dish, seat: m.seat, until: g.time + 60 });
      } else if (m.it) this.movers.remove(m.it);
      if (P.seat) P.seat = null;
    } else if (m.it) {
      // (got up before the end: what is left there on the table)
      this.left.push({ it: m.it, seat: m.seat, until: g.time + 60 });
    }
    this.mine = null;
  }

  // what it does for you (and the toast that says so)
  eatEffect(item, how = 'אכלתם') {
    const g = this.game;
    const P = g.player;
    const hp = item.hp || 0;
    if (hp) P.hp = Math.min(P.maxHp, P.hp + hp);
    if (item.coffee) P.coffeeT = Math.max(P.coffeeT || 0, item.coffee);
    const fx = [hp ? `+${hp} חיים` : null, item.coffee ? `מהירות ל־${item.coffee} שניות` : null].filter(Boolean).join(', ');
    g.hud.toast(`${how} ${item.heb}${fx ? ` (${fx})` : ''}`, 'good', 2.6);
  }

  takeAway(m) {
    const g = this.game;
    const P = g.player;
    if (m.it) this.movers.remove(m.it);
    P.fig.carry = null;
    P.meals = P.meals || [];
    P.meals.push({ heb: m.item.heb, hp: m.item.hp || 10, coffee: m.item.coffee || 0, model: m.item.model });
    g.hud.toast(`לקחתם ${m.item.heb} לדרך — תאכלו כשתצטרכו חיים`, 'info', 3);
    this.mine = null;
  }

  dispose() {
    if (this.mine) {
      if (this.mine.st === 'carry') this.takeAway(this.mine);
      this.mine = null;
    }
    super.dispose();
  }
}
