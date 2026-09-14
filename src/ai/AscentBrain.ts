import * as THREE from 'three';
import { BotBrain, type BotContext, type BotProfile, type Intent } from './BotBrain';
import type { NavSystem } from './NavSystem';
import type { Entity } from '../sim/Entities';
import type { AscentState } from '../sim/Ascent';
import { ASCENT } from '../sim/Ascent';
import { PIECES, quantizeYaw, type PieceKind, type SkyBuilder } from '../build/SkyBuild';
import { PLAYABLE_RADIUS } from '../world/Layout';
import { blockShape, shapeKind, shapeRot, SHAPE_DIRS } from '../world/Voxel';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

type Job = 'climb' | 'hunt' | 'loot' | 'flee' | 'hold' | 'fight';

/**
 * A Sky Flag player: the shared perception, aim and fire of the classic brain, with its own idea of
 * where to be. It fights what it sees, runs uphill from the rising sea, holds the flag when it has it,
 * hunts the marked leader or the carrier when it can reach them, picks up bricks lying nearby, and
 * otherwise climbs toward the flag: a ramp ahead whenever the way up is barred, a deck to stand on
 * at the top, a bridge across a gap. There is no path grid up here: steering is straight-line with a
 * stuck recovery that builds its way out.
 */
export class AscentBrain extends BotBrain {
  private job: Job = 'climb';
  private jobTimer = 0;
  private buildCooldown = 0;
  private stuckHere = 0;
  private goalPoint: THREE.Vector3 | null = null;
  private dropTarget: THREE.Vector3 | null = null;
  private wander = 0;
  private edgeTimer = 0;
  private wanderUntil = -1;
  private wanderDir = new THREE.Vector3(1, 0, 0);
  private lootUntil = 0;
  private lootId = -1;
  private lootGaveUp = new Map<number, number>();
  private nowSeen = 0;
  /** The tower goes up in switchbacks: each ramp turns a quarter from the last, always the same way. */
  private lastRampDir = -1;
  private wantDir = -1;
  /** The landing of the ramp just placed: walk there before anything else. */
  private legGoal: THREE.Vector3 | null = null;
  private readonly progressPos = new THREE.Vector3(1e9, 0, 0);
  /** Last piece tried and its verdict (diagnostics). */
  lastAimReason = '';
  private legUntil = 0;
  private lastPlaced = 0;
  private spiral: number;
  private readonly patience: number;

  constructor(
    entity: Entity,
    ctx: BotContext,
    profile: BotProfile,
    seed: number,
    private sky: SkyBuilder,
    private ascent: () => AscentState | null,
  ) {
    super(entity, ctx, profile, seed);
    this.patience = 0.7 + this.rand.range(0, 0.8);
    this.spiral = this.rand.sign();
  }

  override reset(): void {
    super.reset();
    this.job = 'climb';
    this.jobTimer = 0;
    this.buildCooldown = this.rand.range(0.5, 2);
    this.stuckHere = 0;
    this.goalPoint = null;
    this.dropTarget = null;
    this.lastRampDir = -1;
    this.wantDir = -1;
    this.wanderUntil = -1;
    this.legGoal = null;
    this.lastPlaced = this.nowSeen;
  }

  protected override decide(dt: number, now: number, threat: Entity | null, nav: NavSystem | null): Intent {
    const e = this.entity;
    const asc = this.ascent();
    if (!asc) return { goal: null, sprint: false, crouch: false };
    this.nowSeen = now;
    this.buildCooldown -= dt;
    this.jobTimer -= dt;
    this.edgeTimer -= dt;
    this.coverLogic(dt, threat, nav);
    // Up on a structure there is no cover to run to and nowhere to fall back: stand and shoot instead.
    const aloft = asc.altitude(e) > 2.5;
    if (aloft && (this.state === 'cover' || this.state === 'retreat')) this.state = 'hold';
    if (this.state === 'cover') return { goal: this.coverGoal, sprint: true, crouch: false };
    if (this.state === 'retreat') return { goal: null, sprint: false, crouch: false };

    // ---- What matters most right now ----
    const seaGap = e.pos.y - asc.seaLevel;
    const drowningSoon = asc.seaRising && seaGap < 7;
    const carrying = asc.holder === e;
    if (this.jobTimer <= 0 || drowningSoon || carrying) {
      this.jobTimer = 0.6 + this.rand.range(0, 0.6);
      this.job = this.pickJob(asc, threat, drowningSoon, carrying);
    }
    e.task = this.job;

    // A fight in view comes first, unless the water is at our heels or we are carrying the flag away.
    const fighting = threat && (this.seesTarget || e.pos.distanceTo(this.lastSeen) < 18) && !drowningSoon && !carrying;
    if (!fighting && this.job === 'fight') {
      // The fight is over: pick a proper job now rather than drifting on the last goal.
      this.jobTimer = 0.6 + this.rand.range(0, 0.6);
      this.job = this.pickJob(asc, threat, drowningSoon, carrying);
      e.task = this.job;
    }
    if (fighting) {
      // On the ground a fight is fought on the move; on a deck, strafing means stepping off it.
      this.state = aloft ? 'hold' : 'engage';
      this.job = 'fight';
      e.task = 'fight';
      // Fighting from below is losing: a ramp up toward the shooter when they hold the high ground.
      if (threat.pos.y > e.pos.y + 3 && this.buildCooldown <= 0 && e.bricks >= PIECES.ramp.cost && this.rand.chance(0.5)) this.buildToward(threat.pos, asc);
      return { goal: null, sprint: false, crouch: false };
    }

    let goal: THREE.Vector3 | null = null;
    let sprint = true;
    switch (this.job) {
      case 'flee': {
        // Up, by any means: the nearest deck above the water, else build straight up.
        goal = this.higherGround(asc, 30) ?? this.goalUp(asc);
        break;
      }
      case 'hold': {
        // Carrying the flag, or out of bricks up high: stand on the highest deck nearby, keep still and shoot.
        this.state = 'hold';
        const spot = carrying ? this.higherGround(asc, 10) : null;
        goal = spot && spot.y > e.pos.y + 1 ? spot : null;
        sprint = false;
        if (!goal) this.scan(now);
        if (!carrying && e.bricks >= PIECES.ramp.cost) this.jobTimer = 0;
        break;
      }
      case 'hunt': {
        const target = asc.holder && asc.holder.alive && asc.holder !== e ? asc.holder : asc.marked && asc.marked !== e && asc.marked.alive ? asc.marked : null;
        if (target) goal = target.pos.clone();
        else this.job = 'climb';
        break;
      }
      case 'loot': {
        goal = this.dropTarget;
        // Gone, taken, or taking too long to reach: forget it for a while.
        if (!goal || !asc.drops.some((d) => !d.dead && d.pos.distanceTo(goal!) < 1) || now > this.lootUntil) {
          if (goal && now > this.lootUntil) this.lootGaveUp.set(this.lootId, now + 25);
          this.dropTarget = null;
          this.job = 'climb';
          goal = this.goalUp(asc);
        }
        break;
      }
      case 'climb':
      default: {
        // Without the bricks for a ramp there is nowhere to walk to up here; wait on the deck.
        if (e.bricks < PIECES.ramp.cost && aloft && !this.legGoal) {
          this.job = 'hold';
          e.task = 'hold';
          this.state = 'hold';
          sprint = false;
          this.scan(now);
          break;
        }
        goal = this.goalUp(asc);
        break;
      }
    }
    this.state = goal ? 'approach' : this.state === 'hold' ? 'hold' : 'idle';

    // Bricks in hand yet nothing placed for a while: this spot is no good, move well away and start a new tower
    // (on the ground only: up on a deck, a stroll ends in a fall, so the switchback turns the other way instead).
    if (this.job === 'climb' && e.bricks >= PIECES.ramp.cost + 2 && now - this.lastPlaced > 9 && this.wanderUntil < now && aloft) {
      this.spiral = -this.spiral;
      this.lastPlaced = now;
      this.lastRampDir = -1;
      this.legGoal = null;
    } else if (this.job === 'climb' && e.bricks >= PIECES.ramp.cost + 2 && now - this.lastPlaced > 9 && this.wanderUntil < now) {
      const a = this.rand.range(0, Math.PI * 2);
      this.wanderDir.set(Math.cos(a), 0, Math.sin(a));
      this.wanderUntil = now + 3;
      this.lastPlaced = now;
      this.lastRampDir = -1;
      this.legGoal = null;
    }
    // Boxed in by pieces with no room for another: stroll somewhere else before trying again.
    if (this.wanderUntil > now && goal) {
      goal = new THREE.Vector3(e.pos.x + this.wanderDir.x * 6, e.pos.y, e.pos.z + this.wanderDir.z * 6);
      this.goalPoint = goal;
      this.lookAt(goal);
      return { goal, sprint: false, crouch: false };
    }
    // On a ramp: walk straight up it, whatever the goal's bearing, or a three-wide ramp is soon left sideways
    // (unless the goal lies back down the ramp, such as a landing behind us).
    const rampDir = goal ? this.rampUnderFeet() : null;
    if (goal && rampDir) {
      const gx = goal.x - e.pos.x;
      const gz = goal.z - e.pos.z;
      const gd = Math.hypot(gx, gz);
      const along = gd > 0.01 ? (gx * rampDir[0] + gz * rampDir[1]) / gd : 1;
      const legNear = this.legGoal && goal === this.legGoal && gd < 3.5;
      if (along > -0.5 && !legNear) goal = new THREE.Vector3(e.pos.x + rampDir[0] * 5, e.pos.y + 4, e.pos.z + rampDir[1] * 5);
    }
    // The last metres to a landing at a walk, so a two-deep landing is not overrun at a sprint.
    if (goal && this.legGoal && Math.hypot(this.legGoal.x - e.pos.x, this.legGoal.z - e.pos.z) < 4) sprint = false;
    if (goal) {
      this.goalPoint = goal;
      // Held back at an edge while a piece goes down (or cannot): stand rather than step off.
      if (this.steerAndBuild(goal, asc, dt, now)) this.goalPoint = null;
    } else this.goalPoint = null;
    return { goal: this.goalPoint, sprint, crouch: false };
  }

  /** The climb direction of the slope block under the feet, if any. */
  private rampUnderFeet(): [number, number] | null {
    const e = this.entity;
    const world = this.ctx.world;
    const bx = Math.floor(e.pos.x);
    const bz = Math.floor(e.pos.z);
    for (let cy = Math.floor(e.pos.y + 0.5); cy >= Math.floor(e.pos.y - 0.6); cy--) {
      const v = world.get(bx, cy, bz);
      if (v === 0) continue;
      const sh = blockShape(v);
      if (shapeKind(sh) !== 'slope') continue;
      return SHAPE_DIRS[shapeRot(sh)];
    }
    return null;
  }

  private pickJob(asc: AscentState, threat: Entity | null, drowningSoon: boolean, carrying: boolean): Job {
    const e = this.entity;
    if (carrying) return 'hold';
    if (drowningSoon) return 'flee';
    // The flag within reach: go and stand under it.
    const flagD = Math.hypot(asc.flagPos.x - e.pos.x, asc.flagPos.z - e.pos.z);
    const flagUp = asc.flagPos.y - e.pos.y;
    if (!asc.flagHeld && flagD < 18 && flagUp < 12) return 'climb';
    // Bricks lying about are worth a detour, more so when short of them; not when three others are
    // already closer, and not one that led nowhere a moment ago.
    let bestDrop: { pos: THREE.Vector3; id: number } | null = null;
    let bestD = e.bricks < 6 ? 40 : 22;
    const others = this.ctx.entities();
    for (const d of asc.drops) {
      if (d.dead) continue;
      const gaveUp = this.lootGaveUp.get(d.id);
      if (gaveUp !== undefined && gaveUp > this.nowSeen) continue;
      const dist = d.pos.distanceTo(e.pos);
      const dy = d.pos.y - e.pos.y;
      if (dist >= bestD || dy > 6 || dy < -14) continue;
      if (dy > 2.5 && e.bricks < PIECES.ramp.cost) continue;
      // From up on a tower only bricks on the same deck are worth it; a long drop for them is not.
      if (asc.altitude(e) > 2.5 && dy < -3 && dist > 6) continue;
      let closer = 0;
      for (const o of others) if (o !== e && o.alive && o.pos.distanceTo(d.pos) < dist) closer++;
      if (closer >= 3) continue;
      bestD = dist;
      bestDrop = { pos: d.pos, id: d.id };
    }
    if (bestDrop) {
      this.dropTarget = bestDrop.pos.clone();
      this.lootId = bestDrop.id;
      this.lootUntil = this.nowSeen + 6 + bestD * 0.4;
      return 'loot';
    }
    // The carrier or the marked leader: worth hunting when they are near enough to reach in time.
    const prey = asc.holder && asc.holder.alive && asc.holder !== e ? asc.holder : asc.marked && asc.marked !== e && asc.marked.alive ? asc.marked : null;
    if (prey) {
      const d = Math.hypot(prey.pos.x - e.pos.x, prey.pos.z - e.pos.z);
      const up = prey.pos.y - e.pos.y;
      const eager = prey === asc.holder ? 1.6 : 1;
      // Worth going for only when they are close and not far above, and never by walking off a tower.
      if (d < 26 * eager && up < 7 && (asc.altitude(e) < 2.5 || d < 8) && this.rand.chance(0.7 * this.profile.searchSkill + 0.3)) return 'hunt';
    }
    void threat;
    // Out of bricks up on a tower: hold it (shoot, wait for the trickle) rather than wander off the edge;
    // a ramp just placed is still walked to its landing first.
    if (e.bricks < PIECES.ramp.cost && asc.altitude(e) > 2.5 && !this.legGoal) return 'hold';
    return 'climb';
  }

  /**
   * Somewhere up. The flag drifts toward whoever stands highest, so the way to it is a tower right
   * here: ramps in switchbacks, each a quarter turn from the last. Only near the flag's height does
   * the bot head across to its column (bridging the gaps).
   */
  private goalUp(asc: AscentState): THREE.Vector3 {
    const e = this.entity;
    const f = asc.flagPos;
    const dx = f.x - e.pos.x;
    const dz = f.z - e.pos.z;
    const d = Math.hypot(dx, dz);
    const upToFlag = f.y - e.pos.y;
    this.wantDir = -1;
    // A ramp just placed: its landing first (done when we stand on it, or it took too long / we fell).
    if (this.legGoal) {
      const lg = this.legGoal;
      const flat = Math.hypot(lg.x - e.pos.x, lg.z - e.pos.z);
      if ((flat < 1.3 && e.pos.y > lg.y - 0.6) || this.nowSeen > this.legUntil || e.pos.y < lg.y - 6) this.legGoal = null;
      else return lg;
    }
    if (upToFlag < 9 && d > 4) return new THREE.Vector3(f.x, e.pos.y, f.z);
    const facing = this.lastRampDir < 0 ? quantizeYaw(Math.atan2(-(d > 0.1 ? dx : 1), -(d > 0.1 ? dz : 0))) : (this.lastRampDir + this.spiral + 4) % 4;
    this.wantDir = facing;
    const [ddx, ddz] = SHAPE_DIRS[facing];
    return new THREE.Vector3(e.pos.x + ddx * 5, e.pos.y + 4, e.pos.z + ddz * 5);
  }

  /** The nearest deck top above the water and higher than us, within a radius. */
  private higherGround(asc: AscentState, radius: number): THREE.Vector3 | null {
    const e = this.entity;
    let best: THREE.Vector3 | null = null;
    let bestScore = -Infinity;
    for (const s of this.sky.standableSpots(asc.seaLevel + 4)) {
      const d = Math.hypot(s.x - e.pos.x, s.z - e.pos.z);
      if (d > radius) continue;
      const up = s.y - e.pos.y;
      if (up < 0.5) continue;
      const score = up * 2 - d;
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return best;
  }

  /** Look about while holding. */
  private scan(now: number): void {
    const e = this.entity;
    this.lookAt(tmp.set(e.pos.x + Math.sin(now * 0.4 + e.id) * 10, e.pos.y - 2, e.pos.z + Math.cos(now * 0.4 + e.id) * 10));
  }

  /**
   * Moving toward a goal that is higher or across a gap means building: a ramp when the goal is above
   * and the ground ahead does not rise, a bridge when the ground ahead is missing, a deck to stand on
   * when there is nothing under the ramp's landing. Also the way out when stuck against anything.
   */
  private steerAndBuild(goal: THREE.Vector3, asc: AscentState, dt: number, now: number): boolean {
    const e = this.entity;
    const flat = tmp.copy(goal).sub(e.pos).setY(0);
    const dist = flat.length();
    const up = goal.y - e.pos.y;
    // Progress check: not moving for a while means something is in the way (goals that travel with us,
    // such as the top of the ramp we are on, would otherwise never count as closing in).
    if (e.pos.distanceToSquared(this.progressPos) > 0.04) {
      this.stuckHere = 0;
      this.progressPos.copy(e.pos);
    } else {
      this.stuckHere += dt;
      if (this.stuckHere > 3.5) this.stuckHere = 0;
    }
    if (dist > 0.3) {
      // Face the goal so the pieces go the right way.
      this.lookAt(tmp2.set(goal.x, e.pos.y + Math.min(up, 3) * 0.3 + 1.2, goal.z));
    }
    const wantsUp = up > 2.2;
    const ahead = this.groundAhead(1.7);
    const gapAhead = ahead === null || ahead < e.pos.y - 3.5;
    // At an edge with the goal not below: never step off; wait for a piece.
    const holdBack = gapAhead && up > -3 && e.grounded;
    if (this.buildCooldown > 0 || !e.grounded) return holdBack;
    // Already on a ramp, or one starts just ahead: walk it, do not pile another on top.
    const world = this.ctx.world;
    if (world.rampHeightAt(e.pos.x, e.pos.z, e.pos.y) !== null) return false;
    if (this.slopeAhead()) return false;
    const stuck = this.stuckHere > this.patience;
    const wallAhead = ahead !== null && ahead > e.pos.y + 1.6 && ahead < e.pos.y + 9;
    if (wantsUp || stuck || gapAhead || wallAhead) {
      const kind: PieceKind = gapAhead && !wantsUp ? 'bridge' : 'ramp';
      // The switchback wants a particular facing; otherwise the way we look.
      const rel = kind === 'ramp' && this.wantDir >= 0 ? (this.wantDir - quantizeYaw(e.yaw) + 8) % 4 : 0;
      if (this.tryPlace(kind, asc, rel)) {
        this.stuckHere = 0;
        this.buildCooldown = kind === 'bridge' ? 1.4 : 0.7 + this.rand.range(0, 0.4);
        return false;
      }
      // No room for a ramp that way: the other turn, then straight on (never back over the ramp just climbed,
      // which is walked the wrong way), then a deck to stand on.
      const back = this.lastRampDir >= 0 ? (this.lastRampDir + 2) % 4 : -1;
      const yawDir = quantizeYaw(e.yaw);
      for (const rot of [rel + 2, rel + 1, rel + 3]) {
        if ((yawDir + rot) % 4 === back) continue;
        if (this.tryPlace('ramp', asc, rot % 4)) {
          this.stuckHere = 0;
          this.buildCooldown = 0.9;
          return false;
        }
      }
      if (this.tryPlace('platform', asc)) {
        this.buildCooldown = 0.6;
        return false;
      }
      if (e.bricks >= PIECES.ramp.cost && !gapAhead && asc.altitude(e) <= 2.5) {
        // Bricks in hand but nothing fits here: walk clear of the pile for a couple of seconds.
        const a = this.rand.range(0, Math.PI * 2);
        this.wanderDir.set(Math.cos(a), 0, Math.sin(a));
        this.wanderUntil = now + 1.6 + this.rand.range(0, 1);
        this.stuckHere = 0;
        this.buildCooldown = 0.5;
        return false;
      }
      if (stuck && !gapAhead) {
        // Hop and jiggle.
        e.vel.y = Math.max(e.vel.y, 7.5);
        e.grounded = false;
        this.stuckHere = 0;
        this.buildCooldown = 0.4;
      }
      // Out of bricks at an edge: turn away and look for a way down or a fight instead.
      if (holdBack && e.bricks < PIECES.ramp.cost) {
        this.jobTimer = 0;
        this.buildCooldown = 1.5;
        return false;
      }
      return holdBack;
    } else if (up < 1 && this.rand.chance(dt * 0.25) && e.bricks >= PIECES.parapet.cost + 6) {
      // Settled at height with bricks to spare: a bit of cover.
      if (this.tryPlace('parapet', asc)) this.buildCooldown = 4;
    }
    return false;
  }

  /** A ramp starts just ahead at foot level and climbs away from us: walk it rather than build another. */
  private slopeAhead(): boolean {
    const e = this.entity;
    const fwd = e.forwardFlat(tmp2);
    const world = this.ctx.world;
    const fy = Math.floor(e.pos.y + 0.02);
    for (let i = 1; i <= 2; i++) {
      const bx = Math.floor(e.pos.x + fwd.x * i);
      const bz = Math.floor(e.pos.z + fwd.z * i);
      for (let y = fy; y <= fy + 1; y++) {
        const v = world.get(bx, y, bz);
        if (v === 0) continue;
        const sh = blockShape(v);
        if (shapeKind(sh) !== 'slope') continue;
        const [dx, dz] = SHAPE_DIRS[shapeRot(sh)];
        if (dx * fwd.x + dz * fwd.z > 0.5) return true;
      }
    }
    return false;
  }

  /** Height of the standing surface a couple of metres ahead, or null when it is thin air. */
  private groundAhead(ahead: number): number | null {
    const e = this.entity;
    const fwd = e.forwardFlat(tmp2);
    const x = e.pos.x + fwd.x * ahead;
    const z = e.pos.z + fwd.z * ahead;
    const world = this.ctx.world;
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    for (let y = Math.floor(e.pos.y) + 9; y >= Math.floor(e.pos.y) - 12; y--) {
      if (y < 0) break;
      if (world.get(bx, y, bz) !== 0) return y + 1;
    }
    const th = this.ctx.terrain?.heightAt(x, z);
    if (th !== undefined && th > e.pos.y - 12) return th;
    return null;
  }

  private tryPlace(kind: PieceKind, asc: AscentState, rot = 0): boolean {
    const e = this.entity;
    const def = PIECES[kind];
    if (e.bricks < def.cost) return false;
    if (e.pos.x * e.pos.x + e.pos.z * e.pos.z > (PLAYABLE_RADIUS - 12) * (PLAYABLE_RADIUS - 12)) return false;
    const aim = this.sky.aimFrom(kind, e, rot);
    this.lastAimReason = `${kind[0]}:${aim.reason}`;
    if (!aim.stamp || aim.reason !== 'ok') return false;
    if (!asc.spend(e, def.cost)) return false;
    this.sky.place(aim.stamp, e);
    this.lastPlaced = this.nowSeen;
    if (kind === 'ramp') {
      this.lastRampDir = aim.stamp.dir;
      // The landing sits five cells along the ramp and four up; go there before anything else.
      const [dx, dz] = SHAPE_DIRS[aim.stamp.dir];
      const floors = aim.stamp.floors;
      const top = floors[floors.length - 2] ?? floors[floors.length - 1];
      this.legGoal = top ? new THREE.Vector3(top.x + 0.5, top.y + 1, top.z + 0.5) : new THREE.Vector3(e.pos.x + dx * 5.5, e.pos.y + 4, e.pos.z + dz * 5.5);
      this.legUntil = this.nowSeen + 7;
    }
    return true;
  }

  /** A ramp toward a higher enemy so the fight is not all from below. */
  private buildToward(target: THREE.Vector3, asc: AscentState): void {
    const e = this.entity;
    const keepYaw = e.yaw;
    const d = tmp.copy(target).sub(e.pos);
    e.yaw = Math.atan2(-d.x, -d.z);
    const ok = this.tryPlace('ramp', asc);
    e.yaw = keepYaw;
    if (ok) this.buildCooldown = 2.5;
    else this.buildCooldown = 1;
  }

  /** Keep the mark's bounty in mind: a marked bot builds its way up a little more eagerly. */
  get wantsHeight(): boolean {
    return this.job === 'climb' && this.entity.bricks >= ASCENT.dropMin;
  }
}
