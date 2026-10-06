import * as THREE from 'three';
import type { V3 } from '../core/contracts';
import type { Collider, CollisionWorld, RayHit } from '../world/collision';
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
  /**
   * FIT (every portal you open: the exit, a link, the one by a man, the near twin): it lies wholly on its surface (no
   * edge over an edge, an opening or a sealed panel; nothing standing out of the surface within `clear` m in front of
   * it: a corner, a jamb), the crosshair's point at least `keep` m inside its edge. A wall one stands on the floor in
   * front of it while the crosshair is lower than its height (less `keep`): a door in the wall, not one hung on it.
   * Off where the crosshair is, it slides along the surface at most `slide` m (`step` m steps, the nearest first). A
   * face too small for it (a low wall, a sill, a jamb, a pillar, a stair) gets one upright on the floor `standOff` m
   * in front of it (that floor at most `stand` m under the crosshair). None of that: rays round the crosshair (`cone`°,
   * `rings` rings of 8) are tried, the nearest that fits wins (of one ring the further: through a window rather than
   * onto its sill); none: refused ('fit', NO ROOM).
   */
  fit: { keep: 0.15, clear: 0.2, slide: 0.6, step: 0.15, standOff: 0.12, stand: 1.6, cone: 2.4, rings: 3 },
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
   * needs it raised (at most `float` m off it). Something in its way (a wall, a jamb, a window's sill): it
   * stands `gap` m in front of it, never nearer your chest than `min` m (no room even there: raised over it, at
   * most `rise` m, as far as the crosshair stays in it); a wall up to `pass` m behind it never
   * stops you walking (or GO-ing) into it. While it is open it slides sideways with you (`follow`: a
   * strafe keeps it, and him in it, on your crosshair; walking at it still walks you in; never into a wall).
   * Your rounds go into it only while you aim within `cone`° (left or right) of the way it looks: turned
   * further to shoot someone else, they leave your rifle past it (the camera over your shoulder would still
   * see through it).
   */
  near: { ahead: 1.0, lead: 0.05, max: 1.4, body: 0.2, margin: 0.3, float: 0.6, rise: 1.3, gap: 0.06, min: 0.45, pass: 0.6, follow: true, cone: 25 },
  /**
   * The crosshair on a man: within `deg` (by device) of his body (his radius plus `pad` m, his height
   * plus `padY` m), in sight, within `range` m; a tap within `tapPx` px of him on the screen. Of two, the
   * one nearest the crosshair (by angle); the one it is on now keeps it until another is nearer by `stick`
   * (its angle counts that much less: no flicker between two men side by side). The exit opens `dist` m
   * from where he will be in `lead` s, on the side you pick (default: behind him as you see him), facing
   * him, standing on his floor; no room that way, the way is turned by `turn`° (the nearest that works);
   * a wall on it brings it in against the wall (no nearer him than `tight` m), slid along it at most
   * `slide` m.
   */
  magnet: {
    deg: { kbm: 3, pad: 4.5, touch: 7 },
    pad: 0.35,
    padY: 0.3,
    range: 45,
    tapPx: 60,
    dist: 1.3,
    lead: 0.2,
    stick: 0.6,
    turn: [0, 25, -25, 50, -50] as readonly number[],
    tight: 0.75,
    slide: 0.45,
  },
  /** The side choice: PORTAL held on a man this long (s), the look picks his side; a flick shorter than `dead` (of a full push) keeps the default; ABOVE stands `over` m over his head. */
  snap: { pick: 0.06, over: 0.7, dead: 0.35 },
  /**
   * The knife: a man within `direct` m in front of you (a lunge), else (a pair open, its near twin within
   * `nearMax` m of you) whoever stands within `reach` m in front of the exit. After GO, for `edgeTime` s,
   * the knife reaches `edge` m further (and `edgeY` m up or down).
   */
  stab: { reach: 2.0, melee: 1.5, cooldown: 0.4, direct: 1.8, nearMax: 3.6, edge: 1.0, edgeY: 2.6, edgeTime: 0.35 },
  /**
   * GO: the dash into the near twin takes `time` s (held up longer than `stall` s past it, by a body in the way:
   * you go through all the same); out of the exit at `arrive` m/s along its front, and out of an upright one a
   * step of `step` m at `stepSpeed` m/s (clear of the wall behind you: room for the view; never into a man); a
   * STAB / FIRE pressed within `buffer` s before arriving lands on arrival; the pair shuts `close` s after (it
   * has done its work: nothing of it in your view once you are out).
   */
  go: { time: 0.12, stall: 0.18, arrive: 3.2, step: 1.0, stepSpeed: 6, buffer: 0.25, close: 0 },
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
  /** The view: the camera pulled in closer than `far` m to your head (a wall right behind you, out of an exit on it), the hero fades, to `fade` at `near` m. */
  view: { far: 1.5, near: 0.85, fade: 0.28 },
  enemy: {
    react: [0.4, 0.8] as readonly [number, number],
    gunner: { hp: 60, damage: 12, aim: 0.5, shots: 3, gap: 0.13, rest: [1.2, 2.2] as readonly [number, number], keep: [7, 17] as readonly [number, number], run: 4.6, spread: 0.012, hide: [1.8, 3.2] as readonly [number, number], maxShooters: 2, intoPortal: 0.55, volleyGap: 0.8 },
    mirror: { hp: 70, speed: 2.2, shieldDist: 1.5, shieldW: 1.5, shieldH: 2.0, turn: (140 * Math.PI) / 180, returnChance: 0.3, bash: { reach: 2.0, windup: 0.6, damage: 18, push: 5, cooldown: 1.4 } },
    rusher: { hp: 50, run: 6.4, windup: 0.45, damage: 25, reach: 2.1, hit: 2.6, cooldown: 1.0, push: 5, portalFrom: 9, portalChance: 0.6, portalTele: 0.5, portalLife: 5, portalGap: 5, near: 2.6, ahead: 1.4 },
  },
  /**
   * What the men know of you (the compound: walls between you): they have you where they SAW you, or heard you
   * (within `hear` m, through a wall); `hunch` s without a sight and they get a rough idea (your place, `spread`
   * m out, again every `every` s): a wave can't stall. `hold`: the s a man stays on his post at the start.
   * AMBUSH: a man who has had no sight of you for `after` s (a man who never has: `first` s into the wave) may (`chance`, then `cd` s) come round by a red portal
   * of his own opening `behind` m behind you (a rusher `near`); `turn` s he spends turning to you first.
   * SEARCH: `pts` spots `radius` m round where he thought you were, `look` s at each.
   */
  intel: {
    hear: 6.5,
    hunch: 12,
    every: 4,
    spread: 5,
    hold: [4, 9] as readonly [number, number],
    ambush: { after: 5, first: 18, chance: 0.65, cd: [5, 9] as readonly [number, number], behind: 5.5, turn: 0.55 },
    search: { pts: 3, radius: [3, 8] as readonly [number, number], look: 0.9 },
  },
  waves: { first: 2, between: 1.8 },
};

/**
 * CHAIN (the lab's add-on; not the game): CHAIN opens a chain of up to `max` linked portals. Its first two are
 * the pair (the near twin, the exit); each PORTAL press after CHAIN adds the next link, on the surface under
 * the crosshair. Going into the near twin you come out of the exit as ever, and the chain carries you on:
 * `hop` s later out of the next link, and so on to the last, with your speed (the way you face is each link's).
 * A link must stand `gap` m from the others and on a surface (not mid-air). The chain shuts `life` s after its
 * last link (CHAIN again shuts it too); a new pair after a full chain, or your death, shuts it as well.
 */
export const CHAIN = { max: 4, life: 8, hop: 0.1, gap: 1.6, clear: [0.6, 0.9, 1.2] as readonly number[] };

/**
 * What a portal stands on: a WALL, the FLOOR, a CEILING (on the surface, a hair off it); STAND: upright on the
 * floor, free (by a man, or in front of a face too small to hold it: a low wall, a sill, a pillar, a stair);
 * AIR: upright in mid-air (nothing within reach of the crosshair).
 */
export type Surface = 'wall' | 'floor' | 'ceiling' | 'stand' | 'air';
/** Why one is refused: a sealed panel, too close to you, no room for it where you aim. */
export type PortalRefusal = 'sealed' | 'close' | 'fit' | null;

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
const _c = new THREE.Vector3();
const _q = new THREE.Vector3();

export const newSpot = (): Spot => ({ pos: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1), hdir: new THREE.Vector3(0, 0, 1), surface: 'air', w: AIMP.w, h: AIMP.h, dist: 0, ok: true, reason: null });

/** A copy of a spot (its own vectors). */
export function copySpot(s: Spot, out = newSpot()): Spot {
  out.pos.copy(s.pos);
  out.normal.copy(s.normal);
  out.hdir.copy(s.hdir);
  out.surface = s.surface;
  out.w = s.w;
  out.h = s.h;
  out.dist = s.dist;
  out.ok = s.ok;
  out.reason = s.reason;
  return out;
}

const refuse = (s: Spot, why: Exclude<PortalRefusal, null>) => {
  s.ok = false;
  s.reason = why;
  return s;
};

// ---------------------------------------------------------------------------
// FIT: a portal lies wholly on its surface, clear of everything round it
// ---------------------------------------------------------------------------

/** What the fit reads of the world. */
export type FitWorld = Pick<CollisionWorld, 'raycast' | 'queryBox'>;

/** The boxes round a point (within `r` m across, `ry` m up and down), enabled ones only. */
function boxesAround(world: FitWorld, p: V3, r: number, ry: number, out: Collider[]): Collider[] {
  world.queryBox(p.x - r, p.z - r, p.x + r, p.z + r, out);
  let n = 0;
  for (const c of out) {
    if (!c.enabled || c.max.y < p.y - ry || c.min.y > p.y + ry || c.max.x < p.x - r || c.min.x > p.x + r || c.max.z < p.z - r || c.min.z > p.z + r) continue;
    out[n++] = c;
  }
  out.length = n;
  return out;
}

/** The box (of `list`) a point is inside, else null. */
function boxAt(list: readonly Collider[], x: number, y: number, z: number): Collider | null {
  const e = 1e-3;
  for (const c of list) {
    if (x > c.min.x + e && x < c.max.x - e && y > c.min.y + e && y < c.max.y - e && z > c.min.z + e && z < c.max.z - e) return c;
  }
  return null;
}

/** A spot's face axes: `n` out of its front, `u` its up, `r` across it. */
function axes(s: Pick<Spot, 'normal' | 'hdir'>, n: THREE.Vector3, u: THREE.Vector3, r: THREE.Vector3) {
  n.copy(s.normal);
  if (Math.abs(n.y) > 0.9) u.set(s.hdir.x, 0, s.hdir.z).normalize();
  else u.copy(UP);
  r.crossVectors(u, n).normalize();
}

/** Its face, sampled: the middle, a ring at 0.55 of its size, its rim (the edge you see). */
const RIM = 24;
const INNER = 8;
const _n = new THREE.Vector3();
const _u = new THREE.Vector3();
const _r = new THREE.Vector3();
function eachPoint(c: V3, s: Pick<Spot, 'w' | 'h'>, fn: (x: number, y: number, z: number) => boolean): boolean {
  if (!fn(c.x, c.y, c.z)) return false;
  for (let ring = 0; ring < 2; ring++) {
    const k = ring === 0 ? 0.98 : 0.55;
    const m = ring === 0 ? RIM : INNER;
    for (let i = 0; i < m; i++) {
      const a = ((i + (ring ? 0.5 : 0)) / m) * Math.PI * 2;
      const ax = (Math.cos(a) * s.w * k) / 2, ay = (Math.sin(a) * s.h * k) / 2;
      if (!fn(c.x + _r.x * ax + _u.x * ay, c.y + _r.y * ax + _u.y * ay, c.z + _r.z * ax + _u.z * ay)) return false;
    }
  }
  return true;
}

/**
 * A portal on a surface (centre `c`, axes set): every point of its face has the surface right behind it (within a
 * couple of cm: one plane, whatever boxes make it), none of it sealed, and nothing stands out of the surface within
 * AIMP.fit.clear m in front of it. 'ok', 'sealed' (part of it on a sealed panel), else 'bad'.
 */
function onSurface(list: readonly Collider[], c: V3, s: Pick<Spot, 'w' | 'h'>): 'ok' | 'sealed' | 'bad' {
  const off = AIMP.off, clear = AIMP.fit.clear;
  let sealed = false;
  const ok = eachPoint(c, s, (x, y, z) => {
    // (the surface under the point: solid just behind it, free just in front of it and further out)
    const k = off + 0.03;
    const back = boxAt(list, x - _n.x * k, y - _n.y * k, z - _n.z * k);
    if (!back) return false;
    if (back.noPortal) {
      sealed = true;
      return false;
    }
    const f = off - 0.02;
    if (boxAt(list, x - _n.x * f, y - _n.y * f, z - _n.z * f)) return false;
    return !boxAt(list, x + _n.x * clear, y + _n.y * clear, z + _n.z * clear);
  });
  return ok ? 'ok' : sealed ? 'sealed' : 'bad';
}

/** A portal standing free (centre `c`, axes set): nothing of the world in its face, nor a hair either side of it. */
function inTheClear(list: readonly Collider[], c: V3, s: Pick<Spot, 'w' | 'h'>): boolean {
  return eachPoint(c, s, (x, y, z) => !boxAt(list, x, y, z) && !boxAt(list, x + _n.x * 0.04, y + _n.y * 0.04, z + _n.z * 0.04) && !boxAt(list, x - _n.x * 0.04, y - _n.y * 0.04, z - _n.z * 0.04));
}

/** Room to come out of an upright one: a body's column `out` m in front of its foot, a floor under it about level. */
function roomOut(world: FitWorld, list: readonly Collider[], foot: V3, n: V3, out = 0.45): boolean {
  const x = foot.x + n.x * out, z = foot.z + n.z * out;
  for (const y of [foot.y + 0.3, foot.y + 1.0, foot.y + 1.6]) {
    for (const [dx, dz] of [[0, 0], [0.22, 0], [-0.22, 0], [0, 0.22], [0, -0.22]]) if (boxAt(list, x + dx, y, z + dz)) return false;
  }
  const g = world.raycast(_q.set(x, foot.y + 0.5, z), _b.set(0, -1, 0), 0.9);
  return !!g && g.point.y > foot.y - 0.4;
}

/**
 * Slide a spot along its face (across, and up for those that may) the least that `test` takes, at most
 * AIMP.fit.slide m, keeping `anchor` (the crosshair's point, or null) AIMP.fit.keep m inside it. Moves `s.pos`;
 * false when nothing within reach passes.
 */
function slide(s: Spot, anchor: V3 | null, up: boolean, test: (c: V3) => boolean, max: number = AIMP.fit.slide): boolean {
  const F = AIMP.fit;
  axes(s, _n, _u, _r);
  const base = _c.copy(s.pos);
  const steps = Math.round(max / F.step);
  const cands: [number, number][] = [];
  for (let i = -steps; i <= steps; i++) for (let j = up ? -steps : 0; j <= (up ? steps : 0); j++) cands.push([i * F.step, j * F.step]);
  cands.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]));
  const rx = Math.max(0.05, s.w / 2 - F.keep), ry = Math.max(0.05, s.h / 2 - F.keep);
  const at = new THREE.Vector3();
  for (const [da, du] of cands) {
    at.copy(base).addScaledVector(_r, da).addScaledVector(_u, du);
    if (anchor) {
      _q.subVectors(anchor, at);
      const ax = _q.dot(_r) / rx, ay = _q.dot(_u) / ry;
      if (ax * ax + ay * ay > 1) continue;
    }
    if (test(at)) {
      s.pos.copy(at);
      return true;
    }
  }
  s.pos.copy(base);
  return false;
}

const _list: Collider[] = [];
const _list2: Collider[] = [];

/** Fit a surface spot (wall, floor, ceiling) onto its surface: 'ok' (moved there), 'sealed' or 'bad'. */
function fitOnSurface(world: FitWorld, s: Spot, anchor: V3 | null, up: boolean, max: number = AIMP.fit.slide): 'ok' | 'sealed' | 'bad' {
  const list = boxesAround(world, s.pos, Math.max(s.w, s.h) / 2 + max + 0.5, Math.max(s.w, s.h) / 2 + max + 0.5, _list);
  axes(s, _n, _u, _r);
  if (onSurface(list, s.pos, s) === 'sealed') return 'sealed';
  return slide(s, anchor, up, (c) => onSurface(list, c, s) === 'ok', max) ? 'ok' : 'bad';
}

/** Fit an upright free-standing spot (stand, air): nothing in its face, room to come out of it; slid at most `max` m. */
function fitStanding(world: FitWorld, s: Spot, anchor: V3 | null, max: number = AIMP.fit.slide, out = true): boolean {
  const list = boxesAround(world, s.pos, s.w / 2 + max + 1.0, s.h / 2 + 1.0, _list2);
  return slide(s, anchor, Math.abs(s.normal.y) > 0.9, (c) => {
    axes(s, _n, _u, _r);
    if (!inTheClear(list, c, s)) return false;
    return !out || roomOut(world, list, _a.set(c.x, c.y - s.h / 2, c.z), s.normal);
  }, max);
}

/** An upright spot standing free has nothing of the world in its face (the near twin as it slides with you). */
export function spotClear(world: FitWorld, s: Spot): boolean {
  const list = boxesAround(world, s.pos, Math.max(s.w, s.h) / 2 + 0.5, Math.max(s.w, s.h) / 2 + 0.5, _list);
  axes(s, _n, _u, _r);
  return inTheClear(list, s.pos, s);
}

/** The floor in front of a wall point (`n` its normal), at most `below` m under it: its top, else null. */
function floorBy(groundAt: (x: number, z: number, y: number) => number, p: V3, n: V3, below: number): number | null {
  const g = groundAt(p.x + n.x * 0.4, p.z + n.z * 0.4, p.y + 0.05);
  return g > -Infinity && p.y - g <= below ? g : null;
}

/**
 * The exit where the crosshair ray (origin = the camera, unit dir; `eye`: your eyes) meets the world, FITTED:
 * - a WALL: standing on the floor in front of it when the crosshair is lower than its height (less AIMP.fit.keep),
 *   else centred on the crosshair; slid along the wall (at most AIMP.fit.slide) to lie wholly on it, clear of
 *   corners, jambs and openings. A face too small for it (a low wall, a sill, a jamb, a pillar): upright on the
 *   floor right in front of it (STAND).
 * - the FLOOR / a CEILING: a disc, slid to lie wholly on it, clear of the walls; on a stair or a narrow top
 *   (no room for the disc): upright on that spot facing you (STAND), with room to come out of it.
 * - nothing within AIMP.range (or the wheel's distance first): mid-air (AIR), upright, facing you, never in the
 *   floor; with the world in its face it comes nearer.
 * A sealed panel refuses it ('sealed'), a surface nearer than AIMP.minDist too ('close'). Where nothing of that
 * fits, the rays round the crosshair (AIMP.fit.cone°) are tried, the nearest that fits wins (of one ring, the
 * further: through a window rather than its sill); none: refused ('fit').
 */
export function placeExit(world: FitWorld, origin: V3, dir: V3, eye: V3, air: number | null, groundAt: (x: number, z: number, y: number) => number): Spot {
  const s = exitAlong(world, origin, dir, eye, air, groundAt);
  if (s.ok || s.reason !== 'fit') return s;
  // nothing fits where the crosshair is: the nearest ray round it that does
  const F = AIMP.fit;
  const d = new THREE.Vector3().copy(dir as THREE.Vector3).normalize();
  const side = new THREE.Vector3().crossVectors(d, UP);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize();
  const upv = new THREE.Vector3().crossVectors(side, d).normalize();
  const dd = d.clone();
  const r = new THREE.Vector3();
  for (let ring = 1; ring <= F.rings; ring++) {
    const ang = THREE.MathUtils.degToRad((F.cone * ring) / F.rings);
    let best: Spot | null = null;
    for (let k = 0; k < 8; k++) {
      const phi = (k / 8) * Math.PI * 2;
      r.copy(dd).multiplyScalar(Math.cos(ang)).addScaledVector(side, Math.cos(phi) * Math.sin(ang)).addScaledVector(upv, Math.sin(phi) * Math.sin(ang));
      const o = exitAlong(world, origin, r, eye, air, groundAt);
      if (o.ok && (!best || o.dist > best.dist)) best = o;
    }
    if (best) return best;
  }
  return s;
}

/** One ray's exit (no search round it). */
function exitAlong(world: FitWorld, origin: V3, dir: V3, eye: V3, air: number | null, groundAt: (x: number, z: number, y: number) => number): Spot {
  const F = AIMP.fit;
  const s = newSpot();
  // (the ray starts at the camera: its distances run that much past your eyes)
  const lead = Math.max(0, _a.subVectors(eye, origin).dot(dir));
  const hit = world.raycast(origin as THREE.Vector3, dir as THREE.Vector3, lead + AIMP.range);
  const airT = air !== null ? lead + THREE.MathUtils.clamp(air, AIMP.air.min, AIMP.air.max) : null;
  if (!hit || (airT !== null && hit.distance > airT)) {
    // mid-air: upright, facing you, its bottom never in the floor; with the world in its face it comes nearer
    s.surface = 'air';
    for (let t = airT ?? lead + AIMP.air.def; t - lead >= AIMP.minDist; t -= 0.3) {
      s.pos.copy(origin).addScaledVector(dir, t);
      s.dist = t - lead;
      flat(_a.subVectors(eye, s.pos), s.normal);
      standOnFloor(s, groundAt);
      if (fitStanding(world, s, null, 0, false)) return s;
    }
    return refuse(s, 'fit');
  }
  s.dist = Math.max(0, hit.distance - lead);
  const anchor = hit.point.clone();
  const n = hit.normal;
  if ((hit.collider as Collider).noPortal) {
    s.pos.copy(hit.point).addScaledVector(n, AIMP.off);
    s.normal.copy(n);
    s.surface = n.y > 0.6 ? 'floor' : n.y < -0.6 ? 'ceiling' : 'wall';
    return refuse(s, 'sealed');
  }
  if (s.dist < AIMP.minDist) {
    s.pos.copy(hit.point).addScaledVector(n, AIMP.off);
    s.normal.copy(n);
    return refuse(s, 'close');
  }
  if (Math.abs(n.y) > 0.6) {
    // a disc on the floor / a ceiling
    s.surface = n.y > 0 ? 'floor' : 'ceiling';
    s.normal.set(0, Math.sign(n.y), 0);
    flat(dir, s.hdir);
    s.w = s.h = AIMP.flat;
    s.pos.copy(hit.point).addScaledVector(s.normal, AIMP.off);
    const f = fitOnSurface(world, s, anchor, true);
    if (f === 'ok') return s;
    if (f === 'sealed') return refuse(s, 'sealed');
    if (n.y < 0) return refuse(s, 'fit');
    // a stair, a narrow top: upright on that spot, facing you
    s.surface = 'stand';
    s.w = AIMP.w;
    s.h = AIMP.h;
    flat(_a.subVectors(eye, hit.point), s.normal);
    s.pos.set(hit.point.x, hit.point.y + AIMP.h / 2 + 0.02, hit.point.z);
    return fitStanding(world, s, anchor) ? s : refuse(s, 'fit');
  }
  // a wall: a door in it, standing on the floor in front of it (the crosshair low enough), else on the crosshair
  s.surface = 'wall';
  flat(n, s.normal);
  s.pos.copy(hit.point).addScaledVector(s.normal, AIMP.off);
  const g = floorBy(groundAt, hit.point, s.normal, AIMP.h - F.keep);
  const sits = g !== null;
  if (sits) s.pos.y = g + AIMP.h / 2 + 0.02;
  const f = fitOnSurface(world, s, anchor, !sits);
  if (f === 'ok') return s;
  if (f === 'sealed') return refuse(s, 'sealed');
  // the face can't hold it (a low wall, a sill, a jamb, a pillar): upright on the floor right in front of it
  const gs = floorBy(groundAt, hit.point, s.normal, F.stand);
  if (gs === null) return refuse(s, 'fit');
  s.surface = 'stand';
  s.pos.copy(hit.point).addScaledVector(s.normal, AIMP.off + F.standOff);
  s.pos.y = gs + AIMP.h / 2 + 0.02;
  return fitStanding(world, s, anchor) ? s : refuse(s, 'fit');
}

/** A tall one never sinks into the floor: its bottom is on it at the lowest. */
function standOnFloor(s: Spot, groundAt: (x: number, z: number, y: number) => number) {
  const g = groundAt(s.pos.x, s.pos.z, s.pos.y + s.h / 2);
  if (g > -Infinity && s.pos.y - s.h / 2 < g + 0.02) s.pos.y = g + s.h / 2 + 0.02;
}

/**
 * Where a chain hop puts you (a copy of `node`'s exit): out of its front at `speed` m/s (flat), your feet on its
 * bottom (a wall one: `clear` m out of it; a floor one: on it; a ceiling one: below it, falling). Null when the
 * spot is not free for a body (a wall right there, a prop): the chain stops where you are.
 */
export function chainArrival(
  world: Pick<CollisionWorld, 'overlapsCylinder'>,
  node: Pick<Spot, 'pos' | 'normal' | 'hdir' | 'h'>,
  speed: number,
  _vy: number,
  radius = 0.34,
  height = 1.8,
): { pos: THREE.Vector3; yaw: number; vel: THREE.Vector3 } | null {
  const n = node.normal;
  const free = (x: number, y: number, z: number) => !world.overlapsCylinder(x, z, radius, y + 0.05, y + height - 0.05);
  if (Math.abs(n.y) < 0.5) {
    const len = Math.hypot(n.x, n.z) || 1;
    const nx = n.x / len, nz = n.z / len;
    const y = node.pos.y - node.h / 2;
    for (const c of CHAIN.clear) {
      const x = node.pos.x + nx * c, z = node.pos.z + nz * c;
      if (!free(x, y, z)) continue;
      return { pos: new THREE.Vector3(x, y, z), yaw: Math.atan2(nx, nz), vel: new THREE.Vector3(nx * speed, Math.min(_vy, 1), nz * speed) };
    }
    return null;
  }
  const hx = node.hdir.x, hz = node.hdir.z;
  const hl = Math.hypot(hx, hz) || 1;
  const dx = hx / hl, dz = hz / hl;
  if (n.y > 0) {
    if (!free(node.pos.x, node.pos.y + 0.02, node.pos.z)) return null;
    return { pos: new THREE.Vector3(node.pos.x, node.pos.y + 0.02, node.pos.z), yaw: Math.atan2(dx, dz), vel: new THREE.Vector3(dx * speed, 0, dz * speed) };
  }
  // out of a ceiling disc: standing under it, falling
  const y = node.pos.y - height - 0.05;
  if (!free(node.pos.x, y, node.pos.z)) return null;
  return { pos: new THREE.Vector3(node.pos.x, y, node.pos.z), yaw: Math.atan2(dx, dz), vel: new THREE.Vector3(dx * speed, -AIMP.go.arrive, dz * speed) };
}

/** A spot's frame for the rift system (kind: what it is on). */
export function spotFrame(s: Pick<Spot, 'pos' | 'normal' | 'hdir' | 'surface' | 'w' | 'h'>, kind?: 'stand' | 'air' | 'wall' | 'floor' | 'ceiling') {
  const horizontal = Math.abs(s.normal.y) > 0.9;
  const q = orientFrame(new THREE.Vector3().copy(s.normal), horizontal ? new THREE.Vector3().copy(s.hdir) : UP);
  const k = kind ?? s.surface;
  return { position: new THREE.Vector3().copy(s.pos), quaternion: q, width: s.w, height: s.h, kind: k } satisfies RiftFrame & { kind: string };
}

/**
 * The near twin: right in front of you on the crosshair. Its plane stands AIMP.near.ahead m in front of your
 * chest along your aim (flat; a little further when you run at it), facing you; across, it is centred on the
 * point where the crosshair ray meets that plane, as far as your own body line stays AIMP.near.body m inside it
 * (the camera sits over your shoulder: the two are a hand apart); up, its bottom is on your floor unless the
 * crosshair needs it raised (AIMP.near.float m at most, then as far as the crosshair stays AIMP.near.margin m
 * inside). Whatever stands in its way, knee to head across its width (a wall, a jamb, a window's wall and sill,
 * a low wall under your line), it stands AIMP.near.gap m in front of, never nearer than AIMP.near.min m (your
 * own body); its face never in the world (slid across within what keeps the crosshair and your body line in
 * it, else nearer). So the crosshair is always in it, one step (or GO) takes you in, and it never opens inside a
 * wall.
 */
export function nearSpot(world: FitWorld, chest: V3, ray: { origin: V3; dir: V3 }, speedAlong: number, groundAt: (x: number, z: number, y: number) => number): Spot {
  const N = AIMP.near;
  const aim = flat(ray.dir, new THREE.Vector3());
  const rx = -aim.z, rz = aim.x;
  const hw = AIMP.w / 2;
  const want: number = N.ahead + THREE.MathUtils.clamp(speedAlong * N.lead, 0, N.max - N.ahead);
  // your floor
  const g0 = groundAt(chest.x, chest.z, chest.y);
  const floor = g0 > -Infinity && Math.abs(g0 - (chest.y - 1.1)) < 1.3 ? g0 : chest.y - 1.1;
  /** The spot at `ahead` m: centred on the crosshair as far as it may be, `shift` m across from there (within its range), raised `rise` m (at most as far as the crosshair stays in it). */
  const build = (ahead: number, shift: number, s: Spot, rise = 0): { lo: number; hi: number; up: number } => {
    const d = ray.dir;
    const den = d.x * aim.x + d.z * aim.z;
    const cx = _c.set(chest.x + aim.x * ahead, chest.y, chest.z + aim.z * ahead);
    if (den > 0.15) {
      const k = (ahead - ((ray.origin.x - chest.x) * aim.x + (ray.origin.z - chest.z) * aim.z)) / den;
      cx.set(ray.origin.x + d.x * k, ray.origin.y + d.y * k, ray.origin.z + d.z * k);
    }
    // across: on the crosshair, your body line kept inside
    const across = (cx.x - chest.x) * rx + (cx.z - chest.z) * rz;
    let lo = Math.max(across - (hw - N.margin), -(hw - N.body));
    let hi = Math.min(across + (hw - N.margin), hw - N.body);
    if (lo > hi) lo = hi = THREE.MathUtils.clamp(across, -(hw - N.body), hw - N.body);
    const c = THREE.MathUtils.clamp(THREE.MathUtils.clamp(across, lo, hi) + shift, lo, hi);
    s.pos.set(chest.x + aim.x * ahead + rx * c, 0, chest.z + aim.z * ahead + rz * c);
    // up: on your floor, raised only as far as the crosshair needs
    const base = floor + s.h / 2 + 0.02;
    let y = THREE.MathUtils.clamp(cx.y, base, base + N.float);
    if (cx.y > y + s.h / 2 - N.margin) y = cx.y - (s.h / 2 - N.margin);
    if (cx.y < y - s.h / 2 + N.margin) y = Math.max(base, cx.y + s.h / 2 - N.margin);
    const up = Math.max(0, cx.y + s.h / 2 - N.margin - y);
    s.pos.y = y + Math.min(rise, up);
    s.dist = ahead;
    return { lo: lo - c, hi: hi - c, up };
  };
  const s = newSpot();
  s.w = AIMP.w;
  s.h = AIMP.h;
  s.surface = 'stand';
  s.normal.set(-aim.x, 0, -aim.z);
  s.hdir.copy(aim);
  build(want, 0, s);
  // what stands in its way: flat along your aim, from your own plane, knee to head, across its width
  const c0 = (s.pos.x - chest.x) * rx + (s.pos.z - chest.z) * rz;
  let free = want;
  const o = _a;
  for (const k of [-1, -0.5, 0, 0.5, 1]) {
    for (const hy of [0.25, 0.75, 1.3, 1.9]) {
      const ac = c0 + k * (hw - 0.05);
      o.set(chest.x + rx * ac, floor + hy, chest.z + rz * ac);
      const hit = world.raycast(o, _b.set(aim.x, 0, aim.z), want + 0.3);
      if (hit && hit.distance - N.gap < free) free = hit.distance - N.gap;
    }
  }
  // its face clear of the world: slid across (within its range), else nearer
  const list = boxesAround(world, _q.set(chest.x + aim.x * want, floor + 1.1, chest.z + aim.z * want), want + hw + 1.2, 2.6, _list2);
  axes(s, _n, _u, _r);
  const shifts: number[] = [0];
  for (let d = 0.1; d <= 0.9; d += 0.1) shifts.push(d, -d);
  for (let ahead = Math.max(N.min, free); ahead >= N.min - 1e-6; ahead -= 0.1) {
    const r = build(ahead, 0, s);
    // (on your floor first; then raised as far as the crosshair allows: over a low wall right in front of you)
    for (let rise = 0; rise <= Math.min(r.up, N.rise) + 1e-6; rise += 0.1) {
      for (const sh of shifts) {
        if (sh < r.lo - 1e-6 || sh > r.hi + 1e-6) continue;
        build(ahead, sh, s, rise);
        if (inTheClear(list, s.pos, s)) return s;
      }
    }
  }
  // (nothing clear: hard by your chest on the crosshair; it takes you in all the same)
  build(N.min, 0, s);
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
 * along `view`, in the open: AIMP.magnet.dist m from him, standing on his floor
 * (`floorY`), its front toward him (a stab or a round through it comes at him
 * from there). ABOVE: a disc over his head looking down; BELOW: a disc in the
 * floor under his feet looking up (he drops through it).
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
  s.surface = 'stand';
  s.pos.set(e.pos.x + dir.x * d, floorY + AIMP.h / 2 + 0.02, e.pos.z + dir.z * d);
  s.normal.set(-dir.x, 0, -dir.z);
  return s;
}

/** Nothing between two points (a sight line: what you see through doesn't count). */
function clearLine(world: Pick<CollisionWorld, 'raycast'>, a: V3, b: V3): boolean {
  const d = _q.subVectors(b, a);
  const len = d.length();
  if (len < 1e-4) return true;
  d.multiplyScalar(1 / len);
  return !world.raycast(a as THREE.Vector3, d, len - 0.05, { sight: true });
}

/** An exit by him sees him: from a little in front of its middle (at most his chest high) to his chest, and his knees. */
function seesHim(world: FitWorld, s: Spot, e: Body): boolean {
  const chest = _c.set(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z);
  const from = new THREE.Vector3().copy(s.pos).addScaledVector(s.normal, 0.15);
  if (Math.abs(s.normal.y) < 0.5) from.y = Math.min(from.y, chest.y);
  if (!clearLine(world, from, chest)) return false;
  if (Math.abs(s.normal.y) > 0.5) return true;
  from.y = e.pos.y + 0.45;
  return clearLine(world, from, _c.set(e.pos.x, e.pos.y + 0.45, e.pos.z));
}

/** A vertical side's exit along `dir` (flat unit, from him): against a wall that is in the way, else free; refused when there is no room. */
function sideSpot(world: FitWorld, e: Body, dir: THREE.Vector3, floorY: number): Spot {
  const M = AIMP.magnet, F = AIMP.fit;
  const s = newSpot();
  // the way out from him, at his knees, chest and head
  let hit: RayHit | null = null;
  for (const hy of [0.35, e.height * 0.6, e.height - 0.15]) {
    const h = world.raycast(_a.set(e.pos.x, e.pos.y + hy, e.pos.z), dir, M.dist + 0.4);
    if (h && (!hit || h.distance < hit.distance)) hit = h;
  }
  if (hit) {
    // (room for a body between him and the wall: square to the wall, not along a slanting way)
    flat(hit.normal, s.normal);
    const room = hit.distance * Math.abs(dir.x * s.normal.x + dir.z * s.normal.z);
    if (room < M.tight) return refuse(s, 'close');
    // against the wall, on his side of it: a door in it on his floor, fitted along it
    s.surface = 'wall';
    s.pos.set(hit.point.x + s.normal.x * AIMP.off, floorY + AIMP.h / 2 + 0.02, hit.point.z + s.normal.z * AIMP.off);
    const f = fitOnSurface(world, s, null, false, M.slide);
    if (f === 'sealed') return refuse(s, 'sealed');
    if (f === 'ok' && seesHim(world, s, e)) return s;
    // its face too small (a low wall, a window): upright right in front of it
    if (room - F.standOff < M.tight) return refuse(s, 'close');
    s.surface = 'stand';
    s.pos.set(hit.point.x + s.normal.x * (AIMP.off + F.standOff), floorY + AIMP.h / 2 + 0.02, hit.point.z + s.normal.z * (AIMP.off + F.standOff));
    if (fitStanding(world, s, null, M.slide) && seesHim(world, s, e)) return s;
    return refuse(s, 'fit');
  }
  // in the open, AIMP.magnet.dist off, facing him
  s.surface = 'stand';
  s.normal.set(-dir.x, 0, -dir.z);
  s.pos.set(e.pos.x + dir.x * M.dist, floorY + AIMP.h / 2 + 0.02, e.pos.z + dir.z * M.dist);
  if (fitStanding(world, s, null, M.slide) && seesHim(world, s, e)) return s;
  return refuse(s, 'fit');
}

/**
 * A side spot that fits the world: next to him, on his side of any wall, in sight of him, clear of everything.
 * The side's way out from him, turned at most AIMP.magnet.turn (the nearest turn that works): a wall on that way
 * (his back to it) brings the exit in against the wall (a door in it on his floor, slid along it off corners and
 * openings; a face too small for it: upright right in front of it); else it stands free AIMP.magnet.dist m off,
 * its face clear, room to come out of it and a floor there, a line from it to him. ABOVE: a disc over his head
 * (a low ceiling: against it), BELOW: one in the floor under him, both slid off a wall too near. None: refused
 * ('sealed': a sealed wall in the way; 'close': no room).
 */
export function fitSnap(world: FitWorld, e: Body, side: Side, floorY: number = e.pos.y, view?: V3): Spot {
  const M = AIMP.magnet;
  const s = snapSpot(e, side, floorY, M.dist, view);
  if (side === 'above') {
    // (a low ceiling over him: it opens against it)
    const hit = world.raycast(_a.set(e.pos.x, e.pos.y + e.height * 0.5, e.pos.z), UP, e.height * 0.5 + AIMP.snap.over + AIMP.flat / 2);
    if (hit) {
      s.pos.y = hit.point.y - AIMP.off;
      if (hit.distance < e.height * 0.5 + 0.25) return refuse(s, 'close');
      if ((hit.collider as Collider).noPortal) return refuse(s, 'sealed');
      const f = fitOnSurface(world, s, e.pos, true, M.slide);
      return f === 'ok' ? s : refuse(s, f === 'sealed' ? 'sealed' : 'close');
    }
    if (!fitStanding(world, s, _b.set(e.pos.x, s.pos.y, e.pos.z), M.slide, false) || !seesHim(world, s, e)) return refuse(s, 'close');
    return s;
  }
  if (side === 'below') {
    const f = fitOnSurface(world, s, _b.set(e.pos.x, floorY, e.pos.z), true, M.slide);
    return f === 'ok' ? s : refuse(s, f === 'sealed' ? 'sealed' : 'close');
  }
  const base = sideDir(e, side, view ?? facing(e.yaw).negate(), new THREE.Vector3());
  let first: Spot | null = null;
  const dir = new THREE.Vector3();
  for (const deg of M.turn) {
    dir.copy(base).applyAxisAngle(UP, THREE.MathUtils.degToRad(deg));
    const o = sideSpot(world, e, dir, floorY);
    if (o.ok) return o;
    first ??= o;
  }
  return first!;
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
 * (`blocked(from, to)`: a wall between, tried at his chest and his head: a man
 * you can't see is never grabbed; seen through a window, he is), whose body
 * (his radius plus AIMP.magnet.pad, his height plus AIMP.magnet.padY) the ray
 * passes within the leeway (`pad` rad of the distance: a man far off gets as
 * much help as a near one, by angle), the one nearest the crosshair by angle;
 * `prev` (the one it is on now) keeps it until another is clearly nearer
 * (AIMP.magnet.stick). Null: none within it.
 */
export function magnetTarget<T extends Target>(
  origin: V3,
  dir: V3,
  list: readonly T[],
  pad: number,
  blocked: (from: V3, to: V3) => boolean,
  range: number = AIMP.magnet.range,
  prev: T | null = null,
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
    const across = Math.hypot(px, pz);
    const off = Math.hypot(Math.max(0, across - (e.radius + M.pad)), dy);
    const leeway = tp * dist + 0.05;
    if (off > leeway) continue;
    // how far the crosshair is from him, by angle (to his body's axis, feet to head): the nearest wins; the one it
    // is on now counts `stick` less (two men side by side: no flicker)
    const dyCore = py < e.pos.y ? e.pos.y - py : py > e.pos.y + e.height ? py - e.pos.y - e.height : 0;
    let score = Math.atan2(Math.hypot(across, dyCore), Math.max(t, 0.5)) + dist * 1e-4;
    if (e === prev) score *= M.stick;
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
