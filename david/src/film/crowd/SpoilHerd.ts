/*
 * SpoilHerd — the flocks and herds Saul's army drives to Gilgal (1 Sam 15:9, 15:15, 15:21; docs/visual-bible.md §3.5):
 * fat-tailed sheep (Awassi type: cream wool, brown/black head, drooping ears, the fat tail — Exod 29:22 הָאַלְיָה, §3.14),
 * black long-haired goats, and small humpless cattle (brown, red-brown, black, fawn). NO camels (15:3, 15:9), no Agag.
 * BACKGROUND ONLY (§3.5): they walk beside / behind the column at 15-45 m from the road on its north side, raise dust,
 * and stand grazing when the army halts; they are never framed as a subject.
 *
 * Low-poly instanced animals built from primitives at load (no assets), one draw call per kind, with a procedural walk
 * in the vertex shader (legs swing about the hips, head bobs; halted = head down, grazing). Per instance: position, yaw,
 * size, gait phase, stride (0 = standing), colour seed.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CrowdTier } from './Crowd';

export type HerdKind = 'sheep' | 'goat' | 'cattle';

// part ids: 0 body, 1 head/neck, 2 leg FL, 3 leg FR, 4 leg BL, 5 leg BR, 6 tail / fat tail, 7 ears / horns
function part(g: THREE.BufferGeometry, id: number, pivot: THREE.Vector3, color: THREE.Color) {
  g.deleteAttribute('uv');
  const n = g.getAttribute('position').count;
  const pa = new Float32Array(n), pv = new Float32Array(n * 3), co = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pa[i] = id;
    pv[i * 3] = pivot.x; pv[i * 3 + 1] = pivot.y; pv[i * 3 + 2] = pivot.z;
    co[i * 3] = color.r; co[i * 3 + 1] = color.g; co[i * 3 + 2] = color.b;
  }
  g.setAttribute('aPart', new THREE.BufferAttribute(pa, 1));
  g.setAttribute('aPivot', new THREE.BufferAttribute(pv, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(co, 3));
  return g;
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const ell = (rx: number, ry: number, rz: number, x: number, y: number, z: number, ws = 10, hs = 7) =>
  new THREE.SphereGeometry(1, ws, hs).scale(rx, ry, rz).translate(x, y, z);
const leg = (r0: number, r1: number, len: number, x: number, top: number, z: number) =>
  new THREE.CylinderGeometry(r0, r1, len, 6, 1).translate(x, top - len / 2, z);

/** forward = +Z, feet at y = 0; colours are placeholders multiplied per instance (1 = wool / hide, 0.5 = dark parts) */
function buildKind(kind: HerdKind): THREE.BufferGeometry {
  const P: THREE.BufferGeometry[] = [];
  const W = new THREE.Color(1, 1, 1), D = new THREE.Color(0.5, 0.5, 0.5), H = new THREE.Color(0.25, 0.25, 0.25);
  if (kind === 'sheep') {
    const top = 0.46;
    P.push(part(ell(0.25, 0.26, 0.45, 0, 0.64, 0), 0, V(0, 0, 0), W));
    // the fat tail: a broad pad hanging at the rump (Awassi)
    P.push(part(ell(0.17, 0.2, 0.1, 0, 0.5, -0.45), 6, V(0, 0.62, -0.42), W));
    P.push(part(ell(0.09, 0.11, 0.17, 0, 0.8, 0.52).rotateX(0), 1, V(0, 0.72, 0.36), D));
    P.push(part(ell(0.035, 0.1, 0.02, 0.09, 0.78, 0.5), 7, V(0, 0.72, 0.36), D));
    P.push(part(ell(0.035, 0.1, 0.02, -0.09, 0.78, 0.5), 7, V(0, 0.72, 0.36), D));
    P.push(part(leg(0.035, 0.025, top, 0.12, top, 0.28), 2, V(0.12, top, 0.28), D));
    P.push(part(leg(0.035, 0.025, top, -0.12, top, 0.28), 3, V(-0.12, top, 0.28), D));
    P.push(part(leg(0.04, 0.025, top, 0.12, top, -0.28), 4, V(0.12, top, -0.28), D));
    P.push(part(leg(0.04, 0.025, top, -0.12, top, -0.28), 5, V(-0.12, top, -0.28), D));
  } else if (kind === 'goat') {
    const top = 0.5;
    P.push(part(ell(0.19, 0.24, 0.42, 0, 0.68, 0), 0, V(0, 0, 0), W));
    // long hair hanging under the belly (the black goats of Song 4:1)
    P.push(part(ell(0.2, 0.12, 0.38, 0, 0.5, 0), 0, V(0, 0, 0), W));
    P.push(part(ell(0.08, 0.1, 0.16, 0, 0.9, 0.5), 1, V(0, 0.8, 0.36), W));
    P.push(part(new THREE.ConeGeometry(0.025, 0.2, 5).rotateX(-0.6).translate(0.05, 1.03, 0.44), 7, V(0, 0.8, 0.36), H));
    P.push(part(new THREE.ConeGeometry(0.025, 0.2, 5).rotateX(-0.6).translate(-0.05, 1.03, 0.44), 7, V(0, 0.8, 0.36), H));
    P.push(part(new THREE.ConeGeometry(0.03, 0.1, 5).rotateX(Math.PI).translate(0, 0.76, 0.58), 1, V(0, 0.8, 0.36), W));
    P.push(part(leg(0.03, 0.022, top, 0.1, top, 0.26), 2, V(0.1, top, 0.26), W));
    P.push(part(leg(0.03, 0.022, top, -0.1, top, 0.26), 3, V(-0.1, top, 0.26), W));
    P.push(part(leg(0.03, 0.022, top, 0.1, top, -0.26), 4, V(0.1, top, -0.26), W));
    P.push(part(leg(0.03, 0.022, top, -0.1, top, -0.26), 5, V(-0.1, top, -0.26), W));
    P.push(part(ell(0.03, 0.08, 0.03, 0, 0.84, -0.42), 6, V(0, 0.84, -0.4), W));
  } else {
    // small humpless cattle of the Iron Age Levant (~1.1-1.2 m at the withers)
    const top = 0.66;
    P.push(part(ell(0.3, 0.33, 0.72, 0, 0.98, 0), 0, V(0, 0, 0), W));
    P.push(part(ell(0.13, 0.15, 0.26, 0, 1.06, 0.78), 1, V(0, 1.02, 0.55), W));
    P.push(part(ell(0.1, 0.1, 0.12, 0, 0.98, 0.98), 1, V(0, 1.02, 0.55), D));
    P.push(part(new THREE.ConeGeometry(0.03, 0.2, 5).rotateZ(-1.1).translate(0.16, 1.2, 0.8), 7, V(0, 1.02, 0.55), new THREE.Color(0.36, 0.33, 0.27)));
    P.push(part(new THREE.ConeGeometry(0.03, 0.2, 5).rotateZ(1.1).translate(-0.16, 1.2, 0.8), 7, V(0, 1.02, 0.55), new THREE.Color(0.36, 0.33, 0.27)));
    P.push(part(leg(0.06, 0.04, top, 0.17, top, 0.45), 2, V(0.17, top, 0.45), W));
    P.push(part(leg(0.06, 0.04, top, -0.17, top, 0.45), 3, V(-0.17, top, 0.45), W));
    P.push(part(leg(0.07, 0.04, top, 0.17, top, -0.48), 4, V(0.17, top, -0.48), W));
    P.push(part(leg(0.07, 0.04, top, -0.17, top, -0.48), 5, V(-0.17, top, -0.48), W));
    P.push(part(new THREE.CylinderGeometry(0.02, 0.015, 0.7, 4, 1).translate(0, 0.72, -0.74), 6, V(0, 1.05, -0.72), W));
  }
  const g = mergeGeometries(P.map((p) => p.toNonIndexed()), false)!;
  P.forEach((p) => p.dispose());
  g.computeVertexNormals();
  return g;
}

const VERT = /* glsl */ `
attribute float aPart;
attribute vec3 aPivot;
attribute vec3 aCol;
attribute vec4 iPose;  // x, y, z (feet), yaw
attribute vec4 iVar;   // size, gait phase (rad), stride 0..1 (0 = standing, grazing), colour seed
uniform vec3 uHide[4];
varying vec3 vHerdCol;
vec3 hdPos;
vec3 hdNrm;
vec3 hdRotX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z); }
void herdCompute() {
  vec3 p = position, n = normal;
  int pt = int(aPart + 0.5);
  float ph = iVar.y, st = iVar.z;
  if (pt >= 2 && pt <= 5) {
    // walk: diagonal pairs swing together (FL with BR)
    float a = sin(ph + ((pt == 2 || pt == 5) ? 0.0 : 3.14159)) * 0.45 * st;
    p = aPivot + hdRotX(p - aPivot, a);
    n = hdRotX(n, a);
  } else if (pt == 1 || pt == 7) {
    // the head bobs with the gait; standing animals graze (head down to the ground)
    float a = mix(0.9 + 0.15 * sin(ph * 0.3 + iVar.w * 20.0), sin(ph * 2.0) * 0.08, st);
    p = aPivot + hdRotX(p - aPivot, a);
    n = hdRotX(n, a);
  } else if (pt == 6) {
    float a = sin(ph * 2.0 + 1.0) * 0.15 + 0.1;
    p = aPivot + hdRotX(p - aPivot, a);
  }
  p.y += abs(sin(ph)) * 0.02 * st;
  p *= iVar.x;
  float cy = cos(iPose.w), sy = sin(iPose.w);
  hdPos = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z) + iPose.xyz;
  hdNrm = vec3(cy * n.x + sy * n.z, n.y, -sy * n.x + cy * n.z);
  // colours: aCol 1 = wool / hide, 0.5 = dark parts, 0.25 = horn
  vec4 h = fract(sin(vec4(iVar.w * 127.1, iVar.w * 311.7, iVar.w * 74.7, iVar.w * 269.5)) * 43758.5453);
  vec3 main = uHide[int(h.x * 3.999)] * (0.88 + 0.24 * h.y);
  vec3 dark = uHide[3] * (0.8 + 0.4 * h.z);
  vHerdCol = aCol.r > 0.9 ? main : aCol.r > 0.4 ? dark : aCol;
  // dust on the legs and belly
  vHerdCol = mix(vHerdCol, vec3(0.6, 0.52, 0.4), clamp((0.45 - position.y) * 1.6, 0.0, 0.5));
}
`;

function herdMaterial(hide: THREE.Color[]) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  const u = { uHide: { value: hide } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT)
      .replace('#include <beginnormal_vertex>', 'herdCompute();\nvec3 objectNormal = hdNrm;')
      .replace('#include <begin_vertex>', 'vec3 transformed = hdPos;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHerdCol;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vHerdCol;');
  };
  m.customProgramCacheKey = () => 'spoilHerd';
  return m;
}

// hides (linear via THREE.Color from sRGB hex): 3 main coats + the dark parts
const HIDES: Record<HerdKind, number[]> = {
  sheep: [0xd6c9aa, 0xcbbd9a, 0xbfae8a, 0x3a2a1e], // Awassi: cream wool, brown/black head and legs (§3.14)
  goat: [0x1d1916, 0x26201a, 0x3a3029, 0x151210], // black long-haired goats
  cattle: [0x6b4a31, 0x8a5a36, 0x3a2c24, 0x2a211b], // brown, red-brown, black-brown
};

interface Beast { kind: number; i: number; lat: number; back: number; phase: number; pace: number; size: number; yaw: number; x: number; z: number; gy: number; gx: number; gz: number }

export interface SpoilHerdOptions {
  tier: CrowdTier;
  ground?: (x: number, z: number) => number;
  /** number of animals (default desktop-high 150, desktop-medium 100, mobile-high 60, mobile-low 36) */
  count?: number;
}

/**
 * The spoil herds beside Saul's column at Gilgal. Drive it with the same beat as the army:
 *   herd.update(dt, frontX, walking, roadZ)   (frontX = armyAt(...).frontX; walking = armyAt(...).walk > 0)
 */
export class SpoilHerd {
  readonly group = new THREE.Group();
  private readonly meshes: THREE.Mesh[] = [];
  private readonly beasts: Beast[] = [];
  private readonly bufs: { pose: Float32Array; vari: Float32Array; attrs: THREE.InstancedBufferAttribute[] }[] = [];
  private readonly ground: (x: number, z: number) => number;
  private readonly mats: THREE.Material[] = [];

  constructor(o: SpoilHerdOptions) {
    this.ground = o.ground ?? (() => 0);
    const count = o.count ?? (o.tier === 'mobile-low' ? 36 : o.tier === 'mobile-high' ? 60 : o.tier === 'desktop-medium' ? 100 : 150);
    this.group.name = 'crowd:spoilHerd';
    // mix: ~55 % sheep, ~15 % goats, ~30 % cattle, in separate droves (flock and herd are driven apart)
    const kinds: HerdKind[] = ['sheep', 'goat', 'cattle'];
    const nk = [Math.round(count * 0.55), Math.round(count * 0.15), 0];
    nk[2] = count - nk[0] - nk[1];
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    kinds.forEach((k, ki) => {
      const g0 = buildKind(k);
      const g = new THREE.InstancedBufferGeometry();
      for (const name of Object.keys(g0.attributes)) g.setAttribute(name, g0.getAttribute(name));
      const n = nk[ki];
      const pose = new Float32Array(n * 4), vari = new Float32Array(n * 4);
      const attrs = [new THREE.InstancedBufferAttribute(pose, 4), new THREE.InstancedBufferAttribute(vari, 4)];
      attrs.forEach((a) => a.setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('iPose', attrs[0]);
      g.setAttribute('iVar', attrs[1]);
      g.instanceCount = n;
      this.bufs.push({ pose, vari, attrs });
      const mat = herdMaterial(HIDES[k].map((h) => new THREE.Color(h)));
      this.mats.push(mat);
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      mesh.castShadow = o.tier !== 'mobile-low';
      mesh.receiveShadow = true;
      mesh.name = `crowd:herd:${k}`;
      this.meshes.push(mesh);
      this.group.add(mesh);
      // droves on the north side of the road, behind the head of the column: sheep nearest the army, cattle outside
      const lat0 = k === 'sheep' ? 17 : k === 'goat' ? 22 : 31;
      const back0 = k === 'sheep' ? 40 : k === 'goat' ? 62 : 52;
      const len = k === 'cattle' ? 70 : 55;
      for (let i = 0; i < n; i++) {
        const u = rnd(), v = rnd();
        this.beasts.push({
          kind: ki, i, lat: lat0 + v * v * (k === 'cattle' ? 14 : 10), back: back0 + u * len, phase: rnd() * 6.28, pace: 0.9 + rnd() * 0.2,
          size: (k === 'cattle' ? 0.92 : 0.88) + rnd() * 0.22, yaw: Math.PI / 2 + (rnd() - 0.5) * 0.5, x: 0, z: 0, gy: 0, gx: 1e9, gz: 1e9,
        });
        vari[i * 4 + 3] = rnd();
      }
    });
  }

  /**
   * frontX: x of the king at the head of the column (armyAt().frontX); walking: the army marches; roadZ: the set's road
   * centre line (gilgalLayout.roadZ). dt in action time (the army's slow motion applies).
   */
  update(dt: number, frontX: number, walking: boolean, roadZ: (x: number) => number) {
    for (const b of this.beasts) {
      const B = this.bufs[b.kind];
      const o = b.i * 4;
      const stride = walking ? 1 : 0;
      b.phase += dt * (walking ? 5.2 * b.pace : 0.35);
      const x = frontX - b.back + Math.sin(b.phase * 0.05 + b.i) * 0.6;
      const z = roadZ(x) - b.lat + Math.sin(b.phase * 0.037 + b.i * 1.7) * 0.8;
      if (Math.abs(x - b.gx) + Math.abs(z - b.gz) > 0.3) {
        b.gx = x;
        b.gz = z;
        b.gy = this.ground(x, z);
      }
      B.pose[o] = x; B.pose[o + 1] = b.gy; B.pose[o + 2] = z; B.pose[o + 3] = walking ? Math.PI / 2 + (b.yaw - Math.PI / 2) * 0.3 : b.yaw * 1.7 + b.i;
      B.vari[o] = b.size; B.vari[o + 1] = b.phase; B.vari[o + 2] = stride;
    }
    for (const B of this.bufs) for (const a of B.attrs) a.needsUpdate = true;
  }

  get triangles() {
    return this.meshes.reduce((s, m) => s + (m.geometry.getAttribute('position').count / 3) * (m.geometry as THREE.InstancedBufferGeometry).instanceCount, 0);
  }

  dispose() {
    for (const m of this.meshes) m.geometry.dispose();
    for (const m of this.mats) m.dispose();
    this.group.removeFromParent();
  }
}
