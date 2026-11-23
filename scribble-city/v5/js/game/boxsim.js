// (ROADMAP 29.5) The bout itself, as numbers - no pictures, no sounds, nothing of the city (game/boxing.js puts it on the
// canvas of a ring): two fighters, rounds on a clock with a bell and a rest, each fighter's health, stamina and knockdowns; a
// count of ten on the canvas and getting up from it; a KO, a TKO, or the judges' cards. Footwork locked onto the man in front:
// in, out, round. Four punches and their body versions, each with real frame data (startup, active, recovery), its reach, its
// damage and what it costs; a buffer and cancel windows, so that 1-2, 1-2-3, 1-1-2, 2-3-2 come out of the hands as one. The
// guard (held: the blows from in front taken on the gloves, a little getting through, the stamina it costs, pushed back), the
// slips and the duck (a moment the head is not there - and a punch slipped opens a counter), the stagger. And the man on the
// other side: game/boxing.js's BoxAI below, by a profile of his own. Stepped on a fixed clock of sixty a second, whatever the
// frame rate, so that a phone at twenty frames a second fights the same fight - and a test in node does too. No imports.

export const DT = 1 / 60;

// (ROADMAP 29.5) the frame data: su the startup, act the active frames, rec the recovery (seconds - at 60 a second: jab 6/3/9,
// cross 9/4/14, hook 11/4/18, uppercut 13/4/19); reach centre to centre (m); dmg to health, sta its cost; stun / bstun how long
// it holds the other in hit / block stun; push how far it drives him back; lunge how far the step into it goes; cHit / cWhiff
// how soon into the recovery the next punch can come out of it, landed (or blocked) / thrown at nothing; chain: what may
// follow it; hs the hitstop (s, real time) a clean one gives; kind: 0 straight, 1 hook, 2 uppercut (the head's reaction);
// power: a power punch (a tell when the man in front throws it, punishable when it misses)
const BASE = {
  jab: { id: 1, hand: 'lead', su: 0.1, act: 0.05, rec: 0.15, reach: 1.0, dmg: 3.6, sta: 3.2, stun: 0.18, bstun: 0.14, push: 0.1, lunge: 0.12, cHit: 0.02, cWhiff: 0.07, hs: 0.04, kind: 0, power: false, chain: ['jab', 'cross', 'hook', 'upper'] },
  cross: { id: 2, hand: 'rear', su: 0.15, act: 0.06, rec: 0.24, reach: 1.04, dmg: 7.4, sta: 6.5, stun: 0.33, bstun: 0.18, push: 0.18, lunge: 0.1, cHit: 0.04, cWhiff: 0.15, hs: 0.07, kind: 0, power: true, chain: ['jab', 'hook', 'upper'] },
  hook: { id: 3, hand: 'lead', su: 0.19, act: 0.07, rec: 0.3, reach: 0.86, dmg: 9.8, sta: 8.5, stun: 0.36, bstun: 0.2, push: 0.22, lunge: 0.05, cHit: 0.06, cWhiff: 0.2, hs: 0.1, kind: 1, power: true, chain: ['cross', 'upper', 'jab'] },
  upper: { id: 4, hand: 'rear', su: 0.21, act: 0.07, rec: 0.32, reach: 0.78, dmg: 10.6, sta: 9.5, stun: 0.38, bstun: 0.2, push: 0.16, lunge: 0.06, cHit: 0.06, cWhiff: 0.22, hs: 0.1, kind: 2, power: true, chain: ['hook', 'cross', 'jab'] },
};
// the body versions (the stick pulled back and a punch): a little slower and shorter, less to the health and much more to the
// stamina, and half of it gets through a high guard
export const MOVES = {};
for (const k of Object.keys(BASE)) {
  const m = BASE[k];
  MOVES[k] = { ...m, name: k, base: k, body: false, sdmg: 0 };
  MOVES['b' + k] = { ...m, name: 'b' + k, base: k, body: true, su: m.su + 0.02, reach: m.reach - 0.06, dmg: m.dmg * 0.72, sdmg: m.dmg * 1.35, lunge: m.lunge * 0.8, hs: m.hs * 0.85, chain: m.chain };
}
// the slip (s): how long it lasts, when the head is off the line; the duck the same; the counter window a slipped punch opens
export const SLIP = { dur: 0.34, on: 0.03, off: 0.24, sta: 3 };
export const DUCK = { dur: 0.4, on: 0.05, off: 0.3, sta: 4 };
export const COUNTER = { win: 0.55, mul: 1.6 };
const MIN_D = 0.6;
const WALK = 1.75;
// (game/boxrig.js GETUP_BACK / GETUP_KNEE: as long as the getting up is drawn)
const GETUP = [1.6, 0.8];
const STATES = ['idle', 'punch', 'slip', 'duck', 'stun', 'bstun', 'stagger', 'down', 'getup', 'out', 'corner'];
const SI = {};
STATES.forEach((s, i) => (SI[s] = i));

// (ROADMAP 29.5) the fighters: how fast, how hard, how much they take; how much they come forward, how often the guard is up,
// how often they slip and duck; how long they take to see a punch coming (react, s) and how often they read it before it
// comes (read); how long their power punches are wound up for all to see (tell, s), and how often that is a feint; how often
// they punish a miss; the distance they like; how much they move round you; how soon they go to the body when your guard is
// high; their combos ('1-2', 'b' a body shot) - and their names and their stance (m: 1 orthodox, -1 southpaw)
export const PROFILES = {
  rookie: { id: 'rookie', name: 'Kid Ricky', spd: 0.9, pow: 0.82, hp: 90, stam: 0.9, def: 0.85, aggr: 0.4, guard: 0.3, slip: 0.06, duck: 0.03, react: 0.38, read: 0, tell: 0.26, feint: 0, punish: 0.2, range: 0.98, foot: 0.45, adapt: 0.15, combos: ['1', '1', '1-2', '2', '1-1', '3'], bounce: 0.8, m: 1, glove: [0.85, 0.12, 0.12] },
  outboxer: { id: 'outboxer', name: 'Tommy "Quick" Vance', spd: 1.06, pow: 0.7, hp: 92, stam: 1.12, def: 1.0, aggr: 0.34, guard: 0.36, slip: 0.28, duck: 0.08, react: 0.27, read: 0.08, tell: 0.18, feint: 0.15, punish: 0.55, range: 1.06, foot: 1.0, adapt: 0.4, combos: ['1', '1-1', '1-2', '1-1-2', '1-2', 'b1-1', '1-2-3'], bounce: 1.45, m: 1, glove: [0.12, 0.3, 0.75] },
  brawler: { id: 'brawler', name: 'Big Sal Moreno', spd: 0.9, pow: 1.4, hp: 130, stam: 1.1, def: 1.05, aggr: 0.95, guard: 0.55, slip: 0.05, duck: 0.12, react: 0.28, read: 0.05, tell: 0.2, feint: 0.05, punish: 0.35, range: 0.72, foot: 0.3, adapt: 0.7, combos: ['3', '2-3', 'b3-3', '3-4', 'b2-b3', '1-2-3', '4-3'], bounce: 0.5, m: 1, glove: [0.1, 0.1, 0.12] },
  counter: { id: 'counter', name: 'Lefty Okafor', spd: 1.06, pow: 1.12, hp: 104, stam: 1.0, def: 1.14, aggr: 0.32, guard: 0.6, slip: 0.42, duck: 0.22, react: 0.21, read: 0.2, tell: 0.16, feint: 0.25, punish: 0.85, range: 0.95, foot: 0.6, adapt: 0.5, combos: ['2', '2-3', '1-2', '3-2'], bounce: 0.9, m: -1, glove: [0.9, 0.75, 0.15] },
  champion: { id: 'champion', name: 'Marcus "The Ink" Hale', spd: 1.1, pow: 1.08, hp: 108, stam: 1.2, def: 1.1, aggr: 0.55, guard: 0.6, slip: 0.35, duck: 0.2, react: 0.21, read: 0.22, tell: 0.13, feint: 0.3, punish: 0.8, range: 0.9, foot: 0.8, adapt: 0.85, combos: ['1-2', '1-2-3', '2-3-2', '1-1-2', 'b1-2-3', '3-b3', '1-b2-3', '2-3-4'], bounce: 1.1, m: 1, glove: [0.86, 0.68, 0.22] },
};
export const LADDER = ['rookie', 'outboxer', 'counter', 'brawler', 'champion'];

// a combo string into its punches: '1-b2-3' -> ['jab', 'bcross', 'hook']
const NUM = { 1: 'jab', 2: 'cross', 3: 'hook', 4: 'upper' };
export function comboMoves(s) {
  return s.split('-').map((p) => (p[0] === 'b' ? 'b' + NUM[p[1]] : NUM[p[0]]));
}

// a little random of its own (the same fight from the same seed: a test can be run again)
export class Rand {
  constructor(seed = 1) {
    this.a = seed >>> 0 || 1;
  }
  next() {
    let t = (this.a = (this.a + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// what a controller (you, through game/boxing.js; or BoxAI) wants this step: the stick in the fighter's own frame (mx round to
// his right, mz in), the guard held, a punch pressed (and whether as a body shot), a slip (-1 left, 1 right), a duck, taps to
// get up
export function newIntent() {
  return { mx: 0, mz: 0, guard: false, press: null, slip: 0, duck: false, tap: 0, feint: false, tell: 0 };
}

class Fighter {
  constructor(i, o) {
    const P = o.profile || {};
    this.i = i;
    this.name = o.name || P.name || 'Fighter';
    this.prof = P;
    this.m = o.m || P.m || 1;
    // (ROADMAP 29.5: the trained numbers - game/boxing.js stats - or the profile's)
    this.spd = o.spd || P.spd || 1;
    this.pow = o.pow || P.pow || 1;
    this.def = o.def || P.def || 1;
    this.stam = o.stam || P.stam || 1;
    this.hpMax = o.hp || P.hp || 100;
    this.x = 0;
    this.z = 0;
    this.yaw = 0;
    this.vx = 0;
    this.vz = 0;
    this.lx = 0;
    this.lz = 0;
    this.reset();
    this.stats = { thrown: 0, landed: 0, power: 0, body: 0, blocked: 0, guarded: 0, slipped: 0, counters: 0, dmg: 0, downs: 0 };
  }

  reset() {
    this.hp = this.hpMax;
    this.cap = this.hpMax;
    this.staMax = 100;
    this.sta = 100;
    this.state = 'idle';
    this.st = 0;
    this.move = null;
    this.mt = 0;
    this.tell = 0;
    this.feint = false;
    this.res = null;
    this.whiff = false;
    this.chainN = 0;
    this.punchId = 0;
    this.buf = null;
    this.bufT = 0;
    this.buf2 = null;
    this.dbuf = 0;
    this.dbufT = 0;
    this.guard = false;
    this.guardK = 0;
    this.slipDir = 1;
    this.slipEnd = -9;
    this.slipShort = false;
    this.counterT = 0;
    this.stun = 0;
    this.hitT = -1;
    this.hitKind = 0;
    this.hitSide = 0;
    this.hitK = 0;
    this.blockT = -1;
    this.blockK = 0;
    this.wobble = 0;
    this.comboHits = 0;
    this.staggerT = 0;
    this.staggerK = 0;
    this.downs = 0;
    this.downsTotal = 0;
    this.downT = -1;
    this.downKind = 0;
    this.getupT = -1;
    this.fill = 0;
    this.lastHit = -9;
    this.lastPunch = -9;
    this.rd = { landed: 0, power: 0, dmg: 0, downs: 0, thrown: 0 };
  }

  get busy() {
    return this.state !== 'idle';
  }
  // where in its punch: 0 the load / tell, 1 startup, 2 active, 3 recovery
  get phase() {
    if (this.state !== 'punch') return -1;
    const m = this.move;
    const a = this.tell + m.su * this.suK;
    if (this.mt < this.tell) return 0;
    if (this.mt < a) return 1;
    if (this.mt < a + m.act) return 2;
    return 3;
  }
  get activeAt() {
    return this.tell + this.move.su * this.suK;
  }
  get endAt() {
    return this.activeAt + this.move.act + this.move.rec * this.recK + (this.whiff && this.move.power ? 0.08 : 0);
  }
  // tired: slower and weaker under thirty
  get tiredK() {
    return this.sta >= 30 ? 0 : 1 - this.sta / 30;
  }
}

export class Bout {
  // o: { ring: { x, z, half, yaw }, a, b (each { name, profile, m, spd, pow, def, stam, hp }), rounds, roundLen, restLen, seed }
  constructor(o) {
    const r = o.ring || {};
    this.ring = { x: r.x || 0, z: r.z || 0, half: r.half || 3, yaw: r.yaw || 0 };
    this.rounds = o.rounds || 3;
    this.roundLen = o.roundLen || 60;
    this.restLen = o.restLen === undefined ? 8 : o.restLen;
    this.introLen = o.introLen === undefined ? 2.2 : o.introLen;
    this.rand = new Rand(o.seed || 1);
    this.f = [new Fighter(0, o.a || {}), new Fighter(1, o.b || {})];
    this.intent = [newIntent(), newIntent()];
    // (the controllers: null - fed from outside, game/boxing.js; or a BoxAI)
    this.ctl = [null, null];
    this.t = 0;
    this.acc = 0;
    this.round = 1;
    this.clock = this.roundLen;
    this.phase = 'intro';
    this.phaseT = 0;
    this.count = 0;
    this.countT = 0;
    this.downed = -1;
    this.cards = [];
    this.result = null;
    this.ev = [];
    // (ROADMAP 29.5) what was just done, kept a second for the man on the other side to see it late (BoxAI react)
    this.hist = [new History(), new History()];
    this.place(true);
  }

  // the ring's frame: u across, v along (ring.yaw turns it)
  toRing(x, z, out) {
    const c = Math.cos(this.ring.yaw);
    const s = Math.sin(this.ring.yaw);
    const dx = x - this.ring.x;
    const dz = z - this.ring.z;
    out.u = dx * c - dz * s;
    out.v = dx * s + dz * c;
    return out;
  }
  fromRing(u, v, f) {
    const c = Math.cos(this.ring.yaw);
    const s = Math.sin(this.ring.yaw);
    f.x = this.ring.x + u * c + v * s;
    f.z = this.ring.z - u * s + v * c;
  }

  // each at his mark (the start of a round), or in his corner (the rest)
  place(marks) {
    const h = this.ring.half;
    for (const f of this.f) {
      const sd = f.i === 0 ? -1 : 1;
      if (marks) this.fromRing(sd * 1.05, 0, f);
      else this.fromRing(sd * (h - 0.6), sd * (h - 0.6), f);
      f.vx = 0;
      f.vz = 0;
    }
    this.face(1);
  }

  face(k) {
    const a = this.f[0];
    const b = this.f[1];
    const ya = Math.atan2(b.x - a.x, b.z - a.z);
    const yb = Math.atan2(a.x - b.x, a.z - b.z);
    a.yaw = turn(a.yaw, ya, k);
    b.yaw = turn(b.yaw, yb, k);
  }

  dist() {
    const a = this.f[0];
    const b = this.f[1];
    return Math.hypot(b.x - a.x, b.z - a.z);
  }

  emit(type, o) {
    o.type = type;
    o.t = this.t;
    this.ev.push(o);
  }

  // ------------------------------------------------------------------ the clock
  step(dt) {
    this.acc += Math.min(dt, 0.25);
    let n = 0;
    while (this.acc >= DT && n < 16) {
      this.acc -= DT;
      this.tick(DT);
      n++;
    }
    if (n >= 16) this.acc = 0;
  }

  tick(h) {
    this.t += h;
    this.phaseT += h;
    for (let i = 0; i < 2; i++) {
      if (this.ctl[i]) this.ctl[i].think(h);
      this.hist[i].push(this.f[i], this.t);
    }
    const ph = this.phase;
    if (ph === 'intro') {
      for (const f of this.f) this.idleTick(f, h, false);
      if (this.phaseT >= this.introLen) this.setPhase('fight');
    } else if (ph === 'fight') {
      this.clock -= h;
      for (let i = 0; i < 2; i++) this.fighterTick(this.f[i], this.intent[i], h);
      this.move(h);
      this.resolve();
      if (this.clock <= 0 && this.phase === 'fight') this.endRound();
    } else if (ph === 'count') this.countTick(h);
    else if (ph === 'rest') {
      for (const f of this.f) {
        this.idleTick(f, h, true);
        f.sta = Math.min(f.staMax, f.sta + 30 * h);
        f.hp = Math.min(f.cap, f.hp + ((f.cap - f.hp) * 0.4 * h) / Math.max(1, this.restLen));
      }
      this.move(h);
      if (this.phaseT >= this.restLen) {
        this.round++;
        this.clock = this.roundLen;
        this.setPhase('intro');
      }
    } else if (ph === 'over') {
      for (const f of this.f) {
        if (f.state !== 'down' && f.state !== 'out') this.idleTick(f, h, true);
        else f.downT = Math.max(0, f.downT) + h;
        // (out cold a while - then helped up: on his feet again before the ring lets him go)
        if (f.state === 'out' && this.phaseT > 3.2) {
          f.state = 'getup';
          f.getupT = 0;
          f.downT = -1;
        }
      }
      this.move(h);
    }
    for (const it of this.intent) {
      it.press = null;
      it.slip = 0;
      it.duck = false;
      it.tap = 0;
    }
  }

  setPhase(p) {
    this.phase = p;
    this.phaseT = 0;
    if (p === 'fight') this.emit('bell', { round: this.round, start: true });
    if (p === 'intro') this.emit('round', { round: this.round });
    if (p === 'rest') this.emit('rest', { round: this.round });
  }

  // standing about (the intro, the rest, after it is over): no punches; between the rounds each to his corner
  idleTick(f, h, corner) {
    f.st += h;
    if (f.state === 'getup') {
      f.getupT += h;
      if (f.getupT >= GETUP[f.downKind]) {
        f.getupT = -1;
        f.state = 'idle';
      }
    } else if (f.state !== 'down' && f.state !== 'out') f.state = 'idle';
    f.move = null;
    f.guard = false;
    f.guardK += (0 - f.guardK) * Math.min(1, h * 10);
    f.hitT = f.hitT >= 0 ? f.hitT + h : -1;
    f.blockT = f.blockT >= 0 ? f.blockT + h : -1;
    f.staggerK = Math.max(0, f.staggerK - h * 2);
    f.counterT = 0;
    f.corner = corner;
  }

  // ------------------------------------------------------------------ a fighter, this step
  fighterTick(f, it, h) {
    f.st += h;
    f.counterT = Math.max(0, f.counterT - h);
    f.bufT -= h;
    // (the first press waiting run out: the one behind it takes its place, with a window of its own)
    if (f.bufT <= 0 && f.buf) this.nextBuf(f, 0.22);
    if (f.hitT >= 0) f.hitT += h;
    if (f.blockT >= 0) f.blockT += h;
    f.wobble = Math.max(0, f.wobble - h * 7);
    f.corner = false;
    // (a press into the buffer: it comes out at the first moment it can - 0.22 s. Two deep: 1-2-3 tapped quickly while the jab is
    // still out keeps its order - the cross waits first, the hook behind it - and is not the hook alone, the cross lost)
    // (a slip or a duck pressed while still busy - the end of a punch, a blow's stun: kept a moment, done when he is free)
    if (it.slip || it.duck) {
      f.dbuf = it.slip || 2;
      f.dbufT = 0.16;
    } else if ((f.dbufT -= h) <= 0) f.dbuf = 0;
    if (it.press) {
      if (f.buf && f.state !== 'idle') {
        f.buf2 = it.press;
        f.buf2Tell = it.tell || 0;
        f.buf2Feint = !!it.feint;
      } else {
        f.buf = it.press;
        f.bufT = 0.22;
        f.bufTell = it.tell || 0;
        f.bufFeint = !!it.feint;
      }
    }
    // the stamina and the health coming back
    const sinceP = this.t - f.lastPunch;
    if (sinceP > 0.35 && f.state !== 'stun' && f.state !== 'stagger') {
      const rate = (f.guard ? 6 : 12.5) * f.stam * (0.55 + 0.45 * (f.hp / f.hpMax));
      f.sta = Math.min(f.staMax, f.sta + rate * h);
    }
    if (this.t - f.lastHit > 2.5) f.hp = Math.min(f.cap, f.hp + 0.9 * h);
    switch (f.state) {
      case 'idle':
        this.idle(f, it, h);
        break;
      case 'punch': {
        f.mt += h;
        if (f.feint && f.mt >= f.tell) {
          f.state = 'idle';
          f.move = null;
          this.emit('feint', { f: f.i });
          this.idle(f, it, 0);
          break;
        }
        // (the next one out of this one, in its cancel window)
        if (f.buf && MOVES[f.buf] && f.move.chain.includes(MOVES[f.buf].base) && f.mt >= this.cancelAt(f)) {
          this.startPunch(f, f.buf, 0, false, true);
          // (the one behind it waits for this one's own window)
          this.nextBuf(f, this.cancelAt(f) + 0.14);
          break;
        }
        if (f.mt >= f.endAt) {
          f.state = 'idle';
          f.move = null;
          f.chainN = 0;
          this.idle(f, it, 0);
        }
        break;
      }
      case 'slip':
      case 'duck': {
        const D = f.state === 'slip' ? SLIP : DUCK;
        if (f.st >= D.dur) {
          f.state = 'idle';
          f.slipEnd = this.t;
          this.idle(f, it, 0);
        }
        break;
      }
      case 'stun':
      case 'bstun':
        f.stun -= h;
        if (f.stun <= 0) {
          f.state = 'idle';
          f.comboHits = 0;
          this.idle(f, it, 0);
        }
        break;
      case 'stagger':
        f.staggerT -= h;
        // (wobbling: he can cover up and move a little, not punch)
        f.guard = it.guard;
        if (f.staggerT <= 0) {
          f.state = 'idle';
          this.idle(f, it, 0);
        }
        break;
      case 'getup':
        f.getupT += h;
        if (f.getupT >= GETUP[f.downKind]) {
          f.getupT = -1;
          f.state = 'idle';
        }
        break;
      default:
        break;
    }
    f.staggerK += ((f.state === 'stagger' ? 1 : 0) - f.staggerK) * Math.min(1, h * 6);
    const g = f.guard && (f.state === 'idle' || f.state === 'bstun' || f.state === 'stagger') ? 1 : 0;
    f.guardK += (g - f.guardK) * Math.min(1, h * 22);
    // the footwork (and the step into a punch)
    let sp = WALK * (0.9 + 0.1 * f.spd);
    if (f.state === 'punch') sp *= 0.25;
    else if (f.state === 'stagger') sp *= 0.35;
    else if (f.state !== 'idle') sp = 0;
    if (f.guard) sp *= 0.62;
    sp *= 1 - 0.25 * f.tiredK;
    let mz = it.mz;
    let mx = it.mx;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) {
      mx /= ml;
      mz /= ml;
    }
    // (a body shot is the stick pulled back: it does not step him back as well)
    if (f.state === 'punch' && f.move.body) mz = Math.max(0, mz);
    f.wlx = mx * sp;
    f.wlz = mz * sp;
  }

  // free: a punch out of the buffer, a slip, a duck, or the guard
  idle(f, it, h) {
    f.guard = it.guard;
    const dodge = f.dbuf || 0;
    if ((dodge === 1 || dodge === -1) && f.sta > 1) {
      f.dbuf = 0;
      f.state = 'slip';
      f.st = 0;
      f.slipDir = dodge;
      // (slip after slip, and the window is shorter: no slipping everything by mashing)
      f.slipShort = this.t - f.slipEnd < 0.25;
      f.sta -= SLIP.sta;
      f.lastPunch = this.t - 0.2;
      f.guard = false;
      this.emit('dodge', { f: f.i, kind: 'slip', dir: dodge });
      return;
    }
    if (dodge === 2 && f.sta > 1) {
      f.dbuf = 0;
      f.state = 'duck';
      f.st = 0;
      f.slipShort = this.t - f.slipEnd < 0.25;
      f.sta -= DUCK.sta;
      f.lastPunch = this.t - 0.2;
      f.guard = false;
      this.emit('dodge', { f: f.i, kind: 'duck' });
      return;
    }
    if (f.buf) {
      this.startPunch(f, f.buf, f.bufTell || 0, f.bufFeint, false);
      this.nextBuf(f, f.state === 'punch' ? this.cancelAt(f) + 0.14 : 0.22);
    }
  }

  // the press behind the first one moved up (with a window of t seconds), or none
  nextBuf(f, t) {
    f.buf = f.buf2 || null;
    f.bufTell = f.buf2Tell || 0;
    f.bufFeint = !!f.buf2Feint;
    f.bufT = f.buf ? t : 0;
    f.buf2 = null;
  }

  cancelAt(f) {
    const m = f.move;
    const a = f.activeAt + m.act;
    if (f.res === 'hit' || f.res === 'block') return a + m.cHit;
    // (thrown at nothing - or not landed yet: later)
    return a + m.cWhiff + (m.power ? 0.04 : 0);
  }

  startPunch(f, name, tell, feint, chained) {
    const m = MOVES[name];
    if (!m) return;
    f.state = 'punch';
    f.move = m;
    f.mt = 0;
    f.st = 0;
    f.tell = chained ? 0 : tell;
    f.feint = !!feint;
    f.res = null;
    f.whiff = false;
    f.guard = false;
    f.chainN = chained ? f.chainN + 1 : 0;
    f.punchId++;
    // (tired: slower out and slower back; and the speed trained or born)
    const tk = f.tiredK;
    f.suK = (1 + 0.28 * tk) / f.spd;
    f.recK = (1 + 0.35 * tk) / Math.sqrt(f.spd);
    if (feint) {
      f.sta -= 1;
      f.tell = Math.max(tell, 0.12);
      return;
    }
    const cost = m.sta / Math.sqrt(f.stam);
    f.sta = Math.max(0, f.sta - cost);
    f.lastPunch = this.t;
    f.stats.thrown++;
    f.rd.thrown++;
    this.emit('throw', { f: f.i, move: m.name, tell: f.tell });
  }

  // ------------------------------------------------------------------ the feet
  move(h) {
    const a = this.f[0];
    const b = this.f[1];
    const fight = this.phase === 'fight';
    const d0 = this.dist() || 1;
    for (const f of this.f) {
      const o = f === a ? b : a;
      if (f.state === 'down' || f.state === 'out' || f.state === 'getup') {
        f.vx = 0;
        f.vz = 0;
        f.lx = 0;
        f.lz = 0;
        continue;
      }
      // the way to him and round him, in the world
      const fx = (o.x - f.x) / d0;
      const fz = (o.z - f.z) / d0;
      let wlx = f.wlx || 0;
      let wlz = f.wlz || 0;
      if (!fight) {
        // (between the rounds, or after it: to the corner, at a walk)
        const c = this.cornerOf(f);
        const dx = c.x - f.x;
        const dz = c.z - f.z;
        const dl = Math.hypot(dx, dz);
        const want = f.corner && dl > 0.15 ? Math.min(1.2, dl * 2) : 0;
        const tx = dl > 0.01 ? (dx / dl) * want : 0;
        const tz = dl > 0.01 ? (dz / dl) * want : 0;
        // (as the body's own: ahead and to its right - the right is (-fz, fx) of the way it faces)
        wlz = tx * fx + tz * fz;
        wlx = tx * -fz + tz * fx;
      }
      // (right = (-fz, fx) turned the rig's way: game/doodle.js's right is (-f.z, f.x) of its forward)
      const rx = -fz;
      const rz = fx;
      let tvx = fx * wlz + rx * wlx;
      let tvz = fz * wlz + rz * wlx;
      // the step into a punch, through its startup
      if (f.state === 'punch' && f.mt >= f.tell && f.mt < f.activeAt && d0 > MIN_D + 0.04 && !f.feint) {
        const lv = f.move.lunge / Math.max(0.05, f.move.su * f.suK);
        tvx += fx * lv;
        tvz += fz * lv;
      }
      const k = Math.min(1, h * 16);
      f.vx += (tvx - f.vx) * k;
      f.vz += (tvz - f.vz) * k;
      f.x += f.vx * h;
      f.z += f.vz * h;
      // (in his own frame, for the steps drawn: ahead, to his right)
      f.lz = f.vx * fx + f.vz * fz;
      f.lx = f.vx * rx + f.vz * rz;
    }
    // (never through each other)
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dz) || 1e-3;
    if (d < MIN_D) {
      const p = (MIN_D - d) / 2;
      const ux = dx / d;
      const uz = dz / d;
      const am = a.state === 'down' || a.state === 'out' ? 0 : 1;
      const bm = b.state === 'down' || b.state === 'out' ? 0 : 1;
      const tot = am + bm || 1;
      a.x -= ux * p * 2 * (am / tot);
      a.z -= uz * p * 2 * (am / tot);
      b.x += ux * p * 2 * (bm / tot);
      b.z += uz * p * 2 * (bm / tot);
    }
    // (inside the ropes)
    const lim = this.ring.half - 0.42;
    const q = this._q || (this._q = { u: 0, v: 0 });
    for (const f of this.f) {
      this.toRing(f.x, f.z, q);
      const u = Math.max(-lim, Math.min(lim, q.u));
      const v = Math.max(-lim, Math.min(lim, q.v));
      if (u !== q.u || v !== q.v) this.fromRing(u, v, f);
      f.onRopes = Math.abs(q.u) > lim - 0.25 || Math.abs(q.v) > lim - 0.25;
    }
    if (fight || this.phase === 'intro') this.face(fight ? 0.5 : 0.15);
    else {
      for (const f of this.f) {
        if (f.state === 'down' || f.state === 'out' || f.state === 'getup') continue;
        const o = f === a ? b : a;
        const sp = Math.hypot(f.vx, f.vz);
        const want = sp > 0.35 ? Math.atan2(f.vx, f.vz) : this.phase === 'count' ? Math.atan2(o.x - f.x, o.z - f.z) : Math.atan2(this.ring.x - f.x, this.ring.z - f.z);
        f.yaw = turn(f.yaw, want, 0.12);
      }
    }
  }

  cornerOf(f) {
    const h = this.ring.half;
    const c = f._c || (f._c = { x: 0, z: 0 });
    const sd = f.i === 0 ? -1 : 1;
    // (the downed man's corner is his own; the other goes to a neutral one while the count goes on - of the two, the one further
    // from where the count is watched from, game/boxing.js camAt, so that he is not walked in front of it)
    const neutral = this.phase === 'count' && this.downed !== f.i;
    if (neutral && this.camAt) {
      const q = this._nq || (this._nq = { x: 0, z: 0 });
      this.fromRing(sd * (h - 0.75), -sd * (h - 0.75), c);
      this.fromRing(-sd * (h - 0.75), sd * (h - 0.75), q);
      const A = this.camAt;
      if ((q.x - A.x) ** 2 + (q.z - A.z) ** 2 > (c.x - A.x) ** 2 + (c.z - A.z) ** 2) {
        c.x = q.x;
        c.z = q.z;
      }
      return c;
    }
    this.fromRing(sd * (h - 0.75), (neutral ? -sd : sd) * (h - 0.75), c);
    return c;
  }

  // ------------------------------------------------------------------ the blows
  resolve() {
    const a = this.f[0];
    const b = this.f[1];
    const ra = this.check(a, b);
    const rb = this.check(b, a);
    const ma = a.move;
    const mb = b.move;
    // (both land in the same step: a trade - both go in)
    if (ra) this.apply(a, b, ra, ma);
    if (rb && b.state !== 'down' && !this.result) this.apply(b, a, rb, mb);
    // a punch that was out and never found him
    for (const f of this.f) {
      if (f.state === 'punch' && !f.res && !f.feint && f.mt >= f.activeAt + f.move.act) {
        f.res = 'whiff';
        f.whiff = true;
        this.emit('whiff', { f: f.i, move: f.move.name });
      }
    }
  }

  // what this punch does to him this step (null: nothing yet)
  check(A, D) {
    if (A.state !== 'punch' || A.res || A.feint) return null;
    const m = A.move;
    const t0 = A.activeAt;
    if (A.mt < t0 || A.mt >= t0 + m.act) return null;
    const d = this.dist();
    if (d > m.reach + 0.04) return null;
    if (D.state === 'down' || D.state === 'out' || D.state === 'getup') return null;
    const head = !m.body;
    if (head && D.state === 'slip') {
      const on = SLIP.on;
      const off = D.slipShort ? SLIP.on + (SLIP.off - SLIP.on) * 0.5 : SLIP.off;
      if (D.st >= on && D.st <= off) return 'slip';
    }
    if (head && D.state === 'duck') {
      const off = D.slipShort ? DUCK.on + (DUCK.off - DUCK.on) * 0.5 : DUCK.off;
      if (D.st >= DUCK.on && D.st <= off) return m.kind === 2 ? 'hitduck' : 'duck';
    }
    const guarding = D.guardK > 0.55 && (D.state === 'idle' || D.state === 'bstun' || D.state === 'stagger');
    if (guarding) return head ? 'block' : 'bodyguard';
    return 'hit';
  }

  apply(A, D, r, m) {
    const rnd = this.rand;
    if (r === 'slip' || r === 'duck') {
      A.res = 'slip';
      A.whiff = true;
      D.counterT = COUNTER.win;
      D.stats.slipped++;
      this.emit('evade', { a: A.i, d: D.i, move: m.name, kind: r });
      return;
    }
    if (r === 'block') {
      A.res = 'block';
      const chip = m.dmg * 0.12 * A.pow / D.def;
      const drain = (m.dmg * 0.95 * A.pow) / D.def;
      D.hp -= chip;
      D.sta -= drain;
      D.stats.guarded++;
      A.stats.blocked++;
      D.blockT = 0;
      D.blockK = Math.min(1, 0.45 + m.dmg / 14);
      this.push(A, D, m.push * 0.8);
      if (D.sta <= 0) {
        // (the guard broken: worn through, he wobbles open)
        D.sta = 0;
        D.state = 'stagger';
        D.staggerT = 0.7;
        D.st = 0;
        D.guard = false;
        this.emit('guardbreak', { a: A.i, d: D.i, move: m.name });
        return;
      }
      if (D.state !== 'stagger') {
        D.state = 'bstun';
        D.stun = m.bstun;
        D.st = 0;
      }
      this.emit('block', { a: A.i, d: D.i, move: m.name, chip });
      return;
    }
    // it lands (through the guard to the body, or clean)
    const through = r === 'bodyguard' ? 0.55 : 1;
    const counter = A.counterT > 0;
    // (caught coming in: hit in his own startup)
    const caught = D.state === 'punch' && D.mt < D.activeAt && !D.feint;
    const duckK = r === 'hitduck' ? 1.35 : 1;
    // (the fourth and fifth blow running into a man held in stun count for less: no taking him apart in one go)
    const scale = D.state === 'stun' ? Math.max(0.55, 1 - 0.12 * D.comboHits) : 1;
    const tired = 1 - 0.32 * A.tiredK;
    const k = A.pow * tired * (counter ? COUNTER.mul : 1) * (caught ? 1.25 : 1) * duckK * scale * through * (0.9 + 0.2 * rnd.next());
    const dmg = (m.dmg * k) / D.def;
    A.res = 'hit';
    if (counter) {
      A.counterT = 0;
      A.stats.counters++;
    }
    // (the gym's work: the coach's swing at you hurts nothing, the pads and the bag take everything)
    const spare = this.training && D.i === 0;
    if (!spare) D.hp -= dmg;
    if (!spare) D.cap = Math.max(D.hpMax * 0.35, D.cap - dmg * 0.22);
    if (m.body && !spare) D.sta = Math.max(0, D.sta - (m.sdmg * k) / D.def);
    D.lastHit = this.t;
    D.wobble += dmg;
    A.stats.landed++;
    A.rd.landed++;
    A.stats.dmg += dmg;
    A.rd.dmg += dmg;
    if (m.power) {
      A.stats.power++;
      A.rd.power++;
    }
    if (m.body) A.stats.body++;
    // (his own punch cut short)
    D.move = null;
    D.feint = false;
    D.guard = false;
    // the reaction drawn: which way the head goes (+1: to his left, from a blow by the attacker's left hand)
    const leftHand = (m.hand === 'lead') === (A.m === 1);
    D.hitT = 0;
    D.hitKind = m.body ? 3 : m.kind;
    D.hitSide = leftHand ? 1 : -1;
    D.hitK = Math.min(1.25, 0.45 + dmg / 13);
    this.push(A, D, m.push * (counter ? 1.5 : 1));
    const big = counter || caught || r === 'hitduck';
    let ev = 'hit';
    if (D.hp <= 0) {
      this.knockdown(A, D, m);
      ev = 'kd';
    } else if ((D.wobble > 24 && D.hp < D.hpMax * 0.5) || (big && dmg > 14 && D.hp < D.hpMax * 0.65)) {
      D.state = 'stagger';
      D.staggerT = 0.9 + 0.5 * rnd.next();
      D.st = 0;
      D.wobble = 0;
      ev = 'stagger';
    } else {
      D.state = 'stun';
      D.stun = m.stun * (big ? 1.2 : 1) * (D.comboHits >= 3 ? 0.45 : 1) * (r === 'bodyguard' ? 0.5 : 1);
      D.st = 0;
      D.comboHits++;
    }
    this.emit(ev, { a: A.i, d: D.i, move: m.name, dmg, counter, caught, body: m.body, through: r === 'bodyguard', hs: m.hs * (big ? 1.3 : 1), kd: ev === 'kd' });
  }

  push(A, D, p) {
    const d = this.dist() || 1;
    const ux = (D.x - A.x) / d;
    const uz = (D.z - A.z) / d;
    D.vx += (ux * p) / 0.12;
    D.vz += (uz * p) / 0.12;
  }

  // ------------------------------------------------------------------ down
  knockdown(A, D, m) {
    D.hp = 0;
    D.state = 'down';
    D.st = 0;
    D.downT = 0;
    D.downKind = m.body ? 1 : 0;
    D.downs++;
    D.downsTotal++;
    D.rd.downs++;
    D.stats.downs++;
    D.move = null;
    D.guard = false;
    D.fill = 0;
    A.state = 'idle';
    A.move = null;
    this.downed = D.i;
    this.count = 0;
    this.countT = 0;
    // (three in a round: the referee stops it)
    if (D.downs >= 3) {
      this.finish(A.i, 'TKO');
      return;
    }
    // how many taps getting up takes - more each time, more the more he has taken
    D.need = 7 + 5 * (D.downsTotal - 1) + (1 - D.cap / D.hpMax) * 8;
    // (the man on the other side decides now whether he gets up, and at what count)
    if (this.ctl[D.i] && this.ctl[D.i].riseAt) this.ctl[D.i].riseAt(this);
    this.setPhase('count');
    this.emit('down', { a: A.i, d: D.i, n: D.downs, total: D.downsTotal, kind: D.downKind });
  }

  countTick(h) {
    const D = this.f[this.downed];
    const O = this.f[1 - this.downed];
    if (D.state === 'down') D.downT += h;
    this.idleTick(O, h, true);
    this.move(h);
    O.sta = Math.min(O.staMax, O.sta + 12 * h);
    if (D.state === 'down') {
      // (the count starts once he is on the canvas, a number a second)
      if (D.downT > 1.0) {
        this.countT += h;
        if (this.countT >= 1 || this.count === 0) {
          if (this.count > 0) this.countT -= 1;
          else this.countT = 0;
          this.count++;
          this.emit('count', { n: this.count, d: D.i });
          if (this.count >= 10) {
            D.state = 'out';
            this.finish(O.i, 'KO');
            return;
          }
        }
      }
      // getting up: taps (yours: game/boxing.js; his: BoxAI.riseAt)
      const it = this.intent[D.i];
      D.fill = Math.max(0, D.fill - h * 1.6) + it.tap;
      if (D.downT > 1.2 && D.fill >= D.need) {
        D.state = 'getup';
        D.getupT = 0;
        D.downT = -1;
        this.emit('rise', { d: D.i, at: this.count });
      }
      return;
    }
    if (D.state === 'getup') {
      D.getupT += h;
      if (D.getupT >= GETUP[D.downKind]) {
        D.getupT = -1;
        D.state = 'idle';
        D.hp = Math.max(D.hp, D.cap * Math.max(0.3, 0.68 - 0.1 * (D.downsTotal - 1)));
        D.sta = Math.max(D.sta, 55);
        D.wobble = 0;
        this.readyT = 0.9;
      }
      return;
    }
    // (up: the referee's look at him, the gloves wiped - then on, from where they are)
    this.readyT -= h;
    D.hitT = -1;
    if (this.readyT <= 0) {
      this.downed = -1;
      this.setPhase('fight');
    }
  }

  // ------------------------------------------------------------------ the end of a round, of the fight
  endRound() {
    const [a, b] = this.f;
    // (ten points to the round's better man, nine to the other; a point off for each knockdown)
    const sa = a.rd.landed + a.rd.power * 0.6 + a.rd.dmg * 0.05;
    const sb = b.rd.landed + b.rd.power * 0.6 + b.rd.dmg * 0.05;
    let ca = 10;
    let cb = 10;
    if (sa > sb * 1.08) cb = 9;
    else if (sb > sa * 1.08) ca = 9;
    ca -= a.rd.downs;
    cb -= b.rd.downs;
    if (a.rd.downs > 0 && b.rd.downs === 0) cb = 10;
    if (b.rd.downs > 0 && a.rd.downs === 0) ca = 10;
    this.cards.push([ca, cb]);
    this.emit('bell', { round: this.round, start: false, card: [ca, cb] });
    for (const f of this.f) {
      f.rd = { landed: 0, power: 0, dmg: 0, downs: 0, thrown: 0 };
      f.downs = 0;
      f.move = null;
      if (f.state !== 'out') f.state = 'idle';
    }
    if (this.round >= this.rounds) {
      const ta = this.cards.reduce((s, c) => s + c[0], 0);
      const tb = this.cards.reduce((s, c) => s + c[1], 0);
      this.finish(ta > tb ? 0 : tb > ta ? 1 : -1, ta === tb ? 'DRAW' : 'DEC');
      return;
    }
    this.setPhase('rest');
  }

  finish(winner, how) {
    if (this.result) return;
    const W = winner >= 0 ? this.f[winner] : null;
    this.result = {
      winner,
      how,
      round: this.round,
      time: Math.max(0, this.roundLen - this.clock),
      cards: this.cards.slice(),
      totals: [this.cards.reduce((s, c) => s + c[0], 0), this.cards.reduce((s, c) => s + c[1], 0)],
      stats: [{ ...this.f[0].stats }, { ...this.f[1].stats }],
      names: [this.f[0].name, this.f[1].name],
    };
    this.phase = 'over';
    this.phaseT = 0;
    for (const f of this.f) {
      f.move = null;
      if (f.state !== 'down' && f.state !== 'out' && f.state !== 'getup') f.state = 'idle';
      if (f.state === 'down') f.state = 'out';
    }
    if (W) W.cheer = true;
    this.emit('over', { result: this.result });
  }
}

function turn(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

// (ROADMAP 29.5) what each fighter has just been doing, a second of it, for the other one to see late (BoxAI: how long a
// man takes to see a punch coming is his own)
class History {
  constructor() {
    this.n = 90;
    this.i = 0;
    this.s = [];
    for (let k = 0; k < this.n; k++) this.s.push({ t: -9, state: 0, move: null, mt: 0, act: 0, end: 0, res: null, guard: false, id: 0, hp: 100, sta: 100, chain: 0 });
  }
  push(f, t) {
    const e = this.s[this.i];
    this.i = (this.i + 1) % this.n;
    e.t = t;
    e.state = SI[f.state];
    e.move = f.move;
    e.mt = f.mt;
    e.act = f.move ? f.activeAt : 0;
    e.end = f.move ? f.endAt : 0;
    e.res = f.res;
    e.guard = f.guardK > 0.55;
    e.id = f.punchId;
    e.hp = f.hp;
    e.sta = f.sta;
    e.chain = f.chainN;
  }
  // as it was ago seconds ago
  at(ago) {
    const n = Math.min(this.n - 1, Math.max(0, Math.round(ago / DT)));
    return this.s[(this.i - 1 - n + this.n * 2) % this.n];
  }
}

// ------------------------------------------------------------------ the man on the other side
// (ROADMAP 29.5) A state machine with its own eyes: it sees you late (its react), now and then reads you before (read). It
// keeps the distance it likes, circles off the ropes, covers up when you are in range; sees a punch coming - and guards it,
// slips it, ducks it, or steps out of it, as it tends to; punishes what you miss; goes to the body when your guard stays high;
// throws its combos, a tell on every power punch that starts one (sometimes a feint), and backs off when it is tired or hurt.
export class BoxAI {
  constructor(bout, i, prof, seed = 7) {
    this.b = bout;
    this.i = i;
    this.p = prof;
    this.r = new Rand(seed);
    this.plan = [];
    this.planT = 0;
    this.thinkT = 0;
    this.seenId = -1;
    this.guardT = 0;
    this.circle = this.r.next() < 0.5 ? -1 : 1;
    this.circleT = 2;
    this.backT = 0;
    this.guardSeen = 0.3;
    this.dodgeSeen = 0.1;
    this.rise = 99;
    this.tapT = 0;
    this.lastRes = null;
    this.feintFollow = false;
    this.readId = -1;
    this.reading = false;
    this.gRoll = 1;
    this.gRollT = 0;
  }

  // knocked down: will he get up, and at what count?
  riseAt(b) {
    const f = b.f[this.i];
    const p = this.p;
    const tough = (p.hp || 100) / 100;
    const stay = 0.08 + 0.22 * (f.downsTotal - 1) + (1 - f.cap / f.hpMax) * 0.35 - (tough - 1) * 0.6;
    this.rise = this.r.next() < stay ? 99 : 3 + Math.floor(this.r.next() * (f.downsTotal > 1 ? 6 : 5));
  }

  think(h) {
    const b = this.b;
    const me = b.f[this.i];
    const op = b.f[1 - this.i];
    const it = b.intent[this.i];
    const p = this.p;
    const r = this.r;
    if (b.phase === 'count') {
      // (down: up at the count he chose)
      if (b.downed === this.i && b.count >= this.rise) {
        this.tapT -= h;
        if (this.tapT <= 0) {
          it.tap = 1;
          this.tapT = 0.08;
        }
      }
      return;
    }
    if (b.phase !== 'fight') {
      this.plan.length = 0;
      it.mx = 0;
      it.mz = 0;
      it.guard = false;
      return;
    }
    const d = b.dist();
    // what it sees of you: as you were a moment ago - or, now and then, a punch read as it starts
    if (op.state === 'punch' && op.punchId !== this.readId) {
      this.readId = op.punchId;
      this.reading = r.next() < p.read;
    }
    const ago = this.reading && op.state === 'punch' ? 0.02 : p.react * (0.85 + 0.3 * r.next());
    const s = b.hist[op.i].at(ago);
    // (how much you keep your guard up, and how much you slip and duck: it goes to the body, and to the uppercut)
    this.guardSeen += ((s.guard ? 1 : 0) - this.guardSeen) * Math.min(1, h * 0.35);
    const dodging = s.state === SI.slip || s.state === SI.duck ? 1 : 0;
    this.dodgeSeen += (dodging - this.dodgeSeen) * Math.min(1, h * 0.5);
    this.guardT -= h;
    this.backT -= h;
    this.planT -= h;
    // ---- a punch of yours coming: defend it, as it tends to
    if (s.state === SI.punch && s.id !== this.seenId && s.mt < s.act && s.move) {
      this.seenId = s.id;
      const m = s.move;
      const inRange = d < m.reach + 0.3;
      if (inRange && me.state === 'idle') {
        const x = r.next();
        const head = !m.body;
        let acc = 0;
        if (head && x < (acc += p.slip * (m.kind === 2 ? 1.2 : 1))) it.slip = m.hand === 'lead' ? 1 : -1;
        else if (head && m.kind !== 2 && x < (acc += p.duck * (m.kind === 1 ? 1.6 : 0.6))) it.duck = true;
        else if (x < (acc += p.guard)) this.guardT = 0.45 + 0.3 * r.next();
        else if (x < (acc += p.foot * 0.25)) this.backT = 0.35;
        if (it.slip || it.duck) this.plan.length = 0;
      } else if (inRange && me.state === 'punch' && me.phase <= 1 && r.next() < p.guard * 0.3 && me.chainN === 0) {
        // (it sees it coming in the middle of its own: it pulls the punch and covers)
        this.plan.length = 0;
      }
    }
    // ---- your miss: punish it
    const exposed = (s.state === SI.punch && s.res && s.res !== 'hit' && s.move && s.move.power && s.mt > s.act) || s.state === SI.stagger || s.state === SI.stun;
    // ---- the fight, every so often
    this.thinkT -= h;
    if (this.thinkT <= 0) {
      this.thinkT = 0.08 + 0.08 * r.next();
      const lowSta = me.sta < 25;
      const hurt = me.hp < me.hpMax * 0.3;
      const opHurt = s.hp < op.hpMax * 0.3 || s.state === SI.stagger;
      // the distance it wants
      let want = p.range + (lowSta || hurt ? 0.35 : 0) - (opHurt ? 0.2 : 0);
      if (this.backT > 0) want = Math.max(want, 1.6);
      let mz = Math.max(-1, Math.min(1, (d - want) * 3));
      if (Math.abs(d - want) < 0.06) mz = 0;
      // round you, off the ropes
      this.circleT -= this.thinkT;
      if (this.circleT <= 0) {
        this.circle = -this.circle;
        this.circleT = 1.5 + 2.5 * r.next();
      }
      let mx = this.circle * p.foot * 0.75;
      if (me.onRopes) {
        // (which way round takes him back toward the middle)
        const cx = b.ring.x - me.x;
        const cz = b.ring.z - me.z;
        const fx = (op.x - me.x) / (d || 1);
        const fz = (op.z - me.z) / (d || 1);
        const side = -fz * cx + fx * cz >= 0 ? 1 : -1;
        mx = side * 0.9;
        mz = Math.min(mz, 0.2);
      }
      it.mx = mx;
      it.mz = mz;
      // ---- attack
      if (me.state === 'idle' && !this.plan.length) {
        const punishing = exposed && r.next() < p.punish;
        const counter = me.counterT > 0;
        const aggr = p.aggr * (opHurt ? 1.5 : 1) * (lowSta ? 0.25 : 1) * (hurt ? 0.6 : 1);
        if (punishing || counter) this.start(counter ? this.pickCombo(true) : r.next() < 0.6 ? '2' : '1-2', d, true);
        else if (r.next() < aggr * 0.32) {
          const c = lowSta ? '1' : this.pickCombo(false);
          const first = comboMoves(c)[0];
          if (d < MOVES[first].reach + 0.12) this.start(c, d, false);
          else if (d < MOVES[first].reach + 0.6) {
            // (step in to it)
            it.mz = 1;
          }
        }
      }
    }
    // ---- the guard: up when you are in range and it is not punching, as much as it tends to (and hurt, more)
    const threat = d < 1.25 && op.state !== 'down';
    const g = this.guardT > 0 || (threat && me.state === 'idle' && !this.plan.length && this.guardBias(me, h));
    it.guard = g;
    // ---- the plan: each punch pressed as the one before reaches its cancel window
    if (this.plan.length && b.phase === 'fight') {
      const ok = me.state === 'idle' || (me.state === 'punch' && me.res && me.mt >= b.cancelAt(me) - 0.05);
      if (ok && this.planT <= 0) {
        // (blocked or slipped: a careful man stops there)
        if (me.state === 'punch' && (me.res === 'block' || me.res === 'slip') && r.next() < 0.35 + p.def * 0.2) {
          this.plan.length = 0;
          if (p.foot > 0.7) this.backT = 0.4;
        } else {
          const name = this.plan.shift();
          const m = MOVES[name];
          const first = me.state === 'idle';
          const tell = first && m.power ? p.tell * (0.8 + 0.4 * r.next()) : 0;
          const feint = first && m.power && r.next() < p.feint;
          it.press = name;
          it.tell = tell;
          it.feint = feint;
          this.planT = 0.05;
          if (feint) {
            // (the feint: then the real one, a jab, as you react to it)
            this.plan.length = 0;
            this.plan.push('jab');
            this.planT = tell + 0.05;
          }
          if (!this.plan.length && p.foot > 0.8) this.backT = 0.5;
        }
      }
    }
    if (me.state === 'stun' || me.state === 'stagger') this.plan.length = 0;
  }

  guardBias(me, h) {
    const p = this.p;
    const hurt = me.hp < me.hpMax * 0.35 ? 0.3 : 0;
    // (rolled now and then and kept a while: no flicker)
    this.gRollT = (this.gRollT || 0) - h;
    if (this.gRollT <= 0) {
      this.gRollT = 0.5 + this.r.next();
      this.gRoll = this.r.next();
    }
    return this.gRoll < Math.min(0.92, p.guard * 0.75 + hurt);
  }

  pickCombo(counter) {
    const p = this.p;
    const r = this.r;
    let c = counter ? (r.next() < 0.5 ? '2-3' : '2') : p.combos[Math.floor(r.next() * p.combos.length)];
    // (your guard high: to the body; slipping and ducking a lot: up the middle, and the body)
    const toBody = p.adapt * Math.max(0, this.guardSeen - 0.3) * 1.6 + p.adapt * this.dodgeSeen * 0.6;
    if (r.next() < toBody) {
      const parts = c.split('-');
      const k = Math.floor(r.next() * parts.length);
      if (parts[k][0] !== 'b') parts[k] = 'b' + parts[k];
      c = parts.join('-');
    }
    if (this.dodgeSeen > 0.25 && r.next() < p.adapt * 0.5) c = c.replace(/(^|-)3$/, '$14');
    return c;
  }

  start(c, d, now) {
    this.plan = comboMoves(c);
    this.planT = now ? 0 : 0.02;
  }
}
