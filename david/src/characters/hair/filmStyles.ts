import * as THREE from 'three';
import { rng, ss, vnoise } from './HeadSurface';
import type { LayerStyle } from './grow';
import { manStyle, type GroomStyle } from './styles';

/*
 * Grooms of the opening film's cast (docs/visual-bible.md 1.1, 3.0, 3.1, 3.4, 3.7, 3.9). Same conventions as styles.ts:
 * f = point - eye-centre midpoint (rest pose, metres; +x = his left, +y up, +z forward); colours sRGB.
 *
 *   samuelStyle()        Samuel: a Nazirite from birth (1 Sam 1:11 "וּמוֹרָה לֹא־יַעֲלֶה עַל־רֹאשׁוֹ"; Num 6:5 "גַּדֵּל פֶּרַע"):
 *                        uncut, loose, very long grey-white hair to mid-back, pushed back from the face, a few iron-grey
 *                        strands at the nape; a full, long, untrimmed grey-white beard to mid-chest (Lev 19:27).
 *   elderStyle(seed)     the elders (8:4): every one a different man (ELDER_LOOKS by seed): dark brown, black, brown
 *                        with grey streaks, salt and pepper, one iron-grey — never Samuel's white; beards round, long
 *                        and narrow, or short.
 *   soldierStyle(seed)   Israelite levy (15:4): full beards (young men short), hair to the nape / shoulders.
 *   philistineStyle(seed) clean-shaven (Medinet Habu), short hair under the headdress / helmet.
 */

const lin = (c: [number, number, number], out: THREE.Color) => out.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
const _c = new THREE.Color();
const dir = (out: THREE.Vector3, x: number, y: number, z: number) => out.set(x, y, z);

function vary(out: THREE.Color, R: () => number, amount: number, warm = 0) {
  const b = Math.exp((R() - 0.5) * 2 * amount);
  const h = (R() - 0.5) * 0.08 + warm;
  out.r *= b * (1 + h);
  out.g *= b;
  out.b *= b * (1 - h * 1.5);
  return out;
}

/** grey-white hair: mostly white-grey, some pure white, a few iron-grey / dark threads (more at the nape) */
function greyWhite(R: () => number, f: THREE.Vector3, root: THREE.Color, tip: THREE.Color, dark: number) {
  const r = R();
  const nape = ss(0.0, -0.08, f.z) * ss(0.0, -0.1, f.y);
  if (r < dark * (0.4 + 1.2 * nape)) {
    lin([0.26, 0.245, 0.23], root);
    vary(root, R, 0.25);
    lin([0.36, 0.34, 0.32], tip);
    vary(tip, R, 0.2);
    return;
  }
  // (models pass: a little greyer at the roots — the white mass needs depth, not a white wall)
  if (r < 0.35) lin([0.8, 0.79, 0.76], root);
  else lin([0.6, 0.585, 0.555], root);
  vary(root, R, 0.12);
  // yellowed, sun-bleached tips (old white hair in the sun is ivory, never blue-white)
  lin([0.8, 0.77, 0.7], tip).lerp(root, 0.4 + 0.3 * R());
  vary(tip, R, 0.1, 0.03);
}

// ================================================================================================= SAMUEL
export function samuelStyle(): GroomStyle {
  const scalp: LayerStyle = {
    name: 'samuel-scalp',
    kind: 0,
    reach: 0.66,
    mask: (s) => s.scalpMask(0, (phi) => 0.006 * Math.exp(-(((phi - 40) / 22) ** 2))), // a little receded at the temples (age)
    // second cast pass: denser and fuller (read stringy / sparse at medium): more, broader strands in bigger locks
    strands: { low: 4600, medium: 18000, high: 30000 },
    // (finishing pass: more, broader locks with less clumping — in the backlit verdict MCU the hair read as ropes /
    // dreadlocks with dark gaps between them)
    locks: 320,
    sim: { low: 16, medium: 32, high: 48 },
    length: (f, n, R) => {
      // uncut since birth: very long at the back (to mid-back), long at the sides (over the shoulders), the front
      // pushed back and falling behind
      const back = ss(0.03, -0.09, f.z);
      const side = ss(0.04, 0.075, Math.abs(f.x)) * (1 - back);
      return (0.36 + 0.24 * back + 0.08 * side) * (0.82 + 0.3 * R());
    },
    comb: (f, n, out) => {
      // pushed back from the face over the top, falling down behind the ears and over the shoulders
      dir(out, f.x * 0.35, -0.25, -1);
      out.y -= 1.2 * ss(0.0, -0.09, f.z);
      out.x += Math.sign(f.x) * 0.25 * ss(0.05, 0.08, Math.abs(f.x));
      out.x += 0.3 * vnoise(f.x * 20, f.y * 20, f.z * 20, 7);
      return out;
    },
    // models pass (CUT v2): in the verdict close-up the hair read as a spiky white mop (strands radiating in every
    // direction). Long uncut hair is HEAVY: it falls in big coherent locks with gentle waves — less lift / tousle /
    // curl noise, strong clumping, almost no frizz or flyaways, a little heavier and stiffer
    lift: 0.06,
    gravity: 22,
    combPull: 14,
    tousle: 1.5,
    // stay clear of the mantle over the shoulders and the back (1-3 cm of wool over the skin)
    volume: (t, R) => 0.004 + (R + 0.004) * ss(0, 0.25, t) + 0.02 * ss(0.35, 0.7, t),
    curlR: [0.003, 0.008],
    curlPitch: [0.14, 0.22],
    curlStart: 0.3,
    curlNoise: 0.35,
    straightLocks: 0.3,
    lockR: 0.015,
    clump: 0.72,
    frizz: 0.0005, // (cast 0.0015, originally 0.0022)
    flyaway: 0.003, // (cast 0.014, originally 0.03)
    width: 0.00017,
    stiffness: 0.3,
    childLen: [0.72, 1.0],
    colors: (R, f, root, tip) => greyWhite(R, f, root, tip, 0.1),
  };
  const beard: LayerStyle = {
    name: 'samuel-beard',
    kind: 1,
    reach: 0.66,
    mask: (s) => s.beardMask(),
    strands: { low: 2800, medium: 9000, high: 17000 },
    locks: 300,
    sim: { low: 8, medium: 12, high: 18 },
    length: (f, n, R) => {
      const ax = Math.abs(f.x);
      const must = ss(0.03, 0.02, ax) * ss(-0.075, -0.06, f.y) * ss(0.0, 0.3, n.z);
      // long, full, untrimmed (Lev 19:27): chin to mid-chest, the cheeks falling into it
      const chin = ss(-0.03, -0.11, f.y) * ss(0.09, 0.02, ax);
      const L = 0.1 + 0.16 * chin + 0.04 * ss(0.07, 0.03, ax);
      // face pass 2: the upper cheek edge grows short and blends into the skin (it hung as a curtain from a hard line)
      const cheekEdge = ss(-0.05, -0.022, f.y) * ss(0.028, 0.048, ax);
      return (must > 0.5 ? 0.055 : L * (1 - 0.65 * cheekEdge)) * (0.82 + 0.3 * R());
    },
    comb: (f, n, out) => {
      const ax = Math.abs(f.x);
      const must = ss(0.03, 0.02, ax) * ss(-0.075, -0.06, f.y);
      // (finishing pass: the moustache falls over the lip into the beard, the beard hangs straight down to the chest
      // — combed out sideways (0.1 + 0.9 must) it read as a white fan / broom in the verdict)
      dir(out, Math.sign(f.x) * (0.04 + 0.5 * must), -1, 0.3 - 0.2 * must);
      return out;
    },
    // models pass: a heavy, full beard falling in groomed wavy locks (no radiating strays)
    lift: 0.05,
    gravity: 22,
    combPull: 13,
    tousle: 1.2,
    volume: (t, R) => 0.002 + (R + 0.002) * ss(0, 0.3, t) + 0.005 * ss(0.2, 0.7, t),
    curlR: [0.0025, 0.005],
    curlPitch: [0.06, 0.1],
    curlStart: 0.25,
    curlNoise: 0.25, // (models pass 0.35, face pass 2 0.6, originally 0.8)
    straightLocks: 0.35,
    lockR: 0.009,
    // finishing pass: a full, heavy mass — 0.88 made ~200 thin separate wisps (stringy, see-through) at 640x360
    clump: 0.7, // (models pass 0.88, face pass 2 0.76, originally 0.55)
    frizz: 0.0003, // (0.0006)
    flyaway: 0.0004, // (0.0008, 0.0025)
    width: 0.00024,
    stiffness: 0.35,
    childLen: [0.7, 1.0],
    colors: (R, f, root, tip) => {
      greyWhite(R, f, root, tip, 0.04);
      // face pass 2: a few darker iron-grey threads deep in the beard give the white mass depth and structure
      if (R() < 0.12) {
        root.multiplyScalar(0.55);
        tip.multiplyScalar(0.75);
      }
      // tobacco-yellowed / darker round the mouth (the moustache of an old man)
      const must = ss(0.035, 0.015, Math.abs(f.x)) * ss(-0.1, -0.06, f.y);
      if (must > 0.3) root.multiplyScalar(0.85);
    },
  };
  return {
    name: 'samuel',
    layers: [scalp, beard],
    ctrl: { low: 10, medium: 14, high: 20 },
    segs: { low: 14, medium: 24, high: 38 },
    // (models pass: less back-lit glow — the white mass lit up like a halo against the low sun)
    // (finishing pass: white hair scatters light through the whole mass — more scatter, less occlusion inside the
    // locks: the dark lock interiors striped the hair like ropes in the backlit verdict MCU)
    shading: { shift: 0.03, roughness: 0.45, specular: 0.42, backlit: 0.55, scatter: 0.9, aoDirect: 0.4 },
    capColor: [0.62, 0.6, 0.56], // the scalp cap near the white hair (models pass: a shade greyer — the beard read as a white wall)
    capOffset: 0.005,
    capBeard: 0.55,
    widthTier: { low: 2.8, medium: 1.5, high: 1 },
  };
}

// ================================================================================================= ELDERS
/**
 * The look of each elder of Ramah (cut7, wave 4 — the user: "the people look exactly like Samuel"): every elder a
 * different man and none like Samuel (the only snow-white head): dark brown, black, brown with grey streaks, salt and
 * pepper, one clearly iron-grey; beards full and round, long and narrow, short and trimmed; ages ~45-68. Indexed by
 * the elder's seed (FilmStage / dev/cast-ramah: seed = Ramah mark + 1; mark 0 the speaker, 2-3 the pair, 6-7 the near
 * pair); other seeds draw from the same ranges.
 *   hair: sRGB base colour · grey: share of grey strands · greyAt: where the grey sits ('temples' streaks at the sides
 *   and the chin, 'mix' salt and pepper all through, 'all' iron-grey) · beard: shape · beardLen / hairLen (m) · wavy
 */
export interface ElderLook {
  hair: [number, number, number];
  grey: number;
  greyAt: 'temples' | 'mix' | 'all';
  beard: 'round' | 'long' | 'short';
  beardLen: number;
  hairLen: number;
  wavy: number;
}
const BLACK: [number, number, number] = [0.035, 0.029, 0.026];
const DARK_BROWN: [number, number, number] = [0.07, 0.05, 0.038];
const BROWN: [number, number, number] = [0.13, 0.088, 0.06];
const CHESTNUT: [number, number, number] = [0.17, 0.105, 0.065];
export const ELDER_LOOKS: ElderLook[] = [
  // 1 · mark 0, THE SPEAKER (~55): dark brown, grey streaks at the temples, a full round beard
  { hair: DARK_BROWN, grey: 0.16, greyAt: 'temples', beard: 'round', beardLen: 0.12, hairLen: 0.17, wavy: 0.7 },
  // 2 · mark 1, seated (~45): black, short trimmed beard
  { hair: BLACK, grey: 0.03, greyAt: 'mix', beard: 'short', beardLen: 0.045, hairLen: 0.13, wavy: 0.2 },
  // 3 · mark 2 (~62): salt and pepper, long narrow beard
  { hair: DARK_BROWN, grey: 0.42, greyAt: 'mix', beard: 'long', beardLen: 0.2, hairLen: 0.2, wavy: 0.3 },
  // 4 · mark 3, the pair's near man (~50): chestnut brown, full round beard
  { hair: CHESTNUT, grey: 0.06, greyAt: 'temples', beard: 'round', beardLen: 0.13, hairLen: 0.22, wavy: 0.85 },
  // 5 · mark 4 (~45): dark brown, short beard
  { hair: DARK_BROWN, grey: 0.02, greyAt: 'mix', beard: 'short', beardLen: 0.05, hairLen: 0.12, wavy: 0.6 },
  // 6 · mark 5 (~68): the one clearly grey — iron-grey (never white), long beard
  { hair: BROWN, grey: 0.82, greyAt: 'all', beard: 'long', beardLen: 0.19, hairLen: 0.2, wavy: 0.4 },
  // 7 · mark 6, near pair (~58): black, grey streaks, full round beard
  { hair: BLACK, grey: 0.18, greyAt: 'temples', beard: 'round', beardLen: 0.11, hairLen: 0.16, wavy: 0.55 },
  // 8 · mark 7, near pair (~52): dark brown, long narrow beard
  { hair: DARK_BROWN, grey: 0.05, greyAt: 'mix', beard: 'long', beardLen: 0.18, hairLen: 0.19, wavy: 0.15 },
  // 9 · mark 8 (~64): salt and pepper, short beard
  { hair: BROWN, grey: 0.45, greyAt: 'mix', beard: 'short', beardLen: 0.06, hairLen: 0.14, wavy: 0.5 },
  // 10 · mark 9 (~48): brown, full beard
  { hair: BROWN, grey: 0.04, greyAt: 'temples', beard: 'round', beardLen: 0.1, hairLen: 0.18, wavy: 0.9 },
  // 11 · mark 10 (~57): black, grey streaks, long beard
  { hair: BLACK, grey: 0.2, greyAt: 'temples', beard: 'long', beardLen: 0.17, hairLen: 0.15, wavy: 0.35 },
];
/** the look of an elder by seed (1-based; the table, or the same ranges for other seeds) */
export function elderLook(seed: number): ElderLook {
  const L = ELDER_LOOKS[seed - 1];
  if (L) return L;
  const R = rng(seed * 4513 + 71);
  const hairs = [BLACK, DARK_BROWN, BROWN, CHESTNUT];
  const beards: ElderLook['beard'][] = ['round', 'long', 'short'];
  const beard = beards[Math.floor(R() * 3)];
  return {
    hair: hairs[Math.floor(R() * hairs.length)], grey: 0.05 + 0.4 * R(), greyAt: R() < 0.5 ? 'temples' : 'mix', beard,
    beardLen: beard === 'short' ? 0.045 + 0.02 * R() : beard === 'long' ? 0.16 + 0.05 * R() : 0.1 + 0.04 * R(), hairLen: 0.12 + 0.1 * R(), wavy: R(),
  };
}

/** an elder's grey strand: iron-grey / pepper (dark-rooted), never Samuel's ivory white */
function ironGrey(R: () => number, root: THREE.Color, tip: THREE.Color, light: number) {
  lin([0.36 + 0.14 * light, 0.35 + 0.135 * light, 0.33 + 0.125 * light], root);
  vary(root, R, 0.14);
  tip.copy(root).multiplyScalar(1.12 + 0.1 * R());
}

/** Elders of Israel (8:4): seeded look (ELDER_LOOKS) — hair and beard colour, grey, beard shape and length, waviness. */
export function elderStyle(seed: number): GroomStyle {
  const L = elderLook(seed);
  const R0 = rng(seed * 4513 + 71);
  const grey = L.grey;
  // where the grey grows: streaks at the temples / sides and the chin, all through (pepper), or all over
  const greyW = (f: THREE.Vector3, beard: boolean) => {
    if (L.greyAt === 'all') return 1;
    if (L.greyAt === 'mix') return 1;
    // temples: the sides of the scalp above the ears and the chin of the beard
    return beard ? 0.6 + 1.4 * ss(-0.05, -0.11, f.y) * ss(0.06, 0.0, Math.abs(f.x)) : 0.25 + 2.6 * ss(0.035, 0.065, Math.abs(f.x)) * ss(-0.06, 0.02, f.z);
  };
  const col = (beard: boolean) => (R: () => number, f: THREE.Vector3, root: THREE.Color, tip: THREE.Color) => {
    if (R() < grey * greyW(f, beard)) return ironGrey(R, root, tip, L.greyAt === 'all' ? 0.45 + 0.4 * R() : 0.2 + 0.5 * R());
    lin(L.hair, root);
    vary(root, R, 0.22);
    // sun-warmed tips (a dark head in the low sun reads brown, never flat black)
    tip.copy(root).multiplyScalar(1.35 + 0.25 * R());
    tip.r *= 1.06;
  };
  const wavy = L.wavy;
  const scalp: LayerStyle = {
    name: 'elder-scalp',
    kind: 0,
    reach: 0.42,
    mask: (s) => s.scalpMask(0.004 + 0.012 * R0()), // receding with age
    strands: { low: 2400, medium: 7000, high: 14000 },
    // (finishing pass: fuller groomed locks — the near elders of P5 are seen from behind, their hair large in frame)
    locks: 260,
    sim: { low: 8, medium: 16, high: 24 },
    length: (f, n, R) => (L.hairLen + 0.08 * ss(0.02, -0.08, f.z)) * (0.8 + 0.4 * R()),
    comb: (f, n, out) => {
      dir(out, f.x * 0.4, -0.3, -1);
      out.y -= 1.0 * ss(0.0, -0.08, f.z);
      return out;
    },
    lift: 0.1,
    gravity: 13,
    combPull: 12,
    // models pass: groomed, heavier locks (read stringy in medium shots)
    tousle: 2,
    volume: (t, Rv) => 0.003 + (Rv + 0.003) * ss(0, 0.3, t) + 0.012 * ss(0.4, 0.8, t),
    curlR: wavy > 0.5 ? [0.003, 0.006] : [0.0015, 0.0035],
    curlPitch: wavy > 0.5 ? [0.04, 0.065] : [0.09, 0.15],
    curlStart: 0.25,
    curlNoise: 0.45,
    lockR: 0.01,
    clump: 0.68,
    frizz: 0.0008,
    flyaway: 0.003,
    width: 0.00013,
    stiffness: 0.25,
    childLen: [0.75, 1.0],
    colors: col(false),
  };
  // beard shapes: full and round (long at the sides too), long and narrow (the chin long, the cheeks short), short and
  // trimmed (even, close)
  const shape = L.beard;
  const beard: LayerStyle = {
    name: 'elder-beard',
    kind: 1,
    reach: 0.42,
    mask: (s) => s.beardMask(),
    strands: { low: 1800, medium: 5500, high: 12000 },
    locks: 170,
    sim: { low: 4, medium: 8, high: 12 },
    length: (f, n, R) => {
      const ax = Math.abs(f.x);
      const must = ss(0.03, 0.02, ax) * ss(-0.075, -0.06, f.y) * ss(0.0, 0.3, n.z);
      const chin = ss(-0.03, -0.11, f.y) * ss(0.09, 0.02, ax);
      const bl = L.beardLen;
      const len = shape === 'round' ? bl * (0.62 + 0.38 * chin) + 0.02 * ss(0.07, 0.03, ax)
        : shape === 'long' ? bl * (0.22 + 0.78 * chin * chin) + 0.012 * ss(0.07, 0.03, ax)
          : bl * (0.8 + 0.2 * chin);
      return (must > 0.5 ? (shape === 'short' ? 0.022 : 0.04) : len) * (0.85 + 0.25 * R());
    },
    comb: (f, n, out) => {
      const ax = Math.abs(f.x);
      const must = ss(0.03, 0.02, ax) * ss(-0.075, -0.06, f.y);
      // a long narrow beard gathers to the chin; a round one falls straight and full
      const gather = shape === 'long' ? -0.1 : shape === 'round' ? 0.1 : 0.03;
      dir(out, Math.sign(f.x) * (0.06 + gather + 0.55 * must), -1, 0.32 - 0.22 * must);
      return out;
    },
    lift: shape === 'short' ? 0.3 : 0.14,
    gravity: shape === 'short' ? 6 : 16,
    combPull: 12,
    tousle: shape === 'short' ? 0.8 : 1.6,
    volume: (t, Rv) => 0.0018 + (Rv + 0.002) * ss(0, 0.3, t) + (shape === 'round' ? 0.006 : 0.004) * ss(0.2, 0.8, t),
    curlR: [0.002, 0.0045],
    curlPitch: [0.035, 0.06],
    curlStart: 0.2,
    curlNoise: 0.45,
    lockR: 0.0075,
    clump: 0.7,
    frizz: 0.0005,
    flyaway: 0.0012,
    width: 0.0002,
    stiffness: shape === 'short' ? 0.7 : 0.4,
    childLen: [0.7, 1.0],
    colors: col(true),
  };
  // the scalp cap under the strands: the hair's own colour, a little lighter where it greys
  const capL = 0.45 * (L.hair[0] + L.hair[1] + L.hair[2]) + 0.3 * grey;
  return {
    name: `elder-${seed}`,
    layers: [scalp, beard],
    ctrl: { low: 9, medium: 12, high: 16 },
    segs: { low: 12, medium: 18, high: 28 },
    shading: { shift: 0.03, roughness: 0.42, specular: 0.48, backlit: 0.6, scatter: 0.45 + 0.2 * grey, aoDirect: 0.55 },
    capColor: [Math.min(0.5, capL * 1.05), Math.min(0.48, capL * 0.95), Math.min(0.45, capL * 0.85)],
    capOffset: 0.004,
    capBeard: 0.8,
    widthTier: { low: 2.8, medium: 1.5, high: 1 },
  };
}

// ================================================================================================= SOLDIERS / PHILISTINES
/** Israelite soldier: full beard (a few young men short), hair to the nape / shoulders; headband / head-cloth optional. */
export function soldierStyle(seed: number, headband = false): GroomStyle {
  const R0 = rng(seed * 331 + 5);
  const st = manStyle({ seed, beard: R0() < 0.2 ? 'short' : 'full', headband });
  st.name = `soldier-${seed}`;
  return st;
}

/** Philistine: clean-shaven (Medinet Habu reliefs), short hair pressed under the headdress / helmet band. */
export function philistineStyle(seed: number): GroomStyle {
  const st = manStyle({ seed: seed + 5000, beard: 'none', headband: true });
  st.name = `philistine-${seed}`;
  return st;
}
