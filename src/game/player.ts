import * as THREE from 'three';
import { FEEL } from '../config';
import { LAW } from '../core/contracts';
import type { CharacterAPI, DynBody, ImpactInfo, LocomotionInput, PhysicsAPI, PhysicsEvents, RiftEnd, V3 } from '../core/contracts';
import type { CollisionWorld } from '../world/collision';
import { Body } from '../sim/physics';
import { yawOf } from './portalMath';

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
}

export interface PlayerEvents {
  footstep(pos: V3, loud: number, radius: number): void;
  jumped(pos: V3): void;
  landed(pos: V3, speed: number, charged: boolean): void;
  fallDamage(amount: number): void;
  shoved(from: V3, dir: V3): void;
  crossed(from: RiftEnd, to: RiftEnd, yawDelta: number, speed: number): void;
}

const _v = new THREE.Vector3();
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
  private jumpBuf = 0;
  private coyote = 0;
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
    this.shoveT = 0;
    this.airTime = 0;
    this.lastSafe.copy(p);
  }

  update(dt: number, input: PlayerInput, world: CollisionWorld, physics: PhysicsAPI, physEv: PhysicsEvents, ev: PlayerEvents, time: number) {
    this.physEv = physEv;
    this.ev = ev;
    const b = this.body;
    this.shoveCooldown = Math.max(0, this.shoveCooldown - dt);

    // crouch (stand up only with headroom)
    let crouch = input.crouch && !this.mantle;
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
    const maxSpeed = this.carrying ? FEEL.carrySpeed : this.sprinting ? FEEL.sprintSpeed : this.crouched ? FEEL.crouchSpeed : FEEL.walkSpeed;
    const want = inputMag > 0 ? maxSpeed * Math.max(inputMag, 0.35) : 0;
    const tx = dirX * want, tz = dirZ * want;

    // --- shove: a short dash ---
    if (input.shove && this.shoveCooldown <= 0) {
      if (inputMag > 0.1) this.shoveDir.set(dirX, 0, dirZ);
      else this.forward(this.shoveDir);
      this.shoveT = FEEL.shoveTime;
      this.shoveCooldown = LAW.shove.cooldown;
      this.yaw = yawOf(this.shoveDir);
      this.crouched = false;
      ev.shoved(b.pos.clone(), this.shoveDir.clone());
      this.char.play('push', { fade: 0.08 });
    }

    if (this.shoveT > 0) {
      this.shoveT -= dt;
      const s = this.shoveT > 0 ? SHOVE_SPEED : want;
      b.vel.x = this.shoveDir.x * s;
      b.vel.z = this.shoveDir.z * s;
    } else if (b.onGround) {
      const a = 1 - Math.exp(-FEEL.accel * dt);
      b.vel.x += (tx - b.vel.x) * a;
      b.vel.z += (tz - b.vel.z) * a;
    } else if (want > 0) {
      // air: only add toward the wish direction, never brake momentum without input
      const control = b.charge > 0 ? FEEL.chargedAirControl : FEEL.airControl;
      const cur = b.vel.x * dirX + b.vel.z * dirZ;
      const add = Math.min(FEEL.accel * control * maxSpeed * dt, want - cur);
      if (add > 0) {
        b.vel.x += dirX * add;
        b.vel.z += dirZ * add;
      }
    }

    // --- facing ---
    const hs = Math.hypot(b.vel.x, b.vel.z);
    if (this.aim > 0.3) this.yaw = dampAngle(this.yaw, input.camYaw, 18, dt);
    else if (this.shoveT > 0) this.yaw = yawOf(this.shoveDir);
    else if (hs > 0.3 && inputMag > 0.05) this.yaw = dampAngle(this.yaw, Math.atan2(b.vel.x, b.vel.z), 11, dt);

    // --- jump / mantle (buffered, with coyote time) ---
    this.jumpBuf = input.jump ? FEEL.jumpBuffer : Math.max(0, this.jumpBuf - dt);
    this.coyote = b.onGround ? FEEL.coyoteTime : Math.max(0, this.coyote - dt);
    if (this.jumpBuf > 0 && this.coyote > 0 && this.shoveT <= 0) {
      this.jumpBuf = 0;
      this.coyote = 0;
      if (this.tryMantle(world)) {
        this.animate(dt, 1.2, true);
        return;
      }
      b.vel.y = FEEL.jumpSpeed;
      b.onGround = false;
      this.crouched = false;
      ev.jumped(b.pos.clone());
      this.char.play('jumpStart', { fade: 0.08 });
    }

    // --- integrate: gravity, collision, rift crossings ---
    const px = b.pos.x, pz = b.pos.z;
    physics.stepBody(b, dt, this.wrapped, time);

    this.airTime = b.onGround ? 0 : this.airTime + dt;
    if (b.onGround && b.groundCollider) this.lastSafe.copy(b.pos);

    // --- footsteps ---
    const moved = Math.hypot(b.pos.x - px, b.pos.z - pz);
    if (b.onGround && moved < 1) {
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
    this.shoveT = 0;
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
