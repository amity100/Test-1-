import * as THREE from 'three';
import type { V3 } from '../core/contracts';
import type { CollisionWorld } from '../world/collision';
import { Hands, REACH, windowSpot } from '../game/reach';
import { Armory, type Weapon } from '../game/weapons';
import type { Enemy } from './enemy';
import type { EnemySystem } from './enemies';

/**
 * REACH's enemy side (DESIGN §14): men who start each wave empty-handed and
 * race you for the weapons on the floor with red windows of their own, steal
 * yours, shoot (the bolts everyone knows) or come at you with a knife, and
 * open RED PORTALS to charge or flank you. Every one of their portals opens
 * REACH.enemy.portal.telegraph s before they step in, so you can see it
 * coming and take it off them (your hand holds it; its exit goes where you
 * aim: the void, the pool, your knife).
 */

/** One red portal: the entrance by its owner, the exit where he means to come out. */
export interface RedPortal {
  readonly id: number;
  readonly owner: number;
  /** Entrance (feet) and the way he walks into it. */
  readonly a: THREE.Vector3;
  ay: number;
  /** Exit (feet) and the way he comes out of it. */
  readonly b: THREE.Vector3;
  by: number;
  /** Seconds since it opened (it's open from REACH.enemy.portal.telegraph on). */
  t: number;
  /** Your hand has it: its exit follows your aim, he waits at his end. */
  held: boolean;
  /** You let go of it somewhere: whoever goes through tumbles out there. */
  redirected: boolean;
  /** When he went through (its t; -1: not yet). */
  crossedT: number;
  /** Shut. */
  dead: boolean;
}

export class RedPortals {
  readonly list: RedPortal[] = [];
  private next = 1;

  open(owner: number, a: V3, ay: number, b: V3, by: number): RedPortal {
    const p: RedPortal = { id: this.next++, owner, a: new THREE.Vector3().copy(a), ay, b: new THREE.Vector3().copy(b), by, t: 0, held: false, redirected: false, crossedT: -1, dead: false };
    this.list.push(p);
    return p;
  }

  get(id: number): RedPortal | null {
    for (const p of this.list) if (p.id === id && !p.dead) return p;
    return null;
  }

  static isOpen(p: RedPortal) {
    return !p.dead && p.t >= REACH.enemy.portal.telegraph;
  }

  /** Your hand takes it (only before he's through). */
  grab(p: RedPortal): boolean {
    if (p.dead || p.crossedT >= 0) return false;
    p.held = true;
    return true;
  }

  /** While held: its exit where your aim is. */
  aim(p: RedPortal, spot: V3, yaw: number) {
    p.b.copy(spot);
    p.by = yaw;
  }

  /** Let go: the exit stays where it is now. */
  release(p: RedPortal) {
    if (!p.held) return;
    p.held = false;
    p.redirected = true;
  }

  clear() {
    this.list.length = 0;
  }

  /** `alive(owner)`: can he still use it. */
  update(dt: number, alive: (owner: number) => boolean) {
    const P = REACH.enemy.portal;
    for (let i = 0; i < this.list.length; ) {
      const p = this.list[i];
      p.t += dt;
      if (p.crossedT >= 0 ? p.t - p.crossedT > P.after : !p.held && (p.t > P.life || (!alive(p.owner) && p.t > P.telegraph + 0.6))) p.dead = true;
      if (p.dead) this.list.splice(i, 1);
      else i++;
    }
  }
}

/**
 * He goes through `p`: out of its exit. Redirected (you moved it), he tumbles
 * out: over the void or the pool, that's the end of him.
 */
export function arrive(sys: Pick<EnemySystem, 'launch'>, e: Enemy, p: RedPortal) {
  const b = e.body;
  p.crossedT = p.t;
  if (!b) return;
  const P = REACH.enemy.portal;
  b.pos.copy(p.b);
  e.yaw = p.by;
  e.char.root.position.copy(p.b);
  e.moveVel.set(0, 0, 0);
  e.hasGoal = false;
  e.pathLen = 0;
  e.grid = null;
  if (p.redirected) sys.launch(e, new THREE.Vector3(Math.sin(p.by) * P.outSpeed, P.outUp, Math.cos(p.by) * P.outSpeed));
  else b.vel.set(0, 0, 0);
}

/** What the enemy side needs from the game. */
export interface ReachAIHost {
  readonly armory: Armory;
  readonly hands: Hands;
  readonly portals: RedPortals;
  readonly world: CollisionWorld;
  /** The fight is on (GO): before it nobody moves. */
  go(): boolean;
  player(): { pos: V3; chest: V3; hand: V3; alive: boolean; safe: boolean };
  /** Solid floor to stand on at (x, z) about level `y` (not the void, not the pool, no wall in the way): its top, else null. */
  standAt(x: number, z: number, y: number): number | null;
  /** His red laser (a burst coming), 0..1. */
  laser(e: Enemy, from: V3, to: V3, t01: number): void;
  fireBolt(e: Enemy, from: V3, dir: V3): void;
  /** A knife blow is coming (red), this long. */
  windup(e: Enemy, secs: number): void;
  /** His blow landed on you. */
  melee(e: Enemy, damage: number, push: V3): void;
  /** One of his red windows / portals opened (sound, light). */
  opened(kind: 'window' | 'steal' | 'portal', at: V3): void;
  /** He dropped his spent rifle (sound). */
  discarded(e: Enemy, w: Weapon): void;
}

/** A man's mind under REACH. */
class Mind {
  /** Seconds before his next move (a human beat). */
  react: number;
  stealCd: number;
  portalCd: number;
  /** His own portal under way (-1: none). */
  portalId = -1;
  gun: 'idle' | 'aim' | 'fire' = 'idle';
  gunT = 0;
  shots = 0;
  /** A knife blow winding up (s; -1: none). */
  windT = -1;
  meleeCd = 0;
  /** Where he's walking to while he waits for a shot (a rifle keeps moving). */
  readonly spot = new THREE.Vector3();
  spotT = 0;
  side = 1;
  constructor(rand: () => number) {
    const E = REACH.enemy;
    this.react = E.react[0] + (E.react[1] - E.react[0]) * rand();
    this.stealCd = 1 + rand() * 2;
    this.portalCd = 1.5 + rand() * 2;
    this.side = rand() < 0.5 ? -1 : 1;
  }
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _eye = new THREE.Vector3();

const hd = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.z - b.z);
const between = (r: readonly [number, number], k: number) => r[0] + (r[1] - r[0]) * k;

/**
 * The brain of every REACH man (EnemySystem asks it instead of the usual
 * combat for men spawned with `def.reach`). One decision at a time, each
 * after a human beat, so a quick player wins the races.
 */
export class ReachAI {
  private minds = new Map<number, Mind>();

  constructor(readonly host: ReachAIHost) {}

  reset() {
    this.minds.clear();
  }

  mind(e: Enemy, rand: () => number): Mind {
    let m = this.minds.get(e.id);
    if (!m) this.minds.set(e.id, (m = new Mind(rand)));
    return m;
  }

  /** He just lost his weapon (stolen, spent): a beat before he goes for another. */
  disarmed(e: Enemy, rand: () => number) {
    const m = this.minds.get(e.id);
    if (!m) return;
    m.react = between(REACH.enemy.react, rand()) * 0.8;
    m.gun = 'idle';
    m.windT = -1;
  }

  /** Guns on you right now (aiming or firing). */
  private shooters(): number {
    let n = 0;
    for (const m of this.minds.values()) if (m.gun !== 'idle') n++;
    return n;
  }

  think(sys: EnemySystem, e: Enemy, dt: number) {
    const H = this.host;
    const m = this.mind(e, () => sys.rand());
    const pl = H.player();
    const held = H.armory.heldBy(e.id);
    e.reachPose = held?.kind === 'rifle' ? (m.gun !== 'idle' ? 1 : 0.55) : 0;
    if (!H.go()) {
      sys.halt(e, dt);
      sys.face(e, pl.pos, dt);
      return;
    }
    m.stealCd -= dt;
    m.portalCd -= dt;
    m.meleeCd -= dt;
    // through a portal of his own
    if (m.portalId >= 0) {
      this.portalWalk(sys, e, m, dt);
      return;
    }
    // a window of his own is open: he waits on his hand
    const win = H.hands.of(e.id);
    if (win) {
      sys.halt(e, dt);
      sys.face(e, win.at, dt);
      return;
    }
    if (!held) return this.unarmed(sys, e, m, dt);
    if (held.kind === 'rifle') return this.rifle(sys, e, m, held, dt);
    return this.knife(sys, e, m, dt);
  }

  /** Where his rounds leave from: the rifle in his hand. */
  private muzzle(e: Enemy, out: THREE.Vector3) {
    if (e.char.heldMuzzle) return e.char.heldMuzzle(out);
    return e.chest(out).addScaledVector(e.forward(_c), 0.5);
  }

  private sees(e: Enemy, p: V3, range = REACH.range) {
    e.eye(_eye);
    return _eye.distanceTo(p) <= range && this.host.world.lineOfSight(_eye, p);
  }

  // ------------------------------------------------------------------
  // Empty-handed: the race
  // ------------------------------------------------------------------

  private unarmed(sys: EnemySystem, e: Enemy, m: Mind, dt: number) {
    const H = this.host;
    const pl = H.player();
    m.gun = 'idle';
    m.windT = -1;
    // the nearest weapon worth having, his goal while he thinks
    let best: Weapon | null = null;
    let bd = Infinity;
    for (const w of H.armory.free()) {
      if (!w.resting) continue;
      const d = e.pos.distanceTo(w.pos);
      if (d < bd) {
        bd = d;
        best = w;
      }
    }
    m.react -= dt;
    if (m.react > 0) {
      // (thinking: he turns to it, or to you)
      sys.halt(e, dt);
      sys.face(e, best ? best.pos : pl.pos, dt);
      return;
    }
    // yours, if you have one and he has you in sight
    const yours = H.armory.heldBy('player');
    if (yours && pl.alive && !pl.safe && m.stealCd <= 0) {
      if (this.sees(e, pl.hand) && sys.rand() < REACH.enemy.steal.chance) {
        this.steal(e, m, yours, sys.rand());
        return;
      }
      m.stealCd = 1.2;
    }
    if (best && bd <= REACH.range + 1 && this.sees(e, best.pos)) {
      if (H.armory.claim(best, e.id)) {
        e.eye(_eye);
        windowSpot(_eye, best.pos, _a, _b);
        H.hands.open({ owner: e.id, kind: 'snatch', at: _a, dir: _b, weapon: best });
        H.opened('window', _a);
        e.char.play('interact', { fade: 0.08 });
        m.react = between(REACH.enemy.regrab, sys.rand());
        return;
      }
    }
    if (best) {
      sys.moveTo(e, best.pos, REACH.enemy.run, dt, true);
      m.react = 0.2;
      return;
    }
    // nothing on the floor: he keeps you in sight, waiting for his chance at yours
    if (hd(e.pos, pl.pos) > 12) sys.moveTo(e, pl.pos, REACH.enemy.run * 0.7, dt, true);
    else {
      sys.halt(e, dt);
      sys.face(e, pl.pos, dt);
    }
    m.react = 0.3;
  }

  /** His red window by your hand: REACH.enemy.steal.telegraph s to get away. */
  private steal(e: Enemy, m: Mind, w: Weapon, k: number) {
    const H = this.host;
    const pl = H.player();
    const S = REACH.enemy.steal;
    e.eye(_eye);
    // beside your hand, on his side of you
    _b.subVectors(pl.hand, _eye).setY(0).normalize();
    _a.copy(pl.hand).addScaledVector(_b, -0.55);
    _a.y += 0.15;
    H.hands.open({ owner: e.id, kind: 'steal', at: _a, dir: _b, weapon: w, tele: S.telegraph });
    H.opened('steal', _a);
    e.char.play('interact', { fade: 0.08 });
    m.stealCd = between(S.cooldown, k);
    m.react = 0.3;
  }

  // ------------------------------------------------------------------
  // A rifle
  // ------------------------------------------------------------------

  private rifle(sys: EnemySystem, e: Enemy, m: Mind, w: Weapon, dt: number) {
    const H = this.host;
    const pl = H.player();
    const R = REACH.enemy.rifle;
    const d = hd(e.pos, pl.pos);
    if (w.ammo <= 0) {
      // spent: it goes, and he goes for another
      H.armory.drop(w, _a.copy(e.pos).setY(e.pos.y + 1.1), _b.set(Math.sin(e.yaw) * 1.5, 2, Math.cos(e.yaw) * 1.5));
      H.discarded(e, w);
      m.gun = 'idle';
      m.react = between(REACH.enemy.regrab, sys.rand());
      return;
    }
    const sees = pl.alive && this.sees(e, pl.chest, 60);
    if (m.gun === 'aim') {
      sys.halt(e, dt);
      sys.face(e, pl.pos, dt);
      m.gunT -= dt;
      if (!sees) {
        m.gun = 'idle';
        m.gunT = 0.5;
        return;
      }
      this.muzzle(e, _a);
      H.laser(e, _a, pl.chest, 1 - Math.max(0, m.gunT) / R.aim);
      if (m.gunT <= 0) {
        m.gun = 'fire';
        m.shots = R.shots;
        m.gunT = 0;
      }
      return;
    }
    if (m.gun === 'fire') {
      sys.halt(e, dt);
      sys.face(e, pl.pos, dt);
      m.gunT -= dt;
      if (m.gunT <= 0 && m.shots > 0) {
        if (H.armory.fire(w)) {
          this.muzzle(e, _a);
          _b.subVectors(pl.chest, _a).normalize();
          _b.x += (sys.rand() - 0.5) * 2 * R.spread;
          _b.y += (sys.rand() - 0.5) * 2 * R.spread;
          _b.z += (sys.rand() - 0.5) * 2 * R.spread;
          H.fireBolt(e, _a, _b.normalize());
          e.char.play('shoot', { fade: 0.04 });
        }
        m.shots--;
        m.gunT = R.gap;
      }
      if (m.shots <= 0 || w.ammo <= 0) {
        m.gun = 'idle';
        m.gunT = between(R.rest, sys.rand());
      }
      return;
    }
    // between bursts: a flank through a portal now and then
    if (m.portalCd <= 0) {
      m.portalCd = 1.5;
      if (sees && d > 6 && sys.rand() < REACH.enemy.portal.rifleChance && this.openPortal(sys, e, m, REACH.enemy.portal.flank)) return;
    }
    // keep his distance, in sight of you, moving
    m.gunT -= dt;
    m.spotT -= dt;
    const K = REACH.enemy.keep;
    if (!sees || d > K[1] + 3) sys.moveTo(e, pl.pos, REACH.enemy.run * 0.85, dt, true);
    else if (d < K[0]) {
      _a.subVectors(e.pos, pl.pos).setY(0).normalize().multiplyScalar(4).add(e.pos);
      sys.moveTo(e, _a, REACH.enemy.run * 0.8, dt, false);
      sys.face(e, pl.pos, dt);
    } else {
      if (m.spotT <= 0) {
        // a step to one side of his line to you
        _c.subVectors(e.pos, pl.pos).setY(0).normalize();
        m.side = sys.rand() < 0.35 ? -m.side : m.side;
        m.spot.set(e.pos.x - _c.z * 3 * m.side, e.pos.y, e.pos.z + _c.x * 3 * m.side);
        m.spotT = 1.2 + sys.rand();
      }
      sys.moveTo(e, m.spot, 2.4, dt, false);
      sys.face(e, pl.pos, dt);
    }
    if (m.gunT <= 0 && sees && pl.alive && !pl.safe && this.shooters() < R.maxShooters) {
      m.gun = 'aim';
      m.gunT = R.aim;
    }
  }

  // ------------------------------------------------------------------
  // A knife
  // ------------------------------------------------------------------

  private knife(sys: EnemySystem, e: Enemy, m: Mind, dt: number) {
    const H = this.host;
    const pl = H.player();
    const K = REACH.enemy.knife;
    const d = hd(e.pos, pl.pos);
    if (m.windT >= 0) {
      m.windT += dt;
      sys.halt(e, dt);
      // (he tracks you until the last moment, then it's committed)
      if (m.windT < K.windup - 0.15) sys.face(e, pl.pos, dt);
      if (m.windT >= K.windup) {
        m.windT = -1;
        m.meleeCd = K.cooldown;
        e.char.play('strike', { fade: 0.05 });
        const yawTo = Math.atan2(pl.pos.x - e.pos.x, pl.pos.z - e.pos.z);
        let off = yawTo - e.yaw;
        while (off > Math.PI) off -= Math.PI * 2;
        while (off < -Math.PI) off += Math.PI * 2;
        if (pl.alive && !pl.safe && d <= K.hitRange && Math.abs(off) < Math.PI / 3 && Math.abs(pl.pos.y - e.pos.y) < 1.6) {
          _a.set(Math.sin(yawTo) * K.push, 2.5, Math.cos(yawTo) * K.push);
          H.melee(e, K.damage, _a);
        }
      }
      return;
    }
    if (d <= K.reach && m.meleeCd <= 0 && pl.alive && Math.abs(pl.pos.y - e.pos.y) < 1.6) {
      m.windT = 0;
      H.windup(e, K.windup);
      return;
    }
    // from afar: a red portal right by you, now and then
    if (m.portalCd <= 0 && d > REACH.enemy.portal.knifeFrom) {
      m.portalCd = 1.5;
      if (sys.rand() < REACH.enemy.portal.knifeChance && this.openPortal(sys, e, m, REACH.enemy.portal.near)) return;
    }
    if (d <= K.reach) {
      sys.halt(e, dt);
      sys.face(e, pl.pos, dt);
      return;
    }
    sys.moveTo(e, pl.pos, REACH.enemy.knifeRun, dt, true);
  }

  // ------------------------------------------------------------------
  // His red portals
  // ------------------------------------------------------------------

  /** A portal pair: its entrance just ahead of him, its exit `gap` m from you (on solid floor). */
  private openPortal(sys: EnemySystem, e: Enemy, m: Mind, gap: number): boolean {
    const H = this.host;
    const pl = H.player();
    const P = REACH.enemy.portal;
    // the exit: around you, toward his side first, on floor you could stand on
    const base = Math.atan2(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z);
    let exit: THREE.Vector3 | null = null;
    for (const off of [0.9, -0.9, 0.4, -0.4, 1.6, -1.6, 0]) {
      const ang = base + off * m.side;
      const x = pl.pos.x + Math.sin(ang) * gap, z = pl.pos.z + Math.cos(ang) * gap;
      const y = H.standAt(x, z, pl.pos.y);
      if (y === null) continue;
      _c.set(x, y, z);
      // he must come out with you in sight
      _eye.set(x, y + 1.5, z);
      if (!H.world.lineOfSight(_eye, pl.chest)) continue;
      exit = _c.clone();
      break;
    }
    if (!exit) return false;
    // the entrance: in front of him, toward you
    const yawIn = Math.atan2(pl.pos.x - e.pos.x, pl.pos.z - e.pos.z);
    const ax = e.pos.x + Math.sin(yawIn) * P.ahead, az = e.pos.z + Math.cos(yawIn) * P.ahead;
    const ay = H.standAt(ax, az, e.pos.y);
    if (ay === null) return false;
    const by = Math.atan2(pl.pos.x - exit.x, pl.pos.z - exit.z);
    const p = H.portals.open(e.id, _a.set(ax, ay, az), yawIn, exit, by);
    m.portalId = p.id;
    m.portalCd = between(P.cooldown, sys.rand());
    H.opened('portal', exit);
    e.char.play('interact', { fade: 0.08 });
    return true;
  }

  private portalWalk(sys: EnemySystem, e: Enemy, m: Mind, dt: number) {
    const p = this.host.portals.get(m.portalId);
    if (!p || p.crossedT >= 0) {
      m.portalId = -1;
      return;
    }
    const d = hd(e.pos, p.a);
    // he walks up to it while it opens; he waits there while your hand has it
    if (!RedPortals.isOpen(p) || p.held) {
      if (d > 0.9) sys.moveTo(e, p.a, 2.6, dt, true);
      else {
        sys.halt(e, dt);
        sys.face(e, _a.copy(p.a).addScaledVector(_b.set(Math.sin(p.ay), 0, Math.cos(p.ay)), 2), dt);
      }
      return;
    }
    if (d > 0.55) {
      sys.moveTo(e, p.a, REACH.enemy.knifeRun, dt, true);
      return;
    }
    arrive(sys, e, p);
    m.portalId = -1;
    m.meleeCd = Math.min(m.meleeCd, 0.15);
  }
}
