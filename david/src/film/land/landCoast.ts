import * as THREE from 'three';
import type { TextureSet } from '../../world/Textures';
import type { LandTier } from './landTerrain';

/**
 * ASHDOD on its tell (shot 4 background) — one of the five Philistine cities (Josh 13:3; 1 Sam 6:17), where the
 * house of Dagon stood (1 Sam 5:1-2). [ARCH, Iron I Ashdod strata XIII-XI]: a city on a high mound a few km inland
 * of the dune belt; mudbrick fortification, dense flat-roofed mudbrick and plastered houses; a larger temple block.
 * Seen only from 2-4 km: a silhouette on the mound with evening smoke, never a close set. No towers with
 * crenellations, no arches, no domes, no columns on façades, no lettering.
 */
export function buildAshdod(tex: TextureSet, tier: LandTier, center: THREE.Vector3, ground: (x: number, z: number) => number, rnd: () => number) {
  const group = new THREE.Group();
  group.name = 'land:ashdod';
  const disp: { dispose(): void }[] = [];
  // ---- the mound: plateau ≈16 m above the plain, r ≈ 190 m, eroded slopes to r ≈ 320 m
  const NR = tier === 'low' ? 14 : 22, NA = tier === 'low' ? 40 : 64;
  const R0 = 190, R1 = 340, TOP = 21;
  const prof = (r: number, a: number) => {
    const wob = 1 + 0.08 * Math.sin(a * 3 + 1.3) + 0.05 * Math.sin(a * 7 + 0.4);
    const rr = r / wob;
    if (rr < R0) return TOP + Math.sin(a * 5) * 0.6 * (rr / R0);
    const t = Math.min(1, (rr - R0) / (R1 - R0));
    return TOP * (1 - t * t * (3 - 2 * t)) * (1 - 0.1 * Math.sin(a * 11 + rr * 0.05));
  };
  const pos: number[] = [], idx: number[] = [];
  const cy = ground(center.x, center.z);
  pos.push(center.x, cy + TOP, center.z);
  for (let i = 1; i <= NR; i++) {
    const r = (i / NR) * R1 * 1.05;
    for (let j = 0; j < NA; j++) {
      const a = (j / NA) * Math.PI * 2;
      const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
      const gy = ground(x, z);
      pos.push(x, Math.max(gy, cy + prof(r, a) - (i === NR ? 1.5 : 0)), z);
    }
  }
  for (let j = 0; j < NA; j++) idx.push(0, 1 + ((j + 1) % NA), 1 + j);
  for (let i = 0; i < NR - 1; i++) for (let j = 0; j < NA; j++) {
    const a = 1 + i * NA + j, b = 1 + i * NA + ((j + 1) % NA), c = a + NA, d = b + NA;
    idx.push(a, b, c, b, d, c);
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  tg.setIndex(idx);
  tg.computeVertexNormals();
  const uv = new Float32Array((pos.length / 3) * 2);
  for (let k = 0; k < pos.length / 3; k++) { uv[k * 2] = pos[k * 3] / 9; uv[k * 2 + 1] = pos[k * 3 + 2] / 9; }
  tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const tm = new THREE.MeshStandardMaterial({ color: 0xc9ad86, roughness: 1, map: tex.soil, normalMap: tex.soilN });
  const tell = new THREE.Mesh(tg, tm);
  tell.receiveShadow = true; tell.castShadow = true;
  group.add(tell);
  disp.push(tg, tm);
  // ---- mudbrick wall ring on the plateau edge, a gate gap on the east (the road leaves from it)
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  disp.push(box);
  const brick = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: tex.masonry, normalMap: tex.masonryN });
  disp.push(brick);
  const nWall = tier === 'low' ? 40 : 72;
  const nHouse = tier === 'low' ? 70 : tier === 'medium' ? 140 : 220;
  const inst = new THREE.InstancedMesh(box, brick, nWall + nHouse + 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  let k = 0;
  const put = (x: number, y: number, z: number, w: number, h: number, d: number, yaw: number, c: THREE.Color) => {
    q.setFromAxisAngle(up, yaw); m4.compose(p.set(x, y, z), q, s.set(w, h, d));
    inst.setMatrixAt(k, m4); inst.setColorAt(k, c); k++;
  };
  for (let i = 0; i < nWall; i++) {
    const a = (i / nWall) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a - 0.3), Math.cos(a - 0.3))) < 0.06) continue; // the gate (ESE)
    const wob = 1 + 0.08 * Math.sin(a * 3 + 1.3) + 0.05 * Math.sin(a * 7 + 0.4);
    const r = (R0 - 6) * wob;
    const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    const seg = (2 * Math.PI * r) / nWall + 1.2;
    const h = 6.5 + (i % 9 === 0 ? 2.5 : 0) + rnd() * 0.6;
    put(x, cy + prof(r, a) - 1.5, z, seg, h + 1.5, 3.6, -a + Math.PI / 2, col.setRGB(0.66 + rnd() * 0.05, 0.54, 0.41));
  }
  // houses: dense, flat roofs, mudbrick and lime-plastered; the temple of Dagon a larger block near the top
  for (let i = 0; i < nHouse; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (R0 - 18);
    const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    const w = 6 + rnd() * 7, d = 6 + rnd() * 8, h = 3.2 + rnd() * 2.8 * (1 - r / R0 * 0.5);
    const pl = rnd() < 0.35;
    put(x, cy + prof(r, a) - 0.5, z, w, h + 0.5, d, Math.round(rnd() * 3) * 0.08 + 0.2, pl ? col.setRGB(0.86, 0.8, 0.7) : col.setRGB(0.68 + rnd() * 0.06, 0.55 + rnd() * 0.04, 0.42));
  }
  put(center.x + 20, cy + TOP - 0.5, center.z - 10, 26, 10, 15, 0.2, col.setRGB(0.84, 0.78, 0.68));
  put(center.x + 36, cy + TOP - 0.5, center.z - 6, 10, 6.5, 13, 0.2, col.setRGB(0.8, 0.74, 0.64));
  inst.count = k;
  inst.castShadow = true; inst.receiveShadow = true;
  inst.computeBoundingSphere();
  group.add(inst);
  const smokeFrom: THREE.Vector3[] = [];
  for (let i = 0; i < 4; i++) {
    const a = rnd() * 6.28, r = rnd() * 150;
    smokeFrom.push(new THREE.Vector3(center.x + Math.cos(a) * r, cy + prof(r, a) + 5, center.z + Math.sin(a) * r));
  }
  return { group, gate: new THREE.Vector3(center.x + Math.cos(0.3) * (R0 + 20), 0, center.z + Math.sin(0.3) * (R0 + 20)), smokeFrom, top: cy + TOP, dispose: () => { for (const d of disp) d.dispose(); } };
}
