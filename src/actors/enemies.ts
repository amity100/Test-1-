import * as THREE from 'three';
import {
  LAW,
  type ActorSnap,
  type CharacterAPI,
  type DamageSource,
  type DeathContext,
  type DeathKind,
  type DynBody,
  type EnemyAPI,
  type EnemyContext,
  type EnemyHooks,
  type EnemyKind,
  type EnemyView,
  type HitInfo,
  type HitResult,
  type ImpactInfo,
  type NavLayer,
  type PhysicsAPI,
  type RiftEnd,
  type SpawnDef,
  type Threat,
  type TrapTarget,
  type V3,
  type ZoneId,
} from '../core/contracts';
import type { CollisionWorld } from '../world/collision';
import { NavGrid } from '../world/nav';
import { angleDiff, dampAngle, hdist, mulberry32, stepAngle, yawTo } from './aimath';
import { chargeUpdate, combat, endAttack, type Brain } from './behaviors';
import { Enemy } from './enemy';
import { detectRate, seePlayer, seesPoint } from './perception';
import { TurretRig } from './turret';
import { AI, KIND } from './tuning';

export { Enemy } from './enemy';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _hearA = new THREE.Vector3();
const _hearB = new THREE.Vector3();
const NO_SOURCE_SHIELD: ReadonlySet<DamageSource> = new Set<DamageSource>(['shear', 'void', 'water', 'explosion', 'blade', 'crush']);
const BOSS_SHIELDED: ReadonlySet<DamageSource> = new Set<DamageSource>(['bolt', 'beam', 'grenade', 'impact', 'explosion']);

function byRank(a: Enemy, b: Enemy) {
  return a.rankD - b.rankD;
}

export function deathKindOf(src: DamageSource): DeathKind {
  switch (src) {
    case 'water': return 'drown';
    case 'shear':
    case 'blade': return 'cut';
    case 'grenade':
    case 'explosion': return 'blast';
    case 'bolt':
    case 'beam':
    case 'melee':
    case 'hazard': return 'shot';
    default: return 'fall';
  }
}

/**
 * Kessler Security: spawning, perception, the per-kind AI, damage rules
 * (shields, armour, launches, landings) and the views the game needs
 * (threats for CATCH, trapdoor targets, jammer bubbles, the boss).
 *
 * Every enemy owns a DynBody. Walking bodies are kinematic (we set vel, the
 * game's physics.step moves them); launched / downed-in-air / dead bodies
 * simulate. The character root follows the body.
 */
export class EnemySystem implements EnemyAPI, Brain {
  readonly list: Enemy[] = [];
  readonly group = new THREE.Group();

  private readonly byId = new Map<number, Enemy>();
  private nextId = 1;
  private readonly navs = new Map<ZoneId, NavGrid[]>();
  private navWorld: CollisionWorld | null = null;
  private readonly pathQueue: Enemy[] = [];
  private pathHead = 0;
  private tokens = 0;
  private barkGap = 0;
  private rankT = 0;
  private readonly ranked: Enemy[] = [];
  private readonly witnesses: Enemy[] = [];
  private readonly lastPlayer = new THREE.Vector3();
  private hasPlayer = false;
  private arena: { center: V3; radius: number; points: V3[] } | null = null;
  private summoned = 0;
  private rng = mulberry32(0x5eed);
  private _ctx: EnemyContext | null = null;
  time = 0;

  // pooled outputs (valid until the next call)
  private readonly threatPool: Threat[] = [];
  private readonly threatOut: Threat[] = [];
  private readonly trapPool: TrapTarget[] = [];
  private readonly trapOut: TrapTarget[] = [];
  private readonly blockPool: { pos: V3; radius: number }[] = [];
  private readonly blockOut: { pos: V3; radius: number }[] = [];

  constructor(
    private readonly physics: PhysicsAPI,
    readonly hooks: EnemyHooks,
    private readonly makeChar: (kind: EnemyKind) => CharacterAPI,
  ) {
    this.group.name = 'enemies';
  }

  get ctx(): EnemyContext {
    if (!this._ctx) throw new Error('EnemySystem: update() has not run yet');
    return this._ctx;
  }

  private get world(): CollisionWorld | null {
    return this._ctx?.world ?? this.navWorld;
  }

  /** Reseed the AI's PRNG (tests / deterministic replays). */
  seed(n: number) {
    this.rng = mulberry32(n);
  }

  rand() {
    return this.rng();
  }

  between(r: readonly [number, number]) {
    return r[0] + (r[1] - r[0]) * this.rng();
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  /** Build nav grids for a zone (one per floor). An enemy walks the layer whose floorY is nearest his feet (within 1.2 m). */
  setNav(zone: ZoneId, layers: NavLayer[], world: CollisionWorld) {
    this.navWorld = world;
    this.navs.set(zone, layers.map((l) => new NavGrid(world, l)));
    for (let i = 0; i < this.list.length; i++) this.list[i].grid = null;
  }

  navFor(zone: ZoneId): NavGrid[] {
    return this.navs.get(zone) ?? [];
  }

  /** Crown boss arena: where Voss strafes and the red-rift blink targets. */
  setBossArena(center: V3, radius: number, blinkPoints: V3[]) {
    this.arena = { center: center.clone(), radius, points: blinkPoints.map((p) => p.clone()) };
  }

  spawn(def: SpawnDef): EnemyView {
    const id = this.nextId++;
    const tune = KIND[def.kind];
    const char = def.kind === 'turret' ? new TurretRig() : this.makeChar(def.kind);
    const body = this.physics.createBody('enemy', {
      pos: def.pos.clone(),
      radius: tune.radius,
      height: tune.height,
      team: 'kessler',
      simulate: false,
      bounce: 0,
      friction: 1,
    });
    body.userData.enemyId = id;
    body.vel.set(0, 0, 0);
    // frozen until an update finds his zone active
    body.enabled = false;
    const e = new Enemy(id, def, char, body, (id * 0.047) % AI.senseInterval);
    e.state = this.baseState(e);
    e.routeIdx = def.route && def.route.length > 1 ? 1 % def.route.length : 0;
    char.root.position.copy(def.pos);
    char.root.rotation.y = def.yaw;
    char.root.visible = false;
    this.group.add(char.root);
    this.list.push(e);
    this.byId.set(id, e);
    // later encounters of a zone start as their defs say, even mid-fight
    if (def.state === 'combat') this.enterCombat(e, null);
    return e;
  }

  get(id: number): EnemyView | null {
    return this.byId.get(id) ?? null;
  }

  byKey(key: string): EnemyView | null {
    if (!key.startsWith('enemy:')) return null;
    return this.byId.get(Number(key.slice(6))) ?? null;
  }

  enemyOfBody(b: DynBody): EnemyView | null {
    const id = b.userData.enemyId;
    return typeof id === 'number' ? this.byId.get(id) ?? null : null;
  }

  private own(v: EnemyView): Enemy | null {
    return this.byId.get(v.id) ?? null;
  }

  clear() {
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (e.body) this.physics.removeBody(e.body);
      e.body = null;
      e.char.dispose();
      this.group.remove(e.char.root);
    }
    this.list.length = 0;
    this.byId.clear();
    this.pathQueue.length = 0;
    this.pathHead = 0;
    this.tokens = 0;
    this.threatOut.length = 0;
    this.trapOut.length = 0;
    this.blockOut.length = 0;
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  update(dt: number, ctx: EnemyContext) {
    this._ctx = ctx;
    this.time = ctx.time;
    if (ctx.player.alive) {
      this.lastPlayer.copy(ctx.player.pos);
      this.hasPlayer = true;
    }
    this.barkGap -= dt;
    this.processPaths();
    this.rankT -= dt;
    if (this.rankT <= 0) {
      this.rankT = 0.5;
      this.rankThinkers();
    }
    let tokens = 0;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      // a corpse the player is carrying (manual body) goes wherever he goes
      const on = ctx.activeZones.has(e.def.zone) || (!!e.body && e.body.userData.manual === true);
      if (on !== e.active) this.setActive(e, on);
      if (!on) continue;
      e.age += dt;
      e.activeT += dt;
      if (!e.alive) {
        this.updateCorpse(e, dt);
        continue;
      }
      this.think(e, dt);
      if (e.token) {
        if (e.atk !== 'aim' && e.atk !== 'fire') this.releaseToken(e);
        else tokens++;
      }
      this.animate(e, dt);
    }
    this.tokens = tokens;
  }

  /** Root ← body for everything visible (call after physics.step if it runs after update). */
  sync() {
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (e.active && e.body && !e.gone) e.char.root.position.copy(e.body.pos);
    }
  }

  private setActive(e: Enemy, on: boolean) {
    e.active = on;
    e.activeT = 0;
    e.char.root.visible = on && !e.gone;
    if (e.body) {
      e.body.enabled = on;
      if (!on && !e.body.simulate) e.body.vel.set(0, 0, 0);
    }
    if (!on && e.alive) {
      if (e.state === 'charge') this.endCharge(e);
      endAttack(this, e);
    }
  }

  private rankThinkers() {
    const arr = this.ranked;
    arr.length = 0;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (e.alive && e.active) arr.push(e);
    }
    if (arr.length <= AI.maxThinking) {
      for (let i = 0; i < arr.length; i++) arr[i].thinking = true;
      return;
    }
    for (let i = 0; i < arr.length; i++) arr[i].rankD = arr[i].pos.distanceToSquared(this.lastPlayer);
    arr.sort(byRank);
    for (let i = 0; i < arr.length; i++) arr[i].thinking = i < AI.maxThinking || arr[i].kind === 'boss';
  }

  private think(e: Enemy, dt: number) {
    const b = e.body;
    e.stateT += dt;
    e.lookT -= dt;
    e.shieldT -= dt;
    e.barkT -= dt;
    // a kinematic walker lost his footing (trapdoor, edge): physics takes him
    if (b && !b.simulate && e.kind !== 'turret') {
      e.noGroundT = b.onGround ? 0 : e.noGroundT + dt;
      if (e.noGroundT > 0.06 && e.activeT > 0.3) this.beginLaunch(e, false);
    }
    switch (e.state) {
      case 'launched': return this.updateLaunched(e, dt);
      case 'stagger': return this.updateStagger(e, dt);
      case 'downed':
      case 'stunned': return this.updateDown(e, dt);
      case 'charge': return chargeUpdate(this, e, dt);
    }
    if (!e.thinking) {
      this.halt(e, dt);
      return;
    }
    this.perceive(e, dt);
    if (e.mode === 'combat') combat(this, e, dt);
    else this.calm(e, dt);
  }

  private animate(e: Enemy, dt: number) {
    const b = e.body;
    const root = e.char.root;
    const L = e.loco;
    if (b) {
      root.position.copy(b.pos);
      L.speed = Math.hypot(b.vel.x, b.vel.z);
      L.grounded = !b.simulate || b.onGround;
      L.vy = b.simulate ? b.vel.y : 0;
    } else {
      L.speed = 0;
      L.grounded = true;
      L.vy = 0;
    }
    root.rotation.y = e.yaw;
    L.weaponUp = e.tune.gun && e.mode === 'combat' ? 1 : 0;
    L.downed = e.state === 'downed' || e.state === 'stunned';
    L.aim = e.kind === 'turret' ? e.pitch : 0;
    if (b && (e.state === 'launched' || (b.simulate && !b.onGround))) e.char.setTumble(b.quat);
    e.char.update(dt, L);
  }

  private updateCorpse(e: Enemy, dt: number) {
    if (e.sinkT > 0) {
      e.sinkT -= dt;
      if (e.sinkT <= 0) this.vanish(e);
    }
    const b = e.body;
    const L = e.loco;
    L.speed = 0;
    L.vy = 0;
    L.weaponUp = 0;
    L.downed = false;
    if (b && !e.gone) {
      e.char.root.position.copy(b.pos);
      const flying = b.simulate && !b.onGround && b.vel.lengthSq() > 4;
      if (flying) {
        e.char.setTumble(b.quat);
        e.corpseTumble = true;
      } else if (e.corpseTumble && b.onGround) {
        e.char.setTumble(null);
        e.corpseTumble = false;
        b.quat.identity();
      }
      L.grounded = b.onGround;
    }
    e.char.update(dt, L);
  }

  /** Gone for good (void, sunk): body out of physics, mesh hidden. */
  private vanish(e: Enemy) {
    if (e.body) {
      e.home.copy(e.body.pos);
      this.physics.removeBody(e.body);
      e.body = null;
    }
    e.gone = true;
    e.char.root.visible = false;
  }

  // -------------------------------------------------------------------------
  // Perception and mind
  // -------------------------------------------------------------------------

  private perceive(e: Enemy, dt: number) {
    const ctx = this.ctx;
    const pl = ctx.player;
    e.senseAcc += dt;
    e.senseT -= dt;
    if (e.senseT <= 0) {
      e.senseT += AI.senseInterval;
      if (e.senseT <= 0) e.senseT = AI.senseInterval;
      const elapsed = Math.min(0.5, e.senseAcc);
      e.senseAcc = 0;
      const d = seePlayer(e, ctx);
      e.seesPlayer = d >= 0;
      e.seeDist = d >= 0 ? d : Infinity;
      if (e.seesPlayer) {
        e.lastKnown.copy(pl.pos);
        e.hasLastKnown = true;
        e.lastSeenT = this.time;
      }
      if (e.mode !== 'combat') {
        if (e.seesPlayer) e.sus += elapsed * detectRate(d, e.tune.sight) * (pl.crouched ? 0.7 : 1);
        else if (this.time - e.lastSeenT > 2) e.sus = Math.max(0, e.sus - elapsed * 0.15);
        if (e.sus >= 1) this.enterCombat(e, e);
        else if (e.seesPlayer && e.sus >= AI.suspiciousAt) this.becomeSuspicious(e, pl.pos);
      }
    }
    // hearing
    const noise = pl.noise;
    for (let i = 0; i < noise.length; i++) {
      const n = noise[i];
      const d = e.pos.distanceTo(n.at);
      if (d > n.radius) continue;
      if (e.mode === 'combat') {
        if (!e.seesPlayer) {
          e.lastKnown.copy(n.at);
          e.hasLastKnown = true;
        }
      } else {
        e.sus = Math.max(e.sus, d < n.radius * 0.4 ? 0.75 : 0.45);
        this.becomeSuspicious(e, n.at);
      }
    }
  }

  private baseState(e: Enemy) {
    if (e.mode === 'combat') return 'combat' as const;
    if (e.mode === 'suspicious') return 'suspicious' as const;
    const r = e.def.route;
    return e.def.state !== 'idle' && r && r.length > 1 && !e.perched ? ('patrol' as const) : ('idle' as const);
  }

  private becomeSuspicious(e: Enemy, at: V3) {
    if (!e.alive || e.mode === 'combat') return;
    e.investigate.copy(at);
    if (e.mode === 'suspicious') {
      // a fresh clue: go and look again
      e.stateT = Math.min(e.stateT, 1);
      e.hasGoal = false;
      return;
    }
    e.mode = 'suspicious';
    if (e.state === 'idle' || e.state === 'patrol') {
      e.state = 'suspicious';
      e.stateT = 0;
    }
    e.hasGoal = false;
    this.bark(e, 'bark.what');
  }

  /**
   * He knows. Entering combat makes the zone hot: every living enemy of the
   * zone joins (DESIGN §5 perception). `propagate` is off for those joiners.
   */
  private enterCombat(e: Enemy, spotter: Enemy | null, propagate = true) {
    if (!e.alive) return;
    const fresh = e.mode !== 'combat';
    if (fresh) {
      e.mode = 'combat';
      e.sus = 1;
      if (this.hasPlayer) {
        e.lastKnown.copy(this.lastPlayer);
        e.hasLastKnown = true;
      }
      e.reloadT = Math.max(e.reloadT, this.between(AI.engageDelay));
      e.lobT = Math.max(e.lobT, 1.5 + this.rand() * 1.5);
      e.chargeCd = Math.max(e.chargeCd, 1.2);
      e.blinkNext = AI.boss.blinkEvery;
      e.summonT = 3;
      e.hasSpot = false;
      e.hasGoal = false;
      this.hooks.becameAware(e);
      if (e.kind === 'boss' && !e.greeted) {
        e.greeted = true;
        this.bark(e, 'bark.boss1', true);
      }
    }
    if (e.state === 'idle' || e.state === 'patrol' || e.state === 'suspicious') {
      e.state = 'combat';
      e.stateT = 0;
    }
    if (fresh && propagate) this.raise(e.def.zone, spotter, e);
  }

  /**
   * The shout carries to his own squad and anyone of the zone within earshot
   * (not the whole zone: later fights stay unaware until you get there).
   */
  private raise(zone: ZoneId, spotter: Enemy | null, origin: Enemy | null = null) {
    if (spotter && spotter.kind !== 'boss' && spotter.kind !== 'turret') this.bark(spotter, 'bark.contact', true);
    for (let i = 0; i < this.list.length; i++) {
      const o = this.list[i];
      if (!o.alive || o.def.zone !== zone || o.mode === 'combat') continue;
      if (origin && o.def.squad !== origin.def.squad && !this.hears(origin, o)) continue;
      this.enterCombat(o, null, false);
    }
  }

  /** Another squad hears the shout: close by, or in earshot with a clear line (walls muffle it). */
  private hears(from: Enemy, o: Enemy) {
    const d = o.pos.distanceTo(from.pos);
    if (d > AI.alertRadius) return false;
    if (d < AI.alertRadiusWalled) return true;
    const w = this.world;
    if (!w) return true;
    _hearA.set(from.pos.x, from.pos.y + 1.6, from.pos.z);
    _hearB.set(o.pos.x, o.pos.y + 1.6, o.pos.z);
    return w.lineOfSight(_hearA, _hearB);
  }

  alertZone(zone: ZoneId) {
    this.raise(zone, null, null);
  }

  /** Some living enemy of the zone is in combat. */
  isHot(zone: ZoneId) {
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (e.alive && e.mode === 'combat' && e.def.zone === zone) return true;
    }
    return false;
  }

  bark(e: Enemy, key: string, force = false) {
    if (!force && (this.barkGap > 0 || e.barkT > 0)) return;
    this.barkGap = AI.barkGap;
    e.barkT = 4;
    this.hooks.bark(e, key);
  }

  private calm(e: Enemy, dt: number) {
    if (e.kind === 'turret') {
      // sweep ±50° around its mount
      this.halt(e, dt);
      e.yaw = stepAngle(e.yaw, e.def.yaw + Math.sin(this.time * 0.5 + e.id) * 0.9, e.tune.turn * 0.5 * dt);
      e.pitch *= 1 - Math.min(1, dt * 2);
      if (e.state === 'suspicious') {
        e.yaw = stepAngle(e.yaw, yawTo(e.pos, e.investigate), e.tune.turn * dt);
        if (e.stateT > 7 && e.sus < 0.35) {
          e.mode = 'calm';
          e.state = 'idle';
        }
      }
      return;
    }
    if (e.state === 'suspicious') {
      if (e.stateT < 0.9 || e.perched || e.stranded) {
        this.halt(e, dt);
        this.face(e, e.investigate, dt);
      } else if (this.moveTo(e, e.investigate, e.tune.walk, dt, true)) {
        this.lookAround(e, dt);
      }
      if (e.stateT > 7 && e.sus < 0.35) {
        e.mode = 'calm';
        e.state = this.baseState(e);
        e.stateT = 0;
        e.hasGoal = false;
      }
      return;
    }
    const route = e.def.route;
    if (e.state === 'patrol' && route && route.length > 1) {
      if (e.waitT > 0) {
        e.waitT -= dt;
        this.halt(e, dt);
        this.lookAround(e, dt);
        if (e.waitT <= 0) e.routeIdx = (e.routeIdx + 1) % route.length;
        return;
      }
      if (this.moveTo(e, route[e.routeIdx], e.tune.walk, dt, true)) {
        e.waitT = e.def.wait?.[e.routeIdx] ?? 2;
        e.lookBase = e.yaw;
      }
      return;
    }
    // idle: back to his post, then a slow look around
    if (!e.perched && !e.stranded && hdist(e.pos, e.def.pos) > 1.2) {
      this.moveTo(e, e.def.pos, e.tune.walk, dt, true);
      return;
    }
    this.halt(e, dt);
    e.yaw = dampAngle(e.yaw, e.def.yaw + Math.sin(this.time * 0.3 + e.id * 1.7) * 0.35, 1.5, dt);
  }

  private lookAround(e: Enemy, dt: number) {
    e.yaw = dampAngle(e.yaw, e.lookBase + Math.sin(this.time * 0.9 + e.id) * 0.7, 2.5, dt);
  }

  // -------------------------------------------------------------------------
  // Movement (Brain)
  // -------------------------------------------------------------------------

  face(e: Enemy, p: V3, dt: number) {
    const want = yawTo(e.pos, p);
    if (Math.abs(p.x - e.pos.x) + Math.abs(p.z - e.pos.z) < 1e-3) return;
    e.yaw = e.tune.turn > 0 ? stepAngle(e.yaw, want, e.tune.turn * dt) : dampAngle(e.yaw, want, 8, dt);
  }

  halt(e: Enemy, dt: number) {
    const b = e.body;
    const k = Math.exp(-14 * dt);
    e.moveVel.multiplyScalar(k);
    if (e.moveVel.lengthSq() < 0.01) e.moveVel.set(0, 0, 0);
    if (b && !b.simulate) b.vel.set(e.moveVel.x, 0, e.moveVel.z);
  }

  moveTo(e: Enemy, goal: V3, speed: number, dt: number, faceMove: boolean): boolean {
    const b = e.body;
    if (!b || b.simulate) return false;
    if (e.perched || e.stranded || speed <= 0) {
      this.halt(e, dt);
      return true;
    }
    const pos = e.pos;
    if (hdist(pos, goal) < 0.6) {
      this.halt(e, dt);
      e.hasGoal = false;
      e.pathLen = 0;
      return true;
    }
    e.repathT -= dt;
    if (!e.hasGoal || (hdist(e.goal, goal) > 1.5 && e.repathT <= 0)) this.plan(e, goal);
    if (e.pathPending) {
      this.halt(e, dt);
      return false;
    }
    if (e.pathIdx >= e.pathLen) {
      this.halt(e, dt);
      return true;
    }
    let wp = e.path[e.pathIdx];
    let dx = wp.x - pos.x, dz = wp.z - pos.z;
    let d = Math.hypot(dx, dz);
    if (d < 0.45) {
      e.pathIdx++;
      if (e.pathIdx >= e.pathLen) {
        this.halt(e, dt);
        return true;
      }
      wp = e.path[e.pathIdx];
      dx = wp.x - pos.x;
      dz = wp.z - pos.z;
      d = Math.max(1e-4, Math.hypot(dx, dz));
    }
    // near a drop (or off the grid): feel ahead before each step
    if (this.world && (!e.grid || e.grid.edgeDistance(pos.x, pos.z) < AI.edgeMargin)) {
      const px = pos.x + (dx / d) * 0.7, pz = pos.z + (dz / d) * 0.7;
      if (this.world.groundAt(px, pz, 0.05, pos.y + 0.5) < pos.y - 0.6) {
        this.halt(e, dt);
        e.pathLen = 0;
        return true;
      }
    }
    this.steer(e, (dx / d) * speed, (dz / d) * speed, dt);
    if (faceMove) e.yaw = dampAngle(e.yaw, Math.atan2(dx, dz), 8, dt);
    // stuck: re-plan, then give up
    e.progressT += dt;
    if (e.progressT > 1) {
      const moved = hdist(pos, e.progressAt);
      e.progressT = 0;
      e.progressAt.copy(pos);
      if (moved < 0.25 * speed) {
        if (e.pathFailed) return true;
        e.pathFailed = true;
        this.plan(e, e.goal);
        e.pathFailed = true;
      }
    }
    return false;
  }

  /** Kinematic walk velocity + a little separation from allies. */
  private steer(e: Enemy, vx: number, vz: number, dt: number) {
    const b = e.body!;
    for (let i = 0; i < this.list.length; i++) {
      const o = this.list[i];
      if (o === e || !o.alive || !o.active || !o.body) continue;
      const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z;
      const min = e.radius + o.radius + 0.25;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min || d2 < 1e-6 || Math.abs(e.pos.y - o.pos.y) > 1.5) continue;
      const d = Math.sqrt(d2);
      const push = ((min - d) / min) * 2.5;
      vx += (dx / d) * push;
      vz += (dz / d) * push;
    }
    const k = 1 - Math.exp(-10 * dt);
    e.moveVel.x += (vx - e.moveVel.x) * k;
    e.moveVel.z += (vz - e.moveVel.z) * k;
    e.moveVel.y = 0;
    b.vel.set(e.moveVel.x, 0, e.moveVel.z);
  }

  private plan(e: Enemy, goal: V3) {
    e.goal.copy(goal);
    e.hasGoal = true;
    e.repathT = 0.6;
    e.pathIdx = 0;
    e.pathFailed = false;
    e.progressT = 0;
    e.progressAt.copy(e.pos);
    const g = this.gridFor(e);
    if (!g || (g.walkable(goal.x, goal.z) && g.clearLine(e.pos.x, e.pos.z, goal.x, goal.z))) {
      slot(e.path, 0).copy(goal);
      e.pathLen = 1;
      e.pathPending = false;
      return;
    }
    e.pathLen = 0;
    if (!e.pathPending) {
      e.pathPending = true;
      this.pathQueue.push(e);
    }
  }

  /** At most AI.maxPathsPerFrame A* searches per frame. */
  private processPaths() {
    let n = 0;
    while (n < AI.maxPathsPerFrame && this.pathHead < this.pathQueue.length) {
      const e = this.pathQueue[this.pathHead++];
      if (!e.pathPending) continue;
      e.pathPending = false;
      if (!e.alive || !e.body || e.body.simulate) continue;
      const g = this.gridFor(e);
      e.pathIdx = 0;
      if (!g) {
        slot(e.path, 0).copy(e.goal);
        e.pathLen = 1;
        continue;
      }
      const k = g.findPathInto(e.pos, e.goal, e.path);
      e.pathLen = Math.max(0, k);
      e.pathFailed = k < 0;
      n++;
    }
    if (this.pathHead >= this.pathQueue.length) {
      this.pathQueue.length = 0;
      this.pathHead = 0;
    }
  }

  /** The nav layer under his feet (nearest floorY within 1.2 m), cached. */
  gridFor(e: Enemy): NavGrid | null {
    const p = e.pos;
    if (e.grid && Math.abs(p.y - e.gridY) < 0.3 && e.grid.contains(p.x, p.z)) return e.grid;
    e.gridY = p.y;
    e.grid = this.findGrid(e.def.zone, p);
    if (!e.grid) {
      for (const [zone] of this.navs) {
        if (zone === e.def.zone) continue;
        e.grid = this.findGrid(zone, p);
        if (e.grid) break;
      }
    }
    return e.grid;
  }

  private findGrid(zone: ZoneId, p: V3): NavGrid | null {
    const grids = this.navs.get(zone);
    if (!grids) return null;
    let best: NavGrid | null = null, bd = 1.2;
    for (let i = 0; i < grids.length; i++) {
      const g = grids[i];
      if (!g.contains(p.x, p.z)) continue;
      const dy = Math.abs(g.floorY - p.y);
      if (dy <= bd) { bd = dy; best = g; }
    }
    return best;
  }

  pickSpot(e: Enemy, center: V3, min: number, max: number, out: V3): boolean {
    const g = this.gridFor(e);
    const pos = e.pos;
    const cur = hdist(pos, center);
    const want = Math.min(max - 1, Math.max(min + 1, cur));
    const base = Math.atan2(pos.x - center.x, pos.z - center.z);
    const arena = e.kind === 'boss' ? this.arena : null;
    let found = false, bestScore = Infinity;
    for (let i = 0; i < 12; i++) {
      const ang = base + (this.rand() - 0.5) * 1.8;
      const r = Math.min(max, Math.max(min, want + (this.rand() - 0.5) * 5));
      const x = center.x + Math.sin(ang) * r, z = center.z + Math.cos(ang) * r;
      if (g) {
        if (!g.safeSpot(x, z, AI.edgeMargin)) continue;
      } else if (!this.solidSpot(x, z, pos.y)) continue;
      if (arena && Math.hypot(x - arena.center.x, z - arena.center.z) > arena.radius - 1) continue;
      if (this.crowded(e, x, z)) continue;
      const score = Math.abs(Math.hypot(x - pos.x, z - pos.z) - 4);
      if (score < bestScore) {
        bestScore = score;
        out.set(x, pos.y, z);
        found = true;
      }
    }
    return found;
  }

  /** No nav: ground here and no drop within the edge margin. */
  private solidSpot(x: number, z: number, y: number) {
    const w = this.world;
    if (!w) return false;
    const m = AI.edgeMargin;
    if (w.groundAt(x, z, 0.1, y + 0.5) < y - 0.6) return false;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      if (w.groundAt(x + Math.sin(a) * m, z + Math.cos(a) * m, 0.1, y + 0.5) < y - 0.6) return false;
    }
    return true;
  }

  private crowded(e: Enemy, x: number, z: number) {
    for (let i = 0; i < this.list.length; i++) {
      const o = this.list[i];
      if (o === e || !o.alive || !o.active) continue;
      const p = o.hasSpot ? o.spot : o.pos;
      if (Math.hypot(p.x - x, p.z - z) < 2.5) return true;
    }
    return false;
  }

  tryToken(e: Enemy) {
    if (e.token) return true;
    if (this.tokens >= AI.maxTokens) return false;
    e.token = true;
    this.tokens++;
    return true;
  }

  releaseToken(e: Enemy) {
    if (!e.token) return;
    e.token = false;
    this.tokens = Math.max(0, this.tokens - 1);
  }

  /** Enemies currently holding an attack token (telegraphing or firing). */
  get tokensInUse() {
    return this.tokens;
  }

  // -------------------------------------------------------------------------
  // Brute / boss helpers (Brain)
  // -------------------------------------------------------------------------

  endCharge(e: Enemy) {
    e.atk = 'none';
    e.atkT = 0;
    e.chargeCd = this.between(AI.brute.cooldown);
    e.moveVel.set(0, 0, 0);
    if (e.body && !e.body.simulate) e.body.vel.set(0, 0, 0);
    if (e.state === 'charge') {
      e.state = this.baseState(e);
      e.stateT = 0;
    }
  }

  /** A charging brute ran into a wall: stunned 2.5 s. */
  wallStun(e: Enemy) {
    if (!e.alive) return;
    this.endCharge(e);
    e.state = 'stunned';
    e.stateT = 0;
    e.holdT = AI.stunTime;
    e.recoverToCombat = true;
    e.char.play('hitHead');
    this.hooks.sound('thud', e.pos);
    const info: HitInfo = { source: 'impact', amount: AI.brute.wallDamage, charged: false, speed: AI.brute.speed, team: 'neutral', instigator: null };
    this.hooks.knocked(e, info);
    this.damage(e, AI.brute.wallDamage, info);
  }

  startBlink(e: Enemy) {
    const pl = this.ctx.player;
    let found = false;
    if (this.arena && this.arena.points.length) {
      let best = -Infinity;
      for (const p of this.arena.points) {
        if (hdist(p, e.pos) < 3) continue;
        const d = hdist(p, pl.pos);
        const score = -Math.abs(d - 11) + this.rand() * 3;
        if (score > best) {
          best = score;
          e.blinkTo.copy(p);
          found = true;
        }
      }
    }
    if (!found) found = this.pickSpot(e, pl.pos, e.tune.keepMin, e.tune.keepMax, e.blinkTo);
    e.blinkNext = AI.boss.blinkEvery;
    if (!found) return;
    endAttack(this, e);
    e.blinkFrom.copy(e.pos);
    e.blink = 'warn';
    e.blinkT = AI.boss.blinkWarn;
    this.hooks.bossRift?.(e, e.blinkFrom, e.blinkTo);
  }

  finishBlink(e: Enemy) {
    const b = e.body;
    if (b) {
      b.pos.copy(e.blinkTo);
      b.vel.set(0, 0, 0);
      b.peakY = b.pos.y;
    }
    e.char.setOpacity(1);
    e.blink = 'none';
    e.blinkNext = AI.boss.blinkEvery * (e.phase === 3 ? 1.4 : 1);
    e.hasSpot = false;
    e.hasGoal = false;
    e.pathLen = 0;
    e.grid = null;
    if (this._ctx) e.yaw = yawTo(e.pos, this._ctx.player.pos);
    this.hooks.bossRift?.(e, null, null);
  }

  private abortBlink(e: Enemy) {
    if (e.blink === 'none') return;
    e.blink = 'none';
    e.char.setOpacity(1);
    e.blinkNext = AI.boss.blinkEvery + 1;
    this.hooks.bossRift?.(e, null, null);
  }

  summonAdds(e: Enemy) {
    if (!this.hooks.summon) return;
    const pl = this._ctx ? this._ctx.player.pos : e.pos;
    const defs: SpawnDef[] = [];
    const pts = this.arena?.points ?? [];
    // the two blink points farthest from the player, else beside Voss
    const order = pts.slice().sort((a, b) => hdist(b, pl) - hdist(a, pl));
    for (let i = 0; i < 2; i++) {
      const p = order[i] ? order[i].clone() : e.pos.clone().add(_v.set(i ? 2.5 : -2.5, 0, 0));
      defs.push({ id: `voss-add-${++this.summoned}`, kind: 'rifleman', pos: p, yaw: yawTo(p, pl), zone: e.def.zone, squad: 'voss', state: 'combat' });
    }
    this.hooks.summon(e, defs);
  }

  // -------------------------------------------------------------------------
  // Physical states
  // -------------------------------------------------------------------------

  /** Into physics: gravity, tumbling. Starts (or continues) a launch chain. */
  private beginLaunch(e: Enemy, fromCrossing: boolean) {
    const b = e.body;
    if (!e.alive || !b || e.kind === 'turret') return;
    if (!e.launchChain) {
      e.launchChain = true;
      e.launchUnaware = e.mode !== 'combat';
    }
    if (e.state === 'charge') this.endCharge(e);
    endAttack(this, e);
    this.abortBlink(e);
    e.state = 'launched';
    e.stateT = 0;
    e.groundT = 0;
    e.noGroundT = 0;
    e.pathLen = 0;
    e.hasGoal = false;
    e.moveVel.set(0, 0, 0);
    b.simulate = true;
    if (!fromCrossing) b.peakY = b.pos.y;
    // tumble about a horizontal axis across the motion
    const hx = b.vel.x, hz = b.vel.z;
    const h = Math.hypot(hx, hz);
    const s = 2.5 + this.rand() * 2.5;
    if (h > 0.5) b.spin.set((hz / h) * s, (this.rand() - 0.5) * 1.5, (-hx / h) * s);
    else b.spin.set((this.rand() - 0.5) * s, (this.rand() - 0.5) * 1.5, (this.rand() - 0.5) * s);
    this.noticeFall(e);
  }

  /** Calm allies who see a mate drop become suspicious (not hot). */
  private noticeFall(e: Enemy) {
    const w = this.world;
    if (!w) return;
    e.chest(_w);
    for (let i = 0; i < this.list.length; i++) {
      const o = this.list[i];
      if (o === e || !o.alive || !o.active || o.mode !== 'calm' || o.kind === 'turret') continue;
      if (o.pos.distanceToSquared(e.pos) > 14 * 14) continue;
      if (seesPoint(o, _w, 14, w, true)) this.becomeSuspicious(o, e.pos);
    }
  }

  private updateLaunched(e: Enemy, dt: number) {
    const b = e.body;
    if (!b) return;
    b.simulate = true;
    if (b.onGround) {
      e.groundT += dt;
      if (e.groundT > 0.15 && b.vel.lengthSq() < 9) this.land(e);
    } else e.groundT = 0;
    if (e.stateT > 12) this.land(e);
  }

  /** Landed below the knock thresholds: stagger 1 s and fight on from here. */
  private land(e: Enemy) {
    this.settle(e);
    e.state = 'stagger';
    e.stateT = 0;
    e.holdT = AI.landStagger;
    e.recoverToCombat = true;
  }

  /** Back to kinematic, upright. */
  private settle(e: Enemy) {
    const b = e.body;
    if (b) {
      b.simulate = false;
      b.vel.set(0, 0, 0);
      b.spin.set(0, 0, 0);
      b.quat.identity();
    }
    e.char.setTumble(null);
    e.grid = null;
    e.moveVel.set(0, 0, 0);
  }

  private updateStagger(e: Enemy, dt: number) {
    const b = e.body;
    if (b && b.simulate) {
      if (b.onGround && Math.hypot(b.vel.x, b.vel.z) < 1.5) this.settle(e);
      else return;
    }
    e.holdT -= dt;
    if (b) {
      b.vel.set(e.pushVel.x, 0, e.pushVel.z);
      e.pushVel.multiplyScalar(Math.exp(-5 * dt));
    }
    if (e.holdT <= 0) this.recover(e);
  }

  private updateDown(e: Enemy, dt: number) {
    const b = e.body;
    if (b && b.simulate) {
      // the clock runs once he is lying still
      if (b.onGround && Math.hypot(b.vel.x, b.vel.z) < 1.5) this.settle(e);
      else return;
    } else if (b) b.vel.set(0, 0, 0);
    e.holdT -= dt;
    if (e.holdT <= 0) this.recover(e);
  }

  /** On his feet again: the launch chain ends; he fights from wherever he is. */
  private recover(e: Enemy) {
    e.launchChain = false;
    e.launchUnaware = false;
    e.crossings = 0;
    e.loops = 0;
    e.viaTrapdoor = false;
    e.matador = false;
    e.pushVel.set(0, 0, 0);
    e.hasSpot = false;
    e.hasGoal = false;
    e.pathLen = 0;
    e.grid = null;
    const grids = this.navs.get(e.def.zone);
    if (grids && grids.length) {
      const g = this.gridFor(e);
      e.stranded = !g || g.nearestWalkable(e.pos.x, e.pos.z, 0.9) < 0;
    } else e.stranded = false;
    e.state = this.baseState(e);
    e.stateT = 0;
    if (e.recoverToCombat) {
      e.recoverToCombat = false;
      this.enterCombat(e, null);
    }
  }

  private knockDown(e: Enemy, state: 'downed' | 'stunned', info: HitInfo) {
    if (e.state === 'charge') this.endCharge(e);
    endAttack(this, e);
    this.abortBlink(e);
    e.state = state;
    e.stateT = 0;
    e.holdT = state === 'stunned' ? AI.stunTime : AI.downedTime;
    e.recoverToCombat = true;
    e.char.play('hitHead');
    this.hooks.knocked(e, info);
  }

  launch(v: EnemyView, vel?: V3) {
    const e = this.own(v);
    if (!e || !e.alive || !e.body || e.kind === 'turret') return;
    if (e.kind === 'boss' && e.state !== 'stunned' && e.state !== 'downed') return;
    if (vel) e.body.vel.copy(vel);
    if (e.state !== 'launched') this.beginLaunch(e, false);
  }

  stagger(v: EnemyView, seconds: number, push?: V3) {
    const e = this.own(v);
    if (!e || !e.alive || e.kind === 'turret' || e.kind === 'boss') return;
    if (e.state === 'launched' || e.state === 'downed' || e.state === 'stunned') return;
    if (e.state === 'charge') this.endCharge(e);
    endAttack(this, e);
    if (e.state === 'stagger') e.holdT = Math.max(e.holdT, seconds);
    else e.holdT = seconds;
    e.state = 'stagger';
    e.stateT = 0;
    e.recoverToCombat = true;
    if (push) e.pushVel.set(push.x, 0, push.z);
    e.char.play('hitChest');
  }

  // -------------------------------------------------------------------------
  // Rift / physics events (forwarded by the game)
  // -------------------------------------------------------------------------

  onCrossed(v: EnemyView, from: RiftEnd, _to: RiftEnd, _speed: number) {
    const e = this.own(v);
    if (!e || !e.alive || !e.body) return;
    const charging = e.state === 'charge';
    if (e.state !== 'launched') this.beginLaunch(e, true);
    if (charging && e.kind === 'brute') e.matador = true;
    if (from.kind === 'floor') e.viaTrapdoor = true;
    e.crossings++;
    e.loops = Math.max(e.loops, e.body.loops);
  }

  /** Landing / wall impacts of his body (LAW thresholds). */
  onImpact(v: EnemyView, info: ImpactInfo): HitResult {
    const e = this.own(v);
    if (!e || !e.alive || !e.body) return 'ignored';
    const b = e.body;
    if (e.state === 'charge' && !b.simulate) {
      if (e.atk === 'run' && info.surface === 'wall') {
        this.wallStun(e);
        return 'knocked';
      }
      return 'ignored';
    }
    if (!b.simulate || e.kind === 'turret') return 'ignored';
    const s = info.speed;
    const ground = info.surface === 'ground';
    const hit = (): HitInfo => ({
      source: ground ? 'fall' : 'impact',
      amount: 0,
      charged: info.charged,
      speed: s,
      dir: b.vel.clone(),
      from: info.point.clone(),
      team: 'neutral',
      instigator: info.charged ? 'player' : null,
      crossings: e.crossings,
      loops: e.loops,
      fallHeight: Math.max(0, b.peakY - info.point.y),
      exitEndId: b.lastEnd ? b.lastEnd.id : null,
    });
    if (e.kind === 'boss') {
      if (info.charged && s >= LAW.knockSpeed) {
        const h = hit();
        h.amount = s * 12;
        if (this.damage(e, h.amount, h)) return 'killed';
        this.knockDown(e, 'stunned', h);
        return 'knocked';
      }
    } else if (info.charged) {
      if (s >= (e.armored ? LAW.armorSpeed : LAW.killSpeed)) {
        const h = hit();
        h.amount = e.hp;
        this.die(e, h);
        return 'killed';
      }
      if (s >= LAW.knockSpeed) {
        const h = hit();
        // armour: stunned and hurt instead (a matador brute into a wall)
        if (e.armored) {
          h.amount = s * 4;
          if (this.damage(e, h.amount, h)) return 'killed';
        }
        this.knockDown(e, e.kind === 'brute' ? 'stunned' : 'downed', h);
        return 'knocked';
      }
    } else {
      // uncharged speed never kills
      if (s >= LAW.killSpeed) {
        this.knockDown(e, 'downed', hit());
        return 'knocked';
      }
      if (s >= LAW.knockSpeed && ground) {
        if (e.state === 'launched') this.land(e);
        return 'hurt';
      }
    }
    if (ground && e.state === 'launched') this.land(e);
    return 'ignored';
  }

  onSplash(v: EnemyView) {
    const e = this.own(v);
    if (!e) return;
    if (e.alive) this.die(e, this.envInfo(e, 'water'));
    if (e.sinkT <= 0 && !e.gone) e.sinkT = 2.5;
  }

  onFellOut(v: EnemyView) {
    const e = this.own(v);
    if (!e) return;
    if (e.alive) this.die(e, this.envInfo(e, 'void'));
    this.vanish(e);
  }

  private envInfo(e: Enemy, source: 'water' | 'void'): HitInfo {
    const b = e.body;
    return {
      source,
      amount: Math.max(1, e.hp),
      charged: !!b && b.charge > 0,
      speed: b ? b.vel.length() : 0,
      team: 'neutral',
      instigator: e.launchChain ? 'player' : null,
      crossings: e.crossings,
      loops: e.loops,
      fallHeight: e.launchChain && b ? Math.max(0, b.peakY - b.pos.y) : 0,
      exitEndId: b && b.lastEnd ? b.lastEnd.id : null,
    };
  }

  // -------------------------------------------------------------------------
  // Damage
  // -------------------------------------------------------------------------

  hit(v: EnemyView, info: HitInfo): HitResult {
    const e = this.own(v);
    if (!e || !e.alive) return 'ignored';
    const src = info.source;
    if (info.from && info.exitEndId != null) this.lookAtExit(e, info.from);
    if (e.kind === 'boss') return this.hitBoss(e, info);
    if (e.kind === 'turret') return this.hitTurret(e, info);
    if (src === 'blade' || src === 'shear' || src === 'void' || src === 'water' || src === 'crush') {
      this.die(e, info);
      return 'killed';
    }
    if (src === 'shove') {
      if (info.dir) _v.copy(info.dir).setY(0).normalize().multiplyScalar(3);
      this.stagger(e, LAW.shove.stagger, info.dir ? _v : undefined);
      return 'hurt';
    }
    // Warden: 120° front shield, charged hits too, below armour speed
    if (e.kind === 'warden' && this.shieldUp(e) && !NO_SOURCE_SHIELD.has(src) && (info.speed ?? 0) < LAW.armorSpeed && this.fromFront(e, info, AI.warden.shieldHalf)) {
      this.hooks.sound('clang', e.chest(_w));
      this.turnShield(e, info);
      this.enterCombat(e, null);
      return 'blocked';
    }
    if (src === 'impact' || src === 'fall') {
      const s = info.speed ?? 0;
      if (info.charged && s >= (e.armored ? LAW.armorSpeed : LAW.killSpeed)) {
        this.die(e, info);
        return 'killed';
      }
      if (e.armored) {
        // below armour speed a brute only staggers
        if (e.state !== 'charge') this.stagger(e, 1);
        this.enterCombat(e, null);
        return 'hurt';
      }
      if (s >= (info.charged ? LAW.knockSpeed : LAW.killSpeed)) {
        if (info.amount > 0 && this.damage(e, info.amount, info)) return 'killed';
        this.knockDown(e, 'downed', info);
        return 'knocked';
      }
      if (info.amount > 0 && this.damage(e, info.amount, info)) return 'killed';
      this.stagger(e, s >= LAW.knockSpeed ? 1 : AI.hurtStagger);
      return 'hurt';
    }
    if (this.damage(e, info.amount, info)) return 'killed';
    this.turnShield(e, info);
    // a big blast floors the unarmoured
    if ((src === 'explosion' || src === 'grenade') && info.amount >= 25 && !e.armored && e.state !== 'launched') {
      this.knockDown(e, 'downed', info);
      this.enterCombat(e, null);
      return 'knocked';
    }
    e.char.play('hitChest');
    if (e.state !== 'charge') this.stagger(e, e.armored ? 0.25 : AI.hurtStagger);
    this.enterCombat(e, null);
    return 'hurt';
  }

  private hitTurret(e: Enemy, info: HitInfo): HitResult {
    const src = info.source;
    if (src === 'shear' || src === 'void' || src === 'water' || src === 'crush') {
      this.die(e, info);
      return 'killed';
    }
    if (src === 'shove' || src === 'blade' || src === 'melee') return 'ignored';
    let amount = info.amount;
    if (src === 'impact' || src === 'fall') {
      const s = info.speed ?? 0;
      if (!info.charged || s < LAW.knockSpeed) return 'ignored';
      if (s >= LAW.killSpeed) {
        this.die(e, info);
        return 'killed';
      }
      amount = Math.max(amount, 60);
    }
    if (this.damage(e, amount, info)) return 'killed';
    this.enterCombat(e, null);
    return 'hurt';
  }

  private hitBoss(e: Enemy, info: HitInfo): HitResult {
    const src = info.source;
    const B = AI.boss;
    if (src === 'void' || src === 'water') {
      this.die(e, info);
      return 'killed';
    }
    if (src === 'shear') {
      // only mid-blink: he's half through his own rift
      if (e.blink !== 'pass') return 'blocked';
      this.abortBlink(e);
      if (this.damage(e, B.shearDamage, info)) return 'killed';
      this.knockDown(e, 'stunned', info);
      return 'knocked';
    }
    if (src === 'blade') {
      if (e.state !== 'stunned' && e.state !== 'downed') return 'blocked';
      return this.damage(e, B.bladeDamage, info) ? 'killed' : 'hurt';
    }
    if (src === 'shove' || src === 'melee') return 'blocked';
    const upright = e.state === 'combat' || e.state === 'idle' || e.state === 'patrol' || e.state === 'suspicious';
    // rift shield: straight charged shots from his front are caught (and come back)
    if (info.charged && upright && e.blink !== 'pass' && BOSS_SHIELDED.has(src) && this.fromFront(e, info, B.shieldHalf) && !this.fromAbove(e, info)) {
      this.hooks.sound('clang', e.chest(_w));
      if (src === 'bolt' && e.returnT < 0) e.returnT = B.returnDelay;
      this.enterCombat(e, null);
      return 'blocked';
    }
    let amount = info.amount;
    let stun = false;
    if (src === 'impact' || src === 'fall' || src === 'crush') {
      const s = info.speed ?? 0;
      amount = Math.max(amount, s * 10);
      stun = s >= LAW.armorSpeed || src === 'crush';
    }
    if (this.damage(e, amount, info)) return 'killed';
    this.enterCombat(e, null);
    if (stun && e.state !== 'stunned') {
      this.knockDown(e, 'stunned', info);
      return 'knocked';
    }
    e.char.play('hitChest');
    return 'hurt';
  }

  kill(v: EnemyView, info: HitInfo) {
    const e = this.own(v);
    if (e) this.die(e, info);
  }

  /** HP loss; the boss changes phase. True when it killed him. */
  private damage(e: Enemy, amount: number, info: HitInfo): boolean {
    if (!e.alive) return false;
    e.hp -= Math.max(0, amount);
    if (e.kind === 'boss') this.updatePhase(e);
    if (e.hp <= 0) {
      this.die(e, info);
      return true;
    }
    return false;
  }

  private updatePhase(e: Enemy) {
    const f = e.hp / e.maxHp;
    const p = f < 0.33 ? 3 : f < 0.66 ? 2 : 1;
    if (p <= e.phase || e.hp <= 0) return;
    e.phase = p;
    this.bark(e, p === 2 ? 'bark.boss2' : 'bark.boss3', true);
    this.hooks.sound('shout', e.pos);
    if (p === 2) e.blinkNext = 1.2;
    else {
      e.summonT = 1.5;
      e.lobT = 3;
    }
  }

  private shieldUp(e: Enemy) {
    const s = e.state;
    return s === 'combat' || s === 'idle' || s === 'patrol' || s === 'suspicious';
  }

  /** Did the hit come from within ±half of his forward (horizontal)? */
  private fromFront(e: Enemy, info: HitInfo, half: number) {
    let fx: number, fz: number;
    if (info.from) {
      fx = info.from.x - e.pos.x;
      fz = info.from.z - e.pos.z;
    } else if (info.dir) {
      fx = -info.dir.x;
      fz = -info.dir.z;
    } else return false;
    if (fx * fx + fz * fz < 1e-6) return false;
    return Math.abs(angleDiff(e.yaw, Math.atan2(fx, fz))) <= half;
  }

  /** Steeply from above (≥ 45°): his catch-rift doesn't face up. */
  private fromAbove(e: Enemy, info: HitInfo) {
    if (info.from) {
      const dy = info.from.y - (e.pos.y + e.height * 0.72);
      return dy > 1 && dy > Math.hypot(info.from.x - e.pos.x, info.from.z - e.pos.z);
    }
    return !!info.dir && info.dir.y < -0.7;
  }

  private turnShield(e: Enemy, info: HitInfo) {
    if (e.kind !== 'warden') return;
    if (info.from) e.shieldFrom.copy(info.from);
    else if (info.dir) e.shieldFrom.copy(e.pos).addScaledVector(info.dir, -5);
    else return;
    e.shieldT = AI.lookTime;
  }

  /** Something came out of a rift: he and nearby allies stare at the exit, Wardens turn their shields. */
  private lookAtExit(victim: Enemy, from: V3) {
    for (let i = 0; i < this.list.length; i++) {
      const o = this.list[i];
      // Voss knows rifts: he isn't fooled into staring at one
      if (!o.alive || o.kind === 'boss' || o.def.zone !== victim.def.zone) continue;
      if (o !== victim && o.pos.distanceToSquared(victim.pos) > AI.lookRadius * AI.lookRadius) continue;
      o.lookAt.copy(from);
      o.lookT = AI.lookTime;
      if (o.kind === 'warden') {
        o.shieldFrom.copy(from);
        o.shieldT = AI.lookTime;
      }
      if (o !== victim && o.mode === 'calm') this.becomeSuspicious(o, from);
    }
  }

  private die(e: Enemy, info: HitInfo) {
    if (!e.alive) return;
    const b = e.body;
    const witnessed = this.findWitnesses(e) > 0;
    const ctx: DeathContext = {
      cause: info.source,
      info,
      unaware: e.launchChain ? e.launchUnaware : e.mode !== 'combat',
      witnessed,
      airborne: !!b && (e.state === 'launched' || (b.simulate && !b.onGround)),
      crossings: e.crossings,
      loops: e.loops,
      fallHeight: info.fallHeight ?? (e.launchChain && b ? Math.max(0, b.peakY - b.pos.y) : 0),
      viaTrapdoor: e.viaTrapdoor,
      matador: e.matador,
      at: e.pos.clone(),
    };
    if (e.state === 'charge') this.endCharge(e);
    endAttack(this, e);
    this.abortBlink(e);
    e.state = 'dead';
    e.hp = 0;
    e.stateT = 0;
    e.pathPending = false;
    e.pathLen = 0;
    e.char.setTumble(null);
    e.char.die(deathKindOf(info.source));
    if (b) {
      if (e.kind === 'turret') {
        e.home.copy(b.pos);
        this.physics.removeBody(b);
        e.body = null;
      } else {
        b.kind = 'corpse';
        b.simulate = true;
        b.friction = 0.9;
        b.bounce = 0.05;
      }
    }
    this.hooks.died(e, ctx);
    // whoever saw it: the zone goes hot
    const from = info.exitEndId != null ? info.from : undefined;
    let barked = false;
    for (let i = 0; i < this.witnesses.length; i++) {
      const w = this.witnesses[i];
      if (!w.alive) continue;
      if (from) {
        w.lookAt.copy(from);
        w.lookT = AI.lookTime;
        if (w.kind === 'warden') {
          w.shieldFrom.copy(from);
          w.shieldT = AI.lookTime;
        }
      }
      if (!barked) {
        barked = true;
        this.bark(w, 'bark.mateDown', true);
      }
      this.enterCombat(w, null);
    }
    this.witnesses.length = 0;
  }

  /** Alive, perceiving allies with LOS to him within 25 m. */
  private findWitnesses(e: Enemy) {
    const out = this.witnesses;
    out.length = 0;
    const w = this.world;
    if (!w) return 0;
    e.chest(_w);
    const r2 = AI.witnessRange * AI.witnessRange;
    for (let i = 0; i < this.list.length; i++) {
      const o = this.list[i];
      if (o === e || !o.alive || !o.active || o.kind === 'turret') continue;
      if (o.state === 'downed' || o.state === 'stunned' || o.state === 'launched') continue;
      if (o.pos.distanceToSquared(e.pos) > r2) continue;
      if (seesPoint(o, _w, AI.witnessRange, w)) out.push(o);
    }
    return out.length;
  }

  // -------------------------------------------------------------------------
  // Views for the game
  // -------------------------------------------------------------------------

  /** Threats against the player right now (for CATCH). Pooled: valid until the next call. */
  threats(): Threat[] {
    const out = this.threatOut;
    out.length = 0;
    const pl = this._ctx?.player;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (!e.alive || !e.active) continue;
      if ((e.atk === 'aim' || e.atk === 'fire') && e.atkKind !== 'lob') {
        if (e.atkKind === 'beam') this.threat('beam', e.muzzle, Math.max(0, e.atkDur - e.atkT));
        else this.threat('laser', e.muzzle, e.atk === 'aim' ? Math.max(0, e.atkDur - e.atkT) : 0);
      } else if (e.state === 'charge' && pl) {
        const d = hdist(e.pos, pl.pos);
        e.chest(_w);
        if (e.atk === 'roar') this.threat('charge', _w, Math.max(0, AI.brute.roar - e.atkT) + d / AI.brute.speed);
        else if (e.atk === 'run') {
          const toward = ((pl.pos.x - e.pos.x) * e.chargeDir.x + (pl.pos.z - e.pos.z) * e.chargeDir.z) / Math.max(0.01, d);
          if (toward > 0.6) this.threat('charge', _w, d / AI.brute.speed);
        }
      }
    }
    return out;
  }

  private threat(kind: Threat['kind'], from: V3, eta: number) {
    const k = this.threatOut.length;
    let t = this.threatPool[k];
    if (!t) {
      t = { kind, from: new THREE.Vector3(), eta };
      this.threatPool.push(t);
    }
    t.kind = kind;
    t.from.copy(from);
    t.eta = eta;
    this.threatOut.push(t);
  }

  /** Alive enemies in active zones as trapdoor targets. Pooled. */
  trapTargets(): TrapTarget[] {
    const out = this.trapOut;
    out.length = 0;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (!e.alive || !e.active || !e.body) continue;
      let t = this.trapPool[out.length];
      if (!t) {
        t = { key: e.key, pos: e.pos, radius: e.radius, height: e.height, canFall: false, steady: false };
        this.trapPool.push(t);
      }
      t.key = e.key;
      t.pos = e.pos;
      t.radius = e.radius;
      t.height = e.height;
      t.canFall = e.offBalance;
      t.steady = e.steady;
      out.push(t);
    }
    return out;
  }

  /** Living jammers' no-rift bubbles (7 m). Pooled. */
  blockers(): { pos: V3; radius: number }[] {
    const out = this.blockOut;
    out.length = 0;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (e.kind !== 'jammer' || !e.alive || !e.active) continue;
      let b = this.blockPool[out.length];
      if (!b) {
        b = { pos: e.pos, radius: AI.jammer.radius };
        this.blockPool.push(b);
      }
      b.pos = e.pos;
      b.radius = AI.jammer.radius;
      out.push(b);
    }
    return out;
  }

  /** Director Voss while he lives. */
  boss(): { phase: 1 | 2 | 3; blinking: boolean; pos: V3 } | null {
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (e.kind === 'boss' && e.alive) return { phase: e.phase, blinking: e.blinking, pos: e.pos };
    }
    return null;
  }

  /**
   * Every listed spawn id (an encounter's spawns) exists and is dead; without
   * ids, every enemy of the zone is dead.
   */
  zoneCleared(zone: ZoneId, encounterSpawnIds?: string[]): boolean {
    if (encounterSpawnIds) {
      for (const id of encounterSpawnIds) {
        let found = false;
        for (let i = 0; i < this.list.length; i++) {
          const e = this.list[i];
          if (e.def.id !== id || e.def.zone !== zone) continue;
          found = true;
          if (e.alive) return false;
        }
        if (!found) return false;
      }
      return true;
    }
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (e.def.zone === zone && e.alive) return false;
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Replay
  // -------------------------------------------------------------------------

  snapshot(): ActorSnap[] {
    const out: ActorSnap[] = [];
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      const r = e.char.root;
      out.push({ key: e.key, pos: [r.position.x, r.position.y, r.position.z], yaw: r.rotation.y, pose: e.char.getPose(), visible: r.visible });
    }
    return out;
  }

  /** Visual only: AI state and bodies are untouched. Enemies absent from the snapshot are hidden. */
  applySnapshot(s: ActorSnap[]) {
    for (let i = 0; i < this.list.length; i++) this.list[i].char.root.visible = false;
    for (const a of s) {
      const v = this.byKey(a.key);
      if (!v) continue;
      const e = v as Enemy;
      const r = e.char.root;
      r.position.set(a.pos[0], a.pos[1], a.pos[2]);
      r.rotation.y = a.yaw;
      e.char.setPose(a.pose);
      r.visible = a.visible;
    }
  }
}

function slot(out: THREE.Vector3[], i: number) {
  while (out.length <= i) out.push(new THREE.Vector3());
  return out[i];
}
