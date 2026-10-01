import * as THREE from 'three';
import type { Expression } from '../../characters/human/HumanRig';
import {
  actionTime as blockingActionTime, armyAt, BEATS, samuelAt, saulAt, TEAR_ACTION, timeScale, type GilgalShotName,
} from '../gilgal/gilgalBlocking';
import { INTRO_SHOTS, VERDICT_WORDS, type IntroWord } from '../../content/introScript';
import type { FilmActor, ArmPose } from './FilmActor';

/*
 * Performances of the opening film, CUT v2 (docs/intro-script-v2.md: the shot list, the timing contract and the
 * performance brief; docs/director-notes-v4.md: what failed in the rough cut). Every beat is read from the shared
 * timing contract (src/content/introScript.ts -> src/film/gilgal/gilgalBlocking BEATS / TEAR_ACTION), so the actors,
 * the cameras and the score stay in register.
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
  constructor(readonly actor: FilmActor, readonly rate = 3) {}
  set(t: Partial<Record<Expression, number>>) {
    for (const k in this.target) this.target[k as Expression] = 0;
    Object.assign(this.target, t);
  }
  snap() {
    Object.assign(this.cur, this.target);
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
  }
  /** clear the mouth shapes */
  quiet() {
    for (const k in this.lips) this.lips[k] = 0;
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
  dustWall: [2.2, 0], king: [2.6, 0], spearRaised: [2.4, 0], silence: [2.0, 1.4], faceOff: [1.5, 1.3],
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
  private lungeLegs = false;
  private samPhase = 0;
  private blinked = false;
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
    samuel.human.rig.faceBias.LeftUpperLidClosed = 0.12; // heavy, tired lids (15:11 he cried all night) — the eyes stay alive
    samuel.human.rig.faceBias.RightUpperLidClosed = 0.12;
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
   * The spear in his hand (G1-G4) or not with him (G5-G7: the armour-bearer has it — the director's notes: a planted
   * spear stood as a stray vertical line at the edge of the tear's frame)
   */
  private spearPlanted(on: boolean, _s?: { pos: THREE.Vector3; yaw: number }) {
    const { saul } = this.cast;
    const sp = saul.props.spear;
    if (!sp) return;
    if (on) {
      const scene = saul.root.parent;
      if (!scene) return;
      scene.add(sp);
      sp.visible = false;
      saul.upright.R.weight = 0;
      saul.human.rig.setFingers('R', 'relaxed');
    } else if (sp.parent !== null && sp.parent === saul.root.parent) {
      sp.visible = true;
      saul.holdProp('spear', 'R');
      saul.upright.R.weight = 1;
    }
  }

  /** call on each cut (and before the first frame of a shot) */
  enter(shot: GilgalShotName) {
    const { saul, samuel } = this.cast;
    const plant = shot === 'tear' || shot === 'verdict' || shot === 'saulAlone' || shot === 'rise';
    this.spearPlanted(plant, plant ? saulAt('tear', 0) : undefined);
    this.shot = shot;
    this.clock = 0;
    for (const a of [saul, samuel, this.cast.armourBearer]) {
      if (!a) continue;
      a.headingSnap = true;
      a.body.drop = a.body.lean = a.body.twist = a.body.side = 0;
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
    this.samPhase = 0;
    this.blinked = false;
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
        // the halt: the last step of the stop (the clip plants the feet ~0.35 s in), then he stands for the thrust
        saul.mocap.play('walk_stop_rb', { fade: 0, time: 0.95, onEnd: () => saul.mocap.play('idle_king', { fade: 0.4, time: 0.8 }) });
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
    samuel.mocap.play('listen_sad', { fade: 0, time: shot === 'verdict' ? 0.9 : 0.3 });
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
        saul.armPose.R.pose = shot === 'saulAlone' ? POSES.clothLookR : POSES.clothFistR;
        saul.armPose.R.weight = 1;
        saul.human.rig.setFingers('R', 'grip');
        saul.update(0);
        tear.progress = 1;
        tear.grab(saul.human.sockets.handGripR);
      } else tear.reset();
    }
    this.saulFace.set({});
    this.samFace.set({});
    this.saulFace.quiet();
    this.samFace.quiet();
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
    }
    switch (shot) {
      case 'dustWall':
      case 'king': {
        saul.mocap.matchSpeed('walk_cool', s.walk);
        // eyes on the road far ahead; late in G2 the head turns to his right (toward the ranks at his side)
        const turn = shot === 'king' ? ss(2.4, 3.6, t) * 0.55 : 0;
        const fwd = this._f.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
        const right = this._r.set(-Math.cos(s.yaw), 0, Math.sin(s.yaw));
        saul.mocap.lookAt = this.tmp.copy(s.pos).addScaledVector(fwd, 30).addScaledVector(right, 30 * Math.tan(turn)).setY(this.ground(s.pos.x, s.pos.z) + 2.1);
        saul.lookRate = 2.5;
        this.saulFace.set({ determined: 0.55, anger: 0.08 });
        this.saulFace.jawTarget = 0;
        saul.breath.amp = 0.35;
        saul.breath.rate = 0.4;
        break;
      }
      case 'spearRaised': {
        const B = BEATS.spearRaised;
        // the whole body in the thrust: the knee dip (anticipation), the drive up (legs extend, the chest arches
        // back, a twist onto the spear side), the head back with the shout, then held high, chest heaving
        const dip = ss(B.spearUp - 0.32, B.spearUp - 0.06, t) * (1 - ss(B.spearUp - 0.06, B.spearUp + 0.22, t));
        const drive = ss(B.spearUp - 0.08, B.spearUp + 0.3, t);
        const roar = ss(B.roar - 0.1, B.roar + 0.2, t) * (1 - 0.35 * ss(B.roar + 1.3, B.roar + 1.9, t));
        saul.body.drop = 0.15 * dip + 0.03 * drive;
        saul.body.lean = 0.15 * dip - 0.24 * drive - 0.06 * roar;
        saul.body.twist = 0.18 * drive;
        saul.body.side = -0.04 * drive;
        saul.headRoll = 0.07 * drive;
        const fwd = this._f.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
        // the shaft thrust up and forward (toward the ranks he faces), not a pole held straight up
        saul.upright.R.axis.set(0, 1, 0).addScaledVector(fwd, 0.35 * drive).normalize();
        // eyes: up to the spear point as it goes up, then out over the army's heads with the shout
        const upLook = ss(B.spearUp - 0.2, B.spearUp + 0.2, t) * (1 - 0.6 * ss(B.roar + 0.1, B.roar + 0.6, t));
        saul.mocap.lookAt = this.tmp.copy(s.pos).addScaledVector(fwd, 8).setY(this.ground(s.pos.x, s.pos.z) + 2 + 9 * upLook);
        saul.lookRate = 7;
        this.saulFace.set({ anger: 0.6 * roar, effort: 0.45 * Math.max(roar, drive * 0.6), determined: 0.45 * (1 - roar) });
        this.saulFace.jawTarget = 0.62 * roar + 0.05 * Math.sin(t * 9) * roar;
        this.saulFace.lips.UpperLipUp = 0.35 * roar;
        saul.breath.amp = 0.5 + 0.6 * ss(B.roar + 1, B.roar + 1.8, t);
        saul.breath.rate = 0.55;
        break;
      }
      case 'silence': {
        saul.mocap.lookAt = this.eyeOf(samuel, this.saulTarget);
        saul.lookRate = 3;
        this.saulFace.set({ awe: 0.3 * ss(0.3, 1.2, t), fear: 0.25 * ss(1.2, 2.6, t), determined: 0.35 * (1 - ss(0.4, 1.6, t)) });
        this.saulFace.jawTarget = 0.28 * (1 - ss(0.0, 0.45, t)) + 0.05;
        saul.breath.amp = 0.9 - 0.3 * ss(1, 3, t);
        saul.breath.rate = 0.5;
        break;
      }
      case 'tear':
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
        this.saulFace.jawTarget = 0.06 * ss(V.speechEnd - 0.8, V.speechEnd, t);
        saul.breath.amp = 0.8;
        saul.breath.rate = 0.45;
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
        const tr = (0.018 + 0.03 * tight) * lift;
        base.fa = [base.fa[0] + tr * noise1(t * 9, 1), base.fa[1] + tr * noise1(t * 7, 2), base.fa[2]];
        base.hd = [base.hd[0] + 1.4 * tr * noise1(t * 11, 3) - 0.25 * tight, base.hd[1], base.hd[2] + tr * noise1(t * 8, 4)];
        saul.armPose.R.pose = base;
        saul.armPose.R.weight = 1;
        saul.human.rig.setFingers('R', tight > 0.5 ? 'fist' : 'grip');
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
    if (shot === 'tear') this.tearSamuel(at);
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
      samuel.place(m.pos, m.yaw);
      samuel.mocap.lookAt = this.eyeOf(saul, this.samTarget);
      if (shot === 'silence') {
        // grieving, eyes on the road before him; as the roar dies he lifts his head to the king
        const lift = ss(BEATS.silence.headsTurn + 0.2, BEATS.silence.headsTurn + 1.1, t);
        samuel.headWorld(this.tmp).add(this._f.set(Math.sin(m.yaw) * 4, -1.3, Math.cos(m.yaw) * 4));
        this.samTarget.lerp(this.tmp, 1 - lift);
        samuel.breath.amp = 0.4;
      }
      samuel.lookRate = 2;
      if (shot === 'silence') {
        // one step toward the king (the capture's step, speed-matched; the legs only)
        const step = BEATS.silence.step;
        const cur = samuel.mocap.current()?.name;
        if (m.walk > 0 && cur !== 'walk_slow') {
          samuel.mocap.play('walk_slow', { fade: 0.3, time: 0.35 });
          samuel.mocap.matchSpeed('walk_slow', 0.75);
        } else if (t > step + 0.8 && cur === 'walk_slow') samuel.mocap.play('listen_sad', { fade: 0.5, time: 1 });
      }
      this.samFace.set({ sad: 0.45, determined: 0.35 });
      this.samFace.jawTarget = 0;
    }
    // ---------------------------------------------------------------- ARMOUR-BEARER one step behind the king
    if (armourBearer) {
      // one step behind the king — in the tear he stays where the king stood (he does not slide after the lunge)
      const anchor = shot === 'tear' ? saulAt('tear', 0) : s;
      const back = V3(-Math.sin(anchor.yaw) * 1.6, 0, -Math.cos(anchor.yaw) * 1.6).add(V3(Math.cos(anchor.yaw) * 0.7, 0, -Math.sin(anchor.yaw) * 0.7));
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

  /**
   * G5, Saul: "וַיַּחֲזֵק בִּכְנַף־מְעִילוֹ" — pleading, he sees the old man turn away; he steps after him (the walk),
   * lunges low (the walk frozen in a long right stride under a pelvis drop + a forward fold), his fist closes on the
   * lower corner of the me'il (grip), he holds on and pulls back and up (pull) — the wool gives (rip .. free), the
   * corner stays in his fist. Desperation, not violence (visual-bible 3.3): brows up, a gasp at the grab, shock.
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
    // ---- placement: the blocking's path, pulled onto a lunge distance behind the corner as the reach closes
    const lungeReach = 0.74; // root -> grip, horizontally, at full lunge (2 m man diving low, arm down-forward)
    const tx = this.corner.x - fwd.x * lungeReach - right.x * 0.22;
    const tz = this.corner.z - fwd.z * lungeReach - right.z * 0.22;
    let x: number, z: number;
    if (!this.grabbed) {
      const k = ss(A.lunge - 0.1, A.grip - 0.05, at);
      x = THREE.MathUtils.lerp(s.pos.x, tx, k);
      z = THREE.MathUtils.lerp(s.pos.z, tz, k);
    } else {
      // after the grip he plants and pulls back (his weight against the old man's step), then recoils as it gives
      const pull = 0.12 * ss(A.pull - 0.05, A.free, at) + 0.08 * ss(A.free, A.free + 0.3, at);
      x = this.grabAt.x - fwd.x * (lungeReach + pull) - right.x * 0.22;
      z = this.grabAt.z - fwd.z * (lungeReach + pull) - right.z * 0.22;
    }
    saul.place(this.tmp.set(x, 0, z), yaw);
    // ---- clips: pleading stand -> the step after him -> the lunge (stand + frozen stride) -> hold
    const cur = saul.mocap.current()?.name;
    const goFrom = A.turn + 0.25;
    if (at >= goFrom && at < A.lunge + 0.1 && cur !== 'walk') saul.mocap.play('walk', { fade: 0.2, sync: true, time: 0.25 });
    if (cur === 'walk') saul.mocap.matchSpeed('walk', THREE.MathUtils.clamp(Math.hypot(saul.velocity.x, saul.velocity.z), 0.9, 2.0));
    if (at >= A.lunge + 0.1 && cur !== 'idle_king') saul.mocap.play('idle_king', { fade: 0.3, time: 0.5 });
    if (at >= A.lunge - 0.08 && !this.lungeLegs) {
      // the legs: the walk frozen in a long stride, RIGHT foot forward — with the pelvis drop, a lunge onto the reach
      saul.mocap.playLayer('lunge', 'walk', { mask: 'legs', time: 0.74, speed: 0, fade: 0.25 });
      this.lungeLegs = true;
    }
    // ---- body: low in the lunge, then up and back as he pulls; the recoil when the wool gives
    const lunge = ss(A.lunge, A.grip + 0.02, at) * (1 - 0.55 * ss(A.pull - 0.1, A.free, at));
    const recoil = ss(A.free - 0.05, A.free + 0.2, at) * (1 - 0.5 * ss(A.free + 0.2, A.end, at));
    // a dive at the hem: the pelvis low, the chest well forward, the head kept low behind the old man's hip (the
    // silhouettes stay apart: the reaching arm is the only link between them)
    saul.body.drop = 0.5 * lunge;
    saul.body.lean = 0.78 * lunge - 0.16 * ss(A.pull, A.free, at) - 0.1 * recoil;
    saul.body.twist = 0.2 * lunge;
    saul.headingRate = 12;
    // ---- arms: the right hand to the corner (IK), the helmet stays under the left arm
    saul.armPose.R.pose = null;
    saul.armPose.R.weight = 0;
    saul.upright.R.weight = 0;
    if (!this.grabbed) {
      saul.reach.R.target = this.tearTarget.copy(this.corner);
      saul.reach.R.weight = ss(A.lunge - 0.1, A.grip - 0.04, at);
      if (at >= A.lunge - 0.1) saul.human.rig.setFingers('R', 'open');
      if (at >= A.grip && tear) {
        this.grabbed = true;
        saul.human.rig.setFingers('R', 'fist');
        saul.update(0); // the hand exactly at the corner this frame
        tear.grab(saul.human.sockets.handGripR);
        this.grabAt.copy(this.corner);
      }
    } else {
      // the fist pulls back toward him and up (the wool stretches, then gives), and swings back when it is free
      // (the insert G5b is framed on the fist: the pull takes the torn corner well away from the hem, the threads
      // stretching between them, then the recoil when it comes free)
      const p = ss(A.grip + 0.05, A.free, at);
      this.tearTarget.copy(this.grabAt).addScaledVector(fwd, -0.19 * p - 0.14 * recoil).add(this.tmp2.set(0, 0.18 * p + 0.1 * recoil, 0));
      saul.reach.R.target = this.tearTarget;
      saul.reach.R.weight = 1;
    }
    if (tear) tear.progress = ss(A.rip, A.free, at);
    // ---- eyes and face: on Samuel; down to the corner as he lunges; UP to Samuel's face as he holds — their eyes
    // meet while the wool gives
    if (at < A.lunge - 0.1) saul.mocap.lookAt = this.eyeOf(samuel, this.saulTarget);
    else if (at < A.grip + 0.12) saul.mocap.lookAt = this.corner;
    else saul.mocap.lookAt = this.eyeOf(samuel, this.saulTarget);
    saul.lookRate = 9;
    const reach = ss(A.lunge - 0.2, A.grip, at);
    const gone = ss(A.free - 0.1, A.free + 0.15, at);
    this.saulFace.set({
      sad: 0.5 * (1 - reach) + 0.3 * gone, fear: 0.35 + 0.2 * reach - 0.1 * gone, effort: 0.6 * reach * (1 - gone),
      awe: 0.45 * gone, pain: 0.15 * gone,
    });
    // a pleading word before he moves; a gasp as he lunges; the mouth hangs open when it tears
    this.saulFace.jawTarget = speechJaw(at, A.turn + 0.2, 3, [], 3) * 1.2 + 0.2 * ss(A.lunge, A.grip, at) * (1 - ss(A.grip + 0.15, A.pull, at)) + 0.16 * gone;
    saul.breath.amp = 0.8;
    saul.breath.rate = 0.6;
  }

  /**
   * G5, Samuel: "וַיִּסֹּב שְׁמוּאֵל לָלֶכֶת" — the old man's turn-step to his left into a walk away (the capture's root
   * motion carries him); the seized corner jerks him, he leans against it, the wool tears, he comes free, stops, and
   * turns his head back over his shoulder to the king.
   */
  private tearSamuel(at: number) {
    const { saul, samuel } = this.cast;
    const A = TEAR_ACTION;
    const mp = samuel.mocap;
    // the ground under the root-motion walk
    samuel.root.position.y = this.ground(samuel.root.position.x, samuel.root.position.z);
    if (this.samPhase === 0 && at >= A.turn) {
      mp.play('turn_go_L', { fade: 0.2 });
      this.samPhase = 1;
    }
    if (this.samPhase === 1) {
      // held: the step falters from the grip on (the corner holds him back), then hangs until the wool gives
      const held = ss(A.grip, A.grip + 0.15, at) * (1 - ss(A.free, A.free + 0.12, at));
      mp.setSpeed('turn_go_L', 1 - 0.8 * held);
      if (at >= A.free) {
        mp.play('walk_slow', { fade: 0.35, time: 0.55 });
        mp.matchSpeed('walk_slow', 0.55);
        this.samPhase = 2;
      }
    }
    if (this.samPhase === 2 && at >= A.free + 0.35) {
      // he stops
      mp.play('listen_sad', { fade: 0.45, time: 0.2 });
      this.samPhase = 3;
    }
    // eyes: on Saul, then ahead (east, his way), then back over the shoulder once free
    if (at < A.turn + 0.1) mp.lookAt = this.eyeOf(saul, this.samTarget);
    else if (at < A.free + 0.05) {
      const fwd = this._f.set(Math.sin(samuel.yaw), 0, Math.cos(samuel.yaw));
      samuel.human.bones.head.getWorldPosition(this.samTarget);
      mp.lookAt = this.samTarget.addScaledVector(fwd, 20);
    } else mp.lookAt = this.eyeOf(saul, this.samTarget);
    samuel.lookLimits.yaw = 1.45;
    samuel.lookRate = at < A.free ? 4 : 2.5;
    // the jerk of the held robe (a hitch back in the chest), then the lean against it; the chest turns back to him
    const jerk = ss(A.grip, A.grip + 0.1, at) * (1 - ss(A.grip + 0.15, A.pull + 0.1, at));
    const against = ss(A.grip + 0.1, A.pull + 0.1, at) * (1 - ss(A.free, A.free + 0.2, at));
    samuel.body.lean = -0.12 * jerk + 0.1 * against;
    samuel.body.twist = -0.4 * ss(A.free, A.end + 0.2, at);
    this.samFace.set({ sad: 0.5 + 0.15 * ss(A.grip, A.free, at), determined: 0.35, pain: 0.2 * jerk + 0.1 * against });
    this.samFace.jawTarget = 0;
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
    samuel.lookRate = 3.2;
    const eyes = this.eyeOf(saul, this.samTarget);
    // small nods on the stressed syllables (the last of each word) — the look target dips a few centimetres
    let nod = 0;
    for (const w of VERDICT_WORDS) {
      const e = w.t + w.dur * 0.75;
      nod += Math.exp(-((t - e) * (t - e)) / 0.012);
    }
    eyes.y -= 0.035 * Math.min(1, nod);
    samuel.mocap.lookAt = eyes;
    samuel.headRoll = -0.06 * ss(V.turnBack + 0.3, V.speech, t);
    if (!this.blinked && t >= V.speech - 0.28) {
      samuel.human.rig.blink();
      this.blinked = true;
    }
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
    this.samFace.set({ sad: 0.35 + 0.1 * (1 - speaking), determined: 0.5 * speaking + 0.2, anger: 0.08 * speaking });
    samuel.breath.amp = 0.35;
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

/** the demanding elder's raised arm (proxy Euler, over the capture) */
const DEMAND_R: ArmPose = { ua: [-2.45, 0.2, -0.38], fa: [-0.55, 0.1, 0], hd: [0.35, 0, 0.1] };

/** the shot's beats (P5 of the contract, introScript 'ramah' : 'elders'; seconds of the shot) */
const RAMAH_BEATS = (() => {
  const b = INTRO_SHOTS.find((x) => x.set === 'ramah' && x.take === 'elders')?.beats ?? {};
  return { rise: b.rise ?? 0.5, verse: b.verse ?? 1.0, turnAway: b.turnAway ?? 2.6 };
})();

export class RamahPerformance {
  private faces: FaceDriver[] = [];
  private samFace: FaceDriver;
  /** Samuel's eyes (world), refreshed every frame: the elders' eye-line */
  private readonly samEyes = new THREE.Vector3();
  private readonly leadEyes = new THREE.Vector3();
  private readonly away = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  readonly wind = new THREE.Vector3(0.8, 0, -0.2);
  /** beats (seconds of the shot): the elder rises, the verse, Samuel turns his face away */
  readonly beats: { rise: number; verse: number; turnAway: number };
  private lead = -1;
  private leadPhase = 0;
  private samPhase = 0;
  private lastT = -1;

  constructor(readonly samuel: FilmActor, readonly elders: FilmActor[], readonly samuelMark: RamahMark, readonly elderMarks: RamahMark[], readonly ground: (x: number, z: number) => number = () => 0, beats: Partial<{ rise: number; verse: number; turnAway: number }> = {}) {
    this.beats = { ...RAMAH_BEATS, ...beats };
    samuel.ground = ground;
    samuel.enableFaceLight(0xffe2c4);
    samuel.faceLightRig.side = 0.85; // more of a 3/4 key: the old face needs modelling (the lines vanish in a flat fill)
    samuel.faceLightRig.up = 0.35;
    samuel.faceFill = 1.0;
    samuel.place(samuelMark.pos, samuelMark.yaw);
    samuel.root.updateMatrixWorld(true);
    samuel.eyesWorld(this.samEyes);
    samuel.human.rig.faceBias.LeftUpperLidClosed = 0.1;
    samuel.human.rig.faceBias.RightUpperLidClosed = 0.1;
    this.samFace = new FaceDriver(samuel, 2);
    // the demanding elder: the seated man nearest the line to Samuel (he rises and demands); else the first
    let best = -1, bd = 1e9;
    elders.forEach((_, i) => {
      const mk = elderMarks[i % elderMarks.length];
      if (!mk.seated) return;
      const d = mk.pos.distanceTo(samuelMark.pos);
      if (d < bd) { bd = d; best = i; }
    });
    this.lead = best >= 0 ? best : 0;
    elders.forEach((e, i) => {
      e.ground = ground;
      const mk = elderMarks[i % elderMarks.length];
      e.place(mk.pos, mk.yaw);
      if (e.props.staff) e.holdProp('staff', i % 2 ? 'R' : 'L');
      e.headingSnap = true;
      const f = new FaceDriver(e, 2.5);
      this.faces.push(f);
    });
    this.reset();
  }

  /** back to the first frame of the shot (every clip, pose and face) */
  reset() {
    const { samuel, elders, elderMarks } = this;
    samuel.mocap.play('listen_sad', { fade: 0, time: 0.4 });
    samuel.mocap.lookWeight = 1;
    this.samPhase = 0;
    this.leadPhase = 0;
    // heads of families, dignified (bible 3.7), and angry: talk, gesture, lean in, arms akimbo — never frozen
    const standing = ['talk_excited', 'listen_angry', 'idle_angry', 'talk_gesture', 'idle_n1'];
    elders.forEach((e, i) => {
      const mk = elderMarks[i % elderMarks.length];
      e.place(mk.pos, mk.yaw);
      if (i === this.lead) {
        // seated on the bench (the capture's own seated pose; the pelvis held onto the bench), about to rise
        e.sit(mk.seated ? mk.pos.y - this.ground(mk.pos.x, mk.pos.z) : 0);
        e.body.feetFwd = 0;
        e.seatWeight = 1;
        e.mocap.play('stand_up', { fade: 0, time: 0.2, speed: 0 });
        e.cancelHeading = true;
      } else {
        if (mk.seated) e.sit(mk.pos.y - this.ground(mk.pos.x, mk.pos.z));
        const clip = mk.seated ? (i % 2 ? 'talk_excited' : 'idle_n1') : standing[i % standing.length];
        e.mocap.play(clip, { fade: 0, time: (i * 1.37) % 3, mirror: i % 2 === 1 });
      }
      e.mocap.lookAt = this.samEyes;
      e.headingSnap = true;
      const f = this.faces[i];
      f.set(i === this.lead ? { anger: 0.3, determined: 0.4 } : i % 3 === 0 ? { determined: 0.45, anger: 0.15 } : i % 3 === 1 ? { anger: 0.3, sad: 0.1 } : { determined: 0.3, fear: 0.1 });
      f.snap();
    });
    this.samFace.set({ sad: 0.35, determined: 0.3 });
    this.samFace.snap();
    this.lastT = -1;
  }

  update(t: number, dt: number, camera?: THREE.Camera, viewportH?: number) {
    if (t < this.lastT - 0.05) this.reset();
    this.lastT = t;
    const B = this.beats;
    this.samuel.eyesWorld(this.samEyes);
    // ---- the elders: one rises and demands (8:5 is theirs: "שִׂימָה־לָּנוּ מֶלֶךְ"), the others react
    this.elders.forEach((e, i) => {
      const f = this.faces[i];
      if (i === this.lead) {
        const mk = this.elderMarks[i % this.elderMarks.length];
        if (this.leadPhase === 0 && t >= B.rise) {
          // up from the seat (the capture rises and steps forward); the pelvis is let go of the bench as he rises
          e.mocap.play('stand_up', { fade: 0.15, time: 0.5, speed: 1.3 });
          this.leadPhase = 1;
        }
        if (mk.seated) e.seatWeight = 1 - ss(B.rise + 0.1, B.rise + 0.6, t);
        e.body.feetFwd = 0;
        if (this.leadPhase === 1 && t >= B.rise + 1.05) {
          // on his feet: the demand — talk_angry swings the arm up about 1 s after this point
          e.sit(0);
          e.mocap.play('talk_angry', { fade: 0.35, time: 2.6 });
          this.leadPhase = 2;
        }
        f.jawTarget = speechJaw(t - B.verse, 2.6, 12, [0.52], 11) * 2.0;
        f.set({ anger: 0.35 + 0.25 * ss(B.verse, B.verse + 0.6, t), determined: 0.4 });
        e.mocap.lookAt = this.samEyes;
        // the demand: the right arm thrown up, the hand open toward Samuel ("שִׂימָה־לָּנוּ מֶלֶךְ"), over the capture
        const demand = ss(B.verse + 0.4, B.verse + 0.8, t) * (1 - ss(B.verse + 1.8, B.verse + 2.3, t));
        e.armPose.R.pose = DEMAND_R;
        e.armPose.R.weight = 0.85 * demand;
      } else {
        // murmurs of assent, a second voice
        f.jawTarget = i % 3 === 1 ? speechJaw(t - B.verse - 0.5 - i * 0.2, 2.2, 9, [0.4], 13 + i) * 1.4 : 0;
        // they look at Samuel, and at the elder on his feet when he rises
        const leader = this.elders[this.lead];
        e.mocap.lookAt = leader && t > B.rise + 0.3 && i % 2 === 0 ? leader.eyesWorld(this.leadEyes) : this.samEyes;
      }
      f.update(dt);
      e.update(dt, camera, viewportH, this.wind);
    });
    // ---- Samuel: grave, listening; at turnAway he turns his face away (8:6 "וַיֵּרַע הַדָּבָר בְּעֵינֵי שְׁמוּאֵל")
    const sam = this.samuel;
    const leader = this.elders[this.lead];
    if (this.samPhase === 0 && t >= B.turnAway - 0.35) {
      sam.mocap.play('listen_deny_b', { fade: 0.4, time: 0.55 });
      this.samPhase = 1;
    }
    const away = ss(B.turnAway, B.turnAway + 0.7, t);
    if (leader) leader.eyesWorld(this.leadEyes);
    else this.leadEyes.copy(this.samEyes).add(V3(0, 0, 3));
    // away: to his right and down (the eyes lowered), relative to the elders' direction
    const d = this.tmp.copy(this.leadEyes).sub(this.samEyes);
    const yaw = Math.atan2(d.x, d.z) - 1.05;
    this.away.set(this.samEyes.x + Math.sin(yaw) * 4, this.samEyes.y - 0.9, this.samEyes.z + Math.cos(yaw) * 4);
    sam.mocap.lookAt = this.tmp.copy(this.leadEyes).lerp(this.away, away);
    sam.lookRate = 2.2;
    sam.lookLimits.yaw = 1.3;
    this.samFace.set({ sad: 0.35 + 0.3 * away, determined: 0.3, pain: 0.15 * away });
    this.samFace.update(dt);
    sam.update(dt, camera, viewportH, this.wind);
  }
}

