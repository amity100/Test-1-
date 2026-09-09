import type { Builder } from './Builder';
import { Plan, GRID, MAX_BLOCKS, CELL, frontSideOf, type Tone } from './Architect';
import { planFortress } from '../world/FortressGen';
import type { Entity } from '../sim/Entities';
import type { Plot } from '../world/Layout';
import type { StyleId } from '../world/Styles';
import type { Random } from '../core/Random';
import { TRAP_COST, type TrapSystem, type TrapKind } from '../sim/Traps';

/** One trap to set: the kind and where it may go, in priority order (the same plan a seeded fortress follows). */
export interface TrapOrder {
  kind: TrapKind;
  cands: Cell[];
  done?: boolean;
}
import type { Cell } from '../world/Reachability';

/** Blocks kept free for the human until this many seconds into the build. */
const RESERVE = 12;
const RESERVE_UNTIL = 60;
/** Traps each bot sets during the walk, and the slot budget (trap cost units) it may spend on them. */
export const BOT_TRAPS = 2;
export const BOT_SLOTS = 3;

interface Worker {
  bot: Entity;
  sector: number;
  queue: [number, number, number][];
  timer: number;
  next: [number, number, number] | null;
  trapsLeft: number;
  trapTimer: number;
}

/**
 * The team builds the fortress together. Each bot owns a quarter of the plot and lays the stronghold
 * plan for it one room every couple of seconds, so the human sees the castle rise around their own
 * blocks; commander pings ("a tower here") are picked up by the nearest builder first, a share of the
 * budget stays free for the human for the first minute, and in the trap walk every bot sets its own
 * traps in its quarter.
 */
export class TeamBuild {
  private workers: Worker[] = [];
  private target: Plan;
  private elapsed = 0;
  active = false;
  private towerTone: Tone;

  constructor(
    private builder: Builder,
    bots: Entity[],
    style: StyleId,
    private rng: Random,
    private plot: Plot,
  ) {
    this.target = planFortress(rng, style, MAX_BLOCKS, 'stronghold', frontSideOf(plot));
    // The corner towers' tone doubles as the ping tone.
    this.towerTone = this.target.has(0, 0, 1) ? this.target.tone(0, 0, 1) : 1;
    bots.forEach((bot, n) => {
      const sector = n % 4;
      const cells = this.target.occupied().filter(([i, j]) => TeamBuild.sectorOf(i, j) === sector);
      const c = TeamBuild.sectorCentre(sector);
      cells.sort((a, b) => a[2] - b[2] || Math.abs(a[0] - c[0]) + Math.abs(a[1] - c[1]) - (Math.abs(b[0] - c[0]) + Math.abs(b[1] - c[1])));
      this.workers.push({ bot, sector, queue: cells, timer: 1 + n * 0.4, next: null, trapsLeft: BOT_TRAPS, trapTimer: 1 + n * 1.1 });
    });
  }

  /** Seconds between a worker's rooms: a long share is laid faster so every quarter finishes in about 45 s. */
  private interval(w: Worker): number {
    const left = w.queue.length + (w.next ? 1 : 0);
    return Math.max(1.1, Math.min(3.4, 45 / Math.max(1, left))) * this.rng.range(0.85, 1.15);
  }

  /** Quarter of the plot a plan column belongs to (the middle column and row go to the sector on their side). */
  static sectorOf(i: number, j: number): number {
    return (i < 2.5 ? 0 : 1) + (j < 2.5 ? 0 : 2);
  }
  static sectorCentre(sector: number): [number, number] {
    return [sector % 2 === 0 ? 1 : 3, sector < 2 ? 1 : 3];
  }

  /** The bots' next cells (for the ghost markers). */
  cursors(): { bot: Entity; i: number; j: number; k: number }[] {
    const out: { bot: Entity; i: number; j: number; k: number }[] = [];
    for (const w of this.workers) if (w.next) out.push({ bot: w.bot, i: w.next[0], j: w.next[1], k: w.next[2] });
    return out;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.elapsed += dt;
    const plan = this.builder.plan;
    const reserved = this.elapsed < RESERVE_UNTIL ? RESERVE : 0;
    for (const w of this.workers) {
      w.timer -= dt;
      if (!w.next) w.next = this.pick(w);
      if (w.timer > 0 || !w.next) continue;
      w.timer = this.interval(w);
      if (plan.count() + reserved >= MAX_BLOCKS) continue;
      const [i, j, k] = w.next;
      const tone = this.target.has(i, j, k) ? this.target.tone(i, j, k) : this.towerTone;
      if (!plan.has(i, j, k)) {
        if (k === 0 || plan.has(i, j, k - 1)) this.builder.addBlock(i, j, k, tone, w.bot.id);
        else if (this.target.has(i, j, k)) w.queue.push(w.next); // nothing under it yet (another worker's share): come back later
      }
      w.next = null;
    }
  }

  /** The next cell for a worker: a pinged column in reach first, then its own queue. */
  private pick(w: Worker): [number, number, number] | null {
    const plan = this.builder.plan;
    for (const p of this.builder.pings) {
      if (TeamBuild.sectorOf(p.i, p.j) !== w.sector && !this.workers.every((o) => o === w || TeamBuild.sectorOf(p.i, p.j) !== o.sector)) continue;
      let k = 0;
      while (k < 3 && plan.has(p.i, p.j, k)) k++;
      if (k >= 3) {
        this.builder.togglePing(p.i, p.j);
        continue;
      }
      return [p.i, p.j, k];
    }
    while (w.queue.length) {
      const c = w.queue.shift()!;
      if (!plan.has(c[0], c[1], c[2])) return c;
    }
    return null;
  }

  get done(): boolean {
    return this.workers.every((w) => w.queue.length === 0 && !w.next);
  }

  /**
   * The commander called Ready before the crew was through: everyone lays the rest of their share at
   * once (lowest storeys first so nothing floats), as far as the budget allows. Pings are dropped.
   */
  finishAll(): number {
    const plan = this.builder.plan;
    const rest: [number, number, number][] = [];
    for (const w of this.workers) {
      if (w.next) rest.push(w.next);
      rest.push(...w.queue);
      w.next = null;
      w.queue = [];
    }
    rest.sort((a, b) => a[2] - b[2]);
    let placed = 0;
    for (const [i, j, k] of rest) {
      if (plan.count() >= MAX_BLOCKS) break;
      if (plan.has(i, j, k) || (k > 0 && !plan.has(i, j, k - 1))) continue;
      if (this.builder.addBlock(i, j, k, this.target.tone(i, j, k), this.workers[0]?.bot.id ?? -1)) placed++;
    }
    return placed;
  }

  // ---------------------------------------------------------------- trap walk
  /**
   * During the fortify walk every bot sets its traps, one every second or so, following the same plan a
   * seeded fortress gets (a door trap first, a turret in the flag hall, then the mixed pool): the first
   * open order with a spot in the bot's own quarter, or the first open order anywhere.
   */
  updateFortify(dt: number, traps: TrapSystem, plotIndex: number, orders: TrapOrder[], reserve: number): void {
    for (const w of this.workers) {
      if (w.trapsLeft <= 0) continue;
      w.trapTimer -= dt;
      if (w.trapTimer > 0) continue;
      w.trapTimer = this.rng.range(0.9, 1.6);
      const inSector = (c: Cell): boolean => TeamBuild.sectorOf(Math.floor((c.x - this.plot.minX) / CELL), Math.floor((c.z - this.plot.minZ) / CELL)) === w.sector;
      // The human's personal slots stay free, and every bot has its own slot budget, so a bot can never
      // spend what the human still has coming.
      const spent = traps.slotsUsedBy(plotIndex, w.bot.id);
      const fits = (o: TrapOrder): boolean => spent + TRAP_COST[o.kind] <= BOT_SLOTS && traps.slotsUsed(plotIndex) + TRAP_COST[o.kind] <= traps.slotsFor(plotIndex) - reserve;
      const open = orders.filter((o) => !o.done && o.cands.length && fits(o));
      if (!open.length) {
        w.trapsLeft = 0;
        continue;
      }
      const order = open.find((o) => o.cands.some(inSector)) ?? open[0];
      order.done = true;
      const mine = order.cands.filter(inSector);
      const cands = mine.length ? mine : order.cands;
      let placed = false;
      for (const c of this.rng.shuffle(cands).slice(0, 24)) {
        if (typeof traps.place(order.kind, c, plotIndex, w.bot.id) !== 'string') {
          placed = true;
          break;
        }
      }
      if (placed) w.trapsLeft--;
    }
  }

  get trapsDone(): boolean {
    return this.workers.every((w) => w.trapsLeft <= 0);
  }
}

export { GRID };
