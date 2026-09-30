import * as THREE from 'three';
import type { Shot, ShotFrame } from '../../gameplay/CameraRig';
import { samuelAt, saulAt, SHOT_DURATION, SHOT_ORDER, SCRIPT_SHOT, type GilgalShotName } from './gilgalBlocking';
import { SAMUEL, SAUL_HALT, SUN } from './gilgalLayout';
import type { GilgalGround } from './gilgalTerrain';

/**
 * Camera shots 6-13 of docs/intro-script.md at Gilgal. Every shot is a CameraRig `Shot` ({ duration, at(u, time),
 * ease }): `time` = seconds since the shot started (real time), `u` = normalised (eased when ease !== false).
 * Each comes with lens / focus / exposure hints for the post chain (GilgalShotInfo).
 */
export interface GilgalShotInfo {
  name: GilgalShotName;
  /** script shot number ('6', '7', ... '10a', '10b', ... '13') */
  script: string;
  shot: Shot;
  /** depth-of-field focus point at shot time t (world), or null = no DoF (deep focus) */
  focus: (t: number) => THREE.Vector3 | null;
  /** suggested f-stop for post.setDoF (with focalLength null = physical from the fov) */
  fStop: number;
  /** exposure multiplier on top of the set exposure (backlit close-ups are opened up) */
  exposure: number;
  /** narration caption of the script for this shot (not a quotation), if any */
  caption?: string;
}

export type GilgalShots = Record<GilgalShotName, GilgalShotInfo> & { all: Shot[]; list: GilgalShotInfo[] };

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function buildGilgalShots(ground: GilgalGround): GilgalShots {
  const H = (x: number, z: number) => ground.height(x, z);
  const sunEl = THREE.MathUtils.degToRad(SUN.elevation), sunAz = THREE.MathUtils.degToRad(SUN.azimuth);
  const toSun = V(Math.sin(sunAz) * Math.cos(sunEl), Math.sin(sunEl), Math.cos(sunAz) * Math.cos(sunEl));
  const toSunH = V(toSun.x, 0, toSun.z).normalize();
  const saulHead = (name: GilgalShotName, t: number, h = 1.86) => {
    const s = saulAt(name, t);
    return s.pos.clone().setY(H(s.pos.x, s.pos.z) + h);
  };
  const samuelHead = (name: GilgalShotName, t: number, h = 1.58) => {
    const s = samuelAt(name, t);
    return s.pos.clone().setY(H(s.pos.x, s.pos.z) + h);
  };
  const frame = (pos: THREE.Vector3, look: THREE.Vector3, fov: number, roll = 0): ShotFrame => ({ pos, look, fov, roll });
  const shot = (name: GilgalShotName, at: (u: number, t: number) => ShotFrame, ease = true): Shot => ({ duration: SHOT_DURATION[name], at, ease });

  // ---------------------------------------------------------------- 6. the dust wall; the army emerges (shofar)
  const dustWall: GilgalShotInfo = {
    name: 'dustWall', script: SCRIPT_SHOT.dustWall, fStop: 5.6, exposure: 1.0, caption: 'הַגִּלְגָּל',
    shot: shot('dustWall', (u) => {
      const p = V(-60 - 9 * u, 0, 8.5 - 1.2 * u);
      p.y = H(p.x, p.z) + 1.25 + 0.2 * u;
      const lx = -170;
      return frame(p, V(lx, H(lx, 0) + 7.5 - 2.5 * u, -0.5), 25 - 8 * u);
    }),
    focus: (t) => saulHead('dustWall', t, 1.2),
  };
  // ---------------------------------------------------------------- 7. Saul: low angle, slow motion, sun behind him
  const king: GilgalShotInfo = {
    name: 'king', script: SCRIPT_SHOT.king, fStop: 2.8, exposure: 1.12, caption: 'שָׁאוּל בֶּן־קִישׁ · מֶלֶךְ יִשְׂרָאֵל',
    shot: shot('king', (u, t) => {
      const head = saulHead('king', t);
      const D = 7.4 - 1.6 * u;
      // on the line from his head away from the sun, so the sun stands just beside his head
      const p = head.clone().addScaledVector(toSunH, -D);
      p.z += 0.42;
      p.y = H(p.x, p.z) + 0.42;
      const look = head.clone().add(V(0, 0.18, 0));
      return frame(p, look, 36, 0.035 * Math.sin(u * 1.4));
    }, false),
    focus: (t) => saulHead('king', t),
  };
  // ---------------------------------------------------------------- 8. the peak: the spear raised, the roar
  const spearRaised: GilgalShotInfo = {
    name: 'spearRaised', script: SCRIPT_SHOT.spearRaised, fStop: 4, exposure: 1.05,
    shot: shot('spearRaised', (u) => {
      const s = SAUL_HALT;
      const g = H(s.x, s.z);
      const p = V(s.x + 8.5 + 1.8 * u, 0, s.z + 6.3 + 1.2 * u);
      p.y = H(p.x, p.z) + 0.75 + 2.4 * u;
      return frame(p, V(s.x - 1.5, g + 2.0 + 1.1 * u, s.z - 0.5), 42 - 4 * u);
    }),
    focus: () => SAUL_HALT.clone().setY(H(SAUL_HALT.x, SAUL_HALT.z) + 1.9),
  };
  // ---------------------------------------------------------------- 9. silence: the ranks part; Samuel in the road
  const silence: GilgalShotInfo = {
    name: 'silence', script: SCRIPT_SHOT.silence, fStop: 5.6, exposure: 1.0, caption: 'שְׁמוּאֵל',
    shot: shot('silence', (u) => {
      const p = V(SAUL_HALT.x - 13.5 + 2.5 * u, 0, SAUL_HALT.z + 0.55);
      p.y = H(p.x, p.z) + 1.72;
      const look = SAMUEL.pos.clone();
      look.y = H(look.x, look.z) + 1.25;
      return frame(p, look, 21 - 3 * u);
    }),
    focus: (t) => (t < 3.2 ? saulHead('silence', t, 1.5) : samuelHead('silence', t)),
  };
  // ---------------------------------------------------------------- 10a. face to face (profile two-shot)
  const faceOff: GilgalShotInfo = {
    name: 'faceOff', script: SCRIPT_SHOT.faceOff, fStop: 2.8, exposure: 1.1,
    shot: shot('faceOff', (u) => {
      const mid = saulHead('faceOff', 0, 1.62).lerp(samuelHead('faceOff', 0, 1.5), 0.5);
      const p = V(mid.x + 0.25, 0, mid.z + 6.4 - 1.3 * u);
      p.y = H(p.x, p.z) + 1.52;
      return frame(p, mid.clone().add(V(0, -0.02, 0)), 31);
    }),
    focus: () => saulHead('faceOff', 0, 1.62).lerp(samuelHead('faceOff', 0, 1.5), 0.5),
  };
  // ---------------------------------------------------------------- 10b. the tearing (slow motion, into the light)
  const tear: GilgalShotInfo = {
    name: 'tear', script: SCRIPT_SHOT.tear, fStop: 2.0, exposure: 1.2,
    shot: shot('tear', (u, t) => {
      const sm = samuelAt('tear', t).pos;
      const grip = V(sm.x - 0.35, H(sm.x, sm.z) + 1.0, sm.z + 0.12);
      const dir = V(1.0, 0, 0.78).normalize();
      const D = 3.1 - 0.9 * u;
      const p = grip.clone().addScaledVector(dir, D);
      p.y = grip.y - 0.02 + 0.05 * u;
      return frame(p, grip.clone().add(V(0, 0.08, 0)), 33 - 3 * u);
    }, false),
    focus: (t) => {
      const sm = samuelAt('tear', t).pos;
      return V(sm.x - 0.35, H(sm.x, sm.z) + 1.0, sm.z + 0.12);
    },
  };
  // ---------------------------------------------------------------- 11. the verdict: close on Samuel
  const verdict: GilgalShotInfo = {
    name: 'verdict', script: SCRIPT_SHOT.verdict, fStop: 2.0, exposure: 1.05,
    shot: shot('verdict', (u) => {
      const head = samuelHead('verdict', 0);
      const p = V(head.x - 2.25 + 0.35 * u, 0, head.z + 1.15 - 0.15 * u);
      p.y = head.y + 0.05;
      return frame(p, head.clone().add(V(0, -0.02, 0)), 22 - 3.5 * u);
    }),
    focus: () => samuelHead('verdict', 0),
  };
  // ---------------------------------------------------------------- 12. Saul: the fist, then the long close-up
  const saulAlone: GilgalShotInfo = {
    name: 'saulAlone', script: SCRIPT_SHOT.saulAlone, fStop: 2.0, exposure: 1.3,
    shot: shot('saulAlone', (_u, t) => {
      const s = saulAt('saulAlone', t).pos;
      const g = H(s.x, s.z);
      const fist = V(s.x + 0.22, g + 0.98, s.z + 0.3);
      const face = V(s.x + 0.05, g + 1.84, s.z);
      const k = ss(0.6, 4.2, t);
      const push = ss(3.5, 10, t);
      const look = fist.clone().lerp(face, k);
      const p = V(s.x + 2.3 - 0.5 * push, g + 1.3 + 0.5 * k, s.z + 1.05 - 0.2 * push);
      return frame(p, look, 27 - 6 * push);
    }, false),
    focus: (t) => {
      const s = saulAt('saulAlone', t).pos;
      const g = H(s.x, s.z);
      return V(s.x + 0.22, g + 0.98, s.z + 0.3).lerp(V(s.x + 0.05, g + 1.84, s.z), ss(0.6, 4.2, t));
    },
  };
  // ---------------------------------------------------------------- 13. the rise: into the sky, sweeping south
  const toBeth = V(-0.77, 0, 0.64).normalize(); // toward Bethlehem (south-west over the Judean hills)
  const rise: GilgalShotInfo = {
    name: 'rise', script: SCRIPT_SHOT.rise, fStop: 8, exposure: 1.0,
    shot: shot('rise', (_u, t) => {
      const s = saulAt('rise', 0).pos;
      const g = H(s.x, s.z);
      // altitude: a slow lift off the king, then an accelerating climb through the deck to ~3.8 km
      const a1 = ss(0, 4.0, t), a2 = ss(3.0, 11.5, t), a3 = ss(10.5, 15, t);
      const alt = 2.4 + 50 * a1 + 3350 * Math.pow(a2, 1.7) + 450 * a3;
      // horizontal: first straight above him, then the gaze sweeps away south-west
      const travel = 2600 * Math.pow(a2, 2.2) + 7000 * a3;
      const p = V(s.x + 1.4 + 2.5 * a1, g + alt, s.z + 0.9).addScaledVector(toBeth, travel);
      // orientation: look down at the king, pitch up to the horizon while turning toward Bethlehem
      const pitch = THREE.MathUtils.lerp(-1.45, -0.5, ss(2.5, 9.5, t)) * (1 - ss(9.0, 15, t)) + -0.1 * ss(9.0, 15, t);
      const yaw0 = Math.atan2(-1, 0.1); // facing west (toward the king and the army) at the start
      const yaw1 = Math.atan2(toBeth.x, toBeth.z);
      let dy = yaw1 - yaw0;
      if (dy > Math.PI) dy -= Math.PI * 2;
      if (dy < -Math.PI) dy += Math.PI * 2;
      const yaw = yaw0 + dy * ss(3.0, 12.5, t);
      const dir = V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      const look = t < 3.0 ? V(s.x, g + 1.2, s.z).lerp(p.clone().add(dir), ss(0.5, 3.0, t)) : p.clone().add(dir);
      return frame(p, look, 40 + 12 * ss(4, 12, t), 0.06 * Math.sin(t * 0.35) * ss(5, 12, t));
    }, false),
    focus: () => null,
  };

  const map = { dustWall, king, spearRaised, silence, faceOff, tear, verdict, saulAlone, rise };
  const list = SHOT_ORDER.map((n) => map[n]);
  return Object.assign(map, { all: list.map((i) => i.shot), list });
}
