import * as THREE from 'three';
import { Doodle } from './doodle.js';
import { civilianLook } from './looks.js';
import { holeRadius } from './enemies.js';
import { AVES, STREETS, AVE_W, ST_W, groundHeight, blockRect, BLOCK_TYPES } from '../world/layout.js';
import { damp, dampAngle, clamp } from '../core/util.js';

const REMOVE_AT = { head: 0.45, armL: 0.45, armR: 0.45, legL: 0.42, legR: 0.42, torso: 0.36 };
const _ro = new THREE.Vector3();
const _rd = new THREE.Vector3();

/**
 * Pedestrians walking around their block's sidewalk. They panic and run when shooting starts.
 */
class Civilian {
  constructor(mgr, bx, bz, look = null) {
    this.mgr = mgr;
    this.game = mgr.game;
    this.fig = new Doodle(mgr.game.figures, look || civilianLook(), { seed: Math.random() * 100, scale: look ? 1 : 0.93 + Math.random() * 0.1 });
    this.pos = this.fig.pos;
    this.radius = 0.33;
    this.dying = -1;
    this.headlessT = 0;
    const r = blockRect(bx, bz);
    const inset = 2.3;
    this.loop = [
      [r.x0 + inset, r.z0 + inset],
      [r.x1 - inset, r.z0 + inset],
      [r.x1 - inset, r.z1 - inset],
      [r.x0 + inset, r.z1 - inset],
    ];
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.leg = Math.floor(Math.random() * 4);
    const a = this.loop[this.leg];
    const b = this.loop[(this.leg + 1) % 4];
    const t = Math.random();
    this.pos.set(a[0] + (b[0] - a[0]) * t, groundHeight(a[0], a[1]), a[1] + (b[1] - a[1]) * t);
    this.target = this.dir > 0 ? (this.leg + 1) % 4 : this.leg;
    this.speed = 1.2 + Math.random() * 0.5;
    this.panicT = 0;
    this.yaw = 0;
    this.vel = new THREE.Vector3();
    this.stopT = 0;
    this.dodgeV = new THREE.Vector3();
  }

  get alive() {
    return this.dying < 0;
  }

  get headless() {
    return this.fig.parts.head < 0.5;
  }

  update(dt) {
    const game = this.game;
    const fig = this.fig;
    if (this.dying >= 0) {
      this.dying += dt;
      if (fig.split >= 0) {
        fig.split += dt;
        fig.speed = Math.max(0, fig.speed - dt * 2.5);
        if (fig.split < 1) {
          this.pos.x += Math.sin(this.yaw) * fig.speed * dt;
          this.pos.z += Math.cos(this.yaw) * fig.speed * dt;
        }
        fig.dissolve = clamp((this.dying - 1.8) / 0.9, 0, 1);
      } else {
        fig.dead = Math.min(1, this.dying * 2.2);
        fig.speed = 0;
        fig.dissolve = clamp((this.dying - 1.2) / 0.9, 0, 1);
      }
      fig.update(dt);
      return;
    }
    let tx;
    let tz;
    let speed = this.speed;
    const legless = fig.parts.legL < 0.5 && fig.parts.legR < 0.5;
    const limping = (fig.parts.legL < 0.5) !== (fig.parts.legR < 0.5);
    if (this.headless) {
      // runs blind in a panic, arms flailing, zig-zagging until the body gives up
      this.headlessT += dt;
      if (this.headlessT > 11) {
        this.mgr.kill(this);
        return;
      }
      if (!this.blindDir || Math.random() < dt * 0.8) this.blindDir = this.yaw + (Math.random() - 0.5) * 2.4;
      tx = this.pos.x + Math.sin(this.blindDir) * 5;
      tz = this.pos.z + Math.cos(this.blindDir) * 5;
      speed = 5.2;
      fig.flail = 1;
      fig.stagger = 1;
      fig.armsUp = 0;
    } else if (this.panicT > 0) {
      this.panicT -= dt;
      const fx = this.pos.x - this.fearX;
      const fz = this.pos.z - this.fearZ;
      const l = Math.hypot(fx, fz) || 1;
      tx = this.pos.x + (fx / l) * 5;
      tz = this.pos.z + (fz / l) * 5;
      speed = 5.8;
      fig.armsUp = 1;
    } else {
      fig.armsUp = 0;
      fig.flail = 0;
      const t = this.loop[this.target];
      tx = t[0];
      tz = t[1];
      if (Math.hypot(tx - this.pos.x, tz - this.pos.z) < 0.8) {
        this.target = (this.target + this.dir + 4) % 4;
        if (Math.random() < 0.15) this.stopT = 1 + Math.random() * 3;
      }
      if (this.stopT > 0) {
        this.stopT -= dt;
        speed = 0;
      }
    }
    if (legless) speed = Math.min(speed, 0.8);
    else if (limping) speed = Math.min(speed * 0.45, 1.8);
    fig.crawl = damp(fig.crawl, legless ? 1 : 0, 6, dt);
    if (!this.headless) fig.stagger = limping ? 0.6 : 0;
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    this.vel.x = damp(this.vel.x, (dx / l) * speed, 6, dt) + this.dodgeV.x;
    this.vel.z = damp(this.vel.z, (dz / l) * speed, 6, dt) + this.dodgeV.z;
    this.dodgeV.multiplyScalar(Math.exp(-5 * dt));
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    game.world.collision.resolveCylinder(this.pos, 0.33, 1.7, 0.5);
    game.vehicles.pushOut(this.pos, 0.33);
    this.pos.y = damp(this.pos.y, groundHeight(this.pos.x, this.pos.z), 20, dt);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.2) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 8, dt);
    fig.yaw = this.yaw;
    fig.speed = sp;
    fig.update(dt);
  }

  dispose() {
    this.fig.dispose();
  }
}

export class Civilians {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.t = 0;
  }

  reset() {
    for (const c of this.list) c.dispose();
    this.list = [];
  }

  update(dt) {
    const game = this.game;
    const p = game.player.inVehicle ? game.player.inVehicle.pos : game.player.pos;
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 1;
      const max = game.touch ? 10 : 18;
      // despawn far ones
      for (const c of this.list) if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) > 110) c.gone = true;
      this.list = this.list.filter((c) => {
        if (c.gone) c.dispose();
        return !c.gone;
      });
      let tries = 6;
      while (this.list.length < max && tries-- > 0) {
        const bx = Math.floor(Math.random() * 5);
        const bz = Math.floor(Math.random() * 5);
        const type = BLOCK_TYPES[bz][bx];
        if (type === 'alien' || type === 'fortress' || type === 'fortress2') continue;
        const r = blockRect(bx, bz);
        const cx = (r.x0 + r.x1) / 2;
        const cz = (r.z0 + r.z1) / 2;
        const d = Math.hypot(cx - p.x, cz - p.z);
        if (d > 95) continue;
        const c = new Civilian(this, bx, bz);
        if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 18) {
          c.dispose();
          continue;
        }
        this.list.push(c);
      }
    }
    for (const c of this.list) c.update(dt);
    if (this.list.some((c) => c.fig.dissolve >= 1)) {
      this.list = this.list.filter((c) => {
        if (c.fig.dissolve < 1) return true;
        c.dispose();
        return false;
      });
    }
  }

  // somebody who just got out of a car at (x, z): walks the sidewalk of the nearest block
  spawnAt(x, z, look) {
    let best = [0, 0];
    let bd = Infinity;
    for (let bx = 0; bx < 5; bx++) {
      for (let bz = 0; bz < 5; bz++) {
        const r = blockRect(bx, bz);
        const d = Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
        if (d < bd) {
          bd = d;
          best = [bx, bz];
        }
      }
    }
    const c = new Civilian(this, best[0], best[1], look);
    c.pos.set(x, groundHeight(x, z), z);
    this.list.push(c);
    return c;
  }

  // ------------------------------------------------------------------ getting hit
  segmentHit(ox, oy, oz, dx, dy, dz, maxT) {
    let best = null;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return null;
    const ro = _ro.set(ox, oy, oz);
    const rd = _rd.set(dx / len, dy / len, dz / len);
    const len2 = dx * dx + dz * dz;
    for (const c of this.list) {
      if (!c.alive) continue;
      let t = len2 > 1e-8 ? ((c.pos.x - ox) * dx + (c.pos.z - oz) * dz) / len2 : 0;
      t = Math.max(0, Math.min(maxT, t));
      if (Math.hypot(ox + dx * t - c.pos.x, oz + dz * t - c.pos.z) > 1.2) continue;
      const h = c.fig.raycast(ro, rd, maxT * len);
      if (h && (!best || h.t / len < best.t)) best = { t: h.t / len, civ: c, part: h.part, point: h.point };
    }
    return best;
  }

  inArc(pos, fwd, range, halfAngle) {
    const out = [];
    for (const c of this.list) {
      if (!c.alive) continue;
      const dx = c.pos.x - pos.x;
      const dz = c.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range + 0.4) continue;
      const a = Math.acos(Math.max(-1, Math.min(1, (dx * fwd.x + dz * fwd.z) / (d || 1))));
      if (a < halfAngle || d < 0.8) out.push(c);
    }
    return out;
  }

  damage(c, point, kind, amount) {
    if (!c.alive) return;
    const game = this.game;
    const fig = c.fig;
    const res = fig.erase(point, holeRadius(kind, amount));
    game.fx.crumbs(point.x, point.y, point.z, 8, 2.5);
    game.audio.play('erase', 0.5);
    this.panic(c.pos, 30);
    c.panicT = 8;
    if (game.onCivilianHurt) game.onCivilianHurt(c);
    if (!res) return;
    const part = res.part;
    if (fig.parts[part] > 0.5 && fig.erased[part] >= REMOVE_AT[part]) {
      fig.removePart(part);
      const j = fig.j;
      const at = part === 'head' ? j.headC : fig.center;
      game.fx.crumbs(at.x, at.y, at.z, 22, 3.2);
      game.fx.smoke(at.x, at.y, at.z, 0.6);
      game.audio.play('erase', 1);
      if (part === 'torso') {
        this.kill(c, 'split');
        return;
      }
    }
    let lost = 0;
    for (const k of ['head', 'torso', 'armL', 'armR', 'legL', 'legR']) lost += fig.parts[k] < 0.5 ? 0.5 : fig.erased[k] * 0.5;
    if (lost >= 1.4 || (c.headless && fig.erased.torso > 0.25)) this.kill(c);
  }

  explosion(x, y, z, radius) {
    const at = new THREE.Vector3();
    for (const c of this.list) {
      if (!c.alive) continue;
      const d = Math.hypot(c.pos.x - x, c.pos.y + 1 - y, c.pos.z - z);
      if (d > radius) continue;
      const f = 1 - d / radius;
      const n = 2 + Math.round(f * 3);
      for (let i = 0; i < n && c.alive; i++) {
        const s = c.fig.shapes[Math.floor(Math.random() * c.fig.shapes.length)];
        if (!s) break;
        at.set(x, y, z).lerp(s.c, 0.92);
        c.fig.closestSurfacePoint(at, at);
        this.damage(c, at, 'blast', 60 + 140 * f);
      }
    }
  }

  kill(c, how) {
    if (!c.alive) return;
    c.dying = 0;
    if (how === 'split') {
      c.fig.split = 0;
      c.fig.splitDir = Math.random() < 0.5 ? 1 : -1;
      c.fig.parts.torso = 0;
      c.fig.speed = Math.max(c.fig.speed, 1.5);
    }
    this.game.fx.crumbs(c.pos.x, c.pos.y + 1, c.pos.z, 26, 3.2);
    if (this.game.onCivilianKilled) this.game.onCivilianKilled(c);
  }

  panic(pos, radius) {
    for (const c of this.list) {
      if (Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) < radius) {
        if (c.panicT <= 0 && Math.random() < 0.3) this.game.fx.mark('fx_alert', c.pos.x, c.pos.y + 2.4, c.pos.z, 0.6, 0.8);
        c.panicT = 6 + Math.random() * 3;
        c.fearX = pos.x;
        c.fearZ = pos.z;
      }
    }
  }

  dodge(pos, f, halfLen, halfWid, speed) {
    if (Math.abs(speed) < 2) return;
    for (const c of this.list) {
      const dx = c.pos.x - pos.x;
      const dz = c.pos.z - pos.z;
      const along = dx * f.x + dz * f.z;
      const side = dx * f.z - dz * f.x;
      if (along > -halfLen && along < halfLen + Math.abs(speed) * 0.5 && Math.abs(side) < halfWid + 0.6) {
        const s = Math.sign(side) || 1;
        c.dodgeV.set(f.z * s * 7, 0, -f.x * s * 7);
        c.panicT = 4;
        c.fearX = pos.x;
        c.fearZ = pos.z;
      }
    }
  }

  draw(camPos) {
    for (const c of this.list) {
      const d = Math.hypot(c.pos.x - camPos.x, c.pos.z - camPos.z);
      c.fig.setVisible(d < 130);
      if (d < 130) c.fig.draw(camPos);
    }
  }
}

export { AVES, STREETS, AVE_W, ST_W };
