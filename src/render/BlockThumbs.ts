import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { VoxelMaterials } from './VoxelMaterial';
import { PALETTE, PALETTE_LINEAR, blockColor, isTransparent, type Mat } from '../world/Voxel';
import { PREFABS, type PrefabId } from '../world/Prefabs';
import { STYLES, type StyleId, type BlockRole } from '../world/Styles';

const SIZE = 96;

/** Cube geometry (0..1) carrying the voxel material's per-vertex attributes for one block kind. */
function blockGeometry(mat: number, color: number): THREE.BufferGeometry {
  const faces: { c: number[][]; n: number[]; uv: [number, number] }[] = [
    { c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], n: [1, 0, 0], uv: [2, 1] },
    { c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], n: [-1, 0, 0], uv: [2, 1] },
    { c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], n: [0, 1, 0], uv: [0, 2] },
    { c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], n: [0, -1, 0], uv: [0, 2] },
    { c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], n: [0, 0, 1], uv: [0, 1] },
    { c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], n: [0, 0, -1], uv: [0, 1] },
  ];
  const pos: number[] = [];
  const nor: number[] = [];
  const uvs: number[] = [];
  const tint: number[] = [];
  const mats: number[] = [];
  const aos: number[] = [];
  const idx: number[] = [];
  const r = PALETTE_LINEAR[color * 3];
  const g = PALETTE_LINEAR[color * 3 + 1];
  const b = PALETTE_LINEAR[color * 3 + 2];
  for (const f of faces) {
    const base = pos.length / 3;
    for (const c of f.c) {
      pos.push(c[0], c[1], c[2]);
      nor.push(f.n[0], f.n[1], f.n[2]);
      uvs.push(c[f.uv[0]], c[f.uv[1]]);
      tint.push(r, g, b);
      mats.push(mat);
      aos.push(1);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('aUv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aTint', new THREE.Float32BufferAttribute(tint, 3));
  geo.setAttribute('aMat', new THREE.Float32BufferAttribute(mats, 1));
  geo.setAttribute('aAo', new THREE.Float32BufferAttribute(aos, 1));
  geo.setIndex(idx);
  return geo;
}

/**
 * Renders small icons of blocks (with the real PBR block material) and prefabs, so the build
 * UI shows what you will actually get. Results are cached as data URLs.
 */
export class BlockThumbs {
  private cache = new Map<string, string>();
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  private rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { depthBuffer: true, samples: 4 });
  private pixels = new Uint8Array(SIZE * SIZE * 4);
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private prefabMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 });

  constructor(
    private renderer: THREE.WebGLRenderer,
    private materials: VoxelMaterials,
    env: THREE.Texture | null,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext('2d')!;
    const sun = new THREE.DirectionalLight(0xfff2e0, 2.6);
    sun.position.set(2.5, 4, 1.5);
    const fill = new THREE.DirectionalLight(0xbfd8ff, 0.9);
    fill.position.set(-2, 1.5, -1.5);
    const hemi = new THREE.HemisphereLight(0xdfe9ff, 0x60553a, 0.9);
    this.scene.add(sun, fill, hemi);
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.7;
  }

  private snapshot(root: THREE.Object3D, center: THREE.Vector3, radius: number): string {
    this.scene.add(root);
    const dir = new THREE.Vector3(1, 0.78, 1).normalize();
    const dist = radius / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.08;
    this.camera.position.copy(center).addScaledVector(dir, dist);
    this.camera.lookAt(center);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevColor = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    const prevAuto = r.autoClear;
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.autoClear = true;
    r.clear();
    r.render(this.scene, this.camera);
    r.readRenderTargetPixels(this.rt, 0, 0, SIZE, SIZE, this.pixels);
    r.setRenderTarget(prevTarget);
    r.setClearColor(prevColor, prevAlpha);
    r.autoClear = prevAuto;
    this.scene.remove(root);
    // Flip vertically into the 2D canvas.
    const img = this.ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) {
      const src = (SIZE - 1 - y) * SIZE * 4;
      img.data.set(this.pixels.subarray(src, src + SIZE * 4), y * SIZE * 4);
    }
    this.ctx.putImageData(img, 0, 0);
    return this.canvas.toDataURL('image/png');
  }

  /** Icon of a single block of the given material and palette colour. */
  block(mat: Mat, color: number): string {
    const key = `b${mat}:${color}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const geo = blockGeometry(mat, color);
    const mesh = new THREE.Mesh(geo, isTransparent(mat) ? this.materials.transparent : this.materials.opaque);
    const url = this.snapshot(mesh, new THREE.Vector3(0.5, 0.5, 0.5), 0.92);
    geo.dispose();
    this.cache.set(key, url);
    return url;
  }

  /** Icon of a prefab at a given size, coloured with the style's role palette. */
  prefab(id: PrefabId, size: number, style: StyleId): string {
    const key = `p${id}:${size}:${style}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const blocks = PREFABS[id].build(size).filter((b) => b.role !== 'air');
    const roles = STYLES[style].roles;
    const parts: THREE.BufferGeometry[] = [];
    const col = new THREE.Color();
    const box = new THREE.Box3();
    for (const b of blocks) {
      const g = new THREE.BoxGeometry(1, 1, 1);
      g.translate(b.x + 0.5, b.y + 0.5, b.z + 0.5);
      const hex = PALETTE[blockColor(roles[b.role as BlockRole])] ?? '#888888';
      col.set(hex);
      const n = g.attributes.position.count;
      const colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      parts.push(g);
      box.expandByPoint(new THREE.Vector3(b.x, b.y, b.z));
      box.expandByPoint(new THREE.Vector3(b.x + 1, b.y + 1, b.z + 1));
    }
    let url = '';
    if (parts.length) {
      const merged = mergeGeometries(parts, false);
      const mesh = new THREE.Mesh(merged, this.prefabMat);
      const center = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).length() * 0.5;
      url = this.snapshot(mesh, center, radius);
      merged.dispose();
    }
    for (const p of parts) p.dispose();
    this.cache.set(key, url);
    return url;
  }

  dispose(): void {
    this.rt.dispose();
    this.prefabMat.dispose();
  }
}
