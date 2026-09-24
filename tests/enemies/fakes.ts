import * as THREE from 'three';
import type {
  BodyKind,
  CharacterAPI,
  CharacterPose,
  ClipName,
  DeathContext,
  DeathKind,
  DynBody,
  EnemyContext,
  EnemyHooks,
  EnemyView,
  HitInfo,
  LocomotionInput,
  PhysicsAPI,
  PhysicsEvents,
  RaySegment,
  RiftEnd,
  RiftQuery,
  SpawnDef,
  Team,
  ZoneId,
} from '../../src/core/contracts';
import { EnemySystem } from '../../src/actors/enemies';
import { CollisionWorld } from '../../src/world/collision';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/**
 * Tiny physics double: simulated bodies fall with gravity and report ground /
 * wall impacts; kinematic bodies move by vel*dt, collide, snap to ground and
 * report onGround (no gravity), like the contract says.
 */
export class FakePhysics implements PhysicsAPI {
  readonly bodies: DynBody[] = [];
  private nextId = 1;
  killY = -40;
  killYAt = () => this.killY;

  constructor(readonly world: CollisionWorld) {}

  createBody(kind: BodyKind, o: { pos: THREE.Vector3; radius: number; height: number; bounce?: number; friction?: number; team?: Team; simulate?: boolean }): DynBody {
    const b: DynBody = {
      id: this.nextId++,
      kind,
      pos: o.pos.clone(),
      vel: new THREE.Vector3(),
      radius: o.radius,
      height: o.height,
      onGround: false,
      groundCollider: null,
      charge: 0,
      crossings: 0,
      loops: 0,
      peakY: o.pos.y,
      lastEnd: null,
      lastCrossT: -1,
      bounce: o.bounce ?? 0,
      friction: o.friction ?? 1,
      enabled: true,
      simulate: o.simulate ?? true,
      quat: new THREE.Quaternion(),
      spin: new THREE.Vector3(),
      team: o.team ?? 'neutral',
      userData: {},
    };
    this.bodies.push(b);
    return b;
  }

  removeBody(b: DynBody) {
    const i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  step(dt: number, ev: PhysicsEvents, time: number) {
    for (const b of this.bodies.slice()) if (b.enabled && !b.userData.manual) this.stepBody(b, dt, ev, time);
  }

  stepBody(b: DynBody, dt: number, ev: PhysicsEvents, _time: number) {
    const w = this.world;
    if (b.charge > 0) b.charge = Math.max(0, b.charge - dt);
    if (b.simulate) {
      b.vel.y -= 22 * dt;
      const prevY = b.pos.y;
      const hs = Math.hypot(b.vel.x, b.vel.z);
      b.pos.addScaledVector(b.vel, dt);
      const g = w.groundAt(b.pos.x, b.pos.z, b.radius * 0.5, prevY + 0.05);
      if (b.pos.y <= g && b.vel.y <= 0) {
        const s = -b.vel.y;
        b.pos.y = g;
        b.vel.y = 0;
        if (!b.onGround) ev.impact(b, { speed: s, normal: new THREE.Vector3(0, 1, 0), surface: 'ground', collider: null, charged: b.charge > 0, point: b.pos.clone() });
        b.onGround = true;
        b.vel.x *= Math.max(0, 1 - b.friction * 10 * dt);
        b.vel.z *= Math.max(0, 1 - b.friction * 10 * dt);
      } else b.onGround = false;
      if (w.resolveCircle(b.pos, b.radius, b.pos.y, b.pos.y + b.height, 0.1) && hs > 1) {
        ev.impact(b, { speed: hs, normal: new THREE.Vector3(), surface: 'wall', collider: null, charged: b.charge > 0, point: b.pos.clone() });
        b.vel.x = 0;
        b.vel.z = 0;
      }
      b.peakY = Math.max(b.peakY, b.pos.y);
      if (b.pos.y < this.killY) ev.fellOut(b);
    } else {
      b.pos.x += b.vel.x * dt;
      b.pos.z += b.vel.z * dt;
      w.resolveCircle(b.pos, b.radius, b.pos.y, b.pos.y + b.height, 0.45);
      const g = w.groundAt(b.pos.x, b.pos.z, b.radius * 0.5, b.pos.y + 0.45);
      if (g >= b.pos.y - 0.5) {
        b.pos.y = g;
        b.onGround = true;
      } else b.onGround = false;
    }
  }
}

export class StubChar implements CharacterAPI {
  readonly root = new THREE.Group();
  plays: ClipName[] = [];
  tumble: THREE.Quaternion | null = null;
  dead = false;
  deathKind: DeathKind | null = null;
  opacity = 1;
  loco: LocomotionInput | null = null;
  clip: ClipName | null = null;
  clipT = 0;
  mixerT = 0;

  update(dt: number, s: LocomotionInput) {
    this.loco = { ...s };
    this.mixerT += dt;
    this.clipT += dt;
  }
  play(name: ClipName) {
    this.plays.push(name);
    this.clip = name;
    this.clipT = 0;
  }
  stop() {
    this.clip = null;
  }
  setTumble(q: THREE.Quaternion | null) {
    this.tumble = q ? q.clone() : null;
  }
  die(kind: DeathKind) {
    this.dead = true;
    this.deathKind = kind;
  }
  revive() {
    this.dead = false;
    this.deathKind = null;
  }
  getPose(): CharacterPose {
    const l = this.loco;
    return {
      loco: { speed: l?.speed ?? 0, grounded: l?.grounded ?? true, vy: l?.vy ?? 0, crouch: 0, aim: l?.aim ?? 0, downed: !!l?.downed, weaponUp: l?.weaponUp ?? 0 },
      clip: this.clip,
      clipT: this.clipT,
      clipW: 1,
      tumble: this.tumble ? [this.tumble.x, this.tumble.y, this.tumble.z, this.tumble.w] : null,
      dead: this.dead,
      deathKind: this.deathKind,
      mixerT: this.mixerT,
    };
  }
  setPose(p: CharacterPose) {
    this.loco = { speed: p.loco.speed, grounded: p.loco.grounded, vy: p.loco.vy, crouch: p.loco.crouch, aim: p.loco.aim, downed: p.loco.downed, weaponUp: p.loco.weaponUp };
    this.clip = p.clip;
    this.clipT = p.clipT;
    this.tumble = p.tumble ? new THREE.Quaternion(...p.tumble) : null;
    this.dead = p.dead;
    this.deathKind = p.deathKind;
    this.mixerT = p.mixerT;
  }
  setOpacity(o: number) {
    this.opacity = o;
  }
  dispose() {}
}

const noRifts: RiftQuery = {
  openEnds: () => [],
  findCrossing: () => null,
  transformPoint: (_f, p, out) => (out ?? new THREE.Vector3()).copy(p),
  transformDir: (_f, d, out) => (out ?? new THREE.Vector3()).copy(d),
  holeAt: () => null,
  hostPassable: () => false,
  notePass: () => {},
  raycastThrough: (): RaySegment[] => [],
};

/** A fake rift end (only `kind` / `id` matter to the enemy system). */
export function fakeEnd(kind: RiftEnd['kind'], id = 1): RiftEnd {
  return { id, kind } as unknown as RiftEnd;
}

export interface Log {
  bolts: { t: number; id: number; from: THREE.Vector3; dir: THREE.Vector3 }[];
  grenades: { t: number; id: number; from: THREE.Vector3; vel: THREE.Vector3 }[];
  beams: { t: number; id: number; from: THREE.Vector3; dir: THREE.Vector3 }[];
  telegraphs: { t: number; id: number; kind: string; from: THREE.Vector3; to: THREE.Vector3; t01: number }[];
  barks: { t: number; id: number; key: string }[];
  aware: number[];
  died: { id: number; ctx: DeathContext }[];
  knocked: { id: number; info: HitInfo }[];
  melee: { t: number; id: number; damage: number; push: THREE.Vector3 }[];
  sounds: { kind: string }[];
  bossRift: { a: THREE.Vector3 | null; b: THREE.Vector3 | null }[];
  summons: SpawnDef[][];
}

export function scenario(zones: ZoneId[] = ['pier']) {
  const world = new CollisionWorld();
  const ground = world.add({ x: -60, y: -1, z: -60 }, { x: 60, y: 0, z: 60 });
  const physics = new FakePhysics(world);
  const log: Log = { bolts: [], grenades: [], beams: [], telegraphs: [], barks: [], aware: [], died: [], knocked: [], melee: [], sounds: [], bossRift: [], summons: [] };
  const clock = { t: 0 };
  const hooks: EnemyHooks = {
    fireBolt: (e, from, dir) => log.bolts.push({ t: clock.t, id: e.id, from: from.clone(), dir: dir.clone() }),
    throwGrenade: (e, from, vel) => log.grenades.push({ t: clock.t, id: e.id, from: from.clone(), vel: vel.clone() }),
    fireBeam: (e, from, dir) => log.beams.push({ t: clock.t, id: e.id, from: from.clone(), dir: dir.clone() }),
    telegraph: (e, kind, from, to, t01) => log.telegraphs.push({ t: clock.t, id: e.id, kind, from: from.clone(), to: to.clone(), t01 }),
    bark: (e, key) => log.barks.push({ t: clock.t, id: e.id, key }),
    becameAware: (e) => log.aware.push(e.id),
    died: (e, ctx) => log.died.push({ id: e.id, ctx }),
    knocked: (e, info) => log.knocked.push({ id: e.id, info }),
    melee: (e, damage, push) => log.melee.push({ t: clock.t, id: e.id, damage, push: push.clone() }),
    sound: (kind) => log.sounds.push({ kind }),
    bossRift: (_e, a, b) => log.bossRift.push({ a: a ? a.clone() : null, b: b ? b.clone() : null }),
    summon: (_e, defs) => log.summons.push(defs),
  };
  const chars = new Map<number, StubChar>();
  let pending: StubChar[] = [];
  const sys = new EnemySystem(physics, hooks, () => {
    const c = new StubChar();
    pending.push(c);
    return c;
  });
  sys.seed(7);
  const player = { pos: V(0, 0, 15), chest: V(0, 1.3, 15), vel: V(), alive: true, airborne: false, crouched: false, noise: [] as { at: THREE.Vector3; radius: number }[] };
  const ctx: EnemyContext = { time: 0, player, world, rifts: noRifts, physics, activeZones: new Set(zones) };
  const physEv: PhysicsEvents = {
    crossed: (b, f, t, s) => {
      const e = sys.enemyOfBody(b);
      if (e) sys.onCrossed(e, f, t, s);
    },
    impact: (b, i) => {
      const e = sys.enemyOfBody(b);
      if (e) sys.onImpact(e, i);
    },
    touch: () => {},
    splash: (b) => {
      const e = sys.enemyOfBody(b);
      if (e) sys.onSplash(e);
    },
    fellOut: (b) => {
      const e = sys.enemyOfBody(b);
      if (e) sys.onFellOut(e);
    },
  };
  const api = {
    world,
    ground,
    physics,
    sys,
    log,
    ctx,
    player,
    clock,
    char(e: EnemyView) {
      return chars.get(e.id)!;
    },
    spawn(kind: SpawnDef['kind'], pos: THREE.Vector3, yaw = 0, extra: Partial<SpawnDef> = {}) {
      pending = [];
      const e = sys.spawn({ id: `${kind}-${pos.x}-${pos.z}`, kind, pos, yaw, zone: 'pier', squad: 'a', ...extra });
      if (pending[0]) chars.set(e.id, pending[0]);
      return e;
    },
    setPlayer(x: number, y: number, z: number) {
      player.pos.set(x, y, z);
      player.chest.set(x, y + 1.3, z);
    },
    step(n = 1, dt = 1 / 60) {
      for (let i = 0; i < n; i++) {
        clock.t += dt;
        ctx.time = clock.t;
        sys.update(dt, ctx);
        physics.step(dt, physEv, clock.t);
      }
    },
    /** Steps until pred() or the time limit; returns elapsed seconds (Infinity on timeout). */
    until(pred: () => boolean, maxSeconds = 10, dt = 1 / 60) {
      const t0 = clock.t;
      while (clock.t - t0 < maxSeconds) {
        api.step(1, dt);
        if (pred()) return clock.t - t0;
      }
      return Infinity;
    },
  };
  return api;
}
