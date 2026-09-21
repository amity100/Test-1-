// Post-processing chain: bloom → grade (vignette, damage, architect tint, grain) → output → SMAA.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.55 },
    uAberration: { value: 0 },
    uDamage: { value: 0 },
    uArchitect: { value: 0 },
    uFlash: { value: 0 },
    uLowHealth: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uAberration, uDamage, uArchitect, uFlash, uLowHealth;
    uniform vec2 uResolution;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);
      float ab = uAberration + uDamage * 0.01 + uArchitect * 0.004;
      vec3 col;
      if (ab > 0.0001) {
        vec2 off = c * ab * (1.0 + r2 * 4.0);
        col.r = texture2D(tDiffuse, uv + off).r;
        col.g = texture2D(tDiffuse, uv).g;
        col.b = texture2D(tDiffuse, uv - off).b;
      } else {
        col = texture2D(tDiffuse, uv).rgb;
      }
      // architect view: cool desaturated blueprint tint + faint scanlines
      if (uArchitect > 0.001) {
        float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
        vec3 tinted = mix(col, vec3(lum) * vec3(0.72, 0.88, 1.15), 0.55);
        float scan = 0.96 + 0.04 * sin(uv.y * uResolution.y * 1.8);
        col = mix(col, tinted * scan, uArchitect);
      }
      // damage: red pulse from the edges
      float edge = smoothstep(0.12, 0.5, r2);
      col = mix(col, vec3(0.7, 0.03, 0.02) * (0.5 + col), uDamage * edge * 0.9);
      col = mix(col, vec3(0.45, 0.02, 0.02) * (0.4 + col), uLowHealth * edge * (0.55 + 0.25 * sin(uTime * 6.0)));
      // vignette (lifted on the map, which also gets a brightness boost so the site reads from above)
      float vig = 1.0 - smoothstep(0.25, 1.15, r2 * 2.2) * uVignette * (1.0 - 0.6 * uArchitect);
      col *= vig * (1.0 + 0.45 * uArchitect);
      // grain (subtle, in linear space)
      float g = hash(uv * uResolution.xy * 0.5 + fract(uTime) * 100.0) - 0.5;
      col += g * 0.012 * (1.0 + uArchitect);
      // flash (explosion / lightning)
      col += uFlash * vec3(1.0, 0.98, 0.9);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// One-pass FXAA (the classic 5-tap luma edge blend): cheap enough for phones, kills most of the stair-stepping.
const FXAAShader = {
  uniforms: { tDiffuse: { value: null }, uInvRes: { value: new THREE.Vector2(1 / 1280, 1 / 720) } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uInvRes; varying vec2 vUv;
    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    void main() {
      vec3 rgbM = texture2D(tDiffuse, vUv).rgb;
      vec3 rgbNW = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * uInvRes).rgb;
      vec3 rgbNE = texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * uInvRes).rgb;
      vec3 rgbSW = texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * uInvRes).rgb;
      vec3 rgbSE = texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * uInvRes).rgb;
      float lM = luma(rgbM), lNW = luma(rgbNW), lNE = luma(rgbNE), lSW = luma(rgbSW), lSE = luma(rgbSE);
      float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
      float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
      float dirReduce = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
      float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
      dir = clamp(dir * rcpDirMin, vec2(-8.0), vec2(8.0)) * uInvRes;
      vec3 rgbA = 0.5 * (texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
      vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tDiffuse, vUv + dir * -0.5).rgb + texture2D(tDiffuse, vUv + dir * 0.5).rgb);
      float lB = luma(rgbB);
      gl_FragColor = vec4((lB < lMin || lB > lMax) ? rgbA : rgbB, 1.0);
    }`,
};

export class PostFX {
  constructor(renderer, scene, camera, cfg, { mobile = false } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.cfg = cfg;
    this.enabled = true;
    this.mobile = mobile;
    const size = renderer.getSize(new THREE.Vector2());
    // EffectComposer and UnrealBloomPass render into half-float targets by default. Some drivers
    // (older integrated GPUs, several mobile GPUs) cannot render to a float buffer: the framebuffer
    // comes back incomplete and every pass draws nothing, i.e. a black screen. Fall back to 8-bit.
    this.floatTargets = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    const pr = renderer.getPixelRatio();
    const target = new THREE.WebGLRenderTarget(Math.max(1, size.x * pr), Math.max(1, size.y * pr), {
      type: this.floatTargets ? THREE.HalfFloatType : THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat,
    });
    target.texture.name = 'PostFX.rt';
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), cfg.bloomStrength, cfg.bloomRadius, cfg.bloomThreshold);
    // phones: the bloom blurs run at half size (a quarter of the pixels; the glow is soft anyway)
    if (mobile) { const bs = this.bloom.setSize.bind(this.bloom); this.bloom.setSize = (w, h) => bs(Math.max(2, Math.round(w * 0.5)), Math.max(2, Math.round(h * 0.5))); }
    this.grade = new ShaderPass(GradeShader);
    this.output = new OutputPass();
    this.smaa = new SMAAPass(size.x * renderer.getPixelRatio(), size.y * renderer.getPixelRatio());
    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(this.output);
    this.composer.addPass(this.smaa);
    this.composer.addPass(this.fxaa);
    this.state = { damage: 0, aberration: 0, architect: 0, flash: 0, lowHealth: 0 };
    this.setSize(size.x, size.y);
  }

  setCamera(camera) { this.camera = camera; this.renderPass.camera = camera; }
  setSize(w, h) {
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.smaa.setSize(w * pr, h * pr);
    this.grade.uniforms.uResolution.value.set(w * pr, h * pr);
    this.fxaa.uniforms.uInvRes.value.set(1 / Math.max(1, w * pr), 1 / Math.max(1, h * pr));
  }
  setQuality(q) {
    // bloom needs float targets to look right and to work at all on some drivers
    this.bloom.enabled = q !== 'low' && this.floatTargets;
    // anti-aliasing: SMAA (three passes) on desktops, one FXAA pass on phones
    this.smaa.enabled = q !== 'low' && !this.mobile;
    this.fxaa.enabled = q !== 'low' && this.mobile;
    this.bloom.strength = q === 'ultra' ? this.cfg.bloomStrength * 1.15 : this.cfg.bloomStrength;
    this.quality = q;
  }

  update(dt, time) {
    const s = this.state;
    s.damage = Math.max(0, s.damage - dt * 1.6);
    s.flash = Math.max(0, s.flash - dt * 4);
    s.aberration = Math.max(0, s.aberration - dt * 0.08);
    const u = this.grade.uniforms;
    u.uTime.value = time; u.uDamage.value = s.damage; u.uFlash.value = s.flash; u.uAberration.value = s.aberration;
    u.uArchitect.value = s.architect; u.uLowHealth.value = s.lowHealth;
  }

  render() {
    if (this.enabled) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }
}
