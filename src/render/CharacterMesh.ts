import * as THREE from 'three';
import type { Entity } from '../sim/Entities';
import { buildWeaponModel, OPERATOR_CAMO } from './WeaponModels';
import type { WeaponId } from '../sim/Weapons';
import { clamp, damp } from '../core/MathUtil';
import { PartBuilder, rbox, lathe, skinnedMeshesFrom } from './PartBuilder';
import { armorMaps, camoMaps, gunmetalMaps, rubberMaps } from './DetailTextures';
import { type MatKey, HIPS, TORSO, HEAD, THIGH_L, SHIN_L, THIGH_R, SHIN_R, REST, ARM_L, ARM_R, partHelpers } from './CharacterRig';
import { buildGear, outfitFor, outfitKey, CAMOS, PLATE_TINT, type Outfit } from './Outfits';

const WEAPON_HOLDER = new THREE.Vector3(0.12, 0.34, -0.1);
const IDENTITY = new THREE.Matrix4();

let bodyGeos: Map<MatKey, THREE.BufferGeometry> | null = null;

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

/** Builds the shared body geometry once: a sculpted operator with plate carrier, pouches, helmet and pads. */
function buildBody(): Map<MatKey, THREE.BufferGeometry> {
  if (bodyGeos) return bodyGeos;
  const pb = new PartBuilder<MatKey>({ uvDensity: 3, skinned: true });
  const { box, rb, sph, cylY, ring, v } = partHelpers(pb);

  // ---------------------------------------------------------------- hips
  pb.bone(HIPS);
  const H = REST.hips;
  sph('fabric', 0.19, H.x, H.y - 0.02, H.z, 1, 0.66, 0.7);
  rb('nylon', 0.39, 0.07, 0.27, 0.02, H.x, H.y + 0.085, H.z);
  box('metal', 0.06, 0.04, 0.012, H.x, H.y + 0.085, H.z - 0.14);
  // Belt pouches: two mag pouches front, dump pouch rear-left, utility right.
  for (const sx of [-1, 1]) {
    rb('nylon', 0.085, 0.12, 0.06, 0.015, H.x + sx * 0.1, H.y - 0.01, H.z - 0.135);
    box('nylon', 0.087, 0.03, 0.062, H.x + sx * 0.1, H.y + 0.05, H.z - 0.135);
  }
  rb('nylon', 0.11, 0.15, 0.09, 0.025, H.x - 0.17, H.y - 0.04, H.z + 0.07);
  rb('pad', 0.06, 0.11, 0.1, 0.015, H.x + 0.19, H.y - 0.03, H.z + 0.04);
  // Groin plate with accent notch.
  rb('armor', 0.15, 0.11, 0.03, 0.02, H.x, H.y - 0.13, H.z - 0.13, 0.25);
  box('accent', 0.06, 0.006, 0.006, H.x, H.y - 0.085, H.z - 0.145);
  // Rear accent light.
  box('accent', 0.05, 0.012, 0.006, H.x, H.y + 0.085, H.z + 0.137);

  // ---------------------------------------------------------------- torso
  pb.bone(TORSO);
  const T = REST.torso;
  // Core body and shoulders.
  const torso = lathe([[0, 0.02], [0.15, 0.025], [0.185, 0.08], [0.2, 0.18], [0.215, 0.3], [0.228, 0.4], [0.222, 0.47], [0.19, 0.53], [0.12, 0.57], [0.07, 0.585], [0, 0.59]], 22);
  pb.part(torso, 'fabric', T.x, T.y, T.z, 0, 0, 0, 1, 1, 0.64);
  torso.dispose();
  sph('fabric', 0.088, T.x - 0.24, T.y + 0.47, T.z);
  sph('fabric', 0.088, T.x + 0.24, T.y + 0.47, T.z);
  // Neck gaiter.
  cylY('nylon', 0.075, 0.12, T.x, T.y + 0.58, T.z, 0.07);
  // Plate carrier: front & back plates, cummerbund, shoulder straps.
  rb('armor', 0.32, 0.34, 0.05, 0.04, T.x, T.y + 0.3, T.z - 0.165);
  rb('armor', 0.32, 0.36, 0.05, 0.04, T.x, T.y + 0.3, T.z + 0.165);
  rb('nylon', 0.07, 0.24, 0.27, 0.02, T.x - 0.215, T.y + 0.24, T.z);
  rb('nylon', 0.07, 0.24, 0.27, 0.02, T.x + 0.215, T.y + 0.24, T.z);
  for (const sx of [-1, 1]) {
    rb('nylon', 0.075, 0.045, 0.32, 0.012, T.x + sx * 0.11, T.y + 0.54, T.z);
    // Pauldron with accent stripe.
    rb('armor', 0.14, 0.12, 0.22, 0.045, T.x + sx * 0.3, T.y + 0.5, T.z, 0, 0, -sx * 0.4);
    box('accent', 0.13, 0.008, 0.06, T.x + sx * 0.305, T.y + 0.535, T.z - 0.06, 0, 0, -sx * 0.4);
    box('accent', 0.13, 0.008, 0.06, T.x + sx * 0.305, T.y + 0.535, T.z + 0.06, 0, 0, -sx * 0.4);
  }
  // Chest rig: three mag pouches with flaps, admin pouch, radio with antenna.
  for (let i = -1; i <= 1; i++) {
    rb('nylon', 0.08, 0.14, 0.055, 0.012, T.x + i * 0.095, T.y + 0.2, T.z - 0.215);
    box('nylon', 0.082, 0.035, 0.058, T.x + i * 0.095, T.y + 0.275, T.z - 0.215);
    box('accent', 0.03, 0.006, 0.006, T.x + i * 0.095, T.y + 0.13, T.z - 0.245);
  }
  rb('nylon', 0.2, 0.07, 0.035, 0.012, T.x, T.y + 0.41, T.z - 0.2);
  rb('pad', 0.05, 0.11, 0.045, 0.01, T.x - 0.165, T.y + 0.36, T.z - 0.185);
  cylY('metal', 0.004, 0.16, T.x - 0.165, T.y + 0.5, T.z - 0.185, 0.003);
  box('accent', 0.02, 0.006, 0.006, T.x - 0.165, T.y + 0.395, T.z - 0.21);
  // Collar guard.
  rb('armor', 0.28, 0.06, 0.22, 0.02, T.x, T.y + 0.56, T.z + 0.03);
  // Backpack with top handle, straps and status light.
  rb('nylon', 0.32, 0.36, 0.15, 0.045, T.x, T.y + 0.26, T.z + 0.26);
  rb('nylon', 0.1, 0.03, 0.05, 0.01, T.x, T.y + 0.45, T.z + 0.26);
  rb('pad', 0.3, 0.1, 0.04, 0.015, T.x, T.y + 0.14, T.z + 0.345);
  box('accent', 0.14, 0.014, 0.006, T.x, T.y + 0.36, T.z + 0.338);
  // Arms: upper arm, elbow pad, forearm, glove (rigid with the torso, posed around the weapon).
  const arm = (shoulder: THREE.Vector3, elbow: THREE.Vector3, wrist: THREE.Vector3, basisX: THREE.Vector3, basisY: THREE.Vector3, basisZ: THREE.Vector3): void => {
    pb.capsule('fabric', shoulder, elbow, 0.068, undefined, 12);
    sph('pad', 0.075, elbow.x, elbow.y, elbow.z, 1, 1.15, 1);
    pb.capsule('fabric', elbow, wrist, 0.056, undefined, 12);
    // Glove: palm block and curled fingers in the given basis.
    const m = new THREE.Matrix4().makeBasis(basisX, basisY, basisZ);
    const palm = rbox(0.085, 0.045, 0.1, 0.018, 2);
    const mp = m.clone().setPosition(wrist.clone().addScaledVector(basisZ, 0.05));
    pb.partM(palm, 'pad', mp);
    palm.dispose();
    const fingers = rbox(0.083, 0.04, 0.055, 0.016, 2);
    const rot = new THREE.Matrix4().makeRotationAxis(basisX, 1.0);
    const mf = m.clone().premultiply(rot).setPosition(wrist.clone().addScaledVector(basisZ, 0.105).addScaledVector(basisY, -0.02));
    pb.partM(fingers, 'pad', mf);
    fingers.dispose();
    // Wrist strap.
    pb.capsule('nylon', wrist.clone().addScaledVector(basisZ, -0.01), wrist.clone().addScaledVector(basisZ, 0.01), 0.06, undefined, 12);
  };
  arm(ARM_R.shoulder, ARM_R.elbow, ARM_R.wrist, v(0, 1, 0), v(1, 0, 0), v(-0.2, 0.05, -1).normalize());
  arm(ARM_L.shoulder, ARM_L.elbow, ARM_L.wrist, v(0, 0, -1), v(0, -1, 0), v(1, 0, 0));

  // ---------------------------------------------------------------- head
  pb.bone(HEAD);
  const D = REST.head;
  // Balaclava head; helmets, masks and visors are outfit gear (see Outfits.ts).
  sph('nylon', 0.1, D.x, D.y + 0.12, D.z, 1, 1.12, 1.05);

  // ---------------------------------------------------------------- legs
  for (const [thighBone, shinBone, TH, SH, sx] of [
    [THIGH_L, SHIN_L, REST.thighL, REST.shinL, -1],
    [THIGH_R, SHIN_R, REST.thighR, REST.shinR, 1],
  ] as [number, number, THREE.Vector3, THREE.Vector3, number][]) {
    pb.bone(thighBone);
    pb.capsule('fabric', v(TH.x, TH.y + 0.04, TH.z), v(TH.x, TH.y - 0.38, TH.z), 0.095, undefined, 14);
    // Cargo pocket on the outer thigh, straps.
    rb('nylon', 0.05, 0.13, 0.11, 0.015, TH.x + sx * 0.085, TH.y - 0.2, TH.z + 0.01);
    ring('nylon', 0.098, 0.011, TH.x, TH.y - 0.1, TH.z);
    ring('nylon', 0.092, 0.011, TH.x, TH.y - 0.3, TH.z);
    if (sx > 0) {
      // Drop-leg holster.
      rb('pad', 0.055, 0.2, 0.09, 0.015, TH.x + 0.1, TH.y - 0.2, TH.z - 0.03, 0.1);
      box('accent', 0.006, 0.05, 0.006, TH.x + 0.13, TH.y - 0.16, TH.z - 0.03);
    } else {
      // Dump pouch / med kit.
      rb('nylon', 0.07, 0.12, 0.1, 0.02, TH.x - 0.1, TH.y - 0.18, TH.z + 0.02);
      box('accent', 0.03, 0.006, 0.03, TH.x - 0.138, TH.y - 0.18, TH.z + 0.02);
    }
    pb.bone(shinBone);
    pb.capsule('fabric', v(SH.x, SH.y - 0.01, SH.z), v(SH.x, SH.y - 0.36, SH.z), 0.078, undefined, 14);
    // Knee pad with accent line.
    rb('armor', 0.15, 0.14, 0.1, 0.045, SH.x, SH.y - 0.005, SH.z - 0.07, 0.15);
    box('accent', 0.1, 0.008, 0.006, SH.x, SH.y + 0.03, SH.z - 0.118, 0.15);
    // Boot: upper, toe, sole, gaiter and straps.
    rb('pad', 0.15, 0.17, 0.2, 0.045, SH.x, SH.y - 0.35, SH.z - 0.02);
    rb('pad', 0.14, 0.1, 0.13, 0.04, SH.x, SH.y - 0.385, SH.z - 0.15);
    rb('nylon', 0.165, 0.03, 0.33, 0.01, SH.x, SH.y - 0.437, SH.z - 0.06, 0, 0, 0, 1);
    rb('fabric', 0.165, 0.06, 0.2, 0.02, SH.x, SH.y - 0.275, SH.z - 0.02);
    box('nylon', 0.155, 0.02, 0.205, SH.x, SH.y - 0.3, SH.z - 0.02);
    for (let i = 0; i < 3; i++) box('nylon', 0.06, 0.008, 0.008, SH.x, SH.y - 0.31 - i * 0.03, SH.z - 0.118 - i * 0.012);
  }

  bodyGeos = pb.merge();
  return bodyGeos;
}

/** Procedural armoured operator with skinned body, team accents and procedural animation. */
export class CharacterMesh {
  readonly root = new THREE.Group();
  private hips = new THREE.Bone();
  private torso = new THREE.Bone();
  private head = new THREE.Bone();
  private thighL = new THREE.Bone();
  private thighR = new THREE.Bone();
  private shinL = new THREE.Bone();
  private shinR = new THREE.Bone();
  private skeleton: THREE.Skeleton;
  private meshes: THREE.SkinnedMesh[];
  private gearMeshes: THREE.SkinnedMesh[] = [];
  private outfitId = '';
  private weaponHolder = new THREE.Group();
  private weaponModel: THREE.Group | null = null;
  private weaponId: WeaponId | null = null;
  private mats: Record<MatKey, THREE.MeshStandardMaterial>;
  private flashMats: THREE.MeshStandardMaterial[];
  private opacityMats: THREE.MeshStandardMaterial[];
  private tag: THREE.Sprite;
  private flashTimer = 0;
  private deathT = 0;
  private crouchAmt = 0;
  visible = true;

  constructor(readonly accent: THREE.Color, name: string, tagColor: string) {
    const am = armorMaps();
    const gm = gunmetalMaps();
    const rm = rubberMaps();
    const camo = camoMaps('operator', OPERATOR_CAMO);
    const plateTint = new THREE.Color(0x3a3f47).lerp(accent, 0.36);
    this.mats = {
      fabric: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: camo.map, normalMap: camo.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: camo.roughnessMap }),
      armor: new THREE.MeshStandardMaterial({ color: plateTint, roughness: 1, metalness: 0.45, map: am.map, normalMap: am.normalMap, normalScale: new THREE.Vector2(0.55, 0.55), roughnessMap: am.roughnessMap }),
      nylon: new THREE.MeshStandardMaterial({ color: 0x2c2f2c, roughness: 1, metalness: 0, map: rm.map, normalMap: rm.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: rm.roughnessMap }),
      pad: new THREE.MeshStandardMaterial({ color: 0x191b1f, roughness: 1, metalness: 0.2, map: am.map, normalMap: am.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: am.roughnessMap }),
      metal: new THREE.MeshStandardMaterial({ color: 0x5c626c, roughness: 1, metalness: 0.9, map: gm.map, normalMap: gm.normalMap, roughnessMap: gm.roughnessMap }),
      accent: new THREE.MeshStandardMaterial({ color: accent.clone().multiplyScalar(0.5), emissive: accent, emissiveIntensity: 1.8, roughness: 0.4, metalness: 0.3 }),
      visor: new THREE.MeshStandardMaterial({ color: 0x0a0f18, emissive: accent, emissiveIntensity: 2.4, roughness: 0.12, metalness: 0.7 }),
      lens: new THREE.MeshStandardMaterial({ color: 0x0a1624, metalness: 1, roughness: 0.05 }),
      warn: new THREE.MeshStandardMaterial({ color: 0x3a0008, emissive: 0xff2030, emissiveIntensity: 2.2, roughness: 0.4, metalness: 0.2 }),
    };
    this.flashMats = [this.mats.fabric, this.mats.armor, this.mats.nylon, this.mats.pad];
    this.opacityMats = Object.values(this.mats);

    // Skeleton in rest pose.
    this.hips.position.copy(REST.hips);
    this.torso.position.copy(REST.torso).sub(REST.hips);
    this.head.position.copy(REST.head).sub(REST.torso);
    this.thighL.position.copy(REST.thighL).sub(REST.hips);
    this.shinL.position.copy(REST.shinL).sub(REST.thighL);
    this.thighR.position.copy(REST.thighR).sub(REST.hips);
    this.shinR.position.copy(REST.shinR).sub(REST.thighR);
    this.root.add(this.hips);
    this.hips.add(this.torso, this.thighL, this.thighR);
    this.torso.add(this.head, this.weaponHolder);
    this.thighL.add(this.shinL);
    this.thighR.add(this.shinR);
    this.weaponHolder.position.copy(WEAPON_HOLDER);
    this.weaponHolder.rotation.y = -0.15;
    this.root.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton([this.hips, this.torso, this.head, this.thighL, this.shinL, this.thighR, this.shinR]);
    this.meshes = skinnedMeshesFrom(buildBody(), this.root, this.skeleton, (k) => this.mats[k]);
    this.setOutfit(outfitFor(['zipline', 'breach'], 0));

    // Name tag
    const spriteMat = new THREE.SpriteMaterial({ map: nameTexture(name, tagColor), transparent: true, depthTest: true, depthWrite: false });
    this.tag = new THREE.Sprite(spriteMat);
    this.tag.scale.set(1.6, 0.4, 1);
    this.tag.position.y = 2.25;
    this.root.add(this.tag);
    this.root.name = `char-${name}`;
  }

  /** Swaps head gear, gadget equipment and camo palette. Gear geometry is cached per outfit key. */
  setOutfit(o: Outfit): void {
    const id = `${outfitKey(o)}|${o.camo}`;
    if (id === this.outfitId) return;
    this.outfitId = id;
    const camo = camoMaps(o.camo, CAMOS[o.camo]);
    const f = this.mats.fabric;
    f.map = camo.map;
    f.normalMap = camo.normalMap;
    f.roughnessMap = camo.roughnessMap;
    f.needsUpdate = true;
    this.mats.armor.color.set(PLATE_TINT[o.camo]).lerp(this.accent, 0.3);
    for (const m of this.gearMeshes) this.root.remove(m);
    this.gearMeshes = skinnedMeshesFrom(buildGear(o), this.root, this.skeleton, (k) => this.mats[k], true, IDENTITY);
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
      this.weaponModel.position.set(0, -0.02, 0.03);
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
      this.hips.position.y = REST.hips.y - fall * 0.55;
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
    this.hips.position.y = REST.hips.y - this.crouchAmt * 0.45 - (e.sliding ? 0.15 : 0) + (moving && e.grounded ? Math.abs(Math.sin(e.animPhase * 2)) * 0.03 : 0);
    this.hips.rotation.x = e.sliding ? 0.5 : 0;
    // Subtle hip sway while running.
    this.hips.rotation.y = moving ? Math.sin(e.animPhase) * 0.06 * amp : 0;

    // Torso & head follow aim; counter-rotate torso against hip sway.
    const aim = clamp(e.pitch, -1.2, 1.2);
    this.torso.rotation.x = -aim * 0.45 + this.crouchAmt * 0.15;
    this.torso.rotation.y = -this.hips.rotation.y * 1.4;
    this.head.rotation.x = -aim * 0.4;
    // Lean into strafing.
    const localVx = e.vel.x * Math.cos(e.yaw) - e.vel.z * Math.sin(e.yaw);
    this.torso.rotation.z = damp(this.torso.rotation.z, -clamp(localVx / 8, -1, 1) * 0.12, 8, dt);
    this.weaponHolder.rotation.x = -aim * 0.55;

    // Hit flash
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const k = Math.max(0, this.flashTimer / 0.12);
      for (const m of this.flashMats) m.emissive.setRGB(k * 0.9, k * 0.9, k * 0.9);
    } else if (this.mats.fabric.emissive.r > 0) {
      for (const m of this.flashMats) m.emissive.setRGB(0, 0, 0);
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
    // Body and weapon geometry are shared caches; only per-character resources are released.
    for (const m of this.opacityMats) m.dispose();
    (this.tag.material as THREE.SpriteMaterial).map?.dispose();
    (this.tag.material as THREE.SpriteMaterial).dispose();
    this.skeleton.dispose();
    for (const m of this.meshes) this.root.remove(m);
    for (const m of this.gearMeshes) this.root.remove(m);
  }
}
