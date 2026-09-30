import * as THREE from 'three';
import { GLSL_NOISE, shared } from '../../core/Shared';
import { Simplex2, smoothstep } from '../../core/noise';
import { gunzip } from '../../characters/human/inflate';
import type { TextureSet } from '../../world/Textures';
import { ROAD_GLSL, ROAD_HALF, roadZ, STONES } from './gilgalLayout';
import features from '../../assets/gilgal/gilgal_features.json';
import demUrl from '../../assets/gilgal/jordan_dem.binz?url';
import maskUrl from '../../assets/gilgal/jordan_mask.png?url';
import reliefUrl from '../../assets/gilgal/jordan_relief.webp?url';

export type GilgalTier = 'low' | 'medium' | 'high';

const G = features.grid;
/** set y of the Dead Sea surface (Iron Age level, -395 m ASL: conjecture from lake-level curves) */
export const DEAD_SEA_Y = features.deadSeaY;
/** absolute elevation of the set's y = 0 (m above sea level) */
export const ORIGIN_ASL = features.origin.elevation;
/** the Jordan's course (x, z) in set metres, north to south, ending at the Dead Sea */
export const JORDAN: [number, number][] = features.jordan as [number, number][];

const N1 = new Simplex2(4401);
const N2 = new Simplex2(4402);

/** Real terrain of the lower Jordan valley (SRTM, 48 m grid) + near-field detail around the site. */
export class GilgalGround {
  private constructor(private readonly h: Float32Array) {}

  static async load(): Promise<GilgalGround> {
    const res = await fetch(demUrl);
    const buf = await gunzip(await res.arrayBuffer());
    const q = new Int16Array(buf);
    const h = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) h[i] = q[i] * G.scale;
    return new GilgalGround(h);
  }

  /** DEM height (bicubic Catmull-Rom, clamped at the grid edge) */
  dem(x: number, z: number) {
    const n = G.n;
    const fx = THREE.MathUtils.clamp((x - G.x0) / G.dx, 0, n - 1.001);
    const fz = THREE.MathUtils.clamp((z - G.z0) / G.dx, 0, n - 1.001);
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz;
    const h = this.h;
    const row = (j: number) => {
      const jj = Math.min(n - 1, Math.max(0, j)) * n;
      const p = (i: number) => h[jj + Math.min(n - 1, Math.max(0, i))];
      return cr(p(ix - 1), p(ix), p(ix + 1), p(ix + 2), tx);
    };
    return cr(row(iz - 1), row(iz), row(iz + 1), row(iz + 2), tz);
  }

  /** ground height of the set (feet placement): DEM + near-field relief, the road bed, the stone ring's knoll */
  height(x: number, z: number) {
    let y = this.dem(x, z);
    const r = Math.hypot(x, z);
    const near = 1 - smoothstep(600, 1500, r);
    if (near > 0) {
      // low hummocks of the alluvial plain and shallow rills
      y += near * (N1.noise(x * 0.012, z * 0.012) * 0.9 + N2.noise(x * 0.05, z * 0.05) * 0.18 + N1.noise(x * 0.21 + 3, z * 0.21) * 0.04);
      // the road: trodden flat, a hand's breadth below the verge
      const dz = Math.abs(z - roadZ(x));
      const road = 1 - smoothstep(ROAD_HALF - 0.8, ROAD_HALF + 2.5, dz);
      if (road > 0 && x > -2500 && x < 3000) {
        const flat = this.dem(x, roadZ(x)) + near * N1.noise(x * 0.012, roadZ(x) * 0.012) * 0.9;
        y = THREE.MathUtils.lerp(y, flat - 0.08, road * 0.9);
      }
      // the twelve stones stand on a low, broad knoll
      const ds = Math.hypot(x - STONES.center.x, z - STONES.center.z);
      y += 0.35 * (1 - smoothstep(STONES.radius - 2, STONES.radius + 9, ds));
    }
    return y;
  }

  normal(x: number, z: number, e = 0.5, out = new THREE.Vector3()) {
    const hx = this.height(x + e, z) - this.height(x - e, z);
    const hz = this.height(x, z + e) - this.height(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }
}

function cr(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** Polar-grid terrain mesh around the site out to `R` (60 km: the haze hides the clamped DEM edge). */
export function terrainGeometry(ground: GilgalGround, tier: GilgalTier, R = 60000) {
  const radial = tier === 'high' ? 440 : tier === 'medium' ? 320 : 208;
  const drMin = tier === 'high' ? 0.7 : tier === 'medium' ? 1.0 : 1.5;
  const grow = tier === 'high' ? 0.021 : tier === 'medium' ? 0.029 : 0.043;
  const rings: number[] = [0];
  let r = 0;
  while (r < R) {
    r += Math.max(drMin, r * grow);
    rings.push(Math.min(r, R));
  }
  const pos: number[] = [0, ground.height(0, 0), 0];
  const nor: number[] = [];
  const idx: number[] = [];
  const spacing: number[] = [drMin];
  for (let i = 1; i < rings.length; i++) {
    const rr = rings[i];
    const off = (i % 2) * 0.5;
    for (let k = 0; k < radial; k++) {
      const a = ((k + off) / radial) * Math.PI * 2;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      pos.push(x, ground.height(x, z), z);
      spacing.push(rings[i] - rings[i - 1]);
    }
  }
  for (let k = 0; k < radial; k++) idx.push(0, 1 + ((k + 1) % radial), 1 + k);
  for (let i = 1; i < rings.length - 1; i++) {
    const a0 = 1 + (i - 1) * radial, b0 = 1 + i * radial;
    for (let k = 0; k < radial; k++) {
      const k1 = (k + 1) % radial;
      if (i % 2 === 1) {
        idx.push(a0 + k, a0 + k1, b0 + k);
        idx.push(a0 + k1, b0 + k1, b0 + k);
      } else {
        idx.push(a0 + k, b0 + k1, b0 + k);
        idx.push(a0 + k, a0 + k1, b0 + k1);
      }
    }
  }
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.length; i += 3) {
    const e = Math.max(0.35, Math.min(60, spacing[i / 3] * 0.7));
    ground.normal(pos[i], pos[i + 2], e, v);
    nor.push(v.x, v.y, v.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/** land-cover mask (R thicket, G marl badlands, B oasis, A Dead Sea) or, with `relief`, the relief map (R cavity, G drainage) */
export function loadMask(renderer: THREE.WebGLRenderer, relief = false): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(relief ? reliefUrl : maskUrl, (t) => {
      t.colorSpace = THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      t.name = relief ? 'gilgal.relief' : 'gilgal.mask';
      resolve(t);
    }, undefined, reject);
  });
}

/**
 * Terrain shading of the lower Jordan valley in the late-afternoon sun:
 *  - the plain of Jericho ("the plains of Jericho", Josh 4:13): pale grey-tan alluvium and Lisan marl silt, dry
 *    grass, saltbush and jujube (sidr) scrub; the trodden road; the oasis gardens of the spring near Jericho;
 *  - the qattara: chalk-white marl badlands, gullied, stepping down to the Zor;
 *  - the Zor with the Jordan's thicket (tamarisk, willow, Euphrates poplar, cane - "גְּאוֹן הַיַּרְדֵּן", Jer 12:5);
 *  - the Judean desert escarpment to the west (bare chalk and limestone, strata, wadis);
 *  - the mountains of Moab to the east (reddish sandstone foot, pale limestone plateau) glowing in the low sun;
 *  - the Dead Sea shore (salt) to the south; heat shimmer (mirage) low over the far plain.
 */
export function terrainMaterial(world: TextureSet, mask: THREE.Texture, relief: THREE.Texture) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, color: 0xffffff });
  mat.onBeforeCompile = (s) => {
    s.uniforms.tGrass = { value: world.grass };
    s.uniforms.tGrassN = { value: world.grassN };
    s.uniforms.tSoil = { value: world.soil };
    s.uniforms.tGravel = { value: world.gravel };
    s.uniforms.tRock = { value: world.rock };
    s.uniforms.tRockN = { value: world.rockN };
    s.uniforms.tMask = { value: mask };
    s.uniforms.tRelief = { value: relief };
    s.uniforms.uGrid = { value: new THREE.Vector4(G.x0, G.z0, G.n * G.dx, G.n * G.dx) };
    s.uniforms.uSunP = shared.uSunDir;
    s.uniforms.uSunC = shared.uSunColor;
    s.uniforms.uTimeT = shared.uTime;
    s.uniforms.uSeaY = { value: DEAD_SEA_Y };
    s.uniforms.uStones = { value: new THREE.Vector3(STONES.center.x, STONES.radius, STONES.center.z) };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vTW; varying vec3 vTN;`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
vTW = (modelMatrix * vec4(transformed, 1.0)).xyz;
vTN = normalize(mat3(modelMatrix) * objectNormal);`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tGrass, tGrassN, tSoil, tGravel, tRock, tRockN, tMask, tRelief;
uniform vec4 uGrid; uniform vec3 uSunP, uSunC, uStones; uniform float uTimeT, uSeaY;
${GLSL_NOISE}
${ROAD_GLSL}
varying vec3 vTW; varying vec3 vTN;
vec3 terWN; float terRough;
float tH(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float tN(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tH(i), tH(i + vec2(1, 0)), u.x), mix(tH(i + vec2(0, 1)), tH(i + vec2(1, 1)), u.x), u.y); }
float tF(vec2 p){ return tN(p) * 0.5 + tN(p * 2.1 + 7.3) * 0.3 + tN(p * 4.3 + 1.1) * 0.2; }
vec4 samp2(sampler2D t, vec2 p){ return mix(texture2D(t, p), texture2D(t, p * 0.29 + 0.37), 0.35); }
float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }`)
      .replace('#include <map_fragment>', `{
  vec3 Nw = normalize(vTN);
  vec2 xz = vTW.xz;
  float dist = length(vTW - cameraPosition);
  float slope = 1.0 - Nw.y;
  float asl = vTW.y + ${ORIGIN_ASL.toFixed(2)};
  vec4 M = texture2D(tMask, (xz - uGrid.xy) / uGrid.zw);
  vec2 RL = texture2D(tRelief, (xz - uGrid.xy) / uGrid.zw).rg;
  float m1 = tF(xz * 0.03), m2 = tF(xz * 0.004 + 3.0), m3 = tF(xz * 0.0009 - 2.0);
  // ---------------------------------------------------------------- macro colour (the whole valley)
  // Lisan marl and loess: pale grey-cream (visual-bible palette #d8cfbb, darkened for the lit albedo)
  vec3 plainC = mix(vec3(0.5, 0.47, 0.4), vec3(0.56, 0.52, 0.44), m2) * mix(0.9, 1.05, m3);
  vec3 marlC = mix(vec3(0.80, 0.78, 0.70), vec3(0.88, 0.85, 0.77), m1);
  vec3 desertC = mix(vec3(0.56, 0.45, 0.33), vec3(0.66, 0.56, 0.43), m2);
  vec3 moabLow = vec3(0.56, 0.36, 0.27), moabHigh = vec3(0.62, 0.52, 0.41);
  vec3 moabC = mix(moabLow, moabHigh, smoothstep(0.0, 700.0, asl)) * mix(0.9, 1.06, m2);
  float west = 1.0 - smoothstep(-5200.0, -3300.0, xz.x);
  float east = smoothstep(10500.0, 13000.0, xz.x);
  float hills = smoothstep(-230.0, -60.0, asl);
  vec3 c = plainC;
  // Judean desert / Moab by side and height
  c = mix(c, desertC, hills * clamp(west + (1.0 - east) * 0.6, 0.0, 1.0));
  c = mix(c, moabC, hills * east);
  // bare limestone strata on the steep flanks (bands that catch the low sun)
  float strataT = (vTW.y + (m2 - 0.5) * 22.0) / 13.0;
  float fS = fwidth(strataT);
  float strata = smoothstep(0.55, 0.75, fract(strataT)) * (1.0 - smoothstep(0.3, 0.7, fS));
  float cliff = smoothstep(0.12, 0.35, slope);
  c = mix(c, mix(vec3(0.72, 0.66, 0.56), vec3(0.5, 0.42, 0.33), strata), cliff * hills * 0.55);
  c *= 1.0 - strata * smoothstep(0.03, 0.12, slope) * hills * 0.18;
  // the marl badlands: chalk white, gullied (rills down the slope)
  float marl = M.g * smoothstep(0.01, 0.05, slope + M.g * 0.03);
  float rill = tN(vec2(xz.x * 0.004, xz.y * 0.06) + vec2(0.0, tN(xz * 0.01) * 3.0));
  c = mix(c, marlC * mix(0.78, 1.05, rill), clamp(marl * 1.15, 0.0, 1.0));
  // the Zor: thicket of the Jordan (dark green tamarisk / willow / poplar, lighter cane brakes)
  float th = smoothstep(0.15, 0.6, M.r + (tN(xz * 0.02) - 0.5) * 0.35);
  vec3 thC = mix(vec3(0.07, 0.10, 0.045), vec3(0.20, 0.24, 0.11), tN(xz * 0.06) * 0.7 + tN(xz * 0.3) * 0.3);
  c = mix(c, thC, th * 0.95);
  // oasis of Jericho: irrigated gardens (green / fallow plots) under the palm groves
  vec2 pr2 = vec2(0.9 * xz.x + 0.43 * xz.y, -0.43 * xz.x + 0.9 * xz.y) / vec2(70.0, 48.0);
  float pt = tH(floor(pr2) + 5.1);
  vec3 plot = pt < 0.35 ? vec3(0.22, 0.27, 0.12) : (pt < 0.6 ? vec3(0.34, 0.33, 0.18) : (pt < 0.8 ? vec3(0.45, 0.38, 0.26) : vec3(0.16, 0.2, 0.09)));
  float oas = smoothstep(0.1, 0.7, M.b);
  c = mix(c, plot * mix(0.85, 1.1, m1), oas * 0.85);
  // far palm groves in the oasis (single crowns too small for geometry): dark dots with sun-shadows
  vec2 sd2 = -normalize(uSunP.xz + vec2(1e-4)) * 1.4;
  vec2 op = xz * 0.11;
  float oAA = 1.0 - smoothstep(0.35, 0.8, fwidth(op.x));
  float grov = oas * smoothstep(0.35, 0.6, tN(xz * 0.004 + 2.0));
  float ol = dCellDots(op, 0.42) * grov * oAA;
  float olS = dCellDots(op - sd2, 0.42) * grov * oAA * (1.0 - ol);
  float farT = smoothstep(350.0, 700.0, dist);
  c *= 1.0 - olS * farT * 0.5;
  c = mix(c, vec3(0.07, 0.09, 0.05), ol * farT * 0.85);
  c = mix(c, vec3(0.08, 0.1, 0.055), (1.0 - oAA) * grov * farT * 0.6);
  // scrub of the plain: saltbush (grey), jujube / sidr (dark), in loose patches
  float cover = smoothstep(0.45, 0.85, dNoise(xz * 0.013 + 4.0)) * (1.0 - 0.6 * smoothstep(250.0, 900.0, dist)) * (1.0 - oas) * (1.0 - th) * (1.0 - hills * 0.7) * (1.0 - marl * 0.8);
  vec2 bp = xz * 0.16 + 11.0;
  float bAA = 1.0 - smoothstep(0.35, 0.8, fwidth(bp.x));
  float bush = dCellDots(bp, 0.22) * bAA * cover;
  float bushS = dCellDots(bp - sd2 * 0.9, 0.22) * bAA * cover * (1.0 - bush);
  c *= 1.0 - bushS * 0.35 * smoothstep(40.0, 90.0, dist);
  c = mix(c, mix(vec3(0.24, 0.24, 0.18), vec3(0.34, 0.33, 0.25), dNoise(xz * 0.7)), bush * 0.8 * smoothstep(40.0, 90.0, dist));
  c = mix(c, vec3(0.3, 0.29, 0.22), (1.0 - bAA) * cover * 0.15);
  // braided rills and sheet-wash across the plain (runoff from the wadis), and trodden paths: mid-scale detail that
  // keeps the plain readable from the air
  float rillN = abs(dNoise(xz * vec2(0.011, 0.02) + vec2(dNoise(xz * 0.004) * 4.0, 0.0)) - 0.5);
  float rillL = (1.0 - smoothstep(0.0, 0.035 + fwidth(xz.x) * 0.002, rillN)) * (1.0 - hills) * (1.0 - oas) * (1.0 - th) * smoothstep(60.0, 200.0, dist);
  c = mix(c, c * vec3(0.8, 0.8, 0.78), rillL * 0.6);
  c *= mix(0.88, 1.1, dNoise(xz * 0.021 + 3.3) * 0.6 + dNoise(xz * 0.07) * 0.4) * (1.0 - hills * 0.5) + hills * 0.5;
  // the Dead Sea shore: salt-white flats just above the water line
  float salt = (1.0 - smoothstep(uSeaY + 0.5, uSeaY + 2.5, vTW.y)) * smoothstep(3000.0, 6000.0, xz.y);
  c = mix(c, vec3(0.7, 0.68, 0.62), salt * 0.6);
  // the real relief read from the air: hollows and wadi beds darker (and lined with acacia / tamarisk / retama on the
  // plain), ridges and spur crests lighter
  float relW = smoothstep(120.0, 500.0, dist);
  c *= mix(1.0, mix(0.7, 1.14, RL.r), relW * (0.55 + 0.45 * hills));
  float wadi = smoothstep(0.25, 0.75, RL.g) * (1.0 - th) * (1.0 - oas * 0.5);
  c = mix(c, mix(vec3(0.24, 0.25, 0.17), vec3(0.38, 0.36, 0.28), hills), wadi * relW * 0.55);
  // unresolved self-shadowing of the rough desert in the low sun (knolls, boulders, gullies too small for the mesh)
  float sunLit = clamp(dot(Nw, normalize(uSunP)), 0.0, 1.0);
  c *= 1.0 - 0.22 * hills * smoothstep(0.3, 0.9, sunLit);
  // ---------------------------------------------------------------- near field: the plain at the site
  float nearW = 1.0 - smoothstep(90.0, 260.0, dist);
  vec3 cn = c;
  float rN = 0.0;
  if (nearW > 0.001) {
    vec4 so = samp2(tSoil, xz / 3.6);
    vec4 gv = samp2(tGravel, xz / 2.2);
    vec4 gr = samp2(tGrass, xz / 2.8);
    // pale silty alluvium (Lisan marl silt): the plain's macro colour, textured by the soil / gravel / grass maps'
    // luminance (their own hues are the terra rossa hills of Bethlehem, not the rift)
    float sL = lum(so.rgb) / 0.3, gL = lum(gv.rgb) / 0.32, grL = lum(gr.rgb) / 0.36;
    vec3 base0 = mix(vec3(0.5, 0.47, 0.4), vec3(0.55, 0.51, 0.43), m1);
    vec3 silt = base0 * mix(1.0, sL, 0.55);
    vec3 pebbles = base0 * vec3(0.96, 0.95, 0.93) * mix(1.0, gL, 0.9);
    vec3 dry = mix(base0 * vec3(1.08, 0.98, 0.78), gr.rgb * vec3(1.0, 0.92, 0.72), 0.5) * mix(1.0, grL, 0.5);
    float grassW = smoothstep(0.52, 0.72, tN(xz * 0.07) * 0.6 + tN(xz * 0.3) * 0.4 + gr.a * 0.2) * 0.8;
    float gravW = smoothstep(0.55, 0.8, tN(xz * 0.11 + 3.0) + gv.a * 0.3) * 0.7;
    cn = mix(silt, pebbles, gravW);
    cn = mix(cn, dry, grassW);
    // the road: trodden, dusty, pale, with a scatter of pebbles along the verges
    float dz = abs(xz.y - gilRoadZ(xz.x));
    float road = (1.0 - smoothstep(${(ROAD_HALF - 1.5).toFixed(2)}, ${(ROAD_HALF + 1.2).toFixed(2)}, dz + (tN(xz * 0.5) - 0.5) * 1.6)) * step(-2500.0, xz.x) * step(xz.x, 3000.0);
    vec3 dust = mix(base0 * vec3(1.16, 1.12, 1.06) * mix(1.0, sL, 0.3), pebbles, 0.15) * mix(0.93, 1.05, tN(xz * 1.7));
    cn = mix(cn, dust, road * 0.92);
    // trampled around the stone ring
    float ring = 1.0 - smoothstep(uStones.y + 1.0, uStones.y + 6.0, length(xz - uStones.xz));
    cn = mix(cn, dust * 0.97, ring * 0.6);
    rN = road;
    // keep the macro variation (patches of darker scrub ground)
    cn *= mix(0.9, 1.08, m2);
  }
  c = mix(c, cn, nearW);
  // heat shimmer: at grazing angles over the far plain the ground dissolves into a bright, trembling mirage of the sky
  vec3 vd = normalize(vTW - cameraPosition);
  float graze = 1.0 - smoothstep(0.004, 0.035, abs(vd.y));
  float mir = graze * smoothstep(700.0, 2600.0, dist) * (1.0 - hills) * (1.0 - th * 0.5);
  float shim = 0.55 + 0.45 * sin(vTW.x * 0.01 + vTW.z * 0.013 + uTimeT * 1.7 + tN(xz * 0.004) * 6.0);
  c = mix(c, vec3(0.74, 0.66, 0.54), mir * shim * 0.32);
  // looking into the low sun, every clod, pebble and tuft turns its shadowed side toward the camera
  vec3 sH = normalize(vec3(uSunP.x, 0.0, uSunP.z));
  float backlit = pow(max(dot(normalize(vec3(vd.x, 0.0, vd.z)), sH), 0.0), 2.0) * (1.0 - hills * 0.5);
  c *= 1.0 - 0.52 * backlit * (1.0 - smoothstep(300.0, 3000.0, dist) * 0.6);
  diffuseColor.rgb *= c;
  // ---------------------------------------------------------------- normals
  vec3 pert = vec3(0.0);
  if (nearW > 0.001) {
    vec3 gn = texture2D(tGrassN, xz / 2.8).xyz * 2.0 - 1.0;
    vec3 rn = texture2D(tRockN, xz / 2.4).xyz * 2.0 - 1.0;
    pert = mix(vec3(gn.x, 0.0, gn.y) * 0.7, vec3(rn.x, 0.0, rn.y) * 0.5, rN) * nearW;
  }
  vec3 farBump = vec3(0.0);
  float fdd = smoothstep(150.0, 900.0, dist);
  if (fdd > 0.01) {
    float eB = 6.0;
    #define GRH(q) (tF((q) * 0.018) * 22.0 + tF((q) * 0.06 + 3.0) * 6.0 + (1.0 - abs(tN((q) * 0.01 + 1.3) * 2.0 - 1.0)) * -7.0)
    float h0 = GRH(xz), hx = GRH(xz + vec2(eB, 0.0)), hz = GRH(xz + vec2(0.0, eB));
    float rough = hills * 1.0 + marl * 0.9 + 0.15;
    farBump = vec3(-(hx - h0) / eB, 0.0, -(hz - h0) / eB) * fdd * rough * 0.4;
  }
  terWN = normalize(Nw + pert + farBump);
  terRough = mix(0.97, 0.9, rN);
}`)
      .replace('#include <normal_fragment_maps>', `normal = normalize((viewMatrix * vec4(terWN, 0.0)).xyz);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = terRough;`);
  };
  mat.customProgramCacheKey = () => 'gilgal-terrain-v5';
  return mat;
}

/** The Dead Sea (Iron Age level): a still, dense, dark blue-green lake with a broad sun glint. */
export function deadSea() {
  const g = new THREE.PlaneGeometry(26000, 60000, 1, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(6000, DEAD_SEA_Y, 36000);
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.05, 0.11, 0.12), roughness: 0.16, metalness: 0.0, envMapIntensity: 1.2 });
  const mesh = new THREE.Mesh(g, m);
  mesh.name = 'gilgal:deadSea';
  mesh.receiveShadow = false;
  return mesh;
}

/** The Jordan: a muddy ribbon through the thicket of the Zor. */
export function jordanRiver(ground: GilgalGround) {
  const pts = JORDAN;
  const pos: number[] = [];
  const idx: number[] = [];
  const W = 13;
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    const [xa, za] = pts[Math.max(0, i - 1)];
    const [xb, zb] = pts[Math.min(pts.length - 1, i + 1)];
    let tx = xb - xa, tz = zb - za;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    const nx = -tz, nz = tx;
    let y = Infinity;
    for (const s of [-30, -12, 0, 12, 30]) y = Math.min(y, ground.height(x + nx * s, z + nz * s));
    y = Math.max(y + 0.8, DEAD_SEA_Y + 0.5);
    pos.push(x + nx * W, y, z + nz * W, x - nx * W, y, z - nz * W);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.2, 0.19, 0.12), roughness: 0.25, metalness: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m);
  mesh.name = 'gilgal:jordan';
  return mesh;
}
