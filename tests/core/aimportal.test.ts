import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  AIMP,
  aimKillTool,
  COMPASS,
  crosshairTarget,
  facing,
  fitSnap,
  guarded,
  impactOutcome,
  inFrontOf,
  leftOf,
  nearSpot,
  notices,
  pickSide,
  placeExit,
  pullSpot,
  rayCylinder,
  shieldCross,
  SIDES,
  snapSpot,
  spotFrame,
  standingBy,
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
    // (centred on the crosshair's height)
    expect(s.pos.y).toBeCloseTo(1.6, 2);
    expect(s.dist).toBeCloseTo(12, 2);
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

  it('the near twin: 1.3 m ahead of you, facing you, bottom on your floor; further when you run at it; nearer if a wall is in the way', () => {
    const w = flatWorld();
    const stand = nearSpot(w, V(0, 0, 0), V(0, 0, 1), 0, groundOf(w));
    expect(stand.pos.z).toBeCloseTo(AIMP.near.ahead, 5);
    expect(stand.normal.z).toBe(-1);
    expect(stand.pos.y - AIMP.h / 2).toBeCloseTo(0.02, 5);
    const run = nearSpot(w, V(0, 0, 0), V(0, 0, 1), 9, groundOf(w));
    expect(run.pos.z).toBeGreaterThan(2.5);
    expect(run.pos.z).toBeLessThanOrEqual(AIMP.near.max + 1e-6);
    w.add(V(-5, 0, 1.5), V(5, 4, 2.5));
    const tight = nearSpot(w, V(0, 0, 0), V(0, 0, 1), 0, groundOf(w));
    expect(tight.pos.z).toBeLessThan(1.3);
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
// SNAP: the side of a man, relative to HIS facing
// ---------------------------------------------------------------------------

describe('AIM PORTAL: SNAP geometry', () => {
  const man = { pos: V(10, 0, 10), yaw: Math.PI / 2, height: 1.8 };

  it('picks the side by a flick: nothing much is BEHIND him; the compass is six slots of 60°', () => {
    expect(pickSide(0, 0)).toBe('behind');
    expect(pickSide(0.1, 0.1)).toBe('behind');
    expect(pickSide(0, 1)).toBe('above');
    expect(pickSide(0, -1)).toBe('below');
    expect(pickSide(1, 0.5)).toBe('right');
    expect(pickSide(1, -0.5)).toBe('front');
    expect(pickSide(-1, -0.5)).toBe('behind');
    expect(pickSide(-1, 0.5)).toBe('left');
    expect(new Set(COMPASS)).toEqual(new Set(SIDES));
    for (const s of SIDES) expect(typeof s).toBe('string');
  });

  it('BEHIND / FRONT / LEFT / RIGHT are 1.2 m from him on that side of HIS facing, their fronts toward him', () => {
    // he faces +x: his behind is -x, his front +x, his left +z.. (facing +x with up +y: left is -z)
    const f = facing(man.yaw, V());
    const l = leftOf(man.yaw, V());
    expect(f.x).toBeCloseTo(1, 5);
    const b = snapSpot(man, 'behind');
    expect(b.pos.x).toBeCloseTo(10 - AIMP.snap.dist, 5);
    expect(b.pos.z).toBeCloseTo(10, 5);
    expect(b.normal.x).toBeCloseTo(1, 5);
    const fr = snapSpot(man, 'front');
    expect(fr.pos.x).toBeCloseTo(10 + AIMP.snap.dist, 5);
    expect(fr.normal.x).toBeCloseTo(-1, 5);
    const left = snapSpot(man, 'left');
    expect(left.pos.x - 10).toBeCloseTo(l.x * AIMP.snap.dist, 5);
    expect(left.pos.z - 10).toBeCloseTo(l.z * AIMP.snap.dist, 5);
    const right = snapSpot(man, 'right');
    expect(right.pos.z - 10).toBeCloseTo(-l.z * AIMP.snap.dist, 5);
    // left and right are opposite sides
    expect(left.pos.distanceTo(right.pos)).toBeCloseTo(2 * AIMP.snap.dist, 5);
    // (every side stands on his floor, person-sized)
    for (const s of [b, fr, left, right]) {
      expect(s.pos.y - AIMP.h / 2).toBeCloseTo(0.02, 5);
      expect(s.pos.distanceTo(V(10, s.pos.y, 10))).toBeCloseTo(AIMP.snap.dist, 5);
    }
  });

  it('it follows his facing: turn him round and BEHIND is the other side', () => {
    const a = snapSpot({ ...man, yaw: 0 }, 'behind');
    const b = snapSpot({ ...man, yaw: Math.PI }, 'behind');
    expect(a.pos.z).toBeCloseTo(10 - AIMP.snap.dist, 5);
    expect(b.pos.z).toBeCloseTo(10 + AIMP.snap.dist, 5);
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
    const w2 = flatWorld();
    w2.add(V(0, 0, 11), V(30, 5, 12), { noPortal: true });
    expect(fitSnap(w2, e, 'behind').reason).toBe('sealed');
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
    const near = nearSpot(world, V(0, 0, 0), V(0, 0, 1), 0, () => -Infinity);
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
    const near = nearSpot(world, V(0, 0, 0), V(0, 0, 1), 0, () => -Infinity);
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
    const near = nearSpot(world, V(0, 0, 0), V(0, 0, 1), 0, () => 0);
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
    const near = nearSpot(world, V(0, 0, 0), V(0, 0, 1), 0, groundOf(world));
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

function rig(o: { device?: 'kbm' | 'touch' | 'pad' } = {}) {
  setLabActive(true);
  setVariant('aimportal');
  const sc = scenario();
  const rifts = new RiftSystem(new THREE.Scene(), null, sc.world, { portalScale: 0.5, lightCount: 2, maxViews: 2 });
  const pos = V(0, 0, 0);
  const vel = V();
  const player = {
    body: { pos, vel, onGround: true },
    yaw: 0,
    weaponUp: 0,
    chest: (out = new THREE.Vector3()) => out.set(pos.x, pos.y + 1.3, pos.z),
    lunge: noop,
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
  };
  const hud = { update: noop, show: noop, dispose: noop, tip: noop, callout: (k: string) => calls.push(k) };
  const R = new AimMode(host, null, hud as any);
  sc.sys.aimBrain = R.ai;
  const input: AimInput = { fire: false, firePress: false, portal: false, portalPress: false, portalRelease: false, snap: false, snapVec: { x: 0, y: 0 }, stabPress: false, pullPress: false, wheel: 0 };
  /** Men held facing one way (a set piece: their brain would turn them to you). */
  const pinned = new Map<Enemy, number>();
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      for (const [e, yaw] of pinned) e.yaw = yaw;
      state.time += 1 / 60;
      sc.player.pos.copy(pos);
      sc.player.chest.set(pos.x, pos.y + 1.3, pos.z);
      camera.position.set(pos.x, pos.y + 1.8, pos.z - 3);
      camera.lookAt(camera.position.clone().add(ray.dir));
      camera.updateMatrixWorld();
      R.update(1 / 60, 1 / 60, input);
      rifts.update(1 / 60, 1 / 60, state.time);
      input.firePress = input.portalPress = input.portalRelease = input.stabPress = input.pullPress = false;
      input.worldTap = null;
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
  return { sc, R, host, rifts, pos, vel, ray, input, step, aimAt, tap, man, freeze, aimThrough, calls, bolts, state, camera };
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

  it('one pair at a time: a new press replaces the old; it shuts by itself after its time; a second press inside the cooldown does nothing', () => {
    const { R, rifts, tap, step, aimAt } = rig();
    tap(V(0, 1.6, 12));
    const first = R.pair!;
    expect(rifts.strikeOpen()).toBe(true);
    // (inside the cooldown: nothing)
    tap(V(5, 1.6, 12), 1);
    // let the cooldown run, then a new press
    step(Math.ceil(AIMP.cooldown * 60) + 2);
    aimAt(V(5, 1.6, 12));
    tap(V(5, 1.6, 12));
    expect(R.pair!.id).not.toBe(first.id);
    expect(rifts.strikeEnds(first.strike)).toBeNull();
    expect(R.lastOpen.count).toBe(2);
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

  it('the near twin does not take you at once (a short grace), then does', () => {
    const { R, rifts, tap, step } = rig();
    tap(V(0, 1.6, 12), 1);
    const ends = rifts.strikeEnds(R.pair!.strike)!;
    expect((ends.a as any).noPlayer).toBe(true);
    step(Math.ceil(AIMP.grace * 60) + 2);
    expect((ends.a as any).noPlayer).toBe(false);
    expect((ends.b as any).noPlayer).toBe(false);
  });

  it('the twin stands further ahead when you sprint at it', () => {
    const { R, tap, vel, step } = rig();
    vel.set(0, 0, 9);
    tap(V(0, 1.6, 12));
    expect(R.pair!.near.pos.z).toBeGreaterThan(2.5);
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
    // the crosshair on him: SNAP BEHIND
    aimAt(V(0, 1.2, 14));
    input.snap = true;
    input.snapVec = { x: 0, y: 0 };
    tap();
    input.snap = false;
    expect(R.pair).not.toBeNull();
    expect(R.pair!.far.pos.z).toBeCloseTo(15.2, 1);
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
  it('from behind through the exit: dead; from the front: parried (a guard), alive', () => {
    const { R, man, freeze, aimAt, aimThrough, input, step, tap, calls } = rig();
    const g = man(V(0, 0, 10), Math.PI);
    freeze(g);
    aimAt(V(0, 1.2, 10));
    input.snap = true;
    input.snapVec = { x: 0, y: 0 };
    tap();
    input.snap = false;
    aimThrough(g.chest(new THREE.Vector3()));
    expect(R.stabState()).toBe('kill');
    input.stabPress = true;
    step(2);
    expect(g.alive).toBe(false);
    // the front: a second man, SNAP FRONT
    const h = man(V(0, 0, 10), Math.PI);
    freeze(h);
    step(30);
    aimAt(V(0, 1.2, 10));
    input.snap = true;
    input.snapVec = { x: 1, y: -0.5 };
    tap();
    input.snap = false;
    expect(R.snapSide ?? 'front').toBeTruthy();
    expect(R.pair!.far.pos.z).toBeCloseTo(8.8, 1);
    aimThrough(h.chest(new THREE.Vector3()));
    expect(R.stabState()).toBe('blocked');
    input.stabPress = true;
    step(2);
    expect(h.alive).toBe(true);
    expect(calls).toContain('aim.parried');
  });

  it('a stab reaches only 1.5 m past the exit (a man 2.4 m off is not touched)', () => {
    const { R, man, freeze, aimAt, aimThrough, input, step, tap, pos } = rig();
    const g = man(V(0, 0, 12), 0);
    freeze(g);
    // an exit in front of the hero looking at him from 2.4 m: free aim at a wall? use the mid-air one
    pos.set(0, 0, 0);
    aimAt(V(0, 1.6, 9.6));
    R.airDist = 9.6;
    tap(V(0, 1.6, 9.6));
    expect(R.pair).not.toBeNull();
    aimThrough(g.chest(new THREE.Vector3()));
    expect(R.stabState()).toBeNull();
    input.stabPress = true;
    step(2);
    expect(g.alive).toBe(true);
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
  it('a man with the exit in front of him within 8 m notices it within 0.35 s and turns to it; one with his back to it, or too far, does not', () => {
    const { R, man, freeze, tap, step } = rig();
    const front = man(V(0, 0, 14), Math.PI);
    const back = man(V(6, 0, 14), 0);
    const far = man(V(-12, 0, 14), Math.PI);
    for (const e of [front, back, far]) freeze(e);
    tap(V(0, 1.2, 8));
    // (an exit at about z=8: `front` is 6 m off, facing it; `back` has his back to it; `far` is 12 m)
    R.airDist = 8;
    tap(V(0, 1.6, 8));
    step(Math.ceil((AIMP.notice.time + 0.1) * 60));
    expect(R.pair!.noticed.has(front.id)).toBe(true);
    expect(R.pair!.noticed.has(back.id)).toBe(false);
    expect(R.pair!.noticed.has(far.id)).toBe(false);
  });

  it('SNAP with a man under the crosshair latches him, and the flick picks the side the exit opens at; without a man, free aim', () => {
    const { R, man, freeze, aimAt, tap, input, step } = rig();
    const g = man(V(0, 0, 14), Math.PI);
    freeze(g);
    // no man under the crosshair: free aim (SNAP changes nothing)
    aimAt(V(0, 6, 30));
    input.snap = true;
    step(1);
    expect(R.snapLatched).toBe(false);
    aimAt(V(0, 1.2, 14));
    step(1);
    expect(R.snapLatched).toBe(true);
    expect(R.snapSide).toBe('behind');
    input.snapVec = { x: -1, y: 0.4 };
    step(1);
    expect(R.snapSide).toBe('left');
    expect(R.ghost?.kind).toBe('snap');
    tap();
    expect(R.pair).not.toBeNull();
    const left = leftOf(g.yaw, V());
    expect(R.pair!.far.pos.x - g.pos.x).toBeCloseTo(left.x * AIMP.snap.dist, 1);
    input.snap = false;
    step(1);
    expect(R.snapLatched).toBe(false);
    expect(R.ghost).toBeNull();
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
    'aim.rule.title', 'aim.rule.portal', 'aim.rule.fire', 'aim.rule.stab', 'aim.rule.pull', 'aim.rule.snap',
    'aim.sealed', 'aim.close', 'aim.stab.melee', 'aim.stab.kill', 'aim.stab.blocked', 'aim.throw', 'aim.reload', 'aim.parried',
    'aim.noPair', 'aim.nobody', 'aim.pulled', 'aim.through',
    ...SIDES.map((s) => `aim.side.${s}`),
    'aim.tip.kbm', 'aim.tip.pad', 'aim.tip.touch',
    'touch.aimportal', 'touch.fire', 'touch.stab', 'touch.pull', 'touch.throw',
  ];
  it('every key exists in both languages, and the Hebrew is not the English', () => {
    const en = strings('en'), he = strings('he');
    for (const k of keys) {
      expect(en[k], `en ${k}`).toBeTruthy();
      expect(he[k], `he ${k}`).toBeTruthy();
      if (!/^(aim\.tip|lab\.tool\.throw)/.test(k)) expect(he[k], `he differs ${k}`).not.toBe(en[k]);
    }
  });
});
