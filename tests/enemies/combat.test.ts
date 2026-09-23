import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LAW, type HitInfo } from '../../src/core/contracts';
import type { Enemy } from '../../src/actors/enemies';
import { solveLob } from '../../src/actors/aimath';
import { AI } from '../../src/actors/tuning';
import { scenario, V } from './fakes';

const charged = (from: THREE.Vector3, amount = LAW.bolt.damageCharged, extra: Partial<HitInfo> = {}): HitInfo => ({
  source: 'bolt',
  amount,
  charged: true,
  from,
  team: 'player',
  instigator: 'player',
  ...extra,
});

describe('rifleman', () => {
  it('telegraphs 0.6 s with a laser, then fires exactly 3 bolts at the player', () => {
    const s = scenario();
    const e = s.spawn('rifleman', V(0, 0, 0), 0, { state: 'combat', perch: true });
    s.until(() => s.log.bolts.length >= 3, 6);
    const bolts = s.log.bolts.filter((b) => b.id === e.id);
    expect(bolts.length).toBe(3);
    const first = bolts[0].t;
    const lasers = s.log.telegraphs.filter((t) => t.id === e.id && t.kind === 'laser' && t.t <= first);
    expect(lasers.length).toBeGreaterThan(20);
    const start = lasers[0].t;
    expect(first - start).toBeGreaterThan(0.58);
    expect(first - start).toBeLessThan(0.66);
    // t01 ramps to 1, laser points at the player
    expect(lasers[0].t01).toBeLessThan(0.1);
    expect(lasers[lasers.length - 1].t01).toBeCloseTo(1, 1);
    expect(lasers[5].to.distanceTo(s.player.chest)).toBeLessThan(0.5);
    // 0.12 s cadence, aimed at the chest
    expect(bolts[1].t - bolts[0].t).toBeCloseTo(0.12, 1);
    expect(bolts[2].t - bolts[1].t).toBeCloseTo(0.12, 1);
    for (const b of bolts) {
      const want = s.player.chest.clone().sub(b.from).normalize();
      expect(b.dir.dot(want)).toBeGreaterThan(0.99);
    }
    // then a reload pause (1.2–2 s) plus a fresh telegraph before the next burst
    s.until(() => s.log.bolts.length > 3, 5);
    expect(s.log.bolts[3].t - bolts[2].t).toBeGreaterThan(1.2 + 0.6 - 0.02);
  });

  it('exposes the laser lock as a CATCH threat with a shrinking eta', () => {
    const s = scenario();
    const e = s.spawn('rifleman', V(0, 0, 0), 0, { state: 'combat', perch: true }) as Enemy;
    s.until(() => e.atk === 'aim', 4);
    s.step(6);
    const t1 = s.sys.threats().find((t) => t.kind === 'laser')!;
    expect(t1).toBeTruthy();
    expect(t1.eta).toBeGreaterThan(0.3);
    expect(t1.eta).toBeLessThan(0.6);
    const eta1 = t1.eta;
    s.step(6);
    const t2 = s.sys.threats().find((t) => t.kind === 'laser')!;
    expect(t2.eta).toBeLessThan(eta1);
    expect(t2.from.distanceTo(e.pos)).toBeLessThan(2);
  });

  it('never lets more than AI.maxTokens enemies telegraph or fire at once (tokens)', () => {
    const s = scenario();
    const list = [-8, -4, 0, 4, 8].map((x) => s.spawn('rifleman', V(x, 0, 0), 0, { state: 'combat' }) as Enemy);
    let max = 0;
    let shooters = new Set<number>();
    for (let i = 0; i < 60 * 10; i++) {
      s.step();
      const busy = list.filter((e) => e.atk === 'aim' || e.atk === 'fire');
      max = Math.max(max, busy.length);
      busy.forEach((e) => shooters.add(e.id));
      expect(busy.length).toBeLessThanOrEqual(AI.maxTokens);
      expect(s.sys.tokensInUse).toBeLessThanOrEqual(AI.maxTokens);
    }
    expect(max).toBe(AI.maxTokens);
    expect(shooters.size).toBe(5);
    // riflemen keep their distance band from the player
    for (const e of list) {
      const d = Math.hypot(e.pos.x - s.player.pos.x, e.pos.z - s.player.pos.z);
      expect(d).toBeGreaterThan(8);
      expect(d).toBeLessThan(22);
    }
  });
});

describe('grenadier', () => {
  it('shows an arc for 0.5 s, then lobs a grenade that lands at the player', () => {
    const s = scenario();
    const e = s.spawn('grenadier', V(0, 0, 0), 0, { state: 'combat', perch: true });
    s.until(() => s.log.grenades.length > 0, 8);
    const g = s.log.grenades[0];
    const arcs = s.log.telegraphs.filter((t) => t.id === e.id && t.kind === 'arc' && t.t <= g.t);
    expect(g.t - arcs[0].t).toBeGreaterThan(0.48);
    expect(g.t - arcs[0].t).toBeLessThan(0.55);
    expect(s.log.barks.some((b) => b.key === 'bark.grenade')).toBe(true);
    // integrate the lob with LAW gravity: lands on the player's feet after ~1 s
    const t = 1;
    const land = g.from.clone().addScaledVector(g.vel, t);
    land.y -= 0.5 * LAW.gravity * t * t;
    expect(land.distanceTo(s.player.pos)).toBeLessThan(0.1);
  });

  it('solveLob hits its target for any flight time', () => {
    const from = V(1, 2, 3), to = V(-7, 0.5, 12);
    for (const T of [0.6, 1, 1.4]) {
      const v = solveLob(from, to, T, LAW.gravity, V());
      const p = from.clone().addScaledVector(v, T);
      p.y -= 0.5 * LAW.gravity * T * T;
      expect(p.distanceTo(to)).toBeLessThan(1e-9);
    }
  });
});

describe('sniper', () => {
  it('charges a 1.2 s beam telegraph (a CATCH threat) before firing', () => {
    const s = scenario();
    const e = s.spawn('sniper', V(0, 0, 0), 0, { state: 'combat' });
    s.setPlayer(0, 0, 40);
    s.until(() => (e as Enemy).atk === 'aim', 5);
    s.step(30);
    const th = s.sys.threats().find((t) => t.kind === 'beam');
    expect(th).toBeTruthy();
    expect(th!.eta).toBeGreaterThan(0.6);
    expect(th!.eta).toBeLessThan(0.75);
    s.until(() => s.log.beams.length > 0, 3);
    const beam = s.log.beams[0];
    const tele = s.log.telegraphs.filter((t) => t.id === e.id && t.kind === 'beam');
    expect(beam.t - tele[0].t).toBeCloseTo(LAW.beam.telegraph, 1);
    expect(beam.dir.z).toBeGreaterThan(0.99);
    // perched: never moved
    expect(e.pos.distanceTo(V(0, 0, 0))).toBeLessThan(1e-6);
  });
});

describe('warden', () => {
  it('blocks a frontal charged hit and takes one from behind', () => {
    const s = scenario();
    const e = s.spawn('warden', V(0, 0, 0), 0); // facing +Z
    s.step();
    expect(s.sys.hit(e, charged(V(0, 1.3, 8)))).toBe('blocked');
    expect(e.hp).toBe(70);
    expect(s.log.sounds.some((x) => x.kind === 'clang')).toBe(true);
    // 50° off his nose is still shield
    expect(s.sys.hit(e, charged(V(Math.sin(0.87) * 8, 1.3, Math.cos(0.87) * 8)))).toBe('blocked');
    expect(s.sys.hit(e, charged(V(0, 1.3, -8)))).toBe('hurt');
    expect(e.hp).toBe(10);
    // shove-staggered: the shield swings aside
    const w2 = s.spawn('warden', V(5, 0, 0), 0);
    s.sys.stagger(w2, 1.4);
    expect(s.sys.hit(w2, charged(V(5, 1.3, 8)))).toBe('hurt');
  });

  it('lets armour-speed impacts through the shield', () => {
    const s = scenario();
    const e = s.spawn('warden', V(0, 0, 0), 0);
    const r = s.sys.hit(e, { source: 'impact', amount: 0, charged: true, speed: 19, from: V(0, 1, 5), team: 'neutral', instigator: 'player' });
    expect(r).toBe('killed');
  });

  it('advances and shield-bashes after a wind-up', () => {
    const s = scenario();
    const e = s.spawn('warden', V(0, 0, 0), 0, { state: 'combat' });
    s.setPlayer(0, 0, 8);
    s.until(() => s.log.melee.length > 0, 10);
    const m = s.log.melee[0];
    expect(m.damage).toBe(15);
    expect(m.push.z).toBeGreaterThan(3);
    expect(e.pos.z).toBeGreaterThan(5);
    expect((s.char(e).plays as string[]).includes('push')).toBe(true);
  });
});

describe('brute', () => {
  it('roars 1 s, charges straight at 14 m/s and is stunned by a wall', () => {
    const s = scenario();
    s.world.add({ x: -5, y: 0, z: 14 }, { x: 5, y: 3, z: 15 });
    const e = s.spawn('brute', V(0, 0, 0), 0, { state: 'combat' }) as Enemy;
    s.setPlayer(0, 0, 10);
    const roarT = s.until(() => e.state === 'charge', 5);
    expect(roarT).toBeLessThan(5);
    expect(s.log.sounds.some((x) => x.kind === 'roar')).toBe(true);
    expect(e.offBalance).toBe(true);
    const t0 = s.clock.t;
    s.until(() => e.atk === 'run', 2);
    expect(s.clock.t - t0).toBeCloseTo(1, 1);
    const tele = s.log.telegraphs.filter((t) => t.id === e.id && t.kind === 'charge' && t.t >= t0);
    expect(tele.length).toBeGreaterThan(50);
    expect(s.sys.threats().some((t) => t.kind === 'charge')).toBe(true);
    // dodge aside: he keeps his locked line
    s.setPlayer(6, 0, 10);
    const x0 = e.pos.x;
    s.step(3);
    expect(Math.hypot(e.body!.vel.x, e.body!.vel.z)).toBeCloseTo(14, 1);
    expect(e.body!.vel.normalize().z).toBeGreaterThan(0.95);
    s.until(() => e.state === 'stunned', 2);
    expect(e.state).toBe('stunned');
    expect(Math.abs(e.pos.x - x0)).toBeLessThan(0.1);
    expect(e.pos.z).toBeGreaterThan(12.5);
    expect(s.log.sounds.some((x) => x.kind === 'thud')).toBe(true);
    expect(s.log.melee.length).toBe(0);
    const stunT = s.until(() => e.state !== 'stunned', 4);
    expect(stunT).toBeGreaterThan(2.4);
    expect(stunT).toBeLessThan(2.6);
    expect(e.state).toBe('combat');
  });

  it('hits the player for 35 when the charge connects', () => {
    const s = scenario();
    const e = s.spawn('brute', V(0, 0, 0), 0, { state: 'combat' }) as Enemy;
    s.setPlayer(0, 0, 9);
    s.until(() => s.log.melee.length > 0, 6);
    expect(s.log.melee[0].damage).toBe(35);
    expect(s.log.melee[0].push.z).toBeGreaterThan(5);
    expect(e.state).toBe('combat');
  });

  it('a wall impact reported by physics during the charge also stuns', () => {
    const s = scenario();
    const e = s.spawn('brute', V(0, 0, 0), 0, { state: 'combat' }) as Enemy;
    s.setPlayer(0, 0, 9);
    s.until(() => e.atk === 'run', 6);
    const r = s.sys.onImpact(e, { speed: 14, normal: V(0, 0, -1), surface: 'wall', collider: null, charged: false, point: e.pos.clone() });
    expect(r).toBe('knocked');
    expect(e.state).toBe('stunned');
  });
});

describe('turret', () => {
  it('turns at 60°/s, telegraphs, then fires a 6-round stream', () => {
    const s = scenario();
    const e = s.spawn('turret', V(0, 0, 0), Math.PI, { state: 'combat' }) as Enemy; // facing away
    s.setPlayer(0, 0, 15);
    s.step(30); // 0.5 s: at most 30° of turn
    expect(Math.abs(e.yaw)).toBeGreaterThan(Math.PI - Math.PI / 6 - 0.05);
    s.until(() => s.log.bolts.length >= 6, 8);
    const bolts = s.log.bolts.filter((b) => b.id === e.id);
    expect(bolts.length).toBe(6);
    expect(bolts[5].t - bolts[0].t).toBeCloseTo(0.5, 1);
    const tele = s.log.telegraphs.filter((t) => t.id === e.id && t.kind === 'laser' && t.t <= bolts[0].t);
    expect(bolts[0].t - tele[0].t).toBeCloseTo(0.6, 1);
  });

  it('is bolted down and dies to charged bolts', () => {
    const s = scenario();
    const e = s.spawn('turret', V(0, 0, 0), 0) as Enemy;
    s.step();
    s.sys.launch(e, V(0, 10, 0));
    s.sys.stagger(e, 2);
    expect(e.state).not.toBe('launched');
    expect(e.state).not.toBe('stagger');
    const t = s.sys.trapTargets().find((x) => x.key === e.key)!;
    expect(t.canFall).toBe(false);
    expect(t.steady).toBe(true);
    expect(s.sys.hit(e, { source: 'shove', amount: 0, charged: false, team: 'player', instigator: 'player' })).toBe('ignored');
    expect(s.sys.hit(e, charged(V(0, 1, 5)))).toBe('hurt');
    expect(s.sys.hit(e, charged(V(0, 1, 5)))).toBe('killed');
    expect(e.body).toBeNull();
    expect(s.physics.bodies.length).toBe(0);
  });
});

describe('jammer', () => {
  it('flees to keep 10+ m and projects a 7 m bubble', () => {
    const s = scenario();
    const e = s.spawn('jammer', V(0, 0, 0), 0, { state: 'combat' });
    s.setPlayer(0, 0, 4);
    s.step(60 * 5);
    expect(Math.hypot(e.pos.x - s.player.pos.x, e.pos.z - s.player.pos.z)).toBeGreaterThan(9.5);
    const b = s.sys.blockers();
    expect(b.length).toBe(1);
    expect(b[0].radius).toBe(7);
    expect(b[0].pos).toBe(e.pos);
    s.sys.kill(e, { source: 'blade', amount: 999, charged: false, team: 'player', instigator: 'player' });
    expect(s.sys.blockers().length).toBe(0);
  });
});
