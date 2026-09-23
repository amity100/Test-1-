import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { EntranceContext } from '../../src/core/contracts';
import { LAW } from '../../src/core/contracts';
import { RiftSystem } from '../../src/game/portals';
import { frameNormal } from '../../src/game/portalMath';
import { frame, makeRifts, makeWorld, target, V } from './helpers';

/** Ground + a tall wall 20 m ahead (+Z) whose -Z face takes the exit. */
function arena() {
  const world = makeWorld();
  const wall = world.add(V(-10, 0, 20), V(10, 30, 21), { tag: 'wall' });
  const rifts = makeRifts(world);
  return { world, wall, rifts };
}

function placeWallExit(rifts: RiftSystem) {
  const eye = V(0, 1.7, 0);
  const aim = rifts.aimExit(eye, V(0, 0.2, 1).normalize(), eye, V(0, 0, 0), false, []);
  expect(aim.valid).toBe(true);
  expect(rifts.placeExit(aim)).toBe(true);
  return aim;
}

function ctx(o: Partial<EntranceContext> = {}): EntranceContext {
  return {
    playerFeet: V(0, 0, 0),
    playerVel: V(0, 0, 0),
    playerYaw: 0,
    airborne: false,
    camPos: V(0, 1.7, -2.5),
    camDir: V(0, 0, 1),
    threats: [],
    targets: [],
    ...o,
  };
}

describe('RiftSystem (renderer = null)', () => {
  it('constructs headless and reports nothing open', () => {
    const { rifts } = arena();
    expect(rifts.openEnds()).toEqual([]);
    expect(rifts.hasExit()).toBe(false);
    rifts.update(1 / 60, 1 / 60, 0);
    rifts.renderViews(new THREE.PerspectiveCamera(), 800, 600, []);
  });

  it('aimExit brings an air end aimed above the feet down to your level, and allows a wall end high up', () => {
    const { rifts } = arena();
    const eye = V(0, 1.7, 0), feet = V(0, 0, 0);
    // up into open air: the door comes down so things step out of it at your feet's height
    const air = rifts.aimExit(eye, V(0.8, 0.3, -0.5).normalize(), eye, feet, false, []);
    expect(air.valid).toBe(true);
    expect(air.exitFeet.y).toBeLessThanOrEqual(feet.y + LAW.airAboveFeetMax + 1e-6);
    // a hatch aimed up there comes down to your feet too
    rifts.orientation = 'hatch';
    const hatch = rifts.aimExit(eye, V(0.8, 0.3, -0.5).normalize(), eye, feet, false, []);
    expect(hatch.frame.position.y).toBeLessThanOrEqual(feet.y + LAW.airAboveFeetMax + 1e-6);
    rifts.orientation = 'auto';
    // a wall end 10 m up is fine
    const wall = rifts.aimExit(eye, V(0, 0.5, 1).normalize(), eye, feet, false, []);
    expect(wall.kind).toBe('wall');
    expect(wall.valid).toBe(true);
    expect(wall.frame.position.y).toBeGreaterThan(10);
    expect(wall.dropBelow).toBeGreaterThan(9);
    expect(wall.outcome).toBe('skull');
    expect(frameNormal(wall.frame).z).toBeCloseTo(-1, 5);
    expect(wall.exitYaw).toBeCloseTo(Math.PI, 5);
  });

  it('aimExit: air end below the feet over the void is valid; outcomeAt decides splash / void', () => {
    const world = makeWorld(false);
    world.add(V(-3, 18, -3), V(3, 20, 3));
    const eye = V(0, 21.7, 0), feet = V(0, 20, 0);
    const dir = V(0, -0.5, 1).normalize();
    const plain = makeRifts(world).aimExit(eye, dir, eye, feet, false, []);
    expect(plain.kind).toBe('air');
    expect(plain.valid).toBe(true);
    expect(plain.dropBelow).toBe(Infinity);
    expect(plain.outcome).toBe('skull');
    const withVoid = new RiftSystem(new THREE.Scene(), null, world, { portalScale: 1, lightCount: 0, maxViews: 1, outcomeAt: () => 'void' });
    expect(withVoid.aimExit(eye, dir, eye, feet, false, []).outcome).toBe('void');
    // the wheel sets the distance
    withVoid.airDistance = 20;
    const far = withVoid.aimExit(eye, dir, eye, feet, false, []);
    expect(far.distance).toBeCloseTo(20, 3);
  });

  it('aimExit: floor, ceiling, perch, hatch over a target and the refusals', () => {
    const world = makeWorld();
    world.add(V(-10, 0, 20), V(10, 30, 21), { tag: 'wall' });
    const ceiling = world.add(V(-5, 6, 30), V(5, 6.4, 40));
    world.add(V(6, 0, 6), V(8.4, 2.6, 12), { tag: 'container' });
    world.add(V(-10, 0, -12), V(10, 8, -11), { tag: 'bound', noPortal: true });
    const rifts = makeRifts(world);
    const eye = V(0, 1.7, 0), feet = V(0, 0, 0);

    const floor = rifts.aimExit(eye, V(0, -0.3, 1).normalize(), eye, feet, false, []);
    expect(floor.kind).toBe('floor');
    expect(floor.valid).toBe(true);
    expect(frameNormal(floor.frame).y).toBeCloseTo(1, 5);
    expect(floor.frame.width).toBe(LAW.floorEndSize);
    expect(floor.outcome).toBe('safe');

    // ceiling above (shoot up at it from under it)
    const e2 = V(0, 1.7, 33), f2 = V(0, 0, 33);
    const ceil = rifts.aimExit(e2, V(0, 1, 0.3).normalize(), e2, f2, false, []);
    expect(ceil.kind).toBe('ceiling');
    expect(ceil.valid).toBe(true);
    expect(ceil.host).toBe(ceiling);
    expect(frameNormal(ceil.frame).y).toBeCloseTo(-1, 5);

    // high on the container's side: perch on top of it
    const top = V(6, 2.3, 9);
    const perch = rifts.aimExit(eye, top.clone().sub(eye).normalize(), eye, feet, false, []);
    expect(perch.kind).toBe('stand');
    expect(perch.valid).toBe(true);
    expect(perch.exitFeet.y).toBeCloseTo(2.6, 5);

    // no rifts on noPortal surfaces
    const bad = rifts.aimExit(eye, V(0, 0, -1), eye, feet, false, []);
    expect(bad.reason).toBe('aim.noSurface');

    // steady enemy right where the floor end would go
    const guard = target('enemy:1', V(0, 0, 5.6), { steady: true });
    const close = rifts.aimExit(eye, V(0, -0.3, 1).normalize(), eye, feet, false, [guard]);
    expect(close.reason).toBe('aim.enemyClose');

    // jammer bubble
    rifts.setBlockers([{ pos: V(0, 0, 6), radius: 3 }]);
    expect(rifts.aimExit(eye, V(0, -0.3, 1).normalize(), eye, feet, false, []).reason).toBe('aim.blocked');
    rifts.setBlockers([]);

    // out of range
    const far = rifts.aimExit(eye, V(0, 0.02, 1).normalize(), eye, feet, false, []);
    expect(far.valid).toBe(true);
    const wide = makeWorld();
    wide.add(V(-10, 0, 64), V(10, 30, 65));
    expect(makeRifts(wide).aimExit(eye, V(0, 0.05, 1).normalize(), eye, feet, false, []).reason).toBe('aim.range');
  });

  it('aimExit: no floor end on a face too small for it', () => {
    const world = makeWorld();
    world.add(V(-5, 0, 6), V(5, 1, 6.4));
    const rifts = makeRifts(world);
    const eye = V(0, 1.7, 0);
    const aim = rifts.aimExit(eye, V(0, 0.98, 6.2).sub(eye).normalize(), eye, V(0, 0, 0), false, []);
    expect(aim.kind).toBe('floor');
    expect(aim.reason).toBe('aim.space');
  });

  it('aimExit: line of sight is from the eye, not the camera', () => {
    const world = makeWorld();
    world.add(V(-5, 0, 2), V(5, 2.5, 2.5));
    const rifts = makeRifts(world);
    const cam = V(0, 5, -3), eye = V(0, 1.7, 0);
    const aim = rifts.aimExit(cam, V(0, 0, 10).sub(cam).normalize(), eye, V(0, 0, 0), false, []);
    expect(aim.kind).toBe('floor');
    expect(aim.reason).toBe('aim.los');
  });

  it('auto hatch over a target seen from above; forced door / hatch', () => {
    const world = makeWorld();
    world.add(V(-2, 0, -2), V(2, 6, 2), { tag: 'tower' });
    const rifts = makeRifts(world);
    const feet = V(0, 6, 0), eye = V(0, 7.7, 0);
    const guard = target('enemy:7', V(0, 0, 12), { steady: true });
    const dir = V(0, 1, 12).sub(eye).normalize();
    const hatch = rifts.aimExit(eye, dir, eye, feet, false, [guard]);
    expect(hatch.overTarget).toBe('enemy:7');
    expect(hatch.kind).toBe('air');
    expect(frameNormal(hatch.frame).y).toBeCloseTo(-1, 5);
    expect(hatch.frame.position.x).toBeCloseTo(0, 5);
    expect(hatch.frame.position.z).toBeCloseTo(12, 5);
    expect(hatch.frame.position.y).toBeLessThanOrEqual(feet.y + LAW.airAboveFeetMax + 1e-6);
    expect(hatch.valid).toBe(true);
    expect(hatch.dropBelow).toBeCloseTo(4.1, 5);
    expect(hatch.outcome).toBe('skull');
    // from the ground no hatch over his head is legal: the aim goes past him (a wall behind him for Return to Sender)
    const low = rifts.aimExit(V(0, 1.7, 3), V(0, 1.2, 12).sub(V(0, 1.7, 3)).normalize(), V(0, 1.7, 3), V(0, 0, 3), false, [guard]);
    expect(low.overTarget).toBeNull();
    // forced door: no snapping
    rifts.orientation = 'door';
    const door = rifts.aimExit(eye, dir, eye, feet, false, [guard]);
    expect(door.overTarget).toBeNull();
    // forced hatch in open air
    rifts.orientation = 'hatch';
    rifts.airDistance = 8;
    const h2 = rifts.aimExit(eye, V(1, -0.4, 0).normalize(), eye, feet, false, []);
    expect(h2.kind).toBe('air');
    expect(h2.valid).toBe(true);
    expect(frameNormal(h2.frame).y).toBeCloseTo(-1, 5);
  });

  it('placeExit: dormant until an entrance exists; moving it keeps the link', () => {
    const { rifts } = arena();
    placeWallExit(rifts);
    const exit = rifts.playerEnds().exit!;
    expect(exit.isOpen).toBe(false);
    expect(rifts.openEnds()).toEqual([]);
    const res = rifts.openEntrance(ctx());
    expect(res).toEqual({ ok: true, mode: 'door', targetKey: null, reason: null });
    const en = rifts.playerEnds().entrance!;
    expect(en.linked).toBe(exit);
    expect(exit.linked).toBe(en);
    expect(exit.isOpen && en.isOpen).toBe(true);
    expect(rifts.openEnds().length).toBe(2);
    // move the exit: same end object, new frame, still linked
    const eye = V(0, 1.7, 0);
    const aim2 = rifts.aimExit(eye, V(0.3, 0.3, 1).normalize(), eye, V(0, 0, 0), false, []);
    expect(rifts.placeExit(aim2)).toBe(true);
    expect(rifts.playerEnds().exit).toBe(exit);
    expect(exit.position.distanceTo(aim2.frame.position)).toBeLessThan(1e-6);
    expect(en.linked).toBe(exit);
    // events fire on update
    const log: string[] = [];
    rifts.events = { opened: (_e, w) => log.push('open:' + w), closed: () => log.push('close') };
    rifts.update(1 / 60, 1 / 60, 1);
    expect(log).toContain('open:exit');
    expect(log).toContain('close'); // the copy left at the old spot collapses
  });

  it('openEntrance: noExit, trapdoor (steady refused / canFall ok), airborne -> air, threat -> catch, blocked', () => {
    const { rifts } = arena();
    expect(rifts.openEntrance(ctx()).reason).toBe('gate.noExit');
    placeWallExit(rifts);

    const cam = V(0, 1.7, -2.5);
    const dirTo = (p: THREE.Vector3) => p.clone().sub(cam).normalize();
    const steady = target('enemy:1', V(0, 0, 8), { steady: true });
    const r1 = rifts.openEntrance(ctx({ camDir: dirTo(V(0, 1.1, 8)), targets: [steady] }));
    expect(r1).toEqual({ ok: false, mode: 'trapdoor', targetKey: 'enemy:1', reason: 'gate.steady' });
    expect(rifts.hasEntrance()).toBe(false);

    const loose = target('enemy:2', V(0, 0, 8), { canFall: true });
    const r2 = rifts.openEntrance(ctx({ camDir: dirTo(V(0, 1.1, 8)), targets: [loose] }));
    expect(r2).toEqual({ ok: true, mode: 'trapdoor', targetKey: 'enemy:2', reason: null });
    const trap = rifts.playerEnds().entrance!;
    expect(trap.kind).toBe('floor');
    expect(trap.width).toBe(LAW.floorEndSize);
    expect(rifts.holeAt(0.3, 8.2, 0)).toBe(trap);

    // too far for a trapdoor
    const far = target('enemy:3', V(-30, 0, 30), { canFall: true });
    expect(rifts.openEntrance(ctx({ camDir: dirTo(V(-30, 1.1, 30)), targets: [far] })).reason).toBe('gate.range');

    // falling: an air end on the fall path, facing the velocity
    const feet = V(0, 12, 0);
    const vel = V(2, -12, 0);
    const r3 = rifts.openEntrance(ctx({ airborne: true, playerFeet: feet, playerVel: vel }));
    expect(r3.ok).toBe(true);
    expect(r3.mode).toBe('air');
    const air = rifts.playerEnds().entrance!;
    expect(air).not.toBe(trap); // replaced
    expect(trap.isOpen).toBe(false);
    expect(air.kind).toBe('air');
    expect(air.position.y).toBeLessThanOrEqual(feet.y - 1.5 + 1e-6);
    expect(air.normal.dot(vel.clone().normalize())).toBeLessThan(-0.9);
    expect(rifts.openEnds().length).toBe(2);

    // threat: a door toward it, facing it
    const r4 = rifts.openEntrance(ctx({ threats: [{ kind: 'laser', from: V(10, 1.5, 0), eta: 0.5 }, { kind: 'grenade', from: V(-10, 0, 0), eta: 1.5 }] }));
    expect(r4.mode).toBe('catch');
    expect(r4.ok).toBe(true);
    const c = rifts.playerEnds().entrance!;
    expect(c.normal.x).toBeCloseTo(1, 5);
    expect(c.position.x).toBeCloseTo(1.4, 5);

    // jammer bubble
    rifts.setBlockers([{ pos: V(0, 1, 1.45), radius: 3 }]);
    expect(rifts.openEntrance(ctx()).reason).toBe('gate.blocked');
    expect(rifts.previewEntrance(ctx()).reason).toBe('gate.blocked');
  });

  it('close() shears straddlers and closes the pair (not gates)', () => {
    const { rifts } = arena();
    rifts.addGate('g', frame(V(-20, 1.15, 0), V(1, 0, 0), 'stand'), frame(V(-20, 1.15, 10), V(0, 0, -1), 'stand'));
    placeWallExit(rifts);
    rifts.openEntrance(ctx());
    const en = rifts.playerEnds().entrance!;
    const victims = rifts.close([
      { key: 'enemy:1', center: en.position.clone().addScaledVector(en.normal, 0.2), radius: 0.4 },
      { key: 'enemy:2', center: V(5, 1, 5), radius: 0.4 },
      { key: 'prop:3', center: en.position.clone().addScaledVector(en.normal, 0.8), radius: 0.4 },
    ]);
    expect(victims.map((v) => v.key)).toEqual(['enemy:1']);
    expect(rifts.hasExit()).toBe(false);
    expect(rifts.hasEntrance()).toBe(false);
    expect(rifts.openEnds().length).toBe(2); // the gate stays
    expect(rifts.openEnds().every((e) => e.owner === 'gate')).toBe(true);
  });

  it('raycastThrough returns 2 segments, the second charged', () => {
    const world = makeWorld();
    const far = world.add(V(40, 0, -5), V(41, 10, 5));
    const rifts = makeRifts(world);
    rifts.addGate('g', frame(V(0, 1.15, 5), V(0, 0, -1), 'stand'), frame(V(20, 1.15, 0), V(1, 0, 0), 'stand'));
    const segs = rifts.raycastThrough(V(0, 1.5, 0), V(0, 0, 1), 100, world);
    expect(segs.length).toBe(2);
    expect(segs[0].charged).toBe(false);
    expect(segs[0].viaEnd).toBe(rifts.gateEnds('g').in);
    expect(segs[0].to.z).toBeCloseTo(5, 5);
    expect(segs[1].charged).toBe(true);
    expect(segs[1].from.x).toBeCloseTo(20, 2);
    expect(segs[1].to.x).toBeCloseTo(40, 5);
    expect(segs[1].to.y).toBeCloseTo(1.5, 5);
    expect(segs[1].hit!.collider).toBe(far);
    // hops are capped
    const one = rifts.raycastThrough(V(0, 1.5, 0), V(0, 0, 1), 100, world, 0);
    expect(one.length).toBe(1);
    expect(one[0].viaEnd).not.toBeNull();
  });

  it('snapshot / applySnapshot drive visuals only and restore live state', () => {
    const { rifts } = arena();
    placeWallExit(rifts);
    rifts.openEntrance(ctx());
    for (let i = 0; i < 30; i++) rifts.update(1 / 60, 1 / 60, i / 60);
    const live = rifts.snapshot();
    expect(live.length).toBe(2);
    expect(live.map((s) => s.color).sort()).toEqual(['entrance', 'exit']);
    const exitSnap = live.find((s) => s.color === 'exit')!;
    const enSnap = live.find((s) => s.color === 'entrance')!;
    expect(exitSnap.linkedId).toBe(enSnap.id);
    // an old frame: only an exit, somewhere else
    rifts.applySnapshot([{ ...exitSnap, id: 999, pos: [3, 3, 3], linkedId: 999 }]);
    rifts.update(1 / 60, 1 / 60, 1);
    expect(rifts.playerEnds().exit!.position.distanceTo(V(exitSnap.pos[0], exitSnap.pos[1], exitSnap.pos[2]))).toBeLessThan(1e-9);
    expect(rifts.openEnds().length).toBe(2);
    rifts.applySnapshot(live);
    expect(rifts.snapshot()).toEqual(live);
  });

  it('reset() clears the player pair and restores gates', () => {
    const { rifts } = arena();
    rifts.addGate('g', frame(V(-20, 1.15, 0), V(1, 0, 0), 'stand'), frame(V(-20, 1.15, 10), V(0, 0, -1), 'stand'));
    placeWallExit(rifts);
    expect(rifts.hijackGate('g')).toBe(true);
    expect(rifts.gateEnds('g').out!.isOpen).toBe(false);
    rifts.setGateOpen('g', false);
    expect(rifts.gateEnds('g').in!.isOpen).toBe(false);
    rifts.reset();
    expect(rifts.hasExit()).toBe(false);
    expect(rifts.gateEnds('g').in!.linked).toBe(rifts.gateEnds('g').out);
    expect(rifts.openEnds().length).toBe(2);
  });

  it('hostPassable: walls hosting an open end let movers in; floors hosting one too', () => {
    const { rifts, wall } = arena();
    placeWallExit(rifts);
    rifts.openEntrance(ctx());
    const exit = rifts.playerEnds().exit!;
    const at = exit.position.clone().addScaledVector(exit.normal, 0.2);
    at.y = exit.position.y - 1.1;
    expect(rifts.hostPassable(wall, at, 0.34)).toBe(true);
    expect(rifts.hostPassable(wall, V(8, 0, 19.8), 0.34)).toBe(false);
  });
});
