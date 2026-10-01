import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { CharacterAPI, CharacterPose } from '../../src/core/contracts';
import { FEEL } from '../../src/config';
import { Player, type PlayerEvents, type PlayerInput } from '../../src/game/player';
import { FLOW, FLOW_SPRINT, FLOW_WALK, flowOn, PowerMeter, PowerMoment } from '../../src/game/flow';
import { precisionOn } from '../../src/game/precision';
import { onslaughtOn, setLabActive, setVariant, variantForKey, VARIANTS, type CombatVariant } from '../../src/game/variant';
import { readSettings } from '../../src/game/settings';
import { Game } from '../../src/game/game';
import { strings } from '../../src/ui/i18n';
import { frame, makePhysics, makeRifts, makeWorld, recorder, V } from './helpers';

function stubChar(): CharacterAPI {
  return {
    root: new THREE.Group(),
    update() {},
    play() {},
    stop() {},
    setTumble() {},
    die() {},
    revive() {},
    getPose() {
      return {} as CharacterPose;
    },
    setPose() {},
    setOpacity() {},
    dispose() {},
  };
}

const idle = (): PlayerInput => ({ moveX: 0, moveY: 0, camYaw: 0, jump: false, sprint: false, crouch: false, shove: false });

function setup(variant: CombatVariant, world = makeWorld()) {
  setLabActive(true);
  setVariant(variant);
  const rifts = makeRifts(world);
  const phys = makePhysics(world, rifts);
  const body = phys.createBody('player', { pos: V(0, 0, 0), radius: FEEL.playerRadius, height: FEEL.playerHeight });
  body.userData.manual = true;
  const player = new Player(stubChar(), body);
  const pev = recorder();
  const log = { airJumps: [] as boolean[], slides: 0, crossed: 0 };
  const ev: PlayerEvents = {
    footstep() {},
    jumped() {},
    landed() {},
    fallDamage() {},
    shoved() {},
    crossed: () => log.crossed++,
    airJump: (_p, wall) => log.airJumps.push(wall),
    slid: () => log.slides++,
  };
  let t = 0;
  const run = (seconds: number, input: (i: number) => PlayerInput = idle, dt = 1 / 60, each?: () => void) => {
    const n = Math.round(seconds / dt);
    for (let i = 0; i < n; i++) {
      t += dt;
      player.update(dt, input(i), world, phys, pev, ev, t);
      phys.step(dt, pev, t);
      each?.();
    }
  };
  return { world, rifts, phys, player, body, log, run };
}

const hspeed = (b: { vel: THREE.Vector3 }) => Math.hypot(b.vel.x, b.vel.z);
const sprint = (): PlayerInput => ({ ...idle(), moveY: 1, sprint: true });
const walk = (): PlayerInput => ({ ...idle(), moveY: 1 });

afterEach(() => {
  setVariant('current');
  setLabActive(false);
});

describe('FLOW: the gate', () => {
  it('is FLOW only, and only in the lab; FLOW plays PRECISION and fights ONSLAUGHT', () => {
    expect(VARIANTS).toEqual(['current', 'precision', 'onslaught', 'flow']);
    expect(variantForKey('F4')).toBe('flow');
    for (const v of ['current', 'precision', 'onslaught'] as const) expect(flowOn(v), v).toBe(false);
    expect(flowOn('flow')).toBe(true);
    expect(precisionOn('flow')).toBe(true);
    expect(onslaughtOn('flow')).toBe(true);
    expect(onslaughtOn('precision')).toBe(false);
    setVariant('flow');
    expect(flowOn()).toBe(false); // outside the lab: CURRENT
    setLabActive(true);
    expect(flowOn()).toBe(true);
    expect(readSettings(JSON.stringify({ combatVariant: 'flow' })).combatVariant).toBe('flow');
  });

  it('the other variants run and sprint exactly as before; FLOW 1.5x', () => {
    for (const v of ['current', 'precision', 'onslaught'] as const) {
      const a = setup(v);
      a.run(1.5, walk);
      expect(hspeed(a.body), v).toBeCloseTo(FEEL.walkSpeed, 2);
      a.run(1.5, sprint);
      expect(hspeed(a.body), v).toBeCloseTo(FEEL.sprintSpeed, 2);
    }
    const f = setup('flow');
    f.run(1, walk);
    expect(hspeed(f.body)).toBeCloseTo(FLOW_WALK, 2);
    f.run(1, sprint);
    expect(hspeed(f.body)).toBeCloseTo(FLOW_SPRINT, 2);
    expect(FLOW_SPRINT).toBeCloseTo(9, 5);
  });
});

describe('FLOW: the body', () => {
  it('one double jump in the air (none outside FLOW), back on landing', () => {
    const f = setup('flow');
    f.run(0.2);
    f.run(1 / 60, () => ({ ...idle(), jump: true }));
    f.run(0.25);
    expect(f.player.airborne).toBe(true);
    const vy = f.body.vel.y;
    f.run(1 / 60, () => ({ ...idle(), jump: true }));
    expect(f.log.airJumps).toEqual([false]);
    expect(f.body.vel.y).toBeGreaterThan(vy + 2);
    expect(f.body.vel.y).toBeCloseTo(FLOW.jump.doubleJumpSpeed, 0);
    // no third
    f.run(0.15);
    f.run(1 / 60, () => ({ ...idle(), jump: true }));
    f.run(0.12);
    expect(f.log.airJumps).toEqual([false]);
    f.run(1.5);
    expect(f.player.airborne).toBe(false);
    expect(f.player.airJumps).toBe(FLOW.jump.airJumps);

    const c = setup('precision');
    c.run(0.2);
    c.run(1 / 60, () => ({ ...idle(), jump: true }));
    c.run(0.25);
    const cy = c.body.vel.y;
    c.run(1 / 60, () => ({ ...idle(), jump: true }));
    expect(c.log.airJumps).toEqual([]);
    expect(c.body.vel.y).toBeLessThan(cy);
  });

  it('a wall beside you is kicked off: out of it and up, and the double jump comes back', () => {
    const world = makeWorld();
    world.add(V(0.6, 0, -5), V(1.6, 8, 5)); // a tall wall at x 0.6..1.6
    const f = setup('flow', world);
    f.run(0.2);
    f.run(1 / 60, () => ({ ...idle(), jump: true }));
    f.run(0.2);
    f.run(1 / 60, () => ({ ...idle(), jump: true }));
    expect(f.log.airJumps).toEqual([true]);
    expect(f.body.vel.x).toBeLessThan(-FLOW.wall.out * 0.8);
    expect(f.body.vel.y).toBeGreaterThan(FLOW.wall.up * 0.8);
    expect(f.player.airJumps).toBe(FLOW.jump.airJumps);
  });

  it('a slide: crouch at a sprint, a burst, low, it bleeds and ends (ignored outside FLOW)', () => {
    const f = setup('flow');
    f.run(1, sprint);
    const before = hspeed(f.body);
    f.run(1 / 60, () => ({ ...sprint(), slide: true }));
    expect(f.log.slides).toBe(1);
    expect(f.player.slideT).toBeGreaterThan(0);
    expect(hspeed(f.body)).toBeGreaterThan(before + FLOW.slide.boost * 0.8);
    f.run(0.2, walk);
    expect(f.player.crouched).toBe(true);
    expect(hspeed(f.body)).toBeGreaterThan(FLOW_SPRINT);
    f.run(2, walk);
    expect(f.player.slideT).toBeLessThanOrEqual(0);
    expect(f.player.crouched).toBe(false);

    const c = setup('onslaught');
    c.run(1, sprint);
    c.run(1 / 60, () => ({ ...sprint(), slide: true }));
    expect(c.log.slides).toBe(0);
    expect(hspeed(c.body)).toBeCloseTo(FEEL.sprintSpeed, 1);
  });

  it('through a door the speed is kept (re-aimed out of the exit), a little more under FLOW', () => {
    const ratio = (v: CombatVariant) => {
      const a = setup(v);
      a.rifts.addGate('d', frame(V(0, 1.145, 8), V(0, 0, -1), 'stand'), frame(V(20, 1.145, 0), V(1, 0, 0), 'stand'));
      let pre = 0, post = 0;
      a.run(3, sprint, 1 / 60, () => {
        if (a.log.crossed === 0) pre = hspeed(a.body);
        else if (!post) post = Math.abs(a.body.vel.x);
      });
      expect(a.log.crossed, v).toBe(1);
      expect(a.body.vel.x, v).toBeGreaterThan(0);
      return post / pre;
    };
    expect(ratio('current')).toBeCloseTo(1, 1);
    expect(ratio('flow')).toBeCloseTo(FLOW.portal.exitBoost, 1);
  });

  it('over the cap and still pushing: the speed bleeds instead of stopping (FLOW)', () => {
    const f = setup('flow');
    f.run(0.2);
    f.body.vel.set(0, 0, 14);
    f.run(0.5, walk);
    expect(hspeed(f.body)).toBeGreaterThan(14 - FLOW.move.overspeedDecel * 0.5 - 0.3);
    const c = setup('current');
    c.run(0.2);
    c.body.vel.set(0, 0, 14);
    c.run(0.5, walk);
    expect(hspeed(c.body)).toBeLessThan(FEEL.walkSpeed + 0.1);
  });
});

describe('FLOW: POWER', () => {
  it('the meter fills moving fast and in the air, drains at rest, clamps, spends', () => {
    const m = new PowerMeter();
    expect(m.value).toBe(FLOW.meter.start);
    m.update(1, { speed: FLOW_SPRINT, grounded: true, sliding: false });
    const run = m.value - FLOW.meter.start;
    expect(run).toBeGreaterThan(0.03);
    const m2 = new PowerMeter();
    m2.update(1, { speed: FLOW_SPRINT, grounded: false, sliding: true });
    expect(m2.value - FLOW.meter.start).toBeGreaterThan(run + FLOW.meter.slide + FLOW.meter.air - 1e-9);
    const m3 = new PowerMeter();
    m3.update(2, { speed: 0, grounded: true, sliding: false });
    expect(m3.value).toBeCloseTo(FLOW.meter.start - FLOW.meter.drain * 2, 6);
    m3.add(5);
    expect(m3.value).toBe(1);
    expect(m3.ready).toBe(true);
    m3.spend();
    expect(m3.value).toBe(0);
    m3.add(-1);
    expect(m3.value).toBe(0);
  });

  it('held: time near-stops, up to three marks; let go: one strike per mark, a beat apart; then time runs', () => {
    const P = new PowerMoment();
    expect(P.canBegin(false)).toBe(false);
    expect(P.canBegin(true)).toBe(true);
    P.begin();
    expect(P.timeScale()).toBe(FLOW.power.timeScale);
    expect(P.timeScale()).toBeLessThanOrEqual(0.05);
    expect(P.mark(4)).toBe(true);
    expect(P.mark(4)).toBe(false);
    expect(P.mark(7)).toBe(true);
    expect(P.mark(9)).toBe(true);
    expect(P.mark(11)).toBe(false);
    expect(P.release()).toBe(true);
    expect(P.phase).toBe('chain');
    expect(P.timeScale()).toBe(FLOW.power.chainScale);
    const hits: { id: number; t: number }[] = [];
    let t = 0, done = false;
    for (let i = 0; i < 200 && !done; i++) {
      t += 1 / 60;
      const r = P.update(1 / 60);
      if (r.strike !== null) hits.push({ id: r.strike, t });
      done = r.done;
    }
    expect(hits.map((h) => h.id)).toEqual([4, 7, 9]);
    expect(hits[0].t).toBeCloseTo(FLOW.power.firstDelay, 1);
    expect(hits[1].t - hits[0].t).toBeCloseTo(FLOW.power.stepTime, 1);
    expect(done).toBe(true);
    expect(P.phase).toBe('idle');
    expect(P.timeScale()).toBe(1);
  });

  it('let go with nothing marked: time just runs again; held too long: it lets go itself', () => {
    const P = new PowerMoment();
    P.begin();
    expect(P.release()).toBe(false);
    expect(P.phase).toBe('idle');
    expect(P.canBegin(true)).toBe(false); // a moment's lockout
    P.update(FLOW.power.cooldown + 0.01);
    expect(P.canBegin(true)).toBe(true);
    P.begin();
    let expired = false;
    for (let i = 0; i < 400 && !expired; i++) expired = P.update(1 / 60).expired;
    expect(expired).toBe(true);
    expect(P.heldT).toBeGreaterThanOrEqual(FLOW.power.maxHold - 1e-6);
  });

  it('the chain on the Game: each link takes you through to just past him and kills him, hard', () => {
    setLabActive(true);
    setVariant('flow');
    const noop = () => {};
    const sink = new Proxy({}, { get: () => noop });
    const men = [V(6, 0, 0), V(6, 0, 8), V(-4, 0, 8)].map((p, i) => ({ id: i + 1, kind: 'rifleman', alive: true, radius: 0.4, height: 1.8, pos: p, chest: (o = new THREE.Vector3()) => o.copy(p).setY(1.3) }));
    const hits: number[] = [];
    const body = { pos: V(0, 0, 0), vel: V(0, 0, 0) };
    const g = Object.create(Game.prototype) as any;
    Object.assign(g, {
      time: 5,
      hitstop: 0,
      killCtx: null,
      playerFling: true,
      rig: { shake: 0, kick: 0, yaw: 0 },
      renderer: { grade: { uniforms: { uFlash: { value: 0 } } } },
      fx: sink,
      audio: sink,
      hud: sink,
      level: { world: { overlapsCylinder: () => false } },
      enemies: {
        get: (id: number) => men.find((m) => m.id === id) ?? null,
        hit: (e: (typeof men)[number], info: { source: string; amount: number }) => {
          expect(info.source).toBe('blade');
          expect(info.amount).toBeGreaterThan(1000);
          hits.push(e.id);
          e.alive = false;
          return 'killed';
        },
      },
      player: { body, endLunge: noop, teleport: (p: THREE.Vector3) => body.pos.copy(p), chest: (o: THREE.Vector3) => o.copy(body.pos) },
    });
    for (const m of men) {
      const from = body.pos.clone();
      g.powerStrike(m.id, m.id);
      // past him, along the line you came in on
      const d = m.pos.clone().sub(from).setY(0).normalize();
      expect(body.pos.distanceTo(m.pos.clone().addScaledVector(d, m.radius + FLOW.power.past))).toBeLessThan(1e-6);
      expect(body.vel.x * d.x + body.vel.z * d.z).toBeCloseTo(FLOW.power.exitSpeed, 5);
      expect(g.hitstop).toBeGreaterThanOrEqual(FLOW.power.hitstop);
      expect(g.rig.shake).toBeGreaterThanOrEqual(FLOW.power.shake);
    }
    expect(hits).toEqual([1, 2, 3]);
    // a man already down is skipped
    g.powerStrike(1, 4);
    expect(hits).toEqual([1, 2, 3]);
  });

  it('every FLOW string is in EN and HE', () => {
    const en = strings('en'), he = strings('he');
    const keys = Object.keys(en).filter((k) => k.startsWith('flow.') || k === 'lab.v.flow' || k === 'lab.vd.flow' || k === 'touch.power');
    expect(keys.length).toBeGreaterThanOrEqual(14);
    for (const k of keys) expect(he[k], k).toBeTruthy();
    for (const k of ['flow.ready', 'flow.held', 'flow.call.mark']) {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(vars(he[k]), k).toBe(vars(en[k]));
    }
  });
});
