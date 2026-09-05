import * as THREE from 'three';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Terrain } from '../world/Terrain';
import type { Combat } from './Combat';
import type { Entity } from './Entities';
import { PLOT_Y, PLOT_MAX_HEIGHT, PLAYABLE_RADIUS, type Plot } from '../world/Layout';
import { Emitter } from '../core/Events';
import type { Cell } from '../world/Reachability';

/**
 * Gadget kit: every player picks two before a round. Ziplines and jump pads are deployables anyone
 * can use, breach charges blow holes in fortress blocks, the grapple swings on a real rope, and the
 * burrow drill tunnels under the ground and through walls.
 */
export type GadgetId = 'zipline' | 'jumppad' | 'breach' | 'grapple' | 'burrow';
export const GADGET_IDS: GadgetId[] = ['zipline', 'jumppad', 'breach', 'grapple', 'burrow'];
export const KIT_SIZE = 2;

export interface GadgetDef {
  id: GadgetId;
  nameKey: string;
  descKey: string;
  /** Uses per round (Infinity = cooldown/energy based). */
  charges: number;
  cooldown: number;
  icon: string;
}

const svg = (body: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
export const GADGET_ICONS: Record<GadgetId, string> = {
  zipline: svg('<path d="M2 6l20 8"/><circle cx="4" cy="5" r="2"/><circle cx="20" cy="15" r="2"/><path d="M11 9.5v4M9 13.5h4"/>'),
  jumppad: svg('<ellipse cx="12" cy="18" rx="8" ry="3"/><path d="M12 15V5"/><path d="M8 9l4-4 4 4"/>'),
  breach: svg('<rect x="6" y="9" width="12" height="10" rx="2"/><path d="M12 9V5"/><path d="M12 5l3-2"/><path d="M4 22l2-2M20 22l-2-2"/><circle cx="12" cy="14" r="1.6" fill="currentColor" stroke="none"/>'),
  grapple: svg('<path d="M12 2v9"/><path d="M12 11c0 4.5-3.2 6.5-6 6.5M12 11c0 4.5 3.2 6.5 6 6.5"/><path d="M6 17.5L4 21M18 17.5L20 21"/><circle cx="12" cy="4.5" r="2"/>'),
  burrow: svg('<path d="M3 20h18"/><path d="M6 20c0-5 3-9 6-9s6 4 6 9"/><path d="M12 11V4"/><path d="M9 7l3-3 3 3"/><path d="M8 20c1-3 2.5-4.5 4-4.5s3 1.5 4 4.5"/>'),
};

export const GADGETS: Record<GadgetId, GadgetDef> = {
  zipline: { id: 'zipline', nameKey: 'gZipline', descKey: 'gZiplineDesc', charges: 3, cooldown: 1.2, icon: GADGET_ICONS.zipline },
  jumppad: { id: 'jumppad', nameKey: 'gJumppad', descKey: 'gJumppadDesc', charges: 2, cooldown: 1.0, icon: GADGET_ICONS.jumppad },
  breach: { id: 'breach', nameKey: 'gBreach', descKey: 'gBreachDesc', charges: 2, cooldown: 1.2, icon: GADGET_ICONS.breach },
  grapple: { id: 'grapple', nameKey: 'gGrapple', descKey: 'gGrappleDesc', charges: Infinity, cooldown: 2.2, icon: GADGET_ICONS.grapple },
  burrow: { id: 'burrow', nameKey: 'gBurrow', descKey: 'gBurrowDesc', charges: Infinity, cooldown: 0.4, icon: GADGET_ICONS.burrow },
};

export const ZIP = { range: 60, minLen: 5, speed: 13, accel: 26, hang: 1.85, attachDist: 1.8, max: 6 };
export const PAD = { range: 8, launch: 17.5, radius: 1.15, boost: 1.25, reuse: 0.6 };
export const BREACH = { speed: 16, gravity: 20, fuse: 1.5, radius: 1.8, blastRadius: 3.4, damage: 70 };
export const SWING = { range: 40, reel: 9, minLen: 1.2, latchDist: 1.35, maxTime: 8, cooldown: 2.2, kick: 12 };
export const BURROW = { depth: 2.4, speed: 4.6, drain: 8, regen: 7, digCost: 12, digTime: 0.55, digRange: 2.8, surfaceCostPerBlock: 15, moundEvery: 0.16 };

export interface Zipline {
  id: number;
  a: THREE.Vector3;
  b: THREE.Vector3;
  owner: number;
}
export interface JumpPad {
  id: number;
  pos: THREE.Vector3;
  owner: number;
  lastUse: Map<number, number>;
  pulse: number;
}
export interface BreachCharge {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  normal: THREE.Vector3;
  stuck: boolean;
  fuse: number;
  owner: number;
}

export interface GadgetEvents extends Record<string, unknown> {
  zipline: { line: Zipline; entity: Entity };
  zipRide: { entity: Entity; start: boolean };
  jumppad: { pad: JumpPad };
  launch: { entity: Entity; pad: JumpPad };
  breachThrow: { entity: Entity };
  breachStick: { charge: BreachCharge };
  breachBlast: { pos: THREE.Vector3; cells: number };
  grapple: { entity: Entity; point: THREE.Vector3 | null };
  burrow: { entity: Entity; down: boolean; pos: THREE.Vector3 };
  dig: { pos: THREE.Vector3; entity: Entity };
  mound: { pos: THREE.Vector3 };
  deny: { entity: Entity; key: string };
  blocksChanged: { plotIndex: number };
}

let nextId = 1;
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

export class GadgetSystem {
  readonly events = new Emitter<GadgetEvents>();
  readonly ziplines: Zipline[] = [];
  readonly pads: JumpPad[] = [];
  readonly charges: BreachCharge[] = [];

  constructor(
    private world: VoxelWorld,
    private terrain: Terrain,
    private combat: Combat,
    private plots: Plot[],
    private entities: () => Entity[],
  ) {}

  /** Clears deployables between rounds. */
  reset(): void {
    this.ziplines.length = 0;
    this.pads.length = 0;
    this.charges.length = 0;
  }

  private plotAt(x: number, z: number): number {
    for (let i = 0; i < this.plots.length; i++) {
      const p = this.plots[i];
      if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) return i;
    }
    return -1;
  }

  /** Removes a fortress block (never the painted ground or anything outside plots). */
  private breakBlock(x: number, y: number, z: number): boolean {
    if (y < PLOT_Y || y >= PLOT_Y + PLOT_MAX_HEIGHT) return false;
    const pi = this.plotAt(x, z);
    if (pi < 0) return false;
    if (this.world.get(x, y, z) === 0) return false;
    this.world.set(x, y, z, 0);
    this.touched.add(pi);
    return true;
  }
  private touched = new Set<number>();
  private flushTouched(): void {
    for (const pi of this.touched) this.events.emit('blocksChanged', { plotIndex: pi });
    this.touched.clear();
  }

  private slotOf(e: Entity, id: GadgetId): number {
    return e.gadgets.indexOf(id);
  }

  private spend(e: Entity, slot: number): boolean {
    const def = GADGETS[e.gadgets[slot]];
    if (e.gadgetCooldown[slot] > 0) return false;
    if (def.charges !== Infinity) {
      if (e.gadgetCharges[slot] <= 0) {
        this.events.emit('deny', { entity: e, key: 'noCharges' });
        return false;
      }
      e.gadgetCharges[slot]--;
    }
    e.gadgetCooldown[slot] = def.cooldown;
    return true;
  }

  /** Per-frame input for one kit slot of a controllable entity. */
  input(e: Entity, slot: number, pressed: boolean, held: boolean, released: boolean, now: number): void {
    const id = e.gadgets[slot];
    if (!id || !e.alive) return;
    switch (id) {
      case 'zipline':
        if (pressed) this.useZipline(e, slot);
        break;
      case 'jumppad':
        if (pressed) this.placePad(e, slot);
        break;
      case 'breach':
        if (pressed) this.throwBreach(e, slot);
        break;
      case 'grapple':
        if (pressed && !e.grapplePoint) this.fireGrapple(e, slot);
        else if (released && e.grapplePoint) this.releaseGrapple(e);
        e.grappleReel = held && !!e.grapplePoint;
        break;
      case 'burrow':
        this.burrowInput(e, slot, pressed, held, now);
        break;
    }
  }

  // ---------------------------------------------------------------- zipline
  private nearestZip(e: Entity): { line: Zipline; t: number } | null {
    const p = tmpA.set(e.pos.x, e.pos.y + 1.4, e.pos.z);
    let best: { line: Zipline; t: number } | null = null;
    let bestD = ZIP.attachDist;
    for (const line of this.ziplines) {
      const ab = tmpB.copy(line.b).sub(line.a);
      const len2 = ab.lengthSq();
      const t = Math.max(0, Math.min(1, p.clone().sub(line.a).dot(ab) / len2));
      const q = line.a.clone().addScaledVector(ab, t);
      const d = q.distanceTo(p);
      if (d < bestD) {
        bestD = d;
        best = { line, t };
      }
    }
    return best;
  }

  private useZipline(e: Entity, slot: number): void {
    if (e.zipRide) {
      this.detachZip(e, false);
      return;
    }
    // Near an existing line: ride it towards where you look.
    const near = this.nearestZip(e);
    if (near) {
      const fwd = e.forward(new THREE.Vector3());
      const dir = near.line.b.clone().sub(near.line.a).normalize().dot(fwd) >= 0 ? 1 : -1;
      e.zipRide = { id: near.line.id, t: near.t, dir, speed: 2 };
      e.grapplePoint = null;
      e.sliding = false;
      this.events.emit('zipRide', { entity: e, start: true });
      return;
    }
    if (e.gadgetCooldown[slot] > 0) return;
    if (GADGETS.zipline.charges !== Infinity && e.gadgetCharges[slot] <= 0) {
      this.events.emit('deny', { entity: e, key: 'noCharges' });
      return;
    }
    const origin = e.eyePos;
    const dir = e.forward(new THREE.Vector3());
    const hit = this.combat.raycast(origin, dir, ZIP.range, e, false);
    if (!hit) {
      this.events.emit('deny', { entity: e, key: 'zipNoAnchor' });
      return;
    }
    let b = hit.point.clone().addScaledVector(hit.normal, 0.25);
    const a = new THREE.Vector3(e.pos.x, e.pos.y + 2.3, e.pos.z);
    // The cable must be clear: if it would pass through a wall, anchor on that wall instead.
    const span = b.clone().sub(a);
    const spanLen = span.length();
    const block = this.combat.raycast(a, span.clone().divideScalar(spanLen), spanLen - 0.3, e, false);
    if (block) b = block.point.clone().addScaledVector(block.normal, 0.25);
    if (a.distanceTo(b) < ZIP.minLen) {
      this.events.emit('deny', { entity: e, key: 'zipTooShort' });
      return;
    }
    if (!this.spend(e, slot)) return;
    const line: Zipline = { id: nextId++, a, b, owner: e.id };
    this.ziplines.push(line);
    while (this.ziplines.length > ZIP.max) this.ziplines.shift();
    e.zipRide = { id: line.id, t: 0, dir: 1, speed: 3 };
    e.grapplePoint = null;
    e.sliding = false;
    e.vel.set(0, 0, 0);
    this.events.emit('zipline', { line, entity: e });
    this.events.emit('zipRide', { entity: e, start: true });
  }

  detachZip(e: Entity, atEnd: boolean): void {
    const ride = e.zipRide;
    if (!ride) return;
    const line = this.ziplines.find((l) => l.id === ride.id);
    e.zipRide = null;
    if (line) {
      const dir = line.b.clone().sub(line.a).normalize().multiplyScalar(ride.dir);
      const v = Math.max(4, ride.speed * (atEnd ? 0.55 : 0.8));
      e.vel.set(dir.x * v, Math.max(dir.y * v, 0) + 3.5, dir.z * v);
    } else e.vel.y = Math.max(e.vel.y, 3);
    e.grounded = false;
    this.events.emit('zipRide', { entity: e, start: false });
  }

  /** Advances a rider along its line; returns the new feet position (and whether the cable ended) or null once detached. */
  zipStep(e: Entity, dt: number, jump: boolean): { pos: THREE.Vector3; end: boolean } | null {
    const ride = e.zipRide;
    if (!ride) return null;
    const line = this.ziplines.find((l) => l.id === ride.id);
    if (!line || jump) {
      this.detachZip(e, false);
      return null;
    }
    const len = line.a.distanceTo(line.b);
    ride.speed = Math.min(ZIP.speed, ride.speed + ZIP.accel * dt);
    ride.t += (ride.dir * ride.speed * dt) / len;
    const end = ride.t <= 0 || ride.t >= 1;
    ride.t = Math.max(0, Math.min(1, ride.t));
    const p = line.a.clone().lerp(line.b, ride.t);
    return { pos: p.setY(p.y - ZIP.hang), end };
  }

  // ---------------------------------------------------------------- jump pad
  private placePad(e: Entity, slot: number): void {
    if (e.gadgetCooldown[slot] > 0) return;
    const origin = e.eyePos;
    const dir = e.forward(new THREE.Vector3());
    let hit = this.combat.raycast(origin, dir, PAD.range, e, false);
    if (!hit || hit.normal.y < 0.6) {
      // Fall back to the ground at the player's feet when aiming at nothing useful.
      const down = new THREE.Vector3(0, -1, 0);
      const feet = new THREE.Vector3(e.pos.x, e.pos.y + 0.5, e.pos.z).addScaledVector(e.forwardFlat(new THREE.Vector3()), 1.4);
      hit = this.combat.raycast(feet, down, 3, e, false);
      if (!hit || hit.normal.y < 0.6) {
        this.events.emit('deny', { entity: e, key: 'padNoGround' });
        return;
      }
    }
    if (!this.spend(e, slot)) return;
    const pad: JumpPad = { id: nextId++, pos: hit.point.clone().addScaledVector(hit.normal, 0.02), owner: e.id, lastUse: new Map(), pulse: 0 };
    this.pads.push(pad);
    while (this.pads.length > 8) this.pads.shift();
    this.events.emit('jumppad', { pad });
  }

  private updatePads(dt: number, now: number): void {
    for (const pad of this.pads) {
      pad.pulse += dt;
      for (const e of this.entities()) {
        if (!e.alive || e.burrowed || e.zipRide) continue;
        const dx = e.pos.x - pad.pos.x;
        const dz = e.pos.z - pad.pos.z;
        if (dx * dx + dz * dz > PAD.radius * PAD.radius) continue;
        if (e.pos.y < pad.pos.y - 0.35 || e.pos.y > pad.pos.y + 0.8) continue;
        if (now - (pad.lastUse.get(e.id) ?? -10) < PAD.reuse) continue;
        pad.lastUse.set(e.id, now);
        pad.pulse = 0;
        e.vel.y = PAD.launch;
        e.vel.x *= PAD.boost;
        e.vel.z *= PAD.boost;
        e.grounded = false;
        e.crouching = false;
        e.sliding = false;
        e.grapplePoint = null;
        this.events.emit('launch', { entity: e, pad });
      }
    }
  }

  // ---------------------------------------------------------------- breach charge
  private throwBreach(e: Entity, slot: number): void {
    if (!this.spend(e, slot)) return;
    const origin = e.eyePos;
    const dir = e.forward(new THREE.Vector3());
    const c: BreachCharge = { id: nextId++, pos: origin.clone().addScaledVector(dir, 0.6), vel: dir.clone().multiplyScalar(BREACH.speed).add(new THREE.Vector3(0, 1.5, 0)).addScaledVector(e.vel, 0.5), normal: new THREE.Vector3(0, 1, 0), stuck: false, fuse: BREACH.fuse, owner: e.id };
    this.charges.push(c);
    this.events.emit('breachThrow', { entity: e });
  }

  private updateCharges(dt: number, now: number): void {
    for (let i = this.charges.length - 1; i >= 0; i--) {
      const c = this.charges[i];
      if (!c.stuck) {
        c.vel.y -= BREACH.gravity * dt;
        const prev = c.pos.clone();
        c.pos.addScaledVector(c.vel, dt);
        const seg = c.pos.clone().sub(prev);
        const len = seg.length();
        if (len > 1e-6) {
          const hit = this.combat.raycast(prev, seg.divideScalar(len), len + 0.12, null, false);
          if (hit) {
            c.pos.copy(hit.point).addScaledVector(hit.normal, 0.08);
            c.normal.copy(hit.normal);
            c.stuck = true;
            c.vel.set(0, 0, 0);
            this.events.emit('breachStick', { charge: c });
          }
        }
        const th = this.terrain.heightAt(c.pos.x, c.pos.z);
        if (c.pos.y < th + 0.05) {
          c.pos.y = th + 0.05;
          c.normal.set(0, 1, 0);
          c.stuck = true;
          c.vel.set(0, 0, 0);
          this.events.emit('breachStick', { charge: c });
        }
        continue;
      }
      c.fuse -= dt;
      if (c.fuse > 0) continue;
      // Blast: carve fortress blocks around the impact point and hurt anyone nearby.
      const centre = c.pos.clone().addScaledVector(c.normal, -0.45);
      let cells = 0;
      const r = BREACH.radius;
      for (let x = Math.floor(centre.x - r); x <= Math.floor(centre.x + r); x++)
        for (let y = Math.floor(centre.y - r); y <= Math.floor(centre.y + r); y++)
          for (let z = Math.floor(centre.z - r); z <= Math.floor(centre.z + r); z++) {
            const d = Math.hypot(x + 0.5 - centre.x, y + 0.5 - centre.y, z + 0.5 - centre.z);
            if (d > r) continue;
            if (this.breakBlock(x, y, z)) cells++;
          }
      const owner = this.entities().find((e) => e.id === c.owner) ?? null;
      this.combat.explode(c.pos.clone().addScaledVector(c.normal, 0.3), BREACH.blastRadius, BREACH.damage, owner, now);
      this.events.emit('breachBlast', { pos: c.pos.clone(), cells });
      this.charges.splice(i, 1);
    }
    this.flushTouched();
  }

  // ---------------------------------------------------------------- swing grapple
  private fireGrapple(e: Entity, slot: number): void {
    if (e.gadgetCooldown[slot] > 0) return;
    const origin = e.eyePos;
    const dir = e.forward(new THREE.Vector3());
    const hit = this.combat.raycast(origin, dir, SWING.range, e, false);
    if (!hit) {
      e.gadgetCooldown[slot] = 0.35;
      this.events.emit('grapple', { entity: e, point: null });
      return;
    }
    e.grapplePoint = hit.point.clone().addScaledVector(hit.normal, 0.05);
    e.grappleTime = 0;
    e.ropeLength = Math.max(SWING.minLen, e.grapplePoint.distanceTo(new THREE.Vector3(e.pos.x, e.pos.y + 1.4, e.pos.z)));
    e.grappleLatched = false;
    e.sliding = false;
    e.zipRide = null;
    this.events.emit('grapple', { entity: e, point: e.grapplePoint });
  }

  releaseGrapple(e: Entity): void {
    if (!e.grapplePoint) return;
    const latched = e.grappleLatched;
    e.grapplePoint = null;
    e.grappleLatched = false;
    e.grappleReel = false;
    const slot = this.slotOf(e, 'grapple');
    if (slot >= 0) e.gadgetCooldown[slot] = SWING.cooldown;
    if (latched) {
      // Kick off the wall: up and slightly forward so you can mantle the ledge.
      e.vel.y = Math.max(e.vel.y, SWING.kick);
      const fwd = e.forwardFlat(new THREE.Vector3());
      e.vel.addScaledVector(fwd, 2.5);
    } else e.vel.y = Math.max(e.vel.y, 3);
  }

  // ---------------------------------------------------------------- burrow
  private burrowInput(e: Entity, slot: number, pressed: boolean, held: boolean, now: number): void {
    void now;
    if (e.burrowed) {
      if (pressed) this.surface(e, slot);
      return;
    }
    // Aiming at a nearby fortress block while holding drills through it.
    const origin = e.eyePos;
    const dir = e.forward(new THREE.Vector3());
    const hit = held ? this.combat.raycast(origin, dir, BURROW.digRange, e, false) : null;
    const cell: Cell | null = hit && hit.blockValue !== 0 ? { x: Math.floor(hit.point.x - hit.normal.x * 0.5), y: Math.floor(hit.point.y - hit.normal.y * 0.5), z: Math.floor(hit.point.z - hit.normal.z * 0.5) } : null;
    if (held && cell && cell.y >= PLOT_Y && this.plotAt(cell.x, cell.z) >= 0 && (e.pitch > -0.55 || !e.grounded)) {
      if (!e.digTarget || e.digTarget.x !== cell.x || e.digTarget.y !== cell.y || e.digTarget.z !== cell.z) {
        e.digTarget = cell;
        e.digProgress = 0;
      }
      if (e.burrowEnergy < BURROW.digCost) {
        this.events.emit('deny', { entity: e, key: 'noEnergy' });
        return;
      }
      e.digProgress += 1 / BURROW.digTime;
      return;
    }
    if (!held) {
      e.digTarget = null;
      e.digProgress = 0;
    }
    if (pressed && e.grounded && e.gadgetCooldown[slot] <= 0) this.burrowDown(e, slot);
  }

  private burrowDown(e: Entity, slot: number): void {
    if (e.burrowEnergy < 20) {
      this.events.emit('deny', { entity: e, key: 'noEnergy' });
      return;
    }
    // Standing on fortress blocks: dig through the floor first (up to two blocks).
    const cx = Math.floor(e.pos.x);
    const cz = Math.floor(e.pos.z);
    let y = Math.floor(e.pos.y - 0.05);
    let dug = 0;
    while (y >= PLOT_Y && this.world.get(cx, y, cz) !== 0 && dug < 3) {
      if (!this.breakBlock(cx, y, cz)) break;
      dug++;
      y--;
    }
    if (dug) {
      e.burrowEnergy -= dug * BURROW.digCost;
      this.flushTouched();
    }
    e.burrowed = true;
    e.burrowSurfaceY = e.pos.y;
    e.pos.y = this.terrain.heightAt(e.pos.x, e.pos.z) - BURROW.depth;
    e.vel.set(0, 0, 0);
    e.grapplePoint = null;
    e.zipRide = null;
    e.crouching = false;
    e.sliding = false;
    e.gadgetCooldown[slot] = GADGETS.burrow.cooldown;
    this.events.emit('burrow', { entity: e, down: true, pos: new THREE.Vector3(e.pos.x, e.burrowSurfaceY, e.pos.z) });
  }

  /** Surface height at a point: fortress ground level inside plots, terrain elsewhere. */
  surfaceYAt(x: number, z: number): number {
    const pi = this.plotAt(Math.floor(x), Math.floor(z));
    const th = this.terrain.heightAt(x, z);
    return pi >= 0 ? Math.max(th, PLOT_Y) : th;
  }

  private surface(e: Entity, slot: number): void {
    const cx = Math.floor(e.pos.x);
    const cz = Math.floor(e.pos.z);
    const top = this.surfaceYAt(e.pos.x, e.pos.z);
    const y0 = Math.floor(top + 0.01);
    // Blocks in the way of standing up get drilled (energy permitting).
    const blocking: Cell[] = [];
    for (let y = y0; y < y0 + 2; y++) if (this.world.get(cx, y, cz) !== 0) blocking.push({ x: cx, y, z: cz });
    // Solid roof right above the two-cell column also counts when it is a fortress floor we must open.
    const cost = blocking.length * BURROW.surfaceCostPerBlock;
    if (blocking.length && e.burrowEnergy < cost) {
      this.events.emit('deny', { entity: e, key: 'noEnergy' });
      return;
    }
    for (const b of blocking) {
      if (!this.breakBlock(b.x, b.y, b.z)) {
        this.events.emit('deny', { entity: e, key: 'cannotSurface' });
        return;
      }
    }
    if (blocking.length) {
      e.burrowEnergy -= cost;
      this.flushTouched();
    }
    e.burrowed = false;
    e.pos.y = Math.max(top, y0) + 0.02;
    e.vel.set(0, 4.5, 0);
    e.grounded = false;
    e.gadgetCooldown[slot] = GADGETS.burrow.cooldown;
    this.events.emit('burrow', { entity: e, down: false, pos: new THREE.Vector3(e.pos.x, e.pos.y, e.pos.z) });
  }

  /** Forces a burrowed entity back up (energy out, death, round end). */
  forceSurface(e: Entity): void {
    if (!e.burrowed) return;
    const slot = this.slotOf(e, 'burrow');
    this.surface(e, Math.max(0, slot));
    if (e.burrowed) {
      // Could not drill out: pop up where possible anyway.
      e.burrowed = false;
      e.pos.y = this.surfaceYAt(e.pos.x, e.pos.z) + 0.02;
    }
  }

  private updateBurrow(dt: number): void {
    for (const e of this.entities()) {
      if (!e.alive) {
        if (e.burrowed) {
          e.burrowed = false;
          e.pos.y = this.surfaceYAt(e.pos.x, e.pos.z);
        }
        continue;
      }
      if (e.burrowed) {
        e.burrowEnergy -= BURROW.drain * dt;
        e.moundTimer -= dt;
        const moving = e.vel.x * e.vel.x + e.vel.z * e.vel.z > 0.5;
        if (e.moundTimer <= 0 && moving) {
          e.moundTimer = BURROW.moundEvery;
          this.events.emit('mound', { pos: new THREE.Vector3(e.pos.x, this.surfaceYAt(e.pos.x, e.pos.z) + 0.05, e.pos.z) });
        }
        if (e.burrowEnergy <= 0) {
          e.burrowEnergy = 0;
          this.forceSurface(e);
        }
      } else {
        e.burrowEnergy = Math.min(100, e.burrowEnergy + BURROW.regen * dt);
        // Drilling progress completes a block.
        if (e.digTarget && e.digProgress >= 1) {
          const c = e.digTarget;
          if (this.breakBlock(c.x, c.y, c.z)) {
            e.burrowEnergy = Math.max(0, e.burrowEnergy - BURROW.digCost);
            this.events.emit('dig', { pos: new THREE.Vector3(c.x + 0.5, c.y + 0.5, c.z + 0.5), entity: e });
          }
          e.digTarget = null;
          e.digProgress = 0;
          this.flushTouched();
        }
      }
    }
  }

  update(dt: number, now: number): void {
    for (const e of this.entities()) for (let i = 0; i < e.gadgetCooldown.length; i++) if (e.gadgetCooldown[i] > 0) e.gadgetCooldown[i] = Math.max(0, e.gadgetCooldown[i] - dt);
    this.updatePads(dt, now);
    this.updateCharges(dt, now);
    this.updateBurrow(dt);
  }

  /** Keeps burrowed entities inside the island (called by the controller). */
  clampIsland(e: Entity): void {
    const rr = Math.hypot(e.pos.x, e.pos.z);
    if (rr > PLAYABLE_RADIUS - 2) {
      const k = (PLAYABLE_RADIUS - 2) / rr;
      e.pos.x *= k;
      e.pos.z *= k;
    }
  }
}
