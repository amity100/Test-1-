import * as THREE from 'three';
import { clamp, damp, lerp, smoothstep } from '../core/noise';
import { Clip, pose, type Pose } from './Rig';
import { gunzip } from './human/inflate';
import rigJson from '../assets/animals/bear.json';

/*
 * Syrian brown bear (Ursus arctos syriacus) — "הַדֹּב" of 1 Samuel 17:34-37, the bear of the Land of Israel:
 * pale straw / golden-tawny pelt, darker legs, shoulder hump, dished face, small dark eyes, long pale claws.
 *
 * Assets are built offline by tools/animals/build_bear.py (SDF sculpt -> skinned mesh with 3 LODs sharing one
 * UV atlas, baked albedo / normal / mask textures, parametric eyes, claws and teeth). At runtime:
 *   - body: SkinnedMesh (PBR, baked normal + AO + roughness, wet nose / gums through the roughness mask)
 *   - fur: the same skinned vertices drawn N times as instanced shells (gl_InstanceID = layer) with tapered,
 *     clumped strands, guard hairs, Kajiya-Kay highlights and backlit forward scattering (golden rim)
 *   - extras: eyeballs (clear-coated), claws, teeth
 *   - a 31-bone quadruped skeleton driven procedurally: walk / trot / gallop with foot IK on the terrain,
 *     idle breathing, carrying (lamb in the jaws), rearing + bipedal steps, roar, swipes, hurt, collapse.
 *
 * Detail tiers (engine.quality.name):  high = LOD0 body (52k tris) + 2k maps + 26 shells over LOD1 (20k tris),
 * medium = LOD1 body + 1k maps + 14 shells over LOD2 (8k), low (phones) = LOD2 body + 1k maps + 7 shells over LOD2.
 * Shells also thin out with camera distance and vanish beyond ~70 m.
 *
 * Faces +Z, +Y up; the root sits on the ground between the feet (BearActor places it).
 */

export type BearHold = 'none' | 'rear' | 'carry' | 'down';
export type BearQuality = 'low' | 'medium' | 'high';
export type BearActionName = 'swipe' | 'swipeHigh' | 'hurt';

// ------------------------------------------------------------------------------------------------ rig data

interface RigJson {
  bones: { name: string; parent: string | null; pos: [number, number, number] }[];
  sockets: Record<string, { bone: string; pos: [number, number, number] }>;
  headPitch: number;
  jawRest: number;
  metersPerUV: number;
  furMax: number;
  lods: { tris: number; shellTris: number }[];
  extrasTris: number;
}
const RIG = rigJson as unknown as RigJson;
const BONE_NAMES = RIG.bones.map((b) => b.name);
const BI: Record<string, number> = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i]));
const JAW_REST = RIG.jawRest;

interface Tier {
  lod: number;
  shellLod: number;
  shells: number;
  tex: '2k' | '1k';
}
const TIERS: Record<BearQuality, Tier> = {
  high: { lod: 0, shellLod: 1, shells: 26, tex: '2k' },
  medium: { lod: 1, shellLod: 2, shells: 14, tex: '1k' },
  low: { lod: 2, shellLod: 2, shells: 7, tex: '1k' },
};

// ------------------------------------------------------------------------------------------------ assets

// eager URL strings only (each tier fetches just its own files; no stub chunk per file in the build)
const URLS = import.meta.glob('../assets/animals/*.{binz,webp,png}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const FILES: Record<string, () => Promise<string>> = Object.fromEntries(Object.entries(URLS).map(([k, u]) => [k, () => Promise.resolve(u)]));

async function assetUrl(name: string): Promise<string> {
  const f = FILES['../assets/animals/' + name];
  if (!f) throw new Error(`bear asset missing: ${name}`);
  return f();
}

type TypedArray = Float32Array | Int8Array | Uint8Array | Uint16Array | Uint32Array;

interface BinEntry {
  type: string;
  itemSize: number;
  normalized: boolean;
  offset: number;
  count: number;
  byteLength: number;
}

async function loadBin(name: string): Promise<{ meta: Record<string, unknown>; get: (k: string) => TypedArray }> {
  const url = await assetUrl(name);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`bear mesh fetch failed: ${res.status}`);
  const raw = await gunzip(await res.arrayBuffer());
  const dv = new DataView(raw);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'BRZ1') throw new Error('bad bear mesh');
  const jl = dv.getUint32(4, true);
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(raw, 8, jl))) as Record<string, unknown> & { arrays: Record<string, BinEntry> };
  const base = 8 + jl;
  const CT: Record<string, { new (b: ArrayBuffer, o: number, n: number): TypedArray; BYTES_PER_ELEMENT: number }> = {
    float32: Float32Array, int8: Int8Array, uint8: Uint8Array, uint16: Uint16Array, uint32: Uint32Array,
  };
  const get = (k: string) => {
    const e = meta.arrays[k];
    if (!e) throw new Error(`bear mesh: no array ${k}`);
    const C = CT[e.type];
    return new C(raw, base + e.offset, e.byteLength / C.BYTES_PER_ELEMENT);
  };
  return { meta, get };
}

function i8ToF32(a: Int8Array, stride: number, take: number) {
  const n = a.length / stride;
  const out = new Float32Array(n * take);
  for (let i = 0; i < n; i++) for (let k = 0; k < take; k++) out[i * take + k] = Math.max(-1, a[i * stride + k] / 127);
  return out;
}

interface BearAssets {
  body: THREE.BufferGeometry;
  shells: THREE.InstancedBufferGeometry;
  extras: THREE.BufferGeometry;
  albedo: THREE.Texture;
  normal: THREE.Texture;
  mask: THREE.Texture;
  strands: THREE.Texture;
  clumps: THREE.Texture;
  tier: Tier;
  furMax: number;
}

const _cache = new Map<BearQuality, Promise<BearAssets>>();

function loadAssets(q: BearQuality): Promise<BearAssets> {
  let p = _cache.get(q);
  if (!p) {
    p = (async () => {
      const tier = TIERS[q];
      const tl = new THREE.TextureLoader();
      const tex = async (name: string, srgb: boolean, repeat = false) => {
        const t = await tl.loadAsync(await assetUrl(name));
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = 4;
        if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
        return t;
      };
      const [bin, albedo, normal, mask, strands, clumps] = await Promise.all([
        loadBin('bear_mesh.binz'),
        tex(`bear_albedo_${tier.tex}.webp`, true),
        tex(`bear_normal_${tier.tex}.webp`, false),
        tex(`bear_mask_${tier.tex}.webp`, false),
        tex('fur_strands.png', false, true),
        tex('fur_clumps.png', false, true),
      ]);
      clumps.minFilter = THREE.NearestMipmapLinearFilter; // clump vectors must not blend across clump borders
      clumps.magFilter = THREE.NearestFilter;
      // already tier-sized (2k / 1k): keep Engine.enforceTextureBudget() from resampling them (clumps must stay exact)
      for (const t of [albedo, normal, mask, strands, clumps]) t.userData.keepSize = true;
      const g = bin.get;
      const body = new THREE.BufferGeometry();
      body.setAttribute('position', new THREE.BufferAttribute(g('position') as Float32Array, 3));
      body.setAttribute('normal', new THREE.BufferAttribute(i8ToF32(g('normal') as Int8Array, 4, 3), 3));
      body.setAttribute('tangent', new THREE.BufferAttribute(i8ToF32(g('tangent') as Int8Array, 4, 4), 4));
      body.setAttribute('uv', new THREE.BufferAttribute(g('uv') as Uint16Array, 2, true));
      body.setAttribute('skinIndex', new THREE.BufferAttribute(g('skinIndex') as Uint8Array, 4));
      body.setAttribute('skinWeight', new THREE.BufferAttribute(g('skinWeight') as Uint8Array, 4, true));
      body.setAttribute('fur', new THREE.BufferAttribute(g('fur') as Uint8Array, 4, true));
      body.setIndex(new THREE.BufferAttribute(g('index' + tier.lod) as Uint16Array, 1));
      const shells = new THREE.InstancedBufferGeometry();
      for (const [k, a] of Object.entries(body.attributes)) shells.setAttribute(k, a);
      shells.setIndex(new THREE.BufferAttribute(g('shell' + tier.shellLod) as Uint16Array, 1));
      shells.instanceCount = tier.shells;
      const extras = new THREE.BufferGeometry();
      extras.setAttribute('position', new THREE.BufferAttribute(g('exPosition') as Float32Array, 3));
      extras.setAttribute('normal', new THREE.BufferAttribute(i8ToF32(g('exNormal') as Int8Array, 4, 3), 3));
      extras.setAttribute('skinIndex', new THREE.BufferAttribute(g('exSkinIndex') as Uint8Array, 4));
      extras.setAttribute('skinWeight', new THREE.BufferAttribute(g('exSkinWeight') as Uint8Array, 4, true));
      extras.setAttribute('aux', new THREE.BufferAttribute(g('exAux') as Float32Array, 4));
      extras.setIndex(new THREE.BufferAttribute(g('exIndex') as Uint16Array, 1));
      const sphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.7);
      for (const geo of [body, shells, extras]) geo.boundingSphere = sphere.clone();
      return { body, shells, extras, albedo, normal, mask, strands, clumps, tier, furMax: RIG.furMax };
    })();
    _cache.set(q, p);
  }
  return p;
}

function detectQuality(): BearQuality {
  const q = (globalThis as unknown as { __engine?: { quality?: { name?: string } } }).__engine?.quality?.name;
  return q === 'low' || q === 'medium' || q === 'high' ? q : 'high';
}

// ------------------------------------------------------------------------------------------------ shaders

/** shared by the body and the fur so both read the same regional colour */
const GLSL_FUR_COMMON = /* glsl */ `
uniform sampler2D uMaskMap;
uniform float uFurCover;
uniform vec3 uRootTint;
uniform vec3 uTipTint;
varying vec3 vBindP;
// Syrian bears are palest on the back and flanks; the belly fringe and the upper legs darken to a warm brown
// (bind-pose height band; the lower legs are already dark in the albedo, so they get less)
vec3 bearUnderTint(vec3 bp) {
  float belly = (1.0 - smoothstep(0.47, 0.67, bp.y)) * (1.0 - smoothstep(0.5, 0.66, bp.z));
  return mix(vec3(1.0), vec3(0.74, 0.61, 0.49), belly * (0.55 + 0.45 * smoothstep(0.2, 0.43, bp.y)));
}
`;

/**
 * finishing pass: darkness of the bear's body 0..1 (the pelt, skin, claws, teeth — NOT the eyes' tapetum shine): the
 * film's H2 ("two eyes open in the dark", the body unseen) sets ≈0.85; 0 in gameplay. Shared by every bear.
 */
const bearDarkU = { value: 0 };
const DARK_OUT = '#include <opaque_fragment>\ngl_FragColor.rgb *= 1.0 - uBearDark;';

function makeBodyMaterial(a: BearAssets, shared: Record<string, THREE.IUniform>) {
  const m = new THREE.MeshStandardMaterial({ map: a.albedo, normalMap: a.normal, roughness: 1, metalness: 0 });
  m.name = 'bear-body';
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, shared, { uMaskMap: { value: a.mask }, uBearDark: bearDarkU });
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uBearDark;').replace('#include <opaque_fragment>', DARK_OUT);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBindP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBindP = position;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_FUR_COMMON}\nfloat bearAO; float bearFur;`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
{
  vec3 bm = texture2D(uMaskMap, vMapUv).rgb;
  bearAO = bm.r;
  bearFur = bm.b;
  // under the shells the skin shows the dense, darker under-fur; without shells the base carries the pelt
  diffuseColor.rgb *= mix(vec3(1.0), uRootTint, bearFur * uFurCover);
  diffuseColor.rgb *= bearUnderTint(vBindP);
}`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = texture2D(uMaskMap, vMapUv).g;')
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
{
  // velvety fur response for the base mesh (matters most when the shells are thinned out / off)
  vec3 L = directionalLights[0].direction;
  vec3 V = normalize(vViewPosition);
  float nl = dot(normal, L);
  float rim = pow(1.0 - saturate(dot(normal, V)), 3.0);
  float back = pow(saturate(dot(-L, V)), 3.0);
  float wrap = saturate((nl + 0.4) / 1.4) - saturate(nl);
  vec3 lc = directionalLights[0].color;
  reflectedLight.directDiffuse += lc * diffuseColor.rgb * bearFur * (wrap * 0.18 + back * rim * 0.9 * (1.0 - 0.6 * uFurCover)) * RECIPROCAL_PI;
}
#endif`,
      )
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
reflectedLight.indirectDiffuse *= bearAO;
reflectedLight.indirectSpecular *= bearAO * bearAO;
reflectedLight.directDiffuse *= mix(1.0, bearAO, 0.45);`,
      );
  };
  m.customProgramCacheKey = () => 'bear-body-v3';
  return m;
}

function makeFurMaterial(a: BearAssets, shared: Record<string, THREE.IUniform>, uniforms: Record<string, THREE.IUniform>) {
  const m = new THREE.MeshStandardMaterial({ map: a.albedo, roughness: 0.8, metalness: 0 });
  m.name = 'bear-fur';
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, shared, uniforms, { uMaskMap: { value: a.mask }, uStrands: { value: a.strands }, uBearDark: bearDarkU });
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uBearDark;').replace('#include <opaque_fragment>', DARK_OUT);
    s.vertexShader = s.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 fur;
#ifndef USE_TANGENT
attribute vec4 tangent;
#endif
uniform float uShellCount;
uniform float uFurMax;
uniform float uFurLen;
uniform float uTime;
uniform vec3 uWind;
uniform float uDroop;
varying float vH;
varying vec3 vStrandV;
varying float vFurAO;
varying float vFurLen;
varying vec2 vComb;
varying vec3 vBindP;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vBindP = position;
float furH = (float(gl_InstanceID) + 1.0) / uShellCount;
vec3 strandObj;
{
  vec2 fd = fur.xy * 2.0 - 1.0;
  vec3 N0 = normalize(normal);
  vec3 T0 = normalize(tangent.xyz);
  vec3 B0 = cross(N0, T0) * tangent.w;
  vec3 comb = T0 * fd.x + B0 * fd.y;
  float cl = length(comb);
  comb = cl > 1e-3 ? comb / cl : T0;
  float L = fur.z * uFurMax * uFurLen;
  // strands leave the skin at ~30 deg and lie down along the combing direction as they grow
  float h = furH;
  transformed += N0 * (L * 0.46 * h * (1.0 - 0.3 * h)) + comb * (L * (0.42 * h + 0.42 * h * h));
  strandObj = N0 * 0.46 * (1.0 - 0.6 * h) + comb * (0.42 + 0.84 * h);
  vH = h;
  vFurAO = fur.w;
  vFurLen = L;
  // combing direction in UV space (tangent = dP/du, bitangent ~ dP/dv): locks are elongated along it
  float fl = length(fd);
  vComb = fl > 1e-3 ? fd / fl : vec2(1.0, 0.0);
}`,
      )
      .replace(
        '#include <skinning_vertex>',
        `#include <skinning_vertex>
#ifdef USE_SKINNING
strandObj = (skinMatrix * vec4(strandObj, 0.0)).xyz;
#endif
{
  // gravity + a little wind ripple on the long hair, in model space (after skinning)
  float L = vFurLen;
  float h2 = vH * vH;
  transformed.y -= L * uDroop * h2;
  float ph = dot(transformed, vec3(9.1, 7.3, 8.7)) + uTime * 2.3;
  transformed += uWind * (L * h2 * (0.55 + 0.45 * sin(ph)));
}
vStrandV = normalize((modelViewMatrix * vec4(strandObj, 0.0)).xyz);`,
      );
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
${GLSL_FUR_COMMON}
uniform sampler2D uStrands;
uniform float uStrandTile;
uniform float uLockFreq;
vec2 furHash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3 furHash32(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }
uniform float uSpec1;
uniform float uSpec2;
uniform float uScatter;
varying float vH;
varying vec3 vStrandV;
varying float vFurAO;
varying float vFurLen;
varying vec2 vComb;
float furTip;
float furSpecK;
float furScatK;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
{
  vec3 bm = texture2D(uMaskMap, vMapUv).rgb;
  // Coverage is procedural (no mip-mapping problems). The pelt is a dense, dark under-fur (low shells) through
  // which pointed LOCKS of coarse hair rise; locks are elongated along the combing direction and most end well
  // below the outer shell, so only sparse guard-hair tips reach the silhouette (coarse, never plush).
  // short hair (face, paws) is a dense velvet of fine locks; long hair shows big guard-hair locks
  float shortK = 1.0 - smoothstep(0.02, 0.05, vFurLen);
  vec2 p = vMapUv * uLockFreq * mix(1.0, 3.4, shortK);
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  vec2 cdir = normalize(vComb);
  vec2 cper = vec2(-cdir.y, cdir.x);
  float stretch = mix(1.9, 1.35, shortK);
  float best = 8.0;
  vec2 bid = ip;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 dv = g + 0.12 + furHash22(ip + g) * 0.76 - fp;
      // anisotropic metric: a lock is a long, narrow tuft lying along the comb
      float da = dot(dv, cdir) / stretch;
      float dc = dot(dv, cper);
      float dd = da * da + dc * dc;
      if (dd < best) { best = dd; bid = ip + g; }
    }
  }
  float d = sqrt(best);
  vec3 lr = furHash32(bid);
  vec3 lr2 = furHash32(bid + 17.31);
  // lock classes: guard locks reach (almost) the outer shell, body locks end at 45-80 % of the fur length
  float guard = step(0.72, lr2.x);
  float len = mix(mix(0.45, 0.8, lr.x), mix(0.86, 1.0, lr.x), guard);
  float t = vH / len;
  float r = mix(0.42, 0.62, lr.z) * mix(1.0, 0.72, guard) * pow(max(0.0, 1.0 - t), mix(0.7, 1.1, guard));
  float under = 1.0 - smoothstep(mix(0.2, 0.7, shortK), mix(0.36, 0.95, shortK), vH + 0.1 * (lr.y - 0.5));
  float cov = max(r - d, under * 0.5 - 0.04);
  vec2 suv = vMapUv * uStrandTile;
  vec3 st = texture2D(uStrands, suv).rgb;
  vec2 sw = fwidth(suv) * 512.0;
  float strandVis = 1.0 - smoothstep(1.2, 3.0, max(sw.x, sw.y));
  cov -= smoothstep(0.3, 0.9, t) * strandVis * (1.0 - st.r) * 0.3;
  cov -= (1.0 - smoothstep(0.35, 0.8, bm.b)) * 2.0;
  #ifdef ALPHA_TO_COVERAGE
    float aa = max(fwidth(d), 1e-3);
    float alpha = smoothstep(-aa, aa, cov) * step(t, 1.0);
    if (alpha < 0.02) discard;
    diffuseColor.a = alpha;
  #else
    if (cov < 0.0 || t > 1.0) discard;
    diffuseColor.a = 1.0;
  #endif
  furTip = smoothstep(0.1, 1.0, t);
  // colour along the hair: dark, greyish roots -> golden mid-shaft -> tips that are sun-bleached on some locks
  // and darker on others (the grizzled look); per-lock value / hue variation; the lock's edge is darker
  // (strands separate there and shadow each other)
  vec3 tint = mix(uRootTint, uTipTint, furTip);
  // (short face / paw hair: almost no per-lock variation, or the lock cells would read as a mosaic)
  float val = 1.0 + (lr.y - 0.5) * mix(0.42, 0.03, shortK);
  vec3 bleach = vec3(1.16, 1.1, 0.98);
  vec3 dusky = vec3(0.74, 0.64, 0.56);
  float gz = lr2.y;
  vec3 tipC = gz > 0.62 ? bleach : (gz < 0.22 ? dusky : vec3(1.0));
  tint *= mix(vec3(1.0), tipC, smoothstep(0.45, 1.0, t) * (1.0 - shortK));
  tint *= val * mix(vec3(1.0), vec3(1.03, 0.98, 0.93), (lr2.z - 0.5) * (1.0 - shortK));
  float edge = r > 1e-3 ? smoothstep(0.35, 1.0, d / r) : 1.0;
  tint *= 1.0 - 0.28 * edge * (1.0 - under) * (1.0 - 0.85 * shortK);
  tint *= mix(1.0, 0.84 + 0.3 * st.b, strandVis);
  // coarse hair: sheen varies strongly per lock (some locks catch the light, most are matte and dusty)
  furSpecK = mix(mix(0.35, 1.5, lr2.z * lr2.z) * (1.0 - 0.5 * edge), 0.8, shortK);
  furScatK = mix(mix(0.55, 1.25, lr.y), 0.9, shortK);
  diffuseColor.rgb *= tint * bearUnderTint(vBindP);
}`,
      )
      .replace(
        '#include <lights_physical_pars_fragment>',
        `#include <lights_physical_pars_fragment>
void RE_Direct_Fur(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
  vec3 L = directLight.direction;
  vec3 V = geometryViewDir;
  vec3 N = geometryNormal;
  vec3 T = normalize(vStrandV);
  float nl = dot(N, L);
  float tl = dot(T, L);
  float sinTL = sqrt(max(0.0, 1.0 - tl * tl));
  // Kajiya-Kay diffuse blended with a wrapped Lambert so the body keeps its form
  float wrap = saturate((nl + 0.35) / 1.35);
  float diff = mix(wrap, sinTL * saturate(nl + 0.55), 0.4);
  // two shifted highlights: a whitish primary and a coloured, broader secondary
  vec3 H = normalize(L + V);
  vec3 T1 = normalize(T + N * 0.1);
  vec3 T2 = normalize(T - N * 0.22);
  float th1 = dot(T1, H), th2 = dot(T2, H);
  float s1 = pow(sqrt(max(0.0, 1.0 - th1 * th1)), 90.0);
  float s2 = pow(sqrt(max(0.0, 1.0 - th2 * th2)), 16.0);
  float vis = smoothstep(-0.15, 0.3, nl);
  vec3 spec = (vec3(s1) * uSpec1 + material.diffuseColor * s2 * uSpec2) * vis * (0.35 + 0.65 * furTip) * furSpecK;
  // light transmitted through thin, backlit hair: the golden halo of a low sun
  float back = pow(saturate(dot(-L, V)), 2.5);
  float rim = pow(1.0 - saturate(abs(dot(N, V))), 1.5);
  vec3 scatter = material.diffuseColor * back * (0.25 + 1.6 * rim) * uScatter * (0.25 + 0.75 * furTip) * furScatK;
  reflectedLight.directDiffuse += directLight.color * (material.diffuseColor * diff + scatter) * RECIPROCAL_PI;
  reflectedLight.directSpecular += directLight.color * spec;
}
#undef RE_Direct
#define RE_Direct RE_Direct_Fur`,
      )
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
{
  // self-shadowing inside the pelt: deep layers see little sky and little sun
  // (a short velvet pelt is shallow: little depth darkening, or its lock cells read as flat flakes)
  float shortS = 1.0 - smoothstep(0.02, 0.05, vFurLen);
  float self = mix(mix(0.34, 0.82, shortS), 1.0, pow(vH, 0.75));
  float ao = mix(vFurAO, 1.0, 0.35 + 0.5 * vH);
  reflectedLight.indirectDiffuse *= self * ao;
  reflectedLight.indirectSpecular *= self * ao;
  reflectedLight.directDiffuse *= mix(mix(0.5, 0.88, shortS), 1.0, pow(vH, 0.6)) * mix(1.0, ao, 0.4);
  reflectedLight.directSpecular *= ao;
}`,
      );
  };
  m.customProgramCacheKey = () => 'bear-fur-v4';
  return m;
}

/** models pass (CUT v2): tapetum eye-shine strength of every bear eye (0 in gameplay; the film's H2 raises it) */
const eyeShineU = { value: 0 };

function makeExtrasMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 });
  m.name = 'bear-extras';
  m.onBeforeCompile = (s) => {
    s.uniforms.uEyeShine = eyeShineU;
    s.uniforms.uBearDark = bearDarkU;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec4 aux;\nvarying vec4 vAux;\nvarying vec3 vBindN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvAux = aux;\nvBindN = normal;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec4 vAux;\nvarying vec3 vBindN;\nuniform float uEyeShine;\nuniform float uBearDark;\nfloat exRough; float exCoat; float exShine = 0.0;`)
      // the dark of H2 takes the claws and teeth; the eyes keep their light (the tapetum shine is all that is seen)
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\nif (vAux.x > 0.5) gl_FragColor.rgb *= 1.0 - uBearDark;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  float kind = vAux.x;
  if (kind < 0.5) {
    // eye: small, almost all warm dark-brown iris with a lighter amber ring, black pupil, a sliver of brownish
    // sclera in the corners; a wet clear-coat gives the catch-light that makes the small eye read at a distance
    float c = dot(normalize(vBindN), normalize(vAux.yzw));
    float iris = smoothstep(0.5, 0.58, c);
    float pupil = smoothstep(0.87, 0.91, c);
    float ring = smoothstep(0.6, 0.7, c) * (1.0 - smoothstep(0.8, 0.87, c));
    vec3 sclera = vec3(0.2, 0.15, 0.12);
    vec3 irisC = mix(vec3(0.075, 0.036, 0.014), vec3(0.24, 0.12, 0.04), ring);
    diffuseColor.rgb = mix(mix(sclera, irisC, iris), vec3(0.003), pupil);
    exRough = 0.12; exCoat = 1.0;
    // tapetum lucidum: behind the pupil the eye returns light toward its source (a lamp / the sky behind the
    // viewer) — a faint AMBER shine, strongest in the pupil, never red (visual-bible 3.15)
    exShine = smoothstep(0.62, 0.9, c);
  } else if (kind < 1.5) {
    // claw: dark horn at the root -> pale ivory tip
    float t = vAux.y;
    diffuseColor.rgb = mix(vec3(0.09, 0.07, 0.055), vec3(0.62, 0.55, 0.43), smoothstep(0.05, 0.75, t));
    exRough = 0.42; exCoat = 0.25;
  } else {
    // tooth: yellowed at the gum line -> ivory tip, wet
    float t = vAux.y;
    diffuseColor.rgb = mix(vec3(0.5, 0.4, 0.28), vec3(0.82, 0.77, 0.66), smoothstep(0.0, 0.7, t));
    exRough = 0.3; exCoat = 0.7;
  }
}`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = exRough;')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat *= exCoat;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
if (uEyeShine > 0.0 && exShine > 0.0) {
  // retro-reflection: only where the eye faces the viewer (vViewPosition points from the surface to the camera)
  float face = smoothstep(0.3, 0.85, dot(normalize(normal), normalize(vViewPosition)));
  totalEmissiveRadiance += vec3(1.0, 0.58, 0.2) * uEyeShine * exShine * face;
}`,
      );
  };
  m.customProgramCacheKey = () => 'bear-extras-v4';
  return m;
}

// ------------------------------------------------------------------------------------------------ clips
// Euler offsets (radians) relative to the bind pose; bones have world-aligned rest frames (X = pitch,
// + is nose/paw down-back for the neck & legs; Y = yaw toward +X; Z = roll).

const SWIPE = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.3, p: pose({ scapR: [-0.25, 0, -0.1], humR: [-1.25, 0.45, -0.65], foreR: [-1.1, 0, 0], wristR: [0.7, 0, 0], toesR: [0.4, 0, 0], spine2: [0.02, -0.22, 0.05], neck1: [0, 0.2, 0], head: [0.1, 0.25, 0.1], hips: [0, 0.08, -0.06] }, 0.02) },
  { t: 0.47, p: pose({ scapR: [-0.1, 0, 0.1], humR: [-1.0, -0.55, 0.45], foreR: [-0.35, 0, 0], wristR: [-0.25, 0, 0], toesR: [-0.35, 0, 0], spine2: [0.06, 0.32, -0.05], neck1: [0, -0.2, 0], head: [0.15, -0.3, -0.1], hips: [0, -0.1, 0.05] }, 0) },
  { t: 0.85, p: pose({}) },
]);

// the standing swipe (played while rearing): the torso is upright, so its twist is a roll (Z) of the spine bones
const SWIPE_HIGH = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.34, p: pose({ scapR: [-0.4, 0, -0.35], humR: [-2.0, 0.2, 0.9], foreR: [-1.1, 0, 0], wristR: [0.55, 0, 0], toesR: [0.5, 0, 0], humL: [0.15, 0, 0.1], spine1: [-0.04, 0, -0.12], spine2: [-0.05, 0, -0.26], neck1: [0.02, 0.06, 0.04], neck2: [0.02, 0.05, 0.02], head: [0.12, 0.06, 0], earL: [-0.4, 0, 0.1], earR: [-0.4, 0, -0.1] }, 0.03) },
  { t: 0.5, p: pose({ scapR: [0.1, 0, 0.1], humR: [-0.6, -0.35, 0.55], foreR: [-0.3, 0, 0], wristR: [-0.2, 0, 0], toesR: [-0.3, 0, 0], humL: [-0.1, 0, -0.05], spine1: [0.06, 0, 0.18], spine2: [0.08, 0, 0.34], neck1: [0.1, -0.12, -0.08], neck2: [0.04, -0.08, -0.04], head: [0.1, -0.12, 0], earL: [-0.6, 0, 0.15], earR: [-0.6, 0, -0.15] }, -0.04) },
  { t: 0.95, p: pose({}) },
]);

// flinch: the head jerks away and ducks, ears pinned, a grunt; the body recoils back and down
const HURT = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.08, p: pose({ neck1: [0.12, 0.26, 0.08], neck2: [0.06, 0.16, 0.06], head: [0.1, 0.2, 0.26], spine1: [0.03, 0.05, 0.03], spine2: [0.05, 0.1, 0.05], hips: [0, 0.05, 0], earL: [-0.75, 0, 0.2], earR: [-0.75, 0, -0.2], jaw: [0.22, 0, 0] }, -0.05, -0.06) },
  { t: 0.22, p: pose({ neck1: [0.06, 0.13, 0.04], neck2: [0.03, 0.08, 0.03], head: [0.05, 0.1, 0.12], spine2: [0.02, 0.05, 0.02], earL: [-0.55, 0, 0.1], earR: [-0.55, 0, -0.1], jaw: [0.14, 0, 0] }, -0.025, -0.03) },
  { t: 0.6, p: pose({}) },
]);

// death: stagger -> legs buckle -> roll onto the side -> settle (all FK; hipsOffset = pose.hipsY/hipsZ)
const DEATH = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.7, p: pose({ hips: [0.12, 0, 0.12], spine1: [0.12, 0, 0.06], spine2: [0.15, 0, 0.05], neck1: [0.35, 0, 0.1], neck2: [0.2, 0, 0], head: [0.25, 0.1, 0.2], humL: [-0.35, 0, 0.1], foreL: [0.6, 0, 0], humR: [-0.2, 0, -0.1], foreR: [0.7, 0, 0], femL: [0.5, 0, 0], tibL: [0.9, 0, 0], femR: [0.4, 0, 0], tibR: [0.8, 0, 0], jaw: [0.2, 0, 0], earL: [-0.4, 0, 0], earR: [-0.4, 0, 0] }, -0.31, 0) },
  { t: 1.7, p: pose({ hips: [0.05, 0, 1.3], spine1: [0.05, 0.05, 0.04], spine2: [0.02, 0.1, 0.02], neck1: [0.25, 0.1, 0.04], neck2: [0.15, 0.1, 0], head: [0.3, 0.1, 0.1], humL: [-0.6, 0, -0.2], foreL: [-0.4, 0, 0], wristL: [0.6, 0, 0], humR: [-0.4, 0, 0.1], foreR: [-0.3, 0, 0], wristR: [0.5, 0, 0], femL: [-0.3, 0, -0.2], tibL: [0.5, 0, 0], ankleL: [0.3, 0, 0], femR: [-0.5, 0, 0.08], tibR: [0.4, 0, 0], ankleR: [0.3, 0, 0], jaw: [0.3, 0, 0], earL: [-0.3, 0, 0], earR: [-0.3, 0, 0], tail: [0.3, 0, 0] }, -0.52, 0) },
  { t: 3.0, p: pose({ hips: [0.05, 0, 1.36], spine1: [0.04, 0.06, 0.03], spine2: [0.02, 0.14, 0.02], neck1: [0.1, 0.15, 0.04], neck2: [0.1, 0.1, 0.02], head: [0.2, 0.15, 0.1], humL: [-0.75, 0, -0.3], foreL: [-0.35, 0, 0], wristL: [0.7, 0, 0], toesL: [0.4, 0, 0], humR: [-0.55, 0, 0.12], foreR: [-0.35, 0, 0], wristR: [0.6, 0, 0], femL: [-0.45, 0, -0.25], tibL: [0.4, 0, 0], ankleL: [0.45, 0, 0], femR: [-0.6, 0, 0.1], tibR: [0.35, 0, 0], ankleR: [0.4, 0, 0], jaw: [0.36, 0, 0], earL: [-0.2, 0, 0], earR: [-0.2, 0, 0], tail: [0.35, 0, 0] }, -0.55, 0) },
]);

// the standing pose ("וַיָּקָם עָלַי"): hind legs are placed by IK, everything else FK
const REAR = pose({
  hips: [-1.2, 0, 0], spine1: [-0.08, 0, 0], spine2: [-0.06, 0, 0], neck1: [0.42, 0, 0], neck2: [0.32, 0, 0], head: [0.34, 0, 0],
  scapL: [0.25, 0, 0.05], humL: [1.12, 0.15, 0.22], foreL: [-1.15, 0, 0], wristL: [0.95, 0, 0], toesL: [0.35, 0, 0],
  scapR: [0.25, 0, -0.05], humR: [1.12, -0.15, -0.22], foreR: [-1.15, 0, 0], wristR: [0.95, 0, 0], toesR: [0.35, 0, 0],
  tail: [0.6, 0, 0], earL: [0.1, 0, 0], earR: [0.1, 0, 0],
}, 0.02, 0.06);

// ------------------------------------------------------------------------------------------------ legs / gaits

interface LegDef {
  key: 'fl' | 'fr' | 'hl' | 'hr';
  front: boolean;
  upper: string;
  lower: string;
  end: string;
  toe: string;
  contact: THREE.Vector3; // rest ground contact (root space)
  pole: THREE.Vector3;
}

const pos = (n: string) => new THREE.Vector3(...RIG.bones[BI[n]].pos);

const LEG_DEFS: LegDef[] = [
  { key: 'fl', front: true, upper: 'humL', lower: 'foreL', end: 'wristL', toe: 'toesL', contact: new THREE.Vector3(0.184, 0, 0.445), pole: new THREE.Vector3(0.25, 0, -1) },
  { key: 'fr', front: true, upper: 'humR', lower: 'foreR', end: 'wristR', toe: 'toesR', contact: new THREE.Vector3(-0.184, 0, 0.445), pole: new THREE.Vector3(-0.25, 0, -1) },
  { key: 'hl', front: false, upper: 'femL', lower: 'tibL', end: 'ankleL', toe: 'htoesL', contact: new THREE.Vector3(0.18, 0, -0.47), pole: new THREE.Vector3(0.3, 0.3, 1) },
  { key: 'hr', front: false, upper: 'femR', lower: 'tibR', end: 'ankleR', toe: 'htoesR', contact: new THREE.Vector3(-0.18, 0, -0.47), pole: new THREE.Vector3(-0.3, 0.3, 1) },
];

interface GaitDef {
  off: [number, number, number, number]; // fl, fr, hl, hr
  duty: number;
}
const GAIT_WALK: GaitDef = { off: [0.25, 0.75, 0.0, 0.5], duty: 0.68 };
const GAIT_TROT: GaitDef = { off: [0.52, 0.03, 0.0, 0.5], duty: 0.46 };
const GAIT_GALLOP: GaitDef = { off: [0.56, 0.44, 0.0, 0.12], duty: 0.34 };

// ------------------------------------------------------------------------------------------------ model

interface LegRec {
  def: LegDef;
  iu: number;
  il: number;
  ie: number;
  it: number;
  offs: THREE.Vector3;
}

interface BoneRec {
  name: string;
  bone: THREE.Bone;
  parent: number;
  rest: THREE.Vector3; // local rest offset
  restW: THREE.Vector3; // root-space rest position
  q: THREE.Quaternion;
  p: THREE.Vector3;
  wq: THREE.Quaternion;
  wp: THREE.Vector3;
  order: THREE.EulerOrder;
}

const _e = new THREE.Euler();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _m1 = new THREE.Matrix4();
const tmp = new THREE.Vector3();

const IK = {
  dir: new THREE.Vector3(), pole: new THREE.Vector3(), up: new THREE.Vector3(), k: new THREE.Vector3(), e: new THREE.Vector3(),
  lo: new THREE.Vector3(), xr1: new THREE.Vector3(), xr2: new THREE.Vector3(), nr: new THREE.Vector3(), nc: new THREE.Vector3(),
  t: new THREE.Vector3(), qa: new THREE.Quaternion(), qb: new THREE.Quaternion(),
};

function frameQuat(out: THREE.Quaternion, x: THREE.Vector3, n: THREE.Vector3) {
  const z = _v4.crossVectors(x, n).normalize();
  const y = _v3.crossVectors(z, x).normalize();
  _m1.makeBasis(x, y, z);
  return out.setFromRotationMatrix(_m1);
}

export interface BearModelOptions {
  /** content tier ('low' on phones). Defaults to engine.quality.name when available, else 'high'. */
  quality?: BearQuality;
}

export class BearModel {
  readonly root = new THREE.Group();
  /** named bones (THREE.Bone). Aliases of the previous rig: pelvis, spine, neck, head, jaw. */
  readonly j: Record<string, THREE.Object3D> = {};
  readonly mouthSocket = new THREE.Object3D();
  readonly beardSocket = new THREE.Object3D();
  readonly headCenter = new THREE.Object3D();
  readonly quality: BearQuality;
  /** resolves when the meshes are built and attached */
  readonly ready: Promise<void>;
  speed = 0;
  hold: BearHold = 'none';
  roar = 0; // 0..1 mouth open / roar intensity (set by gameplay)
  /**
   * models pass (CUT v2): tapetum eye-shine (HDR emissive strength, amber) of the bear's eyes — 0 in gameplay; the
   * film's H2 ("two eyes open in the dark") sets ≈ 2-4 so the eyes catch the light while the body stays dark.
   * Shared by every bear (one uniform).
   */
  get eyeShine() {
    return eyeShineU.value;
  }
  set eyeShine(v: number) {
    eyeShineU.value = Math.max(0, v);
  }
  /**
   * finishing pass: darkness 0..1 of the bear's body (pelt, skin, claws, teeth; NOT the eye-shine) — the film's H2
   * sets ≈0.85 so only the two amber eyes read in the thicket; 0 in gameplay. Shared by every bear (one uniform).
   */
  get darkness() {
    return bearDarkU.value;
  }
  set darkness(v: number) {
    bearDarkU.value = THREE.MathUtils.clamp(v, 0, 1);
  }
  lookTarget: THREE.Vector3 | null = null;
  deathT = -1;
  ground?: (x: number, z: number) => number;
  onFootfall?: () => void;
  /** shell fur on/off (debug / perf) */
  furEnabled = true;

  private bones: BoneRec[] = [];
  private skeleton: THREE.Skeleton;
  private meshes: THREE.SkinnedMesh[] = [];
  private furMesh: THREE.SkinnedMesh | null = null;
  private furShells = 0;
  private readonly shared: Record<string, THREE.IUniform> = {
    uFurCover: { value: 1 },
    uRootTint: { value: new THREE.Color(0.36, 0.31, 0.27) },
    uTipTint: { value: new THREE.Color(1.04, 0.97, 0.86) },
  };
  private readonly furU: Record<string, THREE.IUniform> = {
    uShellCount: { value: 16 },
    uFurMax: { value: RIG.furMax },
    uFurLen: { value: 1 },
    uTime: { value: 0 },
    uWind: { value: new THREE.Vector3(0.05, 0, 0.02) },
    uDroop: { value: 0.18 },
    uStrandTile: { value: RIG.metersPerUV / 0.09 },
    uLockFreq: { value: RIG.metersPerUV / 0.011 },
    uSpec1: { value: 0.085 },
    uSpec2: { value: 0.16 },
    uScatter: { value: 0.7 },
  };

  // animation state
  private E: Float32Array; // Euler accumulators (3 per bone)
  private hipsOff = new THREE.Vector3();
  private lipOff = new THREE.Vector3();
  private holdW: Record<BearHold, number> = { none: 1, rear: 0, carry: 0, down: 0 };
  private phase = 0;
  private biPhase = 0;
  private time = 0;
  private loco = 0; // 0..1 locomotion weight
  private vS = 0; // smoothed speed
  private gW = [1, 0, 0]; // walk, trot, gallop weights
  private action: { clip: Clip; t: number; name: BearActionName; events: { t: number; fn: () => void; fired: boolean }[] } | null = null;
  private look = new THREE.Vector2();
  private roarS = 0;
  private sniffT = 2;
  private sniff = 0;
  private earT = [1.5, 3.2];
  private ear = [0, 0];
  private lastStance = [true, true, true, true];
  private legs: LegRec[] = [];
  private clipPoses = new Map<Clip, Pose>();

  constructor(opts: BearModelOptions = {}) {
    this.quality = opts.quality ?? detectQuality();
    this.root.name = 'Bear';
    this.E = new Float32Array(BONE_NAMES.length * 3);
    // ---- skeleton (bind pose, world-aligned frames)
    const bonesArr: THREE.Bone[] = [];
    for (let i = 0; i < RIG.bones.length; i++) {
      const b = RIG.bones[i];
      const bone = new THREE.Bone();
      bone.name = b.name;
      const pi = b.parent ? BI[b.parent] : -1;
      const restW = new THREE.Vector3(...b.pos);
      const rest = pi >= 0 ? restW.clone().sub(new THREE.Vector3(...RIG.bones[pi].pos)) : restW.clone();
      bone.position.copy(rest);
      (pi >= 0 ? bonesArr[pi] : this.root).add(bone);
      bonesArr.push(bone);
      const order: THREE.EulerOrder = /neck|head|spine|hips|jaw|ear|tail/.test(b.name) ? 'YXZ' : 'XYZ';
      this.bones.push({ name: b.name, bone, parent: pi, rest, restW, q: new THREE.Quaternion(), p: rest.clone(), wq: new THREE.Quaternion(), wp: restW.clone(), order });
      this.j[b.name] = bone;
    }
    this.j.pelvis = this.j.hips;
    this.j.spine = this.j.spine2;
    this.j.neck = this.j.neck1;
    this.root.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(bonesArr);
    // ---- sockets
    const sock = (o: THREE.Object3D, key: string) => {
      const s = RIG.sockets[key];
      const b = this.bones[BI[s.bone]];
      o.position.set(s.pos[0], s.pos[1], s.pos[2]).sub(b.restW);
      o.name = key;
      b.bone.add(o);
    };
    sock(this.mouthSocket, 'mouth');
    sock(this.beardSocket, 'beard');
    sock(this.headCenter, 'headCenter');
    // ---- legs
    for (const def of LEG_DEFS) {
      const ie = BI[def.end];
      this.legs.push({ def, iu: BI[def.upper], il: BI[def.lower], ie, it: BI[def.toe], offs: pos(def.end).sub(def.contact) });
    }
    this.fk();
    this.writeBones();
    this.ready = loadAssets(this.quality).then((a) => this.build(a)).catch((e) => console.error('[bear] asset load failed', e));
  }

  /** Load (and cache) the bear assets for a tier ahead of time, e.g. behind a loading screen. */
  static preload(quality: BearQuality = detectQuality()): Promise<void> {
    return loadAssets(quality).then(() => undefined);
  }

  private build(a: BearAssets) {
    const body = new THREE.SkinnedMesh(a.body, makeBodyMaterial(a, this.shared));
    body.name = 'bear-body';
    body.castShadow = true;
    body.receiveShadow = true;
    const furMat = makeFurMaterial(a, this.shared, this.furU);
    const fur = new THREE.SkinnedMesh(a.shells, furMat);
    fur.name = 'bear-fur';
    fur.castShadow = false;
    fur.receiveShadow = true;
    fur.renderOrder = 1;
    this.furShells = a.tier.shells;
    const extras = new THREE.SkinnedMesh(a.extras, makeExtrasMaterial());
    extras.name = 'bear-extras';
    extras.castShadow = true;
    extras.receiveShadow = true;
    const sphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.7);
    for (const m of [body, fur, extras]) {
      m.bind(this.skeleton, new THREE.Matrix4());
      m.boundingSphere = sphere.clone();
      this.root.add(m);
      this.meshes.push(m);
    }
    this.furMesh = fur;
    const root = this.root;
    const wp = new THREE.Vector3();
    fur.onBeforeRender = (renderer, _scene, camera) => {
      // distance LOD for the shells + alpha-to-coverage only on multisampled targets
      root.getWorldPosition(wp);
      const d = camera.position.distanceTo(wp);
      const n = this.furEnabled ? Math.round(lerp(this.furShells, 3, smoothstep(8, 45, d))) : 0;
      const shells = d > 75 ? 0 : n;
      (fur.geometry as THREE.InstancedBufferGeometry).instanceCount = shells;
      this.furU.uShellCount.value = Math.max(1, shells);
      this.shared.uFurCover.value = shells > 0 ? 1 - smoothstep(40, 75, d) : 0;
      const rt = renderer.getRenderTarget();
      const msaa = !!rt && rt.samples > 0;
      if (furMat.alphaToCoverage !== msaa) {
        furMat.alphaToCoverage = msaa;
        furMat.needsUpdate = true;
      }
    };
  }

  // ---------------------------------------------------------------------------------------------- API

  play(name: BearActionName, events: { t: number; fn: () => void }[] = []) {
    const clip = name === 'swipe' ? SWIPE : name === 'swipeHigh' ? SWIPE_HIGH : HURT;
    this.action = { clip, t: 0, name, events: events.map((e) => ({ ...e, fired: false })) };
  }

  get busy() {
    return !!this.action;
  }

  /** Approximate hit capsule centre points (world) for projectiles and melee. */
  hitPoints(out: THREE.Vector3[]) {
    out[0] = this.j.hips.localToWorld((out[0] ?? new THREE.Vector3()).set(0, -0.05, -0.02));
    out[1] = this.j.spine2.localToWorld((out[1] ?? new THREE.Vector3()).set(0, -0.2, 0.05));
    out[2] = this.headCenter.getWorldPosition(out[2] ?? new THREE.Vector3());
    return out;
  }

  // ---------------------------------------------------------------------------------------------- update

  update(dt: number) {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.furU.uTime.value = this.time;
    this.root.updateMatrixWorld(true);
    const t = this.time;
    // ---- state weights
    for (const k of Object.keys(this.holdW) as BearHold[]) {
      const rate = k === 'rear' ? 2.6 : k === 'down' ? 2.2 : 5;
      this.holdW[k] = damp(this.holdW[k], this.hold === k ? 1 : 0, rate, dt);
    }
    if (this.hold === 'down') this.deathT = this.deathT < 0 ? 0 : this.deathT + dt;
    else this.deathT = -1;
    const v = Math.max(0, this.speed);
    this.vS = damp(this.vS, v, 6, dt);
    const down = this.holdW.down;
    // a standing bear drops to all fours to cover ground fast, and rises again when it slows
    const rear = this.holdW.rear * (1 - smoothstep(1.5, 2.4, this.vS)) * (1 - down);
    const quad = 1 - rear;
    this.loco = damp(this.loco, smoothstep(0.05, 0.45, v), 5, dt);
    const tw = smoothstep(1.5, 2.4, this.vS), gw = smoothstep(4.2, 5.6, this.vS);
    this.gW[2] = gw;
    this.gW[1] = tw * (1 - gw);
    this.gW[0] = 1 - this.gW[1] - this.gW[2];
    const stride = lerp(lerp(lerp(0.62 + 0.5 * this.vS, 0.95 + 0.34 * this.vS, tw), 1.3 + 0.24 * this.vS, gw), 0.5 + 0.3 * this.vS, rear);
    this.phase = (this.phase + (this.vS / Math.max(stride, 0.3)) * dt) % 1;
    const P = this.phase * Math.PI * 2;
    this.roarS = damp(this.roarS, clamp(this.roar, 0, 1), 12, dt);

    // ---- FK layers
    const E = this.E;
    E.fill(0);
    this.hipsOff.set(0, 0, 0);
    this.lipOff.set(0, 0, 0);
    const add = (b: string, x: number, y = 0, z = 0) => {
      const i = BI[b] * 3;
      E[i] += x;
      E[i + 1] += y;
      E[i + 2] += z;
    };
    const layer = (p: Pose, w: number) => {
      if (w <= 1e-4) return;
      for (const k in p.r) {
        const i = BI[k];
        if (i === undefined) continue;
        const r = p.r[k];
        E[i * 3] += (r[0] - E[i * 3]) * w;
        E[i * 3 + 1] += (r[1] - E[i * 3 + 1]) * w;
        E[i * 3 + 2] += (r[2] - E[i * 3 + 2]) * w;
      }
      this.hipsOff.y += ((p.hipsY ?? 0) - this.hipsOff.y) * w;
      this.hipsOff.z += ((p.hipsZ ?? 0) - this.hipsOff.z) * w;
    };

    // idle: breathing, sniffing, ears
    const idle = 1 - this.loco;
    const br = Math.sin(t * 1.35);
    add('spine2', 0.012 * br);
    add('spine1', -0.006 * br);
    this.hipsOff.y += 0.004 * br;
    this.sniffT -= dt;
    if (this.sniffT < 0) {
      this.sniffT = 2.5 + Math.random() * 5;
      this.sniff = 1;
    }
    this.sniff = Math.max(0, this.sniff - dt * 0.7);
    const sn = this.sniff * idle;
    add('neck1', -0.12 * sn + 0.06 * idle, 0.22 * Math.sin(t * 0.21) * idle);
    add('neck2', -0.05 * sn, 0.1 * Math.sin(t * 0.27 + 1) * idle);
    add('head', -0.25 * sn + 0.05 * Math.sin(t * 0.37 + 2) * idle, 0.12 * Math.sin(t * 0.31) * idle, 0.05 * Math.sin(t * 0.19) * idle);
    this.lipOff.y += 0.002 * sn * Math.max(0, Math.sin(t * 22));
    for (let k = 0; k < 2; k++) {
      this.earT[k] -= dt;
      if (this.earT[k] < 0) {
        this.earT[k] = 1.5 + Math.random() * 5;
        this.ear[k] = 1;
      }
      this.ear[k] = Math.max(0, this.ear[k] - dt * 5);
      const f = Math.sin(this.ear[k] * Math.PI) * 0.35;
      add(k ? 'earR' : 'earL', f * 0.6, 0, (k ? -1 : 1) * f * 0.4);
    }
    add('tail', 0.05 * Math.sin(t * 0.8));

    // quadruped locomotion: body bob, roll, spine flex, head carriage, shoulder roll
    const lw = this.loco * quad;
    if (lw > 1e-3) {
      const [ww, tr, ga] = this.gW;
      const bob = -(0.014 * ww + 0.03 * tr) * (0.5 + 0.5 * Math.cos(2 * P)) - 0.09 * ga * (0.5 + 0.5 * Math.cos(P + 0.6));
      this.hipsOff.y += bob * lw;
      // the gallop is a bound: the back flexes and extends with every stride
      add('hips', (0.2 * Math.sin(P) * ga + 0.02 * Math.sin(2 * P) * tr) * lw, 0.05 * Math.sin(P) * ww * lw, 0.045 * Math.sin(P) * (ww + 0.4 * tr) * lw);
      add('spine1', (-0.17 * Math.sin(P + 0.4) * ga) * lw, -0.04 * Math.sin(P) * ww * lw);
      add('spine2', (-0.14 * Math.sin(P + 0.9) * ga) * lw, -0.05 * Math.sin(P + 0.5) * ww * lw, -0.02 * Math.sin(P) * ww * lw);
      // head low in the walk, pumping in the gallop
      add('neck1', (0.2 * ww + 0.08 * tr - 0.05 * ga + 0.04 * Math.sin(2 * P + 1.2) * (ww + tr) + 0.16 * Math.sin(P + 2.2) * ga) * lw, 0.1 * Math.sin(P + 0.8) * ww * lw);
      add('head', (0.05 * ww + 0.05 * Math.sin(2 * P + 1.8) * ww - 0.1 * Math.sin(P + 2.6) * ga) * lw, 0.06 * Math.sin(P + 1.2) * ww * lw);
      add('tail', 0.15 * ga * lw, 0.12 * Math.sin(P) * ww * lw);
      // the hump rolls with the front legs
      const offs = this.gaitOffsets();
      add('scapL', 0.14 * Math.sin((this.phase + offs[0]) * Math.PI * 2 - 1.2) * lw);
      add('scapR', 0.14 * Math.sin((this.phase + offs[1]) * Math.PI * 2 - 1.2) * lw);
    }

    // carrying a lamb in the jaws: head raised, jaws clamped on the lamb's back
    const cw = this.holdW.carry * (1 - down);
    if (cw > 1e-3) {
      add('neck1', -0.4 * cw);
      add('neck2', -0.16 * cw);
      add('head', 0.24 * cw);
    }

    // rearing + bipedal steps
    if (rear > 1e-3) {
      layer(REAR, rear);
      const sway = Math.sin(t * 1.9);
      add('hips', 0.02 * sway * rear, 0.03 * Math.sin(t * 0.9) * rear, 0.03 * sway * rear);
      add('humL', 0.12 * Math.sin(t * 2.3) * rear, 0, 0.05 * Math.sin(t * 1.7) * rear);
      add('humR', 0.12 * Math.sin(t * 2.3 + 1.7) * rear, 0, -0.05 * Math.sin(t * 1.9) * rear);
      add('wristL', 0.15 * Math.sin(t * 2.1 + 0.5) * rear);
      add('wristR', 0.15 * Math.sin(t * 2.1 + 2.1) * rear);
      const bw = this.loco * rear;
      if (bw > 1e-3) {
        this.biPhase = (this.biPhase + (this.vS / 0.7) * dt) % 1;
        const bp = this.biPhase * Math.PI * 2;
        add('hips', 0, 0.12 * Math.sin(bp) * bw, 0.1 * Math.sin(bp) * bw);
        add('spine2', 0, -0.1 * Math.sin(bp) * bw, -0.06 * Math.sin(bp) * bw);
        add('humL', 0.25 * Math.sin(bp) * bw);
        add('humR', -0.25 * Math.sin(bp) * bw);
        this.hipsOff.y += -0.03 * Math.abs(Math.cos(bp)) * bw;
      }
    }

    // actions (swipes / flinch); a high swipe from all fours rises half-way first
    let armIK = 1;
    if (this.action) {
      const a = this.action;
      a.t += dt;
      const w = Math.max(0, Math.min(1, a.t / 0.08, (a.clip.duration - a.t) / 0.15));
      const p = a.clip.sample(a.t, this.poseFor(a.clip));
      if (a.name === 'hurt') {
        for (const k in p.r) add(k, p.r[k][0] * w, p.r[k][1] * w, p.r[k][2] * w);
        this.hipsOff.y += (p.hipsY ?? 0) * w;
        this.hipsOff.z += (p.hipsZ ?? 0) * w;
      } else {
        if (a.name === 'swipeHigh' && quad > 0.5) layer(REAR, Math.min(0.6, w) * quad);
        for (const k in p.r) add(k, p.r[k][0] * w, p.r[k][1] * w, p.r[k][2] * w);
        this.hipsOff.y += (p.hipsY ?? 0) * w;
        armIK = 1 - smoothstep(0.0, 0.1, a.t) * (1 - smoothstep(a.clip.duration - 0.2, a.clip.duration, a.t));
      }
      for (const e of a.events) if (!e.fired && a.t >= e.t) {
        e.fired = true;
        e.fn();
      }
      if (a.t >= a.clip.duration) this.action = null;
    }

    // jaw: closed at rest (the bind pose is slightly open), clamped on a lamb, wide open when roaring
    const rs = this.roarS;
    let jaw = -JAW_REST + 0.03 * sn;
    jaw += (0.3 + JAW_REST * 0.2) * cw;
    jaw += (0.78 - 0.25 * cw) * rs;
    add('jaw', jaw);
    if (rs > 1e-3) {
      // roar at the opponent: head thrust forward (not skyward), lips curled back from the canines, ears pinned
      add('neck1', 0.06 * rs);
      add('neck2', -0.04 * rs);
      add('head', -0.1 * rs, 0.06 * Math.sin(t * 17) * rs, 0.05 * Math.sin(t * 13) * rs);
      this.hipsOff.z += 0.04 * rs;
      add('earL', -0.7 * rs, 0, 0.2 * rs);
      add('earR', -0.7 * rs, 0, -0.2 * rs);
      this.lipOff.y += 0.024 * rs;
      this.lipOff.z -= 0.006 * rs;
    }

    // look at (neck + head share the yaw / pitch)
    if (this.lookTarget && down < 0.5) {
      const hc = this.bones[BI.head].bone;
      // gameplay passes feet positions: aim at the face / chest of whoever is there
      const local = this.root.worldToLocal(tmp.copy(this.lookTarget).setY(this.lookTarget.y + 1.3));
      const hp = _v1.setFromMatrixPosition(hc.matrixWorld);
      this.root.worldToLocal(hp);
      const yaw = clamp(Math.atan2(local.x - hp.x, local.z - hp.z), -1.0, 1.0);
      const pitch = clamp(Math.atan2(local.y - hp.y, Math.hypot(local.x - hp.x, local.z - hp.z)), -0.5, 0.5);
      this.look.x = damp(this.look.x, yaw, 4, dt);
      this.look.y = damp(this.look.y, pitch, 4, dt);
    } else {
      this.look.x = damp(this.look.x, 0, 3, dt);
      this.look.y = damp(this.look.y, 0, 3, dt);
    }
    add('neck1', -this.look.y * 0.25, this.look.x * 0.3);
    add('neck2', -this.look.y * 0.25, this.look.x * 0.3);
    add('head', -this.look.y * 0.3, this.look.x * 0.35);

    // death
    if (down > 1e-3) {
      const dp = DEATH.sample(Math.max(0, this.deathT), this.poseFor(DEATH));
      const breathe = Math.max(0, 1 - this.deathT / 5) * Math.sin(t * 2.2) * 0.02;
      layer(dp, down);
      add('spine2', breathe * down);
    }

    // ---- FK solve
    this.applyE();
    this.fk();

    // ---- IK: planted / stepping feet
    const offs = this.gaitOffsets();
    const duty = this.gaitDuty();
    const excursion = duty * stride * this.loco;
    for (let li = 0; li < 4; li++) {
      const L = this.legs[li];
      const d = L.def;
      let w = 1 - down;
      if (d.front) w *= quad * (d.key === 'fr' ? armIK : 1);
      if (w <= 1e-3) continue;
      let ph = (this.phase + offs[li]) % 1;
      let dty = duty;
      let exc = excursion;
      let lift = (d.front ? 0.11 + 0.08 * this.gW[2] : 0.08 + 0.06 * this.gW[2]) * this.loco;
      if (!d.front && rear > 0.5) {
        // bipedal shuffle
        ph = (this.biPhase + (d.key === 'hr' ? 0.5 : 0)) % 1;
        dty = 0.62;
        exc = 0.62 * 0.7 * this.loco;
        lift = 0.07 * this.loco;
      }
      const target = _v1.copy(d.contact);
      let footPitch = 0;
      const stance = ph < dty;
      if (stance) {
        const u = ph / dty;
        target.z += exc * (0.5 - u);
        if (!d.front) footPitch = 0.35 * smoothstep(0.75, 1, u) * this.loco; // heel lifts before push-off
      } else {
        const u = (ph - dty) / (1 - dty);
        const e = u * u * (3 - 2 * u);
        target.z += exc * (-0.5 + e);
        target.y += lift * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.8);
        footPitch = d.front ? 0.9 * Math.sin(Math.PI * Math.min(1, u * 1.3)) : 0.3 * Math.sin(Math.PI * u);
      }
      if (stance && !this.lastStance[li] && this.loco > 0.5 && (rear > 0.5 ? !d.front : d.front)) this.onFootfall?.();
      this.lastStance[li] = stance;
      // keep the paws on the terrain
      if (this.ground) {
        const wpt = this.root.localToWorld(_v2.copy(target).setY(0));
        const gy = this.ground(wpt.x, wpt.z);
        const lp = this.root.worldToLocal(_v3.set(wpt.x, gy, wpt.z));
        target.y += clamp(lp.y, -0.25, 0.25);
      }
      // end effector (wrist / ankle) above the contact point
      target.add(L.offs);
      if (!d.front && footPitch > 0) {
        // heel lift rotates the foot about the ball of the foot
        target.y += Math.sin(footPitch) * 0.2;
      }
      this.solveLeg(L, target, w, footPitch);
    }

    this.writeBones();
    this.levelMouth();
    this.root.updateMatrixWorld(true);
  }

  // ---------------------------------------------------------------------------------------------- internals

  private poseFor(c: Clip): Pose {
    let p = this.clipPoses.get(c);
    if (!p) {
      p = { r: {} };
      this.clipPoses.set(c, p);
    }
    return p;
  }

  private gaitOffsets(): [number, number, number, number] {
    const [w, t, g] = this.gW;
    const o: [number, number, number, number] = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) o[i] = GAIT_WALK.off[i] * w + GAIT_TROT.off[i] * t + GAIT_GALLOP.off[i] * g;
    return o;
  }

  private gaitDuty() {
    const [w, t, g] = this.gW;
    return GAIT_WALK.duty * w + GAIT_TROT.duty * t + GAIT_GALLOP.duty * g;
  }

  private applyE() {
    const E = this.E;
    for (let i = 0; i < this.bones.length; i++) {
      const b = this.bones[i];
      _e.set(E[i * 3], E[i * 3 + 1], E[i * 3 + 2], b.order);
      b.q.setFromEuler(_e);
      b.p.copy(b.rest);
    }
    this.bones[BI.hips].p.add(this.hipsOff);
    this.bones[BI.lipU].p.add(this.lipOff);
  }

  /** root-space transforms from local ones (bones are ordered parents first) */
  private fk(from = 0) {
    for (let i = from; i < this.bones.length; i++) {
      const b = this.bones[i];
      if (b.parent < 0) {
        b.wq.copy(b.q);
        b.wp.copy(b.p);
      } else {
        const p = this.bones[b.parent];
        b.wq.multiplyQuaternions(p.wq, b.q);
        b.wp.copy(b.p).applyQuaternion(p.wq).add(p.wp);
      }
    }
  }

  private fkChain(ids: number[]) {
    for (const i of ids) {
      const b = this.bones[i];
      const p = this.bones[b.parent];
      b.wq.multiplyQuaternions(p.wq, b.q);
      b.wp.copy(b.p).applyQuaternion(p.wq).add(p.wp);
    }
  }

  /** analytic two-bone IK (upper/lower) toward `target` (root space) for the end joint, then orient the paw */
  private solveLeg(L: LegRec, target: THREE.Vector3, w: number, footPitch: number) {
    const U = this.bones[L.iu], Lo = this.bones[L.il], En = this.bones[L.ie], To = this.bones[L.it];
    const A = U.wp;
    const l1 = U.restW.distanceTo(Lo.restW);
    const l2 = Lo.restW.distanceTo(En.restW);
    const I = IK;
    const dir = I.dir.copy(target).sub(A);
    let d = dir.length();
    dir.divideScalar(Math.max(d, 1e-6));
    d = clamp(d, Math.abs(l1 - l2) + 0.01, (l1 + l2) * 0.998);
    const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    // elbows follow the shoulder blade; knees always point forward (also when standing)
    const pole = I.pole.copy(L.def.pole);
    if (L.def.front) pole.applyQuaternion(this.bones[U.parent].wq);
    pole.addScaledVector(dir, -pole.dot(dir));
    if (pole.lengthSq() < 1e-8) pole.set(0, 0, L.def.front ? -1 : 1);
    pole.normalize();
    const upDir = I.up.copy(dir).multiplyScalar(cosA).addScaledVector(pole, sinA);
    const K = I.k.copy(A).addScaledVector(upDir, l1);
    const Ep = I.e.copy(A).addScaledVector(dir, d);
    const loDir = I.lo.copy(Ep).sub(K).normalize();
    // rest frames
    const xr1 = I.xr1.copy(Lo.restW).sub(U.restW).normalize();
    const xr2 = I.xr2.copy(En.restW).sub(Lo.restW).normalize();
    const nr = I.nr.crossVectors(xr1, I.t.copy(En.restW).sub(U.restW)).normalize();
    const nc = I.nc.crossVectors(upDir, I.t.copy(Ep).sub(A));
    if (nc.lengthSq() < 1e-10) nc.copy(nr).applyQuaternion(this.bones[U.parent].wq);
    nc.normalize();
    const qUp = frameQuat(I.qa, upDir, nc).multiply(frameQuat(_q1, xr1, nr).invert());
    const qLo = frameQuat(I.qb, loDir, nc).multiply(frameQuat(_q1, xr2, nr).invert());
    // local = parentWorld^-1 * world
    _q2.copy(this.bones[U.parent].wq).invert().multiply(qUp);
    U.q.slerp(_q2, w);
    this.fkChain([L.iu]);
    _q2.copy(U.wq).invert().multiply(qLo);
    Lo.q.slerp(_q2, w);
    this.fkChain([L.il]);
    // paw / foot: flat on the ground in stance, flexed in the swing
    _e.set(footPitch, 0, 0, 'XYZ');
    _q3.setFromEuler(_e);
    _q2.copy(Lo.wq).invert().multiply(_q3);
    En.q.slerp(_q2, w);
    this.fkChain([L.ie]);
    // toes curl a little in the swing
    _e.set(L.def.front ? 0.35 * footPitch : -0.6 * footPitch, 0, 0, 'XYZ');
    _q2.setFromEuler(_e);
    To.q.slerp(_q2, w);
    this.fkChain([L.it]);
  }

  private writeBones() {
    for (const b of this.bones) {
      b.bone.quaternion.copy(b.q);
      b.bone.position.copy(b.p);
    }
  }

  /** keep the mouth socket's up axis vertical so a carried lamb hangs naturally from the jaws */
  private levelMouth() {
    const head = this.bones[BI.head];
    // world yaw of the head
    const fwd = _v1.set(0, 0, 1).applyQuaternion(head.wq);
    const yaw = Math.atan2(fwd.x, fwd.z);
    _e.set(0, yaw, 0, 'YXZ');
    _q1.setFromEuler(_e); // desired root-space orientation
    this.mouthSocket.quaternion.copy(head.wq).invert().multiply(_q1);
  }
}

