import * as THREE from 'three';
import type { V3 } from '../core/contracts';
import type { Collider, CollisionWorld } from '../world/collision';
import { orientFrame, type RiftFrame } from './portalMath';
import { bodyPoint, flat, sideOf } from './reach';

export { aimOn } from './variant';

/**
 * AIM PORTAL (the COMBAT LAB's mechanic; DESIGN §14). Every number lives here.
 *
 * ONE RULE: a PAIR of portals. The far one (the EXIT) opens where the
 * crosshair points, at once; its twin (the ENTRANCE) opens in front of you.
 * Whatever goes into one comes out of the other with its speed: you, a bolt,
 * a knife's reach, a man. The crosshair is the cursor; nothing is chosen for
 * you.
 *
 * - PORTAL (RMB tap / LT / the PORTAL button): the pair opens, now. Held, the
 *   exit follows the crosshair; let go and it stays.
 * - SNAP (Ctrl or MMB held / R-stick with LT / a drag from PORTAL), with the
 *   crosshair on a man: the exit opens at the side of him you pick (behind,
 *   front, left, right, above, below, relative to HIS facing).
 * - FIRE (a rifle through the near twin comes out of the exit), STAB (a knife
 *   through it), PULL (yank the man by the exit through to you; again: throw).
 */
export const AIMP = {
  /** How far the crosshair places an exit (m, from your eyes). */
  range: 30,
  /** Mid-air: default distance, wheel limits and step (m). */
  air: { def: 12, min: 3, max: 30, step: 1.5 },
  /** An exit stands this far off its surface (m). */
  off: 0.05,
  /** A surface nearer than this to your eyes refuses a portal (m). */
  minDist: 1.6,
  /** Person-sized: width, height; the horizontal ones (floor, ceiling) a disc this wide (m). */
  w: 1.1,
  h: 2.0,
  flat: 1.4,
  /** The pair lives this long (s), the next press no sooner than `cooldown` (s) after, no travel for `grace` (s) after it opens. */
  life: 6,
  cooldown: 0.15,
  grace: 0.25,
  /** Held longer than this (s), the exit follows the crosshair live. */
  live: 0.15,
  /** The near twin: this far ahead (m), plus this much per m/s you run at it (s), at most this far (m). */
  near: { ahead: 1.3, lead: 0.2, max: 3.0 },
  /** SNAP: the exit stands this far from him (m); above him this high over his head (m). */
  snap: { dist: 1.2, over: 0.7, dead: 0.35 },
  /** Hits through the pair: the knife reaches this far in front of the exit (m), the pull this far (m). */
  stab: { reach: 1.5, melee: 1.5, cooldown: 0.4, direct: 1.8 },
  pull: { reach: 2.5, land: 2.0, stun: 1.2, hold: 0.6, through: 0.18, out: 0.16, arc: 0.45 },
  throw: { speed: 18, up: 6, bodyDamage: 35 },
  /** Deaths on the way: a fall this high (m), a body hitting a wall this fast (m/s); the softer ones hurt. */
  fall: { kill: 8, hurt: 3, hurtDamage: 25, stun: 1.6 },
  slam: { kill: 12, hurt: 8, hurtDamage: 20 },
  rifle: { mag: 24, reload: 1.4, damage: 22, interval: 0.14, range: 90 },
  /** A man in front of a new exit within `range` (m) and this cone (cos), seen this long (s), turns to it. */
  notice: { range: 8, cos: 0.5, time: 0.35, react: 1.4 },
  hero: { hp: 100 },
  enemy: {
    react: [0.4, 0.8] as readonly [number, number],
    gunner: { hp: 60, damage: 12, aim: 0.5, shots: 3, gap: 0.13, rest: [0.9, 1.6] as readonly [number, number], keep: [7, 17] as readonly [number, number], run: 4.6, spread: 0.012, hide: [1.4, 2.4] as readonly [number, number], maxShooters: 2, intoPortal: 0.55 },
    mirror: { hp: 70, speed: 2.6, shieldDist: 1.5, shieldW: 1.5, shieldH: 2.0, turn: (140 * Math.PI) / 180, returnChance: 0.3, bash: { reach: 2.0, windup: 0.6, damage: 18, push: 5, cooldown: 1.4 } },
    rusher: { hp: 50, run: 6.4, windup: 0.45, damage: 25, reach: 2.1, hit: 2.6, cooldown: 1.0, push: 5, portalFrom: 9, portalChance: 0.5, portalTele: 0.5, portalLife: 5, portalGap: 5, near: 2.6, ahead: 1.4 },
  },
  waves: { first: 2, between: 1.8 },
};

export type Surface = 'wall' | 'floor' | 'ceiling' | 'air';
export type PortalRefusal = 'sealed' | 'close' | null;

/** Where a portal stands: its centre, which way its front looks (unit), what it's on. */
export interface Spot {
  readonly pos: THREE.Vector3;
  /** Out of the front (unit). */
  readonly normal: THREE.Vector3;
  /** Floor / ceiling ones: the frame's up (flat, unit). */
  readonly hdir: THREE.Vector3;
  surface: Surface;
  w: number;
  h: number;
  /** From your eyes (m). */
  dist: number;
  ok: boolean;
  reason: PortalRefusal;
}

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export const newSpot = (): Spot => ({ pos: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1), hdir: new THREE.Vector3(0, 0, 1), surface: 'air', w: AIMP.w, h: AIMP.h, dist: 0, ok: true, reason: null });

/**
 * Where the crosshair ray (origin = the camera, unit dir; `eye`: your eyes)
 * puts the exit: on the first surface it meets within AIMP.range (a wall: a
 * hair off it, the floor, a ceiling), else in mid-air at `air` m (the wheel;
 * default AIMP.air.def), facing you. `air` set (not null) also stops a farther
 * surface short: mid-air at that distance. A sealed panel refuses it
 * (`ok` false, reason 'sealed'); a surface nearer than AIMP.minDist, too.
 */
export function placeExit(
  world: Pick<CollisionWorld, 'raycast'>,
  origin: V3,
  dir: V3,
  eye: V3,
  air: number | null,
  groundAt: (x: number, z: number, y: number) => number,
): Spot {
  const s = newSpot();
  // (the ray starts at the camera: its distances run that much past your eyes)
  const lead = Math.max(0, _a.subVectors(eye, origin).dot(dir));
  const maxT = lead + AIMP.range;
  const hit = world.raycast(origin as THREE.Vector3, dir as THREE.Vector3, maxT);
  const airT = air !== null ? lead + THREE.MathUtils.clamp(air, AIMP.air.min, AIMP.air.max) : null;
  if (hit && (airT === null || hit.distance <= airT)) {
    const n = hit.normal;
    if (n.y > 0.6) {
      s.surface = 'floor';
      s.pos.copy(hit.point).addScaledVector(UP, AIMP.off);
      s.normal.set(0, 1, 0);
      flat(dir, s.hdir);
      s.w = s.h = AIMP.flat;
    } else if (n.y < -0.6) {
      s.surface = 'ceiling';
      s.pos.copy(hit.point).addScaledVector(UP, -AIMP.off);
      s.normal.set(0, -1, 0);
      flat(dir, s.hdir);
      s.w = s.h = AIMP.flat;
    } else {
      s.surface = 'wall';
      flat(n, s.normal);
      s.pos.copy(hit.point).addScaledVector(s.normal, AIMP.off);
      standOnFloor(s, groundAt);
    }
    s.dist = Math.max(0, hit.distance - lead);
    const col = hit.collider as Collider;
    if (col.noPortal) {
      s.ok = false;
      s.reason = 'sealed';
    }
  } else {
    const t = airT ?? lead + AIMP.air.def;
    s.surface = 'air';
    s.pos.copy(origin).addScaledVector(dir, t);
    s.dist = t - lead;
    // mid-air: upright, facing you
    flat(_a.subVectors(eye, s.pos), s.normal);
    standOnFloor(s, groundAt);
  }
  if (s.ok && s.dist < AIMP.minDist) {
    s.ok = false;
    s.reason = 'close';
  }
  return s;
}

/** A tall one never sinks into the floor: its bottom is on it at the lowest. */
function standOnFloor(s: Spot, groundAt: (x: number, z: number, y: number) => number) {
  const g = groundAt(s.pos.x, s.pos.z, s.pos.y + s.h / 2);
  if (g > -Infinity && s.pos.y - s.h / 2 < g + 0.02) s.pos.y = g + s.h / 2 + 0.02;
}

/** A spot's frame for the rift system (kind: what it is on). */
export function spotFrame(s: Pick<Spot, 'pos' | 'normal' | 'hdir' | 'surface' | 'w' | 'h'>, kind?: 'stand' | 'air' | 'wall' | 'floor' | 'ceiling') {
  const horizontal = Math.abs(s.normal.y) > 0.9;
  const q = orientFrame(new THREE.Vector3().copy(s.normal), horizontal ? new THREE.Vector3().copy(s.hdir) : UP);
  const k = kind ?? (s.surface === 'air' ? 'air' : s.surface);
  return { position: new THREE.Vector3().copy(s.pos), quaternion: q, width: s.w, height: s.h, kind: k } satisfies RiftFrame & { kind: string };
}

/**
 * The near twin: this far in front of your feet along your aim (flat),
 * further when you run at it (so you do not run into it by accident), nearer
 * if a wall is in the way, bottom on your floor, facing you.
 */
export function nearSpot(
  world: Pick<CollisionWorld, 'raycast'>,
  feet: V3,
  aimFlat: V3,
  speedAlong: number,
  groundAt: (x: number, z: number, y: number) => number,
): Spot {
  const s = newSpot();
  let ahead: number = AIMP.near.ahead + THREE.MathUtils.clamp(speedAlong * AIMP.near.lead, 0, AIMP.near.max - AIMP.near.ahead);
  const wall = world.raycast(_a.set(feet.x, feet.y + 1, feet.z), _b.set(aimFlat.x, 0, aimFlat.z), ahead + 0.5);
  if (wall) ahead = Math.max(0.6, wall.distance - 0.45);
  s.surface = 'wall';
  s.normal.set(-aimFlat.x, 0, -aimFlat.z);
  s.pos.set(feet.x + aimFlat.x * ahead, feet.y + AIMP.h / 2 + 0.02, feet.z + aimFlat.z * ahead);
  const g = groundAt(s.pos.x, s.pos.z, feet.y + 1);
  if (g > -Infinity && Math.abs(g - feet.y) < 1.2) s.pos.y = g + AIMP.h / 2 + 0.02;
  s.dist = ahead;
  return s;
}

// ---------------------------------------------------------------------------
// SNAP: the side of a man
// ---------------------------------------------------------------------------

export type Side = 'behind' | 'front' | 'left' | 'right' | 'above' | 'below';
export const SIDES: readonly Side[] = ['behind', 'front', 'left', 'right', 'above', 'below'];
/** The compass: clockwise from the top, 60° apart. */
export const COMPASS: readonly Side[] = ['above', 'right', 'front', 'below', 'behind', 'left'];

/** The side a stick / mouse flick (x right, y up) picks: nothing much: BEHIND him (the one you most want). */
export function pickSide(vx: number, vy: number, dead: number = AIMP.snap.dead): Side {
  if (Math.hypot(vx, vy) < dead) return 'behind';
  let a = Math.atan2(vx, vy);
  if (a < 0) a += Math.PI * 2;
  return COMPASS[Math.round(a / (Math.PI / 3)) % 6];
}

/** The angle (rad, from the top clockwise) a side sits at on the compass. */
export const compassAngle = (s: Side) => (COMPASS.indexOf(s) * Math.PI) / 3;

export interface Body {
  readonly pos: V3;
  readonly yaw: number;
  readonly height: number;
}

/** His facing, his right, his left (flat unit vectors). */
export const facing = (yaw: number, out = new THREE.Vector3()) => out.set(Math.sin(yaw), 0, Math.cos(yaw));
export const leftOf = (yaw: number, out = new THREE.Vector3()) => out.set(Math.cos(yaw), 0, -Math.sin(yaw));

/**
 * Where SNAP opens the exit for a side of a man (feet `pos`, facing `yaw`):
 * AIMP.snap.dist from him on that side, its front toward him (a stab through
 * it comes from there; BEHIND: from his back). ABOVE: over his head, looking
 * down; BELOW: in the floor under his feet, looking up (he drops through it).
 * `floorY`: the floor under him (default his feet).
 */
export function snapSpot(e: Body, side: Side, floorY: number = e.pos.y, d: number = AIMP.snap.dist): Spot {
  const s = newSpot();
  const f = facing(e.yaw, new THREE.Vector3());
  if (side === 'above') {
    s.surface = 'ceiling';
    s.w = s.h = AIMP.flat;
    s.pos.set(e.pos.x, e.pos.y + e.height + AIMP.snap.over, e.pos.z);
    s.normal.set(0, -1, 0);
    s.hdir.copy(f);
    return s;
  }
  if (side === 'below') {
    s.surface = 'floor';
    s.w = s.h = AIMP.flat;
    s.pos.set(e.pos.x, floorY + AIMP.off, e.pos.z);
    s.normal.set(0, 1, 0);
    s.hdir.copy(f);
    return s;
  }
  const dir = side === 'behind' ? f.clone().negate() : side === 'front' ? f : side === 'left' ? leftOf(e.yaw, new THREE.Vector3()) : leftOf(e.yaw, new THREE.Vector3()).negate();
  s.surface = 'wall';
  s.pos.set(e.pos.x + dir.x * d, floorY + AIMP.h / 2 + 0.02, e.pos.z + dir.z * d);
  s.normal.set(-dir.x, 0, -dir.z);
  return s;
}

/**
 * A snap spot that fits the world: a wall between him and it (his back to a
 * wall) brings it in against that wall (still on his side of it); sealed or
 * too tight there, it refuses.
 */
export function fitSnap(world: Pick<CollisionWorld, 'raycast'>, e: Body, side: Side, floorY: number = e.pos.y): Spot {
  const s = snapSpot(e, side, floorY);
  if (side === 'above' || side === 'below') {
    // (a low ceiling over him: it opens against it)
    if (side === 'above') {
      const hit = world.raycast(_a.set(e.pos.x, e.pos.y + e.height * 0.5, e.pos.z), UP, e.height * 0.5 + AIMP.snap.over + AIMP.flat / 2);
      if (hit) {
        s.pos.y = hit.point.y - AIMP.off;
        if (hit.distance < e.height * 0.5 + 0.25) {
          s.ok = false;
          s.reason = 'close';
        } else if ((hit.collider as Collider).noPortal) {
          s.ok = false;
          s.reason = 'sealed';
        }
      }
    }
    return s;
  }
  const chest = _a.set(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z);
  const toward = _b.set(s.pos.x - chest.x, 0, s.pos.z - chest.z);
  const dist = toward.length();
  toward.multiplyScalar(1 / Math.max(dist, 1e-6));
  const hit = world.raycast(chest, toward, dist + 0.5);
  if (hit) {
    const wallD = hit.distance;
    if (wallD < 0.75) {
      s.ok = false;
      s.reason = 'close';
      return s;
    }
    // against the wall, on his side of it
    s.pos.set(hit.point.x + hit.normal.x * AIMP.off, s.pos.y, hit.point.z + hit.normal.z * AIMP.off);
    s.normal.set(hit.normal.x, 0, hit.normal.z).normalize();
    if ((hit.collider as Collider).noPortal) {
      s.ok = false;
      s.reason = 'sealed';
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// Rays and reach
// ---------------------------------------------------------------------------

/** Where a ray (origin `o`, unit `d`) meets a standing cylinder (feet `base`, radius `r`, height `h`): the distance along it, or -1. */
export function rayCylinder(o: V3, d: V3, base: V3, r: number, h: number): number {
  const ox = o.x - base.x, oz = o.z - base.z;
  const A = d.x * d.x + d.z * d.z;
  let t0 = -Infinity, t1 = Infinity;
  if (A < 1e-9) {
    if (ox * ox + oz * oz > r * r) return -1;
  } else {
    const B = 2 * (ox * d.x + oz * d.z);
    const C = ox * ox + oz * oz - r * r;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return -1;
    const sq = Math.sqrt(disc);
    t0 = (-B - sq) / (2 * A);
    t1 = (-B + sq) / (2 * A);
  }
  // the slab between his feet and his head
  let s0 = -Infinity, s1 = Infinity;
  if (Math.abs(d.y) < 1e-9) {
    if (o.y < base.y || o.y > base.y + h) return -1;
  } else {
    const a = (base.y - o.y) / d.y, b = (base.y + h - o.y) / d.y;
    s0 = Math.min(a, b);
    s1 = Math.max(a, b);
  }
  const lo = Math.max(t0, s0), hi = Math.min(t1, s1);
  if (hi < 0 || lo > hi) return -1;
  return Math.max(0, lo);
}

export interface Target {
  readonly id: number;
  readonly pos: V3;
  readonly height: number;
  readonly radius: number;
}

/**
 * The man under the crosshair: the nearest one the ray (origin, unit dir)
 * passes within `pad` rad (a thumb's help) of his body, in sight of the
 * origin (`blocked(from, to)`: a wall between), within `range`.
 */
export function crosshairTarget<T extends Target>(
  origin: V3,
  dir: V3,
  list: readonly T[],
  pad: number,
  blocked: (from: V3, to: V3) => boolean,
  range = 45,
): T | null {
  let best: T | null = null;
  let bt = Infinity;
  for (const e of list) {
    const dist = Math.hypot(e.pos.x - origin.x, e.pos.z - origin.z);
    if (dist > range) continue;
    const t = rayCylinder(origin, dir, e.pos, e.radius + 0.12 + Math.tan(pad) * dist, e.height + 0.1);
    if (t < 0 || t >= bt) continue;
    _a.set(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z);
    if (blocked(origin, _a)) continue;
    bt = t;
    best = e;
  }
  return best;
}

/** Local frame of a spot: `p` in front (+) / behind (-) of its plane, across it, up it. */
export function spotLocal(s: Pick<Spot, 'pos' | 'normal' | 'hdir' | 'surface'>, p: V3) {
  _a.subVectors(p, s.pos);
  const along = _a.dot(s.normal);
  if (Math.abs(s.normal.y) > 0.9) {
    // a floor / ceiling disc: across is the frame's x, up its hdir
    const across = _a.x * s.hdir.z - _a.z * s.hdir.x;
    const up = _a.x * s.hdir.x + _a.z * s.hdir.z;
    return { along, across, up };
  }
  return { along, across: _a.x * s.normal.z - _a.z * s.normal.x, up: _a.y };
}

/** `p` is in front of the spot within `reach` m of its plane, and over its face (a little more than its size). */
export function inFrontOf(s: Pick<Spot, 'pos' | 'normal' | 'hdir' | 'surface' | 'w' | 'h'>, p: V3, reach: number, slack = 0.45): boolean {
  const l = spotLocal(s, p);
  return l.along >= -0.3 && l.along <= reach && Math.abs(l.across) <= s.w / 2 + slack && Math.abs(l.up) <= s.h / 2 + slack;
}

/** Of `list`, the man standing within `reach` m in front of the spot (the nearest to its centre), by his body's nearest point. */
export function standingBy<T extends Target>(s: Pick<Spot, 'pos' | 'normal' | 'hdir' | 'surface' | 'w' | 'h'>, list: readonly T[], reach: number): T | null {
  let best: T | null = null;
  let bd = Infinity;
  for (const e of list) {
    // (for a horizontal one: his feet / chest, whichever is nearer its plane)
    const feet = _b.set(e.pos.x, e.pos.y + 0.05, e.pos.z);
    const body = bodyPoint(e.pos, e.height, s.pos, new THREE.Vector3());
    const ok = inFrontOf(s, body, reach) || (Math.abs(s.normal.y) > 0.9 && inFrontOf(s, feet, reach));
    if (!ok) continue;
    const d = body.distanceTo(s.pos);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// The men
// ---------------------------------------------------------------------------

/** Turn `yaw` toward `to` at most `rate` rad/s for `dt` s (the short way). */
export function turnToward(yaw: number, to: number, dt: number, rate: number): number {
  let d = to - yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const step = rate * dt;
  return yaw + THREE.MathUtils.clamp(d, -step, step);
}

export const yawTo = (from: V3, to: V3) => Math.atan2(to.x - from.x, to.z - from.z);

/**
 * The MIRROR's shield: a vertical panel AIMP.enemy.mirror.shieldDist m in
 * front of him (his facing `yaw`). The fraction (0..1) along a→b where the
 * segment enters it from the front, else null.
 */
export function shieldCross(pos: V3, yaw: number, a: V3, b: V3): number | null {
  const M = AIMP.enemy.mirror;
  const f = facing(yaw, new THREE.Vector3());
  const c = new THREE.Vector3(pos.x + f.x * M.shieldDist, pos.y + M.shieldH / 2, pos.z + f.z * M.shieldDist);
  const da = (a.x - c.x) * f.x + (a.z - c.z) * f.z;
  const db = (b.x - c.x) * f.x + (b.z - c.z) * f.z;
  if (!(da > 0 && db <= 0)) return null;
  const t = da / (da - db);
  const px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t, pz = a.z + (b.z - a.z) * t;
  const across = (px - c.x) * f.z - (pz - c.z) * f.x;
  if (Math.abs(across) > M.shieldW / 2 || Math.abs(py - c.y) > M.shieldH / 2) return null;
  return t;
}

/** A stab / pull from `from` lands on a man who sees it coming: the spot is in front of him (±60°). The MIRROR's front is where his shield looks (±70°). */
export function guarded(pos: V3, yaw: number, from: V3, mirror: boolean): boolean {
  if (!mirror) return sideOf(pos, yaw, from) === 'front';
  const dx = from.x - pos.x, dz = from.z - pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) return true;
  return (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / d >= Math.cos((70 * Math.PI) / 180);
}

/** What an impact does to a man in the air (a thrown man, one out of a portal): kill, hurt (stun), or nothing. */
export function impactOutcome(surface: 'ground' | 'wall' | 'ceiling', speed: number, fallHeight: number): 'kill' | 'hurt' | 'none' {
  if (surface === 'ground') {
    if (fallHeight >= AIMP.fall.kill) return 'kill';
    if (fallHeight >= AIMP.fall.hurt) return 'hurt';
    return 'none';
  }
  if (speed >= AIMP.slam.kill) return 'kill';
  if (speed >= AIMP.slam.hurt) return 'hurt';
  return 'none';
}

/** Where a pulled man lands: AIMP.pull.land in front of your feet along your aim. */
export function pullSpot(feet: V3, aimFlat: V3, k: number = AIMP.pull.land, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(feet.x + aimFlat.x * k, feet.y, feet.z + aimFlat.z * k);
}

/** A man (eyes `eye`, facing `yaw`) has the spot in front of his eyes, near enough to notice. */
export function notices(eye: V3, yaw: number, p: V3): boolean {
  const N = AIMP.notice;
  const dx = p.x - eye.x, dz = p.z - eye.z;
  const d = Math.hypot(dx, dz);
  if (d > N.range || Math.abs(p.y - eye.y) > 4) return false;
  if (d < 0.6) return true;
  return (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / d >= N.cos;
}

/** The lab's KILLS BY TOOL under AIM PORTAL. */
export type AimTool = 'rifle' | 'knife' | 'throw' | 'redirect' | 'other';

/** `yours`: what of yours hit him last, just now; `thrown`: he was thrown by you; `ported`: he went through your pair. */
export function aimKillTool(cause: string, yours: 'rifle' | 'knife' | null, thrown: boolean, ported: boolean): AimTool {
  if (thrown) return 'throw';
  if (ported && (cause === 'fall' || cause === 'void' || cause === 'water' || cause === 'impact')) return 'redirect';
  if (yours) return yours;
  if (cause === 'blade') return 'knife';
  return 'other';
}
