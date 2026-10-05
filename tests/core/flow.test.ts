import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { CharacterAPI, CharacterPose } from '../../src/core/contracts';
import { FEEL } from '../../src/config';
import { Player, type PlayerEvents, type PlayerInput } from '../../src/game/player';
import { FLOW, FLOW_SPRINT, FLOW_WALK, flowOn, pickMark, PowerMeter, PowerMoment } from '../../src/game/flow';
import touchSrc from '../../src/engine/touch.ts?raw';
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

const noopFn = () => {};
const hspeed = (b: { vel: THREE.Vector3 }) => Math.hypot(b.vel.x, b.vel.z);
const sprint = (): PlayerInput => ({ ...idle(), moveY: 1, sprint: true });
const walk = (): PlayerInput => ({ ...idle(), moveY: 1 });

afterEach(() => {
  setVariant('current');
  setLabActive(false);
});

describe('FLOW: the gate', () => {
  it('is FLOW only, and only in the lab; FLOW plays PRECISION and fights ONSLAUGHT', () => {
    expect(VARIANTS).toEqual(['current', 'precision', 'onslaught', 'flow', 'reach', 'aimportal']);
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
    // (the lab offers REACH only now: an old FLOW pick comes back as REACH)
    expect(readSettings(JSON.stringify({ combatVariant: 'flow' })).combatVariant).toBe('reach');
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

  it('low cover, a rail, a crate beside you is not a wall: the second jump is the double jump; a tall wall is kicked', () => {
    for (const top of [0.9, 1.2, 1.45]) {
      const world = makeWorld();
      world.add(V(0.6, 0, -5), V(1.6, top, 5)); // cover this tall at your side
      const f = setup('flow', world);
      f.run(0.2);
      f.run(1 / 60, () => ({ ...idle(), jump: true }));
      f.run(0.25);
      f.run(1 / 60, () => ({ ...idle(), jump: true }));
      expect(f.log.airJumps, `cover ${top} m`).toEqual([false]);
      expect(f.body.vel.y).toBeCloseTo(FLOW.jump.doubleJumpSpeed, 0);
    }
    const world = makeWorld();
    world.add(V(0.6, 0, -5), V(1.6, 2.8, 5)); // a real wall (over your head mid-jump)
    const f = setup('flow', world);
    f.run(0.2);
    f.run(1 / 60, () => ({ ...idle(), jump: true }));
    f.run(0.25);
    f.run(1 / 60, () => ({ ...idle(), jump: true }));
    expect(f.log.airJumps).toEqual([true]);
  });

  it('no wall kick straight off the ground: a jump pressed again at once (before minAir) is the double jump', () => {
    const world = makeWorld();
    world.add(V(0.6, 0, -5), V(1.6, 8, 5));
    const f = setup('flow', world);
    f.run(0.2);
    f.run(1 / 60, () => ({ ...idle(), jump: true }));
    f.run(1 / 60);
    f.run(1 / 60, () => ({ ...idle(), jump: true }));
    expect(f.log.airJumps).toEqual([false]);
  });

  it('air control steers, it never builds speed: circling the stick mid-air stays under the run cap', () => {
    const f = setup('flow');
    f.run(1, sprint);
    f.run(1 / 60, () => ({ ...sprint(), jump: true }));
    let top = 0;
    // a long fall off a tower: plenty of air time
    f.body.pos.y = 30;
    f.run(1.5, (i) => ({ ...sprint(), camYaw: i * 0.12 }), 1 / 60, () => (top = Math.max(top, hspeed(f.body))));
    expect(top).toBeLessThanOrEqual(FLOW_SPRINT + 0.05);
  });

  it('slide-jump: out of a slide you keep its speed plus a little (to the cap); slide after slide never stacks past it', () => {
    const f = setup('flow');
    f.run(1, sprint);
    f.run(1 / 60, () => ({ ...sprint(), slide: true }));
    f.run(0.1, sprint);
    const inSlide = hspeed(f.body);
    f.run(1 / 60, () => ({ ...sprint(), jump: true }));
    expect(f.player.slideT).toBe(0);
    expect(hspeed(f.body)).toBeGreaterThan(inSlide + FLOW.slide.jumpBoost * 0.5);
    expect(hspeed(f.body)).toBeLessThanOrEqual(FLOW.slide.cap + 1e-6);
    // land, slide, jump, slide... never past the cap on the ground
    let top = 0;
    for (let k = 0; k < 6; k++) {
      f.run(0.9, sprint, 1 / 60, () => (top = Math.max(top, hspeed(f.body))));
      f.run(1 / 60, () => ({ ...sprint(), slide: true }));
      f.run(0.05, sprint);
      f.run(1 / 60, () => ({ ...sprint(), jump: true }));
    }
    expect(top).toBeLessThanOrEqual(FLOW.slide.cap + 0.05);
    // a plain jump (no slide) adds nothing
    const g = setup('flow');
    g.run(1, sprint);
    const h0 = hspeed(g.body);
    g.run(1 / 60, () => ({ ...sprint(), jump: true }));
    expect(hspeed(g.body)).toBeLessThanOrEqual(h0 + 0.05);
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
    expect(run).toBeGreaterThan(0.015);
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

  it('fills in about half a minute of active, stylish play; plain running takes about a minute', () => {
    const M = FLOW.meter;
    // 30 s of play: 20 s running flat out, 6 s in the air, 3 s sliding, 4 kills (2 stylish), 2 wall kicks, 5 double jumps, 3 rifts
    const m = new PowerMeter();
    m.value = 0;
    for (let i = 0; i < 20 * 60; i++) m.update(1 / 60, { speed: FLOW_SPRINT, grounded: true, sliding: false });
    for (let i = 0; i < 6 * 60; i++) m.update(1 / 60, { speed: FLOW_SPRINT, grounded: false, sliding: false });
    for (let i = 0; i < 3 * 60; i++) m.update(1 / 60, { speed: FLOW.slide.cap, grounded: true, sliding: true });
    const perPlay = m.value + 2 * M.kill + 2 * M.styleKill + 2 * M.wallJump + 5 * M.airJump + 3 * M.portal - 0;
    const secs = 30 / perPlay; // seconds of this kind of play to fill it from empty
    expect(secs).toBeGreaterThan(20);
    expect(secs).toBeLessThan(40);
    const run = new PowerMeter();
    run.value = 0;
    let t = 0;
    while (!run.ready && t < 600) {
      run.update(0.1, { speed: FLOW_SPRINT, grounded: true, sliding: false });
      t += 0.1;
    }
    expect(t).toBeGreaterThan(45);
    expect(t).toBeLessThan(90);
  });

  it('marks snap: the nearest lit man not yet marked within the radius; nothing out of it', () => {
    const c = [
      { id: 1, x: 400, y: 200 },
      { id: 2, x: 450, y: 210 },
      { id: 3, x: 700, y: 100 },
    ];
    expect(pickMark(c, 410, 205, 64)).toBe(1);
    expect(pickMark(c, 440, 205, 64)).toBe(2);
    expect(pickMark(c, 410, 205, 64, [1])).toBe(2); // already marked: the next nearest
    expect(pickMark(c, 600, 300, 64)).toBe(null);
    expect(pickMark(c, 660, 140, 64)).toBe(3);
    expect(pickMark([], 0, 0, 64)).toBe(null);
  });

  it('POWER held on the Game: a tap by a man marks him, the crosshair snaps to the nearest, no line of sight needed', () => {
    setLabActive(true);
    setVariant('flow');
    const noop = () => {};
    const sink = new Proxy({}, { get: () => noop });
    const men = [1, 2, 3, 4].map((id) => ({ id, alive: true, pos: V(id * 3, 0, 10), chest: (o = new THREE.Vector3()) => o.set(id * 3, 1.3, 10) }));
    const screen: Record<number, [number, number]> = { 1: [100, 300], 2: [640, 340], 3: [900, 200], 4: [1200, 650] };
    const held = new Set(['power']);
    const pressed = new Set<string>();
    let taps: { x: number; y: number }[] = [];
    const P = new PowerMoment();
    P.begin();
    const g = Object.create(Game.prototype) as any;
    Object.assign(g, {
      time: 1,
      dodgeSafeUntil: 0,
      power: P,
      meter: new PowerMeter(),
      powerDwell: { id: -1, t: 0 },
      powerAim: null,
      renderer: { width: 1280, height: 720, grade: { uniforms: { uFlash: { value: 0 } } } },
      input: { lastDevice: 'touch', wasPressed: (a: string) => pressed.has(a), isHeld: (a: string) => held.has(a), consumeTaps: () => { const t = taps; taps = []; return t; } },
      player: { body: { pos: V(0, 0, 0) } },
      enemies: { get: (id: number) => men.find((m) => m.id === id) ?? null },
      powerCandidates: () => men.map((m) => ({ id: m.id, x: screen[m.id][0], y: screen[m.id][1] })),
      fx: sink,
      audio: sink,
      hud: sink,
    });
    // the crosshair (640, 360) is near man 2: that's the aim, he isn't marked yet (a thumb dwells)
    g.updatePower(1 / 60, true);
    expect(g.powerAim?.id).toBe(2);
    expect(P.marks).toEqual([]);
    // a tap 40 px off man 3 and one off man 1: both marked; a tap in empty space: nothing
    taps = [{ x: 930, y: 230 }, { x: 70, y: 320 }, { x: 500, y: 600 }];
    g.updatePower(1 / 60, true);
    expect(P.marks).toEqual([3, 1]);
    // a click marks the crosshair's man; the cap is three
    pressed.add('portal');
    g.updatePower(1 / 60, true);
    expect(P.marks).toEqual([3, 1, 2]);
    taps = [{ x: 1200, y: 650 }];
    g.updatePower(1 / 60, true);
    expect(P.marks).toEqual([3, 1, 2]);
    // let go: the chain
    pressed.clear();
    held.clear();
    g.updatePower(1 / 60, true);
    expect(P.phase).toBe('chain');
  });

  it('the chain never puts you over the void: no floor past him, you come out this side of him (and stop at an edge)', () => {
    setLabActive(true);
    setVariant('flow');
    const noop = () => {};
    const sink = new Proxy({}, { get: () => noop });
    const man = { id: 1, kind: 'rifleman', alive: true, radius: 0.4, height: 1.8, pos: V(6, 0, 0), chest: (o = new THREE.Vector3()) => o.set(6, 1.3, 0) };
    const body = { pos: V(0, 0, 0), vel: V(0, 0, 0) };
    const g = Object.create(Game.prototype) as any;
    Object.assign(g, {
      time: 5,
      hitstop: 0,
      killCtx: null,
      rig: { shake: 0, kick: 0, yaw: 0 },
      renderer: { grade: { uniforms: { uFlash: { value: 0 } } } },
      fx: sink,
      audio: sink,
      hud: sink,
      // the floor ends at x = 6.2 (the void beyond)
      level: { world: { overlapsCylinder: () => false, groundAt: (x: number) => (x < 6.2 ? 0 : -Infinity) } },
      enemies: { get: () => man, hit: (e: typeof man) => ((e.alive = false), 'killed') },
      player: { body, endLunge: noop, teleport: (p: THREE.Vector3) => body.pos.copy(p), chest: (o: THREE.Vector3) => o.copy(body.pos) },
    });
    g.powerStrike(1, 1);
    expect(body.pos.x).toBeLessThan(6);
    expect(body.pos.x).toBeCloseTo(6 - man.radius - FLOW.power.past, 5);
    expect(Math.hypot(body.vel.x, body.vel.z)).toBe(0);
  });

  it('touch: SLIDE and POWER are FLOW-only buttons (CROUCH steps aside for SLIDE); the game drives them', () => {
    const ts = touchSrc;
    expect(ts).toMatch(/class="t-btn t-slide" data-t="crouch"/);
    expect(ts).toMatch(/class="t-btn t-power" data-t="power"/);
    // (style.css: .t-slide / .t-power are display: none unless .touch.flow, which hides .t-crouch)
    expect(ts).toMatch(/classList\.toggle\('flow', !!s\)/);
    // the game: FLOW on, a state (ring fill, ready, held, slide); off: null
    const calls: unknown[] = [];
    const g = Object.create(Game.prototype) as any;
    Object.assign(g, {
      lab: { hud: { setFlow: noopFn } },
      hud: { setCrossHot: noopFn },
      touch: { setFlow: (s: unknown) => calls.push(s) },
      player: { body: { vel: V(0, 0, FLOW_SPRINT), onGround: true }, slideT: 0 },
      meter: Object.assign(new PowerMeter(), { value: 1 }),
      power: new PowerMoment(),
    });
    g.updateFlowHud(true, 1 / 60);
    g.updateFlowHud(false, 1 / 60);
    expect(calls[0]).toEqual({ fill: 1, ready: true, held: false, slide: true });
    expect(calls[1]).toBe(null);
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
      level: { world: { overlapsCylinder: () => false, groundAt: () => 0 } },
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
    const keys = Object.keys(en).filter((k) => k.startsWith('flow.') || k === 'lab.v.flow' || k === 'lab.vd.flow' || k === 'touch.power' || k === 'touch.slide' || k === 'lab.rules' || k === 'lab.variantNoteTouch');
    expect(keys.length).toBeGreaterThanOrEqual(14);
    for (const k of keys) expect(he[k], k).toBeTruthy();
    for (const k of ['flow.ready', 'flow.held', 'flow.heldTouch', 'flow.call.mark']) {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(vars(he[k]), k).toBe(vars(en[k]));
    }
  });
});
