import * as THREE from 'three';
import { mulberry32, Simplex2 } from '../core/noise';
import type { TextureSet } from '../world/Textures';
import { foliageMaterial, gnarlyTube } from '../world/Vegetation';
import { cypressTree, oliveTree, type TreeDetail } from '../world/TreeGen';
import { rockGeometry } from '../world/RockGen';
import { rockMaterial } from '../world/Rocks';
import { gibeahHeight, gibeahNormal, PLATEAU_R, SUMMIT } from './palaceTerrain';
import { FORT, GATE, TAMARISK } from './palaceLayout';
import type { PalaceTextures, PalaceTier } from './palaceMaterials';

const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const NZ = new Simplex2(5150);

export interface Vegetation {
  group: THREE.Group;
  tamarisk: THREE.Group;
  /** top centre of the stone seat under the tamarisk, and the yaw its sitter faces */
  tamariskSeat: THREE.Vector3;
  tamariskSeatYaw: number;
  /** crown centre of the tamarisk (camera targets) */
  tamariskCrown: THREE.Vector3;
  stats: Record<string, number>;
}

/** Leaf card like the world trees (atlas cell, crown-bent normals, occlusion tint in vertex colours). */
class CardBuilder {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  wind: number[] = [];
  idx: number[] = [];
  add(center: THREE.Vector3, grow: THREE.Vector3, w: number, h: number, crownC: THREE.Vector3, crownR: number, cell: number, tint: [number, number, number], rnd: () => number, windW: number, phase: number) {
    const u = grow.clone().normalize();
    const tmp = Math.abs(u.y) < 0.9 ? V3(0, 1, 0) : V3(1, 0, 0);
    const side = new THREE.Vector3().crossVectors(u, tmp).normalize().applyAxisAngle(u, rnd() * Math.PI * 2);
    const cu = (cell % 2) * 0.5, cv = cell < 2 ? 0.5 : 0;
    const base = this.pos.length / 3;
    const flip = rnd() < 0.5;
    const out = new THREE.Vector3();
    for (const [sx, sy] of [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]] as [number, number][]) {
      const p = center.clone().addScaledVector(side, sx * w).addScaledVector(u, sy * h);
      this.pos.push(p.x, p.y, p.z);
      out.copy(p).sub(crownC);
      out.y *= 0.6;
      out.normalize().lerp(V3(0, 1, 0), 0.25).normalize();
      this.nor.push(out.x, out.y, out.z);
      const uu = flip ? 0.5 - (sx + 0.5) * 0.5 : (sx + 0.5) * 0.5;
      this.uv.push(cu + uu * 0.998 + 0.001, cv + sy * 0.499 + 0.0005);
      const depth = Math.min(1, p.distanceTo(crownC) / crownR);
      const lowShade = THREE.MathUtils.smoothstep(p.y - crownC.y, -crownR * 0.8, crownR * 0.2);
      const ao = (0.42 + 0.58 * Math.pow(depth, 0.9)) * (0.7 + 0.3 * lowShade);
      this.col.push(tint[0] * ao, tint[1] * ao, tint[2] * ao);
      this.wind.push(windW * (0.4 + 0.6 * sy), phase + sy * 0.1);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.wind, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

function barkMat(world: TextureSet, color: number) {
  const m = new THREE.MeshStandardMaterial({ map: world.bark, normalMap: world.barkN, roughness: 0.95, metalness: 0, color });
  m.normalScale.set(1.6, 1.6);
  return m;
}

/**
 * The great tamarisk (אֵשֶׁל, Tamarix aphylla) on the height: a short, massive, furrowed multi-stemmed trunk,
 * wide spreading limbs and a broad dome of drooping, jointed grey-green branchlets.
 */
function buildTamarisk(world: TextureSet, tex: PalaceTextures, tier: PalaceTier) {
  const rnd = mulberry32(22 * 6);
  const group = new THREE.Group();
  group.name = 'palace:tamarisk';
  const barkGeos: THREE.BufferGeometry[] = [];
  const radial = tier === 'high' ? 14 : tier === 'medium' ? 10 : 7;
  const tubular = tier === 'low' ? 10 : 22;
  const cards = new CardBuilder();
  const crownC = V3(0, 6.4, 0);
  const crownR = 6.6;
  const clusters: { c: THREE.Vector3; dir: THREE.Vector3; r: number }[] = [];
  // two fused stems twisting around each other
  const stems = 3;
  const tops: THREE.Vector3[] = [];
  for (let s = 0; s < stems; s++) {
    const a = (s / stems) * Math.PI * 2 + 0.4;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const aa = a + t * 1.3;
      const rr = 0.28 * (1 - t) + t * (0.5 + 0.6 * t);
      pts.push(V3(Math.cos(aa) * rr, -0.4 + t * 3.1, Math.sin(aa) * rr));
    }
    barkGeos.push(gnarlyTube(pts, 0.5 - s * 0.06, 0.26, tubular, radial, 0.22, 11 + s));
    tops.push(pts[pts.length - 1]);
  }
  // main limbs: wide, low, spreading
  const limbs = tier === 'low' ? 6 : 8;
  for (let l = 0; l < limbs; l++) {
    const from = tops[l % stems].clone();
    const a = (l / limbs) * Math.PI * 2 + rnd() * 0.5;
    const len = 3.6 + rnd() * 2.2;
    const up = 1.6 + rnd() * 2.2;
    const end = from.clone().add(V3(Math.cos(a) * len, up, Math.sin(a) * len));
    const mid = from.clone().lerp(end, 0.45).add(V3((rnd() - 0.5) * 0.8, 0.6 + rnd() * 0.5, (rnd() - 0.5) * 0.8));
    const r0 = 0.24 + rnd() * 0.06;
    barkGeos.push(gnarlyTube([from.clone().add(V3(0, -0.3, 0)), mid, end], r0, 0.07, tubular, Math.max(6, radial - 4), 0.18, 40 + l));
    const dir = end.clone().sub(from).normalize();
    // secondary branches
    const nb = tier === 'low' ? 2 : 3;
    for (let b = 0; b < nb; b++) {
      const s = mid.clone().lerp(end, 0.2 + rnd() * 0.7);
      const d2 = dir.clone().add(V3((rnd() - 0.5) * 1.6, 0.3 + rnd() * 0.7, (rnd() - 0.5) * 1.6)).normalize();
      const e2 = s.clone().addScaledVector(d2, 1.6 + rnd() * 1.6);
      if (tier !== 'low') barkGeos.push(gnarlyTube([s, s.clone().lerp(e2, 0.5).add(V3(0, 0.25, 0)), e2], 0.07, 0.025, 8, 5, 0.1, 80 + l * 5 + b));
      clusters.push({ c: e2, dir: d2, r: 1.5 + rnd() * 0.6 });
      clusters.push({ c: s.clone().lerp(e2, 0.5), dir: d2, r: 1.2 });
    }
    clusters.push({ c: end, dir, r: 1.7 });
  }
  // extra fill so the dome reads as one mass with some gaps
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2, r = crownR * (0.3 + rnd() * 0.6);
    const c = crownC.clone().add(V3(Math.cos(a) * r, (rnd() - 0.2) * 2.4, Math.sin(a) * r));
    clusters.push({ c, dir: c.clone().sub(crownC).normalize(), r: 1.4 + rnd() * 0.6 });
  }
  const perCluster = tier === 'high' ? 22 : tier === 'medium' ? 15 : 9;
  for (const cl of clusters) {
    for (let i = 0; i < perCluster; i++) {
      const p = V3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
      if (p.lengthSq() > 1) p.normalize();
      const c = cl.c.clone().addScaledVector(p, cl.r * 0.8);
      // branchlets droop: each card hangs from its top edge (atlas v = 1) at the cluster point
      const grow = V3((rnd() - 0.5) * 0.25, 1, (rnd() - 0.5) * 0.25).normalize();
      const size = 0.9 + rnd() * 0.9;
      const k = 0.85 + rnd() * 0.3;
      const tint: [number, number, number] = [k * 0.98, k, k * 0.97];
      const hang = c.clone().addScaledVector(grow, -size);
      cards.add(hang, grow, size * 0.95, size, crownC, crownR, Math.floor(rnd() * 4), tint, rnd, 0.6 + 0.4 * Math.min(1, c.distanceTo(crownC) / crownR), rnd());
    }
  }
  const bark = barkMat(world, 0x5e5650);
  for (const g of barkGeos) {
    const m = new THREE.Mesh(g, bark);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  const fol = foliageMaterial(tex.tamarisk, { sway: 0.22, flutter: 0.05, translucency: 0.25, color: 0xc4c6bc, roughness: 0.85 });
  const leaves = new THREE.Mesh(cards.geometry(), fol);
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  leaves.name = 'palace:tamariskLeaves';
  group.add(leaves);
  return { group, crownC, cards: cards.pos.length / 12 };
}

export function buildVegetation(world: TextureSet, tex: PalaceTextures, tier: PalaceTier, houseSpots: [number, number, number][]): Vegetation {
  const group = new THREE.Group();
  group.name = 'palace:vegetation';
  const rnd = mulberry32(777);
  const stats: Record<string, number> = {};
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();

  // ---------------------------------------------------------------- the tamarisk on the height
  const tam = buildTamarisk(world, tex, tier);
  const ty = gibeahHeight(TAMARISK.x, TAMARISK.z);
  tam.group.position.set(TAMARISK.x, ty - 0.1, TAMARISK.z);
  tam.group.rotation.y = 0.6;
  group.add(tam.group);
  stats.tamariskCards = tam.cards;

  // ---------------------------------------------------------------- rocks: bedrock on the height, boulders on the slopes
  const rockMat = rockMaterial(world, 0xf4efe6, 1.3, 'palace');
  const rockGeos = [rockGeometry(31, { kind: 'slab', detail: tier === 'low' ? 3 : 5 }), rockGeometry(32, { kind: 'boulder', detail: tier === 'low' ? 3 : 5 }), rockGeometry(33, { kind: 'block', detail: tier === 'low' ? 3 : 4 })];
  const nRocks = tier === 'high' ? 320 : tier === 'medium' ? 220 : 120;
  const rockLists: THREE.Matrix4[][] = [[], [], []];
  const place = (x: number, z: number, s: number, kind: number, sink = 0.3, yaw = rnd() * 6.28) => {
    const y = gibeahHeight(x, z);
    const n = gibeahNormal(x, z);
    q.setFromUnitVectors(V3(0, 1, 0), n.lerp(V3(0, 1, 0), 0.5).normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), yaw));
    s3.set(s * (0.9 + rnd() * 0.4), s * (0.55 + rnd() * 0.4), s * (0.9 + rnd() * 0.4));
    rockLists[kind].push(new THREE.Matrix4().compose(V3(x, y - s * sink, z), q, s3.clone()));
  };
  // the knoll under the tamarisk ("the height")
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2, r = 3 + rnd() * 7;
    place(TAMARISK.x + Math.cos(a) * r, TAMARISK.z + Math.sin(a) * r, 0.8 + rnd() * 1.4, i % 2, 0.45);
  }
  // the seat: a broad flat limestone slab under the tamarisk, facing south-east (toward the morning sun)
  const seatYaw = 0.95;
  const seatPos = V3(TAMARISK.x - 1.4, 0, TAMARISK.z + 2.3);
  seatPos.y = gibeahHeight(seatPos.x, seatPos.z);
  const seatH = 0.46;
  q.setFromAxisAngle(V3(0, 1, 0), seatYaw + Math.PI / 2);
  rockLists[2].push(new THREE.Matrix4().compose(V3(seatPos.x, seatPos.y + seatH - 0.62 * 0.6, seatPos.z), q, V3(1.25, 0.62, 0.62)));
  const tamariskSeat = V3(seatPos.x, seatPos.y + seatH, seatPos.z);
  let tries = 0;
  while (rockLists[0].length + rockLists[1].length + rockLists[2].length < nRocks && tries++ < 6000) {
    const a = rnd() * Math.PI * 2;
    const r = Math.pow(rnd(), 0.7) * 260;
    const x = SUMMIT.x + Math.cos(a) * r, z = SUMMIT.z + Math.sin(a) * r;
    // not inside the citadel, not on the gate road, not in houses
    if (x > FORT.x0 - 4 && x < FORT.x1 + 5 && z > FORT.z0 - 4 && z < FORT.z1 + 4) continue;
    if (Math.abs(z - (GATE.z0 + GATE.z1) / 2) < 4 && x > FORT.x1 && x < FORT.x1 + 70) continue;
    if (houseSpots.some(([hx, hz, hr]) => Math.hypot(hx - x, hz - z) < hr)) continue;
    const n = NZ.noise(x * 0.03, z * 0.03);
    if (n < -0.1 && rnd() < 0.7) continue;
    const onTop = r < PLATEAU_R + 8;
    place(x, z, onTop ? 0.6 + rnd() * 1.6 : 0.4 + rnd() * 1.1, onTop ? (rnd() < 0.6 ? 0 : 1) : Math.floor(rnd() * 3), onTop ? 0.5 : 0.35);
  }
  rockLists.forEach((list, k) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(rockGeos[k], rockMat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true;
    im.receiveShadow = true;
    im.name = 'palace:rocks' + k;
    group.add(im);
  });
  stats.rocks = rockLists.reduce((a, l) => a + l.length, 0);

  // ---------------------------------------------------------------- olive groves on the terraces, a few cypresses
  const detail: TreeDetail = tier === 'high' ? { radial: 7, rings: 3, cards: 1 } : tier === 'medium' ? { radial: 6, rings: 2, cards: 0.8 } : { radial: 5, rings: 1.5, cards: 0.6 };
  const variants = tier === 'low' ? 2 : 3;
  const olives = Array.from({ length: variants }, (_, i) => oliveTree(501 + i * 17, detail));
  const oliveBark = barkMat(world, 0x9c9082);
  const oliveLeaf = foliageMaterial(world.olive, { sway: 0.16, flutter: 0.04, translucency: 0.35 });
  const nNear = tier === 'high' ? 190 : tier === 'medium' ? 130 : 70;
  const nFar = tier === 'high' ? 1700 : tier === 'medium' ? 1100 : 550;
  const near: THREE.Matrix4[][] = olives.map(() => []);
  const far: THREE.Matrix4[] = [];
  tries = 0;
  const treeOk = (x: number, z: number, r: number) => {
    if (x > FORT.x0 - 8 && x < FORT.x1 + 10 && z > FORT.z0 - 8 && z < FORT.z1 + 8) return false;
    if (Math.hypot(x - TAMARISK.x, z - TAMARISK.z) < 16) return false;
    if (houseSpots.some(([hx, hz, hr]) => Math.hypot(hx - x, hz - z) < hr + 2)) return false;
    // groves in patches (terraced orchards), open fields elsewhere
    const n = NZ.noise(x * 0.012 + 3, z * 0.012) + NZ.noise(x * 0.05, z * 0.05) * 0.3;
    return n > (r < 400 ? -0.15 : 0.1);
  };
  while ((near.reduce((a, l) => a + l.length, 0) < nNear || far.length < nFar) && tries++ < 30000) {
    const a = rnd() * Math.PI * 2;
    const r = PLATEAU_R + 12 + Math.pow(rnd(), 1.4) * 1100;
    const x = SUMMIT.x + Math.cos(a) * r, z = SUMMIT.z + Math.sin(a) * r / 0.82;
    if (!treeOk(x, z, r)) continue;
    const y = gibeahHeight(x, z);
    const sc = 0.85 + rnd() * 0.4;
    q.setFromAxisAngle(V3(0, 1, 0), rnd() * 6.28);
    if (r < 240) {
      if (near.reduce((a2, l) => a2 + l.length, 0) >= nNear) continue;
      near[Math.floor(rnd() * variants)].push(new THREE.Matrix4().compose(V3(x, y, z), q, V3(sc, sc, sc)));
    } else if (far.length < nFar) {
      far.push(new THREE.Matrix4().compose(V3(x, y + 1.9 * sc, z), q, V3(2.6 * sc, 2.0 * sc, 2.6 * sc)));
    }
  }
  olives.forEach((t, k) => {
    const list = near[k];
    if (!list.length) return;
    const b = new THREE.InstancedMesh(t.bark, oliveBark, list.length);
    const l = new THREE.InstancedMesh(t.leaves, oliveLeaf, list.length);
    list.forEach((m, i) => {
      b.setMatrixAt(i, m);
      l.setMatrixAt(i, m);
    });
    for (const im of [b, l]) {
      im.castShadow = true;
      im.receiveShadow = true;
      group.add(im);
    }
  });
  stats.olivesNear = near.reduce((a, l) => a + l.length, 0);
  // far groves: lumpy low-poly crowns (a few pixels each from the aerial shots)
  const blob = new THREE.IcosahedronGeometry(1, tier === 'low' ? 0 : 1);
  {
    const p = blob.getAttribute('position') as THREE.BufferAttribute;
    const col: number[] = [];
    for (let i = 0; i < p.count; i++) {
      p3.fromBufferAttribute(p, i);
      const k = 1 + NZ.noise(p3.x * 2.1, p3.z * 2.1 + p3.y) * 0.25;
      p.setXYZ(i, p3.x * k, p3.y * k * 0.85, p3.z * k);
      const shade = 0.55 + 0.45 * THREE.MathUtils.smoothstep(p3.y, -0.8, 0.8);
      col.push(0.06 * shade, 0.07 * shade, 0.04 * shade);
    }
    blob.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    blob.computeVertexNormals();
  }
  const blobMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: false });
  const farIm = new THREE.InstancedMesh(blob, blobMat, far.length);
  far.forEach((m, i) => farIm.setMatrixAt(i, m));
  farIm.castShadow = tier !== 'low';
  farIm.receiveShadow = true;
  farIm.name = 'palace:farGroves';
  group.add(farIm);
  stats.olivesFar = far.length;
  // cypresses: dark vertical accents by the village and the road
  const cyp = cypressTree(909, detail);
  const cypLeaf = foliageMaterial(world.cypress, { sway: 0.1, flutter: 0.02, translucency: 0.2 });
  const cypCore = new THREE.MeshStandardMaterial({ map: world.cypress, vertexColors: true, roughness: 0.9, metalness: 0, color: 0x9aa58f });
  const cypList: THREE.Matrix4[] = [];
  tries = 0;
  while (cypList.length < (tier === 'low' ? 8 : 16) && tries++ < 2000) {
    const a = rnd() * Math.PI * 2, r = 70 + rnd() * 180;
    const x = SUMMIT.x + Math.cos(a) * r, z = SUMMIT.z + Math.sin(a) * r;
    if (!houseSpots.some(([hx, hz, hr]) => Math.hypot(hx - x, hz - z) < hr + 8 && Math.hypot(hx - x, hz - z) > hr)) continue;
    const s = 0.8 + rnd() * 0.4;
    q.setFromAxisAngle(V3(0, 1, 0), rnd() * 6.28);
    cypList.push(new THREE.Matrix4().compose(V3(x, gibeahHeight(x, z), z), q, V3(s, s, s)));
  }
  const parts: [THREE.BufferGeometry, THREE.Material][] = [[cyp.bark, oliveBark], [cyp.leaves, cypLeaf]];
  if (cyp.core) parts.push([cyp.core, cypCore]);
  for (const [g, m] of parts) {
    const im = new THREE.InstancedMesh(g, m, cypList.length);
    cypList.forEach((mm, i) => im.setMatrixAt(i, mm));
    im.castShadow = true;
    im.receiveShadow = true;
    group.add(im);
  }
  stats.cypress = cypList.length;

  // ---------------------------------------------------------------- shrubs and dry grass tufts (sage, thorny burnet, thistle)
  const shrubMat = foliageMaterial(world.shrub, { sway: 0.12, flutter: 0.05, translucency: 0.3, roughness: 0.85 });
  const sb = new CardBuilder();
  const nShrub = tier === 'high' ? 2600 : tier === 'medium' ? 1500 : 700;
  tries = 0;
  let shrubs = 0;
  while (shrubs < nShrub && tries++ < 40000) {
    const nearTam = rnd() < 0.3;
    const a = rnd() * Math.PI * 2;
    const r = nearTam ? 4 + rnd() * 22 : PLATEAU_R - 15 + Math.pow(rnd(), 1.6) * 160;
    const cx = nearTam ? TAMARISK.x : SUMMIT.x, cz = nearTam ? TAMARISK.z : SUMMIT.z;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (x > FORT.x0 - 1 && x < FORT.x1 + 1 && z > FORT.z0 - 1 && z < FORT.z1 + 1) continue;
    if (Math.abs(z - (GATE.z0 + GATE.z1) / 2) < 3.2 && x > FORT.x1 && x < FORT.x1 + 60) continue;
    if (houseSpots.some(([hx, hz, hr]) => Math.hypot(hx - x, hz - z) < hr)) continue;
    const y = gibeahHeight(x, z);
    const cell = rnd() < 0.55 ? Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 2);
    const size = cell >= 2 ? 0.45 + rnd() * 0.4 : 0.55 + rnd() * 0.6;
    const cc = V3(x, y + size * 0.3, z);
    const k = 0.85 + rnd() * 0.3;
    for (let c = 0; c < 3; c++) {
      const grow = V3((rnd() - 0.5) * 0.5, 1, (rnd() - 0.5) * 0.5).normalize();
      sb.add(V3(x + (rnd() - 0.5) * size * 0.3, y - 0.05, z + (rnd() - 0.5) * size * 0.3), grow, size * 1.1, size, cc, size, cell, [k, k * 0.98, k * 0.92], rnd, 0.5, rnd());
    }
    shrubs++;
  }
  const sm = new THREE.Mesh(sb.geometry(), shrubMat);
  sm.castShadow = tier !== 'low';
  sm.receiveShadow = true;
  sm.name = 'palace:shrubs';
  group.add(sm);
  stats.shrubs = shrubs;

  const tamariskCrown = tam.crownC.clone().applyMatrix4(tam.group.matrixWorld.compose(tam.group.position, tam.group.quaternion, tam.group.scale));
  return { group, tamarisk: tam.group, tamariskSeat, tamariskSeatYaw: seatYaw, tamariskCrown, stats };
}
