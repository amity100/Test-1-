import * as THREE from 'three';
import type { PartBuilder } from './PartBuilder';
import { PRIM, rbox } from './PartBuilder';

/** Material slots shared by the operator body and its outfit gear. */
export type MatKey = 'fabric' | 'armor' | 'nylon' | 'pad' | 'metal' | 'accent' | 'visor' | 'lens' | 'warn';

/** Bone indices. */
export const HIPS = 0;
export const TORSO = 1;
export const HEAD = 2;
export const THIGH_L = 3;
export const SHIN_L = 4;
export const THIGH_R = 5;
export const SHIN_R = 6;

/** Rest-pose bone origins in model space (root at the feet, facing -Z). */
export const REST = {
  hips: new THREE.Vector3(0, 0.95, 0),
  torso: new THREE.Vector3(0, 1.06, 0),
  head: new THREE.Vector3(0, 1.68, 0),
  thighL: new THREE.Vector3(-0.13, 0.87, 0),
  shinL: new THREE.Vector3(-0.13, 0.45, 0),
  thighR: new THREE.Vector3(0.13, 0.87, 0),
  shinR: new THREE.Vector3(0.13, 0.45, 0),
};

const T = REST.torso;
/** Arm joints in model space (rigid with the torso, posed around the weapon). */
export const ARM_R = {
  shoulder: new THREE.Vector3(T.x + 0.29, T.y + 0.47, T.z),
  elbow: new THREE.Vector3(T.x + 0.33, T.y + 0.2, T.z + 0.03),
  wrist: new THREE.Vector3(T.x + 0.17, T.y + 0.31, T.z - 0.12),
};
export const ARM_L = {
  shoulder: new THREE.Vector3(T.x - 0.29, T.y + 0.47, T.z),
  elbow: new THREE.Vector3(T.x - 0.25, T.y + 0.2, T.z - 0.2),
  wrist: new THREE.Vector3(T.x + 0.02, T.y + 0.35, T.z - 0.44),
};

export const HALF_PI = Math.PI / 2;

/** Small part helpers bound to a builder (all sizes in metres). */
export function partHelpers(pb: PartBuilder<MatKey>) {
  const box = (k: MatKey, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): void => {
    pb.part(PRIM.box, k, x, y, z, rx, ry, rz, w, h, d);
  };
  const rb = (k: MatKey, w: number, h: number, d: number, r: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, seg = Math.max(w, h, d) > 0.12 ? 2 : 1): void => {
    const g = rbox(w, h, d, r, seg);
    pb.part(g, k, x, y, z, rx, ry, rz);
    g.dispose();
  };
  const sph = (k: MatKey, r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): void => {
    pb.part(PRIM.sphere, k, x, y, z, 0, 0, 0, r * 2 * sx, r * 2 * sy, r * 2 * sz);
  };
  const cylY = (k: MatKey, r: number, len: number, x: number, y: number, z: number, rTop = r): void => {
    const g = new THREE.CylinderGeometry(rTop, r, 1, 14);
    pb.part(g, k, x, y, z, 0, 0, 0, 1, len, 1);
    g.dispose();
  };
  const cylX = (k: MatKey, r: number, len: number, x: number, y: number, z: number): void => {
    pb.part(PRIM.cyl12, k, x, y, z, 0, 0, -HALF_PI, r * 2, len, r * 2);
  };
  const cylZ = (k: MatKey, r: number, len: number, x: number, y: number, z: number): void => {
    pb.part(PRIM.cyl12, k, x, y, z, HALF_PI, 0, 0, r * 2, len, r * 2);
  };
  const ring = (k: MatKey, R: number, r: number, x: number, y: number, z: number, sz = 1, rx = HALF_PI, ry = 0, rz = 0): void => {
    const g = new THREE.TorusGeometry(R, r, 6, 18);
    pb.part(g, k, x, y, z, rx, ry, rz, 1, sz, 1);
    g.dispose();
  };
  const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
  return { box, rb, sph, cylY, cylX, cylZ, ring, v };
}
