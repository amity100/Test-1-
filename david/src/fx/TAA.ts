import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { FS_VERT, GLSL_SANITIZE, GLSL_VIEWZ, HDR_CLAMP } from './glsl';
import { haltonJitter, temporal } from './Temporal';

/**
 * Temporal anti-aliasing (HDR, before bloom / depth of field / tone mapping).
 *
 *  - Sub-pixel projection jitter: Halton(2,3), 8 positions, applied to the camera's projection matrix only
 *    while the scene itself is drawn (`jitter()` / `unjitter()` around the scene render). Every screen-space
 *    pass after it (atmosphere, DoF, UI) sees the unjittered camera.
 *  - Reprojection: the history pixel is found from the depth buffer with the previous frame's UNJITTERED
 *    view-projection (camera motion; the nearest depth of the neighbourhood is used so foreground silhouettes
 *    reproject with the foreground). There are no per-object motion vectors: moving characters / animals are
 *    handled by the neighbourhood clip below.
 *  - The current frame is reconstructed at the pixel centre from the neighbourhood with jitter-aware Gaussian
 *    weights (Blackman-Harris fit, Karis 2014), so pixels without usable history (moving figures, disocclusions)
 *    are still anti-aliased instead of showing the raw jittered sample; CAS in the resolve restores crispness.
 *  - Neighbourhood variance clipping in YCoCg (Salvi 2016, intersected with the min/max box), clipping the history
 *    toward the box centre (Playdead INSIDE) — limits ghosting behind moving figures without the flicker of a
 *    hard clamp. All of it in a tone-mapped space c / (1 + max(c)) (Karis 2014), so HDR highlights neither
 *    dominate the statistics nor flicker.
 *  - Dual history candidate: besides the camera reprojection, the screen-static history (prevUv = uv) is tested;
 *    it wins where it fits the current neighbourhood clearly better — things the camera follows (the player in
 *    third person) keep accumulating although there are no per-object motion vectors (`uniforms.uDual` = 0: off).
 *  - Depth disocclusion test: the history's alpha stores the nearest linear depth around each pixel; a history
 *    sample whose depth doesn't match the depth the point had from the previous camera (-10 % / +15 %) is
 *    another surface (the trail behind a walking animal, a limb moving in front) and is not used.
 *  - Feedback 0.88..0.96 by luminance difference (lower where history disagrees), lowered further with screen
 *    speed (less reprojection blur while the camera pans). Off-screen / behind-camera history -> current frame.
 *  - History sampling: 5-tap bicubic Catmull-Rom (bilinear re-sampling would blur more with every moving frame).
 *    'hq' (desktop) reads a 3x3 neighbourhood (colour + depth), 'lq' (phones) a 5-tap cross: 16 texture reads
 *    per pixel instead of 24.
 *  - Robustness: input and output are NaN/Inf-scrubbed and clamped (a NaN in the history would otherwise live
 *    forever). `reset()` (camera cuts, scene switches, resizes, context restore) makes the next frame start
 *    from the current image; a camera jump of > 6 m or > 35 deg in one frame is treated as a cut automatically.
 */
export type TAAQuality = 'hq' | 'lq';

const TAA_FRAG = /* glsl */ `
  uniform sampler2D tCurrent;
  uniform sampler2D tHistory;
  uniform sampler2D tDepth;
  uniform mat4 uReproject;
  uniform vec2 uTexel;
  uniform vec2 uSize;
  uniform float uReset;
  uniform float uFeedbackMin, uFeedbackMax, uGamma, uDual;
  uniform vec2 uJitterPx;
  uniform float uNear, uFar;
  varying vec2 vUv;
  ${GLSL_SANITIZE}
  ${GLSL_VIEWZ}
  float linZ(float d){ return min(-pfxViewZ(d, uNear, uFar), 60000.0); }
  vec3 tm(vec3 c){ return c / (1.0 + max(max(c.r, c.g), c.b)); }
  vec3 itm(vec3 c){ return c / max(1.0 - max(max(c.r, c.g), c.b), 1.0 / 512.0); }
  vec3 toYCoCg(vec3 c){ return vec3(0.25 * c.r + 0.5 * c.g + 0.25 * c.b, 0.5 * c.r - 0.5 * c.b, -0.25 * c.r + 0.5 * c.g - 0.25 * c.b); }
  vec3 fromYCoCg(vec3 c){ return vec3(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z); }
  vec3 fetch(vec2 uv){ return toYCoCg(tm(pfxSanitize(texture2D(tCurrent, uv).rgb, HDR_MAX))); }
  // history: rgb = resolved HDR colour, a = linear depth (m) of the nearest surface around that pixel
  vec4 hist(vec2 uv){ vec4 h = texture2D(tHistory, uv); return vec4(pfxSanitize(h.rgb, HDR_MAX), clamp(h.a, 0.0, 60000.0)); }

  #ifdef TAA_BICUBIC
  // 5-tap bicubic Catmull-Rom (bilinear-optimised; Jimenez, "Filmic SMAA", 2016)
  vec4 sampleHistory(vec2 uv){
    vec2 sp = uv * uSize;
    vec2 t1 = floor(sp - 0.5) + 0.5;
    vec2 f = sp - t1;
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
    vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
    vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
    vec2 w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2;
    vec2 t0 = (t1 - 1.0) * uTexel;
    vec2 t3 = (t1 + 2.0) * uTexel;
    vec2 t12 = (t1 + w2 / w12) * uTexel;
    float a = w12.x * w0.y, b = w0.x * w12.y, c = w12.x * w12.y, d = w3.x * w12.y, e = w12.x * w3.y;
    vec4 r = hist(vec2(t12.x, t0.y)) * a + hist(vec2(t0.x, t12.y)) * b + hist(t12) * c
           + hist(vec2(t3.x, t12.y)) * d + hist(vec2(t12.x, t3.y)) * e;
    return max(r / (a + b + c + d + e), vec4(0.0));
  }
  #else
  vec4 sampleHistory(vec2 uv){ return hist(uv); }
  #endif

  // clip p toward the centre of the box (Playdead)
  vec3 clipBox(vec3 bmin, vec3 bmax, vec3 p){
    vec3 c = 0.5 * (bmax + bmin);
    vec3 e = 0.5 * (bmax - bmin) + 1e-5;
    vec3 v = p - c;
    vec3 a = abs(v / e);
    float m = max(a.x, max(a.y, a.z));
    return m > 1.0 ? c + v / m : p;
  }

  // weight of a current-frame sample at integer offset o for the (unjittered) pixel centre: the sample shows the
  // scene point at o + jitter; Gaussian fit of a 3.3-px Blackman-Harris window (Karis 2014)
  float wgt(vec2 o){ vec2 d = o + uJitterPx; return exp(-2.29 * dot(d, d)); }

  void main(){
    vec3 cur = fetch(vUv);
    if (uReset > 0.5) { gl_FragColor = vec4(pfxSanitize(itm(fromYCoCg(cur)), HDR_MAX), linZ(texture2D(tDepth, vUv).x)); return; }
    vec3 m1 = cur, m2 = cur * cur, mn = cur, mx = cur;
    float w0 = wgt(vec2(0.0));
    vec3 cf = cur * w0;
    float wsum = w0;
    float dMin = texture2D(tDepth, vUv).x;
    vec2 dOff = vec2(0.0);
    #ifdef TAA_HQ
      const float N = 9.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        if (x == 0 && y == 0) continue;
        vec2 oi = vec2(float(x), float(y));
        vec2 o = oi * uTexel;
        vec3 s = fetch(vUv + o);
        m1 += s; m2 += s * s; mn = min(mn, s); mx = max(mx, s);
        float wi = wgt(oi); cf += s * wi; wsum += wi;
        float d = texture2D(tDepth, vUv + o).x;
        if (d < dMin) { dMin = d; dOff = o; }
      }
    #else
      const float N = 5.0;
      for (int i = 0; i < 4; i++) {
        vec2 oi = i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
        vec2 o = oi * uTexel;
        vec3 s = fetch(vUv + o);
        m1 += s; m2 += s * s; mn = min(mn, s); mx = max(mx, s);
        float wi = wgt(oi); cf += s * wi; wsum += wi;
        float d = texture2D(tDepth, vUv + o).x;
        if (d < dMin) { dMin = d; dOff = o; }
      }
    #endif
    // current frame reconstructed at the pixel centre (anti-aliased even where there is no usable history:
    // moving characters and animals, disocclusions)
    cf /= wsum;
    // reproject (camera motion) with the nearest depth of the neighbourhood
    float zNear = linZ(dMin);
    vec4 ndc = vec4((vUv + dOff) * 2.0 - 1.0, dMin * 2.0 - 1.0, 1.0);
    vec4 pc = uReproject * ndc;
    vec2 prevUv = (pc.w > 1e-6 ? pc.xy / pc.w : vec2(-9.0)) * 0.5 + 0.5 - dOff;
    bool camOk = pc.w > 1e-6 && all(greaterThanEqual(prevUv, vec2(0.0))) && all(lessThanEqual(prevUv, vec2(1.0)));
    vec3 mu = m1 / N;
    vec3 sigma = sqrt(max(m2 / N - mu * mu, vec3(0.0)));
    vec3 isig = 1.0 / (sigma + vec3(0.004, 0.002, 0.002));
    vec4 hc4 = vec4(0.0);
    if (camOk) {
      // depth test (disocclusion): the history stores the nearest depth around each pixel; pc.w is the depth
      // this point had from the previous camera. A clearly nearer history = something moved away (the trail
      // behind a walking animal), clearly farther = something moved in: that history belongs to another surface.
      hc4 = sampleHistory(prevUv);
      // depth of the nearest history texel (no filtering: a blend of two depths would be a third surface)
      float hz = texelFetch(tHistory, ivec2(clamp(prevUv * uSize, vec2(0.0), uSize - 1.0)), 0).a;
      float ratio = hz / max(pc.w, 1e-4);
      camOk = ratio > 0.9 && ratio < 1.15;
    }
    // two history candidates: camera reprojection (static world) and screen-static (what the camera follows: the
    // player character in third person, which has no motion vectors). Camera reprojection wins unless the
    // screen-static history is the same surface (depth), sits inside the variance box and fits clearly better.
    vec4 hs4 = hist(vUv);
    float rs = hs4.a / max(zNear, 1e-4);
    bool statOk = uDual > 0.5 && rs > 0.93 && rs < 1.08;
    vec3 hs = toYCoCg(tm(hs4.rgb));
    float ds = length((hs - mu) * isig);
    vec3 h;
    float speed = 0.0;
    if (camOk) {
      vec3 hc = toYCoCg(tm(hc4.rgb));
      float dc = length((hc - mu) * isig);
      bool useS = statOk && ds < 1.0 && ds * 2.0 < dc;
      h = useS ? hs : hc;
      speed = useS ? 0.0 : length((vUv - prevUv) * uSize);
    } else if (statOk && ds < 1.0) {
      h = hs;
    } else {
      gl_FragColor = vec4(pfxSanitize(itm(fromYCoCg(cf)), HDR_MAX), zNear);
      return;
    }
    // variance clip (intersected with the min/max box)
    vec3 bmin = max(mn, mu - uGamma * sigma);
    vec3 bmax = min(mx, mu + uGamma * sigma);
    vec3 hRaw = h;
    h = clipBox(bmin, bmax, h);
    // feedback: trust the history less where it disagrees with the current frame, where it had to be clipped
    // hard (stale: something moved), and while the camera moves fast
    float diff = abs(cf.x - h.x) / max(cf.x, max(h.x, 0.2));
    float w = 1.0 - diff;
    float fb = mix(uFeedbackMin, uFeedbackMax, w * w);
    fb *= 1.0 - 0.3 * smoothstep(0.3, 2.0, length((hRaw - h) * isig));
    fb = mix(fb, uFeedbackMin, smoothstep(2.0, 24.0, speed) * 0.6);
    vec3 res = mix(cf, h, fb);
    gl_FragColor = vec4(pfxSanitize(itm(fromYCoCg(res)), HDR_MAX), zNear);
  }`;

export class TAAPass {
  readonly quality: TAAQuality;
  readonly uniforms: {
    tCurrent: THREE.IUniform<THREE.Texture | null>;
    tHistory: THREE.IUniform<THREE.Texture | null>;
    tDepth: THREE.IUniform<THREE.Texture | null>;
    uReproject: THREE.IUniform<THREE.Matrix4>;
    uTexel: THREE.IUniform<THREE.Vector2>;
    uSize: THREE.IUniform<THREE.Vector2>;
    uReset: THREE.IUniform<number>;
    uFeedbackMin: THREE.IUniform<number>;
    uFeedbackMax: THREE.IUniform<number>;
    uGamma: THREE.IUniform<number>;
    uDual: THREE.IUniform<number>;
    uJitterPx: THREE.IUniform<THREE.Vector2>;
    uNear: THREE.IUniform<number>;
    uFar: THREE.IUniform<number>;
  };
  /** frames accumulated since the last reset (0 = the next frame starts a new history) */
  accumulated = 0;
  /** automatic cut detection thresholds (camera jump within one frame) */
  cutDistance = 6;
  cutAngleDeg = 35;
  private readonly material: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;
  private readonly hist: THREE.WebGLRenderTarget[];
  private cur = 0;
  private valid = false;
  private frame = 0;
  private width = 1;
  private height = 1;
  private readonly seq = haltonJitter(8);
  private readonly savedProj = new THREE.Matrix4();
  private readonly savedProjInv = new THREE.Matrix4();
  private readonly curVP = new THREE.Matrix4();
  private readonly prevVP = new THREE.Matrix4();
  private readonly prevPos = new THREE.Vector3();
  private readonly prevDir = new THREE.Vector3();
  private readonly tmpPos = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  private jittered = false;

  constructor(opts: { quality: TAAQuality; type: THREE.TextureDataType }) {
    this.quality = opts.quality;
    this.uniforms = {
      tCurrent: { value: null },
      tHistory: { value: null },
      tDepth: { value: null },
      uReproject: { value: new THREE.Matrix4() },
      uTexel: { value: new THREE.Vector2(1, 1) },
      uSize: { value: new THREE.Vector2(1, 1) },
      uReset: { value: 1 },
      uFeedbackMin: { value: opts.quality === 'hq' ? 0.88 : 0.86 },
      uFeedbackMax: { value: opts.quality === 'hq' ? 0.96 : 0.94 },
      uGamma: { value: 1.15 },
      uDual: { value: 1 },
      uJitterPx: { value: new THREE.Vector2() },
      uNear: { value: 0.1 },
      uFar: { value: 1000 },
    };
    // bicubic history on both tiers: bilinear re-sampling blurs a little more every frame the camera moves
    const defines: Record<string, string> = { HDR_MAX: HDR_CLAMP.toFixed(1), TAA_BICUBIC: '' };
    if (opts.quality === 'hq') defines.TAA_HQ = '';
    this.material = new THREE.ShaderMaterial({
      name: 'TAA',
      uniforms: this.uniforms,
      defines,
      vertexShader: FS_VERT,
      fragmentShader: TAA_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.material.toneMapped = false;
    this.quad = new FullScreenQuad(this.material);
    this.hist = [0, 1].map((i) => {
      const rt = new THREE.WebGLRenderTarget(1, 1, {
        type: opts.type, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
      });
      rt.texture.name = 'TAA.history' + i;
      return rt;
    });
  }

  /** Size in drawing-buffer pixels (reallocates the history: the next frame starts fresh). */
  setSize(w: number, h: number) {
    w = Math.max(1, Math.floor(w));
    h = Math.max(1, Math.floor(h));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    for (const rt of this.hist) rt.setSize(w, h);
    this.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.uniforms.uSize.value.set(w, h);
    this.reset();
  }

  /** Forget the history (camera cut, scene switch): the next frame shows the current image only. */
  reset() {
    this.valid = false;
    this.accumulated = 0;
  }

  /** Current jitter (pixels) of the frame being rendered. */
  get jitterPx(): readonly [number, number] {
    return this.seq[this.frame % this.seq.length];
  }

  /**
   * Call right before the scene render: stores the unjittered view-projection (for the reprojection), detects
   * camera cuts and offsets the camera's projection by this frame's sub-pixel jitter.
   */
  jitter(camera: THREE.PerspectiveCamera) {
    camera.updateMatrixWorld();
    this.curVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const pos = this.tmpPos.setFromMatrixPosition(camera.matrixWorld);
    const dir = this.tmpDir.set(0, 0, -1).transformDirection(camera.matrixWorld);
    if (this.valid) {
      const jump = pos.distanceTo(this.prevPos) > this.cutDistance;
      const turn = dir.dot(this.prevDir) < Math.cos(THREE.MathUtils.degToRad(this.cutAngleDeg));
      if (jump || turn) this.reset();
    }
    this.prevPos.copy(pos);
    this.prevDir.copy(dir);
    const [jx, jy] = this.jitterPx;
    this.savedProj.copy(camera.projectionMatrix);
    this.savedProjInv.copy(camera.projectionMatrixInverse);
    const e = camera.projectionMatrix.elements;
    e[8] += (jx * 2) / this.width;
    e[9] += (jy * 2) / this.height;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    this.jittered = true;
    this.uniforms.uNear.value = camera.near;
    this.uniforms.uFar.value = camera.far;
    temporal.uJitter.value.set(jx, jy);
  }

  /** Call right after the scene render: restores the unjittered projection. */
  unjitter(camera: THREE.PerspectiveCamera) {
    if (!this.jittered) return;
    camera.projectionMatrix.copy(this.savedProj);
    camera.projectionMatrixInverse.copy(this.savedProjInv);
    this.jittered = false;
  }

  /** Resolve this frame into the history; returns the anti-aliased HDR image (valid until the next render). */
  render(renderer: THREE.WebGLRenderer, current: THREE.Texture, depth: THREE.Texture): THREE.Texture {
    const u = this.uniforms;
    const prev = this.hist[this.cur], next = this.hist[1 - this.cur];
    u.tCurrent.value = current;
    u.tDepth.value = depth;
    u.tHistory.value = prev.texture;
    u.uReproject.value.copy(this.curVP).invert().premultiply(this.prevVP);
    u.uReset.value = this.valid ? 0 : 1;
    const [jx, jy] = this.jitterPx;
    u.uJitterPx.value.set(jx, jy);
    renderer.setRenderTarget(next);
    this.quad.render(renderer);
    this.cur = 1 - this.cur;
    this.valid = true;
    this.accumulated++;
    this.prevVP.copy(this.curVP);
    this.frame = (this.frame + 1) % 64;
    return next.texture;
  }

  /** frame index of the jitter / dither sequence (0..63) */
  get frameIndex() {
    return this.frame;
  }

  /** GPU bytes of the history targets */
  get bytes() {
    const bpp = this.hist[0].texture.type === THREE.UnsignedByteType ? 4 : 8;
    return this.width * this.height * bpp * 2;
  }

  dispose() {
    for (const rt of this.hist) rt.dispose();
    this.material.dispose();
    this.quad.dispose();
  }
}
