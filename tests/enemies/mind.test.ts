import { describe, expect, it } from 'vitest';
import type { Enemy } from '../../src/actors/enemies';
import { scenario, V } from './fakes';

describe('perception and zone alert', () => {
  it('a sighting makes the whole zone hot, other zones stay calm', () => {
    const s = scenario(['pier', 'yard']);
    const spotter = s.spawn('rifleman', V(0, 0, 5), 0) as Enemy; // player 10 m ahead
    const a = s.spawn('rifleman', V(-20, 0, -20), Math.PI) as Enemy; // far, facing away
    const b = s.spawn('warden', V(20, 0, -20), Math.PI) as Enemy;
    const y = s.spawn('rifleman', V(0, 0, -30), 0, { zone: 'yard' }) as Enemy;
    y.yaw = Math.PI;
    s.step(10);
    expect(spotter.mode).not.toBe('combat');
    const t = s.until(() => spotter.mode === 'combat', 4);
    expect(t).toBeLessThan(2);
    expect(a.mode).toBe('combat');
    expect(b.mode).toBe('combat');
    expect(a.state).toBe('combat');
    expect(y.mode).toBe('calm');
    expect(s.sys.isHot('pier')).toBe(true);
    expect(s.sys.isHot('yard')).toBe(false);
    expect(new Set(s.log.aware)).toEqual(new Set([spotter.id, a.id, b.id]));
    expect(s.log.barks.some((k) => k.key === 'bark.contact' && k.id === spotter.id)).toBe(true);
    // the unaware ones turn toward where the player was
    s.step(90);
    const dz = s.player.pos.z - a.pos.z, dx = s.player.pos.x - a.pos.x;
    expect(Math.abs(Math.atan2(dx, dz) - a.yaw)).toBeLessThan(0.5);
    s.sys.alertZone('yard');
    expect(y.mode).toBe('combat');
  });

  it('a later encounter in a zone that fought before starts as its defs say', () => {
    const s = scenario();
    const first = s.spawn('rifleman', V(0, 0, 0), Math.PI, { state: 'combat' }) as Enemy;
    expect(s.sys.isHot('pier')).toBe(true);
    s.step();
    // the trapdoor lesson's guards arrive while the first fight is still on
    const g1 = s.spawn('rifleman', V(-15, 0, -25), Math.PI) as Enemy;
    const g2 = s.spawn('rifleman', V(15, 0, -25), Math.PI) as Enemy;
    s.step(30);
    expect(g1.mode).toBe('calm');
    expect(g2.offBalance).toBe(true);
    s.sys.kill(first, { source: 'blade', amount: 1, charged: false, team: 'player', instigator: 'player' });
    expect(s.sys.isHot('pier')).toBe(false);
    // one of them notices: his whole zone joins
    s.sys.hit(g1, { source: 'bolt', amount: 10, charged: true, team: 'player', instigator: 'player' });
    expect(g2.mode).toBe('combat');
    expect(s.sys.isHot('pier')).toBe(true);
  });

  it('sees only within ±60° and 32 × calmSight m unaware; crouching shortens it', () => {
    const s = scenario();
    const side = s.spawn('rifleman', V(0, 0, 0), Math.PI / 2) as Enemy; // player at 90°
    s.step(120);
    expect(side.seesPlayer).toBe(false);
    expect(side.mode).toBe('calm');
    const far = scenario();
    far.setPlayer(0, 0, 20);
    far.player.crouched = true;
    const e = far.spawn('rifleman', V(0, 0, 0), 0) as Enemy;
    far.step(60);
    expect(e.seesPlayer).toBe(false); // 20 m > 32 × 0.7 × 0.65
    far.player.crouched = false;
    far.step(20);
    expect(e.seesPlayer).toBe(true); // 20 m < 32 × 0.7
    const beyond = scenario();
    beyond.setPlayer(0, 0, 26);
    const u = beyond.spawn('rifleman', V(0, 0, 0), 0) as Enemy;
    beyond.step(60);
    expect(u.seesPlayer).toBe(false); // unaware: 26 m > 32 × 0.7
  });

  it('a wall hides the player', () => {
    const s = scenario();
    s.world.add({ x: -5, y: 0, z: 7 }, { x: 5, y: 4, z: 8 });
    const e = s.spawn('rifleman', V(0, 0, 0), 0) as Enemy;
    s.step(120);
    expect(e.seesPlayer).toBe(false);
    expect(e.mode).toBe('calm');
  });

  it('noise makes calm guards suspicious; they go and look', () => {
    const s = scenario();
    const e = s.spawn('rifleman', V(0, 0, 0), Math.PI) as Enemy; // facing away
    s.setPlayer(0, 0, 30);
    s.player.noise.push({ at: V(4, 0, -6), radius: 12 });
    s.step();
    s.player.noise.length = 0;
    expect(e.mode).toBe('suspicious');
    expect(e.state).toBe('suspicious');
    expect(s.log.barks.some((b) => b.key === 'bark.what')).toBe(true);
    expect(e.offBalance).toBe(true);
    // a beat to stare, then a 1.5 m/s walk over (7.2 m)
    s.step(60 * 6);
    expect(Math.hypot(e.pos.x - 4, e.pos.z + 6)).toBeLessThan(1);
    s.step(60 * 3);
    expect(e.mode).toBe('calm');
    expect(e.state).toBe('idle');
  });

  it('patrols its route with waits', () => {
    const s = scenario();
    s.setPlayer(0, 0, -40);
    const e = s.spawn('rifleman', V(0, 0, 0), Math.PI / 2, { state: 'patrol', route: [V(0, 0, 0), V(6, 0, 0)], wait: [1, 1] }) as Enemy;
    expect(e.state).toBe('patrol');
    s.step(60 * 4);
    expect(e.pos.x).toBeGreaterThan(5);
    const back = s.until(() => e.pos.x < 1, 8);
    expect(back).toBeGreaterThan(3); // waited ~1 s, then walked 5 m back
    expect(back).toBeLessThan(6);
  });
});

describe('trap targets', () => {
  it('flags: unaware and off-balance can fall, steady combat enemies refuse', () => {
    const s = scenario(['pier']);
    const calm = s.spawn('rifleman', V(-10, 0, -10), Math.PI) as Enemy;
    const hot = s.spawn('rifleman', V(10, 0, -10), 0, { state: 'combat', zone: 'yard' }) as Enemy;
    const tur = s.spawn('turret', V(0, 0, -15), 0) as Enemy;
    const boss = s.spawn('boss', V(0, 0, -20), 0, { state: 'combat', zone: 'crown' }) as Enemy;
    const gone = s.spawn('rifleman', V(0, 0, -25), Math.PI, { zone: 'lab' }) as Enemy;
    s.ctx.activeZones = new Set(['pier', 'yard', 'crown']);
    s.step();
    const t = () => new Map(s.sys.trapTargets().map((x) => [x.key, { ...x }]));
    let m = t();
    expect(m.get(calm.key)).toMatchObject({ canFall: true, steady: false });
    expect(m.get(hot.key)).toMatchObject({ canFall: false, steady: true });
    expect(m.get(tur.key)).toMatchObject({ canFall: false, steady: true });
    expect(m.get(boss.key)).toMatchObject({ canFall: false, steady: true });
    expect(m.has(gone.key)).toBe(false);
    expect(m.get(calm.key)!.pos).toBe(calm.pos);
    s.sys.stagger(hot, 1.4);
    m = t();
    expect(m.get(hot.key)).toMatchObject({ canFall: true, steady: false });
    // shove stagger has no effect on the boss
    s.sys.stagger(boss, 1.4);
    expect(t().get(boss.key)).toMatchObject({ canFall: false, steady: true });
    s.sys.kill(calm, { source: 'blade', amount: 1, charged: false, team: 'player', instigator: 'player' });
    expect(t().has(calm.key)).toBe(false);
  });
});

describe('zones', () => {
  it('enemies outside active zones are frozen and hidden', () => {
    const s = scenario(['yard']);
    const e = s.spawn('rifleman', V(0, 0, 5), 0, { state: 'combat' }) as Enemy;
    s.step(120);
    expect(e.char.root.visible).toBe(false);
    expect(e.body!.enabled).toBe(false);
    expect(s.log.telegraphs.length).toBe(0);
    expect(e.pos.distanceTo(V(0, 0, 5))).toBe(0);
    s.ctx.activeZones.add('pier');
    s.step();
    expect(e.char.root.visible).toBe(true);
    expect(e.body!.enabled).toBe(true);
  });

  it('zoneCleared by zone or by encounter spawn ids', () => {
    const s = scenario();
    const a = s.spawn('rifleman', V(0, 0, 0), 0, { id: 'enc1-a' });
    const b = s.spawn('rifleman', V(3, 0, 0), 0, { id: 'enc1-b' });
    const kill = { source: 'blade' as const, amount: 1, charged: false, team: 'player' as const, instigator: 'player' as const };
    expect(s.sys.zoneCleared('pier')).toBe(false);
    s.sys.kill(a, kill);
    expect(s.sys.zoneCleared('pier', ['enc1-a'])).toBe(true);
    expect(s.sys.zoneCleared('pier', ['enc1-a', 'enc1-b'])).toBe(false);
    expect(s.sys.zoneCleared('pier', ['enc1-a', 'never-spawned'])).toBe(false);
    s.sys.kill(b, kill);
    expect(s.sys.zoneCleared('pier')).toBe(true);
    expect(s.sys.byKey(`enemy:${b.id}`)).toBe(b);
    expect(s.sys.get(a.id)).toBe(a);
  });

  it('clear() removes every enemy and its body', () => {
    const s = scenario();
    s.spawn('rifleman', V(0, 0, 0));
    s.spawn('brute', V(3, 0, 0));
    s.step();
    s.sys.clear();
    expect(s.sys.list.length).toBe(0);
    expect(s.physics.bodies.length).toBe(0);
    expect(s.sys.group.children.length).toBe(0);
  });
});
