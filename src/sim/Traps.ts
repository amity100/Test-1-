import * as THREE from 'three';
import { Emitter } from '../core/Events';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Entity } from './Entities';
import type { Combat, Solid } from './Combat';
import type { Cell } from '../world/Reachability';
import type { Plot } from '../world/Layout';
import { PLOT_Y } from '../world/Layout';

/**
 * Defender traps, set during the build phase and armed every round: spikes and trapdoors hide in
 * the floor until someone steps on them, mines wait by doorways, turrets guard a room, gates bar a
 * doorway for everyone but the builder until they are shot open. Attackers see only what has already
 * fired (turrets and gates are plain to see); the builder sees everything. Traps never hurt their
 * owner and their kills count for the defender.
 */
export type TrapKind = 'spikes' | 'trapdoor' | 'mine' | 'turret' | 'gate';
export const TRAP_KINDS: TrapKind[] = ['spikes', 'trapdoor', 'mine', 'turret', 'gate'];
export const TRAP_SLOTS = 5;
export const TRAP_COST: Record<TrapKind, number> = { spikes: 1, trapdoor: 1, mine: 1, turret: 2, gate: 1 };
export const TRAP = {
  spikeDamage: 40,
  spikeRearm: 4,
  trapdoorDamage: 15,
  trapdoorOpen: 3.5,
  mineRadius: 1.0,
  mineBlast: 3.6,
  mineDamage: 75,
  turretRange: 16,
  turretDamage: 8,
  turretInterval: 0.42,
  turretHp: 90,
  turretTurn: 4.5,
  gateHp: 140,
};

export interface Trap {
  id: number;
  kind: TrapKind;
  plotIndex: number;
  /** Anchor feet cell (air over a floor block). */
  cell: Cell;
  /** Every feet cell the trap covers: one, a trapdoor's 2x2, or a gate's whole doorway span. */
  cells: Cell[];
  /** Gate: 0 = the wall runs along x (bars across x, passage along z), 2 = the wall runs along z. */
  axis: 0 | 2;
  state: 'armed' | 'triggered' | 'dead';
  timer: number;
  hp: number;
  /** Seen by everyone. Spikes, trapdoors and mines are hidden from attackers until they fire. */
  revealed: boolean;
  /** Turret aim (radians) and fire timer. */
  yaw: number;
  pitch: number;
  fireTimer: number;
  /** Trapdoor: floor blocks removed while open. */
  saved: { x: number; y: number; z: number; v: number }[];
}

export type TrapReason = 'trapNoSlots' | 'trapNeedsFloor' | 'trapNeedsUpper' | 'gateNeedsDoorway' | 'trapTaken';

export interface TrapEvents extends Record<string, unknown> {
  /** A hidden trap fired on somebody. */
  trigger: { trap: Trap; entity: Entity };
  turretShot: { trap: Trap; from: THREE.Vector3; to: THREE.Vector3; hit: boolean };
  destroyed: { trap: Trap; by: Entity | null };
  change: Record<string, never>;
}

let nextId = 1;
const tmp = new THREE.Vector3();

export class TrapSystem {
  readonly events = new Emitter<TrapEvents>();
  readonly traps: Trap[] = [];

  constructor(
    private world: VoxelWorld,
    private combat: Combat,
    private entities: () => Entity[],
    private plots: Plot[],
  ) {}

  // ------------------------------------------------------------------ placement
  slotsUsed(plotIndex: number): number {
    let n = 0;
    for (const t of this.traps) if (t.plotIndex === plotIndex) n += TRAP_COST[t.kind];
    return n;
  }

  at(cell: Cell): Trap | null {
    for (const t of this.traps) for (const c of t.cells) if (c.x === cell.x && c.y === cell.y && c.z === cell.z) return t;
    return null;
  }

  private freeFloor(x: number, y: number, z: number): boolean {
    return this.world.get(x, y, z) === 0 && this.world.get(x, y + 1, z) === 0 && this.world.get(x, y - 1, z) !== 0;
  }

  private plotAt(x: number, z: number): number {
    for (const p of this.plots) if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) return p.index;
    return -1;
  }

  /** Why a trap cannot go on this cell, or null when it can. */
  canPlace(kind: TrapKind, cell: Cell, plotIndex: number): TrapReason | null {
    if (this.slotsUsed(plotIndex) + TRAP_COST[kind] > TRAP_SLOTS) return 'trapNoSlots';
    if (this.plotAt(cell.x, cell.z) !== plotIndex || cell.y <= PLOT_Y) return 'trapNeedsFloor';
    const w = kind === 'trapdoor' ? 2 : 1;
    for (let dx = 0; dx < w; dx++)
      for (let dz = 0; dz < w; dz++) {
        if (!this.freeFloor(cell.x + dx, cell.y, cell.z + dz)) return 'trapNeedsFloor';
        if (this.at({ x: cell.x + dx, y: cell.y, z: cell.z + dz })) return 'trapTaken';
        if (kind === 'trapdoor' && (cell.y < PLOT_Y + 5 || this.world.get(cell.x + dx, cell.y - 2, cell.z + dz) !== 0)) return 'trapNeedsUpper';
      }
    if (kind === 'gate') {
      const d = this.doorway(cell);
      if (!d) return 'gateNeedsDoorway';
      for (const c of d.cells) if (this.at(c)) return 'trapTaken';
    }
    return null;
  }

  /**
   * A doorway: the opening in a wall line that this cell is part of. Walking along the wall in both
   * directions must reach wall within a few cells, and every opening cell must be open on both
   * passage sides. Returns the wall's axis and all the opening's feet cells (a gate spans them all).
   */
  private doorway(c: Cell): { axis: 0 | 2; cells: Cell[] } | null {
    const solid = (x: number, y: number, z: number): boolean => this.world.get(x, y, z) !== 0;
    const wallAt = (x: number, z: number): boolean => solid(x, c.y, z) && solid(x, c.y + 1, z);
    const open = (x: number, z: number): boolean => !solid(x, c.y, z) && !solid(x, c.y + 1, z);
    for (const axis of [0, 2] as const) {
      const ax = axis === 0 ? 1 : 0;
      const az = axis === 0 ? 0 : 1;
      let lo = 0;
      while (lo < 6 && open(c.x - ax * (lo + 1), c.z - az * (lo + 1))) lo++;
      let hi = 0;
      while (hi < 6 && open(c.x + ax * (hi + 1), c.z + az * (hi + 1))) hi++;
      if (lo >= 6 || hi >= 6) continue;
      if (!wallAt(c.x - ax * (lo + 1), c.z - az * (lo + 1)) || !wallAt(c.x + ax * (hi + 1), c.z + az * (hi + 1))) continue;
      const cells: Cell[] = [];
      let ok = true;
      for (let k = -lo; k <= hi; k++) {
        const x = c.x + ax * k;
        const z = c.z + az * k;
        if (!open(x + az, z + ax) || !open(x - az, z - ax) || !this.freeFloor(x, c.y, z)) {
          ok = false;
          break;
        }
        cells.push({ x, y: c.y, z });
      }
      if (ok) return { axis, cells };
    }
    return null;
  }

  place(kind: TrapKind, cell: Cell, plotIndex: number): Trap | TrapReason {
    const why = this.canPlace(kind, cell, plotIndex);
    if (why) return why;
    const door = kind === 'gate' ? this.doorway(cell) : null;
    const cells: Cell[] = door ? door.cells : kind === 'trapdoor' ? [0, 1].flatMap((dx) => [0, 1].map((dz) => ({ x: cell.x + dx, y: cell.y, z: cell.z + dz }))) : [{ ...cell }];
    const t: Trap = {
      id: nextId++,
      kind,
      plotIndex,
      cell: { ...cell },
      cells,
      axis: door ? door.axis : 0,
      state: 'armed',
      timer: 0,
      hp: kind === 'turret' ? TRAP.turretHp : kind === 'gate' ? TRAP.gateHp : 1,
      revealed: kind === 'turret' || kind === 'gate',
      yaw: 0,
      pitch: 0,
      fireTimer: 0,
      saved: [],
    };
    this.traps.push(t);
    this.events.emit('change', {});
    return t;
  }

  remove(t: Trap): void {
    this.restoreTrapdoor(t);
    const i = this.traps.indexOf(t);
    if (i >= 0) this.traps.splice(i, 1);
    this.events.emit('change', {});
  }

  /** Drops traps whose floor vanished (the room was rebuilt or removed). */
  validate(plotIndex: number): void {
    let changed = false;
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const t = this.traps[i];
      if (t.plotIndex !== plotIndex) continue;
      let ok = t.cells.every((c) => this.freeFloor(c.x, c.y, c.z));
      if (ok && t.kind === 'gate') {
        const d = this.doorway(t.cell);
        ok = !!d && d.cells.length === t.cells.length;
      }
      if (!ok) {
        this.traps.splice(i, 1);
        changed = true;
      }
    }
    if (changed) this.events.emit('change', {});
  }

  clear(): void {
    for (const t of this.traps) this.restoreTrapdoor(t);
    this.traps.length = 0;
    this.events.emit('change', {});
  }

  clearPlot(plotIndex: number): void {
    for (let i = this.traps.length - 1; i >= 0; i--) if (this.traps[i].plotIndex === plotIndex) this.remove(this.traps[i]);
  }

  /** Every round starts with every trap armed, hidden again and repaired. */
  resetRound(): void {
    for (const t of this.traps) {
      this.restoreTrapdoor(t);
      t.state = 'armed';
      t.timer = 0;
      t.fireTimer = 0;
      t.hp = t.kind === 'turret' ? TRAP.turretHp : t.kind === 'gate' ? TRAP.gateHp : 1;
      t.revealed = t.kind === 'turret' || t.kind === 'gate';
    }
    this.events.emit('change', {});
  }

  // ------------------------------------------------------------------ queries used by physics and combat
  private owner(t: Trap): Entity | null {
    for (const e of this.entities()) if (e.plotIndex === t.plotIndex) return e;
    return null;
  }

  /** A closed gate is a wall for everyone but its builder. */
  blocksBox(e: Entity | null, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean {
    for (const t of this.traps) {
      if (t.kind !== 'gate' || t.state === 'dead') continue;
      if (e && e.plotIndex === t.plotIndex) continue;
      for (const c of t.cells) if (minX < c.x + 1 && maxX > c.x && minY < c.y + 2 && maxY > c.y && minZ < c.z + 1 && maxZ > c.z) return true;
    }
    return false;
  }

  /** Bullets hit turrets and gates and wear them down. */
  solids(): Solid[] {
    const out: Solid[] = [];
    for (const t of this.traps) {
      if ((t.kind !== 'turret' && t.kind !== 'gate') || t.state === 'dead') continue;
      const c = t.cell;
      let box: THREE.Box3;
      if (t.kind === 'turret') box = new THREE.Box3(new THREE.Vector3(c.x + 0.15, c.y, c.z + 0.15), new THREE.Vector3(c.x + 0.85, c.y + 1.05, c.z + 0.85));
      else {
        // The bars: a thin slab across the whole doorway span.
        box = new THREE.Box3();
        for (const g of t.cells) box.expandByPoint(new THREE.Vector3(g.x, g.y, g.z)).expandByPoint(new THREE.Vector3(g.x + 1, g.y + 2, g.z + 1));
        if (t.axis === 0) {
          box.min.z = c.z + 0.4;
          box.max.z = c.z + 0.6;
        } else {
          box.min.x = c.x + 0.4;
          box.max.x = c.x + 0.6;
        }
      }
      out.push({
        box,
        hit: (amount, attacker) => {
          const own = this.owner(t);
          if (attacker && own && attacker === own) return; // builders cannot break their own defences by accident
          t.hp -= amount;
          if (t.hp <= 0) {
            t.state = 'dead';
            this.events.emit('destroyed', { trap: t, by: attacker });
          }
        },
      });
    }
    return out;
  }

  /** Centre of a closed gate within reach ahead of an entity that cannot pass it (bots shoot it open). */
  gateAhead(e: Entity, reach = 2.6): THREE.Vector3 | null {
    const fwd = e.forwardFlat(tmp);
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    for (const t of this.traps) {
      if (t.kind !== 'gate' || t.state === 'dead' || t.plotIndex === e.plotIndex) continue;
      let cx = 0;
      let cz = 0;
      for (const g of t.cells) {
        cx += (g.x + 0.5) / t.cells.length;
        cz += (g.z + 0.5) / t.cells.length;
      }
      const dx = cx - e.pos.x;
      const dz = cz - e.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > reach || Math.abs(t.cell.y - e.pos.y) > 2.2) continue;
      if ((dx * fwd.x + dz * fwd.z) / Math.max(d, 1e-3) < 0.3) continue;
      if (d < bestD) {
        bestD = d;
        best = new THREE.Vector3(cx, t.cell.y + 1.0, cz);
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ simulation
  update(dt: number, now: number): void {
    const entities = this.entities();
    for (const t of this.traps) {
      if (t.state === 'dead') continue;
      const owner = this.owner(t);
      switch (t.kind) {
        case 'spikes': {
          if (t.state === 'triggered') {
            t.timer -= dt;
            if (t.timer <= 0) t.state = 'armed';
            break;
          }
          for (const e of entities) {
            if (!this.stepsOn(e, t, owner, 1)) continue;
            this.combat.applyDamage(e, TRAP.spikeDamage, owner, now, false, e.center);
            e.vel.x *= 0.15;
            e.vel.z *= 0.15;
            t.state = 'triggered';
            t.timer = TRAP.spikeRearm;
            t.revealed = true;
            this.events.emit('trigger', { trap: t, entity: e });
            break;
          }
          break;
        }
        case 'trapdoor': {
          if (t.state === 'triggered') {
            t.timer -= dt;
            if (t.timer <= 0 && this.restoreTrapdoor(t)) t.state = 'armed';
            break;
          }
          for (const e of entities) {
            if (!this.stepsOn(e, t, owner, 2)) continue;
            for (let dx = 0; dx < 2; dx++)
              for (let dz = 0; dz < 2; dz++) {
                const x = t.cell.x + dx;
                const y = t.cell.y - 1;
                const z = t.cell.z + dz;
                const v = this.world.get(x, y, z);
                if (v === 0) continue;
                t.saved.push({ x, y, z, v });
                this.world.set(x, y, z, 0);
              }
            this.combat.applyDamage(e, TRAP.trapdoorDamage, owner, now, false, e.center);
            t.state = 'triggered';
            t.timer = TRAP.trapdoorOpen;
            t.revealed = true;
            this.events.emit('trigger', { trap: t, entity: e });
            break;
          }
          break;
        }
        case 'mine': {
          for (const e of entities) {
            if (!e.alive || e.burrowed || (owner && e === owner)) continue;
            const dx = e.pos.x - (t.cell.x + 0.5);
            const dz = e.pos.z - (t.cell.z + 0.5);
            const dy = e.pos.y - t.cell.y;
            if (dx * dx + dz * dz > TRAP.mineRadius * TRAP.mineRadius || dy < -0.6 || dy > 1.3) continue;
            t.state = 'dead';
            t.revealed = true;
            this.events.emit('trigger', { trap: t, entity: e });
            this.combat.explode(new THREE.Vector3(t.cell.x + 0.5, t.cell.y + 0.3, t.cell.z + 0.5), TRAP.mineBlast, TRAP.mineDamage, owner, now);
            break;
          }
          break;
        }
        case 'turret': {
          const head = new THREE.Vector3(t.cell.x + 0.5, t.cell.y + 0.9, t.cell.z + 0.5);
          let target: Entity | null = null;
          let bestD = TRAP.turretRange;
          for (const e of entities) {
            if (!e.alive || e.burrowed || (owner && e === owner) || e.protectedUntil > now) continue;
            const c = e.center;
            const d = c.distanceTo(head);
            if (d >= bestD) continue;
            const dir = c.clone().sub(head);
            const vh = this.world.raycast(head.x, head.y, head.z, dir.x, dir.y, dir.z, d - e.radius);
            if (vh) continue;
            bestD = d;
            target = e;
          }
          t.fireTimer -= dt;
          if (!target) {
            // Idle sweep.
            t.yaw += dt * 0.6;
            t.pitch += (0 - t.pitch) * Math.min(1, dt * 3);
            break;
          }
          const c = target.center;
          const wantYaw = Math.atan2(-(c.x - head.x), -(c.z - head.z));
          const flat = Math.hypot(c.x - head.x, c.z - head.z);
          const wantPitch = Math.atan2(c.y - head.y, flat);
          let dy = wantYaw - t.yaw;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          const step = TRAP.turretTurn * dt;
          t.yaw += Math.max(-step, Math.min(step, dy));
          t.pitch += Math.max(-step, Math.min(step, wantPitch - t.pitch));
          if (t.fireTimer <= 0 && Math.abs(dy) < 0.14) {
            t.fireTimer = TRAP.turretInterval;
            // Turrets are steady but not perfect: they miss more at range and against sprinters.
            const speed = Math.hypot(target.vel.x, target.vel.z);
            const hitChance = 0.85 - bestD / TRAP.turretRange * 0.35 - Math.min(0.25, speed / 32);
            const hit = Math.random() < hitChance;
            const to = hit ? c.clone() : c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.6));
            if (hit) this.combat.applyDamage(target, TRAP.turretDamage, owner, now, false, c);
            this.events.emit('turretShot', { trap: t, from: head, to, hit });
          }
          break;
        }
        case 'gate':
          break;
      }
    }
  }

  /** Feet inside the trap's footprint at floor level; owners never trigger their own traps. */
  private stepsOn(e: Entity, t: Trap, owner: Entity | null, w: number): boolean {
    if (!e.alive || e.burrowed || (owner && e === owner) || e.zipRide) return false;
    const dy = e.pos.y - t.cell.y;
    if (dy < -0.1 || dy > 0.35) return false;
    return e.pos.x >= t.cell.x - 0.1 && e.pos.x <= t.cell.x + w + 0.1 && e.pos.z >= t.cell.z - 0.1 && e.pos.z <= t.cell.z + w + 0.1;
  }

  /** Puts a trapdoor's floor back unless someone is standing in the opening. Returns true when restored. */
  private restoreTrapdoor(t: Trap): boolean {
    if (t.saved.length === 0) return true;
    for (const e of this.entities()) {
      if (!e.alive) continue;
      const inX = e.pos.x + e.radius > t.cell.x && e.pos.x - e.radius < t.cell.x + 2;
      const inZ = e.pos.z + e.radius > t.cell.z && e.pos.z - e.radius < t.cell.z + 2;
      if (inX && inZ && e.pos.y + e.height > t.cell.y - 1.2 && e.pos.y < t.cell.y + 0.5) return false;
    }
    for (const s of t.saved) this.world.set(s.x, s.y, s.z, s.v);
    t.saved = [];
    return true;
  }
}
