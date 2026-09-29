import * as THREE from 'three';
import { clamp, Simplex2 } from '../core/noise';
import { NEAR_HALF } from './Layout';
import { rockGeometry, triCount } from './RockGen';
import { TERRACE_STEP, type ShadowCaster, type Terrain } from './Terrain';
import type { TextureSet } from './Textures';
import { perTier, type WorldTier } from './WorldQuality';

const NW = new Simplex2(9091);
const FOOT = 0.86; // riser foot inside a terrace step (see Terrain.terraceProfile)

/**
 * Dry-stone terrace walls (טרסות / מדרגות) built along the exact contours of the terraced slopes.
 *
 * Two layers:
 *  - a "ribbon": one merged mesh with a battered front face (foot of the riser -> top of the upper tread) and a
 *    rubble-filled top strip back to the tread, textured with the dry-stone wall set. Cheap, drawn at any distance,
 *    it turns the terrain's soft risers into crisp, stepped walls with a lit top and a shaded face.
 *  - real stones: instanced limestone blocks laid in courses on the face, capstones on top, collapsed stretches
 *    with rubble at the foot. Generated lazily per 48 m chunk only near the camera (bounded memory / triangles);
 *    they shrink into the ribbon as they leave the detail radius (no popping).
 */
export class TerraceWalls {
  readonly group = new THREE.Group();
  readonly shadowCasters: ShadowCaster[] = [];
  triangles = 0;
  length = 0;
  stones = 0;
  /** wall segments per 48 m chunk (13 floats each), turned into stones only near the camera */
  private chunkSegs = new Map<number, number[]>();
  private built = new Map<number, THREE.InstancedMesh>();
  private detailR: number;
  private stoneMat: THREE.MeshStandardMaterial;
  private variants: THREE.BufferGeometry[] = [];
  private lastCam = new THREE.Vector3(1e9, 0, 1e9);
  private stoneStep: number;

  constructor(private terrain: Terrain, private tex: TextureSet, baseStoneMat: THREE.MeshStandardMaterial, private tier: WorldTier) {
    void baseStoneMat;
    this.detailR = perTier(tier, 40, 65, 85);
    this.stoneStep = perTier(tier, 0.85, 0.7, 0.62);
    this.stoneMat = wallStoneMaterial(tex, this.detailR);
  }

  build(rnd: () => number, clear: (x: number, z: number, r: number) => boolean) {
    const t = this.terrain;
    const n = t.nearN, sp = t.nearSpacing;
    const pre = t.preHeights;
    const masks = t.masks;
    const S = TERRACE_STEP;
    // ------------------------------------------------------------------ 1. contour segments (marching squares)
    const segs: number[] = []; // x0,z0,x1,z1
    const lvl = (v: number) => v - FOOT * S;
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const k00 = j * n + i, k10 = k00 + 1, k01 = k00 + n, k11 = k01 + 1;
        const tm = (masks[k00 * 4] + masks[k10 * 4] + masks[k01 * 4] + masks[k11 * 4]) * 0.25;
        if (tm < 0.3) continue;
        const v00 = pre[k00], v10 = pre[k10], v01 = pre[k01], v11 = pre[k11];
        const lo = Math.min(v00, v10, v01, v11), hi = Math.max(v00, v10, v01, v11);
        const kmin = Math.ceil(lvl(lo) / S), kmax = Math.floor(lvl(hi) / S);
        for (let k = kmin; k <= kmax; k++) {
          const L = (k + FOOT) * S;
          const x0 = -NEAR_HALF + i * sp, z0 = -NEAR_HALF + j * sp;
          const pts: number[] = [];
          const edge = (a: number, b: number, ax: number, az: number, bx: number, bz: number) => {
            if ((a - L) * (b - L) < 0) {
              const f = (L - a) / (b - a);
              pts.push(ax + (bx - ax) * f, az + (bz - az) * f);
            }
          };
          edge(v00, v10, x0, z0, x0 + sp, z0);
          edge(v10, v11, x0 + sp, z0, x0 + sp, z0 + sp);
          edge(v11, v01, x0 + sp, z0 + sp, x0, z0 + sp);
          edge(v01, v00, x0, z0 + sp, x0, z0);
          if (pts.length === 4) segs.push(pts[0], pts[1], pts[2], pts[3]);
          else if (pts.length === 8) segs.push(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
        }
      }
    }

    // ------------------------------------------------------------------ 2. per-endpoint wall profile
    const prof = (x: number, z: number) => {
      const e = sp * 0.5;
      const gx = (t.preHeightAt(x + e, z) - t.preHeightAt(x - e, z)) / (2 * e);
      const gz = (t.preHeightAt(x, z + e) - t.preHeightAt(x, z - e)) / (2 * e);
      const gl = Math.hypot(gx, gz) || 1e-3;
      const ux = gx / gl, uz = gz / gl; // uphill
      const w = clamp(((1 - FOOT) * S) / gl, 0.6, 5);
      const hFoot = t.heightAt(x, z);
      const tx = x + ux * w, tz = z + uz * w;
      const hTop = t.heightAt(tx, tz);
      return { ux, uz, w, hFoot, hTop, H: hTop - hFoot, tx, tz };
    };

    const pos: number[] = [];
    const nor: number[] = [];
    const idx: number[] = [];
    const pushQuad = (a: number[], b: number[], c: number[], d: number[]) => {
      // a-b bottom edge, d-c top edge (counter-clockwise when seen from the front)
      const base = pos.length / 3;
      pos.push(...a, ...b, ...c, ...d);
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      for (let q = 0; q < 4; q++) nor.push(nx, ny, nz);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    const CH = TerraceWalls.CH;
    for (let s = 0; s < segs.length; s += 4) {
      const x0 = segs[s], z0 = segs[s + 1], x1 = segs[s + 2], z1 = segs[s + 3];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.05) continue;
      const p0 = prof(x0, z0), p1 = prof(x1, z1);
      if (p0.H < 0.3 && p1.H < 0.3) continue;
      if (!clear((x0 + x1) / 2, (z0 + z1) / 2, 1)) continue;
      this.length += len;
      // orientation: the face must look downhill (-u)
      let ax = x0, az = z0, bx = x1, bz = z1, pa = p0, pb = p1;
      const dx = x1 - x0, dz = z1 - z0;
      if (dz * -p0.ux + -dx * -p0.uz < 0) {
        ax = x1; az = z1; bx = x0; bz = z0; pa = p1; pb = p0;
      }
      const ha = Math.max(pa.H, 0.2), hb = Math.max(pb.H, 0.2);
      // front face: buried foot -> battered top
      const A0 = [ax - pa.ux * 0.14, pa.hFoot - 0.3, az - pa.uz * 0.14];
      const B0 = [bx - pb.ux * 0.14, pb.hFoot - 0.3, bz - pb.uz * 0.14];
      const A1 = [ax + pa.ux * 0.12, pa.hFoot + ha + 0.07, az + pa.uz * 0.12];
      const B1 = [bx + pb.ux * 0.12, pb.hFoot + hb + 0.07, bz + pb.uz * 0.12];
      pushQuad(A0, B0, B1, A1);
      // top: rubble fill back to the upper tread
      const cw = 0.25;
      const A2 = [pa.tx + pa.ux * cw, t.heightAt(pa.tx + pa.ux * cw, pa.tz + pa.uz * cw) + 0.04, pa.tz + pa.uz * cw];
      const B2 = [pb.tx + pb.ux * cw, t.heightAt(pb.tx + pb.ux * cw, pb.tz + pb.uz * cw) + 0.04, pb.tz + pb.uz * cw];
      pushQuad(A1, B1, B2, A2);
      // remember the segment for the stone chunks
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const key = this.key(mx, mz);
      let list = this.chunkSegs.get(key);
      if (!list) this.chunkSegs.set(key, (list = []));
      list.push(ax, az, bx, bz, pa.ux, pa.uz, pb.ux, pb.uz, pa.hFoot, pb.hFoot, ha, hb, pa.w);
      // keep grass off the wall top
      t.suppressGrass(mx + (pa.ux + pb.ux) * 0.25 * pa.w, mz + (pa.uz + pb.uz) * 0.25 * pa.w, Math.max(1.2, len * 0.6), 0.6);
    }
    void rnd;
    void CH;

    // ------------------------------------------------------------------ 3. meshes
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const ribbon = new THREE.Mesh(g, wallRibbonMaterial(this.tex));
    ribbon.name = 'terrace-walls';
    ribbon.castShadow = true;
    ribbon.receiveShadow = true;
    this.group.add(ribbon);
    this.triangles += idx.length / 3;

    const detail = 1;
    this.variants = [rockGeometry(71, { kind: 'block', detail }), rockGeometry(72, { kind: 'stone', detail }), rockGeometry(73, { kind: 'block', detail })];
    // a tiny always-rendered helper streams the stone chunks in and out around the camera
    const helper = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    helper.geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    helper.geometry.setDrawRange(0, 0);
    helper.frustumCulled = false;
    helper.name = 'terrace-walls-lod';
    helper.onBeforeRender = (_r, _s, cam) => {
      if ((cam as THREE.PerspectiveCamera).isPerspectiveCamera) this.update(cam.position);
    };
    this.group.add(helper);
  }

  static readonly CH = 48;

  private key(x: number, z: number) {
    const CH = TerraceWalls.CH;
    const cx = clamp(Math.floor((x + NEAR_HALF) / CH), 0, 63), cz = clamp(Math.floor((z + NEAR_HALF) / CH), 0, 63);
    return cz * 64 + cx;
  }

  /** Build stone chunks near `p`, drop far ones. Cheap when the camera stays in place. */
  update(p: THREE.Vector3) {
    const moved = Math.hypot(p.x - this.lastCam.x, p.z - this.lastCam.z);
    if (moved < 2 && this.lastCam.y === 1) return;
    const jump = moved > 30;
    this.lastCam.set(p.x, 1, p.z);
    const CH = TerraceWalls.CH;
    const need = this.detailR + CH * 0.72;
    const drop = this.detailR + CH * 1.6;
    let budget = jump ? 1000 : 2;
    for (const [key, mesh] of this.built) {
      const cx = -NEAR_HALF + ((key % 64) + 0.5) * CH, cz = -NEAR_HALF + (Math.floor(key / 64) + 0.5) * CH;
      const d = Math.hypot(cx - p.x, cz - p.z);
      mesh.visible = d < need;
      if (d > drop) {
        this.group.remove(mesh);
        mesh.dispose();
        this.built.delete(key);
      }
    }
    // nearest chunks first
    const want: { key: number; d: number }[] = [];
    for (const key of this.chunkSegs.keys()) {
      if (this.built.has(key)) continue;
      const cx = -NEAR_HALF + ((key % 64) + 0.5) * CH, cz = -NEAR_HALF + (Math.floor(key / 64) + 0.5) * CH;
      const d = Math.hypot(cx - p.x, cz - p.z);
      if (d < need) want.push({ key, d });
    }
    want.sort((a, b) => a.d - b.d);
    for (const w of want) {
      if (budget-- <= 0) {
        this.lastCam.y = 0; // keep streaming next frame
        break;
      }
      const mesh = this.buildChunk(w.key);
      if (mesh) {
        this.built.set(w.key, mesh);
        this.group.add(mesh);
      }
    }
  }

  private buildChunk(key: number): THREE.InstancedMesh | null {
    const segs = this.chunkSegs.get(key);
    if (!segs) return null;
    const t = this.terrain;
    const rnd = mulberry(key * 7331 + 17);
    const mats: THREE.Matrix4[] = [];
    const tmpQ = new THREE.Quaternion();
    const tmpE = new THREE.Euler();
    const courseH = 0.42;
    const stoneStep = this.stoneStep;
    for (let s = 0; s < segs.length; s += 13) {
      const ax = segs[s], az = segs[s + 1], bx = segs[s + 2], bz = segs[s + 3];
      const paux = segs[s + 4], pauz = segs[s + 5], pbux = segs[s + 6], pbuz = segs[s + 7];
      const hfa = segs[s + 8], hfb = segs[s + 9], ha = segs[s + 10], hb = segs[s + 11];
      const len = Math.hypot(bx - ax, bz - az);
      const dirx = (bx - ax) / len, dirz = (bz - az) / len;
      const yaw = Math.atan2(-dirz, dirx);
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const collapse = NW.noise(mx / 23, mz / 23) * 0.6 + NW.noise(mx / 7, mz / 7) * 0.4; // > 0.45: tumbled
      const Hm = (ha + hb) / 2;
      const courses = Math.max(1, Math.round(Hm / courseH));
      const ch = Hm / courses;
      for (let c = 0; c < courses; c++) {
        if (collapse > 0.45 && c >= Math.max(1, courses - 2)) continue;
        let u = (rnd() - 0.2) * stoneStep;
        while (u < len) {
          const sl = stoneStep * (0.75 + rnd() * 0.6);
          const uc = Math.min(len, u + sl * 0.5);
          const f = uc / len;
          const px = ax + dirx * uc, pz = az + dirz * uc;
          const ux = paux + (pbux - paux) * f, uz = pauz + (pbuz - pauz) * f;
          const hf = hfa + (hfb - hfa) * f;
          const y = hf - 0.12 + (c + 0.5) * ch;
          const sx = sl * (0.62 + rnd() * 0.18), sy = ch * (0.62 + rnd() * 0.35), sz = 0.34 + rnd() * 0.25;
          tmpE.set((rnd() - 0.5) * 0.15, yaw + (rnd() - 0.5) * 0.35, (rnd() - 0.5) * 0.18);
          tmpQ.setFromEuler(tmpE);
          const out = 0.05 - c * 0.05 + (rnd() - 0.5) * 0.06; // proud of the (battered) ribbon face
          mats.push(new THREE.Matrix4().compose(new THREE.Vector3(px - ux * out, y, pz - uz * out), tmpQ, new THREE.Vector3(sx, sy, sz)));
          u += sl;
        }
      }
      if (collapse <= 0.45) {
        // capstones (flatter, set on the top edge)
        let u = rnd() * 0.3;
        while (u < len) {
          const sl = 0.42 + rnd() * 0.4;
          const uc = Math.min(len, u + sl * 0.5);
          const f = uc / len;
          const ux = paux + (pbux - paux) * f, uz = pauz + (pbuz - pauz) * f;
          const px = ax + dirx * uc + ux * 0.18, pz = az + dirz * uc + uz * 0.18;
          const y = hfa + (hfb - hfa) * f + Hm + 0.05;
          tmpE.set((rnd() - 0.5) * 0.25, yaw + (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.25);
          tmpQ.setFromEuler(tmpE);
          mats.push(new THREE.Matrix4().compose(new THREE.Vector3(px, y, pz), tmpQ, new THREE.Vector3(sl * 0.55, 0.12 + rnd() * 0.08, 0.3 + rnd() * 0.15)));
          u += sl * (0.9 + rnd() * 0.5);
        }
      } else {
        // rubble spilled at the foot of a tumbled stretch
        const k = Math.floor(len * 1.6);
        for (let r = 0; r < k; r++) {
          const uc = rnd() * len;
          const out = 0.3 + rnd() * 1.1;
          const px = ax + dirx * uc - paux * out, pz = az + dirz * uc - pauz * out;
          const sz = 0.12 + rnd() * 0.25;
          tmpE.set(rnd() * 0.8, rnd() * 6.28, rnd() * 0.8);
          tmpQ.setFromEuler(tmpE);
          mats.push(new THREE.Matrix4().compose(new THREE.Vector3(px, t.heightAt(px, pz) - sz * 0.15, pz), tmpQ, new THREE.Vector3(sz * 1.3, sz, sz)));
        }
      }
    }
    if (!mats.length) return null;
    const geo = this.variants[key % this.variants.length];
    const im = new THREE.InstancedMesh(geo, this.stoneMat, mats.length);
    mats.forEach((m, k) => im.setMatrixAt(k, m));
    im.castShadow = this.tier !== 'low';
    im.receiveShadow = true;
    im.userData.noChunk = true; // streamed and toggled here
    im.userData.dynamic = true;
    im.name = 'wall-stones';
    im.computeBoundingSphere();
    this.stones += mats.length;
    return im;
  }

  /** Stones + triangles currently streamed in (diagnostics). */
  get streamed() {
    let stones = 0, tris = 0;
    for (const m of this.built.values()) {
      stones += m.count;
      tris += triCount(m.geometry) * m.count;
    }
    return { chunks: this.built.size, stones, tris };
  }
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Triplanar dry-stone wall material for the ribbon (face: wall texture, top: limestone rubble). */
function wallRibbonMaterial(tex: TextureSet) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (s) => {
    s.uniforms.tWall = { value: tex.wall };
    s.uniforms.tWallN = { value: tex.wallN };
    s.uniforms.tRock = { value: tex.rock };
    s.uniforms.tRockN = { value: tex.rockN };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vWWPos; varying vec3 vWWN;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
vWWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWWN = normalize(mat3(modelMatrix) * objectNormal);`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tWall, tWallN, tRock, tRockN; varying vec3 vWWPos; varying vec3 vWWN; vec3 wallWN; float wallAO;`)
      .replace(
        '#include <map_fragment>',
        `{
  vec3 Nw = normalize(vWWN);
  if (!gl_FrontFacing) Nw = -Nw;
  float top = smoothstep(0.55, 0.8, Nw.y);
  vec2 fuv = (abs(Nw.x) > abs(Nw.z) ? vWWPos.zy : vWWPos.xy) / 2.4;
  vec4 wa = texture2D(tWall, fuv); vec4 wn = texture2D(tWallN, fuv);
  vec4 ra = texture2D(tRock, vWWPos.xz / 1.6); vec4 rn = texture2D(tRockN, vWWPos.xz / 1.6);
  vec3 c = mix(wa.rgb, ra.rgb * vec3(0.86, 0.84, 0.8), top);
  // foot of the wall: soil and shade
  diffuseColor.rgb *= c;
  vec3 tw = wn.xyz * 2.0 - 1.0, tr = rn.xyz * 2.0 - 1.0;
  vec3 fn = abs(Nw.x) > abs(Nw.z) ? normalize(Nw + vec3(0.0, tw.y, tw.x * sign(Nw.x)) * 1.3) : normalize(Nw + vec3(tw.x * sign(Nw.z), tw.y, 0.0) * 1.3);
  vec3 tn = normalize(Nw + vec3(tr.x, 0.0, tr.y) * 1.1);
  wallWN = normalize(mix(fn, tn, top));
  wallAO = mix(wn.a, rn.a, top);
}`,
      )
      .replace('#include <normal_fragment_maps>', `normal = normalize((viewMatrix * vec4(wallWN, 0.0)).xyz);`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
reflectedLight.indirectDiffuse *= wallAO;
reflectedLight.directDiffuse *= mix(1.0, wallAO, 0.5);`);
  };
  mat.customProgramCacheKey = () => 'terrace-ribbon-v1';
  return mat;
}

/** Limestone for the wall stones, shrinking into the ribbon near the edge of the detail radius. */
function wallStoneMaterial(tex: TextureSet, detailR: number) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0 });
  mat.onBeforeCompile = (s) => {
    s.uniforms.tRock = { value: tex.rock };
    s.uniforms.tRockN = { value: tex.rockN };
    s.uniforms.uFadeR = { value: detailR };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uFadeR; attribute vec2 aRock;
varying vec3 vSWPos; varying vec3 vSWN; varying vec2 vSRock; varying float vSSeed;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
{
  vec3 io = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
  float fade = 1.0 - smoothstep(uFadeR * 0.72, uFadeR, distance(io.xz, cameraPosition.xz));
  transformed *= fade;
}
#endif`)
      .replace('#include <project_vertex>', `#include <project_vertex>
{
  vec4 wp = vec4(transformed, 1.0);
  vec3 wn = objectNormal;
  float seed = 0.0;
  #ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  wn = mat3(instanceMatrix) * wn;
  seed = fract(instanceMatrix[3].x * 0.137 + instanceMatrix[3].z * 0.211);
  #endif
  vSWPos = (modelMatrix * wp).xyz;
  vSWN = normalize(mat3(modelMatrix) * wn);
  vSRock = aRock;
  vSSeed = seed;
}`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tRock, tRockN; varying vec3 vSWPos; varying vec3 vSWN; varying vec2 vSRock; varying float vSSeed; vec3 stWN; float stAO;`)
      .replace(
        '#include <map_fragment>',
        `{
  vec3 Nw = normalize(vSWN);
  vec3 bw = pow(abs(Nw), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
  vec3 p = vSWPos / 1.7 + vSSeed * 5.3;
  vec4 ax = texture2D(tRock, p.zy), ay = texture2D(tRock, p.xz), az = texture2D(tRock, p.xy);
  vec4 nx = texture2D(tRockN, p.zy), ny = texture2D(tRockN, p.xz), nz = texture2D(tRockN, p.xy);
  vec3 c = ax.rgb * bw.x + ay.rgb * bw.y + az.rgb * bw.z;
  c *= mix(0.84, 1.04, vSSeed) * mix(vec3(1.0), vec3(1.04, 0.99, 0.9), step(0.7, fract(vSSeed * 7.0)));
  float cav = 1.0 - vSRock.x;
  c *= mix(1.0, cav, 0.6);
  c = mix(c, c * vec3(0.7, 0.58, 0.46), (1.0 - smoothstep(0.0, 0.3, vSRock.y)) * 0.35);
  diffuseColor.rgb *= c;
  vec3 tnx = nx.xyz * 2.0 - 1.0, tny = ny.xyz * 2.0 - 1.0, tnz = nz.xyz * 2.0 - 1.0;
  stWN = normalize(bw.x * normalize(Nw + vec3(0.0, tnx.y, tnx.x)) + bw.y * normalize(Nw + vec3(tny.x, 0.0, tny.y)) + bw.z * normalize(Nw + vec3(tnz.x, tnz.y, 0.0)));
  stAO = cav * mix(1.0, nx.a * bw.x + ny.a * bw.y + nz.a * bw.z, 0.8);
}`,
      )
      .replace('#include <normal_fragment_maps>', `normal = normalize((viewMatrix * vec4(stWN, 0.0)).xyz);`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
reflectedLight.indirectDiffuse *= stAO;
reflectedLight.directDiffuse *= mix(1.0, stAO, 0.4);`);
  };
  mat.customProgramCacheKey = () => 'wall-stone-v1-' + detailR;
  return mat;
}
