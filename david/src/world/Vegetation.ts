import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, smoothstep, Simplex2 } from '../core/noise';
import { shared } from '../core/Shared';
import type { Colliders } from '../core/Colliders';
import type { Terrain } from './Terrain';
import type { TextureSet } from './Textures';
import { FAR_HALF, LAYOUT, NEAR_HALF } from './Layout';

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

/** Several crossing leaf cards with normals pointing away from the canopy centre (soft volumetric shading). */
function leafCluster(center: THREE.Vector3, size: number, canopyCenter: THREE.Vector3, rnd: () => number, cards = 3) {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < cards; k++) {
    const g = new THREE.PlaneGeometry(size, size);
    const e = new THREE.Euler(rnd() * Math.PI, rnd() * Math.PI * 2, rnd() * Math.PI);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(e));
    g.translate(center.x, center.y, center.z);
    parts.push(g);
  }
  const m = mergeGeometries(parts)!;
  const pos = m.getAttribute('position') as THREE.BufferAttribute;
  const nor = m.getAttribute('normal') as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).sub(canopyCenter);
    p.y *= 0.6;
    p.normalize().lerp(new THREE.Vector3(0, 1, 0), 0.25).normalize();
    nor.setXYZ(i, p.x, p.y, p.z);
  }
  return m;
}

interface TreeGeo { bark: THREE.BufferGeometry; leaves: THREE.BufferGeometry; height: number; trunkR: number }

function oliveTree(seed: number): TreeGeo {
  const rnd = mulberry32(seed);
  const barkParts: THREE.BufferGeometry[] = [];
  const leafParts: THREE.BufferGeometry[] = [];
  const stems = 2 + Math.floor(rnd() * 2);
  const canopy = new THREE.Vector3(0, 3.3 + rnd() * 0.6, 0);
  const tips: THREE.Vector3[] = [];
  for (let s = 0; s < stems; s++) {
    const a = (s / stems) * Math.PI * 2 + rnd();
    const lean = 0.35 + rnd() * 0.5;
    const h = 1.5 + rnd() * 0.8;
    const base = new THREE.Vector3(Math.cos(a) * 0.12, -0.3, Math.sin(a) * 0.12);
    const mid = new THREE.Vector3(Math.cos(a + 0.8) * lean * 0.5, h * 0.5, Math.sin(a + 0.8) * lean * 0.5);
    const top = new THREE.Vector3(Math.cos(a) * lean, h, Math.sin(a) * lean);
    barkParts.push(gnarlyTube([base, base.clone().setY(0.3), mid, top], 0.24 - s * 0.03, 0.13, 14, 9, 0.28, seed + s));
    const nb = 2 + Math.floor(rnd() * 2);
    for (let b = 0; b < nb; b++) {
      const ba = a + (rnd() - 0.5) * 2.2;
      const len = 1.3 + rnd() * 1.1;
      const end = top.clone().add(new THREE.Vector3(Math.cos(ba) * len, 0.9 + rnd() * 1.1, Math.sin(ba) * len));
      const m = top.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.25, 0));
      barkParts.push(gnarlyTube([top.clone().add(new THREE.Vector3(0, -0.1, 0)), m, end], 0.11, 0.035, 8, 6, 0.18, seed * 7 + b));
      tips.push(end, m);
    }
  }
  for (const t of tips) {
    const n = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const c = t.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.4, (rnd() - 0.2) * 0.9, (rnd() - 0.5) * 1.4));
      leafParts.push(leafCluster(c, 1.5 + rnd() * 0.9, canopy, rnd));
    }
  }
  // fill the crown
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.8 + rnd() * 1.6;
    const c = canopy.clone().add(new THREE.Vector3(Math.cos(a) * r, (rnd() - 0.3) * 1.2, Math.sin(a) * r));
    leafParts.push(leafCluster(c, 1.7 + rnd() * 0.8, canopy, rnd));
  }
  return { bark: mergeGeometries(barkParts)!, leaves: mergeGeometries(leafParts)!, height: 5, trunkR: 0.45 };
}

function oakTree(seed: number): TreeGeo {
  const rnd = mulberry32(seed);
  const barkParts: THREE.BufferGeometry[] = [];
  const leafParts: THREE.BufferGeometry[] = [];
  const h = 1.6 + rnd() * 0.7;
  const top = new THREE.Vector3((rnd() - 0.5) * 0.5, h, (rnd() - 0.5) * 0.5);
  barkParts.push(gnarlyTube([new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0, 0.5, 0), top], 0.3, 0.2, 10, 9, 0.18, seed));
  const canopy = new THREE.Vector3(0, h + 1.7, 0);
  const nb = 4 + Math.floor(rnd() * 3);
  for (let b = 0; b < nb; b++) {
    const a = (b / nb) * Math.PI * 2 + rnd() * 0.6;
    const len = 1.6 + rnd() * 1.0;
    const end = top.clone().add(new THREE.Vector3(Math.cos(a) * len, 1.2 + rnd() * 1.2, Math.sin(a) * len));
    const m = top.clone().lerp(end, 0.45).add(new THREE.Vector3(0, 0.2, 0));
    barkParts.push(gnarlyTube([top.clone().add(new THREE.Vector3(0, -0.2, 0)), m, end], 0.14, 0.04, 8, 6, 0.15, seed * 3 + b));
    for (let i = 0; i < 4; i++) {
      const c = end.clone().lerp(m, rnd() * 0.6).add(new THREE.Vector3((rnd() - 0.5) * 1.6, (rnd() - 0.3) * 1.0, (rnd() - 0.5) * 1.6));
      leafParts.push(leafCluster(c, 1.8 + rnd() * 0.8, canopy, rnd));
    }
  }
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * 2.3;
    const c = canopy.clone().add(new THREE.Vector3(Math.cos(a) * r, (rnd() - 0.4) * 1.6, Math.sin(a) * r));
    leafParts.push(leafCluster(c, 2.0 + rnd() * 0.8, canopy, rnd));
  }
  return { bark: mergeGeometries(barkParts)!, leaves: mergeGeometries(leafParts)!, height: 5.5, trunkR: 0.5 };
}

function shrubGeo(seed: number) {
  const rnd = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  const c = new THREE.Vector3(0, 0.3, 0);
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(1.0, 0.8);
    g.rotateY((i / 3) * Math.PI + rnd() * 0.3);
    g.rotateZ((rnd() - 0.5) * 0.3);
    g.translate(0, 0.3, 0);
    parts.push(g);
  }
  const top = new THREE.PlaneGeometry(0.95, 0.95);
  top.rotateX(-Math.PI / 2 + 0.25);
  top.translate(0, 0.55, 0);
  parts.push(top);
  const m = mergeGeometries(parts)!;
  const pos = m.getAttribute('position') as THREE.BufferAttribute;
  const nor = m.getAttribute('normal') as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).sub(c).normalize().lerp(new THREE.Vector3(0, 1, 0), 0.4).normalize();
    nor.setXYZ(i, p.x, p.y, p.z);
  }
  return m;
}

/** Adds wind sway, leaf flutter and back-lit translucency to a foliage material. */
export function foliageMaterial(map: THREE.Texture, opts: { sway: number; flutter: number; translucency: number; color?: number }) {
  const mat = new THREE.MeshStandardMaterial({
    map,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.82,
    metalness: 0,
    color: opts.color ?? 0xffffff,
  });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.uTime;
    s.uniforms.uSunDir = shared.uSunDir;
    s.uniforms.uSunColor = shared.uSunColor;
    s.uniforms.uWindStrength = shared.uWindStrength;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime; uniform float uWindStrength; varying vec3 vFolWPos;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  vec3 ip = vec3(0.0);
  #ifdef USE_INSTANCING
  ip = instanceMatrix[3].xyz;
  #endif
  float hgt = max(position.y, 0.0);
  float ph = ip.x * 0.11 + ip.z * 0.07;
  float sway = sin(uTime * 1.1 + ph) * 0.6 + sin(uTime * 2.3 + ph * 1.7) * 0.4;
  transformed.x += sway * ${opts.sway.toFixed(3)} * hgt * uWindStrength;
  transformed.z += sway * ${(opts.sway * 0.5).toFixed(3)} * hgt * uWindStrength;
  float fl = sin(uTime * 7.0 + dot(position, vec3(3.1, 2.3, 4.7)) + ph) * ${opts.flutter.toFixed(3)} * uWindStrength;
  transformed += normal * fl;
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
  mat.customProgramCacheKey = () => `foliage-${opts.sway}-${opts.flutter}-${opts.translucency}`;
  return mat;
}

// ---------------------------------------------------------------------------------------------
export class Vegetation {
  readonly group = new THREE.Group();
  readonly trees: { x: number; z: number; kind: 'olive' | 'oak' }[] = [];

  constructor(private terrain: Terrain, private tex: TextureSet, private colliders: Colliders, private quality: { treeScale: number; shrubs: number; farTrees: number }) {}

  build() {
    const barkMat = new THREE.MeshStandardMaterial({ map: this.tex.bark, normalMap: this.tex.barkN, roughness: 0.95, color: 0xd8d0c4 });
    barkMat.normalScale.set(1.2, 1.2);
    const oliveMat = foliageMaterial(this.tex.olive, { sway: 0.012, flutter: 0.02, translucency: 0.55 });
    const oakMat = foliageMaterial(this.tex.oak, { sway: 0.008, flutter: 0.015, translucency: 0.45 });
    const shrubMat = foliageMaterial(this.tex.shrub, { sway: 0.02, flutter: 0.01, translucency: 0.35 });

    const olives = [0, 1, 2, 3].map((i) => oliveTree(101 + i * 17));
    const oaks = [0, 1, 2].map((i) => oakTree(301 + i * 23));

    const rnd = mulberry32(2024);
    const oliveSpots: THREE.Matrix4[][] = olives.map(() => []);
    const oakSpots: THREE.Matrix4[][] = oaks.map(() => []);
    const L = LAYOUT;
    const tryPlace = (x: number, z: number, r: number) => this.colliders.free(x, z, r);

    // --- olive groves on the terraces + scattered olives
    const oliveTarget = Math.round(620 * this.quality.treeScale);
    for (let tries = 0; tries < oliveTarget * 25 && this.trees.length < oliveTarget; tries++) {
      const x = (rnd() * 2 - 1) * (NEAR_HALF - 8);
      const z = (rnd() * 2 - 1) * (NEAR_HALF - 8);
      const m = this.terrain.maskAt(x, z);
      const slope = this.terrain.slopeAt(x, z);
      if (slope > 0.22 || m.path > 0.1 || m.wadi > 0.05) continue;
      if (Math.hypot(x - L.pasture.x, z - L.pasture.z) < L.pasture.r + 8) continue;
      if (Math.hypot(x - L.start.x, z - L.start.z) < 14) continue;
      if (Math.hypot(x - L.targets.x, z - L.targets.z) < 12) continue;
      const dv = Math.hypot(x - L.bethlehem.x, z - L.bethlehem.z);
      if (dv < L.bethlehem.r - 4) continue;
      const p = m.terrace * 0.75 + 0.04 + (dv < L.bethlehem.r + 160 ? 0.1 : 0);
      if (rnd() > p) continue;
      if (!tryPlace(x, z, 6.5)) continue;
      const v = Math.floor(rnd() * olives.length);
      const s = 0.8 + rnd() * 0.45;
      const y = this.terrain.heightAt(x, z);
      oliveSpots[v].push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * Math.PI * 2, 0)), new THREE.Vector3(s, s * (0.9 + rnd() * 0.2), s)));
      this.colliders.add({ x, z, r: 0.42 * s, tag: 'tree' });
      this.trees.push({ x, z, kind: 'olive' });
    }
    // --- oak / terebinth thicket (the bear's cover) + scattered oaks along the wadi
    let oakCount = 0;
    for (let tries = 0; tries < 6000 && oakCount < 90 * this.quality.treeScale + 20; tries++) {
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
        if (!(m.wadi > 0.0 || rnd() < 0.06)) continue;
      }
      const m = this.terrain.maskAt(x, z);
      if (m.path > 0.1 || m.wadi > 0.4) continue;
      if (Math.hypot(x - L.pasture.x, z - L.pasture.z) < L.pasture.r + 10) continue;
      if (Math.hypot(x - L.start.x, z - L.start.z) < 16) continue;
      // keep a clearing in the thicket for the fight
      if (Math.hypot(x - L.thicket.x, z - L.thicket.z) < 16) continue;
      if (Math.hypot(x - L.bethlehem.x, z - L.bethlehem.z) < L.bethlehem.r) continue;
      if (!tryPlace(x, z, 4.2)) continue;
      const v = Math.floor(rnd() * oaks.length);
      const s = 0.8 + rnd() * 0.5;
      const y = this.terrain.heightAt(x, z);
      oakSpots[v].push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * Math.PI * 2, 0)), new THREE.Vector3(s, s, s)));
      this.colliders.add({ x, z, r: 0.45 * s, tag: 'tree' });
      this.trees.push({ x, z, kind: 'oak' });
      oakCount++;
    }

    const addInstanced = (geos: TreeGeo[], spots: THREE.Matrix4[][], leafMat: THREE.Material) => {
      geos.forEach((g, i) => {
        if (!spots[i].length) return;
        const bark = new THREE.InstancedMesh(g.bark, barkMat, spots[i].length);
        const leaves = new THREE.InstancedMesh(g.leaves, leafMat, spots[i].length);
        spots[i].forEach((m, k) => {
          bark.setMatrixAt(k, m);
          leaves.setMatrixAt(k, m);
        });
        bark.castShadow = leaves.castShadow = true;
        bark.receiveShadow = leaves.receiveShadow = true;
        bark.computeBoundingSphere();
        leaves.computeBoundingSphere();
        this.group.add(bark, leaves);
      });
    };
    addInstanced(olives, oliveSpots, oliveMat);
    addInstanced(oaks, oakSpots, oakMat);

    // --- thorny burnet shrubs (סִירָה) and low scrub
    const shrubs = [shrubGeo(5), shrubGeo(6)];
    const shrubSpots: THREE.Matrix4[][] = [[], []];
    const shrubTarget = this.quality.shrubs;
    let placed = 0;
    for (let tries = 0; tries < shrubTarget * 12 && placed < shrubTarget; tries++) {
      const x = (rnd() * 2 - 1) * (NEAR_HALF - 4);
      const z = (rnd() * 2 - 1) * (NEAR_HALF - 4);
      const m = this.terrain.maskAt(x, z);
      if (m.path > 0.2 || m.wadi > 0.6) continue;
      if (Math.hypot(x - L.pasture.x, z - L.pasture.z) < 9) continue;
      if (Math.hypot(x - L.bethlehem.x, z - L.bethlehem.z) < L.bethlehem.r) continue;
      const p = 0.25 + m.rock * 0.6 + (1 - m.grass) * 0.2;
      if (rnd() > p) continue;
      if (!this.colliders.free(x, z, 0.4)) continue;
      const s = 0.6 + rnd() * 0.9;
      const y = this.terrain.heightAt(x, z) - 0.05;
      const v = rnd() < 0.5 ? 0 : 1;
      shrubSpots[v].push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * Math.PI * 2, 0)), new THREE.Vector3(s, s * (0.7 + rnd() * 0.5), s)));
      placed++;
    }
    shrubs.forEach((g, i) => {
      const im = new THREE.InstancedMesh(g, shrubMat, shrubSpots[i].length);
      shrubSpots[i].forEach((m, k) => im.setMatrixAt(k, m));
      im.castShadow = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      this.group.add(im);
    });

    this.buildFarTrees(rnd);
  }

  /** Cheap dark canopies speckling the distant hills (olive orchards seen from afar). */
  private buildFarTrees(rnd: () => number) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    geo.scale(2.6, 2.0, 2.6);
    geo.translate(0, 2.2, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x4d5432, roughness: 1 });
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
      const s = 0.8 + rnd() * 0.6;
      im.setMatrixAt(k, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
      im.setColorAt(k, color.setHSL(0.19 + rnd() * 0.04, 0.25, 0.22 + rnd() * 0.08));
      k++;
    }
    im.count = k;
    im.computeBoundingSphere();
    im.receiveShadow = false;
    this.group.add(im);
  }
}
