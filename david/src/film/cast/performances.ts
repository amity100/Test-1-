import * as THREE from 'three';
import type { Expression } from '../../characters/human/HumanRig';
import { armyAt, samuelAt, saulAt, SHOT_DURATION, SLOWMO, timeScale, type GilgalShotName } from '../gilgal/gilgalBlocking';
import { SAMUEL, SAUL_FACE } from '../gilgal/gilgalLayout';
import type { FilmActor, ArmPose } from './FilmActor';

/*
 * Performances of shots 5-12 (docs/intro-script.md; acting notes from docs/visual-bible.md 3.1-3.3):
 *
 *   GilgalPerformance  shots 6-12 on the Gilgal set, driven by src/film/gilgal/gilgalBlocking (saulAt / samuelAt /
 *                      armyAt: the same clock the cameras use, so actors and cameras stay in register).
 *     Saul    6-7   the king's stride (mocap walk_king, speed-matched to the column, slow motion in 7), spear upright
 *                   in the right hand, the bronze helmet under the left arm, chin up, eyes on the road ahead.
 *             8     halts (walk_halt -> idle_king) and raises the spear to the sky, roaring (jaw open, anger/effort).
 *             9     lowers the spear; his face falls as he sees the old man in the road.
 *             10a   face to face: towering over Samuel (eye line = Samuel's at Saul's collarbone), pleading
 *                   (15:24-25 "חָטָאתִי ... וְשׁוּב עִמִּי") — sad / fear, eyes on Samuel's eyes, breathing high.
 *             10b   (TEAR_BEATS, action time) Samuel turns to go (0.2); Saul goes after him (walk, 0.3), lunges
 *                   low (1.45: the walk frozen in a right-foot stride under a pelvis drop + forward fold, FilmActor
 *                   .body), the grip IK closes his fist on the lower corner of the me'il (1.95; slow motion from
 *                   t 1.8-2.3 s), he holds on and pulls back while Samuel's step carries on, looks UP into Samuel's
 *                   face — the wool tears along the weave (2.08-3.2), threads stretch and snap, the corner with
 *                   its tzitzit stays in his fist (15:27; desperation, not violence, 3.3).
 *             11    listens, the torn piece in his fist; the verdict lands: the eyes widen, the jaw slackens.
 *             12    the long close-up: shattered — head bowed a little, unfocused eyes, trembling breath, the fist
 *                   with the cloth held at his chest.
 *     Samuel 9-10a  stands in the road, upright and still, wrapped in the me'il; eyes on the king (red-rimmed,
 *                   grieving; iron resolve — not anger, not triumph).
 *             10b   turns away to leave (yaw from samuelAt, the head leading), walks (upright walk, slowed), the
 *                   corner is seized — a jerk in the chest — keeps his step; the wool tears; he stops and turns his
 *                   head back over the shoulder to the king.
 *             11    turned back to the king: the verdict, quiet and hard (jaw speech keys, sad + determined).
 *             12    turns and walks away east (walk_old, slow).
 *   RamahPerformance   shot 5: Samuel before the elders at the gate of Ramah (idle_old; the elders talk / argue /
 *                      gesture with open palms, some seated, some leaning on staffs).
 *
 * Every clip is from src/characters/mocap (CMU). Arm holds (helmet, spear) are proxy poses masked over the mocap.
 */

export const GILGAL_CLIPS = ['walk_king', 'walk_halt', 'idle_king', 'raise_arm_R', 'grab_pull_R', 'idle_old', 'old_turn_walk', 'walk_old', 'flinch', 'march', 'walk'];
export const RAMAH_CLIPS = ['idle_king', 'idle_old', 'talk_gesture', 'argue', 'point_directions', 'idle_bus', 'idle_shift', 'walk_old_hunched'];

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mixPose = (a: ArmPose, b: ArmPose, t: number): ArmPose => ({ ua: lerp3(a.ua, b.ua, t), fa: lerp3(a.fa, b.fa, t), hd: lerp3(a.hd, b.hd, t) });

/**
 * action time of a shot at shot time t (the integral of gilgalBlocking.timeScale — same piecewise form as the
 * blocking's own, so the actors stay in register with saulAt / samuelAt and the cameras)
 */
export function actionTime(shot: GilgalShotName, t: number) {
  if (shot === 'king') return t * SLOWMO.king;
  if (shot === 'tear') return t < 2.05 ? t : 2.05 + (t - 2.05) * SLOWMO.tear;
  return t;
}

/** THE TEAR (shot 10b) in action time: the beats (s) */
export const TEAR_BEATS = {
  /** Samuel starts to turn away (15:27 "וַיִּסֹּב שְׁמוּאֵל לָלֶכֶת") */
  turn: 0.2,
  /** Saul goes after him */
  go: 0.3,
  /** the lunge: pelvis drops, the torso folds, the arm reaches */
  lunge: 1.45,
  /** the fist closes on the corner (the slow motion is fully in by t = 2.3 s) */
  grab: 1.95,
  /** the tear runs through the wool (progress 0 -> 1) */
  tearFrom: 2.08,
  tearTo: 3.2,
};

/** arm holds (proxy Euler, character axes; x < 0 swings forward; L: +z = outward, R: -z = outward) */
export const POSES = {
  /** the bronze helmet cradled under the left arm against the hip */
  helmetL: { ua: [0.08, 0, 0.2], fa: [-1.4, 0, 0], hd: [0, 0, 0] } as ArmPose,
  /** spear carried upright in the right hand, elbow bent, hand at the belt */
  spearCarryR: { ua: [-0.12, -0.1, -0.16], fa: [-1.2, 0, 0], hd: [0.1, 0, 0.05] } as ArmPose,
  /** spear raised to the sky (shot 8 peak) */
  spearRaiseR: { ua: [-2.85, 0.1, -0.32], fa: [-0.25, 0, 0], hd: [0.25, 0, 0] } as ArmPose,
  /** fist with the torn cloth held before the chest (shot 12) */
  clothFistR: { ua: [-0.35, 0, -0.1], fa: [-1.75, 0.2, 0], hd: [0.2, 0, 0] } as ArmPose,
};

/** smooth expression mixer: set targets, it eases the rig's expression weights */
export class FaceDriver {
  readonly target: Partial<Record<Expression, number>> = {};
  private cur: Partial<Record<Expression, number>> = {};
  jawTarget = 0;
  private jaw = 0;
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
    this.jaw += (this.jawTarget - this.jaw) * (1 - Math.exp(-18 * dt));
    rig.jawOpen = this.jaw;
  }
}

/** speech jaw curve for a line of `syllables` over `dur` s with pauses at the given fractions */
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

export class GilgalPerformance {
  private shot: GilgalShotName | null = null;
  private saulFace: FaceDriver;
  private samFace: FaceDriver;
  private grabbed = false;
  private lookSaul = new THREE.Vector3();
  private lookSam = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private samTurnStarted = false;
  /** tear choreography state */
  private saulFrom = new THREE.Vector3();
  private grabAt = new THREE.Vector3();
  private readonly corner = new THREE.Vector3();
  private readonly tearTarget = new THREE.Vector3();
  private readonly _p = new THREE.Vector3();
  private readonly _f = new THREE.Vector3();
  private lungeLegs = false;
  /** wind (world m/s) passed to the actors' hair / cloth */
  readonly wind = new THREE.Vector3(1.4, 0, 0.3);
  /** hook for the film's FX: a thread snaps (lint / dust puff) */
  onThreadSnap: ((p: THREE.Vector3) => void) | null = null;

  constructor(readonly cast: GilgalCast, readonly ground: (x: number, z: number) => number = () => 0) {
    this.saulFace = new FaceDriver(cast.saul, 2.5);
    this.samFace = new FaceDriver(cast.samuel, 2);
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
    // film light on the two faces (the low sun is behind Saul in 7-9): created here, before the set is precompiled
    saul.enableFaceLight();
    samuel.enableFaceLight(0xffe2c4);
    samuel.faceLightRig.side = 0.85; // a 3/4 key on the old face: the lines of age need modelling, a flat fill erases them
    samuel.faceLightRig.up = 0.35;
    samuel.human.rig.faceBias.LeftUpperLidClosed = 0.12; // heavy, tired lids (15:11 he cried all night) — the eyes stay alive
    samuel.human.rig.faceBias.RightUpperLidClosed = 0.12;
    if (samuel.tear) samuel.tear.onSnap = (p) => this.onThreadSnap?.(p);
    if (cast.armourBearer) {
      cast.armourBearer.ground = ground;
      cast.armourBearer.holdProp('main', 'R');
      cast.armourBearer.upright.R.prop = 'main';
      cast.armourBearer.upright.R.weight = 1;
      cast.armourBearer.armPose.R.pose = POSES.spearCarryR;
      cast.armourBearer.armPose.R.weight = 1;
      const sh = cast.armourBearer.props.shield;
      if (sh) cast.armourBearer.human.sockets.handGripL.add(sh);
    }
  }

  /** the spear held (upright) or planted in the ground by its butt-spike (26:7) beside the king */
  private spearPlanted(on: boolean, s?: { pos: THREE.Vector3; yaw: number }) {
    const { saul } = this.cast;
    const sp = saul.props.spear;
    if (!sp) return;
    if (on && s) {
      const scene = saul.root.parent;
      if (!scene) return;
      scene.add(sp);
      const right = new THREE.Vector3(-Math.cos(s.yaw), 0, Math.sin(s.yaw));
      const p = s.pos.clone().addScaledVector(right, 0.55).add(new THREE.Vector3(-Math.sin(s.yaw) * 0.25, 0, -Math.cos(s.yaw) * 0.25));
      sp.position.set(p.x, this.ground(p.x, p.z) - 0.08, p.z);
      sp.rotation.set(0.03, 0, -0.04);
      saul.upright.R.weight = 0;
      saul.human.rig.setFingers('R', 'relaxed');
    } else if (!on && sp.parent !== null && sp.parent === saul.root.parent) {
      saul.holdProp('spear', 'R');
      saul.upright.R.weight = 1;
    }
  }

  /** call on each cut (and before the first frame of a shot) */
  enter(shot: GilgalShotName) {
    const { saul, samuel } = this.cast;
    const plant = shot === 'tear' || shot === 'verdict' || shot === 'saulAlone' || shot === 'rise';
    this.spearPlanted(plant, plant ? saulAt(shot === 'tear' ? 'faceOff' : shot, 0) : undefined);
    this.shot = shot;
    saul.headingSnap = true;
    samuel.headingSnap = true;
    if (this.cast.armourBearer) this.cast.armourBearer.headingSnap = true;
    this.grabbed = false;
    this.samTurnStarted = false;
    saul.reach.R.weight = 0;
    saul.reach.R.target = null;
    saul.body.drop = saul.body.lean = saul.body.twist = saul.body.side = 0;
    samuel.body.drop = samuel.body.lean = samuel.body.twist = samuel.body.side = 0;
    saul.mocap.lookWeight = 1;
    samuel.mocap.lookWeight = 1;
    saul.headingRate = 3;
    samuel.cancelHeading = true;
    if (this.lungeLegs) saul.mocap.stopLayer('lunge', 0.001);
    this.lungeLegs = false;
    this.saulFrom.copy(saulAt(shot, 0).pos);
    saul.mocap.timeScale = 1;
    samuel.mocap.timeScale = 1;
    samuel.mocap.rootMotion = 'inplace';
    const walkShots: GilgalShotName[] = ['dustWall', 'king'];
    if (walkShots.includes(shot)) {
      saul.mocap.play('walk_king', { fade: 0, sync: true, time: shot === 'king' ? 0.4 : 0 });
      saul.mocap.matchSpeed('walk_king', saulAt(shot, 0).walk);
    } else if (shot === 'spearRaised') {
      saul.mocap.play('walk_halt', { fade: 0, onEnd: () => saul.mocap.play('idle_king', { fade: 0.5 }) });
    } else if (shot === 'tear') {
      saul.mocap.play('idle_king', { fade: 0 });
    } else {
      saul.mocap.play('idle_king', { fade: 0, time: shot === 'saulAlone' ? 2 : 0 });
    }
    // Samuel
    // upright and still (bible 3.1): the upright idle, not the stooped one
    samuel.mocap.play('idle_king', { fade: 0, time: 1.3 });
    // the tear state is a function of the shot: intact before 'tear', torn after
    const tear = samuel.tear;
    if (tear) {
      if (shot === 'tear') tear.reset();
      else if (shot === 'verdict' || shot === 'saulAlone' || shot === 'rise') {
        // already torn: the piece in Saul's fist
        if (!tear.isTorn) {
          saul.armPose.R.pose = POSES.clothFistR;
          saul.armPose.R.weight = 1;
          saul.update(0);
          tear.progress = 1;
          tear.grab(saul.human.sockets.handGripR);
        }
      } else tear.reset();
    }
    this.saulFace.set({});
    this.samFace.set({});
  }

  /** per frame: shot-local time t (s, real time, like CameraRig) and frame dt */
  update(t: number, dt: number, camera?: THREE.Camera, viewportH?: number) {
    const shot = this.shot;
    if (!shot) return;
    const { saul, samuel, armourBearer } = this.cast;
    const ts = timeScale(shot, t);
    const adt = dt * ts;
    const at = actionTime(shot, t);
    const s = saulAt(shot, t);
    const m = samuelAt(shot, t);
    if (shot !== 'tear') saul.place(s.pos, s.yaw);
    // ---------------------------------------------------------------- SAUL
    saul.mocap.timeScale = ts;
    const torn = shot === 'verdict' || shot === 'saulAlone' || shot === 'rise';
    saul.armPose.L.pose = POSES.helmetL;
    saul.armPose.L.weight = 1;
    let spear = 0; // 0 carry .. 1 raised
    if (shot === 'spearRaised') spear = s.cue;
    if (shot === 'silence') spear = s.cue;
    if (!torn && shot !== 'tear') {
      saul.armPose.R.pose = mixPose(POSES.spearCarryR, POSES.spearRaiseR, ss(0, 1, spear));
      saul.armPose.R.weight = 1;
    }
    samuel.headWorld(this.lookSam);
    saul.headWorld(this.lookSaul);
    switch (shot) {
      case 'dustWall':
      case 'king':
        saul.mocap.lookAt = this.tmp.copy(s.pos).add(new THREE.Vector3(Math.sin(s.yaw) * 30, 2.2, Math.cos(s.yaw) * 30));
        this.saulFace.set({ determined: 0.55 });
        this.saulFace.jawTarget = 0;
        break;
      case 'spearRaised': {
        saul.mocap.lookAt = this.tmp.copy(s.pos).add(new THREE.Vector3(Math.sin(s.yaw) * 6, 2.0 + 6 * s.cue, Math.cos(s.yaw) * 6));
        const roar = ss(1.6, 2.2, t) * (1 - ss(4.3, 5.4, t));
        this.saulFace.set({ anger: 0.55 * roar, effort: 0.35 * roar, determined: 0.4 * (1 - roar) });
        this.saulFace.jawTarget = 0.42 * roar;
        break;
      }
      case 'silence':
        saul.mocap.lookAt = this.lookSam;
        this.saulFace.set({ fear: 0.25 * ss(1.5, 4, t), awe: 0.2 * ss(0.5, 2, t), determined: 0.3 * (1 - ss(1, 3, t)) });
        this.saulFace.jawTarget = 0;
        break;
      case 'faceOff':
        saul.mocap.lookAt = this.eyeOf(samuel);
        this.saulFace.set({ sad: 0.45, fear: 0.3 });
        this.saulFace.jawTarget = speechJaw(t - 0.6, 2.2, 7, [0.45], 3) * 0.8; // "חָטָאתִי ... שׁוּב עִמִּי" (unvoiced here)
        break;
      case 'tear':
        this.tearSaul(at, s.pos, s.yaw);
        break;
      case 'verdict':
        saul.upright.R.weight = 0;
        saul.armPose.R.pose = POSES.clothFistR;
        saul.armPose.R.weight = 1;
        saul.mocap.lookAt = this.eyeOf(samuel);
        this.saulFace.set({ sad: 0.35 + 0.35 * ss(2, 7, t), fear: 0.35 * ss(1, 4, t), awe: 0.25 * ss(4, 6, t) });
        this.saulFace.jawTarget = 0.06 * ss(5, 7, t);
        break;
      case 'saulAlone':
      case 'rise':
        saul.upright.R.weight = 0;
        saul.armPose.R.pose = POSES.clothFistR;
        saul.armPose.R.weight = 1;
        // unfocused: the gaze falls to the ground a few metres ahead, drifting
        saul.mocap.lookAt = this.tmp.copy(s.pos).add(new THREE.Vector3(Math.sin(s.yaw) * 5 + 0.4 * Math.sin(t * 0.3), 0.6 + 0.2 * Math.sin(t * 0.21), Math.cos(s.yaw) * 5));
        saul.mocap.lookWeight = 0.8;
        this.saulFace.set({ sad: 0.7, pain: 0.3, fear: 0.15 });
        this.saulFace.jawTarget = 0.04 + 0.03 * Math.sin(t * 1.7);
        saul.mocap.breathe = 1.8;
        break;
    }
    if (shot !== 'saulAlone' && shot !== 'rise') saul.mocap.breathe = 1;
    saul.faceFill = FACE_FILL[shot][0];
    samuel.faceFill = FACE_FILL[shot][1];
    // ---------------------------------------------------------------- SAMUEL
    samuel.mocap.timeScale = ts;
    if (shot === 'tear') {
      this.tearSamuel(at, m.pos, m.yaw);
    } else if (shot === 'saulAlone' || shot === 'rise') {
      samuel.place(m.pos, m.yaw);
      if (m.walk > 0 && samuel.mocap.current()?.name !== 'walk_old') {
        samuel.mocap.play('walk_old', { fade: 0.6, sync: true });
        samuel.mocap.matchSpeed('walk_old', m.walk);
      }
      samuel.mocap.lookAt = null;
      this.samFace.set({ sad: 0.6 });
    } else {
      samuel.place(m.pos, m.yaw);
      samuel.mocap.lookAt = this.eyeOf(saul);
      if (shot === 'verdict') {
        // 15:28 — quiet and hard: ~24 syllables over ~6 s, pauses after "הַיּוֹם" and before "הַטּוֹב מִמֶּךָּ"
        this.samFace.set({ sad: 0.45, determined: 0.4 });
        this.samFace.jawTarget = speechJaw(t - 1.2, 6.2, 24, [0.52, 0.8], 7);
      } else {
        this.samFace.set({ sad: 0.4, determined: 0.35 });
        this.samFace.jawTarget = 0;
      }
    }
    // ---------------------------------------------------------------- ARMOUR-BEARER one step behind the king
    if (armourBearer) {
      const back = new THREE.Vector3(-Math.sin(s.yaw) * 1.6, 0, -Math.cos(s.yaw) * 1.6).add(new THREE.Vector3(Math.cos(s.yaw) * 0.7, 0, -Math.sin(s.yaw) * 0.7));
      armourBearer.place(s.pos.clone().add(back), s.yaw);
      const a = armyAt(shot, t);
      const want = a.walk > 0 ? 'walk' : 'idle_king';
      if (armourBearer.mocap.current()?.name !== want) {
        armourBearer.mocap.play(want, { fade: 0.4, sync: true });
        if (a.walk > 0) armourBearer.mocap.matchSpeed('walk', a.walk);
      }
      armourBearer.mocap.timeScale = ts;
      armourBearer.update(dt, camera, viewportH, this.wind);
    }
    this.saulFace.update(adt || dt);
    this.samFace.update(adt || dt);
    saul.update(adt, camera, viewportH, this.wind);
    samuel.update(adt, camera, viewportH, this.wind);
    void SAUL_FACE;
    void SHOT_DURATION;
  }

  /**
   * 10b, Saul: "וַיַּחֲזֵק בִּכְנַף־מְעִילוֹ" — he goes after the old man (walk, 2-3 fast steps), lunges low (pelvis
   * drops, torso folds, the right arm reaches down to the lower corner of the me'il), the fist closes on it and he
   * holds on — pulling back and up while Samuel's step carries on — until the wool gives. Desperation, not
   * violence (visual-bible 3.3): face open, brows up, a gasp at the grab, shock as it tears.
   */
  private tearSaul(at: number, _pos: THREE.Vector3, yaw: number) {
    const { saul, samuel } = this.cast;
    const B = TEAR_BEATS;
    const tear = samuel.tear;
    const fwd = this._f.set(Math.sin(yaw), 0, Math.cos(yaw));
    const right = this._p.set(-Math.cos(yaw), 0, Math.sin(yaw));
    if (tear) tear.cornerWorld(this.corner);
    else samuel.root.getWorldPosition(this.corner).setY(this.corner.y + 0.5);
    // ---- placement: from his mark to a lunge distance behind the corner (tracks the corner as Samuel walks)
    const lungeReach = 0.62; // root -> grip, horizontally, at full lunge (2.02 m man, arm down-forward; measured)
    const tx = this.corner.x - fwd.x * lungeReach - right.x * 0.24;
    const tz = this.corner.z - fwd.z * lungeReach - right.z * 0.24;
    const u = ss(B.go, B.grab, at) * 0.35 + 0.65 * THREE.MathUtils.clamp((at - B.go) / (B.grab - B.go), 0, 1) ** 1.15;
    const k = this.grabbed ? 1 : Math.min(1, u);
    let x = this.saulFrom.x + (tx - this.saulFrom.x) * k;
    let z = this.saulFrom.z + (tz - this.saulFrom.z) * k;
    if (this.grabbed) {
      // after the grab he plants and pulls back a little (his weight against the old man's step)
      const pull = 0.14 * ss(B.grab + 0.1, B.tearTo, at);
      x = this.grabAt.x - fwd.x * (lungeReach + pull) - right.x * 0.24;
      z = this.grabAt.z - fwd.z * (lungeReach + pull) - right.z * 0.24;
    }
    saul.place(this.tmp.set(x, 0, z), yaw);
    // ---- clips: pleading stand -> fast walk after him -> the lunge (stand) -> hold
    const cur = saul.mocap.current()?.name;
    if (at >= B.go && at < B.lunge + 0.15 && cur !== 'walk') {
      saul.mocap.play('walk', { fade: 0.25, sync: true });
    }
    if (cur === 'walk') saul.mocap.matchSpeed('walk', THREE.MathUtils.clamp(Math.hypot(saul.velocity.x, saul.velocity.z), 0.8, 1.9));
    if (at >= B.lunge + 0.15 && cur !== 'idle_king') saul.mocap.play('idle_king', { fade: 0.35, time: 0.5 });
    // the legs: the walk frozen in a long stride, RIGHT foot forward (walk t = 0.74 s: R +0.28 m, L -0.33 m) —
    // with the pelvis drop below, a fencer's lunge onto the reaching side
    if (at >= B.lunge - 0.1 && !this.lungeLegs) {
      saul.mocap.playLayer('lunge', 'walk', { mask: 'legs', time: 0.74, speed: 0, fade: 0.3 });
      this.lungeLegs = true;
    }
    // ---- body: the lunge low, then partly up again as he pulls
    const lunge = ss(B.lunge, B.grab + 0.02, at) * (1 - 0.4 * ss(B.grab + 0.3, B.tearTo + 0.2, at));
    // a deep lunge in the legs, the torso less folded, the arm long: his head stays off Samuel's back
    saul.body.drop = 0.4 * lunge;
    saul.body.lean = 0.6 * lunge - 0.1 * ss(B.grab + 0.2, B.tearTo, at);
    saul.body.twist = 0.16 * lunge;
    saul.headingRate = 12;
    // ---- arms: the right hand to the corner (IK), the helmet stays under the left arm
    saul.armPose.R.pose = null;
    saul.armPose.R.weight = 0;
    saul.upright.R.weight = 0;
    if (!this.grabbed) {
      saul.reach.R.target = this.tearTarget.copy(this.corner);
      saul.reach.R.weight = ss(B.lunge - 0.05, B.grab - 0.02, at);
      if (at >= B.lunge) saul.human.rig.setFingers('R', 'relaxed');
      if (at >= B.grab && tear) {
        this.grabbed = true;
        saul.human.rig.setFingers('R', 'fist');
        saul.update(0); // the hand exactly at the corner this frame
        tear.grab(saul.human.sockets.handGripR);
        this.grabAt.copy(this.corner);
      }
    } else {
      // the fist pulls back toward him and up (the wool stretches, then gives)
      const p = ss(B.grab + 0.05, B.tearTo, at);
      this.tearTarget.copy(this.grabAt).addScaledVector(fwd, -0.12 * p).add(this.tmp.set(0, 0.1 * p + 0.12 * ss(B.tearTo - 0.2, B.tearTo + 0.3, at), 0));
      saul.reach.R.target = this.tearTarget;
      saul.reach.R.weight = 1;
    }
    if (tear) tear.progress = ss(B.tearFrom, B.tearTo, at);
    // ---- eyes and face
    // eyes: on Samuel; down to the corner as he lunges and seizes it; then UP to Samuel's face as he holds on —
    // their eyes meet while the wool gives
    if (at < B.go + 0.2) saul.mocap.lookAt = this.eyeOf(samuel);
    else if (at < B.grab + 0.18) saul.mocap.lookAt = this.corner;
    else saul.mocap.lookAt = this.eyeOf(samuel);
    const reach = ss(B.lunge - 0.2, B.grab, at);
    const torn = ss(B.tearTo - 0.4, B.tearTo + 0.1, at);
    this.saulFace.set({
      sad: 0.45 * (1 - reach) + 0.3 * torn, fear: 0.35 + 0.2 * reach - 0.1 * torn, effort: 0.55 * reach * (1 - torn),
      awe: 0.35 * torn, pain: 0.15 * torn,
    });
    // a gasp as he lunges; the mouth hangs open when it tears
    this.saulFace.jawTarget = 0.16 * ss(B.lunge, B.grab, at) * (1 - ss(B.grab + 0.2, B.grab + 0.6, at)) + 0.12 * torn;
  }

  /**
   * 10b, Samuel: "וַיִּסֹּב שְׁמוּאֵל לָלֶכֶת" — he turns away (yaw from samuelAt; the head leads the turn) and walks
   * off slowly; the seized corner jerks him (a small recoil in the chest), he keeps his step — the wool tears —
   * and he stops and turns his head back over his shoulder toward the king.
   */
  private tearSamuel(at: number, pos: THREE.Vector3, yaw: number) {
    const { saul, samuel } = this.cast;
    const B = TEAR_BEATS;
    samuel.place(pos, yaw);
    samuel.mocap.rootMotion = 'inplace';
    samuel.cancelHeading = true;
    const cur = samuel.mocap.current()?.name;
    // (walk_old is stooped — bible 3.1 wants him upright: the natural walk, slowed to his pace)
    if (at >= B.turn + 0.3 && at < B.grab + 0.25 && cur !== 'walk') samuel.mocap.play('walk', { fade: 0.45, sync: true });
    if (cur === 'walk') samuel.mocap.matchSpeed('walk', 0.5);
    if (at >= B.grab + 0.25 && cur !== 'idle_king') samuel.mocap.play('idle_king', { fade: 0.6, time: 0.3 });
    // eyes: on Saul, then ahead (east, his way), then back over the shoulder once held
    if (at < B.turn + 0.15) samuel.mocap.lookAt = this.eyeOf(saul);
    else if (at < B.grab + 0.35) samuel.mocap.lookAt = this.tmp.set(pos.x + Math.sin(yaw) * 20, samuel.root.position.y + 1.5, pos.z + Math.cos(yaw) * 20);
    else samuel.mocap.lookAt = this.eyeOf(saul);
    samuel.mocap.lookLimits.yaw = 1.35;
    // the jerk of the held robe, then the chest turns back toward the king
    const jerk = ss(B.grab, B.grab + 0.18, at) * (1 - ss(B.grab + 0.25, B.tearTo, at));
    samuel.body.lean = -0.09 * jerk;
    samuel.body.twist = -0.42 * ss(B.grab + 0.4, B.tearTo + 0.2, at);
    this.samFace.set({ sad: 0.5 + 0.15 * ss(B.grab, B.tearTo, at), determined: 0.35, pain: 0.12 * jerk });
    this.samFace.jawTarget = 0;
  }

  /** world position of the tear (the corner of the me'il / Saul's fist) — for the 10b camera and FX */
  tearFocus(out = new THREE.Vector3()) {
    const t = this.cast.samuel.tear;
    return t ? t.cornerWorld(out) : this.cast.samuel.root.getWorldPosition(out).setY(out.y + 0.5);
  }

  private eyeOf(a: FilmActor) {
    return a.eyesWorld(new THREE.Vector3());
  }

  private tear(samuel: FilmActor, out: THREE.Vector3) {
    if (samuel.tear) return samuel.tear.cornerWorld(out);
    return samuel.root.getWorldPosition(out).setY(out.y + 0.5);
  }
}

// ================================================================================================ RAMAH (shot 5)
export interface RamahMark {
  pos: THREE.Vector3;
  yaw: number;
  seated?: boolean;
}

export class RamahPerformance {
  private faces: FaceDriver[] = [];
  private samFace: FaceDriver;
  /** Samuel's eyes (world), refreshed every frame: the elders' eye-line */
  private readonly samEyes = new THREE.Vector3();
  private readonly leadEyes = new THREE.Vector3();
  readonly wind = new THREE.Vector3(0.8, 0, -0.2);
  constructor(readonly samuel: FilmActor, readonly elders: FilmActor[], samuelMark: RamahMark, elderMarks: RamahMark[], ground: (x: number, z: number) => number = () => 0) {
    samuel.ground = ground;
    samuel.enableFaceLight(0xffe2c4);
    samuel.faceLightRig.side = 0.85; // more of a 3/4 key: the old face needs modelling (the lines vanish in a flat fill)
    samuel.faceLightRig.up = 0.35;
    samuel.faceFill = 1.0;
    samuel.place(samuelMark.pos, samuelMark.yaw);
    samuel.root.updateMatrixWorld(true);
    samuel.eyesWorld(this.samEyes);
    samuel.mocap.play('idle_king', { fade: 0 });
    samuel.human.rig.faceBias.LeftUpperLidClosed = 0.1;
    samuel.human.rig.faceBias.RightUpperLidClosed = 0.1;
    // heads of families, dignified (bible 3.7): no stooped idle_old (it folds them in two)
    const clips = ['talk_gesture', 'idle_king', 'argue', 'idle_bus', 'point_directions', 'idle_shift'];
    elders.forEach((e, i) => {
      e.ground = ground;
      const mk = elderMarks[i % elderMarks.length];
      e.place(mk.pos, mk.yaw);
      // seated marks carry the seat top as pos.y: sit on it (the pelvis drops, the feet go forward)
      if (mk.seated) e.sit(mk.pos.y - ground(mk.pos.x, mk.pos.z));
      // seated: upright clips (the stooped idle_old folds a seated man in two)
      const clip = mk.seated ? (i % 3 === 0 ? 'talk_gesture' : i % 3 === 1 ? 'idle_king' : 'idle_bus') : clips[i % clips.length];
      e.mocap.play(clip, { fade: 0, time: (i * 0.73) % 2, mirror: i % 2 === 1 });
      if (e.props.staff) {
        e.holdProp('staff', i % 2 ? 'R' : 'L');
      }
      e.mocap.lookAt = this.samEyes;
      e.headingSnap = true;
      const f = new FaceDriver(e, 2);
      f.set(i % 3 === 0 ? { determined: 0.4 } : i % 3 === 1 ? { sad: 0.25, fear: 0.1 } : { anger: 0.2, determined: 0.2 });
      this.faces.push(f);
    });
    this.samFace = new FaceDriver(samuel, 2);
    // 8:6 "וַיֵּרַע הַדָּבָר בְּעֵינֵי שְׁמוּאֵל" — displeased, grave; lids heavy
    this.samFace.set({ sad: 0.35, determined: 0.3 });
  }

  update(t: number, dt: number, camera?: THREE.Camera, viewportH?: number) {
    this.samuel.eyesWorld(this.samEyes);
    // 8:5 is spoken by the elders: the first two speakers' jaws move
    this.elders.forEach((e, i) => {
      const f = this.faces[i];
      f.jawTarget = i < 2 ? speechJaw(t - 0.8 - i * 0.3, 3.5, 12, [0.5], 11 + i) : 0;
      f.update(dt);
      e.update(dt, camera, viewportH, this.wind);
    });
    this.samFace.update(dt);
    const lead = this.elders[0];
    if (lead) this.samuel.mocap.lookAt = lead.eyesWorld(this.leadEyes);
    this.samuel.update(dt, camera, viewportH, this.wind);
  }
}
