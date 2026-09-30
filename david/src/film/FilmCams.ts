import * as THREE from 'three';
import type { ShotFrame } from '../gameplay/CameraRig';
import { armyAt, armySlot, samuelAt, saulAt, type GilgalShotName } from './gilgal/gilgalBlocking';
import { ARMY, roadZ, SAMUEL, SAUL_HALT, SUN } from './gilgal/gilgalLayout';

/**
 * THE CAMERAS OF CUT v2 (docs/intro-script-v2.md; cut3). Every take is a motivated move — dolly, push, crane, orbit,
 * lateral track — on eased curves, with a subtle handheld layer (applied by the player, src/gameplay/Intro.ts, from
 * TAKE_LOOK), per-take exposure and a depth-of-field target. The sets' own camera moves (gilgalShots.ts, LandSet
 * shots) stay as fallbacks; the blocking (gilgalBlocking.ts, anim) drives the actors and these cameras follow it.
 *
 *   Gilgal (gilgalCam):  'dustWall' G1 · 'king' G2 · 'spearRaised' G3 · 'silence' G4 · 'tear' G5a · 'tear:insert' G5b
 *                        · 'verdict' G6 · 'saulAlone' G7
 *   Land (landCam):      'flight' P1+P2 (judah) · 'glint' P4 (coast) · 'elders' P5 (ramah)
 *
 * A take name 'base:variant' is filmed with the blocking of `base` (actors, army) at blocking time t + TAKE_OFFSET:
 * the insert G5b continues the tear of G5a (base shot time = insert time + 2.0 s).
 * FILM_CAM holds the numbers so the framing can be tuned live in the test harness (window.__filmCams, ?test=1).
 */
export const FILM_CAM = {
  // G1: low beside the front rank as it comes out of the dust, backing away (handheld)
  dust: { ahead0: 7.2, ahead1: 4.6, side0: 9.4, side1: 8.6, h0: 0.8, h1: 1.0, lookBack: 5, lookSide: 3.4, lookH0: 1.75, lookH1: 1.55, fov0: 44, fov1: 38 },
  // G2: very low in front of the striding king, tracking back with a slow push (the sun just beside his head)
  king: { d0: 4.7, d1: 3.35, lens: 0.3, side0: 1.05, side1: 0.55, lookH0: 1.32, lookH1: 1.5, lookSide: 0.95, fov0: 38, fov1: 33 },
  // G3: a fast push-in from low in front of the halted king, the jolt on the roar
  spear: { d0: 10.5, d1: 5.3, creep: 0.55, dirX: 0.9, dirZ: 0.44, h0: 0.8, h1: 0.46, lookH0: 1.65, lookH1: 2.35, lookBack: 0.7, fov0: 42, fov1: 36, pushT: 1.05 },
  // G4: between the soldiers' shoulders, pushing toward Samuel in the road; the ranks part
  silence: { x0: -8.6, x1: -5.8, z0: 0.95, z1: 0.75, h: 1.62, fov0: 15, fov1: 10.5, clear: 0.95 },
  // G5a: wide profile from the south, a slow drift with the action
  tear: { dx0: -0.5, dx1: 0.45, dz0: 6.9, dz1: 5.9, h: 1.22, lookH: 1.2, lookX: 0.25, fov0: 34, fov1: 30.5 },
  // G5b: the insert on the fist and the ripping wool (north of the grip, raking light from the west)
  insert: { ox0: -0.28, oz0: -0.95, oy0: 0.1, ox1: -0.2, oz1: -0.74, oy1: 0.06, fov0: 27, fov1: 23.5, follow: 0.6 },
  // G6: over Saul's right shoulder onto Samuel, a slow push
  verdict: { back0: 0.78, back1: 0.52, side0: 0.56, side1: 0.5, h: 1.63, lookH: 1.5, lookSide: 0.3, fov0: 24, fov1: 20 },
  // G7: the fist and his face; a slow push, the focus pull, the whip up into the light at the end
  alone: { dx0: 2.05, dx1: 1.55, dz0: 0.62, dz1: 0.45, h0: 1.2, h1: 1.32, fov0: 31, fov1: 27, whipAt: 1.7, whip: 7 },
  // P1+P2: the flight re-timed (shot seconds -> the set's flight parameter e), skim altitude over the deck, the bank
  flight: { keys: [[0, 0.035], [3.1, 0.3], [3.6, 0.37], [4.5, 0.49], [7.5, 0.935]] as [number, number][], skim0: 230, skim1: 45, deckTop: 2450, diveAt: 2.55, bank: 0.13, bankYaw: 0.1 },
  // P4: the long-lens lateral track along the Philistine column (ahead and to the side, looking back along it)
  coast: { ahead0: 20, ahead1: 15, side0: 23, side1: 21, h: 1.9, lookBack: 13, lookH: 1.35, fov0: 13.5, fov1: 12, march: 1.2 },
  // P5: the dolly in over the elders' heads toward Samuel
  elders: { back0: 3.6, back1: 1.3, h0: 2.2, h1: 1.95, side0: 0.9, side1: 0.45, lookH: 1.5, lookSide: 0.55, fov0: 31, fov1: 24.5 },
};

/** blocking time offset (s) of a split take: its base shot has already run this long */
export const TAKE_OFFSET: Record<string, number> = { 'tear:insert': 2.0 };

/** base Gilgal shot of a take ('tear:insert' -> 'tear') */
export const baseTake = (take: string) => take.split(':')[0] as GilgalShotName;

/**
 * Per take: handheld amplitude (deg, scaled by the lens), exposure multiplier on the set's own exposure, and an
 * impulse (jolt) at shot time `jolt` of `joltAmp` deg (the roar, the shofar). Seeds keep the takes different.
 */
export const TAKE_LOOK: Record<string, { hand: number; freq?: number; exp?: number; seed: number; jolt?: number; joltAmp?: number }> = {
  flight: { hand: 0.28, freq: 0.9, exp: 1.18, seed: 1 },
  'rachel-dawn': { hand: 0.22, seed: 2 },
  glint: { hand: 0.2, freq: 0.8, seed: 3 },
  elders: { hand: 0.3, seed: 4 },
  dustWall: { hand: 0.62, freq: 1.15, seed: 5, jolt: 0.02, joltAmp: 0.7 },
  king: { hand: 0.3, freq: 0.7, seed: 6 },
  spearRaised: { hand: 0.42, freq: 1.0, seed: 7, jolt: 1.1, joltAmp: 1.5 },
  silence: { hand: 0.3, freq: 0.6, seed: 8 },
  tear: { hand: 0.4, freq: 0.9, seed: 9 },
  'tear:insert': { hand: 0.32, freq: 0.7, seed: 10 },
  verdict: { hand: 0.2, freq: 0.55, seed: 11 },
  saulAlone: { hand: 0.26, freq: 0.7, seed: 12 },
  figure: { hand: 0.2, freq: 0.5, seed: 13 },
  face: { hand: 0.16, freq: 0.5, seed: 14 },
  thicket: { hand: 0.34, freq: 0.8, seed: 15 },
  lamb: { hand: 0.24, freq: 0.6, seed: 16 },
};

/** horizontal direction toward the low western sun of the Gilgal set */
const toSunH = (() => {
  const az = THREE.MathUtils.degToRad(SUN.azimuth);
  return new THREE.Vector3(Math.sin(az), 0, Math.cos(az)).normalize();
})();

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (u: number) => u * u * (3 - 2 * u);
/** smootherstep (zero 1st and 2nd derivative at the ends) */
const smoother = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
const ss = (a: number, b: number, x: number) => smooth(clamp01((x - a) / (b - a)));
const easeOut3 = (u: number) => 1 - Math.pow(1 - clamp01(u), 3);

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

/** Positions the orchestration can read from the cast (null when the cast did not build: blocking estimates). */
export interface GilgalCtx {
  /** Saul's right hand (the grip on the mantle), world */
  saulHand?: (out: THREE.Vector3) => THREE.Vector3 | null;
  saulEyes?: (out: THREE.Vector3) => THREE.Vector3 | null;
  samuelEyes?: (out: THREE.Vector3) => THREE.Vector3 | null;
}

/** where the fist closes on the mantle's corner (blocking estimate; the cast's hand when available) */
function gripPoint(t: number, H: (x: number, z: number) => number, ctx: GilgalCtx | undefined, out: THREE.Vector3) {
  const sm = samuelAt('tear', t).pos;
  out.set(sm.x - 0.35, H(sm.x, sm.z) + 1.0, sm.z + 0.12);
  return out;
}

/**
 * Camera of a Gilgal take at normalised shot time u (0..1, linear) and blocking time t (shot seconds incl.
 * TAKE_OFFSET). Returns false when the take is not one of these (the set's own move is used).
 */
export function gilgalCam(take: string, u: number, t: number, H: (x: number, z: number) => number, out: ShotFrame, ctx?: GilgalCtx): boolean {
  const e = smooth(u);
  out.roll = 0;
  switch (take) {
    case 'dustWall': {
      // G1 — the front rank comes out of the dust at the lens: the lens low beside the column's southern files,
      // a few metres ahead of the first rank and backing away slower than the march (the rank gains on us)
      const c = FILM_CAM.dust;
      const a = armyAt('dustWall', t);
      const fx = a.frontX - ARMY.leadGap;
      const zr = roadZ(fx);
      out.pos.set(fx + lerp(c.ahead0, c.ahead1, e), 0, zr + lerp(c.side0, c.side1, e));
      out.pos.y = H(out.pos.x, out.pos.z) + lerp(c.h0, c.h1, e);
      out.look.set(fx - c.lookBack, 0, zr + c.lookSide);
      out.look.y = H(out.look.x, out.look.z) + lerp(c.lookH0, c.lookH1, e);
      out.fov = lerp(c.fov0, c.fov1, e);
      out.roll = -0.025 + 0.02 * e;
      return true;
    }
    case 'king': {
      // G2 — very low in front of him on the line away from the sun (he walks east, the sun low in the west behind
      // him): the sun disc just beside his head, rim light through the dust; tracking back with him, a slow push and
      // a small arc; his figure on the right third, the sky's negative space on the left for the name
      const c = FILM_CAM.king;
      const s = saulAt('king', t).pos;
      const g = H(s.x, s.z);
      const D = lerp(c.d0, c.d1, e);
      out.pos.set(s.x - toSunH.x * D, 0, s.z - toSunH.z * D + lerp(c.side0, c.side1, e));
      out.pos.y = H(out.pos.x, out.pos.z) + c.lens;
      out.look.set(s.x, g + lerp(c.lookH0, c.lookH1, e), s.z + c.lookSide);
      out.fov = lerp(c.fov0, c.fov1, e);
      out.roll = 0.018 * Math.sin(u * 2.2);
      return true;
    }
    case 'spearRaised': {
      // G3 — the halt: a FAST push-in from low in front of him (east, the sun and the army's dust behind him), eased
      // out by the time the roar breaks (1.1 s), then a slow creep; the lens tilts up with the spear
      const c = FILM_CAM.spear;
      const s = saulAt('spearRaised', t).pos;
      const g = H(s.x, s.z);
      const k = easeOut3(t / c.pushT);
      const creep = clamp01((t - c.pushT) / 2.2);
      const d = lerp(c.d0, c.d1, k) - c.creep * smooth(creep);
      _a.set(c.dirX, 0, c.dirZ).normalize();
      out.pos.copy(s).addScaledVector(_a, d);
      out.pos.y = H(out.pos.x, out.pos.z) + lerp(c.h0, c.h1, k);
      out.look.copy(s).addScaledVector(_a, -c.lookBack);
      out.look.y = g + lerp(c.lookH0, c.lookH1, ss(0.55, 1.35, t));
      // a small punch-in of the lens on the roar
      const punch = Math.exp(-Math.max(0, t - 1.1) / 0.22) * (t > 1.1 ? 1 : 0);
      out.fov = lerp(c.fov0, c.fov1, k) - 1.6 * punch;
      out.roll = 0.03 * (1 - k) - 0.012 * creep;
      return true;
    }
    case 'silence': {
      // G4 — the roar cuts: the lens between the soldiers' shoulders a few ranks behind the king pushes forward;
      // heads turn, the men step aside, and the old man stands in the road far ahead (long lens); Saul's back soft
      // at the left. The lens is kept clear of the men (their formation slots) so it never enters a head.
      const c = FILM_CAM.silence;
      const sam = samuelAt('silence', t).pos;
      out.pos.set(SAUL_HALT.x + lerp(c.x0, c.x1, e), 0, roadZ(SAUL_HALT.x) + lerp(c.z0, c.z1, e));
      clearOfArmy(out.pos, 'silence', t, c.clear);
      out.pos.y = H(out.pos.x, out.pos.z) + c.h;
      out.look.set(sam.x, H(sam.x, sam.z) + 1.42, sam.z + 0.35);
      out.fov = lerp(c.fov0, c.fov1, e);
      return true;
    }
    case 'tear': {
      // G5a — the wide profile from the south (the sun at frame left behind Saul): Samuel turns to go (east, frame
      // right), Saul lunges after him; the lens drifts with the action and closes in a little
      const c = FILM_CAM.tear;
      const sa = saulAt('tear', t).pos, sm = samuelAt('tear', t).pos;
      _a.copy(sa).lerp(sm, 0.5);
      out.pos.set(_a.x + lerp(c.dx0, c.dx1, e), 0, _a.z + lerp(c.dz0, c.dz1, e));
      out.pos.y = H(out.pos.x, out.pos.z) + c.h;
      out.look.set(_a.x + c.lookX + 0.3 * e, H(_a.x, _a.z) + c.lookH, _a.z);
      out.fov = lerp(c.fov0, c.fov1, e);
      return true;
    }
    case 'tear:insert': {
      // G5b — the insert (slow motion): close on the fist and the ripping wool from the north, the low western sun
      // raking across the knuckles and the snapping fibres; a slow push, the look following the hand
      const c = FILM_CAM.insert;
      gripPoint(TAKE_OFFSET['tear:insert'], H, ctx, _b);
      const hand = ctx?.saulHand?.(_c) ?? gripPoint(t, H, ctx, _c);
      out.pos.set(_b.x + lerp(c.ox0, c.ox1, e), _b.y + lerp(c.oy0, c.oy1, e), _b.z + lerp(c.oz0, c.oz1, e));
      out.look.copy(_b).lerp(hand, c.follow);
      out.fov = lerp(c.fov0, c.fov1, e);
      out.roll = 0.035;
      return true;
    }
    case 'verdict': {
      // G6 — over Saul's right shoulder (soft at frame left) onto Samuel (right third), full-face in the low sun;
      // a slow push through the whole speech
      const c = FILM_CAM.verdict;
      const sa = saulAt('verdict', t).pos, sm = samuelAt('verdict', t).pos;
      _a.set(sm.x - sa.x, 0, sm.z - sa.z).normalize(); // Saul -> Samuel
      _b.set(-_a.z, 0, _a.x); // Saul's right (= the lens' right)
      out.pos.copy(sa).addScaledVector(_a, -lerp(c.back0, c.back1, e)).addScaledVector(_b, lerp(c.side0, c.side1, e));
      out.pos.y = H(sa.x, sa.z) + c.h;
      const eyes = ctx?.samuelEyes?.(_c);
      if (eyes) out.look.copy(eyes).addScaledVector(_b, -c.lookSide);
      else out.look.set(sm.x, H(sm.x, sm.z) + c.lookH, sm.z).addScaledVector(_b, -c.lookSide);
      out.fov = lerp(c.fov0, c.fov1, e);
      return true;
    }
    case 'saulAlone': {
      // G7 — nearly frontal, the army soft behind him in the dust and the low sun: a slow push to the fist while the
      // focus pulls up to his face; at the end the lens whips up into the light (the flash into David's hills)
      const c = FILM_CAM.alone;
      const s = saulAt('saulAlone', t).pos;
      const g = H(s.x, s.z);
      out.pos.set(s.x + lerp(c.dx0, c.dx1, e), g + lerp(c.h0, c.h1, e), s.z + lerp(c.dz0, c.dz1, e));
      _a.set(s.x + 0.22, g + 0.98, s.z + 0.3); // the fist at his chest
      const hand = ctx?.saulHand?.(_c);
      if (hand) _a.lerp(hand, 0.7);
      _b.set(s.x + 0.05, g + 1.84, s.z);
      const eyes = ctx?.saulEyes?.(_c);
      if (eyes) _b.copy(eyes);
      out.look.copy(_a).lerp(_b, lerp(0.34, 0.52, ss(0.5, 1.5, t)));
      const w = ss(c.whipAt, 2.05, t);
      out.look.y += c.whip * w * w;
      out.fov = lerp(c.fov0, c.fov1, e) + 6 * w;
      out.roll = -0.05 * w;
      return true;
    }
  }
  return false;
}

/** push a lens position out of the soldiers' formation slots (front ranks) so it never enters a man */
function clearOfArmy(p: THREE.Vector3, shot: GilgalShotName, t: number, clear: number) {
  const a = armyAt(shot, t);
  for (let it = 0; it < 3; it++) {
    for (let rank = 0; rank < 7; rank++) {
      for (let file = 0; file < ARMY.files; file++) {
        armySlot(file, rank, a.frontX, a.part, 0.18, _c);
        const dx = p.x - _c.x, dz = p.z - _c.z;
        const d = Math.hypot(dx, dz);
        if (d < clear && d > 1e-4) {
          const k = (clear - d) / d;
          p.x += dx * k * 0.5;
          p.z += dz * k * 0.5;
        }
      }
    }
  }
}

/**
 * Depth-of-field target of a Gilgal take (the actors' eyes / hands where the cast exists). null = the set's own.
 */
export function gilgalFocus(take: string, t: number, H: (x: number, z: number) => number, ctx: GilgalCtx | undefined, out: THREE.Vector3): { point: THREE.Vector3; fStop: number } | null {
  switch (take) {
    case 'dustWall': {
      const a = armyAt('dustWall', t);
      const fx = a.frontX - ARMY.leadGap;
      return { point: out.set(fx + 0.5, H(fx, 3) + 1.6, roadZ(fx) + 4.5), fStop: 5.6 };
    }
    case 'king': {
      const eyes = ctx?.saulEyes?.(out);
      if (eyes) return { point: eyes, fStop: 2.8 };
      const s = saulAt('king', t).pos;
      return { point: out.set(s.x, H(s.x, s.z) + 1.85, s.z), fStop: 2.8 };
    }
    case 'spearRaised': {
      const eyes = ctx?.saulEyes?.(out);
      if (eyes) return { point: eyes, fStop: 4 };
      const s = saulAt('spearRaised', t).pos;
      return { point: out.set(s.x, H(s.x, s.z) + 1.85, s.z), fStop: 4 };
    }
    case 'silence': {
      // from the soldiers' heads near the lens to the old man as the ranks part
      const sam = samuelAt('silence', t).pos;
      const k = ss(0.55, 1.35, t);
      _a.set(SAUL_HALT.x - 4, H(SAUL_HALT.x - 4, 0) + 1.6, roadZ(SAUL_HALT.x));
      _b.set(sam.x, H(sam.x, sam.z) + 1.45, sam.z);
      return { point: out.copy(_a).lerp(_b, k), fStop: 4 };
    }
    case 'tear': {
      const sm = samuelAt('tear', t).pos;
      return { point: out.set(sm.x - 0.6, H(sm.x, sm.z) + 1.35, sm.z), fStop: 4 };
    }
    case 'tear:insert': {
      const hand = ctx?.saulHand?.(out);
      if (hand) return { point: hand, fStop: 2.2 };
      return { point: gripPoint(t, H, ctx, out), fStop: 2.2 };
    }
    case 'verdict': {
      const eyes = ctx?.samuelEyes?.(out);
      if (eyes) return { point: eyes, fStop: 2.0 };
      return { point: out.copy(SAMUEL.pos).setY(H(SAMUEL.pos.x, SAMUEL.pos.z) + 1.55), fStop: 2.0 };
    }
    case 'saulAlone': {
      const s = saulAt('saulAlone', t).pos;
      const g = H(s.x, s.z);
      _a.set(s.x + 0.22, g + 0.98, s.z + 0.3);
      const hand = ctx?.saulHand?.(_c);
      if (hand) _a.copy(hand);
      const eyes = ctx?.saulEyes?.(_b) ?? _b.set(s.x + 0.05, g + 1.84, s.z);
      return { point: out.copy(_a).lerp(eyes, ss(0.75, 1.3, t)), fStop: 2.0 };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------- land
/** What the land takes need from their set (kept structural: no import of the land modules here). */
export interface LandCamCtx {
  /** the set's own shot at its raw parameter e (the Judah flight curve) */
  shotAt?: (name: string, e: number) => { pos: THREE.Vector3; look: THREE.Vector3; fov?: number } | null;
  height: (x: number, z: number) => number;
  coast?: { heading: THREE.Vector3; columnHead: THREE.Vector3 };
  ramah?: { samuel: THREE.Vector3; elders: THREE.Vector3[] };
}

/** monotone cubic through (t, v) keys (Fritsch-Carlson) — the flight's speed ramp */
function monotone(keys: readonly [number, number][], t: number): number {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) {
    // keep drifting past the last key with the last slope (never a dead stop)
    const [t0, v0] = keys[n - 2], [t1, v1] = keys[n - 1];
    return v1 + ((v1 - v0) / (t1 - t0)) * 0.35 * (t - t1);
  }
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2] * 0.55);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
  const h = t1 - t0, s = (t - t0) / h;
  const h00 = 2 * s * s * s - 3 * s * s + 1, h10 = s * s * s - 2 * s * s + s, h01 = -2 * s * s * s + 3 * s * s, h11 = s * s * s - s * s;
  return h00 * v0 + h10 * h * m[i] + h01 * v1 + h11 * h * m[i + 1];
}

/**
 * Camera of a land take (u = normalised shot time, t = shot seconds). Returns false when the take is not one of
 * these (the set's own shot is used).
 */
export function landCam(take: string, u: number, t: number, ctx: LandCamCtx, out: ShotFrame): boolean {
  const e = smooth(u);
  out.roll = 0;
  if (take === 'flight' && ctx.shotAt) {
    // P1+P2 — ONE fast flight on the set's curve, re-timed: racing low over the sunlit deck (skim altitude), a bank
    // into the sun, the nose drops and it dives through the deck (~3.1-3.6 s), out over the Judean ridges in the
    // valley fog, still racing forward and banking into the light until the tableau settles
    const c = FILM_CAM.flight;
    const k = monotone(c.keys, t);
    const f = ctx.shotAt('flight', Math.min(1, k));
    if (!f) return false;
    out.pos.copy(f.pos);
    _a.copy(f.look).sub(f.pos).normalize(); // the set's heading at this point of the curve
    // skim: before the dive, stay low over the deck top (the cloud tops race past), then join the curve's descent
    const skim = c.deckTop + lerp(c.skim0, c.skim1, ss(0, c.diveAt, t));
    const dive = ss(c.diveAt, 3.35, t);
    out.pos.y = lerp(Math.min(out.pos.y, skim), out.pos.y, dive);
    // the nose: level over the deck, dropping through the dive, then back up toward the ridges and the sun
    const pitch = -0.035 - 0.2 * ss(c.diveAt - 0.3, 3.2, t) + 0.2 * ss(3.45, 4.7, t);
    const yaw = c.bankYaw * (ss(0.3, 2.2, t) - ss(3.4, 5.5, t)) + 0.05 * ss(5, 7.5, t);
    const horiz = Math.hypot(_a.x, _a.z);
    const baseYaw = Math.atan2(_a.x, _a.z), basePitch = Math.atan2(_a.y, horiz);
    const P = Math.max(-1.2, Math.min(0.4, basePitch * (1 - 0.6 * (1 - dive)) + pitch));
    const Y = baseYaw + yaw;
    out.look.set(out.pos.x + Math.sin(Y) * Math.cos(P) * 100, out.pos.y + Math.sin(P) * 100, out.pos.z + Math.cos(Y) * Math.cos(P) * 100);
    out.fov = (f.fov ?? 45) + 4 * (1 - ss(0, 3.4, t));
    // the bank: rolls into the turn toward the sun while racing, levels out through the dive, a last small bank
    out.roll = c.bank * (ss(0.2, 1.8, t) - ss(2.4, 3.6, t)) - 0.05 * ss(4.2, 6, t) + 0.02 * ss(6, 7.5, t);
    return true;
  }
  if (take === 'glint' && ctx.coast) {
    // P4 — a long lens, ahead of and beside the head of the marching column, looking back along it (the column
    // recedes diagonally into its dust: depth, not blocks); the lens tracks back against the march so the ranks slide
    // through the frame; the low morning sun behind the lens puts the glints on the bronze
    const c = FILM_CAM.coast;
    const hd = ctx.coast.heading;
    _a.set(-hd.z, 0, hd.x); // the column's left
    _b.copy(ctx.coast.columnHead).addScaledVector(hd, c.march * t); // the head now
    out.pos.copy(_b).addScaledVector(hd, lerp(c.ahead0, c.ahead1, e)).addScaledVector(_a, lerp(c.side0, c.side1, e));
    out.pos.y = ctx.height(out.pos.x, out.pos.z) + c.h;
    out.look.copy(_b).addScaledVector(hd, -c.lookBack);
    out.look.y = ctx.height(out.look.x, out.look.z) + c.lookH;
    out.fov = lerp(c.fov0, c.fov1, e);
    return true;
  }
  if (take === 'elders' && ctx.ramah && ctx.ramah.elders.length) {
    // P5 — behind the elders, the lens dollies in over their heads toward Samuel in the gateway (they fill the lower
    // third); Samuel on the right third of the frame
    const c = FILM_CAM.elders;
    const S = ctx.ramah.samuel;
    _c.set(0, 0, 0);
    for (const p of ctx.ramah.elders) _c.add(p);
    _c.multiplyScalar(1 / ctx.ramah.elders.length);
    _a.set(S.x - _c.x, 0, S.z - _c.z).normalize(); // toward Samuel
    _b.set(-_a.z, 0, _a.x); // the lens' right
    out.pos.copy(_c).addScaledVector(_a, -lerp(c.back0, c.back1, e)).addScaledVector(_b, lerp(c.side0, c.side1, e));
    out.pos.y = Math.max(ctx.height(out.pos.x, out.pos.z), _c.y) + lerp(c.h0, c.h1, e);
    out.look.copy(S).addScaledVector(_b, -c.lookSide);
    out.look.y = ctx.height(S.x, S.z) + c.lookH;
    out.fov = lerp(c.fov0, c.fov1, e);
    out.roll = 0.01 * Math.sin(u * 3);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------- handheld
/**
 * The handheld layer: smooth, deterministic noise of film time (seek-safe) — yaw / pitch / roll within about ±1,
 * dominant frequencies ~0.5-1.2 Hz (× `freq`).
 */
function shake(t: number, seed: number, freq = 1) {
  const s = seed * 1.713;
  const w = 2 * Math.PI * freq;
  const n = (f: number, p: number) => Math.sin(t * f * w + p);
  return {
    yaw: 0.55 * n(0.53, s) + 0.3 * n(1.17, s * 1.7 + 1) + 0.15 * n(2.31, s * 2.9 + 2),
    pitch: 0.5 * n(0.71, s * 1.3 + 3) + 0.32 * n(1.05, s * 2.1 + 4) + 0.18 * n(2.13, s * 0.7 + 5),
    roll: 0.6 * n(0.41, s * 0.9 + 6) + 0.4 * n(0.93, s * 1.9 + 7),
  };
}

/**
 * Apply a take's handheld layer (TAKE_LOOK) to a frame: `t` = shot seconds, `ft` = film seconds (the noise clock).
 * Long lenses get less angular noise (it is magnified by the lens).
 */
export function applyHandheld(take: string, t: number, ft: number, f: ShotFrame) {
  const L = TAKE_LOOK[take];
  if (!L) return;
  const lens = Math.max(0.3, Math.min(1.2, (f.fov ?? 40) / 34));
  let amp = THREE.MathUtils.degToRad(L.hand) * lens;
  const n = shake(ft, L.seed, L.freq ?? 1);
  let yaw = n.yaw * amp, pitch = n.pitch * amp, roll = n.roll * amp * 0.6;
  if (L.jolt !== undefined && t >= L.jolt) {
    // an impulse: a sharp kick decaying in ~0.4 s, with a fast wobble
    const dt = t - L.jolt;
    const k = Math.exp(-dt / 0.16) * THREE.MathUtils.degToRad(L.joltAmp ?? 1) * lens;
    pitch += k * (0.9 * Math.cos(dt * 38) + 0.3);
    yaw += k * 0.6 * Math.sin(dt * 31 + 0.5);
    roll += k * 0.5 * Math.sin(dt * 27);
    amp += k;
  }
  _a.copy(f.look).sub(f.pos);
  const dist = _a.length();
  if (dist < 1e-6) return;
  _a.multiplyScalar(1 / dist);
  // yaw about the world up, pitch about the lens' right axis
  _q.setFromAxisAngle(_up, yaw);
  _a.applyQuaternion(_q);
  _b.crossVectors(_a, _up);
  if (_b.lengthSq() > 1e-8) {
    _b.normalize();
    _q.setFromAxisAngle(_b, pitch);
    _a.applyQuaternion(_q);
  }
  f.look.copy(f.pos).addScaledVector(_a, dist);
  f.roll = (f.roll ?? 0) + roll;
}

/** exposure multiplier of a take (on top of the set's own) */
export function takeExposure(take: string): number {
  return TAKE_LOOK[take]?.exp ?? 1;
}

/** DoF focus of an orchestration take: which actor's eyes (kept for API compatibility with cut pass 2) */
export function gilgalCamFocusActor(take: string): 'saul' | 'samuel' | null {
  if (take === 'king' || take === 'spearRaised') return 'saul';
  if (take === 'verdict') return 'samuel';
  return null;
}
