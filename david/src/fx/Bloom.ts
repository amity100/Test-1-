import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * Physically-flavoured bloom (dual filter, "Next Generation Post Processing in Call of Duty: Advanced
 * Warfare", Jimenez 2014): a 13-tap down-sample chain with a Karis-weighted, soft-thresholded first
 * level, then a 3x3 tent up-sample chain accumulated additively, finally added onto the HDR image.
 *
 * Why not UnrealBloomPass: it runs 2 separable blurs (up to 11 taps) per mip plus a 5-texture composite
 * at half resolution, which is several times more expensive on phones, and a single Inf/NaN pixel in
 * its input spreads over a third of the screen (the smallest mip) and turns into NaN in ACES → a big
 * black blotch for a frame. Here the input is clamped + Karis-averaged, so one hot pixel stays harmless.
 *
 * Composite: `compute()` only builds the mip chain; the tone-mapping pass (PostFX FinishPass) samples `texture`
 * (mip 0, tent-filtered) and adds `compositeScale * tint` of it while it reads the HDR image anyway. This saves a
 * full-resolution read-modify-write per frame and keeps the bloom out of the TAA history.
 */
export interface BloomOptions {
  /** fraction of bloom light added to the image */
  strength: number;
  /** how much each coarser mip contributes (0..1): larger = wider glow */
  radius: number;
  /** HDR brightness where bloom starts (scene-referred, before exposure) */
  threshold: number;
  /** soft knee width around the threshold */
  knee: number;
  /** number of mip levels (3..7) */
  mips: number;
  /** resolution of the first mip relative to the render target (0.5 = half, 0.25 = quarter) */
  scale: number;
  /** render target type; HalfFloat unless the device can't render to float targets */
  type: THREE.TextureDataType;
}

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const DOWN_FRAG = /* glsl */ `
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold, uKnee, uClamp, uKaris;
  varying vec2 vUv;
  vec3 T(vec2 o){ return texture2D(tSrc, vUv + o * uTexel).rgb; }
  float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  #ifdef PREFILTER
  vec3 pre(vec3 c){
    c = min(c, vec3(uClamp));
    float br = max(c.r, max(c.g, c.b));
    float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    rq = rq * rq / (4.0 * uKnee + 1e-4);
    return c * (max(rq, br - uThreshold) / max(br, 1e-4));
  }
  vec3 group(vec3 a, vec3 b, vec3 c, vec3 d){
    vec3 g = pre((a + b + c + d) * 0.25);
    return g / (1.0 + luma(g) * uKaris); // (partial) Karis average: tames single-pixel fireflies
  }
  #else
  vec3 group(vec3 a, vec3 b, vec3 c, vec3 d){ return (a + b + c + d) * 0.25; }
  #endif
  void main(){
    vec3 a = T(vec2(-2.0, 2.0)), b = T(vec2(0.0, 2.0)), c = T(vec2(2.0, 2.0));
    vec3 d = T(vec2(-2.0, 0.0)), e = T(vec2(0.0, 0.0)), f = T(vec2(2.0, 0.0));
    vec3 g = T(vec2(-2.0, -2.0)), h = T(vec2(0.0, -2.0)), i = T(vec2(2.0, -2.0));
    vec3 j = T(vec2(-1.0, 1.0)), k = T(vec2(1.0, 1.0)), l = T(vec2(-1.0, -1.0)), m = T(vec2(1.0, -1.0));
    vec3 col = group(j, k, l, m) * 0.5
      + (group(a, b, d, e) + group(b, c, e, f) + group(d, e, g, h) + group(e, f, h, i)) * 0.125;
    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
  }`;

const UP_FRAG = /* glsl */ `
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uWeight;
  varying vec2 vUv;
  vec3 T(vec2 o){ return texture2D(tSrc, vUv + o * uTexel).rgb; }
  void main(){
    vec3 s = T(vec2(0.0)) * 4.0
      + (T(vec2(-1.0, 0.0)) + T(vec2(1.0, 0.0)) + T(vec2(0.0, -1.0)) + T(vec2(0.0, 1.0))) * 2.0
      + T(vec2(-1.0, -1.0)) + T(vec2(1.0, -1.0)) + T(vec2(-1.0, 1.0)) + T(vec2(1.0, 1.0));
    gl_FragColor = vec4(s * (uWeight / 16.0), 1.0);
  }`;

function mat(frag: string, uniforms: Record<string, THREE.IUniform>, defines: Record<string, string> = {}, blending: THREE.Blending = THREE.NoBlending) {
  const m = new THREE.ShaderMaterial({
    uniforms, defines, vertexShader: VERT, fragmentShader: frag,
    depthTest: false, depthWrite: false, blending,
  });
  if (blending === THREE.CustomBlending) {
    m.blendSrc = THREE.OneFactor;
    m.blendDst = THREE.OneFactor;
    m.blendEquation = THREE.AddEquation;
  }
  m.toneMapped = false;
  return m;
}

export class BloomPass {
  /** off = compute() is skipped and the finish pass adds nothing */
  enabled = true;
  strength: number;
  radius: number;
  threshold: number;
  knee: number;
  private mips: THREE.WebGLRenderTarget[] = [];
  private quad = new FullScreenQuad();
  private downPre: THREE.ShaderMaterial;
  private down: THREE.ShaderMaterial;
  private up: THREE.ShaderMaterial;
  private scale: number;

  constructor(opts: BloomOptions) {
    this.strength = opts.strength;
    this.radius = opts.radius;
    this.threshold = opts.threshold;
    this.knee = opts.knee;
    this.scale = opts.scale;
    const n = Math.max(3, Math.min(7, Math.round(opts.mips)));
    for (let i = 0; i < n; i++) {
      const rt = new THREE.WebGLRenderTarget(1, 1, {
        type: opts.type, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
      });
      rt.texture.name = 'Bloom.mip' + i;
      this.mips.push(rt);
    }
    const u = () => ({ tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    const pre = () => ({ uThreshold: { value: 1 }, uKnee: { value: 0.5 }, uClamp: { value: 32 }, uKaris: { value: 0.02 } });
    this.downPre = mat(DOWN_FRAG, { ...u(), ...pre() }, { PREFILTER: '' });
    this.down = mat(DOWN_FRAG, { ...u(), ...pre() });
    this.up = mat(UP_FRAG, { ...u(), uWeight: { value: 1 } }, {}, THREE.CustomBlending);
  }

  setSize(width: number, height: number) {
    let w = Math.max(1, Math.round(width * this.scale));
    let h = Math.max(1, Math.round(height * this.scale));
    for (const rt of this.mips) {
      rt.setSize(w, h);
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
    }
  }

  /** Builds the bloom mip chain from an HDR texture of `width` x `height` pixels (result: `texture`). */
  compute(renderer: THREE.WebGLRenderer, source: THREE.Texture, width: number, height: number) {
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    const n = this.mips.length;
    // 1. down-sample chain (first level: clamp + soft threshold + Karis average)
    let src: THREE.Texture = source;
    let sw = width, sh = height;
    for (let i = 0; i < n; i++) {
      const m = i === 0 ? this.downPre : this.down;
      m.uniforms.tSrc.value = src;
      (m.uniforms.uTexel.value as THREE.Vector2).set(1 / sw, 1 / sh);
      if (i === 0) {
        m.uniforms.uThreshold.value = this.threshold;
        m.uniforms.uKnee.value = Math.max(1e-3, this.knee);
      }
      this.quad.material = m;
      renderer.setRenderTarget(this.mips[i]);
      this.quad.render(renderer);
      src = this.mips[i].texture;
      sw = this.mips[i].width;
      sh = this.mips[i].height;
    }
    // 2. up-sample chain: mip[i] += radius * tent(mip[i+1])
    this.quad.material = this.up;
    this.up.uniforms.uWeight.value = this.radius;
    for (let i = n - 2; i >= 0; i--) {
      const s = this.mips[i + 1];
      this.up.uniforms.tSrc.value = s.texture;
      (this.up.uniforms.uTexel.value as THREE.Vector2).set(1 / s.width, 1 / s.height);
      renderer.setRenderTarget(this.mips[i]);
      this.quad.render(renderer);
    }
    renderer.autoClear = oldAutoClear;
  }

  /** mip 0 after the up-sample chain (half / quarter resolution) */
  get texture(): THREE.Texture {
    return this.mips[0].texture;
  }

  /** texel size of `texture` (for the tent-filtered composite) */
  get texel(): [number, number] {
    return [1 / this.mips[0].width, 1 / this.mips[0].height];
  }

  /** multiplier for `texture` in the composite: `strength` normalised by the mip weights (independent of mip count / radius) */
  get compositeScale(): number {
    let norm = 0;
    for (let i = 0, w = 1; i < this.mips.length; i++, w *= this.radius) norm += w;
    return this.strength / norm;
  }

  /** GPU bytes of the mip chain */
  get bytes(): number {
    const bpp = this.mips[0].texture.type === THREE.UnsignedByteType ? 4 : 8;
    return this.mips.reduce((a, rt) => a + rt.width * rt.height * bpp, 0);
  }

  dispose() {
    for (const rt of this.mips) rt.dispose();
    this.downPre.dispose();
    this.down.dispose();
    this.up.dispose();
    this.quad.dispose();
  }
}
