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
  grass: number;
  trees: number;
  anisotropy: number;
}

export const QUALITY_PROFILES: Record<Quality, QualityProfile> = {
  low: { pixelRatio: 1, ao: false, aoMode: 'Performance', aoHalfRes: true, shadowMap: 1024, shadowRadius: 70, godRays: false, chromatic: false, grass: 6000, trees: 90, anisotropy: 2 },
  medium: { pixelRatio: 1.25, ao: true, aoMode: 'Low', aoHalfRes: true, shadowMap: 2048, shadowRadius: 80, godRays: false, chromatic: false, grass: 16000, trees: 140, anisotropy: 4 },
  high: { pixelRatio: 1.5, ao: true, aoMode: 'Medium', aoHalfRes: false, shadowMap: 4096, shadowRadius: 90, godRays: true, chromatic: false, grass: 32000, trees: 180, anisotropy: 8 },
  ultra: { pixelRatio: 2, ao: true, aoMode: 'High', aoHalfRes: false, shadowMap: 4096, shadowRadius: 95, godRays: true, chromatic: true, grass: 50000, trees: 220, anisotropy: 16 },
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
    this.camera = new THREE.PerspectiveCamera(80, 1, 0.08, 4000);
    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
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
    if (profile.ao && !this.flags.has('noao')) {
      const ao = new N8AOPostPass(scene, camera, Math.max(2, size.x), Math.max(2, size.y));
      ao.configuration.aoRadius = 2.2;
      ao.configuration.distanceFalloff = 0.9;
      ao.configuration.intensity = 3.0;
      ao.configuration.gammaCorrection = false;
      ao.configuration.screenSpaceRadius = false;
      ao.setQualityMode(profile.aoMode);
      ao.configuration.halfRes = profile.aoHalfRes;
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
    effects.push(new HueSaturationEffect({ saturation: 0.1 }));
    effects.push(new BrightnessContrastEffect({ brightness: -0.02, contrast: 0.08 }));
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
    if (profile.chromatic) {
      effects.push(new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0008, 0.0008), radialModulation: true, modulationOffset: 0.35 }));
    }
    effects.push(this.vignette);
    const mainPass = new EffectPass(camera, ...effects);
    composer.addPass(mainPass);
    this.passes.push(mainPass);

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

  render(dt: number): void {
    if (this.flags.has('nopost')) {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.composer.render(dt);
  }
}
