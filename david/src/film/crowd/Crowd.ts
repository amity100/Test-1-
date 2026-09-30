/*
 * Crowd — GPU-instanced skinned armies for the opening film (docs/intro-script.md shots 4 and 6-9).
 *
 * One master soldier mesh per army (tools/crowd/bake_crowd.py: the MakeHuman `man` body dressed with the wardrobe's
 * real garments, decimated into 3 LODs, outfits and props as switchable regions) is drawn with one instanced draw
 * call per LOD; every agent samples the shared mocap animation texture (CrowdAnim) with its own clip, time, rate,
 * cross-fade and head turn, and gets its own build, colours and kit from a seed. Agents are culled against the
 * frustum and sorted into LODs by distance every frame (no allocation); the far LOD is a few hundred triangles.
 *
 *   const anim = await CrowdAnim.bake(ISRAEL_CLIPS);
 *   const crowd = await Crowd.create({ army: 'israel', anim, capacity: 700, tier: engine.quality.tier });
 *   scene.add(crowd.group);
 *   crowd.agents[i].pos.set(...); crowd.agents[i].play('march:c', { fade: 0.3 });
 *   each frame: crowd.update(dt, camera);
 */
import * as THREE from 'three';
import { gunzip } from '../../characters/human/inflate';
import { CrowdAnim, type BakedClip } from './CrowdAnim';
import { ALWAYS, crowdDepthMaterial, crowdMaterial, crowdUniforms, REGION, type CrowdUniforms } from './crowdShader';
import { IMP_JOINTS, impostorGeometry, impostorMaterial } from './impostorShader';

export type CrowdArmy = 'israel' | 'philistine';
export type CrowdTier = 'desktop-high' | 'desktop-medium' | 'mobile-high' | 'mobile-low';

const URLS = import.meta.glob('../../assets/crowd/*.binz', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>;

interface LodHeader {
  vertices: number;
  triangles: number;
  attrs: Record<string, { offset: number; bytes: number; type: string; itemSize: number }>;
}
interface CrowdHeader {
  army: string;
  bones: string[];
  gripBind: number[];
  lods: LodHeader[];
  heads: Record<string, number[]>;
}

const TYPED: Record<string, (b: ArrayBuffer, o: number, n: number) => ArrayBufferView> = {
  float32: (b, o, n) => new Float32Array(b, o, n / 4),
  int8: (b, o, n) => new Int8Array(b, o, n),
  uint8: (b, o, n) => new Uint8Array(b, o, n),
  uint16: (b, o, n) => new Uint16Array(b, o, n / 2),
  uint32: (b, o, n) => new Uint32Array(b, o, n / 4),
};

async function loadMesh(army: CrowdArmy) {
  const key = `../../assets/crowd/${army}.binz`;
  const url = await URLS[key]();
  const raw = await gunzip(await (await fetch(url)).arrayBuffer());
  const hl = new DataView(raw).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(raw, 4, hl))) as CrowdHeader;
  const base = 4 + hl;
  const geos = header.lods.map((l) => {
    const a = (k: string) => {
      const e = l.attrs[k];
      return TYPED[e.type](raw, base + e.offset, e.bytes);
    };
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a('position') as Float32Array, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(a('normal') as Int8Array, 3, true));
    g.setAttribute('cJoints', new THREE.BufferAttribute(a('joints') as Uint8Array, 4));
    g.setAttribute('cWeights', new THREE.BufferAttribute(a('weights') as Uint8Array, 4, true));
    g.setAttribute('cRegion', new THREE.BufferAttribute(a('region') as Uint8Array, 1));
    g.setAttribute('cColor', new THREE.BufferAttribute(a('color') as Uint8Array, 3, true));
    g.setAttribute('cProp', new THREE.BufferAttribute(a('prop') as Uint8Array, 1));
    const idx = a('index');
    g.setIndex(new THREE.BufferAttribute(idx as Uint16Array | Uint32Array, 1));
    return g;
  });
  // hem / belt heights for the shader patterns (from LOD0 tunic vertices)
  const g0 = geos[0];
  const pos = g0.attributes.position.array as Float32Array;
  const reg = g0.attributes.cRegion.array as Uint8Array;
  let hem = 9;
  for (let i = 0; i < reg.length; i++) if (reg[i] === REGION.tunic) hem = Math.min(hem, pos[i * 3 + 1]);
  let beltY = 0, nb = 0;
  for (let i = 0; i < reg.length; i++) if (reg[i] === REGION.belt) { beltY += pos[i * 3 + 1]; nb++; }
  // spear extent along the shaft (prop vertices are in the grip frame: y = along the shaft) and the mean skin colour
  const prop = g0.attributes.cProp.array as Uint8Array;
  const col = g0.attributes.cColor.array as Uint8Array;
  let sMin = 0, sMax = 0;
  const skin = [0, 0, 0];
  let ns = 0;
  for (let i = 0; i < reg.length; i++) {
    if (prop[i] > 0) { sMin = Math.min(sMin, pos[i * 3 + 1]); sMax = Math.max(sMax, pos[i * 3 + 1]); }
    if (reg[i] === REGION.skin) { skin[0] += col[i * 3]; skin[1] += col[i * 3 + 1]; skin[2] += col[i * 3 + 2]; ns++; }
  }
  const skinColor = new THREE.Color().setRGB(skin[0] / ns / 255, skin[1] / ns / 255, skin[2] / ns / 255, THREE.SRGBColorSpace);
  // bind-space centre lines of the dagger and the sword (the shader slims their guards)
  const dag = new THREE.Vector4();
  const cnt = [0, 0];
  for (let i = 0; i < reg.length; i++) {
    const k = reg[i] === REGION.dagger ? 0 : reg[i] === REGION.sword ? 1 : -1;
    if (k < 0) continue;
    if (k === 0) { dag.x += pos[i * 3]; dag.y += pos[i * 3 + 2]; } else { dag.z += pos[i * 3]; dag.w += pos[i * 3 + 2]; }
    cnt[k]++;
  }
  if (cnt[0]) { dag.x /= cnt[0]; dag.y /= cnt[0]; }
  if (cnt[1]) { dag.z /= cnt[1]; dag.w /= cnt[1]; }
  return { header, geos, hem, beltY: nb ? beltY / nb : 1.0, spear: [-sMin || 0.9, sMax || 1.5] as [number, number], skinColor, dag };
}

// ---------------------------------------------------------------------------------------------------- agents
export interface Track {
  clip: BakedClip;
  t: number;
  rate: number;
}
export interface PlayOptions {
  fade?: number;
  time?: number;
  rate?: number;
}

export class CrowdAgent {
  readonly pos = new THREE.Vector3();
  yaw = 0;
  /** height scale (1 = 1.70 m) and girth (x/z) scale */
  scale = 1;
  girth = 1;
  seed = Math.random();
  /** enabled regions (ALWAYS | kit) */
  mask = ALWAYS;
  /** forward lean of a carried spear (z of its up vector) */
  lean = 0.2;
  headYaw = 0;
  visible = true;
  /** 0..1 how hard the feet strike (walking = 1): drives CrowdDust footstep puffs */
  stride = 0;
  cur: Track | null = null;
  prev: Track | null = null;
  fade = 1;
  fadeDur = 0.3;
  /** per-agent cached lod / distance (read-only) */
  lod = -1;
  dist = 0;
  constructor(readonly index: number, private readonly anim: CrowdAnim) {}

  /** play a baked clip key (e.g. 'march:c', 'cheer_reach:m', see clipKey) with a cross-fade */
  play(key: string, o: PlayOptions = {}) {
    const clip = this.anim.get(key);
    const fade = o.fade ?? 0.3;
    if (this.cur && fade > 0) {
      this.prev = this.cur;
      this.fade = 0;
      this.fadeDur = fade;
    } else {
      this.prev = null;
      this.fade = 1;
    }
    this.cur = { clip, t: o.time ?? 0, rate: o.rate ?? 1 };
  }
  /** seconds left in a one-shot clip (Infinity for loops) */
  remaining() {
    const c = this.cur;
    if (!c) return 0;
    return c.clip.loop ? Infinity : Math.max(0, c.clip.duration - c.t);
  }
  advance(dt: number) {
    if (this.cur) this.cur.t += dt * this.cur.rate;
    if (this.prev) {
      this.prev.t += dt * this.prev.rate;
      this.fade = Math.min(1, this.fade + dt / Math.max(1e-3, this.fadeDur));
      if (this.fade >= 1) this.prev = null;
    }
  }
}

function frames(tr: Track, out: Float32Array, o: number) {
  const c = tr.clip;
  let ft = tr.t * c.fps;
  let f0: number, f1: number, a: number;
  if (c.loop) {
    ft = ((ft % c.frames) + c.frames) % c.frames;
    f0 = Math.floor(ft);
    a = ft - f0;
    f1 = (f0 + 1) % c.frames;
  } else {
    ft = Math.min(Math.max(ft, 0), c.frames - 1);
    f0 = Math.floor(ft);
    a = ft - f0;
    f1 = Math.min(f0 + 1, c.frames - 1);
  }
  out[o] = c.start + f0;
  out[o + 1] = c.start + f1;
  out[o + 2] = a;
}

// ---------------------------------------------------------------------------------------------------- crowd
export interface CrowdOptions {
  army: CrowdArmy;
  anim: CrowdAnim;
  capacity: number;
  tier: CrowdTier;
  /** LOD switch distances (m): LOD0 below [0], LOD1 below [1], LOD2 below [2], culled beyond */
  lodDistances?: [number, number, number];
  /** max instances drawn per LOD (nearest first); the rest fall to the next LOD */
  lodCaps?: [number, number, number];
  castShadow?: boolean | [boolean, boolean, boolean];
  /**
   * far field as skeletal impostors (LOD3, see impostorShader.ts): true = the tier defaults, or [start m, far m, cap].
   * Default false (mesh LODs only).
   */
  impostors?: boolean | [number, number, number];
  /** agents nearer than this to the camera are not drawn (a lens inside the ranks); default 0.9 m */
  nearHide?: number;
}

/**
 * Per tier: LOD switch distances, per-LOD caps (nearest first; overflow falls to the next LOD), shadow casters.
 * With impostors: mesh LOD2 up to `imp[0]` m (cap `caps[2]`), skeletal impostors (LOD3) up to `imp[1]` m (cap imp[2]).
 * Without: mesh LOD2 up to d[2] (the old behaviour).
 */
const TIER_LOD: Record<CrowdTier, { d: [number, number, number]; caps: [number, number, number]; imp: [number, number, number]; shadow: [boolean, boolean, boolean]; lite: boolean }> = {
  'desktop-high': { d: [22, 60, 900], caps: [90, 320, 1100], imp: [150, 2500, 6000], shadow: [true, true, false], lite: false },
  'desktop-medium': { d: [16, 45, 700], caps: [60, 220, 900], imp: [110, 2000, 4000], shadow: [true, false, false], lite: false },
  'mobile-high': { d: [10, 32, 500], caps: [24, 120, 360], imp: [70, 1500, 2400], shadow: [true, false, false], lite: true },
  'mobile-low': { d: [8, 26, 400], caps: [14, 70, 200], imp: [55, 1200, 1600], shadow: [false, false, false], lite: true },
};

const _frustum = new THREE.Frustum();
const _pm = new THREE.Matrix4();
const _sphere = new THREE.Sphere();
const _cp = new THREE.Vector3();

export class Crowd {
  readonly group = new THREE.Group();
  readonly agents: CrowdAgent[] = [];
  readonly uniforms: CrowdUniforms;
  readonly meshes: THREE.Mesh[] = [];
  readonly lodTriangles: number[];
  /** live stats of the last update */
  readonly stats = { drawn: [0, 0, 0, 0], culled: 0, triangles: 0 };
  /** agents nearer than this (m) to the camera are skipped (the camera stands inside the ranks in shot 9) */
  nearHide: number;
  private readonly buf: { pose: Float32Array; vari: Float32Array; a: Float32Array; b: Float32Array; mask: Float32Array; attrs: THREE.InstancedBufferAttribute[] }[] = [];
  private readonly cfg: { d: [number, number, number]; caps: [number, number, number]; imp: [number, number, number] | null };
  private readonly order: Int32Array;
  private readonly keyd: Float32Array;
  private readonly mat: THREE.MeshStandardMaterial;
  private readonly depth: THREE.MeshDepthMaterial;
  private readonly impMat: THREE.MeshStandardMaterial | null = null;

  static async create(o: CrowdOptions): Promise<Crowd> {
    const m = await loadMesh(o.army);
    return new Crowd(o, m);
  }

  private constructor(o: CrowdOptions, m: Awaited<ReturnType<typeof loadMesh>>) {
    const t = TIER_LOD[o.tier];
    const imp = o.impostors === true ? t.imp : o.impostors ? o.impostors : null;
    this.cfg = { d: o.lodDistances ?? t.d, caps: o.lodCaps ?? t.caps, imp };
    this.nearHide = o.nearHide ?? 0.9;
    this.uniforms = crowdUniforms(o.army);
    const u = this.uniforms;
    u.uAnim.value = o.anim.texture;
    u.uGripBind.value.fromArray(m.header.gripBind);
    const n3 = m.header.heads['neck03'];
    if (n3) u.uHeadPivot.value.set(n3[0], n3[1], n3[2]);
    u.uHemY.value = m.hem;
    u.uBeltY.value = m.beltY;
    u.uSpearExt.value.set(m.spear[0], m.spear[1]);
    u.uSkin.value.copy(m.skinColor);
    u.uDagC.value.copy(m.dag);
    const hd = m.header.heads;
    const jv = (b: string, v: THREE.Vector3) => { const a = hd[b]; if (a) v.set(a[0], a[1], a[2]); };
    ['upperleg01.L', 'lowerleg01.L', 'upperleg01.R', 'lowerleg01.R'].forEach((b, i) => jv(b, u.uLegJ.value[i]));
    ['upperarm01.R', 'lowerarm01.R', 'wrist.R'].forEach((b, i) => jv(b, u.uArmJ.value[i]));
    IMP_JOINTS.forEach(([b], i) => jv(b, u.uJB.value[i]));
    this.mat = crowdMaterial(u, t.lite);
    this.depth = crowdDepthMaterial(u);
    this.group.name = `crowd:${o.army}`;
    const cap = o.capacity;
    const shadow = o.castShadow === undefined ? t.shadow : typeof o.castShadow === 'boolean' ? [o.castShadow, o.castShadow, false] : o.castShadow;
    this.lodTriangles = m.geos.map((g) => g.index!.count / 3);
    m.geos.forEach((g, lod) => {
      const n = Math.min(cap, this.cfg.caps[lod]);
      const pose = new Float32Array(n * 4), vari = new Float32Array(n * 4), a = new Float32Array(n * 4), b = new Float32Array(n * 4), mask = new Float32Array(n);
      const attrs = [
        new THREE.InstancedBufferAttribute(pose, 4), new THREE.InstancedBufferAttribute(vari, 4),
        new THREE.InstancedBufferAttribute(a, 4), new THREE.InstancedBufferAttribute(b, 4), new THREE.InstancedBufferAttribute(mask, 1),
      ];
      ['iPose', 'iVar', 'iA', 'iB', 'iMask'].forEach((k, i) => {
        attrs[i].setUsage(THREE.DynamicDrawUsage);
        g.setAttribute(k, attrs[i]);
      });
      g.instanceCount = 0;
      this.buf.push({ pose, vari, a, b, mask, attrs });
      const mesh = new THREE.Mesh(g, this.mat);
      mesh.customDepthMaterial = this.depth;
      mesh.frustumCulled = false;
      mesh.castShadow = !!shadow[lod];
      mesh.receiveShadow = true;
      mesh.name = `crowd:${o.army}:lod${lod}`;
      mesh.renderOrder = lod;
      this.meshes.push(mesh);
      this.group.add(mesh);
    });
    if (imp) {
      // LOD3: one quad per far soldier
      const g = impostorGeometry();
      const n = Math.min(cap, imp[2]);
      const pose = new Float32Array(n * 4), vari = new Float32Array(n * 4), a = new Float32Array(n * 4), b = new Float32Array(n * 4), mask = new Float32Array(n);
      const attrs = [
        new THREE.InstancedBufferAttribute(pose, 4), new THREE.InstancedBufferAttribute(vari, 4),
        new THREE.InstancedBufferAttribute(a, 4), new THREE.InstancedBufferAttribute(b, 4), new THREE.InstancedBufferAttribute(mask, 1),
      ];
      ['iPose', 'iVar', 'iA', 'iB', 'iMask'].forEach((k, i) => {
        attrs[i].setUsage(THREE.DynamicDrawUsage);
        g.setAttribute(k, attrs[i]);
      });
      g.instanceCount = 0;
      this.buf.push({ pose, vari, a, b, mask, attrs });
      this.impMat = impostorMaterial(u);
      const mesh = new THREE.Mesh(g, this.impMat);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.name = `crowd:${o.army}:impostors`;
      mesh.renderOrder = 3;
      this.meshes.push(mesh);
      this.group.add(mesh);
      this.lodTriangles.push(2);
    }
    for (let i = 0; i < cap; i++) this.agents.push(new CrowdAgent(i, o.anim));
    this.order = new Int32Array(cap);
    this.keyd = new Float32Array(cap);
  }

  /** advance every agent's animation clock by dt (seconds of action time), cull, pick LODs and upload */
  update(dt: number, camera: THREE.Camera) {
    this.uniforms.uTime.value += dt;
    _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pm);
    const cp = camera.getWorldPosition(_cp);
    let n = 0;
    let culled = 0;
    const imp = this.cfg.imp;
    const far = imp ? imp[1] : this.cfg.d[2];
    const near = this.nearHide;
    for (const ag of this.agents) {
      ag.advance(dt);
      ag.lod = -1;
      if (!ag.visible || !ag.cur) continue;
      _sphere.center.set(ag.pos.x, ag.pos.y + 1.3 * ag.scale, ag.pos.z);
      _sphere.radius = 1.9 * ag.scale;
      const d = _sphere.center.distanceTo(cp);
      ag.dist = d;
      if (d > far || !_frustum.intersectsSphere(_sphere) || Math.hypot(ag.pos.x - cp.x, ag.pos.z - cp.z) < near) {
        culled++;
        continue;
      }
      this.order[n] = ag.index;
      this.keyd[ag.index] = d;
      n++;
    }
    // sort visible agents by distance (insertion sort on a nearly-sorted list is cheap frame to frame)
    const ord = this.order, kd = this.keyd;
    for (let i = 1; i < n; i++) {
      const v = ord[i], dv = kd[v];
      let j = i - 1;
      while (j >= 0 && kd[ord[j]] > dv) {
        ord[j + 1] = ord[j];
        j--;
      }
      ord[j + 1] = v;
    }
    const counts = [0, 0, 0, 0];
    const nl = this.buf.length;
    const d2 = imp ? imp[0] : Infinity;
    let tris = 0;
    for (let i = 0; i < n; i++) {
      const ag = this.agents[ord[i]];
      let lod = ag.dist < this.cfg.d[0] ? 0 : ag.dist < this.cfg.d[1] ? 1 : ag.dist < d2 ? 2 : 3;
      if (lod >= nl) lod = nl - 1;
      while (lod < nl && counts[lod] >= this.buf[lod].mask.length) lod++;
      if (lod >= nl) break;
      ag.lod = lod;
      const B = this.buf[lod];
      const k = counts[lod]++;
      const o = k * 4;
      B.pose[o] = ag.pos.x; B.pose[o + 1] = ag.pos.y; B.pose[o + 2] = ag.pos.z; B.pose[o + 3] = ag.yaw;
      B.vari[o] = ag.scale; B.vari[o + 1] = ag.girth; B.vari[o + 2] = ag.seed; B.vari[o + 3] = ag.lean;
      frames(ag.cur!, B.a, o);
      if (ag.prev) {
        frames(ag.prev, B.b, o);
        B.a[o + 3] = 1 - ag.fade;
      } else {
        B.a[o + 3] = 0;
      }
      B.b[o + 3] = ag.headYaw;
      B.mask[k] = ag.mask;
      tris += this.lodTriangles[lod];
    }
    for (let l = 0; l < nl; l++) {
      const g = this.meshes[l].geometry as THREE.InstancedBufferGeometry;
      g.instanceCount = counts[l];
      this.meshes[l].visible = counts[l] > 0;
      for (const at of this.buf[l].attrs) {
        at.clearUpdateRanges();
        at.addUpdateRange(0, counts[l] * at.itemSize);
        at.needsUpdate = true;
      }
      this.stats.drawn[l] = counts[l];
    }
    this.stats.culled = culled;
    this.stats.triangles = tris;
  }

  /** drawing-buffer height in pixels (renderer.getDrawingBufferSize().y); keeps far spear shafts visible */
  set viewportHeight(h: number) {
    this.uniforms.uViewH.value = Math.max(1, h);
  }

  /** compile the programs before the first shot (pass the set's scene + camera) */
  precompile(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    for (const m of this.meshes) m.visible = true;
    renderer.compile(scene, camera);
  }

  dispose() {
    for (const m of this.meshes) m.geometry.dispose();
    this.mat.dispose();
    this.depth.dispose();
    this.impMat?.dispose();
    this.group.removeFromParent();
  }
}

export { REGION };
