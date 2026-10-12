import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../core/util.js';
import { groundHeight } from '../world/layout.js';

// (ROADMAP 5.1; never with ?classic) Climbing.
//
// - Up a wall, a fence, a car: jump (Space) in front of something you can reach the top of (up to
//   about three metres) and you pull yourself up onto it - or, if it is thin, over it and down the
//   other side (but not over a drop: you stay on top, it is your call to jump).
// - The ways up to the roofs (world/roofs.js): at the foot of a fire escape's ladder, or of a
//   ladder up a back wall, E; W climbs, S goes back down, Space lets go. At the top you step over
//   the edge onto the roof; from up there, E at the top of one takes you down. A fall onto a fire
//   escape's landing catches you there, on the way.
//
// While on one the hero is in the 'climb' mode (game/player.js hands the frame over to here).

const _p = { x: 0, y: 0, z: 0, seg: null };
// (the low bounds too: the promenade's railing and the pier's sides, over into the bay - with
// swimming, ROADMAP 5.2; the city's high edges are out of reach anyway)
const CAN_HOLD = new Set(['wall', 'prop', 'car', 'furniture', 'board', 'roomwall', 'bound']);
// (a rung's step: the legs' turn every two of them)
const LEGS = 0.64;

// where a line from (x, z) along (fx, fz) goes into a box and out of it (null: it misses)
function through(x, z, fx, fz, b) {
  let t0 = -Infinity;
  let t1 = Infinity;
  for (const [p, d, lo, hi] of [[x, fx, b.x0, b.x1], [z, fz, b.z0, b.z1]]) {
    if (Math.abs(d) < 1e-6) {
      if (p < lo || p > hi) return null;
    } else {
      let a = (lo - p) / d;
      let c = (hi - p) / d;
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, c);
    }
  }
  if (t1 < t0 || t1 < 0) return null;
  return [t0, t1];
}

const ease = (k) => k * k * (3 - 2 * k);

export class Climb {
  constructor(game) {
    this.game = game;
    const R = game.world.roofs;
    this.routes = R ? R.routes : [];
    this.col = R ? R.col : null;
    // on a way up: { route, s, v, blend, from }
    this.on = null;
    // pulling yourself up onto something: { t, dur, from, a, to, vault, f }
    this.mantle = null;
  }

  // the solid boxes up there and down here, both (fn as Collision.forEachIn's)
  each(x0, z0, x1, z1, fn) {
    let stop = false;
    const g = (b) => (stop = fn(b) === true);
    this.game.world.collision.forEachIn(x0, z0, x1, z1, g);
    if (!stop && this.col) this.col.forEachIn(x0, z0, x1, z1, g);
  }

  // room for you standing at (x, y, z): nothing solid from your feet up to over your head
  roomAt(x, y, z, r = 0.3, h = 1.75) {
    let hit = false;
    this.each(x - r, z - r, x + r, z + r, (b) => {
      if (b.y1 <= y + 0.05 || b.y0 >= y + h) return false;
      const cx = clamp(x, b.x0, b.x1);
      const cz = clamp(z, b.z0, b.z1);
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) {
        hit = true;
        return true;
      }
      return false;
    });
    return !hit;
  }

  // the highest floor under (x, z) no higher than y (the ground, or the top of a box)
  floorAt(x, z, y) {
    let f = groundHeight(x, z);
    this.each(x - 0.05, z - 0.05, x + 0.05, z + 0.05, (b) => {
      if (b.y1 <= y + 0.05 && b.y1 > f && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) f = b.y1;
      return false;
    });
    return f;
  }

  // ---------------------------------------------------------------- the ways up
  // the foot or the top of one, near you: { route, end: 'bottom' | 'top', label }
  target() {
    const p = this.game.player;
    if (p.mode !== 'foot' || !p.onGround || !this.routes.length) return null;
    let best = null;
    let bd = 1.5;
    for (const r of this.routes) {
      if (r.bottom) {
        const a = r.first;
        const d = Math.hypot(a.x - p.pos.x, a.z - p.pos.z);
        if (d < bd && Math.abs(a.y - p.pos.y) < 1.0) {
          bd = d;
          best = { route: r, end: 'bottom' };
        }
      }
      const b = r.last;
      const d = Math.hypot(b.x - p.pos.x, b.z - p.pos.z);
      if (d < bd && Math.abs(b.y - p.pos.y) < 1.0) {
        bd = d;
        best = { route: r, end: 'top' };
      }
    }
    if (!best) return null;
    const esc = best.route.kind === 'escape';
    best.label = best.end === 'bottom' ? (esc ? 'לטפס במדרגות החירום' : 'לטפס בסולם לגג') : esc ? 'לרדת במדרגות החירום' : 'לרדת בסולם';
    return best;
  }

  interact() {
    const t = this.target();
    if (!t) return false;
    this.start(t.route, t.end === 'top' ? t.route.len : 0);
    return true;
  }

  start(route, s) {
    const p = this.game.player;
    p.mode = 'climb';
    p.vel.set(0, 0, 0);
    p.onGround = true;
    this.mantle = null;
    this.on = { route, s, v: 0, blend: 0, from: p.pos.clone(), yaw: p.yaw, tick: 0 };
    // (iron underfoot, iron in the hands)
    this.game.audio.play('clang', 0.25);
  }

  // off it: at an end, onto your feet; or letting go (a push away from the wall)
  off(jump = false) {
    const p = this.game.player;
    const fig = p.fig;
    const o = this.on;
    this.on = null;
    p.mode = 'foot';
    fig.reachR = null;
    fig.reachL = null;
    // (letting go at either end of it: just a hop where you are)
    if (jump && o && (o.s < 0.3 || o.s > o.route.len - 1.3)) {
      p.onGround = false;
      p.vel.set(0, 3, 0);
    } else if (jump && o) {
      const f = o.route.f;
      const seg = o.route.at(o.s, _p).seg;
      const ox = f ? f.nx : -Math.sin(p.yaw);
      const oz = f ? f.nz : -Math.cos(p.yaw);
      p.onGround = false;
      if (seg.kind === 'ladder') p.vel.set(ox * 2.6, 2.2, oz * 2.6);
      // (off a landing: up and over its rail)
      else p.vel.set(ox * 3.2, 7.2, oz * 3.2);
      p.yaw = Math.atan2(ox, oz);
      this.game.audio.play('jump', 0.6);
    } else {
      p.vel.set(0, 0, 0);
      p.onGround = true;
    }
  }

  // a fall that comes down on a fire escape's landing: you are on it, on the way
  catchFall() {
    const p = this.game.player;
    if (!this.col || p.mode !== 'foot' || p.pos.y < 3.5) return false;
    let hit = null;
    this.col.forEachIn(p.pos.x - 0.2, p.pos.z - 0.2, p.pos.x + 0.2, p.pos.z + 0.2, (b) => {
      if (b.tag === 'escape' && Math.abs(b.y1 - p.pos.y) < 0.15) {
        hit = b;
        return true;
      }
      return false;
    });
    if (!hit) return false;
    this.start(hit.data.route, hit.data.s);
    return true;
  }

  // ---------------------------------------------------------------- pulling yourself up
  // in front of you (the way you go, else the way you face): something to climb onto or over?
  tryMantle(dx, dz) {
    const p = this.game.player;
    if (p.mode !== 'foot' || this.on || this.mantle) return false;
    const m = this.ledge(dx, dz);
    if (!m) return false;
    this.mantle = m;
    p.mode = 'climb';
    p.vel.set(0, 0, 0);
    p.yaw = Math.atan2(m.fx, m.fz);
    this.game.audio.play('jump', 0.35);
    return true;
  }

  // (a hint, now and then: standing at something you could climb, ROADMAP 5.1)
  get hint() {
    const g = this.game;
    const p = g.player;
    if (p.mode !== 'foot' || !p.onGround || p.fig.speed > 2.2) return null;
    if (g.time - (this._hintT || -1) > 0.25) {
      this._hintT = g.time;
      const m = this.ledge(0, 0, 0.55);
      this._hint = m ? (g.touch && !g.pad.active ? 'קפיצה — לטפס' : 'רווח — לטפס') : null;
    }
    return this._hint;
  }

  // what pulling yourself up there would be: { t, dur, from, a, edge, to, vault, fx, fz } or null
  // (near: how far in front of you it may start, past your own width)
  ledge(dx, dz, near = 0.75) {
    const p = this.game.player;
    let fx = dx;
    let fz = dz;
    const l = Math.hypot(fx, fz);
    if (l < 0.3) {
      fx = Math.sin(p.yaw);
      fz = Math.cos(p.yaw);
    } else {
      fx /= l;
      fz /= l;
    }
    const y = p.pos.y;
    // (in the air you reach less high than standing at the foot of it with a jump in your legs)
    const reach = p.onGround ? 2.9 : 2.2;
    const x = p.pos.x;
    const z = p.pos.z;
    let best = null;
    let bt = p.radius + near;
    let span = null;
    this.each(x - 1.4, z - 1.4, x + 1.4, z + 1.4, (b) => {
      if (!CAN_HOLD.has(b.tag)) return false;
      if (b.y0 > y + 0.6 || b.y1 <= y + 0.6 || b.y1 > y + reach) return false;
      const t = through(x, z, fx, fz, b);
      if (!t || t[0] < 0 || t[0] > bt) return false;
      bt = t[0];
      best = b;
      span = t;
      return false;
    });
    if (!best) return null;
    const top = best.y1;
    const ex = x + fx * span[0];
    const ez = z + fz * span[0];
    const depth = span[1] - span[0];
    // over it, if it is thin and there is room past it and no great drop
    let to = null;
    let vault = false;
    // (the promenade's railing stands on the sea wall's broad top: over both, into the bay)
    if (depth < (best.tag === 'bound' ? 1.5 : 0.9)) {
      const vx = ex + fx * (depth + 0.5);
      const vz = ez + fz * (depth + 0.5);
      const below = this.floorAt(vx, vz, top);
      if (top - below < 3.2 && this.roomAt(vx, top + 0.1, vz, 0.3, 1.0) && this.roomAt(vx, below, vz)) {
        to = { x: vx, y: top + 0.15, z: vz };
        vault = true;
      }
    }
    // onto it, if you can stand on it
    if (!to && depth >= 0.45) {
      const k = Math.min(0.45, depth / 2);
      const tx = ex + fx * k;
      const tz = ez + fz * k;
      if (this.floorAt(tx, tz, top + 0.1) >= top - 0.05 && this.roomAt(tx, top, tz, 0.28)) to = { x: tx, y: top, z: tz };
    }
    if (!to) return null;
    // (and room over the edge to pull yourself up through)
    if (!this.roomAt(ex + fx * 0.1, top, ez + fz * 0.1, 0.2, 1.4)) return null;
    const rise = top - y;
    return {
      t: 0,
      dur: 0.38 + Math.max(0, rise) * 0.17,
      from: { x, y, z },
      a: { x: ex - fx * 0.32, y: top - 0.55, z: ez - fz * 0.32 },
      edge: { x: ex, y: top, z: ez },
      to,
      vault,
      fx,
      fz,
    };
  }

  stepMantle(dt) {
    const p = this.game.player;
    const fig = p.fig;
    const m = this.mantle;
    m.t += dt;
    const k = Math.min(1, m.t / m.dur);
    const pos = p.pos;
    if (k < 0.55) {
      const q = ease(k / 0.55);
      pos.set(m.from.x + (m.a.x - m.from.x) * q, m.from.y + (m.a.y - m.from.y) * q, m.from.z + (m.a.z - m.from.z) * q);
    } else {
      const q = ease((k - 0.55) / 0.45);
      // (over the top in an arc)
      const lift = m.vault ? Math.sin(q * Math.PI) * 0.25 : Math.sin(q * Math.PI) * 0.12;
      pos.set(m.a.x + (m.to.x - m.a.x) * q, m.a.y + (m.to.y - m.a.y) * q + lift, m.a.z + (m.to.z - m.a.z) * q);
    }
    // the hands on the edge, either side
    const rx = -m.fz;
    const rz = m.fx;
    const handsOn = k < 0.85;
    if (handsOn) {
      fig.reachR = (this._hr || (this._hr = new THREE.Vector3())).set(m.edge.x - rx * 0.22, m.edge.y + 0.03, m.edge.z - rz * 0.22);
      fig.reachL = (this._hl || (this._hl = new THREE.Vector3())).set(m.edge.x + rx * 0.22, m.edge.y + 0.03, m.edge.z + rz * 0.22);
    } else {
      fig.reachR = null;
      fig.reachL = null;
    }
    fig.yaw = p.yaw;
    fig.speed = 0;
    fig.air = k < 0.9;
    fig.climb = damp(fig.climb || 0, 0, 10, dt);
    fig.update(dt);
    if (k >= 1) {
      this.mantle = null;
      p.mode = 'foot';
      fig.reachR = null;
      fig.reachL = null;
      if (m.vault) {
        // down the other side
        p.onGround = false;
        p.vel.set(m.fx * 2.6, 0.5, m.fz * 2.6);
      } else {
        p.onGround = true;
        p.vel.set(0, 0, 0);
      }
    }
  }

  // ---------------------------------------------------------------- each frame, in the climb mode
  update(dt, input) {
    const p = this.game.player;
    const fig = p.fig;
    if (this.mantle) return this.stepMantle(dt);
    const o = this.on;
    if (!o) {
      p.mode = 'foot';
      return;
    }
    const r = o.route;
    const talking = this.game.dialog && this.game.dialog.open;
    const mv = talking ? { x: 0, y: 0, sprint: false } : input.readMove();
    if (!talking && input.wasPressed('Space')) return this.off(true);
    const seg0 = r.at(o.s, _p).seg;
    const sp = (seg0.kind === 'ladder' ? 1.8 : 2.6) * (mv.sprint ? 1.35 : 1);
    o.v = damp(o.v, clamp(mv.y, -1, 1) * sp, 9, dt);
    o.s += o.v * dt;
    // off at either end, going on
    if (o.s >= r.len && mv.y > 0.2) {
      p.pos.set(r.last.x, r.last.y, r.last.z);
      const a = r.pts[r.pts.length - 2];
      p.yaw = Math.atan2(r.last.x - a.x, r.last.z - a.z);
      return this.off(false);
    }
    if (o.s <= 0 && mv.y < -0.2) {
      p.pos.set(r.first.x, r.first.y, r.first.z);
      return this.off(false);
    }
    o.s = clamp(o.s, 0, r.len);
    const at = r.at(o.s, _p);
    const seg = at.seg;
    // (the rungs and the landings ring a little under your feet)
    const tick = Math.floor(o.s / (seg.kind === 'ladder' ? LEGS : 0.75));
    if (tick !== o.tick) {
      o.tick = tick;
      this.game.audio.play('clang', seg.kind === 'ladder' ? 0.12 : 0.07);
    }
    // (onto it from where you stood, quickly)
    o.blend = Math.min(1, o.blend + dt / 0.3);
    const b = ease(o.blend);
    p.pos.set(o.from.x + (at.x - o.from.x) * b, o.from.y + (at.y - o.from.y) * b, o.from.z + (at.z - o.from.z) * b);
    p.vel.set(0, 0, 0);
    if (seg.kind === 'ladder') {
      // facing the wall, hand over hand, a foot up a rung and then the other
      p.yaw = dampAngle(p.yaw, seg.face, 14, dt);
      fig.climb = damp(fig.climb || 0, 1, 10, dt);
      fig.climbPh = (at.y / LEGS) * Math.PI * 2;
      fig.speed = 0;
      const rx = -Math.cos(p.yaw);
      const rz = Math.sin(p.yaw);
      const ph = fig.climbPh;
      const base = at.y + 1.48;
      fig.reachR = (this._hr || (this._hr = new THREE.Vector3())).set(seg.lx + rx * 0.25, base + Math.max(0, Math.sin(ph + Math.PI)) * 0.3, seg.lz + rz * 0.25);
      fig.reachL = (this._hl || (this._hl = new THREE.Vector3())).set(seg.lx - rx * 0.25, base + Math.max(0, Math.sin(ph)) * 0.3, seg.lz - rz * 0.25);
    } else {
      // walking: along a landing, up the stairs, over the edge
      fig.climb = damp(fig.climb || 0, 0, 10, dt);
      fig.reachR = null;
      fig.reachL = null;
      if (Math.abs(o.v) > 0.05) {
        const dx = (seg.b.x - seg.a.x) * Math.sign(o.v);
        const dz = (seg.b.z - seg.a.z) * Math.sign(o.v);
        if (Math.hypot(dx, dz) > 0.05) p.yaw = dampAngle(p.yaw, Math.atan2(dx, dz), 10, dt);
      }
      // (the walk: as fast as it goes along the ground)
      const flat = Math.hypot(seg.b.x - seg.a.x, seg.b.z - seg.a.z) / Math.max(0.01, seg.len);
      fig.speed = Math.abs(o.v) * Math.max(0.5, flat);
    }
    fig.yaw = p.yaw;
    fig.air = false;
    fig.sit = 0;
    fig.update(dt);
  }

  // what the prompt says while you are on one
  get prompt() {
    if (!this.on) return null;
    return this.game.touch && !this.game.pad.active ? 'למעלה/למטה עם המקל · קפיצה — לעזוב' : 'W/S — למעלה/למטה · רווח — לעזוב';
  }
}

