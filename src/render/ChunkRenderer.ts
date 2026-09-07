import * as THREE from 'three';
import type { VoxelWorld, Chunk } from '../world/VoxelWorld';
import { meshChunk, type MeshData } from '../world/ChunkMesher';
import type { VoxelMaterials } from './VoxelMaterial';

interface ChunkData {
  opaque: MeshData | null;
  transparent: MeshData | null;
}

interface Region {
  key: number;
  chunks: Set<number>;
  opaque?: THREE.Mesh;
  transparent?: THREE.Mesh;
  dirty: boolean;
}

/** Chunks per region side: 4 × 16 m = 64 m regions, about one fortress each. */
const REGION_CHUNKS = 4;

function regionKey(cx: number, cy: number, cz: number): number {
  const rx = Math.floor(cx / REGION_CHUNKS) + 512;
  const ry = Math.floor(cy / REGION_CHUNKS) + 512;
  const rz = Math.floor(cz / REGION_CHUNKS) + 512;
  return (rx * 1024 + ry) * 1024 + rz;
}

/**
 * Keeps three.js meshes in sync with the voxel world. Chunks are remeshed individually within a
 * time budget, then the chunks of a 64 m region are concatenated into one geometry per material, so
 * a whole fortress costs two draw calls (and two shadow draws) instead of dozens.
 */
export class ChunkRenderer {
  readonly group = new THREE.Group();
  private data = new Map<number, ChunkData>();
  private regions = new Map<number, Region>();

  constructor(private world: VoxelWorld, private materials: VoxelMaterials) {
    this.group.name = 'voxels';
  }

  /** Remeshes dirty chunks and rebuilds their regions. Returns true when work remains. */
  update(budgetMs = 6): boolean {
    const start = performance.now();
    const world = this.world;
    let more = false;
    for (const chunk of world.dirty) {
      this.rebuild(chunk);
      world.dirty.delete(chunk);
      chunk.dirty = false;
      if (performance.now() - start > budgetMs) {
        more = world.dirty.size > 0;
        break;
      }
    }
    this.mergeDirtyRegions(world);
    return more;
  }

  /** Remesh everything now (used after big edits / loads). */
  flush(): void {
    for (const chunk of this.world.dirty) {
      this.rebuild(chunk);
      chunk.dirty = false;
    }
    this.world.dirty.clear();
    this.mergeDirtyRegions(this.world);
  }

  private region(chunk: Chunk): Region {
    const key = regionKey(chunk.cx, chunk.cy, chunk.cz);
    let r = this.regions.get(key);
    if (!r) {
      r = { key, chunks: new Set(), dirty: false };
      this.regions.set(key, r);
    }
    return r;
  }

  private rebuild(chunk: Chunk): void {
    const r = this.region(chunk);
    r.dirty = true;
    if (chunk.count === 0) {
      this.data.delete(chunk.key);
      r.chunks.delete(chunk.key);
      return;
    }
    const result = meshChunk(this.world, chunk.cx, chunk.cy, chunk.cz);
    this.data.set(chunk.key, { opaque: result.opaque, transparent: result.transparent });
    r.chunks.add(chunk.key);
  }

  /** Rebuilds dirty regions, skipping any whose chunks are still queued (one merge per edit, not per frame). */
  private mergeDirtyRegions(world: VoxelWorld): void {
    for (const r of this.regions.values()) {
      if (!r.dirty) continue;
      let pending = false;
      for (const c of world.dirty) {
        if (regionKey(c.cx, c.cy, c.cz) === r.key) {
          pending = true;
          break;
        }
      }
      if (pending) continue;
      r.dirty = false;
      const opaque: MeshData[] = [];
      const transparent: MeshData[] = [];
      for (const ck of r.chunks) {
        const d = this.data.get(ck);
        if (!d) continue;
        if (d.opaque) opaque.push(d.opaque);
        if (d.transparent) transparent.push(d.transparent);
      }
      r.opaque = this.applyMesh(r.opaque, opaque, this.materials.opaque, true);
      r.transparent = this.applyMesh(r.transparent, transparent, this.materials.transparent, false);
      if (!r.opaque && !r.transparent && r.chunks.size === 0) this.regions.delete(r.key);
    }
  }

  /** Concatenates chunk meshes into one indexed geometry. */
  private concat(parts: MeshData[]): THREE.BufferGeometry {
    let verts = 0;
    let idx = 0;
    for (const p of parts) {
      verts += p.positions.length / 3;
      idx += p.indices.length;
    }
    const positions = new Float32Array(verts * 3);
    const normals = new Float32Array(verts * 3);
    const uvs = new Float32Array(verts * 2);
    const tints = new Float32Array(verts * 3);
    const mats = new Float32Array(verts);
    const aos = new Float32Array(verts);
    const indices = new Uint32Array(idx);
    let v = 0;
    let n = 0;
    for (const p of parts) {
      positions.set(p.positions, v * 3);
      normals.set(p.normals, v * 3);
      uvs.set(p.uvs, v * 2);
      tints.set(p.tints, v * 3);
      mats.set(p.mats, v);
      aos.set(p.aos, v);
      for (let i = 0; i < p.indices.length; i++) indices[n + i] = p.indices[i] + v;
      v += p.positions.length / 3;
      n += p.indices.length;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('aUv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('aTint', new THREE.BufferAttribute(tints, 3));
    geo.setAttribute('aMat', new THREE.BufferAttribute(mats, 1));
    geo.setAttribute('aAo', new THREE.BufferAttribute(aos, 1));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  }

  private applyMesh(existing: THREE.Mesh | undefined, parts: MeshData[], material: THREE.Material, shadows: boolean): THREE.Mesh | undefined {
    if (parts.length === 0) {
      if (existing) {
        this.group.remove(existing);
        existing.geometry.dispose();
      }
      return undefined;
    }
    const geo = this.concat(parts);
    if (existing) {
      existing.geometry.dispose();
      existing.geometry = geo;
      return existing;
    }
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = true;
    this.group.add(mesh);
    return mesh;
  }

  /** Approximate voxel triangle count (debug). */
  get triangles(): number {
    let t = 0;
    for (const d of this.data.values()) t += ((d.opaque?.indices.length ?? 0) + (d.transparent?.indices.length ?? 0)) / 3;
    return t;
  }

  dispose(): void {
    for (const r of this.regions.values()) {
      for (const m of [r.opaque, r.transparent]) {
        if (m) {
          this.group.remove(m);
          m.geometry.dispose();
        }
      }
    }
    this.regions.clear();
    this.data.clear();
  }
}
