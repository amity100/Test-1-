import * as THREE from 'three';

/**
 * Engine-wide temporal state for shaders that dither (stochastic transparency, hashed coverage, ray-march
 * jitter). Kept up to date by PostFX every rendered frame.
 *
 * With temporal anti-aliasing active, a screen-space dither pattern that CHANGES every frame is averaged by the
 * TAA history into smooth partial coverage (hair strands thinner than a pixel, fur tips, god-ray noise). A static
 * pattern is not: it stays visible as fixed grain. So dithering shaders should add `uDitherOffset` to the pixel
 * coordinate they hash:
 *
 *     import { temporal } from '../../fx/Temporal';
 *     shader.uniforms.uDitherOffset = temporal.uDitherOffset;          // in onBeforeCompile
 *     uniform vec2 uDitherOffset;                                      // GLSL declaration
 *     float n = ign(gl_FragCoord.xy + uDitherOffset);                  // interleaved gradient noise
 *
 * When TAA is off (phones on FXAA, harnesses) the offset stays (0, 0), i.e. the pattern is static exactly as
 * before (a pattern that changes every frame without TAA would crawl).
 */
export const temporal = {
  /** 1 while temporal accumulation (TAA) is active, else 0 */
  uTaaActive: { value: 0 },
  /** frame index of the TAA sequence (0..63, wraps); 0 when TAA is off */
  uFrame: { value: 0 },
  /**
   * per-frame pixel offset for screen-space dither patterns: 5.588238 * frame on both axes, the decorrelating
   * step for interleaved gradient noise (Jimenez 2014); (0, 0) when TAA is off
   */
  uDitherOffset: { value: new THREE.Vector2() },
  /** current sub-pixel projection jitter in pixels (-0.5..0.5); (0, 0) when TAA is off */
  uJitter: { value: new THREE.Vector2() },
};

/** GLSL: interleaved gradient noise (0..1) — use as `pfxIGN(gl_FragCoord.xy + uDitherOffset)`. */
export const GLSL_IGN = /* glsl */ `
  float pfxIGN(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }`;

/** Halton low-discrepancy value (base b) of index i >= 1. */
export function halton(i: number, b: number): number {
  let f = 1, r = 0;
  while (i > 0) {
    f /= b;
    r += f * (i % b);
    i = Math.floor(i / b);
  }
  return r;
}

/** Sub-pixel jitter offsets (pixels, centred on 0) of the Halton(2,3) sequence. */
export function haltonJitter(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 1; i <= n; i++) out.push([halton(i, 2) - 0.5, halton(i, 3) - 0.5]);
  return out;
}
