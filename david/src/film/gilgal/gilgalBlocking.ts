import * as THREE from 'three';
import { INTRO_SHOTS } from '../../content/introScript';
import { ARMY, roadZ, SAMUEL, SAMUEL_EXIT, SAUL_FACE, SAUL_HALT } from './gilgalLayout';

/**
 * Blocking of ACT I (who stands where, when), per shot, in shot-local seconds (the same `time` that
 * CameraRig passes to Shot.at). The camera shots (gilgalShots.ts, src/film/FilmCams.ts) are built on it, the
 * placeholder figures follow it, and the cast / crowd modules (src/film/cast/performances.ts, src/film/crowd/GilgalArmy)
 * drive their characters from it so camera and actors stay in register.
 *
 * CUT v3 (docs/intro-script-v3.md): every duration, slow-motion factor and BEAT is read from the shared timing contract
 * in src/content/introScript.ts (INTRO_SHOTS: the Gilgal takes 'dustWall' 'king' 'spearRaised' 'silence' 'tear'
 * 'tear:insert' 'verdict' 'saulAlone'); the numbers below are only the fallbacks of that contract (= CUT v3).
 *   G1 dustWall    5.5  timeCard 0.2 · shofar 1.5 (the picture) · horns 2.1 · card 2.8   the front rank out of the dust
 *   G2 king        6.5  slow motion 0.5 (3.25 s of action) · card 1.0 · headTurn 3.6      Saul's stride, continuous
 *   G3 spearRaised 5.0  halt 0.6 · spearUp 1.3 · roar 1.7 (+0-0.5 stagger) · verse 2.0     the roar held to the cut
 *   G4 silence     6.5  roarCut 0 · headsTurn 0.4 · part 1.0 · card 1.6 · step 2.8 · verse 3.0 (CUT v5.2, cut7: the roar
 *                  ebbs; Samuel walks up the road to the king — `step` his last step — and stands before him, 1.85 m
 *                  away as in the tear; his answer, 15:26, at `verse`)
 *   G5 tear        4.0 + 5.0  ONE continuous action filmed in two takes: 'tear' (G5a, real time: turn 0.5 · lunge
 *                  2.2 · grip 3.3) and 'tear:insert' (G5b, slow motion 0.35: pull 0.4 · rip 1.4 · free 3.6; blocking
 *                  time of the insert = shot time + 4.0)
 *   G6 verdict     6.0  turnBack 0.5 · speech 1.2 .. speechEnd 4.9, then the held silence
 *   G7 saulAlone   3.0  lookDown 0.4 · tighten 1.8 · flash 2.75
 * CUT v6 (cut7, Gilgal tightened — read from the contract, nothing hard-coded): G2 6.0 · G4 5.0 (headsTurn 0.3, part
 * 0.8, card 0.8, step 2.0, verse 1.8; Samuel walks up from 4 m) · G5a 3.5 (turn 0.3, lunge 1.7, grip 2.8) · G5b 4.0
 * (pull 0.3, rip 1.1, free 3.0; blocking time = shot time + 3.5) · G6 5.5.
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
export const TEAR_INSERT_AT = dur('tear', 4.0);

/** durations (s) of the blocking of each Gilgal shot ('tear' spans both takes G5a + G5b; faceOff / rise: unused) */
export const SHOT_DURATION: Record<GilgalShotName, number> = {
  dustWall: dur('dustWall', 5.5), king: dur('king', 6.5), spearRaised: dur('spearRaised', 5), silence: dur('silence', 4),
  faceOff: 5, tear: TEAR_INSERT_AT + dur('tear:insert', 5), verdict: dur('verdict', 6), saulAlone: dur('saulAlone', 3), rise: 15,
};

/** script shot number of each camera shot */
export const SCRIPT_SHOT: Record<GilgalShotName, string> = {
  dustWall: 'G1', king: 'G2', spearRaised: 'G3', silence: 'G4', faceOff: '10a', tear: 'G5', verdict: 'G6', saulAlone: 'G7', rise: '13',
};

/** the timing contract's beats (shot seconds; 'tear': blocking time of the base shot, the insert's beats shifted) */
export const BEATS = {
  dustWall: beats('dustWall', { timeCard: 0.2, shofar: 1.5, horns: 2.1, card: 2.8 }),
  king: beats('king', { card: 1.0, headTurn: 3.6 }),
  spearRaised: beats('spearRaised', { halt: 0.6, spearUp: 1.3, roar: 1.7, roarSpread: 0.5, verse: 2.0, notice: 4.5 }),
  silence: beats('silence', { roarCut: 0, headsTurn: 0.4, part: 1.0, card: 1.6, step: 2.8, verse: 3.0, turnGo: 5.6 }),
  tear: (() => {
    // (CUT v6.1, cut7) turn 0: Samuel's turn (begun in G4 at `turnGo`) continues · drop: Saul's hand opens, the spear
    // falls · spearHits: it strikes the dust (the fall's own physics: SPEAR_FALL) · lunge: two quick steps after him ·
    // kneel: the knee strikes the ground · grip: the fist closes on the corner (the cut to G5b ~0.4 s later)
    const a = beats('tear', { turn: 0.0, drop: 0.5, spearHits: 1.55, lunge: 0.8, kneel: 1.9, grip: 2.6 });
    const b = beats('tear:insert', { pull: 0.4, rip: 1.4, free: 3.6, stop: 3.5 });
    return { ...a, pull: TEAR_INSERT_AT + b.pull, rip: TEAR_INSERT_AT + b.rip, free: TEAR_INSERT_AT + b.free, stop: TEAR_INSERT_AT + b.stop };
  })(),
  verdict: beats('verdict', { turnBack: 0.5, speech: 1.2, speechEnd: 4.9, lookDown: 5.0 }),
  saulAlone: beats('saulAlone', { lookDown: 0.4, tighten: 1.8, flash: 2.75 }),
};
/** shot lengths of the Gilgal takes (s) — the performances keep every action alive to these cuts */
export const SHOT_LEN = {
  dustWall: dur('dustWall', 5.5), king: dur('king', 6.5), spearRaised: dur('spearRaised', 5), silence: dur('silence', 4),
  tear: TEAR_INSERT_AT, insert: dur('tear:insert', 5), verdict: dur('verdict', 6), saulAlone: dur('saulAlone', 3),
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
/**
 * G4: the lateral offset (m, + = south of the road's centre line) of the lane the camera looks down between the files
 * (src/film/FilmCams.ts FILM_CAM.silence z0/z1 = 1.575, between files 8 and 9): the ranks part to either side of it
 */
export const PART_LANE = 1.575;
/** G4: how many ranks (from the front) step aside */
export const PART_RANKS = 16;

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

/**
 * (CUT v6.1, cut7) G4 -> G5a is a CUT ON ACTION: Samuel begins his turn in G4 at `turnGo` and G5a picks the same turn
 * up — its clock in G5a runs TURN_LEAD s ahead of the shot (the turn's own time = G5a action time + TURN_LEAD)
 */
export const TURN_LEAD = Math.max(0, SHOT_LEN.silence - BEATS.silence.turnGo);

/** the tear in ACTION time (G5a real time, G5b slowed): Samuel's turn, the spear, the lunge, the knee, the grip, the
 *  pull, the rip — `turn` is when his turn began (negative: in G4, TURN_LEAD before G5a's first frame) */
export const TEAR_ACTION = (() => {
  const B = BEATS.tear;
  const at = (t: number) => actionTime('tear', t);
  return {
    turn: at(B.turn) - TURN_LEAD, drop: at(B.drop), spearHits: at(B.spearHits), lunge: at(B.lunge), kneel: at(B.kneel), grip: at(B.grip),
    pull: at(B.pull), rip: at(B.rip), free: at(B.free), stop: at(B.stop), end: at(SHOT_DURATION.tear),
  };
})();

/**
 * G5: the expected position of Saul's right fist over the tear (blocking estimate, world, y above the ground): the
 * corner of the me'il until `grip`; then it stays where it closed, pulled back toward Saul and a little up through
 * pull -> free, and snaps back up toward his chest when the corner comes free (perf v6 performance: the live fist is
 * GilgalPerformance.fistFocus / FilmCams ctx.saulHand). For the G5b camera: frame the fist, not Samuel's walk.
 */
export function tearGrip(t: number, out = new THREE.Vector3()) {
  const A = TEAR_ACTION;
  const at = actionTime('tear', t);
  const sm = samuelAt('tear', Math.min(t, BEATS.tear.grip));
  out.set(sm.pos.x + CORNER_OFF.x, CORNER_OFF.y, sm.pos.z + CORNER_OFF.z);
  const pull = ss(A.pull - 0.06, A.rip + 0.08, at);
  const recoil = ss(A.free - 0.04, A.free + 0.14, at);
  return out.add(new THREE.Vector3(-0.12 * pull - 0.12 * recoil, 0.26 * pull + 0.15 * recoil, 0.04 * recoil));
}

/**
 * G4 ONLY (cut7, CUT v5.2 — the old man must READ and stand before the king, the space of G5a): as the roar ebbs Samuel
 * is already coming up the road toward the king (from SAMUEL_G4_FROM m east of Saul's halt, behind G3's lens), walks on
 * at an old man's steady pace and with his last step (`step` .. +0.7 s) stops SAMUEL_G4_AT m before him, facing him —
 * the distance of the tear (G5a: 1.7 m) — and answers him (15:26). G5a+ keep SAMUEL_STEP (the cut to G5a moves on along
 * the road: the two men's distance, sides and facing are the same). G1-G3 keep SAMUEL.pos (he is not in their frames).
 */
// (CUT v6: G4 is 5 s, the step at 2.0 — he comes from 4 m: an old man's 0.9 m/s)
// (CUT v6.1: he stops a long pace before the king — 1.5 m — and the tear is played on these very marks: G5a continues
//  G4's last frame, same places; SAMUEL_STEP / SAUL_TEAR below)
export const SAMUEL_G4_FROM = 4.0;
export const SAMUEL_G4_AT = 1.5;
/** his pace (m/s) on the way up: SAMUEL_G4_FROM - SAMUEL_G4_AT metres = the pace over `step` + half the last step */
const SAM_G4_PACE = (SAMUEL_G4_FROM - SAMUEL_G4_AT) / (BEATS.silence.step + 0.35);
/** metres Samuel has walked toward the king at G4 time t (steady, then the last step slowing to a stop over 0.7 s) */
function samuelG4Walk(t: number) {
  const s = BEATS.silence.step;
  if (t <= s) return SAM_G4_PACE * Math.max(0, t);
  const u = Math.min(1, (t - s) / 0.7);
  return SAM_G4_PACE * (s + 0.7 * (u - 0.5 * u * u));
}
/** Samuel's G4 feet at shot time t (on the road, facing the king) */
export function samuelG4(t: number, out = new THREE.Vector3()) {
  return out.set(SAUL_HALT.x + SAMUEL_G4_FROM - samuelG4Walk(t), 0, roadZ(SAUL_HALT.x));
}

/** Samuel's mark at the end of G4 — where he stopped before the king, facing west; his turn (G4 `turnGo`) and the
 *  tear start here (CUT v6.1, cut7: the tear is filmed on G4's own marks, in front of the halted army) */
export const SAMUEL_STEP = new THREE.Vector3(SAUL_HALT.x + SAMUEL_G4_AT, 0, roadZ(SAUL_HALT.x));
/** Saul's mark at the start of the tear: where he halted (G3) and stood through G4, facing the old man */
export const SAUL_TEAR = new THREE.Vector3(SAUL_HALT.x, 0, roadZ(SAUL_HALT.x));
/**
 * G3, the halt: Saul plays Rocketbox m_walk_stop ('walk_stop_rb') in place, started so that its final plant (both feet
 * down, clip STOP_PLANT s) lands on `halt` + HALT_PLANT; the blocking moves him along the clip's own root curve (clip
 * seconds -> metres forward, measured from the clip file) times his mocap scale, onto SAUL_HALT — no foot sliding.
 */
export const HALT_PLANT = 0;
export const STOP_PLANT = 1.13;
const STOP_CURVE: [number, number][] = [
  [0.4, 0.413], [0.5, 0.535], [0.6, 0.655], [0.7, 0.769], [0.8, 0.873], [0.9, 0.965], [1.0, 1.044], [1.1, 1.11], [1.2, 1.162],
  [1.3, 1.203], [1.4, 1.234], [1.5, 1.257], [1.6, 1.273], [1.7, 1.284], [1.8, 1.291], [1.9, 1.296], [2.0, 1.298], [2.034, 1.298],
];
/** mocap scales of the two hero actors ((thigh + shin) / 0.8969 of the MakeHuman presets, MocapPlayer.scale) */
export const SAUL_MOCAP_SCALE = 1.174;
export const SAMUEL_MOCAP_SCALE = 0.89;
function stopCurve(u: number) {
  const C = STOP_CURVE;
  if (u <= C[0][0]) return C[0][1] - (C[0][0] - u) * 1.2;
  for (let i = 0; i < C.length - 1; i++) if (u <= C[i + 1][0]) return C[i][1] + (C[i + 1][1] - C[i][1]) * (u - C[i][0]) / (C[i + 1][0] - C[i][0]);
  return C[C.length - 1][1];
}
/**
 * (CUT v6.1, cut7) G2 -> G3 is a CUT ON ACTION: G3's first frame picks up G2's last stride. KING_END_X is Saul's x at
 * G3's first frame (the stop clip's root curve at its start); G2's slow-motion stride ends exactly there.
 */
export const KING_END_X = SAUL_HALT.x - SAUL_MOCAP_SCALE * (stopCurve(2.034) - stopCurve(Math.max(0, STOP_PLANT - BEATS.spearRaised.halt - HALT_PLANT)));
/**
 * (CUT v6.1, cut7) G5a: Saul's way from his G4 mark (0) to the kneel mark (1) — still until `lunge`, then two quick
 * steps and the kneeling stride, the knee on the ground at `kneel` (eased out of the stand and into the knee)
 */
/** (CUT v6.1) how far the raised spear has come down, by the time since G3's `notice` (0 raised .. 1 lowered): it starts
 *  down as the roar thins and is lowered 1.4 s later, 0.9 s into G4 (the lowering runs across the cut) */
export function spearLowered(sinceNotice: number) {
  const u = Math.min(1, Math.max(0, sinceNotice / 1.4));
  return u * u * (3 - 2 * u);
}
export function tearPath(at: number) {
  const A = TEAR_ACTION;
  const u = Math.min(1, Math.max(0, (at - A.lunge) / Math.max(0.1, A.kneel - A.lunge)));
  return u * u * (3 - 2 * u);
}
/**
 * Samuel's turn-step in the tear (Rocketbox m_turn_left_180_to_walk = 'turn_go_L', root motion measured from the clip
 * file): clip seconds -> [east m, south m, yaw rad added to his facing west] for his mark facing west
 */
const TURN_STEP: [number, number, number, number][] = [
  [0, 0, 0, 0], [0.133, 0.026, -0.012, 8.4], [0.267, 0.062, -0.023, 18.8], [0.4, 0.109, -0.032, 31.1], [0.533, 0.167, -0.035, 44.7],
  [0.667, 0.237, -0.029, 59.6], [0.8, 0.318, -0.012, 75.6], [0.933, 0.409, 0.017, 92.3], [1.067, 0.507, 0.058, 109.0],
  [1.2, 0.61, 0.107, 124.4], [1.333, 0.712, 0.163, 137.6], [1.467, 0.808, 0.218, 147.7], [1.6, 0.891, 0.267, 154.8], [1.633, 0.909, 0.278, 156.1],
];
function turnStep(u: number): [number, number, number] {
  const T = TURN_STEP;
  if (u <= 0) return [0, 0, 0];
  for (let i = 0; i < T.length - 1; i++) {
    if (u <= T[i + 1][0]) {
      const k = (u - T[i][0]) / (T[i + 1][0] - T[i][0]);
      return [T[i][1] + (T[i + 1][1] - T[i][1]) * k, T[i][2] + (T[i + 1][2] - T[i][2]) * k, THREE.MathUtils.degToRad(T[i][3] + (T[i + 1][3] - T[i][3]) * k)];
    }
  }
  const l = T[T.length - 1];
  return [l[1], l[2], THREE.MathUtils.degToRad(l[3])];
}
/** clip seconds of the turn-step before the slow walk takes over (its last step; the walk is phase-matched) */
export const SAM_TURN_CUT = 1.5;
/** Samuel's heading once he walks away (ESE along the road, away from the king; game yaw) */
export const SAM_AWAY_YAW = 1.15;
/**
 * the way his walk actually goes: Rocketbox m_walk_slow drifts 8.2 deg to the walker's right of his facing (its cycle
 * advance [-0.188, 1.311]) — measured in the film (perf v7 probe: 57.7 deg); the root motion carries him along it
 */
const SAM_WALK_YAW = SAM_AWAY_YAW - Math.atan2(0.1882, 1.3113);
const SAM_DIR = new THREE.Vector3(Math.sin(SAM_WALK_YAW), 0, Math.cos(SAM_WALK_YAW));
/** the turn-step's extra drift to the south in the film (the yaw lags the clip during the fade-in; measured: +0.02 m at
 * 0.5 s, +0.06 at 1.0 s, +0.09 at 1.5 s of the clip) */
const turnDriftSouth = (u: number) => 0.06 * Math.pow(Math.max(0, u), 1.4);
/** his pace (m/s of action time): walking away (an old man's walk), held back by the corner (grip -> free), freed */
export const SAM_PACE = 0.5;
export const SAM_HELD = 0.25;
export const SAM_FREED = 0.72;
/** he stops this long (action s) after `free` */
export const SAM_STOP = 0.45;
/** metres walked after the turn-step by action time `at` (the pace profile above) */
function samuelWalk(at: number) {
  const A = TEAR_ACTION;
  const seg = (a: number, b: number) => Math.max(0, Math.min(at, b) - a);
  const t1 = A.turn + SAM_TURN_CUT;
  return seg(t1, Math.max(t1, A.grip)) * SAM_PACE + seg(Math.max(t1, A.grip), A.free) * SAM_HELD + seg(A.free, A.free + SAM_STOP) * SAM_FREED;
}
/**
 * G5: Saul on his knee behind the corner — his root `back` m behind the grip (along his facing) and `side` m to its
 * left, so the right arm is stretched down-forward to it (measured on the performance, perf v6)
 */
export const TEAR_KNEEL = { back: 0.74, side: 0.2 };
let kneelMark: THREE.Vector3 | null = null;
/** where Saul's knee goes down (blocking estimate: the corner at `grip`, TEAR_KNEEL behind it; he faces east) — he stays
 *  on that knee through G5b, G6 and G7 (CUT v6.1: "Saul alone on his knee") */
export function tearKneelMark() {
  if (!kneelMark) {
    const sm = samuelAt('tear', BEATS.tear.grip).pos;
    kneelMark = new THREE.Vector3(sm.x + CORNER_OFF.x - TEAR_KNEEL.back, 0, sm.z + CORNER_OFF.z - TEAR_KNEEL.side);
  }
  return kneelMark;
}
/** the lower corner of the me'il (the grab point) relative to samuelAt('tear', t).pos until the grip (his SOUTH side,
 * knee-low; measured on the performance, perf v6) */
const CORNER_OFF = { x: -0.26, y: 0.54, z: 0.18 };
/**
 * Saul's fist on the corner at the FIRST frame of the insert (blocking time TEAR_INSERT_AT), relative to
 * samuelAt('tear', TEAR_INSERT_AT).pos: the fist holds the corner where it closed at `grip` (the pull starts in the
 * insert) while the old man, held back, has walked on a little (CUT v3: x ≈ -0.42, z ≈ 0.11; perf v6 measured -0.39 /
 * 0.12 on the performance). `pullY`: how far the fist rises by the end of the insert (perf v6: he hauls the corner up
 * and back — +0.26 m by `rip` — then the recoil once the corner is free).
 * The fist stays with Saul, not with Samuel's walk: for its path through the whole tear use tearGrip(t).
 */
export const TEAR_GRIP = (() => {
  const g = samuelAt('tear', BEATS.tear.grip).pos;
  const i = samuelAt('tear', TEAR_INSERT_AT).pos;
  return { x: g.x + CORNER_OFF.x - i.x, y: CORNER_OFF.y, z: g.z + CORNER_OFF.z - i.z, pullY: 0.4 };
})();

function alongExit(d: number) {
  const pts = SAMUEL_EXIT;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = pts[i].distanceTo(pts[i + 1]);
    if (d <= l || i === pts.length - 2) return { pos: pts[i].clone().lerp(pts[i + 1], Math.min(1, d / l)), yaw: Math.atan2(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z) };
    d -= l;
  }
  return { pos: pts[pts.length - 1].clone(), yaw: Math.PI / 2 };
}

/** Saul after the tear (verdict, alone): still on his knee where he knelt (CUT v6.1: the cuts G5b -> G6 -> G7 join
 *  continuous time — the G6 / G7 cameras are built on these marks) */
const saulAfter = () => tearKneelMark().clone();
/** Samuel after the tear (verdict): where the insert leaves him — stopped after the corner gave (G5b `stop`); G6 picks
 *  his turn back to the king up from there */
const samuelAfter = () => samuelAt('tear', SHOT_DURATION.tear).pos;
/** his heading at the end of the insert (walking away ESE, the turn back only begun) */
const samuelAfterYaw = () => samuelAt('tear', SHOT_DURATION.tear).yaw;

export function saulAt(shot: GilgalShotName, t: number): ActorState {
  const at = actionTime(shot, t);
  switch (shot) {
    case 'dustWall': return { pos: onRoad(-172 + MARCH_SPEED * at), yaw: Math.PI / 2, walk: MARCH_SPEED, cue: 0, action: 'marching at the head of the army out of the dust' };
    // (CUT v6.1, cut7: G2 -> G3 is a CUT ON ACTION — the stride of G2's end is picked up by G3: G2 walks the last metres
    //  before the halt, ending exactly where G3's stop begins, KING_TO_HALT)
    case 'king': return { pos: onRoad(KING_END_X - MARCH_SPEED * (SHOT_LEN.king * SLOWMO.king - at)), yaw: Math.PI / 2, walk: MARCH_SPEED, cue: 0, action: 'striding, slow motion (helmet under the left arm, spear in the right hand)' };
    case 'spearRaised': {
      // the last step of the halt: decelerating from the march onto his mark by `halt`
      const B = BEATS.spearRaised;
      const t0 = Math.max(0, STOP_PLANT - B.halt - HALT_PLANT);
      const d = SAUL_MOCAP_SCALE * (stopCurve(2.034) - stopCurve(t0 + at));
      // (CUT v6.1: from `notice` the spear starts down — the lowering runs on across the cut into G4: spearLowered)
      return { pos: onRoad(SAUL_HALT.x - d), yaw: Math.PI / 2, walk: at < B.halt + HALT_PLANT ? MARCH_SPEED * (1 - at / (B.halt + HALT_PLANT)) : 0, cue: ss(B.spearUp - 0.12, B.spearUp + 0.38, at) * (1 - spearLowered(at - B.notice)), action: 'halts; thrusts the spear to the sky with his whole body; roars' };
    }
    case 'silence': {
      // (CUT v6.1) the spear comes down at `roarCut` (its lowering began at G3's `notice`): gripped in his fist, lowered
      return { pos: onRoad(SAUL_HALT.x), yaw: Math.PI / 2, walk: 0, cue: 1 - spearLowered(at + SHOT_LEN.spearRaised - BEATS.spearRaised.notice), action: 'the roar dies; the spear comes down; he sees the old man in the road' };
    }
    case 'faceOff': return { pos: SAUL_FACE.pos.clone(), yaw: SAUL_FACE.yaw, walk: 0, cue: 0, action: 'face to face with Samuel' };
    case 'tear': {
      // (CUT v6.1, cut7) he stands on his G4 mark, the spear in his fist, while the old man turns away; at `drop` his
      // hand opens and the spear falls; at `lunge` two quick steps after him and down onto his LEFT knee by `kneel`
      // (TEAR_PATH); the fist closes on the corner at `grip`; he pulls with his body from that knee (the root stays)
      const A = TEAR_ACTION;
      const go = tearPath(at);
      const p = SAUL_TEAR.clone().lerp(tearKneelMark(), go);
      const walk = at >= A.lunge && at < A.kneel - 0.3 ? 1.9 : 0;
      return { pos: p, yaw: Math.PI / 2, walk, cue: ss(A.lunge, A.free, at), action: 'lets the spear fall; two quick steps after him, onto one knee, seizes the corner of the me\'il, pulls — it tears' };
    }
    case 'verdict': return { pos: saulAfter(), yaw: Math.PI / 2, walk: 0, cue: 1, action: 'on his knee, holds the torn piece; listens' };
    case 'saulAlone':
    case 'rise': return { pos: saulAfter(), yaw: Math.PI / 2, walk: 0, cue: 1, action: 'alone on his knee, the torn cloth in his fist' };
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
      // walking up the road to the king; the last step at `step`; then he stands before him and answers (15:26); at
      // `turnGo` (CUT v6.1) he begins to turn away — the turn-step G5a picks up
      const s = BEATS.silence.step;
      const go = BEATS.silence.turnGo;
      if (at >= go) {
        const u = at - go;
        const [e, so, y] = turnStep(u);
        return { pos: SAMUEL_STEP.clone().add(new THREE.Vector3(e * SAMUEL_MOCAP_SCALE, 0, so * SAMUEL_MOCAP_SCALE + turnDriftSouth(u))), yaw: SAMUEL.yaw + y, walk: 0.55, cue: 0, action: 'turns to go (15:27)' };
      }
      const v = at < s ? SAM_G4_PACE : at < s + 0.7 ? SAM_G4_PACE * (1 - (at - s) / 0.7) : 0;
      return { pos: samuelG4(at), yaw: SAMUEL.yaw, walk: v, cue: 0, action: 'walks up the road to the king; stops before him; answers him (15:26)' };
    }
    case 'tear': {
      const A = TEAR_ACTION;
      // the old man's turn-step to his LEFT (toward the south / the camera side; the capture's own root motion, measured:
      // TURN_STEP), then a slow walk away ESE (SAM_PACE) until the corner is seized; held back by it (SAM_HELD) until
      // the wool gives, one more stride (SAM_FREED), and he stops (CUT v3, perf v7)
      if (at < A.turn) return { pos: SAMUEL_STEP.clone(), yaw: SAMUEL.yaw, walk: 0, cue: 0, action: 'stands; Saul pleads (15:24-26)' };
      const u = at - A.turn;
      if (u < SAM_TURN_CUT) {
        const [e, so, y] = turnStep(u);
        return { pos: SAMUEL_STEP.clone().add(new THREE.Vector3(e * SAMUEL_MOCAP_SCALE, 0, so * SAMUEL_MOCAP_SCALE + turnDriftSouth(u))), yaw: SAMUEL.yaw + y, walk: 0.55, cue: ss(0, SAM_TURN_CUT, u), action: 'turns to go (15:27)' };
      }
      const [e, so, y] = turnStep(SAM_TURN_CUT);
      const d = samuelWalk(at);
      const yaw = SAMUEL.yaw + y + (SAM_AWAY_YAW - SAMUEL.yaw - y) * Math.min(1, (u - SAM_TURN_CUT) / 0.5);
      const pos = SAMUEL_STEP.clone().add(new THREE.Vector3(e * SAMUEL_MOCAP_SCALE + SAM_DIR.x * d, 0, so * SAMUEL_MOCAP_SCALE + turnDriftSouth(SAM_TURN_CUT) + SAM_DIR.z * d));
      const walk = at < A.grip ? SAM_PACE : at < A.free ? SAM_HELD : at < A.free + SAM_STOP ? SAM_FREED : 0;
      return { pos, yaw, walk, cue: 1, action: 'walks away; the corner of his robe is seized and tears' };
    }
    case 'verdict': {
      // (CUT v6.1) G6 continues the turn back begun at the end of G5b (`stop`): from his heading at the end of the insert
      // round to the king kneeling at his feet, done by `turnBack` + 0.7 (the shortest way round, by his right)
      const b = BEATS.verdict.turnBack;
      const p = samuelAfter();
      const k = tearKneelMark();
      const y0 = samuelAfterYaw();
      const y1 = Math.atan2(k.x - p.x, k.z - p.z);
      const dy = Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0));
      const turn = ss(0, b + 0.7, at);
      return { pos: p, yaw: y0 + dy * turn, walk: 0, cue: 1 - turn, action: 'turned back to the king: the verdict (15:28)' };
    }
    case 'saulAlone': {
      // (CUT v6.1) G7 is what HE sees (the eyeline cut on G6 `lookDown`): the lens stands where his eyes are; he is not
      // in the frame (the performance hides him) — his mark is kept for the light and the shadows
      const p = samuelAfter();
      const k = tearKneelMark();
      return { pos: p, yaw: Math.atan2(k.x - p.x, k.z - p.z), walk: 0, cue: 1, action: 'stands over the kneeling king (the lens is his eyes)' };
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
      // (perf v6, cut4: the files nearest the lens lane step aside 1-2 m between `part` and 2.2 s)
      // (cut7, CUT v5.2: within 0.9 s — the lens pushes through the front rank right behind them)
      return { frontX: SAUL_HALT.x, walk: 0, raise: 1 - ss(B.headsTurn + 0.1, B.part + 0.9, at), part: ss(B.part, B.part + 0.9, at), turn: ss(B.headsTurn, B.headsTurn + 0.6, at) };
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
  if (part > 0 && rank < PART_RANKS) {
    // the men step aside AWAY from the lane the G4 lens looks down (nobody walks into its long-lens ray): the files
    // next to the lane ~1.75 m, the outer files less; deep into the column (perf v6: the parting reads in the long
    // lens' mid-ground, not only at the lower frame edge)
    const side = lat >= PART_LANE ? 1 : -1;
    const k = part * (1 - 0.6 * rank / PART_RANKS) * (1.9 - Math.min(1.5, Math.abs(lat - PART_LANE) * 0.3));
    lat += side * Math.max(0, k);
  }
  return out.set(x, 0, roadZ(x) + lat);
}
