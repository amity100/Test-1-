import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { FS_VERT, GLSL_SANITIZE, GLSL_VIEWZ, HDR_CLAMP } from './glsl';

/**
 * Cinematic depth of field with round bokeh (HDR, after TAA, before bloom), after the approach of Unity's
 * Post-processing Stack v2 (Keijiro Takahashi's "gather" bokeh):
 *   1. prefilter  — half resolution: circle of confusion (CoC) from depth with a thin-lens model, CoC- and
 *                   Karis-weighted colour average (no bright fringes / fireflies), largest-magnitude CoC kept.
 *   2. bokeh      — half resolution: disk-kernel gather (16 / 22 / 43 samples in rings) with separate
 *                   background and foreground accumulation, so out-of-focus foreground (a staff, a shoulder)
 *                   spreads over the sharp subject while the background never bleeds onto it.
 *   3. postfilter — half resolution: 9-tap tent (smooths the ring pattern).
 *   4. composite  — full resolution: sharp image where the CoC is < 2 px, blurred beyond, plus foreground alpha.
 *
 * Lens model: focal length from the camera's vertical FOV on a 24 mm-tall (full-frame) sensor unless given;
 * CoC(px) = f^2 / (N (s - f)) * (z - s) / z / 0.024 m * imageHeight, clamped to maxBlur * imageHeight.
 */
export interface DoFSettings {
  enabled: boolean;
  /** distance (m, along the view axis) of the plane in focus */
  focusDistance: number;
  /** lens f-number: 1.4 very shallow, 2.8 portrait, 5.6 group shot, 11 nearly everything sharp */
  fStop: number;
  /** focal length in mm; null = derived from the camera's vertical FOV (24 mm sensor height) */
  focalLength: number | null;
  /** largest blur radius as a fraction of the image height (default 0.012, capped at 0.03) */
  maxBlur: number;
  /** optional focus target (world point or object): overrides focusDistance every frame */
  target: THREE.Vector3 | THREE.Object3D | null;
}

export function defaultDoF(): DoFSettings {
  return { enabled: false, focusDistance: 10, fStop: 2.8, focalLength: null, maxBlur: 0.012, target: null };
}

/** Ring kernel on the unit disk: 1 centre sample + rings of step*i samples (staggered). */
function diskKernel(samples: number): number[][] {
  const [rings, step] = samples >= 43 ? [4, 7] : samples >= 22 ? [3, 7] : [3, 5];
  const pts: number[][] = [];
  for (let i = 0; i < rings; i++) {
    const n = i === 0 ? 1 : i * step;
    const r = i / (rings - 1);
    for (let j = 0; j < n; j++) {
      const a = (2 * Math.PI * (j + (i % 2) * 0.5)) / n;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }
  return pts;
}

const COC_GLSL = /* glsl */ `
  uniform float uNear, uFar, uFocus, uCoCScale, uMaxCoC;
  ${GLSL_VIEWZ}
  // signed CoC in full-resolution pixels: > 0 behind the focus plane, < 0 in front of it
  float cocPx(float d){
    float z = -pfxViewZ(d, uNear, uFar);
    return clamp(uCoCScale * (z - uFocus) / max(z, 1e-3), -uMaxCoC, uMaxCoC);
  }`;

const PREFILTER_FRAG = /* glsl */ `
  uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uSrcTexel;
  varying vec2 vUv;
  ${GLSL_SANITIZE}
  ${COC_GLSL}
  float mx(vec3 c){ return max(c.r, max(c.g, c.b)); }
  void main(){
    vec2 o = uSrcTexel * 0.5;
    vec2 u0 = vUv + vec2(-o.x, -o.y), u1 = vUv + vec2(o.x, -o.y), u2 = vUv + vec2(-o.x, o.y), u3 = vUv + vec2(o.x, o.y);
    vec3 c0 = pfxSanitize(texture2D(tColor, u0).rgb, HDR_MAX), c1 = pfxSanitize(texture2D(tColor, u1).rgb, HDR_MAX);
    vec3 c2 = pfxSanitize(texture2D(tColor, u2).rgb, HDR_MAX), c3 = pfxSanitize(texture2D(tColor, u3).rgb, HDR_MAX);
    float k0 = cocPx(texture2D(tDepth, u0).x), k1 = cocPx(texture2D(tDepth, u1).x);
    float k2 = cocPx(texture2D(tDepth, u2).x), k3 = cocPx(texture2D(tDepth, u3).x);
    float w0 = abs(k0) / (mx(c0) + 1.0), w1 = abs(k1) / (mx(c1) + 1.0), w2 = abs(k2) / (mx(c2) + 1.0), w3 = abs(k3) / (mx(c3) + 1.0);
    vec3 avg = (c0 * w0 + c1 * w1 + c2 * w2 + c3 * w3) / max(w0 + w1 + w2 + w3, 1e-4);
    float kmin = min(min(k0, k1), min(k2, k3)), kmax = max(max(k0, k1), max(k2, k3));
    float coc = (-kmin > kmax ? kmin : kmax) * 0.5; // half-resolution pixels
    avg *= smoothstep(0.0, 2.0, abs(coc * 2.0));
    gl_FragColor = vec4(avg, coc);
  }`;

function bokehFrag(samples: number) {
  const k = diskKernel(samples);
  const arr = k.map(([x, y]) => `vec2(${x.toFixed(5)}, ${y.toFixed(5)})`).join(', ');
  return /* glsl */ `
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uRadius;
  varying vec2 vUv;
  const int NK = ${k.length};
  const vec2 KERNEL[NK] = vec2[NK](${arr});
  void main(){
    vec4 s0 = texture2D(tSrc, vUv);
    vec4 bg = vec4(0.0), fg = vec4(0.0);
    const float margin = 2.0;
    for (int i = 0; i < NK; i++) {
      vec2 disp = KERNEL[i] * uRadius; // half-resolution pixels
      float dist = length(disp);
      vec4 s = texture2D(tSrc, vUv + disp * uTexel);
      float bgCoC = max(min(s0.a, s.a), 0.0);
      float bgW = clamp((bgCoC - dist + margin) / margin, 0.0, 1.0);
      float fgW = clamp((-s.a - dist + margin) / margin, 0.0, 1.0);
      fgW *= step(1.0, -s.a);
      bg += vec4(s.rgb, 1.0) * bgW;
      fg += vec4(s.rgb, 1.0) * fgW;
    }
    bg.rgb /= bg.a + (bg.a == 0.0 ? 1.0 : 0.0);
    fg.rgb /= fg.a + (fg.a == 0.0 ? 1.0 : 0.0);
    float alpha = clamp(fg.a * 3.14159265 / float(NK), 0.0, 1.0);
    gl_FragColor = vec4(mix(bg.rgb, fg.rgb, alpha), alpha);
  }`;
}

const POST_FRAG = /* glsl */ `
  uniform sampler2D tSrc; uniform vec2 uTexel;
  varying vec2 vUv;
  void main(){
    vec4 o = uTexel.xyxy * vec4(-0.5, -0.5, 0.5, 0.5);
    gl_FragColor = (texture2D(tSrc, vUv + o.xy) + texture2D(tSrc, vUv + o.zy) + texture2D(tSrc, vUv + o.xw) + texture2D(tSrc, vUv + o.zw)) * 0.25;
  }`;

const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tDoF;
  varying vec2 vUv;
  ${COC_GLSL}
  void main(){
    vec3 col = texture2D(tColor, vUv).rgb;
    vec4 dof = texture2D(tDoF, vUv);
    float coc = cocPx(texture2D(tDepth, vUv).x);
    float ffa = smoothstep(2.0, 4.0, coc);
    col = mix(col, dof.rgb, ffa + dof.a - ffa * dof.a);
    gl_FragColor = vec4(col, 1.0);
  }`;

export class DoFPass {
  readonly settings: DoFSettings;
  readonly samples: number;
  /** focus distance actually used by the last rendered frame (m) */
  lastFocus = 10;
  private readonly half: THREE.WebGLRenderTarget[];
  private readonly quad = new FullScreenQuad();
  private readonly coc: Record<string, THREE.IUniform>;
  private readonly prefilter: THREE.ShaderMaterial;
  private readonly bokeh: THREE.ShaderMaterial;
  private readonly post: THREE.ShaderMaterial;
  private readonly composite: THREE.ShaderMaterial;
  private width = 1;
  private height = 1;
  private readonly tmp = new THREE.Vector3();

  constructor(samples: number, type: THREE.TextureDataType, settings: DoFSettings = defaultDoF()) {
    this.samples = samples;
    this.settings = settings;
    this.half = [0, 1, 2].map((i) => {
      const rt = new THREE.WebGLRenderTarget(1, 1, {
        type, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
      });
      rt.texture.name = 'DoF.half' + i;
      return rt;
    });
    this.coc = {
      uNear: { value: 0.1 }, uFar: { value: 1000 }, uFocus: { value: 10 }, uCoCScale: { value: 0 }, uMaxCoC: { value: 8 },
    };
    const mk = (name: string, frag: string, uniforms: Record<string, THREE.IUniform>) => {
      const m = new THREE.ShaderMaterial({
        name, uniforms, vertexShader: FS_VERT, fragmentShader: frag, defines: { HDR_MAX: HDR_CLAMP.toFixed(1) },
        depthTest: false, depthWrite: false,
      });
      m.toneMapped = false;
      return m;
    };
    this.prefilter = mk('DoF.prefilter', PREFILTER_FRAG, { ...this.coc, tColor: { value: null }, tDepth: { value: null }, uSrcTexel: { value: new THREE.Vector2() } });
    this.bokeh = mk('DoF.bokeh', bokehFrag(samples), { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 4 } });
    this.post = mk('DoF.postfilter', POST_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.composite = mk('DoF.composite', COMPOSITE_FRAG, { ...this.coc, tColor: { value: null }, tDepth: { value: null }, tDoF: { value: null } });
  }

  setSize(w: number, h: number) {
    this.width = Math.max(1, Math.floor(w));
    this.height = Math.max(1, Math.floor(h));
    const hw = Math.max(1, Math.ceil(this.width / 2)), hh = Math.max(1, Math.ceil(this.height / 2));
    for (const rt of this.half) rt.setSize(hw, hh);
  }

  /** Focus distance for this frame: the target's view depth if a target is set, else settings.focusDistance. */
  focusFor(camera: THREE.PerspectiveCamera): number {
    const t = this.settings.target;
    if (t) {
      const p = (t as THREE.Object3D).isObject3D ? (t as THREE.Object3D).getWorldPosition(this.tmp) : this.tmp.copy(t as THREE.Vector3);
      p.applyMatrix4(camera.matrixWorldInverse);
      return Math.max(0.05, -p.z);
    }
    return Math.max(0.05, this.settings.focusDistance);
  }

  /** CoC scale (px per unit of (z - s) / z) and clamp for a camera / image height. */
  private lens(camera: THREE.PerspectiveCamera) {
    const s = this.settings;
    const focus = (this.lastFocus = this.focusFor(camera));
    const fovY = THREE.MathUtils.degToRad(camera.getEffectiveFOV());
    const f = s.focalLength ? s.focalLength / 1000 : 0.012 / Math.tan(fovY / 2);
    const sd = Math.max(focus, f * 1.05);
    const N = Math.max(0.7, s.fStop);
    const c = this.coc;
    c.uNear.value = camera.near;
    c.uFar.value = camera.far;
    c.uFocus.value = sd;
    c.uCoCScale.value = ((f * f) / (N * (sd - f)) / 0.024) * this.height;
    c.uMaxCoC.value = Math.max(1, Math.min(0.03, Math.max(0, s.maxBlur)) * this.height);
  }

  /** src (HDR) + depth -> dst (full resolution). */
  render(renderer: THREE.WebGLRenderer, src: THREE.Texture, depth: THREE.Texture, camera: THREE.PerspectiveCamera, dst: THREE.WebGLRenderTarget) {
    this.lens(camera);
    const [a, b, c] = this.half;
    const hw = a.width, hh = a.height;
    // 1. prefilter -> a
    this.prefilter.uniforms.tColor.value = src;
    this.prefilter.uniforms.tDepth.value = depth;
    (this.prefilter.uniforms.uSrcTexel.value as THREE.Vector2).set(1 / this.width, 1 / this.height);
    this.quad.material = this.prefilter;
    renderer.setRenderTarget(a);
    this.quad.render(renderer);
    // 2. bokeh gather a -> b
    this.bokeh.uniforms.tSrc.value = a.texture;
    (this.bokeh.uniforms.uTexel.value as THREE.Vector2).set(1 / hw, 1 / hh);
    this.bokeh.uniforms.uRadius.value = this.coc.uMaxCoC.value * 0.5;
    this.quad.material = this.bokeh;
    renderer.setRenderTarget(b);
    this.quad.render(renderer);
    // 3. postfilter b -> c
    this.post.uniforms.tSrc.value = b.texture;
    (this.post.uniforms.uTexel.value as THREE.Vector2).set(1 / hw, 1 / hh);
    this.quad.material = this.post;
    renderer.setRenderTarget(c);
    this.quad.render(renderer);
    // 4. composite -> dst
    this.composite.uniforms.tColor.value = src;
    this.composite.uniforms.tDepth.value = depth;
    this.composite.uniforms.tDoF.value = c.texture;
    this.quad.material = this.composite;
    renderer.setRenderTarget(dst);
    this.quad.render(renderer);
  }

  get bytes() {
    const bpp = this.half[0].texture.type === THREE.UnsignedByteType ? 4 : 8;
    return this.half[0].width * this.half[0].height * bpp * 3;
  }

  dispose() {
    for (const rt of this.half) rt.dispose();
    for (const m of [this.prefilter, this.bokeh, this.post, this.composite]) m.dispose();
    this.quad.dispose();
  }
}
