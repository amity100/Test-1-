import { describe, expect, it } from 'vitest';
import type { Enemy } from '../../src/actors/enemies';
import { scenario, V } from './fakes';

/** Skeleton-like: two open floors (y 30 and 36) over the void, nothing below. */
function floors() {
  const s = scenario(['skeleton']);
  s.ground.enabled = false;
  s.physics.killY = 10;
  s.world.add({ x: -12, y: 29.7, z: -12 }, { x: 12, y: 30, z: 12 });
  s.world.add({ x: -12, y: 35.7, z: -12 }, { x: 12, y: 36, z: 12 });
  s.world.add({ x: -1, y: 30, z: -1 }, { x: 1, y: 35.7, z: 1 }); // core column
  s.sys.setNav(
    'skeleton',
    [
      { minX: -14, maxX: 14, minZ: -14, maxZ: 14, floorY: 30 },
      { minX: -14, maxX: 14, minZ: -14, maxZ: 14, floorY: 36 },
    ],
    s.world,
  );
  return s;
}

describe('fighting on open floors', () => {
  it('each enemy uses the nav layer at his feet', () => {
    const s = floors();
    const low = s.spawn('rifleman', V(5, 30, 5), 0, { zone: 'skeleton' }) as Enemy;
    const high = s.spawn('rifleman', V(-5, 36, -5), 0, { zone: 'skeleton' }) as Enemy;
    s.step();
    expect(s.sys.gridFor(low)!.floorY).toBe(30);
    expect(s.sys.gridFor(high)!.floorY).toBe(36);
  });

  it('riflemen strafe for 20 s without ever stepping off the edge', () => {
    const s = floors();
    s.setPlayer(-9, 30, -9);
    const list = [V(8, 30, 8), V(8, 30, -4), V(-4, 30, 8), V(6, 30, 0)].map(
      (p) => s.spawn('rifleman', p, Math.PI, { zone: 'skeleton', state: 'combat' }) as Enemy,
    );
    const grid = s.sys.navFor('skeleton')[0];
    let spots = 0;
    for (let i = 0; i < 60 * 20; i++) {
      s.step();
      for (const e of list) {
        expect(e.state).not.toBe('launched');
        expect(e.alive).toBe(true);
        if (e.hasSpot) {
          spots++;
          expect(grid.edgeDistance(e.spot.x, e.spot.z)).toBeGreaterThanOrEqual(1.5);
        }
      }
    }
    expect(spots).toBeGreaterThan(0);
    for (const e of list) expect(e.pos.y).toBeCloseTo(30, 3);
    expect(s.log.bolts.length).toBeGreaterThan(6);
  });

  it('a jammer fleeing toward the void stops short of the edge', () => {
    const s = floors();
    s.setPlayer(-3, 30, 0);
    const j = s.spawn('jammer', V(8, 30, 0), 0, { zone: 'skeleton', state: 'combat' }) as Enemy;
    s.step(60 * 10);
    expect(j.state).not.toBe('launched');
    expect(Math.abs(j.pos.x)).toBeLessThan(12);
    expect(Math.abs(j.pos.z)).toBeLessThan(12);
  });

  it('a stranded enemy (landed off the grid) stays put and fights', () => {
    const s = floors();
    s.world.add({ x: 20, y: 29.7, z: -2 }, { x: 24, y: 30, z: 2 }); // a ledge outside the nav bounds
    s.setPlayer(8, 30, 0);
    const e = s.spawn('rifleman', V(22, 32, 0), -Math.PI / 2, { zone: 'skeleton', state: 'combat' }) as Enemy;
    s.step(10);
    s.sys.launch(e);
    s.until(() => e.state === 'combat', 4);
    expect(e.stranded).toBe(true);
    const at = e.pos.clone();
    s.step(60 * 4);
    expect(e.pos.distanceTo(at)).toBeLessThan(0.05);
    expect(s.log.bolts.some((b) => b.id === e.id)).toBe(true);
  });
});
