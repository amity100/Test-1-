import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  AIMP,
  aimKillTool,
  CHAIN,
  chainArrival,
  COMPASS,
  crosshairTarget,
  facing,
  fitSnap,
  guarded,
  impactOutcome,
  inFrontOf,
  leadPos,
  leftOf,
  magnetTarget,
  nearSpot,
  noticeDelay,
  notices,
  pickSide,
  placeExit,
  pullSpot,
  rayCylinder,
  redClear,
  shieldCross,
  SIDES,
  snapSpot,
  spotFrame,
  standingBy,
  tapTarget,
  turnToward,
} from '../../src/game/aimportal';
import { AimMode, type AimHost, type AimInput } from '../../src/game/aimmode';
import { activeVariant, aimOn, LAB_OFFERED, onslaughtOn, reachOn, setLabActive, setVariant, VARIANTS } from '../../src/game/variant';
import { flowBodyOn, flowOn } from '../../src/game/flow';
import { precisionOn } from '../../src/game/precision';
import { RiftSystem } from '../../src/game/portals';
import { Game } from '../../src/game/game';
import { LabDirector, labTools } from '../../src/game/labdirector';
import { AIM_WAVES, labArena, labWaves } from '../../src/world/combatlab/layout';
import { CollisionWorld } from '../../src/world/collision';
import { strings } from '../../src/ui/i18n';
import { AIM_RULES } from '../../src/ui/labhud';
import { scenario, V } from '../enemies/fakes';
import { makePhysics, makeRifts, makeWorld, recorder, run } from './helpers';
import type { Enemy } from '../../src/actors/enemy';
import { LAW } from '../../src/core/contracts';

afterEach(() => {
  setVariant('current');
  setLabActive(false);
  vi.restoreAllMocks();
});

const flatWorld = () => {
  const w = new CollisionWorld();
  w.add(V(-60, -1, -60), V(60, 0, 60));
  return w;
};
const groundOf = (w: CollisionWorld) => (x: number, z: number, y: number) => w.groundAt(x, z, 0.3, y);

// ---------------------------------------------------------------------------
// Placing the exit: the crosshair is the cursor
// ---------------------------------------------------------------------------

describe('AIM PORTAL: where the exit opens', () => {
  const eye = V(0, 1.6, 0);

  it('on the first wall the crosshair meets: a hair off it, facing out, person-sized', () => {
    const w = flatWorld();
    w.add(V(-10, 0, 12), V(10, 6, 13));
    const s = placeExit(w, eye, V(0, 0, 1), eye, null, groundOf(w));
    expect(s.surface).toBe('wall');
    expect(s.ok).toBe(true);
    expect(s.pos.z).toBeCloseTo(12 - AIMP.off, 5);
    expect(s.normal.z).toBeCloseTo(-1, 5);
    expect(s.w).toBe(AIMP.w);
    expect(s.h).toBe(AIMP.h);
    // (a door in the wall: standing on the floor in front of it, the crosshair's height well inside it)
    expect(s.pos.y - s.h / 2).toBeCloseTo(0.02, 5);
    expect(1.6 - (s.pos.y - s.h / 2)).toBeGreaterThan(AIMP.fit.keep);
    expect(s.pos.y + s.h / 2 - 1.6).toBeGreaterThan(AIMP.fit.keep);
    expect(s.dist).toBeCloseTo(12, 2);
    // aimed higher than its height: centred on the crosshair (a drop out of it)
    const hi = placeExit(w, eye, V(0, 3.4 - 1.6, 12).normalize(), eye, null, groundOf(w));
    expect(hi.surface).toBe('wall');
    expect(hi.pos.y).toBeCloseTo(3.4, 1);
  });

  it('on the floor: a horizontal disc, looking up, a hair over it', () => {
    const w = flatWorld();
    const s = placeExit(w, eye, V(0, -1.6, 10).normalize(), eye, null, groundOf(w));
    expect(s.surface).toBe('floor');
    expect(s.normal.y).toBe(1);
    expect(s.pos.y).toBeCloseTo(AIMP.off, 5);
    expect(s.pos.z).toBeCloseTo(10, 1);
    expect(s.w).toBe(AIMP.flat);
    expect(s.h).toBe(AIMP.flat);
  });

  it('on a ceiling: a disc looking down', () => {
    const w = flatWorld();
    w.add(V(-20, 5, -20), V(20, 6, 20));
    const s = placeExit(w, eye, V(0, 1, 0.3).normalize(), eye, null, groundOf(w));
    expect(s.surface).toBe('ceiling');
    expect(s.normal.y).toBe(-1);
    expect(s.pos.y).toBeCloseTo(5 - AIMP.off, 5);
  });

  it('nothing within 30 m: mid-air at 12 m (the default), facing you; the wheel sets it between 3 and 30; it never rests in the floor', () => {
    const w = flatWorld();
    const dir = V(0, 0.2, 1).normalize();
    const def = placeExit(w, eye, dir, eye, null, groundOf(w));
    expect(def.surface).toBe('air');
    expect(def.dist).toBeCloseTo(AIMP.air.def, 5);
    expect(def.normal.z).toBeCloseTo(-1, 5);
    expect(placeExit(w, eye, dir, eye, 7, groundOf(w)).dist).toBeCloseTo(7, 5);
    // clamped
    expect(placeExit(w, eye, dir, eye, 1, groundOf(w)).dist).toBeCloseTo(AIMP.air.min, 5);
    expect(placeExit(w, eye, dir, eye, 99, groundOf(w)).dist).toBeCloseTo(AIMP.air.max, 5);
    // (low in the air it stands on the floor, never in it)
    const low = placeExit(w, eye, V(0, -0.02, 1).normalize(), eye, 12, groundOf(w));
    expect(low.pos.y - AIMP.h / 2).toBeGreaterThanOrEqual(-0.001);
  });

  it('a wheel distance (set) stops a farther wall short: mid-air there; unset, the wall wins', () => {
    const w = flatWorld();
    w.add(V(-10, 0, 20), V(10, 6, 21));
    const dir = V(0, 0.05, 1).normalize();
    expect(placeExit(w, eye, dir, eye, null, groundOf(w)).surface).toBe('wall');
    const air = placeExit(w, eye, dir, eye, 9, groundOf(w));
    expect(air.surface).toBe('air');
    expect(air.dist).toBeCloseTo(9, 5);
  });

  it('distances count from your eyes though the ray starts at the camera', () => {
    const w = flatWorld();
    const cam = V(0, 2.2, -3);
    const s = placeExit(w, cam, V(0, 0, 1), eye, 12, groundOf(w));
    expect(s.dist).toBeCloseTo(12, 1);
    expect(s.pos.z).toBeCloseTo(12, 1);
  });

  it('a sealed panel refuses; a surface too close to you refuses', () => {
    const w = flatWorld();
    w.add(V(-10, 0, 12), V(10, 6, 13), { noPortal: true });
    const s = placeExit(w, eye, V(0, 0, 1), eye, null, groundOf(w));
    expect(s.ok).toBe(false);
    expect(s.reason).toBe('sealed');
    const w2 = flatWorld();
    w2.add(V(-10, 0, 1), V(10, 6, 2));
    const c = placeExit(w2, eye, V(0, 0, 1), eye, null, groundOf(w2));
    expect(c.ok).toBe(false);
    expect(c.reason).toBe('close');
  });

  it('the near twin: about 1 m ahead of your chest on the crosshair, facing you, standing on your floor; the crosshair always inside it with margin, your body line too', () => {
    const w = flatWorld();
    const chest = V(0, 1.08, 0);
    // the camera 3.1 m back over your right shoulder (yaw 0: your right is -x), looking ahead
    const ray = { origin: V(-0.62, 1.6, -3.1), dir: V(0, 0, 1) };
    const s = nearSpot(w, chest, ray, 0, groundOf(w));
    expect(s.pos.z).toBeCloseTo(AIMP.near.ahead, 5);
    expect(AIMP.near.ahead).toBeGreaterThanOrEqual(0.9);
    expect(AIMP.near.ahead).toBeLessThanOrEqual(1.1);
    expect(s.normal.z).toBe(-1);
    expect(s.w).toBeGreaterThanOrEqual(1.3);
    expect(s.h).toBeGreaterThanOrEqual(2.1);
    // across: toward the crosshair (x -0.62 there), as far as your body line (x 0) stays inside
    const cross = V(-0.62, 1.6, AIMP.near.ahead);
    expect(Math.abs(cross.x - s.pos.x)).toBeLessThanOrEqual(s.w / 2 - AIMP.near.margin + 1e-6);
    expect(Math.abs(0 - s.pos.x)).toBeLessThanOrEqual(s.w / 2 - AIMP.near.body + 1e-6);
    expect(s.pos.x).toBeLessThan(-0.3);
    // up: on the crosshair (1.6 m) as far as it may float off your floor; your middle (0.9 m) inside it: one step takes you in
    expect(s.pos.y).toBeCloseTo(cross.y, 5);
    expect(s.pos.y - s.h / 2).toBeGreaterThanOrEqual(0.02 - 1e-6);
    expect(s.pos.y - s.h / 2).toBeLessThanOrEqual(0.02 + AIMP.near.float + 1e-6);
    expect(s.pos.y - s.h / 2).toBeLessThan(0.9 - 0.2);
    // looking down: it stands on your floor
    const down = nearSpot(w, chest, { origin: ray.origin, dir: V(0, -0.2, 1).normalize() }, 0, groundOf(w));
    expect(down.pos.y - down.h / 2).toBeCloseTo(0.02, 5);
    // looking up at a man on a tower: it rises with the crosshair so the crosshair stays inside it
    const upDir = V(0, 0.45, 1).normalize();
    const up = nearSpot(w, chest, { origin: ray.origin, dir: upDir }, 0, groundOf(w));
    const k = (AIMP.near.ahead + 3.1) / upDir.z;
    const crossUp = ray.origin.clone().addScaledVector(upDir, k);
    expect(Math.abs(crossUp.y - up.pos.y)).toBeLessThanOrEqual(up.h / 2 - AIMP.near.margin + 1e-6);
    expect(up.pos.y).toBeGreaterThan(s.pos.y);
    // a sprint at it: a little further, never past its max
    const run = nearSpot(w, chest, ray, 9, groundOf(w));
    expect(run.pos.z).toBeGreaterThan(AIMP.near.ahead);
    expect(run.pos.z).toBeLessThanOrEqual(AIMP.near.max + 1e-6);
    // a wall in the way: in front of it
    w.add(V(-5, 0, 1.2), V(5, 4, 2.5));
    const tight = nearSpot(w, chest, ray, 0, groundOf(w));
    expect(tight.pos.z).toBeLessThan(1.2);
    expect(tight.pos.z).toBeGreaterThanOrEqual(0.6);
  });

  it('a spot becomes a rift frame: its front is the spot’s normal, its size the spot’s', () => {
    const w = flatWorld();
    const s = placeExit(w, V(0, 1.6, 0), V(0, -1.6, 10).normalize(), V(0, 1.6, 0), null, groundOf(w));
    const f = spotFrame(s);
    expect(new THREE.Vector3(0, 0, 1).applyQuaternion(f.quaternion).y).toBeCloseTo(1, 5);
    expect(f.kind).toBe('floor');
    expect(f.width).toBe(AIMP.flat);
    const wall = placeExit(flatWallWorld(), V(0, 1.6, 0), V(0, 0, 1), V(0, 1.6, 0), null, groundOf(flatWorld()));
    const fw = spotFrame(wall);
    expect(new THREE.Vector3(0, 0, 1).applyQuaternion(fw.quaternion).z).toBeCloseTo(-1, 5);
    expect(fw.kind).toBe('wall');
  });
});

function flatWallWorld() {
  const w = flatWorld();
  w.add(V(-10, 0, 12), V(10, 6, 13));
  return w;
}

// ---------------------------------------------------------------------------
// Precision: every portal fits where it opens (the compound's walls, doors, windows, slits, perches)
// ---------------------------------------------------------------------------

/** Points of a spot's face (rim and middle), `ahead` m out of its front. */
function facePoints(s: { pos: THREE.Vector3; normal: THREE.Vector3; hdir: THREE.Vector3; w: number; h: number }, ahead = 0) {
  const n = s.normal;
  const up = Math.abs(n.y) > 0.9 ? V(s.hdir.x, 0, s.hdir.z).normalize() : V(0, 1, 0);
  const r = new THREE.Vector3().crossVectors(up, n).normalize();
  const out = [s.pos.clone().addScaledVector(n, ahead)];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    out.push(s.pos.clone().addScaledVector(r, (Math.cos(a) * s.w * 0.97) / 2).addScaledVector(up, (Math.sin(a) * s.h * 0.97) / 2).addScaledVector(n, ahead));
  }
  return out;
}
const inWorld = (w: CollisionWorld, p: THREE.Vector3) => w.overlapsCylinder(p.x, p.z, 0.002, p.y - 0.002, p.y + 0.002);
/** Nothing of the world in the spot's face. */
const faceClear = (w: CollisionWorld, s: Parameters<typeof facePoints>[0]) => facePoints(s).every((p) => !inWorld(w, p));
/** Every point of a surface spot's face has its surface right behind it (AIMP.off away, give or take 2 cm). */
const faceOnSurface = (w: CollisionWorld, s: Parameters<typeof facePoints>[0]) =>
  facePoints(s).every((p) => {
    const hit = w.raycast(p.clone().addScaledVector(s.normal, 0.2), s.normal.clone().negate(), 0.5);
    return !!hit && Math.abs(hit.distance - 0.2 - AIMP.off) < 0.02;
  });

describe('AIM PORTAL: every portal fits where it opens', () => {
  const eye = V(0, 1.6, 0);
  /** A wall across z = 10 (its face at 10), from x0 to x1, h high; a window in it from wx0 to wx1 (sill 0.9, head 2.0). */
  const court = (o: { x0?: number; x1?: number; h?: number; win?: [number, number]; door?: [number, number] } = {}) => {
    const w = flatWorld();
    const x0 = o.x0 ?? -10, x1 = o.x1 ?? 10, h = o.h ?? 4;
    const cuts = [o.win, o.door].filter(Boolean).sort((a, b) => a![0] - b![0]) as [number, number][];
    let a = x0;
    for (const [c0, c1] of cuts) {
      w.add(V(a, 0, 10), V(c0, h, 10.5));
      if (o.win && c0 === o.win[0]) {
        w.add(V(c0, 0, 10), V(c1, 0.9, 10.5), { tag: 'sill' });
        w.add(V(c0, 2.0, 10), V(c1, h, 10.5));
      } else w.add(V(c0, 2.8, 10), V(c1, h, 10.5));
      a = c1;
    }
    w.add(V(a, 0, 10), V(x1, h, 10.5));
    return w;
  };
  const aimAt = (p: THREE.Vector3, from = eye) => p.clone().sub(from).normalize();

  it('a wall: a door in it, standing on the floor in front of it, wholly on the wall, the crosshair inside it', () => {
    const w = court();
    for (const y of [0.5, 1.2, 1.9, 2.4]) {
      const s = placeExit(w, eye, aimAt(V(1, y, 10)), eye, null, groundOf(w));
      expect(s.ok).toBe(true);
      expect(s.surface).toBe('wall');
      expect(s.pos.y - s.h / 2).toBeCloseTo(0.02, 5);
      expect(Math.abs(s.pos.x - 1)).toBeLessThanOrEqual(s.w / 2 - AIMP.fit.keep + 1e-6);
      expect(faceOnSurface(w, s)).toBe(true);
    }
    // aimed well over its height: it hangs on the crosshair (a drop out of it), still wholly on the wall
    const hi = placeExit(w, eye, aimAt(V(1, 3.0, 10)), eye, null, groundOf(w));
    expect(hi.pos.y - hi.h / 2).toBeGreaterThan(0.5);
    expect(hi.pos.y + hi.h / 2).toBeLessThanOrEqual(4 + 1e-6);
    expect(faceOnSurface(w, hi)).toBe(true);
  });

  it('by the end of a wall, an opening or an inside corner it slides along the wall (never over the edge), the crosshair still in it', () => {
    // the end of the wall at x = 2
    const end = court({ x1: 2 });
    const s = placeExit(end, eye, aimAt(V(1.8, 1.2, 10)), eye, null, groundOf(end));
    expect(s.ok && s.surface).toBe('wall');
    expect(s.pos.x + s.w / 2).toBeLessThanOrEqual(2 + 1e-3);
    expect(Math.abs(s.pos.x - 1.8)).toBeLessThanOrEqual(s.w / 2 - AIMP.fit.keep + 1e-6);
    expect(faceOnSurface(end, s)).toBe(true);
    // a window at x 2..3.4: not half over it
    const win = court({ win: [2, 3.4] });
    const sw = placeExit(win, eye, aimAt(V(1.8, 1.2, 10)), eye, null, groundOf(win));
    expect(sw.surface).toBe('wall');
    expect(sw.pos.x + sw.w / 2).toBeLessThanOrEqual(2 + 1e-3);
    expect(faceOnSurface(win, sw)).toBe(true);
    // an inside corner: a wall coming out of it at x = 2 (toward you)
    const corner = court();
    corner.add(V(2, 0, 6), V(2.5, 4, 10));
    const sc = placeExit(corner, eye, aimAt(V(1.8, 1.2, 10)), eye, null, groundOf(corner));
    expect(sc.surface).toBe('wall');
    expect(sc.pos.x + sc.w / 2).toBeLessThanOrEqual(2 + 1e-3);
    expect(faceClear(corner, sc)).toBe(true);
    expect(sc.dist).toBeCloseTo(10, 0);
  });

  it('a face too small for it (a low wall, a sill, a pillar, a stub between a window and a door): it stands upright on the floor right in front of it', () => {
    const cases: [string, CollisionWorld, THREE.Vector3][] = [];
    const low = flatWorld();
    low.add(V(-3, 0, 10), V(3, 1.2, 10.5));
    cases.push(['low wall', low, V(0, 0.7, 10)]);
    const pillar = flatWorld();
    pillar.add(V(-0.5, 0, 10), V(0.5, 3.8, 11));
    cases.push(['pillar', pillar, V(0.2, 1.5, 10)]);
    const stub = court({ win: [-2.4, -1], door: [-0.5, 2.5] });
    cases.push(['stub', stub, V(-0.75, 1.2, 10)]);
    const sill = court({ win: [-0.7, 0.7] });
    cases.push(['sill', sill, V(0, 0.6, 10)]);
    for (const [what, w, p] of cases) {
      const s = placeExit(w, eye, aimAt(p), eye, null, groundOf(w));
      expect(s.ok, what).toBe(true);
      expect(s.surface, what).toBe('stand');
      expect(s.normal.z, what).toBeCloseTo(-1, 5);
      expect(s.pos.y - s.h / 2, what).toBeCloseTo(0.02, 5);
      // in front of the face, a hair off it, nothing of the world in it
      expect(10 - s.pos.z, what).toBeGreaterThanOrEqual(AIMP.off + AIMP.fit.standOff - 1e-6);
      expect(faceClear(w, s), what).toBe(true);
      // across: on the crosshair
      expect(Math.abs(s.pos.x - p.x), what).toBeLessThanOrEqual(s.w / 2 - AIMP.fit.keep + 1e-6);
    }
  });

  it('through a window at the floor beyond: there, not on the frame; on its sill or its jamb: never a portal hanging off it', () => {
    const w = court({ win: [-0.7, 0.7] });
    // (the floor 5.5 m past the window, seen through it from 3 m in front of it)
    const by = V(0, 1.6, 7);
    const beyond = placeExit(w, by, aimAt(V(0, 0, 16), by), by, null, groundOf(w));
    expect(beyond.ok).toBe(true);
    expect(beyond.surface).toBe('floor');
    expect(beyond.pos.z).toBeGreaterThan(10.5 + AIMP.flat / 2 - 1e-3);
    expect(faceOnSurface(w, beyond)).toBe(true);
    // the crosshair on the sill's top (0.5 m deep: no room for a disc), and on the jamb (the side of the opening)
    for (const p of [V(0, 0.9, 10.25), V(0.7, 1.4, 10.3)]) {
      const s = placeExit(w, V(-2, 1.6, 4), aimAt(p, V(-2, 1.6, 4)), V(-2, 1.6, 4), null, groundOf(w));
      expect(s.ok).toBe(true);
      expect(faceClear(w, s)).toBe(true);
      if (s.surface === 'wall' || s.surface === 'floor') expect(faceOnSurface(w, s)).toBe(true);
    }
  });

  it('a floor disc by a wall slides off it; on a stair it stands upright; never on a wall top you would fall off', () => {
    const w = court();
    const s = placeExit(w, eye, aimAt(V(1, 0, 9.7)), eye, null, groundOf(w));
    expect(s.surface).toBe('floor');
    expect(s.pos.z + s.w / 2).toBeLessThanOrEqual(10 + 1e-3);
    expect(faceClear(w, s)).toBe(true);
    expect(faceOnSurface(w, s)).toBe(true);
    // a flight of stairs (0.25 m steps, 0.5 m deep) climbing away from you
    const st = flatWorld();
    for (let k = 0; k < 8; k++) st.add(V(-1.25, 0, 6 + k * 0.5), V(1.25, (k + 1) * 0.25, 10));
    const on = placeExit(st, eye, aimAt(V(0, 0.75, 7.25)), eye, null, groundOf(st));
    expect(on.ok).toBe(true);
    expect(on.surface).toBe('stand');
    expect(faceClear(st, on)).toBe(true);
    // from a perch, the top of a 0.5 m wall: no portal stands on it
    const top = court({ h: 3 });
    const perch = V(0, 4.8, 6);
    const t = placeExit(top, perch, aimAt(V(0.2, 3, 10.25), perch), perch, null, groundOf(top));
    if (t.ok) expect(t.pos.y - t.h / 2).toBeLessThan(2.9);
  });

  it('a ledge right by you that you look over (a parapet’s top) does not stop the crosshair', () => {
    const w = flatWorld();
    // a perch: you on it at y 3.2, a parapet 1.2 m tall 0.7 m in front of you
    w.add(V(-5, 0, -5), V(5, 3.2, 1.0));
    w.add(V(-5, 3.2, 0.7), V(5, 4.4, 1.0));
    const me = V(0, 4.8, 0), cam = V(0, 5.6, -2.6);
    // (the crosshair just over the parapet's top, by its far edge)
    const dir = aimAt(V(0, 4.395, 0.97), cam);
    const first = w.raycast(cam, dir, 40)!;
    expect(first.normal.y).toBeCloseTo(1, 5);
    expect(first.distance - me.distanceTo(cam)).toBeLessThan(AIMP.minDist);
    const s = placeExit(w, cam, dir, me, null, groundOf(w));
    expect(s.reason).not.toBe('close');
    expect(s.ok).toBe(true);
    expect(s.pos.y).toBeLessThan(0.2);
  });

  it('nothing fits there: refused (NO ROOM), not a portal in the world', () => {
    // a 0.8 m slot of floor between two tall walls
    const w = flatWorld();
    w.add(V(-6, 0, 8), V(-0.4, 5, 14));
    w.add(V(0.4, 0, 8), V(6, 5, 14));
    w.add(V(-0.4, 0, 14), V(0.4, 5, 14.5));
    const s = placeExit(w, V(0, 6, 4), aimAt(V(0, 0, 11), V(0, 6, 4)), V(0, 6, 4), null, groundOf(w));
    if (!s.ok) expect(s.reason).toBe('fit');
    else expect(faceClear(w, s)).toBe(true);
    expect(strings('en')['aim.fit']).toBeTruthy();
    expect(strings('he')['aim.fit']).not.toBe(strings('en')['aim.fit']);
  });

  it('by a man near a wall: on his side of it, in sight of him, nothing of the world in its face (an inside corner, a doorway, his back to a wall)', () => {
    const w = flatWorld();
    // a room's corner: walls along z = 10 and x = 5; a doorway in the x = -5 wall
    w.add(V(-10, 0, 10), V(10, 4, 10.5));
    w.add(V(5, 0, -10), V(5.5, 4, 10));
    w.add(V(-5.5, 0, -10), V(-5, 4, 2));
    w.add(V(-5.5, 0, 5), V(-5, 4, 10));
    w.add(V(-5.5, 2.8, 2), V(-5, 4, 5));
    const views = [V(0, 0, 1), V(1, 0, 0.4).normalize(), V(-1, 0, 0.3).normalize(), V(0.6, 0, 1).normalize()];
    const men = [V(4.3, 0, 9.3), V(4.4, 0, 7), V(0, 0, 9.2), V(-4.4, 0, 3.5), V(-4.6, 0, 6), V(2, 0, 8.8)];
    let n = 0;
    for (const m of men) {
      for (const view of views) {
        for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
          for (const side of ['behind', 'left', 'right'] as const) {
            const e = { pos: m, yaw, height: 1.8 };
            const s = fitSnap(w, e, side, 0, view);
            if (!s.ok) continue;
            n++;
            const where = `${side} of (${m.x}, ${m.z}) yaw ${yaw.toFixed(2)}`;
            expect(faceClear(w, s), where).toBe(true);
            // from a hand in front of its middle to his chest: nothing between (never across a wall from him)
            const from = s.pos.clone().addScaledVector(s.normal, 0.15);
            from.y = Math.min(from.y, 1.08);
            expect(w.lineOfSight(from, V(m.x, 1.08, m.z)), where).toBe(true);
            // it looks at him (within the turn it may take), standing on his floor, by him
            expect(s.pos.y - s.h / 2, where).toBeCloseTo(0.02, 5);
            expect(Math.hypot(s.pos.x - m.x, s.pos.z - m.z), where).toBeLessThanOrEqual(AIMP.magnet.dist + AIMP.magnet.slide + 0.05);
            expect(V(m.x - s.pos.x, 0, m.z - s.pos.z).normalize().dot(s.normal), where).toBeGreaterThan(0.2);
          }
        }
      }
    }
    expect(n).toBeGreaterThan(80);
  });

  it('his back to a wall: no room behind him (square to the wall) refuses BEHIND; at a slant it never squeezes him against it', () => {
    const w = flatWorld();
    w.add(V(-10, 0, 10), V(10, 4, 10.5));
    // 0.6 m off the wall, he faces you: nothing behind him, not even turned
    expect(fitSnap(w, { pos: V(0, 0, 9.4), yaw: Math.PI, height: 1.8 }, 'behind', 0, V(0, 0, 1)).ok).toBe(false);
    // 1.2 m off: on the wall behind him, a door in it on his floor
    const s = fitSnap(w, { pos: V(0, 0, 8.8), yaw: Math.PI, height: 1.8 }, 'behind', 0, V(0, 0, 1));
    expect(s.ok && s.surface).toBe('wall');
    expect(s.pos.z).toBeCloseTo(10 - AIMP.off, 5);
    expect(10 - 8.8).toBeGreaterThanOrEqual(AIMP.magnet.tight);
  });

  it('ABOVE a man by a wall slides off it (the disc never cuts the wall); BELOW him by a wall too', () => {
    const w = flatWorld();
    w.add(V(-10, 0, 10), V(10, 4, 10.5));
    const e = { pos: V(0, 0, 9.6), yaw: 0, height: 1.8 };
    const up = fitSnap(w, e, 'above', 0, V(0, 0, 1));
    expect(up.ok).toBe(true);
    expect(up.pos.z + up.w / 2).toBeLessThanOrEqual(10 + 1e-3);
    expect(faceClear(w, up)).toBe(true);
    const down = fitSnap(w, e, 'below', 0, V(0, 0, 1));
    expect(down.ok).toBe(true);
    expect(down.pos.z + down.w / 2).toBeLessThanOrEqual(10 + 1e-3);
    // (he is still over it: he drops through)
    expect(Math.hypot(down.pos.x - e.pos.x, down.pos.z - e.pos.z)).toBeLessThanOrEqual(down.w / 2 - AIMP.fit.keep + 1e-6);
  });

  it('the near twin against a wall (a window in it, the crosshair through the window): in front of the wall, never in it; walk at it and you go through', () => {
    const w = court({ win: [-0.7, 0.7] });
    w.add(V(-60, -1, -60), V(60, 0, 60));
    const chest = V(0, 1.08, 9.3);
    const ray = { origin: V(-0.62, 1.7, 6.3), dir: aimAt(V(0, 1.2, 14), V(-0.62, 1.7, 6.3)) };
    const s = nearSpot(w, chest, ray, 0, groundOf(w));
    expect(s.pos.z).toBeLessThanOrEqual(10 - AIMP.near.gap + 1e-6);
    expect(s.pos.z - chest.z).toBeGreaterThanOrEqual(AIMP.near.min - 1e-6);
    expect(faceClear(w, s)).toBe(true);
    // a body walking at it goes in (the wall right behind it does not stop it)
    const rifts = makeRifts(w);
    const phys = makePhysics(w, rifts);
    const ev = recorder();
    const far = { pos: V(20, 1.07, 0), normal: V(-1, 0, 0), hdir: V(0, 0, 1), surface: 'wall' as const, w: AIMP.w, h: AIMP.h };
    const id = rifts.openStrike(spotFrame(s, 'stand'), spotFrame(far), 6);
    (rifts.strikeEnds(id)!.a as { pass?: number }).pass = AIMP.near.pass;
    rifts.update(0.3, 0.3, 0.3);
    const b = phys.createBody('prop', { pos: V(s.pos.x, 0.02, 9.0), radius: 0.34, height: 1.8, simulate: false });
    b.vel.set(0, 0, 4);
    run(phys, ev, 0.8);
    expect(ev.log.crossed.length).toBe(1);
    // without the pass a wall that close holds him off (what the pass is for)
    const rifts2 = makeRifts(w);
    const phys2 = makePhysics(w, rifts2);
    const ev2 = recorder();
    rifts2.openStrike(spotFrame(s, 'stand'), spotFrame(far), 6);
    rifts2.update(0.3, 0.3, 0.3);
    const b2 = phys2.createBody('prop', { pos: V(s.pos.x, 0.02, 9.0), radius: 0.34, height: 1.8, simulate: false });
    b2.vel.set(0, 0, 4);
    run(phys2, ev2, 0.8);
    expect(10 - s.pos.z).toBeLessThan(0.34);
    expect(ev2.log.crossed.length).toBe(0);
  });

  it('a near twin raised over a parapet in front of you (from a perch): a body walking at it goes in, not held off by the parapet', () => {
    const w = flatWorld();
    w.add(V(-5, 0, -5), V(5, 3.2, 0.9));
    w.add(V(-5, 3.2, 0.6), V(5, 4.4, 0.9));
    const rifts = makeRifts(w);
    const phys = makePhysics(w, rifts);
    const ev = recorder();
    const near = { pos: V(0, 4.82, 0.55), normal: V(0, 0, -1), hdir: V(0, 0, 1), surface: 'stand' as const, w: AIMP.w, h: AIMP.h };
    const far = { pos: V(20, 1.07, 10), normal: V(-1, 0, 0), hdir: V(0, 0, 1), surface: 'wall' as const, w: AIMP.w, h: AIMP.h };
    const id = rifts.openStrike(spotFrame(near, 'stand'), spotFrame(far), 6);
    (rifts.strikeEnds(id)!.a as { pass?: number }).pass = AIMP.near.pass;
    rifts.update(0.3, 0.3, 0.3);
    const b = phys.createBody('prop', { pos: V(0, 3.22, 0.1), radius: 0.34, height: 1.8, simulate: false });
    b.vel.set(0, 0, 4);
    run(phys, ev, 0.6);
    expect(ev.log.crossed.length).toBe(1);
  });

  it('the near twin in a doorway (a jamb at your side) or by a low wall in your way: its face clear of them, the crosshair in it', () => {
    const w = flatWorld();
    // a door 3 m wide in a wall at z = 1: you stand in it by its east jamb (x 1.5), aiming north-east past it
    w.add(V(-10, 0, 0.75), V(-1.5, 4, 1.25));
    w.add(V(1.5, 0, 0.75), V(10, 4, 1.25));
    const chest = V(1.0, 1.08, 1.0);
    const dir = V(0.5, -0.05, 1).normalize();
    const ray = { origin: chest.clone().add(V(-0.62, 0.6, -2.9)), dir };
    const s = nearSpot(w, chest, ray, 0, groundOf(w));
    expect(faceClear(w, s)).toBe(true);
    // a low wall right in front of you, the crosshair over it: it stands over it, the crosshair inside it
    const lw = flatWorld();
    lw.add(V(-3, 0, 0.55), V(3, 1.2, 1.0));
    const r2 = { origin: V(-0.62, 1.9, -2.9), dir: V(0, -0.02, 1).normalize() };
    const s2 = nearSpot(lw, V(0, 1.08, 0), r2, 0, groundOf(lw));
    expect(faceClear(lw, s2)).toBe(true);
    const k = (s2.pos.z - r2.origin.z) / r2.dir.z;
    const cross = r2.origin.clone().addScaledVector(r2.dir, k);
    expect(Math.abs(cross.y - s2.pos.y)).toBeLessThanOrEqual(s2.h / 2 - AIMP.near.margin + 1e-6);
  });

  it('their red portals never stand half in a wall', () => {
    const w = flatWorld();
    w.add(V(-10, 0, 10), V(10, 4, 10.5));
    // facing you (south), its oval 0.4 m from the wall's face: clear; turned side-on, its edge in the wall: not
    expect(redClear(w, V(0, 0, 9.6), Math.PI)).toBe(true);
    expect(redClear(w, V(0, 0, 9.6), Math.PI / 2)).toBe(false);
    expect(redClear(w, V(0, 0, 9.99), Math.PI)).toBe(false);
  });
});

describe('AIM PORTAL: the magnet', () => {
  const o = V(0, 1.6, 0);
  const kbm = THREE.MathUtils.degToRad(AIMP.magnet.deg.kbm);
  it('two men side by side: the one nearest the crosshair (by angle), not the nearer one; the one it is on keeps it until the other is clearly nearer (no flicker)', () => {
    const a = { id: 1, pos: V(-0.45, 0, 10), height: 1.8, radius: 0.42 };
    const b = { id: 2, pos: V(0.45, 0, 10), height: 1.8, radius: 0.42 };
    const at = (x: number, prev: typeof a | null = null) => magnetTarget(o, V(x, 1.2 - 1.6, 10).normalize(), [a, b], kbm, () => false, AIMP.magnet.range, prev);
    expect(at(-0.3)?.id).toBe(1);
    expect(at(0.3)?.id).toBe(2);
    // a nearer man 1 m to the side vs. a far one right under the crosshair: the far one
    const near = { id: 3, pos: V(1.0, 0, 6), height: 1.8, radius: 0.42 };
    const far = { id: 4, pos: V(0.05, 0, 20), height: 1.8, radius: 0.42 };
    expect(magnetTarget(o, V(0, 0, 1), [near, far], kbm, () => false)?.id).toBe(4);
    // the crosshair wobbling round the middle (a hand's jitter of ±0.08 m at 10 m): it stays on the one it was on
    let cur: typeof a | null = at(-0.3);
    let changes = 0;
    for (let i = 0; i < 60; i++) {
      const x = 0.03 + (i % 2 ? 0.08 : -0.08);
      const next = at(x, cur);
      if (next !== cur) changes++;
      cur = next;
    }
    expect(changes).toBe(0);
    // swept on past the middle: it goes over to the other once (and only once)
    let swaps = 0;
    cur = at(-0.6);
    for (let x = -0.6; x <= 0.6; x += 0.02) {
      const next = at(x, cur);
      if (next !== cur) swaps++;
      cur = next;
    }
    expect(swaps).toBe(1);
    expect(cur?.id).toBe(2);
  });

  it('a man behind a wall is never grabbed; one seen through a window is', () => {
    const w = flatWorld();
    // a wall at z 5 with a window (x -1..1, y 0.9..2.0)
    w.add(V(-10, 0, 5), V(-1, 4, 5.5));
    w.add(V(1, 0, 5), V(10, 4, 5.5));
    w.add(V(-1, 0, 5), V(1, 0.9, 5.5));
    w.add(V(-1, 2.0, 5), V(1, 4, 5.5));
    const blocked = (p: THREE.Vector3Like, q: THREE.Vector3Like) => !w.lineOfSight(p as THREE.Vector3, q as THREE.Vector3);
    const hidden = { id: 1, pos: V(3, 0, 9), height: 1.8, radius: 0.42 };
    const seen = { id: 2, pos: V(0, 0, 9), height: 1.8, radius: 0.42 };
    expect(magnetTarget(o, V(3, 1.2 - 1.6, 9).normalize(), [hidden], THREE.MathUtils.degToRad(AIMP.magnet.deg.touch), blocked)).toBeNull();
    expect(magnetTarget(o, V(0, 1.2 - 1.6, 9).normalize(), [seen], kbm, blocked)?.id).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Next to a man: the side, as you see him
// ---------------------------------------------------------------------------

describe('AIM PORTAL: next to a man', () => {
  const man = { pos: V(10, 0, 10), yaw: Math.PI / 2, height: 1.8 };

  it('a flick picks the side: nothing much is BEHIND him; up ABOVE, down BELOW, left LEFT, right RIGHT; the upper diagonals BEHIND, the lower FRONT', () => {
    expect(pickSide(0, 0)).toBe('behind');
    expect(pickSide(0.1, 0.1)).toBe('behind');
    expect(pickSide(0, 1)).toBe('above');
    expect(pickSide(0, -1)).toBe('below');
    expect(pickSide(1, 0)).toBe('right');
    expect(pickSide(-1, 0)).toBe('left');
    expect(pickSide(1, 0.15)).toBe('right');
    expect(pickSide(0.7, 0.7)).toBe('behind');
    expect(pickSide(-0.7, 0.7)).toBe('behind');
    expect(pickSide(0.7, -0.7)).toBe('front');
    expect(pickSide(-0.7, -0.7)).toBe('front');
    expect(new Set(COMPASS)).toEqual(new Set(SIDES));
  });

  it('the sides are as you see him: BEHIND the far side (his back when he faces you), RIGHT / LEFT as your screen has them; 1.3 m off, standing on his floor, fronts toward him', () => {
    // you at x 0 looking +x at him; he faces you (-x)
    const view = V(1, 0, 0);
    const him = { ...man, yaw: -Math.PI / 2 };
    const b = snapSpot(him, 'behind', 0, AIMP.magnet.dist, view);
    expect(b.pos.x).toBeCloseTo(10 + AIMP.magnet.dist, 5);
    expect(b.normal.x).toBeCloseTo(-1, 5);
    const fr = snapSpot(him, 'front', 0, AIMP.magnet.dist, view);
    expect(fr.pos.x).toBeCloseTo(10 - AIMP.magnet.dist, 5);
    // (looking +x your right is +z... the game's right is (-cos yaw, 0, sin yaw): yaw = PI/2 gives +z)
    const right = snapSpot(him, 'right', 0, AIMP.magnet.dist, view);
    expect(right.pos.z).toBeCloseTo(10 + AIMP.magnet.dist, 5);
    expect(right.normal.z).toBeCloseTo(-1, 5);
    const left = snapSpot(him, 'left', 0, AIMP.magnet.dist, view);
    expect(left.pos.z).toBeCloseTo(10 - AIMP.magnet.dist, 5);
    for (const s of [b, fr, left, right]) {
      expect(s.pos.y - AIMP.h / 2).toBeCloseTo(0.02, 5);
      expect(s.pos.distanceTo(V(10, s.pos.y, 10))).toBeCloseTo(AIMP.magnet.dist, 5);
      expect(AIMP.magnet.dist).toBeGreaterThanOrEqual(1.2);
      expect(AIMP.magnet.dist).toBeLessThanOrEqual(1.5);
      // its front looks at him
      expect(V(10 - s.pos.x, 0, 10 - s.pos.z).normalize().dot(s.normal)).toBeCloseTo(1, 5);
    }
    // he faces away from you: the far side is in his face, so BEHIND is his back, your side of him
    const away = snapSpot({ ...man, yaw: Math.PI / 2 }, 'behind', 0, AIMP.magnet.dist, view);
    expect(away.pos.x).toBeCloseTo(10 - AIMP.magnet.dist, 5);
    expect(guarded(V(10, 0, 10), Math.PI / 2, away.pos, false)).toBe(false);
    // side-on to you: the far side (his flank)
    const side = snapSpot({ ...man, yaw: 0 }, 'behind', 0, AIMP.magnet.dist, view);
    expect(side.pos.x).toBeCloseTo(10 + AIMP.magnet.dist, 5);
    expect(guarded(V(10, 0, 10), 0, side.pos, false)).toBe(false);
  });

  it('the crosshair is on a man within a cone that grows with the range (3° desktop, 7° touch) plus his body; the nearest to the crosshair wins; a wall hides him', () => {
    const o = V(0, 1.6, 0);
    const noWall = () => false;
    const at = (d: number, x = 0) => ({ id: d, pos: V(x, 0, d), height: 1.8, radius: 0.42 });
    const kbm = THREE.MathUtils.degToRad(AIMP.magnet.deg.kbm);
    const touch = THREE.MathUtils.degToRad(AIMP.magnet.deg.touch);
    expect(AIMP.magnet.deg.kbm).toBeGreaterThanOrEqual(3);
    expect(AIMP.magnet.deg.touch).toBeGreaterThanOrEqual(7);
    for (const d of [8, 20, 32]) {
      // aimed 2.5° off his body's edge: on him with the help (desktop), as at any range
      const edge = 0.42 + AIMP.magnet.pad;
      const off = edge + Math.tan(THREE.MathUtils.degToRad(2.5)) * d;
      const dir = V(off, 0, d).normalize();
      expect(magnetTarget(o, dir, [at(d)], kbm, noWall)?.id).toBe(d);
      // 6° off: not on desktop, yes on touch
      const off6 = edge + Math.tan(THREE.MathUtils.degToRad(6)) * d;
      const dir6 = V(off6, 0, d).normalize();
      expect(magnetTarget(o, dir6, [at(d)], kbm, noWall)).toBeNull();
      expect(magnetTarget(o, dir6, [at(d)], touch, noWall)?.id).toBe(d);
    }
    // two men: the one the crosshair is nearer to (by its leeway), not the nearer one
    const near = { id: 1, pos: V(1.2, 0, 8), height: 1.8, radius: 0.42 };
    const far = { id: 2, pos: V(0, 0, 25), height: 1.8, radius: 0.42 };
    expect(magnetTarget(o, V(0, 0, 1), [near, far], kbm, noWall)?.id).toBe(2);
    // a wall hides him; behind you is nobody
    expect(magnetTarget(o, V(0, 0, 1), [far], kbm, () => true)).toBeNull();
    expect(magnetTarget(o, V(0, 0, -1), [far], touch, noWall)).toBeNull();
    // over his head (a man on a tower): his height plus a little counts
    expect(magnetTarget(o, V(0, 0.3 / 20, 1).normalize(), [at(20)], 0, noWall)?.id).toBe(20);
  });

  it('a tap on the screen within 60 px of a man (feet to head) is on him; the nearest wins', () => {
    const list = [
      { id: 1, pos: V(0, 0, 0), height: 1.8, radius: 0.42 },
      { id: 2, pos: V(1, 0, 0), height: 1.8, radius: 0.42 },
    ];
    // a fake projection: 100 px per m, y up the screen
    const proj = (p: THREE.Vector3) => ({ x: 400 + p.x * 100, y: 300 - p.y * 100 });
    expect(AIMP.magnet.tapPx).toBeGreaterThanOrEqual(60);
    expect(tapTarget(400 + 40, 250, list, proj, () => false)?.id).toBe(1);
    expect(tapTarget(400 + 75, 250, list, proj, () => false)?.id).toBe(2);
    expect(tapTarget(400 - 70, 250, list, proj, () => false)).toBeNull();
    expect(tapTarget(400, 250, list, proj, () => true)).toBeNull();
  });

  it('a moving man: the exit opens where he will be in a moment (a man in the air: where he is)', () => {
    const p = leadPos(V(0, 0, 0), V(4, 0, 0));
    expect(p.x).toBeCloseTo(4 * AIMP.magnet.lead, 5);
    expect(leadPos(V(0, 0, 0), V(0.2, 0, 0)).x).toBe(0);
    expect(leadPos(V(0, 0, 0), V(20, 0, 0)).x).toBe(0);
  });

  it('it follows his facing: turn him round and BEHIND is the other side', () => {
    const a = snapSpot({ ...man, yaw: 0 }, 'behind');
    const b = snapSpot({ ...man, yaw: Math.PI }, 'behind');
    expect(a.pos.z).toBeCloseTo(10 - AIMP.magnet.dist, 5);
    expect(b.pos.z).toBeCloseTo(10 + AIMP.magnet.dist, 5);
  });

  it('ABOVE: over his head looking down; BELOW: a disc in the floor under his feet looking up', () => {
    const up = snapSpot(man, 'above');
    expect(up.surface).toBe('ceiling');
    expect(up.normal.y).toBe(-1);
    expect(up.pos.y).toBeGreaterThan(man.height);
    expect(up.pos.x).toBe(10);
    const down = snapSpot(man, 'below', 3);
    expect(down.surface).toBe('floor');
    expect(down.normal.y).toBe(1);
    expect(down.pos.y).toBeCloseTo(3 + AIMP.off, 5);
    expect(down.pos.x).toBe(10);
    expect(down.w).toBe(AIMP.flat);
  });

  it('his back to a wall: BEHIND comes in against the wall; too tight or sealed: refused', () => {
    const w = flatWorld();
    w.add(V(0, 0, 11), V(30, 5, 12));
    const e = { pos: V(10, 0, 9.5), yaw: Math.PI, height: 1.8 }; // facing -z? yaw PI faces -z: behind is +z, the wall is 1.5 m away
    const s = fitSnap(w, e, 'behind');
    expect(s.ok).toBe(true);
    expect(s.pos.z).toBeCloseTo(11 - AIMP.off, 3);
    expect(s.normal.z).toBeCloseTo(-1, 3);
    const tight = fitSnap(w, { ...e, pos: V(10, 0, 10.6) }, 'behind');
    expect(tight.ok).toBe(false);
    // a sealed wall right behind him (1 m): refused; a sealed wall never holds it
    const w2 = flatWorld();
    w2.add(V(0, 0, 11), V(30, 5, 12), { noPortal: true });
    expect(fitSnap(w2, { ...e, pos: V(10, 0, 10) }, 'behind').reason).toBe('sealed');
    const turned = fitSnap(w2, e, 'behind');
    if (turned.ok) expect(turned.surface).toBe('stand');
    // (a free spot is just the snap spot)
    const free = fitSnap(flatWorld(), e, 'behind');
    expect(free.pos.distanceTo(snapSpot(e, 'behind').pos)).toBeLessThan(1e-6);
  });

  it('the man under the crosshair: the nearest the ray passes, in sight; a thumb’s help widens it; a wall hides him', () => {
    const list = [
      { id: 1, pos: V(0, 0, 10), height: 1.8, radius: 0.42 },
      { id: 2, pos: V(0.2, 0, 20), height: 1.8, radius: 0.42 },
    ];
    const o = V(0, 1.6, 0);
    const noWall = () => false;
    expect(crosshairTarget(o, V(0, 0, 1), list, 0, noWall)?.id).toBe(1);
    expect(crosshairTarget(o, V(0.12, 0, 1).normalize(), list, 0, noWall)).toBeNull();
    expect(crosshairTarget(o, V(0.12, 0, 1).normalize(), list, THREE.MathUtils.degToRad(4), noWall)?.id).toBe(1);
    expect(crosshairTarget(o, V(0, 0, 1), list, 0, () => true)).toBeNull();
    expect(rayCylinder(o, V(0, 0, 1), V(0, 0, 10), 0.4, 1.8)).toBeCloseTo(9.6, 5);
    expect(rayCylinder(o, V(0, 1, 0).normalize(), V(0, 0, 10), 0.4, 1.8)).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// Reach, shield, throws: the rules of the three men and of the body
// ---------------------------------------------------------------------------

describe('AIM PORTAL: reach and rules', () => {
  it('a man within reach in front of a spot (the knife’s 1.5 m, the pull’s 2.5 m); behind its plane, or off to the side, not', () => {
    const w = flatWorld();
    const s = placeExit(flatWallWorld(), V(0, 1.6, 0), V(0, 0, 1), V(0, 1.6, 0), null, groundOf(w));
    // (the exit is on the wall at z = 12, looking -z: in front of it is lower z)
    const mk = (id: number, x: number, z: number) => ({ id, pos: V(x, 0, z), height: 1.8, radius: 0.42 });
    const knife = mk(1, 0, 10.8);
    const pullOnly = mk(2, 0, 9.8);
    const tooFar = mk(3, 0, 8);
    const side = mk(4, 3, 11);
    const behind = mk(5, 0, 13.5);
    expect(inFrontOf(s, V(0, 1, 10.8), AIMP.stab.reach)).toBe(true);
    expect(standingBy(s, [knife, tooFar, side, behind], AIMP.stab.reach)?.id).toBe(1);
    expect(standingBy(s, [pullOnly], AIMP.stab.reach)).toBeNull();
    expect(standingBy(s, [pullOnly], AIMP.pull.reach)?.id).toBe(2);
    expect(standingBy(s, [tooFar, side, behind], AIMP.pull.reach)).toBeNull();
  });

  it('an exit over his head (SNAP ABOVE) or under his feet (BELOW) has him in front of it: stabbed from above, pulled up out of the floor', () => {
    const m = { id: 1, pos: V(5, 0, 5), height: 1.8, radius: 0.42, yaw: 0 };
    const above = snapSpot(m, 'above');
    expect(standingBy(above, [m], AIMP.stab.reach)?.id).toBe(1);
    const below = snapSpot(m, 'below', 0);
    expect(standingBy(below, [m], AIMP.pull.reach)?.id).toBe(1);
    // (a man a few metres off to the side is not)
    expect(standingBy(above, [{ ...m, id: 2, pos: V(9, 0, 5) }], AIMP.pull.reach)).toBeNull();
  });

  it('a pulled man lands on your crosshair, 2 m in front of you', () => {
    const at = pullSpot(V(1, 0, 1), V(0, 0, 1));
    expect(at.z - 1).toBeCloseTo(AIMP.pull.land, 5);
    expect(at.x).toBe(1);
    expect(AIMP.pull.land).toBeGreaterThan(AIMP.stab.melee);
  });

  it('the mirror’s shield: a round from the front is eaten; from behind, or past its edge, it is not', () => {
    const m = V(0, 0, 10);
    // he faces -z (yaw PI): the shield is 1.5 m in front of him, at z = 8.5
    expect(shieldCross(m, Math.PI, V(0, 1.2, 0), V(0, 1.2, 10))).toBeCloseTo(8.5 / 10, 5);
    expect(shieldCross(m, Math.PI, V(0, 1.2, 20), V(0, 1.2, 10))).toBeNull();
    expect(shieldCross(m, Math.PI, V(1.2, 1.2, 0), V(1.2, 1.2, 10))).toBeNull();
    expect(shieldCross(m, Math.PI, V(0, 2.4, 0), V(0, 2.4, 10))).toBeNull();
    // turned toward you: yaw changes where the shield stands
    expect(shieldCross(m, 0, V(0, 1.2, 0), V(0, 1.2, 10))).toBeNull();
  });

  it('the shield turns at 140°/s, the short way: a quick flank is faster', () => {
    const rate = AIMP.enemy.mirror.turn;
    expect(rate).toBeCloseTo((140 * Math.PI) / 180, 6);
    const y = turnToward(0, Math.PI / 2, 0.25, rate);
    expect(y).toBeCloseTo(rate * 0.25, 6);
    // through the other way round when that is shorter
    expect(turnToward(3, -3, 0.1, rate)).toBeGreaterThan(3);
    expect(turnToward(0, 0.05, 1, rate)).toBeCloseTo(0.05, 6);
  });

  it('a frontal blow is parried; side and back are not (the mirror’s front is where his shield looks)', () => {
    const p = V(0, 0, 0);
    expect(guarded(p, 0, V(0, 0, 2), false)).toBe(true);
    expect(guarded(p, 0, V(2, 0, 0), false)).toBe(false);
    expect(guarded(p, 0, V(0, 0, -2), false)).toBe(false);
    expect(guarded(p, 0, V(2, 0, 1), true)).toBe(true);
    expect(guarded(p, 0, V(2, 0, 0.1), true)).toBe(false);
    expect(guarded(p, 0, V(0, 0, -2), true)).toBe(false);
    // straight over his head: no side to guard
    expect(guarded(p, 0, V(0, 2.5, 0.1), false)).toBe(false);
    expect(guarded(p, 0, V(0, 2.5, 0), true)).toBe(false);
  });

  it('what an impact does: a wall at 12 m/s kills, 8 hurts; a fall of 8 m kills, 3 hurts', () => {
    expect(impactOutcome('wall', 18, 0)).toBe('kill');
    expect(impactOutcome('wall', 12, 0)).toBe('kill');
    expect(impactOutcome('wall', 10, 0)).toBe('hurt');
    expect(impactOutcome('wall', 5, 0)).toBe('none');
    expect(impactOutcome('ground', 20, 8)).toBe('kill');
    expect(impactOutcome('ground', 14, 4)).toBe('hurt');
    expect(impactOutcome('ground', 6, 1)).toBe('none');
    expect(impactOutcome('ceiling', 13, 0)).toBe('kill');
  });

  it('they notice a portal in front of them within 8 m (not behind, not further)', () => {
    const eye = V(0, 1.6, 0);
    expect(notices(eye, 0, V(0, 1.5, 5))).toBe(true);
    expect(notices(eye, 0, V(0, 1.5, 9))).toBe(false);
    expect(notices(eye, 0, V(0, 1.5, -4))).toBe(false);
    expect(notices(eye, 0, V(5, 1.5, 1))).toBe(false);
    expect(AIMP.notice.time).toBeLessThanOrEqual(0.35);
  });

  it('kills by tool: a thrown man is the throw’s, a man the pair dropped is the pair’s, a round or a knife yours', () => {
    expect(aimKillTool('impact', null, true, false)).toBe('throw');
    expect(aimKillTool('void', null, false, true)).toBe('redirect');
    expect(aimKillTool('fall', 'rifle', false, true)).toBe('redirect');
    expect(aimKillTool('bolt', 'rifle', false, false)).toBe('rifle');
    expect(aimKillTool('blade', 'knife', false, false)).toBe('knife');
    expect(aimKillTool('bolt', null, false, false)).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// Crossing: speed in, speed out
// ---------------------------------------------------------------------------

describe('AIM PORTAL: through the pair', () => {
  it('walk into the near twin, come out of the exit with your speed, along its front', () => {
    const world = makeWorld(false);
    const rifts = makeRifts(world);
    const phys = makePhysics(world, rifts);
    const ev = recorder();
    const near = nearSpot(world, V(0, 1.08, 0), { origin: V(0, 1.6, -3), dir: V(0, 0, 1) }, 0, () => -Infinity);
    near.pos.y = 1.02;
    const far = { pos: V(15, 1.02, 0), normal: V(-1, 0, 0), hdir: V(0, 0, 1), surface: 'wall' as const, w: AIMP.w, h: AIMP.h };
    rifts.openStrike(spotFrame(near, 'stand'), spotFrame(far), 6);
    rifts.update(0.3, 0.3, 0.3);
    const b = phys.createBody('prop', { pos: V(0, 0.2, 0), radius: 0.3, height: 1.8, simulate: false });
    b.vel.set(0, 0, 7);
    run(phys, ev, 0.7);
    expect(ev.log.crossed.length).toBe(1);
    const c = ev.log.crossed[0];
    expect(c.speed).toBeCloseTo(7, 1);
    // out of the exit's front (-x), at the same speed
    expect(c.vel.x).toBeCloseTo(-7, 1);
    expect(Math.abs(c.vel.z)).toBeLessThan(0.1);
    expect(c.pos.x).toBeCloseTo(15 - AIMP.off, 0);
  });

  it('and the other way: into the exit, out of the near twin', () => {
    const world = makeWorld(false);
    const rifts = makeRifts(world);
    const phys = makePhysics(world, rifts);
    const ev = recorder();
    const near = nearSpot(world, V(0, 1.08, 0), { origin: V(0, 1.6, -3), dir: V(0, 0, 1) }, 0, () => -Infinity);
    near.pos.y = 1.02;
    const far = { pos: V(15, 1.02, 0), normal: V(-1, 0, 0), hdir: V(0, 0, 1), surface: 'wall' as const, w: AIMP.w, h: AIMP.h };
    rifts.openStrike(spotFrame(near, 'stand'), spotFrame(far), 6);
    rifts.update(0.3, 0.3, 0.3);
    const b = phys.createBody('prop', { pos: V(11, 0.2, 0), radius: 0.3, height: 1.8, simulate: false });
    b.vel.set(8, 0, 0);
    run(phys, ev, 0.7);
    expect(ev.log.crossed.length).toBe(1);
    const c = ev.log.crossed[0];
    expect(c.speed).toBeCloseTo(8, 1);
    // out of the near twin's front: toward you (-z)
    expect(c.vel.z).toBeCloseTo(-8, 1);
  });

  it('a man dropped through a floor exit comes out of the near twin (a drop becomes a shove: the speed is kept)', () => {
    const world = makeWorld(true);
    const rifts = makeRifts(world);
    const phys = makePhysics(world, rifts);
    const ev = recorder();
    const near = nearSpot(world, V(0, 1.08, 0), { origin: V(0, 1.6, -3), dir: V(0, 0, 1) }, 0, () => 0);
    const floor = snapSpot({ pos: V(10, 0, 10), yaw: 0, height: 1.8 }, 'below', 0);
    rifts.openStrike(spotFrame(near, 'stand'), spotFrame(floor), 6);
    rifts.update(0.3, 0.3, 0.3);
    const b = phys.createBody('enemy', { pos: V(10, 0.05, 10), radius: 0.4, height: 1.8, simulate: true });
    run(phys, ev, 1);
    expect(ev.log.crossed.length).toBe(1);
    const c = ev.log.crossed[0];
    expect(c.speed).toBeGreaterThan(3);
    // out of the near twin: at your end, not under his old feet
    expect(c.pos.distanceTo(V(0, 1, AIMP.near.ahead))).toBeLessThan(1.2);
  });

  it('a round through the near twin leaves the exit along its front (the rift system’s ray)', () => {
    const world = flatWallWorld();
    const rifts = makeRifts(world);
    const near = nearSpot(world, V(0, 1.08, 0), { origin: V(0, 1.6, -3), dir: V(0, 0, 1) }, 0, groundOf(world));
    const far = { pos: V(20, 1.02, 5), normal: V(-1, 0, 0), hdir: V(0, 0, 1), surface: 'wall' as const, w: AIMP.w, h: AIMP.h };
    const s = rifts.openStrike(spotFrame(near, 'stand'), spotFrame(far), 6);
    rifts.update(0.3, 0.3, 0.3);
    const segs = rifts.raycastThrough(V(0, near.pos.y, -3), V(0, 0, 1), 90, world, 2);
    expect(segs.length).toBeGreaterThanOrEqual(2);
    expect(segs[0].viaEnd).toBe(rifts.strikeEnds(s)!.a);
    // (the second piece starts at the exit, heading out of its front)
    expect(segs[1].from.x).toBeCloseTo(20 - 0.001, 1);
    expect(segs[1].to.x).toBeLessThan(segs[1].from.x);
  });
});

// ---------------------------------------------------------------------------
// The mode in the game: a rig with the real rift system and the enemy system
// ---------------------------------------------------------------------------

const noop = () => {};
const sink = new Proxy({}, { get: () => noop }) as any;

/**
 * AIM PORTAL in a set piece: the real rift system and enemy system, a stand-in
 * hero. `move`: the hero moves (a lunge, GO's dash, momentum, friction) and
 * crosses the pair the way the physics does (the game's crossing hook calls
 * heroCrossed, and the view turns by what it returns).
 */
function rig(o: { device?: 'kbm' | 'touch' | 'pad'; move?: boolean } = {}) {
  setLabActive(true);
  setVariant('aimportal');
  const sc = scenario();
  const rifts = new RiftSystem(new THREE.Scene(), null, sc.world, { portalScale: 0.5, lightCount: 2, maxViews: 2 });
  const pos = V(0, 0, 0);
  const vel = V();
  const lunge = { dir: V(), speed: 0, t: 0 };
  const crossings: { t: number; from: any; to: any; turn: number | null }[] = [];
  const hops: { t: number; feet: THREE.Vector3; yaw: number; vel: THREE.Vector3 }[] = [];
  const player = {
    body: { pos, vel, onGround: true, height: 1.8 },
    yaw: 0,
    weaponUp: 0,
    chest: (out = new THREE.Vector3()) => out.set(pos.x, pos.y + 1.3, pos.z),
    lunge(dir: THREE.Vector3, speed: number, time: number) {
      lunge.dir.set(dir.x, 0, dir.z).normalize();
      lunge.speed = speed;
      lunge.t = time;
      player.yaw = Math.atan2(lunge.dir.x, lunge.dir.z);
    },
    endLunge() {
      if (lunge.t <= 0) return;
      lunge.t = 0;
      vel.x = vel.z = 0;
    },
  };
  const hero = {
    setHeld: noop,
    play: noop,
    bonePos: (_n: string, out = new THREE.Vector3()) => out.set(pos.x - 0.3, pos.y + 1.1, pos.z + 0.2),
    heldMuzzle: (out = new THREE.Vector3()) => out.set(pos.x, pos.y + 1.4, pos.z + 0.5),
  };
  const ray = { origin: V(0, 1.6, -0.01), dir: V(0, 0, 1) };
  const calls: string[] = [];
  const state = { time: 0, alive: true };
  const bolts: { e: number; from: THREE.Vector3; dir: THREE.Vector3 }[] = [];
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  const host: AimHost = {
    world: sc.world,
    enemies: sc.sys,
    fx: sink,
    audio: sink,
    camera,
    player: player as any,
    hero: hero as any,
    rifts,
    aimRay: () => ray,
    rayAt: (x, y) => {
      const o = camera.position.clone();
      return { origin: o, dir: new THREE.Vector3(x, y, 0.5).unproject(camera).sub(o).normalize() };
    },
    eye: (out) => out.set(pos.x, pos.y + 1.6, pos.z),
    device: () => o.device ?? 'kbm',
    time: () => state.time,
    alive: () => state.alive,
    safe: () => false,
    fighting: () => true,
    standAt: (x, z, y) => {
      const g = sc.world.groundAt(x, z, 0.3, y + 1.2);
      return g === -Infinity || Math.abs(g - y) > 1.3 ? null : g;
    },
    hurt: () => calls.push('hurt'),
    hitstop: noop,
    shake: noop,
    kick: noop,
    fireEnemyBolt: (e, from, dir) => bolts.push({ e: e.id, from: from.clone(), dir: dir.clone() }),
    laser: noop,
    vibrate: noop,
    hop: (feet, yaw, v) => {
      hops.push({ t: state.time, feet: feet.clone() as THREE.Vector3, yaw, vel: v.clone() as THREE.Vector3 });
      pos.copy(feet);
      vel.copy(v);
      player.yaw = yaw;
    },
  };
  const hud = { update: noop, show: noop, dispose: noop, tip: noop, callout: (k: string) => calls.push(k) };
  const R = new AimMode(host, null, hud as any);
  sc.sys.aimBrain = R.ai;
  const input: AimInput = { fire: false, firePress: false, portal: false, portalPress: false, portalRelease: false, snap: false, snapVec: { x: 0, y: 0 }, stabPress: false, pullPress: false, wheel: 0 };
  /** Men held facing one way (a set piece: their brain would turn them to you). */
  const pinned = new Map<Enemy, number>();
  const dt = 1 / 60;
  /** The hero's own motion (with `move`): a lunge, momentum and friction, and a crossing of the pair as the physics does it. */
  const moveHero = () => {
    if (lunge.t > 0) {
      lunge.t -= dt;
      vel.x = lunge.dir.x * lunge.speed;
      vel.z = lunge.dir.z * lunge.speed;
    } else {
      const k = Math.exp(-6 * dt);
      vel.x *= k;
      vel.z *= k;
    }
    if (pos.y > 0 || vel.y > 0) vel.y -= LAW.gravity * dt;
    const prev = V(pos.x, pos.y + 0.9, pos.z);
    pos.addScaledVector(vel, dt);
    if (pos.y < 0) {
      pos.y = 0;
      vel.y = 0;
    }
    const cur = V(pos.x, pos.y + 0.9, pos.z);
    const end = rifts.findCrossing(prev, cur, 0.15, true);
    if (!end) return;
    const to = end.linked;
    const p2 = rifts.transformPoint(end, cur, V());
    const v2 = rifts.transformDir(end, vel, V());
    pos.set(p2.x, p2.y - 0.9, p2.z).addScaledVector(to.normal, 0.05);
    vel.copy(v2);
    lunge.t = 0;
    if (Math.abs(to.normal.y) < 0.5) player.yaw = Math.atan2(to.normal.x, to.normal.z);
    const turn = R.heroCrossed(end, to);
    crossings.push({ t: state.time, from: end, to, turn });
    // the view turns with you: by the pair's turn
    if (turn !== null) ray.dir.applyAxisAngle(V(0, 1, 0), turn);
    ray.origin.set(pos.x, pos.y + 1.6, pos.z);
  };
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      for (const [e, yaw] of pinned) e.yaw = yaw;
      state.time += dt;
      sc.player.pos.copy(pos);
      sc.player.chest.set(pos.x, pos.y + 1.3, pos.z);
      camera.position.set(pos.x, pos.y + 1.8, pos.z - 3);
      camera.lookAt(camera.position.clone().add(ray.dir));
      camera.updateMatrixWorld();
      R.update(dt, dt, input);
      rifts.update(dt, dt, state.time);
      input.firePress = input.portalPress = input.portalRelease = input.stabPress = input.pullPress = false;
      input.goPress = false;
      input.worldTap = null;
      if (o.move) moveHero();
      sc.step(1);
    }
  };
  const aimAt = (p: THREE.Vector3) => {
    ray.origin.set(pos.x, pos.y + 1.6, pos.z);
    ray.dir.subVectors(p, ray.origin).normalize();
  };
  /** PORTAL: press and let go, the pair opens (aimed at `p`). */
  const tap = (p?: THREE.Vector3, n = 2) => {
    if (p) aimAt(p);
    input.portal = true;
    input.portalPress = true;
    step(1);
    input.portal = false;
    input.portalRelease = true;
    step(Math.max(1, n - 1));
  };
  const man = (at: THREE.Vector3, yaw = Math.PI, aim: 'gunner' | 'mirror' | 'rusher' = 'gunner') => sc.spawn('rifleman', at, yaw, { aim, state: 'combat' }) as Enemy;
  /** Keep a man from deciding anything for himself (a set piece), facing the way he was spawned. */
  const freeze = (e: Enemy) => {
    pinned.set(e, e.yaw);
    const m = R.ai.mind(e, Math.random);
    m.react = 99;
    m.portalCd = 99;
    m.gunT = 99;
  };
  /** Aim so the ray enters the near twin and leaves the exit onto `p` (the point as the portal's window shows it). */
  const aimThrough = (p: THREE.Vector3) => {
    const ends = rifts.strikeEnds(R.pair!.strike)!;
    aimAt(rifts.transformPoint(ends.b, p));
  };
  /** PORTAL held down (no let go): `n` frames. */
  const hold = (n: number) => {
    input.portal = true;
    input.portalPress = true;
    step(1);
    step(Math.max(0, n - 1));
  };
  const letGo = () => {
    input.portal = false;
    input.portalRelease = true;
    step(1);
  };
  return { sc, R, host, rifts, pos, vel, ray, input, step, aimAt, tap, hold, letGo, man, freeze, aimThrough, calls, bolts, state, camera, crossings, player, hops };
}

describe('AIM PORTAL: the pair', () => {
  it('opens on the press itself (the same frame), well within 0.25 s, both ends open at once', () => {
    const { R, rifts, step, aimAt, input } = rig();
    aimAt(V(0, 1.6, 12));
    expect(R.pair).toBeNull();
    input.portal = true;
    input.portalPress = true;
    step(1);
    expect(R.pair).not.toBeNull();
    const ends = rifts.strikeEnds(R.pair!.strike)!;
    expect(ends.a.isOpen).toBe(true);
    expect(ends.b.isOpen).toBe(true);
    expect(R.lastOpen.count).toBe(1);
    expect(1 / 60).toBeLessThan(0.25);
    // the exit where the crosshair is (mid-air, 12 m, facing you); the twin 1.3 m ahead of you, facing you
    expect(R.pair!.far.pos.z).toBeGreaterThan(8);
    expect(R.pair!.near.pos.z).toBeCloseTo(AIMP.near.ahead, 1);
    expect(R.pair!.near.normal.z).toBe(-1);
  });

  it('one pair at a time: a new press moves it (its ends jump: no twin collapsing in your face); it shuts by itself after its time; a second press inside the cooldown does nothing', () => {
    const { R, rifts, tap, step, aimAt } = rig();
    tap(V(0, 1.6, 12));
    const first = R.pair!;
    const far0 = first.far.pos.clone();
    expect(rifts.strikeOpen()).toBe(true);
    // (inside the cooldown: nothing)
    tap(V(5, 1.6, 12), 1);
    expect(R.pair!.id).toBe(first.id);
    // let the cooldown run, then a new press
    step(Math.ceil(AIMP.cooldown * 60) + 2);
    aimAt(V(5, 1.6, 12));
    tap(V(5, 1.6, 12));
    expect(R.pair!.id).not.toBe(first.id);
    const ends = rifts.strikeEnds(R.pair!.strike)!;
    expect(ends.b.position.distanceTo(far0)).toBeGreaterThan(2);
    expect(ends.b.position.distanceTo(R.pair!.far.pos)).toBeLessThan(1e-6);
    expect(R.lastOpen.count).toBe(2);
    // (the near twin collapses fast when it goes)
    expect((ends.a as any).closeTime).toBeLessThan(0.1);
    step(Math.ceil(AIMP.life * 60) + 3);
    expect(R.pair).toBeNull();
    expect(rifts.strikeOpen()).toBe(false);
  });

  it('held: the exit follows the crosshair live and stays where you let go; a quick tap is just the press', () => {
    const { R, step, aimAt, input } = rig();
    aimAt(V(0, 1.6, 12));
    input.portal = true;
    input.portalPress = true;
    step(1);
    const first = R.pair!.far.pos.clone();
    // a quick tap: nothing moves it
    step(3);
    expect(R.pair!.far.pos.distanceTo(first)).toBeLessThan(1e-6);
    // held longer than the tap: it follows the aim
    step(Math.ceil(AIMP.live * 60) + 1);
    aimAt(V(4, 1.6, 12));
    step(2);
    expect(R.ghost).not.toBeNull();
    expect(R.pair!.far.pos.x).toBeGreaterThan(2);
    input.portal = false;
    input.portalRelease = true;
    step(1);
    const at = R.pair!.far.pos.clone();
    // (the pair's time counts from the release)
    expect(R.pair!.t).toBeLessThan(0.1);
    aimAt(V(-6, 1.6, 12));
    step(5);
    expect(R.pair!.far.pos.distanceTo(at)).toBeLessThan(1e-6);
    expect(R.ghost).toBeNull();
  });

  it('a sealed panel refuses it: no pair, the red flash and the buzz', () => {
    const { sc, R, tap, calls } = rig();
    sc.world.add(V(-20, 0, 10), V(20, 6, 10.4), { noPortal: true });
    tap(V(0, 1.6, 10));
    expect(R.pair).toBeNull();
    expect(calls).toContain('aim.sealed');
  });

  it('the near twin takes you at once (no grace), but only moving into its front: standing by it as it opens, or backing off, does nothing', () => {
    const { R, rifts, tap, pos } = rig();
    tap(V(0, 1.6, 12), 1);
    const ends = rifts.strikeEnds(R.pair!.strike)!;
    expect(AIMP.grace).toBe(0);
    expect((ends.a as any).noPlayer).toBe(false);
    expect((ends.b as any).noPlayer).toBe(false);
    const n = R.pair!.near;
    expect(n.pos.z - pos.z).toBeGreaterThanOrEqual(0.6);
    // your middle, still, where you stand; stepping back; stepping in
    const mid = V(n.pos.x, 0.9, 0);
    expect(rifts.findCrossing(mid, mid, 0.15, true)).toBeNull();
    expect(rifts.findCrossing(V(n.pos.x, 0.9, 0.2), V(n.pos.x, 0.9, -0.1), 0.15, true)).toBeNull();
    expect(rifts.findCrossing(V(n.pos.x, 0.9, n.pos.z - 0.1), V(n.pos.x, 0.9, n.pos.z + 0.1), 0.15, true)).toBe(ends.a);
  });

  it('the twin stands a little further ahead when you sprint at it (never past its max)', () => {
    const { R, tap, vel, step } = rig();
    vel.set(0, 0, 9);
    tap(V(0, 1.6, 12));
    expect(R.pair!.near.pos.z).toBeGreaterThan(AIMP.near.ahead);
    expect(R.pair!.near.pos.z).toBeLessThanOrEqual(AIMP.near.max + 0.01);
    step(1);
  });

  it('the wheel sets the mid-air distance; with a surface the crosshair meets, the surface wins until you turn the wheel', () => {
    const { R, step, aimAt, input, tap } = rig();
    aimAt(V(0, 3, 12));
    input.wheel = -3;
    step(1);
    input.wheel = 0;
    expect(R.airDist).toBeCloseTo(AIMP.air.def - 3 * AIMP.air.step, 5);
    tap(V(0, 3, 12));
    expect(R.pair!.far.surface).toBe('air');
    expect(R.pair!.far.dist).toBeCloseTo(AIMP.air.def - 3 * AIMP.air.step, 0);
  });
});

describe('AIM PORTAL: the rifle through the pair', () => {
  it('a round fired into the near twin leaves the exit and hits the man in front of it (the tracer is in two pieces)', () => {
    const { R, man, freeze, tap, aimAt, aimThrough, input, step, sc } = rig();
    const g = man(V(0, 0, 14), Math.PI);
    freeze(g);
    // the crosshair on him: PORTAL opens right behind him
    aimAt(V(0, 1.2, 14));
    tap();
    expect(R.pair).not.toBeNull();
    expect(R.pair!.far.pos.z).toBeCloseTo(14 + AIMP.magnet.dist, 1);
    const tracers: [THREE.Vector3, THREE.Vector3][] = [];
    vi.spyOn(R.fx, 'tracer').mockImplementation((a: any, b: any) => void tracers.push([a.clone(), b.clone()]));
    aimThrough(g.chest(new THREE.Vector3()));
    const hp0 = g.hp;
    input.fire = true;
    input.firePress = true;
    step(1);
    input.fire = false;
    expect(g.hp).toBe(hp0 - AIMP.rifle.damage);
    // (one piece to the near twin, one from the exit to him)
    expect(tracers.length).toBe(2);
    expect(tracers[1][0].z).toBeGreaterThan(14.5);
    expect(tracers[1][1].distanceTo(g.chest(new THREE.Vector3()))).toBeLessThan(0.7);
    expect(R.ammo).toBe(AIMP.rifle.mag - 1);
    void sc;
  });

  it('turned away from the near twin (more than AIMP.near.cone°) to shoot someone else: the round flies past it, straight at him', () => {
    const { R, man, freeze, aimAt, tap, input, step, ray, rifts, sc } = rig();
    const a = man(V(0, 0, 14), Math.PI);
    const b = man(V(8, 0, 9), -Math.PI / 2);
    freeze(a);
    freeze(b);
    aimAt(V(0, 1.2, 14));
    tap();
    expect(R.pair!.man).toBe(a.id);
    // (the camera behind your shoulder still sees b through the near twin: the rifle doesn't take that way)
    ray.origin.set(-2.4, 1.6, -2.1);
    ray.dir.subVectors(b.chest(new THREE.Vector3()), ray.origin).normalize();
    const segs = rifts.raycastThrough(ray.origin, ray.dir, 90, sc.world, 2);
    expect(segs.length).toBeGreaterThan(1);
    expect(segs[0].viaEnd).toBe(rifts.strikeEnds(R.pair!.strike)!.a);
    const hp = b.hp;
    input.fire = true;
    input.firePress = true;
    step(1);
    input.fire = false;
    expect(b.hp).toBe(hp - AIMP.rifle.damage);
    expect(a.hp).toBe(AIMP.enemy.gunner.hp);
    expect(R.usage.rifleDirect).toBe(1);
  });

  it('24 rounds, then an auto-reload of 1.4 s; no fire while it reloads', () => {
    const { R, input, step, aimAt } = rig();
    aimAt(V(0, 1.6, 40));
    input.fire = true;
    step(Math.ceil((AIMP.rifle.mag * AIMP.rifle.interval + 0.4) * 60));
    expect(R.ammo).toBe(0);
    expect(R.reloadT).toBeGreaterThan(0);
    step(30);
    expect(R.ammo).toBe(0);
    step(Math.ceil(AIMP.rifle.reload * 60));
    input.fire = false;
    expect(R.ammo).toBeGreaterThan(0);
  });

  it('the mirror eats a round from the front (30% come back at you); a round from his back through the exit hurts him', () => {
    const { R, man, freeze, aimAt, input, step, bolts, tap, aimThrough } = rig();
    const m = man(V(0, 0, 14), Math.PI, 'mirror');
    freeze(m);
    expect(m.hp).toBe(AIMP.enemy.mirror.hp);
    // from the front: absorbed, a return at 30%
    aimAt(V(0, 1.2, 14));
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    input.firePress = true;
    input.fire = true;
    step(1);
    expect(m.hp).toBe(AIMP.enemy.mirror.hp);
    expect(bolts.length).toBe(1);
    expect(bolts[0].e).toBe(m.id);
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    step(Math.ceil(AIMP.rifle.interval * 60) + 1);
    expect(m.hp).toBe(AIMP.enemy.mirror.hp);
    expect(bolts.length).toBe(1);
    input.fire = false;
    // from behind: SNAP BEHIND, a round through the pair hits his back
    input.snap = true;
    tap();
    input.snap = false;
    aimThrough(m.chest(new THREE.Vector3()));
    step(12);
    input.firePress = true;
    input.fire = true;
    step(1);
    input.fire = false;
    expect(m.hp).toBe(AIMP.enemy.mirror.hp - AIMP.rifle.damage);
  });

  it('the mirror turns his shield toward where a round through a portal came from, at the shield’s own speed (one straight from you: he just keeps tracking you)', () => {
    const { R, man, sc } = rig();
    const m = man(V(0, 0, 14), Math.PI, 'mirror');
    const mind = R.ai.mind(m, Math.random);
    mind.react = 0;
    R.ai.host.go = () => true;
    // hit from the side (+x): he starts turning toward it; 0.3 s later no more than 140°/s of it
    R.ai.attacked(m, V(12, 0, 14), 0, true);
    sc.player.pos.set(0, 0, 0);
    sc.step(1);
    const y0 = m.yaw;
    sc.step(18);
    const turned = Math.abs(m.yaw - y0);
    expect(turned).toBeLessThanOrEqual(AIMP.enemy.mirror.turn * 0.3 + 0.05);
    expect(turned).toBeGreaterThan(0.2);
  });
});

describe('AIM PORTAL: the knife through the pair', () => {
  it('from behind through the exit: dead, whatever the crosshair is on (you put it by him); from the front: parried (a guard), alive', () => {
    const { R, man, freeze, aimAt, input, step, tap, calls } = rig();
    const g = man(V(0, 0, 10), Math.PI);
    freeze(g);
    aimAt(V(0, 1.2, 10));
    tap();
    // (the crosshair somewhere else entirely: the knife still goes through the pair)
    aimAt(V(8, 3, 4));
    expect(R.stabState()).toBe('kill');
    input.stabPress = true;
    step(2);
    expect(g.alive).toBe(false);
    // the front: a second man, the side key flicked to FRONT (the lower diagonal)
    const h = man(V(0, 0, 10), Math.PI);
    freeze(h);
    step(30);
    aimAt(V(0, 1.2, 10));
    input.snap = true;
    input.snapVec = { x: 0.7, y: -0.7 };
    step(1);
    expect(R.snapSide).toBe('front');
    tap();
    input.snap = false;
    expect(R.pair!.far.pos.z).toBeCloseTo(10 - AIMP.magnet.dist, 1);
    expect(R.stabState()).toBe('blocked');
    input.stabPress = true;
    step(2);
    expect(h.alive).toBe(true);
    expect(calls).toContain('aim.parried');
  });

  it('the knife reaches AIMP.stab.reach (at least 1.8 m) past the exit; a man further off is not touched', () => {
    expect(AIMP.stab.reach).toBeGreaterThanOrEqual(1.8);
    const { R, man, freeze, input, step, tap } = rig();
    // a free exit in mid-air 9.6 m off, looking back at you (nobody under the crosshair)
    R.airDist = 9.6;
    tap(V(0, 1.6, 9.6));
    expect(R.pair).not.toBeNull();
    expect(R.pair!.man).toBeNull();
    const f = R.pair!.far;
    const at = (d: number) => V(f.pos.x + f.normal.x * d, 0, f.pos.z + f.normal.z * d);
    // facing away from it (his back to it)
    const g = man(at(AIMP.stab.reach + 0.45), Math.PI);
    freeze(g);
    step(2);
    expect(R.stabState()).toBeNull();
    input.stabPress = true;
    step(2);
    expect(g.alive).toBe(true);
    // 1.9 m off: through
    const k = man(at(1.9), Math.PI);
    freeze(k);
    step(2);
    step(20);
    expect(R.stabState()).toBe('kill');
    input.stabPress = true;
    step(2);
    expect(k.alive).toBe(false);
  });

  it('up close, in front of you, a back or side stab kills without a pair; a frontal one is parried', () => {
    const { R, man, freeze, aimAt, input, step } = rig();
    const g = man(V(0, 0, 1.5), 0);
    freeze(g);
    aimAt(V(0, 1.3, 1.5));
    expect(R.stabState()).toBe('melee');
    input.stabPress = true;
    step(2);
    expect(g.alive).toBe(false);
    const h = man(V(0, 0, 1.5), Math.PI);
    freeze(h);
    step(20);
    aimAt(V(0, 1.3, 1.5));
    expect(R.stabState()).toBe('blocked');
  });
});

describe('AIM PORTAL: pull and throw', () => {
  it('PULL: the man by the exit is yanked through and lands on your crosshair, 2 m in front of you, staggered; the pair shuts behind him', () => {
    const { R, man, freeze, aimAt, input, step, tap, rifts, sc, pos } = rig();
    const g = man(V(0, 0, 12), Math.PI);
    freeze(g);
    aimAt(V(0, 1.2, 12));
    input.snap = true;
    input.snapVec = { x: 0, y: 0 };
    tap();
    input.snap = false;
    aimAt(V(0, 1.4, 12));
    input.pullPress = true;
    step(1);
    step(Math.ceil((AIMP.pull.through + AIMP.pull.out) * 60) + 4);
    expect(R.pair).toBeNull();
    expect(rifts.strikeOpen()).toBe(false);
    expect(g.pos.z).toBeCloseTo(pos.z + AIMP.pull.land, 0);
    expect(Math.abs(g.pos.x)).toBeLessThan(0.3);
    expect(g.state).toBe('stagger');
    expect(R.held).not.toBeNull();
    void sc;
  });

  it('PULL with nobody by the exit does nothing (no auto targeting)', () => {
    const { R, man, freeze, aimAt, input, step, tap, calls } = rig();
    const g = man(V(10, 0, 12), Math.PI);
    freeze(g);
    tap(V(0, 1.4, 12));
    input.pullPress = true;
    step(2);
    expect(calls).toContain('aim.nobody');
    expect(R.held).toBeNull();
    expect(g.state).not.toBe('stagger');
    aimAt(V(0, 1.4, 12));
  });

  it('THROW (PULL again, or FIRE) within 0.6 s sends him along your aim at 18 m/s; not thrown, he drops staggered', () => {
    const { R, man, freeze, aimAt, input, step, tap } = rig();
    const g = man(V(0, 0, 12), Math.PI);
    freeze(g);
    aimAt(V(0, 1.2, 12));
    input.snap = true;
    tap();
    input.snap = false;
    input.pullPress = true;
    step(1);
    step(Math.ceil((AIMP.pull.through + AIMP.pull.out) * 60) + 3);
    expect(R.held).not.toBeNull();
    aimAt(V(0, 1.6, 40));
    input.firePress = true;
    step(1);
    expect(R.held).toBeNull();
    expect(g.aimThrown).toBe(true);
    expect(g.state).toBe('launched');
    expect(Math.hypot(g.body!.vel.x, g.body!.vel.z)).toBeGreaterThan(AIMP.throw.speed * 0.9);
    expect(g.body!.charge).toBeGreaterThan(0);
    // not thrown: it just expires
    const h = man(V(10, 0, 12), Math.PI);
    freeze(h);
    aimAt(V(10, 1.2, 12));
    input.snap = true;
    tap();
    input.snap = false;
    input.pullPress = true;
    step(1);
    step(Math.ceil((AIMP.pull.through + AIMP.pull.out) * 60) + 3);
    expect(R.held?.id).toBe(h.id);
    step(Math.ceil(AIMP.pull.hold * 60) + 4);
    expect(R.held).toBeNull();
    expect(h.aimThrown).toBe(false);
  });

  it('a thrown man dies on a wall at 12 m/s or more (the throw’s kill), and the fall of 8 m or more kills; softer ones hurt', () => {
    const { sc, man } = rig();
    sc.world.add(V(-20, 0, 8), V(20, 8, 9));
    const a = man(V(0, 0, 3), Math.PI);
    a.aimThrown = true;
    sc.sys.launch(a, V(0, 6, 18));
    a.body!.charge = LAW.chargeTime;
    sc.step(90);
    expect(a.alive).toBe(false);
    // a fall from 10 m
    const b = man(V(5, 10, 3), Math.PI);
    sc.sys.launch(b, V(0, 0, 0));
    sc.step(90);
    expect(b.alive).toBe(false);
    // a fall from 4 m: hurt, alive
    const c = man(V(-5, 4, 3), Math.PI);
    sc.sys.launch(c, V(0, 0, 0));
    sc.step(90);
    expect(c.alive).toBe(true);
    expect(c.hp).toBe(AIMP.enemy.gunner.hp - AIMP.fall.hurtDamage);
    // a slow bump into the wall: nothing
    const d = man(V(8, 0, 5), Math.PI);
    sc.sys.launch(d, V(0, 1, 4));
    sc.step(60);
    expect(d.hp).toBe(AIMP.enemy.gunner.hp);
  });
});

describe('AIM PORTAL: they notice it, and SNAP', () => {
  it('they notice a new exit after 0.35 s in front of their eyes, 0.6 s at their side, 0.8 s behind them (near enough to hear it); far behind them, never', () => {
    const eye = V(0, 1.6, 0);
    // (yaw 0 looks +z)
    expect(noticeDelay(eye, 0, V(0, 1, 5))).toBe(AIMP.notice.time);
    expect(noticeDelay(eye, 0, V(1.3, 1, 0))).toBe(AIMP.notice.side);
    expect(noticeDelay(eye, 0, V(0, 1, -1.3))).toBe(AIMP.notice.back);
    expect(noticeDelay(eye, 0, V(0, 1, -6))).toBeNull();
    expect(noticeDelay(eye, 0, V(0, 1, 9))).toBeNull();
    expect(AIMP.notice.time).toBeLessThanOrEqual(0.35);
    expect(AIMP.notice.side).toBeGreaterThanOrEqual(0.6);
    expect(AIMP.notice.back).toBeLessThanOrEqual(0.8);
    // in the game: PORTAL on a man facing you puts it at his back: a fair 0.8 s before he turns to it
    const { R, man, freeze, aimAt, tap, step, input } = rig();
    const g = man(V(0, 0, 14), Math.PI);
    freeze(g);
    aimAt(V(0, 1.2, 14));
    tap(undefined, 2);
    step(Math.round(AIMP.notice.back * 60) - 8);
    expect(R.pair!.noticed.has(g.id)).toBe(false);
    step(10);
    expect(R.pair!.noticed.has(g.id)).toBe(true);
    // the exit in his face (the side key flicked to FRONT): he has it after 0.35 s
    R.closePair();
    const h = man(V(6, 0, 14), Math.PI);
    freeze(h);
    aimAt(V(6, 1.2, 14));
    input.snap = true;
    input.snapVec = { x: 0.7, y: -0.7 };
    step(1);
    tap(undefined, 2);
    input.snap = false;
    expect(R.pair!.man).toBe(h.id);
    step(Math.round(AIMP.notice.time * 60) + 2);
    expect(R.pair!.noticed.has(h.id)).toBe(true);
  });

  it('the side key on its own (Ctrl / MMB, an alias): on a man it holds him and the flick picks his side as you see him; without a man, free aim', () => {
    const { R, man, freeze, aimAt, tap, input, step } = rig();
    const g = man(V(0, 0, 14), Math.PI);
    freeze(g);
    // no man under the crosshair: free aim (the key changes nothing)
    aimAt(V(0, 6, 30));
    input.snap = true;
    step(1);
    expect(R.snapLatched).toBe(false);
    aimAt(V(0, 1.2, 14));
    step(1);
    expect(R.snapLatched).toBe(true);
    expect(R.snapSide).toBe('behind');
    input.snapVec = { x: -1, y: 0.2 };
    step(1);
    expect(R.snapSide).toBe('left');
    expect(R.ghost?.kind).toBe('snap');
    tap();
    expect(R.pair).not.toBeNull();
    // (you look +z at him: your screen's left is +x)
    expect(R.pair!.far.pos.x - g.pos.x).toBeCloseTo(AIMP.magnet.dist, 1);
    input.snap = false;
    input.snapVec = { x: 0, y: 0 };
    step(1);
    expect(R.snapLatched).toBe(false);
  });

  it('a tap on a man (touch) opens the exit behind him; a tap on the world opens it right where it landed', () => {
    const { R, man, freeze, input, step, camera } = rig({ device: 'touch' });
    const g = man(V(0, 0, 14), Math.PI);
    freeze(g);
    step(1);
    // a tap on the middle of the screen: along the ray the camera has
    input.worldTap = { x: 0, y: 0 };
    step(1);
    expect(R.pair).not.toBeNull();
    // (the camera looks +z from (0, 1.8, -3): the ray goes through the man's chest-high)
    void camera;
  });
});

describe('AIM PORTAL: PORTAL next to a man, at any range', () => {
  it('the crosshair on (or near) a man at 8, 20 and 32 m: PORTAL (no modifier) opens the exit 1.3 m behind him as you see him, facing him, on his floor; the ghost and a ring show it first', () => {
    for (const d of [8, 20, 32]) {
      const { R, man, freeze, aimAt, tap, step } = rig();
      const g = man(V(0, 0, d), Math.PI);
      freeze(g);
      // the crosshair 2° off his body
      aimAt(V(0.42 + AIMP.magnet.pad + Math.tan(THREE.MathUtils.degToRad(2)) * d, 1.2, d));
      step(1);
      expect(R.hover).toBe(g);
      expect(R.ghost?.kind).toBe('snap');
      expect(R.ghost!.spot.pos.distanceTo(V(0, R.ghost!.spot.pos.y, d + AIMP.magnet.dist))).toBeLessThan(0.05);
      tap();
      expect(R.pair).not.toBeNull();
      expect(R.pair!.man).toBe(g.id);
      const f = R.pair!.far;
      expect(f.pos.distanceTo(V(0, f.pos.y, d + AIMP.magnet.dist))).toBeLessThan(0.05);
      expect(f.normal.z).toBeCloseTo(-1, 5);
      expect(f.pos.y - f.h / 2).toBeCloseTo(0.02, 2);
      // (the pair stands there now: no ghost on top of it)
      step(1);
      expect(R.ghost).toBeNull();
    }
  });

  it('touch: a tap within 60 px of a man on the screen opens next to him; the PORTAL button with him 6° off the crosshair too', () => {
    const { R, man, freeze, input, step, camera, aimAt, tap } = rig({ device: 'touch' });
    const g = man(V(2, 0, 20), Math.PI);
    freeze(g);
    step(1);
    const W = 844, H = 390;
    const c = g.chest(new THREE.Vector3()).project(camera);
    const px = ((c.x + 1) / 2) * W + 50, py = ((1 - c.y) / 2) * H;
    input.worldTap = { x: (px / W) * 2 - 1, y: -((py / H) * 2 - 1), w: W, h: H };
    step(1);
    expect(R.pair?.man).toBe(g.id);
    R.closePair();
    step(20);
    // the button: the crosshair 6° to his side
    aimAt(V(2 + 0.77 + Math.tan(THREE.MathUtils.degToRad(6)) * 20, 1.2, 20));
    tap();
    expect(R.pair?.man).toBe(g.id);
  });

  it('a tap on the plain world with a pair open leaves the pair alone (a nudge of the look thumb); on a man it moves it to him', () => {
    const { R, man, freeze, input, step, aimAt, tap } = rig({ device: 'touch' });
    const g = man(V(0, 0, 14), Math.PI);
    freeze(g);
    aimAt(V(0, 1.2, 14));
    tap();
    const id = R.pair!.id;
    step(20);
    input.worldTap = { x: 0.8, y: -0.6, w: 844, h: 390 };
    step(1);
    expect(R.pair!.id).toBe(id);
  });

  it('held on him past a tap, the look picks his side and the exit goes there live; let go: it stays; a quick tap is the default side', () => {
    const { R, man, freeze, aimAt, hold, letGo, input, step } = rig();
    const g = man(V(0, 0, 14), Math.PI);
    freeze(g);
    aimAt(V(0, 1.2, 14));
    hold(Math.ceil(AIMP.snap.pick * 60) + 2);
    expect(R.pair!.man).toBe(g.id);
    expect(R.snapLatched).toBe(true);
    input.snapVec = { x: 0, y: 1 };
    step(1);
    expect(R.pair!.far.surface).toBe('ceiling');
    expect(R.pair!.far.pos.y).toBeGreaterThan(g.height);
    input.snapVec = { x: 1, y: 0 };
    step(1);
    // (you look +z at him: your screen's right is -x)
    expect(R.pair!.far.pos.x).toBeCloseTo(-AIMP.magnet.dist, 1);
    expect(R.pair!.side).toBe('right');
    input.portal = false;
    letGo();
    input.snapVec = { x: 0, y: 0 };
    step(10);
    expect(R.snapLatched).toBe(false);
    expect(R.pair!.far.pos.x).toBeCloseTo(-AIMP.magnet.dist, 1);
    // the look is the camera's again while not held
  });

  it('his back to a wall (no room behind him): PORTAL on him opens at his side instead, still next to him, facing him', () => {
    const { R, man, freeze, aimAt, tap, sc } = rig();
    sc.world.add(V(-5, 0, 14.5), V(5, 4, 15.5));
    const g = man(V(0, 0, 14), Math.PI);
    freeze(g);
    aimAt(V(0, 1.2, 14));
    tap();
    expect(R.pair).not.toBeNull();
    const f = R.pair!.far;
    expect(Math.abs(f.pos.x)).toBeCloseTo(AIMP.magnet.dist, 1);
    // (slid off the wall: its edge clear of it, still by him)
    expect(Math.abs(f.pos.z - 14)).toBeLessThanOrEqual(AIMP.magnet.slide);
    expect(f.pos.z + f.w / 2).toBeLessThanOrEqual(14.5 + 0.01);
    expect(Math.abs(f.normal.x)).toBeGreaterThan(0.99);
    expect(Math.sign(f.normal.x)).toBe(-Math.sign(f.pos.x));
  });

  it('a man on the move: the exit opens next to where he will be in a moment', () => {
    const { R, man, aimAt, tap, step } = rig();
    const g = man(V(0, 0, 14), Math.PI);
    aimAt(V(0, 1.2, 14));
    step(1);
    g.body!.vel.set(4, 0, 0);
    tap(undefined, 1);
    expect(R.pair!.far.pos.x).toBeCloseTo(4 * AIMP.magnet.lead, 0);
  });
});

describe('AIM PORTAL: a man through your near twin', () => {
  it('a man who drops through the exit under his feet tumbles out of your near twin in front of you (not flung past you)', () => {
    const { R, rifts, man, freeze, tap, aimAt } = rig();
    const g = man(V(0, 0, 14), Math.PI);
    freeze(g);
    aimAt(V(0, 1.2, 14));
    tap();
    const ends = rifts.strikeEnds(R.pair!.strike)!;
    // out of the near twin at his fall speed, turned toward you
    g.body!.vel.set(0, 0, -6);
    R.manCrossed(g, ends.b, ends.a);
    const n = ends.a.normal;
    expect(Math.hypot(g.body!.vel.x, g.body!.vel.z)).toBeCloseTo(AIMP.pull.drop, 5);
    expect(g.body!.vel.z * n.z).toBeGreaterThan(0);
    // (out of anything else: untouched)
    g.body!.vel.set(0, 0, -6);
    R.manCrossed(g, ends.a, ends.b);
    expect(g.body!.vel.z).toBe(-6);
  });
});

describe('AIM PORTAL: GO', () => {
  it('GO: a dash of about 0.12 s into the near twin; out of the exit by him at a steady speed along its front, the view turned with the pair (toward him); the pair shuts behind you', () => {
    const { R, man, freeze, aimAt, tap, input, step, crossings, pos, vel, ray, state } = rig({ move: true });
    const g = man(V(0, 0, 20), Math.PI);
    freeze(g);
    aimAt(V(0, 1.2, 20));
    tap();
    const t0 = state.time;
    input.goPress = true;
    step(1);
    expect(R.dash).not.toBeNull();
    for (let n = 0; n < 30 && !crossings.length; n++) step(1);
    expect(crossings.length).toBe(1);
    expect(state.time - t0).toBeLessThanOrEqual(AIMP.go.time + 0.04);
    expect(AIMP.go.time).toBeLessThanOrEqual(0.15);
    expect(R.dash).toBeNull();
    // out of the exit 1.3 m behind him, heading at him, the view along the exit's front
    expect(Math.hypot(pos.x, pos.z - (20 + AIMP.magnet.dist))).toBeLessThan(0.4);
    expect(vel.z).toBeCloseTo(-AIMP.go.arrive, 1);
    expect(crossings[0].turn).toBeCloseTo(Math.PI, 3);
    expect(ray.dir.z).toBeLessThan(-0.9);
    expect(R.edgeUntil).toBeGreaterThan(state.time);
    step(Math.ceil(AIMP.go.close * 60) + 2);
    expect(R.pair).toBeNull();
    // you glide in close, you do not slam into him
    step(30);
    expect(Math.hypot(pos.x - g.pos.x, pos.z - g.pos.z)).toBeGreaterThan(0.6);
    expect(Math.hypot(pos.x - g.pos.x, pos.z - g.pos.z)).toBeLessThan(AIMP.stab.direct);
  });

  it('a STAB pressed during the dash lands on arrival (buffered), from behind: dead', () => {
    const { R, man, freeze, aimAt, tap, input, step, crossings } = rig({ move: true });
    const g = man(V(0, 0, 14), Math.PI);
    freeze(g);
    aimAt(V(0, 1.2, 14));
    tap();
    input.goPress = true;
    step(1);
    input.stabPress = true;
    step(1);
    expect(crossings.length).toBe(0);
    expect(g.alive).toBe(true);
    for (let n = 0; n < 20 && g.alive; n++) step(1);
    expect(crossings.length).toBe(1);
    expect(g.alive).toBe(false);
    expect(R.usage.stabDirect).toBe(1);
  });

  it('just out of the exit the knife reaches 1 m further (he stepped away): for AIMP.stab.edgeTime s, not after', () => {
    const { R, man, freeze, aimAt, tap, input, step, crossings, pos } = rig({ move: true });
    const g = man(V(0, 0, 14), Math.PI);
    freeze(g);
    aimAt(V(0, 1.2, 14));
    tap();
    input.goPress = true;
    step(1);
    for (let n = 0; n < 20 && !crossings.length; n++) step(1);
    // he stepped 1.2 m away from where he was
    g.body!.pos.z -= 1.3;
    const d = Math.hypot(pos.x - g.pos.x, pos.z - g.pos.z);
    expect(d).toBeGreaterThan(AIMP.stab.direct);
    expect(d).toBeLessThan(AIMP.stab.direct + AIMP.stab.edge);
    expect(R.stabState()).toBe('melee');
    input.stabPress = true;
    step(1);
    expect(g.alive).toBe(false);
    expect(R.usage.edge).toBe(1);
    // the same, too late
    const r2 = rig({ move: true });
    const h = r2.man(V(0, 0, 14), Math.PI);
    r2.freeze(h);
    r2.aimAt(V(0, 1.2, 14));
    r2.tap();
    r2.input.goPress = true;
    r2.step(1);
    for (let n = 0; n < 20 && !r2.crossings.length; n++) r2.step(1);
    r2.step(Math.ceil(AIMP.stab.edgeTime * 60) + 2);
    h.body!.pos.set(r2.pos.x, 0, r2.pos.z - (AIMP.stab.direct + 0.5));
    r2.input.stabPress = true;
    r2.step(1);
    expect(h.alive).toBe(true);
  });

  it('GO through an exit over his head: you drop in right behind him, facing his back, and the knife lands', () => {
    const { R, man, freeze, aimAt, hold, letGo, input, step, crossings, pos, player } = rig({ move: true });
    const g = man(V(0, 0, 10), Math.PI);
    freeze(g);
    aimAt(V(0, 1.2, 10));
    hold(Math.ceil(AIMP.snap.pick * 60) + 2);
    input.snapVec = { x: 0, y: 1 };
    step(1);
    input.portal = false;
    letGo();
    input.snapVec = { x: 0, y: 0 };
    expect(R.pair!.far.surface).toBe('ceiling');
    input.goPress = true;
    step(1);
    for (let n = 0; n < 30 && !crossings.length; n++) step(1);
    expect(crossings.length).toBe(1);
    // behind him (he faces -z: his back is +z), looking the way he looks
    expect(pos.z).toBeGreaterThan(10.3);
    expect(Math.abs(pos.x)).toBeLessThan(0.3);
    expect(Math.cos(player.yaw - g.yaw)).toBeGreaterThan(0.95);
    input.stabPress = true;
    for (let n = 0; n < 40 && g.alive; n++) step(1);
    expect(g.alive).toBe(false);
  });

  it('GO held up on the way in (a body in the way): it goes through all the same, out of the exit, the view with it', () => {
    const { R, man, freeze, aimAt, tap, input, step, hops, player, pos } = rig({ move: true });
    const g = man(V(0, 0, 14), Math.PI);
    freeze(g);
    aimAt(V(0, 1.2, 14));
    tap();
    // (the dash never moves you: something stands in the way)
    player.lunge = () => {};
    input.goPress = true;
    step(1);
    expect(R.dash).not.toBeNull();
    step(Math.ceil((AIMP.go.time + AIMP.go.stall) * 60) + 2);
    expect(R.dash).toBeNull();
    expect(hops.length).toBe(1);
    expect(R.usage.goThrough).toBe(1);
    // out of the exit's front (1.3 m behind him, facing him): between the exit and him
    expect(Math.abs(pos.x)).toBeLessThan(0.1);
    expect(pos.z).toBeLessThan(14 + AIMP.magnet.dist - 0.3);
    expect(pos.z).toBeGreaterThan(14 + 0.5);
    expect(Math.cos(hops[0].yaw - Math.PI)).toBeGreaterThan(0.99);
  });

  it('out of a door on a wall by GO, nobody in front: a step clear of the wall (room for the view); a man there: no step into him', () => {
    const { R, aimAt, tap, input, step, crossings, pos, sc } = rig({ move: true });
    sc.world.add(V(-10, 0, 12), V(10, 4, 13));
    aimAt(V(0, 1.2, 12));
    tap();
    expect(R.pair!.far.surface).toBe('wall');
    input.goPress = true;
    step(1);
    for (let n = 0; n < 30 && !crossings.length; n++) step(1);
    expect(crossings.length).toBe(1);
    step(30);
    expect(12 - pos.z).toBeGreaterThanOrEqual(AIMP.go.step * 0.9);
    // the same with a man 1.3 m out from the door: you stop short of him
    const r2 = rig({ move: true });
    r2.sc.world.add(V(-10, 0, 12), V(10, 4, 13));
    const g = r2.man(V(3, 0, 10.7), 0);
    r2.freeze(g);
    r2.aimAt(V(3, 1.2, 12));
    r2.step(1);
    r2.R.closePair();
    // (the crosshair off him, on the wall beside him: the door opens on the wall)
    r2.aimAt(V(3.9, 1.0, 12));
    r2.tap();
    if (r2.R.pair && r2.R.pair.far.surface === 'wall') {
      r2.input.goPress = true;
      r2.step(1);
      for (let n = 0; n < 30 && !r2.crossings.length; n++) r2.step(1);
      r2.step(20);
      expect(Math.hypot(r2.pos.x - g.pos.x, r2.pos.z - g.pos.z)).toBeGreaterThan(0.75);
    }
  });

  it('no pair: GO does nothing (a word); while you dash, PORTAL waits', () => {
    const { R, input, step, calls } = rig({ move: true });
    input.goPress = true;
    step(1);
    expect(R.dash).toBeNull();
    expect(calls).toContain('aim.noPair');
  });

  it('you turn up behind him through your pair: he has lost you for a beat (no turning to you, no shot) before he finds you', () => {
    const { man, step, pos, R } = rig();
    const g = man(V(0, 0, 10), Math.PI);
    const m = R.ai.mind(g, Math.random);
    m.react = 0;
    step(30);
    const yaw0 = g.yaw;
    // you vanish and turn up 1 m behind him
    pos.set(0, 0, 11);
    step(Math.round((AIMP.notice.back - 0.2) * 60));
    expect(Math.abs(g.yaw - yaw0)).toBeLessThan(0.05);
    step(Math.round(0.6 * 60));
    let d = g.yaw - Math.atan2(pos.x - g.pos.x, pos.z - g.pos.z);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    expect(Math.abs(d)).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// The gate: AIM PORTAL only in the lab; the missions as they were; the old verbs off
// ---------------------------------------------------------------------------

describe('AIM PORTAL: the gate', () => {
  it('the lab offers AIM PORTAL only (and starts there); outside the lab everything is CURRENT', () => {
    expect(VARIANTS).toContain('aimportal');
    expect(LAB_OFFERED).toEqual(['aimportal']);
    setVariant('aimportal');
    expect(activeVariant()).toBe('current');
    expect(aimOn()).toBe(false);
    setLabActive(true);
    expect(aimOn()).toBe(true);
    expect(reachOn()).toBe(false);
  });

  it('it moves on FLOW’s body and nothing else of the old variants (no POWER, no PRECISION, no ONSLAUGHT, no REACH)', () => {
    expect(flowBodyOn('aimportal')).toBe(true);
    expect(flowOn('aimportal')).toBe(false);
    expect(precisionOn('aimportal')).toBe(false);
    expect(onslaughtOn('aimportal')).toBe(false);
    expect(reachOn('aimportal')).toBe(false);
    for (const v of ['current', 'precision', 'onslaught'] as const) expect(flowBodyOn(v)).toBe(false);
  });

  it('the old verbs are off: no blade or grab prompt, no trap targets (the lab only)', () => {
    setLabActive(true);
    setVariant('aimportal');
    const g = Object.create(Game.prototype) as any;
    Object.assign(g, { lab: {}, respawnT: -1, player: { body: { pos: V() } } });
    expect(g.contextAction()).toBeNull();
    expect(g.trapTargets()).toEqual([]);
  });

  it('the missions play as they did: outside the lab no variant rule applies', () => {
    setVariant('aimportal');
    setLabActive(false);
    expect(aimOn()).toBe(false);
    expect(flowBodyOn()).toBe(false);
    expect(activeVariant()).toBe('current');
  });

  it('AIM PORTAL’s own tools in the results; its sequence is its own five waves', () => {
    expect(labTools('aimportal')).toEqual(['rifle', 'knife', 'throw', 'redirect', 'other']);
    const arena = labArena();
    expect(labWaves(arena, 'aimportal').length).toBe(5);
    expect(labWaves(arena, 'aimportal')).not.toBe(labWaves(arena, 'reach'));
    const d = new LabDirector(arena, { spawn: () => 1, alive: () => false });
    expect(d.waves.length).toBeGreaterThan(0);
  });
});

describe('AIM PORTAL: waves and the men', () => {
  it('3, 4, 5, 6, 8 men; gunners first, mirrors from wave 2, rushers from wave 3', () => {
    expect(AIM_WAVES.map((w) => w.spawns.length)).toEqual([3, 4, 5, 6, 8]);
    const kinds = (i: number) => new Set(AIM_WAVES[i].spawns.map((s) => s.aim));
    expect(kinds(0)).toEqual(new Set(['gunner']));
    expect(kinds(1).has('mirror')).toBe(true);
    expect(kinds(1).has('rusher')).toBe(false);
    for (const i of [2, 3, 4]) {
      expect(kinds(i).has('mirror')).toBe(true);
      expect(kinds(i).has('rusher')).toBe(true);
    }
    expect(AIM_WAVES.every((w) => w.ready)).toBe(true);
  });

  it('their numbers: gunner 60 hp and 12-damage bolts, mirror 70 hp, rusher 50 hp, knife 25', () => {
    expect(AIMP.enemy.gunner.hp).toBe(60);
    expect(AIMP.enemy.gunner.damage).toBe(12);
    expect(AIMP.enemy.gunner.aim).toBe(0.5);
    expect(AIMP.enemy.mirror.hp).toBe(70);
    expect(AIMP.enemy.mirror.returnChance).toBeCloseTo(0.3, 6);
    expect(AIMP.enemy.rusher.hp).toBe(50);
    expect(AIMP.enemy.rusher.windup).toBe(0.45);
    expect(AIMP.enemy.rusher.damage).toBe(25);
    expect(AIMP.enemy.rusher.portalTele).toBe(0.5);
    expect(AIMP.rifle.mag).toBe(24);
    expect(AIMP.rifle.reload).toBe(1.4);
    expect(AIMP.hero.hp).toBe(100);
    expect(LAW.player.regenDelay).toBe(4);
  });

  it('each man spawned with his role has his hp', () => {
    const { man } = rig();
    expect(man(V(0, 0, 10), Math.PI, 'gunner').hp).toBe(60);
    expect(man(V(3, 0, 10), Math.PI, 'mirror').hp).toBe(70);
    expect(man(V(6, 0, 10), Math.PI, 'rusher').hp).toBe(50);
  });

  it('a gunner burst: the red laser for 0.5 s, then three rounds; a rusher: a 0.45 s wind-up before the blow', () => {
    const { R, man, sc } = rig();
    const g = man(V(0, 0, 14), Math.PI);
    const m = R.ai.mind(g, Math.random);
    m.react = 0;
    R.ai.host.go = () => true;
    sc.player.pos.set(0, 0, 0);
    sc.player.chest.set(0, 1.3, 0);
    const lasers: number[] = [];
    (R.ai.host as any).laser = (_e: any, _a: any, _b: any, k: number) => lasers.push(k);
    const fired: number[] = [];
    (R.ai.host as any).fireBolt = () => fired.push(sc.clock.t);
    m.mode = 'peek';
    m.hasSpot = true;
    m.spot.copy(g.pos);
    m.modeT = 3;
    sc.step(Math.ceil(2 * 60));
    expect(lasers.length).toBeGreaterThan(5);
    expect(fired.length).toBeGreaterThanOrEqual(AIMP.enemy.gunner.shots);
    // (the laser runs about AIMP.enemy.gunner.aim s before the first round)
    expect(fired[2] - fired[0]).toBeCloseTo(2 * AIMP.enemy.gunner.gap, 1);
  });
});

describe('AIM PORTAL: a man hit mid-move drops it', () => {
  it('a gunner aiming who is knocked off his feet does not keep a gun slot (his laser is off when he is back)', () => {
    const { R, man, sc } = rig();
    const g = man(V(0, 0, 14), Math.PI);
    const m = R.ai.mind(g, Math.random);
    m.react = 0;
    R.ai.host.go = () => true;
    m.gun = 'aim';
    m.gunT = 0.4;
    sc.step(2);
    expect(R.ai.aiming(g.id)).toBe(true);
    sc.sys.stagger(g, 0.6);
    sc.step(Math.ceil(0.9 * 60));
    // (back on his feet and thinking again: a laser under way is not resumed)
    expect((m.gun as string) === 'idle' || m.gunT > 0.3).toBe(true);
    expect(g.state).toBe('combat');
  });
});

// ---------------------------------------------------------------------------
// i18n: EN and HE for every AIM PORTAL key
// ---------------------------------------------------------------------------

describe('AIM PORTAL: words, EN and HE', () => {
  const keys = [
    'lab.v.aimportal', 'lab.vd.aimportal', 'lab.tool.throw',
    ...AIM_WAVES.map((w) => w.subKey),
    'aim.rule.title', 'aim.rule.portal', 'aim.rule.fire', 'aim.rule.stab', 'aim.rule.pull', 'aim.rule.snap', 'aim.rule.go',
    'aim.sealed', 'aim.close', 'aim.stab.melee', 'aim.stab.kill', 'aim.stab.blocked', 'aim.throw', 'aim.reload', 'aim.parried',
    'aim.noPair', 'aim.nobody', 'aim.pulled', 'aim.through',
    ...SIDES.map((s) => `aim.side.${s}`),
    'aim.tip.kbm', 'aim.tip.pad', 'aim.tip.touch',
    'touch.aimportal', 'touch.fire', 'touch.stab', 'touch.pull', 'touch.throw', 'touch.go',
  ];
  it('the rules card names every verb, GO included', async () => {
    const { AIM_RULES } = await import('../../src/ui/labhud');
    for (const k of ['portal', 'snap', 'go', 'fire', 'stab', 'pull']) expect(AIM_RULES).toContain(k);
  });
  it('every key exists in both languages, and the Hebrew is not the English', () => {
    const en = strings('en'), he = strings('he');
    for (const k of keys) {
      expect(en[k], `en ${k}`).toBeTruthy();
      expect(he[k], `he ${k}`).toBeTruthy();
      if (!/^(aim\.tip|lab\.tool\.throw)/.test(k)) expect(he[k], `he differs ${k}`).not.toBe(en[k]);
    }
  });
});

// ---------------------------------------------------------------------------
// CHAIN (the add-on): links one after another
// ---------------------------------------------------------------------------

describe('AIM PORTAL: CHAIN', () => {
  /** A chain set piece: the hero at the origin looking +z; a wall ahead at z 14, a wall to the left (x -9) and to the right (x 9). */
  function chainRig() {
    const r = rig({ move: true });
    r.sc.world.add(V(-12, 0, 14), V(12, 5, 14.5));
    r.sc.world.add(V(-9.5, 0, 2), V(-9, 5, 14));
    r.sc.world.add(V(9, 0, 2), V(9.5, 5, 14));
    const press = () => {
      r.input.chainPress = true;
      r.step(1);
      r.input.chainPress = false;
    };
    const wait = (s: number) => r.step(Math.ceil(s * 60));
    /** PORTAL aimed at p (a tap), then the cooldown. */
    const link = (p: THREE.Vector3) => {
      r.tap(p);
      wait(AIMP.cooldown + 0.05);
    };
    return { ...r, press, link, wait };
  }

  it('CHAIN starts a chain; each PORTAL after it adds the next link: the pair first (its twin and exit are links 1 and 2), then the surface under the crosshair, in order, up to four', () => {
    const { R, press, link, hops } = chainRig();
    expect(R.chain).toBeNull();
    press();
    expect(R.chain).not.toBeNull();
    expect(R.chain!.placing).toBe(true);
    expect(R.chainLinks).toBe(0);
    link(V(0, 1.6, 14));
    expect(R.pair).not.toBeNull();
    expect(R.chainLinks).toBe(2);
    expect(R.chain!.nodes.length).toBe(0);
    // the third and the fourth: on the left wall, then the right one
    link(V(-9, 1.6, 8));
    expect(R.chainLinks).toBe(3);
    expect(R.chain!.nodes[0].pos.x).toBeCloseTo(-9 + 0.05, 1);
    expect(R.chain!.nodes[0].normal.x).toBeGreaterThan(0.9);
    link(V(9, 1.6, 8));
    expect(R.chainLinks).toBe(4);
    expect(R.chain!.nodes[1].pos.x).toBeCloseTo(9 - 0.05, 1);
    expect(R.chain!.nodes[1].normal.x).toBeLessThan(-0.9);
    // (full: it stops taking links; the pair is where it was)
    expect(CHAIN.max).toBe(4);
    expect(R.chain!.placing).toBe(false);
    expect(hops.length).toBe(0);
  });

  it('GO carries you through the chain: out of the exit as ever, then out of each link in order, 0.1 s apart, the speed kept, facing out of the link', () => {
    const { R, press, link, hops, input, step, crossings, pos, state, vel, wait } = chainRig();
    press();
    link(V(0, 1.6, 14));
    link(V(-9, 1.6, 8));
    link(V(9, 1.6, 8));
    const nodes = R.chain!.nodes.map((n) => n.pos.clone());
    input.goPress = true;
    step(1);
    for (let n = 0; n < 30 && !crossings.length; n++) step(1);
    expect(crossings.length).toBe(1);
    const tCross = state.time;
    const v0 = Math.hypot(vel.x, vel.z);
    expect(v0).toBeGreaterThanOrEqual(AIMP.go.arrive - 0.01);
    wait(0.5);
    expect(hops.length).toBe(2);
    // in order: the left link, then the right
    expect(hops[0].feet.x).toBeLessThan(0);
    expect(hops[1].feet.x).toBeGreaterThan(0);
    expect(hops[0].feet.distanceTo(nodes[0])).toBeLessThan(1.3);
    expect(hops[1].feet.distanceTo(nodes[1])).toBeLessThan(1.3);
    // (each about CHAIN.hop s after the last arrival)
    expect(hops[0].t - tCross).toBeGreaterThanOrEqual(CHAIN.hop - 1 / 60);
    expect(hops[0].t - tCross).toBeLessThan(CHAIN.hop + 0.1);
    expect(hops[1].t - hops[0].t).toBeGreaterThanOrEqual(CHAIN.hop - 1 / 60);
    expect(hops[1].t - hops[0].t).toBeLessThan(CHAIN.hop + 0.05);
    // the speed carried, along each link's front, the way you face its own
    for (const h of hops) expect(Math.hypot(h.vel.x, h.vel.z)).toBeCloseTo(v0, 3);
    expect(hops[0].vel.x).toBeGreaterThan(v0 * 0.99);
    expect(hops[1].vel.x).toBeLessThan(-v0 * 0.99);
    expect(hops[0].yaw).toBeCloseTo(Math.PI / 2, 2);
    expect(hops[1].yaw).toBeCloseTo(-Math.PI / 2, 2);
    // the chain ends there: no more hops, and you stand on solid ground at the last link's foot
    expect(R.chain).not.toBeNull();
    expect(hops[1].feet.y).toBeGreaterThanOrEqual(0);
    expect(Math.abs(pos.y)).toBeLessThan(0.5);
  });

  it('a chain of two links is the pair alone: nothing carries you on', () => {
    const { R, press, link, hops, input, step, crossings, wait } = chainRig();
    press();
    link(V(0, 1.6, 14));
    expect(R.chainLinks).toBe(2);
    input.goPress = true;
    step(1);
    for (let n = 0; n < 30 && !crossings.length; n++) step(1);
    wait(0.5);
    expect(hops.length).toBe(0);
  });

  it('CHAIN again, 8 s after the last link, your death, or a new pair after a chain that is done: each shuts all of it (the pair too)', () => {
    // CHAIN again
    let c = chainRig();
    c.press();
    c.link(V(0, 1.6, 14));
    c.link(V(-9, 1.6, 8));
    c.press();
    expect(c.R.chain).toBeNull();
    expect(c.R.pair).toBeNull();
    expect(c.rifts.strikeOpen()).toBe(false);
    // 8 s
    c = chainRig();
    c.press();
    c.link(V(0, 1.6, 14));
    c.link(V(-9, 1.6, 8));
    c.wait(CHAIN.life - 1);
    expect(c.R.chain).not.toBeNull();
    expect(c.R.pair).not.toBeNull();
    c.wait(1.2);
    expect(c.R.chain).toBeNull();
    expect(c.R.pair).toBeNull();
    expect(c.rifts.strikeOpen()).toBe(false);
    // (each link restarts the clock)
    c = chainRig();
    c.press();
    c.link(V(0, 1.6, 14));
    c.wait(CHAIN.life - 1);
    c.link(V(-9, 1.6, 8));
    c.wait(CHAIN.life - 1);
    expect(c.R.chain).not.toBeNull();
    // death
    c = chainRig();
    c.press();
    c.link(V(0, 1.6, 14));
    c.state.alive = false;
    c.step(2);
    expect(c.R.chain).toBeNull();
    expect(c.R.pair).toBeNull();
    // a full chain: the next PORTAL is a new pair, and the chain is gone
    c = chainRig();
    c.press();
    c.link(V(0, 1.6, 14));
    c.link(V(-9, 1.6, 8));
    c.link(V(9, 1.6, 8));
    expect(c.R.chain!.placing).toBe(false);
    const id = c.R.pair!.id;
    c.link(V(0, 1.6, 14));
    expect(c.R.chain).toBeNull();
    expect(c.R.pair).not.toBeNull();
    expect(c.R.pair!.id).not.toBe(id);
  });

  it('without CHAIN a press is the pair as ever (it shuts after its time, the chain is not there); one that has been used stops taking links', () => {
    const { R, tap, step } = chainRig();
    tap(V(0, 1.6, 14));
    expect(R.chain).toBeNull();
    expect(R.chainLinks).toBe(0);
    step(Math.ceil(AIMP.life * 60) + 3);
    expect(R.pair).toBeNull();
    // (used: after the crossing the chain stops placing; a press is a new pair)
    const c = chainRig();
    c.press();
    c.link(V(0, 1.6, 14));
    c.link(V(-9, 1.6, 8));
    c.input.goPress = true;
    c.step(1);
    for (let n = 0; n < 30 && !c.crossings.length; n++) c.step(1);
    expect(c.R.chain!.placing).toBe(false);
  });

  it('a link needs a surface: mid-air, the sealed, or a spot on top of another is refused (and the chain keeps what it has)', () => {
    const { R, sc, press, link, calls, step } = chainRig();
    press();
    link(V(0, 1.6, 14));
    // the open sky: mid-air
    link(V(0, 20, 30));
    expect(R.chain!.nodes.length).toBe(0);
    expect(calls).toContain('aim.chain.air');
    // a sealed panel
    sc.world.add(V(4, 0, 6), V(8, 3, 6.4), { noPortal: true });
    link(V(6, 1.6, 6));
    expect(R.chain!.nodes.length).toBe(0);
    expect(calls).toContain('aim.sealed');
    // on the exit's own spot
    link(V(0, 1.6, 14));
    expect(R.chain!.nodes.length).toBe(0);
    // a real one
    link(V(-9, 1.6, 8));
    expect(R.chain!.nodes.length).toBe(1);
    step(1);
  });

  it('it cannot soft-lock: a link with no room out of it stops the chain where you are (on solid ground), and a hop never puts you inside a wall', () => {
    const { R, sc, press, link, hops, input, step, crossings, wait, pos, calls } = chainRig();
    press();
    link(V(0, 1.6, 14));
    link(V(-9, 1.6, 8));
    // a block in front of that link, filling the room out of it
    sc.world.add(V(-8.9, 0, 6), V(-6.5, 3, 10));
    input.goPress = true;
    step(1);
    for (let n = 0; n < 30 && !crossings.length; n++) step(1);
    wait(0.6);
    expect(hops.length).toBe(0);
    expect(calls).toContain('aim.chain.blocked');
    expect(pos.x).toBeGreaterThan(-1);
    expect(sc.world.overlapsCylinder(pos.x, pos.z, 0.34, pos.y + 0.05, pos.y + 1.75)).toBe(false);
    expect(R.chain).not.toBeNull();
  });

  it('where a hop puts you: out of a wall link along its front, on a floor link standing on it, under a ceiling link falling; null when the room is taken', () => {
    const w = flatWorld();
    const spot = (pos: THREE.Vector3, normal: THREE.Vector3, hdir = V(0, 0, 1), h = 2.1) => ({ pos, normal, hdir, h });
    const wall = chainArrival(w, spot(V(5, 1.07, 3), V(-1, 0, 0)), 6, -3);
    expect(wall!.pos.x).toBeCloseTo(5 - CHAIN.clear[0], 5);
    expect(wall!.pos.y).toBeCloseTo(0.02, 2);
    expect(wall!.vel.x).toBeCloseTo(-6, 5);
    expect(wall!.vel.y).toBeLessThanOrEqual(1);
    expect(wall!.yaw).toBeCloseTo(-Math.PI / 2, 5);
    const floor = chainArrival(w, spot(V(2, 0.05, 2), V(0, 1, 0), V(1, 0, 0), 1.4), 5, 0);
    expect(floor!.pos.y).toBeCloseTo(0.07, 5);
    expect(floor!.vel.x).toBeCloseTo(5, 5);
    const ceil = chainArrival(w, spot(V(0, 5, 0), V(0, -1, 0), V(0, 0, 1), 1.4), 4, 0);
    expect(ceil!.pos.y).toBeCloseTo(5 - 1.85, 5);
    expect(ceil!.vel.y).toBeLessThan(0);
    // the room taken: nowhere out of it
    w.add(V(2, 0, -2), V(8, 3, 8));
    expect(chainArrival(w, spot(V(1.95, 1.07, 3), V(1, 0, 0)), 6, 0)).toBeNull();
    // (the nearer the wall, the further out it tries: 0.6, 0.9, 1.2)
    const w2 = flatWorld();
    w2.add(V(5.2, 0, -5), V(6, 3, 10));
    const near = chainArrival(w2, spot(V(6.05, 1.07, 3), V(-1, 0, 0)), 6, 0);
    expect(near).not.toBeNull();
  });

  it('gated: nothing happens unless you are alive and the fight is on; the chain is the lab’s (the missions never have AIM PORTAL on)', () => {
    const r = chainRig();
    r.state.alive = false;
    r.press();
    expect(r.R.chain).toBeNull();
    setLabActive(false);
    expect(aimOn()).toBe(false);
    expect(AIM_RULES).toContain('chain');
    expect(Object.keys(strings('en')).filter((k) => k.startsWith('aim.chain')).length).toBeGreaterThanOrEqual(5);
  });
});
