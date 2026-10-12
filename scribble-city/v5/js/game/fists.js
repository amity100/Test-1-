import * as THREE from 'three';
import { clamp, damp } from '../core/util.js';

// (ROADMAP 5.4, not with ?classic) A fist fight. The bare fists are always there, second in the
// list after the pencil (2, or X / the wheel round to them). A click throws a jab with the left;
// a click while it lands carries on into a cross with the right, and a third into a front kick
// that puts them down. Held aim (right click, LT, the guard button on a phone) raises the guard:
// most of a blow from the front is taken on the arms, and a strike right after a block lands
// harder. No ink is rubbed out by a fist: people reel back, go down and get up again, and in the
// end stay down, out cold, seeing stars.

export const FISTS = { id: 'fists', name: 'אגרופים', kind: 'fists', bare: true, range: 1.7 };

// limb: L / R (a hand) or K (the right foot); dur: seconds; at: when in it the blow lands (0..1);
// dmg: how much it dazes; push: m/s it sends them back; reach: how far apart the two of you are
// when it lands (metres, centre to centre: an arm's length and a bit; a leg's for the kick)
const STRIKES = [
  { limb: 'L', dur: 0.3, at: 0.4, dmg: 16, push: 2.2, reach: 1.05, shake: 0.06, vol: 0.75 },
  { limb: 'R', dur: 0.36, at: 0.45, dmg: 23, push: 3.2, reach: 1.1, shake: 0.09, vol: 0.95 },
  { limb: 'K', dur: 0.52, at: 0.5, dmg: 34, push: 6.5, reach: 1.3, shake: 0.15, vol: 1.2, down: true },
];
// the quickest step into a blow (m/s), and how far it goes for someone (metres)
const LUNGE = 6;
const FIND = 3.2;
// a click this long after a strike still carries the combo on
const CHAIN = 0.42;
// how long getting back up takes
const UP = 0.75;
// a passer-by out cold lies there this long, then gets up and runs
export const CIV_KO = 7;
// an enemy out cold lies there seeing stars this long before the drawing fades
export const KO_T = 6;
// (the city's line shader turns dark pens into thin outline ink: the bursts are drawn in a bright
// comic yellow, the stars a deeper one)
const POW = [1.15, 0.95, 0.42];
const STAR = [1.0, 0.8, 0.16];
const _r = new THREE.Vector3();
const _u = new THREE.Vector3();

export class Fists {
  constructor(game) {
    this.game = game;
    this.strike = null; // { i, s, t, hit, next, target }
    this.step = 0; // the next one in the combo
    this.chainT = 9; // seconds since the last strike ended
    this.guard = 0; // the guard up (0..1)
    this.guarding = false;
    this.stance = 0; // the fists still up after a fight (0..1, fading)
    this.stunT = 0; // rocked by a blow: no strike for a moment
    this.blockT = -10; // when a blow was last taken on the guard
    this.faceYaw = null; // where to turn: whoever the strike is aimed at
    this.bursts = []; // the little ink stars where blows land
    this.stats = { strikes: 0, hits: 0, blocked: 0, guarded: 0, downs: 0, kos: 0 };
  }

  get busy() {
    return this.strike !== null;
  }

  // the fists put away (another weapon, a car, the water): the arms let go
  idle(fig, dt) {
    this.strike = null;
    this.guarding = false;
    this.guard = 0;
    this.stance = 0;
    this.faceYaw = null;
    if (fig.punch >= 0 || fig.kick >= 0 || fig.guard > 0) {
      fig.punch = -1;
      fig.kick = -1;
      fig.guard = 0;
    }
    if (this.bursts.length) this.drawBursts(dt);
  }

  update(dt, input) {
    const game = this.game;
    const P = game.player;
    const fig = P.fig;
    if (this.stunT > 0) this.stunT -= dt;
    this.chainT += dt;
    if (this.chainT > CHAIN) this.step = 0;
    this.stance = Math.max(0, this.stance - dt / 3);
    this.guarding = input.aim && !this.strike && P.onGround && !P.crouched;
    this.guard = damp(this.guard, this.guarding ? 1 : 0, 16, dt);
    if (input.firePressed && this.stunT <= 0) {
      if (!this.strike) this.begin(this.chainT <= CHAIN ? this.step : 0);
      else if (this.strike.t > 0.25) this.strike.next = true;
    }
    const st = this.strike;
    if (st) {
      const s = st.s;
      st.t += dt / s.dur;
      // turned to whoever it is aimed at, with a step in to be an arm's length off as it lands
      const tg = st.target;
      if (tg && tg.alive) {
        const dx = tg.pos.x - P.pos.x;
        const dz = tg.pos.z - P.pos.z;
        const d = Math.hypot(dx, dz);
        this.faceYaw = Math.atan2(dx, dz);
        const left = (s.at - st.t) * s.dur;
        if (left > 0 && d > s.reach - 0.1) {
          const v = Math.min(LUNGE, (d - s.reach + 0.1) / Math.max(left, 1 / 30));
          P.lunge = { x: (dx / d) * v, z: (dz / d) * v };
        }
      }
      if (!st.hit && st.t >= s.at) {
        st.hit = true;
        this.land(st);
      }
      if (st.t >= 1) {
        this.strike = null;
        this.chainT = 0;
        this.step = (st.i + 1) % STRIKES.length;
        if (st.next && this.stunT <= 0) this.begin(this.step);
      }
    }
    if (!this.strike) this.faceYaw = null;
    // the pose (game/doodle.js)
    const k = this.strike;
    fig.punch = k && k.s.limb !== 'K' ? Math.min(1, k.t) : -1;
    fig.punchSide = k && k.s.limb === 'L' ? -1 : 1;
    fig.kick = k && k.s.limb === 'K' ? Math.min(1, k.t) : -1;
    fig.guard = Math.max(this.guard, this.stance * 0.75);
    this.drawBursts(dt);
  }

  begin(i) {
    const game = this.game;
    const P = game.player;
    const s = STRIKES[i];
    this.strike = { i, s, t: 0, hit: false, next: false, target: this.pick() };
    this.stance = 1;
    this.stats.strikes++;
    game.audio.play('swing', i === 2 ? 0.7 : 0.45);
    // (into the fight: ROADMAP 5.3's crouch is over)
    if (P.crouched) P.setCrouch(false);
  }

  // who the next blow is for: the nearest one in front of where you look, a few steps away at most
  // (the gang first; never the friend you drew)
  pick() {
    const game = this.game;
    const p = game.player.pos;
    const cy = game.camRig.yaw;
    const fx = Math.sin(cy);
    const fz = Math.cos(cy);
    let best = null;
    let bs = Infinity;
    const look = (o, extra) => {
      const dx = o.pos.x - p.x;
      const dz = o.pos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > FIND || Math.abs(o.pos.y - p.y) > 1.3) return;
      const c = (dx * fx + dz * fz) / (d || 1);
      if (c < 0.4 && d > 1) return;
      const sc = d * (1.6 - c) + extra;
      if (sc < bs) {
        bs = sc;
        best = o;
      }
    };
    for (const e of game.enemies.list) if (e.alive) look(e, 0);
    for (const c of game.civilians.list) if (this.hittable(c)) look(c, 0.8);
    return best;
  }

  // (never the friend you drew: brave, and no robber)
  hittable(c) {
    return c.alive && !c.inside && !c.riding && !(c.brave && !c.criminal);
  }

  // the blow lands: on whoever is in reach in front (the one it was aimed at first), else on a car
  // or a wall
  land(st) {
    const game = this.game;
    const P = game.player;
    const s = st.s;
    const f = P.fig.forward;
    const p = P.pos;
    const reach = (o) => o && o.alive && Math.abs(o.pos.y - p.y) < 1.3 && Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < s.reach + 0.25 + (o.radius || 0.35) && (o.pos.x - p.x) * f.x + (o.pos.z - p.z) * f.z > -0.2;
    let who = reach(st.target) ? st.target : null;
    if (!who) {
      let bd = Infinity;
      for (const e of game.enemies.inArc(p, f, s.reach + 0.25, 0.8)) {
        const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
        if (Math.abs(e.pos.y - p.y) < 1.3 && d < bd) {
          bd = d;
          who = e;
        }
      }
      if (!who) {
        for (const c of game.civilians.inArc(p, f, s.reach + 0.25, 0.8)) {
          const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
          if (this.hittable(c) && Math.abs(c.pos.y - p.y) < 1.3 && d < bd) {
            bd = d;
            who = c;
          }
        }
      }
    }
    // (a strike straight after a blow was blocked: the counter, harder; the fighting skill, ROADMAP
    // 5.6)
    const sk = game.skills;
    const power = (game.time - this.blockT < 0.8 ? 1.6 : 1) * (sk ? sk.fightMul : 1);
    if (who) {
      const res = who.mgr === game.enemies ? game.enemies.strike(who, s, f, power) : game.civilians.struck(who, s, f, power);
      if (!res) return;
      const at = who.isMonster || s.limb === 'K' ? who.fig.center : who.fig.j.headC;
      this.burst(at.x - f.x * 0.12, at.y + (s.limb === 'K' ? 0 : -0.05), at.z - f.z * 0.12, res === 'blocked' ? 0.7 : s.limb === 'K' ? 1.35 : power > 1 ? 1.25 : 1);
      if (res === 'blocked') {
        this.stats.blocked++;
        game.audio.play('block', 0.8);
      } else {
        this.stats.hits++;
        if (sk) sk.add('fight', 1);
        game.audio.play('punch', s.vol * power);
        if (res === 'down') this.stats.downs++;
        if (res === 'ko') this.stats.kos++;
      }
      game.camRig.addShake(s.shake * (res === 'blocked' ? 0.5 : power));
      game.enemies.noise(p, 14);
      return;
    }
    // nobody: a car takes the kick (a small dent), a wall a thud
    const j = P.fig.j;
    const limb = s.limb === 'K' ? j.footR : s.limb === 'L' ? j.handL : j.handR;
    const car = game.traffic.inArc(p, f, s.reach);
    if (car) {
      if (s.limb === 'K') game.damage.hit(car, limb.x + f.x * 0.2, limb.y, limb.z + f.z * 0.2, 7, true);
      this.burst(limb.x + f.x * 0.1, limb.y, limb.z + f.z * 0.1, 0.8);
      game.audio.play('punch', 0.45);
      game.camRig.addShake(0.05);
      return;
    }
    const h = game.world.collision.raycast(p.x, p.y + (s.limb === 'K' ? 0.6 : 1.45), p.z, f.x, 0, f.z, s.reach, 'bound');
    if (h) {
      this.burst(h.x - f.x * 0.05, h.y, h.z - f.z * 0.05, 0.7);
      game.fx.crumbs(h.x, h.y, h.z, 3, 1.2);
      game.audio.play('punch', 0.4);
      game.camRig.addShake(0.04);
    }
  }

  // a blow at the hero while the fists are out (Weapons.block): taken on the guard if it is up and
  // the blow comes from the front (a fist, a club, a bite - not a shot); caught open, it knocks the
  // strike out of you. Returns what gets through
  block(amount, fromX, fromZ, kind, src) {
    const game = this.game;
    const P = game.player;
    if (kind !== 'melee' || P.mode !== 'foot') return amount;
    const dx = fromX - P.pos.x;
    const dz = fromZ - P.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const f = P.fig.forward;
    if (this.guard > 0.6 && (dx * f.x + dz * f.z) / d > 0.25) {
      this.blockT = game.time;
      this.stats.guarded++;
      game.audio.play('block');
      const h = P.fig.j.handL;
      this.burst(h.x + f.x * 0.12, h.y + 0.05, h.z + f.z * 0.12, 0.65);
      // rocked back a step; whoever swung is off balance a moment
      P.vel.x -= (dx / d) * 2.5;
      P.vel.z -= (dz / d) * 2.5;
      if (src && src.fig && !src.isMonster) {
        src.reelT = Math.max(src.reelT || 0, 0.4);
        src.fig.recoil = 0.6;
      }
      return amount * 0.2;
    }
    P.fig.recoil = 1;
    P.fig.recoilSide = (dx * P.fig.right.x + dz * P.fig.right.z) / d > 0 ? -1 : 1;
    if (amount >= 10) {
      this.strike = null;
      this.stunT = 0.3;
    }
    return amount;
  }

  // a little star of strokes where a blow lands, gone in a moment
  burst(x, y, z, size) {
    this.bursts.push({ x, y, z, size, t: 0, seed: Math.random() * 50 });
  }

  drawBursts(dt) {
    if (!this.bursts.length) return;
    const fr = this.game.figures;
    const q = this.game.camera.quaternion;
    const r = _r.set(1, 0, 0).applyQuaternion(q);
    const u = _u.set(0, 1, 0).applyQuaternion(q);
    for (const b of this.bursts) {
      b.t += dt;
      const k = b.t / 0.18;
      if (k >= 1) continue;
      const R0 = (0.07 + k * 0.1) * b.size;
      const R1 = (0.2 + k * 0.14) * b.size;
      for (let i = 0; i < 7; i++) {
        const an = b.seed + i * 0.898;
        const c = Math.cos(an);
        const s = Math.sin(an);
        const rr = i % 2 ? R1 * 0.7 : R1;
        const ox = r.x * c + u.x * s;
        const oy = r.y * c + u.y * s;
        const oz = r.z * c + u.z * s;
        fr.lineXYZ(b.x + ox * R0, b.y + oy * R0, b.z + oz * R0, b.x + ox * rr, b.y + oy * rr, b.z + oz * rr, POW, 4.2, b.seed + i, 1 - k * k, 0.01, 0);
      }
    }
    if (this.bursts.every((b) => b.t >= 0.18)) this.bursts.length = 0;
  }
}

// knocked off their feet (an enemy, a passer-by): on the ground for o.downT, then back up over a
// moment (o.upT). Returns true while it lasts; the caller moves the body (the knock slides it)
export function downStep(o, dt) {
  const fig = o.fig;
  if (o.downT > 0) {
    o.downT -= dt;
    fig.dead = Math.min(1, fig.dead + dt * 3.4);
    if (o.downT <= 0) o.upT = UP;
  } else {
    o.upT -= dt;
    const k = clamp(1 - o.upT / UP, 0, 1);
    fig.dead = 1 - k;
    fig.crouch = Math.sin(k * Math.PI) * 0.9;
    if (o.upT <= 0) {
      o.upT = 0;
      fig.dead = 0;
      fig.crouch = 0;
      return false;
    }
  }
  fig.speed = 0;
  fig.air = false;
  fig.melee = -1;
  fig.punch = -1;
  fig.aim = 0;
  return true;
}

// out cold: little stars going round over the head
export function drawStars(game, head, t, a, seed) {
  const fr = game.figures;
  const q = game.camera.quaternion;
  const r = _r.set(1, 0, 0).applyQuaternion(q);
  const u = _u.set(0, 1, 0).applyQuaternion(q);
  const y = head.y + 0.28;
  for (let i = 0; i < 3; i++) {
    const an = t * 3 + i * 2.094 + seed;
    const sx = head.x + Math.cos(an) * 0.3;
    const sz = head.z + Math.sin(an) * 0.3;
    const sy = y + Math.sin(an * 2) * 0.05;
    for (let k = 0; k < 3; k++) {
      // a little star: three strokes across each other
      const b = t * 2 + k * 1.047 + i;
      const c = Math.cos(b) * 0.065;
      const s = Math.sin(b) * 0.065;
      fr.lineXYZ(sx - r.x * c - u.x * s, sy - r.y * c - u.y * s, sz - r.z * c - u.z * s, sx + r.x * c + u.x * s, sy + r.y * c + u.y * s, sz + r.z * c + u.z * s, STAR, 3, seed + i * 3 + k, a, 0.004, 0);
    }
  }
}
