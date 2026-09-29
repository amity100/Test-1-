import * as THREE from 'three';

/**
 * Uniforms shared by world shaders only (the engine-wide ones live in core/Shared.ts).
 * The shadow frame describes the sun's real shadow-map frustum (kept up to date by SkySystem.update) so that
 * baked long shadows (tree canopies, terrace walls) are used only where the shadow map does not reach.
 */
export const worldShared = {
  uShadowCenter: { value: new THREE.Vector3() },
  uShadowRight: { value: new THREE.Vector3(1, 0, 0) },
  uShadowUp: { value: new THREE.Vector3(0, 1, 0) },
  /** half extent (m) of the shadow frustum in light space; 0 = no real shadows anywhere */
  uShadowHalf: { value: 0 },
};

/** GLSL: 1 inside the real shadow-map frustum (with a soft 8 m border), 0 outside. */
export const GLSL_SHADOW_FRAME = /* glsl */ `
uniform vec3 uShadowCenter, uShadowRight, uShadowUp; uniform float uShadowHalf;
float inShadowFrame(vec3 wp){
  vec3 d = wp - uShadowCenter;
  float a = max(abs(dot(d, uShadowRight)), abs(dot(d, uShadowUp)));
  return 1.0 - smoothstep(uShadowHalf - 12.0, uShadowHalf - 4.0, a);
}`;
