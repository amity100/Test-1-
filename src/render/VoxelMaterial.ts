import * as THREE from 'three';
import type { VoxelTextureSet } from './Textures';

export interface VoxelMaterials {
  opaque: THREE.MeshStandardMaterial;
  transparent: THREE.MeshStandardMaterial;
  setNormalScale(v: number): void;
}

/**
 * PBR block material: samples albedo/normal/ORM from array textures using the per-vertex
 * material index, tints by palette colour, applies baked vertex AO and emissive.
 */
export function createVoxelMaterials(tex: VoxelTextureSet): VoxelMaterials {
  const uniforms = {
    uAlbedo: { value: tex.albedo },
    uNormal: { value: tex.normal },
    uORM: { value: tex.orm },
    uNormalScale: { value: 1.0 },
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
    mat.customProgramCacheKey = () => (transparent ? 'voxel-transparent' : 'voxel-opaque');
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
          varying vec3 vWNormal;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vUvB = aUv;
          vMat = aMat;
          vAo = aAo;
          vTint = aTint;
          vWNormal = normal;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform highp sampler2DArray uAlbedo;
          uniform highp sampler2DArray uNormal;
          uniform highp sampler2DArray uORM;
          uniform float uNormalScale;
          varying vec2 vUvB;
          varying float vMat;
          varying float vAo;
          varying vec3 vTint;
          varying vec3 vWNormal;`,
        )
        .replace(
          '#include <map_fragment>',
          `vec3 vUvA = vec3(vUvB, vMat);
          vec4 texelColor = texture(uAlbedo, vUvA);
          vec4 orm = texture(uORM, vUvA);
          diffuseColor.rgb *= texelColor.rgb * vTint;`,
        )
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = orm.r;`)
        .replace('#include <metalnessmap_fragment>', `float metalnessFactor = orm.g;`)
        .replace(
          '#include <normal_fragment_maps>',
          `{
            vec3 mapN = texture(uNormal, vUvA).xyz * 2.0 - 1.0;
            mapN.xy *= uNormalScale;
            vec3 wn = normalize(vWNormal);
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
          `totalEmissiveRadiance = vTint * orm.b * orm.a * 4.0 * texelColor.rgb;`,
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
