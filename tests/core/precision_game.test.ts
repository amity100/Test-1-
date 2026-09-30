import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ActorHit, EnemyView, Projectile } from '../../src/core/contracts';
import { LAW } from '../../src/core/contracts';
import { Game } from '../../src/game/game';
import { Parry, PRECISION } from '../../src/game/precision';
import { setLabActive, setVariant } from '../../src/game/variant';
import { V } from './helpers';

/**
 * PRECISION's glue in the Game (parry catches, the dodge's moment untouchable,
 * the blade's finisher), run on a bare Game: only the fields a method reads
 * are stubbed in. Class-field initialisers don't run.
 */
function bare(fields: Record<string, unknown>) {
  const g = Object.create(Game.prototype);
  Object.assign(g, fields);
  return g as any;
}

const noop = () => {};
const sink = new Proxy({}, { get: () => noop });

function shooter(id: number, pos: THREE.Vector3, o: Partial<{ state: EnemyView['state']; yaw: number }> = {}) {
  return {
    id,
    kind: 'rifleman',
    alive: true,
    armored: false,
    state: o.state ?? 'combat',
    pos: pos.clone(),
    height: 1.8,
    radius: 0.42,
    yaw: o.yaw ?? Math.PI,
    def: { zone: 'pier' },
    chest(out = new THREE.Vector3()) {
      return out.set(this.pos.x, this.pos.y + 1.3, this.pos.z);
    },
    forward(out = new THREE.Vector3()) {
      return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    },
  };
}

function rig(o: { time?: number } = {}) {
  const e = shooter(7, V(0, 0, 12)); // in front of you, facing you
  const fired: { from: THREE.Vector3; dir: THREE.Vector3; opts: any; p: any }[] = [];
  const staggered: [number, number][] = [];
  const hurt: number[] = [];
  const hits: any[] = [];
  const callouts: string[] = [];
  const g = bare({
    time: o.time ?? 10,
    hp: 100,
    respawnT: -1,
    guardUntil: -1,
    dodgeSafeUntil: -1,
    lastHurtT: -99,
    hitstop: 0,
    slowT: 0,
    slowScale: 1,
    lab: null,
    parry: new Parry(),
    parried: new WeakSet(),
    reflected: new WeakSet(),
    exposedUntil: new Map(),
    rig: { yaw: 0, kick: 0, shake: 0 },
    player: { body: { pos: V(0, 0, 0), vel: V(0, 0, 0) }, height: 1.8, yaw: 0, char: { die: noop, play: noop } },
    enemies: {
      get: (id: number) => (id === e.id ? e : null),
      stagger: (v: any, s: number) => staggered.push([v.id, s]),
      isHeld: () => false,
      hit: (v: any, info: any) => (hits.push({ id: v.id, info }), 'killed'),
    },
    projectiles: {
      fireBolt: (from: THREE.Vector3, dir: THREE.Vector3, _team: string, _owner: unknown, opts: any) => {
        const p = { kind: 'bolt', charged: false, crossings: 0, pos: from.clone(), vel: dir.clone() };
        fired.push({ from: from.clone(), dir: dir.clone(), opts, p });
        return p;
      },
    },
    parryView: { flare: noop },
    fx: sink,
    audio: sink,
    hud: { callout: (s: string) => callouts.push(s), damageFlash: noop },
    renderer: { grade: { uniforms: { uFlash: { value: 0 } } } },
    push: (ev: any) => ev.type === 'hurt' && hurt.push(ev.amount),
    withKill: (_c: unknown, f: () => unknown) => f(),
  });
  return { g, e, fired, staggered, hurt, hits, callouts };
}

/** A Kessler round from him, hitting you. */
function bolt(from: number | null = 7): Projectile {
  return { id: 1, kind: 'bolt', team: 'kessler', charged: false, pos: V(0, 1.2, 0.4), vel: V(0, 0, -26), owner: from, damage: LAW.bolt.damageToPlayer, age: 0.4, life: 3, crossings: 0, loops: 0, alive: true, body: null, segments: [], lastEndId: null, firedAt: 0 } as Projectile;
}
const hitYou: ActorHit = { key: 'player', point: V(0, 1.2, 0.35), normal: V(0, 0, 1) };

afterEach(() => {
  setVariant('current');
  setLabActive(false);
});
const precision = () => {
  setLabActive(true);
  setVariant('precision');
};

describe('PRECISION in the game: PARRY', () => {
  it('in the window, a round that hits you goes back at its shooter, charged, for 60', () => {
    precision();
    const { g, e, fired, staggered, hurt, callouts } = rig();
    g.parry.press();
    g.parry.update(0.05, 0.05); // (PERFECT)
    expect(g.projectileHitActor(bolt(), hitYou)).toBe('stop');
    expect(hurt).toEqual([]);
    expect(fired.length).toBe(1);
    const back = fired[0];
    expect(back.p.charged).toBe(true);
    expect(back.opts.damage).toBe(PRECISION.parry.damage);
    expect(back.opts.speed).toBe(PRECISION.parry.speed);
    // straight at his chest
    const want = e.chest().sub(back.from).normalize();
    expect(back.dir.dot(want)).toBeGreaterThan(0.999);
    expect(g.parried.has(back.p)).toBe(true);
    expect(g.reflected.has(back.p)).toBe(true); // (a kill with it is REFLECT's)
    // PERFECT: he reels, and the blade will finish him while he does
    expect(staggered).toEqual([[7, PRECISION.parry.stagger]]);
    expect(g.exposedUntil.get(7)).toBeGreaterThan(g.time);
    expect(g.hitstop).toBeCloseTo(PRECISION.parry.hitstop);
    expect(callouts[0]).toBe('PERFECT PARRY');
  });

  it('late in the window: caught, but no stagger', () => {
    precision();
    const { g, fired, staggered, callouts } = rig();
    g.parry.press();
    g.parry.update(0.2, 0.2);
    g.projectileHitActor(bolt(), hitYou);
    expect(fired.length).toBe(1);
    expect(staggered).toEqual([]);
    expect(callouts[0]).toBe('PARRY');
  });

  it('early or late (no window), from behind, or in CURRENT: it hurts', () => {
    // no window
    precision();
    let r = rig();
    expect(r.g.projectileHitActor(bolt(), hitYou)).toBe('stop');
    expect(r.hurt).toEqual([LAW.bolt.damageToPlayer]);
    // the window closed before it arrived
    r = rig();
    r.g.parry.press();
    r.g.parry.update(0.3, 0.3);
    r.g.projectileHitActor(bolt(), hitYou);
    expect(r.fired.length).toBe(0);
    expect(r.hurt.length).toBe(1);
    // from behind you
    r = rig();
    r.g.parry.press();
    const b = bolt();
    b.vel.set(0, 0, 26);
    r.g.projectileHitActor(b, hitYou);
    expect(r.fired.length).toBe(0);
    expect(r.hurt.length).toBe(1);
    // CURRENT: there is no parry
    setVariant('current');
    r = rig();
    r.g.parry.press();
    r.g.projectileHitActor(bolt(), hitYou);
    expect(r.fired.length).toBe(0);
    expect(r.hurt.length).toBe(1);
  });

  it('a parried round hits a man for PRECISION.parry.damage', () => {
    precision();
    const { g, e, fired } = rig();
    g.parry.press();
    g.projectileHitActor(bolt(), hitYou);
    const back = fired[0].p;
    const hits: any[] = [];
    g.enemies.byKey = () => e;
    g.enemies.hit = (_v: unknown, info: any) => (hits.push(info), 'killed');
    back.vel = V(0, 0, 44);
    back.lastEndId = null;
    g.projectileHitActor(back, { key: 'enemy:7', point: V(0, 1.3, 12), normal: V(0, 0, -1) });
    expect(hits[0].amount).toBe(PRECISION.parry.damage);
    expect(hits[0].charged).toBe(true);
  });
});

describe('PRECISION in the game: DODGE and BLADE', () => {
  it('nothing hurts you while the dodge is under way', () => {
    precision();
    const { g, hurt } = rig();
    g.dodgeSafeUntil = g.time + PRECISION.dodge.invuln;
    g.hurtPlayer(30, V(0, 0, 5));
    expect(hurt).toEqual([]);
    expect(g.hp).toBe(100);
    g.time += PRECISION.dodge.invuln + 0.01;
    g.hurtPlayer(30, V(0, 0, 5));
    expect(g.hp).toBe(70);
  });

  it('a blade at a man on his guard, facing you, is turned aside; behind him it is a FINISHER', () => {
    precision();
    const { g, e, hits, staggered, callouts } = rig();
    e.pos.set(0, 0, 1.5); // facing you (yaw PI)
    g.bladeHit(e);
    expect(hits).toEqual([]);
    expect(staggered).toEqual([[7, PRECISION.blade.guardStagger]]);
    expect(callouts).toEqual(['GUARDED']);
    // come up behind him (a dodge marked him): the blade finishes him
    g.exposedUntil.set(7, g.time + 1);
    g.bladeHit(e);
    expect(hits.length).toBe(1);
    expect(hits[0].info.source).toBe('blade');
    expect(callouts[1]).toBe('FINISHER');
    expect(g.slowT).toBeGreaterThanOrEqual(PRECISION.blade.slowT);
    // reeling: exposed without any mark
    const r2 = rig();
    r2.e.state = 'stagger';
    r2.e.pos.set(0, 0, 1.5);
    r2.g.bladeHit(r2.e);
    expect(r2.hits.length).toBe(1);
  });

  it('CURRENT: the blade takes him from the front as always', () => {
    const { g, e, hits, callouts } = rig();
    e.pos.set(0, 0, 1.5);
    g.bladeHit(e);
    expect(hits.length).toBe(1);
    expect(callouts).toEqual([]);
  });
});
