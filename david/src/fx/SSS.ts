import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { FS_VERT } from './glsl';

/**
 * Screen-space subsurface scattering for skin (separable SSS, Jimenez et al. 2015 "Separable Subsurface
 * Scattering"), desktop tiers only. Phones keep the pre-integrated / wrap model built into SkinMaterial.
 *
 *   main pass   the scene renders normally; skin materials see `skinShading.uSSSActive = 1` and switch their
 *               diffuse to a sharper, detailed-normal Lambert (the blur below does the scattering)
 *   skin pass   the SAME jittered camera renders only meshes on SKIN_LAYER into an RGBA16F target + depth texture;
 *               skin materials see `uSkinPass = 1` and output their DIFFUSE radiance only (direct + ambient +
 *               transmission), divided by the albedo luminance (post-scatter texturing: freckles and pores keep
 *               their crisp luminance, only the light and the albedo chroma diffuse), albedo luminance in alpha
 *   blur H      separable 1-D kernel (sum of 5 Gaussians fitted to measured skin, per channel: red scatters
 *               ~3x farther than green/blue), width in world millimetres -> pixels from the depth; taps across a
 *               depth step or off the skin fall back to the centre ("follow surface"), so nothing bleeds
 *   blur V      second direction, then the correction  albedoLum * (blurred - sharp)  is ADDED to the HDR image
 *               (additive blend, may be negative) where the skin is visible (skin depth == scene depth: hair,
 *               beards, cloth and props in front are untouched). Specular never enters the blur.
 *
 * Cost (only while a registered skin mesh is on screen and its kernel spans >= ~1.25 px, i.e. closer than ~3 m at 1080p): one extra draw of the
 * skin meshes (no shadow pass), two full-screen passes that early-out off the skin, 20 bytes / pixel of targets
 * (allocated on first use, freed after ~5 s unused). Level 2 (desktop-high) = 17 taps, level 1 = 11 taps.
 *
 * Marking skin: `registerSkinMesh(mesh)` (HumanModel does it for the body); its material must write the skin pass
 * output (SkinMaterial does: it reads `skinShading.uSkinPass`). Other materials on SKIN_LAYER would be blurred
 * with their full lighting, so keep the layer for skin.
 */

/** three.js layer that marks skin meshes for the skin pass (lights get it enabled automatically). */
export const SKIN_LAYER = 13;

/** Shared uniforms read by every SkinMaterial program (values change between the passes of one frame). */
export const skinShading = {
  /** 1 during the main pass of a frame that also runs the screen-space blur (skin uses sharper diffuse) */
  uSSSActive: { value: 0 },
  /** 1 during the skin pass: skin materials output diffuse / albedoLum (rgb) + albedoLum (a) */
  uSkinPass: { value: 0 },
};

const registry = new Set<THREE.Object3D>();

/** Mark a mesh as skin (enables SKIN_LAYER on it). HumanModel registers its body automatically. */
export function registerSkinMesh(m: THREE.Object3D) {
  m.layers.enable(SKIN_LAYER);
  registry.add(m);
}

export function unregisterSkinMesh(m: THREE.Object3D) {
  registry.delete(m);
}

export type SSSLevel = 0 | 1 | 2;

/** Default level for an engine quality (URL override `?sss=0|1|2`): desktop-high 2, desktop-medium 1, phones 0. */
export function sssLevelFor(q: { mobile: boolean; tier: string }): SSSLevel {
  let p: string | null = null;
  try {
    p = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('sss') : null;
  } catch {
    p = null;
  }
  if (p === '0' || p === '1' || p === '2') return Number(p) as SSSLevel;
  if (q.mobile || q.tier.startsWith('mobile')) return 0;
  return q.tier === 'desktop-high' ? 2 : 1;
}

/**
 * Separable skin kernel (Jimenez' SeparableSSS calculateKernel): offsets in millimetres (w), per-channel weights
 * (xyz), centre sample first. falloff = per-channel profile width, strength = scattered fraction per channel.
 */
export function skinKernel(n: number, falloff: [number, number, number], strength: [number, number, number]): THREE.Vector4[] {
  const RANGE = n > 20 ? 3.0 : 2.0;
  const EXP = 2.0;
  const off: number[] = [];
  const step = (2 * RANGE) / (n - 1);
  for (let i = 0; i < n; i++) {
    const o = -RANGE + i * step;
    off.push((RANGE * Math.sign(o) * Math.pow(Math.abs(o), EXP)) / Math.pow(RANGE, EXP));
  }
  const gauss = (v: number, r: number) =>
    [0, 1, 2].map((c) => {
      const rr = r / (0.001 + falloff[c]);
      return Math.exp(-(rr * rr) / (2 * v)) / (2 * Math.PI * v);
    });
  const profile = (r: number) => {
    const out = [0, 0, 0];
    const terms: [number, number][] = [[0.1, 0.0484], [0.118, 0.187], [0.113, 0.567], [0.358, 1.99], [0.078, 7.41]];
    for (const [w, v] of terms) {
      const g = gauss(v, r);
      for (let c = 0; c < 3; c++) out[c] += w * g[c];
    }
    return out;
  };
  const k = off.map((o, i) => {
    const w0 = i > 0 ? Math.abs(o - off[i - 1]) : 0;
    const w1 = i < n - 1 ? Math.abs(o - off[i + 1]) : 0;
    const area = (w0 + w1) / 2;
    const p = profile(o);
    return new THREE.Vector4(area * p[0], area * p[1], area * p[2], o);
  });
  // centre first
  const c = (n - 1) >> 1;
  const centre = k.splice(c, 1)[0];
  k.unshift(centre);
  const sum = [0, 0, 0];
  for (const v of k) {
    sum[0] += v.x;
    sum[1] += v.y;
    sum[2] += v.z;
  }
  for (const v of k) {
    v.x /= sum[0];
    v.y /= sum[1];
    v.z /= sum[2];
  }
  k[0].x = 1 - strength[0] + strength[0] * k[0].x;
  k[0].y = 1 - strength[1] + strength[1] * k[0].y;
  k[0].z = 1 - strength[2] + strength[2] * k[0].z;
  for (let i = 1; i < n; i++) {
    k[i].x *= strength[0];
    k[i].y *= strength[1];
    k[i].z *= strength[2];
  }
  return k;
}

const BLUR_FRAG = /* glsl */ `
  uniform sampler2D tSrc;     // H: skin pass colour; V: result of H
  uniform sampler2D tCentre;  // skin pass colour (V: the sharp diffuse to replace)
  uniform sampler2D tSkinDepth;
  uniform sampler2D tSceneDepth;
  uniform vec4 uKernel[ N ];
  uniform vec2 uDir;          // one texel along the blur direction
  uniform float uPxK;         // 0.5 * height * projection[1][1]: pixels per metre at 1 m
  uniform float uWidth;       // metres per kernel millimetre (1e-3 * artistic scale)
  uniform float uFollow;      // 1 / depth step (m) at which a tap falls back to the centre
  uniform float uStrength;
  uniform float uNear, uFar;
  varying vec2 vUv;
  float linZ( float d ) { return uNear * uFar / ( uFar - d * ( uFar - uNear ) ); }
  void main() {
    vec4 c = texture2D( tSrc, vUv );
    #ifdef COMPOSITE
    vec4 c0 = texture2D( tCentre, vUv );
    if ( c0.a <= 0.0 ) discard;
    #else
    if ( c.a <= 0.0 ) { gl_FragColor = vec4( 0.0 ); return; }
    #endif
    float z = linZ( texture2D( tSkinDepth, vUv ).x );
    float px = uPxK / max( z, 1e-3 ) * uWidth; // pixels per kernel millimetre
    vec3 acc = c.rgb * uKernel[ 0 ].rgb;
    for ( int i = 1; i < N; i++ ) {
      vec2 uv = vUv + uDir * ( uKernel[ i ].w * px );
      vec4 s = texture2D( tSrc, uv );
      float zs = linZ( texture2D( tSkinDepth, uv ).x );
      float f = s.a > 0.0 ? clamp( abs( zs - z ) * uFollow, 0.0, 1.0 ) : 1.0;
      acc += mix( s.rgb, c.rgb, f ) * uKernel[ i ].rgb;
    }
    #ifdef COMPOSITE
    // visible skin only: the skin pass ignores hair / cloth / props in front, the scene depth does not
    float zScene = linZ( texture2D( tSceneDepth, vUv ).x );
    float cov = 1.0 - smoothstep( 0.002 + 0.002 * z, 0.008 + 0.004 * z, abs( zScene - z ) );
    vec3 delta = ( acc - c0.rgb ) * c0.a * cov * uStrength;
    // NaN guard (a NaN would live forever in the TAA history)
    if ( any( notEqual( delta, delta ) ) ) delta = vec3( 0.0 );
    gl_FragColor = vec4( delta, 0.0 );
    #else
    gl_FragColor = vec4( acc, c.a );
    #endif
  }`;

export interface SSSSettings {
  /** artistic scale of the diffusion width (1 = measured skin profile in millimetres) */
  width: number;
  /** 0..1 mix of the effect */
  strength: number;
  /** depth step (m) over which a tap stops contributing (follow surface) */
  follow: number;
}

export class SSSPass {
  enabled = true;
  readonly settings: SSSSettings = { width: 1.6, strength: 1, follow: 0.006 };
  readonly taps: number;
  private readonly skinRT: THREE.WebGLRenderTarget;
  private readonly blurRT: THREE.WebGLRenderTarget;
  private readonly hMat: THREE.ShaderMaterial;
  private readonly vMat: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;
  private width = 1;
  private height = 1;
  private allocated = false;
  private idle = 0;
  private active = false;
  private lightScene: THREE.Scene | null = null;
  private lightAge = 0;
  private readonly tmpColor = new THREE.Color();
  private readonly v = new THREE.Vector3();

  constructor(level: 1 | 2, type: THREE.TextureDataType = THREE.HalfFloatType) {
    this.taps = level >= 2 ? 17 : 11;
    const mk = (name: string, depth: boolean) => {
      const t = new THREE.WebGLRenderTarget(1, 1, {
        type, format: THREE.RGBAFormat, depthBuffer: depth, stencilBuffer: false,
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false,
        depthTexture: depth ? new THREE.DepthTexture(1, 1, THREE.FloatType) : undefined,
      });
      if (t.depthTexture) t.depthTexture.format = THREE.DepthFormat;
      t.texture.name = name;
      return t;
    };
    this.skinRT = mk('SSS.skin', true);
    this.blurRT = mk('SSS.blur', false);
    // measured-skin profile: red scatters farthest (Jimenez' falloff / strength defaults, slightly warmer)
    const kernel = skinKernel(this.taps, [1.0, 0.37, 0.3], [0.58, 0.45, 0.32]);
    const uniforms = () => ({
      tSrc: { value: null as THREE.Texture | null },
      tCentre: { value: null as THREE.Texture | null },
      tSkinDepth: { value: null as THREE.Texture | null },
      tSceneDepth: { value: null as THREE.Texture | null },
      uKernel: { value: kernel },
      uDir: { value: new THREE.Vector2() },
      uPxK: { value: 1 },
      uWidth: { value: 0.001 },
      uFollow: { value: 1 / 0.006 },
      uStrength: { value: 1 },
      uNear: { value: 0.1 },
      uFar: { value: 1000 },
    });
    this.hMat = new THREE.ShaderMaterial({
      name: 'SSS.blurH', uniforms: uniforms(), defines: { N: this.taps },
      vertexShader: FS_VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false,
    });
    this.vMat = new THREE.ShaderMaterial({
      name: 'SSS.blurV', uniforms: uniforms(), defines: { N: this.taps, COMPOSITE: '' },
      vertexShader: FS_VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false,
      transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    });
    this.quad = new FullScreenQuad(this.hMat);
  }

  setSize(w: number, h: number) {
    this.width = Math.max(1, Math.floor(w));
    this.height = Math.max(1, Math.floor(h));
    if (this.allocated) {
      this.skinRT.setSize(this.width, this.height);
      this.blurRT.setSize(this.width, this.height);
    }
  }

  /** GPU bytes while allocated (colour 8 + depth 4 + blur 8 per pixel). */
  get bytes(): number {
    return this.allocated ? this.width * this.height * 20 : 0;
  }

  /** true when this frame runs the blur (set by prepare) */
  get isActive(): boolean {
    return this.active;
  }

  /**
   * Before the main scene render: decides whether any registered skin mesh of `scene` is visible and big enough
   * on screen, and sets `skinShading.uSSSActive` for the main pass accordingly.
   */
  prepare(scene: THREE.Scene, camera: THREE.PerspectiveCamera): boolean {
    this.active = false;
    skinShading.uSSSActive.value = 0;
    if (!this.enabled || this.settings.strength <= 0 || registry.size === 0) return this.idleTick();
    const pxK = 0.5 * this.height * camera.projectionMatrix.elements[5];
    const maxKernelMm = this.taps > 20 ? 3 : 2;
    let best = 0;
    camera.getWorldPosition(this.v);
    const cx = this.v.x, cy = this.v.y, cz = this.v.z;
    for (const m of registry) {
      if (!attachedVisible(m, scene)) continue;
      m.getWorldPosition(this.v);
      // the body origin is at the feet: measure to the nearest point of a ~1 m radius around the pelvis
      const d = Math.max(0.15, Math.hypot(this.v.x - cx, this.v.y + 1.0 - cy, this.v.z - cz) - 1.0);
      best = Math.max(best, (pxK / d) * this.settings.width * 1e-3 * maxKernelMm);
    }
    if (best < 1.25) return this.idleTick(); // kernel under ~1 px: medium / wide shots keep the pre-integrated look
    this.active = true;
    this.idle = 0;
    skinShading.uSSSActive.value = 1;
    return true;
  }

  private idleTick(): false {
    if (this.allocated && ++this.idle > 300) {
      // free ~20 B/px after ~5 s without skin close enough on screen (re-allocated on the next use)
      this.skinRT.dispose();
      this.blurRT.dispose();
      this.allocated = false;
    }
    return false;
  }

  private ensureTargets() {
    if (this.allocated) return;
    this.skinRT.setSize(this.width, this.height);
    this.blurRT.setSize(this.width, this.height);
    this.allocated = true;
  }

  /** Lights must pass the SKIN_LAYER camera test of the skin pass (refreshed every ~60 frames / scene change). */
  private refreshLights(scene: THREE.Scene) {
    if (this.lightScene === scene && ++this.lightAge < 60) return;
    this.lightScene = scene;
    this.lightAge = 0;
    scene.traverse((o) => {
      if ((o as THREE.Light).isLight) o.layers.enable(SKIN_LAYER);
    });
  }

  /**
   * Right after the main scene render, with the SAME (jittered) camera: renders the skin meshes' diffuse into the
   * skin target. No-op unless prepare() returned true.
   */
  renderSkin(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    if (!this.active) return;
    this.ensureTargets();
    this.refreshLights(scene);
    const mask = camera.layers.mask;
    const bg = scene.background;
    const autoClear = renderer.autoClear;
    const shAuto = renderer.shadowMap.autoUpdate;
    const shNeeds = renderer.shadowMap.needsUpdate;
    renderer.getClearColor(this.tmpColor);
    const clearAlpha = renderer.getClearAlpha();
    camera.layers.set(SKIN_LAYER);
    scene.background = null;
    renderer.shadowMap.autoUpdate = false; // reuse this frame's shadow maps
    renderer.shadowMap.needsUpdate = false;
    skinShading.uSkinPass.value = 1;
    skinShading.uSSSActive.value = 1;
    try {
      renderer.setRenderTarget(this.skinRT);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, false);
      renderer.autoClear = false;
      renderer.render(scene, camera);
    } finally {
      skinShading.uSkinPass.value = 0;
      skinShading.uSSSActive.value = 0;
      camera.layers.mask = mask;
      scene.background = bg;
      renderer.autoClear = autoClear;
      renderer.shadowMap.autoUpdate = shAuto;
      renderer.shadowMap.needsUpdate = shNeeds;
      renderer.setClearColor(this.tmpColor, clearAlpha);
    }
  }

  /** Blur the skin diffuse and add the correction into `dst` (the HDR image, before TAA). */
  composite(renderer: THREE.WebGLRenderer, sceneDepth: THREE.Texture, camera: THREE.PerspectiveCamera, dst: THREE.WebGLRenderTarget) {
    if (!this.active) return;
    this.active = false;
    const s = this.settings;
    const pxK = 0.5 * this.height * camera.projectionMatrix.elements[5];
    for (const m of [this.hMat, this.vMat]) {
      const u = m.uniforms;
      u.tSkinDepth.value = this.skinRT.depthTexture;
      u.tSceneDepth.value = sceneDepth;
      u.uPxK.value = pxK;
      u.uWidth.value = s.width * 1e-3;
      u.uFollow.value = 1 / Math.max(1e-4, s.follow);
      u.uStrength.value = s.strength;
      u.uNear.value = camera.near;
      u.uFar.value = camera.far;
    }
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    // horizontal
    this.hMat.uniforms.tSrc.value = this.skinRT.texture;
    (this.hMat.uniforms.uDir.value as THREE.Vector2).set(1 / this.width, 0);
    this.quad.material = this.hMat;
    renderer.setRenderTarget(this.blurRT); // every pixel is written (0 off the skin): no clear
    this.quad.render(renderer);
    // vertical + additive correction into the HDR image
    this.vMat.uniforms.tSrc.value = this.blurRT.texture;
    this.vMat.uniforms.tCentre.value = this.skinRT.texture;
    (this.vMat.uniforms.uDir.value as THREE.Vector2).set(0, 1 / this.height);
    this.quad.material = this.vMat;
    renderer.setRenderTarget(dst);
    this.quad.render(renderer);
    renderer.autoClear = autoClear;
  }

  /** Compile the two blur programs (PostFX.warmupPasses calls it) so the first close-up doesn't hitch. */
  warmup(renderer: THREE.WebGLRenderer) {
    this.ensureTargets();
    this.idle = 0;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    for (const m of [this.hMat, this.vMat]) {
      m.uniforms.tSrc.value = this.skinRT.texture;
      m.uniforms.tCentre.value = this.skinRT.texture;
      m.uniforms.tSkinDepth.value = this.skinRT.depthTexture;
      m.uniforms.tSceneDepth.value = this.skinRT.depthTexture;
      this.quad.material = m;
      renderer.setRenderTarget(this.blurRT);
      this.quad.render(renderer);
    }
    renderer.autoClear = autoClear;
  }

  dispose() {
    this.skinRT.depthTexture?.dispose();
    this.skinRT.dispose();
    this.blurRT.dispose();
    this.hMat.dispose();
    this.vMat.dispose();
    this.quad.dispose();
    this.allocated = false;
  }
}

function attachedVisible(o: THREE.Object3D, scene: THREE.Scene): boolean {
  let p: THREE.Object3D | null = o;
  while (p) {
    if (!p.visible) return false;
    if (p === scene) return true;
    p = p.parent;
  }
  return false;
}
