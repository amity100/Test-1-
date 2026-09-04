import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Terrain } from '../world/Terrain';
import { Random } from '../core/Random';
import { WORLD_HALF } from '../world/Layout';
import type { QualityProfile } from './Renderer';

function bladeAlphaTexture(): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(size * 0.3, size);
  ctx.quadraticCurveTo(size * 0.32, size * 0.4, size * 0.5, 0);
  ctx.quadraticCurveTo(size * 0.68, size * 0.4, size * 0.7, size);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/** Instanced grass, trees, rocks and flowers scattered over the island. */
export class Foliage {
  readonly group = new THREE.Group();
  private grassUniforms = { uTime: { value: 0 } };

  constructor(private terrain: Terrain, private rng: Random) {
    this.group.name = 'foliage';
  }

  build(profile: QualityProfile): void {
    this.group.clear();
    this.buildGrass(profile.grass);
    this.buildTrees(profile.trees);
    this.buildRocks(110);
    this.buildFlowers(700);
  }

  private canPlace(x: number, z: number, minH: number, maxSlope: number, plotMargin: number): boolean {
    if (Math.abs(x) > WORLD_HALF - 3 || Math.abs(z) > WORLD_HALF - 3) return false;
    const h = this.terrain.heightAt(x, z);
    if (h < minH) return false;
    if (this.terrain.slopeAt(x, z) > maxSlope) return false;
    for (const p of this.terrain.plots) {
      const dx = Math.max(p.minX - x, 0, x - (p.maxX + 1));
      const dz = Math.max(p.minZ - z, 0, z - (p.maxZ + 1));
      if (Math.max(dx, dz) < plotMargin) return false;
    }
    return true;
  }

  private buildGrass(count: number): void {
    const blade = new THREE.PlaneGeometry(0.26, 1, 1, 3);
    blade.translate(0, 0.5, 0);
    const g2 = blade.clone().rotateY(Math.PI / 3);
    const g3 = blade.clone().rotateY(-Math.PI / 3);
    const geo = mergeGeometries([blade, g2, g3]);
    // Vertex colours: darker at the root.
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const root = new THREE.Color('#4a8a2c');
    const tip = new THREE.Color('#c2ea63');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      c.copy(root).lerp(tip, pos.getY(i));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      alphaMap: bladeAlphaTexture(),
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0,
    });
    const uniforms = this.grassUniforms;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `vec3 transformed = vec3(position);
          {
            vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
            float ph = iPos.x * 0.35 + iPos.z * 0.27;
            float sway = sin(uTime * 1.7 + ph) * 0.6 + sin(uTime * 2.9 + iPos.z * 0.9 + iPos.x * 0.4) * 0.3;
            float k = position.y * position.y;
            transformed.x += sway * 0.22 * k;
            transformed.z += cos(uTime * 1.3 + ph) * 0.12 * k;
          }`,
        );
      // Flat-ish lighting: push normals up so grass does not look like dark cards.
      shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);');
    };
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 6) {
      attempts++;
      const x = this.rng.range(-WORLD_HALF, WORLD_HALF);
      const z = this.rng.range(-WORLD_HALF, WORLD_HALF);
      if (!this.canPlace(x, z, 2.2, 0.5, 6)) continue;
      const density = this.terrain.noise.fbm2(x * 0.05, z * 0.05, 2) * 0.5 + 0.5;
      if (this.rng.next() > density * 1.2) continue;
      const h = this.terrain.heightAt(x, z);
      const sc = this.rng.range(0.32, 0.72);
      p.set(x, h - 0.05, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rng.range(0, Math.PI * 2));
      s.set(sc, sc * this.rng.range(0.8, 1.2), sc);
      m.compose(p, q, s);
      mesh.setMatrixAt(placed, m);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.name = 'grass';
    this.group.add(mesh);
  }

  private buildTrees(count: number): void {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 3.2, 7);
    trunkGeo.translate(0, 1.6, 0);
    const canopyParts: THREE.BufferGeometry[] = [];
    const blob = (x: number, y: number, z: number, r: number): void => {
      const g = new THREE.IcosahedronGeometry(r, 1);
      g.translate(x, y, z);
      canopyParts.push(g);
    };
    blob(0, 4.4, 0, 1.9);
    blob(1.1, 3.8, 0.4, 1.4);
    blob(-1.0, 3.9, -0.5, 1.3);
    blob(0.2, 3.6, 1.1, 1.2);
    blob(-0.3, 5.3, -0.2, 1.2);
    const canopyGeo = mergeGeometries(canopyParts);
    const pineGeo = mergeGeometries([
      new THREE.ConeGeometry(2.0, 3.0, 8).translate(0, 3.2, 0),
      new THREE.ConeGeometry(1.5, 2.6, 8).translate(0, 5.0, 0),
      new THREE.ConeGeometry(1.0, 2.2, 8).translate(0, 6.5, 0),
    ]);

    const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4a2f', roughness: 0.9 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, flatShading: true });
    const pineMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
    const pines = new THREE.InstancedMesh(pineGeo, pineMat, count);
    for (const im of [trunks, canopies, pines]) {
      im.castShadow = true;
      im.receiveShadow = true;
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();
    let placed = 0;
    let nCanopy = 0;
    let nPine = 0;
    let attempts = 0;
    const positions: [number, number][] = [];
    while (placed < count && attempts < count * 40) {
      attempts++;
      const x = this.rng.range(-WORLD_HALF, WORLD_HALF);
      const z = this.rng.range(-WORLD_HALF, WORLD_HALF);
      if (!this.canPlace(x, z, 2.5, 0.38, 16)) continue;
      if (Math.sqrt(x * x + z * z) < 28) continue;
      let tooClose = false;
      for (const [px, pz] of positions) {
        if ((px - x) * (px - x) + (pz - z) * (pz - z) < 36) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      positions.push([x, z]);
      const h = this.terrain.heightAt(x, z);
      const sc = this.rng.range(0.8, 1.5);
      p.set(x, h - 0.2, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rng.range(0, Math.PI * 2));
      s.set(sc, sc, sc);
      m.compose(p, q, s);
      trunks.setMatrixAt(placed, m);
      const isPine = this.terrain.noise.noise2(x * 0.02, z * 0.02) > 0.15;
      if (isPine) {
        pines.setMatrixAt(nPine, m);
        col.setHSL(0.36 + this.rng.range(-0.03, 0.03), 0.5, 0.22 + this.rng.range(-0.04, 0.06));
        pines.setColorAt(nPine, col);
        nPine++;
      } else {
        canopies.setMatrixAt(nCanopy, m);
        col.setHSL(0.27 + this.rng.range(-0.06, 0.06), 0.62, 0.36 + this.rng.range(-0.06, 0.08));
        canopies.setColorAt(nCanopy, col);
        nCanopy++;
      }
      placed++;
    }
    trunks.count = placed;
    canopies.count = nCanopy;
    pines.count = nPine;
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    pines.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    if (pines.instanceColor) pines.instanceColor.needsUpdate = true;
    this.group.add(trunks, canopies, pines);
  }

  private buildRocks(count: number): void {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: '#7d7a74', roughness: 0.92, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 30) {
      attempts++;
      const x = this.rng.range(-WORLD_HALF, WORLD_HALF);
      const z = this.rng.range(-WORLD_HALF, WORLD_HALF);
      if (!this.canPlace(x, z, 0.4, 0.9, 12)) continue;
      const h = this.terrain.heightAt(x, z);
      const sc = this.rng.range(0.5, 2.2);
      p.set(x, h - sc * 0.35, z);
      q.setFromEuler(new THREE.Euler(this.rng.range(0, 3), this.rng.range(0, 3), this.rng.range(0, 3)));
      s.set(sc * this.rng.range(0.7, 1.4), sc * this.rng.range(0.5, 1.0), sc * this.rng.range(0.7, 1.4));
      m.compose(p, q, s);
      mesh.setMatrixAt(placed, m);
      col.setHSL(0.08, 0.05, 0.4 + this.rng.range(-0.1, 0.15));
      mesh.setColorAt(placed, col);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
  }

  private buildFlowers(count: number): void {
    const geo = new THREE.IcosahedronGeometry(0.16, 0);
    geo.translate(0, 0.35, 0);
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.08 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.receiveShadow = true;
    const palette = ['#ff5f8f', '#ffd23f', '#ffffff', '#7aa7ff', '#ff8c42', '#c77dff'];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    const col = new THREE.Color();
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 20) {
      attempts++;
      const x = this.rng.range(-WORLD_HALF, WORLD_HALF);
      const z = this.rng.range(-WORLD_HALF, WORLD_HALF);
      if (!this.canPlace(x, z, 2.4, 0.4, 8)) continue;
      const h = this.terrain.heightAt(x, z);
      p.set(x, h, z);
      m.compose(p, q, s);
      mesh.setMatrixAt(placed, m);
      col.set(this.rng.pick(palette));
      mesh.setColorAt(placed, col);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
  }

  update(time: number): void {
    this.grassUniforms.uTime.value = time;
  }
}
