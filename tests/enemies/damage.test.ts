import { describe, expect, it } from 'vitest';
import { LAW, type ImpactInfo } from '../../src/core/contracts';
import type { Enemy } from '../../src/actors/enemies';
import { fakeEnd, scenario, V } from './fakes';

const land = (speed: number, charged: boolean, surface: ImpactInfo['surface'] = 'ground'): ImpactInfo => ({
  speed,
  charged,
  surface,
  normal: V(0, 1, 0),
  collider: null,
  point: V(0, 0, 0),
});

describe('onImpact (LAW thresholds)', () => {
  it('charged landings: 8 downs, 12 kills; armour needs 18', () => {
    const s = scenario();
    s.step();
    const mk = (kind: 'rifleman' | 'brute', x: number) => {
      const e = s.spawn(kind, V(x, 0, -10), 0) as Enemy;
      s.sys.launch(e);
      return e;
    };
    const soft = mk('rifleman', -6);
    expect(s.sys.onImpact(soft, land(LAW.knockSpeed - 1, true))).toBe('ignored');
    expect(soft.state).toBe('stagger');
    const a = mk('rifleman', -3);
    expect(s.sys.onImpact(a, land(LAW.knockSpeed, true))).toBe('knocked');
    expect(a.state).toBe('downed');
    expect(s.log.knocked.some((k) => k.id === a.id)).toBe(true);
    const b = mk('rifleman', 0);
    b.body!.peakY = 11;
    expect(s.sys.onImpact(b, land(LAW.killSpeed, true))).toBe('killed');
    const died = s.log.died.find((d) => d.id === b.id)!;
    expect(died.ctx.cause).toBe('fall');
    expect(died.ctx.fallHeight).toBeCloseTo(11);
    expect(died.ctx.unaware).toBe(true);
    expect(died.ctx.airborne).toBe(true);
    const br = mk('brute', 3);
    expect(s.sys.onImpact(br, land(LAW.killSpeed, true))).toBe('knocked');
    expect(br.alive).toBe(true);
    expect(br.state).toBe('stunned');
    expect(br.hp).toBeLessThan(250);
    const br2 = mk('brute', 6);
    expect(s.sys.onImpact(br2, land(LAW.armorSpeed, true))).toBe('killed');
  });

  it('a charged wall impact kills as "impact"', () => {
    const s = scenario();
    const e = s.spawn('rifleman', V(0, 0, 0)) as Enemy;
    s.sys.launch(e, V(0, 2, 13));
    expect(s.sys.onImpact(e, land(13, true, 'wall'))).toBe('killed');
    expect(s.log.died[0].ctx.cause).toBe('impact');
  });

  it('uncharged speed only ever knocks down', () => {
    const s = scenario();
    const a = s.spawn('rifleman', V(0, 0, 0)) as Enemy;
    s.sys.launch(a);
    expect(s.sys.onImpact(a, land(30, false))).toBe('knocked');
    expect(a.state).toBe('downed');
    expect(a.alive).toBe(true);
    const b = s.spawn('rifleman', V(3, 0, 0)) as Enemy;
    s.sys.launch(b);
    expect(s.sys.onImpact(b, land(9, false))).toBe('hurt');
    expect(b.state).toBe('stagger');
    // a walking (kinematic) enemy ignores bumps
    const c = s.spawn('rifleman', V(6, 0, 0)) as Enemy;
    expect(s.sys.onImpact(c, land(20, true))).toBe('ignored');
  });

  it('downed enemies get up after 2.5 s, in combat', () => {
    const s = scenario();
    const a = s.spawn('rifleman', V(0, 0, 0)) as Enemy;
    s.step();
    s.sys.launch(a);
    s.sys.onImpact(a, land(9, true));
    const t = s.until(() => a.state !== 'downed', 5);
    expect(t).toBeGreaterThan(2.4);
    expect(t).toBeLessThan(2.7);
    expect(a.state).toBe('combat');
    expect(a.body!.simulate).toBe(false);
  });
});

describe('launch chain', () => {
  it('a walker who loses his ground falls (kinematic → simulated) and tumbles', () => {
    const s = scenario();
    const e = s.spawn('rifleman', V(0, 0, 0)) as Enemy;
    s.step(30);
    expect(e.body!.simulate).toBe(false);
    expect(e.offBalance).toBe(true);
    s.ground.enabled = false; // a trapdoor opened under the whole quay
    s.step(8);
    expect(e.state).toBe('launched');
    expect(e.body!.simulate).toBe(true);
    expect(s.char(e).tumble).not.toBeNull();
    expect(e.pos.y).toBeLessThan(0);
  });

  it('trapdoor crossing → splash: SPLASHDOWN context', () => {
    const s = scenario();
    const e = s.spawn('rifleman', V(0, 0, 0)) as Enemy;
    s.step();
    s.sys.launch(e);
    s.sys.onCrossed(e, fakeEnd('floor'), fakeEnd('air', 2), 6);
    s.sys.onSplash(e);
    const d = s.log.died[0];
    expect(d.ctx.cause).toBe('water');
    expect(d.ctx.viaTrapdoor).toBe(true);
    expect(d.ctx.crossings).toBe(1);
    expect(d.ctx.unaware).toBe(true);
    expect(d.ctx.info.instigator).toBe('player');
    expect(s.char(e).deathKind).toBe('drown');
    expect(e.body!.kind).toBe('corpse');
    // sinks out of sight
    s.step(200);
    expect(e.char.root.visible).toBe(false);
    expect(e.body).toBeNull();
  });

  it('a charging brute sent through a rift is a MATADOR; the void kills', () => {
    const s = scenario();
    const e = s.spawn('brute', V(0, 0, 0), 0, { state: 'combat' }) as Enemy;
    s.setPlayer(0, 0, 10);
    s.until(() => e.atk === 'run', 5);
    s.sys.onCrossed(e, fakeEnd('stand'), fakeEnd('wall', 2), 14);
    expect(e.state).toBe('launched');
    expect(e.body!.simulate).toBe(true);
    s.sys.onFellOut(e);
    const d = s.log.died[0].ctx;
    expect(d.cause).toBe('void');
    expect(d.matador).toBe(true);
    expect(d.unaware).toBe(false);
    expect(e.body).toBeNull();
    expect(s.physics.bodies.length).toBe(0);
    expect(e.char.root.visible).toBe(false);
  });

  it('corpses stay in physics and can be thrown', () => {
    const s = scenario();
    const e = s.spawn('rifleman', V(0, 0, 0)) as Enemy;
    s.step();
    s.sys.kill(e, { source: 'bolt', amount: 60, charged: true, team: 'player', instigator: 'player' });
    expect(e.alive).toBe(false);
    expect(e.body!.kind).toBe('corpse');
    expect(e.body!.simulate).toBe(true);
    expect(s.sys.enemyOfBody(e.body!)).toBe(e);
    e.body!.vel.set(0, 6, 8);
    s.step(10);
    expect(e.char.root.position.z).toBeGreaterThan(0.5);
    expect(s.char(e).deathKind).toBe('shot');
  });
});

describe('hits', () => {
  it('blade, shear, void and water kill regardless of HP and armour', () => {
    const s = scenario();
    for (const src of ['blade', 'shear', 'void', 'water'] as const) {
      const e = s.spawn('brute', V(0, 0, 0)) as Enemy;
      expect(s.sys.hit(e, { source: src, amount: 1, charged: false, team: 'player', instigator: 'player' })).toBe('killed');
    }
  });

  it('brute: impacts below armour speed only stagger; bolts hurt', () => {
    const s = scenario();
    const e = s.spawn('brute', V(0, 0, 0)) as Enemy;
    expect(s.sys.hit(e, { source: 'impact', amount: 40, charged: true, speed: 15, team: 'neutral', instigator: 'player' })).toBe('hurt');
    expect(e.hp).toBe(250);
    expect(e.state).toBe('stagger');
    expect(s.sys.hit(e, { source: 'bolt', amount: 60, charged: true, team: 'player', instigator: 'player' })).toBe('hurt');
    expect(e.hp).toBe(190);
  });

  it('witnessed vs ghost kills; a rift-exit hit makes allies look at the exit', () => {
    const s = scenario();
    s.step();
    const victim = s.spawn('rifleman', V(0, 0, 0), 0) as Enemy;
    const mate = s.spawn('rifleman', V(0, 0, 8), Math.PI) as Enemy; // 8 m away, facing him
    const far = s.spawn('warden', V(-10, 0, -10), 0) as Enemy;
    s.world.add({ x: -12, y: 0, z: -6 }, { x: -8, y: 4, z: -5 }); // wall between far and victim
    s.step();
    const exit = V(4, 2, 0);
    s.sys.kill(victim, { source: 'bolt', amount: 60, charged: true, from: exit, exitEndId: 3, team: 'player', instigator: 7 });
    const d = s.log.died[0].ctx;
    expect(d.witnessed).toBe(true);
    expect(d.unaware).toBe(true);
    expect(mate.mode).toBe('combat');
    expect(mate.lookT).toBeGreaterThan(2.5);
    expect(mate.lookAt.distanceTo(exit)).toBeLessThan(1e-6);
    expect(s.log.barks.some((b) => b.key === 'bark.mateDown' && b.id === mate.id)).toBe(true);
    // the zone went hot: the Warden fights too
    expect(far.mode).toBe('combat');

    const s2 = scenario();
    s2.step();
    const lone = s2.spawn('rifleman', V(0, 0, 0)) as Enemy;
    const hidden = s2.spawn('rifleman', V(0, 0, 10), Math.PI) as Enemy;
    s2.world.add({ x: -3, y: 0, z: 4 }, { x: 3, y: 4, z: 5 });
    s2.step();
    s2.sys.kill(lone, { source: 'bolt', amount: 60, charged: true, team: 'player', instigator: null });
    expect(s2.log.died[0].ctx.witnessed).toBe(false);
    expect(s2.log.died[0].ctx.unaware).toBe(true);
    expect(hidden.mode).toBe('calm');
  });

  it('a Warden turns his shield toward the exit that hurt an ally', () => {
    const s = scenario();
    s.step();
    const r = s.spawn('rifleman', V(0, 0, 0), 0, { state: 'combat' }) as Enemy;
    const w = s.spawn('warden', V(3, 0, 0), 0, { state: 'combat' }) as Enemy;
    s.sys.hit(r, { source: 'bolt', amount: 10, charged: true, from: V(3, 1, -10), exitEndId: 4, team: 'player', instigator: 'player' });
    expect(w.shieldT).toBeGreaterThan(2.5);
    s.step(90); // 2.2 rad/s: a Warden is slow to turn (flank him)
    // shield now faces -Z (toward the exit), so a rear-exit shot is blocked
    expect(Math.abs(Math.abs(w.yaw) - Math.PI)).toBeLessThan(0.3);
    expect(s.sys.hit(w, { source: 'bolt', amount: 60, charged: true, from: V(3, 1, -10), team: 'player', instigator: 'player' })).toBe('blocked');
  });
});
