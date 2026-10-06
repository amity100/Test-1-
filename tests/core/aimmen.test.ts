import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AimAI, type AimAIHost } from '../../src/actors/aimai';
import { RedPortals } from '../../src/actors/reachai';
import { AIMP } from '../../src/game/aimportal';
import { scenario, V } from '../enemies/fakes';
import type { Enemy } from '../../src/actors/enemy';
import { setLabActive, setVariant } from '../../src/game/variant';

afterEach(() => {
  setVariant('current');
  setLabActive(false);
});

/**
 * AIM PORTAL's men in a set piece: the real enemy system and AimAI, a stand-in hero, a long tall wall at z = 0 between
 * them. Nothing here is the compound: it is what the men KNOW (a post, a hunch, a search, a portal behind you).
 */
function menRig(o: { wallH?: number } = {}) {
  setLabActive(true);
  setVariant('aimportal');
  const sc = scenario();
  const wallH = o.wallH ?? 5;
  sc.world.add(V(-30, 0, -0.25), V(30, wallH, 0.25));
  const portals = new RedPortals();
  const state = { go: true, yaw: 0, alive: true, safe: false };
  const eye = V(0, 1.6, 0);
  const lasers: number[] = [];
  const bolts: number[] = [];
  const host: AimAIHost = {
    world: sc.world,
    portals,
    go: () => state.go,
    player: () => ({ pos: sc.player.pos, chest: sc.player.chest, eye: eye.set(sc.player.pos.x, sc.player.pos.y + 1.6, sc.player.pos.z), alive: state.alive, safe: state.safe, yaw: state.yaw }),
    pair: () => null,
    standAt: (x, z, y) => {
      const g = sc.world.groundAt(x, z, 0.3, y + 1.2);
      return g === -Infinity || Math.abs(g - y) > 1.3 ? null : g;
    },
    laser: () => lasers.push(sc.clock.t),
    fireBolt: () => bolts.push(sc.clock.t),
    windup: () => {},
    melee: () => {},
    opened: () => {},
  };
  const ai = new AimAI(host);
  sc.sys.aimBrain = ai;
  const step = (n: number) => {
    for (let i = 0; i < n; i++) {
      sc.step(1);
      portals.update(1 / 60, (id) => !!sc.sys.get(id)?.alive);
    }
  };
  const man = (at: THREE.Vector3, aim: 'gunner' | 'mirror' | 'rusher' = 'gunner') => {
    const e = sc.spawn('rifleman', at, Math.PI, { aim, state: 'combat' }) as Enemy;
    const m = ai.mind(e, Math.random);
    m.react = 0;
    return { e, m };
  };
  return { sc, ai, host, portals, state, step, man, lasers, bolts };
}

describe('AIM PORTAL: what the men know', () => {
  it('a gunner starts on his post (HOLD) for 4 to 9 s, then goes where he last had you', () => {
    const { sc, step, man } = menRig();
    sc.setPlayer(0, 0, -20);
    const { e, m } = man(V(0, 0, 12));
    step(5);
    expect(m.mode).toBe('hold');
    const [lo, hi] = AIMP.intel.hold;
    step(Math.round((lo - 0.5) * 60) - 5);
    expect(e.pos.distanceTo(V(0, 0, 12))).toBeLessThan(0.2);
    expect(m.holdT).toBeGreaterThan(-1);
    step(Math.round((hi + 2) * 60));
    expect(m.mode).not.toBe('hold');
    expect(e.pos.distanceTo(V(0, 0, 12))).toBeGreaterThan(1);
  });

  it('nobody is told where you are: 12 s without news and he gets a hunch (your place, give or take 5 m); before that he still has the old place', () => {
    const { sc, ai, step, man } = menRig();
    sc.setPlayer(0, 0, -20);
    const { m } = man(V(0, 0, 12));
    step(30);
    // you move on, out of his sight and out of earshot
    sc.setPlayer(-20, 0, -25);
    step(Math.round((AIMP.intel.hunch - 3) * 60));
    expect(m.known.distanceTo(V(0, 0, -20))).toBeLessThan(1);
    expect(ai.stats.hunch).toBe(0);
    step(Math.round(6 * 60));
    expect(ai.stats.hunch).toBeGreaterThan(0);
    expect(Math.hypot(m.known.x + 20, m.known.z + 25)).toBeLessThanOrEqual(AIMP.intel.spread + 0.01);
    expect(Math.hypot(m.known.x + 20, m.known.z + 25)).toBeLessThan(Math.hypot(0 + 20, 0 - 20 + 25) + 0.01 + 8);
    // (and it is a place he could stand)
    expect(m.known.y).toBeCloseTo(0, 1);
  });

  it('a footstep through a wall: within 6.5 m he hears you (his place for you is yours)', () => {
    const { sc, step, man } = menRig();
    sc.setPlayer(0, 0, -20);
    const { m } = man(V(0, 0, 3));
    step(10);
    expect(m.known.distanceTo(V(0, 0, -20))).toBeLessThan(1);
    sc.setPlayer(2, 0, -2);
    step(10);
    expect(m.known.distanceTo(V(2, 0, -2))).toBeLessThan(0.2);
    // (past it he does not)
    sc.setPlayer(2, 0, -9);
    step(10);
    expect(m.known.distanceTo(V(2, 0, -9))).toBeGreaterThan(3);
  });

  it('at the place he thought you were, with nothing there: he SEARCHES a few spots round it, a look at each, then goes on', () => {
    const { sc, ai, step, man } = menRig();
    sc.setPlayer(0, 0, -20);
    const { e, m } = man(V(0, 0, 8));
    m.known.set(0, 0, 8.5);
    m.mode = 'advance';
    m.hasKnown = true;
    m.seenT = m.newsT = sc.clock.t;
    const seen = new Set<string>();
    let searching = false;
    for (let n = 0; n < 12 * 60; n++) {
      step(1);
      if ((m.mode as string) === 'search') searching = true;
      if (searching && m.pts.length) seen.add(`${Math.round(m.ptI)}:${m.pts.length}`);
    }
    expect(ai.stats.search).toBeGreaterThanOrEqual(1);
    expect(searching).toBe(true);
    expect(m.pts.length).toBeGreaterThanOrEqual(1);
    // (spread out: no two of his spots on top of each other)
    for (let i = 0; i < m.pts.length; i++) for (let j = i + 1; j < m.pts.length; j++) expect(m.pts[i].distanceTo(m.pts[j])).toBeGreaterThan(3);
    expect(e.pos.distanceTo(V(0, 0, 8))).toBeGreaterThan(0.5);
  });

  it('a gunner who has lost you for 7 s may come round the wall by a red portal: its exit BEHIND you, a clear line to you, 5.5 m back; he turns to you before his laser', () => {
    const { sc, ai, portals, state, step, man, lasers } = menRig();
    state.yaw = 0;
    sc.setPlayer(0, 0, -12);
    const { e, m } = man(V(0, 0, 14));
    m.mode = 'advance';
    m.everSeen = true;
    m.hasKnown = true;
    m.seenT = sc.clock.t - AIMP.intel.ambush.after - 2;
    m.newsT = sc.clock.t - 3;
    m.known.set(0, 0, -12);
    let open: { b: THREE.Vector3; t: number } | null = null;
    let arrived = -1;
    for (let n = 0; n < 40 * 60 && arrived < 0; n++) {
      m.portalCd = Math.min(m.portalCd, n < 90 ? 0 : m.portalCd);
      step(1);
      const p = portals.list[0];
      if (p && !open) open = { b: p.b.clone(), t: sc.clock.t };
      if (p && p.crossedT >= 0) arrived = sc.clock.t;
    }
    expect(open).not.toBeNull();
    expect(ai.stats.ambush).toBeGreaterThanOrEqual(1);
    // behind: the hero looks +z; the exit is on his -z side, 4-7 m off, in sight
    const hero = sc.player.pos;
    expect(open!.b.z - hero.z).toBeLessThan(-2);
    expect(Math.hypot(open!.b.x - hero.x, open!.b.z - hero.z)).toBeGreaterThan(3.5);
    expect(Math.hypot(open!.b.x - hero.x, open!.b.z - hero.z)).toBeLessThan(7.5);
    expect(sc.world.lineOfSight(V(open!.b.x, 1.5, open!.b.z), sc.player.chest)).toBe(true);
    // out of it he turns first: no laser for AIMP.intel.ambush.turn s after he steps out
    expect(arrived).toBeGreaterThan(0);
    expect(e.pos.distanceTo(open!.b)).toBeLessThan(1.5);
    step(Math.round((AIMP.intel.ambush.turn - 0.15) * 60));
    expect(lasers.filter((t) => t > arrived).length).toBe(0);
    step(Math.round(1.2 * 60));
    expect(lasers.filter((t) => t > arrived).length).toBeGreaterThan(0);
  });

  it('one that has never had you in sight waits much longer (28 s into the wave) before any ambush: a wave start is not a portal behind you', () => {
    const { sc, ai, step, man } = menRig();
    sc.setPlayer(0, 0, -12);
    const { m } = man(V(0, 0, 14));
    m.mode = 'advance';
    for (let n = 0; n < 20 * 60; n++) {
      m.portalCd = 0;
      step(1);
    }
    expect(ai.stats.ambush).toBe(0);
    expect(AIMP.intel.ambush.first).toBeGreaterThan(AIMP.intel.ambush.after);
  });

  it('a man on a perch with no line to you for 4.5 s steps down by a red portal of his own (exit on the deck, 4-8 m off), not a jump into the parapet', () => {
    const { sc, ai, portals, step, man } = menRig({ wallH: 9 });
    sc.world.add(V(-3, 0, 8), V(3, 3.2, 13));
    sc.setPlayer(0, 0, -12);
    const { e, m } = man(V(0, 3.2, 10.5));
    m.mode = 'advance';
    m.hasKnown = true;
    m.known.set(0, 0, -12);
    m.seenT = m.newsT = sc.clock.t;
    let exit: THREE.Vector3 | null = null;
    for (let n = 0; n < 12 * 60 && !exit; n++) {
      step(1);
      if (portals.list[0]) exit = portals.list[0].b.clone();
    }
    expect(exit).not.toBeNull();
    expect(ai.stats.perch).toBe(1);
    expect(Math.abs(exit!.y)).toBeLessThan(0.4);
    expect(exit!.distanceTo(e.pos)).toBeGreaterThan(3.5);
    step(3 * 60);
    expect(e.pos.y).toBeLessThan(0.5);
  });

  it('one red portal at a time, 5 s apart: a second man waits his turn', () => {
    const { sc, ai, portals, step, man } = menRig();
    sc.setPlayer(0, 0, -12);
    const a = man(V(-6, 0, 14)), b = man(V(6, 0, 14));
    for (const x of [a, b]) {
      x.m.mode = 'advance';
      x.m.everSeen = true;
      x.m.hasKnown = true;
      x.m.seenT = sc.clock.t - 12;
      x.m.newsT = sc.clock.t - 3;
      x.m.known.set(0, 0, -12);
    }
    let most = 0;
    for (let n = 0; n < 10 * 60; n++) {
      a.m.portalCd = 0;
      b.m.portalCd = 0;
      step(1);
      most = Math.max(most, portals.list.length);
    }
    expect(most).toBe(1);
    expect(ai.stats.ambush).toBeLessThanOrEqual(2);
  });
});
