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
/** David (a youth ~17): thick, voluminous, tousled short-to-medium curls (the reference), copper with sun-lightened tips. */
export function davidStyle(): GroomStyle {
  // ~12 % lighter, sun-lightened copper (wardrobe polish pass, to match the reference in back light;
  // was ROOT 0.15 0.08 0.045, MID 0.37 0.21 0.11, TIP 0.66 0.45 0.24)
  const ROOT: [number, number, number] = [0.17, 0.092, 0.051];
  const MID: [number, number, number] = [0.415, 0.238, 0.124];
  const TIP: [number, number, number] = [0.74, 0.51, 0.27];
  const scalp: LayerStyle = {
    name: 'david-scalp',
    kind: 0,
    mask: (s) => s.scalpMask(0, (phi) => -0.009 * Math.exp(-(((phi - 58) / 16) ** 2))),
    strands: { low: 3600, medium: 10500, high: 22000 },
    locks: 190,
    sim: { low: 16, medium: 32, high: 48 },
    // face pass (the user's order, 30 Sep; visual-bible 3.13): the reference's SHORT-TO-MEDIUM tousled curls — volume on
    // the crown, a few curls onto the forehead (never over the eyes), the tops of the ears covered with the lobes
    // showing, the back ending at the nape. NOT long hair (the v2 values, reach 0.34 / 15-22 cm, were wrong).
    reach: 0.2,
    length: (f, n, R) => {
      // strand length (m); curls compress it: the apparent length is ~50-60 % of this
      const top = ss(0.03, 0.1, f.y);
      const front = ss(-0.02, 0.06, f.z) * ss(0.02, 0.07, f.y);
      // nape roots (low at the back): a little longer so the back reaches the top of the neck, never the collar
      const back = ss(-0.06, -0.12, f.z) * ss(0.04, -0.05, f.y);
      // over / around the ears: shorter, so the curls cover only the top of the ear and the lobe shows
      const side = ss(0.05, 0.075, Math.abs(f.x)) * ss(0.06, -0.01, f.y) * ss(-0.15, -0.07, f.z);
      return (0.086 + 0.026 * top + 0.026 * front - 0.018 * back - 0.03 * side) * (0.86 + 0.28 * R());
    },
    comb: (f, n, out) => {
      // whorl at the top-back; hair flows out from it, forward over the forehead, down the sides / back
      dir(out, f.x, f.y - 0.1, f.z + 0.055);
      out.normalize();
      // the top is tousled up and back (volume on the crown, like the reference), the front lifts before it falls
      out.z -= 0.2 * ss(0.04, 0.09, f.y) * ss(-0.09, -0.02, f.z);
      out.y += 0.3 * ss(-0.06, 0.0, f.z) * ss(0.03, 0.07, f.y);
      // fringe swept across the forehead toward his left (as in the reference)
      out.x += 0.45 * ss(0.03, 0.08, f.y) * ss(-0.03, 0.05, f.z);
      out.y -= 0.5 * (1 - ss(0.02, 0.09, f.y));
      // above / in front of the ears the hair is swept back behind the ear, so the ear lobe shows (the reference)
      out.z -= 0.5 * ss(0.055, 0.075, Math.abs(f.x)) * ss(0.06, 0.0, f.y) * ss(-0.1, -0.03, f.z);
      out.x += 0.3 * vnoise(f.x * 30, f.y * 30, f.z * 30, 3);
      out.z += 0.3 * vnoise(f.x * 30, f.y * 30, f.z * 30, 4);
      return out;
    },
    lift: 0.4,
    gravity: 18,
    combPull: 10,
    tousle: 14,
    volume: (t, R) => 0.003 + (0.5 * R + 0.004) * ss(0, 0.3, t),
    // tousled natural curls (about 1-1.5 turns per lock at this length), defined clumps, a little frizz
    curlR: [0.01, 0.016],
    curlPitch: [0.065, 0.1],
    curlStart: 0.25,
    curlNoise: 0.9,
    straightLocks: 0.08,
    lockR: 0.0082,
    clump: 0.86,
    frizz: 0.0012,
    flyaway: 0.03,
    width: 0.00014,
    stiffness: 0.4,
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
    ctrl: { low: 10, medium: 14, high: 18 },
    segs: { low: 14, medium: 24, high: 36 },
    shading: { shift: 0.035, roughness: 0.42, specular: 0.5, backlit: 0.75, scatter: 0.25, aoDirect: 0.6 },
    capColor: [0.16, 0.085, 0.046],
    capOffset: 0.006,
    capBeard: 0,
    widthTier: { low: 2.8, medium: 1.5, high: 1 },
  };
}

// ================================================================================================= SAUL
/** King Saul (~48): thick dark brown-black shoulder-length hair combed back, grey threads; full beard, grey at the chin. */
export function saulStyle(): GroomStyle {
  const DARK: [number, number, number] = [0.075, 0.056, 0.045];
  // wardrobe polish: a touch lighter at the tips so a dense beard shows strand structure instead of a black mass
  // (was 0.13 0.095 0.072)
  const TIPD: [number, number, number] = [0.155, 0.114, 0.086];
  const GREY: [number, number, number] = [0.56, 0.54, 0.51];
  const scalp: LayerStyle = {
    name: 'saul-scalp',
    kind: 0,
    reach: 0.42,
    mask: (s) => s.scalpMask(),
    // cast pass (opening film): thick, groomed, slightly wavy hair pushed back (visual-bible 3.2) — denser, broader
    // strands in coherent locks, less frizz (was 3500/10000/20000, 170 locks)
    strands: { low: 3800, medium: 15000, high: 26000 },
    locks: 230,
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
    lift: 0.05,
    gravity: 13,
    combPull: 14,
    tousle: 1.2,
    volume: (t, R) => 0.003 + (R + 0.003) * ss(0, 0.25, t) + 0.003 * ss(0.3, 1, t),
    curlR: [0.003, 0.006],
    curlPitch: [0.09, 0.13],
    curlStart: 0.4,
    curlNoise: 0.2,
    lockR: 0.011,
    clump: 0.7,
    frizz: 0.0003,
    flyaway: 0.0003, // court: groomed (was 0.003); cast pass 0.0015 -> 0.0003 (spiky strays at the crown in backlight)
    width: 0.00016,
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
    // wardrobe polish pass: a full, combed, oiled royal beard - denser, shaped (fuller and squarer at the chin),
    // coherent locks with small tight curls, few flyaways and fewer grey flecks (they read as noise at distance)
    strands: { low: 2200, medium: 7000, high: 15000 }, // face pass: denser (was medium 6000 / high 13000)
    locks: 240,
    sim: { low: 6, medium: 10, high: 16 },
    length: (f, n, R) => {
      const ax = Math.abs(f.x);
      const must = ss(0.03, 0.02, ax) * ss(-0.075, -0.06, f.y) * ss(0.0, 0.3, n.z);
      const chin = ss(-0.04, -0.11, f.y) * ss(0.085, 0.025, ax);
      const L = 0.03 + 0.048 * chin + 0.01 * ss(0.06, 0.03, ax); // 3-8 cm: full, natural, not a long beard
      // cast pass: a groomed line under the jaw — roots facing down (under the chin, onto the neck) stay short, so no
      // strands trail down the throat (visual-bible 3.2: full, 6-10 cm, natural)
      const under = ss(-0.25, -0.65, n.y) * ss(0.06, 0.0, n.z + 0.2);
      // face pass: the upper edge on the cheeks grows short (a dense, groomed cheek line instead of long sparse
      // strands that read as a hard, stringy mesh edge)
      const cheekEdge = ss(-0.052, -0.026, f.y) * ss(0.03, 0.05, ax);
      return (must > 0.5 ? 0.026 : L * (1 - 0.6 * under) * (1 - 0.55 * cheekEdge)) * (0.92 + 0.16 * R());
    },
    comb: (f, n, out) => {
      const ax = Math.abs(f.x);
      const must = ss(0.03, 0.02, ax) * ss(-0.075, -0.06, f.y);
      dir(out, Math.sign(f.x) * (0.15 + 0.9 * must), -1, 0.4 - 0.25 * must);
      return out;
    },
    lift: 0.14, // wardrobe polish (court 0.2, originally 0.35)
    gravity: 12,
    combPull: 11,
    tousle: 1.2, // wardrobe polish (court 2.2, originally 5)
    volume: (t, R) => 0.0016 + (R + 0.002) * ss(0, 0.3, t) + 0.0035 * ss(0.2, 0.8, t),
    // cast pass: natural waves, not Assyrian corkscrews (visual-bible 3.2) — looser, longer-pitched curl (was
    // 0.0016-0.0032 / 0.016-0.024), almost no frizz or flyaways at the edges
    curlR: [0.0024, 0.0042],
    curlPitch: [0.03, 0.045],
    curlStart: 0.3,
    curlNoise: 0.14, // wardrobe polish (court 0.4, originally 0.6)
    lockR: 0.006,
    clump: 0.9, // combed, oiled locks (court 0.6, originally 0.4; wardrobe polish 0.84)
    frizz: 0.0001, // (court 0.0003)
    flyaway: 0.0002, // (court 0.001)
    width: 0.00019,
    stiffness: 0.45,
    childLen: [0.75, 1.0],
    colors: (R, f, root, tip) => {
      // grey at the chin (below the mouth, centre), scattered elsewhere
      const chin = ss(-0.07, -0.1, f.y) * ss(0.035, 0.012, Math.abs(f.x));
      if (R() < 0.03 + 0.18 * chin) { // grey threads at the chin (visual-bible 3.2), a few elsewhere
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
    ctrl: { low: 10, medium: 14, high: 18 },
    segs: { low: 14, medium: 22, high: 32 },
    shading: { shift: 0.035, roughness: 0.38, specular: 0.6, backlit: 0.8, scatter: 0.55, aoDirect: 0.55 },
    capColor: [0.092, 0.07, 0.057], // wardrobe polish: a shade lighter under the denser beard (was 0.075 0.058 0.048)
    capOffset: 0.004,
    capBeard: 0.7, // wardrobe polish: the beard cap only under the dense core (hard black mask round the mouth on phones)
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
      strands: full ? { low: 1500, medium: 5000, high: 12000 } : { low: 1600, medium: 5500, high: 14000 },
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
      lift: full ? 0.25 : 0.1,
      gravity: full ? 10 : 3,
      combPull: 14,
      tousle: 3,
      volume: (t, Rv) => 0.001 + (Rv + 0.0012) * ss(0, 0.3, t) + (full ? 0.004 * ss(0.2, 0.8, t) : 0),
      curlR: full ? [0.0015, 0.0035] : [0.0005, 0.001],
      curlPitch: full ? [0.012, 0.022] : [0.005, 0.008],
      curlNoise: 0.6,
      curlStart: 0.2,
      lockR: 0.003,
      clump: full ? 0.4 : 0.3,
      frizz: 0.0005,
      flyaway: 0.004,
      width: full ? 0.00017 : 0.00015,
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
    capBeard: beardKind === 'full' ? 0.85 : beardKind === 'short' ? 0.75 : 0,
    widthTier: { low: 2.8, medium: 1.5, high: 1 },
    headband: !!o.headband,
  };
}

/** per-vertex cap tint noise helper */
export function capNoise(x: number, y: number, z: number) {
  return 0.8 + 0.2 * fbm(x * 60, y * 60, z * 60, 2, 91);
}

export type { HeadSurface };
