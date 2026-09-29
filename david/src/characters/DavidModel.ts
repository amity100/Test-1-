import * as THREE from 'three';
import { clamp, damp } from '../core/noise';
import { shared } from '../core/Shared';
import type { TextureSet } from '../world/Textures';
import { Clip, PoseMixer, pose, type Pose, type E3, UPPER_L, UPPER_R, TORSO, LEGS } from './Rig';
import { Rope } from './Rope';
import { HumanModel, type HumanQuality } from './human/HumanModel';
import type { Expression, FingerPose } from './human/HumanRig';
import { createGroom, type Groom } from './hair';
import { dressDavid, attachProp, type Outfit, type Prop } from './wardrobe';

/*
 * Young David — "וְהוּא אַדְמוֹנִי עִם־יְפֵה עֵינַיִם וְטוֹב רֹאִי" (1 Sam 16:12): ruddy, with beautiful eyes, handsome;
 * a na'ar who has already killed a lion and a bear (17:34-36). His shepherd's things are those of 17:40: the staff
 * (מַקְלוֹ), the shepherd's bag (כְּלִי הָרֹעִים / יַלְקוּט) with five smooth stones, and the sling (קַלְּעוֹ).
 *
 * The realistic human (MakeHuman CC0 body, src/characters/human) + strand hair (src/characters/hair) + the fitted
 * costume and props (src/characters/wardrobe), animated procedurally:
 *   - base / hero idle with breathing, weight shifts and glances;
 *   - walk & run from foot trajectories (heel strike, roll, toe-off, swing) solved with two-bone IK on the terrain,
 *     pelvis drop from leg reach, pelvis yaw / list / lateral shift, counter-rotating chest, arm swing, head
 *     stabilisation, lean into turns;
 *   - keyed actions (sling throw, staff strikes, stone pick, call, dodge, hurt) and holds (whirl, beard grab, lamb
 *     carry, pull, kneel, thanks, hero) with arm IK where hands must touch something (staff planted on the ground,
 *     hand cupped at the mouth, hand on the chest, the bear's beard, the lamb's legs);
 *   - staff held by solving the wrist so the staff follows an animated direction; it slides in the hand for strikes
 *     (held near the butt, the long end striking) and goes across the back while both hands are busy;
 *   - a simulated sling: two braided cords (verlet, leg-capsule collisions) ending in the leather pouch, with the
 *     stone visible while loaded; whirl, whip-release of one cord, recovery and reload from the satchel.
 *
 * Gameplay handedness: sling in the RIGHT hand, staff in the LEFT (the reference image has it mirrored; the 'hero'
 * hold is the reference stance mirrored). Character faces +Z, its left is +X (same joint conventions as before).
 *
 * Loading is async: `await DavidModel.preload(engine.quality.name, { msaa })` during boot, then `new DavidModel()`.
 */

export type HoldPose = 'none' | 'spin' | 'grab' | 'carry' | 'kneel' | 'thanks' | 'pull' | 'hero';
export type StaffMode = 'plant' | 'strike' | 'back';
export type ActionName = 'throw' | 'strike' | 'strikeHigh' | 'pick' | 'call' | 'dodge' | 'hurt';

export interface DavidParts {
  human: HumanModel;
  groom: Groom | null;
  outfit: Outfit;
  quality: HumanQuality;
  loadMs: { human: number; outfit: number; groom: number; total: number };
}

// channels (not joints) blended by the pose mixer
const CHANNELS = ['staff', 'staffW', 'butt', 'plantW', 'hipsX'] as const;

const E = (x: number, y = 0, z = 0): E3 => [x, y, z];

// ------------------------------------------------------------------------------------------ poses
// DavidModel joint conventions: rotation.x < 0 swings a limb forward (spine/head: + leans forward / nods down),
// left arm z > 0 = out, right arm z < 0 = out, + shin bends the knee, - foot = toes up, + y turns to the left.

/** calm stance: weight on the left leg, staff planted at the left, sling hanging from the right hand */
const IDLE = pose({
  hips: E(0.02, 0.04, 0.035), hipsX: E(0.028),
  spine: E(0.02, -0.02, -0.03), chest: E(-0.03, -0.03, -0.01), neck: E(0.03), head: E(-0.02, 0.02, 0.0),
  uaL: E(-0.2, 0, 0.4), faL: E(-1.3), hdL: E(0),
  uaR: E(0.02, 0, -0.1), faR: E(-0.55, 0.15, 0), hdR: E(0.15, 0, 0.05),
  thL: E(-0.03, 0, 0.0), shinL: E(0.04), ftL: E(0.0),
  thR: E(0.05, 0.1, -0.08), shinR: E(0.16), ftR: E(-0.08, 0.1, 0),
  staff: E(-0.06, 1, 0.02), staffW: E(1), butt: E(0.4, 0, 0.18), plantW: E(1),
}, -0.012);

/** the reference still, mirrored: staff planted out to the left at chest height, weight on the left leg,
 *  right foot forward and turned out, chest open, head turned to his right, gaze on the horizon */
const HERO = pose({
  hips: E(0.0, 0.1, 0.05), hipsX: E(0.035),
  spine: E(-0.02, -0.06, -0.04), chest: E(-0.07, -0.08, -0.02), neck: E(-0.02, -0.22, 0.0), head: E(-0.1, -0.3, 0.04),
  uaL: E(-0.1, 0, 0.55), faL: E(-1.2), hdL: E(0),
  uaR: E(0.02, 0, -0.14), faR: E(-0.5, 0.15, 0), hdR: E(0.2, 0, 0.1),
  thL: E(0.02, 0, 0.02), shinL: E(0.02), ftL: E(0.0, -0.05, 0),
  thR: E(-0.2, -0.25, -0.1), shinR: E(0.14), ftR: E(0.1, -0.2, 0),
  staff: E(-0.12, 1, -0.02), staffW: E(1), butt: E(0.52, 0, 0.12), plantW: E(1),
}, -0.015);

/** sling whirl above the head, body coiled, side-on stance, staff held forward-left for balance */
const SPIN = pose({
  hips: E(0.04, -0.18, 0), hipsX: E(-0.02),
  spine: E(0.02, -0.14, 0.04), chest: E(0.0, -0.28, 0.05), neck: E(0, 0.14, 0), head: E(0.02, 0.34, -0.04),
  uaR: E(-2.25, 0, -0.62), faR: E(-1.3), hdR: E(0.2, 0, 0),
  uaL: E(-0.6, 0, 0.45), faL: E(-1.0), hdL: E(0),
  thL: E(-0.28, 0.1, 0.1), shinL: E(0.22), ftL: E(0.06),
  thR: E(0.22, -0.2, -0.1), shinR: E(0.16), ftR: E(-0.22, -0.1, 0),
  staff: E(0.12, 1, 0.3), staffW: E(1), plantW: E(0),
}, -0.035);

/** key helper: joints not given take the calm-stance values; the staff is held (not planted) unless given */
function full(r: Record<string, E3>, hipsY = -0.012, hipsZ = 0): Pose {
  return pose({ ...IDLE.r, plantW: E(0), ...r }, hipsY, hipsZ);
}

const THROW = new Clip([
  { t: 0, p: SPIN },
  // extra wind-up: arm drops back, shoulders coil further
  { t: 0.09, e: 'in', p: pose({
    hips: E(0.04, -0.28, 0), spine: E(-0.02, -0.2, 0.05), chest: E(-0.06, -0.42, 0.06), neck: E(0, 0.2, 0), head: E(0.02, 0.42, -0.04),
    uaR: E(-2.35, 0.25, -0.95), faR: E(-0.75), hdR: E(0.35),
    uaL: E(-0.95, 0, 0.35), faL: E(-0.7),
    thL: E(-0.3, 0.1, 0.1), shinL: E(0.25), thR: E(0.25, -0.2, -0.1), shinR: E(0.2), ftR: E(-0.25),
    staff: E(0.25, 0.7, 0.65), staffW: E(1), plantW: E(0),
  }, -0.04) },
  // release: hips and chest uncoil toward the target, the arm whips over, weight onto the front foot
  { t: 0.19, e: 'out', p: pose({
    hips: E(0.1, 0.22, 0), spine: E(0.1, 0.18, -0.02), chest: E(0.14, 0.32, -0.04), neck: E(0.02, -0.12, 0), head: E(0.0, -0.3, 0.03),
    uaR: E(-1.95, 0, -0.35), faR: E(-0.2), hdR: E(-0.2),
    uaL: E(-0.45, 0, 0.55), faL: E(-0.8),
    thL: E(-0.42, 0.05, 0.08), shinL: E(0.38), ftL: E(0.08), thR: E(0.38, -0.1, -0.1), shinR: E(0.24), ftR: E(-0.45),
    staff: E(0.45, 0.6, 0.35), staffW: E(1), plantW: E(0),
  }, -0.06, 0.05) },
  // follow-through across the body
  { t: 0.36, p: pose({
    hips: E(0.14, 0.3, 0), spine: E(0.18, 0.24, -0.03), chest: E(0.22, 0.42, -0.06), neck: E(0.02, -0.18, 0), head: E(-0.02, -0.38, 0.03),
    uaR: E(-0.75, 0, 0.12), faR: E(-0.55), hdR: E(0.1),
    uaL: E(-0.35, 0, 0.5), faL: E(-0.9),
    thL: E(-0.45, 0.05, 0.08), shinL: E(0.45), ftL: E(0.1), thR: E(0.4, -0.1, -0.1), shinR: E(0.35), ftR: E(-0.5),
    staff: E(0.4, 0.7, 0.3), staffW: E(1), plantW: E(0),
  }, -0.075, 0.06) },
  { t: 0.62, p: pose({
    hips: E(0.03, 0.06, 0.02), spine: E(0.03, 0.02, -0.02), chest: E(0, 0.02, -0.01), neck: E(0.02), head: E(-0.02),
    uaR: E(0.02, 0, -0.1), faR: E(-0.35), hdR: E(0.1),
    uaL: E(-0.25, 0, 0.4), faL: E(-1.25),
    thL: E(-0.1, 0, 0.02), shinL: E(0.08), ftL: E(0), thR: E(0.1, 0, -0.06), shinR: E(0.14), ftR: E(-0.1),
    staff: E(-0.02, 1, 0.1), staffW: E(1), plantW: E(0),
  }, -0.015) },
]);

/** one-handed overhead staff strike with the left hand (staff slid to the butt end; the long end strikes) */
const STRIKE_READY = pose({
  hips: E(0.05, 0.1, 0), spine: E(0.04, 0.06, 0), chest: E(0.02, 0.1, 0), head: E(0, -0.12, 0),
  uaL: E(-0.95, 0, 0.3), faL: E(-1.15), hdL: E(0),
  uaR: E(-0.2, 0, -0.3), faR: E(-1.0), hdR: E(0.1),
  thL: E(-0.28, 0, 0.06), shinL: E(0.24), ftL: E(0.05), thR: E(0.22, 0, -0.06), shinR: E(0.2), ftR: E(-0.2),
  staff: E(0.05, 0.55, 0.85), staffW: E(1), plantW: E(0),
}, -0.04);
const STRIKE = new Clip([
  { t: 0, p: STRIKE_READY },
  { t: 0.13, e: 'in', p: pose({
    hips: E(-0.02, 0.28, 0), spine: E(-0.08, 0.14, 0.03), chest: E(-0.14, 0.34, 0.04), neck: E(0.02, -0.14, 0), head: E(0.04, -0.3, 0),
    uaL: E(-2.75, 0.2, 0.42), faL: E(-1.45), hdL: E(0.3),
    uaR: E(-0.45, 0, -0.5), faR: E(-1.15), hdR: E(0),
    thL: E(-0.22, 0.05, 0.06), shinL: E(0.16), ftL: E(0.02), thR: E(0.14, 0, -0.06), shinR: E(0.24), ftR: E(-0.12),
    staff: E(0.15, 0.65, -0.75), staffW: E(1), plantW: E(0),
  }, -0.03, -0.02) },
  { t: 0.26, e: 'out', p: pose({
    hips: E(0.14, -0.2, 0), spine: E(0.18, -0.16, -0.03), chest: E(0.24, -0.3, -0.04), neck: E(0, 0.14, 0), head: E(-0.1, 0.3, 0),
    uaL: E(-1.35, 0, -0.08), faL: E(-0.12), hdL: E(-0.2),
    uaR: E(-0.2, 0, -0.5), faR: E(-0.9), hdR: E(0),
    thL: E(-0.62, 0.05, 0.08), shinL: E(0.52), ftL: E(0.12), thR: E(0.45, 0, -0.08), shinR: E(0.3), ftR: E(-0.38),
    staff: E(-0.1, -0.32, 1), staffW: E(1), plantW: E(0),
  }, -0.09, 0.05) },
  { t: 0.4, p: pose({
    hips: E(0.16, -0.3, 0), spine: E(0.2, -0.22, -0.03), chest: E(0.28, -0.42, -0.04), neck: E(0, 0.18, 0), head: E(-0.1, 0.36, 0),
    uaL: E(-0.75, 0, -0.35), faL: E(-0.3), hdL: E(-0.1),
    uaR: E(-0.15, 0, -0.45), faR: E(-0.8),
    thL: E(-0.62, 0.05, 0.08), shinL: E(0.55), ftL: E(0.12), thR: E(0.45, 0, -0.08), shinR: E(0.34), ftR: E(-0.4),
    staff: E(-0.6, -0.28, 0.7), staffW: E(1), plantW: E(0),
  }, -0.1, 0.05) },
  { t: 0.64, p: STRIKE_READY },
]);

/** strike at the head of the reared bear while the right hand holds its beard (clinch) */
const STRIKE_HIGH = new Clip([
  { t: 0, p: pose({ uaL: E(-2.1, 0, 0.5), faL: E(-1.3), hdL: E(0.2), chest: E(-0.1, 0.18, 0), spine: E(-0.05, 0.06, 0), staff: E(0.3, 0.9, -0.25), staffW: E(1), plantW: E(0) }) },
  { t: 0.15, e: 'in', p: pose({ uaL: E(-2.95, 0.2, 0.45), faL: E(-1.6), hdL: E(0.35), chest: E(-0.2, 0.32, 0.03), spine: E(-0.08, 0.1, 0), staff: E(0.2, 0.55, -0.8), staffW: E(1), plantW: E(0) }) },
  { t: 0.27, e: 'out', p: pose({ uaL: E(-2.6, 0, 0.12), faL: E(-0.35), hdL: E(-0.1), chest: E(0.2, -0.22, -0.03), spine: E(0.1, -0.08, 0), staff: E(-0.18, 0.12, 1), staffW: E(1), plantW: E(0) }) },
  { t: 0.38, p: pose({ uaL: E(-2.2, 0, 0.0), faL: E(-0.45), hdL: E(0), chest: E(0.24, -0.28, -0.03), spine: E(0.12, -0.1, 0), staff: E(-0.35, -0.15, 1), staffW: E(1), plantW: E(0) }) },
  { t: 0.58, p: pose({ uaL: E(-2.1, 0, 0.5), faL: E(-1.3), hdL: E(0.2), chest: E(-0.1, 0.18, 0), spine: E(-0.05, 0.06, 0), staff: E(0.3, 0.9, -0.25), staffW: E(1), plantW: E(0) }) },
]);

/** seizing the bear by its beard: "וְהֶחֱזַקְתִּי בִּזְקָנוֹ" (1 Sam 17:35) — right hand (IK) on the beard, staff raised */
const GRAB_BEARD = pose({
  hips: E(-0.04, -0.12, 0), hipsX: E(-0.01),
  spine: E(-0.08, -0.08, 0), chest: E(-0.1, -0.12, 0.02), neck: E(-0.1, 0.05), head: E(-0.2, 0.05),
  uaR: E(-2.0, 0, -0.1), faR: E(-0.3), hdR: E(0.1),
  uaL: E(-2.1, 0, 0.5), faL: E(-1.3), hdL: E(0.2),
  thL: E(-0.42, 0, 0.03), shinL: E(0.42), ftL: E(0.05), thR: E(0.32, 0, -0.03), shinR: E(0.28), ftR: E(-0.32),
  staff: E(0.3, 0.9, -0.25), staffW: E(1), plantW: E(0),
}, -0.06, -0.02);

const PULL_REACH = pose({
  hips: E(-0.08, -0.1, 0), spine: E(0.3, -0.05, 0), chest: E(0.16, -0.05, 0), neck: E(0.02), head: E(-0.12),
  uaL: E(-1.35, 0, 0.08), faL: E(-0.25), hdL: E(0.15), uaR: E(-1.3, 0, -0.1), faR: E(-0.25), hdR: E(0.15),
  thL: E(-0.75, 0, 0.05), shinL: E(0.9), ftL: E(0.15), thR: E(0.3, 0, -0.05), shinR: E(0.28), ftR: E(-0.28),
}, -0.17, -0.02);
const PULL_BACK = pose({
  hips: E(-0.22, -0.14, 0), spine: E(0.02, -0.08, 0), chest: E(-0.1, -0.08, 0), neck: E(0.02), head: E(-0.22),
  uaL: E(-0.95, 0, 0.1), faL: E(-0.85), hdL: E(0.35), uaR: E(-0.9, 0, -0.12), faR: E(-0.9), hdR: E(0.35),
  thL: E(-0.55, 0, 0.05), shinL: E(0.7), ftL: E(0.1), thR: E(0.45, 0, -0.05), shinR: E(0.2), ftR: E(-0.4),
}, -0.14, -0.16);
/** tugging the lamb from the bear's jaws (loop): lean in and seize, then heave back with the legs */
const PULL = new Clip([
  { t: 0, p: PULL_REACH },
  { t: 0.3, e: 'in', p: PULL_BACK },
  { t: 0.62, p: PULL_REACH },
], true);

/** lamb across the shoulders: hands (IK) hold its legs in front of the shoulders, chest braced */
const CARRY = pose({
  spine: E(0.04), chest: E(-0.02), neck: E(0.06), head: E(0.02),
  uaL: E(-0.55, 0, 0.55), faL: E(-2.1), hdL: E(0.2), uaR: E(-0.55, 0, -0.55), faR: E(-2.1), hdR: E(0.2),
  staffW: E(0), plantW: E(0),
});

/** kneeling on the right knee, staff planted, head bowed */
const KNEEL = pose({
  hips: E(0.05, 0, 0), spine: E(0.06), chest: E(0.04), neck: E(0.12), head: E(0.25),
  thL: E(-1.5, 0, 0.1), shinL: E(1.55), ftL: E(0.0), thR: E(0.05, 0, -0.05), shinR: E(1.62), ftR: E(0.6),
  uaL: E(-0.6, 0, 0.3), faL: E(-1.2), uaR: E(-0.2, 0, -0.1), faR: E(-0.5),
  staff: E(0.02, 1, 0.05), staffW: E(1), butt: E(0.34, 0, 0.42), plantW: E(1),
}, -0.47, 0);

/** thanks — looking up, right hand (IK) on the chest, staff planted */
const THANKS = pose({
  hips: E(-0.02, 0, 0.02), spine: E(-0.05), chest: E(-0.12), neck: E(-0.15), head: E(-0.38),
  uaL: E(-0.2, 0, 0.4), faL: E(-1.3), uaR: E(-0.4, 0, -0.1), faR: E(-1.9), hdR: E(0.1, 0.4, 0),
  thL: E(-0.02), shinL: E(0.03), thR: E(0.04, 0.08, -0.04), shinR: E(0.1), ftR: E(-0.06),
  staff: E(-0.05, 1, 0.02), staffW: E(1), butt: E(0.4, 0, 0.2), plantW: E(1),
});

const PICK_DOWN = pose({
  hips: E(0.3, 0.1, 0), spine: E(0.35, 0.05, 0), chest: E(0.25, 0.1, 0), neck: E(0.1), head: E(0.15),
  thL: E(-1.55, 0.05, 0.18), shinL: E(1.95), ftL: E(-0.35), thR: E(-0.85, 0, -0.12), shinR: E(2.25), ftR: E(-0.95),
  uaR: E(-1.05, 0, -0.08), faR: E(-0.3), hdR: E(0.35),
  uaL: E(-0.7, 0, 0.35), faL: E(-1.3),
  staff: E(0.35, 0.5, 1), staffW: E(1), plantW: E(0),
}, -0.48, -0.04);
/** crouch, reach for the stone, rise and put it in the satchel */
const PICK = new Clip([
  { t: 0, p: pose({ hips: E(0.03), spine: E(0.04), uaR: E(0.02, 0, -0.1), faR: E(-0.35), uaL: E(-0.25, 0, 0.4), faL: E(-1.25), thL: E(-0.04), shinL: E(0.05), thR: E(0.05, 0, -0.06), shinR: E(0.12), staff: E(0, 1, 0.1), staffW: E(1), plantW: E(0) }) },
  { t: 0.36, e: 'out', p: PICK_DOWN },
  { t: 0.56, p: pose({ ...PICK_DOWN.r, uaR: E(-0.95, 0, -0.05), faR: E(-0.5), hdR: E(0.2) }, -0.47, -0.04) },
  { t: 0.82, p: pose({
    hips: E(0.06, 0.08, 0), spine: E(0.1, 0.12, 0), chest: E(0.08, 0.2, 0), neck: E(0.1, 0.15), head: E(0.3, 0.25),
    thL: E(-0.1, 0, 0.03), shinL: E(0.12), ftL: E(0), thR: E(0.05, 0, -0.06), shinR: E(0.16), ftR: E(-0.06),
    uaR: E(-0.3, 0, 0.25), faR: E(-1.35), hdR: E(0.3),
    uaL: E(-0.3, 0, 0.45), faL: E(-1.2),
    staff: E(0.05, 1, 0.15), staffW: E(1), plantW: E(0),
  }, -0.03) },
  { t: 1.05, p: pose({ hips: E(0.03), spine: E(0.03), uaR: E(0.02, 0, -0.1), faR: E(-0.35), uaL: E(-0.22, 0, 0.4), faL: E(-1.28), thL: E(-0.04), shinL: E(0.05), thR: E(0.05, 0, -0.06), shinR: E(0.12), staff: E(-0.03, 1, 0.05), staffW: E(1), plantW: E(0) }) },
]);

/** calling the flock: right hand cupped at the mouth (IK), chest lifted, head raised toward the flock */
const CALL_UP = pose({
  spine: E(-0.04), chest: E(-0.1), neck: E(-0.08), head: E(-0.16, -0.05),
  uaR: E(-1.2, 0, -0.55), faR: E(-2.3), hdR: E(0.25),
});
const CALL = new Clip([
  { t: 0, p: pose({ spine: E(0.02), chest: E(-0.02), neck: E(0.02), head: E(-0.02), uaR: E(0.02, 0, -0.1), faR: E(-0.35), hdR: E(0.1) }) },
  { t: 0.28, e: 'out', p: CALL_UP },
  { t: 0.62, p: pose({ ...CALL_UP.r, chest: E(-0.14), head: E(-0.2, -0.05) }) },
  { t: 1.12, p: pose({ ...CALL_UP.r, chest: E(-0.12), head: E(-0.18, -0.08) }) },
  { t: 1.45, p: pose({ spine: E(0.02), chest: E(-0.02), neck: E(0.02), head: E(-0.02), uaR: E(0.02, 0, -0.1), faR: E(-0.35), hdR: E(0.1) }) },
]);

/** evasive duck-and-lunge (Player moves the body along the dodge direction; `dodgeSide` leans the body) */
const DODGE = new Clip([
  { t: 0, p: full({}) },
  { t: 0.1, e: 'out', p: full({
    hips: E(0.25, 0, 0), spine: E(0.3), chest: E(0.15), head: E(-0.2),
    thL: E(-1.0, 0, 0.18), shinL: E(1.3), ftL: E(-0.2), thR: E(-0.3, 0, -0.18), shinR: E(1.25), ftR: E(-0.5),
    uaL: E(-0.9, 0, 0.6), faL: E(-1.1), uaR: E(-0.8, 0, -0.7), faR: E(-1.0),
    staff: E(0.4, 0.6, 0.6), staffW: E(1), plantW: E(0),
  }, -0.3, -0.02) },
  { t: 0.34, p: full({
    hips: E(0.2, 0, 0), spine: E(0.22), chest: E(0.1), head: E(-0.15),
    thL: E(-0.7, 0, 0.12), shinL: E(0.9), ftL: E(-0.1), thR: E(-0.15, 0, -0.12), shinR: E(0.85), ftR: E(-0.35),
    uaL: E(-0.7, 0, 0.5), faL: E(-1.1), uaR: E(-0.6, 0, -0.55), faR: E(-1.0),
    staff: E(0.3, 0.8, 0.4), staffW: E(1), plantW: E(0),
  }, -0.2, 0) },
  { t: 0.56, p: full({ staff: E(0, 1, 0.1) }) },
]);

const HURT = new Clip([
  { t: 0, p: full({}) },
  { t: 0.07, e: 'out', p: full({
    hips: E(-0.1, 0.1, 0), spine: E(-0.15, 0.1, 0.05), chest: E(-0.3, 0.2, 0.08), neck: E(-0.1, 0.15), head: E(-0.25, 0.35, 0.1),
    uaL: E(-0.7, 0, 0.7), faL: E(-1.2), uaR: E(-0.9, 0, -0.6), faR: E(-1.4),
    thL: E(0.1, 0, 0.08), shinL: E(0.2), thR: E(0.25, 0, -0.08), shinR: E(0.3), ftR: E(-0.2),
  }, -0.06, -0.06) },
  { t: 0.22, p: full({
    hips: E(0.12, 0.05, 0), spine: E(0.15, 0.05), chest: E(0.1, 0.08), head: E(0.05, 0.15),
    uaL: E(-0.5, 0, 0.5), faL: E(-1.2), uaR: E(-0.5, 0, -0.4), faR: E(-1.0),
    thL: E(-0.2, 0, 0.06), shinL: E(0.35), thR: E(0.2, 0, -0.06), shinR: E(0.3),
  }, -0.08, 0) },
  { t: 0.48, p: full({}) },
]);

interface ActionDef { clip: Clip; mask?: readonly string[]; legs: boolean; fadeIn: number; fadeOut: number }
const ACTIONS: Record<ActionName, ActionDef> = {
  throw: { clip: THROW, legs: true, fadeIn: 0.05, fadeOut: 0.2 },
  strike: { clip: STRIKE, legs: true, fadeIn: 0.05, fadeOut: 0.18 },
  strikeHigh: { clip: STRIKE_HIGH, mask: [...UPPER_L, 'chest', 'spine', 'staff', 'staffW', 'plantW'], legs: false, fadeIn: 0.04, fadeOut: 0.12 },
  pick: { clip: PICK, legs: true, fadeIn: 0.1, fadeOut: 0.2 },
  call: { clip: CALL, mask: [...UPPER_R, 'head', 'neck', 'chest', 'spine'], legs: false, fadeIn: 0.1, fadeOut: 0.25 },
  dodge: { clip: DODGE, legs: true, fadeIn: 0.04, fadeOut: 0.18 },
  hurt: { clip: HURT, mask: [...UPPER_L, ...UPPER_R, ...TORSO, 'hips', ...LEGS], legs: true, fadeIn: 0.03, fadeOut: 0.2 },
};

interface ActiveAction { name: ActionName; def: ActionDef; t: number; events: { t: number; fn: () => void; fired: boolean }[] }

// ------------------------------------------------------------------------------------------ scratch
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3(), _v6 = new THREE.Vector3(), _v7 = new THREE.Vector3(), _v8 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _q4 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const _e1 = new THREE.Euler();
const _s1 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const NEG_Y = new THREE.Vector3(0, -1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);

function smooth01(x: number) {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

// ------------------------------------------------------------------------------------------ sling
const NC = 7; // points per cord (hand .. pouch end)
const CORD_LEN = 0.44;
const POUCH_W = 0.094;
const SEG = CORD_LEN / (NC - 1);

class SlingSim {
  readonly a: THREE.Vector3[] = Array.from({ length: NC }, () => new THREE.Vector3());
  readonly b: THREE.Vector3[] = Array.from({ length: NC }, () => new THREE.Vector3());
  readonly pa: THREE.Vector3[] = Array.from({ length: NC }, () => new THREE.Vector3());
  readonly pb: THREE.Vector3[] = Array.from({ length: NC }, () => new THREE.Vector3());
  bPinned = true;
  reset(hand: THREE.Vector3, side: THREE.Vector3) {
    for (let i = 0; i < NC; i++) {
      const t = i / (NC - 1);
      this.a[i].copy(hand).addScaledVector(NEG_Y, t * CORD_LEN * 0.98).addScaledVector(side, -t * POUCH_W * 0.5);
      this.b[i].copy(hand).addScaledVector(NEG_Y, t * CORD_LEN * 0.98).addScaledVector(side, t * POUCH_W * 0.5);
      this.pa[i].copy(this.a[i]);
      this.pb[i].copy(this.b[i]);
    }
    this.bPinned = true;
  }
  /** verlet integration of all free points */
  integrate(dt: number, drag: number, fixedEnds: boolean) {
    const g = -9.81 * dt * dt;
    for (let c = 0; c < 2; c++) {
      const P = c === 0 ? this.a : this.b, Q = c === 0 ? this.pa : this.pb;
      const last = fixedEnds ? NC - 1 : NC;
      for (let i = 1; i < last; i++) {
        const p = P[i], q = Q[i];
        const vx = (p.x - q.x) * drag, vy = (p.y - q.y) * drag, vz = (p.z - q.z) * drag;
        q.copy(p);
        p.x += vx;
        p.y += vy + g;
        p.z += vz;
      }
    }
  }
  constrain(hand: THREE.Vector3, iterations: number, caps: Float32Array, capCount: number, pinB: THREE.Vector3 | null, fixedEnds: boolean) {
    const A = this.a, B = this.b;
    for (let it = 0; it < iterations; it++) {
      A[0].copy(hand);
      if (pinB) B[0].copy(pinB);
      for (let c = 0; c < 2; c++) {
        const P = c === 0 ? A : B;
        for (let i = 0; i < NC - 1; i++) {
          const p = P[i], q = P[i + 1];
          const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
          const diff = (d - SEG) / d;
          // masses: the hand end is fixed, the pouch end is heavy (leather + stone)
          const pinnedP = i === 0 && (P === A || pinB !== null);
          const heavyQ = i + 1 === NC - 1;
          let wp = pinnedP ? 0 : 1, wq = heavyQ ? (fixedEnds ? 0 : 0.3) : 1;
          const s = wp + wq;
          if (s <= 0) continue;
          wp /= s;
          wq /= s;
          p.x += dx * diff * wp; p.y += dy * diff * wp; p.z += dz * diff * wp;
          q.x -= dx * diff * wq; q.y -= dy * diff * wq; q.z -= dz * diff * wq;
        }
      }
      if (!fixedEnds) {
        // the pouch keeps its width between the two cord ends
        const p = A[NC - 1], q = B[NC - 1];
        const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const diff = (d - POUCH_W) / d * 0.5;
        p.x += dx * diff; p.y += dy * diff; p.z += dz * diff;
        q.x -= dx * diff; q.y -= dy * diff; q.z -= dz * diff;
      }
      // legs: push cords and pouch out of the leg capsules
      for (let c = 0; c < capCount; c++) {
        const o = c * 7;
        _v1.set(caps[o], caps[o + 1], caps[o + 2]);
        _v2.set(caps[o + 3], caps[o + 4], caps[o + 5]);
        const r = caps[o + 6];
        for (let i = 2; i < NC; i++) {
          pushOutOfCapsule(A[i], _v1, _v2, r);
          pushOutOfCapsule(B[i], _v1, _v2, r);
        }
      }
    }
  }
}

function pushOutOfCapsule(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, r: number) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const l2 = abx * abx + aby * aby + abz * abz;
  let t = l2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = a.x + abx * t, cy = a.y + aby * t, cz = a.z + abz * t;
  const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 >= r * r || d2 < 1e-10) return;
  const d = Math.sqrt(d2);
  const k = (r - d) / d;
  p.x += dx * k;
  p.y += dy * k;
  p.z += dz * k;
}

/** a smooth wadi pebble (also used for the sling stones in flight, src/gameplay/Projectiles.ts) */
export function pebbleGeometry(seed: number, scale = 1) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const k1 = rnd() * 6, k2 = rnd() * 6;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + 0.06 * Math.sin(x * 3.1 + k1) * Math.cos(z * 2.7 + k2) + 0.04 * Math.sin(y * 4.3 + k2);
    p.setXYZ(i, x * n * 0.021 * scale, y * n * 0.0155 * scale, z * n * 0.0185 * scale);
  }
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------------------------------ model
export class DavidModel {
  /** parts loaded by `preload()` and consumed by the next construction */
  static preloaded: DavidParts | null = null;

  /**
   * Load the realistic David: human (MakeHuman preset 'david'), strand hair, costume and props. Tiers follow
   * engine.quality.name (phones are always 'low'). Await it during boot before constructing the Player.
   */
  static async preload(quality: HumanQuality, o: { msaa?: number; hair?: boolean; onProgress?: (f: number) => void } = {}): Promise<DavidParts> {
    const t0 = performance.now();
    const human = await HumanModel.load({ preset: 'david', quality });
    o.onProgress?.(0.4);
    const t1 = performance.now();
    const outfit = await dressDavid(human, { quality });
    o.onProgress?.(0.75);
    const t2 = performance.now();
    let groom: Groom | null = null;
    if (o.hair !== false) {
      try {
        groom = await createGroom(human, 'david', { quality, msaa: o.msaa ?? (quality === 'low' ? 0 : 4) });
      } catch (e) {
        console.warn('[david] hair groom failed', e);
      }
    }
    o.onProgress?.(1);
    const t3 = performance.now();
    const parts: DavidParts = { human, groom, outfit, quality, loadMs: { human: t1 - t0, outfit: t2 - t1, groom: t3 - t2, total: t3 - t0 } };
    DavidModel.preloaded = parts;
    return parts;
  }

  readonly root = new THREE.Group();
  readonly human: HumanModel;
  readonly outfit: Outfit;
  readonly groom: Groom | null;
  readonly quality: HumanQuality;
  /** proxy joints (hips spine chest neck head uaL faL hdL uaR faR hdR thL shinL ftL thR shinR ftR) */
  readonly j: Record<string, THREE.Object3D>;
  readonly mixer: PoseMixer;
  /** the staff prop's object (a child of human.root, placed every frame) */
  readonly staff: THREE.Object3D;
  readonly staffProp: Prop;
  /** lamb across the shoulders (+Z along the character's +X) */
  readonly shoulderSocket: THREE.Object3D;
  readonly handSocketR: THREE.Object3D;
  readonly handSocketL: THREE.Object3D;
  /** optional: camera + viewport height for strand LOD (set by the Player) */
  camera?: THREE.Camera;
  viewportHeight = 720;
  /** optional expression override for cinematics (null = automatic per action) */
  mood: Expression | null = null;
  /** local (character-space) dodge direction x (+ = to his left), set by the Player before play('dodge') */
  dodgeSide = 0;

  // animation state
  speed = 0; // m/s (for locomotion)
  private phase = 0;
  private locoW = 0;
  private runW = 0;
  private time = 0;
  hold: HoldPose = 'none';
  private holdW: Record<HoldPose, number> = { none: 0, spin: 0, grab: 0, carry: 0, kneel: 0, thanks: 0, pull: 0, hero: 0 };
  private action: ActiveAction | null = null;
  private actionW = 0;
  private pullT = 0;
  spinPhase = 0;
  spinPower = 0;
  staffMode: StaffMode = 'plant';
  private staffSlide = 0;
  private staffBackW = 0;
  lookTarget: THREE.Vector3 | null = null;
  private lookYaw = 0;
  private lookPitch = 0;
  onFootstep?: (side: 'L' | 'R', run: boolean) => void;
  ground?: (x: number, z: number) => number;
  private lastPhase = 0;
  private turnLean = 0;
  private lastHeading = 0;
  private lastRootPos = new THREE.Vector3();
  private velocity = new THREE.Vector3();
  private hasLast = false;
  private pelvisDrop = 0;
  private exertion = 0;
  private glance = new THREE.Vector2();
  private glanceTarget = new THREE.Vector2();
  private glanceT = 3;
  private idleT = 0;
  private reloadT = -1;
  private stoneShown = true;
  private lastExpr: Expression | '' = '';
  private stillT = 0;
  private autoHeroW = 0;
  /** settle into the reference 'hero' stance after ~7 s of standing still (gameplay idle, intro portrait) */
  autoHero = true;
  private lastExprW = -1;
  private fingerL: FingerPose | '' = '';
  private fingerR: FingerPose | '' = '';

  // rest data for IK / staff solving
  private readonly sockRestQ: Record<'L' | 'R', THREE.Quaternion> = { L: new THREE.Quaternion(), R: new THREE.Quaternion() };
  private readonly sockRestOff: Record<'L' | 'R', THREE.Vector3> = { L: new THREE.Vector3(), R: new THREE.Vector3() };
  private readonly restFix: Record<string, THREE.Quaternion> = {};
  private readonly ankleRest: Record<'L' | 'R', THREE.Vector3> = { L: new THREE.Vector3(), R: new THREE.Vector3() };
  private readonly staffBaseQ = new THREE.Quaternion();
  private readonly staffBasePos = new THREE.Vector3();
  private readonly staffBack = new THREE.Object3D();
  private readonly staffGripDist: number;
  private readonly walkPose: Pose = { r: {}, hipsY: 0, hipsZ: 0 };
  private readonly scratchPose: Pose = { r: {}, hipsY: 0, hipsZ: 0 };
  private readonly spinPose: Pose = { r: {}, hipsY: 0, hipsZ: 0 };
  private readonly footTarget: Record<'L' | 'R', THREE.Vector3> = { L: new THREE.Vector3(), R: new THREE.Vector3() };
  private readonly footPitch: Record<'L' | 'R', number> = { L: 0, R: 0 };
  private readonly footContact: Record<'L' | 'R', number> = { L: 1, R: 1 };

  // sling
  readonly sling = { state: 'idle' as 'idle' | 'spin' | 'release' | 'stowed', pouch: new THREE.Vector3(), prev: new THREE.Vector3(), releaseT: 0, loaded: true };
  private sim = new SlingSim();
  private cordA: Rope;
  private cordB: Rope;
  private pouch: THREE.Object3D;
  private pouchStone: THREE.Mesh;
  private handStone: THREE.Mesh;
  private slingAnchor = new THREE.Object3D();
  private slingInit = false;
  private slingShown = true;
  private caps = new Float32Array(4 * 7);

  constructor(_tex?: TextureSet, parts: DavidParts | null = DavidModel.preloaded) {
    if (!parts) throw new Error('DavidModel: await DavidModel.preload(quality) before constructing it');
    if (parts === DavidModel.preloaded) DavidModel.preloaded = null;
    const { human, outfit, groom } = parts;
    this.human = human;
    this.outfit = outfit;
    this.groom = groom;
    this.quality = parts.quality;
    this.root.name = 'David';
    this.root.add(human.root);
    human.root.position.y = outfit.groundOffset;
    this.j = human.joints as unknown as Record<string, THREE.Object3D>;
    this.mixer = new PoseMixer(this.j, CHANNELS);
    for (const k of Object.keys(this.mixer.cur.r)) {
      this.walkPose.r[k] = [0, 0, 0];
      this.scratchPose.r[k] = [0, 0, 0];
      this.spinPose.r[k] = [0, 0, 0];
    }
    this.shoulderSocket = human.sockets.shoulderCarry;
    this.handSocketL = human.sockets.handGripL;
    this.handSocketR = human.sockets.handGripR;

    // ---- staff: grip radius, fingers; placed by hand every frame (hand / slid for strikes / across the back)
    const staff = outfit.props.staff!;
    this.staffProp = staff;
    this.staff = staff.object;
    human.setGripRadius((staff.object.userData.radiusAtGrip as number | undefined) ?? 0.018);
    attachProp(staff, human.sockets.handGripL);
    this.staffBaseQ.copy(staff.object.quaternion);
    this.staffBasePos.copy(staff.object.position);
    human.root.add(staff.object);
    this.staffGripDist = staff.butt.position.clone().applyQuaternion(this.staffBaseQ).add(this.staffBasePos).length();
    // across the back: under the satchel strap, tip over the left shoulder
    const back = human.sockets.spineUpper;
    back.add(this.staffBack);
    this.staffBack.position.set(0.0, -0.05, -0.045);
    this.staffBack.quaternion.setFromEuler(_e1.set(0.12, 0, -0.62));

    // ---- rest data (all proxies at identity right after load)
    human.rig.toRest();
    human.update(0);
    human.root.updateMatrixWorld(true);
    const rootInv = _m1.copy(human.root.matrixWorld).invert();
    for (const s of ['L', 'R'] as const) {
      const sock = human.sockets[`handGrip${s}`];
      _m2.multiplyMatrices(rootInv, sock.matrixWorld).decompose(_v1, this.sockRestQ[s], _s1);
      this.sockRestOff[s].copy(_v1).sub(human.rig.restWorldPosition(`wrist.${s}`, _v2));
      human.rig.restWorldPosition(`foot.${s}`, this.ankleRest[s]);
    }
    for (const n of ['uaL', 'uaR', 'thL', 'thR']) {
      const child = this.j[n.startsWith('ua') ? `fa${n[2]}` : `shin${n[2]}`];
      this.restFix[n] = new THREE.Quaternion().setFromUnitVectors(NEG_Y, _v1.copy(child.position).normalize());
    }
    human.rig.setFingers('L', 'grip');
    human.rig.setFingers('R', 'fist');
    human.rig.blinkEnabled = true;
    human.setPupil(0.25);

    // ---- sling: cords (Rope) + the wardrobe's leather pouch + a stone
    const cordMat = outfit.props.slingCordMaterial ?? new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.85 });
    const radial = this.quality === 'low' ? 4 : 6;
    this.cordA = new Rope(NC, 0.0028, cordMat, radial, this.quality === 'low' ? 2 : 3);
    this.cordB = new Rope(NC, 0.0028, cordMat, radial, this.quality === 'low' ? 2 : 3);
    this.pouch = outfit.props.slingPouch ?? new THREE.Group();
    this.pouch.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xcfc3ab, roughness: 0.42, metalness: 0 });
    this.pouchStone = new THREE.Mesh(pebbleGeometry(11), stoneMat);
    this.pouchStone.position.set(0, 0.006, 0);
    this.pouchStone.castShadow = true;
    this.pouch.add(this.pouchStone);
    this.handStone = new THREE.Mesh(pebbleGeometry(29, 1.05), stoneMat);
    this.handStone.visible = false;
    human.sockets.palmR.add(this.handStone);
    this.handStone.position.set(0.018, 0, 0.012);
    human.sockets.handGripR.add(this.slingAnchor);
    this.slingAnchor.position.set(0, -0.038, 0);

    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = true;
    });
  }

  /** Adds sling meshes to the given world-space container (they are simulated in world space). */
  attachSling(container: THREE.Object3D) {
    container.add(this.cordA.mesh, this.cordB.mesh, this.pouch);
  }

  // ----------------------------------------------------------------------------------- control
  play(name: ActionName, events: { t: number; fn: () => void }[] = []) {
    const def = ACTIONS[name];
    this.action = { name, def, t: 0, events: events.map((e) => ({ ...e, fired: false })) };
  }
  get busy() {
    return !!this.action;
  }
  get actionName(): ActionName | null {
    return this.action ? this.action.name : null;
  }

  worldOf(o: THREE.Object3D, out = new THREE.Vector3()) {
    return o.getWorldPosition(out);
  }

  /** World position of the staff's striking end (the tip; for strikes the staff is held near the butt). */
  staffTip(out = new THREE.Vector3()) {
    return this.staffProp.tip.getWorldPosition(out);
  }

  /** Snap secondary motion (cloth, sash cords, hair, sling) after a teleport or a camera cut. */
  resetDynamics() {
    this.outfit.resetDynamics();
    this.slingInit = false;
    this.hasLast = false;
  }

  setVisible(v: boolean) {
    this.root.visible = v;
    this.cordA.mesh.visible = this.cordB.mesh.visible = this.pouch.visible = v && this.slingShown;
  }

  // ----------------------------------------------------------------------------------- update
  update(dt: number) {
    this.time += dt;
    const m = this.mixer;
    const J = this.j;
    m.reset();

    // ---------- root motion bookkeeping (velocity for cloth, turn rate for leaning)
    this.root.updateWorldMatrix(true, false);
    const rootPos = _v1.setFromMatrixPosition(this.root.matrixWorld);
    const heading = this.root.rotation.y;
    if (this.hasLast && dt > 0) {
      this.velocity.subVectors(rootPos, this.lastRootPos).divideScalar(dt);
      if (this.velocity.lengthSq() > 100) this.velocity.set(0, 0, 0); // teleport
      let dh = heading - this.lastHeading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const turnRate = clamp(dh / dt, -6, 6);
      this.turnLean = damp(this.turnLean, clamp(turnRate * this.speed * 0.035, -0.22, 0.22), 6, dt);
    } else this.velocity.set(0, 0, 0);
    this.lastRootPos.copy(rootPos);
    this.lastHeading = heading;
    this.hasLast = true;

    // ---------- gait state
    const v = this.speed;
    this.locoW = damp(this.locoW, clamp(v / 0.9, 0, 1), 7, dt);
    this.runW = damp(this.runW, smooth01((v - 2.0) / 0.9), 5, dt);
    const rw = this.runW, lw = this.locoW;
    const cadence = THREE.MathUtils.lerp(1.55 + 0.25 * Math.min(v, 2.6), 2.55 + 0.13 * v, rw); // steps / s
    const T = 2 / cadence; // gait cycle (two steps)
    this.phase = (this.phase + (v > 0.05 || lw > 0.05 ? dt / T : 0)) % 1;
    const p = this.phase;
    this.exertion = clamp(this.exertion + dt * (rw > 0.5 ? 0.12 : -0.05), 0, 1);

    // ---------- base: calm idle / hero stance (after standing still for a while he settles into the reference stance)
    const stillNow = this.locoW < 0.05 && !this.action && this.hold === 'none' && this.sling.state !== 'spin';
    this.stillT = stillNow ? this.stillT + dt : 0;
    this.autoHeroW = damp(this.autoHeroW, this.autoHero && this.stillT > 7 ? 1 : 0, this.stillT > 7 ? 0.9 : 6, dt);
    const heroW = Math.max(this.holdW.hero, this.autoHeroW);
    m.layer(IDLE, 1);
    if (heroW > 0.001) m.layer(HERO, heroW);
    // idle life: weight shift, glances
    const still = (1 - lw) * (this.action ? 0.3 : 1);
    this.idleT += dt;
    const sway = Math.sin(this.idleT * 0.55) * 0.5 + Math.sin(this.idleT * 0.21 + 1.3) * 0.5;
    m.add('hipsX', sway * 0.012 * still);
    m.add('hips', 0, 0, sway * 0.018 * still);
    m.add('spine', 0, 0, -sway * 0.012 * still);
    m.add('chest', Math.sin(this.idleT * 1.3) * 0.006 * still, 0, 0);
    this.glanceT -= dt;
    if (this.glanceT <= 0) {
      const away = this.glanceTarget.lengthSq() < 1e-4 && Math.random() < 0.7;
      if (away) this.glanceTarget.set((Math.random() - 0.5) * 1.1, (Math.random() - 0.4) * 0.22);
      else this.glanceTarget.set(0, 0);
      this.glanceT = away ? 1.2 + Math.random() * 2.2 : 2.5 + Math.random() * 4.5;
    }
    const gw = still * (this.lookTarget ? 0 : 1) * (1 - heroW);
    this.glance.x = damp(this.glance.x, this.glanceTarget.x * gw, 3.5, dt);
    this.glance.y = damp(this.glance.y, this.glanceTarget.y * gw, 3.5, dt);
    m.add('head', -this.glance.y * 0.6, this.glance.x * 0.55, 0);
    m.add('neck', -this.glance.y * 0.3, this.glance.x * 0.35, 0);

    // ---------- locomotion (upper body + pelvis; the legs are solved by IK below)
    if (lw > 0.001) {
      this.buildWalkUpper(p, v, rw);
      m.layer(this.walkPose, lw, WALK_MASK);
      // footsteps on heel strike (left at p=0, right at p=0.5)
      if (lw > 0.5) {
        if (this.lastPhase > 0.9 && p < 0.1) this.onFootstep?.('L', rw > 0.5);
        if (this.lastPhase < 0.5 && p >= 0.5) this.onFootstep?.('R', rw > 0.5);
      }
    }
    this.lastPhase = p;
    // lean into turns (whole body rolls about the feet)
    m.add('hips', 0, 0, -this.turnLean * 0.6);
    m.add('spine', 0, 0, -this.turnLean * 0.3);

    // ---------- holds
    for (const k of HOLDS) {
      this.holdW[k] = damp(this.holdW[k], this.hold === k ? 1 : 0, k === 'spin' ? 10 : k === 'grab' ? 9 : 5, dt);
    }
    const H = this.holdW;
    if (H.spin > 0.001) {
      const sp = this.spinPose;
      const a = this.spinPhase;
      for (const k in SPIN.r) {
        const src = SPIN.r[k], dst = sp.r[k] ?? (sp.r[k] = [0, 0, 0]);
        dst[0] = src[0]; dst[1] = src[1]; dst[2] = src[2];
      }
      sp.hipsY = SPIN.hipsY;
      // the wrist and forearm drive the whirl: small circles of the hand, a slight bob of the body
      sp.r.uaR[0] += Math.sin(a) * 0.13;
      sp.r.uaR[2] += Math.cos(a) * 0.12;
      sp.r.faR[0] += Math.sin(a + 0.9) * 0.14;
      sp.r.hdR[0] += Math.sin(a + 1.6) * 0.25;
      sp.r.chest[1] += Math.sin(a) * 0.025 * (0.4 + this.spinPower);
      m.layer(sp, H.spin, lw > 0.3 ? SPIN_UPPER : SPIN_ALL);
    }
    if (H.grab > 0.001) m.layer(GRAB_BEARD, H.grab);
    if (H.carry > 0.001) m.layer(CARRY, H.carry, CARRY_MASK);
    if (H.kneel > 0.001) m.layer(KNEEL, H.kneel);
    if (H.thanks > 0.001) m.layer(THANKS, H.thanks, lw > 0.3 ? THANKS_UPPER : undefined);
    if (H.pull > 0.001) {
      this.pullT += dt;
      m.layer(PULL.sample(this.pullT, this.scratchPose), H.pull, PULL.joints);
    } else this.pullT = 0;

    // ---------- one-shot action
    let actionLegs = 0;
    if (this.action) {
      const a = this.action;
      a.t += dt;
      const dur = a.def.clip.duration;
      let w = Math.min(1, a.t / a.def.fadeIn, (dur - a.t) / a.def.fadeOut);
      // picking up the lamb: once it is on the shoulders, hand over to the carry hold quickly
      if (a.name === 'pick' && this.hold === 'carry' && a.t > 0.5) w = Math.min(w, Math.max(0, 1 - (a.t - 0.5) / 0.25));
      this.actionW = Math.max(0, w);
      const sp = a.def.clip.sample(a.t, this.scratchPose);
      if (a.name === 'dodge') {
        // lean / hop toward the dodge side
        const s = this.dodgeSide;
        sp.r.hips[2] += -s * 0.25;
        sp.r.spine[2] += -s * 0.25;
        sp.r.chest[2] += -s * 0.1;
        if (sp.r.hipsX) sp.r.hipsX[0] += s * 0.1;
      }
      m.layer(sp, this.actionW, a.def.mask ?? a.def.clip.joints);
      if (a.def.legs) actionLegs = this.actionW;
      for (const e of a.events) if (!e.fired && a.t >= e.t) { e.fired = true; e.fn(); }
      if (a.t >= dur) this.action = null;
    } else this.actionW = 0;

    // ---------- reload gesture (right hand to the satchel after a throw)
    if (this.reloadT >= 0) {
      this.reloadT += dt;
      const u = this.reloadT / 0.75;
      const w = Math.sin(Math.PI * clamp(u, 0, 1)) * (1 - H.spin);
      if (w > 0.001) {
        m.layer(RELOAD, w, RELOAD_MASK);
      }
      if (u >= 1) this.reloadT = -1;
    }

    // ---------- head look-at
    if (this.lookTarget) {
      J.neck.getWorldPosition(_v2);
      this.root.worldToLocal(_v3.copy(this.lookTarget));
      this.root.worldToLocal(_v2);
      const d = _v3.sub(_v2);
      const yaw = clamp(Math.atan2(d.x, d.z), -1.1, 1.1);
      const pitch = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.6, 0.5);
      this.lookYaw = damp(this.lookYaw, yaw, 5, dt);
      this.lookPitch = damp(this.lookPitch, pitch, 5, dt);
    } else {
      this.lookYaw = damp(this.lookYaw, 0, 3, dt);
      this.lookPitch = damp(this.lookPitch, 0, 3, dt);
    }
    m.add('head', this.lookPitch * 0.55, this.lookYaw * 0.55, 0);
    m.add('neck', this.lookPitch * 0.3, this.lookYaw * 0.3, 0);
    m.add('chest', 0, this.lookYaw * 0.12, 0);

    // breathing: deeper after running
    this.human.rig.breathe = 1 + this.exertion * 1.6;

    m.apply();
    const c = m.cur;
    J.hips.position.set(
      this.human.rig.pelvis.x + c.r.hipsX[0],
      this.human.rig.hipHeight + (c.hipsY ?? 0),
      this.human.rig.pelvis.z + (c.hipsZ ?? 0),
    );

    // ---------- legs: gait targets + terrain IK
    const legW = lw * (1 - actionLegs) * (1 - H.kneel) * (1 - H.pull * 0.7) * (1 - H.grab * 0.8);
    this.solveLegs(p, v, rw, legW, dt);

    // ---------- arms: staff, hands on targets
    this.solveArms(dt);

    // ---------- fingers, face, eyes
    this.updateFace();
    this.human.rig.lookTarget = this.lookTarget;

    // ---------- skin, hair, clothes
    this.human.update(dt, this.camera, this.viewportHeight);
    this.placeStaff(dt);
    this.updateProps();
    const wind = _v6.copy(shared.uWind.value).multiplyScalar(1.4 * shared.uWindStrength.value);
    this.outfit.update(dt, { velocity: this.velocity, wind });
    this.groom?.update(dt, wind);
  }

  /** procedural walk/run: pelvis, spine counter-rotation, arm swing, head stabilisation (into this.walkPose) */
  private buildWalkUpper(p: number, v: number, rw: number) {
    const r = this.walkPose.r;
    const L = THREE.MathUtils.lerp;
    const c2 = Math.cos(2 * Math.PI * p);
    const s2 = Math.sin(2 * Math.PI * p);
    const stanceL = Math.cos(2 * Math.PI * (p - 0.3)); // +1 at left mid-stance
    const yawAmp = L(0.07 + 0.015 * v, 0.1, rw);
    const pelvisYaw = -yawAmp * c2; // left hip forward at left heel strike
    const list = L(0.045, 0.03, rw) * stanceL; // swing side drops
    const lean = L(0.03 + 0.012 * v, 0.12 + 0.035 * v, rw);
    const bounce = L(0, 0.05, rw) * Math.cos(4 * Math.PI * (p - 0.18)); // run: low at mid-stance
    r.hips[0] = L(0.03, 0.1, rw) + bounce * 0.4;
    r.hips[1] = pelvisYaw;
    r.hips[2] = list;
    r.hipsX[0] = L(0.022, 0.008, rw) * stanceL;
    r.spine[0] = lean * 0.6;
    r.spine[1] = -pelvisYaw * 0.7;
    r.spine[2] = -list * 0.7;
    r.chest[0] = lean * 0.4 - bounce * 0.2;
    r.chest[1] = -pelvisYaw * L(1.0, 1.35, rw);
    r.chest[2] = -list * 0.25;
    const net = pelvisYaw * (1 - 0.7 - L(1.0, 1.35, rw));
    r.neck[0] = -lean * 0.3;
    r.neck[1] = -net * 0.4;
    r.neck[2] = 0;
    r.head[0] = -lean * 0.45 + bounce * 0.3;
    r.head[1] = -net * 0.5;
    r.head[2] = list * 0.3;
    // right arm (sling hand): free swing opposite to the right leg
    const A = L(0.24 + 0.09 * v, 0.55 + 0.05 * v, rw);
    r.uaR[0] = -A * c2 + L(0.02, -0.12, rw);
    r.uaR[1] = 0;
    r.uaR[2] = L(-0.1, -0.2, rw);
    r.faR[0] = L(-0.28 - 0.22 * Math.max(0, c2), -1.45 - 0.25 * c2, rw);
    r.faR[1] = L(0.15, 0.25, rw);
    r.faR[2] = 0;
    r.hdR[0] = L(0.1, 0.25, rw);
    r.hdR[1] = 0;
    r.hdR[2] = 0;
    // left arm carries the staff: shorter swing, forearm raised
    const AL = L(0.12 + 0.05 * v, 0.4, rw);
    r.uaL[0] = AL * c2 + L(-0.32, -0.45, rw);
    r.uaL[1] = 0;
    r.uaL[2] = L(0.28, 0.22, rw);
    r.faL[0] = L(-1.05, -1.4 - 0.2 * c2, rw);
    r.faL[1] = 0;
    r.faL[2] = 0;
    r.hdL[0] = r.hdL[1] = r.hdL[2] = 0;
    // staff: walking — upright with a forward lean and a little lag; running — carried at a slant
    r.staff[0] = L(-0.02, 0.1, rw);
    r.staff[1] = L(1, 0.36, rw);
    r.staff[2] = L(0.1 + 0.04 * v + 0.04 * s2, 1, rw);
    r.staffW[0] = 1;
    r.plantW[0] = 0;
    this.walkPose.hipsY = L(-0.012, -0.055, rw) + bounce;
    this.walkPose.hipsZ = L(0.01, 0.04, rw);
  }

  // ----------------------------------------------------------------------------------- legs
  /** ankle target (character space, relative to the root ground) and pitch for one leg from the gait phase */
  private gaitFoot(side: 'L' | 'R', p: number, v: number, rw: number, out: THREE.Vector3) {
    const L = THREE.MathUtils.lerp;
    const ph = (p + (side === 'L' ? 0 : 0.5)) % 1;
    const beta = L(0.61, 0.36 - 0.03 * Math.max(0, v - 3), rw);
    const T = 2 / THREE.MathUtils.lerp(1.55 + 0.25 * Math.min(v, 2.6), 2.55 + 0.13 * v, rw);
    const S = Math.max(0.05, v * T); // stride length
    const asym = 0.14 * rw; // running: the foot lands near the body and pushes off far behind
    const h0 = this.ankleRest[side].y;
    const x = this.ankleRest[side].x * L(0.8, 0.45, rw);
    const zStrike = beta * S * (0.5 - asym) + L(0.02, 0.05, rw);
    const zOff = -beta * S * (0.5 + asym) + L(0.02, 0.05, rw);
    const strikePitch = L(-0.3, -0.12, rw) * Math.min(1, v / 1.2);
    const toePitch = L(0.55, 0.7, rw) * Math.min(1, v / 1.0);
    const fb = 0.13, hb = 0.055; // ball of the foot ahead of / heel behind the ankle
    let z: number, y: number, pitch: number, contact: number;
    if (ph < beta) {
      const u = ph / beta;
      z = L(zStrike, zOff, u);
      if (u < 0.16) {
        // heel rocker: toes come down about the heel
        pitch = strikePitch * (1 - smooth01(u / 0.16));
        y = h0 + Math.sin(-pitch) * hb * 0.6;
      } else if (u < L(0.62, 0.45, rw)) {
        pitch = 0;
        y = h0;
      } else {
        // heel rise about the ball of the foot
        const k = (u - L(0.62, 0.45, rw)) / (1 - L(0.62, 0.45, rw));
        pitch = toePitch * Math.pow(k, 1.4);
        y = h0 * Math.cos(pitch) + fb * Math.sin(pitch);
        z += fb * (1 - Math.cos(pitch)) + h0 * Math.sin(pitch) * 0.4;
      }
      contact = 1;
    } else {
      const u = (ph - beta) / (1 - beta);
      const z0 = zOff + fb * (1 - Math.cos(toePitch)) + h0 * Math.sin(toePitch) * 0.4;
      const e = smooth01(u);
      // running: the heel first kicks back toward the buttock, then the foot comes through high
      const kick = rw * Math.sin(Math.PI * Math.min(1, u / 0.55)) * (0.1 + 0.05 * v) * (1 - e);
      z = L(z0, zStrike, e) - kick;
      const lift = L(0.07 + 0.015 * v, 0.14 + 0.07 * v, rw);
      y = L(h0 * Math.cos(toePitch) + fb * Math.sin(toePitch), h0 + Math.sin(-strikePitch) * hb * 0.6, e) + lift * Math.pow(Math.sin(Math.PI * Math.pow(u, L(0.8, 0.6, rw))), 1.2);
      pitch = L(toePitch, strikePitch, smooth01(u * 1.2));
      contact = u > 0.85 ? (u - 0.85) / 0.15 : 0;
    }
    out.set(x, y, z);
    this.footPitch[side] = pitch;
    this.footContact[side] = contact;
  }

  private solveLegs(p: number, v: number, rw: number, legW: number, dt: number) {
    const J = this.j;
    const hr = this.human.root;
    hr.updateWorldMatrix(true, false);
    J.hips.updateWorldMatrix(false, true);
    const ground = this.ground;
    const rootQ = hr.getWorldQuaternion(_q4);
    const baseY = this.root.position.y; // ground under the root (world)
    let dropNeed = 0;
    for (const s of ['L', 'R'] as const) {
      const th = J[`th${s}`], sh = J[`shin${s}`], ft = J[`ft${s}`];
      // FK ankle (world) and FK foot orientation (character space)
      const fk = ft.getWorldPosition(_v2);
      const tgt = this.footTarget[s];
      if (legW > 0.001) {
        this.gaitFoot(s, p, v, rw, _v3);
        hr.localToWorld(_v3); // flat ground under the root
        tgt.copy(fk).lerp(_v3, legW);
      } else {
        tgt.copy(fk);
        this.footContact[s] = 1;
        this.footPitch[s] = 0;
      }
      const contact = THREE.MathUtils.lerp(1, this.footContact[s], legW);
      // terrain: raise the target by the ground height under it
      if (ground) {
        const g = ground(tgt.x, tgt.z);
        tgt.y += g - baseY;
        // reach: how far must the pelvis come down so this (planted) foot can be reached
        const hip = th.getWorldPosition(_v4);
        const reach = (this.human.rig.thighLength + this.human.rig.shinLength) * 0.995;
        const dx = tgt.x - hip.x, dz = tgt.z - hip.z;
        const hz = dx * dx + dz * dz;
        const need = hip.y - tgt.y - Math.sqrt(Math.max(0, reach * reach - hz));
        if (need > 0) dropNeed = Math.max(dropNeed, need * Math.max(contact, 0.35));
      }
      void sh;
    }
    // pelvis drop: immediate when more reach is needed, eased when released
    const drop = Math.min(0.45, dropNeed);
    this.pelvisDrop = drop > this.pelvisDrop ? drop : damp(this.pelvisDrop, drop, 10, dt);
    J.hips.position.y -= this.pelvisDrop;
    J.hips.updateWorldMatrix(false, true);
    for (const s of ['L', 'R'] as const) {
      const th = J[`th${s}`], sh = J[`shin${s}`], ft = J[`ft${s}`];
      // FK foot orientation in character space (before the leg is re-solved)
      const fkFootQ = _q3.copy(rootQ).invert().multiply(ft.getWorldQuaternion(_q2));
      // knee pole from the FK knee (keeps kneeling / crouching knees where the animation put them)
      const hip = th.getWorldPosition(_v4);
      const knee = sh.getWorldPosition(_v5);
      const ank = ft.getWorldPosition(_v7);
      const pole = this.poleFrom(hip, knee, ank, _v8.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y)).addScaledVector(UP, -0.05));
      this.twoBone(th, sh, ft, this.footTarget[s], pole, 1, 'th' + s);
      // foot: blend FK orientation with the gait pitch, align to the ground slope while in contact
      _e1.set(this.footPitch[s], 0, 0);
      _q1.setFromEuler(_e1);
      fkFootQ.slerp(_q1, legW);
      const qWorld = _q2.copy(rootQ).multiply(fkFootQ);
      const contact = THREE.MathUtils.lerp(1, this.footContact[s], legW);
      if (this.ground && contact > 0.01) {
        const t = this.footTarget[s];
        const e = 0.12;
        const hx = this.ground(t.x - e, t.z) - this.ground(t.x + e, t.z);
        const hz = this.ground(t.x, t.z - e) - this.ground(t.x, t.z + e);
        _v3.set(hx, 2 * e, hz).normalize();
        _q1.setFromUnitVectors(UP, _v3);
        _q3.identity().slerp(_q1, contact * 0.85);
        qWorld.premultiply(_q3);
      }
      sh.updateWorldMatrix(false, false);
      const shinQ = sh.getWorldQuaternion(_q1);
      ft.quaternion.copy(shinQ.invert().multiply(qWorld));
      th.updateWorldMatrix(false, true);
    }
  }

  private poleFrom(a: THREE.Vector3, mid: THREE.Vector3, c: THREE.Vector3, fallback: THREE.Vector3) {
    const ac = _v6.subVectors(c, a);
    const l2 = ac.lengthSq();
    const am = _v3.subVectors(mid, a);
    if (l2 > 1e-8) am.addScaledVector(ac, -am.dot(ac) / l2);
    if (am.lengthSq() < 1e-6) return am.copy(fallback).normalize();
    // bias toward the fallback a little so near-straight limbs stay stable
    return am.normalize().multiplyScalar(0.85).addScaledVector(fallback, 0.15).normalize();
  }

  /**
   * Two-bone IK on proxy joints in world space. bend = -1: elbow (the lower limb swings toward +Z of the upper),
   * +1: knee (toward -Z). Writes upper.quaternion and lower.quaternion (pure hinge), slerped by `w` from the FK.
   */
  private twoBone(upper: THREE.Object3D, lower: THREE.Object3D, end: THREE.Object3D, target: THREE.Vector3, pole: THREE.Vector3, bend: 1 | -1, key: string, w = 1) {
    if (w <= 0.001) return;
    const a = lower.position.length(), b = end.position.length();
    upper.updateWorldMatrix(true, false);
    const S = _v1.setFromMatrixPosition(upper.matrixWorld);
    const D = _v2.subVectors(target, S);
    let d = D.length();
    if (d < 1e-5) return;
    D.divideScalar(d);
    d = clamp(d, Math.abs(a - b) + 0.01, a + b - 0.0015);
    const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    // in-plane direction toward the pole
    const pp = _v3.copy(pole).addScaledVector(D, -pole.dot(D));
    if (pp.lengthSq() < 1e-8) pp.set(0, 0, 1).addScaledVector(D, -D.z);
    pp.normalize();
    const u = _v4.copy(D).multiplyScalar(cosA).addScaledVector(pp, sinA); // upper limb direction
    const Ex = S.x + u.x * a, Ey = S.y + u.y * a, Ez = S.z + u.z * a;
    const f = _v5.set(S.x + D.x * d - Ex, S.y + D.y * d - Ey, S.z + D.z * d - Ez).normalize(); // lower direction
    const Yp = _v6.copy(u).negate();
    const perp = _v7.copy(f).addScaledVector(u, -f.dot(u));
    if (perp.lengthSq() < 1e-8) perp.copy(pp).negate();
    perp.normalize();
    if (bend === 1) perp.negate();
    const Xp = _v8.crossVectors(Yp, perp).normalize();
    _m1.makeBasis(Xp, Yp, perp);
    const qWorld = _q1.setFromRotationMatrix(_m1).multiply(_q2.copy(this.restFix[key]).invert());
    const parentQ = upper.parent!.getWorldQuaternion(_q2);
    const local = parentQ.invert().multiply(qWorld);
    upper.quaternion.slerp(local, w);
    const interior = Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
    const ang = (Math.PI - interior) * (bend === 1 ? 1 : -1);
    _q3.setFromAxisAngle(X_AXIS, ang);
    lower.quaternion.slerp(_q3, w);
    upper.updateWorldMatrix(false, true);
  }

  // ----------------------------------------------------------------------------------- arms / staff
  /** rotate the hand proxy so the staff (socket +Y) points along `dir` (world), weight w */
  private alignHand(side: 'L' | 'R', dir: THREE.Vector3, w: number) {
    if (w <= 0.001) return;
    const hd = this.j[`hd${side}`], fa = this.j[`fa${side}`];
    hd.updateWorldMatrix(true, false);
    const hq = hd.getWorldQuaternion(_q1);
    const axis = _v1.copy(UP).applyQuaternion(this.sockRestQ[side]).applyQuaternion(hq);
    _q2.setFromUnitVectors(axis, _v2.copy(dir).normalize());
    const newWorld = _q2.multiply(hq);
    const faQ = fa.getWorldQuaternion(_q3);
    const local = faQ.invert().multiply(newWorld);
    hd.quaternion.slerp(local, w);
    hd.updateWorldMatrix(false, true);
  }

  /** world position of the grip socket predicted from the hand proxy */
  private gripWorld(side: 'L' | 'R', out: THREE.Vector3) {
    const hd = this.j[`hd${side}`];
    hd.updateWorldMatrix(true, false);
    const hq = hd.getWorldQuaternion(_q4);
    return out.copy(this.sockRestOff[side]).applyQuaternion(hq).add(_v8.setFromMatrixPosition(hd.matrixWorld));
  }

  private armIK(side: 'L' | 'R', gripTarget: THREE.Vector3, pole: THREE.Vector3, w: number) {
    if (w <= 0.001) return;
    const J = this.j;
    _poleIK.copy(pole);
    _gripIK.copy(gripTarget);
    const ua = J[`ua${side}`], fa = J[`fa${side}`], hd = J[`hd${side}`];
    _uaQ.copy(ua.quaternion);
    _faQ.copy(fa.quaternion);
    // aim the wrist so that the grip socket lands on the target; the socket offset depends on the hand orientation,
    // which the solve itself changes -> two passes (the second from the first pass's hand orientation)
    for (let it = 0; it < 2; it++) {
      const g = this.gripWorld(side, _v5);
      const wrist = _v6.setFromMatrixPosition(hd.matrixWorld);
      _tmpTarget.copy(_gripIK).sub(g).add(wrist);
      if (it === 0) this.twoBone(ua, fa, hd, _tmpTarget, _poleIK, -1, `ua${side}`, 1);
      else {
        // restart from the FK pose so the final blend weight applies to the FK -> IK difference
        _tmp2.copy(_tmpTarget);
        ua.quaternion.copy(_uaQ);
        fa.quaternion.copy(_faQ);
        ua.updateWorldMatrix(false, true);
        this.twoBone(ua, fa, hd, _tmp2, _poleIK, -1, `ua${side}`, w);
      }
    }
  }

  private solveArms(dt: number) {
    const J = this.j;
    const c = this.mixer.cur.r;
    const H = this.holdW;
    const hr = this.human.root;
    const rootQ = hr.getWorldQuaternion(_rootQ);
    // staff slide (strike grip near the butt) and back carry
    const onBack = this.staffMode === 'back' || this.hold === 'carry' || this.hold === 'pull';
    this.staffBackW = damp(this.staffBackW, onBack ? 1 : 0, 7, dt);
    const planted = clamp(c.plantW[0], 0, 1) * (1 - this.locoW);
    const slideT = this.staffMode === 'strike' && !onBack ? 0.82 : 0.22 * (1 - planted) + 0.5 * H.kneel;
    this.staffSlide = damp(this.staffSlide, slideT, 11, dt);
    const inHand = 1 - this.staffBackW;
    // staff direction (character -> world)
    const sd = c.staff;
    const dirW = _dirW.set(sd[0], sd[1], sd[2]);
    if (dirW.lengthSq() < 1e-6) dirW.set(0, 1, 0);
    dirW.normalize().applyQuaternion(rootQ);
    const staffW = clamp(c.staffW[0], 0, 1) * inHand;
    // plant: arm IK so that the butt rests on the ground at c.butt (character space)
    const plantW = clamp(c.plantW[0], 0, 1) * inHand * (1 - this.locoW) * (this.staffMode === 'plant' ? 1 : 0);
    if (plantW > 0.001) {
      const butt = _butt.set(c.butt[0], 0, c.butt[2]);
      hr.localToWorld(butt);
      butt.y = this.ground ? this.ground(butt.x, butt.z) + 0.005 : this.root.position.y;
      const grip = _grip.copy(butt).addScaledVector(dirW, this.staffGripDist - this.staffSlide);
      const pole = _pole.set(0.35, -1, -0.45).applyQuaternion(rootQ);
      for (let it = 0; it < 2; it++) {
        this.alignHand('L', dirW, staffW);
        this.armIK('L', grip, pole, plantW);
      }
    }
    this.alignHand('L', dirW, staffW);

    // right hand targets
    const right = _rt;
    let rw = 0;
    if (H.grab > 0.01 && this.lookTarget) {
      // the beard: under the bear's head, toward David
      right.copy(this.lookTarget);
      J.chest.getWorldPosition(_v3);
      _v2.subVectors(_v3, right).setY(0).normalize();
      right.addScaledVector(_v2, 0.16).add(_v1.set(0, -0.22, 0));
      rw = H.grab;
      this.armIK('R', right, _pole.set(-0.6, -0.8, -0.2).applyQuaternion(rootQ), rw * 0.85);
    }
    if (this.action?.name === 'call' && this.actionW > 0.01) {
      // hand cupped at the right side of the mouth
      this.human.sockets.mouth.getWorldPosition(right);
      right.add(_v2.set(-0.045, -0.005, 0.045).applyQuaternion(J.head.getWorldQuaternion(_q2)));
      this.armIK('R', right, _pole.set(-1, -0.5, -0.2).applyQuaternion(rootQ), this.actionW);
    }
    if (H.thanks > 0.01) {
      // flat hand on the chest (heart side)
      J.chest.updateWorldMatrix(true, false);
      right.set(0.045, 0.19, 0.155).applyMatrix4(J.chest.matrixWorld);
      this.armIK('R', right, _pole.set(-0.6, -1, -0.1).applyQuaternion(rootQ), H.thanks * (1 - this.locoW));
    }
    if (H.carry > 0.01) {
      // hands on the lamb's legs in front of the shoulders
      const sc = this.shoulderSocket;
      sc.updateWorldMatrix(true, false);
      for (const s of ['L', 'R'] as const) {
        const sg = s === 'L' ? 1 : -1;
        const t = _v5.set(0, 0, 0).applyMatrix4(sc.matrixWorld);
        t.add(_v2.set(sg * 0.2, -0.1, 0.17).applyQuaternion(J.chest.getWorldQuaternion(_q2)));
        this.armIK(s, _carryT.copy(t), _pole.set(sg * 0.7, -1, -0.1).applyQuaternion(rootQ), H.carry);
      }
    }
    // pick: after the grasp, the stone goes to the satchel at the left hip
    if (this.action?.name === 'pick' && this.hold !== 'carry') {
      const t = this.action.t;
      const w = smooth01((t - 0.58) / 0.14) * (1 - smooth01((t - 0.86) / 0.14)) * this.actionW;
      if (w > 0.001 && this.outfit.props.satchel) {
        this.outfit.props.satchel.getWorldPosition(right);
        right.add(_v2.set(0.02, 0.02, 0.1).applyQuaternion(rootQ));
        this.armIK('R', right, _pole.set(-0.8, -0.6, -0.3).applyQuaternion(rootQ), w);
      }
    }
    void rw;
  }

  /** put the staff object where the hand (or the back) holds it — after human.update() */
  private placeStaff(_dt: number) {
    const hr = this.human.root;
    const o = this.staff;
    // in the hand: attachProp frame, slid along the shaft for strikes
    const hand = this.handSocketL.matrixWorld;
    _v1.copy(this.staffBasePos).add(_v2.set(0, this.staffSlide, 0));
    _m1.compose(_v1, this.staffBaseQ, _s1.set(1, 1, 1));
    _m1.premultiply(hand);
    if (this.staffBackW > 0.001) {
      this.staffBack.updateWorldMatrix(true, false);
      _v1.copy(this.staffBasePos).add(_v2.set(0, 0.3, 0));
      _m2.compose(_v1, this.staffBaseQ, _s1.set(1, 1, 1)).premultiply(this.staffBack.matrixWorld);
      _m1.decompose(_v3, _q1, _s1);
      _m2.decompose(_v4, _q2, _s1);
      const w = smooth01(this.staffBackW);
      _v3.lerp(_v4, w);
      _q1.slerp(_q2, w);
      _m1.compose(_v3, _q1, _s1.set(1, 1, 1));
    }
    _m2.copy(hr.matrixWorld).invert().multiply(_m1);
    _m2.decompose(o.position, o.quaternion, _s1);
    o.updateMatrixWorld(true);
  }

  private updateProps() {
    // stone in the right hand while picking (hidden once it is in the satchel, never while taking up the lamb)
    const a = this.action;
    const holdingStone = !!a && a.name === 'pick' && a.t > 0.5 && a.t < 0.86 && this.hold !== 'carry';
    this.handStone.visible = holdingStone;
  }

  private updateFace() {
    const rig = this.human.rig;
    const a = this.action;
    const H = this.holdW;
    let e: Expression = 'neutral', w = 1;
    if (this.mood) e = this.mood;
    else if (a && a.name === 'hurt') e = 'pain';
    else if (a && (a.name === 'throw' || a.name === 'strike' || a.name === 'strikeHigh')) e = 'effort';
    else if (this.hold === 'pull') e = 'effort';
    else if (this.hold === 'grab') { e = 'anger'; w = 0.85; }
    else if (this.hold === 'spin') { e = 'determined'; w = 0.6 + 0.4 * this.spinPower; }
    else if (this.hold === 'thanks') e = 'awe';
    else if (this.hold === 'carry') { e = 'smile'; w = 0.3; }
    else if (a && a.name === 'call') { e = 'determined'; w = 0.3; }
    else if (this.runW > 0.5) { e = 'determined'; w = 0.45; }
    if (e !== this.lastExpr || Math.abs(w - this.lastExprW) > 0.05) {
      rig.setExpression(e, w);
      this.lastExpr = e;
      this.lastExprW = w;
    }
    rig.jawOpen = a && a.name === 'call' ? 0.22 * this.actionW : this.exertion * 0.05 + (this.hold === 'pull' ? 0.04 : 0);
    // fingers
    const inHand = this.staffBackW < 0.5;
    const L: FingerPose = inHand ? 'grip' : H.carry > 0.5 ? 'grip' : this.hold === 'pull' ? 'fist' : 'relaxed';
    let R: FingerPose = 'fist';
    if (a && a.name === 'pick' && this.hold !== 'carry') R = a.t < 0.46 ? 'open' : 'fist';
    else if (a && a.name === 'call') R = 'cup';
    else if (this.hold === 'thanks') R = 'open';
    else if (this.hold === 'carry' || this.hold === 'pull') R = 'grip';
    else if (this.hold === 'grab') R = 'fist';
    if (L !== this.fingerL) { rig.setFingers('L', L); this.fingerL = L; }
    if (R !== this.fingerR) { rig.setFingers('R', R); this.fingerR = R; }
  }

  // ----------------------------------------------------------------------------------- sling
  /** Simulate the sling in world space. `aimDir` is the horizontal throwing direction (world). */
  updateSling(dt: number, aimDir: THREE.Vector3) {
    const S = this.sling;
    const hidden = S.state === 'stowed' || this.hold === 'carry' || this.hold === 'pull' || this.hold === 'grab' || this.hold === 'thanks' || this.hold === 'kneel';
    const show = !hidden && this.root.visible;
    if (show !== this.slingShown) {
      this.slingShown = show;
      this.cordA.mesh.visible = this.cordB.mesh.visible = this.pouch.visible = show;
      if (!show) this.slingInit = false;
    }
    if (!show) return;
    this.slingAnchor.updateWorldMatrix(true, false);
    const hand = _hand.setFromMatrixPosition(this.slingAnchor.matrixWorld);
    const rootQ = this.root.getWorldQuaternion(_q4);
    const side = _side.set(1, 0, 0).applyQuaternion(rootQ);
    const sim = this.sim;
    if (!this.slingInit) {
      sim.reset(hand, side);
      S.pouch.copy(sim.a[NC - 1]).add(sim.b[NC - 1]).multiplyScalar(0.5);
      S.prev.copy(S.pouch);
      this.slingInit = true;
    }
    // leg capsules for collisions (world)
    let capCount = 0;
    const bones = this.human.bones;
    for (const cap of this.outfit.capsules) {
      if (capCount >= 4) break;
      const A = bones[cap.a], B = bones[cap.b];
      if (!A || !B) continue;
      A.getWorldPosition(_v1);
      B.getWorldPosition(_v2);
      const o = capCount * 7, C = this.caps;
      C[o] = _v1.x; C[o + 1] = _v1.y; C[o + 2] = _v1.z; C[o + 3] = _v2.x; C[o + 4] = _v2.y; C[o + 5] = _v2.z; C[o + 6] = cap.radius + 0.035;
      capCount++;
    }
    const steps = 3;
    const h = Math.min(dt, 1 / 20) / steps;
    S.prev.copy(S.pouch);
    const throwing = this.action?.name === 'throw' && S.state === 'spin';
    if (S.state === 'spin') {
      // whirl: the pouch runs on a circle above the head, tilted toward the target; the cords follow
      const aim = _aim.copy(aimDir).setY(0);
      if (aim.lengthSq() < 1e-6) aim.set(0, 0, 1).applyQuaternion(rootQ);
      aim.normalize();
      const speed = (Math.PI * 2) * (1.7 + this.spinPower * 4.6);
      this.spinPhase += dt * speed;
      const up = _v3.set(0, 1, 0).addScaledVector(aim, -0.3).normalize();
      const u = _v4.crossVectors(up, aim).normalize();
      const wv = _v5.crossVectors(u, up).normalize();
      const R = CORD_LEN * 0.97;
      let tx: number, ty: number, tz: number;
      if (throwing) {
        // release swing: the pouch whips over the shoulder and forward along the aim
        const k = clamp(this.action!.t / 0.19, 0, 1);
        const ang = THREE.MathUtils.lerp(1.35, 0.15, k * k);
        tx = hand.x + (aim.x * Math.cos(ang) + up.x * Math.sin(ang)) * R;
        ty = hand.y + (aim.y * Math.cos(ang) + up.y * Math.sin(ang)) * R;
        tz = hand.z + (aim.z * Math.cos(ang) + up.z * Math.sin(ang)) * R;
      } else {
        const a = this.spinPhase;
        tx = hand.x + (u.x * Math.cos(a) + wv.x * Math.sin(a)) * R - up.x * 0.05;
        ty = hand.y + (u.y * Math.cos(a) + wv.y * Math.sin(a)) * R - up.y * 0.05;
        tz = hand.z + (u.z * Math.cos(a) + wv.z * Math.sin(a)) * R - up.z * 0.05;
      }
      const k = 1 - Math.exp(-(throwing ? 45 : 28) * dt);
      S.pouch.x += (tx - S.pouch.x) * k;
      S.pouch.y += (ty - S.pouch.y) * k;
      S.pouch.z += (tz - S.pouch.z) * k;
      // pouch across the direction of travel
      const vel = _v1.subVectors(S.pouch, S.prev);
      if (vel.lengthSq() < 1e-10) vel.copy(u);
      vel.normalize();
      for (let i = 0; i < steps; i++) {
        sim.integrate(h, 0.96, true);
        sim.a[NC - 1].copy(S.pouch).addScaledVector(vel, -POUCH_W * 0.5);
        sim.b[NC - 1].copy(S.pouch).addScaledVector(vel, POUCH_W * 0.5);
        sim.constrain(hand, 3, this.caps, 0, hand, true);
      }
      sim.pa[NC - 1].copy(sim.a[NC - 1]);
      sim.pb[NC - 1].copy(sim.b[NC - 1]);
    } else {
      // hanging / released: verlet chain, B's hand end free after the release until David gathers it again
      if (S.state === 'release') {
        S.releaseT += dt;
        sim.bPinned = false;
        if (S.releaseT > 0.55) {
          S.state = 'idle';
          this.reloadT = S.loaded ? -1 : 0;
        }
      }
      let pinB: THREE.Vector3 | null = hand;
      if (!sim.bPinned) {
        if (S.state === 'release') pinB = null;
        else {
          // gather the loose cord back into the fist
          const b0 = sim.b[0];
          b0.lerp(hand, 1 - Math.exp(-14 * dt));
          if (b0.distanceTo(hand) < 0.01) sim.bPinned = true;
          pinB = _pinB.copy(b0);
        }
      }
      for (let i = 0; i < steps; i++) {
        sim.integrate(h, 0.97, false);
        if (!pinB) {
          // free cord end: integrate it too
          const p0 = sim.b[0], q0 = sim.pb[0];
          const vx = (p0.x - q0.x) * 0.98, vy = (p0.y - q0.y) * 0.98, vz = (p0.z - q0.z) * 0.98;
          q0.copy(p0);
          p0.x += vx; p0.y += vy - 9.81 * h * h; p0.z += vz;
        }
        sim.constrain(hand, 4, this.caps, capCount, pinB, false);
      }
      S.pouch.copy(sim.a[NC - 1]).add(sim.b[NC - 1]).multiplyScalar(0.5);
    }
    // ropes + pouch orientation
    for (let i = 0; i < NC; i++) {
      this.cordA.points[i].copy(sim.a[i]);
      this.cordB.points[i].copy(sim.b[i]);
    }
    this.cordA.update();
    this.cordB.update(S.state === 'release' ? 0.3 : 0);
    const X = _v1.subVectors(sim.b[NC - 1], sim.a[NC - 1]);
    if (X.lengthSq() < 1e-10) X.copy(side);
    X.normalize();
    const Y = _v2.subVectors(hand, S.pouch);
    Y.addScaledVector(X, -Y.dot(X));
    if (Y.lengthSq() < 1e-10) Y.set(0, 1, 0);
    Y.normalize();
    const Z = _v3.crossVectors(X, Y);
    _m1.makeBasis(X, Y, Z);
    this.pouch.quaternion.setFromRotationMatrix(_m1);
    this.pouch.position.copy(S.pouch);
    this.pouch.updateMatrixWorld(true);
    const showStone = S.loaded && S.state !== 'release' && !(this.reloadT >= 0 && this.reloadT < 0.55);
    if (showStone !== this.stoneShown) {
      this.pouchStone.visible = showStone;
      this.stoneShown = showStone;
    }
  }

  releaseSling(): { pos: THREE.Vector3; vel: THREE.Vector3 } {
    const S = this.sling;
    const pos = S.pouch.clone();
    const vel = S.pouch.clone().sub(S.prev);
    // the pouch keeps its momentum when the cord slips
    const sim = this.sim;
    const dv = _v1.copy(vel);
    for (let i = 1; i < NC; i++) {
      sim.pa[i].copy(sim.a[i]).sub(_v2.copy(dv).multiplyScalar(i / (NC - 1)));
      sim.pb[i].copy(sim.b[i]).sub(_v2.copy(dv).multiplyScalar(i / (NC - 1)));
    }
    S.state = 'release';
    S.releaseT = 0;
    S.loaded = false;
    return { pos, vel };
  }
}

const SPIN_ALL = Object.keys(SPIN.r);
const HOLDS: readonly HoldPose[] = ['none', 'spin', 'grab', 'carry', 'kneel', 'thanks', 'pull', 'hero'];
const WALK_MASK = ['hips', 'hipsX', ...TORSO, ...UPPER_L, ...UPPER_R, 'staff', 'staffW', 'plantW'];
const SPIN_UPPER = [...UPPER_R, ...UPPER_L, ...TORSO, 'staff', 'staffW', 'plantW'];
const CARRY_MASK = [...UPPER_L, ...UPPER_R, 'chest', 'neck', 'head', 'staffW', 'plantW'];
const THANKS_UPPER = [...UPPER_L, ...UPPER_R, ...TORSO];
const RELOAD = pose({ uaR: E(-0.35, 0, 0.3), faR: E(-1.2), hdR: E(0.3), chest: E(0.08, 0.12), head: E(0.28, 0.25), neck: E(0.1, 0.1) });
const RELOAD_MASK = [...UPPER_R, 'chest', 'head', 'neck'];
const _tmpTarget = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _poleIK = new THREE.Vector3();
const _gripIK = new THREE.Vector3();
const _uaQ = new THREE.Quaternion();
const _faQ = new THREE.Quaternion();
const _rootQ = new THREE.Quaternion();
const _dirW = new THREE.Vector3();
const _butt = new THREE.Vector3();
const _grip = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _rt = new THREE.Vector3();
const _carryT = new THREE.Vector3();
const _hand = new THREE.Vector3();
const _side = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _pinB = new THREE.Vector3();
export { LEGS };
