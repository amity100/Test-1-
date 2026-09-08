import * as THREE from 'three';
import { Emitter } from '../core/Events';
import type { VoxelWorld } from '../world/VoxelWorld';
import type { Combat, Solid } from './Combat';
import type { Entity } from './Entities';
import type { Cell } from '../world/Reachability';
import { PLOT_Y, type Plot } from '../world/Layout';

export type EngineKind = 'ballista' | 'catapult';
export const ENGINE_KINDS: EngineKind[] = ['ballista', 'catapult'];

/**
 * Siege engines: a ballista that shoots heavy bolts at anyone in sight, and a catapult that lobs stones
 * which burst and break walls. Either works when a friendly bot stands by it or when the human mans it.
 */
export const ENGINE = {
  ballista: { cost: 20, hp: 220, range: 62, interval: 2.4, damage: 70, speed: 75, turn: 2.6, height: 1.3 },
  catapult: { cost: 35, hp: 320, range: 95, minRange: 16, interval: 11, speed: 30, turn: 1.1, height: 1.6, splash: 3.8, damage: 100, breakRadius: 1.7 },
  crewRange: 3.4,
  /** Radians of scatter (peak to peak) on a bot crew's bolts. */
  crewScatter: 0.07,
  gravityStone: 9.8,
  gravityBolt: 3.5,
};

export interface Engine {
  id: number;
  kind: EngineKind;
  team: number;
  plotIndex: number;
  /** Base centre on its floor. */
  pos: THREE.Vector3;
  yaw: number;
  pitch: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  fireTimer: number;
  /** Entity manning or crewing it (-1 none). */
  crewId: number;
  /** The human is at the controls. */
  manned: boolean;
  /** 1 right after a shot, easing back to 0 (arm swing, string snap). */
  anim: number;
  lastFire: number;
}

export interface EngineEvents extends Record<string, unknown> {
  change: Record<string, never>;
  placed: { engine: Engine };
  fire: { engine: Engine; from: THREE.Vector3; dir: THREE.Vector3 };
  destroyed: { engine: Engine };
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
let nextEngineId = 1;

export class EngineSystem {
  readonly events = new Emitter<EngineEvents>();
  readonly engines: Engine[] = [];

  constructor(
    private world: VoxelWorld,
    private combat: Combat,
    private entities: () => Entity[],
    private plots: Plot[],
  ) {}

  clear(): void {
    this.engines.length = 0;
    this.events.emit('change', {});
  }

  byId(id: number): Engine | null {
    return this.engines.find((e) => e.id === id) ?? null;
  }

  /** Where the crew stands: a step behind the engine. */
  crewSpot(e: Engine): THREE.Vector3 {
    return new THREE.Vector3(e.pos.x + Math.sin(e.yaw) * 1.4, e.pos.y, e.pos.z + Math.cos(e.yaw) * 1.4);
  }

  /** The nearest live engine of a team within maxDist of a point. */
  near(p: THREE.Vector3, team: number, maxDist: number): Engine | null {
    let best: Engine | null = null;
    let bd = maxDist;
    for (const e of this.engines) {
      if (e.dead || e.team !== team) continue;
      const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
      if (d < bd && Math.abs(e.pos.y - p.y) < 3) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** Why an engine cannot stand on a floor cell, or null when it can. */
  canPlace(kind: EngineKind, cell: Cell, plotIndex: number): string | null {
    const plot = this.plots[plotIndex];
    if (!plot || cell.x < plot.minX || cell.x > plot.maxX || cell.z < plot.minZ || cell.z > plot.maxZ) return 'engineOutside';
    if (cell.y < PLOT_Y || this.world.get(cell.x, cell.y - 1, cell.z) === 0) return 'engineNeedsFloor';
    for (let dy = 0; dy < 3; dy++) if (this.world.get(cell.x, cell.y + dy, cell.z) !== 0) return 'engineNeedsRoom';
    // A catapult lobs its stones high: nothing may hang over it.
    if (kind === 'catapult') for (let dy = 3; dy < 9; dy++) if (this.world.get(cell.x, cell.y + dy, cell.z) !== 0) return 'engineNeedsSky';
    for (const o of this.engines) if (!o.dead && Math.hypot(o.pos.x - (cell.x + 0.5), o.pos.z - (cell.z + 0.5)) < 2.4) return 'engineTooClose';
    return null;
  }

  place(kind: EngineKind, cell: Cell, team: number, plotIndex: number, yaw = 0): Engine | string {
    const err = this.canPlace(kind, cell, plotIndex);
    if (err) return err;
    const def = ENGINE[kind];
    const e: Engine = {
      id: nextEngineId++,
      kind,
      team,
      plotIndex,
      pos: new THREE.Vector3(cell.x + 0.5, cell.y, cell.z + 0.5),
      yaw,
      pitch: kind === 'catapult' ? 0.78 : 0,
      hp: def.hp,
      maxHp: def.hp,
      dead: false,
      fireTimer: 1.5,
      crewId: -1,
      manned: false,
      anim: 0,
      lastFire: -100,
    };
    this.engines.push(e);
    this.events.emit('placed', { engine: e });
    this.events.emit('change', {});
    return e;
  }

  damage(e: Engine, amount: number): void {
    if (e.dead) return;
    e.hp -= amount;
    if (e.hp <= 0) {
      e.dead = true;
      e.manned = false;
      this.events.emit('destroyed', { engine: e });
      this.events.emit('change', {});
    }
  }

  /** Bullets and bolts wear engines down (never the crew's own side). */
  solids(): Solid[] {
    const out: Solid[] = [];
    for (const e of this.engines) {
      if (e.dead) continue;
      const h = ENGINE[e.kind].height + 0.7;
      const r = e.kind === 'catapult' ? 1.1 : 0.8;
      out.push({
        box: new THREE.Box3(new THREE.Vector3(e.pos.x - r, e.pos.y, e.pos.z - r), new THREE.Vector3(e.pos.x + r, e.pos.y + h, e.pos.z + r)),
        hit: (dmg: number, attacker: Entity | null) => {
          if (attacker && attacker.team === e.team) return;
          this.damage(e, dmg);
        },
      });
    }
    return out;
  }

  private head(e: Engine): THREE.Vector3 {
    return new THREE.Vector3(e.pos.x, e.pos.y + ENGINE[e.kind].height, e.pos.z);
  }

  update(dt: number, now: number): void {
    const ents = this.entities();
    for (const e of this.engines) {
      if (e.dead) continue;
      e.fireTimer -= dt;
      e.anim = Math.max(0, e.anim - dt * 1.6);
      // Crew: the human at the controls, else a friendly bot standing by it.
      let crew: Entity | null = null;
      if (e.manned) crew = ents.find((x) => x.manning === e.id && x.alive) ?? null;
      if (!crew) {
        e.manned = false;
        let bd = ENGINE.crewRange;
        for (const x of ents) {
          if (!x.alive || !x.isBot || x.team !== e.team) continue;
          const d = x.pos.distanceTo(e.pos);
          if (d < bd) {
            bd = d;
            crew = x;
          }
        }
      }
      e.crewId = crew ? crew.id : -1;
      if (!crew) {
        e.yaw += dt * 0.12;
        continue;
      }
      if (e.manned) {
        // The human aims it; firing comes through fire().
        e.yaw = crew.yaw;
        e.pitch = crew.pitch;
        continue;
      }
      if (e.kind === 'ballista') this.autoBallista(e, crew, ents, dt, now);
      else this.autoCatapult(e, crew, ents, dt, now);
    }
  }

  private autoBallista(e: Engine, crew: Entity, ents: Entity[], dt: number, now: number): void {
    const def = ENGINE.ballista;
    const head = this.head(e);
    let target: Entity | null = null;
    let bestD = def.range;
    for (const x of ents) {
      if (!x.alive || x.team === e.team || x.team < 0 || x.burrowed || x.protectedUntil > now) continue;
      const c = x.center;
      const d = c.distanceTo(head);
      if (d >= bestD) continue;
      const dir = c.clone().sub(head);
      if (this.world.raycast(head.x, head.y, head.z, dir.x, dir.y, dir.z, d - x.radius)) continue;
      bestD = d;
      target = x;
    }
    if (!target) {
      e.pitch += (0 - e.pitch) * Math.min(1, dt * 2);
      return;
    }
    // Lead the target and aim a touch high for the bolt's drop.
    const tof = bestD / def.speed;
    const aim = target.center.clone().addScaledVector(target.vel, tof * 0.8);
    aim.y += 0.5 * ENGINE.gravityBolt * tof * tof;
    const flat = Math.hypot(aim.x - head.x, aim.z - head.z);
    const wantYaw = Math.atan2(-(aim.x - head.x), -(aim.z - head.z));
    const wantPitch = Math.atan2(aim.y - head.y, flat);
    let dy = wantYaw - e.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const step = def.turn * dt;
    e.yaw += clamp(dy, -step, step);
    e.pitch += clamp(wantPitch - e.pitch, -step, step);
    if (e.fireTimer <= 0 && Math.abs(dy) < 0.08) {
      // A bot crew scatters a little; a human at the controls does not.
      const yaw0 = e.yaw;
      const pitch0 = e.pitch;
      e.yaw += (Math.random() - 0.5) * ENGINE.crewScatter;
      e.pitch += (Math.random() - 0.5) * ENGINE.crewScatter;
      this.fire(e, crew, now);
      e.yaw = yaw0;
      e.pitch = pitch0;
    }
  }

  private autoCatapult(e: Engine, crew: Entity, ents: Entity[], dt: number, now: number): void {
    const def = ENGINE.catapult;
    const head = this.head(e);
    // The enemy with the most company around them, inside the range band.
    let best: Entity | null = null;
    let bestScore = -1;
    for (const x of ents) {
      if (!x.alive || x.team === e.team || x.team < 0) continue;
      const d = Math.hypot(x.pos.x - head.x, x.pos.z - head.z);
      if (d < def.minRange || d > def.range) continue;
      let score = 1 + (1 - d / def.range) * 0.5;
      for (const y of ents) if (y !== x && y.alive && y.team === x.team && y.pos.distanceTo(x.pos) < 5) score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = x;
      }
    }
    if (!best) {
      e.pitch += (0.78 - e.pitch) * Math.min(1, dt);
      return;
    }
    const aim = best.pos.clone().addScaledVector(best.vel, 1.2);
    const wantYaw = Math.atan2(-(aim.x - head.x), -(aim.z - head.z));
    let dy = wantYaw - e.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const step = def.turn * dt;
    e.yaw += clamp(dy, -step, step);
    e.pitch = 0.78;
    if (e.fireTimer <= 0 && Math.abs(dy) < 0.06) this.fireAt(e, crew, aim, now);
  }

  /** Shoots along the engine's yaw and pitch: a bolt from a ballista, a stone at a fixed lob from a catapult. */
  fire(e: Engine, shooter: Entity, now: number): boolean {
    if (e.dead || e.fireTimer > 0) return false;
    const from = this.head(e);
    if (e.kind === 'ballista') {
      const dir = new THREE.Vector3(-Math.sin(e.yaw) * Math.cos(e.pitch), Math.sin(e.pitch), -Math.cos(e.yaw) * Math.cos(e.pitch));
      this.combat.spawnProjectile('bolt', shooter, from.clone().addScaledVector(dir, 1.0), dir, ENGINE.ballista.speed, 5);
      e.fireTimer = ENGINE.ballista.interval;
      this.shot(e, from, dir, now);
      return true;
    }
    const el = clamp(e.pitch, 0.35, 1.05);
    const dir = new THREE.Vector3(-Math.sin(e.yaw) * Math.cos(el), Math.sin(el), -Math.cos(e.yaw) * Math.cos(el));
    this.combat.spawnProjectile('stone', shooter, from.clone().addScaledVector(dir, 1.2), dir, ENGINE.catapult.speed, 9);
    e.fireTimer = ENGINE.catapult.interval;
    this.shot(e, from, dir, now);
    return true;
  }

  /** Catapult: a 45° lob whose speed drops the stone on the aim point. */
  fireAt(e: Engine, shooter: Entity, aim: THREE.Vector3, now: number): void {
    const from = this.head(e);
    const dx = aim.x - from.x;
    const dz = aim.z - from.z;
    const d = Math.max(1, Math.hypot(dx, dz));
    const h = aim.y - from.y;
    const el = 0.78;
    const denom = 2 * Math.cos(el) ** 2 * (d * Math.tan(el) - h);
    const v = clamp(denom > 0 ? Math.sqrt((ENGINE.gravityStone * d * d) / denom) : ENGINE.catapult.speed, 8, 40);
    const dir = new THREE.Vector3((dx / d) * Math.cos(el), Math.sin(el), (dz / d) * Math.cos(el));
    this.combat.spawnProjectile('stone', shooter, from.clone().addScaledVector(dir, 1.2), dir, v, 9);
    e.fireTimer = ENGINE.catapult.interval;
    this.shot(e, from, dir, now);
  }

  private shot(e: Engine, from: THREE.Vector3, dir: THREE.Vector3, now: number): void {
    e.anim = 1;
    e.lastFire = now;
    this.events.emit('fire', { engine: e, from, dir });
  }
}
