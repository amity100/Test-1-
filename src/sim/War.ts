import * as THREE from 'three';
import type { Entity } from './Entities';
import { OUTPOSTS, OUTPOST_RADIUS } from '../world/Layout';

/**
 * Fortress War rules: two teams, two fortresses, three capture points across the middle of the
 * island and a ticket pool per team. Kills cost tickets, holding more outposts than the enemy
 * drains theirs, and looting the enemy flag costs them a big chunk and drops their flag for a while.
 * The first team out of tickets loses; when the clock runs out the higher pool wins.
 */
export const WAR = {
  tickets: 150,
  killCost: 1,
  captureCost: 40,
  /** Seconds an attacker must hold the enemy flag zone with no defender in it. */
  captureTime: 8,
  captureRadius: 3.2,
  captureHeight: 2.6,
  /** Seconds the looted flag stays down before it can be taken again. */
  flagLockout: 20,
  outpostRadius: OUTPOST_RADIUS,
  /** Seconds one team alone on a point needs to take it. */
  outpostTime: 10,
  /** Every this many seconds the team holding fewer points loses one ticket per point of difference. */
  drainEvery: 5,
  roundTime: 720,
  alarmAt: 0.05,
  respawn: 6,
  /** Respawn while our flag is being taken or is down: the garrison rallies fast, at the flag posts. */
  respawnAlarm: 3,
  /** Supplies for live repairs: at the start, per kill, and per owned outpost every few seconds. */
  suppliesStart: 40,
  suppliesKill: 2,
  suppliesOutpost: 3,
  suppliesEvery: 6,
  /** Live repair: supplies per repair, blocks it puts back, seconds by the hole, and how close counts. */
  repairCost: 5,
  repairCells: 16,
  repairTime: 2.5,
  repairRange: 4.5,
};

/**
 * Siege rules: two castles face each other across the plaza. Each flag has three lives; taking it costs
 * a life, and a team out of lives stops respawning and fights its last stand. Each castle has one
 * courtyard zone: whoever holds it draws supplies from it and may respawn there.
 */
export const SIEGE = {
  lives: 3,
  respawn: 3,
  roundTime: 480,
  captureTime: 8,
  flagLockout: 15,
  courtyardRadius: 6.5,
  courtyardTime: 8,
};

export interface Outpost {
  index: number;
  label: string;
  pos: THREE.Vector3;
  /** -1 neutral, else the owning team. */
  owner: number;
  /** Team currently taking it and how far along (0..1). */
  team: number;
  progress: number;
  contested: boolean;
}

export interface WarFlag {
  team: number;
  pos: THREE.Vector3;
}

export interface WarEvents {
  alarm(team: number, on: boolean, capturer: Entity | null): void;
  captured(team: number, by: Entity[]): void;
  outpost(index: number, owner: number, prev: number, by: Entity[]): void;
  tickets(team: number, tickets: number, delta: number, reason: 'kill' | 'capture' | 'drain'): void;
  end(winner: number): void;
}

/** Live state of a Fortress War match (owned by Match, read by the game, HUD and bots). */
export class WarState {
  /** Tickets in a war; flag lives in a siege. */
  readonly tickets: number[];
  /** Deaths per team (siege tie-break). */
  readonly casualties = [0, 0];
  readonly supplies = [WAR.suppliesStart, WAR.suppliesStart];
  readonly flags: (WarFlag | null)[] = [null, null];
  /** Seconds of enemy capture on team T's flag, its lockout after a loot, and who is on it. */
  readonly capture = [0, 0];
  readonly lockout = [0, 0];
  readonly capturer: (Entity | null)[] = [null, null];
  readonly outposts: Outpost[];
  ended = false;
  winner = -1;
  private drainTimer = 0;
  private supplyTimer = 0;

  constructor(
    private events: WarEvents,
    readonly siege = false,
  ) {
    this.tickets = siege ? [SIEGE.lives, SIEGE.lives] : [WAR.tickets, WAR.tickets];
    // A siege has one courtyard per castle, owned by its own team at the start; the game places them.
    this.outposts = siege
      ? [0, 1].map((i) => ({ index: i, label: i === 0 ? 'A' : 'B', pos: new THREE.Vector3(), owner: i, team: -1, progress: 0, contested: false }))
      : OUTPOSTS.map((o, i) => ({ index: i, label: o.label, pos: new THREE.Vector3(o.x, 0, o.z), owner: -1, team: -1, progress: 0, contested: false }));
  }

  /** Seconds on a flag that complete a capture. */
  get captureTime(): number {
    return this.siege ? SIEGE.captureTime : WAR.captureTime;
  }

  /** A team out of flag lives stops respawning. */
  noRespawn(team: number): boolean {
    return this.siege && this.tickets[team] <= 0;
  }

  setFlag(team: number, pos: THREE.Vector3): void {
    this.flags[team] = { team, pos: pos.clone() };
  }

  setOutpostHeight(index: number, y: number): void {
    this.outposts[index].pos.y = y;
  }

  setOutpostPos(index: number, x: number, y: number, z: number): void {
    this.outposts[index].pos.set(x, y, z);
  }

  enemyFlag(team: number): WarFlag | null {
    return this.flags[1 - team] ?? null;
  }

  /** True while the flag of `team` is down after a loot. */
  flagDown(team: number): boolean {
    return this.lockout[team] > 0;
  }

  /** Feet inside a flag zone. */
  nearFlag(e: Entity, team: number): boolean {
    const f = this.flags[team];
    if (!f) return false;
    const dx = e.pos.x - f.pos.x;
    const dz = e.pos.z - f.pos.z;
    const dy = e.pos.y - f.pos.y;
    return dx * dx + dz * dz <= WAR.captureRadius * WAR.captureRadius && dy > -1.2 && dy < WAR.captureHeight;
  }

  nearOutpost(e: Entity, o: Outpost): boolean {
    const dx = e.pos.x - o.pos.x;
    const dz = e.pos.z - o.pos.z;
    const r = this.siege ? SIEGE.courtyardRadius : WAR.outpostRadius;
    return dx * dx + dz * dz <= r * r && Math.abs(e.pos.y - o.pos.y) < 5;
  }

  /** How many points each team holds. */
  owned(team: number): number {
    let n = 0;
    for (const o of this.outposts) if (o.owner === team) n++;
    return n;
  }

  onKill(victim: Entity, killer: Entity | null): void {
    if (this.ended || victim.team < 0) return;
    if (killer && killer.team >= 0 && killer.team !== victim.team) this.supplies[killer.team] += WAR.suppliesKill;
    this.casualties[victim.team]++;
    if (this.siege) return;
    this.tickets[victim.team] = Math.max(0, this.tickets[victim.team] - WAR.killCost);
    this.events.tickets(victim.team, this.tickets[victim.team], -WAR.killCost, 'kill');
    this.checkEnd();
  }

  update(dt: number, entities: Entity[]): void {
    if (this.ended) return;
    for (const team of [0, 1]) this.updateFlag(team, dt, entities);
    for (const o of this.outposts) this.updateOutpost(o, dt, entities);
    // Holding more points than the enemy bleeds their tickets (a war; a siege bleeds lives at the flag only).
    this.drainTimer += dt;
    if (!this.siege && this.drainTimer >= WAR.drainEvery) {
      this.drainTimer = 0;
      const a = this.owned(0);
      const b = this.owned(1);
      if (a !== b) {
        const loser = a > b ? 1 : 0;
        const delta = Math.abs(a - b);
        this.tickets[loser] = Math.max(0, this.tickets[loser] - delta);
        this.events.tickets(loser, this.tickets[loser], -delta, 'drain');
      }
    }
    this.supplyTimer += dt;
    if (this.supplyTimer >= WAR.suppliesEvery) {
      this.supplyTimer = 0;
      for (const team of [0, 1]) this.supplies[team] += this.owned(team) * WAR.suppliesOutpost;
    }
    // Siege: a team out of lives ends when its last soldier falls.
    if (this.siege) for (const team of [0, 1]) if (this.tickets[team] <= 0 && !entities.some((e) => e.team === team && e.alive)) this.finishWith(1 - team);
    this.checkEnd();
  }

  private updateFlag(team: number, dt: number, entities: Entity[]): void {
    const flag = this.flags[team];
    if (!flag) return;
    if (this.lockout[team] > 0) {
      this.lockout[team] -= dt;
      for (const e of entities) if (e.team === 1 - team) e.captureProgress = 0;
      return;
    }
    let defenderNear = false;
    const attackers: Entity[] = [];
    for (const e of entities) {
      if (!e.alive || e.team < 0 || !this.nearFlag(e, team)) continue;
      if (e.team === team) defenderNear = true;
      else attackers.push(e);
    }
    if (attackers.length && !defenderNear) this.capture[team] = Math.min(this.captureTime, this.capture[team] + dt);
    else if (!attackers.length) this.capture[team] = Math.max(0, this.capture[team] - dt * 1.5);
    for (const e of entities) if (e.team === 1 - team) e.captureProgress = attackers.includes(e) ? this.capture[team] : 0;
    // The alarm follows whoever is on the flag.
    const best = attackers.length ? attackers[0] : null;
    if (this.capture[team] >= WAR.alarmAt && best) {
      if (this.capturer[team] !== best) {
        this.capturer[team] = best;
        this.events.alarm(team, true, best);
      }
    } else if (this.capturer[team]) {
      this.capturer[team] = null;
      this.events.alarm(team, false, null);
    }
    if (this.capture[team] >= this.captureTime) {
      this.capture[team] = 0;
      this.lockout[team] = this.siege ? SIEGE.flagLockout : WAR.flagLockout;
      const cost = this.siege ? 1 : WAR.captureCost;
      this.tickets[team] = Math.max(0, this.tickets[team] - cost);
      if (this.capturer[team]) {
        this.capturer[team] = null;
        this.events.alarm(team, false, null);
      }
      for (const e of entities) if (e.team === 1 - team) e.captureProgress = 0;
      this.events.tickets(team, this.tickets[team], -cost, 'capture');
      this.events.captured(team, attackers);
    }
  }

  private updateOutpost(o: Outpost, dt: number, entities: Entity[]): void {
    let a = 0;
    let b = 0;
    const present: Entity[] = [];
    for (const e of entities) {
      if (!e.alive || e.team < 0 || !this.nearOutpost(e, o)) continue;
      if (e.team === 0) a++;
      else b++;
      present.push(e);
    }
    o.contested = a > 0 && b > 0;
    if (o.contested) return;
    const team = a > 0 ? 0 : b > 0 ? 1 : -1;
    if (team < 0) {
      o.progress = Math.max(0, o.progress - dt / WAR.outpostTime);
      if (o.progress === 0) o.team = -1;
      return;
    }
    if (o.owner === team) {
      // Owners on the point push back any enemy progress.
      o.progress = Math.max(0, o.progress - dt / WAR.outpostTime);
      if (o.progress === 0) o.team = -1;
      return;
    }
    if (o.team !== team) {
      // Switching sides: the other team's progress has to be undone first.
      if (o.progress > 0) {
        o.progress = Math.max(0, o.progress - dt / WAR.outpostTime);
        if (o.progress === 0) o.team = team;
        return;
      }
      o.team = team;
    }
    // More boots take it faster, with diminishing returns.
    const speed = 1 + Math.min(2, present.length - 1) * 0.35;
    o.progress += (dt / (this.siege ? SIEGE.courtyardTime : WAR.outpostTime)) * speed;
    if (o.progress >= 1) {
      const prev = o.owner;
      o.owner = team;
      o.progress = 0;
      o.team = -1;
      this.events.outpost(o.index, team, prev, present.filter((e) => e.team === team));
    }
  }

  private checkEnd(): void {
    if (this.ended || this.siege) return;
    if (this.tickets[0] <= 0 || this.tickets[1] <= 0) this.finish();
  }

  private finishWith(winner: number): void {
    if (this.ended) return;
    this.ended = true;
    this.winner = winner;
    this.events.end(winner);
  }

  /** Ends the war: the team with tickets left wins; equal pools are a draw. */
  finish(): void {
    if (this.ended) return;
    this.ended = true;
    if (this.tickets[0] !== this.tickets[1]) this.winner = this.tickets[0] > this.tickets[1] ? 0 : 1;
    else if (this.siege && this.casualties[0] !== this.casualties[1]) this.winner = this.casualties[0] < this.casualties[1] ? 0 : 1;
    else this.winner = -1;
    this.events.end(this.winner);
  }

  /** Spends repair supplies for a team; false when the pool is empty. */
  spend(team: number, amount: number): boolean {
    if (this.supplies[team] < amount) return false;
    this.supplies[team] -= amount;
    return true;
  }
}
