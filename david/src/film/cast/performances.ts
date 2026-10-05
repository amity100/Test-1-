import * as THREE from 'three';
import type { Expression } from '../../characters/human/HumanRig';
import {
  actionTime as blockingActionTime, armyAt, BEATS, HALT_PLANT, STOP_PLANT, SAM_AWAY_YAW, SAM_FREED, SAM_HELD, SAM_PACE, SAM_STOP,
  SAM_TURN_CUT, samuelAt, saulAt, SAUL_TEAR, SHOT_LEN, TEAR_ACTION, TEAR_KNEEL, tearKneelMark, tearPath, timeScale, type GilgalShotName,
} from '../gilgal/gilgalBlocking';
import { SpearFall } from '../gilgal/spearFall';
import { INTRO_SHOTS, VERDICT_WORDS, type IntroWord } from '../../content/introScript';
import type { FilmActor, ArmPose } from './FilmActor';

/*
 * Performances of the opening film, CUT v3 (docs/intro-script-v3.md "Performances": 13 long takes, 1.5-2x longer than
 * CUT v2 — nothing may stop, freeze or loop visibly inside them; docs/intro-script-v2.md for the performance brief).
 * Every beat is read from the shared timing contract (src/content/introScript.ts -> src/film/gilgal/gilgalBlocking
 * BEATS / TEAR_ACTION / SHOT_LEN), so the actors, the cameras and the score stay in register.
 *
 *   GilgalPerformance  G1-G7 on the Gilgal set (motion capture: Microsoft Rocketbox + CMU, layered with procedural
 *                      acting: look-at with the rig's saccades and blinks, breathing, weight shifts, grip IK, face keys)
 *     Saul   G1-G2  the king's stride (Rocketbox m_walk_cool, speed-matched to the column; the slow motion of G2 slows
 *                   the clock of the body, hair and cloth alike): the spear carried upright in the right hand but
 *                   swinging with the stride, the helmet under the left arm, head up, eyes on the road, late in G2 a
 *                   turn of the head.
 *            G3     the halt (m_walk_stop's last step) and the THRUST: a knee dip, then the spear driven up with the
 *                   whole body (the legs extend, the chest arches, the head goes back), the mouth open in the shout.
 *            G4     the roar dies: the spear still high, then lowered; heavy breath; his eyes find the old man.
 *            G5     (TEAR_ACTION, action time) Samuel turns to go (turn); Saul steps after him and lunges (lunge), the
 *                   fist closes on the lower corner of the me'il (grip, arm IK on the skinned cloth), he pulls back
 *                   (pull), the wool rips (rip .. free), the corner stays in his fist (15:27; desperation, not violence).
 *            G6     holds the torn piece, listens; the verdict lands in his face; his shoulder is the foreground.
 *            G7     looks down at the fist (lookDown), breathing hard, a tremble, the fingers tighten (tighten).
 *     Samuel G4     stands in the road, the mantle and the hair in the wind; one step toward the king (step).
 *            G5     the turn-step of an old man (Rocketbox m_turn_left_180_to_walk, root motion applied): he turns
 *                   away to his left and walks; the seized corner jerks him, he leans against it, it tears, he stops
 *                   and looks back over his shoulder.
 *            G6     turns back (turnBack) and speaks 15:28a: the jaw and lips paced to the verse's words as they appear
 *                   (VERDICT_WORDS of introScript.ts: syllables with their vowels), eyes locked on Saul's eyes, a
 *                   slight tilt of the head, small nods on the stresses.
 *            G7     turns away and walks east (background).
 *   RamahPerformance   P5: the elders are alive — one rises from his seat and demands with his arm raised (Rocketbox
 *                      stand-up + talk_angry, 8:5), the others gesture, lean in, cross their arms; Samuel listens
 *                      (listen_sad) and turns his face away at the beat turnAway (8:6, listen_deny).
 */

export const GILGAL_CLIPS = [
  'walk_cool', 'walk_stop_rb', 'idle_king', 'idle_breathe', 'listen_sad', 'turn_go_L', 'walk_slow', 'walk', 'idle_n1',
];
export const RAMAH_CLIPS = [
  'listen_sad', 'listen_deny_b', 'stand_up', 'talk_angry', 'talk_excited', 'listen_angry', 'idle_angry', 'talk_gesture', 'idle_n1',
];
/** every clip the film's cast plays that the game does not (release after the film) */
export const FILM_CAST_CLIPS = [...new Set([...GILGAL_CLIPS, ...RAMAH_CLIPS])].filter((c) => c !== 'walk');

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mixPose = (a: ArmPose, b: ArmPose, t: number): ArmPose => ({ ua: lerp3(a.ua, b.ua, t), fa: lerp3(a.fa, b.fa, t), hd: lerp3(a.hd, b.hd, t) });
/**
 * G4 (cut7, CUT v5.2): Samuel's jaw as he answers the king (15:26 on screen from beats.verse): syllables at ~4.4 Hz in
 * three phrases with short breaths between them, each syllable its own opening; closed before and after.
 */
function g4Speech(t: number) {
  const v0 = (INTRO_SHOTS.find((s) => s.take === 'silence')?.beats?.verse ?? 3.0) + 0.15;
  const phrases: [number, number][] = [[0, 0.95], [1.2, 2.05], [2.3, 3.05]];
  const x = t - v0;
  let on = 0;
  for (const [a, b] of phrases) on = Math.max(on, ss(a, a + 0.06, x) * (1 - ss(b - 0.08, b, x)));
  if (on <= 0) return 0;
  const syl = Math.max(0, Math.sin(x * 2 * Math.PI * 4.4));
  return on * (0.05 + 0.16 * syl * (0.7 + 0.3 * Math.sin(x * 7.3 + 1.1)));
}

/** smooth value noise (-1..1) for tremble / sway */
function noise1(x: number, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const h = (n: number) => {
    const s = Math.sin((n + seed * 17.3) * 127.1) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

/** action time of a Gilgal shot at shot time t (the integral of the blocking's timeScale) */
export const actionTime = blockingActionTime;

/** THE TEAR in action time (see gilgalBlocking TEAR_ACTION): turn, lunge, grip, pull, rip, free (legacy name) */
export const TEAR_BEATS = TEAR_ACTION;
/** MeilTear.progress once the corner is free: every tear-line vertex released (thresholds reach ~1.11) */
const TORN = 1.2;
/** G5: Samuel's walking pace at action time `at` (gilgalBlocking SAM_*: walking away, held by the corner, freed) */
function samPace(at: number) {
  const A = TEAR_ACTION;
  const held = ss(A.grip - 0.04, A.grip + 0.14, at);
  const freed = ss(A.free, A.free + 0.12, at);
  return (SAM_PACE + (SAM_HELD - SAM_PACE) * held) * (1 - freed) + SAM_FREED * freed;
}
/** G5: Saul on his knee behind the corner (gilgalBlocking TEAR_KNEEL: his root relative to the grab point) */
export { TEAR_KNEEL };

/** arm holds (proxy Euler, character axes; x < 0 swings forward; L: +z = outward, R: -z = outward) */
export const POSES = {
  /** the bronze helmet cradled under the left arm against the hip */
  helmetL: { ua: [0.08, 0, 0.2], fa: [-1.4, 0, 0], hd: [0, 0, 0] } as ArmPose,
  /** spear carried upright in the right hand, elbow bent, hand at the belt */
  spearCarryR: { ua: [-0.12, -0.1, -0.16], fa: [-1.2, 0, 0], hd: [0.1, 0, 0.05] } as ArmPose,
  /** the spear thrust to the sky (G3): the arm fully up, a little forward */
  spearRaiseR: { ua: [-2.95, 0.1, -0.22], fa: [-0.12, 0, 0], hd: [0.25, 0, 0] } as ArmPose,
  /** the fist with the torn cloth held low at his side, before the belt (G6: kept out of the over-the-shoulder view of
   *  Samuel's face — at chest height it covered the face) */
  clothFistR: { ua: [-0.14, 0.05, -0.14], fa: [-0.75, 0.25, 0], hd: [0.12, 0, 0] } as ArmPose,
  /** G7: the fist raised a little into his own eye-line, the cloth hanging from it (readable in the foreground) */
  clothLookR: { ua: [-0.5, 0.08, -0.06], fa: [-1.55, 0.35, 0], hd: [0.3, 0, 0.1] } as ArmPose,
};

/**
 * (CUT v6.1, cut7) Saul's spear after the roar: lowered (G3 `notice` -> G4 0.9 s) and set down PLANTED at his right side,
 * gripped in his fist (fingers closed round the shaft); in G5a at `drop` the hand opens and it falls (SpearFall) and
 * lies in the dust through G5b-G7. The butt `fwd` / `right` m from his G4 mark, leaning `lean` rad toward the side it
 * falls to (`fallSide` rad from his right toward his back), `push` = the opening hand's nudge (rad/s); the fist on the
 * shaft `gripAt` m above the butt (the leather binding).
 */
const SPEAR = { fwd: 0.24, right: 0.36, lean: 0.15, push: 0.4, fallSide: 0.44, length: 2.5, gripAt: 1.3, plant0: 0.9, plant1: 1.5 };

/** smooth expression mixer: set targets, it eases the rig's expression weights (+ the jaw and the visemes) */
export class FaceDriver {
  readonly target: Partial<Record<Expression, number>> = {};
  private cur: Partial<Record<Expression, number>> = {};
  jawTarget = 0;
  private jaw = 0;
  /** mouth shape targets (MakeHuman face units, e.g. LipsKiss) — eased like the jaw */
  readonly lips: Record<string, number> = {};
  private lipsCur: Record<string, number> = {};
  /** jaw follow rate (1/s): 18 is a speaking mouth; lower for slow moves */
  jawRate = 18;
  /** other face units (brows, lids …), eased at the expression rate */
  readonly units: Record<string, number> = {};
  private unitsCur: Record<string, number> = {};
  constructor(readonly actor: FilmActor, readonly rate = 3) {}
  set(t: Partial<Record<Expression, number>>) {
    for (const k in this.target) this.target[k as Expression] = 0;
    Object.assign(this.target, t);
  }
  snap() {
    Object.assign(this.cur, this.target);
    Object.assign(this.unitsCur, this.units);
    this.jaw = this.jawTarget;
  }
  update(dt: number) {
    const k = 1 - Math.exp(-this.rate * dt);
    const rig = this.actor.human.rig;
    const keys = new Set([...Object.keys(this.target), ...Object.keys(this.cur)]) as Set<Expression>;
    for (const e of keys) {
      const c = (this.cur[e] ?? 0) + ((this.target[e] ?? 0) - (this.cur[e] ?? 0)) * k;
      this.cur[e] = c;
      rig.setExpressionWeight(e, c);
    }
    const kj = 1 - Math.exp(-this.jawRate * dt);
    this.jaw += (this.jawTarget - this.jaw) * kj;
    rig.jawOpen = this.jaw;
    for (const u of new Set([...Object.keys(this.lips), ...Object.keys(this.lipsCur)])) {
      const c = (this.lipsCur[u] ?? 0) + ((this.lips[u] ?? 0) - (this.lipsCur[u] ?? 0)) * kj;
      this.lipsCur[u] = c;
      if (Math.abs(c) < 1e-3) delete rig.faceUnits[u];
      else rig.faceUnits[u] = c;
    }
    for (const u of new Set([...Object.keys(this.units), ...Object.keys(this.unitsCur)])) {
      if (u in this.lips) continue;
      const c = (this.unitsCur[u] ?? 0) + ((this.units[u] ?? 0) - (this.unitsCur[u] ?? 0)) * k;
      this.unitsCur[u] = c;
      if (Math.abs(c) < 1e-3) delete rig.faceUnits[u];
      else rig.faceUnits[u] = c;
    }
  }
  /** clear the mouth shapes (and the extra units) */
  quiet() {
    for (const k in this.lips) this.lips[k] = 0;
    for (const k in this.units) this.units[k] = 0;
    this.jawTarget = 0;
  }
}

/** speech jaw curve for a line of `syllables` over `dur` s with pauses at the given fractions (generic murmur) */
export function speechJaw(t: number, dur: number, syllables: number, pauses: number[] = [], seed = 1) {
  if (t < 0 || t > dur) return 0;
  const u = t / dur;
  for (const p of pauses) if (Math.abs(u - p) < 0.035) return 0;
  const ph = u * syllables;
  const i = Math.floor(ph);
  const f = ph - i;
  const h = Math.sin((i + 1) * 12.9898 * seed) * 43758.5453;
  const amp = 0.08 + 0.14 * (h - Math.floor(h));
  return amp * Math.sin(Math.PI * f) ** 1.5;
}

/**
 * G3 (CUT v3): the roar held for 3.3 s to the cut, as three shouts with a breath between them — `shout` 0..1 (the
 * mouth open, the voice out), `breath` 0..1 (the chest heaving between shouts), and the spear re-thrust at each new
 * shout (`pump.dip`: the arm and the body dip, `pump.up`: driven up again). Keyed to the beat `roar`; `end` = the cut.
 */
export function roarPulse(t: number, roar: number, end: number, phase = 0) {
  const win = (a: number, b: number) => ss(a - 0.08, a + 0.15, t) * (1 - ss(b - 0.2, b + 0.05, t));
  const r = roar + phase;
  const shout = Math.min(1, win(r, r + 1.25) + win(r + 1.55, r + 2.55) + win(r + 2.85, end + 0.6));
  const bump = (c: number, w: number) => Math.exp(-(((t - c) / w) ** 2));
  return {
    shout,
    breath: ss(r + 1.0, r + 1.4, t) * (1 - shout),
    pump: { dip: bump(r + 1.38, 0.2) + bump(r + 2.68, 0.2), up: bump(r + 1.62, 0.18) + bump(r + 2.92, 0.18) },
  };
}

/**
 * The vowels of 1 Samuel 15:28a as Samuel says it, one list per word of VERDICT_WORDS (the Name is read as three
 * syllables): קָרַע · ה׳ · אֶת־מַמְלְכוּת · יִשְׂרָאֵל · מֵעָלֶיךָ · הַיּוֹם. `m` = the syllable opens on a bilabial
 * (the lips close before it: m, b, p).
 */
const VERDICT_VOWELS: { v: string; m?: boolean }[][] = [
  [{ v: 'a' }, { v: 'a' }],
  [{ v: 'a' }, { v: 'o' }, { v: 'a' }],
  [{ v: 'e' }, { v: 'a', m: true }, { v: 'e' }, { v: 'u' }],
  [{ v: 'i' }, { v: 'a' }, { v: 'e' }],
  [{ v: 'e', m: true }, { v: 'a' }, { v: 'e' }, { v: 'a' }],
  [{ v: 'a' }, { v: 'o' }],
];
/** jaw opening and lip shape per vowel (MakeHuman units) — sized to read at a close-up's distance */
const VOWEL: Record<string, { jaw: number; kiss: number; spread: number }> = {
  a: { jaw: 0.5, kiss: 0, spread: 0.05 },
  e: { jaw: 0.3, kiss: 0, spread: 0.32 },
  i: { jaw: 0.16, kiss: 0, spread: 0.45 },
  o: { jaw: 0.36, kiss: 0.55, spread: 0 },
  u: { jaw: 0.18, kiss: 0.85, spread: 0 },
};

/**
 * Viseme of a timed line at shot time t: { jaw, kiss, spread, closed } — each word's syllables share its [t, t+dur]
 * (a little front-loaded, the way a stressed syllable opens widest), the lips close on the bilabials and between words.
 */
export function speechViseme(t: number, words: readonly IntroWord[], vowels: { v: string; m?: boolean }[][], gain = 1) {
  for (let w = 0; w < words.length; w++) {
    const W = words[w];
    if (t < W.t - 0.06 || t > W.t + W.dur + 0.04) continue;
    const syl = vowels[w] ?? Array.from({ length: W.syl }, () => ({ v: 'a' }));
    const u = THREE.MathUtils.clamp((t - W.t) / W.dur, 0, 0.9999);
    const n = syl.length;
    const k = Math.min(n - 1, Math.floor(u * n));
    const f = u * n - k;
    const s = syl[k];
    const V = VOWEL[s.v] ?? VOWEL.a;
    // open quickly, close slower; the last syllable of the word is held a touch longer (stress on the final syllable)
    const env = Math.sin(Math.PI * Math.min(1, f * (k === n - 1 ? 0.85 : 1))) ** 0.7;
    const stress = k === n - 1 ? 1.15 : 1;
    const closed = s.m && f < 0.18 ? 1 - f / 0.18 : 0;
    return { jaw: V.jaw * env * stress * gain * (1 - closed), kiss: V.kiss * env, spread: V.spread * env, closed };
  }
  return { jaw: 0, kiss: 0, spread: 0, closed: 0 };
}

// ================================================================================================ GILGAL
/** face light per shot [Saul, Samuel] (FilmActor.faceFill: illuminance in the sun's units; the sun is ≈3-7) */
export const FACE_FILL: Record<GilgalShotName, [number, number]> = {
  // (cut7, CUT v5.2: G4 ends on Samuel's face before the king, the cheated sun behind him: more fill on his face)
  dustWall: [2.2, 0], king: [2.6, 0], spearRaised: [2.4, 0], silence: [1.2, 2.1], faceOff: [1.5, 1.3],
  tear: [1.1, 1.1], verdict: [1.1, 0.9], saulAlone: [1.9, 0.8], rise: [1.4, 0],
};
export interface GilgalCast {
  saul: FilmActor;
  samuel: FilmActor;
  armourBearer?: FilmActor;
}

const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export class GilgalPerformance {
  private shot: GilgalShotName | null = null;
  private saulFace: FaceDriver;
  private samFace: FaceDriver;
  private grabbed = false;
  private freed = false;
  private readonly lookSaul = new THREE.Vector3();
  private readonly lookSam = new THREE.Vector3();
  /** each actor's own look target (never shared: a shared temp made one of them look at himself) */
  private readonly saulTarget = new THREE.Vector3();
  private readonly samTarget = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly corner = new THREE.Vector3();
  private readonly grabAt = new THREE.Vector3();
  private readonly tearTarget = new THREE.Vector3();
  private readonly fist = new THREE.Vector3();
  private readonly _f = new THREE.Vector3();
  private readonly _r = new THREE.Vector3();
  private readonly _p = new THREE.Vector3();
  private readonly _th = new THREE.Vector3();
  /** Saul's mark on his knee in the tear (fixed once he is down: the knee never slides) */
  private readonly kneelAt = new THREE.Vector3();
  private kneelSet = false;
  private lungeLegs = false;
  private samPhase = 0;
  private blinks = 0;
  /** wind (world m/s) passed to the actors' hair / cloth: a steady westerly with slow gusts (never a jump) */
  readonly wind = new THREE.Vector3(1.4, 0, 0.3);
  private readonly windBase = new THREE.Vector3(1.4, 0, 0.3);
  private clock = 0;
  /** hook for the film's FX: a thread snaps (lint / dust puff) */
  onThreadSnap: ((p: THREE.Vector3) => void) | null = null;

  constructor(readonly cast: GilgalCast, readonly ground: (x: number, z: number) => number = () => 0) {
    this.saulFace = new FaceDriver(cast.saul, 4);
    this.samFace = new FaceDriver(cast.samuel, 3);
    const { saul, samuel } = cast;
    saul.holdProp('spear', 'R');
    // the bronze helmet carried under the left arm (crown outward, rim against the hip); the spear kept upright
    saul.carryUnderArm('helmet', 'L');
    saul.upright.R.prop = 'spear';
    saul.upright.R.weight = 1;
    saul.ground = ground;
    samuel.ground = ground;
    // skin: Saul — sweat and road dust after the campaign (bible 3.2); Samuel — flushed, red about the eyes and nose
    // after a night of crying out (15:11; bible 3.1)
    saul.human.skin.skinUniforms.uWet.value = 0.3;
    saul.human.skin.skinUniforms.uDirt.value = 0.25;
    samuel.human.skin.skinUniforms.uRuddy.value = 0.75;
    // film light on the two faces (the low sun is behind Saul): created here, before the set is precompiled
    // (phones: Saul's only — every extra light is evaluated by every lit material of the set)
    saul.enableFaceLight();
    if (samuel.spec.quality !== 'low') {
      samuel.enableFaceLight(0xffe2c4);
      samuel.faceLightRig.side = 0.85; // a 3/4 key on the old face: the lines of age need modelling, a flat fill erases them
      samuel.faceLightRig.up = 0.35;
    }
    if (samuel.tear) samuel.tear.onSnap = (p) => this.onThreadSnap?.(p);
    if (cast.armourBearer) {
      cast.armourBearer.ground = ground;
      cast.armourBearer.holdProp('main', 'R');
      cast.armourBearer.upright.R.prop = 'main';
      cast.armourBearer.upright.R.weight = 1;
      cast.armourBearer.armPose.R.pose = POSES.spearCarryR;
      cast.armourBearer.armPose.R.weight = 0.8;
      const sh = cast.armourBearer.props.shield;
      if (sh) cast.armourBearer.human.sockets.handGripL.add(sh);
    }
  }

  /**
   * (CUT v6.1, cut7) The spear never vanishes: in his fist (G1-G4 until it is set down: 'hand') or a prop of the set
   * (planted at his side, falling from G5a `drop`, lying in the dust through G7: 'world'). The user: "he had a spear in
   * his hand, and the spear suddenly vanished".
   */
  private spearMode: 'hand' | 'world' = 'hand';
  private spearFall: SpearFall | null = null;
  private readonly spearFrom = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), set: false };
  private readonly spearPos = new THREE.Vector3();
  private readonly spearQuat = new THREE.Quaternion();
  private readonly spearQ2 = new THREE.Quaternion();
  private readonly spearDir = new THREE.Vector3();
  private readonly spearGrip = new THREE.Vector3();
  private readonly shaftAt = new THREE.Vector3();

  private spearToHand() {
    const { saul } = this.cast;
    const sp = saul.props.spear;
    if (!sp) return;
    if (this.spearMode !== 'hand' || sp.parent === saul.root.parent) {
      sp.visible = true;
      saul.holdProp('spear', 'R');
    }
    this.spearMode = 'hand';
    saul.upright.R.prop = 'spear';
  }

  /** the spear becomes a prop of the set at its current world pose (planted / falling / lying) */
  private spearToWorld() {
    const { saul } = this.cast;
    const sp = saul.props.spear;
    const scene = saul.root.parent;
    if (!sp || !scene) return;
    if (this.spearMode !== 'world' || sp.parent !== scene) {
      sp.updateWorldMatrix(true, false);
      scene.attach(sp);
      sp.visible = true;
    }
    this.spearMode = 'world';
    saul.upright.R.weight = 0;
  }

  /** the planted spear's fall (built once: his G4 mark, the set's ground) */
  private spearFallOf(): SpearFall {
    if (!this.spearFall) {
      const yaw = Math.PI / 2; // Saul faces the old man (east) on his G4 mark
      const fwd = V3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = V3(-Math.cos(yaw), 0, Math.sin(yaw));
      const butt = SAUL_TEAR.clone().addScaledVector(fwd, SPEAR.fwd).addScaledVector(right, SPEAR.right);
      butt.y = this.ground(butt.x, butt.z);
      const fall = right.clone().multiplyScalar(Math.cos(SPEAR.fallSide)).addScaledVector(fwd, -Math.sin(SPEAR.fallSide)).normalize();
      // the strike lands on the contract's `spearHits` (the score's knock)
      const A = TEAR_ACTION;
      this.spearFall = new SpearFall({ butt, fall, lean: SPEAR.lean, push: SPEAR.push, length: SPEAR.length, ground: this.ground, hitAfter: A.spearHits - A.drop });
    }
    return this.spearFall;
  }

  /** place the set's spear at fall time τ (τ < 0: planted, held); returns the grip point on its shaft (world) */
  private spearAt(tau: number, blendFrom = 0): THREE.Vector3 {
    const sp = this.cast.saul.props.spear;
    const f = this.spearFallOf();
    f.pose(tau, this.spearPos, this.spearQuat);
    if (blendFrom > 0 && this.spearFrom.set) {
      this.spearPos.lerp(this.spearFrom.pos, blendFrom);
      this.spearQuat.slerp(this.spearQ2.copy(this.spearFrom.quat), blendFrom);
    }
    if (sp) {
      sp.position.copy(this.spearPos);
      sp.quaternion.copy(this.spearQuat);
      sp.updateMatrixWorld(true);
    }
    this.spearDir.set(0, 1, 0).applyQuaternion(this.spearQuat);
    return this.spearGrip.copy(this.spearPos).addScaledVector(this.spearDir, SPEAR.gripAt);
  }

  /** his right fist closed round the planted shaft (arm IK on the grip point, the palm to the shaft, thumb up it) */
  private holdShaft(grip: THREE.Vector3, w: number, yaw: number) {
    const { saul } = this.cast;
    const fwd = this._f.set(Math.sin(yaw), 0, Math.cos(yaw));
    const right = this._r.set(-Math.cos(yaw), 0, Math.sin(yaw));
    saul.reach.R.target = this.shaftAt.copy(grip);
    saul.reach.R.weight = w;
    saul.reach.R.palm = this._p.copy(right).multiplyScalar(-0.85).addScaledVector(fwd, 0.35).normalize();
    saul.reach.R.thumb = this._th.copy(this.spearDir);
    saul.reach.R.orient = w;
    saul.human.rig.setFingers('R', 'grip');
  }

  /** call on each cut (and before the first frame of a shot) */
  enter(shot: GilgalShotName) {
    const { saul, samuel } = this.cast;
    // the spear (CUT v6.1): in his fist until G4 sets it down; a prop of the set from then on (planted, falling, lying)
    const inWorld = shot === 'tear' || shot === 'verdict' || shot === 'saulAlone' || shot === 'rise';
    this.spearFrom.set = false;
    if (inWorld) {
      this.spearToWorld();
      this.spearAt(shot === 'tear' ? -1 : 10);
    } else this.spearToHand();
    // G7 is what Samuel sees (the lens is his eyes): he is not in the frame
    samuel.root.visible = shot !== 'saulAlone';
    this.shot = shot;
    this.clock = 0;
    for (const a of [saul, samuel, this.cast.armourBearer]) {
      if (!a) continue;
      a.headingSnap = true;
      a.body.drop = a.body.lean = a.body.twist = a.body.side = 0;
      a.kneel.w = 0;
      a.kneel.sit = 0;
      for (const sd of ['L', 'R'] as const) {
        a.reach[sd].palm = null;
        a.reach[sd].thumb = null;
        a.reach[sd].orient = 0;
      }
      a.lookLimits.up = 0.45;
      a.lookYawOffset = 0;
      a.breath.amp = 0.25;
      a.headRoll = 0;
      a.mocap.lookWeight = 1;
      a.mocap.timeScale = 1;
      a.mocap.rootMotion = 'inplace';
      a.mocap.rootTarget = a.human.root;
      a.cancelHeading = true;
      a.headingRate = 3;
      a.lookRate = 5;
      a.lookLimits.yaw = 1.25;
    }
    saul.upright.R.axis.set(0, 1, 0);
    this.grabbed = false;
    this.freed = false;
    this.kneelSet = false;
    this.samPhase = 0;
    this.blinks = 0;
    saul.reach.R.weight = 0;
    saul.reach.R.target = null;
    if (this.lungeLegs) saul.mocap.stopLayer('lunge', 0.001);
    this.lungeLegs = false;
    const s0 = saulAt(shot, 0);
    const m0 = samuelAt(shot, 0);
    // ---- Saul's clip
    switch (shot) {
      case 'dustWall':
      case 'king':
        saul.mocap.play('walk_cool', { fade: 0, sync: true, time: shot === 'king' ? 0.55 : 0.2 });
        saul.mocap.matchSpeed('walk_cool', s0.walk);
        break;
      case 'spearRaised':
        // the halt: the stop's last steps, timed so its final plant lands on `halt` + HALT_PLANT (the blocking decelerates
        // him over the same window), then he stands for the thrust
        saul.mocap.play('walk_stop_rb', { fade: 0, time: Math.max(0, STOP_PLANT - BEATS.spearRaised.halt - HALT_PLANT), onEnd: () => saul.mocap.play('idle_king', { fade: 0.4, time: 0.8 }) });
        break;
      case 'silence':
        saul.mocap.play('idle_breathe', { fade: 0, time: 0.4 });
        break;
      case 'tear':
        saul.mocap.play('idle_king', { fade: 0, time: 1.6 });
        break;
      default:
        saul.mocap.play('idle_breathe', { fade: 0, time: shot === 'saulAlone' ? 1.2 : 0 });
    }
    // ---- Samuel's clip: grave, still listening (Rocketbox listen_sad: the breath and the small weight shifts)
    // (cut7, CUT v5.2: in G4 he is already walking up the road to the king when the shot opens)
    if (shot === 'silence') {
      samuel.mocap.play('walk_slow', { fade: 0, sync: true, time: 0.35 });
      samuel.mocap.matchSpeed('walk_slow', Math.max(0.4, m0.walk));
    } else samuel.mocap.play('listen_sad', { fade: 0, time: shot === 'verdict' ? 0.9 : 0.3 });
    samuel.place(m0.pos, m0.yaw);
    if (shot === 'tear') {
      // the tear is ONE take of root motion: the turn-step carries him away from his mark
      samuel.mocap.rootMotion = 'apply';
      samuel.mocap.rootTarget = samuel.root;
      samuel.cancelHeading = false;
    }
    // the tear state is a function of the shot: intact before 'tear', torn after
    const tear = samuel.tear;
    if (tear) {
      if (shot === 'tear') tear.reset();
      else if (shot === 'verdict' || shot === 'saulAlone' || shot === 'rise') {
        // already torn: the piece in Saul's fist
        saul.place(s0.pos, s0.yaw);
        // (CUT v6.1) still on his LEFT knee where the tear left him, sunk back onto his heel (G5b -> G6 -> G7 join
        // continuous time): the legs of the kneeling stride, the kneel blend full
        saul.kneel.side = 'L';
        saul.kneel.fwd = 0.46;
        saul.kneel.w = 1;
        saul.kneel.sit = 0.55;
        saul.mocap.playLayer('lunge', 'walk', { mask: 'legs', time: 0.74, speed: 0, fade: 0.001 });
        this.lungeLegs = true;
        saul.armPose.R.pose = POSES.clothFistR; // G6 and G7 both open with the fist at his belt (G7 lifts it)
        saul.armPose.R.weight = 1;
        // a closed FIST round the wool (the 'grip' pose wraps the spear's shaft radius and read half-open in G7)
        saul.human.rig.setFingers('R', 'fist');
        saul.update(0);
        tear.progress = TORN;
        tear.grab(saul.human.sockets.handGripR);
      } else tear.reset();
    }
    this.saulFace.set({});
    this.samFace.set({});
    this.saulFace.quiet();
    this.samFace.quiet();
    // Samuel's lids: a little heavy and tired (15:11 he cried all night), but OPEN — in the verdict close-up wide open
    // on the king (the director's notes v5: at 640x360 the old lids + the squint of 'determined' read as closed eyes)
    const fb = samuel.human.rig.faceBias;
    const open = shot === 'verdict' || shot === 'saulAlone';
    fb.LeftUpperLidClosed = fb.RightUpperLidClosed = open ? 0 : 0.08;
    fb.LeftUpperLidOpen = fb.RightUpperLidOpen = open ? 0.3 : 0.08;
    fb.LeftLowerLidUp = fb.RightLowerLidUp = open ? 0.06 : 0.12;
    samuel.armPose.R.pose = null;
    samuel.armPose.R.weight = 0;
  }

  /** per frame: shot-local time t (s, real time, like CameraRig; for 'tear:insert' the base shot's time) and dt */
  update(t: number, dt: number, camera?: THREE.Camera, viewportH?: number) {
    const shot = this.shot;
    if (!shot) return;
    const { saul, samuel, armourBearer } = this.cast;
    const ts = timeScale(shot, t);
    // ONE slow-motion clock: every actor clock (body, face, hair, cloth) runs on the action's dt
    const adt = dt * ts;
    this.clock += adt;
    const at = actionTime(shot, t);
    const s = saulAt(shot, t);
    const m = samuelAt(shot, t);
    // wind: slow gusts around the steady westerly (hair and mantle move, never flare)
    const g = 0.75 + 0.25 * Math.sin(this.clock * 0.9) + 0.15 * noise1(this.clock * 0.6, 3);
    this.wind.copy(this.windBase).multiplyScalar(g);
    if (shot !== 'tear') saul.place(s.pos, s.yaw);
    samuel.headWorld(this.lookSam);
    saul.headWorld(this.lookSaul);
    // ---------------------------------------------------------------- SAUL
    const torn = shot === 'verdict' || shot === 'saulAlone' || shot === 'rise';
    saul.armPose.L.pose = POSES.helmetL;
    saul.armPose.L.weight = 1;
    if (!torn && shot !== 'tear') {
      // the spear arm: the carry pose over the capture's own arm swing (the walk keeps 35 % of its swing)
      const up = s.cue;
      saul.armPose.R.pose = mixPose(POSES.spearCarryR, POSES.spearRaiseR, up);
      saul.armPose.R.weight = shot === 'dustWall' || shot === 'king' ? 0.65 : 1;
      saul.upright.R.weight = shot === 'dustWall' || shot === 'king' ? 0.75 : 1;
      // (CUT v6.1) the fist stays closed round the shaft (in Version 11 an open hand stood beside it in G4)
      saul.human.rig.setFingers('R', 'grip');
      saul.reach.R.weight = 0;
    }
    switch (shot) {
      case 'dustWall':
      case 'king': {
        saul.mocap.matchSpeed('walk_cool', s.walk);
        // eyes on the road far ahead (a slow scan of the road, never a fixed stare); in G2 at `headTurn` the head turns to
        // his right over the ranks at his side and holds there, then eases part of the way back toward the road
        // (CUT v3: 6.5 s of slow motion — the head is never parked)
        const K = BEATS.king;
        const turn = shot === 'king'
          ? ss(K.headTurn - 0.35, K.headTurn + 1.15, t) * 0.55 - ss(K.headTurn + 1.7, SHOT_LEN.king + 0.4, t) * 0.24
          : 0.05 * Math.sin(t * 0.7 + 0.6);
        const scan = 0.05 * Math.sin(t * 0.45 + 1.2) * (1 - ss(K.headTurn - 0.4, K.headTurn, shot === 'king' ? t : 0));
        const fwd = this._f.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
        const right = this._r.set(-Math.cos(s.yaw), 0, Math.sin(s.yaw));
        saul.mocap.lookAt = this.tmp.copy(s.pos).addScaledVector(fwd, 30).addScaledVector(right, 30 * Math.tan(turn + scan)).setY(this.ground(s.pos.x, s.pos.z) + 2.1 - 0.6 * ss(K.headTurn - 0.2, K.headTurn + 1.0, shot === 'king' ? t : 0));
        saul.lookRate = 2.5;
        // the set jaw and the eyes narrowing a little against the dust as he looks over his men
        this.saulFace.set({ determined: 0.55 + 0.1 * Math.sin(t * 0.37), anger: 0.08 });
        this.saulFace.jawTarget = 0.03 + 0.02 * Math.max(0, Math.sin(t * 0.9));
        saul.breath.amp = 0.4;
        saul.breath.rate = 0.4;
        break;
      }
      case 'spearRaised': {
        const B = BEATS.spearRaised;
        // the whole body in the thrust: the knee dip (anticipation), the drive up (legs extend, the chest arches back, a
        // twist onto the spear side), the head back with the shout. CUT v3: the roar lasts 3.3 s to the cut — three
        // shouts with a breath between them, the spear driven up again on each (it dips and is thrust back up), the
        // eyes sweeping over the army; never a held pose
        const dip = ss(B.spearUp - 0.32, B.spearUp - 0.06, t) * (1 - ss(B.spearUp - 0.06, B.spearUp + 0.22, t));
        const drive = ss(B.spearUp - 0.08, B.spearUp + 0.3, t);
        const R = roarPulse(t, B.roar, SHOT_LEN.spearRaised);
        const roar = ss(B.roar - 0.1, B.roar + 0.2, t) * (0.62 + 0.38 * R.shout);
        const pump = R.pump;
        saul.body.drop = 0.15 * dip + 0.03 * drive + 0.06 * pump.dip;
        saul.body.lean = 0.15 * dip - 0.24 * drive - 0.06 * roar + 0.1 * pump.dip - 0.05 * pump.up;
        saul.body.twist = 0.18 * drive + 0.06 * Math.sin(t * 0.8) * ss(B.roar + 0.6, B.roar + 1.2, t);
        saul.body.side = -0.04 * drive;
        saul.headRoll = 0.07 * drive;
        const fwd = this._f.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
        const right = this._r.set(-Math.cos(s.yaw), 0, Math.sin(s.yaw));
        // the shaft thrust up and forward (toward the ranks he faces), not a pole held straight up
        saul.upright.R.axis.set(0, 1, 0).addScaledVector(fwd, 0.35 * drive + 0.12 * pump.dip).normalize();
        // the spear arm: up with the thrust, down a little and up again with each new shout
        saul.armPose.R.pose = mixPose(POSES.spearCarryR, POSES.spearRaiseR, s.cue * (1 - 0.3 * pump.dip));
        // eyes: up to the spear point as it goes up, then out over the army's heads with the shout, sweeping the ranks
        const upLook = ss(B.spearUp - 0.2, B.spearUp + 0.2, t) * (1 - 0.6 * ss(B.roar + 0.1, B.roar + 0.6, t)) + 0.25 * pump.up;
        const sweep = 0.38 * Math.sin((t - B.roar - 0.6) * 0.9) * ss(B.roar + 0.5, B.roar + 1.1, t);
        saul.mocap.lookAt = this.tmp.copy(s.pos).addScaledVector(fwd, 8).addScaledVector(right, 8 * Math.tan(sweep)).setY(this.ground(s.pos.x, s.pos.z) + 2 + 9 * upLook);
        saul.lookRate = 7;
        this.saulFace.set({ anger: 0.6 * roar, effort: 0.45 * Math.max(roar, drive * 0.6), determined: 0.45 * (1 - roar) });
        this.saulFace.jawTarget = ss(B.roar - 0.1, B.roar + 0.2, t) * (0.12 + 0.52 * R.shout) + 0.05 * Math.sin(t * 9) * R.shout;
        this.saulFace.lips.UpperLipUp = 0.35 * roar;
        saul.breath.amp = 0.5 + 0.7 * R.breath + 0.3 * ss(B.roar + 1, B.roar + 1.8, t);
        saul.breath.rate = 0.55;
        break;
      }
      case 'silence': {
        saul.mocap.lookAt = this.eyeOf(samuel, this.saulTarget);
        saul.lookRate = 3;
        const B = BEATS.silence;
        // the roar dies in his mouth; he sees the old man: awe, then fear as the ranks open; heavy breath settling
        this.saulFace.set({ awe: 0.3 * ss(B.headsTurn - 0.1, B.part + 0.2, t), fear: 0.25 * ss(B.part + 0.2, B.step - 0.2, t) + 0.1 * ss(B.step, B.step + 0.8, t), determined: 0.35 * (1 - ss(B.headsTurn, B.card, t)) });
        this.saulFace.jawTarget = 0.28 * (1 - ss(0.0, 0.45, t)) + 0.05 + 0.03 * Math.max(0, Math.sin(t * 2.4));
        saul.breath.amp = 0.95 - 0.35 * ss(1, SHOT_LEN.silence, t);
        saul.breath.rate = 0.5;
        // the spear (CUT v6.1): lowered in his fist (begun at G3 `notice`), then set down planted at his right side
        // (plant0 -> plant1) — the fist stays closed round the shaft; G5a picks it up planted there
        if (t >= SPEAR.plant0) {
          if (this.spearMode === 'hand') {
            const sp = saul.props.spear;
            if (sp) {
              sp.updateWorldMatrix(true, false);
              sp.matrixWorld.decompose(this.spearFrom.pos, this.spearFrom.quat, this._p);
              this.spearFrom.set = true;
            }
            this.spearToWorld();
          }
          const grip = this.spearAt(-1, 1 - ss(SPEAR.plant0, SPEAR.plant1, t));
          const w = ss(SPEAR.plant0, SPEAR.plant0 + 0.3, t);
          this.holdShaft(grip, w, s.yaw);
          saul.armPose.R.weight = 1 - w;
        }
        break;
      }
      case 'tear':
        if (this.samPhase === 0 && at >= TEAR_ACTION.turn + 0.15) this.tearLateEntry(at, t);
        this.tearSaul(at, t);
        break;
      case 'verdict': {
        saul.upright.R.weight = 0;
        saul.armPose.R.pose = POSES.clothFistR;
        saul.armPose.R.weight = 1;
        saul.mocap.lookAt = this.eyeOf(samuel, this.saulTarget);
        saul.lookRate = 4;
        const V = BEATS.verdict;
        this.saulFace.set({ sad: 0.3 + 0.35 * ss(V.speech + 1, V.speechEnd, t), fear: 0.4 * ss(V.speech, V.speech + 1.5, t), awe: 0.3 * ss(V.speech + 2, V.speechEnd, t) });
        this.saulFace.jawTarget = 0.06 * ss(V.speechEnd - 0.8, V.speechEnd, t) + 0.03 * ss(V.speechEnd, V.speechEnd + 0.5, t);
        // he holds his breath under the words; in the silence after them it comes back, shaking
        saul.breath.amp = 0.8 - 0.35 * ss(V.speech, V.speech + 0.8, t) * (1 - ss(V.speechEnd, V.speechEnd + 0.4, t)) + 0.3 * ss(V.speechEnd, V.speechEnd + 0.4, t);
        saul.breath.rate = 0.45 + 0.15 * ss(V.speechEnd, V.speechEnd + 0.4, t);
        break;
      }
      case 'saulAlone':
      case 'rise': {
        const B = BEATS.saulAlone;
        saul.upright.R.weight = 0;
        // the fist comes up into his eye-line (foreground), shaking; the fingers tighten on the wool
        const lift = ss(B.lookDown - 0.2, B.lookDown + 0.5, t);
        const tight = ss(B.tighten, B.tighten + 0.25, t);
        const base = mixPose(POSES.clothFistR, POSES.clothLookR, lift);
        const tr = (0.018 + 0.036 * tight) * lift;
        base.fa = [base.fa[0] + tr * noise1(t * 9, 1), base.fa[1] + tr * noise1(t * 7, 2), base.fa[2]];
        base.hd = [base.hd[0] + 1.4 * tr * noise1(t * 11, 3) - 0.25 * tight, base.hd[1], base.hd[2] + tr * noise1(t * 8, 4)];
        saul.armPose.R.pose = base;
        saul.armPose.R.weight = 1;
        // the fist stays closed on the wool; at `tighten` it squeezes (the wrist flexes, the tremble doubles)
        saul.human.rig.setFingers('R', 'fist');
        // his eyes drop to the fist
        const look = ss(B.lookDown - 0.1, B.lookDown + 0.45, t);
        saul.human.sockets.handGripR.getWorldPosition(this.fist);
        const ahead = this.tmp.copy(s.pos).add(V3(Math.sin(s.yaw) * 6, this.ground(s.pos.x, s.pos.z) + 1.6, Math.cos(s.yaw) * 6));
        saul.mocap.lookAt = ahead.lerp(this.fist, look);
        saul.lookRate = 3.5;
        saul.lookLimits.down = 0.95;
        saul.mocap.lookWeight = 1;
        saul.body.lean = 0.06 * look;
        this.saulFace.set({ sad: 0.55 + 0.2 * look, pain: 0.35 * tight + 0.1, fear: 0.15, anger: 0.2 * tight });
        this.saulFace.jawTarget = 0.07 + 0.05 * Math.max(0, Math.sin(t * Math.PI * 2 * 0.55));
        saul.breath.amp = 1.25;
        saul.breath.rate = 0.55;
        break;
      }
    }
    saul.faceFill = FACE_FILL[shot][0];
    samuel.faceFill = FACE_FILL[shot][1];
    // ---------------------------------------------------------------- SAMUEL
    if (shot === 'tear') this.tearSamuel(at, adt, t);
    else if (shot === 'saulAlone' || shot === 'rise') {
      samuel.place(m.pos, m.yaw);
      if (m.walk > 0 && samuel.mocap.current()?.name !== 'walk_slow') {
        samuel.mocap.play('walk_slow', { fade: 0.5, sync: true });
        samuel.mocap.matchSpeed('walk_slow', m.walk);
      }
      samuel.mocap.lookAt = null;
      this.samFace.set({ sad: 0.6 });
    } else if (shot === 'verdict') this.verdictSamuel(t, m);
    else {
      // (CUT v6.1) G4 `turnGo`: the verse read, he begins to turn away — the turn-step G5a picks up (a cut on action)
      const turning = shot === 'silence' && t >= BEATS.silence.turnGo;
      if (!turning) samuel.place(m.pos, m.yaw);
      else this.g4Turn(t, m);
      samuel.mocap.lookAt = this.eyeOf(saul, this.samTarget);
      if (shot === 'silence') {
        // grieving, eyes on the road before him as he walks; as the roar dies he lifts his head to the king
        const lift = ss(BEATS.silence.headsTurn + 0.2, BEATS.silence.headsTurn + 1.1, t);
        samuel.headWorld(this.tmp).add(this._f.set(Math.sin(m.yaw) * 4, -1.3, Math.cos(m.yaw) * 4));
        this.samTarget.lerp(this.tmp, 1 - lift);
        // the breath of the walk, settling as he stands
        samuel.breath.amp = 0.55 - 0.15 * ss(BEATS.silence.step + 0.7, BEATS.silence.step + 2.2, t);
      }
      samuel.lookRate = 2;
      if (turning) {
        // turning away: his eyes go ahead, to his way (east), away from the king
        samuel.human.bones.head.getWorldPosition(this.samTarget);
        samuel.mocap.lookAt = this.samTarget.add(this._f.set(Math.sin(samuel.yaw) * 20, -1, Math.cos(samuel.yaw) * 20));
        samuel.lookRate = 4;
      } else if (shot === 'silence') {
        // (cut7, CUT v5.2) the walk up the road, speed-matched to the blocking, the last step at `step`; then he stands
        // (listen_sad: the breath, the small weight shifts)
        const cur = samuel.mocap.current()?.name;
        if (m.walk > 0.05) {
          if (cur !== 'walk_slow') samuel.mocap.play('walk_slow', { fade: 0.3, sync: true, time: 0.35 });
          samuel.mocap.matchSpeed('walk_slow', Math.max(0.4, m.walk));
        } else if (cur === 'walk_slow') samuel.mocap.play('listen_sad', { fade: 0.6, time: 1 });
      }
      this.samFace.set({ sad: 0.45, determined: 0.35 });
      this.samFace.jawTarget = shot === 'silence' ? g4Speech(t) : 0;
    }
    // ---------------------------------------------------------------- ARMOUR-BEARER one step behind the king
    if (armourBearer) {
      // one step behind the king — in the tear he stays where the king stood (he does not slide after the lunge)
      // (cut4 v6: in G5a/G5b he stays well back west, x < 7, clear of the two-shot)
      // (CUT v6.1: the tear, the verdict and G7 are continuous time on G4's marks — he stays where he stood)
      const after = shot === 'tear' || shot === 'verdict' || shot === 'saulAlone' || shot === 'rise';
      const anchor = after ? saulAt('tear', 0) : s;
      const bd = after ? 3.4 : 1.6;
      const back = V3(-Math.sin(anchor.yaw) * bd, 0, -Math.cos(anchor.yaw) * bd).add(V3(Math.cos(anchor.yaw) * 0.7, 0, -Math.sin(anchor.yaw) * 0.7));
      armourBearer.place(anchor.pos.clone().add(back), anchor.yaw);
      const a = armyAt(shot, t);
      const want = a.walk > 0.2 ? 'walk' : 'idle_n1';
      if (armourBearer.mocap.current()?.name !== want) {
        armourBearer.mocap.play(want, { fade: 0.4, sync: true, time: 0.7 });
      }
      if (a.walk > 0.2) armourBearer.mocap.matchSpeed('walk', a.walk);
      armourBearer.mocap.lookAt = shot === 'silence' || shot === 'tear' || shot === 'verdict' ? this.lookSam : null;
      armourBearer.update(adt, camera, viewportH, this.wind);
    }
    this.saulFace.update(adt);
    this.samFace.update(adt);
    saul.update(adt, camera, viewportH, this.wind);
    samuel.update(adt, camera, viewportH, this.wind);
  }

  /** (CUT v6.1) G4 from `turnGo`: the old man's turn-step to his left (Rocketbox turn_go_L, its root motion applied) —
   *  the same take G5a continues (tearLateEntry picks the clip up TURN_LEAD s in) */
  private g4Turn(t: number, m: { pos: THREE.Vector3; yaw: number }) {
    const { samuel } = this.cast;
    const u = t - BEATS.silence.turnGo;
    if (this.samPhase === 0) {
      samuel.place(m.pos, m.yaw);
      samuel.mocap.rootMotion = 'apply';
      samuel.mocap.rootTarget = samuel.root;
      samuel.cancelHeading = false;
      samuel.mocap.play('turn_go_L', { fade: u < 0.05 ? 0.2 : 0, time: Math.max(0, u) });
      this.samPhase = 1;
    }
    samuel.root.position.y = this.ground(samuel.root.position.x, samuel.root.position.z);
  }

  /**
   * G5, Saul: "וַיַּחֲזֵק בִּכְנַף־מְעִילוֹ" — CUT v3 (G5a 4 s): pleading, he sees the old man turn away; he goes after him
   * (two slow steps, the right arm out to him, calling), and when the old man walks on he rushes (two quick strides),
   * lunges and drops onto his left knee — the fist closes on the lower corner of the me'il (grip, arm IK on the skinned
   * cloth); he holds on, pulls back and up (pull) — the wool gives (rip .. free), the corner stays in his fist and he
   * sinks back onto his heel with it (15:27; desperation, not violence: brows up, the mouth open).
   */
  private tearSaul(at: number, t: number) {
    const { saul, samuel } = this.cast;
    const A = TEAR_ACTION;
    const tear = samuel.tear;
    const s = saulAt('tear', t);
    const yaw = s.yaw;
    const fwd = this._f.set(Math.sin(yaw), 0, Math.cos(yaw));
    const right = this._r.set(-Math.cos(yaw), 0, Math.sin(yaw));
    if (tear) tear.cornerWorld(this.corner);
    else samuel.root.getWorldPosition(this.corner).setY(this.corner.y + 0.5);
    // ---- placement (CUT v6.1): on his G4 mark until `lunge`, then two quick steps and the kneeling stride onto the
    // kneel mark (gilgalBlocking tearPath / tearKneelMark: closed form — a seek lands on the same place); the knee
    // strikes the ground at `kneel` and never slides
    this.kneelAt.copy(SAUL_TEAR).lerp(tearKneelMark(), tearPath(at));
    saul.place(this.kneelAt, yaw);
    // ---- clips: standing (idle_king) -> the two quick steps (the walk, speed-matched to the path) -> the kneeling stride
    // (the walk frozen in its long stride, RIGHT foot forward, on the legs) -> on his knee
    const cur = saul.mocap.current()?.name;
    const stepping = at >= A.lunge - 0.04 && at < A.kneel - 0.32;
    if (stepping && cur !== 'walk') saul.mocap.play('walk', { fade: 0.18, sync: true, time: 0.25 });
    if (cur === 'walk') saul.mocap.matchSpeed('walk', THREE.MathUtils.clamp(Math.hypot(saul.velocity.x, saul.velocity.z), 0.6, 2.4));
    if (at >= A.kneel - 0.32 && cur !== 'idle_king') saul.mocap.play('idle_king', { fade: 0.3, time: 0.5 });
    if (at >= A.kneel - 0.42 && !this.lungeLegs) {
      saul.mocap.playLayer('lunge', 'walk', { mask: 'legs', time: 0.74, speed: 0, fade: 0.2 });
      this.lungeLegs = true;
    }
    // ---- body: a breath of stillness (the old man turns his back), the spear let go, the rush (leaning into it), down
    // on his LEFT knee (the right foot planted ahead) at `kneel`, then leaning far forward into the reach for the
    // corner; straining back while he holds (grip -> pull), back and upright as he pulls; when the wool gives he sinks
    // back onto his heel (slowly, in the slow motion)
    const kneel = ss(A.kneel - 0.42, A.kneel, at);
    const rush = ss(A.lunge - 0.05, A.lunge + 0.3, at) * (1 - ss(A.kneel - 0.3, A.kneel, at));
    const pull = ss(A.pull - 0.06, A.rip + 0.08, at);
    const hold = ss(A.grip, A.grip + 0.25, at) * (1 - pull);
    const recoil = ss(A.free - 0.04, A.free + 0.14, at);
    const sink = ss(A.free - 0.02, A.free + 0.42, at);
    saul.kneel.side = 'L';
    saul.kneel.fwd = 0.46;
    saul.kneel.w = kneel;
    saul.kneel.sit = 0.55 * sink;
    // the weight drops into the knee as it lands (and a small rebound), never a float
    const land = Math.exp(-Math.pow((at - A.kneel - 0.05) / 0.09, 2));
    saul.body.drop = 0.1 * rush + 0.05 * land;
    const reachLean = ss(A.kneel - 0.15, A.grip - 0.05, at);
    saul.body.lean = 0.14 * rush + 0.58 * reachLean - 0.07 * hold - 0.34 * pull - 0.2 * recoil + 0.05 * sink;
    saul.body.twist = 0.06 * rush + 0.24 * reachLean - 0.08 * pull;
    saul.body.side = 0.04 * reachLean;
    saul.headingRate = 12;
    // ---- the right hand: closed round the planted shaft until `drop`; it opens and the spear falls (SpearFall, the
    // set's prop from here on); the empty hand swings with the rush, then reaches for the corner (IK, the palm turned
    // toward the cloth) and closes on it at `grip`; the helmet stays under the left arm
    saul.armPose.R.pose = null;
    saul.armPose.R.weight = 0;
    saul.upright.R.weight = 0;
    const tau = at - A.drop;
    const grip = this.spearAt(tau);
    if (tau < 0) {
      this.holdShaft(grip, 1, yaw);
    } else if (!this.grabbed) {
      // the hand lets go (it follows the shaft a moment as it opens), then the arm drops and swings with the rush
      const letGo = ss(0, 0.28, tau);
      const toCorner = ss(A.kneel - 0.55, A.grip - 0.12, at);
      if (letGo < 1 && toCorner <= 0) {
        this.holdShaft(grip, 1 - letGo, yaw);
        saul.human.rig.setFingers('R', 'open');
      } else {
        const palm = this.tmp2.copy(right).multiplyScalar(-1).addScaledVector(fwd, 0.25).add(this._p.set(0, -0.35, 0)).normalize();
        saul.reach.R.palm = palm;
        saul.reach.R.thumb = this._th.set(0, 1, 0).addScaledVector(fwd, 0.55).normalize();
        saul.reach.R.orient = toCorner;
        saul.reach.R.target = this.tearTarget.copy(this.corner);
        saul.reach.R.weight = ss(A.kneel - 0.5, A.grip - 0.06, at);
        saul.human.rig.setFingers('R', 'open');
      }
      if (at >= A.grip && tear) {
        this.grabbed = true;
        saul.reach.R.target = this.tearTarget.copy(this.corner);
        saul.reach.R.weight = 1;
        saul.human.rig.setFingers('R', 'fist');
        saul.update(0); // the hand exactly at the corner this frame
        tear.grab(saul.human.sockets.handGripR);
        this.grabAt.copy(this.corner);
      }
    } else {
      // the fist holds and hauls the corner UP and back toward him (the arm straight; the wool goes taut on a diagonal
      // from the fist down to the old man's hem — and the fist rises into the middle of the low insert frame), then
      // snaps back toward his chest when it comes free; while he only holds (grip -> pull) the fist trembles with it
      const tr = 0.006 * hold;
      this.tearTarget.copy(this.grabAt)
        .addScaledVector(fwd, -0.12 * pull - 0.16 * recoil - 0.02 * hold)
        .add(this._p.set(tr * noise1(at * 13, 5), 0.27 * pull + 0.16 * recoil + 0.03 * hold + tr * noise1(at * 11, 6), 0))
        .addScaledVector(right, 0.04 * recoil);
      saul.reach.R.target = this.tearTarget;
      saul.reach.R.weight = 1;
      saul.human.rig.setFingers('R', 'fist');
    }
    // the rip runs rip -> free; at `free` the last threads of the weave let go (MeilTear releases a tear-line vertex
    // only at progress >= its threshold + 0.12, up to ~1.11: TORN = 1.2 lets go of every one)
    if (tear) tear.progress = ss(A.rip, A.free, at) + (TORN - 1) * ss(A.free - 0.04, A.free + 0.04, at);
    // ---- eyes: on the old man as he turns his back; down to the corner as he goes for it; then UP to him as he holds
    // (his face in profile for the insert): pleading, never violent — the brows up, the mouth open (visual-bible 3.3)
    if (at < A.kneel - 0.4) saul.mocap.lookAt = this.eyeOf(samuel, this.saulTarget);
    else if (at < A.grip - 0.02) saul.mocap.lookAt = this.corner;
    else saul.mocap.lookAt = samuel.headWorld(this.saulTarget);
    saul.lookRate = 9;
    saul.lookLimits.up = 0.6;
    const plead = ss(A.turn + 0.1, A.turn + 0.7, at);
    const reach = ss(A.lunge + 0.1, A.grip, at);
    const gone = ss(A.free - 0.06, A.free + 0.12, at);
    this.saulFace.set({
      sad: 0.4 + 0.15 * plead + 0.2 * reach * (1 - gone) + 0.2 * gone, fear: 0.35 + 0.15 * plead + 0.35 * reach - 0.25 * gone,
      awe: 0.5 * gone, pain: 0.1 * pull * (1 - gone) + 0.08 * hold,
    });
    // the brows climb (anguish, never the frown of violence)
    this.saulFace.units.LeftInnerBrowUp = this.saulFace.units.RightInnerBrowUp = 0.2 * plead + 0.3 * reach + 0.15 * gone;
    this.saulFace.units.LeftOuterBrowUp = this.saulFace.units.RightOuterBrowUp = 0.08 * plead + 0.12 * reach;
    // a word after him as he turns (15:25 "וְשׁוּב עִמִּי"); the mouth opens with the rush (a cry) and hangs open as it
    // tears — wide enough to read through the beard in profile
    const call = speechJaw(at, Math.max(0, A.drop - 0.1), 3, [], 3) * 1.25;
    this.saulFace.jawTarget = call + 0.38 * reach * (1 - 0.3 * gone) + 0.1 * gone;
    this.saulFace.lips.lowerLipDown = 0.4 * reach;
    this.saulFace.lips.UpperLipUp = 0.16 * reach;
    saul.breath.amp = 0.7 + 0.25 * reach + 0.25 * gone;
    saul.breath.rate = 0.7;
  }

  /**
   * The tear entered LATE (a seek into the middle of it, e.g. straight into the insert): pick Samuel up where the blocking
   * has him — mid turn-step, walking away, or already stopped — and pose him at once, BEFORE Saul reads the corner of his
   * me'il (a seek used to leave him turning on his mark against the kneeling king, and Saul reaching for a stale corner).
   */
  private tearLateEntry(at: number, t: number) {
    const { samuel } = this.cast;
    const A = TEAR_ACTION;
    const m = samuelAt('tear', t);
    if (at >= A.free + SAM_STOP) {
      samuel.place(m.pos, m.yaw);
      samuel.mocap.play('listen_sad', { fade: 0, time: 0.2 });
      this.samPhase = 3;
    } else if (at >= A.turn + SAM_TURN_CUT) {
      samuel.place(m.pos, m.yaw);
      samuel.mocap.play('walk_slow', { fade: 0 });
      samuel.mocap.matchSpeed('walk_slow', samPace(at));
      this.samPhase = 2;
    } else {
      samuel.place(m.pos, m.yaw);
      samuel.mocap.play('turn_go_L', { fade: 0, time: at - A.turn });
      this.samPhase = 1;
    }
    samuel.root.position.y = this.ground(samuel.root.position.x, samuel.root.position.z);
    samuel.update(0);
  }

  /**
   * G5, Samuel: "וַיִּסֹּב שְׁמוּאֵל לָלֶכֶת" — the old man's turn-step to his left (the capture's root motion carries him),
   * then a slow walk away (CUT v3: an old man's pace, never a pause); the seized corner jerks him, he leans against it
   * and glances back, the wool tears, he stumbles a step forward, stops, and turns his chest back toward the king.
   */
  private tearSamuel(at: number, adt: number, t: number) {
    const { saul, samuel } = this.cast;
    const A = TEAR_ACTION;
    const mp = samuel.mocap;
    void t;
    // the ground under the root-motion walk
    samuel.root.position.y = this.ground(samuel.root.position.x, samuel.root.position.z);
    if (this.samPhase === 0 && at >= A.turn) {
      // the old man's turn-step to his left into a walk away (the capture's root motion carries him)
      mp.play('turn_go_L', { fade: 0.2 });
      this.samPhase = 1;
    }
    if (this.samPhase === 1 && at >= A.turn + SAM_TURN_CUT) {
      // the turn-step's last step runs on into his slow walk (the same foot planted: the walk enters on its right-foot
      // stance), so he never stops between the turn and the walk
      mp.play('walk_slow', { fade: 0.3, time: 0.1 });
      mp.matchSpeed('walk_slow', samPace(at));
      this.samPhase = 2;
    }
    if (this.samPhase === 2) {
      // walking away; checked by the grip (the corner holds him back), slowest while the wool is taut, a stride again
      // once it gives
      mp.matchSpeed('walk_slow', samPace(at));
      // finish the turn onto his way out (ESE along the road, away from the king)
      const e = Math.atan2(Math.sin(SAM_AWAY_YAW - samuel.root.rotation.y), Math.cos(SAM_AWAY_YAW - samuel.root.rotation.y));
      samuel.root.rotation.y += e * (1 - Math.exp(-5 * adt));
      // one more step after the rip, then he stops (just before the end of the insert)
      if (at >= A.free + SAM_STOP) {
        mp.play('listen_sad', { fade: 0.45, time: 0.2 });
        this.samPhase = 3;
      }
    }
    // eyes: on Saul, then ahead (east, his way); a half-glance back over his shoulder as the robe holds him; back to
    // Saul once free
    const ahead = () => {
      const fwd = this._f.set(Math.sin(samuel.yaw), 0, Math.cos(samuel.yaw));
      samuel.human.bones.head.getWorldPosition(this.samTarget);
      return this.samTarget.addScaledVector(fwd, 20);
    };
    if (at < A.turn + 0.1) mp.lookAt = this.eyeOf(saul, this.samTarget);
    else if (at < A.free + 0.05) {
      const back = ss(A.grip + 0.1, A.grip + 0.45, at) * (1 - ss(A.pull + 0.1, A.rip, at)) * 0.45;
      mp.lookAt = back > 0.01 ? ahead().lerp(this.eyeOf(saul, this.tmp), back) : ahead();
    } else mp.lookAt = this.eyeOf(saul, this.samTarget);
    samuel.lookLimits.yaw = 1.45;
    samuel.lookRate = at < A.free ? 4 : 2.5;
    // the jerk of the held robe (a hitch back in the chest), the lean forward against it; when the wool gives, a
    // stumble forward; the chest turns back toward the king at the end
    const jerk = ss(A.grip, A.grip + 0.08, at) * (1 - ss(A.grip + 0.12, A.grip + 0.4, at));
    const against = ss(A.grip + 0.08, A.grip + 0.45, at) * (1 - ss(A.free, A.free + 0.12, at));
    const stumble = ss(A.free, A.free + 0.1, at) * (1 - ss(A.free + 0.14, A.free + 0.42, at));
    samuel.body.lean = -0.13 * jerk + 0.12 * against + 0.14 * stumble + 0.03 * ss(A.turn + 0.8, A.turn + 1.4, at) * (1 - jerk);
    samuel.body.twist = -0.35 * ss(A.free + 0.1, A.end + 0.3, at);
    this.samFace.set({ sad: 0.5 + 0.15 * ss(A.grip, A.free, at), pain: 0.2 * jerk + 0.12 * against });
    this.samFace.jawTarget = 0;
    samuel.breath.amp = 0.35 + 0.25 * against;
  }

  /**
   * G6, Samuel: held back half-turned, he turns back to the king (turnBack) and says 15:28a — the jaw and the lips on
   * the verse's own word timing (VERDICT_WORDS), the eyes locked on Saul's with the rig's saccades and a blink before
   * the first word, the head tilted a little, small nods on the stressed final syllables; the wind in his hair.
   */
  private verdictSamuel(t: number, m: { pos: THREE.Vector3; yaw: number }) {
    const { saul, samuel } = this.cast;
    const V = BEATS.verdict;
    samuel.place(m.pos, m.yaw);
    const turned = ss(V.turnBack, V.turnBack + 0.7, t);
    // the head leads the turn: the chest and hips follow (the placement yaw eases in samuelAt)
    samuel.body.twist = -0.3 * (1 - turned) * ss(0, V.turnBack + 0.2, t);
    samuel.lookLimits.yaw = 1.45;
    samuel.lookRate = 2.6;
    // the eyes OPEN and locked on Saul's: they shift between his two eyes every ~0.7 s (a listener's saccades, on top
    // of the rig's micro-saccades), the head follows them only a little
    const which = Math.floor((t + 0.35) / 0.72) % 2 === 0 ? saul.human.sockets.eyeR : saul.human.sockets.eyeL;
    const eyes = this.eyeOf(saul, this.samTarget).lerp(which.getWorldPosition(this.tmp), 0.85);
    // small nods on the stressed syllables (the last of each word) — the look target dips a few centimetres
    let nod = 0;
    for (const w of VERDICT_WORDS) {
      const e = w.t + w.dur * 0.75;
      nod += Math.exp(-((t - e) * (t - e)) / 0.012);
    }
    eyes.y -= 0.035 * Math.min(1, nod);
    samuel.mocap.lookAt = eyes;
    // his FACE stays nearer the lens (cut4 rev 4: the G6 lens stands 34 deg south of his line to Saul — with the face
    // full on Saul he read in profile): the head aims ~0.3 rad toward the lens side (his left), the eyes do the rest
    // (from the first frame: eased in over the turn, the head swung past the lens into profile on the first word)
    samuel.lookYawOffset = 0.3;
    // the held silence after the last word (CUT v3: speechEnd -> the cut, 1.1 s): the head settles a little lower,
    // the eyes stay on the king, a long breath out
    const after = ss(V.speechEnd, V.speechEnd + 0.6, t);
    eyes.y -= 0.025 * after;
    // (CUT v6.1) after the last word his eyes go DOWN to the king at his feet — to the fist with the torn corner: G7 is
    // what he sees (an eyeline cut)
    const down = ss(V.lookDown - 0.05, V.lookDown + 0.3, t);
    if (down > 0) eyes.lerp(saul.human.sockets.handGripR.getWorldPosition(this._p), down);
    samuel.headRoll = -0.07 * ss(V.turnBack + 0.3, V.speech, t) + 0.025 * Math.sin(t * 1.3) - 0.02 * after;
    if (this.blinks === 0 && t >= V.speech - 0.28) {
      samuel.human.rig.blink();
      this.blinks = 1;
    }
    if (this.blinks === 1 && t >= V.speechEnd + 0.12) {
      samuel.human.rig.blink();
      this.blinks = 2;
    }
    // a small gesture of the right hand on the first words ("קָרַע ה׳"): the forearm lifts, the open hand turned
    // down, then it settles back as the verdict goes on
    const gest = ss(V.speech - 0.15, V.speech + 0.35, t) * (1 - ss(V.speech + 1.3, V.speech + 2.2, t));
    samuel.armPose.R.pose = VERDICT_HAND_R;
    samuel.armPose.R.weight = 0.75 * gest;
    if (gest > 0.05) samuel.human.rig.setFingers('R', 'relaxed');
    // grave, the brows a little drawn up (grief) and down (judgement) — never the squint of 'determined'
    this.samFace.units.LeftInnerBrowUp = this.samFace.units.RightInnerBrowUp = 0.22;
    this.samFace.units.LeftBrowDown = this.samFace.units.RightBrowDown = 0.1;
    this.samFace.units.NasolabialDeepener = 0.15;
    // speech
    const vz = speechViseme(t, VERDICT_WORDS, VERDICT_VOWELS, 1);
    this.samFace.jawTarget = vz.jaw;
    this.samFace.lips.LipsKiss = vz.kiss;
    this.samFace.lips.MouthLeftPullSide = vz.spread * 0.7;
    this.samFace.lips.MouthRightPullSide = vz.spread * 0.7;
    this.samFace.lips.lowerLipDown = vz.jaw * 0.35;
    this.samFace.lips.UpperLipUp = vz.jaw * 0.12;
    this.samFace.jawRate = 26;
    const speaking = ss(V.speech - 0.2, V.speech, t) * (1 - ss(V.speechEnd, V.speechEnd + 0.3, t));
    this.samFace.set({ sad: 0.16 + 0.06 * (1 - speaking) + 0.08 * after, anger: 0.05 * speaking });
    // the breath: held under the words, then the long breath out of the silence
    samuel.breath.amp = 0.35 + 0.35 * after;
    samuel.breath.rate = 0.3 - 0.08 * after;
  }

  /** world position of the tear (the corner of the me'il / Saul's fist) — for the G5 cameras and FX */
  tearFocus(out = new THREE.Vector3()) {
    const t = this.cast.samuel.tear;
    return t ? t.cornerWorld(out) : this.cast.samuel.root.getWorldPosition(out).setY(out.y + 0.5);
  }

  /** world position of Saul's right fist (G5b / G7 cameras and focus) */
  fistFocus(out = new THREE.Vector3()) {
    return this.cast.saul.human.sockets.handGripR.getWorldPosition(out);
  }

  private eyeOf(a: FilmActor, out: THREE.Vector3) {
    return a.eyesWorld(out);
  }
}

// ================================================================================================ RAMAH (P5)
export interface RamahMark {
  pos: THREE.Vector3;
  yaw: number;
  seated?: boolean;
}

/** G6: Samuel's small gesture on the first words of the verdict — the forearm lifted, the open hand turned down */
const VERDICT_HAND_R: ArmPose = { ua: [-0.28, 0.06, -0.1], fa: [-1.05, 0.55, 0], hd: [0.25, 0, -0.1] };

/** an elder's hand on his staff: the elbow bent, the hand forward at hip height (proxy Euler; L mirrors R) */
const STAFF_HOLD: Record<'L' | 'R', ArmPose> = {
  R: { ua: [-0.14, -0.08, -0.14], fa: [-1.15, 0, 0], hd: [0.1, 0, 0.05] },
  L: { ua: [-0.14, 0.08, 0.14], fa: [-1.15, 0, 0], hd: [0.1, 0, -0.05] },
};

/** the demanding elder's arm thrust out at Samuel (proxy Euler, over the capture)
 *  (CUT v6.1, cut7: thrust FORWARD at shoulder height, not up — raised above the shoulder the wide sleeve of his robe
 *  stretched into a flat white sheet and his hand was lost in it, Version 11 K034.0) */
const DEMAND_R: ArmPose = { ua: [-1.62, 0.15, -0.3], fa: [-0.38, 0.1, 0], hd: [0.42, 0, 0.1] };

/** the shot's beats (P5 of the contract, introScript 'ramah' : 'elders'; seconds of the shot) */
const RAMAH_BEATS = (() => {
  const b = INTRO_SHOTS.find((x) => x.set === 'ramah' && x.take === 'elders')?.beats ?? {};
  // (CUT v5: the contract names Samuel's turn `away`; `turnAway` was CUT v2's name)
  // (cut7, CUT v6: "fast and dynamic — cut straight into the action": the elder's rise began `lead` s BEFORE the shot,
  //  so its first frame finds him already coming up off the bench, the arm on its way out toward Samuel)
  return { rise: b.rise ?? 0.5, verse: b.verse ?? 1.0, turnAway: b.away ?? b.turnAway ?? 2.6, lead: b.rise !== undefined && b.rise < 0.5 ? 0.65 : 0 };
})();

/**
 * The parts of the elders in P5 (cut4's marks, landSites: 0 the speaker on the left bench · 1 the right bench · 2-3 the
 * central pair of the arc · 4-5 the arc · 6-7 the near pair the lens dollies past · 8-10 the outer ring)
 */
export type ElderRole = 'speaker' | 'seated' | 'pair' | 'arc' | 'near' | 'outer';

export class RamahPerformance {
  private faces: FaceDriver[] = [];
  private samFace: FaceDriver;
  /** Samuel's eyes (world), refreshed every frame: the elders' eye-line */
  private readonly samEyes = new THREE.Vector3();
  private readonly leadEyes = new THREE.Vector3();
  private readonly away = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  /** each elder's own look target (never shared) */
  private readonly looks: THREE.Vector3[] = [];
  readonly wind = new THREE.Vector3(0.8, 0, -0.2);
  /** beats (seconds of the shot): the elder rises, the verse, Samuel turns his face away */
  readonly beats: { rise: number; verse: number; turnAway: number; lead: number };
  /** each elder's part (see ElderRole) and the man he turns to (pairs), -1 = none */
  readonly roles: ElderRole[] = [];
  readonly partner: number[] = [];
  private lead = -1;
  private leadPhase = 0;
  private samPhase = 0;
  private lastT = -1;

  /**
   * @param roles optional canonical mark index of each elder (cut4's landSites order, e.g. FilmStage's plan.idx); without
   *              it the parts are read from the marks' places before the gate (seated / distance / side)
   */
  constructor(readonly samuel: FilmActor, readonly elders: FilmActor[], readonly samuelMark: RamahMark, readonly elderMarks: RamahMark[], readonly ground: (x: number, z: number) => number = () => 0, beats: Partial<{ rise: number; verse: number; turnAway: number }> = {}, roles?: number[]) {
    this.beats = { ...RAMAH_BEATS, ...beats };
    samuel.ground = ground;
    samuel.enableFaceLight(0xffe2c4);
    samuel.faceLightRig.side = 0.85; // more of a 3/4 key: the old face needs modelling (the lines vanish in a flat fill)
    samuel.faceLightRig.up = 0.35;
    samuel.faceFill = 1.0;
    samuel.place(samuelMark.pos, samuelMark.yaw);
    samuel.root.updateMatrixWorld(true);
    samuel.eyesWorld(this.samEyes);
    // tired but open eyes (the elders' demand is answered with grief, 8:6)
    const fb = samuel.human.rig.faceBias;
    fb.LeftUpperLidClosed = fb.RightUpperLidClosed = 0.06;
    fb.LeftUpperLidOpen = fb.RightUpperLidOpen = 0.1;
    this.samFace = new FaceDriver(samuel, 2);
    this.assignRoles(roles);
    elders.forEach((e, i) => {
      e.ground = ground;
      const mk = elderMarks[i % elderMarks.length];
      e.place(mk.pos, mk.yaw);
      if (e.props.staff) e.holdProp('staff', i % 2 ? 'R' : 'L');
      e.headingSnap = true;
      const f = new FaceDriver(e, 2.5);
      this.faces.push(f);
      this.looks.push(new THREE.Vector3());
    });
    this.reset();
  }

  /** the parts: from the canonical indices when given, else from the marks (seated nearest Samuel = the speaker) */
  private assignRoles(roles?: number[]) {
    const { elders, elderMarks, samuelMark } = this;
    const n = elders.length;
    const mk = (i: number) => elderMarks[i % elderMarks.length];
    this.roles.length = 0;
    this.partner.length = 0;
    for (let i = 0; i < n; i++) {
      this.roles.push('outer');
      this.partner.push(-1);
    }
    if (roles && roles.length >= n) {
      const at = (r: number) => roles.indexOf(r);
      for (let i = 0; i < n; i++) {
        const r = roles[i];
        this.roles[i] = r === 0 ? 'speaker' : r === 1 ? 'seated' : r === 2 || r === 3 ? 'pair' : r === 4 || r === 5 ? 'arc' : r === 6 || r === 7 ? 'near' : 'outer';
        const pr = r === 2 ? 3 : r === 3 ? 2 : r === 6 ? 7 : r === 7 ? 6 : -1;
        if (pr >= 0) this.partner[i] = at(pr);
        if (this.partner[i] < 0 && (this.roles[i] === 'pair' || this.roles[i] === 'near')) this.roles[i] = this.roles[i] === 'pair' ? 'arc' : 'near';
      }
      this.lead = at(0);
    }
    if (this.lead < 0) {
      // read the parts from the places: local frame of Samuel's mark (z out of the gate toward the lens, x along it)
      const y = samuelMark.yaw, fx = Math.sin(y), fz = Math.cos(y);
      const loc = elders.map((_, i) => {
        const dx = mk(i).pos.x - samuelMark.pos.x, dz = mk(i).pos.z - samuelMark.pos.z;
        return { x: dx * fz - dz * fx, z: dx * fx + dz * fz };
      });
      const seated = elders.map((_, i) => i).filter((i) => mk(i).seated).sort((a, b) => mk(a).pos.distanceTo(samuelMark.pos) - mk(b).pos.distanceTo(samuelMark.pos));
      seated.forEach((i, k) => (this.roles[i] = k === 0 ? 'speaker' : 'seated'));
      this.lead = seated.length ? seated[0] : 0;
      if (!seated.length) this.roles[0] = 'speaker';
      const standing = elders.map((_, i) => i).filter((i) => this.roles[i] !== 'speaker' && !mk(i).seated);
      for (const i of standing) this.roles[i] = loc[i].z < 5.2 ? 'arc' : Math.abs(loc[i].x) < 1.9 ? 'near' : 'outer';
      // the central man on each side of the arc / of the near group turn to each other
      for (const g of ['arc', 'near'] as const) {
        const grp = standing.filter((i) => this.roles[i] === g);
        const l = grp.filter((i) => loc[i].x < 0).sort((a, b) => Math.abs(loc[a].x) - Math.abs(loc[b].x))[0];
        const r = grp.filter((i) => loc[i].x >= 0).sort((a, b) => Math.abs(loc[a].x) - Math.abs(loc[b].x))[0];
        if (l !== undefined && r !== undefined) {
          this.partner[l] = r;
          this.partner[r] = l;
          if (g === 'arc') this.roles[l] = this.roles[r] = 'pair';
        }
      }
    }
  }

  /** back to the first frame of the shot (every clip, pose and face) */
  reset() {
    const { samuel, elders, elderMarks } = this;
    samuel.mocap.play('listen_sad', { fade: 0, time: 0.4 });
    samuel.mocap.lookWeight = 1;
    this.samPhase = 0;
    this.leadPhase = 0;
    // heads of families, dignified (bible 3.7), and angry: talk, gesture, lean in, arms akimbo — never frozen
    const arcClips = ['talk_excited', 'idle_angry', 'talk_gesture', 'listen_angry'];
    elders.forEach((e, i) => {
      const mk = elderMarks[i % elderMarks.length];
      const role = this.roles[i];
      e.place(mk.pos, mk.yaw);
      e.body.twist = e.body.lean = 0;
      e.headRoll = 0;
      e.breath.amp = 0.45;
      e.breath.rate = 0.32 + 0.04 * (i % 3);
      e.upright.L.weight = e.upright.R.weight = 0;
      if (i !== this.lead) for (const sd of ['L', 'R'] as const) {
        e.armPose[sd].pose = null;
        e.armPose[sd].weight = 0;
      }
      if (i === this.lead) {
        // seated on the bench (the capture's own seated pose; the pelvis held onto the bench), about to rise
        e.sit(mk.seated ? mk.pos.y - this.ground(mk.pos.x, mk.pos.z) : 0);
        e.body.feetFwd = 0;
        e.seatWeight = 1;
        e.mocap.play('stand_up', { fade: 0, time: 0.2, speed: 0 });
        e.cancelHeading = true;
      } else {
        if (mk.seated) e.sit(mk.pos.y - this.ground(mk.pos.x, mk.pos.z));
        else e.sit(0);
        // the pair: one speaks to the other, who listens and nods; the near pair (backs to the lens) and the staff
        // holders keep their arms free (idles with weight shifts), the others gesture
        const p = this.partner[i];
        const clip = mk.seated ? 'talk_excited'
          : role === 'pair' ? (p >= 0 && i < p ? 'talk_gesture' : 'idle_angry')
            : role === 'near' || e.props.staff ? (i % 2 ? 'idle_angry' : 'idle_n1')
              : arcClips[i % arcClips.length];
        e.mocap.play(clip, { fade: 0, time: (i * 1.37) % 3, mirror: i % 2 === 1 });
        if (e.props.staff) {
          // the staff stands on the ground beside him (its grip is ~1 m up the shaft: the elbow bent, the hand forward
          // at hip height, the shaft kept upright — it sways a little as he shifts his weight)
          const sd = i % 2 ? 'R' : 'L';
          e.upright[sd].prop = 'staff';
          e.upright[sd].weight = 0.85;
          e.armPose[sd].pose = STAFF_HOLD[sd];
          e.armPose[sd].weight = 0.85;
        }
      }
      e.mocap.lookAt = this.looks[i].copy(this.samEyes);
      e.headingSnap = true;
      const f = this.faces[i];
      f.set(i === this.lead ? { anger: 0.3, determined: 0.4 } : i % 3 === 0 ? { determined: 0.45, anger: 0.15 } : i % 3 === 1 ? { anger: 0.3, sad: 0.1 } : { determined: 0.3, fear: 0.1 });
      f.snap();
    });
    this.samFace.set({ sad: 0.35 });
    this.samFace.snap();
    this.lastT = -1;
  }

  update(t: number, dt: number, camera?: THREE.Camera, viewportH?: number) {
    if (t < this.lastT - 0.05) this.reset();
    this.lastT = t;
    const B = this.beats;
    this.samuel.eyesWorld(this.samEyes);
    const leader = this.elders[this.lead];
    if (leader) leader.eyesWorld(this.leadEyes);
    else this.leadEyes.copy(this.samEyes);
    // ---- the elders: one rises and demands (8:5 is theirs: "שִׂימָה־לָּנוּ מֶלֶךְ"), the others react
    this.elders.forEach((e, i) => {
      const f = this.faces[i];
      const role = this.roles[i];
      const look = this.looks[i];
      if (i === this.lead) {
        const mk = this.elderMarks[i % this.elderMarks.length];
        // (CUT v6: the rise starts `lead` s before the shot — the clip and the seat are run on from that moment)
        const r0 = B.rise - B.lead;
        if (this.leadPhase === 0 && t >= r0) {
          // up from the seat (the capture rises and steps forward); the pelvis is let go of the bench as he rises
          e.mocap.play('stand_up', { fade: t > r0 + 0.05 ? 0 : 0.15, time: 0.5 + 1.3 * Math.max(0, t - r0), speed: 1.3 });
          this.leadPhase = 1;
        }
        if (mk.seated) e.seatWeight = 1 - ss(r0 + 0.1, r0 + 0.6, t);
        e.body.feetFwd = 0;
        if (this.leadPhase === 1 && t >= r0 + 1.05) {
          // on his feet: the demand — talk_angry swings the arm up about 1 s after this point
          e.sit(0);
          e.mocap.play('talk_angry', { fade: 0.35, time: 2.6 });
          this.leadPhase = 2;
        }
        f.jawTarget = speechJaw(t - B.verse, 2.6, 12, [0.52], 11) * 2.0;
        f.set({ anger: 0.35 + 0.25 * ss(B.verse, B.verse + 0.6, t), determined: 0.4 });
        e.mocap.lookAt = look.copy(this.samEyes);
        // the demand: the right arm thrown up, the hand open toward Samuel ("שִׂימָה־לָּנוּ מֶלֶךְ"), over the capture
        // (cut7, CUT v5: the arm comes up as he rises — intro-script-v5 P7 "at `rise` the speaking elder rises and lifts
        //  his arm" — and is held through the demand of `verse`)
        // (CUT v6: thrust out from the first frame and held until Samuel turns away)
        const demand = B.lead > 0
          ? ss(r0 + 0.35, r0 + 0.85, t) * (1 - ss(B.turnAway + 0.1, B.turnAway + 0.7, t))
          : ss(B.rise + 0.65, B.rise + 1.15, t) * (1 - ss(B.verse + 1.8, B.verse + 2.3, t));
        e.armPose.R.pose = DEMAND_R;
        e.armPose.R.weight = 0.85 * demand;
        // forward into the demand, chest out
        e.body.lean = 0.08 * demand;
        e.breath.amp = 0.7;
      } else {
        // who he looks at: Samuel; the speaker once he is up; his partner while they talk (heads turned to each other)
        const p = this.partner[i];
        const ph = (i * 0.37) % 0.5;
        const toLeader = t > B.rise + 0.3 + ph * 0.6;
        const talk = p >= 0 ? ss(B.rise + 0.25 + ph, B.rise + 0.6 + ph, t) * (1 - ss(B.verse + 0.75, B.verse + 1.1, t)) : 0;
        const afterTurn = ss(B.turnAway - 0.1, B.turnAway + 0.4, t) * ((i % 3) / 2);
        look.copy(toLeader && role !== 'near' ? this.leadEyes : this.samEyes);
        if (talk > 0.01) look.lerp(this.elders[p].eyesWorld(this.tmp2), talk);
        if (afterTurn > 0) look.lerp(this.samEyes, afterTurn);
        // nods (assent to the demand / to each other): quick dips of the look target, staggered per man
        const n1 = B.rise + 0.7 + (i % 4) * 0.23, n2 = B.verse + 0.85 + (i % 3) * 0.2;
        const nod = Math.exp(-((t - n1) ** 2) / 0.006) + 0.8 * Math.exp(-((t - n2) ** 2) / 0.008) + (role === 'pair' && i > p ? Math.exp(-((t - n1 - 0.45) ** 2) / 0.006) : 0);
        look.y -= 0.09 * Math.min(1.2, nod);
        e.mocap.lookAt = look;
        e.lookRate = 3.5;
        // turning to each other shows in the shoulders too (from behind, the near pair)
        const side = p >= 0 ? Math.sign(i - p) : 0;
        e.body.twist = (role === 'near' ? 0.22 : 0.14) * talk * side + 0.04 * Math.sin(t * 0.9 + i);
        e.headRoll = 0.05 * Math.sin(t * 1.1 + i * 1.7);
        // the staff shifts as he moves his weight
        for (const sd of ['L', 'R'] as const) if (e.upright[sd].prop) e.upright[sd].axis.set(0.035 * Math.sin(t * 0.7 + i), 1, 0.03 * Math.cos(t * 0.5 + i)).normalize();
        // murmurs of assent, a second voice; the pair's talker speaks to his partner
        const talker = role === 'pair' && p >= 0 && i < p;
        f.jawTarget = talker ? speechJaw(t - B.rise - 0.35, 1.9, 8, [0.45], 21 + i) * 1.6
          : i % 3 === 1 ? speechJaw(t - B.verse - 0.5 - i * 0.2, 2.2, 9, [0.4], 13 + i) * 1.4 : 0;
      }
      f.update(dt);
      e.update(dt, camera, viewportH, this.wind);
    });
    // ---- Samuel: grave, listening; at turnAway he turns his face away (8:6 "וַיֵּרַע הַדָּבָר בְּעֵינֵי שְׁמוּאֵל")
    const sam = this.samuel;
    if (this.samPhase === 0 && t >= B.turnAway - 0.35) {
      sam.mocap.play('listen_deny_b', { fade: 0.4, time: 0.55 });
      this.samPhase = 1;
    }
    const away = ss(B.turnAway, B.turnAway + 0.7, t);
    // away: (cut7, CUT v5) from the speaker — on his left now, the right bench — across to his RIGHT and down (the eyes
    // lowered): toward the confrontation's lens on his right, so his face is seen turning away (8:6)
    const yaw = this.samuelMark.yaw - 0.62;
    this.away.set(this.samEyes.x + Math.sin(yaw) * 4, this.samEyes.y - 0.9, this.samEyes.z + Math.cos(yaw) * 4);
    sam.mocap.lookAt = this.tmp.copy(this.leadEyes).lerp(this.away, away);
    sam.lookRate = 2.2;
    sam.lookLimits.yaw = 1.3;
    this.samFace.set({ sad: 0.3 + 0.3 * away, pain: 0.15 * away });
    // (cut7, CUT v6) his eyes close as he turns away (8:6 — the grief of it), then half open, lowered
    const shut = ss(B.turnAway - 0.05, B.turnAway + 0.35, t) * (1 - 0.45 * ss(B.turnAway + 1.0, B.turnAway + 1.5, t));
    const fu = sam.human.rig.faceUnits;
    fu.LeftUpperLidClosed = fu.RightUpperLidClosed = 0.85 * shut;
    this.samFace.update(dt);
    sam.update(dt, camera, viewportH, this.wind);
  }
}
