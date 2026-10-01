import * as THREE from 'three';
import { FEEL } from '../config';
import { LAW } from '../core/contracts';
import type { CharacterAPI, DynBody, ImpactInfo, LocomotionInput, PhysicsAPI, PhysicsEvents, RiftEnd, V3 } from '../core/contracts';
import type { CollisionWorld } from '../world/collision';
import { Body } from '../sim/physics';
import { yawOf } from './portalMath';
import { FLOW, FLOW_SPRINT, FLOW_WALK, flowOn } from './flow';

export interface PlayerInput {
  /** Stick / WASD (x right, y forward) in camera space. */
  moveX: number;
  moveY: number;
  camYaw: number;
  /** Pressed this frame (buffered briefly). */
  jump: boolean;
  sprint: boolean;
  /** Held / toggled state. */
  crouch: boolean;
  /** Pressed this frame. */
  shove: boolean;
  /** FLOW: crouch pressed this frame (at a run it's a SLIDE). */
  slide?: boolean;
}

export interface PlayerEvents {
  footstep(pos: V3, loud: number, radius: number): void;
  jumped(pos: V3): void;
  landed(pos: V3, speed: number, charged: boolean): void;
  fallDamage(amount: number): void;
  shoved(from: V3, dir: V3): void;
  crossed(from: RiftEnd, to: RiftEnd, yawDelta: number, speed: number): void;
  /** FLOW: a jump in the air (off a wall, or the double jump). */
  airJump?(pos: V3, wall: boolean): void;
  /** FLOW: a slide starts. */
  slid?(pos: V3): void;
}

const _v = new THREE.Vector3();
const _o = new THREE.Vector3();
const _n = new THREE.Vector3();
const SHOVE_SPEED = LAW.shove.distance / FEEL.shoveTime;

/**
 * Third-person controller on a DynBody (physics does gravity, collision and
 * rift crossings). Camera-relative steering on the ground; in the air only
 * additive air control (and almost none while rift-charged), so momentum
 * through rifts is honest.
 */
export class Player {
  yaw = 0;
  crouched = false;
  sprinting = false;
  /** Skidding out of a charged landing (rift slide). */
  sliding = false;
  shoveCooldown = 0;
  /** The game manages carry / throw; carrying only slows movement here. */
  carrying: DynBody | null = null;
  airTime = 0;
  /** Last grounded spot with real ground under it. */
  lastSafe = new THREE.Vector3();
  /** 0..1 gauntlet raised (set by the game while aiming). */
  aim = 0;
  crouchT = 0;

  private stride = 0;
  private mantle: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  private shoveT = 0;
  private shoveDir = new THREE.Vector3();
  private lungeT = 0;
  private lungeSpeed = 0;
  private readonly lungeDir = new THREE.Vector3();
  private jumpBuf = 0;
  private coyote = 0;
  // FLOW (flow.ts): the slide, the jumps left in the air, the wall kick's lockout
  /** Seconds of slide left (0: not sliding). */
  slideT = 0;
  private slideCd = 0;
  airJumps = 0;
  private wallCd = 0;
  private physEv: PhysicsEvents | null = null;
  private ev: PlayerEvents | null = null;
  private readonly wrapped: PhysicsEvents;
  private readonly loco: LocomotionInput = { speed: 0, grounded: true, vy: 0, crouch: 0, aim: 0 };

  constructor(public char: CharacterAPI, public body: DynBody) {
    this.lastSafe.copy(body.pos);
    this.body.height = FEEL.playerHeight;
    // forwards every physics event; the player's own crossings / landings are handled first
    const self = this;
    this.wrapped = {
      crossed(b, from, to, speed) {
        if (b === self.body) self.onCrossed(from, to, speed);
        self.physEv?.crossed(b, from, to, speed);
      },
      impact(b, e) {
        if (b === self.body) self.onImpact(e);
        self.physEv?.impact(b, e);
      },
      touch(a, b, s) {
        self.physEv?.touch(a, b, s);
      },
      splash(b) {
        self.physEv?.splash(b);
      },
      fellOut(b) {
        self.physEv?.fellOut(b);
      },
    };
  }

  get pos() {
    return this.body.pos;
  }

  get vel() {
    return this.body.vel;
  }

  get airborne() {
    return !this.body.onGround && !this.mantle;
  }

  get height() {
    return THREE.MathUtils.lerp(FEEL.playerHeight, FEEL.crouchHeight, this.crouchT);
  }

  isMantling() {
    return !!this.mantle;
  }

  get lunging() {
    return this.lungeT > 0;
  }

  /** The hidden blade's lunge: this fast along `dir` for up to `time` s (the game steers it and ends it). */
  lunge(dir: V3, speed: number, time: number) {
    this.lungeDir.set(dir.x, 0, dir.z).normalize();
    this.lungeSpeed = speed;
    this.lungeT = time;
    this.shoveT = 0;
    this.yaw = yawOf(this.lungeDir);
  }

  /** Stop where the lunge got you. */
  endLunge() {
    if (this.lungeT <= 0) return;
    this.lungeT = 0;
    this.body.vel.x = 0;
    this.body.vel.z = 0;
  }

  eye(out = new THREE.Vector3()) {
    return out.copy(this.body.pos).setY(this.body.pos.y + this.height - 0.12);
  }

  chest(out = new THREE.Vector3()) {
    return out.copy(this.body.pos).setY(this.body.pos.y + this.height * 0.6);
  }

  forward(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  /** Plain move (checkpoint, lift): no momentum, no charge. */
  teleport(p: V3, yaw?: number) {
    const b = this.body;
    b.pos.copy(p);
    b.vel.set(0, 0, 0);
    b.charge = 0;
    b.crossings = 0;
    b.loops = 0;
    b.lastEnd = null;
    b.peakY = p.y;
    b.onGround = false;
    if (b instanceof Body) {
      b.live = false;
      b.landedSinceCross = true;
      b.wet = false;
      b.gone = false;
    }
    if (yaw !== undefined) this.yaw = yaw;
    this.mantle = null;
    this.slideT = 0;
    this.shoveT = 0;
    this.lungeT = 0;
    this.airTime = 0;
    this.lastSafe.copy(p);
  }

  update(dt: number, input: PlayerInput, world: CollisionWorld, physics: PhysicsAPI, physEv: PhysicsEvents, ev: PlayerEvents, time: number) {
    this.physEv = physEv;
    this.ev = ev;
    const b = this.body;
    this.shoveCooldown = Math.max(0, this.shoveCooldown - dt);
    // FLOW: faster legs, a sharper turn, real air control (everyone else: FEEL as always)
    const flow = flowOn();
    const walkSpeed = flow ? FLOW_WALK : FEEL.walkSpeed;
    const sprintSpeed = flow ? FLOW_SPRINT : FEEL.sprintSpeed;
    const accel = flow ? FLOW.move.accel : FEEL.accel;
    this.slideCd = Math.max(0, this.slideCd - dt);
    this.wallCd = Math.max(0, this.wallCd - dt);
    if (!flow) this.slideT = 0;
    if (b.onGround) this.airJumps = flow ? FLOW.jump.airJumps : 0;
    // FLOW: crouch at a run is a SLIDE (a burst of speed that keeps going, low)
    const hs0 = Math.hypot(b.vel.x, b.vel.z);
    if (flow && input.slide && b.onGround && !this.mantle && this.slideT <= 0 && this.slideCd <= 0 && !this.carrying && this.lungeT <= 0 && this.shoveT <= 0 && hs0 >= FLOW.slide.minSpeed) {
      const k = (hs0 + FLOW.slide.boost) / hs0;
      b.vel.x *= k;
      b.vel.z *= k;
      this.slideT = FLOW.slide.maxTime;
      this.slideCd = FLOW.slide.cooldown;
      ev.slid?.(b.pos.clone());
    }

    // crouch (stand up only with headroom)
    let crouch = (input.crouch || this.slideT > 0) && !this.mantle;
    if (!crouch && this.crouched && world.ceilingAt(b.pos.x, b.pos.z, FEEL.playerRadius * 0.7, b.pos.y + 0.5) < b.pos.y + FEEL.playerHeight + 0.02) crouch = true;
    this.crouched = crouch;
    this.crouchT = THREE.MathUtils.damp(this.crouchT, crouch ? 1 : 0, 12, dt);
    b.height = this.height;

    if (this.mantle) {
      const m = this.mantle;
      m.t += dt / FEEL.mantleTime;
      const k = Math.min(1, m.t);
      const up = Math.min(1, k * 1.6);
      const fwd = Math.max(0, (k - 0.45) / 0.55);
      b.pos.set(THREE.MathUtils.lerp(m.from.x, m.to.x, fwd), THREE.MathUtils.lerp(m.from.y, m.to.y, 1 - (1 - up) * (1 - up)), THREE.MathUtils.lerp(m.from.z, m.to.z, fwd));
      b.vel.set(0, 0, 0);
      if (k >= 1) {
        this.mantle = null;
        b.onGround = true;
        b.peakY = b.pos.y;
      }
      this.animate(dt, 1.2, true);
      return;
    }

    // --- desired velocity (camera-relative) ---
    const mx = input.moveX, my = input.moveY;
    const inputMag = Math.min(1, Math.hypot(mx, my));
    const fx = Math.sin(input.camYaw), fz = Math.cos(input.camYaw);
    // yaw 0 looks +Z; right is -X
    let dirX = fx * my - fz * mx;
    let dirZ = fz * my + fx * mx;
    const dl = Math.hypot(dirX, dirZ);
    if (dl > 1e-6) {
      dirX /= dl;
      dirZ /= dl;
    }
    this.sprinting = input.sprint && !this.crouched && !this.carrying && inputMag > 0.5;
    const maxSpeed = this.carrying ? FEEL.carrySpeed : this.sprinting ? sprintSpeed : this.crouched ? FEEL.crouchSpeed : walkSpeed;
    const want = inputMag > 0 ? maxSpeed * Math.max(inputMag, 0.35) : 0;
    const tx = dirX * want, tz = dirZ * want;

    // --- shove: a short dash ---
    if (input.shove && this.shoveCooldown <= 0 && this.lungeT <= 0) {
      if (inputMag > 0.1) this.shoveDir.set(dirX, 0, dirZ);
      else this.forward(this.shoveDir);
      this.shoveT = FEEL.shoveTime;
      this.shoveCooldown = LAW.shove.cooldown;
      this.yaw = yawOf(this.shoveDir);
      this.crouched = false;
      ev.shoved(b.pos.clone(), this.shoveDir.clone());
      this.char.play('push', { fade: 0.08 });
    }

    // the hidden blade's lunge: straight at him, and silent (no footsteps)
    const lunging = this.lungeT > 0;
    if (lunging) {
      this.lungeT -= dt;
      const s = this.lungeT > 0 ? this.lungeSpeed : 0;
      b.vel.x = this.lungeDir.x * s;
      b.vel.z = this.lungeDir.z * s;
    } else if (this.shoveT > 0) {
      this.shoveT -= dt;
      const s = this.shoveT > 0 ? SHOVE_SPEED : want;
      b.vel.x = this.shoveDir.x * s;
      b.vel.z = this.shoveDir.z * s;
    } else if (this.slideT > 0 && b.onGround) {
      // FLOW's slide: bleeds speed, steers a little, ends slow or late (a jump out of it keeps it all)
      const S = FLOW.slide;
      this.slideT -= dt;
      const hs1 = Math.max(0, Math.hypot(b.vel.x, b.vel.z) - S.decel * dt);
      this.steer(hs1, want > 0, dirX, dirZ, S.steer * dt);
      if (hs1 < S.endSpeed) this.slideT = 0;
    } else if (b.onGround && b.charge > 0 && Math.hypot(b.vel.x, b.vel.z) > sprintSpeed) {
      // rift slide: momentum skids off instead of stopping dead; a little steering
      const hs0 = Math.hypot(b.vel.x, b.vel.z);
      const hs1 = Math.max(0, hs0 - FEEL.slideDecel * dt);
      let ux = b.vel.x / hs0, uz = b.vel.z / hs0;
      if (want > 0) {
        const k = Math.min(1, FEEL.slideSteer * dt);
        ux += (dirX - ux) * k;
        uz += (dirZ - uz) * k;
        const ul = Math.hypot(ux, uz) || 1;
        ux /= ul;
        uz /= ul;
      }
      b.vel.x = ux * hs1;
      b.vel.z = uz * hs1;
      if (!this.sliding) this.char.play('roll', { fade: 0.06 });
      this.sliding = true;
    } else if (b.onGround) {
      const hs = Math.hypot(b.vel.x, b.vel.z);
      if (flow && want > 0 && hs > maxSpeed + 0.1 && (b.vel.x * dirX + b.vel.z * dirZ) / hs > 0.5) {
        // FLOW: over the cap (a slide, a kick, a rift) and still pushing on: the speed bleeds, it doesn't stop
        this.steer(Math.max(maxSpeed, hs - FLOW.move.overspeedDecel * dt), true, dirX, dirZ, FLOW.slide.steer * 2 * dt);
      } else {
        const a = 1 - Math.exp(-accel * dt);
        b.vel.x += (tx - b.vel.x) * a;
        b.vel.z += (tz - b.vel.z) * a;
      }
    } else {
      if (this.slideT > 0) this.slideT = 0; // off a ledge: the slide is over, the speed isn't
      if (want > 0) {
        // air: only add toward the wish direction, never brake momentum without input
        const control = b.charge > 0 ? FEEL.chargedAirControl : flow ? FLOW.move.airControl : FEEL.airControl;
        const cur = b.vel.x * dirX + b.vel.z * dirZ;
        const add = Math.min(accel * control * maxSpeed * dt, want - cur);
        if (add > 0) {
          b.vel.x += dirX * add;
          b.vel.z += dirZ * add;
        }
      }
    }

    if (this.sliding && !(b.onGround && b.charge > 0 && Math.hypot(b.vel.x, b.vel.z) > sprintSpeed)) this.sliding = false;

    // --- facing ---
    const hs = Math.hypot(b.vel.x, b.vel.z);
    if (lunging) this.yaw = yawOf(this.lungeDir);
    else if (this.aim > 0.3) this.yaw = dampAngle(this.yaw, input.camYaw, 18, dt);
    else if (this.shoveT > 0) this.yaw = yawOf(this.shoveDir);
    else if (hs > 0.3 && inputMag > 0.05) this.yaw = dampAngle(this.yaw, Math.atan2(b.vel.x, b.vel.z), 11, dt);

    // --- jump / mantle (buffered, with coyote time) ---
    this.jumpBuf = input.jump ? FEEL.jumpBuffer : Math.max(0, this.jumpBuf - dt);
    this.coyote = b.onGround ? FEEL.coyoteTime : Math.max(0, this.coyote - dt);
    if (this.jumpBuf > 0 && this.coyote > 0 && this.shoveT <= 0 && !lunging) {
      this.jumpBuf = 0;
      this.coyote = 0;
      if (this.tryMantle(world)) {
        this.animate(dt, 1.2, true);
        return;
      }
      b.vel.y = FEEL.jumpSpeed;
      b.onGround = false;
      this.crouched = false;
      this.slideT = 0;
      ev.jumped(b.pos.clone());
      this.char.play('jumpStart', { fade: 0.08 });
    } else if (flow && this.jumpBuf > 0 && !b.onGround && this.shoveT <= 0 && !lunging) {
      // FLOW in the air: a ledge in reach is climbed, a wall beside you kicked off, else the double jump
      if (this.tryMantle(world)) {
        this.jumpBuf = 0;
        this.animate(dt, 1.2, true);
        return;
      }
      if (this.airTime >= FLOW.wall.minAir && this.wallCd <= 0 && this.wallKick(world)) {
        this.jumpBuf = 0;
        this.wallCd = FLOW.wall.cooldown;
        this.airJumps = FLOW.jump.airJumps;
        ev.airJump?.(b.pos.clone(), true);
        this.char.play('jumpStart', { fade: 0.06 });
      } else if (this.airJumps > 0) {
        this.jumpBuf = 0;
        this.airJumps--;
        // the second jump turns your flight toward the stick (its speed is kept)
        const h = Math.hypot(b.vel.x, b.vel.z);
        if (want > 0 && h > 0.5) {
          const r = FLOW.jump.redirect;
          let ux = b.vel.x / h + (dirX - b.vel.x / h) * r, uz = b.vel.z / h + (dirZ - b.vel.z / h) * r;
          const ul = Math.hypot(ux, uz) || 1;
          ux /= ul;
          uz /= ul;
          b.vel.x = ux * h;
          b.vel.z = uz * h;
        }
        b.vel.y = Math.max(b.vel.y, FLOW.jump.doubleJumpSpeed);
        ev.airJump?.(b.pos.clone(), false);
        this.char.play('jumpStart', { fade: 0.06 });
      }
    }

    // --- integrate: gravity, collision, rift crossings ---
    const px = b.pos.x, pz = b.pos.z;
    physics.stepBody(b, dt, this.wrapped, time);

    this.airTime = b.onGround ? 0 : this.airTime + dt;
    if (b.onGround && b.groundCollider) this.lastSafe.copy(b.pos);

    // --- footsteps ---
    const moved = Math.hypot(b.pos.x - px, b.pos.z - pz);
    if (b.onGround && moved < 1 && !lunging) {
      this.stride += moved;
      const len = this.sprinting ? 1.05 : this.crouched ? 0.6 : 0.78;
      if (this.stride > len) {
        this.stride = 0;
        const loud = this.sprinting ? 1 : this.crouched ? 0.1 : 0.4;
        const radius = this.sprinting ? 12 : this.crouched ? 1.0 : 3.0;
        ev.footstep(b.pos.clone(), loud, radius);
      }
    }

    this.animate(dt, b.onGround ? Math.hypot(b.vel.x, b.vel.z) : hs, b.onGround);
  }

  /** Set horizontal speed `hs`, turned `k` (0..1) toward the stick when it's pushed. */
  private steer(hs: number, steer: boolean, dirX: number, dirZ: number, k: number) {
    const b = this.body;
    const h = Math.hypot(b.vel.x, b.vel.z);
    if (h < 1e-4) return;
    let ux = b.vel.x / h, uz = b.vel.z / h;
    if (steer) {
      const kk = Math.min(1, k);
      ux += (dirX - ux) * kk;
      uz += (dirZ - uz) * kk;
      const ul = Math.hypot(ux, uz) || 1;
      ux /= ul;
      uz /= ul;
    }
    b.vel.x = ux * hs;
    b.vel.z = uz * hs;
  }

  /** FLOW: the nearest wall beside you (8 ways round, waist high) kicks you off it. */
  private wallKick(world: CollisionWorld): boolean {
    const b = this.body;
    const W = FLOW.wall;
    _o.set(b.pos.x, b.pos.y + 0.9, b.pos.z);
    let best = Infinity;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const h = world.raycast(_o, _v.set(Math.sin(a), 0, Math.cos(a)), W.reach, { sight: false });
      if (!h || h.distance >= best || Math.abs(h.normal.y) > 0.5) continue;
      best = h.distance;
      _n.set(h.normal.x, 0, h.normal.z).normalize();
    }
    if (best === Infinity) return false;
    // keep the run along the wall, lose what went into it, then out and up
    const into = b.vel.x * _n.x + b.vel.z * _n.z;
    b.vel.x -= _n.x * into;
    b.vel.z -= _n.z * into;
    b.vel.x += _n.x * W.out;
    b.vel.z += _n.z * W.out;
    b.vel.y = Math.max(b.vel.y, W.up);
    b.onGround = false;
    this.yaw = Math.atan2(b.vel.x, b.vel.z);
    return true;
  }

  private animate(dt: number, speed: number, grounded: boolean) {
    const L = this.loco;
    L.speed = speed;
    L.grounded = grounded;
    L.vy = this.body.vel.y;
    L.crouch = this.crouchT;
    L.aim = this.aim;
    this.char.root.position.copy(this.body.pos);
    this.char.root.rotation.y = this.yaw;
    this.char.update(dt, L);
  }

  private onCrossed(from: RiftEnd, to: RiftEnd, speed: number) {
    const old = this.yaw;
    // out of a door / wall: face where you're going; floors and ceilings keep your yaw
    if (Math.abs(to.normal.y) < 0.5) this.yaw = yawOf(to.normal);
    // FLOW: a rift is a way to travel: out of a door or a wall, a little faster than in (to a cap)
    if (flowOn() && Math.abs(to.normal.y) < 0.5) {
      const v = this.body.vel;
      const s = v.length();
      const k = Math.min(FLOW.portal.exitBoost, Math.max(1, FLOW.portal.cap / Math.max(s, 1e-3)));
      v.multiplyScalar(k);
    }
    this.shoveT = 0;
    this.lungeT = 0;
    let d = this.yaw - old;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.ev?.crossed(from, to, d, speed);
  }

  private onImpact(e: ImpactInfo) {
    if (e.surface !== 'ground') return;
    const speed = e.speed, charged = e.charged;
    if (charged || this.airTime > 0.25 || speed > 4) this.ev?.landed(this.body.pos.clone(), speed, charged);
    const hurt = LAW.player.uncharged;
    if (!charged && speed > hurt.hurtFrom) this.ev?.fallDamage((speed - hurt.hurtFrom) * hurt.perMs);
    if (speed >= 10) this.char.play('roll', { fade: 0.06 });
    else if (this.airTime > 0.35) this.char.play('jumpLand', { fade: 0.06 });
  }

  private tryMantle(world: CollisionWorld) {
    const b = this.body;
    const f = this.forward(_v);
    for (const d of [0.5, 0.75, 1.0, 1.2]) {
      const px = b.pos.x + f.x * d, pz = b.pos.z + f.z * d;
      const top = world.groundAt(px, pz, 0.18, b.pos.y + FEEL.mantleMax);
      if (!(top > b.pos.y + 0.55)) continue;
      if (world.ceilingAt(px, pz, 0.25, top + 0.05) < top + 1.85) continue;
      if (world.overlapsCylinder(px, pz, FEEL.playerRadius * 0.8, top + 0.02, top + 1.7)) continue;
      // the space above our head on the way up must be clear
      if (world.ceilingAt(b.pos.x, b.pos.z, 0.2, b.pos.y + this.height) < top + 1.0) continue;
      this.mantle = { from: b.pos.clone(), to: new THREE.Vector3(px + f.x * 0.25, top, pz + f.z * 0.25), t: 0 };
      this.crouched = false;
      this.char.play('jumpStart', { fade: 0.08 });
      return true;
    }
    return false;
  }
}

export function dampAngle(a: number, b: number, lambda: number, dt: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}
