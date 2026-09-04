import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Entity } from '../sim/Entities';
import { buildWeaponModel } from './WeaponModels';
import type { WeaponId } from '../sim/Weapons';
import { clamp, damp } from '../core/MathUtil';

function nameTexture(name: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.font = 'bold 62px Rubik, Heebo, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(name, 256, 64);
  ctx.fillStyle = color;
  ctx.fillText(name, 256, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Procedural armoured trooper with simple procedural animation. */
export class CharacterMesh {
  readonly root = new THREE.Group();
  private hips = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private thighL = new THREE.Group();
  private thighR = new THREE.Group();
  private shinL = new THREE.Group();
  private shinR = new THREE.Group();
  private weaponHolder = new THREE.Group();
  private weaponModel: THREE.Group | null = null;
  private weaponId: WeaponId | null = null;
  private baseMat: THREE.MeshStandardMaterial;
  private jointMat: THREE.MeshStandardMaterial;
  private accentMat: THREE.MeshStandardMaterial;
  private visorMat: THREE.MeshStandardMaterial;
  private tag: THREE.Sprite;
  private flashTimer = 0;
  private deathT = 0;
  private crouchAmt = 0;
  private opacityMats: THREE.MeshStandardMaterial[];
  visible = true;

  constructor(readonly accent: THREE.Color, name: string, tagColor: string) {
    this.baseMat = new THREE.MeshStandardMaterial({ color: 0x3b414b, metalness: 0.55, roughness: 0.42 });
    this.jointMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, metalness: 0.3, roughness: 0.7 });
    this.accentMat = new THREE.MeshStandardMaterial({ color: accent.clone().multiplyScalar(0.5), emissive: accent, emissiveIntensity: 1.6, roughness: 0.4, metalness: 0.3 });
    this.visorMat = new THREE.MeshStandardMaterial({ color: 0x0a0f18, emissive: accent, emissiveIntensity: 2.2, roughness: 0.15, metalness: 0.6 });
    this.opacityMats = [this.baseMat, this.jointMat, this.accentMat, this.visorMat];

    const rb = (w: number, h: number, d: number, mat: THREE.Material, r = 0.03): THREE.Mesh => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    // Hips at y ~0.95 when standing.
    this.hips.position.y = 0.95;
    this.root.add(this.hips);
    const pelvis = rb(0.4, 0.22, 0.26, this.jointMat);
    pelvis.position.y = 0.0;
    this.hips.add(pelvis);
    const belt = rb(0.42, 0.05, 0.28, this.accentMat, 0.01);
    belt.position.y = 0.1;
    this.hips.add(belt);

    // Torso pivot at hips top.
    this.torso.position.y = 0.11;
    this.hips.add(this.torso);
    const chest = rb(0.5, 0.5, 0.3, this.baseMat, 0.05);
    chest.position.y = 0.28;
    this.torso.add(chest);
    const chestPlate = rb(0.36, 0.26, 0.06, this.accentMat, 0.02);
    chestPlate.position.set(0, 0.3, -0.17);
    this.torso.add(chestPlate);
    const backpack = rb(0.34, 0.36, 0.14, this.jointMat, 0.03);
    backpack.position.set(0, 0.26, 0.2);
    this.torso.add(backpack);
    for (const sx of [-1, 1]) {
      const shoulder = rb(0.2, 0.16, 0.24, this.baseMat, 0.04);
      shoulder.position.set(sx * 0.33, 0.5, 0);
      this.torso.add(shoulder);
      const stripe = rb(0.21, 0.03, 0.25, this.accentMat, 0.01);
      stripe.position.set(sx * 0.33, 0.56, 0);
      this.torso.add(stripe);
    }
    // Head
    this.head.position.y = 0.62;
    this.torso.add(this.head);
    const helmet = rb(0.3, 0.3, 0.32, this.baseMat, 0.06);
    helmet.position.y = 0.16;
    this.head.add(helmet);
    const visor = rb(0.22, 0.08, 0.04, this.visorMat, 0.01);
    visor.position.set(0, 0.16, -0.16);
    this.head.add(visor);
    const crest = rb(0.06, 0.08, 0.26, this.accentMat, 0.01);
    crest.position.set(0, 0.33, 0);
    this.head.add(crest);

    // Arms: posed to hold the weapon in front.
    const armBetween = (a: THREE.Vector3, b: THREE.Vector3, thick: number, mat: THREE.Material): THREE.Mesh => {
      const len = a.distanceTo(b);
      const mesh = rb(thick, len, thick, mat, 0.03);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      return mesh;
    };
    const shoulderR = new THREE.Vector3(0.3, 0.5, 0);
    const elbowR = new THREE.Vector3(0.28, 0.22, -0.14);
    const gripR = new THREE.Vector3(0.12, 0.3, -0.34);
    const shoulderL = new THREE.Vector3(-0.3, 0.5, 0);
    const elbowL = new THREE.Vector3(-0.22, 0.28, -0.3);
    const gripL = new THREE.Vector3(0.05, 0.36, -0.58);
    this.torso.add(armBetween(shoulderR, elbowR, 0.13, this.baseMat));
    this.torso.add(armBetween(elbowR, gripR, 0.11, this.jointMat));
    this.torso.add(armBetween(shoulderL, elbowL, 0.13, this.baseMat));
    this.torso.add(armBetween(elbowL, gripL, 0.11, this.jointMat));
    this.weaponHolder.position.set(0.12, 0.36, -0.36);
    this.torso.add(this.weaponHolder);

    // Legs
    const legPart = (mat: THREE.Material, w: number, len: number): THREE.Mesh => {
      const m = rb(w, len, w, mat, 0.04);
      m.position.y = -len / 2;
      return m;
    };
    for (const [thigh, shin, sx] of [
      [this.thighL, this.shinL, -1],
      [this.thighR, this.shinR, 1],
    ] as [THREE.Group, THREE.Group, number][]) {
      thigh.position.set(sx * 0.13, -0.08, 0);
      this.hips.add(thigh);
      thigh.add(legPart(this.baseMat, 0.17, 0.42));
      shin.position.y = -0.42;
      thigh.add(shin);
      shin.add(legPart(this.jointMat, 0.14, 0.42));
      const boot = rb(0.16, 0.1, 0.26, this.baseMat, 0.03);
      boot.position.set(0, -0.42, -0.04);
      shin.add(boot);
      const kneeStripe = rb(0.15, 0.03, 0.15, this.accentMat, 0.01);
      kneeStripe.position.y = -0.02;
      shin.add(kneeStripe);
    }

    // Name tag
    const spriteMat = new THREE.SpriteMaterial({ map: nameTexture(name, tagColor), transparent: true, depthTest: true, depthWrite: false });
    this.tag = new THREE.Sprite(spriteMat);
    this.tag.scale.set(1.6, 0.4, 1);
    this.tag.position.y = 2.25;
    this.root.add(this.tag);
    this.root.name = `char-${name}`;
  }

  setWeapon(id: WeaponId | null): void {
    if (id === this.weaponId) return;
    this.weaponId = id;
    if (this.weaponModel) {
      this.weaponHolder.remove(this.weaponModel);
      this.weaponModel = null;
    }
    if (id) {
      this.weaponModel = buildWeaponModel(id, this.accent, false);
      this.weaponModel.scale.setScalar(0.9);
      this.weaponModel.position.set(0, -0.02, 0.05);
      this.weaponHolder.add(this.weaponModel);
    }
  }

  hitFlash(): void {
    this.flashTimer = 0.12;
  }

  /** World-space muzzle position for third-person shots. */
  getMuzzle(out: THREE.Vector3): THREE.Vector3 {
    if (this.weaponModel) {
      const mz = this.weaponModel.userData.muzzle as THREE.Vector3;
      return this.weaponModel.localToWorld(out.copy(mz));
    }
    return this.weaponHolder.getWorldPosition(out);
  }

  update(dt: number, e: Entity, camPos: THREE.Vector3, now: number): void {
    const root = this.root;
    root.position.copy(e.pos);
    root.rotation.set(0, e.yaw, 0);
    root.visible = this.visible && (e.alive || now - e.deadSince < 2.6);
    if (!root.visible) return;

    // Death animation: fall backwards and fade.
    if (!e.alive) {
      this.deathT = Math.min(1, (now - e.deadSince) / 0.6);
      const fall = this.deathT * this.deathT;
      this.hips.rotation.x = -fall * Math.PI * 0.5 * 0.9;
      this.hips.position.y = 0.95 - fall * 0.55;
      const fade = clamp(1 - (now - e.deadSince - 1.6) / 1.0, 0, 1);
      for (const m of this.opacityMats) {
        m.transparent = fade < 1;
        m.opacity = fade;
      }
      this.tag.visible = false;
      return;
    }
    if (this.deathT > 0) {
      this.deathT = 0;
      for (const m of this.opacityMats) {
        m.transparent = false;
        m.opacity = 1;
      }
    }

    const speed = Math.sqrt(e.vel.x * e.vel.x + e.vel.z * e.vel.z);
    e.speedSmoothed = damp(e.speedSmoothed, speed, 10, dt);
    const moving = e.speedSmoothed > 0.4;
    if (moving && e.grounded) e.animPhase += dt * (4.5 + e.speedSmoothed * 1.6);
    const crouchTarget = e.crouching || e.sliding ? 1 : 0;
    this.crouchAmt = damp(this.crouchAmt, crouchTarget, 12, dt);

    // Legs
    const amp = clamp(e.speedSmoothed / 6, 0, 1) * 0.75;
    let swing = Math.sin(e.animPhase) * amp;
    if (!e.grounded && !e.grapplePoint) swing = 0;
    const airborne = !e.grounded ? 1 : 0;
    const legBend = this.crouchAmt * 1.1 + airborne * 0.5;
    this.thighL.rotation.x = swing - legBend * 0.9 - (e.sliding ? 0.9 : 0);
    this.thighR.rotation.x = -swing - legBend * 0.9 - (e.sliding ? 0.6 : 0);
    this.shinL.rotation.x = Math.max(0, -swing) * 0.8 + legBend * 1.3;
    this.shinR.rotation.x = Math.max(0, swing) * 0.8 + legBend * 1.3;
    this.hips.position.y = 0.95 - this.crouchAmt * 0.45 - (e.sliding ? 0.15 : 0) + (moving && e.grounded ? Math.abs(Math.sin(e.animPhase * 2)) * 0.03 : 0);
    this.hips.rotation.x = e.sliding ? 0.5 : 0;

    // Torso & head follow aim.
    const aim = clamp(e.pitch, -1.2, 1.2);
    this.torso.rotation.x = -aim * 0.45 + this.crouchAmt * 0.15;
    this.head.rotation.x = -aim * 0.4;
    // Lean into strafing.
    const localVx = e.vel.x * Math.cos(e.yaw) - e.vel.z * Math.sin(e.yaw);
    this.torso.rotation.z = damp(this.torso.rotation.z, -clamp(localVx / 8, -1, 1) * 0.12, 8, dt);
    this.weaponHolder.rotation.x = -aim * 0.55;

    // Hit flash
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const k = Math.max(0, this.flashTimer / 0.12);
      this.baseMat.emissive.setRGB(k * 0.9, k * 0.9, k * 0.9);
      this.jointMat.emissive.setRGB(k * 0.6, k * 0.6, k * 0.6);
    } else if (this.baseMat.emissive.r > 0) {
      this.baseMat.emissive.setRGB(0, 0, 0);
      this.jointMat.emissive.setRGB(0, 0, 0);
    }

    // Name tag: scale with distance, hide when far.
    const dist = camPos.distanceTo(e.pos);
    this.tag.visible = dist < 45;
    const s = clamp(dist * 0.06, 0.9, 2.6);
    this.tag.scale.set(s * 1.6, s * 0.4, 1);
    this.tag.position.y = 2.25 - this.crouchAmt * 0.4;
    (this.tag.material as THREE.SpriteMaterial).opacity = clamp(1 - (dist - 30) / 15, 0.2, 1);
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.opacityMats) m.dispose();
    (this.tag.material as THREE.SpriteMaterial).map?.dispose();
    (this.tag.material as THREE.SpriteMaterial).dispose();
  }
}
