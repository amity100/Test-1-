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
  /** Region grid coordinates (world metres = r * REGION_CHUNKS * 16). */
  rx: number;
  ry: number;
  rz: number;
  chunks: Set<number>;
  opaque?: THREE.Mesh;
  transparent?: THREE.Mesh;
  dirty: boolean;
}

/** Vertex attributes of a voxel geometry and their item sizes. */
const ATTRS: [string, number][] = [
  ['position', 3],
  ['normal', 3],
  ['aUv', 2],
  ['aTint', 3],
  ['aMat', 1],
  ['aAo', 1],
  ['aLit', 2],
];

/**
 * Chunks per region side: 2 × 16 m = 32 m regions. A region is rebuilt whole whenever one of its
 * chunks changes, so with twelve builders adding modules all match long the regions have to be
 * small enough that a rebuild is a couple of milliseconds, not a stutter.
 */
const REGION_CHUNKS = 2;
/** Regions rebuilt per frame at most; the rest wait for the next frame. */
const MERGES_PER_FRAME = 1;
/**
 * How far from the viewer a region still casts a shadow. The sun's shadow camera covers eighty
 * metres around the player, so anything beyond this was drawn into the shadow map for nothing — and
 * with a city of a hundred regions that second pass was the most expensive thing in the frame.
 */
const SHADOW_RANGE = 96;

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
  /** Where the viewer is: dirty chunks nearest to it are meshed first. */
  readonly focus = new THREE.Vector3();
  private order: Chunk[] = [];

  constructor(private world: VoxelWorld, private materials: VoxelMaterials) {
    this.group.name = 'voxels';
  }

  /**
   * Remeshes dirty chunks within a time budget, nearest to the viewer first, then rebuilds a couple
   * of their regions. Returns true when work remains. At least one chunk is meshed per call so the
   * queue always drains.
   */
  update(budgetMs = 4): boolean {
    const start = performance.now();
    const world = this.world;
    if (world.dirty.size > 0) {
      const fx = this.focus.x;
      const fy = this.focus.y;
      const fz = this.focus.z;
      const order = this.order;
      order.length = 0;
      for (const c of world.dirty) order.push(c);
      if (order.length > 1) {
        const d = (c: Chunk): number => {
          const dx = c.cx * 16 + 8 - fx;
          const dy = c.cy * 16 + 8 - fy;
          const dz = c.cz * 16 + 8 - fz;
          return dx * dx + dy * dy + dz * dz;
        };
        order.sort((a, b) => d(a) - d(b));
      }
      for (const chunk of order) {
        this.rebuild(chunk);
        world.dirty.delete(chunk);
        chunk.dirty = false;
        if (performance.now() - start > budgetMs) break;
      }
    }
    // A region rebuild is the other big bill of the frame, so it waits for a frame that has budget
    // left — unless the queue has drained, when one region per frame is the pace regardless.
    if (world.dirty.size === 0 || performance.now() - start < budgetMs) this.mergeDirtyRegions(world, MERGES_PER_FRAME);
    this.tuneShadows();
    return world.dirty.size > 0 || this.pendingMerges > 0;
  }

  /** Only the regions the sun's shadow camera actually covers are drawn into the shadow map. */
  private tuneShadows(): void {
    const size = REGION_CHUNKS * 16;
    const half = size / 2;
    const reach = SHADOW_RANGE + half;
    for (const r of this.regions.values()) {
      const m = r.opaque;
      if (!m) continue;
      const dx = r.rx * size + half - this.focus.x;
      const dy = r.ry * size + half - this.focus.y;
      const dz = r.rz * size + half - this.focus.z;
      const near = dx * dx + dy * dy + dz * dz < reach * reach;
      if (m.castShadow !== near) m.castShadow = near;
    }
  }

  /** Remesh everything now (used after big edits / loads). */
  flush(): void {
    for (const chunk of this.world.dirty) {
      this.rebuild(chunk);
      chunk.dirty = false;
    }
    this.world.dirty.clear();
    this.mergeDirtyRegions(this.world, Infinity);
  }
  private pendingMerges = 0;

  private region(chunk: Chunk): Region {
    const key = regionKey(chunk.cx, chunk.cy, chunk.cz);
    let r = this.regions.get(key);
    if (!r) {
      r = {
        key,
        rx: Math.floor(chunk.cx / REGION_CHUNKS),
        ry: Math.floor(chunk.cy / REGION_CHUNKS),
        rz: Math.floor(chunk.cz / REGION_CHUNKS),
        chunks: new Set(),
        dirty: false,
      };
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

  /** Rebuilds up to `limit` dirty regions, skipping any whose chunks are still queued (one merge per edit, not per frame). */
  private mergeDirtyRegions(world: VoxelWorld, limit: number): void {
    let merged = 0;
    let left = 0;
    for (const r of this.regions.values()) {
      if (!r.dirty) continue;
      if (merged >= limit) {
        left++;
        continue;
      }
      let pending = false;
      for (const c of world.dirty) {
        if (regionKey(c.cx, c.cy, c.cz) === r.key) {
          pending = true;
          break;
        }
      }
      if (pending) {
        left++;
        continue;
      }
      r.dirty = false;
      merged++;
      const opaque: MeshData[] = [];
      const transparent: MeshData[] = [];
      for (const ck of r.chunks) {
        const d = this.data.get(ck);
        if (!d) continue;
        if (d.opaque) opaque.push(d.opaque);
        if (d.transparent) transparent.push(d.transparent);
      }
      r.opaque = this.applyMesh(r.opaque, opaque, this.materials.opaque, true, r);
      r.transparent = this.applyMesh(r.transparent, transparent, this.materials.transparent, false, r);
      if (!r.opaque && !r.transparent && r.chunks.size === 0) this.regions.delete(r.key);
    }
    this.pendingMerges = left;
  }

  /**
   * Writes the chunk meshes of a region into its mesh. The geometry keeps its buffers between
   * rebuilds and only grows when the region outgrows them, so a rebuild is a copy into memory that
   * already exists and an upload of the part in use — no fresh multi-megabyte arrays for the
   * garbage collector to chase every time a builder taps.
   */
  private applyMesh(existing: THREE.Mesh | undefined, parts: MeshData[], material: THREE.Material, shadows: boolean, r: Region): THREE.Mesh | undefined {
    if (parts.length === 0) {
      if (existing) {
        this.group.remove(existing);
        existing.geometry.dispose();
      }
      return undefined;
    }
    let verts = 0;
    let idx = 0;
    for (const p of parts) {
      verts += p.positions.length / 3;
      idx += p.indices.length;
    }
    let mesh = existing;
    let geo = mesh?.geometry;
    const pos = geo?.getAttribute('position') as THREE.BufferAttribute | undefined;
    const fits = !!geo && !!pos && pos.array.length >= verts * 3 && (geo.index?.array.length ?? 0) >= idx;
    if (!geo || !fits) {
      const cap = Math.ceil(verts * 1.25) + 64;
      const icap = Math.ceil(idx * 1.25) + 96;
      const ng = new THREE.BufferGeometry();
      for (const [name, size] of ATTRS) {
        const a = new THREE.BufferAttribute(new Float32Array(cap * size), size);
        a.setUsage(THREE.DynamicDrawUsage);
        ng.setAttribute(name, a);
      }
      const ix = new THREE.BufferAttribute(new Uint32Array(icap), 1);
      ix.setUsage(THREE.DynamicDrawUsage);
      ng.setIndex(ix);
      if (mesh) {
        mesh.geometry.dispose();
        mesh.geometry = ng;
      } else {
        mesh = new THREE.Mesh(ng, material);
        mesh.castShadow = shadows;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.frustumCulled = true;
        this.group.add(mesh);
      }
      geo = ng;
    }
    const attr = (name: string): THREE.BufferAttribute => geo!.getAttribute(name) as THREE.BufferAttribute;
    const positions = attr('position').array as Float32Array;
    const normals = attr('normal').array as Float32Array;
    const uvs = attr('aUv').array as Float32Array;
    const tints = attr('aTint').array as Float32Array;
    const mats = attr('aMat').array as Float32Array;
    const aos = attr('aAo').array as Float32Array;
    const lits = attr('aLit').array as Float32Array;
    const indices = geo.index!.array as Uint32Array;
    let v = 0;
    let n = 0;
    for (const p of parts) {
      positions.set(p.positions, v * 3);
      normals.set(p.normals, v * 3);
      uvs.set(p.uvs, v * 2);
      tints.set(p.tints, v * 3);
      mats.set(p.mats, v);
      aos.set(p.aos, v);
      lits.set(p.lits, v * 2);
      const pi = p.indices;
      for (let i = 0; i < pi.length; i++) indices[n + i] = pi[i] + v;
      v += p.positions.length / 3;
      n += pi.length;
    }
    for (const [name, size] of ATTRS) {
      const a = attr(name);
      a.clearUpdateRanges();
      a.addUpdateRange(0, v * size);
      a.needsUpdate = true;
    }
    const ix = geo.index!;
    ix.clearUpdateRanges();
    ix.addUpdateRange(0, n);
    ix.needsUpdate = true;
    geo.setDrawRange(0, n);
    // Bounds are the region's own cube: exact enough for culling, and no pass over the vertices.
    const size = REGION_CHUNKS * 16;
    const min = new THREE.Vector3(r.rx * size, r.ry * size, r.rz * size);
    const max = min.clone().addScalar(size);
    geo.boundingBox = new THREE.Box3(min, max);
    geo.boundingSphere = new THREE.Sphere(min.clone().add(max).multiplyScalar(0.5), (size * Math.sqrt(3)) / 2);
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
