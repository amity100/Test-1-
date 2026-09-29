import * as THREE from 'three';
import { mulberry32, Simplex2, smoothstep } from '../core/noise';
import type { Colliders } from '../core/Colliders';
import type { ShadowCaster, Terrain } from './Terrain';
import type { TextureSet } from './Textures';
import { LAYOUT, NEAR_HALF } from './Layout';
import { rockGeometry, triCount, type RockKind } from './RockGen';
import { perTier, worldTier, type WorldTier } from './WorldQuality';
import { TerraceWalls } from './TerraceWalls';

const N = new Simplex2(555);

/** Weathered limestone boulder (kept for Props / Village): see RockGen for the shape model. */
export function boulderGeometry(seed: number, detail = 4) {
  return rockGeometry(seed, { kind: 'boulder', detail });
}

/**
 * Triplanar limestone material for rocks, walls and stone props. Uses the pitted limestone set (albedo, normal with
 * AO in alpha) in world space, plus per-vertex `aRock` (cavity, height-in-rock): dusty tops, soil-stained feet,
 * darker crevices; per-instance tint comes from InstancedMesh.instanceColor.
 * `scale` = texture tile in metres.
 */
export function rockMaterial(tex: TextureSet, tint = 0xffffff, scale = 1.15, key = 'rock') {
  const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.86, metalness: 0 });
  mat.onBeforeCompile = (s) => {
    s.uniforms.tRock = { value: tex.rock };
    s.uniforms.tRockN = { value: tex.rockN };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aRock;
varying vec3 vRWPos; varying vec3 vRWNormal; varying vec2 vRock; varying float vRSeed;`)
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
{
  vec4 wp = vec4(transformed, 1.0);
  vec3 wn = objectNormal;
  float seed = 0.0;
  #ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  wn = mat3(instanceMatrix) * wn;
  seed = fract(instanceMatrix[3].x * 0.137 + instanceMatrix[3].z * 0.211);
  #endif
  vRWPos = (modelMatrix * wp).xyz;
  vRWNormal = normalize(mat3(modelMatrix) * wn);
  vRock = aRock;
  vRSeed = seed;
}`,
      );
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tRock; uniform sampler2D tRockN;
varying vec3 vRWPos; varying vec3 vRWNormal; varying vec2 vRock; varying float vRSeed;
vec3 rockWN; float rockOcc; float rockRough;
float rHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }`)
      .replace(
        '#include <map_fragment>',
        `{
  vec3 Nw = normalize(vRWNormal);
  vec3 bw = pow(abs(Nw), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
  vec3 p = vRWPos / ${scale.toFixed(2)} + vRSeed * 7.31;
  vec4 ax = texture2D(tRock, p.zy), ay = texture2D(tRock, p.xz), az = texture2D(tRock, p.xy);
  vec4 nx = texture2D(tRockN, p.zy), ny = texture2D(tRockN, p.xz), nz = texture2D(tRockN, p.xy);
  vec3 c = ax.rgb * bw.x + ay.rgb * bw.y + az.rgb * bw.z;
  float tAO = nx.a * bw.x + ny.a * bw.y + nz.a * bw.z;
  // coarse tint variation so neighbouring rocks differ (grey / cream / warm)
  vec3 vp = floor(vRWPos * 0.7);
  float v1 = rHash(vp), v2 = rHash(vp + 31.7);
  c *= mix(vec3(0.9, 0.9, 0.9), vec3(1.04, 1.0, 0.94), v1) * mix(0.92, 1.06, v2);
  // dusty, sun-bleached tops; soil-stained foot; darker crevices
  float up = smoothstep(0.35, 0.95, Nw.y);
  c = mix(c, c * vec3(1.02, 0.97, 0.88) + vec3(0.05, 0.04, 0.025), up * 0.35);
  float foot = 1.0 - smoothstep(0.0, 0.28, vRock.y);
  c = mix(c, c * vec3(0.66, 0.53, 0.42), foot * 0.55);
  float cav = 1.0 - vRock.x;
  c *= mix(1.0, cav, 0.55);
  diffuseColor.rgb *= c;
  vec3 tnx = nx.xyz * 2.0 - 1.0, tny = ny.xyz * 2.0 - 1.0, tnz = nz.xyz * 2.0 - 1.0;
  rockWN = normalize(bw.x * normalize(Nw + vec3(0.0, tnx.y, tnx.x) * 1.15) + bw.y * normalize(Nw + vec3(tny.x, 0.0, tny.y) * 1.15) + bw.z * normalize(Nw + vec3(tnz.x, tnz.y, 0.0) * 1.15));
  rockOcc = cav * mix(1.0, tAO, 0.7);
  rockRough = mix(0.84, 0.93, up) - 0.06 * v2;
}`,
      )
      .replace('#include <normal_fragment_maps>', `normal = normalize((viewMatrix * vec4(rockWN, 0.0)).xyz);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = rockRough;`)
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
reflectedLight.indirectDiffuse *= rockOcc;
reflectedLight.indirectSpecular *= rockOcc;
reflectedLight.directDiffuse *= mix(1.0, rockOcc, 0.22);`,
      );
  };
  mat.customProgramCacheKey = () => 'rock-v2-' + key + scale.toFixed(2);
  return mat;
}

interface Placed { x: number; z: number; s: number; h: number }

export class Rocks {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshStandardMaterial;
  /** dry-stone terrace walls (built with the rocks; their meshes live in `group`) */
  walls: TerraceWalls | null = null;
  readonly tier: WorldTier;
  /** placed boulders (for other modules, e.g. vegetation avoiding them) */
  readonly placed: Placed[] = [];

  constructor(private terrain: Terrain, private tex: TextureSet, private colliders: Colliders, private count: number) {
    this.tier = worldTier({ rocks: count });
    this.material = rockMaterial(tex);
  }

  build() {
    const tier = this.tier;
    const L = LAYOUT;
    const rnd = mulberry32(31337);
    const q = (lo: number, med: number, hi: number) => perTier(tier, lo, med, hi);
    const budget = this.count / 3600;

    // --- geometry variants ------------------------------------------------------------------------
    type Variant = { geo: THREE.BufferGeometry; mats: THREE.Matrix4[]; colors: THREE.Color[]; shadow: boolean; kind: RockKind };
    const mk = (kind: RockKind, seeds: number[], detail: number, shadow: boolean, pits = 0): Variant[] =>
      seeds.map((s) => ({ geo: rockGeometry(s, { kind, detail, pits }), mats: [], colors: [], shadow, kind }));
    const hero = mk('boulder', [901, 902, 903], q(8, 12, 15), true, q(0, 20, 36));
    const boulders = mk('boulder', [11, 12, 13, 14, 15], q(3, 4, 5), true, q(0, 0, 6));
    const blocks = mk('block', [21, 22, 23], q(3, 4, 5), true);
    const slabs = mk('slab', [31, 32, 33], q(4, 5, 6), true);
    const stones = mk('stone', [41, 42, 43, 44], q(1, 2, 2), tier !== 'low');
    const pebbles = mk('pebble', [51, 52, 53], q(1, 1, 2), false);
    const all = [...hero, ...boulders, ...blocks, ...slabs, ...stones, ...pebbles];

    const tmpQ = new THREE.Quaternion();
    const tmpE = new THREE.Euler();
    const col = new THREE.Color();
    const shadows: ShadowCaster[] = [];
    const add = (vars: Variant[], x: number, z: number, s: number, sink: number, opts: { flat?: number; tilt?: number; collide?: boolean; stretch?: number } = {}) => {
      const v = vars[Math.floor(rnd() * vars.length)];
      const tilt = opts.tilt ?? 0.25;
      tmpE.set((rnd() - 0.5) * tilt, rnd() * Math.PI * 2, (rnd() - 0.5) * tilt);
      tmpQ.setFromEuler(tmpE);
      const flat = opts.flat ?? 1;
      const st = opts.stretch ?? 0.35;
      const sx = s * (1 - st / 2 + rnd() * st), sy = s * flat * (0.75 + rnd() * 0.45), sz = s * (1 - st / 2 + rnd() * st);
      const bb = v.geo.boundingBox!;
      const y = this.terrain.heightAt(x, z) - (bb.max.y - bb.min.y) * sy * sink - bb.min.y * sy;
      v.mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), tmpQ, new THREE.Vector3(sx, sy, sz)));
      // tint: grey-white limestone, some creamier, a few rust-stained
      const t = rnd();
      if (t < 0.55) col.setRGB(0.97 + rnd() * 0.06, 0.96 + rnd() * 0.05, 0.93 + rnd() * 0.05);
      else if (t < 0.85) col.setRGB(1.02, 0.97, 0.88);
      else col.setRGB(0.9, 0.9, 0.9);
      v.colors.push(col.clone());
      const visH = (bb.max.y - bb.min.y) * sy * (1 - sink);
      const rad = Math.max(sx * (bb.max.x - bb.min.x), sz * (bb.max.z - bb.min.z)) * 0.5;
      if ((opts.collide ?? true) && visH > 0.55 && rad > 0.45) this.colliders.add({ x, z, r: rad * 0.85, tag: 'rock' });
      if (rad > 0.35) this.terrain.suppressGrass(x, z, rad * 1.05, 0.9);
      if (visH > 0.7) shadows.push({ x, z, r: rad * 0.8, h0: 0, h1: visH, k: 0.9, ao: rad * 1.6 });
      this.placed.push({ x, z, s: rad, h: visH });
      return { rad, visH };
    };
    const clear = (x: number, z: number, r: number) => {
      if (Math.hypot(x - L.stones.x, z - L.stones.z) < 13 + r) return false;
      if (Math.hypot(x - L.targets.x, z - L.targets.z) < 9 + r) return false;
      return true;
    };

    // --- 1. David's lookout: a limestone outcrop above the pasture (same colliders as before)
    add(hero, L.start.x + 1.8, L.start.z - 1.2, 2.2, 0.5, { tilt: 0.12 });
    add(hero, L.start.x - 2.6, L.start.z + 0.8, 1.4, 0.48, { tilt: 0.12 });
    add(hero, L.start.x + 0.6, L.start.z + 3.2, 1.0, 0.45, { tilt: 0.12 });
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2, r = 3.5 + rnd() * 7;
      const x = L.start.x + Math.cos(a) * r, z = L.start.z + Math.sin(a) * r;
      if (Math.hypot(x - (L.start.x + 0.2), z - (L.start.z + 2.3)) < 2.2) continue;
      if (!this.colliders.free(x, z, 0.4)) continue;
      if (rnd() < 0.5) add(slabs, x, z, 1.0 + rnd() * 1.4, 0.55, { flat: 0.8, tilt: 0.1 });
      else add(boulders, x, z, 0.4 + rnd() * 0.7, 0.4);
    }

    // --- 2. outcrop clusters on rocky ground: a big boulder / block / slab with smaller stones around
    const cell = q(11, 9, 8);
    for (let gz = -NEAR_HALF + cell; gz < NEAR_HALF - cell; gz += cell) {
      for (let gx = -NEAR_HALF + cell; gx < NEAR_HALF - cell; gx += cell) {
        const x = gx + (rnd() - 0.5) * cell, z = gz + (rnd() - 0.5) * cell;
        const m = this.terrain.maskAt(x, z);
        if (m.path > 0.15 || m.wadi > 0.5) continue;
        if (Math.hypot(x - L.pasture.x, z - L.pasture.z) < L.pasture.r + 4) continue;
        if (Math.hypot(x - L.bethlehem.x, z - L.bethlehem.z) < L.bethlehem.r + 6) continue;
        if (Math.hypot(x - L.thicket.x, z - L.thicket.z) < 14) continue;
        if (Math.hypot(x - L.start.x, z - L.start.z) < 13) continue;
        const slope = this.terrain.slopeAt(x, z);
        const riser = m.terrace > 0.3 && slope > 0.3;
        if (riser) continue; // terrace walls handle those
        const p = (Math.pow(m.rock, 1.2) * 0.85 + 0.03 + (slope > 0.35 ? 0.06 : 0)) * budget;
        if (rnd() > p) continue;
        const big = 0.7 + rnd() * 1.9 * (0.5 + m.rock * 0.5);
        if (!clear(x, z, big) || !this.colliders.free(x, z, big * 0.7)) continue;
        const t = rnd();
        const main = t < 0.45 ? boulders : t < 0.75 ? blocks : slabs;
        const { rad } = add(main, x, z, big, main === slabs ? 0.5 : 0.38, { flat: main === slabs ? 0.9 : 1 });
        const extra = Math.floor(1 + rnd() * 4 * budget);
        for (let e = 0; e < extra; e++) {
          const a = rnd() * Math.PI * 2, rr = rad * (0.9 + rnd() * 1.4);
          const ex = x + Math.cos(a) * rr, ez = z + Math.sin(a) * rr;
          const es = big * (0.12 + rnd() * 0.35);
          if (!clear(ex, ez, es) || !this.colliders.free(ex, ez, es * 0.5)) continue;
          add(es > 0.45 ? boulders : stones, ex, ez, es, 0.35);
        }
      }
    }

    // --- 3. stony ground: rubble scattered everywhere (thicker on rocky ground, none on the path)
    const rubble = Math.round(this.count * q(0.8, 1.0, 1.1));
    let placed = 0;
    for (let tries = 0; tries < rubble * 6 && placed < rubble; tries++) {
      const x = (rnd() * 2 - 1) * (NEAR_HALF - 5);
      const z = (rnd() * 2 - 1) * (NEAR_HALF - 5);
      const m = this.terrain.maskAt(x, z);
      if (m.path > 0.25) continue;
      if (Math.hypot(x - L.bethlehem.x, z - L.bethlehem.z) < L.bethlehem.r - 5) continue;
      const pasture = Math.hypot(x - L.pasture.x, z - L.pasture.z) < L.pasture.r;
      const p = (m.rock * 0.7 + 0.12 + m.wadi * 0.3) * (pasture ? 0.3 : 1);
      if (rnd() > p) continue;
      const s = 0.07 + Math.pow(rnd(), 2.2) * 0.38;
      if (!clear(x, z, s)) continue;
      add(stones, x, z, s, 0.3, { collide: false, tilt: 0.5 });
      placed++;
    }

    // --- 4. the wadi bed: water-worn cobbles and pebbles, a few boulders on the banks
    const cobbles = Math.round(this.count * q(0.4, 0.5, 0.6));
    placed = 0;
    for (let tries = 0; tries < cobbles * 20 && placed < cobbles; tries++) {
      const seg = Math.floor(rnd() * (L.wadi.length - 1));
      const [ax, az] = L.wadi[seg], [bx, bz] = L.wadi[seg + 1];
      const t = rnd();
      const nx = -(bz - az), nz = bx - ax;
      const nl = Math.hypot(nx, nz) || 1;
      const off = (rnd() * 2 - 1) * 9;
      const x = ax + (bx - ax) * t + (nx / nl) * off, z = az + (bz - az) * t + (nz / nl) * off;
      if (Math.abs(x) > NEAR_HALF - 5 || Math.abs(z) > NEAR_HALF - 5) continue;
      const m = this.terrain.maskAt(x, z);
      if (m.wadi < 0.25 || m.path > 0.2) continue;
      if (!clear(x, z, 0.5)) continue;
      const bank = m.wadi < 0.6;
      const s = bank && rnd() < 0.15 ? 0.5 + rnd() * 0.9 : 0.06 + Math.pow(rnd(), 1.8) * 0.3;
      if (s > 0.5 && !this.colliders.free(x, z, s * 0.6)) continue;
      add(s > 0.5 ? boulders : pebbles, x, z, s, s > 0.5 ? 0.4 : 0.35, { collide: s > 0.5, tilt: 0.3 });
      placed++;
    }

    // --- 5. dry-stone terrace walls along the contours of the terraced slopes
    this.walls = new TerraceWalls(this.terrain, this.tex, this.material, tier);
    this.walls.build(rnd, clear);
    this.group.add(this.walls.group);
    for (const c of this.walls.shadowCasters) shadows.push(c);

    // --- meshes
    let tris = 0;
    for (const v of all) {
      if (!v.mats.length) continue;
      const im = new THREE.InstancedMesh(v.geo, this.material, v.mats.length);
      v.mats.forEach((m, k) => {
        im.setMatrixAt(k, m);
        im.setColorAt(k, v.colors[k]);
      });
      im.castShadow = v.shadow;
      im.receiveShadow = true;
      im.name = 'rocks-' + v.kind;
      im.computeBoundingSphere();
      this.group.add(im);
      tris += triCount(v.geo) * v.mats.length;
    }
    this.terrain.stampShadows(shadows);
    this.stats = { instances: all.reduce((a, v) => a + v.mats.length, 0), triangles: tris + (this.walls?.triangles ?? 0) };
  }

  stats = { instances: 0, triangles: 0 };
}

void N;
void smoothstep;
