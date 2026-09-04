import * as THREE from 'three';
import type { VoxelTextureSet } from './Textures';
import { MAT_COUNT, MATERIALS } from '../world/Voxel';

export interface VoxelMaterials {
  opaque: THREE.MeshStandardMaterial;
  transparent: THREE.MeshStandardMaterial;
  setNormalScale(v: number): void;
}

/** Width of the darkened/bevelled band along block edges, per texture kind. */
const BEVEL: Record<string, number> = {
  brick: 0.06,
  smooth: 0.035,
  marble: 0.03,
  planks: 0.05,
  log: 0.05,
  panel: 0.045,
  brushed: 0.03,
  glass: 0.02,
  concrete: 0.04,
  sandstone: 0.055,
  candy: 0.045,
  neon: 0.03,
  tiles: 0.055,
  gold: 0.035,
  crystal: 0.03,
  cobble: 0.065,
  lamp: 0.03,
};

/**
 * PBR block material: samples albedo/normal/ORM from array textures using the per-vertex
 * material index, tints by palette colour, applies baked vertex AO and emissive.
 * Adds per-block value variation and bevelled edges so large walls read as crafted masonry.
 */
export function createVoxelMaterials(tex: VoxelTextureSet): VoxelMaterials {
  const bevel = new Float32Array(MAT_COUNT);
  for (let i = 0; i < MAT_COUNT; i++) bevel[i] = BEVEL[MATERIALS[i]?.texture ?? 'smooth'] ?? 0.04;
  const uniforms = {
    uAlbedo: { value: tex.albedo },
    uNormal: { value: tex.normal },
    uORM: { value: tex.orm },
    uNormalScale: { value: 1.0 },
    uBevel: { value: Array.from(bevel) },
  };

  const make = (transparent: boolean): THREE.MeshStandardMaterial => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
      transparent,
      opacity: transparent ? 0.45 : 1,
      depthWrite: !transparent,
      side: THREE.FrontSide,
      envMapIntensity: 1.0,
    });
    mat.customProgramCacheKey = () => (transparent ? 'voxel-transparent-v2' : 'voxel-opaque-v2');
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute float aMat;
          attribute float aAo;
          attribute vec3 aTint;
          attribute vec2 aUv;
          varying vec2 vUvB;
          varying float vMat;
          varying float vAo;
          varying vec3 vTint;
          varying vec3 vWNormal;
          varying vec3 vWPos;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vUvB = aUv;
          vMat = aMat;
          vAo = aAo;
          vTint = aTint;
          vWNormal = normal;
          vWPos = (modelMatrix * vec4(position, 1.0)).xyz;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform highp sampler2DArray uAlbedo;
          uniform highp sampler2DArray uNormal;
          uniform highp sampler2DArray uORM;
          uniform float uNormalScale;
          uniform float uBevel[${MAT_COUNT}];
          varying vec2 vUvB;
          varying float vMat;
          varying float vAo;
          varying vec3 vTint;
          varying vec3 vWNormal;
          varying vec3 vWPos;`,
        )
        .replace(
          '#include <map_fragment>',
          `vec3 vUvA = vec3(vUvB, vMat);
          vec4 texelColor = texture(uAlbedo, vUvA);
          vec4 orm = texture(uORM, vUvA);
          vec3 wnrm = normalize(vWNormal);
          // Per-block value variation so repeated blocks do not tile.
          vec3 cell = floor(vWPos - wnrm * 0.5 + vec3(0.001));
          float bh = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          float variation = 0.92 + 0.15 * bh;
          // Bevelled edges: a thin darker band along every block border.
          vec2 fuv = fract(vUvB);
          float ex = min(fuv.x, 1.0 - fuv.x);
          float ey = min(fuv.y, 1.0 - fuv.y);
          float bw = uBevel[int(vMat + 0.5)];
          float bevelX = smoothstep(0.0, bw, ex);
          float bevelY = smoothstep(0.0, bw, ey);
          float bevel = min(bevelX, bevelY);
          float bevelDark = mix(0.74, 1.0, bevel);
          // Faint top-light: upward faces slightly brighter, undersides darker.
          float faceLight = 1.0 + wnrm.y * 0.05;
          diffuseColor.rgb *= texelColor.rgb * vTint * variation * bevelDark * faceLight;`,
        )
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = min(1.0, orm.r + (1.0 - bevel) * 0.3);`)
        .replace('#include <metalnessmap_fragment>', `float metalnessFactor = orm.g;`)
        .replace(
          '#include <normal_fragment_maps>',
          `{
            vec3 mapN = texture(uNormal, vUvA).xyz * 2.0 - 1.0;
            mapN.xy *= uNormalScale;
            // Tilt the normal outwards at bevelled edges.
            float tx = (1.0 - bevelX) * (fuv.x < 0.5 ? -1.0 : 1.0);
            float ty = (1.0 - bevelY) * (fuv.y < 0.5 ? -1.0 : 1.0);
            mapN.xy += vec2(tx, ty) * 0.5;
            mapN = normalize(mapN);
            vec3 wn = wnrm;
            vec3 an = abs(wn);
            vec3 tW = an.x > 0.5 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
            vec3 bW = an.y > 0.5 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
            vec3 T = normalize((viewMatrix * vec4(tW, 0.0)).xyz);
            vec3 B = normalize((viewMatrix * vec4(bW, 0.0)).xyz);
            vec3 Nn = normalize(normal);
            normal = normalize(T * mapN.x + B * mapN.y + Nn * mapN.z);
          }`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `totalEmissiveRadiance = vTint * orm.b * orm.a * 4.0 * texelColor.rgb * (0.85 + 0.15 * bevel);`,
        )
        .replace(
          '#include <aomap_fragment>',
          `float ambientOcclusion = vAo;
          reflectedLight.indirectDiffuse *= ambientOcclusion;
          #if defined( USE_ENVMAP ) && defined( STANDARD )
            float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
            reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
          #endif`,
        );
    };
    return mat;
  };

  const opaque = make(false);
  const transparent = make(true);
  return {
    opaque,
    transparent,
    setNormalScale(v: number) {
      uniforms.uNormalScale.value = v;
    },
  };
}
