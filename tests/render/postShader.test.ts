import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FINAL_FRAG, GRADE_GLSL } from '../../src/render/renderer';

/**
 * The world grade as the separate grade pass had it (before the post chain was fused into one
 * pass). The final pass must run exactly this, reading the scene + bloom (`SRC`) where the grade
 * pass read its input texture (the bloom used to be blended into that texture).
 */
const GRADE_PASS_BODY = `
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);
      // chromatic aberration: subtle at edges, strong during rift passes
      float ca = 0.0012 + uFlash * uFlashCa + uFocus * 0.0015;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ca * 2.0).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ca * 2.0).b;
      if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
      // rift focus: cool desaturation with a teal edge glow
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(col, vec3(lum) * vec3(0.8, 0.95, 1.1), uFocus * 0.55);
      col += uTint * uFocus * smoothstep(0.12, 0.5, r2) * 0.05;
      // cinematic split-tone: cool shadows, warm highlights
      col *= mix(vec3(0.92, 0.97, 1.08), vec3(1.05, 1.0, 0.94), smoothstep(0.0, 0.6, lum));
      float lum2 = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(lum2), col, uSat);
      // vignette
      col *= mix(1.0, smoothstep(0.85, 0.15, r2 * 1.6), 0.55 + uFocus * 0.25);
      // damage + alarm edges
      col = mix(col, vec3(0.6, 0.02, 0.02), uDamage * smoothstep(0.05, 0.45, r2));
      col += vec3(0.25, 0.02, 0.01) * uAlert * smoothstep(0.2, 0.55, r2) * (0.6 + 0.4 * sin(uTime * 6.0));
      // rift pass flash
      col += uTint * uFlash * uFlashGlow * (1.0 - r2 * 2.0);
      // film grain
      float g = hash(uv * uRes + fract(uTime) * 100.0) - 0.5;
      col += g * 0.022 * (1.0 - lum * 0.5);
`;

describe('final post pass', () => {
  it('runs the grade verbatim, on the scene with its bloom', () => {
    const fused = GRADE_PASS_BODY.split('texture2D(tDiffuse, ').join('SRC(');
    expect(GRADE_GLSL).toBe(fused);
    expect(FINAL_FRAG).toContain(fused);
    // SRC = the scene plus its bloom (what the bloom pass added into the scene target)
    expect(FINAL_FRAG).toMatch(/return texture2D\(tScene, sp\) \+ texture2D\(tBloom, p\);/);
    // the grade's grain hash, unchanged
    expect(FINAL_FRAG).toContain('float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }');
  });

  it('then does what the output pass did: exposure + ACES filmic, then sRGB, in that order', () => {
    const grade = FINAL_FRAG.indexOf('col += g * 0.022');
    const out = FINAL_FRAG.indexOf('gl_FragColor = vec4(max(col, 0.0), 1.0);');
    const tone = FINAL_FRAG.indexOf('gl_FragColor.rgb = ACESFilmicToneMapping(gl_FragColor.rgb);');
    const srgb = FINAL_FRAG.indexOf('gl_FragColor = sRGBTransferOETF(gl_FragColor);');
    expect(grade).toBeGreaterThan(0);
    expect(out).toBeGreaterThan(grade);
    expect(tone).toBeGreaterThan(out);
    expect(srgb).toBeGreaterThan(tone);
    expect(FINAL_FRAG).toContain('#include <tonemapping_pars_fragment>');
    expect(FINAL_FRAG).toContain('#include <colorspace_pars_fragment>');
    // (three's chunks still define what it calls, with the exposure inside the tone map)
    const chunks = THREE.ShaderChunk as unknown as Record<string, string>;
    expect(chunks.tonemapping_pars_fragment).toContain('vec3 ACESFilmicToneMapping( vec3 color )');
    expect(chunks.tonemapping_pars_fragment).toContain('color *= toneMappingExposure / 0.6;');
    expect(chunks.colorspace_pars_fragment).toContain('vec4 sRGBTransferOETF( in vec4 value )');
  });

  it('reads the scene target as it is at full resolution (the dynamic-scale clamp is off at 1)', () => {
    expect(FINAL_FRAG).toContain('vec2 sp = uDyn > 0.5 ? clamp(p * uScale, uLo, uHi) : p;');
  });
});
