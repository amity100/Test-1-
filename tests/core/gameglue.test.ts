import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { CharacterAPI, CharacterPose, DeathContext, EnemyView, KillEvent } from '../../src/core/contracts';
import { FEEL } from '../../src/config';
import { BLADE, HiddenBlade } from '../../src/game/blade';
import { Game } from '../../src/game/game';
import { Player } from '../../src/game/player';
import { TOWER } from '../../src/world/tower';
import { makePhysics, makeRifts, makeWorld, V } from './helpers';

/**
 * The game's glue, run on a bare Game (no renderer, no level): only the
 * fields a method reads are stubbed in. Class-field initialisers don't run.
 */
function bare(fields: Record<string, unknown>) {
  const g = Object.create(Game.prototype);
  Object.assign(g, fields);
  return g as any;
}

function stubChar(): CharacterAPI {
  return {
    root: new THREE.Group(),
    update() {},
    play() {},
    stop() {},
    setTumble() {},
    die() {},
    revive() {},
    getPose: () => ({}) as CharacterPose,
    setPose() {},
    setOpacity() {},
    dispose() {},
  };
}

describe('hints', () => {
  it('the rules card holds its full time before the door hint takes its place', () => {
    const shown: { key: string; t: number }[] = [];
    let t = 0;
    const g = bare({ hintQueue: [], hintHold: 0, hintsSeen: new Set(), hud: { hint: (key: string) => shown.push({ key, t }) } });
    g.hint('rules', 'rules', 9, true);
    g.hint('door', 'door', 9);
    g.hint('trapdoor', 'trapdoor', 9);
    for (; t < 20; t += 0.1) g.updateHints(0.1);
    expect(shown.map((s) => s.key)).toEqual(['rules', 'door', 'trapdoor']);
    expect(shown[1].t - shown[0].t).toBeGreaterThan(9 - 0.15);
    // (the others still take turns)
    expect(shown[2].t - shown[1].t).toBeLessThan(4.5 + 0.15);
  });
});

describe('the blade in the game loop', () => {
  it('dying mid-lunge stops it: no stab lands after death', () => {
    const world = makeWorld();
    const phys = makePhysics(world, makeRifts(world));
    const body = phys.createBody('player', { pos: V(0, 0, 0), radius: FEEL.playerRadius, height: FEEL.playerHeight });
    body.userData.manual = true;
    const player = new Player(stubChar(), body);
    const e = { alive: true, state: 'idle', pos: V(0, 0, 3.6), radius: 0.42, height: 1.8, def: { zone: 'pier' }, chest: (o = V(0, 0, 0)) => o.set(0, 1.3, 3.6) };
    const blade = new HiddenBlade({ world, enemies: [e as unknown as EnemyView], live: () => true });
    const hits: unknown[] = [];
    const g = bare({ player, blade, respawnT: -1, hero: { setBlade() {} }, bladeHit: (x: unknown) => hits.push(x) });
    expect(blade.start(e as unknown as EnemyView, body.pos)).toBe(false);
    player.lunge(V(0, 0, 1), BLADE.lungeSpeed, blade.lunging!.t);
    g.updateBlade(1 / 60);
    expect(player.lunging).toBe(true);
    // shot dead
    g.respawnT = 1.1;
    for (let i = 0; i < 40; i++) g.updateBlade(1 / 60);
    expect(blade.lunging).toBeNull();
    expect(player.lunging).toBe(false);
    expect(Math.hypot(body.vel.x, body.vel.z)).toBe(0);
    expect(hits.length).toBe(0);
  });
});

describe('what ends a lunge', () => {
  it('going through a rift, or firing a strike', () => {
    const cancelled: string[] = [];
    let ended = 0;
    const blade = { cancel: () => cancelled.push('blade') };
    const g = bare({
      blade,
      player: { endLunge: () => ended++, char: { play() {} } },
      rig: { rotateBy() {}, kick: 0, shake: 0 },
      renderer: { grade: { uniforms: { uFlash: { value: 0 } } } },
      strikeMarks: new Map(),
      riftMarked: new Map(),
      time: 0,
      slowT: 0,
      fx: { ring() {} },
      hint() {},
    });
    g.playerEvents().crossed({}, {}, 0, 10);
    expect(cancelled).toEqual(['blade']);
    expect(ended).toBe(0); // (the rift's momentum carries you on)
    g.onStrike({ ok: true, id: 'dash', target: null, name: 'dash' });
    expect(cancelled).toEqual(['blade', 'blade']);
    expect(ended).toBe(1);
  });
});

describe('gate arrivals', () => {
  it('one at a time, and only once nobody stands where he comes out', () => {
    const out = { position: V(10.93, 61.2, 41), normal: V(-1, 0, 0), height: 2.4 };
    const inEnd = { position: V(17.2, 61.2, 41), normal: V(1, 0, 0), height: 2.4, linked: out };
    const spawned: string[] = [];
    const blocker = { alive: true, pos: V(10.4, 60, 41) };
    const enc = { cleared: false, enemyIds: [] as number[], zone: 'lab' };
    const g = bare({
      level: { gates: [] },
      zones: { active: new Set() },
      rifts: { gateEnds: () => ({ in: inEnd, out }), isHijacked: () => false, hasExit: () => false },
      enemies: { list: [blocker], spawn: (d: { id: string }) => (spawned.push(d.id), { id: spawned.length }), launch() {} },
      gateQueue: [
        { gate: 'g', def: { id: 'a', pos: V(0, 0, 0) }, enc, t: 0, wait: 0 },
        { gate: 'g', def: { id: 'b', pos: V(0, 0, 0) }, enc, t: 0, wait: 0 },
      ],
    });
    for (let i = 0; i < 30; i++) g.updateGates(1 / 60);
    expect(spawned).toEqual([]);
    // he walks off: the next steps through, the one after keeps his distance
    blocker.pos.set(5, 60, 35);
    g.updateGates(1 / 60);
    expect(spawned.length).toBe(1);
    for (let i = 0; i < 20; i++) g.updateGates(1 / 60);
    expect(spawned.length).toBe(1);
    for (let i = 0; i < 20; i++) g.updateGates(1 / 60);
    expect(spawned.length).toBe(2);
    // (and a mouth that never clears holds the wave back a few seconds at most)
    blocker.pos.set(10.4, 60, 41);
    g.gateQueue.push({ gate: 'g', def: { id: 'c', pos: V(0, 0, 0) }, enc, t: 0, wait: 0 });
    for (let i = 0; i < 60 * 5; i++) g.updateGates(1 / 60);
    expect(spawned.length).toBe(3);
  });
});

describe('the void', () => {
  it("a man who falls below his own fight's floor is lost, inside the tower too; you and bodies keep the tower's floors", () => {
    const g = bare({
      level: { seaY: -1.2 },
      enemies: { enemyOfBody: (b: { kind: string }) => (b.kind === 'enemy' ? { def: { zone: 'lab' } } : null) },
      zones: { zone: () => ({ sea: false, killY: 50 }), zoneAt: () => null },
    });
    const inside = V((TOWER.x0 + TOWER.x1) / 2, 5.7, (TOWER.z0 + TOWER.z1) / 2);
    expect(g.killYAt(inside, { kind: 'enemy', peakY: 60 })).toBe(50);
    expect(g.killYAt(inside, { kind: 'player', peakY: 60 })).toBeCloseTo(-31.2, 6);
    expect(g.killYAt(inside, { kind: 'corpse', peakY: 60 })).toBeCloseTo(-31.2, 6);
    // (a sea zone's men: the sea takes them)
    g.zones.zone = () => ({ sea: true, killY: -1.2 });
    expect(g.killYAt(inside, { kind: 'enemy', peakY: 8 })).toBeCloseTo(-31.2, 6);
  });
});

describe('kill credit', () => {
  /** onEnemyDied on a bare game; returns the kill event, refunds and the player's hp after. */
  function died(o: { kc?: object; marks?: [number, string][]; cause?: string; viaTrapdoor?: boolean; hp?: number; respawnT?: number; reflected?: WeakSet<object> }) {
    const events: KillEvent[] = [];
    let refunds = 0;
    const marks = new Map<number, { name: string; until: number }>();
    for (const [id, name] of o.marks ?? []) marks.set(id, { name, until: 10 });
    const g = bare({
      killCtx: o.kc ?? null,
      enemies: { enemyOfBody: () => null, get: () => null },
      strikeMarks: marks,
      reflected: o.reflected ?? new WeakSet(),
      time: 1,
      player: { airborne: false },
      strikes: { refund: () => refunds++ },
      stats: { kills: 0 },
      push: (ev: KillEvent) => events.push(ev),
      hint() {},
      fx: { embers() {} },
      hp: o.hp ?? 50,
      respawnT: o.respawnT ?? -1,
      hitstop: 0,
      rig: { kick: 0 },
      zones: { checkClears: () => [] },
      impactorKey: () => null,
    });
    const e = { id: 5, kind: 'rifleman', body: null } as unknown as EnemyView;
    const ctx = { cause: o.cause ?? 'bolt', info: { charged: true }, unaware: false, witnessed: true, airborne: false, crossings: 0, loops: 0, fallHeight: 0, viaTrapdoor: !!o.viaTrapdoor, matador: false, at: V(0, 0, 0) } as unknown as DeathContext;
    g.onEnemyDied(e, ctx);
    return { ev: events[0], refunds, hp: g.hp };
  }

  it("a round a REFLECT sent through its pair is the strike's kill: it refunds nothing", () => {
    const shot = { kind: 'bolt', owner: 9, crossings: 1, loops: 0, firedAt: 0, vel: V(0, 0, 40), id: 3, team: 'kessler' };
    // the projectile hook tags what comes through the REFLECT pair
    const endA = { id: 1, owner: 'strike' }, endB = { id: 2, owner: 'strike' };
    const reflected = new WeakSet<object>();
    const g = bare({ strikes: { viaReflect: (x: unknown) => x === endA || x === endB }, reflected, steerReturned() {}, fx: { riftBurst() {} }, push() {}, time: 0, catchWindow: { t: -1, count: 0 } });
    g.projectileHooks().onCross(shot, endA, endB);
    expect(reflected.has(shot)).toBe(true);
    const r = died({ kc: { projectile: shot }, reflected });
    expect(r.ev.strike).toBe('reflect');
    expect(r.refunds).toBe(0);
    // an ordinary round (through your own door) refunds one
    const plain = died({ kc: { projectile: { ...shot } }, reflected });
    expect(plain.ev.strike).toBeNull();
    expect(plain.refunds).toBe(1);
    // a barrel a REFLECT's fire set off
    expect(died({ kc: { byBarrel: true, reflect: true } }).ev.strike).toBe('reflect');
  });

  it("a stab on a man a SWAP dropped is HIDDEN BLADE alone: not SWAP, not TRAPDOOR", () => {
    const r = died({ cause: 'blade', marks: [[5, 'swap']], viaTrapdoor: true });
    expect(r.ev.strike).toBeNull();
    expect(r.ev.viaTrapdoor).toBe(false);
    expect(r.refunds).toBe(1);
    // through your own trapdoor it is one
    expect(died({ cause: 'blade', viaTrapdoor: true }).ev.viaTrapdoor).toBe(true);
  });

  it('a kill landing after you died heals nothing', () => {
    expect(died({ hp: 0, respawnT: 0.8 }).hp).toBe(0);
    expect(died({ hp: 50 }).hp).toBeGreaterThan(50);
  });
});
