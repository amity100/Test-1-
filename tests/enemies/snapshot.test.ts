import { describe, expect, it } from 'vitest';
import type { Enemy } from '../../src/actors/enemies';
import { scenario, V } from './fakes';

describe('replay snapshots', () => {
  it('round-trips positions, yaw, poses and visibility', () => {
    const s = scenario();
    const a = s.spawn('rifleman', V(0, 0, 0), 0.4, { state: 'combat' }) as Enemy;
    const b = s.spawn('turret', V(5, 0, 0), 1.2) as Enemy;
    const c = s.spawn('brute', V(-5, 0, 0), 0) as Enemy;
    s.step(90);
    s.sys.kill(c, { source: 'bolt', amount: 999, charged: true, team: 'player', instigator: 'player' });
    s.step(5);
    const snap = s.sys.snapshot();
    expect(snap.map((x) => x.key)).toEqual([a.key, b.key, c.key]);
    const want = JSON.parse(JSON.stringify(snap));
    const posA = a.char.root.position.clone();
    const yawB = b.char.root.rotation.y;

    // scramble what the replay would show
    s.step(60);
    a.char.root.position.set(99, 99, 99);
    b.char.root.rotation.y = -2;
    s.char(a).setPose({ ...snap[0].pose, clip: 'death', dead: true });
    c.char.root.visible = false;
    const late = s.spawn('rifleman', V(9, 0, 9)) as Enemy;
    s.step();

    s.sys.applySnapshot(snap);
    expect(a.char.root.position.distanceTo(posA)).toBeLessThan(1e-9);
    expect(b.char.root.rotation.y).toBeCloseTo(yawB, 9);
    expect(JSON.parse(JSON.stringify(s.sys.snapshot().slice(0, 3)))).toEqual(want);
    expect(c.char.root.visible).toBe(true);
    expect(s.char(c).getPose().dead).toBe(true);
    // not born yet at snapshot time: hidden
    expect(late.char.root.visible).toBe(false);
    // the turret's pose carries its gun pitch
    expect(typeof snap[1].pose.loco.aim).toBe('number');
  });
});
