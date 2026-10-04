import * as THREE from 'three';
import { clamp, damp, dampAngle, smoothstep } from '../core/noise';
import type { Input } from '../core/Input';
import type { Engine } from '../core/Engine';
import { DavidModel, THROW_RELEASE, JAB_HIT, KNOCKDOWN_UP } from '../characters/DavidModel';
import type { CameraRig } from './CameraRig';
import { Projectiles, raySphere, rayCapsule, STONE_DRAG, STONE_DRAG_ROUGH, type HitTarget, type ShotInfo } from './Projectiles';
import type { GameAudio } from './GameAudio';
import type { SfxName } from '../audio/AudioEngine';
import { LAYOUT } from '../world/Layout';

/**
 * (play1, docs/gameplay-v2.md §1, §3 and v2.1) The sling's numbers. Power is the skill: hold to whirl — the power
 * fills in POWER_TIME s, then a gold "strong" window of GOLD_TIME s (a release there: full power, a little faster and
 * truer), then the arm tires and the aim sways. Release at ANY moment: no timing window, no penalty for the moment. The
 * stone flies on a real trajectory (gravity, drag, wind — Projectiles): the reticle is where a FULL-power stone goes
 * (its drop at that distance allowed for), a weaker one falls short of it, more the weaker it is.
 */
export const SLING = {
  /** seconds of whirling from weak to full power; then the gold window; beyond it the arm tires */
  powerTime: 1.0,
  goldTime: 0.6,
  /** whirl rate (revolutions / s) weak .. full */
  rate0: 1.5,
  rate1: 3.1,
  /** launch speed (m/s) at no and at full power; a gold release and a chosen smooth stone fly a little faster */
  speed0: 11,
  speed1: 33,
  goldBonus: 1.04,
  smoothBonus: 1.02,
  /** the stone's own scatter (1 sigma, degrees): a chosen smooth stone / a heap stone; a gold release is truer (×) */
  spreadSmooth: 0.12,
  spreadPlain: 0.2,
  goldSpread: 0.5,
  /** held past the gold window: the aim sways, growing to this (degrees) over TIRED_RAMP s */
  tiredSway: 1.3,
  tiredRamp: 1.5,
  /** touch screens: a small magnetism toward a target near the reticle (the share of the error closed per second) */
  magnet: 2.2,
  /** whirl at least this long before a release throws (shorter: he keeps the sling, armed) */
  minWhirl: 0.18,
  /** stow the sling after this long armed without aiming */
  stowAfter: 4.5,
} as const;

/** the shepherd's bag (יַלְקוּט): the smooth stones he chose in the stream bed and ordinary stones from the heap */
export interface StoneBag {
  smooth: number;
  plain: number;
  /** load a smooth stone first (the finale, the bear) — otherwise practice stones from the heap first */
  preferSmooth: boolean;
}

/** what the HUD shows of the sling (the power gauge round the reticle) */
export interface SlingHud {
  /** 0..1: the aim camera eased in (the ring fades in with it) */
  aim: number;
  whirling: boolean;
  /** 0..1 power (weak .. full) */
  power: number;
  /** 0..1 of the gauge's ring: the power part (to GOLD_START), then the gold window (to 1) */
  fill: number;
  /** in the gold "strong" window now */
  gold: boolean;
  /** 0..1: held past the gold window (the arm tires) */
  tired: number;
  /** where the gold zone begins on the ring (GOLD_START) */
  goldStart: number;
  /** the stone in the pouch is one of the chosen smooth stones */
  smooth: boolean;
  /** drawing / reloading (the ring waits) */
  loading: boolean;
}
/** where the gold "strong" zone begins on the gauge's ring (its share: the gold window's share of the whole hold) */
export const GOLD_START = SLING.powerTime / (SLING.powerTime + SLING.goldTime);

const _d = new THREE.Vector3();
const _o = new THREE.Vector3();
const _p = new THREE.Vector3();
const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * David: third-person controller, the sling (carried in the sash, drawn, whirled to power, released at will,
 * reloaded, stowed), staff strikes, dodge, health. The realistic model must be loaded first:
 * `await DavidModel.preload(engine.quality.name, { msaa })` (main.ts).
 *
 * THE SLING API (for Story, the range and the bear fight):
 *  - state: `model.sling.state` ('stowed' | 'draw' | 'idle' armed | 'spin' | 'release' | 'reload' | 'stow');
 *    `armed`, `aiming`, `whirling`, `power`, `whirlT`, `slingGold` / `slingTired` (the gold window / past it),
 *    `whirlPhase` / `whirlRate` (the whirl's picture), `bag` (stones);
 *  - control: `canSling` (the button draws / whirls / throws), `drawSling()`, `stowSling(instant?)`;
 *  - events: `onShot(shot)` at every release (ShotInfo: power, perfect = a gold release, intent),
 *    `projectiles.onResolve(shot)` when it hits (shot.hit) or misses (shot.missOffset), `onBeat()` at every turn of the
 *    whirl, `onNoStones()`;
 *  - `hud` for the power gauge; `lastShot`.
 */
export class Player {
  readonly model: DavidModel;
  readonly pos = new THREE.Vector3();
  heading = 0;
  speed = 0;
  health = 3;
  readonly maxHealth = 3;
  invuln = 0;
  controlEnabled = false;
  canSling = false;
  canStrike = false;
  canDodge = false;
  canSprint = true;
  carrying = false;
  /** the sling button is held: the aim camera is on (drawing / reloading / whirling) */
  aiming = false;
  /** the sling whirls (the power fills) */
  whirling = false;
  power = 0;
  whirlT = 0;
  /** revolutions since the whirl began (the picture; the release no longer depends on it) */
  whirlPhase = 0;
  whirlRate = 0;
  /** in the gold "strong" window now (full power and a small bonus for a release) */
  get slingGold() {
    return this.whirling && this.whirlT >= SLING.powerTime && this.whirlT < SLING.powerTime + SLING.goldTime;
  }
  /** 0..1: held past the gold window (the arm tires, the aim sways) */
  get slingTired() {
    return this.whirling ? clamp((this.whirlT - SLING.powerTime - SLING.goldTime) / SLING.tiredRamp, 0, 1) : 0;
  }
  private sway = new THREE.Vector2();
  private dodgeT = -1;
  private dodgeDir = new THREE.Vector3();
  private strikeT = -1;
  readonly aimPoint = new THREE.Vector3();
  aimOnTarget = false;
  aimInRange = true;
  /** what the reticle is on (a range target, the bear) and how far it is */
  aimTarget: HitTarget | null = null;
  aimDist = 30;
  /** (bear1) the staff connects: a jab of its end (`kind` 'jab', the face / nose at reach) or the swung blow ('strike') */
  onStrikeImpact?: (tip: THREE.Vector3, forward: THREE.Vector3, kind: 'jab' | 'strike') => void;
  /** (bear1) which blow the staff button gives now (the fight: a jab at reach, the swung blow when the head is close) */
  strikeKind?: () => 'jab' | 'strike';
  /** (bear1) what a blow turns him to (the bear's head in the fight): he squares up to it as he swings */
  strikeAt?: () => THREE.Vector3 | null;
  private strikeFaceT = 0;
  /** (bear1) > 0: knocked down — no movement, blows or dodges until he is up again */
  stunT = 0;
  private knockVel = new THREE.Vector3();
  /** (bear1) the last dodge: its world direction and when it began (Story reads sidestep vs straight back) */
  readonly lastDodgeDir = new THREE.Vector3();
  lastDodgeAt = -1;
  onThrow?: () => void;
  onDodge?: () => void;
  /** (play1) every release of the sling, with its timing */
  onShot?: (shot: ShotInfo) => void;
  /** (play1) the pouch passed the release point (the whirl's beat) */
  onBeat?: () => void;
  /** (play1) the sling button was pressed with an empty bag */
  onNoStones?: () => void;
  outOfBounds = 0;
  throws = 0;
  /** the shepherd's bag: none until he chooses his stones in the stream bed */
  readonly bag: StoneBag = { smooth: 0, plain: 0, preferSmooth: false };
  /** the stone now in the pouch */
  pouchKind: 'smooth' | 'plain' | null = null;
  lastShot: ShotInfo | null = null;
  /** aim friction on touch screens over a target (0 = off) */
  aimAssist = 1;
  readonly hud: SlingHud = { aim: 0, whirling: false, power: 0, fill: 0, gold: false, tired: 0, goldStart: GOLD_START, smooth: false, loading: false };
  private shotId = 0;
  private armedIdle = 0;
  /** after a release the aim lens stays a moment (to see where the stone goes), unless he walks off */
  private postAim = 0;
  private pendingShot: ShotInfo | null = null;

  private readonly _camR = new THREE.Vector3();
  private readonly _wish = new THREE.Vector3();
  private readonly _mv = new THREE.Vector2();
  private readonly _fwd = new THREE.Vector3();

  constructor(private engine: Engine, private projectiles: Projectiles, private audio: GameAudio) {
    this.model = new DavidModel(engine.tex);
    this.model.ground = (x, z) => engine.terrain.heightAt(x, z);
    this.model.camera = engine.camera;
    this.model.attachSling(engine.dynamic);
    this.model.spinExternal = true;
    engine.scene.add(this.model.root);
    engine.enforceTextureBudget(this.model.root);
    this.model.onFootstep = (_side, run) => {
      this.audio.at(run ? 'footstepRun' : 'footstep', this.pos, run ? 0.55 : 0.4);
    };
    // the sling's beats: the draw, a stone into the pouch (from the bag), the sling tucked back under the sash
    this.model.onSling = (e) => {
      if (e === 'drawStart') this.sfx('slingDraw', 0.75);
      else if (e === 'stoneIn') {
        this.takeStone();
        this.sfx('stoneToPouch', 0.7);
      } else if (e === 'stowed') this.sfx('slingStow', 0.7);
    };
  }

  /** a sound by name, guarded: a name the audio does not have (yet) is silently skipped */
  sfx(name: string, volume = 1, pitch = 1) {
    try {
      this.audio.sfx(name as SfxName, { volume, pitch });
    } catch {
      /* never */
    }
  }

  place(x: number, z: number, heading: number) {
    this.pos.set(x, this.engine.terrain.heightAt(x, z), z);
    this.heading = heading;
    this.speed = 0;
    this.syncModel();
    this.model.resetDynamics();
  }

  private syncModel() {
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.heading;
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }
  private fwdInto(out: THREE.Vector3) {
    return out.set(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  /** the sling is out of the sash */
  get armed() {
    return this.model.slingArmed;
  }
  /** stones he can sling: in the bag + the one in the pouch */
  get stones() {
    return this.bag.smooth + this.bag.plain + (this.model.sling.loaded ? 1 : 0);
  }
  /** draw the sling now (≈0.7 s) without aiming (e.g. a scripted moment) */
  drawSling() {
    if (this.bag.smooth + this.bag.plain > 0) this.model.drawSling();
  }
  /** fold and tuck the sling back under the sash (≈0.4 s); instant = at once (a cut) */
  stowSling(instant = false) {
    this.cancelAim();
    this.model.stowSling(instant);
  }

  /** Scripted movement (cinematics / QTE): walk toward a point. Returns true when arrived. */
  moveToward(target: THREE.Vector3, speed: number, dt: number, stopDist = 0.3) {
    const d = new THREE.Vector3(target.x - this.pos.x, 0, target.z - this.pos.z);
    const len = d.length();
    if (len < stopDist) {
      this.speed = damp(this.speed, 0, 8, dt);
      return true;
    }
    d.normalize();
    this.heading = dampAngle(this.heading, Math.atan2(d.x, d.z), 8, dt);
    this.speed = damp(this.speed, Math.min(speed, len * 2), 6, dt);
    this.pos.addScaledVector(d, this.speed * dt);
    this.pos.y = this.engine.terrain.heightAt(this.pos.x, this.pos.z);
    return false;
  }

  faceToward(p: THREE.Vector3, dt: number, rate = 8) {
    this.heading = dampAngle(this.heading, Math.atan2(p.x - this.pos.x, p.z - this.pos.z), rate, dt);
  }

  /** in the first moments of a dodge he is out of the blow's way (later in it only where he moved to counts) */
  get dodging() {
    return this.dodgeT >= 0;
  }
  get evading() {
    return this.dodgeT >= 0 && this.dodgeT < 0.2;
  }

  hurt(from: THREE.Vector3, dmg = 1) {
    if (this.invuln > 0 || this.evading) return false;
    this.health = Math.max(0, this.health - dmg);
    this.invuln = 1.1;
    this.model.play('hurt');
    const push = new THREE.Vector3(this.pos.x - from.x, 0, this.pos.z - from.z).normalize().multiplyScalar(1.4);
    this.pos.add(push);
    this.audio.sfx('davidHurt', { volume: 0.9 });
    return true;
  }

  /**
   * (bear1) a blow of the bear: he is thrown back (slid, not teleported), goes down onto a knee and a hand and gets up
   * on the staff — no control for KNOCKDOWN_UP s. Returns false when he was out of its way (invulnerable / evading).
   */
  knockDown(from: THREE.Vector3, dmg = 1, push = 1.5) {
    if (this.invuln > 0 || this.evading) return false;
    this.health = Math.max(0, this.health - dmg);
    this.invuln = KNOCKDOWN_UP + 0.5;
    this.stunT = KNOCKDOWN_UP;
    this.dodgeT = -1;
    this.speed = 0;
    this.cancelAim();
    this.model.staffMode = 'plant';
    this.model.play('knockdown');
    // thrown away from the blow: v0 so that it slides `push` m (exponential decay at 7 /s)
    this.knockVel.set(this.pos.x - from.x, 0, this.pos.z - from.z);
    if (this.knockVel.lengthSq() < 1e-6) this.knockVel.copy(this.forward).multiplyScalar(-1);
    this.knockVel.normalize().multiplyScalar(push * 7);
    this.heading = Math.atan2(from.x - this.pos.x, from.z - this.pos.z);
    this.audio.sfx('davidHurt', { volume: 1 });
    this.sfx('davidFall', 1);
    return true;
  }

  update(dt: number, input: Input, cam: CameraRig, time: number) {
    const m = this.model;
    this.invuln = Math.max(0, this.invuln - dt);
    // (bear1) knocked down: the slide away from the blow, then on the ground until he is up
    this.stunT = Math.max(0, this.stunT - dt);
    if (this.knockVel.lengthSq() > 1e-4) {
      this.pos.addScaledVector(this.knockVel, dt);
      this.knockVel.multiplyScalar(Math.exp(-7 * dt));
    }
    const stunned = this.stunT > 0;
    // ------------------------------------------------ movement
    const camF = cam.forward();
    const camR = this._camR.set(-camF.z, 0, camF.x);
    const mv = this.controlEnabled && !stunned ? input.move : this._mv.set(0, 0);
    const wish = this._wish.set(0, 0, 0).addScaledVector(camF, mv.y).addScaledVector(camR, mv.x);
    const mag = Math.min(1, wish.length());
    const sprinting = this.controlEnabled && input.sprint && this.canSprint && !this.carrying && mag > 0.55;
    let target = 0;
    if (mag > 0.05) {
      wish.normalize();
      target = mag < 0.55 ? 1.6 : 3.0;
      if (sprinting && !this.aiming) target = 5.7;
      if (this.carrying) target = Math.min(target, 2.1);
      if (this.aiming) target = 1.25;
      if (m.hold === 'pull' || m.hold === 'grab') target = 0;
    }
    // (bear1) a blow at the bear: he squares up to its head as he swings (and plants his feet)
    this.strikeFaceT = Math.max(0, this.strikeFaceT - dt);
    const faceAt = this.strikeFaceT > 0 ? this.strikeAt?.() : null;
    if (faceAt) target = Math.min(target, 0.8);
    if (this.dodgeT < 0 && this.controlEnabled && !stunned) {
      this.speed = damp(this.speed, target, target > this.speed ? 6 : 9, dt);
      if (faceAt) {
        this.heading = dampAngle(this.heading, Math.atan2(faceAt.x - this.pos.x, faceAt.z - this.pos.z), 26, dt);
      } else if (this.aiming) {
        this.heading = dampAngle(this.heading, Math.atan2(camF.x, camF.z), 14, dt);
      } else if (mag > 0.05) {
        this.heading = dampAngle(this.heading, Math.atan2(wish.x, wish.z), 9, dt);
      }
      const moveDir = this.aiming && mag > 0.05 ? wish : this.fwdInto(this._fwd);
      if (this.speed > 0.01) this.pos.addScaledVector(moveDir, this.speed * dt);
    }
    // dodge
    if (this.dodgeT >= 0) {
      this.dodgeT += dt;
      const k = Math.max(0, 1 - this.dodgeT / 0.42);
      this.pos.addScaledVector(this.dodgeDir, 7.5 * k * dt);
      if (this.dodgeT > 0.5) this.dodgeT = -1;
    }
    // collisions + ground
    this.engine.colliders.resolve(this.pos, 0.32);
    const r = Math.hypot(this.pos.x - LAYOUT.start.x, this.pos.z - LAYOUT.start.z);
    const R = LAYOUT.playRadius;
    this.outOfBounds = Math.max(0, r - (R - 25));
    if (r > R) {
      this.pos.x = LAYOUT.start.x + ((this.pos.x - LAYOUT.start.x) / r) * R;
      this.pos.z = LAYOUT.start.z + ((this.pos.z - LAYOUT.start.z) / r) * R;
    }
    this.pos.y = this.engine.terrain.heightAt(this.pos.x, this.pos.z);
    m.speed = this.dodgeT >= 0 ? 0 : this.speed;
    this.syncModel();

    // ------------------------------------------------ sling
    this.updateSling(dt, input, cam, sprinting && mag > 0.55);

    // ------------------------------------------------ staff strike
    if (input.take('strike') && this.controlEnabled && !stunned && this.canStrike && !this.carrying && !m.busy && !this.aiming) {
      m.staffMode = 'strike';
      this.strikeT = 0;
      this.strikeFaceT = this.strikeAt ? 0.3 : 0;
      if ((this.strikeKind?.() ?? 'strike') === 'jab') {
        // (bear1) the jab: the staff's end driven at the face from out of the bear's reach
        m.play('jab', [
          { t: 0.09, fn: () => this.audio.sfx('whoosh', { volume: 0.55, pitch: 1.25 }) },
          { t: JAB_HIT, fn: () => this.onStrikeImpact?.(m.staffTip(), this.forward, 'jab') },
        ]);
      } else {
        m.play('strike', [
          { t: 0.13, fn: () => this.audio.sfx('whoosh', { volume: 0.7 }) },
          { t: 0.26, fn: () => this.onStrikeImpact?.(m.staffTip(), this.forward, 'strike') },
        ]);
      }
    }
    if (this.strikeT >= 0) {
      this.strikeT += dt;
      if (this.strikeT > 0.75 && m.hold !== 'grab') {
        m.staffMode = 'plant';
        this.strikeT = -1;
      }
    }
    // ------------------------------------------------ dodge
    if (input.take('dodge') && this.controlEnabled && !stunned && this.canDodge && this.dodgeT < 0 && m.actionName !== 'dodge') {
      this.dodgeDir.copy(mag > 0.05 ? wish : this.fwdInto(this._fwd).multiplyScalar(-1)).setY(0).normalize();
      this.dodgeT = 0;
      this.lastDodgeDir.copy(this.dodgeDir);
      this.lastDodgeAt = time;
      // lean toward the side of the dodge (character space: +x = his left)
      m.dodgeSide = this.dodgeDir.x * Math.cos(this.heading) - this.dodgeDir.z * Math.sin(this.heading);
      // (bear1) only the first instant of the dodge is out of harm's way: after that, where he moved to decides
      this.invuln = Math.max(this.invuln, 0.2);
      m.play('dodge');
      this.audio.sfx('dodge', { volume: 0.8 });
      this.onDodge?.();
    }

    // ------------------------------------------------ animate
    m.viewportHeight = this.engine.renderer.domElement.height;
    m.update(dt);
    const aimDir = cam.forward();
    m.updateSling(dt, aimDir);
    void time;
  }

  // ============================================================================ the sling (play1)
  private updateSling(dt: number, input: Input, cam: CameraRig, sprinting: boolean) {
    const m = this.model;
    const S = m.sling;
    m.bagStones = this.bag.smooth + this.bag.plain;
    const pressed = input.take('sling');
    const held = input.slingHeld;
    const releasedEvt = input.takeRelease('sling');
    // Story (rescue, clinch) may switch the aim off directly
    if (!this.aiming && this.whirling) this.cancelAim();
    const act = m.actionName;
    const can = this.controlEnabled && this.canSling && !this.carrying && this.dodgeT < 0 && (!act || act === 'throw' || act === 'dodge');
    // a stone that left the pouch without a throw (stowed loaded) goes back into the bag
    if (this.pouchKind && !S.loaded && !this.pendingShot) {
      this.bag[this.pouchKind]++;
      this.pouchKind = null;
    }
    // ---- stow: a cinematic, the lamb, a sprint, the sling taken away — or a few seconds armed without aiming
    if (m.slingArmed && S.state !== 'stow') {
      if (!this.controlEnabled || this.carrying || !this.canSling || (sprinting && !this.aiming)) {
        this.cancelAim();
        m.stowSling();
      } else if (!this.aiming && S.state === 'idle') {
        this.armedIdle += dt;
        if (this.armedIdle > SLING.stowAfter) m.stowSling();
      } else this.armedIdle = 0;
    } else this.armedIdle = 0;
    // ---- take aim: draw (from the sash) or reload (armed and empty); the aim camera eases in at once
    if (can && held && !this.aiming) {
      if (S.loaded || this.bag.smooth + this.bag.plain > 0) {
        this.aiming = true;
        this.whirling = false;
        if (S.state === 'stowed' || S.state === 'stow') m.drawSling();
        else if (S.state === 'idle' && !S.loaded) m.reloadSling();
      } else if (pressed) this.onNoStones?.();
    }
    if (this.aiming) {
      if (!can && !this.pendingShot) this.cancelAim();
      else {
        if (!this.whirling && m.slingReady && !this.pendingShot) this.startWhirl();
        if (!this.whirling && S.state === 'idle' && !S.loaded) m.reloadSling();
        if (this.whirling) this.advanceWhirl(dt, cam);
        this.computeAim(cam, input, dt);
        if (releasedEvt || !held) {
          // released at any moment: the stone goes (the throw's whip brings the pouch round within ≈0.09 s)
          if (this.whirling && this.whirlT >= SLING.minWhirl) this.throwStone();
          else this.cancelAim(); // let go while drawing: he keeps the sling in his hand (armed)
        }
      }
    } else cam.lookScale = 1;
    this.postAim = Math.max(0, this.postAim - dt);
    // (play1) the aim lens stays until the stone has come down (and a little after): a miss shows where it went
    if (this.postAim > 0 && this.lastShot && !this.lastShot.resolved) this.postAim = Math.max(this.postAim, 0.5);
    if (this.speed > 1.0 || !this.controlEnabled) this.postAim = 0;
    cam.aim = this.aiming || this.postAim > 0 ? 1 : 0;
    cam.aimFov = THREE.MathUtils.lerp(40, 26, smoothstep(10, 36, this.aimDist));
    // the whirl's sound: its rate is the picture's (the loop) + one whoosh per pass of the release point (the beat)
    if (this.whirling) this.audio.slingSpin(true, this.power, this.whirlRate);
    else this.audio.slingSpin(false, 0);
    // HUD
    const h = this.hud;
    h.aim = cam.aimWeight * (this.aiming || this.whirling || this.postAim > 0 ? 1 : 0);
    h.whirling = this.whirling;
    h.power = this.power;
    h.fill = this.whirling ? clamp(this.whirlT / (SLING.powerTime + SLING.goldTime), 0, 1) : 0;
    h.gold = this.slingGold;
    h.tired = this.slingTired;
    h.smooth = this.pouchKind === 'smooth';
    h.loading = this.aiming && !this.whirling;
  }

  private startWhirl() {
    const m = this.model;
    this.whirling = true;
    this.whirlT = 0;
    this.power = 0;
    // the first pass by the release point comes ≈0.45 s after the first turn (a full turn to find the rhythm)
    this.whirlPhase = -0.62;
    this.whirlRate = SLING.rate0;
    this.sway.set(0, 0);
    m.hold = 'spin';
    m.sling.state = 'spin';
  }

  private advanceWhirl(dt: number, cam: CameraRig) {
    const m = this.model;
    const wasGold = this.slingGold;
    this.whirlT += dt;
    this.power = clamp(this.whirlT / SLING.powerTime, 0, 1);
    const rate = THREE.MathUtils.lerp(SLING.rate0, SLING.rate1, Math.pow(this.power, 0.85));
    const before = this.whirlPhase;
    this.whirlPhase += rate * dt;
    this.whirlRate = rate;
    // the whirl's rhythm: a whoosh at every turn, rising with the power
    const half = rate * dt * 0.5;
    if (Math.floor(this.whirlPhase + half) > Math.floor(before + half)) {
      this.sfx('slingWhoosh', 0.35 + 0.45 * this.power, 0.85 + 0.45 * this.power);
      this.onBeat?.();
    }
    // the gold window opens: a soft cue
    if (this.slingGold && !wasGold) this.sfx('slingPerfect', 0.35, 1.25);
    // held past it, his arm tires: the aim sways gently (the reticle drifts; he can still throw)
    const tired = this.slingTired;
    const A = THREE.MathUtils.degToRad(SLING.tiredSway) * tired;
    const sx = A * Math.sin(this.whirlT * 1.9), sy = A * 0.6 * Math.sin(this.whirlT * 2.7 + 1.1);
    cam.yaw += sx - this.sway.x;
    cam.pitch += sy - this.sway.y;
    this.sway.set(sx, sy);
    m.spinPhase = this.whirlPhase * Math.PI * 2;
    m.spinPower = this.power;
    m.spinRate = rate;
  }

  /** stop aiming (no throw): the whirl stops, the sling stays in his hand (armed) */
  cancelAim() {
    const m = this.model;
    if (this.whirling || m.hold === 'spin') {
      if (m.hold === 'spin') m.hold = 'none';
      if (m.sling.state === 'spin' && m.actionName !== 'throw') m.sling.state = 'idle';
    }
    this.aiming = false;
    this.whirling = false;
    this.power = 0;
  }

  /** take a stone from the bag into the pouch (the model's 'stoneIn' beat) */
  private takeStone() {
    const b = this.bag;
    if (b.smooth + b.plain <= 0) return;
    const smooth = b.smooth > 0 && (b.preferSmooth || b.plain <= 0);
    if (smooth) b.smooth--;
    else b.plain--;
    this.pouchKind = smooth ? 'smooth' : 'plain';
  }

  /**
   * the release — at any moment (gameplay v2.1): the power decides how far it flies; a release in the gold window is
   * full power with a small bonus (a little faster and truer) and counts as a strong throw (`shot.perfect`)
   */
  private throwStone() {
    const m = this.model;
    const gold = this.slingGold;
    const shot = Projectiles.newShot(++this.shotId);
    shot.power = this.power;
    shot.timing = 0;
    shot.window = 0;
    shot.perfect = gold;
    shot.sweet = true;
    shot.smooth = this.pouchKind === 'smooth';
    shot.devRight = 0;
    shot.devUp = 0;
    shot.speed = THREE.MathUtils.lerp(SLING.speed0, SLING.speed1, this.power) * (gold ? SLING.goldBonus : 1) * (shot.smooth ? SLING.smoothBonus : 1);
    shot.aimDist = this.aimDist;
    shot.intent = this.aimTarget ?? this.nearestTarget();
    this.throwAim.copy(this.aimPoint);
    this.pendingShot = shot;
    this.lastShot = shot;
    this.postAim = 0.9;
    this.whirling = false;
    this.aiming = false;
    this.power = 0;
    this.sway.set(0, 0);
    m.hold = 'none';
    this.audio.slingSpin(false, 0);
    m.play('throw', [{ t: THROW_RELEASE, fn: () => this.fire(shot) }]);
    this.onShot?.(shot);
  }
  private readonly throwAim = new THREE.Vector3();

  /**
   * the cord slips: the stone leaves the pouch toward the reticle's point (the target under it, or the ground, or far
   * out), raised so that a FULL-power stone comes down there (drag and drop allowed for; not the wind — he aims into
   * it). A weaker stone keeps that line and falls short, more the weaker it is; then the stone's own scatter.
   */
  private fire(shot: ShotInfo) {
    const m = this.model;
    const from = _o.copy(m.sling.pouch);
    const to = this.throwAim;
    const k = shot.smooth ? STONE_DRAG : STONE_DRAG_ROUGH;
    const v = shot.speed;
    // the line is solved for full power: for this stone if he threw it at full power (gold or not), else for a full one
    const vRef = shot.power >= 0.999 ? v : SLING.speed1 * (shot.smooth ? SLING.smoothBonus : 1);
    const el = Projectiles.elevation(from, to, vRef, k).angle;
    const az = Math.atan2(to.x - from.x, to.z - from.z);
    const spread = THREE.MathUtils.degToRad(shot.smooth ? SLING.spreadSmooth : SLING.spreadPlain) * (shot.perfect ? SLING.goldSpread : 1);
    const e = el + gauss() * spread, a = az + gauss() * spread;
    const vel = _p.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(v);
    this.pendingShot = null;
    this.pouchKind = null;
    this.projectiles.fire(from, vel, shot, k);
    m.releaseSling();
    this.audio.sfx('slingRelease', { volume: 0.9 });
    if (shot.perfect) this.sfx('slingPerfect', 0.9);
    if (v > 24) this.sfx('stoneWhistle', clamp((v - 20) / 14, 0.3, 1), 0.8 + clamp((v - 19) / 14, 0, 1) * 0.45);
    this.throws++;
    this.onThrow?.();
  }

  /** the enabled target nearest to the aim line (for the miss read-out when the reticle is on nothing) */
  private nearestTarget(): HitTarget | null {
    const camera = this.engine.camera;
    const o = camera.position;
    camera.getWorldDirection(_d);
    let best: HitTarget | null = null, ba = 0.12; // within ~7° of the aim line
    for (const t of this.projectiles.targets) {
      if (!t.enabled() || t.kind === 'solid') continue;
      const c = t.center();
      _p.subVectors(c, o);
      const dist = _p.length();
      if (dist < 1) continue;
      const ang = Math.acos(clamp(_p.dot(_d) / dist, -1, 1));
      if (ang < ba) {
        ba = ang;
        best = t;
      }
    }
    return best;
  }

  private computeAim(cam: CameraRig, input: Input, dt: number) {
    const camera = this.engine.camera;
    const o = camera.position;
    const d = camera.getWorldDirection(_d);
    let best = Infinity;
    this.aimTarget = null;
    for (const t of this.projectiles.targets) {
      if (!t.enabled() || t.kind === 'solid') continue;
      let hit: number;
      if (t.segment) {
        const [p0, p1] = t.segment();
        hit = rayCapsule(o, d, p0, p1, t.radius);
      } else hit = raySphere(o, d, t.center(), t.radius);
      if (hit > 0 && hit < best) {
        best = hit;
        this.aimTarget = t;
      }
    }
    this.aimOnTarget = !!this.aimTarget;
    if (!this.aimTarget) {
      // the ground under the reticle (marching out, finer near)
      for (let s = 1.5; s < 170; s += s < 40 ? 0.5 : 1.5) {
        const px = o.x + d.x * s, py = o.y + d.y * s, pz = o.z + d.z * s;
        if (py < this.engine.terrain.heightAt(px, pz)) {
          best = s;
          break;
        }
      }
      // (w4) the reticle just off a target: the stone is thrown at THAT target's range (its line stays his own), so a
      // near miss stays a near miss — not a stone sailing on to the ground metres behind the jar
      let lockS = Infinity, lockA = Infinity;
      for (const t of this.projectiles.targets) {
        if (!t.enabled() || t.kind === 'solid') continue;
        const s = _p.subVectors(t.center(), o).dot(d);
        if (s < 3 || s > best) continue;
        const off = Math.sqrt(Math.max(0, _p.lengthSq() - s * s));
        if (off < t.radius + 0.45 + 0.012 * s && off / s < lockA) {
          lockA = off / s;
          lockS = s;
        }
      }
      if (lockS < best) best = lockS;
    }
    if (!isFinite(best)) best = 150;
    this.aimPoint.copy(o).addScaledVector(d, best);
    this.aimDist = Math.hypot(this.aimPoint.x - this.pos.x, this.aimPoint.z - this.pos.z);
    // in range: roughly how far this power carries on a perfect release (drag included)
    const v = THREE.MathUtils.lerp(SLING.speed0, SLING.speed1, this.power);
    this.aimInRange = this.aimDist < (v * v) / 9.81 * 0.62;
    // touch screens: a little friction and a small magnetism over a target near the reticle (never a snap onto it)
    let scale = 1;
    if (input.isTouch && this.aimAssist > 0) {
      const t = this.aimTarget ?? this.nearestTarget();
      if (t) {
        const c = t.center();
        const dist = c.distanceTo(o);
        const dt3 = _p.subVectors(c, o).normalize();
        const ang = Math.acos(clamp(dt3.dot(d), -1, 1));
        const zone = Math.atan(t.radius / Math.max(1, dist)) + THREE.MathUtils.degToRad(1.4);
        if (ang < zone) {
          scale = THREE.MathUtils.lerp(1, 0.55, this.aimAssist);
          const k = (1 - Math.exp(-SLING.magnet * dt)) * 0.5 * this.aimAssist;
          let dy = Math.atan2(-dt3.x, -dt3.z) - Math.atan2(-d.x, -d.z);
          while (dy > Math.PI) dy -= 2 * Math.PI;
          while (dy < -Math.PI) dy += 2 * Math.PI;
          cam.yaw += dy * k;
          cam.pitch -= (Math.asin(clamp(dt3.y, -1, 1)) - Math.asin(clamp(d.y, -1, 1))) * k;
        }
      }
    }
    cam.lookScale = damp(cam.lookScale, scale, 12, dt);
  }
}
