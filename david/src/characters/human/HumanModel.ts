import * as THREE from 'three';
import { HumanData, buildAuxGeometry, buildBodyGeometry, followSkin, skinNeighbours, variationDelta, type RigJson } from './HumanData';
import { HumanRig } from './HumanRig';
import { SkinMaterial, uvDensityAttribute } from './SkinMaterial';
import { EyeBall, WetMaterial } from './EyeModel';
import { StrandMaterial } from './HairStrands';
import { hasHumanAsset, humanAssetUrl } from './assets';
import { DualQuatSkinning, defaultDQSFactor } from './DualQuatSkinning';

/*
 * HumanModel — a realistic, skinned human built from MakeHuman (CC0) data by tools/human/build_human.py.
 *
 *   const david = await HumanModel.load({ preset: 'david', quality: engine.quality.name });
 *   scene.add(david.root);                     // faces +Z, feet on y = 0, origin under the pelvis
 *   mixer = new PoseMixer(david.joints);       // same joint names/conventions as DavidModel
 *   ...each frame: mixer.apply(); (foot IK on david.joints) ; david.update(dt, camera);
 *
 * Sockets (Object3D children of bones, oriented in character axes at rest):
 *   handGripL/R    centre of the closed fist; +Y runs along the grip hole toward the thumb/index side,
 *                  +X points out of the palm (a staff held upright passes along ±Y)
 *   shoulderCarry  on top of the shoulders behind the neck; +X across the shoulders (lamb lies along X)
 *   headTop        top of the skull (head bone), +Y up
 *   chin           chin point (jaw bone) — beard anchor
 *   crownAnchor    centre of the head cross-section at crown height (head bone); see metrics.crownRadius
 *   eyeL/R, mouth, spineUpper (between the shoulder blades), pelvis
 */

export type HumanQuality = 'low' | 'medium' | 'high';
export type SocketName =
  | 'handGripL' | 'handGripR' | 'shoulderCarry' | 'headTop' | 'chin' | 'crownAnchor'
  | 'eyeL' | 'eyeR' | 'mouth' | 'spineUpper' | 'pelvis' | 'palmL' | 'palmR';

export interface HumanLoadOptions {
  preset: string; // 'david' | 'saul' | 'man'
  quality: HumanQuality; // engine.quality.name
  /** body geometry tier; default: high -> 'sub1' (Catmull-Clark, ~56k verts), else 'base' (14.5k) */
  geometry?: 'base' | 'sub1';
  /** texture resolution; default: low -> 1024, else 2048 */
  textureSize?: 1024 | 2048;
  /** seed for random variation morphs + skin tone (presets that ship variations, e.g. "man") */
  seed?: number;
  /** explicit variation weights, e.g. { heavy: 0.5, noseBig: 0.3 } */
  variation?: Record<string, number>;
  /** multiplies the albedo */
  skinTint?: THREE.Color;
}

const dataCache = new Map<string, Promise<HumanData>>();
const texCache = new Map<string, Promise<THREE.Texture | null>>();
/** uv-density attribute per shared uv attribute (same topology -> same values; crowds compute it once) */
const densityCache = new WeakMap<THREE.BufferAttribute, THREE.BufferAttribute>();

function loadData(preset: string) {
  let p = dataCache.get(preset);
  if (!p) {
    p = (async () => {
      const [rigUrl, binUrl] = await Promise.all([humanAssetUrl(`${preset}/rig.json`), humanAssetUrl(`${preset}/human.binz`)]);
      return HumanData.fetch(rigUrl, binUrl);
    })();
    dataCache.set(preset, p);
  }
  return p;
}

function loadTex(rel: string, srgb: boolean, anisotropy = 4): Promise<THREE.Texture | null> {
  const key = rel + (srgb ? ':s' : ':l');
  let p = texCache.get(key);
  if (!p) {
    p = (async () => {
      if (!hasHumanAsset(rel)) return null;
      const url = await humanAssetUrl(rel);
      const t = await new THREE.TextureLoader().loadAsync(url);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = anisotropy;
      t.wrapS = t.wrapT = rel.includes('detail') ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      return t;
    })();
    texCache.set(key, p);
  }
  return p;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Teeth: natural off-white enamel (never gold), lit only as much as the mouth lets light in — the molars sit in the
 * dark mouth interior, the incisors get most of the light but still less than the lips (per-vertex occlusion).
 */
function teethMaterial(g: THREE.BufferGeometry): THREE.MeshPhysicalMaterial {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  let zmax = -Infinity;
  for (let i = 0; i < pos.count; i++) zmax = Math.max(zmax, pos.getZ(i));
  const occ = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.smoothstep(pos.getZ(i), zmax - 0.03, zmax - 0.004);
    occ[i] = 0.12 + 0.88 * t * t;
  }
  g.setAttribute('teethOcc', new THREE.BufferAttribute(occ, 1));
  // enamel is a diffuse, slightly translucent off-white with a soft sheen — a strong mirror specular over a shadowed
  // diffuse reads as metal (gold / chrome) at game distance
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, color: 0xf0e9dc, roughness: 0.48, metalness: 0, ior: 1.5, specularIntensity: 0.22 });
  m.name = 'HumanTeeth';
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float teethOcc;\nvarying float vTeethOcc;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTeethOcc = teethOcc;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vTeethOcc;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// enamel: keep the baked shade variation but desaturate it toward a slightly warm off-white
diffuseColor.rgb = mix( vec3( dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) ) ) * vec3( 1.0, 0.97, 0.9 ), diffuseColor.rgb, 0.35 );`,
      )
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
reflectedLight.directDiffuse *= vTeethOcc;
reflectedLight.directSpecular *= vTeethOcc * 0.6;
// the lips usually shadow the teeth from the sun: light bounced inside the mouth keeps them off-white, not black
reflectedLight.indirectDiffuse *= vTeethOcc * 1.15;
reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.035 * vTeethOcc;
reflectedLight.indirectSpecular *= vTeethOcc * 0.25;`,
      );
  };
  m.customProgramCacheKey = () => 'human-teeth';
  return m;
}

export class HumanModel {
  readonly root = new THREE.Group();
  readonly body: THREE.SkinnedMesh;
  readonly skeleton: THREE.Skeleton;
  /** LBS/DQS blend skinning; call `dqs.patchMaterial(mat)` on garment materials so they deform like the body */
  readonly dqs: DualQuatSkinning;
  readonly rig: HumanRig;
  readonly skin: SkinMaterial;
  readonly eyes: { L: EyeBall; R: EyeBall };
  readonly brows: THREE.SkinnedMesh | null = null;
  readonly lashes: THREE.SkinnedMesh | null = null;
  readonly tearLines: THREE.SkinnedMesh | null = null;
  readonly teeth: THREE.SkinnedMesh | null = null;
  readonly sockets = {} as Record<SocketName, THREE.Object3D>;
  readonly metrics: {
    height: number; hipHeight: number; thighLength: number; shinLength: number;
    crownRadius: [number, number]; vertices: number; triangles: number; loadMs: number;
  };
  private strandMats: StrandMaterial[] = [];
  private opening = { L: new THREE.Vector4(), R: new THREE.Vector4() };
  private posIndex: Uint32Array;

  get joints() {
    return this.rig.joints;
  }
  get bones() {
    return this.rig.bones;
  }

  static async load(o: HumanLoadOptions): Promise<HumanModel> {
    const t0 = performance.now();
    const texSize = o.textureSize ?? (o.quality === 'low' ? 1024 : 2048);
    const sz = texSize === 1024 ? '1k' : '2k';
    const aniso = o.quality === 'high' ? 8 : 4;
    const data = await loadData(o.preset);
    const irisStyle = data.rig.irisStyle.iris ?? 'brown_hazel';
    const [albedo, normal, mask, detail, eye] = await Promise.all([
      loadTex(`${o.preset}/albedo_${sz}.webp`, true, aniso),
      loadTex(`${o.preset}/normal_${sz}.webp`, false, aniso),
      loadTex(`${o.preset}/mask_${sz}.webp`, false, aniso),
      o.quality === 'low' ? Promise.resolve(null) : loadTex('common/skin_detail_normal.webp', false, aniso),
      loadTex(`common/eye_${irisStyle}.webp`, true, 4),
    ]);
    const m = new HumanModel(data, o, { albedo, normal, mask, detail, eye });
    (m.metrics as { loadMs: number }).loadMs = performance.now() - t0;
    return m;
  }

  constructor(
    readonly data: HumanData,
    readonly options: HumanLoadOptions,
    tex: { albedo: THREE.Texture | null; normal: THREE.Texture | null; mask: THREE.Texture | null; detail: THREE.Texture | null; eye: THREE.Texture | null },
  ) {
    const q = options.quality;
    const rig = data.rig;
    this.root.name = `human:${rig.preset}`;
    // ---- variations
    let variation = options.variation;
    let tint = options.skinTint?.clone();
    if (!variation && options.seed !== undefined && rig.variations.length) {
      const rnd = mulberry(options.seed * 9973 + 17);
      variation = {};
      const BODY = ['heavy', 'lean', 'strong'].filter((v) => rig.variations.includes(v));
      if (BODY.length && rnd() < 0.8) variation[BODY[Math.floor(rnd() * BODY.length)]] = 0.35 + rnd() * 0.65;
      if (rig.variations.includes('older') && rnd() < 0.45) variation.older = rnd();
      // face morphs are linear deltas: negative weights give the opposite trait (smaller nose, narrower jaw...)
      for (const v of rig.variations) if (!(v in variation) && !['heavy', 'lean', 'strong', 'older'].includes(v)) variation[v] = rnd() * 1.7 - 0.7;
      const tone = 0.86 + rnd() * 0.22;
      tint = new THREE.Color(tone * (1 + (rnd() - 0.5) * 0.06), tone, tone * (1 - rnd() * 0.06));
    }
    // ---- rig + skeleton (joint positions follow the variation morphs: joints are linear in the morph)
    const rigJson = variation ? this.jointVariation(variation) : rig;
    this.rig = new HumanRig(rigJson, this.root);
    const level = (options.geometry ?? (q === 'high' ? 'sub1' : 'base')) === 'sub1' ? 1 : 0;
    const bg = buildBodyGeometry(data, level, variation);
    this.posIndex = bg.posIndex;
    {
      const uvA = bg.geometry.getAttribute('uv') as THREE.BufferAttribute;
      let ds = densityCache.get(uvA);
      if (!ds) densityCache.set(uvA, (ds = uvDensityAttribute(bg.geometry)));
      bg.geometry.setAttribute('detailScale', ds);
    }
    this.skin = new SkinMaterial({ albedo: tex.albedo, normal: tex.normal, mask: tex.mask, detail: tex.detail }, { quality: q, tint });
    const bones = this.rig.boneList;
    const inverses = this.rig.rig.bones.map((b) => new THREE.Matrix4().makeTranslation(-b.h[0], -b.h[1], -b.h[2]));
    this.skeleton = new THREE.Skeleton(bones, inverses);
    // dual-quaternion / linear blend skinning (volume-preserving shoulders, hips and spine)
    this.dqs = new DualQuatSkinning(this.skeleton, this.root, defaultDQSFactor);
    this.dqs.patchMaterial(this.skin, true);
    this.body = new THREE.SkinnedMesh(bg.geometry, this.skin);
    this.body.customDepthMaterial = this.dqs.patchMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), true);
    this.body.name = 'body';
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.body.frustumCulled = false;
    this.root.add(this.body);
    this.body.bind(this.skeleton, new THREE.Matrix4());
    // ---- strands (brows, lashes) and tear lines share the skeleton
    const bc = rig.brows.color ?? [0.12, 0.07, 0.04];
    const keep = q === 'low' ? 2 : 1;
    const mkStrands = (prefix: 'brow' | 'lash', mat: StrandMaterial) => {
      const g = buildAuxGeometry(data, prefix, keep, variation);
      if (!g) return null;
      const mesh = new THREE.SkinnedMesh(g, mat);
      mesh.name = prefix;
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      this.root.add(mesh);
      mesh.bind(this.skeleton, new THREE.Matrix4());
      this.strandMats.push(mat);
      return mesh;
    };
    const browCol = new THREE.Color().setRGB(bc[0], bc[1], bc[2], THREE.SRGBColorSpace); // preset colours are sRGB
    this.brows = mkStrands('brow', new StrandMaterial({ color: browCol, tipColor: browCol.clone().multiplyScalar(1.5), opacity: 0.92, widthScale: 1.0 }));
    this.lashes = mkStrands('lash', new StrandMaterial({ color: browCol.clone().multiplyScalar(0.35), tipColor: browCol.clone().multiplyScalar(0.8), opacity: 1, widthScale: 1.0, roughness: 0.6 }));
    const tg = buildAuxGeometry(data, 'tear', 1, variation);
    if (tg) {
      // the wet meniscus along the lower lid: a thin bright specular line gives the eyes life
      const tl = new THREE.SkinnedMesh(tg, new WetMaterial(0.045, 0.9));
      tl.name = 'tearLines';
      tl.frustumCulled = false;
      tl.renderOrder = 2;
      this.root.add(tl);
      tl.bind(this.skeleton, new THREE.Matrix4());
      this.tearLines = tl;
    }
    const teethG = buildAuxGeometry(data, 'teeth', 1, variation);
    if (teethG) {
      const tm = teethMaterial(teethG);
      const teeth = new THREE.SkinnedMesh(teethG, tm);
      teeth.name = 'teeth';
      teeth.frustumCulled = false;
      this.root.add(teeth);
      teeth.bind(this.skeleton, new THREE.Matrix4());
      this.teeth = teeth;
    }
    // ---- eyes (rigid, parented to the eye bones)
    const vDelta = variationDelta(data, variation);
    const mkEye = (S: 'L' | 'R') => {
      const e = rig.eyes[S];
      let op = e.opening;
      if (vDelta) {
        // the lid opening follows the variation morphs (eyesSmall, browHeavy...) like the skin does
        const flat = new Float32Array(op.length * 3);
        op.forEach((p, i) => flat.set(p, i * 3));
        followSkin(flat, skinNeighbours(data, flat), vDelta);
        op = op.map((_, i) => [flat[i * 3], flat[i * 3 + 1], flat[i * 3 + 2]] as [number, number, number]);
      }
      let minx = Infinity, maxx = -Infinity;
      for (const p of op) {
        minx = Math.min(minx, p[0]);
        maxx = Math.max(maxx, p[0]);
      }
      const width = maxx - minx;
      const eye = new EyeBall({ radius: e.radius, irisRadius: width * 0.235, texture: tex.eye, quality: q });
      const bone = this.rig.bones[e.bone];
      // bone local frame: rest world rotation of the eye bone (identity for the face) — eye centre = bone head
      const inv = this.rig.restWorldQuaternion(e.bone).invert();
      eye.group.quaternion.copy(inv);
      if (e.offset) eye.group.position.set(e.offset[0], e.offset[1], e.offset[2]).applyQuaternion(inv);
      bone.add(eye.group);
      // opening ellipse in head-bone space
      const hb = this.rig.restWorldPosition('head');
      let cx = 0, cy = 0, maxy = -Infinity, miny = Infinity;
      for (const p of op) {
        cx += p[0] / op.length;
        cy += p[1] / op.length;
        maxy = Math.max(maxy, p[1]);
        miny = Math.min(miny, p[1]);
      }
      this.opening[S].set(cx - hb.x, cy - hb.y, width / 2, (maxy - miny) / 2);
      eye.material.eyeUniforms.uOpening.value.copy(this.opening[S]);
      return eye;
    };
    this.eyes = { L: mkEye('L'), R: mkEye('R') };
    // ---- sockets
    this.buildSockets();
    const lm = rig.landmarks;
    this.metrics = {
      height: lm.headTop[1],
      hipHeight: this.rig.hipHeight,
      thighLength: this.rig.thighLength,
      shinLength: this.rig.shinLength,
      crownRadius: lm.crownRadius,
      vertices: bg.vertexCount,
      triangles: bg.triangleCount,
      loadMs: 0,
    };
    this._headRestInv.makeRotationFromQuaternion(this.rig.restWorldQuaternion('head').invert());
    // conservative bounds (any pose) so skinned parts can be frustum-culled without CPU skinning
    const h = this.metrics.height;
    const bounds = new THREE.Sphere(new THREE.Vector3(0, h * 0.55, 0), h * 0.8);
    for (const m of [this.body, this.brows, this.lashes, this.tearLines, this.teeth]) {
      if (!m) continue;
      m.boundingSphere = bounds.clone();
      m.frustumCulled = true;
    }
    this.rig.update(0);
    this.root.updateMatrixWorld(true);
  }

  private jointVariation(v: Record<string, number>): RigJson {
    const src = this.data.rig;
    const nb = src.bones.length;
    const d = new Float32Array(nb * 3);
    for (const [k, w] of Object.entries(v)) {
      if (!w || !this.data.has(`var.${k}.joints`)) continue;
      const dj = this.data.float(`var.${k}.joints`);
      for (let i = 0; i < d.length; i++) d[i] += dj[i] * w;
    }
    const bones = src.bones.map((b, i) => ({ ...b, h: [b.h[0] + d[i * 3], b.h[1] + d[i * 3 + 1], b.h[2] + d[i * 3 + 2]] as [number, number, number] }));
    return { ...src, bones };
  }

  // ---------------------------------------------------------------------------------------- sockets
  /** Create a socket at a rest-pose world position/orientation, parented to a bone. */
  addSocket(name: string, bone: string, restPos: THREE.Vector3, restQuat = new THREE.Quaternion()) {
    const b = this.rig.bones[bone];
    const W = this.rig.restWorldQuaternion(bone);
    const Winv = W.clone().invert();
    const o = new THREE.Object3D();
    o.name = name;
    o.position.copy(restPos).sub(this.rig.restWorldPosition(bone)).applyQuaternion(Winv);
    o.quaternion.copy(Winv).multiply(restQuat);
    b.add(o);
    (this.sockets as Record<string, THREE.Object3D>)[name] = o;
    return o;
  }

  private buildSockets() {
    const R = (n: string) => this.rig.restWorldPosition(n);
    const lm = this.data.rig.landmarks;
    for (const s of ['L', 'R'] as const) {
      const sg = s === 'L' ? 1 : -1;
      const wr = R(`wrist.${s}`), idx = R(`finger2-1.${s}`), pky = R(`finger5-1.${s}`), mid = R(`finger3-1.${s}`);
      const f = mid.clone().sub(wr).normalize();
      const r = idx.clone().sub(pky).normalize();
      const palm = f.clone().cross(r).multiplyScalar(sg).normalize();
      const g = this.rig.grip[s];
      const c = g.center;
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(g.x, g.y, g.z));
      void palm;
      this.addSocket(`handGrip${s}`, `wrist.${s}`, c, q);
      this.addSocket(`palm${s}`, `wrist.${s}`, mid.clone().lerp(wr, 0.45).addScaledVector(palm, 0.012), q);
    }
    const neck = R('neck01');
    // like DavidModel.shoulderSocket: +Z of the socket runs along the character's +X (a lamb lies across the shoulders)
    this.addSocket('shoulderCarry', 'spine01', new THREE.Vector3(0, neck.y + 0.035, neck.z - 0.075), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
    this.addSocket('headTop', 'head', new THREE.Vector3(...lm.headTop));
    this.addSocket('chin', 'jaw', new THREE.Vector3(...lm.chin));
    this.addSocket('crownAnchor', 'head', new THREE.Vector3(...lm.crown));
    this.addSocket('eyeL', 'head', new THREE.Vector3(...this.data.rig.eyes.L.center));
    this.addSocket('eyeR', 'head', new THREE.Vector3(...this.data.rig.eyes.R.center));
    const lip = new THREE.Vector3(...lm.chin).lerp(new THREE.Vector3(...lm.noseTip), 0.55);
    this.addSocket('mouth', 'head', lip);
    this.addSocket('spineUpper', 'spine01', R('spine01').add(new THREE.Vector3(0, 0.02, -0.11)));
    this.addSocket('pelvis', 'spine05', this.rig.pelvis.clone());
  }

  // ---------------------------------------------------------------------------------------- update
  /** Per-frame: transfer the proxy pose to the skeleton, face/eyes, strand resolution. */
  update(dt: number, camera?: THREE.Camera, viewportHeight?: number) {
    this.rig.update(dt);
    this.root.updateMatrixWorld(true);
    // eye socket space (aligned head frame) for lid occlusion on the eyeballs
    const m = this._sock.copy(this.rig.bones.head.matrixWorld).multiply(this._headRestInv).invert();
    const lidOpen = 1 - this.rig.lidClose;
    for (const S of ['L', 'R'] as const) {
      const u = this.eyes[S].material.eyeUniforms;
      u.uSocket.value.copy(m);
      u.uLidOpen.value = lidOpen;
    }
    if (viewportHeight) for (const s of this.strandMats) s.strandUniforms.uResolutionY.value = viewportHeight;
    void camera;
  }
  private _sock = new THREE.Matrix4();
  private _headRestInv = new THREE.Matrix4();

  /** Staff / handle radius (m) for the 'grip' finger pose; re-solves the fingers and moves the grip sockets. */
  setGripRadius(radius: number) {
    this.rig.solveGrip(radius);
    for (const s of ['L', 'R'] as const) {
      const g = this.rig.grip[s];
      const sock = this.sockets[`handGrip${s}`];
      const W = this.rig.restWorldQuaternion(`wrist.${s}`).invert();
      sock.position.copy(g.center).sub(this.rig.restWorldPosition(`wrist.${s}`)).applyQuaternion(W);
    }
  }

  /** Pupil size 0 (bright sun) .. 1 (dark). */
  setPupil(v: number) {
    this.eyes.L.material.eyeUniforms.uPupil.value = v;
    this.eyes.R.material.eyeUniforms.uPupil.value = v;
  }

  // ---------------------------------------------------------------------------------------- clothing helpers
  /**
   * Hide body triangles under clothing (prevents poke-through, saves fill-rate).
   * `hidden(p, bone)` receives each vertex's REST-pose position (arms down, metres) and dominant bone name;
   * a triangle is removed when all three vertices are hidden.  Call again with `null` to restore.
   */
  hideSkin(hidden: ((p: THREE.Vector3, bone: string) => boolean) | null) {
    const g = this.body.geometry;
    if (!g.userData.fullIndex) g.userData.fullIndex = g.getIndex()!.clone();
    const full = g.userData.fullIndex as THREE.BufferAttribute;
    if (!hidden) {
      g.setIndex(full.clone());
      return;
    }
    const rest = this.restPositions();
    const si = g.getAttribute('skinIndex') as THREE.BufferAttribute;
    const n = rest.length / 3;
    const hid = new Uint8Array(n);
    const p = new THREE.Vector3();
    const names = this.data.rig.bones.map((b) => b.n);
    for (let i = 0; i < n; i++) hid[i] = hidden(p.fromArray(rest, i * 3), names[si.getX(i)]) ? 1 : 0;
    const out: number[] = [];
    for (let t = 0; t < full.count; t += 3) {
      const a = full.getX(t), b = full.getX(t + 1), c = full.getX(t + 2);
      if (hid[a] && hid[b] && hid[c]) continue;
      out.push(a, b, c);
    }
    g.setIndex(n < 65536 ? new THREE.BufferAttribute(Uint16Array.from(out), 1) : new THREE.BufferAttribute(Uint32Array.from(out), 1));
  }

  private _rest: Float32Array | null = null;
  private _restN: Float32Array | null = null;
  /** Body vertex normals in the rest pose (character space). */
  restNormals(): Float32Array {
    if (this._restN) return this._restN;
    const g = this.body.geometry;
    const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
    const rots = this.rig.rest.map((r) => r.Q);
    const out = new Float32Array(nrm.count * 3);
    const v = new THREE.Vector3(), acc = new THREE.Vector3(), t = new THREE.Vector3();
    const inf = this.influenceReader(g);
    for (let i = 0; i < nrm.count; i++) {
      v.fromBufferAttribute(nrm, i);
      acc.set(0, 0, 0);
      inf(i, (b, w) => acc.addScaledVector(t.copy(v).applyQuaternion(rots[b]), w));
      acc.normalize().toArray(out, i * 3);
    }
    this._restN = out;
    return out;
  }
  /** Body vertex positions in the rest pose (arms down), character space. */
  restPositions(): Float32Array {
    if (this._rest) return this._rest;
    const g = this.body.geometry;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const mats = this.restSkinMatrices();
    const out = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3(), acc = new THREE.Vector3(), t = new THREE.Vector3();
    const inf = this.influenceReader(g);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      acc.set(0, 0, 0);
      inf(i, (b, w) => acc.addScaledVector(t.copy(v).applyMatrix4(mats[b]), w));
      acc.toArray(out, i * 3);
    }
    this._rest = out;
    return out;
  }

  /** Iterate the (up to 8) bone influences of vertex i of a skinned geometry. */
  private influenceReader(g: THREE.BufferGeometry) {
    const sets: [THREE.BufferAttribute, THREE.BufferAttribute][] = [];
    for (const [a, b] of [['skinIndex', 'skinWeight'], ['skinIndex2', 'skinWeight2']]) {
      const si = g.getAttribute(a) as THREE.BufferAttribute | undefined;
      const sw = g.getAttribute(b) as THREE.BufferAttribute | undefined;
      if (si && sw) sets.push([si, sw]);
    }
    return (i: number, fn: (bone: number, w: number) => void) => {
      for (const [si, sw] of sets) {
        for (let k = 0; k < 4; k++) {
          const w = sw.getComponent(i, k);
          if (w > 0) fn(si.getComponent(i, k), w);
        }
      }
    };
  }

  /** Bind -> rest skinning matrices (character space). */
  restSkinMatrices(): THREE.Matrix4[] {
    return this.rig.rig.bones.map((b, i) => {
      const r = this.rig.rest[i];
      return new THREE.Matrix4().compose(r.restWorldPos, r.Q, new THREE.Vector3(1, 1, 1)).multiply(new THREE.Matrix4().makeTranslation(-b.h[0], -b.h[1], -b.h[2]));
    });
  }

  /**
   * Turn a garment / accessory geometry into a SkinnedMesh bound to this skeleton.
   * Weights are transferred from the nearest body vertices (inverse-distance, k nearest) whose normals face the
   * garment point (`facing: false` disables that test); `boneFilter` can exclude bones (e.g. arms for a skirt).
   * space 'rest': geometry modelled around the rest pose (arms down — recommended); it is converted into
   * the bind pose by inverse skinning.  space 'bind': geometry already in MakeHuman's bind pose.
   */
  skinAttachment(geo: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], opts: { space?: 'rest' | 'bind'; k?: number; boneFilter?: (bone: string) => boolean; facing?: boolean } = {}) {
    const space = opts.space ?? 'rest';
    const k = opts.k ?? 6;
    const body = this.body.geometry;
    const bpos = space === 'rest' ? this.restPositions() : (body.getAttribute('position').array as Float32Array);
    const bnrm = opts.facing === false ? null : space === 'rest' ? this.restNormals() : (body.getAttribute('normal').array as Float32Array);
    const bsi = body.getAttribute('skinIndex') as THREE.BufferAttribute;
    const binf = this.influenceReader(body);
    const names = this.data.rig.bones.map((b) => b.n);
    // spatial hash of body vertices
    const cell = 0.03;
    const grid = new Map<string, number[]>();
    const nb = bpos.length / 3;
    for (let i = 0; i < nb; i++) {
      const key = `${Math.floor(bpos[i * 3] / cell)},${Math.floor(bpos[i * 3 + 1] / cell)},${Math.floor(bpos[i * 3 + 2] / cell)}`;
      let l = grid.get(key);
      if (!l) grid.set(key, (l = []));
      l.push(i);
    }
    // body vertices whose dominant bone passes the bone filter
    let eligible: Uint8Array | null = null;
    if (opts.boneFilter) {
      eligible = new Uint8Array(nb);
      for (let j = 0; j < nb; j++) eligible[j] = opts.boneFilter(names[bsi.getComponent(j, 0)]) ? 1 : 0;
    }
    const g = geo;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const n = pos.count;
    const si = new Uint16Array(n * 8);
    const sw = new Float32Array(n * 8);
    const p = new THREE.Vector3();
    const mats = space === 'rest' ? this.restSkinMatrices() : null;
    const outPos = new Float32Array(n * 3);
    // authored normals are kept: they are carried into the bind pose with the same blended matrix (n' = M^T n for
    // p' = M^-1 p); only geometry without normals gets computeVertexNormals()
    const nrmA = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const outNrm = nrmA && mats ? new Float32Array(n * 3) : null;
    const nv = new THREE.Vector3();
    const n3 = new THREE.Matrix3();
    for (let i = 0; i < n; i++) {
      p.fromBufferAttribute(pos, i);
      // gather candidates from growing shells; fall back to plain nearest skin if the filters reject everything
      const gather = (strict: boolean, filter: boolean) => {
        let cand: { i: number; d: number }[] = [];
        const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell), cz = Math.floor(p.z / cell);
        for (let rr = 1; rr <= 10 && cand.length < k * 8; rr++) {
          cand = [];
          for (let x = -rr; x <= rr; x++)
            for (let y = -rr; y <= rr; y++)
              for (let z = -rr; z <= rr; z++) {
                const l = grid.get(`${cx + x},${cy + y},${cz + z}`);
                if (!l) continue;
                for (const j of l) {
                  const dx = p.x - bpos[j * 3], dy = p.y - bpos[j * 3 + 1], dz = p.z - bpos[j * 3 + 2];
                  // only skin that faces the garment point (keeps a skirt/tunic off the arms and the other leg)
                  if (strict && bnrm && dx * bnrm[j * 3] + dy * bnrm[j * 3 + 1] + dz * bnrm[j * 3 + 2] < -0.002) continue;
                  if (filter && eligible && !eligible[j]) continue;
                  cand.push({ i: j, d: Math.hypot(dx, dy, dz) });
                }
              }
        }
        cand.sort((a, b) => a.d - b.d);
        const infl = new Map<number, number>();
        const kk = Math.min(k, cand.length);
        for (let c = 0; c < kk; c++) {
          const w = 1 / (cand[c].d + 0.004) ** 2;
          binf(cand[c].i, (b, bw) => {
            if (filter && opts.boneFilter && !opts.boneFilter(names[b])) return;
            infl.set(b, (infl.get(b) ?? 0) + bw * w);
          });
        }
        return infl;
      };
      let infl = gather(true, true);
      if (infl.size === 0) infl = gather(false, true);
      if (infl.size === 0) infl = gather(false, false);
      const list = [...infl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      let sum = 0;
      for (const [, w] of list) sum += w;
      list.forEach(([b, w], m) => {
        si[i * 8 + m] = b;
        sw[i * 8 + m] = w / (sum || 1);
      });
      if (mats) {
        // inverse skinning: v_bind = (sum w M)^-1 v_rest
        const M = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        for (let m = 0; m < 8; m++) {
          const w = sw[i * 8 + m];
          if (w <= 0) continue;
          const e = mats[si[i * 8 + m]].elements;
          for (let z = 0; z < 16; z++) M.elements[z] += e[z] * w;
        }
        if (outNrm && nrmA) {
          nv.fromBufferAttribute(nrmA, i).applyMatrix3(n3.setFromMatrix4(M).transpose()).normalize();
          nv.toArray(outNrm, i * 3);
        }
        p.applyMatrix4(M.invert());
      }
      p.toArray(outPos, i * 3);
    }
    const out = geo.clone();
    out.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
    // 8 influences like the body, split into two vec4 attribute pairs
    const split = (src8: Uint16Array | Float32Array, half: number) => {
      const o = src8 instanceof Uint16Array ? new Uint16Array(n * 4) : new Float32Array(n * 4);
      for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) o[i * 4 + k] = src8[i * 8 + half * 4 + k];
      return o;
    };
    out.setAttribute('skinIndex', new THREE.BufferAttribute(split(si, 0), 4));
    out.setAttribute('skinWeight', new THREE.BufferAttribute(split(sw, 0), 4));
    out.setAttribute('skinIndex2', new THREE.BufferAttribute(split(si, 1), 4));
    out.setAttribute('skinWeight2', new THREE.BufferAttribute(split(sw, 1), 4));
    if (outNrm) out.setAttribute('normal', new THREE.BufferAttribute(outNrm, 3));
    else if (!out.getAttribute('normal')) out.computeVertexNormals();
    // same LBS/DQS 8-influence skinning as the body, so the garment follows the skin exactly.  The patch is per
    // (material, human): a material already skinning another human is replaced by a per-human clone here
    // (so read mesh.material back instead of assuming it is the instance you passed).
    const mm = Array.isArray(material) ? material.map((m) => this.dqs.materialFor(m, true)) : this.dqs.materialFor(material, true);
    for (const m of Array.isArray(mm) ? mm : [mm]) m.userData.humanSkinning = true;
    const mesh = new THREE.SkinnedMesh(out, mm);
    mesh.customDepthMaterial = this.dqs.patchMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), true);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    mesh.bind(this.skeleton, new THREE.Matrix4());
    return mesh;
  }

  /**
   * Free GPU resources of this instance (materials, the skinning textures, per-instance geometry).  Textures loaded
   * from the preset (albedo / normal / mask / detail / iris) are shared by every instance and stay cached.
   */
  dispose() {
    this.body.geometry.dispose();
    this.skin.dispose();
    (this.body.customDepthMaterial as THREE.Material | undefined)?.dispose();
    for (const m of [this.brows, this.lashes, this.tearLines, this.teeth]) {
      if (!m) continue;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    for (const e of [this.eyes.L, this.eyes.R]) {
      e.ball.geometry.dispose();
      e.cornea.geometry.dispose();
      e.material.dispose();
      (e.cornea.material as THREE.Material).dispose();
    }
    // garments created by skinAttachment: their depth materials are ours (their own materials belong to the caller)
    this.root.traverse((o) => {
      const sm = o as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh && sm !== this.body && sm.customDepthMaterial) sm.customDepthMaterial.dispose();
    });
    this.dqs.dispose();
    this.skeleton.dispose();
    this.root.removeFromParent();
  }
}
