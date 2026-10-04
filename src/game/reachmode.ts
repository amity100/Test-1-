import * as THREE from 'three';
import type { HitInfo, KillEvent, RaySegment, RiftEndKind, V3 } from '../core/contracts';
import type { CollisionWorld } from '../world/collision';
import type { Enemy, EnemySystem } from '../actors/enemies';
import { ReachAI, RedPortals, type ReachAIWindow, type RedPortal } from '../actors/reachai';
import type { Audio } from '../engine/audio';
import type { LabWave } from '../world/combatlab/layout';
import { ReachHud, type ReachHandVerb, type ReachHudState, type ReachStab, type ThreatArrow } from '../ui/reachhud';
import { t } from '../ui/i18n';
import type { Character } from './characters';
import type { FxKit } from './fxkit';
import type { LabTool } from './labdirector';
import type { Player } from './player';
import { passPoint, type RiftFrame } from './portalMath';
import type { RiftColorKey } from './portals';
import {
  bodyPoint,
  byWindow,
  edgeArrow,
  flat,
  Hands,
  inHisEyes,
  nearSpot,
  placeWindow,
  pullLanding,
  REACH,
  reachKillTool,
  redirectOutcome,
  sideOf,
  windowFrame,
  type HandWindow,
  type ThreatKind,
  type WindowSpot,
} from './reach';
import { REACH_CYAN, REACH_RED, ReachFx } from './reachfx';
import { Armory, type Owner, type Weapon } from './weapons';

/** The rift system as REACH uses it (its window pair is a short-lived pair of rift ends). */
export interface ReachRifts {
  openStrike(a: RiftFrame & { kind: RiftEndKind }, b: RiftFrame & { kind: RiftEndKind }, life: number, boost?: number, aimAt?: number, colors?: [RiftColorKey, RiftColorKey]): number;
  closeStrike(id: number): void;
  strikeEnds(id: number): { a: RiftFrame; b: RiftFrame } | null;
  raycastThrough(origin: V3, dir: V3, maxDist: number, world: CollisionWorld, maxHops?: number): RaySegment[];
}

/** What REACH needs from the game. */
export interface ReachHost {
  readonly world: CollisionWorld;
  readonly enemies: EnemySystem;
  readonly fx: FxKit;
  readonly audio: Audio;
  readonly camera: THREE.Camera;
  readonly player: Player;
  readonly hero: Character;
  readonly rifts: ReachRifts;
  aimRay(): { origin: V3; dir: V3 };
  eye(out: THREE.Vector3): THREE.Vector3;
  device(): 'kbm' | 'pad' | 'touch';
  /** Game time (s). */
  time(): number;
  /** You're up (not dead, not respawning). */
  alive(): boolean;
  /** Nothing can touch you right now (the respawn guard). */
  safe(): boolean;
  /** The wave's fight is on (after GO). */
  fighting(): boolean;
  /** Solid floor to stand on at (x, z) about level `y` (not the void, not the pool): its top, else null. */
  standAt(x: number, z: number, y: number): number | null;
  /** A weapon here is lost (the void, the pool). */
  lost(p: V3): boolean;
  /** What coming out at `p` does to a man: lands on the floor, falls into the void, drops into the water. */
  exitOutcome(p: V3): 'floor' | 'void' | 'water';
  hurt(amount: number, from: V3): void;
  hitstop(s: number): void;
  shake(k: number): void;
  kick(k: number): void;
  /** When you last went through a rift (game time; -inf: never). */
  lastCrossT(): number;
  /** His own side's rounds hit him for this long (a man you put in their line of fire). */
  markForAllies(id: number, secs: number): void;
}

/** The game's input to REACH this frame. */
export interface ReachInput {
  /** WEAPON (LMB / RT / the WEAPON button). */
  fire: boolean;
  firePress: boolean;
  /** WINDOW held (RMB / LT / the WINDOW button): aim the ghost; let go: it opens. */
  window: boolean;
  /** HAND (E / MMB / RB / the HAND button). */
  hand: boolean;
  handPress: boolean;
  /** Wheel steps this frame (+: further). */
  wheel?: number;
}

/** The open window pair. */
export interface ReachWindow {
  id: number;
  /** The rift pair it is (-1: none, a stand-in world). */
  strike: number;
  readonly near: { pos: THREE.Vector3; look: THREE.Vector3 };
  readonly far: { pos: THREE.Vector3; look: THREE.Vector3; surface: WindowSpot['surface'] };
  /** Seconds since it opened. */
  t: number;
  /** Seconds each man has had it in his eyes; who has noticed it. */
  readonly seen: Map<number, number>;
  readonly noticed: Set<number>;
}

/** What the HAND would do at the far window now. */
export interface HandPlan {
  verb: ReachHandVerb;
  /** He sees it coming (aware, in front of him): slapped away / he holds on. */
  blocked: boolean;
  weapon: Weapon | null;
  enemy: Enemy | null;
  portal: RedPortal | null;
  /** Where the hand goes. */
  at: THREE.Vector3;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _ndc = new THREE.Vector3();

const ABLE = new Set(['combat', 'idle', 'patrol', 'suspicious', 'charge']);

/** Exit outcome of a portal you hold (the chip says it). */
export type HeldOutcome = 'floor' | 'void' | 'water' | 'high' | 'fall' | 'wall';

/**
 * REACH in the game (the lab's default variant; DESIGN §14): your window
 * pair, your hand and your weapon through it, the weapons on the floor, the
 * enemy side (actors/reachai.ts) and its portals, and their look and HUD. The
 * Game owns one while the lab is loaded and calls update() only while REACH
 * is the variant in force.
 */
export class ReachMode {
  readonly armory = new Armory();
  readonly hands = new Hands();
  readonly portals = new RedPortals();
  readonly ai: ReachAI;
  readonly fx = new ReachFx();
  readonly hud: Pick<ReachHud, 'update' | 'callout' | 'show' | 'dispose' | 'tip'>;
  /** The window pair (one at a time). */
  win: ReachWindow | null = null;
  /** The WINDOW key is held: where it would open. */
  ghost: (WindowSpot & { seen: boolean; behind: boolean }) | null = null;
  /** What HAND would do now (null: no window). */
  plan: HandPlan | null = null;
  private winSeq = 0;
  private winCd = 0;
  /** Mid-air distance set with the wheel (null: the first thing the aim meets: a surface, or just past a man). */
  airDist: number | null = null;
  private wasWindow = false;
  private handCd = 0;
  private fireCd = 0;
  private knifeCd = 0;
  /** A portal of theirs in your hand: its exit follows your aim. */
  private held: { p: RedPortal; t: number } | null = null;
  private heldOutcome: HeldOutcome = 'floor';
  /** Weapons on their way to a hand: from where, how long so far. */
  private flights = new Map<number, { from: THREE.Vector3; t: number }>();
  /** Men your hand is pulling through: to the far window, then out of the near one to your crosshair. */
  private pulls: { id: number; phase: 'in' | 'out'; from: THREE.Vector3; to: THREE.Vector3; t: number }[] = [];
  /** Reeling (from your pull, a fall, a slam) until (game time): rounds do more. */
  private stunUntil = new Map<number, number>();
  /** Out of a portal exit you moved (game time): his death is that portal's. */
  private redirected = new Map<number, number>();
  /** Men out of a portal you moved, in the air: the fall / the slam still to come. */
  private flying = new Map<number, { t: number; y0: number; slamT: number; slammed: boolean; wasUp: boolean }>();
  private seenCross = new Set<number>();
  private lastHit = new Map<number, { tool: 'rifle' | 'knife'; t: number }>();
  private firedT = -99;
  private shown = false;
  private wasGo = false;
  private tipped = false;
  /** The threat arrows this frame (the HUD's; tests read them). */
  arrows: ThreatArrow[] = [];

  /** `hud`: the HUD to drive (tests pass a stand-in); else one is built under `hudRoot`. */
  constructor(private h: ReachHost, hudRoot: HTMLElement | null, hud?: Pick<ReachHud, 'update' | 'callout' | 'show' | 'dispose' | 'tip'>) {
    this.hud = hud ?? new ReachHud(hudRoot!);
    this.ai = new ReachAI({
      armory: this.armory,
      hands: this.hands,
      portals: this.portals,
      world: h.world,
      go: () => h.fighting(),
      player: () => {
        const p = h.player;
        return { pos: p.body.pos, chest: p.chest(_c), hand: this.handOf('player', _b), alive: h.alive(), safe: h.safe() };
      },
      window: () => this.aiWindow(),
      standAt: (x, z, y) => h.standAt(x, z, y),
      laser: (e, from, to, t01) => h.enemies.hooks.telegraph(e, 'laser', from, to, t01),
      fireBolt: (e, from, dir) => h.enemies.hooks.fireBolt(e, from, dir),
      windup: (e, secs) => {
        const c = e.chest(new THREE.Vector3());
        h.fx.flash(c, 4, Math.min(0.5, secs), 0xff1a10);
        h.fx.ring(_a.copy(e.pos).setY(e.pos.y + 0.06), 1, Math.min(0.45, secs), REACH_RED);
        h.audio.shout(c);
      },
      melee: (e, dmg, push) => {
        if (!h.alive() || h.safe()) return;
        h.hurt(dmg, e.pos);
        h.player.body.vel.add(push);
        h.player.body.onGround = false;
        h.fx.sparks(h.player.chest(_a), null, REACH_RED, 10);
      },
      opened: (kind, at) => {
        if (kind === 'portal') h.audio.riftOpen(at, 'gate');
        else if (kind === 'steal') h.audio.reachSteal(at);
        else h.audio.reachWindow(at, false);
      },
      picked: (e, w) => {
        h.audio.reachSnatch(w.pos, false);
        e.char.play('interact', { fade: 0.06 });
      },
      discarded: (_e, w) => h.audio.reachClatter(w.pos),
    });
  }

  // ------------------------------------------------------------------
  // Run flow
  // ------------------------------------------------------------------

  /** REACH is (or isn't) the variant in force: its HUD and look show. */
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

  /** A new run: the tip shows again at its first GO. */
  newRun() {
    this.tipped = false;
    this.reset();
  }

  /** Everything of the last fight goes (a new run, a variant switch). */
  reset() {
    this.armory.clear();
    this.hands.clear();
    this.portals.clear();
    this.ai.reset();
    this.flights.clear();
    for (const p of this.pulls) this.endPull(p, false);
    this.pulls.length = 0;
    this.stunUntil.clear();
    this.redirected.clear();
    this.flying.clear();
    this.seenCross.clear();
    this.lastHit.clear();
    this.closeWindow();
    this.ghost = null;
    this.plan = null;
    this.airDist = null;
    this.held = null;
    this.arrows = [];
    this.fx.clear();
    this.h.hero.setHeld(null);
    this.h.player.weaponUp = 0;
  }

  /** A wave's breather: its weapons go down where the wave says, and everyone's hands are empty. */
  beginWave(def: LabWave) {
    this.reset();
    let k = 0;
    for (const w of def.weapons ?? []) this.armory.add(w.kind, w.pos, (k++ * 2.39996) % (Math.PI * 2));
  }

  /** You went down: your weapon falls where you were, your hand lets go, your window shuts. */
  playerDown() {
    const p = this.h.player.body.pos;
    const w = this.armory.heldBy('player');
    if (w) this.armory.drop(w, _a.set(p.x, p.y + 1, p.z), _b.set(0, 2.5, 0));
    this.releaseMine();
  }

  /** Back on the pad: nothing of yours still reaching. */
  onRespawn() {
    this.releaseMine();
    this.h.hero.setHeld(null);
  }

  private releaseMine() {
    for (const w of [...this.hands.list]) if (w.owner === 'player') this.hands.cancel(w);
    if (this.held) this.portals.release(this.held.p);
    this.held = null;
    this.ghost = null;
    this.closeWindow();
  }

  /** The lab's KILLS BY TOOL for this death. */
  toolFor(ev: KillEvent): LabTool {
    const now = this.h.time();
    const r = this.redirected.get(ev.enemyId);
    const hit = this.lastHit.get(ev.enemyId);
    const mine = hit && now - hit.t < 0.6 ? hit.tool : null;
    return reachKillTool(ev.cause, r !== undefined && now - r < 8, mine);
  }

  /** An end of your window pair (a round through it stays theirs: it hits you). */
  isWindowEnd(end: { position: V3 }): boolean {
    const w = this.win;
    if (!w || w.strike < 0) return false;
    const ends = this.h.rifts.strikeEnds(w.strike);
    return !!ends && ((ends.a as object) === end || (ends.b as object) === end);
  }

  // ------------------------------------------------------------------
  // Per frame
  // ------------------------------------------------------------------

  update(dt: number, realDt: number, inp: ReachInput) {
    const h = this.h;
    const now = h.time();
    this.handCd -= realDt;
    this.winCd -= realDt;
    this.fireCd -= dt;
    this.knifeCd -= dt;
    const alive = h.alive();
    const go = h.fighting();
    if (go && !this.wasGo && !this.tipped) {
      this.tipped = true;
      this.hud.tip(t(`reach.tip.${h.device()}`));
    }
    this.wasGo = go;

    // a man who goes down lets go of what he held
    for (const w of this.armory.list) {
      if (typeof w.holder !== 'number') continue;
      const e = h.enemies.get(w.holder);
      if (e && e.alive) continue;
      const at = e ? e.pos : w.pos;
      this.armory.drop(w, _a.set(at.x, at.y + 1.1, at.z), _b.set((Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3));
      this.flights.delete(w.id);
    }

    // the window: hold to aim the ghost, let go to open it; it shuts by itself
    this.updateWindowKey(alive, inp);
    const win = this.win;
    if (win) {
      win.t += dt;
      if (win.t >= REACH.window.life) this.closeWindow();
      else this.updateNotice(win, dt);
    }

    // what the hand would do there
    // (not while your hand is out or a man is on his way through: it's busy)
    this.plan = alive && this.win && !this.held && !this.hands.of('player') && !this.pulls.length ? this.planHand() : null;

    // the hand
    if (this.held) this.updateHeldPortal(realDt, inp.hand);
    else if (inp.handPress && alive && this.handCd <= 0 && !this.hands.of('player')) {
      if (!go) h.audio.ui('deny');
      else if (!this.win) {
        h.audio.ui('deny');
        this.hud.callout('reach.noWindow', 'info');
        this.handCd = 0.2;
      } else if (this.plan) this.handPress();
    }

    // the weapon
    const mine = this.armory.heldBy('player');
    if (alive && go && mine && !this.flights.has(mine.id)) {
      if (mine.kind === 'rifle') {
        if (inp.fire && this.fireCd <= 0) this.shoot(mine);
      } else if (inp.firePress && this.knifeCd <= 0) this.stab();
    } else if (alive && go && !mine && inp.firePress) {
      this.hud.callout('reach.noWeapon', 'info');
    }

    // empty hands walking over a weapon: it's yours (a touch)
    if (alive && go && !mine) this.pickUp();

    // hands, pulls, flights, portals, the floor
    for (const w of [...this.hands.list]) {
      if (w.owner === 'player' || this.able(w.owner)) continue;
      if (w.weapon) this.armory.unclaim(w.weapon, w.owner);
      this.hands.cancel(w);
    }
    this.hands.update(dt, (w) => this.resolve(w));
    this.updatePulls(dt);
    for (const [id, f] of this.flights) {
      f.t += dt;
      if (f.t >= REACH.hand.fly) this.flights.delete(id);
    }
    this.portals.update(dt, (id) => this.able(id));
    for (const p of this.portals.list) {
      if (p.crossedT < 0 || this.seenCross.has(p.id)) continue;
      this.seenCross.add(p.id);
      _a.copy(p.b).setY(p.b.y + 1.1);
      h.fx.riftBurst(_a, _b.set(Math.sin(p.by), 0, Math.cos(p.by)), p.redirected ? REACH_CYAN : REACH_RED);
      h.audio.riftPass(_a, 6);
      if (p.redirected) this.redirectedOut(p, now);
    }
    this.updateFlying(dt);
    this.armory.update(
      dt,
      (x, z, y) => h.world.groundAt(x, z, 0.05, y),
      (p) => h.lost(p),
    );

    // weapons in hands (shown once they've arrived)
    const mineNow = this.armory.heldBy('player');
    h.hero.setHeld(mineNow && !this.flights.has(mineNow.id) ? mineNow.kind : null);
    const up = mineNow?.kind === 'rifle' ? (now - this.firedT < 0.9 ? 1 : 0.45) : 0;
    h.player.weaponUp = THREE.MathUtils.damp(h.player.weaponUp, up, 14, realDt);
    for (const e of h.enemies.list) {
      if (!e.alive || !e.reach) continue;
      const w = this.armory.heldBy(e.id);
      e.char.setHeld?.(w && !this.flights.has(w.id) ? w.kind : null);
    }

    // the look and the HUD
    this.fx.update(dt, {
      armory: this.armory,
      hands: this.hands,
      portals: this.portals.list,
      handOf: (o, out) => this.handOf(o, out),
      targetOf: (w, out) => this.targetOf(w, out),
      ghost: this.ghost,
      win: this.win ? { far: this.win.far, near: this.win.near, k: Math.min(1, this.win.t / REACH.window.open), left: REACH.window.life - this.win.t } : null,
      mark: this.plan && this.plan.verb !== 'empty' ? { at: this.plan.at, bad: this.plan.blocked } : null,
      heldPortal: this.held ? this.held.p.id : -1,
      groundGap: this.ghost ? this.ghostGap(this.ghost) : 0,
      flying: (w, out) => this.flyPos(w, out),
      camera: h.camera,
    });
    this.arrows = this.threats();
    let warn = false;
    for (const w of this.hands.list) if (w.kind === 'steal' && w.t < w.tele) warn = true;
    let incoming = false;
    for (const p of this.portals.list) if (p.crossedT < 0 && !p.held && p.b.distanceTo(h.player.body.pos) < 12) incoming = true;
    const st: ReachHudState = {
      device: h.device(),
      ghost: this.ghost ? { ok: this.ghost.ok, seen: this.ghost.seen, behind: this.ghost.behind } : null,
      hand: this.plan ? { verb: this.plan.verb, blocked: this.plan.blocked } : null,
      stab: mineNow?.kind === 'knife' ? this.stabState() : null,
      held: this.held ? this.heldOutcome : null,
      weapon: mineNow ? { kind: mineNow.kind, ammo: mineNow.ammo } : null,
      window: this.win ? Math.max(0, REACH.window.life - this.win.t) / REACH.window.life : null,
      warn,
      incoming,
      go,
      arrows: this.arrows,
    };
    this.hud.update(st);

    for (const [id, tt] of this.stunUntil) if (tt < now) this.stunUntil.delete(id);
  }

  /** What the phone's buttons say: HAND's verb, WEAPON's rounds (or KNIFE). */
  touchState(): { hand: string | null; handKind: string | null; weapon: string | null; far: boolean; window: boolean } {
    const p = this.plan;
    const w = this.armory.heldBy('player');
    const verb = this.held ? `reach.exit.${this.heldOutcome}` : p ? `reach.verb.${p.blocked ? 'blocked' : p.verb}` : null;
    return {
      hand: verb ? t(verb) : null,
      handKind: this.held ? 'portal' : p ? (p.blocked ? 'late' : p.verb) : null,
      weapon: w ? (w.kind === 'rifle' ? String(w.ammo) : t('reach.w.knife')) : null,
      far: !!this.win && w?.kind === 'knife',
      window: !!this.win,
    };
  }

  /** Can this man use his hands (on his feet, not held, not flying). */
  private able(id: number): boolean {
    const e = this.h.enemies.get(id) as Enemy | null;
    return !!e && e.alive && !e.held && ABLE.has(e.state);
  }

  // ------------------------------------------------------------------
  // The window
  // ------------------------------------------------------------------

  private updateWindowKey(alive: boolean, inp: ReachInput) {
    const h = this.h;
    const holding = alive && inp.window && !this.held;
    if (holding) {
      if (!this.wasWindow) this.airDist = null;
      const ray = h.aimRay();
      const eye = h.eye(_eye);
      if (inp.wheel) {
        const base = this.airDist ?? (this.ghost ? this.ghost.dist : 12);
        this.airDist = THREE.MathUtils.clamp(base + inp.wheel * REACH.window.step, REACH.window.min, REACH.range);
      }
      const air = this.airDist ?? this.aimStop(ray.origin, ray.dir, eye);
      const spot = placeWindow(h.world, ray.origin, ray.dir, eye, air, (x, z, y) => h.world.groundAt(x, z, 0.3, y));
      if (h.device() === 'touch') this.magnet(spot, ray.origin, ray.dir);
      this.faceTarget(spot);
      this.ghost = Object.assign(spot, { seen: this.seenAt(spot.pos), behind: this.behindAt(spot) });
    } else if (this.wasWindow && this.ghost && alive) {
      // let go: it opens there
      if (this.ghost.ok && this.winCd <= 0) this.openWindow(this.ghost);
      else h.audio.ui('deny');
      this.ghost = null;
    } else this.ghost = null;
    this.wasWindow = holding;
  }

  /**
   * A weapon on the floor right under the aim (in sight, within reach): how
   * far it is (m from your eyes; the window stands on it). Men don't stop the
   * aim: getting a window right behind one is yours to do (aim at the floor
   * behind his feet, at the wall behind him, or set the distance).
   */
  private aimStop(origin: V3, dir: V3, eye: V3): number | null {
    const h = this.h;
    let best: number | null = null;
    for (const w of this.armory.list) {
      if (w.holder !== null || !Armory.live(w)) continue;
      const s = _a.subVectors(w.pos, origin).dot(dir);
      if (s <= 0) continue;
      if (_b.copy(origin).addScaledVector(dir, s).distanceTo(w.pos) > 0.55) continue;
      const d = Math.hypot(w.pos.x - eye.x, w.pos.z - eye.z);
      if (d > REACH.range || (best !== null && d >= best)) continue;
      if (!h.world.lineOfSight(eye, _c.copy(w.pos).setY(w.pos.y + 0.3))) continue;
      best = d;
    }
    return best;
  }

  /** How far the ghost's bottom is over the floor under it (m; 0 on it, or no floor). */
  private ghostGap(g: WindowSpot): number {
    const bottom = g.pos.y - REACH.window.height / 2;
    const fl = this.h.world.groundAt(g.pos.x, g.pos.z, 0.2, bottom);
    return fl === -Infinity ? 0 : Math.max(0, bottom - fl);
  }

  /**
   * A window looks at the man right by it (you see him through its twin;
   * past him that's his back, short of him his face — and then he sees you
   * through it); with nobody by it, it faces you.
   */
  private faceTarget(spot: WindowSpot) {
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e0 of this.h.enemies.list) {
      const e = e0 as Enemy;
      if (!e.alive || !e.reach || !e.body) continue;
      const pt = bodyPoint(e.pos, e.height, spot.pos, _a);
      const d = Math.hypot(pt.x - spot.pos.x, pt.z - spot.pos.z);
      if (d < 0.3 || !byWindow(spot.pos, spot.look, pt, REACH.window.reach)) continue;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (best) flat(_b.subVectors(best.pos, spot.pos), spot.look);
  }

  /** A thumb's help: the ghost leans onto the spot behind the man nearest the crosshair (a small radius). */
  private magnet(spot: WindowSpot, origin: V3, dir: V3) {
    const W = REACH.window;
    let best: Enemy | null = null;
    let bestErr = W.magnet;
    for (const e of this.h.enemies.list) {
      if (!e.alive || !e.reach) continue;
      _a.set(e.pos.x, e.pos.y + 1.1, e.pos.z).sub(origin);
      const d = _a.length();
      if (d > REACH.range + 4) continue;
      const err = Math.acos(THREE.MathUtils.clamp(_a.dot(dir) / d, -1, 1));
      if (err < bestErr) {
        bestErr = err;
        best = e as Enemy;
      }
    }
    if (!best) return;
    const f = best.forward(_b).setY(0).normalize();
    _c.set(best.pos.x - f.x * W.behind, best.pos.y + W.height / 2 + 0.02, best.pos.z - f.z * W.behind);
    if (_c.distanceTo(spot.pos) > W.snap) return;
    if (this.h.standAt(_c.x, _c.z, best.pos.y) === null) return;
    spot.pos.copy(_c);
    spot.surface = 'floor';
    flat(_d.subVectors(this.h.player.body.pos, _c), spot.look);
    spot.dist = spot.pos.distanceTo(this.h.eye(_eye));
    spot.ok = spot.dist >= W.min && spot.dist <= REACH.range + 1.5;
  }

  /** A man right by the spot (the knife's reach) with his back or side to it. */
  private behindAt(spot: WindowSpot): boolean {
    for (const e0 of this.h.enemies.list) {
      const e = e0 as Enemy;
      if (!e.alive || !e.reach || !e.body) continue;
      if (!byWindow(spot.pos, spot.look, bodyPoint(e.pos, e.height, spot.pos, _a), REACH.window.knife)) continue;
      if (sideOf(e.pos, e.yaw, spot.pos) !== 'front') return true;
    }
    return false;
  }

  /** Some man on his feet would have a window here in his eyes. */
  private seenAt(p: V3): boolean {
    for (const e of this.h.enemies.list) {
      if (!e.alive || !e.reach || !this.able(e.id)) continue;
      e.eye(_a);
      if (inHisEyes(_a, e.yaw, p) && this.h.world.lineOfSight(_a, p)) return true;
    }
    return false;
  }

  /** Open the pair: the far window at the ghost, its twin in front of you. */
  openWindow(spot: WindowSpot) {
    const h = this.h;
    this.closeWindow();
    const ray = h.aimRay();
    const aim = flat(ray.dir, new THREE.Vector3());
    const feet = h.player.body.pos;
    // the near one: in front of you, facing you (nearer if a wall is in the way)
    // (on the run it opens further ahead: a beat to see it and go through it, or round it)
    const v = h.player.body.vel;
    let ahead: number = REACH.window.ahead + Math.max(0, v.x * aim.x + v.z * aim.z) * REACH.window.lead;
    const wall = h.world.raycast(_a.set(feet.x, feet.y + 1, feet.z), aim, ahead + 0.5, { sight: false });
    if (wall) ahead = Math.max(0.6, wall.distance - 0.45);
    const near = nearSpot(feet, aim, ahead);
    // (on the crosshair: the camera sits over your shoulder, the window stands where its ray crosses `ahead`)
    const ro = ray.origin, rd = ray.dir;
    const den = rd.x * aim.x + rd.z * aim.z;
    if (den > 0.2) {
      const s = ((feet.x + aim.x * ahead - ro.x) * aim.x + (feet.z + aim.z * ahead - ro.z) * aim.z) / den;
      const side = (ro.x + rd.x * s - near.pos.x) * aim.z - (ro.z + rd.z * s - near.pos.z) * aim.x;
      const k = THREE.MathUtils.clamp(side, -0.7, 0.7);
      near.pos.x += aim.z * k;
      near.pos.z -= aim.x * k;
    }
    const g = h.world.groundAt(near.pos.x, near.pos.z, 0.3, feet.y + 1);
    if (g > -Infinity && Math.abs(g - feet.y) < 1.2) near.pos.y = g + REACH.window.height / 2 + 0.02;
    const far = { pos: spot.pos.clone(), look: spot.look.clone(), surface: spot.surface };
    const strike = h.rifts.openStrike(
      windowFrame(near.pos, near.look, 'stand'),
      windowFrame(far.pos, far.look, far.surface === 'floor' ? 'stand' : 'air'),
      REACH.window.life + 0.5,
      0,
      -1,
      ['exit', 'exit'],
    );
    this.win = { id: ++this.winSeq, strike, near, far, t: 0, seen: new Map(), noticed: new Set() };
    this.winCd = REACH.window.cooldown;
    this.faceAim();
    h.hero.play('interact', { fade: 0.06 });
    h.audio.reachWindow(far.pos, true);
    h.fx.ring(_a.copy(far.pos).setY(far.pos.y - REACH.window.height / 2 + 0.05), 1.4, 0.3, REACH_CYAN);
  }

  closeWindow() {
    const w = this.win;
    if (!w) return;
    if (w.strike >= 0) this.h.rifts.closeStrike(w.strike);
    this.win = null;
    for (const hw of [...this.hands.list]) if (hw.owner === 'player' && hw.far) this.hands.cancel(hw);
  }

  /** Who has the far window in his eyes, and who has noticed it. */
  private updateNotice(win: ReachWindow, dt: number) {
    const h = this.h;
    for (const e of h.enemies.list) {
      if (!e.alive || !e.reach || win.noticed.has(e.id) || !this.able(e.id)) continue;
      e.eye(_a);
      // (right behind him, a window left open too long is heard)
      const heard = win.t > REACH.notice.hear && Math.hypot(e.pos.x - win.far.pos.x, e.pos.z - win.far.pos.z) < REACH.notice.hearRange;
      if (heard) {
        win.noticed.add(e.id);
        h.audio.shout(e.chest(_b));
        continue;
      }
      if (!inHisEyes(_a, e.yaw, win.far.pos) || !h.world.lineOfSight(_a, win.far.pos)) {
        win.seen.delete(e.id);
        continue;
      }
      const s = (win.seen.get(e.id) ?? 0) + dt;
      win.seen.set(e.id, s);
      if (s >= REACH.notice.time) {
        win.noticed.add(e.id);
        h.audio.shout(e.chest(_b));
      }
    }
  }

  /** The window as the enemy side sees it. */
  private aiWindow(): ReachAIWindow | null {
    const w = this.win;
    if (!w) return null;
    return {
      id: w.id,
      far: w.far.pos,
      farLook: w.far.look,
      near: w.near.pos,
      noticed: (id) => w.noticed.has(id),
      through: (p, out) => {
        const ends = w.strike >= 0 ? this.h.rifts.strikeEnds(w.strike) : null;
        if (!ends) return out.copy(w.far.pos);
        // (where `p` by the near window is, seen through the far one)
        return passPoint(ends.a, ends.b, _d.copy(p), out);
      },
    };
  }

  // ------------------------------------------------------------------
  // The hand
  // ------------------------------------------------------------------

  /** Where an owner's hand is: your gauntlet (left), his right hand. */
  handOf(o: Owner, out: THREE.Vector3): THREE.Vector3 {
    const h = this.h;
    if (o === 'player') return h.hero.gauntletPos(out);
    const e = h.enemies.get(o) as Enemy | null;
    if (!e) return out.set(0, -100, 0);
    return (e.char as Character).bonePos ? (e.char as Character).bonePos('RightHand', out) : e.chest(out);
  }

  /** Where a weapon is now (on the floor, in a hand). */
  private weaponAt(w: Weapon, out: THREE.Vector3): THREE.Vector3 {
    if (w.holder === null) return out.copy(w.pos);
    if (w.holder === 'player') return this.h.hero.bonePos('RightHand', out);
    return this.handOf(w.holder, out);
  }

  private flyPos(w: Weapon, out: THREE.Vector3): THREE.Vector3 | null {
    const f = this.flights.get(w.id);
    if (!f || w.holder === null) return null;
    const k = Math.min(1, f.t / REACH.hand.fly);
    const to = w.holder === 'player' ? this.h.hero.bonePos('RightHand', _c) : this.handOf(w.holder, _c);
    return out.lerpVectors(f.from, to, k * k);
  }

  private targetOf(w: HandWindow, out: THREE.Vector3): THREE.Vector3 | null {
    if (w.kind === 'steal') return this.handOf('player', out);
    if (w.kind === 'whiff') return out.copy(w.at).addScaledVector(w.dir, 1.1);
    if (w.kind === 'grab') {
      const p = w.enemyId !== null ? this.portals.get(w.enemyId) : null;
      return p ? out.copy(p.held ? p.a : p.b).setY((p.held ? p.a.y : p.b.y) + 1.1) : null;
    }
    if (w.weapon) return w.weapon.holder === w.owner ? null : this.weaponAt(w.weapon, out);
    if (w.enemyId !== null) {
      const e = this.h.enemies.get(w.enemyId);
      return e ? e.chest(out) : null;
    }
    return null;
  }

  /** He sees your hand coming: noticed the window, and it's in front of him. */
  private guards(e: Enemy): boolean {
    const w = this.win;
    if (!w || !this.able(e.id) || !w.noticed.has(e.id)) return false;
    return sideOf(e.pos, e.yaw, w.far.pos) === 'front';
  }

  /** What HAND does at the far window now: their portal, a weapon (off the floor, out of a man's hands), the man, nothing. */
  planHand(): HandPlan | null {
    const w = this.win;
    if (!w) return null;
    const h = this.h;
    const R = REACH.window;
    const F = w.far;
    for (const p of this.portals.list) {
      if (p.dead || p.crossedT >= 0) continue;
      for (const end of [p.a, p.b]) {
        _a.set(end.x, end.y + 1.1, end.z);
        if (byWindow(F.pos, F.look, _a, R.reach + 0.5)) return { verb: 'portal', blocked: false, weapon: null, enemy: null, portal: p, at: _a.clone() };
      }
    }
    let best: HandPlan | null = null;
    let bd = Infinity;
    for (const wp of this.armory.list) {
      if (!Armory.live(wp) || wp.holder !== null || this.flights.has(wp.id)) continue;
      if (!byWindow(F.pos, F.look, wp.pos, R.reach)) continue;
      const d = wp.pos.distanceTo(F.pos);
      if (d < bd) {
        bd = d;
        best = { verb: wp.kind === 'rifle' ? 'rifle' : 'knife', blocked: false, weapon: wp, enemy: null, portal: null, at: wp.pos.clone() };
      }
    }
    for (const e0 of h.enemies.list) {
      const e = e0 as Enemy;
      if (!e.alive || !e.body || !e.reach || this.pulls.some((q) => q.id === e.id)) continue;
      const pt = bodyPoint(e.pos, e.height, F.pos, _a);
      if (!byWindow(F.pos, F.look, pt, R.reach)) continue;
      const d = pt.distanceTo(F.pos) - 0.2;
      if (d >= bd) continue;
      bd = d;
      const held = this.armory.heldBy(e.id);
      if (held && !this.flights.has(held.id)) best = { verb: 'disarm', blocked: this.guards(e), weapon: held, enemy: e, portal: null, at: this.weaponAt(held, new THREE.Vector3()) };
      else best = { verb: 'pull', blocked: this.guards(e), weapon: null, enemy: e, portal: null, at: e.chest(new THREE.Vector3()) };
    }
    return best ?? { verb: 'empty', blocked: false, weapon: null, enemy: null, portal: null, at: F.pos.clone() };
  }

  private handPress() {
    const h = this.h;
    const w = this.win!;
    const plan = this.plan ?? this.planHand()!;
    this.handCd = REACH.hand.cooldown;
    h.hero.play('interact', { fade: 0.06 });
    h.audio.reachWindow(w.far.pos, true);
    // (pressed while it's still opening: the hand comes out once it's open)
    const out = Math.max(0, REACH.window.open - w.t) + REACH.hand.out;
    const from = _a.copy(w.far.pos);
    const dir = _b.subVectors(plan.at, from);
    if (dir.lengthSq() < 1e-6) dir.copy(w.far.look);
    if (plan.verb === 'portal') {
      this.hands.open({ owner: 'player', kind: 'grab', at: from, dir, enemyId: plan.portal!.id, out, far: true });
      return;
    }
    if (plan.verb === 'empty') {
      this.hands.open({ owner: 'player', kind: 'whiff', at: from, dir: w.far.look, out, far: true });
      return;
    }
    if (plan.verb === 'pull') {
      this.hands.open({ owner: 'player', kind: 'pull', at: from, dir, enemyId: plan.enemy!.id, out, far: true });
      return;
    }
    // a weapon: off the floor, or out of his hands
    this.armory.claim(plan.weapon!, 'player');
    this.hands.open({ owner: 'player', kind: 'snatch', at: from, dir, weapon: plan.weapon, enemyId: plan.enemy?.id ?? null, out, far: true });
  }

  /** The hand got there (anyone's): did it get what it was after. */
  private resolve(w: HandWindow): boolean {
    const h = this.h;
    const me = w.owner === 'player';
    switch (w.kind) {
      case 'snatch': {
        const wp = w.weapon;
        if (!wp) return false;
        const victim = w.enemyId !== null ? (h.enemies.get(w.enemyId) as Enemy | null) : null;
        if (me) {
          // someone else's hand got there first
          if (wp.holder !== null && wp.holder !== w.enemyId) {
            this.hud.callout('reach.late', 'warn');
            h.audio.ui('deny');
            this.handCd = REACH.hand.whiff;
            return false;
          }
          // he saw it coming: he holds on
          if (victim && this.guards(victim)) return this.blocked(victim, 'reach.holdsOn');
          // (the weapon must still be by the window)
          const win = this.win;
          if (!win || !byWindow(win.far.pos, win.far.look, this.weaponAt(wp, _c), REACH.window.reach + 0.6)) return this.whiffed();
        }
        const start = this.weaponAt(wp, new THREE.Vector3());
        const feet = me ? h.player.body.pos : (h.enemies.get(w.owner as number)?.pos ?? wp.pos);
        const from = wp.holder;
        if (!this.armory.touch(wp, w.owner, typeof from === 'number' && (!me || from === w.enemyId) ? from : null, _a.set(feet.x, feet.y + 1, feet.z))) {
          if (me) {
            this.hud.callout('reach.late', 'warn');
            h.audio.ui('deny');
            this.handCd = REACH.hand.whiff;
          }
          if (wp.claim === w.owner) wp.claim = null;
          return false;
        }
        this.flights.set(wp.id, { from: start, t: 0 });
        if (typeof from === 'number') {
          const e = h.enemies.get(from) as Enemy | null;
          if (e) {
            this.ai.disarmed(e, Math.random);
            e.char.play('hitChest', { fade: 0.05 });
          }
          if (me) this.hud.callout('reach.disarm', 'good');
        }
        h.audio.reachSnatch(start, me);
        if (me) {
          h.hitstop(REACH.hand.hitstop);
          h.kick(0.25);
          h.fx.sparks(start, null, REACH_CYAN, 8);
        }
        return true;
      }
      case 'steal': {
        const wp = w.weapon;
        if (!wp || this.armory.heldBy('player') !== wp || !this.able(w.owner as number)) return false;
        const hand = this.handOf('player', _a);
        const fled = hand.distanceTo(w.at) > REACH.enemy.steal.radius || h.lastCrossT() > h.time() - w.t;
        if (fled || !h.alive()) {
          this.hud.callout('reach.dodged', 'good');
          return false;
        }
        const start = hand.clone();
        this.armory.give(wp, w.owner);
        this.flights.set(wp.id, { from: start, t: 0 });
        this.hud.callout('reach.stolen', 'warn');
        h.audio.reachSnatch(start, false);
        h.shake(0.3);
        return true;
      }
      case 'pull': {
        const e = w.enemyId !== null ? (h.enemies.get(w.enemyId) as Enemy | null) : null;
        const win = this.win;
        if (!e || !e.alive || !e.body || !win) return this.whiffed();
        if (this.guards(e)) return this.blocked(e, 'reach.slapped');
        if (!byWindow(win.far.pos, win.far.look, bodyPoint(e.pos, e.height, win.far.pos, _a), REACH.window.reach + 0.6)) return this.whiffed();
        h.enemies.hold(e, true, true);
        e.body.userData.manual = true;
        const into = new THREE.Vector3(win.far.pos.x, win.far.pos.y - REACH.window.height / 2 + 0.05, win.far.pos.z);
        this.pulls.push({ id: e.id, phase: 'in', from: e.pos.clone(), to: into, t: 0 });
        h.audio.reachPull(e.chest(_a));
        h.hitstop(REACH.pull.hitstop);
        h.shake(0.2);
        return true;
      }
      case 'stab': {
        const e = w.enemyId !== null ? (h.enemies.get(w.enemyId) as Enemy | null) : null;
        const win = this.win;
        if (!e || !e.alive || !win) return this.whiffed();
        if (!byWindow(win.far.pos, win.far.look, bodyPoint(e.pos, e.height, win.far.pos, _a), REACH.window.knife + 0.5)) return this.whiffed();
        // from the front he parries it; from behind or the side it's over
        if (this.able(e.id) && sideOf(e.pos, e.yaw, win.far.pos) === 'front') {
          win.noticed.add(e.id);
          return this.blocked(e, 'reach.parried');
        }
        this.knifeKill(e, win.far.pos);
        return true;
      }
      case 'grab': {
        const p = w.enemyId !== null ? this.portals.get(w.enemyId) : null;
        if (!p || !this.portals.grab(p)) return this.whiffed();
        // (its hold counts from your press: a quick tap still means "right in front of me")
        this.held = { p, t: w.t };
        h.audio.reachGrab(p.b);
        h.hitstop(0.04);
        h.fx.ring(_a.copy(p.b).setY(p.b.y + 0.06), 1.6, 0.3, REACH_CYAN);
        return true;
      }
      case 'whiff':
        return this.whiffed();
    }
    return false;
  }

  /** Nothing there: a visible whiff and a beat to recover. */
  private whiffed(): false {
    this.handCd = REACH.hand.whiff;
    this.hud.callout('reach.whiff', 'info');
    this.h.audio.reachSwing(this.win?.far.pos ?? this.h.player.chest(_a));
    return false;
  }

  /** He saw it coming: the hand (or the knife) knocked away, a beat to recover. */
  private blocked(e: Enemy, key: string): false {
    const h = this.h;
    this.handCd = REACH.hand.whiff;
    this.knifeCd = Math.max(this.knifeCd, REACH.hand.whiff);
    this.hud.callout(key, 'warn');
    const at = this.win?.far.pos ?? e.chest(_a);
    h.fx.sparks(_b.copy(at), null, new THREE.Color(2, 2, 2), 12);
    h.audio.reachClatter(at);
    e.char.play('strike', { fade: 0.04 });
    return false;
  }

  /** Empty hands over a weapon on the floor: it's yours. */
  private pickUp() {
    const p = this.h.player.body.pos;
    for (const w of this.armory.list) {
      if (w.holder !== null || !Armory.live(w) || !w.resting) continue;
      if (Math.hypot(w.pos.x - p.x, w.pos.z - p.z) > REACH.hand.touch || Math.abs(w.pos.y - p.y) > 1.3) continue;
      const from = w.pos.clone();
      if (!this.armory.touch(w, 'player')) continue;
      this.flights.set(w.id, { from, t: 0 });
      this.h.audio.reachSnatch(from, true);
      return;
    }
  }

  private updatePulls(dt: number) {
    const h = this.h;
    const P = REACH.pull;
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
      const pl = h.player.body.pos;
      if (q.phase === 'out') e.yaw = Math.atan2(pl.x - e.pos.x, pl.z - e.pos.z);
      h.fx.streak(_a.copy(e.pos).setY(e.pos.y + 1), _b.subVectors(q.to, q.from).multiplyScalar(3), REACH_CYAN);
      if (k < 1) {
        i++;
        continue;
      }
      if (q.phase === 'in') {
        // through: out of the near window, onto your crosshair
        const win = this.win;
        const nearFeet = win ? _c.set(win.near.pos.x, win.near.pos.y - REACH.window.height / 2, win.near.pos.z) : _c.copy(pl);
        h.fx.riftBurst(_a.copy(win?.far.pos ?? e.pos), win?.far.look ?? _b.set(0, 0, 1), REACH_CYAN);
        q.from.copy(nearFeet);
        q.to.copy(this.landing());
        q.phase = 'out';
        q.t = 0;
        e.body.pos.copy(nearFeet);
        e.char.root.position.copy(nearFeet);
        if (win) h.fx.riftBurst(_a.copy(win.near.pos), win.near.look, REACH_CYAN);
        // (the window has done its work: it shuts behind him)
        this.closeWindow();
        i++;
        continue;
      }
      this.endPull(q, true);
      this.pulls.splice(i, 1);
    }
  }

  /** Where a pulled man lands: on your crosshair, a stab away (nearer if there's no floor). */
  private landing(): THREE.Vector3 {
    const h = this.h;
    const aim = flat(h.aimRay().dir, _d);
    const p = h.player.body.pos;
    for (const k of [REACH.pull.land, 1.6, 1.25]) {
      const at = pullLanding(p, aim, new THREE.Vector3(), k);
      const y = h.standAt(at.x, at.z, p.y);
      if (y !== null && h.world.lineOfSight(_a.set(p.x, p.y + 1, p.z), _b.set(at.x, y + 1, at.z))) return at.setY(y);
    }
    return pullLanding(p, aim, new THREE.Vector3(), 1.2);
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
    h.enemies.stagger(e, REACH.pull.stun);
    this.stunUntil.set(e.id, h.time() + REACH.pull.stun);
    h.fx.dust(e.pos, 0.8);
    h.fx.ring(_a.copy(e.pos).setY(e.pos.y + 0.05), 1.1, 0.3, REACH_CYAN);
    h.audio.impact(e.pos, 7);
  }

  // ------------------------------------------------------------------
  // Their portal in your hand
  // ------------------------------------------------------------------

  /** Their portal in your hand: its exit where you aim; let go (or held too long) and it stays there. */
  private updateHeldPortal(realDt: number, held: boolean) {
    const H = this.held!;
    const p = H.p;
    if (p.dead || p.crossedT >= 0) {
      this.held = null;
      return;
    }
    H.t += realDt;
    const tap = !held && H.t < 0.18;
    const spot = tap ? this.exitAhead() : this.exitFromAim();
    this.portals.aim(p, spot.pos, spot.yaw);
    this.heldOutcome = spot.outcome;
    if (held && H.t < REACH.enemy.portal.maxHold) return;
    this.portals.release(p);
    this.held = null;
    this.handCd = REACH.hand.cooldown;
    const h = this.h;
    h.audio.reachGrab(p.b);
    h.fx.ring(_a.copy(p.b).setY(p.b.y + 0.06), 1.4, 0.35, REACH_CYAN);
    h.fx.riftBurst(_a.copy(p.b).setY(p.b.y + 1), _b.set(Math.sin(p.by), 0, Math.cos(p.by)), REACH_CYAN);
  }

  private exitAhead(): { pos: THREE.Vector3; yaw: number; outcome: HeldOutcome } {
    const h = this.h;
    const ray = h.aimRay();
    const yaw = Math.atan2(ray.dir.x, ray.dir.z);
    const p = h.player.body.pos;
    for (const k of [3, 2]) {
      const x = p.x + Math.sin(yaw) * k, z = p.z + Math.cos(yaw) * k;
      const y = h.standAt(x, z, p.y);
      if (y !== null) return { pos: new THREE.Vector3(x, y, z), yaw, outcome: 'floor' };
    }
    return this.exitFromAim();
  }

  /**
   * Where the aim puts an exit (his feet): on the floor it meets; in front of
   * a wall it meets, at the height you aimed (he flies into it, and falls from
   * there); in mid-air where the aim ends (high up: a long fall); over the
   * void or the water, where the aim crosses the deck's height.
   */
  exitFromAim(): { pos: THREE.Vector3; yaw: number; outcome: HeldOutcome } {
    const h = this.h;
    const ray = h.aimRay();
    const eye = h.eye(_eye);
    const dir = ray.dir;
    const yaw = Math.atan2(dir.x, dir.z);
    const hit = h.world.raycast(ray.origin as THREE.Vector3, dir as THREE.Vector3, 80);
    let pos: THREE.Vector3;
    if (hit && hit.point.y > -0.6) {
      if (hit.normal.y > 0.6) pos = hit.point.clone();
      else {
        // (his chest at the spot you aimed, in front of it)
        pos = hit.point.clone().addScaledVector(flat(hit.normal, _a), 0.75);
        pos.y -= 1.0;
        const g = h.world.groundAt(pos.x, pos.z, 0.2, pos.y + 1.2);
        if (g > -Infinity && pos.y < g + 0.5) pos.y = g;
      }
    } else if (dir.y < -0.02) {
      const s = (0.4 - ray.origin.y) / dir.y;
      pos = new THREE.Vector3().copy(ray.origin).addScaledVector(dir, s);
    } else {
      pos = new THREE.Vector3().copy(ray.origin).addScaledVector(dir, 22);
      pos.y -= 1.0;
    }
    const d = pos.distanceTo(eye);
    const max = REACH.range + 4;
    if (d > max) pos.lerpVectors(eye, pos, max / d);
    return { pos, yaw, outcome: this.outcomeAt(pos, yaw) };
  }

  /** What a man coming out at `pos` (his feet), flying toward `yaw`, is in for. */
  outcomeAt(pos: V3, yaw: number): HeldOutcome {
    const h = this.h;
    const base = h.exitOutcome(pos);
    const g = h.world.groundAt(pos.x, pos.z, 0.25, pos.y + 0.6);
    const height = g === -Infinity ? Infinity : pos.y - g;
    const wall = h.world.raycast(_a.set(pos.x, pos.y + 1, pos.z), _b.set(Math.sin(yaw), 0, Math.cos(yaw)), 4, { sight: false });
    return redirectOutcome(base, height, wall ? wall.distance : Infinity);
  }

  /** He's out of a portal you moved: the fall and the slam are on their way; his own side's fire finds him. */
  private redirectedOut(p: RedPortal, now: number) {
    const h = this.h;
    this.redirected.set(p.owner, now);
    h.markForAllies(p.owner, REACH.redirect.allyFire);
    const e = h.enemies.get(p.owner) as Enemy | null;
    if (!e || !e.alive) return;
    const wall = h.world.raycast(_a.set(p.b.x, p.b.y + 1, p.b.z), _b.set(Math.sin(p.by), 0, Math.cos(p.by)), REACH.redirect.slam + 0.4, { sight: false });
    const slamT = wall ? Math.max(0.04, (wall.distance - 0.45) / REACH.enemy.portal.outSpeed) : -1;
    this.flying.set(e.id, { t: 0, y0: p.b.y, slamT, slammed: false, wasUp: false });
  }

  private updateFlying(dt: number) {
    const h = this.h;
    const R = REACH.redirect;
    for (const [id, f] of this.flying) {
      const e = h.enemies.get(id) as Enemy | null;
      if (!e || !e.alive || !e.body) {
        this.flying.delete(id);
        continue;
      }
      f.t += dt;
      if (f.slamT >= 0 && !f.slammed && f.t >= f.slamT) {
        f.slammed = true;
        const c = e.chest(new THREE.Vector3());
        this.hurtBy(e, R.slamDamage, 'melee', c);
        e.body.vel.x *= -0.25;
        e.body.vel.z *= -0.25;
        h.fx.sparks(c, null, REACH_RED, 14);
        h.fx.dust(c, 0.9);
        h.audio.impact(c, 9);
        h.shake(0.25);
        this.hud.callout('reach.slam', 'good');
        if (!e.alive) {
          this.flying.delete(id);
          continue;
        }
      }
      const inAir = e.state === 'launched' && !e.body.onGround;
      if (inAir) f.wasUp = true;
      if (f.t < 0.12 || (inAir && f.t < 6)) continue;
      // down
      this.flying.delete(id);
      const drop = f.y0 - e.pos.y;
      if (drop >= R.kill) {
        this.hurtBy(e, 999, 'melee', e.pos);
        h.fx.dust(e.pos, 1.4);
        h.audio.impact(e.pos, 12);
        this.hud.callout('reach.fall', 'good');
      } else if (drop >= R.stagger || f.slammed) {
        if (drop >= R.stagger) this.hurtBy(e, R.fallDamage, 'melee', e.pos);
        if (e.alive) {
          const s = f.slammed ? R.slamStun : R.staggerTime;
          h.enemies.stagger(e, s);
          this.stunUntil.set(e.id, h.time() + s);
          h.fx.dust(e.pos, 1);
        }
      }
    }
  }

  private hurtBy(e: Enemy, amount: number, source: HitInfo['source'], from: V3) {
    this.h.enemies.hit(e, { source, amount, charged: false, team: 'player', instigator: 'player', dir: new THREE.Vector3(0, -1, 0), from: new THREE.Vector3().copy(from) });
  }

  // ------------------------------------------------------------------
  // The weapon
  // ------------------------------------------------------------------

  /** You turn to where you aim (a hand, a stab, a shot all go that way). */
  private faceAim() {
    const d = this.h.aimRay().dir;
    if (Math.abs(d.x) + Math.abs(d.z) > 1e-4) this.h.player.yaw = Math.atan2(d.x, d.z);
  }

  private shoot(w: Weapon) {
    const h = this.h;
    if (!this.armory.fire(w)) return;
    this.faceAim();
    const now = h.time();
    this.fireCd = REACH.rifle.interval;
    this.firedT = now;
    const ray = h.aimRay();
    // (through the near window: out of the far one)
    const segs = h.rifts.raycastThrough(ray.origin, ray.dir, REACH.rifle.range, h.world, 1);
    const assist = THREE.MathUtils.degToRad(h.device() === 'touch' ? 2.5 : h.device() === 'pad' ? 1.5 : 0);
    const muzzle = h.hero.heldMuzzle(new THREE.Vector3());
    let best: Enemy | null = null;
    let hitAt: THREE.Vector3 | null = null;
    let segEnd: THREE.Vector3 | null = null;
    let through = false;
    for (let si = 0; si < segs.length && !best; si++) {
      const sg = segs[si];
      const o = sg.from as THREE.Vector3;
      const dir = _d.subVectors(sg.to, sg.from);
      const far = dir.length();
      if (far < 1e-4) continue;
      dir.multiplyScalar(1 / far);
      let bestS = far;
      let bestErr = Infinity;
      for (const e0 of h.enemies.list) {
        const e = e0 as Enemy;
        if (!e.alive || !e.body) continue;
        const s = rayDistToBody(o, dir, e.pos, e.height, _a);
        if (s <= 0 || s > far) continue;
        const perp = _b.copy(o).addScaledVector(dir, s).distanceTo(_a);
        // (a reeling man right in front of you: generous, he's yours)
        const near = (this.stunUntil.get(e.id) ?? -1) > now && e.pos.distanceTo(h.player.body.pos) < 4 ? 0.35 : 0;
        const err = Math.max(0, perp - e.radius - 0.05 - near) / s;
        if (err > Math.tan(assist) + 1e-6) continue;
        if (err < bestErr || (err === bestErr && s < bestS)) {
          best = e;
          bestS = s;
          bestErr = err;
        }
      }
      if (best) {
        hitAt = bestErr === 0 ? new THREE.Vector3().copy(o).addScaledVector(dir, bestS) : best.chest(new THREE.Vector3());
        through = si > 0;
      } else if (si === segs.length - 1) {
        hitAt = new THREE.Vector3().copy(sg.to);
        through = si > 0;
        if (sg.hit) h.fx.sparks(hitAt, sg.hit.normal, REACH_CYAN, 6);
      }
      if (si === 0 && segs.length > 1) segEnd = new THREE.Vector3().copy(sg.to);
    }
    if (!hitAt) hitAt = new THREE.Vector3().copy(ray.origin).addScaledVector(ray.dir, REACH.rifle.range);
    if (best) {
      const stunned = (this.stunUntil.get(best.id) ?? -1) > now;
      const info: HitInfo = {
        source: 'bolt',
        amount: REACH.rifle.damage * (stunned ? REACH.rifle.stunnedMul : 1),
        charged: false,
        team: 'player',
        instigator: 'player',
        dir: hitAt.clone().sub(muzzle).normalize(),
        from: muzzle.clone(),
      };
      this.lastHit.set(best.id, { tool: 'rifle', t: now });
      h.enemies.hit(best, info);
      h.fx.sparks(hitAt, null, REACH_RED, 10);
      h.audio.boltImpact(hitAt, false);
    }
    // the tracer: to the near window, then out of the far one
    if (through && segEnd && segs.length > 1) {
      this.fx.tracer(muzzle, segEnd);
      this.fx.tracer(segs[1].from, hitAt);
    } else this.fx.tracer(muzzle, hitAt);
    h.fx.flash(muzzle, 2.5, 0.05, 0x7ff4ff);
    h.audio.reachRifle(muzzle);
    h.kick(0.18);
    if (w.ammo <= 0) {
      const hand = h.hero.bonePos('RightHand', new THREE.Vector3());
      this.armory.drop(w, hand, _a.set(Math.cos(h.player.yaw) * 2.5, 3, -Math.sin(h.player.yaw) * 2.5));
      this.hud.callout('reach.empty', 'info');
      h.audio.reachClatter(hand);
    }
  }

  /** The man right in front of you within a stab (no window needed). */
  private meleeTarget(): Enemy | null {
    const h = this.h;
    const p = h.player.body.pos;
    const ray = h.aimRay();
    const fy = Math.atan2(ray.dir.x, ray.dir.z);
    let bd: number = REACH.knife.melee;
    let best: Enemy | null = null;
    for (const o of h.enemies.list) {
      if (!o.alive || !o.body) continue;
      const d = Math.hypot(o.pos.x - p.x, o.pos.z - p.z);
      if (d > bd || Math.abs(o.pos.y - p.y) > 1.5) continue;
      let off = Math.atan2(o.pos.x - p.x, o.pos.z - p.z) - fy;
      while (off > Math.PI) off -= Math.PI * 2;
      while (off < -Math.PI) off += Math.PI * 2;
      if (Math.abs(off) > 0.9) continue;
      bd = d;
      best = o as Enemy;
    }
    return best;
  }

  /** The man right by the far window, within the knife's reach. */
  private windowTarget(): Enemy | null {
    const w = this.win;
    if (!w) return null;
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e0 of this.h.enemies.list) {
      const e = e0 as Enemy;
      if (!e.alive || !e.body || !e.reach) continue;
      const pt = bodyPoint(e.pos, e.height, w.far.pos, _a);
      if (!byWindow(w.far.pos, w.far.look, pt, REACH.window.knife)) continue;
      const d = pt.distanceTo(w.far.pos);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** What the knife does on a press now. */
  stabState(): ReachStab {
    if (this.meleeTarget()) return 'melee';
    if (!this.win) return null;
    const e = this.windowTarget();
    // (nothing there: the hand's chip already says so)
    if (!e) return null;
    return this.able(e.id) && sideOf(e.pos, e.yaw, this.win.far.pos) === 'front' ? 'blocked' : 'kill';
  }

  private stab() {
    const h = this.h;
    const close = this.meleeTarget();
    this.faceAim();
    h.hero.play('strike', { fade: 0.04 });
    h.audio.reachSwing(h.player.chest(_a));
    if (close) {
      this.knifeCd = REACH.knife.cooldown;
      const p = h.player.body.pos;
      h.player.lunge(_a.set(close.pos.x - p.x, 0, close.pos.z - p.z), REACH.knife.lunge, REACH.knife.lungeTime);
      this.knifeKill(close, h.player.chest(_b));
      return;
    }
    const w = this.win;
    if (!w || this.hands.of('player')) {
      this.knifeCd = 0.3;
      return;
    }
    // through the window: the knife comes out of the far one
    this.knifeCd = REACH.knife.windowCooldown;
    const e = this.windowTarget();
    const out = Math.max(0, REACH.window.open - w.t) + REACH.knife.stab;
    if (!e) {
      this.hands.open({ owner: 'player', kind: 'whiff', at: w.far.pos, dir: w.far.look, out, far: true });
      return;
    }
    const dir = e.chest(_b).sub(w.far.pos);
    this.hands.open({ owner: 'player', kind: 'stab', at: w.far.pos, dir, enemyId: e.id, out, far: true });
    h.audio.reachWindow(w.far.pos, true);
  }

  private knifeKill(e: Enemy, from: V3) {
    const h = this.h;
    const c = e.chest(new THREE.Vector3());
    this.lastHit.set(e.id, { tool: 'knife', t: h.time() });
    h.enemies.hit(e, { source: 'blade', amount: 999, charged: false, team: 'player', instigator: 'player', dir: _b.subVectors(c, from).normalize().clone(), from: new THREE.Vector3().copy(from) });
    h.hitstop(REACH.knife.hitstop);
    h.shake(0.25);
    h.fx.sparks(c, null, REACH_RED, 16);
    h.fx.flash(c, 3, 0.08, 0xff3a5a);
    h.audio.bladeFinish(c);
  }

  // ------------------------------------------------------------------
  // What you can't see
  // ------------------------------------------------------------------

  /** Edge arrows for every threat off the screen: their windows and portals, a thief, a gun on you, a knife coming. */
  private threats(): ThreatArrow[] {
    const h = this.h;
    const cam = h.camera;
    const me = h.player.body.pos;
    const out: ThreatArrow[] = [];
    const seen = new Set<string>();
    const add = (p: V3, kind: ThreatKind, key: string, urgent: boolean) => {
      if (seen.has(key) || out.length >= 8) return;
      if (_a.copy(p).distanceTo(me) > REACH.range + 2) return;
      _ndc.copy(p).applyMatrix4(cam.matrixWorldInverse);
      const behind = _ndc.z > 0;
      _ndc.copy(p).project(cam);
      const ang = edgeArrow(_ndc.x, _ndc.y, behind);
      if (ang === null) return;
      seen.add(key);
      out.push({ ang, kind, urgent });
    };
    for (const w of this.hands.list) {
      if (w.owner === 'player') continue;
      const e = h.enemies.get(w.owner as number);
      if (w.kind === 'steal' && e) add(e.chest(_b), 'thief', `e${e.id}`, true);
      else add(w.at, 'window', `w${w.id}`, false);
    }
    for (const p of this.portals.list) {
      if (p.crossedT >= 0) continue;
      add(_c.copy(p.b).setY(p.b.y + 1.1), 'portal', `p${p.id}`, p.b.distanceTo(me) < 10);
    }
    for (const e of h.enemies.list) {
      if (!e.alive || !e.reach) continue;
      const w = this.armory.heldBy(e.id);
      if (this.ai.aiming(e.id)) add(e.chest(_b), 'gun', `e${e.id}`, true);
      else if (w?.kind === 'knife' && e.pos.distanceTo(me) < 12) add(e.chest(_b), 'knife', `e${e.id}`, e.pos.distanceTo(me) < 6);
    }
    return out;
  }

  dispose() {
    this.hud.dispose();
    this.fx.clear();
  }
}

/** Along the ray (o, unit d), the distance where it passes nearest a man's axis (feet p, height ht); `out`: that point on his axis. */
function rayDistToBody(o: V3, d: V3, p: V3, ht: number, out: THREE.Vector3): number {
  const dx = d.x, dz = d.z;
  const A = dx * dx + dz * dz;
  let s: number;
  if (A < 1e-9) s = p.y - o.y;
  else s = ((p.x - o.x) * dx + (p.z - o.z) * dz) / A;
  const y = o.y + d.y * s;
  out.set(p.x, THREE.MathUtils.clamp(y, p.y + 0.1, p.y + ht), p.z);
  return Math.max(0, _c.subVectors(out, o).dot(d));
}

