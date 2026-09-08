import * as THREE from 'three';
import type { Entity } from '../sim/Entities';
import type { WarState } from '../sim/War';
import type { Plot } from '../world/Layout';
import type { Cell } from '../world/Reachability';
import { ENGINE, type EngineKind, type EngineSystem } from '../sim/Engines';
import { TRAP_COST, type TrapKind, type TrapSystem } from '../sim/Traps';
import type { TrapOrder } from '../build/TeamBuild';
import { Random } from '../core/Random';

/**
 * The enemy commander's works: what a bot team builds during the battle with the supplies it earns.
 * Every few seconds the commander looks at the purse and the castle and orders one thing: a siege
 * engine on a roof facing the enemy (a ballista first, then a catapult; how many beyond the seeded
 * pair depends on the difficulty) or a fresh trap where the old plan wanted one. An order costs supplies at once
 * and is raised by a builder standing at the site (the commander sends builders while works are
 * pending); a work nobody reaches for a long while gets finished anyway so the purse never sits idle.
 * Repairs are not works: every bot patches holes on its own.
 */
export type WorkKind = 'engine' | 'trap';

export interface Work {
  id: number;
  kind: WorkKind;
  cell: Cell;
  site: THREE.Vector3;
  engineKind?: EngineKind;
  trapKind?: TrapKind;
  cost: number;
  /** Seconds of a builder's presence so far, and seconds since the order. */
  progress: number;
  age: number;
  need: number;
}

export interface WorksHost {
  war: WarState;
  plot: Plot;
  enemyPlot: Plot;
  entities: () => Entity[];
  roofSpots: () => Cell[];
  trapOrders: () => TrapOrder[];
  engines: EngineSystem;
  traps: TrapSystem;
  /** Engines are a siege thing; a Fortress War commander only re-arms traps. */
  siege: boolean;
}

export const WORKS = {
  maxPending: 2,
  /** Seconds between decisions and extra engines over the seeded pair, by the commander's ambition (easy, normal, hard). */
  thinkEvery: [8, 5, 3],
  maxAddedEngines: [0, 1, 2],
  /** Supplies kept back for repairs. */
  reserve: 10,
  engineTime: 8,
  trapTime: 5,
  /** A work no builder reached is finished after this long anyway. */
  giveUp: 45,
  builderReach: 4.5,
  trapPrice: 4,
} as const;

let nextWorkId = 1;

export class Works {
  readonly works: Work[] = [];
  private timer = 1.5;
  private addedEngines = 0;
  private trapCursor = 0;
  private rng: Random;
  /** Finished works this match (and how many of them were traps), for the summary and probes. */
  done = 0;
  doneTraps = 0;

  constructor(
    readonly team: number,
    private host: WorksHost,
    seed = 1,
    /** 0 easy (traps only, slow), 1 normal (one engine), 2 hard (two engines, quick). */
    readonly ambition = 1,
  ) {
    this.rng = new Random(seed);
  }

  /** The commander's ambition for a difficulty setting. */
  static ambitionFor(difficulty: string): number {
    return difficulty === 'easy' ? 0 : difficulty === 'hard' || difficulty === 'nightmare' ? 2 : 1;
  }

  get pending(): number {
    return this.works.length;
  }

  /** The nearest pending work site to a builder, or null when nothing is ordered. */
  siteFor(e: Entity): THREE.Vector3 | null {
    let best: Work | null = null;
    let bd = Infinity;
    for (const w of this.works) {
      const d = w.site.distanceTo(e.pos);
      if (d < bd) {
        bd = d;
        best = w;
      }
    }
    return best ? best.site : null;
  }

  update(dt: number): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = WORKS.thinkEvery[this.ambition] ?? 5;
      this.think();
    }
    if (!this.works.length) return;
    const builders = this.host.entities().filter((e) => e.alive && e.isBot && e.team === this.team && e.task === 'build');
    for (let i = this.works.length - 1; i >= 0; i--) {
      const w = this.works[i];
      w.age += dt;
      if (builders.some((b) => Math.hypot(b.pos.x - w.site.x, b.pos.z - w.site.z) < WORKS.builderReach && Math.abs(b.pos.y - w.site.y) < 4)) w.progress += dt;
      if (w.progress >= w.need || w.age >= WORKS.giveUp) {
        this.works.splice(i, 1);
        this.finish(w);
      }
    }
  }

  private think(): void {
    if (this.works.length >= WORKS.maxPending) return;
    const purse = this.host.war.supplies[this.team] - WORKS.reserve;
    if (this.host.siege && this.addedEngines < (WORKS.maxAddedEngines[this.ambition] ?? 1) && !this.works.some((w) => w.kind === 'engine')) {
      const live = this.host.engines.engines.filter((e) => e.team === this.team && !e.dead);
      const kind: EngineKind = live.filter((e) => e.kind === 'ballista').length <= live.filter((e) => e.kind === 'catapult').length ? 'ballista' : 'catapult';
      const cost = ENGINE[kind].cost;
      if (purse >= cost) {
        const cell = this.engineSpot(kind);
        if (cell && this.host.war.spend(this.team, cost)) {
          this.addedEngines++;
          this.works.push(this.order('engine', cell, cost, WORKS.engineTime, { engineKind: kind }));
          return;
        }
      }
    }
    // A trap where the plan wanted one, if the plot still has a slot and the purse allows.
    const orders = this.host.trapOrders();
    if (!orders.length) return;
    const plot = this.host.plot.index;
    for (let n = 0; n < orders.length; n++) {
      const o = orders[(this.trapCursor + n) % orders.length];
      const price = TRAP_COST[o.kind] * WORKS.trapPrice;
      if (purse < price) break;
      if (this.host.traps.slotsUsed(plot) + TRAP_COST[o.kind] > this.host.traps.slotsFor(plot)) continue;
      const cands = this.rng.shuffle(o.cands).slice(0, 16);
      const cell = cands.find((c) => this.host.traps.canPlace(o.kind, c, plot) === null && !this.works.some((w) => w.cell.x === c.x && w.cell.y === c.y && w.cell.z === c.z));
      if (!cell) continue;
      if (!this.host.war.spend(this.team, price)) break;
      this.trapCursor = (this.trapCursor + n + 1) % orders.length;
      this.works.push(this.order('trap', cell, price, WORKS.trapTime, { trapKind: o.kind }));
      return;
    }
  }

  /** A roof spot facing the enemy where the engine may stand. */
  private engineSpot(kind: EngineKind): Cell | null {
    const enemy = this.host.enemyPlot;
    const spots = [...this.host.roofSpots()].sort((a, b) => Math.hypot(a.x - enemy.cx, a.z - enemy.cz) - Math.hypot(b.x - enemy.cx, b.z - enemy.cz));
    for (const c of spots) if (this.host.engines.canPlace(kind, c, this.host.plot.index) === null && !this.works.some((w) => w.cell.x === c.x && w.cell.z === c.z)) return c;
    return null;
  }

  private order(kind: WorkKind, cell: Cell, cost: number, need: number, extra: Partial<Work>): Work {
    return { id: nextWorkId++, kind, cell, site: new THREE.Vector3(cell.x + 0.5, cell.y, cell.z + 0.5), cost, progress: 0, age: 0, need, ...extra };
  }

  private finish(w: Work): void {
    const plot = this.host.plot.index;
    let ok = false;
    if (w.kind === 'engine' && w.engineKind) {
      const enemy = this.host.enemyPlot;
      const yaw = Math.atan2(-(enemy.cx - w.site.x), -(enemy.cz - w.site.z));
      ok = typeof this.host.engines.place(w.engineKind, w.cell, this.team, plot, yaw) !== 'string';
      if (!ok) this.addedEngines = Math.max(0, this.addedEngines - 1);
    } else if (w.kind === 'trap' && w.trapKind) {
      const owner = this.host.entities().find((e) => e.isBot && e.team === this.team);
      ok = typeof this.host.traps.place(w.trapKind, w.cell, plot, owner ? owner.id : -1) !== 'string';
    }
    if (ok) {
      this.done++;
      if (w.kind === 'trap') this.doneTraps++;
    } else this.host.war.supplies[this.team] += w.cost; // the site was taken meanwhile: money back
  }

  clear(): void {
    this.works.length = 0;
  }
}
