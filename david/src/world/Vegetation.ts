import * as THREE from 'three';
import { mulberry32, smoothstep, Simplex2 } from '../core/noise';
import { shared } from '../core/Shared';
import type { Colliders } from '../core/Colliders';
import type { ShadowCaster, Terrain } from './Terrain';
import type { TextureSet } from './Textures';
import { FAR_HALF, LAYOUT, NEAR_HALF } from './Layout';
import { bushTree, carobTree, cypressTree, oakTree, oliveTree, type TreeDetail, type TreeGeo } from './TreeGen';
import { perTier, worldTier, type WorldTier } from './WorldQuality';

const NZ = new Simplex2(777);

/** Tapered, gnarled tube along a curve. UV: x around, y along (bark fissures run along the limb). */
export function gnarlyTube(points: THREE.Vector3[], r0: number, r1: number, tubular: number, radial: number, gnarl: number, seed: number) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  const geo = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const len = curve.getLength();
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, c);
    let r = THREE.MathUtils.lerp(r0, r1, Math.pow(t, 0.8));
    r *= 1 + 0.55 * Math.exp(-t * 9) * (r0 > 0.15 ? 1 : 0); // root flare on trunks
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c);
      const a = (j / radial) * Math.PI * 2;
      const n = NZ.noise(Math.cos(a) * 1.3 + seed, t * len * 1.4 + Math.sin(a) * 1.3) * gnarl + NZ.noise(a * 2.0 + seed * 3, t * len * 4) * gnarl * 0.35;
      v.multiplyScalar(r * (1 + n));
      pos.setXYZ(k, c.x + v.x, c.y + v.y, c.z + v.z);
      uv.setXY(k, (j / radial) * Math.max(1, Math.round(r * 6)), (t * len) / 1.3);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/** GLSL wind: whole-plant sway (by `aWind.x` weight) + gusts travelling across the hills + leaf flutter. */
const WIND_VERT = /* glsl */ `
  vec3 ip = vec3(0.0);
  #ifdef USE_INSTANCING
  ip = instanceMatrix[3].xyz;
  #endif
  float wW = aWind.x;
  float ph = ip.x * 0.11 + ip.z * 0.07 + aWind.y * 6.2831;
  vec2 wdir = normalize(uWind.xz + 1e-4);
  float gust = 0.55 + 0.45 * sin(uTime * 0.7 - dot(ip.xz, wdir) * 0.045) * sin(uTime * 0.23 + ip.x * 0.013);
  float sway = (sin(uTime * 1.3 + ph) * 0.6 + sin(uTime * 2.1 + ph * 1.7) * 0.4) * gust;
  transformed.xz += wdir * (sway * 0.5 + gust * 0.6) * uSway * wW * uWindStrength;
  transformed.y -= abs(sway) * uSway * 0.25 * wW * wW * uWindStrength;
`;

/**
 * Leaf-card material: alpha-tested atlas (alpha-to-coverage with MSAA), per-card tint / crown occlusion from
 * vertex colours, wind, back-lit translucency and coverage-preserving alpha at a distance (mip compensation).
 */
export function foliageMaterial(map: THREE.Texture, opts: { sway: number; flutter: number; translucency: number; color?: number; roughness?: number }) {
  const mat = new THREE.MeshStandardMaterial({
    map,
    alphaTest: 0.5,
    alphaToCoverage: true,
    side: THREE.DoubleSide,
    roughness: opts.roughness ?? 0.72,
    metalness: 0,
    color: opts.color ?? 0xffffff,
    vertexColors: true,
  });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.uTime;
    s.uniforms.uSunDir = shared.uSunDir;
    s.uniforms.uSunColor = shared.uSunColor;
    s.uniforms.uWindStrength = shared.uWindStrength;
    s.uniforms.uWind = shared.uWind;
    s.uniforms.uSway = { value: opts.sway };
    s.uniforms.uFlutter = { value: opts.flutter };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime; uniform float uWindStrength; uniform vec3 uWind; uniform float uSway; uniform float uFlutter;
attribute vec2 aWind; varying vec3 vFolWPos; varying float vFolDepth;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
${WIND_VERT}
  float fl = sin(uTime * 6.5 + dot(position, vec3(3.1, 2.3, 4.7)) + ph) * uFlutter * wW * uWindStrength;
  transformed += objectNormal * fl;
}`,
      )
      .replace('#include <project_vertex>', `#include <project_vertex>
{
  vec4 wp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  #endif
  vFolWPos = (modelMatrix * wp).xyz;
}`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uSunDir; uniform vec3 uSunColor; varying vec3 vFolWPos;`)
      // cards are double sided but carry crown normals: keep them pointing out of the crown on both faces
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
#ifdef DOUBLE_SIDED
normal *= faceDirection;
#endif`)
      .replace(
        '#include <alphatest_fragment>',
        `{
  // keep canopies full at a distance: mip-averaged alpha shrinks, so scale it back up with the mip level
  #ifdef USE_MAP
  vec2 dx = dFdx(vMapUv * 1024.0), dy = dFdy(vMapUv * 1024.0);
  float lod = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
  diffuseColor.a *= 1.0 + lod * 0.28;
  #endif
}
#include <alphatest_fragment>`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  vec3 vd = normalize(vFolWPos - cameraPosition);
  float back = pow(max(dot(vd, uSunDir), 0.0), 3.0);
  totalEmissiveRadiance += diffuseColor.rgb * uSunColor * back * ${opts.translucency.toFixed(3)};
}`,
      );
  };
  mat.customProgramCacheKey = () => `foliage2-${opts.sway}-${opts.flutter}-${opts.translucency}`;
  return mat;
}

/** Bark with the same wind sway as the leaves (limbs move with the crown). */
function barkMaterial(tex: TextureSet, sway: number, color: number) {
  const mat = new THREE.MeshStandardMaterial({ map: tex.bark, normalMap: tex.barkN, roughness: 0.93, metalness: 0, color });
  mat.normalScale.set(1.3, 1.3);
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.uTime;
    s.uniforms.uWindStrength = shared.uWindStrength;
    s.uniforms.uWind = shared.uWind;
    s.uniforms.uSway = { value: sway };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime; uniform float uWindStrength; uniform vec3 uWind; uniform float uSway; attribute vec2 aWind;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
${WIND_VERT}
}`);
  };
  mat.customProgramCacheKey = () => `bark2-${sway}-${color}`;
  return mat;
}

type Kind = 'olive' | 'oak' | 'terebinth' | 'carob' | 'cypress' | 'bush';

// ---------------------------------------------------------------------------------------------
export class Vegetation {
  readonly group = new THREE.Group();
  readonly trees: { x: number; z: number; kind: Kind }[] = [];
  readonly tier: WorldTier;

  constructor(private terrain: Terrain, private tex: TextureSet, private colliders: Colliders, private quality: { treeScale: number; shrubs: number; farTrees: number; name?: string }) {
    this.tier = worldTier(quality);
  }

  build() {
    const tier = this.tier;
    const q = <T,>(lo: T, med: T, hi: T) => perTier(tier, lo, med, hi);
    const detail: TreeDetail = { radial: q(5, 6, 8), rings: q(1.4, 2.0, 2.5), cards: q(0.6, 0.85, 1) };
    const tex = this.tex;
    const barkOlive = barkMaterial(tex, 0.05, 0xc9c2b4);
    const barkDark = barkMaterial(tex, 0.05, 0x8f877b);
    const oliveMat = foliageMaterial(tex.olive, { sway: 0.06, flutter: 0.025, translucency: 0.5, roughness: 0.6 });
    const oakMat = foliageMaterial(tex.broadleaf, { sway: 0.045, flutter: 0.018, translucency: 0.4, roughness: 0.62 });
    const cypressMat = foliageMaterial(tex.cypress, { sway: 0.05, flutter: 0.008, translucency: 0.25, roughness: 0.78 });
    const cypressCore = new THREE.MeshStandardMaterial({ color: 0x2f3d24, roughness: 0.88, vertexColors: true });
    const bushMat = foliageMaterial(tex.broadleaf, { sway: 0.03, flutter: 0.015, translucency: 0.3, roughness: 0.66, color: 0xd8dcc8 });

    const variants: Record<Kind, TreeGeo[]> = {
      olive: [0, 1, 2, 3, 4].slice(0, q(3, 4, 5)).map((i) => oliveTree(101 + i * 17, detail)),
      oak: [0, 1, 2].slice(0, q(2, 3, 3)).map((i) => oakTree(301 + i * 23, detail, 'oak')),
      terebinth: [0, 1].map((i) => oakTree(401 + i * 29, detail, 'terebinth')),
      carob: [0, 1].slice(0, q(1, 2, 2)).map((i) => carobTree(501 + i * 31, detail)),
      cypress: [0, 1, 2].slice(0, q(2, 3, 3)).map((i) => cypressTree(601 + i * 37, detail)),
      bush: [0, 1, 2].map((i) => bushTree(701 + i * 41, detail)),
    };
    const spots: Record<Kind, THREE.Matrix4[][]> = {
      olive: variants.olive.map(() => []),
      oak: variants.oak.map(() => []),
      terebinth: variants.terebinth.map(() => []),
      carob: variants.carob.map(() => []),
      cypress: variants.cypress.map(() => []),
      bush: variants.bush.map(() => []),
    };
    const rnd = mulberry32(2024);
    const L = LAYOUT;
    const shadows: ShadowCaster[] = [];
    const sunH = shared.uSunDir.value;
    void sunH;
    const place = (kind: Kind, x: number, z: number, s: number, collR: number) => {
      const vs = variants[kind];
      const vi = Math.floor(rnd() * vs.length);
      const g = vs[vi];
      const y = this.terrain.heightAt(x, z) - 0.05;
      const sy = s * (0.9 + rnd() * 0.2);
      spots[kind][vi].push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * Math.PI * 2, 0)), new THREE.Vector3(s, sy, s)));
      this.colliders.add({ x, z, r: collR * s, tag: 'tree' });
      this.trees.push({ x, z, kind });
      this.terrain.suppressGrass(x, z, g.trunkR * s * 2.2, 0.7);
      const cr = g.crownR * s;
      if (kind === 'cypress') shadows.push({ x, z, r: cr * 0.7, h0: 0.5 * sy, h1: g.height * sy, k: 0.92, ao: cr * 1.3 });
      else shadows.push({ x, z, r: cr * 0.8, h0: (g.crownY - cr * 0.55) * sy, h1: (g.crownY + cr * 0.45) * sy, k: kind === 'olive' ? 0.72 : 0.85, ao: cr * 1.25 });
    };
    const blocked = (x: number, z: number) =>
      Math.hypot(x - L.pasture.x, z - L.pasture.z) < L.pasture.r + 8 ||
      Math.hypot(x - L.start.x, z - L.start.z) < 14 ||
      Math.hypot(x - L.targets.x, z - L.targets.z) < 12 ||
      Math.hypot(x - L.stones.x, z - L.stones.z) < 14 ||
      Math.hypot(x - L.thicket.x, z - L.thicket.z) < 16 ||
      Math.hypot(x - L.bethlehem.x, z - L.bethlehem.z) < L.bethlehem.r - 4;
    const ts = this.quality.treeScale;

    // --- olive groves on the terrace treads, scattered olives, orchards around the town
    const oliveTarget = Math.round(880 * ts);
    let olives = 0;
    for (let tries = 0; tries < oliveTarget * 30 && olives < oliveTarget; tries++) {
      const x = (rnd() * 2 - 1) * (NEAR_HALF - 8);
      const z = (rnd() * 2 - 1) * (NEAR_HALF - 8);
      const m = this.terrain.maskAt(x, z);
      if (m.path > 0.1 || m.wadi > 0.05 || blocked(x, z)) continue;
      const slope = this.terrain.slopeAt(x, z);
      if (slope > 0.22) continue; // not on a riser / steep bank
      const dv = Math.hypot(x - L.bethlehem.x, z - L.bethlehem.z);
      const grove = smoothstep(0.1, 0.45, NZ.fbm(x / 140 + 3, z / 140 - 2, 2) + 0.2);
      const p = m.terrace * 0.8 * grove + 0.055 + (dv < L.bethlehem.r + 170 ? 0.12 : 0);
      if (rnd() > p) continue;
      if (!this.colliders.free(x, z, 3.4)) continue;
      place('olive', x, z, 0.75 + rnd() * 0.45, 0.42);
      olives++;
    }
    // --- Palestine oak / terebinth thicket (the bear's cover) + oaks on rocky slopes and along the wadi
    let oaks = 0;
    const oakTarget = Math.round(110 * ts + 30);
    for (let tries = 0; tries < 9000 && oaks < oakTarget; tries++) {
      let x: number, z: number;
      if (rnd() < 0.55) {
        const a = rnd() * Math.PI * 2;
        const r = Math.sqrt(rnd()) * (L.thicket.r + 25);
        x = L.thicket.x + Math.cos(a) * r + 20;
        z = L.thicket.z + Math.sin(a) * r * 0.8 - 12;
      } else {
        x = (rnd() * 2 - 1) * (NEAR_HALF - 8);
        z = (rnd() * 2 - 1) * (NEAR_HALF - 8);
        const m = this.terrain.maskAt(x, z);
        if (!(m.wadi > 0.0 || m.rock > 0.45 || rnd() < 0.04)) continue;
      }
      const m = this.terrain.maskAt(x, z);
      if (m.path > 0.1 || m.wadi > 0.4 || blocked(x, z)) continue;
      if (!this.colliders.free(x, z, 3.0)) continue;
      place(rnd() < 0.7 ? 'oak' : 'terebinth', x, z, 0.8 + rnd() * 0.5, 0.45);
      oaks++;
    }
    // --- carobs: single, broad domes on the slopes
    const carobTarget = Math.round(34 * ts + 6);
    let carobs = 0;
    for (let tries = 0; tries < 4000 && carobs < carobTarget; tries++) {
      const x = (rnd() * 2 - 1) * (NEAR_HALF - 10);
      const z = (rnd() * 2 - 1) * (NEAR_HALF - 10);
      const m = this.terrain.maskAt(x, z);
      if (m.path > 0.1 || m.wadi > 0.1 || blocked(x, z) || this.terrain.slopeAt(x, z) > 0.3) continue;
      if (!this.colliders.free(x, z, 5)) continue;
      place('carob', x, z, 0.85 + rnd() * 0.35, 0.5);
      carobs++;
    }
    // --- cypresses: dark flames around the town wall, pairs along the path, a few on the terraces
    const cypTarget = Math.round(80 * ts + 10);
    let cyps = 0;
    for (let tries = 0; tries < 6000 && cyps < cypTarget; tries++) {
      let x: number, z: number;
      const r0 = rnd();
      if (r0 < 0.5) {
        const a = rnd() * Math.PI * 2, r = L.bethlehem.r + 8 + Math.pow(rnd(), 1.5) * 70;
        x = L.bethlehem.x + Math.cos(a) * r;
        z = L.bethlehem.z + Math.sin(a) * r;
      } else if (r0 < 0.72) {
        const seg = Math.floor(rnd() * (L.path.length - 1));
        const [ax, az] = L.path[seg], [bx, bz] = L.path[seg + 1];
        const t = rnd();
        const nx = -(bz - az), nz = bx - ax, nl = Math.hypot(nx, nz) || 1;
        const off = (rnd() < 0.5 ? -1 : 1) * (4 + rnd() * 5);
        x = ax + (bx - ax) * t + (nx / nl) * off;
        z = az + (bz - az) * t + (nz / nl) * off;
      } else {
        x = (rnd() * 2 - 1) * (NEAR_HALF - 10);
        z = (rnd() * 2 - 1) * (NEAR_HALF - 10);
        if (this.terrain.maskAt(x, z).terrace < 0.3) continue;
      }
      const m = this.terrain.maskAt(x, z);
      if (m.path > 0.1 || m.wadi > 0.1 || blocked(x, z) || this.terrain.slopeAt(x, z) > 0.3) continue;
      if (!this.colliders.free(x, z, 1.4)) continue;
      place('cypress', x, z, 0.85 + rnd() * 0.35, 0.35);
      cyps++;
      // clumps of 2-4
      const extra = rnd() < 0.6 ? 1 + Math.floor(rnd() * 3) : 0;
      for (let e = 0; e < extra && cyps < cypTarget; e++) {
        const a = rnd() * Math.PI * 2, rr = 2.2 + rnd() * 2.2;
        const ex = x + Math.cos(a) * rr, ez = z + Math.sin(a) * rr;
        if (blocked(ex, ez) || !this.colliders.free(ex, ez, 1.2) || this.terrain.maskAt(ex, ez).path > 0.1) continue;
        place('cypress', ex, ez, 0.75 + rnd() * 0.4, 0.35);
        cyps++;
      }
    }

    // --- evergreen maquis bushes (mastic, buckthorn, young oaks): the dark dots all over the hillsides
    const bushTarget = Math.round(q(900, 1800, 2600) * Math.min(1.2, ts + 0.2));
    let bushes = 0;
    for (let tries = 0; tries < bushTarget * 12 && bushes < bushTarget; tries++) {
      const x = (rnd() * 2 - 1) * (NEAR_HALF - 6);
      const z = (rnd() * 2 - 1) * (NEAR_HALF - 6);
      const m = this.terrain.maskAt(x, z);
      if (m.path > 0.1 || m.wadi > 0.55 || blocked(x, z)) continue;
      const patch = smoothstep(-0.25, 0.45, NZ.fbm(x / 60 - 11, z / 60 + 4, 3));
      const p = (0.1 + m.rock * 0.5 + m.wadi * 0.5 + (1 - m.terrace) * 0.12) * (0.2 + 0.8 * patch);
      if (rnd() > p) continue;
      if (!this.colliders.free(x, z, 1.1)) continue;
      const vs = variants.bush;
      const vi = Math.floor(rnd() * vs.length);
      const s = 0.7 + rnd() * 0.8;
      const y = this.terrain.heightAt(x, z) - 0.08;
      spots.bush[vi].push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * Math.PI * 2, 0)), new THREE.Vector3(s * (0.9 + rnd() * 0.3), s * (0.7 + rnd() * 0.5), s * (0.9 + rnd() * 0.3))));
      if (s > 1.1) this.colliders.add({ x, z, r: 0.5 * s, tag: 'bush' });
      shadows.push({ x, z, r: vs[vi].crownR * s * 0.8, h0: 0, h1: vs[vi].height * s, k: 0.7, ao: vs[vi].crownR * s * 1.2 });
      bushes++;
    }

    // --- meshes
    const add = (kind: Kind, bark: THREE.Material, leaf: THREE.Material) => {
      variants[kind].forEach((g, i) => {
        const list = spots[kind][i];
        if (!list.length) return;
        const meshes: THREE.InstancedMesh[] = [new THREE.InstancedMesh(g.bark, bark, list.length), new THREE.InstancedMesh(g.leaves, leaf, list.length)];
        if (g.core) meshes.push(new THREE.InstancedMesh(g.core, cypressCore, list.length));
        for (const im of meshes) {
          list.forEach((m, k) => im.setMatrixAt(k, m));
          im.castShadow = true;
          im.receiveShadow = true;
          im.name = `tree-${kind}`;
          im.computeBoundingSphere();
          this.group.add(im);
        }
      });
    };
    add('olive', barkOlive, oliveMat);
    add('oak', barkDark, oakMat);
    add('terebinth', barkDark, oakMat);
    add('carob', barkDark, oakMat);
    add('cypress', barkDark, cypressMat);
    add('bush', barkDark, bushMat);

    this.buildShrubs(rnd);
    this.buildFarTrees(rnd);
    this.terrain.stampShadows(shadows);
    this.stats = { olives, oaks, carobs, cypresses: cyps, bushes };
  }

  stats = { olives: 0, oaks: 0, carobs: 0, cypresses: 0, bushes: 0 };

  /** Garrigue: thorny burnet cushions, Greek sage, dry thistles and wild-oat tufts (cross-card plants). */
  private buildShrubs(rnd: () => number) {
    const L = LAYOUT;
    const mat = foliageMaterial(this.tex.shrub, { sway: 0.07, flutter: 0.01, translucency: 0.35, roughness: 0.85 });
    // one star of 3 upright cards + a low tilted card; uv -> one atlas cell
    const plant = (cell: number, cards: number, tilt: number) => {
      const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], wind: number[] = [], idx: number[] = [];
      const cu = (cell % 2) * 0.5, cv = cell < 2 ? 0.5 : 0;
      for (let c = 0; c < cards; c++) {
        const a = (c / cards) * Math.PI + (c % 2) * 0.2;
        const dx = Math.cos(a), dz = Math.sin(a);
        const lean = c === cards - 1 && tilt > 0 ? tilt : 0;
        const base = pos.length / 3;
        const corners: [number, number][] = [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]];
        for (const [sx, sy] of corners) {
          const x = dx * sx, z = dz * sx;
          const y = sy * (1 - lean * 0.5);
          pos.push(x + (-dz) * lean * sy * 0.5, y - 0.02, z + dx * lean * sy * 0.5);
          const nx = x * 0.8, nz = z * 0.8;
          const l = Math.hypot(nx, 1, nz);
          nor.push(nx / l, 1 / l, nz / l);
          uv.push(cu + (sx + 0.5) * 0.499 + 0.0005, cv + sy * 0.499 + 0.0005);
          const ao = 0.6 + 0.4 * sy;
          col.push(ao, ao, ao);
          wind.push(sy * sy, c * 0.13);
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('aWind', new THREE.Float32BufferAttribute(wind, 2));
      g.setIndex(idx);
      g.computeBoundingSphere();
      return g;
    };
    const types = [
      { geo: plant(0, 3, 0.9), size: [0.55, 1.0], w: 0.38 }, // thorny burnet (סירה קוצנית)
      { geo: plant(1, 3, 0), size: [0.5, 0.95], w: 0.22 }, // sage (מרווה)
      { geo: plant(2, 2, 0), size: [0.6, 1.15], w: 0.14 }, // thistles (דרדר)
      { geo: plant(3, 3, 0), size: [0.45, 0.8], w: 0.26 }, // wild oats / barley grass
    ];
    const lists: THREE.Matrix4[][] = types.map(() => []);
    const colors: THREE.Color[][] = types.map(() => []);
    const target = Math.round(this.quality.shrubs * perTier(this.tier, 1.6, 2.2, 2.6));
    let placed = 0;
    const cw = types.reduce((a, t) => a + t.w, 0);
    for (let tries = 0; tries < target * 14 && placed < target; tries++) {
      const x = (rnd() * 2 - 1) * (NEAR_HALF - 4);
      const z = (rnd() * 2 - 1) * (NEAR_HALF - 4);
      const m = this.terrain.maskAt(x, z);
      if (m.path > 0.2 || m.wadi > 0.7) continue;
      if (Math.hypot(x - L.bethlehem.x, z - L.bethlehem.z) < L.bethlehem.r) continue;
      if (Math.hypot(x - L.stones.x, z - L.stones.z) < 6) continue;
      const pasture = Math.hypot(x - L.pasture.x, z - L.pasture.z) < L.pasture.r + 2;
      // garrigue grows in patches: rocky ground, field margins, wadi banks; the pasture is grazed short
      const patch = smoothstep(-0.2, 0.5, NZ.fbm(x / 45 + 7, z / 45 - 3, 3));
      const p = (0.12 + m.rock * 0.55 + m.wadi * 0.3 + m.terrace * 0.15) * (0.25 + 0.75 * patch) * (pasture ? 0.15 : 1);
      if (rnd() > p) continue;
      if (!this.colliders.free(x, z, 0.3)) continue;
      let pick = rnd() * cw, ti = 0;
      while (ti < types.length - 1 && (pick -= types[ti].w) > 0) ti++;
      if (m.rock > 0.5 && rnd() < 0.5) ti = 0; // burnet loves rocky ground
      const t = types[ti];
      const s = t.size[0] + rnd() * (t.size[1] - t.size[0]);
      const y = this.terrain.heightAt(x, z) - 0.04;
      lists[ti].push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.15, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.15)), new THREE.Vector3(s * (0.8 + rnd() * 0.4), s * (0.75 + rnd() * 0.5), s * (0.8 + rnd() * 0.4))));
      const k = 0.85 + rnd() * 0.3;
      colors[ti].push(new THREE.Color(k, k * (0.97 + rnd() * 0.06), k * (0.9 + rnd() * 0.1)));
      placed++;
    }
    types.forEach((t, i) => {
      if (!lists[i].length) return;
      const im = new THREE.InstancedMesh(t.geo, mat, lists[i].length);
      lists[i].forEach((m, k) => {
        im.setMatrixAt(k, m);
        im.setColorAt(k, colors[i][k]);
      });
      im.castShadow = this.tier !== 'low';
      im.receiveShadow = true;
      im.name = 'shrubs';
      im.computeBoundingSphere();
      this.group.add(im);
    });
  }

  /** Distant olive orchards and garrigue trees on the hills beyond the detailed area: lumpy lit blobs. */
  private buildFarTrees(rnd: () => number) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + 0.22 * Math.sin(x * 5.1 + y * 3.3) * Math.cos(z * 4.7 - y * 2.1);
      p.setXYZ(i, x * k, Math.max(y, -0.4) * k, z * k);
    }
    geo.computeVertexNormals();
    geo.scale(2.4, 1.7, 2.4);
    geo.translate(0, 2.0, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    const count = this.quality.farTrees;
    const im = new THREE.InstancedMesh(geo, mat, count);
    const color = new THREE.Color();
    let k = 0;
    for (let tries = 0; tries < count * 30 && k < count; tries++) {
      const r = NEAR_HALF * 0.9 + Math.pow(rnd(), 1.4) * 3200;
      const a = rnd() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) < NEAR_HALF && Math.abs(z) < NEAR_HALF) continue;
      if (x > 900 + rnd() * 600) continue; // desert: no trees
      if (Math.abs(x) > FAR_HALF || Math.abs(z) > FAR_HALF) continue;
      const orchard = smoothstep(0.1, 0.3, NZ.fbm(x / 260 - 4, z / 260 + 8, 3));
      if (rnd() > 0.08 + orchard * 0.85) continue;
      const y = this.terrain.farHeightAt(x, z) - 0.5;
      const s = 0.75 + rnd() * 0.6;
      const cyp = rnd() < 0.06;
      im.setMatrixAt(k, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), cyp ? new THREE.Vector3(s * 0.45, s * 2.6, s * 0.45) : new THREE.Vector3(s, s * (0.8 + rnd() * 0.3), s)));
      if (cyp) im.setColorAt(k, color.setRGB(0.1, 0.13, 0.08));
      else im.setColorAt(k, color.setHSL(0.17 + rnd() * 0.05, 0.2 + rnd() * 0.08, 0.2 + rnd() * 0.08));
      k++;
    }
    im.count = k;
    im.computeBoundingSphere();
    im.receiveShadow = false;
    im.name = 'far-trees';
    this.group.add(im);
  }
}
