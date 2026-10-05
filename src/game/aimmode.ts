import * as THREE from 'three';
import type { HitInfo, KillEvent, RaySegment, RiftEnd, RiftEndKind, V3 } from '../core/contracts';
import { LAW } from '../core/contracts';
import type { CollisionWorld } from '../world/collision';
import type { Enemy, EnemySystem } from '../actors/enemies';
import { AimAI, type AimAIPortal } from '../actors/aimai';
import { RedPortals } from '../actors/reachai';
import type { Audio } from '../engine/audio';
import type { LabWave } from '../world/combatlab/layout';
import { AimHud, type AimHudState, type AimStab } from '../ui/aimhud';
import type { ThreatArrow } from '../ui/reachhud';
import { t } from '../ui/i18n';
import type { Character } from './characters';
import type { FxKit } from './fxkit';
import type { LabTool } from './labdirector';
import type { Player } from './player';
import type { RiftFrame } from './portalMath';
import type { RiftColorKey } from './portals';
import {
  AIMP,
  aimKillTool,
  crosshairTarget,
  fitSnap,
  guarded,
  inFrontOf,
  newSpot,
  nearSpot,
  notices,
  pickSide,
  placeExit,
  pullSpot,
  rayCylinder,
  shieldCross,
  spotFrame,
  standingBy,
  yawTo,
  type Side,
  type Spot,
} from './aimportal';
import { AIM_CYAN, AIM_RED, AimFx } from './aimfx';
import { edgeArrow, flat } from './reach';

/** The rift system as AIM PORTAL uses it (its pair is a strike pair). */
export interface AimRifts {
  openStrike(a: RiftFrame & { kind: RiftEndKind }, b: RiftFrame & { kind: RiftEndKind }, life: number, boost?: number, aimAt?: number, colors?: [RiftColorKey, RiftColorKey]): number;
  closeStrike(id: number): void;
  strikeEnds(id: number): { a: RiftEnd; b: RiftEnd } | null;
  moveStrikeExit(id: number, f: RiftFrame & { kind: RiftEndKind }): boolean;
  moveStrikeEntrance(id: number, f: RiftFrame & { kind: RiftEndKind }): boolean;
  raycastThrough(origin: V3, dir: V3, maxDist: number, world: CollisionWorld, maxHops?: number): RaySegment[];
}

/** What AIM PORTAL needs from the game. */
export interface AimHost {
  readonly world: CollisionWorld;
  readonly enemies: EnemySystem;
  readonly fx: FxKit;
  readonly audio: Audio;
  readonly camera: THREE.Camera;
  readonly player: Player;
  readonly hero: Character;
  readonly rifts: AimRifts;
  aimRay(): { origin: V3; dir: V3 };
  /** The ray through a screen point (NDC -1..1). */
  rayAt(x: number, y: number): { origin: V3; dir: V3 };
  eye(out: THREE.Vector3): THREE.Vector3;
  device(): 'kbm' | 'pad' | 'touch';
  /** Game time (s). */
  time(): number;
  alive(): boolean;
  safe(): boolean;
  fighting(): boolean;
  /** Solid floor to stand on at (x, z) about level `y`: its top, else null. */
  standAt(x: number, z: number, y: number): number | null;
  hurt(amount: number, from: V3): void;
  hitstop(s: number): void;
  shake(k: number): void;
  kick(k: number): void;
  /** One of their rounds (a mirror's returned one, from `from` along `dir`). */
  fireEnemyBolt(e: Enemy, from: V3, dir: V3): void;
  /** The telegraph (their red laser) and the rest of the enemy hooks. */
  laser(e: Enemy, from: V3, to: V3, t01: number): void;
  /** A man down: the rest of his side's rounds find nobody of his. */
  vibrate(ms: number): void;
}

/** The game's input to AIM PORTAL this frame. */
export interface AimInput {
  fire: boolean;
  firePress: boolean;
  /** PORTAL: RMB / LT / the button. */
  portal: boolean;
  portalPress: boolean;
  portalRelease: boolean;
  /** SNAP held (Ctrl / MMB / R-stick with LT / a drag from PORTAL). */
  snap: boolean;
  /** Its side choice: x right, y up (a flick, a stick, a drag), -1..1. */
  snapVec: { x: number; y: number };
  stabPress: boolean;
  pullPress: boolean;
  /** Wheel steps this frame (+: further). */
  wheel?: number;
  /** A tap on the world (touch), screen NDC. */
  worldTap?: { x: number; y: number } | null;
}

/** The open pair. */
export interface AimPair {
  id: number;
  strike: number;
  /** The entrance, in front of you. */
  readonly near: Spot;
  /** The exit, where you aimed. */
  readonly far: Spot;
  /** Seconds since it opened (or since you let go of it). */
  t: number;
  readonly seen: Map<number, number>;
  readonly noticed: Set<number>;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _ndc = new THREE.Vector3();

/** AIM PORTAL in the game (the lab's variant; DESIGN §14): your pair, your rifle and knife through it, the pull and the throw, the three kinds of man, their look and HUD. */
export class AimMode {
  readonly portals = new RedPortals();
  readonly ai: AimAI;
  readonly fx = new AimFx();
  readonly hud: Pick<AimHud, 'update' | 'callout' | 'show' | 'dispose' | 'tip'>;
  pair: AimPair | null = null;
  /** The ghost while PORTAL is held (live re-aim) or SNAP has a man. */
  ghost: { spot: Spot; kind: 'ok' | 'snap' | 'bad' } | null = null;
  /** The man SNAP is on, and the side it would pick. */
  snapTarget: Enemy | null = null;
  snapSide: Side | null = null;
  /** Mid-air distance (null: the surface the aim meets, else AIMP.air.def). */
  airDist: number | null = null;
  ammo: number = AIMP.rifle.mag;
  /** Seconds of reload left (0: not reloading). */
  reloadT = 0;
  /** Press → portal usable, the last time (ms of game time), for the harness. */
  lastOpen = { t: -1, count: 0, ms: -1 };
  /** The man in your hands (pulled; his time left to throw). */
  held: { id: number; t: number } | null = null;
  private pairSeq = 0;
  private cd = 0;
  private fireCd = 0;
  private stabCd = 0;
  private knifeUntil = -1;
  private firedT = -99;
  private holdT = -1;
  private wasPortal = false;
  private pulls: { id: number; phase: 'in' | 'out'; from: THREE.Vector3; to: THREE.Vector3; t: number }[] = [];
  /** What of yours hit him last, and when. */
  private lastHit = new Map<number, { tool: 'rifle' | 'knife'; t: number }>();
  private thrown = new Set<number>();
  private ported = new Set<number>();
  private seenCross = new Set<number>();
  private shown = false;
  private wasGo = false;
  private tipped = false;
  private refusedT = -99;
  /** The aim is on a sealed panel (the chip). */
  private overSealed = false;
  /** The threat arrows this frame (the HUD's; tests read them). */
  arrows: ThreatArrow[] = [];
  /** The snap vector read this frame (touch / pad / flick). */
  private snapVec = { x: 0, y: 0 };
  /** SNAP has latched a man: the game sends the look to the side choice, not the camera. */
  get snapLatched() {
    return !!this.snapTarget;
  }

  /** `hud`: the HUD to drive (tests pass a stand-in); else one is built under `hudRoot`. */
  constructor(private h: AimHost, hudRoot: HTMLElement | null, hud?: Pick<AimHud, 'update' | 'callout' | 'show' | 'dispose' | 'tip'>) {
    this.hud = hud ?? new AimHud(hudRoot!);
    this.ai = new AimAI({
      world: h.world,
      portals: this.portals,
      go: () => h.fighting(),
      player: () => {
        const p = h.player;
        return { pos: p.body.pos, chest: p.chest(_c), eye: h.eye(_eye), alive: h.alive(), safe: h.safe() };
      },
      pair: () => this.aiPair(),
      standAt: (x, z, y) => h.standAt(x, z, y),
      laser: (e, from, to, t01) => h.laser(e, from, to, t01),
      fireBolt: (e, from, dir) => h.fireEnemyBolt(e, from, dir),
      windup: (e, secs) => {
        const c = e.chest(new THREE.Vector3());
        h.fx.flash(c, 4, Math.min(0.5, secs), 0xff1a10);
        h.fx.ring(_a.copy(e.pos).setY(e.pos.y + 0.06), 1, Math.min(0.45, secs), AIM_RED);
        h.audio.shout(c);
      },
      melee: (e, dmg, push) => {
        if (!h.alive() || h.safe()) return;
        h.hurt(dmg, e.pos);
        h.player.body.vel.add(push);
        h.player.body.onGround = false;
        h.fx.sparks(h.player.chest(_a), null, AIM_RED, 10);
      },
      opened: (at) => h.audio.riftOpen(at, 'gate'),
    });
  }

  // ------------------------------------------------------------------
  // Run flow
  // ------------------------------------------------------------------

  show(on: boolean) {
    if (on === this.shown) return;
    this.shown = on;
    this.fx.group.visible = on;
    this.hud.show(on);
    if (!on) this.reset();
  }

  get on() {
    return this.shown;
  }

  newRun() {
    this.tipped = false;
    this.reset();
  }

  reset() {
    this.closePair();
    this.portals.clear();
    this.ai.reset();
    for (const p of this.pulls) this.endPull(p, false);
    this.pulls.length = 0;
    this.lastHit.clear();
    this.thrown.clear();
    this.ported.clear();
    this.seenCross.clear();
    this.held = null;
    this.ghost = null;
    this.snapTarget = null;
    this.snapSide = null;
    this.airDist = null;
    this.ammo = AIMP.rifle.mag;
    this.reloadT = 0;
    this.knifeUntil = -1;
    this.arrows = [];
    this.fx.clear();
    this.h.hero.setHeld(null);
    this.h.player.weaponUp = 0;
  }

  /** A wave's breather: a full magazine, no pair, everyone's mind fresh. */
  beginWave(_def: LabWave) {
    this.reset();
  }

  playerDown() {
    this.closePair();
    this.ghost = null;
    this.held = null;
  }

  onRespawn() {
    this.closePair();
    this.ghost = null;
    this.ammo = AIMP.rifle.mag;
    this.reloadT = 0;
    this.h.hero.setHeld(null);
  }

  /** The lab's KILLS BY TOOL for this death. */
  toolFor(ev: KillEvent): LabTool {
    const now = this.h.time();
    const hit = this.lastHit.get(ev.enemyId);
    const mine = hit && now - hit.t < 0.6 ? hit.tool : null;
    return aimKillTool(ev.cause, mine, this.thrown.has(ev.enemyId), this.ported.has(ev.enemyId));
  }

  /** An end of your pair (a round of theirs through it changes sides by the rules). */
  isPairEnd(end: { position: V3 }): boolean {
    const p = this.pair;
    if (!p) return false;
    const ends = this.h.rifts.strikeEnds(p.strike);
    return !!ends && ((ends.a as object) === end || (ends.b as object) === end);
  }

  /** The near twin (the entrance, in front of you). */
  isNearEnd(end: { position: V3 }): boolean {
    const p = this.pair;
    const ends = p ? this.h.rifts.strikeEnds(p.strike) : null;
    return !!ends && (ends.a as object) === end;
  }

  // ------------------------------------------------------------------
  // Per frame
  // ------------------------------------------------------------------

  update(dt: number, realDt: number, inp: AimInput) {
    const h = this.h;
    const now = h.time();
    const alive = h.alive();
    const go = h.fighting();
    this.cd -= realDt;
    this.fireCd -= dt;
    this.stabCd -= dt;
    if (go && !this.wasGo && !this.tipped) {
      this.tipped = true;
      this.hud.tip(t(`aim.tip.${h.device()}`));
    }
    this.wasGo = go;
    this.snapVec = inp.snapVec;

    // the pair: it shuts by itself (not while you hold the button: it follows your aim)
    const pr = this.pair;
    if (pr) {
      if (!(inp.portal && alive)) pr.t += dt;
      if (pr.t >= AIMP.life) this.closePair();
      else {
        if (pr.t >= AIMP.grace) this.setNoPlayer(pr, false);
        this.updateNotice(pr, dt);
      }
    }

    // SNAP: a man under the crosshair when it is held; he stays yours while it is
    this.updateSnap(alive && go, inp);
    // PORTAL
    this.updatePortal(alive && go, realDt, inp);

    // the weapons
    if (alive && go) {
      if (inp.wheel && !this.snapTarget) {
        const base = this.airDist ?? AIMP.air.def;
        this.airDist = THREE.MathUtils.clamp(base + inp.wheel * AIMP.air.step, AIMP.air.min, AIMP.air.max);
      }
      if (this.held) {
        this.held.t -= dt;
        if (inp.pullPress || inp.firePress) this.throwHeld();
        else if (this.held.t <= 0) this.held = null;
      } else {
        if (inp.pullPress) this.pull();
        if (inp.stabPress && this.stabCd <= 0) this.stab();
        if (inp.fire && this.fireCd <= 0 && this.reloadT <= 0) this.shoot();
        else if (inp.firePress && this.reloadT > 0) h.audio.ui('deny');
      }
    }
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.ammo = AIMP.rifle.mag;
        this.reloadT = 0;
      }
    }

    this.updatePulls(dt);
    this.portals.update(dt, (id) => {
      const e = h.enemies.get(id) as Enemy | null;
      return !!e && e.alive;
    });
    for (const p of this.portals.list) {
      if (p.crossedT < 0 || this.seenCross.has(p.id)) continue;
      this.seenCross.add(p.id);
      _a.copy(p.b).setY(p.b.y + 1.1);
      h.fx.riftBurst(_a, _b.set(Math.sin(p.by), 0, Math.cos(p.by)), AIM_RED);
      h.audio.riftPass(_a, 6);
    }
    this.watchPorted();

    // the hero's hands
    const knife = now < this.knifeUntil;
    h.hero.setHeld(knife ? 'knife' : 'rifle');
    const up = knife ? 0 : now - this.firedT < 0.9 ? 1 : 0.5;
    h.player.weaponUp = THREE.MathUtils.damp(h.player.weaponUp, up, 14, realDt);
    for (const e of h.enemies.list) {
      if (!e.alive || !e.aim) continue;
      (e.char as Character).setHeld?.(e.aim === 'rusher' ? 'knife' : null);
    }

    // the look and the HUD
    this.fx.update(dt, {
      ghost: this.ghost,
      shields: this.shields(),
      red: this.portals.list,
    });
    this.arrows = this.threats();
    this.overSealed = false;
    if (alive && go && !this.snapTarget) {
      const ray = h.aimRay();
      const hit = h.world.raycast(ray.origin as THREE.Vector3, ray.dir as THREE.Vector3, AIMP.range + 4);
      this.overSealed = !!hit && !!hit.collider.noPortal;
    }
    const st: AimHudState = {
      device: h.device(),
      ret: this.snapTarget && this.snapSide ? { kind: 'snap', side: this.snapSide, ok: this.ghost?.spot.ok !== false } : this.overSealed ? { kind: 'sealed' } : null,
      compass: this.compass(),
      pair: this.pair ? Math.max(0, AIMP.life - this.pair.t) / AIMP.life : null,
      ammo: this.ammo,
      reload: this.reloadT > 0 ? 1 - this.reloadT / AIMP.rifle.reload : null,
      hold: this.held ? Math.max(0, this.held.t) / AIMP.pull.hold : null,
      stab: alive ? this.stabState() : null,
      go,
      arrows: this.arrows,
    };
    this.hud.update(st);
    for (const [id, tt] of this.lastHit) if (now - tt.t > 3) this.lastHit.delete(id);
  }

  /** What the phone's buttons say: the rounds, whether a pair is open. */
  touchState() {
    return { ammo: this.reloadT > 0 ? t('aim.reload') : String(this.ammo), pair: !!this.pair, hold: !!this.held, snap: !!this.snapTarget };
  }

  // ------------------------------------------------------------------
  // Men
  // ------------------------------------------------------------------

  /** Aim men on their feet (the ones SNAP, a stab and a pull can have). */
  private men(): Enemy[] {
    const out: Enemy[] = [];
    for (const e0 of this.h.enemies.list) {
      const e = e0 as Enemy;
      if (e.alive && e.aim && e.body && !e.held) out.push(e);
    }
    return out;
  }

  private able(e: Enemy) {
    return e.alive && !e.held && (e.state === 'combat' || e.state === 'idle' || e.state === 'patrol' || e.state === 'suspicious' || e.state === 'charge');
  }

  private assist(): number {
    const d = this.h.device();
    return THREE.MathUtils.degToRad(d === 'touch' ? 3.5 : d === 'pad' ? 2.5 : 1.2);
  }

  private underCrosshair(): Enemy | null {
    const ray = this.h.aimRay();
    return crosshairTarget(ray.origin, ray.dir, this.men(), this.assist(), (a, b) => !this.h.world.lineOfSight(a, b), 60);
  }

  private floorOf(e: Enemy): number {
    const g = this.h.world.groundAt(e.pos.x, e.pos.z, 0.3, e.pos.y + 0.6);
    return g > -Infinity ? g : e.pos.y;
  }

  private updateSnap(live: boolean, inp: AimInput) {
    if (!live || !inp.snap) {
      this.snapTarget = null;
      this.snapSide = null;
      return;
    }
    if (!this.snapTarget || !this.snapTarget.alive || this.snapTarget.held) this.snapTarget = this.underCrosshair();
    const e = this.snapTarget;
    this.snapSide = e ? pickSide(inp.snapVec.x, inp.snapVec.y) : null;
  }

  // ------------------------------------------------------------------
  // PORTAL
  // ------------------------------------------------------------------

  /** Where the exit goes now: SNAP's side of the man under it, else the first surface the crosshair meets. */
  placement(ray: { origin: V3; dir: V3 } = this.h.aimRay()): { spot: Spot; kind: 'ok' | 'snap' | 'bad' } {
    const h = this.h;
    if (this.snapTarget && this.snapTarget.alive && this.snapSide) {
      const spot = fitSnap(h.world, this.snapTarget, this.snapSide, this.floorOf(this.snapTarget));
      return { spot, kind: spot.ok ? 'snap' : 'bad' };
    }
    const spot = placeExit(h.world, ray.origin, ray.dir, h.eye(_eye), this.airDist, (x, z, y) => h.world.groundAt(x, z, 0.3, y));
    return { spot, kind: spot.ok ? 'ok' : 'bad' };
  }

  private updatePortal(live: boolean, realDt: number, inp: AimInput) {
    const holding = live && inp.portal;
    if (live && inp.worldTap) this.tapOpen(inp.worldTap);
    else if (live && inp.portalPress && this.cd <= 0) {
      this.holdT = 0;
      this.pressOpen();
    }
    if (holding) this.holdT += realDt;
    // the ghost: SNAP's side of the man; a held PORTAL longer than a tap: the exit follows the crosshair, live
    this.ghost = null;
    if (live && this.snapTarget && this.snapSide) {
      const spot = fitSnap(this.h.world, this.snapTarget, this.snapSide, this.floorOf(this.snapTarget));
      this.ghost = { spot, kind: spot.ok ? 'snap' : 'bad' };
    }
    if (holding && this.pair && (this.holdT > AIMP.live || this.snapTarget)) {
      const p = this.placement();
      this.ghost = { spot: p.spot, kind: p.kind };
      if (p.spot.ok) this.moveFar(p.spot);
    }
    // let go: it stays where it is, its time counted from now
    if (!holding && this.wasPortal && this.pair) this.pair.t = 0;
    this.wasPortal = holding;
    if (!holding) this.holdT = -1;
  }

  /** The PORTAL press: open the pair now, at the crosshair (or SNAP's side). */
  private pressOpen() {
    const p = this.placement();
    this.refuseOrOpen(p.spot);
  }

  /** A tap on the world (touch): open exactly at the surface under the finger; a tap on a man: behind him. */
  private tapOpen(tap: { x: number; y: number }) {
    if (this.cd > 0) return;
    const ray = this.h.rayAt(tap.x, tap.y);
    const man = crosshairTarget(ray.origin, ray.dir, this.men(), this.assist(), (a, b) => !this.h.world.lineOfSight(a, b), 60);
    this.holdT = 0;
    if (man) {
      this.refuseOrOpen(fitSnap(this.h.world, man, 'behind', this.floorOf(man)));
      return;
    }
    const h = this.h;
    const spot = placeExit(h.world, ray.origin, ray.dir, h.eye(_eye), this.airDist, (x, z, y) => h.world.groundAt(x, z, 0.3, y));
    this.refuseOrOpen(spot);
  }

  private refuseOrOpen(spot: Spot) {
    const h = this.h;
    this.cd = AIMP.cooldown;
    if (!spot.ok) {
      this.refusedT = h.time();
      h.audio.aimBuzz(spot.pos);
      if (spot.reason === 'sealed') this.fx.refused(spot.pos, spot.normal);
      this.hud.callout(spot.reason === 'sealed' ? 'aim.sealed' : 'aim.close', 'warn');
      h.vibrate(30);
      return;
    }
    this.openPair(spot);
  }

  /** Open the pair: the exit at `far`, its twin in front of you. */
  openPair(far: Spot) {
    const h = this.h;
    this.closePair();
    const ray = h.aimRay();
    const aim = flat(ray.dir, new THREE.Vector3());
    const feet = h.player.body.pos;
    const v = h.player.body.vel;
    const near = nearSpot(h.world, feet, aim, v.x * aim.x + v.z * aim.z, (x, z, y) => h.world.groundAt(x, z, 0.3, y));
    // (on the crosshair: the camera sits over your shoulder; the twin stands where its ray crosses `ahead`)
    const den = ray.dir.x * aim.x + ray.dir.z * aim.z;
    if (den > 0.2) {
      const ahead = near.dist;
      const s = ((feet.x + aim.x * ahead - ray.origin.x) * aim.x + (feet.z + aim.z * ahead - ray.origin.z) * aim.z) / den;
      const side = (ray.origin.x + ray.dir.x * s - near.pos.x) * aim.z - (ray.origin.z + ray.dir.z * s - near.pos.z) * aim.x;
      const k = THREE.MathUtils.clamp(side, -0.7, 0.7);
      near.pos.x += aim.z * k;
      near.pos.z -= aim.x * k;
    }
    const strike = h.rifts.openStrike(spotFrame(near, 'stand'), spotFrame(far), AIMP.life + 1, 0, -1, ['entrance', 'exit']);
    this.pair = { id: ++this.pairSeq, strike, near, far, t: 0, seen: new Map(), noticed: new Set() };
    this.setNoPlayer(this.pair, true);
    this.faceAim();
    h.hero.play('interact', { fade: 0.05 });
    h.audio.aimPop(far.pos, true);
    h.audio.aimPop(near.pos, false);
    h.fx.ring(_a.copy(far.pos).addScaledVector(far.normal, 0.1), 1.3, 0.3, AIM_CYAN);
    h.fx.flash(far.pos, 3, 0.18, 0x7ff4ff);
    h.fx.flash(near.pos, 2, 0.15, 0xffb060);
    h.vibrate(14);
    this.lastOpen.t = h.time();
    this.lastOpen.ms = typeof performance !== 'undefined' ? performance.now() : -1;
    this.lastOpen.count++;
  }

  private setNoPlayer(p: AimPair, on: boolean) {
    const ends = this.h.rifts.strikeEnds(p.strike);
    if (!ends) return;
    (ends.a as { noPlayer?: boolean }).noPlayer = on;
    (ends.b as { noPlayer?: boolean }).noPlayer = on;
  }

  /** Slide the exit to a new spot (held PORTAL). */
  private moveFar(spot: Spot) {
    const p = this.pair;
    if (!p) return;
    p.far.pos.copy(spot.pos);
    p.far.normal.copy(spot.normal);
    p.far.hdir.copy(spot.hdir);
    p.far.surface = spot.surface;
    p.far.w = spot.w;
    p.far.h = spot.h;
    this.h.rifts.moveStrikeExit(p.strike, spotFrame(p.far));
    p.seen.clear();
    p.noticed.clear();
  }

  closePair() {
    const p = this.pair;
    if (!p) return;
    this.h.rifts.closeStrike(p.strike);
    this.pair = null;
  }

  /** You turn to where you aim (a shot, a stab, a pull all go that way). */
  private faceAim() {
    const d = this.h.aimRay().dir;
    if (Math.abs(d.x) + Math.abs(d.z) > 1e-4) this.h.player.yaw = Math.atan2(d.x, d.z);
  }

  // ------------------------------------------------------------------
  // They notice it
  // ------------------------------------------------------------------

  private updateNotice(p: AimPair, dt: number) {
    const h = this.h;
    for (const e of this.men()) {
      if (p.noticed.has(e.id) || !this.able(e)) continue;
      e.eye(_a);
      if (!notices(_a, e.yaw, p.far.pos) || !h.world.lineOfSight(_a, p.far.pos)) {
        p.seen.delete(e.id);
        continue;
      }
      const s = (p.seen.get(e.id) ?? 0) + dt;
      p.seen.set(e.id, s);
      if (s >= AIMP.notice.time) {
        p.noticed.add(e.id);
        h.audio.shout(e.chest(_b));
      }
    }
  }

  private aiPair(): AimAIPortal | null {
    const p = this.pair;
    if (!p) return null;
    return {
      id: p.id,
      far: p.far.pos,
      farLook: p.far.normal,
      near: p.near.pos,
      noticed: (id) => p.noticed.has(id),
      through: (pt, out) => {
        // (where `pt` by the near twin is, seen through the exit: aim at the exit's middle, a hair toward where it comes out)
        void pt;
        return out.copy(p.far.pos);
      },
    };
  }

  // ------------------------------------------------------------------
  // The rifle
  // ------------------------------------------------------------------

  private shoot() {
    const h = this.h;
    if (this.ammo <= 0) {
      this.startReload();
      return;
    }
    this.ammo--;
    this.faceAim();
    const now = h.time();
    this.fireCd = AIMP.rifle.interval;
    this.firedT = now;
    const ray = h.aimRay();
    const segs = h.rifts.raycastThrough(ray.origin, ray.dir, AIMP.rifle.range, h.world, 2);
    const muzzle = h.hero.heldMuzzle(new THREE.Vector3());
    const assist = this.h.device() === 'touch' ? THREE.MathUtils.degToRad(2) : this.h.device() === 'pad' ? THREE.MathUtils.degToRad(1.2) : 0;
    const men = this.men();
    let endAt: THREE.Vector3 | null = null;
    let killedBy: Enemy | null = null;
    const pieces: [THREE.Vector3, THREE.Vector3][] = [];
    for (let si = 0; si < segs.length; si++) {
      const sg = segs[si];
      const o = sg.from as THREE.Vector3;
      const dir = _d.subVectors(sg.to, sg.from);
      const far = dir.length();
      if (far < 1e-4) continue;
      dir.multiplyScalar(1 / far);
      // the nearest of: a man, a mirror's shield (his own shield first: it is in front of him)
      let bestT = far;
      let hitMan: Enemy | null = null;
      let shield: Enemy | null = null;
      for (const e of men) {
        const dist = Math.hypot(e.pos.x - o.x, e.pos.z - o.z);
        const tt = rayCylinder(o, dir, e.pos, e.radius + 0.05 + Math.tan(assist) * dist, e.height);
        if (tt < 0 || tt > bestT) continue;
        bestT = tt;
        hitMan = e;
        shield = null;
      }
      for (const e of men) {
        if (e.aim !== 'mirror') continue;
        const f = shieldCross(e.pos, e.yaw, sg.from, sg.to);
        if (f === null || f * far > bestT + 1e-6) continue;
        bestT = f * far;
        shield = e;
        hitMan = null;
      }
      const to = sg.hit || si < segs.length - 1 ? sg.to : sg.to;
      if (shield) {
        const at = new THREE.Vector3().copy(o).addScaledVector(dir, bestT);
        pieces.push([si === 0 ? muzzle : o, at]);
        this.shieldTook(shield, at, si === 0 ? h.player.body.pos : segs[si - 1].to);
        endAt = at;
        break;
      }
      if (hitMan) {
        const at = new THREE.Vector3().copy(o).addScaledVector(dir, bestT);
        pieces.push([si === 0 ? muzzle : o, at]);
        this.hitMan(hitMan, at, muzzle, si === 0 ? h.player.body.pos : segs[si - 1].to);
        endAt = at;
        killedBy = hitMan;
        break;
      }
      pieces.push([si === 0 ? muzzle : o, to]);
      if (si === segs.length - 1) {
        endAt = new THREE.Vector3().copy(to);
        if (sg.hit) h.fx.sparks(endAt, sg.hit.normal, AIM_CYAN, 6);
      }
    }
    if (!pieces.length) pieces.push([muzzle, new THREE.Vector3().copy(ray.origin).addScaledVector(ray.dir, AIMP.rifle.range)]);
    for (const [a, b] of pieces) this.fx.tracer(a, b);
    void endAt;
    void killedBy;
    h.fx.flash(muzzle, 2.5, 0.05, 0x7ff4ff);
    h.audio.reachRifle(muzzle);
    h.kick(0.15);
    if (this.ammo <= 0) this.startReload();
  }

  private startReload() {
    this.reloadT = AIMP.rifle.reload;
    this.h.audio.aimReload(this.h.player.body.pos);
  }

  /** A round of yours hit a man. */
  private hitMan(e: Enemy, at: V3, muzzle: V3, from: V3) {
    const h = this.h;
    const now = h.time();
    const info: HitInfo = {
      source: 'bolt',
      amount: AIMP.rifle.damage,
      charged: false,
      team: 'player',
      instigator: 'player',
      dir: _a.subVectors(at, muzzle).normalize().clone(),
      from: new THREE.Vector3().copy(muzzle),
    };
    this.lastHit.set(e.id, { tool: 'rifle', t: now });
    h.enemies.hit(e, info);
    this.ai.attacked(e, from, now);
    h.fx.sparks(at, null, AIM_RED, 10);
    h.audio.boltImpact(at, false);
  }

  /** A mirror's shield took a round: a violet flare; some come back at you. */
  private shieldTook(e: Enemy, at: V3, from: V3) {
    const h = this.h;
    const now = h.time();
    this.fx.shieldHit(e.id);
    h.fx.sparks(at, null, new THREE.Color(1.4, 0.5, 2.2), 8);
    h.audio.shieldClang(at);
    this.ai.attacked(e, from, now);
    if (Math.random() < AIMP.enemy.mirror.returnChance && h.alive()) {
      _b.subVectors(h.player.chest(_c), at).normalize();
      h.fireEnemyBolt(e, _a.copy(at).addScaledVector(_b, 0.3), _b);
    }
  }

  // ------------------------------------------------------------------
  // The knife
  // ------------------------------------------------------------------

  /** What a press of STAB does now. */
  stabState(): AimStab {
    const direct = this.meleeTarget();
    if (direct) return guarded(direct.pos, direct.yaw, this.h.player.body.pos, direct.aim === 'mirror') && this.able(direct) ? 'blocked' : 'melee';
    const thr = this.stabThrough();
    if (!thr) return null;
    return guarded(thr.target.pos, thr.target.yaw, thr.from.pos, thr.target.aim === 'mirror') && this.able(thr.target) ? 'blocked' : 'kill';
  }

  /** The man right in front of you within a stab. */
  private meleeTarget(): Enemy | null {
    const h = this.h;
    const p = h.player.body.pos;
    const ray = h.aimRay();
    const fy = Math.atan2(ray.dir.x, ray.dir.z);
    let bd: number = AIMP.stab.direct;
    let best: Enemy | null = null;
    for (const o of this.men()) {
      const d = Math.hypot(o.pos.x - p.x, o.pos.z - p.z);
      if (d > bd || Math.abs(o.pos.y - p.y) > 1.5) continue;
      let off = Math.atan2(o.pos.x - p.x, o.pos.z - p.z) - fy;
      while (off > Math.PI) off -= Math.PI * 2;
      while (off < -Math.PI) off += Math.PI * 2;
      if (Math.abs(off) > 0.95) continue;
      bd = d;
      best = o;
    }
    return best;
  }

  /**
   * A stab aimed into the pair: the aim ray enters one end (within a stab's
   * way of you), the man standing in front of the other end within its reach.
   */
  private stabThrough(): { target: Enemy; from: Spot; into: Spot } | null {
    const p = this.pair;
    if (!p) return null;
    const h = this.h;
    const ends = h.rifts.strikeEnds(p.strike);
    if (!ends) return null;
    const ray = h.aimRay();
    const segs = h.rifts.raycastThrough(ray.origin, ray.dir, 40, h.world, 1);
    const via = segs.length > 1 ? segs[0].viaEnd : null;
    if (!via) return null;
    const me = h.player.body.pos;
    const intoNear = (via as object) === ends.a;
    const into = intoNear ? p.near : p.far;
    const out = intoNear ? p.far : p.near;
    // (the end you stab into is within a stab's way of you)
    if (_a.copy(into.pos).sub(me).setY(0).length() > 3.6) return null;
    const target = standingBy(out, this.men(), AIMP.stab.reach);
    return target ? { target, from: out, into } : null;
  }

  private stab() {
    const h = this.h;
    this.faceAim();
    this.stabCd = AIMP.stab.cooldown;
    this.knifeUntil = h.time() + 0.3;
    h.hero.play('strike', { fade: 0.04 });
    h.audio.reachSwing(h.player.chest(_a));
    const close = this.meleeTarget();
    if (close) {
      if (guarded(close.pos, close.yaw, h.player.body.pos, close.aim === 'mirror') && this.able(close)) return this.parried(close, h.player.chest(new THREE.Vector3()));
      const p = h.player.body.pos;
      h.player.lunge(_a.set(close.pos.x - p.x, 0, close.pos.z - p.z), 6, 0.12);
      this.knifeKill(close, h.player.chest(new THREE.Vector3()));
      return;
    }
    const thr = this.stabThrough();
    if (!thr) {
      this.stabCd = 0.25;
      return;
    }
    // through it: the blade comes out of the other end
    this.fx.tracer(h.hero.bonePos('RightHand', _b), thr.into.pos, new THREE.Color(2, 2, 2));
    this.fx.tracer(thr.from.pos, _c.set(thr.target.pos.x, thr.target.pos.y + thr.target.height * 0.6, thr.target.pos.z), new THREE.Color(2, 2, 2));
    h.audio.aimWhoosh(thr.from.pos, 0.4);
    if (guarded(thr.target.pos, thr.target.yaw, thr.from.pos, thr.target.aim === 'mirror') && this.able(thr.target)) {
      this.parried(thr.target, thr.from.pos);
      return;
    }
    this.knifeKill(thr.target, thr.from.pos);
  }

  private parried(e: Enemy, at: V3) {
    const h = this.h;
    this.stabCd = 0.5;
    this.hud.callout('aim.parried', 'warn');
    h.fx.sparks(_a.copy(at), null, new THREE.Color(2, 2, 2), 12);
    h.audio.shieldClang(at);
    e.char.play('strike', { fade: 0.04 });
    this.ai.attacked(e, at, h.time());
  }

  private knifeKill(e: Enemy, from: V3) {
    const h = this.h;
    const c = e.chest(new THREE.Vector3());
    this.lastHit.set(e.id, { tool: 'knife', t: h.time() });
    h.enemies.hit(e, { source: 'blade', amount: 999, charged: false, team: 'player', instigator: 'player', dir: _b.subVectors(c, from).normalize().clone(), from: new THREE.Vector3().copy(from) });
    h.hitstop(0.07);
    h.shake(0.22);
    h.fx.sparks(c, null, AIM_RED, 16);
    h.fx.flash(c, 3, 0.08, 0xff3a5a);
    h.audio.bladeFinish(c);
  }

  // ------------------------------------------------------------------
  // Pull and throw
  // ------------------------------------------------------------------

  /** PULL: the man standing in front of the exit is yanked through and lands in front of you, on your aim. */
  pull(): boolean {
    const h = this.h;
    const p = this.pair;
    if (!p) {
      h.audio.ui('deny');
      this.hud.callout('aim.noPair', 'info');
      return false;
    }
    const men = this.men().filter((e) => !this.pulls.some((q) => q.id === e.id));
    const e = standingBy(p.far, men, AIMP.pull.reach);
    if (!e) {
      h.audio.ui('deny');
      this.hud.callout('aim.nobody', 'info');
      return false;
    }
    this.faceAim();
    h.hero.play('interact', { fade: 0.05 });
    h.enemies.hold(e, true, true);
    e.body!.userData.manual = true;
    const into = new THREE.Vector3(p.far.pos.x, p.far.pos.y - Math.min(p.far.h, AIMP.h) / 2 + 0.05, p.far.pos.z);
    if (Math.abs(p.far.normal.y) > 0.9) into.copy(p.far.pos);
    this.pulls.push({ id: e.id, phase: 'in', from: e.pos.clone(), to: into, t: 0 });
    h.audio.reachPull(e.chest(_a));
    h.hitstop(0.06);
    h.shake(0.2);
    return true;
  }

  private updatePulls(dt: number) {
    const h = this.h;
    const P = AIMP.pull;
    for (let i = 0; i < this.pulls.length; ) {
      const q = this.pulls[i];
      const e = h.enemies.get(q.id) as Enemy | null;
      if (!e || !e.alive || !e.body) {
        if (e?.body) e.body.userData.manual = false;
        this.pulls.splice(i, 1);
        continue;
      }
      q.t += dt;
      const len = q.phase === 'in' ? P.through : P.out;
      const k = Math.min(1, q.t / len);
      const ease = q.phase === 'in' ? k * k : 1 - (1 - k) * (1 - k);
      e.body.pos.lerpVectors(q.from, q.to, ease);
      if (q.phase === 'out') e.body.pos.y += Math.sin(Math.PI * k) * P.arc;
      e.body.vel.set(0, 0, 0);
      e.char.root.position.copy(e.body.pos);
      const pl = h.player.body.pos;
      if (q.phase === 'out') e.yaw = Math.atan2(pl.x - e.pos.x, pl.z - e.pos.z);
      h.fx.streak(_a.copy(e.pos).setY(e.pos.y + 1), _b.subVectors(q.to, q.from).multiplyScalar(3), AIM_CYAN);
      if (k < 1) {
        i++;
        continue;
      }
      if (q.phase === 'in') {
        // through: out of the near twin, onto your crosshair
        const pr = this.pair;
        const nearFeet = pr ? _c.set(pr.near.pos.x, pr.near.pos.y - AIMP.h / 2 + 0.05, pr.near.pos.z) : _c.copy(pl);
        if (pr) h.fx.riftBurst(_a.copy(pr.far.pos), pr.far.normal, AIM_CYAN);
        q.from.copy(nearFeet);
        q.to.copy(this.landing());
        q.phase = 'out';
        q.t = 0;
        e.body.pos.copy(nearFeet);
        e.char.root.position.copy(nearFeet);
        if (pr) h.fx.riftBurst(_a.copy(pr.near.pos), pr.near.normal, AIM_CYAN);
        h.audio.aimWhoosh(nearFeet, 0.8);
        // (the pair has done its work: it shuts behind him)
        this.closePair();
        i++;
        continue;
      }
      this.endPull(q, true);
      this.pulls.splice(i, 1);
    }
  }

  /** Where a pulled man lands: AIMP.pull.land in front of you on your aim (nearer if there is no floor). */
  landing(): THREE.Vector3 {
    const h = this.h;
    const aim = flat(h.aimRay().dir, _d);
    const p = h.player.body.pos;
    for (const k of [AIMP.pull.land, 1.6, 1.25]) {
      const at = pullSpot(p, aim, k, new THREE.Vector3());
      const y = h.standAt(at.x, at.z, p.y);
      if (y !== null && h.world.lineOfSight(_a.set(p.x, p.y + 1, p.z), _b.set(at.x, y + 1, at.z))) return at.setY(y);
    }
    return pullSpot(p, aim, 1.2, new THREE.Vector3());
  }

  private endPull(q: { id: number }, landed: boolean) {
    const h = this.h;
    const e = h.enemies.get(q.id) as Enemy | null;
    if (!e) return;
    if (e.body) {
      e.body.userData.manual = false;
      e.body.vel.set(0, 0, 0);
    }
    h.enemies.hold(e, false);
    h.enemies.setSink(e, 0);
    if (!landed || !e.alive) return;
    const pl = h.player.body.pos;
    e.yaw = Math.atan2(pl.x - e.pos.x, pl.z - e.pos.z);
    h.enemies.stagger(e, AIMP.pull.stun);
    this.held = { id: e.id, t: AIMP.pull.hold };
    h.fx.dust(e.pos, 0.8);
    h.fx.ring(_a.copy(e.pos).setY(e.pos.y + 0.05), 1.1, 0.3, AIM_CYAN);
    h.audio.impact(e.pos, 7);
    this.hud.callout('aim.pulled', 'good');
  }

  /** THROW: the man in your hands goes where you aim, a body: it kills on a wall, falls into voids, pools and portals. */
  throwHeld(): boolean {
    const h = this.h;
    const H = this.held;
    this.held = null;
    if (!H) return false;
    const e = h.enemies.get(H.id) as Enemy | null;
    if (!e || !e.alive || !e.body) return false;
    const dir = _a.copy(h.aimRay().dir);
    dir.y = Math.max(dir.y, -0.25);
    dir.normalize();
    const v = new THREE.Vector3().copy(dir).multiplyScalar(AIMP.throw.speed);
    v.y += AIMP.throw.up;
    e.aimThrown = true;
    this.thrown.add(e.id);
    h.enemies.launch(e, v);
    e.body.charge = LAW.chargeTime;
    e.body.peakY = e.body.pos.y;
    this.faceAim();
    h.hero.play('push', { fade: 0.05, speed: 1.6 });
    h.audio.aimWhoosh(e.pos, 1);
    h.hitstop(0.05);
    h.shake(0.25);
    h.fx.streak(_b.copy(e.pos).setY(e.pos.y + 1), v, AIM_CYAN);
    return true;
  }

  /** Men who went through your pair (their fall, their slam, is the pair's). */
  private watchPorted() {
    const p = this.pair;
    if (!p) return;
    const ends = this.h.rifts.strikeEnds(p.strike);
    if (!ends) return;
    for (const e of this.men()) {
      const b = e.body;
      if (!b || !b.lastEnd) continue;
      if ((b.lastEnd as object) === ends.a || (b.lastEnd as object) === ends.b) {
        if (!this.ported.has(e.id)) {
          this.ported.add(e.id);
          e.aimPorted = true;
          this.hud.callout('aim.through', 'info');
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // The HUD's
  // ------------------------------------------------------------------

  private shields() {
    const out: { id: number; pos: V3; yaw: number }[] = [];
    for (const e of this.h.enemies.list) {
      if (e.alive && (e as Enemy).aim === 'mirror') out.push({ id: e.id, pos: e.pos, yaw: e.yaw });
    }
    return out;
  }

  /** The compass round the man SNAP is on, in screen 0..1. */
  private compass(): AimHudState['compass'] {
    const e = this.snapTarget;
    if (!e || !this.snapSide) return null;
    _ndc.set(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z).project(this.h.camera);
    if (_ndc.z > 1) return null;
    return { x: THREE.MathUtils.clamp((_ndc.x + 1) / 2, 0.08, 0.92), y: THREE.MathUtils.clamp((1 - _ndc.y) / 2, 0.12, 0.88), side: this.snapSide, ok: this.ghost?.spot.ok !== false };
  }

  /** Edge arrows for the threats off the screen: a gun on you, a knife coming, a red portal. */
  private threats(): ThreatArrow[] {
    const h = this.h;
    const cam = h.camera;
    const me = h.player.body.pos;
    const out: ThreatArrow[] = [];
    const seen = new Set<string>();
    const add = (p: V3, kind: ThreatArrow['kind'], key: string, urgent: boolean) => {
      if (seen.has(key) || out.length >= 8) return;
      _ndc.copy(p).applyMatrix4(cam.matrixWorldInverse);
      const behind = _ndc.z > 0;
      _ndc.copy(p).project(cam);
      const ang = edgeArrow(_ndc.x, _ndc.y, behind);
      if (ang === null) return;
      seen.add(key);
      out.push({ ang, kind, urgent });
    };
    for (const p of this.portals.list) {
      if (p.crossedT >= 0) continue;
      add(_c.copy(p.b).setY(p.b.y + 1.1), 'portal', `p${p.id}`, p.b.distanceTo(me) < 10);
    }
    for (const e of h.enemies.list) {
      if (!e.alive || !(e as Enemy).aim) continue;
      const en = e as Enemy;
      if (this.ai.aiming(e.id)) add(e.chest(_b), 'gun', `e${e.id}`, true);
      else if (en.aim !== 'gunner' && e.pos.distanceTo(me) < 12) add(e.chest(_b), 'knife', `e${e.id}`, e.pos.distanceTo(me) < 6);
    }
    return out;
  }

  dispose() {
    this.hud.dispose();
    this.fx.clear();
  }
}

// (re-exported for the tests)
export { AimAI, inFrontOf, newSpot, yawTo };
