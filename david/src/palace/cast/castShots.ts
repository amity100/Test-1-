import * as THREE from 'three';
import type { Shot, ShotFrame } from '../../gameplay/CameraRig';

/*
 * Camera shots framed on the cast (same `Shot` semantics as src/palace/palaceShots.ts and Story.intro:
 * `{ duration, at(u, t), ease? }`, u = smoothstep(t / duration) unless ease === false). Built once per cast from
 * probed focus points (face / eyes / hands of the settled beat poses), in palace-scene coordinates.
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function float(t: number, amp: number, seed: number, out: THREE.Vector3) {
  return out.set(
    Math.sin(t * 0.61 + seed) * 0.6 + Math.sin(t * 1.37 + seed * 2.1) * 0.4,
    Math.sin(t * 0.83 + seed * 1.3) * 0.6 + Math.sin(t * 1.91 + seed * 0.7) * 0.4,
    Math.sin(t * 0.47 + seed * 0.4) * 0.6 + Math.sin(t * 1.13 + seed * 1.7) * 0.4,
  ).multiplyScalar(amp);
}

const _f = new THREE.Vector3();

/** Camera move: Catmull-Rom (or linear for 2 keys) position / target paths, fov ramp, damped operator float. */
export function move(duration: number, pos: THREE.Vector3[], look: THREE.Vector3[], fov: [number, number], floatAmp = 0.006, ease = true): Shot {
  const pc = pos.length > 2 ? new THREE.CatmullRomCurve3(pos, false, 'centripetal') : null;
  const lc = look.length > 2 ? new THREE.CatmullRomCurve3(look, false, 'centripetal') : null;
  const seed = pos[0].x * 0.13 + pos[0].z * 0.07;
  return {
    duration,
    ease,
    at: (u: number, t: number): ShotFrame => {
      const p = pc ? pc.getPoint(u) : pos[0].clone().lerp(pos[pos.length - 1], u);
      const l = lc ? lc.getPoint(u) : look[0].clone().lerp(look[look.length - 1], u);
      p.add(float(t, floatAmp, seed, _f));
      l.add(float(t + 3.1, floatAmp * 0.6, seed + 5, _f));
      return { pos: p, look: l, fov: THREE.MathUtils.lerp(fov[0], fov[1], u) };
    },
  };
}

/** Probed points (world) of each beat, recorded after the beat's poses settle. */
export interface CastProbe {
  court: { saulEyes: THREE.Vector3; saulHand: THREE.Vector3; fwd: THREE.Vector3; left: THREE.Vector3; seat: THREE.Vector3 };
  portrait: { saulEyes: THREE.Vector3; saulChest: THREE.Vector3; fwd: THREE.Vector3; left: THREE.Vector3; spearTip: THREE.Vector3 };
  warriors: { lineCentre: THREE.Vector3; lineDir: THREE.Vector3; facing: THREE.Vector3; abnerStart: THREE.Vector3; abnerEnd: THREE.Vector3; saulEyes: THREE.Vector3; heads: number };
  hall: { saulEyes: THREE.Vector3; saulChest: THREE.Vector3; corner: THREE.Vector3; pinch: THREE.Vector3; hand: THREE.Vector3; fwd: THREE.Vector3; left: THREE.Vector3 };
}

export interface CastShots {
  /** 'saul-court' (6.5 s): the enthroned king under the tamarisk, slow push from the front-left at seated eye level */
  court: Shot;
  /** 'saul-portrait' (4.8 s): low-angle close portrait of the standing king, slight arc + push */
  portrait: Shot;
  /** 'warriors' (4 s): lateral track along the line of men at arms, Abner walking the line */
  warriorsLine: Shot;
  /** 'warriors' (3 s): over the men's shoulders back to Saul watching them from his seat */
  warriorsSaul: Shot;
  /** 'saul-hall' (6 s): evening, the king alone on his seat by the wall; slow push to a medium close-up */
  hall: Shot;
  /** 'hinge' (5.5 s): insert on the torn corner of the robe in the king's hand, slow drift */
  robeCorner: Shot;
}

export function buildCastShots(p: CastProbe): CastShots {
  // ---- court: front-left of the seated king at his eye level: the whole court about him, pushing in to the king
  const c = p.court;
  const court = move(6.5,
    [c.saulEyes.clone().addScaledVector(c.fwd, 4.3).addScaledVector(c.left, 0.95).add(V(0, 0.02, 0)), c.saulEyes.clone().addScaledVector(c.fwd, 3.1).addScaledVector(c.left, 0.62).add(V(0, -0.02, 0))],
    [c.saulEyes.clone().add(V(0, -0.42, 0)), c.saulEyes.clone().add(V(0, -0.26, 0))],
    [34, 29], 0.006);
  // ---- portrait: low angle from his right front (the key side of the face away from the lens), a slow push from a
  // medium shot where the armour-bearer's and the runner's heads reach his shoulders (9:2) to a close shot
  const q = p.portrait;
  const portrait = move(4.8,
    [q.saulEyes.clone().addScaledVector(q.fwd, 3.0).addScaledVector(q.left, -0.5).add(V(0, -0.72, 0)), q.saulEyes.clone().addScaledVector(q.fwd, 1.6).addScaledVector(q.left, -0.22).add(V(0, -0.42, 0))],
    [q.saulEyes.clone().add(V(0, -0.14, 0)), q.saulEyes.clone().add(V(0, -0.06, 0))],
    [30, 24], 0.003);
  // ---- warriors: lateral track in front of the line (slightly off the axis between the line and the king)
  const w = p.warriors;
  const side = w.lineDir;
  const trackA = w.lineCentre.clone().addScaledVector(w.facing, 3.6).addScaledVector(side, -3.2).add(V(0, 1.45, 0));
  const trackB = w.lineCentre.clone().addScaledVector(w.facing, 3.1).addScaledVector(side, 0.8).add(V(0, 1.4, 0));
  const warriorsLine = move(4,
    [trackA, trackB],
    [w.lineCentre.clone().addScaledVector(side, -1.6).add(V(0, 1.45, 0)), w.lineCentre.clone().addScaledVector(side, 1.4).add(V(0, 1.4, 0))],
    [36, 34], 0.01);
  // back to Saul: behind the line, between two men, looking to the king
  const behind = w.lineCentre.clone().addScaledVector(w.facing, -2.8).addScaledVector(side, 0.62).add(V(0, 1.78, 0));
  const warriorsSaul = move(3,
    [behind, behind.clone().addScaledVector(w.facing, 0.4).add(V(0, -0.03, 0))],
    [w.saulEyes.clone().add(V(0, -0.3, 0)), w.saulEyes.clone().add(V(0, -0.26, 0))],
    [20, 17], 0.006);
  // ---- hall (evening): from the front-right of the seat, lens at seated chest height, slow push
  const h = p.hall;
  const hall = move(6,
    [h.saulEyes.clone().addScaledVector(h.fwd, 2.7).addScaledVector(h.left, 0.8).add(V(0, -0.4, 0)), h.saulEyes.clone().addScaledVector(h.fwd, 1.8).addScaledVector(h.left, 0.5).add(V(0, -0.34, 0))],
    [h.saulEyes.clone().add(V(0, -0.3, 0)), h.saulEyes.clone().add(V(0, -0.18, 0))],
    [31, 28], 0.004);
  // ---- hinge: close on the torn corner in his left hand, drifting across it
  // look between the pinching fingers and the tzitzit corner: hand, torn edge and fringe in one frame
  const rc = h.pinch.clone().lerp(h.corner, 0.6);
  // from the king's left, outside the knee: the torn cloth and its fringe against the dark seat and wall
  // from his front-left, close on the torn corner he holds up before him, his bowed face behind it; a slow pull
  // back and up that brings the face into the frame (the memory and the man)
  const robeCorner = move(5.5,
    [rc.clone().addScaledVector(h.fwd, 0.58).addScaledVector(h.left, 0.3).add(V(0, 0.02, 0)), rc.clone().addScaledVector(h.fwd, 1.15).addScaledVector(h.left, 0.5).add(V(0, 0.16, 0))],
    [rc.clone(), rc.clone().lerp(h.saulEyes, 0.5)],
    [32, 30], 0.0015);
  return { court, portrait, warriorsLine, warriorsSaul, hall, robeCorner };
}
