import * as THREE from 'three';
import type { HumanModel } from '../human/HumanModel';
import { C } from './body';
import { beginFit, beltBand, fittedTunic, headRing, legCapsules, limbRing, sandals, tzitzit } from './common';
import type { DressOptions } from './david';
import { clothMaterial, fringeMaterial, solidMaterial, texPair } from './materials';
import type { Outfit } from './Outfit';
import { makeSpear, makeSword } from './props';

/*
 * King Saul at Gibeah (docs/sources.md 3.2, 3.5, 4.3, 4.4):
 *   - kuttonet: fine long undertunic of bleached linen (sleeves to below the elbow, ankle length)
 *   - me'il: royal robe of deep murex-purple wool (argaman), cut as a long tabard open at the sides so that it has
 *     FOUR CORNERS (kanfei ha-me'il, 1 Sam 24:5) carrying tzitzit with a tekhelet thread (Num 15:38); woven scarlet
 *     (shani) lozenge band + tekhelet stripe at the hem, scarlet zigzag + sewn gold discs at the neck (2 Sam 1:24);
 *     geometric motifs only.  Wool only (the linen undertunic is a separate garment: no sha'atnez).
 *   - a wide scarlet sash with gold plaques; a straight sword in a leather scabbard with a bronze chape (left hip)
 *   - nezer: a thin gold diadem band (not a crown) at crown height; etz'adah: gold armlet on the left upper arm
 *     (2 Sam 1:10); leather sandals
 *   - props.spear: hanit with a leaf-shaped iron head and a butt-spike (1 Sam 26:7), ~2.5 m (NOT attached)
 */
export async function dressSaul(human: HumanModel, opts: DressOptions): Promise<Outfit> {
  const t0 = performance.now();
  const tier = opts.quality;
  const low = tier === 'low';
  const [fine, fringeT, leather, rope, metal, wood] = await Promise.all([
    texPair('weave_fine', tier), texPair('fringe', tier), texPair('leather', tier), texPair('rope', tier), texPair('metal', tier), texPair('wood', tier),
  ]);
  const fit = await beginFit(human, 'saul', tier, opts.seed ?? 3);
  const { lm, outfit } = fit;
  const S = lm.height / 1.75;
  const hipY = (lm.hip.L.y + lm.hip.R.y) / 2;
  outfit.capsules.push(...legCapsules(fit, 0.016, 0.06));
  const ARGAMAN = 0x4b1a45, SHANI = 0xa01c1c, TEKHELET = 0x2b3f8c, GOLD = 0xe2b25a, LINEN = 0xebe4d2;
  // ---- undertunic (linen)
  fittedTunic(fit, { tex: fine, tile: 0.07, dye: LINEN, hem: 0.9, sleeve: 1.28, neck: 'slit', ease: 0.006, flare: 0.1, folds: 0.7, seed: 3, name: 'kuttonet', fray: 0, sheen: 0.35, roughness: 0.78, dust: 0.3 });
  // ---- me'il: purple wool tabard, four corners
  const meil = fittedTunic(fit, {
    tex: fine, tile: 0.05, dye: ARGAMAN, hem: 0.52, sleeve: 0, sleeveless: true, neck: 'round', offset: 0.009, ease: 0.012, flare: 0.13, folds: 1.1,
    seed: 9, name: 'meil', sideSlit: { top: hipY - 0.03, half: 0.22 }, hide: false, fray: 0, sheen: 0.85, roughness: 0.72, dust: 0.25,
    palette: [SHANI, TEKHELET, GOLD, 0xd8c08a],
    bands: [
      { from: 0.0, to: 0.012, motif: 0, pal: 1 },
      { from: 0.018, to: 0.078, motif: 0, pal: 0 },
      { from: 0.022, to: 0.074, motif: 3, pal: 3 },
      { from: 0.086, to: 0.096, motif: 0, pal: 1 },
      { from: 0.104, to: 0.126, motif: 5, pal: 2 },
    ],
    neckBands: [
      { from: 0.0, to: 0.016, motif: 5, pal: 2, edge: 'upper' },
      { from: 0.018, to: 0.052, motif: 0, pal: 0, edge: 'upper' },
      { from: 0.022, to: 0.048, motif: 2, pal: 3, edge: 'upper' },
      { from: 0.056, to: 0.064, motif: 0, pal: 1, edge: 'upper' },
    ],
  });
  // ---- sash (scarlet) with gold plaques, sword at the left hip
  const sashMat = clothMaterial({ tier, tex: fine, tile: 0.05, dye: SHANI, roughness: 0.75, sheen: 0.7, hem: [0, 0.1, 0.01, 0], edgeMask: [0, 0], transmit: 0.2 });
  beltBand(fit, meil, { width: 0.075 * S, thickness: 0.007, material: sashMat, offset: 0.004, name: 'sash' });
  const gold = solidMaterial({ tier, tex: metal, color: GOLD, roughness: 0.28, metalness: 1, repeat: [2, 2], metalWear: { patina: 0x7a5424, amount: 0.25, edgeBright: 0.9 } });
  const plaqueGeo = new THREE.BoxGeometry(0.03, 0.045, 0.004);
  for (const th of [-0.5, -0.25, 0, 0.25, 0.5]) {
    const r = meil.upper.R(meil.beltY, th) + 0.013;
    const p = meil.upper.field.point(meil.beltY, th, r);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), th);
    const sock = human.addSocket(`wardrobePlaque${th}`, 'spine05', p, q);
    const m = new THREE.Mesh(plaqueGeo, gold);
    m.castShadow = true;
    sock.add(m);
    outfit.add(m);
  }
  const sword = makeSword(tier, leather, metal, wood, { gold: true });
  {
    const th = 1.35;
    const p = meil.upper.field.point(meil.beltY - 0.01, th, meil.upper.R(meil.beltY, th) + 0.035);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, th, 0.12, 'YXZ'));
    const sock = human.addSocket('wardrobeSword', 'pelvis.L', p, q);
    sock.add(sword);
    outfit.add(sword);
    outfit.props.sword = sword;
  }
  // ---- tzitzit on the four corners of the me'il
  const white = solidMaterial({ tier, tex: rope, color: 0xefe9dc, roughness: 0.9, repeat: [1, 1 / 0.012] });
  const blue = solidMaterial({ tier, tex: rope, color: TEKHELET, roughness: 0.85, repeat: [1, 1 / 0.012] });
  const fr = fringeMaterial({ tier, tex: fringeT, dye: 0xf1ece0, width: 0.02 });
  tzitzit(fit, meil.corners, { white, blue, fringe: fr, length: 0.15 * S });
  // ---- nezer (diadem) + etz'adah (armlet)
  const ring = headRing(fit, { height: 0.017, thickness: 0.0022, material: gold, extra: 0.01, tilt: 0.008 });
  {
    // a lozenge plaque at the front of the band
    const lz = new THREE.CylinderGeometry(0.014, 0.014, 0.003, 4, 1);
    lz.rotateX(Math.PI / 2);
    lz.scale(1, 1.25, 1);
    const m = new THREE.Mesh(lz, gold);
    m.position.set(0, -0.008 * 0.5, ring.rz + 0.0012);
    m.castShadow = true;
    human.sockets.crownAnchor.add(m);
    outfit.add(m);
  }
  limbRing(fit, { side: 'L', from: 'upperarm01', to: 'lowerarm01', t: 0.5, bone: 'upperarm02.L', mask: C.UPARM_L, width: 0.032, thickness: 0.0035, clearance: 0.012, material: gold, ridges: low ? 0 : 3 });
  // ---- sandals + spear
  sandals(fit, leather, { wraps: 1.25, height: 0.06 });
  outfit.props.spear = makeSpear(tier, wood, metal, leather, { length: 2.5, head: 0.32, gripAt: 1.3, bronzeButt: true });
  outfit.finish(t0);
  return outfit;
}
