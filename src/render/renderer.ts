import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { QUALITY, QualityName, QualityPreset } from '../config';

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

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
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
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uFocus, uDamage, uFlash, uAlert, uSat, uFlashCa, uFlashGlow;
    uniform vec2 uRes;
    uniform vec3 uTint;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
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
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

export class Renderer {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  renderPass: RenderPass;
  bloom: UnrealBloomPass;
  grade: ShaderPass;
  /** Edge smoothing where the preset has no MSAA (phones): stairs, railings and leaves don't crawl. */
  fxaa: ShaderPass;
  preset: QualityPreset;
  quality: QualityName;
  width = 1;
  height = 1;

  constructor(private canvas: HTMLCanvasElement, quality: QualityName, public scene: THREE.Scene, public camera: THREE.PerspectiveCamera) {
    this.quality = quality;
    this.preset = QUALITY[quality];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.localClippingEnabled = false;

    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.preset.antialias ? 4 : 0 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), ...DEFAULT_LOOK.bloom);
    this.composer.addPass(this.bloom);
    // safety net: bloom blurs its input across the whole screen, so a single
    // NaN/Inf pixel from any shader would black out every pixel. Scrub it here.
    const hp = this.bloom.materialHighPassFilter;
    const texel = 'vec4 texel = texture2D( tDiffuse, vUv );';
    if (hp.fragmentShader.includes(texel)) {
      hp.uniforms.uBloomClamp = { value: DEFAULT_LOOK.bloomClamp };
      hp.fragmentShader = hp.fragmentShader.replace(texel, `${texel}\n\t\t\tif ( any( isnan( texel ) ) || any( isinf( texel ) ) ) texel = vec4( 0.0 );\n\t\t\ttexel.rgb = min( texel.rgb, vec3( uBloomClamp ) );`);
      hp.fragmentShader = 'uniform float uBloomClamp;\n' + hp.fragmentShader;
      hp.needsUpdate = true;
    } else console.warn('bloom NaN guard not installed');
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    // (after the output pass: FXAA reads display colours, not HDR)
    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaa);
    this.applyQuality(quality);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  applyQuality(q: QualityName) {
    this.quality = q;
    this.preset = QUALITY[q];
    const dpr = Math.min(window.devicePixelRatio || 1, this.preset.pixelRatio);
    this.renderer.setPixelRatio(dpr);
    this.composer.setPixelRatio(dpr);
    this.bloom.enabled = this.preset.bloom;
    this.fxaa.enabled = !this.preset.antialias;
    (this.composer.renderTarget1 as any).samples = this.preset.antialias ? 4 : 0;
    (this.composer.renderTarget2 as any).samples = this.preset.antialias ? 4 : 0;
    this.composer.renderTarget1.dispose();
    this.composer.renderTarget2.dispose();
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    const dpr = this.renderer.getPixelRatio();
    this.bloom.resolution.set(w * dpr * this.preset.bloomScale, h * dpr * this.preset.bloomScale);
    this.bloom.setSize(w * dpr * this.preset.bloomScale, h * dpr * this.preset.bloomScale);
    this.grade.uniforms.uRes.value.set(w * dpr, h * dpr);
    this.fxaa.uniforms.resolution.value.set(1 / Math.max(1, w * dpr), 1 / Math.max(1, h * dpr));
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

  render(dt: number) {
    this.grade.uniforms.uTime.value += dt;
    this.composer.render(dt);
  }
}
