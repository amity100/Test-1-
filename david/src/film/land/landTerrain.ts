import * as THREE from 'three';
import { GLSL_NOISE, shared } from '../../core/Shared';
import type { TextureSet } from '../../world/Textures';
import { GEO, type HeightTile, type LandHeight } from './landData';
import { cloudShared, GLSL_LAND_HAZE, landAtmo } from './landAtmo';

export type LandTier = 'low' | 'medium' | 'high';

/**
 * Polar ("foveated") terrain mesh around a focus: square cells whose size grows with the distance, from `r0` at
 * the focus to `rMax` (km-scale far land). Heights come from the real DEM (LandHeight); the Earth's curvature
 * drop d^2 / 2R (relative to the focus) is baked into y, so the far Moab ridge and the sea horizon sit right.
 */
export function polarTerrain(H: LandHeight, cx: number, cz: number, o: { nTheta: number; r0: number; rMax: number; underwater?: (x: number, z: number) => number | null }): THREE.BufferGeometry {
  const nT = o.nTheta;
  const k = (2 * Math.PI) / nT;
  const radii: number[] = [0];
  let r = o.r0;
  while (r < o.rMax) { radii.push(r); r *= 1 + k; }
  radii.push(o.rMax);
  const nR = radii.length;
  const pos = new Float32Array((1 + (nR - 1) * nT) * 3);
  const R2 = 2 * GEO.R;
  const put = (idx: number, x: number, z: number) => {
    let y = H.height(x, z);
    if (o.underwater) { const w = o.underwater(x, z); if (w !== null && y > w - 60 && y < w + 0.5) y = Math.min(y, w - 60); }
    const d2 = (x - cx) * (x - cx) + (z - cz) * (z - cz);
    pos[idx * 3] = x; pos[idx * 3 + 1] = y - d2 / R2; pos[idx * 3 + 2] = z;
  };
  put(0, cx, cz);
  for (let i = 1; i < nR; i++) {
    const rr = radii[i];
    const off = (i & 1) * 0.5; // stagger alternate rings: better triangles
    for (let j = 0; j < nT; j++) {
      const a = (j + off) * k;
      put(1 + (i - 1) * nT + j, cx + Math.cos(a) * rr, cz + Math.sin(a) * rr);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nT; j++) idx.push(0, 1 + ((j + 1) % nT), 1 + j);
  for (let i = 1; i < nR - 1; i++) {
    const a0 = 1 + (i - 1) * nT, a1 = 1 + i * nT;
    for (let j = 0; j < nT; j++) {
      const j1 = (j + 1) % nT;
      if (i & 1) { idx.push(a0 + j, a1 + j1, a1 + j, a0 + j, a0 + j1, a1 + j1); }
      else { idx.push(a0 + j, a0 + j1, a1 + j, a0 + j1, a1 + j1, a1 + j); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const nrm = new Float32Array(pos.length);
  for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, 0, cz), o.rMax * 1.5);
  return g;
}

/**
 * Exact height of the RENDERED polar terrain mesh at (x, z) (the same triangles, including the Earth's curvature
 * drop baked into y): objects set on the land with it never float or sink, whatever the mesh resolution.
 * Pass the same options as polarTerrain(). Outside the mesh it returns the last ring's value.
 */
export function polarSampler(geo: THREE.BufferGeometry, cx: number, cz: number, o: { nTheta: number; r0: number; rMax: number }): (x: number, z: number) => number {
  const nT = o.nTheta;
  const k = (2 * Math.PI) / nT;
  const radii: number[] = [0];
  let r = o.r0;
  while (r < o.rMax) { radii.push(r); r *= 1 + k; }
  radii.push(o.rMax);
  const nR = radii.length;
  const P = (geo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
  const lnK = Math.log(1 + k);
  const tri = (x: number, z: number, a: number, b: number, c: number): number | null => {
    const ax = P[a * 3], az = P[a * 3 + 2], bx = P[b * 3], bz = P[b * 3 + 2], qx = P[c * 3], qz = P[c * 3 + 2];
    const d = (bz - qz) * (ax - qx) + (qx - bx) * (az - qz);
    if (Math.abs(d) < 1e-9) return null;
    const l1 = ((bz - qz) * (x - qx) + (qx - bx) * (z - qz)) / d;
    const l2 = ((qz - az) * (x - qx) + (ax - qx) * (z - qz)) / d;
    const l3 = 1 - l1 - l2;
    if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) return null;
    return l1 * P[a * 3 + 1] + l2 * P[b * 3 + 1] + l3 * P[c * 3 + 1];
  };
  return (x: number, z: number) => {
    const dx = x - cx, dz = z - cz;
    const rr = Math.hypot(dx, dz);
    let ang = Math.atan2(dz, dx); if (ang < 0) ang += 2 * Math.PI;
    if (rr >= o.rMax) { const j = Math.round(ang / k) % nT; return P[(1 + (nR - 2) * nT + j) * 3 + 1]; }
    // ring band i: radii[i] <= r < radii[i+1]
    let i = rr < o.r0 ? 0 : Math.min(nR - 2, 1 + Math.floor(Math.log(rr / o.r0) / lnK));
    while (i > 0 && radii[i] > rr) i--;
    while (i < nR - 2 && radii[i + 1] <= rr) i++;
    const jc = Math.floor(ang / k);
    if (i === 0) {
      for (let dj = -1; dj <= 1; dj++) { const j = (((jc + dj) % nT) + nT) % nT; const h = tri(x, z, 0, 1 + ((j + 1) % nT), 1 + j); if (h !== null) return h; }
      return P[1];
    }
    const a0 = 1 + (i - 1) * nT, a1 = 1 + i * nT;
    for (let dj = -2; dj <= 2; dj++) {
      const j = (((jc + dj) % nT) + nT) % nT, j1 = (j + 1) % nT;
      let h: number | null;
      if (i & 1) { h = tri(x, z, a0 + j, a1 + j1, a1 + j); if (h === null) h = tri(x, z, a0 + j, a0 + j1, a1 + j1); }
      else { h = tri(x, z, a0 + j, a0 + j1, a1 + j); if (h === null) h = tri(x, z, a0 + j1, a1 + j1, a1 + j); }
      if (h !== null) return h;
    }
    return P[(a0 + (jc % nT)) * 3 + 1];
  };
}

/** Analytic wobble of the terrace contours (identical in GLSL: keep in sync with GLSL_TERRACE in landMaterial). */
export const terraceWobble = (x: number, z: number) => 0.35 * Math.sin(x * 0.013 + z * 0.007) + 0.25 * Math.sin(z * 0.017 - x * 0.004 + 1.3);
/** vertical spacing of the Judean terraces (m) */
export const TERRACE_STEP = 3.2;

export interface TerrainTex {
  regTile: HeightTile; regShade: THREE.Texture; regLC: THREE.Texture;
  locTile: HeightTile | null; locShade: THREE.Texture | null; locLC: THREE.Texture | null;
}

export interface TerrainLook {
  /** 0 = no valley mist; 1 = full dawn mist in the valleys */
  mist: number;
  /** mist colour (linear, before sunlight) */
  mistColor: THREE.Color;
  /** absolute height (m) under which valleys fill with mist (relative mist uses valley depth) */
  mistTop: number;
  /** extra GLSL: float cloudShadow(vec3 worldPos) — 1 = lit */
  cloudShadowGlsl?: string;
  /** use the world textures for near-ground detail (ground-level sets) */
  near?: TextureSet | null;
  /** world-space road / path polylines are painted by `roadGlsl` (float roadMask(vec2 xz)) */
  roadGlsl?: string;
  /** apply the in-shader km-scale haze (landAtmo) */
  haze?: boolean;
  /** dry-stone terraces of the Judean hills drawn per pixel (stepped normals, wall faces, fields; anti-aliased) */
  terraces?: boolean;
  /**
   * valley fog of the dawn inversion (visual-bible 3.11 "mist/fog lying in the valleys"): fills every valley below the
   * smoothed surface (baked valley depth) with a lit fog layer, integrated along the view ray, so each ridge's foot
   * dissolves into mist and its crest stays sharp (layered ridgelines). Replaces the old `mist` term when given.
   *  offset: fog top, metres below the smoothed surface; jitter: its variation; density: 1/m along the ray;
   *  xMax: no fog east of this x (the rift floor, Moab); near: fade-in distance (m).
   */
  valleyFog?: { offset: number; jitter: number; density: number; xMax: number; near: number };
  /** Judah's near hills (with `terraces`): limestone ledges (nari), garrigue cushions, ochre soil; no micro-relief peel */
  nearHills?: boolean;
  /** a hilltop village: beaten earth in the plaza (x, z, r) and dry, pale, stony ground round the village (cx, cz, rIn, rOut) */
  village?: { plaza: THREE.Vector3; center: THREE.Vector2; rIn: number; rOut: number };
  /** (cut7) sample the local land-cover softened (mip bias): the satellite-derived cover of the coastal plain carries
   *  the outlines of MODERN fields — seen from a crane they read as a grid; softened they become a natural mottling */
  lcSoft?: number;
}

export const terrainUniforms = () => ({
  uMist: { value: 0 },
  uMistTop: { value: 0 },
  uMistColor: { value: new THREE.Color(1, 1, 1) },
  uTime: shared.uTime,
});

function tileBox(t: HeightTile | null) {
  if (!t) return new THREE.Vector4(1e9, 1e9, 1, 1);
  return new THREE.Vector4(t.x0 - t.dx * 0.5, t.z0 - t.dz * 0.5, 1 / (t.dx * t.w), 1 / (t.dz * t.h));
}

/** The land material: real-DEM normals + sun visibility, landcover-driven palette of Judah, near texture detail. */
export function landMaterial(tt: TerrainTex, look: TerrainLook, tier: LandTier): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  const u = {
    tRegShade: { value: tt.regShade }, tRegLC: { value: tt.regLC }, uRegBox: { value: tileBox(tt.regTile) },
    tLocShade: { value: tt.locShade ?? tt.regShade }, tLocLC: { value: tt.locLC ?? tt.regLC }, uLocBox: { value: tileBox(tt.locTile) },
    uLocEdge: { value: tt.locTile ? new THREE.Vector4(tt.locTile.x0, tt.locTile.z0, tt.locTile.x1, tt.locTile.z1) : new THREE.Vector4(1e9, 1e9, 1e9, 1e9) },
    tSoil: { value: look.near?.soil ?? null }, tGrass: { value: look.near?.grass ?? null }, tRock: { value: look.near?.rock ?? null },
    tRockN: { value: look.near?.rockN ?? null }, tGrassN: { value: look.near?.grassN ?? null },
    ...terrainUniforms(),
    uPlaza: { value: look.village ? look.village.plaza.clone() : new THREE.Vector3(1e9, 1e9, 1) },
    uVillage: { value: look.village ? new THREE.Vector4(look.village.center.x, look.village.center.y, look.village.rIn, look.village.rOut) : new THREE.Vector4(1e9, 1e9, 1, 2) },
    uVFog: { value: look.valleyFog ? new THREE.Vector4(look.valleyFog.offset, look.valleyFog.jitter, look.valleyFog.density, look.valleyFog.xMax) : new THREE.Vector4(0, 0, 0, 0) },
    uVFogNear: { value: look.valleyFog?.near ?? 400 },
    ...landAtmo, ...cloudShared,
  };
  u.uMist.value = look.mist;
  u.uMistTop.value = look.mistTop;
  u.uMistColor.value.copy(look.mistColor);
  const defines: Record<string, string> = {};
  if (look.near) defines.LAND_NEAR = '1';
  if (look.lcSoft) defines.LAND_LCSOFT = look.lcSoft.toFixed(2);
  if (look.cloudShadowGlsl) defines.LAND_CLOUDSHADOW = '1';
  if (look.roadGlsl) defines.LAND_ROAD = '1';
  if (tier !== 'low') defines.LAND_HQ = '1';
  if (look.haze) defines.LAND_HAZE = '1';
  if (look.terraces) defines.LAND_TERRACE = '1';
  if (look.village) defines.LAND_VILLAGE = '1';
  if (look.valleyFog) defines.LAND_VFOG = '1';
  if (look.nearHills) defines.LAND_JNEAR = '1';
  mat.userData.landUniforms = u;
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    Object.assign(s.defines ??= {}, defines);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLandW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvLandW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        varying vec3 vLandW;
        uniform sampler2D tRegShade, tRegLC, tLocShade, tLocLC;
        uniform vec4 uRegBox, uLocBox, uLocEdge;
        uniform float uMist, uMistTop, uTime;
        uniform vec3 uPlaza; uniform vec4 uVillage;
        uniform vec4 uVFog; uniform float uVFogNear;
        uniform vec3 uMistColor;
        #ifdef LAND_NEAR
        uniform sampler2D tSoil, tGrass, tRock, tRockN, tGrassN;
        #endif
        ${GLSL_NOISE}
        ${GLSL_LAND_HAZE}
        ${look.cloudShadowGlsl ?? ''}
        ${look.roadGlsl ?? ''}
        vec3 srgb(vec3 c){ return pow(c, vec3(2.2)); }
        float landSunVis; vec3 landN; float landDist;
      `)
      .replace('#include <map_fragment>', /* glsl */ `
        vec2 xz = vLandW.xz;
        landDist = length(vLandW - cameraPosition);
        vec2 uvR = (xz - uRegBox.xy) * uRegBox.zw;
        vec4 shR = texture2D(tRegShade, uvR);
        vec4 lcR = texture2D(tRegLC, uvR);
        vec2 uvL = (xz - uLocBox.xy) * uLocBox.zw;
        float edge = min(min(xz.x - uLocEdge.x, uLocEdge.z - xz.x), min(xz.y - uLocEdge.y, uLocEdge.w - xz.y));
        float wl = smoothstep(0.0, 1200.0, edge);
        vec4 sh = shR, lc = lcR;
        #ifdef LAND_LCSOFT
        if (wl > 0.0) { sh = mix(shR, texture2D(tLocShade, uvL), wl); lc = mix(lcR, texture2D(tLocLC, uvL, LAND_LCSOFT), wl); }
        #else
        if (wl > 0.0) { sh = mix(shR, texture2D(tLocShade, uvL), wl); lc = mix(lcR, texture2D(tLocLC, uvL), wl); }
        #endif
        vec2 nxz = sh.xy * 2.0 - 1.0;
        vec3 nW = normalize(vec3(nxz.x, sqrt(max(1.0 - dot(nxz, nxz), 0.04)), nxz.y));
        vec3 landN0 = nW;
        float arid = lc.r, drain = lc.g, water = lc.b, vdep = lc.a;
        float conv = sh.a;
        float slope = 1.0 - nW.y;
        float hgt = vLandW.y;
        // ---- macro palette (sRGB, from photographs of the Judean hills / desert / rift at low sun) ----
        float n1 = dFbm(xz * 0.0021), n2 = dFbm(xz * 0.013 + 7.0), n3 = dNoise(xz * 0.06);
        vec3 terra = mix(vec3(0.46, 0.30, 0.21), vec3(0.54, 0.41, 0.31), n2);          // terra rossa / hamra
        #ifdef LAND_JNEAR
        // Judah at dawn (orchestrator p4 / visual-bible 3.11): ochre-brown soil between grey limestone, not orange
        terra = mix(vec3(0.43, 0.345, 0.27), vec3(0.52, 0.43, 0.34), n2);
        #endif
        vec3 lime = mix(vec3(0.64, 0.62, 0.58), vec3(0.74, 0.72, 0.67), n1);           // grey Cenomanian limestone
        vec3 maquis = mix(vec3(0.17, 0.20, 0.13), vec3(0.25, 0.27, 0.17), n2);         // maquis, oak, olive
        vec3 chalk = mix(vec3(0.80, 0.72, 0.56), vec3(0.86, 0.79, 0.64), n1);          // Senonian chalk of the desert
        vec3 desertRock = mix(vec3(0.62, 0.50, 0.36), vec3(0.70, 0.58, 0.42), n2);     // hard limestone cliffs
        vec3 marl = vec3(0.74, 0.69, 0.60);                                            // Lisan marl of the rift floor
        vec3 sand = vec3(0.86, 0.77, 0.58);                                            // coastal dunes
        vec3 field = mix(vec3(0.58, 0.47, 0.31), vec3(0.66, 0.56, 0.36), n3);          // stubble / fallow fields
        vec3 moab = mix(vec3(0.46, 0.33, 0.26), vec3(0.56, 0.43, 0.33), n1);           // Moab: red sandstone + plateau
        vec3 thicket = vec3(0.14, 0.19, 0.09);                                         // Jordan thicket / oasis
        // humid hills: soil with maquis patches and rock outcrops on steep / convex ground
        float north = clamp(-nW.z * 2.5, -1.0, 1.0);
        float n4 = dFbm(xz * 0.0045 + 3.0);
        float veg = smoothstep(0.3, 0.72, n2 * 0.5 + n4 * 0.7 + (0.45 - arid) * 0.9 + drain * 0.35 + north * 0.18 - slope * 0.4);
        vec3 hills = mix(terra, maquis, veg * 0.75);
        hills = mix(hills, lime, clamp(smoothstep(0.1, 0.35, slope) * 0.6 + (conv - 0.5) * 1.4 + (n1 - 0.5) * 0.5 + 0.12, 0.0, 0.8));
        // terraces on the humid slopes: fine contour banding (walls in shadow, soil strips) seen from a height
        float terr = (1.0 - smoothstep(0.35, 0.6, arid)) * smoothstep(0.04, 0.12, slope) * (1.0 - smoothstep(0.35, 0.5, slope)) * smoothstep(300.0, 500.0, hgt);
        #ifdef LAND_TERRACE
        float terrN = 0.0; vec3 terrNrm = nW;
        {
          // dry-stone terraces along the contours of the rendered surface (the geometric walls of landJudah.ts
          // sit exactly on the same lines): a narrow wall face, the level tread above it, a dark foot line;
          // every terrace segment is its own little field. Fades to the mean tone where the steps are sub-pixel.
          float tw = 0.35 * sin(xz.x * 0.013 + xz.y * 0.007) + 0.25 * sin(xz.y * 0.017 - xz.x * 0.004 + 1.3);
          float ph = hgt / 3.2 + tw;
          float fw = max(fwidth(ph), 1e-4);
          float aa = 1.0 - smoothstep(0.28, 0.65, fw);
          float f = fract(ph);
          float wallW = 0.13;
          float riser = clamp((wallW - f) / fw + 0.5, 0.0, 1.0) * clamp(f / fw + 0.5, 0.0, 1.0);
          float foot = smoothstep(0.78, 1.0, f);
          float seg = dHash12(vec2(floor(ph), floor(dot(xz, vec2(0.0105, 0.0071)) + dNoise(xz * 0.004) * 2.0)));
          vec3 tread = seg < 0.3 ? vec3(0.50, 0.34, 0.23) : seg < 0.55 ? vec3(0.63, 0.53, 0.37) : seg < 0.8 ? vec3(0.44, 0.40, 0.29) : vec3(0.55, 0.45, 0.33);
          vec3 wallC = mix(vec3(0.63, 0.60, 0.54), vec3(0.72, 0.69, 0.62), n2);
          #ifdef LAND_JNEAR
          // greyer, browner plots (fallow, stubble, olive rows), and walls that read as a step, not a contour line
          tread = seg < 0.3 ? vec3(0.42, 0.35, 0.27) : seg < 0.55 ? vec3(0.50, 0.44, 0.35) : seg < 0.8 ? vec3(0.36, 0.36, 0.27) : vec3(0.46, 0.40, 0.32);
          wallC = tread * 0.9;
          #endif
          tread *= 0.9 + 0.2 * n3;
          vec3 tc = mix(tread * (1.0 - 0.28 * foot), wallC, riser);
          // far field: the mean of the pattern (fields + walls), slightly lighter than the bare hills
          vec3 tcAvg = mix(vec3(0.53, 0.43, 0.31), wallC, wallW) * 0.97;
          float tk = terr * 0.95 * smoothstep(0.36, 0.5, dFbm(xz * 0.0011 + 9.0) + dNoise(xz * 0.004) * 0.15);
          hills = mix(hills, mix(tcAvg, tc, aa), tk);
          vec2 dn = normalize(nW.xz + vec2(1e-5));
          vec3 riserN = normalize(vec3(dn.x, 0.45, dn.y));
          vec3 treadN = normalize(vec3(nW.x * 0.25, 1.0, nW.z * 0.25));
          #ifdef LAND_JNEAR
          riser *= 0.6;
          #endif
          terrNrm = normalize(mix(nW, mix(treadN, riserN, riser), tk * aa));
          terrN = tk;
        }
        #else
        float band = smoothstep(0.55, 0.95, fract(hgt / 3.2 + n3 * 0.3));
        hills *= 1.0 - terr * band * 0.28 * (1.0 - smoothstep(1500.0, 6000.0, landDist));
        float terrN = 0.0; vec3 terrNrm = nW;
        #endif
        // olive groves and villages' orchards: dark dotted patches on the gentle slopes around the towns
        float grove = smoothstep(0.62, 0.75, n4) * terr;
        #ifdef LAND_TERRACE
        grove *= smoothstep(2600.0, 4200.0, landDist); // nearer, the instanced olive trees of landJudah.ts
        #endif
        hills = mix(hills, hills * vec3(0.55, 0.6, 0.45), grove * dCellDots(xz * 0.11, 0.3));
        // the Shephelah and plain: fields; dunes along the shore
        float plain = smoothstep(420.0, 140.0, hgt) * step(xz.x, -12000.0);
        {
          // field parcels of the plain (irregular strips 30-110 m, rotated grid): stubble gold, ploughed brown,
          // fallow grass, a few green plots; darker balks / hedges of scrub between them; threshing-bare patches
          vec2 fp = mat2(0.93, 0.36, -0.36, 0.93) * xz;
          fp += vec2(dNoise(xz * 0.0021), dNoise(xz * 0.0019 + 4.0)) * 60.0; // balks wander: no grid
          // irregular parcels: each strip of land (column) has its own width and field length (no checkerboard)
          float colW = 95.0;
          float colI = floor(fp.x / colW);
          float lenK = 38.0 + 90.0 * dHash12(vec2(colI, 3.3));
          vec2 fs = vec2(colW, lenK);
          vec2 fc = vec2(colI, floor(fp.y / lenK + dHash12(vec2(colI, 8.1))));
          vec2 ff = vec2(fract(fp.x / colW), fract(fp.y / lenK + dHash12(vec2(colI, 8.1))));
          float fr = dHash12(fc + 3.1), fr2 = dHash12(fc + 17.7);
          vec3 stub = mix(vec3(0.74, 0.62, 0.40), vec3(0.80, 0.69, 0.46), fr2);
          vec3 plough = mix(vec3(0.44, 0.32, 0.22), vec3(0.52, 0.38, 0.26), fr2);
          vec3 fallow = mix(vec3(0.60, 0.55, 0.38), vec3(0.54, 0.52, 0.34), fr2);
          vec3 greenP = vec3(0.40, 0.43, 0.25);
          vec3 fcol = fr < 0.42 ? stub : fr < 0.7 ? plough : fr < 0.93 ? fallow : greenP;
          fcol = mix(fcol, vec3(0.62, 0.52, 0.35), 0.5 + 0.3 * (1.0 - smoothstep(150.0, 900.0, landDist)));
          // furrows / stubble rows along the parcel
          // furrows: each parcel ploughed in its own direction (along or across the strip), no far moire
          float fa = (fr2 - 0.5) * 0.5 + (fr > 0.55 ? 1.5708 : 0.0);
          vec2 fdir = vec2(cos(fa), sin(fa));
          fcol *= 1.0 + 0.07 * sin(dot(fp, fdir) * 2.4 + fr * 20.0) * (1.0 - smoothstep(40.0, 160.0, landDist));
          float balk = 1.0 - smoothstep(0.0, 0.035, min(min(ff.x, 1.0 - ff.x) * fs.x / 46.0, min(ff.y, 1.0 - ff.y)));
          fcol = mix(fcol, vec3(0.36, 0.34, 0.22), balk * 0.55 * (1.0 - smoothstep(2500.0, 9000.0, landDist)));
          fcol = mix(fcol, field, smoothstep(6000.0, 20000.0, landDist) * 0.5);
          hills = mix(hills, mix(fcol, chalk, 0.12 * n1), plain * 0.88);
        }
        // the dune belt along the shore (the real coastline trends NNE: x_shore ≈ -56760 - 0.5 (z + 5470) near
        // Ashdod): pale sand with dune ridges transverse to the west wind, kurkar and scrub farther inland
        float dShore = xz.x - (-56760.0 - (xz.y + 5470.0) * 0.5);
        float sandW = smoothstep(4600.0, 2000.0, dShore) * smoothstep(90.0, 8.0, hgt) * step(xz.x, -30000.0);
        {
          float ph = dot(xz, vec2(0.95, 0.31)) * 0.034 + dFbm(xz * 0.0035) * 7.0;
          // soft, irregular dune swells (no washboard): the phase wanders and the relief is gentle
          vec3 sandC = sand * (0.95 + 0.06 * sin(ph)) * mix(0.94, 1.06, n3);
          hills = mix(hills, sandC, sandW);
          nW = normalize(nW + vec3(-0.95, 0.0, -0.31) * cos(ph) * 0.1 * sandW * (0.4 + 0.6 * n2));
        }
        // desert: chalk and marl, hard limestone on the cliffs, darker wadi beds
        vec3 desert = mix(chalk, desertRock, smoothstep(0.12, 0.4, slope));
        desert = mix(desert, marl, smoothstep(-150.0, -330.0, hgt) * (1.0 - smoothstep(0.25, 0.5, slope)));
        desert = mix(desert, desert * vec3(0.78, 0.74, 0.68), smoothstep(0.35, 0.7, drain));
        // Moab (east of the rift): red-brown escarpment, ochre plateau
        float east = smoothstep(33000.0, 40000.0, xz.x);
        desert = mix(desert, moab, east * 0.85);
        vec3 alb = mix(hills, desert, smoothstep(0.35, 0.8, arid));
        // green lines: the Jordan thicket, springs (Jericho, En-gedi) and wadi beds in the rift
        float green = smoothstep(0.55, 0.9, drain) * smoothstep(-150.0, -320.0, hgt) * (1.0 - water);
        alb = mix(alb, thicket, green * 0.8);
        // far-field speckle of bushes / boulders (reads as texture from a height)
        float dots = dCellDots(xz * 0.045, 0.22) * (1.0 - arid * 0.7);
        alb *= 1.0 - dots * 0.25 * (1.0 - smoothstep(4000.0, 12000.0, landDist)) * smoothstep(400.0, 1200.0, landDist);
        alb *= 0.82 + 0.36 * n3 * (1.0 - smoothstep(3000.0, 9000.0, landDist)) + 0.1 * (1.0 - n1);
        #ifdef LAND_JNEAR
        {
          // Judah's near ridge (80 m - 3 km): the detail that proves the place (visual-bible 3.11, orchestrator p4):
          // grey-white limestone ledges (nari crust / bedding steps) breaking the ochre soil along the contours,
          // broken and irregular, a dark undercut below each; dark-green garrigue cushions (thorny burnet, sage).
          float nearW = 1.0 - smoothstep(1500.0, 3400.0, landDist);
          float lp = hgt / 2.7 + (dNoise(xz * 0.019) - 0.5) * 1.6 + (dNoise(xz * 0.07) - 0.5) * 0.35;
          float lf = fract(lp);
          float lfw = max(fwidth(lp), 1e-4);
          float laa = 1.0 - smoothstep(0.22, 0.55, lfw);
          float sinSl = length(landN0.xz); // sin of the slope angle (the 'slope' above is 1 - cos: tiny on hills)
          float ledgeOn = smoothstep(0.40, 0.58, dFbm(xz * 0.011 + vec2(floor(lp) * 3.7, floor(lp) * 1.3)))
                        * smoothstep(0.42, 0.6, dNoise(xz * 0.045 + vec2(floor(lp) * 5.3, floor(lp) * 2.9))) // short broken runs
                        * smoothstep(0.07, 0.2, sinSl) * (1.0 - terrN * 0.8) * (1.0 - smoothstep(0.7, 0.95, arid) * 0.5);
          // mottled hillside: bare grey limestone pavements, ochre soil pockets (20-80 m patches)
          float rp = smoothstep(0.42, 0.62, dFbm(xz * 0.017 + 11.0) + (sinSl - 0.15) * 0.8 + (conv - 0.5) * 0.6);
          alb = mix(alb, mix(vec3(0.60, 0.58, 0.54), vec3(0.70, 0.68, 0.63), n3), rp * 0.7 * nearW * (1.0 - terrN * 0.7));
          float fw0 = 0.16 + 0.2 * dNoise(xz * 0.08 + floor(lp));
          float face = clamp((fw0 - lf) / lfw + 0.5, 0.0, 1.0) * clamp(lf / lfw + 0.5, 0.0, 1.0);
          float under = clamp((lf - fw0) / lfw + 0.5, 0.0, 1.0) * clamp((fw0 + 0.09 - lf) / lfw + 0.5, 0.0, 1.0);
          vec3 rockC = mix(vec3(0.74, 0.73, 0.69), vec3(0.86, 0.85, 0.80), dNoise(xz * 0.37)) * (0.9 + 0.2 * n3);
          float lk = ledgeOn * nearW;
          alb = mix(alb, rockC, face * lk * laa * 0.92);
          alb *= 1.0 - under * lk * laa * 0.68;
          alb = mix(alb, mix(alb, rockC, 0.3), lk * (1.0 - laa));
          // the rock face stands steeper, facing down-slope; the soil step above it is flatter
          vec2 dn = normalize(nW.xz + vec2(1e-5));
          nW = normalize(mix(nW, normalize(vec3(dn.x, 0.55, dn.y)), face * lk * laa * 0.7));
          // garrigue cushions (0.3-0.8 m) and scattered small boulders
          vec2 gp = xz * 0.33;
          float gfw = fwidth(gp.x);
          float gaa = 1.0 - smoothstep(0.35, 0.9, gfw);
          float gmask = smoothstep(0.30, 0.62, dFbm(xz * 0.021 + 5.0) + (0.4 - arid) * 0.5) * (1.0 - face * lk) * nearW;
          float gd = dCellDots(gp, 0.3) * gmask;
          vec3 gC = mix(vec3(0.16, 0.19, 0.12), vec3(0.24, 0.27, 0.16), dNoise(xz * 1.3));
          alb = mix(alb, gC, gd * gaa * 0.95);
          alb = mix(alb, alb * vec3(0.78, 0.82, 0.74), gmask * 0.35 * (1.0 - gaa));
                  }
        #endif
        #ifdef LAND_HQ
        {
          // micro-relief below the DEM resolution (boulders, terrace risers, gullies): fbm gradient
          float fs = mix(0.035, 0.012, smoothstep(300.0, 4000.0, landDist));
          vec2 e = vec2(4.0, 0.0);
          float c0 = dFbm(xz * fs), cx = dFbm((xz + e.xy) * fs), cz = dFbm((xz + e.yx) * fs);
          vec2 gr = vec2(cx - c0, cz - c0) * 5.5 * (1.0 - smoothstep(2500.0, 14000.0, landDist));
          #ifdef LAND_NEAR
          gr *= 0.18;
          #endif
          gr *= 1.0 - 0.7 * terrN;
          #ifdef LAND_JNEAR
          gr *= smoothstep(900.0, 3500.0, landDist); // no 'orange peel' at the near ridge: the ledges carry the detail
          #endif
          nW = normalize(nW + vec3(-gr.x, 0.0, -gr.y));
        }
        #endif
        #ifdef LAND_TERRACE
        nW = normalize(nW + (terrNrm - landN0) * (1.0 - smoothstep(0.35, 0.8, arid)));
        #endif
        float villW = 0.0, plazaW = 0.0;
        #ifdef LAND_VILLAGE
        {
          // the hilltop round the village: trampled, stony, pale dry ground (no dark scrub); the plaza before the gate
          // is beaten earth with a ragged edge that frays into the stony ground (no paved disc)
          float wob = (dNoise(xz * 0.021) - 0.5) * 18.0 + (dNoise(xz * 0.09) - 0.5) * 7.0;
          villW = 1.0 - smoothstep(uVillage.z, uVillage.w, length(xz - uVillage.xy) + wob);
          vec3 dry = mix(vec3(0.64, 0.60, 0.52), vec3(0.58, 0.55, 0.48), n2) * (0.9 + 0.2 * n3);
          dry = mix(dry, vec3(0.78, 0.74, 0.66), smoothstep(0.62, 0.8, dNoise(xz * 0.35)) * 0.6); // limestone rubble
          alb = mix(alb, dry, villW * 0.9);
          float pd = length(xz - uPlaza.xy) + (dNoise(xz * 0.13) - 0.5) * 6.0 + (dNoise(xz * 0.5) - 0.5) * 1.6;
          plazaW = 1.0 - smoothstep(uPlaza.z * 0.7, uPlaza.z * 1.15, pd);
          vec3 earth = mix(vec3(0.55, 0.52, 0.47), vec3(0.62, 0.59, 0.53), n3) * (0.9 + 0.2 * dNoise(xz * 0.7));
          alb = mix(alb, earth, plazaW);
        }
        #endif
        #ifdef LAND_ROAD
        alb = mix(alb, vec3(0.74, 0.66, 0.52), roadMask(xz) * 0.85);
        #endif
        vec3 albL = srgb(alb);
        #ifdef LAND_NEAR
        {
          float nw = 1.0 - smoothstep(60.0, 380.0, landDist);
          if (nw > 0.0) {
            vec2 tuv = xz / 3.2;
            vec3 s1 = texture2D(tSoil, tuv).rgb, g1 = texture2D(tGrass, tuv * 0.8).rgb, r1 = texture2D(tRock, tuv * 0.5).rgb;
            float rk = smoothstep(0.2, 0.45, slope + (dNoise(xz * 0.21) - 0.5) * 0.4);
            float gr = smoothstep(0.35, 0.7, dNoise(xz * 0.08) + (0.5 - arid) * 0.6);
            gr *= 1.0 - villW * 0.85;
            rk = max(rk, villW * 0.6 * smoothstep(0.35, 0.7, dNoise(xz * 0.3))) * (1.0 - plazaW * 0.5);
            vec3 det = mix(mix(s1 / 0.36, g1 / 0.42, gr), r1 / 0.55, rk);
            // round the village: the textures' luminance only (their hue is Bethlehem's red terra rossa: it turned the
            // plaza pink), plus a stony surface - limestone pebbles with a shadowed side, darker trodden lanes
            float dl = dot(det, vec3(0.2126, 0.7152, 0.0722));
            det = mix(det, vec3(dl) * vec3(1.02, 1.0, 0.96), clamp(villW * 1.2, 0.0, 1.0));
            albL = mix(albL, albL * clamp(mix(vec3(1.0), det, 0.6), 0.3, 1.8), nw) * 1.3;
            #ifdef LAND_VILLAGE
            {
              // small, sparse, irregular limestone pebbles (a cell keeps its stone only 40 % of the time)
              vec2 pp = xz * 3.6;
              float pAA = 1.0 - smoothstep(0.3, 0.8, fwidth(pp.x));
              float keep = step(0.6, dHash12(floor(pp) + 3.7)) * smoothstep(0.45, 0.75, dNoise(xz * 0.21) + villW * 0.15) * villW * pAA;
              float peb = dCellDots(pp, 0.16) * keep;
              float pebS = dCellDots(pp + vec2(0.1, 0.08), 0.16) * (1.0 - peb) * keep;
              albL = mix(albL, srgb(vec3(0.70, 0.68, 0.63)) * (0.8 + 0.35 * dHash12(floor(pp))), peb * 0.6);
              albL *= 1.0 - pebS * 0.3;
              // trodden: darker, compacted earth where feet go (the lane into the gate, round the benches)
              float trod = plazaW * smoothstep(0.45, 0.75, dNoise(xz * 0.09 + 2.0)) * 0.5;
              albL *= 1.0 - trod * 0.28;
              // fine cracks of the dry beaten earth
              float cr = abs(dNoise(xz * 0.8) - 0.5) + abs(dNoise(xz * 1.9 + 3.0) - 0.5) * 0.5;
              albL *= 1.0 - (1.0 - smoothstep(0.0, 0.03, cr)) * plazaW * pAA * 0.3;
            }
            #endif
            vec3 tn = texture2D(tGrassN, tuv * 0.8).xyz * 2.0 - 1.0;
            nW = normalize(nW + vec3(tn.x, 0.0, tn.y) * 0.35 * nw);
          }
        }
        #endif
        diffuseColor.rgb = albL;
        landN = nW;
        landSunVis = sh.b;
        #ifdef LAND_CLOUDSHADOW
        landSunVis *= cloudShadow(vLandW);
        #endif
      `)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize((viewMatrix * vec4(landN, 0.0)).xyz);')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.directDiffuse *= landSunVis; reflectedLight.directSpecular *= landSunVis;
        // valleys lose sky light (baked concavity) - reads as depth from the air
        reflectedLight.indirectDiffuse *= 0.72 + 0.28 * smoothstep(0.3, 0.7, sh.a);`)
      .replace('#include <opaque_fragment>', /* glsl */ `
        #ifdef LAND_VFOG
        {
          // the dawn inversion (visual-bible 3.11): fog lying in every valley below the smoothed surface, integrated
          // along the view ray (grazing looks over far valleys see more of it), lit by the low sun from behind:
          // each ridge's foot dissolves into the glowing layer and its crest stays sharp -> layered ridgelines.
          vec3 rdF = normalize(vLandW - cameraPosition);
          float top = uVFog.x + uVFog.y * (dFbm(xz * 0.0009 + vec2(uTime * 0.002, 0.0)) - 0.5);
          float fdep = max(vdep * 250.0 - top, 0.0);
          float path = fdep / max(abs(rdF.y), 0.03);
          float fm = (1.0 - exp(-path * uVFog.z)) * smoothstep(0.0, 22.0, fdep);
          fm *= smoothstep(uVFogNear, uVFogNear * 4.0, landDist);
          fm *= 1.0 - smoothstep(uVFog.w - 3000.0, uVFog.w, xz.x);
          fm *= 1.0 - 0.45 * smoothstep(0.5, 0.9, arid);
          fm *= 0.7 + 0.5 * dFbm(xz * 0.0021 + 3.0);
          float lit = 0.62 + 0.38 * landSunVis;
          vec3 fc = landHazeColor(rdF) * lit * 1.08 + uMistColor * 0.06 * lit;
          outgoingLight = mix(outgoingLight, fc, clamp(fm, 0.0, 0.94) * uMist);
        }
        #else
        {
          // dawn mist pooled in the valleys: thicker in deep valleys and low ground, lit by the low sun
          float m = uMist * 0.6 * smoothstep(0.04, 0.5, vdep) * smoothstep(uMistTop + 150.0, uMistTop - 250.0, vLandW.y);
          // the dawn inversion fills the valleys of the humid hills only (not the desert wadis or Moab's gorges)
          m *= (1.0 - smoothstep(0.35, 0.65, arid)) * (1.0 - smoothstep(14000.0, 22000.0, xz.x));
          m *= smoothstep(600.0, 3500.0, landDist) * (0.75 + 0.5 * dFbm(xz * 0.0009 + uTime * 0.002));
          outgoingLight = mix(outgoingLight, uMistColor, clamp(m, 0.0, 0.92));
        }
        #endif
        #ifdef LAND_HAZE
        outgoingLight = landApplyHaze(outgoingLight, cameraPosition, vLandW);
        #endif
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'land-terrain2-' + Object.keys(defines).join('-') + (look.cloudShadowGlsl ? look.cloudShadowGlsl.length : 0) + (look.roadGlsl ? look.roadGlsl.length : 0);
  return mat;
}
