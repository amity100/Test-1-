import * as THREE from 'three';
import type { Shot, ShotFrame } from '../gameplay/CameraRig';
import { FORT, GATE, HALL, TAMARISK } from './palaceLayout';
import type { PalaceAnchors } from './PalaceSet';

/**
 * Camera shots of the palace set, with the same semantics as the intro in gameplay/Story.ts:
 * `{ duration, at(u, t) }` where CameraRig passes u = smoothstep(t / duration) unless `ease === false`.
 * Frames are in palace-scene coordinates. A slow, damped "operator float" (sub-centimetre at close range)
 * keeps locked-off moves from looking like a game camera.
 */
export interface PalaceShots {
  /** ~7 s: aerial approach over the village and terraces to the citadel on its hill */
  establishingExterior: Shot;
  /** ~5 s: low lateral track past the tamarisk on the height, the walls and a tower behind it */
  tamariskAndWalls: Shot;
  /** ~6 s: slow dolly from the courtyard through the doorway, down the pillared nave toward the seat */
  enterHall: Shot;
  /** ~6 s: low-angle push to the seat by the wall (framed for a seated or standing ~2 m king) */
  throneReveal: Shot;
  /** ~2 s each: lamp flame, the king's spear, the royal hanging */
  detailInserts: Shot[];
  /** bonus, ~6 s: the court under the tamarisk (1 Sam 22:6), for the variant with Saul seated outside */
  tamariskCourt: Shot;
  /** every shot above in intro order */
  all: Shot[];
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function float(t: number, amp: number, seed: number) {
  return V(
    Math.sin(t * 0.61 + seed) * 0.6 + Math.sin(t * 1.37 + seed * 2.1) * 0.4,
    Math.sin(t * 0.83 + seed * 1.3) * 0.6 + Math.sin(t * 1.91 + seed * 0.7) * 0.4,
    Math.sin(t * 0.47 + seed * 0.4) * 0.6 + Math.sin(t * 1.13 + seed * 1.7) * 0.4,
  ).multiplyScalar(amp);
}

/** Camera move along Catmull-Rom paths for position and target, with an fov ramp and operator float. */
function move(duration: number, pos: THREE.Vector3[], look: THREE.Vector3[], fov: [number, number], floatAmp = 0.01, ease = true, roll = 0): Shot {
  const pc = pos.length > 2 ? new THREE.CatmullRomCurve3(pos, false, 'centripetal') : null;
  const lc = look.length > 2 ? new THREE.CatmullRomCurve3(look, false, 'centripetal') : null;
  const seed = pos[0].x * 0.13 + pos[0].z * 0.07;
  return {
    duration,
    ease,
    at: (u: number, t: number): ShotFrame => {
      const p = pc ? pc.getPoint(u) : pos[0].clone().lerp(pos[pos.length - 1], u);
      const l = lc ? lc.getPoint(u) : look[0].clone().lerp(look[look.length - 1], u);
      p.add(float(t, floatAmp, seed));
      l.add(float(t + 3.1, floatAmp * 0.6, seed + 5));
      return { pos: p, look: l, fov: THREE.MathUtils.lerp(fov[0], fov[1], u), roll: roll ? roll * Math.sin(t * 0.4) : undefined };
    },
  };
}

export function buildPalaceShots(a: PalaceAnchors): PalaceShots {
  const H = HALL;
  const fortC = V((FORT.x0 + FORT.x1) / 2, 2, (FORT.z0 + FORT.z1) / 2);
  const seat = a.thronePos;
  // 1. aerial approach from the south-east over the village: the citadel crowning the hill in low morning sun
  const establishingExterior = move(7,
    [V(150, 62, 205), V(104, 38, 138), V(62, 19, 76)],
    [fortC.clone().add(V(-6, -12, -10)), fortC.clone().add(V(-3, -3, -6)), fortC.clone().add(V(-2, 2.5, -4))],
    [36, 33], 0.05);
  // 2. the tamarisk on the height: low lateral track, walls and the north-east tower behind
  const tc = a.tamariskCrown;
  const tamariskAndWalls = move(5,
    [V(TAMARISK.x + 13, a.tamariskSeat.pos.y + 1.1, TAMARISK.z + 16), V(TAMARISK.x + 16.5, a.tamariskSeat.pos.y + 1.4, TAMARISK.z + 11.5)],
    [V(tc.x - 4, tc.y - 1.2, tc.z + 1), V(tc.x - 6, tc.y - 1.0, tc.z - 1)],
    [40, 38], 0.012);
  // 3. from the courtyard through the doorway, down the nave toward the seat by the wall
  const dz = H.z1 + H.wall;
  const enterHall = move(6,
    [V(H.cx + 1.0, H.y0 + 1.72, dz + 8.5), V(H.cx + 0.25, H.y0 + 1.62, dz + 2.2), V(H.cx - 0.05, H.y0 + 1.52, H.z1 - 2.2), V(H.cx, H.y0 + 1.46, -6.4)],
    [V(H.cx + 0.2, H.y0 + 1.6, H.z1), V(H.cx, H.y0 + 1.35, -8), V(H.cx, H.y0 + 1.28, seat.z), V(H.cx, H.y0 + 1.25, seat.z)],
    [44, 38], 0.008);
  // 4. low-angle push to the seat: the lens below eye level, headroom for a king a head taller than all (1 Sam 9:2)
  const throneReveal = move(6,
    [V(seat.x - 0.35, H.y0 + 0.62, -8.4), V(seat.x - 0.15, H.y0 + 0.74, -11.3)],
    [V(seat.x, seat.y + 0.95, seat.z - 0.2), V(seat.x, seat.y + 0.85, seat.z - 0.2)],
    [40, 33], 0.006);
  // 5. inserts
  const lamp = a.detailTargets.lamp;
  const lampInsert = move(2,
    [lamp.clone().add(V(-0.34, 0.14, 0.62)), lamp.clone().add(V(-0.22, 0.1, 0.5))],
    [lamp.clone().add(V(0, 0.03, 0)), lamp.clone().add(V(0.01, 0.035, 0))],
    [28, 26], 0.002, false);
  const sb = a.spearRest.butt, st = a.spearRest.tip;
  const spearDir = st.clone().sub(sb).normalize();
  const spearInsert = move(2,
    [sb.clone().addScaledVector(spearDir, 1.35).add(V(0.75, -0.25, 0.9)), sb.clone().addScaledVector(spearDir, 2.1).add(V(0.7, -0.1, 0.85))],
    [sb.clone().addScaledVector(spearDir, 1.6), st.clone().addScaledVector(spearDir, -0.18)],
    [32, 30], 0.002, false);
  const hc = a.detailTargets.hanging;
  const textileInsert = move(2,
    [hc.clone().add(V(-1.25, -0.15, 0.85)), hc.clone().add(V(-0.55, -0.05, 0.8))],
    [hc.clone().add(V(-0.7, -0.2, 0)), hc.clone().add(V(-0.1, -0.15, 0))],
    [30, 30], 0.002, false);
  const detailInserts = [lampInsert, spearInsert, textileInsert];
  // bonus: the court under the tamarisk, slow arc toward the seated king
  const ts = a.tamariskSeat.pos;
  const fwd = V(Math.sin(a.tamariskSeat.yaw), 0, Math.cos(a.tamariskSeat.yaw));
  const side = V(fwd.z, 0, -fwd.x);
  const tamariskCourt = move(6,
    [ts.clone().addScaledVector(fwd, 7.5).addScaledVector(side, 3.5).add(V(0, 0.5, 0)), ts.clone().addScaledVector(fwd, 5.2).addScaledVector(side, 1.2).add(V(0, 0.35, 0))],
    [ts.clone().add(V(0, 1.2, 0)), ts.clone().add(V(0, 1.05, 0))],
    [36, 32], 0.01);
  void GATE;
  return {
    establishingExterior, tamariskAndWalls, enterHall, throneReveal, detailInserts, tamariskCourt,
    all: [establishingExterior, tamariskAndWalls, enterHall, throneReveal, ...detailInserts],
  };
}
