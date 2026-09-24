import * as THREE from 'three';
import { LAW, type EnemyView, type EntranceContext, type ExitAim, type Threat, type TrapTarget, type V3 } from '../core/contracts';
import type { Prop } from './props';
import { frameNormal, orientFrame } from './portalMath';
import { besideDoor, facingFrame, launchFrame, lockOnEnemy, simulateArc, skyHatch, throwSpot, type Frame, type Outcome, type SpotHost } from './riftspots';

/**
 * The PORTAL key: one key for both ends.
 *
 *  press    the entrance opens by what you point at / what's happening:
 *             falling          AIR     on your fall path
 *             an enemy         GRAB    the floor under him: he sinks in
 *             a load / barrel  LOAD    the floor (or the air) under it
 *             a Kessler gate   HIJACK  its arena end becomes yours
 *             under fire       CATCH   a door between you and it
 *             the floor below  HOLE    a hole right there (looking down)
 *             anything else    DOOR    on the wall you face / in front of you
 *  hold     time slows and you aim the exit (where it throws, or where you
 *           come out; the arc and its outcome show)
 *  release  the exit opens there. A tap puts it where it does most: a thrown
 *           man over the nearest drop or water (else out of the sky), shots
 *           back at the man who fired them, a load over the nearest head,
 *           a door where you look.
 *
 * Grabbing a man who is fighting you costs one rift charge (an unaware or
 * stumbling one is free), and that kill gives no charge back.
 */
export type PortalMode = 'air' | 'catch' | 'grab' | 'load' | 'hijack' | 'hole' | 'door';

export const PORTAL = {
  /** A press shorter than this (real s) is a tap: the exit goes where it's best. */
  tap: 0.2,
  /** Held this long it lets go by itself (real s). */
  maxHold: 3.2,
  /** Time scale while held. */
  slow: { air: 0.15, catch: 0.15, grab: 0.1, load: 0.12, hijack: 0.3, hole: 0.33, door: 0.33 } as Record<PortalMode, number>,
  /** How hard what you throw comes out of the exit (m/s). */
  throwSpeed: { grab: 17, load: 14, hijack: 10, catch: 12 },
  /** How far out the launcher end goes when the aim hits nothing (m past you). */
  reach: 14,
  /** A grabbed man sinks this deep while you aim (m), this fast (m/s, real). */
  sinkMax: 0.95,
  sinkRate: 2.8,
  /** A throw's pair closes this long after what it threw went through (s)... */
  linger: 1.2,
  /** ...or this long after it opened, whatever happened. */
  throwLife: 5,
  /** Grabbing a man who's fighting you. */
  grabCost: 1,
  /** A threat this close (s) makes a press a CATCH. */
  catchEta: 1.6,
  /** Lock-on for aimed throws / catches: in this range, this close to the aim. */
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
  /** The rift charge pool (shared with the STRIKES). */
  charges(): number;
  spend(n: number): void;
  refund(n: number): void;
  /** A kill of this man gives no charge back (he was paid for); off = the charge came back. */
  markPaid(id: number, on: boolean): void;
  /** A hanging load under the crosshair. */
  hangingUnderCrosshair(): Prop | null;
}

export interface PortalResult {
  ok: boolean;
  mode: PortalMode | null;
  reason: string | null;
  /** Charge it costs / cost. */
  cost: number;
  /** Where the action is (FX). */
  at?: V3;
  /** The enemy it's about. */
  enemy?: EnemyView | null;
}

interface Resolved {
  mode: PortalMode;
  reason: string | null;
  cost: number;
  target: TrapTarget | null;
  enemy: EnemyView | null;
  prop: Prop | null;
  gate: string | null;
  threat: Threat | null;
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
  threat: Threat | null;
  /** Who a CATCH sends back to. */
  sender: EnemyView | null;
  paid: boolean;
  /** The exit is open already and follows the aim (AIR, CATCH). */
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
  private thrown: { t: number; key: string | null; crossedT: number; enemy?: EnemyView } | null = null;
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
  preview(): { mode: PortalMode; reason: string | null; cost: number; key: string | null } {
    const r = this.resolve(this.h.entranceCtx());
    return { mode: r.mode, reason: r.reason, cost: r.cost, key: r.target?.key ?? null };
  }

  // ------------------------------------------------------------------

  private resolve(ctx: EntranceContext): Resolved {
    const h = this.h;
    const r: Resolved = { mode: 'door', reason: null, cost: 0, target: null, enemy: null, prop: null, gate: null, threat: null, spot: null };
    if (ctx.airborne && ctx.playerVel.y < -3) {
      r.mode = 'air';
      return r;
    }
    // under fire, defence first: CATCH what's coming (only a man who can't stand his ground is grabbed instead)
    const th = this.imminent(ctx);
    const caught = (): Resolved => ({ ...r, mode: 'catch', reason: null, cost: 0, enemy: null, prop: null, target: null, gate: null, threat: th });
    const hang = h.hangingUnderCrosshair();
    if (hang) {
      if (th) return caught();
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
        if (e.kind === 'turret' || (e.kind === 'boss' && !e.offBalance)) r.reason = 'portal.anchored';
        else if (steadyOf(e)) {
          r.cost = PORTAL.grabCost;
          if (h.charges() < r.cost) r.reason = 'portal.noCharge';
        }
        if (th && (r.reason || r.cost > 0)) return caught();
        return r;
      }
      const pr = h.props.byKey(tgt.key);
      if (pr) {
        if (th) return caught();
        r.mode = 'load';
        r.prop = pr;
        r.target = tgt;
        return r;
      }
    }
    if (th) return caught();
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

  /** The threat a CATCH is for: soon, and the one you're facing (you look at what you want to catch). */
  private imminent(ctx: EntranceContext): Threat | null {
    let best: Threat | null = null;
    let bestScore = Infinity;
    for (const q of ctx.threats) {
      if (q.eta > PORTAL.catchEta) continue;
      _a.subVectors(q.from, ctx.camPos);
      const len = _a.length();
      const ang = len > 1e-3 ? Math.acos(THREE.MathUtils.clamp(_a.dot(ctx.camDir) / len, -1, 1)) : 0;
      const score = q.eta + ang * 0.6;
      if (score < bestScore) {
        bestScore = score;
        best = q;
      }
    }
    return best;
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
    const fail = (reason: string | null): PortalResult => ({ ok: false, mode: r.mode, reason, cost: r.cost, enemy: r.enemy });
    if (r.reason) return fail(r.reason);
    const hold: Hold = { mode: r.mode, t: 0, enemy: null, prop: null, gate: null, threat: r.threat, sender: null, paid: false, live: false, sink: 0, aim: null, launch: null };
    let at: V3 | undefined;
    switch (r.mode) {
      case 'air':
      case 'door': {
        const pre = h.rifts.openEntrance(ctx, { force: r.mode, requireExit: false });
        if (!pre.ok) return fail(pre.reason);
        break;
      }
      case 'catch': {
        const res = h.rifts.openEntrance(ctx, { force: 'catch', requireExit: false, threat: r.threat });
        if (!res.ok) return fail(res.reason);
        hold.sender = this.senderOf(r.threat);
        break;
      }
      case 'grab': {
        const e = r.enemy!;
        const paid = r.cost > 0;
        const res = h.rifts.openUnder(r.target!, ctx.playerFeet, ctx.playerYaw, ctx.camPos, paid);
        if (!res.ok) return fail(res.reason);
        if (paid) {
          h.spend(r.cost);
          h.markPaid(e.id, true);
        }
        h.enemies.hold(e, true);
        hold.enemy = e;
        hold.paid = paid;
        at = e.pos;
        break;
      }
      case 'load': {
        const pr = r.prop!;
        let ok: boolean;
        if (pr.hanging) ok = this.openUnderHanging(pr);
        else {
          const res = h.rifts.openUnder(r.target ?? { key: pr.key, pos: pr.body.pos, radius: pr.body.radius, height: pr.body.height, canFall: true, steady: false }, ctx.playerFeet, ctx.playerYaw, ctx.camPos, true);
          ok = res.ok;
          if (!ok) return fail(res.reason);
        }
        if (!ok) return fail('gate.noSpace');
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
        if (h.rifts.blocked(sp)) return fail('gate.blocked');
        const yaw = Math.atan2(ctx.camDir.x, ctx.camDir.z);
        if (!h.rifts.openEntranceFrame({ position: sp, quaternion: orientFrame(UP, _a.set(Math.sin(yaw), 0, Math.cos(yaw))), width: LAW.floorEndSize, height: LAW.floorEndSize }, 'floor')) return fail('gate.noSpace');
        at = sp;
        break;
      }
    }
    this.dropThrown();
    this.hold = hold;
    // AIR and CATCH can't wait for the release: their exit opens now and follows your aim
    if (hold.mode === 'air' || hold.mode === 'catch') {
      hold.live = this.openLiveExit(hold);
      if (!hold.live && hold.mode === 'air') {
        // nowhere to come out: no point keeping a hole in your way
        h.rifts.closeEntrance();
        this.hold = null;
        return fail('aim.space');
      }
    }
    return { ok: true, mode: hold.mode, reason: null, cost: hold.paid ? r.cost : 0, at, enemy: hold.enemy };
  }

  /** Let go without an exit: the entrance closes, whoever was held climbs out. */
  cancel() {
    const H = this.hold;
    if (!H) return;
    this.hold = null;
    this.arcN = 0;
    const h = this.h;
    if (H.enemy) {
      h.enemies.hold(H.enemy, false);
      h.enemies.setSink(H.enemy, 0);
      if (H.paid) {
        // (a man you paid for climbs out ready to fight: no free stumble to grab him again)
        h.refund(PORTAL.grabCost);
        h.markPaid(H.enemy.id, false);
      } else if (H.enemy.alive) h.enemies.stagger(H.enemy, 0.8);
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
      if ((T.crossedT >= 0 && T.t - T.crossedT > PORTAL.linger) || T.t > PORTAL.throwLife) {
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
      return { ok: false, mode: H.mode, reason: null, cost: 0 };
    }
    if (H.prop && !H.prop.alive) {
      this.cancel();
      return { ok: false, mode: H.mode, reason: null, cost: 0 };
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
    const boost = H.mode === 'catch' ? (H.threat?.kind === 'charge' ? PORTAL.throwSpeed.catch : 0) : PORTAL.throwSpeed[H.mode as 'grab' | 'load' | 'hijack'];
    const lock = this.lockOn(ray.origin, ray.dir, H.enemy);
    let frame: Frame;
    let reason: string | null = null;
    if (lock) {
      frame = this.facing(lock, ray.origin, H.mode === 'catch' && boost === 0 ? 3.2 : 2.4);
      if (h.rifts.blocked(frame.position)) reason = 'aim.blocked';
    } else {
      const lf = launchFrame(h, ray.origin, ray.dir, along, PORTAL.reach);
      frame = lf.frame;
      reason = lf.reason;
    }
    H.launch = { frame, boost, aimAt: lock ? lock.id : -1, valid: !reason, reason };
    // a CATCH whose exit couldn't open at once: it opens where you aim, as soon as that's somewhere
    if (H.mode === 'catch' && !H.live && !reason) H.live = this.openCatchAt(H, frame, boost, lock ? lock.id : H.sender ? H.sender.id : -1);
    if (H.live) {
      // the real exit is right there: it follows the aim, no ghost needed
      if (!reason) {
        h.rifts.moveExit(frame);
        h.rifts.setExitAimAt(lock ? lock.id : -1);
      }
      H.aim = null;
      this.arcN = 0;
      if (boost <= 0) return;
    }
    // the arc of what comes out (bodies; shots fly straight)
    if (boost > 0) {
      const n = frameNormal(frame, _b);
      const res = simulateArc(h, frame.position, _c.copy(n).multiplyScalar(boost), this.arc, { enemies: h.enemies.list, skipId: H.enemy?.id });
      this.arcN = reason ? 0 : res.n;
      this.arcOutcome = res.outcome;
      H.aim = H.live ? null : this.launchAim(frame, n, res.end, !reason, reason, res.outcome);
    } else {
      this.arcN = 0;
      H.aim = this.launchAim(frame, frameNormal(frame, _b), frame.position, !reason, reason, 'safe');
    }
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

  /** AIR / CATCH: the exit opens with the entrance. */
  private openLiveExit(H: Hold): boolean {
    const h = this.h;
    if (H.mode === 'air') {
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
    // CATCH: back at the man it came from; a charging body goes over the edge / off the roof
    const th = H.threat;
    if (th && th.kind === 'charge') {
      const spot = throwSpot(h, h.playerFeet());
      if (!spot) return false;
      const ok = h.rifts.placeExitFrame(spot.frame, null, { boost: Math.max(spot.boost, PORTAL.throwSpeed.catch), noPlayer: true });
      if (ok) h.rifts.setPairNoPlayer(true);
      return ok;
    }
    const s = H.sender;
    const f = s ? this.senderDoor(s) : null;
    if (!f) {
      // no one to send it back to: straight up out of harm's way
      const up = skyHatch(h, h.playerFeet(), 12, 3);
      if (!up) return false;
      up.quaternion.copy(orientFrame(UP, FWD));
      const ok = h.rifts.placeExitFrame(up, null, { noPlayer: true });
      if (ok) h.rifts.setPairNoPlayer(true);
      return ok;
    }
    const ok = h.rifts.placeExitFrame(f, null, { aimAt: s!.id, noPlayer: true });
    if (ok) h.rifts.setPairNoPlayer(true);
    return ok;
  }

  /** Open a CATCH's exit at a launcher frame (only for what it caught). */
  private openCatchAt(H: Hold, f: Frame, boost: number, aimAt: number): boolean {
    const h = this.h;
    if (!h.rifts.placeExitFrame(f, null, { boost, aimAt, noPlayer: true })) return false;
    h.rifts.setPairNoPlayer(true);
    return true;
  }

  /** Who fired / threw / charges it: the live enemy nearest where it came from. */
  private senderOf(th: Threat | null): EnemyView | null {
    if (!th) return null;
    let best: EnemyView | null = null;
    let bd = th.kind === 'grenade' ? 60 : 4;
    const feet = this.h.playerFeet();
    for (const e of this.h.enemies.list) {
      if (!e.alive || !this.h.live(e)) continue;
      // a grenade's thrower: the nearest man in a fight; the rest start at his muzzle / body
      const d = th.kind === 'grenade' ? (e.aware ? e.pos.distanceTo(feet) : Infinity) : e.chest(_a).distanceTo(th.from);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** A door beside him (else in front of him), facing him: what comes out goes into him. */
  private senderDoor(t: EnemyView): Frame | null {
    return besideDoor(this.h, t, this.h.playerFeet());
  }

  /** A hole right under a hanging load (on the ground under it when that's a real drop). */
  private openUnderHanging(pr: Prop): boolean {
    const h = this.h;
    const hp = pr.body.pos;
    const w = h.world;
    const gy = w.groundAt(hp.x, hp.z, 0.3, hp.y - 0.1);
    const host = w.lastGround;
    const steadyNear = h.enemies.list.some((e) => e.alive && steadyOf(e) && Math.hypot(e.pos.x - hp.x, e.pos.z - hp.z) < LAW.enemyClearance + e.radius && Math.abs(e.pos.y - gy) < 1);
    const onGround = gy > -Infinity && hp.y - gy > 3 && !!host && !host.noPortal && !steadyNear;
    const q = orientFrame(UP, FWD);
    return h.rifts.openEntranceFrame(
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
    const ok = (at?: V3): PortalResult => ({ ok: true, mode: H.mode, reason: null, cost: 0, at, enemy: H.enemy });
    const lost = (reason: string | null): PortalResult => {
      // nowhere to put it: the entrance closes, whoever was held climbs out
      this.hold = H;
      this.cancel();
      return { ok: false, mode: H.mode, reason, cost: 0, enemy: H.enemy };
    };
    switch (H.mode) {
      case 'air':
        return H.live ? ok(h.rifts.playerEnds().exit?.position) : lost('aim.space');
      case 'catch': {
        if (!H.live && H.launch?.valid) H.live = this.openCatchAt(H, H.launch.frame, H.launch.boost, H.launch.aimAt);
        return H.live ? ok(h.rifts.playerEnds().exit?.position) : lost('aim.space');
      }
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
          if (!h.rifts.placeExitFrame(f)) return lost('gate.blocked');
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
        const spot = this.throwTarget(H, tap, e.pos);
        if (!spot) return lost('portal.nowhere');
        if (!h.rifts.placeExitFrame(spot.frame, null, { boost: spot.boost, noPlayer: true })) return lost('gate.blocked');
        h.rifts.setPairNoPlayer(true);
        h.enemies.hold(e, false);
        h.enemies.launch(e, new THREE.Vector3(0, -9, 0));
        // (still drawn sunk until he's through: no pop back up for the frames it takes)
        h.enemies.setSink(e, H.sink);
        this.thrown = { t: 0, key: `enemy:${e.id}`, crossedT: -1, enemy: e };
        return ok(spot.frame.position);
      }
      case 'load': {
        const pr = H.prop!;
        let spot = !tap && H.launch?.valid ? { frame: H.launch.frame, boost: H.launch.boost } : null;
        if (!spot) spot = this.loadAuto(pr);
        if (!spot) return lost('portal.nowhere');
        if (!h.rifts.placeExitFrame(spot.frame, null, { boost: spot.boost, noPlayer: true })) return lost('gate.blocked');
        h.rifts.setPairNoPlayer(true);
        pr.touched = true;
        if (pr.hanging) h.props.release(pr);
        else {
          pr.body.vel.set(0, -6, 0);
          pr.body.onGround = false;
        }
        this.thrown = { t: 0, key: pr.key, crossedT: -1 };
        return ok(spot.frame.position);
      }
      case 'hijack': {
        const out = h.rifts.gateOut(H.gate!);
        const spot = this.throwTarget(H, tap, out ? out.position : h.playerFeet());
        if (!spot) return lost('portal.nowhere');
        if (!h.rifts.placeExitFrame(spot.frame, null, { boost: spot.boost, noPlayer: true })) return lost('gate.blocked');
        h.rifts.hijackGate(H.gate!);
        return ok(spot.frame.position);
      }
    }
  }

  /** Aimed (valid) launcher end, else where a throw does most from `from`. */
  private throwTarget(H: Hold, tap: boolean, from: V3): { frame: Frame; boost: number } | null {
    if (!tap && H.launch?.valid) return { frame: H.launch.frame, boost: H.launch.boost };
    const spot = throwSpot(this.h, from, 22, this.h.playerFeet());
    if (!spot) return null;
    return { frame: spot.frame, boost: Math.max(spot.boost, H.mode === 'grab' ? 12 : 8) };
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
      if (sky && !h.rifts.blocked(sky.position)) return { frame: sky, boost: 8 };
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
