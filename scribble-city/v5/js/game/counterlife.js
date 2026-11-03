import * as THREE from 'three';
import { fmt } from './money.js';
import { makeSurface, canvasTexture } from '../render/materials.js';

// (v5, ROADMAP 16.4) The counters of the shops on the market's plan that serve (world/corner.js): the
// deli's, the pharmacy's - and the corner shop's slush machine turning, the blood pressure chair, the
// scratch cards at the till. A part of the shop's life (game/shoplife.js ShopLife: this.counter).
//
// The deli: a customer takes a number from the machine, waits, looks at the board; the clerk calls
// the number (the screen over the case changes, a ding), the customer steps up and says what they
// want; the clerk takes the salami to the slicer and slices it - the carriage back and forth -
// wraps it in paper at the end of the table and hands it over the case. It goes in the basket and
// is paid for at the till, like everything else.
//
// The pharmacy: a customer at the pick-up window gives a name; the pharmacist goes to the shelves of
// white bags, finds theirs, brings it to the window and says how to take it.
//
// The chair: now and then somebody sits in it, the arm in the cuff a while, and gets up again.
//
// And you: at the deli's counter E to order (a sandwich made, cheese, salami sliced); at the
// pharmacy's window E to ask the pharmacist (a first-aid kit, painkillers); in the chair E to take
// your blood pressure; at the corner shop's till E for a scratch card - scratched there and then.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const _a = new THREE.Vector3();

const SAY = {
  call: (n) => [`Number ${n}!`, `${n}! Number ${n}?`, `Now serving ${n}!`],
  order: ['Half a pound of salami, please.', 'The pastrami on rye, please.', 'Some of that Swiss - thin, please.', 'A turkey club, please.', 'Can I get the potato salad?'],
  slice: ['Thin enough?', 'Coming right up.', 'Anything else with that?'],
  give: ['Here you go!', 'Enjoy!', 'There you are.'],
  rxAsk: ['Picking up for Rivera.', "I'm here for a prescription.", 'Should be under Park.', 'Pick-up for Okafor, please.'],
  rxGive: ['Twice a day, with food.', 'All set. Any questions?', 'There you go - feel better!'],
  bp: ['Hmm, not bad.', 'A little high...', 'Perfect.'],
  hiDeli: ['Take a number, hon!', "Be with you in a sec - grab a number!"],
  hiRx: ['Hi! Pick-up or drop-off?', 'Hello! How can I help?'],
  luck: ['Good luck!', 'Feeling lucky?', 'Scratch away!'],
};

// what the deli makes, what the pharmacist hands over the counter (prices in whole dollars)
const DELI = [
  { id: 'sandwich', heb: 'סנדוויץ׳ פסטרמה', name: 'pastrami on rye', price: 7, hp: 40 },
  { id: 'club', heb: 'כריך הודו', name: 'turkey club', price: 6, hp: 35 },
  { id: 'cheese', heb: 'גבינה שוויצרית, חצי ליברה', name: 'Swiss, half a pound', price: 4, hp: 15 },
  { id: 'salami', heb: 'סלמי, חצי ליברה', name: 'salami, half a pound', price: 5, hp: 18 },
];
const RX = [
  { id: 'kit', heb: 'ערכת עזרה ראשונה', price: 12 },
  { id: 'pain', heb: 'משככי כאבים', price: 6 },
];
// (what a scratch card pays: most nothing, now and then a little, once in a while a lot)
const PRIZES = [[0.55, 0], [0.8, 2], [0.92, 5], [0.975, 20], [0.995, 100], [1, 500]];

export class CounterLife {
  // (one only where the room has one of its things: world/corner.js marks)
  static for(life) {
    const M = life.marks || {};
    if (M['deli.clerk'] || M['rx.pharm'] || M['spin.0'] || M['bp.seat'] || M.scratch) return new CounterLife(life);
    return null;
  }

  constructor(life) {
    this.life = life;
    this.game = life.game;
    this.M = life.marks;
    this.kind = this.M['deli.clerk'] ? 'deli' : this.M['rx.pharm'] ? 'rx' : null;
    // the slush machine's augers, turning
    this.spins = [];
    for (let i = 0; i < 4; i++) {
      const m = this.M[`spin.${i}`];
      if (!m) break;
      const it = life.movers.add({ line: 'deco', model: 'paddle', cell: null }, false);
      it.at = { x: m.x, y: m.y, z: m.z, yaw: i * 0.7 };
      this.spins.push({ it, w: 2.4 + i * 0.35 });
    }
    // who waits at the counter (a visitor, or you: null), who is being served
    this.queue = [];
    this.cur = null;
    this.num = 30 + Math.floor(Math.random() * 40);
    this.nextNum = this.num + 1;
    this.C = null;
    this.display = null;
    if (this.kind === 'deli' && this.M['deli.serving']) this.makeDisplay(this.M['deli.serving']);
    // the chair: who sits in it
    this.bp = null;
    // yours: an order at the counter, a turn in the chair
    this.mine = null;
    this.sitting = null;
  }

  // ---------------------------------------------------------------- the deli's screen
  makeDisplay(m) {
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 56;
    // (the game's own screen pen - a stock material has no answer for the drawing's other pictures,
    // render/pipeline.js, and is not drawn at all)
    const tex = canvasTexture(cv, { mips: false });
    const mat = makeSurface({ kind: 'uv', indoor: true, noShadow: true, map: tex, emMap: tex, emissive: new THREE.Color(1.1, 1.1, 1.1), wash: 0.95, density: 0.25, line: 0.6 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.28), mat);
    const yaw = m.yaw !== undefined ? m.yaw : 0;
    mesh.position.set(m.x + Math.sin(yaw) * 0.004, m.y, m.z + Math.cos(yaw) * 0.004);
    mesh.rotation.y = yaw;
    this.game.scene.add(mesh);
    this.display = { cv, tex, mesh, shown: -1 };
    this.drawDisplay();
  }

  drawDisplay() {
    const D = this.display;
    if (!D || D.shown === this.num) return;
    D.shown = this.num;
    const g = D.cv.getContext('2d');
    g.fillStyle = '#0d0f10';
    g.fillRect(0, 0, 128, 56);
    g.fillStyle = '#ff5a3a';
    g.font = '700 10px Rubik, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('NOW SERVING', 64, 11);
    g.font = '900 30px Rubik, Arial, sans-serif';
    g.fillText(String(this.num % 100).padStart(2, '0'), 64, 36);
    D.tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the customers
  // (into a customer's plan: the counter now and then, the chair once in a while)
  plan(v, list) {
    if (this.kind && this.M[this.kind === 'deli' ? 'deli.cust' : 'rx.cust'] && Math.random() < (this.kind === 'deli' ? 0.45 : 0.35)) list.splice(Math.min(list.length, 1), 0, { svc: this.kind });
    if (this.M['bp.seat'] && !this.bp && Math.random() < 0.12) list.push({ svc: 'bp' });
  }

  // a customer of the counter, of the chair (game/shoplife.js visit: L.st 'svc')
  visit(v, dt) {
    const L = v.L;
    const S = L.S || (L.S = { st: 'go', t: 0 });
    S.t += dt;
    if (L.svc === 'bp') return this.visitBP(v, S, dt);
    const c = v.c;
    const f = c.fig;
    const deli = this.kind === 'deli';
    switch (S.st) {
      case 'go': {
        // (the deli: to the number machine first; the pharmacy: to the line at the window)
        const m = deli ? this.M['deli.ticket'] : this.M['rx.cust'];
        const off = deli ? 0.42 : 0.6 * (this.queue.length + (this.cur ? 1 : 0));
        const mv = this.walk(S, c, m.x + this.out().x * off, m.z + this.out().z * off);
        if (mv) return mv;
        if (deli) {
          S.st = 'ticket';
          S.t = 0;
        } else {
          S.st = 'wait';
          S.t = 0;
          this.queue.push({ v, item: null });
        }
        return null;
      }
      case 'ticket': {
        const m = this.M['deli.ticket'];
        c.faceYaw = Math.atan2(m.x - c.pos.x, m.z - c.pos.z);
        f.reachR = _a.set(m.x, m.y, m.z);
        if (S.t < 0.7) return null;
        f.reachR = null;
        S.num = this.nextNum++;
        this.queue.push({ v, num: S.num, item: null });
        if (Math.random() < 0.4) this.say(this.clerk(), pick(SAY.hiDeli), 0.5);
        // (a little way off, the board looked at while waiting)
        const w = this.M['deli.wait'] || this.M['deli.cust'];
        S.wx = w.x + (Math.random() - 0.5) * 1.2;
        S.wz = w.z + (Math.random() - 0.5) * 0.8;
        S.st = 'wait';
        S.t = 0;
        return null;
      }
      case 'wait': {
        if (deli) {
          const mv = this.walk(S, c, S.wx, S.wz);
          if (mv) return { ...mv, speed: 0.9 };
          const g = this.M['deli.give'];
          c.faceYaw = Math.atan2(g.x - c.pos.x, g.z - c.pos.z);
          if (!f.carry && Math.random() < 0.002) f.carry = 'phone';
        } else {
          const i = this.queue.findIndex((q) => q.v === v);
          const m = this.M['rx.cust'];
          const o = this.out();
          const mv = this.walk(S, c, m.x + o.x * 0.6 * (i + 1), m.z + o.z * 0.6 * (i + 1));
          if (mv) return { ...mv, speed: 0.9 };
          c.faceYaw = Math.atan2(-o.x, -o.z);
        }
        if (this.cur && this.cur.v === v) {
          f.carry = f.carry === 'phone' ? null : f.carry;
          S.st = 'step';
          S.t = 0;
          S.pts = null;
        }
        if (S.t > 120) this.leave(v);
        return null;
      }
      case 'step': {
        const m = deli ? this.M['deli.cust'] : this.M['rx.cust'];
        const mv = this.walk(S, c, m.x, m.z);
        if (mv) return mv;
        const g = this.M[deli ? 'deli.give' : 'rx.give'];
        c.faceYaw = Math.atan2(g.x - c.pos.x, g.z - c.pos.z);
        if (!S.said) {
          S.said = true;
          this.say(c, pick(deli ? SAY.order : SAY.rxAsk), 0.9);
          if (this.cur) this.cur.here = true;
        }
        // (it is handed over: taken)
        if (this.cur && this.cur.v === v && this.cur.st === 'give' && this.cur.it) {
          f.reachR = _a.set(this.cur.it.pos.x, this.cur.it.pos.y + 0.03, this.cur.it.pos.z);
          f.lookAt = f.reachR;
          S.take = (S.take || 0) + dt;
          if (S.take > 0.6) this.took(v, this.cur);
        }
        return null;
      }
      default:
        return null;
    }
  }

  // the chair: sat in, the arm in the cuff, the numbers; up again
  visitBP(v, S, dt) {
    const c = v.c;
    const f = c.fig;
    const seat = this.M['bp.seat'];
    if (this.bp && this.bp !== v) {
      this.done(v);
      return null;
    }
    this.bp = v;
    if (S.st === 'go') {
      const mv = this.walk(S, c, seat.x, seat.z);
      if (mv) return mv;
      S.st = 'sit';
      S.t = 0;
    }
    c.pos.x = seat.x;
    c.pos.z = seat.z;
    c.faceYaw = seat.yaw;
    S.sit = Math.min(1, (S.sit || 0) + dt * 3);
    f.sit = S.sit;
    const arm = this.M['bp.arm'];
    if (S.t > 0.8 && S.t < 7 && arm) f.reachR = _a.set(arm.x, arm.y, arm.z);
    else f.reachR = null;
    if (S.t > 6 && !S.said) {
      S.said = true;
      this.say(c, pick(SAY.bp), 0.7);
      this.life.open.sound('beep', 0.4, 8);
    }
    if (S.t < 8) return null;
    f.sit = 0;
    f.reachR = null;
    this.bp = null;
    this.done(v);
    return null;
  }

  // what was handed over: in the basket, in the hand; paid at the till
  took(v, cur) {
    const L = v.L;
    const c = v.c;
    const it = cur.it;
    c.fig.reachR = null;
    c.fig.lookAt = null;
    if (L.basket) it.at = { basket: L.basket, k: L.got.length };
    else it.at = { c, how: L.got.length ? 'armful' : 'grip' };
    L.got.push(it);
    this.cur = null;
    this.done(v);
  }

  done(v) {
    const L = v.L;
    L.S = null;
    L.svc = null;
    L.st = 'next';
    L.t = 0;
    v.pts = null;
  }

  leave(v) {
    this.queue = this.queue.filter((q) => q.v !== v);
    if (this.cur && this.cur.v === v) this.cur = null;
    this.done(v);
  }

  // a customer let go of (frightened, gone): out of the line
  release(v) {
    this.queue = this.queue.filter((q) => q.v !== v);
    if (this.cur && this.cur.v === v) {
      if (this.cur.it) this.life.movers.remove(this.cur.it);
      this.cur = null;
    }
    if (this.bp === v) this.bp = null;
  }

  // ---------------------------------------------------------------- the one behind the counter
  clerk() {
    return this.life.S ? this.life.S.c : this.life.open.keeper;
  }

  // the deli's clerk, the pharmacist: the next number called, made, handed over; between them the
  // case wiped, a look round
  staff(c, dt) {
    const f = c.fig;
    const T = (this.T = this.T || { t: 0, st: 'idle', pts: null });
    T.t += dt;
    const deli = this.kind === 'deli';
    const home = this.M[deli ? 'deli.clerk' : 'rx.pharm'];
    // (the next: whoever has waited longest - you too)
    if (!this.cur && this.queue.length) {
      this.cur = this.queue.shift();
      this.cur.st = 'call';
      this.cur.t = 0;
      if (deli) {
        this.num = this.cur.num || this.nextNum++;
        this.drawDisplay();
        this.say(c, pick(SAY.call(this.num % 100)), 1);
        this.life.open.sound('ding', 0.45, 12);
      }
      T.st = 'call';
      T.t = 0;
      T.pts = null;
    }
    const cur = this.cur;
    if (!cur) return this.idle(c, T, home, dt);
    // (the one called gone: the next)
    if (cur.v && (!cur.v.c.alive || cur.v.L.st === 'gone')) {
      if (cur.it) this.life.movers.remove(cur.it);
      this.cur = null;
      return null;
    }
    switch (T.st) {
      case 'call': {
        const mv = this.walk(T, c, home.x, home.z);
        if (mv) return mv;
        const g = this.M[deli ? 'deli.give' : 'rx.give'];
        c.faceYaw = Math.atan2(g.x - c.pos.x, g.z - c.pos.z);
        // (they step up - or you are there)
        const here = cur.v ? cur.here : this.youNear(2.2);
        if (here || T.t > 12) {
          T.st = deli ? 'slice' : 'fetch';
          T.t = 0;
          T.pts = null;
          if (deli && Math.random() < 0.5) this.say(c, pick(SAY.slice), 0.6);
        }
        return null;
      }
      case 'slice': {
        // to the slicer, the salami on its carriage, the carriage back and forth
        const sl = this.M['deli.slicer'];
        const cr = this.M['deli.carriage'];
        const mv = this.walk(T, c, sl.x + (home.x - sl.x) * 0.45, sl.z + (home.z - sl.z) * 0.45);
        if (mv) return mv;
        c.faceYaw = Math.atan2(sl.x - c.pos.x, sl.z - c.pos.z);
        if (!T.log && cr) {
          T.log = this.life.movers.add({ line: 'deco', model: 'meatLog', cell: null, tint: [0.56, 0.18, 0.16], cap: [0.86, 0.46, 0.44] }, false);
          T.log.at = { x: cr.x, y: cr.y, z: cr.z, yaw: Math.atan2(sl.x - cr.x, sl.z - cr.z) + Math.PI / 2 };
          T.y0 = cr;
        }
        const k = Math.sin(T.t * 5.5);
        if (T.log && cr) {
          const dx = sl.x - cr.x;
          const dz = sl.z - cr.z;
          const l = Math.hypot(dx, dz) || 1;
          // (the carriage rides across the blade: along the blade's face)
          const px = -dz / l;
          const pz = dx / l;
          T.log.at = { x: cr.x + px * k * 0.08, y: cr.y, z: cr.z + pz * k * 0.08, yaw: T.log.at.yaw };
          f.reachR = _a.set(cr.x + px * k * 0.08 + dx * 0.3, cr.y + 0.12, cr.z + pz * k * 0.08 + dz * 0.3);
          f.lookAt = f.reachR;
        }
        if (Math.floor(T.t * 2.75) !== Math.floor((T.t - dt) * 2.75)) this.life.open.sound('snip', 0.25, 9);
        if (T.t < 3.6) return null;
        if (T.log) this.life.movers.remove(T.log);
        T.log = null;
        f.reachR = null;
        f.lookAt = null;
        T.st = 'wrap';
        T.t = 0;
        T.pts = null;
        return null;
      }
      case 'wrap': {
        // at the end of the table: the paper round it, the sticker
        const w = this.M['deli.wrap'];
        const mv = this.walk(T, c, w.x + (home.x - w.x) * 0.5, w.z + (home.z - w.z) * 0.5);
        if (mv) return mv;
        c.faceYaw = Math.atan2(w.x - c.pos.x, w.z - c.pos.z);
        const k = Math.sin(T.t * 7);
        f.reachR = _a.set(w.x + k * 0.06, w.y + 0.04, w.z);
        f.reachL = f.reachL || new THREE.Vector3();
        f.reachL.set(w.x - k * 0.06, w.y + 0.04, w.z + 0.04);
        if (T.t > 0.5 && !T.pack) this.life.open.sound('pageflip', 0.35, 9);
        if (T.t < 1.4) return null;
        f.reachL = null;
        T.pack = this.life.movers.add({ line: 'deli', model: 'deliPack', cell: null }, false);
        T.pack.at = { c, how: 'grip' };
        T.st = 'give';
        T.t = 0;
        T.pts = null;
        return null;
      }
      case 'fetch': {
        // the pharmacist: to the shelves of bags, a reach up to the one
        const b = this.M['rx.bins'];
        const mv = this.walk(T, c, b.x + (home.x - b.x) * 0.55, b.z + (home.z - b.z) * 0.55);
        if (mv) return mv;
        c.faceYaw = Math.atan2(b.x - c.pos.x, b.z - c.pos.z);
        const k = Math.sin(T.t * 2.2);
        f.reachR = _a.set(b.x + k * 0.25, b.y + (T.t > 1 ? 0.3 : -0.2) + Math.abs(k) * 0.1, b.z);
        f.lookAt = f.reachR;
        if (T.t < 2.2) return null;
        f.reachR = null;
        f.lookAt = null;
        T.pack = this.life.movers.add({ line: 'rx', model: 'rxbag', cell: null }, false);
        T.pack.at = { c, how: 'grip' };
        T.st = 'give';
        T.t = 0;
        T.pts = null;
        return null;
      }
      case 'give': {
        // back to the counter, put down on it for them
        const g = this.M[deli ? 'deli.give' : 'rx.give'];
        const mv = this.walk(T, c, home.x, home.z);
        if (mv) return mv;
        c.faceYaw = Math.atan2(g.x - c.pos.x, g.z - c.pos.z);
        f.reachR = _a.set(g.x, g.y + 0.06, g.z);
        if (T.t < 0.6) return null;
        f.reachR = null;
        if (T.pack && cur.st !== 'give') {
          T.pack.at = { x: g.x, y: g.y, z: g.z, yaw: Math.atan2(c.pos.x - g.x, c.pos.z - g.z) + Math.PI };
          T.pack.price = cur.item ? cur.item.price : deli ? 5 : 10;
          cur.it = T.pack;
          cur.st = 'give';
          T.pack = null;
          this.say(c, pick(deli ? SAY.give : SAY.rxGive), 0.8);
        }
        // (taken: by them, or by you - updateMine; not taken for long: back on the shelf)
        if (T.t > 30 && this.cur === cur) {
          if (cur.it) this.life.movers.remove(cur.it);
          if (!cur.v) this.mine = null;
          this.cur = null;
        }
        return null;
      }
      default:
        T.st = 'idle';
        return null;
    }
  }

  // between customers: at the counter, a wipe of the case's top now and then, a look round
  idle(c, T, home, dt) {
    const f = c.fig;
    void dt;
    if (T.st !== 'idle') {
      T.st = 'idle';
      T.t = 0;
      T.pts = null;
    }
    const mv = this.walk(T, c, home.x, home.z);
    if (mv) return { ...mv, speed: 0.8 };
    const g = this.M[this.kind === 'deli' ? 'deli.give' : 'rx.give'];
    c.faceYaw = Math.atan2(g.x - c.pos.x, g.z - c.pos.z);
    if (Math.sin(T.t * 0.4) > 0.55) {
      f.reachR = _a.set(g.x + Math.sin(T.t * 3) * 0.25, g.y + 0.01, g.z);
      f.carry = 'cloth';
    } else {
      f.reachR = null;
      if (f.carry === 'cloth') f.carry = null;
    }
    return null;
  }

  // ---------------------------------------------------------------- every frame
  update(dt) {
    for (const s of this.spins) s.it.at.yaw += dt * s.w;
    this.updateMine(dt);
  }

  // ---------------------------------------------------------------- you
  // what E does here, if anything: at the deli's counter, at the pharmacy's window, by the chair
  target(P) {
    if (!this.life.open.open) return null;
    const M = this.M;
    const near = (m, r) => m && Math.hypot(m.x - P.pos.x, m.z - P.pos.z) < r;
    if (this.sitting) return null;
    if (near(M['bp.seat'], 1.1) && !this.bp) return { counter: 'bp', label: 'E — למדוד לחץ דם' };
    if (this.mine) return null;
    if (this.kind === 'deli' && (near(M['deli.cust'], 1.5) || near(M['deli.ticket'], 1.0))) return { counter: 'deli', label: 'E — להזמין בדלי' };
    if (this.kind === 'rx' && near(M['rx.cust'], 1.5)) return { counter: 'rx', label: 'E — לבקש מהרוקחת' };
    return null;
  }

  act(t) {
    const g = this.game;
    if (t.counter === 'bp') return this.sitBP();
    const deli = t.counter === 'deli';
    const list = deli ? DELI : RX;
    const k = this.clerk();
    if (k && k.alive) this.say(k, pick(deli ? SAY.hiDeli : SAY.hiRx), 0.9);
    const choices = list.map((it) => ({ label: `${it.heb} · ${fmt(it.price)}`, fn: () => this.orderMine(it) }));
    choices.push({ label: 'לא עכשיו', fn: null });
    g.dialog.show(deli ? 'הדלי' : 'הרוקחת', deli ? 'מה לפרוס לכם?' : 'במה אפשר לעזור?', choices);
  }

  orderMine(item) {
    const g = this.game;
    const q = { v: null, item, num: this.kind === 'deli' ? this.nextNum++ : 0 };
    this.queue.push(q);
    this.mine = { q, item, t: 0 };
    g.hud.toast(this.kind === 'deli' ? `לקחתם מספר: ${q.num % 100}. מחכים שיקראו לכם` : `הרוקחת מביאה ${item.heb}`, 'info', 2.6);
  }

  updateMine(dt) {
    const g = this.game;
    const P = g.player;
    // (the chair: sat in a while, the numbers on its screen)
    if (this.sitting) {
      const S = this.sitting;
      S.t += dt;
      const arm = this.M['bp.arm'];
      if (arm && S.t > 0.6 && S.t < 4.6) P.fig.reachR = _a.set(arm.x, arm.y, arm.z);
      if (S.t > 4.6 && !S.told) {
        S.told = true;
        P.fig.reachR = null;
        const hurt = P.hp < P.maxHp * 0.5;
        const sys = Math.round((hurt ? 138 : 112) + Math.random() * 14);
        const dia = Math.round((hurt ? 88 : 70) + Math.random() * 10);
        const pulse = Math.round((hurt ? 96 : 64) + Math.random() * 14);
        g.hud.toast(`לחץ דם ${sys}/${dia}, דופק ${pulse}${hurt ? ' — קצת גבוה, כדאי לנוח' : ' — הכול תקין'}`, hurt ? 'info' : 'good', 3.2);
        this.life.open.sound('beep', 0.5, 8);
      }
      if (S.t > 5.5 || !P.seat) {
        P.fig.reachR = null;
        if (P.seat) P.seat = null;
        this.bp = null;
        this.sitting = null;
      }
    }
    const m = this.mine;
    if (!m) return;
    m.t += dt;
    const cur = this.cur;
    // (yours handed over, and you at the counter: in your hands, to pay at the till)
    if (cur && cur === m.q && cur.st === 'give' && cur.it && this.youNear(2.4)) {
      const you = this.life.you;
      const it = cur.it;
      it.price = m.item.price;
      you.items.push({ it, s: null, what: m.item.id, price: m.item.price, heb: m.item.heb, look: it.look });
      you.arrange();
      this.cur = null;
      this.mine = null;
      g.hud.toast(`${m.item.heb} בידיים — משלמים בקופה`, 'good', 2.6);
      return;
    }
    // (called, and you are not there for long: the next)
    if (cur === m.q && !this.youNear(6) && m.t > 25) {
      if (cur.it) this.life.movers.remove(cur.it);
      this.cur = null;
      this.mine = null;
    }
    if (!this.life.room.inside(P.pos.x, P.pos.z, 0.3, P.pos.y)) {
      this.queue = this.queue.filter((q) => q !== m.q);
      if (this.cur === m.q) {
        if (this.cur.it) this.life.movers.remove(this.cur.it);
        this.cur = null;
      }
      this.mine = null;
    }
  }

  sitBP() {
    const P = this.game.player;
    const s = this.M['bp.seat'];
    if (!s || this.bp) return;
    this.bp = 'you';
    P.seat = { x: s.x, z: s.z, yaw: s.yaw };
    this.sitting = { t: 0 };
    this.game.hud.toast('מכניסים את היד לשרוול…', 'info', 2);
  }

  // the corner shop's till: a scratch card bought, scratched there and then
  scratch() {
    const g = this.game;
    const M = g.money;
    const k = this.life.open.keeper;
    if (M && !M.pay(2, 'כרטיס גירוד')) {
      M.refuse('כרטיס גירוד', 2, false, () => {});
      return;
    }
    if (k && k.alive) this.say(k, pick(SAY.luck), 1);
    this.life.open.sound('till', 0.35, 10);
    const r = Math.random();
    const prize = PRIZES.find(([p]) => r < p)[1];
    g.dialog.show('כרטיס גירוד · LUCKY INK', 'מגרדים את הכסף…', [{ label: 'לגרד!', fn: () => {
      g.audio.play('rubber', 0.6);
      if (prize > 0) {
        if (M) M.earn(prize, 'זכייה בכרטיס גירוד');
        g.audio.play(prize >= 100 ? 'cheer' : 'coins', 0.7);
        g.dialog.show('כרטיס גירוד', prize >= 100 ? `זכיתם ב־${fmt(prize)}! הקופאי לא מאמין` : `זכיתם ב־${fmt(prize)}`, [{ label: 'יש!', fn: null }]);
        if (k && k.alive) this.say(k, prize >= 100 ? 'No way! Congratulations!' : 'Hey, a winner!', 1);
      } else {
        g.dialog.show('כרטיס גירוד', 'לא זכיתם הפעם', [{ label: 'עוד אחד ($2)', fn: () => this.scratch() }, { label: 'מספיק', fn: null }]);
      }
    } }]);
  }

  // ---------------------------------------------------------------- the small things
  youNear(r) {
    const P = this.game.player;
    const m = this.M[this.kind === 'deli' ? 'deli.cust' : 'rx.cust'];
    return !!m && Math.hypot(m.x - P.pos.x, m.z - P.pos.z) < r;
  }

  // out of the counter, into the shop (the way a customer stands from it)
  out() {
    const g = this.M[this.kind === 'deli' ? 'deli.give' : 'rx.give'];
    const m = this.M[this.kind === 'deli' ? 'deli.cust' : 'rx.cust'];
    if (!g || !m) return { x: 0, z: 1 };
    const dx = m.x - g.x;
    const dz = m.z - g.z;
    const l = Math.hypot(dx, dz) || 1;
    return { x: dx / l, z: dz / l };
  }

  // to (x, z) by the room's paths: the move this frame, or null when there
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
    for (const s of this.spins) this.life.movers.remove(s.it);
    this.spins = [];
    if (this.display) {
      this.game.scene.remove(this.display.mesh);
      this.display.mesh.geometry.dispose();
      this.display.mesh.material.dispose();
      this.display.tex.dispose();
      this.display = null;
    }
    if (this.sitting) {
      const P = this.game.player;
      P.fig.reachR = null;
      if (P.seat) P.seat = null;
      this.sitting = null;
    }
  }
}
