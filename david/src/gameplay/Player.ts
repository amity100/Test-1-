import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../core/noise';
import type { Input } from '../core/Input';
import type { Engine } from '../core/Engine';
import { DavidModel } from '../characters/DavidModel';
import type { CameraRig } from './CameraRig';
import { Projectiles, raySphere } from './Projectiles';
import type { GameAudio } from './GameAudio';
import { LAYOUT } from '../world/Layout';

/**
 * David: third-person controller, sling (spin → release), staff strikes, dodge, health.
 * The realistic model must be loaded first: `await DavidModel.preload(engine.quality.name, { msaa })` (main.ts).
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
  aiming = false;
  power = 0;
  private spinT = 0;
  private dodgeT = -1;
  private dodgeDir = new THREE.Vector3();
  private strikeT = -1;
  readonly aimPoint = new THREE.Vector3();
  aimOnTarget = false;
  aimInRange = true;
  onStrikeImpact?: (tip: THREE.Vector3, forward: THREE.Vector3) => void;
  onThrow?: () => void;
  onDodge?: () => void;
  outOfBounds = 0;
  throws = 0;

  private readonly _camR = new THREE.Vector3();
  private readonly _wish = new THREE.Vector3();
  private readonly _mv = new THREE.Vector2();
  private readonly _fwd = new THREE.Vector3();

  constructor(private engine: Engine, private projectiles: Projectiles, private audio: GameAudio) {
    this.model = new DavidModel(engine.tex);
    this.model.ground = (x, z) => engine.terrain.heightAt(x, z);
    this.model.camera = engine.camera;
    this.model.attachSling(engine.dynamic);
    engine.scene.add(this.model.root);
    engine.enforceTextureBudget(this.model.root);
    this.model.onFootstep = (_side, run) => {
      this.audio.at(run ? 'footstepRun' : 'footstep', this.pos, run ? 0.55 : 0.4);
    };
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
    let target = 0;
    if (mag > 0.05) {
      wish.normalize();
      target = mag < 0.55 ? 1.6 : 3.0;
      if (input.sprint && this.canSprint && !this.carrying && !this.aiming) target = 5.7;
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
    const S = m.sling;
    if (this.controlEnabled && this.canSling && !this.carrying && !m.busy && this.dodgeT < 0) {
      if (input.slingHeld && S.loaded) {
        if (!this.aiming) {
          this.aiming = true;
          this.spinT = 0;
        }
        this.spinT += dt;
        this.power = clamp(this.spinT / 1.15, 0, 1);
        m.hold = 'spin';
        S.state = 'spin';
        m.spinPower = this.power;
      }
    }
    if (this.aiming) {
      this.computeAim(cam);
      this.audio.slingSpin(true, this.power);
      const released = input.takeRelease('sling') || !input.slingHeld;
      if (released) {
        this.aiming = false;
        m.hold = 'none';
        this.audio.slingSpin(false, 0);
        if (this.power > 0.12) this.throwStone();
        else S.state = 'idle';
      }
    } else {
      input.takeRelease('sling');
    }
    cam.aim = this.aiming ? 1 : 0;
    // reload automatically (David takes the next stone from his bag)
    if (!S.loaded && S.state === 'idle' && !m.busy) S.loaded = true;

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

  private computeAim(cam: CameraRig) {
    const camera = this.engine.camera;
    const o = camera.position.clone();
    const d = new THREE.Vector3();
    camera.getWorldDirection(d);
    let best = Infinity;
    this.aimOnTarget = false;
    for (const t of this.projectiles.targets) {
      if (!t.enabled()) continue;
      const hit = raySphere(o, d, t.center(), t.radius * 1.35);
      if (hit > 0 && hit < best) {
        best = hit;
        this.aimOnTarget = true;
      }
    }
    if (!this.aimOnTarget) {
      for (let s = 2; s < 180; s += 1.0) {
        const p = o.clone().addScaledVector(d, s);
        if (p.y < this.engine.terrain.heightAt(p.x, p.z)) {
          best = s;
          break;
        }
      }
    }
    if (!isFinite(best)) best = 120;
    this.aimPoint.copy(o).addScaledVector(d, best);
    const speed = THREE.MathUtils.lerp(16, 44, this.power);
    const from = this.model.sling.pouch;
    this.aimInRange = Projectiles.solve(from, this.aimPoint, speed).inRange;
    void cam;
  }

  private throwStone() {
    const m = this.model;
    const power = this.power;
    const aim = this.aimPoint.clone();
    m.play('throw', [
      {
        t: 0.19,
        fn: () => {
          const from = m.sling.pouch.clone();
          const speed = THREE.MathUtils.lerp(16, 44, power);
          const { vel } = Projectiles.solve(from, aim, speed);
          this.projectiles.fire(from, vel);
          m.releaseSling();
          this.audio.sfx('slingRelease', { volume: 0.9 });
          this.throws++;
          this.onThrow?.();
        },
      },
    ]);
  }
}
