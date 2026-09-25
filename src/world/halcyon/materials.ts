import * as THREE from 'three';
import * as TX from '../textures';
import { ashlar, decals, dressed, foliage, lattice, leafy, slabs } from './textures';

export interface CityMaterials {
  materials: Record<string, THREE.Material>;
  /** Scrolling river normal map (null headless). */
  waterNormals: THREE.Texture | null;
}

/**
 * Halcyon's materials, one per merged bucket (so a chunk draws in about ten
 * calls). Static ones take vertex colours (tint + baked AO):
 *   stone    ashlar walls (rusticated bases use it at a larger scale)
 *   trim     dressed stone: cornices, columns, stairs, the pedestal
 *   paving   the slabs underfoot
 *   metal    wrought iron, gilt, brass and bronze (the colour says which)
 *   lattice  alpha-cut railings and balusters (one atlas)
 *   decal    banners, signs, the clock (one atlas)
 *   paint    enamel, awnings, copper roofs, ground inlays (a hair in front)
 *   windark  unlit window glass (reflects the blue sky)
 *   emissive lit windows, lanterns, strips (HDR vertex colours)
 *   glass    the station vault, domes (see-through)
 *   leaves   clipped hedges, far trees (an opaque leafy texture)
 *   foliage  alpha-cut leaf cards: tree crowns, ivy trails, flowers (one atlas; cards come in both windings)
 *   relief   = trim, for fine relief that casts no shadow (window surrounds)
 *   iron     = metal, for ironwork that does cast (railings, the vault's ribs)
 *   enamel   glossy coachwork (the trains): no depth offset, so their lit windows show in front of it
 *   statue   polished bronze and brass (the Spirit of Tomorrow, her ribbons, the armillary): sharp sun glints
 *   prop     the dynamic props (casks, trunks, the cargo pod), one each
 *   water    the river
 * Headless (node tests): plain materials, no canvas textures.
 */
export function createCityMaterials(envMap: THREE.Texture | null, mobile: boolean, headless: boolean): CityMaterials {
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ vertexColors: true, envMap, envMapIntensity: 0.6, ...p });
  const glass = () =>
    new THREE.MeshStandardMaterial({ color: 0xcfe3ee, transparent: true, opacity: 0.24, roughness: 0.05, metalness: 0.3, envMap, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
  const paint = (p: THREE.MeshStandardMaterialParameters = {}) => std({ roughness: 0.6, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...p });

  if (headless) {
    const plain = (p: THREE.MeshStandardMaterialParameters = {}) => std({ roughness: 0.8, ...p });
    const materials: Record<string, THREE.Material> = {
      stone: plain(),
      trim: plain(),
      paving: plain(),
      metal: plain({ metalness: 0.8, roughness: 0.4 }),
      statue: plain({ metalness: 0.95, roughness: 0.25 }),
      enamel: plain({ metalness: 0.3, roughness: 0.35 }),
      lattice: plain({ alphaTest: 0.5, side: THREE.DoubleSide }),
      decal: plain({ alphaTest: 0.5, side: THREE.DoubleSide }),
      paint: paint(),
      windark: plain({ metalness: 0.9, roughness: 0.08 }),
      emissive: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true }),
      glass: glass(),
      leaves: plain({ flatShading: true }),
      foliage: plain({ alphaTest: 0.45 }),
      prop: plain({ metalness: 0.35, roughness: 0.5 }),
      water: new THREE.MeshStandardMaterial({ color: 0x1e4a5e, roughness: 0.1, metalness: 0.1 }),
    };
    aliases(materials);
    return { materials, waterNormals: null };
  }

  const size = mobile ? 256 : 512;
  const stoneT = ashlar(size);
  const trimT = dressed(size);
  const paveT = slabs(size);
  const waterN = TX.waterNormals(mobile ? 128 : 256);
  waterN.repeat.set(1, 1);
  const materials: Record<string, THREE.Material> = {
    stone: std({ map: stoneT.map, roughnessMap: stoneT.roughnessMap, normalMap: stoneT.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1, metalness: 0 }),
    trim: std({ map: trimT.map, roughnessMap: trimT.roughnessMap, normalMap: trimT.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 1, metalness: 0 }),
    paving: std({ map: paveT.map, roughnessMap: paveT.roughnessMap, normalMap: paveT.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, metalness: 0, envMapIntensity: 0.4 }),
    metal: std({ roughness: 0.34, metalness: 0.85, envMapIntensity: 1.3 }),
    // (not fully metallic: a little diffuse keeps her shape in the sun instead of a black mirror of a pale sky)
    statue: std({ roughness: 0.3, metalness: 0.75, envMapIntensity: 1.8 }),
    enamel: std({ roughness: 0.32, metalness: 0.3, envMapIntensity: 0.9 }),
    // (alpha to coverage with the desktop's MSAA: railings and leaves get smooth edges instead of dithered ones)
    lattice: std({ map: lattice(mobile ? 256 : 512), alphaTest: 0.5, alphaToCoverage: !mobile, side: THREE.DoubleSide, roughness: 0.45, metalness: 0.55, envMapIntensity: 1.1 }),
    decal: std({ map: decals(mobile ? 512 : 1024), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.82, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    paint: paint(),
    windark: std({ roughness: 0.07, metalness: 0.9, envMapIntensity: 1.6 }),
    emissive: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true }),
    glass: glass(),
    leaves: std({ map: leafy(mobile ? 128 : 256), roughness: 0.85, metalness: 0, flatShading: true, envMapIntensity: 0.4 }),
    foliage: std({ map: foliage(mobile ? 256 : 512), alphaTest: 0.45, alphaToCoverage: !mobile, roughness: 0.8, metalness: 0, envMapIntensity: 0.45 }),
    prop: std({ roughness: 0.45, metalness: 0.35, envMapIntensity: 1.0 }),
    // (deep teal that keeps its colour at grazing angles; rougher ripples spread the sun into a glitter path)
    water: new THREE.MeshStandardMaterial({ color: 0x12384a, roughness: 0.12, metalness: 0.1, normalMap: waterN, normalScale: new THREE.Vector2(0.5, 0.5), envMap, envMapIntensity: 0.75 }),
  };
  // the river: two scales of the ripple map (hides tiling at grazing angles), like the harbour's sea
  const water = materials.water as THREE.MeshStandardMaterial;
  water.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      THREE.ShaderChunk.normal_fragment_maps.replace(
        'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
        'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz + texture2D( normalMap, mat2( 0.8, -0.6, 0.6, 0.8 ) * vNormalMapUv * 0.31 + vec2( 0.31, 0.57 ) ).xyz - 1.0;',
      ),
    );
  };
  water.customProgramCacheKey = () => 'halcyon-river-2scale';
  translucent(materials.foliage as THREE.MeshStandardMaterial, 0.22, 'halcyon-leaf-thru');
  translucent(materials.leaves as THREE.MeshStandardMaterial, 0.16, 'halcyon-leaves-thru');
  aliases(materials);
  if (mobile) {
    // cheaper shading on phones: no normal maps on the big merged surfaces
    for (const k of ['stone', 'trim', 'paving']) (materials[k] as THREE.MeshStandardMaterial).normalMap = null;
  }
  return { materials, waterNormals: waterN };
}

/**
 * Leaves glow when the sun is behind them (light through them, not off them):
 * seen against the low sun the red canopies light up as in the concept,
 * instead of going maroon-black on their shaded side.
 */
function translucent(m: THREE.MeshStandardMaterial, k: number, key: string) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      #if NUM_DIR_LIGHTS > 0
        float thru = saturate( dot( -normalize( vViewPosition ), directionalLights[ 0 ].direction ) );
        totalEmissiveRadiance += diffuseColor.rgb * directionalLights[ 0 ].color * ( thru * thru * ${k.toFixed(3)} );
      #endif`,
    );
  };
  m.customProgramCacheKey = () => key;
}

/** Same material, separate buckets: a bucket's shadow flag is per mesh. */
function aliases(m: Record<string, THREE.Material>) {
  m.relief = m.trim;
  m.iron = m.metal;
}
