import * as THREE from 'three';
import { fbm, rng, ss, vnoise, type HeadSurface } from './HeadSurface';
import type { HairShading } from './HairMaterial';
import type { LayerStyle, Tier } from './grow';

/*
 * Grooms. Coordinates in the style functions: f = point - eye-centre midpoint (rest pose, metres),
 * character axes +x = his left, +y up, +z forward. Colours are sRGB triplets (converted to linear).
 */

export interface GroomStyle {
  name: string;
  layers: LayerStyle[];
  /** control points per strand / rendered segments per strand, per tier */
  ctrl: Record<Tier, number>;
  segs: Record<Tier, number>;
  shading: HairShading;
  /** cap colour (sRGB) and max offset from the skin (m) */
  capColor: [number, number, number];
  capOffset: number;
  /** cap over the beard region: 0 = none, else max beard-cap density (0..1) */
  capBeard: number;
  /** strand width scale per tier (fewer strands -> thicker) */
  widthTier: Record<Tier, number>;
  /** default headband (for kind: 'man' with headband: true) */
  headband?: boolean;
}

const lin = (c: [number, number, number], out: THREE.Color) => out.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
const _c = new THREE.Color();

/** vary a colour per strand: brightness (log-normal-ish), slight warm/cool shift */
function vary(out: THREE.Color, R: () => number, amount: number, warm = 0) {
  const b = Math.exp((R() - 0.5) * 2 * amount);
  const h = (R() - 0.5) * 0.08 + warm;
  out.r *= b * (1 + h);
  out.g *= b;
  out.b *= b * (1 - h * 1.5);
  return out;
}

const dir = (out: THREE.Vector3, x: number, y: number, z: number) => out.set(x, y, z);

// ================================================================================================= DAVID
/** David (~20): thick, voluminous, tousled loose spiral ringlets, auburn / copper with sun-lightened tips. */
export function davidStyle(): GroomStyle {
  const ROOT: [number, number, number] = [0.12, 0.058, 0.034];
  const MID: [number, number, number] = [0.29, 0.135, 0.068];
  const TIP: [number, number, number] = [0.53, 0.3, 0.15];
  const scalp: LayerStyle = {
    name: 'david-scalp',
    kind: 0,
    mask: (s) => s.scalpMask(0, (phi) => -0.009 * Math.exp(-(((phi - 58) / 16) ** 2))),
    strands: { low: 3800, medium: 11000, high: 24000 },
    locks: 230,
    sim: { low: 16, medium: 32, high: 48 },
    length: (f, n, R) => {
      // top / crown longest, forelock tumbling onto the forehead, nape to the neck
      const top = ss(0.03, 0.1, f.y);
      const front = ss(-0.02, 0.06, f.z);
      const back = ss(0.0, -0.08, f.z) * ss(0.05, -0.04, f.y);
      const side = ss(0.05, 0.075, Math.abs(f.x)) * ss(0.06, 0.0, f.y);
      return (0.078 + 0.014 * top + 0.022 * front + 0.006 * back - 0.02 * side) * (0.82 + 0.36 * R());
    },
    comb: (f, n, out) => {
      // whorl at the top-back; hair flows out from it, forward over the forehead, down the sides / back
      dir(out, f.x, f.y - 0.1, f.z + 0.055);
      out.normalize();
      out.z += 0.35 * ss(0.04, 0.09, f.y) * ss(-0.06, 0.02, f.z);
      out.y -= 0.5 * (1 - ss(0.02, 0.09, f.y));
      out.x += 0.25 * vnoise(f.x * 30, f.y * 30, f.z * 30, 3);
      out.z += 0.25 * vnoise(f.x * 30, f.y * 30, f.z * 30, 4);
      return out;
    },
    lift: 0.34,
    gravity: 20,
    combPull: 10,
    tousle: 12,
    volume: (t, R) => 0.003 + (0.55 * R + 0.004) * ss(0, 0.35, t),
    curlR: [0.008, 0.0145],
    curlPitch: [0.034, 0.06],
    curlStart: 0.3,
    curlNoise: 0.9,
    straightLocks: 0.12,
    lockR: 0.0062,
    clump: 0.72,
    frizz: 0.0026,
    flyaway: 0.04,
    width: 0.00014,
    stiffness: 0.3,
    childLen: [0.78, 1.0],
    colors: (R, f, root, tip) => {
      lin(ROOT, root);
      vary(root, R, 0.25);
      // tips: sun-lightened on the top and front, more chestnut underneath / at the nape
      const sun = ss(-0.02, 0.08, f.y) * 0.7 + 0.3 * ss(-0.05, 0.05, f.z);
      lin(MID, tip).lerp(lin(TIP, _c), 0.35 + 0.55 * sun + 0.2 * (R() - 0.5));
      const r = R();
      if (r < 0.1) tip.lerp(lin([0.86, 0.58, 0.3], _c), 0.5); // bleached strands
      else if (r < 0.18) tip.multiplyScalar(0.55); // darker strands
      vary(tip, R, 0.22, 0.02);
      root.lerp(tip, 0.18);
    },
  };
  return {
    name: 'david',
    layers: [scalp],
    ctrl: { low: 9, medium: 12, high: 16 },
    segs: { low: 12, medium: 20, high: 30 },
    shading: { shift: 0.035, roughness: 0.42, specular: 0.5, backlit: 0.75, scatter: 0.25, aoDirect: 0.6 },
    capColor: [0.1, 0.05, 0.03],
    capOffset: 0.006,
    capBeard: 0,
    widthTier: { low: 2.8, medium: 1.5, high: 1 },
  };
}

// ================================================================================================= SAUL
/** King Saul (~48): thick dark brown-black shoulder-length hair combed back, grey threads; full beard, grey at the chin. */
export function saulStyle(): GroomStyle {
  const DARK: [number, number, number] = [0.075, 0.056, 0.045];
  const TIPD: [number, number, number] = [0.13, 0.095, 0.072];
  const GREY: [number, number, number] = [0.56, 0.54, 0.51];
  const scalp: LayerStyle = {
    name: 'saul-scalp',
    kind: 0,
    reach: 0.42,
    mask: (s) => s.scalpMask(),
    strands: { low: 3500, medium: 10000, high: 24000 },
    locks: 170,
    sim: { low: 16, medium: 28, high: 40 },
    length: (f, n, R) => {
      const back = ss(0.02, -0.08, f.z);
      return (0.2 + 0.08 * back + 0.02 * ss(0.03, 0.1, f.y)) * (0.85 + 0.3 * R());
    },
    comb: (f, n, out) => {
      // gathered back: backward over the top, down behind the ears
      dir(out, f.x * 0.25, -0.35, -1);
      out.y -= 0.8 * ss(-0.02, -0.08, f.z);
      return out;
    },
    lift: 0.08,
    gravity: 9,
    combPull: 14,
    tousle: 2,
    volume: (t, R) => 0.003 + (R + 0.004) * ss(0, 0.25, t) + 0.006 * ss(0.3, 1, t),
    curlR: [0.0025, 0.0055],
    curlPitch: [0.08, 0.12],
    curlStart: 0.35,
    curlNoise: 0.3,
    lockR: 0.009,
    clump: 0.45,
    frizz: 0.0008,
    flyaway: 0.003,
    width: 0.00011,
    stiffness: 0.22,
    childLen: [0.8, 1.0],
    colors: (R, f, root, tip) => {
      // grey threads: temples most, then scattered
      const temple = ss(0.045, 0.07, Math.abs(f.x)) * ss(0.08, 0.02, f.y);
      if (R() < 0.05 + 0.2 * temple) {
        lin(GREY, root);
        vary(root, R, 0.2);
        tip.copy(root).multiplyScalar(1.08);
        return;
      }
      lin(DARK, root);
      vary(root, R, 0.28);
      lin(TIPD, tip);
      vary(tip, R, 0.25, 0.02);
    },
  };
  const beard: LayerStyle = {
    name: 'saul-beard',
    kind: 1,
    reach: 0.3,
    mask: (s) => s.beardMask(),
    strands: { low: 1500, medium: 4500, high: 10000 },
    locks: 220,
    sim: { low: 6, medium: 10, high: 16 },
    length: (f, n, R) => {
      const ax = Math.abs(f.x);
      const must = ss(0.03, 0.02, ax) * ss(-0.075, -0.06, f.y) * ss(0.0, 0.3, n.z);
      const chin = ss(-0.04, -0.11, f.y) * ss(0.075, 0.02, ax);
      const L = 0.03 + 0.055 * chin + 0.012 * ss(0.06, 0.03, ax);
      return (must > 0.5 ? 0.028 : L) * (0.88 + 0.24 * R());
    },
    comb: (f, n, out) => {
      const ax = Math.abs(f.x);
      const must = ss(0.03, 0.02, ax) * ss(-0.075, -0.06, f.y);
      dir(out, Math.sign(f.x) * (0.15 + 0.9 * must), -1, 0.4 - 0.25 * must);
      return out;
    },
    lift: 0.35,
    gravity: 12,
    combPull: 9,
    tousle: 5,
    volume: (t, R) => 0.002 + (R + 0.003) * ss(0, 0.3, t) + 0.006 * ss(0.2, 0.8, t),
    curlR: [0.002, 0.0045],
    curlPitch: [0.02, 0.035],
    curlStart: 0.2,
    curlNoise: 0.6,
    lockR: 0.005,
    clump: 0.45,
    frizz: 0.0006,
    flyaway: 0.004,
    width: 0.00022,
    stiffness: 0.45,
    childLen: [0.75, 1.0],
    colors: (R, f, root, tip) => {
      // grey at the chin (below the mouth, centre), scattered elsewhere
      const chin = ss(-0.07, -0.1, f.y) * ss(0.035, 0.012, Math.abs(f.x));
      if (R() < 0.05 + 0.3 * chin) {
        lin(GREY, root);
        vary(root, R, 0.2);
        tip.copy(root).multiplyScalar(1.1);
        return;
      }
      lin(DARK, root);
      vary(root, R, 0.25);
      lin(TIPD, tip);
      vary(tip, R, 0.25, 0.03);
    },
  };
  return {
    name: 'saul',
    layers: [scalp, beard],
    ctrl: { low: 10, medium: 14, high: 20 },
    segs: { low: 14, medium: 24, high: 36 },
    shading: { shift: 0.035, roughness: 0.38, specular: 0.6, backlit: 0.8, scatter: 0.55, aoDirect: 0.55 },
    capColor: [0.075, 0.058, 0.048],
    capOffset: 0.004,
    capBeard: 0.7,
    widthTier: { low: 2.8, medium: 1.5, high: 1 },
  };
}

// ================================================================================================= ORDINARY MEN
export interface ManStyleOptions {
  seed: number;
  beard?: 'none' | 'short' | 'full';
  headband?: boolean;
}

/** Ordinary Israelite men: short-to-medium curly / wavy black or dark-brown hair, beards of varying fullness. */
export function manStyle(o: ManStyleOptions): GroomStyle {
  const R = rng(o.seed * 7717 + 3);
  const beardKind = o.beard ?? (R() < 0.12 ? 'short' : R() < 0.55 ? 'short' : 'full');
  const curly = R() < 0.7;
  const long = R() < 0.35;
  const age = R();
  const hueR = R();
  const base: [number, number, number] = hueR < 0.5 ? [0.05, 0.04, 0.035] : hueR < 0.85 ? [0.085, 0.06, 0.045] : [0.13, 0.085, 0.055];
  const tipB: [number, number, number] = [base[0] * 1.6, base[1] * 1.55, base[2] * 1.45];
  const greyP = age > 0.7 ? (age - 0.7) * 1.2 : 0;
  const GREY: [number, number, number] = [0.52, 0.5, 0.47];
  const col = (greyBoost: (f: THREE.Vector3) => number) => (Rr: () => number, f: THREE.Vector3, root: THREE.Color, tip: THREE.Color) => {
    if (Rr() < greyP * (0.5 + greyBoost(f))) {
      lin(GREY, root);
      vary(root, Rr, 0.2);
      tip.copy(root);
      return;
    }
    lin(base, root);
    vary(root, Rr, 0.28);
    lin(tipB, tip);
    vary(tip, Rr, 0.25, 0.02);
  };
  const Lh = long ? 0.1 + 0.04 * R() : curly ? 0.045 + 0.02 * R() : 0.06 + 0.03 * R();
  const cR: [number, number] = curly ? [0.004, 0.0075] : [0.003, 0.006];
  const cP: [number, number] = curly ? [0.012, 0.02] : [0.05, 0.08];
  const scalp: LayerStyle = {
    name: 'man-scalp',
    kind: 0,
    reach: long ? 0.32 : 0.22,
    mask: (s) => s.scalpMask(age > 0.75 ? 0.006 * (age - 0.75) * 4 : 0),
    strands: { low: 2500, medium: 7000, high: 15000 },
    locks: curly ? 260 : 170,
    sim: { low: 8, medium: 16, high: 24 },
    length: (f, n, Rr) => {
      const back = ss(0.02, -0.08, f.z);
      return Lh * (1 + (long ? 0.35 : 0.1) * back) * (0.8 + 0.4 * Rr());
    },
    comb: (f, n, out) => {
      dir(out, f.x, f.y - 0.1, f.z + 0.03);
      out.normalize();
      out.y -= 0.4 * (1 - ss(0.02, 0.09, f.y));
      out.z += 0.2 * ss(0.04, 0.09, f.y);
      return out;
    },
    lift: curly ? (long ? 0.18 : 0.42) : 0.08,
    gravity: long ? 12 : 8,
    combPull: curly ? 8 : 14,
    tousle: curly ? 12 : 3,
    volume: (t, Rv) => 0.002 + (Rv + 0.003) * ss(0, 0.35, t),
    curlR: cR,
    curlPitch: cP,
    curlStart: 0.25,
    lockR: 0.0035,
    clump: curly ? 0.8 : 0.6,
    frizz: curly ? 0.0016 : 0.0009,
    flyaway: curly ? 0.02 : 0.006,
    width: 0.00011,
    stiffness: 0.35,
    childLen: [0.75, 1.0],
    colors: col((f) => ss(0.045, 0.07, Math.abs(f.x))),
  };
  const layers: LayerStyle[] = [scalp];
  if (beardKind !== 'none') {
    const full = beardKind === 'full';
    const Lb = full ? 0.04 + 0.03 * R() : 0.011 + 0.007 * R();
    layers.push({
      name: 'man-beard',
      kind: 1,
      mask: (s) => s.beardMask(),
      strands: full ? { low: 1400, medium: 4000, high: 9000 } : { low: 1600, medium: 4500, high: 10000 },
      locks: full ? 170 : 220,
      sim: full ? { low: 4, medium: 8, high: 12 } : { low: 0, medium: 0, high: 0 },
      length: (f, n, Rr) => {
        const ax = Math.abs(f.x);
        const chin = ss(-0.04, -0.11, f.y) * ss(0.075, 0.02, ax);
        return Lb * (0.6 + 0.4 * ss(0.07, 0.03, ax) + (full ? 0.8 * chin : 0.2 * chin)) * (0.8 + 0.4 * Rr());
      },
      comb: (f, n, out) => {
        const ax = Math.abs(f.x);
        const must = ss(0.03, 0.02, ax) * ss(-0.075, -0.06, f.y);
        dir(out, Math.sign(f.x) * (0.15 + 0.9 * must), -1, 0.35 - 0.2 * must);
        return out;
      },
      lift: full ? 0.3 : 0.15,
      gravity: full ? 10 : 3,
      combPull: 12,
      tousle: 4,
      volume: (t, Rv) => 0.001 + (Rv + 0.0015) * ss(0, 0.3, t) + (full ? 0.005 * ss(0.2, 0.8, t) : 0),
      curlR: full ? [0.002, 0.0045] : [0.0008, 0.0016],
      curlPitch: full ? [0.016, 0.028] : [0.007, 0.011],
      curlStart: 0.2,
      lockR: 0.003,
      clump: full ? 0.55 : 0.4,
      frizz: 0.0006,
      flyaway: 0.005,
      width: 0.0002,
      stiffness: 0.5,
      childLen: [0.7, 1.0],
      colors: col((f) => ss(-0.07, -0.1, f.y) * 1.5),
    });
  }
  return {
    name: `man-${o.seed}`,
    layers,
    ctrl: { low: 8, medium: 11, high: 14 },
    segs: { low: 10, medium: 16, high: 24 },
    shading: { shift: 0.035, roughness: 0.4, specular: 0.55, backlit: 0.7, scatter: 0.5, aoDirect: 0.55 },
    capColor: [base[0] * 0.9, base[1] * 0.9, base[2] * 0.9],
    capOffset: 0.004,
    capBeard: beardKind === 'full' ? 0.7 : beardKind === 'short' ? 0.55 : 0,
    widthTier: { low: 2.8, medium: 1.5, high: 1 },
    headband: !!o.headband,
  };
}

/** per-vertex cap tint noise helper */
export function capNoise(x: number, y: number, z: number) {
  return 0.8 + 0.2 * fbm(x * 60, y * 60, z * 60, 2, 91);
}

export type { HeadSurface };
