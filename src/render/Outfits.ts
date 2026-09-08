import * as THREE from 'three';
import { PartBuilder, PRIM, rbox, lathe } from './PartBuilder';
import { type MatKey, HIPS, TORSO, HEAD, THIGH_L, SHIN_L, THIGH_R, SHIN_R, REST, ARM_L, ARM_R, HALF_PI, partHelpers } from './CharacterRig';
import type { GadgetId } from '../sim/Gadgets';

/**
 * Outfits of the siege era: a helmet, the dye of the gambeson, the kit's gear and a heraldic device
 * on the tabard, layered over the shared soldier body. The first kit slot drives the silhouette
 * (helmet, big gear), the second adds a belt item, the team picks the device and a seed varies the
 * dye, the skin and a small flair so no two soldiers look alike.
 */
export type HelmetKind = 'kettle' | 'bascinet' | 'greathelm' | 'sallet' | 'morion' | 'hood';
export type ClothKind = 'linen' | 'russet' | 'wool' | 'forest' | 'ochre' | 'night';

export interface Outfit {
  helmet: HelmetKind;
  cloth: ClothKind;
  kit: GadgetId[];
  /** 0 none, 1 arm band, 2 cloak (or a plume when the back carries gear). */
  flair: number;
  /** Heraldic device on the chest: 0 chevron, 1 cross, 2 saltire, 3 pale with roundels. */
  device: number;
  /** Index into SKIN_TONES. */
  skin: number;
}

/** Two tones of each dye (light, dark) for the quilted cloth. */
export const CLOTHS: Record<ClothKind, [[number, number, number], [number, number, number]]> = {
  linen: [[0.78, 0.72, 0.6], [0.6, 0.54, 0.42]],
  russet: [[0.5, 0.24, 0.14], [0.34, 0.15, 0.09]],
  wool: [[0.42, 0.42, 0.44], [0.26, 0.26, 0.28]],
  forest: [[0.24, 0.36, 0.2], [0.14, 0.22, 0.12]],
  ochre: [[0.62, 0.48, 0.24], [0.44, 0.32, 0.15]],
  night: [[0.14, 0.15, 0.22], [0.08, 0.09, 0.14]],
};

export const SKIN_TONES = [0xe6c3a5, 0xd4a27c, 0xa87752, 0x6b4a33];

const HELMET_FOR: Record<GadgetId, HelmetKind> = { zipline: 'kettle', jumppad: 'sallet', breach: 'greathelm', grapple: 'bascinet', burrow: 'morion' };
const CLOTH_FOR: Record<GadgetId, ClothKind[]> = {
  zipline: ['linen', 'wool'],
  jumppad: ['forest', 'russet'],
  breach: ['night', 'wool'],
  grapple: ['russet', 'ochre'],
  burrow: ['ochre', 'linen'],
};

export function outfitFor(kit: GadgetId[], seed: number, team = -1): Outfit {
  const primary = kit[0] ?? 'zipline';
  const s = Math.abs(Math.floor(seed));
  let helmet = HELMET_FOR[primary];
  if ((primary === 'zipline' || primary === 'grapple') && s % 3 === 0) helmet = 'hood'; // some scouts go hooded
  return { helmet, cloth: CLOTH_FOR[primary][s % 2], kit: kit.slice(0, 2), flair: (s >> 1) % 3, device: team >= 0 ? team : s % 4, skin: (s >> 2) % SKIN_TONES.length };
}

/** Geometry cache key (dye and skin only change materials). */
export function outfitKey(o: Outfit): string {
  return `${o.helmet}|${o.kit.join('+')}|${o.flair}|${o.device}`;
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
  pb.bone(TORSO);
  device(h, o.device);
  if (o.kit[0]) primaryGear(pb, h, o.kit[0]);
  if (o.kit[1]) secondaryGear(pb, h, o.kit[1]);
  flair(pb, h, o);
  geos = pb.merge();
  gearCache.set(key, geos);
  return geos;
}

type H = ReturnType<typeof partHelpers>;
const D = REST.head;
const T = REST.torso;
const HP = REST.hips;

/** Sphere band around the head centre (phi around Y from +X through +Z; the face at -Z is 1.5π). */
function band(pb: PartBuilder<MatKey>, key: MatKey, r: number, phi0: number, phiLen: number, th0: number, thLen: number, zScale = 1.04, yOff = 0.125, segs = 20): void {
  const g = new THREE.SphereGeometry(r, segs, 8, Math.PI * phi0, Math.PI * phiLen, Math.PI * th0, Math.PI * thLen);
  pb.part(g, key, D.x, D.y + yOff, D.z + 0.005, 0, 0, 0, 1, 1, zScale);
  g.dispose();
}

function skull(pb: PartBuilder<MatKey>, profile: Array<[number, number]>, y: number, z: number, zScale: number): void {
  const g = lathe(profile, 22);
  pb.part(g, 'steel', D.x, y, z, 0, 0, 0, 1, 1, zScale);
  g.dispose();
}

function headGear(pb: PartBuilder<MatKey>, h: H, kind: HelmetKind): void {
  switch (kind) {
    case 'kettle': {
      // Wide-brimmed iron hat over the coif, a leather liner band and a chin strap.
      band(pb, 'steel', 0.121, 0, 2, 0, 0.5, 1.06, 0.135);
      const brim = lathe([[0.1, 0.0], [0.165, -0.035], [0.17, -0.02], [0.105, 0.012]], 22);
      pb.part(brim, 'steel', D.x, D.y + 0.145, D.z + 0.005, 0, 0, 0, 1, 1, 1.06);
      brim.dispose();
      h.ring('iron', 0.121, 0.006, D.x, D.y + 0.15, D.z + 0.005, 1.06);
      h.ring('leather', 0.1, 0.007, D.x, D.y + 0.07, D.z, 1, 0, 0, 0);
      break;
    }
    case 'bascinet': {
      // Pointed skull, mail aventail down to the shoulders, a pivoting visor with eye slits and breaths.
      skull(pb, [[0, 0.2], [0.05, 0.195], [0.09, 0.17], [0.113, 0.13], [0.122, 0.08], [0.124, 0.02], [0.122, -0.02]], D.y + 0.125, D.z + 0.005, 1.08);
      band(pb, 'mail', 0.128, 1.78, 1.44, 0.4, 0.42, 1.06, 0.1);
      h.rb('steel', 0.17, 0.1, 0.06, 0.03, D.x, D.y + 0.15, D.z - 0.095);
      for (const sx of [-1, 1]) {
        h.box('iron', 0.05, 0.008, 0.02, D.x + sx * 0.04, D.y + 0.158, D.z - 0.125);
        h.sph('iron', 0.012, D.x + sx * 0.12, D.y + 0.16, D.z - 0.01);
      }
      for (let i = 0; i < 4; i++) h.box('iron', 0.008, 0.008, 0.02, D.x - 0.03 + i * 0.02, D.y + 0.12, D.z - 0.127);
      break;
    }
    case 'greathelm': {
      // Flat-topped barrel helm with a reinforcing cross over the face, eye slits and breaths.
      h.cylY('steel', 0.125, 0.3, D.x, D.y + 0.13, D.z + 0.005, 0.118);
      h.cylY('steel', 0.12, 0.02, D.x, D.y + 0.285, D.z + 0.005);
      h.box('iron', 0.03, 0.2, 0.012, D.x, D.y + 0.13, D.z - 0.126);
      h.box('iron', 0.2, 0.025, 0.012, D.x, D.y + 0.165, D.z - 0.126);
      for (const sx of [-1, 1]) {
        h.box('iron', 0.06, 0.01, 0.012, D.x + sx * 0.055, D.y + 0.185, D.z - 0.126);
        for (let i = 0; i < 3; i++) h.box('iron', 0.008, 0.008, 0.012, D.x + sx * 0.05, D.y + 0.06 + i * 0.022, D.z - 0.127);
      }
      h.ring('iron', 0.124, 0.005, D.x, D.y + 0.27, D.z + 0.005, 1);
      break;
    }
    case 'sallet': {
      // Swept skull with a long tail, one eye slit, a bevor guarding the chin.
      skull(pb, [[0, 0.17], [0.07, 0.165], [0.11, 0.13], [0.126, 0.07], [0.13, 0.0], [0.122, -0.03]], D.y + 0.125, D.z + 0.03, 1.3);
      h.box('iron', 0.2, 0.012, 0.02, D.x, D.y + 0.16, D.z - 0.12);
      h.rb('steel', 0.17, 0.09, 0.07, 0.03, D.x, D.y + 0.05, D.z - 0.075);
      h.rb('steel', 0.02, 0.02, 0.26, 0.008, D.x, D.y + 0.29, D.z + 0.02);
      break;
    }
    case 'morion': {
      // Comb morion of the arquebusiers: high crest, curved brim.
      skull(pb, [[0, 0.2], [0.06, 0.19], [0.1, 0.15], [0.115, 0.1], [0.118, 0.03], [0.116, 0.0]], D.y + 0.12, D.z + 0.005, 1.08);
      h.rb('steel', 0.024, 0.1, 0.22, 0.01, D.x, D.y + 0.34, D.z + 0.005);
      h.sph('steel', 0.16, D.x, D.y + 0.13, D.z + 0.005, 1, 0.07, 1.45);
      h.ring('iron', 0.117, 0.006, D.x, D.y + 0.125, D.z + 0.005, 1.08);
      h.ring('leather', 0.1, 0.007, D.x, D.y + 0.07, D.z, 1, 0, 0, 0);
      break;
    }
    case 'hood': {
      // Archer's cloth hood over the coif, with a short mantle over the shoulders.
      const hood = new THREE.SphereGeometry(0.13, 22, 12, Math.PI * 1.86, Math.PI * 1.28, 0, Math.PI * 0.62);
      pb.part(hood, 'cloth', D.x, D.y + 0.12, D.z + 0.012, 0, 0, 0, 1, 1.1, 1.14);
      hood.dispose();
      const brim = new THREE.SphereGeometry(0.137, 20, 4, Math.PI * 1.15, Math.PI * 0.7, Math.PI * 0.2, Math.PI * 0.1);
      pb.part(brim, 'cloth', D.x, D.y + 0.12, D.z + 0.012, 0, 0, 0, 1, 1.1, 1.14);
      brim.dispose();
      const mantle = lathe([[0.1, 0.0], [0.2, -0.14], [0.23, -0.2], [0.21, -0.21], [0.11, -0.06]], 20);
      pb.part(mantle, 'cloth', D.x, D.y + 0.02, D.z, 0, 0, 0, 1, 1, 0.8);
      mantle.dispose();
      break;
    }
  }
}

/** The team's heraldic device on the chest of the tabard, in cream cloth. */
function device(h: H, kind: number): void {
  const z = T.z - 0.216;
  const y = T.y + 0.415;
  switch (kind % 4) {
    case 0: // chevron
      h.box('cream', 0.12, 0.026, 0.006, T.x - 0.045, y - 0.015, z, 0, 0, 0.7);
      h.box('cream', 0.12, 0.026, 0.006, T.x + 0.045, y - 0.015, z, 0, 0, -0.7);
      break;
    case 1: // cross
      h.box('cream', 0.026, 0.13, 0.006, T.x, y, z);
      h.box('cream', 0.16, 0.026, 0.006, T.x, y + 0.015, z);
      break;
    case 2: // saltire
      h.box('cream', 0.17, 0.026, 0.006, T.x, y, z, 0, 0, 0.7);
      h.box('cream', 0.17, 0.026, 0.006, T.x, y, z, 0, 0, -0.7);
      break;
    default: // pale with roundels
      h.box('cream', 0.026, 0.13, 0.006, T.x, y, z);
      for (const sx of [-1, 1]) h.sph('cream', 0.016, T.x + sx * 0.06, y + 0.02, z, 1, 1, 0.3);
  }
}

/** Forearm frame: direction, up and side vectors for mounting gear. */
function forearm(arm: typeof ARM_L) {
  const dir = arm.wrist.clone().sub(arm.elbow).normalize();
  const side = new THREE.Vector3().crossVectors(UP, dir).normalize();
  return { dir, up: UP.clone(), side };
}

/** Rope coil slung across the torso from one shoulder. */
function ropeCoil(pb: PartBuilder<MatKey>, tilt: number): void {
  const coil = new THREE.TorusGeometry(0.235, 0.02, 6, 26);
  const m = new THREE.Matrix4().makeRotationZ(tilt).multiply(new THREE.Matrix4().makeRotationX(HALF_PI)).scale(new THREE.Vector3(1, 0.72, 1));
  m.setPosition(T.x + 0.01, T.y + 0.3, T.z);
  pb.partM(coil, 'cream', m);
  coil.dispose();
}

/** Quiver of bolts on the right hip, leaning back. */
function quiver(pb: PartBuilder<MatKey>, h: H): void {
  pb.part(PRIM.cyl12, 'leather', HP.x + 0.2, HP.y - 0.02, HP.z + 0.1, 0.3, 0, -0.1, 0.09, 0.34, 0.09);
  h.ring('iron', 0.046, 0.006, HP.x + 0.2, HP.y + 0.13, HP.z + 0.055, 1);
  for (const [dx, dz] of [[-0.02, -0.015], [0.02, -0.01], [0, 0.02], [-0.015, 0.025]]) {
    pb.part(PRIM.cyl8, 'wood', HP.x + 0.2 + dx, HP.y + 0.2, HP.z + 0.03 + dz, 0.3, 0, -0.1, 0.012, 0.22, 0.012);
    h.box('cream', 0.02, 0.05, 0.006, HP.x + 0.2 + dx, HP.y + 0.3, HP.z + 0.0 + dz, 0.3, 0, -0.1);
  }
}

/** Three-clawed grapnel hanging from the belt. */
function grapnel(h: H, x: number): void {
  h.cylY('iron', 0.01, 0.1, x, HP.y - 0.02, HP.z - 0.06);
  h.ring('iron', 0.022, 0.005, x, HP.y + 0.04, HP.z - 0.06, 1, 0, 0, 0);
  for (const a of [0, 2.1, 4.2]) h.box('iron', 0.012, 0.09, 0.012, x + Math.sin(a) * 0.03, HP.y - 0.08, HP.z - 0.06 + Math.cos(a) * 0.03, 0.45 * Math.cos(a), 0, -0.45 * Math.sin(a));
}

/** A small powder keg with two iron hoops. */
function keg(h: H, x: number, y: number, z: number): void {
  h.cylY('wood', 0.055, 0.14, x, y, z);
  h.ring('iron', 0.056, 0.006, x, y + 0.05, z, 1);
  h.ring('iron', 0.056, 0.006, x, y - 0.05, z, 1);
}

function primaryGear(pb: PartBuilder<MatKey>, h: H, id: GadgetId): void {
  switch (id) {
    case 'zipline': {
      // Rope line: a rope coil across the chest, the grapnel on the belt, a quiver of bolts.
      ropeCoil(pb, 0.6);
      pb.bone(HIPS);
      grapnel(h, HP.x - 0.2);
      quiver(pb, h);
      break;
    }
    case 'jumppad': {
      // Spring board on the back: a plank with iron bands and coil springs, held by two straps.
      h.rb('wood', 0.3, 0.55, 0.035, 0.01, T.x, T.y + 0.25, T.z + 0.29, 0.1);
      h.box('iron', 0.31, 0.03, 0.04, T.x, T.y + 0.46, T.z + 0.29, 0.1);
      h.box('iron', 0.31, 0.03, 0.04, T.x, T.y + 0.06, T.z + 0.29, 0.1);
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 3; i++) h.ring('iron', 0.045, 0.008, T.x + sx * 0.09, T.y - 0.01 - i * 0.03, T.z + 0.31, 1);
        pb.between(PRIM.box, 'leather', h.v(T.x + sx * 0.12, T.y + 0.56, T.z - 0.19), h.v(T.x + sx * 0.14, T.y + 0.5, T.z + 0.27), 0.04);
      }
      break;
    }
    case 'breach': {
      // Man-at-arms: heavy pauldrons, a gorget, a plackart over the belly; two powder kegs and a slow-match coil on the belt.
      for (const sx of [-1, 1]) h.rb('steel', 0.19, 0.07, 0.26, 0.03, T.x + sx * 0.31, T.y + 0.575, T.z, 0, 0, -sx * 0.35);
      h.ring('steel', 0.1, 0.03, T.x, T.y + 0.56, T.z + 0.01, 0.9);
      h.rb('steel', 0.28, 0.14, 0.05, 0.04, T.x, T.y + 0.14, T.z - 0.175);
      pb.bone(HIPS);
      keg(h, HP.x + 0.19, HP.y - 0.06, HP.z - 0.02);
      keg(h, HP.x - 0.19, HP.y - 0.06, HP.z - 0.02);
      h.ring('cream', 0.035, 0.008, HP.x, HP.y - 0.05, HP.z + 0.15, 1, 0, 0, 0);
      break;
    }
    case 'grapple': {
      // Climber: leather bracer with the hook's claws on the left forearm, rope coil, rope bag on the belt.
      const f = forearm(ARM_L);
      const a = ARM_L.elbow.clone().addScaledVector(f.dir, 0.09).addScaledVector(f.up, 0.065);
      const b = ARM_L.wrist.clone().addScaledVector(f.dir, -0.01).addScaledVector(f.up, 0.065);
      pb.between(UNIT_RBOX, 'leather', a, b, 0.075);
      const tip = b.clone().addScaledVector(f.dir, 0.03);
      for (const off of [f.up.clone().multiplyScalar(0.045), f.side.clone().multiplyScalar(0.045), f.side.clone().multiplyScalar(-0.045)]) {
        pb.between(PRIM.box, 'iron', tip, tip.clone().addScaledVector(f.dir, 0.065).add(off), 0.012);
      }
      ropeCoil(pb, -0.6);
      pb.bone(HIPS);
      h.rb('leather', 0.12, 0.14, 0.09, 0.03, HP.x - 0.2, HP.y - 0.03, HP.z + 0.06);
      break;
    }
    case 'burrow': {
      // Sapper: shovel and pick across the back, a leather apron, steel greaves.
      pb.between(PRIM.cyl8, 'wood', h.v(T.x - 0.16, T.y - 0.05, T.z + 0.3), h.v(T.x + 0.12, T.y + 0.62, T.z + 0.3), 0.03);
      h.rb('iron', 0.16, 0.2, 0.014, 0.01, T.x + 0.15, T.y + 0.7, T.z + 0.3, 0, 0, -0.4);
      pb.between(PRIM.cyl8, 'wood', h.v(T.x + 0.14, T.y - 0.02, T.z + 0.33), h.v(T.x - 0.1, T.y + 0.5, T.z + 0.33), 0.024);
      h.box('iron', 0.2, 0.03, 0.03, T.x - 0.12, T.y + 0.54, T.z + 0.33, 0, 0, 0.5);
      pb.bone(HIPS);
      h.rb('leather', 0.24, 0.26, 0.016, 0.01, HP.x, HP.y - 0.12, HP.z - 0.2, 0.1);
      for (const [, shin, , SH] of legs()) {
        pb.bone(shin);
        h.rb('steel', 0.11, 0.26, 0.06, 0.025, SH.x, SH.y - 0.2, SH.z - 0.085);
      }
      break;
    }
  }
}

function secondaryGear(pb: PartBuilder<MatKey>, h: H, id: GadgetId): void {
  pb.bone(HIPS);
  switch (id) {
    case 'zipline':
      quiver(pb, h);
      break;
    case 'jumppad':
      for (let i = 0; i < 3; i++) h.ring('iron', 0.035, 0.007, HP.x - 0.19, HP.y - 0.02 - i * 0.025, HP.z + 0.06, 1);
      break;
    case 'breach':
      keg(h, HP.x - 0.19, HP.y - 0.06, HP.z + 0.04);
      break;
    case 'grapple':
      grapnel(h, HP.x + 0.2);
      break;
    case 'burrow':
      h.cylY('wood', 0.012, 0.3, HP.x + 0.2, HP.y - 0.1, HP.z + 0.06);
      h.box('iron', 0.12, 0.025, 0.025, HP.x + 0.2, HP.y + 0.05, HP.z + 0.06, 0, 0.4, 0);
      break;
  }
}

function flair(pb: PartBuilder<MatKey>, h: H, o: Outfit): void {
  pb.bone(TORSO);
  if (o.flair === 1) {
    // Team-coloured band on the right upper arm.
    const a = ARM_R.shoulder.clone().lerp(ARM_R.elbow, 0.45);
    const b = ARM_R.shoulder.clone().lerp(ARM_R.elbow, 0.58);
    pb.between(PRIM.cyl12, 'tabard', a, b, 0.15);
  } else if (o.flair === 2) {
    const backGear = o.kit[0] === 'jumppad' || o.kit[0] === 'burrow';
    if (!backGear) {
      // Half cloak in the team colour down the back.
      h.rb('tabard', 0.34, 0.62, 0.02, 0.01, T.x, T.y + 0.2, T.z + 0.21, 0.08);
      h.ring('cream', 0.03, 0.01, T.x + 0.14, T.y + 0.55, T.z - 0.02, 1, 0, 0, 0);
    } else if (o.helmet !== 'hood') {
      // A plume on the helmet instead.
      pb.bone(HEAD);
      h.cylY('tabard', 0.016, 0.2, D.x, D.y + 0.4, D.z + 0.03, 0.004);
      h.sph('tabard', 0.028, D.x, D.y + 0.5, D.z + 0.03, 0.7, 1.4, 0.7);
    }
  }
}

function legs(): [number, number, THREE.Vector3, THREE.Vector3, number][] {
  return [
    [THIGH_L, SHIN_L, REST.thighL, REST.shinL, -1],
    [THIGH_R, SHIN_R, REST.thighR, REST.shinR, 1],
  ];
}
