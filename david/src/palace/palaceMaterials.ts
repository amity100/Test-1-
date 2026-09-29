import * as THREE from 'three';
import { shared } from '../core/Shared';
import type { TextureSet } from '../world/Textures';
// Saul's house textures (tools/palace/gen_palace_textures.py): albedo *_a (sRGB), normal *_n (OpenGL, RGB)
import plasterA from '../assets/palace/plaster_a.webp';
import plasterN from '../assets/palace/plaster_n.webp';
import woodA from '../assets/palace/wood_a.webp';
import woodN from '../assets/palace/wood_n.webp';
import floorA from '../assets/palace/floor_a.webp';
import floorN from '../assets/palace/floor_n.webp';
import textileA from '../assets/palace/textile_a.webp';
import weaveN from '../assets/palace/weave_n.webp';
import tamariskA from '../assets/palace/tamarisk.webp';
import clayA from '../assets/palace/clay_a.webp';
import clayN from '../assets/palace/clay_n.webp';
import fleeceA from '../assets/palace/fleece_a.webp';
import fleeceN from '../assets/palace/fleece_n.webp';
import reedA from '../assets/palace/reed_a.webp';
import reedN from '../assets/palace/reed_n.webp';

export type PalaceTier = 'low' | 'medium' | 'high';

export interface PalaceTextures {
  plaster: THREE.Texture; plasterN: THREE.Texture;
  wood: THREE.Texture; woodN: THREE.Texture;
  floor: THREE.Texture; floorN: THREE.Texture;
  /** 2x2 atlas: 0 = royal hanging (scarlet/purple/blue bands), 1 = kilim rug, 2 = argaman cushion, 3 = cream mantle */
  textile: THREE.Texture; weaveN: THREE.Texture;
  tamarisk: THREE.Texture;
  clay: THREE.Texture; clayN: THREE.Texture;
  fleece: THREE.Texture; fleeceN: THREE.Texture;
  reed: THREE.Texture; reedN: THREE.Texture;
}

/** Loads the palace textures. `max` caps the edge (phones: 512 for secondary maps). Resolves when all decoded. */
export function loadPalaceTextures(renderer: THREE.WebGLRenderer, tier: PalaceTier, texMax: number, anisotropy: number): { tex: PalaceTextures; ready: Promise<void> } {
  const manager = new THREE.LoadingManager();
  const loader = new THREE.TextureLoader(manager);
  const aniso = Math.min(anisotropy, renderer.capabilities.getMaxAnisotropy());
  const cap = Math.min(texMax, tier === 'low' ? 512 : 1024);
  const load = (url: string, srgb: boolean, max = cap, name = '') => {
    const t = loader.load(url, (tex) => {
      const img = tex.image as HTMLImageElement;
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (Math.max(w, h) > max) {
        const s = max / Math.max(w, h);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * s));
        c.height = Math.max(1, Math.round(h * s));
        const g = c.getContext('2d');
        if (g) {
          g.imageSmoothingQuality = 'high';
          g.drawImage(img, 0, 0, c.width, c.height);
          tex.image = c;
          tex.needsUpdate = true;
        }
      }
    });
    t.name = 'palace.' + name;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
  };
  const tex: PalaceTextures = {
    plaster: load(plasterA, true, cap, 'plaster'), plasterN: load(plasterN, false, cap, 'plasterN'),
    wood: load(woodA, true, cap, 'wood'), woodN: load(woodN, false, cap, 'woodN'),
    floor: load(floorA, true, cap, 'floor'), floorN: load(floorN, false, cap, 'floorN'),
    textile: load(textileA, true, Math.min(texMax, 1024), 'textile'), weaveN: load(weaveN, false, 256, 'weaveN'),
    tamarisk: load(tamariskA, true, Math.min(texMax, tier === 'low' ? 512 : 1024), 'tamarisk'),
    clay: load(clayA, true, 512, 'clay'), clayN: load(clayN, false, 512, 'clayN'),
    fleece: load(fleeceA, true, 512, 'fleece'), fleeceN: load(fleeceN, false, 512, 'fleeceN'),
    reed: load(reedA, true, 512, 'reed'), reedN: load(reedN, false, 512, 'reedN'),
  };
  // alpha-tested foliage atlas: no wrapping, keep its alpha (never resampled through a canvas by the engine)
  tex.tamarisk.wrapS = tex.tamarisk.wrapT = THREE.ClampToEdgeWrapping;
  tex.textile.wrapS = tex.textile.wrapT = THREE.ClampToEdgeWrapping;
  const ready = new Promise<void>((resolve) => {
    manager.onLoad = () => resolve();
    manager.onError = (u) => {
      console.warn('[palace] texture failed', u);
    };
  });
  return { tex, ready };
}

// =====================================================================================================
// Interior lighting model
// =====================================================================================================
/**
 * Uniforms shared by every interior material. Inside a closed Iron Age hall the sky is visible only through
 * the doorway and a few small windows, so the scene's sky ambient (hemisphere light + sky PMREM) is scaled
 * down to `uSkyVis` (plus a soft lobe around the doorway) and tinted by the warm bounce of the sunlit floor
 * and courtyard. Direct light (sun through the openings, lamps, brazier) is untouched.
 */
export const palaceUniforms = {
  uSkyVis: { value: 0.1 },
  uDoorPos: { value: new THREE.Vector3() },
  uDoorVis: { value: 0.55 },
  uBounce: { value: new THREE.Color(1.0, 0.8, 0.62) },
  /** y (world) where ceiling soot starts / is full */
  uSoot: { value: new THREE.Vector2(3.2, 5.0) },
  /** floor level of the hall (world y) */
  uFloorY: { value: 0 },
  uTime: shared.uTime,
};

export interface InteriorOptions {
  /** geometry carries a float `aAO` attribute (baked cavity / corner occlusion) */
  vertexAO?: boolean;
  /** darken toward the ceiling (lamp and brazier soot) */
  soot?: number;
  key: string;
}

/**
 * Patches a standard / physical material for the interior lighting model (see palaceUniforms). Chains an
 * existing onBeforeCompile (e.g. the world rock material).
 */
export function interiorize<T extends THREE.MeshStandardMaterial>(mat: T, o: InteriorOptions): T {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = (s, r) => {
    prev.call(mat, s, r);
    s.uniforms.uSkyVis = palaceUniforms.uSkyVis;
    s.uniforms.uDoorPos = palaceUniforms.uDoorPos;
    s.uniforms.uDoorVis = palaceUniforms.uDoorVis;
    s.uniforms.uBounce = palaceUniforms.uBounce;
    s.uniforms.uSoot = palaceUniforms.uSoot;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vIntWPos;
${o.vertexAO ? 'attribute float aAO; varying float vIntAO;' : ''}`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
{
  vec4 iwp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  iwp = instanceMatrix * iwp;
  #endif
  vIntWPos = (modelMatrix * iwp).xyz;
  ${o.vertexAO ? 'vIntAO = aAO;' : ''}
}`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uSkyVis; uniform vec3 uDoorPos; uniform float uDoorVis; uniform vec3 uBounce; uniform vec2 uSoot;
varying vec3 vIntWPos;
${o.vertexAO ? 'varying float vIntAO;' : ''}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
${o.soot ? `diffuseColor.rgb *= 1.0 - ${o.soot.toFixed(3)} * smoothstep(uSoot.x, uSoot.y, vIntWPos.y);` : ''}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
{
  float dd = length(vIntWPos - uDoorPos);
  float vis = uSkyVis + uDoorVis * exp(-dd * 0.45);
  float ao = ${o.vertexAO ? 'vIntAO' : '1.0'};
  reflectedLight.indirectDiffuse *= uBounce * vis * ao;
  reflectedLight.indirectSpecular *= vis * ao;
  ${o.vertexAO ? 'reflectedLight.directDiffuse *= mix(1.0, ao, 0.35);' : ''}
}`);
  };
  mat.customProgramCacheKey = () => `${prevKey}|int-${o.key}-${o.vertexAO ? 1 : 0}-${o.soot ?? 0}`;
  return mat;
}

// =====================================================================================================
// Exterior masonry (fortress, towers, houses): world-space triplanar fieldstone with mud mortar, optional
// vertex displacement from the height in the albedo alpha (tessellated walls on medium / high).
// =====================================================================================================
export function masonryMaterial(world: TextureSet, opts: { scale: number; displace: number; tint?: number; plaster?: number; key: string }) {
  const mat = new THREE.MeshStandardMaterial({ color: opts.tint ?? 0xffffff, roughness: 0.9, metalness: 0 });
  mat.onBeforeCompile = (s) => {
    s.uniforms.tMas = { value: world.masonry };
    s.uniforms.tMasN = { value: world.masonryN };
    s.uniforms.tPl = { value: world.soil };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tMas;
varying vec3 vMWPos; varying vec3 vMWNormal;
${opts.displace > 0 ? 'attribute float aDisp;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  vec4 mwp = modelMatrix * vec4(transformed, 1.0);
  vec3 mwn = normalize(mat3(modelMatrix) * objectNormal);
  ${opts.displace > 0 ? `
  vec3 bw = pow(abs(mwn), vec3(6.0)); bw /= (bw.x + bw.y + bw.z);
  vec3 p = mwp.xyz / ${opts.scale.toFixed(3)};
  float hgt = textureLod(tMas, p.zy, 0.0).a * bw.x + textureLod(tMas, p.xy, 0.0).a * bw.z + textureLod(tMas, p.xz, 0.0).a * bw.y;
  transformed += objectNormal * (hgt - 0.55) * ${opts.displace.toFixed(3)} * aDisp;` : ''}
}`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
vMWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vMWNormal = normalize(mat3(modelMatrix) * objectNormal);`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tMas; uniform sampler2D tMasN; uniform sampler2D tPl;
varying vec3 vMWPos; varying vec3 vMWNormal;
vec3 masWN; float masAO;
float mHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }`)
      .replace('#include <map_fragment>', `{
  vec3 Nw = normalize(vMWNormal);
  vec3 bw = pow(abs(Nw), vec3(6.0)); bw /= (bw.x + bw.y + bw.z);
  vec3 p = vMWPos / ${opts.scale.toFixed(3)};
  vec4 ax = texture2D(tMas, p.zy), ay = texture2D(tMas, p.xz), az = texture2D(tMas, p.xy);
  vec4 nx = texture2D(tMasN, p.zy), ny = texture2D(tMasN, p.xz), nz = texture2D(tMasN, p.xy);
  vec3 c = ax.rgb * bw.x + ay.rgb * bw.y + az.rgb * bw.z;
  float hgt = ax.a * bw.x + ay.a * bw.y + az.a * bw.z;
  masAO = nx.a * bw.x + ny.a * bw.y + nz.a * bw.z;
  // large-scale colour variation (repairs, sun bleaching), soil splash at the foot of the walls
  vec3 cp = floor(vMWPos * vec3(0.35, 0.5, 0.35));
  c *= mix(0.9, 1.08, mHash(cp)) * mix(vec3(1.0), vec3(1.05, 1.0, 0.93), mHash(cp + 7.0));
  ${opts.plaster ? `
  // remains of mud plaster in the mortar-rich, recessed parts
  vec3 pl = texture2D(tPl, p.xz * 0.37 + p.y * 0.21).rgb * vec3(1.25, 1.12, 1.0);
  float plm = smoothstep(0.62, 0.35, hgt) * ${opts.plaster.toFixed(2)};
  c = mix(c, pl * vec3(0.95, 0.85, 0.72), plm);` : ''}
  diffuseColor.rgb *= c;
  vec3 tnx = nx.xyz * 2.0 - 1.0, tny = ny.xyz * 2.0 - 1.0, tnz = nz.xyz * 2.0 - 1.0;
  masWN = normalize(bw.x * normalize(Nw + vec3(0.0, tnx.y, tnx.x) * 1.2) + bw.y * normalize(Nw + vec3(tny.x, 0.0, tny.y) * 1.2) + bw.z * normalize(Nw + vec3(tnz.x, tnz.y, 0.0) * 1.2));
}`)
      .replace('#include <normal_fragment_maps>', `normal = normalize((viewMatrix * vec4(masWN, 0.0)).xyz);`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
reflectedLight.indirectDiffuse *= masAO;
reflectedLight.directDiffuse *= mix(1.0, masAO, 0.4);`)
      ;
  };
  mat.customProgramCacheKey = () => `palace-masonry-${opts.key}-${opts.scale}-${opts.displace}-${opts.plaster ?? 0}`;
  return mat;
}

/** Flat roofs of beaten clay over branches (seen from above in the aerial shots). */
export function roofMaterial(world: TextureSet) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8c2a0, roughness: 0.97, metalness: 0 });
  mat.onBeforeCompile = (s) => {
    s.uniforms.tSoil = { value: world.soil };
    s.uniforms.tGr = { value: world.grass };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vRfW;`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
{
  vec4 rw = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  rw = instanceMatrix * rw;
  #endif
  vRfW = (modelMatrix * rw).xyz;
}`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tSoil; uniform sampler2D tGr; varying vec3 vRfW;`)
      .replace('#include <map_fragment>', `{
  vec3 a = texture2D(tSoil, vRfW.xz * 0.23).rgb;
  vec3 g = texture2D(tGr, vRfW.xz * 0.31).rgb;
  float m = smoothstep(0.35, 0.75, texture2D(tSoil, vRfW.xz * 0.05).a);
  vec3 c = mix(a * vec3(1.35, 1.2, 1.05), g, m * 0.45);
  diffuseColor.rgb *= c;
}`);
  };
  mat.customProgramCacheKey = () => 'palace-roof';
  return mat;
}

// =====================================================================================================
// Interior / prop materials
// =====================================================================================================
export interface PalaceMaterials {
  plaster: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  beam: THREE.MeshStandardMaterial;
  beamExt: THREE.MeshStandardMaterial;
  reed: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  clay: THREE.MeshStandardMaterial;
  clayDark: THREE.MeshStandardMaterial;
  fleece: THREE.MeshStandardMaterial;
  leather: THREE.MeshStandardMaterial;
  bronze: THREE.MeshStandardMaterial;
  iron: THREE.MeshStandardMaterial;
  bread: THREE.MeshStandardMaterial;
  olive: THREE.MeshStandardMaterial;
  coal: THREE.MeshStandardMaterial;
  /** textile atlas cells 0..3 (see PalaceTextures.textile) */
  textile: THREE.MeshStandardMaterial[];
  masonry: THREE.MeshStandardMaterial;
  masonryFlat: THREE.MeshStandardMaterial;
  houses: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  plasterExt: THREE.MeshStandardMaterial;
}

/** Cloth: atlas cell sampling with seamless wrap (textureGrad), weave micro-normal, slow draft sway. */
function textileMaterial(tex: PalaceTextures, cell: number, tier: PalaceTier) {
  const params = {
    map: tex.textile, normalMap: tex.weaveN, roughness: 0.93, metalness: 0,
    normalScale: new THREE.Vector2(0.55, 0.55), side: THREE.DoubleSide,
  };
  const mat: THREE.MeshStandardMaterial = tier === 'high'
    ? new THREE.MeshPhysicalMaterial({ ...params, sheen: 0.6, sheenRoughness: 0.55, sheenColor: new THREE.Color(0.9, 0.82, 0.72) })
    : new THREE.MeshStandardMaterial(params);
  const cx = (cell % 2) * 0.5, cy = cell < 2 ? 0.5 : 0.0;
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.uTime;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime; attribute float aSway;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  float sw = aSway;
  float ph = position.x * 1.7 + position.z * 1.3;
  transformed += normal * sw * (sin(uTime * 0.9 + ph) * 0.012 + sin(uTime * 2.3 + ph * 2.1) * 0.004);
}`);
    s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `
#ifdef USE_MAP
{
  vec2 cu = vec2(${cx.toFixed(2)}, ${cy.toFixed(2)}) + fract(vMapUv) * 0.5;
  vec4 sampledDiffuseColor = textureGrad(map, cu, dFdx(vMapUv) * 0.5, dFdy(vMapUv) * 0.5);
  diffuseColor *= sampledDiffuseColor;
}
#endif`);
  };
  mat.customProgramCacheKey = () => `palace-textile-${cell}-${tier}`;
  return mat;
}

export function createPalaceMaterials(tex: PalaceTextures, world: TextureSet, tier: PalaceTier): PalaceMaterials {
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ metalness: 0, ...p });
  tex.weaveN.repeat.set(1, 1);
  const plaster = interiorize(std({ map: tex.plaster, normalMap: tex.plasterN, roughness: 0.94, color: 0xf2e6d2, normalScale: new THREE.Vector2(0.9, 0.9) }), { vertexAO: true, soot: 0.62, key: 'plaster' });
  const floor = interiorize(std({ map: tex.floor, normalMap: tex.floorN, roughness: 0.9, color: 0xe8dccb }), { vertexAO: true, key: 'floor' });
  const beam = interiorize(std({ map: tex.wood, normalMap: tex.woodN, roughness: 0.82, color: 0xb09a86, normalScale: new THREE.Vector2(1.2, 1.2) }), { vertexAO: false, soot: 0.5, key: 'beam' });
  const beamExt = std({ map: tex.wood, normalMap: tex.woodN, roughness: 0.85, color: 0xc4ae98, normalScale: new THREE.Vector2(1.2, 1.2) });
  const reed = interiorize(std({ map: tex.reed, normalMap: tex.reedN, roughness: 0.9, color: 0x9a8a78 }), { vertexAO: false, soot: 0.35, key: 'reed' });
  const wood = interiorize(std({ map: tex.wood, normalMap: tex.woodN, roughness: 0.62, color: 0xd9c0a4 }), { key: 'wood' });
  const clay = interiorize(std({ map: tex.clay, normalMap: tex.clayN, roughness: 0.78, color: 0xffffff }), { key: 'clay' });
  const clayDark = interiorize(std({ map: tex.clay, normalMap: tex.clayN, roughness: 0.7, color: 0x8a6a58 }), { key: 'clayd' });
  const fleece = interiorize(std({ map: tex.fleece, normalMap: tex.fleeceN, roughness: 1, color: 0xf4ece0, normalScale: new THREE.Vector2(1.4, 1.4) }), { key: 'fleece' });
  const leather = interiorize(std({ map: world.leather, normalMap: world.leatherN, roughness: 0.62, color: 0xa47c5c }), { key: 'leather' });
  const bronze = interiorize(std({ color: 0xa27a48, metalness: 1, roughness: 0.38 }), { key: 'bronze' });
  const iron = interiorize(std({ color: 0x77726c, metalness: 1, roughness: 0.46 }), { key: 'iron' });
  const bread = interiorize(std({ map: tex.clay, color: 0xe7b879, roughness: 0.9, normalMap: tex.floorN, normalScale: new THREE.Vector2(0.4, 0.4) }), { key: 'bread' });
  const olive = interiorize(std({ color: 0x2c2a18, roughness: 0.32 }), { key: 'olive' });
  const coal = std({ color: 0x1a1612, roughness: 0.95, emissive: new THREE.Color(1.0, 0.32, 0.08), emissiveIntensity: 2.2 });
  const textile = [0, 1, 2, 3].map((c) => interiorize(textileMaterial(tex, c, tier), { key: 'tex' + c + tier }));
  const disp = tier === 'high' ? 0.14 : tier === 'medium' ? 0.1 : 0;
  const masonry = masonryMaterial(world, { scale: 3.4, displace: disp, key: 'fort' + tier, plaster: 0.35 });
  const masonryFlat = masonryMaterial(world, { scale: 3.4, displace: 0, key: 'fortflat', plaster: 0.35 });
  const houses = masonryMaterial(world, { scale: 2.6, displace: 0, key: 'houses', plaster: 0.55, tint: 0xf4ead8 });
  const plasterExt = std({ map: tex.plaster, normalMap: tex.plasterN, roughness: 0.95, color: 0xd9c4a2 });
  const roof = roofMaterial(world);
  return { plaster, floor, beam, beamExt, reed, wood, clay, clayDark, fleece, leather, bronze, iron, bread, olive, coal, textile, masonry, masonryFlat, houses, roof, plasterExt };
}
