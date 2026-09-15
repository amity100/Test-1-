import { CHUNK_SIZE, CHUNK_SHIFT, CHUNK_MASK, Mat, blockMat, blockColor, blockShape, PALETTE_LINEAR, isTransparent, shapeKind, shapeRot, SHAPE_DIRS } from './Voxel';
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
  /** Per vertex: (indoor 0/1, lamp light 0..1) baked from roof cover and nearby lamp blocks. */
  lits: Float32Array;
  indices: Uint32Array;
  quadCount: number;
}

export interface ChunkMeshResult {
  opaque: MeshData | null;
  transparent: MeshData | null;
}

/** A typed array that grows by doubling: the mesher appends tens of thousands of floats per chunk. */
class F32 {
  buf = new Float32Array(4096);
  n = 0;
  push3(a: number, b: number, c: number): void {
    if (this.n + 3 > this.buf.length) this.grow();
    this.buf[this.n++] = a;
    this.buf[this.n++] = b;
    this.buf[this.n++] = c;
  }
  push2(a: number, b: number): void {
    if (this.n + 2 > this.buf.length) this.grow();
    this.buf[this.n++] = a;
    this.buf[this.n++] = b;
  }
  push(a: number): void {
    if (this.n + 1 > this.buf.length) this.grow();
    this.buf[this.n++] = a;
  }
  private grow(): void {
    const next = new Float32Array(this.buf.length * 2);
    next.set(this.buf);
    this.buf = next;
  }
  take(): Float32Array {
    return this.buf.slice(0, this.n);
  }
}
class U32 {
  buf = new Uint32Array(4096);
  n = 0;
  push(a: number): void {
    if (this.n + 1 > this.buf.length) {
      const next = new Uint32Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this.n++] = a;
  }
  take(): Uint32Array {
    return this.buf.slice(0, this.n);
  }
}

class MeshBuilder {
  /** Empties the builder for the next chunk, keeping the capacity it has grown to. */
  reset(): void {
    this.positions.n = 0;
    this.normals.n = 0;
    this.uvs.n = 0;
    this.tints.n = 0;
    this.mats.n = 0;
    this.aos.n = 0;
    this.lits.n = 0;
    this.indices.n = 0;
    this.quadCount = 0;
    this.indoor = 0;
    this.lamp = 0;
  }
  positions = new F32();
  normals = new F32();
  uvs = new F32();
  tints = new F32();
  mats = new F32();
  aos = new F32();
  lits = new F32();
  indices = new U32();
  quadCount = 0;
  /** Lighting of the faces being emitted: indoor flag and lamp level (set before each add). */
  indoor = 0;
  lamp = 0;

  addQuad(
    corners: number[][], // 4 corners [x,y,z], in order c0,c1,c2,c3 (CCW for +normal)
    nx: number, ny: number, nz: number,
    uvU: number, uvV: number, // axis indices for uv
    ao: number[], // ao levels for c0..c3 (0..3)
    tintR: number, tintG: number, tintB: number,
    mat: number,
    flip: boolean,
  ): void {
    const base = this.positions.n / 3;
    for (let i = 0; i < 4; i++) {
      const c = corners[i];
      this.positions.push3(c[0], c[1], c[2]);
      this.normals.push3(nx, ny, nz);
      this.uvs.push2(c[uvU], c[uvV]);
      this.tints.push3(tintR, tintG, tintB);
      this.mats.push(mat);
      this.aos.push(AO_CURVE[ao[i]]);
      this.lits.push2(this.indoor, this.lamp);
    }
    // Choose the diagonal that keeps AO interpolation smooth.
    const diag02 = ao[0] + ao[2] > ao[1] + ao[3];
    const idx = this.indices;
    if (diag02) {
      if (flip) {
        idx.push(base); idx.push(base + 2); idx.push(base + 1); idx.push(base); idx.push(base + 3); idx.push(base + 2);
      } else {
        idx.push(base); idx.push(base + 1); idx.push(base + 2); idx.push(base); idx.push(base + 2); idx.push(base + 3);
      }
    } else if (flip) {
      idx.push(base + 1); idx.push(base + 3); idx.push(base + 2); idx.push(base + 1); idx.push(base); idx.push(base + 3);
    } else {
      idx.push(base + 1); idx.push(base + 2); idx.push(base + 3); idx.push(base + 1); idx.push(base + 3); idx.push(base);
    }
    this.quadCount++;
  }

  /** Convex polygon (3+ points) with explicit per-vertex AO (curve values); winding fixed to the normal. */
  addPolygon(pts: number[][], n: number[], uvU: number, uvV: number, ao: number[], tintR: number, tintG: number, tintB: number, mat: number): void {
    const count = pts.length;
    if (count < 3) return;
    // Ensure counter-clockwise order relative to the normal.
    const ax = pts[1][0] - pts[0][0];
    const ay = pts[1][1] - pts[0][1];
    const az = pts[1][2] - pts[0][2];
    const bx = pts[2][0] - pts[0][0];
    const by = pts[2][1] - pts[0][1];
    const bz = pts[2][2] - pts[0][2];
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    const reverse = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    const base = this.positions.n / 3;
    for (let k = 0; k < count; k++) {
      const i = reverse ? count - 1 - k : k;
      const c = pts[i];
      this.positions.push3(c[0], c[1], c[2]);
      this.normals.push3(n[0], n[1], n[2]);
      this.uvs.push2(c[uvU], c[uvV]);
      this.tints.push3(tintR, tintG, tintB);
      this.mats.push(mat);
      this.aos.push(ao[i]);
      this.lits.push2(this.indoor, this.lamp);
    }
    for (let k = 1; k + 1 < count; k++) {
      this.indices.push(base);
      this.indices.push(base + k);
      this.indices.push(base + k + 1);
    }
    this.quadCount++;
  }

  build(): MeshData | null {
    if (this.quadCount === 0) return null;
    return {
      positions: this.positions.take(),
      normals: this.normals.take(),
      uvs: this.uvs.take(),
      tints: this.tints.take(),
      mats: this.mats.take(),
      aos: this.aos.take(),
      lits: this.lits.take(),
      indices: this.indices.take(),
      quadCount: this.quadCount,
    };
  }
}

/** The two builders every chunk is meshed into; their buffers live for the whole session. */
const OPAQUE = new MeshBuilder();
const TRANSPARENT = new MeshBuilder();

const pad = new Uint16Array(P * P * P);
const maskVal = new Int32Array(N * N);
const maskDir = new Int8Array(N * N);
const maskAo = new Int32Array(N * N);
const maskLit = new Uint8Array(N * N);

function pidx(x: number, y: number, z: number): number {
  return ((x + 1) * P + (y + 1)) * P + (z + 1);
}

/** Full cubes hide neighbouring faces and darken corners; shaped and glass blocks do not. */
function occludes(v: number): boolean {
  const m = blockMat(v);
  return m !== Mat.AIR && !isTransparent(m) && blockShape(v) === 0;
}

/** Value for the greedy cube pass: shaped blocks are meshed separately, so they read as air here. */
function cubeOnly(v: number): number {
  return blockShape(v) === 0 ? v : 0;
}

function vertexAO(s1: boolean, s2: boolean, c: boolean): number {
  if (s1 && s2) return 0;
  return 3 - ((s1 ? 1 : 0) + (s2 ? 1 : 0) + (c ? 1 : 0));
}

/** Greedy-meshes one chunk into opaque and transparent geometry data (world-space positions). */
/** Materials that throw a warm pool of light on nearby blocks (baked per vertex). */
const LAMP_MATS = new Set<number>([Mat.LAMP, Mat.CRYSTAL, Mat.NEON]);
const LAMP_REACH = 3;
const ROOF_SCAN = 14;
/** Chunks above the meshed one that the roof scan may look into. */
const UP_CHUNKS = 2;

/**
 * Block reads around one chunk without a hash lookup per block: the chunk and its neighbours (one
 * ring around, two chunks up for the roof scan) are fetched once, and every read after that is a
 * few shifts into their arrays. Meshing a chunk reads its neighbourhood tens of thousands of times.
 */
class Neighbourhood {
  private refs: (Uint16Array | null)[];
  private static YS = UP_CHUNKS + 2;
  constructor(world: VoxelWorld, private cx: number, private cy: number, private cz: number) {
    const ys = Neighbourhood.YS;
    this.refs = new Array(3 * ys * 3);
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= UP_CHUNKS; oy++)
        for (let oz = -1; oz <= 1; oz++) {
          const c = world.getChunk(cx + ox, cy + oy, cz + oz);
          this.refs[((ox + 1) * ys + (oy + 1)) * 3 + (oz + 1)] = c && c.count > 0 ? c.data : null;
        }
  }
  /** Block at chunk-local coordinates; lx, lz in [-16, 32), ly in [-16, 16 * (UP_CHUNKS + 1)). */
  get(lx: number, ly: number, lz: number): number {
    const ox = lx >> CHUNK_SHIFT;
    const oy = ly >> CHUNK_SHIFT;
    const oz = lz >> CHUNK_SHIFT;
    const data = this.refs[((ox + 1) * Neighbourhood.YS + (oy + 1)) * 3 + (oz + 1)];
    if (!data) return 0;
    return data[((lx & CHUNK_MASK) << (CHUNK_SHIFT * 2)) | ((ly & CHUNK_MASK) << CHUNK_SHIFT) | (lz & CHUNK_MASK)];
  }
}

const LP = N + 2 * LAMP_REACH;
const lampField = new Uint8Array(LP * LP * LP);

/**
 * Indoor/lamp lookup for one chunk mesh: a cell is indoor when a block roofs it within a few
 * metres, and lit by the nearest lamp within reach. The roof is a cached column scan; the lamp
 * distance is a small field stamped once per chunk, so a face costs two array reads.
 */
class LightProbe {
  private roof = new Int16Array((N + 2) * (N + 2)).fill(-32768);
  constructor(private nb: Neighbourhood) {
    const r = LAMP_REACH;
    lampField.fill(r + 1);
    for (let x = -r; x < N + r; x++)
      for (let y = -r; y < N + r; y++)
        for (let z = -r; z < N + r; z++) {
          const v = nb.get(x, y, z);
          if (v === 0 || !LAMP_MATS.has(blockMat(v))) continue;
          // Stamp the Chebyshev distance around the lamp, keeping the nearest lamp at each cell.
          for (let dx = -r; dx <= r; dx++) {
            const ax = x + dx;
            if (ax < -r || ax >= N + r) continue;
            const adx = Math.abs(dx);
            for (let dy = -r; dy <= r; dy++) {
              const ay = y + dy;
              if (ay < -r || ay >= N + r) continue;
              const dxy = Math.max(adx, Math.abs(dy));
              for (let dz = -r; dz <= r; dz++) {
                const az = z + dz;
                if (az < -r || az >= N + r) continue;
                const d = Math.max(dxy, Math.abs(dz));
                const i = ((ax + r) * LP + (ay + r)) * LP + (az + r);
                if (d < lampField[i]) lampField[i] = d;
              }
            }
          }
        }
  }
  /** Highest solid block above the padded column (local y), or a sentinel when open to the sky. */
  private roofAt(lx: number, lz: number): number {
    const i = (lx + 1) * (N + 2) + (lz + 1);
    let top = this.roof[i];
    if (top !== -32768) return top;
    top = -30000;
    for (let y = N + ROOF_SCAN; y >= -1; y--) {
      const v = this.nb.get(lx, y, lz);
      if (v !== 0 && blockShape(v) === 0 && !isTransparent(blockMat(v))) {
        top = y;
        break;
      }
    }
    this.roof[i] = top;
    return top;
  }
  /** Packed (indoor | lampLevel << 1) for the air cell at local coordinates. */
  at(lx: number, ly: number, lz: number): number {
    const indoor = this.roofAt(lx, lz) > ly ? 1 : 0;
    const r = LAMP_REACH;
    const best = lampField[((lx + r) * LP + (ly + r)) * LP + (lz + r)];
    const lamp = best > LAMP_REACH ? 0 : best <= 1 ? 3 : best === 2 ? 2 : 1;
    return indoor | (lamp << 1);
  }
}

export function meshChunk(world: VoxelWorld, cx: number, cy: number, cz: number): ChunkMeshResult {
  const ox = cx * N;
  const oy = cy * N;
  const oz = cz * N;
  const hood = new Neighbourhood(world, cx, cy, cz);
  // Fill padded buffer.
  let hasShapes = false;
  for (let x = -1; x <= N; x++) {
    for (let y = -1; y <= N; y++) {
      for (let z = -1; z <= N; z++) {
        const v = hood.get(x, y, z);
        pad[pidx(x, y, z)] = v;
        if (v !== 0 && blockShape(v) !== 0 && x >= 0 && y >= 0 && z >= 0 && x < N && y < N && z < N) hasShapes = true;
      }
    }
  }
  const opaque = OPAQUE;
  const transparent = TRANSPARENT;
  opaque.reset();
  transparent.reset();
  const x = [0, 0, 0];
  const q = [0, 0, 0];
  const nb = [0, 0, 0];
  const light = new LightProbe(hood);

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
          const a = cubeOnly(pad[pidx(x[0], x[1], x[2])]);
          const b = cubeOnly(pad[pidx(x[0] + q[0], x[1] + q[1], x[2] + q[2])]);
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
            maskLit[n] = light.at(nb[0], nb[1], nb[2]);
          } else if (faceB) {
            maskVal[n] = b;
            maskDir[n] = -1;
            nb[0] = x[0]; nb[1] = x[1]; nb[2] = x[2];
            maskAo[n] = computeAO(nb, u, v);
            maskLit[n] = light.at(nb[0], nb[1], nb[2]);
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
          const lit = maskLit[n];
          let w = 1;
          while (i + w < N && maskVal[n + w] === val && maskDir[n + w] === dir && maskAo[n + w] === ao && maskLit[n + w] === lit) w++;
          let h = 1;
          outer: for (; j + h < N; h++) {
            for (let k = 0; k < w; k++) {
              const m = n + h * N + k;
              if (maskVal[m] !== val || maskDir[m] !== dir || maskAo[m] !== ao || maskLit[m] !== lit) break outer;
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
          builder.indoor = lit & 1;
          builder.lamp = (lit >> 1) / 3;
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

  // Shaped blocks: emitted one by one with their own geometry.
  if (hasShapes) {
    for (let lx = 0; lx < N; lx++) {
      for (let ly = 0; ly < N; ly++) {
        for (let lz = 0; lz < N; lz++) {
          const v = pad[pidx(lx, ly, lz)];
          if (v === 0 || blockShape(v) === 0) continue;
          const builder = isTransparent(blockMat(v)) ? transparent : opaque;
          const lit = light.at(lx, ly + 1, lz);
          builder.indoor = lit & 1;
          builder.lamp = (lit >> 1) / 3;
          emitShape(
            builder,
            ox + lx, oy + ly, oz + lz,
            v,
            (dx, dy, dz) => occludes(pad[pidx(lx + dx, ly + dy, lz + dz)]),
            (dx, dz) => {
              const nv = pad[pidx(lx + dx, ly, lz + dz)];
              return nv !== 0 && (blockShape(nv) === 0 || shapeKind(blockShape(nv)) === 'fence' || shapeKind(blockShape(nv)) === 'pillar');
            },
            (dx, dy, dz) => {
              const d = dx !== 0 ? 0 : dy !== 0 ? 1 : 2;
              const u = (d + 1) % 3;
              const w = (d + 2) % 3;
              nb[0] = lx + Math.max(0, dx); nb[1] = ly + Math.max(0, dy); nb[2] = lz + Math.max(0, dz);
              if (dx < 0 || dy < 0 || dz < 0) { nb[0] = lx + dx; nb[1] = ly + dy; nb[2] = lz + dz; }
              const packed = computeAO(nb, u, w);
              return [AO_CURVE[packed & 3], AO_CURVE[(packed >> 2) & 3], AO_CURVE[(packed >> 4) & 3], AO_CURVE[(packed >> 6) & 3]];
            },
          );
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

// ---------------------------------------------------------------------------------------------
// Shaped blocks
// ---------------------------------------------------------------------------------------------

interface Face {
  /** Cell-local points (0..1). */
  pts: number[][];
  n: number[];
  /** Neighbour direction whose full cube hides this face (faces lying on the cell boundary). */
  boundary?: number[];
}

const PILLAR_R = 0.38;

function boxFaces(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, skip: string[] = []): Face[] {
  const f: Face[] = [];
  const b = (axis: number, at: number, sign: number): number[] | undefined => {
    if (at <= 0.0001 && sign < 0) return axis === 0 ? [-1, 0, 0] : axis === 1 ? [0, -1, 0] : [0, 0, -1];
    if (at >= 0.9999 && sign > 0) return axis === 0 ? [1, 0, 0] : axis === 1 ? [0, 1, 0] : [0, 0, 1];
    return undefined;
  };
  if (!skip.includes('-x')) f.push({ pts: [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], n: [-1, 0, 0], boundary: b(0, x0, -1) });
  if (!skip.includes('+x')) f.push({ pts: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], n: [1, 0, 0], boundary: b(0, x1, 1) });
  if (!skip.includes('-y')) f.push({ pts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], n: [0, -1, 0], boundary: b(1, y0, -1) });
  if (!skip.includes('+y')) f.push({ pts: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], n: [0, 1, 0], boundary: b(1, y1, 1) });
  if (!skip.includes('-z')) f.push({ pts: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], n: [0, 0, -1], boundary: b(2, z0, -1) });
  if (!skip.includes('+z')) f.push({ pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], n: [0, 0, 1], boundary: b(2, z1, 1) });
  return f;
}

/** Rotates cell-local geometry about the cell centre by 90° steps (same sense as prefab rotation). */
function rotateFaces(faces: Face[], r: number): Face[] {
  if (r === 0) return faces;
  const rp = (p: number[]): number[] => {
    let [x, y, z] = p;
    for (let i = 0; i < r; i++) {
      const nx = 1 - z;
      const nz = x;
      x = nx;
      z = nz;
    }
    return [x, y, z];
  };
  const rv = (v: number[]): number[] => {
    let [x, y, z] = v;
    for (let i = 0; i < r; i++) {
      const nx = -z;
      const nz = x;
      x = nx;
      z = nz;
    }
    return [x, y, z];
  };
  return faces.map((f) => ({ pts: f.pts.map(rp), n: rv(f.n), boundary: f.boundary ? rv(f.boundary) : undefined }));
}

const faceCache = new Map<number, Face[]>();

/** Faces of a shaped block, built once per shape and railing-connection pattern. */
function shapeFacesCached(shape: number, connects: (dx: number, dz: number) => boolean): Face[] {
  let mask = 0;
  if (shapeKind(shape) === 'fence') {
    for (let i = 0; i < 4; i++) if (connects(SHAPE_DIRS[i][0], SHAPE_DIRS[i][1])) mask |= 1 << i;
  }
  const key = shape * 16 + mask;
  let f = faceCache.get(key);
  if (!f) {
    f = shapeFaces(shape, (dx, dz) => {
      for (let i = 0; i < 4; i++) if (SHAPE_DIRS[i][0] === dx && SHAPE_DIRS[i][1] === dz) return (mask & (1 << i)) !== 0;
      return false;
    });
    faceCache.set(key, f);
  }
  return f;
}

function shapeFaces(shape: number, connects: (dx: number, dz: number) => boolean): Face[] {
  const kind = shapeKind(shape);
  const r = shapeRot(shape);
  switch (kind) {
    case 'slab':
      return boxFaces(0, 0, 0, 1, 0.5, 1);
    case 'slabTop':
      return boxFaces(0, 0.5, 0, 1, 1, 1);
    case 'stairs': {
      const f: Face[] = [
        { pts: [[0, 0.5, 0], [0.5, 0.5, 0], [0.5, 0.5, 1], [0, 0.5, 1]], n: [0, 1, 0] },
        { pts: [[0.5, 1, 0], [1, 1, 0], [1, 1, 1], [0.5, 1, 1]], n: [0, 1, 0], boundary: [0, 1, 0] },
        { pts: [[0, 0, 0], [0, 0.5, 0], [0, 0.5, 1], [0, 0, 1]], n: [-1, 0, 0], boundary: [-1, 0, 0] },
        { pts: [[0.5, 0.5, 0], [0.5, 1, 0], [0.5, 1, 1], [0.5, 0.5, 1]], n: [-1, 0, 0] },
        { pts: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], n: [1, 0, 0], boundary: [1, 0, 0] },
        { pts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], n: [0, -1, 0], boundary: [0, -1, 0] },
        { pts: [[0, 0, 0], [1, 0, 0], [1, 0.5, 0], [0, 0.5, 0]], n: [0, 0, -1], boundary: [0, 0, -1] },
        { pts: [[0.5, 0.5, 0], [1, 0.5, 0], [1, 1, 0], [0.5, 1, 0]], n: [0, 0, -1], boundary: [0, 0, -1] },
        { pts: [[0, 0, 1], [1, 0, 1], [1, 0.5, 1], [0, 0.5, 1]], n: [0, 0, 1], boundary: [0, 0, 1] },
        { pts: [[0.5, 0.5, 1], [1, 0.5, 1], [1, 1, 1], [0.5, 1, 1]], n: [0, 0, 1], boundary: [0, 0, 1] },
      ];
      return rotateFaces(f, r);
    }
    case 'slope': {
      const k = Math.SQRT1_2;
      const f: Face[] = [
        { pts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], n: [0, -1, 0], boundary: [0, -1, 0] },
        { pts: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], n: [1, 0, 0], boundary: [1, 0, 0] },
        { pts: [[0, 0, 0], [0, 0, 1], [1, 1, 1], [1, 1, 0]], n: [-k, k, 0] },
        { pts: [[0, 0, 0], [1, 0, 0], [1, 1, 0]], n: [0, 0, -1], boundary: [0, 0, -1] },
        { pts: [[0, 0, 1], [1, 0, 1], [1, 1, 1]], n: [0, 0, 1], boundary: [0, 0, 1] },
      ];
      return rotateFaces(f, r);
    }
    case 'pillar': {
      const f: Face[] = [];
      const ring: number[][] = [];
      for (let i = 0; i < 8; i++) {
        const a = ((i + 0.5) / 8) * Math.PI * 2;
        ring.push([0.5 + Math.cos(a) * PILLAR_R, 0.5 + Math.sin(a) * PILLAR_R]);
      }
      for (let i = 0; i < 8; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % 8];
        const am = ((i + 1) / 8) * Math.PI * 2;
        f.push({ pts: [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], 1, b[1]], [a[0], 1, a[1]]], n: [Math.cos(am), 0, Math.sin(am)] });
      }
      f.push({ pts: ring.map((p) => [p[0], 1, p[1]]), n: [0, 1, 0], boundary: [0, 1, 0] });
      f.push({ pts: ring.map((p) => [p[0], 0, p[1]]), n: [0, -1, 0], boundary: [0, -1, 0] });
      return f;
    }
    case 'fence': {
      const f = boxFaces(0.36, 0, 0.36, 0.64, 1, 0.64);
      for (const [dx, dz] of SHAPE_DIRS) {
        if (!connects(dx, dz)) continue;
        for (const [y0, y1] of [[0.28, 0.4], [0.68, 0.8]]) {
          if (dx > 0) f.push(...boxFaces(0.64, y0, 0.44, 1, y1, 0.56, ['-x']));
          else if (dx < 0) f.push(...boxFaces(0, y0, 0.44, 0.36, y1, 0.56, ['+x']));
          else if (dz > 0) f.push(...boxFaces(0.44, y0, 0.64, 0.56, y1, 1, ['-z']));
          else f.push(...boxFaces(0.44, y0, 0, 0.56, y1, 0.36, ['+z']));
        }
      }
      return f;
    }
    default:
      return boxFaces(0, 0, 0, 1, 1, 1);
  }
}

/**
 * Emits the geometry of one shaped block. `occl` says whether the neighbour in a direction is a
 * full cube (hides boundary faces), `connects` whether a railing should link to that neighbour,
 * and `aoFace` gives the four corner AO values of the cell face in a direction.
 */
export function emitShape(
  builder: MeshBuilder,
  wx: number, wy: number, wz: number,
  value: number,
  occl: (dx: number, dy: number, dz: number) => boolean,
  connects: (dx: number, dz: number) => boolean,
  aoFace: (dx: number, dy: number, dz: number) => number[],
): void {
  const shape = blockShape(value);
  const mat = blockMat(value);
  const col = blockColor(value) * 3;
  const tr = PALETTE_LINEAR[col];
  const tg = PALETTE_LINEAR[col + 1];
  const tb = PALETTE_LINEAR[col + 2];
  for (const face of shapeFacesCached(shape, connects)) {
    if (face.boundary && occl(face.boundary[0], face.boundary[1], face.boundary[2])) continue;
    const n = face.n;
    const ax = Math.abs(n[0]);
    const ay = Math.abs(n[1]);
    const az = Math.abs(n[2]);
    const d = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2;
    const sign = n[d] >= 0 ? 1 : -1;
    const uvU = d === 0 ? 2 : 0;
    const uvV = d === 0 ? 1 : d === 1 ? 2 : 1;
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    // AO from the cell face in the dominant direction (boundary faces sample beyond the cell).
    const dir = face.boundary ?? [d === 0 ? sign : 0, d === 1 ? sign : 0, d === 2 ? sign : 0];
    const corner = aoFace(dir[0], dir[1], dir[2]);
    const pts = face.pts.map((p) => [wx + p[0], wy + p[1], wz + p[2]]);
    const ao = face.pts.map((p) => {
      const pu = p[u];
      const pv = p[v];
      const lo = corner[0] + (corner[1] - corner[0]) * pu;
      const hi = corner[3] + (corner[2] - corner[3]) * pu;
      return lo + (hi - lo) * pv;
    });
    builder.addPolygon(pts, n, uvU, uvV, ao, tr, tg, tb, mat);
  }
}

/** Geometry of a single block (any shape) at the origin with open surroundings: icons and ghosts. */
export function buildBlockMesh(value: number): MeshData | null {
  const b = new MeshBuilder();
  const shape = blockShape(value);
  if (shape === 0) {
    const mat = blockMat(value);
    const col = blockColor(value) * 3;
    for (const f of boxFaces(0, 0, 0, 1, 1, 1)) {
      const n = f.n;
      const d = n[0] !== 0 ? 0 : n[1] !== 0 ? 1 : 2;
      const uvU = d === 0 ? 2 : 0;
      const uvV = d === 0 ? 1 : d === 1 ? 2 : 1;
      b.addPolygon(f.pts, n, uvU, uvV, [1, 1, 1, 1], PALETTE_LINEAR[col], PALETTE_LINEAR[col + 1], PALETTE_LINEAR[col + 2], mat);
    }
    return b.build();
  }
  emitShape(b, 0, 0, 0, value, () => false, () => false, () => [1, 1, 1, 1]);
  return b.build();
}
