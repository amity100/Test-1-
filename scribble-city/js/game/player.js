import * as THREE from 'three';
import { Doodle } from './doodle.js';
import { heroLook } from './looks.js';
import { groundHeight } from '../world/layout.js';
import { clamp, damp, dampAngle } from '../core/util.js';

const GRAVITY = 24;
const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _hp = new THREE.Vector3();

export class Player {
  constructor(game) {
    this.game = game;
    this.fig = new Doodle(game.figures, heroLook(), { seed: 7 });
    this.pos = this.fig.pos;
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.onGround = true;
    this.hp = 100;
    this.maxHp = 100;
    this.mode = 'foot'; // foot | vehicle | draw | dead
    this.lastHurt = -10;
    this.lastFire = -10;
    this.radius = 0.36;
    this.height = 1.8;
    this.inVehicle = null;
    this.hidden = false;
    this.hideSpot = null;
    this.invuln = 0;
  }

  spawn(x, z, yaw) {
    this.pos.set(x, groundHeight(x, z), z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.fig.yaw = yaw;
    this.hp = this.maxHp;
    this.mode = 'foot';
    this.fig.dead = 0;
    this.fig.sit = 0;
    this.fig.setVisible(true);
    this.invuln = 2;
  }

  get eye() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.6, this.pos.z);
  }

  hurt(amount, fromX, fromZ, at = null) {
    if (this.mode === 'dead' || this.invuln > 0) return;
    if (this.inVehicle) {
      this.inVehicle.hurt(amount);
      return;
    }
    this.hp -= amount;
    if (at) {
      // the hit rubs a little hole in your own drawing (it fills back in as you heal)
      this.fig.closestSurfacePoint(at, _hp);
      this.fig.erase(_hp, 0.045 + amount * 0.0035);
    }
    this.lastHurt = this.game.time;
    this.game.hud.hurtFlash(amount, fromX, fromZ);
    this.game.audio.play('hurt');
    if (this.hp <= 0) {
      this.hp = 0;
      this.game.onPlayerDeath();
    }
  }

  update(dt, input, camRig, weapons) {
    const fig = this.fig;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.mode === 'dead') {
      fig.dead = Math.min(1, fig.dead + dt * 2.5);
      fig.speed = 0;
      fig.update(dt);
      return;
    }
    if (this.mode === 'vehicle') {
      // behind the wheel of an ordinary car: you can see him through the windows
      const v = this.inVehicle;
      if (v && v.seat) this.game.traffic.seat(fig, v.pos, v.yaw, dt);
      return;
    }
    // regen after a few calm seconds; the rubbed-out spots fill back in
    if (this.game.time - this.lastHurt > 4 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + 9 * dt);
      const holes = this.fig.holes.length;
      if (holes && (this.hp >= this.maxHp || this.hp > this.maxHp - holes * 12)) this.fig.holes.pop();
    }

    const drawing = this.mode === 'draw';
    const talking = this.game.dialog && this.game.dialog.open;
    const mv = drawing || talking ? { x: 0, y: 0, sprint: false } : input.readMove();
    const cy = camRig.yaw;
    const fx = Math.sin(cy);
    const fz = Math.cos(cy);
    const rx = -fz;
    const rz = fx;
    let wx = fx * mv.y + rx * mv.x;
    let wz = fz * mv.y + rz * mv.x;
    const tipsy = this.game.inkwell ? this.game.inkwell.tipsy : 0;
    if (tipsy > 0.3 && (mv.x || mv.y)) {
      // walking a little crooked
      const k = Math.sin(this.game.time * 1.7) * (tipsy - 0.3) * 0.45;
      wx += -fz * k;
      wz += fx * k;
    }
    const wl = Math.hypot(wx, wz);
    if (wl > 1) {
      wx /= wl;
      wz /= wl;
    }
    const aiming = weapons.isAiming();
    // a double espresso from the cafe: everything a bit faster for a while
    const speed = (mv.sprint && !aiming ? 8.2 : aiming ? 4.2 : 5.0) * Math.min(1, wl) * (this.coffeeT > 0 ? 1.3 : 1);
    const accel = this.onGround ? 40 : 9;
    const tx = wx * speed;
    const tz = wz * speed;
    this.vel.x = damp(this.vel.x, tx, accel / 4, dt);
    this.vel.z = damp(this.vel.z, tz, accel / 4, dt);
    if (input.wasPressed('Space') && this.onGround && !drawing) {
      this.vel.y = 8.4;
      this.onGround = false;
      this.game.audio.play('jump');
    }
    this.vel.y -= GRAVITY * dt;
    const p = this.pos;
    p.x += this.vel.x * dt;
    p.z += this.vel.z * dt;
    p.y += this.vel.y * dt;
    const col = this.game.world.collision.resolveCylinder(p, this.radius, this.height, this.onGround ? 0.5 : 0.25);
    // dynamic obstacles (vehicles)
    this.game.vehicles.pushOut(p, this.radius);
    let ground = groundHeight(p.x, p.z);
    if (col.floor > ground) ground = col.floor;
    if (p.y <= ground + 0.02) {
      if (this.vel.y <= 0) {
        // step up smoothly
        p.y = ground - p.y > 0.05 ? damp(p.y, ground, 30, dt) : ground;
        if (ground - p.y < 0.01) p.y = ground;
        this.vel.y = 0;
        this.onGround = true;
      }
    } else if (p.y > ground + 0.08) {
      this.onGround = false;
    }
    if (p.y < -2) {
      // fell into water: back to the promenade
      p.y = 0.2;
      p.x = Math.min(p.x, 224);
      p.z = Math.min(p.z, 157);
    }
    // facing
    if (aiming || weapons.swinging()) {
      this.yaw = dampAngle(this.yaw, cy, 18, dt);
    } else if (wl > 0.05) {
      this.yaw = dampAngle(this.yaw, Math.atan2(wx, wz), 10, dt);
    }
    fig.yaw = this.yaw;
    fig.speed = Math.hypot(this.vel.x, this.vel.z);
    fig.air = !this.onGround;
    fig.sit = damp(fig.sit, 0, 8, dt);
    fig.stagger = this.game.inkwell ? Math.min(1, Math.max(0, this.game.inkwell.tipsy - 0.4)) : 0;
    fig.aimPitch = camRig.pitch + 0.08;
    fig.update(dt);
  }

  // Transform for the held item: position at the right hand, oriented along dir.
  holdMatrix(dir, up = null) {
    const j = this.fig.j;
    _z.copy(dir).normalize();
    _y.set(0, 1, 0);
    if (up) _y.copy(up);
    _x.crossVectors(_y, _z);
    if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0);
    _x.normalize();
    _y.crossVectors(_z, _x).normalize();
    _m.makeBasis(_x, _y, _z);
    _m.setPosition(j.handR);
    return _m;
  }

  draw(camPos) {
    if (this.mode === 'vehicle' && !(this.inVehicle && this.inVehicle.seat)) return;
    this.fig.draw(camPos);
  }
}

export { clamp };
