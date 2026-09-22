// Post-processing: the scene renders into one HDR buffer, a small two-level bloom is built from it, and a single
// full-resolution pass does everything else — bloom add, colour grade, anti-aliasing, tone mapping and sRGB.
//
// Why one pass: every full-screen pass reads and writes the whole framebuffer, which on a phone is pure memory
// bandwidth and the thing that actually costs frames. The old chain ran five of them after the scene (bloom's
// bright pass, grade, output, and SMAA's three), plus ten blur passes inside UnrealBloomPass. This runs one, and
// the bloom blurs happen at a quarter and an eighth of the width.
//
// The scene buffer can also be rendered smaller than the canvas (dynamic resolution): the final pass upsamples it
// while the HUD, which is DOM, stays crisp. That keeps the picture as sharp as the device can afford.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const QUAD_VS = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// bright pass: four taps of the scene, soft-knee threshold, written at quarter size
const BrightShader = {
  uniforms: { tScene: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0.86 }, uKnee: { value: 0.3 } },
  vertexShader: QUAD_VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tScene; uniform vec2 uTexel; uniform float uThreshold, uKnee;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tScene, vUv + vec2(-1.0, -1.0) * uTexel).rgb
             + texture2D(tScene, vUv + vec2( 1.0, -1.0) * uTexel).rgb
             + texture2D(tScene, vUv + vec2(-1.0,  1.0) * uTexel).rgb
             + texture2D(tScene, vUv + vec2( 1.0,  1.0) * uTexel).rgb;
      c *= 0.25;
      float b = max(c.r, max(c.g, c.b));
      float soft = clamp(b - uThreshold + uKnee, 0.0, 2.0 * uKnee);
      soft = soft * soft / (4.0 * uKnee + 0.0001);
      float w = max(soft, b - uThreshold) / max(b, 0.0001);
      gl_FragColor = vec4(c * w, 1.0);
    }
  `,
};

// separable gaussian, nine taps folded into five by linear sampling
const BlurShader = {
  uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
  vertexShader: QUAD_VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tSrc; uniform vec2 uDir;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
      c += texture2D(tSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
      c += texture2D(tSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
      c += texture2D(tSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
      c += texture2D(tSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

// the one full-resolution pass: anti-alias the scene, add bloom, grade, tone map, encode
const FinalShader = {
  uniforms: {
    tScene: { value: null },
    tBloomA: { value: null },
    tBloomB: { value: null },
    uInvRes: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    uResolution: { value: new THREE.Vector2(1280, 720) },
    uBloom: { value: 0.42 },
    uExposure: { value: 1.18 },
    uTime: { value: 0 },
    uVignette: { value: 0.55 },
    uFloor: { value: new THREE.Vector3(0, 0, 0) },
    uAberration: { value: 0 },
    uDamage: { value: 0 },
    uArchitect: { value: 0 },
    uFlash: { value: 0 },
    uLowHealth: { value: 0 },
  },
  vertexShader: QUAD_VS,
  fragmentShader: /* glsl */`
    uniform sampler2D tScene, tBloomA, tBloomB;
    uniform vec2 uInvRes, uResolution;
    uniform float uBloom, uExposure, uTime, uVignette, uAberration, uDamage, uArchitect, uFlash, uLowHealth;
    uniform vec3 uFloor;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    // luma of a cheaply tone-mapped sample: edges are found on what the eye will see, not on raw HDR
    float edgeLuma(vec3 c) { c = c / (1.0 + c); return dot(c, vec3(0.299, 0.587, 0.114)); }

    vec3 sceneAA(vec2 uv) {
      vec3 m = texture2D(tScene, uv).rgb;
      #ifdef USE_FXAA
        vec3 nw = texture2D(tScene, uv + vec2(-1.0, -1.0) * uInvRes).rgb;
        vec3 ne = texture2D(tScene, uv + vec2( 1.0, -1.0) * uInvRes).rgb;
        vec3 sw = texture2D(tScene, uv + vec2(-1.0,  1.0) * uInvRes).rgb;
        vec3 se = texture2D(tScene, uv + vec2( 1.0,  1.0) * uInvRes).rgb;
        float lM = edgeLuma(m), lNW = edgeLuma(nw), lNE = edgeLuma(ne), lSW = edgeLuma(sw), lSE = edgeLuma(se);
        float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
        float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
        if (lMax - lMin < max(0.035, lMax * 0.15)) return m;   // flat enough: leave it alone
        vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
        float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
        float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
        dir = clamp(dir * rcp, vec2(-5.0), vec2(5.0)) * uInvRes;
        vec3 a = 0.5 * (texture2D(tScene, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tScene, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
        vec3 b = a * 0.5 + 0.25 * (texture2D(tScene, uv + dir * -0.5).rgb + texture2D(tScene, uv + dir * 0.5).rgb);
        float lB = edgeLuma(b);
        return (lB < lMin || lB > lMax) ? a : b;
      #else
        return m;
      #endif
    }

    // ACES filmic, the same fit three.js uses, so the picture matches the non-post fallback
    vec3 acesFilmic(vec3 color) {
      const mat3 inMat = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
      const mat3 outMat = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
      color *= uExposure / 0.6;
      color = inMat * color;
      vec3 a = color * (color + 0.0245786) - 0.000090537;
      vec3 b = color * (0.983729 * color + 0.432951) + 0.238081;
      color = outMat * (a / b);
      return clamp(color, 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c) {
      return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
    }

    void main() {
      vec2 uv = vUv;
      vec2 cc = uv - 0.5;
      float r2 = dot(cc, cc);
      vec3 col = sceneAA(uv);
      // chromatic aberration (damage, map): two extra taps, only when it is actually on
      float ab = uAberration + uDamage * 0.01 + uArchitect * 0.004;
      if (ab > 0.0001) {
        vec2 off = cc * ab * (1.0 + r2 * 4.0);
        col.r = texture2D(tScene, uv + off).r;
        col.b = texture2D(tScene, uv - off).b;
      }
      // bloom: a quarter-size and an eighth-size level, both bilinear-upsampled for free
      col += (texture2D(tBloomA, uv).rgb * 0.62 + texture2D(tBloomB, uv).rgb * 0.38) * uBloom;
      // map view: cool blueprint tint and faint scanlines
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
      // vignette (lifted on the map, which also gets a brightness boost)
      float vig = 1.0 - smoothstep(0.25, 1.15, r2 * 2.2) * uVignette * (1.0 - 0.6 * uArchitect);
      col *= vig * (1.0 + 0.45 * uArchitect);
      // A night sky is never pure black and neither is this picture. The floor goes on after the vignette, so the
      // darkest corner still carries a little blue instead of collapsing to zero and reading as a hole cut in the
      // scene, and before the grain, which then dithers across it.
      col = max(col, uFloor);
      // grain, then the flash of an explosion or lightning
      col += (hash(uv * uResolution.xy * 0.5 + fract(uTime) * 100.0) - 0.5) * 0.012 * (1.0 + uArchitect);
      col += uFlash * vec3(1.0, 0.98, 0.9);
      gl_FragColor = vec4(toSRGB(acesFilmic(max(col, 0.0))), 1.0);
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera, cfg, { mobile = false } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.cfg = cfg;
    this.enabled = true;
    this.mobile = mobile;
    this.quality = 'high';
    this.bloomOn = true;
    this.renderScale = 1;          // dynamic resolution: the scene buffer as a fraction of the canvas
    this._targetScale = 1;
    // Some drivers (older integrated GPUs, several mobile GPUs) cannot render to a float buffer: the framebuffer
    // comes back incomplete and every pass draws nothing, i.e. a black screen. Fall back to 8-bit there.
    this.floatTargets = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    this._type = this.floatTargets ? THREE.HalfFloatType : THREE.UnsignedByteType;

    this.bright = new THREE.ShaderMaterial({ ...BrightShader, uniforms: THREE.UniformsUtils.clone(BrightShader.uniforms) });
    this.blur = new THREE.ShaderMaterial({ ...BlurShader, uniforms: THREE.UniformsUtils.clone(BlurShader.uniforms) });
    this.final = new THREE.ShaderMaterial({ ...FinalShader, uniforms: THREE.UniformsUtils.clone(FinalShader.uniforms), defines: { USE_FXAA: '' } });
    this.quad = new FullScreenQuad(this.final);

    this.rtScene = null; this.rtA = null; this.rtB = null; this.rtC = null; this.rtD = null;
    this.state = { damage: 0, aberration: 0, architect: 0, flash: 0, lowHealth: 0 };
    // compatibility shims: the anti-aliasing is inside the final pass now
    this.smaa = { enabled: false };
    this.fxaa = { enabled: true };

    const nf = cfg.nightFloor || [0, 0, 0];
    this.final.uniforms.uFloor.value.set(nf[0], nf[1], nf[2]);

    const size = renderer.getSize(new THREE.Vector2());
    this.setSize(size.x, size.y);
  }

  setCamera(camera) { this.camera = camera; }

  _makeTarget(w, h, depth = false) {
    const t = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
      type: this._type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, depthBuffer: depth, stencilBuffer: false,
    });
    t.texture.generateMipmaps = false;
    return t;
  }

  setSize(w, h) {
    this.cssW = w; this.cssH = h;
    const pr = this.renderer.getPixelRatio();
    this.bufW = Math.max(1, Math.round(w * pr));
    this.bufH = Math.max(1, Math.round(h * pr));
    this.final.uniforms.uResolution.value.set(this.bufW, this.bufH);
    this._allocate();
  }

  // Dynamic resolution: the scene renders at `scale` of the canvas, the final pass upsamples it.
  setRenderScale(scale) {
    // fixed steps: reallocating render targets is the expensive part, so there are five sizes, not a continuum
    const steps = [0.55, 0.65, 0.75, 0.85, 1];
    let s = steps[0];
    for (const v of steps) if (scale >= v - 0.001) s = v;
    if (s === this.renderScale) return false;
    this.renderScale = s;
    this._allocate();
    this._applyAA();
    return true;
  }
  _applyAA() {
    const want = this.quality !== 'low' && this.renderScale > 0.84;
    const has = 'USE_FXAA' in this.final.defines;
    if (want === has) return;
    if (want) this.final.defines.USE_FXAA = ''; else delete this.final.defines.USE_FXAA;
    this.final.needsUpdate = true;
    this.fxaa.enabled = want;
  }

  _allocate(force = false) {
    const sw = Math.max(16, Math.round(this.bufW * this.renderScale));
    const sh = Math.max(16, Math.round(this.bufH * this.renderScale));
    if (!force && this.rtScene && this.rtScene.width === sw && this.rtScene.height === sh) return;
    for (const t of [this.rtScene, this.rtA, this.rtB, this.rtC, this.rtD]) if (t) t.dispose();
    this.sceneW = sw; this.sceneH = sh;
    this.rtScene = this._makeTarget(sw, sh, true);           // the scene needs depth; the bloom buffers do not
    // with bloom off the four small buffers are never read: keep them at one pixel rather than at a quarter screen
    const w4 = this.bloomOn ? Math.max(8, sw >> 2) : 1, h4 = this.bloomOn ? Math.max(8, sh >> 2) : 1;
    const w8 = this.bloomOn ? Math.max(4, sw >> 3) : 1, h8 = this.bloomOn ? Math.max(4, sh >> 3) : 1;
    this.rtA = this._makeTarget(w4, h4);
    this.rtB = this._makeTarget(w4, h4);
    this.rtC = this._makeTarget(w8, h8);
    this.rtD = this._makeTarget(w8, h8);
    this.final.uniforms.uInvRes.value.set(1 / sw, 1 / sh);
    this.bright.uniforms.uTexel.value.set(1 / sw, 1 / sh);
  }

  setQuality(q) {
    const was = this.bloomOn;
    this.quality = q;
    const bloomOn = q !== 'low' && this.floatTargets;
    this.bloomOn = bloomOn;
    if (was !== bloomOn) this._allocate(true);
    this.final.uniforms.uBloom.value = bloomOn ? this.cfg.bloomStrength * (q === 'ultra' ? 1.15 : 1) : 0;
    this.bright.uniforms.uThreshold.value = this.cfg.bloomThreshold;
    this.smaa.enabled = false;
    this._applyAA();
  }

  update(dt, time) {
    const s = this.state;
    s.damage = Math.max(0, s.damage - dt * 1.6);
    s.flash = Math.max(0, s.flash - dt * 4);
    s.aberration = Math.max(0, s.aberration - dt * 0.08);
    const u = this.final.uniforms;
    u.uTime.value = time; u.uDamage.value = s.damage; u.uFlash.value = s.flash; u.uAberration.value = s.aberration;
    u.uArchitect.value = s.architect; u.uLowHealth.value = s.lowHealth;
    u.uExposure.value = this.renderer.toneMappingExposure;
  }

  _pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.quad.render(this.renderer);
  }

  render() {
    const r = this.renderer;
    if (!this.enabled) { r.setRenderTarget(null); r.render(this.scene, this.camera); return; }
    // Nothing here may clear the canvas. Every pass below writes a full-screen quad over its whole target, and the
    // last one covers the canvas completely, so a clear would only blank the framebuffer for the moment between the
    // clear and the draw — which is exactly the window a phone's compositor can read, and exactly how the black
    // rectangles got on screen. (EffectComposer used to do this for us; the fused pass has to do it itself.)
    const autoClear = r.autoClear;
    r.autoClear = false;
    // 1. the scene, into an HDR buffer (tone mapping is not applied when rendering into a target)
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(this.scene, this.camera);
    // 2. bloom: bright pass at a quarter, blurred there and again at an eighth
    if (this.bloomOn) {
      this.bright.uniforms.tScene.value = this.rtScene.texture;
      this._pass(this.bright, this.rtA);
      const u = this.blur.uniforms;
      u.tSrc.value = this.rtA.texture; u.uDir.value.set(1 / this.rtA.width, 0); this._pass(this.blur, this.rtB);
      u.tSrc.value = this.rtB.texture; u.uDir.value.set(0, 1 / this.rtA.height); this._pass(this.blur, this.rtA);
      u.tSrc.value = this.rtA.texture; u.uDir.value.set(2 / this.rtA.width, 0); this._pass(this.blur, this.rtC);
      u.tSrc.value = this.rtC.texture; u.uDir.value.set(0, 2 / this.rtC.height); this._pass(this.blur, this.rtD);
    }
    // 3. one full-resolution pass for everything else
    // the bloom textures stay bound even when bloom is off (uBloom is 0 then), so the shader needs no branch
    const f = this.final.uniforms;
    f.tScene.value = this.rtScene.texture;
    f.tBloomA.value = this.rtA.texture;
    f.tBloomB.value = this.rtD.texture;
    this._pass(this.final, null);
    r.autoClear = autoClear;
  }

  dispose() {
    for (const t of [this.rtScene, this.rtA, this.rtB, this.rtC, this.rtD]) if (t) t.dispose();
    this.quad.dispose(); this.bright.dispose(); this.blur.dispose(); this.final.dispose();
  }
}
