import * as THREE from 'three';
import type { Terrain } from '../world/Terrain';
import { WORLD_HALF, WATER_LEVEL } from '../world/Layout';
import { smoothstep } from '../core/MathUtil';

/** Animated water plane with shoreline foam, using the standard PBR lighting path. */
export class WaterSurface {
  readonly mesh: THREE.Mesh;
  private uniforms = { uTime: { value: 0 }, uStorm: { value: 0 }, uLevel: { value: 0 } };
  /** Sky Flag: the sea's level and how fast it climbs (drives the swell, the foam and the colour). */
  level = 0;
  private storm = 0;
  private stormTarget = 0;

  constructor(terrain: Terrain) {
    const extent = 6000;
    const inner = WORLD_HALF;
    const seg = 200;
    const geo = new THREE.PlaneGeometry(extent, extent, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const shore = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      let s = 0;
      if (Math.abs(x) < inner && Math.abs(z) < inner) {
        const h = terrain.heightAt(x, z);
        s = smoothstep(-3.5, 0.2, h);
      }
      shore[i] = s;
    }
    geo.setAttribute('aShore', new THREE.BufferAttribute(shore, 1));

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0f6a78'),
      roughness: 0.08,
      metalness: 0.0,
      transparent: true,
      opacity: 0.88,
      envMapIntensity: 1.2,
    });
    const uniforms = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uStorm = uniforms.uStorm;
      shader.uniforms.uLevel = uniforms.uLevel;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute float aShore;
          varying float vShore;
          varying vec3 vWPos;
          uniform float uTime;
          uniform float uStorm;
          uniform float uLevel;`,
        )
        .replace(
          '#include <begin_vertex>',
          `vec3 transformed = vec3(position);
          {
            float t = uTime;
            float shoreK = uLevel > 0.5 ? 1.0 : (1.0 - aShore * 0.6);
            float w = sin(position.x * 0.12 + t * 0.9) * 0.18 + sin(position.z * 0.09 - t * 0.7) * 0.15 + sin((position.x + position.z) * 0.05 + t * 0.5) * 0.12;
            // The rising sea heaves: long swells that grow with the storm.
            float swell = sin(position.x * 0.035 + t * 1.1) * sin(position.z * 0.042 - t * 0.8) * 2.6 + sin((position.x - position.z) * 0.02 + t * 1.7) * 1.4;
            transformed.y += w * shoreK + swell * uStorm;
          }
          vShore = aShore;
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying float vShore;
          varying vec3 vWPos;
          uniform float uTime;
          uniform float uStorm;
          uniform float uLevel;
          float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
          float wNoise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x), f.y);
          }
          vec2 waveGrad(vec2 p, float t) {
            vec2 g = vec2(0.0);
            g += vec2(cos(p.x * 0.9 + t * 1.6), 0.0) * 0.9 * 0.18;
            g += vec2(0.0, cos(p.y * 0.7 - t * 1.3)) * 0.7 * 0.16;
            g += vec2(cos((p.x + p.y) * 0.45 + t * 1.1)) * 0.45 * 0.14;
            g += vec2(cos((p.x * 0.6 - p.y * 0.8) * 1.8 - t * 2.2)) * vec2(0.6, -0.8) * 1.8 * 0.05;
            g += vec2(cos((p.x * 0.3 + p.y * 0.9) * 2.6 + t * 2.8)) * vec2(0.3, 0.9) * 2.6 * 0.03;
            return g;
          }`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `{
            vec2 g = waveGrad(vWPos.xz, uTime);
            vec3 nW = normalize(vec3(-g.x, 1.0, -g.y));
            normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
          }`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          {
            vec3 shallow = vec3(0.16, 0.62, 0.62);
            float shoreW = uLevel > 0.5 ? 0.0 : vShore;
            float sh = smoothstep(0.2, 1.0, shoreW);
            diffuseColor.rgb = mix(diffuseColor.rgb, shallow, sh * 0.8);
            float band = wNoise(vWPos.xz * 0.8 + vec2(uTime * 0.25, -uTime * 0.18));
            float band2 = wNoise(vWPos.xz * 2.5 - vec2(uTime * 0.4, uTime * 0.3));
            float foamMask = smoothstep(0.55, 0.95, shoreW) * smoothstep(0.35, 0.75, band * 0.6 + band2 * 0.4 + shoreW * 0.25);
            // Storm: the water darkens to a deep teal and streaks of foam ride every crest.
            vec3 deep = vec3(0.02, 0.18, 0.22);
            diffuseColor.rgb = mix(diffuseColor.rgb, deep, uStorm * 0.85);
            float crest = wNoise(vWPos.xz * 0.45 + vec2(uTime * 0.9, uTime * 0.6)) * 0.6 + wNoise(vWPos.xz * 1.6 - vec2(uTime * 1.3, uTime * 0.4)) * 0.4;
            float stormFoam = smoothstep(0.62, 0.9, crest) * uStorm;
            foamMask = max(foamMask, stormFoam);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.98, 1.0), foamMask);
            diffuseColor.a = mix(diffuseColor.a, 1.0, max(foamMask * 0.8, uStorm * 0.6));
          }`,
        )
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness + smoothstep(0.55, 0.95, vShore) * 0.5;`);
    };
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = WATER_LEVEL;
    this.mesh.receiveShadow = true;
    this.mesh.name = 'water';
    this.mesh.renderOrder = 1;
  }

  update(time: number): void {
    this.uniforms.uTime.value = time;
    this.storm += (this.stormTarget - this.storm) * 0.02;
    this.uniforms.uStorm.value = this.storm;
    this.uniforms.uLevel.value = this.level;
    this.mesh.position.y = WATER_LEVEL + this.level;
  }

  /** Sky Flag: the sea stands `level` metres above normal and climbs at `speed` m/s (0 = calm). */
  setLevel(level: number, speed: number): void {
    this.level = level;
    this.stormTarget = speed <= 0 ? 0 : Math.min(1, 0.45 + speed * 1.6);
  }
}
