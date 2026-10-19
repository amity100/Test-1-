import * as THREE from 'three';
import { civilianLook } from './looks.js';
import { damp } from '../core/util.js';
import { CURB } from '../world/mainland/plan.js';
import { COURT } from '../world/mainland/arena.js';

// (v5, ROADMAP 11.17) Game night at the Bayfront Arena (world/mainland/arena.js). Come in through
// its doors and there is a game on: the WAVE against the PENS, five a side, a referee running the
// sideline, the coaches in front of their benches shouting, the stands full. They bring the ball
// up the court dribbling, pass it round the arc, cut to the basket, drive and lay it in, shoot
// from outside; it drops through the net (the points on the big screen and in the corner of
// yours, that side of the stands on its feet with its arms up) or comes off the rim and they fight
// for the rebound. Now and then a pass is picked off. The quarters run down, the horn goes, they
// huddle at their benches; after the fourth the winners jump about and a new game starts with the
// tip-off. A seat at the edge of the court is yours for a few dollars; step onto the court while
// they play and the referee blows the whistle at you. When you go away they go too (the game
// waits for you where it was).

const TEAMS = [
  { name: 'WAVE', col: [0.86, 0.2, 0.28], s: 1 },
  { name: 'PENS', col: [0.18, 0.42, 0.86], s: -1 },
];
// where each of the five stands in the half they attack (across, out from the baseline), and
// where they cut to now and then: the point at the top of the arc, the wings, the corner and the
// elbow, the post either side of the key
const SPOTS = [
  [[0.4, 9.2], [-1.6, 8.4]],
  [[5.0, 6.4], [5.8, 3.2]],
  [[-5.0, 6.4], [-5.9, 2.6]],
  [[6.5, 1.3], [3.0, 4.6]],
  [[-1.9, 2.5], [1.9, 2.7]],
];
const RIM = 3.05;
const R_BALL = 0.12;
const FLOOR = 0.07;
const QUARTER = 12 * 60;
// (the game's clock runs at three times yours: a quarter is four minutes)
const PACE = 3;
const BALL_COL = [0.93, 0.42, 0.12];
const LIVE = new Set(['bring', 'set', 'shot', 'rebound', 'made', 'inbound']);
// (what stops for somebody on the court, or a fright: not a shot in the air, a basket just made,
// a break)
const HALTS = new Set(['tip', 'inbound', 'bring', 'set', 'rebound']);
const SAY = {
  coach: ['Defense!', 'Move the ball!', 'Box out!', 'Hands up!', 'Run the play!', 'Good look!', 'Get back!', 'Talk on D!', 'Push it!'],
  made: ['Count it!', 'Yes!', 'Money!', "Let's go!", 'Bucket!'],
  ref: ['Hey! Off the court!', 'Off the floor, please!', "You can't be out here!"],
  steal: ['Steal!', 'Got it!', 'Mine!'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _c = new THREE.Vector3();
const _r = new THREE.Vector3();
const _f = new THREE.Vector3();

// a player of a team: its shirt and its shorts, sneakers; a referee in grey; a coach in a suit
function playerLook(team) {
  const L = civilianLook({ fem: false, kind: 'sporty' });
  const c = TEAMS[team].col;
  L.top = { kind: 'tank', color: c.slice(), sleeves: 'none' };
  L.bottom = { kind: 'shorts', color: c.map((v) => v * 0.8) };
  L.shoes = Math.random() < 0.5 ? [0.97, 0.97, 0.96] : [0.12, 0.12, 0.14];
  L.hat = null;
  L.acc = [];
  L.face.glasses = null;
  return L;
}
function refLook() {
  const L = civilianLook({ fem: false, kind: 'smart' });
  L.top = { kind: 'tee', color: [0.62, 0.62, 0.64], sleeves: 'short' };
  L.bottom = { kind: 'pants', color: [0.1, 0.1, 0.12] };
  L.shoes = [0.1, 0.1, 0.1];
  L.hat = null;
  L.acc = [];
  return L;
}

export class ArenaGame {
  constructor(game) {
    this.game = game;
    this.A = null;
    this.on = false;
    this.people = [];
    this.players = [];
    this.ref = null;
    this.coaches = [];
    this.fans = null;
    this.fanQ = 0;
    this.hype = [0, 0];
    this.panicT = 0;
    this.offT = 0;
    this.ball = { p: new THREE.Vector3(), v: new THREE.Vector3(), a: new THREE.Vector3(), end: new THREE.Vector3(), mode: 'held', holder: null, to: null, t: 0, T: 1, h: 0, made: false, pts: 2, dribble: 0, spin: 0, release: 0, rim: new THREE.Vector3() };
    this.g = { phase: 'inbound', off: 0, t: 0, shot: 24, passes: 0, next: 1.5, score: [0, 0], q: 3, clock: 0, wave: null, waveT: 25, side: 'line', resume: null };
    this.bug = null;
    this.bugKey = '';
    this.murmurT = 1;
    this.squeakT = 1;
    this.sayT = 4;
    this.inHall = false;
    this.chase = [null, null, null, null];
    this.chaseD = [0, 0, 0, 0];
    // (counted for the tests)
    this.stats = { baskets: 0, shots: 0, passes: 0, rebounds: 0, steals: 0, quarters: 0, halts: 0 };
    this.newGame(true);
  }

  // ------------------------------------------------------------------ the game's own state
  // a new game from the tip-off, or (live) one already in its third quarter
  newGame(live) {
    const G = this.g;
    if (live) {
      const base = 52 + Math.floor(Math.random() * 14);
      G.score = [base + Math.floor(Math.random() * 7), base + Math.floor(Math.random() * 7)];
      G.q = 3;
      G.clock = 4 * 60 + Math.random() * 5 * 60;
      G.off = Math.random() < 0.5 ? 0 : 1;
      this.setPhase('inbound');
      G.side = 'line';
    } else {
      G.score = [0, 0];
      G.q = 1;
      G.clock = QUARTER;
      this.setPhase('tip');
    }
    this.board();
  }

  setPhase(ph) {
    const G = this.g;
    G.phase = ph;
    G.t = 0;
  }

  board() {
    const A = this.A;
    if (!A || !A.board) return;
    A.board.set(0, this.g.score[0]);
    A.board.set(1, this.g.score[1]);
  }

  // ------------------------------------------------------------------ the arena's floor
  // a point of the half team attacks (u across, v out from its baseline)
  pt(team, u, v, out) {
    const s = TEAMS[team].s;
    out.x = this.A.x + u * s;
    out.z = this.A.z + s * (COURT.l / 2 - v);
    return out;
  }

  // the rim team shoots at
  rimOf(team, out = _r) {
    const s = TEAMS[team].s;
    return out.set(this.A.x, CURB + RIM, this.A.z + s * (COURT.l / 2 - 1.7));
  }

  // inside the arena's walls (k: a little less or more of them)
  inside(x, z, k = 1) {
    const h = this.A.hall;
    const a = ((h.x1 - h.x0) / 2) * k;
    const b = ((h.z1 - h.z0) / 2) * k;
    const dx = (x - this.A.x) / a;
    const dz = (z - this.A.z) / b;
    return dx * dx + dz * dz < 1;
  }

  inCourt(x, z, m = 0) {
    const C = this.A.court;
    return x > C.x0 - m && x < C.x1 + m && z > C.z0 - m && z < C.z1 + m;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const game = this.game;
    const A = game.world.arena || null;
    if (A !== this.A) {
      if (this.on) this.stop();
      this.A = A;
      this.fans = null;
      this.fanQ = 0;
      this.board();
    }
    if (!A || game.classic) {
      this.showBug(false);
      return;
    }
    const p = game.player.pos;
    const d = Math.hypot(p.x - A.x, p.z - A.z);
    if (!this.on && d < (game.touch ? 44 : 56)) this.start();
    else if (this.on && d > (game.touch ? 62 : 76)) this.stop();
    if (!this.on) {
      this.showBug(false);
      return;
    }
    this.makeFans();
    this.inHall = this.inside(p.x, p.z) && p.y < CURB + 24;
    this.sim(dt);
    this.moveBall(dt);
    this.crowd(dt);
    this.sounds(dt);
    this.showBug(this.inHall);
  }

  // the people come in: the ten, the referee, the coaches, a few at the edge of the court
  start() {
    const game = this.game;
    const A = this.A;
    const civs = game.civilians;
    this.on = true;
    this.people = [];
    this.players = [];
    this.coaches = [];
    const add = (x, z, look, o) => {
      const c = civs.spawnScripted(x, z, look, this);
      const pl = { c, tx: x, tz: z, speed: 0, face: null, hand: new THREE.Vector3(), hand2: new THREE.Vector3(), jump: -1, alt: 0, altT: 2 + Math.random() * 3, ...o };
      c.baseY = 0.06;
      c.ctrl = () => this.ctrl(pl);
      this.people.push(pl);
      return pl;
    };
    for (let team = 0; team < 2; team++) {
      for (let role = 0; role < 5; role++) {
        this.pt(team, (role - 2) * 2.2, 13 + role * 0.4, _v);
        this.players.push(add(_v.x, _v.z, playerLook(team), { kind: 'player', team, role }));
      }
    }
    this.ref = add(A.court.x0 + 0.5, A.z, refLook(), { kind: 'ref' });
    for (let team = 0; team < 2; team++) {
      const z = A.z + (team ? 6 : -6);
      const co = add(A.court.x0 - 0.6, z, civilianLook({ fem: Math.random() < 0.3, kind: 'office' }), { kind: 'coach', team, home: z, face: Math.PI / 2 });
      co.c.baseY = 0;
      this.coaches.push(co);
    }
    // (on the benches, and in the seats at the edge of the court: fewer on a phone)
    const subs = game.touch ? 1 : 3;
    for (const b of A.benches) {
      const k = this.people.filter((x) => x.kind === 'sub' && x.team === b.team).length;
      if (k >= subs) continue;
      const pl = add(b.x, b.z, playerLook(b.team), { kind: 'sub', team: b.team, sit: true, tx: b.x, tz: b.z, face: b.yaw });
      pl.c.baseY = 0;
    }
    const fans = game.touch ? 1 : 3;
    let n = 0;
    for (const s of A.courtside) {
      s.taken = false;
      if (n >= fans || Math.random() < 0.4) continue;
      const pl = add(s.x, s.z, civilianLook(), { kind: 'fan', sit: true, tx: s.x, tz: s.z, face: s.yaw, seat: s });
      pl.c.baseY = 0;
      s.taken = true;
      n++;
    }
    // (the game where it was: the players at their places for it)
    const G = this.g;
    if (G.phase === 'tip') this.setPhase('tip');
    else {
      G.off = G.off || 0;
      this.setPhase('inbound');
      G.side = 'line';
    }
    this.place();
    this.board();
  }

  // the people go (the fans stay in their seats, as numbers)
  stop() {
    const civs = this.game.civilians;
    for (const pl of this.people) if (civs.list.includes(pl.c)) civs.remove(pl.c);
    this.people = [];
    this.players = [];
    this.coaches = [];
    this.ref = null;
    this.ball.holder = null;
    this.ball.to = null;
    this.on = false;
    if (this.A) for (const s of this.A.courtside) s.taken = false;
  }

  // everybody where the phase starts them (no walking in from the doors when you come near)
  place() {
    const G = this.g;
    const b = this.ball;
    if (G.phase === 'tip') {
      this.tipPlaces();
      for (const pl of this.players) pl.c.pos.set(pl.tx, pl.c.pos.y, pl.tz);
      return;
    }
    // (an inbound from the sideline: the attackers at their spots, their men with them)
    for (const pl of this.players) {
      const [u, v] = SPOTS[pl.role][0];
      this.pt(G.off, u, v, _v);
      if (pl.team !== G.off) {
        this.rimOf(G.off, _r);
        _v.x += (_r.x - _v.x) * 0.25;
        _v.z += (_r.z - _v.z) * 0.25;
      }
      pl.c.pos.set(_v.x, pl.c.pos.y, _v.z);
      pl.tx = _v.x;
      pl.tz = _v.z;
    }
    const ib = this.players[G.off * 5 + 3];
    this.sideSpot(_v);
    ib.c.pos.set(_v.x, ib.c.pos.y, _v.z);
    b.holder = ib;
    b.mode = 'held';
  }

  // the inbound spot on the sideline, at the half-court line (by the scorers' table)
  sideSpot(out) {
    return out.set(this.A.court.x0 - 0.45, 0, this.A.z);
  }

  // the people's feet: where the game wants them, how fast (scripted: game/civilians.js)
  ctrl(pl) {
    const c = pl.c;
    if (pl.sit) {
      c.noCollide = true;
      c.pos.x = pl.tx;
      c.pos.z = pl.tz;
      c.faceYaw = pl.face;
      c.fig.sit = Math.min(1, c.fig.sit + 0.05);
      return null;
    }
    if (pl.face !== null) c.faceYaw = pl.face;
    // (arms up: shooting, jumping for joy, a coach shouting)
    c.fig.armsUp = pl.jump >= 0 || pl.armsT > 0 ? 1 : 0;
    const d = Math.hypot(pl.tx - c.pos.x, pl.tz - c.pos.z);
    if (d < 0.1 || pl.speed <= 0) return null;
    return { x: pl.tx, z: pl.tz, speed: pl.speed };
  }

  // ------------------------------------------------------------------ the game
  sim(dt) {
    const G = this.g;
    const b = this.ball;
    const game = this.game;
    G.t += dt;
    for (let i = 0; i < 2; i++) this.hype[i] = Math.max(0, this.hype[i] - dt);
    // (a shot, a fright, somebody hurt: the game stops; it goes on when all is calm)
    let scared = false;
    for (const x of this.people) if (!x.c.alive || x.c.headless || x.c.panicT > 0) scared = true;
    if (scared) this.panicT = 4;
    else this.panicT = Math.max(0, this.panicT - dt);
    const pp = game.player.pos;
    const onCourt = this.inCourt(pp.x, pp.z, 0.3) && Math.abs(pp.y - CURB) < 2.5;
    if ((scared || onCourt) && HALTS.has(G.phase)) {
      G.resume = G.phase === 'tip' ? 'tip' : 'inbound';
      this.setPhase('halt');
      this.stats.halts++;
      if (onCourt && !scared && this.ref) {
        game.audio.play('whistle', 0.8);
        game.bubbles.say(this.ref.c, pick(SAY.ref));
      }
    }
    if (LIVE.has(G.phase) && !(G.phase === 'shot' && G.clock <= 0)) {
      G.clock -= dt * PACE;
      if (G.phase === 'bring' || G.phase === 'set') G.shot -= dt * PACE;
      if (G.clock <= 0 && G.phase !== 'shot') {
        G.clock = 0;
        this.endQuarter();
      }
    }
    // the jumps
    for (const pl of this.players) {
      if (pl.jump < 0) continue;
      pl.jump += dt;
      const t = pl.jump / 0.62;
      pl.c.hopY = t < 1 ? Math.sin(t * Math.PI) * (pl.dunk ? 0.75 : 0.5) : 0;
      if (t >= 1) {
        pl.jump = -1;
        pl.dunk = false;
      }
    }
    switch (G.phase) {
      case 'tip':
        this.tip(dt);
        break;
      case 'inbound':
        this.inbound(dt);
        break;
      case 'bring':
      case 'set':
        this.play(dt);
        break;
      case 'shot':
        this.shotPlaces();
        break;
      case 'made':
        // (the scorers back on defence)
        this.marks(G.off, 3.6);
        if (G.t > 1.4) {
          G.off = 1 - G.off;
          G.side = 'base';
          this.setPhase('inbound');
        }
        break;
      case 'rebound':
        this.rebound();
        break;
      case 'break':
        this.huddle();
        if (G.t > 11) {
          G.q++;
          G.clock = QUARTER;
          G.off = G.q % 2;
          G.side = 'line';
          G.shot = 24;
          this.setPhase('inbound');
        }
        break;
      case 'final':
        this.final(dt);
        break;
      case 'halt':
        this.halt(onCourt, scared, dt);
        break;
    }
    // the referee along the sideline with the ball (the benches' side: the seats at the edge of
    // the court are on the other); the coaches in front of their benches
    if (this.ref && G.phase !== 'halt') {
      const r = this.ref;
      r.tx = this.A.court.x0 + 0.5;
      r.tz = Math.max(this.A.z - 11, Math.min(this.A.z + 11, b.p.z));
      r.speed = 3.2;
      r.face = Math.atan2(b.p.x - r.c.pos.x, b.p.z - r.c.pos.z);
    }
    for (const co of this.coaches) {
      co.armsT = (co.armsT || 0) - dt;
      co.tx = this.A.court.x0 - 0.3;
      co.tz = co.home + Math.max(-1.6, Math.min(1.6, (b.p.z - this.A.z) * 0.12));
      co.speed = 0.9;
      co.face = Math.atan2(b.p.x - co.c.pos.x, b.p.z - co.c.pos.z);
    }
    this.sayT -= dt;
    if (this.sayT < 0 && this.inHall && LIVE.has(G.phase)) {
      this.sayT = 5 + Math.random() * 6;
      const co = this.coaches[Math.random() < 0.5 ? 0 : 1];
      if (co && co.c.alive) {
        game.bubbles.say(co.c, pick(SAY.coach));
        co.armsT = 0.8;
      }
    }
  }

  // the tip-off: the centers face each other in the circle, the others round it in their own half;
  // the referee throws the ball up between them, they jump, one taps it to a guard
  tipPlaces() {
    const A = this.A;
    for (const pl of this.players) {
      const s = TEAMS[pl.team].s;
      if (pl.role === 4) {
        pl.tx = A.x;
        pl.tz = A.z - s * 0.6;
      } else {
        const a = ((pl.role - 1.5) / 3) * 2.2;
        pl.tx = A.x + Math.sin(a) * 3.4;
        pl.tz = A.z - s * Math.cos(a) * 3.4;
      }
      pl.speed = 2.4;
      pl.face = s > 0 ? 0 : Math.PI;
    }
  }

  tip() {
    const G = this.g;
    const b = this.ball;
    const A = this.A;
    this.tipPlaces();
    if (this.ref) {
      this.ref.tx = A.x + 0.9;
      this.ref.tz = A.z;
      this.ref.speed = 2.4;
    }
    if (G.t < 2.6) {
      b.mode = 'held';
      b.holder = null;
      b.p.set(A.x + 0.55, CURB + 1.2, A.z);
      return;
    }
    if (b.mode === 'held') {
      b.mode = 'toss';
      b.p.set(A.x, CURB + 1.9, A.z);
      b.v.set(0, 6.4, 0);
      if (this.inHall) this.game.audio.play('whistle', 0.5);
    }
    if (b.mode === 'toss' && b.v.y < 0.6 && !G.jumped) {
      G.jumped = true;
      for (const pl of this.players) if (pl.role === 4) pl.jump = 0;
    }
    if (b.mode === 'toss' && b.v.y < -0.6) {
      G.jumped = false;
      const win = Math.random() < 0.5 ? 0 : 1;
      G.off = win;
      G.shot = 24;
      G.passes = 0;
      this.passTo(this.players[win * 5], 9);
      this.setPhase('bring');
    }
  }

  // after a basket the other team takes it from under it; after a break, from the sideline
  inbound() {
    const G = this.g;
    const b = this.ball;
    const off = G.off;
    const ib = this.players[off * 5 + 3];
    const pg = this.players[off * 5];
    const s = TEAMS[off].s;
    if (G.side === 'base') this.pt(off, -1.6, COURT.l + 0.55, _c);
    else this.sideSpot(_c);
    if (b.holder !== ib) {
      if (b.mode === 'loose' || b.mode === 'net' || (b.mode === 'held' && (!b.holder || b.holder.kind === 'ref'))) {
        // (to the ball, to pick it up)
        ib.tx = b.p.x;
        ib.tz = b.p.z;
        ib.speed = 3;
        ib.face = null;
        if (Math.hypot(b.p.x - ib.c.pos.x, b.p.z - ib.c.pos.z) < (b.holder ? 1.1 : 0.8) && b.p.y < CURB + 1.6) {
          b.holder = ib;
          b.mode = 'held';
        }
      }
    } else {
      ib.tx = _c.x;
      ib.tz = _c.z;
      ib.speed = 3;
      ib.face = Math.atan2(pg.c.pos.x - ib.c.pos.x, pg.c.pos.z - ib.c.pos.z);
      if (Math.hypot(_c.x - ib.c.pos.x, _c.z - ib.c.pos.z) < 0.5 && G.t > 1.2 && b.mode === 'held') {
        this.passTo(pg, 10);
        G.shot = 24;
        G.passes = 0;
        this.setPhase('bring');
        return;
      }
    }
    // the guard comes to take it; the others up the floor to their places
    if (G.side === 'base') this.pt(off, 2.4, COURT.l - 4, _v);
    else _v.set(_c.x + 4.2, 0, _c.z - s * 1.5);
    pg.tx = _v.x;
    pg.tz = _v.z;
    pg.speed = 4;
    pg.face = Math.atan2(ib.c.pos.x - pg.c.pos.x, ib.c.pos.z - pg.c.pos.z);
    for (const pl of this.players) {
      if (pl.team !== off || pl === ib || pl === pg) continue;
      const [u, v] = SPOTS[pl.role][0];
      this.pt(off, u, v, _v);
      pl.tx = _v.x;
      pl.tz = _v.z;
      pl.speed = 4.6;
      pl.face = null;
    }
    this.marks(1 - off, 4.6);
  }

  // the defence: each between their man and the basket, a step off him (closer to the one with
  // the ball), facing him
  marks(def, speed) {
    const off = 1 - def;
    const b = this.ball;
    this.rimOf(off, _r);
    for (const pl of this.players) {
      if (pl.team !== def || pl.jump >= 0) continue;
      const man = this.players[off * 5 + pl.role];
      const mx = man.c.pos.x;
      const mz = man.c.pos.z;
      const dx = _r.x - mx;
      const dz = _r.z - mz;
      const L = Math.hypot(dx, dz) || 1;
      const gap = man === b.holder ? 1.0 : Math.min(2.4, 0.9 + L * 0.16);
      pl.tx = mx + (dx / L) * Math.min(gap, L * 0.7);
      pl.tz = mz + (dz / L) * Math.min(gap, L * 0.7);
      pl.speed = speed;
      pl.face = Math.atan2(mx - pl.c.pos.x, mz - pl.c.pos.z);
    }
  }

  // bringing it up, and the half-court game: passes, cuts, a drive, a shot
  play(dt) {
    const G = this.g;
    const b = this.ball;
    const off = G.off;
    const h = b.holder;
    this.rimOf(off, _r);
    const rx = _r.x;
    const rz = _r.z;
    for (const pl of this.players) {
      if (pl.team !== off || pl === h || pl.jump >= 0) continue;
      pl.altT -= dt;
      if (pl.altT < 0 && G.phase === 'set') {
        pl.alt ^= 1;
        pl.altT = 2.4 + Math.random() * 3.2;
      }
      const [u, v] = SPOTS[pl.role][G.phase === 'set' ? pl.alt : 0];
      this.pt(off, u, v, _v);
      pl.tx = _v.x;
      pl.tz = _v.z;
      pl.speed = G.phase === 'bring' ? 5 : 3.4;
      pl.face = h ? Math.atan2(h.c.pos.x - pl.c.pos.x, h.c.pos.z - pl.c.pos.z) : null;
    }
    this.marks(1 - off, G.phase === 'bring' ? 4.8 : 4.2);
    if (!h || h.team !== off || b.mode !== 'held') return;
    if (h.jump >= 0) return;
    if (G.phase === 'bring') {
      const [u, v] = SPOTS[h.role][0];
      this.pt(off, u, v, _v);
      h.tx = _v.x;
      h.tz = _v.z;
      h.speed = 3.6;
      h.face = null;
      if (Math.hypot(_v.x - h.c.pos.x, _v.z - h.c.pos.z) < 1.4 || G.t > 8) {
        this.setPhase('set');
        G.next = 0.8 + Math.random() * 0.8;
      }
      return;
    }
    // (driving to the basket: a lay-up when there)
    if (h.drive) {
      const s = TEAMS[off].s;
      h.tx = rx + h.drive * 0.7;
      h.tz = rz - s * 1.1;
      h.speed = 5.2;
      h.face = null;
      if (Math.hypot(h.tx - h.c.pos.x, h.tz - h.c.pos.z) < 0.9) this.shoot(h);
      return;
    }
    const [u, v] = SPOTS[h.role][h.alt];
    this.pt(off, u, v, _v);
    h.tx = _v.x;
    h.tz = _v.z;
    h.speed = 1.4;
    h.face = Math.atan2(rx - h.c.pos.x, rz - h.c.pos.z);
    G.next -= dt;
    if (G.shot < 3.5) {
      this.shoot(h);
      return;
    }
    if (G.next > 0) return;
    const r = Math.random();
    const d = Math.hypot(rx - h.c.pos.x, rz - h.c.pos.z);
    if (G.passes < 1 || (r < 0.55 && G.passes < 6)) this.pass(h);
    else if (r < 0.75 && h.role < 3) h.drive = Math.random() < 0.5 ? -1 : 1;
    else if (d < 8.5) this.shoot(h);
    else this.pass(h);
  }

  // a pass to a teammate (the one most open, mostly)
  pass(from) {
    const G = this.g;
    let best = null;
    let bs = -Infinity;
    for (const pl of this.players) {
      if (pl.team !== from.team || pl === from || pl.jump >= 0) continue;
      const d = Math.hypot(pl.c.pos.x - from.c.pos.x, pl.c.pos.z - from.c.pos.z);
      if (d < 2.5) continue;
      const man = this.players[(1 - pl.team) * 5 + pl.role];
      const open = Math.hypot(man.c.pos.x - pl.c.pos.x, man.c.pos.z - pl.c.pos.z);
      const sc = open + Math.random() * 2.5 - d * 0.08;
      if (sc > bs) {
        bs = sc;
        best = pl;
      }
    }
    if (!best) return;
    // (now and then a defender gets a hand to it)
    let to = best;
    if (Math.random() < 0.07) {
      const mx = (best.c.pos.x + from.c.pos.x) / 2;
      const mz = (best.c.pos.z + from.c.pos.z) / 2;
      let bd = 2.2;
      for (const pl of this.players) {
        if (pl.team === from.team) continue;
        const d = Math.hypot(pl.c.pos.x - mx, pl.c.pos.z - mz);
        if (d < bd) {
          bd = d;
          to = pl;
        }
      }
    }
    this.passTo(to, 11);
    G.passes++;
    G.next = 1.1 + Math.random() * 1.4;
    this.stats.passes++;
  }

  passTo(to, speed) {
    const b = this.ball;
    if (b.holder) {
      b.holder.c.fig.reachR = null;
      b.holder.c.fig.reachL = null;
    }
    b.mode = 'pass';
    b.holder = null;
    b.to = to;
    b.a.copy(b.p);
    const d = Math.hypot(to.c.pos.x - b.p.x, to.c.pos.z - b.p.z);
    b.T = Math.max(0.28, d / speed);
    b.t = 0;
    b.h = Math.min(1.1, d * 0.045);
  }

  // into their hands
  caught(pl) {
    const G = this.g;
    const b = this.ball;
    b.holder = pl;
    b.mode = 'held';
    b.to = null;
    pl.drive = 0;
    if (pl.kind !== 'player') return;
    if (pl.team !== G.off && LIVE.has(G.phase)) {
      // picked off!
      G.off = pl.team;
      G.shot = 24;
      G.passes = 0;
      this.setPhase('bring');
      this.hype[pl.team] = 1.6;
      this.stats.steals++;
      if (this.inHall) this.game.bubbles.say(pl.c, pick(SAY.steal));
    }
  }

  // up he goes: the ball over his head, let go at the top of the jump
  shoot(h) {
    const G = this.g;
    const b = this.ball;
    this.rimOf(G.off, _r);
    const d = Math.hypot(_r.x - h.c.pos.x, _r.z - h.c.pos.z);
    const three = d > 6.6;
    const p = d < 2.4 ? 0.64 : three ? 0.37 : 0.47;
    b.made = Math.random() < p;
    b.pts = three ? 3 : 2;
    b.mode = 'rise';
    b.release = d < 2.4 ? 0.26 : 0.22;
    b.shooter = h;
    h.jump = 0;
    h.dunk = d < 1.6 && Math.random() < 0.4;
    h.drive = 0;
    h.tx = h.c.pos.x;
    h.tz = h.c.pos.z;
    h.speed = 0;
    h.face = Math.atan2(_r.x - h.c.pos.x, _r.z - h.c.pos.z);
    h.c.fig.reachR = null;
    h.c.fig.reachL = null;
    this.setPhase('shot');
    this.stats.shots++;
  }

  // while it flies: the big men to the boards, the rest hold
  shotPlaces() {
    const G = this.g;
    const off = G.off;
    for (const pl of this.players) {
      if (pl.jump >= 0) continue;
      if (pl.team === off && pl.role >= 3) {
        this.pt(off, pl.role === 3 ? 1.7 : -1.7, 2.9, _v);
        pl.tx = _v.x;
        pl.tz = _v.z;
        pl.speed = 4.4;
      }
    }
    this.marks(1 - off, 4.4);
  }

  // where the shot comes down: in (through the net) or off the rim
  landShot() {
    const G = this.g;
    const b = this.ball;
    const game = this.game;
    this.rimOf(G.off, _r);
    b.rim.copy(_r);
    if (b.made) {
      b.mode = 'net';
      b.v.set(0, -1.4, 0);
      G.score[G.off] += b.pts;
      this.board();
      this.stats.baskets++;
      this.hype[G.off] = b.pts === 3 ? 4 : 3;
      if (this.near(18)) game.audio.play('swish', 1);
      if (this.inHall) {
        game.audio.play('roar', b.pts === 3 ? 1.1 : 0.85);
        if (b.shooter && Math.random() < 0.5) game.bubbles.say(b.shooter.c, pick(SAY.made));
      }
      this.setPhase('made');
    } else {
      b.mode = 'loose';
      // (off the rim, out over the court)
      const sh = b.shooter ? b.shooter.c.pos : this.A;
      const dx = sh.x - _r.x;
      const dz = sh.z - _r.z;
      const L = Math.hypot(dx, dz) || 1;
      const a = Math.atan2(dx / L, dz / L) + (Math.random() - 0.5) * 1.8;
      const sp = 1.8 + Math.random() * 2.4;
      b.v.set(Math.sin(a) * sp, 2.2 + Math.random() * 1.8, Math.cos(a) * sp);
      if (this.near(26)) game.audio.play('clang', 0.5);
      this.setPhase('rebound');
    }
  }

  // the loose ball: two of each side go for it, the first to it has it
  rebound() {
    const G = this.g;
    const b = this.ball;
    // (the two of each side nearest the ball)
    const chase = this.chase;
    chase.fill(null);
    const cd = this.chaseD;
    cd.fill(Infinity);
    for (const pl of this.players) {
      if (pl.jump >= 0) continue;
      const d = Math.hypot(pl.c.pos.x - b.p.x, pl.c.pos.z - b.p.z);
      const k = pl.team * 2;
      if (d < cd[k]) {
        cd[k + 1] = cd[k];
        chase[k + 1] = chase[k];
        cd[k] = d;
        chase[k] = pl;
      } else if (d < cd[k + 1]) {
        cd[k + 1] = d;
        chase[k + 1] = pl;
      }
    }
    for (const pl of this.players) {
      if (pl.jump >= 0) continue;
      if (chase.includes(pl)) {
        pl.tx = b.p.x;
        pl.tz = b.p.z;
        pl.speed = 5.4;
        pl.face = null;
        if (Math.hypot(b.p.x - pl.c.pos.x, b.p.z - pl.c.pos.z) < 0.75 && b.p.y < CURB + 2.7) {
          this.grab(pl);
          return;
        }
      } else if (pl.team === G.off) {
        const [u, v] = SPOTS[pl.role][0];
        this.pt(G.off, u, v, _v);
        pl.tx = _v.x;
        pl.tz = _v.z;
        pl.speed = 3;
      }
    }
    this.marks(1 - G.off, 4);
    // (a ball nobody gets to: the referee gives it to the defence)
    if (G.t > 9) {
      G.off = 1 - G.off;
      G.side = 'line';
      this.setPhase('inbound');
      const ib = this.players[G.off * 5 + 3];
      b.holder = ib;
      b.mode = 'held';
    }
  }

  grab(pl) {
    const G = this.g;
    const b = this.ball;
    b.holder = pl;
    b.mode = 'held';
    b.v.set(0, 0, 0);
    this.stats.rebounds++;
    if (pl.team === G.off) {
      // an offensive rebound: again, or straight back up with it
      G.shot = 14;
      this.setPhase('set');
      G.next = 0.5 + Math.random() * 0.8;
      this.rimOf(G.off, _r);
      if (Math.hypot(_r.x - pl.c.pos.x, _r.z - pl.c.pos.z) < 2.4 && Math.random() < 0.45) this.shoot(pl);
    } else {
      G.off = pl.team;
      G.shot = 24;
      G.passes = 0;
      this.setPhase('bring');
      if (pl.role !== 0) this.passTo(this.players[pl.team * 5], 10);
    }
  }

  // the horn: a break at the benches, or the end of the game
  endQuarter() {
    const G = this.g;
    const b = this.ball;
    this.stats.quarters++;
    if (this.near(60)) this.game.audio.play('buzzer', 1);
    for (const pl of this.players) {
      pl.c.fig.reachR = null;
      pl.c.fig.reachL = null;
    }
    b.holder = null;
    b.mode = 'loose';
    b.v.set(0, 0, 0);
    if (G.q >= 4) {
      this.setPhase('final');
      const w = G.score[0] === G.score[1] ? -1 : G.score[0] > G.score[1] ? 0 : 1;
      G.winner = w;
      if (w >= 0) this.hype[w] = 7;
      if (this.inHall) this.game.hud.toast(`FINAL · ${TEAMS[0].name} ${G.score[0]} – ${G.score[1]} ${TEAMS[1].name}`, 'good', 4);
    } else this.setPhase('break');
  }

  // at the benches between quarters, round their coach
  huddle() {
    const A = this.A;
    for (const pl of this.players) {
      const a = (pl.role / 5) * Math.PI * 2;
      pl.tx = A.court.x0 + 1.8 + Math.cos(a) * 1.3;
      pl.tz = A.z + (pl.team ? 6 : -6) + Math.sin(a) * 1.3;
      pl.speed = 2.2;
      pl.face = Math.atan2(A.court.x0 + 1.8 - pl.c.pos.x, A.z + (pl.team ? 6 : -6) - pl.c.pos.z);
    }
    const b = this.ball;
    if (this.ref) {
      // (the referee picks up the ball)
      this.ref.tx = b.p.x;
      this.ref.tz = b.p.z;
      this.ref.speed = 2;
      if (b.mode === 'loose' && Math.hypot(b.p.x - this.ref.c.pos.x, b.p.z - this.ref.c.pos.z) < 0.8) {
        b.holder = this.ref;
        b.mode = 'held';
      }
    }
  }

  // the winners jump about in the middle; then a new game
  final() {
    const G = this.g;
    const A = this.A;
    for (const pl of this.players) {
      if (pl.team === G.winner) {
        const a = (pl.role / 5) * Math.PI * 2 + G.t * 0.4;
        pl.tx = A.x + Math.cos(a) * 1.6;
        pl.tz = A.z + Math.sin(a) * 1.6;
        pl.speed = 2;
        if (pl.jump < 0 && Math.random() < 0.02) pl.jump = 0;
      } else {
        pl.tx = A.court.x0 + 1.4;
        pl.tz = A.z + (pl.team ? 6 : -6) + (pl.role - 2) * 0.8;
        pl.speed = 1.3;
      }
    }
    if (G.t > 22) this.newGame(false);
  }

  // stopped: everybody where they are, looking at you (or away from the trouble)
  halt(onCourt, scared, dt) {
    const G = this.g;
    const pp = this.game.player.pos;
    for (const pl of this.players) {
      pl.tx = pl.c.pos.x;
      pl.tz = pl.c.pos.z;
      pl.speed = 0;
      pl.face = Math.atan2(pp.x - pl.c.pos.x, pp.z - pl.c.pos.z);
    }
    if (this.ref) {
      this.ref.speed = 0;
      this.ref.face = Math.atan2(pp.x - this.ref.c.pos.x, pp.z - this.ref.c.pos.z);
    }
    if (onCourt || scared || this.panicT > 0) {
      this.offT = 0;
      return;
    }
    this.offT += dt;
    if (this.offT < 1.5) return;
    // (all calm: from the sideline)
    if (G.resume === 'tip') this.setPhase('tip');
    else {
      G.side = 'line';
      this.setPhase('inbound');
      const ib = this.players[G.off * 5 + 3];
      if (this.ball.mode !== 'pass') {
        this.ball.holder = ib;
        this.ball.mode = 'held';
      }
    }
  }

  // ------------------------------------------------------------------ the ball
  moveBall(dt) {
    const b = this.ball;
    const G = this.g;
    switch (b.mode) {
      case 'held': {
        const h = b.holder;
        if (!h) break;
        const c = h.c;
        const fx = Math.sin(c.yaw);
        const fz = Math.cos(c.yaw);
        const dribble = h.kind === 'player' && (G.phase === 'bring' || G.phase === 'set') && h.jump < 0;
        if (dribble) {
          const sp = Math.hypot(c.vel.x, c.vel.z);
          const before = Math.sin(b.dribble);
          b.dribble += dt * (7 + sp * 0.9);
          const now = Math.sin(b.dribble);
          if (before * now < 0 && this.near(16)) this.game.audio.play('bounce', 0.5);
          const k = Math.abs(now);
          // (beside him, a little in front, the hand over it)
          b.p.set(c.pos.x + fx * 0.3 + fz * 0.3, CURB + FLOOR + R_BALL + k * 0.8, c.pos.z + fz * 0.3 - fx * 0.3);
          c.fig.reachR = h.hand.set(b.p.x, Math.max(b.p.y + R_BALL, CURB + 0.8), b.p.z);
          c.fig.reachL = null;
        } else {
          b.p.set(c.pos.x + fx * 0.36, c.pos.y + 1.12, c.pos.z + fz * 0.36);
          if (h.kind === 'player' || h.kind === 'ref') {
            c.fig.reachR = h.hand.set(b.p.x + fz * 0.1, b.p.y, b.p.z - fx * 0.1);
            c.fig.reachL = h.hand2.set(b.p.x - fz * 0.1, b.p.y, b.p.z + fx * 0.1);
          }
        }
        break;
      }
      case 'rise': {
        // (over his head as he goes up)
        const h = b.shooter;
        const c = h.c;
        b.p.set(c.pos.x + Math.sin(c.yaw) * 0.18, c.pos.y + 2.2, c.pos.z + Math.cos(c.yaw) * 0.18);
        b.release -= dt;
        if (b.release <= 0) {
          this.rimOf(G.off, _r);
          b.a.copy(b.p);
          const d = Math.hypot(_r.x - b.p.x, _r.z - b.p.z);
          if (b.made) b.end.set(_r.x, _r.y + 0.08, _r.z);
          else {
            // (the near side of the rim, or the far)
            const s = Math.random() < 0.5 ? 1 : -1;
            const ux = (_r.x - b.p.x) / (d || 1);
            const uz = (_r.z - b.p.z) / (d || 1);
            b.end.set(_r.x + ux * 0.24 * s + (Math.random() - 0.5) * 0.12, _r.y + 0.08, _r.z + uz * 0.24 * s);
          }
          b.T = 0.72 + d * 0.05;
          b.h = h.dunk ? 0.2 : 1.1 + d * 0.11;
          b.t = 0;
          b.mode = 'shot';
          if (h.dunk) {
            b.T = 0.24;
            b.made = true;
          }
        }
        break;
      }
      case 'pass': {
        const to = b.to;
        b.t += dt / b.T;
        const t = Math.min(1, b.t);
        const tc = to.c;
        _v.set(tc.pos.x + Math.sin(tc.yaw) * 0.32, tc.pos.y + 1.1, tc.pos.z + Math.cos(tc.yaw) * 0.32);
        b.p.lerpVectors(b.a, _v, t);
        b.p.y += Math.sin(t * Math.PI) * b.h;
        b.spin += dt * 9;
        if (b.t >= 1) this.caught(to);
        break;
      }
      case 'shot': {
        b.t += dt / b.T;
        const t = Math.min(1, b.t);
        b.p.lerpVectors(b.a, b.end, t);
        b.p.y += 4 * b.h * t * (1 - t);
        b.spin += dt * 7;
        if (b.t >= 1) this.landShot();
        break;
      }
      case 'net': {
        // (down through the net, then free)
        b.v.y -= 9.8 * dt;
        b.p.y += b.v.y * dt;
        b.p.x = damp(b.p.x, b.rim.x, 12, dt);
        b.p.z = damp(b.p.z, b.rim.z, 12, dt);
        if (b.p.y < b.rim.y - 0.5) {
          b.mode = 'loose';
          const s = Math.sign(b.rim.z - this.A.z);
          b.v.set((Math.random() - 0.5) * 0.8, b.v.y, s * (0.4 + Math.random() * 0.6));
        }
        break;
      }
      case 'toss':
      case 'loose': {
        b.v.y -= 9.8 * dt;
        b.p.addScaledVector(b.v, dt);
        const floor = CURB + FLOOR + R_BALL;
        if (b.p.y < floor) {
          b.p.y = floor;
          if (b.v.y < -0.9) {
            b.v.y = -b.v.y * 0.6;
            if (this.near(18)) this.game.audio.play('bounce', Math.min(1, -b.v.y / 4));
          } else b.v.y = 0;
          b.v.x *= 0.86;
          b.v.z *= 0.86;
        }
        if (b.p.y <= floor + 0.01) {
          const k = Math.exp(-1.6 * dt);
          b.v.x *= k;
          b.v.z *= k;
        }
        // (the boards round the floor: in front of the stands)
        const C = this.A.court;
        if (b.p.x < C.x0 - 1.6 || b.p.x > C.x1 + 1.6) {
          b.v.x = -b.v.x * 0.5;
          b.p.x = Math.max(C.x0 - 1.6, Math.min(C.x1 + 1.6, b.p.x));
        }
        if (b.p.z < C.z0 - 2.2 || b.p.z > C.z1 + 2.2) {
          b.v.z = -b.v.z * 0.5;
          b.p.z = Math.max(C.z0 - 2.2, Math.min(C.z1 + 2.2, b.p.z));
        }
        b.spin += dt * Math.hypot(b.v.x, b.v.z) * 4;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ the stands
  // the people in the seats, a few dozen a frame until all are there (game/arenagame.js draws them
  // cheaply: render/people.js drawCheap)
  makeFans() {
    const A = this.A;
    if (this.fans && this.fanQ >= A.seats.length) return;
    if (!this.fans) {
      this.fans = [];
      this.fanQ = 0;
    }
    const fill = this.game.touch ? 0.42 : 0.86;
    const end = Math.min(A.seats.length, this.fanQ + 40);
    const ha = (A.hall.x1 - A.hall.x0) / 2;
    const hb = (A.hall.z1 - A.hall.z0) / 2;
    for (; this.fanQ < end; this.fanQ++) {
      const s = A.seats[this.fanQ];
      if (Math.random() > fill) continue;
      const L = civilianLook();
      // (most in their team's colour)
      if (Math.random() < 0.6) L.top.color = TEAMS[s.team].col.map((v) => v * (0.85 + Math.random() * 0.2));
      this.fans.push({ x: s.x, y: s.y, z: s.z, yaw: s.yaw, look: L, seed: Math.random() * 100, phase: Math.random() * 6, speed: 0, scale: 0.93 + Math.random() * 0.1, sit: 1, cheer: 0, pump: Math.random() * 6, team: s.team, keen: Math.random(), solo: 8 + Math.random() * 40, ang: Math.atan2((s.z - A.z) / hb, (s.x - A.x) / ha) });
    }
  }

  // on their feet when their team scores, a wave going round now and then, someone shouting
  crowd(dt) {
    const G = this.g;
    if (!this.fans) return;
    G.waveT -= dt;
    if (G.wave === null && G.waveT < 0 && (G.phase === 'break' || Math.random() < 0.004)) {
      G.wave = -Math.PI;
      G.waveT = 40 + Math.random() * 40;
    }
    if (G.wave !== null) {
      G.wave += dt * 1.7;
      if (G.wave > Math.PI + 0.6) G.wave = null;
    }
    const scared = this.panicT > 0;
    const flying = G.phase === 'shot' ? G.off : -1;
    for (const f of this.fans) {
      let want = 0;
      if (this.hype[f.team] > 0 && f.keen < 0.85) want = 1;
      else if (flying === f.team && f.keen < 0.4) want = 0.35;
      if (G.wave !== null) {
        let d = Math.abs(f.ang - G.wave);
        if (d > Math.PI) d = Math.PI * 2 - d;
        if (d < 0.3) want = 1;
      }
      f.solo -= dt;
      if (f.solo < 0) {
        f.solo = 20 + Math.random() * 50;
        f.soloT = 1.8;
      }
      if (f.soloT > 0) {
        f.soloT -= dt;
        want = Math.max(want, 0.8);
      }
      if (scared) want = 1;
      f.cheer = damp(f.cheer, want, 5 + f.keen * 3, dt);
      f.sit = 1 - Math.min(1, f.cheer * 1.15);
      f.pump += dt * (scared ? 0 : 8 + f.keen * 4) * f.cheer;
    }
  }

  // the arena's sounds: the crowd's murmur, the sneakers on the boards
  sounds(dt) {
    if (!this.inHall) return;
    const audio = this.game.audio;
    this.murmurT -= dt;
    if (this.murmurT < 0) {
      this.murmurT = 1.3 + Math.random() * 0.9;
      audio.play('roar', 0.14 + Math.random() * 0.06);
    }
    const G = this.g;
    this.squeakT -= dt;
    if (this.squeakT < 0 && (G.phase === 'set' || G.phase === 'rebound' || G.phase === 'bring')) {
      this.squeakT = 0.35 + Math.random() * 1.1;
      audio.play('squeak', 0.6 + Math.random() * 0.5);
    }
  }

  // somebody you would hear from where you are
  near(r) {
    const cam = this.game.camera.position;
    const b = this.ball.p;
    return Math.hypot(cam.x - b.x, cam.z - b.z) < r && (this.inHall || r > 40);
  }

  // ------------------------------------------------------------------ you
  // a seat at the edge of the court: E, and you watch the game from there
  target() {
    if (!this.on || !this.A || this.game.player.seat) return null;
    const p = this.game.player.pos;
    for (const s of this.A.courtside) {
      if (s.taken) continue;
      if (Math.hypot(p.x - s.x, p.z - s.z) < 1.3) return { label: 'E — לשבת בשורה הראשונה ולצפות במשחק ($25)', seat: s };
    }
    return null;
  }

  interact() {
    const t = this.target();
    if (!t) return false;
    const game = this.game;
    if (game.money && !game.money.pay(25, 'שורה ראשונה')) {
      game.hud.toast(game.money.why(25), 'bad', 2.4);
      return true;
    }
    const s = t.seat;
    game.player.seat = { x: s.x, z: s.z, yaw: s.yaw, lock: false, arena: true };
    game.camRig.yaw = s.yaw;
    game.camRig.pitch = 0.05;
    game.hud.toast('בשורה הראשונה! הכי קרוב שאפשר (צעד אחד - וקמים)', 'good', 3);
    return true;
  }

  // the camera in a seat at the edge of the court: up behind your head, the court before you
  camOpts() {
    const st = this.game.player.seat;
    if (!st || !st.arena) return null;
    return { dist: 4.2, height: 2.4, shoulder: 0 };
  }

  // ------------------------------------------------------------------ the picture
  // the fans in the stands (only from inside: the walls hide them) and the ball
  draw() {
    if (!this.on || !this.A) return;
    const game = this.game;
    const bodies = game.figures.bodies;
    const cam = game.camera.position;
    if (this.fans && this.inside(cam.x, cam.z, 1.02)) {
      const fwd = game.camera.getWorldDirection(_f);
      const hl = Math.hypot(fwd.x, fwd.z) || 1;
      const fx = fwd.x / hl;
      const fz = fwd.z / hl;
      const max = game.touch ? 130 : 480;
      let n = 0;
      for (const f of this.fans) {
        const dx = f.x - cam.x;
        const dz = f.z - cam.z;
        const d = Math.hypot(dx, dz);
        if (d > 7 && (dx * fx + dz * fz) / d < 0.3) continue;
        bodies.drawCheap(f);
        if (++n >= max) break;
      }
    }
    const b = this.ball;
    if (Math.hypot(b.p.x - cam.x, b.p.z - cam.z) < 90) {
      _f.set(Math.sin(b.spin), 0, Math.cos(b.spin));
      _c.set(_f.z, 0, -_f.x);
      bodies.blob(b.p, _c, UP, _f, R_BALL, R_BALL, R_BALL, BALL_COL);
    }
  }

  // the score in the corner of your screen, while you are inside
  showBug(on) {
    if (!this.bug) {
      if (!on) return;
      const el = document.createElement('div');
      el.id = 'scorebug';
      el.dir = 'ltr';
      (document.getElementById('hud') || document.body).appendChild(el);
      this.bug = el;
    }
    this.bug.classList.toggle('hidden', !on);
    if (!on) return;
    const G = this.g;
    const t = Math.ceil(G.clock);
    const clock = G.phase === 'final' ? 'FINAL' : `Q${G.q} ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    const key = `${G.score[0]}|${G.score[1]}|${clock}`;
    if (key === this.bugKey) return;
    this.bugKey = key;
    this.bug.innerHTML = `<b class="t0">${TEAMS[0].name}</b> <span>${G.score[0]}</span> – <span>${G.score[1]}</span> <b class="t1">${TEAMS[1].name}</b> <i>${clock}</i>`;
  }
}

