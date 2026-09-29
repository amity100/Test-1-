import * as THREE from 'three';

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
 * Mask texture (baked by tools/human/bake_skin.py): R = ambient occlusion & cavity, G = roughness (0..1 ->
 * roughnessRange), B = thickness / translucency.  Normal map: RG = tangent-space normal (z rebuilt),
 * B = pore strength (no alpha channels: browsers may premultiply them).
 */

export interface SkinTextures {
  albedo?: THREE.Texture | null;
  normal?: THREE.Texture | null;
  mask?: THREE.Texture | null;
  detail?: THREE.Texture | null;
}

export interface SkinOptions {
  quality: 'low' | 'medium' | 'high';
  tint?: THREE.Color; // multiplies the albedo (used for per-instance skin-tone variation)
}

export class SkinMaterial extends THREE.MeshPhysicalMaterial {
  readonly skinUniforms = {
    uMaskMap: { value: null as THREE.Texture | null },
    uDetailNormal: { value: null as THREE.Texture | null },
    uDetailTile: { value: 45.0 }, // detail tile repetitions per metre of skin (tile ~2.2 cm, pores ~0.35 mm apart)
    uDetailStrength: { value: 0.7 },
    uRoughRange: { value: new THREE.Vector2(0.34, 0.86) },
    uAOIntensity: { value: 1.0 },
    uSssWrap: { value: new THREE.Vector3(0.5, 0.2, 0.14) },
    uSssNormalBlend: { value: new THREE.Vector3(0.85, 0.45, 0.25) },
    uCurvScale: { value: 0.035 },
    uLobe: { value: new THREE.Vector3(0.78, 1.45, 0.22) }, // lobe1 roughness scale, lobe2 roughness scale, lobe2 mix
    uTransColor: { value: new THREE.Color(1.0, 0.28, 0.12) },
    uTransScale: { value: 1.6 },
    uTransPower: { value: 3.0 },
    uTransDepth: { value: 0.022 },
    uTransAmbient: { value: 0.18 },
    uSkinTint: { value: new THREE.Color(1, 1, 1) },
    uWet: { value: 0.0 }, // sweat / wetness 0..1
    uDirt: { value: 0.0 },
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
      sheen: opts.quality === 'high' ? 0.1 : 0,
      sheenColor: new THREE.Color(0.9, 0.62, 0.48),
      sheenRoughness: 0.55,
    });
    this.name = 'HumanSkin';
    if (tex.normal) this.normalScale.set(1, 1);
    const u = this.skinUniforms;
    u.uMaskMap.value = tex.mask ?? null;
    u.uDetailNormal.value = tex.detail ?? null;
    if (opts.tint) u.uSkinTint.value.copy(opts.tint);
    const q = opts.quality;
    const defines: Record<string, string> = {};
    if (tex.mask) defines.SKIN_MASK = '';
    if (tex.detail && tex.normal) defines.SKIN_DETAIL = '';
    if (q !== 'low') defines.SKIN_TRANSMISSION = '';
    if (q === 'high') defines.SKIN_DUAL_LOBE = '';
    if (q === 'low') defines.SKIN_LOW = '';
    this.defines = { ...(this.defines ?? {}), ...defines };
    const key = `skin-${q}-${Object.keys(defines).join(',')}`;
    this.customProgramCacheKey = () => key;
    this.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, u);
      s.vertexShader = s.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float detailScale;
varying float vDetailScale;
varying vec3 vSkinWorldPos;`,
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
vSkinWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
vDetailScale = detailScale;`,
        );
      s.fragmentShader = s.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform sampler2D uMaskMap;
uniform sampler2D uDetailNormal;
uniform float uDetailTile, uDetailStrength, uAOIntensity, uCurvScale, uTransScale, uTransPower, uTransDepth, uTransAmbient, uWet, uDirt;
uniform vec2 uRoughRange;
uniform vec3 uSssWrap, uSssNormalBlend, uLobe, uTransColor, uSkinTint;
varying float vDetailScale;
varying vec3 vSkinWorldPos;
vec4 gSkinMask = vec4(1.0, 0.5, 0.0, 0.0);
vec3 gSmoothN = vec3(0.0, 0.0, 1.0);
vec3 gTransLight = vec3(0.0);
float gScatter = 0.5;
float gSpecOcc = 1.0;
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
diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.7, 0.6), uDirt * gSkinMask.r );`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `float roughnessFactor = mix( uRoughRange.x, uRoughRange.y, gSkinMask.g );
roughnessFactor = mix( roughnessFactor, 0.18, uWet );`,
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
    vec2 duv = vNormalMapUv * ( uDetailTile / max( vDetailScale, 0.05 ) );
    vec3 d1 = texture2D( uDetailNormal, duv ).xyz * 2.0 - 1.0;
    #ifndef SKIN_LOW
    vec3 d2 = texture2D( uDetailNormal, duv * 2.71 + vec2( 0.37, 0.61 ) ).xyz * 2.0 - 1.0;
    d1.xy += d2.xy * 0.45;
    #endif
    vec2 fw = fwidth( duv );
    float fade = clamp( 1.6 - max( fw.x, fw.y ) * 1.4, 0.0, 1.0 );
    mapN.xy += d1.xy * uDetailStrength * ( 0.15 + gPores ) * fade;
  }
  #endif
  normal = normalize( tbn * mapN );
#endif
gSmoothN = normalize( nonPerturbedNormal );
{
  // screen-space curvature -> scattering width (thin/curved parts scatter more visibly)
  vec3 dn = fwidth( gSmoothN );
  vec3 dp = fwidth( vSkinWorldPos );
  float curv = length( dn ) / max( length( dp ), 1e-5 );
  gScatter = clamp( 0.35 + curv * uCurvScale, 0.35, 1.0 );
}
gSpecOcc = mix( 1.0, gSkinMask.r * gSkinMask.r, 0.85 );`,
        )
        .replace(
          '#include <lights_physical_pars_fragment>',
          `#include <lights_physical_pars_fragment>
void RE_Direct_Skin( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  vec3 L = directLight.direction;
  float nlHi = dot( geometryNormal, L );
  float nlLo = dot( gSmoothN, L );
  vec3 nl = mix( vec3( nlHi ), vec3( nlLo ), uSssNormalBlend );
  #ifdef SKIN_LOW
  vec3 w = uSssWrap * 0.7;
  #else
  vec3 w = uSssWrap * gScatter;
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
          'getDirectionalLightInfo( directionalLight, directLight );',
          `getDirectionalLightInfo( directionalLight, directLight );
		gTransLight = directLight.color;`,
        )
        .replace(
          'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;',
          `#ifdef SKIN_TRANSMISSION
		gTransLight *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, directionalShadowMatrix[ i ] * vec4( vSkinWorldPos + ( vec4( directLight.direction, 0.0 ) * viewMatrix ).xyz * uTransDepth, 1.0 ) ) : 1.0;
		#endif
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;`,
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
