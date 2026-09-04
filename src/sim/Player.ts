import * as THREE from 'three';
import type { Entity } from './Entities';
import type { Input } from '../core/Input';
import type { CharacterController, MoveInput } from './CharacterController';
import type { Combat } from './Combat';
import type { ViewModel } from '../render/ViewModel';
import { WeaponLogic } from './WeaponLogic';
import { GRAPPLE, GRENADE, WEAPONS } from './Weapons';
import { settings } from '../core/Settings';
import { clamp, damp, wrapAngle } from '../core/MathUtil';
import { Emitter } from '../core/Events';

export interface PlayerEvents extends Record<string, unknown> {
  grenade: { entity: Entity };
  grapple: { entity: Entity; point: THREE.Vector3 | null };
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
  enabled = true;
  /** All entities (for touch aim assist and auto fire); set by the game. */
  entities: () => Entity[] = () => [];
  private autoFireTimer = 0;
  private autoRearm = 0;
  private assistTarget: Entity | null = null;
  private assistAngle = Infinity;

  constructor(
    readonly entity: Entity,
    private input: Input,
    private controller: CharacterController,
    private combat: Combat,
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
    const lookDX = this.enabled ? input.lookDX() : 0;
    const lookDY = this.enabled ? input.lookDY() : 0;
    // Touch helpers: find an enemy near the crosshair for aim assist / auto fire.
    const touch = input.isTouch && this.enabled;
    const assistOn = touch && settings.data.aimAssist;
    if (touch && (settings.data.aimAssist || settings.data.autoFire)) this.findAssistTarget(9);
    else this.assistTarget = null;
    const nearTarget = this.assistTarget !== null && this.assistAngle < THREE.MathUtils.degToRad(4.5);
    // Look
    if (looking || lookDX !== 0 || lookDY !== 0) {
      const w = e.weapon;
      const zoom = w ? THREE.MathUtils.lerp(1, WEAPONS[w.id].adsZoom, e.ads) : 1;
      const touchScale = input.isTouch ? 1.6 : 1;
      // Friction: the camera slows down while the crosshair rests on an enemy.
      const friction = assistOn && nearTarget ? 0.5 : 1;
      const sens = 0.0022 * settings.data.sensitivity * zoom * touchScale * friction;
      e.yaw -= lookDX * sens;
      e.pitch = clamp(e.pitch - lookDY * sens * (settings.data.invertY ? -1 : 1), -1.5, 1.5);
    }
    if (assistOn && this.assistTarget && this.assistAngle < THREE.MathUtils.degToRad(6)) this.magnetism(dt, lookDX !== 0 || lookDY !== 0);
    // Movement input
    const mv: MoveInput = {
      strafe: this.enabled ? input.moveX() : 0,
      forward: this.enabled ? input.moveY() : 0,
      jump: this.enabled && input.jumpPressed(),
      jumpHeld: this.enabled && input.jumpHeld(),
      sprint: this.enabled && input.sprintHeld(),
      crouch: this.enabled && input.crouchHeld(),
    };
    const wasGrounded = e.grounded;
    this.controller.step(e, mv, dt);
    if (!wasGrounded && e.grounded && e.landImpact > 0) {
      this.camDip = Math.max(this.camDip, e.landImpact * 0.25);
      this.viewModel.land(e.landImpact);
      e.landImpact = 0;
    }

    // Weapons
    WeaponLogic.update(e, dt);
    if (this.enabled) {
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
      if (input.grenadePressed() && e.grenades > 0 && e.grenadeCooldown <= 0 && !e.reloading) {
        e.grenades--;
        e.grenadeCooldown = 0.8;
        this.combat.throwGrenade(e, now);
        this.events.emit('grenade', { entity: e });
      }
      if (input.grapplePressed()) this.tryGrapple();
      if (e.grapplePoint && (input.grappleReleased() || input.jumpPressed())) {
        e.grapplePoint = null;
        e.vel.y = Math.max(e.vel.y, 3);
      }
      if (input.interactPressed()) this.events.emit('interact', { entity: e });
    } else {
      e.wantsAds = false;
    }
    this.viewModel.show(e.weapon ? e.weapon.id : null);
    this.viewModel.hidden = !!e.weapon && e.weapon.id === 'sniper' && e.ads > 0.85;

    // Camera
    const speed = Math.sqrt(e.vel.x * e.vel.x + e.vel.z * e.vel.z);
    if (e.grounded && speed > 0.5) this.bobPhase += dt * (6 + speed * 0.9);
    const bob = clamp(speed / 8, 0, 1) * (e.grounded ? 1 : 0) * (1 - e.ads * 0.7);
    this.camDip = damp(this.camDip, 0, 9, dt);
    this.shake = damp(this.shake, 0, 6, dt);
    this.shakeVec.set((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, 0).multiplyScalar(0.06);
    const eye = e.eyePos;
    eye.y += Math.abs(Math.sin(this.bobPhase)) * 0.045 * bob - this.camDip;
    const right = e.right(new THREE.Vector3());
    eye.addScaledVector(right, Math.sin(this.bobPhase) * 0.02 * bob);
    this.camera.position.copy(eye);
    const pitch = clamp(e.pitch + THREE.MathUtils.degToRad(e.recoilPitch) + this.shakeVec.y, -1.55, 1.55);
    const yaw = e.yaw + THREE.MathUtils.degToRad(e.recoilYaw) + this.shakeVec.x;
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(yaw);
    this.camera.rotateX(pitch);
    this.camera.rotateZ(e.sliding ? -0.06 : -this.shakeVec.x * 0.5);
    // FOV
    const w = e.weapon;
    let fovTarget = this.baseFov;
    if (w) fovTarget *= THREE.MathUtils.lerp(1, WEAPONS[w.id].adsZoom, e.ads);
    if (speed > 6.5 && e.ads < 0.2) fovTarget += 4;
    if (e.grapplePoint) fovTarget += 6;
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
      if (o === e || !o.alive) continue;
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
  private magnetism(dt: number, activeLook: boolean): void {
    const e = this.entity;
    const o = this.assistTarget!;
    const speed = Math.hypot(e.vel.x, e.vel.z);
    if (!activeLook && speed < 1 && o.vel.lengthSq() < 0.5) return;
    const eye = e.eyePos;
    const d = new THREE.Vector3(o.pos.x, o.pos.y + o.height * 0.6, o.pos.z).sub(eye);
    const targetYaw = Math.atan2(-d.x, -d.z);
    const targetPitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    const k = Math.min(1, dt * 4) * 0.4;
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

  private tryGrapple(): void {
    const e = this.entity;
    if (e.grappleCooldown > 0 || e.grapplePoint) return;
    const origin = e.eyePos;
    const dir = e.forward(new THREE.Vector3());
    const hit = this.combat.raycast(origin, dir, GRAPPLE.range, e, false);
    if (hit) {
      e.grapplePoint = hit.point.clone();
      e.grappleTime = 0;
      e.grappleCooldown = GRAPPLE.cooldown;
      e.sliding = false;
      this.events.emit('grapple', { entity: e, point: e.grapplePoint });
    } else {
      e.grappleCooldown = 0.4;
      this.events.emit('grapple', { entity: e, point: null });
    }
  }

  get grenadeCount(): number {
    return this.entity.grenades;
  }
  get maxGrenades(): number {
    return GRENADE.maxCount;
  }
}
