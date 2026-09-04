import { CHUNK_SIZE, Mat, blockMat, blockColor, PALETTE_LINEAR, isTransparent } from './Voxel';
import type { VoxelWorld } from './VoxelWorld';

const N = CHUNK_SIZE;
const P = N + 2;
const AO_CURVE = [0.38, 0.6, 0.82, 1.0];

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  tints: Float32Array;
  mats: Float32Array;
  aos: Float32Array;
  indices: Uint32Array;
  quadCount: number;
}

export interface ChunkMeshResult {
  opaque: MeshData | null;
  transparent: MeshData | null;
}

class MeshBuilder {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  tints: number[] = [];
  mats: number[] = [];
  aos: number[] = [];
  indices: number[] = [];
  quadCount = 0;

  addQuad(
    corners: number[][], // 4 corners [x,y,z], in order c0,c1,c2,c3 (CCW for +normal)
    nx: number, ny: number, nz: number,
    uvU: number, uvV: number, // axis indices for uv
    ao: number[], // ao levels for c0..c3 (0..3)
    tintR: number, tintG: number, tintB: number,
    mat: number,
    flip: boolean,
  ): void {
    const base = this.positions.length / 3;
    for (let i = 0; i < 4; i++) {
      const c = corners[i];
      this.positions.push(c[0], c[1], c[2]);
      this.normals.push(nx, ny, nz);
      this.uvs.push(c[uvU], c[uvV]);
      this.tints.push(tintR, tintG, tintB);
      this.mats.push(mat);
      this.aos.push(AO_CURVE[ao[i]]);
    }
    // Choose the diagonal that keeps AO interpolation smooth.
    const diag02 = ao[0] + ao[2] > ao[1] + ao[3];
    let tris: number[];
    if (diag02) tris = [0, 1, 2, 0, 2, 3];
    else tris = [1, 2, 3, 1, 3, 0];
    if (flip) tris = [tris[0], tris[2], tris[1], tris[3], tris[5], tris[4]];
    for (const t of tris) this.indices.push(base + t);
    this.quadCount++;
  }

  build(): MeshData | null {
    if (this.quadCount === 0) return null;
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      tints: new Float32Array(this.tints),
      mats: new Float32Array(this.mats),
      aos: new Float32Array(this.aos),
      indices: new Uint32Array(this.indices),
      quadCount: this.quadCount,
    };
  }
}

const pad = new Uint16Array(P * P * P);
const maskVal = new Int32Array(N * N);
const maskDir = new Int8Array(N * N);
const maskAo = new Int32Array(N * N);

function pidx(x: number, y: number, z: number): number {
  return ((x + 1) * P + (y + 1)) * P + (z + 1);
}

function occludes(v: number): boolean {
  const m = blockMat(v);
  return m !== Mat.AIR && !isTransparent(m);
}

function vertexAO(s1: boolean, s2: boolean, c: boolean): number {
  if (s1 && s2) return 0;
  return 3 - ((s1 ? 1 : 0) + (s2 ? 1 : 0) + (c ? 1 : 0));
}

/** Greedy-meshes one chunk into opaque and transparent geometry data (world-space positions). */
export function meshChunk(world: VoxelWorld, cx: number, cy: number, cz: number): ChunkMeshResult {
  const ox = cx * N;
  const oy = cy * N;
  const oz = cz * N;
  // Fill padded buffer.
  for (let x = -1; x <= N; x++) {
    for (let y = -1; y <= N; y++) {
      for (let z = -1; z <= N; z++) {
        pad[pidx(x, y, z)] = world.get(ox + x, oy + y, oz + z);
      }
    }
  }
  const opaque = new MeshBuilder();
  const transparent = new MeshBuilder();
  const x = [0, 0, 0];
  const q = [0, 0, 0];
  const nb = [0, 0, 0];

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    q[0] = 0; q[1] = 0; q[2] = 0;
    q[d] = 1;
    // uv axes per face orientation
    let uvU: number;
    let uvV: number;
    if (d === 0) { uvU = 2; uvV = 1; } else if (d === 1) { uvU = 0; uvV = 2; } else { uvU = 0; uvV = 1; }

    for (x[d] = -1; x[d] < N; x[d]++) {
      // Build mask.
      let n = 0;
      for (x[v] = 0; x[v] < N; x[v]++) {
        for (x[u] = 0; x[u] < N; x[u]++) {
          const a = pad[pidx(x[0], x[1], x[2])];
          const b = pad[pidx(x[0] + q[0], x[1] + q[1], x[2] + q[2])];
          const ma = blockMat(a);
          const mb = blockMat(b);
          const ta = isTransparent(ma);
          const tb = isTransparent(mb);
          const faceA = x[d] >= 0 && ma !== Mat.AIR && (mb === Mat.AIR || (tb && !ta));
          const faceB = x[d] + 1 < N && mb !== Mat.AIR && (ma === Mat.AIR || (ta && !tb));
          if (faceA) {
            maskVal[n] = a;
            maskDir[n] = 1;
            // Beyond-layer cell is b (x + q).
            nb[0] = x[0] + q[0]; nb[1] = x[1] + q[1]; nb[2] = x[2] + q[2];
            maskAo[n] = computeAO(nb, u, v);
          } else if (faceB) {
            maskVal[n] = b;
            maskDir[n] = -1;
            nb[0] = x[0]; nb[1] = x[1]; nb[2] = x[2];
            maskAo[n] = computeAO(nb, u, v);
          } else {
            maskVal[n] = 0;
          }
          n++;
        }
      }
      // Greedy merge.
      n = 0;
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; ) {
          const val = maskVal[n];
          if (val === 0) {
            i++;
            n++;
            continue;
          }
          const dir = maskDir[n];
          const ao = maskAo[n];
          let w = 1;
          while (i + w < N && maskVal[n + w] === val && maskDir[n + w] === dir && maskAo[n + w] === ao) w++;
          let h = 1;
          outer: for (; j + h < N; h++) {
            for (let k = 0; k < w; k++) {
              const m = n + h * N + k;
              if (maskVal[m] !== val || maskDir[m] !== dir || maskAo[m] !== ao) break outer;
            }
          }
          // Emit quad.
          const base = [0, 0, 0];
          base[d] = ox * (d === 0 ? 1 : 0) + oy * (d === 1 ? 1 : 0) + oz * (d === 2 ? 1 : 0) + x[d] + 1;
          const off = [ox, oy, oz];
          base[u] = off[u] + i;
          base[v] = off[v] + j;
          const du = [0, 0, 0];
          du[u] = w;
          const dv = [0, 0, 0];
          dv[v] = h;
          const c0 = [base[0], base[1], base[2]];
          const c1 = [base[0] + du[0], base[1] + du[1], base[2] + du[2]];
          const c2 = [base[0] + du[0] + dv[0], base[1] + du[1] + dv[1], base[2] + du[2] + dv[2]];
          const c3 = [base[0] + dv[0], base[1] + dv[1], base[2] + dv[2]];
          const aoArr = [ao & 3, (ao >> 2) & 3, (ao >> 4) & 3, (ao >> 6) & 3];
          const mat = blockMat(val);
          const col = blockColor(val) * 3;
          const builder = isTransparent(mat) ? transparent : opaque;
          builder.addQuad(
            [c0, c1, c2, c3],
            q[0] * dir, q[1] * dir, q[2] * dir,
            uvU, uvV,
            aoArr,
            PALETTE_LINEAR[col], PALETTE_LINEAR[col + 1], PALETTE_LINEAR[col + 2],
            mat,
            dir < 0,
          );
          // Clear mask.
          for (let hh = 0; hh < h; hh++) {
            for (let k = 0; k < w; k++) maskVal[n + hh * N + k] = 0;
          }
          i += w;
          n += w;
        }
      }
    }
  }
  return { opaque: opaque.build(), transparent: transparent.build() };
}

function computeAO(b: number[], u: number, v: number): number {
  const s = (du: number, dv: number): boolean => {
    const px = b[0] + (u === 0 ? du : 0) + (v === 0 ? dv : 0);
    const py = b[1] + (u === 1 ? du : 0) + (v === 1 ? dv : 0);
    const pz = b[2] + (u === 2 ? du : 0) + (v === 2 ? dv : 0);
    return occludes(pad[pidx(px, py, pz)]);
  };
  const mu = s(-1, 0);
  const pu = s(1, 0);
  const mv = s(0, -1);
  const pv = s(0, 1);
  const ao00 = vertexAO(mu, mv, s(-1, -1));
  const ao10 = vertexAO(pu, mv, s(1, -1));
  const ao11 = vertexAO(pu, pv, s(1, 1));
  const ao01 = vertexAO(mu, pv, s(-1, 1));
  return ao00 | (ao10 << 2) | (ao11 << 4) | (ao01 << 6);
}
