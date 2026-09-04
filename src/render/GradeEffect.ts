import * as THREE from 'three';
import { Effect, BlendFunction } from 'postprocessing';

const FRAG = /* glsl */ `
uniform float uSharpen;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uToneStrength;
uniform float uLift;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  if (uSharpen > 0.0) {
    // Unsharp mask against the 4-neighbour average, clamped to avoid haloing highlights.
    vec3 n = texture2D(inputBuffer, uv + vec2(0.0, texelSize.y)).rgb;
    vec3 s = texture2D(inputBuffer, uv - vec2(0.0, texelSize.y)).rgb;
    vec3 e = texture2D(inputBuffer, uv + vec2(texelSize.x, 0.0)).rgb;
    vec3 w = texture2D(inputBuffer, uv - vec2(texelSize.x, 0.0)).rgb;
    vec3 blur = (n + s + e + w) * 0.25;
    vec3 detail = clamp(c - blur, -0.08, 0.08);
    c += detail * uSharpen;
  }
  // Split toning: cool shadows, warm highlights.
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 tint = mix(uShadowTint, uHighlightTint, smoothstep(0.12, 0.8, lum));
  c = mix(c, c * tint, uToneStrength);
  // Gentle lift so blacks keep a little detail (filmic feel).
  c = c * (1.0 - uLift) + uLift * 0.5 * vec3(0.9, 0.95, 1.0) * (1.0 - c);
  outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
}`;

/** Final look pass (after tone mapping): sharpen, split toning and a subtle lift. */
export class GradeEffect extends Effect {
  constructor(options: { sharpen?: number; toneStrength?: number; lift?: number } = {}) {
    super('GradeEffect', FRAG, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, THREE.Uniform>([
        ['uSharpen', new THREE.Uniform(options.sharpen ?? 0.45)],
        ['uShadowTint', new THREE.Uniform(new THREE.Color(0.9, 0.97, 1.08))],
        ['uHighlightTint', new THREE.Uniform(new THREE.Color(1.06, 1.0, 0.93))],
        ['uToneStrength', new THREE.Uniform(options.toneStrength ?? 0.55)],
        ['uLift', new THREE.Uniform(options.lift ?? 0.02)],
      ]),
    });
  }

  set sharpen(v: number) {
    this.uniforms.get('uSharpen')!.value = v;
  }
}
