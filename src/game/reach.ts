import * as THREE from 'three';
import type { V3 } from '../core/contracts';
import type { CollisionWorld } from '../world/collision';
import type { Owner, Weapon } from './weapons';
import { orientFrame } from './portalMath';

export { reachOn } from './variant';

/**
 * REACH (the COMBAT LAB's core mechanic; DESIGN §14). Every number lives here.
 *
 * ONE RULE: you open a window; what you do in front of you happens at the window.
 *
 * - WINDOW (held): a ghost window stands where you aim (on a wall, on the
 *   floor, in mid-air; the wheel sets how far). Let go: it opens there, and
 *   its twin opens right in front of you, showing the far side. One pair at a
 *   time, a few seconds each.
 * - HAND: your hand comes out of the far window and takes what's right by it:
 *   a weapon (off the floor or out of a man's hands), the man himself (pulled
 *   through to land in front of you, reeling), or a red portal of theirs
 *   (hold, aim, let go: its exit goes where you aimed). Nothing there: a whiff.
 * - WEAPON: a knife stabs whatever is right by the far window (from behind or
 *   the side it kills; from the front he parries); a rifle fired through the
 *   near window fires out of the far one. Up close both work as ever.
 * - BODY: walk into the near window, come out of the far one.
 * - THEY SEE IT: a window opening in front of a man (in his eyes, close) is
 *   noticed in a beat; he turns to it, slaps a hand away, holds on to his gun,
 *   and a rifleman shoots into it (out of your near window, at you).
 */
export const REACH = {
  /** How far a window opens (m, from your eyes). */
  range: 30,
  window: {
    /** Nearer than this it doesn't open (m, from your eyes). */
    min: 3,
    /** Off a wall it stands this far in front of it (m). */
    off: 0.6,
    /** Aimed at a man: it stands this far past him along your aim (m). */
    past: 0.9,
    /** Mid-air distance per wheel step (m). */
    step: 1.5,
    width: 1.15,
    height: 2.15,
    /** Opens in (s), stays open (s), the next one no sooner than (s) after. */
    open: 0.2,
    life: 4,
    cooldown: 0.35,
    /** The near window: this far ahead of you (m). */
    ahead: 1.4,
    /** The hand reaches this far from the window's plane (either side, m), the knife this far, this far across and up/down from its centre. */
    reach: 1.6,
    knife: 1.3,
    across: 1.0,
    up: 1.45,
    /** Touch only: the ghost leans onto the spot behind the man nearest the crosshair (this close to it, rad; this far behind him, m; the ghost this near that spot, m). */
    magnet: 0.075,
    behind: 1.0,
    snap: 2.6,
  },
  hand: {
    /** Out of the far window to what it takes (s), back in (s). */
    out: 0.15,
    back: 0.16,
    /** Nothing there (or slapped away): this long before the next (s). */
    whiff: 0.4,
    /** From one press to the next (s). */
    cooldown: 0.25,
    /** A weapon flies through to your hand this long (s). */
    fly: 0.14,
    hitstop: 0.05,
    /** Walking over a weapon with empty hands takes it (m). */
    touch: 1.05,
  },
  /** A man the hand pulls through. */
  pull: {
    /** To the far window (s), then out of the near one to where he lands (s). */
    through: 0.18,
    out: 0.16,
    /** Where he lands: this far in front of you, on your aim (m). */
    land: 2.0,
    arc: 0.5,
    /** Reeling on landing (s): your moment. */
    stun: 1.2,
    hitstop: 0.07,
  },
  /**
   * A window in front of a man: within `range` (m) and this cone (cos of the
   * half-angle), seen for `time` (s), and he knows it's there (he turns to it
   * for `react` s). Right behind him (within `hearRange` m) he hears it after
   * `hear` s: be quick.
   */
  notice: { range: 8, cos: 0.5, time: 0.35, react: 1.6, hear: 1.1, hearRange: 2.2 },
  rifle: {
    /** One magazine; empty, it's dropped for good (take another weapon). */
    mag: 12,
    damage: 22,
    /** Held: one round every (s). */
    interval: 0.14,
    range: 90,
    /** Rounds on a reeling man do this much more. */
    stunnedMul: 2,
  },
  knife: {
    /** A stab up close reaches this far (m from your feet to his): it kills. */
    melee: 2.3,
    cooldown: 0.42,
    /** Through the window (s between, the stab's hand time). */
    windowCooldown: 0.45,
    stab: 0.12,
    hitstop: 0.08,
    /** A melee stab steps you in this fast (m/s) for this long (s). */
    lunge: 6,
    lungeTime: 0.12,
  },
  /** Their portal, moved by you: what its exit does to him. */
  redirect: {
    /** Coming out this high over the floor (m): dead on landing, or reeling this long. */
    kill: 6,
    stagger: 3,
    staggerTime: 2.4,
    fallDamage: 25,
    /** Out facing a wall this close (m): slammed into it. */
    slam: 1.4,
    slamDamage: 30,
    slamStun: 1.6,
    /** His own side's fire hits him this long after (s). */
    allyFire: 3,
  },
  enemy: {
    hp: 60,
    /** First move after GO (and after losing a weapon): a human beat to react (s). */
    react: [0.35, 0.9] as const,
    regrab: [0.25, 0.55] as const,
    /** Running speeds (m/s): to a weapon, with a knife at you. */
    run: 5,
    knifeRun: 5.6,
    /** A rifle keeps this far from you (m). */
    keep: [9, 18] as const,
    /** Empty-handed: picks a weapon up by walking over it (m); his window for one opens only this near it (m). */
    touch: 1.1,
    windowRange: 14,
    /** His red hand window: this long open before the hand comes out (s), the hand out (s). */
    windowTele: 0.45,
    windowOut: 0.25,
    rifle: {
      /** The red laser before a burst (s), its rounds, their gap (s), the rest after (s). */
      aim: 0.55,
      shots: 3,
      gap: 0.13,
      rest: [1.0, 1.7] as const,
      /** At most this many guns on you at once. */
      maxShooters: 2,
      spread: 0.012,
    },
    knife: {
      /** Starts the blow this close (m); it lands within hitRange in front of him (±60°). */
      reach: 2.1,
      hitRange: 2.6,
      windup: 0.45,
      damage: 25,
      push: 6,
      cooldown: 1.1,
    },
    steal: {
      /** An empty-handed man with you in sight tries to take yours (per decision). */
      chance: 0.35,
      /** Its red window by your hand, this long before his hand comes out (s). */
      telegraph: 0.5,
      /** You got away: your hand this far from where the window opened (m), or you went through a window. */
      radius: 1.6,
      cooldown: [5, 8] as const,
    },
    portal: {
      /** Red, it opens this long before anyone can use it (s)... */
      telegraph: 0.5,
      /** ...and he braces at it this long more before he steps in (s): time to get a window by it. */
      brace: 0.9,
      /** A rusher further than this from you (m) takes a portal this often (per decision)... */
      knifeFrom: 8,
      knifeChance: 0.6,
      /** ...a rifle flanks through one now and then (a flanker: more often). */
      rifleChance: 0.15,
      flankerChance: 0.45,
      cooldown: [5, 8] as const,
      /** The exit opens this far from you (m), a rifle's flank this far. */
      near: 2.6,
      flank: 9,
      /** The entrance, this far in front of him (m). */
      ahead: 1.4,
      /** Only one of theirs open at a time, at least this long apart (s). */
      gap: 3,
      /** Its size (m). */
      width: 1.2,
      height: 2.3,
      /** Out of a redirected exit he tumbles out this fast (m/s), up this fast. */
      outSpeed: 5,
      outUp: 1.2,
      /** You hold it at most this long (real s), then the exit is where you aim. */
      maxHold: 3,
      /** It shuts this long after he's through (s), or this long after it opened, whatever happened. */
      after: 0.35,
      life: 6,
    },
  },
  waves: {
    /** The 3-2-1 (s): W1, then every later wave (after its CLEAR card). */
    first: 3,
    between: 2.2,
  },
};

// ---------------------------------------------------------------------------
// The window
// ---------------------------------------------------------------------------

/** Where a window stands: its centre, which way it looks out (unit, flat), what it's on. */
export interface WindowSpot {
  readonly pos: THREE.Vector3;
  readonly look: THREE.Vector3;
  surface: 'wall' | 'floor' | 'air';
  /** From your eyes (m). */
  dist: number;
  /** It can open here (not too near you). */
  ok: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** The flat (horizontal) unit direction of `d` (+Z if it has none). */
export function flat(d: V3, out = new THREE.Vector3()): THREE.Vector3 {
  out.set(d.x, 0, d.z);
  const l = out.length();
  return l < 1e-6 ? out.set(0, 0, 1) : out.multiplyScalar(1 / l);
}

/**
 * Where the WINDOW key's ghost stands for the aim ray (origin, unit dir) seen
 * from `eye`: on the first surface the ray meets within REACH.range (a wall:
 * REACH.window.off in front of it; the floor: standing on it; a ceiling: under
 * it), else in mid-air at the range. `air` (m from your eyes: the wheel's
 * distance, or just past the man you aim at): never further than that, in
 * mid-air short of a surface. Every window faces you (it looks back along
 * your aim: through its twin you see what's in front of it, its far side
 * toward you — a man's back, if it's behind him). `groundAt(x, z, y)`: the
 * floor's top under a point (-Infinity: none), so it never sinks into it.
 */
export function placeWindow(
  world: Pick<CollisionWorld, 'raycast'>,
  origin: V3,
  dir: V3,
  eye: V3,
  air: number | null,
  groundAt: (x: number, z: number, y: number) => number,
): WindowSpot {
  const W = REACH.window;
  const H2 = W.height / 2;
  // (the ray starts at the camera: its distances run that much past your eyes)
  const lead = Math.max(0, _a.subVectors(eye, origin).dot(dir));
  const maxT = lead + (air !== null ? Math.min(air, REACH.range) : REACH.range);
  const hit = world.raycast(origin as THREE.Vector3, dir as THREE.Vector3, maxT);
  const pos = new THREE.Vector3();
  let surface: WindowSpot['surface'] = 'air';
  if (hit) {
    const n = hit.normal;
    if (n.y > 0.6) {
      // the floor: it stands on the spot
      surface = 'floor';
      pos.set(hit.point.x, hit.point.y + H2 + 0.02, hit.point.z);
    } else if (n.y < -0.6) {
      pos.copy(hit.point).addScaledVector(dir, -W.off);
      pos.y -= H2;
    } else {
      // a wall: in front of it
      surface = 'wall';
      pos.copy(hit.point).addScaledVector(flat(n, _b), W.off);
    }
  } else pos.copy(origin).addScaledVector(dir, maxT);
  // never into the floor (a low one stands on it)
  if (surface !== 'floor') {
    const g = groundAt(pos.x, pos.z, pos.y + H2);
    if (g > -Infinity && pos.y - H2 < g + 0.35) {
      pos.y = g + H2 + 0.02;
      if (surface === 'air') surface = 'floor';
    }
  }
  const look = flat(_b.subVectors(eye, pos), new THREE.Vector3());
  const dist = pos.distanceTo(eye);
  return { pos, look, surface, dist, ok: dist >= W.min && dist <= REACH.range + 1.5 };
}

/** The near window for a far one opened from `feet` aiming `aimFlat`: REACH.window.ahead in front of you, facing you, standing on your floor. */
export function nearSpot(feet: V3, aimFlat: V3, ahead = REACH.window.ahead): { pos: THREE.Vector3; look: THREE.Vector3 } {
  const pos = new THREE.Vector3(feet.x + aimFlat.x * ahead, feet.y + REACH.window.height / 2 + 0.02, feet.z + aimFlat.z * ahead);
  return { pos, look: new THREE.Vector3(-aimFlat.x, 0, -aimFlat.z) };
}

/** A window's frame (for the rift system): its front looks out along `look`. */
export function windowFrame(pos: V3, look: V3, kind: 'stand' | 'air') {
  const q = orientFrame(new THREE.Vector3(look.x, look.y, look.z), UP);
  return { position: new THREE.Vector3().copy(pos), quaternion: q, width: REACH.window.width, height: REACH.window.height, kind };
}

/** Where `p` is in a window's frame: along its look (+ in front, - behind), across it (+ to its left as it looks), up from its centre. */
export function windowLocal(pos: V3, look: V3, p: V3) {
  _a.subVectors(p, pos);
  const along = _a.x * look.x + _a.z * look.z;
  const across = _a.x * look.z - _a.z * look.x;
  return { along, across, up: _a.y };
}

/** `p` is right by the window (`depth` m from its plane, either side; within its width and height and a little more). */
export function byWindow(pos: V3, look: V3, p: V3, depth: number): boolean {
  const l = windowLocal(pos, look, p);
  return Math.abs(l.along) <= depth && Math.abs(l.across) <= REACH.window.across && Math.abs(l.up) <= REACH.window.up;
}

/** The point of a man's axis (feet `feet`, `height` tall) nearest the window's centre height (what the hand would take him by). */
export function bodyPoint(feet: V3, height: number, at: V3, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(feet.x, THREE.MathUtils.clamp(at.y, feet.y + 0.3, feet.y + height - 0.15), feet.z);
}

/** Which side of a man (at `pos`, facing `yaw`) a point is on: in front of him (±60°), at his side, behind him (±60° of his back). */
export function sideOf(pos: V3, yaw: number, p: V3): 'front' | 'side' | 'back' {
  const dx = p.x - pos.x, dz = p.z - pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) return 'front';
  const c = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / d;
  return c >= 0.5 ? 'front' : c <= -0.5 ? 'back' : 'side';
}

/** A man (eyes `eye`, facing `yaw`) has a window at `p` in front of his eyes, near enough to notice. */
export function inHisEyes(eye: V3, yaw: number, p: V3): boolean {
  const N = REACH.notice;
  const dx = p.x - eye.x, dz = p.z - eye.z;
  const d = Math.hypot(dx, dz);
  if (d > N.range || Math.abs(p.y - eye.y) > 4) return false;
  if (d < 0.6) return true;
  return (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / d >= N.cos;
}

/** Where a pulled man lands: REACH.pull.land in front of `feet` along the aim (flat). */
export function pullLanding(feet: V3, aimFlat: V3, out = new THREE.Vector3(), k = REACH.pull.land): THREE.Vector3 {
  return out.set(feet.x + aimFlat.x * k, feet.y, feet.z + aimFlat.z * k);
}

/**
 * What coming out of a portal you moved does to him, by how high over the
 * floor it is (m; Infinity: no floor under it) and how near a wall it faces
 * (m; Infinity: none): the void / the water win, then a deadly fall, a slam,
 * a hard fall, or nothing much.
 */
export function redirectOutcome(base: 'floor' | 'void' | 'water', height: number, wall: number): 'floor' | 'void' | 'water' | 'high' | 'fall' | 'wall' {
  const R = REACH.redirect;
  if (base !== 'floor') return base;
  if (height >= R.kill) return 'high';
  if (wall <= R.slam) return 'wall';
  if (height >= R.stagger) return 'fall';
  return 'floor';
}

// ---------------------------------------------------------------------------
// Hands: a window and the arm out of it
// ---------------------------------------------------------------------------

/** What a hand is doing: yours (snatch, pull, stab, take their portal, nothing), or theirs (snatch off the floor, steal yours). */
export type HandKind = 'snatch' | 'pull' | 'stab' | 'grab' | 'whiff' | 'steal';

/** One window and the hand coming out of it. */
export interface HandWindow {
  id: number;
  owner: Owner;
  kind: HandKind;
  /** The window's centre. */
  readonly at: THREE.Vector3;
  /** Which way the hand comes out (unit). */
  readonly dir: THREE.Vector3;
  weapon: Weapon | null;
  /** The man it's after (pull, stab). */
  enemyId: number | null;
  /** Seconds since it opened. */
  t: number;
  /** Before the hand comes out (s): their windows are telegraphed. */
  tele: number;
  /** The hand's way out (s). */
  out: number;
  /** The grab happened (resolve was called): true = it got what it was after. */
  result: boolean | null;
  /** Yours: drawn at the far window (no window of its own). */
  far: boolean;
}

/**
 * The open hands (yours and theirs). Each lives tele + out + back seconds;
 * `resolve` runs once, when the hand gets there, and says whether it got it
 * (a weapon is whoever's hand TOUCHES it first).
 */
export class Hands {
  readonly list: HandWindow[] = [];
  private next = 1;

  open(o: { owner: Owner; kind: HandKind; at: V3; dir: V3; weapon?: Weapon | null; enemyId?: number | null; tele?: number; out?: number; far?: boolean }): HandWindow {
    const w: HandWindow = {
      id: this.next++,
      owner: o.owner,
      kind: o.kind,
      at: new THREE.Vector3().copy(o.at),
      dir: new THREE.Vector3().copy(o.dir).normalize(),
      weapon: o.weapon ?? null,
      enemyId: o.enemyId ?? null,
      t: 0,
      tele: o.tele ?? 0,
      out: o.out ?? (o.kind === 'stab' ? REACH.knife.stab : REACH.hand.out),
      result: null,
      far: !!o.far,
    };
    this.list.push(w);
    return w;
  }

  /** The hand `owner` has out (one at a time each). */
  of(owner: Owner): HandWindow | null {
    for (const w of this.list) if (w.owner === owner) return w;
    return null;
  }

  cancel(w: HandWindow) {
    const i = this.list.indexOf(w);
    if (i >= 0) this.list.splice(i, 1);
  }

  clear() {
    this.list.length = 0;
  }

  static life(w: HandWindow) {
    return w.tele + w.out + REACH.hand.back;
  }

  /** When the hand gets there (s after it opened). */
  static landAt(w: HandWindow) {
    return w.tele + w.out;
  }

  /** How far out the hand is (0 in the window .. 1 at what it's after). */
  static extent(w: HandWindow) {
    const land = Hands.landAt(w);
    if (w.t < w.tele) return 0;
    if (w.t < land) return (w.t - w.tele) / Math.max(1e-3, land - w.tele);
    return Math.max(0, 1 - (w.t - land) / REACH.hand.back);
  }

  update(dt: number, resolve: (w: HandWindow) => boolean) {
    for (let i = 0; i < this.list.length; ) {
      const w = this.list[i];
      w.t += dt;
      if (w.result === null && w.t >= Hands.landAt(w)) w.result = resolve(w);
      if (w.t >= Hands.life(w)) this.list.splice(i, 1);
      else i++;
    }
  }
}

/**
 * Where a man's red hand window opens for what's at `target` (seen from his
 * `eye`): beside it, a little above and toward him, so the arm is seen
 * reaching across to it; `dirOut`: the way the arm comes out.
 */
export function windowSpot(eye: V3, target: V3, out: THREE.Vector3, dirOut: THREE.Vector3, standOff = 0.9) {
  dirOut.set(target.x - eye.x, 0, target.z - eye.z);
  const d = dirOut.length();
  if (d < 1e-6) dirOut.set(0, 0, 1);
  else dirOut.multiplyScalar(1 / d);
  const sx = -dirOut.z, sz = dirOut.x;
  const near = Math.min(0.3, d * 0.2);
  out.set(target.x - sx * standOff - dirOut.x * near, target.y + 0.9, target.z - sz * standOff - dirOut.z * near);
  dirOut.subVectors(target, out).normalize();
  return out;
}

/** The lab's KILLS BY TOOL under REACH: a round, a knife, a portal you moved, anything else. */
export type ReachTool = 'rifle' | 'knife' | 'redirect' | 'other';

/** `yours`: what of yours hit him last, just now (null: nothing of yours). */
export function reachKillTool(cause: string, viaRedirect: boolean, yours: 'rifle' | 'knife' | null): ReachTool {
  if (viaRedirect) return 'redirect';
  if (yours) return yours;
  if (cause === 'blade') return 'knife';
  return 'other';
}

/** A threat the HUD points at when you can't see it. */
export type ThreatKind = 'gun' | 'knife' | 'thief' | 'window' | 'portal';

/**
 * Where an edge arrow for a world point goes: null if it's on screen (in
 * front of the camera, inside the safe frame), else the angle (rad, screen
 * space, 0 = right, +π/2 = up) to point it. `ndc`: the point projected
 * (x, y in -1..1; z > 1 or w < 0 behind the camera); `behind`: it's behind you.
 */
export function edgeArrow(ndcX: number, ndcY: number, behind: boolean, margin = 0.9): number | null {
  if (!behind && Math.abs(ndcX) <= margin && Math.abs(ndcY) <= margin) return null;
  let x = ndcX, y = ndcY;
  // (behind the camera the projection mirrors: point the other way, and down if it's level)
  if (behind) {
    x = -x;
    y = -y;
    if (Math.abs(x) < 0.2 && Math.abs(y) < 0.2) y = -1;
  }
  return Math.atan2(y, x);
}
