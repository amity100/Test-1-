import * as THREE from 'three';
import { INTRO_SHOTS } from '../../content/introScript';
import { ARMY, roadZ, SAMUEL, SAMUEL_EXIT, SAUL_FACE, SAUL_HALT } from './gilgalLayout';

/**
 * Blocking of ACT I (who stands where, when), per shot, in shot-local seconds (the same `time` that
 * CameraRig passes to Shot.at). The camera shots (gilgalShots.ts, src/film/FilmCams.ts) are built on it, the
 * placeholder figures follow it, and the cast / crowd modules (src/film/cast/performances.ts, src/film/crowd/GilgalArmy)
 * drive their characters from it so camera and actors stay in register.
 *
 * CUT v2 (docs/intro-script-v2.md): every duration, slow-motion factor and BEAT is read from the shared timing contract
 * in src/content/introScript.ts (INTRO_SHOTS: the Gilgal takes 'dustWall' 'king' 'spearRaised' 'silence' 'tear'
 * 'tear:insert' 'verdict' 'saulAlone'); the numbers below are only the fallbacks of that contract.
 *   G1 dustWall    3.0  shofar 0 · horns 0.4 · card 0.6       the army marches out of the dust behind the king
 *   G2 king        4.5  slow motion 0.5 · card 0.8             Saul's stride, continuous
 *   G3 spearRaised 3.0  halt 0.3 · spearUp 0.8 · roar 1.1 (+0-0.4 stagger) · verse 1.3
 *   G4 silence     3.0  roarCut 0 · headsTurn 0.3 · part 0.8 · card 1.4 · step 2.2 (Samuel's step)
 *   G5 tear        2.0 + 2.5  ONE continuous action filmed in two takes: 'tear' (G5a, real time: turn 0.2 · lunge
 *                  0.9 · grip 1.6) and 'tear:insert' (G5b, slow motion 0.35: pull 0.2 · rip 0.6 · free 1.8, shot time
 *                  of the insert = blocking time - 2.0)
 *   G6 verdict     4.5  turnBack 0.4 · speech 0.9 .. speechEnd
 *   G7 saulAlone   2.0  lookDown 0.3 · tighten 1.2
 *
 * `timeScale` is the slow-motion factor of the action within a shot (1 = real time): animation clocks of the actors
 * advance by dt * timeScale (the camera moves in real time). `actionTime` is its integral.
 */
export type GilgalShotName = 'dustWall' | 'king' | 'spearRaised' | 'silence' | 'faceOff' | 'tear' | 'verdict' | 'saulAlone' | 'rise';

export const SHOT_ORDER: GilgalShotName[] = ['dustWall', 'king', 'spearRaised', 'silence', 'faceOff', 'tear', 'verdict', 'saulAlone', 'rise'];

const spec = (take: string) => INTRO_SHOTS.find((s) => s.set === 'gilgal' && s.take === take);
const dur = (take: string, fb: number) => spec(take)?.dur ?? fb;
/** the contract's beats of a take, over the fallbacks */
function beats<T extends Record<string, number>>(take: string, fb: T): T {
  const b = spec(take)?.beats ?? {};
  const out = { ...fb } as Record<string, number>;
  for (const k in fb) if (typeof b[k] === 'number') out[k] = b[k];
  return out as T;
}

/** G5: blocking time at which the insert (G5b, slow motion) takes over from the wide (G5a) */
export const TEAR_INSERT_AT = dur('tear', 2.0);

/** durations (s) of the blocking of each Gilgal shot ('tear' spans both takes G5a + G5b; faceOff / rise: unused) */
export const SHOT_DURATION: Record<GilgalShotName, number> = {
  dustWall: dur('dustWall', 3), king: dur('king', 4.5), spearRaised: dur('spearRaised', 3), silence: dur('silence', 3),
  faceOff: 5, tear: TEAR_INSERT_AT + dur('tear:insert', 2.5), verdict: dur('verdict', 4.5), saulAlone: dur('saulAlone', 2), rise: 15,
};

/** script shot number of each camera shot */
export const SCRIPT_SHOT: Record<GilgalShotName, string> = {
  dustWall: 'G1', king: 'G2', spearRaised: 'G3', silence: 'G4', faceOff: '10a', tear: 'G5', verdict: 'G6', saulAlone: 'G7', rise: '13',
};

/** the timing contract's beats (shot seconds; 'tear': blocking time of the base shot, the insert's beats shifted) */
export const BEATS = {
  dustWall: beats('dustWall', { shofar: 0, horns: 0.4, card: 0.6 }),
  king: beats('king', { card: 0.8 }),
  spearRaised: beats('spearRaised', { halt: 0.3, spearUp: 0.8, roar: 1.1, roarSpread: 0.4, verse: 1.3 }),
  silence: beats('silence', { roarCut: 0, headsTurn: 0.3, part: 0.8, card: 1.4, step: 2.2 }),
  tear: (() => {
    const a = beats('tear', { turn: 0.2, lunge: 0.9, grip: 1.6 });
    const b = beats('tear:insert', { pull: 0.2, rip: 0.6, free: 1.8 });
    return { ...a, pull: TEAR_INSERT_AT + b.pull, rip: TEAR_INSERT_AT + b.rip, free: TEAR_INSERT_AT + b.free };
  })(),
  verdict: beats('verdict', { turnBack: 0.4, speech: 0.9, speechEnd: 4.04 }),
  saulAlone: beats('saulAlone', { lookDown: 0.3, tighten: 1.2, flash: 1.75 }),
};

export interface ActorState {
  /** feet position (y = 0: snap to ground with GilgalSet.height) */
  pos: THREE.Vector3;
  /** facing, game convention: forward = (sin yaw, 0, cos yaw) */
  yaw: number;
  /** walking speed in m/s of real (unscaled) action time; 0 = standing */
  walk: number;
  /** action cue 0..1 (Saul: spear raised; Samuel: turned away; Saul in 'tear': reach/grab/tear progress) */
  cue: number;
  /** a short label of what the actor does now (for the cast teammate) */
  action: string;
}

export interface ArmyState {
  /** x of the king's feet at the head of the column (the formation hangs behind it, see armySlot) */
  frontX: number;
  /** marching speed (m/s of action time), 0 = halted */
  walk: number;
  /** spears raised 0..1 (each rank delays by `raiseDelayPerRank` s) */
  raise: number;
  /** the front ranks step aside 0..1 (shot 9: opening a corridor on the road) */
  part: number;
  /** heads turned toward Samuel 0..1 (the silence) */
  turn: number;
}

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const onRoad = (x: number) => new THREE.Vector3(x, 0, roadZ(x));

/** marching pace of the column (m/s) */
export const MARCH_SPEED = 1.35;
/** slow-motion factors (the action's fraction of real time): G2 the king's stride, G5b the tear insert */
export const SLOWMO = { king: spec('king')?.slowmo ?? 0.5, tear: spec('tear:insert')?.slowmo ?? 0.35 };
export const RAISE_DELAY_PER_RANK = 0.03;

export function timeScale(shot: GilgalShotName, t: number) {
  if (shot === 'king') return SLOWMO.king;
  if (shot === 'tear') return t < TEAR_INSERT_AT ? 1 : SLOWMO.tear;
  return 1;
}

/** action time elapsed at shot time t (the integral of timeScale) */
export function actionTime(shot: GilgalShotName, t: number) {
  if (shot === 'king') return t * SLOWMO.king;
  if (shot === 'tear') return t < TEAR_INSERT_AT ? t : TEAR_INSERT_AT + (t - TEAR_INSERT_AT) * SLOWMO.tear;
  return t;
}

/** the tear in ACTION time (G5a real time, G5b slowed): Samuel's turn, the lunge, the grip, the pull, the rip */
export const TEAR_ACTION = (() => {
  const B = BEATS.tear;
  const at = (t: number) => actionTime('tear', t);
  return { turn: at(B.turn), lunge: at(B.lunge), grip: at(B.grip), pull: at(B.pull), rip: at(B.rip), free: at(B.free), end: at(SHOT_DURATION.tear) };
})();

/** Samuel's mark after his step toward the army in G4 (the tear starts here), facing west */
export const SAMUEL_STEP = SAMUEL.pos.clone().add(new THREE.Vector3(-0.55, 0, 0));
/** Saul's mark at the start of the tear: 1.7 m west of Samuel, facing him */
export const SAUL_TEAR = new THREE.Vector3(SAMUEL_STEP.x - 1.7, 0, SAUL_FACE.pos.z);
/**
 * Samuel's way in the tear: the turn-step to his left (Rocketbox m_turn_left_180_to_walk, root motion) carries him
 * east and a little south before the corner holds him (m from SAMUEL_STEP; measured on the performance)
 */
const SAM_AWAY = 0.7;
const SAM_AWAY_Z = 0.26;
/** Saul's travel from his mark to the grip (m, east / south: he dives at the corner on the old man's south side) and
 * his pull back after it (measured on the performance) */
const SAUL_LUNGE = 1.5;
const SAUL_LUNGE_Z = 0.3;
const SAUL_PULL = 0.18;
/** where the fist closes on the corner, relative to samuelAt('tear').pos (the lower corner of the me'il, knee-low) */
export const TEAR_GRIP = { x: -0.1, y: 0.47, z: 0.25, pullY: 0.25 };

function alongExit(d: number) {
  const pts = SAMUEL_EXIT;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = pts[i].distanceTo(pts[i + 1]);
    if (d <= l || i === pts.length - 2) return { pos: pts[i].clone().lerp(pts[i + 1], Math.min(1, d / l)), yaw: Math.atan2(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z) };
    d -= l;
  }
  return { pos: pts[pts.length - 1].clone(), yaw: Math.PI / 2 };
}

/** Saul's feet after the tear (verdict, alone): a step back from where he knelt, facing the old man */
const saulAfter = () => SAUL_TEAR.clone().add(new THREE.Vector3(SAUL_LUNGE - SAUL_PULL - 0.25, 0, SAUL_LUNGE_Z * 0.5));
/** Samuel's feet after the tear (verdict) */
const samuelAfter = () => SAMUEL_STEP.clone().add(new THREE.Vector3(SAM_AWAY + 0.08, 0, SAM_AWAY_Z * 0.5));

export function saulAt(shot: GilgalShotName, t: number): ActorState {
  const at = actionTime(shot, t);
  switch (shot) {
    case 'dustWall': return { pos: onRoad(-172 + MARCH_SPEED * at), yaw: Math.PI / 2, walk: MARCH_SPEED, cue: 0, action: 'marching at the head of the army out of the dust' };
    case 'king': return { pos: onRoad(-96 + MARCH_SPEED * at), yaw: Math.PI / 2, walk: MARCH_SPEED, cue: 0, action: 'striding, slow motion (helmet under the left arm, spear in the right hand)' };
    case 'spearRaised': {
      // the last step of the halt: decelerating from the march onto his mark by `halt`
      const B = BEATS.spearRaised;
      const u = Math.min(1, at / Math.max(0.05, B.halt + 0.25));
      const d = MARCH_SPEED * (B.halt + 0.25) * 0.5;
      return { pos: onRoad(SAUL_HALT.x - d * (1 - u) * (1 - u)), yaw: Math.PI / 2, walk: MARCH_SPEED * (1 - u), cue: ss(B.spearUp - 0.12, B.spearUp + 0.38, at), action: 'halts; thrusts the spear to the sky with his whole body; roars' };
    }
    case 'silence': return { pos: onRoad(SAUL_HALT.x), yaw: Math.PI / 2, walk: 0, cue: 1 - ss(0.35, 1.7, at), action: 'the roar dies; the spear comes down; he sees the old man in the road' };
    case 'faceOff': return { pos: SAUL_FACE.pos.clone(), yaw: SAUL_FACE.yaw, walk: 0, cue: 0, action: 'face to face with Samuel' };
    case 'tear': {
      const A = TEAR_ACTION;
      // a reaction step as the old man turns, the lunge onto the corner, then the pull back against his step
      const go = 0.25 * ss(A.turn + 0.15, A.lunge, at) + 0.75 * ss(A.lunge - 0.05, A.grip, at);
      const pull = ss(A.pull - 0.05, A.free, at);
      const x = SAUL_TEAR.x + SAUL_LUNGE * go - SAUL_PULL * pull;
      return { pos: new THREE.Vector3(x, 0, SAUL_TEAR.z + SAUL_LUNGE_Z * go), yaw: Math.PI / 2, walk: at > A.turn && at < A.grip ? 1.6 : 0, cue: ss(A.lunge, A.free, at), action: 'lunges after him, seizes the corner of the me\'il, pulls — it tears' };
    }
    case 'verdict': return { pos: saulAfter(), yaw: Math.PI / 2, walk: 0, cue: 1, action: 'holds the torn piece; listens' };
    case 'saulAlone':
    case 'rise': return { pos: saulAfter(), yaw: Math.PI / 2, walk: 0, cue: 1, action: 'stands alone, the torn cloth in his fist' };
  }
}

export function samuelAt(shot: GilgalShotName, t: number): ActorState {
  const at = actionTime(shot, t);
  switch (shot) {
    case 'dustWall':
    case 'king':
    case 'spearRaised':
    case 'faceOff': return { pos: SAMUEL.pos.clone(), yaw: SAMUEL.yaw, walk: 0, cue: 0, action: 'stands in the road, wrapped in his robe' };
    case 'silence': {
      const s = BEATS.silence.step;
      return { pos: SAMUEL.pos.clone().lerp(SAMUEL_STEP, ss(s, s + 0.75, at)), yaw: SAMUEL.yaw, walk: at > s && at < s + 0.75 ? 0.75 : 0, cue: 0, action: 'stands in the road; one step toward the king' };
    }
    case 'tear': {
      const A = TEAR_ACTION;
      // the turn to go (to his LEFT: toward the south / the camera side), stepping away east until the corner holds
      const turn = ss(A.turn, A.turn + 1.2, at);
      const away = ss(A.turn + 0.25, A.grip + 0.15, at);
      const on = ss(A.grip, A.free + 0.3, at);
      const p = SAMUEL_STEP.clone().add(new THREE.Vector3((SAM_AWAY - 0.08) * away + 0.08 * on, 0, (SAM_AWAY_Z - 0.05) * away + 0.05 * on));
      return { pos: p, yaw: SAMUEL.yaw + (156 * Math.PI / 180) * turn, walk: away > 0 && away < 1 ? 0.7 : 0, cue: turn, action: 'turns to go (15:27); the corner of his robe is seized and tears' };
    }
    case 'verdict': {
      // held back half-turned, he turns back to the king at `turnBack`
      const b = BEATS.verdict.turnBack;
      return { pos: samuelAfter(), yaw: SAMUEL.yaw + Math.PI * 0.5 * (1 - ss(b, b + 0.7, at)), walk: 0, cue: 1 - ss(b, b + 0.7, at), action: 'turned back to the king: the verdict (15:28)' };
    }
    case 'saulAlone': {
      const d = Math.max(0, at - 1.1) * 0.9;
      const e = alongExit(Math.max(0, samuelAfter().x - SAMUEL_EXIT[0].x) + d);
      return { pos: d > 0 ? e.pos : samuelAfter(), yaw: d > 0 ? e.yaw : SAMUEL.yaw + Math.PI * ss(0.2, 1.1, at), walk: d > 0 ? 0.9 : 0, cue: 1, action: 'turns and walks away east' };
    }
    case 'rise': {
      const e = alongExit(0.55 + 9.5 + at * 1.1);
      return { pos: e.pos, yaw: e.yaw, walk: 1.1, cue: 1, action: 'walks away east along the road' };
    }
  }
}

export function armyAt(shot: GilgalShotName, t: number): ArmyState {
  const at = actionTime(shot, t);
  const s = saulAt(shot, t);
  switch (shot) {
    case 'dustWall':
    case 'king': return { frontX: s.pos.x, walk: MARCH_SPEED, raise: 0, part: 0, turn: 0 };
    case 'spearRaised': {
      const B = BEATS.spearRaised;
      // the column halts a beat after the king (the halt ripples back: GilgalArmy staggers it per rank), then roars
      return { frontX: SAUL_HALT.x, walk: MARCH_SPEED * (1 - ss(0, B.halt + 0.35, at)), raise: ss(B.roar, B.roar + B.roarSpread + 0.5, at), part: 0, turn: 0 };
    }
    case 'silence': {
      const B = BEATS.silence;
      return { frontX: SAUL_HALT.x, walk: 0, raise: 1 - ss(B.headsTurn + 0.1, B.part + 0.9, at), part: ss(B.part, B.part + 1.9, at), turn: ss(B.headsTurn, B.headsTurn + 0.6, at) };
    }
    default: return { frontX: SAUL_HALT.x, walk: 0, raise: 0, part: 1, turn: 1 };
  }
}

/**
 * Formation slot of soldier (file, rank) relative to the king's feet at x = frontX: returns the world position of the
 * feet (y = 0, snap to ground) for the column marching along the road. `part` opens a corridor in the front ranks.
 * Files: 0..ARMY.files-1 across the road; ranks: 0 = first rank behind the king.
 */
export function armySlot(file: number, rank: number, frontX: number, part = 0, jitter = 0.18, out = new THREE.Vector3()) {
  const h = Math.sin(file * 12.9898 + rank * 78.233) * 43758.5453;
  const j1 = (h - Math.floor(h)) - 0.5;
  const h2 = Math.sin(file * 39.3468 + rank * 11.135) * 24634.6345;
  const j2 = (h2 - Math.floor(h2)) - 0.5;
  // the column widens a little toward the back (stragglers)
  const width = 1 + Math.min(0.6, rank / 120);
  const x = frontX - ARMY.leadGap - rank * ARMY.rankSpacing + j1 * jitter * 2.5;
  let lat = (file - (ARMY.files - 1) / 2) * ARMY.fileSpacing * width + j2 * jitter * 2;
  if (part > 0 && rank < 12) {
    const side = lat >= 0 ? 1 : -1;
    const k = part * (1 - rank / 12) * (2.5 - Math.min(2.1, Math.abs(lat) * 0.3));
    lat += side * Math.max(0, k);
  }
  return out.set(x, 0, roadZ(x) + lat);
}
