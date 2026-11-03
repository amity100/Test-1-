import * as THREE from 'three';
import { clamp } from '../core/util.js';
import { boxOf, pathLen, inPoly, straightness, isHeart, halves, isScribble, isLoop, xOf } from './signshape.js';

// (ROADMAP 11.9) Quick signs: a stroke or two drawn in the air that act at once, where they are
// drawn - no drawing to finish, nothing to make. Each is a thing the city asks for:
// - a heart: patched up (ink for blood)
// - an X over a car: it stops dead, its tyres flat - a police car on your tail too
// - a loop round people: tied up in ink rope, on the ground a while
// - a scribble: a cloud of ink there - nobody sees through it, and inside it you are hidden
// - a line from you up to a roof: an ink rope that pulls you up there
// Each costs ink. Told apart by their shapes and by what is under them (a car under the X,
// people in the loop, the hero at the start of the rope): a drawing that only starts like one
// stays a drawing. Strokes in the drawing's units ([x, y]; U px each), as ui/freedraw.js has them.

export const SIGNS = {
  heart: { name: 'לב', what: 'ריפוי', cost: 15 },
  stop: { name: 'איקס על מכונית', what: 'עוצרת', cost: 10 },
  tie: { name: 'לולאה סביב אנשים', what: 'קשורים', cost: 10 },
  cloud: { name: 'קשקוש', what: 'ענן דיו', cost: 15 },
  rope: { name: 'קו מכם לגג', what: 'חבל', cost: 8 },
};

const INK = [0.13, 0.1, 0.22];
const RED = [0.88, 0.16, 0.32];
const HEAL = 40;
const TIE_T = 8;
const CLOUD_T = 9;
const CLOUD_R = 5;
const STOP_T = 14;

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _u = new THREE.Vector3();
const _r = new THREE.Vector3();
const _ray = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b1 = new THREE.Vector3();
const _b2 = new THREE.Vector3();

export class Signs {
  constructor(game) {
    this.game = game;
    this.ties = [];
    this.stops = [];
    this.clouds = [];
    this.hearts = [];
    this.zip = null;
    this.stats = { heart: 0, stop: 0, tie: 0, cloud: 0, rope: 0 };
  }

  // ------------------------------------------------------------------ where things are on screen
  screen(x, y, z) {
    const cam = this.game.camera;
    _v.set(x, y, z).project(cam);
    return { x: ((_v.x + 1) / 2) * window.innerWidth, y: ((1 - _v.y) / 2) * window.innerHeight, front: _v.z < 1 && _v.z > -1 };
  }

  // the ray from the eye through a point of the screen (px)
  ray(sx, sy) {
    const cam = this.game.camera;
    _ray.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1, 0.5).unproject(cam).sub(cam.position).normalize();
    return { o: cam.position, d: _ray };
  }

  // a box in the street (a car), on screen: { x0, y0, x1, y1 } | null (behind the eye)
  boxOnScreen(cx, cz, yaw, hl, hw, h) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        for (const y of [0, h]) {
          const lx = b * hw;
          const lz = a * hl;
          const q = this.screen(cx + lx * c + lz * s, y, cz - lx * s + lz * c);
          if (!q.front) return null;
          x0 = Math.min(x0, q.x);
          x1 = Math.max(x1, q.x);
          y0 = Math.min(y0, q.y);
          y1 = Math.max(y1, q.y);
        }
      }
    }
    return { x0, y0, x1, y1 };
  }

  // ------------------------------------------------------------------ reading a sign
  // strokes: the page's ([x, y] each, the drawing's units), U: px a unit. Returns the sign
  // ({ id, ... where and on whom }) or null
  match(strokes, U) {
    const game = this.game;
    const p = game.player;
    if (!strokes.length || strokes.length > 2 || p.mode !== 'foot') return null;
    const S = strokes.map((P) => P.map(([x, y]) => [x * U, y * U]));
    if (S.length === 2) {
      const H = halves(S[0], S[1]);
      if (H && isHeart(H)) return { id: 'heart' };
      return this.matchStop(S);
    }
    const P = S[0];
    if (P.length < 4) return null;
    const B = boxOf(P);
    const L = pathLen(P);
    if (isScribble(P)) return this.matchCloud(B);
    if (isHeart(P)) return { id: 'heart' };
    const loop = this.matchTie(P, B);
    if (loop) return loop;
    return this.matchRope(P, L);
  }

  matchStop(S) {
    const X = xOf(S[0], S[1]);
    if (!X) return null;
    // the car under it (of the traffic and the cars along the curb): the one the X sits on best -
    // in its middle, and of its size (a car near you covers half the screen; the X is drawn on
    // the one it is meant for)
    const game = this.game;
    const cam = game.camera.position;
    let best = null;
    let bc = Infinity;
    for (const car of [...game.traffic.list, ...(game.traffic.parked || [])]) {
      if (car.poofT !== undefined || car.taken) continue;
      const d = Math.hypot(car.pos.x - cam.x, car.pos.z - cam.z);
      if (d > 60) continue;
      const b = this.boxOnScreen(car.pos.x, car.pos.z, car.yaw, car.halfLen || 2.3, car.halfWid || 1, car.bus ? 3 : 1.6);
      if (!b) continue;
      const hw = Math.max(1, (b.x1 - b.x0) / 2);
      const hh = Math.max(1, (b.y1 - b.y0) / 2);
      const off = Math.max(Math.abs(X.x - (b.x0 + b.x1) / 2) / hw, Math.abs(X.y - (b.y0 + b.y1) / 2) / hh);
      if (off > 1.15) continue;
      const cs = Math.max(b.x1 - b.x0, b.y1 - b.y0);
      const k = X.size / cs;
      if (k > 1.8 || k < 0.22) continue;
      const cost = off + Math.abs(Math.log(k / 0.8)) * 0.5 + d * 0.002;
      if (cost < bc) {
        best = car;
        bc = cost;
      }
    }
    return best ? { id: 'stop', car: best } : null;
  }

  matchTie(P, B) {
    if (!isLoop(P)) return null;
    const game = this.game;
    const who = [];
    let ux0 = Infinity;
    let uy0 = Infinity;
    let ux1 = -Infinity;
    let uy1 = -Infinity;
    for (const e of game.enemies.list) {
      if (!e.alive || e.headless || e.isMonster || (e.tiedT || 0) > game.time) continue;
      if (Math.hypot(e.pos.x - game.player.pos.x, e.pos.z - game.player.pos.z) > 45) continue;
      const c = e.fig.center;
      const q = this.screen(c.x, c.y, c.z);
      if (!q.front || !inPoly(q.x, q.y, P)) continue;
      const top = this.screen(e.pos.x, e.pos.y + (e.height || 1.8), e.pos.z);
      const bot = this.screen(e.pos.x, e.pos.y, e.pos.z);
      const h = Math.abs(bot.y - top.y);
      ux0 = Math.min(ux0, q.x - h * 0.3);
      ux1 = Math.max(ux1, q.x + h * 0.3);
      uy0 = Math.min(uy0, top.y);
      uy1 = Math.max(uy1, bot.y);
      who.push(e);
      if (who.length >= 4) break;
    }
    if (!who.length) return null;
    // (round them, not round the street they stand in: a loop not many times their size)
    const area = Math.max(1, (ux1 - ux0) * (uy1 - uy0));
    if (B.w * B.h > area * 5) return null;
    return { id: 'tie', who };
  }

  matchCloud(B) {
    const game = this.game;
    const p = game.player.pos;
    // where it is drawn, on the ground (near enough), else round you
    const r = this.ray(B.cx, B.cy);
    let x = p.x;
    let z = p.z;
    if (r.d.y < -0.02) {
      const t = (p.y + 0.2 - r.o.y) / r.d.y;
      const hx = r.o.x + r.d.x * t;
      const hz = r.o.z + r.d.z * t;
      if (Math.hypot(hx - p.x, hz - p.z) < 26) {
        x = hx;
        z = hz;
      }
    }
    return { id: 'cloud', x, z };
  }

  matchRope(P, L) {
    if (straightness(P) < 0.85 || L < window.innerHeight * 0.18) return null;
    const game = this.game;
    const pl = game.player;
    const a = P[0];
    const b = P[P.length - 1];
    // from you: its start on the hero
    const top = this.screen(pl.pos.x, pl.pos.y + 1.8, pl.pos.z);
    const bot = this.screen(pl.pos.x, pl.pos.y, pl.pos.z);
    const h = Math.abs(bot.y - top.y);
    // (from your top half: a drawing's lines start all over the screen, and you take up a lot of it)
    if (Math.abs(a[0] - top.x) > h * 0.3 || a[1] < top.y - h * 0.1 || a[1] > top.y + h * 0.6) return null;
    // up: steeper than 20 degrees
    if (b[1] > a[1] || Math.atan2(a[1] - b[1], Math.abs(b[0] - a[0])) < 0.35) return null;
    // (the end where it was meant: a little past it or short of it, a little to the side)
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    for (const [f, sd] of [[0, 0], [10, 0], [-10, 0], [20, 0], [-20, 0], [0, 8], [0, -8], [32, 0], [-32, 0]]) {
      const to = this.roofAt(b[0] + ux * f - uy * sd, b[1] + uy * f + ux * sd);
      if (to) return { id: 'rope', ...to };
    }
    return null;
  }

  // the roof the screen point (px) is on, or over the wall it is on: where to stand
  roofAt(sx, sy) {
    const game = this.game;
    const pl = game.player;
    const r = this.ray(sx, sy);
    const col = game.world.collision;
    const h = col.raycast(r.o.x, r.o.y, r.o.z, r.d.x, r.d.y, r.d.z, 70);
    if (!h || !h.box) return null;
    const G = game.gadgets;
    if (!G || !game.climb) return null;
    // (a step into the building from where the line hit it, and its top there)
    const nx = Math.abs(h.ny) > 0.5 ? 0 : h.nx;
    const nz = Math.abs(h.ny) > 0.5 ? 0 : h.nz;
    for (const inset of [0.7, 1.4, 2.2]) {
      const x = h.x - nx * inset;
      const z = h.z - nz * inset;
      const y = G.floorAt(x, z, 400);
      if (y < pl.pos.y + 2.5 || y > pl.pos.y + 45) continue;
      if (Math.hypot(x - pl.pos.x, z - pl.pos.z) > 40) return null;
      // (the line's end at the top: on the roof, or on the wall's last few metres under it)
      if (y - h.y > 3.5) return null;
      if (!game.climb.roomAt(x, y, z, 0.3, 1.7)) continue;
      return { x, y, z, ax: h.x, ay: y, az: h.z };
    }
    return null;
  }

  // ------------------------------------------------------------------ doing it
  run(sg) {
    const game = this.game;
    const info = SIGNS[sg.id];
    const ink = game.ink;
    if (ink && ink.level < info.cost) {
      game.hud.toast(`אין מספיק דיו ל${info.what} (צריך ${info.cost})`, 'bad', 2);
      game.audio.play('meh', 0.5);
      return false;
    }
    if (ink) ink.spend(info.cost);
    this.stats[sg.id]++;
    const t = game.time;
    const p = game.player;
    const fx = game.fx;
    if (sg.id === 'heart') {
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + HEAL);
      if (p.fig.holes) p.fig.holes.splice(0, 2);
      p.lastHurt = Math.min(p.lastHurt || 0, t - 4);
      this.hearts.push({ t0: t });
      game.audio.play('magic', 0.6);
      game.hud.toast(`❤ ריפוי +${Math.round(p.hp - before)}`, 'good', 1.6);
    } else if (sg.id === 'stop') {
      const c = sg.car;
      c.stopped = true;
      c.crashed = true;
      c.hazard = true;
      c.path = null;
      c.speed *= 0.35;
      c.inkStop = t;
      if (c.police) {
        c.mode = 'stalled';
        c.siren = false;
      } else if (!c.parkedCar) c.outT = t + 1.4;
      this.stops.push({ c, t0: t, seed: 9000 + Math.floor(Math.random() * 500) });
      fx.sparks(c.pos.x, 0.5, c.pos.z, 12, [0.15, 0.12, 0.25]);
      fx.smoke(c.pos.x, 0.8, c.pos.z, 1.6);
      game.audio.play('skid', 0.6);
      game.audio.play('snip', 0.5);
      game.hud.toast(c.police ? '✕ ניידת המשטרה נעצרה — הצמיגים שטוחים' : '✕ המכונית נעצרה — הצמיגים שטוחים', 'good', 1.8);
    } else if (sg.id === 'tie') {
      for (const e of sg.who) {
        e.tiedT = t + TIE_T;
        e.downT = Math.max(e.downT || 0, TIE_T);
        e.upT = 0;
        e.sees = false;
        e.aimT = 0;
        e.attackT = -1;
        e.pendingHit = null;
        if (e.leaveCover) e.leaveCover();
        e.say('hit', 'alarm');
        this.ties.push({ e, t0: t, seed: 9600 + this.ties.length * 7 });
      }
      game.audio.play('whoosh', 0.5);
      game.audio.play('glue', 0.5);
      game.hud.toast(sg.who.length > 1 ? `◯ ${sg.who.length} קשורים בחבל דיו` : '◯ קשור בחבל דיו', 'good', 1.6);
    } else if (sg.id === 'cloud') {
      this.puff(sg.x, sg.z);
      game.hud.toast('☁ ענן דיו — בתוכו אף אחד לא רואה אתכם', 'good', 2);
    } else if (sg.id === 'rope') {
      const from = p.pos.clone();
      const to = new THREE.Vector3(sg.x, sg.y, sg.z);
      const d = from.distanceTo(to);
      this.zip = { from, to, anchor: new THREE.Vector3(sg.ax, sg.ay, sg.az), t: 0, dur: clamp(d / 14, 0.55, 1.5) };
      p.mode = 'zip';
      p.vel.set(0, 0, 0);
      game.audio.play('whoosh', 0.8);
    }
    return true;
  }

  // a cloud of ink at (x, z), r across, for T seconds: nobody sees through it, and inside it you
  // are hidden (a scribble; a shot of purple ink, game/weapons.js - ROADMAP 11.11)
  puff(x, z, r = CLOUD_R, T = CLOUD_T) {
    const game = this.game;
    const fx = game.fx;
    const p = game.player;
    // (not too many at once: the oldest goes first)
    if (this.clouds.length >= 8) {
      const old = this.clouds.shift();
      const hs = game.world.hideSpots;
      const k = hs.indexOf(old);
      if (k >= 0) hs.splice(k, 1);
    }
    const spot = { x, z, r, kind: 'ink', until: game.time + T };
    game.world.hideSpots.push(spot);
    this.clouds.push(spot);
    const n = Math.round(clamp(20 * (r / CLOUD_R) * (r / CLOUD_R), 6, 20));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r * 0.85;
      fx.sprite(Math.random() < 0.5 ? 'smoke0' : 'smoke1', x + Math.cos(a) * d, 0.6 + Math.random() * (0.6 + r * 0.4), z + Math.sin(a) * d, {
        size: (2.6 + Math.random() * 1.6) * Math.min(1, 0.4 + r / CLOUD_R), grow: 0.25, life: T - 0.5 + Math.random(), vy: 0.04, alpha: 0.93, tint: INK, fadeIn: 0.15,
      });
    }
    // (those who had you in their sights lose you)
    for (const e of game.enemies.list) {
      if (e.alive && this.blocks(e.pos.x, e.pos.z, p.pos.x, p.pos.z)) {
        e.sees = false;
        e.aimT = 0;
      }
    }
    game.audio.play('poof', 0.7);
    return spot;
  }

  // (game/enemies.js, game/police.js) does a cloud stand between a and b (on the ground's plane)
  blocks(ax, az, bx, bz) {
    for (const c of this.clouds) {
      const dx = bx - ax;
      const dz = bz - az;
      const L2 = dx * dx + dz * dz || 1e-9;
      const t = clamp(((c.x - ax) * dx + (c.z - az) * dz) / L2, 0, 1);
      if (Math.hypot(ax + dx * t - c.x, az + dz * t - c.z) < c.r * 0.9) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ the rope up (player.js)
  // true while it lasts
  zipStep(dt) {
    const z = this.zip;
    const game = this.game;
    const p = game.player;
    if (!z) return false;
    z.t += dt;
    const k = clamp(z.t / z.dur, 0, 1);
    // pulled up to the edge (over its top), then a step on to the roof
    if (k < 0.85) {
      const q = k / 0.85;
      const e = q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2;
      _w.set(z.anchor.x, z.anchor.y + 0.5, z.anchor.z);
      p.pos.lerpVectors(z.from, _w, e);
      p.pos.y += Math.sin(q * Math.PI) * 1.2;
    } else {
      const q = (k - 0.85) / 0.15;
      _w.set(z.anchor.x, z.anchor.y + 0.5, z.anchor.z);
      p.pos.lerpVectors(_w, z.to, q);
      p.pos.y += Math.sin(q * Math.PI) * 0.3;
    }
    p.vel.set(0, 0, 0);
    const fig = p.fig;
    p.yaw = Math.atan2(z.to.x - z.from.x, z.to.z - z.from.z);
    fig.yaw = p.yaw;
    fig.air = true;
    fig.speed = 0;
    fig.update(dt);
    if (k >= 1) {
      this.zip = null;
      p.pos.copy(z.to);
      p.mode = 'foot';
      fig.air = false;
      game.fx.crumbs(p.pos.x, p.pos.y + 0.1, p.pos.z, 8, 2);
      game.audio.play('clang', 0.25);
      return false;
    }
    return true;
  }

  // ------------------------------------------------------------------ each frame: what it left
  update(dt) {
    const game = this.game;
    const t = game.time;
    const fr = game.figures;
    const cam = game.camera;
    _r.set(1, 0, 0).applyQuaternion(cam.quaternion);
    _u.set(0, 1, 0).applyQuaternion(cam.quaternion);
    // the rope you go up on
    if (this.zip) {
      const h = game.player.fig.j.handR;
      const a = this.zip.anchor;
      fr.lineXYZ(h.x, h.y, h.z, a.x, a.y, a.z, INK, 6, 9101, 1, 0.01, 0);
    }
    // little ink hearts going up off you
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const H = this.hearts[i];
      const k = (t - H.t0) / 1.3;
      if (k >= 1) {
        this.hearts.splice(i, 1);
        continue;
      }
      const p = game.player.pos;
      for (let j = 0; j < 4; j++) {
        const an = j * 1.57 + k * 2;
        const cx = p.x + Math.cos(an) * 0.55;
        const cz = p.z + Math.sin(an) * 0.55;
        const cy = p.y + 0.8 + k * 1.6 + j * 0.15;
        this.heartAt(fr, cx, cy, cz, 0.13, RED, 1 - k, 9200 + j * 13);
      }
    }
    // the cars stopped: a big X of ink on them a while
    for (let i = this.stops.length - 1; i >= 0; i--) {
      const S = this.stops[i];
      const c = S.c;
      if (t - S.t0 > STOP_T || c.poofT !== undefined) {
        this.stops.splice(i, 1);
        continue;
      }
      c.speed *= Math.exp(-4 * dt);
      // (a police car after you, its tyres gone: they get out and come on foot)
      if (c.police && c.crew && c.crew.length && t - S.t0 > 1 && game.police.hostile) {
        game.traffic.park(c);
        game.police.deploy(c);
      }
      // (as it was drawn: facing you, over the car - just in front of its side that faces you)
      const a = Math.min(1, (STOP_T - (t - S.t0)) / 2);
      const r = c.bus ? 1.7 : 1.05;
      const cy = c.bus ? 2.2 : 1.15;
      let vx = cam.position.x - c.pos.x;
      let vz = cam.position.z - c.pos.z;
      const vl = Math.hypot(vx, vz) || 1;
      vx /= vl;
      vz /= vl;
      const along = Math.abs(vx * Math.sin(c.yaw) + vz * Math.cos(c.yaw));
      const ext = along * (c.halfLen || 2.3) + Math.sqrt(Math.max(0, 1 - along * along)) * (c.halfWid || 1) + 0.3;
      const ox = c.pos.x + vx * ext;
      const oz = c.pos.z + vz * ext;
      // (a marker's X, in the red of the sign: each stroke gone over twice)
      for (let k = 0; k < 4; k++) {
        const sx = k & 1 ? -1 : 1;
        const j = (k >> 1) * 0.06;
        fr.lineXYZ(
          ox + (-_r.x * sx + _u.x) * r + _u.x * j, cy + (-_r.y * sx + _u.y) * r + _u.y * j, oz + (-_r.z * sx + _u.z) * r + _u.z * j,
          ox + (_r.x * sx - _u.x) * r - _r.x * j, cy + (_r.y * sx - _u.y) * r - _r.y * j, oz + (_r.z * sx - _u.z) * r - _r.z * j,
          RED, 13, S.seed + k, a, 0.05, 0.05,
        );
      }
    }
    // the tied: rope round them while it lasts
    for (let i = this.ties.length - 1; i >= 0; i--) {
      const T = this.ties[i];
      const e = T.e;
      if (!e.alive || t > (e.tiedT || 0)) {
        this.ties.splice(i, 1);
        continue;
      }
      // (held down: it lasts as long as the rope)
      if (e.downT < 0.5) e.downT = 0.5;
      e.sees = false;
      const j = e.fig.j;
      const head = j.headC;
      const knee = _w.lerpVectors(j.kneeR, j.kneeL, 0.5);
      const ax = _v.subVectors(knee, head);
      const len = ax.length() || 1;
      ax.divideScalar(len);
      for (let r = 0; r < 3; r++) {
        const k = 0.3 + r * 0.22;
        const cx = head.x + ax.x * len * k;
        const cy = head.y + ax.y * len * k;
        const cz = head.z + ax.z * len * k;
        this.ringAt(fr, cx, cy, cz, ax, 0.27, T.seed + r * 17);
      }
    }
    // the clouds: gone when their time is up
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      if (t < c.until) continue;
      this.clouds.splice(i, 1);
      const hs = game.world.hideSpots;
      const k = hs.indexOf(c);
      if (k >= 0) hs.splice(k, 1);
    }
  }

  // a ring of rope round an axis (the body lying there)
  ringAt(fr, cx, cy, cz, ax, rad, seed) {
    const a = _a.set(0, 1, 0);
    if (Math.abs(ax.y) > 0.9) a.set(1, 0, 0);
    const b1 = _b1.crossVectors(ax, a).normalize();
    const b2 = _b2.crossVectors(ax, b1).normalize();
    const n = 10;
    let px = 0;
    let py = 0;
    let pz = 0;
    for (let i = 0; i <= n; i++) {
      const an = (i / n) * Math.PI * 2;
      const x = cx + (b1.x * Math.cos(an) + b2.x * Math.sin(an)) * rad;
      const y = cy + (b1.y * Math.cos(an) + b2.y * Math.sin(an)) * rad;
      const z = cz + (b1.z * Math.cos(an) + b2.z * Math.sin(an)) * rad;
      if (i) fr.lineXYZ(px, py, pz, x, y, z, INK, 7, seed + i, 1, 0.008, 0);
      px = x;
      py = y;
      pz = z;
    }
  }

  // a little heart facing you
  heartAt(fr, cx, cy, cz, s, col, alpha, seed) {
    const r = _r;
    const u = _u;
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      const hx = 16 * Math.sin(t) ** 3;
      const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push([(hx / 17) * s, (hy / 17) * s]);
    }
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      fr.lineXYZ(cx + r.x * ax + u.x * ay, cy + r.y * ax + u.y * ay, cz + r.z * ax + u.z * ay, cx + r.x * bx + u.x * by, cy + r.y * bx + u.y * by, cz + r.z * bx + u.z * by, col, 2.4, seed + i, alpha, 0.004, 0);
    }
  }
}
