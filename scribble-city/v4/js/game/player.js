import * as THREE from 'three';
import { Doodle } from './doodle.js';
import { heroLook } from './looks.js';
import { groundHeight, WATER_X } from '../world/layout.js';
import { clamp, damp, dampAngle } from '../core/util.js';
import { downStep } from './fists.js';
import { dress } from './wardrobe.js';

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
    // (ROADMAP 5.3, not with ?classic) down low; the box you are low behind; risen out of it to
    // shoot (0..1)
    this.crouched = false;
    this.coverBox = null;
    this.coverPop = 0;
    this.coverSlide = null;
    // (ROADMAP 5.5, not with ?classic) thrown by a car or a blast (mode 'rag'): lying still this
    // long; then getting up (game/fists.js's downStep)
    this.lieT = 0;
    this.downT = 0;
    this.upT = 0;
    // (ROADMAP 5.7, not with ?classic) the vest of notebook covers (game/wardrobe.js): what is
    // left of it (0..100)
    this.armor = 0;
  }

  // thrown by a car or a blast (game/ragdoll.js): the body flies and falls as it will
  thrown() {
    this.setCrouch(false);
    this.mode = 'rag';
    this.lieT = 0;
    this.vel.set(0, 0, 0);
    this.onGround = false;
  }

  updateRag(dt) {
    const fig = this.fig;
    if (fig.rag) {
      fig.update(dt);
      if (fig.rag.done) {
        this.lieT += dt;
        if (this.lieT > 0.7) this.game.ragdolls.release(this, 0.8);
      } else this.lieT = 0;
      return;
    }
    if (downStep(this, dt)) {
      fig.speed = 0;
      fig.update(dt);
      return;
    }
    this.mode = 'foot';
    this.onGround = true;
  }

  setCrouch(on) {
    if (this.crouched === on) return;
    this.crouched = on;
    this.height = on ? 1.25 : 1.8;
    if (!on) {
      this.coverBox = null;
      this.coverSlide = null;
    }
  }

  // a box to be low behind, beside you (a car, a low wall, a planter, a crate...): { box, x, z, nx, nz }
  coverNear(reach = 0.65) {
    const p = this.pos;
    const r = this.radius + reach;
    let best = null;
    let bd = r;
    this.game.world.collision.forEachIn(p.x - r, p.z - r, p.x + r, p.z + r, (b) => {
      if (b.tag === 'bound' || b.tag === 'tree' || b.tag === 'water') return false;
      if (b.y0 > p.y + 0.4 || b.y1 < p.y + 0.85) return false;
      const cx = Math.max(b.x0, Math.min(p.x, b.x1));
      const cz = Math.max(b.z0, Math.min(p.z, b.z1));
      const d = Math.hypot(p.x - cx, p.z - cz);
      if (d < bd && d > 1e-4) {
        bd = d;
        best = { box: b, x: cx, z: cz, nx: (p.x - cx) / d, nz: (p.z - cz) / d, low: b.y1 < p.y + 2.1 };
      }
      return false;
    });
    return best;
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
    // (out of a ragdoll, ROADMAP 5.5)
    this.fig.rag = null;
    this.fig.unragT = 0;
    this.fig.crouch = 0;
    this.downT = 0;
    this.upT = 0;
    this.seat = null;
    this.fig.setVisible(true);
    this.invuln = 2;
  }

  get eye() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.6, this.pos.z);
  }

  // kind: 'melee' for a blow (a fist, a club, a bite); src: who dealt it
  hurt(amount, fromX, fromZ, at = null, kind = null, src = null) {
    if (this.mode === 'dead' || this.invuln > 0) return;
    if (this.inVehicle) {
      this.inVehicle.hurt(amount);
      return;
    }
    const full = amount;
    if (this.game.weapons) amount = this.game.weapons.block(amount, fromX, fromZ, kind, src);
    // (the vest takes most of a blow, a shot, a blast - not the water, not a fall; ROADMAP 5.7)
    if (this.armor > 0 && kind !== 'drown' && kind !== 'fall') {
      const a = Math.min(this.armor, amount * 0.65);
      this.armor -= a;
      amount -= a;
      if (this.armor <= 0.5) {
        this.armor = 0;
        dress(this.fig.look, false);
        this.game.hud.toast('האפוד נקרע', 'bad', 1.8);
      }
    }
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
    // (no crouching in a car, on a ladder, in the water: ROADMAP 5.3)
    if (this.crouched && this.mode !== 'foot') {
      this.setCrouch(false);
      fig.crouch = 0;
      fig.sneak = 0;
    }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.mode === 'dead') {
      fig.dead = Math.min(1, fig.dead + dt * 2.5);
      fig.speed = 0;
      fig.update(dt);
      return;
    }
    // (thrown: ROADMAP 5.5)
    if (this.mode === 'rag') {
      this.updateRag(dt);
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
    // in the bay (ROADMAP 5.2, game/swim.js)
    if (this.mode === 'swim') {
      if (this.game.swim) this.game.swim.update(dt, input);
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
    // (ROADMAP 5.3, not with ?classic) down low with C, close up against what is beside you; up
    // again with C, a jump, or a run
    let stoodUp = false;
    if (!this.game.classic && !drawing && !talking) {
      if (input.wasPressed('KeyC') && this.onGround && !gliding) {
        if (this.crouched) this.setCrouch(false);
        else {
          this.setCrouch(true);
          const c = this.coverNear(1.1);
          if (c) this.coverSlide = { x: c.x + c.nx * (this.radius + 0.06), z: c.z + c.nz * (this.radius + 0.06), t: 0.35 };
        }
      }
      // (a real fall stands you up; a curb's little step down does not)
      if (this.crouched && (input.wasPressed('Space') || (mv.sprint && wl > 0.3) || this.vel.y < -5)) {
        this.setCrouch(false);
        stoodUp = input.wasPressed('Space');
      }
    }
    // (a jump in front of something you can get up onto: you climb up onto it, ROADMAP 5.1)
    const climb = this.game.climb;
    if (climb && !stoodUp && !drawing && !talking && !gliding && input.wasPressed('Space') && climb.tryMantle(wx, wz)) return;
    // a double espresso from the cafe: everything a bit faster for a while
    // (the fists, ROADMAP 5.4: slow behind the guard, and half pace while a blow goes out)
    const fists = weapons.fists;
    // (ROADMAP 5.6, not with ?classic: a sprint runs the stamina down; out of breath, you jog -
    // and the more you have run, the faster the sprint)
    const skills = this.game.skills;
    const sprint = mv.sprint && !aiming && (!skills || skills.canSprint);
    this.sprinting = sprint && wl > 0.3 && this.onGround && !this.crouched && !gliding;
    const speed = gliding ? chute.fly.speed * Math.min(1, wl) : (this.crouched ? 2.3 : weapons.guarding ? 2.6 : sprint ? 8.2 + (skills ? skills.sprintBonus : 0) : aiming ? 4.2 : 5.0) * Math.min(1, wl) * (this.coffeeT > 0 ? 1.3 : 1) * (fists && fists.busy ? 0.5 : 1);
    const accel = gliding ? 7 : this.onGround ? 40 : 9;
    const tx = wx * speed;
    const tz = wz * speed;
    this.vel.x = damp(this.vel.x, tx, accel / 4, dt);
    this.vel.z = damp(this.vel.z, tz, accel / 4, dt);
    // (a step into a punch, this frame only: game/fists.js)
    let lx = 0;
    let lz = 0;
    if (this.lunge) {
      lx = this.lunge.x;
      lz = this.lunge.z;
      this.lunge = null;
    }
    // (sliding in against the cover you went down beside)
    if (this.coverSlide) {
      const cs = this.coverSlide;
      cs.t -= dt;
      const dx = cs.x - this.pos.x;
      const dz = cs.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (cs.t <= 0 || d < 0.04 || wl > 0.3) this.coverSlide = null;
      else {
        this.vel.x = (dx / d) * Math.min(5, d / dt);
        this.vel.z = (dz / d) * Math.min(5, d / dt);
      }
    }
    if (input.wasPressed('Space') && this.onGround && !drawing && !stoodUp) {
      this.vel.y = 8.4;
      this.onGround = false;
      this.game.audio.play('jump');
    }
    if (gliding) this.vel.y = damp(this.vel.y, -chute.fly.sink, 2.5, dt);
    else this.vel.y -= GRAVITY * dt;
    const p = this.pos;
    // (a fall lands on whatever it comes down onto, however fast: ROADMAP 5.1, not with ?classic)
    const prevY = this.game.classic ? null : p.y;
    p.x += (this.vel.x + lx) * dt;
    p.z += (this.vel.z + lz) * dt;
    p.y += this.vel.y * dt;
    const col = this.game.world.collision.resolveCylinder(p, this.radius, this.height, this.onGround ? 0.5 : 0.25, prevY);
    let floor = col.floor;
    // (up on the roofs, what stands there: world/roofs.js)
    if (climb && climb.col && p.y > 3.5) floor = Math.max(floor, climb.col.resolveCylinder(p, this.radius, this.height, this.onGround ? 0.5 : 0.25, prevY).floor);
    // (not with ?classic: a car in the street coming at you too fast to stop - thrown over its
    // bonnet, ROADMAP 5.5)
    const R = this.game.ragdolls;
    if (R && this.onGround) {
      const hit = this.game.traffic.hitter(p, this.radius, 6);
      if (hit) {
        const sp = hit.speed;
        this.hurt(Math.min(70, Math.abs(sp) * 2.6), hit.pos.x, hit.pos.z);
        this.game.fx.sprite('fx_crash', p.x, p.y + 1, p.z, { size: 1.5, life: 0.3 });
        this.game.audio.play('crash', 0.7);
        this.game.camRig.addShake(0.4);
        // (the driver stamps on the brake; you go over the bonnet, alive or not)
        hit.speed *= 0.5;
        R.carHit(this, hit, sp);
        if (this.mode === 'foot') this.thrown();
        return;
      }
    }
    // dynamic obstacles (vehicles)
    this.game.vehicles.pushOut(p, this.radius);
    let ground = groundHeight(p.x, p.z);
    if (floor > ground) ground = floor;
    // (down into the bay: you swim, ROADMAP 5.2 - the water takes a fall, however high)
    const swim = this.game.swim;
    if (swim && p.x > WATER_X && ground < -0.5 && floor < -0.5 && p.y <= ground + 0.02) {
      if (gliding) chute.land();
      swim.enter();
      return;
    }
    if (p.y <= ground + 0.02) {
      if (this.vel.y <= 0) {
        // a hard landing hurts (a jump out of the helicopter without a parachute hurts a lot)
        const fall = -this.vel.y;
        if (gliding) chute.land();
        else if (fall > 17 && !this.onGround) {
          this.hurt(Math.min(85, (fall - 17) * 3.2), p.x, p.z, null, 'fall');
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
    if (aiming || weapons.swinging() || weapons.guarding) {
      // (a punch turns you to whoever it is for: game/fists.js)
      const fy = weapons.faceYaw;
      this.yaw = dampAngle(this.yaw, fy === null ? cy : fy, 18, dt);
    } else if (wl > 0.05) {
      this.yaw = dampAngle(this.yaw, Math.atan2(wx, wz), 10, dt);
    }
    fig.yaw = this.yaw;
    fig.speed = Math.hypot(this.vel.x + lx, this.vel.z + lz);
    fig.air = !this.onGround;
    fig.sit = damp(fig.sit, 0, 8, dt);
    if (!this.game.classic) {
      // (down low: kneeling still, bent low on the move; behind cover, up to shoot when you aim)
      const cover = this.crouched ? this.coverNear() : null;
      this.coverBox = cover && cover.low ? cover.box : null;
      this.coverPop = damp(this.coverPop, this.crouched && this.coverBox && aiming ? 1 : 0, 9, dt);
      const low = this.crouched ? 1 - this.coverPop : 0;
      const moving = fig.speed > 0.4;
      fig.crouch = damp(fig.crouch, low * (moving ? 0 : 1), 10, dt);
      fig.sneak = damp(fig.sneak, low * (moving ? 1 : 0), 10, dt);
    }
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
