import * as THREE from 'three';
import { clamp, damp, dampAngle, smoothstep } from '../core/noise';
import type { Input } from '../core/Input';
import type { Engine } from '../core/Engine';
import { DavidModel, THROW_RELEASE } from '../characters/DavidModel';
import type { CameraRig } from './CameraRig';
import { Projectiles, raySphere, rayCapsule, STONE_DRAG, STONE_DRAG_ROUGH, type HitTarget, type ShotInfo } from './Projectiles';
import type { GameAudio } from './GameAudio';
import type { SfxName } from '../audio/AudioEngine';
import { LAYOUT } from '../world/Layout';

/**
 * (play1, docs/gameplay-v2.md §1, §3) The sling's numbers. Hitting is skill: the stone flies on a real trajectory
 * (gravity, drag, wind — Projectiles); the reticle is the launch direction, "zeroed" at ZERO m (a perfect release at
 * that distance flies along the line of sight — nearer it passes a little high, farther it drops: aim higher at
 * range); the release must be TIMED against the whirl.
 */
export const SLING = {
  /** seconds of whirling to full power */
  powerTime: 1.4,
  /** whirl rate (revolutions / s) at no and at full power */
  rate0: 1.4,
  rate1: 3.0,
  /** the sweet release window, half width in revolutions, at no and at full power (±61° .. ±41° of the circle) */
  window0: 0.17,
  window1: 0.115,
  /** the perfect window is this share of the sweet one */
  perfectFrac: 0.35,
  /** launch speed (m/s) at no and at full power; a perfect release and a chosen smooth stone fly a little faster */
  speed0: 21,
  speed1: 37,
  perfectBonus: 1.05,
  smoothBonus: 1.02,
  /** the distance (m) at which the sling flies along the line of sight */
  zero: 14,
  /** degrees: the most a sweet (not perfect) release strays; outside the window: per revolution late / early; cap */
  sweetDev: 0.25,
  missDevPerRev: 32,
  maxDev: 10,
  /** the stone's own scatter (1 sigma, degrees): a chosen smooth stone / a rough heap stone */
  spreadSmooth: 0.06,
  spreadPlain: 0.17,
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

/** what the HUD shows of the sling (the timing ring) */
export interface SlingHud {
  /** 0..1: the aim camera eased in (the ring fades in with it) */
  aim: number;
  whirling: boolean;
  /** the whirl's phase in revolutions (the release point at every integer) */
  phase: number;
  /** sweet window half width (revolutions) and the perfect share */
  window: number;
  perfectFrac: number;
  power: number;
  /** the stone in the pouch is one of the chosen smooth stones */
  smooth: boolean;
  /** drawing / reloading (the ring waits) */
  loading: boolean;
}

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
 * David: third-person controller, the sling (carried in the sash, drawn, whirled, released on timing, reloaded,
 * stowed), staff strikes, dodge, health. The realistic model must be loaded first:
 * `await DavidModel.preload(engine.quality.name, { msaa })` (main.ts).
 *
 * THE SLING API (for Story, the range and the bear fight):
 *  - state: `model.sling.state` ('stowed' | 'draw' | 'idle' armed | 'spin' | 'release' | 'reload' | 'stow');
 *    `armed`, `aiming`, `whirling`, `power`, `whirlPhase` / `whirlRate` / `window` (the timing), `bag` (stones);
 *  - control: `canSling` (the button draws / whirls / throws), `drawSling()`, `stowSling(instant?)`;
 *  - events: `onShot(shot)` at every release (ShotInfo: power, timing, perfect, sweet, deviation, intent),
 *    `projectiles.onResolve(shot)` when it hits (shot.hit) or misses (shot.missOffset), `onBeat()` at every pass of
 *    the release point, `onNoStones()`;
 *  - `hud` for the timing ring; `lastShot`.
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
  /** the sling whirls (power and the timing run) */
  whirling = false;
  power = 0;
  whirlT = 0;
  /** revolutions since the whirl began (the release point is at every integer) */
  whirlPhase = 0;
  whirlRate = 0;
  /** the sweet window's half width now (revolutions) */
  window: number = SLING.window0;
  private dodgeT = -1;
  private dodgeDir = new THREE.Vector3();
  private strikeT = -1;
  readonly aimPoint = new THREE.Vector3();
  aimOnTarget = false;
  aimInRange = true;
  /** what the reticle is on (a range target, the bear) and how far it is */
  aimTarget: HitTarget | null = null;
  aimDist = 30;
  onStrikeImpact?: (tip: THREE.Vector3, forward: THREE.Vector3) => void;
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
  readonly hud: SlingHud = { aim: 0, whirling: false, phase: 0, window: SLING.window0, perfectFrac: SLING.perfectFrac, power: 0, smooth: false, loading: false };
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

  hurt(from: THREE.Vector3, dmg = 1) {
    if (this.invuln > 0 || this.dodgeT >= 0) return false;
    this.health = Math.max(0, this.health - dmg);
    this.invuln = 1.1;
    this.model.play('hurt');
    const push = new THREE.Vector3(this.pos.x - from.x, 0, this.pos.z - from.z).normalize().multiplyScalar(1.4);
    this.pos.add(push);
    this.audio.sfx('davidHurt', { volume: 0.9 });
    return true;
  }

  update(dt: number, input: Input, cam: CameraRig, time: number) {
    const m = this.model;
    this.invuln = Math.max(0, this.invuln - dt);
    // ------------------------------------------------ movement
    const camF = cam.forward();
    const camR = this._camR.set(-camF.z, 0, camF.x);
    const mv = this.controlEnabled ? input.move : this._mv.set(0, 0);
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
    if (this.dodgeT < 0 && this.controlEnabled) {
      this.speed = damp(this.speed, target, target > this.speed ? 6 : 9, dt);
      if (this.aiming) {
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
    if (input.take('strike') && this.controlEnabled && this.canStrike && !this.carrying && !m.busy && !this.aiming) {
      m.staffMode = 'strike';
      this.strikeT = 0;
      m.play('strike', [
        { t: 0.13, fn: () => this.audio.sfx('whoosh', { volume: 0.7 }) },
        { t: 0.26, fn: () => this.onStrikeImpact?.(m.staffTip(), this.forward) },
      ]);
    }
    if (this.strikeT >= 0) {
      this.strikeT += dt;
      if (this.strikeT > 0.75 && m.hold !== 'grab') {
        m.staffMode = 'plant';
        this.strikeT = -1;
      }
    }
    // ------------------------------------------------ dodge
    if (input.take('dodge') && this.controlEnabled && this.canDodge && this.dodgeT < 0 && m.actionName !== 'dodge') {
      this.dodgeDir.copy(mag > 0.05 ? wish : this.fwdInto(this._fwd).multiplyScalar(-1)).setY(0).normalize();
      this.dodgeT = 0;
      // lean toward the side of the dodge (character space: +x = his left)
      m.dodgeSide = this.dodgeDir.x * Math.cos(this.heading) - this.dodgeDir.z * Math.sin(this.heading);
      this.invuln = Math.max(this.invuln, 0.45);
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
    const lag = releasedEvt ? input.releaseLag() : 0;
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
        if (this.whirling) this.advanceWhirl(dt);
        this.computeAim(cam, input, dt);
        if (releasedEvt || !held) {
          if (this.whirling && this.whirlT >= SLING.minWhirl) this.throwStone(lag);
          else this.cancelAim(); // let go while drawing: he keeps the sling in his hand (armed)
        }
      }
    } else cam.lookScale = 1;
    this.postAim = Math.max(0, this.postAim - dt);
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
    h.phase = this.whirlPhase;
    h.window = this.window;
    h.power = this.power;
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
    this.window = SLING.window0;
    m.hold = 'spin';
    m.sling.state = 'spin';
  }

  private advanceWhirl(dt: number) {
    const m = this.model;
    this.whirlT += dt;
    this.power = clamp(this.whirlT / SLING.powerTime, 0, 1);
    const rate = THREE.MathUtils.lerp(SLING.rate0, SLING.rate1, Math.pow(this.power, 0.85));
    const before = this.whirlPhase;
    this.whirlPhase += rate * dt;
    this.whirlRate = rate;
    this.window = THREE.MathUtils.lerp(SLING.window0, SLING.window1, this.power);
    // the beat: in the frame nearest to the pass by the release point (at most half a frame off)
    const half = rate * dt * 0.5;
    if (Math.floor(this.whirlPhase + half) > Math.floor(before + half)) {
      this.sfx('slingWhoosh', 0.35 + 0.45 * this.power, 0.85 + 0.45 * this.power);
      this.onBeat?.();
    }
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

  /** the release: the timing against the whirl decides where the stone goes */
  private throwStone(lag: number) {
    const m = this.model;
    const phaseAt = this.whirlPhase - this.whirlRate * lag;
    const e = phaseAt - Math.round(phaseAt); // revolutions, - early / + late
    const s = this.window, p = s * SLING.perfectFrac;
    const ae = Math.abs(e);
    let mag = 0;
    if (ae > p && ae <= s) mag = (SLING.sweetDev * (ae - p)) / (s - p);
    else if (ae > s) mag = Math.min(SLING.maxDev, SLING.sweetDev + (ae - s) * SLING.missDevPerRev);
    const sg = Math.sign(e);
    const shot = Projectiles.newShot(++this.shotId);
    shot.power = this.power;
    shot.timing = e;
    shot.window = s;
    shot.perfect = ae <= p;
    shot.sweet = ae <= s;
    shot.smooth = this.pouchKind === 'smooth';
    // early: the stone flies left and a little high; late: right and low (the pouch's path round the circle)
    shot.devRight = sg * mag * 0.85;
    shot.devUp = -sg * mag * 0.5;
    shot.speed = THREE.MathUtils.lerp(SLING.speed0, SLING.speed1, this.power) * (shot.perfect ? SLING.perfectBonus : 1) * (shot.smooth ? SLING.smoothBonus : 1);
    shot.aimDist = this.aimDist;
    shot.intent = this.aimTarget ?? this.nearestTarget();
    this.pendingShot = shot;
    this.lastShot = shot;
    this.postAim = 0.9;
    this.whirling = false;
    this.aiming = false;
    this.power = 0;
    m.hold = 'none';
    this.audio.slingSpin(false, 0);
    m.play('throw', [{ t: THROW_RELEASE, fn: () => this.fire(shot) }]);
    this.onShot?.(shot);
  }

  /**
   * the cord slips: the stone leaves the pouch along the reticle's line (converging with it at the distance of what he
   * aims at), lofted to the zero, deviated by the timing, scattered by the stone. The convergence distance is the
   * intended target's (or what the reticle is on): holding the reticle ABOVE a target for the drop must not send the
   * stone toward whatever lies far behind it (the camera sits behind and beside the pouch: parallax)
   */
  private fire(shot: ShotInfo) {
    const m = this.model;
    const from = _o.copy(m.sling.pouch);
    const camera = this.engine.camera;
    const ray = camera.getWorldDirection(_r);
    const conv = shot.intent ? clamp(shot.intent.center().distanceTo(camera.position), 4, 120) : clamp(this.aimPoint.distanceTo(camera.position), 4, 120);
    const target = _u.copy(camera.position).addScaledVector(ray, conv);
    const dir = _d.subVectors(target, from);
    if (dir.lengthSq() < 1e-6) dir.copy(this.forward);
    dir.normalize();
    const v = shot.speed;
    // zeroing: the loft that brings the stone back to the line of sight at SLING.zero m (+8 % for the drag)
    const loft = 0.5 * Math.asin(clamp((9.81 * SLING.zero) / (v * v), 0, 1)) * 1.08;
    const spread = THREE.MathUtils.degToRad(shot.smooth ? SLING.spreadSmooth : SLING.spreadPlain);
    const up = THREE.MathUtils.degToRad(shot.devUp) + loft + gauss() * spread;
    const right = THREE.MathUtils.degToRad(shot.devRight) + gauss() * spread;
    const rv = _r.crossVectors(dir, UP).normalize(); // his right
    const uv = _u.crossVectors(rv, dir).normalize();
    dir.addScaledVector(uv, Math.tan(up)).addScaledVector(rv, Math.tan(right)).normalize();
    const vel = _p.copy(dir).multiplyScalar(v);
    this.pendingShot = null;
    this.pouchKind = null;
    this.projectiles.fire(from, vel, shot, shot.smooth ? STONE_DRAG : STONE_DRAG_ROUGH);
    m.releaseSling();
    this.audio.sfx('slingRelease', { volume: 0.9 });
    if (shot.perfect) this.sfx('slingPerfect', 0.9);
    if (v > 26) this.sfx('stoneWhistle', clamp((v - 22) / 16, 0.3, 1), 0.8 + clamp((v - 21) / 16, 0, 1) * 0.45);
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
    }
    if (!isFinite(best)) best = 150;
    this.aimPoint.copy(o).addScaledVector(d, best);
    this.aimDist = Math.hypot(this.aimPoint.x - this.pos.x, this.aimPoint.z - this.pos.z);
    // in range: roughly how far this power carries on a perfect release (drag included)
    const v = THREE.MathUtils.lerp(SLING.speed0, SLING.speed1, this.power);
    this.aimInRange = this.aimDist < (v * v) / 9.81 * 0.62;
    // touch screens: a little friction over a target (the aim slows down there) — never a pull onto it
    let scale = 1;
    if (input.isTouch && this.aimAssist > 0) {
      const t = this.aimTarget ?? this.nearestTarget();
      if (t) {
        const c = t.center();
        const dist = c.distanceTo(o);
        const ang = Math.acos(clamp(_p.subVectors(c, o).normalize().dot(d), -1, 1));
        const zone = Math.atan(t.radius / Math.max(1, dist)) + THREE.MathUtils.degToRad(1.4);
        if (ang < zone) scale = THREE.MathUtils.lerp(1, 0.55, this.aimAssist);
      }
    }
    cam.lookScale = damp(cam.lookScale, scale, 12, dt);
  }
}
