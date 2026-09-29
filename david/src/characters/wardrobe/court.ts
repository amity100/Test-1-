import * as THREE from 'three';
import type { HumanModel } from '../human/HumanModel';
import { beginFit, beltBand, fittedTunic, hangFromBelt, headRing, legCapsules, sandals } from './common';
import { rng } from './loft';
import { clothMaterial, solidMaterial, texPair, type Tier } from './materials';
import type { Outfit } from './Outfit';
import { makeDagger, makeShield, makeSpear, makeSword } from './props';

/*
 * Men of Saul's court (seedable; docs/sources.md 3.4, 4.3, 4.4):
 *   guard / runner (ratsim, 1 Sam 22:17): knee-length wool tunic in natural / earthy dyes (undyed, brown, madder,
 *     ochre, olive-grey), leather belt, some with a leather jerkin, some with a headband; spear, round or oval
 *     leather shield (magen, oiled: 2 Sam 1:21) for guards, dagger in the belt.
 *   servant: plain undyed tunic, cloth sash, wrapped headcloth.
 *   abner (Abner son of Ner, commander of the army, 14:50): a finer madder-red tunic with woven tekhelet / ochre
 *     bands, sword belt with sword, spear.  Metal is scarce (13:19-22): only officers carry swords.
 * No Roman / medieval elements: no plate, no chain mail, no kite shields, no cloaks with brooches.
 */
export type CourtRole = 'guard' | 'runner' | 'servant' | 'abner';

const DYES = [0xd9cba8, 0x8a6a48, 0x8e3f2c, 0xb48a4a, 0x8c8668, 0xc9b58f, 0x6e5238];

export async function dressMan(human: HumanModel, opts: { quality: Tier; role: CourtRole; seed: number }): Promise<Outfit> {
  const t0 = performance.now();
  const tier = opts.quality;
  const role = opts.role;
  const r = rng(opts.seed * 7919 + 13);
  const [medium, fine, leather, metal, wood] = await Promise.all([
    texPair('weave_medium', tier), texPair('weave_fine', tier), texPair('leather', tier), texPair('metal', tier), texPair('wood', tier),
  ]);
  const fit = await beginFit(human, `court:${role}`, tier, opts.seed);
  const { lm, outfit } = fit;
  const S = lm.height / 1.75;
  outfit.capsules.push(...legCapsules(fit, 0.014, 0.05));
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const leatherBelt = solidMaterial({ tier, tex: leather, color: pick([0x4a2f1d, 0x5a3a22, 0x3d2a1c]), roughness: 0.6, repeat: [1, 12], normal: 1.2 });
  if (role === 'abner') {
    const t = fittedTunic(fit, {
      tex: fine, tile: 0.06, dye: 0x7c2b22, hem: -0.05, sleeve: 0.62, neck: 'slit', flare: 0.14, folds: 1, seed: opts.seed, name: 'tunic', fray: 0,
      sheen: 0.7, roughness: 0.78, palette: [0x2b3f8c, 0xc39a52, 0xe0d2b0, 0x000000],
      bands: [{ from: 0.0, to: 0.01, motif: 0, pal: 0 }, { from: 0.016, to: 0.05, motif: 1, pal: 1 }, { from: 0.056, to: 0.064, motif: 0, pal: 0 }],
      neckBands: [{ from: 0.0, to: 0.02, motif: 0, pal: 1, edge: 'upper' }],
      sleeveBands: [{ from: 0.0, to: 0.018, motif: 0, pal: 1 }],
    });
    beltBand(fit, t, { width: 0.055 * S, thickness: 0.006, material: leatherBelt, name: 'swordBelt' });
    const sword = makeSword(tier, leather, metal, wood);
    hangFromBelt(fit, t, sword, { th: 1.45, out: 0.026, drop: 0.01, forward: 0.42, bone: 'pelvis.L', name: 'wardrobeSword' });
    outfit.props.sword = sword;
    outfit.props.spear = makeSpear(tier, wood, metal, leather, { length: 2.3, head: 0.28, gripAt: 1.2 });
    const band = clothMaterial({ tier, tex: fine, tile: 0.05, dye: 0x2b3f8c, hem: [0, 0.1, 0.01, 0], edgeMask: [0, 0], transmit: 0 });
    headRing(fit, { height: 0.022, thickness: 0.004, material: band, extra: 0.011 });
  } else if (role === 'servant') {
    const t = fittedTunic(fit, { tex: medium, tile: 0.14, dye: pick([0xd9cba8, 0xc9b58f, 0xbfa888]), hem: 0.05 + r() * 0.15, sleeve: 0.55, neck: 'slit', flare: 0.15, seed: opts.seed, name: 'tunic', fray: 0.45, fringe: r() < 0.5, dust: 0.6 });
    const sash = clothMaterial({ tier, tex: medium, tile: 0.1, dye: pick([0x8a6a48, 0x9a5a3a, 0x7a7058]), hem: [0, 0.1, 0.01, 0], edgeMask: [0, 0], transmit: 0 });
    beltBand(fit, t, { width: 0.06 * S, thickness: 0.008, material: sash, name: 'sash' });
    const cloth = clothMaterial({ tier, tex: medium, tile: 0.1, dye: pick([0xe0d4b8, 0xc8b894, 0xa88f6c]), hem: [0, 0.1, 0.01, 0], edgeMask: [0, 0], transmit: 0.3 });
    headRing(fit, { height: 0.05, thickness: 0.012, material: cloth, extra: 0.012, lift: 0.006, tilt: 0.012 });
  } else {
    const runner = role === 'runner';
    const t = fittedTunic(fit, {
      tex: medium, tile: 0.14, dye: pick(DYES), hem: runner ? -0.25 : -0.1 + r() * 0.12, sleeve: 0.5 + r() * 0.1, neck: 'slit', flare: runner ? 0.1 : 0.14,
      seed: opts.seed, name: 'tunic', fray: 0.3, dust: 0.5,
    });
    beltBand(fit, t, { width: 0.045 * S, thickness: 0.006, material: leatherBelt, name: 'belt' });
    if (!runner && r() < 0.6) {
      // sleeveless leather jerkin over the tunic, ending at the hips
      fittedTunic(fit, { tex: leather, tile: 0.3, dye: pick([0x6b4a30, 0x5a3e28, 0x7a5638]), hem: -1.6, sleeve: 0, sleeveless: true, neck: 'round', offset: 0.007, flare: 0.05, folds: 0.3, seed: opts.seed + 3, name: 'jerkin', hide: false, fray: 0, sheen: 0.3, roughness: 0.62, inner: t.restPos });
    }
    if (r() < 0.65) {
      const band = clothMaterial({ tier, tex: medium, tile: 0.08, dye: pick([0x8e3f2c, 0x5a4632, 0xd9cba8, 0x2e3a5c]), hem: [0, 0.1, 0.01, 0], edgeMask: [0, 0], transmit: 0 });
      headRing(fit, { height: 0.02, thickness: 0.004, material: band, extra: 0.011 });
    }
    outfit.props.spear = makeSpear(tier, wood, metal, leather, { length: runner ? 1.9 : 2.2, head: 0.24, gripAt: 1.1, seed: opts.seed });
    if (!runner) outfit.props.shield = makeShield(tier, leather, metal, wood, { radius: 0.28 + r() * 0.05, oval: r() < 0.35 ? 1.3 : 1, boss: r() < 0.5 ? 'bronze' : 'leather', seed: opts.seed });
    const dagger = makeDagger(tier, leather, metal, wood);
    hangFromBelt(fit, t, dagger, { th: -1.0, out: 0.02, drop: 0.005, forward: -0.3, bone: 'pelvis.R', name: 'wardrobeDagger' });
    outfit.props.dagger = dagger;
  }
  sandals(fit, leather, { wraps: 1 + r(), height: 0.05 + r() * 0.04 });
  outfit.finish(t0);
  return outfit;
}
