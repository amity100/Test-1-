import * as THREE from 'three';
import type { EncounterDef, EnemyKind, LessonId, SpawnDef, ZoneId } from '../../core/contracts';

/** Spawn helper. `yaw` 0 faces +Z (north), PI/2 faces +X (east). */
export function spawn(zone: ZoneId, id: string, kind: EnemyKind, x: number, y: number, z: number, yaw: number, squad: string, o: Partial<SpawnDef> = {}): SpawnDef {
  const s: SpawnDef = { id: `${zone}.${id}`, kind, pos: new THREE.Vector3(x, y, z), yaw, zone, squad: `${zone}.${squad}`, state: o.state ?? 'idle' };
  if (o.route) s.route = o.route.map((p) => p.clone());
  if (o.wait) s.wait = o.wait.slice();
  if (o.perch) s.perch = true;
  return s;
}

export function encounter(zone: ZoneId, lesson: LessonId, trigger: THREE.Box3, spawns: SpawnDef[], requireClear: boolean, checkpoint?: { pos: THREE.Vector3; yaw: number }): EncounterDef {
  const e: EncounterDef = { id: `${zone}.${lesson}`, trigger, spawns, hintKey: `hint.${lesson}`, lesson, requireClear };
  if (checkpoint) e.checkpoint = { pos: checkpoint.pos.clone(), yaw: checkpoint.yaw };
  return e;
}

export const YAW = { N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2 };
