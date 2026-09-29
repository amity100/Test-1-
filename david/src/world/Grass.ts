import * as THREE from 'three';
import { mulberry32 } from '../core/noise';
import { GLSL_NOISE, shared } from '../core/Shared';
import { NEAR_HALF } from './Layout';
import type { Terrain } from './Terrain';
import { worldTier } from './WorldQuality';

/**
 * GPU grass: a fixed patch of tufts that wraps around the camera (toroidal tiling) and reads terrain height +
 * grass density from a float texture. Dry, golden summer grass of the Judean hills: curved, tapering straw
 * blades, and on some tufts tall stems with nodding wild-oat / barley spikelets (awns catch the low sun).
 * Wind gusts travel across the slope; blades are back-lit by the low sun and pushed aside by characters.
 */
export class Grass {
  readonly mesh: THREE.Mesh;

  constructor(terrain: Terrain, count: number, patch: number) {
    const tier = worldTier({ grassCount: count });
    const rnd = mulberry32(99);
    const blades = tier === 'low' ? 6 : 8;
    const segs = tier === 'low' ? 2 : 3;
    const pos: number[] = [];
    const uvs: number[] = [];
    const cols: number[] = [];
    const nors: number[] = [];
    const heads: number[] = []; // 1 on seed-head stems (hidden on most instances)
    const idx: number[] = [];
    const base = new THREE.Color();
    const tip = new THREE.Color();
    const palette = [0xd8bd78, 0xe6d39e, 0xbd9a5a, 0xcdb070, 0xa7a07a, 0xdcc588, 0xb8a47c];
    const blade = (ox: number, oz: number, h: number, w: number, lean: number, dir: number, head: number, c: number) => {
      const dx = Math.cos(dir), dz = Math.sin(dir);
      const px = -dz, pz = dx; // blade width direction
      tip.setHex(c);
      base.copy(tip).multiplyScalar(0.5);
      const start = pos.length / 3;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const bend = lean * t * t;
        const cx = ox + dx * bend, cz = oz + dz * bend, cy = h * t;
        const ww = w * (1 - t * 0.9);
        pos.push(cx - px * ww, cy, cz - pz * ww, cx + px * ww, cy, cz + pz * ww);
        uvs.push(0, t, 1, t);
        const cc = base.clone().lerp(tip, Math.pow(t, 0.7));
        cols.push(cc.r, cc.g, cc.b, cc.r, cc.g, cc.b);
        nors.push(dx, 0.6, dz, dx, 0.6, dz);
        heads.push(head, head);
      }
      for (let s = 0; s < segs; s++) {
        const i0 = start + s * 2;
        idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
      }
      return { x: ox + dx * lean, z: oz + dz * lean, y: h, dx, dz };
    };
    // --- one tuft: curved, tapering blades
    for (let b = 0; b < blades; b++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 0.2;
      blade(Math.cos(a) * r, Math.sin(a) * r, 0.14 + rnd() * 0.26, 0.018 + rnd() * 0.014, 0.06 + rnd() * 0.22, rnd() * Math.PI * 2, 0, palette[Math.floor(rnd() * palette.length)]);
    }
    // --- seed-head stems (wild oats / barley grass): thin stalk + a spikelet made of two crossed quads
    const stems = tier === 'low' ? 1 : 2;
    for (let st = 0; st < stems; st++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 0.12;
      const hh = 0.42 + rnd() * 0.28;
      const top = blade(Math.cos(a) * r, Math.sin(a) * r, hh, 0.006, 0.08 + rnd() * 0.12, rnd() * Math.PI * 2, 1, 0xd8c290);
      const hc = new THREE.Color(0xe8d7a4);
      for (let q = 0; q < 2; q++) {
        const ang = q * Math.PI * 0.5 + a;
        const sx = Math.cos(ang) * 0.022, sz = Math.sin(ang) * 0.022;
        const L = 0.11 + rnd() * 0.05;
        const s0 = pos.length / 3;
        // nodding spikelet with awns: a narrow diamond hanging from the stalk tip
        const hx = top.x + top.dx * 0.05, hz = top.z + top.dz * 0.05;
        pos.push(top.x - sx, top.y, top.z - sz, top.x + sx, top.y, top.z + sz, hx + sx * 0.3, top.y - L, hz + sz * 0.3, hx - sx * 0.3, top.y - L, hz - sz * 0.3);
        uvs.push(0, 1, 1, 1, 1, 1, 0, 1);
        for (let k = 0; k < 4; k++) {
          cols.push(hc.r, hc.g, hc.b);
          nors.push(top.dx, 0.8, top.dz);
          heads.push(1);
        }
        idx.push(s0, s0 + 1, s0 + 2, s0, s0 + 2, s0 + 3);
      }
    }
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nors, 3));
    geo.setAttribute('aHead', new THREE.Float32BufferAttribute(heads, 1));
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

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.86, metalness: 0 });
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
attribute vec2 aOffset; attribute vec4 aRand; attribute float aHead;
varying float vGrassT; varying vec3 vGWPos; varying float vGTint;
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
// patches: taller, seedier stands and short grazed turf
float stand = dNoise(wp2 * 0.09 + 3.7);
gScale = aRand.y * keep * fade * (0.55 + 0.45 * dens) * mix(0.75, 1.3, stand);
gPlace = vec3(wp2.x, h - 0.03, wp2.y);
float cr = cos(aRand.x), sr = sin(aRand.x);
gRot = mat2(cr, -sr, sr, cr);
vGTint = dNoise(wp2 * 0.035 - 1.3) * 0.6 + dNoise(wp2 * 0.21) * 0.4;
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
// seed heads only on part of the tufts (more in the tall stands)
float showHead = step(aRand.z, 0.22 + 0.45 * stand);
transformed *= mix(1.0, showHead, aHead);
transformed.xz = gRot * transformed.xz;
transformed *= gScale;
float t = clamp(position.y / 0.7, 0.0, 1.0);
vGrassT = uv.y;
vec2 wdir = normalize(uWind.xz + 1e-4);
float gust = dNoise(gPlace.xz * 0.05 - wdir * uTime * 1.6);
float w = (gust * 1.3 + sin(uTime * 2.1 + gPlace.x * 0.35 + gPlace.z * 0.27) * 0.25) * uWindStrength;
transformed.xz += wdir * w * t * t * 0.3 * gScale;
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
uniform vec3 uSunDir; uniform vec3 uSunColor; varying float vGrassT; varying vec3 vGWPos; varying float vGTint;`)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
diffuseColor.rgb *= mix(0.5, 1.0, smoothstep(0.0, 0.55, vGrassT));
// patches of greyer, sun-bleached straw and deeper gold
diffuseColor.rgb *= mix(vec3(0.9, 0.92, 0.86), vec3(1.08, 1.0, 0.86), vGTint);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
{
  vec3 vd = normalize(vGWPos - cameraPosition);
  float back = pow(max(dot(vd, uSunDir), 0.0), 2.5);
  totalEmissiveRadiance += diffuseColor.rgb * uSunColor * back * vGrassT * 0.95;
}`,
        );
    };
    mat.customProgramCacheKey = () => 'grass-v2';
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.name = 'grass';
  }
}
