import * as THREE from 'three';

// (v5, ROADMAP 16.9) The laundromat's and the gym's people at their work (game/shoplife.js, the flows
// 'laundry' and 'gym'):
//
// - The laundromat: in with a bag of washing on the shoulder; to a free machine, the washing loaded,
//   the door shut, the coins in - the washing going round behind the round window; a chair to wait
//   on, a magazine; back when it is done, out into a basket; to the long table, folded, one on another;
//   out with the basket.
// - The gym: a pair of dumbbells off the rack, curled before the mirror, put back; the barbell off its
//   hooks, pressed overhead, rep after rep; the punching bag hit - left, right - swinging on its chain
//   (the treadmill: game/trylife.js).

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const SAY = {
  load: ['Whites first...', 'Where did I put the coins?', 'Full load today.'],
  wait: ['Any minute now.', 'This takes forever.'],
  fold: ['Socks... where\'s the other sock?', 'Nice and warm.', 'Done!'],
  lift: ['One... two...', 'Come on!', 'Last one!'],
  punch: ['Hah!', 'Hup!', 'Take that!'],
  curl: ['Feel the burn.', 'Eight... nine... ten.'],
};

export class ServiceLife {
  static for(life) {
    const f = life.prof && life.prof.flow;
    if (f === 'laundry' || f === 'gym') return new ServiceLife(life, f);
    return null;
  }

  constructor(life, flow) {
    this.life = life;
    this.game = life.game;
    this.flow = flow;
    this.M = life.marks;
    this.t = 0;
    // the machines: each its window's mark, who it is washing for, how long it has left, its drum
    this.machines = [];
    for (let k = 0; this.M[`washer.${k}`]; k++) this.machines.push({ m: this.M[`washer.${k}`], load: this.M[`load.${k}`], v: null, left: 0, drum: null });
    // the dryers: turning now and then by themselves (someone's washing in them)
    this.dryers = [];
    for (let k = 0; this.M[`dryer.${k}`]; k++) this.dryers.push({ m: this.M[`dryer.${k}`], left: Math.random() < 0.4 ? 20 + Math.random() * 60 : 0, drum: null });
    this.folders = [null, null];
    this.folded = [];
    // the gym: the bag (its swing), the barbell, who is at each
    this.bag = null;
    this.swing = 0;
    this.swingV = 0;
    this.bar = null;
    this.at = { bag: null, bar: null };
    // the baskets carried out of the door (gone with whoever carries them)
    this.carried = [];
  }

  say(c, text, chance = 1) {
    if (c && text) this.life.say(c, text, chance);
  }

  has(svc) {
    return svc === 'wash' || svc === 'punch' || svc === 'lift' || svc === 'curl';
  }

  // (into a customer's plan) the washing - nearly everyone in a laundromat; the bag, the barbell
  plan(v, list) {
    if (this.flow === 'laundry' && this.machines.length && Math.random() < 0.85) list.splice(0, list.length, { svc: 'wash' });
    if (this.flow === 'gym') {
      if (this.M.bagAt && Math.random() < 0.5) list.splice(0, 0, { svc: 'punch' });
      if (this.M.liftAt && Math.random() < 0.45) list.push({ svc: 'lift' });
    }
  }

  // (game/shoplife.js examine) a dumbbell off the rack: curled
  decide(v) {
    const L = v.L;
    const it = L.item;
    if (!it) return false;
    const w = it.slot ? it.slot.what : it.look.line;
    if (this.flow === 'gym' && w === 'dumbbell') {
      L.svc = 'curl';
      L.S = null;
      L.st = 'svc';
      L.t = 0;
      return true;
    }
    return false;
  }

  leave(v) {
    const L = v.L;
    const c = v.c;
    c.fig.reachR = null;
    c.fig.reachL = null;
    c.fig.lookAt = null;
    c.fig.sit = 0;
    if (L.S && L.S.extra) this.life.movers.remove(L.S.extra);
    if (L.S && L.S.extra2) this.life.movers.remove(L.S.extra2);
    L.S = null;
    L.st = 'next';
    L.t = 0;
    return null;
  }

  visit(v, dt) {
    const L = v.L;
    const S = L.S || (L.S = { st: 'go', t: 0 });
    S.t += dt;
    if (L.svc === 'wash') return this.wash(v, S, dt);
    if (L.svc === 'punch') return this.punch(v, S, dt);
    if (L.svc === 'lift') return this.lift(v, S, dt);
    if (L.svc === 'curl') return this.curl(v, S, dt);
    return this.leave(v);
  }

  // ---------------------------------------------------------------- the laundromat
  wash(v, S, dt) {
    const L = v.L;
    const c = v.c;
    const f = c.fig;
    const life = this.life;
    switch (S.st) {
      case 'go': {
        // a free machine
        const free = this.machines.filter((q) => !q.v);
        if (!free.length) return this.leave(v);
        S.mc = pick(free);
        S.mc.v = v;
        S.extra = life.movers.add({ line: 'bag', model: 'laundryBag', cell: null, tint: pick([[0.86, 0.82, 0.74], [0.24, 0.5, 0.92], [0.62, 0.36, 0.82]]) }, true);
        S.extra.at = { c, how: 'carried' };
        S.st = 'toMachine';
        life.go(v, S.mc.load.x, S.mc.load.z);
        return null;
      }
      case 'toMachine': {
        const mv = life.open.follow(v);
        if (mv) return mv;
        S.st = 'load';
        S.t = 0;
        return null;
      }
      case 'load': {
        // bent to the window, the washing in by the armful; the coins; the drum starts
        const m = S.mc.m;
        c.faceYaw = Math.atan2(m.x - c.pos.x, m.z - c.pos.z);
        c.crouchW = 0.55;
        f.reachR = _a.set(m.x, m.y, m.z);
        f.reachL = _b.set(m.x + Math.sin(S.t * 6) * 0.05, m.y + 0.05, m.z);
        if (S.t > 0.6 && S.extra) {
          life.movers.remove(S.extra);
          S.extra = null;
          if (Math.random() < 0.5) this.say(c, pick(SAY.load), 0.6);
        }
        if (S.t < 3) return null;
        c.crouchW = 0;
        f.reachL = null;
        f.reachR = null;
        life.open.sound('coins', 0.3, 8);
        S.mc.left = 35 + Math.random() * 25;
        // a chair to wait on: one of the shop's seats that is free
        const seats = life.room.seats || [];
        S.seat = seats.find((q) => !q.taken) || null;
        if (S.seat) {
          S.seat.taken = v;
          S.st = 'toSeat';
          life.go(v, S.seat.x, S.seat.z);
        } else S.st = 'watch';
        S.t = 0;
        return null;
      }
      case 'toSeat': {
        const mv = life.open.follow(v);
        if (mv) return mv;
        S.st = 'sit';
        S.t = 0;
        return null;
      }
      case 'sit':
      case 'watch': {
        // sat (or stood by it) while it goes round
        if (S.st === 'sit' && S.seat) {
          c.pos.x = S.seat.x;
          c.pos.z = S.seat.z;
          c.faceYaw = S.seat.yaw;
          f.sit = Math.min(1, (f.sit || 0) + dt * 3);
        } else {
          const m = S.mc.m;
          c.faceYaw = Math.atan2(m.x - c.pos.x, m.z - c.pos.z);
        }
        if (S.t > 6 && !S.said) {
          S.said = true;
          this.say(c, pick(SAY.wait), 0.3);
        }
        if (S.mc.left > 0) return null;
        f.sit = 0;
        if (S.seat) S.seat.taken = null;
        S.st = 'toUnload';
        life.go(v, S.mc.load.x, S.mc.load.z);
        return null;
      }
      case 'toUnload': {
        const mv = life.open.follow(v);
        if (mv) return mv;
        S.st = 'unload';
        S.t = 0;
        return null;
      }
      case 'unload': {
        // the clean washing out into a basket
        const m = S.mc.m;
        c.faceYaw = Math.atan2(m.x - c.pos.x, m.z - c.pos.z);
        c.crouchW = 0.55;
        f.reachR = _a.set(m.x, m.y, m.z);
        if (S.t < 2.4) return null;
        c.crouchW = 0;
        f.reachR = null;
        S.mc.v = null;
        S.extra = life.movers.add({ line: 'basket', model: 'laundryBasket', cell: null, tint: [0.96, 0.96, 0.94], cap: pick([[0.24, 0.5, 0.92], [0.92, 0.26, 0.3], [0.96, 0.96, 0.94]]) }, true);
        S.extra.at = { c, how: 'box' };
        f.carry = 'held';
        // to the folding table, at a free place
        const k = this.folders[0] ? (this.folders[1] ? -1 : 1) : 0;
        const fm = k >= 0 ? this.M[`fold.${k}`] : null;
        if (!fm) {
          S.st = 'out';
          return null;
        }
        this.folders[k] = v;
        S.fk = k;
        S.st = 'toFold';
        life.go(v, fm.x, fm.z);
        return null;
      }
      case 'toFold': {
        const mv = life.open.follow(v);
        if (mv) return mv;
        S.st = 'fold';
        S.t = 0;
        if (S.extra) S.extra.at = { x: c.pos.x + Math.sin(c.yaw) * 0.45, y: this.M.foldTop ? this.M.foldTop.y : c.pos.y + 0.9, z: c.pos.z + Math.cos(c.yaw) * 0.45, yaw: c.yaw };
        return null;
      }
      case 'fold': {
        // shirt after shirt folded, laid one on another
        const fm = this.M[`fold.${S.fk}`];
        c.faceYaw = fm.yaw;
        const top = this.M.foldTop ? this.M.foldTop.y : c.pos.y + 0.9;
        const ph = S.t % 2.2;
        const tx = c.pos.x + Math.sin(c.yaw) * 0.35;
        const tz = c.pos.z + Math.cos(c.yaw) * 0.35;
        f.reachR = _a.set(tx + Math.cos(c.yaw) * (0.12 - ph * 0.05), top + 0.05 + Math.sin(ph * 2.8) * 0.08, tz - Math.sin(c.yaw) * (0.12 - ph * 0.05));
        f.reachL = _b.set(tx - Math.cos(c.yaw) * (0.12 - ph * 0.05), top + 0.05 + Math.sin(ph * 2.8) * 0.08, tz + Math.sin(c.yaw) * (0.12 - ph * 0.05));
        if (Math.floor(S.t / 2.2) !== Math.floor((S.t - dt) / 2.2) && (S.n = (S.n || 0) + 1) <= 5) {
          const it = life.movers.add({ line: 'folded', model: 'folded', cell: null, tint: pick([[0.24, 0.5, 0.92], [0.92, 0.26, 0.3], [0.96, 0.96, 0.94], [0.36, 0.72, 0.38], [0.12, 0.12, 0.14]]) }, true);
          it.at = { x: tx + Math.cos(c.yaw) * 0.3, y: top + (S.n - 1) * 0.035, z: tz - Math.sin(c.yaw) * 0.3, yaw: c.yaw };
          (S.piles || (S.piles = [])).push(it);
        }
        if (S.t < 11.5) return null;
        this.say(c, pick(SAY.fold), 0.5);
        f.reachR = null;
        f.reachL = null;
        // the folded washing into the basket, the basket up
        for (const it of S.piles || []) life.movers.remove(it);
        S.piles = null;
        if (S.extra) S.extra.at = { c, how: 'box' };
        this.folders[S.fk] = null;
        S.st = 'out';
        return null;
      }
      case 'out':
      default:
        // out with the basket (the shop's way out: its next is the door)
        if (S.extra) {
          S.extra.at = { c, how: 'box' };
          L.got = L.got || [];
        }
        f.carry = S.extra ? 'held' : null;
        if (S.mc && S.mc.v === v) S.mc.v = null;
        L.S = null;
        // (the basket goes with them, out of the door: gone when they are)
        if (S.extra) this.carried.push({ v, it: S.extra });
        this.life.goOut(v);
        return null;
    }
  }

  // ---------------------------------------------------------------- the gym
  punch(v, S) {
    const c = v.c;
    const f = c.fig;
    const life = this.life;
    const m = this.M.bagAt;
    const b = this.M.bag;
    if (!m || !b || (this.at.bag && this.at.bag !== v)) return this.leave(v);
    this.at.bag = v;
    if (S.st === 'go') {
      S.st = 'walk';
      life.go(v, m.x, m.z);
      return null;
    }
    if (S.st === 'walk') {
      const mv = life.open.follow(v);
      if (mv) return mv;
      S.st = 'hit';
      S.t = 0;
      return null;
    }
    // left, right: a fist out to the bag every third of a second, the bag swinging away from it
    c.faceYaw = Math.atan2(b.x - c.pos.x, b.z - c.pos.z);
    const k = Math.floor(S.t / 0.36);
    const ph = (S.t % 0.36) / 0.36;
    const out = ph < 0.4 ? ph / 0.4 : 1 - (ph - 0.4) / 0.6;
    const hx = c.pos.x + Math.sin(c.yaw) * (0.2 + out * 0.32);
    const hz = c.pos.z + Math.cos(c.yaw) * (0.2 + out * 0.32);
    const side = k % 2 ? 1 : -1;
    const hand = _a.set(hx + Math.cos(c.yaw) * side * 0.12, f.j.headC.y - 0.2, hz - Math.sin(c.yaw) * side * 0.12);
    if (side > 0) {
      f.reachR = hand;
      f.reachL = null;
    } else {
      f.reachL = hand;
      f.reachR = null;
    }
    if (k !== S.k) {
      S.k = k;
      this.swingV += 0.9;
      life.open.sound('punch', 0.18, 8);
      if (Math.random() < 0.12) this.say(c, pick(SAY.punch), 0.6);
    }
    if (S.t < 9) return null;
    this.at.bag = null;
    return this.leave(v);
  }

  lift(v, S) {
    const c = v.c;
    const f = c.fig;
    const life = this.life;
    const m = this.M.liftAt;
    const b = this.M.bar;
    if (!m || !b || (this.at.bar && this.at.bar !== v)) return this.leave(v);
    this.at.bar = v;
    if (S.st === 'go') {
      S.st = 'walk';
      life.go(v, m.x, m.z);
      return null;
    }
    if (S.st === 'walk') {
      const mv = life.open.follow(v);
      if (mv) return mv;
      S.st = 'press';
      S.t = 0;
      // the bar off its hooks, into both hands
      if (this.bar) this.bar.at = { c, how: 'bar' };
      return null;
    }
    // pressed overhead, down to the shoulders, again
    c.faceYaw = m.yaw;
    const up = 0.5 - 0.5 * Math.cos(S.t * 2.2);
    const hc = f.j.headC;
    const y = hc.y - 0.12 + up * 0.5;
    const rx = Math.cos(c.yaw);
    const rz = -Math.sin(c.yaw);
    f.reachR = _a.set(c.pos.x + rx * 0.3, y, c.pos.z + rz * 0.3);
    f.reachL = _b.set(c.pos.x - rx * 0.3, y, c.pos.z - rz * 0.3);
    if (this.bar) this.bar.at = { c, how: 'bar' };
    if (S.t > 3 && !S.said) {
      S.said = true;
      this.say(c, pick(SAY.lift), 0.6);
    }
    if (S.t < 12) return null;
    this.at.bar = null;
    return this.leave(v);
  }

  // a pair of dumbbells, curled before the mirror
  curl(v, S) {
    const L = v.L;
    const c = v.c;
    const f = c.fig;
    if (L.item) L.item.at = { c, how: 'grip' };
    if (!S.extra2 && L.item) {
      S.extra2 = this.life.movers.add({ ...L.item.look }, true);
      S.extra2.at = { c, how: 'gripL' };
    }
    const up = 0.5 - 0.5 * Math.cos(S.t * 3);
    const hc = f.j.headC;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    const rx = Math.cos(c.yaw);
    const rz = -Math.sin(c.yaw);
    const y = hc.y - 0.75 + up * 0.42;
    const fwd = 0.12 + up * 0.15;
    f.reachR = _a.set(c.pos.x + fx * fwd + rx * 0.2, y, c.pos.z + fz * fwd + rz * 0.2);
    f.reachL = _b.set(c.pos.x + fx * fwd - rx * 0.2, y, c.pos.z + fz * fwd - rz * 0.2);
    if (S.t > 2 && !S.said) {
      S.said = true;
      this.say(c, pick(SAY.curl), 0.5);
    }
    if (S.t < 8) return null;
    f.reachR = null;
    f.reachL = null;
    if (S.extra2) this.life.movers.remove(S.extra2);
    S.extra2 = null;
    L.S = null;
    L.st = 'putBack';
    L.t = 0;
    return null;
  }

  // ---------------------------------------------------------------- every frame
  update(dt) {
    this.t += dt;
    // (the baskets carried out: gone with their people)
    if (this.carried.length) {
      this.carried = this.carried.filter((q) => {
        if (q.v.c.alive && this.life.open.visitors.includes(q.v)) return true;
        this.life.movers.remove(q.it);
        return false;
      });
    }
    const P = this.game.player.pos;
    const ctr = this.life.room.center;
    const near = Math.hypot(P.x - ctr.x, P.z - ctr.z) < 30;
    // the machines: their time running down; the drum turning behind the window while it runs
    for (const q of [...this.machines, ...this.dryers]) {
      if (q.left > 0) q.left = Math.max(0, q.left - dt);
      const on = q.left > 0;
      if (on && !q.drum && near) {
        q.drum = this.life.movers.add({ line: 'drum', model: 'drum', cell: null, tint: pick([[0.24, 0.5, 0.92], [0.92, 0.26, 0.3], [0.96, 0.96, 0.94]]), cap: pick([[0.36, 0.72, 0.38], [0.98, 0.78, 0.2], [0.12, 0.12, 0.14]]) }, true);
      }
      if (q.drum && (!on || !near)) {
        this.life.movers.remove(q.drum);
        q.drum = null;
      }
      if (q.drum) q.drum.at = { x: q.m.x, y: q.m.y, z: q.m.z, yaw: q.m.yaw, roll: this.t * (q === this.dryers.find((d) => d === q) ? 3 : 5) };
    }
    // (the dryers: one starting now and then for nobody we see)
    for (const q of this.dryers) if (q.left <= 0 && Math.random() < dt * 0.004) q.left = 30 + Math.random() * 40;
    // the bag on its chain: pushed by the punches, swinging back
    const bm = this.M.bag;
    if (bm && near) {
      if (!this.bag) this.bag = this.life.movers.add({ line: 'bag', model: 'punchBag', cell: null, tint: [0.62, 0.12, 0.14] }, true);
      this.swingV -= this.swing * 9 * dt;
      this.swingV *= Math.exp(-dt * 1.4);
      this.swing += this.swingV * dt;
      // (swung from its chain at the ceiling: its foot out the way it was hit, the bag tipped back so
      // the top stays where the chain holds it)
      const by = this.at.bag ? this.at.bag.c.yaw : bm.yaw;
      const th = this.swing * 0.12;
      const d = 1.6 * Math.sin(th);
      this.bag.at = { x: bm.x + Math.sin(by) * d, y: bm.y, z: bm.z + Math.cos(by) * d, yaw: by, tilt: th, keepY: true };
    }
    // the barbell resting on its hooks when nobody has it
    const br = this.M.bar;
    if (br && near) {
      if (!this.bar) this.bar = this.life.movers.add({ line: 'bar', model: 'barbell', cell: null, tint: [0.12, 0.12, 0.14] }, true);
      if (!this.at.bar) this.bar.at = { x: br.x, y: br.y - 0.22, z: br.z, yaw: br.yaw };
    }
  }

  release(v) {
    for (const q of this.machines) if (q.v === v) q.v = null;
    for (let k = 0; k < 2; k++) if (this.folders[k] === v) this.folders[k] = null;
    if (this.at.bag === v) this.at.bag = null;
    if (this.at.bar === v) this.at.bar = null;
    const S = v.L && v.L.S;
    if (S) {
      if (S.extra) this.life.movers.remove(S.extra);
      if (S.extra2) this.life.movers.remove(S.extra2);
      for (const it of S.piles || []) this.life.movers.remove(it);
      if (S.seat && S.seat.taken === v) S.seat.taken = null;
    }
  }

  dispose() {
    for (const q of this.carried) this.life.movers.remove(q.it);
    this.carried = [];
    for (const q of [...this.machines, ...this.dryers]) if (q.drum) this.life.movers.remove(q.drum);
    if (this.bag) this.life.movers.remove(this.bag);
    if (this.bar) this.life.movers.remove(this.bar);
    this.bag = null;
    this.bar = null;
  }
}
