import * as THREE from 'three';
import { LAW, type DynBody, type EnemyView, type StrikeName, type V3, type ZoneId } from '../core/contracts';
import { frameNormal, orientFrame } from './portalMath';
import type { Prop } from './props';
import {
  besideDoor,
  facingFrame,
  findEdge,
  floorUnder,
  launchFrame,
  lockOnEnemy,
  simulateArc,
  skyHatch,
  standingDoor,
  throwSpot,
  type Frame,
  type Outcome,
  type SpotHost,
} from './riftspots';

/**
 * STRIKES: four rift attacks on one press each (they cost rift charge; the
 * free PORTAL key does everything else).
 *
 *  1 REFLECT  a rift on his muzzle (a lid over a grenadier, a shield door in
 *             front of you for the unarmed) and he's made to fire: it all
 *             comes out of the other end, beside him, into him. Look at
 *             another man (or a barrel) and the other end goes there. 4 s.
 *  2 LOOP     the floor under him and a hatch over him: he falls forever.
 *             Press again: GEYSER (up he goes, over the drop / water if one
 *             is near). Hold: HUMAN CANNON (slow motion, aim, let go: he
 *             comes out where you look at loop speed). 6 s, then a geyser.
 *  3 SWAP     a floor end under each of you: you change places. He's
 *             rift-marked a moment, so his own side's fire hurts him.
 *  4 DASH     the floor under you and an end right in front of him: you come
 *             out at him at 22 m/s. With no one in sight, a dash ahead.
 */
export type StrikeId = 'reflect' | 'loop' | 'swap' | 'dash';
export const STRIKES: StrikeId[] = ['reflect', 'loop', 'swap', 'dash'];

export const STRIKE = {
  /** Lock-on: enemies within this range, in sight, near the crosshair. */
  range: 32,
  cone: 0.42,
  /** Short lockout per strike after use (s). */
  cooldown: 1.5,
  /** Rift charge: a strike costs one; they come back slowly, and every kill that isn't a strike's refunds one. */
  maxCharges: 3,
  regen: 9,
  reflectLife: 4,
  loopLife: 6,
  loopHeight: 7.5,
  loopMin: 3.4,
  geyserSpeed: 21,
  cannonSpeed: 22,
  /** Held this long, the second LOOP press aims the cannon (real s). */
  tap: 0.2,
  cannonMaxAim: 3,
  swapLife: 1.4,
  /** Most you can SWAP / DASH up (m). */
  upMax: 9,
  dashSpeed: 22,
  dashFree: 12,
  dashGap: 3,
  dashLife: 1.1,
  /** How long a SWAPped man takes his own side's fire. */
  markTime: 2.5,
};

const GUNS = new Set(['rifleman', 'sniper', 'turret', 'boss']);

/**
 * Whose kill it is (DESIGN §4): the STRIKE that set him up (its mark on him, a
 * REFLECT's fire that got him, the HUMAN CANNON fired into him) names it,
 * except for the blade, whose kill is always its own. A strike's floor end is
 * never a TRAPDOOR, blade or not. Every kill that isn't a strike's refunds a charge.
 */
export function killCredit(o: { cause: string; setBy: StrikeName | null; viaTrapdoor: boolean }): { strike: StrikeName | null; viaTrapdoor: boolean; refund: boolean } {
  const strike = o.cause === 'blade' ? null : o.setBy;
  return { strike, viaTrapdoor: o.viaTrapdoor && !o.setBy, refund: !strike };
}

export interface StrikeHost extends SpotHost {
  enemies: {
    readonly list: readonly EnemyView[];
    launch(v: EnemyView, vel?: V3): void;
    provoke(v: EnemyView): boolean;
    muzzleInfo(v: EnemyView, from: THREE.Vector3, dir: THREE.Vector3): boolean;
  };
  props: { readonly items: readonly Prop[] };
  active: ReadonlySet<ZoneId>;
  playerFeet(): V3;
  playerEye(): V3;
  playerBody(): DynBody;
  playerGrounded(): boolean;
  aimRay(): { origin: V3; dir: V3 };
  /** Touch: a thumb aims looser, so the lock-on cone is wider. */
  touch(): boolean;
}

export interface StrikeResult {
  ok: boolean;
  id: StrikeId;
  /** i18n key of why not. */
  reason?: string;
  target?: EnemyView | null;
  /** Where the show is (FX / camera). */
  at?: V3;
  /** What a kill of the target will be named. */
  name?: StrikeName;
  /** A LOOP's second press: 'geyser' / 'cannon'. */
  release?: 'geyser' | 'cannon';
}

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const FWD = new THREE.Vector3(0, 0, 1);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const ARC_N = 64;

interface Reflect {
  id: number;
  t: EnemyView;
  kind: 'muzzle' | 'lid' | 'shield';
  life: number;
  /** Smoothed exit frame (it follows your gaze). */
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  aimAt: number;
  /** He's down: the pair stays a moment for what's in flight. */
  doneT: number;
}

interface Loop {
  id: number;
  t: EnemyView;
  life: number;
  /** The second press (real s held), while it's down. */
  second: number;
  fired: 'geyser' | 'cannon' | null;
  /** Closes this long after he's out (s, game). */
  closeT: number;
  launch: { frame: Frame; valid: boolean } | null;
}

export class Strikes {
  readonly cd: Record<StrikeId, number> = { reflect: 0, loop: 0, swap: 0, dash: 0 };
  /** 0..maxCharges (fractional: the next one filling up). */
  charges: number = STRIKE.maxCharges;
  reflect: Reflect | null = null;
  loop: Loop | null = null;
  private swap: { id: number; t: EnemyView; you: boolean; him: boolean } | null = null;
  private dash: { id: number } | null = null;
  /** The cannon's arc (for drawing). */
  readonly arc: THREE.Vector3[] = Array.from({ length: ARC_N }, () => new THREE.Vector3());
  arcN = 0;
  arcOutcome: Outcome = 'safe';
  private realDt = 0;

  constructor(private h: StrikeHost) {}

  reset() {
    for (const k of STRIKES) this.cd[k] = 0;
    this.charges = STRIKE.maxCharges;
    this.reflect = null;
    this.loop = null;
    this.swap = null;
    this.dash = null;
    this.arcN = 0;
  }

  /** A kill that isn't a strike's: charge back. */
  refund(n = 1) {
    this.charges = Math.min(STRIKE.maxCharges, this.charges + n);
  }

  spend(n: number) {
    this.charges = Math.max(0, this.charges - n);
  }

  /** Let go of a LOOP cannon being aimed without firing it (pause): the loop goes on. */
  cancelAim() {
    if (this.loop) this.loop.second = 0;
    this.arcN = 0;
  }

  /** The LOOP cannon is being aimed (slow motion). */
  get aiming() {
    return !!this.loop && !this.loop.fired && this.loop.second > STRIKE.tap;
  }

  /** 0 = ready, 1 = just used (or no charge: how far the next one is from full). */
  cooling(id: StrikeId) {
    // a live LOOP's key is its second press: always ready
    if (this.armed(id)) return 0;
    const lock = this.cd[id] / STRIKE.cooldown;
    return this.charges >= 1 ? lock : Math.max(lock, 1 - (this.charges % 1));
  }

  /** The strike is live and its key does its second part (LOOP: geyser / cannon). */
  armed(id: StrikeId) {
    return id === 'loop' && !!this.loop && !this.loop.fired;
  }

  /** The enemy a strike would hit now: closest to the crosshair, in range and in sight. */
  target(): EnemyView | null {
    const h = this.h;
    const { origin, dir } = h.aimRay();
    return lockOnEnemy(h, h.enemies.list, (e) => h.active.has(e.def.zone), origin, dir, h.playerEye(), {
      cone: STRIKE.cone * (h.touch() ? 1.4 : 1),
      range: STRIKE.range,
      off: 1.4,
    });
  }

  // ------------------------------------------------------------------
  // Per frame
  // ------------------------------------------------------------------

  update(realDt: number, dt: number) {
    this.realDt = realDt;
    for (const k of STRIKES) this.cd[k] = Math.max(0, this.cd[k] - realDt);
    this.charges = Math.min(STRIKE.maxCharges, this.charges + realDt / STRIKE.regen);
    const h = this.h;
    const r = this.reflect;
    if (r) {
      r.life -= dt;
      if (!h.rifts.strikeEnds(r.id)) this.reflect = null;
      else if (r.life <= 0 || (r.doneT >= 0 && (r.doneT -= dt) <= 0)) {
        h.rifts.closeStrike(r.id);
        this.reflect = null;
      } else this.steerReflect(r, dt);
    }
    const L = this.loop;
    if (L) {
      const ends = h.rifts.strikeEnds(L.id);
      if (!ends) this.loop = null;
      else if (!L.t.alive && !L.fired) {
        h.rifts.closeStrike(L.id);
        this.loop = null;
      } else if (L.fired) {
        if (L.closeT >= 0 && (L.closeT -= dt) <= 0) {
          h.rifts.closeStrike(L.id);
          this.loop = null;
        }
      } else {
        L.life -= dt;
        if (L.life <= 0 && L.second <= 0) this.release(L, 'geyser');
      }
    }
    if (!this.aiming) this.arcN = 0;
  }

  /**
   * The strike keys, every frame: `pressed` this frame, `held` now. Returns a
   * result when something happened (a strike, a LOOP's release).
   */
  input(id: StrikeId, pressed: boolean, held: boolean): StrikeResult | null {
    const L = this.loop;
    if (id === 'loop' && L && !L.fired) {
      if (pressed && L.second <= 0) L.second = 1e-4;
      if (L.second <= 0) return null;
      L.second += this.realDt;
      if (held && L.second < STRIKE.cannonMaxAim) {
        if (L.second > STRIKE.tap) this.aimCannon(L);
        return null;
      }
      const cannon = L.second > STRIKE.tap && !!L.launch?.valid;
      L.second = 0;
      this.arcN = 0;
      const how = cannon ? 'cannon' : 'geyser';
      const at = this.release(L, how);
      return { ok: true, id: 'loop', target: L.t, at, name: how, release: how };
    }
    return pressed ? this.fire(id) : null;
  }

  fire(id: StrikeId): StrikeResult {
    const fail = (reason: string, target: EnemyView | null = null): StrikeResult => ({ ok: false, id, reason, target });
    if (this.cd[id] > 0) return fail('strike.cooldown');
    if (this.charges < 1) return fail('strike.noCharge');
    const t = this.target();
    if (!t && id !== 'dash') return fail('strike.noTarget');
    // a turret never moves; Voss does once stunned (so only his refusal says so)
    if (t && (id === 'loop' || id === 'swap') && (t.kind === 'turret' || (t.kind === 'boss' && !t.offBalance))) return fail(t.kind === 'boss' ? 'strike.anchored' : 'portal.anchored', t);
    let r: StrikeResult;
    switch (id) {
      case 'reflect':
        r = this.fireReflect(t!);
        break;
      case 'loop':
        r = this.fireLoop(t!);
        break;
      case 'swap':
        r = this.fireSwap(t!);
        break;
      case 'dash':
        r = this.fireDash(t);
        break;
    }
    if (r.ok) {
      this.cd[id] = STRIKE.cooldown;
      this.charges -= 1;
    }
    return r;
  }

  /** `end` is one of the live REFLECT pair's: whatever comes through it is the strike's work. */
  viaReflect(end: unknown): boolean {
    const r = this.reflect;
    const ends = r ? this.h.rifts.strikeEnds(r.id) : null;
    return !!ends && (end === ends.a || end === ends.b);
  }

  /** A body went through a rift (the game forwards crossings). */
  crossed(kind: 'player' | 'enemy' | 'other', enemyId: number, from: unknown, to: unknown) {
    const h = this.h;
    const L = this.loop;
    if (L && L.fired && kind === 'enemy' && enemyId === L.t.id) {
      const ends = h.rifts.strikeEnds(L.id);
      if (ends && to === ends.b) L.closeT = 0.5;
    }
    const S = this.swap;
    if (S) {
      const ends = h.rifts.strikeEnds(S.id);
      if (!ends) this.swap = null;
      else if (from === ends.a || from === ends.b) {
        if (kind === 'player') S.you = true;
        if (kind === 'enemy' && enemyId === S.t.id) S.him = true;
        if (S.you && S.him) {
          h.rifts.setStrikeLife(S.id, 0.3);
          this.swap = null;
        }
      }
    }
    const D = this.dash;
    if (D && kind === 'player') {
      const ends = h.rifts.strikeEnds(D.id);
      if (!ends) this.dash = null;
      else if (to === ends.b) {
        h.rifts.setStrikeLife(D.id, 0.3);
        this.dash = null;
      }
    }
  }

  // ------------------------------------------------------------------
  // REFLECT
  // ------------------------------------------------------------------

  private fireReflect(t: EnemyView): StrikeResult {
    const h = this.h;
    const kind: Reflect['kind'] = t.kind === 'grenadier' ? 'lid' : GUNS.has(t.kind) ? 'muzzle' : 'shield';
    const a = this.reflectEntrance(t, kind);
    if (!a) return { ok: false, id: 'reflect', reason: 'strike.noRoom', target: t };
    // the other end: a brute's charge goes over the edge; everything else back into him
    let b: Frame | null;
    let boost = 0;
    if (t.kind === 'brute') {
      const spot = throwSpot(h, h.playerFeet());
      b = spot ? spot.frame : null;
      boost = 12;
    } else b = besideDoor(h, t, h.playerFeet());
    if (!b) return { ok: false, id: 'reflect', reason: 'gate.noSpace', target: t };
    // a gunman who can't fire right now (on his back, reeling, no clear throw) isn't worth the charge
    if (!h.enemies.provoke(t) && kind !== 'shield') return { ok: false, id: 'reflect', reason: 'strike.cantFire', target: t };
    const id = h.rifts.openStrike(a, b, STRIKE.reflectLife + 1, 0, t.kind === 'brute' ? -1 : t.id);
    const ends = h.rifts.strikeEnds(id)!;
    ends.a.noPlayer = ends.b.noPlayer = true;
    ends.a.boost = 0;
    ends.b.boost = boost;
    this.reflect = { id, t, kind, life: STRIKE.reflectLife, pos: b.position.clone(), quat: b.quaternion.clone(), aimAt: t.id, doneT: -1 };
    return { ok: true, id: 'reflect', target: t, at: a.position.clone(), name: 'reflect' };
  }

  /** On his muzzle (facing him), a lid over a grenadier, or a door in front of you facing him. */
  private reflectEntrance(t: EnemyView, kind: Reflect['kind']): Frame | null {
    const h = this.h;
    if (kind === 'muzzle') {
      const from = new THREE.Vector3(), dir = new THREE.Vector3();
      if (!h.enemies.muzzleInfo(t, from, dir)) return null;
      const n = dir.clone().negate();
      return { position: from.addScaledVector(dir, 0.9), quaternion: orientFrame(n, Math.abs(n.y) > 0.9 ? FWD : UP), width: 1.3, height: 1.3, kind: 'air' };
    }
    if (kind === 'lid') {
      const f = t.forward(new THREE.Vector3());
      return { position: new THREE.Vector3(t.pos.x + f.x * 0.9, t.pos.y + t.height + 0.45, t.pos.z + f.z * 0.9), quaternion: orientFrame(DOWN, FWD), width: 2.2, height: 2.2, kind: 'air' };
    }
    const feet = h.playerFeet();
    const toT = new THREE.Vector3(t.pos.x - feet.x, 0, t.pos.z - feet.z);
    if (toT.lengthSq() < 1e-4) return null;
    toT.normalize();
    // (a brute's charge hits from 1.5 m: his door stands further out)
    const out = t.kind === 'brute' ? 2.6 : 1.4;
    return standingDoor(h, _a.set(feet.x + toT.x * out, feet.y, feet.z + toT.z * out), toT, feet.y);
  }

  /** The muzzle end stays on his gun; the other end goes where you look (another man, a barrel) or back at him. */
  private steerReflect(r: Reflect, dt: number) {
    const h = this.h;
    const t = r.t;
    if (!t.alive) {
      if (r.doneT < 0) r.doneT = 0.8;
      return;
    }
    if (r.kind !== 'shield') {
      const a = this.reflectEntrance(t, r.kind);
      if (a) h.rifts.moveStrikeEntrance(r.id, a);
    }
    if (t.kind === 'brute') return;
    const ray = h.aimRay();
    const eye = h.playerEye();
    const other = lockOnEnemy(h, h.enemies.list, (e) => h.active.has(e.def.zone), ray.origin, ray.dir, eye, { skip: t, cone: 0.12, range: 45 });
    let want: Frame | null = null;
    let aimAt = t.id;
    if (other) {
      want = facingFrame(other.chest(new THREE.Vector3()), t.chest(_c), Math.min(3.2, other.pos.distanceTo(t.pos) * 0.5));
      aimAt = other.id;
    } else {
      const barrel = this.barrelOnRay(ray.origin, ray.dir);
      if (barrel) {
        want = facingFrame(new THREE.Vector3().copy(barrel.body.pos).setY(barrel.body.pos.y + barrel.body.height * 0.5), t.chest(_c), 2.5);
        aimAt = -1;
      } else want = besideDoor(h, t, h.playerFeet());
    }
    if (!want) return;
    const k = 1 - Math.exp(-dt * 10);
    r.pos.lerp(want.position, k);
    r.quat.slerp(want.quaternion, k);
    r.aimAt = aimAt;
    h.rifts.moveStrikeExit(r.id, { position: r.pos, quaternion: r.quat, width: want.width, height: want.height, kind: want.kind });
    const ends = h.rifts.strikeEnds(r.id);
    if (ends) ends.b.aimAt = aimAt;
  }

  private barrelOnRay(origin: V3, dir: V3): Prop | null {
    let best: Prop | null = null;
    let bd = 1.2;
    for (const pr of this.h.props.items) {
      if (!pr.alive || !pr.active || !pr.def.explosive) continue;
      _a.copy(pr.body.pos).setY(pr.body.pos.y + pr.body.height * 0.5).sub(origin);
      const al = _a.dot(dir);
      if (al < 2 || al > 45) continue;
      const d = _a.addScaledVector(dir, -al).length();
      if (d < bd) {
        bd = d;
        best = pr;
      }
    }
    return best;
  }

  // ------------------------------------------------------------------
  // LOOP
  // ------------------------------------------------------------------

  private fireLoop(t: EnemyView): StrikeResult {
    const h = this.h;
    const a = floorUnder(h, t.pos);
    if (!a) return { ok: false, id: 'loop', reason: 'strike.noFloor', target: t };
    const b = skyHatch(h, a.position, STRIKE.loopHeight, STRIKE.loopMin);
    if (!b) return { ok: false, id: 'loop', reason: 'strike.noRoom', target: t };
    const id = h.rifts.openStrike(a, b, STRIKE.loopLife + 4, 0, -1);
    const ends = h.rifts.strikeEnds(id)!;
    ends.a.noPlayer = ends.b.noPlayer = true;
    h.enemies.launch(t, new THREE.Vector3(0, -6, 0));
    this.loop = { id, t, life: STRIKE.loopLife, second: 0, fired: null, closeT: -1, launch: null };
    return { ok: true, id: 'loop', target: t, at: b.position.clone(), name: 'loop' };
  }

  /** The cannon being aimed: a launcher end along your aim, the arc at his loop speed. */
  private aimCannon(L: Loop) {
    const h = this.h;
    const ray = h.aimRay();
    const eye = h.playerEye();
    const along = Math.max(0, _a.subVectors(eye, ray.origin).dot(ray.dir));
    const lock = lockOnEnemy(h, h.enemies.list, (e) => h.active.has(e.def.zone), ray.origin, ray.dir, eye, { skip: L.t, cone: 0.2 * (h.touch() ? 1.5 : 1), range: 40 });
    let frame: Frame;
    let reason: string | null = null;
    if (lock) frame = facingFrame(lock.chest(new THREE.Vector3()), ray.origin, 2.6);
    else {
      const lf = launchFrame(h, ray.origin, ray.dir, along, 14);
      frame = lf.frame;
      reason = lf.reason;
    }
    L.launch = { frame, valid: !reason };
    const speed = Math.max(STRIKE.cannonSpeed, L.t.body?.vel.length() ?? 0);
    const res = simulateArc(h, frame.position, _c.copy(frameNormal(frame, _a)).multiplyScalar(speed), this.arc, { enemies: h.enemies.list, skipId: L.t.id });
    this.arcN = reason ? 0 : res.n;
    this.arcOutcome = res.outcome;
  }

  /** The loop lets him out: up (GEYSER) or where you aimed (CANNON). Returns where. */
  private release(L: Loop, how: 'geyser' | 'cannon'): V3 | undefined {
    const h = this.h;
    const ends = h.rifts.strikeEnds(L.id);
    if (!ends) return undefined;
    const speed = L.t.body?.vel.length() ?? 0;
    let frame: Frame;
    let boost: number;
    if (how === 'cannon' && L.launch?.valid) {
      frame = L.launch.frame;
      boost = Math.max(STRIKE.cannonSpeed, speed);
    } else {
      how = 'geyser';
      frame = this.geyserFrame(ends.a.position);
      boost = Math.max(STRIKE.geyserSpeed, speed);
    }
    h.rifts.moveStrikeExit(L.id, frame);
    ends.b.boost = boost;
    L.fired = how;
    L.closeT = -1;
    h.rifts.setStrikeLife(L.id, 3);
    return frame.position.clone();
  }

  /** An up-facing end away from the loop: over the nearest drop / water, else beside it. */
  private geyserFrame(floor: V3): Frame {
    const h = this.h;
    const edge = findEdge(h, floor, 3, 16);
    let at: THREE.Vector3;
    if (edge) at = edge.clone().setY(Math.max(edge.y, h.level.seaY + 1));
    else {
      at = new THREE.Vector3(floor.x, floor.y, floor.z);
      const w = h.world;
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const x = floor.x + Math.sin(ang) * 4, z = floor.z + Math.cos(ang) * 4;
        const g = w.groundAt(x, z, 0.4, floor.y + 1);
        if (!(g > floor.y - 1.5) || !w.lineOfSight(_a.set(floor.x, floor.y + 1, floor.z), _b.set(x, g + 1, z))) continue;
        at.set(x, g, z);
        break;
      }
    }
    // the sky end: flat, facing up, a little off the ground
    return { position: at.setY(at.y + 0.35), quaternion: orientFrame(UP, FWD), width: LAW.floorEndSize, height: LAW.floorEndSize, kind: 'air' };
  }

  // ------------------------------------------------------------------
  // SWAP / DASH
  // ------------------------------------------------------------------

  private fireSwap(t: EnemyView): StrikeResult {
    const h = this.h;
    const fail = (reason: string): StrikeResult => ({ ok: false, id: 'swap', reason, target: t });
    if (!h.playerGrounded()) return fail('strike.grounded');
    const feet = h.playerFeet();
    if (t.pos.y - feet.y > STRIKE.upMax) return fail('strike.tooHigh');
    const a = floorUnder(h, feet);
    const b = floorUnder(h, t.pos);
    if (!a || !b) return fail('strike.noFloor');
    if (a.position.distanceTo(b.position) < 3) return fail('strike.tooClose');
    const id = h.rifts.openStrike(a, b, STRIKE.swapLife, 0, -1);
    // he drops first, you a beat after (so you don't meet in the middle)
    h.enemies.launch(t, new THREE.Vector3(0, -8, 0));
    const pb = h.playerBody();
    pb.vel.set(0, -4, 0);
    pb.onGround = false;
    this.swap = { id, t, you: false, him: false };
    return { ok: true, id: 'swap', target: t, at: b.position.clone(), name: 'swap' };
  }

  private fireDash(t: EnemyView | null): StrikeResult {
    const h = this.h;
    const fail = (reason: string): StrikeResult => ({ ok: false, id: 'dash', reason, target: t });
    if (!h.playerGrounded()) return fail('strike.grounded');
    const feet = h.playerFeet();
    const a = floorUnder(h, feet);
    if (!a) return fail('strike.noFloor');
    let b: Frame | null = null;
    let boost = STRIKE.dashSpeed;
    if (t) {
      if (t.pos.y - feet.y > STRIKE.upMax) return fail('strike.tooHigh');
      const back = new THREE.Vector3(feet.x - t.pos.x, 0, feet.z - t.pos.z);
      if (back.lengthSq() < 1e-4) return fail('strike.tooClose');
      back.normalize();
      const tc = t.chest(new THREE.Vector3());
      // in front of him on your side, else off to a side: somewhere with a clear run at him
      for (const ang of [0, 0.7, -0.7, 1.4, -1.4]) {
        const d = back.clone().applyAxisAngle(UP, ang);
        const spot = new THREE.Vector3(t.pos.x + d.x * STRIKE.dashGap, t.pos.y, t.pos.z + d.z * STRIKE.dashGap);
        const f = standingDoor(h, spot, d.clone().negate(), t.pos.y);
        if (!h.world.lineOfSight(f.position, tc)) continue;
        if (f.position.distanceTo(a.position) < 2.5) continue;
        b = f;
        break;
      }
    } else {
      const ray = h.aimRay();
      const hd = new THREE.Vector3(ray.dir.x, 0, ray.dir.z);
      if (hd.lengthSq() < 1e-4) return fail('strike.noRoom');
      hd.normalize();
      const eye = h.playerEye();
      const hit = h.world.raycast(_c.set(feet.x, feet.y + 1.1, feet.z), hd, STRIKE.dashFree + 1, { sight: false });
      const dist = hit ? hit.distance - 1.2 : STRIKE.dashFree;
      if (dist < 4) return fail('strike.noRoom');
      const spot = new THREE.Vector3(feet.x + hd.x * dist, feet.y, feet.z + hd.z * dist);
      if (h.world.lineOfSight(eye, _b.set(spot.x, feet.y + 1.2, spot.z))) {
        b = standingDoor(h, spot, hd, feet.y);
        // (never above where you stand: height is earned)
        if (b.position.y - b.height / 2 > feet.y + 0.3) b = null;
      }
      boost = 18;
    }
    if (!b) return fail('gate.noSpace');
    const id = h.rifts.openStrike(a, b, STRIKE.dashLife, boost, -1);
    const ends = h.rifts.strikeEnds(id)!;
    ends.a.boost = 0;
    const pb = h.playerBody();
    pb.vel.set(0, -5, 0);
    pb.onGround = false;
    this.dash = { id };
    return { ok: true, id: 'dash', target: t, at: b.position.clone(), name: 'dash' };
  }
}
