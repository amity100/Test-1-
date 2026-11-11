import * as THREE from 'three';
import { CAR_COLORS } from '../render/cars.js';

// (v5, ROADMAP 16.8) The bookshop's, the record shop's, the toy shop's, the florist's and the hardware
// store's people at work, and what moves in them (game/shoplife.js, the flows 'books', 'records',
// 'toys', 'florist', 'hardware'):
//
// - A book taken down: opened in both hands, leafed through - its pages turning - read a while; back
//   on the shelf, or to the till.
// - A record pulled out of its crate: to the listening post, the headphones on, the head going with
//   the beat. The shop's own record turns on its player all day.
// - A bear out of the bin: hugged, squeezed (it squeaks). The train goes round its table.
// - A bunch out of its bucket: held to the nose. Bought: wrapped as a bouquet, from the counter.
// - A can of paint: the clerk puts one in the shaker now and then - it shakes, loud.
//
// And what is bought does something (game/shopper.js use): a book - the nearest blueprint's board on
// your map; a record - music in your ears; a bear, a bouquet - a gift to give at a bar; a spray can -
// your car repainted by itself when the police lose sight of you; tape, a tool - your car patched up
// by itself when it is nearly a wreck (game/player.js tick, below).

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export class HobbyLife {
  static for(life) {
    const f = life.prof && life.prof.flow;
    if (f === 'books' || f === 'records' || f === 'toys' || f === 'florist' || f === 'hardware') return new HobbyLife(life, f);
    return null;
  }

  constructor(life, flow) {
    this.life = life;
    this.game = life.game;
    this.flow = flow;
    this.M = life.marks;
    this.t = 0;
    // the record player's platter, the train's cars, the can in the shaker
    this.platter = null;
    this.cars = [];
    this.shaking = null;
    this.listener = null;
  }

  say(c, text, chance = 1) {
    if (c && text) this.life.say(c, text, chance);
  }

  has(svc) {
    return svc === 'read' || svc === 'listen' || svc === 'hug' || svc === 'smell';
  }

  plan() {}

  // (game/shoplife.js examine) what is in their hand
  decide(v) {
    const L = v.L;
    const it = L.item;
    if (!it) return false;
    const w = it.slot ? it.slot.what : it.look.line;
    const go = (svc) => {
      L.svc = svc;
      L.S = null;
      L.st = 'svc';
      L.t = 0;
      return true;
    };
    if (this.flow === 'books' && w === 'book') return go('read');
    if (this.flow === 'records' && w === 'record' && this.M.listen && !this.listener) return go('listen');
    if (this.flow === 'toys' && w === 'toy') return go('hug');
    if (this.flow === 'florist' && w === 'flowers') return go('smell');
    return false;
  }

  // the end of it: back on its shelf (walked back to it if far), or bought - one from the counter
  done(v, buy) {
    const L = v.L;
    const c = v.c;
    c.fig.reachR = null;
    c.fig.reachL = null;
    c.fig.lookAt = null;
    if (L.S && L.S.extra) this.life.movers.remove(L.S.extra);
    if (this.listener === v) this.listener = null;
    L.S = null;
    if (L.item) L.item.at = { c, how: 'grip' };
    if (buy && L.item) {
      if (this.life.prof.boxed) L.buy = L.item.look;
      else {
        // (no box: the thing itself carried to the till)
        L.got.push(L.item);
        L.item = null;
        this.say(c, pick(this.life.prof.say.keep), 0.6);
        L.st = 'afterItem';
        L.t = 0;
        return null;
      }
    }
    const s = L.slot;
    if (s && s.zx !== null && Math.hypot(s.zx - c.pos.x, s.zz - c.pos.z) > 0.6) {
      L.st = 'toRail';
      this.life.go(v, s.zx, s.zz);
    } else L.st = 'putBack';
    L.t = 0;
    return null;
  }

  visit(v, dt) {
    const L = v.L;
    const S = L.S || (L.S = { st: 'go', t: 0 });
    S.t += dt;
    const c = v.c;
    const f = c.fig;
    const hc = f.j.headC;
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    switch (L.svc) {
      case 'read': {
        // the book open in both hands before the chest, the pages turning
        if (!S.extra && L.item) {
          L.item.at = { hidden: true };
          S.extra = this.life.movers.add({ line: 'bookOpen', model: 'bookOpen', cell: null, tint: L.item.look.tint }, true);
          S.extra.at = { c, how: 'open' };
        }
        const bx = c.pos.x + fx * 0.3;
        const bz = c.pos.z + fz * 0.3;
        f.reachR = _a.set(bx + fz * 0.12, hc.y - 0.42, bz - fx * 0.12);
        f.reachL = _b.set(bx - fz * 0.12, hc.y - 0.42, bz + fx * 0.12);
        f.lookAt = _a;
        S.pg = (S.pg || 0) + dt;
        if (S.pg > 1.6) {
          S.pg = 0;
          this.life.open.sound('pageflip', 0.25, 6);
        }
        if (S.t > 1.5 && !S.said) {
          S.said = true;
          this.say(c, pick(this.life.prof.say.read), 0.5);
        }
        if (S.t < 6 + (S.k || (S.k = Math.random() * 4))) return null;
        if (L.item) L.item.at = { c, how: 'grip' };
        return this.done(v, Math.random() < 0.3);
      }
      case 'listen': {
        // to the listening post, the headphones on, the head going with the beat
        const m = this.M.listen;
        if (!m || (this.listener && this.listener !== v)) return this.done(v, false);
        this.listener = v;
        if (S.st === 'go') {
          S.st = 'walk';
          this.life.go(v, m.x, m.z);
          return null;
        }
        if (S.st === 'walk') {
          const mv = this.life.open.follow(v);
          if (mv) return mv;
          S.st = 'on';
          S.t = 0;
          S.extra = this.life.movers.add({ line: 'headphones', model: 'headphones', cell: null, tint: [0.12, 0.12, 0.14] }, true);
          S.extra.at = { c, how: 'head' };
          return null;
        }
        c.faceYaw = m.yaw;
        if (L.item) L.item.at = { c, how: 'grip' };
        f.lookAt = _a.set(hc.x + Math.sin(m.yaw) * 1.4, hc.y - 0.1 + Math.abs(Math.sin(S.t * 4.6)) * 0.3, hc.z + Math.cos(m.yaw) * 1.4);
        if (S.t > 1 && !S.said) {
          S.said = true;
          this.say(c, pick(this.life.prof.say.listen), 0.7);
        }
        if (S.t < 7) return null;
        return this.done(v, Math.random() < 0.35);
      }
      case 'hug': {
        // the bear held to the chest, squeezed: a squeak
        if (L.item) L.item.at = { c, how: 'hug' };
        f.reachR = _a.set(c.pos.x + fx * 0.22 + fz * 0.08, hc.y - 0.45, c.pos.z + fz * 0.22 - fx * 0.08);
        f.reachL = _b.set(c.pos.x + fx * 0.22 - fz * 0.08, hc.y - 0.45, c.pos.z + fz * 0.22 + fx * 0.08);
        if (S.t > 0.8 && !S.sq) {
          S.sq = true;
          this.life.open.sound('squeak', 0.4, 8);
          this.say(c, pick(this.life.prof.say.hug), 0.8);
        }
        if (S.t < 3) return null;
        return this.done(v, Math.random() < 0.3);
      }
      case 'smell': {
        // the bunch held up under the nose
        if (L.item) L.item.at = { c, how: 'grip' };
        f.reachR = _a.set(hc.x + fx * 0.12, hc.y - 0.1, hc.z + fz * 0.12);
        f.lookAt = null;
        if (S.t > 0.9 && !S.said) {
          S.said = true;
          this.say(c, pick(this.life.prof.say.smell), 0.85);
        }
        if (S.t < 3) return null;
        return this.done(v, Math.random() < 0.4);
      }
    }
    L.st = 'next';
    return null;
  }

  // the one who works there: a can into the shaker now and then (game/shoplife.js stockerWork idle)
  job(c, S) {
    if (this.flow === 'hardware' && this.M.shaker && !this.shaking && Math.random() < 0.25) {
      S.job = { kind: 'shake' };
      S.st = 'hShake';
      S.t = 0;
      const m = this.M.shakeAt;
      this.life.goS(c, m.x, m.z);
      return null;
    }
    return undefined;
  }

  staff(c, S, dt) {
    S.t += dt;
    const f = c.fig;
    if (S.st === 'hShake') {
      const mv = this.life.open.follow(S);
      if (mv) return mv;
      const m = this.M.shaker;
      c.faceYaw = Math.atan2(m.x - c.pos.x, m.z - c.pos.z);
      if (!this.shaking) {
        const col = pick(CAR_COLORS);
        const it = this.life.movers.add({ line: 'paint', model: 'paintCan', cell: null, tint: col }, true);
        it.at = { x: m.x, y: m.y, z: m.z, yaw: 0 };
        this.shaking = { it, t: 0, x: m.x, y: m.y, z: m.z, by: c };
        this.life.open.sound('drill', 0.5, 12);
      }
      f.reachR = _a.set(m.x, m.y + 0.3, m.z);
      if (S.t > 5) {
        f.reachR = null;
        this.life.movers.remove(this.shaking.it);
        this.shaking = null;
        S.st = 'idle';
        S.t = 0;
        S.job = null;
      }
      return null;
    }
    S.st = 'idle';
    return null;
  }

  letGo(S) {
    if (this.shaking && this.shaking.by === S.c) {
      this.life.movers.remove(this.shaking.it);
      this.shaking = null;
    }
  }

  // ---------------------------------------------------------------- every frame
  update(dt) {
    this.t += dt;
    const P = this.game.player.pos;
    const c = this.life.room.center;
    if (Math.hypot(P.x - c.x, P.z - c.z) > 30) return;
    // the shop's record turning (33 and a third: three and a half radians a second)
    const pm = this.M.platter;
    if (pm) {
      if (!this.platter) this.platter = this.life.movers.add({ line: 'platter', model: 'platter', cell: null, tint: [0.86, 0.24, 0.2] }, true);
      this.platter.at = { x: pm.x, y: pm.y, z: pm.z, yaw: this.t * 3.5 };
    }
    // the train going round its table
    const tm = this.M.train;
    if (tm && this.M.trainA && this.M.trainB) {
      const A = this.M.trainA;
      const B = this.M.trainB;
      const ax = A.x - tm.x;
      const az = A.z - tm.z;
      const bx = B.x - tm.x;
      const bz = B.z - tm.z;
      if (!this.cars.length) {
        const cols = [[0.86, 0.18, 0.2], [0.2, 0.42, 0.86], [0.98, 0.78, 0.2], [0.3, 0.62, 0.36]];
        for (let k = 0; k < 4; k++) this.cars.push(this.life.movers.add({ line: 'train', model: 'trainCar', cell: null, tint: cols[k], cap: k ? [0.96, 0.96, 0.94] : [0.12, 0.12, 0.14] }, true));
      }
      const w = 0.7;
      for (let k = 0; k < this.cars.length; k++) {
        const a = this.t * w - k * 0.42;
        const x = tm.x + ax * Math.cos(a) + bx * Math.sin(a);
        const z = tm.z + az * Math.cos(a) + bz * Math.sin(a);
        // (its heading: the way round the oval)
        const tx = -ax * Math.sin(a) + bx * Math.cos(a);
        const tz = -az * Math.sin(a) + bz * Math.cos(a);
        this.cars[k].at = { x, y: tm.y, z, yaw: Math.atan2(tx, tz) };
      }
    }
    // the can in the shaker, shaking
    const sh = this.shaking;
    if (sh) {
      sh.t += dt;
      sh.it.at = { x: sh.x + Math.sin(sh.t * 70) * 0.012, y: sh.y + Math.abs(Math.sin(sh.t * 55)) * 0.01, z: sh.z + Math.cos(sh.t * 63) * 0.012, yaw: 0 };
    }
  }

  release(v) {
    if (this.listener === v) this.listener = null;
    if (v.L && v.L.S && v.L.S.extra) this.life.movers.remove(v.L.S.extra);
  }

  dispose() {
    if (this.platter) this.life.movers.remove(this.platter);
    for (const it of this.cars) this.life.movers.remove(it);
    this.cars = [];
    this.platter = null;
    if (this.shaking) this.life.movers.remove(this.shaking.it);
    this.shaking = null;
  }
}

// ------------------------------------------------------------------ the hero's car, looked after
// (game/player.js, every frame) a spray can: wanted, in your car, out of their sight 3 s - repainted,
// the search lost; tape: the car nearly a wreck - patched up
export function carCare(game, dt) {
  const p = game.player;
  const v = p.inVehicle;
  if (!v) return;
  const cop = game.police;
  if (p.paintCans > 0 && cop && cop.level > 0 && game.time - cop.seenT > 3 && !(p._sprayT > game.time)) {
    p._sprayT = game.time + 8;
    p.paintCans--;
    const old = v.color || [1, 1, 1];
    const far = CAR_COLORS.filter((c) => Math.abs(c[0] - old[0]) + Math.abs(c[1] - old[1]) + Math.abs(c[2] - old[2]) > 0.6);
    const col = (far.length ? far : CAR_COLORS)[Math.floor(Math.random() * (far.length || CAR_COLORS.length))].slice();
    v.color = col;
    if (v.stock) v.stock.color = col;
    v.dirt = 0;
    if (game.vehicles && game.vehicles.dirty) game.vehicles.dirty(v);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      if (game.fx && game.fx.splash) game.fx.splash(v.pos.x + Math.cos(a) * 1.4, (v.pos.y || 0) + 1, v.pos.z + Math.sin(a) * 2.2, 4, 2, col);
    }
    game.audio.play('paint', 0.8);
    if (!(game.lose && game.lose.repainted(v))) {
      cop.drop(1);
      game.hud.toast(`ספריי הצבע: הרכב בצבע חדש, כוכב אחד פחות (נשארו ${p.paintCans})`, 'good', 2.6);
    }
  }
  if (p.tape > 0 && v.maxHp && v.hp > 0 && v.hp < v.maxHp * 0.3) {
    p.tape--;
    v.hp = Math.min(v.maxHp, v.hp + v.maxHp * 0.5);
    game.audio.play('tippex', 0.6);
    game.hud.toast(`תיקון זריז בנייר דבק: הרכב חזר לחיים (נשארו ${p.tape})`, 'good', 2.4);
  }
  void dt;
}
