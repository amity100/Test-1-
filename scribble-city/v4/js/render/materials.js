import * as THREE from 'three';
import { HEAD, FUNCS, SURF_VERT, SURF_FRAG, SKY_VERT, SKY_FRAG, DEPTH_VERT, DEPTH_FRAG, LINE_VERT, LINE_FRAG, SPRITE_BATCH_VERT, SPRITE_BATCH_FRAG, MAX_LIGHTS, MAX_HOLES, MAX_OWNERS, MAX_SPOTS } from './glsl.js';

// The pens every material draws with, and the light of the sunset they draw by.

export const KIND = { wall: 0, ground: 1, street: 2, cyl: 3, box: 4, uv: 5, glass: 6, leaf: 7, neon: 8, water: 9, skin: 10, paint: 11 };

// colours are given in sRGB (as an artist picks them) and lit in linear light
export const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
export const hex = (h) => new THREE.Color(h);
// [r, g, b] in sRGB 0..1 -> linear array (for vertex colours)
export const lin3 = (r, g, b) => {
  const c = srgb(r, g, b);
  return [c.r, c.g, c.b];
};
export const hexLin = (h) => {
  const c = new THREE.Color(h);
  return [c.r, c.g, c.b];
};

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

// removable props: one texel per prop id (r: rubbed out 0..1), see world/objects.js
function objMask() {
  const t = new THREE.DataTexture(new Uint8Array(256 * 64 * 4), 256, 64, THREE.RGBAFormat);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

// people: the holes rubbed into each one (xyz world, w radius) and how far the drawing faded
function holeTexture() {
  const t = new THREE.DataTexture(new Float32Array((MAX_HOLES + 1) * MAX_OWNERS * 4), MAX_HOLES + 1, MAX_OWNERS, THREE.RGBAFormat, THREE.FloatType);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

// the layers beyond the default one: what the mirror under the street never shows, and what
// only the sun sees (a car's parts in one shape, for its shadow)
export const LAYERS = { MIRRORLESS: 1, SUN: 2 };

// the table of the pens that share draws (see mergedSurface): a row of 6 texels per pen
const TAB_W = 6;
const TAB_ROWS = 256;
function penTable() {
  const t = new THREE.DataTexture(new Float32Array(TAB_W * TAB_ROWS * 4), TAB_W, TAB_ROWS, THREE.RGBAFormat, THREE.FloatType);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

// uniforms shared by reference between every material
export const shared = {
  uNoise: { value: noiseTexture() },
  uTime: { value: 0 },
  uBoil: { value: 0 },
  uPR: { value: 1 },
  uResolution: { value: new THREE.Vector2(1280, 720) },
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
  uShadowFar: { value: blank },
  uShadowFarMatrix: { value: new THREE.Matrix4() },
  uShadowFarTexel: { value: new THREE.Vector2(1 / 4096, 1 / 1024) },
  uShadowFarOn: { value: 0 },
  // the still city's own map of the sun's view (bigger, drawn again only when you have gone far)
  uShadowStatic: { value: blank },
  uShadowStaticMatrix: { value: new THREE.Matrix4() },
  uShadowStaticTexel: { value: new THREE.Vector2(1 / 4096, 1 / 2048) },
  uShadowStaticBias: { value: 0.0012 },
  uShadowStaticOn: { value: 0 },
  uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()) },
  uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()) },
  uLightN: { value: 0 },
  uQuality: { value: 1 },
  uMirror: { value: 0 },
  uRefl: { value: blank },
  uReflMatrix: { value: new THREE.Matrix4() },
  uObjMask: { value: objMask() },
  uMatTab: { value: penTable() },
  uWErase: { value: Array.from({ length: MAX_SPOTS }, () => new THREE.Vector4(0, -1000, 0, 0)) },
  uWEraseN: { value: 0 },
  uHoles: { value: holeTexture() },
  uWind: { value: new THREE.Vector3(1, 0, 0) },
  // a drawing turning into a thing (game/materialize.js gives that thing its own): off for the rest
  uMatOn: { value: 0 },
  uMatFlat: { value: new THREE.Vector4(0, 1, 0, 0) },
  uMatK: { value: 1 },
  uMatSweep: { value: new THREE.Vector4(1, 0, 0, -1e5) },
  uMatBand: { value: new THREE.Vector4(1, 0, 0, 0) },
};

// ------------------------------------------------------------------ lights near you
// The city has hundreds of neon signs and lamps; the shaders take the ones nearest the camera.
const staticLights = [];
export function addLight(x, y, z, radius, color, intensity) {
  staticLights.push({ x, y, z, r: radius, c: color.clone ? color.clone() : new THREE.Color(color[0], color[1], color[2]), i: intensity, on: true, d: 0 });
  lastPick = { x: 1e9, z: 1e9 };
  return staticLights.length - 1;
}
export function setLightOn(i, on) {
  if (staticLights[i]) staticLights[i].on = on;
}
export function lightList() {
  return staticLights;
}
const dynLights = [];
// a light of the moment (a muzzle flash, a police car's light bar): cleared each frame
export function flashLight(x, y, z, radius, color, intensity) {
  dynLights.push({ x, y, z, r: radius, c: color, i: intensity });
}
let lastPick = { x: 1e9, z: 1e9 };
let near = [];
// The lights nearest the camera go to the shaders; one about to be dropped for a nearer one
// fades out first, so nothing ever pops.
export function pickLights(cam) {
  const cx = cam ? cam.x : 0;
  const cz = cam ? cam.z : 0;
  if (!cam || Math.hypot(cx - lastPick.x, cz - lastPick.z) > 6) {
    lastPick = { x: cx, z: cz };
    near = staticLights.filter((l) => Math.abs(l.x - cx) < 160 && Math.abs(l.z - cz) < 160);
  }
  const P = shared.uLightPos.value;
  const C = shared.uLightCol.value;
  let n = 0;
  for (const l of dynLights) {
    if (n >= MAX_LIGHTS - 4) break;
    P[n].set(l.x, l.y, l.z, l.r);
    C[n].set(l.c.r !== undefined ? l.c.r : l.c[0], l.c.g !== undefined ? l.c.g : l.c[1], l.c.b !== undefined ? l.c.b : l.c[2], l.i);
    n++;
  }
  dynLights.length = 0;
  for (const l of near) l.d = l.on ? Math.hypot(l.x - cx, l.z - cz) - l.r * 0.5 : 1e9;
  near.sort((a, b) => a.d - b.d);
  const room = MAX_LIGHTS - n;
  const cut = near.length > room ? near[room].d : 1e9;
  for (let k = 0; k < near.length && n < MAX_LIGHTS; k++) {
    const l = near[k];
    if (l.d > 1e8) break;
    const fade = Math.min(1, Math.max(0, (cut - l.d) / 10));
    if (fade <= 0) break;
    P[n].set(l.x, l.y, l.z, l.r);
    C[n].set(l.c.r, l.c.g, l.c.b, l.i * fade);
    n++;
  }
  shared.uLightN.value = n;
}

const DEF_ANG = { wall: 1.36, ground: 1.5708, street: 1.5708, cyl: 1.5708, box: 0.6, uv: 1.5708, glass: 0.9, leaf: 0.0, neon: 1.36, water: 0.02, skin: 1.5708, paint: 0.12 };

// the sun's view only needs to know where things are (and the holes in leaves)
const depthCache = new Map();
function depthMaterial(o) {
  const obj = !!o.objMask;
  if (!o.alphaTest) {
    const key = obj ? 'obj' : 'plain';
    if (!depthCache.has(key)) {
      depthCache.set(key, new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: { uMap: { value: blank }, uAlphaTest: { value: 0 }, uObjMask: shared.uObjMask },
        vertexShader: 'uniform sampler2D uObjMask;\n' + OBJ_FUNC + DEPTH_VERT,
        fragmentShader: DEPTH_FRAG,
        defines: obj ? { USE_OBJ: '' } : {},
        side: THREE.DoubleSide,
      }));
    }
    return depthCache.get(key);
  }
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { uMap: { value: o.map }, uAlphaTest: { value: o.alphaTest }, uObjMask: shared.uObjMask },
    vertexShader: 'uniform sampler2D uObjMask;\n' + OBJ_FUNC + DEPTH_VERT,
    fragmentShader: DEPTH_FRAG,
    defines: obj ? { USE_OBJ: '' } : {},
    side: THREE.DoubleSide,
  });
}
const OBJ_FUNC = /* glsl */ `
float objGone(float id) {
  if (id < 0.5) return 0.0;
  int i = int(id + 0.5);
  return texelFetch(uObjMask, ivec2(i % 256, i / 256), 0).r;
}
`;

let objSeed = 1;
const nextObj = () => {
  objSeed = (objSeed * 16807) % 2147483647;
  return (objSeed % 10000) / 10000;
};

/**
 * A surface drawn with pens.
 * kind: wall | ground | street | cyl | box | uv | glass | leaf | neon | water | skin | paint
 * color (THREE.Color, linear) or map (sRGB canvas texture); emissive; ang (stroke direction)...
 * vcolor: a colour per vertex (multiplies color); objMask: props that can be rubbed out (aObj);
 * erasable: the eraser rubs holes in it; indoor: a room under its lamps; swayAttr: batched fronds
 */
export function makeSurface(o = {}) {
  const kind = o.kind || 'wall';
  const defines = {};
  if (o.objMask) defines.USE_OBJ = '';
  if (o.swayAttr) defines.SWAY_ATTR = '';
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
      uIndoor: { value: o.indoor ? 1 : 0 },
      uErasable: { value: o.erasable ? 1 : 0 },
      uEmVColor: { value: o.emVColor ? 1 : 0 },
      uCells: { value: o.cells || 0 },
      uNeonMask: { value: o.neonMask ? 1 : 0 },
    },
    defines,
    vertexColors: !!o.vcolor,
    vertexShader: HEAD + FUNCS + SURF_VERT,
    fragmentShader: HEAD + FUNCS + SURF_FRAG,
    side: o.side || THREE.FrontSide,
  });
  m.userData.depth = o.noShadow ? null : depthMaterial(o);
  m.userData.reflective = !!o.refl;
  m.userData.kind = kind;
  return m;
}

// ------------------------------------------------------------------ many pens, one draw
// The city's plain pens (no picture of their own) share draws: a chunk's walls, glass, neon, trims
// and props become a few draws instead of thirty. Each vertex carries the row of its pen in a
// small table (uMatTab); the pens' own uniforms are written there once (penRow), and again with
// refreshPen if a pen changes (a light at night).
let penRows = 0;
export function penRow(m) {
  if (m.userData.penRow === undefined) {
    if (penRows >= TAB_ROWS) throw new Error('pen table full');
    m.userData.penRow = penRows++;
    refreshPen(m);
  }
  return m.userData.penRow;
}

export function refreshPen(m) {
  const r = m.userData.penRow;
  if (r === undefined) return;
  const u = m.uniforms;
  const t = shared.uMatTab.value;
  const d = t.image.data;
  const o = r * TAB_W * 4;
  const al = u.uAlbedo.value;
  const em = u.uEmissive.value;
  const pic = m.userData.picture || { layer: 0, size: 1 };
  d.set([al.r, al.g, al.b, u.uKind.value, em.r, em.g, em.b, u.uAng.value, u.uDensity.value, u.uWash.value, u.uGloss.value, u.uObj.value, u.uLine.value, u.uPartR.value, u.uLit.value, u.uWetK.value, u.uErasable.value, u.uEmVColor.value, 0, 0, u.uAlphaTest.value, pic.layer, pic.size, 0], o);
  t.needsUpdate = true;
}

// the shared pen for a group of plain pens like m (same side, same kind of room, same mirror):
// its own uniforms are the group's; the rest come from each vertex's row. obj: the group has
// props the eraser can rub out (aObj)
export function mergedSurface(m, { obj = false, pictures = null } = {}) {
  const defines = { ...m.defines, USE_MATTAB: '' };
  if (obj) defines.USE_OBJ = '';
  if (pictures) defines.USE_MAPSET = '';
  const c = new THREE.ShaderMaterial({
    glslVersion: m.glslVersion,
    uniforms: { ...m.uniforms },
    defines,
    vertexColors: true,
    vertexShader: m.vertexShader,
    fragmentShader: m.fragmentShader,
    side: m.side,
  });
  c.userData = { ...m.userData, merged: true };
  delete c.userData.penRow;
  delete c.userData.picture;
  if (pictures) pictures.forEach((t, i) => (c.uniforms[`uMapS${i}`] = { value: t }));
  if (m.userData.depth !== null) c.userData.depth = depthMaterial({ objMask: obj });
  return c;
}

// The pictures of pens that share a draw (up to five, see USE_MAPSET): each pen learns its number
// and its picture's size
export function penPictures(pens) {
  if (pens.length > 5) throw new Error('at most five pictures share a pen');
  return pens.map((p, i) => {
    const t = p.uniforms.uMap.value;
    p.userData.picture = { layer: i, size: t.image.width };
    return t;
  });
}

// A surface's private copy for one thing's moment (a drawing turning into it): the same pens and
// the same shader program, the shared uniforms still shared, a few of its own (extra).
export function surfaceVariant(m, extra) {
  const c = new THREE.ShaderMaterial({
    glslVersion: m.glslVersion,
    uniforms: { ...m.uniforms, ...extra },
    defines: { ...m.defines },
    vertexColors: m.vertexColors,
    vertexShader: m.vertexShader,
    fragmentShader: m.fragmentShader,
    side: m.side,
    transparent: m.transparent,
    depthWrite: m.depthWrite,
    depthTest: m.depthTest,
  });
  c.userData = { ...m.userData, depth: null };
  return c;
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

// pen lines in the world (LineBatch): blended over the drawing, never in the sun's view
export function makeLineMaterial(o = {}) {
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      ...shared,
      uWidthScale: { value: o.widthScale || 1 },
      uNudge: { value: o.nudge !== undefined ? o.nudge : 0.0008 },
      uMinWidth: { value: o.minWidth !== undefined ? o.minWidth : 0.8 },
      uGlow: { value: o.glow || 0 },
    },
    vertexShader: HEAD + FUNCS + LINE_VERT,
    fragmentShader: HEAD + FUNCS + LINE_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: o.depthTest !== undefined ? o.depthTest : true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    side: THREE.DoubleSide,
  });
  m.userData.depth = null;
  return m;
}

// pictures from an atlas (SpriteBatch)
export function makeSpriteBatchMaterial(texture, o = {}) {
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      ...shared,
      uMap: { value: texture },
      uNoFog: { value: o.noFog ? 1 : 0 },
      uNearFade: { value: o.nearFade || 0 },
      uLitByEvening: { value: o.lit === false ? 0 : 1 },
      uOpaque: { value: o.opaque ? 1 : 0 },
    },
    vertexShader: HEAD + FUNCS + SPRITE_BATCH_VERT,
    fragmentShader: HEAD + FUNCS + SPRITE_BATCH_FRAG,
    transparent: !o.opaque,
    depthWrite: !!o.opaque,
    blending: o.opaque ? THREE.NoBlending : THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    side: THREE.DoubleSide,
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
