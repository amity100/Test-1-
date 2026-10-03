import * as THREE from 'three';
import type { V3 } from '../core/contracts';
import type { Owner, Weapon } from './weapons';

export { reachOn } from './variant';

/**
 * REACH (the COMBAT LAB's core mechanic; DESIGN §14). Every number lives here.
 *
 * - The REMOTE HAND: aim at anything you can see within 30 m; a small window
 *   opens next to it and your hand comes out of it. On a weapon (on the floor
 *   or in a man's hands): it's yours. On a man: he's yanked to you by the
 *   collar and lands at your feet, reeling. On an enemy portal: you hold it,
 *   aim, let go: its exit is wherever you aimed (the void, the pool, your knife).
 * - WEAPONS ON THE FLOOR: rifles (one magazine) and knives (up close, or through
 *   a window at range). Every wave starts with everyone empty-handed.
 * - ENEMIES WITH PORTALS: they race you for the weapons with red windows of
 *   their own, steal yours (a red window by your hand, 0.5 s to get away),
 *   and come at you through red portals that open 0.5 s before they step in.
 */
export const REACH = {
  /** How far the hand (and a knife's window) reaches (m, from your eyes). */
  range: 30,
  hand: {
    /** The window opens and the hand is out to what it's after (s): the grab lands then. */
    open: 0.15,
    /** The hand back in, the window shut (s). */
    back: 0.16,
    /** From one press to the next (s). */
    cooldown: 0.28,
    /** Aim magnetism (degrees off the crosshair) by device: a thumb gets the most help. */
    cone: { kbm: 2.2, pad: 4.5, touch: 8 } as Record<'kbm' | 'pad' | 'touch', number>,
    /** The window: its radius (m) and how far short of what it's after it opens (m, toward you). */
    radius: 0.42,
    standOff: 0.75,
    /** A snatched weapon flies to your hand this long (s, a whoosh). */
    fly: 0.12,
    /** Hitstop when the hand lands (s, real). */
    hitstop: 0.05,
    /** What the aim takes, in this order when it's on more than one: their portal, a weapon, a man. */
    radiusWeapon: 0.38,
    /** A weapon in a man's hands is a smaller mark (his head and his legs are still him: aim there to pull him). */
    radiusHeld: 0.28,
    radiusBody: 0.42,
    radiusPortal: 0.9,
  },
  /** A man the hand pulls to you. */
  pull: {
    /** His flight (s). */
    time: 0.3,
    /** Where he lands: this far in front of you (m). */
    ahead: 1.7,
    /** The flight's hump (m). */
    arc: 1.1,
    /** Reeling on landing (s): your moment. */
    stun: 1.5,
    hitstop: 0.07,
  },
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
    melee: 2.4,
    /**
     * Through a window it hurts this much (two for a man on his feet; a man
     * reeling from your pull dies of one) and rocks him this long (s).
     */
    windowDamage: 35,
    windowStagger: 0.6,
    /** Beyond that, within REACH.range and in sight: through a window. */
    cooldown: 0.42,
    windowCooldown: 0.75,
    /** The window stab's hand time (s). */
    stab: 0.12,
    hitstop: 0.08,
    /** A melee stab steps you in this fast (m/s) for this long (s). */
    lunge: 6,
    lungeTime: 0.12,
  },
  enemy: {
    hp: 60,
    /** First move after GO (and after losing a weapon): a human beat to react (s). */
    react: [0.4, 1.0] as const,
    /** A lost race: a shorter beat before trying the next weapon (s). */
    regrab: [0.25, 0.55] as const,
    /** Running speeds (m/s): to a weapon, with a knife at you. */
    run: 5,
    knifeRun: 5.8,
    /** A rifle keeps this far from you (m). */
    keep: [9, 18] as const,
    rifle: {
      /** The red laser before a burst (s), its rounds, their gap (s), the rest after (s). */
      aim: 0.5,
      shots: 3,
      gap: 0.13,
      rest: [0.9, 1.6] as const,
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
      chance: 0.4,
      /** Its red window by your hand, this long before his hand comes out (s). */
      telegraph: 0.5,
      /** You got away: your hand this far from where the window opened (m), or you went through a portal. */
      radius: 1.6,
      cooldown: [4, 7] as const,
    },
    portal: {
      /** Red, it opens this long before he steps in (s). */
      telegraph: 0.5,
      /** A knife further than this from you (m) takes a portal this often (per decision)... */
      knifeFrom: 8,
      knifeChance: 0.6,
      /** ...a rifle flanks through one now and then. */
      rifleChance: 0.18,
      cooldown: [5, 8] as const,
      /** The exit opens this far from you (m), a rifle's flank this far. */
      near: 2.6,
      flank: 9,
      /** The entrance, this far in front of him (m). */
      ahead: 1.4,
      /** Only one of theirs open at a time, at least this long apart (s). */
      gap: 3,
      /** Its size (m). */
      width: 1.1,
      height: 2.1,
      /** Out of a redirected exit he tumbles out this fast (m/s), up this fast. */
      outSpeed: 4.5,
      outUp: 1.5,
      /** You hold it at most this long (real s), then the exit is where you aim. */
      maxHold: 3,
      /** It shuts this long after he's through (s), or this long after it opened, whatever happened. */
      after: 0.35,
      life: 5,
    },
  },
  waves: {
    /** Seconds from the WAVE banner to GO (the 3-2-1): everyone sees the weapons, nobody moves. */
    first: 4.2,
    between: 4.6,
  },
};

/** What a hand action is: yours (snatch, pull, stab), or theirs (snatch off the floor, steal yours). */
export type HandKind = 'snatch' | 'pull' | 'stab' | 'steal';

/** One window and the hand coming out of it. */
export interface HandWindow {
  id: number;
  owner: Owner;
  kind: HandKind;
  /** The window's centre (it moves with what it's after only while it's opening). */
  readonly at: THREE.Vector3;
  /** Which way the hand comes out (unit). */
  readonly dir: THREE.Vector3;
  weapon: Weapon | null;
  /** The man it's after (pull, stab). */
  enemyId: number | null;
  /** Seconds since it opened. */
  t: number;
  /** Before the hand comes out (s): an enemy's steal is telegraphed. */
  tele: number;
  /** The grab happened (resolve was called): true = it got what it was after. */
  result: boolean | null;
}

/**
 * The open hand windows (yours and theirs). Each lives tele + open + back
 * seconds; `resolve` runs once, when the hand gets there, and says whether it
 * got it.
 */
export class Hands {
  readonly list: HandWindow[] = [];
  private next = 1;

  open(o: { owner: Owner; kind: HandKind; at: V3; dir: V3; weapon?: Weapon | null; enemyId?: number | null; tele?: number }): HandWindow {
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
      result: null,
    };
    this.list.push(w);
    return w;
  }

  /** The window `owner` has open (one at a time each). */
  of(owner: Owner): HandWindow | null {
    for (const w of this.list) if (w.owner === owner) return w;
    return null;
  }

  /** Shut a window now (its owner went down, the run reset). */
  cancel(w: HandWindow) {
    const i = this.list.indexOf(w);
    if (i >= 0) this.list.splice(i, 1);
  }

  clear() {
    this.list.length = 0;
  }

  /** The window's life (s). */
  static life(w: HandWindow) {
    return w.tele + (w.kind === 'stab' ? REACH.knife.stab : REACH.hand.open) + REACH.hand.back;
  }

  /** When the hand gets there (s after it opened). */
  static landAt(w: HandWindow) {
    return w.tele + (w.kind === 'stab' ? REACH.knife.stab : REACH.hand.open);
  }

  /** How far out the hand is (0 in the window .. 1 at what it's after). */
  static extent(w: HandWindow) {
    const land = Hands.landAt(w);
    if (w.t < w.tele) return 0;
    if (w.t < land) return (w.t - w.tele) / (land - w.tele);
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

// ---------------------------------------------------------------------------
// Aiming the hand
// ---------------------------------------------------------------------------

/** Something the hand can take: a man (his body's axis), a weapon (a point), a portal of theirs (a point). */
export interface AimCandidate {
  kind: 'portal' | 'weapon' | 'body';
  /** Enemy id (body), weapon id, or portal id. */
  id: number;
  /** A vertical segment (a body: feet to head) or a point (a == b). */
  a: V3;
  b: V3;
  /** How fat it is to the aim (m). */
  r: number;
}

export interface AimPick {
  cand: AimCandidate;
  /** The point on it the aim is nearest. */
  point: THREE.Vector3;
  /** Distance from `from` (your eyes) to that point (m). */
  dist: number;
  /** How far off the crosshair (rad; 0: right on it). */
  err: number;
}

const TIER: Record<AimCandidate['kind'], number> = { portal: 0, weapon: 1, body: 2 };
/** Per tier, this much of an error (rad) is given up: right on two things, the higher tier wins; nearly on one, the nearer. */
const TIER_STEP = 0.0016;

const _d = new THREE.Vector3();
const _w = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();

/** Closest points between the ray o + s·d (s ≥ 0) and segment a..b: writes the segment's point to `out`, returns s. */
export function rayToSegment(o: V3, d: V3, a: V3, b: V3, out: THREE.Vector3): number {
  _d.subVectors(b, a);
  const len2 = _d.lengthSq();
  if (len2 < 1e-9) {
    out.copy(a);
    return Math.max(0, _w.subVectors(a, o).dot(d));
  }
  // minimise |o + s d - (a + u e)| over s ≥ 0, u in [0,1]
  _w.subVectors(o, a);
  const dd = d.dot(d), de = d.dot(_d), ee = len2;
  const dw = d.dot(_w), ew = _d.dot(_w);
  const den = dd * ee - de * de;
  let u = den > 1e-9 ? (dd * ew - de * dw) / den : 0;
  u = THREE.MathUtils.clamp(u, 0, 1);
  let s = (de * u - dw) / dd;
  if (s < 0) {
    s = 0;
    u = THREE.MathUtils.clamp(ew / ee, 0, 1);
  }
  out.copy(a).addScaledVector(_d, u);
  // (the segment point for u, then the best s for it)
  return Math.max(0, _q.subVectors(out, o).dot(d) / dd);
}

/**
 * What the hand takes for the aim ray (origin, unit dir): the candidate with
 * the least error within `cone` (rad) and `range` of `from`, its tier
 * breaking near-ties (portal > weapon > body). `sees` is asked last, in order,
 * so only the few best pay for a line-of-sight ray.
 */
export function pickAim(
  origin: V3,
  dir: V3,
  from: V3,
  cands: readonly AimCandidate[],
  o: { range: number; cone: number; sees?: (c: AimCandidate, point: V3) => boolean },
): AimPick | null {
  const tanCone = Math.tan(o.cone);
  const ok: { pick: AimPick; score: number }[] = [];
  for (const c of cands) {
    const point = new THREE.Vector3();
    const s = rayToSegment(origin, dir, c.a, c.b, point);
    if (s <= 0.2) continue;
    _p.copy(origin).addScaledVector(dir, s);
    const perp = _p.distanceTo(point);
    const err = Math.max(0, perp - c.r) / s;
    if (err > tanCone) continue;
    const dist = point.distanceTo(from);
    if (dist > o.range) continue;
    ok.push({ pick: { cand: c, point, dist, err: Math.atan(err) }, score: Math.atan(err) + TIER[c.kind] * TIER_STEP });
  }
  ok.sort((x, y) => x.score - y.score);
  for (const k of ok) if (!o.sees || o.sees(k.pick.cand, k.pick.point)) return k.pick;
  return null;
}

/** What a knife does to a man `dist` m away (feet to feet), `sight` = in plain view: a stab, a stab through a window, or nothing. */
export function knifeReach(dist: number, sight: boolean): 'melee' | 'window' | null {
  if (dist <= REACH.knife.melee) return 'melee';
  if (dist <= REACH.range && sight) return 'window';
  return null;
}

/**
 * Where a hand window opens for what's at `target` (seen from `eye`): beside
 * it, a little above and toward you, so the arm is seen reaching across to it
 * (straight on, the window would hide its own arm); `dirOut`: the way the arm
 * comes out (at it).
 */
export function windowSpot(eye: V3, target: V3, out: THREE.Vector3, dirOut: THREE.Vector3, standOff = REACH.hand.standOff) {
  // (toward it, flat; then its right-hand side as you look at it)
  dirOut.set(target.x - eye.x, 0, target.z - eye.z);
  const d = dirOut.length();
  if (d < 1e-6) dirOut.set(0, 0, 1);
  else dirOut.multiplyScalar(1 / d);
  const sx = -dirOut.z, sz = dirOut.x;
  const near = Math.min(0.3, d * 0.2);
  out.set(target.x - sx * standOff - dirOut.x * near, target.y + 0.45, target.z - sz * standOff - dirOut.z * near);
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
