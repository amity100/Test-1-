import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface CharacterAsset {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export async function loadCharacterAsset(url: string, onProgress?: (p: number) => void): Promise<CharacterAsset> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url, (e) => {
    if (e.total) onProgress?.(e.loaded / e.total);
  });
  return { scene: gltf.scene as THREE.Group, animations: gltf.animations };
}

/**
 * Decodes embedded glTF images through data: URLs on <img>, instead of the
 * loader's default blob: fetch, which sandboxed hosts (CSP) refuse.
 */
function dataUrlTextures(parser: any) {
  return {
    name: 'data-url-textures',
    loadTexture(index: number) {
      const json = parser.json;
      const texDef = json.textures[index];
      const img = json.images[texDef.source];
      if (img.bufferView === undefined) return null;
      return parser.getDependency('bufferView', img.bufferView).then(
        (view: ArrayBuffer) =>
          new Promise<THREE.Texture>((resolve, reject) => {
            const bytes = new Uint8Array(view);
            let bin = '';
            for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            const url = `data:${img.mimeType || 'image/png'};base64,${btoa(bin)}`;
            new THREE.TextureLoader().load(
              url,
              (tex) => {
                tex.flipY = false;
                const sampler = texDef.sampler !== undefined ? json.samplers?.[texDef.sampler] ?? {} : {};
                const wrap = (w?: number) => (w === 33071 ? THREE.ClampToEdgeWrapping : w === 33648 ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping);
                tex.wrapS = wrap(sampler.wrapS);
                tex.wrapT = wrap(sampler.wrapT);
                tex.needsUpdate = true;
                resolve(tex);
              },
              undefined,
              reject,
            );
          }),
      );
    },
  };
}

export async function parseCharacterAsset(buf: ArrayBuffer): Promise<CharacterAsset> {
  const loader = new GLTFLoader();
  loader.register(dataUrlTextures as any);
  const gltf = await loader.parseAsync(buf, '');
  return { scene: gltf.scene as THREE.Group, animations: gltf.animations };
}

export type Look = 'hero' | 'guard' | 'heavy' | 'officer' | 'hologram';

const LOOKS: Record<Exclude<Look, 'hologram'>, { body: number; visor: number; visorGlow: number; scale: number }> = {
  hero: { body: 0x55606e, visor: 0x19f0ff, visorGlow: 1.4, scale: 1.0 },
  guard: { body: 0xb9ae94, visor: 0xff5a1f, visorGlow: 1.6, scale: 1.0 },
  heavy: { body: 0x5b5f55, visor: 0xff2a10, visorGlow: 2.2, scale: 1.1 },
  officer: { body: 0x8ea0b5, visor: 0xffc040, visorGlow: 1.8, scale: 1.0 },
};

/**
 * One animated humanoid. Wraps the skinned model, blends idle/walk/run by
 * speed, and layers procedural poses (crouch, dead, carried, lunge) on top
 * of the clips so a single rig covers the whole moveset.
 */
export class Character {
  root = new THREE.Group();
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  private idle: THREE.AnimationAction;
  private walk: THREE.AnimationAction;
  private run: THREE.AnimationAction;
  bones: Record<string, THREE.Bone> = {};
  crouch = 0;
  /** 0..1 procedural "reach forward" for takedowns / snatches. */
  lunge = 0;
  aimArm = 0;
  dead = false;
  carried = false;
  speed = 0;
  materials: THREE.Material[] = [];
  visorMat: THREE.MeshStandardMaterial | null = null;
  private frozen = false;

  constructor(asset: CharacterAsset, look: Look, hologramMat?: THREE.Material) {
    this.model = SkeletonUtils.clone(asset.scene);
    this.model.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if ((o as THREE.Bone).isBone) this.bones[o.name.replace('mixamorig:', '')] = o as THREE.Bone;
      if (!m.isMesh) return;
      m.castShadow = look !== 'hologram';
      m.receiveShadow = look !== 'hologram';
      m.frustumCulled = false;
      const src = m.material as THREE.MeshStandardMaterial;
      if (look === 'hologram') {
        m.material = hologramMat!;
        return;
      }
      const L = LOOKS[look];
      const mat = src.clone();
      if (src.name.toLowerCase().includes('visor')) {
        mat.color.set(0x050505);
        mat.emissive = new THREE.Color(L.visor);
        mat.emissiveIntensity = L.visorGlow;
        mat.roughness = 0.2;
        mat.metalness = 0.6;
        this.visorMat = mat;
      } else {
        mat.color.set(L.body);
        mat.roughness = look === 'hero' ? 0.62 : 0.8;
        mat.metalness = look === 'hero' ? 0.25 : 0.1;
      }
      m.material = mat;
      this.materials.push(mat);
    });
    const scale = look === 'hologram' ? 1 : LOOKS[look].scale;
    this.model.scale.setScalar(scale);
    this.root.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);
    const clip = (n: string) => asset.animations.find((a) => a.name === n)!;
    this.idle = this.mixer.clipAction(clip('Idle'));
    this.walk = this.mixer.clipAction(clip('Walk'));
    this.run = this.mixer.clipAction(clip('Run'));
    for (const a of [this.idle, this.walk, this.run]) {
      a.play();
      a.setEffectiveWeight(0);
    }
    this.idle.setEffectiveWeight(1);
    this.mixer.update(Math.random() * 2);
  }

  /** Speed in m/s drives locomotion blending. */
  update(dt: number, speed: number) {
    this.speed = speed;
    if (this.frozen) return;
    const walkW = THREE.MathUtils.clamp(speed / 1.6, 0, 1) * (1 - THREE.MathUtils.clamp((speed - 3.2) / 1.8, 0, 1));
    const runW = THREE.MathUtils.clamp((speed - 3.2) / 1.8, 0, 1);
    const idleW = 1 - THREE.MathUtils.clamp(speed / 1.6, 0, 1);
    this.idle.setEffectiveWeight(idleW);
    this.walk.setEffectiveWeight(walkW);
    this.run.setEffectiveWeight(runW);
    // Match stride to ground speed so feet don't skate.
    this.walk.timeScale = THREE.MathUtils.clamp(speed / 1.55, 0.55, 1.5) * (this.crouch > 0.5 ? 0.85 : 1);
    this.run.timeScale = THREE.MathUtils.clamp(speed / 5.2, 0.7, 1.3);
    this.mixer.update(dt);
    this.applyPose();
    if (this.dead) this.frozen = true;
  }

  private applyPose() {
    const b = this.bones;
    const c = this.crouch;
    if (c > 0.001 && b.Hips) {
      // Lower hips and fold legs so feet stay planted.
      const k = c;
      b.Hips.position.y -= 38 * k; // rig units are centimetres
      b.LeftUpLeg && (b.LeftUpLeg.rotation.x -= 1.05 * k);
      b.RightUpLeg && (b.RightUpLeg.rotation.x -= 1.05 * k);
      b.LeftLeg && (b.LeftLeg.rotation.x += 1.75 * k);
      b.RightLeg && (b.RightLeg.rotation.x += 1.75 * k);
      b.LeftFoot && (b.LeftFoot.rotation.x -= 0.6 * k);
      b.RightFoot && (b.RightFoot.rotation.x -= 0.6 * k);
      b.Spine && (b.Spine.rotation.x += 0.35 * k);
      b.Spine1 && (b.Spine1.rotation.x += 0.15 * k);
      b.Head && (b.Head.rotation.x -= 0.3 * k);
    }
    if (this.lunge > 0.001) {
      const l = this.lunge;
      b.RightArm && (b.RightArm.rotation.x -= 1.2 * l);
      b.RightArm && (b.RightArm.rotation.z += 0.6 * l);
      b.RightForeArm && (b.RightForeArm.rotation.z += 0.8 * l);
      b.LeftArm && (b.LeftArm.rotation.x -= 1.0 * l);
      b.Spine1 && (b.Spine1.rotation.x += 0.35 * l);
    }
    if (this.aimArm > 0.001) {
      // Rift gauntlet raised: left arm points forward.
      const a = this.aimArm;
      b.LeftArm && (b.LeftArm.rotation.x -= 1.25 * a);
      b.LeftArm && (b.LeftArm.rotation.z -= 0.5 * a);
      b.LeftForeArm && (b.LeftForeArm.rotation.z -= 0.25 * a);
      b.Spine2 && (b.Spine2.rotation.y += 0.25 * a);
    }
  }

  /** Collapse into a lying pose (called once when killed). */
  die() {
    this.dead = true;
    this.idle.setEffectiveWeight(1);
    this.walk.setEffectiveWeight(0);
    this.run.setEffectiveWeight(0);
    this.crouch = 0;
    this.lunge = 0;
    this.mixer.update(0);
    const b = this.bones;
    // limp arms and legs
    b.LeftArm && (b.LeftArm.rotation.z += 0.6);
    b.RightArm && (b.RightArm.rotation.z -= 0.6);
    b.Head && (b.Head.rotation.y += 0.6);
    b.LeftUpLeg && (b.LeftUpLeg.rotation.z -= 0.15);
    b.RightUpLeg && (b.RightUpLeg.rotation.z += 0.2);
    b.RightLeg && (b.RightLeg.rotation.x += 0.5);
    this.frozen = true;
  }

  setOpacity(o: number) {
    for (const m of this.materials) {
      m.transparent = o < 1;
      m.opacity = o;
    }
  }

  dispose() {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
  }
}
