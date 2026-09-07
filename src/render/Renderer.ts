import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  SMAAEffect,
  SMAAPreset,
  EdgeDetectionMode,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
  GodRaysEffect,
  KernelSize,
  ChromaticAberrationEffect,
  HueSaturationEffect,
  BrightnessContrastEffect,
  type Effect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import type { Quality } from '../core/Settings';
import { HeightFogEffect } from './HeightFogEffect';
import { GradeEffect } from './GradeEffect';
import type { SkySystem } from './Sky';

export interface QualityProfile {
  pixelRatio: number;
  ao: boolean;
  aoMode: 'Performance' | 'Low' | 'Medium' | 'High' | 'Ultra';
  aoHalfRes: boolean;
  shadowMap: number;
  shadowRadius: number;
  godRays: boolean;
  chromatic: boolean;
  grade: boolean;
  softShadows: boolean;
  grass: number;
  trees: number;
  anisotropy: number;
}

export const QUALITY_PROFILES: Record<Quality, QualityProfile> = {
  low: { pixelRatio: 1, ao: false, aoMode: 'Performance', aoHalfRes: true, shadowMap: 1024, shadowRadius: 70, godRays: false, chromatic: false, grade: false, softShadows: false, grass: 6000, trees: 90, anisotropy: 2 },
  medium: { pixelRatio: 1.25, ao: true, aoMode: 'Low', aoHalfRes: true, shadowMap: 2048, shadowRadius: 80, godRays: false, chromatic: false, grade: true, softShadows: true, grass: 16000, trees: 140, anisotropy: 4 },
  high: { pixelRatio: 1.5, ao: true, aoMode: 'Medium', aoHalfRes: false, shadowMap: 4096, shadowRadius: 90, godRays: true, chromatic: false, grade: true, softShadows: true, grass: 32000, trees: 180, anisotropy: 8 },
  ultra: { pixelRatio: 2, ao: true, aoMode: 'High', aoHalfRes: false, shadowMap: 4096, shadowRadius: 95, godRays: true, chromatic: true, grade: true, softShadows: true, grass: 50000, trees: 220, anisotropy: 16 },
};

/** WebGL renderer + post-processing chain with quality tiers. */
export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly composer: EffectComposer;
  quality: Quality = 'high';
  profile: QualityProfile = QUALITY_PROFILES.high;
  fog: HeightFogEffect;
  bloom: BloomEffect;
  vignette: VignetteEffect;
  n8ao: N8AOPostPass | null = null;
  godRays: GodRaysEffect | null = null;
  private passes: { dispose(): void }[] = [];
  private sky: SkySystem | null = null;
  gpuName = 'unknown';
  readonly flags = new Set<string>();
  /** Skip screen-space passes known to misbehave on some phone GPUs (set from Settings.mobileSafe). */
  mobileSafe = false;
  /** Frame buffers use half floats when the GPU can render to them, 8-bit otherwise. */
  readonly halfFloatBuffers: boolean;
  readonly shaderErrors: string[] = [];
  private degradePending = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      alpha: false,
      preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x0b1220, 1);
    try {
      const gl = this.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) this.gpuName = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
    } catch {
      /* ignore */
    }
    try {
      const q = new URLSearchParams(window.location.search);
      for (const f of (q.get('debug') ?? '').split(',')) if (f) this.flags.add(f);
    } catch {
      /* ignore */
    }
    // Rendering into half-float targets needs a colour-buffer-float extension; without it (older phone
    // GPUs) the whole post chain would come out black or scrambled, so fall back to 8-bit buffers.
    const gl = this.renderer.getContext();
    const floatOk = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    this.halfFloatBuffers = floatOk && !this.flags.has('byte');
    // A shader that fails to compile on this GPU would leave its pass rendering garbage: drop the
    // fragile passes instead (AO first, then the whole post chain), see render().
    this.renderer.debug.onShaderError = (ctx, program, vs, fs) => {
      const log = [ctx.getProgramInfoLog(program), ctx.getShaderInfoLog(vs), ctx.getShaderInfoLog(fs)].filter(Boolean).join(' | ');
      this.shaderErrors.push(log.slice(0, 300));
      console.error('[flagkeep] shader failed on this GPU, simplifying rendering:', log);
      this.degradePending = true;
    };
    this.camera = new THREE.PerspectiveCamera(80, 1, 0.08, 4000);
    this.composer = new EffectComposer(this.renderer, { frameBufferType: this.halfFloatBuffers ? THREE.HalfFloatType : THREE.UnsignedByteType, multisampling: 0 });
    this.fog = new HeightFogEffect(this.camera);
    this.bloom = new BloomEffect({ intensity: 0.55, luminanceThreshold: 0.92, luminanceSmoothing: 0.2, mipmapBlur: true, radius: 0.7 });
    this.vignette = new VignetteEffect({ offset: 0.28, darkness: 0.55 });
  }

  attachSky(sky: SkySystem): void {
    this.sky = sky;
    this.rebuildPasses();
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.profile = QUALITY_PROFILES[q];
    this.rebuildPasses();
    this.resize();
  }

  private rebuildPasses(): void {
    const { composer, scene, camera, profile } = this;
    composer.removeAllPasses();
    for (const p of this.passes) p.dispose();
    this.passes = [];
    this.n8ao = null;
    this.godRays = null;

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    this.passes.push(renderPass);

    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    // Screen-space AO stays off on phone GPUs unless a tier was picked by hand: the voxel meshes carry
    // baked vertex occlusion, and the half-resolution depth path has shown artefacts on some drivers.
    if (profile.ao && !this.flags.has('noao') && !this.mobileSafe) {
      const ao = new N8AOPostPass(scene, camera, Math.max(2, size.x), Math.max(2, size.y));
      ao.configuration.aoRadius = 2.2;
      ao.configuration.distanceFalloff = 0.9;
      ao.configuration.intensity = 3.0;
      ao.configuration.gammaCorrection = false;
      ao.configuration.screenSpaceRadius = false;
      ao.setQualityMode(profile.aoMode);
      ao.configuration.halfRes = profile.aoHalfRes;
      // The transparency-aware mode re-renders every transparent object twice and walks the whole
      // scene three times per frame; with our water and glass the result is indistinguishable.
      ao.configuration.transparencyAware = false;
      composer.addPass(ao);
      this.passes.push(ao);
      this.n8ao = ao;
    }

    const effects: Effect[] = [];
    if (profile.godRays && this.sky && !this.flags.has('nogod')) {
      const gr = new GodRaysEffect(camera, this.sky.sunDisc, {
        height: 360,
        kernelSize: KernelSize.SMALL,
        density: 0.94,
        decay: 0.9,
        weight: 0.28,
        exposure: 0.42,
        samples: 48,
        clampMax: 1.0,
      });
      this.godRays = gr;
      effects.push(gr);
    }
    if (!this.flags.has('nofog')) effects.push(this.fog);
    if (!this.flags.has('nobloom')) effects.push(this.bloom);
    effects.push(new HueSaturationEffect({ saturation: 0.14 }));
    effects.push(new BrightnessContrastEffect({ brightness: -0.015, contrast: 0.1 }));
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
    if (profile.chromatic) {
      effects.push(new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0008, 0.0008), radialModulation: true, modulationOffset: 0.35 }));
    }
    effects.push(this.vignette);
    const mainPass = new EffectPass(camera, ...effects);
    composer.addPass(mainPass);
    this.passes.push(mainPass);

    if (profile.grade && !this.flags.has('nograde')) {
      // Runs after tone mapping so the sharpen kernel sees display-referred colours.
      const grade = new EffectPass(camera, new GradeEffect({ sharpen: profile.pixelRatio >= 1.5 ? 0.5 : 0.35, toneStrength: 0.55, lift: 0.02 }));
      composer.addPass(grade);
      this.passes.push(grade);
    }

    const smaa = new SMAAEffect({ preset: SMAAPreset.HIGH, edgeDetectionMode: EdgeDetectionMode.COLOR });
    const smaaPass = new EffectPass(camera, smaa);
    composer.addPass(smaaPass);
    this.passes.push(smaaPass);
  }

  resize(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const pr = Math.min(window.devicePixelRatio || 1, this.profile.pixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(w, h);
  }

  /** One line per fact for the ?debug=info overlay and bug reports. */
  diagnostics(): string {
    const gl = this.renderer.getContext();
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const ext = (n: string) => (gl.getExtension(n) ? 'yes' : 'no');
    return [
      `gpu: ${this.gpuName}`,
      `tier: ${this.quality}${this.mobileSafe ? ' (mobile-safe, no SSAO)' : ''}  ao: ${this.n8ao ? 'on' : 'off'}  post: ${this.flags.has('nopost') ? 'off' : 'on'}`,
      `buffers: ${this.halfFloatBuffers ? 'half float' : '8-bit'}  size: ${size.x}x${size.y}  dpr: ${window.devicePixelRatio}`,
      `ext float: ${ext('EXT_color_buffer_float')}  half: ${ext('EXT_color_buffer_half_float')}  float linear: ${ext('OES_texture_float_linear')}`,
      `max texture: ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}  shader errors: ${this.shaderErrors.length}`,
      ...this.shaderErrors.map((e) => `  ${e}`),
    ].join('\n');
  }

  /** After a shader failure: first without AO, then without the post chain altogether. */
  private degrade(): void {
    this.degradePending = false;
    if (this.n8ao) {
      this.flags.add('noao');
      this.rebuildPasses();
    } else if (!this.flags.has('nopost')) {
      this.flags.add('nopost');
    }
  }

  render(dt: number): void {
    if (this.degradePending) this.degrade();
    if (this.flags.has('nopost')) {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.composer.render(dt);
  }
}
