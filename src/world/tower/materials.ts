import * as THREE from 'three';
import * as TX from '../textures';

export interface TowerMaterials {
  materials: Record<string, THREE.Material>;
  /** Scrolling water normal map (null headless). */
  waterNormals: THREE.Texture | null;
}

/**
 * PBR materials for the tower. Every static material uses vertex colours
 * (tint + baked AO). Headless (tests in node): plain coloured materials, no
 * canvas textures.
 */
export function createMaterials(envMap: THREE.Texture | null, mobile: boolean, headless: boolean): TowerMaterials {
  const size = mobile ? 256 : 512;
  const env = 0.85;
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ vertexColors: true, envMap, envMapIntensity: env, ...p });

  if (headless) {
    const plain = (color: number, p: THREE.MeshStandardMaterialParameters = {}) => std({ color, roughness: 0.8, ...p });
    const materials: Record<string, THREE.Material> = {
      concrete: plain(0xffffff),
      paving: plain(0xffffff),
      ground: plain(0xe8dccb),
      steel: plain(0xffffff, { metalness: 0.4, roughness: 0.5 }),
      metal: plain(0xffffff, { metalness: 0.8, roughness: 0.4 }),
      container: plain(0xffffff, { metalness: 0.4 }),
      wood: plain(0xe0c8a0),
      hazard: plain(0xf2b21c),
      facade: plain(0x5a7080, { metalness: 0.8, roughness: 0.1 }),
      glass: new THREE.MeshStandardMaterial({ color: 0xbfd8e8, transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide }),
      net: new THREE.MeshStandardMaterial({ color: 0xff6a14, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
      panel: plain(0xf2f2f2),
      paint: plain(0xffffff),
      emissive: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true }),
      water: new THREE.MeshStandardMaterial({ color: 0x1b4a5c, roughness: 0.1, metalness: 0.1 }),
    };
    return { materials, waterNormals: null };
  }

  const conc = TX.concrete(size, 3, [1.0, 0.98, 0.94]);
  const pav = TX.pavers(size);
  const ground = TX.siteGround(size);
  const steel = TX.paintedSteel(size);
  const corr = TX.corrugated(size);
  const ply = TX.plywood(size);
  const haz = TX.hazardStripes(mobile ? 128 : 256);
  const cw = TX.curtainWall(size);
  const lab = TX.labPanel(mobile ? 128 : 256);
  const net = TX.safetyNet(mobile ? 128 : 256);
  const waterN = TX.waterNormals(mobile ? 128 : 256);
  waterN.repeat.set(90, 90);

  const materials: Record<string, THREE.Material> = {
    concrete: std({ color: new THREE.Color(1.5, 1.47, 1.42), map: conc.map, roughnessMap: conc.roughnessMap, normalMap: conc.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 1, metalness: 0 }),
    paving: std({ map: pav.map, roughnessMap: pav.roughnessMap, normalMap: pav.normalMap, roughness: 1, metalness: 0 }),
    ground: std({ map: ground.map, roughnessMap: ground.roughnessMap, normalMap: ground.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 1, metalness: 0 }),
    steel: std({ map: steel.map, roughnessMap: steel.roughnessMap, metalnessMap: steel.roughnessMap, normalMap: steel.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 1, metalness: 1 }),
    metal: std({ map: steel.map, roughnessMap: steel.roughnessMap, normalMap: steel.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.75, metalness: 0.85 }),
    container: std({ map: corr.map, roughnessMap: corr.roughnessMap, normalMap: corr.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 1, metalness: 0.45 }),
    wood: std({ map: ply.map, roughnessMap: ply.roughnessMap, normalMap: ply.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, metalness: 0 }),
    hazard: std({ map: haz.map, roughnessMap: haz.roughnessMap, normalMap: haz.normalMap, roughness: 1, metalness: 0.1 }),
    facade: std({ map: cw.map, roughnessMap: cw.roughnessMap, metalnessMap: cw.roughnessMap, normalMap: cw.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 1, metalness: 1, envMapIntensity: 1.25 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe6f2, transparent: true, opacity: 0.22, roughness: 0.04, metalness: 0.3, envMap, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide }),
    net: new THREE.MeshStandardMaterial({ map: net, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9, metalness: 0, envMap, envMapIntensity: 0.5 }),
    panel: std({ map: lab.map, roughnessMap: lab.roughnessMap, normalMap: lab.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 1, metalness: 0.05 }),
    paint: std({ roughness: 0.7, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    emissive: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true }),
    water: new THREE.MeshStandardMaterial({ color: 0x1a4a5e, roughness: 0.13, metalness: 0.1, normalMap: waterN, normalScale: new THREE.Vector2(0.45, 0.45), envMap, envMapIntensity: 0.9 }),
  };
  // sea: blend two scales of the ripple map (hides tiling at grazing angles)
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
  water.customProgramCacheKey = () => 'tower-sea-2scale';
  if (mobile) {
    // cheaper shading on phones: drop the normal maps on big merged surfaces
    for (const k of ['concrete', 'paving', 'ground', 'wood', 'panel', 'hazard']) {
      const m = materials[k] as THREE.MeshStandardMaterial;
      m.normalMap = null;
    }
  }
  return { materials, waterNormals: waterN };
}
