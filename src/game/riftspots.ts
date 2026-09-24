import * as THREE from 'three';
import { LAW, type EnemyView, type ExitAim, type RiftEndKind, type V3 } from '../core/contracts';
import { orientFrame, type RiftFrame } from './portalMath';
import type { RiftSystem } from './portals';
import type { CollisionWorld } from '../world/collision';

/**
 * Where rift ends can go for the PORTAL key and the STRIKES: the floor under
 * someone, the nearest drop or water, the sky over him, a launcher end along
 * your aim, straight on past him, and the arc of whatever gets thrown out of it.
 */
export type Frame = RiftFrame & { kind: RiftEndKind };

export interface SpotHost {
  rifts: RiftSystem;
  world: CollisionWorld;
  level: { seaY: number; isSea(p: V3): boolean };
  /** Below this a body is lost (the void). */
  killYAt(p: V3): number;
}

export type Outcome = ExitAim['outcome'];

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const FWD = new THREE.Vector3(0, 0, 1);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _v = new THREE.Vector3();
const _p = new THREE.Vector3();

/** A floor end right under feet at `pos` (on a surface rifts can take), or null. */
export function floorUnder(h: SpotHost, pos: V3): Frame | null {
  const w = h.world;
  const g = w.groundAt(pos.x, pos.z, 0.05, pos.y + 0.3);
  const host = w.lastGround;
  if (!(g > -Infinity) || !host || host.noPortal || pos.y - g > 1.5) return null;
  return { position: new THREE.Vector3(pos.x, g + 0.01, pos.z), quaternion: orientFrame(UP, FWD), width: LAW.floorEndSize, height: LAW.floorEndSize, kind: 'floor' };
}

/**
 * Nearest point past an edge (the sea, or a drop of 12 m+) around `pos`,
 * between minD and maxD, in open air and in sight of it; or null.
 */
export function findEdge(h: SpotHost, pos: V3, minD: number, maxD: number): THREE.Vector3 | null {
  const w = h.world;
  const from = _c.set(pos.x, pos.y + 1.2, pos.z);
  let best: THREE.Vector3 | null = null;
  let bestD = Infinity;
  const p = _p;
  for (let d = minD; d <= maxD; d += 2.5) {
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      p.set(pos.x + Math.sin(a) * d, pos.y, pos.z + Math.cos(a) * d);
      const g = w.groundAt(p.x, p.z, 0.3, pos.y + 1);
      const sea = h.level.isSea(p) && !(g > h.level.seaY - 0.5);
      const drop = !(g > pos.y - 12);
      if (!sea && !drop) continue;
      // open air there (not inside a wall), and in sight
      if (w.ceilingAt(p.x, p.z, 0.3, pos.y + 0.5) < pos.y + 3.5) continue;
      if (!w.lineOfSight(from, _a.set(p.x, pos.y + 1.2, p.z))) continue;
      if (d < bestD) {
        bestD = d;
        best = p.clone().setY(sea ? Math.max(h.level.seaY, pos.y) : pos.y);
      }
    }
    if (best) break;
  }
  return best;
}

/** A standing door at `at` (on the ground there, else in the air at refY), its face along `face`. */
export function standingDoor(h: SpotHost, at: V3, face: V3, refY?: number): Frame {
  const w = h.world;
  const ref = refY ?? at.y;
  const g = w.groundAt(at.x, at.z, 0.3, ref + 1);
  const y = g > ref - 1.5 ? g : ref;
  const f = h.rifts.standingFrame(at.x, y, at.z, face);
  return { position: f.position.clone(), quaternion: f.quaternion.clone(), width: f.width, height: f.height, kind: g > ref - 1.5 ? 'stand' : 'air' };
}

/** A flat end facing down, `above` m over `pos` (lower if the roof is in the way); null without room. */
export function skyHatch(h: SpotHost, pos: V3, above: number, minAbove = 5): Frame | null {
  const w = h.world;
  const ceil = w.ceilingAt(pos.x, pos.z, 0.6, pos.y + 2);
  const y = Math.min(pos.y + above, ceil - 0.6);
  if (y - pos.y < minAbove) return null;
  return { position: new THREE.Vector3(pos.x, y, pos.z), quaternion: orientFrame(DOWN, FWD), width: LAW.floorEndSize, height: LAW.floorEndSize, kind: 'air' };
}

/**
 * Where to throw someone standing at `pos` when you don't aim it yourself:
 * out over the nearest water / drop (a door facing out), else down from as
 * high as the roof allows. `boost`: how hard the end throws.
 */
export function throwSpot(h: SpotHost, pos: V3, search = 22, away?: V3): { frame: Frame; boost: number } | null {
  const edge = findEdge(h, pos, 3, search);
  if (edge) {
    const face = new THREE.Vector3(edge.x - pos.x, 0, edge.z - pos.z).normalize();
    const f: Frame = { position: new THREE.Vector3(edge.x, Math.max(edge.y, h.level.seaY + 1) + 1.2, edge.z), quaternion: orientFrame(face, UP), width: 1.3, height: 2.4, kind: 'air' };
    return { frame: f, boost: 10 };
  }
  // out of the sky: off to one side of where he stood (right over it he'd just fall back in: a loop)
  const w = h.world;
  const base = away ? Math.atan2(pos.x - away.x, pos.z - away.z) : 0;
  for (const da of [0, 1.2, -1.2, 2.4, -2.4, Math.PI]) {
    const a = base + da;
    const x = pos.x + Math.sin(a) * 3.6, z = pos.z + Math.cos(a) * 3.6;
    const g = w.groundAt(x, z, 0.4, pos.y + 1);
    if (!(g > pos.y - 3)) continue;
    const p = _p.set(x, g, z);
    const sky = skyHatch(h, p, 16);
    if (sky) return { frame: sky, boost: 8 };
  }
  const sky = skyHatch(h, pos, 16);
  return sky ? { frame: sky, boost: 8 } : null;
}

/** How far a straight-on exit may be pulled back toward you: this far on your side of him (m). */
const STRAIGHT_BACK = 1.4;

/**
 * A GRAB let go of without an aim: a launcher end `past` m beyond him on the
 * level line `dir` (from you through him), `up` m over his feet, facing on
 * along it and tilted `tilt` rad up. A wall in the way pulls it back toward
 * you to 1.4 m short of it (as launchFrame does), so a wall right behind him
 * is what he hits; anything lower in the way there (a crate, stairs, a roof
 * over that spot) steps it back further, as far as 1.4 m on your side of
 * him, and he flies over it or into it. Null when it still doesn't fit.
 */
export function straightOn(h: SpotHost, pos: V3, dir: V3, past: number, up: number, tilt: number): Frame | null {
  const w = h.world;
  const o = _a.set(pos.x, pos.y + up, pos.z);
  const hit = w.raycast(o, dir, past + 1.4, { sight: false });
  const p = new THREE.Vector3();
  for (let d = hit ? hit.distance - 1.4 : past; d >= -STRAIGHT_BACK - 1e-6; d -= 0.25) {
    p.set(o.x + dir.x * d, o.y, o.z + dir.z * d);
    if (w.overlapsCylinder(p.x, p.z, 0.45, p.y - 0.95, p.y + 0.95)) continue;
    const n = _v.set(dir.x * Math.cos(tilt), Math.sin(tilt), dir.z * Math.cos(tilt));
    return { position: p, quaternion: orientFrame(n, UP), width: 1.3, height: 1.9, kind: 'air' };
  }
  return null;
}

/**
 * A launcher end along the aim: just short of what the aim hits (or `reach` m
 * out), facing along the aim, so what comes out flies where you look.
 * `along` is how far the player is along the ray (the camera sits behind).
 */
export function launchFrame(h: SpotHost, origin: V3, dir: V3, along: number, reach: number): { frame: Frame; reason: string | null } {
  const w = h.world;
  const hit = w.raycast(origin, dir, along + reach + 2, { sight: true });
  let d = along + reach;
  if (hit) d = Math.min(d, hit.distance - 1.4);
  const pos = new THREE.Vector3().copy(origin).addScaledVector(dir, d);
  const n = _v.copy(dir).normalize();
  const upRef = Math.abs(n.y) > 0.9 ? FWD : UP;
  const frame: Frame = { position: pos, quaternion: orientFrame(n, upRef), width: 1.3, height: 1.9, kind: 'air' };
  let reason: string | null = null;
  if (d < along + 2.2) reason = 'aim.space';
  else if (w.overlapsCylinder(pos.x, pos.z, 0.45, pos.y - 0.95, pos.y + 0.95)) reason = 'aim.space';
  return { frame, reason };
}

export interface ArcResult {
  /** Points written into the output array. */
  n: number;
  outcome: Outcome;
  /** An enemy the arc runs into (a body slam). */
  hit: EnemyView | null;
  end: THREE.Vector3;
  /** Time of flight to the end (s). */
  t: number;
}

/**
 * The flight of a body thrown from `start` at `vel` (its centre): sampled
 * into `out`, until it hits something, splashes or falls out of the world.
 * The outcome is what that would do to a man.
 */
export function simulateArc(
  h: SpotHost,
  start: V3,
  vel: V3,
  out: THREE.Vector3[],
  opts: { enemies?: readonly EnemyView[]; skipId?: number; maxT?: number; halfHeight?: number } = {},
): ArcResult {
  const w = h.world;
  const maxT = opts.maxT ?? 3.2;
  const half = opts.halfHeight ?? 0.9;
  const dt = 1 / 30;
  const p = _p.copy(start);
  const v = _v.copy(vel);
  let n = 0;
  if (out.length) out[n++].copy(p);
  let outcome: Outcome = 'safe';
  let hitE: EnemyView | null = null;
  let t = 0;
  const step = _a;
  for (; t < maxT; t += dt) {
    v.y -= LAW.gravity * dt;
    step.copy(v).multiplyScalar(dt);
    const len = step.length();
    if (len > 1e-5) {
      const hit = w.raycast(p, _b.copy(step).divideScalar(len), len + 0.3, { sight: false });
      if (hit && hit.distance <= len + 0.3) {
        p.copy(hit.point).addScaledVector(hit.normal, 0.1);
        const into = -v.dot(hit.normal);
        outcome = into >= LAW.killSpeed ? 'skull' : into >= LAW.knockSpeed ? 'stars' : 'safe';
        if (n < out.length) out[n++].copy(p);
        break;
      }
    }
    p.add(step);
    if (n < out.length) out[n++].copy(p);
    if (h.level.isSea(p) && p.y < h.level.seaY) {
      outcome = 'splash';
      break;
    }
    if (p.y - half < h.killYAt(p)) {
      outcome = 'void';
      break;
    }
    if (opts.enemies) {
      for (const e of opts.enemies) {
        if (!e.alive || e.id === opts.skipId) continue;
        const c = e.chest(_c);
        if (Math.abs(p.x - c.x) > 1.2 || Math.abs(p.z - c.z) > 1.2 || p.y < e.pos.y - 0.2 || p.y > e.pos.y + e.height + 0.3) continue;
        if (Math.hypot(p.x - c.x, p.z - c.z) < e.radius + 0.55) {
          hitE = e;
          outcome = v.length() >= LAW.killSpeed ? 'skull' : v.length() >= LAW.knockSpeed ? 'stars' : 'safe';
          break;
        }
      }
      if (hitE) break;
    }
  }
  return { n, outcome, hit: hitE, end: p.clone(), t };
}

/**
 * The enemy the aim is on: closest to the ray within `cone` (or right by it),
 * in `range` of the eye and in sight; `skip` excluded.
 */
export function lockOnEnemy(
  h: SpotHost,
  list: readonly EnemyView[],
  live: (e: EnemyView) => boolean,
  origin: V3,
  dir: V3,
  eye: V3,
  o: { skip?: EnemyView | null; cone: number; range: number; off?: number },
): EnemyView | null {
  let best: EnemyView | null = null;
  let bestScore = Infinity;
  for (const e of list) {
    if (!e.alive || e === o.skip || !live(e)) continue;
    const c = e.chest(_a);
    if (c.distanceTo(eye) > o.range) continue;
    _b.subVectors(c, origin);
    const al = _b.dot(dir);
    if (al <= 1) continue;
    const ang = Math.acos(Math.min(1, al / Math.max(1e-6, _b.length())));
    const off = _b.addScaledVector(dir, -al).length();
    if (ang > o.cone && off > (o.off ?? 1.2)) continue;
    if (!h.world.lineOfSight(eye, c)) continue;
    const score = ang + al * 0.002;
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

/** A launcher end `gap` m short of `at` on the line from `from`, facing it. */
export function facingFrame(at: V3, from: V3, gap: number, w = 1.3, hgt = 1.9): Frame {
  const d = new THREE.Vector3().subVectors(at, from).normalize();
  const pos = new THREE.Vector3().copy(at).addScaledVector(d, -gap);
  return { position: pos, quaternion: orientFrame(d, Math.abs(d.y) > 0.9 ? FWD : UP), width: w, height: hgt, kind: 'air' };
}

/** A door beside him (else in front of him, your side), facing him: what comes out goes into him. */
export function besideDoor(h: SpotHost, t: EnemyView, from: V3, aside = 3.2): Frame | null {
  const toT = new THREE.Vector3(t.pos.x - from.x, 0, t.pos.z - from.z);
  if (toT.lengthSq() < 1e-4) t.forward(toT).negate();
  toT.normalize();
  const tc = t.chest(new THREE.Vector3());
  const side = new THREE.Vector3(-toT.z, 0, toT.x);
  for (const s of [1, -1]) {
    const p = new THREE.Vector3(t.pos.x + side.x * s * aside, t.pos.y, t.pos.z + side.z * s * aside);
    if (!h.world.lineOfSight(_c.set(p.x, t.pos.y + 1.2, p.z), tc)) continue;
    const face = new THREE.Vector3(t.pos.x - p.x, 0, t.pos.z - p.z).normalize();
    return standingDoor(h, p, face, t.pos.y);
  }
  const p = new THREE.Vector3(t.pos.x - toT.x * 3, t.pos.y, t.pos.z - toT.z * 3);
  return standingDoor(h, p, toT, t.pos.y);
}
