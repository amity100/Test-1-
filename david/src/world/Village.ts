import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/noise';
import type { Colliders } from '../core/Colliders';
import type { Terrain } from './Terrain';
import type { TextureSet } from './Textures';
import { LAYOUT } from './Layout';
import { boulderGeometry, rockMaterial } from './Rocks';

/** World-space triplanar masonry (fieldstone + mud plaster) — no UVs needed for merged buildings. */
function masonryMaterial(tex: TextureSet, map: THREE.Texture, normal: THREE.Texture, scale: number, tint: number, key: string) {
  const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.93, vertexColors: true });
  mat.onBeforeCompile = (s) => {
    s.uniforms.tMap = { value: map };
    s.uniforms.tNor = { value: normal };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vMWPos; varying vec3 vMWN;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
vMWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vMWN = normalize(mat3(modelMatrix) * objectNormal);`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tMap; uniform sampler2D tNor; varying vec3 vMWPos; varying vec3 vMWN; vec3 mWN;`)
      .replace(
        '#include <map_fragment>',
        `{
  vec3 Nw = normalize(vMWN);
  vec3 bw = pow(abs(Nw), vec3(6.0)); bw /= (bw.x + bw.y + bw.z);
  vec3 p = vMWPos / ${scale.toFixed(2)};
  vec3 c = texture2D(tMap, p.zy).rgb * bw.x + texture2D(tMap, p.xz).rgb * bw.y + texture2D(tMap, p.xy).rgb * bw.z;
  diffuseColor.rgb *= c;
  vec3 nx = texture2D(tNor, p.zy).xyz * 2.0 - 1.0, ny = texture2D(tNor, p.xz).xyz * 2.0 - 1.0, nz = texture2D(tNor, p.xy).xyz * 2.0 - 1.0;
  mWN = normalize(bw.x * normalize(vec3(0.0, nx.y, nx.x * sign(Nw.x)) + Nw) + bw.y * normalize(vec3(ny.x, 0.0, -ny.y) + Nw) + bw.z * normalize(vec3(nz.x * sign(Nw.z), nz.y, 0.0) + Nw));
}`,
      )
      .replace('#include <normal_fragment_maps>', `normal = normalize((viewMatrix * vec4(mWN, 0.0)).xyz);`);
  };
  mat.customProgramCacheKey = () => 'masonry-' + key;
  void tex;
  return mat;
}

function colorize(g: THREE.BufferGeometry, c: THREE.Color) {
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.index) return g.toNonIndexed();
  return g;
}

export class Village {
  readonly group = new THREE.Group();
  readonly smokeSources: THREE.Vector3[] = [];
  readonly gate = new THREE.Vector3();
  readonly rachelPillar = new THREE.Vector3();

  constructor(private terrain: Terrain, private tex: TextureSet, private colliders: Colliders) {}

  build() {
    const rnd = mulberry32(1004);
    const L = LAYOUT.bethlehem;
    const walls: THREE.BufferGeometry[] = [];
    const roofs: THREE.BufferGeometry[] = [];
    const dark: THREE.BufferGeometry[] = [];
    const cloth: THREE.BufferGeometry[] = [];
    const baseY = this.terrain.heightAt(L.x, L.z);
    const houses: { x: number; z: number; w: number; d: number; rot: number }[] = [];
    const tint = new THREE.Color();

    const box = (w: number, h: number, d: number, x: number, y: number, z: number, rot: number, cx: number, cz: number, col: THREE.Color) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(x, y + h / 2, z);
      g.rotateY(rot);
      g.translate(cx, 0, cz);
      return colorize(g, col);
    };

    // Houses clustered on the crest, oriented loosely along lanes
    for (let tries = 0; tries < 900 && houses.length < 58; tries++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * (L.r - 6);
      const x = L.x + Math.cos(a) * r;
      const z = L.z + Math.sin(a) * r;
      const w = 6 + rnd() * 5;
      const d = 7 + rnd() * 5;
      const rot = Math.round(rnd() * 4) * (Math.PI / 2) + (rnd() - 0.5) * 0.25 + 0.3;
      let ok = true;
      for (const h of houses) if (Math.hypot(h.x - x, h.z - z) < (Math.max(w, d) + Math.max(h.w, h.d)) * 0.62) ok = false;
      if (!ok) continue;
      houses.push({ x, z, w, d, rot });
    }
    for (const h of houses) {
      const y = Math.min(
        this.terrain.heightAt(h.x - h.w / 2, h.z - h.d / 2), this.terrain.heightAt(h.x + h.w / 2, h.z - h.d / 2),
        this.terrain.heightAt(h.x - h.w / 2, h.z + h.d / 2), this.terrain.heightAt(h.x + h.w / 2, h.z + h.d / 2),
      ) - 0.4;
      const storeys = rnd() < 0.22 ? 2 : 1;
      const H = (storeys === 2 ? 5.2 : 2.9) + rnd() * 0.4;
      tint.setHSL(0.09 + rnd() * 0.02, 0.18 + rnd() * 0.1, 0.72 + rnd() * 0.12);
      walls.push(box(h.w, H, h.d, 0, y, 0, h.rot, h.x, h.z, tint));
      // parapet
      const pc = tint.clone().multiplyScalar(0.95);
      walls.push(box(h.w + 0.1, 0.45, 0.25, 0, y + H, h.d / 2 - 0.12, h.rot, h.x, h.z, pc));
      walls.push(box(h.w + 0.1, 0.45, 0.25, 0, y + H, -h.d / 2 + 0.12, h.rot, h.x, h.z, pc));
      // flat roof of beams + packed clay
      const rc = new THREE.Color().setHSL(0.07, 0.25, 0.42 + rnd() * 0.1);
      roofs.push(box(h.w + 0.35, 0.22, h.d + 0.35, 0, y + H - 0.05, 0, h.rot, h.x, h.z, rc));
      // doorway + small high windows
      const dc = new THREE.Color(0x1a1410);
      dark.push(box(1.1, 1.9, 0.12, (rnd() - 0.5) * h.w * 0.4, y + 0.3, h.d / 2 + 0.02, h.rot, h.x, h.z, dc));
      for (let wi = 0; wi < 2; wi++) dark.push(box(0.45, 0.4, 0.1, (wi - 0.5) * h.w * 0.5, y + H - 1.0, -h.d / 2 - 0.03, h.rot, h.x, h.z, dc));
      // courtyard wall
      if (rnd() < 0.55) {
        const cd = 4 + rnd() * 3;
        const cc = tint.clone().multiplyScalar(0.9);
        walls.push(box(0.5, 1.6, cd, h.w / 2 - 0.25, y, h.d / 2 + cd / 2, h.rot, h.x, h.z, cc));
        walls.push(box(0.5, 1.6, cd, -h.w / 2 + 0.25, y, h.d / 2 + cd / 2, h.rot, h.x, h.z, cc));
        walls.push(box(h.w * 0.35, 1.6, 0.5, h.w * 0.32, y, h.d / 2 + cd, h.rot, h.x, h.z, cc));
      }
      // woven awnings / drying cloths (madder red, indigo, undyed)
      if (rnd() < 0.35) {
        const g = new THREE.PlaneGeometry(2.4 + rnd() * 1.5, 1.6 + rnd());
        g.rotateX(-Math.PI / 2 + 0.25);
        g.translate(0, y + H + 1.3, 0);
        g.rotateY(h.rot);
        g.translate(h.x, 0, h.z);
        const hues = [new THREE.Color(0x8e2f23), new THREE.Color(0x2e3f6b), new THREE.Color(0xd9ccb0), new THREE.Color(0xa0662a)];
        cloth.push(colorize(g, hues[Math.floor(rnd() * hues.length)]));
        const pole = box(0.08, 1.5, 0.08, 0.9, y + H, 0.6, h.rot, h.x, h.z, new THREE.Color(0x4a3a2a));
        roofs.push(pole);
      }
      if (rnd() < 0.12) this.smokeSources.push(new THREE.Vector3(h.x, y + H + 0.3, h.z));
      // colliders: a few circles along the long axis
      const steps = 3;
      for (let s = 0; s < steps; s++) {
        const t = (s / (steps - 1) - 0.5) * (Math.max(h.w, h.d) - Math.min(h.w, h.d));
        const along = h.w > h.d ? new THREE.Vector3(t, 0, 0) : new THREE.Vector3(0, 0, t);
        along.applyAxisAngle(new THREE.Vector3(0, 1, 0), h.rot);
        this.colliders.add({ x: h.x + along.x, z: h.z + along.z, r: Math.min(h.w, h.d) * 0.55, tag: 'house' });
      }
    }
    // Town wall ring with a gate facing the shepherds' path (east)
    const gateAngle = Math.atan2(LAYOUT.path[LAYOUT.path.length - 1][1] - L.z, LAYOUT.path[LAYOUT.path.length - 1][0] - L.x);
    this.gate.set(L.x + Math.cos(gateAngle) * (L.r + 2), 0, L.z + Math.sin(gateAngle) * (L.r + 2));
    this.gate.y = this.terrain.heightAt(this.gate.x, this.gate.z);
    const segs = 64;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      let da = Math.abs(am - gateAngle);
      da = Math.min(da, Math.PI * 2 - da);
      if (da < 0.07) continue; // gate opening
      const rr = L.r + 2 + Math.sin(i * 1.7) * 1.2;
      const x0 = L.x + Math.cos(a0) * rr, z0 = L.z + Math.sin(a0) * rr;
      const x1 = L.x + Math.cos(a1) * rr, z1 = L.z + Math.sin(a1) * rr;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const y = this.terrain.heightAt(mx, mz) - 0.8;
      const g = new THREE.BoxGeometry(len + 0.3, 3.4, 1.4);
      g.translate(0, y + 1.7, 0);
      g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
      g.translate(mx, 0, mz);
      tint.setHSL(0.09, 0.14, 0.66 + Math.sin(i * 3.1) * 0.04);
      walls.push(colorize(g, tint));
      this.colliders.add({ x: mx, z: mz, r: len * 0.55, tag: 'wall' });
    }
    // gate towers
    for (const side of [-1, 1]) {
      const a = gateAngle + side * 0.095;
      const x = L.x + Math.cos(a) * (L.r + 2), z = L.z + Math.sin(a) * (L.r + 2);
      const y = this.terrain.heightAt(x, z) - 0.8;
      walls.push(box(3.2, 5.2, 3.2, 0, y, 0, -a, x, z, new THREE.Color().setHSL(0.09, 0.14, 0.7)));
    }
    void baseY;

    const wallMat = masonryMaterial(this.tex, this.tex.wall, this.tex.wallN, 2.4, 0xf2e6d2, 'wall');
    const roofMat = masonryMaterial(this.tex, this.tex.soil, this.tex.soilN, 3.0, 0xc8b8a4, 'roof');
    const wallMesh = new THREE.Mesh(mergeGeometries(walls.map((g) => (g.index ? g.toNonIndexed() : g))), wallMat);
    const roofMesh = new THREE.Mesh(mergeGeometries(roofs.map((g) => (g.index ? g.toNonIndexed() : g))), roofMat);
    const darkMesh = new THREE.Mesh(mergeGeometries(dark), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    for (const m of [wallMesh, roofMesh, darkMesh]) {
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
    }
    if (cloth.length) {
      const clothMesh = new THREE.Mesh(mergeGeometries(cloth), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
      clothMesh.castShadow = true;
      this.group.add(clothMesh);
    }

    // Well / cistern by the gate (2 Samuel 23:15 — "the well of Bethlehem that is by the gate")
    const wx = this.gate.x + Math.cos(gateAngle) * 9 + 4, wz = this.gate.z + Math.sin(gateAngle) * 9 - 3;
    const wy = this.terrain.heightAt(wx, wz);
    const well = new THREE.Mesh(colorize(new THREE.CylinderGeometry(1.1, 1.25, 0.8, 18, 1, true), new THREE.Color(1, 1, 1)), masonryMaterial(this.tex, this.tex.wall, this.tex.wallN, 1.2, 0xe8dcc8, 'well'));
    well.position.set(wx, wy + 0.3, wz);
    well.castShadow = true;
    const wellHole = new THREE.Mesh(new THREE.CircleGeometry(1.05, 18), new THREE.MeshBasicMaterial({ color: 0x0a0806 }));
    wellHole.rotation.x = -Math.PI / 2;
    wellHole.position.set(wx, wy + 0.55, wz);
    this.group.add(well, wellHole);
    this.colliders.add({ x: wx, z: wz, r: 1.4, tag: 'well' });

    // Rachel's pillar (Genesis 35:20): a tall rough standing stone on a heap of fieldstones
    const R = LAYOUT.rachel;
    const ry = this.terrain.heightAt(R.x, R.z);
    this.rachelPillar.set(R.x, ry, R.z);
    const rmat = rockMaterial(this.tex, 0xf0e8da);
    const pillarGeo = new THREE.BoxGeometry(0.62, 2.7, 0.4, 4, 12, 3);
    {
      const pp = pillarGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pp.count; i++) {
        const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i);
        const taper = 1 - (y + 1.35) * 0.06;
        const n = Math.sin(y * 7.1 + x * 9) * 0.012 + Math.sin(z * 13 + y * 3) * 0.01;
        pp.setXYZ(i, x * taper + n, y + (y > 1.3 ? Math.sin(x * 5) * 0.06 : 0), z * taper + n);
      }
      pillarGeo.computeVertexNormals();
    }
    const pillar = new THREE.Mesh(pillarGeo, rmat);
    pillar.position.set(R.x, ry + 1.2, R.z);
    pillar.rotation.set(0.03, 0.6, -0.02);
    pillar.castShadow = pillar.receiveShadow = true;
    this.group.add(pillar);
    const heap = new THREE.InstancedMesh(boulderGeometry(3, 2), rmat, 22);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2, r = 0.5 + rnd() * 1.4;
      const s = 0.25 + rnd() * 0.35;
      m4.compose(new THREE.Vector3(R.x + Math.cos(a) * r, ry + s * 0.2 + (r < 1 ? 0.2 : 0), R.z + Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd())), new THREE.Vector3(s, s, s));
      heap.setMatrixAt(i, m4);
    }
    heap.castShadow = heap.receiveShadow = true;
    this.group.add(heap);
    this.colliders.add({ x: R.x, z: R.z, r: 1.6, tag: 'pillar' });

    // Threshing floor (גֹּרֶן): a circle of beaten earth with a straw heap
    const T = LAYOUT.threshing;
    const ty = this.terrain.heightAt(T.x, T.z);
    const floorGeo = new THREE.CircleGeometry(9, 40);
    floorGeo.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0xb59a74, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
    floor.position.set(T.x, ty + 0.06, T.z);
    floor.receiveShadow = true;
    const heapGeo = new THREE.SphereGeometry(2.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    heapGeo.scale(1, 0.55, 1);
    const straw = new THREE.Mesh(heapGeo, new THREE.MeshStandardMaterial({ color: 0xd8bb72, roughness: 1 }));
    straw.position.set(T.x + 3, ty, T.z - 2);
    straw.castShadow = straw.receiveShadow = true;
    this.group.add(floor, straw);
  }
}
