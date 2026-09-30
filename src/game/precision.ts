import * as THREE from 'three';
import type { EnemyView, V3 } from '../core/contracts';
import type { CollisionWorld } from '../world/collision';
import { activeVariant, type CombatVariant } from './variant';

/**
 * PRECISION (a COMBAT LAB variant; ONSLAUGHT builds on it): the game stops
 * playing itself. Nothing locks on, nothing picks the exit for you, the blade
 * doesn't chase; instead three skills of your own:
 *
 *  AIM     strikes and GRAB take the man under the crosshair (a tight cone,
 *          a little looser on a thumb or a pad), never the one near it. A
 *          GRAB's exit goes where the crosshair is when you let go.
 *  PARRY   RMB opens a small rift in front of you for 0.25 s: fire that
 *          meets it in that window goes back to its shooter, charged. Early
 *          or late, nothing is caught. The first 0.1 s is a PERFECT parry:
 *          the shooter reels.
 *  DODGE   V drops you through a floor rift and up again 4.5 m away (the way
 *          you move, else back), untouchable for a moment; come up behind a
 *          man and he staggers.
 *  BLADE   reach only; it finishes whoever is exposed (from behind, reeling,
 *          down, unaware). A man facing you, on his guard, turns it aside.
 *
 * All of this is read through `precisionOn()`: in CURRENT (and outside the
 * lab) every system plays as it always did.
 */
export const PRECISION = {
  aim: {
    /** Half-angle of the crosshair cone to his body's axis (rad): at range this is what counts... */
    cone: THREE.MathUtils.degToRad(2.5),
    /** ...up close his body itself (radius x this). */
    body: 1.1,
    /** A thumb or a pad: a little looser (rad, x). */
    looseCone: THREE.MathUtils.degToRad(4),
    looseBody: 1.35,
  },
  grab: {
    /** Time scale while a GRAB is held, and the longest it holds (real s). */
    slow: 0.5,
    maxHold: 1.2,
    /** The exit never lands short of the man in hand: at least this far past him along the aim (m). */
    pastMan: 4,
  },
  parry: {
    /** The window (game s), its PERFECT start, the lockout from press to press (real s). */
    window: 0.25,
    perfect: 0.1,
    cooldown: 0.6,
    /** What comes back hits for this (a charged round), this fast (m/s). */
    damage: 60,
    speed: 44,
    /** A PERFECT parry: the shooter reels this long (s). */
    stagger: 1.5,
    hitstop: 0.06,
    /** Fire from within this cone of where you look is met (cos, horizontal). */
    front: 0.17,
    /** The rift is this much wider than you (m, added to your radius). */
    pad: 0.55,
    /** A grenade this close to your chest is caught (m). */
    grenadeReach: 2.6,
  },
  dodge: {
    /** How far (m), the shortest it settles for, the most it climbs or drops (m). */
    dist: 4.5,
    minDist: 2,
    rise: 1.2,
    /** Down (hidden), across, up: the whole move takes sink + travel (game s). */
    sink: 0.06,
    travel: 0.14,
    /** Untouchable from the press (game s); from press to press (real s). */
    invuln: 0.35,
    cooldown: 0.8,
    /** The hop out of the floor (m/s). */
    pop: 3.2,
    /** Come up behind a man within this (m) and he staggers this long (s); the blade finishes him within `exposed` s. */
    behindRange: 3.2,
    behindStagger: 0.9,
    exposed: 1.4,
  },
  blade: {
    /** A finisher: the slow beat after it (scale, s) and its hitstop. */
    slowScale: 0.3,
    slowT: 0.55,
    hitstop: 0.14,
    /** Turned aside: he reels this long, you're pushed back this fast (m/s). */
    guardStagger: 0.35,
    guardPush: 5,
  },
};

/** PRECISION's rules apply (PRECISION itself, and ONSLAUGHT on top of it). */
export function precisionOn(v: CombatVariant = activeVariant()): boolean {
  return v === 'precision' || v === 'onslaught';
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/**
 * The man the crosshair is on: of everyone whose body the aim ray passes
 * within the cone of (his body's own width up close), the nearest along it,
 * in range and in sight. No one near it, no one "best": the crosshair decides.
 */
export function aimedEnemy(
  world: Pick<CollisionWorld, 'lineOfSight'>,
  list: readonly EnemyView[],
  live: (e: EnemyView) => boolean,
  origin: V3,
  dir: V3,
  eye: V3,
  o: { range: number; loose?: boolean; skip?: EnemyView | null },
): EnemyView | null {
  const A = PRECISION.aim;
  const tanCone = Math.tan(o.loose ? A.looseCone : A.cone);
  const bodyK = o.loose ? A.looseBody : A.body;
  let best: EnemyView | null = null;
  let bestAlong = Infinity;
  for (const e of list) {
    if (!e.alive || e === o.skip || !live(e)) continue;
    const c = e.chest(_a);
    if (c.distanceTo(eye) > o.range) continue;
    // nearest approach of the ray to his feet→head axis (sampled)
    let dm = Infinity;
    let along = 0;
    for (let k = 0; k <= 8; k++) {
      _b.set(e.pos.x, e.pos.y + 0.15 + (e.height - 0.15) * (k / 8), e.pos.z).sub(origin);
      const al = _b.dot(dir);
      if (al <= 0.5) continue;
      const d = _b.addScaledVector(dir, -al).length();
      if (d < dm) {
        dm = d;
        along = al;
      }
    }
    if (!(dm < Infinity)) continue;
    if (dm > Math.max(e.radius * bodyK, along * tanCone)) continue;
    if (along >= bestAlong) continue;
    if (!world.lineOfSight(eye, c) && !world.lineOfSight(eye, _b.set(e.pos.x, e.pos.y + e.height - 0.1, e.pos.z))) continue;
    best = e;
    bestAlong = along;
  }
  return best;
}

/**
 * Where a DODGE from `feet` along `dir` (horizontal, unit) comes up: standable
 * floor `dist` m out (else as far as there is one, down to minDist), about
 * your level, solid all round (never at the lip of a drop, never over water
 * or the void), room to stand, no wall between. Null: nowhere to go.
 */
export function dodgeSpot(
  world: Pick<CollisionWorld, 'groundAt' | 'raycast' | 'overlapsCylinder'>,
  level: { seaY: number; isSea(p: V3): boolean },
  feet: V3,
  dir: V3,
  height = 1.8,
): THREE.Vector3 | null {
  const D = PRECISION.dodge;
  const waist = _a.set(feet.x, feet.y + 1.0, feet.z);
  const flat = _b.set(dir.x, 0, dir.z);
  if (flat.lengthSq() < 1e-6) return null;
  flat.normalize();
  const wall = world.raycast(waist, flat, D.dist + 0.5, { sight: false });
  const far = wall ? Math.min(D.dist, wall.distance - 0.5) : D.dist;
  const p = new THREE.Vector3();
  for (let d = far; d >= D.minDist - 1e-6; d -= 0.25) {
    p.set(feet.x + flat.x * d, feet.y, feet.z + flat.z * d);
    const g = world.groundAt(p.x, p.z, 0.05, feet.y + D.rise + 0.05);
    if (!(g > -Infinity) || Math.abs(g - feet.y) > D.rise) continue;
    if (level.isSea(p) && g < level.seaY + 0.3) continue;
    // solid all round: no lip, no gap under a foot
    let solid = true;
    for (const [ox, oz] of [[0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) {
      const gg = world.groundAt(p.x + ox, p.z + oz, 0.05, g + 0.3);
      if (!(gg > g - 0.3)) {
        solid = false;
        break;
      }
    }
    if (!solid) continue;
    if (world.overlapsCylinder(p.x, p.z, 0.38, g + 0.15, g + height)) continue;
    return p.setY(g);
  }
  return null;
}

/** He can't see it coming: off his guard (reeling, down, unaware, held) or you're behind him. */
export function exposedTo(e: EnemyView, from: V3): boolean {
  // on his guard: fighting you, or a brute's charge (that one you sidestep)
  if (e.state !== 'combat' && e.state !== 'charge') return true;
  const f = e.forward(_a);
  const tx = from.x - e.pos.x, tz = from.z - e.pos.z;
  const d = Math.hypot(tx, tz);
  if (d < 1e-3) return true;
  return (f.x * tx + f.z * tz) / d < -0.1;
}

/** Is `from` behind him (for the dodge's stagger): more than ~105° off his facing. */
export function behind(e: EnemyView, from: V3): boolean {
  const f = e.forward(_a);
  const tx = from.x - e.pos.x, tz = from.z - e.pos.z;
  const d = Math.hypot(tx, tz);
  return d > 1e-3 && (f.x * tx + f.z * tz) / d < -0.25;
}

/** The PARRY's timing: a window from the press, and the lockout. */
export class Parry {
  /** Game s since the window opened (-1: closed). */
  t = -1;
  /** Real s until the next press takes. */
  cd = 0;
  /** Catches in this window (feedback stacks gently after the first). */
  caught = 0;

  reset() {
    this.t = -1;
    this.cd = 0;
    this.caught = 0;
  }

  /** RMB: the window opens (false while locked out). */
  press(): boolean {
    if (this.cd > 0) return false;
    this.t = 0;
    this.cd = PRECISION.parry.cooldown;
    this.caught = 0;
    return true;
  }

  update(realDt: number, dt: number) {
    this.cd = Math.max(0, this.cd - realDt);
    if (this.t >= 0) {
      this.t += dt;
      if (this.t > PRECISION.parry.window) this.t = -1;
    }
  }

  get open() {
    return this.t >= 0 && this.t <= PRECISION.parry.window;
  }

  get perfect() {
    return this.open && this.t <= PRECISION.parry.perfect;
  }

  /** 0 ready .. 1 just pressed (the strike bar's sweep). */
  cooling() {
    return this.cd / PRECISION.parry.cooldown;
  }

  /** Fire moving along `vel` meets the rift in front of you (you look along `look`, horizontal unit). */
  static facing(vel: V3, look: V3): boolean {
    const h = Math.hypot(vel.x, vel.z);
    if (h < 1e-4) return true; // straight down on you: the rift takes it
    return (-vel.x * look.x - vel.z * look.z) / h >= PRECISION.parry.front;
  }
}

/** The DODGE under way: down, across (hidden), up. */
export interface DodgeRun {
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** Game s since the press. */
  t: number;
  /** Came up already. */
  up: boolean;
}

/** Where the body is `t` s into a dodge (null once it's up). */
export function dodgeAt(r: DodgeRun, out: THREE.Vector3): THREE.Vector3 | null {
  const D = PRECISION.dodge;
  if (r.t < D.sink) return out.copy(r.from);
  const k = Math.min(1, (r.t - D.sink) / D.travel);
  if (k >= 1) return null;
  // ease in-out: a zip, not a slide
  const e = k * k * (3 - 2 * k);
  return out.lerpVectors(r.from, r.to, e);
}

/**
 * The PARRY's rift: a small upright oval in front of you while the window is
 * open (white-hot through the PERFECT part, cooling to cyan), and a flare
 * when it catches something.
 */
export class ParryView {
  readonly group = new THREE.Group();
  private rim: THREE.MeshBasicMaterial;
  private core: THREE.MeshBasicMaterial;
  private flash = 0;
  private static readonly HOT = new THREE.Color(2.6, 2.9, 3.0);
  private static readonly COOL = new THREE.Color(0.3, 1.7, 2.6);

  constructor() {
    const add = (opacity: number) =>
      new THREE.MeshBasicMaterial({ color: ParryView.COOL.clone(), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
    this.rim = add(1);
    this.core = add(0.22);
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 40), this.rim);
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.5, 40), this.core);
    rim.renderOrder = core.renderOrder = 30;
    this.group.add(core, rim);
    this.group.scale.set(1, 1.45, 1);
    this.group.visible = false;
    this.group.userData.helper = true;
  }

  /** A catch: the rift flares. */
  flare() {
    this.flash = 1;
  }

  /** `t`: game s into the window (<0: closed); where (chest height, in front) and facing. */
  update(t: number, at: V3, face: V3, realDt: number) {
    const P = PRECISION.parry;
    this.flash = Math.max(0, this.flash - realDt * 5);
    const on = t >= 0 && t <= P.window;
    this.group.visible = on || this.flash > 0.05;
    if (!this.group.visible) return;
    this.group.position.copy(at);
    this.group.quaternion.setFromUnitVectors(_zAxis, _a.copy(face).normalize());
    const open = on ? Math.min(1, t / 0.035) : 1;
    const fade = on ? 1 - Math.max(0, (t - P.window * 0.7) / (P.window * 0.3)) : this.flash;
    const s = (0.55 + 0.45 * open) * (1 + this.flash * 0.35);
    this.group.scale.set(s, s * 1.45, s);
    const hot = on && t <= P.perfect ? 1 : this.flash;
    this.rim.color.copy(ParryView.COOL).lerp(ParryView.HOT, hot);
    this.core.color.copy(this.rim.color);
    this.rim.opacity = Math.max(0, fade);
    this.core.opacity = 0.22 * Math.max(0, fade) + 0.4 * this.flash;
  }
}

const _zAxis = new THREE.Vector3(0, 0, 1);
