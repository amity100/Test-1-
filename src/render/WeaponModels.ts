import * as THREE from 'three';
import type { WeaponId } from '../sim/Weapons';

export type ModelId = WeaponId | 'grenade';

interface Mats {
  metal: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  lens: THREE.MeshStandardMaterial;
  glove: THREE.MeshStandardMaterial;
}

const matCache = new Map<string, Mats>();

function mats(accent: THREE.Color): Mats {
  const key = accent.getHexString();
  let m = matCache.get(key);
  if (!m) {
    m = {
      metal: new THREE.MeshStandardMaterial({ color: 0x3a3f48, metalness: 0.85, roughness: 0.38 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x15171b, metalness: 0.3, roughness: 0.7 }),
      accent: new THREE.MeshStandardMaterial({ color: accent.clone().multiplyScalar(0.6), emissive: accent, emissiveIntensity: 1.4, metalness: 0.4, roughness: 0.4 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x6b4527, roughness: 0.75 }),
      lens: new THREE.MeshStandardMaterial({ color: 0x102030, emissive: new THREE.Color(0.2, 0.9, 1.0), emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.1 }),
      glove: new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.85, metalness: 0.1 }),
    };
    matCache.set(key, m);
  }
  return m;
}

function box(g: THREE.Group, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  g.add(m);
  return m;
}

function cyl(g: THREE.Group, r1: number, r2: number, len: number, mat: THREE.Material, x: number, y: number, z: number, axis: 'x' | 'y' | 'z' = 'z'): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 14), mat);
  m.position.set(x, y, z);
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  else if (axis === 'x') m.rotation.z = Math.PI / 2;
  m.castShadow = true;
  g.add(m);
  return m;
}

function hands(g: THREE.Group, m: Mats, grip: [number, number, number], fore: [number, number, number] | null): void {
  const h1 = box(g, 0.075, 0.09, 0.075, m.glove, grip[0], grip[1], grip[2]);
  h1.rotation.x = 0.3;
  if (fore) box(g, 0.075, 0.07, 0.09, m.glove, fore[0], fore[1], fore[2]);
}

/**
 * Builds a low-poly PBR weapon model. Forward is -Z, the grip is near the origin.
 * userData: { muzzle: Vector3, hip: Vector3, ads: Vector3, scale: number }
 */
export function buildWeaponModel(id: ModelId, accent: THREE.Color, withHands = false): THREE.Group {
  const g = new THREE.Group();
  const m = mats(accent);
  g.name = `weapon-${id}`;
  switch (id) {
    case 'pistol': {
      box(g, 0.05, 0.065, 0.22, m.metal, 0, 0.085, -0.09);
      box(g, 0.044, 0.05, 0.16, m.dark, 0, 0.04, -0.06);
      box(g, 0.042, 0.13, 0.06, m.dark, 0, -0.03, 0.02, 0.25);
      box(g, 0.02, 0.02, 0.05, m.accent, 0, 0.125, -0.1);
      cyl(g, 0.011, 0.011, 0.08, m.dark, 0, 0.078, -0.22);
      box(g, 0.05, 0.012, 0.03, m.accent, 0, 0.045, -0.12);
      g.userData.muzzle = new THREE.Vector3(0, 0.078, -0.27);
      g.userData.hip = new THREE.Vector3(0.24, -0.25, -0.42);
      g.userData.ads = new THREE.Vector3(0, -0.145, -0.34);
      if (withHands) hands(g, m, [0, -0.06, 0.03], null);
      break;
    }
    case 'smg': {
      box(g, 0.065, 0.095, 0.38, m.metal, 0, 0.07, -0.16);
      box(g, 0.05, 0.06, 0.14, m.dark, 0, 0.13, -0.18);
      cyl(g, 0.014, 0.014, 0.16, m.dark, 0, 0.09, -0.42);
      box(g, 0.045, 0.16, 0.06, m.dark, 0, -0.04, -0.2, 0.15);
      box(g, 0.045, 0.12, 0.06, m.dark, 0, -0.02, 0.02, 0.3);
      box(g, 0.03, 0.05, 0.22, m.metal, 0, 0.07, 0.15);
      box(g, 0.02, 0.06, 0.02, m.metal, 0, 0.13, 0.05);
      box(g, 0.02, 0.06, 0.02, m.metal, 0, 0.13, -0.3);
      box(g, 0.07, 0.012, 0.24, m.accent, 0, 0.032, -0.2);
      g.userData.muzzle = new THREE.Vector3(0, 0.09, -0.5);
      g.userData.hip = new THREE.Vector3(0.26, -0.27, -0.46);
      g.userData.ads = new THREE.Vector3(0, -0.175, -0.4);
      if (withHands) hands(g, m, [0, -0.06, 0.02], [0, 0.0, -0.28]);
      break;
    }
    case 'rifle': {
      box(g, 0.07, 0.1, 0.52, m.metal, 0, 0.07, -0.2);
      box(g, 0.06, 0.07, 0.3, m.dark, 0, 0.06, -0.48);
      cyl(g, 0.016, 0.016, 0.3, m.dark, 0, 0.095, -0.72);
      box(g, 0.03, 0.03, 0.06, m.metal, 0, 0.13, -0.85);
      box(g, 0.05, 0.18, 0.07, m.dark, 0, -0.05, -0.16, 0.2);
      box(g, 0.05, 0.13, 0.06, m.dark, 0, -0.03, 0.05, 0.3);
      box(g, 0.05, 0.08, 0.3, m.metal, 0, 0.06, 0.22);
      box(g, 0.06, 0.05, 0.08, m.dark, 0, 0.05, 0.38);
      box(g, 0.03, 0.05, 0.26, m.metal, 0, 0.145, -0.1);
      box(g, 0.02, 0.03, 0.02, m.accent, 0, 0.18, -0.2);
      box(g, 0.072, 0.014, 0.4, m.accent, 0, 0.022, -0.3);
      g.userData.muzzle = new THREE.Vector3(0, 0.095, -0.88);
      g.userData.hip = new THREE.Vector3(0.27, -0.27, -0.5);
      g.userData.ads = new THREE.Vector3(0, -0.19, -0.42);
      if (withHands) hands(g, m, [0, -0.07, 0.05], [0, -0.02, -0.42]);
      break;
    }
    case 'shotgun': {
      box(g, 0.065, 0.09, 0.3, m.metal, 0, 0.07, -0.1);
      cyl(g, 0.02, 0.02, 0.62, m.dark, 0, 0.1, -0.5);
      cyl(g, 0.018, 0.018, 0.5, m.metal, 0, 0.05, -0.45);
      box(g, 0.07, 0.07, 0.2, m.wood, 0, 0.05, -0.5);
      box(g, 0.06, 0.11, 0.34, m.wood, 0, 0.03, 0.22, 0.08);
      box(g, 0.05, 0.12, 0.06, m.wood, 0, -0.03, 0.06, 0.35);
      box(g, 0.015, 0.02, 0.03, m.accent, 0, 0.125, -0.78);
      box(g, 0.07, 0.014, 0.12, m.accent, 0, 0.12, -0.08);
      g.userData.muzzle = new THREE.Vector3(0, 0.1, -0.82);
      g.userData.hip = new THREE.Vector3(0.27, -0.28, -0.48);
      g.userData.ads = new THREE.Vector3(0, -0.2, -0.4);
      if (withHands) hands(g, m, [0, -0.06, 0.06], [0, 0.0, -0.5]);
      break;
    }
    case 'sniper': {
      box(g, 0.065, 0.1, 0.5, m.metal, 0, 0.06, -0.15);
      cyl(g, 0.017, 0.015, 0.7, m.dark, 0, 0.085, -0.75);
      cyl(g, 0.03, 0.03, 0.08, m.dark, 0, 0.085, -1.06);
      cyl(g, 0.035, 0.035, 0.28, m.metal, 0, 0.18, -0.2);
      cyl(g, 0.038, 0.038, 0.02, m.lens, 0, 0.18, -0.345);
      box(g, 0.02, 0.05, 0.04, m.metal, 0, 0.135, -0.1);
      box(g, 0.02, 0.05, 0.04, m.metal, 0, 0.135, -0.3);
      box(g, 0.05, 0.16, 0.06, m.dark, 0, -0.04, -0.1, 0.2);
      box(g, 0.05, 0.12, 0.06, m.dark, 0, -0.03, 0.08, 0.35);
      box(g, 0.05, 0.1, 0.36, m.metal, 0, 0.05, 0.28);
      box(g, 0.06, 0.06, 0.06, m.dark, 0, 0.05, 0.47);
      box(g, 0.012, 0.16, 0.012, m.metal, 0.04, -0.05, -0.62, 0, 0, 0.3);
      box(g, 0.012, 0.16, 0.012, m.metal, -0.04, -0.05, -0.62, 0, 0, -0.3);
      box(g, 0.068, 0.014, 0.3, m.accent, 0, 0.015, -0.3);
      g.userData.muzzle = new THREE.Vector3(0, 0.085, -1.1);
      g.userData.hip = new THREE.Vector3(0.27, -0.28, -0.55);
      g.userData.ads = new THREE.Vector3(0, -0.24, -0.35);
      if (withHands) hands(g, m, [0, -0.07, 0.1], [0, -0.03, -0.5]);
      break;
    }
    case 'rocket': {
      cyl(g, 0.065, 0.065, 0.95, m.metal, 0, 0.12, -0.3);
      cyl(g, 0.075, 0.06, 0.12, m.dark, 0, 0.12, -0.82);
      cyl(g, 0.07, 0.075, 0.1, m.dark, 0, 0.12, 0.2);
      box(g, 0.05, 0.14, 0.06, m.dark, 0, -0.02, -0.15, 0.25);
      box(g, 0.05, 0.12, 0.06, m.dark, 0, -0.02, 0.1, 0.35);
      box(g, 0.03, 0.08, 0.14, m.metal, 0, 0.22, -0.2);
      box(g, 0.03, 0.03, 0.05, m.lens, 0, 0.27, -0.24);
      cyl(g, 0.068, 0.068, 0.03, m.accent, 0, 0.12, -0.55);
      cyl(g, 0.068, 0.068, 0.03, m.accent, 0, 0.12, -0.05);
      g.userData.muzzle = new THREE.Vector3(0, 0.12, -0.9);
      g.userData.hip = new THREE.Vector3(0.24, -0.3, -0.45);
      g.userData.ads = new THREE.Vector3(0.05, -0.25, -0.4);
      if (withHands) hands(g, m, [0, -0.06, 0.1], [0, 0.03, -0.35]);
      break;
    }
    case 'grenade': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), m.dark);
      body.castShadow = true;
      g.add(body);
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.006, 6, 18), m.metal);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.03 + i * 0.03;
        g.add(ring);
      }
      cyl(g, 0.02, 0.02, 0.04, m.metal, 0, 0.07, 0, 'y');
      box(g, 0.01, 0.05, 0.02, m.accent, 0.02, 0.09, 0);
      g.userData.muzzle = new THREE.Vector3(0, 0, -0.1);
      g.userData.hip = new THREE.Vector3(0.24, -0.26, -0.4);
      g.userData.ads = new THREE.Vector3(0.2, -0.22, -0.4);
      if (withHands) hands(g, m, [0, -0.06, 0.02], null);
      break;
    }
  }
  return g;
}
