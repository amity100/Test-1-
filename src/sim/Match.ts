import * as THREE from 'three';
import { Emitter } from '../core/Events';
import type { Entity, Role } from './Entities';
import type { StyleId } from '../world/Styles';
import type { Cell } from '../world/Reachability';
import { Random } from '../core/Random';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'nightmare';
export type Phase = 'lobby' | 'build' | 'fortify' | 'roundIntro' | 'round' | 'roundEnd' | 'podium';

export interface MatchConfig {
  playerName: string;
  botCount: number;
  difficulty: Difficulty;
  /** Seconds; 0 = unlimited. */
  buildTime: number;
  roundTime: number;
  style: StyleId;
}

export interface FlagInfo {
  plotIndex: number;
  cell: Cell;
  pos: THREE.Vector3;
}

export interface SpawnResolver {
  /** Where an entity appears for the current round: defenders inside the contested fortress, attackers at their own. */
  spawnFor(entity: Entity, role: Role, targetPlotIndex: number): THREE.Vector3;
}

export type ScoreReason = 'capture' | 'hold' | 'kill' | 'killDefender' | 'defense' | 'holdMinute';

export interface MatchEvents extends Record<string, unknown> {
  phase: { phase: Phase; prev: Phase };
  roundStart: { round: number; total: number; defender: Entity; plotIndex: number };
  roundEnd: { reason: 'captured' | 'timeout'; defender: Entity; capturer: Entity | null; plotIndex: number; round: number; total: number };
  score: { entity: Entity; delta: number; reason: ScoreReason };
  spawn: { entity: Entity; initial: boolean };
  captureProgress: { entity: Entity; progress: number; contested: boolean };
  buildTimeUp: Record<string, never>;
  /** The trap-setting walk ran out of time. */
  fortifyTimeUp: Record<string, never>;
  /** Someone started (on) or stopped (off) taking the flag; entity is the capturer while on. */
  alarm: { entity: Entity | null; on: boolean };
  /** The clock ran out mid-capture: the round continues without respawns until it is decided. */
  overtime: Record<string, never>;
}

export const SCORE = {
  defensePer10s: 1,
  hold: 40,
  capture: 50,
  kill: 5,
  killAsDefender: 8,
  /** Every full minute the flag stays safe pays the defender (a comeback for a losing defender). */
  holdMinute: 15,
};

export const RULES = {
  captureTime: 3,
  captureRadius: 2.7,
  captureHeight: 2.4,
  respawnAttacker: 5,
  respawnDefender: 12,
  introTime: 7,
  summaryTime: 7,
  /** Longest overtime before the fortress is simply held. */
  overtimeMax: 25,
  /** Capture progress (seconds) that trips the alarm. */
  alarmAt: 0.05,
  /** Seconds to walk the fortress and set traps after the build (unlimited when the build was). */
  fortifyTime: 75,
};

/** Match rules and phase machine. Rendering/UI subscribe to its events. */
export class Match {
  readonly events = new Emitter<MatchEvents>();
  phase: Phase = 'lobby';
  entities: Entity[] = [];
  flags = new Map<number, FlagInfo>();
  spawns = new Map<number, THREE.Vector3>();
  roundOrder: number[] = [];
  roundIndex = -1;
  roundTimer = 0;
  buildTimer = 0;
  fortifyTimer = 0;
  phaseTimer = 0;
  defender: Entity | null = null;
  targetPlotIndex = -1;
  lastRound: MatchEvents['roundEnd'] | null = null;
  /** Whoever is taking the flag right now (alarm on), or null. */
  alarmEntity: Entity | null = null;
  overtime = false;
  private overtimeTimer = 0;
  private rng: Random;
  private captureAccum = new Map<number, number>();

  constructor(readonly config: MatchConfig, private resolver: SpawnResolver, seed = Date.now()) {
    this.rng = new Random(seed >>> 0);
  }

  setEntities(list: Entity[]): void {
    this.entities = list;
  }

  setFlag(plotIndex: number, cell: Cell): void {
    this.flags.set(plotIndex, { plotIndex, cell, pos: new THREE.Vector3(cell.x + 0.5, cell.y, cell.z + 0.5) });
  }

  setSpawn(plotIndex: number, cell: Cell): void {
    this.spawns.set(plotIndex, new THREE.Vector3(cell.x + 0.5, cell.y + 0.02, cell.z + 0.5));
  }

  private setPhase(p: Phase): void {
    const prev = this.phase;
    this.phase = p;
    this.phaseTimer = 0;
    this.events.emit('phase', { phase: p, prev });
  }

  startBuild(): void {
    this.buildTimer = this.config.buildTime;
    this.setPhase('build');
  }

  get buildTimeLeft(): number | null {
    return this.config.buildTime > 0 ? Math.max(0, this.buildTimer) : null;
  }

  /** Ends the build phase: the builder walks their fortress and sets traps before the rounds start. */
  finishBuild(): void {
    this.fortifyTimer = this.config.buildTime > 0 ? RULES.fortifyTime : 0;
    this.setPhase('fortify');
  }

  get fortifyTimeLeft(): number | null {
    return this.config.buildTime > 0 ? Math.max(0, this.fortifyTimer) : null;
  }

  /** Ends the trap walk and schedules rounds (one per entity, shuffled). */
  finishFortify(): void {
    if (this.phase !== 'fortify') return;
    this.roundOrder = this.rng.shuffle(this.entities.map((_, i) => i));
    this.roundIndex = -1;
    this.nextRound();
  }

  private nextRound(): void {
    this.roundIndex++;
    if (this.roundIndex >= this.roundOrder.length) {
      this.defender = null;
      this.targetPlotIndex = -1;
      this.setPhase('podium');
      return;
    }
    const defender = this.entities[this.roundOrder[this.roundIndex]];
    this.defender = defender;
    this.targetPlotIndex = defender.plotIndex;
    for (const e of this.entities) {
      e.role = e === defender ? 'defender' : 'attacker';
      e.captureProgress = 0;
    }
    this.captureAccum.clear();
    this.alarmEntity = null;
    this.overtime = false;
    this.overtimeTimer = 0;
    this.setPhase('roundIntro');
  }

  private beginRound(now: number): void {
    this.roundTimer = this.config.roundTime;
    for (const e of this.entities) {
      e.reset();
      e.deadSince = -1;
      e.pos.copy(this.resolver.spawnFor(e, e.role, this.targetPlotIndex));
      // Face the target fortress.
      const flag = this.currentFlag;
      if (flag) {
        const dx = flag.pos.x - e.pos.x;
        const dz = flag.pos.z - e.pos.z;
        e.yaw = Math.atan2(-dx, -dz);
        e.pitch = 0;
      }
      this.events.emit('spawn', { entity: e, initial: true });
    }
    void now;
    this.setPhase('round');
    this.events.emit('roundStart', { round: this.roundIndex + 1, total: this.roundOrder.length, defender: this.defender!, plotIndex: this.targetPlotIndex });
  }

  get currentFlag(): FlagInfo | null {
    return this.flags.get(this.targetPlotIndex) ?? null;
  }

  get timeLeft(): number {
    return Math.max(0, this.roundTimer);
  }

  /** Called by the game when an entity dies. Scores kills and schedules respawn. */
  onKill(victim: Entity, killer: Entity | null, now: number): void {
    if (this.phase !== 'round') return;
    if (killer && killer !== victim) {
      killer.score.kills++;
      const asDefender = killer.role === 'defender';
      if (asDefender) killer.score.killsAsDefender++;
      const delta = asDefender ? SCORE.killAsDefender : SCORE.kill;
      this.recompute(killer);
      this.events.emit('score', { entity: killer, delta, reason: asDefender ? 'killDefender' : 'kill' });
    }
    victim.respawnAt = now + (victim.role === 'defender' ? RULES.respawnDefender : RULES.respawnAttacker);
  }

  recompute(e: Entity): void {
    const s = e.score;
    s.total =
      Math.floor(s.defenseSeconds / 10) * SCORE.defensePer10s +
      s.holdBonuses * SCORE.hold +
      s.holdMinutes * SCORE.holdMinute +
      s.captures * SCORE.capture +
      (s.kills - s.killsAsDefender) * SCORE.kill +
      s.killsAsDefender * SCORE.killAsDefender;
  }

  standings(): Entity[] {
    return [...this.entities].sort((a, b) => b.score.total - a.score.total || b.score.captures - a.score.captures || b.score.kills - a.score.kills);
  }

  update(dt: number, now: number): void {
    this.phaseTimer += dt;
    switch (this.phase) {
      case 'build':
        if (this.config.buildTime > 0) {
          this.buildTimer -= dt;
          if (this.buildTimer <= 0) {
            this.buildTimer = 0;
            this.events.emit('buildTimeUp', {});
          }
        }
        break;
      case 'fortify':
        if (this.config.buildTime > 0) {
          this.fortifyTimer -= dt;
          if (this.fortifyTimer <= 0) {
            this.fortifyTimer = 0;
            this.events.emit('fortifyTimeUp', {});
          }
        }
        break;
      case 'roundIntro':
        if (this.phaseTimer >= RULES.introTime) this.beginRound(now);
        break;
      case 'round':
        this.updateRound(dt, now);
        break;
      case 'roundEnd':
        if (this.phaseTimer >= RULES.summaryTime) this.nextRound();
        break;
      default:
        break;
    }
  }

  private updateRound(dt: number, now: number): void {
    const defender = this.defender!;
    const flag = this.currentFlag;
    this.roundTimer -= dt;
    // Defense time accrues while the flag is safe.
    const beforeTicks = Math.floor(defender.score.defenseSeconds / 10);
    defender.score.defenseSeconds += dt;
    const afterTicks = Math.floor(defender.score.defenseSeconds / 10);
    if (afterTicks > beforeTicks) {
      this.recompute(defender);
      this.events.emit('score', { entity: defender, delta: SCORE.defensePer10s * (afterTicks - beforeTicks), reason: 'defense' });
    }
    const minutes = Math.floor(defender.score.defenseSeconds / 60);
    if (minutes > defender.score.holdMinutes) {
      defender.score.holdMinutes = minutes;
      this.recompute(defender);
      this.events.emit('score', { entity: defender, delta: SCORE.holdMinute, reason: 'holdMinute' });
    }
    // Respawns (none during overtime: the round is decided by whoever is still standing)
    if (!this.overtime) for (const e of this.entities) {
      if (!e.alive && e.respawnAt > 0 && now >= e.respawnAt) {
        e.reset();
        e.respawnAt = 0;
        e.pos.copy(this.resolver.spawnFor(e, e.role, this.targetPlotIndex));
        if (flag) {
          e.yaw = Math.atan2(-(flag.pos.x - e.pos.x), -(flag.pos.z - e.pos.z));
          e.pitch = 0;
        }
        this.events.emit('spawn', { entity: e, initial: false });
      }
    }
    // Capture
    if (flag) {
      const defenderNear = defender.alive && this.nearFlag(defender, flag);
      let captured: Entity | null = null;
      for (const e of this.entities) {
        if (e === defender) continue;
        const near = e.alive && this.nearFlag(e, flag);
        let prog = e.captureProgress;
        if (near && !defenderNear) prog += dt;
        else if (!near) prog = Math.max(0, prog - dt * 1.5);
        if (prog !== e.captureProgress || near) {
          e.captureProgress = prog;
          this.events.emit('captureProgress', { entity: e, progress: Math.min(1, prog / RULES.captureTime), contested: near && defenderNear });
        }
        if (prog >= RULES.captureTime && !captured) captured = e;
      }
      if (captured) {
        this.endRound('captured', captured);
        return;
      }
      this.updateAlarm(defender);
    }
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      const contest = this.entities.some((e) => e !== defender && e.alive && e.captureProgress > 0);
      if (!this.overtime) {
        if (contest) {
          this.overtime = true;
          this.overtimeTimer = 0;
          this.events.emit('overtime', {});
        } else this.endRound('timeout', null);
      } else {
        this.overtimeTimer += dt;
        if (!contest || this.overtimeTimer > RULES.overtimeMax) this.endRound('timeout', null);
      }
    }
  }

  /** The alarm follows whoever is furthest into taking the flag, and stops when nobody is. */
  private updateAlarm(defender: Entity): void {
    let best: Entity | null = null;
    for (const e of this.entities) {
      if (e === defender || !e.alive || e.captureProgress < RULES.alarmAt) continue;
      if (!best || e.captureProgress > best.captureProgress) best = e;
    }
    if (best === this.alarmEntity) return;
    if (best) {
      this.alarmEntity = best;
      this.events.emit('alarm', { entity: best, on: true });
    } else {
      this.alarmEntity = null;
      this.events.emit('alarm', { entity: null, on: false });
    }
  }

  private nearFlag(e: Entity, flag: FlagInfo): boolean {
    const dx = e.pos.x - flag.pos.x;
    const dz = e.pos.z - flag.pos.z;
    const dy = e.pos.y - flag.pos.y;
    return dx * dx + dz * dz <= RULES.captureRadius * RULES.captureRadius && dy > -1.2 && dy < RULES.captureHeight;
  }

  private endRound(reason: 'captured' | 'timeout', capturer: Entity | null): void {
    const defender = this.defender!;
    if (reason === 'captured' && capturer) {
      capturer.score.captures++;
      this.recompute(capturer);
      this.events.emit('score', { entity: capturer, delta: SCORE.capture, reason: 'capture' });
    } else {
      defender.score.holdBonuses++;
      this.recompute(defender);
      this.events.emit('score', { entity: defender, delta: SCORE.hold, reason: 'hold' });
    }
    for (const e of this.entities) e.captureProgress = 0;
    if (this.alarmEntity) {
      this.alarmEntity = null;
      this.events.emit('alarm', { entity: null, on: false });
    }
    this.overtime = false;
    const payload: MatchEvents['roundEnd'] = { reason, defender, capturer, plotIndex: this.targetPlotIndex, round: this.roundIndex + 1, total: this.roundOrder.length };
    this.lastRound = payload;
    this.setPhase('roundEnd');
    this.events.emit('roundEnd', payload);
  }

  /** Skips the remaining summary time. */
  skipSummary(): void {
    if (this.phase === 'roundEnd') this.nextRound();
  }
}
