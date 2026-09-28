import * as THREE from 'three';
import { Simplex2, clamp, distToPolyline, lerp, smoothstep } from '../core/noise';
import { GLSL_NOISE, shared } from '../core/Shared';
import { FAR_HALF, LAYOUT, NEAR_HALF } from './Layout';
import type { TextureSet } from './Textures';

const N1 = new Simplex2(1337);
const N2 = new Simplex2(4242);
const N3 = new Simplex2(99);

/** Output of the analytic height function (module-level scratch to avoid allocations). */
export const sampleOut = { h: 0, terrace: 0, rock: 0, wadi: 0, path: 0 };

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
  h = lerp(h, plateauH + 0.9 * N2.noise(x / 26, z / 26), plateau);

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
  if (T > 0.001) {
    const step = 2.3;
    const t = h / step;
    const f = t - Math.floor(t);
    const ter = (Math.floor(t) + 0.1 * f + 0.9 * smoothstep(0.86, 1.0, f)) * step;
    h = lerp(h, ter, T);
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
  return sampleOut;
}

export function heightAnalytic(x: number, z: number) {
  return sampleTerrain(x, z).h;
}

// --------------------------------------------------------------------------------------------
export interface TerrainQuality {
  nearSpacing: number;
  farSegments: number;
}

export class Terrain {
  readonly group = new THREE.Group();
  readonly nearN: number;
  readonly nearSpacing: number;
  readonly heights: Float32Array; // near grid heights
  readonly masks: Float32Array; // near grid masks (terrace, rock, wadi, path)
  readonly grassDensity: Float32Array;
  readonly farN: number;
  readonly farHeights: Float32Array;
  readonly heightTexture: THREE.DataTexture; // RG32F: height, grass density
  material!: THREE.MeshStandardMaterial;
  private nearGeo!: THREE.BufferGeometry;
  private farGeo!: THREE.BufferGeometry;

  constructor(q: TerrainQuality) {
    initHeightModel();
    this.nearSpacing = q.nearSpacing;
    this.nearN = Math.floor((NEAR_HALF * 2) / q.nearSpacing) + 1;
    const n = this.nearN;
    this.heights = new Float32Array(n * n);
    this.masks = new Float32Array(n * n * 4);
    this.grassDensity = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      const z = -NEAR_HALF + j * q.nearSpacing;
      for (let i = 0; i < n; i++) {
        const x = -NEAR_HALF + i * q.nearSpacing;
        const s = sampleTerrain(x, z);
        const k = j * n + i;
        this.heights[k] = s.h;
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
        d *= 0.55 + 0.45 * smoothstep(-0.3, 0.3, N3.noise(x / 18, z / 18));
        const dv = Math.hypot(x - LAYOUT.bethlehem.x, z - LAYOUT.bethlehem.z);
        d *= smoothstep(LAYOUT.bethlehem.r - 10, LAYOUT.bethlehem.r + 30, dv) * 0.8 + 0.2;
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
    this.material = createTerrainMaterial(tex);
    this.nearGeo = this.buildNearGeometry();
    this.farGeo = this.buildFarGeometry();
    this.bakeSun(sunDir);
    const near = new THREE.Mesh(this.nearGeo, this.material);
    near.receiveShadow = true;
    near.castShadow = true;
    near.name = 'terrain-near';
    const far = new THREE.Mesh(this.farGeo, this.material);
    far.receiveShadow = true;
    far.name = 'terrain-far';
    this.group.add(near, far);
    // The Dead Sea — a pale, glassy band far to the east
    const seaGeo = new THREE.PlaneGeometry(1800, 9000, 1, 1);
    seaGeo.rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(
      seaGeo,
      new THREE.MeshStandardMaterial({ color: 0x7f9aa6, roughness: 0.12, metalness: 0.0, envMapIntensity: 1.6 }),
    );
    sea.position.set(4800, -349, 0);
    this.group.add(sea);
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
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('aMask', new THREE.BufferAttribute(mask, 4));
    g.setAttribute('aSun', new THREE.BufferAttribute(sun, 1));
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
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }

  /** Bakes soft terrain self-shadowing toward the sun into the `aSun` vertex attribute. */
  bakeSun(sunDir: THREE.Vector3) {
    const d2 = Math.hypot(sunDir.x, sunDir.z) || 1;
    const dx = sunDir.x / d2, dz = sunDir.z / d2;
    const tanE = sunDir.y / d2;
    const bake = (geo: THREE.BufferGeometry, count: number, nearSteps: number, nearStep: number, farSteps: number, farStep: number) => {
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const sun = geo.getAttribute('aSun') as THREE.BufferAttribute;
      for (let k = 0; k < count; k++) {
        const x = pos.getX(k), z = pos.getZ(k);
        const h0 = Math.abs(x) < NEAR_HALF && Math.abs(z) < NEAR_HALF ? this.heightAt(x, z) : this.farHeightAt(x, z);
        let vis = 1;
        let d = 0;
        for (let s = 1; s <= nearSteps + farSteps; s++) {
          d += s <= nearSteps ? nearStep : farStep;
          const sx = x + dx * d, sz = z + dz * d;
          const inNear = Math.abs(sx) < NEAR_HALF && Math.abs(sz) < NEAR_HALF;
          const th = inNear ? this.heightAt(sx, sz) : this.farHeightAt(sx, sz);
          const ray = h0 + 0.3 + d * tanE;
          const c = (ray - th) / (d * 0.035 + 0.6);
          if (c < vis) vis = c;
          if (vis <= 0) break;
        }
        sun.setX(k, clamp(vis, 0, 1));
      }
      sun.needsUpdate = true;
    };
    bake(this.nearGeo, this.nearN * this.nearN + 4 * (this.nearN - 1), 50, 4, 24, 60);
    bake(this.farGeo, this.farN * this.farN, 0, 0, 40, 90);
    // skirt copies border values
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
function createTerrainMaterial(tex: TextureSet) {
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
    uSunDir: shared.uSunDir,
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aMask;
attribute float aSun;
varying vec4 vMask;
varying float vSun;
varying vec3 vWPos;
varying vec3 vWNormal;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
vMask = aMask;
vSun = aSun;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D tGrass, tGrassN, tSoil, tSoilN, tRock, tRockN, tWall, tWallN;
varying vec4 vMask;
varying float vSun;
varying vec3 vWPos;
varying vec3 vWNormal;
${GLSL_NOISE}
vec3 tNormal(sampler2D t, vec2 uv){ return texture2D(t, uv).xyz * 2.0 - 1.0; }
vec3 terrainNormalW;
float terrainRough;
`,
      )
      .replace(
        '#include <map_fragment>',
        `{
  vec3 N = normalize(vWNormal);
  float slope = 1.0 - N.y;
  vec2 p = vWPos.xz;
  float dist = length(vWPos - cameraPosition);
  float macro = dFbm(p * 0.018);
  float macro2 = dNoise(p * 0.11);
  float terr = vMask.x, rocky = vMask.y, wadi = vMask.z, path = vMask.w;
  float desert = 0.0;
  if (abs(p.x) > ${NEAR_HALF.toFixed(1)} || abs(p.y) > ${NEAR_HALF.toFixed(1)}) { desert = wadi; wadi = 0.0; path = 0.0; }

  // ---- grass (golden, dry), two scales to break tiling
  vec2 gUV1 = p / 3.6;
  vec2 gUV2 = p / 11.3 + vec2(0.37, 0.71);
  vec3 grass = mix(texture2D(tGrass, gUV1).rgb, texture2D(tGrass, gUV2).rgb, 0.45);
  grass *= mix(vec3(0.95, 0.98, 0.8), vec3(1.18, 1.06, 0.86), macro); // patchy hue
  // darker garrigue scrub patches (thorny burnet, sage) break up the gold
  float scrub = smoothstep(0.55, 0.75, dNoise(p * 0.05 + 3.0) * 0.7 + dNoise(p * 0.21) * 0.3);
  grass = mix(grass, grass * vec3(0.62, 0.64, 0.5), scrub * 0.55);
  grass = mix(grass, grass * vec3(0.78, 0.74, 0.62), smoothstep(0.55, 0.9, macro2) * 0.6);
  // ---- terra rossa soil
  vec3 soil = texture2D(tSoil, p / 4.2).rgb;
  soil = mix(soil, texture2D(tSoil, p / 13.0 + 0.5).rgb, 0.4);
  // ---- limestone (triplanar)
  vec3 bw = pow(abs(N), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
  vec3 rp = vWPos / 6.5;
  vec3 rock = texture2D(tRock, rp.zy).rgb * bw.x + texture2D(tRock, rp.xz).rgb * bw.y + texture2D(tRock, rp.xy).rgb * bw.z;
  rock *= mix(0.62, 0.84, macro) * vec3(0.98, 0.96, 0.92);
  // ---- dry-stone terrace walls (side projection)
  vec2 wallUV = (abs(N.x) > abs(N.z) ? vWPos.zy : vWPos.xy) / 3.1;
  vec3 wall = texture2D(tWall, wallUV).rgb;

  // ---- weights with height-blending for crisp natural transitions
  float rockH = dot(rock, vec3(0.33));
  float breakup = dNoise(p * 0.45) * 0.6 + dNoise(p * 1.7) * 0.4; // bedrock breaks through in slabs
  float wRock = clamp(rocky * 1.1 + smoothstep(0.42, 0.62, slope) * (1.0 - terr) + desert * 0.35, 0.0, 1.0);
  wRock = smoothstep(0.45, 0.62, wRock * (0.55 + breakup * 0.9) + (rockH - 0.5) * 0.5);
  float wWall = smoothstep(0.25, 0.5, terr) * smoothstep(0.3, 0.45, slope);
  float wSoil = clamp(path * 1.3 + terr * (1.0 - wWall) * 0.35 + smoothstep(0.62, 0.85, macro) * 0.55, 0.0, 1.0);
  wSoil = smoothstep(0.3, 0.7, wSoil + (macro2 - 0.5) * 0.4);
  vec3 col = mix(grass, soil, wSoil);
  // dusty worn path — lighter compacted earth
  col = mix(col, mix(soil, vec3(0.62, 0.52, 0.40), 0.55), path * 0.8);
  // wadi bed: pale gravel & cobbles
  vec3 gravel = mix(texture2D(tRock, p / 1.7).rgb * vec3(0.95, 0.88, 0.76), soil * 1.15, 0.5);
  col = mix(col, gravel, wadi);
  // exposed bedrock reads as stony, grey-brown ground (the big bright boulders are real 3D rocks)
  vec3 stony = mix(soil * 0.95, rock * 0.8, 0.55 + 0.25 * rockH);
  col = mix(col, stony, wRock * 0.85);
  col = mix(col, wall, wWall);
  // desert far away: bare pinkish-tan chalk
  col = mix(col, mix(vec3(0.74, 0.60, 0.46), rock, 0.35), desert * 0.85);
  // distance: soften high-frequency detail into average colour (reduces shimmer)
  float df = smoothstep(120.0, 900.0, dist);
  vec3 farCol = mix(vec3(0.66, 0.53, 0.33), rock * 0.92, wRock) * mix(0.85, 1.12, macro);
  farCol = mix(farCol, farCol * vec3(0.55, 0.56, 0.44), scrub * 0.7);
  col = mix(col, farCol, df * 0.55);
  col = mix(col, col * 0.86, wRock * (1.0 - rockH) * 0.5);
  // garrigue speckle: dark shrubs dotting the hills, readable at mid/far distance
  float cover = smoothstep(0.25, 0.65, dNoise(p * 0.025 + 4.0));
  float bush = dCellDots(p * 0.45 + 11.0, 0.3) * (0.35 + 0.65 * cover) + dCellDots(p * 0.16 - 5.0, 0.24) * 0.9 * cover + dCellDots(p * 0.07 + 2.0, 0.18) * 0.7;
  bush *= (1.0 - wRock * 0.5) * (1.0 - path) * (1.0 - wadi) * smoothstep(14.0, 45.0, dist);
  vec3 bushCol = mix(vec3(0.19, 0.2, 0.12), vec3(0.3, 0.29, 0.2), dNoise(p * 0.9));
  col = mix(col, bushCol, clamp(bush, 0.0, 1.0) * 0.8);
  diffuseColor.rgb *= col;

  // ---- normals (UDN blend in world space)
  vec3 nG = tNormal(tGrassN, gUV1);
  vec3 nS = tNormal(tSoilN, p / 4.2);
  vec3 nRx = tNormal(tRockN, rp.zy), nRy = tNormal(tRockN, rp.xz), nRz = tNormal(tRockN, rp.xy);
  vec3 nW = tNormal(tWallN, wallUV);
  vec3 tn = mix(nG, nS, wSoil);
  tn = mix(tn, nS, wadi);
  vec3 wn = normalize(N + vec3(tn.x, 0.0, -tn.y) * 0.9);
  vec3 rockN = normalize(
      bw.x * normalize(vec3(0.0, nRx.y, nRx.x) + N) +
      bw.y * normalize(vec3(nRy.x, 0.0, -nRy.y) + N) +
      bw.z * normalize(vec3(nRz.x, nRz.y, 0.0) + N));
  wn = normalize(mix(wn, rockN, wRock));
  vec3 wallN = abs(N.x) > abs(N.z) ? normalize(N + vec3(0.0, nW.y, nW.x * sign(N.x)) * 1.2) : normalize(N + vec3(nW.x * sign(N.z), nW.y, 0.0) * 1.2);
  wn = normalize(mix(wn, wallN, wWall));
  wn = normalize(mix(wn, N, df));
  terrainNormalW = wn;
  terrainRough = mix(0.96, 0.82, wRock);
}`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `normal = normalize((viewMatrix * vec4(terrainNormalW, 0.0)).xyz);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = terrainRough;`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
reflectedLight.directDiffuse *= vSun;
reflectedLight.directSpecular *= vSun;
reflectedLight.indirectDiffuse *= mix(0.72, 1.0, vSun);`,
      );
  };
  mat.customProgramCacheKey = () => 'terrain-v1';
  return mat;
}
