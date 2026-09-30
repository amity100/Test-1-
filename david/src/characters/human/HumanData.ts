import * as THREE from 'three';
import { gunzip } from './inflate';

/*
 * Runtime side of the MakeHuman pipeline (tools/human/build_human.py).
 *
 * rig.json  : skeleton (MakeHuman default rig, pruned), rest pose, face pose units, eyes, landmarks
 * human.binz: (gzip) control mesh (hm08 quads, welded positions, face-varying UVs, 8 skin weights / vertex),
 *             eyelash + eyebrow strand ribbons, tear lines, teeth and (for "man") variation morphs.
 *
 * The body is triangulated at load time ("base" tier, 14.5k render verts) or subdivided once with
 * Catmull-Clark (limit-projected, face-varying linear UVs, subdivided skin weights) for the "sub1"
 * hero tier (~56k verts) — so the hero geometry costs no extra download.
 */

export type BinType = 'int8' | 'uint8' | 'int16' | 'uint16' | 'uint32' | 'float32';
export interface BinEntry {
  offset: number;
  count: number;
  itemSize: number;
  type: BinType;
  normalized: boolean;
  quant?: { min: number[]; range: number[] };
}

export interface RigBone {
  n: string;
  p: number;
  h: [number, number, number];
  t: [number, number, number];
  r: [number, number, number, number];
}

export interface RigJson {
  version: number;
  preset: string;
  description: string;
  height: number;
  bones: RigBone[];
  poseunits: Record<string, Record<string, [number, number, number, number]>>;
  eyes: Record<'L' | 'R', { center: [number, number, number]; radius: number; bone: string; offset?: [number, number, number]; opening: [number, number, number][] }>;
  landmarks: {
    headTop: [number, number, number];
    chin: [number, number, number];
    noseTip: [number, number, number];
    crown: [number, number, number];
    crownRadius: [number, number];
  };
  skin: Record<string, unknown>;
  brows: { color?: [number, number, number]; density?: number; thickness?: number };
  irisStyle: { iris?: string; seed?: number };
  bin: { file: string; bytes: number; gzipBytes?: number; layout: Record<string, BinEntry> };
  variations: string[];
  strands?: Record<string, { strands: number; points: number }>;
  tierStats?: Record<string, { vertices: number; triangles: number }>;
}

type TA = Int8Array | Uint8Array | Int16Array | Uint16Array | Uint32Array | Float32Array;
const CTORS: Record<BinType, { new (b: ArrayBuffer, o: number, n: number): TA }> = {
  int8: Int8Array,
  uint8: Uint8Array,
  int16: Int16Array,
  uint16: Uint16Array,
  uint32: Uint32Array,
  float32: Float32Array,
};

export class HumanData {
  constructor(readonly rig: RigJson, readonly buf: ArrayBuffer) {}

  has(name: string) {
    return name in this.rig.bin.layout;
  }

  raw(name: string): TA {
    const e = this.rig.bin.layout[name];
    if (!e) throw new Error(`human.bin: missing ${name}`);
    return new CTORS[e.type](this.buf, e.offset, e.count * e.itemSize);
  }

  entry(name: string) {
    return this.rig.bin.layout[name];
  }

  /** Float data (dequantised / normalised). */
  float(name: string): Float32Array {
    const e = this.rig.bin.layout[name];
    const a = this.raw(name);
    if (a instanceof Float32Array) return a;
    const out = new Float32Array(a.length);
    if (e.quant) {
      const { min, range } = e.quant;
      const k = e.itemSize;
      for (let i = 0; i < a.length; i++) {
        const c = i % k;
        out[i] = min[c] + ((a[i] + 32768) / 65535) * range[c];
      }
    } else if (e.normalized) {
      const s = e.type === 'int8' ? 127 : e.type === 'uint8' ? 255 : e.type === 'int16' ? 32767 : e.type === 'uint16' ? 65535 : 1;
      for (let i = 0; i < a.length; i++) out[i] = Math.max(-1, a[i] / s);
    } else for (let i = 0; i < a.length; i++) out[i] = a[i];
    return out;
  }

  static async fetch(rigUrl: string, binUrl: string): Promise<HumanData> {
    const [rig, buf] = await Promise.all([
      fetch(rigUrl).then((r) => r.json() as Promise<RigJson>),
      fetch(binUrl).then((r) => r.arrayBuffer()).then(gunzip),
    ]);
    return new HumanData(rig, buf);
  }
}

// ------------------------------------------------------------------------------------------ body mesh
interface Control {
  pos: Float32Array; // welded control positions (xyz)
  quads: Uint32Array; // 4 per face
  quadsUV: Uint32Array;
  uv: Float32Array; // uv table
  skinI: Uint16Array; // K per position (K = SKIN_K)
  skinW: Float32Array;
  /** subdivided controls: sparse rows (new vertex <- control vertices) for re-subdividing morphed positions */
  stencil?: { rowStart: Uint32Array; cols: Uint32Array; wts: Float32Array; limit: boolean };
}

/** Bone influences per body vertex (MakeHuman's weights need up to 8 around the shoulders and hips). */
export const SKIN_K = 8;

/** Re-pack k influences per vertex into SKIN_K (zero padded) — assets baked with 4 still load. */
function repack(si: ArrayLike<number>, sw: Float32Array, k: number): [Uint16Array, Float32Array] {
  const n = sw.length / k;
  const I = new Uint16Array(n * SKIN_K);
  const W = new Float32Array(n * SKIN_K);
  const m = Math.min(k, SKIN_K);
  for (let v = 0; v < n; v++) {
    for (let j = 0; j < m; j++) {
      I[v * SKIN_K + j] = si[v * k + j];
      W[v * SKIN_K + j] = sw[v * k + j];
    }
  }
  return [I, W];
}

function controlMesh(d: HumanData, variation?: Record<string, number>): Control {
  const pos = d.float('mesh.position').slice();
  if (variation) {
    for (const [k, w] of Object.entries(variation)) {
      if (!w || !d.has(`var.${k}.position`)) continue;
      const dv = d.float(`var.${k}.position`);
      for (let i = 0; i < pos.length; i++) pos[i] += dv[i] * w;
    }
  }
  const q = d.raw('mesh.quads');
  const qt = d.raw('mesh.quadsUV');
  const [skinI, skinW] = repack(d.raw('mesh.skinIndex'), d.float('mesh.skinWeight'), d.entry('mesh.skinWeight').itemSize);
  return {
    pos,
    quads: Uint32Array.from(q),
    quadsUV: Uint32Array.from(qt),
    uv: d.float('mesh.uv'),
    skinI,
    skinW,
  };
}

/** Sum of the variation morph deltas at the control vertices (null when nothing applies). */
export function variationDelta(d: HumanData, variation?: Record<string, number>): Float32Array | null {
  if (!variation) return null;
  let out: Float32Array | null = null;
  for (const [k, w] of Object.entries(variation)) {
    if (!w || !d.has(`var.${k}.position`)) continue;
    const dv = d.float(`var.${k}.position`);
    if (!out) out = new Float32Array(dv.length);
    for (let i = 0; i < dv.length; i++) out[i] += dv[i] * w;
  }
  return out;
}

/**
 * For points near the skin (brow / lash strands, tear lines, teeth, the lid opening): the 3 nearest control
 * vertices of the base mesh with inverse-distance weights, so they can follow the variation morphs of the skin.
 */
export function skinNeighbours(d: HumanData, pts: ArrayLike<number>): { idx: Uint32Array; w: Float32Array } {
  const cp = d.float('mesh.position');
  const cell = 0.012;
  let grid = gridCache.get(d);
  if (!grid) {
    grid = new Map<number, number[]>();
    for (let i = 0; i < cp.length / 3; i++) {
      const k = hashCell(Math.floor(cp[i * 3] / cell), Math.floor(cp[i * 3 + 1] / cell), Math.floor(cp[i * 3 + 2] / cell));
      let l = grid.get(k);
      if (!l) grid.set(k, (l = []));
      l.push(i);
    }
    gridCache.set(d, grid);
  }
  const n = pts.length / 3;
  const idx = new Uint32Array(n * 3);
  const w = new Float32Array(n * 3);
  const best = [0, 0, 0], bd = [0, 0, 0];
  for (let p = 0; p < n; p++) {
    const x = pts[p * 3], y = pts[p * 3 + 1], z = pts[p * 3 + 2];
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    bd[0] = bd[1] = bd[2] = Infinity;
    for (let r = 1; r <= 6 && bd[2] === Infinity; r++) {
      for (let i = -r; i <= r; i++)
        for (let j = -r; j <= r; j++)
          for (let k = -r; k <= r; k++) {
            const l = grid.get(hashCell(cx + i, cy + j, cz + k));
            if (!l) continue;
            for (const v of l) {
              const dd = (cp[v * 3] - x) ** 2 + (cp[v * 3 + 1] - y) ** 2 + (cp[v * 3 + 2] - z) ** 2;
              if (dd >= bd[2] || v === best[0] || v === best[1]) continue;
              if (dd < bd[0]) {
                bd[2] = bd[1]; best[2] = best[1]; bd[1] = bd[0]; best[1] = best[0]; bd[0] = dd; best[0] = v;
              } else if (dd < bd[1]) {
                bd[2] = bd[1]; best[2] = best[1]; bd[1] = dd; best[1] = v;
              } else {
                bd[2] = dd; best[2] = v;
              }
            }
          }
    }
    let sum = 0;
    for (let q = 0; q < 3; q++) {
      const ww = bd[q] === Infinity ? 0 : 1 / (Math.sqrt(bd[q]) + 0.002);
      idx[p * 3 + q] = best[q];
      w[p * 3 + q] = ww;
      sum += ww;
    }
    for (let q = 0; q < 3; q++) w[p * 3 + q] /= sum || 1;
  }
  return { idx, w };
}
const gridCache = new WeakMap<HumanData, Map<number, number[]>>();
function hashCell(i: number, j: number, k: number) {
  return ((i + 512) * 1024 + (j + 512)) * 1024 + (k + 512);
}

/** Displace points by the skin's variation delta (see skinNeighbours). */
export function followSkin(pts: Float32Array, nb: { idx: Uint32Array; w: Float32Array }, delta: Float32Array) {
  const n = pts.length / 3;
  for (let p = 0; p < n; p++) {
    for (let q = 0; q < 3; q++) {
      const v = nb.idx[p * 3 + q], ww = nb.w[p * 3 + q];
      pts[p * 3] += delta[v * 3] * ww;
      pts[p * 3 + 1] += delta[v * 3 + 1] * ww;
      pts[p * 3 + 2] += delta[v * 3 + 2] * ww;
    }
  }
  return pts;
}

/** One Catmull-Clark level on a closed quad mesh (positions + sparse skin weights + face-varying UVs). */
function subdivide(c: Control, limit: boolean): Control {
  const F = c.quads.length / 4;
  const V = c.pos.length / 3;
  const T = c.uv.length / 2;
  // ---- edges
  const edgeMap = new Map<number, number>();
  const faceEdges = new Uint32Array(F * 4);
  const edgeV: number[] = [];
  const edgeF: number[] = [];
  for (let f = 0; f < F; f++) {
    for (let k = 0; k < 4; k++) {
      const a = c.quads[f * 4 + k], b = c.quads[f * 4 + ((k + 1) & 3)];
      const key = a < b ? a * V + b : b * V + a;
      let e = edgeMap.get(key);
      if (e === undefined) {
        e = edgeV.length / 2;
        edgeMap.set(key, e);
        edgeV.push(Math.min(a, b), Math.max(a, b));
        edgeF.push(f, -1);
      } else edgeF[e * 2 + 1] = f;
      faceEdges[f * 4 + k] = e;
    }
  }
  const E = edgeV.length / 2;
  const NV = V + E + F;
  // sparse stencil rows: for each new vertex a list of (src, weight)
  const rowStart = new Uint32Array(NV + 1);
  const cols: number[] = [];
  const wts: number[] = [];
  let r = 0;
  // vertex-face and vertex-edge adjacency
  const vFaces: number[][] = Array.from({ length: V }, () => []);
  for (let f = 0; f < F; f++) for (let k = 0; k < 4; k++) vFaces[c.quads[f * 4 + k]].push(f);
  const vEdges: number[][] = Array.from({ length: V }, () => []);
  for (let e = 0; e < E; e++) {
    vEdges[edgeV[e * 2]].push(e);
    vEdges[edgeV[e * 2 + 1]].push(e);
  }
  const acc = new Map<number, number>();
  const add = (i: number, w: number) => acc.set(i, (acc.get(i) ?? 0) + w);
  const flush = () => {
    for (const [i, w] of acc) {
      cols.push(i);
      wts.push(w);
    }
    acc.clear();
    rowStart[++r] = cols.length;
  };
  // vertex points
  for (let v = 0; v < V; v++) {
    const n = vEdges[v].length;
    const fs = vFaces[v];
    for (const f of fs) for (let k = 0; k < 4; k++) add(c.quads[f * 4 + k], 0.25 / fs.length / n);
    for (const e of vEdges[v]) {
      add(edgeV[e * 2], (2 * 0.5) / n / n);
      add(edgeV[e * 2 + 1], (2 * 0.5) / n / n);
    }
    add(v, (n - 3) / n);
    flush();
  }
  // edge points
  for (let e = 0; e < E; e++) {
    add(edgeV[e * 2], 0.25);
    add(edgeV[e * 2 + 1], 0.25);
    for (let s = 0; s < 2; s++) {
      const f = edgeF[e * 2 + s];
      for (let k = 0; k < 4; k++) add(c.quads[f * 4 + k], 0.25 * 0.25);
    }
    flush();
  }
  // face points
  for (let f = 0; f < F; f++) {
    for (let k = 0; k < 4; k++) add(c.quads[f * 4 + k], 0.25);
    flush();
  }
  const apply = (src: Float32Array, dim: number) => {
    const out = new Float32Array(NV * dim);
    for (let i = 0; i < NV; i++) {
      for (let j = rowStart[i]; j < rowStart[i + 1]; j++) {
        const s = cols[j] * dim, w = wts[j];
        for (let d = 0; d < dim; d++) out[i * dim + d] += src[s + d] * w;
      }
    }
    return out;
  };
  const pos = apply(c.pos, 3);
  // skin weights: accumulate sparse influences, keep the SKIN_K largest
  const K = SKIN_K;
  const skinI = new Uint16Array(NV * K);
  const skinW = new Float32Array(NV * K);
  const infl = new Map<number, number>();
  for (let i = 0; i < NV; i++) {
    infl.clear();
    for (let j = rowStart[i]; j < rowStart[i + 1]; j++) {
      const s = cols[j], w = wts[j];
      for (let k = 0; k < K; k++) {
        const bw = c.skinW[s * K + k];
        if (bw <= 0) continue;
        const b = c.skinI[s * K + k];
        infl.set(b, (infl.get(b) ?? 0) + bw * w);
      }
    }
    const list = [...infl.entries()].sort((a, b) => b[1] - a[1]).slice(0, K);
    let sum = 0;
    for (const [, w] of list) sum += w;
    list.forEach(([b, w], k) => {
      skinI[i * K + k] = b;
      skinW[i * K + k] = w / sum;
    });
  }
  // new quads (v_k, e_k, f, e_{k-1})
  const quads = new Uint32Array(F * 16);
  for (let f = 0; f < F; f++) {
    for (let k = 0; k < 4; k++) {
      const o = (f * 4 + k) * 4;
      quads[o] = c.quads[f * 4 + k];
      quads[o + 1] = V + faceEdges[f * 4 + k];
      quads[o + 2] = V + E + f;
      quads[o + 3] = V + faceEdges[f * 4 + ((k + 3) & 3)];
    }
  }
  // face-varying uvs (linear): old uvs, uv-edge midpoints, face centres
  const uvEdge = new Map<number, number>();
  const uvList: number[] = Array.from(c.uv);
  const quadsUV = new Uint32Array(F * 16);
  const uvEdgeIdx = new Uint32Array(F * 4);
  for (let f = 0; f < F; f++) {
    for (let k = 0; k < 4; k++) {
      const a = c.quadsUV[f * 4 + k], b = c.quadsUV[f * 4 + ((k + 1) & 3)];
      const key = a < b ? a * T + b : b * T + a;
      let e = uvEdge.get(key);
      if (e === undefined) {
        e = uvList.length / 2;
        uvEdge.set(key, e);
        uvList.push((c.uv[a * 2] + c.uv[b * 2]) / 2, (c.uv[a * 2 + 1] + c.uv[b * 2 + 1]) / 2);
      }
      uvEdgeIdx[f * 4 + k] = e;
    }
  }
  const faceUV0 = uvList.length / 2;
  for (let f = 0; f < F; f++) {
    let u = 0, v = 0;
    for (let k = 0; k < 4; k++) {
      u += c.uv[c.quadsUV[f * 4 + k] * 2] / 4;
      v += c.uv[c.quadsUV[f * 4 + k] * 2 + 1] / 4;
    }
    uvList.push(u, v);
  }
  for (let f = 0; f < F; f++) {
    for (let k = 0; k < 4; k++) {
      const o = (f * 4 + k) * 4;
      quadsUV[o] = c.quadsUV[f * 4 + k];
      quadsUV[o + 1] = uvEdgeIdx[f * 4 + k];
      quadsUV[o + 2] = faceUV0 + f;
      quadsUV[o + 3] = uvEdgeIdx[f * 4 + ((k + 3) & 3)];
    }
  }
  const out: Control = { pos, quads, quadsUV, uv: Float32Array.from(uvList), skinI, skinW };
  if (limit) out.pos = limitPositions(out);
  // keep the (linear) position stencil: variation morphs of the same topology are subdivided without redoing
  // the edge / weight / uv work (crowds of 'man' instances)
  out.stencil = { rowStart, cols: Uint32Array.from(cols), wts: Float32Array.from(wts), limit };
  return out;
}

/** Control positions -> subdivided (limit) positions with a cached stencil. */
function applyStencil(sub: Control, ctlPos: Float32Array): Float32Array {
  const st = sub.stencil!;
  const NV = st.rowStart.length - 1;
  const out = new Float32Array(NV * 3);
  for (let i = 0; i < NV; i++) {
    let x = 0, y = 0, z = 0;
    for (let j = st.rowStart[i]; j < st.rowStart[i + 1]; j++) {
      const s = st.cols[j] * 3, w = st.wts[j];
      x += ctlPos[s] * w;
      y += ctlPos[s + 1] * w;
      z += ctlPos[s + 2] * w;
    }
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return st.limit ? limitPositions({ ...sub, pos: out }) : out;
}

/** Push Catmull-Clark control points to the limit surface. */
function limitPositions(c: Control): Float32Array {
  const V = c.pos.length / 3;
  const F = c.quads.length / 4;
  const edgeSum = new Float32Array(V * 3);
  const diagSum = new Float32Array(V * 3);
  const val = new Uint16Array(V);
  const seen = new Set<number>();
  for (let f = 0; f < F; f++) {
    for (let k = 0; k < 4; k++) {
      const a = c.quads[f * 4 + k], b = c.quads[f * 4 + ((k + 1) & 3)], d = c.quads[f * 4 + ((k + 2) & 3)];
      const key = a < b ? a * V + b : b * V + a;
      if (!seen.has(key)) {
        seen.add(key);
        for (let j = 0; j < 3; j++) {
          edgeSum[a * 3 + j] += c.pos[b * 3 + j];
          edgeSum[b * 3 + j] += c.pos[a * 3 + j];
        }
        val[a]++;
        val[b]++;
      }
      for (let j = 0; j < 3; j++) diagSum[a * 3 + j] += c.pos[d * 3 + j];
    }
  }
  const out = new Float32Array(V * 3);
  for (let v = 0; v < V; v++) {
    const n = val[v];
    const den = n * (n + 5);
    for (let j = 0; j < 3; j++) out[v * 3 + j] = (n * n * c.pos[v * 3 + j] + 4 * edgeSum[v * 3 + j] + diagSum[v * 3 + j]) / den;
  }
  return out;
}

export interface BodyGeometryInfo {
  geometry: THREE.BufferGeometry;
  /** render vertex -> welded position index (for CPU look-ups) */
  posIndex: Uint32Array;
  vertexCount: number;
  triangleCount: number;
}

/** Per preset (HumanData) and level: everything of the body geometry that does not depend on the variation morphs. */
interface BodyTopo {
  sub: Control;
  triP: Uint32Array;
  posIndex: Uint32Array;
  attrs: Record<string, THREE.BufferAttribute>;
  index: THREE.BufferAttribute;
  vertexCount: number;
  triangleCount: number;
}
const topoCache = new WeakMap<HumanData, Map<number, BodyTopo>>();

/**
 * Build the renderable body geometry. level 0 = hm08 control mesh, 1 = one Catmull-Clark level, 2 = two levels (the
 * hero close-up level, ~214k verts / 428k tris; variation morphs are not supported there: level 1 is used instead).
 * The topology work (subdivision, uv split, weights, tangents) runs once per preset and level; every instance gets
 * its own BufferGeometry that shares those attributes (and the positions / normals too when it has no variation).
 * Variation instances only re-apply the cached subdivision stencil and recompute normals (tangents are shared).
 */
export function buildBodyGeometry(d: HumanData, level: 0 | 1 | 2, variation?: Record<string, number>): BodyGeometryInfo {
  if (level === 2 && variationDelta(d, variation)) level = 1;
  let perData = topoCache.get(d);
  if (!perData) topoCache.set(d, (perData = new Map()));
  let topo = perData.get(level);
  if (!topo) perData.set(level, (topo = buildTopo(d, level)));
  const g = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(topo.attrs)) g.setAttribute(name, a);
  g.setIndex(topo.index);
  const delta = variationDelta(d, variation);
  if (delta) {
    const cp = d.float('mesh.position').slice();
    for (let i = 0; i < cp.length; i++) cp[i] += delta[i];
    const wpos = level === 1 ? applyStencil(topo.sub, cp) : cp;
    const V = wpos.length / 3;
    const wn = new Float32Array(V * 3);
    const tri = topo.triP;
    for (let t = 0; t < tri.length; t += 3) {
      const a = tri[t] * 3, b = tri[t + 1] * 3, c = tri[t + 2] * 3;
      const ux = wpos[b] - wpos[a], uy = wpos[b + 1] - wpos[a + 1], uz = wpos[b + 2] - wpos[a + 2];
      const vx = wpos[c] - wpos[a], vy = wpos[c + 1] - wpos[a + 1], vz = wpos[c + 2] - wpos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const i of [a, b, c]) {
        wn[i] += nx;
        wn[i + 1] += ny;
        wn[i + 2] += nz;
      }
    }
    const pi = topo.posIndex;
    const N = pi.length;
    const position = new Float32Array(N * 3);
    const normal = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const p = pi[i] * 3;
      position[i * 3] = wpos[p];
      position[i * 3 + 1] = wpos[p + 1];
      position[i * 3 + 2] = wpos[p + 2];
      const l = Math.hypot(wn[p], wn[p + 1], wn[p + 2]) || 1;
      normal[i * 3] = wn[p] / l;
      normal[i * 3 + 1] = wn[p + 1] / l;
      normal[i * 3 + 2] = wn[p + 2] / l;
    }
    g.setAttribute('position', new THREE.BufferAttribute(position, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  }
  return { geometry: g, posIndex: topo.posIndex, vertexCount: topo.vertexCount, triangleCount: topo.triangleCount };
}

function buildTopo(d: HumanData, level: 0 | 1 | 2): BodyTopo {
  let c = controlMesh(d);
  if (level === 1) c = subdivide(c, true);
  // hero level: the first level stays on the subdivision surface (not pushed to the limit), the second goes to it
  if (level === 2) c = subdivide(subdivide(c, false), true);
  const F = c.quads.length / 4;
  const V = c.pos.length / 3;
  // triangulate
  const triP = new Uint32Array(F * 6);
  const triT = new Uint32Array(F * 6);
  const order = [0, 1, 2, 0, 2, 3];
  for (let f = 0; f < F; f++) {
    for (let k = 0; k < 6; k++) {
      triP[f * 6 + k] = c.quads[f * 4 + order[k]];
      triT[f * 6 + k] = c.quadsUV[f * 4 + order[k]];
    }
  }
  // welded normals (area weighted)
  const wn = new Float32Array(V * 3);
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3(), n = new THREE.Vector3();
  for (let t = 0; t < triP.length; t += 3) {
    const a = triP[t], b = triP[t + 1], cc = triP[t + 2];
    pa.fromArray(c.pos, a * 3);
    pb.fromArray(c.pos, b * 3).sub(pa);
    pc.fromArray(c.pos, cc * 3).sub(pa);
    n.crossVectors(pb, pc);
    for (const i of [a, b, cc]) {
      wn[i * 3] += n.x;
      wn[i * 3 + 1] += n.y;
      wn[i * 3 + 2] += n.z;
    }
  }
  // split render vertices by (pos, uv)
  const key = new Map<number, number>();
  const T = c.uv.length / 2;
  const posIndex: number[] = [];
  const uvIndex: number[] = [];
  const index = new Uint32Array(triP.length);
  for (let i = 0; i < triP.length; i++) {
    const k = triP[i] * T + triT[i];
    let r = key.get(k);
    if (r === undefined) {
      r = posIndex.length;
      key.set(k, r);
      posIndex.push(triP[i]);
      uvIndex.push(triT[i]);
    }
    index[i] = r;
  }
  const N = posIndex.length;
  const position = new Float32Array(N * 3);
  const normal = new Float32Array(N * 3);
  const uv = new Float32Array(N * 2);
  const skinIndex = new Uint16Array(N * 4);
  const skinWeight = new Float32Array(N * 4);
  const skinIndex2 = new Uint16Array(N * 4);
  const skinWeight2 = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const p = posIndex[i], t = uvIndex[i];
    position[i * 3] = c.pos[p * 3];
    position[i * 3 + 1] = c.pos[p * 3 + 1];
    position[i * 3 + 2] = c.pos[p * 3 + 2];
    const nx = wn[p * 3], ny = wn[p * 3 + 1], nz = wn[p * 3 + 2];
    const l = Math.hypot(nx, ny, nz) || 1;
    normal[i * 3] = nx / l;
    normal[i * 3 + 1] = ny / l;
    normal[i * 3 + 2] = nz / l;
    uv[i * 2] = c.uv[t * 2];
    uv[i * 2 + 1] = c.uv[t * 2 + 1];
    for (let k = 0; k < 4; k++) {
      skinIndex[i * 4 + k] = c.skinI[p * SKIN_K + k];
      skinWeight[i * 4 + k] = c.skinW[p * SKIN_K + k];
      skinIndex2[i * 4 + k] = c.skinI[p * SKIN_K + 4 + k];
      skinWeight2[i * 4 + k] = c.skinW[p * SKIN_K + 4 + k];
    }
  }
  const tangent = computeTangents(position, normal, uv, index);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('tangent', new THREE.BufferAttribute(tangent, 4));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  // influences 5-8 (read by the SKIN8 shader path, see DualQuatSkinning.ts)
  g.setAttribute('skinIndex2', new THREE.BufferAttribute(skinIndex2, 4));
  g.setAttribute('skinWeight2', new THREE.BufferAttribute(skinWeight2, 4));
  const attrs: Record<string, THREE.BufferAttribute> = {};
  for (const [name, a] of Object.entries(g.attributes)) attrs[name] = a as THREE.BufferAttribute;
  return {
    sub: c,
    triP,
    posIndex: Uint32Array.from(posIndex),
    attrs,
    index: new THREE.BufferAttribute(N < 65536 ? Uint16Array.from(index) : index, 1),
    vertexCount: N,
    triangleCount: index.length / 3,
  };
}

/** Same accumulation as tools/human/geom.py:tangents (so baked normal maps match). */
export function computeTangents(pos: Float32Array, nrm: Float32Array, uv: Float32Array, index: ArrayLike<number>) {
  const N = pos.length / 3;
  const T = new Float32Array(N * 3);
  const B = new Float32Array(N * 3);
  for (let t = 0; t < index.length; t += 3) {
    const i0 = index[t], i1 = index[t + 1], i2 = index[t + 2];
    const e1x = pos[i1 * 3] - pos[i0 * 3], e1y = pos[i1 * 3 + 1] - pos[i0 * 3 + 1], e1z = pos[i1 * 3 + 2] - pos[i0 * 3 + 2];
    const e2x = pos[i2 * 3] - pos[i0 * 3], e2y = pos[i2 * 3 + 1] - pos[i0 * 3 + 1], e2z = pos[i2 * 3 + 2] - pos[i0 * 3 + 2];
    const d1u = uv[i1 * 2] - uv[i0 * 2], d1v = uv[i1 * 2 + 1] - uv[i0 * 2 + 1];
    const d2u = uv[i2 * 2] - uv[i0 * 2], d2v = uv[i2 * 2 + 1] - uv[i0 * 2 + 1];
    let r = d1u * d2v - d2u * d1v;
    if (Math.abs(r) < 1e-14) r = 1e-14;
    const sx = (e1x * d2v - e2x * d1v) / r, sy = (e1y * d2v - e2y * d1v) / r, sz = (e1z * d2v - e2z * d1v) / r;
    const tx = (e2x * d1u - e1x * d2u) / r, ty = (e2y * d1u - e1y * d2u) / r, tz = (e2z * d1u - e1z * d2u) / r;
    for (const i of [i0, i1, i2]) {
      T[i * 3] += sx;
      T[i * 3 + 1] += sy;
      T[i * 3 + 2] += sz;
      B[i * 3] += tx;
      B[i * 3 + 1] += ty;
      B[i * 3 + 2] += tz;
    }
  }
  const out = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
    let tx = T[i * 3], ty = T[i * 3 + 1], tz = T[i * 3 + 2];
    const d = nx * tx + ny * ty + nz * tz;
    tx -= nx * d;
    ty -= ny * d;
    tz -= nz * d;
    const l = Math.hypot(tx, ty, tz) || 1;
    tx /= l;
    ty /= l;
    tz /= l;
    // handedness: sign(dot(cross(n, t), B))
    const cx = ny * tz - nz * ty, cy = nz * tx - nx * tz, cz = nx * ty - ny * tx;
    const w = cx * B[i * 3] + cy * B[i * 3 + 1] + cz * B[i * 3 + 2] < 0 ? -1 : 1;
    out[i * 4] = tx;
    out[i * 4 + 1] = ty;
    out[i * 4 + 2] = tz;
    out[i * 4 + 3] = w;
  }
  return out;
}

const auxCache = new WeakMap<HumanData, Map<string, { g: THREE.BufferGeometry | null; nb?: { idx: Uint32Array; w: Float32Array } }>>();

/**
 * Strand ribbons / tear line / teeth geometry (already skinned to the same skeleton).  Cached per preset: every
 * instance gets its own BufferGeometry sharing the attributes.  With `variation`, the vertices follow the variation
 * morphs of the nearest skin (brows stay on the brow ridge, lashes / tear lines on the lid margins, teeth in the mouth).
 */
export function buildAuxGeometry(d: HumanData, prefix: 'lash' | 'brow' | 'tear' | 'teeth', keepEvery = 1, variation?: Record<string, number>): THREE.BufferGeometry | null {
  let per = auxCache.get(d);
  if (!per) auxCache.set(d, (per = new Map()));
  const key = `${prefix}:${keepEvery}`;
  let e = per.get(key);
  if (!e) per.set(key, (e = { g: buildAuxBase(d, prefix, keepEvery) }));
  if (!e.g) return null;
  const g = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(e.g.attributes)) g.setAttribute(name, a);
  g.setIndex(e.g.getIndex());
  const delta = variationDelta(d, variation);
  if (delta) {
    const base = e.g.getAttribute('position').array as Float32Array;
    if (!e.nb) e.nb = skinNeighbours(d, base);
    g.setAttribute('position', new THREE.BufferAttribute(followSkin(base.slice(), e.nb, delta), 3));
  }
  return g;
}

function buildAuxBase(d: HumanData, prefix: 'lash' | 'brow' | 'tear' | 'teeth', keepEvery = 1): THREE.BufferGeometry | null {
  if (!d.has(prefix + '.position')) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(d.float(prefix + '.position'), 3));
  if (d.has(prefix + '.normal')) g.setAttribute('normal', new THREE.BufferAttribute(d.float(prefix + '.normal'), 3));
  else {
    const n = new Float32Array(d.entry(prefix + '.position').count * 3);
    for (let i = 0; i < n.length; i += 3) n[i + 2] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(Uint16Array.from(d.raw(prefix + '.skinIndex')), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(d.float(prefix + '.skinWeight'), 4));
  if (d.has(prefix + '.dir')) g.setAttribute('strandDir', new THREE.BufferAttribute(d.float(prefix + '.dir'), 3));
  if (d.has(prefix + '.strand')) g.setAttribute('strand', new THREE.BufferAttribute(d.float(prefix + '.strand'), 4));
  if (d.has(prefix + '.color')) g.setAttribute('color', new THREE.BufferAttribute(d.float(prefix + '.color'), 3));
  let idx = d.raw(prefix + '.index') as Uint16Array | Uint32Array;
  const info = d.rig.strands?.[prefix];
  if (keepEvery > 1 && info) {
    const trisPer = (info.points - 1) * 2;
    const keep: number[] = [];
    for (let s = 0; s < info.strands; s += keepEvery) for (let k = 0; k < trisPer * 3; k++) keep.push(idx[s * trisPer * 3 + k]);
    idx = Uint32Array.from(keep);
  }
  g.setIndex(new THREE.BufferAttribute(idx instanceof Uint16Array ? idx : Uint32Array.from(idx), 1));
  return g;
}
