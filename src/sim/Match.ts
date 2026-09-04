import * as THREE from 'three';
import { Emitter } from '../core/Events';
import type { Entity } from './Entities';
import type { StyleId } from '../world/Styles';
import type { Cell } from '../world/Reachability';
import { Random } from '../core/Random';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'nightmare';
export type Phase = 'lobby' | 'build' | 'roundIntro' | 'round' | 'roundEnd' | 'podium';

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
  attackerSpawn(plotIndex: number, slot: number, total: number): THREE.Vector3;
  defenderSpawn(plotIndex: number): THREE.Vector3;
}

export type ScoreReason = 'capture' | 'hold' | 'kill' | 'killDefender' | 'defense';

export interface MatchEvents extends Record<string, unknown> {
  phase: { phase: Phase; prev: Phase };
  roundStart: { round: number; total: number; defender: Entity; plotIndex: number };
  roundEnd: { reason: 'captured' | 'timeout'; defender: Entity; capturer: Entity | null; plotIndex: number; round: number; total: number };
  score: { entity: Entity; delta: number; reason: ScoreReason };
  spawn: { entity: Entity; initial: boolean };
  captureProgress: { entity: Entity; progress: number; contested: boolean };
  buildTimeUp: Record<string, never>;
}

export const SCORE = {
  defensePer10s: 1,
  hold: 40,
  capture: 50,
  kill: 5,
  killAsDefender: 8,
};

export const RULES = {
  captureTime: 3,
  captureRadius: 2.7,
  captureHeight: 2.4,
  respawnAttacker: 5,
  respawnDefender: 12,
  introTime: 5,
  summaryTime: 7,
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
  phaseTimer = 0;
  defender: Entity | null = null;
  targetPlotIndex = -1;
  lastRound: MatchEvents['roundEnd'] | null = null;
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

  /** Ends the build phase and schedules rounds (one per entity, shuffled). */
  finishBuild(): void {
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
    this.setPhase('roundIntro');
  }

  private beginRound(now: number): void {
    this.roundTimer = this.config.roundTime;
    let slot = 0;
    const attackers = this.entities.filter((e) => e !== this.defender);
    for (const e of this.entities) {
      e.reset();
      e.deadSince = -1;
      if (e === this.defender) e.pos.copy(this.resolver.defenderSpawn(this.targetPlotIndex));
      else e.pos.copy(this.resolver.attackerSpawn(this.targetPlotIndex, slot++, attackers.length));
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
    s.total = Math.floor(s.defenseSeconds / 10) * SCORE.defensePer10s + s.holdBonuses * SCORE.hold + s.captures * SCORE.capture + (s.kills - s.killsAsDefender) * SCORE.kill + s.killsAsDefender * SCORE.killAsDefender;
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
    // Respawns
    for (const e of this.entities) {
      if (!e.alive && e.respawnAt > 0 && now >= e.respawnAt) {
        e.reset();
        e.respawnAt = 0;
        if (e === defender) e.pos.copy(this.resolver.defenderSpawn(this.targetPlotIndex));
        else {
          const slot = this.entities.indexOf(e);
          e.pos.copy(this.resolver.attackerSpawn(this.targetPlotIndex, slot, this.entities.length));
        }
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
    }
    if (this.roundTimer <= 0) this.endRound('timeout', null);
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
