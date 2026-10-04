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
 *   - a 31-bone quadruped skeleton driven procedurally (bear1, gameplay v2 §4 — see "motion" below): paws planted in
 *     world space (they never slide), a lateral-sequence walk, an amble and a rotary gallop picked with hysteresis,
 *     plantigrade heel-to-toe hind feet, toed-in forepaws, the shoulder blades rolling, girdles dipping onto every
 *     planted leg, turns that bend the body and step the paws round; carrying (lamb in the jaws), rearing (sitting back
 *     onto the haunches) + bipedal steps, roar; the fight's moves (BEAR_MOVES: swipes, huff + jaw-pop + stomp, bite
 *     lunge, rear-and-slam, stagger, the bluff charge's brake, hurt), fatigue, held by the jaw (gripSocket) and a heavy
 *     collapse.
 *
 * Detail tiers (engine.quality.name):  high = LOD0 body (52k tris) + 2k maps + 26 shells over LOD1 (20k tris),
 * medium = LOD1 body + 1k maps + 14 shells over LOD2 (8k), low (phones) = LOD2 body + 1k maps + 7 shells over LOD2.
 * Shells also thin out with camera distance and vanish beyond ~70 m.
 *
 * Faces +Z, +Y up; the root sits on the ground between the feet (BearActor places it).
 */


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

// ------------------------------------------------------------------------------------------------ motion (bear1, gameplay v2 §4)
// Euler offsets (radians) relative to the bind pose; bones have world-aligned rest frames (X = pitch, + is nose / paw
// down-back for the neck & legs; Y = yaw toward +X = the bear's LEFT; Z = roll, + lifts the left side).
//
// How a brown bear moves, and how this rig does it:
//  * every paw is PLANTED in world space while it bears weight (it never slides) and swings on its own timer to a
//    landing spot predicted from the body's velocity and turn rate; the gait clock only decides when a paw lifts;
//  * gaits (picked with hysteresis, never a long-lived hybrid): a lateral-sequence WALK with a long duty factor
//    (LH, LF, RH, RF), a lateral AMBLE (the rolling running-walk bears use between walk and gallop), a ROTARY GALLOP
//    (LH, RH, RF, LF; the back flexing and extending, a gathered suspension), and short BIPEDAL steps when reared;
//  * plantigrade hind feet: heel strike (toes up), the whole sole flat, the heel rolling up over the ball before
//    toe-off; forepaws slightly pigeon-toed, the wrist flexing hard in the swing, the paw paddling outward;
//  * the shoulder blade swings and slides on the ribs (the reach of the foreleg and the rolling hump), the girdles dip
//    onto every planted leg (a damped spring per girdle: weight and follow-through), roll toward the unloaded side and
//    sway over the stance legs; the head carried low and swinging; turns bend the spine (the front leads, the rump
//    follows) and lean into the curve; standing still the bear steps its paws round when it turns;
//  * rearing: it sits back onto its haunches, the torso pitches up, the forelegs leave the ground and hang relaxed,
//    the balance sways; it drops forward onto its forepaws with a thump.
// The fight's moves (BEAR_MOVES) layer on top: telegraphed, driven from the shoulder with a weight shift, each with
// its strike frame and the window in which the bear is committed (open to a counter).

export type BearHold = 'none' | 'rear' | 'carry' | 'down' | 'held';
export type BearQuality = 'low' | 'medium' | 'high';
export type BearActionName = 'swipe' | 'swipeHigh' | 'hurt' | 'huff' | 'stomp' | 'bite' | 'rearSlam' | 'stagger' | 'brake';
/** sound / effect cues the model raises (BearModel.onCue): where they happen is passed in world space */
export type BearCue = 'huff' | 'jawPop' | 'stomp' | 'snap' | 'slam' | 'land' | 'skid' | 'collapse';

/** Timing of a fight move — all in CLIP seconds (at fatigue f the clip plays at `actionRate` = 1 - 0.3 f, so the real
 *  time is clip time / actionRate; events passed to play() fire on their clip frame either way). */
export interface BearMove {
  /** clip length */
  dur: number;
  /** the strike frame: the claws / jaws / forepaws at their target */
  hit?: number;
  /** metres from the bear's root (between its feet) to the centre of the blow, along its heading (measured at the strike
   *  frame — add the target's body radius, ~0.3 m for David, for a hit test) */
  reach?: number;
  /** half-width (m) of the blow across the heading at `reach` */
  width?: number;
  /** the tell: the wind-up the player must read (clip seconds) */
  tell?: [number, number];
  /** the bear is committed / off balance: the opening for a counter (staff to the nose, a step in, the grip) */
  open?: [number, number];
}

export const BEAR_MOVES: Record<BearActionName, BearMove> = {
  // forepaw swat on all fours (right paw unless play(…, {side: 1})): weight onto the other foreleg, the shoulder winds
  // back and drives the paw across, claws out; it lands ahead and inside
  swipe: { dur: 0.95, hit: 0.47, reach: 1.05, width: 0.6, tell: [0, 0.3], open: [0.6, 0.95] },
  // standing swat (reared; from all fours it half-rises first)
  swipeHigh: { dur: 0.95, hit: 0.5, reach: 0.9, width: 0.65, tell: [0, 0.34], open: [0.62, 0.95] },
  // flinch (a blow landed)
  hurt: { dur: 0.6, open: [0, 0.45] },
  // the warning display: head low and swinging, ears back, two huffs, two jaw-pops, a forepaw stomp at 1.86
  huff: { dur: 2.4, tell: [0, 2.4] },
  // a short bluff lunge and a slap of the ground with a forepaw (a blow if David stands right there)
  stomp: { dur: 1.15, hit: 0.56, reach: 0.8, width: 0.3, tell: [0, 0.38], open: [0.72, 1.15] },
  // the bite lunge: sinks back, then the neck shoots out, the jaws wide; they snap at `hit`; overreached after
  bite: { dur: 1.15, hit: 0.46, reach: 1.4, width: 0.35, tell: [0, 0.26], open: [0.55, 1.0] },
  // rears to its full height, arms up, and comes down with both forepaws together (the slam at `hit`)
  rearSlam: { dur: 2.5, hit: 1.62, reach: 1.0, width: 0.45, tell: [0, 1.3], open: [1.7, 2.45] },
  // hit hard: lurches sideways (play(…, {side}) = the side it lurches toward), a foreleg buckles, steps to catch itself
  stagger: { dur: 1.3, open: [0, 1.1] },
  // a charge pulled up short (a bluff): forelegs braced ahead, haunches down, a skid, then a huff with the head low
  brake: { dur: 1.0, open: [0.35, 1.0] },
};

type PK = { t: number; p: [number, number, number] | null; pitch: number; yaw?: number };
interface PawScript {
  /** 'f' = the acting side's foreleg, 'h' its hind leg, 'F' both forelegs (x mirrored for the other) */
  leg: 'f' | 'h' | 'F';
  /** root-space contact-point keys (authored for the RIGHT side; p = null: where the paw is when the script starts) */
  keys: PK[];
}
interface ActionDef {
  clip: Clip;
  paws?: PawScript[];
  cues?: { t: number; cue: BearCue; at?: 'head' | 'paw' | 'front' | 'body' }[];
  /** forced steps (root-space offsets from the paw's rest contact, authored for the right side) */
  steps?: { t: number; leg: 'f' | 'h' | 'of' | 'oh'; d: [number, number]; dur: number }[];
  /** the rear progress is at least this (swipeHigh from all fours) */
  rearMin?: (t: number) => number;
  /** the rear progress is exactly this while the clip plays (rearSlam) */
  rearSet?: (t: number) => number;
  /** the clip is an additive flinch (hurt) rather than a full-body move */
  additive?: boolean;
}

const sw = (v: number) => [0, 0, v] as [number, number, number]; // the lateral sway channel (authored to the right)

// the swat on all fours (authored for the right paw)
const SWIPE = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.3, e: 'in', p: pose({ spine1: [0, -0.08, -0.03], spine2: [0.02, -0.2, -0.08], neck1: [0.04, 0.12, 0], neck2: [0, 0.06, 0], head: [0.04, 0.14, 0.08], earL: [-0.55, 0, 0.12], earR: [-0.55, 0, -0.12], jaw: [0.14, 0, 0], sway: sw(0.05) }, -0.035, -0.05) },
  // (the head lifts and turns away from the swinging paw — to its left — so the paw passes below and in front of it)
  { t: 0.47, e: 'out', p: pose({ spine1: [0.02, 0.1, 0.03], spine2: [0.06, 0.28, 0.07], neck1: [-0.12, 0.1, 0.04], neck2: [-0.05, 0.06, 0], head: [-0.04, 0.2, 0.16], earL: [-0.8, 0, 0.2], earR: [-0.8, 0, -0.2], jaw: [0.34, 0, 0], sway: sw(-0.02) }, -0.025, 0.1) },
  { t: 0.64, p: pose({ spine1: [0.01, 0.06, 0.01], spine2: [0.04, 0.15, 0.04], neck1: [-0.05, 0.06, 0.02], head: [0.02, 0.1, 0.06], earL: [-0.5, 0, 0.1], earR: [-0.5, 0, -0.1], jaw: [0.14, 0, 0] }, -0.012, 0.05) },
  { t: 0.95, p: pose({}) },
]);
const SWIPE_PAW: PawScript = {
  leg: 'f',
  keys: [
    { t: 0, p: null, pitch: 0 },
    { t: 0.3, p: [-0.4, 0.56, 0.36], pitch: 1.05, yaw: -0.3 },
    { t: 0.47, p: [0.0, 0.44, 1.07], pitch: -0.35, yaw: 0.55 },
    { t: 0.64, p: [0.16, 0.24, 0.82], pitch: 0.3, yaw: 0.35 },
    { t: 0.84, p: [-0.12, 0, 0.64], pitch: 0, yaw: 0 },
  ],
};

// the standing swat (played while reared; the torso is upright, so its twist is a roll (Z) of the spine bones)
const SWIPE_HIGH = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.34, e: 'in', p: pose({ scapR: [-0.4, 0, -0.35], humR: [-2.0, 0.2, 0.9], foreR: [-1.1, 0, 0], wristR: [0.55, 0, 0], toesR: [-0.4, 0, 0], humL: [0.15, 0, 0.1], spine1: [-0.04, 0, -0.14], spine2: [-0.05, 0, -0.28], neck1: [0.02, 0.06, 0.04], neck2: [0.02, 0.05, 0.02], head: [0.12, 0.06, 0], earL: [-0.5, 0, 0.12], earR: [-0.5, 0, -0.12], jaw: [0.12, 0, 0], sway: sw(0.04) }, -0.02, -0.03) },
  { t: 0.5, e: 'out', p: pose({ scapR: [-0.1, 0, 0.1], humR: [-1.05, -0.3, 0.45], foreR: [-0.12, 0, 0], wristR: [-0.25, 0, 0], toesR: [-0.45, 0, 0], humL: [-0.1, 0, -0.05], hips: [0.16, 0, 0], spine1: [0.16, 0, 0.2], spine2: [0.16, 0, 0.36], neck1: [-0.12, -0.12, -0.08], neck2: [-0.08, -0.08, -0.04], head: [0.0, -0.12, 0], earL: [-0.7, 0, 0.15], earR: [-0.7, 0, -0.15], jaw: [0.35, 0, 0], sway: sw(-0.03) }, -0.07, 0.16) },
  { t: 0.66, p: pose({ scapR: [0.05, 0, 0.05], humR: [-0.45, -0.2, 0.3], foreR: [-0.45, 0, 0], wristR: [0.2, 0, 0], hips: [0.08, 0, 0], spine1: [0.08, 0, 0.1], spine2: [0.08, 0, 0.16], neck1: [-0.04, -0.06, -0.04], head: [0.02, -0.06, 0], earL: [-0.4, 0, 0.1], earR: [-0.4, 0, -0.1], jaw: [0.12, 0, 0] }, -0.04, 0.08) },
  { t: 0.95, p: pose({}) },
]);

// flinch: the head jerks away and ducks, ears pinned, a grunt; the body recoils back and down (additive)
const HURT = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.08, p: pose({ neck1: [0.12, 0.26, 0.08], neck2: [0.06, 0.16, 0.06], head: [0.1, 0.2, 0.26], spine1: [0.03, 0.05, 0.03], spine2: [0.05, 0.1, 0.05], hips: [0, 0.05, 0], earL: [-0.75, 0, 0.2], earR: [-0.75, 0, -0.2], jaw: [0.22, 0, 0] }, -0.06, -0.07) },
  { t: 0.22, p: pose({ neck1: [0.06, 0.13, 0.04], neck2: [0.03, 0.08, 0.03], head: [0.05, 0.1, 0.12], spine2: [0.02, 0.05, 0.02], earL: [-0.55, 0, 0.1], earR: [-0.55, 0, -0.1], jaw: [0.14, 0, 0] }, -0.03, -0.035) },
  { t: 0.6, p: pose({}) },
]);

const HEAD_LOW = { spine2: [0.06, 0, 0], neck1: [0.3, 0, 0], neck2: [0.12, 0, 0], head: [0.08, 0, 0], earL: [-0.9, 0, 0.25], earR: [-0.9, 0, -0.25] } as Record<string, [number, number, number]>;
const HUFF = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.35, p: pose(HEAD_LOW, -0.045, 0.03) },
  { t: 1.6, p: pose(HEAD_LOW, -0.045, 0.03) },
  { t: 1.74, p: pose({ ...HEAD_LOW, sway: sw(0.04), spine2: [0.02, 0, -0.05] }, -0.02, -0.03) },
  { t: 1.86, e: 'out', p: pose({ ...HEAD_LOW, neck1: [0.36, 0, 0], sway: sw(-0.02) }, -0.06, 0.06) },
  { t: 2.05, p: pose(HEAD_LOW, -0.045, 0.03) },
  { t: 2.4, p: pose({}) },
]);
const STOMP_PAW = (t0: number, t1: number, hz: number): PawScript => ({
  leg: 'f',
  keys: [
    { t: t0, p: null, pitch: 0 },
    { t: lerp(t0, t1, 0.62), p: [-0.21, 0.3, 0.5 + hz * 0.5], pitch: 0.95, yaw: 0.1 },
    { t: t1, p: [-0.19, 0, 0.47 + hz], pitch: -0.08, yaw: 0.12 },
  ],
});

const STOMP = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.36, p: pose({ spine1: [-0.07, 0, 0], neck1: [-0.08, 0, 0], head: [-0.04, 0, 0], earL: [-0.6, 0, 0.15], earR: [-0.6, 0, -0.15], sway: sw(0.04) }, -0.03, -0.1) },
  { t: 0.56, e: 'out', p: pose({ spine1: [0.06, 0, 0], spine2: [0.06, 0, -0.04], neck1: [0.32, 0, 0], neck2: [0.1, 0, 0], head: [0.12, 0, 0], jaw: [0.28, 0, 0], earL: [-0.9, 0, 0.25], earR: [-0.9, 0, -0.25], sway: sw(-0.03) }, -0.075, 0.17) },
  { t: 0.78, p: pose({ spine1: [0.03, 0, 0], neck1: [0.28, 0, 0], head: [0.08, 0, 0], jaw: [0.04, 0, 0], earL: [-0.8, 0, 0.2], earR: [-0.8, 0, -0.2] }, -0.05, 0.12) },
  { t: 1.15, p: pose({}) },
]);

const BITE = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.26, p: pose({ spine2: [0.05, 0, 0], neck1: [-0.06, 0, 0], neck2: [-0.04, 0, 0], head: [-0.06, 0, 0], jaw: [0.3, 0, 0], earL: [-0.85, 0, 0.22], earR: [-0.85, 0, -0.22] }, -0.05, -0.11) },
  { t: 0.46, e: 'out', p: pose({ spine1: [-0.04, 0, 0], spine2: [-0.05, 0, 0], neck1: [-0.26, 0, 0], neck2: [-0.1, 0, 0], head: [0.26, 0, 0], jaw: [0.78, 0, 0], earL: [-0.9, 0, 0.25], earR: [-0.9, 0, -0.25] }, -0.02, 0.36) },
  { t: 0.53, p: pose({ spine1: [-0.03, 0, 0], spine2: [-0.04, 0, 0], neck1: [-0.22, 0, 0], neck2: [-0.08, 0, 0], head: [0.24, 0, 0], jaw: [0.0, 0, 0], earL: [-0.9, 0, 0.25], earR: [-0.9, 0, -0.25] }, -0.025, 0.33) },
  { t: 0.74, p: pose({ neck1: [-0.1, 0.2, 0.04], neck2: [-0.04, 0.1, 0], head: [0.12, 0.24, 0.14], jaw: [0.06, 0, 0], earL: [-0.8, 0, 0.2], earR: [-0.8, 0, -0.2] }, -0.035, 0.22) },
  { t: 0.88, p: pose({ neck1: [-0.04, -0.16, -0.03], neck2: [-0.02, -0.08, 0], head: [0.06, -0.2, -0.12], earL: [-0.6, 0, 0.15], earR: [-0.6, 0, -0.15] }, -0.03, 0.12) },
  { t: 1.15, p: pose({}) },
]);
const BITE_PAW: PawScript = {
  leg: 'f',
  keys: [
    { t: 0.22, p: null, pitch: 0 },
    { t: 0.34, p: [-0.2, 0.16, 0.66], pitch: 0.85, yaw: 0.1 },
    { t: 0.45, p: [-0.19, 0, 0.84], pitch: -0.05, yaw: 0.15 },
  ],
};

// rear-and-slam: the rear machinery raises the bear (rearSet); the arms rise to threaten, then both forepaws come down
// (deltas on top of the REAR pose: the upper arms forward and up, elbows bent, the paws open, claws spread)
const ARMS_UP = {
  scapL: [-0.2, 0, 0.04], humL: [-0.95, 0.1, 0.1], foreL: [0.15, 0, 0], wristL: [-0.55, 0, 0], toesL: [-0.75, 0, 0],
  scapR: [-0.2, 0, -0.04], humR: [-0.95, -0.1, -0.1], foreR: [0.15, 0, 0], wristR: [-0.55, 0, 0], toesR: [-0.75, 0, 0],
} as Record<string, [number, number, number]>;
const REAR_SLAM = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.5, p: pose({ earL: [-0.4, 0, 0.1], earR: [-0.4, 0, -0.1] }) },
  { t: 0.95, p: pose({ ...ARMS_UP, neck1: [-0.05, 0, 0], head: [-0.08, 0, 0], jaw: [0.5, 0, 0], earL: [-0.85, 0, 0.22], earR: [-0.85, 0, -0.22] }, 0.0, 0) },
  { t: 1.3, e: 'in', p: pose({ ...ARMS_UP, humL: [-1.08, 0.1, 0.13], humR: [-1.08, -0.1, -0.13], neck1: [-0.08, 0, 0], head: [-0.1, 0, 0], jaw: [0.6, 0, 0], earL: [-0.9, 0, 0.25], earR: [-0.9, 0, -0.25] }, 0.01, 0) },
  { t: 1.62, e: 'out', p: pose({ spine1: [0.1, 0, 0], spine2: [0.12, 0, 0], neck1: [0.38, 0, 0], neck2: [0.1, 0, 0], head: [0.12, 0, 0], jaw: [0.4, 0, 0], earL: [-0.9, 0, 0.25], earR: [-0.9, 0, -0.25] }, -0.1, 0.2) },
  { t: 1.95, p: pose({ spine1: [0.04, 0, 0], spine2: [0.05, 0, 0], neck1: [0.28, 0, 0], head: [0.08, 0, 0], jaw: [0.18, 0, 0], earL: [-0.8, 0, 0.2], earR: [-0.8, 0, -0.2] }, -0.05, 0.14) },
  { t: 2.5, p: pose({}) },
]);
const SLAM_PAWS: PawScript = {
  leg: 'F',
  keys: [
    { t: 1.3, p: null, pitch: 0.4 },
    { t: 1.48, p: [-0.21, 0.32, 0.92], pitch: -0.2, yaw: 0.1 },
    { t: 1.62, p: [-0.22, 0, 0.96], pitch: -0.1, yaw: 0.15 },
  ],
};

// stagger (authored lurching to its RIGHT): the body rolls and shifts, the right foreleg buckles, it steps to catch
const STAGGER = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.12, e: 'out', p: pose({ hips: [0, 0, 0.16], spine2: [0.04, 0, 0.1], neck1: [0.15, -0.3, 0.05], neck2: [0.05, -0.12, 0], head: [0.1, -0.25, 0.22], jaw: [0.3, 0, 0], earL: [-0.8, 0, 0.2], earR: [-0.8, 0, -0.2], sway: sw(-0.12) }, -0.08, -0.04) },
  { t: 0.4, p: pose({ hips: [0.02, 0, 0.22], spine2: [0.06, 0, 0.12], neck1: [0.26, -0.2, 0], neck2: [0.08, -0.08, 0], head: [0.15, -0.15, 0.15], jaw: [0.12, 0, 0], earL: [-0.7, 0, 0.18], earR: [-0.7, 0, -0.18], sway: sw(-0.16) }, -0.11, -0.02) },
  { t: 0.78, p: pose({ hips: [0, 0, 0.07], spine2: [0.02, 0, 0.04], neck1: [0.1, 0.14, 0], head: [0.0, 0.18, -0.12], earL: [-0.5, 0, 0.1], earR: [-0.5, 0, -0.1], sway: sw(-0.05) }, -0.04, 0) },
  { t: 1.3, p: pose({}) },
]);

const BRAKE = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.14, e: 'out', p: pose({ spine1: [-0.13, 0, 0], spine2: [-0.05, 0, 0], neck1: [-0.22, 0, 0], head: [-0.1, 0, 0], earL: [-0.35, 0, 0.1], earR: [-0.35, 0, -0.1] }, -0.07, -0.14) },
  { t: 0.4, p: pose({ spine1: [-0.06, 0, 0], neck1: [0.08, 0, 0], head: [0.04, 0, 0], earL: [-0.6, 0, 0.15], earR: [-0.6, 0, -0.15] }, -0.08, -0.08) },
  { t: 0.66, p: pose({ ...HEAD_LOW, jaw: [0.12, 0, 0] }, -0.045, 0.02) },
  { t: 1.0, p: pose({}) },
]);

// death: the forelegs buckle, it rolls heavily onto its side (impact + a small bounce), the head drops last
const DEATH = new Clip([
  { t: 0, p: pose({}) },
  { t: 0.45, e: 'in', p: pose({ hips: [0.12, 0, 0.1], spine1: [0.15, 0, 0.05], spine2: [0.18, 0, 0.05], neck1: [-0.25, 0, 0.1], neck2: [-0.1, 0, 0], head: [0.05, 0.1, 0.2], humL: [0.48, 0, 0.1], foreL: [-2.38, 0, 0], wristL: [1.34, 0, 0], humR: [0.48, 0, -0.1], foreR: [-2.38, 0, 0], wristR: [1.34, 0, 0], femL: [-0.87, 0, 0], tibL: [1.04, 0, 0], ankleL: [-0.44, 0, 0], femR: [-0.96, 0, 0], tibR: [1.15, 0, 0], ankleR: [-0.46, 0, 0], jaw: [0.2, 0, 0], earL: [-0.4, 0, 0], earR: [-0.4, 0, 0] }, -0.33, 0.04) },
  { t: 1.0, e: 'out', p: pose({ hips: [0.05, 0, 1.32], spine1: [0.05, 0.05, 0.04], spine2: [0.02, 0.1, 0.02], neck1: [0.25, 0.1, 0.04], neck2: [0.15, 0.1, 0], head: [0.3, 0.1, 0.1], humL: [-0.6, 0, -0.2], foreL: [-0.4, 0, 0], wristL: [0.6, 0, 0], humR: [-0.4, 0, 0.1], foreR: [-0.3, 0, 0], wristR: [0.5, 0, 0], femL: [-0.3, 0, -0.2], tibL: [0.5, 0, 0], ankleL: [0.3, 0, 0], femR: [-0.5, 0, 0.08], tibR: [0.4, 0, 0], ankleR: [0.3, 0, 0], jaw: [0.3, 0, 0], earL: [-0.3, 0, 0], earR: [-0.3, 0, 0], tail: [0.3, 0, 0] }, -0.545, 0.02) },
  { t: 1.16, p: pose({ hips: [0.05, 0, 1.25], spine1: [0.05, 0.05, 0.04], spine2: [0.02, 0.1, 0.02], neck1: [0.18, 0.1, 0.04], neck2: [0.12, 0.1, 0], head: [0.22, 0.1, 0.1], humL: [-0.65, 0, -0.25], foreL: [-0.38, 0, 0], wristL: [0.65, 0, 0], humR: [-0.45, 0, 0.1], foreR: [-0.32, 0, 0], wristR: [0.55, 0, 0], femL: [-0.35, 0, -0.22], tibL: [0.45, 0, 0], ankleL: [0.38, 0, 0], femR: [-0.55, 0, 0.09], tibR: [0.38, 0, 0], ankleR: [0.35, 0, 0], jaw: [0.32, 0, 0], earL: [-0.25, 0, 0], earR: [-0.25, 0, 0], tail: [0.32, 0, 0] }, -0.51, 0.02) },
  { t: 1.45, p: pose({ hips: [0.05, 0, 1.35], spine1: [0.04, 0.06, 0.03], spine2: [0.02, 0.13, 0.02], neck1: [0.14, 0.14, 0.04], neck2: [0.1, 0.1, 0.02], head: [0.22, 0.14, 0.1], humL: [-0.72, 0, -0.28], foreL: [-0.36, 0, 0], wristL: [0.68, 0, 0], toesL: [0.3, 0, 0], humR: [-0.52, 0, 0.11], foreR: [-0.34, 0, 0], wristR: [0.58, 0, 0], femL: [-0.42, 0, -0.24], tibL: [0.42, 0, 0], ankleL: [0.42, 0, 0], femR: [-0.58, 0, 0.1], tibR: [0.36, 0, 0], ankleR: [0.38, 0, 0], jaw: [0.34, 0, 0], earL: [-0.2, 0, 0], earR: [-0.2, 0, 0], tail: [0.34, 0, 0] }, -0.55, 0.02) },
  { t: 2.8, p: pose({ hips: [0.05, 0, 1.36], spine1: [0.04, 0.06, 0.03], spine2: [0.02, 0.14, 0.02], neck1: [0.1, -0.35, 0.04], neck2: [0.1, -0.25, 0.02], head: [0.2, -0.2, 0.1], humL: [-0.75, 0, -0.3], foreL: [-0.35, 0, 0], wristL: [0.7, 0, 0], toesL: [0.4, 0, 0], humR: [-0.55, 0, 0.12], foreR: [-0.35, 0, 0], wristR: [0.6, 0, 0], femL: [-0.45, 0, -0.25], tibL: [0.4, 0, 0], ankleL: [0.45, 0, 0], femR: [-0.6, 0, 0.1], tibR: [0.35, 0, 0], ankleR: [0.4, 0, 0], jaw: [0.36, 0, 0], earL: [-0.2, 0, 0], earR: [-0.2, 0, 0], tail: [0.35, 0, 0] }, -0.555, 0.02) },
]);

// the standing pose ("וַיָּקָם עָלַי"): hind legs are placed by IK, everything else FK; the forelegs hang relaxed
const REAR = pose({
  hips: [-1.2, 0, 0], spine1: [-0.08, 0, 0], spine2: [-0.06, 0, 0], neck1: [0.42, 0, 0], neck2: [0.32, 0, 0], head: [0.34, 0, 0],
  scapL: [0.25, 0, 0.05], humL: [1.12, 0.15, 0.22], foreL: [-1.15, 0, 0], wristL: [0.95, 0, 0], toesL: [0.35, 0, 0],
  scapR: [0.25, 0, -0.05], humR: [1.12, -0.15, -0.22], foreR: [-1.15, 0, 0], wristR: [0.95, 0, 0], toesR: [0.35, 0, 0],
  tail: [0.6, 0, 0], earL: [0.1, 0, 0], earR: [0.1, 0, 0],
}, 0, 0);

const ACTIONS: Record<BearActionName, ActionDef> = {
  swipe: { clip: SWIPE, paws: [SWIPE_PAW] },
  swipeHigh: { clip: SWIPE_HIGH, rearMin: (t) => 0.7 * smoothstep(0, 0.22, t) * (1 - smoothstep(0.7, 0.95, t)) },
  hurt: { clip: HURT, additive: true },
  huff: {
    clip: HUFF,
    paws: [STOMP_PAW(1.62, 1.86, 0.1)],
    cues: [{ t: 0.55, cue: 'huff', at: 'head' }, { t: 0.82, cue: 'jawPop', at: 'head' }, { t: 1.3, cue: 'huff', at: 'head' }, { t: 1.52, cue: 'jawPop', at: 'head' }, { t: 1.86, cue: 'stomp', at: 'paw' }],
  },
  stomp: { clip: STOMP, paws: [STOMP_PAW(0, 0.56, 0.28)], cues: [{ t: 0.56, cue: 'stomp', at: 'paw' }, { t: 0.66, cue: 'jawPop', at: 'head' }] },
  bite: { clip: BITE, paws: [BITE_PAW], cues: [{ t: 0.5, cue: 'snap', at: 'head' }] },
  rearSlam: {
    clip: REAR_SLAM,
    paws: [SLAM_PAWS],
    rearSet: (t) => (t < 1.3 ? smoothstep(0, 0.9, t) : 1 - smoothstep(1.3, 1.6, t)),
    cues: [{ t: 1.62, cue: 'slam', at: 'front' }],
  },
  stagger: {
    clip: STAGGER,
    steps: [{ t: 0.14, leg: 'f', d: [-0.16, 0.06], dur: 0.2 }, { t: 0.34, leg: 'h', d: [-0.12, 0.0], dur: 0.26 }, { t: 0.82, leg: 'of', d: [0.0, 0.05], dur: 0.28 }],
  },
  brake: {
    clip: BRAKE,
    steps: [{ t: 0.0, leg: 'f', d: [0.0, 0.42], dur: 0.13 }, { t: 0.03, leg: 'of', d: [0.0, 0.36], dur: 0.13 }],
    cues: [{ t: 0.12, cue: 'skid', at: 'front' }, { t: 0.56, cue: 'huff', at: 'head' }, { t: 0.72, cue: 'jawPop', at: 'head' }],
  },
};

const mirrorName = (n: string) => (n.endsWith('L') ? n.slice(0, -1) + 'R' : n.endsWith('R') ? n.slice(0, -1) + 'L' : n);

// ------------------------------------------------------------------------------------------------ legs / gaits

interface LegDef {
  key: 'fl' | 'fr' | 'hl' | 'hr';
  front: boolean;
  side: number; // +1 left, -1 right
  scap: string | null;
  upper: string;
  lower: string;
  end: string;
  toe: string;
  contact: THREE.Vector3; // rest ground contact (root space): the palm / the middle of the sole
  ball: THREE.Vector3; // the ball of the paw (the heel rolls up over it)
  heel: THREE.Vector3; // the heel (heel strike: the toes come down over it)
  pole: THREE.Vector3;
}

const pos = (n: string) => new THREE.Vector3(...RIG.bones[BI[n]].pos);

const LEG_DEFS: LegDef[] = [
  { key: 'fl', front: true, side: 1, scap: 'scapL', upper: 'humL', lower: 'foreL', end: 'wristL', toe: 'toesL', contact: new THREE.Vector3(0.184, 0, 0.445), ball: new THREE.Vector3(0.184, 0, 0.475), heel: new THREE.Vector3(0.184, 0, 0.36), pole: new THREE.Vector3(0.25, 0, -1) },
  { key: 'fr', front: true, side: -1, scap: 'scapR', upper: 'humR', lower: 'foreR', end: 'wristR', toe: 'toesR', contact: new THREE.Vector3(-0.184, 0, 0.445), ball: new THREE.Vector3(-0.184, 0, 0.475), heel: new THREE.Vector3(-0.184, 0, 0.36), pole: new THREE.Vector3(-0.25, 0, -1) },
  { key: 'hl', front: false, side: 1, scap: null, upper: 'femL', lower: 'tibL', end: 'ankleL', toe: 'htoesL', contact: new THREE.Vector3(0.18, 0, -0.47), ball: new THREE.Vector3(0.18, 0, -0.37), heel: new THREE.Vector3(0.18, 0, -0.6), pole: new THREE.Vector3(0.3, 0.3, 1) },
  { key: 'hr', front: false, side: -1, scap: null, upper: 'femR', lower: 'tibR', end: 'ankleR', toe: 'htoesR', contact: new THREE.Vector3(-0.18, 0, -0.47), ball: new THREE.Vector3(-0.18, 0, -0.37), heel: new THREE.Vector3(-0.18, 0, -0.6), pole: new THREE.Vector3(-0.3, 0.3, 1) },
];

interface GaitDef {
  /** phase offsets fl, fr, hl, hr */
  off: [number, number, number, number];
  duty: (v: number) => number;
  /** stride frequency (Hz) at speed v (m/s) */
  freq: (v: number) => number;
  liftF: number;
  liftH: number;
  /** touchdown weight (girdle dip) per m/s */
  thump: number;
}
const GAITS: GaitDef[] = [
  // 0 walk: lateral sequence (LH, LF, RH, RF), a long duty factor
  { off: [0.25, 0.75, 0, 0.5], duty: (v) => 0.74 - 0.06 * clamp(v / 1.9, 0, 1), freq: (v) => 0.62 + 0.42 * v, liftF: 0.1, liftH: 0.075, thump: 1 },
  // 1 amble: the lateral running walk (the rolling gait of a hurrying bear)
  { off: [0.2, 0.7, 0, 0.5], duty: (v) => clamp(0.52 - 0.03 * (v - 2), 0.4, 0.55), freq: (v) => 1.0 + 0.24 * v, liftF: 0.13, liftH: 0.11, thump: 0.9 },
  // 2 rotary gallop (LH, RH, RF, LF) with a gathered suspension after the forefeet
  { off: [0.57, 0.45, 0, 0.12], duty: (v) => clamp(0.37 - 0.008 * (v - 4.4), 0.3, 0.4), freq: (v) => 1.85 + 0.075 * v, liftF: 0.2, liftH: 0.19, thump: 0.8 },
  // 3 bipedal (reared): the hind legs alternate in short, wide, shuffling steps
  { off: [0, 0, 0, 0.5], duty: () => 0.62, freq: (v) => 0.95 + 1.1 * v, liftF: 0, liftH: 0.06, thump: 1.3 },
];

// ------------------------------------------------------------------------------------------------ model

interface Leg {
  def: LegDef;
  front: boolean;
  side: number;
  is: number; // scapula bone (-1: hind leg)
  iu: number;
  il: number;
  ie: number;
  it: number;
  offs: THREE.Vector3; // end joint − contact (rest, root space)
  ballOffs: THREE.Vector3; // end joint − ball
  heelOffs: THREE.Vector3; // end joint − heel
  ballD: THREE.Vector3; // ball − contact
  heelD: THREE.Vector3; // heel − contact
  /** world: the contact point while planted */
  plant: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** -1 planted, else 0..1 swing progress */
  swing: number;
  swingDur: number;
  lift: number;
  /** a forced step lands here (root space offset from the rest contact), else null */
  forced: THREE.Vector2 | null;
  wantPrev: boolean;
  cool: number;
  /** 0..1: the leg is solved by IK (else the FK pose of rear / death) */
  ikW: number;
  /** 0..1: the IK target is a scripted one (an action's paw) */
  scrW: number;
  scr: THREE.Vector3; // root-space scripted contact
  scrPitch: number;
  scrYaw: number;
  /** root-space contact this frame (for scripts that start "where the paw is") */
  cur: THREE.Vector3;
  pitch: number;
  /** how far the end joint may be from the upper joint before a planted paw must lift (the shoulder blade adds some) */
  reach: number;
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

interface Spring {
  x: number;
  v: number;
}

interface ActionState {
  name: BearActionName;
  def: ActionDef;
  t: number;
  side: number; // -1 right (as authored), +1 left (mirrored)
  events: { t: number; fn: () => void; fired: boolean }[];
  cues: boolean[];
  steps: boolean[];
  pawStart: (THREE.Vector3 | null)[]; // per leg: the script's start contact
  landed: boolean[];
  mirrored: Clip | null;
}

const _e = new THREE.Euler();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3();
const _v6 = new THREE.Vector3();
const _m1 = new THREE.Matrix4();
const tmp = new THREE.Vector3();
const AX = new THREE.Vector3(1, 0, 0);

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

/** Catmull-Rom through the keys' points (root space) */
function cr(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

const bump = (x: number) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));
const frac = (x: number) => x - Math.floor(x);
const wrapD = (d: number) => d - Math.round(d);
const TAU = Math.PI * 2;
const HOLDS: BearHold[] = ['none', 'rear', 'carry', 'down', 'held'];
const ROT_X = (out: THREE.Vector3, v: THREE.Vector3, a: number) => {
  const c = Math.cos(a), s = Math.sin(a);
  return out.set(v.x, v.y * c - v.z * s, v.y * s + v.z * c);
};

export interface BearModelOptions {
  /** content tier ('low' on phones). Defaults to engine.quality.name when available, else 'high'. */
  quality?: BearQuality;
}

export class BearModel {
  readonly root = new THREE.Group();
  /** named bones (THREE.Bone). Aliases of the previous rig: pelvis, spine, neck, head, jaw. */
  readonly j: Record<string, THREE.Object3D> = {};
  readonly mouthSocket = new THREE.Object3D();
  /** the chin ruff on the lower jaw (1 Sam 17:35 "בִּזְקָנוֹ": Radak — the beard together with the lower jaw) */
  readonly beardSocket = new THREE.Object3D();
  /** where David's hand grips (the fur under the chin with the lower jaw) — the same socket as beardSocket */
  readonly gripSocket = this.beardSocket;
  readonly headCenter = new THREE.Object3D();
  readonly quality: BearQuality;
  /** resolves when the meshes are built and attached */
  readonly ready: Promise<void>;
  /** commanded speed (BearActor sets it; the legs follow the root's measured motion) */
  speed = 0;
  hold: BearHold = 'none';
  roar = 0; // 0..1 mouth open / roar intensity (set by gameplay)
  /** 0..1 — the fight wears it down: panting, the head low, slower moves (actions play at 1 − 0.3·fatigue) */
  fatigue = 0;
  /** hold 'held': the world point David's hand pulls the grip socket (chin + lower jaw) toward; null = no pull */
  gripPull: THREE.Vector3 | null = null;
  /** hold 'held': 0..1 how hard it fights the grip (thrashing head, scrabbling forepaws) */
  struggle = 0;
  /** sound / effect cues of the moves (huff, jaw-pop, stomp, snap, slam, landing, skid, collapse) */
  onCue?: (cue: BearCue, at: THREE.Vector3, strength: number) => void;
  /** every paw touchdown: leg 0 fl, 1 fr, 2 hl, 3 hr; strength ≈ 0.3 (idle step) .. 1.5 (gallop / slam) */
  onStep?: (leg: number, at: THREE.Vector3, strength: number) => void;
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
  /**
   * film hooks (perf, CUT v3 H2 — additive, gameplay leaves them at their defaults): `breathDepth` scales the idle
   * breathing (1 = its own), `breathRate` its pace; `headUp` 0..1 lifts the head and pushes it forward (alert: the eyes
   * opening on the lamb). See filmAnimals.bearInThicket.
   */
  breathDepth = 1;
  breathRate = 1;
  headUp = 0;
  private breathPh = 0;
  deathT = -1;
  ground?: (x: number, z: number) => number;
  /** a forepaw touched down while walking on all fours (a hind paw while reared) */
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
  private holdW: Record<BearHold, number> = { none: 1, rear: 0, carry: 0, down: 0, held: 0 };
  private time = 0;
  private action: ActionState | null = null;
  private look = new THREE.Vector2();
  private roarS = 0;
  private sniffT = 2;
  private sniff = 0;
  private earT = [1.5, 3.2];
  private ear = [0, 0];
  private legs: Leg[] = [];
  private clipPoses = new Map<Clip, Pose>();
  private mirrorCache = new Map<Clip, Clip>();
  // root tracking
  private tracked = false;
  private rootPos = new THREE.Vector3();
  private rootYaw = 0;
  private velW = new THREE.Vector3();
  private prevVelW = new THREE.Vector3();
  private accW = new THREE.Vector3();
  private vF = 0;
  private vL = 0;
  private vS = 0;
  private yawRate = 0;
  private rootInv = new THREE.Matrix4();
  // gait
  private gait = 0;
  private gw = [1, 0, 0, 0];
  private off = [0.25, 0.75, 0, 0.5];
  private freq = 0.8;
  private duty = 0.72;
  private phase = 0;
  private loco = 0;
  private moving = false;
  // body
  private springF: Spring = { x: 0, v: 0 };
  private springH: Spring = { x: 0, v: 0 };
  private bend = 0;
  private lean = 0;
  private rearK = 0;
  private rearDrop = false;
  private rearDesc = false;
  private rearRising = false;
  private sway = 0;
  private pant = 0;
  private furLag = new THREE.Vector3();
  private beardRest = new THREE.Vector3();
  private heldNoise = 0;

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
    this.beardRest.set(...RIG.sockets.beard.pos).sub(this.bones[BI.jaw].restW);
    // ---- legs
    for (const def of LEG_DEFS) {
      const endW = pos(def.end);
      this.legs.push({
        def, front: def.front, side: def.side,
        is: def.scap ? BI[def.scap] : -1, iu: BI[def.upper], il: BI[def.lower], ie: BI[def.end], it: BI[def.toe],
        offs: endW.clone().sub(def.contact), ballOffs: endW.clone().sub(def.ball), heelOffs: endW.clone().sub(def.heel),
        ballD: def.ball.clone().sub(def.contact), heelD: def.heel.clone().sub(def.contact),
        plant: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(),
        swing: -1, swingDur: 0.3, lift: 0.08, forced: null, wantPrev: false, cool: 0,
        ikW: 1, scrW: 0, scr: new THREE.Vector3(), scrPitch: 0, scrYaw: 0, cur: def.contact.clone(), pitch: 0,
        reach: pos(def.upper).distanceTo(pos(def.lower)) + pos(def.lower).distanceTo(endW) + (def.front ? 0.14 : 0.03),
      });
    }
    this.fk();
    this.writeBones();
    // (load1, wave 4) the bear's ~2.7 MB (mesh + fur textures) are not needed before the game: they download once the
    // gate opens (main.ts: when the start screen is up), never competing with the first set's downloads
    this.ready = (BearModel.loadAfter ?? Promise.resolve())
      .then(() => loadAssets(this.quality))
      .then((a) => this.build(a))
      .catch((e) => console.error('[bear] asset load failed', e));
  }

  /** load1: the bear's assets are fetched after this resolves (null = at once) */
  static loadAfter: Promise<unknown> | null = null;

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

  /**
   * Play a move (see BEAR_MOVES for the timings). `events` fire on their CLIP time (so a strike event stays on the
   * strike frame when fatigue slows the clip). `opts.side`: 1 = the left paw / lurch to the left, -1 = right (default).
   */
  play(name: BearActionName, events: { t: number; fn: () => void }[] = [], opts: { side?: number } = {}) {
    const def = ACTIONS[name];
    const side = (opts.side ?? -1) >= 0 ? 1 : -1;
    if (this.action) this.finishAction(this.action);
    // the paw that scripts start from where it is
    this.action = {
      name, def, t: 0, side,
      events: events.map((e) => ({ ...e, fired: false })),
      cues: (def.cues ?? []).map(() => false),
      steps: (def.steps ?? []).map(() => false),
      pawStart: [null, null, null, null],
      landed: [false, false, false, false],
      mirrored: side > 0 ? this.mirrored(def.clip) : null,
    };
  }

  /** true while a move plays */
  get busy() {
    return !!this.action;
  }

  /** the move playing now: its name, clip time, and whether it is in its strike or counter window */
  get current(): { name: BearActionName; t: number; dur: number; striking: boolean; open: boolean; tell: boolean } | null {
    const a = this.action;
    if (!a) return null;
    const m = BEAR_MOVES[a.name];
    const inW = (w?: [number, number]) => !!w && a.t >= w[0] && a.t <= w[1];
    return { name: a.name, t: a.t, dur: m.dur, striking: m.hit !== undefined && Math.abs(a.t - m.hit) < 0.06, open: inW(m.open), tell: inW(m.tell) };
  }

  /** clip-time rate of the moves (fatigue slows them): real seconds = clip seconds / actionRate */
  get actionRate() {
    return 1 - 0.3 * clamp(this.fatigue, 0, 1);
  }

  /** 0..1 how far the bear has risen onto its hind legs (0 on all fours) */
  get reared() {
    return this.rearK;
  }

  /** re-plant every paw where the body stands now (after a teleport: BearActor.place calls it) */
  resetMotion() {
    this.tracked = false;
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
    this.root.updateMatrixWorld(true);
    if (dt <= 0) return;
    this.time += dt;
    this.furU.uTime.value = this.time;
    const t = this.time;
    this.trackRoot(dt);
    const fat = clamp(this.fatigue, 0, 1);

    // ---- holds
    for (const k of HOLDS) {
      const rate = k === 'down' ? 3 : k === 'held' ? 4 : 5;
      this.holdW[k] = damp(this.holdW[k], this.hold === k ? 1 : 0, rate, dt);
    }
    // struck down while standing it first drops forward onto its forepaws; the collapse starts once it is down on them
    if (this.hold === 'down') this.deathT = this.deathT < 0 ? 0 : this.rearK < 0.22 ? this.deathT + dt : 0;
    else this.deathT = -1;
    const down = this.holdW.down * smoothstep(0, 0.12, Math.max(0, this.deathT));
    const held = this.holdW.held * (1 - down);
    const cw = this.holdW.carry * (1 - down);

    // ---- the action clock (fatigue slows the moves; the events stay on their frames)
    const a = this.action;
    if (a) a.t += dt * this.actionRate;
    const def = a?.def;

    // ---- rearing: sits back onto the haunches, rises, stands; drops forward onto the forepaws
    if (this.hold === 'rear') {
      // a standing bear drops to all fours to cover ground fast, and rises again when it slows
      if (this.vS > 1.9) this.rearDrop = true;
      else if (this.vS < 1.0) this.rearDrop = false;
    } else this.rearDrop = false;
    const rearWant = this.hold === 'rear' && !this.rearDrop ? 1 : 0;
    const r0 = this.rearK;
    if (a && def?.rearSet) this.rearK = def.rearSet(a.t);
    else {
      const rmin = a && def?.rearMin ? def.rearMin(a.t) : 0;
      const want = Math.max(rearWant, rmin);
      const upRate = rmin > rearWant ? 0.4 : 1.05;
      this.rearK = want > this.rearK ? Math.min(want, this.rearK + dt / upRate) : Math.max(want, this.rearK - dt / (this.hold === 'down' ? 0.55 : 0.62));
    }
    const r = this.rearK;
    if (r > r0 + 1e-5) this.rearRising = true;
    else if (r < r0 - 1e-5) this.rearRising = false;
    if (r < r0 && r0 >= 0.5 && r < 0.5) this.rearDesc = true; // coming down: the forepaws reach for the ground
    if (r >= 0.5) this.rearDesc = false;
    const upW = smoothstep(0.12, 0.85, r);
    const biped = r > 0.5;

    // ---- gait (hysteresis: no long-lived hybrid gait)
    const v = this.vS;
    if (biped) this.gait = 3;
    else if (this.gait === 3) this.gait = v > 4.4 ? 2 : v > 2.0 ? 1 : 0;
    else if (this.gait === 0 && v > 2.0) this.gait = v > 4.4 ? 2 : 1;
    else if (this.gait === 1 && v > 4.4) this.gait = 2;
    else if (this.gait === 1 && v < 1.7) this.gait = 0;
    else if (this.gait === 2 && v < 3.9) this.gait = v < 1.7 ? 0 : 1;
    let gsum = 0, fT = 0, dT = 0;
    for (let k = 0; k < 4; k++) {
      this.gw[k] = damp(this.gw[k], k === this.gait ? 1 : 0, 6, dt);
      gsum += this.gw[k];
    }
    for (let k = 0; k < 4; k++) {
      const w = this.gw[k] / gsum;
      fT += w * GAITS[k].freq(v);
      dT += w * GAITS[k].duty(v);
    }
    const G = GAITS[this.gait];
    for (let i = 0; i < 4; i++) this.off[i] = frac(this.off[i] + clamp(wrapD(G.off[i] - this.off[i]), -dt * 2.8, dt * 2.8));
    this.freq = damp(this.freq, fT * (1 - 0.12 * fat), 10, dt);
    this.duty = damp(this.duty, dT, 10, dt);
    this.moving = v > 0.06;
    if (this.moving) this.phase = frac(this.phase + this.freq * dt);
    this.loco = damp(this.loco, smoothstep(0.05, 0.4, v), 6, dt);
    const [gWalk, gAmble, gGal, gBi] = this.gw.map((w) => w / gsum);

    // ---- which legs the locomotion owns (IK weights) and the actions' scripted paws
    const frontFree = smoothstep(0.22, 0.55, r); // the forelegs leave the ground as it rises
    for (let i = 0; i < 4; i++) {
      const L = this.legs[i];
      // (the paws stay planted through the buckle and the roll: the lower legs fold under it, the upper ones lift off as it
      // rolls; the lying pose takes over once it is down on its side)
      let ik = 1 - down * smoothstep(0.98, 1.12, Math.max(0, this.deathT));
      if (L.front) ik *= 1 - frontFree;
      L.ikW = ik;
      L.scrW = 0;
    }
    if (a && def) this.scriptPaws(a, def, dt);
    // the forepaws come back to the ground when it drops from a rear: re-planted ahead, where they will land
    if (a && def?.rearSet) this.rearDesc = false;
    if (this.rearDesc && r < 0.5) {
      for (let i = 0; i < 2; i++) {
        const L = this.legs[i];
        if (L.swing < 0 && L.forced === null && this.rearDesc && r > 0.4) {
          this.idealWorld(i, 0, L.plant);
          L.plant.addScaledVector(_v1.set(Math.sin(this.rootYaw), 0, Math.cos(this.rootYaw)), 0.12);
          L.plant.y = this.groundAt(L.plant.x, L.plant.z);
        }
      }
      if (r < 0.2) {
        this.rearDesc = false;
        this.springF.v -= 0.55;
        this.cue('land', this.frontPoint(_v5), 0.9);
        this.onFootfall?.();
      }
    }

    // ---- paws: planted in world space; lift on the gait clock, land on their own timer at a predicted spot
    this.stepLegs(dt, biped);

    // ---- FK layers
    const E = this.E;
    E.fill(0);
    this.hipsOff.set(0, 0, 0);
    this.lipOff.set(0, 0, 0);
    this.sway = 0;
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
        const rr = p.r[k];
        E[i * 3] += (rr[0] - E[i * 3]) * w;
        E[i * 3 + 1] += (rr[1] - E[i * 3 + 1]) * w;
        E[i * 3 + 2] += (rr[2] - E[i * 3 + 2]) * w;
      }
      this.hipsOff.y += ((p.hipsY ?? 0) - this.hipsOff.y) * w;
      this.hipsOff.z += ((p.hipsZ ?? 0) - this.hipsOff.z) * w;
    };

    // idle: breathing (deeper and faster when tired: panting), sniffing, ears, tail
    const idle = 1 - this.loco;
    this.breathPh += dt * (1.35 + 2.4 * fat) * this.breathRate;
    const br = Math.sin(this.breathPh) * this.breathDepth * (1 + 1.6 * fat);
    add('spine2', 0.012 * br);
    add('spine1', -0.006 * br);
    this.hipsOff.y += 0.004 * br;
    if (this.headUp > 1e-3) {
      // the film's alert head (H2): up and forward, the neck lifting with it (-x lifts)
      add('neck1', -0.12 * this.headUp);
      add('neck2', -0.06 * this.headUp);
      add('head', 0.03 * this.headUp + 0.015 * br * this.headUp);
    }
    this.sniffT -= dt;
    if (this.sniffT < 0) {
      this.sniffT = 2.5 + Math.random() * 5;
      this.sniff = 1;
    }
    this.sniff = Math.max(0, this.sniff - dt * 0.7);
    const calm = (1 - fat) * (a ? 0.3 : 1);
    const sn = this.sniff * idle * calm;
    add('neck1', -0.12 * sn + 0.06 * idle, 0.18 * Math.sin(t * 0.21) * idle * calm);
    add('neck2', -0.05 * sn, 0.08 * Math.sin(t * 0.27 + 1) * idle * calm);
    add('head', -0.25 * sn + 0.05 * Math.sin(t * 0.37 + 2) * idle * calm, 0.1 * Math.sin(t * 0.31) * idle * calm, 0.04 * Math.sin(t * 0.19) * idle * calm);
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

    // fatigue: the head hangs, the ears droop sideways, it pants (the jaw working with the fast breath)
    if (fat > 1e-3) {
      this.pant = damp(this.pant, fat, 2, dt);
      add('neck1', 0.16 * this.pant);
      add('head', 0.06 * this.pant);
      add('earL', -0.25 * this.pant, 0, 0.3 * this.pant);
      add('earR', -0.25 * this.pant, 0, -0.3 * this.pant);
      add('jaw', (0.12 + 0.1 * (0.5 + 0.5 * Math.sin(this.breathPh))) * this.pant);
      this.hipsOff.y -= 0.025 * this.pant;
    }

    // ---- locomotion on all fours: the girdles dip onto the planted legs, roll, sway; the spine and the head
    const quadW = 1 - upW;
    const lw = this.loco * quadW;
    const sup = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const L = this.legs[i];
      sup[i] = L.swing < 0 ? 1 : 1 - bump(L.swing);
    }
    // girdle springs (touchdown impulses in land()); target: vault over the stance legs (highest at mid-stance)
    const vaultF = this.vault(0, 1) * 0.016 * (gWalk + 0.6 * gAmble);
    const vaultH = this.vault(2, 3) * 0.014 * (gWalk + 0.6 * gAmble + gBi);
    this.springStep(this.springF, vaultF * lw, dt);
    this.springStep(this.springH, vaultH * (lw + gBi * this.loco), dt);
    // the terrain under the planted paws (root space): the girdles follow it so no paw floats or sinks
    const tF = this.plantedHeight(0, 1), tH = this.plantedHeight(2, 3);
    const hipsDy = this.springH.x + clamp(tH, -0.2, 0.12) * quadW;
    const chestDy = this.springF.x + clamp(tF, -0.2, 0.12);
    this.hipsOff.y += hipsDy;
    add('spine1', (-(chestDy - hipsDy) / 0.72) * quadW);
    if (lw > 1e-3) {
      const kRF = (0.05 * gWalk + 0.075 * gAmble + 0.03 * gGal) * lw;
      const kRH = (0.055 * gWalk + 0.075 * gAmble + 0.02 * gGal) * lw;
      const rollH = kRH * (sup[2] - sup[3]);
      const rollF = kRF * (sup[0] - sup[1]);
      add('hips', 0, 0, rollH);
      add('spine1', 0, 0, -rollH * 0.7);
      add('spine2', 0, 0, rollF);
      // weight over the stance legs (lateral sway of the rump, the chest swinging with the forelegs)
      this.hipsOff.x += 0.022 * (sup[2] - sup[3]) * (gWalk + 0.5 * gAmble) * lw;
      add('spine1', 0, 0.035 * (sup[0] - sup[1]) * (gWalk + 0.5 * gAmble) * lw);
      // the gallop: the back flexes (hind feet reaching under the chest) and extends; the body rocks
      const P = this.phase * TAU;
      const flex = Math.sin(P - 0.35);
      add('hips', -0.12 * flex * gGal * lw);
      add('spine1', 0.22 * flex * gGal * lw);
      add('spine2', 0.07 * flex * gGal * lw);
      this.hipsOff.y += 0.045 * Math.sin(P + 1.9) * gGal * lw;
      // head low and swinging in the walk, nodding with the forefeet; pumping in the gallop (counter to the body)
      add('neck1', (0.17 * gWalk + 0.09 * gAmble - 0.06 * gGal) * lw + (0.035 * Math.sin(2 * P + 1.0) * (gWalk + gAmble) + 0.13 * Math.sin(P + 2.1) * gGal) * lw, 0.075 * Math.sin(P + 0.9) * (gWalk + 0.6 * gAmble) * lw);
      add('head', (0.04 * gWalk + 0.05 * Math.sin(2 * P + 1.6) * gWalk - 0.09 * Math.sin(P + 2.6) * gGal) * lw, 0.05 * Math.sin(P + 1.3) * (gWalk + 0.6 * gAmble) * lw);
      add('tail', 0.15 * gGal * lw, 0.1 * Math.sin(P) * gWalk * lw);
      // ears: pricked forward in a walk, back in the run
      add('earL', -0.25 * gGal * lw);
      add('earR', -0.25 * gGal * lw);
    }

    // turns bend the body: the front leads, the rump follows; at speed it leans into the curve
    this.bend = damp(this.bend, clamp(this.yawRate * (0.3 - 0.12 * gGal), -0.6, 0.6) * (1 - down), 7, dt);
    this.lean = damp(this.lean, clamp(-this.yawRate * v * 0.035, -0.2, 0.2) * quadW, 6, dt);
    const b = this.bend;
    add('hips', 0, -0.5 * b * quadW + 0.1 * b * upW, this.lean);
    add('spine1', 0, 0.5 * b * quadW);
    add('spine2', 0, 0.5 * b * quadW);
    add('neck1', 0, 0.3 * b);
    add('head', 0, 0.25 * b);

    // carrying a lamb in the jaws: head raised, jaws clamped on the lamb's back
    if (cw > 1e-3) {
      add('neck1', -0.4 * cw);
      add('neck2', -0.16 * cw);
      add('head', 0.24 * cw);
    }

    // rearing: sits back onto its haunches (r < 0.6), the torso pitches up, then stands; the balance sways
    if (r > 1e-3) {
      for (const k in REAR.r) {
        const i = BI[k] * 3, rr = REAR.r[k];
        E[i] += (rr[0] - E[i]) * upW;
        E[i + 1] += (rr[1] - E[i + 1]) * upW;
        E[i + 2] += (rr[2] - E[i + 2]) * upW;
      }
      // rising it sits back onto its haunches first; dropping, the hips give only a little
      const sit = bump(clamp(r / 0.68, 0, 1)) * (this.rearRising ? 1 : 0.3);
      this.hipsOff.y += -0.17 * sit + 0.02 * smoothstep(0.6, 1, r);
      this.hipsOff.z += -0.1 * sit + 0.06 * smoothstep(0.5, 1, r);
      const st = upW * (1 - this.loco * 0.5);
      add('hips', 0.025 * Math.sin(t * 1.3) * st, 0.03 * Math.sin(t * 0.9) * st, 0.035 * Math.sin(t * 1.1 + 0.4) * st);
      add('spine2', 0.02 * Math.sin(t * 1.7 + 1) * st, 0, -0.02 * Math.sin(t * 1.1 + 0.9) * st);
      // the forelegs hang loose: they swing a little behind the sway (pendular, damped)
      add('humL', 0.1 * Math.sin(t * 1.1 - 0.5) * upW, 0, 0.05 * Math.sin(t * 1.1 + 0.2) * upW);
      add('humR', 0.1 * Math.sin(t * 1.1 + 0.4) * upW, 0, -0.05 * Math.sin(t * 1.1 - 0.3) * upW);
      add('wristL', 0.12 * Math.sin(t * 1.1 - 1.1) * upW);
      add('wristR', 0.12 * Math.sin(t * 1.1 - 0.2) * upW);
      // bipedal steps: the torso rolls over the stance leg (a waddle), the forelegs swing for balance
      if (gBi > 1e-3 && this.loco > 1e-3) {
        const bw = gBi * this.loco * upW;
        const ws = sup[2] - sup[3];
        add('hips', 0, 0.08 * ws * bw, -0.1 * ws * bw);
        add('spine2', 0, -0.06 * ws * bw, 0.05 * ws * bw);
        add('humL', -0.22 * ws * bw);
        add('humR', 0.22 * ws * bw);
        this.hipsOff.x += 0.035 * ws * bw;
      }
    }

    // the move playing (full-body clip, mirrored for the other side) — additive flinch for 'hurt'
    if (a && def) {
      const clip = a.mirrored ?? def.clip;
      const p = clip.sample(a.t, this.poseFor(clip));
      const w = def.additive ? 1 : Math.max(0, Math.min(1, a.t / 0.08, (def.clip.duration - a.t) / 0.12));
      const fadeIn = def.additive ? Math.min(1, a.t / 0.04) : w;
      for (const k in p.r) {
        const rr = p.r[k];
        if (k === 'sway') {
          this.sway += rr[2] * (a.mirrored ? 1 : 1) * fadeIn;
          continue;
        }
        add(k, rr[0] * fadeIn, rr[1] * fadeIn, rr[2] * fadeIn);
      }
      this.hipsOff.y += (p.hipsY ?? 0) * fadeIn;
      this.hipsOff.z += (p.hipsZ ?? 0) * fadeIn;
      // the warning display: the low head swings from side to side; each huff is a forceful blow out (the chest
      // pumps, the lips puff); each jaw-pop the jaw drops open and claps shut
      if (a.name === 'huff') {
        const sw2 = smoothstep(0.3, 0.55, a.t) * (1 - smoothstep(1.45, 1.65, a.t));
        const ph = TAU * 1.05 * (a.t - 0.3);
        add('neck1', 0, 0.26 * Math.sin(ph) * sw2, 0.05 * Math.sin(ph) * sw2);
        add('head', 0, 0.14 * Math.sin(ph - 0.6) * sw2, 0.08 * Math.sin(ph - 0.6) * sw2);
      }
      for (const c of def.cues ?? []) {
        const d = a.t - c.t;
        if (c.cue === 'jawPop' && d > -0.13 && d < 0.05) add('jaw', 0.34 * (d < 0 ? smoothstep(-0.13, -0.05, d) : 1 - d / 0.05));
        else if (c.cue === 'huff' && d > -0.06 && d < 0.3) {
          const k = bump((d + 0.06) / 0.36);
          add('spine2', 0.055 * k);
          add('spine1', -0.02 * k);
          add('jaw', 0.07 * k);
          add('head', -0.05 * k);
          this.lipOff.y += 0.005 * k;
        }
      }
      this.runCues(a, def);
      for (const e of a.events) if (!e.fired && a.t >= e.t) {
        e.fired = true;
        e.fn();
      }
      if (a.t >= def.clip.duration) this.finishAction(a);
    }
    this.hipsOff.x += this.sway;

    // jaw: closed at rest (the bind pose is slightly open), clamped on a lamb, wide open when roaring
    this.roarS = damp(this.roarS, clamp(this.roar, 0, 1), 12, dt);
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

    // held by the jaw ("וְהֶחֱזַקְתִּי בִּזְקָנוֹ"): it pulls back on braced forelegs, the jaw forced open a little, the
    // ears flat; the head is forced up and aside by the grip (solved after FK below); struggling, it thrashes
    if (held > 1e-3) {
      const s = clamp(this.struggle, 0, 1);
      this.heldNoise += dt * (3 + 3 * s);
      const n1 = Math.sin(this.heldNoise * 1.3) + 0.5 * Math.sin(this.heldNoise * 2.9 + 1);
      const n2 = Math.sin(this.heldNoise * 1.7 + 2) + 0.4 * Math.sin(this.heldNoise * 3.7);
      this.hipsOff.z -= 0.1 * held;
      this.hipsOff.y -= 0.05 * held;
      add('spine1', -0.05 * held);
      add('jaw', 0.28 * held + 0.08 * s * Math.max(0, n2));
      add('earL', -0.85 * held, 0, 0.25 * held);
      add('earR', -0.85 * held, 0, -0.25 * held);
      add('neck1', 0.12 * n2 * s * held, 0.22 * n1 * s * held);
      add('head', 0.08 * n1 * s * held, 0.15 * n2 * s * held, 0.1 * n1 * s * held);
      add('hips', 0, 0.06 * n2 * s * held, 0.05 * n1 * s * held);
    }

    // look at (neck + head share the yaw / pitch)
    if (this.lookTarget && down < 0.5 && held < 0.5) {
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
    const lk = a && !def?.additive ? 0.45 : 1;
    add('neck1', -this.look.y * 0.25 * lk, this.look.x * 0.3 * lk);
    add('neck2', -this.look.y * 0.25 * lk, this.look.x * 0.3 * lk);
    add('head', -this.look.y * 0.3 * lk, this.look.x * 0.35 * lk);

    // death: the forelegs buckle (the paws still planted), it rolls heavily onto its side, the breath fades
    if (down > 1e-3) {
      const dtm = Math.max(0, this.deathT);
      const dp = DEATH.sample(dtm, this.poseFor(DEATH));
      const breathe = Math.max(0, 1 - this.deathT / 5) * Math.sin(t * 2.2) * 0.02;
      layer(dp, down);
      add('spine2', breathe * down);
      if (this.deathT >= 1.0 && this.deathT - dt < 1.0) {
        this.cue('collapse', this.bodyPoint(_v5), 1.3);
      }
    }

    // ---- fur inertia: the pelt lags the body's accelerations (loose skin and long guard hair)
    {
      const ax = clamp(-this.accW.x * 0.006, -0.12, 0.12), az = clamp(-this.accW.z * 0.006, -0.12, 0.12);
      // to root space (yaw only)
      const cs = Math.cos(this.rootYaw), sn2 = Math.sin(this.rootYaw);
      const lx = ax * cs - az * sn2, lz = ax * sn2 + az * cs;
      this.furLag.x = damp(this.furLag.x, lx, 6, dt);
      this.furLag.z = damp(this.furLag.z, lz, 6, dt);
      this.furLag.y = damp(this.furLag.y, clamp(-this.springF.v * 0.5, -0.1, 0.1), 10, dt);
      (this.furU.uWind.value as THREE.Vector3).set(0.05 + this.furLag.x, this.furLag.y, 0.02 + this.furLag.z);
    }

    // ---- FK solve
    this.applyE();
    this.fk();
    // the grip forces the head up and aside (CCD of the neck chain toward the pull point)
    if (held > 1e-3 && this.gripPull) this.solveGrip(held);

    // ---- IK: the legs
    for (let i = 0; i < 4; i++) this.solveLegFrame(i, dt, biped);

    this.writeBones();
    this.levelMouth();
    this.root.updateMatrixWorld(true);
  }

  // ---------------------------------------------------------------------------------------------- root tracking

  private trackRoot(dt: number) {
    const m = this.root.matrixWorld.elements;
    const px = m[12], py = m[13], pz = m[14];
    const yaw = Math.atan2(m[8], m[10]);
    this.rootInv.copy(this.root.matrixWorld).invert();
    const jump = Math.hypot(px - this.rootPos.x, pz - this.rootPos.z);
    if (!this.tracked || jump > Math.max(1.2, 3 * Math.abs(this.speed) * dt + 0.6)) {
      this.tracked = true;
      this.rootPos.set(px, py, pz);
      this.rootYaw = yaw;
      this.velW.set(0, 0, 0);
      this.prevVelW.set(0, 0, 0);
      this.accW.set(0, 0, 0);
      this.vF = this.vL = this.vS = 0;
      this.yawRate = 0;
      for (let i = 0; i < 4; i++) {
        const L = this.legs[i];
        this.idealWorld(i, 0, L.plant);
        L.swing = -1;
        L.forced = null;
        L.cool = 0;
      }
      this.springF.x = this.springF.v = this.springH.x = this.springH.v = 0;
      return;
    }
    const vx = (px - this.rootPos.x) / dt, vz = (pz - this.rootPos.z) / dt;
    this.prevVelW.copy(this.velW);
    this.velW.x = damp(this.velW.x, vx, 14, dt);
    this.velW.z = damp(this.velW.z, vz, 14, dt);
    this.accW.x = damp(this.accW.x, (this.velW.x - this.prevVelW.x) / dt, 8, dt);
    this.accW.z = damp(this.accW.z, (this.velW.z - this.prevVelW.z) / dt, 8, dt);
    let dy = yaw - this.rootYaw;
    while (dy > Math.PI) dy -= TAU;
    while (dy < -Math.PI) dy += TAU;
    this.yawRate = damp(this.yawRate, dy / dt, 10, dt);
    this.rootPos.set(px, py, pz);
    this.rootYaw = yaw;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    this.vF = this.velW.x * sn + this.velW.z * cs;
    this.vL = this.velW.x * cs - this.velW.z * sn;
    this.vS = damp(this.vS, Math.hypot(this.vF, this.vL), 8, dt);
  }

  private groundAt(x: number, z: number) {
    return this.ground ? this.ground(x, z) : this.rootPos.y;
  }

  /** where the paw of leg i should be planted (world), `tau` seconds ahead (constant velocity and turn rate) */
  private idealWorld(i: number, tau: number, out: THREE.Vector3) {
    const L = this.legs[i];
    const c = _v6.copy(L.def.contact);
    // the bent body: the forelegs swing round with the chest, the hind legs with the rump
    const ang = L.front ? this.bend * 0.5 : -this.bend * 0.5;
    const pz0 = L.front ? -0.15 : -0.5;
    const dx = c.x, dz = c.z - pz0;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    c.x = dx * ca + dz * sa;
    c.z = pz0 - dx * sa + dz * ca;
    // reared: the hind feet a little wider, under the hips
    if (!L.front && this.rearK > 0.5) {
      c.x += L.side * 0.035;
      c.z += 0.03;
    }
    // half the stance excursion ahead along the body's velocity (the paw then sweeps back through the rest spot)
    const half = (0.5 * this.duty) / Math.max(this.freq, 0.3) * (this.moving ? 1 : 0);
    c.x += this.vL * half;
    c.z += this.vF * half;
    const yaw = this.rootYaw + this.yawRate * tau;
    const px = this.rootPos.x + this.velW.x * tau, pz = this.rootPos.z + this.velW.z * tau;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    out.x = px + c.x * cs + c.z * sn;
    out.z = pz - c.x * sn + c.z * cs;
    out.y = this.groundAt(out.x, out.z);
    return out;
  }

  /** a root-space offset (x, z) from a leg's rest contact, to world */
  private restToWorld(i: number, dx: number, dz: number, out: THREE.Vector3) {
    const c = this.legs[i].def.contact;
    const cs = Math.cos(this.rootYaw), sn = Math.sin(this.rootYaw);
    const x = c.x + dx, z = c.z + dz;
    out.x = this.rootPos.x + x * cs + z * sn;
    out.z = this.rootPos.z - x * sn + z * cs;
    out.y = this.groundAt(out.x, out.z);
    return out;
  }

  // ---------------------------------------------------------------------------------------------- the paws

  private stepLegs(dt: number, biped: boolean) {
    const v = this.vS;
    const G = GAITS[this.gait];
    const moving = this.moving;
    for (let i = 0; i < 4; i++) {
      const L = this.legs[i];
      L.cool = Math.max(0, L.cool - dt);
      const owned = L.ikW > 0.5 && L.scrW < 0.5 && !(biped && L.front);
      if (L.swing >= 0) {
        // in the air: re-aim at the landing spot predicted for the moment it lands
        L.swing += dt / L.swingDur;
        const rem = Math.max(0, (1 - L.swing) * L.swingDur);
        if (L.forced) this.restToWorld(i, L.forced.x, L.forced.y, L.to);
        else this.idealWorld(i, rem, L.to);
        if (L.swing >= 1) this.land(i);
        L.wantPrev = moving && frac(this.phase + this.off[i]) >= this.duty;
        continue;
      }
      if (!owned) {
        L.wantPrev = false;
        continue;
      }
      const u = frac(this.phase + this.off[i]);
      const want = moving && u >= this.duty;
      const err = this.idealWorld(i, 0, _v2).distanceTo(_v1.copy(L.plant).setY(_v2.y));
      const maxErr = L.front ? 0.62 : 0.72;
      // a paw the leg can no longer reach (the body has run on past it) lifts now instead of dragging behind
      let overreach = false;
      if (moving && L.cool <= 0) {
        _v1.copy(L.plant).applyMatrix4(this.rootInv).add(L.offs);
        overreach = _v1.distanceTo(this.bones[L.iu].wp) > L.reach;
      }
      if ((want && !L.wantPrev) || overreach) {
        const dur = clamp((1 - this.duty) / Math.max(this.freq, 0.3), 0.14, 0.6);
        this.startSwing(i, dur, (L.front ? G.liftF : G.liftH) * (0.55 + 0.45 * smoothstep(0.1, 1.2, v)) + (L.front ? 0.02 : 0.015));
      } else if (!moving || err > maxErr) {
        // standing (or a paw left far behind): step it back under the body when it has drifted — this is how the
        // bear turns on the spot (the forepaws walk round, the hind paws pivot), one paw of a girdle at a time
        const thr = moving ? maxErr : L.front ? 0.11 : 0.13;
        const mate = this.legs[i ^ 1];
        if (err > thr && L.cool <= 0 && mate.swing < 0 && mate.cool < 0.06) {
          this.startSwing(i, L.front ? 0.3 : 0.34, 0.07);
        }
      }
      L.wantPrev = want;
    }
  }

  private startSwing(i: number, dur: number, lift: number) {
    const L = this.legs[i];
    L.from.copy(L.plant);
    L.swing = 0;
    L.swingDur = dur;
    L.lift = lift;
    this.idealWorld(i, dur, L.to);
  }

  /** a forced step of leg i to (dx, dz) off its rest contact (root space), taking `dur` s */
  private forceStep(i: number, dx: number, dz: number, dur: number) {
    const L = this.legs[i];
    if (L.ikW < 0.5) return;
    if (L.swing >= 0) L.plant.copy(this.swingPos(L, _v2));
    L.forced = (L.forced ?? new THREE.Vector2()).set(dx, dz);
    L.from.copy(L.plant);
    L.swing = 0;
    L.swingDur = dur;
    L.lift = 0.06 + 0.1 * Math.min(1, Math.hypot(dx, dz) * 2);
    this.restToWorld(i, dx, dz, L.to);
  }

  private land(i: number) {
    const L = this.legs[i];
    L.plant.copy(L.to);
    L.swing = -1;
    L.forced = null;
    L.cool = 0.07;
    const v = this.vS;
    const G = GAITS[this.gait];
    const s = (0.32 + 0.55 * smoothstep(0, 6, v)) * G.thump * (1 + 0.35 * this.fatigue);
    (L.front ? this.springF : this.springH).v -= 0.2 * s;
    const quad = this.rearK < 0.5;
    if (this.loco > 0.5 && (quad ? L.front : !L.front)) this.onFootfall?.();
    this.onStep?.(i, L.plant, s);
  }

  private swingPos(L: Leg, out: THREE.Vector3) {
    const s = clamp(L.swing, 0, 1);
    const e = s - Math.sin(TAU * s) / TAU; // cycloid: the paw leaves and arrives with no speed
    out.lerpVectors(L.from, L.to, e);
    out.y = lerp(L.from.y, L.to.y, e) + L.lift * Math.pow(bump(Math.min(1, s * 1.06)), 0.85);
    if (L.front) {
      // the forepaw paddles outward through the swing (the rolling, toed-in gait of a bear)
      const o = L.side * 0.045 * bump(s) * this.loco;
      out.x += o * Math.cos(this.rootYaw);
      out.z -= o * Math.sin(this.rootYaw);
    }
    return out;
  }

  /** support-weighted vault of a girdle: 1 at mid-stance of its planted legs, centred on 0 */
  private vault(a: number, b: number) {
    let s = 0;
    for (const i of [a, b]) {
      const L = this.legs[i];
      if (L.swing >= 0 || !this.moving) continue;
      const u = frac(this.phase + this.off[i]);
      s += bump(clamp(u / Math.max(this.duty, 0.1), 0, 1));
    }
    return s * 0.5 - 0.32;
  }

  /** mean root-space height of the ground under a girdle's planted paws */
  private plantedHeight(a: number, b: number) {
    let s = 0, n = 0;
    for (const i of [a, b]) {
      const L = this.legs[i];
      if (L.ikW < 0.5) continue;
      const p = L.swing < 0 ? L.plant : L.to;
      _v1.copy(p).applyMatrix4(this.rootInv);
      s += _v1.y;
      n++;
    }
    return n ? s / n : 0;
  }

  private springStep(S: Spring, target: number, dt: number) {
    const k = 230, c = 2 * 0.42 * Math.sqrt(k);
    const n = dt > 0.02 ? 2 : 1;
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const acc = -k * (S.x - target) - c * S.v;
      S.v += acc * h;
      S.x += S.v * h;
    }
    S.x = clamp(S.x, -0.14, 0.08);
  }

  // ---------------------------------------------------------------------------------------------- the moves

  private mirrored(c: Clip): Clip {
    let m = this.mirrorCache.get(c);
    if (!m) {
      m = new Clip(c.keys.map((k) => {
        const r: Record<string, [number, number, number]> = {};
        for (const n in k.p.r) {
          const e = k.p.r[n];
          r[mirrorName(n)] = [e[0], -e[1], -e[2]];
        }
        return { t: k.t, e: k.e, p: { r, hipsY: k.p.hipsY, hipsZ: k.p.hipsZ } };
      }));
      this.mirrorCache.set(c, m);
    }
    return m;
  }

  /** the scripted paws of a move (root-space paths), and its forced steps */
  private scriptPaws(a: ActionState, def: ActionDef, dt: number) {
    const sideIdx = a.side > 0 ? 0 : 1; // foreleg on the acting side: 0 fl / 1 fr
    for (const ps of def.paws ?? []) {
      const legs = ps.leg === 'F' ? [0, 1] : ps.leg === 'f' ? [sideIdx] : [sideIdx + 2];
      const k0 = ps.keys[0], kN = ps.keys[ps.keys.length - 1];
      for (const li of legs) {
        const L = this.legs[li];
        if (a.t < k0.t || a.landed[li]) continue;
        // mirror: authored for the right side (x < 0); the left side flips x and the yaw
        const mx = L.side > 0 ? -1 : 1;
        if (!a.pawStart[li]) {
          a.pawStart[li] = L.cur.clone();
          if (L.swing >= 0) {
            L.swing = -1;
            L.forced = null;
          }
        }
        const st = a.pawStart[li]!;
        if (a.t >= kN.t) {
          // the paw lands: it is planted where the script put it
          a.landed[li] = true;
          _v1.set(kN.p ? kN.p[0] * mx : st.x, kN.p ? kN.p[1] : st.y, kN.p ? kN.p[2] : st.z);
          _v1.y = 0;
          L.plant.copy(_v1).applyMatrix4(this.root.matrixWorld);
          L.plant.y = this.groundAt(L.plant.x, L.plant.z);
          L.swing = -1;
          L.cool = 0.1;
          (L.front ? this.springF : this.springH).v -= 0.18;
          this.onStep?.(li, L.plant, 0.9);
          continue;
        }
        let i = 0;
        while (i < ps.keys.length - 2 && a.t > ps.keys[i + 1].t) i++;
        const A = ps.keys[i], B = ps.keys[i + 1];
        const P0 = ps.keys[Math.max(0, i - 1)], P3 = ps.keys[Math.min(ps.keys.length - 1, i + 2)];
        const u = clamp((a.t - A.t) / Math.max(1e-3, B.t - A.t), 0, 1);
        const pt = (k: PK, c: number) => (k.p ? (c === 0 ? k.p[0] * mx : k.p[c]) : c === 0 ? st.x : c === 1 ? st.y : st.z);
        L.scr.set(cr(pt(P0, 0), pt(A, 0), pt(B, 0), pt(P3, 0), u), Math.max(0, cr(pt(P0, 1), pt(A, 1), pt(B, 1), pt(P3, 1), u)), cr(pt(P0, 2), pt(A, 2), pt(B, 2), pt(P3, 2), u));
        L.scrPitch = lerp(A.pitch, B.pitch, u * u * (3 - 2 * u));
        L.scrYaw = mx * lerp(A.yaw ?? 0, B.yaw ?? 0, u);
        L.scrW = Math.min(1, (a.t - k0.t) / 0.06 + 0.001);
        L.ikW = Math.max(L.ikW, smoothstep(k0.t, k0.t + 0.12, a.t));
      }
    }
    (def.steps ?? []).forEach((s, k) => {
      if (a.steps[k] || a.t < s.t) return;
      a.steps[k] = true;
      const same = a.side > 0 ? 0 : 1;
      const li = s.leg === 'f' ? same : s.leg === 'h' ? same + 2 : s.leg === 'of' ? same ^ 1 : (same ^ 1) + 2;
      const mx = this.legs[li].side > 0 ? -1 : 1;
      // offsets authored for the right side: x mirrors with the acting side (a lurch to the left steps left)
      this.forceStep(li, s.d[0] * (a.side > 0 ? -1 : 1), s.d[1], s.dur);
      void mx;
    });
    void dt;
  }

  private runCues(a: ActionState, def: ActionDef) {
    (def.cues ?? []).forEach((c, k) => {
      if (a.cues[k] || a.t < c.t) return;
      a.cues[k] = true;
      const at = c.at === 'paw' ? this.pawPoint(a.side > 0 ? 0 : 1, _v5) : c.at === 'front' ? this.frontPoint(_v5) : c.at === 'body' ? this.bodyPoint(_v5) : this.headCenter.getWorldPosition(_v5);
      const s = c.cue === 'slam' ? 1.4 : c.cue === 'stomp' ? 1 : c.cue === 'skid' ? 1.1 : 0.8;
      if (c.cue === 'slam' || c.cue === 'stomp') this.springF.v -= c.cue === 'slam' ? 0.7 : 0.35;
      this.cue(c.cue, at, s);
    });
  }

  private finishAction(a: ActionState) {
    // a paw still in its script lands where it is
    for (let i = 0; i < 4; i++) {
      if (a.pawStart[i] && !a.landed[i]) {
        const L = this.legs[i];
        L.plant.copy(L.scr).setY(0).applyMatrix4(this.root.matrixWorld);
        L.plant.y = this.groundAt(L.plant.x, L.plant.z);
      }
    }
    if (this.action === a) this.action = null;
  }

  private cue(c: BearCue, at: THREE.Vector3, s: number) {
    try {
      this.onCue?.(c, at.clone(), s);
    } catch (e) {
      console.warn('[bear] cue', e);
    }
  }

  private pawPoint(li: number, out: THREE.Vector3) {
    return out.copy(this.legs[li].cur).applyMatrix4(this.root.matrixWorld);
  }

  private frontPoint(out: THREE.Vector3) {
    return out.set(0, 0, 0.95).applyMatrix4(this.root.matrixWorld);
  }

  private bodyPoint(out: THREE.Vector3) {
    return out.set(0, 0.3, 0).applyMatrix4(this.root.matrixWorld);
  }

  // ---------------------------------------------------------------------------------------------- per-leg IK

  private solveLegFrame(i: number, dt: number, biped: boolean) {
    const L = this.legs[i];
    const w = L.ikW;
    if (w <= 1e-3) {
      // FK only (reared forelegs, the dead bear): remember where the paw is for a script that starts from it
      this.contactFromFK(L, L.cur);
      return;
    }
    // the locomotion contact (world → root space), the foot pitch and the toe-in
    const c = _v2;
    let th = 0;
    let yawIn = -L.side * (L.front ? 0.16 : 0.06);
    if (L.swing >= 0) {
      this.swingPos(L, c);
      const s = L.swing;
      th = L.front ? 1.2 * Math.pow(bump(Math.min(1, s * 1.15)), 0.9) : 0.6 * bump(Math.min(1, s * 1.5)) - 0.16 * smoothstep(0.7, 1, s);
      if (L.front) yawIn *= 1 - 0.7 * bump(s);
    } else {
      c.copy(L.plant);
      if (this.moving && !(biped && L.front)) {
        const u = frac(this.phase + this.off[i]);
        const sp = clamp(u / Math.max(this.duty, 0.1), 0, 1);
        th = (L.front ? 0.5 : 0.7) * smoothstep(0.62, 1, sp) * this.loco;
        if (!L.front) th -= 0.14 * (1 - smoothstep(0, 0.14, sp)) * this.loco;
      }
    }
    c.applyMatrix4(this.rootInv);
    // a scripted paw (a swat, a stomp, the slam) takes over
    if (L.scrW > 1e-3) {
      c.lerp(L.scr, L.scrW);
      th = lerp(th, L.scrPitch, L.scrW);
      yawIn = lerp(yawIn, L.scrYaw, L.scrW);
    }
    L.cur.copy(c);
    L.pitch = th;
    // the end joint (wrist / ankle) from the contact: the heel rolls up over the ball (th > 0), or the toes come down
    // over the heel at heel strike (th < 0)
    const end = _v3;
    if (th >= 0) end.copy(c).add(L.ballD).add(ROT_X(_v4, L.ballOffs, th));
    else end.copy(c).add(L.heelD).add(ROT_X(_v4, L.heelOffs, th));
    // the paw's orientation: toe-in yaw, then the pitch
    _e.set(th, yawIn, 0, 'YXZ');
    _q3.setFromEuler(_e);
    this.solveLeg(L, end, w, _q3, th);
    void dt;
  }

  /** the contact point under the FK paw (root space) */
  private contactFromFK(L: Leg, out: THREE.Vector3) {
    const En = this.bones[L.ie];
    return out.copy(L.offs).negate().applyQuaternion(En.wq).add(En.wp);
  }

  /** analytic two-bone IK (upper/lower) toward `target` (root space) for the end joint; the shoulder blade of a
   *  foreleg first swings (and slides on the ribs) toward the paw — the foreleg's reach and the rolling hump */
  private solveLeg(L: Leg, target: THREE.Vector3, w: number, pawQ: THREE.Quaternion, th: number) {
    const U = this.bones[L.iu], Lo = this.bones[L.il], En = this.bones[L.ie], To = this.bones[L.it];
    const l1 = U.restW.distanceTo(Lo.restW);
    const l2 = Lo.restW.distanceTo(En.restW);
    if (L.is >= 0) {
      const S = this.bones[L.is];
      const P = this.bones[S.parent];
      const dz = target.z - U.wp.z;
      const ang = clamp(-dz * 0.85, -0.4, 0.4) * w;
      _q1.setFromAxisAngle(AX, ang);
      S.q.multiply(_q1);
      this.fkChain([L.is, L.iu]);
      const need = U.wp.distanceTo(target) - (l1 + l2) * 0.985;
      if (need > 0) {
        const k = Math.min(need, 0.075) * w;
        _v1.copy(target).sub(U.wp).normalize().multiplyScalar(k);
        _q2.copy(P.wq).invert();
        S.p.add(_v1.applyQuaternion(_q2));
        this.fkChain([L.is, L.iu]);
      }
    }
    const A = U.wp;
    const I = IK;
    const dir = I.dir.copy(target).sub(A);
    let d = dir.length();
    dir.divideScalar(Math.max(d, 1e-6));
    d = clamp(d, Math.abs(l1 - l2) + 0.01, (l1 + l2) * 0.998);
    const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    // elbows follow the shoulder blade; knees always point forward (also when standing)
    const pole = I.pole.copy(L.def.pole);
    if (L.front) pole.applyQuaternion(this.bones[U.parent].wq);
    pole.addScaledVector(dir, -pole.dot(dir));
    if (pole.lengthSq() < 1e-8) pole.set(0, 0, L.front ? -1 : 1);
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
    // paw / foot: the given root-space orientation (flat in stance, rolled at heel lift, flexed in the swing)
    _q2.copy(Lo.wq).invert().multiply(pawQ);
    En.q.slerp(_q2, w);
    this.fkChain([L.ie]);
    // toes: flat on the ground while the heel rolls up over them; curled in the swing (claws out at a strike: < 0)
    const toe = L.scrW > 0.5 ? -0.3 * L.scrW : L.swing >= 0 ? (L.front ? 0.3 * th : -0.5 * th) : th > 0 ? -th : 0;
    _e.set(toe, 0, 0, 'XYZ');
    _q2.setFromEuler(_e);
    To.q.slerp(_q2, w);
    this.fkChain([L.it]);
  }

  /** hold 'held': CCD of neck1 → neck2 → head so the grip socket (chin + lower jaw) goes toward the hand */
  private solveGrip(w: number) {
    const tgt = _v5.copy(this.gripPull!).applyMatrix4(this.rootInv);
    const jaw = this.bones[BI.jaw];
    const chain = [BI.neck1, BI.neck2, BI.head];
    for (let iter = 0; iter < 2; iter++) {
      for (let k = chain.length - 1; k >= 0; k--) {
        const B = this.bones[chain[k]];
        const sock = _v4.copy(this.beardRest).applyQuaternion(jaw.wq).add(jaw.wp);
        const a = _v1.copy(sock).sub(B.wp).normalize();
        const bb = _v2.copy(tgt).sub(B.wp).normalize();
        _q1.setFromUnitVectors(a, bb);
        // limit and soften (the bear resists): at most ~0.5 rad per bone, a share of the way per pass
        const ang = 2 * Math.acos(clamp(Math.abs(_q1.w), 0, 1));
        const f = Math.min(1, 0.5 / Math.max(ang, 1e-4)) * 0.6 * w;
        _q2.identity().slerp(_q1, f);
        // world delta → local: q_local' = parentW^-1 * delta * parentW * q_local
        const P = this.bones[B.parent];
        _q3.copy(P.wq).invert().multiply(_q2).multiply(P.wq);
        B.q.premultiply(_q3);
        this.fk(chain[k]);
      }
    }
  }

  private poseFor(c: Clip): Pose {
    let p = this.clipPoses.get(c);
    if (!p) {
      p = { r: {} };
      this.clipPoses.set(c, p);
    }
    return p;
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
