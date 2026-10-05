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
 * crosshair points, at once; its twin (the ENTRANCE) opens right in front of
 * you, on the crosshair. Whatever goes into one comes out of the other with
 * its speed: you, a bolt, a knife's reach, a man. You choose where; nothing
 * attacks for you.
 *
 * - PORTAL (RMB / LT / the PORTAL button): the pair opens, now. With the
 *   crosshair on (or near) a man, the exit opens NEXT TO HIM (1.3 m, behind
 *   him as you see him, facing him; you see it as a ghost before you press).
 *   Held, a flick / drag / the stick picks his side (left, right, above,
 *   below, in front); off a man, a held PORTAL drags the exit along the
 *   crosshair.
 * - GO (Q / B / the GO button): a 0.12 s dash into the near twin, out of the
 *   exit facing him; a STAB or FIRE pressed during it lands on arrival, and
 *   the stab reaches further for a beat.
 * - FIRE (a rifle through the near twin comes out of the exit), STAB (with a
 *   man by the exit, the knife goes through), PULL (yank the man by the exit
 *   through to you; again: throw).
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
  w: 1.3,
  h: 2.1,
  flat: 1.4,
  /** The pair lives this long (s), the next press no sooner than `cooldown` (s) after, no travel for `grace` (s) after it opens (0: none; you cross only moving into its front). */
  life: 6,
  cooldown: 0.15,
  grace: 0,
  /** Held longer than this (s), the exit follows the crosshair live (off a man) / the look picks his side (on a man). */
  live: 0.15,
  /**
   * The near twin: `ahead` m in front of your chest on the crosshair (plus `lead` s per m/s you run at
   * it, at most `max`), centred on the crosshair as far as it can be while your own body line stays
   * `body` m inside it and the crosshair `margin` m inside; standing on your floor unless the crosshair
   * needs it raised (at most `float` m off it). While it is open it slides sideways with you (`follow`: a
   * strafe keeps it, and him in it, on your crosshair; walking at it still walks you in).
   */
  near: { ahead: 1.0, lead: 0.05, max: 1.4, body: 0.2, margin: 0.3, float: 0.6, follow: true },
  /**
   * The crosshair on a man: within `deg` (by device) of his body (his radius plus `pad` m, his height
   * plus `padY` m), in sight, within `range` m; a tap within `tapPx` px of him on the screen. The exit
   * opens `dist` m from where he will be in `lead` s, on the side you pick (default: behind him as you
   * see him), facing him, standing on his floor.
   */
  magnet: { deg: { kbm: 3, pad: 4.5, touch: 7 }, pad: 0.35, padY: 0.3, range: 45, tapPx: 60, dist: 1.3, lead: 0.2 },
  /** The side choice: PORTAL held on a man this long (s), the look picks his side; a flick shorter than `dead` (of a full push) keeps the default; ABOVE stands `over` m over his head. */
  snap: { pick: 0.06, over: 0.7, dead: 0.35 },
  /**
   * The knife: a man within `direct` m in front of you (a lunge), else (a pair open, its near twin within
   * `nearMax` m of you) whoever stands within `reach` m in front of the exit. After GO, for `edgeTime` s,
   * the knife reaches `edge` m further (and `edgeY` m up or down).
   */
  stab: { reach: 2.0, melee: 1.5, cooldown: 0.4, direct: 1.8, nearMax: 3.6, edge: 1.0, edgeY: 2.6, edgeTime: 0.35 },
  /** GO: the dash into the near twin takes `time` s; out of the exit at `arrive` m/s along its front; a STAB / FIRE pressed within `buffer` s before arriving lands on arrival; the pair shuts `close` s after (it has done its work: nothing of it in your view once you are out). */
  go: { time: 0.12, arrive: 3.2, buffer: 0.25, close: 0 },
  /** PULL: the man within `reach` m in front of the exit, through in `through` s, out in `out` s onto your crosshair `land` m ahead, staggered `stun` s, yours to throw for `hold` s. A man who falls or walks out of your near twin comes out at `drop` m/s (in front of you, not past you). */
  pull: { reach: 2.5, land: 2.0, stun: 1.2, hold: 0.6, through: 0.18, out: 0.16, arc: 0.45, drop: 1.2 },
  throw: { speed: 18, up: 6, bodyDamage: 35 },
  /** Deaths on the way: a fall this high (m), a body hitting a wall this fast (m/s); the softer ones hurt. */
  fall: { kill: 8, hurt: 4, hurtDamage: 25, stun: 1.6 },
  slam: { kill: 12, hurt: 8, hurtDamage: 20 },
  rifle: { mag: 24, reload: 1.4, damage: 22, interval: 0.14, range: 90 },
  /**
   * They notice a new exit: in front of their eyes (this cone, cos) within `range` m after `time` s; at
   * their side after `side` s, behind them after `back` s (within `feel` m: they hear it, feel its draft).
   * Then they turn to it for `react` s.
   */
  notice: { range: 8, cos: 0.5, time: 0.35, side: 0.6, back: 0.8, feel: 4, react: 1.4 },
  hero: { hp: 100 },
  enemy: {
    react: [0.4, 0.8] as readonly [number, number],
    gunner: { hp: 60, damage: 12, aim: 0.5, shots: 3, gap: 0.13, rest: [1.2, 2.2] as readonly [number, number], keep: [7, 17] as readonly [number, number], run: 4.6, spread: 0.012, hide: [1.8, 3.2] as readonly [number, number], maxShooters: 2, intoPortal: 0.55, volleyGap: 0.8 },
    mirror: { hp: 70, speed: 2.2, shieldDist: 1.5, shieldW: 1.5, shieldH: 2.0, turn: (140 * Math.PI) / 180, returnChance: 0.3, bash: { reach: 2.0, windup: 0.6, damage: 18, push: 5, cooldown: 1.4 } },
    rusher: { hp: 50, run: 6.4, windup: 0.45, damage: 25, reach: 2.1, hit: 2.6, cooldown: 1.0, push: 5, portalFrom: 9, portalChance: 0.6, portalTele: 0.5, portalLife: 5, portalGap: 5, near: 2.6, ahead: 1.4 },
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
 * The near twin: right in front of you on the crosshair. Its plane stands
 * AIMP.near.ahead m in front of your chest along your aim (flat; a little
 * further when you run at it; nearer if a wall is in the way), facing you;
 * across, it is centred on the point where the crosshair ray meets that plane,
 * as far as your own body line stays AIMP.near.body m inside it (the camera
 * sits over your shoulder: the two are a hand apart); up, its bottom is on
 * your floor unless the crosshair needs it raised (AIMP.near.float m at most,
 * then as far as the crosshair stays AIMP.near.margin m inside). So the
 * crosshair is always in it: a round or a stab aimed at what you see through
 * it goes through it, and one step (or GO) takes you in.
 */
export function nearSpot(
  world: Pick<CollisionWorld, 'raycast'>,
  chest: V3,
  ray: { origin: V3; dir: V3 },
  speedAlong: number,
  groundAt: (x: number, z: number, y: number) => number,
): Spot {
  const N = AIMP.near;
  const s = newSpot();
  s.w = AIMP.w;
  s.h = AIMP.h;
  const aim = flat(ray.dir, new THREE.Vector3());
  let ahead: number = N.ahead + THREE.MathUtils.clamp(speedAlong * N.lead, 0, N.max - N.ahead);
  const wall = world.raycast(_a.set(chest.x, chest.y, chest.z), _b.set(aim.x, 0, aim.z), ahead + 0.5);
  if (wall) ahead = Math.max(0.6, wall.distance - 0.45);
  // where the crosshair ray meets the plane `ahead` in front of your chest
  const d = ray.dir;
  const den = d.x * aim.x + d.z * aim.z;
  const cx = new THREE.Vector3(chest.x + aim.x * ahead, chest.y, chest.z + aim.z * ahead);
  if (den > 0.15) {
    const k = (ahead - ((ray.origin.x - chest.x) * aim.x + (ray.origin.z - chest.z) * aim.z)) / den;
    cx.set(ray.origin.x + d.x * k, ray.origin.y + d.y * k, ray.origin.z + d.z * k);
  }
  // across: on the crosshair, your body line kept inside
  const rx = -aim.z, rz = aim.x;
  const across = (cx.x - chest.x) * rx + (cx.z - chest.z) * rz;
  const hw = s.w / 2;
  const lo = Math.max(across - (hw - N.margin), -(hw - N.body));
  const hi = Math.min(across + (hw - N.margin), hw - N.body);
  const c = lo <= hi ? THREE.MathUtils.clamp(across, lo, hi) : THREE.MathUtils.clamp(across, -(hw - N.body), hw - N.body);
  s.pos.set(chest.x + aim.x * ahead + rx * c, 0, chest.z + aim.z * ahead + rz * c);
  // up: on your floor, raised only as far as the crosshair needs
  const g0 = groundAt(s.pos.x, s.pos.z, chest.y);
  const floor = g0 > -Infinity && Math.abs(g0 - (chest.y - 1.1)) < 1.3 ? g0 : chest.y - 1.1;
  const base = floor + s.h / 2 + 0.02;
  let y = THREE.MathUtils.clamp(cx.y, base, base + N.float);
  if (cx.y > y + s.h / 2 - N.margin) y = cx.y - (s.h / 2 - N.margin);
  if (cx.y < y - s.h / 2 + N.margin) y = Math.max(base, cx.y + s.h / 2 - N.margin);
  s.pos.y = y;
  s.surface = 'wall';
  s.normal.set(-aim.x, 0, -aim.z);
  s.hdir.copy(aim);
  s.dist = ahead;
  return s;
}

// ---------------------------------------------------------------------------
// Next to a man: which man, which side of him
// ---------------------------------------------------------------------------

/**
 * The side of a man the exit opens at, AS YOU SEE HIM: BEHIND him (the
 * default: the far side from you, or his back if he faces away from you),
 * FRONT (in his face), LEFT / RIGHT (as the screen shows them), ABOVE (a disc
 * over his head looking down), BELOW (a disc in the floor under his feet).
 */
export type Side = 'behind' | 'front' | 'left' | 'right' | 'above' | 'below';
export const SIDES: readonly Side[] = ['behind', 'front', 'left', 'right', 'above', 'below'];
/** The compass a flick picks from (clockwise from the top, 45° apart): up ABOVE, right RIGHT, down BELOW, left LEFT; the upper diagonals (further away on the screen) BEHIND, the lower ones (nearer) FRONT. */
export const COMPASS: readonly Side[] = ['above', 'behind', 'right', 'front', 'below', 'front', 'left', 'behind'];

/** The side a flick / drag / stick (x right, y up) picks: nothing much is BEHIND him (the default). */
export function pickSide(vx: number, vy: number, dead: number = AIMP.snap.dead): Side {
  if (Math.hypot(vx, vy) < dead) return 'behind';
  let a = Math.atan2(vx, vy);
  if (a < 0) a += Math.PI * 2;
  return COMPASS[Math.round(a / (Math.PI / 4)) % 8];
}

/** Where a side sits on the HUD's compass (rad, from the top clockwise); BEHIND (the default) is its middle: null. */
export const compassAngle = (s: Side): number | null => (s === 'behind' ? null : s === 'front' ? (Math.PI * 3) / 4 : (COMPASS.indexOf(s) * Math.PI) / 4);

export interface Body {
  readonly pos: V3;
  readonly yaw: number;
  readonly height: number;
}

/** His facing, his right, his left (flat unit vectors). */
export const facing = (yaw: number, out = new THREE.Vector3()) => out.set(Math.sin(yaw), 0, Math.cos(yaw));
export const leftOf = (yaw: number, out = new THREE.Vector3()) => out.set(Math.cos(yaw), 0, -Math.sin(yaw));

/**
 * The flat direction from him to the side's spot, as `view` (your flat look
 * at him, unit) sees it: BEHIND is along `view` (the far side), or against it
 * when that is in his face (he faces away from you: his back is your side);
 * FRONT the other one; RIGHT / LEFT as your screen has them.
 */
export function sideDir(e: Body, side: Exclude<Side, 'above' | 'below'>, view: V3, out = new THREE.Vector3()): THREE.Vector3 {
  const v = flat(view, out);
  if (side === 'right') return out.set(-v.z, 0, v.x);
  if (side === 'left') return out.set(v.z, 0, -v.x);
  // (his face toward the far side: more than ±60° away from you, the far side is in front of him)
  const f = facing(e.yaw, _a);
  const away = f.x * v.x + f.z * v.z >= 0.5;
  const far = side === 'behind' ? !away : away;
  return far ? out : out.negate();
}

/**
 * Where the exit opens for a side of a man (feet `pos`, facing `yaw`), seen
 * along `view`: AIMP.magnet.dist m from him, standing on his floor (`floorY`),
 * its front toward him (a stab or a round through it comes at him from
 * there). ABOVE: a disc over his head looking down; BELOW: a disc in the floor
 * under his feet looking up (he drops through it).
 */
export function snapSpot(e: Body, side: Side, floorY: number = e.pos.y, d: number = AIMP.magnet.dist, view: V3 = facing(e.yaw).negate()): Spot {
  const s = newSpot();
  const v = flat(view, new THREE.Vector3());
  if (side === 'above') {
    s.surface = 'ceiling';
    s.w = s.h = AIMP.flat;
    s.pos.set(e.pos.x, e.pos.y + e.height + AIMP.snap.over, e.pos.z);
    s.normal.set(0, -1, 0);
    s.hdir.copy(v);
    return s;
  }
  if (side === 'below') {
    s.surface = 'floor';
    s.w = s.h = AIMP.flat;
    s.pos.set(e.pos.x, floorY + AIMP.off, e.pos.z);
    s.normal.set(0, 1, 0);
    s.hdir.copy(v);
    return s;
  }
  const dir = sideDir(e, side, v, new THREE.Vector3());
  s.surface = 'wall';
  s.pos.set(e.pos.x + dir.x * d, floorY + AIMP.h / 2 + 0.02, e.pos.z + dir.z * d);
  s.normal.set(-dir.x, 0, -dir.z);
  return s;
}

/**
 * A side spot that fits the world: a wall between him and it (his back to a
 * wall) brings it in against that wall (still on his side of it); sealed or
 * too tight there, it refuses.
 */
export function fitSnap(world: Pick<CollisionWorld, 'raycast'>, e: Body, side: Side, floorY: number = e.pos.y, view?: V3): Spot {
  const s = snapSpot(e, side, floorY, AIMP.magnet.dist, view);
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
  // (at his chest and at his knees: a low block behind him counts too)
  let hit = world.raycast(chest, toward, dist + 0.5);
  const low = world.raycast(new THREE.Vector3(e.pos.x, e.pos.y + 0.35, e.pos.z), toward, dist + 0.5);
  if (low && (!hit || low.distance < hit.distance)) hit = low;
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

/** Where a man will be in `lead` s at his ground speed (`vel`; a man in the air, or nearly still: where he is). */
export function leadPos(pos: V3, vel: V3, lead: number = AIMP.magnet.lead, out = new THREE.Vector3()): THREE.Vector3 {
  const sp = Math.hypot(vel.x, vel.z);
  out.set(pos.x, pos.y, pos.z);
  if (sp < 0.5 || sp > 9) return out;
  return out.set(pos.x + vel.x * lead, pos.y, pos.z + vel.z * lead);
}

/**
 * The man the crosshair is on: of those within `range` and in sight
 * (`blocked(from, to)`: a wall between, tried at his chest and his head), the
 * one whose body (his radius plus AIMP.magnet.pad, his height plus
 * AIMP.magnet.padY) the ray passes closest to, measured against how much
 * leeway he gets: the body's own size plus `pad` rad of the distance (a man
 * far off gets as much help as a near one, by angle). Null: none within it.
 */
export function magnetTarget<T extends Target>(
  origin: V3,
  dir: V3,
  list: readonly T[],
  pad: number,
  blocked: (from: V3, to: V3) => boolean,
  range: number = AIMP.magnet.range,
): T | null {
  const M = AIMP.magnet;
  let best: T | null = null;
  let bs = Infinity;
  const tp = Math.tan(pad);
  for (const e of list) {
    const ox = e.pos.x - origin.x, oz = e.pos.z - origin.z;
    const dist = Math.hypot(ox, oz);
    if (dist > range) continue;
    // the ray's point nearest his (vertical) axis
    const dd = dir.x * dir.x + dir.z * dir.z;
    const t = dd > 1e-6 ? (ox * dir.x + oz * dir.z) / dd : 0;
    if (t <= 0) continue;
    const px = origin.x + dir.x * t - e.pos.x, pz = origin.z + dir.z * t - e.pos.z;
    const py = origin.y + dir.y * t;
    const lo = e.pos.y - M.padY, hi = e.pos.y + e.height + M.padY;
    const dy = py < lo ? lo - py : py > hi ? py - hi : 0;
    const off = Math.hypot(Math.max(0, Math.hypot(px, pz) - (e.radius + M.pad)), dy);
    const leeway = tp * dist + 0.05;
    if (off > leeway) continue;
    const score = off / leeway + dist * 0.002;
    if (score >= bs) continue;
    _a.set(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z);
    _b.set(e.pos.x, e.pos.y + e.height - 0.1, e.pos.z);
    if (blocked(origin, _a) && blocked(origin, _b)) continue;
    bs = score;
    best = e;
  }
  return best;
}

/**
 * A tap on the screen (CSS px, `x`, `y`) near a man: of the men whose body
 * (feet to head, projected by `project` into CSS px; null: off the screen)
 * passes within `px` of the tap, the nearest to it.
 */
export function tapTarget<T extends Target>(x: number, y: number, list: readonly T[], project: (p: V3) => { x: number; y: number } | null, blocked: (to: V3) => boolean, px: number = AIMP.magnet.tapPx): T | null {
  let best: T | null = null;
  let bd = Infinity;
  for (const e of list) {
    const a = project(_a.set(e.pos.x, e.pos.y + 0.1, e.pos.z));
    const b = project(_b.set(e.pos.x, e.pos.y + e.height, e.pos.z));
    if (!a || !b) continue;
    // the distance from the tap to the segment feet..head on the screen
    const sx = b.x - a.x, sy = b.y - a.y;
    const l2 = sx * sx + sy * sy;
    const k = l2 > 1e-6 ? THREE.MathUtils.clamp(((x - a.x) * sx + (y - a.y) * sy) / l2, 0, 1) : 0;
    const d = Math.hypot(x - (a.x + sx * k), y - (a.y + sy * k));
    if (d > px || d >= bd) continue;
    if (blocked(_a.set(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z)) && blocked(_b.set(e.pos.x, e.pos.y + e.height - 0.1, e.pos.z))) continue;
    bd = d;
    best = e;
  }
  return best;
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
  const dx = from.x - pos.x, dz = from.z - pos.z;
  const d = Math.hypot(dx, dz);
  // (straight over his head or under his feet is no side he can guard)
  if (d < 0.5) return false;
  if (!mirror) return sideOf(pos, yaw, from) === 'front';
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

/**
 * How long a man (eyes `eye`, facing `yaw`) takes to notice a new exit at `p`
 * (s; null: he doesn't): in front of his eyes AIMP.notice.time; at his side
 * AIMP.notice.side, behind him AIMP.notice.back when it is within
 * AIMP.notice.feel m of him (he hears it, he feels its draft).
 */
export function noticeDelay(eye: V3, yaw: number, p: V3): number | null {
  const N = AIMP.notice;
  if (notices(eye, yaw, p)) return N.time;
  const dx = p.x - eye.x, dz = p.z - eye.z;
  const d = Math.hypot(dx, dz);
  if (d > N.feel || Math.abs(p.y - eye.y) > 4) return null;
  const c = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / Math.max(d, 1e-6);
  return c > -0.5 ? N.side : N.back;
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
