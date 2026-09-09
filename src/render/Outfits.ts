import * as THREE from 'three';
import { PartBuilder, PRIM, rbox, lathe } from './PartBuilder';
import { type MatKey, HIPS, TORSO, HEAD, THIGH_L, SHIN_L, THIGH_R, SHIN_R, REST, ARM_L, ARM_R, HALF_PI, partHelpers } from './CharacterRig';
import { OPERATOR_CAMO } from './WeaponModels';
import type { GadgetId } from '../sim/Gadgets';

/**
 * Outfits: head gear, camo palette and gadget-specific equipment layered over the shared operator
 * body. The first kit slot drives the silhouette (helmet type, big gear), the second adds a belt
 * item, and a seed varies palette and small flair so no two operators look alike.
 */
export type HelmetKind = 'visor' | 'fullface' | 'halfmask' | 'hood' | 'tech';
export type CamoKind = 'operator' | 'urban' | 'desert' | 'night' | 'forest' | 'earth';

export interface Outfit {
  helmet: HelmetKind;
  camo: CamoKind;
  kit: GadgetId[];
  /** 0 none, 1 arm band, 2 scarf. */
  flair: number;
}

export const CAMOS: Record<CamoKind, Array<[number, number, number]>> = {
  operator: OPERATOR_CAMO,
  urban: [[0.15, 0.16, 0.18], [0.24, 0.25, 0.28], [0.34, 0.35, 0.38], [0.45, 0.46, 0.48]],
  desert: [[0.4, 0.34, 0.24], [0.52, 0.45, 0.32], [0.62, 0.54, 0.4], [0.7, 0.63, 0.48]],
  night: [[0.06, 0.07, 0.1], [0.1, 0.11, 0.15], [0.14, 0.16, 0.21], [0.19, 0.21, 0.26]],
  forest: [[0.11, 0.15, 0.09], [0.18, 0.24, 0.14], [0.27, 0.3, 0.19], [0.34, 0.28, 0.19]],
  earth: [[0.22, 0.16, 0.1], [0.32, 0.24, 0.15], [0.42, 0.33, 0.22], [0.5, 0.41, 0.29]],
};

/** Base tint of armour plates per palette (team accent is blended in). */
export const PLATE_TINT: Record<CamoKind, number> = {
  operator: 0x3a3f47,
  urban: 0x4a4e55,
  desert: 0x6b5d48,
  night: 0x1c2026,
  forest: 0x38402f,
  earth: 0x4a3b2c,
};

const HELMET_FOR: Record<GadgetId, HelmetKind> = { zipline: 'tech', jumppad: 'visor', breach: 'fullface', grapple: 'hood', burrow: 'halfmask' };
const CAMO_FOR: Record<GadgetId, CamoKind[]> = {
  zipline: ['urban', 'night'],
  jumppad: ['night', 'operator'],
  breach: ['operator', 'urban'],
  grapple: ['forest', 'operator'],
  burrow: ['earth', 'desert'],
};

export function outfitFor(kit: GadgetId[], seed: number): Outfit {
  const primary = kit[0] ?? 'zipline';
  const camos = CAMO_FOR[primary];
  const s = Math.abs(Math.floor(seed));
  return { helmet: HELMET_FOR[primary], camo: camos[s % camos.length], kit: kit.slice(0, 2), flair: (s >> 1) % 3 };
}

/** Geometry cache key (camo only changes materials). */
export function outfitKey(o: Outfit): string {
  return `${o.helmet}|${o.kit.join('+')}|${o.flair}`;
}

const gearCache = new Map<string, Map<MatKey, THREE.BufferGeometry>>();
const UNIT_RBOX = rbox(1, 1, 1, 0.12, 2);
const UP = new THREE.Vector3(0, 1, 0);

/** Skinned gear geometry for an outfit (cached per key). */
export function buildGear(o: Outfit): Map<MatKey, THREE.BufferGeometry> {
  const key = outfitKey(o);
  let geos = gearCache.get(key);
  if (geos) return geos;
  const pb = new PartBuilder<MatKey>({ uvDensity: 3, skinned: true });
  const h = partHelpers(pb);
  pb.bone(HEAD);
  headGear(pb, h, o.helmet);
  if (o.kit[0]) primaryGear(pb, h, o.kit[0]);
  if (o.kit[1]) secondaryGear(pb, h, o.kit[1]);
  flair(pb, h, o.flair);
  geos = pb.merge();
  gearCache.set(key, geos);
  return geos;
}

type H = ReturnType<typeof partHelpers>;
const D = REST.head;
const T = REST.torso;
const HP = REST.hips;

function shell(pb: PartBuilder<MatKey>, h: H, zScale: number): void {
  const g = lathe([[0, 0.15], [0.05, 0.148], [0.085, 0.135], [0.108, 0.105], [0.118, 0.07], [0.122, 0.03], [0.122, 0.0], [0.118, -0.012], [0.112, -0.012], [0.114, 0.03], [0.11, 0.07], [0.1, 0.105], [0.078, 0.13], [0.04, 0.14], [0, 0.142]], 20);
  pb.part(g, 'armor', D.x, D.y + 0.16, D.z + 0.005, 0, 0, 0, 1, 1, zScale);
  g.dispose();
  h.ring('pad', 0.122, 0.011, D.x, D.y + 0.153, D.z + 0.005, zScale);
}

function earCups(h: H, sides: number[] = [-1, 1]): void {
  for (const sx of sides) {
    h.rb('pad', 0.02, 0.03, 0.15, 0.006, D.x + sx * 0.121, D.y + 0.2, D.z, 0, 0, 0, 1);
    h.cylX('pad', 0.036, 0.03, D.x + sx * 0.104, D.y + 0.115, D.z + 0.01);
    h.cylX('metal', 0.018, 0.008, D.x + sx * 0.121, D.y + 0.115, D.z + 0.01);
    h.box('accent', 0.004, 0.008, 0.045, D.x + sx * 0.127, D.y + 0.21, D.z - 0.02);
  }
}

function boomMic(pb: PartBuilder<MatKey>, h: H, sx: number): void {
  pb.capsule('metal', h.v(D.x + sx * 0.108, D.y + 0.1, D.z - 0.02), h.v(D.x + sx * 0.05, D.y + 0.055, D.z - 0.12), 0.005, undefined, 6, 2);
  h.sph('pad', 0.014, D.x + sx * 0.05, D.y + 0.055, D.z - 0.12);
}

/** Sphere band around the head centre (phi around Y from +X through +Z; -Z is 1.5π). */
function band(pb: PartBuilder<MatKey>, key: MatKey, r: number, phi0: number, phiLen: number, th0: number, thLen: number, zScale = 1.02, yOff = 0.135, segs = 18): void {
  const g = new THREE.SphereGeometry(r, segs, 6, Math.PI * phi0, Math.PI * phiLen, Math.PI * th0, Math.PI * thLen);
  pb.part(g, key, D.x, D.y + yOff, D.z + 0.005, 0, 0, 0, 1, 1, zScale);
  g.dispose();
}

function lowerMask(pb: PartBuilder<MatKey>, h: H): void {
  band(pb, 'pad', 0.106, 1.12, 0.76, 0.58, 0.24);
  for (let i = -1; i <= 1; i++) h.box('metal', 0.036, 0.004, 0.006, D.x + i * 0.028, D.y + 0.075 - Math.abs(i) * 0.008, D.z - 0.098 + Math.abs(i) * 0.012, 0.35, i * 0.35, 0);
}

function headGear(pb: PartBuilder<MatKey>, h: H, kind: HelmetKind): void {
  switch (kind) {
    case 'visor': {
      shell(pb, h, 1.1);
      earCups(h);
      // NVG shroud and mount on the brow, strobe at the rear.
      h.box('armor', 0.08, 0.05, 0.012, D.x, D.y + 0.235, D.z - 0.118, -0.35);
      h.box('metal', 0.045, 0.04, 0.03, D.x, D.y + 0.225, D.z - 0.13, -0.3);
      h.box('accent', 0.026, 0.007, 0.004, D.x, D.y + 0.212, D.z - 0.146, -0.3);
      h.box('accent', 0.03, 0.012, 0.012, D.x, D.y + 0.24, D.z + 0.125, 0.4);
      boomMic(pb, h, 1);
      band(pb, 'visor', 0.108, 1.13, 0.74, 0.42, 0.16);
      band(pb, 'pad', 0.111, 1.1, 0.8, 0.39, 0.05);
      lowerMask(pb, h);
      break;
    }
    case 'fullface': {
      shell(pb, h, 1.12);
      earCups(h);
      // Ballistic face plate (dark) under an armoured brow, slanted eye lenses, nose ridge, vent slits and cheek respirators.
      band(pb, 'pad', 0.109, 1.1, 0.8, 0.36, 0.48, 1.03);
      band(pb, 'armor', 0.111, 1.08, 0.84, 0.36, 0.06, 1.03);
      for (const sx of [-1, 1]) {
        h.box('visor', 0.04, 0.014, 0.01, D.x + sx * 0.042, D.y + 0.146, D.z - 0.101, 0, -sx * 0.4, sx * 0.18);
        h.cylZ('pad', 0.028, 0.03, D.x + sx * 0.072, D.y + 0.085, D.z - 0.085);
        h.ring('accent', 0.02, 0.004, D.x + sx * 0.072, D.y + 0.085, D.z - 0.1, 1, 0, 0, 0);
      }
      h.box('pad', 0.014, 0.07, 0.014, D.x, D.y + 0.12, D.z - 0.108, 0.15);
      for (let i = 0; i < 3; i++) h.box('metal', 0.04, 0.004, 0.006, D.x, D.y + 0.08 - i * 0.012, D.z - 0.106 + i * 0.006);
      h.box('accent', 0.03, 0.012, 0.012, D.x, D.y + 0.24, D.z + 0.125, 0.4);
      break;
    }
    case 'halfmask': {
      shell(pb, h, 1.1);
      earCups(h);
      // Goggles with a strap, lower half mask with a respirator canister and a vent grill.
      for (const sx of [-1, 1]) {
        h.cylZ('lens', 0.034, 0.02, D.x + sx * 0.046, D.y + 0.15, D.z - 0.098);
        h.ring('pad', 0.036, 0.009, D.x + sx * 0.046, D.y + 0.15, D.z - 0.098, 1, 0, 0, 0);
      }
      h.box('pad', 0.03, 0.014, 0.014, D.x, D.y + 0.15, D.z - 0.1);
      h.ring('nylon', 0.118, 0.008, D.x, D.y + 0.15, D.z + 0.005, 1.05);
      lowerMask(pb, h);
      h.cylZ('metal', 0.03, 0.04, D.x - 0.042, D.y + 0.08, D.z - 0.112);
      h.ring('accent', 0.02, 0.004, D.x - 0.042, D.y + 0.08, D.z - 0.133, 1, 0, 0, 0);
      h.box('accent', 0.03, 0.012, 0.012, D.x, D.y + 0.24, D.z + 0.125, 0.4);
      break;
    }
    case 'hood': {
      // Soft hood open at the front, brim over the brow, skull-line lower mask, headset with a HUD monocle.
      const hood = new THREE.SphereGeometry(0.128, 22, 12, Math.PI * 1.86, Math.PI * 1.28, 0, Math.PI * 0.6);
      pb.part(hood, 'fabric', D.x, D.y + 0.12, D.z + 0.012, 0, 0, 0, 1, 1.08, 1.12);
      hood.dispose();
      const brim = new THREE.SphereGeometry(0.135, 20, 4, Math.PI * 1.15, Math.PI * 0.7, Math.PI * 0.2, Math.PI * 0.1);
      pb.part(brim, 'fabric', D.x, D.y + 0.12, D.z + 0.012, 0, 0, 0, 1, 1.08, 1.12);
      brim.dispose();
      lowerMask(pb, h);
      const bandGeo = new THREE.TorusGeometry(0.112, 0.008, 6, 18, Math.PI);
      pb.part(bandGeo, 'pad', D.x, D.y + 0.125, D.z + 0.005);
      bandGeo.dispose();
      h.cylX('pad', 0.036, 0.03, D.x - 0.104, D.y + 0.115, D.z + 0.01);
      h.cylX('metal', 0.018, 0.008, D.x - 0.121, D.y + 0.115, D.z + 0.01);
      boomMic(pb, h, -1);
      // Monocle HUD on the right eye with its arm from the temple.
      h.box('visor', 0.036, 0.022, 0.008, D.x + 0.046, D.y + 0.148, D.z - 0.1, 0, -0.3, 0);
      h.box('metal', 0.006, 0.006, 0.06, D.x + 0.088, D.y + 0.15, D.z - 0.07, 0, -0.55, 0);
      h.box('accent', 0.008, 0.008, 0.008, D.x + 0.1, D.y + 0.15, D.z - 0.045);
      break;
    }
    case 'tech': {
      shell(pb, h, 1.16);
      earCups(h);
      // Wraparound glass, thin frames, chin guard, rear comms module with twin antennas, cheek vents.
      band(pb, 'visor', 0.109, 1.06, 0.88, 0.38, 0.2, 1.03);
      band(pb, 'pad', 0.112, 1.04, 0.92, 0.35, 0.04, 1.03);
      band(pb, 'pad', 0.112, 1.04, 0.92, 0.575, 0.04, 1.03);
      band(pb, 'pad', 0.106, 1.12, 0.76, 0.615, 0.2, 1.02);
      h.rb('metal', 0.09, 0.05, 0.045, 0.01, D.x, D.y + 0.2, D.z + 0.14);
      h.box('accent', 0.05, 0.008, 0.006, D.x, D.y + 0.2, D.z + 0.164);
      for (const sx of [-1, 1]) {
        h.cylY('metal', 0.004, 0.1, D.x + sx * 0.05, D.y + 0.29, D.z + 0.11, 0.003);
        h.sph('accent', 0.007, D.x + sx * 0.05, D.y + 0.34, D.z + 0.11);
        for (let i = 0; i < 3; i++) h.box('metal', 0.006, 0.004, 0.03, D.x + sx * 0.104, D.y + 0.06 + i * 0.012, D.z - 0.03, 0, 0, 0);
      }
      break;
    }
  }
}

/** Forearm frame: direction, up and side vectors for mounting devices. */
function forearm(arm: typeof ARM_L) {
  const dir = arm.wrist.clone().sub(arm.elbow).normalize();
  const side = new THREE.Vector3().crossVectors(UP, dir).normalize();
  return { dir, up: UP.clone(), side };
}

function torusAlong(pb: PartBuilder<MatKey>, key: MatKey, R: number, r: number, pos: THREE.Vector3, axis: THREE.Vector3): void {
  const g = new THREE.TorusGeometry(R, r, 6, 16);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize());
  pb.partM(g, key, new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1)));
  g.dispose();
}

function primaryGear(pb: PartBuilder<MatKey>, h: H, id: GadgetId): void {
  switch (id) {
    case 'zipline': {
      pb.bone(TORSO);
      // Line launcher on top of the pack: housing, angled barrel, cable spool with an accent hub.
      h.rb('metal', 0.24, 0.09, 0.12, 0.02, T.x, T.y + 0.52, T.z + 0.28);
      h.box('accent', 0.16, 0.008, 0.006, T.x, T.y + 0.565, T.z + 0.222);
      const barrel = new THREE.CylinderGeometry(0.026, 0.032, 1, 14);
      pb.part(barrel, 'metal', T.x + 0.075, T.y + 0.61, T.z + 0.23, -0.75, 0, 0, 1, 0.2, 1);
      barrel.dispose();
      h.cylX('pad', 0.06, 0.09, T.x - 0.075, T.y + 0.535, T.z + 0.3);
      h.ring('accent', 0.04, 0.006, T.x - 0.03, T.y + 0.535, T.z + 0.3, 1, 0, HALF_PI, 0);
      for (const sx of [-1, 1]) h.ring('metal', 0.024, 0.005, T.x + sx * 0.11, T.y + 0.46, T.z - 0.19, 1, 0, 0, 0);
      pb.bone(HIPS);
      hipCoil(h);
      break;
    }
    case 'jumppad': {
      for (const [thigh, shin, TH, SH, sx] of legs()) {
        pb.bone(thigh);
        h.rb('metal', 0.04, 0.05, 0.06, 0.01, TH.x + sx * 0.1, TH.y + 0.02, TH.z + 0.02);
        h.box('metal', 0.022, 0.36, 0.022, TH.x + sx * 0.108, TH.y - 0.17, TH.z + 0.02);
        h.cylY('pad', 0.026, 0.14, TH.x + sx * 0.108, TH.y - 0.06, TH.z + 0.02);
        h.ring('accent', 0.028, 0.005, TH.x + sx * 0.108, TH.y - 0.125, TH.z + 0.02);
        pb.bone(shin);
        h.cylX('metal', 0.036, 0.03, SH.x + sx * 0.105, SH.y, SH.z - 0.01);
        h.cylX('accent', 0.012, 0.034, SH.x + sx * 0.105, SH.y, SH.z - 0.01);
        h.box('metal', 0.02, 0.3, 0.02, SH.x + sx * 0.1, SH.y - 0.17, SH.z);
        h.rb('metal', 0.09, 0.07, 0.06, 0.015, SH.x, SH.y - 0.39, SH.z + 0.1);
        h.box('accent', 0.06, 0.008, 0.006, SH.x, SH.y - 0.39, SH.z + 0.132);
        h.box('metal', 0.17, 0.014, 0.34, SH.x, SH.y - 0.455, SH.z - 0.06);
      }
      pb.bone(TORSO);
      energyCell(h);
      break;
    }
    case 'breach': {
      pb.bone(TORSO);
      // Heavy upper plate, extended shoulder plates, three charges on the cummerbund, forearm blast shield.
      h.rb('armor', 0.34, 0.18, 0.045, 0.03, T.x, T.y + 0.4, T.z - 0.2);
      for (const sx of [-1, 1]) h.rb('armor', 0.17, 0.05, 0.25, 0.02, T.x + sx * 0.31, T.y + 0.575, T.z, 0, 0, -sx * 0.35);
      h.box('nylon', 0.22, 0.02, 0.06, T.x, T.y + 0.06, T.z - 0.235);
      for (let i = -1; i <= 1; i++) {
        h.cylY('metal', 0.02, 0.09, T.x + i * 0.065, T.y + 0.06, T.z - 0.25);
        h.sph('warn', 0.009, T.x + i * 0.065, T.y + 0.112, T.z - 0.25);
      }
      const f = forearm(ARM_L);
      const a = ARM_L.elbow.clone().addScaledVector(f.dir, 0.1).addScaledVector(f.up, 0.06);
      const b = ARM_L.wrist.clone().addScaledVector(f.dir, -0.02).addScaledVector(f.up, 0.06);
      pb.between(UNIT_RBOX, 'armor', a, b, 0.09);
      pb.between(PRIM.box, 'accent', a.clone().addScaledVector(f.up, 0.046), b.clone().addScaledVector(f.up, 0.046), 0.012);
      pb.bone(HIPS);
      h.rb('nylon', 0.16, 0.19, 0.11, 0.03, HP.x + 0.21, HP.y - 0.05, HP.z + 0.13);
      h.box('nylon', 0.162, 0.04, 0.112, HP.x + 0.21, HP.y + 0.05, HP.z + 0.13);
      h.sph('warn', 0.007, HP.x + 0.21, HP.y - 0.02, HP.z + 0.19);
      break;
    }
    case 'grapple': {
      pb.bone(TORSO);
      // Hookshot on the left forearm: housing, spool, three claws; rope coil slung across the torso; rope bag.
      const f = forearm(ARM_L);
      const a = ARM_L.elbow.clone().addScaledVector(f.dir, 0.09).addScaledVector(f.up, 0.07);
      const b = ARM_L.wrist.clone().addScaledVector(f.dir, -0.01).addScaledVector(f.up, 0.07);
      pb.between(UNIT_RBOX, 'metal', a, b, 0.075);
      pb.between(PRIM.box, 'accent', a.clone().addScaledVector(f.up, 0.038), b.clone().addScaledVector(f.up, 0.038), 0.012);
      const mid = a.clone().lerp(b, 0.45);
      pb.between(PRIM.cyl12, 'pad', mid.clone().addScaledVector(f.side, -0.075), mid.clone().addScaledVector(f.side, -0.035), 0.09);
      const tip = b.clone().addScaledVector(f.dir, 0.03);
      for (const off of [f.up.clone().multiplyScalar(0.045), f.side.clone().multiplyScalar(0.045), f.side.clone().multiplyScalar(-0.045)]) {
        pb.between(PRIM.box, 'metal', tip, tip.clone().addScaledVector(f.dir, 0.065).add(off), 0.012);
      }
      const coil = new THREE.TorusGeometry(0.235, 0.018, 6, 26);
      const m = new THREE.Matrix4().makeRotationZ(0.6).multiply(new THREE.Matrix4().makeRotationX(HALF_PI)).scale(new THREE.Vector3(1, 0.72, 1));
      m.setPosition(T.x + 0.01, T.y + 0.3, T.z);
      pb.partM(coil, 'nylon', m);
      coil.dispose();
      h.rb('nylon', 0.14, 0.1, 0.09, 0.03, T.x, T.y + 0.5, T.z + 0.3);
      pb.bone(HIPS);
      harness(h);
      break;
    }
    case 'burrow': {
      pb.bone(TORSO);
      // Drill gauntlet on the right forearm: housing, ridged cone bit; shovel on the pack.
      const f = forearm(ARM_R);
      const a = ARM_R.elbow.clone().addScaledVector(f.dir, 0.08).addScaledVector(f.up, 0.065);
      const b = ARM_R.wrist.clone().addScaledVector(f.up, 0.065);
      pb.between(UNIT_RBOX, 'metal', a, b, 0.08);
      pb.between(PRIM.box, 'accent', a.clone().addScaledVector(f.up, 0.04), b.clone().addScaledVector(f.up, 0.04), 0.012);
      const c0 = b.clone().addScaledVector(f.dir, 0.02);
      const c1 = c0.clone().addScaledVector(f.dir, 0.24);
      pb.between(PRIM.cone, 'metal', c0, c1, 0.1);
      for (const [t, R] of [[0.03, 0.043], [0.09, 0.033], [0.15, 0.022]] as [number, number][]) torusAlong(pb, 'pad', R, 0.006, c0.clone().addScaledVector(f.dir, t), f.dir);
      h.rb('metal', 0.15, 0.2, 0.012, 0.02, T.x - 0.1, T.y + 0.47, T.z + 0.365, 0, 0, 0.3);
      pb.between(PRIM.cyl8, 'pad', h.v(T.x - 0.07, T.y + 0.37, T.z + 0.365), h.v(T.x + 0.02, T.y + 0.05, T.z + 0.365), 0.03);
      for (const [, shin, , SH] of legs()) {
        pb.bone(shin);
        h.rb('armor', 0.11, 0.24, 0.06, 0.025, SH.x, SH.y - 0.2, SH.z - 0.085);
        h.box('accent', 0.06, 0.006, 0.006, SH.x, SH.y - 0.12, SH.z - 0.117);
      }
      pb.bone(HIPS);
      h.rb('nylon', 0.08, 0.09, 0.06, 0.015, HP.x - 0.21, HP.y - 0.05, HP.z - 0.03);
      break;
    }
  }
}

function secondaryGear(pb: PartBuilder<MatKey>, h: H, id: GadgetId): void {
  switch (id) {
    case 'zipline':
      pb.bone(HIPS);
      hipCoil(h);
      break;
    case 'jumppad':
      pb.bone(TORSO);
      energyCell(h);
      break;
    case 'breach':
      pb.bone(HIPS);
      h.cylY('metal', 0.02, 0.09, HP.x - 0.2, HP.y - 0.02, HP.z - 0.06);
      h.sph('warn', 0.008, HP.x - 0.2, HP.y + 0.03, HP.z - 0.06);
      break;
    case 'grapple':
      pb.bone(HIPS);
      harness(h);
      break;
    case 'burrow':
      pb.bone(HIPS);
      pb.part(PRIM.cone, 'metal', HP.x + 0.2, HP.y - 0.1, HP.z + 0.04, Math.PI, 0, 0, 0.045, 0.12, 0.045);
      h.cylY('pad', 0.026, 0.03, HP.x + 0.2, HP.y - 0.03, HP.z + 0.04);
      break;
  }
}

function hipCoil(h: H): void {
  h.ring('metal', 0.07, 0.012, HP.x - 0.215, HP.y - 0.02, HP.z + 0.03, 1, 0, HALF_PI, 0);
  h.box('nylon', 0.02, 0.06, 0.03, HP.x - 0.215, HP.y + 0.05, HP.z + 0.03);
}

function energyCell(h: H): void {
  h.cylZ('metal', 0.075, 0.05, T.x, T.y + 0.24, T.z + 0.36);
  h.ring('accent', 0.05, 0.006, T.x, T.y + 0.24, T.z + 0.386, 1, 0, 0, 0);
}

function harness(h: H): void {
  for (const sx of [-1, 1]) h.ring('nylon', 0.035, 0.008, HP.x + sx * 0.16, HP.y - 0.09, HP.z - 0.1, 1, 0, 0, 0);
  h.box('metal', 0.01, 0.05, 0.01, HP.x + 0.16, HP.y - 0.145, HP.z - 0.1);
  h.box('metal', 0.01, 0.025, 0.01, HP.x + 0.166, HP.y - 0.172, HP.z - 0.1, 0, 0, -0.9);
}

function flair(pb: PartBuilder<MatKey>, h: H, kind: number): void {
  pb.bone(TORSO);
  if (kind === 1) {
    // Accent arm band on the right upper arm.
    const a = ARM_R.shoulder.clone().lerp(ARM_R.elbow, 0.45);
    const b = ARM_R.shoulder.clone().lerp(ARM_R.elbow, 0.58);
    pb.between(PRIM.cyl12, 'accent', a, b, 0.148);
  } else if (kind === 2) {
    // Scarf around the neck.
    h.ring('fabric', 0.095, 0.03, T.x, T.y + 0.585, T.z + 0.01, 0.9);
    h.rb('fabric', 0.07, 0.16, 0.03, 0.015, T.x - 0.06, T.y + 0.47, T.z - 0.19, 0.15, 0, 0.2);
  }
}

function legs(): [number, number, THREE.Vector3, THREE.Vector3, number][] {
  return [
    [THIGH_L, SHIN_L, REST.thighL, REST.shinL, -1],
    [THIGH_R, SHIN_R, REST.thighR, REST.shinR, 1],
  ];
}
