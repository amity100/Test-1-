/** Shared GLSL snippets and constants of the post chain (kept apart from PostFX.ts to avoid import cycles). */

/** HDR values are clamped to this before any post effect (scene-referred, pre-exposure; the sun disk is ~30). */
export const HDR_CLAMP = 256;

/** GLSL: robust NaN/Inf scrub. Uses bit tests so fast-math shader compilers can't optimise it away. */
export const GLSL_SANITIZE = /* glsl */ `
  bool pfxBad(float x){ return (floatBitsToUint(x) & 0x7fffffffu) > 0x7f800000u; } // NaN
  vec3 pfxSanitize(vec3 c, float hi){
    c = vec3(pfxBad(c.r) ? 0.0 : c.r, pfxBad(c.g) ? 0.0 : c.g, pfxBad(c.b) ? 0.0 : c.b);
    return clamp(c, vec3(0.0), vec3(hi)); // +Inf -> hi, -Inf/negatives -> 0
  }`;

/** Full-screen triangle/quad vertex shader (FullScreenQuad geometry is already in clip space). */
export const FS_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/** GLSL: view-space depth (negative) from a [0,1] depth-buffer value of a perspective camera. */
export const GLSL_VIEWZ = /* glsl */ `
  float pfxViewZ(float d, float n, float f){ return (n * f) / ((f - n) * d - f); }`;
