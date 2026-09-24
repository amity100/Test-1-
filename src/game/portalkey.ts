import * as THREE from 'three';
import { LAW, type EnemyView, type EntranceContext, type ExitAim, type TrapTarget, type V3 } from '../core/contracts';
import type { Prop } from './props';
import { frameNormal, orientFrame } from './portalMath';
import { facingFrame, launchFrame, lockOnEnemy, simulateArc, skyHatch, straightOn, throwSpot, type Frame, type Outcome, type SpotHost } from './riftspots';

/**
 * The PORTAL key: one key for both ends.
 *
 *  press    the entrance opens by what you point at / what's happening:
 *             falling          AIR     on your fall path
 *             an enemy         GRAB    the floor under him: he sinks in
 *             a load / barrel  LOAD    the floor (or the air) under it
 *             a Kessler gate   HIJACK  its arena end becomes yours
 *             the floor below  HOLE    a hole right there (looking down)
 *             anything else    DOOR    on the wall you face / in front of you
 *  hold     time slows and you aim the exit (where it throws, or where you
 *           come out; the arc and its outcome show)
 *  release  the exit opens there. A tap puts it where it does most: a thrown
 *           man straight on past him, away from you (knocked down on open
 *           floor; a wall, a drop or the sea on the way, or a man where he
 *           comes down, kills), a load over the nearest head, a door where
 *           you look.
 *
 * It costs nothing. Fire coming at you is the REFLECT strike's (strikes.ts).
 */
export type PortalMode = 'air' | 'grab' | 'load' | 'hijack' | 'hole' | 'door';

export const PORTAL = {
  /** A press shorter than this (real s) is a tap: the exit goes where it's best. */
  tap: 0.2,
  /** Held this long it lets go by itself (real s). */
  maxHold: 3.2,
  /** Time scale while held. */
  slow: { air: 0.15, grab: 0.1, load: 0.12, hijack: 0.3, hole: 0.33, door: 0.33 } as Record<PortalMode, number>,
  /** How hard what you throw comes out of the exit (m/s). */
  throwSpeed: { grab: 17, load: 14, hijack: 10 },
  /**
   * A GRAB's tap: the exit this far past him (m), its centre this high over
   * his feet, tilted this far up (rad). At 17 m/s he comes down ~11 m on at
   * ~9 m/s (knocked down, under the 12 m/s kill); a wall on the way or a man
   * where he comes down takes him at 16 m/s, a drop or the sea anyhow. Its
   * pair shuts sooner (s): off a wall close behind him he'd drop back in.
   */
  straight: { past: 2, up: 2, tilt: (20 * Math.PI) / 180, linger: 0.5 },
  /** How far out the launcher end goes when the aim hits nothing (m past you). */
  reach: 14,
  /** A grabbed man sinks this deep while you aim (m), this fast (m/s, real). */
  sinkMax: 0.95,
  sinkRate: 2.8,
  /** A throw's pair closes this long after what it threw went through (s)... */
  linger: 1.2,
  /** ...or this long after it opened, whatever happened. */
  throwLife: 5,
  /** Lock-on for aimed throws: in this range, this close to the aim. */
  lockRange: 40,
  lockCone: 0.2,
};

export interface PortalHost extends SpotHost {
  enemies: {
    readonly list: readonly EnemyView[];
    byKey(key: string): EnemyView | null;
    hold(v: EnemyView, on: boolean): void;
    isHeld(v: EnemyView): boolean;
    setSink(v: EnemyView, m: number): void;
    launch(v: EnemyView, vel?: V3): void;
    stagger(v: EnemyView, seconds: number, push?: V3): void;
  };
  props: { byKey(key: string): Prop | null; release(p: Prop): void };
  entranceCtx(): EntranceContext;
  aimRay(): { origin: V3; dir: V3 };
  playerEye(): V3;
  playerFeet(): V3;
  touch(): boolean;
  /** Is this enemy in a zone the game runs. */
  live(e: EnemyView): boolean;
  /** A hanging load under the crosshair. */
  hangingUnderCrosshair(): Prop | null;
}

export interface PortalResult {
  ok: boolean;
  mode: PortalMode | null;
  reason: string | null;
  /** Where the action is (FX). */
  at?: V3;
  /** The enemy it's about. */
  enemy?: EnemyView | null;
}

interface Resolved {
  mode: PortalMode;
  reason: string | null;
  target: TrapTarget | null;
  enemy: EnemyView | null;
  prop: Prop | null;
  gate: string | null;
  /** HOLE: where on the floor. */
  spot: THREE.Vector3 | null;
}

interface Hold {
  mode: PortalMode;
  /** Real seconds since the press. */
  t: number;
  enemy: EnemyView | null;
  prop: Prop | null;
  gate: string | null;
  /** The exit is open already and follows the aim (AIR). */
  live: boolean;
  sink: number;
  /** The current aim (travel modes), for the preview and the release. */
  aim: ExitAim | null;
  /** The current launcher end (thrown modes). */
  launch: { frame: Frame; boost: number; aimAt: number; valid: boolean; reason: string | null } | null;
}

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const FWD = new THREE.Vector3(0, 0, 1);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const ARC_N = 64;

function steadyOf(e: EnemyView) {
  return e.kind === 'turret' || !e.offBalance;
}

export class PortalKey {
  hold: Hold | null = null;
  /** A throw's pair: closes a moment after its load went through. */
  private thrown: { t: number; key: string | null; crossedT: number; linger: number; enemy?: EnemyView } | null = null;
  /** The predicted arc of what's being thrown (for drawing). */
  readonly arc: THREE.Vector3[] = Array.from({ length: ARC_N }, () => new THREE.Vector3());
  arcN = 0;
  arcOutcome: Outcome = 'safe';

  constructor(private h: PortalHost) {}

  get holding() {
    return !!this.hold;
  }

  /** The hold has passed the tap window (aiming for real). */
  get aiming() {
    return !!this.hold && this.hold.t > PORTAL.tap;
  }

  /** Time scale while held (1 when not). */
  timeScale() {
    return this.hold ? PORTAL.slow[this.hold.mode] : 1;
  }

  reset() {
    if (this.hold?.enemy) {
      this.h.enemies.hold(this.hold.enemy, false);
      this.h.enemies.setSink(this.hold.enemy, 0);
    }
    this.hold = null;
    this.dropThrown();
    this.arcN = 0;
  }

  /** Forget the last throw (its pair is gone or going): he's drawn standing again. */
  private dropThrown() {
    const T = this.thrown;
    this.thrown = null;
    if (T?.enemy) this.h.enemies.setSink(T.enemy, 0);
  }

  /** What a press would do right now (the HUD hint on the crosshair). */
  preview(): { mode: PortalMode; reason: string | null; key: string | null } {
    const r = this.resolve(this.h.entranceCtx());
    return { mode: r.mode, reason: r.reason, key: r.target?.key ?? null };
  }

  // ------------------------------------------------------------------

  private resolve(ctx: EntranceContext): Resolved {
    const h = this.h;
    const r: Resolved = { mode: 'door', reason: null, target: null, enemy: null, prop: null, gate: null, spot: null };
    if (ctx.airborne && ctx.playerVel.y < -3) {
      r.mode = 'air';
      return r;
    }
    const hang = h.hangingUnderCrosshair();
    if (hang) {
      r.mode = 'load';
      r.prop = hang;
      return r;
    }
    let tgt = h.rifts.crosshairTarget(ctx);
    // (beyond reach he's just scenery: the press falls through to a door / a hole)
    if (tgt && Math.hypot(tgt.pos.x - ctx.camPos.x, tgt.pos.y - ctx.camPos.y, tgt.pos.z - ctx.camPos.z) > LAW.trapdoorRange) tgt = null;
    if (tgt) {
      const e = h.enemies.byKey(tgt.key);
      if (e) {
        r.mode = 'grab';
        r.enemy = e;
        r.target = tgt;
        // (turrets and Voss are anchored, Voss stunned or not)
        if (e.kind === 'turret' || e.kind === 'boss') r.reason = 'portal.anchored';
        return r;
      }
      const pr = h.props.byKey(tgt.key);
      if (pr) {
        r.mode = 'load';
        r.prop = pr;
        r.target = tgt;
        return r;
      }
    }
    const gate = h.rifts.gateUnderRay(ctx.camPos, ctx.camDir);
    if (gate) {
      r.mode = 'hijack';
      r.gate = gate;
      return r;
    }
    // looking down at the floor near you: a hole right there
    const spot = this.holeSpot(ctx);
    if (spot) {
      r.mode = 'hole';
      r.spot = spot;
    }
    return r;
  }

  /** Where a HOLE would open: the floor the aim hits, looking well down, near and not above you. */
  private holeSpot(ctx: EntranceContext): THREE.Vector3 | null {
    if (ctx.camDir.y > -0.6) return null;
    const hit = this.h.world.raycast(ctx.camPos, ctx.camDir, 16, { sight: false });
    if (!hit || hit.normal.y < 0.7 || hit.collider.noPortal) return null;
    const f = ctx.playerFeet;
    if (hit.point.y > f.y + 0.5 || Math.hypot(hit.point.x - f.x, hit.point.z - f.z) > 10) return null;
    const c = hit.collider;
    const half = LAW.floorEndSize / 2;
    if (c.max.x - c.min.x < LAW.floorEndSize || c.max.z - c.min.z < LAW.floorEndSize) return null;
    const x = THREE.MathUtils.clamp(hit.point.x, c.min.x + half, c.max.x - half);
    const z = THREE.MathUtils.clamp(hit.point.z, c.min.z + half, c.max.z - half);
    return new THREE.Vector3(x, hit.point.y + 0.01, z);
  }

  // ------------------------------------------------------------------

  press(): PortalResult {
    const h = this.h;
    if (this.hold) this.cancel();
    const ctx = h.entranceCtx();
    const r = this.resolve(ctx);
    const fail = (reason: string | null): PortalResult => ({ ok: false, mode: r.mode, reason, enemy: r.enemy });
    if (r.reason) return fail(r.reason);
    const hold: Hold = { mode: r.mode, t: 0, enemy: null, prop: null, gate: null, live: false, sink: 0, aim: null, launch: null };
    let at: V3 | undefined;
    switch (r.mode) {
      case 'air':
      case 'door': {
        const pre = h.rifts.openEntrance(ctx, { force: r.mode, requireExit: false });
        if (!pre.ok) return fail(pre.reason);
        break;
      }
      case 'grab': {
        const e = r.enemy!;
        const res = h.rifts.openUnder(r.target!, ctx.playerFeet, ctx.playerYaw, ctx.camPos);
        if (!res.ok) return fail(res.reason);
        h.enemies.hold(e, true);
        hold.enemy = e;
        at = e.pos;
        break;
      }
      case 'load': {
        const pr = r.prop!;
        if (pr.hanging) this.openUnderHanging(pr);
        else {
          const res = h.rifts.openUnder(r.target ?? { key: pr.key, pos: pr.body.pos, radius: pr.body.radius, height: pr.body.height, canFall: true, steady: false }, ctx.playerFeet, ctx.playerYaw, ctx.camPos);
          if (!res.ok) return fail(res.reason);
        }
        hold.prop = pr;
        at = pr.body.pos;
        break;
      }
      case 'hijack': {
        const out = h.rifts.gateOut(r.gate!);
        if (!out) return fail('gate.noSpace');
        h.rifts.clearPair();
        hold.gate = r.gate;
        at = out.position;
        break;
      }
      case 'hole': {
        const sp = r.spot!;
        const yaw = Math.atan2(ctx.camDir.x, ctx.camDir.z);
        h.rifts.openEntranceFrame({ position: sp, quaternion: orientFrame(UP, _a.set(Math.sin(yaw), 0, Math.cos(yaw))), width: LAW.floorEndSize, height: LAW.floorEndSize }, 'floor');
        at = sp;
        break;
      }
    }
    this.dropThrown();
    this.hold = hold;
    // AIR can't wait for the release: its exit opens now and follows your aim
    if (hold.mode === 'air') {
      hold.live = this.openAirExit(hold);
      if (!hold.live) {
        // nowhere to come out: no point keeping a hole in your way
        h.rifts.closeEntrance();
        this.hold = null;
        return fail('aim.space');
      }
    }
    return { ok: true, mode: hold.mode, reason: null, at, enemy: hold.enemy };
  }

  /** Let go without an exit: the entrance closes, whoever was held climbs out (stumbling). */
  cancel() {
    const H = this.hold;
    if (!H) return;
    this.hold = null;
    this.arcN = 0;
    const h = this.h;
    if (H.enemy) {
      h.enemies.hold(H.enemy, false);
      h.enemies.setSink(H.enemy, 0);
      if (H.enemy.alive) h.enemies.stagger(H.enemy, 0.8);
    }
    if (H.live) h.rifts.clearPair();
    else h.rifts.closeEntrance();
  }

  /** You went through a rift: an AIR exit you're still aiming stays where you came out. */
  playerCrossed(): PortalResult | null {
    const H = this.hold;
    if (!H || H.mode !== 'air' || !H.live) return null;
    return this.finish(H, false);
  }

  /** A body / prop went through a rift (the game forwards crossings). */
  crossed(key: string) {
    const T = this.thrown;
    if (T && T.key === key && T.crossedT < 0) T.crossedT = T.t;
  }

  /**
   * Per frame (real time). `held`: the key is down. Returns the result when
   * the exit was placed (or the hold fell through) this frame.
   */
  update(realDt: number, held: boolean): PortalResult | null {
    const h = this.h;
    const T = this.thrown;
    if (T) {
      T.t += realDt;
      if ((T.crossedT >= 0 && T.t - T.crossedT > T.linger) || T.t > PORTAL.throwLife) {
        this.dropThrown();
        h.rifts.clearPair();
      }
    }
    const H = this.hold;
    if (!H) {
      this.arcN = 0;
      return null;
    }
    H.t += realDt;
    // the thing in hand is gone (killed, blown away, sunk): nothing to throw
    if (H.enemy && (!H.enemy.alive || !h.enemies.isHeld(H.enemy))) {
      this.cancel();
      return { ok: false, mode: H.mode, reason: null };
    }
    if (H.prop && !H.prop.alive) {
      this.cancel();
      return { ok: false, mode: H.mode, reason: null };
    }
    if (H.enemy) {
      H.sink = Math.min(PORTAL.sinkMax, H.sink + PORTAL.sinkRate * realDt);
      h.enemies.setSink(H.enemy, H.sink);
    }
    const tap = H.t <= PORTAL.tap;
    const letGo = !held || H.t >= PORTAL.maxHold;
    if (!tap) this.aimNow(H);
    else this.arcN = 0;
    if (!letGo) return null;
    return this.finish(H, tap);
  }

  // ------------------------------------------------------------------
  // Aim while held
  // ------------------------------------------------------------------

  private aimNow(H: Hold) {
    const h = this.h;
    const ray = h.aimRay();
    const eye = h.playerEye();
    const along = Math.max(0, _a.subVectors(eye, ray.origin).dot(ray.dir));
    if (H.mode === 'door' || H.mode === 'air' || H.mode === 'hole') {
      const ctx = h.entranceCtx();
      const aim = h.rifts.aimExit(ray.origin, ray.dir, eye, h.playerFeet(), h.touch(), ctx.targets);
      H.aim = aim;
      this.arcN = 0;
      if (H.live && aim.valid) h.rifts.moveExit({ ...aim.frame, kind: aim.kind } as Frame, aim.host);
      return;
    }
    // thrown things: a launcher end along the aim (or in front of the man you lock on)
    const boost = PORTAL.throwSpeed[H.mode as 'grab' | 'load' | 'hijack'];
    const lock = this.lockOn(ray.origin, ray.dir, H.enemy);
    let frame: Frame;
    let reason: string | null = null;
    if (lock) frame = this.facing(lock, ray.origin, 2.4);
    else {
      const lf = launchFrame(h, ray.origin, ray.dir, along, PORTAL.reach);
      frame = lf.frame;
      reason = lf.reason;
    }
    H.launch = { frame, boost, aimAt: lock ? lock.id : -1, valid: !reason, reason };
    // the arc of what comes out
    const n = frameNormal(frame, _b);
    const res = simulateArc(h, frame.position, _c.copy(n).multiplyScalar(boost), this.arc, { enemies: h.enemies.list, skipId: H.enemy?.id });
    this.arcN = reason ? 0 : res.n;
    this.arcOutcome = res.outcome;
    H.aim = this.launchAim(frame, n, res.end, !reason, reason, res.outcome);
  }

  /** An ExitAim-shaped preview for a launcher end (the ghost end, the ring where it lands). */
  private launchAim(frame: Frame, n: V3, land: V3, valid: boolean, reason: string | null, outcome: Outcome): ExitAim {
    return {
      frame: { position: frame.position.clone(), quaternion: frame.quaternion.clone(), width: frame.width, height: frame.height },
      kind: frame.kind,
      host: null,
      exitFeet: new THREE.Vector3(land.x, land.y, land.z),
      exitYaw: Math.atan2(n.x, n.z),
      valid,
      reason,
      distance: frame.position.distanceTo(this.h.playerEye()),
      dropBelow: 0,
      outcome,
      overTarget: null,
    };
  }

  /** The enemy the aim is on (closest to the ray, in range and in sight), besides `skip`. */
  private lockOn(origin: V3, dir: V3, skip: EnemyView | null): EnemyView | null {
    const h = this.h;
    return lockOnEnemy(h, h.enemies.list, (e) => h.live(e), origin, dir, h.playerEye(), { skip, cone: PORTAL.lockCone * (h.touch() ? 1.5 : 1), range: PORTAL.lockRange });
  }

  /** A launcher end `gap` m short of him on the line from `from`, facing him. */
  private facing(e: EnemyView, from: V3, gap: number): Frame {
    return facingFrame(e.chest(new THREE.Vector3()), from, gap);
  }

  // ------------------------------------------------------------------
  // Exits
  // ------------------------------------------------------------------

  /** AIR: the exit opens with the entrance, where you look. */
  private openAirExit(H: Hold): boolean {
    const h = this.h;
    const ray = h.aimRay();
    const ctx = h.entranceCtx();
    let aim = h.rifts.aimExit(ray.origin, ray.dir, h.playerEye(), h.playerFeet(), h.touch(), ctx.targets);
    if (!aim.valid) {
      // looking nowhere useful: a door straight ahead at your height (the fall turns into a run)
      const hd = _a.set(ray.dir.x, 0, ray.dir.z);
      if (hd.lengthSq() < 1e-4) hd.set(0, 0, 1);
      hd.normalize();
      aim = h.rifts.aimExit(ray.origin, hd, h.playerEye(), h.playerFeet(), h.touch(), ctx.targets);
    }
    H.aim = aim;
    return aim.valid && h.rifts.placeExit(aim);
  }

  /** A hole right under a hanging load (on the ground under it when that's a real drop). */
  private openUnderHanging(pr: Prop) {
    const h = this.h;
    const hp = pr.body.pos;
    const w = h.world;
    const gy = w.groundAt(hp.x, hp.z, 0.3, hp.y - 0.1);
    const host = w.lastGround;
    const steadyNear = h.enemies.list.some((e) => e.alive && steadyOf(e) && Math.hypot(e.pos.x - hp.x, e.pos.z - hp.z) < LAW.enemyClearance + e.radius && Math.abs(e.pos.y - gy) < 1);
    const onGround = gy > -Infinity && hp.y - gy > 3 && !!host && !host.noPortal && !steadyNear;
    const q = orientFrame(UP, FWD);
    h.rifts.openEntranceFrame(
      { position: new THREE.Vector3(hp.x, onGround ? gy + 0.01 : hp.y - 1.2, hp.z), quaternion: q, width: LAW.floorEndSize, height: LAW.floorEndSize },
      onGround ? 'floor' : 'air',
      true,
    );
  }

  /** The release: the exit opens (aimed, or where it does most on a tap). */
  private finish(H: Hold, tap: boolean): PortalResult {
    const h = this.h;
    this.hold = null;
    this.arcN = 0;
    const ok = (at?: V3): PortalResult => ({ ok: true, mode: H.mode, reason: null, at, enemy: H.enemy });
    const lost = (reason: string | null): PortalResult => {
      // nowhere to put it: the entrance closes, whoever was held climbs out
      this.hold = H;
      this.cancel();
      return { ok: false, mode: H.mode, reason, enemy: H.enemy };
    };
    switch (H.mode) {
      case 'air':
        return H.live ? ok(h.rifts.playerEnds().exit?.position) : lost('aim.space');
      case 'hole': {
        // a tap: the exit right over it, as high as you stand (a loop)
        if (tap || !H.aim) {
          const en = h.rifts.playerEnds().entrance;
          if (!en) return lost(null);
          const top = Math.min(h.playerFeet().y + LAW.airAboveFeetMax, en.position.y + 8);
          const ceil = h.world.ceilingAt(en.position.x, en.position.z, 0.6, en.position.y + 1);
          const y = Math.min(top, ceil - 0.4);
          if (y - en.position.y < 3.2) return lost('portal.loopLow');
          const f: Frame = { position: new THREE.Vector3(en.position.x, y, en.position.z), quaternion: orientFrame(DOWN, FWD), width: LAW.floorEndSize, height: LAW.floorEndSize, kind: 'air' };
          h.rifts.placeExitFrame(f);
          return ok(f.position);
        }
        const aim = H.aim;
        if (!aim.valid || !h.rifts.placeExit(aim)) return lost(aim.reason ?? 'aim.space');
        return ok(aim.frame.position);
      }
      case 'door': {
        let aim = H.aim;
        if (tap || !aim) {
          const ray = h.aimRay();
          aim = h.rifts.aimExit(ray.origin, ray.dir, h.playerEye(), h.playerFeet(), h.touch(), h.entranceCtx().targets);
        }
        if (!aim.valid || !h.rifts.placeExit(aim)) return lost(aim.reason ?? 'aim.space');
        return ok(aim.frame.position);
      }
      case 'grab': {
        const e = H.enemy!;
        const aimed = !tap && !!H.launch?.valid;
        const spot = this.throwTarget(H, tap, e.pos);
        if (!spot) return lost('portal.nowhere');
        h.rifts.placeExitFrame(spot.frame, null, { boost: spot.boost, noPlayer: true });
        h.rifts.setPairNoPlayer(true);
        h.enemies.hold(e, false);
        h.enemies.launch(e, new THREE.Vector3(0, -9, 0));
        // (still drawn sunk until he's through: no pop back up for the frames it takes)
        h.enemies.setSink(e, H.sink);
        this.thrown = { t: 0, key: `enemy:${e.id}`, crossedT: -1, linger: aimed ? PORTAL.linger : PORTAL.straight.linger, enemy: e };
        return ok(spot.frame.position);
      }
      case 'load': {
        const pr = H.prop!;
        let spot = !tap && H.launch?.valid ? { frame: H.launch.frame, boost: H.launch.boost } : null;
        if (!spot) spot = this.loadAuto(pr);
        if (!spot) return lost('portal.nowhere');
        h.rifts.placeExitFrame(spot.frame, null, { boost: spot.boost, noPlayer: true });
        h.rifts.setPairNoPlayer(true);
        pr.touched = true;
        if (pr.hanging) h.props.release(pr);
        else {
          pr.body.vel.set(0, -6, 0);
          pr.body.onGround = false;
        }
        this.thrown = { t: 0, key: pr.key, crossedT: -1, linger: PORTAL.linger };
        return ok(spot.frame.position);
      }
      case 'hijack': {
        const out = h.rifts.gateOut(H.gate!);
        const spot = this.throwTarget(H, tap, out ? out.position : h.playerFeet());
        if (!spot) return lost('portal.nowhere');
        h.rifts.placeExitFrame(spot.frame, null, { boost: spot.boost, noPlayer: true });
        h.rifts.hijackGate(H.gate!);
        return ok(spot.frame.position);
      }
    }
  }

  /** The aimed launcher end if valid; else a held man straight on, a gate's arrivals where a throw does most from `from`. */
  private throwTarget(H: Hold, tap: boolean, from: V3): { frame: Frame; boost: number } | null {
    if (!tap && H.launch?.valid) return { frame: H.launch.frame, boost: H.launch.boost };
    if (H.enemy) return this.straightOn(H.enemy);
    return throwSpot(this.h, from, 22, this.h.playerFeet());
  }

  /** A GRAB let go of without an aim: straight on past him, away from you (where you stand decides where he lands). */
  private straightOn(e: EnemyView): { frame: Frame; boost: number } | null {
    const h = this.h;
    const f = h.playerFeet();
    const d = _a.set(e.pos.x - f.x, 0, e.pos.z - f.z);
    if (d.lengthSq() < 0.04) {
      // (right over him: the way you look)
      const look = h.aimRay().dir;
      d.set(look.x, 0, look.z);
    }
    if (d.lengthSq() < 1e-6) return null;
    d.normalize();
    const S = PORTAL.straight;
    const frame = straightOn(h, e.pos, d, S.past, S.up, S.tilt);
    return frame ? { frame, boost: PORTAL.throwSpeed.grab } : null;
  }

  /** A load on a tap: over the head of the man you look at (else the nearest in sight), else over the edge. */
  private loadAuto(pr: Prop): { frame: Frame; boost: number } | null {
    const h = this.h;
    const ray = h.aimRay();
    // (not a man right by the hole: a hatch over him is a hatch over the hole, and the load just loops)
    const en = h.rifts.playerEnds().entrance;
    const byHole = (q: EnemyView) => !!en && Math.hypot(q.pos.x - en.position.x, q.pos.z - en.position.z) < 3.5;
    let e = this.lockOn(ray.origin, ray.dir, null);
    if (e && byHole(e)) e = null;
    if (!e) {
      let bd = 28;
      const eye = h.playerEye();
      for (const q of h.enemies.list) {
        if (!q.alive || !h.live(q) || q.kind === 'turret' || byHole(q)) continue;
        const d = q.pos.distanceTo(pr.body.pos);
        if (d < bd && h.world.lineOfSight(eye, q.chest(_a))) {
          bd = d;
          e = q;
        }
      }
    }
    if (e) {
      const sky = skyHatch(h, _c.set(e.pos.x, e.pos.y + e.height, e.pos.z), 5, 2.2);
      if (sky) return { frame: sky, boost: 8 };
    }
    return throwSpot(h, pr.body.pos);
  }
}

/** The dotted arc of a throw being aimed, coloured by what it will do. */
export class ArcView {
  readonly points: THREE.Points;
  private geo: THREE.BufferGeometry;
  private pos: Float32Array;
  private mat: THREE.PointsMaterial;

  constructor(colors: Record<Outcome, THREE.Color>) {
    this.colors = colors;
    this.pos = new Float32Array(ARC_N * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setDrawRange(0, 0);
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    if (g) {
      const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.45, 'rgba(255,255,255,0.8)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 32, 32);
    }
    const tex = new THREE.CanvasTexture(c);
    // a constant size on screen: the arc is read from 10-40 m away
    this.mat = new THREE.PointsMaterial({ size: 9, map: tex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, sizeAttenuation: false });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 32;
    this.points.visible = false;
    this.points.userData.helper = true;
  }

  private colors: Record<Outcome, THREE.Color>;

  update(pk: { readonly arc: THREE.Vector3[]; arcN: number; arcOutcome: Outcome }, time: number) {
    const n = pk.arcN;
    this.points.visible = n > 1;
    if (n <= 1) return;
    // every other sample, marching toward the end
    let k = 0;
    const phase = (time * 6) % 2 < 1 ? 0 : 1;
    for (let i = phase; i < n; i += 2) {
      const p = pk.arc[i];
      this.pos[k * 3] = p.x;
      this.pos[k * 3 + 1] = p.y;
      this.pos[k * 3 + 2] = p.z;
      k++;
    }
    const last = pk.arc[n - 1];
    this.pos[k * 3] = last.x;
    this.pos[k * 3 + 1] = last.y;
    this.pos[k * 3 + 2] = last.z;
    k++;
    this.geo.setDrawRange(0, k);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.mat.color.copy(this.colors[pk.arcOutcome]).multiplyScalar(2.4);
  }
}
