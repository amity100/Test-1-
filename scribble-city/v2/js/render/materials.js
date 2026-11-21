import * as THREE from 'three';
import { HEAD, FUNCS, SURF_VERT, SURF_FRAG, SKY_VERT, SKY_FRAG, DEPTH_VERT, DEPTH_FRAG, MAX_LIGHTS } from './glsl.js';

// The pens every material draws with, and the light of the sunset they draw by.

export const KIND = { wall: 0, ground: 1, street: 2, cyl: 3, box: 4, uv: 5, glass: 6, leaf: 7, neon: 8, water: 9, skin: 10, paint: 11 };

// colours are given in sRGB (as an artist picks them) and lit in linear light
export const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
export const hex = (h) => new THREE.Color(h);

function noiseTexture() {
  const n = 256;
  const d = new Uint8Array(n * n * 4);
  let s = 12345;
  for (let i = 0; i < d.length; i++) {
    s = (s * 16807) % 2147483647;
    d[i] = s & 255;
  }
  const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

const blank = (() => {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
})();
export const BLANK = blank;

// uniforms shared by reference between every material
export const shared = {
  uNoise: { value: noiseTexture() },
  uTime: { value: 0 },
  uBoil: { value: 0 },
  uPR: { value: 1 },
  uSunDir: { value: new THREE.Vector3(0.3, 0.085, -1).normalize() },
  uSunCol: { value: srgb(1.0, 0.66, 0.4).multiplyScalar(1.75) },
  uSkyTop: { value: srgb(0.42, 0.32, 0.74) },
  uSkyMid: { value: srgb(1.0, 0.5, 0.42) },
  uSkyHorizon: { value: srgb(1.0, 0.62, 0.36) },
  uSkySun: { value: srgb(1.0, 0.82, 0.42) },
  uBounce: { value: srgb(0.74, 0.52, 0.44) },
  uPaper: { value: srgb(0.97, 0.94, 0.88) },
  uFogDensity: { value: 0.0004 },
  uShadowMap: { value: blank },
  uShadowMatrix: { value: new THREE.Matrix4() },
  uShadowTexel: { value: 1 / 2048 },
  uShadowOn: { value: 0 },
  uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()) },
  uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()) },
  uLightN: { value: 0 },
  uQuality: { value: 1 },
  uMirror: { value: 0 },
  uRefl: { value: blank },
  uReflMatrix: { value: new THREE.Matrix4() },
};

// a light of its own (neon sign, lamp): returns its index
export function addLight(x, y, z, radius, color, intensity) {
  const i = shared.uLightN.value;
  if (i >= MAX_LIGHTS) return -1;
  shared.uLightPos.value[i].set(x, y, z, radius);
  shared.uLightCol.value[i].set(color.r, color.g, color.b, intensity);
  shared.uLightN.value = i + 1;
  return i;
}

const DEF_ANG = { wall: 1.36, ground: 1.5708, street: 1.5708, cyl: 1.5708, box: 0.6, uv: 1.5708, glass: 0.9, leaf: 0.0, neon: 1.36, water: 0.02, skin: 1.5708, paint: 0.12 };

const sharedDepth = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3,
  uniforms: { uMap: { value: blank }, uAlphaTest: { value: 0 } },
  vertexShader: DEPTH_VERT,
  fragmentShader: DEPTH_FRAG,
  side: THREE.DoubleSide,
});

let objSeed = 1;
const nextObj = () => {
  objSeed = (objSeed * 16807) % 2147483647;
  return (objSeed % 10000) / 10000;
};

/**
 * A surface drawn with pens.
 * kind: wall | ground | street | cyl | box | uv | glass | leaf | neon | water | skin | paint
 * color (THREE.Color, linear) or map (sRGB canvas texture); emissive; ang (stroke direction)...
 */
export function makeSurface(o = {}) {
  const kind = o.kind || 'wall';
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      ...shared,
      uAlbedo: { value: o.color ? o.color.clone() : new THREE.Color(1, 1, 1) },
      uMap: { value: o.map || blank },
      uUseMap: { value: o.map ? 1 : 0 },
      uEmissive: { value: o.emissive ? o.emissive.clone() : new THREE.Color(0, 0, 0) },
      uEmMap: { value: o.emMap || blank },
      uUseEmMap: { value: o.emMap ? 1 : 0 },
      uKind: { value: KIND[kind] },
      uAng: { value: o.ang !== undefined ? o.ang : DEF_ANG[kind] },
      uDensity: { value: o.density !== undefined ? o.density : 1 },
      uWash: { value: o.wash !== undefined ? o.wash : 0.62 },
      uGloss: { value: o.gloss || 0 },
      uObj: { value: o.obj !== undefined ? o.obj : nextObj() },
      uLine: { value: o.line !== undefined ? o.line : 1 },
      uAlphaTest: { value: o.alphaTest || 0 },
      uUseRefl: { value: o.refl ? 1 : 0 },
      uUvScale: { value: o.uvScale || 1 },
      uPartR: { value: o.partR || 0.12 },
      uLit: { value: o.lit !== undefined ? o.lit : 0.4 },
      uWetK: { value: o.wet !== undefined ? o.wet : o.refl ? 0.8 : 0 },
      uSway: { value: o.sway || 0 },
    },
    vertexShader: HEAD + SURF_VERT,
    fragmentShader: HEAD + FUNCS + SURF_FRAG,
    side: o.side || THREE.FrontSide,
  });
  if (o.alphaTest) {
    const d = sharedDepth.clone();
    d.uniforms.uMap.value = o.map;
    d.uniforms.uAlphaTest.value = o.alphaTest;
    m.userData.depth = d;
  } else m.userData.depth = sharedDepth;
  m.userData.reflective = !!o.refl;
  return m;
}

export function makeSky() {
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { ...shared },
    vertexShader: HEAD + SKY_VERT,
    fragmentShader: HEAD + FUNCS + SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
  });
  m.userData.depth = null;
  return m;
}

// sRGB canvas -> texture
export function canvasTexture(c, { repeat = false, mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (!mips) {
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
  }
  return t;
}
