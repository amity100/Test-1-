import * as THREE from 'three';
import { Effect, EffectAttribute, BlendFunction } from 'postprocessing';

const FRAG = /* glsl */ `
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform vec3 uSunColor;
uniform float uDensity;
uniform float uHeightDensity;
uniform float uHeightFalloff;
uniform float uFogBase;
uniform float uMaxOpacity;
uniform float uBandY;
uniform float uBandHalf;
uniform float uBandDensity;
uniform float uUnderwater;

vec3 reconstructWorld(vec2 uv, float depth) {
  vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 view = uProjInv * clip;
  view /= view.w;
  return (uCamWorld * vec4(view.xyz, 1.0)).xyz;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  if (depth >= 0.99999) { outputColor = inputColor; return; }
  vec3 wp = reconstructWorld(uv, depth);
  vec3 ro = uCamPos;
  vec3 seg = wp - ro;
  float dist = length(seg);
  vec3 rd = seg / max(dist, 1e-4);
  // Uniform distance fog
  float f1 = 1.0 - exp(-dist * uDensity);
  // Exponential height fog integrated along the ray
  float b = uHeightFalloff;
  float hy0 = ro.y - uFogBase;
  float ry = rd.y;
  float integral;
  if (abs(ry) < 1e-3) integral = exp(-hy0 * b) * dist;
  else integral = exp(-hy0 * b) * (1.0 - exp(-dist * ry * b)) / (ry * b);
  float f2 = 1.0 - exp(-uHeightDensity * max(integral, 0.0));
  // A cloud band at altitude: sample the ray through the layer.
  float band = 0.0;
  if (uBandDensity > 0.0) {
    float acc = 0.0;
    for (int i = 0; i < 12; i++) {
      float s = (float(i) + 0.5) / 12.0;
      float y = ro.y + rd.y * dist * s;
      float w = 1.0 - smoothstep(0.0, uBandHalf, abs(y - uBandY));
      acc += w;
    }
    band = 1.0 - exp(-uBandDensity * dist * acc / 12.0);
  }
  float fog = clamp(1.0 - (1.0 - f1) * (1.0 - f2), 0.0, uMaxOpacity);
  fog = max(fog, band * 0.92);
  float sunAmount = pow(max(dot(rd, normalize(uSunDir)), 0.0), 10.0);
  vec3 fogCol = mix(uFogColor, uSunColor, sunAmount * 0.3);
  fogCol = mix(fogCol, vec3(0.93, 0.9, 0.86), band * 0.8);
  // Under the sea: a close teal murk.
  if (uUnderwater > 0.0) {
    float under = 1.0 - exp(-dist * 0.09);
    fog = max(fog, under * uUnderwater);
    fogCol = mix(fogCol, vec3(0.05, 0.28, 0.32), uUnderwater);
  }
  outputColor = vec4(mix(inputColor.rgb, fogCol, fog), inputColor.a);
}`;

export interface HeightFogOptions {
  density?: number;
  heightDensity?: number;
  heightFalloff?: number;
  fogBase?: number;
  fogColor?: THREE.Color;
  sunColor?: THREE.Color;
}

/** Atmospheric distance + height fog with sun in-scatter, computed from the depth buffer. */
export class HeightFogEffect extends Effect {
  private camera: THREE.PerspectiveCamera;

  constructor(camera: THREE.PerspectiveCamera, options: HeightFogOptions = {}) {
    super('HeightFogEffect', FRAG, {
      blendFunction: BlendFunction.SRC,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ['uProjInv', new THREE.Uniform(new THREE.Matrix4())],
        ['uCamWorld', new THREE.Uniform(new THREE.Matrix4())],
        ['uCamPos', new THREE.Uniform(new THREE.Vector3())],
        ['uSunDir', new THREE.Uniform(new THREE.Vector3(0, 1, 0))],
        ['uFogColor', new THREE.Uniform(options.fogColor ?? new THREE.Color(0.42, 0.55, 0.78))],
        ['uSunColor', new THREE.Uniform(options.sunColor ?? new THREE.Color(1.05, 0.88, 0.66))],
        ['uDensity', new THREE.Uniform(options.density ?? 0.0008)],
        ['uHeightDensity', new THREE.Uniform(options.heightDensity ?? 0.0022)],
        ['uHeightFalloff', new THREE.Uniform(options.heightFalloff ?? 0.16)],
        ['uFogBase', new THREE.Uniform(options.fogBase ?? -3)],
        ['uMaxOpacity', new THREE.Uniform(0.7)],
        ['uBandY', new THREE.Uniform(0)],
        ['uBandHalf', new THREE.Uniform(1)],
        ['uBandDensity', new THREE.Uniform(0)],
        ['uUnderwater', new THREE.Uniform(0)],
      ]),
    });
    this.camera = camera;
  }

  /** A layer of cloud centred on `y`, `half` metres thick each way; density 0 turns it off. */
  setCloudBand(y: number, half: number, density: number): void {
    this.uniforms.get('uBandY')!.value = y;
    this.uniforms.get('uBandHalf')!.value = Math.max(0.01, half);
    this.uniforms.get('uBandDensity')!.value = density;
  }

  /** 0..1 how far under the sea the camera is. */
  setUnderwater(amount: number): void {
    this.uniforms.get('uUnderwater')!.value = amount;
  }

  setSun(dir: THREE.Vector3, color: THREE.Color): void {
    (this.uniforms.get('uSunDir')!.value as THREE.Vector3).copy(dir);
    (this.uniforms.get('uSunColor')!.value as THREE.Color).copy(color);
  }

  setFogColor(c: THREE.Color): void {
    (this.uniforms.get('uFogColor')!.value as THREE.Color).copy(c);
  }

  setDensity(distance: number, height: number): void {
    this.uniforms.get('uDensity')!.value = distance;
    this.uniforms.get('uHeightDensity')!.value = height;
  }

  override update(): void {
    const cam = this.camera;
    (this.uniforms.get('uProjInv')!.value as THREE.Matrix4).copy(cam.projectionMatrixInverse);
    (this.uniforms.get('uCamWorld')!.value as THREE.Matrix4).copy(cam.matrixWorld);
    (this.uniforms.get('uCamPos')!.value as THREE.Vector3).setFromMatrixPosition(cam.matrixWorld);
  }
}
