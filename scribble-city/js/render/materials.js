import * as THREE from 'three';
import { COMMON, LINE_VERT, LINE_FRAG, SURF_VERT, SURF_FRAG, SPRITE_VERT, SPRITE_FRAG, SKY_VERT, SKY_FRAG } from './shaders.js';
import { mulberry32 } from '../core/util.js';
import { makeStyleTexture, makeDistrictTexture } from './districts.js';

// Colors of the notebook world.
export const PALETTE = {
  paper: new THREE.Color(0.968, 0.958, 0.93),
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

// Uniform objects shared by reference between all sketch materials.
export const shared = {
  uNoise: { value: makeNoiseTexture() },
  uResolution: { value: new THREE.Vector2(1280, 720) },
  uPR: { value: 1 },
  uPaper: { value: PALETTE.paper },
  uRule: { value: PALETTE.rule },
  uMarginCol: { value: PALETTE.margin },
  uInk: { value: PALETTE.ink },
  uFogNear: { value: 150 },
  uFogFar: { value: 560 },
  uTime: { value: 0 },
  uBoil: { value: 0 },
  uBoilAmp: { value: 1 },
  uSunDir: { value: new THREE.Vector3(-0.45, 0.75, 0.48).normalize() },
  uLook: { value: 1 },
  uShadowMap: { value: (() => { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t; })() },
  uShadowMatrix: { value: new THREE.Matrix4() },
  uShadowOn: { value: 0 },
  uShadowTexel: { value: 1 / 2048 },
  uSunScreen: { value: new THREE.Vector3(0, 0, 0) },
  uHorizonY: { value: 0 },
  // removable props: one texel per object id (r = rubbed out 0..1), see world/objects.js
  uObjMask: { value: makeObjMask() },
  // rubbed-out spots in the city drawing (xyz centre, w radius)
  uWErase: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, -1000, 0, 0)) },
  uWEraseN: { value: 0 },
  // ---- the magic world (all off = the original look; see game/daynight.js, render/districts.js)
  uMagic: { value: 0 },
  uNight: { value: 0 }, // 0 day .. 1 night: the page turns dark and the ink glows
  uDusk: { value: 0 }, // sunset / sunrise glow on the horizon
  uSkyPaper: { value: new THREE.Color(0.968, 0.958, 0.93) }, // the page where you stand (sky, fog)
  uPage: { value: new THREE.Vector4(1, 0, 1, 0) }, // rules, grid, margin, halftone dots on that page
  uSkyHorizon: { value: new THREE.Color(1, 0.8, 0.56) },
  uSkyMid: { value: new THREE.Color(1, 0.94, 0.86) },
  uSkyZenith: { value: new THREE.Color(0.87, 0.92, 1.03) },
  uSunDisc: { value: new THREE.Vector3(-0.86, 0.47, 0.15).normalize() }, // where the drawn sun is
  uMoonDir: { value: new THREE.Vector3(0.6, 0.5, -0.6).normalize() },
  uStars: { value: 0 },
  uInvViewProj: { value: new THREE.Matrix4() },
  uLightMap: { value: (() => { const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); t.needsUpdate = true; return t; })() },
  uLightRect: { value: new THREE.Vector4(0, 0, 1, 1) }, // x0, z0, 1/width, 1/depth
  uStyleTex: { value: makeStyleTexture() },
  uDistrictTex: { value: makeDistrictTexture() },
  uWet: { value: 0 }, // puddles and dark wet paper
  uRain: { value: 0 },
  uOvercast: { value: 0 },
  uMist: { value: 0 }, // smudged-pencil fog
  uRainbow: { value: 0 },
  uWind: { value: new THREE.Vector3(1, 0, 0) }, // xz direction, strength
  uLightning: { value: 0 },
  uReveal: { value: new THREE.Vector4(0, 0, 1e5, 0) }, // the city drawing itself: centre xz, radius, on
  uCarLight: { value: new THREE.Vector4(0, 0, 0, 0) }, // headlights: x, z, yaw, on
};

function makeObjMask() {
  const t = new THREE.DataTexture(new Uint8Array(256 * 64 * 4), 256, 64, THREE.RGBAFormat);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

// Two looks for the same notebook city: the original daylight one, and golden hour
// (low sun, cast shadows drawn as hatching, warm/cool coloured pencil, lit windows).
const ORIGINAL_SUN = shared.uSunDir.value.clone();
export const GOLDEN_SUN = new THREE.Vector3(-0.86, 0.47, 0.15).normalize();
const LOOK_KEY = 'scribble-city-look';
export const look = { shadowsReady: false, onChange: null };

export function setLook(id) {
  const up = id === 1;
  shared.uLook.value = up ? 1 : 0;
  shared.uSunDir.value.copy(up ? GOLDEN_SUN : ORIGINAL_SUN);
  shared.uShadowOn.value = up && look.shadowsReady ? 1 : 0;
  try {
    localStorage.setItem(LOOK_KEY, String(shared.uLook.value));
  } catch (e) {
    // storage unavailable
  }
  if (look.onChange) look.onChange(shared.uLook.value);
}

export function savedLook() {
  try {
    const v = localStorage.getItem(LOOK_KEY);
    if (v === '0') return 0;
  } catch (e) {
    // storage unavailable
  }
  return 1;
}

export function makeLineMaterial({ widthScale = 1, nudge = 0.004, minWidth = 0.85, depthTest = true } = {}) {
  return new THREE.ShaderMaterial({
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
}

export function makeSurfaceMaterial({ hatchScale = 1, side = THREE.FrontSide } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uHatchScale: { value: hatchScale },
      uFlash: { value: 0 },
      uTintAll: { value: new THREE.Color(1, 1, 1) },
      uAlpha: { value: 1 },
    },
    vertexShader: SURF_VERT,
    fragmentShader: COMMON + SURF_FRAG,
    side,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 2,
  });
  return m;
}

// Car windows you can see the driver through.
export function makeGlassMaterial() {
  const m = makeSurfaceMaterial({ hatchScale: 1.7, side: THREE.DoubleSide });
  m.transparent = true;
  m.depthWrite = false;
  m.uniforms.uAlpha.value = 0.42;
  return m;
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
  return new THREE.ShaderMaterial({
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
    },
    vertexShader: COMMON + SPRITE_VERT,
    fragmentShader: COMMON + SPRITE_FRAG,
    transparent,
    depthWrite: !transparent,
    alphaToCoverage: !transparent,
  });
}

export function makeSkyMesh() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const m = new THREE.ShaderMaterial({
    uniforms: { ...shared },
    vertexShader: SKY_VERT,
    fragmentShader: COMMON + SKY_FRAG,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}
