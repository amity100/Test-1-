import { CHUNK_SIZE, CHUNK_SHIFT, CHUNK_MASK, Mat, blockMat, isSolid } from './Voxel';

export interface RayHit {
  /** Block coordinates of the hit voxel. */
  x: number;
  y: number;
  z: number;
  /** Face normal of the hit (unit axis vector, or zero if starting inside a block). */
  nx: number;
  ny: number;
  nz: number;
  dist: number;
  px: number;
  py: number;
  pz: number;
}

export class Chunk {
  readonly data = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
  count = 0;
  dirty = true;
  constructor(public readonly cx: number, public readonly cy: number, public readonly cz: number, public readonly key: number) {}
}

export function chunkKey(cx: number, cy: number, cz: number): number {
  return ((cx + 2048) * 4096 + (cy + 2048)) * 4096 + (cz + 2048);
}

export function blockIndex(lx: number, ly: number, lz: number): number {
  return (lx << (CHUNK_SHIFT * 2)) | (ly << CHUNK_SHIFT) | lz;
}

/** Sparse chunked voxel storage with raycasts and box queries. */
export class VoxelWorld {
  readonly chunks = new Map<number, Chunk>();
  readonly dirty = new Set<Chunk>();
  readonly minY = 0;
  readonly maxY = 127;
  version = 0;

  getChunk(cx: number, cy: number, cz: number, create = false): Chunk | undefined {
    const key = chunkKey(cx, cy, cz);
    let c = this.chunks.get(key);
    if (!c && create) {
      c = new Chunk(cx, cy, cz, key);
      this.chunks.set(key, c);
      this.dirty.add(c);
    }
    return c;
  }

  get(x: number, y: number, z: number): number {
    if (y < this.minY || y > this.maxY) return 0;
    const c = this.chunks.get(chunkKey(x >> CHUNK_SHIFT, y >> CHUNK_SHIFT, z >> CHUNK_SHIFT));
    if (!c) return 0;
    return c.data[blockIndex(x & CHUNK_MASK, y & CHUNK_MASK, z & CHUNK_MASK)];
  }

  getMat(x: number, y: number, z: number): number {
    return blockMat(this.get(x, y, z));
  }

  isSolid(x: number, y: number, z: number): boolean {
    return this.getMat(x, y, z) !== Mat.AIR;
  }

  /** Sets a block value (0 = air). Returns true if the value changed. */
  set(x: number, y: number, z: number, value: number): boolean {
    if (y < this.minY || y > this.maxY) return false;
    const cx = x >> CHUNK_SHIFT;
    const cy = y >> CHUNK_SHIFT;
    const cz = z >> CHUNK_SHIFT;
    let c = this.getChunk(cx, cy, cz, value !== 0);
    if (!c) return false;
    const lx = x & CHUNK_MASK;
    const ly = y & CHUNK_MASK;
    const lz = z & CHUNK_MASK;
    const idx = blockIndex(lx, ly, lz);
    const prev = c.data[idx];
    if (prev === value) return false;
    c.data[idx] = value;
    if (prev === 0) c.count++;
    if (value === 0) c.count--;
    this.markDirty(c);
    // Neighbouring chunks need remeshing when a border block changes (AO + face culling).
    if (lx === 0) this.markDirtyAt(cx - 1, cy, cz);
    if (lx === CHUNK_MASK) this.markDirtyAt(cx + 1, cy, cz);
    if (ly === 0) this.markDirtyAt(cx, cy - 1, cz);
    if (ly === CHUNK_MASK) this.markDirtyAt(cx, cy + 1, cz);
    if (lz === 0) this.markDirtyAt(cx, cy, cz - 1);
    if (lz === CHUNK_MASK) this.markDirtyAt(cx, cy, cz + 1);
    this.version++;
    return true;
  }

  private markDirty(c: Chunk): void {
    c.dirty = true;
    this.dirty.add(c);
  }

  private markDirtyAt(cx: number, cy: number, cz: number): void {
    const c = this.chunks.get(chunkKey(cx, cy, cz));
    if (c) this.markDirty(c);
  }

  /** Removes every block in the inclusive box. */
  clearBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, 0);
  }

  countBlocksInBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number {
    let n = 0;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (this.get(x, y, z) !== 0) n++;
    return n;
  }

  /** True when any solid voxel overlaps the AABB (exclusive max). */
  boxIntersectsSolid(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean {
    const x0 = Math.floor(minX);
    const y0 = Math.floor(minY);
    const z0 = Math.floor(minZ);
    const x1 = Math.ceil(maxX) - 1;
    const y1 = Math.ceil(maxY) - 1;
    const z1 = Math.ceil(maxZ) - 1;
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          if (this.get(x, y, z) !== 0) return true;
        }
      }
    }
    return false;
  }

  /** Amanatides–Woo DDA voxel raycast. Direction need not be normalised. */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number, out?: RayHit): RayHit | null {
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-9) return null;
    dx /= len;
    dy /= len;
    dz /= len;
    let x = Math.floor(ox);
    let y = Math.floor(oy);
    let z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;
    const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;
    let tMaxX = stepX > 0 ? (x + 1 - ox) * tDeltaX : stepX < 0 ? (ox - x) * tDeltaX : Infinity;
    let tMaxY = stepY > 0 ? (y + 1 - oy) * tDeltaY : stepY < 0 ? (oy - y) * tDeltaY : Infinity;
    let tMaxZ = stepZ > 0 ? (z + 1 - oz) * tDeltaZ : stepZ < 0 ? (oz - z) * tDeltaZ : Infinity;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    let t = 0;
    const hit = out ?? ({} as RayHit);
    for (let i = 0; i < 1024; i++) {
      if (this.get(x, y, z) !== 0) {
        hit.x = x;
        hit.y = y;
        hit.z = z;
        hit.nx = nx;
        hit.ny = ny;
        hit.nz = nz;
        hit.dist = t;
        hit.px = ox + dx * t;
        hit.py = oy + dy * t;
        hit.pz = oz + dz * t;
        return hit;
      }
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          t = tMaxX;
          x += stepX;
          tMaxX += tDeltaX;
          nx = -stepX; ny = 0; nz = 0;
        } else {
          t = tMaxZ;
          z += stepZ;
          tMaxZ += tDeltaZ;
          nx = 0; ny = 0; nz = -stepZ;
        }
      } else if (tMaxY < tMaxZ) {
        t = tMaxY;
        y += stepY;
        tMaxY += tDeltaY;
        nx = 0; ny = -stepY; nz = 0;
      } else {
        t = tMaxZ;
        z += stepZ;
        tMaxZ += tDeltaZ;
        nx = 0; ny = 0; nz = -stepZ;
      }
      if (t > maxDist) return null;
      if (y < this.minY - 1 && stepY <= 0) return null;
      if (y > this.maxY + 1 && stepY >= 0) return null;
    }
    return null;
  }

  /** Copies the inclusive box into a flat Uint16Array (x-major, then y, then z). */
  copyBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Uint16Array {
    const sx = x1 - x0 + 1;
    const sy = y1 - y0 + 1;
    const sz = z1 - z0 + 1;
    const arr = new Uint16Array(sx * sy * sz);
    let i = 0;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) arr[i++] = this.get(x, y, z);
    return arr;
  }

  pasteBox(x0: number, y0: number, z0: number, sx: number, sy: number, sz: number, arr: Uint16Array): void {
    let i = 0;
    for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) this.set(x0 + x, y0 + y, z0 + z, arr[i++]);
  }

  totalBlocks(): number {
    let n = 0;
    for (const c of this.chunks.values()) n += c.count;
    return n;
  }
}

export { isSolid };
