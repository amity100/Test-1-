import * as THREE from 'three';
import { skinShading } from '../../fx/SSS';
import { runSync } from '../../core/slice';

/*
 * Realistic skin on top of MeshPhysicalMaterial (keeps three.js lights, shadows, IBL and fog/post compatibility).
 *
 *  - Subsurface scattering approximation (pre-integrated style): per-channel wrapped diffuse whose width grows
 *    with screen-space curvature, plus per-channel normal blending (red light "sees" the smooth geometric
 *    normal, blue the fully detailed one) -> soft, warm terminator and blurred pores in the diffuse term.
 *  - Transmission through thin parts (ears, nostrils, eyelids, fingers, web of the hand) using a baked
 *    thickness mask and a shadow-map lookup offset toward the light (so only genuinely thin geometry glows).
 *  - Dual-lobe GGX specular (IOR 1.4) with a baked roughness map (oily T-zone, dry cheeks/limbs) and
 *    cavity/pore specular occlusion.  Optional sheen for vellus hair ("peach fuzz") on the hero tier.
 *  - Micro normal detail: a tiling pore/wrinkle normal texture blended over the baked normal map with a
 *    per-region pore-strength mask and a per-vertex UV-density factor so pores keep a constant world size.
 *
 *  - Screen-space subsurface scattering (desktop, fx/SSS.ts): while `skinShading.uSSSActive` is 1 the diffuse
 *    switches to a sharper detailed-normal Lambert (the separable blur does the scattering); in the skin pass
 *    (`skinShading.uSkinPass` = 1) the material outputs only its diffuse radiance / albedo luminance for the blur.
 *    Phones (quality 'low') keep the pre-integrated wrap model alone.
 *  - Region map (optional, bake_skin.py --regions): R = capillary flush zones (nose, cheeks, ears: fine
 *    thread-like redness, "admoni"), G = sebum T-zone (0..0.6, glossier, larger pores) / lips (>= 0.8, moist),
 *    B = sun-exposure freckle density.  'high' quality adds resolution-independent procedural freckles (cellular,
 *    in bind space) where B > 0, so they stay crisp in a close-up far beyond the 2K texture.
 *  - Hero level (`uHero` 0..1, 'high' quality only; HumanModel.setHero): a third, finer pore octave, micro
 *    roughness breakup and a stronger vellus-hair rim, for cinematic close-ups.
 *  - Transmission for directional (shadow-map offset), point and spot lights (lamp glow through ears/nostrils).
 *
 * Mask texture (baked by tools/human/bake_skin.py): R = ambient occlusion & cavity, G = roughness (0..1 ->
 * roughnessRange), B = thickness / translucency.  Normal map: RG = tangent-space normal (z rebuilt),
 * B = pore strength (no alpha channels: browsers may premultiply them).
 */

export interface SkinTextures {
  albedo?: THREE.Texture | null;
  normal?: THREE.Texture | null;
  mask?: THREE.Texture | null;
  detail?: THREE.Texture | null;
  /** region map (flush / oil+lips / freckle density), see above */
  region?: THREE.Texture | null;
}

export interface SkinOptions {
  quality: 'low' | 'medium' | 'high';
  tint?: THREE.Color; // multiplies the albedo (used for per-instance skin-tone variation)
  /** procedural freckle amount 0..1 (preset skin.freckles); default 0 */
  freckles?: number;
  /** capillary flush amount 0..1 (preset skin.ruddy); default 0.4 */
  ruddy?: number;
  /** larger pale spots / age spots 0..1 (preset skin.sun_spots); default 0.3 x freckles */
  sunSpots?: number;
}

export class SkinMaterial extends THREE.MeshPhysicalMaterial {
  readonly skinUniforms = {
    uMaskMap: { value: null as THREE.Texture | null },
    uDetailNormal: { value: null as THREE.Texture | null },
    uDetailTile: { value: 50.0 }, // detail tile repetitions per metre of skin (tile 2 cm, pores ~0.35 mm apart)
    uDetailStrength: { value: 0.7 },
    // face pass 2: skin is a MATTE dielectric — primary lobe roughness ~0.45-0.72 (was 0.3-0.8 scaled by 0.72, i.e.
    // ~0.22-0.58: the forehead and nose shone like plastic under the film key lights)
    uRoughRange: { value: new THREE.Vector2(0.44, 0.74) },
    uAOIntensity: { value: 1.0 },
    uSssWrap: { value: new THREE.Vector3(0.22, 0.085, 0.06) },
    uSssNormalBlend: { value: new THREE.Vector3(0.85, 0.45, 0.25) },
    uCurvScale: { value: 0.035 },
    // dual-lobe specular (d'Eon / UE4 dual specular): lobe 1 = the matte base (roughness x1), lobe 2 = a tighter
    // sebum sheen (roughness x0.55) weighted ONLY on the T-zone (region G), the lips and sweat — elsewhere ~2.5 %
    uLobe: { value: new THREE.Vector3(1.0, 0.55, 0.16) }, // lobe1 roughness scale, lobe2 roughness scale, lobe2 max mix
    /** lip colour multiplier (region map lips); warm, slightly darker lips instead of pale glossy ones */
    uLipTint: { value: new THREE.Color(0.97, 0.84, 0.8) },
    uTransColor: { value: new THREE.Color(1.0, 0.28, 0.12) },
    uTransScale: { value: 1.25 },
    uTransPower: { value: 3.0 },
    uTransDepth: { value: 0.022 },
    uTransAmbient: { value: 0.035 },
    uShadowScatter: { value: new THREE.Vector3(0.55, 0.92, 1.0) }, // per-channel shadow edge softening
    uSkinTint: { value: new THREE.Color(1, 1, 1) },
    uWet: { value: 0.0 }, // sweat / wetness 0..1
    uDirt: { value: 0.0 },
    uRegionMap: { value: null as THREE.Texture | null },
    uFreckles: { value: 0.0 }, // procedural freckle amount ('high')
    uSunSpots: { value: 0.0 }, // larger pale spots / age spots ('high'; preset skin.sun_spots)
    uRuddy: { value: 0.4 }, // capillary flush amount
    uLipWet: { value: 0.7 }, // lip moisture
    uHero: { value: 0.0 }, // hero close-up detail 0..1 ('high' quality only)
  };
  /** beard1 (wave 6): the skin under a groom's beard / scalp (roots, stubble, the hair's shadow) — BEARD / SCALP SKIN below */
  readonly groomSkin = createGroomSkinUniforms();

  constructor(tex: SkinTextures, opts: SkinOptions) {
    super({
      color: tex.albedo ? 0xffffff : 0xb07a5e,
      map: tex.albedo ?? null,
      normalMap: tex.normal ?? null,
      roughness: 0.5,
      metalness: 0,
      ior: 1.4,
      specularIntensity: 1,
      sheen: opts.quality === 'high' ? 0.12 : 0,
      sheenColor: new THREE.Color(0.9, 0.66, 0.52),
      sheenRoughness: 0.5,
    });
    this.name = 'HumanSkin';
    if (tex.normal) this.normalScale.set(1, 1);
    const u = this.skinUniforms;
    u.uMaskMap.value = tex.mask ?? null;
    u.uDetailNormal.value = tex.detail ?? null;
    u.uRegionMap.value = tex.region ?? null;
    if (opts.tint) u.uSkinTint.value.copy(opts.tint);
    if (opts.freckles !== undefined) u.uFreckles.value = opts.freckles;
    if (opts.ruddy !== undefined) u.uRuddy.value = opts.ruddy;
    u.uSunSpots.value = opts.sunSpots ?? 0.3 * u.uFreckles.value;
    const q = opts.quality;
    const defines: Record<string, string> = {};
    if (tex.mask) defines.SKIN_MASK = '';
    if (tex.region && q !== 'low') defines.SKIN_REGION = '';
    if (q === 'high') defines.SKIN_HERO = '';
    if (tex.detail && tex.normal) defines.SKIN_DETAIL = '';
    if (q !== 'low') defines.SKIN_TRANSMISSION = '';
    if (q === 'high') defines.SKIN_DUAL_LOBE = '';
    if (q === 'low') defines.SKIN_LOW = '';
    this.defines = { ...(this.defines ?? {}), ...defines };
    const key = `skin-${q}-${Object.keys(defines).join(',')}`;
    this.customProgramCacheKey = () => key;
    this.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, u, skinShading);
      s.vertexShader = s.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float detailScale;
varying float vDetailScale;
varying vec3 vSkinWorldPos;
varying vec3 vSkinBind;`,
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
vSkinWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
vSkinBind = position;
vDetailScale = detailScale;`,
        );
      s.fragmentShader = s.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform sampler2D uMaskMap;
uniform sampler2D uDetailNormal;
uniform float uDetailTile, uDetailStrength, uAOIntensity, uCurvScale, uTransScale, uTransPower, uTransDepth, uTransAmbient, uWet, uDirt;
uniform float uSSSActive, uSkinPass, uFreckles, uSunSpots, uRuddy, uLipWet, uHero;
uniform sampler2D uRegionMap;
vec3 gRegion = vec3( 0.0 );
float gLips = 0.0;
float gOil = 0.0;
uniform vec2 uRoughRange;
uniform vec3 uSssWrap, uSssNormalBlend, uLobe, uTransColor, uSkinTint, uShadowScatter, uLipTint;
float gLobeMix = 0.0;
varying float vDetailScale;
varying vec3 vSkinWorldPos;
varying vec3 vSkinBind;
vec4 gSkinMask = vec4(1.0, 0.5, 0.0, 0.0);
vec3 gSmoothN = vec3(0.0, 0.0, 1.0);
vec3 gTransLight = vec3(0.0);
float gScatter = 0.5;
float gSpecOcc = 1.0;
float gCavity = 1.0;
float skinHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float skinHash3( vec3 p ) { return fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 ); }
float skinNoise3( vec3 p ) {
  vec3 i = floor( p ), f = fract( p );
  vec3 u = f * f * ( 3.0 - 2.0 * f );
  float a = mix( skinHash3( i ), skinHash3( i + vec3( 1.0, 0.0, 0.0 ) ), u.x );
  float b = mix( skinHash3( i + vec3( 0.0, 1.0, 0.0 ) ), skinHash3( i + vec3( 1.0, 1.0, 0.0 ) ), u.x );
  float c = mix( skinHash3( i + vec3( 0.0, 0.0, 1.0 ) ), skinHash3( i + vec3( 1.0, 0.0, 1.0 ) ), u.x );
  float d = mix( skinHash3( i + vec3( 0.0, 1.0, 1.0 ) ), skinHash3( i + vec3( 1.0, 1.0, 1.0 ) ), u.x );
  return mix( mix( a, b, u.y ), mix( c, d, u.y ), u.z );
}
// resolution-independent freckles: cellular spots in bind space (p in cells; one candidate spot per cell)
float gFreckleWarp = 0.5;
float skinFreckles( vec3 p, float density ) {
  gFreckleWarp = skinNoise3( p * 3.1 );
  vec3 i = floor( p - 0.5 );
  float acc = 0.0;
  for ( int k = 0; k < 8; k++ ) {
    vec3 c = i + vec3( float( k & 1 ), float( ( k >> 1 ) & 1 ), float( ( k >> 2 ) & 1 ) );
    float h = skinHash3( c );
    if ( h > density ) continue;
    vec3 jit = vec3( skinHash3( c + 17.1 ), skinHash3( c + 31.7 ), skinHash3( c + 47.3 ) );
    float hr = skinHash3( c + 5.3 );
    float r = 0.16 + 0.36 * hr * hr;
    // slightly irregular outline
    vec3 d = p - ( c + jit );
    // irregular, blotchy outline (a freckle is a patch of pigment, not a disc)
    float l = length( d ) * ( 1.0 + 0.6 * ( gFreckleWarp - 0.5 ) ) + 0.12 * ( skinHash3( c + 71.0 ) - 0.5 ) * d.x / max( r, 1e-3 );
    float sp = 1.0 - smoothstep( r * 0.15, r * 1.1, l );
    acc = acc + sp * ( 0.25 + 0.6 * fract( h * 91.7 ) ) * ( 1.0 - acc );
  }
  return acc;
}
float skinNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( skinHash( i ), skinHash( i + vec2( 1.0, 0.0 ) ), u.x ), mix( skinHash( i + vec2( 0.0, 1.0 ) ), skinHash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
#endif`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
diffuseColor.rgb *= uSkinTint;
#ifdef SKIN_MASK
gSkinMask = texture2D( uMaskMap, vMapUv );
#endif
diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.7, 0.6), uDirt * gSkinMask.r );
#ifdef SKIN_DETAIL
{
  // mid-frequency mottling (capillary blotches, uneven tan) in bind-pose space (metres), so it is continuous across
  // uv seams (a uv-space noise broke at every island border)
  vec3 bp = vSkinBind;
  float n1 = skinNoise3( bp * 45.0 ), n2 = skinNoise3( bp * 155.0 + 7.3 ), n3 = skinNoise3( bp * 85.0 + 3.1 );
  float lum = 1.0 + 0.07 * ( n1 - 0.5 ) + 0.05 * ( n2 - 0.5 );
  diffuseColor.rgb *= lum * vec3( 1.0 + 0.05 * ( n3 - 0.5 ), 1.0 - 0.02 * ( n3 - 0.5 ), 1.0 - 0.04 * ( n3 - 0.5 ) );
}
#endif
#ifdef SKIN_REGION
{
  gRegion = texture2D( uRegionMap, vMapUv ).rgb;
  gLips = smoothstep( 0.72, 0.9, gRegion.g );
  gOil = clamp( gRegion.g / 0.6, 0.0, 1.0 ) * ( 1.0 - gLips );
  // warm, natural lip colour (the baked lips read pale under warm key light)
  diffuseColor.rgb *= mix( vec3( 1.0 ), uLipTint, gLips );
  vec3 bp = vSkinBind;
  // capillaries: thin thread-like redness (ridged noise, ~1-3 mm) and a soft flush in the flushed zones —
  // haemoglobin absorbs green and blue (Beer-Lambert), so the tint is pink-red, never orange
  float cap = 1.0 - abs( skinNoise3( bp * 380.0 ) * 2.0 - 1.0 );
  cap = cap * cap * cap * cap;
  float cap2 = 1.0 - abs( skinNoise3( bp * 900.0 + 5.0 ) * 2.0 - 1.0 );
  cap2 = cap2 * cap2 * cap2 * cap2;
  float fl = gRegion.r * uRuddy * ( 0.1 + 0.4 * cap + 0.25 * cap2 );
  diffuseColor.rgb *= exp( -fl * vec3( -0.03, 0.3, 0.2 ) );
  #ifdef SKIN_HERO
  if ( uFreckles + uSunSpots > 0.0 && gRegion.b > 0.01 ) {
    // fine freckles (0.6-1.3 mm) over the baked ones; blend to their mean tone once a spot is sub-pixel
    vec3 fp = bp * 330.0;
    float fw = length( fwidth( fp ) );
    // freckles cluster (sun-exposed patches), they are not a uniform dot screen
    float clus = smoothstep( 0.25, 0.75, skinNoise3( bp * 38.0 + 11.0 ) );
    float dens = clamp( gRegion.b * uFreckles * ( 0.45 + 1.1 * clus ), 0.0, 1.0 ) * 0.85;
    float fr = fw < 1.2 ? skinFreckles( fp, dens ) : 0.0;
    fr = mix( fr, dens * 0.22, smoothstep( 0.35, 1.2, fw ) );
    // a sparser layer of larger, paler spots (2-4 mm): a few big freckles on a youth, age / sun spots on an old,
    // weathered face (preset skin.sun_spots; David stays "fresh, not weather-beaten" — docs/visual-bible.md 3.13)
    vec3 lp = bp * 150.0 + 7.7;
    float fwl = length( fwidth( lp ) );
    float dl = clamp( gRegion.b * uSunSpots * ( 0.45 + 1.1 * clus ), 0.0, 1.0 ) * 0.6;
    float lg = fwl < 1.2 && dl > 0.0 ? skinFreckles( lp, dl ) : 0.0;
    lg = mix( lg, dl * 0.18, smoothstep( 0.35, 1.2, fwl ) );
    diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.84, 0.72, 0.6 ), lg * 0.7 );
    diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.76, 0.61, 0.47 ), fr * 0.9 );
  }
  #endif
}
#endif`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `float roughnessFactor = mix( uRoughRange.x, uRoughRange.y, gSkinMask.g );
float gSpecBreak = 1.0;
// sweat is a thin, PATCHY film on the forehead / nose / upper lip (beads), not a uniform varnish: it feeds the tight
// second lobe and lowers the base roughness only a little (uWet 0.3 used to turn the whole face into plastic)
float gWet = uWet * ( 0.3 + 0.7 * gOil ) * smoothstep( 0.3, 0.8, skinNoise3( vSkinBind * 240.0 + 1.7 ) );
roughnessFactor = mix( roughnessFactor, 0.34, gWet * 0.5 );
#ifdef SKIN_HERO
{
  // micro-relief breakup of the sheen (~0.5-2 mm): real skin highlights are granular, a smooth highlight reads as
  // plastic. Faded out once the pattern is sub-pixel (TAA would average it anyway).
  vec3 mp = vSkinBind * 1500.0;
  float fwm = length( fwidth( mp ) );
  float amt = clamp( 1.4 - fwm * 0.9, 0.0, 1.0 ) * ( 0.75 + 0.25 * uHero );
  float m1 = skinNoise3( mp ), m2 = skinNoise3( mp * 2.7 + 3.3 );
  gSpecBreak = mix( 1.0, 0.5 + 0.7 * m1 + 0.3 * ( m2 - 0.5 ), amt );
  roughnessFactor *= mix( 1.0, 0.88 + 0.26 * m2, amt );
}
#endif
#ifdef SKIN_REGION
// sebum on the T-zone: a little glossier; lips: moist (a sharp, broken-up sheen)
roughnessFactor *= mix( 1.0, 0.9, gOil );
// lips: matte-ish base with a subtle moist sheen carried by the second lobe (was 0.2-0.38 base: glossy, pale lips)
roughnessFactor = mix( roughnessFactor, 0.4 + 0.12 * skinNoise3( vSkinBind * 1400.0 ), gLips );
#endif
// second-lobe weight: sebum T-zone, a moist lip sheen, sweat; a trace elsewhere
gLobeMix = uLobe.z * ( 0.15 + 0.85 * gOil ) + 0.2 * gLips * uLipWet + 0.35 * gWet;`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#ifdef USE_NORMALMAP_TANGENTSPACE
  vec3 nTex = texture2D( normalMap, vNormalMapUv ).xyz;
  // xy = tangent-space normal, z channel = pore strength (nz is rebuilt)
  vec3 mapN = vec3( nTex.xy * 2.0 - 1.0, 0.0 );
  mapN.z = sqrt( max( 1.0 - dot( mapN.xy, mapN.xy ), 0.0 ) );
  float gPores = nTex.z;
  mapN.xy *= normalScale;
  #ifdef SKIN_DETAIL
  {
    // tiling micro-relief (pores + furrows): RG = normal, B = micro cavity
    vec2 duv = vNormalMapUv * ( uDetailTile / max( vDetailScale, 0.05 ) );
    vec3 t1 = texture2D( uDetailNormal, duv ).xyz;
    vec2 d1 = t1.xy * 2.0 - 1.0;
    float cav = t1.z;
    #ifndef SKIN_LOW
    vec3 t2 = texture2D( uDetailNormal, duv * 2.71 + vec2( 0.37, 0.61 ) ).xyz;
    d1 += ( t2.xy * 2.0 - 1.0 ) * 0.45;
    cav *= mix( 1.0, t2.z, 0.5 );
    #endif
    #ifdef SKIN_HERO
    {
      // mid-frequency relief (1-4 mm undulation between pore fields): breaks the smooth CG highlight shape
      vec2 duvM = duv * 0.29 + vec2( 0.13, 0.57 );
      vec3 tm = texture2D( uDetailNormal, duvM ).xyz;
      d1 += ( tm.xy * 2.0 - 1.0 ) * 0.28;
    }
    if ( uHero > 0.0 ) {
      // hero close-up: a third, finer octave (micro furrows between the pores), faded by its own footprint
      vec2 duv3 = duv * 6.13 + vec2( 0.71, 0.29 );
      vec3 t3 = texture2D( uDetailNormal, duv3 ).xyz;
      vec2 fw3 = fwidth( duv3 );
      float f3 = clamp( 1.5 - max( fw3.x, fw3.y ) * 1.4, 0.0, 1.0 ) * uHero;
      d1 += ( t3.xy * 2.0 - 1.0 ) * 0.3 * f3;
      cav *= mix( 1.0, t3.z, 0.35 * f3 );
    }
    #endif
    #ifdef SKIN_REGION
    // larger, deeper pores on the sebaceous T-zone; smooth lips
    d1 *= ( 1.0 + 0.45 * gOil ) * ( 1.0 - 0.7 * gLips );
    #endif
    vec2 fw = fwidth( duv );
    float mip = max( fw.x, fw.y ); // detail tiles per pixel
    float fade = clamp( 1.6 - mip * 1.4, 0.0, 1.0 );
    float amt = uDetailStrength * ( 0.15 + gPores );
    #ifdef SKIN_HERO
    // close-ups: the pore field must read (the 2K map can't carry it); stronger on the face's pore zones
    amt *= 1.0 + 0.7 * uHero;
    #endif
    mapN.xy += d1 * amt * fade;
    gCavity = mix( 1.0, cav, clamp( amt, 0.0, 1.0 ) * fade );
    // micro-normal variance lost to minification widens the specular lobe instead of vanishing
    float rv = amt * 0.1 * smoothstep( 0.0015, 0.02, mip );
    roughnessFactor = min( 1.0, sqrt( roughnessFactor * roughnessFactor + rv ) );
  }
  #endif
  normal = normalize( tbn * mapN );
  // light scattered deep in the dermis (red) no longer sees pores & fine wrinkles, but still sees muscles
  // and bone: a mip-biased (~8x blurred) lookup of the same normal map, without the micro detail
  {
    vec2 nLo = texture2D( normalMap, vNormalMapUv, 3.0 ).xy * 2.0 - 1.0;
    vec3 mapNLo = vec3( nLo * normalScale, 0.0 );
    mapNLo.z = sqrt( max( 1.0 - dot( mapNLo.xy, mapNLo.xy ), 0.0 ) );
    gSmoothN = normalize( tbn * mapNLo );
  }
#else
  gSmoothN = normalize( nonPerturbedNormal );
#endif
#ifdef SKIN_HERO
diffuseColor.rgb *= mix( 0.86 + 0.14 * gCavity, 0.76 + 0.24 * gCavity, uHero );
#else
diffuseColor.rgb *= 0.86 + 0.14 * gCavity;
#endif
{
  // screen-space curvature -> scattering width (thin/curved parts scatter more visibly)
  vec3 dn = fwidth( normalize( nonPerturbedNormal ) );
  vec3 dp = fwidth( vSkinWorldPos );
  float curv = length( dn ) / max( length( dp ), 1e-5 );
  gScatter = clamp( 0.3 + curv * uCurvScale, 0.3, 1.0 );
}
// specular occlusion: creases / folds (baked AO+cavity, squared) and the pores (micro cavity) hold no highlight
gSpecOcc = mix( 1.0, gSkinMask.r * gSkinMask.r, 0.9 ) * mix( 1.0, gCavity * gCavity, 0.85 ) * gSpecBreak;`,
        )
        .replace(
          '#include <lights_physical_pars_fragment>',
          `#include <lights_physical_pars_fragment>
void RE_Direct_Skin( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  vec3 L = directLight.direction;
  float nlHi = dot( geometryNormal, L );
  float nlLo = dot( gSmoothN, L );
  // with the screen-space blur active (desktop) the diffuse is a sharper detailed-normal Lambert: the blur does
  // the scattering; without it (phones, harnesses) the pre-integrated wrap + normal blending approximate it
  vec3 nl = mix( vec3( nlHi ), vec3( nlLo ), uSssNormalBlend * ( 1.0 - 0.7 * uSSSActive ) );
  #ifdef SKIN_LOW
  vec3 w = uSssWrap * 0.7;
  #else
  vec3 w = uSssWrap * gScatter * ( 1.0 - 0.65 * uSSSActive );
  #endif
  vec3 diff = pow( clamp( ( nl + w ) / ( 1.0 + w ), 0.0, 1.0 ), vec3( 1.0 ) + w );
  reflectedLight.directDiffuse += diff * directLight.color * BRDF_Lambert( material.diffuseColor );
  float dotNL = saturate( nlHi );
  vec3 irradiance = dotNL * directLight.color;
  #ifdef SKIN_DUAL_LOBE
    PhysicalMaterial m1 = material;
    m1.roughness = clamp( material.roughness * uLobe.x, 0.06, 1.0 );
    PhysicalMaterial m2 = material;
    m2.roughness = clamp( material.roughness * uLobe.y, 0.14, 1.0 );
    vec3 spec = mix( BRDF_GGX( L, geometryViewDir, geometryNormal, m1 ), BRDF_GGX( L, geometryViewDir, geometryNormal, m2 ), clamp( gLobeMix, 0.0, 0.6 ) );
  #else
    vec3 spec = BRDF_GGX( L, geometryViewDir, geometryNormal, material );
  #endif
  reflectedLight.directSpecular += irradiance * spec * gSpecOcc;
  #ifdef USE_SHEEN
    sheenSpecularDirect += irradiance * BRDF_Sheen( L, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
  #endif
  #ifdef SKIN_TRANSMISSION
  {
    float thick = gSkinMask.b;
    vec3 Lb = normalize( L + gSmoothN * 0.35 );
    float back = pow( saturate( dot( geometryViewDir, -Lb ) ), uTransPower ) * uTransScale;
    float facing = saturate( 0.5 - 0.5 * nlLo );
    vec3 t = uTransColor * ( back + uTransAmbient * facing ) * thick;
    reflectedLight.directDiffuse += t * gTransLight * material.diffuseColor * 3.0;
  }
  #endif
}
#undef RE_Direct
#define RE_Direct RE_Direct_Skin`,
        )
        .replace(
          'getPointLightInfo( pointLight, geometryPosition, directLight );',
          `getPointLightInfo( pointLight, geometryPosition, directLight );
		gTransLight = directLight.color * 0.8; // lamps: no offset shadow lookup (cube maps); thin parts glow`,
        )
        .replace(
          'getSpotLightInfo( spotLight, geometryPosition, directLight );',
          `getSpotLightInfo( spotLight, geometryPosition, directLight );
		gTransLight = directLight.color * 0.8;`,
        )
        .replace(
          'getDirectionalLightInfo( directionalLight, directLight );',
          `getDirectionalLightInfo( directionalLight, directLight );
		gTransLight = directLight.color;`,
        )
        .replace(
          'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;',
          `#ifdef SKIN_TRANSMISSION
		gTransLight *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, directionalShadowMatrix[ i ] * vec4( vSkinWorldPos + ( vec4( directLight.direction, 0.0 ) * viewMatrix ).xyz * uTransDepth, 1.0 ) ) : 1.0;
		#endif
		{
			// light diffusing under the skin softens shadow edges per channel: a warm fringe instead of a hard cut
			float skinSh = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
			#ifdef SKIN_HERO
			if ( directLight.visible && receiveShadow ) {
				// face pass 2 ('high' only): thin casters (hair strands, lashes of a beard) alias in a 1-texel PCF; on skin
				// four more bilinear-PCF lookups on a rotated ~1.7-texel square soften them into a penumbra
				vec2 sts = 1.7 / directionalLightShadow.shadowMapSize;
				float acc = skinSh;
				acc += getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] + vec4( 0.8 * sts.x, 0.6 * sts.y, 0.0, 0.0 ) );
				acc += getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] + vec4( -0.6 * sts.x, 0.8 * sts.y, 0.0, 0.0 ) );
				acc += getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] + vec4( -0.8 * sts.x, -0.6 * sts.y, 0.0, 0.0 ) );
				acc += getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] + vec4( 0.6 * sts.x, -0.8 * sts.y, 0.0, 0.0 ) );
				skinSh = acc * 0.2;
			}
			#endif
			// face pass 2: at GRAZING incidence a shadow-map texel stretches ~1/cos across the skin, so the thin hair
			// strands' shadow turned into a blocky vertical stripe on a rim-lit temple / cheek (golden back light, shot
			// 16; proven by switching the groom's castShadow off). Where the sun only grazes the skin (N.L ~0.02-0.3)
			// the shadow term fades out — the N.L / wrap falloff already shapes the light there; beyond the terminator
			// and on surfaces facing the light the shadow map is used in full.
			{
				float nlg = dot( geometryNormal, directLight.direction );
				float graze = smoothstep( -0.06, 0.02, nlg ) * ( 1.0 - smoothstep( 0.06, 0.42, nlg ) );
				skinSh = mix( skinSh, 1.0, graze );
			}
			directLight.color *= pow( vec3( skinSh ), mix( uShadowScatter, vec3( 1.0 ), uSSSActive ) );
		}`,
        )
        .replace(
          '#include <lights_physical_fragment>',
          `#include <lights_physical_fragment>
#ifdef USE_SHEEN
// vellus hair ("peach fuzz"): a soft rim on cheeks / ears / arms, none on the moist lips; stronger in hero shots
material.sheenColor *= ( 1.0 - gLips ) * ( 0.8 + 0.6 * uHero );
#endif`,
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
if ( uSkinPass > 0.5 ) {
  // skin pass of the screen-space SSS: diffuse radiance only (specular stays sharp in the main image), divided by
  // the albedo luminance (post-scatter texturing), luminance in alpha (> 0 marks skin)
  vec3 dSkin = totalDiffuse;
  #ifdef USE_SHEEN
  dSkin *= 1.0 - 0.157 * max3( material.sheenColor );
  #endif
  float aLum = max( dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ), 0.02 );
  gl_FragColor = vec4( dSkin / aLum, aLum );
}`,
        )
        .replace(
          '#include <aomap_fragment>',
          `{
  float ambientOcclusion = mix( 1.0, gSkinMask.r, uAOIntensity );
  reflectedLight.indirectDiffuse *= ambientOcclusion;
  #ifdef SKIN_TRANSMISSION
  reflectedLight.indirectDiffuse += reflectedLight.indirectDiffuse * uTransColor * gSkinMask.b * 0.35;
  #endif
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness ) * mix( 1.0, gCavity, 0.7 );
  #endif
}`,
        );
    };
    patchGroomSkin(this); // beard1 (wave 6): BEARD / SCALP SKIN (end of file) — inert until a groom attaches its map
  }
}

/** Per-vertex UV density (uv units per metre) so detail textures keep a constant world scale. */
export function uvDensityAttribute(g: THREE.BufferGeometry): THREE.BufferAttribute {
  return runSync(uvDensityAttributeSteps(g));
}

/** (load1, wave 4b) uvDensityAttribute as steps (a possible pause between groups of triangles; core/slice), same values */
export function* uvDensityAttributeSteps(g: THREE.BufferGeometry): Generator<void, THREE.BufferAttribute, void> {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const idx = g.getIndex()!;
  const n = pos.count;
  const sum = new Float32Array(n);
  const cnt = new Float32Array(n);
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let t = 0; t < idx.count; t += 3) {
    if (t % 12288 === 0) yield;
    for (let k = 0; k < 3; k++) {
      const i = idx.getX(t + k), j = idx.getX(t + ((k + 1) % 3));
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, j);
      const dp = a.distanceTo(b);
      if (dp < 1e-7) continue;
      const du = Math.hypot(uv.getX(i) - uv.getX(j), uv.getY(i) - uv.getY(j));
      const r = du / dp;
      sum[i] += r;
      cnt[i] += 1;
      sum[j] += r;
      cnt[j] += 1;
    }
  }
  const out = new Float32Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) {
    out[i] = cnt[i] ? sum[i] / cnt[i] : 0;
    mean += out[i];
  }
  mean /= n;
  for (let i = 0; i < n; i++) if (!out[i]) out[i] = mean;
  return new THREE.BufferAttribute(out, 1);
}

// =====================================================================================================================
// BEARD / SCALP SKIN — owner: beard1 (wave 6, "the beards look glued on like a costume"). Everything below and the two
// marked lines in SkinMaterial (the `groomSkin` field, the `patchGroomSkin(this)` call) belong to this section.
//
// A beard grows OUT OF the skin: under it the skin is darkened and tinted by the roots and the stubble and lies in the
// shadow of the hair mass. A groom (src/characters/hair/groomSkin.ts) bakes a small map in the head's UV rectangle —
// R root density (with the sparse stubble zone beyond the strands), G occlusion by the hair above (the beard's shadow
// on the chin and neck, the hair's on the scalp), B beard (1) / scalp (0) root colour, A where single stubble hairs
// show (the thin border) — and attaches it with setGroomSkin(). The shader is in every skin program of a tier (no
// define, no new variant per actor): a uniform branch (`uGroomOn`), so a skin without a groom map (David, every face
// outside the masks) computes exactly what it computed before.
// =====================================================================================================================
export interface GroomSkinUniforms {
  [k: string]: THREE.IUniform;
  uGroomOn: THREE.IUniform<number>;
  uGroomMap: THREE.IUniform<THREE.Texture | null>;
  /** the map's rectangle in the body uv: (u0, v0, du, dv) */
  uGroomRect: THREE.IUniform<THREE.Vector4>;
  /** root colours (linear) */
  uGroomBeardCol: THREE.IUniform<THREE.Color>;
  uGroomScalpCol: THREE.IUniform<THREE.Color>;
  /** x max root cover, y occlusion of direct light, z occlusion of indirect light, w follicle cells per metre */
  uGroomParams: THREE.IUniform<THREE.Vector4>;
  /** x stubble contrast (single hairs at the border), y edge noise, z skin sheen kept under hair (0..1), w unused */
  uGroomParams2: THREE.IUniform<THREE.Vector4>;
}

export function createGroomSkinUniforms(): GroomSkinUniforms {
  return {
    uGroomOn: { value: 0 },
    uGroomMap: { value: null },
    uGroomRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uGroomBeardCol: { value: new THREE.Color(0.02, 0.014, 0.01) },
    uGroomScalpCol: { value: new THREE.Color(0.02, 0.014, 0.01) },
    uGroomParams: { value: new THREE.Vector4(0.85, 0.55, 0.7, 1500) },
    uGroomParams2: { value: new THREE.Vector4(0.8, 0.45, 0.25, 0) },
  };
}

export interface GroomSkinSettings {
  map: THREE.Texture;
  rect: THREE.Vector4;
  beardColor: THREE.Color;
  scalpColor: THREE.Color;
  /** max cover by the root colour (0..1): ~0.85 dark beards, less for white hair (the pink skin shows) */
  cover: number;
  /** how much of the occlusion map darkens direct / indirect light */
  occDirect: number;
  occIndirect: number;
  stubble?: number;
  edgeNoise?: number;
  sheen?: number;
}

/** attach (or with null detach) a groom's skin map: uniforms only — never a recompile */
export function setGroomSkin(m: SkinMaterial, o: GroomSkinSettings | null) {
  const u = m.groomSkin;
  if (!o) {
    u.uGroomOn.value = 0;
    u.uGroomMap.value = null;
    return;
  }
  u.uGroomMap.value = o.map;
  u.uGroomRect.value.copy(o.rect);
  u.uGroomBeardCol.value.copy(o.beardColor);
  u.uGroomScalpCol.value.copy(o.scalpColor);
  u.uGroomParams.value.set(o.cover, o.occDirect, o.occIndirect, 1500);
  u.uGroomParams2.value.set(o.stubble ?? 0.8, o.edgeNoise ?? 0.45, o.sheen ?? 0.25, 0);
  u.uGroomOn.value = 1;
}

const GROOM_SKIN_PARS = /* glsl */ `
uniform float uGroomOn;
uniform sampler2D uGroomMap;
uniform vec4 uGroomRect, uGroomParams, uGroomParams2;
uniform vec3 uGroomBeardCol, uGroomScalpCol;
float gGroomOcc = 0.0;
float gGroomCover = 0.0;`;

// albedo: the root colour over the skin by density; at the border single stubble hairs (hero tier, faded to their mean
// once sub-pixel); an irregular, noisy boundary (the map is vertex-interpolated, the noise breaks its smooth outline)
const GROOM_SKIN_ALBEDO = /* glsl */ `
#ifdef USE_MAP
if ( uGroomOn > 0.5 ) {
  vec4 gm = texture2D( uGroomMap, ( vMapUv - uGroomRect.xy ) / uGroomRect.zw );
  if ( gm.r + gm.g > 0.004 ) {
    vec3 gbp = vSkinBind;
    float gn = skinNoise3( gbp * 170.0 ) * 0.65 + skinNoise3( gbp * 430.0 + 3.7 ) * 0.35;
    float gEdge = clamp( gm.r * ( 1.0 - gm.r ) * 4.0, 0.0, 1.0 );
    float gDens = clamp( gm.r + uGroomParams2.y * gEdge * ( gn - 0.5 ) * 1.6, 0.0, 1.0 );
    float gCov = gDens;
    #ifdef SKIN_HERO
    {
      vec3 gfp = gbp * uGroomParams.w;
      float gfw = length( fwidth( gfp ) );
      if ( gfw < 1.1 && gm.a > 0.01 ) {
        vec3 gci = floor( gfp );
        float gh = skinHash3( gci );
        vec3 gj = vec3( skinHash3( gci + 13.1 ), skinHash3( gci + 27.7 ), skinHash3( gci + 41.3 ) ) * 0.5 + 0.25;
        float gd = length( fract( gfp ) - gj );
        float gDot = step( gh, gDens ) * ( 1.0 - smoothstep( 0.07, 0.19, gd ) );
        float gDots = max( gDens * 0.5, gDot );
        gCov = mix( gCov, mix( gDots, gDens, smoothstep( 0.4, 1.1, gfw ) ), gm.a * uGroomParams2.x );
      }
    }
    #endif
    gGroomCover = clamp( gCov * uGroomParams.x, 0.0, 1.0 );
    diffuseColor.rgb = mix( diffuseColor.rgb, mix( uGroomScalpCol, uGroomBeardCol, gm.b ), gGroomCover );
    gGroomOcc = gm.g;
  }
}
#endif`;

// the skin's own sheen (oil, vellus) does not show through hair
const GROOM_SKIN_SPEC = /* glsl */ `
if ( uGroomOn > 0.5 ) gSpecOcc *= 1.0 - gGroomCover * ( 1.0 - uGroomParams2.z );`;

// the hair mass shades the skin under it (the beard's shadow on the chin and the neck, the hair's on the scalp)
const GROOM_SKIN_LIGHT = /* glsl */ `
if ( uGroomOn > 0.5 && gGroomOcc + gGroomCover > 0.0 ) {
  float gOd = 1.0 - gGroomOcc * uGroomParams.y;
  float gOi = 1.0 - gGroomOcc * uGroomParams.z;
  reflectedLight.directDiffuse *= gOd;
  reflectedLight.directSpecular *= gOd;
  reflectedLight.indirectDiffuse *= gOi;
  reflectedLight.indirectSpecular *= gOi;
  #ifdef USE_SHEEN
  sheenSpecularDirect *= 1.0 - gGroomCover;
  sheenSpecularIndirect *= 1.0 - gGroomCover;
  #endif
}`;

/** the BEARD / SCALP SKIN chunks on a SkinMaterial (called once from its constructor, before any skinning patch) */
function patchGroomSkin(m: SkinMaterial) {
  const prev = m.onBeforeCompile;
  const key = m.customProgramCacheKey();
  m.customProgramCacheKey = () => key + '|groomskin1';
  m.onBeforeCompile = (s, r) => {
    prev.call(m, s, r);
    Object.assign(s.uniforms, m.groomSkin);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${GROOM_SKIN_PARS}`)
      .replace('#include <color_fragment>', `${GROOM_SKIN_ALBEDO}\n#include <color_fragment>`)
      .replace('#include <emissivemap_fragment>', `${GROOM_SKIN_SPEC}\n#include <emissivemap_fragment>`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${GROOM_SKIN_LIGHT}`);
  };
}
