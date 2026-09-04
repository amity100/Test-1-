import * as THREE from 'three';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Terrain } from '../world/Terrain';
import type { Entity } from './Entities';
import { GRAPPLE } from './Weapons';
import { clamp, damp } from '../core/MathUtil';
import { PLAYABLE_RADIUS } from '../world/Layout';

export interface MoveInput {
  /** Strafe (-1..1) and forward (-1..1) relative to yaw. */
  strafe: number;
  forward: number;
  jump: boolean;
  jumpHeld: boolean;
  sprint: boolean;
  crouch: boolean;
}

export const PHYS = {
  walkSpeed: 5.4,
  sprintSpeed: 8.0,
  crouchSpeed: 2.8,
  adsSpeedMult: 0.7,
  slideSpeed: 10.5,
  slideDuration: 0.85,
  groundAccel: 42,
  airAccel: 14,
  groundFriction: 11,
  airDrag: 0.4,
  gravity: 24,
  jumpVel: 8.4,
  maxFall: 55,
  mantleMaxHeight: 2.3,
  coyoteTime: 0.12,
};

const tmp = new THREE.Vector3();
const desired = new THREE.Vector3();

/** Kinematic AABB character vs voxels + terrain heightfield. Shared by players and bots. */
export class CharacterController {
  constructor(private world: VoxelWorld, private terrain: Terrain) {}

  private collides(x: number, y: number, z: number, r: number, h: number): boolean {
    // Ramps never block: the ramp pass below lifts the character onto their surface instead.
    return this.world.boxIntersectsSolid(x - r, y, z - r, x + r, y + h, z + r, true);
  }

  /** True when the entity's box fits at the given feet position. */
  fits(x: number, y: number, z: number, e: Entity): boolean {
    if (this.collides(x, y, z, e.radius, e.height)) return false;
    return y >= this.terrain.heightAt(x, z) - 0.02;
  }

  step(e: Entity, input: MoveInput, dt: number): void {
    if (!e.alive) return;
    const world = this.world;
    e.wasGrounded = e.grounded;

    // Crouch / slide state.
    if (e.sliding) {
      e.slideTimer -= dt;
      if (e.slideTimer <= 0 || !e.grounded) e.sliding = false;
    }
    if (input.crouch && !e.crouching && !e.sliding) {
      if (e.grounded && input.sprint && tmp.set(e.vel.x, 0, e.vel.z).length() > PHYS.walkSpeed * 1.05) {
        e.sliding = true;
        e.slideTimer = PHYS.slideDuration;
        const dir = tmp.set(e.vel.x, 0, e.vel.z).normalize();
        e.vel.x = dir.x * PHYS.slideSpeed;
        e.vel.z = dir.z * PHYS.slideSpeed;
      }
      e.crouching = true;
    } else if (!input.crouch && e.crouching && !e.sliding) {
      // Only stand up if there is headroom.
      if (!this.collides(e.pos.x, e.pos.y, e.pos.z, e.radius, e.standHeight)) e.crouching = false;
    }
    if (e.sliding) e.crouching = true;

    // Grapple: pulls towards the anchor and ignores gravity.
    if (e.grapplePoint) {
      e.grappleTime += dt;
      const to = tmp.copy(e.grapplePoint).sub(e.pos).sub(new THREE.Vector3(0, e.eyeHeight * 0.8, 0));
      const dist = to.length();
      if (dist < GRAPPLE.detachDistance || e.grappleTime > GRAPPLE.maxTime) {
        e.grapplePoint = null;
        e.vel.multiplyScalar(0.55);
        if (e.vel.y < 4) e.vel.y = 4;
      } else {
        to.normalize();
        const target = to.multiplyScalar(GRAPPLE.pullSpeed);
        // Add a little steering from input.
        const fwd = e.forwardFlat(new THREE.Vector3());
        const right = e.right(new THREE.Vector3());
        target.addScaledVector(fwd, input.forward * 3).addScaledVector(right, input.strafe * 3);
        e.vel.x = damp(e.vel.x, target.x, 9, dt);
        e.vel.y = damp(e.vel.y, target.y, 9, dt);
        e.vel.z = damp(e.vel.z, target.z, 9, dt);
      }
    }

    // Horizontal movement.
    const fwd = e.forwardFlat(new THREE.Vector3());
    const right = e.right(new THREE.Vector3());
    desired.set(0, 0, 0).addScaledVector(fwd, input.forward).addScaledVector(right, input.strafe);
    if (desired.lengthSq() > 1) desired.normalize();
    let speed = PHYS.walkSpeed;
    if (e.crouching) speed = PHYS.crouchSpeed;
    else if (input.sprint && input.forward > 0.2 && e.ads < 0.3) speed = PHYS.sprintSpeed;
    if (e.ads > 0.3) speed *= PHYS.adsSpeedMult;
    desired.multiplyScalar(speed);

    if (!e.grapplePoint) {
      if (e.sliding) {
        // Slides keep momentum with light friction and mild steering.
        const f = Math.exp(-2.2 * dt);
        e.vel.x = e.vel.x * f + desired.x * 0.6 * dt;
        e.vel.z = e.vel.z * f + desired.z * 0.6 * dt;
      } else if (e.grounded) {
        e.vel.x = damp(e.vel.x, desired.x, PHYS.groundFriction, dt);
        e.vel.z = damp(e.vel.z, desired.z, PHYS.groundFriction, dt);
      } else {
        // Air control: accelerate towards desired without exceeding it.
        const cur = tmp.set(e.vel.x, 0, e.vel.z);
        const add = desired.clone().sub(cur).multiplyScalar(clamp(PHYS.airAccel * dt / Math.max(0.1, speed), 0, 1));
        e.vel.x += add.x;
        e.vel.z += add.z;
      }
      // Gravity.
      e.vel.y -= PHYS.gravity * dt;
      if (e.vel.y < -PHYS.maxFall) e.vel.y = -PHYS.maxFall;
    }

    // Jump with coyote time and buffering.
    if (e.grounded) e.coyoteTimer = PHYS.coyoteTime;
    else e.coyoteTimer -= dt;
    if (input.jump) e.jumpBuffered = true;
    if (e.jumpBuffered && (e.grounded || e.coyoteTimer > 0) && !e.grapplePoint) {
      e.vel.y = PHYS.jumpVel;
      e.grounded = false;
      e.coyoteTimer = 0;
      e.jumpBuffered = false;
      e.sliding = false;
    }
    if (!input.jumpHeld) e.jumpBuffered = false;

    // Integrate with axis-separated collision, sub-stepping fast movement.
    const totalMove = tmp.copy(e.vel).multiplyScalar(dt).length();
    const steps = Math.max(1, Math.ceil(totalMove / 0.4));
    const sdt = dt / steps;
    let hitWall = false;
    for (let i = 0; i < steps; i++) {
      hitWall = this.moveAxis(e, 0, e.vel.x * sdt) || hitWall;
      hitWall = this.moveAxis(e, 2, e.vel.z * sdt) || hitWall;
      this.moveAxis(e, 1, e.vel.y * sdt);
    }

    // Terrain floor.
    const th = this.terrain.heightAt(e.pos.x, e.pos.z);
    let grounded = false;
    if (e.pos.y <= th + 0.001) {
      if (e.vel.y < -12) e.landImpact = Math.min(1, -e.vel.y / 40);
      e.pos.y = th;
      if (e.vel.y < 0) e.vel.y = 0;
      grounded = true;
    }
    // Ramp floor: slopes are walked like terrain.
    if (!e.grapplePoint || e.vel.y <= 0) {
      const ramp = world.rampHeightAt(e.pos.x, e.pos.z, e.pos.y);
      if (ramp !== null && e.pos.y <= ramp + 0.001) {
        if (e.vel.y < -12) e.landImpact = Math.min(1, -e.vel.y / 40);
        e.pos.y = ramp + 0.001;
        if (e.vel.y < 0) e.vel.y = 0;
        grounded = true;
      }
    }
    // Voxel floor check (small probe below the feet).
    if (!grounded && e.vel.y <= 0.01) {
      if (this.collides(e.pos.x, e.pos.y - 0.06, e.pos.z, e.radius * 0.98, 0.05)) grounded = true;
    }
    e.grounded = grounded;
    if (grounded && !e.wasGrounded && e.vel.y <= 0) {
      /* landed */
    }

    // Mantle: when pushing into a low wall, hop onto it.
    e.mantleTimer = Math.max(0, e.mantleTimer - dt);
    if (hitWall && desired.lengthSq() > 0.5 && e.mantleTimer <= 0 && !e.grapplePoint) {
      this.tryMantle(e, desired);
    }

    // Keep inside the island.
    const rr = Math.sqrt(e.pos.x * e.pos.x + e.pos.z * e.pos.z);
    if (rr > PLAYABLE_RADIUS) {
      const k = PLAYABLE_RADIUS / rr;
      e.pos.x *= k;
      e.pos.z *= k;
    }
    if (e.pos.y < -2) {
      e.pos.y = Math.max(th, 0);
      e.vel.set(0, 0, 0);
    }
    void world;
  }

  /** Moves along one axis and resolves voxel collisions. Returns true if blocked. */
  private moveAxis(e: Entity, axis: 0 | 1 | 2, delta: number): boolean {
    if (delta === 0) return false;
    const p = e.pos;
    const r = e.radius;
    const h = e.height;
    const eps = 0.001;
    if (axis === 0) p.x += delta;
    else if (axis === 1) p.y += delta;
    else p.z += delta;
    if (!this.collides(p.x, p.y, p.z, r, h)) return false;
    // Push back to the voxel boundary.
    if (axis === 0) {
      p.x = delta > 0 ? Math.floor(p.x + r) - r - eps : Math.ceil(p.x - r) + r + eps;
      e.vel.x = 0;
    } else if (axis === 1) {
      if (delta > 0) {
        p.y = Math.floor(p.y + h) - h - eps;
        e.vel.y = 0;
      } else {
        p.y = Math.ceil(p.y) + eps;
        if (e.vel.y < -12) e.landImpact = Math.min(1, -e.vel.y / 40);
        e.vel.y = 0;
        e.grounded = true;
      }
    } else {
      p.z = delta > 0 ? Math.floor(p.z + r) - r - eps : Math.ceil(p.z - r) + r + eps;
      e.vel.z = 0;
    }
    // If still colliding (corner cases), nudge upwards slightly.
    if (this.collides(p.x, p.y, p.z, r, h)) {
      for (let i = 0; i < 4; i++) {
        p.y += 0.05;
        if (!this.collides(p.x, p.y, p.z, r, h)) break;
      }
    }
    return true;
  }

  private tryMantle(e: Entity, dir: THREE.Vector3): void {
    const d = tmp.copy(dir).normalize();
    const aheadX = e.pos.x + d.x * (e.radius + 0.35);
    const aheadZ = e.pos.z + d.z * (e.radius + 0.35);
    // Find the top of the obstacle ahead within reach.
    const baseY = Math.floor(e.pos.y + 0.01);
    let ledge = -1;
    const ax = Math.floor(aheadX);
    const az = Math.floor(aheadZ);
    for (let y = baseY + Math.ceil(PHYS.mantleMaxHeight); y >= baseY; y--) {
      if (this.world.isSolid(ax, y, az)) {
        // Shaped blocks (slabs, stairs) have lower tops: step onto their actual surface.
        ledge = this.world.surfaceTop(ax, y, az, aheadX - ax, aheadZ - az);
        break;
      }
    }
    if (ledge < 0) return;
    const rise = ledge - e.pos.y;
    if (rise <= 0.05 || rise > PHYS.mantleMaxHeight) return;
    // Allow mantling from the ground for 1-block steps, or when airborne and close to the ledge.
    if (rise > 1.05 && e.grounded) return;
    if (!e.grounded && e.vel.y < -6) return;
    if (!e.grounded && rise > 1.35 && e.vel.y < 1.5) return;
    const nx = e.pos.x + d.x * 0.45;
    const nz = e.pos.z + d.z * 0.45;
    if (this.collides(nx, ledge + 0.02, nz, e.radius, e.height)) return;
    if (rise <= 1.05 && e.grounded) {
      // Smooth step-up.
      e.pos.y = ledge + 0.01;
      e.pos.x = nx;
      e.pos.z = nz;
      e.vel.y = Math.max(e.vel.y, 0);
      e.grounded = true;
    } else {
      e.pos.y = ledge + 0.01;
      e.pos.x = nx;
      e.pos.z = nz;
      e.vel.y = 2.5;
      e.vel.x = d.x * 2;
      e.vel.z = d.z * 2;
    }
    e.mantleTimer = 0.25;
  }
}
