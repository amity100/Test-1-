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
    this.seat = null;
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
    const full = amount;
    if (this.game.weapons) amount = this.game.weapons.block(amount, fromX, fromZ);
    if (amount < full * 0.5) at = null;
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

  // behind the wheel of an ordinary car: you can see him through the windows (not with ?classic:
  // its side windows down, in its own kind's seat - a van's or a truck's up in the cab)
  seatIn(dt) {
    const v = this.inVehicle;
    if (v && v.seat) {
      if (v.kind === 'bike' || v.model) v.seatRider(this.fig, dt);
      else this.game.traffic.seat(this.fig, v.pos, v.yaw, dt, 1, this.game.classic ? null : v.seatOf());
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
      // (not with ?classic: seated once the car has moved this frame, game.js; else he sat a
      // frame behind it, half a metre at speed, and the friend beside him would too: ROADMAP 4.5)
      if (this.game.classic) this.seatIn(dt);
      return;
    }
    // up a ladder, on a fire escape, pulling yourself up onto something (ROADMAP 5.1, game/climb.js)
    if (this.mode === 'climb') {
      if (this.game.climb) this.game.climb.update(dt, input);
      else this.mode = 'foot';
      return;
    }
    // sitting (in the barber's chair): held to the seat until it lets go, then any step stands up
    if (this.seat) {
      const st = this.seat;
      const mv = input.readMove();
      if (!st.lock && (Math.hypot(mv.x, mv.y) > 0.3 || input.wasPressed('Space'))) {
        this.seat = null;
      } else {
        this.pos.x = st.x;
        this.pos.z = st.z;
        this.vel.set(0, 0, 0);
        this.yaw = dampAngle(this.yaw, st.yaw, 10, dt);
        fig.yaw = this.yaw;
        fig.speed = 0;
        fig.air = false;
        fig.sit = damp(fig.sit, st.stand ? 0 : 1, 8, dt);
        fig.update(dt);
        return;
      }
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
    const chute = this.game.chute;
    // falling with a parachute on your back: it opens on its own once the fall gets fast (or
    // at a press of the jump button, high enough)
    if (this.parachute && chute && !chute.open && !this.onGround) {
      const above = this.pos.y - groundHeight(this.pos.x, this.pos.z);
      if (above > 5 && this.vel.y < -3 && (input.wasPressed('Space') || (this.vel.y < -13 && above > 8))) chute.deploy(this.parachute.grade);
    }
    const gliding = chute && chute.open;
    // (a jump in front of something you can get up onto: you climb up onto it, ROADMAP 5.1)
    const climb = this.game.climb;
    if (climb && !drawing && !talking && !gliding && input.wasPressed('Space') && climb.tryMantle(wx, wz)) return;
    // a double espresso from the cafe: everything a bit faster for a while
    const speed = gliding ? chute.fly.speed * Math.min(1, wl) : (mv.sprint && !aiming ? 8.2 : aiming ? 4.2 : 5.0) * Math.min(1, wl) * (this.coffeeT > 0 ? 1.3 : 1);
    const accel = gliding ? 7 : this.onGround ? 40 : 9;
    const tx = wx * speed;
    const tz = wz * speed;
    this.vel.x = damp(this.vel.x, tx, accel / 4, dt);
    this.vel.z = damp(this.vel.z, tz, accel / 4, dt);
    if (input.wasPressed('Space') && this.onGround && !drawing) {
      this.vel.y = 8.4;
      this.onGround = false;
      this.game.audio.play('jump');
    }
    if (gliding) this.vel.y = damp(this.vel.y, -chute.fly.sink, 2.5, dt);
    else this.vel.y -= GRAVITY * dt;
    const p = this.pos;
    // (a fall lands on whatever it comes down onto, however fast: ROADMAP 5.1, not with ?classic)
    const prevY = this.game.classic ? null : p.y;
    p.x += this.vel.x * dt;
    p.z += this.vel.z * dt;
    p.y += this.vel.y * dt;
    const col = this.game.world.collision.resolveCylinder(p, this.radius, this.height, this.onGround ? 0.5 : 0.25, prevY);
    let floor = col.floor;
    // (up on the roofs, what stands there: world/roofs.js)
    if (climb && climb.col && p.y > 3.5) floor = Math.max(floor, climb.col.resolveCylinder(p, this.radius, this.height, this.onGround ? 0.5 : 0.25, prevY).floor);
    // dynamic obstacles (vehicles)
    this.game.vehicles.pushOut(p, this.radius);
    let ground = groundHeight(p.x, p.z);
    if (floor > ground) ground = floor;
    if (p.y <= ground + 0.02) {
      if (this.vel.y <= 0) {
        // a hard landing hurts (a jump out of the helicopter without a parachute hurts a lot)
        const fall = -this.vel.y;
        if (gliding) chute.land();
        else if (fall > 17 && !this.onGround) {
          this.hurt(Math.min(85, (fall - 17) * 3.2), p.x, p.z);
          this.game.camRig.addShake(0.5);
          this.game.fx.crumbs(p.x, p.y + 0.2, p.z, 20, 3);
          this.game.audio.play('punch', 0.8);
        }
        // step up smoothly
        p.y = ground - p.y > 0.05 ? damp(p.y, ground, 30, dt) : ground;
        if (ground - p.y < 0.01) p.y = ground;
        this.vel.y = 0;
        this.onGround = true;
        // (down onto a fire escape's landing: you are on it)
        if (climb && p.y > 3.5 && climb.catchFall()) return;
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
