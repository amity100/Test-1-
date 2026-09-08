import * as THREE from 'three';
import { Emitter } from '../core/Events';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Entity } from './Entities';
import type { Combat, Solid } from './Combat';
import type { Cell } from '../world/Reachability';
import type { Plot } from '../world/Layout';
import { PLOT_Y } from '../world/Layout';

/**
 * Defender traps, set while walking through the fortress after the build and armed every round.
 * Hidden traps (spikes, flame vents, spring pads, mines, trapdoors) wait in the floor until someone
 * steps on them; the mechanical ones (saw rails, swinging blades, crushers, turrets, gates) are in
 * plain sight and are dodged with timing, a jump or a crouch. Attackers see hidden traps only once
 * they have fired; the builder sees everything. Traps never hurt their owner and their kills count
 * for the defender.
 */
export type TrapKind = 'spikes' | 'flame' | 'launcher' | 'mine' | 'trapdoor' | 'saw' | 'pendulum' | 'crusher' | 'turret' | 'gate';
export const TRAP_KINDS: TrapKind[] = ['spikes', 'flame', 'launcher', 'mine', 'trapdoor', 'saw', 'pendulum', 'crusher', 'turret', 'gate'];
export const TRAP_SLOTS = 8;
export const TRAP_COST: Record<TrapKind, number> = { spikes: 1, flame: 1, launcher: 1, mine: 1, trapdoor: 1, saw: 2, pendulum: 2, crusher: 2, turret: 2, gate: 1 };
/** Hidden from attackers until they fire. */
export const TRAP_HIDDEN: Record<TrapKind, boolean> = { spikes: true, flame: true, launcher: true, mine: true, trapdoor: true, saw: false, pendulum: false, crusher: false, turret: false, gate: false };
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
  /** Flame vent: seconds of fire, its reach, damage per second in the fire, then the burning status. */
  flameBurn: 2.6,
  flameRadius: 1.7,
  flameDps: 16,
  flameRearm: 5,
  burnTime: 3,
  burnDps: 7,
  /** Spring pad: upward speed, how much of the run-up carries on, damage on launch and on a ceiling slam. */
  launcherUp: 14,
  launcherCarry: 1.4,
  launcherDamage: 10,
  launcherSlam: 30,
  launcherRearm: 2.5,
  /** Swinging blade: period, swing amplitude (radians), damage and knockback. */
  pendulumPeriod: 2.0,
  pendulumSwing: 1.15,
  pendulumDamage: 45,
  pendulumKnock: 9,
  /** Seconds before the same trap can cut the same person again. */
  hitCooldown: 0.9,
  /** Crusher: telegraph, slam, time down, time back up, damage, ceiling gap allowed (blocks). */
  crusherWarn: 0.45,
  crusherSlam: 0.16,
  crusherDown: 1.0,
  crusherRise: 1.5,
  crusherDamage: 80,
  crusherMinGap: 3,
  crusherMaxGap: 5,
  /** Saw rail: blade speed along the rail, blade radius, damage, knockback, rail length in cells. */
  sawSpeed: 3.4,
  sawRadius: 0.6,
  sawDamage: 35,
  sawKnock: 7,
  sawMinRun: 3,
  sawMaxRun: 7,
};

export interface Trap {
  id: number;
  kind: TrapKind;
  plotIndex: number;
  /** Anchor feet cell (air over a floor block). */
  cell: Cell;
  /** Every feet cell the trap covers: one, a 2x2, a saw's rail or a doorway's whole span. */
  cells: Cell[];
  /** Gate/blade: 0 = the wall runs along x, 2 = along z. Saw: the axis the rail runs along. */
  axis: 0 | 2;
  state: 'armed' | 'triggered' | 'dead';
  /** When it died; a spent trap is cleared away a little later and frees its slots for a new one. */
  deadAt?: number;
  timer: number;
  hp: number;
  /** Seen by everyone. Hidden kinds stay invisible to attackers until they fire. */
  revealed: boolean;
  /** Turret aim (radians) and fire timer. */
  yaw: number;
  pitch: number;
  fireTimer: number;
  /** Trapdoor: floor blocks removed while open. */
  saved: { x: number; y: number; z: number; v: number }[];
  /** Mechanical traps: sub-state (crusher idle/warn/slam/down/rise, flame cool), animation scalar, direction. */
  stage: string;
  /** Blade angle, saw position along the rail (cells), crusher height 0..1, pad pop. */
  anim: number;
  dir: 1 | -1;
  /** Crusher: ceiling gap in blocks; saw: rail length; blade: opening height. */
  span: number;
  /** Per-entity time the trap may hurt them again (repeat hits and damage ticks). */
  lastHit: Map<number, number>;
  /** Delayed effects (a launched body meeting the ceiling). */
  queue: { id: number; at: number }[];
  /** Entity that set the trap (kill credit); -1 for seeded traps (credit goes to any owner of the plot). */
  ownerId: number;
}

export type TrapReason = 'trapNoSlots' | 'trapNeedsFloor' | 'trapNeedsUpper' | 'gateNeedsDoorway' | 'trapNeedsDoorway' | 'trapNeedsCeiling' | 'sawNeedsRun' | 'trapTaken';

export type TrapFx = 'swing' | 'warn' | 'slam' | 'flameEnd' | 'launch' | 'ceiling';

export interface TrapEvents extends Record<string, unknown> {
  /** A trap got somebody. */
  trigger: { trap: Trap; entity: Entity };
  turretShot: { trap: Trap; from: THREE.Vector3; to: THREE.Vector3; hit: boolean };
  destroyed: { trap: Trap; by: Entity | null };
  /** Presentation cues that are not hits (the blade whoosh, the crusher's click, the slam). */
  fx: { trap: Trap; kind: TrapFx; pos: THREE.Vector3; entity: Entity | null };
  change: Record<string, never>;
}

interface Layout {
  cells: Cell[];
  axis: 0 | 2;
  span: number;
}

let nextId = 1;
const tmp = new THREE.Vector3();

export class TrapSystem {
  readonly events = new Emitter<TrapEvents>();
  readonly traps: Trap[] = [];
  /** Slot budget per plot (a team fortress gets slots for every builder). */
  private slotLimits = new Map<number, number>();

  constructor(
    private world: VoxelWorld,
    private combat: Combat,
    private entities: () => Entity[],
    private plots: Plot[],
  ) {}

  // ------------------------------------------------------------------ placement
  setSlots(plotIndex: number, slots: number): void {
    this.slotLimits.set(plotIndex, slots);
  }
  slotsFor(plotIndex: number): number {
    return this.slotLimits.get(plotIndex) ?? TRAP_SLOTS;
  }
  /** Slots used by one builder on a plot. */
  slotsUsedBy(plotIndex: number, ownerId: number): number {
    let n = 0;
    for (const t of this.traps) if (t.plotIndex === plotIndex && t.ownerId === ownerId) n += TRAP_COST[t.kind];
    return n;
  }

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

  private inPlot(c: Cell, plotIndex: number): boolean {
    return this.plotAt(c.x, c.z) === plotIndex;
  }

  /** Blocks of free air above a cell before the ceiling (capped). */
  private headroom(x: number, y: number, z: number, cap = 6): number {
    let h = 0;
    while (h < cap && this.world.get(x, y + h, z) === 0) h++;
    return h;
  }

  /** The footprint a trap of this kind would take from this anchor, or why it cannot. */
  private layout(kind: TrapKind, c: Cell, plotIndex: number): Layout | TrapReason {
    switch (kind) {
      case 'trapdoor':
      case 'crusher': {
        const cells: Cell[] = [];
        let gap = 99;
        for (let dx = 0; dx < 2; dx++)
          for (let dz = 0; dz < 2; dz++) {
            const x = c.x + dx;
            const z = c.z + dz;
            if (!this.inPlot({ x, y: c.y, z }, plotIndex) || !this.freeFloor(x, c.y, z)) return 'trapNeedsFloor';
            if (kind === 'trapdoor' && (c.y < PLOT_Y + 5 || this.world.get(x, c.y - 2, z) !== 0)) return 'trapNeedsUpper';
            if (kind === 'crusher') gap = Math.min(gap, this.headroom(x, c.y, z, TRAP.crusherMaxGap + 1));
            cells.push({ x, y: c.y, z });
          }
        if (kind === 'crusher' && (gap < TRAP.crusherMinGap || gap > TRAP.crusherMaxGap)) return 'trapNeedsCeiling';
        return { cells, axis: 0, span: kind === 'crusher' ? gap : 0 };
      }
      case 'gate':
      case 'pendulum': {
        if (!this.freeFloor(c.x, c.y, c.z)) return 'trapNeedsFloor';
        const d = this.doorway(c);
        if (!d) return kind === 'gate' ? 'gateNeedsDoorway' : 'trapNeedsDoorway';
        let span = 6;
        for (const g of d.cells) span = Math.min(span, this.headroom(g.x, g.y, g.z, 4));
        return { cells: d.cells, axis: d.axis, span };
      }
      case 'saw': {
        if (!this.freeFloor(c.x, c.y, c.z)) return 'trapNeedsFloor';
        let best: Layout | null = null;
        for (const axis of [0, 2] as const) {
          const ax = axis === 0 ? 1 : 0;
          const az = axis === 0 ? 0 : 1;
          const run: Cell[] = [{ ...c }];
          const ok = (x: number, z: number): boolean => this.inPlot({ x, y: c.y, z }, plotIndex) && this.freeFloor(x, c.y, z) && !this.at({ x, y: c.y, z });
          for (let k = 1; run.length < TRAP.sawMaxRun && ok(c.x + ax * k, c.z + az * k); k++) run.push({ x: c.x + ax * k, y: c.y, z: c.z + az * k });
          for (let k = 1; run.length < TRAP.sawMaxRun && ok(c.x - ax * k, c.z - az * k); k++) run.unshift({ x: c.x - ax * k, y: c.y, z: c.z - az * k });
          if (run.length >= TRAP.sawMinRun && (!best || run.length > best.cells.length)) best = { cells: run, axis, span: run.length };
        }
        return best ?? 'sawNeedsRun';
      }
      default:
        if (!this.freeFloor(c.x, c.y, c.z)) return 'trapNeedsFloor';
        return { cells: [{ ...c }], axis: 0, span: 0 };
    }
  }

  /** Why a trap cannot go on this cell, or null when it can. */
  canPlace(kind: TrapKind, cell: Cell, plotIndex: number): TrapReason | null {
    if (this.slotsUsed(plotIndex) + TRAP_COST[kind] > this.slotsFor(plotIndex)) return 'trapNoSlots';
    if (!this.inPlot(cell, plotIndex) || cell.y <= PLOT_Y) return 'trapNeedsFloor';
    const L = this.layout(kind, cell, plotIndex);
    if (typeof L === 'string') return L;
    for (const c of L.cells) if (this.at(c)) return 'trapTaken';
    return null;
  }

  /** The cells a trap would cover (for the placement ghost) and the reason it cannot go there, if any. */
  preview(kind: TrapKind, cell: Cell, plotIndex: number): { cells: Cell[]; reason: TrapReason | null } {
    const reason = this.canPlace(kind, cell, plotIndex);
    const L = this.layout(kind, cell, plotIndex);
    if (typeof L !== 'string') return { cells: L.cells, reason };
    const w = kind === 'trapdoor' || kind === 'crusher' ? 2 : 1;
    const cells: Cell[] = [];
    for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < w; dz++) cells.push({ x: cell.x + dx, y: cell.y, z: cell.z + dz });
    return { cells, reason };
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

  place(kind: TrapKind, cell: Cell, plotIndex: number, ownerId = -1): Trap | TrapReason {
    const why = this.canPlace(kind, cell, plotIndex);
    if (why) return why;
    const L = this.layout(kind, cell, plotIndex) as Layout;
    const t: Trap = {
      id: nextId++,
      kind,
      plotIndex,
      cell: { ...cell },
      cells: L.cells,
      axis: L.axis,
      state: 'armed',
      timer: 0,
      hp: kind === 'turret' ? TRAP.turretHp : kind === 'gate' ? TRAP.gateHp : 1,
      revealed: !TRAP_HIDDEN[kind],
      yaw: 0,
      pitch: 0,
      fireTimer: 0,
      saved: [],
      stage: kind === 'crusher' ? 'idle' : '',
      anim: kind === 'crusher' ? 1 : kind === 'saw' ? L.cells.findIndex((c) => c.x === cell.x && c.z === cell.z) : 0,
      dir: 1,
      span: L.span,
      lastHit: new Map(),
      queue: [],
      ownerId,
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

  /** Drops traps whose floor or doorway vanished (the room was rebuilt or removed). */
  validate(plotIndex: number): void {
    let changed = false;
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const t = this.traps[i];
      if (t.plotIndex !== plotIndex) continue;
      let ok = t.cells.every((c) => this.freeFloor(c.x, c.y, c.z));
      if (ok && (t.kind === 'gate' || t.kind === 'pendulum' || t.kind === 'crusher')) {
        const L = this.layout(t.kind, t.cell, plotIndex);
        ok = typeof L !== 'string' && L.cells.length === t.cells.length;
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
      t.revealed = !TRAP_HIDDEN[t.kind];
      t.stage = t.kind === 'crusher' ? 'idle' : '';
      t.anim = t.kind === 'crusher' ? 1 : t.kind === 'saw' ? t.cells.findIndex((c) => c.x === t.cell.x && c.z === t.cell.z) : 0;
      t.dir = 1;
      t.lastHit.clear();
      t.queue = [];
    }
    this.events.emit('change', {});
  }

  // ------------------------------------------------------------------ queries used by physics and combat
  /** Who gets the credit: the builder who set it, else anyone of the plot's team. */
  private owner(t: Trap): Entity | null {
    const list = this.entities();
    if (t.ownerId >= 0) for (const e of list) if (e.id === t.ownerId) return e;
    for (const e of list) if (e.plotIndex === t.plotIndex) return e;
    return null;
  }

  /** The whole team that built the fortress is immune to its traps. */
  private immune(e: Entity, t: Trap): boolean {
    return e.plotIndex === t.plotIndex;
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
          if (attacker && attacker.plotIndex === t.plotIndex) return; // builders cannot break their own defences by accident
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

  /** Centre of a trap's footprint at floor level. */
  centre(t: Trap, out = new THREE.Vector3()): THREE.Vector3 {
    out.set(0, t.cell.y, 0);
    for (const g of t.cells) {
      out.x += (g.x + 0.5) / t.cells.length;
      out.z += (g.z + 0.5) / t.cells.length;
    }
    return out;
  }

  /** Where the swinging blade's edge is right now: pivot, angle and length. */
  bladePose(t: Trap): { pivot: THREE.Vector3; angle: number; length: number } {
    const pivot = this.centre(t);
    pivot.y = t.cell.y + Math.max(2, t.span) - 0.1;
    return { pivot, angle: t.anim, length: Math.max(1.2, Math.min(2.4, Math.max(2, t.span) - 0.6)) };
  }

  /** Where the saw blade's centre is right now. */
  sawPos(t: Trap, out = new THREE.Vector3()): THREE.Vector3 {
    const a = t.cells[0];
    const k = t.anim;
    return out.set(a.x + 0.5 + (t.axis === 0 ? k : 0), t.cell.y + 0.45, a.z + 0.5 + (t.axis === 2 ? k : 0));
  }

  // ------------------------------------------------------------------ simulation
  update(dt: number, now: number): void {
    const entities = this.entities();
    this.updateBurning(entities, dt, now);
    const spent: Trap[] = [];
    for (const t of this.traps) {
      if (t.state === 'dead') {
        if (t.deadAt === undefined) t.deadAt = now;
        else if (now - t.deadAt > 8) spent.push(t);
        continue;
      }
      const owner = this.owner(t);
      switch (t.kind) {
        case 'spikes':
          this.updateSpikes(t, entities, owner, dt, now);
          break;
        case 'flame':
          this.updateFlame(t, entities, owner, dt, now);
          break;
        case 'launcher':
          this.updateLauncher(t, entities, owner, dt, now);
          break;
        case 'trapdoor':
          this.updateTrapdoor(t, entities, owner, dt, now);
          break;
        case 'mine':
          this.updateMine(t, entities, owner, now);
          break;
        case 'saw':
          this.updateSaw(t, entities, owner, dt, now);
          break;
        case 'pendulum':
          this.updatePendulum(t, entities, owner, dt, now);
          break;
        case 'crusher':
          this.updateCrusher(t, entities, owner, dt, now);
          break;
        case 'turret':
          this.updateTurret(t, entities, owner, dt, now);
          break;
        case 'gate':
          break;
      }
    }
    for (const t of spent) this.remove(t);
  }

  /** Burning bodies keep taking damage for a few seconds after leaving the fire (credited to the vent's owner). */
  private updateBurning(entities: Entity[], dt: number, now: number): void {
    for (const e of entities) {
      if (!e.alive || e.burnUntil <= now) continue;
      e.burnTick -= dt;
      if (e.burnTick > 0) continue;
      e.burnTick = 0.4;
      this.combat.applyDamage(e, TRAP.burnDps * 0.4, e.burnBy, now, false, e.center);
    }
  }

  private updateSpikes(t: Trap, entities: Entity[], owner: Entity | null, dt: number, now: number): void {
    if (t.state === 'triggered') {
      t.timer -= dt;
      if (t.timer <= 0) t.state = 'armed';
      return;
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
  }

  private updateFlame(t: Trap, entities: Entity[], owner: Entity | null, dt: number, now: number): void {
    const c = this.centre(t, tmp);
    if (t.state === 'triggered') {
      // A column of fire: everyone in it burns, and keeps burning for a while after.
      t.timer -= dt;
      for (const e of entities) {
        if (!e.alive || e.burrowed || this.immune(e, t)) continue;
        const dx = e.pos.x - c.x;
        const dz = e.pos.z - c.z;
        const dy = e.pos.y - c.y;
        if (dx * dx + dz * dz > TRAP.flameRadius * TRAP.flameRadius || dy < -0.6 || dy > 2.4) continue;
        e.burnUntil = now + TRAP.burnTime;
        e.burnBy = owner;
        if ((t.lastHit.get(e.id) ?? -1) > now) continue;
        t.lastHit.set(e.id, now + 0.3);
        this.combat.applyDamage(e, TRAP.flameDps * 0.3, owner, now, false, e.center);
      }
      if (t.timer <= 0) {
        t.state = 'armed';
        t.stage = 'cool';
        t.timer = TRAP.flameRearm;
        this.events.emit('fx', { trap: t, kind: 'flameEnd', pos: c.clone(), entity: null });
      }
      return;
    }
    if (t.stage === 'cool') {
      t.timer -= dt;
      if (t.timer <= 0) t.stage = '';
      return;
    }
    for (const e of entities) {
      if (!this.stepsOn(e, t, owner, 1)) continue;
      t.state = 'triggered';
      t.timer = TRAP.flameBurn;
      t.revealed = true;
      t.lastHit.clear();
      this.events.emit('trigger', { trap: t, entity: e });
      break;
    }
  }

  private updateLauncher(t: Trap, entities: Entity[], owner: Entity | null, dt: number, now: number): void {
    // Bodies already in the air meet the ceiling a moment after the launch.
    for (let i = t.queue.length - 1; i >= 0; i--) {
      const q = t.queue[i];
      if (q.at > now) continue;
      t.queue.splice(i, 1);
      const e = entities.find((x) => x.id === q.id);
      if (!e || !e.alive || e.vel.y < -0.5) continue;
      e.vel.y = -3;
      this.combat.applyDamage(e, TRAP.launcherSlam, owner, now, false, e.eyePos);
      this.events.emit('fx', { trap: t, kind: 'ceiling', pos: e.eyePos, entity: e });
    }
    if (t.state === 'triggered') {
      t.timer -= dt;
      t.anim = Math.max(0, t.anim - dt * 3);
      if (t.timer <= 0 && t.queue.length === 0) t.state = 'armed';
      return;
    }
    for (const e of entities) {
      if (!this.stepsOn(e, t, owner, 1)) continue;
      // Fling them up and onward: a sprinter flies across the room, a walker mostly straight up.
      const sp = Math.hypot(e.vel.x, e.vel.z);
      if (sp > 1) {
        const k = Math.max(5, sp * TRAP.launcherCarry) / sp;
        e.vel.x *= k;
        e.vel.z *= k;
      } else {
        const f = e.forwardFlat(tmp);
        e.vel.x = f.x * 4;
        e.vel.z = f.z * 4;
      }
      e.vel.y = TRAP.launcherUp;
      e.grounded = false;
      e.crouching = false;
      e.sliding = false;
      e.grapplePoint = null;
      e.zipRide = null;
      this.combat.applyDamage(e, TRAP.launcherDamage, owner, now, false, e.center);
      // A ceiling within reach means a slam on the way up.
      const top = e.pos.y + e.height;
      const hit = this.world.raycast(e.pos.x, top, e.pos.z, 0, 1, 0, 3.6);
      if (hit) t.queue.push({ id: e.id, at: now + Math.max(0.12, Math.min(0.45, hit.dist / TRAP.launcherUp)) });
      t.state = 'triggered';
      t.timer = TRAP.launcherRearm;
      t.anim = 1;
      t.revealed = true;
      this.events.emit('trigger', { trap: t, entity: e });
      this.events.emit('fx', { trap: t, kind: 'launch', pos: this.centre(t), entity: e });
      break;
    }
  }

  private updateTrapdoor(t: Trap, entities: Entity[], owner: Entity | null, dt: number, now: number): void {
    if (t.state === 'triggered') {
      t.timer -= dt;
      if (t.timer <= 0 && this.restoreTrapdoor(t)) t.state = 'armed';
      return;
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
  }

  private updateMine(t: Trap, entities: Entity[], owner: Entity | null, now: number): void {
    for (const e of entities) {
      if (!e.alive || e.burrowed || this.immune(e, t)) continue;
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
  }

  private updateSaw(t: Trap, entities: Entity[], owner: Entity | null, dt: number, now: number): void {
    // The blade runs to the end of the rail and back.
    const len = t.cells.length - 1;
    t.anim += t.dir * TRAP.sawSpeed * dt;
    if (t.anim >= len) {
      t.anim = len;
      t.dir = -1;
    } else if (t.anim <= 0) {
      t.anim = 0;
      t.dir = 1;
    }
    const p = this.sawPos(t, tmp);
    for (const e of entities) {
      if (!e.alive || e.burrowed || this.immune(e, t) || e.zipRide) continue;
      if ((t.lastHit.get(e.id) ?? -1) > now) continue;
      // Jumping clears it: feet above the blade's top are safe.
      if (e.pos.y > t.cell.y + 0.75 || e.pos.y < t.cell.y - 0.5) continue;
      const dx = e.pos.x - p.x;
      const dz = e.pos.z - p.z;
      const reach = TRAP.sawRadius + e.radius * 0.7;
      if (dx * dx + dz * dz > reach * reach) continue;
      t.lastHit.set(e.id, now + TRAP.hitCooldown);
      // Thrown sideways off the rail.
      const side = t.axis === 0 ? Math.sign(dz) || 1 : Math.sign(dx) || 1;
      if (t.axis === 0) e.vel.z += side * TRAP.sawKnock;
      else e.vel.x += side * TRAP.sawKnock;
      e.vel.y = Math.max(e.vel.y, 4);
      e.grounded = false;
      this.combat.applyDamage(e, TRAP.sawDamage, owner, now, false, e.center);
      this.events.emit('trigger', { trap: t, entity: e });
    }
  }

  private updatePendulum(t: Trap, entities: Entity[], owner: Entity | null, dt: number, now: number): void {
    const before = Math.sin((2 * Math.PI * t.timer) / TRAP.pendulumPeriod);
    t.timer += dt;
    const phase = (2 * Math.PI * t.timer) / TRAP.pendulumPeriod;
    const s = Math.sin(phase);
    t.anim = TRAP.pendulumSwing * s;
    const { pivot, angle, length } = this.bladePose(t);
    if ((before < 0 && s >= 0) || (before > 0 && s <= 0)) this.events.emit('fx', { trap: t, kind: 'swing', pos: pivot.clone().setY(pivot.y - length), entity: null });
    const along = t.axis === 0 ? 'x' : 'z';
    const swingDir = Math.sign(Math.cos(phase)) || 1;
    for (const e of entities) {
      if (!e.alive || e.burrowed || this.immune(e, t) || e.zipRide) continue;
      if ((t.lastHit.get(e.id) ?? -1) > now) continue;
      // The blade's lower half, sampled at three points, against the body's box.
      let hit = false;
      for (const f of [0.5, 0.75, 1]) {
        const off = Math.sin(angle) * f * length;
        const px = pivot.x + (along === 'x' ? off : 0);
        const pz = pivot.z + (along === 'z' ? off : 0);
        const py = pivot.y - Math.cos(angle) * f * length;
        if (Math.abs(px - e.pos.x) <= e.radius + 0.22 && Math.abs(pz - e.pos.z) <= e.radius + 0.22 && py >= e.pos.y && py <= e.pos.y + e.height) {
          hit = true;
          break;
        }
      }
      if (!hit) continue;
      t.lastHit.set(e.id, now + TRAP.hitCooldown);
      if (along === 'x') e.vel.x += swingDir * TRAP.pendulumKnock;
      else e.vel.z += swingDir * TRAP.pendulumKnock;
      e.vel.y = Math.max(e.vel.y, 3);
      e.grounded = false;
      this.combat.applyDamage(e, TRAP.pendulumDamage, owner, now, false, e.center);
      this.events.emit('trigger', { trap: t, entity: e });
    }
  }

  private updateCrusher(t: Trap, entities: Entity[], owner: Entity | null, dt: number, now: number): void {
    const inFootprint = (e: Entity, top: number): boolean => {
      if (!e.alive || e.burrowed || this.immune(e, t)) return false;
      const dy = e.pos.y - t.cell.y;
      if (dy < -0.1 || dy > top) return false;
      return e.pos.x >= t.cell.x - 0.15 && e.pos.x <= t.cell.x + 2.15 && e.pos.z >= t.cell.z - 0.15 && e.pos.z <= t.cell.z + 2.15;
    };
    const c = this.centre(t, tmp).clone();
    switch (t.stage) {
      case 'idle':
        t.anim = 1;
        for (const e of entities) {
          if (!inFootprint(e, 1.3)) continue;
          t.stage = 'warn';
          t.timer = TRAP.crusherWarn;
          this.events.emit('fx', { trap: t, kind: 'warn', pos: c, entity: e });
          break;
        }
        break;
      case 'warn':
        t.timer -= dt;
        if (t.timer <= 0) {
          t.stage = 'slam';
          t.timer = TRAP.crusherSlam;
        }
        break;
      case 'slam':
        t.timer -= dt;
        t.anim = Math.max(0, t.timer / TRAP.crusherSlam);
        if (t.timer <= 0) {
          t.anim = 0;
          let got: Entity | null = null;
          for (const e of entities) {
            if (!inFootprint(e, 1.8)) continue;
            e.vel.set(0, -2, 0);
            this.combat.applyDamage(e, TRAP.crusherDamage, owner, now, false, e.center);
            this.events.emit('trigger', { trap: t, entity: e });
            got = got ?? e;
          }
          t.stage = 'down';
          t.timer = TRAP.crusherDown;
          this.events.emit('fx', { trap: t, kind: 'slam', pos: c, entity: got });
        }
        break;
      case 'down':
        t.timer -= dt;
        if (t.timer <= 0) {
          t.stage = 'rise';
          t.timer = TRAP.crusherRise;
        }
        break;
      case 'rise':
        t.timer -= dt;
        t.anim = Math.min(1, 1 - t.timer / TRAP.crusherRise);
        if (t.timer <= 0) {
          t.anim = 1;
          t.stage = 'idle';
        }
        break;
      default:
        t.stage = 'idle';
    }
  }

  private updateTurret(t: Trap, entities: Entity[], owner: Entity | null, dt: number, now: number): void {
    const head = new THREE.Vector3(t.cell.x + 0.5, t.cell.y + 0.9, t.cell.z + 0.5);
    let target: Entity | null = null;
    let bestD = TRAP.turretRange;
    for (const e of entities) {
      if (!e.alive || e.burrowed || this.immune(e, t) || e.protectedUntil > now) continue;
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
      return;
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
      const hitChance = 0.85 - (bestD / TRAP.turretRange) * 0.35 - Math.min(0.25, speed / 32);
      const hit = Math.random() < hitChance;
      const to = hit ? c.clone() : c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.6));
      if (hit) this.combat.applyDamage(target, TRAP.turretDamage, owner, now, false, c);
      this.events.emit('turretShot', { trap: t, from: head, to, hit });
    }
  }

  /** Feet inside the trap's footprint at floor level; owners never trigger their own traps. */
  private stepsOn(e: Entity, t: Trap, owner: Entity | null, w: number): boolean {
    void owner;
    if (!e.alive || e.burrowed || this.immune(e, t) || e.zipRide) return false;
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
