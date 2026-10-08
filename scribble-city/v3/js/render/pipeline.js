import * as THREE from 'three';
import { shared, BLANK } from './materials.js';
import { followSun } from './sunlight.js';

// One frame of the drawing:
//  1. the sun's view of everything that moves (the city's own shadows are baked, sunlight.js)
//  2. the city upside down in the wet street and the bay (a mirror camera)
//  3. the scene, every surface already drawn with its pens (colour + normals/ids for the outlines)
//  4. the outlines, inked over the whole picture with a hand that never quite repeats itself
//  5. the glow of the neon and the sun, the colours of the evening, sharpened up to the screen
//  6. what is drawn over the page (speech bubbles)

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
// count: 1/z is flat across a plane), a fold between two faces, the edge of another object
float edgeAt(vec2 uv, float r, out float zc) {
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
  float e = smoothstep(0.025, 0.09, lap / w0) * (0.45 + 0.55 * behind);
  vec4 al = texture(tAux, uv - ox);
  vec4 ar = texture(tAux, uv + ox);
  vec4 ad = texture(tAux, uv - oy);
  vec4 au = texture(tAux, uv + oy);
  float dn = max(max(1.0 - dot(n0, nrm(al.xy)), 1.0 - dot(n0, nrm(ar.xy))), max(1.0 - dot(n0, nrm(ad.xy)), 1.0 - dot(n0, nrm(au.xy))));
  e = max(e, smoothstep(0.1, 0.32, dn) * 0.85);
  float id = max(max(step(0.002, abs(al.z - a0.z)) * step(z0, zl + 0.08), step(0.002, abs(ar.z - a0.z)) * step(z0, zr + 0.08)),
                 max(step(0.002, abs(ad.z - a0.z)) * step(z0, zd + 0.08), step(0.002, abs(au.z - a0.z)) * step(z0, zu + 0.08)));
  e = max(e, id * 0.9);
  return e * a0.w;
}

// where in the world this pixel is (the nearest thing around it, so both sides of an outline
// agree on where it is)
vec3 worldAt(vec2 uv) {
  vec2 o = uTexel * 2.0 * uPR;
  float d = texture(tDepth, uv).r;
  d = min(d, texture(tDepth, uv + vec2(o.x, 0.0)).r);
  d = min(d, texture(tDepth, uv - vec2(o.x, 0.0)).r);
  d = min(d, texture(tDepth, uv + vec2(0.0, o.y)).r);
  d = min(d, texture(tDepth, uv - vec2(0.0, o.y)).r);
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  v /= v.w;
  return (uCamWorld * vec4(v.xyz, 1.0)).xyz;
}

void main() {
  vec4 c = texture(tColor, vUv);
  // the hand that inks the outlines wobbles: the wobble belongs to the thing it outlines, so it
  // travels with it as you walk (and, if the lines are alive, it is redrawn a few times a second)
  vec3 w = worldAt(vUv);
  vec2 q = vec2(w.x + w.y * 0.71, w.z - w.y * 0.53) * 1.7 + vec2(sin(uBoil * 1.7), cos(uBoil * 2.3)) * 0.3;
  vec2 j1 = (vec2(vn(q), vn(q + 41.0)) - 0.5) * 2.0 * uPR;
  vec2 j2 = (vec2(vn(q * 1.6 + 13.0), vn(q * 1.6 + 77.0)) - 0.5) * 2.6 * uPR;
  float z;
  float z2;
  float e1 = edgeAt(vUv + j1 * uTexel, uLineW * uPR, z);
  float e2 = edgeAt(vUv + j2 * uTexel, uLineW * uPR * 0.7, z2) * 0.55;
  float e = max(e1, e2);
  // far away the lines get thin and pale, then give way to the haze
  e *= mix(1.0, 0.35, smoothstep(40.0, 420.0, z));
  vec3 ink = mix(vec3(0.018, 0.012, 0.04), c.rgb * 0.12, 0.2);
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

const renderable = (o) => o.isMesh || o.isLine || o.isPoints || o.isSprite;

export class Pipeline {
  constructor(renderer, scene, camera, { low = false } = {}) {
    this.r = renderer;
    this.scene = scene;
    this.camera = camera;
    this.low = low;
    this.bloom = 0.42;
    this.exposure = 1.0;
    this.lineW = 1.25;
    this.reflections = !low;
    this.shadows = true;
    const ext = renderer.extensions;
    this.hdr = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
    this.type = this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
    // 1. the sun's view of what moves, around you
    const S = low ? 1024 : 2048;
    this.shadowRT = new THREE.WebGLRenderTarget(S, S, { depthBuffer: true });
    this.shadowRT.depthTexture = new THREE.DepthTexture(S, S, THREE.UnsignedIntType);
    this.shadowRT.texture.generateMipmaps = false;
    this.sunCam = new THREE.OrthographicCamera(-42, 42, 42, -42, 1, 760);
    shared.uShadowNear.value = this.shadowRT.depthTexture;
    shared.uShadowNearTexel.value = 1 / S;
    shared.uShadowNearP.value.set((84 / S) * 1.5, 0.05 / 759, 0, 0);
    // 2. the mirror
    this.reflCam = new THREE.PerspectiveCamera();
    this.mirrorY = 0;
    // 6. drawn over the finished page, in the screen's own pixels
    this.overlay = new THREE.Scene();
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
    // the drawing is made at scale x the screen's pixels and brought up to the screen sharp
    this.scale = 1;
    this.minScale = 0.5;
    this.maxScale = 1;
    this.screen = new THREE.Vector2();
    this.time = 0;
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
    shared.uResolution.value.copy(s);
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

  // the sun's view of everything that moves (people, cars, things in the air) around a point
  // ahead of you; the box follows in whole texels of the map, so the shadows' edges stay put
  renderShadows(center) {
    const sun = shared.uSunDir.value;
    const cam = this.sunCam;
    const texel = (cam.right - cam.left) / this.shadowRT.width;
    const z = _sz.copy(sun).normalize();
    const up = Math.abs(z.y) > 0.97 ? _v.set(0, 0, -1) : _up;
    const x = _sx.crossVectors(up, z).normalize();
    const y = _sy.crossVectors(z, x);
    const cx = Math.round(center.dot(x) / texel) * texel;
    const cy = Math.round(center.dot(y) / texel) * texel;
    const cz = center.dot(z);
    const snapped = _sc.copy(x).multiplyScalar(cx).addScaledVector(y, cy).addScaledVector(z, cz);
    cam.position.copy(snapped).addScaledVector(z, 380);
    cam.up.copy(up);
    cam.lookAt(snapped);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    shared.uShadowNearM.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    const swapped = [];
    this.scene.traverseVisible((o) => {
      if (!renderable(o)) return;
      const d = o.material && o.material.userData && o.material.userData.depth;
      if (d && !o.userData.staticCity && !o.userData.noShadow) {
        swapped.push([o, o.material]);
        o.material = d;
      } else {
        o.visible = false;
        swapped.push([o, null]);
      }
    });
    const on = shared.uShadowOn.value;
    shared.uShadowOn.value = 0;
    this.r.setRenderTarget(this.shadowRT);
    this.r.clear();
    this.r.render(this.scene, cam);
    for (const [o, m] of swapped) {
      if (m) o.material = m;
      else o.visible = true;
    }
    shared.uShadowOn.value = on;
  }

  // the mirror camera under the street (three.js Reflector, by hand)
  renderReflection() {
    const camera = this.camera;
    const y = this.mirrorY;
    const rc = this.reflCam;
    const camPos = camera.position;
    if (camPos.y <= y + 0.05) {
      shared.uRefl.value = BLANK;
      return;
    }
    const P = _v.set(0, y, 0);
    rc.position.set(camPos.x, 2 * y - camPos.y, camPos.z);
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
    // the wet ground is not in its own mirror; nor are the things drawn in the air
    const hidden = [];
    this.scene.traverseVisible((o) => {
      if (renderable(o) && (o.userData.noReflect || (o.material && o.material.userData && o.material.userData.noReflect))) hidden.push(o);
    });
    for (const o of hidden) o.visible = false;
    shared.uRefl.value = BLANK;
    shared.uMirror.value = 1;
    this.r.setRenderTarget(this.reflRT);
    this.r.clear();
    this.r.render(this.scene, rc);
    shared.uMirror.value = 0;
    shared.uRefl.value = this.reflRT.texture;
    for (const o of hidden) o.visible = true;
  }

  render(center) {
    const r = this.r;
    this.ensure();
    this.time += 1 / 60;
    r.autoClear = true;
    followSun(performance.now() / 1000);
    if (this.shadows) this.renderShadows(center);
    if (this.reflections) this.renderReflection();
    else shared.uRefl.value = BLANK;
    shared.uUseRefl.value = this.reflections ? 1 : 0;
    // 3. the drawing
    r.setRenderTarget(this.gRT);
    r.clear();
    r.render(this.scene, this.camera);
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
    this.pass(this.mInk, this.inkRT);
    // 5. glow
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
    const f = this.mFinal.uniforms;
    f.tSrc.value = this.inkRT.texture;
    f.tBloom.value = cur.texture;
    f.uBloom.value = this.bloom;
    f.uExposure.value = this.exposure;
    f.uSrcTexel.value.set(1 / this.size.x, 1 / this.size.y);
    f.uSharp.value = this.scale < 0.99 ? 0.85 : 0.5;
    this.pass(this.mFinal, null);
    // 6. over the page
    if (this.overlay.children.length) {
      r.autoClear = false;
      r.setRenderTarget(null);
      r.clearDepth();
      r.render(this.overlay, this.camera);
      r.autoClear = true;
    }
  }
}
