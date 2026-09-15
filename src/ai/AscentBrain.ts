import * as THREE from 'three';
import { BotBrain, type BotContext, type BotProfile, type Intent } from './BotBrain';
import type { NavSystem } from './NavSystem';
import type { Entity } from '../sim/Entities';
import type { AscentState } from '../sim/Ascent';
import { ASCENT } from '../sim/Ascent';
import { PIECES, quantizeYaw, type PieceKind, type SkyBuilder } from '../build/SkyBuild';
import { CELL, DIRS, cellOf, cellX, cellZ, type SkyCell } from '../build/SkyPlan';
import { PLAYABLE_RADIUS } from '../world/Layout';

type Job = 'climb' | 'hunt' | 'loot' | 'flee' | 'hold' | 'fight' | 'cross';

/**
 * A Sky Flag player. It shares the classic brain's eyes, aim and trigger, and adds its own idea of
 * where to be: fight what it sees, climb out of the rising sea, hold the flag once it has it, cross
 * to the marked leader on a bridge, pick up bricks lying near, and otherwise keep building upward —
 * a stair tower on the cell in front, walked to the top, then another. Because every module is a
 * finished piece of architecture with a known way through it, the bot follows the architect's own
 * waypoints instead of feeling its way up a slope.
 */
export class AscentBrain extends BotBrain {
  private job: Job = 'climb';
  private jobTimer = 0;
  private buildCooldown = 0;
  private goalPoint: THREE.Vector3 | null = null;
  private dropTarget: THREE.Vector3 | null = null;
  private lootUntil = 0;
  private lootId = -1;
  private lootGaveUp = new Map<number, number>();
  private nowSeen = 0;
  /** The way through the module just placed: waypoints in order, from the door to the top. */
  private route: THREE.Vector3[] = [];
  private routeAt = 0;
  private routeUntil = 0;
  private wpUntil = 0;
  private stuckHere = 0;
  private readonly progressPos = new THREE.Vector3(1e9, 0, 0);
  private lastPlaced = 0;
  private think = 0;
  private lastIntent: Intent | null = null;
  /** Last module tried and its verdict (diagnostics). */
  lastAimReason = '';

  constructor(
    entity: Entity,
    ctx: BotContext,
    profile: BotProfile,
    seed: number,
    private sky: SkyBuilder,
    private ascent: () => AscentState | null,
  ) {
    super(entity, ctx, profile, seed);
  }

  override reset(): void {
    super.reset();
    this.job = 'climb';
    this.jobTimer = 0;
    this.buildCooldown = this.rand.range(0.4, 1.6);
    this.goalPoint = null;
    this.dropTarget = null;
    this.route = [];
    this.routeAt = 0;
    this.lastPlaced = this.nowSeen;
  }

  protected override decide(dt: number, now: number, threat: Entity | null, nav: NavSystem | null): Intent {
    const e = this.entity;
    const asc = this.ascent();
    if (!asc) return { goal: null, sprint: false, crouch: false };
    this.nowSeen = now;
    this.buildCooldown -= dt;
    this.jobTimer -= dt;
    this.watchProgress(dt);
    // Far from anyone watching and not in a fight, thinking every other frame is indistinguishable
    // and costs half as much with twelve of them on the island.
    this.think++;
    if (!threat && this.lastIntent && (this.think & 1) === 0) {
      const far = this.ctx.entities().every((o) => o === e || !o.alive || o.isBot || o.pos.distanceToSquared(e.pos) > 3600);
      if (far) return this.lastIntent;
    }
    this.coverLogic(dt, threat, nav);
    // Up on a structure there is nowhere to fall back to: stand and shoot instead of running off.
    const aloft = asc.altitude(e) > 2.5;
    if (aloft && (this.state === 'cover' || this.state === 'retreat')) this.state = 'hold';
    if (this.state === 'cover') return { goal: this.coverGoal, sprint: true, crouch: false };
    if (this.state === 'retreat') return { goal: null, sprint: false, crouch: false };

    const seaGap = e.pos.y - asc.seaLevel;
    const drowningSoon = asc.seaRising && seaGap < 8;
    const carrying = asc.holder === e;
    const fighting = !!threat && (this.seesTarget || e.pos.distanceTo(this.lastSeen) < 18) && !drowningSoon && !carrying;
    if (this.jobTimer <= 0 || drowningSoon || carrying || (!fighting && this.job === 'fight')) {
      this.jobTimer = 0.6 + this.rand.range(0, 0.6);
      this.job = this.pickJob(asc, drowningSoon, carrying);
    }
    if (fighting) {
      this.job = 'fight';
      this.state = aloft ? 'hold' : 'engage';
      e.task = 'fight';
      // Losing a fight from below: throw up a tower and take the high ground back.
      if (threat && threat.pos.y > e.pos.y + 4 && this.buildCooldown <= 0 && e.bricks >= PIECES.tower.cost && this.rand.chance(0.5)) {
        this.buildUp(asc, this.dirToward(threat.pos));
      }
      return { goal: null, sprint: false, crouch: false };
    }
    e.task = this.job;

    let goal: THREE.Vector3 | null = null;
    let sprint = true;
    switch (this.job) {
      case 'flee':
        goal = this.climb(asc, true);
        break;
      case 'hold': {
        this.state = 'hold';
        sprint = false;
        const spot = carrying ? this.higherGround(asc, 12) : null;
        goal = spot && spot.y > e.pos.y + 1 ? spot : null;
        if (!goal) this.scan(now);
        if (!carrying && e.bricks >= PIECES.tower.cost) this.jobTimer = 0;
        break;
      }
      case 'hunt': {
        const prey = this.prey(asc);
        if (prey) goal = prey.pos.clone();
        else this.job = 'climb';
        break;
      }
      case 'cross': {
        const prey = this.prey(asc);
        if (!prey) {
          this.job = 'climb';
          break;
        }
        goal = this.crossTo(asc, prey);
        break;
      }
      case 'loot': {
        goal = this.dropTarget;
        if (!goal || !asc.drops.some((d) => !d.dead && d.pos.distanceTo(goal!) < 1.2) || now > this.lootUntil) {
          if (goal && now > this.lootUntil) this.lootGaveUp.set(this.lootId, now + 25);
          this.dropTarget = null;
          this.job = 'climb';
          goal = this.climb(asc, false);
        }
        break;
      }
      case 'climb':
      default:
        goal = this.climb(asc, false);
        break;
    }
    this.state = goal ? 'approach' : this.state === 'hold' ? 'hold' : 'idle';
    this.goalPoint = goal;
    if (goal) {
      // A waypoint inside a module is walked to, not sprinted past.
      if (this.route.length > 0) sprint = false;
      this.lookAt(goal);
    }
    this.lastIntent = { goal: this.goalPoint, sprint, crouch: false };
    return this.lastIntent;
  }

  // ---- what to do -----------------------------------------------------------

  private prey(asc: AscentState): Entity | null {
    const e = this.entity;
    if (asc.holder && asc.holder.alive && asc.holder !== e) return asc.holder;
    if (asc.marked && asc.marked !== e && asc.marked.alive) return asc.marked;
    return null;
  }

  private pickJob(asc: AscentState, drowningSoon: boolean, carrying: boolean): Job {
    const e = this.entity;
    if (carrying) return 'hold';
    if (drowningSoon) return 'flee';
    const flagD = Math.hypot(asc.flagPos.x - e.pos.x, asc.flagPos.z - e.pos.z);
    const flagUp = asc.flagPos.y - e.pos.y;
    if (!asc.flagHeld && flagD < 20 && flagUp < 14) return 'climb';
    // Bricks on the floor are worth a detour, more so when short of them.
    const drop = this.bestDrop(asc);
    if (drop) {
      this.dropTarget = drop.pos.clone();
      this.lootId = drop.id;
      this.lootUntil = this.nowSeen + 8 + drop.dist * 0.4;
      return 'loot';
    }
    const prey = this.prey(asc);
    if (prey) {
      const d = Math.hypot(prey.pos.x - e.pos.x, prey.pos.z - e.pos.z);
      const up = prey.pos.y - e.pos.y;
      const eager = prey === asc.holder ? 1.6 : 1;
      if (d < 30 * eager && Math.abs(up) < 8 && this.rand.chance(0.6 * this.profile.searchSkill + 0.3)) {
        // Close and level: walk there, bridging the gap if there is one.
        return e.bricks >= PIECES.bridge.cost ? 'cross' : 'hunt';
      }
    }
    if (e.bricks < PIECES.tower.cost && asc.altitude(e) > 2.5 && this.route.length === 0) return 'hold';
    return 'climb';
  }

  private bestDrop(asc: AscentState): { pos: THREE.Vector3; id: number; dist: number } | null {
    const e = this.entity;
    let best: { pos: THREE.Vector3; id: number; dist: number } | null = null;
    let bestD = e.bricks < 8 ? 42 : 24;
    const others = this.ctx.entities();
    const aloft = asc.altitude(e) > 2.5;
    for (const d of asc.drops) {
      if (d.dead) continue;
      const gaveUp = this.lootGaveUp.get(d.id);
      if (gaveUp !== undefined && gaveUp > this.nowSeen) continue;
      const dist = d.pos.distanceTo(e.pos);
      const dy = d.pos.y - e.pos.y;
      if (dist >= bestD || dy > 7 || dy < -14) continue;
      // From a tower, only bricks on this floor are worth it; a long drop for them is not.
      if (aloft && dy < -3 && dist > 7) continue;
      let closer = 0;
      for (const o of others) if (o !== e && o.alive && o.pos.distanceTo(d.pos) < dist) closer++;
      if (closer >= 3) continue;
      bestD = dist;
      best = { pos: d.pos, id: d.id, dist };
    }
    return best;
  }

  // ---- climbing -------------------------------------------------------------

  /**
   * Up. While a module is being walked, follow its waypoints; when the top is reached, put the next
   * one down in front and start again. Every tower leans toward the flag, so the whole structure
   * grows into the column the flag is coming down.
   */
  private climb(asc: AscentState, urgent: boolean): THREE.Vector3 | null {
    const e = this.entity;
    const now = this.nowSeen;
    // Following a route through a module: step past every waypoint already behind us, so a bot that
    // started halfway up its own tower does not walk back down to the door first.
    if (this.route.length > 0) {
      // Waypoints are ticked off by standing on them, in order. Each one gets a few seconds: a
      // corner that cannot be reached is stepped over rather than stalling the whole climb.
      while (this.routeAt < this.route.length) {
        const wp = this.route[this.routeAt];
        if (Math.hypot(wp.x - e.pos.x, wp.z - e.pos.z) < 2 && Math.abs(e.pos.y - wp.y) < 3) {
          this.routeAt++;
          this.wpUntil = now + 3.5;
        } else break;
      }
      if (this.routeAt < this.route.length && now > this.wpUntil) {
        this.routeAt++;
        this.wpUntil = now + 3.5;
      }
      if (this.routeAt >= this.route.length || now > this.routeUntil) {
        this.route = [];
        this.routeAt = 0;
        this.buildCooldown = Math.min(this.buildCooldown, 0.2);
      }
      if (this.route.length > 0) return this.route[this.routeAt].clone();
    }
    // Nothing under way: build the next step up, and now and then widen the floor we are on.
    if (this.buildCooldown <= 0 && e.bricks >= PIECES.tower.cost) {
      if (e.bricks >= PIECES.tower.cost + PIECES.deck.cost * 2 && this.rand.chance(0.25) && this.widen(asc)) return null;
      const dir = this.dirToward(asc.flagPos);
      if (this.buildUp(asc, dir)) return this.route.length > 0 ? this.route[0].clone() : null;
      // Boxed in: a deck to the side opens a cell the next tower can stand on.
      if (e.bricks >= PIECES.tower.cost + PIECES.deck.cost && this.widen(asc)) return null;
      // Still nowhere to build: walk along this floor to a deck with room beside it and try there.
      const room = this.roomToBuild(asc);
      if (room) return room;
    }
    const aloft = asc.altitude(e) > 2.5;
    if (urgent) {
      // The water is at our heels: anything higher is worth the risk, and inland is uphill.
      const high = this.higherGround(asc, 60);
      return high ?? new THREE.Vector3(e.pos.x * 0.7, e.pos.y, e.pos.z * 0.7);
    }
    // Up on a deck with nothing to build: stay on it. Walking to a neighbour's tower means
    // walking off this one, and there is no path grid up here to stop that.
    if (aloft) return null;
    // On the ground: go and stand at the foot of the nearest structure, ready to climb it.
    const foot = this.nearestFooting(asc);
    return foot;
  }

  /** Puts a stair tower (or a ramp where a tower will not fit) in front and remembers the way up it. */
  private buildUp(asc: AscentState, dir: number): boolean {
    const e = this.entity;
    if (e.pos.x * e.pos.x + e.pos.z * e.pos.z > (PLAYABLE_RADIUS - 12) * (PLAYABLE_RADIUS - 12)) return false;
    const [pi, pj] = cellOf(e.pos.x, e.pos.z);
    const y = this.sky.floorAt(e.pos, e.pos.x, e.pos.z);
    const [dx, dz] = DIRS[dir];
    const spots: [number, number, number][] = [
      [pi + dx, pj + dz, dir],
      [pi, pj, dir],
      [pi + DIRS[(dir + 1) & 3][0], pj + DIRS[(dir + 1) & 3][1], (dir + 1) & 3],
      [pi + DIRS[(dir + 3) & 3][0], pj + DIRS[(dir + 3) & 3][1], (dir + 3) & 3],
    ];
    for (const [ci, cj, cdir] of spots) {
      const kind: PieceKind = 'tower';
      const aim = this.sky.aimCell(kind, ci, cj, y, cdir, e, e.bricks);
      this.lastAimReason = `${kind}:${aim.reason}`;
      if (aim.reason !== 'ok' || !aim.plan) continue;
      if (!asc.spend(e, aim.cost)) return false;
      const cells = aim.plan.cells.slice();
      this.sky.place(aim.plan, e);
      this.startRoute(cells, aim.plan.top);
      this.buildCooldown = 0.5 + this.rand.range(0, 0.3);
      this.lastPlaced = this.nowSeen;
      return true;
    }
    this.buildCooldown = 1.2;
    return false;
  }

  /** The waypoints of a module just placed, from where the bot stands to the surface it gains. */
  private startRoute(cells: SkyCell[], top: THREE.Vector3): void {
    const e = this.entity;
    const body = cells.find((c) => c.kind === 'tower' || c.kind === 'ramp');
    const pts = body ? this.sky.arch.waypoints(body) : [];
    pts.push(top.clone());
    this.route = pts;
    this.routeAt = 0;
    this.wpUntil = this.nowSeen + 3.5;
    this.routeUntil = this.nowSeen + 3 + pts.length * 3.5;
    void e;
  }

  /** Builds a bridge toward someone on about our level, then walks it. */
  private crossTo(asc: AscentState, prey: Entity): THREE.Vector3 | null {
    const e = this.entity;
    if (this.route.length > 0) return this.climb(asc, false);
    const gap = Math.hypot(prey.pos.x - e.pos.x, prey.pos.z - e.pos.z);
    if (gap < 9) return prey.pos.clone();
    if (this.buildCooldown <= 0 && e.bricks >= PIECES.bridge.cost) {
      const dir = this.dirToward(prey.pos);
      const [dx, dz] = DIRS[dir];
      const [pi, pj] = cellOf(e.pos.x, e.pos.z);
      const y = this.sky.floorAt(e.pos, e.pos.x, e.pos.z);
      const aim = this.sky.aimCell('bridge', pi + dx, pj + dz, y, dir, e, e.bricks);
      this.lastAimReason = `bridge:${aim.reason}`;
      if (aim.reason === 'ok' && aim.plan && asc.spend(e, aim.cost)) {
        this.sky.place(aim.plan, e);
        this.buildCooldown = 1.4;
        this.lastPlaced = this.nowSeen;
        return aim.plan.top.clone();
      }
      this.buildCooldown = 1.2;
    }
    return prey.pos.clone();
  }

  /** The facing that points at a place. */
  private dirToward(p: THREE.Vector3): number {
    const e = this.entity;
    return quantizeYaw(Math.atan2(-(p.x - e.pos.x), -(p.z - e.pos.z)));
  }

  /** Adds a deck beside the one we stand on, so a tower grows into a hall you can fight across. */
  private widen(asc: AscentState): boolean {
    const e = this.entity;
    const here = this.sky.cellUnder(e.pos);
    if (!here) return false;
    const start = this.rand.int(0, 3);
    for (let n = 0; n < 4; n++) {
      const d = (start + n) & 3;
      const [dx, dz] = DIRS[d];
      const aim = this.sky.aimCell('deck', here.i + dx, here.j + dz, here.y, d, e, e.bricks);
      this.lastAimReason = `deck:${aim.reason}`;
      if (aim.reason !== 'ok' || !aim.plan) continue;
      if (!asc.spend(e, aim.cost)) return false;
      this.sky.place(aim.plan, e);
      this.buildCooldown = 0.4;
      this.lastPlaced = this.nowSeen;
      return true;
    }
    this.buildCooldown = 0.6;
    return false;
  }

  /** A deck on this floor with a free cell beside it: somewhere the next tower will actually fit. */
  private roomToBuild(asc: AscentState): THREE.Vector3 | null {
    const e = this.entity;
    const my = Math.round(e.pos.y) - 1;
    let best: THREE.Vector3 | null = null;
    let bestD = 30;
    for (const s of this.sky.plan.standing()) {
      if (Math.abs(s.cell.y - my) > 2 || s.y < asc.seaLevel + 1) continue;
      const d = Math.hypot(s.x - e.pos.x, s.z - e.pos.z);
      if (d > bestD || d < 3) continue;
      const free = DIRS.some(([dx, dz]) => !this.sky.plan.get(s.cell.i + dx, s.cell.j + dz, s.cell.y));
      if (!free) continue;
      bestD = d;
      best = new THREE.Vector3(s.x, s.y + 0.1, s.z);
    }
    return best;
  }

  /** A spot on the ground beside the nearest structure, so a climb can start there. */
  private nearestFooting(asc: AscentState): THREE.Vector3 | null {
    const e = this.entity;
    let best: THREE.Vector3 | null = null;
    let bestD = 40;
    for (const s of this.sky.plan.standing()) {
      if (s.y > e.pos.y + 2.5 || s.y < asc.seaLevel + 1) continue;
      const d = Math.hypot(s.x - e.pos.x, s.z - e.pos.z);
      if (d > bestD || d < 6) continue;
      bestD = d;
      best = new THREE.Vector3(s.x, s.y + 0.1, s.z);
    }
    return best;
  }

  /** The highest standable deck within a radius that is above us. */
  private higherGround(asc: AscentState, radius: number): THREE.Vector3 | null {
    const e = this.entity;
    let best: THREE.Vector3 | null = null;
    let bestY = e.pos.y + 0.5;
    for (const s of this.sky.plan.standing()) {
      if (s.y <= bestY) continue;
      if (s.y < asc.seaLevel + 2) continue;
      const d = Math.hypot(s.x - e.pos.x, s.z - e.pos.z);
      if (d > radius) continue;
      bestY = s.y;
      best = new THREE.Vector3(s.x, s.y + 0.1, s.z);
      break;
    }
    return best;
  }

  /** Slow turn on the spot while holding a deck, so a bot on watch is not blind behind it. */
  private scan(now: number): void {
    const e = this.entity;
    e.yaw += Math.sin(now * 0.45 + e.id) * 0.01;
  }

  /** Whether this bot wants height right now (used by the mark logic). */
  get wantsHeight(): boolean {
    return this.job === 'climb' && this.entity.bricks >= ASCENT.dropMin;
  }

  /** Progress watchdog: a bot that has not moved for a while gives up on its route. */
  protected watchProgress(dt: number): void {
    const e = this.entity;
    if (e.pos.distanceToSquared(this.progressPos) > 0.05) {
      this.stuckHere = 0;
      this.progressPos.copy(e.pos);
      return;
    }
    this.stuckHere += dt;
    if (this.stuckHere > 2.5) {
      this.stuckHere = 0;
      // Inside a module, a hop only breaks the climb: drop the route and build a fresh way up.
      const onRoute = this.route.length > 0;
      this.route = [];
      this.routeAt = 0;
      this.buildCooldown = 0.2;
      if (!onRoute && e.grounded) {
        e.vel.y = Math.max(e.vel.y, 7);
        e.grounded = false;
      }
    }
  }
}

/** Cell middle at a given floor, in world coordinates. */
export function cellCentre(i: number, j: number, y: number): THREE.Vector3 {
  return new THREE.Vector3(cellX(i) + CELL / 2, y + 1, cellZ(j) + CELL / 2);
}
