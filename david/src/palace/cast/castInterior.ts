import * as THREE from 'three';
import { palaceUniforms } from '../palaceMaterials';

/*
 * The set's interior lighting model for the cast (see palaceMaterials.ts `interiorize`): inside the closed hall the
 * sky is seen only through a few small windows, so the scene's sky ambient and sky reflections must fall to the
 * set's `uSkyVis`, tinted by the warm bounce of the lamp-lit floor — otherwise skin and cloth glow as if outdoors.
 *
 * Unlike `interiorize` (permanent, for the hall's own surfaces) the cast walks in and out, so the patch is blended by
 * one shared uniform: `castInterior.value` = 0 outdoors (no change at all), 1 in the hall. A small floor (`FLOOR`)
 * keeps a film-like fill in the shadows. Standard / physical materials only (skin, garments, props); the eyes
 * (wet / cornea shaders) and the strand hair keep their own shading, so catch lights stay alive.
 */
export const castInterior = { value: 0 };

const FLOOR = 0.16;

/** Patch every standard / physical material under `root` once (chains any existing onBeforeCompile). */
export function patchCastInterior(root: THREE.Object3D, done: WeakSet<THREE.Material>) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (done.has(mat)) continue;
      done.add(mat);
      const std = mat as THREE.MeshStandardMaterial;
      if (!std.isMeshStandardMaterial || /HumanWet|HumanEye/.test(mat.name)) continue;
      const prev = mat.onBeforeCompile;
      const prevKey = mat.customProgramCacheKey();
      mat.onBeforeCompile = (s, r) => {
        prev.call(mat, s, r);
        if (!s.fragmentShader.includes('#include <lights_fragment_end>')) return;
        s.uniforms.uCastInt = castInterior;
        s.uniforms.uSkyVis = palaceUniforms.uSkyVis;
        s.uniforms.uBounce = palaceUniforms.uBounce;
        s.fragmentShader = s.fragmentShader
          .replace('#include <common>', `#include <common>
uniform float uCastInt; uniform float uSkyVis; uniform vec3 uBounce;`)
          .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
{
  float civ = mix(1.0, max(uSkyVis, ${FLOOR.toFixed(3)}), uCastInt);
  reflectedLight.indirectDiffuse *= mix(vec3(1.0), uBounce, uCastInt) * civ;
  reflectedLight.indirectSpecular *= civ;
}`);
      };
      mat.customProgramCacheKey = () => `${prevKey}|castInt`;
      mat.needsUpdate = true;
    }
  });
}
