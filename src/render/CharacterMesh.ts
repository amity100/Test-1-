import * as THREE from 'three';
import type { Entity } from '../sim/Entities';
import { buildWeaponModel } from './WeaponModels';
import type { WeaponId } from '../sim/Weapons';
import { clamp, damp } from '../core/MathUtil';
import { PartBuilder, PRIM, rbox, lathe, skinnedMeshesFrom } from './PartBuilder';
import { fabricMaps, gunmetalMaps, leatherMaps, mailMaps, quiltMaps, rubberMaps, steelMaps, woodMaps } from './DetailTextures';
import { type MatKey, HIPS, TORSO, HEAD, THIGH_L, SHIN_L, THIGH_R, SHIN_R, REST, ARM_L, ARM_R, HALF_PI, partHelpers } from './CharacterRig';
import { buildGear, outfitFor, outfitKey, CLOTHS, SKIN_TONES, type Outfit } from './Outfits';

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

/**
 * Builds the shared body geometry once: a soldier of the siege era in a quilted gambeson, mail coif
 * and collar, breast and back plates under a team-coloured tabard, fauld, sword belt, leather gloves
 * and boots, knee cops. Helmets, kit gear and the heraldic device are outfit gear (see Outfits.ts).
 */
function buildBody(): Map<MatKey, THREE.BufferGeometry> {
  if (bodyGeos) return bodyGeos;
  const pb = new PartBuilder<MatKey>({ uvDensity: 3, skinned: true });
  const { box, rb, sph, cylY, ring, v } = partHelpers(pb);

  // ---------------------------------------------------------------- hips
  pb.bone(HIPS);
  const H = REST.hips;
  sph('cloth', 0.19, H.x, H.y - 0.02, H.z, 1, 0.66, 0.7);
  // Gambeson skirt flaring to mid-thigh, split at the sides by the belt pouches.
  const skirt = lathe([[0.17, 0.06], [0.2, 0.0], [0.23, -0.12], [0.25, -0.22], [0.24, -0.24], [0.2, -0.23], [0.19, -0.12], [0.17, 0.0]], 22);
  pb.part(skirt, 'cloth', H.x, H.y, H.z, 0, 0, 0, 1, 1, 0.76);
  skirt.dispose();
  // Leather belt with an iron buckle; a pouch on the right, a dagger on the left.
  ring('leather', 0.2, 0.024, H.x, H.y + 0.085, H.z, 0.72);
  box('iron', 0.05, 0.04, 0.012, H.x, H.y + 0.085, H.z - 0.145);
  rb('leather', 0.09, 0.1, 0.06, 0.015, H.x + 0.14, H.y - 0.01, H.z - 0.12);
  box('leather', 0.09, 0.02, 0.062, H.x + 0.14, H.y + 0.04, H.z - 0.12);
  box('leather', 0.03, 0.22, 0.03, H.x - 0.16, H.y - 0.08, H.z - 0.09, 0.15, 0, 0.2);
  box('iron', 0.09, 0.016, 0.016, H.x - 0.16, H.y + 0.04, H.z - 0.1, 0, 0, 0.2);
  sph('iron', 0.018, H.x - 0.17, H.y + 0.09, H.z - 0.1);

  // ---------------------------------------------------------------- torso
  pb.bone(TORSO);
  const T = REST.torso;
  // Padded body and shoulders.
  const torso = lathe([[0, 0.02], [0.15, 0.025], [0.185, 0.08], [0.2, 0.18], [0.215, 0.3], [0.228, 0.4], [0.222, 0.47], [0.19, 0.53], [0.12, 0.57], [0.07, 0.585], [0, 0.59]], 22);
  pb.part(torso, 'cloth', T.x, T.y, T.z, 0, 0, 0, 1, 1, 0.64);
  torso.dispose();
  sph('cloth', 0.088, T.x - 0.24, T.y + 0.47, T.z);
  sph('cloth', 0.088, T.x + 0.24, T.y + 0.47, T.z);
  // Mail collar (standard) at the neck.
  ring('mail', 0.1, 0.038, T.x, T.y + 0.575, T.z + 0.01, 0.9);
  cylY('mail', 0.08, 0.1, T.x, T.y + 0.6, T.z, 0.075);
  // Breast and back plates, fauld of two lames below them.
  rb('steel', 0.3, 0.34, 0.06, 0.05, T.x, T.y + 0.3, T.z - 0.16);
  rb('steel', 0.3, 0.36, 0.05, 0.05, T.x, T.y + 0.3, T.z + 0.165);
  ring('steel', 0.22, 0.022, T.x, T.y + 0.09, T.z, 0.74);
  ring('steel', 0.235, 0.022, T.x, T.y + 0.045, T.z, 0.74);
  // Small shoulder plates with a rivet.
  for (const sx of [-1, 1]) {
    rb('steel', 0.14, 0.09, 0.2, 0.045, T.x + sx * 0.29, T.y + 0.51, T.z, 0, 0, -sx * 0.4);
    sph('iron', 0.012, T.x + sx * 0.3, T.y + 0.56, T.z, 1, 1, 1);
  }
  // Tabard: team-coloured panels over the plates, front and back, hanging to the belt.
  rb('tabard', 0.26, 0.44, 0.02, 0.01, T.x, T.y + 0.25, T.z - 0.2);
  rb('tabard', 0.26, 0.44, 0.02, 0.01, T.x, T.y + 0.25, T.z + 0.2);
  box('tabard', 0.26, 0.05, 0.4, T.x, T.y + 0.47, T.z);
  // Sword belt across the chest.
  pb.between(PRIM.box, 'leather', v(T.x - 0.18, T.y + 0.5, T.z - 0.19), v(T.x + 0.17, T.y + 0.04, T.z - 0.215), 0.045);
  box('iron', 0.04, 0.04, 0.012, T.x + 0.02, T.y + 0.3, T.z - 0.225);
  // Arms: gambeson sleeve, elbow cop, forearm, leather glove (rigid with the torso, posed around the weapon).
  const arm = (shoulder: THREE.Vector3, elbow: THREE.Vector3, wrist: THREE.Vector3, basisX: THREE.Vector3, basisY: THREE.Vector3, basisZ: THREE.Vector3): void => {
    pb.capsule('cloth', shoulder, elbow, 0.07, undefined, 12);
    sph('steel', 0.07, elbow.x, elbow.y, elbow.z, 1, 1.1, 1);
    pb.capsule('cloth', elbow, wrist, 0.058, undefined, 12);
    const m = new THREE.Matrix4().makeBasis(basisX, basisY, basisZ);
    const palm = rbox(0.085, 0.045, 0.1, 0.018, 2);
    const mp = m.clone().setPosition(wrist.clone().addScaledVector(basisZ, 0.05));
    pb.partM(palm, 'leather', mp);
    palm.dispose();
    const fingers = rbox(0.083, 0.04, 0.055, 0.016, 2);
    const rot = new THREE.Matrix4().makeRotationAxis(basisX, 1.0);
    const mf = m.clone().premultiply(rot).setPosition(wrist.clone().addScaledVector(basisZ, 0.105).addScaledVector(basisY, -0.02));
    pb.partM(fingers, 'leather', mf);
    fingers.dispose();
    // Glove cuff.
    pb.capsule('leather', wrist.clone().addScaledVector(basisZ, -0.02), wrist.clone().addScaledVector(basisZ, 0.015), 0.063, undefined, 12);
  };
  arm(ARM_R.shoulder, ARM_R.elbow, ARM_R.wrist, v(0, 1, 0), v(1, 0, 0), v(-0.2, 0.05, -1).normalize());
  arm(ARM_L.shoulder, ARM_L.elbow, ARM_L.wrist, v(0, 0, -1), v(0, -1, 0), v(1, 0, 0));

  // ---------------------------------------------------------------- head
  pb.bone(HEAD);
  const D = REST.head;
  sph('skin', 0.1, D.x, D.y + 0.12, D.z, 1, 1.12, 1.05);
  // Mail coif: sides and back, the crown, and under the chin, leaving the face open (the face is at -Z, phi 1.5π).
  const coif = (phi0: number, phiLen: number, th0: number, thLen: number): void => {
    const g = new THREE.SphereGeometry(0.108, 20, 8, Math.PI * phi0, Math.PI * phiLen, Math.PI * th0, Math.PI * thLen);
    pb.part(g, 'mail', D.x, D.y + 0.125, D.z + 0.005, 0, 0, 0, 1, 1.04, 1.02);
    g.dispose();
  };
  coif(1.8, 1.4, 0, 1);
  coif(0, 2, 0, 0.34);
  coif(0, 2, 0.64, 0.36);
  // Brow and nose so the face reads under the helmets.
  box('skin', 0.07, 0.012, 0.02, D.x, D.y + 0.17, D.z - 0.098);
  box('skin', 0.02, 0.05, 0.018, D.x, D.y + 0.12, D.z - 0.108, -0.2);

  // ---------------------------------------------------------------- legs
  for (const [thighBone, shinBone, TH, SH, sx] of [
    [THIGH_L, SHIN_L, REST.thighL, REST.shinL, -1],
    [THIGH_R, SHIN_R, REST.thighR, REST.shinR, 1],
  ] as [number, number, THREE.Vector3, THREE.Vector3, number][]) {
    pb.bone(thighBone);
    // Padded chausses with leather straps.
    pb.capsule('cloth', v(TH.x, TH.y + 0.04, TH.z), v(TH.x, TH.y - 0.38, TH.z), 0.095, undefined, 14);
    ring('leather', 0.098, 0.011, TH.x, TH.y - 0.1, TH.z);
    ring('leather', 0.092, 0.011, TH.x, TH.y - 0.3, TH.z);
    if (sx > 0) rb('leather', 0.06, 0.16, 0.09, 0.015, TH.x + 0.1, TH.y - 0.18, TH.z - 0.02, 0.1); // knife sheath
    pb.bone(shinBone);
    // Knee cop, then a tall leather boot with straps and a hard sole.
    sph('steel', 0.075, SH.x, SH.y - 0.005, SH.z - 0.055, 1, 1.05, 0.9);
    pb.capsule('leather', v(SH.x, SH.y - 0.03, SH.z), v(SH.x, SH.y - 0.36, SH.z), 0.078, undefined, 14);
    rb('leather', 0.15, 0.17, 0.2, 0.045, SH.x, SH.y - 0.35, SH.z - 0.02);
    rb('leather', 0.14, 0.1, 0.13, 0.04, SH.x, SH.y - 0.385, SH.z - 0.15);
    rb('iron', 0.165, 0.03, 0.33, 0.01, SH.x, SH.y - 0.437, SH.z - 0.06, 0, 0, 0, 1);
    for (let i = 0; i < 2; i++) ring('leather', 0.084, 0.01, SH.x, SH.y - 0.14 - i * 0.12, SH.z);
  }
  void HALF_PI;

  bodyGeos = pb.merge();
  return bodyGeos;
}

function std(p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial(p);
}

/** Procedural soldier of the siege era with skinned body, team tabard and procedural animation. */
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
  private gearId = '';
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
    const st = steelMaps();
    const gm = gunmetalMaps();
    const lm = leatherMaps();
    const mm = mailMaps();
    const fm = fabricMaps();
    const wm = woodMaps();
    const rm = rubberMaps();
    const quilt = quiltMaps('linen', CLOTHS.linen);
    this.mats = {
      cloth: std({ color: 0xffffff, roughness: 1, metalness: 0, map: quilt.map, normalMap: quilt.normalMap, normalScale: new THREE.Vector2(1, 1), roughnessMap: quilt.roughnessMap }),
      steel: std({ color: 0xb4bcc6, roughness: 1, metalness: 0.92, map: st.map, normalMap: st.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: st.roughnessMap }),
      leather: std({ color: 0x5b3b22, roughness: 1, metalness: 0, map: lm.map, normalMap: lm.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: lm.roughnessMap }),
      mail: std({ color: 0x8b9199, roughness: 1, metalness: 0.8, map: mm.map, normalMap: mm.normalMap, normalScale: new THREE.Vector2(1, 1), roughnessMap: mm.roughnessMap }),
      iron: std({ color: 0x3d4046, roughness: 1, metalness: 0.8, map: gm.map, normalMap: gm.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: gm.roughnessMap }),
      tabard: std({ color: accent.clone().lerp(new THREE.Color(0x3a3a40), 0.3).multiplyScalar(0.72), roughness: 1, metalness: 0, map: fm.map, normalMap: fm.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: fm.roughnessMap }),
      cream: std({ color: 0xe9dcc0, roughness: 1, metalness: 0, map: fm.map, normalMap: fm.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: fm.roughnessMap }),
      skin: std({ color: SKIN_TONES[0], roughness: 0.8, metalness: 0, map: rm.map, normalMap: rm.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) }),
      wood: std({ color: 0x8a5a30, roughness: 1, metalness: 0, map: wm.map, normalMap: wm.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: wm.roughnessMap }),
      gold: std({ color: 0xd9b25a, roughness: 0.4, metalness: 1, map: st.map, normalMap: st.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) }),
    };
    this.flashMats = [this.mats.cloth, this.mats.steel, this.mats.leather, this.mats.mail, this.mats.tabard, this.mats.cream];
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

  /** Swaps helmet, kit gear and device (cached geometry per key), the dye of the cloth and the skin. */
  setOutfit(o: Outfit): void {
    const id = `${outfitKey(o)}|${o.cloth}|${o.skin}`;
    if (id === this.outfitId) return;
    this.outfitId = id;
    const quilt = quiltMaps(o.cloth, CLOTHS[o.cloth]);
    const c = this.mats.cloth;
    c.map = quilt.map;
    c.normalMap = quilt.normalMap;
    c.roughnessMap = quilt.roughnessMap;
    c.needsUpdate = true;
    this.mats.skin.color.set(SKIN_TONES[o.skin % SKIN_TONES.length]);
    const gearId = outfitKey(o);
    if (gearId !== this.gearId) {
      this.gearId = gearId;
      for (const m of this.gearMeshes) this.root.remove(m);
      this.gearMeshes = skinnedMeshesFrom(buildGear(o), this.root, this.skeleton, (k) => this.mats[k], true, IDENTITY);
    }
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
    } else if (this.mats.cloth.emissive.r > 0) {
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
