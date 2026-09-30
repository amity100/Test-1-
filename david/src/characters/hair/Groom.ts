import * as THREE from 'three';
import type { HumanModel } from '../human/HumanModel';
import { HeadSurface, rng, ss } from './HeadSurface';
import { growStrands, type Headband, type LayerBuild, type Tier } from './grow';
import { HairCapMaterial, HairDepthMaterial, HairMaterial, createHairUniforms, type HairUniforms } from './HairMaterial';
import { HairSim } from './HairSim';
import { enhanceLashes } from './lashes';
import { capNoise, davidStyle, manStyle, saulStyle, type GroomStyle, type ManStyleOptions } from './styles';
import { elderStyle, philistineStyle, samuelStyle, soldierStyle } from './filmStyles';

/*
 * createGroom(human, style, opts) — strand hair + beard for a HumanModel, parented to its head bone.
 *
 *   const groom = await createGroom(david, 'david', { quality: engine.quality.name, msaa: engine.quality.msaa });
 *   ...each frame, AFTER human.update(): groom.update(dt, windVelocity);
 *
 * One groom = 2 draw calls (strands: instanced ribbons, 1 + cap: offset skin shell) + 1 in the shadow pass.
 */

export type GroomStyleSpec =
  | 'david'
  | 'saul'
  | 'samuel'
  | ({ kind: 'man' } & ManStyleOptions)
  | { kind: 'elder'; seed: number }
  | { kind: 'soldier'; seed: number; headband?: boolean }
  | { kind: 'philistine'; seed: number }
  | { kind: 'custom'; style: GroomStyle; seed: number };

export interface GroomOptions {
  quality: Tier;
  /** press the hair under a band (diadem / headband) — see Headband */
  headband?: Headband;
  /** MSAA samples of the scene target (engine.quality.msaa): > 1 -> alpha-to-coverage, else dithered alpha */
  msaa?: number;
  /** guide dynamics (default true) */
  simulate?: boolean;
  /** strand density scale (1 = tier default) */
  density?: number;
  /** also thicken / darken the HumanModel eyelashes (default true) */
  lashes?: boolean;
}

export interface GroomStats {
  strands: number;
  ctrlPoints: number;
  segments: number;
  simGuides: number;
  trianglesFull: number;
  capTriangles: number;
  gpuBytes: number;
  buildMs: number;
  /** ms per build phase: surface (rest skin + SDF), grow (guides + children + AO), upload */
  timings: { surface: number; grow: number; finish: number };
  layers: { name: string; n: number; meanLen: number; maxLen: number; maxPush: number }[];
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector2();
const _m = new THREE.Matrix4();

export class Groom {
  readonly root = new THREE.Group();
  readonly strands: THREE.Mesh;
  readonly cap: THREE.Mesh | null;
  readonly material: HairMaterial;
  readonly depthMaterial: HairDepthMaterial;
  readonly capMaterial: HairCapMaterial | null;
  readonly uniforms: HairUniforms;
  readonly sim: HairSim | null;
  readonly stats: GroomStats;
  /** distance LOD: head height (px) from which every strand is drawn; below it a thicker subset */
  lodFullPx = 360;
  /** smallest fraction of strands drawn at distance */
  lodMinFraction = 0.12;
  /** fraction of the drawn strands rendered into the shadow map */
  shadowFraction = 0.45;
  /** wind response scale */
  windScale = 1;
  private readonly geo: THREE.InstancedBufferGeometry;
  private readonly count: number;
  private drawCount: number;
  private readonly jawA = new THREE.Matrix4();
  private readonly headBone: THREE.Object3D;
  private readonly jawBone: THREE.Object3D | null;
  private readonly pointsTex: THREE.DataTexture;
  private readonly wind = new THREE.Vector3();

  constructor(
    human: HumanModel,
    readonly style: GroomStyle,
    parts: {
      geo: THREE.InstancedBufferGeometry;
      uniforms: HairUniforms;
      pointsTex: THREE.DataTexture;
      sim: HairSim | null;
      cap: THREE.BufferGeometry | null;
      msaa: number;
      stats: GroomStats;
      jawA: THREE.Matrix4;
    },
  ) {
    this.root.name = `groom:${style.name}`;
    this.geo = parts.geo;
    this.count = this.drawCount = parts.geo.instanceCount;
    this.uniforms = parts.uniforms;
    this.pointsTex = parts.pointsTex;
    this.sim = parts.sim;
    this.stats = parts.stats;
    this.jawA.copy(parts.jawA);
    this.material = new HairMaterial(parts.uniforms, style.shading, parts.msaa);
    this.depthMaterial = new HairDepthMaterial(parts.uniforms);
    const mesh = new THREE.Mesh(parts.geo, this.material);
    mesh.name = 'hairStrands';
    mesh.customDepthMaterial = this.depthMaterial;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.renderOrder = 2;
    mesh.onBeforeRender = (renderer, _scene, camera) => this.beforeRender(renderer, camera);
    mesh.onBeforeShadow = (renderer) => {
      const rt = renderer.getRenderTarget();
      this.depthMaterial.shadowRes.value = rt ? rt.height : 2048;
      this.geo.instanceCount = Math.max(1, Math.round(this.drawCount * this.shadowFraction));
    };
    this.strands = mesh;
    this.root.add(mesh);
    if (parts.cap) {
      this.capMaterial = new HairCapMaterial(parts.uniforms.uJaw, parts.msaa);
      const cap = new THREE.Mesh(parts.cap, this.capMaterial);
      cap.name = 'hairCap';
      cap.receiveShadow = true;
      cap.castShadow = false;
      cap.renderOrder = 1;
      this.cap = cap;
      this.root.add(cap);
    } else {
      this.cap = null;
      this.capMaterial = null;
    }
    this.headBone = human.bones.head;
    this.jawBone = human.bones.jaw ?? null;
    this.headBone.add(this.root);
  }

  private beforeRender(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    const rt = renderer.getRenderTarget();
    const resY = rt ? rt.height : renderer.getDrawingBufferSize(_v2).y;
    this.uniforms.uResY.value = resY;
    // distance LOD: a uniform random subset (strands are shuffled), widened to keep the coverage
    let frac = 1;
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.isPerspectiveCamera) {
      _v.setFromMatrixPosition(this.root.matrixWorld);
      const dist = Math.max(0.05, _v.distanceTo(_vCam(camera)));
      const px = (0.25 * cam.projectionMatrix.elements[5] * resY) / (2 * dist);
      frac = THREE.MathUtils.clamp(px / this.lodFullPx, this.lodMinFraction, 1);
    }
    this.drawCount = Math.max(1, Math.round(this.count * frac));
    this.geo.instanceCount = this.drawCount;
    this.uniforms.uWidthScale.value = Math.pow(this.count / this.drawCount, 0.75);
  }

  /** per frame, after human.update(): guide dynamics + jaw following. wind: world air velocity (m/s) */
  update(dt: number, wind?: THREE.Vector3) {
    const H = this.headBone.matrixWorld;
    if (this.jawBone) {
      // head space: rest point rigidly attached to the jaw -> current
      _m.copy(H).invert().multiply(this.jawBone.matrixWorld).multiply(this.jawA);
      this.uniforms.uJaw.value.copy(_m);
    }
    if (this.sim && this.uniforms.uSimOn.value > 0.5) {
      this.wind.copy(wind ?? _zero).multiplyScalar(this.windScale);
      this.sim.step(dt, H, this.wind);
    }
  }

  setVisible(v: boolean) {
    this.root.visible = v;
  }

  /** switch between alpha-to-coverage (samples > 1) and dithered alpha (e.g. when the engine drops MSAA) */
  setMSAA(samples: number) {
    this.material.setMSAA(samples);
    this.capMaterial?.setMSAA(samples);
  }

  /** enable / disable the guide dynamics (disabled: the exact groom) */
  setSimulation(on: boolean) {
    this.uniforms.uSimOn.value = on && this.sim ? 1 : 0;
    if (!on) this.sim?.reset();
  }

  dispose() {
    this.root.removeFromParent();
    this.geo.dispose();
    this.cap?.geometry.dispose();
    this.material.dispose();
    this.depthMaterial.dispose();
    this.capMaterial?.dispose();
    this.pointsTex.dispose();
    this.uniforms.uSim.value?.dispose();
  }
}

const _zero = new THREE.Vector3();
const _camPos = new THREE.Vector3();
function _vCam(camera: THREE.Camera) {
  return _camPos.setFromMatrixPosition(camera.matrixWorld);
}

function resolveStyle(spec: GroomStyleSpec): { style: GroomStyle; seed: number } {
  if (spec === 'david') return { style: davidStyle(), seed: 1201 };
  if (spec === 'saul') return { style: saulStyle(), seed: 4807 };
  if (spec === 'samuel') return { style: samuelStyle(), seed: 5101 };
  if (spec.kind === 'elder') return { style: elderStyle(spec.seed), seed: 7001 + spec.seed * 97 };
  if (spec.kind === 'soldier') return { style: soldierStyle(spec.seed, spec.headband), seed: 9001 + spec.seed * 101 };
  if (spec.kind === 'philistine') return { style: philistineStyle(spec.seed), seed: 12001 + spec.seed * 89 };
  if (spec.kind === 'custom') return { style: spec.style, seed: spec.seed };
  return { style: manStyle(spec), seed: 9001 + spec.seed * 101 };
}

/** Build a groom (deterministic for a given human / style / quality). */
export async function createGroom(human: HumanModel, spec: GroomStyleSpec, opts: GroomOptions): Promise<Groom> {
  const t0 = performance.now();
  const q = opts.quality;
  if (opts.lashes !== false) enhanceLashes(human);
  const msaa = opts.msaa ?? (q === 'low' ? 0 : 4);
  const { style, seed } = resolveStyle(spec);
  const reach = style.layers.reduce((a, l) => Math.max(a, l.reach ?? 0.22), 0.22);
  const S = new HeadSurface(human, q === 'low' ? 0.008 : 0.006, reach);
  const t1 = performance.now();
  // let the loading screen breathe between the heavy steps
  await Promise.resolve();
  let headband: Headband | null = opts.headband ?? null;
  if (!headband && style.headband) headband = { height: 0, radius: [S.crownRadius[0] + 0.004, S.crownRadius[1] + 0.004] };
  const density = opts.density ?? 1;
  const layers: LayerBuild[] = style.layers.map((st, i) => ({
    style: st,
    count: Math.max(8, Math.round(st.strands[q] * density)),
    simCount: opts.simulate === false ? 0 : st.sim[q],
    widthScale: style.widthTier[q] / Math.sqrt(density),
    seed: seed + i * 7919,
  }));
  const K = style.ctrl[q];
  const segs = style.segs[q];
  const set = growStrands(S, layers, K, headband);
  const t2 = performance.now();
  // ---- rest character space -> head bone space
  const toRest = new THREE.Matrix4().compose(S.headRestPos, S.headRestQuat, new THREE.Vector3(1, 1, 1));
  const fromRest = toRest.clone().invert();
  const e = fromRest.elements;
  const xf = (a: Float32Array, stride: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const o = i * stride;
      const x = a[o], y = a[o + 1], z = a[o + 2];
      a[o] = e[0] * x + e[4] * y + e[8] * z + e[12];
      a[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      a[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    }
  };
  xf(set.pts, 4, set.n * K);
  xf(set.simGuides, 3, set.G * K);
  // ---- control point texture (K texels per strand, rows of `spr` strands)
  const spr = Math.max(1, Math.floor(2048 / K));
  const texW = spr * K, texH = Math.max(1, Math.ceil(set.n / spr));
  const texData = new Float32Array(texW * texH * 4);
  for (let s = 0; s < set.n; s++) {
    const row = Math.floor(s / spr), col = (s % spr) * K;
    texData.set(set.pts.subarray(s * K * 4, (s + 1) * K * 4), (row * texW + col) * 4);
  }
  const pointsTex = new THREE.DataTexture(texData, texW, texH, THREE.RGBAFormat, THREE.FloatType);
  pointsTex.minFilter = pointsTex.magFilter = THREE.NearestFilter;
  pointsTex.generateMipmaps = false;
  pointsTex.needsUpdate = true;
  pointsTex.userData.keepSize = true;
  // ---- ribbon template + per-strand instance data
  const geo = new THREE.InstancedBufferGeometry();
  const nv = (segs + 1) * 2;
  const tpl = new Float32Array(nv * 2);
  for (let i = 0; i <= segs; i++) {
    tpl[i * 4] = i / segs;
    tpl[i * 4 + 1] = -1;
    tpl[i * 4 + 2] = i / segs;
    tpl[i * 4 + 3] = 1;
  }
  const idx: number[] = [];
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  geo.setAttribute('aTpl', new THREE.BufferAttribute(tpl, 2));
  geo.setAttribute('aA', new THREE.InstancedBufferAttribute(set.a.subarray(0, set.n * 4), 4));
  geo.setAttribute('aB', new THREE.InstancedBufferAttribute(set.b.subarray(0, set.n * 4), 4));
  geo.setAttribute('aRootCol', new THREE.InstancedBufferAttribute(set.rootCol.subarray(0, set.n * 3), 3));
  geo.setAttribute('aTipCol', new THREE.InstancedBufferAttribute(set.tipCol.subarray(0, set.n * 3), 3));
  geo.instanceCount = set.n;
  // bounds (head space)
  const box = new THREE.Box3();
  for (let i = 0; i < set.n * K; i++) box.expandByPoint(_v.fromArray(set.pts, i * 4));
  geo.boundingBox = box.clone().expandByScalar(0.06);
  geo.boundingSphere = geo.boundingBox.getBoundingSphere(new THREE.Sphere());
  // ---- uniforms
  const U = createHairUniforms();
  U.uPoints.value = pointsTex;
  U.uK.value = K;
  U.uSpr.value = spr;
  U.uTaper.value = 0.3;
  U.uVolC.value.copy(S.E).add(new THREE.Vector3(0, 0.03, -0.035)).applyMatrix4(fromRest);
  U.uVolR.value.set(0.085, 0.1, 0.105);
  U.uBeardC.value.copy(S.chin).add(new THREE.Vector3(0, 0.04, -0.06)).applyMatrix4(fromRest);
  U.uBeardR.value.set(0.06, 0.075, 0.07);
  // ---- simulation
  let sim: HairSim | null = null;
  if (set.G > 0) {
    sim = new HairSim(set.simGuides, K, set.G, set.simStiff, S.sdf, toRest, fromRest);
    U.uSim.value = sim.tex;
    U.uSimOn.value = 1;
  } else {
    const t = new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType);
    t.needsUpdate = true;
    U.uSim.value = t;
  }
  // ---- cap
  const cap = buildCap(S, style, fromRest);
  // jaw: head-space rest point -> rest character -> jaw rest local
  const jawRest = new THREE.Matrix4().compose(S.jawRestPos, S.jawRestQuat, new THREE.Vector3(1, 1, 1));
  const jawA = jawRest.invert().multiply(toRest);
  const stats: GroomStats = {
    strands: set.n,
    ctrlPoints: K,
    segments: segs,
    simGuides: set.G,
    trianglesFull: set.n * segs * 2,
    capTriangles: cap ? cap.getIndex()!.count / 3 : 0,
    gpuBytes: texData.byteLength + set.n * 56 + nv * 20 + (cap ? cap.getAttribute('position').count * 48 : 0),
    buildMs: 0,
    timings: { surface: t1 - t0, grow: t2 - t1, finish: 0 },
    layers: set.diag,
  };
  const groom = new Groom(human, style, { geo, uniforms: U, pointsTex, sim, cap, msaa, stats, jawA });
  stats.buildMs = performance.now() - t0;
  stats.timings.finish = performance.now() - t2;
  return groom;
}

function buildCap(S: HeadSurface, style: GroomStyle, fromRest: THREE.Matrix4): THREE.BufferGeometry | null {
  const scalp = S.scalpMask();
  const beard = style.capBeard ? S.beardMask() : null;
  const nv = S.region.length;
  const m = new Float32Array(nv);
  for (let v = 0; v < nv; v++) m[v] = Math.max(scalp[v], beard ? beard[v] * style.capBeard : 0);
  const T = S.tris;
  const remap = new Int32Array(nv).fill(-1);
  const verts: number[] = [];
  const tris: number[] = [];
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t], b = T[t + 1], c = T[t + 2];
    if (m[a] < 0.02 && m[b] < 0.02 && m[c] < 0.02) continue;
    for (const v of [a, b, c]) {
      if (remap[v] < 0) {
        remap[v] = verts.length;
        verts.push(v);
      }
      tris.push(remap[v]);
    }
  }
  if (!tris.length) return null;
  const n = verts.length;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 4), jaw = new Float32Array(n);
  const base = new THREE.Color().setRGB(style.capColor[0], style.capColor[1], style.capColor[2], THREE.SRGBColorSpace);
  const nm = new THREE.Matrix3().setFromMatrix4(fromRest);
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  const R = rng(77);
  verts.forEach((v, i) => {
    const mv = m[v];
    const isBeard = beard !== null && beard[v] * style.capBeard > scalp[v];
    p.fromArray(S.pos, v * 3);
    q.fromArray(S.nrm, v * 3);
    const off = style.capOffset * (isBeard ? 0.5 : 1) * (0.3 + 0.7 * ss(0.0, 0.7, mv));
    p.addScaledVector(q, off + 0.0008).applyMatrix4(fromRest);
    p.toArray(pos, i * 3);
    q.applyMatrix3(nm).normalize().toArray(nrm, i * 3);
    const k = capNoise(S.pos[v * 3], S.pos[v * 3 + 1], S.pos[v * 3 + 2]) * (0.9 + 0.2 * R()) * (isBeard ? 1.35 : 1);
    col[i * 4] = base.r * k;
    col[i * 4 + 1] = base.g * k;
    col[i * 4 + 2] = base.b * k;
    col[i * 4 + 3] = isBeard ? ss(0.25, 0.95, mv) * 0.8 : ss(0.06, 0.5, mv);
    jaw[i] = S.jaw[v];
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  g.setAttribute('aJaw', new THREE.BufferAttribute(jaw, 1));
  g.setIndex(n < 65536 ? new THREE.BufferAttribute(Uint16Array.from(tris), 1) : new THREE.BufferAttribute(Uint32Array.from(tris), 1));
  g.computeBoundingSphere();
  return g;
}
