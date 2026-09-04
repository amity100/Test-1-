import * as THREE from 'three';
import type { Entity } from './Entities';
import type { Input } from '../core/Input';
import type { CharacterController, MoveInput } from './CharacterController';
import type { Combat } from './Combat';
import type { ViewModel } from '../render/ViewModel';
import { WeaponLogic } from './WeaponLogic';
import { GRAPPLE, GRENADE, WEAPONS } from './Weapons';
import { settings } from '../core/Settings';
import { clamp, damp } from '../core/MathUtil';
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

  addShake(amount: number): void {
    this.shake = Math.min(1, this.shake + amount);
  }

  update(dt: number, now: number): void {
    const e = this.entity;
    const input = this.input;
    this.baseFov = settings.data.fov;
    if (!e.alive) {
      this.rope.visible = false;
      this.viewModel.update(dt, e, 0, 0, 0);
      return;
    }
    const looking = input.looking && this.enabled;
    // Look
    if (looking) {
      const w = e.weapon;
      const zoom = w ? THREE.MathUtils.lerp(1, WEAPONS[w.id].adsZoom, e.ads) : 1;
      const sens = 0.0022 * settings.data.sensitivity * zoom;
      e.yaw -= input.mouseDX * sens;
      e.pitch = clamp(e.pitch - input.mouseDY * sens * (settings.data.invertY ? -1 : 1), -1.5, 1.5);
    }
    // Movement input
    const mv: MoveInput = {
      strafe: this.enabled ? input.axisX() : 0,
      forward: this.enabled ? input.axisY() : 0,
      jump: this.enabled && input.wasPressed('Space'),
      jumpHeld: this.enabled && input.isDown('Space'),
      sprint: this.enabled && (input.isDown('ShiftLeft') || input.isDown('ShiftRight')),
      crouch: this.enabled && (input.isDown('KeyC') || input.isDown('ControlLeft')),
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
      if (input.wasPressed('Digit1')) switchTo = 0;
      if (input.wasPressed('Digit2')) switchTo = 1;
      if (input.wasPressed('Digit3')) switchTo = 2;
      if (input.wheel !== 0 && e.weapons.length > 1) switchTo = (e.weaponIndex + (input.wheel > 0 ? 1 : -1) + e.weapons.length) % e.weapons.length;
      if (switchTo >= 0 && WeaponLogic.switchWeapon(e, switchTo)) this.events.emit('weaponSwitch', { index: switchTo });
      e.wantsAds = input.buttonDown(2) && !e.sliding;
      if (input.wasPressed('KeyR') && WeaponLogic.startReload(e)) this.events.emit('reload', { entity: e });
      if (input.buttonReleased(0)) e.triggerReleased = true;
      if (input.buttonDown(0)) {
        if (WeaponLogic.tryFire(e, this.combat, now)) {
          this.viewModel.kick(e.weapon!.id);
          this.addShake(WEAPONS[e.weapon!.id].kick * 0.6);
        }
      }
      if (input.wasPressed('KeyG') && e.grenades > 0 && e.grenadeCooldown <= 0 && !e.reloading) {
        e.grenades--;
        e.grenadeCooldown = 0.8;
        this.combat.throwGrenade(e, now);
        this.events.emit('grenade', { entity: e });
      }
      if (input.wasPressed('KeyQ')) this.tryGrapple();
      if (e.grapplePoint && (input.wasReleased('KeyQ') || input.wasPressed('Space'))) {
        e.grapplePoint = null;
        e.vel.y = Math.max(e.vel.y, 3);
      }
      if (input.wasPressed('KeyE')) this.events.emit('interact', { entity: e });
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

    this.viewModel.update(dt, e, looking ? input.mouseDX : 0, looking ? input.mouseDY : 0, WeaponLogic.reloadProgress(e));
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
