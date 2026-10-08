import * as THREE from 'three';
import { COMMON, LINE_VERT, LINE_FRAG, SURF_VERT, SURF_FRAG, SURF_DEPTH_VERT, SURF_DEPTH_FRAG, SPRITE_VERT, SPRITE_FRAG, SKY_VERT, SKY_FRAG } from './shaders.js';
import { MAX_LIGHTS, PEN_HEAD, PEN_FUNCS, MRT_OUT } from './pen.js';
import { mulberry32 } from '../core/util.js';

// The materials of the new edition: everything drawn with coloured pens in the light of the
// evening (see pen.js), writing the colour and what the inker needs to draw the outlines.

const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

// Colours of the notebook (the page itself shows where the drawing is rubbed out).
export const PALETTE = {
  paper: srgb(0.97, 0.94, 0.88),
  rule: new THREE.Color(0.62, 0.74, 0.9),
  margin: new THREE.Color(0.88, 0.45, 0.45),
  ink: new THREE.Color(0.12, 0.16, 0.34),
};

function makeNoiseTexture() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const rnd = mulberry32(1234567);
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(rnd() * 256);
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const tex1 = (r, g, b, a) => {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1);
  t.needsUpdate = true;
  return t;
};
export const BLANK = tex1(255, 255, 255, 255);
const BLACK = tex1(0, 0, 0, 255);

function makeObjMask() {
  const t = new THREE.DataTexture(new Uint8Array(256 * 64 * 4), 256, 64, THREE.RGBAFormat);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

// Uniform objects shared by reference between all materials. (Some names are kept from the
// original edition so the game code that sets them keeps working.)
export const shared = {
  uNoise: { value: makeNoiseTexture() },
  uResolution: { value: new THREE.Vector2(1280, 720) },
  uPR: { value: 1 },
  uTime: { value: 0 },
  uBoil: { value: 0 },
  // the evening
  uSunDir: { value: new THREE.Vector3(0.3, 0.085, -1).normalize() },
  uSunCol: { value: srgb(1.0, 0.66, 0.4).multiplyScalar(1.75) },
  uSkyTop: { value: srgb(0.42, 0.32, 0.74) },
  uSkyMid: { value: srgb(1.0, 0.5, 0.42) },
  uSkyHorizon: { value: srgb(1.0, 0.62, 0.36) },
  uSkySun: { value: srgb(1.0, 0.82, 0.42) },
  uBounce: { value: srgb(0.74, 0.52, 0.44) },
  uPaper: { value: PALETTE.paper },
  uFogDensity: { value: 0.0016 },
  uNight: { value: 0 },
  uDusk: { value: 1 },
  uStars: { value: 0 },
  uMoonDir: { value: new THREE.Vector3(0.6, 0.5, -0.6).normalize() },
  uOvercast: { value: 0 },
  uRain: { value: 0 },
  uWet: { value: 0 },
  uMist: { value: 0 },
  uRainbow: { value: 0 },
  uWind: { value: new THREE.Vector3(1, 0, 0) },
  uLightning: { value: 0 },
  // shadows: a sharp map around you every frame, and one of the whole city baked once
  uShadowNear: { value: BLANK },
  uShadowNearM: { value: new THREE.Matrix4() },
  uShadowNearTexel: { value: 1 / 2048 },
  uShadowFar: { value: BLANK },
  uShadowFarM: { value: new THREE.Matrix4() },
  uShadowFarTexel: { value: 1 / 2048 },
  uShadowNearP: { value: new THREE.Vector4(0.06, 0.0001, 0, 0) },
  uShadowFarP: { value: new THREE.Vector4(0.3, 0.0002, 0, 0) },
  uShadowOn: { value: 0 },
  // neon and lamps near you
  uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()) },
  uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()) },
  uLightN: { value: 0 },
  uLightMap: { value: BLACK },
  uLightRect: { value: new THREE.Vector4(0, 0, 1, 1) },
  // removable props: one texel per object id (r = rubbed out 0..1), see world/objects.js
  uObjMask: { value: makeObjMask() },
  // rubbed-out spots in the city drawing (xyz centre, w radius)
  uWErase: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, -1000, 0, 0)) },
  uWEraseN: { value: 0 },
  uQuality: { value: 1 },
  uMirror: { value: 0 },
  uRefl: { value: BLANK },
  uUseRefl: { value: 1 },
  uReflMatrix: { value: new THREE.Matrix4() },
  uReveal: { value: new THREE.Vector4(0, 0, 1e5, 0) }, // the city drawing itself: centre xz, radius, on
  uCarLight: { value: new THREE.Vector4(0, 0, 0, 0) }, // headlights: x, z, yaw, on
  // kept for the game code of the original edition (not read by these shaders)
  uMagic: { value: 1 },
  uLook: { value: 1 },
  uSkyPaper: { value: new THREE.Color(0.968, 0.958, 0.93) },
  uSunDisc: { value: new THREE.Vector3(0.3, 0.085, -1).normalize() },
  uSunScreen: { value: new THREE.Vector3() },
  uHorizonY: { value: 0 },
  uInvViewProj: { value: new THREE.Matrix4() },
  uFogNear: { value: 150 },
  uFogFar: { value: 560 },
  uInk: { value: PALETTE.ink },
  uRule: { value: PALETTE.rule },
  uMarginCol: { value: PALETTE.margin },
  uPage: { value: new THREE.Vector4() },
  uSkyHorizon2: { value: new THREE.Color() },
  uBoilAmp: { value: 1 },
  uShadowMap: { value: BLANK },
  uShadowMatrix: { value: new THREE.Matrix4() },
  uShadowTexel: { value: 1 / 2048 },
};

// a light of its own (neon sign, lamp) near the camera; the list is rebuilt every frame
export function setLights(list) {
  const n = Math.min(list.length, MAX_LIGHTS);
  for (let i = 0; i < n; i++) {
    const l = list[i];
    shared.uLightPos.value[i].set(l.x, l.y, l.z, l.r);
    shared.uLightCol.value[i].set(l.col.r, l.col.g, l.col.b, l.i);
  }
  shared.uLightN.value = n;
}

// The sun of the shadows is the sun of the sky.
export const GOLDEN_SUN = shared.uSunDir.value.clone();
const LOOK_KEY = 'scribble-city-look';
export const look = { shadowsReady: false, onChange: null };
export function setLook(id) {
  try {
    localStorage.setItem(LOOK_KEY, String(id));
  } catch (e) {
    // storage unavailable
  }
  if (look.onChange) look.onChange(id);
}
export function savedLook() {
  return 1;
}

// Transparent things write their colour over what is behind them, but leave its glow and
// everything the inker reads as it was.
function overBlend(m) {
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.SrcAlphaFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
  return m;
}
function addBlend(m, glow = true) {
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.SrcAlphaFactor;
  m.blendDst = THREE.OneFactor;
  m.blendSrcAlpha = glow ? THREE.SrcAlphaFactor : THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
  return m;
}
export { overBlend, addBlend };

let matSeed = 7;
const nextMatId = () => {
  matSeed = (matSeed * 16807) % 2147483647;
  return (matSeed % 10000) / 10000;
};

export function makeLineMaterial({ widthScale = 1, nudge = 0.004, minWidth = 0.85, depthTest = true } = {}) {
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      ...shared,
      uWidthScale: { value: widthScale },
      uNudge: { value: nudge },
      uMinWidth: { value: minWidth },
    },
    vertexShader: COMMON + LINE_VERT,
    fragmentShader: COMMON + LINE_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest,
    side: THREE.DoubleSide,
  });
  m.userData.depth = null; // lines cast no shadows
  return overBlend(m);
}

// What the sun sees of a surface (for the shadows): props rubbed out of the city and the spots
// rubbed out of its walls let the light through.
let surfDepth = null;
export function surfaceDepthMaterial() {
  if (!surfDepth) {
    surfDepth = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { ...shared },
      vertexShader: COMMON + SURF_DEPTH_VERT,
      fragmentShader: COMMON + SURF_DEPTH_FRAG,
      side: THREE.DoubleSide,
    });
  }
  return surfDepth;
}

export function makeSurfaceMaterial({ side = THREE.FrontSide, indoor = false } = {}) {
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      ...shared,
      uFlash: { value: 0 },
      uTintAll: { value: new THREE.Color(1, 1, 1) },
      uAlpha: { value: 1 },
      uMatId: { value: nextMatId() },
      uIndoor: { value: indoor ? 1 : 0 },
    },
    vertexShader: COMMON + SURF_VERT,
    fragmentShader: COMMON + SURF_FRAG,
    side,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 2,
  });
  m.userData.depth = surfaceDepthMaterial();
  return m;
}

// Car windows you can see the driver through.
export function makeGlassMaterial() {
  const m = makeSurfaceMaterial({ side: THREE.DoubleSide });
  m.transparent = true;
  m.depthWrite = false;
  m.uniforms.uAlpha.value = 0.42;
  m.fragmentShader = m.fragmentShader.replace('gColor = vec4(col, clamp(lum(em) * 0.3 - 0.15, 0.0, 1.0));', 'gColor = vec4(col, uAlpha);\n  gAux = vec4(0.0);\n  return;');
  m.userData.depth = null;
  return overBlend(m);
}

const spriteGeo = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 6);
  return g;
})();

export function getSpriteGeometry() {
  return spriteGeo;
}

// Each sprite gets its own material instance so it can carry erase holes / tint.
export function makeSpriteMaterial(atlasTex, { noFog = false, transparent = false } = {}) {
  const holes = [];
  for (let i = 0; i < 8; i++) holes.push(new THREE.Vector4(0, 0, 0, 0));
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      ...shared,
      uMap: { value: atlasTex },
      uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
      uSize: { value: new THREE.Vector2(1, 1) },
      uPivot: { value: new THREE.Vector2(0.5, 0) },
      uMode: { value: 0 },
      uFlip: { value: 0 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uAlpha: { value: 1 },
      uHoles: { value: holes },
      uErase: { value: 0 },
      uNoFog: { value: noFog ? 1 : 0 },
      uWhiten: { value: 0 },
      uNightMode: { value: 0 },
      uOpaque: { value: transparent ? 0 : 1 },
    },
    vertexShader: COMMON + SPRITE_VERT,
    fragmentShader: COMMON + SPRITE_FRAG,
    transparent,
    depthWrite: !transparent,
  });
  m.userData.depth = null;
  return transparent ? overBlend(m) : m;
}

// The sky: a big sphere around the camera.
export function makeSkyMesh() {
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { ...shared },
    vertexShader: COMMON + SKY_VERT,
    fragmentShader: COMMON + SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
  });
  m.userData.depth = null;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.userData.sky = true;
  return mesh;
}

/**
 * Bring a small GLSL 1 effect shader (rain, cones of light, laundry...) into the new frame: it
 * writes its colour and leaves the inker's target alone. blend: 'opaque' | 'over' | 'add'.
 */
export function mrt(m, blend = 'over', glow = true) {
  m.glslVersion = THREE.GLSL3;
  const vs = m.vertexShader.replace(/\battribute\s/g, 'in ').replace(/\bvarying\s/g, 'out ').replace(/texture2D\(/g, 'texture(');
  let fs = m.fragmentShader.replace(/\bvarying\s/g, 'in ').replace(/texture2D\(/g, 'texture(').replace(/gl_FragColor/g, 'gColor');
  if (blend === 'opaque') {
    // its alpha is the glow for the bloom: none, unless the shader asks for it later
    fs = fs.replace(/void\s+main\s*\(\s*\)\s*\{/, 'void main_() {') + '\nvoid main() {\n  gAux = vec4(0.0);\n  main_();\n  gColor.a = 0.0;\n}\n';
  } else fs = fs.replace(/void\s+main\s*\(\s*\)\s*\{/, 'void main() {\n  gAux = vec4(0.0);');
  m.vertexShader = vs;
  m.fragmentShader = MRT_OUT + fs;
  m.userData.depth = null;
  if (blend === 'over') overBlend(m);
  else if (blend === 'add') addBlend(m, glow);
  m.needsUpdate = true;
  return m;
}

export { PEN_HEAD, PEN_FUNCS };
