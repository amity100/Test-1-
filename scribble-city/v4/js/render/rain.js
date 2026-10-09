import * as THREE from 'three';
import { shared, BLANK } from './materials.js';
import { HEAD, FUNCS } from './glsl.js';

// The rain (game/weather.js), drawn over the inked picture: slanted pen strokes falling in a box
// around the camera, and little crowns where the drops land - on whatever is flat and in the
// open where they land (the street, the sidewalk, a car's roof), found in the drawing's own
// depth and normals. Two draws, on the GPU; the CPU sets a few numbers.
//
// They are drawn after the outlines (render/pipeline.js afterInk), so no outline goes round a
// drop; what is in front of a drop hides it (each one looks up the drawing's depth itself).
// Nothing falls or splashes under a roof: the still city is drawn now and then from straight
// above, around you (the roofs' map: its depth is the highest thing over each spot), and a drop
// below that is under an awning, a building, a palm.

const ROOF = /* glsl */ `
uniform highp sampler2D uRoof;
uniform mat4 uRoofMatrix;
uniform float uRoofOn;
bool underRoof(vec3 p) {
  if (uRoofOn < 0.5) return false;
  vec4 c = uRoofMatrix * vec4(p, 1.0);
  vec3 s = c.xyz / c.w * 0.5 + 0.5;
  if (s.x <= 0.0 || s.x >= 1.0 || s.y <= 0.0 || s.y >= 1.0) return false;
  return s.z > textureLod(uRoof, s.xy, 0.0).r + 0.0005;
}
`;

const RAIN_VERT = /* glsl */ `
in vec4 iDrop; // x, z in the box (0..1), when it falls, its length and pen
uniform float uSpan;
uniform float uHeight;
uniform float uSpeed;
uniform float uLen;
uniform float uWidth;
out float vSide;
flat out float vHalfW;
out float vT;
flat out float vFade;
flat out float vPen;
void main() {
  vec2 rel = fract((iDrop.xy * uSpan - cameraPosition.xz) / uSpan + 0.5) - 0.5;
  vec2 xz = cameraPosition.xz + rel * uSpan;
  float fall = fract(iDrop.z + uTime * uSpeed / uHeight);
  // the wind blows it aslant (and from upwind, so it still lands round you)
  vec3 wdir = vec3(uWind.x, 0.0, uWind.y) * (0.1 + 0.55 * uWind.z);
  vec3 dir = normalize(vec3(wdir.x, -1.0, wdir.z));
  vec3 P0 = vec3(xz.x, cameraPosition.y + uHeight * 0.55, xz.y) - wdir * uHeight * 0.5;
  vec3 head = P0 + dir * (fall * uHeight / -dir.y);
  float len = (0.55 + 0.9 * fract(iDrop.w * 7.0)) * uLen;
  vec3 tail = head - dir * len;
  vec4 cA = projectionMatrix * viewMatrix * vec4(tail, 1.0);
  vec4 cB = projectionMatrix * viewMatrix * vec4(head, 1.0);
  if (cA.w < 0.2 || cB.w < 0.2 || underRoof(head)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec3 W = mix(tail, head, position.x);
  vec4 cP = projectionMatrix * viewMatrix * vec4(W, 1.0);
  vec2 sd = cB.xy / cB.w * uResolution * 0.5 - cA.xy / cA.w * uResolution * 0.5;
  float sl = length(sd);
  vec2 sdir = sl > 1e-4 ? sd / sl : vec2(0.0, 1.0);
  vec2 nrm = vec2(-sdir.y, sdir.x);
  float dist = length((viewMatrix * vec4(W, 1.0)).xyz);
  float wpx = mix(2.2, 1.0, smoothstep(2.0, 18.0, dist)) * uWidth * uPR;
  float hw = wpx * 0.5 + 0.8;
  cP.xy += nrm * position.y * hw / (uResolution * 0.5) * cP.w;
  gl_Position = cP;
  vSide = position.y * hw;
  vHalfW = wpx * 0.5;
  vT = position.x;
  // (the near ones would be big smears; the far edge of the box fades out)
  vFade = (1.0 - smoothstep(uSpan * 0.3, uSpan * 0.5, length(rel * uSpan))) * smoothstep(1.4, 4.5, dist);
  vPen = step(0.62, fract(iDrop.w * 13.0));
}`;

const RAIN_FRAG = /* glsl */ `
uniform highp sampler2D tDepth;
uniform vec3 uPenA;
uniform vec3 uPenB;
uniform float uAlpha;
in float vSide;
flat in float vHalfW;
in float vT;
flat in float vFade;
flat in float vPen;
layout(location = 0) out vec4 fragColor;
void main() {
  // behind something in the drawing: hidden
  if (gl_FragCoord.z > texelFetch(tDepth, ivec2(gl_FragCoord.xy), 0).r) discard;
  float a = clamp(vHalfW + 0.5 - abs(vSide), 0.0, 1.0);
  // a pen stroke: thin where it starts, full where the drop is
  a *= smoothstep(0.0, 0.3, vT) * (0.4 + 0.6 * vT);
  a *= vFade * uAlpha;
  if (a < 0.01) discard;
  fragColor = vec4(vPen > 0.5 ? uPenB : uPenA, a);
}`;

const SPLASH_VERT = /* glsl */ `
in vec4 iSplash;
uniform highp sampler2D tDepth;
uniform highp sampler2D tAux;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform float uRate;
uniform float uSize;
out vec2 vQ;
flat out float vPh;
flat out float vFade;
void main() {
  float t = uTime * uRate + iSplash.z;
  float cyc = floor(t);
  vPh = t - cyc;
  // each time round a new place: a point of the drawing, if it is flat, near, and the sky's
  vec2 uv = vec2(h11(cyc * 1.31 + iSplash.x * 97.0), h11(cyc * 2.17 + iSplash.y * 61.0));
  ivec2 px = ivec2(uv * uResolution);
  float d = texelFetch(tDepth, px, 0).r;
  vec4 aux = texelFetch(tAux, px, 0);
  vec2 nxy = aux.xy * 2.0 - 1.0;
  vec3 nv = vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy))));
  vec3 nw = mat3(uCamWorld) * nv;
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  v /= v.w;
  float dist = -v.z;
  vFade = 1.0 - smoothstep(16.0, 30.0, dist);
  if (d >= 1.0 || vPh > 0.28 || nw.y < 0.8 || vFade <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec3 wp = (uCamWorld * vec4(v.xyz, 1.0)).xyz;
  if (underRoof(wp + vec3(0.0, 0.12, 0.0))) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  // a little card standing on the spot, turned to the camera
  vec2 tc = normalize(cameraPosition.xz - wp.xz + vec2(1e-4));
  vec3 right = vec3(tc.y, 0.0, -tc.x);
  float s = uSize * (0.7 + 0.6 * iSplash.w);
  vec3 W = wp + right * position.x * s + vec3(0.0, position.y * s + 0.01, 0.0);
  vQ = position.xy;
  gl_Position = projectionMatrix * viewMatrix * vec4(W, 1.0);
}`;

const SPLASH_FRAG = /* glsl */ `
uniform highp sampler2D tDepth;
uniform vec3 uPenA;
uniform float uAlpha;
in vec2 vQ;
flat in float vPh;
flat in float vFade;
layout(location = 0) out vec4 fragColor;
float segD(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
void main() {
  if (gl_FragCoord.z > texelFetch(tDepth, ivec2(gl_FragCoord.xy), 0).r + 0.00002) discard;
  float k = vPh / 0.28;
  vec2 p = vQ;
  float w = max(fwidth(p.x), 1e-4);
  float d = 9.0;
  // a crown of drops flying up and out
  for (int i = 0; i < 4; i++) {
    float an = (float(i) - 1.5) * 0.5;
    vec2 dir = vec2(sin(an), cos(an));
    d = min(d, segD(p, dir * (0.12 + 0.4 * k), dir * (0.3 + 0.62 * k)));
  }
  // and a flat ring spreading on the ground
  d = min(d, abs(length(vec2(p.x, p.y * 4.5)) - (0.15 + 0.75 * k)) * 0.45);
  float a = (1.0 - smoothstep(w * 0.7, w * 1.6, d)) * (1.0 - k) * vFade * uAlpha;
  if (a < 0.03) discard;
  fragColor = vec4(uPenA, a * 0.85);
}`;

const quad = (x0, x1, y0, y1) => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
};

// (dice of their own: the city's own rolls stay as they were)
let seed = 4321;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const randAttr = (n) => {
  const a = new Float32Array(n * 4);
  for (let i = 0; i < a.length; i++) a[i] = rnd();
  return new THREE.InstancedBufferAttribute(a, 4);
};

const _a = new THREE.Color();
const _p = new THREE.Vector3();
// the roofs' map: metres across, the height it looks down from, how far you go before the next is
// drawn, and in how many slices
const ROOF_SPAN = 128;
const ROOF_TOP = 320;
const ROOF_MOVE = 26;
const ROOF_SLICES = 4;

export class RainRenderer {
  constructor(game) {
    this.game = game;
    const pipe = game.pipe;
    const touch = !!game.touch;
    this.dropN = touch ? 2200 : 4000;
    this.splashN = touch ? 160 : 320;
    const ink = pipe.mInk.uniforms;
    const own = {
      uPenA: { value: new THREE.Color() },
      uPenB: { value: new THREE.Color() },
      // the drawing's depth and normals, and the way back from the screen into the world
      // (the very uniforms of the outlines' pass: render/pipeline.js sets them every frame)
      tDepth: ink.tDepth,
      tAux: ink.tAux,
      uInvProj: ink.uInvProj,
      uCamWorld: ink.uCamWorld,
      // the roofs' map in use
      uRoof: { value: BLANK },
      uRoofMatrix: { value: new THREE.Matrix4() },
      uRoofOn: { value: 0 },
    };
    this.own = own;
    // the roofs: two maps of the still city seen from straight above (the one in use and the
    // next, drawn a quarter at a time as you go)
    const R = touch ? 512 : 1024;
    const map = () => {
      const cam = new THREE.OrthographicCamera(-ROOF_SPAN / 2, ROOF_SPAN / 2, ROOF_SPAN / 2, -ROOF_SPAN / 2, 1, ROOF_TOP + 100);
      cam.layers.enableAll();
      return { rt: new THREE.WebGLRenderTarget(R, R, { format: THREE.RedFormat, depthBuffer: true, depthTexture: new THREE.DepthTexture(R, R) }), cam, x: 0, z: 0, ver: -1, slice: 0, matrix: new THREE.Matrix4() };
    };
    this.roofs = [map(), map()];
    this.roofCur = null;
    this.roofBuild = null;
    this.roofBuilt = 0;
    const mk = (vert, frag, extra) =>
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: { ...shared, ...own, ...extra },
        vertexShader: HEAD + FUNCS + ROOF + vert,
        fragmentShader: HEAD + FUNCS + frag,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.ZeroFactor,
        blendDstAlpha: THREE.OneFactor,
      });
    // the drops: a strip each (along 0..1, across -1..1)
    const rg = quad(0, 1, -1, 1);
    rg.setAttribute('iDrop', randAttr(this.dropN));
    rg.instanceCount = 0;
    this.dropMat = mk(RAIN_VERT, RAIN_FRAG, { uSpan: { value: 36 }, uHeight: { value: 22 }, uSpeed: { value: 15 }, uLen: { value: 1 }, uWidth: { value: 1 }, uAlpha: { value: 1 } });
    this.drops = new THREE.Mesh(rg, this.dropMat);
    // the crowns where they land: a card each
    const sg = quad(-1, 1, -0.3, 1);
    sg.setAttribute('iSplash', randAttr(this.splashN));
    sg.instanceCount = 0;
    this.splashMat = mk(SPLASH_VERT, SPLASH_FRAG, { uRate: { value: 1.7 }, uSize: { value: 0.13 }, uAlpha: { value: 1 } });
    this.splash = new THREE.Mesh(sg, this.splashMat);
    for (const m of [this.drops, this.splash]) {
      m.frustumCulled = false;
      m.visible = false;
      pipe.afterInk.add(m);
    }
  }

  // rain: how hard (0..1); hidden: the camera is in a room (until the roofs' map is drawn)
  update(rain, hidden) {
    const on = rain > 0.01 && (!hidden || !!this.roofCur);
    this.drops.visible = on;
    this.splash.visible = on && rain > 0.2;
    if (!on) return;
    this.updateRoofs();
    const s = Math.min(1, rain);
    this.drops.geometry.instanceCount = Math.round(this.dropN * (0.25 + 0.75 * s));
    this.splash.geometry.instanceCount = Math.round(this.splashN * s);
    const u = this.dropMat.uniforms;
    // a drizzle: short, thin, slow strokes; a downpour: long and quick
    u.uLen.value = 0.45 + 0.75 * s;
    u.uWidth.value = 0.75 + 0.35 * s;
    u.uSpeed.value = 10 + 7 * s;
    u.uAlpha.value = 0.55 + 0.4 * s;
    this.splashMat.uniforms.uAlpha.value = 0.35 + 0.4 * s;
    // the pens: a pale one that catches the sky, and a darker one in its colour; at night the
    // strokes catch the street lamps
    const A = u.uPenA.value;
    A.copy(shared.uPaper.value).lerp(shared.uSkyHorizon.value, 0.25).multiplyScalar(0.92);
    _a.setRGB(0.32, 0.36, 0.5);
    A.r = Math.max(A.r, _a.r);
    A.g = Math.max(A.g, _a.g);
    A.b = Math.max(A.b, _a.b);
    u.uPenB.value.copy(shared.uSkyTop.value).multiplyScalar(0.55).add(_a.setRGB(0.04, 0.05, 0.09));
  }

  // the roofs over you: drawn again (in the background, a quarter of the still city a frame)
  // once you have gone some way from where they were drawn, or something was rubbed out; all at
  // once when there is no map of here yet
  updateRoofs() {
    const pipe = this.game.pipe;
    const root = pipe.staticRoot;
    if (!root) return;
    const cam = this.game.camera.position;
    const ver = pipe.staticVersion ? pipe.staticVersion() : 0;
    const cur = this.roofCur;
    const off = cur ? Math.max(Math.abs(cam.x - cur.x), Math.abs(cam.z - cur.z)) : Infinity;
    let b = this.roofBuild;
    if (!b && (off > ROOF_MOVE || cur.ver !== ver)) b = this.beginRoofs(cam, ver);
    if (!b) return;
    const n = off > ROOF_SPAN / 2 - 20 ? ROOF_SLICES : 1;
    for (let k = 0; k < n && b.slice < ROOF_SLICES; k++) {
      if (pipe.staticCull) pipe.staticCull(_p.set(b.x, cam.y, b.z));
      pipe.drawSlice(root, b.slice, ROOF_SLICES, b.rt, b.cam);
      if (pipe.staticCull) pipe.staticCull(cam);
      b.slice++;
    }
    this.game.renderer.setRenderTarget(null);
    if (b.slice < ROOF_SLICES) return;
    this.roofCur = b;
    this.roofBuild = null;
    this.roofBuilt++;
    this.own.uRoof.value = b.rt.depthTexture;
    this.own.uRoofMatrix.value.copy(b.matrix);
    this.own.uRoofOn.value = 1;
  }

  beginRoofs(at, ver) {
    const b = this.roofs[0] === this.roofCur ? this.roofs[1] : this.roofs[0];
    b.x = at.x;
    b.z = at.z;
    b.ver = ver;
    b.slice = 0;
    const cam = b.cam;
    cam.position.set(b.x, ROOF_TOP, b.z);
    cam.up.set(0, 0, -1);
    cam.lookAt(b.x, 0, b.z);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    b.matrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.roofBuild = b;
    return b;
  }
}
