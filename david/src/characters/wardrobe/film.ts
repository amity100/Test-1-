import * as THREE from 'three';
import type { HumanModel } from '../human/HumanModel';
import { C } from './body';
import { beginFit, beltBand, fittedTunic, hangFromBelt, headRing, legCapsules, limbRing, sandals, tzitzit, type TunicResult } from './common';
import { makeAxe, makeBedroll, makeBow, makeFeatherCrown, makeGreave, makeHelmet, makeQuiver, makeRamHorn, scaleArmour } from './filmProps';
import { merge, partWeights, ribbon, type Fit } from './garments';
import { rng, TAU } from './loft';
import { clothMaterial, fringeMaterial, solidMaterial, texPair, type TexPair, type Tier } from './materials';
import type { Outfit, Prop } from './Outfit';
import { makeShield, makeSlingPouch, makeSpear, makeStaff, makeSword } from './props';
import { makeSkinned } from './body';
import { MeilTear } from './tear';

/*
 * Costumes of the opening film "הַטּוֹב מִמֶּךָּ" — every choice from docs/visual-bible.md (binding):
 *
 *   dressSamuel      3.1: ankle tunic of light undyed wool + the me'il: a heavy dark undyed wool wrap-mantle, ankle
 *                    length, one end thrown over the left shoulder, a plain woven border near the hem, tzitzit (white +
 *                    one tekhelet thread) at the four corners; head bare; plain dusty sandals. No staff, horn,
 *                    jewellery, priestly garments. The back-right corner is tearable (MeilTear, 15:27).
 *   dressSaulGilgal  3.2: crimson (kermes) knee tunic `#8a1c20`, bronze SCALE coat to mid-thigh (real scales), belt +
 *                    straight sword at the left hip, thin gold nezer on the bare head, gold armlet on the LEFT upper arm,
 *                    sandals strapped to the ankle; props: spear (iron leaf head, metal butt-spike) and the plain
 *                    bronze helmet (carried under the left arm). No greaves, crest, cape, crown.
 *   dressArmourBearer 3.2/3.4: a young man, undyed tunic + belt; Saul's round OILED-LEATHER shield and javelins.
 *   dressSoldier     3.4: knee tunics of undyed wool (some with a madder / ochre stripe), belts, sandals / barefoot,
 *                    almost no armour; seeded kit per the bible's mix: spear, sling, bow + quiver, sword, axe; round
 *                    leather shields; head bare / headband / head-cloth; bedrolls; a few rams' horns.
 *   dressElder       3.7: long tunic to the shins + a rectangular wool mantle with tzitzit; undyed (cream, brown,
 *                    grey, black goat), the richer with a coloured band; bare head / headband / head-cloth; staffs.
 *   dressPhilistine  3.9: rank and file — short kilt, ribbed leather corselet, reed / feather crown, round shield,
 *                    spears; elite — bronze helmet with a low ridge, bronze scale corselet, bronze greaves, long sword.
 * Wool OR linen per garment (no sha'atnez, Deut 22:11); tzitzit only on four-cornered garments (Num 15:38).
 */

export interface FilmDressOptions {
  quality: Tier;
  seed?: number;
  /** crowd variant: fewer rows / columns, no cloth chains, merged props (for the crowd teammate) */
  crowd?: boolean;
}

const WOOL_LIGHT = [0xcdbf9f, 0xc4b594, 0xb9a887, 0xd2c6a8];
const WOOL_DARK = [0x5e5143, 0x6a5b49, 0x74644f];
const TEKHELET = 0x2f4c8f;

async function kit(tier: Tier, names: string[]) {
  const pairs = await Promise.all(names.map((n) => texPair(n, tier)));
  return Object.fromEntries(names.map((n, i) => [n, pairs[i]])) as Record<string, TexPair>;
}

function tzitzitMats(tier: Tier, rope: TexPair, fringeT: TexPair) {
  const white = solidMaterial({ tier, tex: rope, color: 0xe9e2d0, roughness: 0.9, repeat: [1, 1 / 0.012] });
  const blue = solidMaterial({ tier, tex: rope, color: TEKHELET, roughness: 0.85, repeat: [1, 1 / 0.012] });
  const strings = solidMaterial({ tier, tex: rope, color: 0xffffff, roughness: 0.88, repeat: [1, 1 / 0.012] });
  strings.vertexColors = true;
  const fr = fringeMaterial({ tier, tex: fringeT, dye: 0xece5d4, width: 0.02 });
  return { white, blue, fringe: fr, batch: { material: strings, white: 0xe9e2d0, blue: TEKHELET } };
}

/** A mantle end thrown over the left shoulder: a heavy band from the right hip across the chest, over the left
 * shoulder and down the back (the "wrapped" read of עֹטֶה מְעִיל, 28:14). */
function shoulderThrow(fit: Fit, meil: TunicResult, material: THREE.Material, o: { width: number; thickness: number; name: string }) {
  const { lm, human, tier, outfit } = fit;
  const low = tier === 'low';
  const pts: THREE.Vector3[] = [], nrm: THREE.Vector3[] = [];
  const N = low ? 30 : 64;
  const shoulderY = lm.yArmpit + 0.1 * (lm.height / 1.75);
  // (th, y) keyframes: front right waist -> left shoulder top -> back left -> back right hip
  const K: [number, number][] = [
    [-0.95, meil.beltY - 0.05],
    [-0.2, meil.beltY + 0.12],
    [0.55, lm.yArmpit + 0.02],
    [1.25, shoulderY],
    [2.1, lm.yArmpit + 0.02],
    [2.75, meil.beltY + 0.1],
    [3.5, meil.beltY - 0.06],
  ];
  const curve = new THREE.CatmullRomCurve3(K.map(([th, y]) => new THREE.Vector3(th, y, 0)));
  for (let i = 0; i < N; i++) {
    const c = curve.getPoint(i / (N - 1));
    const th = c.x, y = Math.min(c.y, lm.neck.y - 0.05);
    const r = meil.upper.R(y, th) + o.thickness * 0.5 + 0.006;
    const p = meil.upper.field.point(y, th, r);
    pts.push(p);
    const p2 = meil.upper.field.point(y, th, r + 0.01);
    nrm.push(p2.sub(p).normalize());
  }
  const g = ribbon(pts, nrm, o.width, o.thickness, { closed: false });
  const w = partWeights(fit, C.TORSO | C.NECK | C.UPARM_L, 8);
  const m = makeSkinned(human, g, material, w, { name: o.name });
  outfit.add(m);
  return m;
}

// ================================================================================================ SAMUEL
export interface SamuelOutfit {
  outfit: Outfit;
  tear: MeilTear;
}

export async function dressSamuel(human: HumanModel, opts: FilmDressOptions): Promise<SamuelOutfit> {
  const t0 = performance.now();
  const tier = opts.quality;
  const t = await kit(tier, ['weave_medium', 'weave_coarse', 'fringe', 'leather', 'rope']);
  const fit = await beginFit(human, 'samuel', tier, opts.seed ?? 11);
  const { lm, outfit } = fit;
  const S = lm.height / 1.75;
  const hipY = (lm.hip.L.y + lm.hip.R.y) / 2;
  outfit.capsules.push(...legCapsules(fit, 0.018, 0.07));
  outfit.swayGain = 0.01; // heavy wool
  // (1) ankle tunic, light undyed wool, long sleeves
  const kut = fittedTunic(fit, { tex: t.weave_medium, tile: 0.12, dye: 0xcdbf9f, hem: 0.95, sleeve: 1.85, neck: 'slit', ease: 0.008, flare: 0.12, folds: 0.8, seed: 5, name: 'kuttonet', fray: 0.03, dust: 0.7, roughness: 0.92, sheen: 0.5 });
  // (2) the me'il: dark undyed wool, heavy, ankle length, four corners (side openings), woven border near the hem
  const DARK = 0x655645;
  // side openings of the wrap: narrow (a wide slit showed the light tunic as a stripe down both sides)
  const half = 0.11;
  const meil = fittedTunic(fit, {
    tex: t.weave_coarse, tile: 0.1, dye: DARK, hem: 0.92, sleeve: 0, sleeveless: true, neck: 'round', offset: 0.014, ease: 0.016, flare: 0.2, folds: 2.2,
    seed: 17, name: 'meil', sideSlit: { top: hipY + 0.02, half }, hide: false, inner: [kut.restPos[0], kut.restPos[1]], fray: 0.25, sheen: 0.55, roughness: 0.95, dust: 0.85,
    armhole: { half: 0.55, top: lm.yArmpit + 0.012 + 0.07 }, shoulderFolds: 6,
    palette: [0x4e4236, 0x8a7a60, 0x3b3128, 0x6f604c],
    bands: [{ from: 0.05, to: 0.075, motif: 0, pal: 0 }, { from: 0.08, to: 0.088, motif: 0, pal: 1 }],
  });
  // the thrown end over the left shoulder
  const throwMat = clothMaterial({ tier, tex: t.weave_coarse, tile: 0.1, dye: DARK, roughness: 0.95, sheen: 0.55, hem: [0, 0.1, 0.012, 0.25], edgeMask: [1, 1], transmit: 0.3 });
  shoulderThrow(fit, meil, throwMat, { width: 0.2 * S, thickness: 0.012, name: 'meilThrow' });
  // (3) cloth belt on the tunic (under the me'il), (4) sandals
  const beltMat = clothMaterial({ tier, tex: t.weave_medium, tile: 0.08, dye: 0x8a7a60, hem: [0, 0.1, 0.01, 0], edgeMask: [0, 0], transmit: 0 });
  beltBand(fit, kut, { width: 0.04 * S, thickness: 0.006, material: beltMat, name: 'belt' });
  sandals(fit, t.leather, { wraps: 1, height: 0.05, color: 0x5a4030 });
  // tzitzit at the four corners
  const tm = tzitzitMats(tier, t.rope, t.fringe);
  tzitzit(fit, meil.corners, { ...tm, length: 0.17 * S });
  // tearable corner: back-right (index 3: th = -PI/2 - half; the cloth extends toward the back, th decreasing)
  const skirtMesh = meil.meshes[1] as THREE.SkinnedMesh;
  const freeMat = clothMaterial({ tier, tex: t.weave_coarse, tile: 0.1, dye: DARK, roughness: 0.95, sheen: 0.55, hem: [0.85, 0.16, 0.015, 0.25], edgeMask: [1, 0], transmit: 0.3, bands: [{ from: 0.05, to: 0.075, motif: 0, pal: 0 }, { from: 0.08, to: 0.088, motif: 0, pal: 1 }], palette: [0x4e4236, 0x8a7a60, 0x3b3128, 0x6f604c] });
  const tear = new MeilTear(human, skirtMesh, meil.skirt.tube, { mesh: skirtMesh }, -Math.PI / 2 - half, -1, meil.hemY, { freeMaterial: freeMat, width: 0.3 * S, height: 0.5 * S, seed: 27, threadColor: 0x8b7b62 });
  outfit.add(tear.flapSkinned);
  const sock = (human.sockets as Record<string, THREE.Object3D>)['wardrobeTzitzit3'];
  if (sock) {
    sock.userData.tearHome = sock.parent;
    tear.attachTzitzit([sock]);
  }
  outfit.finish(t0);
  return { outfit, tear };
}

// ================================================================================================ SAUL (GILGAL)
export interface SaulGilgalProps {
  spear: Prop;
  helmet: THREE.Group;
}

export async function dressSaulGilgal(human: HumanModel, opts: FilmDressOptions): Promise<{ outfit: Outfit; spear: Prop; helmet: THREE.Group }> {
  const t0 = performance.now();
  const tier = opts.quality;
  const t = await kit(tier, ['weave_fine', 'leather', 'metal', 'wood']);
  const fit = await beginFit(human, 'saulGilgal', tier, opts.seed ?? 3);
  const { lm, outfit } = fit;
  const S = lm.height / 1.75;
  // thin margin: the cloth-collision push moved the madim and the coat's leather skirt OUT past the bronze scales at
  // the buttocks (the scales are not pushed) — black / crimson patches at the back of the coat
  outfit.capsules.push(...legCapsules(fit, -0.006, 0.06));
  const KERMES = 0x8a1c20;
  // madim: crimson wool, knee length, short sleeves; sweat-darkened and dusty from the campaign
  const madim = fittedTunic(fit, {
    tex: t.weave_fine, tile: 0.06, dye: KERMES, hem: -0.15, sleeve: 0.42, neck: 'round', ease: 0.006, flare: 0.14, folds: 1.1, seed: 4, name: 'madim',
    fray: 0.1, sheen: 0.55, roughness: 0.82, dust: 0.75, palette: [0x9c3a30, 0x6e1518, 0x000000, 0x000000],
    bands: [{ from: 0.0, to: 0.012, motif: 0, pal: 1 }],
  });
  // shiryon: leather backing (neck to mid-thigh, sleeveless) + bronze scales
  const coat = fittedTunic(fit, {
    tex: t.leather, tile: 0.25, dye: 0x4a3322, hem: -0.95, sleeve: 0, sleeveless: true, neck: 'round', offset: 0.012, ease: 0.012, flare: 0.08, folds: 0.25,
    skirtStiff: 0.6, // leather-backed scales: the skirt of the coat hangs from the belt (a flexible one bulged out behind in a lunge)
    seed: 8, name: 'shiryonBacking', hide: false, inner: madim.restPos, fray: 0, sheen: 0.25, roughness: 0.6, dust: 0.5,
    armhole: { half: 0.5, top: lm.yArmpit + 0.012 + 0.075 },
    palette: [0x3a2618, 0x3a2618, 0x3a2618, 0x3a2618],
    bands: [{ from: 0.0, to: 0.02, motif: 0, pal: 0 }],
    neckBands: [{ from: 0.0, to: 0.02, motif: 0, pal: 0, edge: 'upper' }],
  });
  scaleArmour(fit, coat, { metal: t.metal, polish: 'royal', seed: 29, width: opts.crowd ? 0.04 : 0.03, length: opts.crowd ? 0.075 : 0.058, row: opts.crowd ? 0.05 : 0.036, skirtStiff: 0.6 });
  // belt over the coat + straight sword at the left hip, girded over the madim (17:39)
  const beltMat = solidMaterial({ tier, tex: t.leather, color: 0x3d2a1c, roughness: 0.55, repeat: [1, 12], normal: 1.2 });
  beltBand(fit, coat, { width: 0.05 * S, thickness: 0.008, material: beltMat, offset: 0.012, name: 'swordBelt' });
  const sword = makeSword(tier, t.leather, t.metal, t.wood);
  hangFromBelt(fit, coat, sword, { th: 1.45, out: 0.045, drop: 0.012, forward: 0.42, bone: 'pelvis.L', name: 'wardrobeSword' });
  outfit.props.sword = sword;
  // nezer: thin hammered gold band on the bare head, one small lozenge at the front
  const gold = solidMaterial({ tier, tex: t.metal, color: 0xd6a743, roughness: 0.38, metalness: 1, repeat: [2, 2], normal: 1.3, metalWear: { patina: 0x7a5424, amount: 0.22, edgeBright: 0.6 } });
  // (lift: the band sits on the forehead ABOVE the brow — visual-bible 3.2; the groom's headband matches, FilmActor)
  const ring = headRing(fit, { height: 0.018, thickness: 0.0022, material: gold, extra: 0.01, tilt: 0.008, lift: 0.013 });
  {
    const lz = new THREE.CylinderGeometry(0.013, 0.013, 0.003, 4, 1);
    lz.rotateX(Math.PI / 2);
    lz.scale(1, 1.25, 1);
    lz.translate(0, -0.004, ring.rz + 0.0012);
    const band = ring.mesh.geometry;
    const merged = merge([band, lz], false);
    merged.computeVertexNormals();
    ring.mesh.geometry = merged;
    band.dispose();
  }
  // etz'adah: broad gold armlet on the LEFT upper arm, below the crimson sleeve (reads above the helmet)
  limbRing(fit, { side: 'L', from: 'upperarm01', to: 'lowerarm01', t: 0.66, bone: 'upperarm02.L', mask: C.UPARM_L, width: 0.042, thickness: 0.0035, clearance: 0.01, material: gold, ridges: tier === 'low' ? 0 : 3 });
  sandals(fit, t.leather, { wraps: 2.2, height: 0.13, color: 0x4a3120 });
  const spear = makeSpear(tier, t.wood, t.metal, t.leather, { length: 2.45, head: 0.3, gripAt: 1.25, bronzeButt: true, shaftColor: 0x6f5238 });
  outfit.props.spear = spear;
  const [rx, rz] = human.metrics.crownRadius;
  const helmet = makeHelmet(tier, t.metal, t.leather, { radius: [rx + 0.014, rz + 0.014], height: 0.15, polish: 'royal', seed: 7 });
  outfit.finish(t0);
  return { outfit, spear, helmet };
}

// ================================================================================================ ARMY OF ISRAEL
export type SoldierKit = 'spear' | 'sling' | 'bow' | 'sword' | 'axe' | 'armourBearer' | 'horn';

export interface SoldierResult {
  outfit: Outfit;
  kit: SoldierKit;
  /** hand props (not attached): main = right hand, off = left hand */
  main: Prop | null;
  off: Prop | THREE.Object3D | null;
  shield: THREE.Object3D | null;
}

/** seeded weapon mix per the bible (per 100: 45 spears, 20 slings, 15 bows, 10 swords, 10 axes/clubs) */
export function soldierKitFor(seed: number): SoldierKit {
  const r = rng(seed * 104729 + 7)();
  return r < 0.45 ? 'spear' : r < 0.65 ? 'sling' : r < 0.8 ? 'bow' : r < 0.9 ? 'sword' : 'axe';
}

export async function dressSoldier(human: HumanModel, opts: FilmDressOptions & { kit?: SoldierKit }): Promise<SoldierResult> {
  const t0 = performance.now();
  const tier = opts.quality;
  const seed = opts.seed ?? 1;
  const R = rng(seed * 7919 + 131);
  const kitName = opts.kit ?? soldierKitFor(seed);
  const t = await kit(tier, ['weave_medium', 'weave_coarse', 'leather', 'metal', 'wood', 'bark']);
  const fit = await beginFit(human, `soldier:${kitName}`, tier, seed);
  const { lm, outfit } = fit;
  const S = lm.height / 1.75;
  outfit.capsules.push(...legCapsules(fit, 0.014, 0.05));
  const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const dye = pick([0xcdbf9f, 0xc4b594, 0xb9a887, 0x9a8466, 0x8a7a64, 0x7c7266, 0xb0a48c]);
  const striped = R() < 0.3;
  const tun = fittedTunic(fit, {
    tex: pick([t.weave_medium, t.weave_coarse]), tile: 0.13, dye, hem: -0.15 + R() * 0.2, sleeve: 0.35 + R() * 0.35, neck: 'slit', flare: 0.14,
    seed, name: 'tunic', fray: 0.35, dust: 0.75 + 0.2 * R(), folds: 1,
    ...(striped ? { palette: [pick([0x9a4a2c, 0xa7773a]), 0, 0, 0], bands: [{ from: 0.03, to: 0.045, motif: 0, pal: 0 }] } : {}),
  });
  const beltMat = R() < 0.6
    ? solidMaterial({ tier, tex: t.leather, color: pick([0x4a2f1d, 0x5a3a22, 0x3d2a1c]), roughness: 0.6, repeat: [1, 12], normal: 1.2 })
    : clothMaterial({ tier, tex: t.weave_medium, tile: 0.08, dye: pick([0x8a6a48, 0x9a5a3a, 0x7a7058, 0xa7773a]), hem: [0, 0.1, 0.01, 0], edgeMask: [0, 0], transmit: 0 });
  beltBand(fit, tun, { width: 0.045 * S, thickness: 0.007, material: beltMat, name: 'belt' });
  // head: bare / headband / wrapped head-cloth against the sun; one in twenty a leather cap
  const hr = R();
  if (hr < 0.35) {
    const band = clothMaterial({ tier, tex: t.weave_medium, tile: 0.08, dye: pick([0x8e3f2c, 0x5a4632, 0xd9cba8, 0xa7773a]), hem: [0, 0.1, 0.01, 0], edgeMask: [0, 0], transmit: 0 });
    headRing(fit, { height: 0.022, thickness: 0.004, material: band, extra: 0.011 });
  } else if (hr < 0.55) {
    const cloth = clothMaterial({ tier, tex: t.weave_medium, tile: 0.1, dye: pick([0xe0d4b8, 0xc8b894, 0xa88f6c]), hem: [0, 0.1, 0.01, 0], edgeMask: [0, 0], transmit: 0.3 });
    headRing(fit, { height: 0.055, thickness: 0.014, material: cloth, extra: 0.012, lift: 0.008, tilt: 0.012 });
  } else if (hr < 0.6) {
    const cap = makeHelmet(tier, t.metal, t.leather, { radius: [human.metrics.crownRadius[0] + 0.01, human.metrics.crownRadius[1] + 0.01], height: 0.11, seed });
    cap.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh && !(m.material as THREE.MeshStandardMaterial).side) return;
      if (m.isMesh) m.material = solidMaterial({ tier, tex: t.leather, color: 0x5a3a22, roughness: 0.6, repeat: [2, 2] });
    });
    cap.position.y = -0.012;
    human.sockets.crownAnchor.add(cap);
    outfit.add(cap);
  }
  if (!opts.crowd && R() < 0.3) {
    // bedroll (a mantle rolled and tied) across the back
    const roll = makeBedroll(tier, t.weave_coarse, pick(WOOL_DARK.concat(WOOL_LIGHT)));
    const spine = human.sockets.spineUpper;
    roll.position.set(0, -0.05, -0.16 * S);
    roll.rotation.set(0, 0, 0.6 * (R() < 0.5 ? 1 : -1));
    spine.add(roll);
    outfit.add(roll);
  }
  let main: Prop | null = null;
  let off: Prop | THREE.Object3D | null = null;
  let shield: THREE.Object3D | null = null;
  const withShield = kitName === 'armourBearer' || (kitName !== 'bow' && kitName !== 'sling' && R() < 0.4);
  if (kitName === 'spear' || kitName === 'armourBearer') main = makeSpear(tier, t.wood, t.metal, t.leather, { length: kitName === 'armourBearer' ? 1.7 : 2.0 + 0.4 * R(), head: 0.22 + 0.06 * R(), gripAt: 1.0, seed, shaftColor: pick([0xb09070, 0x9a7a58, 0x8a6a4a]) });
  if (kitName === 'axe') main = makeAxe(tier, t.wood, t.metal);
  if (kitName === 'horn') main = makeRamHorn(tier);
  if (kitName === 'bow') {
    off = makeBow(tier, t.wood, { seed });
    const q = makeQuiver(tier, t.leather, t.wood, { seed });
    q.position.set(0.06 * S, -0.1 * S, -0.14 * S);
    q.rotation.set(0.15, 0, -0.45);
    human.sockets.spineUpper.add(q);
    outfit.add(q);
  }
  if (kitName === 'sling') {
    // sling wound at the belt, a pouch of stones
    const pouch = makeSlingPouch(tier, t.leather);
    hangFromBelt(fit, tun, pouch, { th: -1.3, out: 0.02, drop: 0.02, forward: -0.2, bone: 'pelvis.R', name: 'slingPouch' });
  }
  if (kitName === 'sword') {
    const sword = makeSword(tier, t.leather, t.metal, t.wood);
    hangFromBelt(fit, tun, sword, { th: 1.45, out: 0.03, drop: 0.01, forward: 0.42, bone: 'pelvis.L', name: 'wardrobeSword' });
    outfit.props.sword = sword;
  }
  if (withShield) {
    // Saul's shield is carried by the armour-bearer (bible 3.2): round, 60-70 cm, dark oiled leather
    shield = makeShield(tier, t.leather, t.metal, t.wood, { radius: kitName === 'armourBearer' ? 0.33 : 0.25 + R() * 0.07, oval: R() < 0.2 && kitName !== 'armourBearer' ? 1.3 : 1, boss: kitName === 'armourBearer' ? 'leather' : R() < 0.5 ? 'bronze' : 'leather', seed });
    if (kitName === 'armourBearer') {
      shield.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh && (m.material as THREE.MeshStandardMaterial).color) {
          const mm = m.material as THREE.MeshPhysicalMaterial;
          if (mm.metalness < 0.5) {
            mm.color.set(0x5a3a22); // oiled hide, dark, with an oily sheen (Rashi 2 Sam 1:21)
            mm.roughness = 0.52; // an oily sheen, not a mirror (0.35 flashed white against the low sun in shot 7)
          }
        }
      });
    }
  }
  if (R() < 0.6 && !opts.crowd) sandals(fit, t.leather, { wraps: 1 + R(), height: 0.05 + R() * 0.04 });
  outfit.finish(t0);
  return { outfit, kit: kitName, main, off, shield };
}

export async function dressArmourBearer(human: HumanModel, opts: FilmDressOptions) {
  return dressSoldier(human, { ...opts, kit: 'armourBearer' });
}

// ================================================================================================ ELDERS
export async function dressElder(human: HumanModel, opts: FilmDressOptions): Promise<{ outfit: Outfit; staff: Prop | null }> {
  const t0 = performance.now();
  const tier = opts.quality;
  const seed = opts.seed ?? 1;
  const R = rng(seed * 6007 + 3);
  const t = await kit(tier, ['weave_medium', 'weave_coarse', 'weave_fine', 'fringe', 'leather', 'rope', 'wood', 'bark']);
  const fit = await beginFit(human, 'elder', tier, seed);
  const { lm, outfit } = fit;
  const S = lm.height / 1.75;
  const hipY = (lm.hip.L.y + lm.hip.R.y) / 2;
  outfit.capsules.push(...legCapsules(fit, 0.016, 0.06));
  const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const kut = fittedTunic(fit, { tex: t.weave_medium, tile: 0.12, dye: pick(WOOL_LIGHT), hem: 0.55 + 0.3 * R(), sleeve: 1.5 + 0.4 * R(), neck: 'slit', flare: 0.12, folds: 0.8, seed, name: 'kuttonet', fray: 0.15, dust: 0.5 });
  const rich = R() < 0.35;
  const mdye = pick([0xcdbf9f, 0xb9a887, 0x74644f, 0x5e5143, 0x3a332c, 0x8a8070]);
  const bandCol = pick([0x9a4a2c, 0xa7773a, TEKHELET]);
  const mantle = fittedTunic(fit, {
    tex: t.weave_coarse, tile: 0.11, dye: mdye, hem: 0.35 + 0.35 * R(), sleeve: 0, sleeveless: true, neck: 'round', offset: 0.012, ease: 0.014, flare: 0.16, folds: 1.8,
    seed: seed + 9, name: 'mantle', sideSlit: { top: hipY + 0.02, half: 0.24 }, hide: false, inner: [kut.restPos[0], kut.restPos[1]], fray: 0.2, sheen: 0.5, roughness: 0.95, dust: 0.6,
    armhole: { half: 0.55, top: lm.yArmpit + 0.012 + 0.07 }, shoulderFolds: 5,
    ...(rich ? { palette: [bandCol, 0x3b3128, 0, 0], bands: [{ from: 0.04, to: 0.07, motif: 0, pal: 0 }, { from: 0.074, to: 0.08, motif: 0, pal: 1 }] } : {}),
  });
  if (!opts.crowd) {
    const tm = tzitzitMats(tier, t.rope, t.fringe);
    tzitzit(fit, mantle.corners, { ...tm, length: 0.16 * S });
  }
  const hr = R();
  if (hr < 0.35) {
    const band = clothMaterial({ tier, tex: t.weave_medium, tile: 0.08, dye: pick([0x8e3f2c, 0x5a4632, 0xd9cba8]), hem: [0, 0.1, 0.01, 0], edgeMask: [0, 0], transmit: 0 });
    headRing(fit, { height: 0.022, thickness: 0.004, material: band, extra: 0.012 });
  } else if (hr < 0.7) {
    const cloth = clothMaterial({ tier, tex: t.weave_medium, tile: 0.1, dye: pick([0xe0d4b8, 0xc8b894, 0xa88f6c, 0x6a5b49]), hem: [0, 0.1, 0.01, 0], edgeMask: [0, 0], transmit: 0.3 });
    headRing(fit, { height: 0.06, thickness: 0.016, material: cloth, extra: 0.012, lift: 0.01, tilt: 0.012 });
  }
  sandals(fit, t.leather, { wraps: 1, height: 0.05 });
  const staff = R() < 0.55 ? makeStaff(tier, t.wood, t.bark, { length: 1.35 * S + R() * 0.15, gripAt: 1.0 * S, seed }) : null;
  if (staff) outfit.props.staff = staff;
  outfit.finish(t0);
  return { outfit, staff };
}

// ================================================================================================ PHILISTINES
export async function dressPhilistine(human: HumanModel, opts: FilmDressOptions & { rank?: 'elite' | 'rank' }): Promise<SoldierResult> {
  const t0 = performance.now();
  const tier = opts.quality;
  const seed = opts.seed ?? 1;
  const R = rng(seed * 3571 + 17);
  const elite = (opts.rank ?? (R() < 0.25 ? 'elite' : 'rank')) === 'elite';
  const t = await kit(tier, ['weave_fine', 'weave_medium', 'leather', 'metal', 'wood']);
  const fit = await beginFit(human, `philistine:${elite ? 'elite' : 'rank'}`, tier, seed);
  const { lm, outfit, body } = fit;
  const S = lm.height / 1.75;
  outfit.capsules.push(...legCapsules(fit, 0.014, 0.05));
  const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  // kilt / short tunic of linen with a tasselled hem band
  const tun = fittedTunic(fit, {
    tex: t.weave_fine, tile: 0.07, dye: pick([0xe2dac8, 0xd8ccb0, 0xcbb994]), hem: -0.6 - 0.2 * R(), sleeve: 0.3, neck: 'round', flare: 0.2, folds: 1, seed, name: 'kilt',
    fray: 0.1, dust: 0.6, fringe: !opts.crowd, palette: [pick([0x9a4a2c, 0x7c2b22, 0x2e3a5c]), 0, 0, 0], bands: [{ from: 0.0, to: 0.03, motif: 4, pal: 0 }],
  });
  if (elite) {
    const coat = fittedTunic(fit, { tex: t.leather, tile: 0.25, dye: 0x4a3322, hem: -1.5, sleeve: 0, sleeveless: true, neck: 'round', offset: 0.01, flare: 0.05, folds: 0.2, seed: seed + 3, name: 'corselet', hide: false, inner: tun.restPos, fray: 0, sheen: 0.25, roughness: 0.6, armhole: { half: 0.5, top: lm.yArmpit + 0.08 } });
    scaleArmour(fit, coat, { metal: t.metal, polish: 'field', seed, width: 0.04, length: 0.07, row: 0.048 });
    const [rx, rz] = human.metrics.crownRadius;
    const helm = makeHelmet(tier, t.metal, t.leather, { radius: [rx + 0.012, rz + 0.012], height: 0.14, ridge: true, polish: 'field', seed });
    helm.position.y = -0.03;
    human.sockets.crownAnchor.add(helm);
    outfit.add(helm);
    // greaves (17:6)
    for (const side of ['L', 'R'] as const) {
      const knee = body.joint(`lowerleg01.${side}`), ank = body.joint(`foot.${side}`);
      const g = makeGreave(tier, t.metal, { length: knee.distanceTo(ank) * 0.8, radius: 0.052 * S });
      const mid = knee.clone().lerp(ank, 0.45).add(new THREE.Vector3(0, 0, 0.004));
      const sock = human.addSocket(`greave${side}`, `lowerleg01.${side}`, mid, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), knee.clone().sub(ank).normalize()));
      sock.add(g);
      outfit.add(g);
    }
  } else {
    // ribbed corselet of horizontal leather bands (Medinet Habu)
    fittedTunic(fit, { tex: t.leather, tile: 0.2, dye: pick([0x6b4a30, 0x5a3e28, 0x7a5638]), hem: -1.6, sleeve: 0, sleeveless: true, neck: 'round', offset: 0.008, flare: 0.05, folds: 0.2, seed: seed + 3, name: 'corselet', hide: false, inner: tun.restPos, fray: 0, sheen: 0.3, roughness: 0.62, palette: [0x3a2618, 0, 0, 0], bands: [0.05, 0.11, 0.17, 0.23, 0.29].map((f) => ({ from: f, to: f + 0.012, motif: 0, pal: 0 })) });
    const [rx, rz] = human.metrics.crownRadius;
    const crown = makeFeatherCrown(tier, rx + 0.012, rz + 0.012, { seed });
    crown.position.y = -0.02;
    human.sockets.crownAnchor.add(crown);
    outfit.add(crown);
  }
  const beltMat = solidMaterial({ tier, tex: t.leather, color: 0x3d2a1c, roughness: 0.55, repeat: [1, 12] });
  beltBand(fit, tun, { width: 0.05 * S, thickness: 0.007, material: beltMat, offset: elite ? 0.012 : 0.008, name: 'belt' });
  const sword = makeSword(tier, t.leather, t.metal, t.wood, { blade: elite ? 0.75 : 0.6 });
  hangFromBelt(fit, tun, sword, { th: 1.45, out: elite ? 0.04 : 0.03, drop: 0.01, forward: 0.42, bone: 'pelvis.L', name: 'wardrobeSword' });
  outfit.props.sword = sword;
  const main = makeSpear(tier, t.wood, t.metal, t.leather, { length: 2.0 + 0.5 * R(), head: 0.28, gripAt: 1.1, seed });
  const shield = makeShield(tier, t.leather, t.metal, t.wood, { radius: 0.3 + 0.05 * R(), boss: 'bronze', seed });
  if (!opts.crowd) sandals(fit, t.leather, { wraps: 1.5, height: 0.08 });
  outfit.finish(t0);
  void TAU;
  return { outfit, kit: 'spear', main, off: null, shield };
}
