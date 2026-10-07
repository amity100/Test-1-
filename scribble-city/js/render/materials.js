import * as THREE from 'three';
import { COMMON, LINE_VERT, LINE_FRAG, SURF_VERT, SURF_FRAG, SPRITE_VERT, SPRITE_FRAG, SKY_VERT, SKY_FRAG } from './shaders.js';
import { mulberry32 } from '../core/util.js';

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
};

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
