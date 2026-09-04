import * as THREE from 'three';
import { Noise } from '../core/Noise';
import { hash2 } from '../core/Random';
import { clamp, lerp, smoothstep } from '../core/MathUtil';
import { WORLD_HALF, ISLAND_RADIUS, PLOT_Y, PLAZA_Y, RING_ROAD_RADIUS, PLOT_RING_RADIUS, type Plot, plotDistance } from './Layout';

const GRASS_A = new THREE.Color('#5f9e3a');
const GRASS_B = new THREE.Color('#3f7f2e');
const GRASS_C = new THREE.Color('#8fbf4a');
const DIRT = new THREE.Color('#7a5a3a');
const ROCK = new THREE.Color('#7d7a74');
const SAND = new THREE.Color('#dcc78f');
const PLAZA = new THREE.Color('#9a958c');
const PLAZA_DARK = new THREE.Color('#7c776f');
const PATH = new THREE.Color('#a8926c');
const PATH_DARK = new THREE.Color('#8a7455');
const MEADOW = new THREE.Color('#7fae3c');

/** Heightmap island with flattened plots. Heights are sampled at 1 m spacing. */
export class Terrain {
  readonly size = WORLD_HALF * 2 + 1;
  readonly heights: Float32Array;
  readonly noise: Noise;
  mesh!: THREE.Mesh;

  constructor(readonly plots: Plot[], seed = 1) {
    this.noise = new Noise(seed);
    this.heights = new Float32Array(this.size * this.size);
    for (let j = 0; j < this.size; j++) {
      for (let i = 0; i < this.size; i++) {
        this.heights[j * this.size + i] = this.computeHeight(i - WORLD_HALF, j - WORLD_HALF);
      }
    }
  }

  private computeHeight(x: number, z: number): number {
    const r = Math.sqrt(x * x + z * z);
    const n = this.noise;
    const coast = 1 - smoothstep(ISLAND_RADIUS - 40, ISLAND_RADIUS, r + n.fbm2(x * 0.02, z * 0.02, 3) * 12);
    const hills = (n.fbm2(x * 0.011 + 3.1, z * 0.011 - 1.7, 5, 2.0, 0.5) * 0.5 + 0.5) * 12;
    const ridge = n.ridged2(x * 0.007, z * 0.007, 3) * 6;
    const detail = n.fbm2(x * 0.06, z * 0.06, 3) * 0.9;
    const centre = smoothstep(60, 0, r) * 4;
    let h = -4 + coast * (7 + hills + ridge * 0.6 + centre) + detail;
    // Flatten the central plaza for the monument.
    if (r < 22) h = lerp(h, PLAZA_Y - 0.02, 1 - smoothstep(14, 22, r));
    // Flatten plots with a soft blend ring.
    for (const p of this.plots) {
      const d = plotDistance(p, x, z);
      if (d < 12) {
        const w = 1 - smoothstep(0, 12, d);
        const target = d <= 0 ? PLOT_Y - 0.02 : PLOT_Y;
        h = lerp(h, target, w);
      }
    }
    return h;
  }

  /** Bilinear height query in world coordinates. */
  heightAt(x: number, z: number): number {
    const fx = clamp(x + WORLD_HALF, 0, this.size - 1.001);
    const fz = clamp(z + WORLD_HALF, 0, this.size - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const s = this.size;
    const h00 = this.heights[j * s + i];
    const h10 = this.heights[j * s + i + 1];
    const h01 = this.heights[(j + 1) * s + i];
    const h11 = this.heights[(j + 1) * s + i + 1];
    return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
  }

  normalAt(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    const e = 0.5;
    const hl = this.heightAt(x - e, z);
    const hr = this.heightAt(x + e, z);
    const hd = this.heightAt(x, z - e);
    const hu = this.heightAt(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }

  slopeAt(x: number, z: number): number {
    const n = this.normalAt(x, z);
    return 1 - n.y;
  }

  /** 0..1 strength of the packed-dirt paths (radials from each fortress, ring road, plaza). */
  pathWeight(x: number, z: number): number {
    const r = Math.sqrt(x * x + z * z);
    let w = 0;
    for (const p of this.plots) {
      const dx = Math.cos(p.angle);
      const dz = Math.sin(p.angle);
      const t = x * dx + z * dz;
      if (t < RING_ROAD_RADIUS - 2 || t > PLOT_RING_RADIUS - 14) continue;
      const perp = Math.abs(-dz * x + dx * z);
      const wobble = this.noise.noise2(t * 0.07, p.index * 3.1) * 1.4;
      w = Math.max(w, 1 - smoothstep(1.3, 3.1 + wobble, perp));
    }
    const ringWobble = this.noise.noise2(x * 0.05, z * 0.05) * 1.0;
    w = Math.max(w, 1 - smoothstep(1.2, 2.8 + ringWobble, Math.abs(r - RING_ROAD_RADIUS)));
    w = Math.max(w, 1 - smoothstep(12, 15, r));
    return w;
  }

  isPlotInterior(x: number, z: number): boolean {
    for (const p of this.plots) if (plotDistance(p, x, z) <= 0) return true;
    return false;
  }

  buildMesh(): THREE.Mesh {
    const s = this.size;
    const geo = new THREE.PlaneGeometry(s - 1, s - 1, s - 1, s - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const tmp = new THREE.Color();
    for (let idx = 0; idx < pos.count; idx++) {
      const x = pos.getX(idx);
      const z = pos.getZ(idx);
      const h = this.heightAt(x, z);
      pos.setY(idx, h);
      const slope = this.slopeAt(x, z);
      const macro = this.noise.fbm2(x * 0.03, z * 0.03, 3) * 0.5 + 0.5;
      const micro = hash2(Math.round(x), Math.round(z), 5);
      // Base grass mix: darker in valleys, brighter meadows on the high ground
      c.copy(GRASS_A).lerp(GRASS_B, macro).lerp(GRASS_C, micro * 0.35);
      const meadow = smoothstep(9, 15, h) * (this.noise.fbm2(x * 0.05 + 9, z * 0.05, 2) * 0.5 + 0.5);
      c.lerp(MEADOW, meadow * 0.38);
      // Dirt/rock on slopes
      const rockW = smoothstep(0.25, 0.55, slope);
      const dirtW = smoothstep(0.12, 0.3, slope) * (1 - rockW);
      c.lerp(DIRT, dirtW).lerp(ROCK, rockW);
      // Sand near water
      const sandW = 1 - smoothstep(0.6, 2.6, h);
      c.lerp(SAND, sandW);
      // Plaza rings around plots
      let plaza = 0;
      let plotEdge = 0;
      for (const p of this.plots) {
        const d = plotDistance(p, x, z);
        if (d < 12) {
          plaza = Math.max(plaza, 1 - smoothstep(4, 12, d));
          if (d <= 0) plotEdge = 1;
        }
      }
      if (plaza > 0) {
        const checker = ((Math.floor(x / 2) + Math.floor(z / 2)) & 1) === 0 ? PLAZA : PLAZA_DARK;
        tmp.copy(checker).lerp(ROCK, micro * 0.2);
        c.lerp(tmp, plaza * 0.9);
      }
      if (plotEdge) c.copy(PLAZA_DARK);
      // Packed-dirt paths and the central plaza
      const pw = this.pathWeight(x, z);
      if (pw > 0.01) {
        const r = Math.sqrt(x * x + z * z);
        if (r < 15.5) {
          const checker = ((Math.floor(x / 2) + Math.floor(z / 2)) & 1) === 0 ? PLAZA : PLAZA_DARK;
          tmp.copy(checker).lerp(ROCK, micro * 0.15);
        } else tmp.copy(PATH).lerp(PATH_DARK, micro * 0.6);
        c.lerp(tmp, pw * 0.92);
      }
      colors[idx * 3] = c.r;
      colors[idx * 3 + 1] = c.g;
      colors[idx * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWPos;
          float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
          float tNoise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), f.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), f.x), f.y);
          }`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          {
            float n1 = tNoise(vWPos.xz * 1.7);
            float n2 = tNoise(vWPos.xz * 7.3 + 11.0);
            float n3 = tNoise(vWPos.xz * 0.35 + 5.0);
            float detail = 0.86 + 0.16 * n1 + 0.1 * (n2 - 0.5) + 0.06 * (n3 - 0.5);
            diffuseColor.rgb *= detail;
          }`,
        )
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness - 0.15 * tNoise(vWPos.xz * 3.0);`);
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.name = 'terrain';
    this.mesh = mesh;
    return mesh;
  }
}
