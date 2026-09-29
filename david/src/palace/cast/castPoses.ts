import { pose, type Pose } from '../../characters/Rig';

/*
 * Body poses of the court (DavidModel / HumanModel proxy conventions: the character faces +Z, its left is +X;
 * rotation.x < 0 swings a limb forward; left arm z > 0 = out, right arm z < 0 = out; + shin bends the knee;
 * hipsY / hipsZ offset the pelvis). Hands holding a spear are re-aimed at run time by CastActor's grip solver, so
 * the hd* values here are only the starting orientation.
 *
 * Seated poses put the thighs forward (-1.5 rad): the actor's root is lowered so the pelvis rests on the seat
 * (CastActor.sitOn), shins hang to the ground / footstool.
 */

export type CastPoseName =
  | 'kingSeatedSpear' | 'kingSeatedBrood' | 'kingStandSpear'
  | 'guardSpearShield' | 'guardAtEase' | 'runnerSpear'
  | 'servantJug' | 'servantBowl' | 'servantHands'
  | 'bearer' | 'archer' | 'slinger'
  | 'abnerStand' | 'wallGuard';

export const CAST_POSES: Record<CastPoseName, Pose> = {
  // the king enthroned (1 Sam 22:6): upright, broad, chin slightly lowered; the spear upright in the right hand,
  // planted outside the right foot; the left forearm on the thigh, hand relaxed over the knee
  kingSeatedSpear: pose({
    hips: [0, 0, 0], spine: [-0.03, 0, 0], chest: [-0.05, 0.02, 0], neck: [0.05, -0.02, 0], head: [0.09, 0.05, 0.0],
    thL: [-1.42, 0.1, 0.16], shinL: [1.3, 0, 0], ftL: [0.12, -0.08, 0],
    thR: [-1.38, -0.12, -0.2], shinR: [1.15, 0, 0], ftR: [0.2, 0.1, 0],
    uaR: [-0.52, 0.18, -0.3], faR: [-1.32, 0, 0], hdR: [0.1, 0.35, -0.2],
    uaL: [-0.36, 0, 0.14], faL: [-0.8, 0.25, 0], hdL: [0.35, 0, -0.1],
  }),
  // alone in the hall at evening: the same seat, the weight of Samuel's words (15:28, 15:35): shoulders a little
  // forward, forearms on the thighs, head lowered, the left hand holding the torn corner of a robe on the knee
  kingSeatedBrood: pose({
    hips: [0.06, 0, 0], spine: [0.1, 0, 0], chest: [0.1, -0.03, 0], neck: [0.14, 0, 0], head: [0.2, -0.1, -0.04],
    thL: [-1.46, 0.08, 0.18], shinL: [1.3, 0, 0], ftL: [0.15, -0.05, 0],
    thR: [-1.4, -0.1, -0.2], shinR: [1.18, 0, 0], ftR: [0.2, 0.08, 0],
    uaR: [-0.52, 0.2, -0.22], faR: [-0.95, 0.35, 0], hdR: [0.25, 0.4, 0.2],
    uaL: [-0.42, 0.05, 0.3], faL: [-1.05, 0.1, 0], hdL: [0.25, -0.2, 0.1],
  }),
  // standing among his men, the spear grounded at his right side (portrait): a head and shoulders above all (9:2)
  kingStandSpear: pose({
    hips: [0, 0.06, 0.012], spine: [-0.02, 0, 0], chest: [-0.05, -0.04, 0], neck: [0.02, 0, 0], head: [0.08, 0.1, 0],
    uaR: [-0.3, 0.08, -0.36], faR: [-1.2, 0, 0], hdR: [0.05, 0.3, -0.2],
    uaL: [0.04, 0, 0.12], faL: [-0.35, 0.3, 0], hdL: [0.1, 0.2, 0.05],
    thL: [-0.03, 0, 0.07], shinL: [0.04, 0, 0], ftL: [0.02, 0, 0],
    thR: [0.06, 0, -0.09], shinR: [0.08, 0, 0], ftR: [-0.06, 0.1, 0],
  }),
  // runner / guard: spear upright in the right hand, shield on the left forearm
  guardSpearShield: pose({
    hips: [0, -0.04, -0.015], chest: [-0.02, 0.03, 0], head: [0.02, -0.04, 0],
    uaR: [-0.28, 0.1, -0.3], faR: [-1.1, 0, 0], hdR: [0.05, 0.3, -0.2],
    uaL: [0.02, 0, 0.17], faL: [-0.32, 0, 0], hdL: [0.0, 0.0, 0.0],
    thL: [0.04, 0, 0.08], shinL: [0.05, 0, 0], thR: [-0.03, 0, -0.07], shinR: [0.03, 0, 0], ftR: [0.03, -0.12, 0],
  }),
  guardAtEase: pose({
    hips: [0, 0.05, 0.015], chest: [-0.01, -0.03, 0], head: [0.03, 0.05, 0],
    uaR: [-0.26, 0.1, -0.3], faR: [-1.05, 0, 0], hdR: [0.05, 0.3, -0.2],
    uaL: [0.05, 0, 0.1], faL: [-0.25, 0.2, 0], hdL: [0.1, 0, 0],
    thL: [-0.04, 0, 0.06], shinL: [0.05, 0, 0], thR: [0.06, 0, -0.08], shinR: [0.1, 0, 0], ftR: [-0.06, 0.12, 0],
  }),
  runnerSpear: pose({
    hips: [0, 0.03, 0.01], chest: [-0.02, 0, 0], head: [0.02, 0.02, 0],
    uaR: [-0.25, 0.1, -0.28], faR: [-1.1, 0, 0], hdR: [0.05, 0.3, -0.2],
    uaL: [0.02, 0, 0.1], faL: [-0.18, 0, 0], hdL: [0.05, 0, 0],
    thL: [-0.03, 0, 0.06], shinL: [0.04, 0, 0], thR: [0.04, 0, -0.06], shinR: [0.07, 0, 0],
  }),
  // servants standing about the king (22:6): a jug held against the chest / a bowl in both hands / hands folded
  servantJug: pose({
    hips: [0, 0.03, 0], spine: [0.02, 0, 0], chest: [0.03, 0, 0], head: [0.1, 0, 0],
    uaR: [-0.3, 0.2, -0.12], faR: [-1.45, 0.3, 0], hdR: [0.25, 0.8, 0.2],
    uaL: [-0.22, -0.1, 0.1], faL: [-1.35, -0.4, 0], hdL: [0.1, -0.5, 0],
    thL: [-0.02, 0, 0.05], shinL: [0.04, 0, 0], thR: [0.03, 0, -0.05], shinR: [0.05, 0, 0],
  }),
  servantBowl: pose({
    hips: [0, -0.02, 0], spine: [0.03, 0, 0], chest: [0.04, 0, 0], head: [0.14, 0, 0],
    uaR: [-0.3, 0.1, -0.14], faR: [-1.3, 0.55, 0], hdR: [-0.2, 0.3, 0.6],
    uaL: [-0.3, -0.1, 0.14], faL: [-1.3, -0.55, 0], hdL: [-0.2, -0.3, -0.6],
    thL: [-0.02, 0, 0.05], shinL: [0.04, 0, 0], thR: [0.03, 0, -0.05], shinR: [0.05, 0, 0],
  }),
  servantHands: pose({
    hips: [0, 0.02, 0], spine: [0.03, 0, 0], chest: [0.05, 0, 0], head: [0.16, 0.03, 0],
    uaR: [-0.18, 0.2, -0.05], faR: [-0.95, 0.9, 0], hdR: [0.0, 0.2, 0.1],
    uaL: [-0.18, -0.2, 0.05], faL: [-0.95, -0.9, 0], hdL: [0.0, -0.2, -0.1],
    thL: [-0.02, 0, 0.05], shinL: [0.03, 0, 0], thR: [0.02, 0, -0.05], shinR: [0.04, 0, 0],
  }),
  // the young armour-bearer (14:1) at the king's shoulder, holding the king's shield
  bearer: pose({
    hips: [0, -0.03, 0], chest: [-0.02, 0, 0], head: [0.06, -0.1, 0],
    uaR: [-0.1, 0, -0.1], faR: [-0.4, 0, 0], hdR: [0.05, 0, 0],
    uaL: [0.02, 0, 0.17], faL: [-0.3, 0, 0], hdL: [0.0, 0.0, 0.0],
    thL: [0.03, 0, 0.06], shinL: [0.04, 0, 0], thR: [-0.02, 0, -0.06], shinR: [0.03, 0, 0],
  }),
  // Benjaminite archer (1 Chr 12:2): strung bow lowered in the left hand, quiver on the back
  archer: pose({
    hips: [0, 0.05, 0.01], chest: [-0.02, -0.04, 0], head: [0.03, 0.05, 0],
    uaL: [-0.22, 0, 0.18], faL: [-0.35, 0, 0], hdL: [0.0, 0.0, 0.2],
    uaR: [0.02, 0, -0.12], faR: [-0.3, 0, 0], hdR: [0.05, 0, 0],
    thL: [-0.03, 0, 0.07], shinL: [0.04, 0, 0], thR: [0.05, 0, -0.08], shinR: [0.08, 0, 0], ftR: [-0.04, 0.12, 0],
  }),
  // slinger (Judg 20:16): the sling hanging from the right hand, stones in the left
  slinger: pose({
    hips: [0, -0.05, 0], chest: [-0.02, 0.04, 0], head: [0.02, -0.05, 0],
    uaR: [0.05, 0, -0.14], faR: [-0.25, 0, 0], hdR: [0.0, 0, 0],
    uaL: [-0.2, 0, 0.12], faL: [-1.1, 0, 0], hdL: [0.2, 0, 0],
    thL: [0.05, 0, 0.08], shinL: [0.06, 0, 0], thR: [-0.03, 0, -0.07], shinR: [0.03, 0, 0],
  }),
  // Abner son of Ner, commander (14:50): standing square, left hand on the sword hilt, spear in the right
  abnerStand: pose({
    hips: [0, 0.04, 0.01], spine: [-0.02, 0, 0], chest: [-0.04, 0.03, 0], head: [0.03, 0, 0],
    uaR: [-0.26, 0.1, -0.3], faR: [-1.08, 0, 0], hdR: [0.05, 0.3, -0.2],
    uaL: [0.15, -0.1, 0.26], faL: [-1.05, -0.35, 0], hdL: [0.2, -0.3, 0.2],
    thL: [-0.03, 0, 0.07], shinL: [0.04, 0, 0], thR: [0.05, 0, -0.08], shinR: [0.06, 0, 0],
  }),
  // a guard on the wall-walk, leaning on his spear, looking out
  wallGuard: pose({
    hips: [0, 0.08, 0.02], chest: [0.02, -0.05, 0], head: [0.05, -0.1, 0],
    uaR: [-0.4, 0.1, -0.25], faR: [-1.2, 0, 0], hdR: [0.05, 0.3, -0.2],
    uaL: [0.05, 0, 0.1], faL: [-0.3, 0, 0], hdL: [0.1, 0, 0],
    thL: [-0.05, 0, 0.06], shinL: [0.06, 0, 0], thR: [0.08, 0, -0.08], shinR: [0.12, 0, 0],
  }),
};

/** A slow walk cycle (Abner inspecting the line): phase in radians, ~1.1 s per step pair at 0.75 m/s. */
export function walkPose(ph: number, out?: Pose): Pose {
  const s = Math.sin(ph), c = Math.cos(ph), A = 0.36;
  const kneeL = Math.max(0, c) * 0.75 + 0.1, kneeR = Math.max(0, -c) * 0.75 + 0.1;
  const p = out ?? pose({});
  const r = p.r;
  const set = (k: string, x: number, y: number, z: number) => {
    const e = r[k] ?? (r[k] = [0, 0, 0]);
    e[0] = x; e[1] = y; e[2] = z;
  };
  set('thL', -s * A, 0, 0.03);
  set('shinL', kneeL, 0, 0);
  set('ftL', -(-s * A + kneeL) * 0.5 + Math.max(0, -s) * 0.2, 0, 0);
  set('thR', s * A, 0, -0.03);
  set('shinR', kneeR, 0, 0);
  set('ftR', -(s * A + kneeR) * 0.5 + Math.max(0, s) * 0.2, 0, 0);
  set('hips', 0, s * 0.07, 0);
  set('spine', 0.02, -s * 0.04, 0);
  set('chest', -0.03, -s * 0.07, 0);
  set('uaL', 0.15, -0.1, 0.26);
  set('faL', -1.05, -0.35, 0);
  set('hdL', 0.2, -0.3, 0.2);
  set('uaR', -0.26 - s * 0.05, 0.1, -0.3);
  set('faR', -1.08, 0, 0);
  set('hdR', 0.05, 0.3, -0.2);
  p.hipsY = -Math.abs(c) * 0.018;
  p.hipsZ = 0;
  return p;
}
