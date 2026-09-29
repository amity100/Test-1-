import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { shared } from '../core/Shared';
import { BloomPass } from './Bloom';
import { TAAPass, type TAAQuality } from './TAA';
import { DoFPass, defaultDoF, type DoFSettings } from './DoF';
import { temporal, GLSL_IGN } from './Temporal';
import { FS_VERT, GLSL_SANITIZE, HDR_CLAMP } from './glsl';

export { HDR_CLAMP, GLSL_SANITIZE } from './glsl';
export type { DoFSettings } from './DoF';

/**
 * Post chain — one explicit pass sequence (no EffectComposer), every pass a full-screen triangle, no depth test:
 *
 *   scene ─► HDR target (RGBA16F, MSAA 0/2/4, depth texture; camera projection sub-pixel jittered when TAA is on)
 *     ─► Atmosphere  NaN/Inf scrub + HDR clamp, aerial perspective / height fog from depth, god rays
 *     ─► TAA         temporal anti-aliasing (history, reprojection, YCoCg variance clip) .............. TAA tiers
 *     ─► DoF         bokeh depth of field (half-res gather + full-res composite) ...... only while enabled
 *     ─► Bloom       mip chain from the (anti-aliased, focused) HDR image
 *     ─► Finish      bloom + halation composite, white balance, tone map, sRGB, grade, vignette, fade
 *     ─► Resolve     FXAA (non-TAA phones) / contrast-adaptive sharpening, crossfade, film grain (desktop),
 *                    letterbox bars, 1-LSB dither ─► screen
 *
 * PUBLIC API (the Engine owns one PostFX; the intro reaches it as `engine.post`):
 *   new PostFX(renderer, scene, camera, skyCube, q: PostQuality)
 *   .setSize(w, h)                         drawing-buffer pixels (history is reset)
 *   .render(dt)                            dt = real seconds (drives grain, fades, letterbox / film-look easing)
 *   .setView(scene, camera, skyCube?)      render another scene through the SAME targets (no reallocation)
 *   .resetHistory()                        forget the TAA history — call on every camera cut
 *   .setTAAEnabled(on)                     runtime A/B (only when constructed with q.taa)
 *   .setDoF({ enabled, focusDistance, fStop, focalLength, maxBlur, target })   partial updates, animatable per frame
 *                                          (animate focusDistance yourself, or set target to an Object3D / point)
 *   .rackFocus(distance, seconds = 1.5)     eased focus pull from the current focus (log-distance)
 *   .dofAvailable                          false on tiers without DoF (settings are then ignored: always sharp)
 *   .setLetterbox(ratio | null, seconds = 1.2)   animated cinema bars, e.g. 2.39; bars are capped at 10 % of the
 *                                          height each on portrait screens; `.letterboxBars` = current bar height
 *                                          (fraction of the image height per bar) for placing captions
 *   .setFilmLook(amount 0..1, seconds = 1)  cinematic look: amber bloom tint, halation, +contrast / vignette,
 *                                          stronger grain (grain is desktop-only)
 *   .crossfade(seconds, { through?: colour })   dissolve from the LAST RENDERED frame into whatever renders
 *                                          next (call it right before switching view / cutting); with `through`
 *                                          it dips through that colour instead (old -> colour -> new)
 *   .fading                                true while a crossfade runs
 *   .atmosphere.uniforms                   uDensity, uHeightFalloff, uBaseHeight, uGodRays, uHazeTint, tSky ...
 *   .grade.uniforms                        uRed, uDesat, uFade, uVignette, uSaturation, uContrast, uWarm, uGrain,
 *                                          uCA, uTime (shared with Engine; see createGradeUniforms)
 *   .look                                  uWhiteBalance, uShadowTint, uFilm, uBloomTint, uHalation, uFadeColor
 *   .bloom                                 strength / radius / threshold / knee (null on tiers without bloom)
 *   .setGodRaySamples(n), .setBloomEnabled(on), .bytes (GPU memory of all targets), .dispose()
 *   .sceneTarget                           the HDR scene target (bind it to pre-compile materials for this chain)
 *   .contextRestored()                     after a WebGL context restore (Engine calls it)
 *
 * Dithered materials: add `temporal.uDitherOffset` (fx/Temporal.ts) to the pixel coordinate of the dither hash so
 * the pattern changes every frame under TAA and is averaged away (hair strands; see Temporal.ts).
 * DoF strength is physical (thin lens): a 35 mm-equivalent wide shot barely blurs its background; for a portrait
 * look use a longer lens (smaller fov, or `focalLength: 85`), a lower fStop (1.2-2) and maxBlur 0.02-0.03.
 *
 * Mobile safety (kept from the previous chain): the HDR target is RGBA16F; a glancing sun glint on a smooth
 * surface overflows half float (-> Inf -> NaN in ACES); the atmosphere pass scrubs NaN/Inf/negatives and clamps
 * to HDR_CLAMP before any effect, TAA / DoF scrub again (a NaN in the history would live forever). Chromatic
 * aberration and grain are desktop-only. Every target keeps its own depth / no feedback loops.
 */

/**
 * Aerial perspective + height fog + screen-space god rays, computed from the depth buffer.
 * Fog colour is looked up from a captured sky cube so distant ridges dissolve into the horizon.
 */
class AtmospherePass {
  readonly uniforms: Record<string, THREE.IUniform>;
  private quad: FullScreenQuad;
  private material: THREE.ShaderMaterial;
  constructor(public camera: THREE.PerspectiveCamera, skyCube: THREE.Texture, godRaySamples: number) {
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
      uDitherOffset: temporal.uDitherOffset,
    };
    this.material = new THREE.ShaderMaterial({
      name: 'PostFX.atmosphere',
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
        uniform vec2 uSunUV, uDitherOffset;
        varying vec2 vUv;
        ${GLSL_SANITIZE}
        ${GLSL_IGN}
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
          // god rays: march toward the sun in screen space, count sky pixels. The start offset is interleaved
          // gradient noise that changes every frame under TAA (the history averages it into smooth shafts).
          if (uSunOnScreen > 0.001) {
            float n = float(uGodRaySamples);
            vec2 delta = (uSunUV - vUv) / n;
            vec2 uv = vUv;
            float illum = 0.0, decay = 1.0, wsum = 0.0;
            uv += delta * pfxIGN(gl_FragCoord.xy + uDitherOffset);
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

  private readonly sp = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();

  render(renderer: THREE.WebGLRenderer, src: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget | null) {
    const cam = this.camera;
    this.uniforms.tDiffuse.value = src.texture;
    this.uniforms.tDepth.value = src.depthTexture;
    this.uniforms.uProjInv.value.copy(cam.projectionMatrixInverse);
    this.uniforms.uCamWorld.value.copy(cam.matrixWorld);
    this.uniforms.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
    // sun screen position (no per-frame allocations: GC pauses show up as hitches on phones)
    const sp = this.sp.copy(shared.uSunDir.value).multiplyScalar(5000).add(this.uniforms.uCamPos.value);
    sp.project(cam);
    const facing = this.fwd.set(0, 0, -1).applyQuaternion(cam.quaternion).dot(shared.uSunDir.value);
    const finite = Number.isFinite(sp.x) && Number.isFinite(sp.y);
    this.uniforms.uSunUV.value.set(finite ? sp.x * 0.5 + 0.5 : 0.5, finite ? sp.y * 0.5 + 0.5 : 0.5);
    const onScreen = facing > 0 && finite && this.uniforms.uGodRaySamples.value > 0
      ? THREE.MathUtils.smoothstep(facing, 0.0, 0.5) * (1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(sp.x), Math.abs(sp.y)), 1.0, 1.9))
      : 0;
    this.uniforms.uSunOnScreen.value = onScreen;
    renderer.setRenderTarget(dst);
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
    uSaturation: { value: 1.08 },
    uContrast: { value: 1.06 },
    uFade: { value: 0 },
    uDesat: { value: 0 },
    uRed: { value: 0 },
    uCA: { value: 0.0012 },
    uWarm: { value: 0.055 },
  };
}

/**
 * Look uniforms owned by the post chain (kept apart from the grade defaults above, which the environment art
 * direction tunes). Golden-hour defaults after the reference image: warm white balance (amber, not yellow-green)
 * and warm brown shadows instead of the old teal ones; the film look (uFilm) is driven by PostFX.setFilmLook.
 */
export function createLookUniforms() {
  return {
    /** scene-referred white balance multiplier (before the tone curve) */
    // measured against the reference (mean chromaticity per luminance band): the game read yellow-green
    // (mid-tones r 0.44 / g 0.35 / b 0.21), the reference amber (r 0.46 / g 0.33 / b 0.21)
    uWhiteBalance: { value: new THREE.Vector3(1.08, 0.965, 0.93) },
    /** added to the darkest tones (display-referred): warm brown shadows (reference: r 0.55 / g 0.31 / b 0.14) */
    uShadowTint: { value: new THREE.Vector3(0.012, -0.003, -0.006) },
    /** 0..1 cinematic film look (animated by setFilmLook) */
    uFilm: { value: 0 },
    /** bloom colour at full film look (gameplay bloom is neutral) */
    uBloomTint: { value: new THREE.Vector3(1.0, 0.8, 0.58) },
    /** strength of the red-orange halation around highlights at full film look */
    uHalation: { value: 0.35 },
    /** colour that grade.uniforms.uFade fades to (black by default) */
    uFadeColor: { value: new THREE.Color(0, 0, 0) },
  };
}
export type LookUniforms = ReturnType<typeof createLookUniforms>;

/** Bloom + halation composite, white balance, tone mapping, sRGB, film grade, vignette, fade (+ CA on desktop). */
class FinishPass {
  readonly uniforms: Record<string, THREE.IUniform>;
  readonly look: LookUniforms;
  private material: THREE.ShaderMaterial;
  private quad: FullScreenQuad;
  private toneMapping: THREE.ToneMapping = -1 as THREE.ToneMapping;
  constructor(grade: Record<string, THREE.IUniform>, look: LookUniforms, chromatic: boolean, bloom: boolean) {
    // share the caller's uniform objects so references held by gameplay survive a PostFX rebuild
    this.uniforms = grade;
    this.look = look;
    const defines: Record<string, string> = {};
    if (chromatic) defines.USE_CA = '';
    if (bloom) defines.USE_BLOOM = '';
    this.material = new THREE.ShaderMaterial({
      name: 'PostFX.finish',
      uniforms: {
        ...grade, ...look,
        tDiffuse: { value: null }, toneMappingExposure: { value: 1 }, uAspect: { value: 1 },
        tBloom: { value: null }, uBloomTexel: { value: new THREE.Vector2(1, 1) }, uBloomScale: { value: 0 },
      },
      defines,
      depthTest: false,
      depthWrite: false,
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform float uTime, uVignette, uSaturation, uContrast, uFade, uDesat, uRed, uCA, uWarm, uAspect;
        uniform vec3 uWhiteBalance, uShadowTint, uBloomTint, uFadeColor;
        uniform float uFilm, uHalation;
        #ifdef USE_BLOOM
        uniform sampler2D tBloom; uniform vec2 uBloomTexel; uniform float uBloomScale;
        #endif
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
          #ifdef USE_BLOOM
            // tent-filtered up-sample of the bloom (half / quarter resolution)
            vec4 o = uBloomTexel.xyxy * vec4(-0.5, -0.5, 0.5, 0.5);
            vec3 bl = (texture2D(tBloom, vUv + o.xy).rgb + texture2D(tBloom, vUv + o.zy).rgb
                     + texture2D(tBloom, vUv + o.xw).rgb + texture2D(tBloom, vUv + o.zw).rgb) * (0.25 * uBloomScale);
            float peak = max(hdr.r, max(hdr.g, hdr.b));
            hdr += bl * mix(vec3(1.0), uBloomTint, uFilm);
            // halation: film's red-sensitive layer glows AROUND bright highlights (not on them)
            hdr += bl * (uHalation * uFilm) * vec3(1.0, 0.42, 0.16) * (1.0 - smoothstep(1.0, 6.0, peak));
          #endif
          hdr *= uWhiteBalance;
          vec3 col = sRGBTransferOETF(vec4(toneMap(max(hdr, vec3(0.0))), 1.0)).rgb;
          // grade: gentle S-curve, warm highlights / warm-brown shadows (golden-hour film look)
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(l), col, uSaturation * (1.0 - uDesat));
          col = (col - 0.5) * (uContrast + 0.05 * uFilm) + 0.5;
          col += vec3(uWarm, uWarm * 0.35, -uWarm * 0.6) * smoothstep(0.35, 1.0, l);
          col += uShadowTint * (1.0 - smoothstep(0.0, 0.35, l));
          // lens vignette, isotropic in screen space and normalised to the half-diagonal (a UV-space ellipse
          // darkens the short edges of a portrait phone into dark bands): ~0.4x corners, ~0.55x 16:9 side edges
          float r = length(dir * vec2(uAspect, 1.0)) / (0.5 * length(vec2(uAspect, 1.0)));
          float vig = smoothstep(0.3, 1.1, r);
          col *= 1.0 - (0.4 + 1.5 * (uVignette + 0.04 * uFilm)) * vig * vig;
          // damage pulse
          col = mix(col, col * vec3(1.25, 0.45, 0.4), uRed * smoothstep(0.1, 0.6, length(dir)));
          col = mix(col, uFadeColor, clamp(uFade, 0.0, 1.0));
          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }`,
    });
    this.material.toneMapped = false;
    this.quad = new FullScreenQuad(this.material);
  }

  render(renderer: THREE.WebGLRenderer, src: THREE.Texture, srcW: number, srcH: number, bloom: BloomPass | null, dst: THREE.WebGLRenderTarget) {
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
    u.tDiffuse.value = src;
    u.uAspect.value = srcW / Math.max(1, srcH);
    u.toneMappingExposure.value = renderer.toneMapping === THREE.NoToneMapping ? 1 : renderer.toneMappingExposure;
    if (bloom) {
      u.tBloom.value = bloom.texture;
      const [tx, ty] = bloom.texel;
      (u.uBloomTexel.value as THREE.Vector2).set(tx, ty);
      u.uBloomScale.value = bloom.compositeScale;
    } else u.uBloomScale.value = 0;
    renderer.setRenderTarget(dst);
    this.quad.render(renderer);
  }

  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}

/**
 * Final resolve on the display-referred (sRGB) image:
 *  - FXAA 3.11 "quality" (edge search, sub-pixel AA) on tiers without MSAA and without TAA,
 *  - AMD-CAS-style contrast-adaptive sharpening on every non-edge pixel (restores texture crispness lost to
 *    TAA / bilinear up-scaling / FXAA; limited by local contrast so it never rings),
 *  - crossfade with a captured frame / dip through a colour,
 *  - optional film grain (mid-tone weighted), letterbox bars and a 1-LSB dither against banding.
 */
class ResolvePass {
  readonly uniforms: Record<string, THREE.IUniform>;
  private material: THREE.ShaderMaterial;
  private quad: FullScreenQuad;
  constructor(opts: { fxaa: boolean; sharpen: number; grain: boolean }, grade: Record<string, THREE.IUniform>, look: LookUniforms) {
    this.uniforms = {
      tDiffuse: { value: null },
      uRcp: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
      uSharp: { value: opts.sharpen },
      uGrain: grade.uGrain,
      uTime: grade.uTime,
      uFilm: look.uFilm,
      tFade: { value: null },
      uFadeMix: { value: 0 },
      uThroughColor: { value: new THREE.Color(0, 0, 0) },
      uThroughMix: { value: 0 },
      uBars: { value: 0 },
    };
    const defines: Record<string, string> = {};
    if (opts.fxaa) defines.USE_FXAA = '';
    if (opts.grain) defines.USE_GRAIN = '';
    this.material = new THREE.ShaderMaterial({
      name: 'PostFX.resolve',
      uniforms: this.uniforms,
      defines,
      depthTest: false,
      depthWrite: false,
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform vec2 uRcp; uniform float uSharp, uGrain, uTime, uFilm;
        uniform sampler2D tFade; uniform float uFadeMix, uThroughMix, uBars; uniform vec3 uThroughColor;
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
          // crossfade from a captured frame / dip through a colour
          if (uFadeMix > 0.0) col = mix(col, texture2D(tFade, vUv).rgb, uFadeMix);
          col = mix(col, uThroughColor, uThroughMix);
        #ifdef USE_GRAIN
          // film grain, strongest in the mid-tones (as on film), a little stronger in the cinematic film look
          float gl = luma(col);
          col += (hash(gl_FragCoord.xy + fract(uTime) * 517.0) - 0.5) * uGrain * (1.0 + 0.8 * uFilm) * (0.55 + 1.8 * gl * (1.0 - gl));
        #endif
          // triangular dither, 1 LSB of the 8-bit output: removes banding in the sky gradients
          col += (hash(gl_FragCoord.xy * 1.37 + 11.0) + hash(gl_FragCoord.xy * 0.71 + 3.0) - 1.0) / 255.0;
          // letterbox bars (anti-aliased edge)
          if (uBars > 0.0) col *= smoothstep(uBars - uRcp.y, uBars, vUv.y) * smoothstep(uBars - uRcp.y, uBars, 1.0 - vUv.y);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.material.toneMapped = false;
    this.quad = new FullScreenQuad(this.material);
  }

  setSize(w: number, h: number) {
    (this.uniforms.uRcp.value as THREE.Vector2).set(1 / Math.max(1, w), 1 / Math.max(1, h));
  }

  render(renderer: THREE.WebGLRenderer, src: THREE.Texture, dst: THREE.WebGLRenderTarget | null) {
    this.uniforms.tDiffuse.value = src;
    renderer.setRenderTarget(dst);
    this.quad.render(renderer);
  }

  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}

export interface PostQuality {
  /** MSAA samples on the HDR scene target (0 = off) */
  msaa: number;
  bloom: boolean;
  godRaySamples: number;
  /** kept for backwards compatibility (the chain always works in drawing-buffer pixels) */
  pixelRatio?: number;
  /** spatial post anti-aliasing, used when neither MSAA nor TAA is on */
  aa?: 'fxaa' | 'none';
  /** temporal anti-aliasing: true / 'hq' (3x3 neighbourhood, bicubic history), 'lq' (phones), false = off */
  taa?: boolean | TAAQuality;
  /** depth-of-field bokeh kernel size: 0 = no DoF on this tier, 16 / 22 / 43 samples */
  dofSamples?: number;
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
  /** shared look uniforms (see createLookUniforms) */
  lookUniforms?: LookUniforms;
}

const smooth01 = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export class PostFX {
  readonly atmosphere: AtmospherePass;
  readonly bloom: BloomPass | null;
  /** grading stage; `grade.uniforms` = { uRed, uDesat, uFade, uVignette, uSaturation, uContrast, uWarm, uGrain, uCA, uTime } */
  readonly grade: FinishPass;
  readonly resolve: ResolvePass;
  /** temporal anti-aliasing (null on tiers without TAA) */
  readonly taa: TAAPass | null;
  /** depth of field (null on tiers without DoF); settings live in `dofSettings` either way */
  readonly dof: DoFPass | null;
  readonly dofSettings: DoFSettings;
  /** look uniforms: uWhiteBalance, uShadowTint, uFilm, uBloomTint, uHalation, uFadeColor */
  readonly look: LookUniforms;
  /** @deprecated compatibility with the former EffectComposer: renderTarget1 = the HDR scene target */
  readonly composer: { readonly renderTarget1: THREE.WebGLRenderTarget };
  /** the scene / camera this chain renders (see setView) */
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** portrait screens: largest letterbox bar (fraction of the height, per bar) */
  letterboxCapPortrait = 0.1;
  /** landscape screens: largest letterbox bar */
  letterboxCapLandscape = 0.2;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly sceneRT: THREE.WebGLRenderTarget;
  private readonly bufA: THREE.WebGLRenderTarget;
  private readonly bufB: THREE.WebGLRenderTarget;
  /** crossfade captures (double-buffered: a new capture must not write the texture the resolve samples) */
  private readonly fadeRTs: (THREE.WebGLRenderTarget | null)[] = [null, null];
  private fadeIdx = 0;
  private lastLdr: THREE.WebGLRenderTarget | null = null;
  /** B has been rendered to (GPU storage is allocated lazily by three on first use) */
  private usedB = false;
  private taaOn: boolean;
  private width = 1;
  private height = 1;
  private readonly letter = { from: 0, ratio: null as number | null, t: 1, dur: 0, cur: 0 };
  private readonly film = { from: 0, to: 0, t: 1, dur: 0 };
  private readonly fade = { t: 1, dur: 0, through: false, active: false };
  private readonly rack = { from: 1, to: 1, t: 1, dur: 0 };

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, skyCube: THREE.Texture, q: PostQuality) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const type = q.colorType ?? THREE.HalfFloatType;
    const rt = (name: string) => {
      const t = new THREE.WebGLRenderTarget(1, 1, {
        type, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
      });
      t.texture.name = name;
      return t;
    };
    // the scene target is the only one with depth (+ MSAA storage); the atmosphere, TAA and DoF read its depth
    this.sceneRT = new THREE.WebGLRenderTarget(size.x, size.y, {
      type,
      samples: q.msaa,
      depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.FloatType),
    });
    this.sceneRT.texture.name = 'PostFX.scene';
    this.sceneRT.depthTexture!.format = THREE.DepthFormat;
    this.bufA = rt('PostFX.bufA');
    this.bufB = rt('PostFX.bufB');
    this.composer = { renderTarget1: this.sceneRT };
    this.atmosphere = new AtmospherePass(camera, skyCube, q.godRaySamples);
    this.bloom = q.bloom
      ? new BloomPass({ strength: 0.6, radius: 0.85, threshold: 0.8, knee: 0.5, mips: q.bloomMips ?? 5, scale: q.bloomScale ?? 0.5, type })
      : null;
    const taaQ: TAAQuality | null = q.taa === true || q.taa === 'hq' ? 'hq' : q.taa === 'lq' ? 'lq' : null;
    this.taa = taaQ ? new TAAPass({ quality: taaQ, type }) : null;
    this.taaOn = !!this.taa;
    this.dofSettings = defaultDoF();
    this.dof = (q.dofSamples ?? 0) > 0 ? new DoFPass(q.dofSamples!, type, this.dofSettings) : null;
    const grade = q.gradeUniforms ?? createGradeUniforms();
    this.look = q.lookUniforms ?? createLookUniforms();
    const film = q.filmFx ?? true;
    this.grade = new FinishPass(grade, this.look, film, !!this.bloom);
    this.resolve = new ResolvePass({ fxaa: q.msaa === 0 && !this.taa && (q.aa ?? 'fxaa') === 'fxaa', sharpen: q.sharpen ?? 0, grain: film }, grade, this.look);
    this.setSize(size.x, size.y);
  }

  // ------------------------------------------------------------------------------------------ setup

  /** Size in drawing-buffer pixels. */
  setSize(w: number, h: number) {
    w = Math.max(1, Math.floor(w));
    h = Math.max(1, Math.floor(h));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.sceneRT.setSize(w, h);
    this.bufA.setSize(w, h);
    this.bufB.setSize(w, h);
    this.bloom?.setSize(w, h);
    this.taa?.setSize(w, h);
    this.dof?.setSize(w, h);
    this.resolve.setSize(w, h);
    this.lastLdr = null;
    this.endFade();
    for (let i = 0; i < 2; i++) {
      this.fadeRTs[i]?.dispose();
      this.fadeRTs[i] = null;
    }
    this.resolve.uniforms.tFade.value = null;
  }

  /** Current size in drawing-buffer pixels. */
  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /** The HDR scene target (depth texture + MSAA): bind it to pre-compile materials for this chain. */
  get sceneTarget(): THREE.WebGLRenderTarget {
    return this.sceneRT;
  }

  setGodRaySamples(n: number) {
    this.atmosphere.setGodRaySamples(n);
  }

  setBloomEnabled(on: boolean) {
    if (this.bloom) this.bloom.enabled = on;
  }

  // ------------------------------------------------------------------------------------------ views / TAA

  /**
   * Render another scene / camera / sky through this chain (same targets, nothing reallocated). The caller keeps
   * the atmosphere uniforms and renderer exposure in step (Engine.setView does all of it). Resets the TAA history.
   */
  setView(scene: THREE.Scene, camera: THREE.PerspectiveCamera, skyCube?: THREE.Texture | null) {
    this.scene = scene;
    this.camera = camera;
    this.atmosphere.camera = camera;
    if (skyCube) this.atmosphere.uniforms.tSky.value = skyCube;
    this.resetHistory();
  }

  /** Forget the temporal history: call on every camera cut (the next frame starts from the current image). */
  resetHistory() {
    this.taa?.reset();
  }

  /** After a WebGL context restore: every target's contents are gone (history, captured crossfade frame). */
  contextRestored() {
    this.resetHistory();
    this.endFade();
    this.lastLdr = null;
  }

  /** Temporal AA on/off at runtime (A/B, governor). No effect on tiers built without TAA. */
  setTAAEnabled(on: boolean) {
    const want = on && !!this.taa;
    if (want !== this.taaOn) this.taa?.reset();
    this.taaOn = want;
  }

  get taaEnabled() {
    return this.taaOn;
  }

  // ------------------------------------------------------------------------------------------ cinematic controls

  /** true when this tier renders depth of field (else setDoF is accepted but the image stays sharp) */
  get dofAvailable() {
    return !!this.dof;
  }

  /** Partial update of the depth-of-field settings (cheap, allocation-free; animate it per frame for rack focus). */
  setDoF(s: Partial<DoFSettings>) {
    Object.assign(this.dofSettings, s);
  }

  /**
   * Rack focus: pull the focus from where it is now to `distance` (m) over `seconds` of render dt, eased and
   * interpolated in log-distance (how a focus puller's hand moves). Clears `target`. Enable DoF separately.
   */
  rackFocus(distance: number, seconds = 1.5) {
    const R = this.rack;
    R.from = Math.max(0.05, this.dofFocus);
    R.to = Math.max(0.05, distance);
    R.t = 0;
    R.dur = Math.max(0, seconds);
    this.dofSettings.target = null;
    if (R.dur === 0) this.dofSettings.focusDistance = R.to;
  }

  private updateRack(dt: number) {
    const R = this.rack;
    if (R.t >= R.dur) return;
    R.t += dt;
    const k = smooth01(R.t / R.dur);
    this.dofSettings.focusDistance = Math.exp(Math.log(R.from) + (Math.log(R.to) - Math.log(R.from)) * k);
  }

  /** Focus distance used by the last rendered frame (m) — e.g. to start a rack focus from where it is. */
  get dofFocus(): number {
    return this.dofSettings.target && this.dof ? this.dof.lastFocus : this.dofSettings.focusDistance;
  }

  /**
   * Animated letterbox: `ratio` is the image aspect to show (e.g. 2.39 or 2.0), null removes the bars. Bars are
   * computed for the current screen aspect every frame (resizes / rotation stay right) and capped at
   * letterboxCapPortrait (10 %) of the height per bar on portrait screens, letterboxCapLandscape (20 %) otherwise.
   */
  setLetterbox(ratio: number | null, seconds = 1.2) {
    const L = this.letter;
    L.from = L.cur;
    L.ratio = ratio && ratio > 0 ? ratio : null;
    L.t = 0;
    L.dur = Math.max(0, seconds);
    if (L.dur === 0) this.updateLetterbox(0);
  }

  /** current letterbox bar height as a fraction of the image height (per bar; 0 = no bars) */
  get letterboxBars(): number {
    return this.letter.cur;
  }

  /** Cinematic film look 0..1 (amber bloom tint, halation, a touch more contrast / vignette, stronger grain). */
  setFilmLook(amount: number, seconds = 1) {
    const F = this.film;
    F.from = this.look.uFilm.value;
    F.to = Math.min(1, Math.max(0, amount));
    F.t = 0;
    F.dur = Math.max(0, seconds);
    if (F.dur === 0) this.look.uFilm.value = F.to;
  }

  /**
   * Dissolve from the last rendered frame into the frames rendered next (over `seconds` of render dt). Call it
   * right BEFORE switching the view / cutting the camera. `through`: dip through that colour instead
   * (old -> colour in the first half, colour -> new in the second). Returns false when there is no frame yet.
   */
  crossfade(seconds: number, opts: { through?: THREE.ColorRepresentation } = {}): boolean {
    if (!this.lastLdr || seconds <= 0) return false;
    const next = this.fadeIdx ^ 1;
    let target = this.fadeRTs[next];
    if (!target) {
      target = this.fadeRTs[next] = new THREE.WebGLRenderTarget(this.width, this.height, {
        type: THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      });
      target.texture.name = 'PostFX.fade' + next;
    }
    // keep the outgoing frame exactly as it was shown (sharpened, graded, bars and any running dissolve included:
    // the resolve still samples the other capture, so a crossfade started during a crossfade stays continuous)
    const u = this.resolve.uniforms;
    this.resolve.render(this.renderer, this.lastLdr.texture, target);
    this.fadeIdx = next;
    u.tFade.value = target.texture;
    const F = this.fade;
    F.t = 0;
    F.dur = seconds;
    F.through = opts.through !== undefined;
    if (F.through) (u.uThroughColor.value as THREE.Color).set(opts.through!);
    F.active = true;
    this.updateFade(0);
    return true;
  }

  /** true while a crossfade is running */
  get fading() {
    return this.fade.active;
  }

  private endFade() {
    this.fade.active = false;
    this.resolve.uniforms.uFadeMix.value = 0;
    this.resolve.uniforms.uThroughMix.value = 0;
  }

  private updateFade(dt: number) {
    const F = this.fade;
    if (!F.active) return;
    F.t += dt;
    const p = F.t / F.dur;
    const u = this.resolve.uniforms;
    if (p >= 1) {
      this.endFade();
      return;
    }
    if (!F.through) {
      u.uFadeMix.value = 1 - smooth01(p);
      u.uThroughMix.value = 0;
    } else if (p < 0.5) {
      u.uFadeMix.value = 1;
      u.uThroughMix.value = smooth01(p * 2);
    } else {
      u.uFadeMix.value = 0;
      u.uThroughMix.value = 1 - smooth01((p - 0.5) * 2);
    }
  }

  private updateLetterbox(dt: number) {
    const L = this.letter;
    let target = 0;
    if (L.ratio) {
      const aspect = this.width / this.height;
      const cap = aspect < 1 ? this.letterboxCapPortrait : this.letterboxCapLandscape;
      target = Math.min(cap, Math.max(0, (1 - aspect / L.ratio) / 2));
    }
    L.t += dt;
    const k = L.dur > 0 ? smooth01(L.t / L.dur) : 1;
    L.cur = L.from + (target - L.from) * k;
    if (L.cur < 1e-4) L.cur = 0;
    this.resolve.uniforms.uBars.value = L.cur;
  }

  private updateFilm(dt: number) {
    const F = this.film;
    if (F.t >= F.dur) return;
    F.t += dt;
    const k = F.dur > 0 ? smooth01(F.t / F.dur) : 1;
    this.look.uFilm.value = F.from + (F.to - F.from) * k;
  }

  // ------------------------------------------------------------------------------------------ frame

  render(dt: number) {
    const r = this.renderer;
    this.grade.uniforms.uTime.value += dt;
    this.updateFade(dt);
    this.updateLetterbox(dt);
    this.updateFilm(dt);
    this.updateRack(dt);
    const cam = this.camera;
    const taa = this.taaOn ? this.taa : null;
    if (taa) {
      const f = taa.frameIndex;
      temporal.uTaaActive.value = 1;
      temporal.uFrame.value = f;
      temporal.uDitherOffset.value.setScalar(5.588238 * f);
      taa.jitter(cam);
    } else {
      temporal.uTaaActive.value = 0;
      temporal.uFrame.value = 0;
      temporal.uDitherOffset.value.set(0, 0);
      temporal.uJitter.value.set(0, 0);
    }
    // 1. scene -> HDR target (jittered projection only for this draw)
    r.setRenderTarget(this.sceneRT);
    r.render(this.scene, cam);
    if (taa) taa.unjitter(cam);
    const depth = this.sceneRT.depthTexture!;
    // 2. atmosphere (sanitises) -> A
    this.atmosphere.render(r, this.sceneRT, this.bufA);
    let hdr: THREE.Texture = this.bufA.texture;
    // 3. temporal AA -> history
    if (taa) hdr = taa.render(r, hdr, depth);
    // 4. depth of field -> B
    if (this.dof && this.dofSettings.enabled) {
      this.dof.render(r, hdr, depth, cam, this.bufB);
      hdr = this.bufB.texture;
    }
    // 5. bloom mips
    const bloom = this.bloom && this.bloom.enabled ? this.bloom : null;
    if (bloom) bloom.compute(r, hdr, this.width, this.height);
    // 6. finish -> the free buffer
    // finish target: whichever full-res buffer is free. Without TAA / DoF the scene target's colour is free by
    // now (depth is no longer read; MSAA-less tiers only), so B is touched — and allocated — only for DoF.
    const ldr = hdr !== this.bufA.texture ? this.bufA : this.sceneRT.samples === 0 ? this.sceneRT : this.bufB;
    if (ldr === this.bufB || hdr === this.bufB.texture) this.usedB = true;
    this.grade.render(r, hdr, this.width, this.height, bloom, ldr);
    this.lastLdr = ldr;
    // 7. resolve -> screen
    this.resolve.render(r, ldr.texture, null);
  }

  /**
   * Compile / exercise the passes that are not used every frame (depth of field) so their first use in a
   * cinematic doesn't hitch: renders them once into scratch targets. Call after at least one render().
   */
  warmupPasses() {
    if (!this.lastLdr) return;
    const r = this.renderer;
    if (this.dof) {
      this.dof.render(r, this.bufA.texture, this.sceneRT.depthTexture!, this.camera, this.bufB);
      this.usedB = true;
      this.lastLdr = null; // B may have held the last frame
    }
  }

  /** Estimated GPU bytes of every target of the chain (scene colour + MSAA + depth, buffers, history, DoF, bloom). */
  get bytes(): number {
    const px = this.width * this.height;
    const bpp = this.sceneRT.texture.type === THREE.UnsignedByteType ? 4 : 8;
    let b = px * bpp + px * 4; // scene colour + depth texture
    if (this.sceneRT.samples > 0) b += px * this.sceneRT.samples * (bpp + 4);
    b += px * bpp * (this.usedB ? 2 : 1); // A (+ B once depth of field has been used)
    if (this.taa) b += this.taa.bytes;
    if (this.dof && this.dof.used) b += this.dof.bytes;
    if (this.bloom) b += this.bloom.bytes;
    for (const f of this.fadeRTs) if (f) b += px * 4;
    return b;
  }

  dispose() {
    this.atmosphere.dispose();
    this.bloom?.dispose();
    this.taa?.dispose();
    this.dof?.dispose();
    this.grade.dispose();
    this.resolve.dispose();
    this.sceneRT.depthTexture?.dispose();
    this.sceneRT.dispose();
    this.bufA.dispose();
    this.bufB.dispose();
    for (const f of this.fadeRTs) f?.dispose();
  }
}
