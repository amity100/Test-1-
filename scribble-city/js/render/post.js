import * as THREE from 'three';

// Glow for the magic world: at night the lit windows, lamps, neon and gel-pen lines bloom softly.
// The scene goes into a texture, its bright parts are blurred down a small mip chain (dual
// filter), and the glow is added back on top. With no glow needed, the scene renders straight
// to the screen as before.

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const BRIGHT = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThr;
uniform float uLumK;
uniform float uNeonK;
varying vec2 vUv;
vec3 pick(vec2 uv) {
  vec3 c = texture2D(tSrc, uv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float mx = max(c.r, max(c.g, c.b));
  float sat = mx > 0.001 ? (mx - min(c.r, min(c.g, c.b))) / mx : 0.0;
  float w = smoothstep(uThr, uThr + 0.22, l) * uLumK + smoothstep(0.38, 0.8, sat * mx) * uNeonK;
  return c * clamp(w, 0.0, 1.5);
}
void main() {
  // four taps: a 2x2 box at half resolution
  vec2 o = uTexel * 0.5;
  vec3 c = pick(vUv + vec2(-o.x, -o.y)) + pick(vUv + vec2(o.x, -o.y)) + pick(vUv + vec2(-o.x, o.y)) + pick(vUv + vec2(o.x, o.y));
  gl_FragColor = vec4(c * 0.25, 1.0);
}`;

const DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 o = uTexel;
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb;
  c += texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb;
  c += texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb;
  c += texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`;

const UP = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tAdd;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 o = uTexel;
  vec3 c = texture2D(tSrc, vUv + vec2(-o.x * 2.0, 0.0)).rgb;
  c += texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2(0.0, o.y * 2.0)).rgb;
  c += texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2(o.x * 2.0, 0.0)).rgb;
  c += texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2(0.0, -o.y * 2.0)).rgb;
  c += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
  gl_FragColor = vec4(c / 12.0 + texture2D(tAdd, vUv).rgb, 1.0);
}`;

const COMPOSE = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uStrength;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  vec3 b = texture2D(tBloom, vUv).rgb;
  // screen blend: glow lifts the dark without burning out the paper
  vec3 g = b * uStrength;
  gl_FragColor = vec4(1.0 - (1.0 - c) * (1.0 - g), 1.0);
}`;

export class PostFX {
  constructor(renderer, { lowEnd = false } = {}) {
    this.renderer = renderer;
    this.strength = 0;
    this.thr = 0.5;
    this.lumK = 1;
    this.neonK = 0.6;
    this.levels = lowEnd ? 3 : 4;
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(tri, null);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    const mk = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.mBright = mk(BRIGHT, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThr: { value: 0.5 }, uLumK: { value: 1 }, uNeonK: { value: 0.6 } });
    this.mDown = mk(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mUp = mk(UP, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mCompose = mk(COMPOSE, { tScene: { value: null }, tBloom: { value: null }, uStrength: { value: 0 } });
    this.rt = null;
    this.mips = [];
    this.ups = [];
    this.lowEnd = lowEnd;
    this.size = new THREE.Vector2();
  }

  ensure() {
    const s = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    if (this.rt && s.equals(this.size)) return;
    this.size.copy(s);
    if (this.rt) this.rt.dispose();
    for (const m of this.mips) m.dispose();
    for (const m of this.ups) m.dispose();
    const opt = { depthBuffer: false, type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false };
    this.rt = new THREE.WebGLRenderTarget(s.x, s.y, { depthBuffer: true, samples: this.lowEnd ? 0 : 4, type: THREE.UnsignedByteType });
    this.mips = [];
    this.ups = [];
    let w = Math.max(1, s.x >> 1);
    let h = Math.max(1, s.y >> 1);
    for (let i = 0; i < this.levels; i++) {
      this.mips.push(new THREE.WebGLRenderTarget(w, h, opt));
      this.ups.push(new THREE.WebGLRenderTarget(w, h, opt));
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
    }
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.cam);
  }

  render(scene, camera) {
    const r = this.renderer;
    if (this.strength < 0.01) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    this.ensure();
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    const autoClear = r.autoClear;
    r.autoClear = true;
    // bright parts, half resolution
    const b = this.mBright.uniforms;
    b.tSrc.value = this.rt.texture;
    b.uTexel.value.set(1 / this.size.x, 1 / this.size.y);
    b.uThr.value = this.thr;
    b.uLumK.value = this.lumK;
    b.uNeonK.value = this.neonK;
    this.pass(this.mBright, this.mips[0]);
    // down the chain
    for (let i = 1; i < this.mips.length; i++) {
      const src = this.mips[i - 1];
      this.mDown.uniforms.tSrc.value = src.texture;
      this.mDown.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.mDown, this.mips[i]);
    }
    // and back up, adding each level
    let cur = this.mips[this.mips.length - 1];
    for (let i = this.mips.length - 2; i >= 0; i--) {
      this.mUp.uniforms.tSrc.value = cur.texture;
      this.mUp.uniforms.tAdd.value = this.mips[i].texture;
      this.mUp.uniforms.uTexel.value.set(0.5 / cur.width, 0.5 / cur.height);
      this.pass(this.mUp, this.ups[i]);
      cur = this.ups[i];
    }
    const c = this.mCompose.uniforms;
    c.tScene.value = this.rt.texture;
    c.tBloom.value = cur.texture;
    c.uStrength.value = this.strength;
    this.pass(this.mCompose, null);
    r.autoClear = autoClear;
  }
}
