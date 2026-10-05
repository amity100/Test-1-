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
  fitSnap,
  guarded,
  inFrontOf,
  leadPos,
  magnetTarget,
  newSpot,
  nearSpot,
  noticeDelay,
  pickSide,
  placeExit,
  pullSpot,
  rayCylinder,
  shieldCross,
  spotFrame,
  standingBy,
  tapTarget,
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
  /** Give a strike pair this long to live from now (s). */
  setStrikeLife?(id: number, life: number): void;
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
  /** Their red laser (a burst coming), 0..1. */
  laser(e: Enemy, from: V3, to: V3, t01: number): void;
  /** A haptic tick (phones). */
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
  /** The side choice held on its own (Ctrl / MMB; R-stick with LT; a drag from PORTAL): with a man under the crosshair the look picks his side. */
  snap: boolean;
  /** The side choice: x right, y up (a flick, a stick, a drag), -1..1. */
  snapVec: { x: number; y: number };
  stabPress: boolean;
  pullPress: boolean;
  /** GO (Q / B / the GO button): into the near twin, out of the exit. */
  goPress?: boolean;
  /** Wheel steps this frame (+: further). */
  wheel?: number;
  /** A tap on the world (touch): screen NDC, and the screen's size in CSS px (`w`, `h`). */
  worldTap?: { x: number; y: number; w?: number; h?: number } | null;
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
  /** The man it opened next to (null: a free spot), and the side. */
  man: number | null;
  side: Side;
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
  /** The ghost: where PORTAL would open the exit (the crosshair on a man: next to him), or the side being picked. */
  ghost: { spot: Spot; kind: 'ok' | 'snap' | 'bad' } | null = null;
  /** The man the crosshair is on (PORTAL opens next to him; the HUD rings him). */
  hover: Enemy | null = null;
  /** The man whose side is being picked (PORTAL held on him, or the side key), and the side. */
  snapTarget: Enemy | null = null;
  snapSide: Side | null = null;
  /** GO under way: seconds into the dash, the pair it is for. */
  dash: { t: number; pair: number } | null = null;
  /** Until when (game time) the knife reaches further (just out of the exit). */
  edgeUntil = -1;
  /** Mid-air distance (null: the surface the aim meets, else AIMP.air.def). */
  airDist: number | null = null;
  ammo: number = AIMP.rifle.mag;
  /** Seconds of reload left (0: not reloading). */
  reloadT = 0;
  /** Press → portal usable, the last time (ms of game time), for the harness. */
  lastOpen = { t: -1, count: 0, ms: -1 };
  /** What was used how often this run (the harness and the balance read it). */
  readonly usage = { opened: 0, refused: 0, rifleDirect: 0, rifleThrough: 0, stabDirect: 0, stabThrough: 0, parried: 0, pulled: 0, thrown: 0, snapped: 0, go: 0, edge: 0 };
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
  /** Presses waiting for GO to land (game time; -99: none). */
  private bufStab = -99;
  private bufFire = -99;
  /** You came out of the exit (game time): what was pressed on the way lands next frame. */
  private arrivedT = -99;
  private closeAt = -1;
  /** Where you stood last frame (the near twin slides sideways with you). */
  private lastFeet = new THREE.Vector3();
  private hasFeet = false;
  /** The side is being picked: the game sends the look to the choice, not the camera. */
  get snapLatched() {
    return !!this.snapTarget && !!this.snapSide && this.choosing;
  }
  private choosing = false;

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
    this.hover = null;
    this.snapTarget = null;
    this.snapSide = null;
    this.choosing = false;
    this.endDash();
    this.edgeUntil = -1;
    this.bufStab = this.bufFire = this.arrivedT = -99;
    this.closeAt = -1;
    this.airDist = null;
    this.ammo = AIMP.rifle.mag;
    this.reloadT = 0;
    this.knifeUntil = -1;
    this.arrows = [];
    this.fx.clear();
    this.h.hero.setHeld(null);
    this.h.player.weaponUp = 0;
  }

  /** A wave's breather: a full magazine, no pair, everyone's mind fresh, the last wave's bodies gone. */
  beginWave(_def: LabWave) {
    this.reset();
    this.h.enemies.clearDead?.();
  }

  playerDown() {
    this.closePair();
    this.endDash();
    this.ghost = null;
    this.held = null;
  }

  onRespawn() {
    this.closePair();
    this.endDash();
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

  /** Your aim (flat) is within AIMP.near.cone° of the way into the near twin (a round goes in). */
  private intoNear(dir: V3): boolean {
    const p = this.pair;
    if (!p) return false;
    const n = p.near.normal;
    const l = Math.hypot(dir.x, dir.z);
    if (l < 1e-6) return true;
    return -(dir.x * n.x + dir.z * n.z) / l >= Math.cos(THREE.MathUtils.degToRad(AIMP.near.cone));
  }

  /** The near twin (the entrance, in front of you). */
  isNearEnd(end: { position: V3 } | null | undefined): boolean {
    if (!end) return false;
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

    // the pair: it shuts by itself (not while you hold the button: it follows your aim), or just after you came out of it
    const pr = this.pair;
    if (pr) {
      if (!(inp.portal && alive)) pr.t += dt;
      if (pr.t >= AIMP.life || (this.closeAt >= 0 && now >= this.closeAt)) this.closePair();
      else {
        if (pr.t >= AIMP.grace) this.setNoPlayer(pr, false);
        this.updateNotice(pr, dt);
      }
    }
    if (!this.pair) this.closeAt = -1;

    // the man the crosshair is on (PORTAL opens next to him)
    this.hover = alive && go && !this.held && !this.dash ? this.underCrosshair() : null;
    // the side: picked while PORTAL is held on him (or with the side key)
    this.updateSnap(alive && go, inp);
    // PORTAL
    this.updatePortal(alive && go, realDt, inp);
    // GO, and what you pressed on the way
    if (alive && go && inp.goPress) this.go();
    this.updateDash(dt);
    this.followNear();

    // the weapons
    if (alive && go) {
      if (inp.wheel && !this.snapTarget) {
        const base = this.airDist ?? AIMP.air.def;
        this.airDist = THREE.MathUtils.clamp(base + inp.wheel * AIMP.air.step, AIMP.air.min, AIMP.air.max);
      }
      if (this.dash) {
        // (mid-dash: kept for the arrival)
        if (inp.stabPress) this.bufStab = now;
        if (inp.firePress) this.bufFire = now;
      } else if (this.held) {
        this.held.t -= dt;
        if (inp.pullPress || inp.firePress) this.throwHeld();
        else if (this.held.t <= 0) this.held = null;
      } else {
        const landed = now - this.arrivedT < 0.2;
        if (landed && now - this.bufStab <= AIMP.go.buffer + 0.2 && this.stabCd <= 0) {
          this.bufStab = -99;
          this.stab();
        }
        const bufFire = landed && now - this.bufFire <= AIMP.go.buffer + 0.2;
        if (bufFire) this.bufFire = -99;
        if (inp.pullPress) this.pull();
        if (inp.stabPress && this.stabCd <= 0) this.stab();
        if ((inp.fire || bufFire) && this.fireCd <= 0 && this.reloadT <= 0) this.shoot();
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
    const ring = this.snapTarget ?? this.hover;
    this.fx.update(dt, {
      ghost: this.ghost,
      shields: this.shields(),
      red: this.portals.list,
      target: ring ? { pos: ring.pos, radius: ring.radius, picking: !!this.snapTarget } : null,
    });
    this.arrows = this.threats();
    this.overSealed = false;
    if (alive && go && !this.snapTarget && !this.hover) {
      const ray = h.aimRay();
      const hit = h.world.raycast(ray.origin as THREE.Vector3, ray.dir as THREE.Vector3, AIMP.range + 4);
      this.overSealed = !!hit && !!hit.collider.noPortal;
    }
    const st: AimHudState = {
      device: h.device(),
      // (the side being picked: its word is on the compass round him; this chip is for a sealed panel under the crosshair)
      ret: this.overSealed && !this.snapLatched ? { kind: 'sealed' } : null,
      compass: this.compass(),
      mark: this.markOf(),
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

  /** What the phone's buttons say: the rounds, whether a pair is open (GO lit), a man under the crosshair. */
  touchState() {
    return { ammo: this.reloadT > 0 ? t('aim.reload') : String(this.ammo), pair: !!this.pair, hold: !!this.held, snap: this.snapLatched, go: !!this.pair && !this.dash, target: !!this.hover };
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

  /** How far off a man the crosshair may be and still be on him (rad; by device). */
  private assist(): number {
    const d = this.h.device();
    return THREE.MathUtils.degToRad(AIMP.magnet.deg[d]);
  }

  private underCrosshair(): Enemy | null {
    const ray = this.h.aimRay();
    return magnetTarget(ray.origin, ray.dir, this.men(), this.assist(), (a, b) => !this.h.world.lineOfSight(a, b));
  }

  private floorOf(e: Enemy): number {
    const g = this.h.world.groundAt(e.pos.x, e.pos.z, 0.3, e.pos.y + 0.6);
    return g > -Infinity ? g : e.pos.y;
  }

  /**
   * The exit for a side of a man: next to where he will be in a moment, seen
   * from where you stand. The default side (BEHIND) with no room there (his
   * back to a wall, sealed metal): the first of his sides, then over his head,
   * that has room.
   */
  spotFor(e: Enemy, side: Side, fallback = side === 'behind'): Spot {
    const me = this.h.player.body.pos;
    const b = e.body;
    const at = b && !b.simulate ? leadPos(e.pos, b.vel, AIMP.magnet.lead, new THREE.Vector3()) : e.pos.clone();
    const view = new THREE.Vector3(e.pos.x - me.x, 0, e.pos.z - me.z);
    if (view.lengthSq() < 1e-6) view.set(Math.sin(this.h.player.yaw), 0, Math.cos(this.h.player.yaw));
    view.normalize();
    const body = { pos: at, yaw: e.yaw, height: e.height };
    const floor = this.floorOf(e);
    const spot = fitSnap(this.h.world, body, side, floor, view);
    if (spot.ok || !fallback) return spot;
    for (const s of ['left', 'right', 'above'] as const) {
      const o = fitSnap(this.h.world, body, s, floor, view);
      if (o.ok) return o;
    }
    return spot;
  }

  /** The side choice: PORTAL held on a man past a tap (or the side key with a man under the crosshair); its flick picks the side. */
  private updateSnap(live: boolean, inp: AimInput) {
    // (PORTAL held since a press that opened next to a man: that man)
    const p = this.pair;
    const onMan = live && inp.portal && this.holdT >= 0 && p && p.man !== null ? (this.h.enemies.get(p.man) as Enemy | null) : null;
    if (onMan && onMan.alive && !onMan.held) {
      this.snapTarget = onMan;
      this.choosing = this.holdT >= AIMP.snap.pick || inp.snap;
      this.snapSide = this.choosing ? pickSide(inp.snapVec.x, inp.snapVec.y) : p!.side;
      return;
    }
    if (live && inp.snap) {
      // (the side key on its own: a man under the crosshair is held for the press)
      if (!this.snapTarget || !this.snapTarget.alive || this.snapTarget.held) this.snapTarget = this.hover;
      this.choosing = !!this.snapTarget;
      this.snapSide = this.snapTarget ? pickSide(inp.snapVec.x, inp.snapVec.y) : null;
      return;
    }
    this.snapTarget = null;
    this.snapSide = null;
    this.choosing = false;
  }

  // ------------------------------------------------------------------
  // PORTAL
  // ------------------------------------------------------------------

  /** Where the exit goes now: next to the man the crosshair is on (or whose side is picked), else the first surface the crosshair meets. */
  placement(ray: { origin: V3; dir: V3 } = this.h.aimRay()): { spot: Spot; kind: 'ok' | 'snap' | 'bad'; man: Enemy | null; side: Side } {
    const h = this.h;
    const man = this.snapTarget && this.snapTarget.alive ? this.snapTarget : this.hover;
    if (man) {
      const side = this.snapTarget && this.snapSide ? this.snapSide : 'behind';
      const spot = this.spotFor(man, side);
      return { spot, kind: spot.ok ? 'snap' : 'bad', man, side };
    }
    const spot = placeExit(h.world, ray.origin, ray.dir, h.eye(_eye), this.airDist, (x, z, y) => h.world.groundAt(x, z, 0.3, y));
    return { spot, kind: spot.ok ? 'ok' : 'bad', man: null, side: 'behind' };
  }

  private updatePortal(live: boolean, realDt: number, inp: AimInput) {
    const holding = live && inp.portal;
    if (live && inp.worldTap) this.tapOpen(inp.worldTap);
    else if (live && inp.portalPress && this.cd <= 0 && !this.dash) {
      this.holdT = 0;
      this.pressOpen();
    }
    if (holding) this.holdT += realDt;
    this.ghost = null;
    const p = this.pair;
    if (holding && p && this.holdT >= 0) {
      if (p.man !== null && this.snapTarget) {
        // on a man: the exit stays next to him (where he goes, on the side the flick picks)
        const side = this.snapSide ?? p.side;
        const spot = this.spotFor(this.snapTarget, side);
        if (spot.ok) {
          p.side = side;
          this.moveFar(spot);
        } else this.ghost = { spot, kind: 'bad' };
      } else if (p.man === null && this.holdT > AIMP.live) {
        // off a man: the exit follows the crosshair, live
        const pl = this.placement();
        if (!pl.man) {
          this.ghost = { spot: pl.spot, kind: pl.kind };
          if (pl.spot.ok) this.moveFar(pl.spot);
        }
      }
    } else if (live && !this.dash) {
      // not pressed: where it would open (the crosshair on a man: next to him; the side key: the side picked)
      const man = this.snapTarget ?? this.hover;
      // (the pair already stands by him: no ghost on top of it; the side key shows the side it would pick)
      if (man && (this.snapTarget || !(p && p.man === man.id))) {
        const spot = this.spotFor(man, this.snapTarget && this.snapSide ? this.snapSide : 'behind');
        this.ghost = { spot, kind: spot.ok ? 'snap' : 'bad' };
      }
    }
    // let go: it stays where it is, its time counted from now
    if (!holding && this.wasPortal && this.pair) {
      this.pair.t = 0;
      this.h.rifts.setStrikeLife?.(this.pair.strike, AIMP.life + 1);
    }
    this.wasPortal = holding;
    if (!holding) this.holdT = -1;
  }

  /** The PORTAL press: open the pair now, next to the man the crosshair is on (or the side picked), else at the crosshair. */
  private pressOpen() {
    const p = this.placement();
    this.refuseOrOpen(p.spot, p.man, p.side);
  }

  /**
   * A tap on the world (touch): on or near a man (on the screen), next to him
   * (behind); else right at the surface under the finger, unless a pair is
   * open (a quick nudge of the look thumb is no reason to lose it: PORTAL
   * moves it).
   */
  private tapOpen(tap: { x: number; y: number; w?: number; h?: number }) {
    if (this.cd > 0 || this.dash) return;
    const h = this.h;
    const W = tap.w ?? 844, Hh = tap.h ?? 390;
    const cam = h.camera;
    const man = tapTarget(
      ((tap.x + 1) / 2) * W,
      ((1 - tap.y) / 2) * Hh,
      this.men(),
      (p) => {
        _ndc.copy(p).project(cam);
        return _ndc.z > 1 ? null : { x: ((_ndc.x + 1) / 2) * W, y: ((1 - _ndc.y) / 2) * Hh };
      },
      (to) => !h.world.lineOfSight(cam.position, to),
    );
    if (man) {
      this.holdT = 0;
      this.refuseOrOpen(this.spotFor(man, 'behind'), man, 'behind');
      return;
    }
    if (this.pair) return;
    this.holdT = 0;
    const ray = h.rayAt(tap.x, tap.y);
    const spot = placeExit(h.world, ray.origin, ray.dir, h.eye(_eye), this.airDist, (x, z, y) => h.world.groundAt(x, z, 0.3, y));
    this.refuseOrOpen(spot, null, 'behind');
  }

  private refuseOrOpen(spot: Spot, man: Enemy | null = null, side: Side = 'behind') {
    const h = this.h;
    this.cd = AIMP.cooldown;
    if (!spot.ok) {
      this.refusedT = h.time();
      this.usage.refused++;
      h.audio.aimBuzz(spot.pos);
      if (spot.reason === 'sealed') this.fx.refused(spot.pos, spot.normal);
      this.hud.callout(spot.reason === 'sealed' ? 'aim.sealed' : 'aim.close', 'warn');
      h.vibrate(30);
      return;
    }
    this.openPair(spot, man, side);
  }

  /**
   * Open the pair: the exit at `far` (next to `man`, on `side`), its twin
   * right in front of you on the crosshair. A pair already open just jumps
   * there (no collapsing twin in your face while the new one opens).
   */
  openPair(far: Spot, man: Enemy | null = null, side: Side = 'behind') {
    const h = this.h;
    this.closeAt = -1;
    const ray = h.aimRay();
    const aim = flat(ray.dir, new THREE.Vector3());
    const v = h.player.body.vel;
    const near = nearSpot(h.world, h.player.chest(_c), ray, v.x * aim.x + v.z * aim.z, (x, z, y) => h.world.groundAt(x, z, 0.3, y));
    const old = this.pair;
    let strike: number;
    if (old && h.rifts.setStrikeLife && h.rifts.moveStrikeEntrance(old.strike, spotFrame(near, 'stand')) && h.rifts.moveStrikeExit(old.strike, spotFrame(far))) {
      strike = old.strike;
      h.rifts.setStrikeLife(strike, AIMP.life + 1);
    } else {
      this.closePair();
      strike = h.rifts.openStrike(spotFrame(near, 'stand'), spotFrame(far), AIMP.life + 1, 0, -1, ['entrance', 'exit']);
    }
    // (the near twin is right in front of the camera: it collapses at once when it goes)
    const ends = h.rifts.strikeEnds(strike);
    if (ends) (ends.a as { closeTime?: number }).closeTime = 0.07;
    this.pair = { id: ++this.pairSeq, strike, near, far, t: 0, seen: new Map(), noticed: new Set(), man: man ? man.id : null, side };
    if (AIMP.grace > 0) this.setNoPlayer(this.pair, true);
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
    this.usage.opened++;
    if (man) this.usage.snapped++;
  }

  // ------------------------------------------------------------------
  // GO: into the near twin, out of the exit
  // ------------------------------------------------------------------

  /** GO: a dash into the near twin (AIMP.go.time s); you come out of the exit facing where it faces. */
  go(): boolean {
    const h = this.h;
    const p = this.pair;
    if (!p || this.dash) {
      if (!p) {
        h.audio.ui('deny');
        this.hud.callout('aim.noPair', 'info');
      }
      return false;
    }
    const b = h.player.body;
    const T = AIMP.go.time;
    // its middle, a little past its face, from your middle (no higher or lower than it takes to be inside it)
    const n = p.near;
    const from = _b.set(b.pos.x, b.pos.y + b.height * 0.5, b.pos.z);
    const to = _a.copy(n.pos).addScaledVector(n.normal, -0.45);
    to.y = THREE.MathUtils.clamp(from.y, n.pos.y - n.h / 2 + 0.2, n.pos.y + n.h / 2 - 0.2);
    const d = _c.subVectors(to, from);
    const fl = Math.hypot(d.x, d.z);
    h.player.lunge(d, Math.max(fl / T, 5), T + 0.12);
    // (up into a raised one: the rise, and what gravity takes on the way)
    if (d.y > 0.05) {
      b.vel.y = d.y / T + (LAW.gravity * T) / 2;
      b.onGround = false;
    }
    this.dash = { t: 0, pair: p.id };
    this.usage.go++;
    h.hero.play('push', { fade: 0.04, speed: 1.8 });
    h.audio.aimWhoosh(from, 0.7);
    h.fx.streak(from, _d.copy(d).multiplyScalar(1 / T), AIM_CYAN);
    h.kick(0.35);
    h.vibrate(12);
    return true;
  }

  private updateDash(dt: number) {
    const D = this.dash;
    if (!D) return;
    D.t += dt;
    // (it never got there: a wall, the pair gone)
    if (D.t > AIMP.go.time + 0.18 || !this.pair || this.pair.id !== D.pair) {
      this.h.player.endLunge?.();
      this.dash = null;
    }
  }

  /**
   * The near twin slides sideways with you (a strafe keeps it, and what you see
   * through it, on your crosshair); toward it or away from it you move as ever
   * (walking at it walks you in). Not while you dash, not once you are far
   * from it.
   */
  private followNear() {
    const me = this.h.player.body.pos;
    const p = this.pair;
    if (p && AIMP.near.follow && this.hasFeet && !this.dash) {
      const n = p.near;
      const dx = me.x - this.lastFeet.x, dz = me.z - this.lastFeet.z;
      // (its right: across its face)
      const rx = n.normal.z, rz = -n.normal.x;
      const side = dx * rx + dz * rz;
      const near = Math.hypot(n.pos.x - me.x, n.pos.z - me.z) < AIMP.stab.nearMax;
      if (near && Math.abs(side) > 1e-4 && Math.abs(side) < 1) {
        n.pos.x += rx * side;
        n.pos.z += rz * side;
        this.h.rifts.moveStrikeEntrance(p.strike, spotFrame(n, 'stand'));
      }
    }
    this.lastFeet.copy(me);
    this.hasFeet = true;
  }

  private endDash() {
    if (this.dash) this.h.player.endLunge?.();
    this.dash = null;
  }

  /**
   * You went through an end (the game's crossing): out of YOUR exit, you come
   * out at AIMP.go.arrive m/s along its front, facing where it faces; the
   * knife reaches further for a beat; what you pressed on the way lands next
   * frame; the pair shuts behind you. Returns the view's turn (the pair's own
   * turn, so you look where you were looking, now out of the exit), or null
   * when it isn't yours.
   */
  heroCrossed(from: RiftEnd, to: RiftEnd): number | null {
    const p = this.pair;
    if (!p) return null;
    const ends = this.h.rifts.strikeEnds(p.strike);
    if (!ends || (from as object) !== ends.a || (to as object) !== ends.b) return null;
    const h = this.h;
    const now = h.time();
    const b = h.player.body;
    const n = to.normal;
    let turn = 0;
    if (Math.abs(n.y) < 0.5) {
      // a door: out along its front, steady, toward him
      const vy = b.vel.y;
      b.vel.set(n.x, 0, n.z).normalize().multiplyScalar(AIMP.go.arrive);
      b.vel.y = Math.min(vy, 1);
      turn = Math.atan2(n.x, n.z) - Math.atan2(-p.near.normal.x, -p.near.normal.z);
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
    } else if (n.y < -0.5) {
      // a ceiling over his head: down right behind him (not onto his head), facing his back
      const e = p.man !== null ? (h.enemies.get(p.man) as Enemy | null) : null;
      if (e && e.alive) {
        const bx = -Math.sin(e.yaw), bz = -Math.cos(e.yaw);
        b.pos.x = e.pos.x + bx * 0.6;
        b.pos.z = e.pos.z + bz * 0.6;
        const yaw = Math.atan2(-bx, -bz);
        turn = yaw - Math.atan2(-p.near.normal.x, -p.near.normal.z);
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        h.player.yaw = yaw;
      }
      b.vel.set(0, -AIMP.go.arrive, 0);
    }
    this.dash = null;
    this.arrivedT = now;
    this.edgeUntil = now + AIMP.stab.edgeTime;
    this.closeAt = now + AIMP.go.close;
    return turn;
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
    // (somewhere else: a fresh portal to them; kept by a man as he moves: the same one, they still see it)
    const moved = p.far.pos.distanceTo(spot.pos) > 1 || p.far.surface !== spot.surface;
    p.far.pos.copy(spot.pos);
    p.far.normal.copy(spot.normal);
    p.far.hdir.copy(spot.hdir);
    p.far.surface = spot.surface;
    p.far.w = spot.w;
    p.far.h = spot.h;
    this.h.rifts.moveStrikeExit(p.strike, spotFrame(p.far));
    if (!moved) return;
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
      // (in front of his eyes he sees it at once; at his side, behind him, he hears it a moment later)
      const need = noticeDelay(_a, e.yaw, p.far.pos);
      if (need === null || !h.world.lineOfSight(_a, p.far.pos)) {
        p.seen.delete(e.id);
        continue;
      }
      const s = (p.seen.get(e.id) ?? 0) + dt;
      p.seen.set(e.id, s);
      if (s >= need) {
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
    let segs = h.rifts.raycastThrough(ray.origin, ray.dir, AIMP.rifle.range, h.world, 2);
    // (turned away from the near twin to shoot someone else: past it, as your rifle points)
    if (segs.length > 1 && this.pair && this.isNearEnd(segs[0].viaEnd as RiftEnd) && !this.intoNear(ray.dir)) {
      const hit = h.world.raycast(ray.origin as THREE.Vector3, ray.dir as THREE.Vector3, AIMP.rifle.range, { sight: true });
      const to = new THREE.Vector3().copy(ray.origin).addScaledVector(ray.dir, hit ? hit.distance : AIMP.rifle.range);
      segs = [{ from: new THREE.Vector3().copy(ray.origin), to, hit: hit ?? null, viaEnd: null, charged: false } as RaySegment];
    }
    const muzzle = h.hero.heldMuzzle(new THREE.Vector3());
    const assist = this.h.device() === 'touch' ? THREE.MathUtils.degToRad(2) : this.h.device() === 'pad' ? THREE.MathUtils.degToRad(1.2) : 0;
    const men = this.men();
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
      const to = sg.to;
      if (shield) {
        const at = new THREE.Vector3().copy(o).addScaledVector(dir, bestT);
        pieces.push([si === 0 ? muzzle : o, at]);
        this.shieldTook(shield, at, si === 0 ? h.player.body.pos : segs[si - 1].to, si > 0);
        break;
      }
      if (hitMan) {
        const at = new THREE.Vector3().copy(o).addScaledVector(dir, bestT);
        pieces.push([si === 0 ? muzzle : o, at]);
        this.hitMan(hitMan, at, muzzle, si === 0 ? h.player.body.pos : segs[si - 1].to, si > 0);
        if (si === 0) this.usage.rifleDirect++;
        else this.usage.rifleThrough++;
        break;
      }
      pieces.push([si === 0 ? muzzle : o, to]);
      if (si === segs.length - 1) {
        if (sg.hit) h.fx.sparks(new THREE.Vector3().copy(to), sg.hit.normal, AIM_CYAN, 6);
      }
    }
    if (!pieces.length) pieces.push([muzzle, new THREE.Vector3().copy(ray.origin).addScaledVector(ray.dir, AIMP.rifle.range)]);
    for (const [a, b] of pieces) this.fx.tracer(a, b);
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
  private hitMan(e: Enemy, at: V3, muzzle: V3, from: V3, viaPortal = false) {
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
    this.ai.attacked(e, from, now, viaPortal);
    h.fx.sparks(at, null, AIM_RED, 10);
    h.audio.boltImpact(at, false);
  }

  /** A mirror's shield took a round: a violet flare; some come back at you. */
  private shieldTook(e: Enemy, at: V3, from: V3, viaPortal = false) {
    const h = this.h;
    const now = h.time();
    this.fx.shieldHit(e.id);
    h.fx.sparks(at, null, new THREE.Color(1.4, 0.5, 2.2), 8);
    h.audio.shieldClang(at);
    this.ai.attacked(e, from, now, viaPortal);
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

  /** Just out of the exit: the knife reaches further. */
  private edge(): boolean {
    return this.h.time() < this.edgeUntil;
  }

  /** The man right in front of you within a stab (further just out of the exit). */
  private meleeTarget(): Enemy | null {
    const h = this.h;
    const p = h.player.body.pos;
    const ray = h.aimRay();
    const fy = Math.atan2(ray.dir.x, ray.dir.z);
    const edge = this.edge();
    let bd: number = AIMP.stab.direct + (edge ? AIMP.stab.edge : 0);
    const dy = edge ? AIMP.stab.edgeY : 1.5;
    let best: Enemy | null = null;
    for (const o of this.men()) {
      const d = Math.hypot(o.pos.x - p.x, o.pos.z - p.z);
      if (d > bd || Math.abs(o.pos.y - p.y) > dy) continue;
      let off = Math.atan2(o.pos.x - p.x, o.pos.z - p.z) - fy;
      while (off > Math.PI) off -= Math.PI * 2;
      while (off < -Math.PI) off += Math.PI * 2;
      // (straight under you, off any angle: a drop onto him)
      if (Math.abs(off) > 0.95 && d > 0.5) continue;
      bd = d;
      best = o;
    }
    return best;
  }

  /**
   * A stab through the pair: it is open, its near twin within a stab's way of
   * you, and a man stands within AIMP.stab.reach in front of the exit (you put
   * it there: the knife goes through, whatever the crosshair is on).
   */
  private stabThrough(): { target: Enemy; from: Spot; into: Spot } | null {
    const p = this.pair;
    if (!p || this.dash) return null;
    const me = this.h.player.body.pos;
    if (_a.copy(p.near.pos).sub(me).setY(0).length() > AIMP.stab.nearMax) return null;
    const target = standingBy(p.far, this.men(), AIMP.stab.reach);
    return target ? { target, from: p.far, into: p.near } : null;
  }

  private stab() {
    const h = this.h;
    if (this.dash) {
      this.bufStab = h.time();
      return;
    }
    this.faceAim();
    this.stabCd = AIMP.stab.cooldown;
    this.knifeUntil = h.time() + 0.3;
    h.hero.play('strike', { fade: 0.04 });
    h.audio.reachSwing(h.player.chest(_a));
    const close = this.meleeTarget();
    if (close) {
      if (guarded(close.pos, close.yaw, h.player.body.pos, close.aim === 'mirror') && this.able(close)) return this.parried(close, h.player.chest(new THREE.Vector3()));
      const p = h.player.body.pos;
      // (a step in that ends right at him: further just out of the exit)
      const d = Math.hypot(close.pos.x - p.x, close.pos.z - p.z);
      if (d > 0.5) h.player.lunge(_a.set(close.pos.x - p.x, 0, close.pos.z - p.z), THREE.MathUtils.clamp((d - 0.85) / 0.12, 6, 16), 0.12);
      this.usage.stabDirect++;
      if (this.edge() && d > AIMP.stab.direct) this.usage.edge++;
      this.knifeKill(close, h.player.chest(new THREE.Vector3()));
      return;
    }
    const thr = this.stabThrough();
    if (!thr) {
      this.stabCd = 0.25;
      return;
    }
    // through it: your hand into the near twin, the blade out of the exit
    const c = _c.set(thr.target.pos.x, thr.target.pos.y + thr.target.height * 0.6, thr.target.pos.z);
    this.fx.tracer(h.hero.bonePos('RightHand', _b), thr.into.pos, new THREE.Color(2, 2, 2));
    this.fx.tracer(_a.copy(thr.from.pos).setY(Math.min(thr.from.pos.y + thr.from.h / 2 - 0.2, Math.max(thr.from.pos.y - thr.from.h / 2 + 0.2, c.y))), c, new THREE.Color(2, 2, 2));
    h.audio.aimWhoosh(thr.from.pos, 0.4);
    if (guarded(thr.target.pos, thr.target.yaw, thr.from.pos, thr.target.aim === 'mirror') && this.able(thr.target)) {
      this.parried(thr.target, thr.from.pos, true);
      return;
    }
    this.usage.stabThrough++;
    this.knifeKill(thr.target, thr.from.pos);
  }

  private parried(e: Enemy, at: V3, viaPortal = false) {
    const h = this.h;
    this.usage.parried++;
    this.stabCd = 0.5;
    this.hud.callout('aim.parried', 'warn');
    h.fx.sparks(_a.copy(at), null, new THREE.Color(2, 2, 2), 12);
    h.audio.shieldClang(at);
    e.char.play('strike', { fade: 0.04 });
    this.ai.attacked(e, at, h.time(), viaPortal);
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
    this.usage.pulled++;
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
    this.usage.thrown++;
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

  /**
   * A man went through an end (the game's crossing): out of YOUR near twin
   * (dropped through the exit under his feet, or walked into it) he tumbles
   * out in front of you at a walk, not flung past you: there for the knife.
   */
  manCrossed(e: Enemy, from: RiftEnd, to: RiftEnd) {
    const p = this.pair;
    const b = e.body;
    if (!p || !b) return;
    const ends = this.h.rifts.strikeEnds(p.strike);
    if (!ends || (to as object) !== ends.a) return;
    void from;
    const n = to.normal;
    b.vel.set(n.x * AIMP.pull.drop, Math.min(b.vel.y, 1), n.z * AIMP.pull.drop);
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

  /** The bracket round the man the crosshair is on (not once the pair stands by him: the near twin shows him). */
  private markOf(): AimHudState['mark'] {
    const e = this.hover;
    if (!e || (this.pair && this.pair.man === e.id) || this.snapLatched) return null;
    const cam = this.h.camera;
    _ndc.set(e.pos.x, e.pos.y, e.pos.z).project(cam);
    if (_ndc.z > 1) return null;
    const fy = _ndc.y, fx = _ndc.x;
    _ndc.set(e.pos.x, e.pos.y + e.height, e.pos.z).project(cam);
    return { x: (fx + _ndc.x + 2) / 4, y: (2 - fy - _ndc.y) / 4, h: Math.abs(_ndc.y - fy) / 2 };
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
