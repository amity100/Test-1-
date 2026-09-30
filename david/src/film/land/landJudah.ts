import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLSL_NOISE } from '../../core/Shared';
import { cloudShared, GLSL_CLOUD_WEATHER, GLSL_LAND_HAZE, landAtmo } from './landAtmo';
import type { HeightTile } from './landData';
import { TERRACE_STEP, terraceWobble, type LandTier } from './landTerrain';

/**
 * The inhabited hill country of Judah for the aerial shot (docs/visual-bible.md 3.11: "Judean mountains ≈750–1,000 m;
 * terraces, olives, vines, remaining oak-terebinth woodland, small villages of stone with flat roofs"):
 *  - dry-stone terrace walls as instanced geometry along the contours of the rendered terrain (the terrain shader
 *    draws the same lines farther away, see LAND_TERRACE in landTerrain.ts); they sink into the ground past
 *    their range so the hand-over is invisible;
 *  - olive groves: instanced low-poly crowns with long dawn shadows (multiplied onto the ground);
 *  - hamlets of flat-roofed fieldstone houses with courtyard walls on the hilltops (Iron Age I–IIA: no towers, no
 *    domes, no arches, no red roofs).
 * Everything is placed only where the camera of the flight looks (a wedge ahead of the late flight poses), only on
 * the humid side of the rain-shadow line (aridity from judah_dress.webp), and lit with the set's baked terrain sun
 * visibility, cloud shadow, valley mist and km-scale haze, so it sits in the same light as the terrain.
 */
export interface JudahDressInput {
  tier: LandTier;
  /** height of the rendered terrain mesh (polarSampler) */
  ground: (x: number, z: number) => number;
  /** DEM height (for slopes) */
  dem: (x: number, z: number) => number;
  /** sun visibility of the local tile (shadeTexture B channel) */
  shade: { tile: HeightTile; data: Uint8Array };
  /** judah_dress.webp: R aridity, G drainage, B valley depth */
  mask: { w: number; h: number; x0: number; z0: number; dx: number; dz: number; data: Uint8ClampedArray };
  sunDir: THREE.Vector3;
  /** camera poses of the shots that look at the hills (placement wedge) */
  views: { pos: THREE.Vector3; look: THREE.Vector3 }[];
  mist: { color: THREE.Color; top: number };
  /** the terrain's valley fog (landTerrain TerrainLook.valleyFog): the dressing fades into the same layer */
  fog?: { offset: number; jitter: number; density: number; xMax: number; near: number };
  /** hamlets placed by the set (hilltops in view of the final pose), before the automatic candidates */
  hamlets?: { x: number; z: number; r: number }[];
  /** extra olive density near these points (x, z, radius) — the near ridge of the final pose */
  groves?: { x: number; z: number; r: number }[];
}

export interface JudahDressing { group: THREE.Group; triangles: number; counts: { olives: number; walls: number; houses: number }; dispose(): void }

// small deterministic value noise (CPU placement)
const hash2 = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x: number, y: number) => {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm2 = (x: number, y: number) => vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 5.2, y * 2.1 + 1.3) * 0.3 + vnoise(x * 4.3 + 9.1, y * 4.3 + 3.7) * 0.15;

/** shared shader chunk: land light for dressing (baked sun visibility + cloud shadow + mist + haze) */
function dressMaterial(o: { color?: number; vertexColors?: boolean; roughness?: number; mist: { color: THREE.Color; top: number }; fog?: JudahDressInput['fog'] }): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: o.color ?? 0xffffff, vertexColors: o.vertexColors ?? false, roughness: o.roughness ?? 0.95, metalness: 0 });
  const f = o.fog;
  const u = {
    ...landAtmo, ...cloudShared, uMistC: { value: o.mist.color.clone() }, uMistTop: { value: o.mist.top },
    uVFog: { value: f ? new THREE.Vector4(f.offset, f.jitter, f.density, f.xMax) : new THREE.Vector4(0, 0, 0, 0) }, uVFogNear: { value: f?.near ?? 400 },
  };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec2 aLand; // x = baked sun visibility, y = valley depth
        varying vec3 vDW; varying vec2 vLand; varying float vCloud;
        uniform vec3 uSunDirA;
        ${GLSL_NOISE}
        ${GLSL_CLOUD_WEATHER}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
        vDW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
        vDW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif
        vLand = aLand; vCloud = cloudShadow(vDW);`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vDW; varying vec2 vLand; varying float vCloud;
        uniform vec3 uMistC; uniform float uMistTop;
        uniform vec4 uVFog; uniform float uVFogNear;
        ${GLSL_NOISE}
        ${GLSL_LAND_HAZE}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.directDiffuse *= vLand.x * vCloud; reflectedLight.directSpecular *= vLand.x * vCloud;`)
      .replace('#include <opaque_fragment>', `
        {
          float dd = length(vDW - cameraPosition);
          if (uVFog.z > 0.0) {
            // the terrain's valley fog (landTerrain LAND_VFOG), same model, so trees and walls sink into the layer
            vec3 rdF = normalize(vDW - cameraPosition);
            float top = uVFog.x + uVFog.y * (dFbm(vDW.xz * 0.0009) - 0.5);
            float fdep = max(vLand.y * 250.0 - top, 0.0);
            float fm = (1.0 - exp(-fdep / max(abs(rdF.y), 0.03) * uVFog.z)) * smoothstep(uVFogNear, uVFogNear * 3.0, dd);
            fm *= 0.7 + 0.5 * dFbm(vDW.xz * 0.0021 + 3.0);
            vec3 fc = landHazeColor(rdF) * (0.62 + 0.38 * vLand.x) * 1.08 + uMistC * 0.06;
            outgoingLight = mix(outgoingLight, fc, clamp(fm, 0.0, 0.94));
          } else {
            float m = 0.6 * smoothstep(0.04, 0.5, vLand.y) * smoothstep(uMistTop + 150.0, uMistTop - 250.0, vDW.y) * smoothstep(600.0, 3500.0, dd);
            outgoingLight = mix(outgoingLight, uMistC, clamp(m, 0.0, 0.9));
          }
          outgoingLight = landApplyHaze(outgoingLight, cameraPosition, vDW);
        }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'land-dress-2' + (f ? 'f' : '');
  return m;
}

export function buildJudahDressing(o: JudahDressInput): JudahDressing {
  const group = new THREE.Group();
  group.name = 'land:judah-dressing';
  const disposables: { dispose(): void }[] = [];
  const tier = o.tier;
  const K = tier === 'high' ? 1 : tier === 'medium' ? 0.6 : 0.3;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ---------------------------------------------------------------- samplers
  const M = o.mask;
  const maskAt = (x: number, z: number, c: number) => {
    const i = Math.max(0, Math.min(M.w - 1, Math.round((x - M.x0) / M.dx))), j = Math.max(0, Math.min(M.h - 1, Math.round((z - M.z0) / M.dz)));
    return M.data[(j * M.w + i) * 4 + c] / 255;
  };
  const S = o.shade;
  const sunVis = (x: number, z: number) => {
    const t = S.tile;
    const u = (x - t.x0) / t.dx, v = (z - t.z0) / t.dz;
    const i = Math.max(0, Math.min(t.w - 2, Math.floor(u))), j = Math.max(0, Math.min(t.h - 2, Math.floor(v)));
    const fu = Math.min(1, Math.max(0, u - i)), fv = Math.min(1, Math.max(0, v - j));
    const at = (a: number, b: number) => S.data[((j + b) * t.w + (i + a)) * 4 + 2] / 255;
    return (at(0, 0) * (1 - fu) + at(1, 0) * fu) * (1 - fv) + (at(0, 1) * (1 - fu) + at(1, 1) * fu) * fv;
  };
  const slopeAt = (x: number, z: number) => {
    const e = 20;
    const gx = (o.dem(x + e, z) - o.dem(x - e, z)) / (2 * e), gz = (o.dem(x, z + e) - o.dem(x, z - e)) / (2 * e);
    return Math.hypot(gx, gz);
  };
  // view wedge: distance to the nearest pose within its horizontal cone
  const views = o.views.map((v) => {
    const f = new THREE.Vector2(v.look.x - v.pos.x, v.look.z - v.pos.z).normalize();
    return { x: v.pos.x, z: v.pos.z, fx: f.x, fz: f.y };
  });
  const viewDist = (x: number, z: number, cosMax = 0.72) => {
    let best = 1e9;
    for (const v of views) {
      const dx = x - v.x, dz = z - v.z;
      const d = Math.hypot(dx, dz);
      if (d < 1) continue;
      if ((dx * v.fx + dz * v.fz) / d < cosMax) continue;
      if (d < best) best = d;
    }
    return best;
  };
  // wedge bounding box
  const reach = tier === 'high' ? 3600 : tier === 'medium' ? 3000 : 2300;
  let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
  for (const v of views) for (const a of [-0.8, 0, 0.8]) {
    const c = Math.cos(a), s = Math.sin(a);
    const fx = v.fx * c - v.fz * s, fz = v.fx * s + v.fz * c;
    for (const d of [0, reach]) { const x = v.x + fx * d, z = v.z + fz * d; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); }
  }
  // the last poses (the frames the film holds on): villages go where they will be seen
  const late = views.slice(Math.max(0, views.length - 7), views.length - 3);
  const lateDist = (x: number, z: number) => {
    let best = 1e9;
    for (const v of late) {
      const dx = x - v.x, dz = z - v.z, d = Math.hypot(dx, dz);
      if (d > 1 && (dx * v.fx + dz * v.fz) / d > 0.86 && d < best) best = d;
    }
    return best;
  };
  const humid = (x: number, z: number) => 1 - THREE.MathUtils.smoothstep(maskAt(x, z, 0), 0.3, 0.5);
  const sd = new THREE.Vector2(-o.sunDir.x, -o.sunDir.z).normalize(); // shadows fall this way
  const tanE = Math.max(0.035, o.sunDir.y / Math.hypot(o.sunDir.x, o.sunDir.z));
  let triangles = 0;

  // ---------------------------------------------------------------- hamlets on the hilltops
  const houses: { x: number; z: number; w: number; d: number; h: number; yaw: number; kind: 0 | 1 }[] = [];
  const villages: { x: number; z: number; r: number }[] = [];
  {
    const cands: { x: number; z: number; h: number }[] = [];
    const st = 150;
    for (let x = bx0; x <= bx1 + 3000; x += st) for (let z = bz0 - 1000; z <= bz1 + 1000; z += st) {
      const d = lateDist(x, z);
      if (d < 650 || d > 6500) continue;
      if (humid(x, z) < 0.6) continue;
      const h = o.dem(x, z);
      let top = true;
      for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) if (o.dem(x + ax * 260, z + az * 260) > h + 1) { top = false; break; }
      if (top && slopeAt(x, z) < 0.18) cands.push({ x, z, h });
    }
    cands.sort((a, b) => b.h - a.h);
    const maxV = tier === 'high' ? 7 : tier === 'medium' ? 5 : 4;
    for (const hm of o.hamlets ?? []) villages.push({ ...hm });
    for (const c of cands) {
      if (villages.length >= maxV) break;
      if (villages.some((v) => Math.hypot(v.x - c.x, v.z - c.z) < 1500)) continue;
      villages.push({ x: c.x, z: c.z, r: 55 + rnd() * 45 });
    }
    for (const v of villages) {
      // a ring of houses whose back walls make the perimeter, a few inside, courtyard walls between
      const nRing = Math.round(v.r / 4.2);
      for (let i = 0; i < nRing; i++) {
        const a = (i / nRing) * Math.PI * 2 + rnd() * 0.08;
        const rr = v.r * (0.92 + rnd() * 0.12);
        const x = v.x + Math.cos(a) * rr, z = v.z + Math.sin(a) * rr;
        if (rnd() < 0.12) continue; // gaps: lanes, the gate, a ruin
        houses.push({ x, z, w: 7 + rnd() * 4, d: 9 + rnd() * 4, h: 2.7 + rnd() * 0.7, yaw: -a + Math.PI / 2, kind: 0 });
      }
      const nIn = Math.round(v.r * v.r * 0.0016);
      for (let i = 0; i < nIn; i++) {
        const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * v.r * 0.7;
        const x = v.x + Math.cos(a) * rr, z = v.z + Math.sin(a) * rr;
        if (houses.some((q) => Math.hypot(q.x - x, q.z - z) < 10)) continue;
        houses.push({ x, z, w: 7 + rnd() * 4, d: 8 + rnd() * 4, h: 2.6 + rnd() * 0.8, yaw: rnd() * Math.PI, kind: 0 });
        // its courtyard wall
        houses.push({ x: x + Math.cos(a) * 7, z: z + Math.sin(a) * 7, w: 0.8, d: 8 + rnd() * 4, h: 1.2, yaw: rnd() * Math.PI, kind: 1 });
      }
    }
    if (houses.length) {
      // a box with a clay roof (top face) and fieldstone sides (vertex colours), base below the ground
      const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      const col = new Float32Array(g.getAttribute('position').count * 3);
      const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
      const roof = new THREE.Color(0x8d7c64).convertSRGBToLinear(), wall = new THREE.Color(0xc9bda4).convertSRGBToLinear();
      for (let i = 0; i < nrm.count; i++) { const c = nrm.getY(i) > 0.5 ? roof : wall; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const land = new Float32Array(houses.length * 2);
      g.setAttribute('aLand', new THREE.InstancedBufferAttribute(land, 2));
      const mat = dressMaterial({ vertexColors: true, roughness: 0.92, mist: o.mist, fog: o.fog });
      const im = new THREE.InstancedMesh(g, mat, houses.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
      houses.forEach((hh, i) => {
        const cs = Math.cos(hh.yaw), sn = Math.sin(hh.yaw);
        let lo = 1e9, hi = -1e9;
        for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
          const lx = a * hh.w, lz = b * hh.d;
          const y = o.ground(hh.x + lx * cs + lz * sn, hh.z - lx * sn + lz * cs);
          lo = Math.min(lo, y); hi = Math.max(hi, y);
        }
        const base = lo - 1.2;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hh.yaw);
        p.set(hh.x, base, hh.z);
        sc.set(hh.w, hi - base + hh.h, hh.d);
        im.setMatrixAt(i, m4.compose(p, q, sc));
        const t = 0.86 + rnd() * 0.22;
        im.setColorAt(i, c.setRGB(t, t * (0.97 + rnd() * 0.04), t * (0.93 + rnd() * 0.06)));
        land[i * 2] = sunVis(hh.x, hh.z);
        land[i * 2 + 1] = maskAt(hh.x, hh.z, 2);
      });
      im.frustumCulled = false;
      im.name = 'land:hamlets';
      group.add(im);
      disposables.push(g, mat);
      triangles += houses.length * 12;
    }
  }
  const inVillage = (x: number, z: number, pad = 0) => villages.some((v) => Math.hypot(v.x - x, v.z - z) < v.r + pad);

  // ---------------------------------------------------------------- terrace walls along the contours
  let nWalls = 0;
  {
    const range = tier === 'high' ? 2300 : tier === 'medium' ? 1800 : 1200;
    const cell = tier === 'low' ? 16 : 12;
    const segs: number[] = []; // x0,z0,x1,z1
    const val = (x: number, z: number) => (o.ground(x, z) / TERRACE_STEP) + terraceWobble(x, z);
    let wx0 = 1e9, wx1 = -1e9, wz0 = 1e9, wz1 = -1e9;
    for (const v of views) for (const a of [-0.8, 0, 0.8]) {
      const c = Math.cos(a), s = Math.sin(a);
      const fx = v.fx * c - v.fz * s, fz = v.fx * s + v.fz * c;
      for (const d of [0, range]) { const x = v.x + fx * d, z = v.z + fz * d; wx0 = Math.min(wx0, x); wx1 = Math.max(wx1, x); wz0 = Math.min(wz0, z); wz1 = Math.max(wz1, z); }
    }
    const nx = Math.ceil((wx1 - wx0) / cell), nz = Math.ceil((wz1 - wz0) / cell);
    const V = new Float32Array((nx + 1) * (nz + 1));
    const ok = new Uint8Array(nx * nz);
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) V[j * (nx + 1) + i] = val(wx0 + i * cell, wz0 + j * cell);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = wx0 + (i + 0.5) * cell, z = wz0 + (j + 0.5) * cell;
      const d = viewDist(x, z, 0.62);
      if (d > range || d < 120) continue;
      const hm = humid(x, z);
      if (hm < 0.5) continue;
      const sl = slopeAt(x, z);
      if (sl < 0.06 || sl > 0.55) continue;
      if (inVillage(x, z, 8)) continue;
      // broken walls, field boundaries, patches of garrigue left unterraced
      if (fbm2(x * 0.004, z * 0.004) < 0.5) continue;
      if (fbm2(x * 0.017 + 4.1, z * 0.017 + 2.3) < 0.36) continue; // collapsed stretches
      ok[j * nx + i] = 1;
    }
    const edgePt = (x0: number, z0: number, v0: number, x1: number, z1: number, v1: number, L: number): [number, number] => {
      const t = (L - v0) / (v1 - v0);
      return [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t];
    };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      if (!ok[j * nx + i]) continue;
      const x0 = wx0 + i * cell, z0 = wz0 + j * cell, x1 = x0 + cell, z1 = z0 + cell;
      const a = V[j * (nx + 1) + i], b = V[j * (nx + 1) + i + 1], c = V[(j + 1) * (nx + 1) + i + 1], d = V[(j + 1) * (nx + 1) + i];
      const lo = Math.ceil(Math.min(a, b, c, d)), hi = Math.floor(Math.max(a, b, c, d));
      for (let L = lo; L <= hi; L++) {
        const pts: [number, number][] = [];
        if ((a < L) !== (b < L)) pts.push(edgePt(x0, z0, a, x1, z0, b, L));
        if ((b < L) !== (c < L)) pts.push(edgePt(x1, z0, b, x1, z1, c, L));
        if ((c < L) !== (d < L)) pts.push(edgePt(x1, z1, c, x0, z1, d, L));
        if ((d < L) !== (a < L)) pts.push(edgePt(x0, z1, d, x0, z0, a, L));
        if (pts.length >= 2) segs.push(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
        if (pts.length === 4) segs.push(pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
      }
    }
    nWalls = segs.length / 4;
    if (nWalls > 0) {
      // a dry-stone wall: a thin box standing on the contour, its top 0.5-0.9 m above the rendered ground on the
      // uphill side (retaining the tread), the face 1-1.6 m on the downhill side; it sinks into the ground past
      // its range (vertex shader), where the terrain shader's terrace lines take over
      const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      const land = new Float32Array(nWalls * 2);
      g.setAttribute('aLand', new THREE.InstancedBufferAttribute(land, 2));
      const mat = dressMaterial({ color: 0x9a907f, roughness: 0.95, mist: o.mist, fog: o.fog });
      const uRange = { value: new THREE.Vector2(range * 0.78, range) };
      const base = mat.onBeforeCompile;
      mat.onBeforeCompile = (s, r) => {
        base.call(mat, s, r);
        s.uniforms.uWallRange = uRange;
        s.vertexShader = s.vertexShader
          .replace('#include <common>', '#include <common>\nuniform vec2 uWallRange;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            {
              vec3 wc = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
              float k = 1.0 - smoothstep(uWallRange.x, uWallRange.y, length(wc - cameraPosition));
              transformed.y = mix(0.0, transformed.y, k);
            }`);
      };
      mat.customProgramCacheKey = () => 'land-dress-wall-1';
      const im = new THREE.InstancedMesh(g, mat, nWalls);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < nWalls; i++) {
        const xa = segs[i * 4], za = segs[i * 4 + 1], xb = segs[i * 4 + 2], zb = segs[i * 4 + 3];
        const len = Math.hypot(xb - xa, zb - za) + 0.6;
        const xm = (xa + xb) / 2, zm = (za + zb) / 2;
        const ya = o.ground(xa, za), yb = o.ground(xb, zb), ym = o.ground(xm, zm);
        const lo = Math.min(ya, yb, ym);
        const hi = Math.max(ya, yb, ym);
        const top = hi + 0.35 + hash2(xm, zm) * 0.35;
        q.setFromAxisAngle(up, -Math.atan2(zb - za, xb - xa));
        p.set(xm, lo - 0.9, zm);
        sc.set(len, top - (lo - 0.9), 0.75);
        im.setMatrixAt(i, m4.compose(p, q, sc));
        const t = 0.82 + hash2(xm * 0.1, zm * 0.1) * 0.3;
        im.setColorAt(i, c.setRGB(t, t * 0.97, t * 0.92));
        land[i * 2] = sunVis(xm, zm);
        land[i * 2 + 1] = maskAt(xm, zm, 2);
      }
      im.frustumCulled = false;
      im.name = 'land:terrace-walls';
      group.add(im);
      disposables.push(g, mat);
      triangles += nWalls * 12;
    }
  }

  // ---------------------------------------------------------------- olive groves (+ long dawn shadows)
  let nOl = 0;
  {
    const cell = 8.5;
    const maxN = Math.round(46000 * K);
    const pts: number[] = []; // x, z, r, vis
    for (let x = bx0; x < bx1; x += cell) {
      for (let z = bz0; z < bz1; z += cell) {
        const px = x + (hash2(x, z) - 0.5) * cell * 0.8, pz = z + (hash2(z, x) - 0.5) * cell * 0.8;
        const d = viewDist(px, pz, 0.64);
        if (d > reach || d < 90) continue;
        const hm = humid(px, pz);
        if (hm < 0.4) continue;
        // groves: patches around the hamlets and on gentle terraced slopes; garrigue and bare rock elsewhere
        const gn = fbm2(px * 0.0042 + 3.3, pz * 0.0042 + 1.1);
        let near = 0;
        for (const v of villages) near = Math.max(near, 1 - THREE.MathUtils.smoothstep(Math.hypot(v.x - px, v.z - pz), v.r + 30, v.r + 700));
        for (const g of o.groves ?? []) near = Math.max(near, 1.3 * (1 - THREE.MathUtils.smoothstep(Math.hypot(g.x - px, g.z - pz), g.r * 0.5, g.r)));
        const dens = THREE.MathUtils.smoothstep(gn + near * 0.35, 0.5, 0.64) * hm;
        if (dens <= 0) continue;
        const sl = slopeAt(px, pz);
        if (sl > 0.5) continue;
        if (inVillage(px, pz, 6)) continue;
        // thinner with distance (they turn into the shader's grove dots)
        const far = THREE.MathUtils.smoothstep(d, reach * 0.55, reach);
        if (hash2(px * 1.7, pz * 1.3) > dens * (1 - far * 0.65) * K * 1.05) continue;
        pts.push(px, pz, 2.2 + hash2(px * 3.1, pz * 2.7) * 1.4, sunVis(px, pz));
      }
    }
    if (pts.length / 4 > maxN) {
      // keep the nearest trees, thin the rest uniformly to the tier budget
      const n0 = pts.length / 4;
      const keep = maxN / n0;
      const out: number[] = [];
      for (let i = 0; i < n0; i++) if (hash2(pts[i * 4] * 0.37, pts[i * 4 + 1] * 0.61) < keep) out.push(pts[i * 4], pts[i * 4 + 1], pts[i * 4 + 2], pts[i * 4 + 3]);
      pts.length = 0;
      for (let i = 0; i < Math.min(out.length, maxN * 4); i++) pts.push(out[i]);
    }
    nOl = pts.length / 4;
    if (nOl > 0) {
      let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 0);
      g.deleteAttribute('uv');
      g = mergeVertices(g);
      g.computeVertexNormals();
      const land = new Float32Array(nOl * 2);
      g.setAttribute('aLand', new THREE.InstancedBufferAttribute(land, 2));
      const mat = dressMaterial({ color: 0x5d6446, roughness: 0.9, mist: o.mist, fog: o.fog });
      const im = new THREE.InstancedMesh(g, mat, nOl);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
      const up = new THREE.Vector3(0, 1, 0);
      // shadows: one quad per sunlit tree from its foot away from the sun, draped on the rendered ground
      const sp: number[] = [], su: number[] = [], si: number[] = [];
      for (let i = 0; i < nOl; i++) {
        const x = pts[i * 4], z = pts[i * 4 + 1], r = pts[i * 4 + 2], vis = pts[i * 4 + 3];
        const y = o.ground(x, z);
        const hgt = r * 0.95;
        q.setFromAxisAngle(up, hash2(x, z) * 6.28);
        p.set(x, y + r * 0.55 + 0.4, z);
        sc.set(r, hgt, r * (0.85 + hash2(z, x) * 0.3));
        im.setMatrixAt(i, m4.compose(p, q, sc));
        const t = 0.8 + hash2(x * 0.3, z * 0.7) * 0.35;
        im.setColorAt(i, c.setRGB(t, t * (0.96 + hash2(x, 1.0) * 0.08), t * 0.9));
        land[i * 2] = vis;
        land[i * 2 + 1] = maskAt(x, z, 2);
        if (vis > 0.35) {
          const L = Math.min(55, (r * 1.2 + 0.8) / tanE);
          const wv = r * 0.95;
          const ex = x + sd.x * L, ez = z + sd.y * L;
          const nxp = -sd.y * wv, nzp = sd.x * wv;
          const k0 = sp.length / 3;
          for (const [px, pz, uu, vv] of [[x + nxp, z + nzp, 0, -1], [x - nxp, z - nzp, 0, 1], [ex - nxp * 0.7, ez - nzp * 0.7, 1, 1], [ex + nxp * 0.7, ez + nzp * 0.7, 1, -1]] as const) {
            sp.push(px, o.ground(px, pz) + 0.25, pz);
            su.push(uu, vv * vis);
          }
          si.push(k0, k0 + 1, k0 + 2, k0, k0 + 2, k0 + 3);
        }
      }
      im.frustumCulled = false;
      im.name = 'land:olives';
      group.add(im);
      disposables.push(g, mat);
      triangles += nOl * 20;
      if (si.length) {
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
        sg.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2));
        sg.setIndex(sp.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(si, 1) : new THREE.Uint16BufferAttribute(si, 1));
        const smat = new THREE.ShaderMaterial({
          name: 'LandTreeShadows',
          uniforms: { ...landAtmo, ...cloudShared },
          transparent: true, depthWrite: false, premultipliedAlpha: true,
          blending: THREE.MultiplyBlending,
          polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
          vertexShader: /* glsl */ `
            varying vec2 vUv; varying vec3 vW; varying float vCloud;
            uniform vec3 uSunDirA;
            ${GLSL_NOISE}
            ${GLSL_CLOUD_WEATHER}
            void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vCloud = cloudShadow(vW); gl_Position = projectionMatrix * viewMatrix * w; }`,
          fragmentShader: /* glsl */ `
            varying vec2 vUv; varying vec3 vW; varying float vCloud;
            ${GLSL_LAND_HAZE}
            void main(){
              float across = abs(vUv.y) / max(1e-3, 1.0 - vUv.x * 0.3);
              float a = (1.0 - smoothstep(0.55, 1.0, across)) * (1.0 - smoothstep(0.55, 1.0, vUv.x)) * smoothstep(0.0, 0.08, vUv.x + 0.04);
              a *= 0.62 * vCloud * (1.0 - landFog(cameraPosition, vW));
              gl_FragColor = vec4(vec3(1.0 - a * 0.85, 1.0 - a * 0.8, 1.0 - a * 0.7), 1.0);
            }`,
        });
        const sm = new THREE.Mesh(sg, smat);
        sm.frustumCulled = false;
        sm.renderOrder = 1;
        sm.name = 'land:olive-shadows';
        group.add(sm);
        disposables.push(sg, smat);
        triangles += si.length / 3;
      }
    }
  }

  return {
    group, triangles, counts: { olives: nOl, walls: nWalls, houses: houses.length },
    dispose() { for (const d of disposables) d.dispose(); disposables.length = 0; },
  };
}

/** Read judah_dress.webp (opaque RGB, so a 2D-canvas read is exact) for the CPU placement. */
export async function loadDressMask(url: string, tile: { x0: number; z0: number; x1: number; z1: number }): Promise<JudahDressInput['mask']> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  return { w: c.width, h: c.height, x0: tile.x0, z0: tile.z0, dx: (tile.x1 - tile.x0) / (c.width - 1), dz: (tile.z1 - tile.z0) / (c.height - 1), data };
}
