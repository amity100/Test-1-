import * as THREE from 'three';
import { shared, BLANK, LAYERS } from './materials.js';
import { Occlusion } from './occlusion.js';

// One frame of the drawing:
//  1. the sun's view of the street (shadows)
//  2. the city upside down in the wet street and the bay (a mirror camera)
//  3. the scene, every surface already drawn with its pens (colour + normals/ids for the outlines)
//  4. the outlines, inked over the whole picture with a hand that never quite repeats itself
//  5. the glow of the neon and the sun, the paper, the colours of the evening

const QUAD_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const INK_FRAG = /* glsl */ `
in vec2 vUv;
layout(location = 0) out vec4 fragColor;
uniform sampler2D tColor;
uniform sampler2D tAux;
uniform sampler2D tDepth;
uniform sampler2D uNoise;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uBoil;
uniform float uPR;
uniform float uLineW;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;

float linZ(vec2 uv) {
  float d = texture(tDepth, uv).r;
  float z = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
vec3 nrm(vec2 e) {
  vec2 xy = e * 2.0 - 1.0;
  return vec3(xy, sqrt(max(0.0, 1.0 - dot(xy, xy))));
}
float vn(vec2 p) { return textureLod(uNoise, (p + 0.5) / 256.0, 0.0).r; }

// how much of an outline passes through uv: a step back in depth (planes seen edge-on do not
// count: 1/z is flat across a plane), a fold between two faces, the edge of another object.
// far: 0 near .. 1 far away, where the artist draws the shapes and leaves out most of the folds
// and seams inside them (a small far thing drawn with every line would be a black knot)
float edgeAt(vec2 uv, float r, float far, out float zc) {
  vec4 a0 = texture(tAux, uv);
  float z0 = linZ(uv);
  zc = z0;
  if (a0.w < 0.01) return 0.0;
  vec3 n0 = nrm(a0.xy);
  vec2 ox = vec2(r * uTexel.x, 0.0);
  vec2 oy = vec2(0.0, r * uTexel.y);
  float zl = linZ(uv - ox);
  float zr = linZ(uv + ox);
  float zd = linZ(uv - oy);
  float zu = linZ(uv + oy);
  float w0 = 1.0 / z0;
  float lap = abs(1.0 / zl + 1.0 / zr - 2.0 * w0) + abs(1.0 / zu + 1.0 / zd - 2.0 * w0);
  float behind = step(z0 * 1.02, max(max(zl, zr), max(zu, zd)));
  // (the people's bodies are drawn in one line round each shape: no seams where an arm bends at
  // the elbow or a leg at the knee - their line weight is marked 0.97; their outlines against
  // what is behind them and between their parts stay)
  float person = step(0.955, a0.w) * step(a0.w, 0.985);
  float e = smoothstep(0.025, 0.09, lap / w0) * (0.45 + 0.55 * behind) * mix(1.0, behind, person);
  vec4 al = texture(tAux, uv - ox);
  vec4 ar = texture(tAux, uv + ox);
  vec4 ad = texture(tAux, uv - oy);
  vec4 au = texture(tAux, uv + oy);
  float dn = max(max(1.0 - dot(n0, nrm(al.xy)), 1.0 - dot(n0, nrm(ar.xy))), max(1.0 - dot(n0, nrm(ad.xy)), 1.0 - dot(n0, nrm(au.xy))));
  e = max(e, smoothstep(0.1, 0.32, dn) * 0.85 * (1.0 - 0.6 * far) * (1.0 - person));
  float id = max(max(step(0.002, abs(al.z - a0.z)) * step(z0, zl + 0.08), step(0.002, abs(ar.z - a0.z)) * step(z0, zr + 0.08)),
                 max(step(0.002, abs(ad.z - a0.z)) * step(z0, zd + 0.08), step(0.002, abs(au.z - a0.z)) * step(z0, zu + 0.08)));
  e = max(e, id * 0.9 * (1.0 - 0.45 * far));
  return e * a0.w;
}

// where in the world this pixel is (the nearest thing around it, so both sides of an outline
// agree on where it is), and how far that is
vec3 worldAt(vec2 uv, out float dist) {
  vec2 o = uTexel * 2.0 * uPR;
  float d = texture(tDepth, uv).r;
  d = min(d, texture(tDepth, uv + vec2(o.x, 0.0)).r);
  d = min(d, texture(tDepth, uv - vec2(o.x, 0.0)).r);
  d = min(d, texture(tDepth, uv + vec2(0.0, o.y)).r);
  d = min(d, texture(tDepth, uv - vec2(0.0, o.y)).r);
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  v /= v.w;
  dist = -v.z;
  return (uCamWorld * vec4(v.xyz, 1.0)).xyz;
}

void main() {
  vec4 c = texture(tColor, vUv);
  // the hand that inks the outlines wobbles: the wobble belongs to the thing it outlines, so it
  // travels with it as you walk (and, if the lines are alive, it is redrawn a few times a second).
  // Far away the hand is steadier and the pen finer: a wobble the size of a near line's would
  // tear a small far thing (a palm down the avenue, a helicopter over the towers) to pieces.
  float zn;
  vec3 w = worldAt(vUv, zn);
  float far = smoothstep(20.0, 130.0, zn);
  float steady = mix(1.0, 0.16, far);
  vec2 q = vec2(w.x + w.y * 0.71, w.z - w.y * 0.53) * mix(1.7, 0.5, far) + vec2(sin(uBoil * 1.7), cos(uBoil * 2.3)) * 0.3;
  vec2 j1 = (vec2(vn(q), vn(q + 41.0)) - 0.5) * 2.0 * uPR * steady;
  float r = max(uLineW * uPR * mix(1.0, 0.6, far), 1.0);
  float z;
  float e = edgeAt(vUv + j1 * uTexel, r, far, z);
  // the second, lighter pass of the pen that makes a near line sketchy (not for far things)
  if (far < 0.97) {
    vec2 j2 = (vec2(vn(q * 1.6 + 13.0), vn(q * 1.6 + 77.0)) - 0.5) * 2.6 * uPR * steady;
    float z2;
    e = max(e, edgeAt(vUv + j2 * uTexel, max(r * 0.7, 1.0), far, z2) * 0.55 * (1.0 - far));
  }
  // far away the lines get pale and take the colour of what they outline, then give way to the haze
  float fz = smoothstep(30.0, 380.0, z);
  e *= mix(1.0, 0.45, fz);
  vec3 ink = mix(vec3(0.018, 0.012, 0.04), c.rgb * 0.12, 0.2);
  ink = mix(ink, c.rgb * 0.38, fz * 0.55);
  vec3 col = mix(c.rgb, ink, clamp(e * 1.15, 0.0, 1.0) * 0.95);
  fragColor = vec4(col, c.a);
}`;

const BRIGHT_FRAG = /* glsl */ `
in vec2 vUv;
layout(location = 0) out vec4 fragColor;
uniform sampler2D tSrc;
uniform vec2 uTexel;
vec3 pick(vec2 uv) {
  vec4 c = texture(tSrc, uv);
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  return c.rgb * clamp(smoothstep(1.1, 2.6, l) + c.a * 0.7, 0.0, 2.0);
}
void main() {
  vec2 o = uTexel * 0.5;
  vec3 c = pick(vUv + vec2(-o.x, -o.y)) + pick(vUv + vec2(o.x, -o.y)) + pick(vUv + vec2(-o.x, o.y)) + pick(vUv + vec2(o.x, o.y));
  fragColor = vec4(c * 0.25, 1.0);
}`;

const DOWN_FRAG = /* glsl */ `
in vec2 vUv;
layout(location = 0) out vec4 fragColor;
uniform sampler2D tSrc;
uniform vec2 uTexel;
void main() {
  vec2 o = uTexel;
  vec3 c = texture(tSrc, vUv).rgb * 4.0;
  c += texture(tSrc, vUv + vec2(-o.x, -o.y)).rgb;
  c += texture(tSrc, vUv + vec2(o.x, -o.y)).rgb;
  c += texture(tSrc, vUv + vec2(-o.x, o.y)).rgb;
  c += texture(tSrc, vUv + vec2(o.x, o.y)).rgb;
  fragColor = vec4(c / 8.0, 1.0);
}`;

const UP_FRAG = /* glsl */ `
in vec2 vUv;
layout(location = 0) out vec4 fragColor;
uniform sampler2D tSrc;
uniform sampler2D tAdd;
uniform vec2 uTexel;
void main() {
  vec2 o = uTexel;
  vec3 c = texture(tSrc, vUv + vec2(-o.x * 2.0, 0.0)).rgb;
  c += texture(tSrc, vUv + vec2(-o.x, o.y)).rgb * 2.0;
  c += texture(tSrc, vUv + vec2(0.0, o.y * 2.0)).rgb;
  c += texture(tSrc, vUv + vec2(o.x, o.y)).rgb * 2.0;
  c += texture(tSrc, vUv + vec2(o.x * 2.0, 0.0)).rgb;
  c += texture(tSrc, vUv + vec2(o.x, -o.y)).rgb * 2.0;
  c += texture(tSrc, vUv + vec2(0.0, -o.y * 2.0)).rgb;
  c += texture(tSrc, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
  fragColor = vec4(c / 12.0 + texture(tAdd, vUv).rgb, 1.0);
}`;

const FINAL_FRAG = /* glsl */ `
in vec2 vUv;
layout(location = 0) out vec4 fragColor;
uniform sampler2D tSrc;
uniform sampler2D tBloom;
uniform sampler2D uNoise;
uniform float uBloom;
uniform float uExposure;
uniform float uPR;
uniform vec2 uSrcTexel;
uniform float uSharp;
float aces1(float x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
// keeps the hue of the pens: the curve works on the brightness, and only what is still too
// bright after it rolls over into white
vec3 tonemap(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 r = c * (aces1(l) / max(l, 1e-4));
  float m = max(r.r, max(r.g, r.b));
  if (m > 1.0) r = mix(r / m, vec3(1.0), clamp((m - 1.0) * 0.6, 0.0, 1.0));
  return r;
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 grade(vec2 uv) {
  vec3 c = tonemap((texture(tSrc, uv).rgb + texture(tBloom, uv).rgb * uBloom) * uExposure);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return clamp(vec3(l) + (c - vec3(l)) * 1.25, 0.0, 1.0);
}
void main() {
  // contrast-adaptive sharpening (after AMD's CAS): crisp pen lines even when the drawing was
  // made at a lower resolution than the screen
  vec3 b = grade(vUv + vec2(0.0, -uSrcTexel.y));
  vec3 d = grade(vUv + vec2(-uSrcTexel.x, 0.0));
  vec3 e = grade(vUv);
  vec3 f = grade(vUv + vec2(uSrcTexel.x, 0.0));
  vec3 h = grade(vUv + vec2(0.0, uSrcTexel.y));
  vec3 mn = min(min(min(d, e), min(f, b)), h);
  vec3 mx = max(max(max(d, e), max(f, b)), h);
  vec3 amp = sqrt(clamp(min(mn, 2.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0));
  vec3 wgt = -amp * mix(0.125, 0.2, uSharp);
  vec3 c = (e + (b + d + f + h) * wgt) / (1.0 + 4.0 * wgt);
  c = toSRGB(clamp(c, 0.0, 1.0));
  // a breath of shade at the edges of the page
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * 0.28;
  fragColor = vec4(c, 1.0);
}`;

const _v = new THREE.Vector3();
const _q = new THREE.Vector4();
const _plane = new THREE.Plane();
const _m = new THREE.Matrix4();
const _target = new THREE.Vector3();
const _look = new THREE.Vector3();
const _normal = new THREE.Vector3(0, 1, 0);
const _up = new THREE.Vector3(0, 1, 0);
const _sx = new THREE.Vector3();
const _sy = new THREE.Vector3();
const _sz = new THREE.Vector3();
const _sc = new THREE.Vector3();
const _f = new THREE.Vector3();

// the layer of what is never seen in the mirror under the street (the main camera and the sun
// see it; the mirror's camera does not), and the one only the sun sees
const MIRRORLESS = LAYERS.MIRRORLESS;
// the still city's next shadow map is drawn in this many slices, one a frame, once the box has
// less than this share of the map's room left (12 m: four frames even at 90 m/s)
const STATIC_SLICES = 4;
const STATIC_SOON = 0.2;
// as the sun goes over, the shadows follow it in steps: the still city's map every 0.25 degree,
// the far one every degree, each new map drawn in the background and faded in over FADE_MS
const SUN_STEP = Math.cos((0.25 * Math.PI) / 180);
const FAR_STEP = Math.cos((1.0 * Math.PI) / 180);
const FAR_SLICES = 4;
const FADE_MS = 800;
const _fx = new THREE.Vector3();
const _fy = new THREE.Vector3();
const _fz = new THREE.Vector3();
// the parts of the still city that move (the big wheel): drawn with what moves
function movingParts(root) {
  const out = [];
  for (const c of root.children) {
    let dyn = !!c.userData.dynamic;
    c.traverse((o) => {
      if (o.userData.dynamic) dyn = true;
    });
    if (dyn) out.push(c);
  }
  return out;
}

// the sun's frame (x across it, level; y up its face; z along it towards the sun)
function sunFrame(dir, x, y, z) {
  z.copy(dir).normalize();
  x.crossVectors(_up, z).normalize();
  y.crossVectors(z, x);
}
const SUN = LAYERS.SUN;
const notInMirror = (o) => !!((o.material.userData && o.material.userData.reflective) || o.userData.noReflect || o.userData.indoor);

export class Pipeline {
  constructor(renderer, scene, camera, { low = false } = {}) {
    this.r = renderer;
    this.scene = scene;
    this.camera = camera;
    this.low = low;
    this.bloom = 0.42;
    this.exposure = 1.0;
    this.lineW = 1.25;
    const gl = renderer.getContext();
    const ext = renderer.extensions;
    this.hdr = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
    this.type = this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
    // 1. the sun's depth, in two maps: what moves (around you, every frame) and the still city
    //    (setStatic: a bigger map on the same grid of texels, drawn again only when you have gone
    //    far enough from where it was drawn, or something in it was rubbed out)
    const S = low ? 1024 : 2048;
    // (only the depth is read: the colour beside it is the smallest there is)
    this.shadowRT = new THREE.WebGLRenderTarget(S, S, { format: THREE.RedFormat, depthBuffer: true, depthTexture: new THREE.DepthTexture(S, S) });
    this.sunCam = new THREE.OrthographicCamera(-60, 60, 60, -60, 1, 520);
    this.sunCam.layers.enable(MIRRORLESS);
    this.sunCam.layers.enable(SUN);
    camera.layers.enable(MIRRORLESS);
    shared.uShadowMap.value = this.shadowRT.depthTexture;
    shared.uShadowTexel.value = 1 / S;
    this.shadowS = S;
    // the still city's map: 45 m more each side across the sun and 40 m up and down (enough for
    // a sun high in the sky, and for turning round on the spot), and 60 m more depth each way
    // along it
    this.stMx = Math.round((45 * S) / 120);
    this.stMy = Math.round((40 * S) / 120);
    this.stMz = 60;
    // where the shadows are drawn from (setShadowDir): the maps follow it in steps
    this.shadowDir = shared.uSunDir.value.clone();
    // the map fading out as a new one fades in (the still city's or the far one)
    this.fade = null;
    this.staticRT = null;
    this.staticRoot = null;
    // (how many maps were drawn, slices of them, and maps drawn whole in one frame)
    this.st = { builds: 0, slices: 0, full: 0 };
    this.lead = new THREE.Vector3();
    this.lastCam = new THREE.Vector3();
    this.lastT = 0;
    this._swap = [];
    this._hide = [];
    // 2. the mirror
    this.reflCam = new THREE.PerspectiveCamera();
    this.mirrorY = 0;
    // fullscreen passes
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(tri, null);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    const mk = (frag, uniforms) => new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: QUAD_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.mInk = mk(INK_FRAG, {
      tColor: { value: null }, tAux: { value: null }, tDepth: { value: null }, uNoise: shared.uNoise, uTexel: { value: new THREE.Vector2() },
      uNear: { value: 0.1 }, uFar: { value: 3000 }, uBoil: shared.uBoil, uPR: shared.uPR, uLineW: { value: 1 },
      uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
    });
    this.mBright = mk(BRIGHT_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mDown = mk(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mUp = mk(UP_FRAG, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mFinal = mk(FINAL_FRAG, { tSrc: { value: null }, tBloom: { value: null }, uNoise: shared.uNoise, uBloom: { value: 0.9 }, uExposure: { value: 1 }, uPR: shared.uPR, uSrcTexel: { value: new THREE.Vector2() }, uSharp: { value: 0.6 } });
    this.size = new THREE.Vector2(-1, -1);
    this.levels = low ? 4 : 5;
    // things drawn over the finished picture (speech bubbles)
    this.overlay = new THREE.Scene();
    this.reflections = true;
    // the sun's view of the whole city, made once (see bakeFarShadows)
    this.farRT = null;
    // the drawing is made at scale x the screen's pixels and brought up to the screen sharp
    this.scale = 1;
    this.screen = new THREE.Vector2();
    // the performance numbers (game/perf.js) time each pass while they are shown
    this.timer = null;
    // leaving out what is behind the buildings (setOcclusion)
    this.occlusion = null;
    this.occlusionOn = true;
  }

  // the screen's pixels per CSS pixel, times the drawing's own scale
  get pixelsPerCss() {
    return this.r.getPixelRatio() * this.scale;
  }

  ensure() {
    const r = this.r;
    r.getDrawingBufferSize(this.screen);
    const s = new THREE.Vector2(Math.max(2, Math.round(this.screen.x * this.scale)), Math.max(2, Math.round(this.screen.y * this.scale)));
    shared.uPR.value = this.pixelsPerCss;
    shared.uResolution.value.set(s.x, s.y);
    if (s.equals(this.size)) return;
    this.size.copy(s);
    const w = s.x;
    const h = s.y;
    const dispose = (t) => t && t.dispose();
    dispose(this.gRT);
    dispose(this.reflRT);
    dispose(this.inkRT);
    (this.mips || []).forEach(dispose);
    (this.ups || []).forEach(dispose);
    this.gRT = new THREE.WebGLRenderTarget(w, h, { count: 2, type: this.type, depthBuffer: true, depthTexture: new THREE.DepthTexture(w, h) });
    for (const t of this.gRT.textures) {
      t.minFilter = THREE.NearestFilter;
      t.magFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
    }
    const rs = this.low ? 0.33 : 0.5;
    this.reflRT = new THREE.WebGLRenderTarget(Math.max(2, Math.round(w * rs)), Math.max(2, Math.round(h * rs)), { type: this.type, depthBuffer: true });
    this.inkRT = new THREE.WebGLRenderTarget(w, h, { type: this.type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const opt = { type: this.type, depthBuffer: false };
    this.mips = [];
    this.ups = [];
    let mw = Math.max(1, w >> 1);
    let mh = Math.max(1, h >> 1);
    for (let i = 0; i < this.levels; i++) {
      this.mips.push(new THREE.WebGLRenderTarget(mw, mh, opt));
      this.ups.push(new THREE.WebGLRenderTarget(mw, mh, opt));
      mw = Math.max(1, mw >> 1);
      mh = Math.max(1, mh >> 1);
    }
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.quadScene, this.quadCam);
  }

  // The still city (root: its parts that never move; the ones that do are marked
  // userData.dynamic). cull(p): the city's small things as seen from p (they are left out of the
  // sun's view far away, as they are on the screen); version(): changes when a prop is rubbed out.
  setStatic(root, { cull = null, version = null } = {}) {
    const S = this.shadowS;
    const W = S + 2 * this.stMx;
    const H = S + 2 * this.stMy;
    if (W > this.r.capabilities.maxTextureSize) return;
    this.staticRoot = root;
    this.staticCull = cull;
    this.staticVersion = version;
    // the city's moving parts (the big wheel): drawn with what moves
    this.staticSkip = movingParts(root);
    // two maps: the one in use, and the next one, drawn in the background a quarter at a time
    // before the one in use runs out
    // (24-bit depth: at 16 bits a few lit pixels on walls the low sun grazes came out different)
    const map = () => ({
      rt: new THREE.WebGLRenderTarget(W, H, { format: THREE.RedFormat, depthBuffer: true, depthTexture: new THREE.DepthTexture(W, H) }),
      cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 520 + 2 * this.stMz),
      on: false,
      sx: 0,
      sy: 0,
      sz: 0,
      ver: -1,
      sun: new THREE.Vector3(),
      matrix: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      slice: 0,
    });
    this.stMaps = [map(), map()];
    for (const m of this.stMaps) {
      m.cam.layers.enable(MIRRORLESS);
      m.cam.layers.enable(SUN);
    }
    this.stCur = this.stMaps[0];
    this.stBuild = null;
    this.staticRT = this.stCur.rt;
    shared.uShadowStatic.value = this.stCur.rt.depthTexture;
    shared.uShadowStaticTexel.value.set(1 / W, 1 / H);
    // what of the still city is never in the mirror under the street (the reflective ground
    // itself, the small things, the rooms) is on a layer of its own that the mirror's camera does
    // not see: no hiding and showing a thousand things every frame
    const skip = new Set(this.staticSkip);
    const visit = (o) => {
      if (skip.has(o)) return;
      if (o.isMesh && notInMirror(o)) o.layers.set(MIRRORLESS);
      for (const c of o.children) visit(c);
    };
    visit(root);
    this.mirrorLayered = true;
  }

  // What is behind the buildings is left out (render/occlusion.js): boxes, the buildings' bodies;
  // pieces, the still city's meshes that may be left out; holes(), the rubbed-out spots
  setOcclusion(boxes, pieces, holes = null) {
    this.occlusion = new Occlusion(this.low ? 128 : 160, this.low ? 72 : 90);
    this.occlusion.setOccluders(boxes);
    this.occHoles = holes;
    this.occPieces = [];
    for (const o of pieces) {
      o.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(o);
      if (b.isEmpty()) continue;
      this.occPieces.push({ o, b });
    }
    this._occHidden = [];
  }

  // leave out (for this one pass) the pieces surely behind the buildings, as cam sees them
  occlude(cam) {
    const occ = this.occlusion;
    const hidden = this._occHidden;
    hidden.length = 0;
    if (!occ || !this.occlusionOn) return hidden;
    occ.begin(cam, this.occHoles ? this.occHoles() : null);
    for (const p of this.occPieces) {
      const o = p.o;
      if (!o.visible) continue;
      const b = p.b;
      if (occ.hidden(b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z)) {
        o.visible = false;
        hidden.push(o);
      }
    }
    return hidden;
  }

  unocclude() {
    const hidden = this._occHidden;
    if (!hidden) return;
    for (const o of hidden) o.visible = true;
    hidden.length = 0;
  }

  // the depth materials on (or the thing hidden from the sun) for everything visible under o
  // that casts, skipping the still city's parts when skip is given
  swapDepth(o, skip) {
    if (!o.visible) return;
    if (skip && o === this.staticRoot) {
      for (const c of this.staticSkip) this.swapDepth(c, null);
      return;
    }
    if (o.isMesh) {
      const d = o.material.userData && o.material.userData.depth;
      if (d === null || o.userData.noShadow || o.userData.indoor) {
        o.visible = false;
        this._hide.push(o);
        return;
      } else if (d) {
        this._swap.push(o, o.material);
        o.material = d;
      }
    }
    const ch = o.children;
    for (let i = 0; i < ch.length; i++) this.swapDepth(ch[i], skip);
  }

  unswapDepth() {
    const sw = this._swap;
    for (let i = 0; i < sw.length; i += 2) sw[i].material = sw[i + 1];
    for (const o of this._hide) o.visible = true;
    sw.length = 0;
    this._hide.length = 0;
  }

  // where the shadows are drawn from (game/daynight.js: the sun, or the moon at night)
  setShadowDir(d) {
    this.shadowDir.copy(d);
  }

  // the sun looks down the street from low over the bay; its box follows you
  renderShadows(center) {
    const root = this.staticRoot;
    // the still city's map (and the city's far one): drawn again, faded, swapped
    if (root) this.updateStatic(center);
    if (this.farMaps) this.updateFar();
    this.updateFade();
    // the box is drawn from the direction of the still city's map in use, on its grid
    const st = this.stCur;
    const sun = st && st.on ? st.sun : this.shadowDir;
    const cam = this.sunCam;
    // the box follows you in whole texels of the shadow map, so the shadows' edges stay put
    // instead of crawling as you walk
    const texel = (cam.right - cam.left) / this.shadowRT.width;
    const z = _sz;
    const x = _sx;
    const y = _sy;
    sunFrame(sun, x, y, z);
    const cx = Math.round(center.dot(x) / texel) * texel;
    const cy = Math.round(center.dot(y) / texel) * texel;
    const cz = center.dot(z);
    const snapped = _sc.copy(x).multiplyScalar(cx).addScaledVector(y, cy).addScaledVector(z, cz);
    cam.position.copy(snapped).addScaledVector(z, 260);
    cam.up.set(0, 1, 0);
    cam.lookAt(snapped);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    shared.uShadowMatrix.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    shared.uShadowOn.value = 0;
    this.r.setRenderTarget(this.shadowRT);
    this.r.clear();
    if (root) {
      // what moves: everything but the still city
      this.swapDepth(this.scene, true);
      root.visible = false;
      this.r.render(this.scene, cam);
      root.visible = true;
      if (this.staticSkip.length) {
        this.r.autoClear = false;
        for (const c of this.staticSkip) this.r.render(c, cam);
        this.r.autoClear = true;
      }
    } else {
      this.swapDepth(this.scene, false);
      this.r.render(this.scene, cam);
    }
    this.unswapDepth();
    shared.uShadowOn.value = 1;
  }

  // the still city's map: good while the box is inside it. Before it runs out (or once the
  // sun has gone on a step) the next one is drawn, a quarter a frame, and takes over (fading in
  // if the sun has moved); if it runs out first, or something in it was rubbed out, the next
  // one is drawn whole at once
  updateStatic(center) {
    const ver = this.staticVersion ? this.staticVersion() : 0;
    const cur = this.stCur;
    const want = this.shadowDir;
    const b = this.stBuild;
    const left = this.staticLeft(cur, center, ver);
    if (left < 0) {
      // (a map fading out cannot be faded into one that has run out: stop it)
      if (this.fade) this.endFade();
      const next = b && b.sun.equals(cur.on ? cur.sun : want) && this.staticLeft(b, center, ver) >= 0.2 ? b : this.beginStatic(want, center, ver);
      this.drawStatic(next, STATIC_SLICES);
      this.useStatic(next);
      this.st.full++;
      return;
    }
    if (b) {
      this.drawStatic(b, 1);
      if (b.slice < STATIC_SLICES) return;
      if (!b.sun.equals(cur.sun)) {
        // the sun has gone on: the new map fades in over the old one (when the fade is free)
        if (this.fade) return;
        this.startFade('static', cur);
        this.useStatic(b);
      } else if (this.staticLeft(b, center, ver) > left) this.useStatic(b);
      else this.stBuild = null;
      return;
    }
    // (the map fading out is not free to be drawn into)
    if (this.fade && this.fade.kind === 'static') return;
    if (cur.sun.dot(want) < SUN_STEP || left < STATIC_SOON) this.drawStatic(this.beginStatic(want, center, ver), 1);
  }

  // how much of the map's room is left around the box (0 at its edge), or -1 when it does not
  // hold it (or was drawn before something was rubbed out)
  staticLeft(m, center, ver) {
    if (!m.on || m.ver !== ver) return -1;
    const texel = (this.sunCam.right - this.sunCam.left) / this.shadowS;
    sunFrame(m.sun, _fx, _fy, _fz);
    const cx = Math.round(center.dot(_fx) / texel) * texel;
    const cy = Math.round(center.dot(_fy) / texel) * texel;
    const cz = center.dot(_fz);
    const fx = 1 - Math.abs(cx - m.sx) / (this.stMx * texel);
    const fy = 1 - Math.abs(cy - m.sy) / (this.stMy * texel);
    const fz = 1 - Math.abs(cz - m.sz) / this.stMz;
    const f = Math.min(fx, fy, fz);
    return f < -1e-6 ? -1 : Math.max(0, f);
  }

  // the next map, seen from dir, around where you are, a little the way you look and the way
  // you go (where the box goes), but never with the box more than 60% of the way to its edge:
  // turning around on the spot stays inside it, and so does backing up
  beginStatic(dir, center, ver) {
    const m = this.stMaps[0] === this.stCur ? this.stMaps[1] : this.stMaps[0];
    const texel = (this.sunCam.right - this.sunCam.left) / this.shadowS;
    const x = _fx;
    const y = _fy;
    const z = _fz;
    sunFrame(dir, x, y, z);
    const cx = Math.round(center.dot(x) / texel) * texel;
    const cy = Math.round(center.dot(y) / texel) * texel;
    const cz = center.dot(z);
    const camPos = this.camera.position;
    const f = this.camera.getWorldDirection(_f);
    const p = _v.set(camPos.x + this.lead.x + f.x * 10, 0, camPos.z + this.lead.z + f.z * 10);
    const near = (v, c, room) => c + Math.max(-0.6 * room, Math.min(0.6 * room, v - c));
    const sx = near(p.dot(x), cx, this.stMx * texel);
    const sy = near(p.dot(y), cy, this.stMy * texel);
    const sz = near(p.dot(z), cz, this.stMz);
    m.sx = Math.round(sx / texel) * texel;
    m.sy = Math.round(sy / texel) * texel;
    m.sz = sz;
    m.ver = ver;
    m.sun.copy(dir);
    m.on = true;
    m.slice = 0;
    // (the small things as they would be seen from where you are heading)
    m.p.set(camPos.x + this.lead.x, camPos.y, camPos.z + this.lead.z);
    const c = _sc.copy(x).multiplyScalar(m.sx).addScaledVector(y, m.sy).addScaledVector(z, m.sz);
    const cam = m.cam;
    const hx = (this.shadowS / 2 + this.stMx) * texel;
    const hy = (this.shadowS / 2 + this.stMy) * texel;
    cam.left = -hx;
    cam.right = hx;
    cam.top = hy;
    cam.bottom = -hy;
    cam.position.copy(c).addScaledVector(z, 260 + this.stMz);
    cam.up.set(0, 1, 0);
    cam.lookAt(c);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    m.matrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.stBuild = m;
    this.st.builds++;
    return m;
  }

  // n more slices of the map being drawn (each slice a quarter of the still city's pieces)
  drawStatic(m, n) {
    const root = this.staticRoot;
    const camPos = this.camera.position;
    for (let k = 0; k < n && m.slice < STATIC_SLICES; k++) {
      if (this.staticCull) this.staticCull(m.p);
      this.drawSlice(root, m.slice, STATIC_SLICES, m.rt, m.cam);
      if (this.staticCull) this.staticCull(camPos);
      m.slice++;
      this.st.slices++;
    }
  }

  // one slice of the still city (every n-th piece from the i-th) into a map of the sun's view
  drawSlice(root, i, n, rt, cam) {
    const pieces = root.children;
    // (the far map is first drawn before setStatic: its moving parts are found here then)
    const skip = this.staticSkip || (this.staticSkip = movingParts(root));
    const hid = this._sliceHid || (this._sliceHid = []);
    hid.length = 0;
    for (let k = 0; k < pieces.length; k++) {
      const o = pieces[k];
      if (!o.visible) continue;
      if (k % n !== i || skip.includes(o)) {
        o.visible = false;
        hid.push(o);
      }
    }
    const keep = shared.uShadowOn.value;
    shared.uShadowOn.value = 0;
    this.swapDepth(root, false);
    this.r.setRenderTarget(rt);
    if (i === 0) this.r.clear();
    this.r.autoClear = false;
    this.r.render(root, cam);
    this.r.autoClear = true;
    this.unswapDepth();
    shared.uShadowOn.value = keep;
    for (const o of hid) o.visible = true;
  }

  // the map the shader reads
  useStatic(m) {
    this.stCur = m;
    this.staticRT = m.rt;
    if (this.stBuild === m) this.stBuild = null;
    shared.uShadowStatic.value = m.rt.depthTexture;
    shared.uShadowStaticMatrix.value.copy(m.matrix);
    // the same bias in metres as the near map's (its depth is spread over a longer way)
    shared.uShadowStaticBias.value = (0.0012 * 519) / (m.cam.far - m.cam.near);
    shared.uShadowStaticOn.value = 1;
  }

  // the map that was in use fades out under the new one (one at a time: the still city's or the
  // far one)
  startFade(kind, m) {
    this.fade = { kind, m, t0: performance.now() };
    shared.uShadowOld.value = m.rt.depthTexture;
    shared.uShadowOldMatrix.value.copy(m.matrix);
    shared.uShadowOldMode.value = kind === 'static' ? 1 : 2;
    shared.uShadowOldK.value = 1;
  }

  updateFade() {
    const f = this.fade;
    if (!f) return;
    const k = (performance.now() - f.t0) / FADE_MS;
    if (k >= 1) this.endFade();
    else shared.uShadowOldK.value = 1 - k * k * (3 - 2 * k);
  }

  endFade() {
    this.fade = null;
    shared.uShadowOldMode.value = 0;
    shared.uShadowOldK.value = 0;
    shared.uShadowOld.value = BLANK;
  }

  // the city's far map (beyond the box): drawn again in the background when the sun has gone on
  // a degree, or something was rubbed out, and faded in
  updateFar() {
    const want = this.shadowDir;
    const cur = this.farCur;
    const b = this.farBuild;
    if (b) {
      this.drawFar(b, 1);
      if (b.slice < FAR_SLICES || this.fade) return;
      this.startFade('far', cur);
      this.useFar(b);
      return;
    }
    if (this.fade && this.fade.kind === 'far') return;
    if (this.farDirty || cur.sun.dot(want) < FAR_STEP) {
      this.farDirty = false;
      this.drawFar(this.beginFar(want), 1);
    }
  }

  beginFar(dir) {
    const m = this.farMaps[0] === this.farCur ? this.farMaps[1] : this.farMaps[0];
    const box = this.farBox;
    const z = _fz;
    const x = _fx;
    const y = _fy;
    sunFrame(dir, x, y, z);
    // the city's box in the sun's frame
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    const p = _v;
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      const a = p.dot(x);
      const bb = p.dot(y);
      const c = p.dot(z);
      x0 = Math.min(x0, a);
      x1 = Math.max(x1, a);
      y0 = Math.min(y0, bb);
      y1 = Math.max(y1, bb);
      z0 = Math.min(z0, c);
      z1 = Math.max(z1, c);
    }
    const cam = m.cam;
    cam.near = 1;
    cam.far = z1 - z0 + 20;
    cam.position.copy(z).multiplyScalar(z1 + 10);
    cam.up.copy(y);
    cam.lookAt(_sc.copy(cam.position).sub(z));
    cam.updateMatrixWorld();
    // the frame above is centred on the sun's axis through the origin: shift the box onto it
    cam.left = x0;
    cam.right = x1;
    cam.top = y1;
    cam.bottom = y0;
    cam.updateProjectionMatrix();
    m.matrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    m.sun.copy(dir);
    m.slice = 0;
    this.farBuild = m;
    return m;
  }

  drawFar(m, n) {
    for (let k = 0; k < n && m.slice < FAR_SLICES; k++) {
      this.drawSlice(this.farRoot, m.slice, FAR_SLICES, m.rt, m.cam);
      m.slice++;
    }
  }

  useFar(m) {
    this.farCur = m;
    this.farRT = m.rt;
    if (this.farBuild === m) this.farBuild = null;
    shared.uShadowFar.value = m.rt.depthTexture;
    shared.uShadowFarMatrix.value.copy(m.matrix);
    shared.uShadowFarTexel.value.set(1 / m.rt.width, 1 / m.rt.height);
    shared.uShadowFarOn.value = 1;
  }

  // where the camera is heading (for the still city's map): about a second ahead, at most 20 m
  trackCamera() {
    const now = performance.now();
    const c = this.camera.position;
    const dt = (now - this.lastT) / 1000;
    if (this.lastT && dt > 0 && dt < 0.25) {
      const k = Math.min(1, dt * 3);
      const vx = (c.x - this.lastCam.x) / dt;
      const vz = (c.z - this.lastCam.z) / dt;
      this.lead.x += (vx - this.lead.x) * k;
      this.lead.z += (vz - this.lead.z) * k;
    } else this.lead.set(0, 0, 0);
    this.lastCam.copy(c);
    this.lastT = now;
    const l = Math.hypot(this.lead.x, this.lead.z);
    if (l > 20) this.lead.multiplyScalar(20 / l);
  }

  hideFromMirror(o, hidden) {
    if (!o.visible) return;
    if (o === this.staticRoot && this.mirrorLayered) {
      for (const c of this.staticSkip) this.hideFromMirror(c, hidden);
      return;
    }
    if (o.isMesh && notInMirror(o)) {
      o.visible = false;
      hidden.push(o);
      return;
    }
    const ch = o.children;
    for (let i = 0; i < ch.length; i++) this.hideFromMirror(ch[i], hidden);
  }

  // the mirror camera under the street (three.js Reflector, by hand)
  renderReflection() {
    const camera = this.camera;
    const y = this.mirrorY;
    const rc = this.reflCam;
    const camPos = camera.position;
    if (camPos.y <= y || !this.reflections) {
      shared.uRefl.value = BLANK;
      return;
    }
    const P = _v.set(0, y, 0);
    // position
    rc.position.set(camPos.x, 2 * y - camPos.y, camPos.z);
    // looking where the camera looks, mirrored
    _m.extractRotation(camera.matrixWorld);
    _look.set(0, 0, -1).applyMatrix4(_m).add(camPos);
    _target.copy(_look);
    _target.y = 2 * y - _target.y;
    rc.up.set(0, 1, 0).applyMatrix4(_m);
    rc.up.y = -rc.up.y;
    rc.lookAt(_target);
    rc.near = camera.near;
    rc.far = camera.far;
    rc.updateMatrixWorld();
    rc.projectionMatrix.copy(camera.projectionMatrix);
    // texture matrix for the surfaces that show the reflection
    const tm = shared.uReflMatrix.value;
    tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    tm.multiply(rc.projectionMatrix);
    tm.multiply(rc.matrixWorldInverse);
    // clip everything under the mirror (oblique near plane)
    _plane.setFromNormalAndCoplanarPoint(_normal, P);
    _plane.applyMatrix4(rc.matrixWorldInverse);
    const cp = _q.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
    const pm = rc.projectionMatrix;
    const q = new THREE.Vector4((Math.sign(cp.x) + pm.elements[8]) / pm.elements[0], (Math.sign(cp.y) + pm.elements[9]) / pm.elements[5], -1.0, (1.0 + pm.elements[10]) / pm.elements[14]);
    cp.multiplyScalar(2.0 / cp.dot(q));
    pm.elements[2] = cp.x;
    pm.elements[6] = cp.y;
    pm.elements[10] = cp.z + 1.0 - 0.003;
    pm.elements[14] = cp.w;
    rc.projectionMatrixInverse.copy(pm).invert();
    // the reflective surfaces are not in their own mirror (nor the small things, nor the rooms):
    // the still city's are on their own layer already, the rest are hidden for the moment
    const hidden = this._mirrorHide || (this._mirrorHide = []);
    hidden.length = 0;
    this.hideFromMirror(this.scene, hidden);
    const keep = shared.uRefl.value;
    shared.uRefl.value = BLANK;
    shared.uMirror.value = 1;
    this.occlude(rc);
    this.r.setRenderTarget(this.reflRT);
    this.r.clear();
    this.r.render(this.scene, rc);
    this.unocclude();
    shared.uMirror.value = 0;
    shared.uRefl.value = this.reflRT.texture;
    for (const o of hidden) o.visible = true;
    void keep;
  }

  render(center) {
    const r = this.r;
    const T = this.timer;
    this.ensure();
    r.autoClear = true;
    // on a phone the mirror under the street is drawn every other frame (and so was the sun's
    // view, before the still city got a map of its own: now only what moves is drawn each frame)
    this.frameN = (this.frameN || 0) + 1;
    const every = this.low ? 2 : 1;
    const phase = this.frameN % every;
    this.trackCamera();
    if (every === 1 || this.staticRoot || phase === 0 || !this.shadowDone) {
      if (T) T.begin('shadow');
      this.renderShadows(center);
      if (T) T.end();
      this.shadowDone = true;
    }
    if (every === 1 || phase === 1 || !this.reflDone) {
      if (T) T.begin('reflection');
      this.renderReflection();
      if (T) T.end();
      this.reflDone = true;
    }
    // 3. the drawing (what is surely behind the buildings left out)
    if (T) T.begin('main');
    this.occlude(this.camera);
    r.setRenderTarget(this.gRT);
    r.clear();
    r.render(this.scene, this.camera);
    this.unocclude();
    if (T) T.end();
    // 4. the ink
    const ink = this.mInk.uniforms;
    ink.tColor.value = this.gRT.textures[0];
    ink.tAux.value = this.gRT.textures[1];
    ink.tDepth.value = this.gRT.depthTexture;
    ink.uTexel.value.set(1 / this.size.x, 1 / this.size.y);
    ink.uNear.value = this.camera.near;
    ink.uFar.value = this.camera.far;
    ink.uLineW.value = this.lineW;
    ink.uInvProj.value.copy(this.camera.projectionMatrixInverse);
    ink.uCamWorld.value.copy(this.camera.matrixWorld);
    if (T) T.begin('ink');
    this.pass(this.mInk, this.inkRT);
    if (T) T.end();
    // 5. glow
    if (T) T.begin('glow');
    const b = this.mBright.uniforms;
    b.tSrc.value = this.inkRT.texture;
    b.uTexel.value.set(1 / this.size.x, 1 / this.size.y);
    this.pass(this.mBright, this.mips[0]);
    for (let i = 1; i < this.mips.length; i++) {
      const src = this.mips[i - 1];
      this.mDown.uniforms.tSrc.value = src.texture;
      this.mDown.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.mDown, this.mips[i]);
    }
    let cur = this.mips[this.mips.length - 1];
    for (let i = this.mips.length - 2; i >= 0; i--) {
      this.mUp.uniforms.tSrc.value = cur.texture;
      this.mUp.uniforms.tAdd.value = this.mips[i].texture;
      this.mUp.uniforms.uTexel.value.set(0.5 / cur.width, 0.5 / cur.height);
      this.pass(this.mUp, this.ups[i]);
      cur = this.ups[i];
    }
    if (T) T.end();
    const f = this.mFinal.uniforms;
    f.tSrc.value = this.inkRT.texture;
    f.tBloom.value = cur.texture;
    f.uBloom.value = this.bloom;
    f.uExposure.value = this.exposure;
    f.uSrcTexel.value.set(1 / this.size.x, 1 / this.size.y);
    f.uSharp.value = this.scale < 0.99 ? 0.85 : 0.5;
    if (T) T.begin('final');
    this.pass(this.mFinal, null);
    if (this.overlay.children.length) {
      r.autoClear = false;
      r.setRenderTarget(null);
      r.clearDepth();
      r.render(this.overlay, this.camera);
      r.autoClear = true;
    }
    if (T) T.end();
  }

  // The sun's view of the whole city (for what is beyond the box around you), on two maps:
  // the first call draws one whole at once; later ones (something was rubbed out) have it drawn
  // again in the background, as the sun's going on does (updateFar)
  bakeFarShadows(root, box, size = 4096) {
    if (this.farMaps) {
      this.farDirty = true;
      return;
    }
    this.farRoot = root;
    this.farBox = box.clone();
    // a texture shaped like the city as the sun sees it now (long and low in the evening)
    sunFrame(this.shadowDir, _fx, _fy, _fz);
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      _v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      x0 = Math.min(x0, _v.dot(_fx));
      x1 = Math.max(x1, _v.dot(_fx));
      y0 = Math.min(y0, _v.dot(_fy));
      y1 = Math.max(y1, _v.dot(_fy));
    }
    const aspect = (x1 - x0) / Math.max(1, y1 - y0);
    const W = size;
    const H = Math.max(512, Math.min(size, Math.pow(2, Math.round(Math.log2(size / Math.max(1, aspect))))));
    const far = () => {
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2);
      cam.layers.enable(MIRRORLESS);
      return {
        rt: new THREE.WebGLRenderTarget(W, H, { format: THREE.RedFormat, depthBuffer: true, depthTexture: new THREE.DepthTexture(W, H) }),
        cam,
        sun: new THREE.Vector3(),
        matrix: new THREE.Matrix4(),
        slice: 0,
      };
    };
    this.farMaps = [far(), far()];
    this.farCur = null;
    const m = this.beginFar(this.shadowDir);
    this.drawFar(m, FAR_SLICES);
    this.useFar(m);
    this.r.setRenderTarget(null);
  }
}
