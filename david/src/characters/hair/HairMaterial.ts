import * as THREE from 'three';
import { temporal } from '../../fx/Temporal';

/*
 * Strand hair rendering.
 *
 * Geometry: one InstancedBufferGeometry per groom — the instance is a strand, the template is a ribbon of
 * (segs + 1) x 2 vertices (aTpl = (t, side)). Control points live in a float texture (uPoints: x y z ao per
 * texel, K texels per strand, head-bone space); the vertex shader evaluates a Catmull-Rom spline through them,
 * adds the simulated guide offsets (uSim: K x G texels, head space), follows the jaw for beard strands and
 * expands the ribbon perpendicular to the view (width tapering root -> tip, never thinner than uMinPx pixels —
 * instead the coverage drops, which keeps sub-pixel hair from shimmering or vanishing).
 *
 * Shading (RE_Direct replaced): the far-field Marschner model in the form of Karis 2016 ("Physically based hair
 * shading in Unreal"): R (white, shifted toward the root), TT (transmission — the back-lit glow of the low sun,
 * tinted by the hair colour) and TRT (coloured secondary highlight, shifted toward the tip), plus a Kajiya-Kay /
 * wrap multiple-scattering diffuse. Baked per-point occlusion (strand density further out + skin proximity)
 * darkens the inside of the volume for direct and indirect light; the shadow map adds sun shadows (the hair casts
 * onto the face through a custom depth material with the same expansion, dithered by coverage).
 *
 * Transparency: no blending (no sorting): alpha-to-coverage with the MSAA sample count (quantised + dithered so
 * sub-sample coverage stays statistically right) or, without MSAA, a screen-space dithered alpha test.
 */

export interface HairUniforms {
  [k: string]: THREE.IUniform;
  uPoints: THREE.IUniform<THREE.Texture | null>;
  uSim: THREE.IUniform<THREE.Texture | null>;
  uK: THREE.IUniform<number>;
  uSpr: THREE.IUniform<number>;
  uSimOn: THREE.IUniform<number>;
  uJaw: THREE.IUniform<THREE.Matrix4>;
  uWidthScale: THREE.IUniform<number>;
  uMinPx: THREE.IUniform<number>;
  uResY: THREE.IUniform<number>;
  uTaper: THREE.IUniform<number>;
  uVolC: THREE.IUniform<THREE.Vector3>;
  uVolR: THREE.IUniform<THREE.Vector3>;
  uBeardC: THREE.IUniform<THREE.Vector3>;
  uBeardR: THREE.IUniform<THREE.Vector3>;
  /**
   * beard1 (wave 6): 1 = fine strands under TAA — a per-PIXEL coverage dither that changes every frame (the TAA history
   * resolves it into soft sub-pixel strands) and ribbons down to 0.55 px. 0 (David, the defaults): the per-strand
   * threshold of the no-MSAA path, exactly as before. Without TAA (mobile-low) both are the per-strand path.
   */
  uFine: THREE.IUniform<number>;
  /** temporal.uTaaActive (the colour pass); the shadow pass binds a constant 0 */
  uTaaOn: THREE.IUniform<number>;
  /** beard1: a long beard hangs from the chin — 0..1 of its tail follows the chin's translation, not the jaw's rotation */
  uJawHang: THREE.IUniform<number>;
}

export function createHairUniforms(): HairUniforms {
  return {
    uPoints: { value: null },
    uSim: { value: null },
    uK: { value: 8 },
    uSpr: { value: 1 },
    uSimOn: { value: 0 },
    uJaw: { value: new THREE.Matrix4() },
    uWidthScale: { value: 1 },
    uMinPx: { value: 0.9 },
    uResY: { value: 1080 },
    uTaper: { value: 0.3 },
    uVolC: { value: new THREE.Vector3() },
    uVolR: { value: new THREE.Vector3(0.1, 0.1, 0.1) },
    uBeardC: { value: new THREE.Vector3() },
    uBeardR: { value: new THREE.Vector3(0.07, 0.07, 0.07) },
    uFine: { value: 0 },
    uTaaOn: temporal.uTaaActive,
    uJawHang: { value: 0 },
  };
}

const VERT_PARS = /* glsl */ `
uniform highp sampler2D uPoints;
uniform highp sampler2D uSim;
uniform int uK;
uniform int uSpr;
uniform float uSimOn;
uniform mat4 uJaw;
uniform float uWidthScale, uMinPx, uResY, uTaper;
uniform vec3 uVolC, uVolR, uBeardC, uBeardR;
uniform float uFine, uTaaOn, uJawHang;
attribute vec2 aTpl;
attribute vec4 aA;
attribute vec4 aB;
varying float vHairAlpha;
varying float vHairSide;
varying float vHairS;
varying float vHairRand;
vec3 hP, hT, hN;
float hAO, hW;
vec4 hairPt( int i ) {
  i = clamp( i, 0, uK - 1 );
  int s = gl_InstanceID;
  int row = s / uSpr;
  int col = ( s - row * uSpr ) * uK + i;
  return texelFetch( uPoints, ivec2( col, row ), 0 );
}
vec3 hairSim( int g, int i ) {
  return texelFetch( uSim, ivec2( clamp( i, 0, uK - 1 ), g ), 0 ).xyz;
}
void hairEval() {
  float t = aTpl.x;
  float u = t * float( uK - 1 );
  int i = int( min( floor( u ), float( uK - 2 ) ) );
  float f = u - float( i );
  vec4 p1 = hairPt( i ), p2 = hairPt( i + 1 );
  vec4 p0 = i > 0 ? hairPt( i - 1 ) : 2.0 * p1 - p2;
  vec4 p3 = i + 2 < uK ? hairPt( i + 2 ) : 2.0 * p2 - p1;
  float f2 = f * f, f3 = f2 * f;
  vec3 a1 = -p0.xyz + p2.xyz;
  vec3 a2 = 2.0 * p0.xyz - 5.0 * p1.xyz + 4.0 * p2.xyz - p3.xyz;
  vec3 a3 = -p0.xyz + 3.0 * p1.xyz - 3.0 * p2.xyz + p3.xyz;
  vec3 P = p1.xyz + 0.5 * ( a1 * f + a2 * f2 + a3 * f3 );
  vec3 T = 0.5 * ( a1 + 2.0 * a2 * f + 3.0 * a3 * f2 );
  hAO = mix( p1.w, p2.w, f );
  if ( uSimOn > 0.5 && aB.w > 0.0 ) {
    int g0 = int( aB.x + 0.5 ), g1 = int( aB.y + 0.5 );
    vec3 e0 = mix( hairSim( g0, i ), hairSim( g1, i ), aB.z );
    vec3 e1 = mix( hairSim( g0, i + 1 ), hairSim( g1, i + 1 ), aB.z );
    P += mix( e0, e1, f ) * aB.w;
    T += ( e1 - e0 ) * aB.w;
  }
  if ( aA.z > 0.002 ) {
    vec3 Pj = ( uJaw * vec4( P, 1.0 ) ).xyz;
    if ( aA.w > 0.5 && uJawHang > 0.0 ) {
      // beard1: the beard's tail hangs from the chin (it follows the chin down and back, it does not swing out with the
      // jaw's rotation like a board)
      vec3 r0 = hairPt( 0 ).xyz;
      vec3 Pt = P + ( ( uJaw * vec4( r0, 1.0 ) ).xyz - r0 );
      Pj = mix( Pj, Pt, uJawHang * smoothstep( 0.12, 0.6, t ) );
    }
    P = mix( P, Pj, aA.z );
    T = mix( T, mat3( uJaw ) * T, aA.z );
  }
  hP = P;
  float tl = length( T );
  hT = tl > 1e-7 ? T / tl : vec3( 0.0, -1.0, 0.0 );
  bool beard = aA.w > 0.5;
  vec3 C = beard ? uBeardC : uVolC;
  vec3 R = beard ? uBeardR : uVolR;
  hN = normalize( ( P - C ) / ( R * R ) );
  hW = aA.x * uWidthScale * mix( 1.0, uTaper, smoothstep( 0.3, 1.0, t ) );
}
void hairExpand( inout vec4 mvPosition ) {
  vec3 vt = normalize( ( modelViewMatrix * vec4( hT, 0.0 ) ).xyz );
  bool ortho = projectionMatrix[ 3 ][ 3 ] > 0.5;
  vec3 toCam = ortho ? vec3( 0.0, 0.0, 1.0 ) : normalize( -mvPosition.xyz );
  vec3 sideV = cross( vt, toCam );
  float sl = length( sideV );
  sideV = sl > 1e-5 ? sideV / sl : vec3( 1.0, 0.0, 0.0 );
  float px = ( ortho ? 2.0 : 2.0 * max( -mvPosition.z, 0.01 ) ) / ( projectionMatrix[ 1 ][ 1 ] * uResY );
  float wv = max( hW, px * ( uFine > 0.5 && uTaaOn > 0.5 ? 0.55 : uMinPx ) );
  vHairAlpha = clamp( hW / wv, 0.0, 1.0 );
  mvPosition.xyz += sideV * ( aTpl.y * 0.5 * wv );
  vHairSide = aTpl.y;
  vHairS = aTpl.x;
  vHairRand = aA.y;
}
`;

const FRAG_COMMON = /* glsl */ `
varying float vHairAlpha;
varying float vHairSide;
varying float vHairS;
varying float vHairRand;
uniform float uFine, uTaaOn;
float hairIGN( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
// TAA frame offset of the dither (fx/Temporal.ts): (0, 0) without TAA; the shadow pass does not bind it (static)
uniform vec2 uDitherOffset;
float hairCoverage() {
  return vHairAlpha * ( 1.0 - 0.75 * smoothstep( 0.86, 1.0, vHairS ) );
}
`;

export interface HairShading {
  /** longitudinal shift of the lobes (rad), R = -2x toward the root, TRT = +4x toward the tip */
  shift: number;
  /** longitudinal roughness (Karis B = r^2) */
  roughness: number;
  /** R lobe strength (0.5 = physically based cuticle Fresnel) */
  specular: number;
  /** TT strength (back-lit glow) */
  backlit: number;
  /** diffuse multiple scattering amount */
  scatter: number;
  /** how much the baked occlusion darkens direct light */
  aoDirect: number;
  /**
   * beard1 (wave 6), beard strands only (layer kind 1): + longitudinal roughness (coarse beard hair has a broad, dull
   * highlight), x R strength, extra self-shadowing (occlusion exponent - 1: the inside of the mass darker than its
   * surface), x the back-lit transmission at the tips (the golden rim through the ends). Defaults: none (0, 1, 0, 0).
   */
  beard?: { rough?: number; spec?: number; selfShadow?: number; tipGlow?: number };
}

export class HairMaterial extends THREE.MeshStandardMaterial {
  readonly hair: HairUniforms;
  readonly shade: { [k: string]: THREE.IUniform<number> };
  /** MSAA samples this material is configured for */
  msaaSamples = 0;

  constructor(uniforms: HairUniforms, shading: HairShading, msaa: number) {
    super({ color: 0xffffff, roughness: 0.5, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.35 });
    this.name = 'HairStrands';
    this.hair = uniforms;
    this.shade = {
      uShift: { value: shading.shift },
      uRough: { value: shading.roughness },
      uSpec: { value: shading.specular },
      uBacklit: { value: shading.backlit },
      uScatter: { value: shading.scatter },
      uAODirect: { value: shading.aoDirect },
      uSamples: { value: 4 },
      // beard1: beard strands' roughness add, R scale, occlusion exponent add, tip transmission
      uBeardRough: { value: shading.beard?.rough ?? 0 },
      uBeardSpec: { value: shading.beard?.spec ?? 1 },
      uBeardSelf: { value: shading.beard?.selfShadow ?? 0 },
      uBeardTip: { value: shading.beard?.tipGlow ?? 0 },
    };
    this.setMSAA(msaa);
    this.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, this.hair, this.shade);
      s.uniforms.uDitherOffset = temporal.uDitherOffset;
      s.vertexShader = s.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
${VERT_PARS}
attribute vec3 aRootCol;
attribute vec3 aTipCol;
varying vec3 vHairT;
varying vec3 vHairCol;
varying vec3 vHairRoot;
varying float vHairAO;
varying float vHairKind;`,
        )
        .replace(
          '#include <beginnormal_vertex>',
          `hairEval();
vec3 objectNormal = hN;
#ifdef USE_TANGENT
vec3 objectTangent = vec3( 1.0, 0.0, 0.0 );
#endif`,
        )
        .replace('#include <begin_vertex>', 'vec3 transformed = hP;')
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
hairExpand( mvPosition );
gl_Position = projectionMatrix * mvPosition;
vHairT = normalize( ( modelViewMatrix * vec4( hT, 0.0 ) ).xyz );
vHairAO = hAO;
vHairKind = aA.w;
vHairRoot = aRootCol;
float hs = smoothstep( 0.02, 0.97, aTpl.x );
vHairCol = mix( aRootCol, aTipCol, hs * hs * ( 3.0 - 2.0 * hs ) );`,
        );
      s.fragmentShader = s.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
${FRAG_COMMON}
varying vec3 vHairT;
varying vec3 vHairCol;
varying vec3 vHairRoot;
varying float vHairAO;
varying float vHairKind;
uniform float uShift, uRough, uSpec, uBacklit, uScatter, uAODirect, uSamples;
uniform float uBeardRough, uBeardSpec, uBeardSelf, uBeardTip;
vec3 hairT;
float hairAO;
float hairBeard;
float hairDim = 1.0;`,
        )
        .replace(
          '#include <map_fragment>',
          `diffuseColor.rgb = vHairCol;
hairT = normalize( vHairT );
hairAO = vHairAO;
hairBeard = vHairKind > 0.5 ? 1.0 : 0.0;
// beard1: the inside of a beard lies in its own shadow (only beard strands, only when the style asks)
if ( hairBeard > 0.5 && uBeardSelf > 0.0 ) hairAO = pow( hairAO, 1.0 + uBeardSelf );
{
  // sub-pixel coverage: stochastic (per pixel) — the MSAA rasteriser adds exact geometric coverage for
  // ribbons wider than a sample spacing. (Alpha-to-coverage is NOT used for strands: equal alpha maps to the
  // same sample mask, so overlapping strands would never add up.)
  float cov = hairCoverage();
  // Without MSAA (phones: FXAA, no TAA) a per-PIXEL dither never resolves and reads as static grain. There the
  // threshold is per STRAND instead: a sub-pixel strand is either drawn as a continuous >= 1 px line or dropped
  // entirely (a uniform random subset keeps the coverage right), so beards / hair read as strands, not noise.
  // beard1 (wave 6): every tier but mobile-low runs TAA with MSAA 0, so the per-strand path drew every sub-pixel strand
  // of the film's men as an opaque >= 1 px line (yarn). A "fine" groom under TAA takes the per-pixel dither, which the
  // TAA history resolves into soft sub-pixel strands (uDitherOffset changes it every frame).
  float thr = uSamples < 1.5 && !( uFine > 0.5 && uTaaOn > 0.5 ) ? fract( vHairRand * 97.13 + 0.271 ) : hairIGN( gl_FragCoord.xy + uDitherOffset + vec2( vHairRand * 61.0, vHairRand * 23.0 ) );
  // beard1: a fine groom WITHOUT TAA (mobile-low) keeps the per-strand threshold (no static grain) but draws more,
  // dimmer lines with the same mean coverage — sqrt(cov) of the sub-pixel strands, each shaded sqrt(cov) of the way
  // from its root colour (the roots on the skin below) to its own: thin strands no longer read as opaque yarn
  if ( uFine > 0.5 && uTaaOn < 0.5 && uSamples < 1.5 ) {
    hairDim = sqrt( clamp( cov, 0.0, 1.0 ) );
    cov = hairDim;
  }
  if ( cov <= thr ) discard;
  diffuseColor.a = 1.0;
  if ( hairDim < 1.0 ) diffuseColor.rgb = mix( vHairRoot, diffuseColor.rgb, hairDim );
}`,
        )
        .replace(
          '#include <normal_fragment_begin>',
          `#include <normal_fragment_begin>
normal = normalize( vNormal );`,
        )
        .replace(
          '#include <lights_physical_pars_fragment>',
          `#include <lights_physical_pars_fragment>
float hairG( float B, float th ) { return exp( -0.5 * th * th / ( B * B ) ) / ( 2.5066283 * B ); }
float hairF( float c ) { float x = 1.0 - c; float x2 = x * x; return 0.046 + 0.954 * x2 * x2 * x; }
void RE_Direct_Hair( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  vec3 base = max( material.diffuseColor, vec3( 1e-4 ) );
  vec3 L = directLight.direction;
  vec3 V = geometryViewDir;
  vec3 T = hairT;
  float VoL = dot( V, L );
  float sL = clamp( dot( T, L ), -0.9999, 0.9999 );
  float sV = clamp( dot( T, V ), -0.9999, 0.9999 );
  float cosD = cos( 0.5 * abs( asin( sV ) - asin( sL ) ) );
  vec3 Lp = L - sL * T;
  vec3 Vp = V - sV * T;
  float cosPhi = dot( Lp, Vp ) * inversesqrt( dot( Lp, Lp ) * dot( Vp, Vp ) + 1e-4 );
  float cosHalfPhi = sqrt( clamp( 0.5 + 0.5 * cosPhi, 0.0, 1.0 ) );
  float nP = 1.19 / cosD + 0.36 * cosD;
  float rgh = uRough + hairBeard * uBeardRough;
  float r2 = rgh * rgh;
  vec3 S = vec3( 0.0 );
  // R: primary highlight, shifted toward the root
  float aR = -2.0 * uShift;
  float sa = sin( aR ), ca = cos( aR );
  float shR = 2.0 * sa * ( ca * cosHalfPhi * sqrt( 1.0 - sV * sV ) + sa * sV );
  float Mp = hairG( r2 * 1.4142 * max( cosHalfPhi, 0.2 ), sL + sV - shR );
  float Fp = hairF( sqrt( clamp( 0.5 + 0.5 * VoL, 0.0, 1.0 ) ) );
  S += vec3( Mp * 0.25 * cosHalfPhi * Fp * uSpec * 2.0 * ( hairBeard > 0.5 ? uBeardSpec : 1.0 ) );
  // TT: transmission (back light through the strands)
  Mp = hairG( r2 * 0.5, sL + sV - uShift );
  float a = 1.0 / nP;
  float hh = cosHalfPhi * ( 1.0 + a * ( 0.6 - 0.8 * cosPhi ) );
  float f = hairF( cosD * sqrt( clamp( 1.0 - hh * hh, 0.0, 1.0 ) ) );
  vec3 Tp = pow( base, vec3( 0.5 * sqrt( max( 1.0 - hh * hh * a * a, 0.0 ) ) / cosD ) );
  S += Mp * exp( -3.65 * cosPhi - 3.98 ) * ( 1.0 - f ) * ( 1.0 - f ) * Tp * uBacklit * ( 0.35 + 0.65 * hairAO ) * ( hairBeard > 0.5 ? 1.0 + uBeardTip * smoothstep( 0.5, 1.0, vHairS ) : 1.0 );
  // TRT: coloured secondary highlight, shifted toward the tip
  Mp = hairG( r2 * 2.0, sL + sV - 4.0 * uShift );
  f = hairF( cosD * 0.5 );
  Tp = pow( base, vec3( 0.8 / cosD ) );
  S += Mp * exp( 17.0 * cosPhi - 16.78 ) * ( 1.0 - f ) * ( 1.0 - f ) * f * Tp;
  // diffuse multiple scattering (Kajiya-Kay blended with a wrapped volume normal)
  float kd = 1.0 - abs( sL );
  vec3 fakeN = normalize( mix( normalize( V - T * sV ), geometryNormal, 0.75 ) );
  float wrapNL = clamp( ( dot( fakeN, L ) + 0.6 ) / 2.56, 0.0, 1.0 );
  float luma = dot( base, vec3( 0.2126, 0.7152, 0.0722 ) );
  vec3 tint = pow( base / max( luma, 1e-4 ), vec3( 1.0 - hairAO ) );
  vec3 D = sqrt( base ) * RECIPROCAL_PI * mix( wrapNL, kd, 0.33 ) * uScatter * tint + base * RECIPROCAL_PI * wrapNL;
  float selfShadow = mix( 1.0, hairAO, uAODirect );
  reflectedLight.directSpecular += directLight.color * S * selfShadow * hairDim;
  reflectedLight.directDiffuse += directLight.color * D * selfShadow;
}
#undef RE_Direct
#define RE_Direct RE_Direct_Hair`,
        )
        .replace(
          '#include <aomap_fragment>',
          `#include <aomap_fragment>
reflectedLight.indirectDiffuse *= hairAO * ( 1.0 + 0.6 * uScatter );
reflectedLight.indirectSpecular *= hairAO * hairAO;`,
        );
    };
  }

  /**
   * MSAA samples of the target: with MSAA (> 1) ribbons are drawn down to 0.55 px and the rasteriser's sample
   * coverage anti-aliases them; without MSAA they are kept >= 1 px and the (dithered) coverage does the rest.
   */
  setMSAA(samples: number) {
    this.msaaSamples = samples;
    this.shade.uSamples.value = Math.max(1, samples);
    this.hair.uMinPx.value = samples > 1 ? 0.55 : 1.0;
  }

  override customProgramCacheKey() {
    return 'hair-strands-v4'; // beard1 (wave 6): fine coverage, beard shading, hanging jaw follow
  }
}

/** Shadow-map depth material with the same strand evaluation (wider, coverage-dithered ribbons). */
export class HairDepthMaterial extends THREE.MeshDepthMaterial {
  readonly shadowRes = { value: 2048 };
  readonly shadowMinPx = { value: 1.0 };
  constructor(uniforms: HairUniforms) {
    super({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    this.name = 'HairDepth';
    this.onBeforeCompile = (s) => {
      // (beard1: the shadow map keeps its >= 1 texel ribbons — no TAA there)
      Object.assign(s.uniforms, uniforms, { uResY: this.shadowRes, uMinPx: this.shadowMinPx, uTaaOn: { value: 0 } });
      s.vertexShader = s.vertexShader
        .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
        .replace('#include <begin_vertex>', 'hairEval();\nvec3 transformed = hP;')
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
hW *= 1.6;
hairExpand( mvPosition );
gl_Position = projectionMatrix * mvPosition;`,
        );
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\n${FRAG_COMMON}`).replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
if ( hairCoverage() <= hairIGN( gl_FragCoord.xy + vec2( vHairRand * 61.0, vHairRand * 23.0 ) ) ) discard;`,
      );
    };
  }
  override customProgramCacheKey() {
    return 'hair-depth-v2';
  }
}

/** Scalp / beard cap: an offset copy of the skin under the strands (hair-coloured, soft hairline). */
export class HairCapMaterial extends THREE.MeshStandardMaterial {
  constructor(jaw: THREE.IUniform<THREE.Matrix4>, msaa: number) {
    super({ vertexColors: true, roughness: 0.85, metalness: 0, envMapIntensity: 0.12 });
    this.name = 'HairCap';
    this.setMSAA(msaa);
    this.onBeforeCompile = (s) => {
      s.uniforms.uJaw = jaw;
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aJaw;\nuniform mat4 uJaw;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
if ( aJaw > 0.002 ) transformed = mix( transformed, ( uJaw * vec4( transformed, 1.0 ) ).xyz, aJaw );`,
        );
    };
  }
  setMSAA(samples: number) {
    const a2c = samples > 1;
    this.alphaToCoverage = a2c;
    // without MSAA a hashed alpha is static grain at the hairline (phones have no TAA): a clean alpha test instead
    this.alphaHash = false;
    this.alphaTest = a2c ? 0 : 0.5;
    this.needsUpdate = true;
  }
  override customProgramCacheKey() {
    return 'hair-cap-v1';
  }
}
