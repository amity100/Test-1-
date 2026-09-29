import * as THREE from 'three';
import { Simplex2, smoothstep } from '../core/noise';
import type { TextureSet } from '../world/Textures';
import type { PalaceTier } from './palaceMaterials';
import { FORT } from './palaceLayout';
import { GLSL_NOISE, shared } from '../core/Shared';

/**
 * The hill of Gibeah (Tell el-Ful) in the Benjaminite hill country, palace-set local coordinates:
 * metres, +X = east, -Z = north, +Y = up, the citadel courtyard at y ~ 0.
 *
 * A broad limestone summit plateau (the "height", ramah) carries the citadel; the slopes fall ~60 m in
 * stepped agricultural terraces to a valley of harvested grain fields and threshing floors; beyond, rolling
 * hills of the watershed ridge dissolve into haze (the Jordan rift and Moab lie far to the east).
 */
const N1 = new Simplex2(9101);
const N2 = new Simplex2(9102);
const N3 = new Simplex2(9103);

export const SUMMIT = { x: 6, z: -2 };
export const PLATEAU_R = 42;
export const VALLEY_Y = -62;

function fbm(n: Simplex2, x: number, z: number, oct: number) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * n.noise(x * f, z * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
}

/** Smooth terrace quantisation: flat treads with short steep risers (`sharp` 0..1). */
function terrace(h: number, step: number, sharp: number) {
  const k = h / step;
  const f = Math.floor(k);
  const t = k - f;
  const s = smoothstep(1 - sharp, 1, t);
  return (f + s) * step;
}

/** Base (un-terraced) height, also used by placement code. */
function baseHeight(x: number, z: number) {
  const dx = x - SUMMIT.x, dz = (z - SUMMIT.z) * 0.82; // ridge runs north-south
  const r = Math.hypot(dx, dz);
  // summit dome
  let h = 0.5 - 0.00045 * r * r;
  // slope: 50 m .. 280 m, the tell's flanks, with gentle spurs and re-entrant gullies further down
  const s = smoothstep(PLATEAU_R - 12, 300, r);
  const ang = Math.atan2(dz, dx);
  const spur = (3.5 * Math.sin(ang * 5 + 0.7) + 2.0 * Math.sin(ang * 9 - 1.3)) * smoothstep(90, 260, r);
  h = THREE.MathUtils.lerp(h, VALLEY_Y + 10 * fbm(N1, x * 0.004, z * 0.004, 3) + spur, Math.pow(s, 0.8));
  // lumpy flanks (spurs, hollows, bedrock knolls) so the terraces meander along irregular contours
  const flank = smoothstep(PLATEAU_R + 28, PLATEAU_R + 70, r) * (1 - smoothstep(380, 600, r));
  if (flank > 0) h += flank * (fbm(N3, x * 0.011 + 4.2, z * 0.011 - 1.7, 3) * 7 + fbm(N2, x * 0.032, z * 0.032, 2) * 1.6);
  // the Benjamin plateau: rounded limestone hills and spurs cut by V-shaped wadis (no dune crests: plain fbm hills,
  // valleys carved along the zero set of a second noise)
  const far = smoothstep(420, 1400, r);
  if (far > 0) {
    const hillsA = fbm(N2, x * 0.0009, z * 0.0009, 4) * 95;
    const v1 = 1 - smoothstep(0, 0.16, Math.abs(fbm(N3, x * 0.00105 + 3.1, z * 0.00105 - 2.3, 3)));
    const v2 = 1 - smoothstep(0, 0.11, Math.abs(fbm(N1, x * 0.0027 - 5.2, z * 0.0027 + 1.7, 3)));
    const knobs = fbm(N3, x * 0.0036, z * 0.0036, 3) * 16;
    const hills = hillsA + knobs - v1 * 42 - v2 * 13 - 8;
    // the land falls toward the wilderness and the Jordan rift in the east
    const east = smoothstep(1500, 6200, x) * -175;
    h += far * (hills * (1 - 0.5 * smoothstep(3000, 6000, x)) + east + 25 * smoothstep(1200, 4000, -z));
    // the mountains of Moab beyond the rift: a long, level plateau edge with a steep western escarpment
    const edge = 6700 + 260 * fbm(N1, z * 0.0005 + 7.0, 3.3, 3);
    const moab = smoothstep(edge - 500, edge + 350, x);
    if (moab > 0) {
      const top = 62 + 20 * fbm(N2, z * 0.00035 + 1.1, 5.5, 2);
      // canyons (the wadis draining into the rift) notch the escarpment
      const canyon = 1 - smoothstep(0, 0.07, Math.abs(fbm(N3, z * 0.0011 + 9.0, 0.7, 2)));
      h = THREE.MathUtils.lerp(h, top - canyon * 18 * (1 - smoothstep(edge, edge + 900, x)), moab);
    }
  }
  return h;
}

export function gibeahHeight(x: number, z: number) {
  const dx = x - SUMMIT.x, dz = (z - SUMMIT.z) * 0.82;
  const r = Math.hypot(dx, dz);
  let h = baseHeight(x, z);
  // agricultural terraces are drawn by the terrain shader as contour lines of dry-stone risers: 2 m steps cannot be
  // represented by the polar mesh away from the summit (they alias into ripples), so the geometry stays smooth
  void terrace;
  // bedrock bumps on the plateau
  h += fbm(N1, x * 0.05, z * 0.05, 3) * 0.35 * (1 - smoothstep(PLATEAU_R, PLATEAU_R + 20, r));
  // the citadel courtyard is levelled beaten earth (and the ground just outside the walls)
  const ox = Math.max(FORT.x0 - x, x - FORT.x1, 0), oz = Math.max(FORT.z0 - z, z - FORT.z1, 0);
  const inFort = 1 - smoothstep(0, 7, Math.hypot(ox, oz));
  if (inFort > 0) h = THREE.MathUtils.lerp(h, 0.02 + fbm(N2, x * 0.08, z * 0.08, 2) * 0.1, inFort);
  return h;
}

export function gibeahNormal(x: number, z: number, out = new THREE.Vector3()) {
  const e = 0.6;
  const hx = gibeahHeight(x + e, z) - gibeahHeight(x - e, z);
  const hz = gibeahHeight(x, z + e) - gibeahHeight(x, z - e);
  return out.set(-hx, 2 * e, -hz).normalize();
}

/** Polar-grid terrain mesh: dense on the summit, growing rings out to `R`. */
export function terrainGeometry(tier: PalaceTier, R = 9000) {
  const radial = tier === 'high' ? 420 : tier === 'medium' ? 320 : 200;
  const drMin = tier === 'high' ? 0.7 : tier === 'medium' ? 1.0 : 1.6;
  const grow = tier === 'high' ? 0.022 : tier === 'medium' ? 0.03 : 0.045;
  const rings: number[] = [0];
  let r = 0;
  while (r < R) {
    r += Math.max(drMin, r * grow);
    rings.push(Math.min(r, R));
  }
  const pos: number[] = [];
  const idx: number[] = [];
  // centre vertex
  pos.push(SUMMIT.x, gibeahHeight(SUMMIT.x, SUMMIT.z), SUMMIT.z);
  for (let i = 1; i < rings.length; i++) {
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2 + (i % 2) * (Math.PI / radial);
      const x = SUMMIT.x + Math.cos(a) * rings[i], z = SUMMIT.z + Math.sin(a) * rings[i];
      pos.push(x, gibeahHeight(x, z), z);
    }
  }
  for (let j = 0; j < radial; j++) idx.push(0, 1 + ((j + 1) % radial), 1 + j);
  for (let i = 1; i < rings.length - 1; i++) {
    const a0 = 1 + (i - 1) * radial, b0 = 1 + i * radial;
    const odd = i % 2 === 1;
    for (let j = 0; j < radial; j++) {
      const j1 = (j + 1) % radial;
      const a = a0 + j, b = a0 + j1, c = b0 + j, d = b0 + j1;
      // rings are staggered by half a segment: alternate the diagonal so triangles stay near-equilateral
      if (odd) {
        idx.push(a, b, d);
        idx.push(a, d, c);
      } else {
        idx.push(a, b, c);
        idx.push(b, d, c);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
  // analytic normals (smooth across the polar seams)
  const nor = new Float32Array(pos.length);
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.length; i += 3) {
    gibeahNormal(pos[i], pos[i + 2], n);
    nor[i] = n.x; nor[i + 1] = n.y; nor[i + 2] = n.z;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  return g;
}

/**
 * Terrain shading: dry golden grass, terra rossa, bedrock limestone (triplanar on steep ground), dry-stone
 * terrace risers, harvested grain parcels in the valley, dusty courtyard earth on the summit.
 */
export function terrainMaterial(world: TextureSet) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, color: 0xffffff });
  mat.onBeforeCompile = (s) => {
    s.uniforms.tGrass = { value: world.grass };
    s.uniforms.tGrassN = { value: world.grassN };
    s.uniforms.tSoil = { value: world.soil };
    s.uniforms.tRock = { value: world.rock };
    s.uniforms.tRockN = { value: world.rockN };
    s.uniforms.tWall = { value: world.wall };
    s.uniforms.tWallN = { value: world.wallN };
    s.uniforms.tGravel = { value: world.gravel };
    s.uniforms.uSummit = { value: new THREE.Vector3(SUMMIT.x, 0, SUMMIT.z) };
    s.uniforms.uFort = { value: new THREE.Vector4(FORT.x0, FORT.x1, FORT.z0, FORT.z1) };
    s.uniforms.uSunP = shared.uSunDir;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vTW; varying vec3 vTN;`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
vTW = (modelMatrix * vec4(transformed, 1.0)).xyz;
vTN = normalize(mat3(modelMatrix) * objectNormal);`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tGrass, tGrassN, tSoil, tRock, tRockN, tWall, tWallN, tGravel;
uniform vec3 uSummit; uniform vec4 uFort; uniform vec3 uSunP;
${GLSL_NOISE}
varying vec3 vTW; varying vec3 vTN;
vec3 terWN; float terAO; float terRough;
float tH(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float tN(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tH(i), tH(i + vec2(1, 0)), u.x), mix(tH(i + vec2(0, 1)), tH(i + vec2(1, 1)), u.x), u.y); }
float tF(vec2 p){ return tN(p) * 0.5 + tN(p * 2.1 + 7.3) * 0.3 + tN(p * 4.3 + 1.1) * 0.2; }
// two-scale sampling to break tiling
vec4 samp2(sampler2D t, vec2 p){ return mix(texture2D(t, p), texture2D(t, p * 0.29 + 0.37), 0.35); }`)
      .replace('#include <map_fragment>', `{
  vec3 Nw = normalize(vTN);
  vec2 xz = vTW.xz;
  float dist = length(vTW - cameraPosition);
  float rS = length((xz - uSummit.xz) * vec2(1.0, 0.82));
  float slope = 1.0 - Nw.y;
  // layers (albedo alpha = height for height-blending)
  vec4 gr = samp2(tGrass, xz / 3.2);
  vec4 so = samp2(tSoil, xz / 4.0);
  vec4 gv = texture2D(tGravel, xz / 2.6);
  vec3 bw = pow(abs(Nw), vec3(4.0)); bw /= bw.x + bw.y + bw.z;
  vec2 rp = xz / 2.2;
  vec4 rx = texture2D(tRock, vTW.zy / 2.2), ry = texture2D(tRock, rp), rz = texture2D(tRock, vTW.xy / 2.2);
  vec4 ro = rx * bw.x + ry * bw.y + rz * bw.z;
  vec4 wx = texture2D(tWall, vTW.zy / 2.4), wz = texture2D(tWall, vTW.xy / 2.4);
  vec4 wa = (wx * bw.x + wz * bw.z) / max(bw.x + bw.z, 1e-3);
  // macro noise
  float m1 = tF(xz * 0.03), m2 = tF(xz * 0.008 + 3.0), m3 = tF(xz * 0.12);
  // harvested grain parcels in the valley (stubble stripes / ploughed terra rossa)
  float valley = smoothstep(260.0, 420.0, rS) * (1.0 - smoothstep(1500.0, 2600.0, rS));
  // weights
  float wRock = smoothstep(0.3, 0.55, slope + (m1 - 0.5) * 0.35) ;
  float onPlateau = 1.0 - smoothstep(${PLATEAU_R.toFixed(1)} - 4.0, ${PLATEAU_R.toFixed(1)} + 6.0, rS);
  wRock = max(wRock, onPlateau * smoothstep(0.66, 0.8, m1 + ro.a * 0.3) * 0.8);
  float terr = smoothstep(${(PLATEAU_R + 4).toFixed(1)}, ${(PLATEAU_R + 22).toFixed(1)}, rS) * (1.0 - smoothstep(330.0, 470.0, rS));
  float wWall = terr * smoothstep(0.42, 0.62, slope);
  float wSoil = smoothstep(0.6, 0.85, m2 + so.a * 0.25) * 0.5 + onPlateau * 0.35 * smoothstep(0.4, 0.7, m3);
  vec2 pc = floor(xz / vec2(46.0, 31.0) + vec2(tN(xz * 0.004) * 2.0));
  float ptype = tH(pc);
  vec3 c = gr.rgb * mix(vec3(0.86, 0.8, 0.68), vec3(0.98, 0.9, 0.74), m2);
  // scrub (sage, thorny burnet, young oak): dark grey-green specks in patches
  float scrub = smoothstep(0.58, 0.76, tN(xz * 0.35) * 0.6 + tN(xz * 1.3) * 0.4) * smoothstep(0.25, 0.55, m1);
  c = mix(c, vec3(0.16, 0.17, 0.11), scrub * 0.75 * (1.0 - valley * 0.8));
  // stubble: paler, striped along the parcel
  float stripe = 0.5 + 0.5 * sin((xz.x * 0.9 + xz.y * 0.4) * 3.14159 * 1.2);
  vec3 stub = gr.rgb * vec3(1.22, 1.08, 0.8) * (0.9 + 0.12 * stripe);
  vec3 plough = so.rgb * vec3(0.95, 0.9, 0.85) * (0.85 + 0.2 * stripe);
  c = mix(c, ptype < 0.45 ? stub : (ptype < 0.7 ? plough : c * 0.92), valley * 0.85);
  c = mix(c, so.rgb, clamp(wSoil, 0.0, 1.0) * 0.8);
  c = mix(c, gv.rgb * vec3(1.0, 0.95, 0.9), onPlateau * smoothstep(0.6, 0.8, m3) * 0.2);
  // the citadel courtyard and the gate forecourt: trodden, dusty beaten earth
  vec2 fo = max(vec2(uFort.x - xz.x, uFort.z - xz.y), vec2(xz.x - uFort.y, xz.y - uFort.w));
  float yard = 1.0 - smoothstep(-1.0, 3.0, max(fo.x, fo.y));
  float lane = (1.0 - smoothstep(2.0, 4.5, abs(xz.y - 1.5))) * step(uFort.y, xz.x) * (1.0 - smoothstep(60.0, 90.0, xz.x));
  vec3 earth = mix(so.rgb * vec3(1.02, 0.92, 0.82), gv.rgb * vec3(0.8, 0.75, 0.7), 0.15) * (0.82 + 0.2 * m3);
  c = mix(c, earth, clamp(max(yard, lane) * 0.92, 0.0, 1.0));
  c = mix(c, ro.rgb * vec3(1.02, 1.0, 0.96), clamp(wRock, 0.0, 1.0));
  c = mix(c, wa.rgb, wWall);
  // ---- far field: the terraced hill country of Benjamin --------------------------------------------
  // (grain parcels on the valley floors, terraced olive groves with white stone risers on the slopes, grey
  // garrigue and bare limestone ledges on the steep and high ground, chalk wilderness and Moab in the east)
  float fdd = smoothstep(140.0, 650.0, dist);
  float mB = tF(xz * 0.0024 + 5.0), mC = tF(xz * 0.0011 - 2.0), mD = tF(xz * 0.006 + 9.0);
  // (slope = 1 - N.y: 8 deg = 0.01, 15 deg = 0.034, 25 deg = 0.094, 35 deg = 0.18)
  float gentle = 1.0 - smoothstep(0.005, 0.014, slope);
  float steep = smoothstep(0.08, 0.17, slope);
  float farZone = smoothstep(${(PLATEAU_R + 25).toFixed(1)}, ${(PLATEAU_R + 70).toFixed(1)}, rS);
  float wild = smoothstep(2600.0, 5200.0, xz.x) * (1.0 - smoothstep(6100.0, 6900.0, xz.x));
  float moabZ = smoothstep(6100.0, 6900.0, xz.x);
  float fields = gentle * smoothstep(0.4, 0.56, mB) * (1.0 - wild) * (1.0 - moabZ);
  float terraced = (1.0 - gentle) * (1.0 - steep * 0.75) * smoothstep(0.28, 0.48, mC + 0.12) * (1.0 - wild * 0.9) * (1.0 - moabZ);
  float groves = terraced * smoothstep(0.28, 0.5, mD) + gentle * (1.0 - fields) * 0.45 * smoothstep(0.45, 0.65, mD);
  vec3 goldG = vec3(0.37, 0.29, 0.16), greyG = vec3(0.21, 0.205, 0.15), limeC = vec3(0.55, 0.525, 0.47);
  vec3 macro = mix(goldG, greyG, smoothstep(0.3, 0.75, mC * 0.55 + mD * 0.45));
  macro *= mix(0.86, 1.08, m2);
  // grain parcels: stubble, ploughed terra rossa, fallow, with grey balks between them
  vec2 pr2 = vec2(0.94 * xz.x + 0.34 * xz.y, -0.34 * xz.x + 0.94 * xz.y) / vec2(46.0, 29.0) + vec2(tN(xz * 0.003) * 1.5, 0.0);
  float pt = tH(floor(pr2) + 3.1);
  vec3 parcel = pt < 0.38 ? vec3(0.52, 0.42, 0.25) : (pt < 0.62 ? vec3(0.31, 0.19, 0.115) : (pt < 0.84 ? vec3(0.43, 0.35, 0.21) : vec3(0.28, 0.27, 0.19)));
  vec2 pf = fract(pr2);
  float pfw = max(fwidth(pr2.x), fwidth(pr2.y));
  float balk = (1.0 - smoothstep(0.0, 0.04 + pfw, min(min(pf.x, 1.0 - pf.x), min(pf.y, 1.0 - pf.y)))) * (1.0 - smoothstep(0.08, 0.25, pfw));
  parcel = mix(parcel, greyG * 1.1, balk * 0.7);
  parcel = mix(parcel, vec3(0.44, 0.35, 0.21), smoothstep(0.08, 0.3, pfw) * 0.3);
  macro = mix(macro, parcel * mix(0.9, 1.08, mD), fields * 0.92);
  // bare limestone: steep flanks and bedding ledges (strata) that catch the low sun
  float strataT = (vTW.y + (m2 - 0.5) * 7.0) / 4.2;
  float fS = fwidth(strataT);
  float strata = smoothstep(0.58, 0.72, fract(strataT)) * (1.0 - smoothstep(0.25, 0.6, fS));
  float bare = clamp(steep * 0.7 + strata * smoothstep(0.03, 0.09, slope) * 0.55 + smoothstep(0.74, 0.9, mB + mD * 0.2) * 0.3, 0.0, 1.0) * (1.0 - fields);
  macro = mix(macro, limeC * mix(0.84, 1.06, mD), bare * 0.8);
  macro = mix(macro, vec3(0.57, 0.46, 0.35) * mix(0.9, 1.06, mB), wild * 0.85);
  macro = mix(macro, vec3(0.5, 0.42, 0.33) * mix(0.85, 1.05, mB), moabZ * 0.9);
  // terrace walls along the contours: white stone risers, the shaded foot of the tread below
  float tT = (vTW.y + (tN(xz * 0.012) - 0.5) * 1.4) / 2.4;
  float fwT = fwidth(tT);
  float fb = fract(tT);
  float riser = smoothstep(0.8 - fwT, 0.85 + fwT, fb) * (1.0 - smoothstep(0.95 - fwT, 1.0, fb));
  float foot = smoothstep(0.0, 0.1 + fwT, fb) * (1.0 - smoothstep(0.1, 0.3 + fwT, fb));
  float tVis = 1.0 - smoothstep(0.22, 0.5, fwT);
  float terrW = terraced * farZone;
  vec3 rubble = vec3(0.64, 0.61, 0.55) * mix(0.88, 1.08, tH(floor(xz * 0.7)));
  macro = mix(macro, rubble, riser * tVis * terrW * 0.92);
  macro *= 1.0 - foot * tVis * terrW * 0.32;
  macro = mix(macro, mix(macro, vec3(0.6, 0.57, 0.51), 0.3), terrW * (1.0 - tVis));
  // olive trees: rows on the treads, dark silver-green crowns with long shadows away from the sun
  vec2 sd2 = -normalize(uSunP.xz + vec2(1e-4)) * 0.9;
  vec2 op = xz * 0.085;
  float oAA = 1.0 - smoothstep(0.35, 0.8, fwidth(op.x));
  float tread = mix(1.0, smoothstep(0.12, 0.28, fb) * (1.0 - smoothstep(0.66, 0.8, fb)), tVis * step(0.02, terrW));
  float ol = dCellDots(op + 5.0, 0.36) * groves * tread * oAA;
  float olS = dCellDots(op + 5.0 - sd2, 0.36) * groves * tread * oAA * (1.0 - ol);
  float oFade = smoothstep(110.0, 240.0, dist) * (1.0 - bare * 0.6);
  macro *= 1.0 - olS * oFade * 0.5;
  macro = mix(macro, mix(vec3(0.075, 0.085, 0.055), vec3(0.15, 0.16, 0.11), dNoise(xz * 0.4)), ol * oFade * 0.9);
  // groves too far to resolve single trees: dark mottled patches
  macro = mix(macro, vec3(0.1, 0.11, 0.075) * mix(0.8, 1.2, dNoise(xz * 0.05)), (1.0 - oAA) * groves * oFade * 0.62);
  // garrigue: sage, thorny burnet, young oak and terebinth dotting everything that is not a field
  float cover = smoothstep(0.3, 0.7, dNoise(xz * 0.02 + 4.0)) * (1.0 - fields * 0.85) * (1.0 - wild * 0.7) * (1.0 - moabZ);
  vec2 bp = xz * 0.28 + 11.0;
  float bAA = 1.0 - smoothstep(0.35, 0.8, fwidth(bp.x));
  float bush = (dCellDots(bp, 0.26) * bAA + dCellDots(xz * 0.11 - 5.0, 0.22) * 0.8) * cover;
  macro = mix(macro, mix(vec3(0.12, 0.125, 0.085), vec3(0.2, 0.2, 0.14), dNoise(xz * 0.9)), clamp(bush, 0.0, 1.0) * 0.7 * smoothstep(90.0, 200.0, dist));
  macro = mix(macro, vec3(0.15, 0.15, 0.1), (1.0 - bAA) * cover * 0.5 * smoothstep(0.35, 0.7, dNoise(xz * 0.07 + 2.0)));
  c = mix(c, macro, fdd * farZone);
  // near terrace lines along the contours (textured dry-stone risers every ~2.4 m, antialiased)
  float fy = max(fwidth(vTW.y), 1e-4);
  float tph = fract(vTW.y / 2.4 + tN(xz * 0.02) * 0.6 + tN(xz * 0.055 + 3.0) * 0.35);
  // terraces are not continuous: collapsed stretches, gaps, uneven rubble
  float tseg = smoothstep(0.22, 0.4, tN(xz * 0.09 + floor(vTW.y / 2.4) * 3.7));
  float lineW = 0.13;
  float tline = 1.0 - smoothstep(lineW, lineW + fy / 2.4, tph);
  tline = mix(tline, lineW, smoothstep(0.08, 0.5, fy / 2.4));
  float slopeBand = smoothstep(0.004, 0.013, slope) * (1.0 - smoothstep(0.3, 0.5, slope)) * smoothstep(${(PLATEAU_R + 3).toFixed(1)}, ${(PLATEAU_R + 12).toFixed(1)}, rS) * (1.0 - valley * 0.6) * (1.0 - fdd);
  c = mix(c, wa.rgb * vec3(1.14, 1.1, 1.03) * mix(0.72, 1.08, tN(xz * 1.3)), tline * slopeBand * 0.9 * tseg);
  c = mix(c, c * 0.55, (1.0 - smoothstep(0.0, lineW * 1.5 + fy / 2.4, fract(tph + lineW + 0.02))) * slopeBand * 0.5 * tseg * (1.0 - smoothstep(0.08, 0.5, fy / 2.4)));
  c = mix(c, c * 0.72, (1.0 - tline) * slopeBand * smoothstep(0.0, 0.3, tph) * 0.2);
  float fd = fdd;
  // far micro-relief the far mesh cannot carry (knolls, ledges, gullies): perturbs the shading normal so the low sun
  // rakes a rough, rocky surface instead of smooth dune flanks
  vec3 farBump = vec3(0.0);
  if (fdd * farZone > 0.01) {
    float eB = 5.0;
    #define FRH(q) (tF((q) * 0.021) * 26.0 + tF((q) * 0.07 + 3.0) * 7.0 + tF((q) * 0.19 + 7.0) * 2.2 + (1.0 - abs(tN((q) * 0.012 + 1.3) * 2.0 - 1.0)) * -9.0)
    float h0 = FRH(xz), hx = FRH(xz + vec2(eB, 0.0)), hz = FRH(xz + vec2(0.0, eB));
    farBump = vec3(-(hx - h0) / eB, 0.0, -(hz - h0) / eB) * fdd * farZone * 0.7;
  }
  diffuseColor.rgb *= c;
  // normals: tangent-space maps projected on the dominant plane
  vec3 gn = texture2D(tGrassN, xz / 3.2).xyz * 2.0 - 1.0;
  vec3 rnx = texture2D(tRockN, vTW.zy / 2.2).xyz * 2.0 - 1.0, rny = texture2D(tRockN, rp).xyz * 2.0 - 1.0, rnz = texture2D(tRockN, vTW.xy / 2.2).xyz * 2.0 - 1.0;
  vec3 wnx = texture2D(tWallN, vTW.zy / 2.4).xyz * 2.0 - 1.0, wnz = texture2D(tWallN, vTW.xy / 2.4).xyz * 2.0 - 1.0;
  vec3 pr = bw.x * vec3(0.0, rnx.y, rnx.x) + bw.y * vec3(rny.x, 0.0, rny.y) + bw.z * vec3(rnz.x, rnz.y, 0.0);
  vec3 pw = (bw.x * vec3(0.0, wnx.y, wnx.x) + bw.z * vec3(wnz.x, wnz.y, 0.0)) / max(bw.x + bw.z, 1e-3);
  vec3 pg = vec3(gn.x, 0.0, gn.y);
  vec3 pert = mix(pg * 0.8, pr * 1.2, clamp(wRock, 0.0, 1.0));
  pert = mix(pert, pw * 1.4, wWall);
  terWN = normalize(Nw + pert * (1.0 - fd) + farBump * 0.9);
  terAO = mix(1.0, texture2D(tRockN, rp).a, clamp(wRock, 0.0, 1.0) * 0.6) * mix(1.0, 0.8, wWall);
  terRough = mix(0.96, 0.88, wRock);
}`)
      .replace('#include <normal_fragment_maps>', `normal = normalize((viewMatrix * vec4(terWN, 0.0)).xyz);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = terRough;`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
reflectedLight.indirectDiffuse *= terAO;`);
  };
  mat.customProgramCacheKey = () => 'palace-terrain-v8';
  return mat;
}
