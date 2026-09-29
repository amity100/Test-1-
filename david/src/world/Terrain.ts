import * as THREE from 'three';
import { Simplex2, clamp, distToPolyline, lerp, smoothstep } from '../core/noise';
import { GLSL_NOISE, shared } from '../core/Shared';
import { FAR_HALF, LAYOUT, NEAR_HALF } from './Layout';
import type { TextureSet } from './Textures';
import { worldTier, type WorldTier } from './WorldQuality';
import { GLSL_SHADOW_FRAME, worldShared } from './WorldShared';

const N1 = new Simplex2(1337);
const N2 = new Simplex2(4242);
const N3 = new Simplex2(99);

/** Output of the analytic height function (module-level scratch to avoid allocations). */
export const sampleOut = { h: 0, terrace: 0, rock: 0, wadi: 0, path: 0, pre: 0 };

/** Height difference between two agricultural terraces (m). */
export const TERRACE_STEP = 1.9;

let plateauH = 0;

function regional(x: number, z: number): number {
  let h =
    26 * N1.fbm(x / 700, z / 700, 4) +
    12 * N1.fbm(x / 260 + 11, z / 260 - 7, 4) +
    3.2 * N2.fbm(x / 80, z / 80, 3) +
    9 * (N2.ridged(x / 520, z / 520, 3) - 0.45);
  // Dendritic valley network (wadis) and sharper ridges away from the play area
  const far = smoothstep(260, 900, Math.hypot(x, z));
  if (far > 0) {
    const v1 = 1 - smoothstep(0.0, 0.16, Math.abs(N3.fbm(x / 700 + 7, z / 700 - 3, 4)));
    const v2 = 1 - smoothstep(0.0, 0.12, Math.abs(N1.fbm(x / 330 - 2, z / 330 + 5, 3)));
    h -= far * (34 * v1 + 14 * v2);
    h += far * 22 * (N2.ridged(x / 800 + 3, z / 800, 4) - 0.4);
  }
  // The ridge of Bethlehem (town on its crest)
  const dv = Math.hypot(x - LAYOUT.bethlehem.x, z - LAYOUT.bethlehem.z);
  h += 44 * Math.exp(-((dv / 270) ** 2));
  // Gentle rise where the young shepherd stands above his pasture
  const ds2 = x * x + z * z;
  h += 3.4 * Math.exp(-ds2 / (2 * 13 * 13));
  // Land falls away eastward into the Judean desert, Dead Sea and the mountains of Moab
  const east = smoothstep(260, 3900, x);
  h -= east * 330;
  const desert = east * (1 - smoothstep(3800, 4300, x));
  h += desert * 70 * (N3.ridged(x / 620, z / 380, 5) - 0.42);
  const sea = smoothstep(3950, 4350, x) * (1 - smoothstep(5250, 5650, x));
  h = lerp(h, -352, sea);
  const moab = smoothstep(5350, 6400, x);
  h = lerp(h, 170 + 110 * N3.ridged(z / 1100, x / 900, 4) + 40 * N1.fbm(z / 300, x / 300, 3), moab);
  // Higher hill country to the south (Hebron hills) and west
  h += smoothstep(700, 4200, z) * 90 * (0.6 + 0.4 * N2.fbm(x / 900, z / 900, 3));
  h += smoothstep(-500, -4500, x) * 60 * (0.6 + 0.4 * N1.fbm(x / 800, z / 800 + 3, 3));
  return h;
}

export function initHeightModel() {
  plateauH = regional(LAYOUT.bethlehem.x, LAYOUT.bethlehem.z) + 1.5;
}

/** Terrace profile: flat treads (rising 10 % of a step) and a steep riser in the last 14 % of each step. */
function terraceProfile(h: number) {
  const t = h / TERRACE_STEP;
  const f = t - Math.floor(t);
  return (Math.floor(t) + 0.1 * f + 0.9 * smoothstep(0.86, 1.0, f)) * TERRACE_STEP;
}

/** Full analytic terrain height + masks at (x,z). Result is written to `sampleOut`. */
export function sampleTerrain(x: number, z: number) {
  let h = regional(x, z);
  const L = LAYOUT;
  const dv = Math.hypot(x - L.bethlehem.x, z - L.bethlehem.z);
  const dStart = Math.hypot(x - L.start.x, z - L.start.z);
  const dPasture = Math.hypot(x - L.pasture.x, z - L.pasture.z);
  const dThicket = Math.hypot(x - L.thicket.x, z - L.thicket.z);

  // Flatten the town plateau
  const plateau = smoothstep(L.bethlehem.r + 55, L.bethlehem.r - 5, dv);
  // ...into a low tell: the town has grown up over its own ruins, so the houses step up toward the crest and
  // show above the town wall from the fields below
  const tell = Math.max(0, 1 - (dv * dv) / ((L.bethlehem.r - 6) * (L.bethlehem.r - 6)));
  h = lerp(h, plateauH + 0.9 * N2.noise(x / 26, z / 26) + 7 * tell * tell * (3 - 2 * tell), plateau);

  // Wadi + path distances (only meaningful near the play area)
  let wadiD = 999;
  let pathD = 999;
  if (Math.abs(x) < 900 && Math.abs(z) < 900) {
    wadiD = distToPolyline(x, z, L.wadi).d + N1.noise(x / 40, z / 40) * 3.5;
    pathD = distToPolyline(x, z, L.path).d + N2.noise(x / 12, z / 12) * 0.6;
  }

  // Agricultural terraces (מַדְרֵגוֹת) on the slopes around the town and on the hills
  let T =
    smoothstep(L.bethlehem.r + 8, L.bethlehem.r + 40, dv) * (1 - smoothstep(L.bethlehem.r + 200, L.bethlehem.r + 330, dv)) +
    smoothstep(0.12, 0.34, N3.fbm(x / 260 - 4, z / 260 + 8, 3)) * 0.85;
  T = clamp(T, 0, 1);
  T *= smoothstep(42, 80, dStart) * smoothstep(30, 55, dPasture) * smoothstep(40, 70, dThicket);
  T *= smoothstep(12, 34, wadiD) * smoothstep(3, 8, pathD);
  T *= 1 - smoothstep(1500, 2600, Math.hypot(x, z));
  const pre = h;
  if (T > 0.001) {
    // terraces are built where the slope needs them: fade out on nearly flat ground
    const e = 3;
    const gx = regional(x + e, z) - regional(x - e, z);
    const gz = regional(x, z + e) - regional(x, z - e);
    const grad = Math.hypot(gx, gz) / (2 * e) * (1 - plateau);
    T *= smoothstep(0.045, 0.11, grad);
    if (T > 0.001) h = lerp(h, terraceProfile(h), T);
  }

  // Carve the dry wadi (stream bed)
  if (wadiD < 40) {
    const carve = 7.5 * Math.pow(1 - smoothstep(4.5, 30, wadiD), 1.35);
    h -= carve;
    h += (1 - smoothstep(0, 5, wadiD)) * 0.25 * N1.noise(x / 3, z / 3);
  }
  const wadi = 1 - smoothstep(4.5, 9, wadiD);
  const path = 1 - smoothstep(0.7, 2.1, pathD);
  h -= path * 0.1;

  // hillside micro-relief: soil creep, rills and bedrock swells break up the smooth "dune" slopes.
  // Kept away from the places where the story happens (lookout, pasture, stones, jars, path).
  const dStones = Math.hypot(x - L.stones.x, z - L.stones.z);
  const dTargets = Math.hypot(x - L.targets.x, z - L.targets.z);
  const relief = smoothstep(16, 34, dStart) * smoothstep(L.pasture.r + 4, L.pasture.r + 22, dPasture) *
    smoothstep(14, 26, dStones) * smoothstep(10, 22, dTargets) * smoothstep(3, 9, pathD) * (1 - plateau) * smoothstep(6, 16, wadiD);
  if (relief > 0.001) {
    const rill = 1 - Math.abs(N3.noise(x / 26 + 5, z / 11 - 2));
    // (gentle: at a 13 deg sun, metre-high 20 m swells read as moguls / sand dunes)
    h += relief * (1 - T * 0.75) * (0.5 * N1.fbm(x / 34 + 4, z / 34 - 6, 3) + 0.16 * N2.noise(x / 6.5, z / 6.5) - 0.3 * rill * rill * rill);
  }

  // Limestone outcrops (bedrock breaking through the thin soil)
  let R = smoothstep(0.2, 0.5, N2.fbm(x / 55 + 3, z / 55 - 9, 4)) * 0.85;
  R += Math.exp(-(dStart * dStart) / (2 * 7 * 7)) * 0.95;
  R *= (1 - T * 0.65) * (1 - path) * (1 - plateau * 0.8);
  R *= smoothstep(8, 16, dPasture) * 0.8 + 0.2;
  R = clamp(R, 0, 1);
  h += R * 1.1 * (N1.ridged(x / 6.5, z / 6.5, 3) - 0.3);

  sampleOut.h = h;
  sampleOut.terrace = T;
  sampleOut.rock = R;
  sampleOut.wadi = wadi;
  sampleOut.path = path;
  sampleOut.pre = pre;
  return sampleOut;
}

export function heightAnalytic(x: number, z: number) {
  return sampleTerrain(x, z).h;
}

// --------------------------------------------------------------------------------------------
export interface TerrainQuality {
  nearSpacing: number;
  farSegments: number;
  /** optional content tier ('low' | 'medium' | 'high'); inferred from nearSpacing when absent */
  name?: string;
}

/** A static object whose long golden-hour shadow is baked into the ground beyond the shadow map. */
export interface ShadowCaster {
  x: number;
  z: number;
  /** half width of the shadow (m) */
  r: number;
  /** bottom / top height of the occluder above the ground (m) */
  h0: number;
  h1: number;
  /** opacity 0..1 (foliage lets light through) */
  k: number;
  /** extra ambient occlusion disc radius under the object (m, 0 = none) */
  ao?: number;
}

export class Terrain {
  readonly group = new THREE.Group();
  readonly nearN: number;
  readonly nearSpacing: number;
  readonly heights: Float32Array; // near grid heights
  readonly masks: Float32Array; // near grid masks (terrace, rock, wadi, path)
  /** near grid: height before terracing (lets walls follow the exact contour of each step) */
  readonly preHeights: Float32Array;
  readonly grassDensity: Float32Array;
  readonly farN: number;
  readonly farHeights: Float32Array;
  readonly heightTexture: THREE.DataTexture; // RG32F: height, grass density
  /** baked long shadows (R) and contact occlusion (G) of static objects over the near area */
  readonly shadowTexture: THREE.DataTexture;
  readonly tier: WorldTier;
  material!: THREE.MeshStandardMaterial;
  private nearGeo!: THREE.BufferGeometry;
  private farGeo!: THREE.BufferGeometry;
  private shadowData: Uint8Array;
  private shadowN: number;

  constructor(q: TerrainQuality) {
    this.tier = worldTier(q);
    initHeightModel();
    this.nearSpacing = q.nearSpacing;
    this.nearN = Math.floor((NEAR_HALF * 2) / q.nearSpacing) + 1;
    const n = this.nearN;
    this.heights = new Float32Array(n * n);
    this.preHeights = new Float32Array(n * n);
    this.masks = new Float32Array(n * n * 4);
    this.grassDensity = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      const z = -NEAR_HALF + j * q.nearSpacing;
      for (let i = 0; i < n; i++) {
        const x = -NEAR_HALF + i * q.nearSpacing;
        const s = sampleTerrain(x, z);
        const k = j * n + i;
        this.heights[k] = s.h;
        this.preHeights[k] = s.pre;
        this.masks[k * 4] = s.terrace;
        this.masks[k * 4 + 1] = s.rock;
        this.masks[k * 4 + 2] = s.wadi;
        this.masks[k * 4 + 3] = s.path;
      }
    }
    this.farN = q.farSegments + 1;
    this.farHeights = new Float32Array(this.farN * this.farN);
    const fs = (FAR_HALF * 2) / q.farSegments;
    for (let j = 0; j < this.farN; j++) {
      for (let i = 0; i < this.farN; i++) {
        const x = -FAR_HALF + i * fs;
        const z = -FAR_HALF + j * fs;
        this.farHeights[j * this.farN + i] = regionalOrFull(x, z);
      }
    }
    // grass density
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const slope = this.slopeAtGrid(i, j);
        const m = k * 4;
        const x = -NEAR_HALF + i * q.nearSpacing;
        const z = -NEAR_HALF + j * q.nearSpacing;
        const riser = this.masks[m] * smoothstep(0.3, 0.55, slope);
        let d = (1 - this.masks[m + 1] * 0.9) * (1 - this.masks[m + 2]) * (1 - this.masks[m + 3]) * (1 - riser);
        d *= 1 - smoothstep(0.55, 0.85, slope);
        d *= smoothstep(-0.45, 0.3, N3.noise(x / 16, z / 16) * 0.65 + N1.noise(x / 4.5, z / 4.5) * 0.35);
        const dv = Math.hypot(x - LAYOUT.bethlehem.x, z - LAYOUT.bethlehem.z);
        d *= smoothstep(LAYOUT.bethlehem.r - 10, LAYOUT.bethlehem.r + 30, dv) * 0.92 + 0.08; // trampled lanes in town
        this.grassDensity[k] = clamp(d, 0, 1);
      }
    }
    const tex = new Float32Array(n * n * 2);
    for (let k = 0; k < n * n; k++) {
      tex[k * 2] = this.heights[k];
      tex[k * 2 + 1] = this.grassDensity[k];
    }
    this.heightTexture = new THREE.DataTexture(tex, n, n, THREE.RGFormat, THREE.FloatType);
    this.heightTexture.minFilter = THREE.NearestFilter;
    this.heightTexture.magFilter = THREE.NearestFilter;
    this.heightTexture.needsUpdate = true;

    this.shadowN = this.tier === 'low' ? 512 : 1024;
    const shadowData = new Uint8Array(this.shadowN * this.shadowN * 2).fill(255);
    this.shadowData = shadowData;
    this.shadowTexture = new THREE.DataTexture(shadowData, this.shadowN, this.shadowN, THREE.RGFormat, THREE.UnsignedByteType);
    this.shadowTexture.minFilter = THREE.LinearFilter;
    this.shadowTexture.magFilter = THREE.LinearFilter;
    this.shadowTexture.wrapS = this.shadowTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.shadowTexture.generateMipmaps = false;
    this.shadowTexture.needsUpdate = true;
  }

  private slopeAtGrid(i: number, j: number) {
    const n = this.nearN;
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
    const j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1);
    const dx = (this.heights[j * n + i1] - this.heights[j * n + i0]) / ((i1 - i0) * this.nearSpacing);
    const dz = (this.heights[j1 * n + i] - this.heights[j0 * n + i]) / ((j1 - j0) * this.nearSpacing);
    const ny = 1 / Math.sqrt(dx * dx + dz * dz + 1);
    return 1 - ny;
  }

  /** Exact height of the rendered near mesh at (x,z) (matches triangle interpolation). */
  heightAt(x: number, z: number): number {
    const n = this.nearN;
    const fx = (x + NEAR_HALF) / this.nearSpacing;
    const fz = (z + NEAR_HALF) / this.nearSpacing;
    if (fx < 0 || fz < 0 || fx >= n - 1 || fz >= n - 1) return this.farHeightAt(x, z);
    const i = Math.floor(fx), j = Math.floor(fz);
    const u = fx - i, v = fz - j;
    const h00 = this.heights[j * n + i];
    const h10 = this.heights[j * n + i + 1];
    const h01 = this.heights[(j + 1) * n + i];
    const h11 = this.heights[(j + 1) * n + i + 1];
    // triangles: (00,01,10) and (01,11,10)
    if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }

  /** Bilinear height before terracing (near grid), for contour-following walls. */
  preHeightAt(x: number, z: number): number {
    const n = this.nearN;
    const fx = clamp((x + NEAR_HALF) / this.nearSpacing, 0, n - 1.001);
    const fz = clamp((z + NEAR_HALF) / this.nearSpacing, 0, n - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz);
    const u = fx - i, v = fz - j;
    const p = this.preHeights;
    return lerp(lerp(p[j * n + i], p[j * n + i + 1], u), lerp(p[(j + 1) * n + i], p[(j + 1) * n + i + 1], u), v);
  }

  farHeightAt(x: number, z: number): number {
    const n = this.farN;
    const fs = (FAR_HALF * 2) / (n - 1);
    const fx = clamp((x + FAR_HALF) / fs, 0, n - 1.001);
    const fz = clamp((z + FAR_HALF) / fs, 0, n - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz);
    const u = fx - i, v = fz - j;
    const h00 = this.farHeights[j * n + i];
    const h10 = this.farHeights[j * n + i + 1];
    const h01 = this.farHeights[(j + 1) * n + i];
    const h11 = this.farHeights[(j + 1) * n + i + 1];
    return lerp(lerp(h00, h10, u), lerp(h01, h11, u), v);
  }

  normalAt(x: number, z: number, out = new THREE.Vector3()) {
    const e = this.nearSpacing;
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-dx, 2 * e, -dz).normalize();
  }

  maskAt(x: number, z: number) {
    const n = this.nearN;
    const i = clamp(Math.round((x + NEAR_HALF) / this.nearSpacing), 0, n - 1);
    const j = clamp(Math.round((z + NEAR_HALF) / this.nearSpacing), 0, n - 1);
    const k = (j * n + i) * 4;
    return { terrace: this.masks[k], rock: this.masks[k + 1], wadi: this.masks[k + 2], path: this.masks[k + 3], grass: this.grassDensity[j * n + i] };
  }

  slopeAt(x: number, z: number) {
    return 1 - this.normalAt(x, z, tmpN).y;
  }

  // ------------------------------------------------------------------------------------------
  build(tex: TextureSet, sunDir: THREE.Vector3) {
    this.material = createTerrainMaterial(tex, this.shadowTexture, this.tier);
    this.nearGeo = this.buildNearGeometry();
    this.farGeo = this.buildFarGeometry();
    this.bakeSun(sunDir);
    // near terrain in spatial chunks sharing one vertex buffer: the camera and (small) sun-shadow frustums
    // cull them, so the shadow pass draws a few chunks instead of the whole 840 m grid
    const near = this.chunkNear(this.nearGeo, this.tier === 'low' ? 5 : 6);
    const far = new THREE.Mesh(this.farGeo, this.material);
    far.receiveShadow = true;
    far.name = 'terrain-far';
    this.group.add(near, far);
    // The Dead Sea — a pale, glassy band far to the east
    const seaGeo = new THREE.PlaneGeometry(1800, 9000, 1, 1);
    seaGeo.rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(
      seaGeo,
      new THREE.MeshStandardMaterial({ color: 0x7f9aa6, roughness: 0.18, metalness: 0.0, envMapIntensity: 1.3 }),
    );
    sea.position.set(4800, -349, 0);
    sea.name = 'dead-sea';
    this.group.add(sea);
  }

  /** Cheap multi-radius curvature occlusion from the height grid (valleys, wadi banks, terrace feet). */
  private occlusion(h: Float32Array, n: number, sp: number, k: number, i: number, j: number) {
    const h0 = h[k];
    let occ = 0;
    const radii = [3 / sp, 8 / sp, 20 / sp];
    const w = [0.22, 0.1, 0.045];
    for (let r = 0; r < 3; r++) {
      const d = Math.max(1, Math.round(radii[r]));
      const i0 = Math.max(0, i - d), i1 = Math.min(n - 1, i + d);
      const j0 = Math.max(0, j - d), j1 = Math.min(n - 1, j + d);
      const avg = (h[j * n + i0] + h[j * n + i1] + h[j0 * n + i] + h[j1 * n + i]) * 0.25;
      occ += Math.max(0, avg - h0) * w[r];
    }
    return clamp(1 - occ, 0.45, 1);
  }

  /** Splits the near grid into k x k chunk meshes (index subsets over the shared attributes). */
  private chunkNear(geo: THREE.BufferGeometry, k: number): THREE.Group {
    const group = new THREE.Group();
    group.name = 'terrain-near';
    const pos = geo.getAttribute('position').array as Float32Array;
    const src = geo.index!.array as Uint32Array;
    const lists: number[][] = Array.from({ length: k * k }, () => []);
    const cell = (v: number) => Math.min(k - 1, Math.max(0, Math.floor(((v + NEAR_HALF) / (2 * NEAR_HALF)) * k)));
    for (let t = 0; t < src.length; t += 3) {
      const a = src[t], b = src[t + 1], c = src[t + 2];
      const cx = (pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3;
      const cz = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3;
      lists[cell(cz) * k + cell(cx)].push(a, b, c);
    }
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (const list of lists) {
      if (!list.length) continue;
      const g = new THREE.BufferGeometry();
      for (const name of Object.keys(geo.attributes)) g.setAttribute(name, geo.getAttribute(name));
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(list), 1));
      box.makeEmpty();
      for (const i of list) box.expandByPoint(v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
      g.boundingBox = box.clone();
      g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
      const m = new THREE.Mesh(g, this.material);
      m.receiveShadow = true;
      m.castShadow = true;
      m.name = 'terrain-near-chunk';
      m.matrixAutoUpdate = false;
      group.add(m);
    }
    return group;
  }

  private buildNearGeometry() {
    const n = this.nearN;
    const sp = this.nearSpacing;
    const skirt = 4 * (n - 1);
    const vcount = n * n + skirt;
    const pos = new Float32Array(vcount * 3);
    const nor = new Float32Array(vcount * 3);
    const mask = new Float32Array(vcount * 4);
    const sun = new Float32Array(vcount).fill(1);
    const ao = new Float32Array(vcount).fill(1);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const x = -NEAR_HALF + i * sp;
        const z = -NEAR_HALF + j * sp;
        pos[k * 3] = x;
        pos[k * 3 + 1] = this.heights[k];
        pos[k * 3 + 2] = z;
        const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
        const j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1);
        const dx = (this.heights[j * n + i1] - this.heights[j * n + i0]) / ((i1 - i0) * sp);
        const dz = (this.heights[j1 * n + i] - this.heights[j0 * n + i]) / ((j1 - j0) * sp);
        const l = Math.sqrt(dx * dx + dz * dz + 1);
        nor[k * 3] = -dx / l;
        nor[k * 3 + 1] = 1 / l;
        nor[k * 3 + 2] = -dz / l;
        mask.set(this.masks.subarray(k * 4, k * 4 + 4), k * 4);
        ao[k] = this.occlusion(this.heights, n, sp, k, i, j);
      }
    }
    // skirt ring (hangs 14 m below the border to hide cracks against the far mesh)
    const border: number[] = [];
    for (let i = 0; i < n - 1; i++) border.push(i); // top row (j=0)
    for (let j = 0; j < n - 1; j++) border.push(j * n + (n - 1));
    for (let i = n - 1; i > 0; i--) border.push((n - 1) * n + i);
    for (let j = n - 1; j > 0; j--) border.push(j * n);
    border.forEach((k, s) => {
      const v = n * n + s;
      pos[v * 3] = pos[k * 3];
      pos[v * 3 + 1] = pos[k * 3 + 1] - 14;
      pos[v * 3 + 2] = pos[k * 3 + 2];
      nor.set(nor.subarray(k * 3, k * 3 + 3), v * 3);
      mask.set(mask.subarray(k * 4, k * 4 + 4), v * 4);
      ao[v] = ao[k];
    });
    const idx = new Uint32Array((n - 1) * (n - 1) * 6 + border.length * 6);
    let p = 0;
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        // (00,01,10) and (01,11,10) -> a,c,b and c,d,b
        idx[p++] = a; idx[p++] = c; idx[p++] = b;
        idx[p++] = c; idx[p++] = d; idx[p++] = b;
      }
    }
    for (let s = 0; s < border.length; s++) {
      const k0 = border[s], k1 = border[(s + 1) % border.length];
      const v0 = n * n + s, v1 = n * n + ((s + 1) % border.length);
      idx[p++] = k0; idx[p++] = v0; idx[p++] = k1;
      idx[p++] = k1; idx[p++] = v0; idx[p++] = v1;
    }
    // bare ground where the 3D grass is thin (same density field the grass tufts use), so the shader shows
    // terra rossa, chips and stones between the tufts instead of a continuous straw mat
    const bare = new Float32Array(n * n + border.length);
    for (let k = 0; k < n * n; k++) bare[k] = 1 - this.grassDensity[k];
    for (let s = 0; s < border.length; s++) bare[n * n + s] = bare[border[s]];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('aMask', new THREE.BufferAttribute(mask, 4));
    g.setAttribute('aSun', new THREE.BufferAttribute(sun, 1));
    g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1));
    g.setAttribute('aBare', new THREE.BufferAttribute(bare, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    return g;
  }

  private buildFarGeometry() {
    const n = this.farN;
    const fs = (FAR_HALF * 2) / (n - 1);
    const pos = new Float32Array(n * n * 3);
    const nor = new Float32Array(n * n * 3);
    const mask = new Float32Array(n * n * 4);
    const sun = new Float32Array(n * n).fill(1);
    const ao = new Float32Array(n * n).fill(1);
    const inner = NEAR_HALF - 2;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const x = -FAR_HALF + i * fs;
        const z = -FAR_HALF + j * fs;
        let h = this.farHeights[k];
        if (Math.abs(x) < inner && Math.abs(z) < inner) h -= 9;
        pos[k * 3] = x;
        pos[k * 3 + 1] = h;
        pos[k * 3 + 2] = z;
        const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
        const j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1);
        const dx = (this.farHeights[j * n + i1] - this.farHeights[j * n + i0]) / ((i1 - i0) * fs);
        const dz = (this.farHeights[j1 * n + i] - this.farHeights[j0 * n + i]) / ((j1 - j0) * fs);
        const l = Math.sqrt(dx * dx + dz * dz + 1);
        nor[k * 3] = -dx / l;
        nor[k * 3 + 1] = 1 / l;
        nor[k * 3 + 2] = -dz / l;
        const s = sampleMasksFar(x, z, h);
        mask[k * 4] = s.terrace;
        mask[k * 4 + 1] = s.rock;
        mask[k * 4 + 2] = s.desert;
        mask[k * 4 + 3] = 0;
        // valleys read darker from afar
        const avg = (this.farHeights[j * n + i0] + this.farHeights[j * n + i1] + this.farHeights[j0 * n + i] + this.farHeights[j1 * n + i]) * 0.25;
        ao[k] = clamp(1 - Math.max(0, avg - this.farHeights[k]) * 0.012, 0.6, 1);
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const x0 = -FAR_HALF + i * fs, x1 = x0 + fs;
        const z0 = -FAR_HALF + j * fs, z1 = z0 + fs;
        // skip quads that are entirely covered by the near terrain
        if (x0 > -NEAR_HALF + 1 && x1 < NEAR_HALF - 1 && z0 > -NEAR_HALF + 1 && z1 < NEAR_HALF - 1) continue;
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        idx.push(a, c, b, c, d, b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('aMask', new THREE.BufferAttribute(mask, 4));
    g.setAttribute('aSun', new THREE.BufferAttribute(sun, 1));
    g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }

  /** Bakes soft terrain self-shadowing toward the sun into the `aSun` vertex attribute. */
  bakeSun(sunDir: THREE.Vector3) {
    const d2 = Math.hypot(sunDir.x, sunDir.z) || 1;
    const dx = sunDir.x / d2, dz = sunDir.z / d2;
    const tanE = sunDir.y / d2;
    const bake = (geo: THREE.BufferGeometry, count: number, steps: number[], sizes: number[]) => {
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const sun = geo.getAttribute('aSun') as THREE.BufferAttribute;
      for (let k = 0; k < count; k++) {
        const x = pos.getX(k), z = pos.getZ(k);
        const h0 = Math.abs(x) < NEAR_HALF && Math.abs(z) < NEAR_HALF ? this.heightAt(x, z) : this.farHeightAt(x, z);
        let vis = 1;
        let d = 0;
        outer: for (let band = 0; band < steps.length; band++) {
          for (let s = 0; s < steps[band]; s++) {
            d += sizes[band];
            const sx = x + dx * d, sz = z + dz * d;
            const inNear = Math.abs(sx) < NEAR_HALF && Math.abs(sz) < NEAR_HALF;
            const th = inNear ? this.heightAt(sx, sz) : this.farHeightAt(sx, sz);
            const ray = h0 + 0.3 + d * tanE;
            const c = (ray - th) / (d * 0.035 + 0.6);
            if (c < vis) vis = c;
            if (vis <= 0) break outer;
          }
        }
        sun.setX(k, clamp(vis, 0, 1));
      }
      sun.needsUpdate = true;
    };
    // fine steps first so the 2 m risers of terraces shade the tread below them
    bake(this.nearGeo, this.nearN * this.nearN + 4 * (this.nearN - 1), [6, 40, 24], [1.2, 4, 60]);
    bake(this.farGeo, this.farN * this.farN, [40], [90]);
  }

  /** Thin out the GPU grass under an object (boulder, wall, tree trunk). Call before Grass is constructed. */
  suppressGrass(x: number, z: number, r: number, amount = 0.85) {
    const n = this.nearN, sp = this.nearSpacing;
    const i0 = Math.max(0, Math.floor((x - r + NEAR_HALF) / sp)), i1 = Math.min(n - 1, Math.ceil((x + r + NEAR_HALF) / sp));
    const j0 = Math.max(0, Math.floor((z - r + NEAR_HALF) / sp)), j1 = Math.min(n - 1, Math.ceil((z + r + NEAR_HALF) / sp));
    const data = this.heightTexture.image.data as unknown as Float32Array;
    const bare = this.nearGeo?.getAttribute('aBare') as THREE.BufferAttribute | undefined;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(-NEAR_HALF + i * sp - x, -NEAR_HALF + j * sp - z);
        if (d > r) continue;
        const k = j * n + i;
        const f = 1 - amount * (1 - smoothstep(r * 0.6, r, d));
        this.grassDensity[k] *= f;
        data[k * 2 + 1] = this.grassDensity[k];
        if (bare) bare.array[k] = 1 - this.grassDensity[k];
      }
    }
    this.heightTexture.needsUpdate = true;
    // bare, stony soil around rocks and under trees (terrain shader, see aBare)
    if (bare) bare.needsUpdate = true;
  }

  // ------------------------------------------------------------------------------------------ baked shadows

  /**
   * Stamp long golden-hour shadows (and contact occlusion) of static objects into the ground texture.
   * Used by the terrain shader only outside the real shadow-map frustum. Call after the sun is set.
   */
  stampShadows(casters: ShadowCaster[]) {
    const sd = shared.uSunDir.value;
    const hl = Math.hypot(sd.x, sd.z) || 1;
    const ax = -sd.x / hl, az = -sd.z / hl; // along the shadow (away from the sun)
    const tanE = Math.max(0.08, sd.y / hl);
    const N = this.shadowN;
    const texel = (NEAR_HALF * 2) / N;
    const data = this.shadowData;
    for (const c of casters) {
      const d0 = c.h0 / tanE, d1 = Math.min(90, c.h1 / tanE);
      const w = Math.max(c.r, texel * 0.7);
      // bounding box of the capsule
      const sx0 = c.x + ax * d0, sz0 = c.z + az * d0;
      const sx1 = c.x + ax * d1, sz1 = c.z + az * d1;
      const minX = Math.min(sx0, sx1, c.x) - w - 2, maxX = Math.max(sx0, sx1, c.x) + w + 2;
      const minZ = Math.min(sz0, sz1, c.z) - w - 2, maxZ = Math.max(sz0, sz1, c.z) + w + 2;
      const i0 = Math.max(0, Math.floor((minX + NEAR_HALF) / texel)), i1 = Math.min(N - 1, Math.ceil((maxX + NEAR_HALF) / texel));
      const j0 = Math.max(0, Math.floor((minZ + NEAR_HALF) / texel)), j1 = Math.min(N - 1, Math.ceil((maxZ + NEAR_HALF) / texel));
      const segLen = Math.max(1e-3, d1 - d0);
      const aoR = c.ao ?? 0;
      for (let j = j0; j <= j1; j++) {
        const z = -NEAR_HALF + (j + 0.5) * texel;
        for (let i = i0; i <= i1; i++) {
          const x = -NEAR_HALF + (i + 0.5) * texel;
          const k = (j * N + i) * 2;
          // capsule distance
          const px = x - sx0, pz = z - sz0;
          const t = clamp((px * ax + pz * az) / segLen, 0, 1);
          const qx = px - ax * segLen * t, qz = pz - az * segLen * t;
          const dist = Math.sqrt(qx * qx + qz * qz);
          // soft edge grows with distance from the caster (penumbra)
          const soft = 0.5 + (d0 + t * segLen) * 0.05;
          const s = (1 - smoothstep(w - soft, w + soft, dist)) * c.k * (1 - 0.35 * t);
          if (s > 0.003) data[k] = Math.min(data[k], Math.round(255 * (1 - s)));
          if (aoR > 0) {
            const dd = Math.hypot(x - c.x, z - c.z);
            const a = (1 - smoothstep(aoR * 0.3, aoR, dd)) * 0.5;
            if (a > 0.003) data[k + 1] = Math.min(data[k + 1], Math.round(255 * (1 - a)));
          }
        }
      }
    }
    this.shadowTexture.needsUpdate = true;
  }
}

const tmpN = new THREE.Vector3();

function regionalOrFull(x: number, z: number) {
  // full detail near the play area so near/far meshes agree at the seam
  if (Math.abs(x) < 1400 && Math.abs(z) < 1400) return sampleTerrain(x, z).h;
  return regional(x, z);
}

function sampleMasksFar(x: number, z: number, h: number) {
  if (Math.abs(x) < 1400 && Math.abs(z) < 1400) {
    const s = sampleTerrain(x, z);
    return { terrace: s.terrace, rock: s.rock, desert: 0 };
  }
  const desert = smoothstep(500, 1800, x) * (1 - smoothstep(5200, 5800, x));
  const rock = clamp(smoothstep(0.1, 0.42, N2.fbm(x / 55 + 3, z / 55 - 9, 3)) * 0.6 + desert * 0.3, 0, 1);
  const terrace = x < 700 ? smoothstep(0.12, 0.34, N3.fbm(x / 260 - 4, z / 260 + 8, 3)) * 0.7 * (1 - smoothstep(1500, 3500, Math.hypot(x, z))) : 0;
  void h;
  return { terrace, rock, desert };
}

// --------------------------------------------------------------------------------------------
/**
 * Terrain material: height-blended dry grass / terra rossa / limestone bedrock, wadi gravel, dry-stone terrace
 * risers, two-scale anti-tiling, far-field terrace and strata bands, garrigue speckle, curvature AO, baked sun
 * visibility and baked long shadows of trees / walls beyond the real shadow map.
 */
function createTerrainMaterial(tex: TextureSet, shadowTex: THREE.Texture, tier: WorldTier) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  const uniforms = {
    tGrass: { value: tex.grass },
    tGrassN: { value: tex.grassN },
    tSoil: { value: tex.soil },
    tSoilN: { value: tex.soilN },
    tRock: { value: tex.rock },
    tRockN: { value: tex.rockN },
    tWall: { value: tex.wall },
    tWallN: { value: tex.wallN },
    tGravel: { value: tex.gravel },
    tGravelN: { value: tex.gravelN },
    tBaked: { value: shadowTex },
    uSunDir: shared.uSunDir,
    ...worldShared,
  };
  const low = tier === 'low';
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (low) shader.defines = { ...(shader.defines ?? {}), TERRAIN_LOW: '' };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aMask;
attribute float aSun;
attribute float aAO;
attribute float aBare;
varying vec4 vMask;
varying float vSun;
varying float vAO;
varying float vBare;
varying vec3 vWPos;
varying vec3 vWNormal;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
vMask = aMask;
vBare = aBare;
vSun = aSun;
vAO = aAO;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D tGrass, tGrassN, tSoil, tSoilN, tRock, tRockN, tWall, tWallN, tGravel, tGravelN, tBaked;
varying vec4 vMask;
varying float vSun;
varying float vAO;
varying float vBare;
varying vec3 vWPos;
varying vec3 vWNormal;
${GLSL_NOISE}
${GLSL_SHADOW_FRAME}
vec3 terrainNormalW;
float terrainRough;
float terrainAO;
float terrainBakedSun;
vec2 tRot(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
vec3 tN(vec4 t){ return t.xyz * 2.0 - 1.0; }
// F1, F2 of a cellular (Voronoi) pattern: limestone clints and the soil-filled grikes between them
vec2 tCell(vec2 p){
  vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(dHash12(i + g), dHash12(i + g + 19.19));
    vec2 r = g + o - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return sqrt(vec2(d1, d2));
}
// height-blend three layers; returns normalised weights
vec3 hblend3(vec3 w, vec3 h){
  vec3 b = w + h * 0.45 * step(vec3(0.001), w);
  float ma = max(b.x, max(b.y, b.z)) - 0.14;
  vec3 r = max(b - ma, vec3(0.0));
  return r / max(r.x + r.y + r.z, 1e-4);
}
`,
      )
      .replace(
        '#include <map_fragment>',
        `{
  vec3 N = normalize(vWNormal);
  float slope = 1.0 - N.y;
  vec2 p = vWPos.xz;
  float dist = length(vWPos - cameraPosition);
  float terr = vMask.x, rocky = vMask.y, wadi = vMask.z, path = vMask.w;
  float isFar = (abs(p.x) > ${(NEAR_HALF - 1).toFixed(1)} || abs(p.y) > ${(NEAR_HALF - 1).toFixed(1)}) ? 1.0 : 0.0;
  float desert = wadi * isFar;
  wadi *= 1.0 - isFar;
  path *= 1.0 - isFar;
  float macro = dFbm(p * 0.011);
  float m2 = dNoise(p * 0.043 + 7.3);
  float m3 = dNoise(p * 0.19 - 3.1);
  float fineFade = 1.0 - smoothstep(90.0, 360.0, dist);

  // ---- layer samples (albedo.rgb, height.a) ------------------------------------------------
  vec2 gUV = p / 4.2;
#ifdef TERRAIN_LOW
  vec4 gA = texture2D(tGrass, gUV);
  vec4 gNt = texture2D(tGrassN, gUV);
#else
  vec2 gUV2 = tRot(p, 0.9) / 11.7 + vec2(0.37, 0.71);
  float gmix = smoothstep(0.3, 0.7, m3 * 0.6 + m2 * 0.4);
  vec4 gA = mix(texture2D(tGrass, gUV), texture2D(tGrass, gUV2), gmix);
  vec4 gNt = mix(texture2D(tGrassN, gUV), texture2D(tGrassN, gUV2), gmix);
#endif
  vec2 sUV = tRot(p, 0.4) / 4.6;
  vec4 sA = texture2D(tSoil, sUV);
  vec4 sNt = texture2D(tSoilN, sUV);
  // limestone: top projection on gentle ground, triplanar on steep faces
  vec3 bw = pow(abs(N), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
  vec3 rp = vWPos / 3.1;
#ifdef TERRAIN_LOW
  vec4 rA = texture2D(tRock, rp.xz);
  vec4 rNt = texture2D(tRockN, rp.xz);
  vec3 rockN = normalize(N + vec3(tN(rNt).x, 0.0, tN(rNt).y) * 0.9);
#else
  vec4 rAx = texture2D(tRock, rp.zy), rAy = texture2D(tRock, rp.xz), rAz = texture2D(tRock, rp.xy);
  vec4 rNx = texture2D(tRockN, rp.zy), rNy = texture2D(tRockN, rp.xz), rNz = texture2D(tRockN, rp.xy);
  vec4 rA = rAx * bw.x + rAy * bw.y + rAz * bw.z;
  vec4 rNt = rNx * bw.x + rNy * bw.y + rNz * bw.z;
  vec3 rockN = normalize(
      bw.x * normalize(N + vec3(0.0, tN(rNx).y, tN(rNx).x) * 1.1) +
      bw.y * normalize(N + vec3(tN(rNy).x, 0.0, tN(rNy).y) * 1.1) +
      bw.z * normalize(N + vec3(tN(rNz).x, tN(rNz).y, 0.0) * 1.1));
#endif

  // ---- weights -------------------------------------------------------------------------------
  // bedrock: outcrop mask, steep untended slopes, natural bedding ledges (strata) on the hillsides, desert
  float strataT = (vWPos.y + (m2 - 0.5) * 3.0) / 1.7;
  float strata = smoothstep(0.62, 0.8, fract(strataT)) * smoothstep(0.18, 0.4, slope) * (1.0 - terr) * smoothstep(0.35, 0.65, m2);
  float wR = rocky * 0.8 + smoothstep(0.46, 0.7, slope) * (1.0 - terr * 0.8) * 0.8 + desert * 0.45 + strata * 0.6 * fineFade;
  wR = clamp(wR * (0.6 + 0.7 * m3) + (macro - 0.5) * 0.2, 0.0, 1.0);
  wR *= 1.0 - path;
  // clints and grikes: bedrock breaks into slabs with soil and grass in the joints
  float grike = 0.0;
#ifndef TERRAIN_LOW
  if (wR > 0.02 && dist < 160.0) {
    vec2 cc = tCell(tRot(p, 0.5) * vec2(0.38, 0.5));
    grike = (1.0 - smoothstep(0.03, 0.16, cc.y - cc.x)) * (1.0 - smoothstep(110.0, 160.0, dist));
    wR *= 1.0 - grike * 0.85;
  }
#endif
  // terra rossa: small patches, pockets beside the rock, grike fill, a little on terrace treads
  float wS = smoothstep(0.62, 0.9, m2 * 0.7 + macro * 0.5) * 0.45 + rocky * (1.0 - rocky) * 0.5 + terr * 0.06 + grike * 0.35;
  // Bethlehem: trampled earth lanes and courtyards with bedrock breaking through (no grass mat in town)
  float town = (1.0 - smoothstep(${(LAYOUT.bethlehem.r - 16).toFixed(1)}, ${(LAYOUT.bethlehem.r + 6).toFixed(1)}, length(p - vec2(${LAYOUT.bethlehem.x.toFixed(1)}, ${LAYOUT.bethlehem.z.toFixed(1)})))) * (1.0 - isFar);
  wR = max(wR, town * smoothstep(0.56, 0.8, m3 * 0.6 + dNoise(p * 0.37) * 0.4) * 0.7);
  wS = clamp(wS * (1.0 - wR) + town * 0.85 * (1.0 - wR), 0.0, 1.0);
  float wG = max(0.0, 1.0 - wR - wS);
  // thin grass (where the 3D tufts are sparse): bare terra rossa and limestone chips show between the tufts
  // ragged, small-scale bare patches (tufts survive where the grass texture is tall)
  float thin = smoothstep(0.35, 0.9, vBare + (m3 - 0.5) * 0.35) * (1.0 - isFar);
  thin *= smoothstep(0.25, 0.65, dNoise(p * 0.7 + 1.3) * 0.55 + (1.0 - gA.a) * 0.45 + thin * 0.25);
  float toSoil = wG * thin * 0.7;
  wS += toSoil; wG -= toSoil;
  vec3 wts = hblend3(vec3(wG, wS, wR), vec3(gA.a, sA.a, rA.a));

  // ---- colours -----------------------------------------------------------------------------------
  vec3 grass = gA.rgb * vec3(1.08, 1.02, 0.88);
  grass *= mix(vec3(0.88, 0.91, 0.85), vec3(1.1, 1.03, 0.88), macro);                   // olive-grey <-> golden
  // grey-green garrigue (sage, thorny burnet) and pale sun-bleached straw break up the gold
  float gl = dot(grass, vec3(0.3, 0.55, 0.15));
  grass = mix(grass, vec3(gl) * vec3(0.9, 0.96, 0.8), smoothstep(0.55, 0.85, m2) * 0.55);
  grass = mix(grass, vec3(gl) * vec3(1.12, 1.07, 0.95), smoothstep(0.62, 0.9, m3) * 0.3);
  // grazed, trampled stubble (darker, browner) and wind-flattened pale straw break the hills into patches
  float mp = dNoise(p * 0.085 + 2.3) * 0.65 + dNoise(p * 0.31 - 4.1) * 0.35;
  grass *= mix(1.0, 0.78, smoothstep(0.52, 0.78, mp));
  grass = mix(grass, grass * vec3(0.92, 0.86, 0.8), smoothstep(0.35, 0.1, mp) * 0.6);
  vec3 soil = sA.rgb * mix(0.9, 1.04, m3);
  soil = mix(vec3(dot(soil, vec3(0.3, 0.55, 0.15))), soil, 0.55) * vec3(1.07, 1.0, 0.94);   // dry terra rossa...
  soil = mix(soil, vec3(0.17, 0.11, 0.07) * mix(0.9, 1.1, m2), 0.3 * (1.0 - rocky));            // ...browned (linear colour)
  soil = mix(soil, vec3(0.3, 0.22, 0.15) * mix(0.92, 1.06, m2), town * 0.55);                    // beaten, dusty earth (linear)
  // weathered bedrock is greyer and darker than fresh boulders (lichen, dust)
  vec3 rock = rA.rgb * vec3(0.8, 0.79, 0.76) * mix(0.8, 1.0, macro);
  rock = mix(rock, rock * vec3(0.8, 0.72, 0.62), town * 0.8); // trodden, dust-stained bedrock in the lanes
  vec3 col = grass * wts.x + soil * wts.y + rock * wts.z;
  vec3 nrm = normalize(N + vec3(tN(gNt).x, 0.0, tN(gNt).y) * 0.8) * wts.x
           + normalize(N + vec3(tN(sNt).x, 0.0, tN(sNt).y) * 0.8) * wts.y
           + rockN * wts.z;
  float ao = gNt.a * wts.x + sNt.a * wts.y + rNt.a * wts.z;
  float rough = 0.97 * wts.x + 0.93 * wts.y + 0.8 * wts.z;

  // dusty, compacted footpath
  vec3 pathCol = mix(soil, vec3(0.63, 0.53, 0.41), 0.55) * mix(0.95, 1.08, m3);
  col = mix(col, pathCol, path * 0.85);
  nrm = normalize(mix(nrm, N, path * 0.6));

  // wadi bed: rounded pebbles and cobbles in pale silt
#ifndef TERRAIN_LOW
  if (wadi > 0.01) {
    vec2 vUV = tRot(p, 0.3) / 2.1;
    vec4 vA = texture2D(tGravel, vUV);
    vec4 vNt = texture2D(tGravelN, vUV);
    // gravel bars and silty hollows along the bed
    float bar = smoothstep(0.3, 0.7, m3 * 0.6 + dNoise(p * 0.6) * 0.4);
    float wv = smoothstep(0.0, 1.0, wadi * 1.3 + (vA.a - 0.5) * 0.8 - (1.0 - bar) * 0.45);
    vec3 silt = mix(soil, vec3(0.64, 0.55, 0.44), 0.55);
    col = mix(col, mix(silt, vA.rgb * vec3(0.98, 0.95, 0.9), wv), smoothstep(0.1, 0.6, wadi));
    nrm = normalize(mix(nrm, normalize(N + vec3(tN(vNt).x, 0.0, tN(vNt).y) * 1.2), wv));
    ao = mix(ao, vNt.a, wv);
    rough = mix(rough, 0.86, wv);
  }
#else
  col = mix(col, mix(rock, vec3(0.7, 0.62, 0.52), 0.4), wadi * 0.8);
#endif

  // limestone chips and small stones lying on the bare soil (not on the pasture turf or the path)
#ifndef TERRAIN_LOW
  if (wts.y > 0.05 && dist < 140.0) {
    vec2 cUV = tRot(p, 1.3) / 0.55 + 0.21;
    vec4 cA = texture2D(tGravel, cUV);
    vec4 cN = texture2D(tGravelN, cUV);
    float chip = smoothstep(0.68, 0.84, cA.a + (dNoise(p * 0.55) - 0.5) * 0.5) * smoothstep(0.3, 0.8, wts.y) * (1.0 - path) * (1.0 - smoothstep(100.0, 140.0, dist));
    col = mix(col, mix(cA.rgb * vec3(0.9, 0.86, 0.8), soil * 1.6, 0.45), chip * 0.55);
    nrm = normalize(mix(nrm, normalize(N + vec3(tN(cN).x, 0.0, tN(cN).y) * 1.3), chip));
    ao = mix(ao, cN.a, chip);
    rough = mix(rough, 0.85, chip);
  }
#endif

  // dry-stone terrace risers (near mesh; the 3D walls stand in front of them)
  float wWall = smoothstep(0.25, 0.5, terr) * smoothstep(0.32, 0.5, slope) * (1.0 - isFar);
#ifndef TERRAIN_LOW
  if (wWall > 0.01) {
    vec2 wallUV = vec2(abs(N.x) > abs(N.z) ? vWPos.z : vWPos.x, vWPos.y) / 2.4;
    vec4 wA = texture2D(tWall, wallUV);
    vec4 wNt = texture2D(tWallN, wallUV);
    col = mix(col, wA.rgb, wWall);
    vec3 wn = abs(N.x) > abs(N.z) ? normalize(N + vec3(0.0, tN(wNt).y, tN(wNt).x * sign(N.x)) * 1.2) : normalize(N + vec3(tN(wNt).x * sign(N.z), tN(wNt).y, 0.0) * 1.2);
    nrm = normalize(mix(nrm, wn, wWall));
    ao = mix(ao, wNt.a, wWall);
    rough = mix(rough, 0.86, wWall);
  }
#else
  col = mix(col, rock * 0.95, wWall);
#endif

  // ---- far field ---------------------------------------------------------------------------
  // terrace walls as bright stone bands along the contours (the far mesh is too coarse for the steps)
  float tb = (vWPos.y + (m2 - 0.5) * 0.8) / ${TERRACE_STEP.toFixed(2)};
  float fwT = fwidth(tb);
  float fb = fract(tb);
  float band = smoothstep(0.8 - fwT, 0.84 + fwT, fb) * (1.0 - smoothstep(0.95 - fwT, 1.0, fb));
  float shade = smoothstep(0.0, 0.12 + fwT, fb) * (1.0 - smoothstep(0.12, 0.3 + fwT, fb));
  float bandVis = (1.0 - smoothstep(0.18, 0.45, fwT)) * smoothstep(0.15, 0.5, terr) * isFar;
  vec3 wallAvg = vec3(0.64, 0.6, 0.52);
  col = mix(col, wallAvg * mix(0.85, 1.1, m3), band * bandVis * 0.9);
  col *= 1.0 - shade * bandVis * 0.34;
  col = mix(col, mix(col, wallAvg, 0.22), smoothstep(0.15, 0.5, terr) * isFar * (1.0 - bandVis));
  // white limestone rubble and clearance heaps on the terraced / rocky hills seen from afar, and olive groves in
  // rows on the terrace treads (dark silver-green crowns with long evening shadows). Only beyond ~120 m, where
  // the 3D rocks and trees thin out; phones skip the rubble and the shadow sample.
  if (dist > 120.0) {
    float farT = smoothstep(120.0, 240.0, dist);
#ifndef TERRAIN_LOW
    vec2 rp2 = p * 0.3 + 3.3;
    float rubAA = 1.0 - smoothstep(0.35, 0.8, fwidth(rp2.x));
    float rub = dCellDots(rp2, 0.28) * rubAA * clamp(smoothstep(0.15, 0.5, terr) * 0.7 + rocky * 0.8, 0.0, 1.0) * (1.0 - desert) * farT;
    col = mix(col, vec3(0.6, 0.57, 0.5) * mix(0.9, 1.05, m3), rub * 0.7);
    col = mix(col, mix(col, vec3(0.58, 0.55, 0.48), 0.12), (1.0 - rubAA) * smoothstep(0.15, 0.5, terr) * farT);
#endif
    float grove = smoothstep(0.3, 0.6, dNoise(p * 0.004 + 1.7) * 0.7 + terr * 0.7) * (1.0 - desert) * (1.0 - path) * (1.0 - wadi);
    vec2 op = p * 0.085;
    float oAA = 1.0 - smoothstep(0.3, 0.7, fwidth(op.x));
    float tread = mix(1.0, smoothstep(0.14, 0.3, fb) * (1.0 - smoothstep(0.66, 0.8, fb)), bandVis);
    float ol = dCellDots(op + 5.0, 0.34) * grove * oAA * tread;
    float oFade = smoothstep(150.0, 280.0, dist) * (1.0 - wR * 0.45);
#ifndef TERRAIN_LOW
    vec2 opS = op + vec2(${(0.985 * 4.0 * 0.085).toFixed(4)}, ${(-0.174 * 4.0 * 0.085).toFixed(4)});
    float olS = dCellDots(opS + 5.0, 0.34) * grove * oAA * (1.0 - ol);
    col *= 1.0 - olS * oFade * 0.45;
#endif
    col = mix(col, mix(vec3(0.06, 0.07, 0.045), vec3(0.12, 0.13, 0.09), dNoise(p * 0.5)), ol * oFade * 0.9);
    col *= 1.0 - (1.0 - oAA) * grove * oFade * 0.28;
  }
  // garrigue: dark shrubs and trees dotting the hills where no 3D plants are drawn
  float cover = smoothstep(0.25, 0.65, dNoise(p * 0.025 + 4.0));
  float bush = dCellDots(p * 0.33 + 11.0, 0.3) * (0.4 + 0.6 * cover) + dCellDots(p * 0.12 - 5.0, 0.26) * 0.9 * cover + dCellDots(p * 0.05 + 2.0, 0.2) * 0.7 * cover;
  bush *= (1.0 - wR * 0.5) * (1.0 - path) * (1.0 - wadi) * (1.0 - desert * 0.85) * smoothstep(70.0, 180.0, dist);
  vec3 bushCol = mix(vec3(0.16, 0.17, 0.11), vec3(0.27, 0.27, 0.19), dNoise(p * 0.9));
  col = mix(col, bushCol, clamp(bush, 0.0, 1.0) * 0.75);
  // the Judean desert: bare pinkish-tan chalk and marl
  col = mix(col, mix(vec3(0.74, 0.62, 0.49), rock, 0.3) * mix(0.9, 1.08, macro), desert * 0.85);

  // baked long shadows of trees / walls outside the shadow-map frustum + contact occlusion
  vec2 buv = (p + ${NEAR_HALF.toFixed(1)}) / ${(2 * NEAR_HALF).toFixed(1)};
  vec2 baked = (isFar > 0.5) ? vec2(1.0) : texture2D(tBaked, buv).rg;
  terrainBakedSun = mix(baked.r, 1.0, inShadowFrame(vWPos));
  ao *= baked.g;

  diffuseColor.rgb *= col;
  nrm = normalize(mix(nrm, N, 1.0 - fineFade * 0.85));
  terrainNormalW = nrm;
  terrainRough = rough;
  terrainAO = mix(1.0, ao, fineFade * 0.8 + 0.2) * vAO;
}`,
      )
      .replace('#include <normal_fragment_maps>', `normal = normalize((viewMatrix * vec4(terrainNormalW, 0.0)).xyz);`)
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = terrainRough;`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
float sunVis = vSun * terrainBakedSun;
reflectedLight.directDiffuse *= sunVis * mix(1.0, terrainAO, 0.45);
reflectedLight.directSpecular *= sunVis * terrainAO;
reflectedLight.indirectDiffuse *= mix(0.7, 1.0, vSun) * terrainAO;
reflectedLight.indirectSpecular *= terrainAO;`,
      );
  };
  mat.customProgramCacheKey = () => 'terrain-v3' + (low ? '-low' : '');
  return mat;
}
