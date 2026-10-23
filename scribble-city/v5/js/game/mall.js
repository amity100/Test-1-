import * as THREE from 'three';
import { civilianLook, kidLook, elderLook, modest } from './looks.js';

// (v5, ROADMAP 11.17) The people of the malls. When you come near one of the mainland's malls
// (world/mainland/mall.js) its hall fills with shoppers: they come in at the doors, stroll down
// the hall, stop at a window to look, go into a store and come out with a bag in the store's
// colour (the store's own keeper sells to them: game/streetlife.js), queue at the food court's
// counters, where the cook draws what they ordered, and eat it at a table; they sit on the
// benches, look at the fountain, ride the escalator up to the gallery and stroll along it, and
// in the end walk out of the doors again. Some come in twos and keep together. When you go away
// they go too.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const BAGS = [[0.95, 0.45, 0.62], [0.32, 0.72, 0.86], [0.98, 0.78, 0.3], [0.62, 0.48, 0.86], [0.4, 0.8, 0.5], [0.98, 0.55, 0.35], [0.95, 0.95, 0.92], [0.18, 0.18, 0.22]];
const OOH = ['Ooh, look at that!', 'I love this one!', 'Too expensive...', 'Maybe next time.', 'That would look great on you!', 'On sale!', 'Hmm...'];
const CHAT = ['Where to next?', 'Let\'s get something to eat.', 'I need new shoes.', 'This mall is huge!', 'Look, an escalator!', 'One more store?', 'I\'m starving!', 'Nice bag!'];
const UP_SAY = ['Wheee, the escalator!', 'Up we go!', 'What\'s upstairs?'];
// (the hall's own people - the kiosks' sellers, the guard, the cleaner - and what is said at a kiosk)
const ASK = {
  sunglasses: ['Can I try these on?', 'How much are these?', 'Do these suit me?'],
  phones: ['Got one for my phone?', 'How much is this case?', 'A charger, please.'],
  sweets: ['A bag of those, please.', 'Mmm, which ones are best?', 'Some of the sour ones!'],
  watches: ['Can I see that one?', 'Is it waterproof?', 'How much is this watch?'],
};
const SELL = {
  sunglasses: ['They look great on you!', 'Two for one today!', 'Try the mirror!'],
  phones: ['Ten dollars, a steal!', 'This one is very popular.', 'Fits every model!'],
  sweets: ['The sour ones, fresh today!', 'Here you go, a full scoop!', 'Try one first!'],
  watches: ['A classic, that one.', 'Water-proof to fifty metres.', 'Let me get it out for you.'],
};
const CALL = {
  sunglasses: 'Sunglasses! Two for one!',
  phones: 'Phone cases! Chargers!',
  sweets: 'Sweets! Fresh sweets!',
  watches: 'Watches, best prices!',
};
const BUY = ['I\'ll take it!', 'Perfect, thanks!', 'Maybe later.', 'Just looking, thanks.'];
const MAP_SAY = ['Where is the food court?', 'Ah, there it is.', 'Second floor...', 'We are here.'];
const GUARD_SAY = ['Evening.', 'Have a nice day.', 'No running, please.', 'All quiet.'];
const KIOSK_COL = { sunglasses: [0.98, 0.6, 0.72], phones: [0.3, 0.7, 0.82], sweets: [0.98, 0.78, 0.34], watches: [0.24, 0.26, 0.32] };
// (lunch at the food court: what is on the tray, what is said over it, the tray back at the station)
const MEAL = ['burger', 'noodleBox', 'hotdog', 'burger', 'soda', 'coffee', 'noodleBox'];
const MEAL_TALK = [
  ['Want some of my fries?', 'Always!'],
  ['These noodles are so good.', 'Can I try?'],
  ['Where do we go after this?', 'The shoe store!', 'Again?'],
  ['I needed this.', 'Shopping is hard work.'],
  ['Did you see that jacket?', 'Too expensive.', 'Worth it!'],
  ['Same place next week?', 'Deal.'],
];
const TRAY_SAY = ['Thank you!', 'There.', 'All done.'];

function kioskLook(kind) {
  const L = civilianLook({ kind: pick(['casual', 'street', 'smart']) });
  L.top = { kind: 'polo', color: KIOSK_COL[kind] || [0.4, 0.5, 0.8], sleeves: L.fem ? 'long' : 'short' };
  return modest(L);
}

function guardLook() {
  const L = civilianLook({ kind: 'smart' });
  L.top = { kind: 'polo', color: [0.16, 0.17, 0.2], sleeves: L.fem ? 'long' : 'short' };
  L.bottom = L.fem ? { kind: 'wide', color: [0.13, 0.13, 0.16] } : { kind: 'pants', color: [0.13, 0.13, 0.16] };
  L.hat = { kind: 'cap', color: [0.12, 0.12, 0.15] };
  L.acc = L.fem ? ['earrings', 'belt'] : ['belt'];
  return modest(L);
}

function cleanerLook() {
  const L = civilianLook({ kind: 'casual' });
  L.top = { kind: 'polo', color: [0.2, 0.5, 0.56], sleeves: 'long' };
  L.bottom = { kind: 'pants', color: [0.3, 0.32, 0.36] };
  L.hat = { kind: 'cap', color: [0.2, 0.5, 0.56] };
  L.acc = L.fem ? ['earrings'] : [];
  return modest(L);
}

// ------------------------------------------------------------------ the way round the hall
// a walk grid over the hall (half a metre a cell), the furniture in it blocked; A* on it
class HallNav {
  constructor(collision, rect, cell = 0.5) {
    this.cell = cell;
    this.x0 = rect.x0;
    this.z0 = rect.z0;
    this.w = Math.ceil((rect.x1 - rect.x0) / cell);
    this.h = Math.ceil((rect.z1 - rect.z0) / cell);
    const n = this.w * this.h;
    this.blocked = new Uint8Array(n);
    const pad = 0.32;
    collision.forEachIn(rect.x0 - 1, rect.z0 - 1, rect.x1 + 1, rect.z1 + 1, (b) => {
      if (!b.alive || b.y0 > 1.5 || b.y1 < 0.25) return false;
      const i0 = Math.max(0, Math.floor((b.x0 - pad - this.x0) / cell));
      const i1 = Math.min(this.w - 1, Math.floor((b.x1 + pad - this.x0) / cell));
      const j0 = Math.max(0, Math.floor((b.z0 - pad - this.z0) / cell));
      const j1 = Math.min(this.h - 1, Math.floor((b.z1 + pad - this.z0) / cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.blocked[j * this.w + i] = 1;
      return false;
    });
    this.g = new Float32Array(n);
    this.from = new Int32Array(n);
    this.heap = new Int32Array(n * 8);
    this.f = new Float32Array(n);
    this.seen = new Uint32Array(n);
    this.stamp = 0;
  }

  idx(x, z) {
    const i = Math.floor((x - this.x0) / this.cell);
    const j = Math.floor((z - this.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return j * this.w + i;
  }

  free(x, z) {
    const k = this.idx(x, z);
    return k >= 0 && !this.blocked[k];
  }

  // the free cell nearest (x, z) (a ring at a time)
  near(x, z, maxR = 8) {
    const i0 = Math.floor((x - this.x0) / this.cell);
    const j0 = Math.floor((z - this.z0) / this.cell);
    for (let r = 0; r <= maxR; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = i0 + di;
          const j = j0 + dj;
          if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
          const k = j * this.w + i;
          if (!this.blocked[k]) return k;
        }
      }
    }
    return -1;
  }

  center(k) {
    return { x: this.x0 + ((k % this.w) + 0.5) * this.cell, z: this.z0 + (Math.floor(k / this.w) + 0.5) * this.cell };
  }

  // a straight walk from a to b over free cells only?
  clear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(d / (this.cell * 0.5));
    for (let s = 1; s < n; s++) {
      const t = s / n;
      if (!this.free(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  // waypoints from a to b round the furniture (straight on where nothing is in the way)
  path(ax, az, bx, bz) {
    // (a goal in the furniture: the free spot nearest it instead)
    if (!this.free(bx, bz)) {
      const k = this.near(bx, bz, 6);
      if (k >= 0) ({ x: bx, z: bz } = this.center(k));
    }
    if (this.clear(ax, az, bx, bz)) return [{ x: bx, z: bz }];
    const s = this.near(ax, az);
    const e = this.near(bx, bz);
    if (s < 0 || e < 0) return [{ x: bx, z: bz }];
    const W = this.w;
    const st = ++this.stamp;
    const heap = this.heap;
    let hn = 0;
    const ex = e % W;
    const ez = Math.floor(e / W);
    const H = (k) => {
      const dx = Math.abs((k % W) - ex);
      const dz = Math.abs(Math.floor(k / W) - ez);
      return dx + dz - 0.59 * Math.min(dx, dz);
    };
    const push = (k) => {
      let i = hn++;
      heap[i] = k;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (this.f[heap[p]] <= this.f[heap[i]]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      heap[0] = heap[--hn];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < hn && this.f[heap[l]] < this.f[heap[m]]) m = l;
        if (r < hn && this.f[heap[r]] < this.f[heap[m]]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
      return top;
    };
    this.seen[s] = st;
    this.g[s] = 0;
    this.from[s] = -1;
    this.f[s] = H(s);
    push(s);
    let found = false;
    let iter = 0;
    while (hn > 0 && iter++ < 20000) {
      const k = pop();
      if (k === e) {
        found = true;
        break;
      }
      const ki = k % W;
      const kj = Math.floor(k / W);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const i = ki + di;
          const j = kj + dj;
          if (i < 0 || j < 0 || i >= W || j >= this.h) continue;
          const q = j * W + i;
          if (this.blocked[q]) continue;
          // (no cutting a corner between two blocked cells)
          if (di && dj && (this.blocked[kj * W + i] || this.blocked[j * W + ki])) continue;
          const g = this.g[k] + (di && dj ? 1.414 : 1);
          if (this.seen[q] === st && g >= this.g[q]) continue;
          this.seen[q] = st;
          this.g[q] = g;
          this.from[q] = k;
          this.f[q] = g + H(q);
          if (hn < heap.length) push(q);
        }
      }
    }
    if (!found) return [{ x: bx, z: bz }];
    const cells = [];
    for (let k = e; k >= 0; k = this.from[k]) cells.push(k);
    cells.reverse();
    // pull the string: from each point on to the farthest one it sees
    const pts = cells.map((k) => this.center(k));
    const out = [];
    let cur = { x: ax, z: az };
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.clear(cur.x, cur.z, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]);
      cur = pts[j];
      i = j + 1;
    }
    out.push({ x: bx, z: bz });
    return out;
  }
}

// ------------------------------------------------------------------ the malls' people
export class MallLife {
  constructor(game) {
    this.game = game;
    this.active = new Map(); // mall -> { nav, people: [] }
    this.scanT = 0;
  }

  get budget() {
    // (the shoppers of the hall at once - the food court's tables on top of them on a computer)
    return this.game.touch ? 7 : 18;
  }

  update(dt) {
    const game = this.game;
    const malls = game.world.malls;
    if (!malls) return;
    const p = game.anchorPos ? game.anchorPos() : game.player.pos;
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 1;
      for (const m of malls) {
        const d = this.dist(m, p.x, p.z);
        if (d < (game.touch ? 45 : 70) && !this.active.has(m)) this.open(m);
      }
      for (const [m, st] of this.active) {
        if (!malls.includes(m) || this.dist(m, p.x, p.z) > (game.touch ? 70 : 100)) this.close(m, st);
      }
    }
    for (const [m, st] of this.active) this.tick(m, st, dt);
  }

  dist(m, x, z) {
    const r = m.rect;
    const dx = Math.max(r.x0 - x, 0, x - r.x1);
    const dz = Math.max(r.z0 - z, 0, z - r.z1);
    return Math.hypot(dx, dz);
  }

  // a mall comes near: its walk grid, and the people already in it
  open(m) {
    const game = this.game;
    const h = m.hall;
    const nav = new HallNav(game.world.collision, { x0: h.x0, z0: h.z0 - 4, x1: h.x1, z1: h.z1 + 4 });
    const st = { nav, people: [], staff: [], newT: 2, mall: m };
    this.active.set(m, st);
    const n = Math.round(this.budget * 0.75);
    for (let i = 0; i < n; i++) this.spawn(m, st, true);
    // (lunch at the food court when you come in: people at its tables already, a tray each, in twos
    // and on their own)
    if (m.food.length && m.seats.length) {
      const nEat = this.game.touch ? 2 : 6;
      for (let i = 0; i < nEat; i++) {
        const seat = this.freeSeat(st, m.seats[Math.floor(Math.random() * m.seats.length)], true);
        if (seat) this.spawn(m, st, true, { seat });
      }
    }
    // (some already on the escalator, some up on the gallery when you come in)
    if (m.escalator) {
      const lone = st.people.filter((s) => !s.follower);
      const nUp = Math.min(lone.length, this.game.touch ? 1 : 4);
      for (let i = 0; i < nUp; i++) {
        lone[i].plan.unshift({ kind: 'upstairs', pre: ['up', 'down', 'gallery', 'up'][i] });
        this.next(lone[i]);
      }
    }
    this.hire(m, st);
  }

  close(m, st) {
    for (const s of st.people) this.drop(s, true);
    st.people = [];
    for (const w of st.staff) this.game.civilians.remove(w.c);
    st.staff = [];
    for (const k of m.kiosks || []) k.busy = null;
    this.active.delete(m);
  }

  // ------------------------------------------------------------------ the hall's own people
  // a seller in each kiosk (two on a phone), the guard on the beat, the cleaner with the broom
  hire(m, st) {
    const game = this.game;
    const touch = game.touch;
    const add = (x, z, look, fn) => {
      const c = game.civilians.spawnScripted(x, z, look, this);
      const w = { c, t: Math.random() * 10, hand: new THREE.Vector3(), handL: new THREE.Vector3(), pts: null, i: 0, pause: 0 };
      c.ctrl = (civ, dt) => fn(w, dt);
      st.staff.push(w);
      return w;
    };
    for (const k of (m.kiosks || []).slice(0, touch ? 2 : 4)) {
      const w = add(k.x, k.z, kioskLook(k.kind), (q, dt) => this.vendor(q, dt));
      w.k = k;
      w.c.noCollide = true;
      w.c.yaw = k.yaw;
      w.callT = 6 + Math.random() * 20;
      k.vendor = w;
    }
    if (touch) return;
    const h = m.hall;
    const e = m.entrances[0];
    if (e) {
      const g = add(e.x + 2.5, e.zIn, guardLook(), (q, dt) => this.guard(q, dt));
      g.st = st;
      g.beat = [{ x: h.x0 + 5.6, z: h.z0 + 9 }, { x: h.x0 + 5.6, z: h.z1 - 9 }, { x: h.x1 - 5.6, z: h.z1 - 9 }, { x: h.x1 - 5.6, z: h.z0 + 9 }];
      g.c.speed = 0.95;
    }
    if (m.bins && m.bins.length) {
      const b0 = m.bins[0];
      const cl = add(b0.x + 0.8, b0.z, cleanerLook(), (q, dt) => this.cleaner(q, dt));
      cl.st = st;
      cl.c.fig.carry = 'broom';
      cl.c.speed = 0.7;
      cl.i = Math.floor(Math.random() * m.bins.length);
    }
  }

  // the seller: behind the counter, a hand at the goods (setting them straight), a look round the
  // hall, a call to the people going by; to the one who stops, a word and the thing handed over
  vendor(w, dt) {
    const c = w.c;
    const k = w.k;
    const f = c.fig;
    w.t += dt;
    if (Math.hypot(c.pos.x - k.x, c.pos.z - k.z) > 0.3) return { x: k.x, z: k.z, speed: 0.9 };
    const s = k.busy;
    if (s && s.c.alive && s.cur && s.cur.k === k && s.phase === 'at') {
      c.faceYaw = Math.atan2(s.c.pos.x - c.pos.x, s.c.pos.z - c.pos.z);
      f.lookAt = s.c.fig.j.headC;
      // (the thing held out across the counter)
      if (s.t > 2.6 && s.t < 5.4) {
        w.hand.set((c.pos.x + k.mid.x) / 2 + (s.c.pos.x - k.mid.x) * 0.15, k.mid.y + 0.25, (c.pos.z + k.mid.z) / 2 + (s.c.pos.z - k.mid.z) * 0.15);
        f.reachR = w.hand;
      } else f.reachR = null;
      return null;
    }
    f.lookAt = null;
    // setting the goods straight, now and then; otherwise a look up and down the hall
    const busy = Math.sin(w.t * 0.37) > 0.2;
    if (busy) {
      w.hand.set(k.mid.x + Math.cos(w.t * 2.1) * 0.12, k.mid.y + 0.12 + Math.sin(w.t * 3.3) * 0.08, k.mid.z + Math.sin(w.t * 0.9) * 0.5);
      f.reachR = w.hand;
      c.faceYaw = Math.atan2(k.mid.x - c.pos.x, k.mid.z - c.pos.z);
    } else {
      f.reachR = null;
      c.faceYaw = k.yaw + Math.sin(w.t * 0.25) * 0.9;
    }
    w.callT -= dt;
    if (w.callT <= 0) {
      w.callT = 18 + Math.random() * 25;
      this.say(c, CALL[k.kind] || 'Best prices!');
    }
    return null;
  }

  // the guard: a slow round of the hall, a stop at each corner of it to look round, hands behind
  // the back
  guard(w, dt) {
    const c = w.c;
    const f = c.fig;
    w.t += dt;
    if (w.pause > 0) {
      w.pause -= dt;
      c.faceYaw += Math.sin(w.t * 0.8) * dt * 0.6;
      w.hand.set(c.pos.x - f.forward.x * 0.22 + f.right.x * 0.08, c.pos.y + 0.95, c.pos.z - f.forward.z * 0.22 + f.right.z * 0.08);
      w.handL.set(c.pos.x - f.forward.x * 0.22 - f.right.x * 0.08, c.pos.y + 0.95, c.pos.z - f.forward.z * 0.22 - f.right.z * 0.08);
      f.reachR = w.hand;
      f.reachL = w.handL;
      return null;
    }
    f.reachR = null;
    f.reachL = null;
    const mv = this.walk(w);
    if (mv) {
      mv.speed = c.speed;
      return mv;
    }
    // at the corner: a look round; then on to the next
    if (w.pts) {
      w.pts = null;
      w.pause = 4 + Math.random() * 5;
      const p = this.game.player.pos;
      if (Math.hypot(p.x - c.pos.x, p.z - c.pos.z) < 6 && Math.random() < 0.5) this.say(c, pick(GUARD_SAY));
      return null;
    }
    w.i = (w.i + 1) % w.beat.length;
    const b = w.beat[w.i];
    w.pts = w.st.nav.path(c.pos.x, c.pos.z, b.x, b.z);
    w.t = 0;
    return null;
  }

  // the cleaner: from bin to bin with the broom, a sweep round each, the bag changed now and then
  cleaner(w, dt) {
    const c = w.c;
    const f = c.fig;
    const bins = w.st.mall.bins;
    w.t += dt;
    if (w.pause > 0) {
      w.pause -= dt;
      // (the broom pushed to and fro at the bin's foot; the lid lifted at the end)
      const b = bins[w.i];
      c.faceYaw = Math.atan2(b.x - c.pos.x, b.z - c.pos.z) + Math.sin(w.t * 2.4) * 0.35;
      f.reachL = w.pause < 1.2 && w.pause > 0.4 ? w.handL.set(b.x, c.pos.y + 0.95, b.z) : null;
      return null;
    }
    f.reachL = null;
    const mv = this.walk(w);
    if (mv) {
      mv.speed = c.speed;
      return mv;
    }
    if (w.pts) {
      w.pts = null;
      w.pause = 4 + Math.random() * 4;
      return null;
    }
    w.i = (w.i + 1 + Math.floor(Math.random() * 2)) % bins.length;
    const b = bins[w.i];
    w.pts = w.st.nav.path(c.pos.x, c.pos.z, b.x + 0.7, b.z + 0.4);
    w.t = 0;
    return null;
  }

  // ------------------------------------------------------------------ a shopper
  spawn(m, st, already, o = {}) {
    const game = this.game;
    const nav = st.nav;
    let x;
    let z;
    if (o.seat) {
      // (at a table of the food court, eating)
      x = o.seat.x;
      z = o.seat.z;
    } else if (o.fromUp) {
      // (down from the upper floor: at the head of the down flight)
      x = m.escalator.x0 + 2.35;
      z = m.escalator.z0 + 0.2;
    } else if (already) {
      // somewhere in the hall already
      for (let t = 0; t < 20; t++) {
        x = m.hall.x0 + 1 + Math.random() * (m.hall.x1 - m.hall.x0 - 2);
        z = m.hall.z0 + 2 + Math.random() * (m.hall.z1 - m.hall.z0 - 4);
        if (nav.free(x, z)) break;
      }
    } else {
      const e = pick(m.entrances);
      x = e.x + (Math.random() - 0.5) * 6;
      z = e.z + e.out * 1.5;
    }
    const r = Math.random();
    const look = r < 0.1 ? kidLook() : r < 0.18 ? elderLook(Math.random() < 0.5) : civilianLook({ kind: pick(['chic', 'street', 'smart', 'summer', 'knit', 'denim', 'casual', 'sporty', 'trench']) });
    const c = game.civilians.spawnScripted(x, z, look, this);
    c.speed = 1.05 + Math.random() * 0.35;
    if (r < 0.1) c.speed = 1.45;
    if (already && Math.random() < 0.5) this.giveBag(c);
    if (Math.random() < 0.15) c.fig.carry = 'phone';
    const s = { c, m, st, plan: [], cur: null, t: 0, pts: null, leaving: false };
    c.ctrl = (civ, dt) => this.step(s, dt);
    st.people.push(s);
    this.plan(s, !already);
    if (o.seat) {
      s.plan.unshift({ kind: 'eat', pre: o.seat });
      this.next(s);
    } else if (o.fromUp) {
      s.plan.unshift({ kind: 'upstairs', pre: 'down', k0: 0 });
      this.next(s);
    }
    // (a friend with them, sometimes: walking together; at the table, across from them)
    const mate = o.seat ? this.mateSeat(st, o.seat) : null;
    if ((o.seat ? mate && Math.random() < 0.6 : Math.random() < 0.3) && st.people.length < this.budget + 6) {
      const look2 = civilianLook({ kind: pick(['chic', 'street', 'smart', 'summer', 'knit', 'denim']) });
      const c2 = game.civilians.spawnScripted(mate ? mate.x : x + 0.8, mate ? mate.z : z + 0.3, look2, this);
      c2.speed = c.speed;
      if (already && Math.random() < 0.5) this.giveBag(c2);
      const f = { c: c2, m, st, plan: [], cur: null, t: 0, pts: null, lead: s, follower: true };
      c2.ctrl = (civ, dt) => this.follow(f, dt);
      s.friend = f;
      st.people.push(f);
      if (mate) {
        f.fseat = mate;
        f.sitting = true;
        c2.noCollide = true;
        c2.fig.sit = 1;
        c2.yaw = mate.yaw;
        c2.fig.carry = pick(MEAL);
      }
    }
    return s;
  }

  // a seat of the food court nobody has: near (x, z) (near: a seat, whose own table first), at a
  // table nobody sits at (empty) if there is one
  freeSeat(st, near, empty = false) {
    const m = st.mall;
    const used = new Set(this.taken(st));
    const busy = new Set();
    for (const q of used) if (q.table) busy.add(q.table);
    let best = null;
    let bd = Infinity;
    for (const q of m.seats) {
      if (used.has(q) || (empty && busy.has(q.table))) continue;
      const d = Math.hypot(q.x - near.x, q.z - near.z) + (busy.has(q.table) ? 4 : 0);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  }

  // the seat across the table from seat q (or beside it), if it is free
  mateSeat(st, q) {
    if (!q || !q.table) return null;
    const used = new Set(this.taken(st));
    let alt = null;
    for (const w of st.mall.seats) {
      if (w.table !== q.table || w === q || used.has(w)) continue;
      if (w.k === (q.k + 2) % 4) return w;
      alt = alt || w;
    }
    return alt;
  }

  giveBag(c) {
    c.fig.carryL = 'shopBag';
    c.fig.shopBagColor = pick(BAGS);
  }

  // what they do this visit: a few windows, a store or two, maybe lunch, the escalator, a bench
  plan(s, fresh) {
    const m = s.m;
    const P = [];
    const n = 2 + Math.floor(Math.random() * 3);
    // (at lunch and at dinner the food court fills: some come in for nothing else)
    const h = this.game.rhythm ? this.game.rhythm.hour : 14;
    const meal = (h > 11.5 && h < 14.5) || (h > 18 && h < 20.5);
    if (fresh && meal && m.food.length && m.seats.length && Math.random() < 0.35) P.push({ kind: 'eat' });
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      if (r < 0.28 && m.spots.length) P.push({ kind: 'window' });
      else if (r < 0.54 && m.spots.length) P.push({ kind: 'shop' });
      else if (r < 0.65 && m.food.length && m.seats.length) P.push({ kind: 'eat' });
      else if (r < 0.74 && m.kiosks && m.kiosks.length) P.push({ kind: 'kiosk' });
      else if (r < 0.84 && m.benches.length) P.push({ kind: 'bench' });
      else if (r < 0.93 && m.escalator) P.push({ kind: 'upstairs' });
      else if (r < 0.96 && m.directories && m.directories.length) P.push({ kind: 'map' });
      else if (m.fountain) P.push({ kind: 'fountain' });
      else P.push({ kind: 'window' });
    }
    P.push({ kind: 'leave' });
    s.plan = P;
    s.cur = null;
  }

  say(c, text) {
    const p = this.game.player.pos;
    if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 18) this.game.bubbles.say(c, text);
  }

  // walk the waypoints; null once there
  walk(s) {
    const c = s.c;
    const pts = s.pts;
    while (pts && pts.length) {
      const p = pts[0];
      if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) > (pts.length > 1 ? 0.5 : 0.2)) break;
      pts.shift();
    }
    if (!pts || !pts.length) return null;
    if (s.t > 40) {
      // stuck for too long: on to what is next
      pts.length = 0;
      return null;
    }
    return { x: pts[0].x, z: pts[0].z, speed: c.speed };
  }

  go(s, x, z) {
    s.pts = s.st.nav.path(s.c.pos.x, s.c.pos.z, x, z);
    s.t = 0;
  }

  // the next thing on their list, and the way to it
  next(s) {
    const m = s.m;
    const c = s.c;
    if (s.cur && s.cur.k && s.cur.k.busy === s) s.cur.k.busy = null;
    const a = s.plan.shift() || { kind: 'leave' };
    s.cur = a;
    s.t = 0;
    s.phase = 'go';
    c.fig.sit = 0;
    c.baseY = 0;
    switch (a.kind) {
      case 'window':
      case 'shop': {
        const sp = pick(m.spots);
        a.spot = sp;
        this.go(s, sp.x + (Math.random() - 0.5) * 1.2, sp.z + (Math.random() - 0.5) * 1.2);
        break;
      }
      case 'eat': {
        if (a.pre) {
          // (at the table already, the tray before them, half through the meal)
          a.seat = a.pre;
          a.step = 'eat';
          a.stay = 15 + Math.random() * 35;
          s.phase = 'at';
          s.pts = null;
          c.noCollide = true;
          c.pos.x = a.seat.x;
          c.pos.z = a.seat.z;
          c.yaw = a.seat.yaw;
          c.fig.sit = 1;
          c.fig.carry = pick(MEAL);
          break;
        }
        a.shop = pick(m.food);
        this.go(s, a.shop.door[0] + a.shop.nx * 1.5, a.shop.door[2] + a.shop.nz * 1.5);
        break;
      }
      case 'bench': {
        const used = new Set(this.taken(s.st));
        const free = m.benches.filter((b) => !used.has(b));
        if (!free.length) return this.next(s);
        a.seat = pick(free);
        this.go(s, a.seat.x + Math.sin(a.seat.yaw) * 0.5, a.seat.z + Math.cos(a.seat.yaw) * 0.5);
        break;
      }
      case 'fountain': {
        const f = m.fountain;
        const ang = Math.random() * Math.PI * 2;
        a.at = { x: f.x + Math.cos(ang) * (f.r + 0.8), z: f.z + Math.sin(ang) * (f.r + 0.8) };
        this.go(s, a.at.x, a.at.z);
        break;
      }
      case 'upstairs': {
        const e = m.escalator;
        // (the up flight is the west one)
        a.foot = { x: e.x0 + 0.85, z: e.z1 + 0.9 };
        if (a.pre) {
          // (already on it when you come by: part way up the flight, or up on a gallery)
          s.phase = 'at';
          s.pts = null;
          c.noCollide = true;
          if (a.pre === 'up') {
            a.leg = 'up';
            a.k = 0.15 + Math.random() * 0.6;
          } else if (a.pre === 'down') {
            // (on their way down from the upper floor's stores)
            a.leg = 'down';
            a.k = a.k0 !== undefined ? a.k0 : 0.1 + Math.random() * 0.6;
            c.baseY = 5.2 * (1 - a.k);
          } else {
            const h = m.hall;
            a.leg = 'stroll';
            a.side = Math.random() < 0.5 ? -1 : 1;
            a.gx = a.side < 0 ? h.x0 + 1.4 : h.x1 - 1.4;
            a.gz = e.z0 - 1.2;
            a.stroll = Math.max(h.z0 + 3, Math.min(h.z1 - 3, a.gz + (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 16)));
            c.pos.x = a.gx;
            c.pos.z = (a.gz + a.stroll) / 2;
            c.baseY = 5.2;
          }
          break;
        }
        this.go(s, a.foot.x, a.foot.z);
        break;
      }
      case 'kiosk': {
        // a kiosk with nobody at it (its seller there)
        const free = m.kiosks.filter((k) => !k.busy && k.vendor);
        if (!free.length) return this.next(s);
        a.k = pick(free);
        a.k.busy = s;
        this.go(s, a.k.cust.x, a.k.cust.z + (Math.random() - 0.5) * 0.6);
        break;
      }
      case 'map': {
        a.d = pick(m.directories);
        this.go(s, a.d.x + (Math.random() - 0.5) * 0.8, a.d.z);
        break;
      }
      default: {
        // out of the nearest door
        let best = m.entrances[0];
        for (const e of m.entrances) if (Math.abs(e.z - c.pos.z) < Math.abs(best.z - c.pos.z)) best = e;
        a.door = best;
        this.go(s, best.x + (Math.random() - 0.5) * 5, best.zIn);
        break;
      }
    }
    return null;
  }

  taken(st) {
    const out = [];
    for (const o of st.people) {
      if (o.cur && o.cur.seat) out.push(o.cur.seat);
      if (o.fseat) out.push(o.fseat);
    }
    return out;
  }

  // ------------------------------------------------------------------ every frame, for each
  step(s, dt) {
    const c = s.c;
    s.t += dt;
    if (!s.cur) return this.next(s);
    const a = s.cur;
    if (s.phase === 'go') {
      const mv = this.walk(s);
      if (mv) return mv;
      s.phase = 'at';
      s.t = 0;
    }
    switch (a.kind) {
      case 'window':
        return this.atWindow(s, a, dt);
      case 'shop':
        return this.atShop(s, a);
      case 'eat':
        return this.atFood(s, a, dt);
      case 'bench':
        return this.atBench(s, a);
      case 'fountain':
        c.faceYaw = Math.atan2(s.m.fountain.x - c.pos.x, s.m.fountain.z - c.pos.z);
        if (s.t > 0.5 && !a.said && Math.random() < 0.004) {
          a.said = true;
          this.say(c, pick(['So pretty!', 'Make a wish!', 'Look, the water!']));
        }
        if (s.t > (a.stay || (a.stay = 4 + Math.random() * 6))) this.next(s);
        return null;
      case 'upstairs':
        return this.upstairs(s, a, dt);
      case 'kiosk':
        return this.atKiosk(s, a);
      case 'map':
        return this.atMap(s, a);
      default:
        return this.atDoor(s, a);
    }
  }

  // at a kiosk: a look, a question, a thing taken up to look at (the glasses up to the face), the
  // seller's answer; bought or not, and on
  atKiosk(s, a) {
    const c = s.c;
    const f = c.fig;
    const k = a.k;
    c.faceYaw = k.cust.yaw;
    if (!a.asked && s.t > 0.8) {
      a.asked = true;
      this.say(c, pick(ASK[k.kind] || ASK.phones));
      if (k.vendor) this.game.inkwell.after(1.6, () => k.vendor && k.vendor.c.alive && this.say(k.vendor.c, pick(SELL[k.kind] || SELL.phones)));
    }
    s.hand = s.hand || new THREE.Vector3();
    if (s.t > 2.8 && s.t < 6.5) {
      // (taken from the seller's hand, held up: to the face for the glasses, before the eyes else)
      const up = k.kind === 'sunglasses' ? 1.62 : 1.25;
      const t = Math.min(1, (s.t - 2.8) / 0.8);
      const head = f.j.headC;
      s.hand.set(k.mid.x + (head.x + f.forward.x * 0.25 - k.mid.x) * t, k.mid.y + (c.pos.y + up - k.mid.y) * t, k.mid.z + (head.z + f.forward.z * 0.25 - k.mid.z) * t);
      f.reachR = s.hand;
      f.lookAt = s.hand;
    } else {
      f.reachR = null;
      f.lookAt = null;
    }
    if (s.t > 6.5 && !a.done) {
      a.done = true;
      const yes = Math.random() < 0.55;
      this.say(c, yes ? pick(BUY.slice(0, 2)) : pick(BUY.slice(2)));
      if (yes && !c.fig.carryL) this.giveBag(c);
    }
    if (s.t > 8) {
      if (k.busy === s) k.busy = null;
      f.reachR = null;
      f.lookAt = null;
      this.next(s);
    }
    return null;
  }

  // at the directory: a look at the plan, a finger on it, where to go next
  atMap(s, a) {
    const c = s.c;
    const f = c.fig;
    const d = a.d;
    c.faceYaw = d.yaw;
    s.hand = s.hand || new THREE.Vector3();
    if (s.t > 1 && s.t < 3.4) {
      s.hand.set(d.at.x + (c.pos.x - d.at.x) * 0.1 + Math.sin(s.t * 2) * 0.12, c.pos.y + 1.45 + Math.sin(s.t * 3) * 0.1, d.at.z + (c.pos.z - d.at.z) * 0.12);
      f.reachR = s.hand;
    } else f.reachR = null;
    if (!a.said && s.t > 1.5) {
      a.said = true;
      if (Math.random() < 0.5) this.say(c, pick(MAP_SAY));
    }
    if (s.t > 4.5) {
      f.reachR = null;
      this.next(s);
    }
    return null;
  }

  atWindow(s, a, dt) {
    const c = s.c;
    const sp = a.spot;
    c.faceYaw = Math.atan2(sp.window.x - c.pos.x, sp.window.z - c.pos.z);
    a.stay = a.stay || 3 + Math.random() * 5;
    // a hand up to the glass now and then, a word about what is in the window
    if (!a.said && s.t > 1 && Math.random() < dt * 0.4) {
      a.said = true;
      this.say(c, pick(OOH));
      if (s.friend) this.game.inkwell.after(1.4, () => s.friend && s.friend.c.alive && this.say(s.friend.c, pick(['Yes!', 'Totally!', 'Let\'s go in!', 'Hmm, maybe.'])));
    }
    if (s.t > a.stay) {
      c.fig.reachR = null;
      this.next(s);
    }
    return null;
  }

  // into the store: its keeper and the store's own people take over (game/streetlife.js) and give
  // them back at the door, a bag in hand
  atShop(s, a) {
    const c = s.c;
    const sh = a.spot.shop;
    if (!a.inside) {
      const open = this.game.streetlife.active.get(sh.id);
      if (!open || !open.room || !open.open || open.visitors.length >= 4 || !open.admit(c)) {
        // the store is not open (or full): a look in the window instead
        a.kind = 'window';
        return null;
      }
      a.inside = true;
      return null;
    }
    // (out again: the store let go of them, a bag in hand - its own colour, game/streetlife.js)
    if (!c.fig.carryL && Math.random() < 0.5) this.giveBag(c);
    if (Math.random() < 0.25) this.say(c, pick(['Got it!', 'Love it!', 'Shopping!', 'One more store!']));
    this.next(s);
    return null;
  }

  // lunch: a counter of the food court (its cook draws it for them), the tray carried to a table,
  // the meal eaten there - a bite, a sip, a word with whoever is across the table - and the tray
  // taken back to the station on the way out
  atFood(s, a, dt) {
    const c = s.c;
    const f = c.fig;
    if (!a.step) a.step = 'order';
    if (a.step === 'order') {
      if (!a.ordered) {
        a.ordered = true;
        const open = this.game.streetlife.active.get(a.shop.id);
        if (open && open.room && open.open && open.visitors.length < 4 && open.admit(c)) {
          a.inside = true;
          return null;
        }
      }
      // (back from the counter: the store let go of them, game/streetlife.js - or it was full)
      a.inside = false;
      const seat = this.freeSeat(s.st, c.pos, false);
      if (!seat) {
        if (f.carry !== 'phone') f.carry = null;
        this.next(s);
        return null;
      }
      a.seat = seat;
      f.carry = 'tray';
      s.pts = s.st.nav.path(c.pos.x, c.pos.z, seat.x, seat.z);
      s.t = 0;
      a.step = 'toSeat';
    }
    if (a.step === 'toSeat') {
      const mv = this.walk(s);
      if (mv) return mv;
      a.step = 'eat';
      s.t = 0;
      c.noCollide = true;
      f.carry = pick(MEAL);
    }
    if (a.step === 'eat') {
      // at the table: sit, eat, then up and the tray back
      c.pos.x = a.seat.x;
      c.pos.z = a.seat.z;
      c.faceYaw = a.seat.yaw;
      f.sit = Math.min(1, f.sit + dt * 3);
      this.bite(s, dt);
      a.stay = a.stay || 25 + Math.random() * 25;
      const fr = s.friend;
      if (fr && fr.sitting && !this.game.classic) {
        // (a word across the table now and then)
        a.talkT = (a.talkT === undefined ? 3 + Math.random() * 6 : a.talkT) - dt;
        if (a.talkT <= 0) {
          a.talkT = 12 + Math.random() * 14;
          const p = this.game.player.pos;
          if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 18 && !c.convo && !fr.c.convo) this.game.voices.talk([c, fr.c], pick(MEAL_TALK));
        }
      } else if (s.t > 2 && !a.said && Math.random() < dt * 0.15) {
        a.said = true;
        this.say(c, pick(['Mmm, so good!', 'Best burger in town.', 'I needed this.', 'Want some?']));
      }
      if (s.t < a.stay) return null;
      f.drinkT = -1;
      f.sit = 0;
      c.noCollide = false;
      a.seat = null;
      const ts = s.m.trayStations;
      if (!ts || !ts.length) {
        if (f.carry !== 'phone') f.carry = null;
        this.next(s);
        return null;
      }
      let best = ts[0];
      for (const q of ts) if (Math.hypot(q.x - c.pos.x, q.z - c.pos.z) < Math.hypot(best.x - c.pos.x, best.z - c.pos.z)) best = q;
      a.station = best;
      f.carry = 'tray';
      s.pts = s.st.nav.path(c.pos.x, c.pos.z, best.x + (Math.random() - 0.5) * 0.8, best.z);
      s.t = 0;
      a.step = 'tray';
    }
    if (a.step === 'tray') {
      const mv = this.walk(s);
      if (mv) return mv;
      // (the tray slid onto the station's top, what was on it into the flap)
      const q = a.station;
      c.faceYaw = q.yaw;
      s.hand = s.hand || new THREE.Vector3();
      if (s.t < 1.4) {
        s.hand.set(q.at.x + (c.pos.x - q.at.x) * 0.3, c.pos.y + 1.05, q.at.z + (c.pos.z - q.at.z) * 0.3);
        f.reachR = s.hand;
        return null;
      }
      f.reachR = null;
      if (f.carry === 'tray') f.carry = null;
      if (Math.random() < 0.15) this.say(c, pick(TRAY_SAY));
      this.next(s);
    }
    return null;
  }

  // a bite of what they have, a sip: the hand up to the mouth and down, a while between (o: a
  // shopper or their friend)
  bite(o, dt) {
    const f = o.c.fig;
    o.bt = (o.bt === undefined ? 1 + Math.random() * 3 : o.bt) - dt;
    if (o.bt < 0) {
      f.drinkT = Math.min(1, -o.bt / 1.1);
      if (o.bt < -1.1) {
        o.bt = 2.5 + Math.random() * 4;
        f.drinkT = -1;
      }
    }
  }

  atBench(s, a) {
    const c = s.c;
    const b = a.seat;
    c.noCollide = true;
    c.pos.x = b.x;
    c.pos.z = b.z;
    c.faceYaw = b.yaw;
    c.fig.sit = Math.min(1, c.fig.sit + 0.05);
    a.stay = a.stay || 8 + Math.random() * 16;
    if (s.t > a.stay) {
      c.fig.sit = 0;
      c.noCollide = false;
      a.seat = null;
      this.next(s);
    }
    return null;
  }

  // the escalator up, the bridge, a stroll along the gallery, the other escalator down
  upstairs(s, a, dt) {
    const c = s.c;
    const e = s.m.escalator;
    const UY = 5.2;
    const run = e.z1 - e.z0;
    if (!a.leg) {
      a.leg = 'up';
      a.k = 0;
      c.noCollide = true;
      if (Math.random() < 0.3) this.say(c, pick(UP_SAY));
    }
    const ride = (x, from, to, up) => {
      // standing on a step: carried at half a metre a second
      a.k = Math.min(1, a.k + (dt * 0.55) / run);
      const t = up ? a.k : 1 - a.k;
      c.pos.x = x;
      c.pos.z = e.z1 - run * t;
      c.baseY = UY * t;
      c.faceYaw = up ? Math.PI : 0;
      return a.k >= 1;
    };
    switch (a.leg) {
      case 'up':
        if (ride(e.x0 + 0.85, e.z1, e.z0, true)) {
          a.leg = 'bridge';
          a.side = Math.random() < 0.5 ? -1 : 1;
          const h = s.m.hall;
          a.gx = a.side < 0 ? h.x0 + 1.4 : h.x1 - 1.4;
          a.gz = e.z0 - 1.2;
          a.stroll = (e.z0 - 1.2) + (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 18);
          a.stroll = Math.max(h.z0 + 3, Math.min(h.z1 - 3, a.stroll));
        }
        return null;
      case 'bridge':
        c.baseY = UY;
        if (Math.hypot(c.pos.x - a.gx, c.pos.z - a.gz) < 0.3) {
          a.leg = 'stroll';
          s.t = 0;
        }
        return { x: a.gx, z: a.gz, speed: c.speed };
      case 'stroll':
        c.baseY = UY;
        if (Math.hypot(c.pos.x - a.gx, c.pos.z - a.stroll) < 0.3) {
          // a look in the upper floor's windows, then back
          c.faceYaw = a.side < 0 ? -Math.PI / 2 : Math.PI / 2;
          if (s.t > 4 + Math.random() * 4) {
            a.leg = 'back';
            s.t = 0;
          }
          return null;
        }
        s.t = 0;
        return { x: a.gx, z: a.stroll, speed: c.speed * 0.8 };
      case 'back':
        c.baseY = UY;
        if (Math.hypot(c.pos.x - (e.x0 + 2.35), c.pos.z - (e.z0 - 0.3)) < 0.3) {
          a.leg = 'down';
          a.k = 0;
        }
        return Math.abs(c.pos.z - a.gz) > 0.4 ? { x: a.gx, z: a.gz, speed: c.speed } : { x: e.x0 + 2.35, z: e.z0 - 0.3, speed: c.speed };
      default:
        if (ride(e.x0 + 2.35, e.z0, e.z1, false)) {
          c.baseY = 0;
          c.noCollide = false;
          c.pos.z = e.z1 + 0.6;
          this.next(s);
        }
        return null;
    }
  }

  atDoor(s, a) {
    const c = s.c;
    // out through the doors and a few steps beyond, then gone (the street's own people take over)
    if (!a.out) {
      a.out = true;
      s.pts = [{ x: c.pos.x, z: a.door.z + a.door.out * 4 }];
      s.t = 0;
      return null;
    }
    const mv = this.walk(s);
    if (mv) return mv;
    this.drop(s, false);
    return null;
  }

  // a friend: at their side wherever they go; outside a store while they shop
  follow(f, dt) {
    const c = f.c;
    const L = f.lead;
    f.t += dt;
    if (!L || !L.c.alive || L.c.owner !== this || L.gone) {
      this.drop(f, false);
      return null;
    }
    const lc = L.c;
    const a = L.cur;
    // lunch together: a seat at the same table, across from them, a meal of their own
    if (a && a.kind === 'eat' && a.seat && (a.step === 'eat' || a.step === 'toSeat')) {
      if (!f.fseat) {
        f.fseat = this.mateSeat(f.st, a.seat);
        f.pts = null;
      }
      if (f.fseat) {
        const q = f.fseat;
        if (!f.sitting) {
          if (!f.pts) {
            f.pts = f.st.nav.path(c.pos.x, c.pos.z, q.x, q.z);
            f.t = 0;
          }
          const mv = this.walk(f);
          if (mv) return mv;
          f.sitting = true;
          c.noCollide = true;
          c.fig.carry = pick(MEAL);
        }
        c.pos.x = q.x;
        c.pos.z = q.z;
        c.faceYaw = q.yaw;
        c.fig.sit = Math.min(1, c.fig.sit + dt * 3);
        this.bite(f, dt);
        return null;
      }
    }
    if (f.fseat) {
      // (the meal over: up, and after them)
      f.fseat = null;
      f.sitting = false;
      f.pts = null;
      c.fig.sit = 0;
      c.fig.drinkT = -1;
      c.noCollide = false;
      if (MEAL.includes(c.fig.carry)) c.fig.carry = null;
    }
    // with them while they sit: standing by, chatting
    if (a && (a.kind === 'bench' || a.kind === 'eat') && lc.fig.sit > 0.5) {
      const tx = lc.pos.x + Math.cos(lc.yaw) * 0.9;
      const tz = lc.pos.z - Math.sin(lc.yaw) * 0.9;
      if (Math.hypot(c.pos.x - tx, c.pos.z - tz) < 0.3) {
        c.faceYaw = Math.atan2(lc.pos.x - c.pos.x, lc.pos.z - c.pos.z);
        if (Math.random() < dt * 0.03) this.say(c, pick(CHAT));
        return null;
      }
      return { x: tx, z: tz, speed: 1.2 };
    }
    // riding the escalator: one step behind
    if (lc.baseY > 0.05) {
      c.noCollide = true;
      c.baseY = Math.max(0, lc.baseY - 0.3);
      c.pos.x = lc.pos.x;
      c.pos.z = lc.pos.z + (a && a.leg === 'down' ? -0.7 : 0.7);
      c.faceYaw = lc.yaw;
      return null;
    }
    c.baseY = 0;
    c.noCollide = false;
    // waiting outside the store
    if (lc.inside || lc.exitRoom) {
      c.faceYaw = lc.exitShop ? lc.exitShop.face + Math.PI : c.faceYaw;
      return null;
    }
    const r = lc.fig.right;
    const tx = lc.pos.x + r.x * 0.75;
    const tz = lc.pos.z + r.z * 0.75;
    const d = Math.hypot(c.pos.x - tx, c.pos.z - tz);
    if (d < 0.4) {
      c.faceYaw = lc.yaw;
      f.pts = null;
      if (Math.random() < dt * 0.02) this.say(c, pick(CHAT));
      return null;
    }
    const speed = Math.max(lc.speed, Math.hypot(lc.vel.x, lc.vel.z)) * (d > 3 ? 1.35 : 1.1);
    // (round whatever is between them, by the hall's walk grid)
    const nav = f.st.nav;
    if (d > 1.5 && !nav.clear(c.pos.x, c.pos.z, tx, tz)) {
      f.pathT = (f.pathT || 0) - dt;
      if (!f.pts || f.pathT <= 0) {
        f.pathT = 1;
        f.pts = nav.path(c.pos.x, c.pos.z, tx, tz);
        f.t = 0;
      }
      const mv = this.walk(f);
      if (mv) return { ...mv, speed };
    }
    return { x: tx, z: tz, speed };
  }

  // gone from the mall (out of the doors, or far away), or let go to the city in a fright
  drop(s, quiet) {
    const game = this.game;
    const st = s.st;
    s.gone = true;
    if (s.cur && s.cur.k && s.cur.k.busy === s) s.cur.k.busy = null;
    const i = st.people.indexOf(s);
    if (i >= 0) st.people.splice(i, 1);
    const c = s.c;
    if (!c || c.owner !== this) return;
    c.baseY = 0;
    if (quiet) game.civilians.remove(c);
    else {
      game.civilians.release(c);
      c.scripted = false;
      game.civilians.rejoin(c);
    }
  }

  // ------------------------------------------------------------------ the whole mall, each frame
  tick(m, st, dt) {
    const game = this.game;
    for (const s of st.people.slice()) {
      const c = s.c;
      if (!c.alive || c.headless) {
        this.drop(s, false);
        continue;
      }
      // a fright: they run for it (the city's own panic), and the mall lets them go
      if (c.panicT > 0) {
        c.baseY = 0;
        this.drop(s, false);
        continue;
      }
      // a store let go of them (they are out of its door, or it closed): back to their plan
      if (!s.follower && c.owner === this && !c.ctrl && !c.inside) c.ctrl = (civ, d) => this.step(s, d);
    }
    // (the hall's own people: rubbed out or frightened off, the city takes them)
    for (let i = st.staff.length - 1; i >= 0; i--) {
      const w = st.staff[i];
      const c = w.c;
      if (c.alive && !c.headless && !(c.panicT > 0) && c.owner === this) continue;
      st.staff.splice(i, 1);
      if (w.k && w.k.vendor === w) w.k.vendor = null;
      if (c.owner === this) {
        c.baseY = 0;
        game.civilians.release(c);
        c.scripted = false;
        game.civilians.rejoin(c);
      }
    }
    // new people at the doors (fewer at night: the mall's hours are the stores')
    st.newT -= dt;
    if (st.newT <= 0) {
      st.newT = 3 + Math.random() * 4;
      const R = game.rhythm;
      const h = R ? R.hour : 14;
      const open = h >= 9.5 && h < 22.5;
      const want = open ? this.budget : Math.round(this.budget * 0.2);
      // (most at the doors; some down the escalator from the upper floor's stores)
      if (st.people.length < want && m.entrances.length) this.spawn(m, st, false, { fromUp: !!m.escalator && open && Math.random() < 0.3 });
    }
  }

  clear() {
    for (const [m, st] of this.active) this.close(m, st);
  }
}
