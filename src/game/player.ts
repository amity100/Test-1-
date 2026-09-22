import * as THREE from 'three';
import { FEEL } from '../config';
import { CollisionWorld } from '../world/collision';
import { Character } from './characters';
import { RiftSystem, Portal } from './portals';
import { yawOf } from './portalMath';

export interface PlayerEvents {
  footstep(pos: THREE.Vector3, loudness: number, radius: number): void;
  landed(pos: THREE.Vector3, force: number): void;
  passed(p: Portal, yawDelta: number): void;
  fellInWater(): void;
}

const _v = new THREE.Vector3();

export class Player {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  onGround = true;
  crouched = false;
  sprinting = false;
  health = FEEL.maxHealth;
  char: Character;
  carrying: any = null;
  lastSafe = new THREE.Vector3();
  private stride = 0;
  private mantle: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  private airTime = 0;
  lungeT = 0;
  autoWalk: { target: THREE.Vector3; t: number } | null = null;
  lastPassT = 0;
  crouchT = 0;
  hurtT = 0;

  constructor(char: Character) {
    this.char = char;
  }

  get height() {
    return THREE.MathUtils.lerp(FEEL.playerHeight, FEEL.crouchHeight, this.crouchT);
  }

  eye(out = new THREE.Vector3()) {
    return out.copy(this.pos).setY(this.pos.y + this.height - 0.12);
  }

  chest(out = new THREE.Vector3()) {
    return out.copy(this.pos).setY(this.pos.y + this.height * 0.6);
  }

  forward(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  teleport(p: THREE.Vector3, yaw?: number) {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    if (yaw !== undefined) this.yaw = yaw;
    this.mantle = null;
    this.autoWalk = null;
  }

  isMantling() {
    return !!this.mantle;
  }

  /**
   * @param move  input vector (x right, y forward) in camera space
   * @param camYaw camera yaw, so "forward" means "where I'm looking"
   */
  update(dt: number, move: { x: number; y: number }, camYaw: number, jump: boolean, sprint: boolean, strafe: boolean, world: CollisionWorld, rift: RiftSystem, ev: PlayerEvents) {
    this.crouchT = THREE.MathUtils.damp(this.crouchT, this.crouched ? 1 : 0, 12, dt);
    this.lastPassT += dt;
    this.hurtT = Math.max(0, this.hurtT - dt);

    if (this.mantle) {
      const m = this.mantle;
      m.t += dt / FEEL.mantleTime;
      const k = Math.min(1, m.t);
      const up = Math.min(1, k * 1.6);
      const fwd = Math.max(0, (k - 0.45) / 0.55);
      this.pos.set(THREE.MathUtils.lerp(m.from.x, m.to.x, fwd), THREE.MathUtils.lerp(m.from.y, m.to.y, 1 - (1 - up) * (1 - up)), THREE.MathUtils.lerp(m.from.z, m.to.z, fwd));
      if (k >= 1) {
        this.mantle = null;
        this.onGround = true;
        this.vel.set(0, 0, 0);
      }
      this.char.root.position.copy(this.pos);
      this.char.root.rotation.y = this.yaw;
      this.char.update(dt, 1.2);
      return;
    }

    // --- desired velocity ---
    let mx = move.x, my = move.y;
    if (this.autoWalk) {
      this.autoWalk.t -= dt;
      _v.subVectors(this.autoWalk.target, this.pos).setY(0);
      const d = _v.length();
      if (this.autoWalk.t <= 0 || d < 0.05) this.autoWalk = null;
      else {
        const lyaw = Math.atan2(_v.x, _v.z) - camYaw;
        mx = -Math.sin(lyaw);
        my = Math.cos(lyaw);
      }
    }
    const inputMag = Math.min(1, Math.hypot(mx, my));
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    // camera-relative: right = (-fz, fx)? yaw 0 looks +Z, right is -X
    const dirX = fx * my - fz * mx;
    const dirZ = fz * my + fx * mx;
    this.sprinting = sprint && !this.crouched && !this.carrying && inputMag > 0.5;
    const maxSpeed = this.carrying ? FEEL.carrySpeed : this.sprinting ? FEEL.sprintSpeed : this.crouched ? FEEL.crouchSpeed : FEEL.walkSpeed;
    const tx = dirX * maxSpeed * (inputMag > 0 ? 1 : 0) * Math.max(inputMag, 0.35 * Math.sign(inputMag));
    const tz = dirZ * maxSpeed * (inputMag > 0 ? 1 : 0) * Math.max(inputMag, 0.35 * Math.sign(inputMag));
    const control = this.onGround ? 1 : FEEL.airControl;
    const a = 1 - Math.exp(-FEEL.accel * control * dt);
    this.vel.x += (tx - this.vel.x) * a;
    this.vel.z += (tz - this.vel.z) * a;

    // facing
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (strafe) this.yaw = dampAngle(this.yaw, camYaw, 18, dt);
    else if (hs > 0.3 && inputMag > 0.05) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 11, dt);

    // jump / mantle
    if (jump && this.onGround) {
      if (!this.tryMantle(world)) {
        this.vel.y = FEEL.jumpSpeed;
        this.onGround = false;
        if (this.crouched) this.crouched = false;
      }
    }

    // gravity
    if (!this.onGround) this.vel.y -= FEEL.gravity * dt;
    this.airTime = this.onGround ? 0 : this.airTime + dt;

    const prevChest = this.chest(new THREE.Vector3());
    const prevFeet = this.pos.clone();
    this.pos.addScaledVector(this.vel, dt);

    // --- rift traversal ---
    const curChest = this.chest(new THREE.Vector3());
    const portal = rift.findCrossing(prevChest, curChest, 0.05);
    if (portal) {
      const exit = portal.linked;
      const oldYaw = this.yaw;
      const newFeet = rift.transform(portal, this.pos, new THREE.Vector3());
      const newVel = rift.transformDir(portal, this.vel, new THREE.Vector3());
      const fwd = rift.transformDir(portal, this.forward(new THREE.Vector3()), new THREE.Vector3());
      if (Math.abs(exit.normal.y) > 0.5) {
        // ceiling (or floor) exit: come out upright, centred, falling
        newFeet.set(exit.position.x, exit.position.y - (exit.normal.y < 0 ? 1.95 : -0.05), exit.position.z);
        newVel.set(this.vel.x * 0.2, exit.normal.y < 0 ? -2 : Math.hypot(this.vel.x, this.vel.z), this.vel.z * 0.2);
        this.yaw = yawOf(new THREE.Vector3(0, 1, 0).applyQuaternion(exit.quaternion));
      } else {
        this.yaw = Math.atan2(fwd.x, fwd.z);
        // pop clear of the exit surface
        newFeet.addScaledVector(exit.normal, FEEL.playerRadius * 0.6);
      }
      this.pos.copy(newFeet);
      this.vel.copy(newVel);
      this.onGround = false;
      this.lastPassT = 0;
      this.autoWalk = null;
      rift.markPassed(portal, 'player');
      ev.passed(portal, this.yaw - oldYaw);
    }

    // --- collision ---
    const feet = this.pos.y;
    const head = feet + this.height;
    world.resolveCircle(this.pos, FEEL.playerRadius, feet, head, FEEL.stepUp, (c) => rift.hostPassable(c, this.pos, FEEL.playerRadius));
    const ceil = world.ceilingAt(this.pos.x, this.pos.z, FEEL.playerRadius * 0.7, feet + 0.5);
    if (head > ceil && this.vel.y > 0) {
      this.vel.y = 0;
      this.pos.y = ceil - this.height;
    }
    const g = world.groundAt(this.pos.x, this.pos.z, FEEL.playerRadius * 0.65, feet + FEEL.stepUp);
    const wasGround = this.onGround;
    if (g > -Infinity && this.pos.y <= g + 0.001 && this.vel.y <= 0) {
      if (!wasGround && this.airTime > 0.35) ev.landed(this.pos.clone(), Math.min(1, -this.vel.y / 14));
      this.pos.y = g;
      this.vel.y = 0;
      this.onGround = true;
    } else if (wasGround && g > -Infinity && this.pos.y - g < 0.38 && this.vel.y <= 0) {
      // stick to ground walking down steps
      this.pos.y = g;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    if (this.onGround && g > -1) this.lastSafe.copy(this.pos);
    if (this.pos.y < -1.4) ev.fellInWater();

    // --- footsteps ---
    const moved = Math.hypot(this.pos.x - prevFeet.x, this.pos.z - prevFeet.z);
    if (this.onGround && moved < 1) {
      this.stride += moved;
      const len = this.sprinting ? 1.05 : this.crouched ? 0.6 : 0.78;
      if (this.stride > len) {
        this.stride = 0;
        const loud = this.sprinting ? 1 : this.crouched ? 0.1 : 0.4;
        const radius = this.sprinting ? 12 : this.crouched ? 1.0 : 3.0;
        ev.footstep(this.pos.clone(), loud, radius);
      }
    }

    // --- animation ---
    this.char.crouch = this.crouchT;
    this.char.root.position.copy(this.pos);
    this.char.root.rotation.y = this.yaw;
    this.char.update(dt, this.onGround ? hs : 0.5);
  }

  private tryMantle(world: CollisionWorld) {
    const f = this.forward(_v);
    for (const d of [0.5, 0.75, 1.0, 1.2]) {
      const px = this.pos.x + f.x * d, pz = this.pos.z + f.z * d;
      const top = world.groundAt(px, pz, 0.18, this.pos.y + FEEL.mantleMax);
      if (!(top > this.pos.y + 0.55)) continue;
      if (world.ceilingAt(px, pz, 0.25, top + 0.05) < top + 1.85) continue;
      if (world.overlapsCylinder(px, pz, FEEL.playerRadius * 0.8, top + 0.02, top + 1.7)) continue;
      // make sure the space above our head on the way up is clear
      if (world.ceilingAt(this.pos.x, this.pos.z, 0.2, this.pos.y + this.height) < top + 1.0) continue;
      this.mantle = { from: this.pos.clone(), to: new THREE.Vector3(px + f.x * 0.25, top, pz + f.z * 0.25), t: 0 };
      this.crouched = false;
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
