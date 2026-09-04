import * as THREE from 'three';
import type { VoxelWorld, Chunk } from '../world/VoxelWorld';
import { meshChunk, type MeshData } from '../world/ChunkMesher';
import type { VoxelMaterials } from './VoxelMaterial';

interface ChunkMeshes {
  opaque?: THREE.Mesh;
  transparent?: THREE.Mesh;
}

/** Keeps three.js meshes in sync with the voxel world, remeshing dirty chunks within a time budget. */
export class ChunkRenderer {
  readonly group = new THREE.Group();
  private meshes = new Map<number, ChunkMeshes>();

  constructor(private world: VoxelWorld, private materials: VoxelMaterials) {
    this.group.name = 'voxels';
  }

  /** Remeshes dirty chunks. Returns true when work remains. */
  update(budgetMs = 6): boolean {
    const start = performance.now();
    const world = this.world;
    for (const chunk of world.dirty) {
      this.rebuild(chunk);
      world.dirty.delete(chunk);
      chunk.dirty = false;
      if (performance.now() - start > budgetMs) return world.dirty.size > 0;
    }
    return false;
  }

  /** Remesh everything now (used after big edits / loads). */
  flush(): void {
    for (const chunk of this.world.dirty) {
      this.rebuild(chunk);
      chunk.dirty = false;
    }
    this.world.dirty.clear();
  }

  private rebuild(chunk: Chunk): void {
    let entry = this.meshes.get(chunk.key);
    if (chunk.count === 0) {
      if (entry) {
        this.disposeEntry(entry);
        this.meshes.delete(chunk.key);
      }
      return;
    }
    const result = meshChunk(this.world, chunk.cx, chunk.cy, chunk.cz);
    if (!entry) {
      entry = {};
      this.meshes.set(chunk.key, entry);
    }
    entry.opaque = this.applyMesh(entry.opaque, result.opaque, this.materials.opaque, true);
    entry.transparent = this.applyMesh(entry.transparent, result.transparent, this.materials.transparent, false);
  }

  private applyMesh(existing: THREE.Mesh | undefined, data: MeshData | null, material: THREE.Material, shadows: boolean): THREE.Mesh | undefined {
    if (!data) {
      if (existing) {
        this.group.remove(existing);
        existing.geometry.dispose();
      }
      return undefined;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    geo.setAttribute('aUv', new THREE.BufferAttribute(data.uvs, 2));
    geo.setAttribute('aTint', new THREE.BufferAttribute(data.tints, 3));
    geo.setAttribute('aMat', new THREE.BufferAttribute(data.mats, 1));
    geo.setAttribute('aAo', new THREE.BufferAttribute(data.aos, 1));
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
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

  private disposeEntry(entry: ChunkMeshes): void {
    for (const m of [entry.opaque, entry.transparent]) {
      if (m) {
        this.group.remove(m);
        m.geometry.dispose();
      }
    }
  }

  dispose(): void {
    for (const e of this.meshes.values()) this.disposeEntry(e);
    this.meshes.clear();
  }
}
