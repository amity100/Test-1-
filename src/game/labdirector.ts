import type { KillEvent } from '../core/contracts';
import type { LabArena, LabGate, LabSpawn, LabWave } from '../world/combatlab/layout';
import { chosenVariant, setVariant, type CombatVariant } from './variant';

/** What a lab kill is credited to (the run's KILLS BY TOOL). */
export type LabTool = 'grab' | 'reflect' | 'loop' | 'swap' | 'dash' | 'blade' | 'other';
export const LAB_TOOLS: readonly LabTool[] = ['grab', 'reflect', 'loop', 'swap', 'dash', 'blade', 'other'];

/**
 * The tool behind a kill. STRIKES by name (LOOP's geyser and cannon are LOOP),
 * the hidden blade by its cut, anything your PORTAL pair moved (a man grabbed
 * and thrown, a load dropped, fire sent back through a door) as GRAB / THROW,
 * the rest (a barrel, a stray shot, a fall of his own) as OTHER.
 */
export function killTool(ev: Pick<KillEvent, 'strike' | 'cause' | 'viaTrapdoor' | 'victimCrossings' | 'killerCrossings' | 'charged'>): LabTool {
  switch (ev.strike) {
    case 'reflect': return 'reflect';
    case 'loop':
    case 'geyser':
    case 'cannon': return 'loop';
    case 'swap': return 'swap';
    case 'dash': return 'dash';
  }
  if (ev.cause === 'blade') return 'blade';
  if (ev.viaTrapdoor || ev.victimCrossings > 0 || (ev.charged && ev.killerCrossings > 0)) return 'grab';
  return 'other';
}

export interface LabWaveStats {
  /** Seconds from the first man through to the last one down (0 until it's cleared). */
  time: number;
  damage: number;
  deaths: number;
  kills: number;
  cleared: boolean;
}

export interface LabRunStats {
  variant: CombatVariant;
  /** Seconds since the run started (breathers included), until W5 is cleared. */
  total: number;
  damage: number;
  deaths: number;
  kills: Record<LabTool, number>;
  waves: LabWaveStats[];
  /** All waves cleared. */
  done: boolean;
}

export type LabPhase = 'idle' | 'breather' | 'fight' | 'done';

export interface LabDirectorHooks {
  /** Bring one man in (through `gate`); returns his enemy id. */
  spawn(s: LabSpawn, gate: LabGate, wave: number): number;
  alive(id: number): boolean;
  /** A breather started: the WAVE n banner (n from 1), `secs` before the first man comes through. */
  announce?(wave: number, def: LabWave, secs: number): void;
  /** Wave n (from 1) is cleared in `time` s. */
  cleared?(wave: number, time: number): void;
  /** The last wave is down: the results. */
  finished?(stats: LabRunStats): void;
}

export const LAB_TIMING = {
  /** Before W1: the banner and a beat to look around. */
  first: 3.5,
  /** Between waves. */
  breather: 3,
  /** Men of one gate step through this far apart (s). */
  spacing: 0.6,
};

const zeroKills = (): Record<LabTool, number> => ({ grab: 0, reflect: 0, loop: 0, swap: 0, dash: 0, blade: 0, other: 0 });

/**
 * The lab's WAVE DIRECTOR: a fixed escalating sequence, a breather with a
 * banner before each wave, the men of each gate brought in one by one, a wave
 * cleared when all of its men are down, the results after the last. It keeps
 * the run's stats (time per wave, total, damage, deaths, kills by tool).
 * Timing is real time (slow motion doesn't stretch a split).
 */
export class LabDirector {
  phase: LabPhase = 'idle';
  /** Current wave, 0-based (the banner says wave + 1). */
  wave = 0;
  /** Seconds left in the breather. */
  breatherT = 0;
  /** Seconds into the current wave's fight. */
  waveT = 0;
  stats: LabRunStats;
  /** Ids of the current wave's men brought in so far. */
  readonly ids: number[] = [];
  private queue: { spawn: LabSpawn; t: number }[] = [];

  constructor(readonly arena: LabArena, private hooks: LabDirectorHooks) {
    this.stats = this.freshStats();
  }

  get waveCount() {
    return this.arena.waves.length;
  }

  private freshStats(): LabRunStats {
    return {
      variant: chosenVariant(),
      total: 0,
      damage: 0,
      deaths: 0,
      kills: zeroKills(),
      waves: this.arena.waves.map(() => ({ time: 0, damage: 0, deaths: 0, kills: 0, cleared: false })),
      done: false,
    };
  }

  /** Back to before W1 (nothing running). */
  reset() {
    this.phase = 'idle';
    this.wave = 0;
    this.breatherT = 0;
    this.waveT = 0;
    this.ids.length = 0;
    this.queue.length = 0;
    this.stats = this.freshStats();
  }

  /** A fresh run: W1's banner now, its men after the first breather. */
  start() {
    this.reset();
    this.breathe(0, LAB_TIMING.first);
  }

  /** Switch the combat variant: the run starts over under it. */
  setVariant(v: CombatVariant) {
    setVariant(v);
    this.start();
  }

  /** Men of the current wave still to beat (standing, or still to come through). */
  get left() {
    if (this.phase !== 'fight') return 0;
    let n = this.queue.length;
    for (const id of this.ids) if (this.hooks.alive(id)) n++;
    return n;
  }

  get running() {
    return this.phase === 'breather' || this.phase === 'fight';
  }

  update(dt: number) {
    if (!this.running) return;
    this.stats.total += dt;
    if (this.phase === 'breather') {
      this.breatherT -= dt;
      if (this.breatherT <= 0) this.fight();
      return;
    }
    this.waveT += dt;
    this.stats.waves[this.wave].time = this.waveT;
    for (let i = 0; i < this.queue.length; ) {
      const q = this.queue[i];
      q.t -= dt;
      if (q.t > 0) {
        i++;
        continue;
      }
      this.queue.splice(i, 1);
      const gate = this.arena.gates.find((g) => g.id === q.spawn.gate);
      if (!gate) continue;
      this.ids.push(this.hooks.spawn(q.spawn, gate, this.wave + 1));
    }
    if (this.queue.length || this.ids.some((id) => this.hooks.alive(id))) return;
    // the wave is down
    const w = this.stats.waves[this.wave];
    w.cleared = true;
    w.time = this.waveT;
    this.hooks.cleared?.(this.wave + 1, this.waveT);
    if (this.wave + 1 < this.arena.waves.length) {
      this.breathe(this.wave + 1, LAB_TIMING.breather);
      return;
    }
    this.phase = 'done';
    this.stats.done = true;
    this.hooks.finished?.(this.stats);
  }

  noteKill(tool: LabTool) {
    if (!this.running) return;
    this.stats.kills[tool]++;
    this.stats.waves[this.wave].kills++;
  }

  noteDamage(amount: number) {
    if (!this.running || !(amount > 0)) return;
    this.stats.damage += amount;
    this.stats.waves[this.wave].damage += amount;
  }

  noteDeath() {
    if (!this.running) return;
    this.stats.deaths++;
    this.stats.waves[this.wave].deaths++;
  }

  totalKills() {
    let n = 0;
    for (const k of LAB_TOOLS) n += this.stats.kills[k];
    return n;
  }

  private breathe(wave: number, secs: number) {
    this.phase = 'breather';
    this.wave = wave;
    this.breatherT = secs;
    this.waveT = 0;
    this.ids.length = 0;
    this.queue.length = 0;
    this.hooks.announce?.(wave + 1, this.arena.waves[wave], secs);
  }

  private fight() {
    this.phase = 'fight';
    this.waveT = 0;
    // each gate lets its men through one by one; the gates open together
    const perGate = new Map<string, number>();
    for (const sp of this.arena.waves[this.wave].spawns) {
      const k = perGate.get(sp.gate) ?? 0;
      perGate.set(sp.gate, k + 1);
      this.queue.push({ spawn: sp, t: k * LAB_TIMING.spacing });
    }
  }
}

/** m:ss.t for the lab's splits. */
export function fmtTime(s: number) {
  const d = Math.floor(Math.max(0, s) * 10);
  const m = Math.floor(d / 600);
  const r = (d % 600) / 10;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
}
