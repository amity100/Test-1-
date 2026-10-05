import * as THREE from 'three';
import type { V3 } from '../core/contracts';
import type { CollisionWorld } from '../world/collision';
import { AIMP, notices, turnToward, yawTo } from '../game/aimportal';
import { RedPortals, arrive, type RedPortal } from './reachai';
import { muzzleOf } from './behaviors';
import type { Enemy } from './enemy';
import type { EnemySystem } from './enemies';

/**
 * AIM PORTAL's enemy side (DESIGN §14): three men, each wants a different
 * answer.
 *
 * - GUNNER: a rifle. Hides behind cover, peeks, a red laser (0.5 s), a burst of
 *   three. He notices a portal opening in front of him and may fire into it:
 *   the rounds come out of your near twin (the laser shows the way).
 * - MIRROR: a vertical portal-shield 1.5 m in front of him eats every round
 *   (30% come back at you) and blocks the knife. He turns it toward the last
 *   one who hurt him at 140°/s: a quick flank is faster. He walks at you and
 *   bashes up close. A portal behind him, a pull and a throw all work.
 * - RUSHER: a knife. Runs along the floor, a red wind-up (0.45 s), a blow;
 *   from afar he sometimes steps through a red portal of his own (0.5 s of
 *   warning) to come out next to you.
 */

/** Your pair as they see it. */
export interface AimAIPortal {
  /** Changes with every new pair. */
  id: number;
  /** The exit's centre and which way it looks (flat unit). */
  far: V3;
  farLook: V3;
  /** The near twin's centre. */
  near: V3;
  /** He has noticed it. */
  noticed(id: number): boolean;
  /** Where `p` (you, by the near twin) is, seen through the exit (aim there to hit it through the exit). */
  through(p: V3, out: THREE.Vector3): THREE.Vector3;
}

export interface AimAIHost {
  readonly world: CollisionWorld;
  readonly portals: RedPortals;
  /** The fight is on (after GO): before it nobody moves. */
  go(): boolean;
  player(): { pos: V3; chest: V3; eye: V3; alive: boolean; safe: boolean };
  /** Your pair (null: none open). */
  pair(): AimAIPortal | null;
  /** Solid floor to stand on at (x, z) about level `y`: its top, else null. */
  standAt(x: number, z: number, y: number): number | null;
  laser(e: Enemy, from: V3, to: V3, t01: number): void;
  fireBolt(e: Enemy, from: V3, dir: V3): void;
  windup(e: Enemy, secs: number): void;
  melee(e: Enemy, damage: number, push: V3): void;
  /** One of his red portals opened. */
  opened(at: V3): void;
}

type Role = 'gunner' | 'mirror' | 'rusher';

class Mind {
  role: Role = 'gunner';
  react: number;
  gun: 'idle' | 'aim' | 'fire' = 'idle';
  gunT = 0;
  shots = 0;
  /** Gunner: where he is going and what he does there. */
  mode: 'advance' | 'hide' | 'peek' = 'advance';
  readonly spot = new THREE.Vector3();
  hasSpot = false;
  modeT = 0;
  intoPortal = false;
  winId = -1;
  winT = 0;
  /** Melee wind-up (s; -1: none) and cooldown. */
  windT = -1;
  meleeCd = 0;
  portalCd: number;
  portalId = -1;
  /** Not getting anywhere (s) and where he was. */
  stuckT = 0;
  readonly lastAt = new THREE.Vector3();
  /** Seconds walking to his cover (a spot he cannot reach is dropped). */
  walkT = 0;
  /** Out of sight of you this long (s): a man up on a platform with no line to you comes down. */
  blindT = 0;
  /** Mirror: where he turns his shield (the last one to hurt him, else you) and until when (game time). */
  readonly turnTo = new THREE.Vector3();
  turnUntil = -1;
  side = 1;
  constructor(rand: () => number) {
    const [a, b] = AIMP.enemy.react;
    this.react = a + (b - a) * rand();
    this.portalCd = 0.8 + rand() * 1.4;
    this.side = rand() < 0.5 ? -1 : 1;
  }
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _through = new THREE.Vector3();

const hd = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.z - b.z);
const between = (r: readonly [number, number], k: number) => r[0] + (r[1] - r[0]) * k;

export class AimAI {
  private minds = new Map<number, Mind>();
  /** When the last red portal opened (game time). */
  private lastPortalT = -99;
  /** When a gun last began its laser (game time). */
  private lastAimT = -99;

  constructor(readonly host: AimAIHost) {}

  reset() {
    this.minds.clear();
    this.lastPortalT = -99;
    this.lastAimT = -99;
  }

  mind(e: Enemy, rand: () => number): Mind {
    let m = this.minds.get(e.id);
    if (!m) {
      this.minds.set(e.id, (m = new Mind(rand)));
      m.role = e.aim ?? 'gunner';
    }
    return m;
  }

  /** A gun is on you (or on your portal): the laser, the burst. */
  aiming(id: number): boolean {
    const m = this.minds.get(id);
    return !!m && m.gun !== 'idle';
  }

  /**
   * Someone hurt (or shot at) him from `from`. The mirror turns his shield toward
   * where it came from: a round through a portal comes out of the exit, so the
   * shield goes there a moment (a flank is a different side); one straight from you
   * is you, and he keeps tracking you.
   */
  attacked(e: Enemy, from: V3, now: number, viaPortal = false) {
    const m = this.minds.get(e.id);
    if (!m) return;
    if (!viaPortal) {
      m.turnUntil = -1;
      return;
    }
    m.turnTo.set(from.x, from.y, from.z);
    m.turnUntil = now + 1.5;
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
    e.reachPose = m.role === 'gunner' ? (m.gun !== 'idle' ? 1 : 0.55) : 0;
    if (!H.go()) {
      sys.halt(e, dt);
      if (m.role === 'mirror') e.yaw = turnToward(e.yaw, yawTo(e.pos, pl.pos), dt, AIMP.enemy.mirror.turn);
      else sys.face(e, pl.pos, dt);
      return;
    }
    m.meleeCd -= dt;
    m.portalCd -= dt;
    // up on a platform with no line to you for a while: he jumps down toward you (a platform is no fortress)
    if (e.pos.y > 2.5 && e.body && !e.body.simulate) {
      m.blindT = pl.alive && this.sees(e, pl.chest, 80) ? 0 : m.blindT + dt;
      if (m.blindT > 4) {
        m.blindT = 0;
        const d = Math.max(1, hd(e.pos, pl.pos));
        sys.launch(e, _a.set(((pl.pos.x - e.pos.x) / d) * 4.5, 3.5, ((pl.pos.z - e.pos.z) / d) * 4.5));
        return;
      }
    }
    if (m.role === 'gunner') this.gunner(sys, e, m, dt);
    else if (m.role === 'mirror') this.mirror(sys, e, m, dt);
    else this.rusher(sys, e, m, dt);
  }

  private sees(e: Enemy, p: V3, range = 80) {
    e.eye(_eye);
    return _eye.distanceTo(p) <= range && this.host.world.lineOfSight(_eye, p);
  }

  private muzzle(e: Enemy, out: THREE.Vector3) {
    return muzzleOf(e, out);
  }

  /**
   * He has noticed your pair: he turns to it for a beat and a gunner may fire
   * into the exit (the rounds come out of the near twin, at you).
   */
  private reactPortal(sys: EnemySystem, e: Enemy, m: Mind, dt: number): boolean {
    const H = this.host;
    const w = H.pair();
    if (!w || !w.noticed(e.id)) {
      if (m.intoPortal) {
        m.intoPortal = false;
        m.gun = 'idle';
      }
      m.winId = -1;
      return false;
    }
    if (m.winId !== w.id) {
      m.winId = w.id;
      m.winT = 0;
      m.intoPortal = false;
    }
    m.winT += dt;
    const pl = H.player();
    const R = AIMP.enemy.gunner;
    if (m.role === 'gunner' && pl.alive && !pl.safe) {
      if (!m.intoPortal) {
        if (m.gun !== 'idle' || m.winT > AIMP.notice.react) return false;
        // (some of them fire into it; the others just watch it)
        if (m.winT < 0.05) m.shots = sys.rand() < R.intoPortal ? 1 : 0;
        if (!m.shots) {
          sys.halt(e, dt);
          sys.face(e, w.far, dt);
          return true;
        }
        m.intoPortal = true;
        m.gun = 'aim';
        m.gunT = R.aim;
      }
      sys.halt(e, dt);
      sys.face(e, w.far, dt);
      this.muzzle(e, _a);
      const aimAt = w.through(pl.chest, _through);
      if (m.gun === 'aim') {
        m.gunT -= dt;
        const k = 1 - Math.max(0, m.gunT) / R.aim;
        H.laser(e, _a, aimAt, k);
        H.laser(e, w.near, pl.chest, k);
        if (m.gunT <= 0) {
          m.gun = 'fire';
          m.shots = R.shots;
          m.gunT = 0;
        }
        return true;
      }
      if (m.gun === 'fire') {
        m.gunT -= dt;
        if (m.gunT <= 0 && m.shots > 0) {
          _b.subVectors(aimAt, _a).normalize();
          H.fireBolt(e, _a, _b);
          e.char.play('shoot', { fade: 0.04 });
          m.shots--;
          m.gunT = R.gap;
        }
        if (m.shots <= 0) {
          m.gun = 'idle';
          m.intoPortal = false;
          m.gunT = between(R.rest, sys.rand());
          m.winT = AIMP.notice.react;
        }
        return true;
      }
      m.intoPortal = false;
      return false;
    }
    // anyone else: turned to it, on guard, for a beat
    if (m.winT > AIMP.notice.react || m.windT >= 0 || m.gun !== 'idle') return false;
    sys.halt(e, dt);
    if (m.role === 'mirror') e.yaw = turnToward(e.yaw, yawTo(e.pos, w.far), dt, AIMP.enemy.mirror.turn);
    else sys.face(e, w.far, dt);
    return true;
  }

  // ------------------------------------------------------------------
  // The gunner
  // ------------------------------------------------------------------

  /** A spot out of your sight (cover), nearest him, within reach of the fight; null if none found. */
  private findCover(sys: EnemySystem, e: Enemy, out: THREE.Vector3): boolean {
    const H = this.host;
    const pl = H.player();
    const R = AIMP.enemy.gunner;
    let best = Infinity;
    let found = false;
    for (let k = 0; k < 14; k++) {
      const ang = sys.rand() * Math.PI * 2;
      const r = 2.5 + sys.rand() * 7;
      const x = e.pos.x + Math.sin(ang) * r, z = e.pos.z + Math.cos(ang) * r;
      const y = H.standAt(x, z, e.pos.y);
      // (level ground: not the top of a block he cannot walk onto)
      if (y === null || Math.abs(y - e.pos.y) > 0.35) continue;
      const d = Math.hypot(x - pl.pos.x, z - pl.pos.z);
      if (d < R.keep[0] - 1 || d > R.keep[1] + 8) continue;
      _c.set(x, y + 1.35, z);
      if (H.world.lineOfSight(pl.eye, _c)) continue;
      _c.set(x, y + 0.7, z);
      if (H.world.lineOfSight(pl.eye, _c)) continue;
      if (r < best) {
        best = r;
        out.set(x, y, z);
        found = true;
      }
    }
    return found;
  }

  /** A spot near `from` with a clear line to you (to step out and shoot from). */
  private findPeek(sys: EnemySystem, from: V3, out: THREE.Vector3): boolean {
    const H = this.host;
    const pl = H.player();
    const R = AIMP.enemy.gunner;
    let best = Infinity;
    let found = false;
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2 + sys.rand() * 0.3;
      const r = 1 + (k % 3) * 0.9;
      const x = from.x + Math.sin(ang) * r, z = from.z + Math.cos(ang) * r;
      const y = H.standAt(x, z, from.y);
      if (y === null || Math.abs(y - from.y) > 0.35) continue;
      _c.set(x, y + 1.4, z);
      if (!H.world.lineOfSight(_c, pl.chest)) continue;
      const d = Math.hypot(x - pl.pos.x, z - pl.pos.z);
      if (d > R.keep[1] + 8) continue;
      if (r < best) {
        best = r;
        out.set(x, y, z);
        found = true;
      }
    }
    return found;
  }

  private gunner(sys: EnemySystem, e: Enemy, m: Mind, dt: number) {
    const H = this.host;
    const pl = H.player();
    const R = AIMP.enemy.gunner;
    if (m.react > 0) {
      m.react -= dt;
      sys.halt(e, dt);
      sys.face(e, pl.pos, dt);
      return;
    }
    if (this.reactPortal(sys, e, m, dt)) return;
    const d = hd(e.pos, pl.pos);
    const sees = pl.alive && this.sees(e, pl.chest, 70);
    if (m.gun === 'aim') {
      sys.halt(e, dt);
      sys.face(e, pl.pos, dt);
      m.gunT -= dt;
      if (!sees) {
        m.gun = 'idle';
        m.gunT = 0.4;
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
        this.muzzle(e, _a);
        _b.subVectors(pl.chest, _a).normalize();
        _b.x += (sys.rand() - 0.5) * 2 * R.spread;
        _b.y += (sys.rand() - 0.5) * 2 * R.spread;
        _b.z += (sys.rand() - 0.5) * 2 * R.spread;
        H.fireBolt(e, _a, _b.normalize());
        e.char.play('shoot', { fade: 0.04 });
        m.shots--;
        m.gunT = R.gap;
      }
      if (m.shots <= 0) {
        m.gun = 'idle';
        m.gunT = between(R.rest, sys.rand());
        // after a burst: back to cover
        m.mode = 'hide';
        m.hasSpot = false;
        m.modeT = between(R.hide, sys.rand());
      }
      return;
    }
    m.gunT -= dt;
    m.modeT -= dt;
    // out of the fight (far, or no line to you and no cover found): he closes in
    if (m.mode === 'advance') {
      // (standing still out of your sight for long: he looks for cover somewhere else)
      m.stuckT = hd(e.pos, m.lastAt) < 0.3 && !sees ? m.stuckT + dt : 0;
      if (m.stuckT === 0) m.lastAt.copy(e.pos);
      if (m.stuckT > 3) {
        m.stuckT = 0;
        m.mode = 'hide';
        m.hasSpot = false;
        m.modeT = 0.5;
        return;
      }
      if (sees && d <= R.keep[1] && m.gunT <= 0) {
        this.beginAim(m, pl, sys);
        return;
      }
      if (d > R.keep[0] + 2 || !sees) sys.moveTo(e, pl.pos, R.run, dt, true);
      else {
        sys.halt(e, dt);
        sys.face(e, pl.pos, dt);
      }
      // (a beat after he first sees you he goes looking for cover)
      if (sees && m.modeT <= 0) {
        m.mode = 'hide';
        m.hasSpot = false;
        m.modeT = 0;
      }
      if (m.modeT === 0 && m.mode === 'advance') m.modeT = 0.8;
      return;
    }
    if (m.mode === 'hide') {
      if (!m.hasSpot) {
        m.hasSpot = this.findCover(sys, e, m.spot);
        if (!m.hasSpot) {
          // no cover near: keep his distance and fight in the open
          m.mode = 'advance';
          m.modeT = 1.5;
          return;
        }
      }
      if (hd(e.pos, m.spot) > 0.8) {
        sys.moveTo(e, m.spot, R.run, dt, true);
        if (m.modeT < 0.6) m.modeT = 0.6;
        // (no way there for too long: forget that spot and come on)
        m.walkT += dt;
        if (m.walkT > 3.5) {
          m.walkT = 0;
          m.hasSpot = false;
          m.mode = 'advance';
          m.modeT = 1.2;
        }
        return;
      }
      m.walkT = 0;
      sys.halt(e, dt);
      sys.face(e, pl.pos, dt);
      if (m.modeT <= 0) {
        // step out: a spot by the cover with a line to you
        m.mode = 'peek';
        m.hasSpot = this.findPeek(sys, e.pos, m.spot);
        m.modeT = 2.5;
      }
      return;
    }
    // peek
    if (!m.hasSpot || m.modeT <= 0) {
      m.mode = 'advance';
      m.modeT = 0.5;
      return;
    }
    if (hd(e.pos, m.spot) > 0.6) {
      sys.moveTo(e, m.spot, R.run, dt, true);
      return;
    }
    sys.halt(e, dt);
    sys.face(e, pl.pos, dt);
    if (sees && pl.alive && !pl.safe && this.shooters() < R.maxShooters) this.beginAim(m, pl, sys);
    else if (!sees) m.modeT -= dt * 2;
  }

  private beginAim(m: Mind, pl: { alive: boolean; safe: boolean }, sys: EnemySystem) {
    // (two guns at most on you, and never two laser locks at the same moment: a gap between volleys)
    if (!pl.alive || pl.safe || this.shooters() >= AIMP.enemy.gunner.maxShooters || sys.time - this.lastAimT < AIMP.enemy.gunner.volleyGap) return;
    this.lastAimT = sys.time;
    m.gun = 'aim';
    m.gunT = AIMP.enemy.gunner.aim + sys.rand() * 0.1;
  }

  // ------------------------------------------------------------------
  // The mirror
  // ------------------------------------------------------------------

  private mirror(sys: EnemySystem, e: Enemy, m: Mind, dt: number) {
    const H = this.host;
    const pl = H.player();
    const M = AIMP.enemy.mirror;
    if (m.react > 0) {
      m.react -= dt;
      e.yaw = turnToward(e.yaw, yawTo(e.pos, pl.pos), dt, M.turn);
      sys.halt(e, dt);
      return;
    }
    // his shield: toward the last one who hurt him, else you
    const now = sys.time;
    const at = now < m.turnUntil ? m.turnTo : pl.pos;
    e.yaw = turnToward(e.yaw, yawTo(e.pos, at), dt, M.turn);
    if (this.reactPortal(sys, e, m, dt)) return;
    const d = hd(e.pos, pl.pos);
    if (m.windT >= 0) {
      m.windT += dt;
      sys.halt(e, dt);
      if (m.windT >= M.bash.windup) {
        m.windT = -1;
        m.meleeCd = M.bash.cooldown;
        e.char.play('strike', { fade: 0.05 });
        const dy = Math.abs(pl.pos.y - e.pos.y);
        const yawToP = yawTo(e.pos, pl.pos);
        let off = yawToP - e.yaw;
        while (off > Math.PI) off -= Math.PI * 2;
        while (off < -Math.PI) off += Math.PI * 2;
        if (pl.alive && !pl.safe && d <= M.bash.reach + 0.5 && Math.abs(off) < Math.PI / 2.2 && dy < 1.6) {
          _a.set(Math.sin(yawToP) * M.bash.push, 2.2, Math.cos(yawToP) * M.bash.push);
          H.melee(e, M.bash.damage, _a);
        }
      }
      return;
    }
    if (d <= M.bash.reach && m.meleeCd <= 0 && pl.alive) {
      m.windT = 0;
      H.windup(e, M.bash.windup);
      return;
    }
    if (d > M.bash.reach - 0.3) sys.moveTo(e, pl.pos, M.speed, dt, false);
    else sys.halt(e, dt);
  }

  // ------------------------------------------------------------------
  // The rusher
  // ------------------------------------------------------------------

  private rusher(sys: EnemySystem, e: Enemy, m: Mind, dt: number) {
    const H = this.host;
    const pl = H.player();
    const K = AIMP.enemy.rusher;
    if (m.react > 0) {
      m.react -= dt;
      sys.halt(e, dt);
      sys.face(e, pl.pos, dt);
      return;
    }
    // through a red portal of his own
    if (m.portalId >= 0) {
      this.portalWalk(sys, e, m, dt);
      return;
    }
    if (this.reactPortal(sys, e, m, dt)) return;
    const d = hd(e.pos, pl.pos);
    const gap = Math.abs(pl.pos.y - e.pos.y) >= 1.6;
    if (m.windT >= 0) {
      m.windT += dt;
      sys.halt(e, dt);
      if (m.windT < K.windup - 0.15) sys.face(e, pl.pos, dt);
      if (m.windT >= K.windup) {
        m.windT = -1;
        m.meleeCd = K.cooldown;
        e.char.play('strike', { fade: 0.05 });
        const yawToP = yawTo(e.pos, pl.pos);
        let off = yawToP - e.yaw;
        while (off > Math.PI) off -= Math.PI * 2;
        while (off < -Math.PI) off += Math.PI * 2;
        if (pl.alive && !pl.safe && d <= K.hit && Math.abs(off) < Math.PI / 3 && Math.abs(pl.pos.y - e.pos.y) < 1.6) {
          _a.set(Math.sin(yawToP) * K.push, 2.5, Math.cos(yawToP) * K.push);
          H.melee(e, K.damage, _a);
        }
      }
      return;
    }
    if (d <= K.reach && m.meleeCd <= 0 && pl.alive && !gap) {
      m.windT = 0;
      H.windup(e, K.windup);
      return;
    }
    // from afar (or no way down to you): a red portal right by you
    if (m.portalCd <= 0 && (d > K.portalFrom || gap)) {
      m.portalCd = gap ? 0.8 : 2;
      if ((gap || sys.rand() < K.portalChance) && this.openPortal(sys, e, m)) return;
    }
    if (d <= K.reach && !gap) {
      sys.halt(e, dt);
      sys.face(e, pl.pos, dt);
      return;
    }
    sys.moveTo(e, pl.pos, K.run, dt, true);
  }

  /** A pair of his: its entrance just ahead of him, its exit `near` m from you on floor you could stand on. */
  private openPortal(sys: EnemySystem, e: Enemy, m: Mind): boolean {
    const H = this.host;
    const pl = H.player();
    const K = AIMP.enemy.rusher;
    if (H.portals.list.length || sys.time - this.lastPortalT < K.portalGap) return false;
    const base = Math.atan2(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z);
    let exit: THREE.Vector3 | null = null;
    for (const off of [0.9, -0.9, 0.4, -0.4, 1.6, -1.6, 0]) {
      const ang = base + off * m.side;
      const x = pl.pos.x + Math.sin(ang) * K.near, z = pl.pos.z + Math.cos(ang) * K.near;
      const y = H.standAt(x, z, pl.pos.y);
      if (y === null) continue;
      _c.set(x, y, z);
      _eye.set(x, y + 1.5, z);
      if (!H.world.lineOfSight(_eye, pl.chest)) continue;
      exit = _c.clone();
      break;
    }
    if (!exit) return false;
    const to = Math.atan2(pl.pos.x - e.pos.x, pl.pos.z - e.pos.z);
    let yawIn = to, ax = 0, az = 0, ay: number | null = null;
    for (const off of [0, 0.9, -0.9, 1.8, -1.8, Math.PI]) {
      yawIn = to + off;
      ax = e.pos.x + Math.sin(yawIn) * K.ahead;
      az = e.pos.z + Math.cos(yawIn) * K.ahead;
      ay = H.standAt(ax, az, e.pos.y);
      if (ay !== null) break;
    }
    if (ay === null) return false;
    const by = Math.atan2(pl.pos.x - exit.x, pl.pos.z - exit.z);
    const p = H.portals.open(e.id, _a.set(ax, ay, az), yawIn, exit, by);
    this.lastPortalT = sys.time;
    m.portalId = p.id;
    H.opened(exit);
    e.char.play('interact', { fade: 0.08 });
    return true;
  }

  private walk(sys: EnemySystem, e: Enemy, to: V3, d: number, speed: number, dt: number) {
    const b = e.body;
    if (d > 2.5 || !b || b.simulate) {
      sys.moveTo(e, to, speed, dt, true);
      return;
    }
    const k = speed / Math.max(d, 1e-3);
    e.moveVel.set((to.x - e.pos.x) * k, 0, (to.z - e.pos.z) * k);
    b.vel.set(e.moveVel.x, 0, e.moveVel.z);
    sys.face(e, to, dt);
  }

  private portalWalk(sys: EnemySystem, e: Enemy, m: Mind, dt: number) {
    const K = AIMP.enemy.rusher;
    const p: RedPortal | null = this.host.portals.get(m.portalId);
    if (!p || p.crossedT >= 0) {
      m.portalId = -1;
      return;
    }
    const d = hd(e.pos, p.a);
    if (!RedPortals.isOpen(p)) {
      if (d > 1.3) this.walk(sys, e, p.a, d, 2.8, dt);
      else {
        sys.halt(e, dt);
        sys.face(e, _a.copy(p.a).addScaledVector(_b.set(Math.sin(p.ay), 0, Math.cos(p.ay)), 2), dt);
      }
      return;
    }
    if (d > 0.8) {
      this.walk(sys, e, p.a, d, K.run, dt);
      return;
    }
    arrive(sys, e, p);
    m.portalId = -1;
    m.meleeCd = Math.min(m.meleeCd, 0.2);
  }
}

/** Does a man at `e` notice a pair opened with its exit at `p` (front cone, near, in sight)? */
export function seesExit(world: Pick<CollisionWorld, 'lineOfSight'>, e: Enemy, p: V3): boolean {
  e.eye(_d);
  return notices(_d, e.yaw, p) && world.lineOfSight(_d, p);
}
