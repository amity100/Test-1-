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
 *
 * Fair beats for the player: a new exit in front of a man's eyes is noticed
 * after 0.35 s, at his side 0.6 s, behind him 0.8 s; and when you vanish and
 * turn up at his side or his back (through your pair) he has lost you for as
 * long (he stops, he doesn't turn to you, he doesn't shoot).
 *
 * THE COMPOUND (the lab's arena of walls): nobody knows where you are but by
 * what he has SEEN or HEARD. A man starts on his post (HOLD), then goes to
 * where he last had you; there nothing: he SEARCHES round it (a few spots, a
 * look at each). 12 s without a sight of you and he gets a hunch (your place,
 * give or take 5 m, again every 4 s): a wave cannot stall. A man who has not
 * had you for a while (7 s) may come round the wall by a red portal of his own:
 * its exit opens BEHIND you (or at your side), 0.5 s of warning, an arrow on
 * the screen's edge when it is out of your view, and he comes through
 * having to turn to you first (a gunner a beat, then his laser).
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
  player(): { pos: V3; chest: V3; eye: V3; alive: boolean; safe: boolean; /** The way you look (flat yaw): a portal behind you opens on its far side. */ yaw?: number };
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
  mode: 'hold' | 'advance' | 'hide' | 'peek' | 'search' = 'hold';
  /** HOLD: seconds he stays on his post, and whether it has been set. */
  holdT = -1;
  /** Where he believes you are, when he last SAW you, when he last had any news of you (game time; -99: never). */
  readonly known = new THREE.Vector3();
  hasKnown = false;
  seenT = -99;
  newsT = -99;
  /** He has had you in sight at least once (else the walls hid you from him from the start). */
  everSeen = false;
  /** When his brain first ran (game time). */
  bornT = 0;
  huntT = 0;
  /** He has you in sight right now (this beat). */
  seesNow = false;
  /** SEARCH: spots round where he thought you were, and the one he is at, and how long he looks. */
  readonly pts: THREE.Vector3[] = [];
  ptI = 0;
  lookT = 0;
  /** Not moved (s) while meaning to, and where he was (the watchdog). */
  idleT = 0;
  readonly idleAt = new THREE.Vector3();
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
  /** When his brain last ran (game time): a gap means he was hit, held or flying: his half-done move is dropped. */
  thinkT = -1;
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
  /** You vanished from where he had you and turned up at his side or his back (through your pair): he has lost you until then (game time). */
  blindUntil = -1;
  readonly lastPl = new THREE.Vector3();
  hasLast = false;
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
    // (a gap since he last thought: he was hit, pulled, thrown: a laser or a wind-up under way is off)
    if (m.thinkT >= 0 && sys.time - m.thinkT > 0.2) {
      m.gun = 'idle';
      m.windT = -1;
      m.intoPortal = false;
      m.portalId = -1;
      if (m.mode === 'peek') m.mode = 'advance';
    }
    m.thinkT = sys.time;
    e.reachPose = m.role === 'gunner' ? (m.gun !== 'idle' ? 1 : 0.55) : 0;
    this.updateIntel(sys, e, m, pl);
    // you were there and now you are here (through your pair), at his side or his back: he has lost you a moment
    if (this.lostYou(sys, e, m, pl.pos)) {
      sys.halt(e, dt);
      m.gun = 'idle';
      m.windT = -1;
      m.intoPortal = false;
      return;
    }
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
      m.blindT = m.seesNow ? 0 : m.blindT + dt;
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

  /** What he knows of you: where he saw you, heard you, or (long without news) has a hunch. */
  private updateIntel(sys: EnemySystem, e: Enemy, m: Mind, pl: { pos: V3; chest: V3; alive: boolean }) {
    const I = AIMP.intel, now = sys.time;
    if (!m.hasKnown) {
      // (the first beat: they know where the fight starts, and stand on their posts a while)
      m.known.set(pl.pos.x, pl.pos.y, pl.pos.z);
      m.hasKnown = true;
      m.seenT = m.newsT = m.bornT = now;
      m.holdT = between(I.hold, sys.rand());
      m.mode = m.role === 'gunner' ? 'hold' : 'advance';
      m.lastAt.copy(e.pos);
      m.idleAt.copy(e.pos);
    }
    m.seesNow = pl.alive && this.sees(e, pl.chest, 80);
    if (m.seesNow) {
      m.known.set(pl.pos.x, pl.pos.y, pl.pos.z);
      m.seenT = m.newsT = now;
      m.everSeen = true;
      return;
    }
    // (a footstep through a wall)
    if (pl.alive && hd(e.pos, pl.pos) < I.hear) {
      m.known.set(pl.pos.x, pl.pos.y, pl.pos.z);
      m.newsT = now;
      return;
    }
    // (no news for a long time: a hunch, your place give or take a few metres, new every few seconds)
    if (pl.alive && now - m.newsT > I.hunch && now >= m.huntT) {
      m.huntT = now + I.every;
      const y0 = pl.pos.y;
      m.known.set(pl.pos.x, y0, pl.pos.z);
      for (let k = 0; k < 6; k++) {
        const a = sys.rand() * Math.PI * 2, r = sys.rand() * I.spread;
        const x = pl.pos.x + Math.sin(a) * r, z = pl.pos.z + Math.cos(a) * r;
        const y = this.host.standAt(x, z, y0);
        if (y !== null && Math.abs(y - y0) < 0.5) {
          m.known.set(x, y, z);
          break;
        }
      }
    }
  }

  /**
   * You jumped (more than 2.5 m in a beat: through a portal) to a spot he
   * doesn't have in front of his eyes: for AIMP.notice.side s (at his side) or
   * AIMP.notice.back s (behind him) he doesn't know where you went (he stops,
   * he doesn't turn to you, he doesn't shoot). True while that lasts.
   */
  private lostYou(sys: EnemySystem, e: Enemy, m: Mind, at: V3): boolean {
    const jumped = m.hasLast && Math.hypot(at.x - m.lastPl.x, at.z - m.lastPl.z) > 2.5;
    m.lastPl.set(at.x, at.y, at.z);
    m.hasLast = true;
    if (jumped && e.body && !e.body.simulate) {
      // (in front of his eyes he has you at once)
      const dx = at.x - e.pos.x, dz = at.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      const c = d < 0.3 ? 1 : (dx * Math.sin(e.yaw) + dz * Math.cos(e.yaw)) / d;
      if (c < AIMP.notice.cos) m.blindUntil = sys.time + (c > -0.5 ? AIMP.notice.side : AIMP.notice.back);
    }
    return sys.time < m.blindUntil;
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

  /** Level, walkable ground at (x, z) round him: its floor, else null. */
  private floorAt(sys: EnemySystem, e: Enemy, x: number, z: number): number | null {
    const y = this.host.standAt(x, z, e.pos.y);
    if (y === null || Math.abs(y - e.pos.y) > 0.35) return null;
    const g = sys.gridFor(e);
    if (g && !g.walkable(x, z)) return null;
    return y;
  }

  /** A walk to (x, z) is no more than `slack` m beyond the straight line (a wall he'd have to go round is a long way). */
  private near(sys: EnemySystem, e: Enemy, x: number, z: number, y: number, slack: number): boolean {
    const L = sys.pathLength(e, _d.set(x, y, z));
    return L <= hd(e.pos, _d) + slack;
  }

  /** A spot out of your sight (cover), nearest him, within a short walk of the fight; null if none found. */
  private findCover(sys: EnemySystem, e: Enemy, out: THREE.Vector3): boolean {
    const H = this.host;
    const pl = H.player();
    const R = AIMP.enemy.gunner;
    const cands: { x: number; y: number; z: number; r: number }[] = [];
    for (let k = 0; k < 18; k++) {
      const ang = sys.rand() * Math.PI * 2;
      const r = 2.5 + sys.rand() * 7;
      const x = e.pos.x + Math.sin(ang) * r, z = e.pos.z + Math.cos(ang) * r;
      const y = this.floorAt(sys, e, x, z);
      if (y === null) continue;
      const d = Math.hypot(x - pl.pos.x, z - pl.pos.z);
      if (d < R.keep[0] - 1 || d > R.keep[1] + 8) continue;
      _c.set(x, y + 1.35, z);
      if (H.world.lineOfSight(pl.eye, _c)) continue;
      _c.set(x, y + 0.7, z);
      if (H.world.lineOfSight(pl.eye, _c)) continue;
      cands.push({ x, y, z, r });
    }
    // (nearest first; the first whose way there is short)
    cands.sort((a, b) => a.r - b.r);
    for (let i = 0; i < Math.min(3, cands.length); i++) {
      const c = cands[i];
      if (!this.near(sys, e, c.x, c.z, c.y, 4.5)) continue;
      out.set(c.x, c.y, c.z);
      return true;
    }
    return false;
  }

  /** A spot near `from` with a clear line to you (to step out and shoot from). */
  private findPeek(sys: EnemySystem, e: Enemy, from: V3, out: THREE.Vector3): boolean {
    const H = this.host;
    const pl = H.player();
    const R = AIMP.enemy.gunner;
    let best = Infinity;
    let found = false;
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2 + sys.rand() * 0.3;
      const r = 1 + (k % 3) * 0.9;
      const x = from.x + Math.sin(ang) * r, z = from.z + Math.cos(ang) * r;
      const y = this.floorAt(sys, e, x, z);
      if (y === null) continue;
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

  /** SEARCH: a few spots round where he thought you were, the nearest to him first. */
  private beginSearch(sys: EnemySystem, e: Enemy, m: Mind) {
    const S = AIMP.intel.search;
    m.mode = 'search';
    m.pts.length = 0;
    m.ptI = 0;
    m.lookT = 0;
    const cands: { x: number; y: number; z: number; d: number }[] = [];
    for (let k = 0; k < 14; k++) {
      const ang = sys.rand() * Math.PI * 2;
      const r = between(S.radius, sys.rand());
      const x = m.known.x + Math.sin(ang) * r, z = m.known.z + Math.cos(ang) * r;
      const y = this.floorAt(sys, e, x, z);
      if (y === null) continue;
      if (!this.near(sys, e, x, z, y, 24)) continue;
      cands.push({ x, y, z, d: hd(e.pos, _d.set(x, y, z)) });
    }
    cands.sort((a, b) => a.d - b.d);
    // (spread out: a spot too near the last one is skipped)
    for (const c of cands) {
      if (m.pts.length >= S.pts) break;
      if (m.pts.some((q) => Math.hypot(q.x - c.x, q.z - c.z) < 3.5)) continue;
      m.pts.push(new THREE.Vector3(c.x, c.y, c.z));
    }
    // (nowhere to look: he heads for the hunch)
    if (!m.pts.length) m.mode = 'advance';
  }

  /** He walks the search; true while it goes on. */
  private searching(sys: EnemySystem, e: Enemy, m: Mind, dt: number): boolean {
    const S = AIMP.intel.search;
    if (m.ptI >= m.pts.length) {
      m.mode = 'advance';
      m.modeT = 0.8;
      return false;
    }
    const to = m.pts[m.ptI];
    if (hd(e.pos, to) > 0.9) {
      this.go(sys, e, m, to, AIMP.enemy.gunner.run * 0.75, dt);
      m.walkT += dt;
      if (m.walkT > 6) {
        m.walkT = 0;
        m.ptI++;
      }
      return true;
    }
    m.walkT = 0;
    // (a look round: he turns this way and that)
    m.lookT += dt;
    sys.halt(e, dt);
    e.yaw += Math.sin(m.lookT * 2.2) * dt * 1.6;
    if (m.lookT > S.look) {
      m.lookT = 0;
      m.ptI++;
    }
    return true;
  }

  /** Walk toward `to` (the watchdog notes if he does not get anywhere). */
  private go(sys: EnemySystem, e: Enemy, m: Mind, to: V3, speed: number, dt: number) {
    sys.moveTo(e, to, speed, dt, true);
    m.idleT = hd(e.pos, m.idleAt) < 0.3 ? m.idleT + dt : 0;
    if (m.idleT === 0) m.idleAt.copy(e.pos);
  }

  /** He may come round the wall by a portal of his own (no sight of you for a while; one portal at a time). */
  private mayAmbush(sys: EnemySystem, m: Mind): boolean {
    const A = AIMP.intel.ambush;
    const lost = m.everSeen ? sys.time - m.seenT > A.after : sys.time - m.bornT > A.first;
    return lost && m.portalCd <= 0 && this.host.player().alive && !this.host.player().safe;
  }

  private gunner(sys: EnemySystem, e: Enemy, m: Mind, dt: number) {
    const H = this.host;
    const pl = H.player();
    const R = AIMP.enemy.gunner;
    if (m.react > 0) {
      m.react -= dt;
      sys.halt(e, dt);
      sys.face(e, m.known, dt);
      return;
    }
    // through a red portal of his own
    if (m.portalId >= 0) {
      this.portalWalk(sys, e, m, dt);
      return;
    }
    if (this.reactPortal(sys, e, m, dt)) return;
    const d = hd(e.pos, pl.pos);
    const sees = m.seesNow;
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
    // sight of you ends a hold or a search: he is in the fight
    if (sees && (m.mode === 'hold' || m.mode === 'search')) {
      m.mode = 'advance';
      m.modeT = 0.8;
    }
    // no sight of you for a while: round the wall by a portal of his own
    if (!sees && m.mode !== 'hold' && this.mayAmbush(sys, m)) {
      m.portalCd = between(AIMP.intel.ambush.cd, sys.rand());
      if (sys.rand() < AIMP.intel.ambush.chance && this.openPortal(sys, e, m, true)) return;
    }
    // the watchdog: meaning to walk and not getting anywhere for 5 s: another way (a search spot, else the hunch)
    if (m.idleT > 5 && !sees) {
      m.idleT = 0;
      m.hasSpot = false;
      if (m.mode === 'advance') this.beginSearch(sys, e, m);
      else if (m.mode === 'search') m.ptI++;
      else m.mode = 'advance';
    }
    // HOLD: on his post, facing where he thinks you are
    if (m.mode === 'hold') {
      m.holdT -= dt;
      sys.halt(e, dt);
      sys.face(e, m.known, dt);
      if (m.holdT <= 0) {
        m.mode = 'advance';
        m.modeT = 0.8;
      }
      return;
    }
    if (m.mode === 'search') {
      if (this.searching(sys, e, m, dt)) return;
    }
    // out of the fight (far, or no line to you and no cover found): he closes in on where he thinks you are
    if (m.mode === 'advance') {
      if (sees && d <= R.keep[1] && m.gunT <= 0) {
        this.beginAim(m, pl, sys);
        return;
      }
      if (sees) {
        m.idleT = 0;
        if (d > R.keep[0] + 2) sys.moveTo(e, pl.pos, R.run, dt, true);
        else {
          sys.halt(e, dt);
          sys.face(e, pl.pos, dt);
        }
        // (a beat after he first sees you he goes looking for cover)
        if (m.modeT <= 0) {
          m.mode = 'hide';
          m.hasSpot = false;
          m.modeT = 0;
        }
        if (m.modeT === 0 && m.mode === 'advance') m.modeT = 0.8;
        return;
      }
      // (he got there and you are not: a look round)
      if (hd(e.pos, m.known) < 2.2) {
        this.beginSearch(sys, e, m);
        return;
      }
      this.go(sys, e, m, m.known, R.run, dt);
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
        m.hasSpot = this.findPeek(sys, e, e.pos, m.spot);
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
    // (where he believes you are: his shield and his walk go there)
    const tgt = m.seesNow ? pl.pos : m.known;
    if (m.react > 0) {
      m.react -= dt;
      e.yaw = turnToward(e.yaw, yawTo(e.pos, tgt), dt, M.turn);
      sys.halt(e, dt);
      return;
    }
    // his shield: toward the last one who hurt him, else where he thinks you are
    const now = sys.time;
    const at = now < m.turnUntil ? m.turnTo : tgt;
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
    // (he found nothing where he thought you were: a look round it)
    if (!m.seesNow && hd(e.pos, m.known) < 1.5) {
      if (m.mode !== 'search') this.beginSearch(sys, e, m);
      if (this.searching(sys, e, m, dt)) return;
      m.mode = 'advance';
    }
    if (hd(e.pos, tgt) > M.bash.reach - 0.3) this.go(sys, e, m, tgt, M.speed, dt);
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
      sys.face(e, m.known, dt);
      return;
    }
    // through a red portal of his own
    if (m.portalId >= 0) {
      this.portalWalk(sys, e, m, dt);
      return;
    }
    if (this.reactPortal(sys, e, m, dt)) return;
    // (the true distance only for a blow; where he thinks you are for the walk)
    const tgt = m.seesNow ? pl.pos : m.known;
    const d = hd(e.pos, pl.pos);
    const dk = hd(e.pos, tgt);
    const gap = Math.abs(pl.pos.y - e.pos.y) >= 1.6 && (m.seesNow || hd(e.pos, pl.pos) < AIMP.intel.hear);
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
    if (d <= K.reach && m.meleeCd <= 0 && pl.alive && !gap && (m.seesNow || d < 3)) {
      m.windT = 0;
      H.windup(e, K.windup);
      return;
    }
    // from afar (or no way down to you): a red portal right by you (behind you when he has not got you in sight)
    if (m.portalCd <= 0 && (dk > K.portalFrom || gap) && (m.seesNow || gap || this.mayAmbush(sys, m))) {
      m.portalCd = gap ? 0.8 : 2;
      if ((gap || sys.rand() < K.portalChance) && this.openPortal(sys, e, m, !m.seesNow && !gap)) return;
    }
    if (m.seesNow && d <= K.reach && !gap) {
      sys.halt(e, dt);
      sys.face(e, pl.pos, dt);
      return;
    }
    // (he got where he thought you were and you are not: a look round)
    if (!m.seesNow && dk < 1.5) {
      if (m.mode !== 'search') this.beginSearch(sys, e, m);
      if (this.searching(sys, e, m, dt)) return;
      m.mode = 'advance';
    }
    this.go(sys, e, m, tgt, K.run, dt);
  }

  /**
   * A pair of his: its entrance just ahead of him, its exit on floor you could stand on with a clear line to you:
   * `behind` you (the far side of where you look; a gunner AIMP.intel.ambush.behind m back, a rusher near), else on
   * his own side of you (`near` m, where he'd come from).
   */
  private openPortal(sys: EnemySystem, e: Enemy, m: Mind, behind = false): boolean {
    const H = this.host;
    const pl = H.player();
    const K = AIMP.enemy.rusher;
    if (H.portals.list.length || sys.time - this.lastPortalT < K.portalGap) return false;
    const toMe = Math.atan2(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z);
    const look = pl.yaw ?? toMe + Math.PI;
    const base = behind ? look + Math.PI : toMe;
    const dist = behind ? (m.role === 'gunner' ? AIMP.intel.ambush.behind : K.near + 1) : K.near;
    let exit: THREE.Vector3 | null = null;
    for (const dd of behind ? [0, -1.2, 1.2] : [0]) {
      for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.3, -2.3]) {
        // (offsets swing to the man's own side first: the exit is not where you stare)
        const ang = base + off * m.side;
        const r = dist + dd;
        const x = pl.pos.x + Math.sin(ang) * r, z = pl.pos.z + Math.cos(ang) * r;
        const y = H.standAt(x, z, pl.pos.y);
        if (y === null || Math.abs(y - pl.pos.y) > 0.5) continue;
        _c.set(x, y, z);
        _eye.set(x, y + 1.5, z);
        if (!H.world.lineOfSight(_eye, pl.chest)) continue;
        exit = _c.clone();
        break;
      }
      if (exit) break;
    }
    if (!exit) return false;
    const to = Math.atan2(m.known.x - e.pos.x, m.known.z - e.pos.z);
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
    m.gun = 'idle';
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
    // (a gunner who comes out behind you has to turn to you first, then his laser)
    if (m.role === 'gunner') {
      m.react = AIMP.intel.ambush.turn;
      m.mode = 'advance';
      m.modeT = 0.6;
      m.portalCd = between(AIMP.intel.ambush.cd, sys.rand());
    }
  }
}

/** Does a man at `e` notice a pair opened with its exit at `p` (front cone, near, in sight)? */
export function seesExit(world: Pick<CollisionWorld, 'lineOfSight'>, e: Enemy, p: V3): boolean {
  e.eye(_d);
  return notices(_d, e.yaw, p) && world.lineOfSight(_d, p);
}
