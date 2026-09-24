import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { HitInfo } from '../../src/core/contracts';
import type { Enemy } from '../../src/actors/enemies';
import { AI } from '../../src/actors/tuning';
import { scenario, V } from './fakes';

/** A hidden-blade stab from where the player stands. */
const stab = (from: THREE.Vector3): HitInfo => ({ source: 'blade', amount: 9999, charged: false, team: 'player', instigator: 'player', from: from.clone() });
/** A spot `d` m in front of him (his yaw), or behind for negative `d`. */
const off = (e: Enemy, d: number) => e.pos.clone().addScaledVector(e.forward(V()), d);

describe('hidden blade: pierces everything', () => {
  it('kills every kind outright, whatever his armour or state', () => {
    const s = scenario();
    s.step();
    for (const kind of ['rifleman', 'grenadier', 'sniper', 'warden', 'brute'] as const) {
      const e = s.spawn(kind, V(0, 0, 0), 0, { id: `blade-${kind}` }) as Enemy;
      expect(s.sys.hit(e, stab(off(e, 1.5))), kind).toBe('killed');
      expect(e.alive).toBe(false);
      expect(s.log.died[s.log.died.length - 1].ctx.cause).toBe('blade');
    }
  });

  it("goes through a Warden's raised shield from the front", () => {
    const s = scenario();
    const e = s.spawn('warden', V(0, 0, 0), 0, { state: 'combat' }) as Enemy;
    s.setPlayer(0, 0, 1.6);
    s.step();
    const bolt: HitInfo = { source: 'bolt', amount: 60, charged: true, from: V(0, 1.3, 1.6), team: 'player', instigator: 'player' };
    expect(s.sys.hit(e, bolt)).toBe('blocked');
    expect(s.sys.hit(e, stab(V(0, 0, 1.6)))).toBe('killed');
  });

  it('kills a charging, armoured brute', () => {
    const s = scenario();
    const e = s.spawn('brute', V(0, 0, 0), 0, { state: 'combat' }) as Enemy;
    s.setPlayer(0, 0, 9);
    s.until(() => e.atk === 'run', 6);
    expect(e.state).toBe('charge');
    expect(s.sys.hit(e, stab(V(0, 0, 9)))).toBe('killed');
    expect(e.hp).toBe(0);
  });

  it('destroys a turret', () => {
    const s = scenario();
    const e = s.spawn('turret', V(0, 0, 0), 0) as Enemy;
    s.step();
    expect(s.sys.hit(e, stab(V(0, 0, 1.5)))).toBe('killed');
    expect(e.alive).toBe(false);
    expect(e.body).toBeNull();
  });
});

describe('hidden blade: stealth', () => {
  it('a calm man dies quietly: a mate with his back to it never knows (GHOST)', () => {
    const s = scenario();
    s.setPlayer(0, 0, -30);
    s.step();
    const victim = s.spawn('rifleman', V(0, 0, 0), 0) as Enemy;
    const mate = s.spawn('rifleman', V(0, 0, 7), 0) as Enemy; // 7 m on, looking away
    s.step();
    // even from his front: he never saw it coming
    expect(s.sys.hit(victim, stab(off(victim, 1.5)))).toBe('killed');
    const d = s.log.died[0].ctx;
    expect(d.unaware).toBe(true);
    expect(d.witnessed).toBe(false);
    expect(mate.mode).toBe('calm');
    expect(s.log.sounds.some((x) => x.kind === 'shout')).toBe(false);
    s.step(60);
    expect(mate.mode).toBe('calm');
  });

  it('a quiet stab is seen only by those looking his way', () => {
    const s = scenario();
    s.setPlayer(0, 0, -30);
    s.step();
    const victim = s.spawn('rifleman', V(0, 0, 0), 0) as Enemy;
    const mate = s.spawn('rifleman', V(0, 0, 8), Math.PI) as Enemy; // facing him
    s.step();
    s.sys.hit(victim, stab(off(victim, -1.5)));
    expect(s.log.died[0].ctx.witnessed).toBe(true);
    expect(mate.mode).toBe('combat');
    // he comes to the body
    expect(mate.lastKnown.distanceTo(victim.pos)).toBeLessThan(0.1);
  });

  it('a man in combat who sees it coming cries out: anyone in earshot comes, far ones do not', () => {
    const s = scenario();
    s.setPlayer(0, 0, 1.5);
    s.step();
    const victim = s.spawn('rifleman', V(0, 0, 0), 0, { state: 'combat' }) as Enemy;
    const near = s.spawn('grenadier', V(-10, 0, -4), -Math.PI / 2, { squad: 'b' }) as Enemy; // looking away
    const far = s.spawn('rifleman', V(0, 0, -40), Math.PI, { squad: 'c' }) as Enemy;
    s.step();
    expect(near.mode).toBe('calm');
    expect(s.sys.hit(victim, stab(V(0, 0, 1.5)))).toBe('killed');
    expect(s.log.sounds.some((x) => x.kind === 'shout')).toBe(true);
    expect(near.mode).toBe('combat');
    // he heard where it happened, not where you are
    expect(near.lastKnown.distanceTo(victim.pos)).toBeLessThan(0.1);
    expect(near.seesPlayer).toBe(false);
    expect(far.mode).toBe('calm');
  });

  it('from behind, even a man in combat dies quietly', () => {
    const s = scenario();
    s.setPlayer(0, 0, 12);
    s.step();
    const victim = s.spawn('rifleman', V(0, 0, 0), 0, { state: 'combat' }) as Enemy;
    const near = s.spawn('grenadier', V(-10, 0, -4), -Math.PI / 2, { squad: 'b' }) as Enemy;
    s.step();
    // (just outside his ±90° view)
    const behind = victim.pos.clone().add(V(Math.sin(AI.combatFov + 0.2), 0, Math.cos(AI.combatFov + 0.2)).multiplyScalar(1.5));
    s.sys.hit(victim, stab(behind));
    expect(s.log.sounds.some((x) => x.kind === 'shout')).toBe(false);
    expect(near.mode).toBe('calm');
  });

  it('a downed man in combat cannot cry out', () => {
    const s = scenario();
    s.setPlayer(0, 0, 12);
    s.step();
    const victim = s.spawn('rifleman', V(0, 0, 0), 0, { state: 'combat' }) as Enemy;
    const near = s.spawn('grenadier', V(-10, 0, -4), -Math.PI / 2, { squad: 'b' }) as Enemy;
    s.step();
    s.sys.hit(victim, { source: 'impact', amount: 0, charged: true, speed: 9, from: V(0, 1, 3), team: 'neutral', instigator: 'player' });
    expect(victim.state).toBe('downed');
    s.sys.hit(victim, stab(off(victim, 1.5)));
    expect(victim.alive).toBe(false);
    expect(s.log.sounds.some((x) => x.kind === 'shout')).toBe(false);
    expect(near.mode).toBe('calm');
  });
});

describe('hidden blade: Voss', () => {
  function arena(points = [V(10, 0, 0), V(-10, 0, 0), V(0, 0, -10)], small = false) {
    const s = scenario(['crown']);
    if (small) {
      // a 5 m pad over nothing: no room anywhere to blink to
      s.ground.enabled = false;
      s.world.add({ x: -2.5, y: -1, z: -2.5 }, { x: 2.5, y: 0, z: 2.5 });
    }
    s.sys.setBossArena(V(0, 0, 0), 20, points);
    s.setPlayer(0, 0, 1.5);
    const e = s.spawn('boss', V(0, 0, 0), 0, { state: 'combat', zone: 'crown' }) as Enemy;
    s.step();
    return { s, e };
  }

  it('a stab wounds him on his feet, then he blinks out at once to a far point', () => {
    const { s, e } = arena();
    expect(e.state).toBe('combat');
    expect(s.sys.hit(e, stab(V(0, 0, 1.5)))).toBe('hurt');
    expect(e.hp).toBe(1800 - AI.boss.bladeDamage);
    // no warning: he's already passing through his red rift
    expect(s.sys.boss()!.blinking).toBe(true);
    const pair = s.log.bossRift[s.log.bossRift.length - 1];
    expect(pair.a).not.toBeNull();
    s.until(() => !s.sys.boss()!.blinking, 1);
    expect(e.pos.distanceTo(pair.b!)).toBeLessThan(0.3);
    expect(Math.hypot(e.pos.x - s.player.pos.x, e.pos.z - s.player.pos.z)).toBeGreaterThan(8);
    expect(s.log.melee.length).toBe(0);
  });

  it('stunned, he takes the stab, gets up and is gone', () => {
    const { s, e } = arena();
    // (from behind: his rift shield doesn't face it)
    s.sys.hit(e, { source: 'impact', amount: 0, charged: true, speed: 19, from: V(0, 1, -3), team: 'neutral', instigator: 'player' });
    expect(e.state).toBe('stunned');
    s.step(30);
    expect(s.sys.hit(e, stab(V(0, 0, 1.5)))).toBe('hurt');
    expect(e.state).toBe('combat');
    expect(s.sys.boss()!.blinking).toBe(true);
  });

  it('nowhere to blink: his gauntlet throws you off instead', () => {
    const { s, e } = arena([], true);
    expect(s.sys.hit(e, stab(V(0, 0, 1.5)))).toBe('hurt');
    expect(s.sys.boss()!.blinking).toBe(false);
    const m = s.log.melee[s.log.melee.length - 1];
    expect(m.damage).toBe(0);
    expect(m.push.z).toBeGreaterThan(AI.boss.throwOff - 0.01);
  });
});
