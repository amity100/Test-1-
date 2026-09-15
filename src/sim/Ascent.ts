import * as THREE from 'three';
import type { Entity } from './Entities';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Terrain } from '../world/Terrain';
import { PLAYABLE_RADIUS } from '../world/Layout';
import { clamp } from '../core/MathUtil';

/**
 * Sky Flag rules: everyone for themselves on one island, building arenas into the sky. A flag drifts
 * down from the clouds toward whoever stands highest; the highest player is marked for everyone to
 * see and worth a bounty of bricks; the fallen leave bricks that hover, then drop; and from the
 * middle of the match the sea rises to swallow the island, three times faster once the flag is taken.
 * Whoever holds the flag for twenty seconds wins.
 */
export const ASCENT = {
  players: 12,
  roundTime: 720,
  // Bricks: the only building material. A slow trickle keeps everyone building; kills pay big.
  bricksStart: 24,
  bricksMax: 60,
  trickleEvery: 3,
  trickleMarked: 3,
  dropMin: 8,
  /** Fraction of the victim's bricks that drop (the rest is lost with the fall). */
  dropShare: 0.75,
  /** Bricks a respawn starts with (never less). */
  respawnBricks: 12,
  /** Extra bricks the marked leader drops when killed. */
  markedBounty: 12,
  /** Seconds a dropped cluster hangs where its owner died before it plunges. */
  hoverTime: 10,
  /** Bricks a sky island's cache holds, and the seconds before a taken cache is back. */
  cacheBricks: 10,
  cacheRespawn: 30,
  pickupRadius: 1.8,
  // The flag.
  flagStartY: 180,
  /** m/s of descent (180 m down to about 36 m over the twelve minutes). */
  flagFall: 0.2,
  /** m/s the flag drifts sideways toward the marked leader (or the island centre). */
  flagDrift: 1.1,
  /** Keeps the flag over the island. */
  flagMaxRadius: 70,
  flagGrabRadius: 2.8,
  flagGrabHeight: 3.2,
  holdTime: 20,
  /** Seconds after a drop before the flag can be taken again. */
  flagRelock: 1.2,
  // The marked leader.
  markedMargin: 4,
  /** Metres above the ground before height counts for the mark. */
  markedMinHeight: 6,
  // The sea.
  seaStartAt: 330,
  seaSpeed: 0.12,
  seaBoost: 3,
  seaFloor: 0,
  drownDepth: 0.9,
  drownDps: 40,
  // Falls: landing speed (m/s) that is harmless and that kills outright.
  fallSafe: 15,
  fallDeadly: 44,
  /** Bullet knockback (m/s per hit) so a firefight on a ledge is a shove match. */
  knockback: 0.3,
};

export const SCORE_ASCENT = {
  kill: 5,
  brick: 1,
  /** Points per 5 m of the highest point ever reached. */
  per5m: 2,
  flagSecond: 3,
  win: 150,
};

export interface BrickDrop {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  count: number;
  /** Seconds left hovering before the plunge. */
  hover: number;
  /** Who dropped it (colour of the glow). */
  colorHex: string;
  falling: boolean;
  landed: boolean;
  dead: boolean;
  /** A sky island's cache: hangs forever, and comes back a while after it is taken. */
  cache?: boolean;
}

export interface AscentHooks {
  /** Something hurt an entity outside a fight: the sea or a fall. */
  damage(e: Entity, amount: number, reason: 'fall' | 'sea'): void;
  marked(next: Entity | null, prev: Entity | null): void;
  pickup(e: Entity, count: number, pos: THREE.Vector3): void;
  flag(kind: 'taken' | 'dropped' | 'won' | 'lost', e: Entity | null): void;
  sea(kind: 'start' | 'boost'): void;
  end(winner: Entity | null, reason: 'hold' | 'sea' | 'time' | 'last'): void;
}

let nextDropId = 1;

export interface BrickCache {
  pos: THREE.Vector3;
  count: number;
  /** Match time at which the cache reappears (0 = now). */
  respawnAt: number;
  /** Id of the drop currently standing for it, or -1 while it is gone. */
  dropId: number;
}

/** Live state of a Sky Flag match (owned by Match, read by the game, HUD and bots). */
export class AscentState {
  readonly flagPos = new THREE.Vector3(0, ASCENT.flagStartY, 0);
  holder: Entity | null = null;
  holdTimer = 0;
  /** Nobody has touched the flag yet: the sea still creeps. */
  untouched = true;
  flagLock = 0;
  marked: Entity | null = null;
  seaLevel = ASCENT.seaFloor;
  seaRising = false;
  seaSpeed = 0;
  /** Seconds since the battle started. */
  elapsed = 0;
  readonly drops: BrickDrop[] = [];
  /** The islands' brick caches: where they hang, how much, and when a taken one is back. */
  readonly caches: BrickCache[] = [];
  ended = false;
  winner: Entity | null = null;
  private trickle = 0;
  private trickleMarked = 0;
  private markTimer = 0;
  private lastVelY = new Map<number, number>();
  private centre = new THREE.Vector3(0, 0, 0);

  constructor(
    private world: VoxelWorld,
    private terrain: Terrain,
    private hooks: AscentHooks,
  ) {}

  /** Bricks everyone carries at the first spawn. */
  outfit(e: Entity): void {
    e.bricks = ASCENT.bricksStart;
  }

  /** A respawn keeps some bricks so nobody comes back empty-handed. */
  respawned(e: Entity): void {
    e.bricks = Math.max(ASCENT.respawnBricks, e.bricks);
    this.lastVelY.delete(e.id);
  }

  /** Height above the island surface (or the sea) under an entity. */
  altitude(e: Entity): number {
    return e.pos.y - Math.max(this.terrain.heightAt(e.pos.x, e.pos.z), this.seaLevel);
  }

  /** Time the sea starts, for the HUD countdown; negative once it is rising. */
  get seaIn(): number {
    return ASCENT.seaStartAt - this.elapsed;
  }

  get flagHeld(): boolean {
    return this.holder !== null && this.holder.alive;
  }

  spend(e: Entity, n: number): boolean {
    if (e.bricks < n) return false;
    e.bricks -= n;
    return true;
  }

  /** Death: the sea and falls are the only killers without a name. Bricks scatter where the body was. */
  onKill(victim: Entity, killer: Entity | null): void {
    if (this.ended) return;
    if (killer && killer !== victim) {
      killer.score.kills++;
      this.recompute(killer);
    }
    const wasMarked = this.marked === victim;
    const count = Math.max(ASCENT.dropMin, Math.floor(victim.bricks * ASCENT.dropShare)) + (wasMarked ? ASCENT.markedBounty : 0);
    victim.bricks = Math.max(ASCENT.respawnBricks, Math.floor(victim.bricks * 0.25));
    // Nothing to loot from a body under water.
    if (victim.pos.y + 1 > this.seaLevel) {
      this.drops.push({
        id: nextDropId++,
        pos: new THREE.Vector3(victim.pos.x, victim.pos.y + 1.2, victim.pos.z),
        vel: new THREE.Vector3(),
        count,
        hover: ASCENT.hoverTime,
        colorHex: victim.colorHex,
        falling: false,
        landed: false,
        dead: false,
      });
    }
    if (this.holder === victim) this.dropFlag(victim);
    if (wasMarked) this.setMarked(null);
  }

  private dropFlag(from: Entity): void {
    this.holder = null;
    this.holdTimer = 0;
    this.flagLock = ASCENT.flagRelock;
    // The flag hangs where its carrier fell, never under the water.
    this.flagPos.set(from.pos.x, Math.max(from.pos.y + 2.2, this.seaLevel + 8), from.pos.z);
    this.hooks.flag('dropped', from);
  }

  private setMarked(next: Entity | null): void {
    if (next === this.marked) return;
    const prev = this.marked;
    this.marked = next;
    this.hooks.marked(next, prev);
  }

  recompute(e: Entity): void {
    const s = e.score;
    s.total = s.kills * SCORE_ASCENT.kill + s.bricks * SCORE_ASCENT.brick + Math.floor(s.peakAltitude / 5) * SCORE_ASCENT.per5m + Math.floor(s.flagSeconds) * SCORE_ASCENT.flagSecond + (s.won ? SCORE_ASCENT.win : 0);
  }

  update(dt: number, now: number, entities: Entity[]): void {
    if (this.ended) return;
    this.elapsed += dt;
    this.updateBricks(dt, entities);
    this.updateFalls(dt, entities);
    this.updateSea(dt, entities);
    this.updateMarked(dt, entities);
    this.updateFlag(dt, entities);
    this.updateCaches();
    this.updateDrops(dt, entities);
    void now;
    // Peak altitude for the score sheet.
    for (const e of entities) {
      if (!e.alive) continue;
      const alt = e.pos.y - this.terrain.heightAt(e.pos.x, e.pos.z);
      if (alt > e.score.peakAltitude + 0.5) {
        e.score.peakAltitude = alt;
        this.recompute(e);
      }
    }
    // Last one standing once the sea has eliminated everyone else.
    const living = entities.filter((e) => !e.eliminated);
    if (living.length === 1 && entities.length > 1) this.finish(living[0], 'last');
    else if (living.length === 0) this.finish(this.holder, 'sea');
  }

  private updateBricks(dt: number, entities: Entity[]): void {
    this.trickle += dt;
    if (this.trickle >= ASCENT.trickleEvery) {
      this.trickle -= ASCENT.trickleEvery;
      for (const e of entities) if (e.alive && e.bricks < ASCENT.bricksMax) e.bricks++;
    }
    this.trickleMarked += dt;
    if (this.trickleMarked >= ASCENT.trickleMarked) {
      this.trickleMarked -= ASCENT.trickleMarked;
      const m = this.marked;
      if (m && m.alive && m.bricks < ASCENT.bricksMax) m.bricks++;
    }
  }

  /** Landing hard hurts; from high enough it kills. Water breaks the fall. */
  private updateFalls(dt: number, entities: Entity[]): void {
    void dt;
    for (const e of entities) {
      if (!e.alive) {
        this.lastVelY.delete(e.id);
        continue;
      }
      const prev = this.lastVelY.get(e.id) ?? 0;
      if (e.grounded && !e.wasGrounded && prev < -ASCENT.fallSafe && e.pos.y > this.seaLevel - 0.5 && !e.zipRide && !e.grapplePoint) {
        const k = clamp((-prev - ASCENT.fallSafe) / (ASCENT.fallDeadly - ASCENT.fallSafe), 0, 1);
        const dmg = Math.round(k * k * 100 + k * 8);
        if (dmg > 0) this.hooks.damage(e, dmg, 'fall');
      }
      this.lastVelY.set(e.id, e.grounded ? 0 : e.vel.y);
    }
  }

  private updateSea(dt: number, entities: Entity[]): void {
    if (!this.seaRising && this.elapsed >= ASCENT.seaStartAt) {
      this.seaRising = true;
      this.seaSpeed = ASCENT.seaSpeed;
      this.hooks.sea('start');
    }
    if (this.seaRising) this.seaLevel += this.seaSpeed * dt;
    for (const e of entities) {
      if (!e.alive) continue;
      if (e.pos.y + ASCENT.drownDepth < this.seaLevel) {
        e.drowning = true;
        this.hooks.damage(e, ASCENT.drownDps * dt, 'sea');
      } else e.drowning = false;
    }
    if (this.seaRising && this.seaLevel >= this.flagPos.y - 0.5 && !this.flagHeld) this.finish(this.highest(entities), 'sea');
  }

  /** Whoever stands highest, well above the ground, is marked; a rival has to beat them by a margin. */
  private updateMarked(dt: number, entities: Entity[]): void {
    this.markTimer -= dt;
    if (this.markTimer > 0) return;
    this.markTimer = 0.25;
    let best: Entity | null = null;
    let second = -Infinity;
    for (const e of entities) {
      if (!e.alive) continue;
      if (this.altitude(e) < ASCENT.markedMinHeight) continue;
      if (!best || e.pos.y > best.pos.y) {
        second = best ? best.pos.y : second;
        best = e;
      } else if (e.pos.y > second) second = e.pos.y;
    }
    const cur = this.marked;
    if (cur && (!cur.alive || this.altitude(cur) < ASCENT.markedMinHeight * 0.6)) {
      this.setMarked(best && best !== cur ? best : null);
      return;
    }
    if (!best) {
      if (cur) this.setMarked(null);
      return;
    }
    if (!cur) {
      // A clear leader is marked at once; on a crowded plaza where nobody stands out by height, the
      // one who has been highest for a moment takes the mark, so the mark is never simply absent.
      if (best.pos.y >= second + ASCENT.markedMargin * 0.5) {
        this.setMarked(best);
        this.markStreak = 0;
        return;
      }
      if (best === this.markCandidate) this.markStreak++;
      else {
        this.markCandidate = best;
        this.markStreak = 0;
      }
      if (this.markStreak >= 3) this.setMarked(best);
      return;
    }
    if (best !== cur && best.pos.y > cur.pos.y + ASCENT.markedMargin) this.setMarked(best);
  }
  private markCandidate: Entity | null = null;
  private markStreak = 0;

  private updateFlag(dt: number, entities: Entity[]): void {
    this.flagLock = Math.max(0, this.flagLock - dt);
    const holder = this.holder;
    if (holder) {
      if (!holder.alive) {
        this.dropFlag(holder);
        return;
      }
      this.flagPos.set(holder.pos.x, holder.pos.y + 2.6, holder.pos.z);
      this.holdTimer += dt;
      holder.score.flagSeconds += dt;
      this.recompute(holder);
      if (this.holdTimer >= ASCENT.holdTime) {
        holder.score.won = true;
        this.recompute(holder);
        this.hooks.flag('won', holder);
        this.finish(holder, 'hold');
      }
      return;
    }
    // Free flag: sinks slowly and drifts toward the marked leader (the island centre when nobody leads).
    const target = this.marked && this.marked.alive ? this.marked.pos : this.centre;
    const dx = target.x - this.flagPos.x;
    const dz = target.z - this.flagPos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.5) {
      const step = Math.min(d, ASCENT.flagDrift * dt);
      this.flagPos.x += (dx / d) * step;
      this.flagPos.z += (dz / d) * step;
    }
    const r = Math.hypot(this.flagPos.x, this.flagPos.z);
    if (r > ASCENT.flagMaxRadius) {
      this.flagPos.x *= ASCENT.flagMaxRadius / r;
      this.flagPos.z *= ASCENT.flagMaxRadius / r;
    }
    this.flagPos.y -= ASCENT.flagFall * dt;
    // Never sink into a structure: stay above the highest block under it.
    const colX = Math.floor(this.flagPos.x);
    const colZ = Math.floor(this.flagPos.z);
    for (let y = Math.floor(this.flagPos.y); y >= Math.floor(this.flagPos.y) - 2; y--) {
      if (this.world.get(colX, y, colZ) !== 0) {
        this.flagPos.y = Math.max(this.flagPos.y, y + 1.2);
        break;
      }
    }
    const ground = this.terrain.heightAt(this.flagPos.x, this.flagPos.z);
    if (this.flagPos.y < ground + 0.6) this.flagPos.y = ground + 0.6;
    if (this.flagLock > 0) return;
    // Anyone standing by the flag takes it.
    let taker: Entity | null = null;
    let bestD = Infinity;
    for (const e of entities) {
      if (!e.alive || e.burrowed) continue;
      const hx = e.pos.x - this.flagPos.x;
      const hz = e.pos.z - this.flagPos.z;
      const hd = Math.hypot(hx, hz);
      const dy = this.flagPos.y - e.pos.y;
      if (hd <= ASCENT.flagGrabRadius && dy > -1.5 && dy < ASCENT.flagGrabHeight && hd < bestD) {
        bestD = hd;
        taker = e;
      }
    }
    if (taker) {
      this.holder = taker;
      this.holdTimer = 0;
      this.hooks.flag('taken', taker);
      if (this.untouched) {
        this.untouched = false;
        if (!this.seaRising) {
          this.seaRising = true;
          this.hooks.sea('start');
        }
        this.seaSpeed = ASCENT.seaSpeed * ASCENT.seaBoost;
        this.hooks.sea('boost');
      }
    }
  }

  /** A brick cache on a sky island: a permanent pickup that returns a while after it is taken. */
  addCache(pos: THREE.Vector3, count = ASCENT.cacheBricks, respawn = ASCENT.cacheRespawn): void {
    void respawn;
    this.caches.push({ pos: pos.clone(), count, respawnAt: 0, dropId: -1 });
  }

  /** Puts back any cache whose time has come. */
  private updateCaches(): void {
    for (const c of this.caches) {
      if (c.dropId >= 0 || this.elapsed < c.respawnAt) continue;
      const id = nextDropId++;
      c.dropId = id;
      this.drops.push({
        id,
        pos: c.pos.clone(),
        vel: new THREE.Vector3(),
        count: c.count,
        hover: Infinity,
        colorHex: '#ffd36a',
        falling: false,
        landed: false,
        dead: false,
        cache: true,
      });
    }
  }

  /** Dropped bricks hover, then plunge until they land on something; the sea takes what reaches it. */
  private updateDrops(dt: number, entities: Entity[]): void {
    for (const d of this.drops) {
      if (d.dead) continue;
      if (d.cache) {
        // A cache bobs in place; when the sea reaches its island it is simply gone.
        d.pos.y += Math.sin(this.elapsed * 2.4) * 0.15 * dt;
      } else if (!d.falling) {
        d.hover -= dt;
        d.pos.y += Math.sin(d.hover * 2.4) * 0.15 * dt;
        if (d.hover <= 0) d.falling = true;
      } else if (!d.landed) {
        d.vel.y -= 22 * dt;
        if (d.vel.y < -30) d.vel.y = -30;
        const ny = d.pos.y + d.vel.y * dt;
        // Land on the first block or the ground below.
        const bx = Math.floor(d.pos.x);
        const bz = Math.floor(d.pos.z);
        let floor = this.terrain.heightAt(d.pos.x, d.pos.z) + 0.4;
        for (let y = Math.floor(d.pos.y); y >= Math.floor(ny) - 1 && y >= 0; y--) {
          if (this.world.get(bx, y, bz) !== 0) {
            floor = Math.max(floor, y + 1.4);
            break;
          }
        }
        if (ny <= floor) {
          d.pos.y = floor;
          d.vel.set(0, 0, 0);
          d.landed = true;
        } else d.pos.y = ny;
      }
      if (d.pos.y < this.seaLevel - 0.5) {
        d.dead = true;
        continue;
      }
      const r2 = ASCENT.pickupRadius * ASCENT.pickupRadius;
      for (const e of entities) {
        if (!e.alive || e.bricks >= ASCENT.bricksMax) continue;
        const dx = e.pos.x - d.pos.x;
        const dy = e.pos.y + 1 - d.pos.y;
        const dz = e.pos.z - d.pos.z;
        if (dx * dx + dy * dy * 0.6 + dz * dz > r2) continue;
        const take = Math.min(d.count, ASCENT.bricksMax - e.bricks);
        e.bricks += take;
        e.score.bricks += take;
        this.recompute(e);
        d.dead = true;
        if (d.cache) {
          const c = this.caches.find((k) => k.dropId === d.id);
          if (c) {
            c.dropId = -1;
            c.respawnAt = this.elapsed + ASCENT.cacheRespawn;
          }
        }
        this.hooks.pickup(e, take, d.pos);
        break;
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) if (this.drops[i].dead) this.drops.splice(i, 1);
  }

  highest(entities: Entity[]): Entity | null {
    let best: Entity | null = null;
    for (const e of entities) if (e.alive && (!best || e.pos.y > best.pos.y)) best = e;
    return best;
  }

  /** The clock ran out: the flag carrier, else whoever stands highest. */
  timeUp(entities: Entity[]): void {
    this.finish(this.flagHeld ? this.holder : this.highest(entities), 'time');
  }

  private finish(winner: Entity | null, reason: 'hold' | 'sea' | 'time' | 'last'): void {
    if (this.ended) return;
    this.ended = true;
    this.winner = winner;
    if (winner) {
      winner.score.won = true;
      this.recompute(winner);
    }
    this.hooks.end(winner, reason);
  }

  /** Somewhere to stand above the water near a position, for respawns and the bots' bearings. */
  isSafeGround(x: number, z: number): boolean {
    return this.terrain.heightAt(x, z) > this.seaLevel + 1.5 && x * x + z * z < (PLAYABLE_RADIUS - 8) * (PLAYABLE_RADIUS - 8);
  }
}
