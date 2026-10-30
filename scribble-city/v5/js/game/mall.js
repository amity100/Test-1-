import * as THREE from 'three';
import { civilianLook, kidLook, elderLook, modest, folkLook } from './looks.js';
import { FOLK } from '../render/folkspec.js';
import { lightList } from '../render/materials.js';
import { CURB } from '../world/mainland/plan.js';
import { MallCrowd } from './mallcrowd.js';

// (v5, ROADMAP 11.17) The people of the malls. When you come near one of the mainland's malls
// (world/mainland/mall.js) its hall fills with shoppers: they come in at the doors, stroll down
// the hall, stop at a window to look, go into a store and come out with a bag in the store's
// colour (the store's own keeper sells to them: game/streetlife.js), queue at the food court's
// counters, where the cook draws what they ordered, and eat it at a table; they sit on the
// benches, look at the fountain, ride the escalator up to the gallery and stroll along it, and
// in the end walk out of the doors again. Some come in twos and keep together. When you go away
// they go too.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
// (v5, ROADMAP 13.6) the city's people drawn as the hero is (render/folkspec.js) not about the city now:
// one of each at a time
function folkFree(game) {
  const out = [];
  for (let k = 0; k < FOLK.length; k++) if (!game.civilians.list.some((c) => c.fig && c.fig.look && c.fig.look.folk === k)) out.push(k);
  return out;
}
// (one of the ways of a mall of lanes, a bigger one the likelier: world/mainland/lanes.js)
function pickArea(list) {
  let sum = 0;
  for (const w of list) sum += (w.x1 - w.x0) * (w.z1 - w.z0);
  let t = Math.random() * sum;
  for (const w of list) {
    t -= (w.x1 - w.x0) * (w.z1 - w.z0);
    if (t <= 0) return w;
  }
  return list[list.length - 1];
}
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
  coffee: ['A latte, please.', 'One espresso, to go.', 'A cappuccino and a muffin.', 'Iced coffee, please!'],
  balloons: ['The red one, please!', 'Can I have a balloon?', 'How much is the bear?'],
};
const SELL = {
  sunglasses: ['They look great on you!', 'Two for one today!', 'Try the mirror!'],
  phones: ['Ten dollars, a steal!', 'This one is very popular.', 'Fits every model!'],
  sweets: ['The sour ones, fresh today!', 'Here you go, a full scoop!', 'Try one first!'],
  watches: ['A classic, that one.', 'Water-proof to fifty metres.', 'Let me get it out for you.'],
  coffee: ['Coming right up!', 'Name for the cup?', 'Here you go, careful, it\'s hot.'],
  balloons: ['Here you go! Hold on tight!', 'The red one, good choice.', 'Don\'t let it fly away!'],
};
const CALL = {
  sunglasses: 'Sunglasses! Two for one!',
  phones: 'Phone cases! Chargers!',
  sweets: 'Sweets! Fresh sweets!',
  watches: 'Watches, best prices!',
  coffee: 'Fresh coffee! Hot pastries!',
  balloons: 'Balloons! Balloons for the kids!',
};
const BUY = ['I\'ll take it!', 'Perfect, thanks!', 'Maybe later.', 'Just looking, thanks.'];
const MAP_SAY = ['Where is the food court?', 'Ah, there it is.', 'Second floor...', 'We are here.'];
const GUARD_SAY = ['Evening.', 'Have a nice day.', 'No running, please.', 'All quiet.'];
const KIOSK_COL = { sunglasses: [0.98, 0.6, 0.72], phones: [0.3, 0.7, 0.82], sweets: [0.98, 0.78, 0.34], watches: [0.24, 0.26, 0.32], coffee: [0.36, 0.24, 0.18], balloons: [0.56, 0.8, 0.96] };
// (what a kiosk hands over: a cup of coffee, a balloon on its string; the rest go in a bag)
const BALLOONS = [[0.95, 0.25, 0.3], [0.98, 0.82, 0.25], [0.3, 0.6, 0.95], [0.45, 0.85, 0.45], [0.95, 0.5, 0.8], [0.7, 0.45, 0.95]];
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
// (v5, ROADMAP 11.35) the teenagers who draw each other's style: two or three of them in the street's
// fashion; one draws a new jacket (a cap, the shades, sneakers...) at a friend, it flies onto them
// and their look is that now; they cheer, or not, and the next one draws
const STYLES = ['jacket', 'shirt', 'hat', 'sunglasses', 'headphones', 'shoe', 'pants'];
const STYLE_COLS = [[0.95, 0.3, 0.45], [0.2, 0.55, 0.95], [0.98, 0.78, 0.2], [0.3, 0.8, 0.5], [0.62, 0.4, 0.9], [0.98, 0.5, 0.25], [0.12, 0.12, 0.14], [0.96, 0.95, 0.92], [0.55, 0.85, 0.95]];
const CREW_SAY = {
  start: ['Hold still - I got an idea!', 'Okay, my turn to style you.', 'Trust me on this one.', 'You need a glow-up.', 'Watch this!', 'Stand still, I\'m drawing!'],
  love: ['Woah! I love it!', 'Okay that\'s FIRE.', 'Yesss!', 'I look so good!', 'Iconic.', 'Don\'t touch it, it\'s perfect.'],
  meh: ['Hmm... not my vibe.', 'Bold choice.', 'Is this a joke?', 'My mom would hate it.', 'Draw it again!'],
  friends: ['So fresh!', 'Okay, okay!', 'Post it!', 'Fit check!', 'Now do me!', 'That color though!'],
};
// a drawn thing put on: what it changes in the look
function styleOn(L, shape, col) {
  switch (shape) {
    case 'jacket':
      L.top = { kind: pick(['denim', 'puffer', 'overshirt', 'blazer']), color: col, sleeves: 'long', inner: pick([[0.96, 0.95, 0.92], [0.12, 0.12, 0.14]]) };
      break;
    case 'shirt':
      L.top = { kind: pick(['hoodie', 'sweatshirt', 'oversized']), color: col, sleeves: 'long' };
      break;
    case 'hat':
      L.hat = { kind: pick(['cap', 'bucket', 'beanie', 'capBack']), color: col };
      break;
    case 'sunglasses':
      L.face.glasses = L.face.glasses === 'shades' ? 'round' : 'shades';
      break;
    case 'headphones':
      L.acc = L.acc.includes('headphones') ? L.acc.filter((a) => a !== 'headphones') : [...L.acc, 'headphones'];
      break;
    case 'shoe':
      L.shoes = col;
      break;
    default:
      L.bottom = { kind: pick(['cargo', 'baggy', 'wide']), color: col };
  }
  modest(L);
}
// (and the painters of the artists' alley: a portrait of whoever sits for them, on the easel)
const PAINTER_SAY = ['Don\'t move... perfect.', 'Chin up a little.', 'Almost done!', 'Done! What do you think?'];
const SITTER_SAY = ['I love it!', 'Is that really me?', 'Can I keep it?', 'You made me look great!', 'Wow, thank you!'];

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

// (the mega mall's floors: its top one, the food court's - ROADMAP 11.31: five of them now, three
// before)
const topLv = (m) => (m.top !== undefined ? m.top : m.levels.length - 1);
const fcLv = (m) => (m.fcLv !== undefined ? m.fcLv : 2);

// ------------------------------------------------------------------ the way round the hall
// a walk grid over the hall (half a metre a cell), the furniture in it blocked; A* on it
class HallNav {
  // (yb: the floor it is for - the mega mall's top floor has its own; ROADMAP 11.30)
  constructor(collision, rect, cell = 0.5, yb = 0) {
    this.cell = cell;
    this.x0 = rect.x0;
    this.z0 = rect.z0;
    this.w = Math.ceil((rect.x1 - rect.x0) / cell);
    this.h = Math.ceil((rect.z1 - rect.z0) / cell);
    const n = this.w * this.h;
    this.blocked = new Uint8Array(n);
    const pad = 0.32;
    collision.forEachIn(rect.x0 - 1, rect.z0 - 1, rect.x1 + 1, rect.z1 + 1, (b) => {
      if (!b.alive || b.y0 > yb + 1.5 || b.y1 < yb + 0.25) return false;
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
    // (are you in one of them: game/streetlife.js opens more of its stores then)
    this.inside = false;
  }

  // (ROADMAP 13.4) deep in BAYVIEW's great hall - under its roof, away from its doors (all but a
  // glimpse of the street through their glass, far off): the sun reaches nothing seen from there
  // (render/pipeline.js sunIndoors)
  deepInside(p) {
    for (const m of this.active.keys()) {
      if (!m.bay) continue;
      const h = m.hall;
      if (p.x > h.x0 + 1 && p.x < h.x1 - 1 && p.z > h.z0 + 18 && p.z < h.z1 - 18 && p.y < CURB + (m.height || 30)) return true;
    }
    return false;
  }

  get budget() {
    // (the shoppers of the hall at once - the food court's tables on top of them on a computer; a
    // hall a hundred metres long takes a crowd to look busy)
    return this.game.touch ? 7 : 22;
  }

  // (the mega mall: more of them, on its floors - ROADMAP 11.30; a wing each of the two, both near
  // at once, ROADMAP 11.31)
  budgetOf(m) {
    if (!m.mega) return this.budget;
    // (ROADMAP 11.32: three halls side by side, each its own crowd - all three near at once in the
    // middle one)
    return this.game.touch ? 5 : 24;
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
      this.inside = false;
      for (const m of this.active.keys()) if (this.dist(m, p.x, p.z) < 1 && p.y < (m.height || 30)) this.inside = true;
    }
    for (const [m, st] of this.active) {
      this.tick(m, st, dt);
      if (st.crowd) st.crowd.tick(dt);
      if (m.mega) this.machines(m, st, dt);
      else if (m.sky) this.skyOf(m);
    }
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
    if (m.mega) {
      this.openMega(m, st);
      return;
    }
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
    // (and some on the benches already, a rest between the stores - a look at the phone, a word
    // with the friend standing by)
    if (m.benches.length) {
      const sitters = st.people.filter((s) => !s.follower && !s.cur);
      const nB = Math.min(sitters.length, this.game.touch ? 1 : 4);
      for (let i = 0; i < nB; i++) {
        const used = new Set(this.taken(st));
        const free = m.benches.filter((b) => !used.has(b));
        if (!free.length) break;
        sitters[i].plan.unshift({ kind: 'bench', pre: pick(free) });
        this.next(sitters[i]);
      }
    }
    this.hire(m, st);
  }

  // ------------------------------------------------------------------ (v5, ROADMAP 11.35) the style crews
  // two crews in the mall's open places (one on a phone): world/mainland/lanes.js gives its own
  // spots (mall.crewSpots); in a hall, on the ground floor either side of its court
  crews(m, st) {
    const game = this.game;
    st.crews = st.crews || [];
    const h = m.hall;
    const cx = (h.x0 + h.x1) / 2;
    const zm = m.zm || (h.z0 + h.z1) / 2;
    const spots = m.crewSpots || [{ x: cx - 7, z: zm + 15 }, { x: cx + 7, z: zm - 15 }];
    const n = game.touch ? 1 : 2;
    for (const sp0 of spots.slice(0, n)) {
      // (where there is room for them: the spot, or a little way from it)
      let sp = null;
      for (const [dx, dz] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5], [2.5, 2.5], [-2.5, -2.5]]) {
        if (st.nav.free(sp0.x + dx, sp0.z + dz) && st.nav.free(sp0.x + dx + 1, sp0.z + dz) && st.nav.free(sp0.x + dx - 1, sp0.z + dz)) {
          sp = { x: sp0.x + dx, z: sp0.z + dz };
          break;
        }
      }
      if (!sp) continue;
      const k = 2 + (Math.random() < 0.55 ? 1 : 0);
      const g = { m, members: [], x: sp.x, z: sp.z, t: 2 + Math.random() * 5, turn: Math.floor(Math.random() * 3), job: null };
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2 + Math.random() * 0.5;
        const px = sp.x + Math.sin(a) * 0.9;
        const pz = sp.z + Math.cos(a) * 0.9;
        const L = civilianLook({ kind: pick(['street', 'sporty', 'denim', 'street']) });
        // (younger: a little shorter, the street's own things on)
        L.build.height *= 0.94;
        if (Math.random() < 0.5) L.hat = { kind: pick(['cap', 'capBack', 'bucket']), color: pick(STYLE_COLS) };
        const c = game.civilians.spawnScripted(px, pz, modest(L), this);
        c.baseY = m.mega ? m.levels[0] : 0;
        const w = { c, g, i };
        c.ctrl = () => this.crewStep(w);
        g.members.push(w);
      }
      st.crews.push(g);
    }
  }

  // a member of a crew: stands with the others, turned to the middle - to the one drawing, or the
  // one drawn on
  crewStep(w) {
    const g = w.g;
    const c = w.c;
    const j = g.job;
    let tx = g.x;
    let tz = g.z;
    if (j && j.artist === w) {
      tx = j.model.c.pos.x;
      tz = j.model.c.pos.z;
    } else if (j && j.model === w) {
      tx = j.artist.c.pos.x;
      tz = j.artist.c.pos.z;
    } else if (j) {
      tx = j.model.c.pos.x;
      tz = j.model.c.pos.z;
    }
    c.faceYaw = Math.atan2(tx - c.pos.x, tz - c.pos.z);
    return null;
  }

  crewTick(g, dt) {
    const game = this.game;
    const live = g.members.filter((w) => w.c.alive && !w.c.headless && w.c.owner === this && w.c.panicT <= 0);
    if (live.length < 2) return;
    g.t -= dt;
    const j = g.job;
    if (!j) {
      if (g.t > 0) return;
      // the next one draws on another
      const artist = live[g.turn % live.length];
      const model = live[(g.turn + 1) % live.length];
      g.turn++;
      g.job = { artist, model, t: 0, shape: pick(STYLES), col: pick(STYLE_COLS), drawn: false, plopped: false };
      this.say(artist.c, pick(CREW_SAY.start));
      return;
    }
    j.t += dt;
    if (!j.drawn && j.t > 1.0) {
      j.drawn = true;
      const a = j.artist.c;
      const mc = j.model.c;
      const at = new THREE.Vector3((a.pos.x + mc.pos.x) / 2, (a.pos.y || 0) + 1.5, (a.pos.z + mc.pos.z) / 2);
      const part = j.shape === 'hat' || j.shape === 'sunglasses' || j.shape === 'headphones' ? mc.fig.j.headC : j.shape === 'shoe' ? mc.fig.j.footL : j.shape === 'pants' ? mc.fig.j.hip : mc.fig.j.neck;
      game.airsketch.draw({ shape: j.shape, at, size: 0.85, author: a, target: part.clone(), targetScale: 0.25, dur: 2.2, hold: 0.8, onPlop: () => {
        j.plopped = true;
        styleOn(mc.fig.look, j.shape, j.col);
        game.fx.sparkle ? game.fx.sparkle(mc.pos.x, (mc.pos.y || 0) + 1.2, mc.pos.z) : null;
      } });
    }
    if (j.plopped && !j.said) {
      j.said = true;
      j.saidT = j.t;
      const love = Math.random() < 0.75;
      this.say(j.model.c, pick(love ? CREW_SAY.love : CREW_SAY.meh));
      const other = live.find((w) => w !== j.model && w !== j.artist);
      if (other) j.other = other;
      j.cheer = love;
    }
    if (j.said && j.other && !j.otherSaid && j.t > j.saidT + 1.2) {
      j.otherSaid = true;
      this.say(j.other.c, pick(CREW_SAY.friends));
    }
    if ((j.said && j.t > j.saidT + 3.5) || j.t > 12) {
      g.job = null;
      g.t = 7 + Math.random() * 9;
    }
  }

  // a painter at an easel of the artists' alley: when somebody sits for them, their portrait drawn on
  // the board, a word, and it rubbed out for the next; when nobody does, a sketch of their own now
  // and then
  painter(w, dt) {
    const game = this.game;
    const e = w.e;
    const c = w.c;
    c.pos.x = e.seat.x;
    c.pos.z = e.seat.z;
    c.faceYaw = e.seat.yaw;
    c.fig.sit = 1;
    w.t += dt;
    const board = () => new THREE.Vector3(e.x, (c.pos.y || 0) + 1.33, e.z - e.face * 0.05);
    if (w.sk && w.sk.phase === 'gone') w.sk = null;
    if (e.model && e.seated && !e.done) {
      if (!w.sk && !w.portrait) {
        w.portrait = true;
        w.t = 0;
        w.sk = game.airsketch.draw({ shape: 'friend', at: board(), size: 0.62, author: c, dur: 6, keep: true, wall: { rx: -e.face, rz: 0, nx: 0, nz: -e.face } });
        if (Math.random() < 0.6) this.say(c, pick(PAINTER_SAY.slice(0, 3)));
      }
      if (w.portrait && w.t > 9) {
        this.say(c, PAINTER_SAY[3]);
        e.done = true;
        w.portrait = false;
        w.wipeT = 3;
      }
      return null;
    }
    if (w.wipeT !== undefined) {
      w.wipeT -= dt;
      if (w.wipeT <= 0) {
        if (w.sk) game.airsketch.erase(w.sk);
        w.sk = null;
        w.wipeT = undefined;
        w.t = 0;
      }
      return null;
    }
    // (nobody sitting: a sketch of their own now and then, rubbed out after a while)
    if (!e.model && !w.sk && w.t > 12 + Math.random() * 10) {
      w.t = 0;
      w.sk = game.airsketch.draw({ shape: pick(['flower', 'dog', 'house', 'heart', 'umbrella']), at: board(), size: 0.55, author: c, dur: 4, keep: true, wall: { rx: -e.face, rz: 0, nx: 0, nz: -e.face } });
    } else if (!e.model && w.sk && w.t > 10) {
      game.airsketch.erase(w.sk);
      w.sk = null;
      w.t = 0;
    }
    return null;
  }

  close(m, st) {
    // (from the end: drop() splices each one out of the list - going forward, every other one was
    // skipped and stayed behind in the city, a dozen more every time a mall was left)
    for (let i = st.people.length - 1; i >= 0; i--) this.drop(st.people[i], true);
    st.people = [];
    for (const w of st.staff) {
      if (w.sk) this.game.airsketch.erase(w.sk);
      this.game.civilians.remove(w.c);
    }
    st.staff = [];
    for (const g of st.crews || []) for (const w of g.members) this.game.civilians.remove(w.c);
    st.crews = [];
    for (const e of m.easels || []) {
      e.painter = null;
      e.model = null;
      e.seated = false;
      e.done = false;
    }
    for (const k of m.kiosks || []) k.busy = null;
    st.crowd = null;
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
    // (the painters at the artists' alley's easels: world/mainland/lanes.js)
    for (const e of (m.easels || []).slice(0, touch ? 2 : 4)) {
      const L = civilianLook({ kind: pick(['knit', 'denim', 'casual']) });
      L.top = { kind: 'overshirt', color: pick([[0.92, 0.9, 0.84], [0.5, 0.52, 0.4], [0.78, 0.6, 0.4]]), sleeves: 'long', inner: [0.96, 0.95, 0.92] };
      if (Math.random() < 0.5) L.hat = { kind: 'beanie', color: pick([[0.86, 0.3, 0.3], [0.2, 0.2, 0.24], [0.3, 0.5, 0.8]]) };
      const w = add(e.seat.x, e.seat.z, modest(L), (q, dt) => this.painter(q, dt));
      w.e = e;
      w.c.noCollide = true;
      w.c.yaw = e.seat.yaw;
      w.c.fig.sit = 1;
      w.t = Math.random() * 6;
      e.painter = w;
    }
    this.crews(m, st);
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
      g.beat = m.beat || [{ x: h.x0 + 5.6, z: h.z0 + 9 }, { x: h.x0 + 5.6, z: h.z1 - 9 }, { x: h.x1 - 5.6, z: h.z1 - 9 }, { x: h.x1 - 5.6, z: h.z0 + 9 }];
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
      // somewhere in the hall already (in the lanes, on one of the ways - not in a room: m.walk)
      for (let t = 0; t < 20; t++) {
        const w = m.walk ? pickArea(m.walk) : { x0: m.hall.x0 + 1, x1: m.hall.x1 - 1, z0: m.hall.z0 + 2, z1: m.hall.z1 - 2 };
        x = w.x0 + Math.random() * (w.x1 - w.x0);
        z = w.z0 + Math.random() * (w.z1 - w.z0);
        if (nav.free(x, z)) break;
      }
    } else {
      const e = pick(m.entrances);
      x = e.x + (Math.random() - 0.5) * 6;
      z = e.z + e.out * 1.5;
    }
    let r = Math.random();
    // (ROADMAP 13.6: one of the city's people drawn as the hero is, now and then - while they are not
    // about already)
    let folk = o.folk;
    if (folk === undefined && m.crowdSpots && Math.random() < 0.12) folk = pick(folkFree(game));
    if (folk !== undefined) r = 1;
    const look = folk !== undefined ? folkLook(folk) : r < 0.1 ? kidLook() : r < 0.18 ? elderLook(Math.random() < 0.5) : civilianLook({ kind: pick(['chic', 'street', 'smart', 'summer', 'knit', 'denim', 'casual', 'sporty', 'trench']) });
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
    if (m.mega) return this.planMega(s, fresh);
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
    // (in the lanes: a portrait at one of the artists' easels, now and then)
    if (m.easels && Math.random() < 0.25) P.splice(Math.floor(Math.random() * P.length), 0, { kind: 'portrait' });
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
    c.baseY = m.mega ? m.levels[s.lv || 0] : 0;
    switch (a.kind) {
      case 'up':
        this.upStart(s, a);
        break;
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
        if (a.pre) {
          // (sitting there already when you come in)
          a.seat = a.pre;
          s.phase = 'at';
          s.pts = null;
          c.noCollide = true;
          c.pos.x = a.seat.x;
          c.pos.z = a.seat.z;
          c.yaw = a.seat.yaw;
          c.fig.sit = 1;
          break;
        }
        const used = new Set(this.taken(s.st));
        const free = m.benches.filter((b) => !used.has(b));
        if (!free.length) return this.next(s);
        a.seat = pick(free);
        this.go(s, a.seat.x + Math.sin(a.seat.yaw) * 0.5, a.seat.z + Math.cos(a.seat.yaw) * 0.5);
        break;
      }
      case 'fountain': {
        const f = m.fountain;
        // (BAYVIEW's pool has the waterfall at its back: round the half before it)
        const ang = m.bay ? Math.PI * (1.12 + Math.random() * 0.76) : Math.random() * Math.PI * 2;
        a.at = { x: f.x + Math.cos(ang) * (f.r + 0.8), z: f.z + Math.sin(ang) * (f.r + 0.8) };
        this.go(s, a.at.x, a.at.z);
        break;
      }
      case 'car': {
        const q = pick(m.cars);
        a.car = q;
        const ang = Math.random() * Math.PI * 2;
        a.at = { x: q.x + Math.cos(ang) * (q.r + 1.5), z: q.z + Math.sin(ang) * (q.r + 1.5) };
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
      case 'portrait': {
        // (an easel with its painter at it, and nobody sitting for them)
        const free = (m.easels || []).filter((e) => e.painter && !e.model);
        if (!free.length) return this.next(s);
        a.e = pick(free);
        a.e.model = s;
        this.go(s, a.e.sit.x, a.e.sit.z);
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
      if (o.eatSeat) out.push(o.eatSeat);
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
      case 'car': {
        // (a look at it turning on its stand; a picture of it on the phone)
        c.faceYaw = Math.atan2(a.car.x - c.pos.x, a.car.z - c.pos.z);
        if (!a.snap && s.t > 1.2 && Math.random() < 0.5) {
          a.snap = true;
          a.had = c.fig.carry;
          c.fig.carry = 'phone';
        }
        if (s.t > 0.8 && !a.said && Math.random() < 0.006) {
          a.said = true;
          this.say(c, pick(['Wow, look at that car!', 'I want one!', 'Is that real gold?', 'Take my picture with it!', 'How much is it?!']));
        }
        if (s.t > (a.stay || (a.stay = 5 + Math.random() * 7))) {
          if (a.snap) c.fig.carry = a.had || null;
          this.next(s);
        }
        return null;
      }
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
      case 'up':
        return this.upMega(s, a, dt);
      case 'kiosk':
        return this.atKiosk(s, a);
      case 'map':
        return this.atMap(s, a);
      case 'portrait':
        return this.atPortrait(s, a);
      default:
        return this.atDoor(s, a);
    }
  }

  // sitting for a painter of the artists' alley: still, facing them, until the portrait is done
  atPortrait(s, a) {
    const c = s.c;
    const e = a.e;
    c.noCollide = true;
    c.pos.x = e.sit.x;
    c.pos.z = e.sit.z;
    c.faceYaw = e.sit.yaw;
    c.fig.sit = Math.min(1, c.fig.sit + 0.05);
    e.seated = c.fig.sit > 0.9;
    if (!e.done && s.t < 40) return null;
    // (up, a look at it, a word, and on)
    if (e.done && !a.said) {
      a.said = true;
      this.say(c, pick(SITTER_SAY));
    }
    if (s.t < 42 && e.done && !a.up) {
      a.up = true;
      a.upT = s.t + 1.5;
    }
    if (a.upT && s.t < a.upT) return null;
    c.fig.sit = 0;
    c.noCollide = false;
    e.model = null;
    e.seated = false;
    e.done = false;
    this.next(s);
    return null;
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
    const handed = k.kind === 'coffee' || k.kind === 'balloons';
    if (handed && s.t > 3.2 && s.t < 4.6) {
      // (a hand out across the counter for the cup, the balloon's string)
      s.hand.set(k.mid.x + (c.pos.x - k.mid.x) * 0.35, k.mid.y + 0.15, k.mid.z + (c.pos.z - k.mid.z) * 0.35);
      f.reachR = s.hand;
      f.lookAt = s.hand;
    } else if (handed) {
      f.reachR = null;
      f.lookAt = null;
    } else if (s.t > 2.8 && s.t < 6.5) {
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
    if (handed && s.t > 4.6 && !a.done) {
      // the cup, the balloon, in hand (paid at the counter: the coffee is never refused)
      a.done = true;
      if (k.kind === 'coffee') {
        if (f.carry !== 'phone' || Math.random() < 0.5) f.carry = 'coffee';
        if (Math.random() < 0.4) this.say(c, pick(['Thanks!', 'Mmm, smells great.', 'Perfect.']));
      } else {
        f.carry = 'balloon';
        f.balloonColor = pick(BALLOONS);
        if (Math.random() < 0.5) this.say(c, pick(['Yay!', 'Thank you!', 'Look, a balloon!']));
      }
    }
    if (!handed && s.t > 6.5 && !a.done) {
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
    a.stay = a.stay || (a.pre ? 10 + Math.random() * 30 : 8 + Math.random() * 16);
    // (a rest: the phone out of the pocket, a look at it)
    if (a.phone === undefined) {
      a.phone = !c.fig.carry && Math.random() < 0.45;
      if (a.phone) c.fig.carry = 'phone';
    }
    if (s.t > a.stay) {
      if (a.phone && c.fig.carry === 'phone') c.fig.carry = null;
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
      case 'stroll': {
        c.baseY = UY;
        // (half of them to the upper floor's windows, half to the gallery's rail, to lean on it and
        // look down into the hall)
        if (a.lean === undefined) {
          a.lean = Math.random() < 0.5;
          a.stay = (a.lean ? 6 : 4) + Math.random() * 5;
        }
        const h = s.m.hall;
        const tx = a.lean ? (a.side < 0 ? h.x0 + 2.2 : h.x1 - 2.2) : a.gx;
        if (Math.hypot(c.pos.x - tx, c.pos.z - a.stroll) < 0.3) {
          const f = c.fig;
          if (a.lean) {
            // both hands on the brass rail, a look down at the people below
            c.faceYaw = a.side < 0 ? Math.PI / 2 : -Math.PI / 2;
            const rx = a.side < 0 ? h.x0 + 2.58 : h.x1 - 2.58;
            s.hand = s.hand || new THREE.Vector3();
            s.handL = s.handL || new THREE.Vector3();
            s.hand.set(rx, c.pos.y + 1.04, c.pos.z + f.right.z * 0.24);
            s.handL.set(rx, c.pos.y + 1.04, c.pos.z - f.right.z * 0.24);
            f.reachR = s.hand;
            f.reachL = s.handL;
          } else c.faceYaw = a.side < 0 ? -Math.PI / 2 : Math.PI / 2;
          if (s.t > a.stay) {
            f.reachR = null;
            f.reachL = null;
            a.leg = 'back';
            s.t = 0;
          }
          return null;
        }
        s.t = 0;
        return { x: tx, z: a.stroll, speed: c.speed * 0.8 };
      }
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
    // (the mega mall: up its escalators a step behind them, beside them on its galleries, across
    // the table from them at the food court)
    if (L.m.mega && (lc.baseY > 0.05 || c.baseY > 0.05 || L.ride)) return this.followUp(f, L, dt);
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
    const q = s.cur && s.cur.stop;
    if (q && q.b && q.b.who === s) q.b.who = null;
    for (const e of s.m.easels || []) {
      if (e.model === s) {
        e.model = null;
        e.seated = false;
        e.done = false;
      }
    }
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
    if (st.crews) for (const g of st.crews) this.crewTick(g, dt);
    // (from the end: a shopper dropped is spliced out of the list as we go - no copy of it a frame)
    for (let i = st.people.length - 1; i >= 0; i--) {
      const s = st.people[i];
      if (!s) continue;
      const c = s.c;
      if (!c.alive || c.headless) {
        this.drop(s, false);
        continue;
      }
      // a fright: they run for it (the city's own panic), and the mall lets them go
      if (c.panicT > 0) {
        // (up on a floor of the mega mall: gone quietly, not dropped to the hall below)
        const up = c.baseY > 1;
        c.baseY = 0;
        this.drop(s, up);
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
      const want = open ? this.budgetOf(m) : Math.round(this.budgetOf(m) * 0.2);
      // (most at the doors; some down the escalator from the upper floor's stores; in the mega mall
      // the upper floors kept busy as well)
      if (m.mega) {
        if (st.people.length < want) {
          const ups = st.people.filter((q) => (q.lv || 0) > 0).length;
          if (open && ups < want * 0.5 && Math.random() < 0.6) this.spawnUp(m, st, 1 + Math.floor(Math.random() * topLv(m)), false);
          else if (m.entrances.length) this.spawn(m, st, false);
        }
      } else if (st.people.length < want && m.entrances.length) this.spawn(m, st, false, { fromUp: !!m.escalator && open && Math.random() < 0.3 });
    }
  }

  // ------------------------------------------------------------------ the mega mall (ROADMAP 11.30)
  // its people on its floors (five, ROADMAP 11.31): the hall's below; the galleries' above - up its escalators,
  // at the windows of the stores up there, in at their doors, at the rail looking down, on the
  // benches; lunch at the food court on the top floor - and down again and out
  openMega(m, st) {
    const game = this.game;
    const touch = game.touch;
    const B = this.budgetOf(m);
    // (the top floor's own walk grid round the food court's tables)
    if (m.fcz) st.nav2 = new HallNav(game.world.collision, { x0: m.hall.x0, z0: m.fcz[0], x1: m.hall.x1, z1: m.fcz[1] + 1 }, 0.5, CURB + m.levels[fcLv(m)]);
    // (ROADMAP 13.2: BAYVIEW's crowd, over and above them - game/mallcrowd.js)
    if (m.crowdSpots) st.crowd = new MallCrowd(game, m, st.nav);
    // (the lifts' gates: open where the cabin stands)
    for (const L of m.lifts || []) for (let k = 0; k < L.gates.length; k++) L.gates[k].alive = !(L.state === 'open' && k === L.at);
    // (ROADMAP 13.6: the city's people drawn as the hero is, each of them about the atrium already)
    if (m.crowdSpots) for (const k of folkFree(game)) this.spawn(m, st, true, { folk: k });
    const n0 = Math.round(B * 0.5);
    for (let i = 0; i < n0; i++) this.spawn(m, st, true);
    const nUp = Math.round(B * 0.3);
    for (let i = 0; i < nUp; i++) this.spawnUp(m, st, 1 + (i % topLv(m)), true);
    if (m.seats.length) {
      const nEat = touch ? 2 : 8;
      for (let i = 0; i < nEat; i++) {
        const seat = this.freeSeat(st, m.seats[Math.floor(Math.random() * m.seats.length)], true);
        if (seat) this.spawnUp(m, st, fcLv(m), true, { seat });
      }
    }
    // (some on the hall's benches already)
    if (m.benches.length) {
      const sitters = st.people.filter((q) => !q.follower && !q.cur && !(q.lv > 0));
      const nB = Math.min(sitters.length, touch ? 1 : 4);
      for (let i = 0; i < nB; i++) {
        const used = new Set(this.taken(st));
        const free = m.benches.filter((b) => !used.has(b));
        if (!free.length) break;
        sitters[i].plan.unshift({ kind: 'bench', pre: pick(free) });
        this.next(sitters[i]);
      }
    }
    this.hire(m, st);
  }

  // somebody up on floor lv (already there - along a gallery, at a table of the food court - or just
  // up an escalator)
  spawnUp(m, st, lv, already, o = {}) {
    const game = this.game;
    const y = m.levels[lv];
    let x;
    let z;
    if (o.seat) {
      x = o.seat.x;
      z = o.seat.z;
    } else if (already) {
      const g = pick(m.galleries.filter((q) => q.lv === lv));
      x = g.x + (Math.random() - 0.5) * 0.6;
      const z0 = lv === fcLv(m) && m.fcz ? Math.max(g.z0, m.fcz[1] + 1) : g.z0;
      z = z0 + Math.random() * (g.z1 - z0);
    } else {
      const f = pick(m.escalators.filter((q) => q.up && Math.abs(q.yt - CURB - y) < 0.1));
      x = (f.x0 + f.x1) / 2;
      z = f.zt + f.dir * 1.1;
    }
    const r = Math.random();
    const look = r < 0.08 ? kidLook() : r < 0.15 ? elderLook(Math.random() < 0.5) : civilianLook({ kind: pick(['chic', 'street', 'smart', 'summer', 'knit', 'denim', 'casual', 'sporty', 'trench']) });
    const c = game.civilians.spawnScripted(x, z, look, this);
    c.baseY = y;
    c.pos.y += y;
    c.noCollide = true;
    c.speed = 1.0 + Math.random() * 0.3;
    if (Math.random() < 0.55) this.giveBag(c);
    if (!o.seat && Math.random() < 0.15) c.fig.carry = 'phone';
    const s = { c, m, st, plan: [], cur: null, t: 0, pts: null, leaving: false, lv };
    c.ctrl = (civ, dt) => this.step(s, dt);
    st.people.push(s);
    const act = this.upAct(m, lv, o.seat ? ['eat', ...(Math.random() < 0.4 ? ['window'] : [])] : null);
    act.seat = o.seat || null;
    s.plan = [act, ...(Math.random() < 0.5 ? [{ kind: 'window' }] : []), { kind: 'leave' }];
    s.cur = null;
    this.next(s);
    // (in twos sometimes: at the table across from them, on the gallery at their side)
    if (Math.random() < (o.seat ? 0.5 : 0.25) && st.people.length < this.budgetOf(m) + 6) {
      const mate = o.seat ? this.mateSeat(st, o.seat) : null;
      if (o.seat && !mate) return s;
      const c2 = game.civilians.spawnScripted(mate ? mate.x : x + 0.8, mate ? mate.z : z + 0.3, civilianLook({ kind: pick(['chic', 'street', 'smart', 'summer', 'knit', 'denim']) }), this);
      c2.baseY = y;
      c2.pos.y += y;
      c2.noCollide = true;
      c2.speed = c.speed;
      if (Math.random() < 0.5) this.giveBag(c2);
      const f = { c: c2, m, st, plan: [], cur: null, t: 0, pts: null, lead: s, follower: true, lv };
      c2.ctrl = (civ, dt) => this.follow(f, dt);
      s.friend = f;
      st.people.push(f);
      if (mate) {
        f.fseat = mate;
        c2.fig.sit = 1;
        c2.yaw = mate.yaw;
        c2.fig.carry = pick(MEAL);
      }
    }
    return s;
  }

  // what they do this visit, in the mega mall
  planMega(s, fresh) {
    const m = s.m;
    const P = [];
    const n = 2 + Math.floor(Math.random() * 3);
    const h = this.game.rhythm ? this.game.rhythm.hour : 14;
    const meal = (h > 11.5 && h < 14.5) || (h > 18 && h < 20.5);
    // (at lunch and at dinner: up to the food court on the top floor)
    if (fresh && meal && m.seats.length && Math.random() < 0.35) P.push(this.upAct(m, fcLv(m), ['eat']));
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      if (r < 0.2 && m.spots.length) P.push({ kind: 'window' });
      else if (r < 0.38 && m.spots.length) P.push({ kind: 'shop' });
      else if (r < 0.64) P.push(this.upAct(m, 1 + Math.floor(Math.random() * topLv(m))));
      else if (r < 0.73 && m.kiosks && m.kiosks.length) P.push({ kind: 'kiosk' });
      else if (r < 0.83 && m.benches.length) P.push({ kind: 'bench' });
      else if (r < 0.89 && m.directories && m.directories.length) P.push({ kind: 'map' });
      // (ROADMAP 13.2: BAYVIEW MALL's cars on their stands - a look, a picture)
      else if (r < 0.95 && m.cars && m.cars.length) P.push({ kind: 'car' });
      else P.push({ kind: 'fountain' });
    }
    P.push({ kind: 'leave' });
    s.plan = P;
    s.cur = null;
  }

  // a visit upstairs: up to floor lv, a few things there, and down again
  upAct(m, lv, stops = null) {
    if (!stops) {
      stops = [];
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const r = Math.random();
        stops.push(r < 0.34 ? 'window' : r < 0.6 ? 'shop' : r < 0.78 ? 'rail' : r < 0.9 ? 'bench' : lv === fcLv(m) && m.seats.length ? 'eat' : 'rail');
      }
    }
    return { kind: 'up', target: lv, stops };
  }

  upStart(s, a) {
    s.phase = 'at';
    s.pts = null;
    a.step = null;
    s.c.noCollide = (s.lv || 0) > 0;
  }

  // the visit upstairs, a leg at a time: to an escalator, up it, the stops, down again
  upMega(s, a, dt) {
    const m = s.m;
    const c = s.c;
    if (s.ride) {
      if (this.rideStep(s, dt)) {
        const f = s.ride.f;
        const down = s.ride.down;
        s.ride = null;
        s.lv = (s.lv || 0) + (down ? -1 : 1);
        c.baseY = m.levels[s.lv];
        c.noCollide = s.lv > 0;
        // (a pace off the end onto the floor)
        const xc = (f.x0 + f.x1) / 2;
        s.pts = [down ? { x: xc, z: f.zf - f.dir * 1.2 } : { x: xc, z: f.zt + f.dir * 1.2 }];
        s.t = 0;
        a.step = 'off';
      }
      return null;
    }
    if (s.pts && s.pts.length) {
      const mv = this.walk(s);
      if (mv) return mv;
    }
    if (a.step === 'toFlight') {
      s.ride = { f: a.flight, k: 0, down: a.down };
      c.noCollide = true;
      if (!a.down && Math.random() < 0.12) this.say(c, pick(UP_SAY));
      return null;
    }
    if (a.step === 'toLift') {
      // at the lift's gate: waiting for it to come and open here
      const L = a.lift;
      c.faceYaw = Math.atan2(L.x - c.pos.x, L.z - c.pos.z);
      if (L.state === 'open' && L.at === (s.lv || 0) && L.t < 3.4) {
        a.step = 'inLift';
        s.pts = [{ x: L.x + L.side * 0.25 + (Math.random() - 0.5) * 0.5, z: L.z + (Math.random() - 0.5) * 0.9 }];
        s.t = 0;
        c.noCollide = true;
      }
      return null;
    }
    if (a.step === 'inLift') {
      // in its cabin, riding it to the floor they want; out at its gate
      const L = a.lift;
      c.baseY = L.y;
      c.faceYaw = Math.atan2(-L.side, 0) + Math.sin(s.t * 0.3) * 0.8;
      if (L.state === 'open' && L.at === a.toLv) {
        s.lv = a.toLv;
        c.baseY = m.levels[s.lv];
        a.step = 'off';
        s.pts = [{ x: L.x + L.side * (L.r + 1.3), z: L.z + (Math.random() - 0.5) * 1.0 }];
        s.t = 0;
        c.noCollide = s.lv > 0;
      }
      return null;
    }
    if (a.step === 'stop' && a.stop) {
      if (!this.upStop(s, a, a.stop, dt)) return null;
      a.stop = null;
    }
    const lv = s.lv || 0;
    // (up and down by the escalators, or now and then by one of the glass lifts)
    if (lv < a.target) {
      if (!(Math.random() < 0.3 && this.toLift(s, a, false))) this.toFlight(s, a, false);
      return null;
    }
    while (a.stops.length) {
      a.stop = { kind: a.stops.shift(), t: 0 };
      if (this.upStopGo(s, a, a.stop)) {
        a.step = 'stop';
        return null;
      }
      a.stop = null;
    }
    if (lv > 0) {
      if (!(Math.random() < 0.3 && this.toLift(s, a, true))) this.toFlight(s, a, true);
      return null;
    }
    c.noCollide = false;
    this.next(s);
    return null;
  }

  // to the nearest glass lift's gate on this floor (false: there is none)
  toLift(s, a, down) {
    const lifts = s.m.lifts || [];
    if (!lifts.length) return false;
    const c = s.c;
    let best = null;
    let bd = Infinity;
    for (const L of lifts) {
      const d = Math.hypot(L.x - c.pos.x, L.z - c.pos.z);
      if (d < bd) {
        bd = d;
        best = L;
      }
    }
    a.lift = best;
    a.toLv = (s.lv || 0) + (down ? -1 : 1);
    a.step = 'toLift';
    this.goLv(s, best.x + best.side * (best.r + 1.1), best.z + (Math.random() - 0.5) * 1.4);
    return true;
  }

  // on an escalator: carried along it, its steps under the feet
  rideStep(s, dt) {
    const R = s.ride;
    const f = R.f;
    const c = s.c;
    R.k = Math.min(1, R.k + (dt * 0.6) / f.run);
    const along = R.down ? 1 - R.k : R.k;
    c.pos.x = (f.x0 + f.x1) / 2;
    c.pos.z = f.zf + f.dir * f.run * along;
    c.baseY = f.yf - CURB + f.rise * along;
    c.faceYaw = (R.down ? -f.dir : f.dir) > 0 ? 0 : Math.PI;
    return R.k >= 1;
  }

  // to the nearest flight going the way they want from the floor they are on
  toFlight(s, a, down) {
    const m = s.m;
    const c = s.c;
    const y = CURB + m.levels[s.lv || 0];
    let best = null;
    let bd = Infinity;
    for (const f of m.escalators) {
      if (f.up === down) continue;
      if (Math.abs((down ? f.yt : f.yf) - y) > 0.1) continue;
      const ez = down ? f.zt + f.dir * 0.8 : f.zf - f.dir * 0.8;
      const d = Math.hypot((f.x0 + f.x1) / 2 - c.pos.x, ez - c.pos.z);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    if (!best) {
      c.noCollide = false;
      this.next(s);
      return null;
    }
    a.flight = best;
    a.down = down;
    a.step = 'toFlight';
    this.goLv(s, (best.x0 + best.x1) / 2, down ? best.zt + best.dir * 0.8 : best.zf - best.dir * 0.8);
    return null;
  }

  // a walk on the floor they are on: round the hall's furniture below, round the food court's tables
  // on the top floor, along the galleries and over the bridges between
  goLv(s, x, z) {
    const lv = s.lv || 0;
    const c = s.c;
    const m = s.m;
    if (lv === 0) s.pts = s.st.nav.path(c.pos.x, c.pos.z, x, z);
    else if (lv === fcLv(m) && s.st.nav2 && m.fcz && z < m.fcz[1] - 0.5 && c.pos.z < m.fcz[1] - 0.5) s.pts = s.st.nav2.path(c.pos.x, c.pos.z, x, z);
    else s.pts = this.upWay(m, lv, c.pos, { x, z });
    s.t = 0;
  }

  upWay(m, lv, a, b) {
    // (ROADMAP 13.2: round BAYVIEW's oval - along the line in front of the stores on its side, to
    // the other side round by the nearer end)
    if (m.oval) {
      const h = m.hall;
      const lx = (p) => (p.x < m.oval.cx ? h.x0 + 1.4 : h.x1 - 1.4);
      const la = lx(a);
      const lb = lx(b);
      if (la === lb) return [{ x: la, z: a.z }, { x: la, z: b.z }, { x: b.x, z: b.z }];
      const zs = m.bridges.filter((br) => br.lv.includes(lv)).map((br) => (br.z0 + br.z1) / 2);
      let zb = zs[0];
      for (const z of zs) if (Math.abs(a.z - z) + Math.abs(b.z - z) < Math.abs(a.z - zb) + Math.abs(b.z - zb)) zb = z;
      return [{ x: la, z: a.z }, { x: la, z: zb }, { x: lb, z: zb }, { x: lb, z: b.z }, { x: b.x, z: b.z }];
    }
    const h = m.hall;
    const gW = h.x0 + 1.1;
    const gE = h.x1 - 1.1;
    const lineOf = (p) => (Math.abs(p.x - gW) < 1.9 ? gW : Math.abs(p.x - gE) < 1.9 ? gE : null);
    const fc = lv === fcLv(m) && m.fcz ? m.fcz[1] : -Infinity;
    const la = lineOf(a);
    const lb = lineOf(b);
    if ((la !== null && la === lb) || (a.z < fc && b.z < fc)) return [{ x: b.x, z: b.z }];
    const zs = m.bridges.filter((br) => br.lv.includes(lv)).map((br) => (br.z0 + br.z1) / 2);
    if (lv === fcLv(m) && m.fcz) zs.push(m.fcz[1] - 1.5);
    let zb = zs[0];
    let bd = Infinity;
    for (const z of zs) {
      const d = Math.abs(a.z - z) + Math.abs(b.z - z);
      if (d < bd) {
        bd = d;
        zb = z;
      }
    }
    // (not through a column where the bridge meets the gallery)
    if (m.colZ) {
      const k = (((zb - m.colZ.z0) % m.colZ.step) + m.colZ.step) % m.colZ.step;
      if (k < 0.8) zb += 1.0;
      else if (k > m.colZ.step - 0.8) zb -= 1.0;
    }
    return [{ x: la !== null ? la : a.x, z: zb }, { x: lb !== null ? lb : b.x, z: zb }, { x: b.x, z: b.z }];
  }

  // a stop upstairs: off to it (false: there is nowhere for it)
  upStopGo(s, a, q) {
    const m = s.m;
    const lv = s.lv || 0;
    const c = s.c;
    switch (q.kind) {
      case 'window':
      case 'shop': {
        const list = m.upSpots.filter((sp) => sp.lv === lv);
        if (!list.length) return false;
        q.spot = pick(list);
        this.goLv(s, q.spot.x + (Math.random() - 0.5) * 0.8, q.spot.z + (Math.random() - 0.5) * 0.8);
        return true;
      }
      case 'rail': {
        const gs = m.galleries.filter((g) => g.lv === lv);
        if (!gs.length) return false;
        const g = pick(gs);
        const z0 = lv === fcLv(m) && m.fcz ? Math.max(g.z0, m.fcz[1] + 1) : g.z0;
        q.g = g;
        const z = z0 + Math.random() * (g.z1 - z0);
        this.goLv(s, m.railX ? m.railX(g.side, z) + g.side * 0.32 : g.rx, z);
        return true;
      }
      case 'bench': {
        const free = (m.upBenches || []).filter((b) => b.lv === lv && !b.who);
        if (!free.length) return false;
        q.b = pick(free);
        q.b.who = s;
        this.goLv(s, q.b.x + Math.sin(q.b.yaw) * 0.6, q.b.z + Math.cos(q.b.yaw) * 0.6);
        return true;
      }
      case 'eat': {
        if (lv !== fcLv(m) || !m.seats.length) return false;
        const seat = a.seat || this.freeSeat(s.st, c.pos, false);
        if (!seat) return false;
        q.seat = seat;
        s.eatSeat = seat;
        if (a.seat) {
          // (at the table already, half through the meal)
          a.seat = null;
          q.state = 'eat';
          q.stay = 10 + Math.random() * 30;
          s.eating = true;
          c.pos.x = seat.x;
          c.pos.z = seat.z;
          c.yaw = seat.yaw;
          c.fig.sit = 1;
          c.fig.carry = pick(MEAL);
          s.pts = null;
          return true;
        }
        // (a tray from a counter, carried to the table)
        c.fig.carry = 'tray';
        q.state = 'toSeat';
        this.goLv(s, seat.x, seat.z);
        return true;
      }
    }
    return false;
  }

  // at a stop upstairs: true once it is over
  upStop(s, a, q, dt) {
    const m = s.m;
    const c = s.c;
    const f = c.fig;
    q.t += dt;
    switch (q.kind) {
      case 'window': {
        c.faceYaw = Math.atan2(q.spot.window.x - c.pos.x, q.spot.window.z - c.pos.z);
        q.stay = q.stay || 3 + Math.random() * 5;
        if (!q.said && q.t > 1 && Math.random() < dt * 0.4) {
          q.said = true;
          this.say(c, pick(OOH));
        }
        return q.t > q.stay;
      }
      case 'shop': {
        if (!q.inside) {
          const open = this.game.streetlife.active.get(q.spot.shop.id);
          if (!open || !open.room || !open.open || open.visitors.length >= 4 || !open.admit(c)) {
            // (closed, or full: a look in the window instead)
            q.kind = 'window';
            q.t = 0;
            return false;
          }
          q.inside = true;
          return false;
        }
        // (out of its door again, a bag in hand)
        if (!f.carryL && Math.random() < 0.5) this.giveBag(c);
        c.baseY = m.levels[s.lv || 0];
        c.noCollide = true;
        return true;
      }
      case 'rail': {
        const g = q.g;
        q.stay = q.stay || 5 + Math.random() * 6;
        c.faceYaw = g.side < 0 ? Math.PI / 2 : -Math.PI / 2;
        const rx = m.railX ? m.railX(g.side, c.pos.z) : g.side < 0 ? m.void.x0 : m.void.x1;
        s.hand = s.hand || new THREE.Vector3();
        s.handL = s.handL || new THREE.Vector3();
        s.hand.set(rx, c.pos.y + 1.04, c.pos.z - g.side * 0.24);
        s.handL.set(rx, c.pos.y + 1.04, c.pos.z + g.side * 0.24);
        f.reachR = s.hand;
        f.reachL = s.handL;
        if (!q.said && q.t > 2 && Math.random() < dt * 0.15) {
          q.said = true;
          this.say(c, pick(['What a view!', 'Look at the fountain!', 'This place is huge!', 'So many people...']));
        }
        if (q.t > q.stay) {
          f.reachR = null;
          f.reachL = null;
          return true;
        }
        return false;
      }
      case 'bench': {
        const b = q.b;
        c.pos.x = b.x;
        c.pos.z = b.z;
        c.faceYaw = b.yaw;
        f.sit = Math.min(1, f.sit + dt * 3);
        q.stay = q.stay || 8 + Math.random() * 14;
        if (q.phone === undefined) {
          q.phone = !f.carry && Math.random() < 0.45;
          if (q.phone) f.carry = 'phone';
        }
        if (q.t > q.stay) {
          if (q.phone && f.carry === 'phone') f.carry = null;
          f.sit = 0;
          b.who = null;
          return true;
        }
        return false;
      }
      case 'eat': {
        if (q.state === 'toSeat') {
          q.state = 'eat';
          q.t = 0;
          q.stay = 20 + Math.random() * 25;
          s.eating = true;
          f.carry = pick(MEAL);
        }
        if (q.state === 'eat') {
          c.pos.x = q.seat.x;
          c.pos.z = q.seat.z;
          c.faceYaw = q.seat.yaw;
          f.sit = Math.min(1, f.sit + dt * 3);
          this.bite(s, dt);
          const fr = s.friend;
          if (fr && fr.fseat && !this.game.classic) {
            q.talkT = (q.talkT === undefined ? 3 + Math.random() * 6 : q.talkT) - dt;
            if (q.talkT <= 0) {
              q.talkT = 12 + Math.random() * 14;
              const p = this.game.player.pos;
              if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 18 && Math.abs(c.pos.y - p.y) < 3 && !c.convo && !fr.c.convo) this.game.voices.talk([c, fr.c], pick(MEAL_TALK));
            }
          }
          if (q.t < q.stay) return false;
          f.sit = 0;
          f.drinkT = -1;
          s.eating = false;
          s.eatSeat = null;
          const ts = m.trayStations || [];
          if (!ts.length) {
            if (f.carry !== 'phone') f.carry = null;
            return true;
          }
          let best = ts[0];
          for (const t of ts) if (Math.hypot(t.x - c.pos.x, t.z - c.pos.z) < Math.hypot(best.x - c.pos.x, best.z - c.pos.z)) best = t;
          q.station = best;
          f.carry = 'tray';
          q.state = 'tray';
          q.t = 0;
          this.goLv(s, best.x + (Math.random() - 0.5) * 0.8, best.z);
          return false;
        }
        if (q.state === 'tray') {
          const t = q.station;
          c.faceYaw = t.yaw;
          s.hand = s.hand || new THREE.Vector3();
          if (q.t < 1.4) {
            s.hand.set(t.at.x + (c.pos.x - t.at.x) * 0.3, c.pos.y + 1.05, t.at.z + (c.pos.z - t.at.z) * 0.3);
            f.reachR = s.hand;
            return false;
          }
          f.reachR = null;
          if (f.carry === 'tray') f.carry = null;
          if (Math.random() < 0.15) this.say(c, pick(TRAY_SAY));
          return true;
        }
        return true;
      }
    }
    return true;
  }

  // a friend up there with them: a step behind on the escalator, at their side on the gallery,
  // across the table at the food court, outside the store while they are in it
  followUp(f, L, dt) {
    const c = f.c;
    const lc = L.c;
    c.noCollide = true;
    const R = L.ride;
    if (R) {
      if (f.fseat) f.fseat = null;
      const fl = R.f;
      const k = Math.max(0, R.k - 0.08);
      const along = R.down ? 1 - k : k;
      c.pos.x = (fl.x0 + fl.x1) / 2;
      c.pos.z = fl.zf + fl.dir * fl.run * along;
      c.baseY = fl.yf - CURB + fl.rise * along;
      c.faceYaw = (R.down ? -fl.dir : fl.dir) > 0 ? 0 : Math.PI;
      c.fig.sit = 0;
      return null;
    }
    c.baseY = lc.baseY;
    if (L.eating && L.eatSeat) {
      if (!f.fseat) f.fseat = this.mateSeat(f.st, L.eatSeat);
      if (f.fseat) {
        const q = f.fseat;
        c.pos.x = q.x;
        c.pos.z = q.z;
        c.faceYaw = q.yaw;
        c.fig.sit = Math.min(1, c.fig.sit + dt * 3);
        if (!MEAL.includes(c.fig.carry)) c.fig.carry = pick(MEAL);
        this.bite(f, dt);
        return null;
      }
    } else if (f.fseat) {
      f.fseat = null;
      c.fig.sit = 0;
      c.fig.drinkT = -1;
      if (MEAL.includes(c.fig.carry)) c.fig.carry = null;
    }
    if (lc.inside || lc.exitRoom || lc.fig.sit > 0.5) {
      // (waiting outside the store, standing by the bench)
      if (lc.fig.sit > 0.5) c.faceYaw = Math.atan2(lc.pos.x - c.pos.x, lc.pos.z - c.pos.z);
      return null;
    }
    const r = lc.fig.right;
    const tx = lc.pos.x + r.x * 0.75;
    const tz = lc.pos.z + r.z * 0.75;
    const d = Math.hypot(c.pos.x - tx, c.pos.z - tz);
    if (d < 0.4) {
      c.faceYaw = lc.yaw;
      if (Math.random() < dt * 0.02) this.say(c, pick(CHAT));
      return null;
    }
    if (d > 5) {
      c.pos.x = tx;
      c.pos.z = tz;
      return null;
    }
    return { x: tx, z: tz, speed: Math.max(lc.speed, 1.2) * (d > 2 ? 1.4 : 1.05) };
  }

  // ------------------------------------------------------------------ the mega mall's machines
  machines(m, st, dt) {
    this.liftsRun(m, dt);
    this.carry(m, dt);
    this.dance(m, dt);
    // (ROADMAP 13.2: BAYVIEW's cars turning on their stands; its screens turning over to the next face)
    for (const q of m.cars || []) q.yaw += q.spin * dt;
    if (m.screens && m.screens.length && m.screens[0].mesh) {
      const ads = this.game.world.mainM && this.game.world.mainM.bayArtSet ? this.game.world.mainM.bayArtSet.ads : null;
      for (const sc of m.screens) {
        sc.t -= dt;
        if (sc.t > 0 || !ads) continue;
        sc.t = 7 + Math.random() * 5;
        sc.k = (sc.k + 1) % ads.length;
        const r = ads[sc.k];
        const uv = sc.mesh.geometry.attributes.uv;
        // (the quad's corners in the order picQuad made them, world/mainland/bayview.js)
        const u0 = Math.min(uv.getX(0), uv.getX(1), uv.getX(2), uv.getX(3));
        const v0 = Math.min(uv.getY(0), uv.getY(1), uv.getY(2), uv.getY(3));
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) <= u0 + 1e-6 ? r[0] : r[2], uv.getY(i) <= v0 + 1e-6 ? r[1] : r[3]);
        uv.needsUpdate = true;
      }
    }
    // (the sky through the glass of the roof and the dome: by day, by night)
    if (m.sky) this.skyOf(m);
  }

  // (the sky over a mall by day, by night: through its glass, or painted over its lanes)
  skyOf(m) {
    const h = this.game.daynight ? this.game.daynight.hour : 13;
    const night = h < 6.4 || h > 19.4;
    m.sky.day.visible = !night;
    m.sky.night.visible = night;
  }

  // the glass lifts: up and down their floors in turn, a while at each with the gate open; you in
  // one are carried in it, kept inside its glass but at its door
  liftsRun(m, dt) {
    const p = this.game.player;
    const pp = p.pos;
    const onFoot = p.mode === 'foot' && !p.inVehicle;
    for (const L of m.lifts || []) {
      const dx = pp.x - L.x;
      const dz = pp.z - L.z;
      const dd = Math.hypot(dx, dz);
      const inCab = onFoot && dd < L.r - 0.12 && Math.abs(pp.y - (CURB + L.y)) < 0.8;
      L.t += dt;
      if (L.state === 'open') {
        if (L.t > (inCab ? 2.4 : 5.5)) {
          L.state = 'close';
          L.t = 0;
          L.gates[L.at].alive = true;
        }
      } else if (L.state === 'close') {
        if (L.t > 0.6) {
          L.dir = L.dir || 1;
          let to = L.at + L.dir;
          if (to < 0 || to >= L.levels.length) {
            L.dir = -L.dir;
            to = L.at + L.dir;
          }
          L.to = to;
          L.state = 'move';
          L.t = 0;
        }
      } else {
        const target = L.levels[L.to];
        const d = target - L.y;
        const sp = Math.min(1.7, Math.abs(d) * 1.4 + 0.12, 0.3 + L.t * 1.4);
        L.y += Math.sign(d) * Math.min(Math.abs(d), sp * dt);
        if (Math.abs(target - L.y) < 0.002) {
          L.y = target;
          L.at = L.to;
          L.state = 'open';
          L.t = 0;
          L.gates[L.at].alive = false;
        }
      }
      L.grp.position.y = CURB + L.y;
      L.floor.y0 = CURB + L.y - 0.3;
      L.floor.y1 = CURB + L.y;
      if (inCab) {
        pp.y = CURB + L.y;
        if (p.vel.y < 0 || L.state === 'move') p.vel.y = 0;
        p.onGround = true;
        const out = dx * L.side > 0 && Math.abs(dz) < 0.85 && L.state === 'open';
        const lim = L.r - 0.38;
        if (dd > lim && !out) {
          pp.x = L.x + (dx / dd) * lim;
          pp.z = L.z + (dz / dd) * lim;
        }
      }
    }
  }

  // the escalators carry whoever stands on them: you too
  carry(m, dt) {
    const p = this.game.player;
    if (p.mode !== 'foot' || p.inVehicle) return;
    const pp = p.pos;
    for (const f of m.escalators || []) {
      if (pp.x < f.x0 + 0.12 || pp.x > f.x1 - 0.12) continue;
      const along = (pp.z - f.zf) * f.dir;
      if (along < -0.1 || along > f.run + 0.1) continue;
      const yl = f.yf + (f.rise * Math.max(0, Math.min(f.run, along))) / f.run;
      if (Math.abs(pp.y - yl) > 0.75) continue;
      pp.z += 0.6 * (f.up ? 1 : -1) * f.dir * dt;
      break;
    }
  }

  // the fountain's show: its rings of jets rising and falling in turn, the middle one shooting up on
  // the beat; the lights in its water turning through the colours
  dance(m, dt) {
    const F = m.fountain;
    if (!F || !F.jets) return;
    F.t = (F.t || 0) + dt;
    const t = F.t;
    const ph = Math.floor(t / 9) % 4;
    for (let i = 0; i < F.jets.length; i++) {
      const J = F.jets[i];
      let h;
      if (ph === 0) h = 0.75 + 0.25 * Math.sin(t * 1.6 + i);
      else if (ph === 1) h = 0.3 + 0.7 * Math.max(0, Math.sin(t * 2.4 - i * 1.3));
      else if (ph === 2) h = (0.45 + 0.55 * Math.abs(Math.sin(t * 0.9 + i * 0.7))) * (i === 2 ? 1.5 : 1);
      else h = 0.6 + 0.4 * Math.sin(t * 3.1 + i * 2.1);
      J.grp.scale.y = Math.max(0.12, J.h * h);
    }
    const lights = lightList();
    for (let k = 0; k < (F.show || []).length; k++) {
      const l = lights[F.show[k]];
      if (l && l.c && l.c.setHSL) l.c.setHSL((t * 0.04 + k * 0.25) % 1, 0.85, 0.55);
    }
  }

  // (ROADMAP 13.2) what the malls near draw every frame: BAYVIEW's cars on their stands
  draw() {
    const cars = this.game.cars;
    if (!cars) return;
    const cam = this.game.camera.position;
    for (const st of this.active.values()) if (st.crowd) st.crowd.draw();
    for (const m of this.active.keys()) {
      if (!m.cars) continue;
      for (const q of m.cars) {
        if (Math.hypot(q.x - cam.x, q.z - cam.z) > 140) continue;
        cars.draw('sports', q.color, q.x, q.y, q.z, q.yaw, {});
      }
    }
  }

  clear() {
    for (const [m, st] of this.active) this.close(m, st);
  }
}
