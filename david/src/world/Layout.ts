// Geography of Chapter 1 — the hills east of Bethlehem of Judah (בֵּית לֶחֶם יְהוּדָה).
// Units are meters. +X = east, -Z = north, +Y = up.
// Morning: the sun rises over the mountains of Moab in the east (+X) and lights the pastures,
// which lie on the eastern slopes of the Bethlehem ridge.
//
// Real-world orientation that this compresses: Bethlehem sits on a limestone ridge
// (~775 m) of the Judean hills; to its east the land falls away through terraced
// slopes and shepherds' pastures into the Judean desert, the Dead Sea (~-430 m)
// and, beyond it, the mountains of Moab. A wadi (נַחַל) drains the pastures.
// Rachel's pillar stands on the road just north of the town (Genesis 35:19-20).

export type P2 = [number, number];

export const LAYOUT = {
  start: { x: 0, z: 0 },
  bethlehem: { x: -260, z: -330, r: 78 },
  // Dry stream bed south of the pasture (the "נַחַל" of smooth stones)
  wadi: [
    [-430, 170], [-300, 118], [-170, 100], [-60, 104], [30, 122], [120, 150], [230, 196], [330, 262], [440, 330],
  ] as P2[],
  // Shepherds' footpath from the pasture up to the town gate
  path: [
    [4, 8], [-18, -40], [-52, -96], [-96, -150], [-140, -196], [-176, -236], [-206, -270], [-226, -296],
  ] as P2[],
  pasture: { x: 22, z: 46, r: 20 },
  targets: { x: -54, z: 92 }, // the middle of the sling range: trees, bushes and boulders keep clear, the slope stays smooth
  // (play1, gameplay v2 §3) the sling range in the wadi: David's throwing mark on the north bank, facing the wadi
  // (+Z, south): the warm-up wall at 12-16 m, the far bank at 22-35 m, the terebinth at ≈19 m
  range: { x: -50, z: 79, facing: -0.3 },
  stones: { x: -32, z: 104 }, // smooth stones in the wadi bed
  thicket: { x: 150, z: -10, r: 36 }, // oak / terebinth thicket where the bear lurks
  bearLair: { x: 200, z: -50 },
  rachel: { x: -150, z: -198 }, // מַצֶּבֶת קְבֻרַת רָחֵל
  threshing: { x: -176, z: -262 }, // threshing floor (גֹּרֶן) outside the town
  playRadius: 330,
};

export const SUN = { elevation: 13, azimuth: 100, endElevation: 17 };

export const NEAR_HALF = 420; // detailed terrain covers [-NEAR_HALF, NEAR_HALF]^2
export const FAR_HALF = 9500;
