import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { shared } from '../core/Shared';
import { BloomPass } from './Bloom';

/**
 * Post chain (all passes are full-screen triangles/quads, no depth test):
 *
 *   RenderPass ─► Atmosphere (+NaN/Inf guard, HDR clamp, fog, god rays) ─► Bloom (optional, additive)
 *              ─► Finish (tone map, sRGB, grade, vignette, [chromatic aberration]) ─► Resolve (FXAA and/or CAS
 *                 sharpening, [film grain], dither) ─► screen
 *
 * Mobile safety:
 *  - The HDR scene target is RGBA16F. A glancing sun reflection on a smooth surface (GGX with three's minimum
 *    roughness) easily exceeds 65504 → Inf in half float; before this guard existed a single such pixel was
 *    smeared by the bloom mips over a third of the screen and became NaN in ACES (Inf/Inf) → black blotch /
 *    black flash for as long as the glint lasted. The atmosphere pass now scrubs NaN/Inf/negatives and clamps.
 *  - Chromatic aberration and grain are desktop-only (they cost taps, and soften/noise a small phone image).
 *  - Each render target keeps its own depth texture (no read/write feedback loop), also after resizes.
 */

/** HDR values are clamped to this before any post effect (scene-referred, pre-exposure; the sun disk is ~30). */
export const HDR_CLAMP = 256;

/** GLSL: robust NaN/Inf scrub. Uses bit tests so fast-math shader compilers can't optimise it away. */
export const GLSL_SANITIZE = /* glsl */ `
  bool pfxBad(float x){ return (floatBitsToUint(x) & 0x7fffffffu) > 0x7f800000u; } // NaN
  vec3 pfxSanitize(vec3 c, float hi){
    c = vec3(pfxBad(c.r) ? 0.0 : c.r, pfxBad(c.g) ? 0.0 : c.g, pfxBad(c.b) ? 0.0 : c.b);
    return clamp(c, vec3(0.0), vec3(hi)); // +Inf -> hi, -Inf/negatives -> 0
  }`;

const FS_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/**
 * Aerial perspective + height fog + screen-space god rays, computed from the depth buffer.
 * Fog colour is looked up from a captured sky cube so distant ridges dissolve into the horizon.
 */
class AtmospherePass extends Pass {
  readonly uniforms: Record<string, THREE.IUniform>;
  private quad: FullScreenQuad;
  private material: THREE.ShaderMaterial;
  constructor(private camera: THREE.PerspectiveCamera, skyCube: THREE.CubeTexture, godRaySamples: number) {
    super();
    this.uniforms = {
      tDiffuse: { value: null },
      tDepth: { value: null },
      tSky: { value: skyCube },
      uProjInv: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() },
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uDensity: { value: 0.00042 },
      uHeightFalloff: { value: 0.0065 },
      uBaseHeight: { value: -20 },
      uSunUV: { value: new THREE.Vector2() },
      uSunOnScreen: { value: 0 },
      uGodRays: { value: 0.24 },
      uGodRaySamples: { value: godRaySamples },
      uHazeTint: { value: new THREE.Color(1, 1, 1) },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      defines: { GR_MAX: Math.max(4, godRaySamples), HDR_MAX: HDR_CLAMP.toFixed(1) },
      depthTest: false,
      depthWrite: false,
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform samplerCube tSky;
        uniform mat4 uProjInv; uniform mat4 uCamWorld; uniform vec3 uCamPos;
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uHazeTint;
        uniform float uDensity, uHeightFalloff, uBaseHeight, uSunOnScreen, uGodRays;
        uniform int uGodRaySamples;
        uniform vec2 uSunUV;
        varying vec2 vUv;
        ${GLSL_SANITIZE}
        vec3 worldFromDepth(vec2 uv, float d){
          vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
          vec4 v = uProjInv * clip; v /= v.w;
          return (uCamWorld * v).xyz;
        }
        void main(){
          vec3 col = pfxSanitize(texture2D(tDiffuse, vUv).rgb, HDR_MAX);
          float depth = texture2D(tDepth, vUv).x;
          vec3 wp = worldFromDepth(vUv, depth);
          vec3 rd = normalize(wp - uCamPos);
          float mu = max(dot(rd, uSunDir), 0.0);
          if (depth < 0.99999) {
            float dist = length(wp - uCamPos);
            // exponential height fog (analytic integral along the ray)
            float b = uHeightFalloff;
            float h0 = max(uCamPos.y - uBaseHeight, 0.0);
            float ry = rd.y;
            float fogAmt;
            if (abs(ry) > 1e-4) fogAmt = uDensity * exp(-h0 * b) * (1.0 - exp(clamp(-dist * ry * b, -80.0, 80.0))) / (ry * b);
            else fogAmt = uDensity * exp(-h0 * b) * dist;
            fogAmt = 1.0 - exp(-max(fogAmt, 0.0));
            fogAmt = clamp(fogAmt, 0.0, 0.985);
            vec3 skyDir = normalize(vec3(rd.x, max(rd.y, 0.015) * 0.35 + 0.012, rd.z));
            vec3 haze = textureCube(tSky, skyDir).rgb * uHazeTint;
            // golden-hour aerial perspective: warm toward the sun, dusty violet-blue away from it
            float sunSide = pow(mu, 3.0);
            haze *= mix(vec3(0.62, 0.62, 0.74), vec3(1.0, 0.82, 0.6), sunSide);
            vec3 inscatter = uSunColor * (pow(mu, 8.0) * 0.6 + pow(mu, 48.0) * 0.9);
            col = mix(col, haze + inscatter * fogAmt, fogAmt);
          }
          // god rays: march toward the sun in screen space, count sky pixels
          if (uSunOnScreen > 0.001) {
            float n = float(uGodRaySamples);
            vec2 delta = (uSunUV - vUv) / n;
            vec2 uv = vUv;
            float illum = 0.0, decay = 1.0, wsum = 0.0;
            float jitter = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
            uv += delta * jitter;
            for (int i = 0; i < GR_MAX; i++) {
              if (i >= uGodRaySamples) break;
              uv += delta;
              float dd = texture2D(tDepth, clamp(uv, 0.001, 0.999)).x;
              illum += step(0.99999, dd) * decay;
              wsum += decay;
              decay *= 0.965;
            }
            illum /= max(wsum, 1e-3);
            float radial = 1.0 - smoothstep(0.0, 0.65, length((vUv - uSunUV) * vec2(1.7, 1.0)));
            col += uSunColor * illum * radial * uGodRays * uSunOnScreen * 0.55;
          }
          gl_FragColor = vec4(pfxSanitize(col, HDR_MAX), 1.0);
        }`,
    });
    this.material.toneMapped = false;
    this.quad = new FullScreenQuad(this.material);
  }

  /** god-ray sample count can be lowered at runtime without a shader recompile (up to the initial count) */
  setGodRaySamples(n: number) {
    this.uniforms.uGodRaySamples.value = Math.max(0, Math.min(n, Number(this.material.defines.GR_MAX)));
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    const cam = this.camera;
    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.tDepth.value = readBuffer.depthTexture;
    this.uniforms.uProjInv.value.copy(cam.projectionMatrixInverse);
    this.uniforms.uCamWorld.value.copy(cam.matrixWorld);
    this.uniforms.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
    // sun screen position
    const sp = shared.uSunDir.value.clone().multiplyScalar(5000).add(this.uniforms.uCamPos.value);
    sp.project(cam);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const facing = fwd.dot(shared.uSunDir.value);
    const finite = Number.isFinite(sp.x) && Number.isFinite(sp.y);
    this.uniforms.uSunUV.value.set(finite ? sp.x * 0.5 + 0.5 : 0.5, finite ? sp.y * 0.5 + 0.5 : 0.5);
    const onScreen = facing > 0 && finite && this.uniforms.uGodRaySamples.value > 0
      ? THREE.MathUtils.smoothstep(facing, 0.0, 0.5) * (1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(sp.x), Math.abs(sp.y)), 1.0, 1.9))
      : 0;
    this.uniforms.uSunOnScreen.value = onScreen;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}

/** Uniforms of the grading stage. Gameplay code drives uRed / uDesat / uFade through `post.grade.uniforms`. */
export function createGradeUniforms(): Record<string, THREE.IUniform> {
  return {
    uTime: { value: 0 },
    uVignette: { value: 0.16 },
    uGrain: { value: 0.018 },
    uSaturation: { value: 1.06 },
    uContrast: { value: 1.05 },
    uFade: { value: 0 },
    uDesat: { value: 0 },
    uRed: { value: 0 },
    uCA: { value: 0.0012 },
    uWarm: { value: 0.03 },
  };
}

/** Tone mapping + sRGB + film grade + vignette (+ chromatic aberration on desktop). */
class FinishPass extends Pass {
  readonly uniforms: Record<string, THREE.IUniform>;
  private material: THREE.ShaderMaterial;
  private quad: FullScreenQuad;
  private toneMapping: THREE.ToneMapping = -1 as THREE.ToneMapping;
  constructor(grade: Record<string, THREE.IUniform>, chromatic: boolean) {
    super();
    // share the caller's uniform objects so references held by gameplay survive a PostFX rebuild
    this.uniforms = grade;
    const defines: Record<string, string> = {};
    if (chromatic) defines.USE_CA = '';
    this.material = new THREE.ShaderMaterial({
      uniforms: { ...grade, tDiffuse: { value: null }, toneMappingExposure: { value: 1 }, uAspect: { value: 1 } },
      defines,
      depthTest: false,
      depthWrite: false,
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform float uTime, uVignette, uSaturation, uContrast, uFade, uDesat, uRed, uCA, uWarm, uAspect;
        varying vec2 vUv;
        #include <tonemapping_pars_fragment>
        vec3 toneMap(vec3 c){
          #if defined(TM_AGX)
            return AgXToneMapping(c);
          #elif defined(TM_NEUTRAL)
            return NeutralToneMapping(c);
          #elif defined(TM_REINHARD)
            return ReinhardToneMapping(c);
          #elif defined(TM_LINEAR)
            return LinearToneMapping(c);
          #else
            return ACESFilmicToneMapping(c);
          #endif
        }
        void main(){
          vec2 dir = vUv - 0.5;
          vec3 hdr;
          #ifdef USE_CA
            float r2 = dot(dir, dir);
            hdr.r = texture2D(tDiffuse, vUv - dir * uCA * r2 * 4.0).r;
            hdr.g = texture2D(tDiffuse, vUv).g;
            hdr.b = texture2D(tDiffuse, vUv + dir * uCA * r2 * 4.0).b;
          #else
            hdr = texture2D(tDiffuse, vUv).rgb;
          #endif
          vec3 col = sRGBTransferOETF(vec4(toneMap(max(hdr, vec3(0.0))), 1.0)).rgb;
          // grade: gentle S-curve, warm highlights / teal-ish shadows (film look)
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(l), col, uSaturation * (1.0 - uDesat));
          col = (col - 0.5) * uContrast + 0.5;
          col += vec3(uWarm, uWarm * 0.35, -uWarm * 0.6) * smoothstep(0.35, 1.0, l);
          col += vec3(-0.012, 0.0, 0.018) * (1.0 - smoothstep(0.0, 0.35, l));
          // vignette, relative to the long screen axis (in portrait the old UV-space ellipse turned into
          // dark bars down both sides of a phone screen)
          vec2 vd = uAspect >= 1.0 ? dir : dir.yx;
          float v = smoothstep(0.85, 0.2, length(vd * vec2(1.0, 0.85)) * (1.0 + uVignette));
          col *= mix(1.0, v, 0.9);
          // damage pulse
          col = mix(col, col * vec3(1.25, 0.45, 0.4), uRed * smoothstep(0.1, 0.6, length(dir)));
          col *= 1.0 - uFade;
          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }`,
    });
    this.material.toneMapped = false;
    this.quad = new FullScreenQuad(this.material);
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    if (renderer.toneMapping !== this.toneMapping) {
      this.toneMapping = renderer.toneMapping;
      const d = this.material.defines;
      delete d.TM_AGX; delete d.TM_NEUTRAL; delete d.TM_REINHARD; delete d.TM_LINEAR;
      if (this.toneMapping === THREE.AgXToneMapping) d.TM_AGX = '';
      else if (this.toneMapping === THREE.NeutralToneMapping) d.TM_NEUTRAL = '';
      else if (this.toneMapping === THREE.ReinhardToneMapping) d.TM_REINHARD = '';
      else if (this.toneMapping === THREE.LinearToneMapping || this.toneMapping === THREE.NoToneMapping) d.TM_LINEAR = '';
      this.material.needsUpdate = true;
    }
    const u = this.material.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.uAspect.value = readBuffer.width / Math.max(1, readBuffer.height);
    u.toneMappingExposure.value = renderer.toneMapping === THREE.NoToneMapping ? 1 : renderer.toneMappingExposure;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}

/**
 * Final resolve on the display-referred (sRGB) image:
 *  - FXAA 3.11 "quality" (edge search, sub-pixel AA) when MSAA is off,
 *  - AMD-CAS-style contrast-adaptive sharpening on every non-edge pixel (restores texture crispness
 *    lost to bilinear up-scaling / FXAA; limited by local contrast so it never rings),
 *  - optional film grain and a 1-LSB dither against banding in the 8-bit output.
 */
class ResolvePass extends Pass {
  readonly uniforms: Record<string, THREE.IUniform>;
  private material: THREE.ShaderMaterial;
  private quad: FullScreenQuad;
  constructor(opts: { fxaa: boolean; sharpen: number; grain: boolean }, grade: Record<string, THREE.IUniform>) {
    super();
    this.uniforms = {
      tDiffuse: { value: null },
      uRcp: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
      uSharp: { value: opts.sharpen },
      uGrain: grade.uGrain,
      uTime: grade.uTime,
    };
    const defines: Record<string, string> = {};
    if (opts.fxaa) defines.USE_FXAA = '';
    if (opts.grain) defines.USE_GRAIN = '';
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      defines,
      depthTest: false,
      depthWrite: false,
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform vec2 uRcp; uniform float uSharp, uGrain, uTime;
        varying vec2 vUv;
        float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
        vec3 T(vec2 p){ return texture2D(tDiffuse, p).rgb; }
        vec3 cas(vec3 m, vec3 n, vec3 s, vec3 e, vec3 w){
          if (uSharp <= 0.0) return m;
          vec3 mn = min(m, min(min(n, s), min(e, w)));
          vec3 mx = max(m, max(max(n, s), max(e, w)));
          vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0));
          vec3 wgt = amp * (-1.0 / mix(8.0, 4.5, uSharp));
          return clamp((m + (n + s + e + w) * wgt) / (1.0 + 4.0 * wgt), 0.0, 1.0);
        }
        float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        void main(){
          vec2 posM = vUv;
          vec3 rgbM = T(posM);
          vec3 rgbN = T(posM + vec2(0.0, -uRcp.y));
          vec3 rgbS = T(posM + vec2(0.0, uRcp.y));
          vec3 rgbE = T(posM + vec2(uRcp.x, 0.0));
          vec3 rgbW = T(posM + vec2(-uRcp.x, 0.0));
          vec3 col = rgbM;
        #ifdef USE_FXAA
          float lumaM = luma(rgbM), lumaN = luma(rgbN), lumaS = luma(rgbS), lumaE = luma(rgbE), lumaW = luma(rgbW);
          float rangeMax = max(max(lumaN, lumaW), max(lumaE, max(lumaS, lumaM)));
          float rangeMin = min(min(lumaN, lumaW), min(lumaE, min(lumaS, lumaM)));
          float range = rangeMax - rangeMin;
          if (range < max(0.0625, rangeMax * 0.125)) {
            col = cas(rgbM, rgbN, rgbS, rgbE, rgbW);
          } else {
            float lumaNW = luma(T(posM + vec2(-uRcp.x, -uRcp.y)));
            float lumaSE = luma(T(posM + vec2(uRcp.x, uRcp.y)));
            float lumaNE = luma(T(posM + vec2(uRcp.x, -uRcp.y)));
            float lumaSW = luma(T(posM + vec2(-uRcp.x, uRcp.y)));
            float lumaNS = lumaN + lumaS, lumaWE = lumaW + lumaE;
            float subpixRcpRange = 1.0 / range;
            float subpixNSWE = lumaNS + lumaWE;
            float edgeHorz1 = -2.0 * lumaM + lumaNS;
            float edgeVert1 = -2.0 * lumaM + lumaWE;
            float lumaNESE = lumaNE + lumaSE, lumaNWNE = lumaNW + lumaNE;
            float edgeHorz2 = -2.0 * lumaE + lumaNESE;
            float edgeVert2 = -2.0 * lumaN + lumaNWNE;
            float lumaNWSW = lumaNW + lumaSW, lumaSWSE = lumaSW + lumaSE;
            float edgeHorz4 = abs(edgeHorz1) * 2.0 + abs(edgeHorz2);
            float edgeVert4 = abs(edgeVert1) * 2.0 + abs(edgeVert2);
            float edgeHorz3 = -2.0 * lumaW + lumaNWSW;
            float edgeVert3 = -2.0 * lumaS + lumaSWSE;
            float edgeHorz = abs(edgeHorz3) + edgeHorz4;
            float edgeVert = abs(edgeVert3) + edgeVert4;
            float subpixNWSWNESE = lumaNWSW + lumaNESE;
            float lengthSign = uRcp.x;
            bool horzSpan = edgeHorz >= edgeVert;
            float subpixA = subpixNSWE * 2.0 + subpixNWSWNESE;
            if (!horzSpan) { lumaN = lumaW; lumaS = lumaE; } else lengthSign = uRcp.y;
            float subpixB = subpixA * (1.0 / 12.0) - lumaM;
            float gradientN = lumaN - lumaM, gradientS = lumaS - lumaM;
            float lumaNN = lumaN + lumaM, lumaSS = lumaS + lumaM;
            bool pairN = abs(gradientN) >= abs(gradientS);
            float gradient = max(abs(gradientN), abs(gradientS));
            if (pairN) lengthSign = -lengthSign;
            float subpixC = clamp(abs(subpixB) * subpixRcpRange, 0.0, 1.0);
            vec2 posB = posM;
            vec2 offNP = horzSpan ? vec2(uRcp.x, 0.0) : vec2(0.0, uRcp.y);
            if (!horzSpan) posB.x += lengthSign * 0.5; else posB.y += lengthSign * 0.5;
            vec2 posN = posB - offNP, posP = posB + offNP;
            float subpixD = -2.0 * subpixC + 3.0;
            float subpixE = subpixC * subpixC;
            if (!pairN) lumaNN = lumaSS;
            float gradientScaled = gradient * 0.25;
            float lumaMM = lumaM - lumaNN * 0.5;
            float subpixF = subpixD * subpixE;
            bool lumaMLTZero = lumaMM < 0.0;
            float lumaEndN = luma(T(posN)) - lumaNN * 0.5;
            float lumaEndP = luma(T(posP)) - lumaNN * 0.5;
            bool doneN = abs(lumaEndN) >= gradientScaled;
            bool doneP = abs(lumaEndP) >= gradientScaled;
            if (!doneN) posN -= offNP * 1.5;
            if (!doneP) posP += offNP * 1.5;
            const float STEPS[6] = float[6](2.0, 2.0, 2.0, 4.0, 8.0, 12.0);
            for (int i = 0; i < 6; i++) {
              if (doneN && doneP) break;
              if (!doneN) lumaEndN = luma(T(posN)) - lumaNN * 0.5;
              if (!doneP) lumaEndP = luma(T(posP)) - lumaNN * 0.5;
              doneN = abs(lumaEndN) >= gradientScaled;
              doneP = abs(lumaEndP) >= gradientScaled;
              if (!doneN) posN -= offNP * STEPS[i];
              if (!doneP) posP += offNP * STEPS[i];
            }
            float dstN = horzSpan ? posM.x - posN.x : posM.y - posN.y;
            float dstP = horzSpan ? posP.x - posM.x : posP.y - posM.y;
            bool goodSpanN = (lumaEndN < 0.0) != lumaMLTZero;
            bool goodSpanP = (lumaEndP < 0.0) != lumaMLTZero;
            float spanLength = dstP + dstN;
            bool directionN = dstN < dstP;
            float dst = min(dstN, dstP);
            bool goodSpan = directionN ? goodSpanN : goodSpanP;
            float subpixG = subpixF * subpixF;
            float pixelOffset = dst * (-1.0 / spanLength) + 0.5;
            float subpixH = subpixG * 0.45; // sub-pixel AA amount (NVIDIA default 0.75; lower = sharper)
            float pixelOffsetSubpix = max(goodSpan ? pixelOffset : 0.0, subpixH);
            vec2 posF = posM;
            if (!horzSpan) posF.x += pixelOffsetSubpix * lengthSign; else posF.y += pixelOffsetSubpix * lengthSign;
            col = T(posF);
          }
        #else
          col = cas(rgbM, rgbN, rgbS, rgbE, rgbW);
        #endif
        #ifdef USE_GRAIN
          col += (hash(gl_FragCoord.xy + fract(uTime) * 517.0) - 0.5) * uGrain;
        #endif
          // triangular dither, 1 LSB of the 8-bit output: removes banding in the sky gradients
          col += (hash(gl_FragCoord.xy * 1.37 + 11.0) + hash(gl_FragCoord.xy * 0.71 + 3.0) - 1.0) / 255.0;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.material.toneMapped = false;
    this.quad = new FullScreenQuad(this.material);
  }

  setSize(w: number, h: number) {
    (this.uniforms.uRcp.value as THREE.Vector2).set(1 / Math.max(1, w), 1 / Math.max(1, h));
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}

export interface PostQuality {
  /** MSAA samples on the HDR scene target (0 = off; then use aa: 'fxaa') */
  msaa: number;
  bloom: boolean;
  godRaySamples: number;
  /** kept for backwards compatibility (the composer always works in drawing-buffer pixels) */
  pixelRatio?: number;
  /** post anti-aliasing (only meaningful when msaa is 0) */
  aa?: 'fxaa' | 'none';
  /** contrast-adaptive sharpening 0..1 (0 = off) */
  sharpen?: number;
  /** chromatic aberration + film grain (desktop) */
  filmFx?: boolean;
  /** first bloom mip resolution relative to the render resolution */
  bloomScale?: number;
  bloomMips?: number;
  /** colour buffer type; defaults to HalfFloat (falls back to UnsignedByte if float targets aren't renderable) */
  colorType?: THREE.TextureDataType;
  /** shared grade uniforms (see createGradeUniforms) */
  gradeUniforms?: Record<string, THREE.IUniform>;
}

export class PostFX {
  readonly composer: EffectComposer;
  readonly atmosphere: AtmospherePass;
  readonly bloom: BloomPass | null;
  /** grading stage; `grade.uniforms` = { uRed, uDesat, uFade, uVignette, uSaturation, uContrast, uWarm, uGrain, uCA, uTime } */
  readonly grade: FinishPass;
  readonly resolve: ResolvePass;
  private renderTarget: THREE.WebGLRenderTarget;
  private width = 1;
  private height = 1;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, skyCube: THREE.CubeTexture, q: PostQuality) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const type = q.colorType ?? THREE.HalfFloatType;
    this.renderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      type,
      samples: q.msaa,
      depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.FloatType),
    });
    this.renderTarget.texture.name = 'PostFX.rt1';
    this.renderTarget.depthTexture!.format = THREE.DepthFormat;
    this.composer = new EffectComposer(renderer, this.renderTarget);
    // RenderTarget.clone() shares the depth texture's image source; give the 2nd buffer its own
    // depth texture so the atmosphere pass never samples the depth it is writing (feedback loop).
    // (three re-sizes both depth textures together with their targets in setupDepthTexture.)
    const dt2 = new THREE.DepthTexture(size.x, size.y, THREE.FloatType);
    dt2.format = THREE.DepthFormat;
    this.composer.renderTarget2.depthTexture = dt2;
    this.composer.renderTarget2.texture.name = 'PostFX.rt2';
    this.composer.setPixelRatio(1);
    this.composer.addPass(new RenderPass(scene, camera));
    this.atmosphere = new AtmospherePass(camera, skyCube, q.godRaySamples);
    this.composer.addPass(this.atmosphere);
    if (q.bloom) {
      this.bloom = new BloomPass({
        strength: 0.6, radius: 0.85, threshold: 0.8, knee: 0.5,
        mips: q.bloomMips ?? 5, scale: q.bloomScale ?? 0.5, type,
      });
      this.composer.addPass(this.bloom);
    } else this.bloom = null;
    const grade = q.gradeUniforms ?? createGradeUniforms();
    const film = q.filmFx ?? true;
    this.grade = new FinishPass(grade, film);
    this.composer.addPass(this.grade);
    this.resolve = new ResolvePass({ fxaa: q.msaa === 0 && (q.aa ?? 'fxaa') === 'fxaa', sharpen: q.sharpen ?? 0, grain: film }, grade);
    this.composer.addPass(this.resolve);
    this.setSize(size.x, size.y);
  }

  /** Size in drawing-buffer pixels. */
  setSize(w: number, h: number) {
    w = Math.max(1, Math.floor(w));
    h = Math.max(1, Math.floor(h));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.composer.setSize(w, h);
    this.resolve.setSize(w, h);
  }

  setGodRaySamples(n: number) {
    this.atmosphere.setGodRaySamples(n);
  }

  setBloomEnabled(on: boolean) {
    if (this.bloom) this.bloom.enabled = on;
  }

  render(dt: number) {
    this.grade.uniforms.uTime.value += dt;
    this.composer.render(dt);
  }

  dispose() {
    for (const p of this.composer.passes) (p as Pass & { dispose?: () => void }).dispose?.();
    this.composer.renderTarget1.depthTexture?.dispose();
    this.composer.renderTarget2.depthTexture?.dispose();
    this.composer.dispose();
  }
}
