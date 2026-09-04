import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Terrain } from '../world/Terrain';
import { Random } from '../core/Random';
import { WORLD_HALF } from '../world/Layout';
import type { QualityProfile } from './Renderer';
import { PartBuilder } from './PartBuilder';
import { barkMaps, flowerTexture, leafClusterTexture, needleTexture, rockMaps } from './DetailTextures';

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

interface WindUniforms {
  uTime: { value: number };
}

/** Injects a gentle wind sway into a material's vertex shader (instanced or not). */
function addWind(mat: THREE.Material, uniforms: WindUniforms, strength: number, anchorY: number, falloff: number): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
        {
          #ifdef USE_INSTANCING
          vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #else
          vec3 iPos = vec3(0.0);
          #endif
          float ph = iPos.x * 0.21 + iPos.z * 0.17;
          float k = clamp((position.y - ${anchorY.toFixed(2)}) * ${falloff.toFixed(3)}, 0.0, 1.0);
          float sway = sin(uTime * 1.3 + ph) * 0.7 + sin(uTime * 2.3 + ph * 1.7 + position.y * 0.8) * 0.3;
          transformed.x += sway * ${strength.toFixed(3)} * k;
          transformed.z += cos(uTime * 1.1 + ph + position.x * 0.5) * ${(strength * 0.6).toFixed(3)} * k;
        }`,
      );
  };
}

/** Box-projected UVs in object space (for displaced rocks). */
function projectBoxUVs(g: THREE.BufferGeometry, density: number): void {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(nor, i);
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let u: number;
    let v: number;
    if (ax >= ay && ax >= az) {
      u = z;
      v = y;
    } else if (ay >= az) {
      u = x;
      v = z;
    } else {
      u = x;
      v = y;
    }
    uv[i * 2] = u * density;
    uv[i * 2 + 1] = v * density;
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
}

/** Leaf-card cluster: several textured quads around a centre with radial normals and height-graded shading. */
function leafCluster(rng: Random, centre: THREE.Vector3, radius: number, cards: number, size: number, canopyCentre: THREE.Vector3, yMin: number, yMax: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const nrm = new THREE.Vector3();
  for (let i = 0; i < cards; i++) {
    const s = size * rng.range(0.8, 1.2);
    const g = new THREE.PlaneGeometry(s, s);
    e.set(rng.range(-0.9, 0.9), rng.range(0, Math.PI * 2), rng.range(-0.5, 0.5));
    q.setFromEuler(e);
    g.applyQuaternion(q);
    const off = new THREE.Vector3(rng.range(-1, 1), rng.range(-0.7, 0.7), rng.range(-1, 1)).multiplyScalar(radius);
    const p = centre.clone().add(off);
    g.translate(p.x, p.y, p.z);
    // Radial normals from the canopy centre give the cluster a volumetric shading gradient.
    nrm.copy(p).sub(canopyCentre).normalize().lerp(new THREE.Vector3(0, 1, 0), 0.35).normalize();
    const na = g.attributes.normal as THREE.BufferAttribute;
    for (let k = 0; k < na.count; k++) na.setXYZ(k, nrm.x, nrm.y, nrm.z);
    // Vertex colour: darker toward the canopy underside.
    const shade = 0.5 + 0.5 * THREE.MathUtils.smoothstep(p.y, yMin, yMax);
    const col = new Float32Array(na.count * 3);
    for (let k = 0; k < na.count; k++) {
      col[k * 3] = shade;
      col[k * 3 + 1] = shade;
      col[k * 3 + 2] = shade;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.push(g);
  }
  return out;
}

/** Instanced grass, trees, bushes, rocks and flowers scattered over the island. */
export class Foliage {
  readonly group = new THREE.Group();
  private wind: WindUniforms = { uTime: { value: 0 } };
  private hi = true;
  private rockDetail = 2;

  constructor(private terrain: Terrain, private rng: Random) {
    this.group.name = 'foliage';
  }

  build(profile: QualityProfile): void {
    this.group.clear();
    this.hi = profile.grass >= 16000;
    this.rockDetail = profile.trees >= 180 ? 3 : 2;
    this.buildGrass(profile.grass);
    this.buildTrees(profile.trees);
    this.buildBushes(Math.round(profile.trees * 1.3));
    this.buildRocks(110);
    this.buildFlowers(700);
  }

  private canPlace(x: number, z: number, minH: number, maxSlope: number, plotMargin: number): boolean {
    if (this.terrain.pathWeight(x, z) > 0.35) return false;
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
    const root = new THREE.Color('#3f7a26');
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
    const uniforms = this.wind;
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
    const col = new THREE.Color();
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
      // Per-clump tint: yellower on dry high ground, bluer in damp valleys.
      col.setHSL(0.26 + (density - 0.5) * 0.08 + this.rng.range(-0.02, 0.02), 0.6, 0.5 + this.rng.range(-0.06, 0.06));
      mesh.setColorAt(placed, col);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.name = 'grass';
    this.group.add(mesh);
  }

  /** Broadleaf tree: lathe trunk with root flare, tapered branches and twigs, leaf-card clusters at the tips. */
  private makeBroadleaf(rng: Random): { wood: THREE.BufferGeometry; leaves: THREE.BufferGeometry } {
    const pb = new PartBuilder<string>({ uvDensity: 0.9 });
    const radial = this.hi ? 10 : 7;
    const height = rng.range(3.6, 4.6);
    const lean = rng.range(-0.06, 0.06);
    // Trunk profile with root flare and slight noise.
    const prof: THREE.Vector2[] = [];
    const rings = 8;
    for (let i = 0; i <= rings; i++) {
      const t = i / rings;
      const y = t * height;
      const flare = Math.pow(1 - t, 6) * 0.3;
      const r = 0.36 * (1 - t * 0.62) + flare;
      prof.push(new THREE.Vector2(r, y));
    }
    prof.push(new THREE.Vector2(0.02, height + 0.15));
    const trunk = new THREE.LatheGeometry(prof, radial);
    // Bark bumps and lean.
    const tp = trunk.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i);
      const y = tp.getY(i);
      const z = tp.getZ(i);
      const n = this.terrain.noise.noise3(x * 3.1, y * 1.3, z * 3.1) * 0.05 + this.terrain.noise.noise3(x * 9, y * 4, z * 9) * 0.02;
      const len = Math.hypot(x, z) || 1;
      tp.setXYZ(i, x + (x / len) * n + y * lean, y, z + (z / len) * n);
    }
    trunk.computeVertexNormals();
    pb.partM(trunk, 'wood', new THREE.Matrix4());
    trunk.dispose();

    const clusters: Array<{ p: THREE.Vector3; r: number }> = [];
    const branchCount = this.hi ? 5 : 4;
    const golden = 2.399963;
    const a0 = rng.range(0, Math.PI * 2);
    const branch = (from: THREE.Vector3, dir: THREE.Vector3, len: number, r0: number, r1: number, depth: number): void => {
      const to = from.clone().addScaledVector(dir, len);
      const geo = new THREE.CylinderGeometry(r1, r0, 1, depth === 0 ? (this.hi ? 7 : 6) : 5);
      pb.between(geo, 'wood', from, to, 1);
      geo.dispose();
      if (depth === 0) {
        // Twigs forking off the branch.
        for (let k = 0; k < (this.hi ? 2 : 1); k++) {
          const t = k === 0 ? 0.62 : 0.88;
          const at = from.clone().lerp(to, t);
          const side = new THREE.Vector3(rng.range(-1, 1), rng.range(0.2, 0.9), rng.range(-1, 1)).normalize();
          const tdir = dir.clone().lerp(side, 0.55).normalize();
          branch(at, tdir, len * rng.range(0.4, 0.55), r1 * 1.1, r1 * 0.35, 1);
        }
        clusters.push({ p: to.clone().addScaledVector(dir, 0.2), r: rng.range(0.55, 0.8) });
      } else {
        clusters.push({ p: to.clone(), r: rng.range(0.4, 0.55) });
      }
    };
    for (let i = 0; i < branchCount; i++) {
      const y = height * rng.range(0.55, 0.9);
      const ang = a0 + i * golden + rng.range(-0.3, 0.3);
      const elev = rng.range(0.55, 0.95);
      const dir = new THREE.Vector3(Math.cos(ang) * Math.cos(elev), Math.sin(elev), Math.sin(ang) * Math.cos(elev)).normalize();
      const rTrunk = 0.36 * (1 - (y / height) * 0.62);
      const from = new THREE.Vector3(y * lean + Math.cos(ang) * rTrunk * 0.6, y, Math.sin(ang) * rTrunk * 0.6);
      branch(from, dir, rng.range(1.5, 2.3), rTrunk * 0.55, 0.06, 0);
    }
    clusters.push({ p: new THREE.Vector3(height * lean, height + 0.3, 0), r: 0.7 });

    const canopyCentre = new THREE.Vector3(height * lean * 0.8, height * 0.98, 0);
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const c of clusters) {
      yMin = Math.min(yMin, c.p.y - c.r);
      yMax = Math.max(yMax, c.p.y + c.r);
    }
    const cards: THREE.BufferGeometry[] = [];
    for (const c of clusters) cards.push(...leafCluster(rng, c.p, c.r, this.hi ? 8 : 6, c.r * 2.1, canopyCentre, yMin, yMax));
    const leaves = mergeGeometries(cards)!;
    for (const g of cards) g.dispose();
    const wood = pb.merge().get('wood')!;
    return { wood, leaves };
  }

  /** Conifer: tall trunk with stacked, ragged needle skirts. */
  private makePine(rng: Random): { wood: THREE.BufferGeometry; needles: THREE.BufferGeometry } {
    const height = rng.range(6.5, 8.5);
    const trunk = new THREE.CylinderGeometry(0.08, 0.38, height, this.hi ? 8 : 6);
    trunk.translate(0, height / 2, 0);
    const wood = new PartBuilder<string>({ uvDensity: 0.9 });
    wood.partM(trunk, 'wood', new THREE.Matrix4());
    trunk.dispose();
    const tiers = this.hi ? 6 : 5;
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < tiers; i++) {
      const t = i / (tiers - 1);
      const y = 1.6 + t * (height - 2.0);
      const r = THREE.MathUtils.lerp(2.3, 0.7, t) * rng.range(0.9, 1.1);
      const h = THREE.MathUtils.lerp(2.1, 1.4, t);
      const cone = new THREE.ConeGeometry(r, h, this.hi ? 10 : 8, 1, true);
      // Ragged rim: jitter bottom-ring vertices in and out.
      const cp = cone.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < cp.count; k++) {
        if (cp.getY(k) < 0) {
          const jitter = 0.78 + rng.next() * 0.35;
          cp.setX(k, cp.getX(k) * jitter);
          cp.setZ(k, cp.getZ(k) * jitter);
          cp.setY(k, cp.getY(k) + rng.range(-0.15, 0.25));
        }
      }
      cone.computeVertexNormals();
      cone.translate(0, y + h * 0.35, 0);
      // Colour: lighter toward the top tiers.
      const shade = 0.72 + 0.28 * t;
      const col = new Float32Array(cp.count * 3);
      for (let k = 0; k < cp.count; k++) {
        const s = shade * (cp.getY(k) > y + h * 0.3 ? 1 : 0.85);
        col[k * 3] = s;
        col[k * 3 + 1] = s;
        col[k * 3 + 2] = s;
      }
      cone.setAttribute('color', new THREE.BufferAttribute(col, 3));
      parts.push(cone);
    }
    const needles = mergeGeometries(parts)!;
    for (const g of parts) g.dispose();
    return { wood: wood.merge().get('wood')!, needles };
  }

  private buildTrees(count: number): void {
    const bark = barkMaps();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xc9b9a6, roughness: 1, metalness: 0, map: bark.map, normalMap: bark.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: bark.roughnessMap });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: leafClusterTexture(), alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.8, metalness: 0 });
    addWind(leafMat, this.wind, 0.09, 2.0, 0.25);
    const needleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: needleTexture(), alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85, metalness: 0 });
    addWind(needleMat, this.wind, 0.05, 1.5, 0.2);

    const variants = this.hi ? 3 : 2;
    const broad = Array.from({ length: variants }, (_, i) => this.makeBroadleaf(new Random(1000 + i)));
    const pinesGeo = Array.from({ length: 2 }, (_, i) => this.makePine(new Random(2000 + i)));
    const cap = Math.ceil(count / 2) + 8;
    const broadWood = broad.map((b) => new THREE.InstancedMesh(b.wood, woodMat, cap));
    const broadLeaves = broad.map((b) => new THREE.InstancedMesh(b.leaves, leafMat, cap));
    const pineWood = pinesGeo.map((b) => new THREE.InstancedMesh(b.wood, woodMat, cap));
    const pineNeedles = pinesGeo.map((b) => new THREE.InstancedMesh(b.needles, needleMat, cap));
    const all = [...broadWood, ...broadLeaves, ...pineWood, ...pineNeedles];
    for (const im of all) {
      im.castShadow = true;
      im.receiveShadow = true;
      im.count = 0;
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();
    let placed = 0;
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
      const sc = this.rng.range(0.85, 1.4);
      p.set(x, h - 0.15, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rng.range(0, Math.PI * 2));
      s.set(sc, sc * this.rng.range(0.9, 1.15), sc);
      m.compose(p, q, s);
      const isPine = this.terrain.noise.noise2(x * 0.02, z * 0.02) > 0.15;
      if (isPine) {
        const v = this.rng.int(0, pinesGeo.length - 1);
        const w = pineWood[v];
        const n = pineNeedles[v];
        if (w.count >= cap) continue;
        w.setMatrixAt(w.count, m);
        n.setMatrixAt(n.count, m);
        col.setHSL(0.36 + this.rng.range(-0.03, 0.03), 0.45, 0.24 + this.rng.range(-0.04, 0.06));
        n.setColorAt(n.count, col);
        w.count++;
        n.count++;
      } else {
        const v = this.rng.int(0, broad.length - 1);
        const w = broadWood[v];
        const l = broadLeaves[v];
        if (w.count >= cap) continue;
        w.setMatrixAt(w.count, m);
        l.setMatrixAt(l.count, m);
        col.setHSL(0.26 + this.rng.range(-0.05, 0.06), 0.52, 0.4 + this.rng.range(-0.07, 0.08));
        l.setColorAt(l.count, col);
        w.count++;
        l.count++;
      }
      placed++;
    }
    for (const im of all) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.name = 'trees';
      this.group.add(im);
    }
  }

  private buildBushes(count: number): void {
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: leafClusterTexture(), alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85, metalness: 0 });
    addWind(leafMat, this.wind, 0.05, 0.2, 0.9);
    const variants = 2;
    const geos: THREE.BufferGeometry[] = [];
    for (let v = 0; v < variants; v++) {
      const rng = new Random(3000 + v);
      const centre = new THREE.Vector3(0, 0.7, 0);
      const cards = leafCluster(rng, centre, 0.55, this.hi ? 11 : 8, 1.15, new THREE.Vector3(0, 0.3, 0), -0.1, 1.4);
      cards.push(...leafCluster(rng, new THREE.Vector3(0.35, 0.45, 0.2), 0.3, 4, 0.9, new THREE.Vector3(0, 0.3, 0), -0.1, 1.4));
      geos.push(mergeGeometries(cards)!);
      for (const g of cards) g.dispose();
    }
    const meshes = geos.map((g) => new THREE.InstancedMesh(g, leafMat, count));
    for (const im of meshes) {
      im.castShadow = true;
      im.receiveShadow = true;
      im.count = 0;
    }
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
      if (!this.canPlace(x, z, 2.3, 0.45, 9)) continue;
      if (Math.sqrt(x * x + z * z) < 24) continue;
      const density = this.terrain.noise.fbm2(x * 0.04 + 3, z * 0.04, 2) * 0.5 + 0.5;
      if (this.rng.next() > density * 1.3) continue;
      const h = this.terrain.heightAt(x, z);
      const sc = this.rng.range(0.6, 1.35);
      p.set(x, h - 0.1, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rng.range(0, Math.PI * 2));
      s.set(sc, sc * this.rng.range(0.8, 1.1), sc);
      m.compose(p, q, s);
      const im = meshes[this.rng.int(0, meshes.length - 1)];
      im.setMatrixAt(im.count, m);
      col.setHSL(0.25 + this.rng.range(-0.05, 0.05), 0.55, 0.36 + this.rng.range(-0.06, 0.08));
      im.setColorAt(im.count, col);
      im.count++;
      placed++;
    }
    for (const im of meshes) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.name = 'bushes';
      this.group.add(im);
    }
  }

  /** Noise-displaced, smooth-shaded boulder with mossy tops. */
  private makeRock(rng: Random, detail: number): THREE.BufferGeometry {
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
    g = mergeVertices(g);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const noise = this.terrain.noise;
    const seed = rng.range(0, 100);
    const sx = rng.range(0.85, 1.3);
    const sy = rng.range(0.65, 0.95);
    const sz = rng.range(0.85, 1.2);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n1 = noise.noise3(v.x * 1.1 + seed, v.y * 1.1, v.z * 1.1) * 0.28;
      const n2 = noise.noise3(v.x * 3.2 + seed, v.y * 3.2, v.z * 3.2) * 0.09;
      const n3 = Math.abs(noise.noise3(v.x * 6.5, v.y * 6.5 + seed, v.z * 6.5)) * 0.04;
      v.multiplyScalar(1 + n1 + n2 + n3);
      v.x *= sx;
      v.y *= sy;
      v.z *= sz;
      // Flatten the base so rocks sit in the ground.
      if (v.y < -0.45) v.y = -0.45 - (Math.abs(v.y) - 0.45) * 0.2;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    projectBoxUVs(g, 0.7);
    // Moss on upward faces (vertex colour multiplies the rock tint).
    const nor = g.attributes.normal as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const moss = new THREE.Color(0.5, 0.72, 0.32);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const up = nor.getY(i);
      const k = THREE.MathUtils.smoothstep(up, 0.5, 0.95) * (noise.noise3(pos.getX(i) * 2 + seed, pos.getY(i) * 2, pos.getZ(i) * 2) * 0.5 + 0.5);
      c.setRGB(1, 1, 1).lerp(moss, Math.min(1, k * 1.3));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }

  private buildRocks(count: number): void {
    const rock = rockMaps();
    const mat = new THREE.MeshStandardMaterial({ color: 0xbfbab2, vertexColors: true, roughness: 1, metalness: 0, map: rock.map, normalMap: rock.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: rock.roughnessMap });
    const variants = 4;
    const detail = this.rockDetail;
    const meshes = Array.from({ length: variants }, (_, i) => new THREE.InstancedMesh(this.makeRock(new Random(4000 + i), detail), mat, count));
    for (const im of meshes) {
      im.castShadow = true;
      im.receiveShadow = true;
      im.count = 0;
    }
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
      p.set(x, h - sc * 0.3, z);
      q.setFromEuler(new THREE.Euler(this.rng.range(-0.25, 0.25), this.rng.range(0, Math.PI * 2), this.rng.range(-0.25, 0.25)));
      s.set(sc * this.rng.range(0.8, 1.3), sc * this.rng.range(0.7, 1.0), sc * this.rng.range(0.8, 1.3));
      m.compose(p, q, s);
      const im = meshes[this.rng.int(0, meshes.length - 1)];
      im.setMatrixAt(im.count, m);
      col.setHSL(0.08 + this.rng.range(-0.03, 0.03), 0.07, 0.62 + this.rng.range(-0.1, 0.12));
      im.setColorAt(im.count, col);
      im.count++;
      placed++;
    }
    for (const im of meshes) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.name = 'rocks';
      this.group.add(im);
    }
  }

  private buildFlowers(count: number): void {
    const a = new THREE.PlaneGeometry(0.36, 0.36);
    a.translate(0, 0.18, 0);
    const b = a.clone().rotateY(Math.PI / 2);
    const geo = mergeGeometries([a, b]);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: flowerTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.05 });
    addWind(mat, this.wind, 0.04, 0.0, 3.0);
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
      p.set(x, h - 0.02, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rng.range(0, Math.PI));
      const sc = this.rng.range(0.8, 1.3);
      s.set(sc, sc, sc);
      m.compose(p, q, s);
      mesh.setMatrixAt(placed, m);
      col.set(this.rng.pick(palette));
      mesh.setColorAt(placed, col);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.name = 'flowers';
    this.group.add(mesh);
  }

  update(time: number): void {
    this.wind.uTime.value = time;
  }
}
