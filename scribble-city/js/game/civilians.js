import * as THREE from 'three';
import { Figure } from './figure.js';
import { INK } from '../render/LineBatch.js';
import { AVES, STREETS, AVE_W, ST_W, groundHeight, blockRect, BLOCK_TYPES } from '../world/layout.js';
import { damp, dampAngle } from '../core/util.js';

const TINTS = [[0.85, 0.75, 0.7], [0.7, 0.78, 0.88], [0.8, 0.85, 0.72], [0.9, 0.86, 0.72], [0.78, 0.74, 0.86], [0.92, 0.92, 0.9]];
const LOOKS = [
  { head: 'civ0', torso: 'torso_coat' },
  { head: 'civ1', torso: 'torso_dress' },
  { head: 'civ2', torso: 'torso_coat' },
  { head: 'civ0', torso: 'torso_hoodie' },
];

/**
 * Pedestrians walking around their block's sidewalk. They panic and run when shooting starts.
 */
class Civilian {
  constructor(mgr, bx, bz) {
    this.mgr = mgr;
    this.game = mgr.game;
    const look = LOOKS[Math.floor(Math.random() * LOOKS.length)];
    this.fig = new Figure(mgr.game.figures, { head: look.head, torso: look.torso, color: INK, width: 2.6, tint: TINTS[Math.floor(Math.random() * TINTS.length)], seed: Math.random() * 100, scale: 0.94 + Math.random() * 0.1 });
    this.pos = this.fig.pos;
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

  update(dt) {
    const game = this.game;
    const fig = this.fig;
    let tx;
    let tz;
    let speed = this.speed;
    if (this.panicT > 0) {
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
