import * as THREE from 'three';
import { skinShading } from '../../fx/SSS';

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
}

export class SkinMaterial extends THREE.MeshPhysicalMaterial {
  readonly skinUniforms = {
    uMaskMap: { value: null as THREE.Texture | null },
    uDetailNormal: { value: null as THREE.Texture | null },
    uDetailTile: { value: 50.0 }, // detail tile repetitions per metre of skin (tile 2 cm, pores ~0.35 mm apart)
    uDetailStrength: { value: 0.7 },
    uRoughRange: { value: new THREE.Vector2(0.3, 0.8) },
    uAOIntensity: { value: 1.0 },
    uSssWrap: { value: new THREE.Vector3(0.22, 0.085, 0.06) },
    uSssNormalBlend: { value: new THREE.Vector3(0.85, 0.45, 0.25) },
    uCurvScale: { value: 0.035 },
    uLobe: { value: new THREE.Vector3(0.72, 1.5, 0.28) }, // lobe1 roughness scale, lobe2 roughness scale, lobe2 mix
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
    uRuddy: { value: 0.4 }, // capillary flush amount
    uLipWet: { value: 0.7 }, // lip moisture
    uHero: { value: 0.0 }, // hero close-up detail 0..1 ('high' quality only)
  };

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
uniform float uSSSActive, uSkinPass, uFreckles, uRuddy, uLipWet, uHero;
uniform sampler2D uRegionMap;
vec3 gRegion = vec3( 0.0 );
float gLips = 0.0;
float gOil = 0.0;
uniform vec2 uRoughRange;
uniform vec3 uSssWrap, uSssNormalBlend, uLobe, uTransColor, uSkinTint, uShadowScatter;
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
float skinFreckles( vec3 p, float density ) {
  vec3 i = floor( p - 0.5 );
  float acc = 0.0;
  for ( int k = 0; k < 8; k++ ) {
    vec3 c = i + vec3( float( k & 1 ), float( ( k >> 1 ) & 1 ), float( ( k >> 2 ) & 1 ) );
    float h = skinHash3( c );
    if ( h > density ) continue;
    vec3 jit = vec3( skinHash3( c + 17.1 ), skinHash3( c + 31.7 ), skinHash3( c + 47.3 ) );
    float r = 0.24 + 0.24 * skinHash3( c + 5.3 );
    // slightly irregular outline
    vec3 d = p - ( c + jit );
    float l = length( d ) * ( 1.0 + 0.25 * ( skinHash3( floor( p * 4.0 ) ) - 0.5 ) );
    float sp = 1.0 - smoothstep( r * 0.1, r, l );
    acc = max( acc, sp * ( 0.3 + 0.7 * fract( h * 91.7 ) ) );
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
  if ( uFreckles > 0.0 && gRegion.b > 0.01 ) {
    // fine freckles (0.6-1.3 mm) over the baked ones; blend to their mean tone once a spot is sub-pixel
    vec3 fp = bp * 330.0;
    float fw = length( fwidth( fp ) );
    // freckles cluster (sun-exposed patches), they are not a uniform dot screen
    float clus = smoothstep( 0.25, 0.75, skinNoise3( bp * 38.0 + 11.0 ) );
    float dens = clamp( gRegion.b * uFreckles * ( 0.45 + 1.1 * clus ), 0.0, 1.0 ) * 0.85;
    float fr = fw < 1.2 ? skinFreckles( fp, dens ) : 0.0;
    fr = mix( fr, dens * 0.22, smoothstep( 0.35, 1.2, fw ) );
    diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.8, 0.66, 0.52 ), fr );
  }
  #endif
}
#endif`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `float roughnessFactor = mix( uRoughRange.x, uRoughRange.y, gSkinMask.g );
roughnessFactor = mix( roughnessFactor, 0.18, uWet );
float gSpecBreak = 1.0;
#ifdef SKIN_HERO
{
  // micro-relief breakup of the sheen (~0.5-2 mm): real skin highlights are granular, a smooth highlight reads as
  // plastic. Faded out once the pattern is sub-pixel (TAA would average it anyway).
  vec3 mp = vSkinBind * 900.0;
  float fwm = length( fwidth( mp ) );
  float amt = clamp( 1.4 - fwm * 0.9, 0.0, 1.0 ) * ( 0.75 + 0.25 * uHero );
  float m1 = skinNoise3( mp ), m2 = skinNoise3( mp * 2.7 + 3.3 );
  gSpecBreak = mix( 1.0, 0.45 + 0.75 * m1 + 0.3 * ( m2 - 0.5 ), amt );
  roughnessFactor *= mix( 1.0, 0.88 + 0.26 * m2, amt );
}
#endif
#ifdef SKIN_REGION
// sebum on the T-zone: a little glossier; lips: moist (a sharp, broken-up sheen)
roughnessFactor *= mix( 1.0, 0.82, gOil );
roughnessFactor = mix( roughnessFactor, 0.2 + 0.18 * skinNoise3( vSkinBind * 1400.0 ), gLips * uLipWet );
#endif`,
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
diffuseColor.rgb *= 0.86 + 0.14 * gCavity;
{
  // screen-space curvature -> scattering width (thin/curved parts scatter more visibly)
  vec3 dn = fwidth( normalize( nonPerturbedNormal ) );
  vec3 dp = fwidth( vSkinWorldPos );
  float curv = length( dn ) / max( length( dp ), 1e-5 );
  gScatter = clamp( 0.3 + curv * uCurvScale, 0.3, 1.0 );
}
gSpecOcc = mix( 1.0, gSkinMask.r * gSkinMask.r, 0.85 ) * mix( 1.0, gCavity, 0.75 ) * gSpecBreak;`,
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
    m2.roughness = clamp( material.roughness * uLobe.y, 0.06, 1.0 );
    vec3 spec = mix( BRDF_GGX( L, geometryViewDir, geometryNormal, m1 ), BRDF_GGX( L, geometryViewDir, geometryNormal, m2 ), uLobe.z );
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
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
  #endif
}`,
        );
    };
  }
}

/** Per-vertex UV density (uv units per metre) so detail textures keep a constant world scale. */
export function uvDensityAttribute(g: THREE.BufferGeometry): THREE.BufferAttribute {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const idx = g.getIndex()!;
  const n = pos.count;
  const sum = new Float32Array(n);
  const cnt = new Float32Array(n);
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let t = 0; t < idx.count; t += 3) {
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
