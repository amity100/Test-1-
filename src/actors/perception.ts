import * as THREE from 'three';
import type { EnemyContext } from '../core/contracts';
import type { CollisionWorld } from '../world/collision';
import { angleDiff } from './aimath';
import type { Enemy } from './enemy';
import { AI } from './tuning';

const _eye = new THREE.Vector3();
const _to = new THREE.Vector3();

/**
 * Vision: ±60° cone (or all-round once in combat), range scaled down for a
 * crouching player, blocked by world geometry. Light is not modelled (golden
 * hour). Returns the distance when seen, -1 otherwise. One raycast at most.
 */
export function seePlayer(e: Enemy, ctx: EnemyContext): number {
  const pl = ctx.player;
  if (!pl.alive) return -1;
  e.eye(_eye);
  _to.subVectors(pl.chest, _eye);
  const d = _to.length();
  const combat = e.mode === 'combat';
  const range = e.tune.sight * (pl.crouched ? AI.crouchRange : 1) * (combat ? 1.25 : 1);
  if (d > range) return -1;
  if (!combat && d > AI.nearSense) {
    const yawTo = Math.atan2(_to.x, _to.z);
    if (Math.abs(angleDiff(e.yaw, yawTo)) > AI.fovHalf) return -1;
  }
  if (!ctx.world.lineOfSight(_eye, pl.chest)) return -1;
  return d;
}

/** Detection meter gain per second at distance d (close = almost instant). */
export function detectRate(d: number, range: number) {
  if (d < 6) return AI.detectNear;
  const k = Math.min(1, (d - 6) / Math.max(1, range - 6));
  return AI.detectNear * 0.55 * (1 - k) + AI.detectFar * k;
}

/** Could `o` see a point (witnessing a death, a fall)? LOS within range; `cone` limits to his view. */
export function seesPoint(o: Enemy, p: THREE.Vector3, range: number, world: CollisionWorld, cone = false): boolean {
  o.eye(_eye);
  _to.subVectors(p, _eye);
  const d = _to.length();
  if (d > range) return false;
  if (cone && d > AI.nearSense && Math.abs(angleDiff(o.yaw, Math.atan2(_to.x, _to.z))) > AI.fovHalf * 1.5) return false;
  return world.lineOfSight(_eye, p);
}
