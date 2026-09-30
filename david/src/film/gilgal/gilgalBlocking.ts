import * as THREE from 'three';
import { ARMY, roadZ, SAMUEL, SAMUEL_EXIT, SAUL_FACE, SAUL_HALT } from './gilgalLayout';

/**
 * Blocking of ACT I (who stands where, when), per shot, in shot-local seconds (the same `time` that
 * CameraRig passes to Shot.at). The camera shots in gilgalShots.ts are built on it, the placeholder figures follow it,
 * and the cast / crowd teammates drive their characters from it so camera and actors stay in register.
 *
 * `timeScale` is the slow-motion factor of the action within a shot (1 = real time): animation clocks of the actors
 * should advance by dt * timeScale (the camera moves in real time).
 */
export type GilgalShotName = 'dustWall' | 'king' | 'spearRaised' | 'silence' | 'faceOff' | 'tear' | 'verdict' | 'saulAlone' | 'rise';

export const SHOT_ORDER: GilgalShotName[] = ['dustWall', 'king', 'spearRaised', 'silence', 'faceOff', 'tear', 'verdict', 'saulAlone', 'rise'];

/** durations (s): Act I 0:40-1:40 = 60 s for shots 6-12, the transition 1:40-1:55 = 15 s for shot 13 */
export const SHOT_DURATION: Record<GilgalShotName, number> = {
  dustWall: 7, king: 8, spearRaised: 6, silence: 8, faceOff: 5, tear: 7, verdict: 9, saulAlone: 10, rise: 15,
};

/** script shot number of each camera shot */
export const SCRIPT_SHOT: Record<GilgalShotName, string> = {
  dustWall: '6', king: '7', spearRaised: '8', silence: '9', faceOff: '10a', tear: '10b', verdict: '11', saulAlone: '12', rise: '13',
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
}

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const onRoad = (x: number) => new THREE.Vector3(x, 0, roadZ(x));

/** marching pace of the column (m/s) */
export const MARCH_SPEED = 1.35;
/** slow-motion factor of shot 7 and of the tearing */
export const SLOWMO = { king: 0.4, tear: 0.3 };
export const RAISE_DELAY_PER_RANK = 0.035;

export function timeScale(shot: GilgalShotName, t: number) {
  if (shot === 'king') return SLOWMO.king;
  if (shot === 'tear') return THREE.MathUtils.lerp(1, SLOWMO.tear, ss(1.8, 2.3, t));
  return 1;
}

/** action time elapsed at shot time t (integral of timeScale) */
function actionTime(shot: GilgalShotName, t: number) {
  if (shot === 'king') return t * SLOWMO.king;
  if (shot === 'tear') {
    // piecewise-linear approximation of the smooth ramp
    if (t < 2.05) return t;
    return 2.05 + (t - 2.05) * SLOWMO.tear;
  }
  return t;
}

function alongExit(d: number) {
  const pts = SAMUEL_EXIT;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = pts[i].distanceTo(pts[i + 1]);
    if (d <= l || i === pts.length - 2) return { pos: pts[i].clone().lerp(pts[i + 1], Math.min(1, d / l)), yaw: Math.atan2(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z) };
    d -= l;
  }
  return { pos: pts[pts.length - 1].clone(), yaw: Math.PI / 2 };
}

export function saulAt(shot: GilgalShotName, t: number): ActorState {
  const at = actionTime(shot, t);
  switch (shot) {
    case 'dustWall': return { pos: onRoad(-172 + MARCH_SPEED * at), yaw: Math.PI / 2, walk: MARCH_SPEED, cue: 0, action: 'marching at the head of the army out of the dust' };
    case 'king': return { pos: onRoad(-96 + MARCH_SPEED * at), yaw: Math.PI / 2, walk: MARCH_SPEED, cue: 0, action: 'striding, slow motion (helmet under the left arm, spear in the right hand)' };
    case 'spearRaised': return { pos: onRoad(SAUL_HALT.x), yaw: Math.PI / 2, walk: 0, cue: ss(0.9, 2.1, at), action: 'halts and raises his spear to the sky' };
    case 'silence': return { pos: onRoad(SAUL_HALT.x), yaw: Math.PI / 2, walk: 0, cue: 1 - ss(0.0, 1.2, at), action: 'lowers the spear; sees Samuel in the road' };
    case 'faceOff': return { pos: SAUL_FACE.pos.clone(), yaw: SAUL_FACE.yaw, walk: 0, cue: 0, action: 'face to face with Samuel' };
    case 'tear': return { pos: SAUL_FACE.pos.clone().add(new THREE.Vector3(0.35 * ss(1.2, 2.4, at), 0, 0)), yaw: SAUL_FACE.yaw, walk: 0, cue: ss(1.2, 2.9, at), action: 'reaches, seizes the corner of the robe (cue 0.5), it tears (cue 0.8-1)' };
    case 'verdict': return { pos: SAUL_FACE.pos.clone().add(new THREE.Vector3(0.35, 0, 0)), yaw: SAUL_FACE.yaw, walk: 0, cue: 1, action: 'holds the torn piece; listens' };
    case 'saulAlone':
    case 'rise': return { pos: SAUL_FACE.pos.clone().add(new THREE.Vector3(0.35, 0, 0)), yaw: SAUL_FACE.yaw, walk: 0, cue: 1, action: 'stands alone, the torn cloth in his fist' };
  }
}

export function samuelAt(shot: GilgalShotName, t: number): ActorState {
  const at = actionTime(shot, t);
  switch (shot) {
    case 'dustWall':
    case 'king':
    case 'spearRaised':
    case 'silence':
    case 'faceOff': return { pos: SAMUEL.pos.clone(), yaw: SAMUEL.yaw, walk: 0, cue: 0, action: 'stands in the road, wrapped in his robe' };
    case 'tear': {
      const turn = ss(0.2, 1.3, at);
      return { pos: SAMUEL.pos.clone().add(new THREE.Vector3(0.55 * ss(0.9, 2.2, at), 0, 0)), yaw: SAMUEL.yaw + Math.PI * turn, walk: at > 0.9 && at < 2.2 ? 0.5 : 0, cue: turn, action: 'turns to go (15:27); the corner of his robe is seized and tears' };
    }
    case 'verdict': return { pos: SAMUEL.pos.clone().add(new THREE.Vector3(0.55, 0, 0)), yaw: SAMUEL.yaw, walk: 0, cue: 0, action: 'turned back to the king: the verdict (15:28)' };
    case 'saulAlone': {
      const d = Math.max(0, at - 1.2) * 1.1;
      const e = alongExit(0.55 + d);
      return { pos: e.pos, yaw: d > 0 ? e.yaw : SAMUEL.yaw + Math.PI * ss(0, 1.2, at), walk: d > 0 ? 1.1 : 0, cue: 1, action: 'turns and walks away east' };
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
    case 'king': return { frontX: s.pos.x, walk: MARCH_SPEED, raise: 0, part: 0 };
    case 'spearRaised': return { frontX: SAUL_HALT.x, walk: 0, raise: ss(1.4, 2.6, at), part: 0 };
    case 'silence': return { frontX: SAUL_HALT.x, walk: 0, raise: 1 - ss(0.1, 1.4, at), part: ss(1.8, 5.2, at) };
    default: return { frontX: SAUL_HALT.x, walk: 0, raise: 0, part: 1 };
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
    const k = part * (1 - rank / 12) * (3.4 - Math.min(3.0, Math.abs(lat) * 0.35));
    lat += side * Math.max(0, k);
  }
  return out.set(x, 0, roadZ(x) + lat);
}
