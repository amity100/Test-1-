import * as THREE from 'three';
import type { Entity } from './Entities';
import type { Input } from '../core/Input';
import type { CharacterController, MoveInput } from './CharacterController';
import { MELEE, type Combat } from './Combat';
import type { ViewModel } from '../render/ViewModel';
import { WeaponLogic } from './WeaponLogic';
import { GRENADE, WEAPONS } from './Weapons';
import { KIT_SIZE, type GadgetSystem } from './Gadgets';
import { settings } from '../core/Settings';
import { clamp, damp, wrapAngle } from '../core/MathUtil';
import { Emitter } from '../core/Events';

export interface PlayerEvents extends Record<string, unknown> {
  grenade: { entity: Entity };
  melee: { entity: Entity };
  weaponSwitch: { index: number };
  reload: { entity: Entity };
  interact: { entity: Entity };
}

/** Local player: input → entity, camera and viewmodel. */
export class Player {
  readonly events = new Emitter<PlayerEvents>();
  private bobPhase = 0;
  private camDip = 0;
  private fovCurrent = 80;
  private shake = 0;
  private shakeVec = new THREE.Vector3();
  private rope: THREE.Line;
  private ropeGeo: THREE.BufferGeometry;
  private baseFov = 80;
  private burrowBlend = 0;
  enabled = true;
  /** Tool mode (trap walk): move and look only; weapons, gadgets and aim assist are off and the gun is holstered. */
  toolMode = false;
  /** Touch look smoothing carry (radians not yet applied). */
  private lookCarryX = 0;
  private lookCarryY = 0;
  /** All entities (for touch aim assist and auto fire); set by the game. */
  entities: () => Entity[] = () => [];
  private autoFireTimer = 0;
  private autoRearm = 0;
  private assistTarget: Entity | null = null;
  private assistAngle = Infinity;
  /** Seconds of steady forward movement; sprint kicks in by itself after a moment. */
  private forwardHeld = 0;
  /** Aim-down-sights snap in progress (seconds left) and the target it locks onto. */
  private snapT = 0;
  private snapTarget: Entity | null = null;
  private wasAds = false;

  constructor(
    readonly entity: Entity,
    private input: Input,
    private controller: CharacterController,
    private combat: Combat,
    private gadgets: GadgetSystem,
    readonly viewModel: ViewModel,
    private camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
  ) {
    this.ropeGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.rope = new THREE.Line(this.ropeGeo, new THREE.LineBasicMaterial({ color: 0x9ad7ff, transparent: true, opacity: 0.9 }));
    this.rope.visible = false;
    this.rope.frustumCulled = false;
    scene.add(this.rope);
  }

  /** Debug override for aim-down-sights (screenshots). */
  debugAdsHold: boolean | null = null;

  addShake(amount: number): void {
    this.shake = Math.min(1, this.shake + amount);
  }

  /** False while the command map drives the camera (the body keeps simulating). */
  cameraEnabled = true;
  /** 0..1 how far the camera has sunk into "underground" presentation. */
  get burrowAmount(): number {
    return this.burrowBlend;
  }

  update(dt: number, now: number): void {
    const e = this.entity;
    const input = this.input;
    this.baseFov = settings.data.fov;
    if (!e.alive) {
      this.rope.visible = false;
      this.viewModel.hidden = true;
      this.viewModel.update(dt, e, 0, 0, 0);
      return;
    }
    const looking = input.looking && this.enabled;
    let lookDX = this.enabled ? input.lookDX() : 0;
    let lookDY = this.enabled ? input.lookDY() : 0;
    // Without pointer lock the cursor stops at the window edge, so the outer band of the window
    // keeps turning the view (edge turn) and looking around stays possible.
    if (looking && input.fallbackLook && !input.isTouch) {
      const nx = (input.cursorX / window.innerWidth) * 2 - 1;
      const ny = (input.cursorY / window.innerHeight) * 2 - 1;
      const band = (v: number): number => (Math.abs(v) > 0.72 ? Math.sign(v) * ((Math.abs(v) - 0.72) / 0.28) : 0);
      lookDX += band(nx) * 900 * dt;
      lookDY += band(ny) * 500 * dt;
    }
    // Aim assist (the way mobile shooters do it, milder with a mouse): the camera slows down over an
    // enemy, gently follows one near the crosshair, and aiming down sights snaps onto the nearest
    // enemy in a cone. Touch also gets auto fire.
    const touch = input.isTouch && this.enabled && !this.toolMode;
    const assistOn = this.enabled && settings.data.aimAssist && !e.burrowed && !this.toolMode;
    if ((assistOn || (touch && settings.data.autoFire)) && !e.burrowed) this.findAssistTarget(12);
    else this.assistTarget = null;
    const strength = input.isTouch ? 1 : 0.6;
    const nearTarget = this.assistTarget !== null && this.assistAngle < THREE.MathUtils.degToRad(6);
    // Look
    if (looking || lookDX !== 0 || lookDY !== 0 || this.lookCarryX !== 0 || this.lookCarryY !== 0) {
      const w = e.weapon;
      const zoom = w ? THREE.MathUtils.lerp(1, WEAPONS[w.id].adsZoom, e.ads) : 1;
      // Friction: the camera slows down while the crosshair rests on an enemy.
      const friction = assistOn && nearTarget ? 1 - 0.5 * strength : 1;
      const invert = settings.data.invertY ? -1 : 1;
      if (input.isTouch) {
        // Touch look the way popular mobile shooters feel: a brisk base speed (a swipe across the screen
        // turns about half a circle), extra speed the faster the finger moves so a flick turns all the way
        // round while slow drags stay precise, a lower speed while aiming down sights, and light
        // frame-rate-independent smoothing so uneven touch samples never stutter the view.
        const px = Math.hypot(lookDX, lookDY);
        const speed = px / Math.max(dt, 1 / 240);
        const boost = 1 + clamp((speed - 600) / 2400, 0, 1) * settings.data.touchAccel;
        const adsK = e.ads > 0.5 ? settings.data.touchAdsSens : 1;
        const sens = 0.0048 * settings.data.touchSens * boost * adsK * zoom * friction;
        this.lookCarryX += lookDX * sens;
        this.lookCarryY += lookDY * sens * 0.9 * invert;
        const k = dt > 0 ? 1 - Math.exp(-dt * 40) : 1;
        const ax = this.lookCarryX * k;
        const ay = this.lookCarryY * k;
        this.lookCarryX -= ax;
        this.lookCarryY -= ay;
        if (Math.abs(this.lookCarryX) < 1e-5) this.lookCarryX = 0;
        if (Math.abs(this.lookCarryY) < 1e-5) this.lookCarryY = 0;
        e.yaw -= ax;
        e.pitch = clamp(e.pitch - ay, -1.5, 1.5);
      } else {
        // 0.0011 rad per raw count at sensitivity 1 ≈ 0.063°/count: a 360° turn in roughly 20 cm on an 800 DPI mouse.
        const sens = 0.0011 * settings.data.sensitivity * zoom * friction;
        e.yaw -= lookDX * sens;
        e.pitch = clamp(e.pitch - lookDY * sens * invert, -1.5, 1.5);
      }
    }
    if (assistOn && this.assistTarget && this.assistAngle < THREE.MathUtils.degToRad(8)) this.magnetism(dt, lookDX !== 0 || lookDY !== 0, 0.7 * strength);
    // ADS snap: the moment the sights come up, lock onto an enemy within the cone over a short blend.
    const adsNow = this.enabled && (this.debugAdsHold ?? input.adsHeld());
    if (assistOn && adsNow && !this.wasAds && this.assistTarget && this.assistAngle < THREE.MathUtils.degToRad(12)) {
      this.snapT = 0.16;
      this.snapTarget = this.assistTarget;
    }
    this.wasAds = adsNow;
    if (this.snapT > 0 && this.snapTarget && this.snapTarget.alive && adsNow) {
      this.snapT -= dt;
      this.steerTo(this.snapTarget, Math.min(1, dt * 22));
    } else this.snapT = 0;
    // Gadgets (before movement so a new state applies this frame).
    if (this.enabled && !this.toolMode) {
      for (let i = 0; i < KIT_SIZE; i++) this.gadgets.input(e, i, input.gadgetPressed(i), input.gadgetHeld(i), input.gadgetReleased(i), now);
      if (e.grapplePoint && input.jumpPressed()) this.gadgets.releaseGrapple(e);
    } else if (e.grappleReel) e.grappleReel = false;
    // Movement input. With auto sprint a moment of forward movement breaks into a run (as in most
    // modern shooters), so nobody has to hold a sprint key; aiming or crouching walks again.
    const fwdIn = this.enabled ? input.moveY() : 0;
    if (settings.data.autoSprint && fwdIn > 0.6 && !input.crouchHeld() && e.ads < 0.3 && !e.zipRide) this.forwardHeld += dt;
    else this.forwardHeld = 0;
    const mv: MoveInput = {
      strafe: this.enabled ? input.moveX() : 0,
      forward: fwdIn,
      jump: this.enabled && input.jumpPressed(),
      jumpHeld: this.enabled && input.jumpHeld(),
      sprint: this.enabled && (input.sprintHeld() || this.forwardHeld > 0.4),
      crouch: this.enabled && input.crouchHeld(),
    };
    const wasGrounded = e.grounded;
    this.controller.step(e, mv, dt);
    if (!wasGrounded && e.grounded && e.landImpact > 0) {
      this.camDip = Math.max(this.camDip, e.landImpact * 0.25);
      this.viewModel.land(e.landImpact);
      e.landImpact = 0;
    }

    // Weapons (holstered underground and while hanging from a zipline)
    WeaponLogic.update(e, dt);
    const armed = this.enabled && !e.burrowed && !e.zipRide && !this.toolMode;
    if (e.meleeTimer > 0) {
      e.meleeTimer -= dt;
      if (e.meleeTimer <= 0) this.combat.melee(e, now);
    }
    if (armed) {
      let switchTo = -1;
      const req = input.weaponSwitch();
      if (req >= 0 && req < 3) switchTo = req;
      else if (req === 100 && e.weapons.length > 1) switchTo = (e.weaponIndex + 1) % e.weapons.length;
      else if (req === 101 && e.weapons.length > 1) switchTo = (e.weaponIndex - 1 + e.weapons.length) % e.weapons.length;
      if (switchTo >= 0 && WeaponLogic.switchWeapon(e, switchTo)) this.events.emit('weaponSwitch', { index: switchTo });
      e.wantsAds = this.debugAdsHold ?? (input.adsHeld() && !e.sliding);
      if (input.reloadPressed() && WeaponLogic.startReload(e)) this.events.emit('reload', { entity: e });
      if (input.fireReleased()) e.triggerReleased = true;
      const autoNow = this.updateAutoFire(dt, touch && settings.data.autoFire);
      if (input.fireHeld() || autoNow) {
        if (WeaponLogic.tryFire(e, this.combat, now)) {
          this.viewModel.kick(e.weapon!.id);
          this.addShake(WEAPONS[e.weapon!.id].kick * 0.6);
        }
      }
      if (input.meleePressed() && e.meleeCooldown <= 0 && !e.burrowed && !e.zipRide) {
        // Knife: a short lunge forward, the blade lands a moment later.
        e.meleeCooldown = MELEE.cooldown;
        e.meleeTimer = MELEE.windup;
        const fwd = e.forwardFlat(new THREE.Vector3());
        e.vel.x += fwd.x * MELEE.lunge;
        e.vel.z += fwd.z * MELEE.lunge;
        e.reloading = false;
        this.viewModel.kick(e.weapon?.id ?? 'pistol');
        this.addShake(0.25);
        this.events.emit('melee', { entity: e });
      }
      if (input.grenadePressed() && e.grenades > 0 && e.grenadeCooldown <= 0 && !e.reloading) {
        e.grenades--;
        e.grenadeCooldown = 0.8;
        this.combat.throwGrenade(e, now);
        this.events.emit('grenade', { entity: e });
      }
      if (input.interactPressed()) this.events.emit('interact', { entity: e });
    } else {
      e.wantsAds = false;
      if (input.fireReleased()) e.triggerReleased = true;
    }
    this.viewModel.show(e.weapon ? e.weapon.id : null);
    this.viewModel.hidden = (!!e.weapon && e.weapon.id === 'sniper' && e.ads > 0.85) || e.burrowed || !!e.zipRide || this.toolMode;

    // Camera
    const speed = Math.sqrt(e.vel.x * e.vel.x + e.vel.z * e.vel.z);
    if (e.grounded && speed > 0.5 && !e.burrowed) this.bobPhase += dt * (6 + speed * 0.9);
    const bob = clamp(speed / 8, 0, 1) * (e.grounded && !e.burrowed ? 1 : 0) * (1 - e.ads * 0.7);
    this.camDip = damp(this.camDip, 0, 9, dt);
    this.shake = damp(this.shake, 0, 6, dt);
    this.shakeVec.set((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, 0).multiplyScalar(0.06);
    const eye = e.eyePos;
    this.burrowBlend = damp(this.burrowBlend, e.burrowed ? 1 : 0, 10, dt);
    if (e.burrowed) {
      // Periscope: eyes just above the ground so the tunnel can be steered, with a low rumble.
      const surface = this.gadgets.surfaceYAt(e.pos.x, e.pos.z);
      eye.y = surface + 0.32 + Math.sin(now * 23) * 0.012;
    }
    e.stepSmooth = damp(e.stepSmooth, 0, 16, dt);
    eye.y += Math.abs(Math.sin(this.bobPhase)) * 0.045 * bob - this.camDip - e.stepSmooth;
    const right = e.right(new THREE.Vector3());
    eye.addScaledVector(right, Math.sin(this.bobPhase) * 0.02 * bob);
    if (!this.cameraEnabled) return;
    this.camera.position.copy(eye);
    const pitch = clamp(e.pitch + THREE.MathUtils.degToRad(e.recoilPitch) + this.shakeVec.y, -1.55, 1.55);
    const yaw = e.yaw + THREE.MathUtils.degToRad(e.recoilYaw) + this.shakeVec.x;
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(yaw);
    this.camera.rotateX(pitch);
    let roll = e.sliding ? -0.06 : -this.shakeVec.x * 0.5;
    if (e.zipRide) roll += Math.sin(now * 3) * 0.02;
    this.camera.rotateZ(roll);
    // FOV
    const w = e.weapon;
    let fovTarget = this.baseFov;
    if (w) fovTarget *= THREE.MathUtils.lerp(1, WEAPONS[w.id].adsZoom, e.ads);
    if (speed > 6.5 && e.ads < 0.2) fovTarget += 4;
    if (e.grapplePoint && !e.grappleLatched) fovTarget += 6;
    if (e.zipRide) fovTarget += 5;
    if (e.burrowed) fovTarget -= 8;
    this.fovCurrent = damp(this.fovCurrent, fovTarget, 12, dt);
    if (Math.abs(this.camera.fov - this.fovCurrent) > 0.01) {
      this.camera.fov = this.fovCurrent;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();

    // Rope
    if (e.grapplePoint) {
      const from = this.camera.localToWorld(new THREE.Vector3(0.25, -0.2, -0.3));
      const pts = this.ropeGeo.attributes.position as THREE.BufferAttribute;
      pts.setXYZ(0, from.x, from.y, from.z);
      pts.setXYZ(1, e.grapplePoint.x, e.grapplePoint.y, e.grapplePoint.z);
      pts.needsUpdate = true;
      this.rope.visible = true;
    } else this.rope.visible = false;

    this.viewModel.update(dt, e, lookDX, lookDY, WeaponLogic.reloadProgress(e));
  }

  /** Nearest visible enemy inside a cone around the crosshair (touch aim assist / auto fire). */
  private findAssistTarget(maxDeg: number): void {
    this.assistTarget = null;
    this.assistAngle = Infinity;
    const e = this.entity;
    const eye = e.eyePos;
    const fwd = e.forward(new THREE.Vector3());
    const cosMax = Math.cos(THREE.MathUtils.degToRad(maxDeg));
    const to = new THREE.Vector3();
    for (const o of this.entities()) {
      if (o === e || !o.alive || o.burrowed) continue;
      to.set(o.pos.x, o.pos.y + o.height * 0.6, o.pos.z).sub(eye);
      const dist = to.length();
      if (dist < 1 || dist > 80) continue;
      to.divideScalar(dist);
      const cos = to.dot(fwd);
      if (cos < cosMax) continue;
      const ang = Math.acos(Math.min(1, cos));
      if (ang >= this.assistAngle) continue;
      if (this.combat.raycast(eye, to, dist - 0.4, e, false)) continue;
      this.assistTarget = o;
      this.assistAngle = ang;
    }
  }

  /** Gently steers the view towards the assist target while the player is aiming or moving. */
  private magnetism(dt: number, activeLook: boolean, amount: number): void {
    const e = this.entity;
    const o = this.assistTarget!;
    const speed = Math.hypot(e.vel.x, e.vel.z);
    if (!activeLook && speed < 1 && o.vel.lengthSq() < 0.5) return;
    this.steerTo(o, Math.min(1, dt * 4) * amount);
  }

  /** Turns the view a fraction of the way towards an entity's chest. */
  private steerTo(o: Entity, k: number): void {
    const e = this.entity;
    const eye = e.eyePos;
    const d = new THREE.Vector3(o.pos.x, o.pos.y + o.height * 0.6, o.pos.z).sub(eye);
    const targetYaw = Math.atan2(-d.x, -d.z);
    const targetPitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    e.yaw += wrapAngle(targetYaw - e.yaw) * k;
    e.pitch = clamp(e.pitch + (targetPitch - e.pitch) * k, -1.5, 1.5);
  }

  /** Auto fire: holds the trigger while the crosshair sits on an enemy; semi-autos re-arm periodically. */
  private updateAutoFire(dt: number, enabled: boolean): boolean {
    const e = this.entity;
    const w = e.weapon;
    const onTarget = enabled && !!w && !e.reloading && this.assistTarget !== null && this.assistAngle < THREE.MathUtils.degToRad(2.4);
    if (onTarget) this.autoFireTimer += dt;
    else this.autoFireTimer = Math.max(0, this.autoFireTimer - dt * 3);
    const firing = onTarget && this.autoFireTimer > 0.08;
    if (firing && w && !WEAPONS[w.id].auto) {
      this.autoRearm -= dt;
      if (this.autoRearm <= 0) {
        e.triggerReleased = true;
        this.autoRearm = 0.55;
      }
    } else this.autoRearm = 0;
    return firing;
  }

  get grenadeCount(): number {
    return this.entity.grenades;
  }
  get maxGrenades(): number {
    return GRENADE.maxCount;
  }
}
