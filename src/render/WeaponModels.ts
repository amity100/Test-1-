import * as THREE from 'three';
import type { WeaponId } from '../sim/Weapons';
import { PartBuilder, PRIM, rbox, frustum, lathe, meshesFrom } from './PartBuilder';
import { armorMaps, quiltMaps, fabricMaps, gunmetalMaps, polymerMaps, rubberMaps, woodMaps } from './DetailTextures';

/** Uniform camouflage tones shared with the character model. */
export type ModelId = WeaponId | 'grenade' | 'rocketShell' | 'stone' | 'bolt';
export type WeaponDetail = 'high' | 'low';

type MatKey = 'metal' | 'dark' | 'polymer' | 'rubber' | 'accent' | 'wood' | 'lens' | 'glove' | 'pad' | 'sleeve' | 'light' | 'brass' | 'shell' | 'skin' | 'iron' | 'steel' | 'rope' | 'clay';

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
  const cm = quiltMaps('sleeve', [[0.66, 0.6, 0.48], [0.46, 0.4, 0.3]]);
  m = {
    metal: std({ color: 0x5c626c, metalness: 0.9, roughness: 1, map: gm.map, normalMap: gm.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: gm.roughnessMap }),
    dark: std({ color: 0x262a30, metalness: 0.45, roughness: 1, map: am.map, normalMap: am.normalMap, normalScale: new THREE.Vector2(0.45, 0.45), roughnessMap: am.roughnessMap }),
    polymer: std({ color: 0x1c1e22, metalness: 0.05, roughness: 1, map: pm.map, normalMap: pm.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: pm.roughnessMap }),
    rubber: std({ color: 0x0e0f11, metalness: 0, roughness: 1, map: rm.map, normalMap: rm.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), roughnessMap: rm.roughnessMap }),
    accent: std({ color: accent.clone().multiplyScalar(0.55), emissive: accent, emissiveIntensity: 1.1, metalness: 0.3, roughness: 0.35 }),
    wood: std({ color: 0x8a5a30, metalness: 0, roughness: 1, map: wm.map, normalMap: wm.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: wm.roughnessMap }),
    iron: std({ color: 0x3a3d42, metalness: 0.75, roughness: 0.9, map: gm.map, normalMap: gm.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: gm.roughnessMap }),
    steel: std({ color: 0x9aa3ad, metalness: 0.95, roughness: 0.35, map: gm.map, normalMap: gm.normalMap, normalScale: new THREE.Vector2(0.4, 0.4) }),
    rope: std({ color: 0x9c8a5c, metalness: 0, roughness: 1, map: fm.map, normalMap: fm.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: fm.roughnessMap }),
    clay: std({ color: 0xa2603a, metalness: 0, roughness: 0.95, map: am.map, normalMap: am.normalMap, normalScale: new THREE.Vector2(0.5, 0.5) }),
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

/** Wooden stock running along -Z: a straight forestock and a dropped butt with a brass plate. */
function woodStock(c: Ctx, y: number, zFront: number, zBack: number, w: number, h: number, buttDrop = 0.05): void {
  rb(c, 'wood', w, h, zBack - zFront, 0.008, 0, y, (zFront + zBack) / 2);
  rb(c, 'wood', w + 0.006, h + 0.06, 0.2, 0.012, 0, y - buttDrop, zBack + 0.08, 0.18);
  box(c, 'brass', w + 0.008, h + 0.07, 0.012, 0, y - buttDrop - 0.012, zBack + 0.185, 0.18);
}

/** Steel prod (the bow of a crossbow) across the front, curving back at the tips, with the string drawn to the nut. */
function prod(c: Ctx, y: number, zFront: number, tipX: number, zNut: number, thick: number): void {
  const n = 5;
  for (let i = -n; i <= n; i++) {
    if (i === 0) continue;
    const t0 = (i - Math.sign(i) * 0.5) / n;
    const x = t0 * tipX;
    const sag = 0.28 * tipX * t0 * t0;
    box(c, 'steel', (tipX / n) * 1.06, thick, 0.02 - Math.abs(t0) * 0.006, x, y, zFront + sag, 0, -Math.atan((0.56 * tipX * t0) / tipX), 0);
  }
  box(c, 'iron', 0.05, thick + 0.012, 0.03, 0, y, zFront + 0.004);
  for (const sx of [-1, 1]) c.pb.capsule('rope', new THREE.Vector3(sx * tipX, y, zFront + 0.28 * tipX), new THREE.Vector3(0, y + 0.012, zNut), 0.0035, undefined, 6, 2);
  cylX(c, 'brass', 0.012, 0.03, 0, y + 0.01, zNut);
}

/** A bolt lying in the groove: shaft, iron head and two feathers in the team colour. */
function bolt(c: Ctx, y: number, zHead: number, len: number): void {
  cylZ(c, 'wood', 0.005, len, 0, y, zHead + len / 2);
  cylZ(c, 'iron', 0.007, 0.04, 0, y, zHead - 0.01, 0.001);
  box(c, 'accent', 0.002, 0.02, 0.05, 0.006, y + 0.006, zHead + len - 0.03, 0, 0, 0.6);
  box(c, 'accent', 0.002, 0.02, 0.05, -0.006, y + 0.006, zHead + len - 0.03, 0, 0, -0.6);
}

/** Flintlock: a brace pistol with a walnut stock, brass lock plate and a sharply dropped grip. */
function flintlock(c: Ctx): WeaponData {
  const boreY = 0.085;
  rb(c, 'wood', 0.036, 0.034, 0.24, 0.006, 0, boreY - 0.03, -0.12);
  rb(c, 'wood', 0.038, 0.13, 0.05, 0.012, 0, -0.03, 0.035, 0.42);
  sphere(c, 'brass', 0.024, 0, -0.095, 0.075);
  cylZ(c, 'iron', 0.012, 0.28, 0, boreY, -0.16, 0.011, 8);
  box(c, 'brass', 0.004, 0.008, 0.008, 0, boreY + 0.014, -0.28);
  box(c, 'brass', 0.004, 0.032, 0.075, 0.021, boreY - 0.01, -0.01);
  box(c, 'iron', 0.006, 0.05, 0.01, 0.024, boreY + 0.02, 0.012, -0.5);
  box(c, 'iron', 0.006, 0.012, 0.03, 0.024, boreY + 0.012, -0.03);
  box(c, 'iron', 0.008, 0.008, 0.02, 0.026, boreY - 0.002, -0.02);
  cylZ(c, 'brass', 0.003, 0.22, 0, boreY - 0.05, -0.15);
  box(c, 'iron', 0.02, 0.01, 0.01, 0, boreY + 0.016, 0.0);
  trigger(c, 0, 0.03, -0.01, 0.05);
  if (c.hands) {
    gripHandRight(c, 0, -0.03, 0.035, 0.42, 0.019);
    gripHandLeft(c, 0, -0.045, 0.025, 0.42, 0.019 + 0.025);
  }
  return { muzzle: new THREE.Vector3(0, boreY, -0.3), hip: new THREE.Vector3(0.24, -0.25, -0.42), ads: new THREE.Vector3(0, -(boreY + 0.022), -0.34) };
}

/** Repeating crossbow: a short tiller with a wooden magazine box on top and a lever to span it. */
function repeater(c: Ctx): WeaponData {
  const railY = 0.09;
  woodStock(c, 0.07, -0.34, 0.1, 0.04, 0.046, 0.03);
  rb(c, 'wood', 0.05, 0.07, 0.2, 0.006, 0, railY + 0.045, -0.2);
  box(c, 'iron', 0.052, 0.004, 0.2, 0, railY + 0.082, -0.2);
  box(c, 'wood', 0.018, 0.02, 0.26, 0.032, railY + 0.02, 0.0, 0.35);
  cylX(c, 'brass', 0.008, 0.06, 0, railY + 0.03, -0.1);
  prod(c, railY - 0.005, -0.33, 0.22, -0.1, 0.01);
  ringZ(c, 'iron', 0.026, 0.004, 0, railY - 0.035, -0.36);
  bolt(c, railY + 0.008, -0.31, 0.2);
  trigger(c, 0, 0.03, -0.04, 0.05);
  pistolGrip(c, 0, -0.02, 0.05, 0.3, 0.1, 0.032, 0.05);
  if (c.hands) {
    gripHandRight(c, 0, -0.02, 0.05, 0.3, 0.017);
    supportHandLeft(c, 0, 0.045, -0.22, 0.024);
  }
  return { muzzle: new THREE.Vector3(0, railY + 0.01, -0.35), hip: new THREE.Vector3(0.26, -0.27, -0.46), ads: new THREE.Vector3(0, -(railY + 0.09), -0.4) };
}

/** Crossbow: a long tiller with a steel prod, stirrup, nut and one bolt in the groove. */
function crossbow(c: Ctx): WeaponData {
  const railY = 0.1;
  woodStock(c, 0.075, -0.45, 0.12, 0.042, 0.05, 0.04);
  box(c, 'wood', 0.02, 0.008, 0.5, 0, railY + 0.002, -0.2);
  prod(c, railY - 0.01, -0.44, 0.3, -0.06, 0.012);
  ringZ(c, 'iron', 0.03, 0.005, 0, railY - 0.04, -0.47);
  bolt(c, railY + 0.012, -0.42, 0.32);
  trigger(c, 0, 0.03, -0.03, 0.06);
  box(c, 'iron', 0.02, 0.012, 0.01, 0, railY + 0.026, 0.02);
  if (c.hands) {
    gripHandRight(c, 0, -0.02, 0.06, 0.35, 0.02);
    supportHandLeft(c, 0, 0.05, -0.3, 0.024);
  }
  return { muzzle: new THREE.Vector3(0, railY + 0.012, -0.45), hip: new THREE.Vector3(0.27, -0.27, -0.5), ads: new THREE.Vector3(0, -(railY + 0.03), -0.42) };
}

/** Hand cannon: a stout flared iron barrel with reinforcing rings, strapped to a wooden haft, a coal at the touch hole. */
function handcannon(c: Ctx): WeaponData {
  const boreY = 0.1;
  cylZ(c, 'iron', 0.03, 0.42, 0, boreY, -0.26, 0.038, 10);
  for (const z of [-0.12, -0.25, -0.38]) ringZ(c, 'iron', 0.034, 0.006, 0, boreY, z);
  cylZ(c, 'rubber', 0.026, 0.004, 0, boreY, -0.472);
  rb(c, 'wood', 0.046, 0.05, 0.5, 0.01, 0, boreY - 0.05, 0.0);
  rb(c, 'wood', 0.05, 0.1, 0.16, 0.012, 0, boreY - 0.09, 0.28, 0.2);
  for (const z of [-0.2, -0.04]) box(c, 'brass', 0.05, 0.062, 0.012, 0, boreY - 0.02, z);
  sphere(c, 'accent', 0.006, 0, boreY + 0.03, -0.05);
  for (let i = 0; i < 4; i++) ringZ(c, 'rope', 0.03, 0.003, 0, boreY - 0.05, 0.1 + i * 0.012);
  trigger(c, 0, 0.03, 0.02, 0.05);
  if (c.hands) {
    gripHandRight(c, 0, -0.02, 0.08, 0.3, 0.02);
    supportHandLeft(c, 0, 0.045, -0.15, 0.026);
  }
  return { muzzle: new THREE.Vector3(0, boreY, -0.48), hip: new THREE.Vector3(0.27, -0.28, -0.48), ads: new THREE.Vector3(0, -(boreY + 0.04), -0.4) };
}

/** Arquebus: a long octagonal barrel on a heavy stock, a serpentine matchlock with a smouldering cord. */
function arquebus(c: Ctx): WeaponData {
  const boreY = 0.1;
  woodStock(c, 0.07, -0.72, 0.16, 0.042, 0.06, 0.06);
  cylZ(c, 'iron', 0.015, 1.0, 0, boreY, -0.4, 0.013, 8);
  for (const z of [-0.2, -0.45, -0.7]) ringZ(c, 'brass', 0.017, 0.003, 0, boreY, z);
  sphere(c, 'brass', 0.004, 0, boreY + 0.018, -0.88);
  box(c, 'iron', 0.02, 0.012, 0.01, 0, boreY + 0.02, -0.02);
  box(c, 'brass', 0.004, 0.03, 0.1, 0.022, boreY - 0.012, 0.0);
  box(c, 'iron', 0.006, 0.07, 0.01, 0.026, boreY + 0.02, 0.03, 0.35);
  box(c, 'iron', 0.006, 0.01, 0.05, 0.026, boreY + 0.05, 0.0);
  c.pb.capsule('rope', new THREE.Vector3(0.028, boreY + 0.055, -0.01), new THREE.Vector3(0.05, boreY - 0.06, 0.12), 0.003, undefined, 6, 2);
  box(c, 'accent', 0.006, 0.006, 0.006, 0.028, boreY + 0.058, -0.012);
  box(c, 'iron', 0.01, 0.006, 0.02, 0.026, boreY + 0.002, -0.03);
  cylZ(c, 'brass', 0.003, 0.9, 0, boreY - 0.045, -0.38);
  trigger(c, 0, 0.025, -0.02, 0.06);
  if (c.hands) {
    gripHandRight(c, 0, -0.02, 0.1, 0.3, 0.02);
    supportHandLeft(c, 0, 0.04, -0.5, 0.024);
  }
  return { muzzle: new THREE.Vector3(0, boreY, -0.9), hip: new THREE.Vector3(0.27, -0.28, -0.55), ads: new THREE.Vector3(0, -(boreY + 0.022), -0.35) };
}

/** Hand mortar: a short bell-mouthed bronze barrel on a musket stock, a bomb with a lit fuse in its mouth. */
function mortar(c: Ctx): WeaponData {
  const boreY = 0.12;
  cylZ(c, 'brass', 0.05, 0.3, 0, boreY, -0.22, 0.066, 12);
  ringZ(c, 'brass', 0.056, 0.008, 0, boreY, -0.1);
  cylZ(c, 'rubber', 0.05, 0.004, 0, boreY, -0.372);
  sphere(c, 'iron', 0.044, 0, boreY, -0.33);
  c.pb.capsule('rope', new THREE.Vector3(0, boreY + 0.04, -0.33), new THREE.Vector3(0.01, boreY + 0.09, -0.36), 0.004, undefined, 6, 2);
  box(c, 'accent', 0.008, 0.008, 0.008, 0.01, boreY + 0.095, -0.365);
  woodStock(c, 0.06, -0.3, 0.14, 0.05, 0.07, 0.07);
  trigger(c, 0, 0.02, -0.06, 0.06);
  box(c, 'brass', 0.004, 0.03, 0.08, 0.026, boreY - 0.03, -0.02);
  if (c.hands) {
    gripHandRight(c, 0, -0.01, 0.1, 0.3, 0.02);
    supportHandLeft(c, 0, 0.03, -0.2, 0.026);
  }
  return { muzzle: new THREE.Vector3(0, boreY, -0.38), hip: new THREE.Vector3(0.24, -0.3, -0.45), ads: new THREE.Vector3(0, -(boreY + 0.07), -0.4) };
}

/** The mortar's bomb in flight: an iron ball with a brass band and a sparking fuse. */
function bomb(c: Ctx): WeaponData {
  sphere(c, 'iron', 0.06, 0, 0, 0);
  ringZ(c, 'brass', 0.06, 0.005, 0, 0, 0);
  c.pb.capsule('rope', new THREE.Vector3(0, 0.055, 0), new THREE.Vector3(0.02, 0.11, 0.01), 0.005, undefined, 6, 2);
  sphere(c, 'accent', 0.012, 0.02, 0.115, 0.01);
  return { muzzle: new THREE.Vector3(0, 0, -0.06), hip: new THREE.Vector3(0.24, -0.3, -0.45), ads: new THREE.Vector3(0, -0.2, -0.4) };
}

/** Fire pot: a clay pot of pitch with a rope sling and a burning rag stuffed in its neck. */
function firepot(c: Ctx): WeaponData {
  const body = lathe([[0, -0.06], [0.03, -0.058], [0.052, -0.035], [0.058, 0.0], [0.05, 0.03], [0.03, 0.045], [0.026, 0.06], [0.032, 0.07], [0.024, 0.072], [0, 0.072]], c.hi ? 18 : 12);
  c.pb.part(body, 'clay', 0, 0, 0);
  body.dispose();
  const sling = new THREE.TorusGeometry(0.055, 0.004, 6, c.hi ? 20 : 12);
  c.pb.part(sling, 'rope', 0, -0.01, 0, HALF_PI, 0, 0);
  sling.dispose();
  c.pb.capsule('rope', new THREE.Vector3(0, 0.06, 0), new THREE.Vector3(0.015, 0.12, 0.01), 0.008, undefined, 8, 2);
  sphere(c, 'accent', 0.018, 0.02, 0.135, 0.012);
  if (c.hands) {
    const pos = new THREE.Vector3(0.05, -0.02, 0.0);
    const frame = frameFrom(pos, new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1));
    hand(c, 1, frame, { curl: HOLD_CURL, thumb: GRIP_THUMB, elbow: pos.clone().add(new THREE.Vector3(0.12, -0.3, 0.26)) });
  }
  return { muzzle: new THREE.Vector3(0, 0, -0.1), hip: new THREE.Vector3(0.24, -0.26, -0.4), ads: new THREE.Vector3(0.2, -0.22, -0.4) };
}

/** A catapult stone in flight: a rough boulder. */
function stone(c: Ctx): WeaponData {
  sphere(c, 'iron', 0.3, 0, 0, 0);
  box(c, 'iron', 0.34, 0.34, 0.34, 0, 0, 0, 0.5, 0.4, 0.3);
  box(c, 'iron', 0.3, 0.3, 0.3, 0.06, -0.04, 0.04, 1.1, 0.7, 0.2);
  return { muzzle: new THREE.Vector3(0, 0, -0.3), hip: new THREE.Vector3(0.24, -0.3, -0.45), ads: new THREE.Vector3(0, -0.2, -0.4) };
}

/** A ballista bolt in flight: a metre of ash with an iron head and leather vanes. Forward is -Z. */
function boltShell(c: Ctx): WeaponData {
  cylZ(c, 'wood', 0.02, 1.1, 0, 0, 0.05);
  cylZ(c, 'iron', 0.032, 0.22, 0, 0, -0.6, 0.004);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    box(c, 'rubber', 0.006, 0.09, 0.22, Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0.45, 0, 0, a);
  }
  return { muzzle: new THREE.Vector3(0, 0, -0.7), hip: new THREE.Vector3(0.24, -0.3, -0.45), ads: new THREE.Vector3(0, -0.2, -0.4) };
}

const BUILDERS: Record<ModelId, (c: Ctx) => WeaponData> = { pistol: flintlock, smg: repeater, rifle: crossbow, shotgun: handcannon, sniper: arquebus, rocket: mortar, rocketShell: bomb, grenade: firepot, stone, bolt: boltShell };

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
