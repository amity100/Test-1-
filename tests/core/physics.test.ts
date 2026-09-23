import { describe, it, expect } from 'vitest';
import { LAW } from '../../src/core/contracts';
import { frame, makePhysics, makeRifts, makeWorld, recorder, run, V } from './helpers';

describe('physics through rifts', () => {
  it('floor entrance -> wall exit turns a 15 m/s fall into 15 m/s horizontal flight along the exit normal', () => {
    const world = makeWorld();
    // a tall wall whose -X face hosts the exit
    world.add(V(10, 0, -5), V(11, 30, 5), { tag: 'wall' });
    const rifts = makeRifts(world);
    rifts.addGate('t', frame(V(0, 0.01, 0), V(0, 1, 0), 'floor'), frame(V(10, 15, 0), V(-1, 0, 0), 'wall'));
    expect(rifts.gateEnds('t').out!.host).not.toBeNull();
    const phys = makePhysics(world, rifts);
    const ev = recorder();
    const b = phys.createBody('prop', { pos: V(0, 0.1, 0), radius: 0.3, height: 0.6 });
    b.vel.set(0, -15, 0);
    run(phys, ev, 0.2, 0, 1 / 60, () => ev.log.crossed.length > 0);
    expect(ev.log.crossed.length).toBe(1);
    const c = ev.log.crossed[0];
    expect(c.to.kind).toBe('wall');
    expect(c.speed).toBeGreaterThan(14.9);
    expect(c.speed).toBeLessThan(16);
    // all of it along the exit normal (-X)
    expect(c.vel.x).toBeCloseTo(-c.speed, 1);
    expect(Math.abs(c.vel.y)).toBeLessThan(0.3);
    expect(Math.abs(c.vel.z)).toBeLessThan(1e-6);
    expect(c.pos.x).toBeLessThan(10);
    expect(b.charge).toBeGreaterThan(1);
    expect(b.crossings).toBe(1);
  });

  it('floor -> floor launches upward at the entry speed', () => {
    const world = makeWorld();
    const rifts = makeRifts(world);
    rifts.addGate('t', frame(V(0, 0.01, 0), V(0, 1, 0), 'floor'), frame(V(20, 0.01, 0), V(0, 1, 0), 'floor'));
    const phys = makePhysics(world, rifts);
    const ev = recorder();
    const b = phys.createBody('prop', { pos: V(0, 1, 0), radius: 0.3, height: 0.6 });
    b.vel.set(0, -15, 0);
    run(phys, ev, 0.2, 0, 1 / 60, () => ev.log.crossed.length > 0);
    expect(ev.log.crossed.length).toBe(1);
    const c = ev.log.crossed[0];
    expect(c.vel.y).toBeGreaterThan(15);
    expect(c.vel.y).toBeCloseTo(c.speed, 3);
    expect(Math.hypot(c.vel.x, c.vel.z)).toBeLessThan(1e-3);
    expect(c.pos.x).toBeCloseTo(20, 1);
    // it rises out of the far floor
    run(phys, ev, 0.3, 1);
    expect(b.pos.y).toBeGreaterThan(3);
  });

  it('loop: a floor hole under a hatch 6 m above it speeds up every cycle, caps at maxSpeed and counts loops', () => {
    const world = makeWorld();
    const rifts = makeRifts(world);
    rifts.addGate('loop', frame(V(0, 0.01, 0), V(0, 1, 0), 'floor'), frame(V(0, 6, 0), V(0, -1, 0), 'air'));
    const phys = makePhysics(world, rifts);
    const ev = recorder();
    const b = phys.createBody('prop', { pos: V(0, 2, 0), radius: 0.3, height: 0.6 });
    run(phys, ev, 12, 0, 1 / 60);
    const cr = ev.log.crossed;
    expect(cr.length).toBeGreaterThan(10);
    for (let i = 1; i < cr.length; i++) {
      expect(cr[i].speed).toBeGreaterThanOrEqual(cr[i - 1].speed - 1e-6);
      expect(cr[i].loops).toBe(cr[i - 1].loops + 1);
      expect(cr[i].speed).toBeLessThanOrEqual(LAW.maxSpeed + 1e-6);
    }
    expect(cr[1].speed).toBeGreaterThan(cr[0].speed + 1);
    expect(cr[cr.length - 1].speed).toBeCloseTo(LAW.maxSpeed, 3);
    expect(b.loops).toBeGreaterThan(10);
    expect(b.charge).toBeGreaterThan(0);
  });

  it('does not tunnel through a 0.3 m slab at 40 m/s (down, and sideways into a thin wall)', () => {
    const world = makeWorld(false);
    world.add(V(-5, 10, -5), V(5, 10.3, 5));
    world.add(V(20, 0, -5), V(20.3, 10, 5));
    world.add(V(-50, -2, -50), V(50, 0, 50));
    const rifts = makeRifts(world);
    const phys = makePhysics(world, rifts);
    for (const dt of [1 / 60, 1 / 30, 0.1]) {
      const ev = recorder();
      const b = phys.createBody('prop', { pos: V(0, 14, 0), radius: 0.3, height: 0.6, bounce: 0 });
      b.vel.set(0, -40, 0);
      run(phys, ev, 0.5, 0, dt);
      expect(b.pos.y).toBeCloseTo(10.3, 3);
      expect(b.onGround).toBe(true);
      const land = ev.log.impacts.find((i) => i.b === b && i.e.surface === 'ground')!;
      expect(land.e.speed).toBeGreaterThan(35);
      phys.removeBody(b);

      const g = phys.createBody('grenade', { pos: V(15, 2, 0), radius: LAW.grenade.bodyRadius, height: 0.28, bounce: 0 });
      g.vel.set(40, 0, 0);
      run(phys, ev, 0.4, 0, dt);
      expect(g.pos.x).toBeLessThan(20);
      expect(ev.log.impacts.some((i) => i.b === g && i.e.surface === 'wall' && i.e.speed > 35)).toBe(true);
      phys.removeBody(g);
    }
  });

  it('holeAt: a body standing where a floor end opens falls in and comes out of the other end', () => {
    const world = makeWorld();
    const rifts = makeRifts(world);
    const phys = makePhysics(world, rifts);
    const ev = recorder();
    const b = phys.createBody('enemy', { pos: V(0.2, 0, 0.1), radius: 0.4, height: 1.8 });
    run(phys, ev, 0.3);
    expect(b.onGround).toBe(true);
    expect(rifts.holeAt(0.2, 0.1, 0)).toBeNull();
    rifts.addGate('trap', frame(V(0, 0.01, 0), V(0, 1, 0), 'floor'), frame(V(30, 8, 0), V(0, -1, 0), 'air'));
    expect(rifts.holeAt(0.2, 0.1, 0)).not.toBeNull();
    expect(rifts.holeAt(3, 0, 0)).toBeNull();
    run(phys, ev, 1, 0.3, 1 / 60, () => ev.log.crossed.length > 0);
    expect(ev.log.crossed.length).toBe(1);
    expect(b.pos.x).toBeGreaterThan(29);
    expect(b.pos.y).toBeGreaterThan(5);
    expect(b.pos.y).toBeLessThan(8);
    expect(b.charge).toBeGreaterThan(0);
  });

  it('a kinematic body walking onto a hole reports onGround = false', () => {
    const world = makeWorld();
    const rifts = makeRifts(world);
    rifts.addGate('trap', frame(V(0, 0.01, 0), V(0, 1, 0), 'floor'), frame(V(30, 8, 0), V(0, -1, 0), 'air'));
    const phys = makePhysics(world, rifts);
    const ev = recorder();
    const b = phys.createBody('enemy', { pos: V(-3, 0, 0), radius: 0.4, height: 1.8, simulate: false });
    let t = 0;
    let lost = -1;
    for (let i = 0; i < 120; i++) {
      b.vel.set(2, 0, 0);
      t += 1 / 60;
      phys.step(1 / 60, ev, t);
      if (i === 5) expect(b.onGround).toBe(true);
      if (!b.onGround) {
        lost = b.pos.x;
        break;
      }
    }
    expect(lost).toBeGreaterThan(-0.9);
    expect(lost).toBeLessThan(0);
    // kinematic: physics doesn't drop it, the owner switches it to simulate
    expect(b.pos.y).toBeCloseTo(0, 5);
  });

  it('a kinematic walker steps up small ledges and down steps', () => {
    const world = makeWorld();
    world.add(V(2, 0, -2), V(4, 0.3, 2));
    const rifts = makeRifts(world);
    const phys = makePhysics(world, rifts);
    const ev = recorder();
    const b = phys.createBody('enemy', { pos: V(0, 0, 0), radius: 0.4, height: 1.8, simulate: false });
    let t = 0;
    let maxY = 0;
    for (let i = 0; i < 180; i++) {
      b.vel.set(2, 0, 0);
      t += 1 / 60;
      phys.step(1 / 60, ev, t);
      maxY = Math.max(maxY, b.pos.y);
      expect(b.onGround).toBe(true);
    }
    expect(maxY).toBeCloseTo(0.3, 5);
    expect(b.pos.x).toBeGreaterThan(5);
    expect(b.pos.y).toBeCloseTo(0, 5);
  });

  it('charge: player loses it on landing (unless it skids: rift slide), props keep it until they rest', () => {
    const world = makeWorld();
    const rifts = makeRifts(world);
    rifts.addGate('t', frame(V(0, 0.01, 0), V(0, 1, 0), 'floor'), frame(V(20, 3, 0), V(1, 0, 0), 'air'));
    const phys = makePhysics(world, rifts);
    const ev = recorder();
    const prop = phys.createBody('prop', { pos: V(0, 1, 0), radius: 0.3, height: 0.6, friction: 0.1 });
    prop.vel.set(0, -12, 0);
    let t = run(phys, ev, 1, 0, 1 / 60, () => ev.log.crossed.length > 0);
    t = run(phys, ev, 2, t);
    const land = ev.log.impacts.find((i) => i.b === prop && i.e.surface === 'ground')!;
    expect(land.e.charged).toBe(true);
    // 2 s after the crossing, still sliding: still charged
    expect(prop.vel.length()).toBeGreaterThan(1);
    expect(prop.charge).toBeGreaterThanOrEqual(0.25);
    run(phys, ev, 6, t);
    expect(prop.vel.length()).toBeLessThan(1);
    expect(prop.charge).toBe(0);
    expect(prop.crossings).toBe(0);

    const pl = phys.createBody('player', { pos: V(0.1, 1, 0), radius: 0.34, height: 1.8 });
    const ev2 = recorder();
    pl.vel.set(0, -12, 0);
    run(phys, ev2, 3, 10, 1 / 60, () => ev2.log.impacts.some((i) => i.b === pl && i.e.surface === 'ground'));
    const pland = ev2.log.impacts.find((i) => i.b === pl && i.e.surface === 'ground')!;
    expect(pland.e.charged).toBe(true);
    // it came out skidding at 12 m/s: a rift slide keeps the charge while it's at knock speed
    expect(pl.charge).toBeGreaterThan(0);
    pl.vel.set(2, 0, 0);
    run(phys, ev2, 0.1, 20);
    expect(pl.charge).toBe(0);
    // a plain charged landing (straight down) loses it at once
    const pl2 = phys.createBody('player', { pos: V(-6, 3, 0), radius: 0.34, height: 1.8 });
    (pl2 as any).live = true;
    pl2.charge = 1;
    const ev3 = recorder();
    run(phys, ev3, 2, 30, 1 / 60, () => ev3.log.impacts.some((i) => i.b === pl2 && i.e.surface === 'ground'));
    expect(pl2.charge).toBe(0);
  });

  it('sea splash and void fall-out fire once', () => {
    const world = makeWorld(false);
    world.add(V(-5, -2, -5), V(5, 0, 5));
    const rifts = makeRifts(world);
    const phys = makePhysics(world, rifts, { isSea: (p) => p.x > 5, killYAt: (p) => (p.x < -5 ? -10 : -1000) });
    const ev = recorder();
    const a = phys.createBody('prop', { pos: V(8, 2, 0), radius: 0.3, height: 0.6 });
    const b = phys.createBody('prop', { pos: V(-8, 2, 0), radius: 0.3, height: 0.6 });
    run(phys, ev, 2);
    expect(ev.log.splash).toEqual([a]);
    expect(ev.log.fellOut).toEqual([b]);
  });

  it('touch events between fast bodies, at most once per 0.3 s per pair', () => {
    const world = makeWorld();
    const rifts = makeRifts(world);
    const phys = makePhysics(world, rifts);
    const ev = recorder();
    const a = phys.createBody('prop', { pos: V(0, 0, 0), radius: 0.4, height: 1, friction: 0 });
    const b = phys.createBody('enemy', { pos: V(3, 0, 0), radius: 0.4, height: 1.8, simulate: false });
    a.vel.set(10, 0, 0);
    run(phys, ev, 0.25);
    expect(ev.log.touches.length).toBe(1);
    expect(ev.log.touches[0].rel).toBeGreaterThan(5);
    expect(b.pos.x).toBe(3); // kinematic bodies aren't pushed
  });

  it('a hijacked gate sends a body out of the player exit', () => {
    const world = makeWorld();
    world.add(V(-10, 0, 20), V(10, 12, 21), { tag: 'wall' });
    const rifts = makeRifts(world);
    rifts.addGate('g', frame(V(-20, 1.15, 0), V(1, 0, 0), 'stand'), frame(V(-20, 1.15, 10), V(0, 0, -1), 'stand'));
    const eye = V(0, 1.7, 0);
    const aim = rifts.aimExit(eye, V(0, 0.2, 1).normalize(), eye, V(0, 0, 0), false, []);
    expect(aim.valid).toBe(true);
    expect(aim.kind).toBe('wall');
    expect(rifts.hijackGate('nope')).toBe(false);
    expect(rifts.placeExit(aim)).toBe(true);
    expect(rifts.hijackGate('g')).toBe(true);
    const { in: gin, out: gout } = rifts.gateEnds('g');
    const exit = rifts.playerEnds().exit!;
    expect(gin!.linked).toBe(exit);
    expect(gin!.isOpen).toBe(true); // the exit alone (no entrance) is a live target for the gate
    expect(rifts.openEnds()).toContain(gin);
    expect(rifts.openEnds()).not.toContain(gout);
    const phys = makePhysics(world, rifts);
    const ev = recorder();
    const b = phys.createBody('enemy', { pos: V(-17, 0, 0), radius: 0.4, height: 1.8, friction: 0 });
    b.vel.set(-6, 1, 0);
    run(phys, ev, 1, 0, 1 / 60, () => ev.log.crossed.length > 0);
    expect(ev.log.crossed.length).toBe(1);
    expect(ev.log.crossed[0].from).toBe(gin);
    expect(ev.log.crossed[0].to).toBe(exit);
    expect(b.pos.z).toBeGreaterThan(19);
    expect(b.pos.z).toBeLessThan(20);
    expect(b.vel.z).toBeLessThan(-5); // out of the wall, flying away from it
  });
});
