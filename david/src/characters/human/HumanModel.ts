import * as THREE from 'three';
import { HumanData, buildAuxGeometry, buildBodyGeometry, type RigJson } from './HumanData';
import { HumanRig } from './HumanRig';
import { SkinMaterial, uvDensityAttribute } from './SkinMaterial';
import { EyeBall, WetMaterial } from './EyeModel';
import { StrandMaterial } from './HairStrands';
import { hasHumanAsset, humanAssetUrl } from './assets';

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
  /** body geometry tier; default: high -> 'sub1' (Catmull-Clark, ~56k verts), else 'base' (13.4k) */
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

function loadData(preset: string) {
  let p = dataCache.get(preset);
  if (!p) {
    p = (async () => {
      const [rigUrl, binUrl] = await Promise.all([humanAssetUrl(`${preset}/rig.json`), humanAssetUrl(`${preset}/human.bin`)]);
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

export class HumanModel {
  readonly root = new THREE.Group();
  readonly body: THREE.SkinnedMesh;
  readonly skeleton: THREE.Skeleton;
  readonly rig: HumanRig;
  readonly skin: SkinMaterial;
  readonly eyes: { L: EyeBall; R: EyeBall };
  readonly brows: THREE.SkinnedMesh | null = null;
  readonly lashes: THREE.SkinnedMesh | null = null;
  readonly tearLines: THREE.SkinnedMesh | null = null;
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
      for (const v of rig.variations) variation[v] = Math.max(0, rnd() * 1.6 - 0.6) * (rnd() < 0.5 ? 1 : 0.6);
      // mutually exclusive body builds
      if ((variation.heavy ?? 0) > 0 && (variation.lean ?? 0) > 0) variation[rnd() < 0.5 ? 'heavy' : 'lean'] = 0;
      const tone = 0.86 + rnd() * 0.22;
      tint = new THREE.Color(tone * (1 + (rnd() - 0.5) * 0.06), tone, tone * (1 - rnd() * 0.06));
    }
    // ---- rig + skeleton (joint positions follow the variation morphs: joints are linear in the morph)
    const rigJson = variation ? this.jointVariation(variation) : rig;
    this.rig = new HumanRig(rigJson, this.root);
    const level = (options.geometry ?? (q === 'high' ? 'sub1' : 'base')) === 'sub1' ? 1 : 0;
    const bg = buildBodyGeometry(data, level, variation);
    this.posIndex = bg.posIndex;
    bg.geometry.setAttribute('detailScale', uvDensityAttribute(bg.geometry));
    this.skin = new SkinMaterial({ albedo: tex.albedo, normal: tex.normal, mask: tex.mask, detail: tex.detail }, { quality: q, tint });
    const bones = this.rig.boneList;
    const inverses = this.rig.rig.bones.map((b) => new THREE.Matrix4().makeTranslation(-b.h[0], -b.h[1], -b.h[2]));
    this.skeleton = new THREE.Skeleton(bones, inverses);
    this.body = new THREE.SkinnedMesh(bg.geometry, this.skin);
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
      const g = buildAuxGeometry(data, prefix, keep);
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
    const browCol = new THREE.Color(bc[0], bc[1], bc[2]);
    this.brows = mkStrands('brow', new StrandMaterial({ color: browCol, tipColor: browCol.clone().multiplyScalar(1.5), opacity: 0.92, widthScale: 1.0 }));
    this.lashes = mkStrands('lash', new StrandMaterial({ color: browCol.clone().multiplyScalar(0.35), tipColor: browCol.clone().multiplyScalar(0.7), opacity: 1, widthScale: 1.0, roughness: 0.4 }));
    const tg = buildAuxGeometry(data, 'tear');
    if (tg) {
      const tl = new THREE.SkinnedMesh(tg, new WetMaterial(0.08, 0.45));
      tl.name = 'tearLines';
      tl.frustumCulled = false;
      tl.renderOrder = 2;
      this.root.add(tl);
      tl.bind(this.skeleton, new THREE.Matrix4());
      this.tearLines = tl;
    }
    // ---- eyes (rigid, parented to the eye bones)
    const mkEye = (S: 'L' | 'R') => {
      const e = rig.eyes[S];
      const op = e.opening;
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
      // fist hole: under the knuckle line, ~2.3 cm toward the palm, slightly proximal of the MCP joints
      const c = idx.clone().add(pky).multiplyScalar(0.5).addScaledVector(palm, 0.022).addScaledVector(f, -0.004);
      const yAxis = r.clone().sub(palm.clone().multiplyScalar(r.dot(palm))).normalize();
      const xAxis = palm.clone();
      const zAxis = xAxis.clone().cross(yAxis).normalize();
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
      this.addSocket(`handGrip${s}`, `wrist.${s}`, c, q);
      this.addSocket(`palm${s}`, `wrist.${s}`, mid.clone().lerp(wr, 0.45).addScaledVector(palm, 0.012), q);
    }
    const neck = R('neck01');
    this.addSocket('shoulderCarry', 'spine01', new THREE.Vector3(0, neck.y + 0.035, neck.z - 0.075));
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
    // eye socket space (head bone) for lid occlusion
    const head = this.rig.bones.head;
    const headRestQ = this.rig.restWorldQuaternion('head');
    const m = new THREE.Matrix4().copy(head.matrixWorld).multiply(new THREE.Matrix4().makeRotationFromQuaternion(headRestQ.invert()));
    m.invert();
    const lidOpen = 1 - this.rig.lidClose;
    for (const S of ['L', 'R'] as const) {
      const u = this.eyes[S].material.eyeUniforms;
      u.uSocket.value.copy(m);
      u.uLidOpen.value = lidOpen;
    }
    if (viewportHeight) for (const s of this.strandMats) s.strandUniforms.uResolutionY.value = viewportHeight;
    void camera;
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
  /** Body vertex positions in the rest pose (arms down), character space. */
  restPositions(): Float32Array {
    if (this._rest) return this._rest;
    const g = this.body.geometry;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const si = g.getAttribute('skinIndex') as THREE.BufferAttribute;
    const sw = g.getAttribute('skinWeight') as THREE.BufferAttribute;
    const mats = this.restSkinMatrices();
    const out = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3(), acc = new THREE.Vector3(), t = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      acc.set(0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (w <= 0) continue;
        acc.addScaledVector(t.copy(v).applyMatrix4(mats[si.getComponent(i, k)]), w);
      }
      acc.toArray(out, i * 3);
    }
    this._rest = out;
    return out;
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
   * Weights are transferred from the nearest body vertices (inverse-distance, k nearest).
   * space 'rest': geometry modelled around the rest pose (arms down — recommended); it is converted into
   * the bind pose by inverse skinning.  space 'bind': geometry already in MakeHuman's bind pose.
   */
  skinAttachment(geo: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], opts: { space?: 'rest' | 'bind'; k?: number; boneFilter?: (bone: string) => boolean } = {}) {
    const space = opts.space ?? 'rest';
    const k = opts.k ?? 6;
    const body = this.body.geometry;
    const bpos = space === 'rest' ? this.restPositions() : (body.getAttribute('position').array as Float32Array);
    const bsi = body.getAttribute('skinIndex') as THREE.BufferAttribute;
    const bsw = body.getAttribute('skinWeight') as THREE.BufferAttribute;
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
    const g = geo.index ? geo : geo;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const n = pos.count;
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    const p = new THREE.Vector3();
    const mats = space === 'rest' ? this.restSkinMatrices() : null;
    const outPos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p.fromBufferAttribute(pos, i);
      // gather candidates from growing shells
      let cand: { i: number; d: number }[] = [];
      for (let rr = 1; rr <= 6 && cand.length < k; rr++) {
        cand = [];
        const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell), cz = Math.floor(p.z / cell);
        for (let x = -rr; x <= rr; x++)
          for (let y = -rr; y <= rr; y++)
            for (let z = -rr; z <= rr; z++) {
              const l = grid.get(`${cx + x},${cy + y},${cz + z}`);
              if (l) for (const j of l) cand.push({ i: j, d: Math.hypot(bpos[j * 3] - p.x, bpos[j * 3 + 1] - p.y, bpos[j * 3 + 2] - p.z) });
            }
      }
      cand.sort((a, b) => a.d - b.d);
      const infl = new Map<number, number>();
      const kk = Math.min(k, cand.length);
      for (let c = 0; c < kk; c++) {
        const w = 1 / (cand[c].d + 0.004) ** 2;
        for (let m = 0; m < 4; m++) {
          const bw = bsw.getComponent(cand[c].i, m);
          if (bw <= 0) continue;
          const b = bsi.getComponent(cand[c].i, m);
          if (opts.boneFilter && !opts.boneFilter(names[b])) continue;
          infl.set(b, (infl.get(b) ?? 0) + bw * w);
        }
      }
      const list = [...infl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
      let sum = 0;
      for (const [, w] of list) sum += w;
      list.forEach(([b, w], m) => {
        si[i * 4 + m] = b;
        sw[i * 4 + m] = w / (sum || 1);
      });
      if (mats) {
        // inverse skinning: v_bind = (sum w M)^-1 v_rest
        const M = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        for (let m = 0; m < 4; m++) {
          const w = sw[i * 4 + m];
          if (w <= 0) continue;
          const e = mats[si[i * 4 + m]].elements;
          for (let z = 0; z < 16; z++) M.elements[z] += e[z] * w;
        }
        p.applyMatrix4(M.invert());
      }
      p.toArray(outPos, i * 3);
    }
    const out = geo.clone();
    out.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
    out.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    out.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    if (space === 'rest' && out.getAttribute('normal')) out.computeVertexNormals();
    const mesh = new THREE.SkinnedMesh(out, material);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    mesh.bind(this.skeleton, new THREE.Matrix4());
    return mesh;
  }

  dispose() {
    this.body.geometry.dispose();
    this.skin.dispose();
    for (const m of [this.brows, this.lashes, this.tearLines]) {
      if (!m) continue;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    for (const e of [this.eyes.L, this.eyes.R]) {
      e.ball.geometry.dispose();
      e.cornea.geometry.dispose();
      e.material.dispose();
    }
    this.root.removeFromParent();
  }
}
