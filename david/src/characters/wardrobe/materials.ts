import * as THREE from 'three';
import { shared } from '../../core/Shared';

/*
 * Wardrobe materials.  Every garment material is a MeshPhysicalMaterial (MeshStandardMaterial on the phone tier)
 * whose shader is extended through onBeforeCompile (set BEFORE the human skinning patch, which chains it):
 *
 *   cloth   tileable weave maps (src/assets/wardrobe/weave_*; uv in metres x 1/tile), dye colour, thread-level
 *           normal + AO, woven pattern bands measured from the garment's lower/upper edge (motifs: solid,
 *           checks, zigzag, lozenges, stripes, gold discs), holes with frayed borders and loose threads,
 *           open (see-through) weave near frayed edges, hem dust / armpit & neck grime, back-lit translucency,
 *           hem sway (velocity + wind) and a leg-capsule push-out so legs never poke through skirts.
 *   fringe  alpha-tested loose threads (hem / cuffs / tassels)
 *   leather, metal (gold / iron / bronze with scratches & patina), wood (worn staff / spear shaft), rope.
 *
 * Textures are 1K (medium/high) or 512 (phones), all tileable, so garments of any size cost the same memory.
 */

export type Tier = 'low' | 'medium' | 'high';

// ------------------------------------------------------------------------------------------ textures
type Loader = () => Promise<string>;
// eager URL strings only (files are fetched on use; no stub chunk per texture in the build)
const URLS = import.meta.glob('../../assets/wardrobe/*.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const FILES: Record<string, Loader> = Object.fromEntries(Object.entries(URLS).map(([k, u]) => [k, () => Promise.resolve(u)]));
const PREFIX = '../../assets/wardrobe/';
const texCache = new Map<string, Promise<THREE.Texture>>();

export function wardrobeTexture(name: string, tier: Tier, srgb: boolean): Promise<THREE.Texture> {
  // prefer 1k on medium/high, 512 on phones; fall back to whatever exists
  const sizes = tier === 'low' ? ['512', '256', '1k'] : ['1k', '512', '256'];
  let file = '';
  for (const s of sizes) {
    const f = `${PREFIX}${name}_${s}.webp`;
    if (f in FILES) {
      file = f;
      break;
    }
  }
  if (!file) return Promise.reject(new Error(`wardrobe texture missing: ${name}`));
  const key = file + (srgb ? ':s' : ':l');
  let p = texCache.get(key);
  if (!p) {
    p = (async () => {
      const url = await FILES[file]();
      const t = await new THREE.TextureLoader().loadAsync(url);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = tier === 'high' ? 8 : 4;
      t.name = `wardrobe:${name}`;
      return t;
    })();
    texCache.set(key, p);
  }
  return p;
}

export interface TexPair {
  a: THREE.Texture;
  n: THREE.Texture;
}
export async function texPair(name: string, tier: Tier): Promise<TexPair> {
  const [a, n] = await Promise.all([wardrobeTexture(`${name}_a`, tier, true), wardrobeTexture(`${name}_n`, tier, false)]);
  return { a, n };
}

// ------------------------------------------------------------------------------------------ shared per-outfit uniforms
export class OutfitUniforms {
  /** hem sway offset (root space, metres) */
  uSway = { value: new THREE.Vector3() };
  uSwayTime = { value: 0 };
  /** leg capsules (root space): a.xyz, b.xyz, radius in a.w */
  uCapA = { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, -10, 0, 0)) };
  uCapB = { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, -10, 0, 0)) };
}

// ------------------------------------------------------------------------------------------ GLSL
const GLSL_COMMON = /* glsl */ `
float wHash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float wNoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = wHash(i), b = wHash(i + vec2(1.0, 0.0)), c = wHash(i + vec2(0.0, 1.0)), d = wHash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float wFbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ s += a * wNoise(p); p = p * 2.07 + 11.3; a *= 0.5; } return s / 0.875; }
`;

const VERT_PARS = /* glsl */ `
attribute vec4 gdata;
varying vec4 vGd;
varying vec2 vGUv;
#ifdef W_SWAY
uniform vec3 uSway;
uniform float uSwayTime;
uniform float uSwayLen;
#endif
#ifdef W_COLLIDE
uniform vec4 uCapA[4];
uniform vec4 uCapB[4];
uniform float uCapPad;
vec3 wCollide(vec3 p) {
  for (int i = 0; i < 4; i++) {
    vec3 a = uCapA[i].xyz, b = uCapB[i].xyz;
    // uCapPad: outer layers keep their distance from the inner ones where both are pushed out by a leg
    float r = uCapA[i].w + uCapPad;
    vec3 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
    vec3 c = a + ab * t;
    vec3 d = p - c;
    float l = length(d);
    if (l < r && l > 1e-5) p = c + d * (r / l);
  }
  return p;
}
#endif
`;

const VERT_MAIN = /* glsl */ `
vGd = gdata;
vGUv = uv;
#ifdef W_SWAY
{
  float sw = clamp(1.0 - gdata.x / uSwayLen, 0.0, 1.4);
  sw *= sw;
  float ph = uSwayTime * 1.9 + uv.x * 11.0;
  vec3 flutter = vec3(sin(ph), 0.0, cos(ph * 0.83 + 1.3)) * (0.0025 + length(uSway) * 0.15);
  transformed += (uSway + flutter) * sw;
}
#endif
#ifdef W_COLLIDE
transformed = wCollide(transformed);
#endif
`;

const FRAG_PARS = /* glsl */ `
varying vec4 vGd;
varying vec2 vGUv;
uniform sampler2D tWA;
uniform sampler2D tWN;
uniform vec2 uTile;          // 1 / tile size (m)
uniform vec3 uDye;
uniform float uNormalAmt;
uniform float uAO;
uniform vec4 uGrime;         // rgb colour, a amount (armpits / neck, from gdata.z)
uniform vec4 uHem;           // x dust amount, y dust height (m), z fray width (m), w fray amount
uniform vec2 uEdgeMask;      // fray/dust weight for the lower / upper edge
uniform vec3 uDust;
uniform float uTransmit;
uniform float uGap;
uniform vec4 uVar;           // x warp streaks, y stains, z weft bars, w back-lit fibre fuzz
uniform vec2 uUnder;         // x distance from the hem (m) above which an outer layer covers this cloth, y its albedo there
#ifdef W_GATHER
uniform vec4 uGather;        // x lower-edge amount, y upper-edge amount, z falloff (m), w fold spacing (m)
uniform float uGatherN;      // > 0: folds laid by angle (gdata.w = fraction around the tube), this many around
#endif
uniform vec3 uSunDirW;
uniform vec3 uSunCol;
#if W_BANDS > 0
uniform vec4 uBands[W_BANDS]; // x start, y end (m from edge), z motif, w palette + 10*edge
uniform vec3 uPal[4];
#endif
#if W_HOLES > 0
uniform vec4 uHoles[W_HOLES]; // u, v (m), radius (m), aspect
#endif
float wMetal;
float wRough;
${GLSL_COMMON}
mat3 wTBN(vec3 eye_pos, vec3 surf_norm, vec2 uv) {
  vec3 q0 = dFdx(eye_pos.xyz);
  vec3 q1 = dFdy(eye_pos.xyz);
  vec2 st0 = dFdx(uv.st);
  vec2 st1 = dFdy(uv.st);
  vec3 N = surf_norm;
  vec3 q1perp = cross(q1, N);
  vec3 q0perp = cross(N, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x;
  vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B));
  float scale = (det == 0.0) ? 0.0 : inversesqrt(det);
  return mat3(T * scale, B * scale, N);
}
`;

const FRAG_MAP = /* glsl */ `
vec2 wuv = vGUv * uTile;
vec4 wA = texture2D(tWA, wuv);
vec4 wN = texture2D(tWN, wuv);
vec3 wCol = uDye * wA.rgb;
float wCov = wA.a;
// open weave: the gaps between the threads read darker (shadowed / skin showing through)
wCol *= 1.0 - uGap * (1.0 - smoothstep(0.3, 0.92, wCov));
wMetal = 0.0;
wRough = 0.0;
float wLow = wFbm(vGUv * 7.0);
// models pass (CUT v2): handwoven cloth is never one flat tone — non-periodic yarn-group streaks along the warp
// (vertical, ~4 mm wide, 30-40 cm long), faint weft bars, and darker blotches (sweat, soot, road dirt) at 3-10 cm;
// none of it repeats with the texture tile
{
#ifndef W_LOW
  float st = wNoise(vec2(vGUv.x * 240.0, vGUv.y * 2.6)) * 0.6 + wNoise(vec2(vGUv.x * 70.0 + 3.1, vGUv.y * 1.3)) * 0.4;
  float br = wNoise(vec2(vGUv.x * 1.7 + 7.7, vGUv.y * 150.0));
#else
  // phones: a softer, coarser streak (fine streaks alias into stripes without TAA)
  float st = 0.5 + 0.5 * (wNoise(vec2(vGUv.x * 60.0, vGUv.y * 2.0)) - 0.5);
  float br = 0.5;
#endif
  wCol *= 1.0 + uVar.x * (st - 0.5) * 2.0 + uVar.z * (br - 0.5) * 2.0;
#ifndef W_LOW
  float stain = wFbm(vGUv * 10.0 + 4.3);
#else
  float stain = wNoise(vGUv * 12.0 + 4.3);
#endif
  wCol *= 1.0 - uVar.y * smoothstep(0.56, 0.8, stain);
}
float wGatherSlope = 0.0;
#ifdef W_GATHER
{
  // cloth gathered under a belt: tight vertical folds that open out away from it (crests lighter, troughs darker)
  // folds by angle around a tube (periodic noise on the unit circle: no seam), or along a ribbon's u
  float fx, len, ph;
  if (uGatherN > 0.0) {
    fx = vGd.w * uGatherN;
    vec2 cs = vec2(cos(vGd.w * 6.2832), sin(vGd.w * 6.2832));
    len = uGather.z * (0.55 + 0.9 * wNoise(cs * 3.0 + 3.7));
    ph = fx * 6.2832 + 2.4 * wNoise(cs * 2.3 + 0.7) + 1.1 * wNoise(cs * 6.0 + vec2(vGd.x * 2.5, 1.9));
  } else {
    fx = vGUv.x / uGather.w;
    // (smooth per-fold length variation: a hash per fold index left a seam between folds)
    len = uGather.z * (0.55 + 0.9 * wNoise(vec2(fx * 0.9, 3.7)));
    ph = fx * 6.2832 + 2.6 * wNoise(vec2(vGUv.x * 9.0, 0.7)) + 1.2 * wNoise(vec2(vGUv.x * 23.0, vGd.x * 3.0 + 1.9));
  }
  float amt = uGather.x * exp(-max(vGd.x, 0.0) / len) + uGather.y * exp(-max(vGd.y, 0.0) / len);
#ifdef W_LOW
  amt *= 0.55; // phones (FXAA, no TAA): half-strength folds, full ones stripe
#endif
  float prof = 0.5 + 0.5 * cos(ph);
  // (tangent-space normal of h = cos(ph): crests at ph = 0 lit, the troughs at ph = PI get the AO below)
  wGatherSlope = amt * sin(ph) * (1.0 + 0.6 * cos(ph));
  wCol *= 1.0 - amt * 0.22 * (1.0 - prof) * (1.0 - prof);
}
#endif
float wEdgeL = vGd.x, wEdgeU = vGd.y;
#if W_BANDS > 0
for (int i = 0; i < W_BANDS; i++) {
  vec4 bd = uBands[i];
  float ref = floor(bd.w / 10.0);
  int pi = int(mod(bd.w, 10.0));
  float d = ref < 0.5 ? vGd.x : vGd.y;
  if (d >= bd.x && d <= bd.y && bd.y > bd.x) {
    float h = bd.y - bd.x;
    float t = (d - bd.x) / h;       // 0..1 across the band
    float m = bd.z;
    vec3 pc = uPal[pi];
    float on = 1.0;
    if (m > 0.5 && m < 1.5) {        // checks
      on = step(0.5, fract(vGUv.x / h * 1.0) ) == step(0.5, t) ? 1.0 : 0.0;
    } else if (m > 1.5 && m < 2.5) { // zigzag line
      float z = abs(fract(vGUv.x / h) - 0.5) * 2.0;
      on = 1.0 - step(0.2, abs(t - z));
    } else if (m > 2.5 && m < 3.5) { // lozenges
      float z = abs(fract(vGUv.x / h) - 0.5) * 2.0;
      float y = abs(t - 0.5) * 2.0;
      on = step(z + y, 0.8) * (1.0 - step(z + y, 0.45)) + step(z + y, 0.22);
    } else if (m > 3.5 && m < 4.5) { // pin stripes
      on = step(0.5, fract(t * 3.0));
    } else if (m > 4.5) {            // gold discs (sewn ornaments)
      vec2 q = vec2(fract(vGUv.x / h) - 0.5, t - 0.5);
      float r = length(q);
      on = 0.0;
      if (r < 0.32) { wMetal = 1.0; wRough = 0.28 + 0.2 * wLow; wCol = uPal[pi] * (0.85 + 0.3 * (1.0 - r / 0.32)); wCov = 1.0; }
    }
    if (m < 4.5) wCol = mix(wCol, pc * wA.rgb, on);
  }
}
#endif
// grime: hem dust (lower edge) + armpit / neck grime (per-vertex)
float wDust = (1.0 - smoothstep(0.0, uHem.y, vGd.x * uEdgeMask.x + (1.0 - uEdgeMask.x) * 9.0 + (wLow - 0.5) * uHem.y * 0.9)) * uHem.x;
wCol = mix(wCol, wCol * uDust, clamp(wDust, 0.0, 1.0));
wCol = mix(wCol, wCol * uGrime.rgb, clamp(vGd.z * uGrime.a * (0.6 + 0.8 * wLow), 0.0, 1.0));
// fraying edges: the weave opens up and threads thin out near cut edges
float wEdge = min(mix(9.0, vGd.x, uEdgeMask.x), mix(9.0, vGd.y, uEdgeMask.y));
float wOpen = (1.0 - smoothstep(0.0, uHem.z, wEdge + (wNoise(vGUv * 90.0) - 0.5) * uHem.z * 0.8)) * uHem.w;
float wAlpha = wCov - wOpen * (0.35 + 0.5 * wNoise(vGUv * 300.0));
#if W_HOLES > 0
for (int i = 0; i < W_HOLES; i++) {
  vec4 ho = uHoles[i];
  if (ho.z <= 0.0) continue;
  vec2 dd = (vGUv - ho.xy) / vec2(ho.z * ho.w, ho.z);
  float ang = atan(dd.y, dd.x);
  float rr = length(dd) * (1.0 + 0.28 * (wNoise(vec2(ang * 2.2 + float(i) * 7.0, 0.5)) - 0.5) + 0.18 * (wNoise(vGUv * 260.0) - 0.5));
  if (rr < 1.0) {
    // a few loose warp threads still cross the hole
    float thr = step(0.72, fract(vGUv.x / 0.0032)) * step(0.55, wHash(vec2(floor(vGUv.x / 0.0032), float(i))));
    wAlpha = min(wAlpha, thr * wCov * step(0.25, rr));
  } else if (rr < 1.45) {
    float k = 1.0 - (rr - 1.0) / 0.45;
    wAlpha -= k * 0.45;
    wCol *= 1.0 - 0.35 * k;
  }
}
#endif
if (wAlpha < 0.5) discard;
float wAo = mix(1.0, wN.b, uAO);
// models pass: the inside of a garment (seen at the neck, the hem, through holes and the open weave) lies in the
// body's shadow — it must not light up like the outside (a hole on David's chest showed a bright crescent)
#if defined(W_INSIDE_FRONT)
if (gl_FrontFacing) wAo *= 0.45;
#elif defined(W_INSIDE_BACK)
if (!gl_FrontFacing) wAo *= 0.45;
#endif
// finishing pass: an under-layer lies in the shadow of the garment over it — where the outer layer opens (side
// openings, a torn corner) it must not show as a lit white wedge
wAo *= mix(1.0, uUnder.y, smoothstep(uUnder.x, uUnder.x + 0.05, vGd.x));
diffuseColor.rgb = wCol * wAo;
#ifdef W_LOW
// phones render 8-bit targets: the smooth shading of the new (thread-scale) cloth posterised into contour bands on
// large garment areas — a faint screen-space dither (±1.5 %) breaks them up
diffuseColor.rgb *= 1.0 + (wHash(gl_FragCoord.xy) - 0.5) * 0.03;
#endif
diffuseColor.a = 1.0;
`;

const FRAG_NORMAL = /* glsl */ `
{
  vec3 mapN = vec3(wN.rg * 2.0 - 1.0, 0.0);
  mapN.xy *= uNormalAmt;
  mapN.z = sqrt(max(0.0, 1.0 - dot(mapN.xy, mapN.xy)));
  mapN = normalize(mapN + vec3(wGatherSlope, 0.0, 0.0));
  mat3 tbn = wTBN(-vViewPosition, normal, vGUv);
  tbn[0] *= faceDirection;
  tbn[1] *= faceDirection;
  normal = normalize(tbn * mapN);
}
`;

const FRAG_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
#ifndef W_LOW
{
  // light through the open weave when looking toward the sun (silhouettes, sleeves, hem)
  vec3 Lv = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  vec3 Vv = normalize(vViewPosition);
  float back = pow(max(0.0, dot(-Vv, -Lv)), 5.0);
  float thin = (1.0 - abs(dot(normal, Vv))) * 0.6 + (1.0 - wCov) * 1.4 + wOpen;
  // models pass: the fibre fuzz on the surface of wool catches the back light as a soft warm rim (a dark mantle
  // otherwise reads as a flat black shape against the low sun)
  float rim = pow(1.0 - abs(dot(normal, Vv)), 3.0);
  totalEmissiveRadiance += uSunCol * mix(diffuseColor.rgb, vec3(0.42, 0.36, 0.29), 0.55) * pow(max(0.0, dot(-Vv, -Lv)), 3.0) * rim * uVar.w;
  totalEmissiveRadiance += uSunCol * diffuseColor.rgb * back * thin * uTransmit;
}
#endif
`;

export interface Band {
  /** distance from the edge (m) where the band starts / ends */
  from: number;
  to: number;
  /** 0 solid, 1 checks, 2 zigzag, 3 lozenges, 4 stripes, 5 gold discs */
  motif: number;
  /** palette index 0..3 */
  pal: number;
  /** measured from the lower (hem) edge or the upper edge */
  edge?: 'lower' | 'upper';
}

export interface ClothOptions {
  tier: Tier;
  tex: TexPair;
  /** tile size in metres (the texture covers tile x tile) */
  tile: number;
  dye: THREE.ColorRepresentation;
  roughness?: number;
  sheen?: number;
  normal?: number;
  ao?: number;
  grime?: [number, number, number, number];
  dust?: THREE.ColorRepresentation;
  /** [dust amount, dust height m, fray width m, fray amount] */
  hem?: [number, number, number, number];
  edgeMask?: [number, number];
  transmit?: number;
  bands?: Band[];
  palette?: THREE.ColorRepresentation[];
  holes?: [number, number, number, number][];
  sway?: { uniforms: OutfitUniforms; length: number };
  collide?: OutfitUniforms;
  /** extra leg-capsule radius for outer layers (m): layers pushed by the same leg stay apart (no z-fighting) */
  collidePad?: number;
  /** darken the open gaps of the weave (0..1): coarse, loosely woven cloth */
  gap?: number;
  /** models pass: [warp streaks, stains, weft bars] — non-periodic tone variation of handwoven cloth (defaults 0.05, 0.1, 0.02) */
  variation?: [number, number, number];
  /** models pass: back-lit fibre fuzz on the silhouette (0..1, wool; default 0.25) */
  fuzz?: number;
  /** models pass: folds gathered under a belt at the [lower, upper] edge of this piece: amount (0..1.5), falloff (m), fold spacing (m) */
  gather?: { lower?: number; upper?: number; falloff?: number; spacing?: number; around?: number };
  /** models pass: which rasterised side is the garment's INSIDE (darkened); see insideFace(geometry) */
  inside?: 'front' | 'back';
  /** finishing pass: [distance from the hem (m), albedo] — covered by an outer layer above that distance (in its shadow) */
  under?: [number, number];
  side?: THREE.Side;
}

function lin(c: THREE.ColorRepresentation) {
  return new THREE.Color(c);
}

/** Garment cloth material (see file header). */
export function clothMaterial(o: ClothOptions): THREE.MeshStandardMaterial {
  const low = o.tier === 'low';
  const dye = lin(o.dye);
  const m: THREE.MeshStandardMaterial = low
    ? new THREE.MeshStandardMaterial({ roughness: o.roughness ?? 0.9, metalness: 0, side: o.side ?? THREE.DoubleSide })
    : new THREE.MeshPhysicalMaterial({
        roughness: o.roughness ?? 0.9,
        metalness: 0,
        side: o.side ?? THREE.DoubleSide,
        sheen: o.sheen ?? 0.6,
        sheenRoughness: 0.75,
        sheenColor: dye.clone().lerp(new THREE.Color(1, 1, 1), 0.35),
      });
  m.name = 'wardrobe:cloth';
  const bands = o.bands ?? [];
  const holes = o.holes ?? [];
  const u: Record<string, THREE.IUniform> = {
    tWA: { value: o.tex.a },
    tWN: { value: o.tex.n },
    uTile: { value: new THREE.Vector2(1 / o.tile, 1 / o.tile) },
    uDye: { value: dye },
    uNormalAmt: { value: o.normal ?? 1 },
    uAO: { value: o.ao ?? 0.8 },
    uGrime: { value: new THREE.Vector4(...(o.grime ?? [0.62, 0.5, 0.36, 0.6])) },
    uHem: { value: new THREE.Vector4(...(o.hem ?? [0.5, 0.18, 0.03, 0.6])) },
    uEdgeMask: { value: new THREE.Vector2(...(o.edgeMask ?? [1, 1])) },
    uDust: { value: lin(o.dust ?? 0x9c8466) },
    uTransmit: { value: o.transmit ?? 0.9 },
    uGap: { value: o.gap ?? 0 },
    uVar: { value: new THREE.Vector4(...(o.variation ?? [0.05, 0.1, 0.02]), o.fuzz ?? 0.25) },
    uUnder: { value: new THREE.Vector2(...(o.under ?? [99, 1])) },
    uGather: { value: new THREE.Vector4(o.gather?.lower ?? 0, o.gather?.upper ?? 0, o.gather?.falloff ?? 0.07, o.gather?.spacing ?? 0.035) },
    uGatherN: { value: Math.round(o.gather?.around ?? 0) },
    uSunDirW: shared.uSunDir,
    uSunCol: shared.uSunColor,
    uBands: { value: bands.map((b) => new THREE.Vector4(b.from, b.to, b.motif, b.pal + (b.edge === 'upper' ? 10 : 0))) },
    uPal: { value: [0, 1, 2, 3].map((i) => lin(o.palette?.[i] ?? 0xffffff)) },
    uHoles: { value: holes.map((h) => new THREE.Vector4(...h)) },
    uSwayLen: { value: o.sway?.length ?? 0.3 },
  };
  if (o.sway) {
    u.uSway = o.sway.uniforms.uSway;
    u.uSwayTime = o.sway.uniforms.uSwayTime;
  }
  if (o.collide) {
    u.uCapA = o.collide.uCapA;
    u.uCapB = o.collide.uCapB;
    u.uCapPad = { value: o.collidePad ?? 0 };
  }
  m.userData.wardrobe = u;
  const gather = !!o.gather && ((o.gather.lower ?? 0) > 0 || (o.gather.upper ?? 0) > 0);
  const defs = `#define W_BANDS ${bands.length}\n#define W_HOLES ${holes.length}\n` + (low ? '#define W_LOW\n' : '') + (o.sway ? '#define W_SWAY\n' : '') + (o.collide ? '#define W_COLLIDE\n' : '') + (gather ? '#define W_GATHER\n' : '') + (o.inside === 'front' ? '#define W_INSIDE_FRONT\n' : o.inside === 'back' ? '#define W_INSIDE_BACK\n' : '');
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = defs + shader.vertexShader
      .replace('#include <skinning_pars_vertex>', `#include <skinning_pars_vertex>\n${VERT_PARS}`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = defs + shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <map_fragment>', FRAG_MAP)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness * (0.92 + 0.16 * wLow) * mix(1.0, 1.08, 1.0 - wN.b);\nroughnessFactor = mix(roughnessFactor, wRough, wMetal);`)
      .replace('#include <metalnessmap_fragment>', `float metalnessFactor = max(metalness, wMetal);`)
      .replace('#include <normal_fragment_maps>', FRAG_NORMAL)
      .replace('#include <emissivemap_fragment>', FRAG_EMISSIVE);
  };
  m.customProgramCacheKey = () => `wcloth|${defs}|${low}`;
  return m;
}

/**
 * models pass: which rasterised side of a garment tube is its inside. The loft's winding depends on the frame (the
 * vertex normals from computeVertexNormals point to the FRONT side): sample the normals against the outward radial
 * direction (from the vertical axis through the piece's centre at that height).
 */
export function insideFace(geo: THREE.BufferGeometry): 'front' | 'back' {
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  const n = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (!n) return 'back';
  let cx = 0, cz = 0;
  for (let i = 0; i < p.count; i++) {
    cx += p.getX(i);
    cz += p.getZ(i);
  }
  cx /= p.count;
  cz /= p.count;
  let vote = 0;
  const step = Math.max(1, Math.floor(p.count / 400));
  for (let i = 0; i < p.count; i += step) {
    const rx = p.getX(i) - cx, rz = p.getZ(i) - cz;
    vote += Math.sign(n.getX(i) * rx + n.getZ(i) * rz);
  }
  // normals outward = the front side is the outside
  return vote >= 0 ? 'back' : 'front';
}

/**
 * models pass: insideFace for a loft tube whose axis is not vertical (sleeves along the arm): the outward direction
 * is taken from each row's own centroid.
 */
export function insideFaceTube(tube: { geometry: THREE.BufferGeometry; cols: number; rows: number }): 'front' | 'back' {
  const p = tube.geometry.getAttribute('position') as THREE.BufferAttribute;
  const n = tube.geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (!n) return 'back';
  const W = tube.cols + 1;
  let vote = 0;
  for (let r = 0; r < tube.rows; r += Math.max(1, Math.floor(tube.rows / 8))) {
    let cx = 0, cy = 0, cz = 0;
    for (let c = 0; c < W; c++) {
      const i = r * W + c;
      cx += p.getX(i);
      cy += p.getY(i);
      cz += p.getZ(i);
    }
    cx /= W;
    cy /= W;
    cz /= W;
    for (let c = 0; c < W; c += 2) {
      const i = r * W + c;
      vote += Math.sign(n.getX(i) * (p.getX(i) - cx) + n.getY(i) * (p.getY(i) - cy) + n.getZ(i) * (p.getZ(i) - cz));
    }
  }
  return vote >= 0 ? 'back' : 'front';
}

/** models pass: fold count around a loft tube at one of its rows (circumference / spacing), for `gather.around` */
export function foldsAround(tube: { pos: Float32Array; cols: number; rows: number }, row: number, spacing: number): number {
  const W = tube.cols + 1;
  const r = Math.max(0, Math.min(tube.rows - 1, row));
  let c = 0;
  for (let k = 1; k < W; k++) {
    const i = (r * W + k) * 3, j = (r * W + k - 1) * 3;
    c += Math.hypot(tube.pos[i] - tube.pos[j], tube.pos[i + 1] - tube.pos[j + 1], tube.pos[i + 2] - tube.pos[j + 2]);
  }
  return Math.max(6, Math.round(c / spacing));
}

/** A depth material for shadows of swaying / colliding garments (so shadows match the hem). */
export function clothDepthMaterial(o: { sway?: { uniforms: OutfitUniforms; length: number }; collide?: OutfitUniforms; collidePad?: number }) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  const u: Record<string, THREE.IUniform> = { uSwayLen: { value: o.sway?.length ?? 0.3 } };
  if (o.sway) {
    u.uSway = o.sway.uniforms.uSway;
    u.uSwayTime = o.sway.uniforms.uSwayTime;
  }
  if (o.collide) {
    u.uCapA = o.collide.uCapA;
    u.uCapB = o.collide.uCapB;
    u.uCapPad = { value: o.collidePad ?? 0 };
  }
  const defs = (o.sway ? '#define W_SWAY\n' : '') + (o.collide ? '#define W_COLLIDE\n' : '');
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = defs + shader.vertexShader
      .replace('#include <skinning_pars_vertex>', `#include <skinning_pars_vertex>\n${VERT_PARS}`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>\n${VERT_MAIN}`);
  };
  m.customProgramCacheKey = () => `wdepth|${defs}`;
  return m;
}

// ------------------------------------------------------------------------------------------ simple PBR materials
export interface SolidOptions {
  tier: Tier;
  tex?: TexPair;
  color: THREE.ColorRepresentation;
  roughness: number;
  metalness?: number;
  /** texture repeat (uv units -> tiles) */
  repeat?: [number, number];
  normal?: number;
  sheen?: number;
  /** extra metal wear: scratches / patina from the "metal" texture (data channels) */
  metalWear?: { patina: THREE.ColorRepresentation; amount: number; edgeBright?: number };
  /** woody: bark texture pair blended by the albedo alpha (bark mask); wear: uv.y range kept smooth (grip) */
  bark?: { tex: TexPair; amount: number; smooth: [number, number] };
  skinned?: boolean;
}

/**
 * Leather / wood / metal / rope: MeshPhysical (Standard on phones) with the pair's albedo (neutral, tinted by
 * `color`) + normal (rg) + AO (b).  Metals read the "metal" data texture: r = blotches, g = fine grain,
 * b = scratches -> roughness breakup, patina and bright scratches.
 */
export function solidMaterial(o: SolidOptions): THREE.MeshStandardMaterial {
  const low = o.tier === 'low';
  const params = { color: new THREE.Color(o.color), roughness: o.roughness, metalness: o.metalness ?? 0 };
  const m: THREE.MeshStandardMaterial = low || !o.sheen ? new THREE.MeshStandardMaterial(params) : new THREE.MeshPhysicalMaterial({ ...params, sheen: o.sheen, sheenRoughness: 0.6, sheenColor: new THREE.Color(o.color).multiplyScalar(1.4) });
  m.name = 'wardrobe:solid';
  if (!o.tex) return m;
  const rep = new THREE.Vector2(...(o.repeat ?? [1, 1]));
  const u: Record<string, THREE.IUniform> = {
    tSA: { value: o.tex.a },
    tSN: { value: o.tex.n },
    uRep: { value: rep },
    uNAmt: { value: o.normal ?? 1 },
    uPatina: { value: new THREE.Color(o.metalWear?.patina ?? 0x404040) },
    uWear: { value: new THREE.Vector2(o.metalWear?.amount ?? 0, o.metalWear?.edgeBright ?? 0) },
    tBA: { value: o.bark?.tex.a ?? o.tex.a },
    tBN: { value: o.bark?.tex.n ?? o.tex.n },
    uBark: { value: new THREE.Vector4(o.bark?.amount ?? 0, o.bark?.smooth[0] ?? -1, o.bark?.smooth[1] ?? -1, 0) },
  };
  const metal = !!o.metalWear;
  const bark = !!o.bark;
  m.userData.wardrobe = u;
  const defs = (metal ? '#define S_METAL\n' : '') + (bark ? '#define S_BARK\n' : '');
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSUv = uv;');
    shader.fragmentShader = defs + shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec2 vSUv;\nuniform sampler2D tSA; uniform sampler2D tSN; uniform sampler2D tBA; uniform sampler2D tBN;\nuniform vec2 uRep; uniform float uNAmt; uniform vec3 uPatina; uniform vec2 uWear; uniform vec4 uBark;\nfloat sRough = 1.0; float sMetalK = 1.0;\n${GLSL_COMMON}\n` +
          FRAG_PARS.slice(FRAG_PARS.indexOf('mat3 wTBN')),
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
vec2 suv = vSUv * uRep;
vec4 sA = texture2D(tSA, suv);
vec4 sN = texture2D(tSN, suv);
#ifdef S_METAL
  // metal data texture: r blotches, g grain, b scratches
  float blot = sA.r, grain = sA.g, scr = sA.b;
  float pat = smoothstep(0.45, 0.8, blot) * uWear.x;
  diffuseColor.rgb = mix(diffuseColor.rgb * (0.9 + 0.2 * grain), uPatina, pat);
  diffuseColor.rgb += scr * uWear.y * 0.25;
  sRough = (0.85 + 0.5 * blot) * (1.0 - scr * 0.5);
  sMetalK = 1.0 - pat * 0.9;
#else
  diffuseColor.rgb *= sA.rgb;
  #ifdef S_BARK
  {
    // bark in patches, worn smooth where the hands hold it (uBark.yz = uv.y range)
    float grip = smoothstep(uBark.y - 0.06, uBark.y, vSUv.y) * (1.0 - smoothstep(uBark.z, uBark.z + 0.06, vSUv.y));
    float bm = smoothstep(0.45, 0.62, sA.a + (wNoise(vSUv * vec2(3.0, 40.0)) - 0.5) * 0.3) * uBark.x * (1.0 - grip);
    vec4 bA = texture2D(tBA, suv * vec2(1.0, 1.3));
    vec4 bN = texture2D(tBN, suv * vec2(1.0, 1.3));
    diffuseColor.rgb = mix(diffuseColor.rgb, bA.rgb * 0.85, bm);
    sN = mix(sN, bN, bm);
    sRough = mix(1.0, 1.3, bm) * mix(1.0, 0.72, grip);
    diffuseColor.rgb *= mix(1.0, 0.78, grip); // hand oil darkens the grip
  }
  #endif
#endif
diffuseColor.rgb *= mix(1.0, sN.b, 0.7);
`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(roughness * sRough, 0.04, 1.0);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * sMetalK;')
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `{
  vec3 mapN = vec3(sN.rg * 2.0 - 1.0, 0.0);
  mapN.xy *= uNAmt;
  mapN.z = sqrt(max(0.0, 1.0 - dot(mapN.xy, mapN.xy)));
  mat3 tbn = wTBN(-vViewPosition, normal, suv);
  tbn[0] *= faceDirection; tbn[1] *= faceDirection;
  normal = normalize(tbn * mapN);
}`,
      );
  };
  m.customProgramCacheKey = () => `wsolid|${defs}|${low}|${!!o.sheen}`;
  return m;
}

/** Alpha-tested loose-thread cards (fringe texture: rgb luminance, a coverage). uv.x metres along the edge, uv.y 0 (edge) .. 1 (thread tips). */
export function fringeMaterial(o: { tier: Tier; tex: TexPair; dye: THREE.ColorRepresentation; width: number; sway?: { uniforms: OutfitUniforms; length: number }; collide?: OutfitUniforms; collidePad?: number; dust?: number }) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(o.dye), roughness: 0.95, side: THREE.DoubleSide, alphaTest: 0.5 });
  m.name = 'wardrobe:fringe';
  m.alphaToCoverage = o.tier !== 'low';
  const u: Record<string, THREE.IUniform> = {
    tFA: { value: o.tex.a },
    uFW: { value: 1 / o.width },
    uFDust: { value: o.dust ?? 0.35 },
    uSwayLen: { value: o.sway?.length ?? 0.3 },
  };
  if (o.sway) {
    u.uSway = o.sway.uniforms.uSway;
    u.uSwayTime = o.sway.uniforms.uSwayTime;
  }
  if (o.collide) {
    u.uCapA = o.collide.uCapA;
    u.uCapB = o.collide.uCapB;
    u.uCapPad = { value: o.collidePad ?? 0 };
  }
  const defs = (o.sway ? '#define W_SWAY\n' : '') + (o.collide ? '#define W_COLLIDE\n' : '');
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = defs + shader.vertexShader
      .replace('#include <skinning_pars_vertex>', `#include <skinning_pars_vertex>\n${VERT_PARS}`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vGd;\nvarying vec2 vGUv;\nuniform sampler2D tFA; uniform float uFW; uniform float uFDust;')
      .replace(
        '#include <map_fragment>',
        `vec4 fA = texture2D(tFA, vec2(vGUv.x * uFW, 1.0 - vGUv.y));\ndiffuseColor.rgb *= fA.rgb * mix(1.0, 0.72, uFDust * vGUv.y);\ndiffuseColor.a = fA.a;`,
      );
  };
  m.customProgramCacheKey = () => `wfringe|${defs}|${o.tier}`;
  return m;
}
