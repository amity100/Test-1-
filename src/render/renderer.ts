import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { IS_TOUCH, QUALITY, QualityName, QualityPreset, renderPixelRatio } from '../config';
import { GpuTimer } from './gputimer';
import { DynRes } from './dynres';
import type { PerfInfo } from '../ui/perfhud';

/**
 * A world's post look: bloom [strength, radius, threshold], saturation, the
 * rift pass flash [colour split, glow], and the brightest a pixel may feed
 * the bloom (sun glitter on water and brass: fireflies that would veil the frame).
 */
export interface Look {
  bloom: [number, number, number];
  saturation: number;
  flash?: [number, number];
  bloomClamp?: number;
}
/** The harbour's post look (what setLook() goes back to). */
export const DEFAULT_LOOK: Look = { bloom: [0.55, 0.55, 0.92], saturation: 1, flash: [0.012, 0.35], bloomClamp: 128 };

/**
 * The world grade: chromatic aberration, rift focus, split tone, saturation,
 * vignette, damage and alarm edges, the rift pass flash, film grain. `SRC(p)`
 * is the HDR frame at p (the scene with its bloom added). Kept verbatim from
 * the grade pass it replaced (tests/render/postShader.test.ts holds it to that).
 */
export const GRADE_GLSL = /* glsl */ `
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);
      // chromatic aberration: subtle at edges, strong during rift passes
      float ca = 0.0012 + uFlash * uFlashCa + uFocus * 0.0015;
      vec3 col;
      col.r = SRC(uv + c * ca * 2.0).r;
      col.g = SRC(uv).g;
      col.b = SRC(uv - c * ca * 2.0).b;
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

/**
 * The one full-resolution post pass: the scene plus its bloom (what the bloom
 * pass used to blend into the scene target), the world grade, then exposure,
 * ACES filmic tone mapping and sRGB (three's OutputPass maths). With MSAA it
 * writes straight to the canvas; without, to an 8-bit target FXAA reads.
 */
const FINAL_VERT = /* glsl */ `
  #define attribute in
  #define varying out
  precision highp float;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  attribute vec3 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export const FINAL_FRAG = /* glsl */ `
  #define varying in
  #define texture2D texture
  #define gl_FragColor pc_fragColor
  layout(location = 0) out highp vec4 pc_fragColor;
  precision highp float;
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform float uTime, uFocus, uDamage, uFlash, uAlert, uSat, uFlashCa, uFlashGlow;
  uniform vec2 uRes;
  uniform vec3 uTint;
  // dynamic resolution: the scene fills [0, uScale] of its target (uDyn 0: all of it)
  uniform float uDyn;
  uniform vec2 uScale, uLo, uHi;
  #include <tonemapping_pars_fragment>
  #include <colorspace_pars_fragment>
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec4 SRC(vec2 p) {
    vec2 sp = uDyn > 0.5 ? clamp(p * uScale, uLo, uHi) : p;
    return texture2D(tScene, sp) + texture2D(tBloom, p);
  }
  void main() {
${GRADE_GLSL}
    gl_FragColor = vec4(max(col, 0.0), 1.0);
    gl_FragColor.rgb = ACESFilmicToneMapping(gl_FragColor.rgb);
    gl_FragColor = sRGBTransferOETF(gl_FragColor);
  }
`;

/**
 * UnrealBloomPass without its last step: the bright pass (with the NaN / clamp
 * guard), the five blurred mips and their composite are exactly as before, at
 * a quarter of the resolution per axis; the full-resolution additive blend back
 * into the scene is left to the final pass, which reads `output` directly.
 */
const BLUR_X = new THREE.Vector2(1, 0);
const BLUR_Y = new THREE.Vector2(0, 1);

class BloomPass extends UnrealBloomPass {
  /** Where the scene sits in its target (dynamic resolution): uv scale and the clamp to its texels. */
  readonly uvScale = new THREE.Vector2(1, 1);
  readonly uvLo = new THREE.Vector2(0, 0);
  readonly uvHi = new THREE.Vector2(1, 1);

  get output(): THREE.Texture {
    return this.renderTargetsHorizontal[0].texture;
  }

  render(renderer: THREE.WebGLRenderer, _writeBuffer: THREE.WebGLRenderTarget | null, readBuffer: THREE.WebGLRenderTarget) {
    const self = this as any;
    const quad = self._fsQuad as FullScreenQuad;
    renderer.getClearColor(self._oldClearColor);
    self._oldClearAlpha = renderer.getClearAlpha();
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setClearColor(this.clearColor, 0);

    // 1. bright areas
    const hpu = this.highPassUniforms as Record<string, THREE.IUniform>;
    hpu['tDiffuse'].value = readBuffer.texture;
    hpu['luminosityThreshold'].value = this.threshold;
    quad.material = this.materialHighPassFilter;
    renderer.setRenderTarget(this.renderTargetBright);
    renderer.clear();
    quad.render(renderer);

    // 2. blur the mips progressively
    let input = this.renderTargetBright;
    for (let i = 0; i < this.nMips; i++) {
      const m = this.separableBlurMaterials[i];
      quad.material = m;
      m.uniforms['colorTexture'].value = input.texture;
      m.uniforms['direction'].value = BLUR_X;
      renderer.setRenderTarget(this.renderTargetsHorizontal[i]);
      renderer.clear();
      quad.render(renderer);
      m.uniforms['colorTexture'].value = this.renderTargetsHorizontal[i].texture;
      m.uniforms['direction'].value = BLUR_Y;
      renderer.setRenderTarget(this.renderTargetsVertical[i]);
      renderer.clear();
      quad.render(renderer);
      input = this.renderTargetsVertical[i];
    }

    // 3. composite the mips (into `output`)
    quad.material = this.compositeMaterial;
    this.compositeMaterial.uniforms['bloomStrength'].value = this.strength;
    this.compositeMaterial.uniforms['bloomRadius'].value = this.radius;
    this.compositeMaterial.uniforms['bloomTintColors'].value = this.bloomTintColors;
    renderer.setRenderTarget(this.renderTargetsHorizontal[0]);
    renderer.clear();
    quad.render(renderer);

    renderer.setClearColor(self._oldClearColor, self._oldClearAlpha);
    renderer.autoClear = oldAutoClear;
  }
}

/** One stage of the frame (the benchmark times each by wrapping its render()). */
export interface Stage {
  render(): void;
}

export class Renderer {
  renderer: THREE.WebGLRenderer;
  /** The scene: HDR (half float), 4x MSAA where the preset has it; the only multisampled target. */
  sceneRT: THREE.WebGLRenderTarget;
  bloom: BloomPass;
  /** The final pass's uniforms: the grade's (uFocus, uFlash, uDamage...). */
  grade: { uniforms: Record<string, THREE.IUniform> };
  /** Edge smoothing where the preset has no MSAA: stairs, railings and leaves don't crawl. */
  fxaa: { enabled: boolean; uniforms: Record<string, THREE.IUniform> };
  preset: QualityPreset;
  quality: QualityName;
  width = 1;
  height = 1;
  /** Dynamic-resolution safety net (full resolution unless the device can't keep up). */
  readonly dynres = new DynRes();
  /** GPU ms per frame where the browser has a timer query (perf overlay, dynamic resolution). */
  readonly gpu: GpuTimer;
  /** The GPU's name (WEBGL_debug_renderer_info): shows whether a laptop runs on its integrated GPU. */
  readonly gpuName: string;
  /** MSAA samples the scene target gets with an antialiased preset (0: not supported, FXAA instead). */
  readonly msaaSamples: number;
  /** The frame's stages, in order: scene, bloom, final (grade + tone map + sRGB), fxaa. */
  readonly stages: { scene: Stage; bloom: Stage; final: Stage; fxaa: Stage };

  private finalMat: THREE.RawShaderMaterial;
  private finalQuad: FullScreenQuad;
  private fxaaMat: THREE.ShaderMaterial;
  private fxaaQuad: FullScreenQuad;
  /** 8-bit display-colour target between the final pass and FXAA (no MSAA only). */
  private ldrRT: THREE.WebGLRenderTarget | null = null;
  private black: THREE.DataTexture;
  private samples = 0;
  /** Render size in device pixels (full, before the dynamic scale). */
  private pw = 1;
  private ph = 1;
  private lastCalls = 0;
  private lastTris = 0;
  private lastFrameT = -1;
  private resizeQueued = false;

  constructor(private canvas: HTMLCanvasElement, quality: QualityName, public scene: THREE.Scene, public camera: THREE.PerspectiveCamera) {
    this.quality = quality;
    this.preset = QUALITY[quality];
    // (every frame ends in a full-screen pass: the canvas needs no depth or stencil, and is opaque)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.localClippingEnabled = false;
    // (synchronous shader status reads stall the loader; dev builds keep them)
    this.renderer.debug.checkShaderErrors = !!import.meta.env.DEV;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    this.gpu = new GpuTimer(gl);
    this.gpuName = gpuName(gl);
    this.msaaSamples = msaaSupport(gl);
    // draws / triangles are counted over a whole frame (rift views, shadows and post): beginFrame() resets them
    this.renderer.info.autoReset = false;
    // opaque draws nearest first: a GPU's early depth test then skips shading what nearer surfaces already cover
    this.renderer.setOpaqueSort(frontToBack);

    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false });
    this.sceneRT.texture.name = 'scene';
    // (nothing reads the scene's depth: MSAA resolves colour only)
    (this.sceneRT as any).resolveDepthBuffer = false;

    this.bloom = new BloomPass(new THREE.Vector2(256, 256), ...DEFAULT_LOOK.bloom);
    // safety net: bloom blurs its input across the whole screen, so a single
    // NaN/Inf pixel from any shader would black out every pixel. Scrub it here.
    // (It also reads only the part of the scene target the scene fills: dynamic resolution.)
    const hp = this.bloom.materialHighPassFilter;
    const texel = 'vec4 texel = texture2D( tDiffuse, vUv );';
    if (hp.fragmentShader.includes(texel)) {
      hp.uniforms.uBloomClamp = { value: DEFAULT_LOOK.bloomClamp };
      hp.uniforms.uDyn = { value: 0 };
      hp.uniforms.uScale = { value: this.bloom.uvScale };
      hp.uniforms.uLo = { value: this.bloom.uvLo };
      hp.uniforms.uHi = { value: this.bloom.uvHi };
      hp.fragmentShader = hp.fragmentShader.replace(
        texel,
        `vec4 texel = texture2D( tDiffuse, uDyn > 0.5 ? clamp( vUv * uScale, uLo, uHi ) : vUv );\n\t\t\tif ( any( isnan( texel ) ) || any( isinf( texel ) ) ) texel = vec4( 0.0 );\n\t\t\ttexel.rgb = min( texel.rgb, vec3( uBloomClamp ) );`,
      );
      hp.fragmentShader = 'uniform float uBloomClamp;\nuniform float uDyn;\nuniform vec2 uScale, uLo, uHi;\n' + hp.fragmentShader;
      hp.needsUpdate = true;
    } else console.warn('bloom NaN guard not installed');

    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;
    this.finalMat = new THREE.RawShaderMaterial({
      name: 'FinalPass',
      uniforms: {
        tScene: { value: this.sceneRT.texture },
        tBloom: { value: this.black },
        uTime: { value: 0 },
        uFocus: { value: 0 },
        uDamage: { value: 0 },
        uFlash: { value: 0 },
        uAlert: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTint: { value: new THREE.Color(0x19f0ff) },
        /** World grade: saturation (1 = as rendered). */
        uSat: { value: 1 },
        /** The rift pass flash: its colour split and its glow. */
        uFlashCa: { value: 0.012 },
        uFlashGlow: { value: 0.35 },
        uDyn: { value: 0 },
        uScale: { value: new THREE.Vector2(1, 1) },
        uLo: { value: new THREE.Vector2(0, 0) },
        uHi: { value: new THREE.Vector2(1, 1) },
        toneMappingExposure: { value: 1 },
      },
      vertexShader: FINAL_VERT,
      fragmentShader: FINAL_FRAG,
      glslVersion: THREE.GLSL3,
      depthTest: false,
      depthWrite: false,
    });
    this.finalQuad = new FullScreenQuad(this.finalMat);
    this.grade = { uniforms: this.finalMat.uniforms };

    // FXAA (no-MSAA presets): gentler subpixel blending, so texture detail doesn't smear
    this.fxaaMat = new THREE.ShaderMaterial({
      name: 'FXAA',
      uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms),
      vertexShader: FXAAShader.vertexShader,
      fragmentShader: FXAAShader.fragmentShader.replace('float _SubpixelBlending = 1.0;', 'float _SubpixelBlending = 0.5;'),
      depthTest: false,
      depthWrite: false,
    });
    this.fxaaQuad = new FullScreenQuad(this.fxaaMat);
    this.fxaa = { enabled: false, uniforms: this.fxaaMat.uniforms };

    this.stages = {
      scene: { render: () => this.renderScene() },
      bloom: { render: () => this.bloom.render(this.renderer, null, this.sceneRT) },
      final: { render: () => this.renderFinal() },
      fxaa: { render: () => this.renderFxaa() },
    };

    this.applyQuality(quality);
    window.addEventListener('resize', () => this.queueResize());
    window.visualViewport?.addEventListener('resize', () => this.queueResize());
    this.watchDpr();
  }

  /** Resize events (orientation, the URL bar) come in bursts: one resize per frame at most. */
  private queueResize() {
    if (this.resizeQueued) return;
    this.resizeQueued = true;
    requestAnimationFrame(() => {
      this.resizeQueued = false;
      this.resize();
    });
  }

  /** The device pixel ratio changes (another monitor, browser zoom): re-apply the preset's resolution. */
  private watchDpr() {
    const mm = window.matchMedia?.bind(window);
    if (!mm) return;
    const q = mm(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    const on = () => {
      q.removeEventListener?.('change', on);
      this.applyQuality(this.quality);
      this.watchDpr();
    };
    q.addEventListener?.('change', on);
  }

  applyQuality(q: QualityName) {
    this.quality = q;
    this.preset = QUALITY[q];
    const dpr = renderPixelRatio(this.preset, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(dpr);
    this.bloom.enabled = this.preset.bloom;
    this.samples = this.preset.antialias ? this.msaaSamples : 0;
    this.fxaa.enabled = this.samples === 0;
    if (this.sceneRT.samples !== this.samples) {
      this.sceneRT.samples = this.samples;
      this.sceneRT.dispose();
    }
    if (this.fxaa.enabled && !this.ldrRT) {
      this.ldrRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false });
      this.ldrRT.texture.name = 'display';
      this.fxaaMat.uniforms.tDiffuse.value = this.ldrRT.texture;
    } else if (!this.fxaa.enabled && this.ldrRT) {
      this.ldrRT.dispose();
      this.ldrRT = null;
    }
    this.dynres.reset();
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    const dpr = this.renderer.getPixelRatio();
    const pw = Math.max(1, Math.floor(w * dpr)), ph = Math.max(1, Math.floor(h * dpr));
    this.pw = pw;
    this.ph = ph;
    this.sceneRT.setSize(pw, ph);
    this.ldrRT?.setSize(pw, ph);
    // (sized once: the bloom chain runs at a quarter of the resolution per axis)
    this.bloom.resolution.set(w * dpr * this.preset.bloomScale, h * dpr * this.preset.bloomScale);
    this.bloom.setSize(w * dpr * this.preset.bloomScale, h * dpr * this.preset.bloomScale);
    this.finalMat.uniforms.uRes.value.set(w * dpr, h * dpr);
    this.fxaaMat.uniforms.resolution.value.set(1 / Math.max(1, w * dpr), 1 / Math.max(1, h * dpr));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** A world's post look (defaults: the harbour's). */
  setLook(look: Look = DEFAULT_LOOK) {
    [this.bloom.strength, this.bloom.radius, this.bloom.threshold] = look.bloom;
    this.grade.uniforms.uSat.value = look.saturation;
    [this.grade.uniforms.uFlashCa.value, this.grade.uniforms.uFlashGlow.value] = look.flash ?? DEFAULT_LOOK.flash!;
    const clamp = this.bloom.materialHighPassFilter.uniforms.uBloomClamp;
    if (clamp) clamp.value = look.bloomClamp ?? DEFAULT_LOOK.bloomClamp!;
  }

  /** Full resolution whatever the dynamic scale (a photo, a clip being recorded). */
  forceFull = false;

  /** The dynamic scale the scene renders at this frame (1 = full resolution). */
  get renderScale(): number {
    return this.forceFull ? 1 : this.dynres.current;
  }

  /** Render size of the scene in device pixels this frame (after the dynamic scale). */
  get sceneWidth(): number {
    const s = this.renderScale;
    return s >= 1 ? this.pw : Math.max(1, Math.round(this.pw * s));
  }
  get sceneHeight(): number {
    const s = this.renderScale;
    return s >= 1 ? this.ph : Math.max(1, Math.round(this.ph * s));
  }

  /** Every shader of the post chain compiled now (at load), not at the first frame or a quality change. */
  compilePost() {
    const r = this.renderer;
    const prev = r.getRenderTarget();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const g = new THREE.PlaneGeometry(2, 2);
    // (a pass's program depends on where it draws: a target, or the canvas)
    const pass = (target: THREE.WebGLRenderTarget | null, mats: THREE.Material[]) => {
      const s = new THREE.Scene();
      for (const m of mats) s.add(new THREE.Mesh(g, m));
      r.setRenderTarget(target);
      r.compile(s, cam);
    };
    const b = this.bloom;
    pass(b.renderTargetBright, [b.materialHighPassFilter, b.compositeMaterial, ...b.separableBlurMaterials, this.finalMat]);
    pass(null, [this.fxaaMat, this.finalMat]);
    r.setRenderTarget(prev);
    g.dispose();
  }

  private renderScene() {
    const r = this.renderer;
    this.sceneRT.viewport.set(0, 0, this.sceneWidth, this.sceneHeight);
    r.setRenderTarget(this.sceneRT);
    r.render(this.scene, this.camera);
  }

  private renderFinal() {
    const r = this.renderer;
    const u = this.finalMat.uniforms;
    u.tBloom.value = this.bloom.enabled ? this.bloom.output : this.black;
    u.toneMappingExposure.value = r.toneMappingExposure;
    r.setRenderTarget(this.fxaa.enabled ? this.ldrRT : null);
    this.finalQuad.render(r);
  }

  private renderFxaa() {
    const r = this.renderer;
    r.setRenderTarget(null);
    this.fxaaQuad.render(r);
  }

  /** The part of the scene target the scene covers, for a pass that reads it (uDyn 0: all of it, as always). */
  private placeScene(u: Record<string, THREE.IUniform>) {
    const sw = this.sceneWidth, sh = this.sceneHeight;
    u.uDyn.value = sw < this.pw || sh < this.ph ? 1 : 0;
    u.uScale.value.set(sw / this.pw, sh / this.ph);
    // (clamped to the last texel centre the scene covers: a colour split never reads past it)
    u.uLo.value.set(0.5 / this.pw, 0.5 / this.ph);
    u.uHi.value.set((sw - 0.5) / this.pw, (sh - 0.5) / this.ph);
  }

  /** Scene, bloom, final (grade + tone map + sRGB), FXAA without MSAA. */
  render(dt: number) {
    this.grade.uniforms.uTime.value += dt;
    // where the scene sits in its target this frame (dynamic resolution: the bloom and final passes read that part)
    this.placeScene(this.finalMat.uniforms);
    this.placeScene(this.bloom.materialHighPassFilter.uniforms);
    this.stages.scene.render();
    if (this.bloom.enabled) this.stages.bloom.render();
    this.stages.final.render();
    if (this.fxaa.enabled) this.stages.fxaa.render();
  }

  /** The render targets, for the benchmark and the overlay. */
  targets() {
    return { scene: this.sceneRT, display: this.ldrRT, bloomBright: this.bloom.renderTargetBright, bloomMips: this.bloom.renderTargetsHorizontal };
  }

  /** Start of a frame (the main loop, around game.frame): counters reset, GPU timer started. */
  beginFrame() {
    this.renderer.info.reset();
    this.gpu.begin();
  }

  /** End of a frame: GPU timer stopped, counts kept for the overlay, the dynamic scale updated. */
  endFrame(now: number, cpuMs: number) {
    this.gpu.end();
    this.lastCalls = this.renderer.info.render.calls;
    this.lastTris = this.renderer.info.render.triangles;
    if (this.lastFrameT >= 0) this.dynres.sample(now, now - this.lastFrameT, cpuMs, this.gpu.available ? this.gpu.ms : null);
    this.lastFrameT = now;
  }

  perfInfo(): PerfInfo {
    return {
      width: this.sceneWidth,
      height: this.sceneHeight,
      dpr: this.renderer.getPixelRatio(),
      deviceDpr: window.devicePixelRatio || 1,
      scale: this.renderScale,
      samples: this.samples,
      preset: this.quality + (IS_TOUCH ? ' touch' : ''),
      gpuMs: this.gpu.ms,
      gpuName: this.gpuName,
      calls: this.lastCalls,
      tris: this.lastTris,
    };
  }
}

/** A render-list entry, as far as the opaque sort reads it. */
export interface SortItem {
  groupOrder: number;
  renderOrder: number;
  /** Depth of the object's bounding-sphere centre in clip space (smaller: nearer). */
  z: number;
  material: { id: number };
  id: number;
}

/**
 * Opaque draw order: three's (group, render order first; the picture can't depend on the rest, every opaque
 * surface is depth-tested and coplanar overlays use polygon offset), but nearest first ahead of material.
 * three sorts by material first, so a merged city block far away could shade pixels a nearer one covers
 * later (2.6 fragments per covered pixel in the Halcyon start view; 2.2 front to back, 1.5 in the arena).
 */
export function frontToBack(a: SortItem, b: SortItem): number {
  return a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || a.z - b.z || a.material.id - b.material.id || a.id - b.id;
}

function gpuName(gl: WebGL2RenderingContext): string {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
  } catch {
    return '';
  }
}

/** 4 when the device can multisample a half-float colour target (EXT_color_buffer_float + RGBA16F samples), else 0. */
function msaaSupport(gl: WebGL2RenderingContext): number {
  try {
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return 0;
    const s = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES) as Int32Array | null;
    if (!s) return 4;
    for (const n of s) if (n >= 4) return 4;
    return 0;
  } catch {
    return 4;
  }
}
