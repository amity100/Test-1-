import * as THREE from 'three';
import { Emitter } from '../core/Events';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Entity } from './Entities';
import type { Plot } from '../world/Layout';
import type { Cell } from '../world/Reachability';
import { PLOT_Y } from '../world/Layout';
import { Random } from '../core/Random';
import { blockMat, isTransparent, blockShape } from '../world/Voxel';

/**
 * Surprises during a round, about once a minute, each announced three seconds ahead: a blackout
 * (roofed rooms go dark, lamps out), a wall breach (a 3x3 piece of the fortress wall falls, a new
 * way in for the rest of the round), a supply drop (a crate of armour, grenades and ammo lands on a
 * roof of the contested fortress; first come first served) and fog (a short view for everyone).
 */
export type EventKind = 'blackout' | 'breach' | 'supply' | 'fog';
export const EVENT_KINDS: EventKind[] = ['blackout', 'breach', 'supply', 'fog'];
export const EVENT = {
  firstAt: [48, 66] as [number, number],
  every: [52, 78] as [number, number],
  warn: 3,
  blackout: 12,
  fog: 18,
  supplyArmor: 50,
  /** No new event this close to the end of the round. */
  minLeft: 25,
  supplyFall: 2.2,
};

export interface RoundEventsEvents extends Record<string, unknown> {
  /** Countdown: fires at 3, 2, 1 seconds before the event. */
  warn: { kind: EventKind; seconds: number };
  start: { kind: EventKind; pos: THREE.Vector3 | null };
  end: { kind: EventKind };
  supplyTaken: { entity: Entity; pos: THREE.Vector3 };
  breach: { cells: Cell[]; pos: THREE.Vector3 };
}

export interface RoundEventsHost {
  entities(): Entity[];
  targetPlot(): Plot | null;
  /** Roof terrace spots of a fortress (feet level). */
  roofSpots(plotIndex: number): Cell[];
  /** Seconds left in the round and whether the round is live. */
  timeLeft(): number;
  live(): boolean;
}

export interface Supply {
  pos: THREE.Vector3;
  /** 0..1 while falling. */
  fall: number;
  landed: boolean;
  taken: boolean;
}

export class RoundEvents {
  readonly events = new Emitter<RoundEventsEvents>();
  /** Active timed effects. */
  blackout = 0;
  fog = 0;
  supply: Supply | null = null;
  /** Next event kind and the round clock (seconds elapsed) it fires at; warning already issued. */
  private next: EventKind | null = null;
  private nextAt = 0;
  private warned = new Set<number>();
  private elapsed = 0;
  private rng = new Random(1);
  private removed: { x: number; y: number; z: number; v: number }[] = [];
  private used: EventKind[] = [];

  constructor(
    private world: VoxelWorld,
    private host: RoundEventsHost,
  ) {}

  /** Called when a round starts: schedules the first surprise. */
  startRound(seed: number): void {
    this.endRound();
    this.rng = new Random(seed >>> 0);
    this.elapsed = 0;
    this.used = [];
    this.schedule(this.rng.range(EVENT.firstAt[0], EVENT.firstAt[1]));
  }

  /** Round over: everything back to normal, breached walls rebuilt. */
  endRound(): void {
    if (this.blackout > 0) this.events.emit('end', { kind: 'blackout' });
    if (this.fog > 0) this.events.emit('end', { kind: 'fog' });
    this.blackout = 0;
    this.fog = 0;
    this.supply = null;
    this.next = null;
    this.warned.clear();
    for (const r of this.removed) if (this.world.get(r.x, r.y, r.z) === 0) this.world.set(r.x, r.y, r.z, r.v);
    this.removed = [];
  }

  /** How well anyone can see right now (bots use it): fog and blackout shorten sight. */
  visibility(): number {
    if (this.fog > 0) return 0.45;
    if (this.blackout > 0) return 0.6;
    return 1;
  }

  private schedule(inSeconds: number): void {
    // Rotate through the kinds so a round shows variety; breach and supply need a target fortress.
    const pool = EVENT_KINDS.filter((k) => !this.used.includes(k));
    const kinds = pool.length ? pool : EVENT_KINDS;
    this.next = this.rng.pick(kinds);
    this.nextAt = this.elapsed + inSeconds;
    this.warned.clear();
  }

  update(dt: number, now: number): void {
    if (!this.host.live()) return;
    this.elapsed += dt;
    if (this.blackout > 0) {
      this.blackout -= dt;
      if (this.blackout <= 0) {
        this.blackout = 0;
        this.events.emit('end', { kind: 'blackout' });
      }
    }
    if (this.fog > 0) {
      this.fog -= dt;
      if (this.fog <= 0) {
        this.fog = 0;
        this.events.emit('end', { kind: 'fog' });
      }
    }
    this.updateSupply(dt);
    if (!this.next) return;
    const left = this.nextAt - this.elapsed;
    // Too late in the round: drop it.
    if (this.host.timeLeft() < EVENT.minLeft) {
      this.next = null;
      return;
    }
    for (const s of [3, 2, 1]) {
      if (left <= s && !this.warned.has(s)) {
        this.warned.add(s);
        this.events.emit('warn', { kind: this.next, seconds: s });
      }
    }
    if (left > 0) return;
    const kind = this.next;
    this.next = null;
    this.used.push(kind);
    this.fire(kind, now);
    this.schedule(this.rng.range(EVENT.every[0], EVENT.every[1]));
  }

  private fire(kind: EventKind, now: number): void {
    void now;
    switch (kind) {
      case 'blackout':
        this.blackout = EVENT.blackout;
        this.events.emit('start', { kind, pos: null });
        break;
      case 'fog':
        this.fog = EVENT.fog;
        this.events.emit('start', { kind, pos: null });
        break;
      case 'supply': {
        const plot = this.host.targetPlot();
        const spots = plot ? this.host.roofSpots(plot.index) : [];
        if (!plot || spots.length === 0) {
          // Nothing to land on: fog instead.
          this.fire('fog', now);
          return;
        }
        const c = this.rng.pick(spots);
        this.supply = { pos: new THREE.Vector3(c.x + 0.5, c.y, c.z + 0.5), fall: 0, landed: false, taken: false };
        this.events.emit('start', { kind, pos: this.supply.pos.clone() });
        break;
      }
      case 'breach': {
        const plot = this.host.targetPlot();
        const hole = plot ? this.breachWall(plot) : null;
        if (!hole) {
          this.fire('blackout', now);
          return;
        }
        this.events.emit('start', { kind, pos: hole.pos });
        this.events.emit('breach', hole);
        break;
      }
    }
  }

  private updateSupply(dt: number): void {
    const s = this.supply;
    if (!s || s.taken) return;
    if (!s.landed) {
      s.fall = Math.min(1, s.fall + dt / EVENT.supplyFall);
      if (s.fall >= 1) s.landed = true;
      return;
    }
    for (const e of this.host.entities()) {
      if (!e.alive || e.burrowed) continue;
      const dx = e.pos.x - s.pos.x;
      const dz = e.pos.z - s.pos.z;
      if (dx * dx + dz * dz > 1.4 * 1.4 || Math.abs(e.pos.y - s.pos.y) > 1.6) continue;
      s.taken = true;
      e.armor = Math.max(e.armor, EVENT.supplyArmor);
      e.grenades = Math.max(e.grenades, 2);
      for (const w of e.weapons) w.reserve = Math.max(w.reserve, 90);
      this.events.emit('supplyTaken', { entity: e, pos: s.pos.clone() });
      break;
    }
  }

  /** Current height of the falling crate above its landing spot. */
  supplyHeight(): number {
    const s = this.supply;
    if (!s) return 0;
    const k = 1 - s.fall;
    return k * k * 28;
  }

  /**
   * Knocks a 3x3 hole in an outer wall of the fortress at ground level: a wall column three blocks
   * tall with the outdoors on one side and a room on the other, extended one block each way along
   * the wall. Removed blocks come back at the end of the round.
   */
  private breachWall(plot: Plot): { cells: Cell[]; pos: THREE.Vector3 } | null {
    const w = this.world;
    const solidWall = (x: number, y: number, z: number): boolean => {
      const v = w.get(x, y, z);
      return v !== 0 && blockShape(v) === 0 && !isTransparent(blockMat(v));
    };
    const air = (x: number, y: number, z: number): boolean => w.get(x, y, z) === 0;
    const y0 = PLOT_Y + 1;
    const cands: { x: number; z: number; ox: number; oz: number }[] = [];
    for (let x = plot.minX + 1; x < plot.maxX; x++)
      for (let z = plot.minZ + 1; z < plot.maxZ; z++) {
        if (!solidWall(x, y0, z) || !solidWall(x, y0 + 1, z) || !solidWall(x, y0 + 2, z)) continue;
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          // Outdoors on one side (two cells of open air), a room on the other.
          if (!air(x + ox, y0, z + oz) || !air(x + ox, y0 + 1, z + oz) || !air(x + 2 * ox, y0, z + 2 * oz)) continue;
          if (!air(x - ox, y0, z - oz) || !air(x - ox, y0 + 1, z - oz)) continue;
          // Inside a wall run, not at a corner: wall continues along the wall on both sides.
          const wx = oz;
          const wz = ox;
          if (!solidWall(x + wx, y0, z + wz) || !solidWall(x - wx, y0, z - wz)) continue;
          if (!solidWall(x + wx, y0 + 1, z + wz) || !solidWall(x - wx, y0 + 1, z - wz)) continue;
          cands.push({ x, z, ox, oz });
        }
      }
    if (cands.length === 0) return null;
    const c = this.rng.pick(cands);
    const cells: Cell[] = [];
    for (let k = -1; k <= 1; k++)
      for (let dy = 0; dy < 3; dy++) {
        const x = c.x + c.oz * k;
        const z = c.z + c.ox * k;
        const y = y0 + dy;
        const v = w.get(x, y, z);
        if (v === 0) continue;
        this.removed.push({ x, y, z, v });
        w.set(x, y, z, 0);
        cells.push({ x, y, z });
      }
    return { cells, pos: new THREE.Vector3(c.x + 0.5, y0 + 1.5, c.z + 0.5) };
  }
}
