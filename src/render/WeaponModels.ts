import * as THREE from 'three';
import type { WeaponId } from '../sim/Weapons';
import { PartBuilder, PRIM, rbox, frustum, lathe, meshesFrom } from './PartBuilder';
import { armorMaps, camoMaps, fabricMaps, gunmetalMaps, polymerMaps, rubberMaps, woodMaps } from './DetailTextures';

/** Uniform camouflage tones shared with the character model. */
export const OPERATOR_CAMO: Array<[number, number, number]> = [
  [0.17, 0.19, 0.16],
  [0.24, 0.27, 0.22],
  [0.31, 0.33, 0.29],
];

export type ModelId = WeaponId | 'grenade' | 'rocketShell';
export type WeaponDetail = 'high' | 'low';

type MatKey = 'metal' | 'dark' | 'polymer' | 'rubber' | 'accent' | 'wood' | 'lens' | 'glove' | 'pad' | 'sleeve' | 'light' | 'brass' | 'shell' | 'skin';

interface Ctx {
  pb: PartBuilder<MatKey>;
  /** High detail: screws, rail teeth, serrations, denser primitives (first-person view). */
  hi: boolean;
  hands: boolean;
}

interface WeaponData {
  muzzle: THREE.Vector3;
  hip: THREE.Vector3;
  ads: THREE.Vector3;
}

const matCache = new Map<string, Record<MatKey, THREE.Material>>();
const geoCache = new Map<string, Map<MatKey, THREE.BufferGeometry>>();
const dataCache = new Map<string, WeaponData>();

function std(p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial(p);
}

function mats(accent: THREE.Color): Record<MatKey, THREE.Material> {
  const key = accent.getHexString();
  let m = matCache.get(key);
  if (m) return m;
  const gm = gunmetalMaps();
  const am = armorMaps();
  const pm = polymerMaps();
  const fm = fabricMaps();
  const wm = woodMaps();
  const rm = rubberMaps();
  const cm = camoMaps('operator', OPERATOR_CAMO);
  m = {
    metal: std({ color: 0x5c626c, metalness: 0.9, roughness: 1, map: gm.map, normalMap: gm.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: gm.roughnessMap }),
    dark: std({ color: 0x262a30, metalness: 0.45, roughness: 1, map: am.map, normalMap: am.normalMap, normalScale: new THREE.Vector2(0.45, 0.45), roughnessMap: am.roughnessMap }),
    polymer: std({ color: 0x1c1e22, metalness: 0.05, roughness: 1, map: pm.map, normalMap: pm.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: pm.roughnessMap }),
    rubber: std({ color: 0x0e0f11, metalness: 0, roughness: 1, map: rm.map, normalMap: rm.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), roughnessMap: rm.roughnessMap }),
    accent: std({ color: accent.clone().multiplyScalar(0.55), emissive: accent, emissiveIntensity: 1.1, metalness: 0.3, roughness: 0.35 }),
    wood: std({ color: 0x8a5a30, metalness: 0, roughness: 1, map: wm.map, normalMap: wm.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: wm.roughnessMap }),
    lens: std({ color: 0x1b2f42, metalness: 0.95, roughness: 0.04, emissive: new THREE.Color(0.02, 0.08, 0.13), emissiveIntensity: 1, transparent: true, opacity: 0.62, depthWrite: false }),
    glove: std({ color: 0x2b2e34, metalness: 0.05, roughness: 1, map: fm.map, normalMap: fm.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: fm.roughnessMap }),
    pad: std({ color: 0x15171a, metalness: 0.2, roughness: 1, map: am.map, normalMap: am.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: am.roughnessMap }),
    sleeve: std({ color: 0xffffff, metalness: 0, roughness: 1, map: cm.map, normalMap: cm.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: cm.roughnessMap }),
    light: std({ color: 0xffffff, emissive: 0xfff1cc, emissiveIntensity: 3 }),
    brass: std({ color: 0xd2a84e, metalness: 1, roughness: 0.28 }),
    shell: std({ color: 0xa8221e, metalness: 0, roughness: 0.55 }),
    skin: std({ color: 0xc89a78, metalness: 0, roughness: 0.75 }),
  };
  matCache.set(key, m);
  return m;
}

// ---------------------------------------------------------------------------------------------
// Primitive helpers (forward is -Z, up is +Y, right is +X)

const HALF_PI = Math.PI / 2;

function box(c: Ctx, k: MatKey, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): void {
  c.pb.part(PRIM.box, k, x, y, z, rx, ry, rz, w, h, d);
}

function rb(c: Ctx, k: MatKey, w: number, h: number, d: number, r: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): void {
  const g = rbox(w, h, d, r, c.hi ? 2 : 1);
  c.pb.part(g, k, x, y, z, rx, ry, rz);
  g.dispose();
}

/** Cylinder along Z; `rFront` is the radius at the -Z end. */
function cylZ(c: Ctx, k: MatKey, r: number, len: number, x: number, y: number, z: number, rFront = r, seg = c.hi ? 18 : 10): void {
  const g = frustum(rFront, r, seg);
  c.pb.part(g, k, x, y, z, -HALF_PI, 0, 0, 1, len, 1);
  g.dispose();
}

/** Cylinder along Y; `rTop` is the radius at the +Y end. */
function cylY(c: Ctx, k: MatKey, r: number, len: number, x: number, y: number, z: number, rTop = r, seg = c.hi ? 16 : 10): void {
  const g = frustum(rTop, r, seg);
  c.pb.part(g, k, x, y, z, 0, 0, 0, 1, len, 1);
  g.dispose();
}

/** Cylinder along X; `rRight` is the radius at the +X end. */
function cylX(c: Ctx, k: MatKey, r: number, len: number, x: number, y: number, z: number, rRight = r, seg = c.hi ? 16 : 10): void {
  const g = frustum(rRight, r, seg);
  c.pb.part(g, k, x, y, z, 0, 0, -HALF_PI, 1, len, 1);
  g.dispose();
}

/** Ring around the Z axis. */
function ringZ(c: Ctx, k: MatKey, R: number, r: number, x: number, y: number, z: number): void {
  const g = new THREE.TorusGeometry(R, r, c.hi ? 8 : 5, c.hi ? 22 : 12);
  c.pb.part(g, k, x, y, z);
  g.dispose();
}

function sphere(c: Ctx, k: MatKey, r: number, x: number, y: number, z: number): void {
  c.pb.part(c.hi ? PRIM.sphere : PRIM.sphereLo, k, x, y, z, 0, 0, 0, r * 2);
}

/** Picatinny rail along Z from z0 to z1 (z0 > z1), top surface at y. */
function rail(c: Ctx, w: number, y: number, x: number, z0: number, z1: number): void {
  const len = Math.abs(z0 - z1);
  const zc = (z0 + z1) / 2;
  box(c, 'metal', w, 0.006, len, x, y - 0.007, zc);
  if (!c.hi) {
    box(c, 'metal', w, 0.004, len, x, y - 0.002, zc);
    return;
  }
  const pitch = 0.0104;
  const n = Math.floor(len / pitch);
  for (let i = 0; i < n; i++) box(c, 'metal', w, 0.004, pitch * 0.55, x, y - 0.002, Math.max(z0, z1) - pitch * (i + 0.5));
}

/** M-LOK style slots on a handguard: sides and bottom. */
function mlok(c: Ctx, hw: number, yc: number, hh: number, z0: number, z1: number, rows = 1): void {
  if (!c.hi) return;
  const pitch = 0.045;
  const n = Math.floor(Math.abs(z0 - z1) / pitch);
  for (let i = 0; i < n; i++) {
    const z = Math.max(z0, z1) - pitch * (i + 0.5);
    for (let r = 0; r < rows; r++) {
      const y = yc + (r - (rows - 1) / 2) * 0.014;
      box(c, 'rubber', 0.004, 0.007, 0.032, hw, y, z);
      box(c, 'rubber', 0.004, 0.007, 0.032, -hw, y, z);
    }
    box(c, 'rubber', 0.007, 0.004, 0.032, 0, yc - hh, z);
  }
}

/** Serrations (small parallel ridges) on both sides of a slide. */
function serrations(c: Ctx, hw: number, y: number, z0: number, count: number, h: number): void {
  if (!c.hi) return;
  for (let i = 0; i < count; i++) {
    box(c, 'dark', 0.003, h, 0.0025, hw, y, z0 - i * 0.006);
    box(c, 'dark', 0.003, h, 0.0025, -hw, y, z0 - i * 0.006);
  }
}

/** Screw heads (tiny cylinders) along X faces. */
function screws(c: Ctx, pts: Array<[number, number, number]>): void {
  if (!c.hi) return;
  for (const [x, y, z] of pts) cylX(c, 'metal', 0.0035, 0.002, x, y, z, 0.0035, 8);
}

/** Pistol grip with palm swell, finger grooves and beavertail; centre and lean (rad, positive leans back). */
function pistolGrip(c: Ctx, x: number, y: number, z: number, lean: number, h = 0.11, w = 0.034, d = 0.054): void {
  rb(c, 'polymer', w, h, d, 0.011, x, y, z, lean);
  // Palm swell & finger grooves on the front strap.
  const s = Math.sin(lean);
  const co = Math.cos(lean);
  for (let i = 0; i < 3 && c.hi; i++) {
    const t = -h * 0.28 + i * 0.026;
    box(c, 'rubber', w * 0.9, 0.004, 0.004, x, y + t * co - (-d / 2) * s, z + t * s + (-d / 2) * co, lean);
  }
  // Beavertail / upper tang.
  rb(c, 'polymer', w * 0.9, 0.012, 0.03, 0.004, x, y + (h / 2) * co + 0.002, z + (h / 2) * s + 0.02, lean);
  // Base plug.
  rb(c, 'dark', w * 1.02, 0.008, d * 1.02, 0.002, x, y - (h / 2) * co, z - (h / 2) * s, lean);
}

function trigger(c: Ctx, x: number, y: number, z: number, guardLen = 0.05): void {
  // Guard: front post, bottom bar, rear post.
  box(c, 'dark', 0.01, 0.028, 0.005, x, y - 0.014, z - guardLen / 2);
  box(c, 'dark', 0.01, 0.005, guardLen, x, y - 0.03, z);
  box(c, 'dark', 0.01, 0.012, 0.005, x, y - 0.026, z + guardLen / 2);
  // Trigger blade.
  box(c, 'metal', 0.005, 0.022, 0.004, x, y - 0.014, z + 0.005, 0.25);
}

/** Red dot sight: hooded housing, tinted lens, emissive dot. Returns sight-line height. */
function redDot(c: Ctx, x: number, baseY: number, z: number, size = 1): number {
  const h = 0.03 * size;
  const w = 0.03 * size;
  const len = 0.05 * size;
  const y = baseY + 0.006 + h / 2;
  // Mount base with a clamp screw.
  box(c, 'dark', w * 0.9, 0.008, len, x, baseY + 0.004, z);
  screws(c, [[x + w * 0.46, baseY + 0.004, z + len * 0.3]]);
  // Hood: two side walls + top bar + rear frame.
  box(c, 'dark', 0.004, h, len, x - w / 2 + 0.002, y, z);
  box(c, 'dark', 0.004, h, len, x + w / 2 - 0.002, y, z);
  box(c, 'dark', w, 0.005, len * 0.7, x, y + h / 2 - 0.0025, z + len * 0.1);
  box(c, 'dark', w, 0.006, 0.006, x, y + h / 2 - 0.003, z - len / 2 + 0.003);
  // Front lens (tilted) and rear glass.
  box(c, 'lens', w - 0.008, h - 0.008, 0.002, x, y + 0.002, z - len / 2 + 0.006, 0.18);
  box(c, 'lens', w - 0.01, h - 0.01, 0.0015, x, y, z + len / 2 - 0.004);
  // Emissive dot & brightness dial.
  sphere(c, 'accent', 0.0025 * size, x, y + 0.001, z - len / 2 + 0.009);
  cylX(c, 'dark', 0.007 * size, 0.008, x + w / 2 + 0.004, y - 0.004, z + len * 0.05, 0.007 * size, 10);
  return y;
}

/** Rifle scope with bells, turrets and rings mounted on a rail top at `railY`. Returns sight-line height. */
function scope(c: Ctx, x: number, railY: number, zFront: number, zBack: number, tubeR = 0.016): number {
  const y = railY + 0.04 + tubeR;
  const len = Math.abs(zBack - zFront);
  const zc = (zFront + zBack) / 2;
  cylZ(c, 'dark', tubeR, len * 0.6, x, y, zc);
  // Objective bell (front) and ocular (rear).
  const objR = tubeR * 1.7;
  cylZ(c, 'dark', tubeR, len * 0.22, x, y, zFront + len * 0.11, objR);
  cylZ(c, 'dark', objR * 1.02, len * 0.14, x, y, zFront + len * 0.07 - 0.01);
  cylZ(c, 'dark', objR * 0.9, len * 0.18, x, y, zBack - len * 0.09, tubeR);
  cylZ(c, 'dark', objR * 0.9, len * 0.1, x, y, zBack - len * 0.05 + 0.01);
  // Lenses.
  cylZ(c, 'lens', objR * 0.86, 0.004, x, y, zFront + 0.001);
  cylZ(c, 'lens', objR * 0.72, 0.004, x, y, zBack - 0.001);
  // Turrets (elevation on top, windage on the right, parallax on the left).
  const tz = zc + len * 0.05;
  cylY(c, 'dark', tubeR * 0.7, 0.028, x, y + tubeR + 0.01, tz);
  cylY(c, 'metal', tubeR * 0.55, 0.006, x, y + tubeR + 0.027, tz);
  cylX(c, 'dark', tubeR * 0.7, 0.024, x + tubeR + 0.008, y, tz);
  cylX(c, 'dark', tubeR * 0.6, 0.02, x - tubeR - 0.006, y, tz);
  // Rings with bases down to the rail.
  for (const rz of [zFront + len * 0.3, zBack - len * 0.28]) {
    ringZ(c, 'metal', tubeR + 0.002, 0.004, x, y, rz);
    box(c, 'metal', 0.02, 0.03, 0.018, x, railY + 0.02, rz);
    box(c, 'metal', 0.026, 0.01, 0.022, x, railY + 0.006, rz);
    screws(c, [[x + 0.0135, railY + 0.006, rz], [x - 0.0135, railY + 0.006, rz]]);
  }
  // Magnification ring knurl & accent illumination dial.
  ringZ(c, 'metal', tubeR * 0.92, 0.003, x, y, zBack - len * 0.19);
  cylX(c, 'accent', 0.005, 0.004, x - tubeR - 0.017, y, tz, 0.005, 8);
  return y;
}

/** Stock: buffer tube, adjustable stock body, cheek riser, rubber buttpad and sling loop. */
function carbineStock(c: Ctx, y: number, zStart: number, len: number, polymer: MatKey = 'polymer'): void {
  const tubeLen = len * 0.55;
  cylZ(c, 'metal', 0.014, tubeLen, 0, y, zStart + tubeLen / 2);
  ringZ(c, 'metal', 0.016, 0.005, 0, y, zStart + 0.012);
  const bodyLen = len * 0.55;
  const zb = zStart + len - bodyLen / 2;
  rb(c, polymer, 0.036, 0.11, bodyLen, 0.008, 0, y - 0.03, zb);
  rb(c, polymer, 0.03, 0.035, bodyLen * 0.8, 0.006, 0, y + 0.02, zb + 0.01);
  rb(c, 'rubber', 0.04, 0.125, 0.018, 0.004, 0, y - 0.03, zStart + len + 0.006);
  // Adjustment lever and QD sling loop.
  box(c, 'dark', 0.028, 0.008, 0.03, 0, y - 0.09, zb - bodyLen * 0.2);
  const g = new THREE.TorusGeometry(0.008, 0.002, 5, 12);
  c.pb.part(g, 'metal', 0.02, y - 0.055, zb + 0.02, 0, HALF_PI, 0);
  g.dispose();
  // Accent chevron on the stock side.
  box(c, 'accent', 0.002, 0.004, 0.05, 0.019, y - 0.02, zb, 0, 0, 0);
  box(c, 'accent', 0.002, 0.004, 0.05, -0.019, y - 0.02, zb, 0, 0, 0);
}

/** Curved / straight magazine with baseplate and glowing ammo window. */
function magazine(c: Ctx, x: number, topY: number, z: number, w: number, h: number, d: number, lean: number, ribs = 3): void {
  const yc = topY - h / 2;
  const s = Math.sin(lean);
  const co = Math.cos(lean);
  // Pivot the magazine around its top so it stays seated in the mag well.
  const cx = x;
  const cy = topY - (h / 2) * co;
  const cz = z - (h / 2) * s;
  rb(c, 'polymer', w, h, d, 0.006, cx, cy, cz, lean);
  rb(c, 'dark', w * 1.06, 0.012, d * 1.06, 0.003, cx, topY - h * co, z - h * s, lean);
  for (let i = 0; i < ribs && c.hi; i++) {
    const t = -h * 0.3 + i * (h * 0.22);
    box(c, 'dark', w * 1.03, 0.005, d * 0.9, cx, cy + t * co, cz + t * s, lean);
  }
  // Ammo window strip.
  box(c, 'accent', 0.002, h * 0.5, 0.005, cx + w / 2, cy, cz, lean);
}

function flashlight(c: Ctx, x: number, y: number, z: number, r = 0.012, len = 0.07): void {
  cylZ(c, 'dark', r, len, x, y, z);
  cylZ(c, 'dark', r * 1.15, len * 0.28, x, y, z - len * 0.36);
  cylZ(c, 'light', r * 0.75, 0.003, x, y, z - len / 2 - 0.001);
  box(c, 'dark', r * 1.6, r * 0.8, len * 0.5, x, y + r * 0.9, z);
  if (c.hi) box(c, 'rubber', r * 0.6, r * 0.5, r * 0.6, x, y - r * 0.9, z + len * 0.4);
}

function suppressor(c: Ctx, y: number, zFront: number, len: number, r: number): void {
  cylZ(c, 'dark', r, len, 0, y, zFront + len / 2);
  cylZ(c, 'dark', r * 1.03, len * 0.12, 0, y, zFront + len * 0.06 + 0.001);
  cylZ(c, 'dark', r * 1.03, len * 0.12, 0, y, zFront + len - len * 0.06 - 0.001);
  cylZ(c, 'rubber', r * 0.5, 0.004, 0, y, zFront - 0.001);
  if (c.hi) for (let i = 1; i <= 3; i++) ringZ(c, 'metal', r * 1.0, 0.002, 0, y, zFront + (len * i) / 4);
}

function compensator(c: Ctx, y: number, zFront: number, len: number, r: number): void {
  cylZ(c, 'metal', r, len, 0, y, zFront + len / 2, r * 0.95);
  cylZ(c, 'rubber', r * 0.5, 0.004, 0, y, zFront - 0.001);
  if (c.hi) {
    for (let i = 0; i < 3; i++) box(c, 'rubber', r * 1.2, r * 0.5, 0.004, 0, y + r * 0.75, zFront + len * (0.25 + i * 0.25));
    for (let i = 0; i < 2; i++) {
      box(c, 'rubber', r * 0.5, r * 0.7, 0.005, r * 0.95, y, zFront + len * (0.35 + i * 0.3));
      box(c, 'rubber', r * 0.5, r * 0.7, 0.005, -r * 0.95, y, zFront + len * (0.35 + i * 0.3));
    }
  }
}

/** Small charging handle, ejection port, selector and other receiver furniture common to carbines. */
function receiverFurniture(c: Ctx, hw: number, topY: number, zPort: number): void {
  // Ejection port (right side) with brass deflector and dust cover seam.
  box(c, 'rubber', 0.003, 0.018, 0.04, hw, topY - 0.02, zPort);
  box(c, 'dark', 0.008, 0.02, 0.012, hw + 0.002, topY - 0.02, zPort + 0.03, 0, -0.5, 0);
  // Forward assist & bolt release.
  cylX(c, 'dark', 0.007, 0.01, hw + 0.004, topY - 0.024, zPort + 0.045, 0.007, 10);
  box(c, 'dark', 0.006, 0.016, 0.01, -hw - 0.002, topY - 0.03, zPort + 0.02);
  // Safety selector (left).
  box(c, 'metal', 0.006, 0.005, 0.02, -hw - 0.002, topY - 0.05, zPort + 0.06, 0, 0, 0);
  cylX(c, 'metal', 0.005, 0.004, -hw - 0.001, topY - 0.05, zPort + 0.05, 0.005, 8);
  // Charging handle (T at the rear top).
  box(c, 'metal', 0.036, 0.007, 0.012, 0, topY + 0.003, zPort + 0.095);
  box(c, 'metal', 0.01, 0.007, 0.03, 0, topY + 0.003, zPort + 0.078);
}

// ---------------------------------------------------------------------------------------------
// Hands

const FINGER_X = [0.031, 0.0105, -0.0105, -0.031];
const FINGER_LEN = [0.074, 0.082, 0.076, 0.062];
const FINGER_R = [0.0088, 0.0088, 0.0082, 0.0074];
const SEG_FRAC = [0.42, 0.32, 0.26];

interface HandPose {
  /** Cumulative flexion per finger joint (rad); ~[1.2, 2.5, 3.3] wraps a pistol grip. */
  curl: [number, number, number];
  /** Thumb segment directions in right-hand space (x is mirrored for the left hand). */
  thumb: [THREE.Vector3, THREE.Vector3];
  /** Elbow position in model space. */
  elbow: THREE.Vector3;
}

const GRIP_CURL: [number, number, number] = [1.3, 2.2, 2.9];
const CLAMP_CURL: [number, number, number] = [1.25, 2.15, 2.8];
const HOLD_CURL: [number, number, number] = [1.35, 2.35, 3.1];
const GRIP_THUMB: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(0.3, -0.65, -0.7), new THREE.Vector3(0.2, -0.5, 0.84)];
const CLAMP_THUMB: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(0.9, -0.35, 0.1), new THREE.Vector3(0.95, -0.1, 0.2)];

/**
 * Gloved hand built in a local frame: palm centre at origin, +Z toward the knuckles, +Y is the back of the hand,
 * thumb on +X for the right hand (side = 1) and -X for the left (side = -1). `frame` places it in model space.
 * Fingers flex about the hand X axis, so an object held against the palm (-Y) gets wrapped.
 */
function hand(c: Ctx, side: 1 | -1, frame: THREE.Matrix4, pose: HandPose): void {
  const pb = c.pb;
  const local = new THREE.Matrix4();
  const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
  const put = (geo: THREE.BufferGeometry, k: MatKey, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): void => {
    local.compose(v(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), v(1, 1, 1));
    local.premultiply(frame);
    pb.partM(geo, k, local);
    geo.dispose();
  };
  // Palm, knuckle plate and back-of-hand plate.
  put(rbox(0.084, 0.03, 0.09, 0.012, c.hi ? 2 : 1), 'glove', 0, 0, 0);
  put(rbox(0.078, 0.012, 0.03, 0.005, 1), 'pad', 0, 0.018, 0.028);
  put(rbox(0.07, 0.008, 0.028, 0.004, 1), 'pad', 0, 0.016, -0.012);
  // Wrist cuff with strap, then a tapered sleeve toward the elbow.
  pb.capsule('glove', v(0, 0, -0.035), v(0, 0, -0.095), 0.031, frame, c.hi ? 12 : 8);
  put(rbox(0.07, 0.07, 0.014, 0.004, 1), 'rubber', 0, 0, -0.07);
  const wrist = v(0, 0, -0.085).applyMatrix4(frame);
  pb.capsule('sleeve', wrist, pose.elbow, 0.036, undefined, c.hi ? 12 : 8);
  pb.capsule('sleeve', wrist.clone().lerp(pose.elbow, 0.45), pose.elbow, 0.042, undefined, c.hi ? 12 : 8);
  pb.capsule('rubber', wrist.clone().lerp(pose.elbow, 0.04), wrist.clone().lerp(pose.elbow, 0.1), 0.039, undefined, c.hi ? 12 : 8, 2);
  // Fingers: knuckles at the palm's front edge, three segments flexing around the held object.
  for (let i = 0; i < 4; i++) {
    let p = v(side * FINGER_X[i], -0.004, 0.045);
    for (let j = 0; j < 3; j++) {
      const a = pose.curl[j];
      const d = v(0, -Math.sin(a), Math.cos(a));
      const q = p.clone().addScaledVector(d, FINGER_LEN[i] * SEG_FRAC[j]);
      pb.capsule('glove', p, q, FINGER_R[i] * (j === 2 ? 0.92 : 1), frame, c.hi ? 10 : 6, 3);
      if (j === 0 && c.hi) {
        const mid = p.clone().add(q).multiplyScalar(0.5).addScaledVector(v(0, Math.cos(a), Math.sin(a)), FINGER_R[i] * 0.7);
        local.compose(mid, new THREE.Quaternion().setFromAxisAngle(v(1, 0, 0), a), v(1, 1, 1));
        local.premultiply(frame);
        const g = rbox(FINGER_R[i] * 1.9, 0.006, FINGER_LEN[i] * SEG_FRAC[0] * 0.6, 0.002, 1);
        pb.partM(g, 'pad', local);
        g.dispose();
      }
      p = q;
    }
  }
  // Thumb: two segments from the upper rear of the palm.
  const tBase = v(side * 0.044, -0.008, -0.012);
  const d1 = pose.thumb[0].clone();
  d1.x *= side;
  d1.normalize();
  const tMid = tBase.clone().addScaledVector(d1, 0.04);
  pb.capsule('glove', tBase, tMid, 0.0105, frame, c.hi ? 10 : 6, 3);
  const d2 = pose.thumb[1].clone();
  d2.x *= side;
  d2.normalize();
  const tTip = tMid.clone().addScaledVector(d2, 0.034);
  pb.capsule('glove', tMid, tTip, 0.0098, frame, c.hi ? 10 : 6, 3);
}

/** Hand frame from basis vectors (model space) and a palm-centre position. */
function frameFrom(pos: THREE.Vector3, xAxis: THREE.Vector3, yAxis: THREE.Vector3, zAxis: THREE.Vector3): THREE.Matrix4 {
  const m = new THREE.Matrix4().makeBasis(xAxis.clone().normalize(), yAxis.clone().normalize(), zAxis.clone().normalize());
  m.setPosition(pos);
  return m;
}

/** Right hand wrapped around a vertical-ish grip (centre, lean about X, half width). */
function gripHandRight(c: Ctx, gx: number, gy: number, gz: number, lean: number, halfW: number, elbowOffset = new THREE.Vector3(0.1, -0.3, 0.26)): void {
  const up = new THREE.Vector3(0, Math.cos(lean), Math.sin(lean));
  const fwd = new THREE.Vector3(0, Math.sin(lean), -Math.cos(lean));
  const pos = new THREE.Vector3(gx + halfW + 0.014, gy, gz).addScaledVector(up, 0.01).addScaledVector(fwd, -0.015);
  const frame = frameFrom(pos, up, new THREE.Vector3(1, 0, 0), fwd);
  hand(c, 1, frame, { curl: GRIP_CURL, thumb: GRIP_THUMB, elbow: pos.clone().add(elbowOffset) });
}

/** Left hand wrapped around a vertical-ish grip from the left side. */
function gripHandLeft(c: Ctx, gx: number, gy: number, gz: number, lean: number, halfW: number, elbowOffset = new THREE.Vector3(-0.08, -0.34, 0.2)): void {
  const up = new THREE.Vector3(0, Math.cos(lean), Math.sin(lean));
  const fwd = new THREE.Vector3(0, Math.sin(lean), -Math.cos(lean));
  const pos = new THREE.Vector3(gx - halfW - 0.014, gy, gz).addScaledVector(up, 0.01).addScaledVector(fwd, -0.015);
  const frame = frameFrom(pos, up.clone().negate(), new THREE.Vector3(-1, 0, 0), fwd);
  hand(c, -1, frame, { curl: GRIP_CURL, thumb: GRIP_THUMB, elbow: pos.clone().add(elbowOffset) });
}

/** Left hand supporting a handguard from below (C-clamp): palm up, fingers wrapping the far side. */
function supportHandLeft(c: Ctx, x: number, bottomY: number, z: number, halfW = 0.025): void {
  const pos = new THREE.Vector3(x - halfW + 0.004, bottomY - 0.016, z);
  const frame = frameFrom(pos, new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0));
  hand(c, -1, frame, { curl: CLAMP_CURL, thumb: CLAMP_THUMB, elbow: pos.clone().add(new THREE.Vector3(-0.08, -0.34, 0.22)) });
}

// ---------------------------------------------------------------------------------------------
// Weapons

function pistol(c: Ctx): WeaponData {
  const slideY = 0.086;
  // Polymer frame with accessory rail and beavertail.
  rb(c, 'polymer', 0.036, 0.034, 0.185, 0.006, 0, 0.058, -0.085);
  rail(c, 0.02, 0.041, 0, -0.1, -0.165);
  // Slide with front/rear serrations and a lightening cut.
  rb(c, 'metal', 0.034, 0.036, 0.205, 0.006, 0, slideY, -0.1);
  serrations(c, 0.0175, slideY, -0.012, 6, 0.028);
  serrations(c, 0.0175, slideY, -0.16, 4, 0.028);
  box(c, 'rubber', 0.02, 0.003, 0.05, 0, slideY + 0.017, -0.16);
  // Ejection port and extractor.
  box(c, 'rubber', 0.003, 0.015, 0.03, 0.017, slideY + 0.004, -0.11);
  box(c, 'dark', 0.003, 0.006, 0.012, 0.0175, slideY + 0.006, -0.085);
  // Barrel & compensator.
  cylZ(c, 'metal', 0.0085, 0.03, 0, slideY, -0.205);
  compensator(c, slideY, -0.235, 0.028, 0.017);
  // Controls: slide stop, takedown lever, mag release.
  box(c, 'metal', 0.004, 0.006, 0.03, -0.02, 0.066, -0.06);
  box(c, 'metal', 0.004, 0.005, 0.014, -0.02, 0.05, -0.1);
  box(c, 'dark', 0.004, 0.008, 0.008, -0.019, 0.02, -0.02);
  // Trigger & guard.
  trigger(c, 0, 0.04, -0.05, 0.05);
  // Grip and magazine baseplate.
  pistolGrip(c, 0, -0.03, 0.02, 0.24, 0.115, 0.033, 0.055);
  box(c, 'dark', 0.036, 0.01, 0.062, 0, -0.087, 0.006, 0.24);
  // Under-barrel light.
  flashlight(c, 0, 0.032, -0.135, 0.011, 0.055);
  // Iron sights: rear notch and front post with team dot.
  box(c, 'metal', 0.024, 0.012, 0.012, 0, slideY + 0.022, -0.012);
  box(c, 'rubber', 0.006, 0.008, 0.004, 0, slideY + 0.026, -0.007);
  box(c, 'metal', 0.006, 0.012, 0.01, 0, slideY + 0.022, -0.19);
  box(c, 'accent', 0.003, 0.003, 0.002, 0, slideY + 0.025, -0.196);
  // Slide-mounted red dot.
  const sightY = redDot(c, 0, slideY + 0.018, -0.05, 0.85);
  if (c.hands) {
    gripHandRight(c, 0, -0.03, 0.02, 0.24, 0.0165);
    gripHandLeft(c, 0, -0.045, 0.01, 0.24, 0.0165 + 0.025);
  }
  return { muzzle: new THREE.Vector3(0, slideY, -0.245), hip: new THREE.Vector3(0.24, -0.25, -0.42), ads: new THREE.Vector3(0, -sightY, -0.34) };
}

function smg(c: Ctx): WeaponData {
  const boreY = 0.09;
  const topY = 0.117;
  // Polymer receiver, tapered front and stock hinge.
  rb(c, 'polymer', 0.05, 0.075, 0.32, 0.01, 0, 0.08, -0.16);
  rb(c, 'polymer', 0.044, 0.06, 0.1, 0.008, 0, 0.085, -0.35);
  box(c, 'accent', 0.002, 0.005, 0.2, 0.026, 0.05, -0.16);
  box(c, 'accent', 0.002, 0.005, 0.2, -0.026, 0.05, -0.16);
  rail(c, 0.021, topY + 0.01, 0, 0.0, -0.39);
  mlok(c, 0.025, 0.085, 0.03, -0.25, -0.39);
  receiverFurniture(c, 0.025, topY, -0.2);
  // Barrel, suppressor.
  cylZ(c, 'metal', 0.011, 0.06, 0, boreY, -0.42);
  suppressor(c, boreY, -0.55, 0.13, 0.019);
  // Magazine in front of the grip, magwell flare.
  rb(c, 'dark', 0.038, 0.03, 0.065, 0.005, 0, 0.03, -0.2);
  magazine(c, 0, 0.03, -0.2, 0.03, 0.17, 0.055, 0.1, 3);
  // Grip, trigger, angled foregrip.
  pistolGrip(c, 0, -0.02, 0.012, 0.3);
  trigger(c, 0, 0.04, -0.06, 0.05);
  rb(c, 'polymer', 0.03, 0.05, 0.045, 0.008, 0, 0.03, -0.31, -0.55);
  // Folding stock: twin struts and buttpad.
  box(c, 'metal', 0.006, 0.014, 0.2, 0.016, 0.085, 0.1);
  box(c, 'metal', 0.006, 0.014, 0.2, -0.016, 0.085, 0.1);
  rb(c, 'rubber', 0.04, 0.09, 0.02, 0.005, 0, 0.065, 0.205);
  rb(c, 'polymer', 0.036, 0.02, 0.04, 0.005, 0, 0.09, 0.0);
  // Red dot.
  const sightY = redDot(c, 0, topY + 0.01, -0.09, 1);
  flashlight(c, 0.036, 0.1, -0.33, 0.011, 0.06);
  if (c.hands) {
    gripHandRight(c, 0, -0.02, 0.012, 0.3, 0.017);
    supportHandLeft(c, 0, 0.0425, -0.26, 0.025);
  }
  return { muzzle: new THREE.Vector3(0, boreY, -0.56), hip: new THREE.Vector3(0.26, -0.27, -0.46), ads: new THREE.Vector3(0, -sightY, -0.4) };
}

function rifle(c: Ctx): WeaponData {
  const boreY = 0.1;
  const topY = 0.13;
  // Lower receiver, magwell, upper receiver.
  rb(c, 'dark', 0.05, 0.06, 0.2, 0.008, 0, 0.04, -0.1);
  rb(c, 'dark', 0.046, 0.07, 0.05, 0.006, 0, 0.02, -0.19, 0.1);
  rb(c, 'dark', 0.052, 0.06, 0.2, 0.008, 0, 0.098, -0.15);
  receiverFurniture(c, 0.026, topY - 0.005, -0.16);
  screws(c, [[0.026, 0.045, -0.02], [0.026, 0.03, -0.17], [-0.026, 0.045, -0.02]]);
  // Handguard with M-LOK slots, barrel nut, gas block and barrel.
  rb(c, 'dark', 0.05, 0.06, 0.3, 0.012, 0, 0.098, -0.4);
  mlok(c, 0.025, 0.098, 0.03, -0.26, -0.54, 2);
  cylZ(c, 'metal', 0.028, 0.02, 0, 0.098, -0.255);
  cylZ(c, 'metal', 0.009, 0.16, 0, boreY, -0.62, 0.0085);
  box(c, 'dark', 0.018, 0.02, 0.02, 0, boreY + 0.008, -0.6);
  compensator(c, boreY, -0.76, 0.06, 0.014);
  // Full-length top rail.
  rail(c, 0.021, topY, 0, -0.05, -0.55);
  // Buffer tube & stock.
  carbineStock(c, 0.098, -0.05, 0.32);
  // Grip, trigger, magazine.
  pistolGrip(c, 0, -0.02, 0.0, 0.32);
  trigger(c, 0, 0.012, -0.05, 0.055);
  magazine(c, 0, 0.0, -0.19, 0.028, 0.19, 0.068, 0.2, 3);
  // Optic, front sight, light and angled foregrip.
  const sightY = redDot(c, 0, topY, -0.14, 1.1);
  box(c, 'metal', 0.006, 0.014, 0.008, 0, topY + 0.012, -0.5);
  box(c, 'accent', 0.003, 0.003, 0.002, 0, topY + 0.016, -0.505);
  flashlight(c, 0.037, 0.112, -0.44, 0.012, 0.08);
  rb(c, 'polymer', 0.03, 0.05, 0.045, 0.008, 0, 0.05, -0.45, -0.6);
  box(c, 'accent', 0.002, 0.004, 0.22, 0.026, 0.072, -0.4);
  box(c, 'accent', 0.002, 0.004, 0.22, -0.026, 0.072, -0.4);
  if (c.hands) {
    gripHandRight(c, 0, -0.02, 0.0, 0.32, 0.017);
    supportHandLeft(c, 0, 0.068, -0.39, 0.025);
  }
  return { muzzle: new THREE.Vector3(0, boreY, -0.77), hip: new THREE.Vector3(0.27, -0.27, -0.5), ads: new THREE.Vector3(0, -sightY, -0.42) };
}

function shotgun(c: Ctx): WeaponData {
  const barrelY = 0.11;
  const tubeY = 0.062;
  // Receiver with loading & ejection ports.
  rb(c, 'metal', 0.05, 0.082, 0.24, 0.008, 0, 0.07, -0.1);
  box(c, 'rubber', 0.003, 0.02, 0.05, 0.025, 0.08, -0.12);
  box(c, 'rubber', 0.02, 0.003, 0.05, 0, 0.03, -0.14);
  rail(c, 0.021, 0.125, 0, 0.0, -0.2);
  // Barrel, magazine tube, clamp and heat shield.
  cylZ(c, 'metal', 0.012, 0.6, 0, barrelY, -0.52);
  cylZ(c, 'metal', 0.012, 0.5, 0, tubeY, -0.47);
  box(c, 'metal', 0.03, 0.06, 0.02, 0, (barrelY + tubeY) / 2, -0.7);
  cylZ(c, 'dark', 0.012, 0.03, 0, tubeY, -0.73, 0.01);
  const hs = new THREE.CylinderGeometry(0.02, 0.02, 0.3, c.hi ? 12 : 8, 1, true, Math.PI, Math.PI);
  c.pb.part(hs, 'dark', 0, barrelY, -0.38, -HALF_PI, 0, 0);
  hs.dispose();
  if (c.hi) for (let i = 0; i < 6; i++) box(c, 'rubber', 0.006, 0.003, 0.014, 0.0, barrelY + 0.02, -0.26 - i * 0.045);
  // Pump forend with ribs and action bars.
  rb(c, 'polymer', 0.046, 0.058, 0.2, 0.01, 0, tubeY, -0.5);
  if (c.hi) for (let i = 0; i < 7; i++) box(c, 'rubber', 0.048, 0.06, 0.003, 0, tubeY, -0.42 - i * 0.026);
  box(c, 'metal', 0.004, 0.01, 0.2, 0.02, 0.07, -0.3);
  box(c, 'metal', 0.004, 0.01, 0.2, -0.02, 0.07, -0.3);
  box(c, 'accent', 0.002, 0.005, 0.12, 0.024, tubeY - 0.015, -0.5);
  box(c, 'accent', 0.002, 0.005, 0.12, -0.024, tubeY - 0.015, -0.5);
  // Sights: brass bead and ghost ring.
  sphere(c, 'brass', 0.0045, 0, barrelY + 0.016, -0.81);
  box(c, 'metal', 0.006, 0.01, 0.01, 0, barrelY + 0.008, -0.81);
  ringZ(c, 'metal', 0.011, 0.002, 0, 0.14, -0.03);
  box(c, 'metal', 0.006, 0.014, 0.008, 0, 0.128, -0.03);
  const sightY = 0.14;
  // Stock with pistol grip, cheek pad and buttpad.
  pistolGrip(c, 0, -0.025, 0.03, 0.35);
  trigger(c, 0, 0.03, -0.02, 0.05);
  rb(c, 'polymer', 0.04, 0.09, 0.22, 0.012, 0, 0.055, 0.15);
  rb(c, 'rubber', 0.034, 0.03, 0.12, 0.006, 0, 0.11, 0.16);
  rb(c, 'rubber', 0.044, 0.11, 0.02, 0.005, 0, 0.05, 0.265);
  // Side saddle with shells (left side).
  box(c, 'dark', 0.012, 0.075, 0.13, -0.031, 0.07, -0.1);
  for (let i = 0; i < 4; i++) {
    const z = -0.045 - i * 0.032;
    cylY(c, 'shell', 0.009, 0.05, -0.037, 0.078, z, 0.009, 10);
    cylY(c, 'brass', 0.0095, 0.012, -0.037, 0.047, z, 0.0095, 10);
  }
  if (c.hands) {
    gripHandRight(c, 0, -0.025, 0.03, 0.35, 0.017);
    supportHandLeft(c, 0, tubeY - 0.029, -0.5, 0.023);
  }
  return { muzzle: new THREE.Vector3(0, barrelY, -0.83), hip: new THREE.Vector3(0.27, -0.28, -0.48), ads: new THREE.Vector3(0, -sightY, -0.4) };
}

function sniper(c: Ctx): WeaponData {
  const boreY = 0.095;
  const railY = 0.13;
  // Chassis, forend with M-LOK, barrel and suppressor.
  rb(c, 'dark', 0.05, 0.07, 0.5, 0.008, 0, 0.065, -0.1);
  rb(c, 'dark', 0.046, 0.06, 0.32, 0.01, 0, 0.07, -0.5);
  mlok(c, 0.023, 0.07, 0.03, -0.36, -0.64, 2);
  rail(c, 0.021, railY, 0, 0.0, -0.35);
  cylZ(c, 'metal', 0.013, 0.36, 0, boreY, -0.83, 0.011);
  suppressor(c, boreY, -1.16, 0.18, 0.024);
  box(c, 'accent', 0.002, 0.005, 0.3, 0.026, 0.045, -0.1);
  box(c, 'accent', 0.002, 0.005, 0.3, -0.026, 0.045, -0.1);
  // Bolt: body, handle, knob; ejection port.
  cylZ(c, 'metal', 0.011, 0.11, 0, 0.1, 0.0);
  cylX(c, 'metal', 0.006, 0.06, 0.045, 0.095, -0.02);
  sphere(c, 'polymer', 0.013, 0.078, 0.085, -0.02);
  box(c, 'rubber', 0.003, 0.018, 0.06, 0.025, 0.09, -0.1);
  // Scope.
  const sightY = scope(c, 0, railY, -0.32, 0.04, 0.017);
  // Magazine, grip, trigger.
  magazine(c, 0, 0.03, -0.17, 0.03, 0.1, 0.06, 0.08, 2);
  pistolGrip(c, 0, -0.02, 0.0, 0.3);
  trigger(c, 0, 0.03, -0.05, 0.05);
  // Adjustable stock, cheek riser, buttpad, monopod.
  rb(c, 'dark', 0.04, 0.11, 0.2, 0.008, 0, 0.05, 0.27);
  rb(c, 'polymer', 0.034, 0.03, 0.12, 0.006, 0, 0.12, 0.26);
  rb(c, 'rubber', 0.044, 0.125, 0.02, 0.005, 0, 0.05, 0.38);
  cylY(c, 'metal', 0.005, 0.06, 0, -0.03, 0.33);
  box(c, 'rubber', 0.02, 0.008, 0.02, 0, -0.062, 0.33);
  screws(c, [[0.021, 0.08, 0.2], [0.021, 0.02, 0.2], [0.021, 0.05, 0.34]]);
  // Bipod (folded forward) with rubber feet.
  box(c, 'metal', 0.03, 0.02, 0.03, 0, 0.032, -0.6);
  for (const sx of [-1, 1]) {
    c.pb.capsule('metal', new THREE.Vector3(sx * 0.014, 0.03, -0.6), new THREE.Vector3(sx * 0.05, -0.12, -0.63), 0.005, undefined, 8, 2);
    box(c, 'rubber', 0.014, 0.014, 0.014, sx * 0.05, -0.125, -0.63);
  }
  if (c.hands) {
    gripHandRight(c, 0, -0.02, 0.0, 0.3, 0.017);
    supportHandLeft(c, 0, 0.04, -0.5, 0.023);
  }
  return { muzzle: new THREE.Vector3(0, boreY, -1.17), hip: new THREE.Vector3(0.27, -0.28, -0.55), ads: new THREE.Vector3(0, -sightY, -0.35) };
}

function rocket(c: Ctx): WeaponData {
  const y = 0.12;
  // Launch tube with front flare and rear venturi, bands and rings.
  cylZ(c, 'dark', 0.06, 0.9, 0, y, -0.3);
  cylZ(c, 'metal', 0.06, 0.1, 0, y, -0.8, 0.078);
  cylZ(c, 'metal', 0.06, 0.12, 0, y, 0.21, 0.058);
  cylZ(c, 'metal', 0.082, 0.02, 0, y, 0.28, 0.084);
  for (const z of [-0.6, -0.05, 0.1]) ringZ(c, 'metal', 0.062, 0.006, 0, y, z);
  for (const z of [-0.42, -0.18]) ringZ(c, 'accent', 0.062, 0.004, 0, y, z);
  box(c, 'rubber', 0.13, 0.02, 0.04, 0, y, -0.68);
  // Inner bore darkening and loaded warhead tip.
  cylZ(c, 'rubber', 0.052, 0.004, 0, y, -0.85);
  cylZ(c, 'dark', 0.045, 0.1, 0, y, -0.9, 0.02);
  cylZ(c, 'accent', 0.02, 0.02, 0, y, -0.955, 0.008);
  // Trigger housing, grips and shoulder rest.
  rb(c, 'dark', 0.045, 0.07, 0.16, 0.008, 0, 0.045, -0.12);
  pistolGrip(c, 0, -0.01, -0.09, 0.3);
  trigger(c, 0, 0.02, -0.15, 0.05);
  rb(c, 'polymer', 0.032, 0.09, 0.04, 0.008, 0, 0.02, -0.4, -0.15);
  rb(c, 'rubber', 0.05, 0.03, 0.16, 0.008, 0, 0.05, 0.05);
  // Optical sight unit offset to the left, with accent power light.
  box(c, 'dark', 0.03, 0.03, 0.12, -0.055, 0.2, -0.22);
  box(c, 'dark', 0.036, 0.07, 0.11, -0.055, 0.245, -0.22);
  cylZ(c, 'lens', 0.014, 0.004, -0.055, 0.245, -0.277);
  cylZ(c, 'lens', 0.011, 0.004, -0.055, 0.245, -0.163);
  box(c, 'accent', 0.006, 0.006, 0.006, -0.055, 0.283, -0.22);
  box(c, 'metal', 0.02, 0.02, 0.04, -0.04, 0.17, -0.22);
  // Carry handle & sling loops.
  box(c, 'dark', 0.02, 0.012, 0.16, 0, 0.19, 0.0);
  box(c, 'dark', 0.02, 0.02, 0.012, 0, 0.18, -0.08);
  box(c, 'dark', 0.02, 0.02, 0.012, 0, 0.18, 0.08);
  screws(c, [[0.06, 0.12, -0.4], [0.06, 0.12, 0.0], [-0.06, 0.12, -0.4]]);
  if (c.hands) {
    gripHandRight(c, 0, -0.01, -0.09, 0.3, 0.017);
    gripHandLeft(c, 0, 0.02, -0.4, -0.15, 0.016);
  }
  return { muzzle: new THREE.Vector3(0, y, -0.96), hip: new THREE.Vector3(0.24, -0.3, -0.45), ads: new THREE.Vector3(0.055, -0.245, -0.4) };
}

function rocketShell(c: Ctx): WeaponData {
  // Flying rocket: nose, body, fins and glowing motor. Forward is -Z.
  cylZ(c, 'dark', 0.045, 0.22, 0, 0, -0.03);
  cylZ(c, 'metal', 0.045, 0.12, 0, 0, -0.2, 0.012);
  cylZ(c, 'accent', 0.012, 0.03, 0, 0, -0.27, 0.004);
  cylZ(c, 'metal', 0.035, 0.06, 0, 0, 0.11, 0.045);
  cylZ(c, 'accent', 0.028, 0.01, 0, 0, 0.145);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    box(c, 'metal', 0.004, 0.05, 0.1, Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0.08, 0, 0, a);
  }
  ringZ(c, 'accent', 0.046, 0.003, 0, 0, -0.1);
  return { muzzle: new THREE.Vector3(0, 0, -0.28), hip: new THREE.Vector3(0.24, -0.3, -0.45), ads: new THREE.Vector3(0, -0.2, -0.4) };
}

function grenade(c: Ctx): WeaponData {
  // Fragmentation body with grooves, fuze head, pull ring and safety lever.
  const body = lathe([[0, -0.06], [0.03, -0.058], [0.05, -0.04], [0.056, -0.012], [0.056, 0.012], [0.05, 0.036], [0.034, 0.05], [0.022, 0.055], [0.022, 0.07]], c.hi ? 18 : 12);
  c.pb.part(body, 'dark', 0, 0, 0);
  body.dispose();
  for (let i = 0; i < 3; i++) {
    const g = new THREE.TorusGeometry(0.0565, 0.004, 6, c.hi ? 20 : 12);
    c.pb.part(g, 'rubber', 0, -0.026 + i * 0.024, 0, HALF_PI, 0, 0);
    g.dispose();
  }
  if (c.hi) for (let i = 0; i < 8; i++) box(c, 'rubber', 0.004, 0.08, 0.004, Math.cos((i / 8) * Math.PI * 2) * 0.0555, 0, Math.sin((i / 8) * Math.PI * 2) * 0.0555, 0, -(i / 8) * Math.PI * 2, 0);
  cylY(c, 'metal', 0.02, 0.025, 0, 0.08, 0);
  box(c, 'metal', 0.012, 0.055, 0.008, 0.024, 0.045, 0, 0, 0, -0.35);
  const ring = new THREE.TorusGeometry(0.012, 0.0025, 5, 14);
  c.pb.part(ring, 'metal', 0.028, 0.09, 0, 0, 0, HALF_PI);
  ring.dispose();
  box(c, 'accent', 0.012, 0.006, 0.006, -0.018, 0.078, 0);
  cylY(c, 'accent', 0.021, 0.004, 0, 0.0, 0);
  if (c.hands) {
    const pos = new THREE.Vector3(0.05, -0.02, 0.0);
    const frame = frameFrom(pos, new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1));
    hand(c, 1, frame, { curl: HOLD_CURL, thumb: GRIP_THUMB, elbow: pos.clone().add(new THREE.Vector3(0.12, -0.3, 0.26)) });
  }
  return { muzzle: new THREE.Vector3(0, 0, -0.1), hip: new THREE.Vector3(0.24, -0.26, -0.4), ads: new THREE.Vector3(0.2, -0.22, -0.4) };
}

const BUILDERS: Record<ModelId, (c: Ctx) => WeaponData> = { pistol, smg, rifle, shotgun, sniper, rocket, rocketShell, grenade };

/**
 * Builds a detailed PBR weapon model. Forward is -Z, the grip is near the origin.
 * Geometry is cached per (id, hands, detail) and shared between instances; materials are per team accent.
 * userData: { muzzle: Vector3, hip: Vector3, ads: Vector3 }
 */
export function buildWeaponModel(id: ModelId, accent: THREE.Color, withHands = false, detail: WeaponDetail = withHands ? 'high' : 'low'): THREE.Group {
  const key = `${id}|${withHands ? 1 : 0}|${detail}`;
  let geos = geoCache.get(key);
  let data = dataCache.get(key);
  if (!geos || !data) {
    const pb = new PartBuilder<MatKey>({ uvDensity: 6 });
    const c: Ctx = { pb, hi: detail === 'high', hands: withHands };
    data = BUILDERS[id](c);
    geos = pb.merge();
    geoCache.set(key, geos);
    dataCache.set(key, data);
  }
  const m = mats(accent);
  const g = new THREE.Group();
  g.name = `weapon-${id}`;
  meshesFrom(geos, g, (k) => m[k], !withHands);
  g.userData.muzzle = data.muzzle.clone();
  g.userData.hip = data.hip.clone();
  g.userData.ads = data.ads.clone();
  g.userData.shared = true;
  return g;
}

/** Triangle count of a model (for perf probes). */
export function triangleCount(obj: THREE.Object3D): number {
  let n = 0;
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const g = o.geometry as THREE.BufferGeometry;
      n += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    }
  });
  return n;
}
