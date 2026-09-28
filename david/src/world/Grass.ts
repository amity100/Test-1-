import * as THREE from 'three';
import { mulberry32 } from '../core/noise';
import { GLSL_NOISE, shared } from '../core/Shared';
import { NEAR_HALF } from './Layout';
import type { Terrain } from './Terrain';

/**
 * GPU grass: a fixed patch of tufts that wraps around the camera (toroidal tiling) and
 * reads terrain height + grass density from a float texture. Golden, dry, wind-blown,
 * back-lit by the low sun and pushed aside by characters.
 */
export class Grass {
  readonly mesh: THREE.Mesh;

  constructor(terrain: Terrain, count: number, patch: number) {
    const rnd = mulberry32(99);
    // --- one tuft: several curved, tapering blades
    const blades = 8;
    const segs = 3;
    const pos: number[] = [];
    const uvs: number[] = [];
    const cols: number[] = [];
    const nors: number[] = [];
    const idx: number[] = [];
    const base = new THREE.Color();
    const tip = new THREE.Color();
    const palette = [0xd9b96a, 0xe8d39a, 0xb8914f, 0xcaa866, 0x9d9a5c, 0xe0c580];
    for (let b = 0; b < blades; b++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 0.2;
      const ox = Math.cos(a) * r, oz = Math.sin(a) * r;
      const h = 0.12 + rnd() * 0.24;
      const w = 0.018 + rnd() * 0.014;
      const lean = 0.06 + rnd() * 0.2;
      const dir = rnd() * Math.PI * 2;
      const dx = Math.cos(dir), dz = Math.sin(dir);
      const px = -dz, pz = dx; // blade width direction
      tip.setHex(palette[Math.floor(rnd() * palette.length)]);
      base.copy(tip).multiplyScalar(0.55);
      const start = pos.length / 3;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const bend = lean * t * t;
        const cx = ox + dx * bend, cz = oz + dz * bend, cy = h * t;
        const ww = w * (1 - t * 0.92);
        pos.push(cx - px * ww, cy, cz - pz * ww, cx + px * ww, cy, cz + pz * ww);
        uvs.push(0, t, 1, t);
        const c = base.clone().lerp(tip, Math.pow(t, 0.7));
        cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
        // normal: facing sideways, tilted up (will be blended further toward +Y in shader)
        nors.push(dx, 0.6, dz, dx, 0.6, dz);
      }
      for (let s = 0; s < segs; s++) {
        const i0 = start + s * 2;
        idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
      }
    }
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nors, 3));
    geo.setIndex(idx);
    const offsets = new Float32Array(count * 2);
    const rands = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      offsets[i * 2] = rnd() * patch;
      offsets[i * 2 + 1] = rnd() * patch;
      rands[i * 4] = rnd() * Math.PI * 2;
      rands[i * 4 + 1] = 0.75 + rnd() * 0.5;
      rands[i * 4 + 2] = rnd();
      rands[i * 4 + 3] = rnd();
    }
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 2));
    geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rands, 4));
    geo.instanceCount = count;

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.88, metalness: 0 });
    const uniforms = {
      uHeightTex: { value: terrain.heightTexture },
      uGridN: { value: terrain.nearN },
      uSpacing: { value: terrain.nearSpacing },
      uPatch: { value: patch },
      uTime: shared.uTime,
      uWind: shared.uWind,
      uWindStrength: shared.uWindStrength,
      uCamPos: shared.uCamPos,
      uPushers: shared.uPushers,
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
    };
    mat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, uniforms);
      s.vertexShader = s.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
uniform sampler2D uHeightTex; uniform float uGridN; uniform float uSpacing; uniform float uPatch;
uniform float uTime; uniform vec3 uWind; uniform float uWindStrength; uniform vec3 uCamPos; uniform vec4 uPushers[6];
attribute vec2 aOffset; attribute vec4 aRand;
varying float vGrassT; varying vec3 vGWPos;
${GLSL_NOISE}
float gH(ivec2 g){ return texelFetch(uHeightTex, clamp(g, ivec2(0), ivec2(int(uGridN) - 1)), 0).r; }
vec3 gPlace; float gScale; mat2 gRot;
`,
        )
        .replace(
          '#include <beginnormal_vertex>',
          `
vec2 cam2 = uCamPos.xz;
vec2 wp2 = aOffset + uPatch * floor((cam2 - aOffset) / uPatch + 0.5);
vec2 g = (wp2 + ${NEAR_HALF.toFixed(1)}) / uSpacing;
ivec2 gi = ivec2(floor(g)); vec2 gf = fract(g);
float h = (gf.x + gf.y <= 1.0)
  ? gH(gi) + (gH(gi + ivec2(1, 0)) - gH(gi)) * gf.x + (gH(gi + ivec2(0, 1)) - gH(gi)) * gf.y
  : gH(gi + ivec2(1, 1)) + (gH(gi + ivec2(0, 1)) - gH(gi + ivec2(1, 1))) * (1.0 - gf.x) + (gH(gi + ivec2(1, 0)) - gH(gi + ivec2(1, 1))) * (1.0 - gf.y);
float dens = texelFetch(uHeightTex, clamp(ivec2(floor(g + 0.5)), ivec2(0), ivec2(int(uGridN) - 1)), 0).g;
float dist = length(wp2 - cam2);
float fade = 1.0 - smoothstep(uPatch * 0.3, uPatch * 0.5, dist);
float keep = step(aRand.w, dens * 1.15) * step(abs(wp2.x), ${(NEAR_HALF - 2).toFixed(1)}) * step(abs(wp2.y), ${(NEAR_HALF - 2).toFixed(1)});
gScale = aRand.y * keep * fade * (0.6 + 0.4 * dens);
gPlace = vec3(wp2.x, h - 0.03, wp2.y);
float cr = cos(aRand.x), sr = sin(aRand.x);
gRot = mat2(cr, -sr, sr, cr);
vec3 objectNormal = vec3(gRot * normal.xz, normal.y).xzy;
objectNormal = vec3(objectNormal.x, normal.y, objectNormal.z);
objectNormal = normalize(mix(normalize(objectNormal), vec3(0.0, 1.0, 0.0), 0.72));
#ifdef USE_TANGENT
vec3 objectTangent = vec3( tangent.xyz );
#endif
`,
        )
        .replace(
          '#include <begin_vertex>',
          `
vec3 transformed = position;
transformed.xz = gRot * transformed.xz;
transformed *= gScale;
float t = uv.y;
vGrassT = t;
vec2 wdir = normalize(uWind.xz + 1e-4);
float gust = dNoise(gPlace.xz * 0.05 - wdir * uTime * 1.6);
float w = (gust * 1.3 + sin(uTime * 2.1 + gPlace.x * 0.35 + gPlace.z * 0.27) * 0.25) * uWindStrength;
transformed.xz += wdir * w * t * t * 0.28 * gScale;
transformed.y -= abs(w) * t * t * 0.06 * gScale;
for (int i = 0; i < 6; i++) {
  vec4 P = uPushers[i];
  vec2 d = gPlace.xz - P.xz;
  float dd = length(d);
  float k = (1.0 - smoothstep(P.w * 0.25, P.w, dd)) * step(abs(gPlace.y - P.y), 2.5);
  transformed.xz += normalize(d + 1e-4) * k * t * 0.4 * gScale;
  transformed.y -= k * t * 0.22 * gScale;
}
transformed += gPlace;
vGWPos = transformed;
`,
        );
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', `#include <common>
uniform vec3 uSunDir; uniform vec3 uSunColor; varying float vGrassT; varying vec3 vGWPos;`)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 0.5, vGrassT));`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
{
  vec3 vd = normalize(vGWPos - cameraPosition);
  float back = pow(max(dot(vd, uSunDir), 0.0), 2.5);
  totalEmissiveRadiance += diffuseColor.rgb * uSunColor * back * vGrassT * 0.9;
}`,
        );
    };
    mat.customProgramCacheKey = () => 'grass-v1';
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
  }
}
