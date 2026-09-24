import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { HitInfo } from '../../src/core/contracts';
import type { Enemy } from '../../src/actors/enemies';
import { KIND } from '../../src/actors/tuning';
import { scenario, V } from './fakes';

const bolt = (from: THREE.Vector3, amount = 60): HitInfo => ({ source: 'bolt', amount, charged: true, from, team: 'player', instigator: 'player' });

function arena() {
  const s = scenario(['crown']);
  s.sys.setBossArena(V(0, 0, 0), 20, [V(10, 0, 0), V(-10, 0, 0), V(0, 0, -10)]);
  s.setPlayer(0, 0, 12);
  const e = s.spawn('boss', V(0, 0, 0), 0, { state: 'combat', zone: 'crown' }) as Enemy;
  s.step();
  return { s, e };
}

describe('Director Voss', () => {
  it('rift shield: frontal charged shots are caught, rear and overhead ones hurt', () => {
    const { s, e } = arena();
    expect(s.log.barks.some((b) => b.key === 'bark.boss1')).toBe(true);
    expect(s.sys.hit(e, bolt(V(0, 1.3, 10)))).toBe('blocked');
    expect(s.sys.hit(e, bolt(V(6, 1.3, 6)))).toBe('blocked'); // 45° off his nose
    expect(e.hp).toBe(1800);
    expect(s.sys.hit(e, bolt(V(0, 1.3, -10)))).toBe('hurt');
    expect(e.hp).toBe(1740);
    expect(s.sys.hit(e, bolt(V(0, 14, 2)))).toBe('hurt'); // from above
    expect(e.hp).toBe(1680);
    // steady: no trapdoor, no shove, no shear outside a blink
    expect(s.sys.boss()!.phase).toBe(1);
    expect(e.offBalance).toBe(false);
    expect(s.sys.hit(e, { source: 'shear', amount: 999, charged: false, team: 'player', instigator: 'player' })).toBe('blocked');
    expect(s.sys.hit(e, { source: 'shove', amount: 0, charged: false, team: 'player', instigator: 'player' })).toBe('blocked');
  });

  it('a caught bolt comes back after a short laser lock', () => {
    const { s, e } = arena();
    s.step(60 * 3); // let the opening volley and reload pass
    const before = s.log.bolts.length;
    s.sys.hit(e, bolt(V(0, 1.3, 10)));
    s.until(() => s.log.bolts.length > before, 3);
    const lasers = s.log.telegraphs.filter((t) => t.id === e.id && t.kind === 'laser');
    expect(lasers.length).toBeGreaterThan(0);
    expect(s.log.bolts.length).toBeGreaterThan(before);
  });

  it('has 1800 hp; his phases turn at two thirds and one third of it', () => {
    expect(KIND.boss.hp).toBe(1800);
    const { s, e } = arena();
    expect(e.maxHp).toBe(1800);
    const to = (hp: number) => s.sys.hit(e, bolt(V(0, 1.3, -10), e.hp - hp));
    to(1189);
    expect(s.sys.boss()!.phase).toBe(1);
    to(1187);
    expect(s.sys.boss()!.phase).toBe(2);
    to(595);
    expect(s.sys.boss()!.phase).toBe(2);
    to(593);
    expect(s.sys.boss()!.phase).toBe(3);
    expect(e.alive).toBe(true);
  });

  it('phases by HP; phase 2 blinks through red rifts and can be sheared mid-pass', () => {
    const { s, e } = arena();
    s.sys.hit(e, bolt(V(0, 1.3, -10), 1000));
    expect(e.hp).toBe(800);
    expect(s.sys.boss()!.phase).toBe(2);
    expect(s.log.barks.some((b) => b.key === 'bark.boss2')).toBe(true);
    // the blink: red pair shown 0.6 s before the pass
    s.until(() => s.log.bossRift.some((r) => r.a !== null), 4);
    const shown = s.log.bossRift.find((r) => r.a !== null)!;
    expect(shown.b).not.toBeNull();
    const tShow = s.clock.t;
    s.until(() => s.sys.boss()!.blinking, 2);
    expect(s.clock.t - tShow).toBeCloseTo(0.6, 1);
    expect(s.sys.hit(e, { source: 'shear', amount: 999, charged: false, team: 'player', instigator: 'player' })).toBe('knocked');
    expect(e.hp).toBe(650);
    expect(e.alive).toBe(true);
    expect(e.state).toBe('stunned');
    expect(s.sys.boss()!.blinking).toBe(false);
    expect(s.log.bossRift[s.log.bossRift.length - 1]).toEqual({ a: null, b: null });
    // stunned: off balance (LOOP and SWAP take him; the PORTAL grab never does); the blade bites (as it does any time)
    expect(e.offBalance).toBe(true);
    expect(s.sys.hit(e, { source: 'blade', amount: 999, charged: false, team: 'player', instigator: 'player' })).toBe('hurt');
    expect(e.hp).toBe(500);
    expect(s.sys.boss()!.phase).toBe(3);
    expect(s.log.barks.some((b) => b.key === 'bark.boss3')).toBe(true);
  });

  it('an unsheared blink lands him on a blink point', () => {
    const { s, e } = arena();
    s.sys.hit(e, bolt(V(0, 1.3, -10), 1000));
    s.until(() => s.log.bossRift.some((r) => r.a !== null), 4);
    const target = s.log.bossRift.find((r) => r.a !== null)!.b!;
    s.until(() => s.log.bossRift.some((r) => r.a === null), 2);
    s.step(2);
    expect(e.pos.distanceTo(target)).toBeLessThan(0.3);
    expect([V(10, 0, 0), V(-10, 0, 0), V(0, 0, -10)].some((p) => p.distanceTo(target) < 1e-6)).toBe(true);
  });

  it('phase 3 summons two riflemen every 15 s', () => {
    const { s, e } = arena();
    s.sys.hit(e, bolt(V(0, 1.3, -10), 1300));
    expect(s.sys.boss()!.phase).toBe(3);
    s.until(() => s.log.summons.length > 0, 6);
    expect(s.log.summons.length).toBe(1);
    const defs = s.log.summons[0];
    expect(defs.length).toBe(2);
    expect(defs.every((d) => d.kind === 'rifleman' && d.zone === 'crown' && d.state === 'combat')).toBe(true);
    expect(new Set(defs.map((d) => d.id)).size).toBe(2);
    s.until(() => s.log.summons.length > 1, 20);
    expect(s.log.summons.length).toBe(2);
  });

  it('fires 5-bolt fans after a laser telegraph', () => {
    const { s, e } = arena();
    s.until(() => s.log.bolts.length >= 5, 5);
    const fan = s.log.bolts.filter((b) => b.id === e.id);
    expect(fan.length).toBe(5);
    expect(new Set(fan.map((b) => b.t)).size).toBe(1);
    const yaws = fan.map((b) => Math.atan2(b.dir.x, b.dir.z)).sort((a, b) => a - b);
    expect(yaws[4] - yaws[0]).toBeGreaterThan(0.3);
    const tele = s.log.telegraphs.filter((t) => t.id === e.id && t.kind === 'laser');
    expect(fan[0].t - tele[0].t).toBeCloseTo(0.6, 1);
  });
});
