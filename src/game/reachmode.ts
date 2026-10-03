import * as THREE from 'three';
import type { HitInfo, KillEvent, V3 } from '../core/contracts';
import type { CollisionWorld } from '../world/collision';
import type { Enemy, EnemySystem } from '../actors/enemies';
import { ReachAI, RedPortals, type RedPortal } from '../actors/reachai';
import type { Audio } from '../engine/audio';
import type { LabWave } from '../world/combatlab/layout';
import { ReachHud, type ReachVerb } from '../ui/reachhud';
import { t } from '../ui/i18n';
import type { Character } from './characters';
import type { FxKit } from './fxkit';
import type { LabTool } from './labdirector';
import type { Player } from './player';
import { Hands, knifeReach, pickAim, REACH, reachKillTool, windowSpot, type AimCandidate, type HandWindow } from './reach';
import { REACH_CYAN, REACH_RED, ReachFx } from './reachfx';
import { Armory, type Owner, type Weapon } from './weapons';

/** What REACH needs from the game. */
export interface ReachHost {
  readonly world: CollisionWorld;
  readonly enemies: EnemySystem;
  readonly fx: FxKit;
  readonly audio: Audio;
  readonly camera: THREE.Camera;
  readonly player: Player;
  readonly hero: Character;
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
}

/** The game's input to REACH this frame. */
export interface ReachInput {
  /** WEAPON (LMB / RT / the WEAPON button). */
  fire: boolean;
  firePress: boolean;
  /** HAND (RMB / LT / the HAND button). */
  hand: boolean;
  handPress: boolean;
}

/** What the hand would take now (the HUD's chip, the highlight). */
export interface ReachAim {
  kind: AimCandidate['kind'];
  id: number;
  verb: ReachVerb;
  /** The point on it the aim is nearest. */
  point: THREE.Vector3;
  /** Where to draw the mark (a man's feet, a portal's foot). */
  at: THREE.Vector3;
  what: Weapon['kind'] | null;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _eye = new THREE.Vector3();

const ABLE = new Set(['combat', 'idle', 'patrol', 'suspicious', 'charge']);

/**
 * REACH in the game (the lab's default variant; DESIGN §14): your hand, your
 * weapon, the weapons on the floor, the enemy side (actors/reachai.ts) and its
 * portals, and their look and HUD. The Game owns one while the lab is loaded
 * and calls update() only while REACH is the variant in force.
 */
export class ReachMode {
  readonly armory = new Armory();
  readonly hands = new Hands();
  readonly portals = new RedPortals();
  readonly ai: ReachAI;
  readonly fx = new ReachFx();
  readonly hud: Pick<ReachHud, 'update' | 'callout' | 'show' | 'dispose'>;
  aim: ReachAim | null = null;
  private handCd = 0;
  private fireCd = 0;
  private knifeCd = 0;
  /** A portal of theirs in your hand: its exit follows your aim. */
  private held: { p: RedPortal; t: number } | null = null;
  private heldOutcome: 'floor' | 'void' | 'water' = 'floor';
  /** Weapons on their way to a hand: from where, how long so far. */
  private flights = new Map<number, { from: THREE.Vector3; t: number }>();
  /** Men your hand is pulling to you. */
  private pulls: { id: number; from: THREE.Vector3; to: THREE.Vector3; t: number }[] = [];
  /** Reeling from a pull until (game time): rounds do more. */
  private stunUntil = new Map<number, number>();
  /** Out of a portal exit you moved (game time): his death is that portal's. */
  private redirected = new Map<number, number>();
  private seenCross = new Set<number>();
  private lastHit = new Map<number, { tool: 'rifle' | 'knife'; t: number }>();
  private firedT = -99;
  private shown = false;

  /** `hud`: the HUD to drive (tests pass a stand-in); else one is built under `hudRoot`. */
  constructor(private h: ReachHost, hudRoot: HTMLElement | null, hud?: Pick<ReachHud, 'update' | 'callout' | 'show' | 'dispose'>) {
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
    this.seenCross.clear();
    this.lastHit.clear();
    this.held = null;
    this.aim = null;
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

  /** You went down: your weapon falls where you were, your hand lets go. */
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
    for (const w of [...this.hands.list]) {
      if (w.owner !== 'player') continue;
      if (w.weapon) this.armory.unclaim(w.weapon, 'player');
      this.hands.cancel(w);
    }
    if (this.held) this.portals.release(this.held.p);
    this.held = null;
  }

  /** The lab's KILLS BY TOOL for this death. */
  toolFor(ev: KillEvent): LabTool {
    const now = this.h.time();
    const r = this.redirected.get(ev.enemyId);
    const hit = this.lastHit.get(ev.enemyId);
    const mine = hit && now - hit.t < 0.6 ? hit.tool : null;
    return reachKillTool(ev.cause, r !== undefined && now - r < 8, mine);
  }

  // ------------------------------------------------------------------
  // Per frame
  // ------------------------------------------------------------------

  update(dt: number, realDt: number, inp: ReachInput) {
    const h = this.h;
    const now = h.time();
    this.handCd -= realDt;
    this.fireCd -= dt;
    this.knifeCd -= dt;
    const alive = h.alive();
    const go = h.fighting();

    // a man who goes down lets go of what he held
    for (const w of this.armory.list) {
      if (typeof w.holder !== 'number') continue;
      const e = h.enemies.get(w.holder);
      if (e && e.alive) continue;
      const at = e ? e.pos : w.pos;
      this.armory.drop(w, _a.set(at.x, at.y + 1.1, at.z), _b.set((Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3));
      this.flights.delete(w.id);
    }

    // what the hand would take
    this.aim = alive && !this.held ? this.pickHand() : null;

    // the hand
    if (this.held) this.updateHeldPortal(realDt, inp.hand);
    else if (inp.handPress && alive && this.handCd <= 0 && !this.hands.of('player')) {
      if (go) this.handPress();
      else h.audio.ui('deny');
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
      if (p.redirected) this.redirected.set(p.owner, now);
    }
    this.armory.update(
      dt,
      (x, z, y) => h.world.groundAt(x, z, 0.05, y),
      (p) => h.lost(p),
    );

    // weapons in hands (shown once they've arrived)
    const mineNow = this.armory.heldBy('player');
    h.hero.setHeld(mineNow && !this.flights.has(mineNow.id) ? mineNow.kind : null);
    // (a rifle: carried half up, all the way up while you fire and a beat after)
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
      aim: this.aim ? { kind: this.aim.kind, id: this.aim.id, at: this.aim.at, ok: this.aim.verb !== 'late' } : null,
      heldPortal: this.held ? this.held.p.id : -1,
      flying: (w, out) => this.flyPos(w, out),
      camera: h.camera,
    });
    let warn = false;
    for (const w of this.hands.list) if (w.kind === 'steal' && w.t < w.tele) warn = true;
    let incoming = false;
    for (const p of this.portals.list) if (p.crossedT < 0 && !p.held && p.b.distanceTo(h.player.body.pos) < 6) incoming = true;
    const knifeOn = mineNow?.kind === 'knife' ? this.knifeTarget() : null;
    this.hud.update({
      device: h.device(),
      aim: this.aim ? { verb: this.aim.verb, what: this.aim.what } : null,
      stab: knifeOn ? knifeOn.how : null,
      held: this.held ? this.heldOutcome : null,
      weapon: mineNow ? { kind: mineNow.kind, ammo: mineNow.ammo } : null,
      warn,
      incoming,
      go,
    });

    // stale bookkeeping
    for (const [id, t] of this.stunUntil) if (t < now) this.stunUntil.delete(id);
  }

  /** What the phone's buttons say: HAND's verb, WEAPON's rounds (or KNIFE). */
  touchState(): { hand: string | null; handKind: string | null; weapon: string | null; far: boolean } {
    const a = this.aim;
    const w = this.armory.heldBy('player');
    const verb = this.held ? `reach.exit.${this.heldOutcome}` : a ? (a.verb === 'snatch' && a.what ? `reach.verb.snatch.${a.what}` : `reach.verb.${a.verb}`) : null;
    return {
      hand: verb ? t(verb) : null,
      handKind: this.held ? 'portal' : a ? a.verb : null,
      weapon: w ? (w.kind === 'rifle' ? String(w.ammo) : t('reach.w.knife')) : null,
      far: w?.kind === 'knife' && this.knifeTarget()?.how === 'window',
    };
  }

  /** Can this man use his hands (on his feet, not held, not flying). */
  private able(id: number): boolean {
    const e = this.h.enemies.get(id) as Enemy | null;
    return !!e && e.alive && !e.held && ABLE.has(e.state);
  }

  // ------------------------------------------------------------------
  // Aiming the hand
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
    if (w.weapon) return w.weapon.holder === w.owner ? null : this.weaponAt(w.weapon, out);
    if (w.enemyId !== null) {
      const e = this.h.enemies.get(w.enemyId);
      return e ? e.chest(out) : null;
    }
    return null;
  }

  private cands: AimCandidate[] = [];

  private pickHand(): ReachAim | null {
    const h = this.h;
    const eye = h.eye(_eye);
    const C = this.cands;
    C.length = 0;
    const R = REACH.hand;
    for (const p of this.portals.list) {
      if (p.dead || p.crossedT >= 0) continue;
      const pa = new THREE.Vector3(p.a.x, p.a.y + 1.05, p.a.z);
      const pb = new THREE.Vector3(p.b.x, p.b.y + 1.05, p.b.z);
      C.push({ kind: 'portal', id: p.id, a: pa, b: pa, r: R.radiusPortal });
      C.push({ kind: 'portal', id: p.id, a: pb, b: pb, r: R.radiusPortal });
    }
    for (const w of this.armory.list) {
      if (!Armory.live(w) || w.holder === 'player' || this.flights.has(w.id)) continue;
      if (typeof w.holder === 'number' && !h.enemies.get(w.holder)?.alive) continue;
      const at = this.weaponAt(w, new THREE.Vector3());
      if (w.holder === null) at.y += 0.12;
      C.push({ kind: 'weapon', id: w.id, a: at, b: at, r: w.holder === null ? R.radiusWeapon : R.radiusHeld });
    }
    for (const e of h.enemies.list) {
      if (!e.alive || !e.body || !e.reach || this.pulls.some((q) => q.id === e.id)) continue;
      const p = e.pos;
      C.push({ kind: 'body', id: e.id, a: new THREE.Vector3(p.x, p.y + 0.25, p.z), b: new THREE.Vector3(p.x, p.y + e.height - 0.1, p.z), r: R.radiusBody });
    }
    const ray = h.aimRay();
    const cone = THREE.MathUtils.degToRad(R.cone[h.device()]);
    const pick = pickAim(ray.origin, ray.dir, eye, C, { range: REACH.range, cone, sees: (_c2, pt) => h.world.lineOfSight(eye, pt) });
    if (!pick) return null;
    const c = pick.cand;
    if (c.kind === 'portal') {
      const p = this.portals.get(c.id)!;
      const end = pick.point.distanceTo(_a.set(p.a.x, p.a.y + 1.05, p.a.z)) < 0.01 ? p.a : p.b;
      return { kind: 'portal', id: c.id, verb: 'portal', point: pick.point, at: end.clone(), what: null };
    }
    if (c.kind === 'weapon') {
      const w = this.armory.get(c.id)!;
      const late = w.claim !== null && w.claim !== 'player';
      return { kind: 'weapon', id: c.id, verb: late ? 'late' : 'snatch', point: pick.point, at: pick.point.clone(), what: w.kind };
    }
    const e = h.enemies.get(c.id)!;
    return { kind: 'body', id: c.id, verb: 'pull', point: pick.point, at: e.pos.clone(), what: null };
  }

  // ------------------------------------------------------------------
  // The hand
  // ------------------------------------------------------------------

  private handPress() {
    const h = this.h;
    const a = this.aim;
    if (!a) {
      h.audio.ui('deny');
      this.handCd = 0.12;
      return;
    }
    this.handCd = REACH.hand.cooldown;
    const eye = h.eye(_eye);
    if (a.kind === 'portal') {
      const p = this.portals.get(a.id);
      if (!p || !this.portals.grab(p)) return;
      this.held = { p, t: 0 };
      h.audio.reachGrab(a.point);
      h.hitstop(0.04);
      h.hero.play('interact', { fade: 0.06 });
      h.fx.ring(_a.copy(a.at).setY(a.at.y + 0.06), 1.6, 0.3, REACH_CYAN);
      return;
    }
    windowSpot(eye, a.point, _a, _b);
    if (a.kind === 'weapon') {
      const w = this.armory.get(a.id);
      // (spoken for: your window opens anyway, and comes back empty: TOO LATE)
      const won = !!w && this.armory.claim(w, 'player');
      this.hands.open({ owner: 'player', kind: 'snatch', at: _a, dir: _b, weapon: won ? w : null });
    } else this.hands.open({ owner: 'player', kind: 'pull', at: _a, dir: _b, enemyId: a.id });
    h.audio.reachWindow(_a, true);
    h.hero.play('interact', { fade: 0.06 });
  }

  /** The hand got there (a window of anyone's): did it get what it was after. */
  private resolve(w: HandWindow): boolean {
    const h = this.h;
    const me = w.owner === 'player';
    switch (w.kind) {
      case 'snatch': {
        const wp = w.weapon;
        if (!wp || wp.claim !== w.owner || wp.gone) {
          if (me) {
            this.hud.callout('reach.late', 'warn');
            h.audio.ui('deny');
          }
          return false;
        }
        const from = wp.holder;
        const start = this.weaponAt(wp, new THREE.Vector3());
        const feet = me ? h.player.body.pos : (h.enemies.get(w.owner as number)?.pos ?? wp.pos);
        const dropped = this.armory.give(wp, w.owner, _a.set(feet.x, feet.y + 1, feet.z));
        if (dropped) dropped.vel.set((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2);
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
        if (!e || !e.alive || !e.body) return false;
        const pl = h.player;
        const fwd = _b.set(Math.sin(pl.yaw), 0, Math.cos(pl.yaw));
        const ray = h.aimRay();
        fwd.set(ray.dir.x, 0, ray.dir.z);
        if (fwd.lengthSq() < 1e-6) fwd.set(Math.sin(pl.yaw), 0, Math.cos(pl.yaw));
        fwd.normalize();
        const p = pl.body.pos;
        let to: THREE.Vector3 | null = null;
        for (const k of [REACH.pull.ahead, 1.2]) {
          const x = p.x + fwd.x * k, z = p.z + fwd.z * k;
          const y = h.standAt(x, z, p.y);
          if (y !== null) {
            to = new THREE.Vector3(x, y, z);
            break;
          }
        }
        if (!to) to = new THREE.Vector3(p.x + fwd.x * 1.2, p.y, p.z + fwd.z * 1.2);
        h.enemies.hold(e, true, true);
        e.body.userData.manual = true;
        this.pulls.push({ id: e.id, from: e.pos.clone(), to, t: 0 });
        h.audio.reachPull(e.chest(_a));
        h.hitstop(REACH.pull.hitstop);
        h.shake(0.2);
        return true;
      }
      case 'stab': {
        const e = w.enemyId !== null ? h.enemies.get(w.enemyId) : null;
        if (!e || !e.alive) return false;
        // (a man reeling from your pull dies of it; one on his feet takes two)
        if ((this.stunUntil.get(e.id) ?? -1) > h.time()) this.knifeKill(e as Enemy, w.at);
        else this.knifeHurt(e as Enemy, w.at);
        return true;
      }
    }
    return false;
  }

  private updatePulls(dt: number) {
    const h = this.h;
    for (let i = 0; i < this.pulls.length; ) {
      const q = this.pulls[i];
      const e = h.enemies.get(q.id) as Enemy | null;
      if (!e || !e.alive || !e.body) {
        if (e?.body) e.body.userData.manual = false;
        this.pulls.splice(i, 1);
        continue;
      }
      q.t += dt;
      const k = Math.min(1, q.t / REACH.pull.time);
      const ease = 1 - (1 - k) * (1 - k);
      e.body.pos.lerpVectors(q.from, q.to, ease);
      e.body.pos.y += Math.sin(Math.PI * k) * REACH.pull.arc;
      e.body.vel.set(0, 0, 0);
      const pl = h.player.body.pos;
      e.yaw = Math.atan2(pl.x - e.pos.x, pl.z - e.pos.z);
      h.fx.streak(_a.copy(e.pos).setY(e.pos.y + 1), _b.subVectors(q.to, q.from).multiplyScalar(3), REACH_CYAN);
      if (k >= 1) {
        this.endPull(q, true);
        this.pulls.splice(i, 1);
        continue;
      }
      i++;
    }
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
    h.enemies.stagger(e, REACH.pull.stun);
    this.stunUntil.set(e.id, h.time() + REACH.pull.stun);
    h.fx.dust(e.pos, 0.8);
    h.fx.ring(_a.copy(e.pos).setY(e.pos.y + 0.05), 1.1, 0.3, REACH_CYAN);
    h.audio.impact(e.pos, 7);
  }

  /** Their portal in your hand: its exit where you aim; let go (or held too long) and it stays there. */
  private updateHeldPortal(realDt: number, held: boolean) {
    const H = this.held!;
    const p = H.p;
    if (p.dead || p.crossedT >= 0) {
      this.held = null;
      return;
    }
    H.t += realDt;
    // a tap: the exit right in front of you (he comes out tumbling at your feet)
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

  private exitAhead(): { pos: THREE.Vector3; yaw: number; outcome: 'floor' | 'void' | 'water' } {
    const h = this.h;
    const ray = h.aimRay();
    const yaw = Math.atan2(ray.dir.x, ray.dir.z);
    const p = h.player.body.pos;
    for (const k of [3, 2]) {
      const x = p.x + Math.sin(yaw) * k, z = p.z + Math.cos(yaw) * k;
      const y = h.standAt(x, z, p.y);
      if (y !== null) {
        const pos = new THREE.Vector3(x, y, z);
        return { pos, yaw, outcome: 'floor' };
      }
    }
    return this.exitFromAim();
  }

  /** Where the aim puts an exit: on the floor it meets, off a wall it meets, over the void or the water it passes. */
  private exitFromAim(): { pos: THREE.Vector3; yaw: number; outcome: 'floor' | 'void' | 'water' } {
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
        pos = hit.point.clone().addScaledVector(hit.normal, 0.7);
        const g = h.world.groundAt(pos.x, pos.z, 0.2, pos.y + 0.3);
        pos.y = g > -Infinity && pos.y - g < 2.5 ? g : pos.y - 1;
      }
    } else if (dir.y < -0.02) {
      // (down past the deck's edge, into the pool or the pit: where the aim crosses deck height)
      const s = (0.4 - ray.origin.y) / dir.y;
      pos = new THREE.Vector3().copy(ray.origin).addScaledVector(dir, s);
    } else pos = new THREE.Vector3().copy(ray.origin).addScaledVector(dir, 26);
    // never further than the hand reaches
    const d = pos.distanceTo(eye);
    const max = REACH.range + 4;
    if (d > max) pos.lerpVectors(eye, pos, max / d);
    return { pos, yaw, outcome: h.exitOutcome(pos) };
  }

  // ------------------------------------------------------------------
  // The weapon
  // ------------------------------------------------------------------

  private shoot(w: Weapon) {
    const h = this.h;
    if (!this.armory.fire(w)) return;
    const now = h.time();
    this.fireCd = REACH.rifle.interval;
    this.firedT = now;
    const ray = h.aimRay();
    const o = ray.origin as THREE.Vector3, dir = ray.dir as THREE.Vector3;
    const wall = h.world.raycast(o, dir, REACH.rifle.range);
    let far = wall ? wall.distance : REACH.rifle.range;
    // a man on the line (a thumb or a pad gets a little help)
    const assist = THREE.MathUtils.degToRad(h.device() === 'touch' ? 2.5 : h.device() === 'pad' ? 1.5 : 0);
    let best: Enemy | null = null;
    let bestS = far;
    let bestErr = Infinity;
    for (const e of h.enemies.list) {
      if (!e.alive || !e.body) continue;
      const p = e.pos;
      const s = rayDistToBody(o, dir, p, e.height, _a);
      if (s <= 0 || s > far) continue;
      const perp = _b.copy(o).addScaledVector(dir, s).distanceTo(_a);
      const err = Math.max(0, perp - e.radius - 0.05) / s;
      if (err > Math.tan(assist) + 1e-6) continue;
      if (err < bestErr || (err === bestErr && s < bestS)) {
        best = e;
        bestS = s;
        bestErr = err;
      }
    }
    const muzzle = h.hero.heldMuzzle(_c);
    let hitAt: THREE.Vector3;
    if (best) {
      hitAt = best.chest(new THREE.Vector3());
      if (bestErr === 0) hitAt.copy(o).addScaledVector(dir, bestS);
      const stunned = (this.stunUntil.get(best.id) ?? -1) > now;
      const info: HitInfo = {
        source: 'bolt',
        amount: REACH.rifle.damage * (stunned ? REACH.rifle.stunnedMul : 1),
        charged: false,
        team: 'player',
        instigator: 'player',
        dir: dir.clone(),
        from: muzzle.clone(),
      };
      this.lastHit.set(best.id, { tool: 'rifle', t: now });
      h.enemies.hit(best, info);
      h.fx.sparks(hitAt, null, REACH_RED, 10);
      h.audio.boltImpact(hitAt, false);
    } else {
      far = Math.min(far, REACH.rifle.range);
      hitAt = new THREE.Vector3().copy(o).addScaledVector(dir, far);
      if (wall) h.fx.sparks(hitAt, wall.normal, REACH_CYAN, 6);
    }
    this.fx.tracer(muzzle, hitAt);
    h.fx.flash(muzzle, 2.5, 0.05, 0x7ff4ff);
    h.audio.reachRifle(muzzle);
    h.kick(0.18);
    if (w.ammo <= 0) {
      // spent: thrown aside (take another weapon)
      const hand = h.hero.bonePos('RightHand', new THREE.Vector3());
      this.armory.drop(w, hand, _a.set(Math.cos(h.player.yaw) * 2.5, 3, -Math.sin(h.player.yaw) * 2.5));
      this.hud.callout('reach.empty', 'info');
      h.audio.reachClatter(hand);
    }
  }

  /** The man your knife would go for now, and how (up close, or through a window). */
  private knifeTarget(): { e: Enemy; how: 'melee' | 'window' } | null {
    const h = this.h;
    const a = this.aim;
    let e: Enemy | null = null;
    if (a?.kind === 'body') e = h.enemies.get(a.id) as Enemy | null;
    else if (a?.kind === 'weapon') {
      const w = this.armory.get(a.id);
      if (w && typeof w.holder === 'number') e = h.enemies.get(w.holder) as Enemy | null;
    }
    const p = h.player.body.pos;
    if (!e) {
      // up close, the one in front of you
      const ray = h.aimRay();
      const fy = Math.atan2(ray.dir.x, ray.dir.z);
      let bd = REACH.knife.melee;
      for (const o of h.enemies.list) {
        if (!o.alive || !o.body) continue;
        const d = Math.hypot(o.pos.x - p.x, o.pos.z - p.z);
        if (d > bd || Math.abs(o.pos.y - p.y) > 1.5) continue;
        let off = Math.atan2(o.pos.x - p.x, o.pos.z - p.z) - fy;
        while (off > Math.PI) off -= Math.PI * 2;
        while (off < -Math.PI) off += Math.PI * 2;
        if (Math.abs(off) > 0.9) continue;
        bd = d;
        e = o;
      }
    }
    if (!e || !e.alive) return null;
    const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
    const eye = h.eye(_eye);
    const how = knifeReach(d, h.world.lineOfSight(eye, e.chest(_a)) && eye.distanceTo(_a) <= REACH.range);
    return how ? { e, how } : null;
  }

  private stab() {
    const h = this.h;
    const tgt = this.knifeTarget();
    h.hero.play('strike', { fade: 0.04 });
    h.audio.reachSwing(h.player.chest(_a));
    if (!tgt) {
      this.knifeCd = 0.3;
      return;
    }
    const e = tgt.e;
    if (tgt.how === 'melee') {
      this.knifeCd = REACH.knife.cooldown;
      const p = h.player.body.pos;
      h.player.lunge(_a.set(e.pos.x - p.x, 0, e.pos.z - p.z), REACH.knife.lunge, REACH.knife.lungeTime);
      this.knifeKill(e, h.player.chest(_b));
      return;
    }
    this.knifeCd = REACH.knife.windowCooldown;
    windowSpot(h.eye(_eye), e.chest(_c), _a, _b, 0.55);
    this.hands.open({ owner: 'player', kind: 'stab', at: _a, dir: _b, enemyId: e.id });
    h.audio.reachWindow(_a, true);
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

  /** A stab through a window into a man on his feet: it hurts and rocks him (the second one finishes him). */
  private knifeHurt(e: Enemy, from: V3) {
    const h = this.h;
    const K = REACH.knife;
    const c = e.chest(new THREE.Vector3());
    this.lastHit.set(e.id, { tool: 'knife', t: h.time() });
    const dir = _b.subVectors(c, from).normalize().clone();
    h.enemies.hit(e, { source: 'melee', amount: K.windowDamage, charged: false, team: 'player', instigator: 'player', dir, from: new THREE.Vector3().copy(from) });
    if (e.alive) h.enemies.stagger(e, K.windowStagger, dir.multiplyScalar(2));
    h.hitstop(REACH.hand.hitstop);
    h.fx.sparks(c, null, REACH_RED, 10);
    h.audio.bladeFinish(c);
  }

  dispose() {
    this.hud.dispose();
    this.fx.clear();
  }
}

/** Along the ray (o, unit d), the distance where it passes nearest a man's axis (feet p, height ht); `out`: that point on his axis. */
function rayDistToBody(o: V3, d: V3, p: V3, ht: number, out: THREE.Vector3): number {
  // closest approach in the horizontal plane, then clamp to his height
  const dx = d.x, dz = d.z;
  const A = dx * dx + dz * dz;
  let s: number;
  if (A < 1e-9) s = p.y - o.y;
  else s = ((p.x - o.x) * dx + (p.z - o.z) * dz) / A;
  const y = o.y + d.y * s;
  out.set(p.x, THREE.MathUtils.clamp(y, p.y + 0.1, p.y + ht), p.z);
  // the point on the ray nearest that point of him
  return Math.max(0, _c.subVectors(out, o).dot(d));
}

