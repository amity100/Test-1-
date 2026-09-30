import * as THREE from 'three';
import type { TextureSet } from '../../world/Textures';
import { bushTree, carobTree, oakTree, oliveTree, type TreeDetail, type TreeGeo } from '../../world/TreeGen';
import { foliageMaterial } from '../../world/Vegetation';
import type { LandTier } from './landTerrain';

/**
 * Instanced trees and scrub for the ground-level land sets (the chapter's TreeGen models and foliage textures):
 *  olive  — Olea europaea (groves on the terraces and the plain)
 *  oak    — used for the sycamore fig (שִׁקְמָה, "the sycamores in the Shephelah", 1 Kings 10:27) and terebinth
 *  carob  — scattered on the hill slopes
 *  bush   — maquis / lentisk / retama scrub
 */
export type FloraKind = 'olive' | 'oak' | 'carob' | 'bush';
export interface FloraPoint { x: number; z: number; s: number; yaw: number }

export interface FloraSet { group: THREE.Group; triangles: number; dispose(): void }

export function buildFlora(tex: TextureSet, tier: LandTier, ground: (x: number, z: number) => number, lists: Partial<Record<FloraKind, FloraPoint[]>>, castShadowWithin?: { center: THREE.Vector3; radius: number }): FloraSet {
  const q = <T>(l: T, m: T, h: T) => (tier === 'low' ? l : tier === 'medium' ? m : h);
  const detail: TreeDetail = { radial: q(4, 5, 6), rings: q(1.0, 1.4, 1.8), cards: q(0.5, 0.7, 0.85) };
  const group = new THREE.Group();
  group.name = 'land:flora';
  const disposables: { dispose(): void }[] = [];
  const bark = new THREE.MeshStandardMaterial({ map: tex.bark, normalMap: tex.barkN, roughness: 0.93, color: 0xb9b0a0 });
  const olive = foliageMaterial(tex.olive, { sway: 0.05, flutter: 0.02, translucency: 0.5, roughness: 0.6, color: 0xd2dace });
  const broad = foliageMaterial(tex.broadleaf, { sway: 0.04, flutter: 0.015, translucency: 0.4, roughness: 0.62 });
  const bush = foliageMaterial(tex.broadleaf, { sway: 0.03, flutter: 0.012, translucency: 0.3, roughness: 0.7, color: 0xc8cdb4 });
  disposables.push(bark, olive, broad, bush);
  let triangles = 0;
  const make = (kind: FloraKind, seed: number): TreeGeo =>
    kind === 'olive' ? oliveTree(seed, detail) : kind === 'oak' ? oakTree(seed, detail, seed % 2 ? 'oak' : 'terebinth') : kind === 'carob' ? carobTree(seed, detail) : bushTree(seed, detail);
  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  (Object.keys(lists) as FloraKind[]).forEach((kind, ki) => {
    const pts = lists[kind]!;
    if (!pts.length) return;
    const variants = kind === 'bush' ? q(2, 3, 3) : q(2, 3, 4);
    for (let v = 0; v < variants; v++) {
      const mine = pts.filter((_, i) => i % variants === v);
      if (!mine.length) continue;
      const geo = make(kind, 301 + ki * 37 + v * 11);
      const leafMat = kind === 'olive' ? olive : kind === 'bush' ? bush : broad;
      const bm = new THREE.InstancedMesh(geo.bark, bark, mine.length);
      const lm = new THREE.InstancedMesh(geo.leaves, leafMat, mine.length);
      let near = false;
      mine.forEach((p, i) => {
        ps.set(p.x, ground(p.x, p.z) - 0.08 * p.s, p.z);
        qt.setFromAxisAngle(up, p.yaw);
        sc.setScalar(p.s);
        m4.compose(ps, qt, sc);
        bm.setMatrixAt(i, m4); lm.setMatrixAt(i, m4);
        if (castShadowWithin && ps.distanceTo(castShadowWithin.center) < castShadowWithin.radius) near = true;
      });
      for (const m of [bm, lm]) {
        m.castShadow = near && kind !== 'bush';
        m.receiveShadow = true;
        m.computeBoundingSphere();
        group.add(m);
      }
      triangles += ((geo.bark.index?.count ?? 0) + (geo.leaves.index?.count ?? 0)) / 3 * mine.length;
      disposables.push(geo.bark, geo.leaves);
    }
  });
  return { group, triangles, dispose: () => { for (const d of disposables) d.dispose(); } };
}

/** scatter helper: n points in a disc / ellipse with a keep-out predicate */
export function scatter(n: number, cx: number, cz: number, rx: number, rz: number, rnd: () => number, s: [number, number], keep: (x: number, z: number) => boolean = () => true): FloraPoint[] {
  const out: FloraPoint[] = [];
  for (let k = 0, guard = 0; k < n && guard < n * 8; guard++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    const x = cx + Math.cos(a) * r * rx, z = cz + Math.sin(a) * r * rz;
    if (!keep(x, z)) continue;
    out.push({ x, z, s: s[0] + rnd() * (s[1] - s[0]), yaw: rnd() * 6.283 });
    k++;
  }
  return out;
}

/** an orchard in rows (olive groves are planted ~8-10 m apart) inside an ellipse */
export function grove(cx: number, cz: number, rx: number, rz: number, spacing: number, angle: number, rnd: () => number, s: [number, number], keep: (x: number, z: number) => boolean = () => true, missing = 0.18): FloraPoint[] {
  const out: FloraPoint[] = [];
  const ca = Math.cos(angle), sa = Math.sin(angle);
  for (let i = -Math.ceil(rx / spacing); i <= Math.ceil(rx / spacing); i++) {
    for (let j = -Math.ceil(rz / spacing); j <= Math.ceil(rz / spacing); j++) {
      const lx = i * spacing + (rnd() - 0.5) * spacing * 0.35, lz = j * spacing + (rnd() - 0.5) * spacing * 0.35;
      if ((lx * lx) / (rx * rx) + (lz * lz) / (rz * rz) > 1 || rnd() < missing) continue;
      const x = cx + lx * ca - lz * sa, z = cz + lx * sa + lz * ca;
      if (!keep(x, z)) continue;
      out.push({ x, z, s: s[0] + rnd() * (s[1] - s[0]), yaw: rnd() * 6.283 });
    }
  }
  return out;
}
