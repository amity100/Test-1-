import * as THREE from 'three';
import { mulberry32, Simplex2 } from '../core/noise';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Colliders } from '../core/Colliders';
import type { Terrain } from './Terrain';
import type { TextureSet } from './Textures';
import { LAYOUT, NEAR_HALF } from './Layout';

const N = new Simplex2(555);

/** Weathered limestone boulder: a displaced, flattened icosphere with karst-like facets. */
export function boulderGeometry(seed: number, detail = 4) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const s = seed * 13.7;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n1 = N.noise(v.x * 1.2 + s, v.y * 1.2 + v.z * 0.7) + N.noise(v.z * 1.3 - s, v.y * 1.1 + v.x * 0.6);
    const n2 = N.noise(v.x * 3.5 + s, v.z * 3.5 + v.y) * 0.35;
    // flat-ish facets (planar cuts) typical of bedded limestone
    let r = 1 + n1 * 0.22 + n2 * 0.25;
    if (v.y > 0.45) r *= 1 - (v.y - 0.45) * 0.45;
    v.multiplyScalar(r);
    v.y *= 0.62;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function rockMaterial(tex: TextureSet, tint = 0xffffff) {
  const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.88, metalness: 0 });
  mat.onBeforeCompile = (s) => {
    s.uniforms.tRock = { value: tex.rock };
    s.uniforms.tRockN = { value: tex.rockN };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vRWPos; varying vec3 vRWNormal;`)
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
{
  vec4 wp = vec4(transformed, 1.0);
  vec3 wn = objectNormal;
  #ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  wn = mat3(instanceMatrix) * wn;
  #endif
  vRWPos = (modelMatrix * wp).xyz;
  vRWNormal = normalize(mat3(modelMatrix) * wn);
}`,
      );
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tRock; uniform sampler2D tRockN; varying vec3 vRWPos; varying vec3 vRWNormal; vec3 rockWN;`)
      .replace(
        '#include <map_fragment>',
        `{
  vec3 Nw = normalize(vRWNormal);
  vec3 bw = pow(abs(Nw), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
  vec3 p = vRWPos / 2.6;
  vec3 c = texture2D(tRock, p.zy).rgb * bw.x + texture2D(tRock, p.xz).rgb * bw.y + texture2D(tRock, p.xy).rgb * bw.z;
  // darker, dusty underside; sun-bleached tops
  c *= mix(0.72, 1.08, smoothstep(-0.6, 0.8, Nw.y));
  diffuseColor.rgb *= c;
  vec3 nx = texture2D(tRockN, p.zy).xyz * 2.0 - 1.0;
  vec3 ny = texture2D(tRockN, p.xz).xyz * 2.0 - 1.0;
  vec3 nz = texture2D(tRockN, p.xy).xyz * 2.0 - 1.0;
  rockWN = normalize(bw.x * normalize(vec3(0.0, nx.y, nx.x) + Nw) + bw.y * normalize(vec3(ny.x, 0.0, -ny.y) + Nw) + bw.z * normalize(vec3(nz.x, nz.y, 0.0) + Nw));
}`,
      )
      .replace('#include <normal_fragment_maps>', `normal = normalize((viewMatrix * vec4(rockWN, 0.0)).xyz);`);
  };
  mat.customProgramCacheKey = () => 'rock-triplanar';
  return mat;
}

export class Rocks {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshStandardMaterial;
  constructor(private terrain: Terrain, tex: TextureSet, private colliders: Colliders, private count: number) {
    this.material = rockMaterial(tex);
  }

  build() {
    const variants = [0, 1, 2, 3, 4].map((i) => boulderGeometry(i + 1));
    const spots: THREE.Matrix4[][] = variants.map(() => []);
    const rnd = mulberry32(31337);
    const L = LAYOUT;
    let placed = 0;
    const add = (x: number, z: number, s: number, sink: number, collide: boolean) => {
      const y = this.terrain.heightAt(x, z) - s * sink;
      const v = Math.floor(rnd() * variants.length);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.3, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.3));
      spots[v].push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s * (0.8 + rnd() * 0.5), s * (0.7 + rnd() * 0.5), s * (0.8 + rnd() * 0.5))));
      if (collide && s > 0.55) this.colliders.add({ x, z, r: s * 0.8, tag: 'rock' });
      placed++;
    };
    // The shepherd's rock: David's lookout above the pasture
    add(L.start.x + 1.8, L.start.z - 1.2, 2.2, 0.55, true);
    add(L.start.x - 2.6, L.start.z + 0.8, 1.4, 0.5, true);
    add(L.start.x + 0.6, L.start.z + 3.2, 1.0, 0.45, true);
    // scattered outcrops
    for (let tries = 0; tries < this.count * 20 && placed < this.count; tries++) {
      const x = (rnd() * 2 - 1) * (NEAR_HALF - 5);
      const z = (rnd() * 2 - 1) * (NEAR_HALF - 5);
      const m = this.terrain.maskAt(x, z);
      if (m.path > 0.3) continue;
      if (Math.hypot(x - L.pasture.x, z - L.pasture.z) < 7) continue;
      if (Math.hypot(x - L.bethlehem.x, z - L.bethlehem.z) < L.bethlehem.r - 5) continue;
      if (Math.hypot(x - L.thicket.x, z - L.thicket.z) < 10) continue;
      const slope = this.terrain.slopeAt(x, z);
      const riser = m.terrace * (slope > 0.3 ? 1 : 0);
      const p = m.rock * m.rock * 0.9 + riser * 0.35 + m.wadi * 0.45 + 0.003;
      if (rnd() > p) continue;
      const big = rnd() < 0.12 * (m.rock + 0.2);
      const s = big ? 1.2 + rnd() * 1.8 : 0.18 + Math.pow(rnd(), 2) * 0.9;
      if (!this.colliders.free(x, z, s * 0.7)) continue;
      add(x, z, s, 0.35, true);
      // limestone breaks up into clusters: scatter a few smaller stones around
      const extra = big ? 5 : s > 0.5 ? 2 : 0;
      for (let e = 0; e < extra && placed < this.count; e++) {
        const a = rnd() * Math.PI * 2, rr = s * (0.9 + rnd() * 1.6);
        const ex = x + Math.cos(a) * rr, ez = z + Math.sin(a) * rr;
        const es = s * (0.15 + rnd() * 0.35);
        if (this.colliders.free(ex, ez, es * 0.6)) add(ex, ez, es, 0.4, es > 0.55);
      }
    }
    variants.forEach((g, i) => {
      if (!spots[i].length) return;
      const im = new THREE.InstancedMesh(g, this.material, spots[i].length);
      spots[i].forEach((m, k) => im.setMatrixAt(k, m));
      im.castShadow = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      this.group.add(im);
    });
  }
}
