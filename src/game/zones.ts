import * as THREE from 'three';
import type { EncounterDef, LiftDef, TowerLevel, V3, ZoneDef, ZoneId } from '../core/contracts';

export interface EncounterState {
  def: EncounterDef;
  zone: ZoneId;
  triggered: boolean;
  /** Enemy ids spawned for it. */
  enemyIds: number[];
  cleared: boolean;
}

export interface LiftState {
  def: LiftDef;
  zone: ZoneId;
  /** 0 = at `from`, 1 = at `to`. */
  t: number;
  moving: boolean;
  dir: 1 | -1;
  base: THREE.Vector3;
}

const ORDER: ZoneId[] = ['pier', 'yard', 'skeleton', 'lab', 'crown'];
const _p = new THREE.Vector3();

/**
 * Zone bookkeeping: which zone the player is in, which zones may think and
 * be drawn, encounter triggers/clears, lifts and checkpoints.
 */
export class ZoneManager {
  current: ZoneDef;
  encounters: EncounterState[] = [];
  lifts: LiftState[] = [];
  checkpoint = { pos: new THREE.Vector3(), yaw: 0, zone: 'pier' as ZoneId };
  /** Highest zone reached this run. */
  furthest: ZoneId = 'pier';
  readonly active = new Set<ZoneId>();

  constructor(public level: TowerLevel) {
    this.current = level.zones[0];
    for (const z of level.zones) {
      for (const e of z.encounters) this.encounters.push({ def: e, zone: z.id, triggered: false, enemyIds: [], cleared: false });
      if (z.exit) this.lifts.push({ def: z.exit, zone: z.id, t: 0, moving: false, dir: 1, base: z.exit.mesh.position.clone() });
    }
    this.setCheckpoint(this.current.playerStart, this.current.startYaw, this.current.id);
    this.refreshActive();
  }

  zone(id: ZoneId) {
    return this.level.zones.find((z) => z.id === id)!;
  }

  index(id: ZoneId) {
    return ORDER.indexOf(id);
  }

  /** The zone whose bounds contain p (innermost = the one listed last that contains it). */
  zoneAt(p: V3): ZoneDef | null {
    let best: ZoneDef | null = null;
    for (const z of this.level.zones) if (z.bounds.containsPoint(p)) best = z;
    return best;
  }

  setCheckpoint(pos: V3, yaw: number, zone: ZoneId) {
    this.checkpoint.pos.copy(pos);
    this.checkpoint.yaw = yaw;
    this.checkpoint.zone = zone;
  }

  /** Current + the next zone up (so its tower is visible and its lift works). */
  refreshActive() {
    this.active.clear();
    this.active.add(this.current.id);
    const i = this.index(this.current.id);
    if (i > 0) this.active.add(ORDER[i - 1]);
    if (i < ORDER.length - 1) this.active.add(ORDER[i + 1]);
    for (const id of ORDER) {
      const root = this.level.zoneRoots[id];
      if (root) root.visible = this.active.has(id) || Math.abs(this.index(id) - i) <= 1;
    }
  }

  /** Returns a zone change, and encounters the player just walked into. */
  update(playerPos: V3): { entered: ZoneDef | null; triggered: EncounterState[] } {
    let entered: ZoneDef | null = null;
    const z = this.zoneAt(playerPos);
    if (z && z.id !== this.current.id) {
      this.current = z;
      if (this.index(z.id) > this.index(this.furthest)) {
        this.furthest = z.id;
        this.setCheckpoint(z.playerStart, z.startYaw, z.id);
      }
      this.refreshActive();
      entered = z;
    }
    const triggered: EncounterState[] = [];
    for (const e of this.encounters) {
      if (e.triggered || e.zone !== this.current.id) continue;
      // spawn a little before the trigger so enemies are already in place when you see them
      _p.copy(playerPos);
      const box = e.def.trigger;
      const d = box.distanceToPoint(_p);
      if (d < 22) {
        e.triggered = true;
        triggered.push(e);
      }
    }
    return { entered, triggered };
  }

  encounterOfEnemy(id: number) {
    return this.encounters.find((e) => e.enemyIds.includes(id)) ?? null;
  }

  /** Call after enemy deaths; returns encounters that just got cleared. */
  checkClears(isAlive: (id: number) => boolean): EncounterState[] {
    const out: EncounterState[] = [];
    for (const e of this.encounters) {
      if (!e.triggered || e.cleared) continue;
      if (e.enemyIds.length === 0 && e.def.spawns.length > 0) continue;
      if (e.enemyIds.every((id) => !isAlive(id))) {
        e.cleared = true;
        out.push(e);
      }
    }
    return out;
  }

  liftReady(l: LiftState) {
    return l.def.requires.every((id) => this.encounters.find((e) => e.def.id === id)?.cleared ?? true);
  }

  liftAt(p: V3): LiftState | null {
    for (const l of this.lifts) {
      const box = l.def.platform.clone().translate(_p.copy(l.def.mesh.position).sub(l.base));
      box.expandByScalar(0.3);
      if (box.containsPoint(p)) return l;
    }
    return null;
  }

  /** Objective for the HUD. */
  objective(): { key: string; target: V3 | null } {
    const z = this.current;
    const open = this.encounters.filter((e) => e.zone === z.id && e.def.requireClear && !e.cleared);
    if (open.length) {
      const e = open[0];
      return { key: 'obj.clear', target: e.def.trigger.getCenter(new THREE.Vector3()) };
    }
    const lift = this.lifts.find((l) => l.zone === z.id);
    if (lift) return { key: 'obj.lift', target: lift.def.platform.getCenter(new THREE.Vector3()) };
    if (z.id === 'crown') return { key: 'obj.boss', target: this.level.bossArena?.center ?? null };
    return { key: 'obj.escape', target: null };
  }

  /** Forget encounters that weren't cleared (respawn resets them). */
  resetUncleared() {
    for (const e of this.encounters) {
      if (e.cleared) continue;
      e.triggered = false;
      e.enemyIds = [];
    }
  }

  resetAll() {
    for (const e of this.encounters) {
      e.triggered = false;
      e.cleared = false;
      e.enemyIds = [];
    }
    for (const l of this.lifts) {
      l.t = 0;
      l.moving = false;
      l.dir = 1;
    }
    this.current = this.level.zones[0];
    this.furthest = 'pier';
    this.setCheckpoint(this.current.playerStart, this.current.startYaw, this.current.id);
    this.refreshActive();
  }

  /** Jump straight to a zone (zone select / continue): earlier zones count as cleared. */
  startAt(id: ZoneId) {
    this.resetAll();
    const idx = this.index(id);
    for (const e of this.encounters) if (this.index(e.zone) < idx) {
      e.triggered = true;
      e.cleared = true;
    }
    for (const l of this.lifts) if (this.index(l.zone) < idx) l.t = 1;
    this.current = this.zone(id);
    this.furthest = id;
    this.setCheckpoint(this.current.playerStart, this.current.startYaw, id);
    this.refreshActive();
  }
}
