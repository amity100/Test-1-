import * as THREE from 'three';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Terrain } from '../world/Terrain';
import type { Entity } from './Entities';
import { BURROW, SWING, type GadgetSystem } from './Gadgets';
import type { TrapSystem } from './Traps';
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
  gravity: 30,
  jumpVel: 8.3,
  maxFall: 55,
  mantleMaxHeight: 2.3,
  coyoteTime: 0.12,
};

const tmp = new THREE.Vector3();
const desired = new THREE.Vector3();

/** Kinematic AABB character vs voxels + terrain heightfield. Shared by players and bots. */
export class CharacterController {
  /** Gadget simulation (zipline rides, burrowing, rope release); set by the game. */
  gadgets: GadgetSystem | null = null;
  /** Traps: closed gates are walls for everyone but their builder. */
  traps: TrapSystem | null = null;
  /** The entity being moved (so gates know whom to let through). */
  private mover: Entity | null = null;
  /** Set by the game: shatters a glass block, true when one broke (sprinting bodies go through glass). */
  breakGlass: ((x: number, y: number, z: number) => boolean) | null = null;

  constructor(private world: VoxelWorld, private terrain: Terrain) {}

  private collides(x: number, y: number, z: number, r: number, h: number): boolean {
    // Ramps never block: the ramp pass below lifts the character onto their surface instead.
    if (this.world.boxIntersectsSolid(x - r, y, z - r, x + r, y + h, z + r, true)) return true;
    return !!this.traps && this.traps.blocksBox(this.mover, x - r, y, z - r, x + r, y + h, z + r);
  }

  /** True when the entity's box fits at the given feet position. */
  fits(x: number, y: number, z: number, e: Entity): boolean {
    if (this.collides(x, y, z, e.radius, e.height)) return false;
    return y >= this.terrain.heightAt(x, z) - 0.02;
  }

  step(e: Entity, input: MoveInput, dt: number): void {
    if (!e.alive) return;
    const world = this.world;
    this.mover = e;
    e.wasGrounded = e.grounded;
    if (e.burrowed) {
      this.stepBurrowed(e, input, dt);
      return;
    }
    if (e.zipRide) {
      this.stepZip(e, input, dt);
      return;
    }

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

    // Swing grapple: a real rope. Gravity keeps acting, the rope only stops you moving away from the
    // anchor; holding the gadget reels you in and latches (hangs) near the anchor.
    if (e.grapplePoint) {
      e.grappleTime += dt;
      if (e.grappleTime > SWING.maxTime) {
        if (this.gadgets) this.gadgets.releaseGrapple(e);
        else e.grapplePoint = null;
      }
    }
    if (e.grapplePoint) {
      if (e.grappleLatched) {
        e.vel.set(0, 0, 0);
      } else {
        if (e.grappleReel && input.forward >= -0.2) e.ropeLength = Math.max(SWING.minLen, e.ropeLength - SWING.reel * dt);
        e.vel.y -= PHYS.gravity * dt;
        const fwd = e.forwardFlat(new THREE.Vector3());
        const right = e.right(new THREE.Vector3());
        e.vel.addScaledVector(fwd, input.forward * 5 * dt).addScaledVector(right, input.strafe * 5 * dt);
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
    if (e.overdrive) speed *= 1.25;
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
    if (e.grapplePoint && !e.grappleLatched) this.applyRope(e, dt);

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

  /** Rope constraint after integration: no outward radial motion beyond the rope length, reel pulls inward. */
  private applyRope(e: Entity, dt: number): void {
    const anchor = e.grapplePoint!;
    const chest = tmp.set(e.pos.x, e.pos.y + 1.4, e.pos.z);
    const n = chest.clone().sub(anchor);
    const dist = n.length();
    if (dist < 1e-4) return;
    n.divideScalar(dist);
    // Latch (hang) once reeled in, or when the rope is fully wound but geometry keeps us off the anchor.
    if (e.grappleReel && (dist <= SWING.latchDist || (e.ropeLength <= SWING.minLen + 0.01 && dist < 3.5 && e.vel.lengthSq() < 4))) {
      e.grappleLatched = true;
      e.vel.set(0, 0, 0);
      return;
    }
    if (dist > e.ropeLength) {
      const radial = e.vel.dot(n);
      if (radial > 0) e.vel.addScaledVector(n, -radial);
      const corr = e.ropeLength - dist;
      const nx = e.pos.x + n.x * corr;
      const ny = e.pos.y + n.y * corr;
      const nz = e.pos.z + n.z * corr;
      if (!this.collides(nx, ny, nz, e.radius, e.height)) e.pos.set(nx, ny, nz);
      else if (!this.collides(e.pos.x, ny, e.pos.z, e.radius, e.height)) e.pos.y = ny;
    }
    if (e.grappleReel) {
      const inward = -e.vel.dot(n);
      if (inward < SWING.reel) e.vel.addScaledVector(n, -(SWING.reel - inward) * Math.min(1, dt * 8));
    }
  }

  /** Underground: glide beneath the surface ignoring blocks; the drill system handles energy and surfacing. */
  private stepBurrowed(e: Entity, input: MoveInput, dt: number): void {
    const fwd = e.forwardFlat(new THREE.Vector3());
    const right = e.right(new THREE.Vector3());
    desired.set(0, 0, 0).addScaledVector(fwd, input.forward).addScaledVector(right, input.strafe);
    if (desired.lengthSq() > 1) desired.normalize();
    desired.multiplyScalar(BURROW.speed);
    e.vel.x = damp(e.vel.x, desired.x, 10, dt);
    e.vel.z = damp(e.vel.z, desired.z, 10, dt);
    e.vel.y = 0;
    e.pos.x += e.vel.x * dt;
    e.pos.z += e.vel.z * dt;
    const surface = this.gadgets ? this.gadgets.surfaceYAt(e.pos.x, e.pos.z) : this.terrain.heightAt(e.pos.x, e.pos.z);
    e.pos.y = surface - BURROW.depth;
    e.grounded = true;
    e.crouching = false;
    e.sliding = false;
    e.coyoteTimer = 0;
    e.jumpBuffered = false;
    const rr = Math.hypot(e.pos.x, e.pos.z);
    if (rr > PLAYABLE_RADIUS - 2) {
      const k = (PLAYABLE_RADIUS - 2) / rr;
      e.pos.x *= k;
      e.pos.z *= k;
    }
  }

  /** Riding a zipline: follow the cable, drop off when it ends, jump or when something is in the way. */
  private stepZip(e: Entity, input: MoveInput, dt: number): void {
    const g = this.gadgets;
    if (!g) {
      e.zipRide = null;
      return;
    }
    const next = g.zipStep(e, dt, input.jump);
    e.grounded = false;
    if (!next) return;
    const th = this.terrain.heightAt(next.pos.x, next.pos.z);
    if (next.pos.y < th - 0.2 || this.collides(next.pos.x, next.pos.y + 0.1, next.pos.z, e.radius * 0.85, e.height * 0.85)) {
      g.detachZip(e, false);
      return;
    }
    e.vel.copy(next.pos).sub(e.pos).divideScalar(Math.max(dt, 1e-4));
    e.pos.copy(next.pos);
    e.crouching = false;
    e.sliding = false;
    if (next.end) g.detachZip(e, true);
  }

  /**
   * Walking into a step no taller than a metre (stair halves, slabs, single blocks) lifts the
   * character onto it, every frame and without a jump, so flights of stairs are climbed by simply
   * walking. The lift is recorded so the camera can smooth it out.
   */
  private stepUp(e: Entity): boolean {
    if (!(e.grounded || e.wasGrounded) || e.sliding) return false;
    const p = e.pos;
    // Crouched characters still take half steps (stair treads), not whole blocks.
    for (const rise of e.crouching ? [0.5] : [0.5, 1.0]) {
      const ny = p.y + rise + 0.002;
      if (this.collides(p.x, ny, p.z, e.radius, e.height)) continue;
      // Something to stand on at the new height (not a hole behind a lip).
      if (!this.collides(p.x, ny - 0.06, p.z, e.radius * 0.98, 0.05)) continue;
      e.stepSmooth += rise;
      p.y = ny;
      e.grounded = true;
      return true;
    }
    return false;
  }

  /** Moves along one axis and resolves voxel collisions. Returns true if blocked. */
  private moveAxis(e: Entity, axis: 0 | 1 | 2, delta: number): boolean {
    if (delta === 0) return false;
    const p = e.pos;
    const r = e.radius;
    const h = e.height;
    if (axis === 0) p.x += delta;
    else if (axis === 1) p.y += delta;
    else p.z += delta;
    if (!this.collides(p.x, p.y, p.z, r, h)) return false;
    if (axis !== 1 && this.stepUp(e)) return false;
    // Fast enough and it is only glass: crash through it.
    if (axis !== 1 && this.breakGlass && Math.hypot(e.vel.x, e.vel.z) > 5.5) {
      const sign = delta > 0 ? 1 : -1;
      let broke = false;
      const cols: [number, number][] = axis === 0 ? [[Math.floor(p.x + sign * (r + 0.02)), Math.floor(p.z - r + 0.02)], [Math.floor(p.x + sign * (r + 0.02)), Math.floor(p.z + r - 0.02)]] : [[Math.floor(p.x - r + 0.02), Math.floor(p.z + sign * (r + 0.02))], [Math.floor(p.x + r - 0.02), Math.floor(p.z + sign * (r + 0.02))]];
      // Every block row the body spans (feet may stand below a pane's bottom edge on terrain).
      for (const [bx, bz] of cols) for (let by = Math.floor(p.y + 0.001); by <= Math.floor(p.y + h - 0.001); by++) if (this.breakGlass(bx, by, bz)) broke = true;
      if (broke && !this.collides(p.x, p.y, p.z, r, h)) return false;
    }
    this.resolveAxis(e, axis, delta);
    if (axis === 0) e.vel.x = 0;
    else if (axis === 2) e.vel.z = 0;
    else {
      if (delta < 0) {
        if (e.vel.y < -12) e.landImpact = Math.min(1, -e.vel.y / 40);
        e.grounded = true;
      }
      e.vel.y = 0;
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

  /**
   * Pushes the character back along the axis it just moved on until it no longer overlaps a block.
   * The contact is found by bisecting between the free start and the blocked end of the move, so
   * shaped blocks (stair halves, slabs, top slabs) resolve to their real faces instead of snapping
   * to whole-metre voxel boundaries, which used to leave characters floating above stair treads.
   */
  private resolveAxis(e: Entity, axis: 0 | 1 | 2, delta: number): void {
    const p = e.pos;
    const r = e.radius;
    const h = e.height;
    const eps = 0.001;
    const end = axis === 0 ? p.x : axis === 1 ? p.y : p.z;
    const start = end - delta;
    const set = (v: number) => {
      if (axis === 0) p.x = v;
      else if (axis === 1) p.y = v;
      else p.z = v;
    };
    set(start);
    if (this.collides(p.x, p.y, p.z, r, h)) {
      // Already overlapping before the move (block placed on us, spawn inside geometry): fall back
      // to the voxel boundary in the direction we came from.
      if (axis === 0) p.x = delta > 0 ? Math.floor(end + r) - r - eps : Math.ceil(end - r) + r + eps;
      else if (axis === 1) p.y = delta > 0 ? Math.floor(end + h) - h - eps : Math.ceil(end) + eps;
      else p.z = delta > 0 ? Math.floor(end + r) - r - eps : Math.ceil(end - r) + r + eps;
      return;
    }
    let lo = start;
    let hi = end;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) * 0.5;
      set(mid);
      if (this.collides(p.x, p.y, p.z, r, h)) hi = mid;
      else lo = mid;
    }
    set(lo);
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
