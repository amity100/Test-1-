import * as THREE from 'three';
import type { ShotFrame } from '../gameplay/CameraRig';
import { samuelAt, saulAt, type GilgalShotName } from './gilgal/gilgalBlocking';
import { SAMUEL, SAUL_HALT, SUN } from './gilgal/gilgalLayout';

/**
 * Orchestration-level camera coverage of the opening film at Gilgal (cut pass 2) — takes that replace or split the
 * set's own camera moves (src/film/gilgal/gilgalShots.ts is unchanged; its blocking drives the actors):
 *
 *   'king'         shot 7  HERO low angle: the lens 0.3 m off the ground, 3-4 m in front of the striding king, the low
 *                          western sun just beside his head (rim light through the dust); he fills the frame height
 *   'faceOff'      shot 10a coverage A: over Samuel's right shoulder onto Saul (the giant king backlit, looming)
 *   'faceOff:rev'  shot 10a coverage B: the reverse, over Saul's right shoulder onto Samuel (lit full-face by the sun)
 *
 * A take name 'base:variant' is filmed with the blocking of `base` (actors, army) at blocking time t + TAKE_OFFSET.
 * FILM_CAM holds every number so the framing can be tuned live in the test harness (window.__filmCams, ?test=1).
 */
export const FILM_CAM = {
  silence: { zoomFrom: 2.6, zoomTo: 7.6, fovEnd: 9.5 },
  king: { d0: 3.9, d1: 3.15, lens: 0.3, side: 0.62, lookH0: 1.3, lookH1: 1.42, lookSide: 0.1, fov0: 40, fov1: 38 },
  faceA: { back: 1.05, side: 0.52, h: 1.5, lookH: 1.78, lookSide: 0.42, fov0: 30, fov1: 27.5, push: 0.18 },
  faceB: { back: 1.0, side: 0.5, h: 1.72, lookH: 1.5, lookSide: 0.38, fov0: 30, fov1: 27.5, push: 0.16 },
};

/** blocking time offset (s) of a split take: its base shot has already run this long */
export const TAKE_OFFSET: Record<string, number> = { 'faceOff:rev': 2.6 };

/** base Gilgal shot of a take ('faceOff:rev' -> 'faceOff') */
export const baseTake = (take: string) => take.split(':')[0] as GilgalShotName;

/** horizontal direction toward the low western sun of the Gilgal set */
const toSunH = (() => {
  const az = THREE.MathUtils.degToRad(SUN.azimuth);
  return new THREE.Vector3(Math.sin(az), 0, Math.cos(az)).normalize();
})();

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const smooth = (u: number) => u * u * (3 - 2 * u);

/**
 * Camera of an orchestration take at Gilgal: u = normalised shot time (0..1, linear), t = shot seconds (blocking time
 * of the base shot incl. TAKE_OFFSET). Returns false when the take is the set's own (gilgalShots).
 */
export function gilgalCam(take: string, u: number, t: number, H: (x: number, z: number) => number, out: ShotFrame): boolean {
  if (take === 'king') {
    const c = FILM_CAM.king;
    const s = saulAt('king', t).pos;
    const g = H(s.x, s.z);
    const e = smooth(u);
    const D = lerp(c.d0, c.d1, e);
    // in front of him, on the line away from the sun (he walks east, the sun is west behind him); a little to the
    // south so the sun disc stands just beside his head instead of behind it
    out.pos.set(s.x - toSunH.x * D, 0, s.z - toSunH.z * D + c.side);
    out.pos.y = H(out.pos.x, out.pos.z) + c.lens;
    out.look.set(s.x, g + lerp(c.lookH0, c.lookH1, e), s.z + c.lookSide);
    out.fov = lerp(c.fov0, c.fov1, e);
    out.roll = 0.02 * Math.sin(u * 1.6);
    return true;
  }
  if (take === 'silence') {
    // the set's move from inside the column (gilgalShots 'silence'), plus a slow zoom that finds the old man standing
    // in the road 60 m ahead once the roar has died (Samuel is a speck at 21 deg)
    const c = FILM_CAM.silence;
    const e = smooth(u);
    out.pos.set(SAUL_HALT.x - 13.5 + 2.5 * e, 0, SAUL_HALT.z + 0.55);
    out.pos.y = H(out.pos.x, out.pos.z) + 1.72;
    out.look.copy(SAMUEL.pos);
    out.look.y = H(out.look.x, out.look.z) + 1.25;
    const z = smooth(Math.min(1, Math.max(0, (t - c.zoomFrom) / (c.zoomTo - c.zoomFrom))));
    out.fov = lerp(21 - 3 * e, c.fovEnd, z);
    out.roll = 0;
    return true;
  }
  if (take === 'faceOff' || take === 'faceOff:rev') {
    const sa = saulAt('faceOff', t).pos, sm = samuelAt('faceOff', t).pos;
    const rev = take === 'faceOff:rev';
    const c = rev ? FILM_CAM.faceB : FILM_CAM.faceA;
    // over the shoulder of `near` onto the face of `far`
    const near = rev ? sa : sm, far = rev ? sm : sa;
    const dir = new THREE.Vector3(far.x - near.x, 0, far.z - near.z).normalize(); // near -> far
    // near faces far: forward = dir, near's right = forward x up = (-dir.z, 0, dir.x) (also the camera's right)
    const r = new THREE.Vector3(-dir.z, 0, dir.x);
    const push = c.push * smooth(u);
    // behind the near actor's right shoulder (his shoulder and head soft at frame-left) ...
    out.pos.copy(near).addScaledVector(dir, -(c.back - push)).addScaledVector(r, c.side);
    out.pos.y = H(out.pos.x, out.pos.z) + c.h;
    // ... the far actor's face on the right third (lookSide > 0 moves him right of centre)
    out.look.copy(far).addScaledVector(r, -c.lookSide);
    out.look.y = H(far.x, far.z) + c.lookH;
    out.fov = lerp(c.fov0, c.fov1, smooth(u));
    out.roll = 0;
    return true;
  }
  return false;
}

/** DoF focus of an orchestration take: the far actor's eyes are passed in by the caller; null = use the set's */
export function gilgalCamFocusActor(take: string): 'saul' | 'samuel' | null {
  if (take === 'king' || take === 'faceOff') return 'saul';
  if (take === 'faceOff:rev') return 'samuel';
  return null;
}
