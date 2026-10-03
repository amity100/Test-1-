import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Hands, knifeReach, pickAim, REACH, reachKillTool, windowSpot, type AimCandidate } from '../../src/game/reach';
import { Armory } from '../../src/game/weapons';
import { ReachMode, type ReachHost } from '../../src/game/reachmode';
import { arrive, RedPortals } from '../../src/actors/reachai';
import { activeVariant, LAB_OFFERED, reachOn, setLabActive, setVariant, VARIANTS } from '../../src/game/variant';
import { flowBodyOn, flowOn } from '../../src/game/flow';
import { precisionOn } from '../../src/game/precision';
import { onslaughtOn } from '../../src/game/variant';
import { readSettings } from '../../src/game/settings';
import { labArena, labWaves, REACH_WAVES } from '../../src/world/combatlab/layout';
import { LabDirector, labTools } from '../../src/game/labdirector';
import { PortalKey } from '../../src/game/portalkey';
import { Game } from '../../src/game/game';
import { strings } from '../../src/ui/i18n';
import { scenario, V } from '../enemies/fakes';
import type { Enemy } from '../../src/actors/enemy';

afterEach(() => {
  setVariant('current');
  setLabActive(false);
});

const pt = (kind: AimCandidate['kind'], id: number, p: THREE.Vector3, r: number): AimCandidate => ({ kind, id, a: p.clone(), b: p.clone(), r });
const body = (id: number, feet: THREE.Vector3): AimCandidate => ({ kind: 'body', id, a: feet.clone().setY(feet.y + 0.25), b: feet.clone().setY(feet.y + 1.7), r: REACH.hand.radiusBody });

// ---------------------------------------------------------------------------
// Aiming the hand
// ---------------------------------------------------------------------------

describe('REACH: what the hand takes', () => {
  const O = V(0, 1.5, 0);
  const fwd = V(0, 0, 1);
  const opts = { range: REACH.range, cone: THREE.MathUtils.degToRad(2.2) };

  it('right on a man holding a weapon: the weapon (snatch); his head: the man (pull)', () => {
    const man = body(1, V(0, 0, 15));
    // (his hands, the gun in them: chest high)
    const gun = pt('weapon', 7, V(0, 1.25, 14.8), REACH.hand.radiusHeld);
    const chest = V(0, 1.25 - 1.5, 14.8).normalize();
    expect(pickAim(O, chest, O, [man, gun], opts)?.cand.kind).toBe('weapon');
    // aim at his head (above his hands)
    const up = V(0, 1.75 - 1.5, 15).normalize();
    expect(pickAim(O, up, O, [man, gun], opts)?.cand.kind).toBe('body');
  });

  it('their portal over everything it overlaps', () => {
    const man = body(1, V(0, 0, 15));
    const gun = pt('weapon', 7, V(0, 1.5, 14.8), REACH.hand.radiusWeapon);
    const portal = pt('portal', 3, V(0, 1.5, 14), REACH.hand.radiusPortal);
    expect(pickAim(O, fwd, O, [man, gun, portal], opts)?.cand.kind).toBe('portal');
  });

  it('near-misses go to the nearest to the crosshair; outside the cone or the 30 m reach, nothing', () => {
    const a = pt('weapon', 1, V(0.9, 1.5, 15), 0.1);
    const b = pt('weapon', 2, V(0.5, 1.5, 15), 0.1);
    expect(pickAim(O, fwd, O, [a, b], { range: 30, cone: THREE.MathUtils.degToRad(4) })?.cand.id).toBe(2);
    expect(pickAim(O, fwd, O, [pt('weapon', 3, V(3, 1.5, 15), 0.1)], opts)).toBeNull();
    expect(pickAim(O, fwd, O, [pt('weapon', 4, V(0, 1.5, 31), 0.4)], opts)).toBeNull();
    // a thumb gets more help
    const thumb = { range: 30, cone: THREE.MathUtils.degToRad(REACH.hand.cone.touch) };
    expect(pickAim(O, fwd, O, [pt('weapon', 3, V(1.6, 1.5, 15), 0.38)], thumb)?.cand.id).toBe(3);
  });

  it('only what you can see (the line of sight is asked last, best first)', () => {
    const a = pt('weapon', 1, V(0, 1.5, 10), 0.4);
    const b = pt('weapon', 2, V(0.3, 1.5, 12), 0.1);
    const asked: number[] = [];
    const pick = pickAim(O, fwd, O, [a, b], { ...opts, sees: (c) => (asked.push(c.id), c.id !== 1) });
    expect(pick?.cand.id).toBe(2);
    expect(asked).toEqual([1, 2]);
  });

  it('the window opens just short of what it is after, toward you, the hand pointing at it', () => {
    const at = new THREE.Vector3(), dir = new THREE.Vector3();
    windowSpot(V(0, 1.5, 0), V(0, 1.5, 10), at, dir);
    expect(at.z).toBeCloseTo(10 - REACH.hand.standOff, 5);
    expect(dir.z).toBeCloseTo(1, 5);
  });
});

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------

describe('REACH: weapons on the floor', () => {
  it('the race: the first window to open takes it; any later one finds it spoken for', () => {
    const A = new Armory();
    const w = A.add('rifle', V(0, 0, 0));
    expect(A.claim(w, 4)).toBe(true);
    expect(A.claim(w, 'player')).toBe(false);
    expect(A.free()).toHaveLength(0);
    A.give(w, 4);
    expect(A.heldBy(4)).toBe(w);
    expect(w.claim).toBeNull();
  });

  it('one weapon in hand: taking another drops what you held', () => {
    const A = new Armory();
    const r = A.add('rifle', V(0, 0, 0));
    const k = A.add('knife', V(3, 0, 0));
    A.give(r, 'player');
    const dropped = A.give(k, 'player', V(1, 1, 1));
    expect(dropped).toBe(r);
    expect(r.holder).toBeNull();
    expect(A.heldBy('player')).toBe(k);
  });

  it('a rifle has one magazine: 12 rounds, then it is spent and nobody takes it', () => {
    const A = new Armory();
    const r = A.add('rifle', V(0, 0, 0));
    expect(r.ammo).toBe(REACH.rifle.mag);
    expect(REACH.rifle.mag).toBe(12);
    let n = 0;
    while (A.fire(r)) n++;
    expect(n).toBe(12);
    expect(Armory.spent(r)).toBe(true);
    A.drop(r, V(0, 1, 0));
    expect(A.claim(r, 'player')).toBe(false);
    expect(A.free()).toHaveLength(0);
    // a knife never runs out
    const k = A.add('knife', V(0, 0, 0));
    expect(A.fire(k)).toBe(false);
    expect(Armory.live(k)).toBe(true);
  });

  it('dropped weapons fall and settle; a rifle into the void is lost, a knife comes back where the wave put it', () => {
    const A = new Armory();
    const ground = (x: number) => (x < 10 ? 0 : -Infinity);
    const lost = (p: THREE.Vector3) => p.y < -9;
    const w = A.add('rifle', V(0, 0, 0));
    A.drop(w, V(0, 2, 0));
    for (let i = 0; i < 120; i++) A.update(1 / 60, ground, lost);
    expect(w.resting).toBe(true);
    expect(w.pos.y).toBeCloseTo(0.08, 2);
    A.drop(w, V(20, 2, 0));
    for (let i = 0; i < 200; i++) A.update(1 / 60, ground, lost);
    expect(w.gone).toBe(true);
    const k = A.add('knife', V(3, 0, 1));
    A.drop(k, V(20, 2, 0));
    for (let i = 0; i < 200; i++) A.update(1 / 60, ground, lost);
    expect(k.gone).toBe(false);
    expect(k.resting).toBe(true);
    expect(k.pos.x).toBe(3);
  });
});

describe('REACH: the knife', () => {
  it('up close it stabs; within 30 m in sight, through a window; out of sight or reach, nothing', () => {
    expect(knifeReach(2, true)).toBe('melee');
    expect(knifeReach(2, false)).toBe('melee');
    expect(knifeReach(18, true)).toBe('window');
    expect(knifeReach(29.9, true)).toBe('window');
    expect(knifeReach(18, false)).toBeNull();
    expect(knifeReach(31, true)).toBeNull();
  });

  it('kills by tool: a portal you moved, your round, your knife, anything else', () => {
    expect(reachKillTool('void', true, null)).toBe('redirect');
    expect(reachKillTool('bolt', false, 'rifle')).toBe('rifle');
    expect(reachKillTool('melee', false, 'knife')).toBe('knife');
    expect(reachKillTool('blade', false, null)).toBe('knife');
    expect(reachKillTool('bolt', false, null)).toBe('other');
  });
});

describe('REACH: hand windows', () => {
  it('the hand lands once, REACH.hand.open s in (a steal after its telegraph), and the window shuts after', () => {
    const H = new Hands();
    const calls: number[] = [];
    let t = 0;
    H.open({ owner: 'player', kind: 'snatch', at: V(), dir: V(0, 0, 1) });
    H.open({ owner: 3, kind: 'steal', at: V(), dir: V(0, 0, 1), tele: REACH.enemy.steal.telegraph });
    for (let i = 0; i < 90; i++) {
      t += 1 / 60;
      H.update(1 / 60, (w) => (calls.push(t), w.owner === 'player'));
    }
    expect(calls).toHaveLength(2);
    expect(calls[0]).toBeCloseTo(REACH.hand.open, 1);
    expect(calls[1]).toBeCloseTo(REACH.enemy.steal.telegraph + REACH.hand.open, 1);
    expect(H.list).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// REACH in a (stand-in) game: the real enemy system, its brain, the hand
// ---------------------------------------------------------------------------

const noop = () => {};
const sink = new Proxy({}, { get: () => noop }) as any;

function rig(o: { hole?: boolean } = {}) {
  setLabActive(true);
  setVariant('reach');
  const sc = scenario();
  if (o.hole) {
    // the deck ends at x = 10: past it, nothing (the void)
    sc.world.remove(sc.ground);
    sc.world.add({ x: -60, y: -1, z: -60 }, { x: 10, y: 0, z: 60 });
  }
  const pos = V(0, 0, 0);
  const player = {
    body: { pos, vel: V(), onGround: true },
    yaw: 0,
    weaponUp: 0,
    chest: (out = new THREE.Vector3()) => out.set(pos.x, pos.y + 1.3, pos.z),
    lunge: noop,
  };
  const hand = () => V(pos.x - 0.3, pos.y + 1.1, pos.z + 0.2);
  const hero = {
    setHeld: noop,
    play: noop,
    gauntletPos: (out = new THREE.Vector3()) => out.copy(hand()),
    bonePos: (_n: string, out = new THREE.Vector3()) => out.copy(hand()),
    heldMuzzle: (out = new THREE.Vector3()) => out.set(pos.x, pos.y + 1.4, pos.z + 0.5),
  };
  const ray = { origin: V(0, 1.6, -0.01), dir: V(0, 0, 1) };
  const calls: string[] = [];
  const state = { time: 0, crossT: -99, alive: true };
  const host: ReachHost = {
    world: sc.world,
    enemies: sc.sys,
    fx: sink,
    audio: sink,
    camera: new THREE.PerspectiveCamera(),
    player: player as any,
    hero: hero as any,
    aimRay: () => ray,
    eye: (out) => out.set(pos.x, pos.y + 1.6, pos.z),
    device: () => 'kbm',
    time: () => state.time,
    alive: () => state.alive,
    safe: () => false,
    fighting: () => true,
    standAt: (x, z, y) => {
      const g = sc.world.groundAt(x, z, 0.3, y + 1.2);
      return g === -Infinity || Math.abs(g - y) > 1.3 ? null : g;
    },
    lost: (p) => p.y < -9,
    exitOutcome: (p) => (sc.world.groundAt(p.x, p.z, 0.25, p.y + 0.6) === -Infinity ? 'void' : 'floor'),
    hurt: () => calls.push('hurt'),
    hitstop: noop,
    shake: noop,
    kick: noop,
    lastCrossT: () => state.crossT,
  };
  const hud = { update: noop, show: noop, dispose: noop, tip: noop, callout: (k: string) => calls.push(k) };
  const R = new ReachMode(host, null, hud as any);
  sc.sys.reachBrain = R.ai;
  const input = { fire: false, firePress: false, hand: false, handPress: false };
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      state.time += 1 / 60;
      sc.player.pos.copy(pos);
      sc.player.chest.set(pos.x, pos.y + 1.3, pos.z);
      R.update(1 / 60, 1 / 60, input);
      input.firePress = input.handPress = false;
      sc.step(1);
    }
  };
  const aimAt = (p: THREE.Vector3) => {
    ray.origin.set(pos.x, pos.y + 1.6, pos.z);
    ray.dir.subVectors(p, ray.origin).normalize();
  };
  const man = (at: THREE.Vector3) => sc.spawn('rifleman', at, Math.PI, { reach: true, state: 'combat' }) as Enemy;
  /** Keep a man from deciding anything for himself (a set piece). */
  const freeze = (e: Enemy) => {
    const m = R.ai.mind(e, Math.random);
    m.react = 99;
    m.stealCd = 99;
    m.portalCd = 99;
    m.gunT = 99;
  };
  return { sc, R, host, pos, ray, input, step, aimAt, man, freeze, calls, state };
}

describe('REACH: in the game', () => {
  it('a man spawned for REACH starts empty-handed with its hit points; his brain is the REACH one', () => {
    const { man, R, step } = rig();
    const e = man(V(0, 0, 12));
    step(2);
    expect(e.reach).toBe(true);
    expect(e.hp).toBe(REACH.enemy.hp);
    expect(R.armory.heldBy(e.id)).toBeNull();
  });

  it('snatch: your window takes a weapon off the floor (and it is yours)', () => {
    const { R, step, aimAt, input } = rig();
    const w = R.armory.add('knife', V(0, 0, 8));
    aimAt(V(0, 0.2, 8));
    step(1);
    expect(R.aim?.verb).toBe('snatch');
    input.handPress = true;
    step(Math.ceil(REACH.hand.open * 60) + 2);
    expect(R.armory.heldBy('player')).toBe(w);
  });

  it('the race: a man whose window opened first takes it, yours comes back empty (TOO LATE)', () => {
    const { R, step, aimAt, input, man, freeze, calls } = rig();
    const e = man(V(4, 0, 12));
    step(1);
    freeze(e);
    const w = R.armory.add('rifle', V(0, 0, 8));
    // his window opens first
    expect(R.armory.claim(w, e.id)).toBe(true);
    R.hands.open({ owner: e.id, kind: 'snatch', at: V(1, 0.5, 9), dir: V(-1, 0, -1), weapon: w });
    aimAt(V(0, 0.2, 8));
    step(1);
    expect(R.aim?.verb).toBe('late');
    input.handPress = true;
    step(20);
    expect(R.armory.heldBy(e.id)).toBe(w);
    expect(R.armory.heldBy('player')).toBeNull();
    expect(calls).toContain('reach.late');
  });

  it('you steal the rifle out of his hands: he is left empty-handed', () => {
    const { R, step, aimAt, input, man, freeze, calls } = rig();
    const e = man(V(0, 0, 14));
    step(1);
    freeze(e);
    const w = R.armory.add('rifle', V(5, 0, 5));
    R.armory.give(w, e.id);
    // (his hand: the stand-in's is his chest)
    aimAt(e.chest(new THREE.Vector3()));
    step(1);
    expect(R.aim?.kind).toBe('weapon');
    input.handPress = true;
    step(20);
    expect(R.armory.heldBy('player')).toBe(w);
    expect(R.armory.heldBy(e.id)).toBeNull();
    expect(calls).toContain('reach.disarm');
  });

  it('he steals yours: stand still and it is gone; move away (or go through a portal) in time and you keep it', () => {
    for (const how of ['stand', 'move', 'portal'] as const) {
      const { R, step, man, freeze, pos, state } = rig();
      const e = man(V(0, 0, 10));
      step(1);
      freeze(e);
      const w = R.armory.add('rifle', V(0, 0, 0));
      R.armory.give(w, 'player');
      (R.ai as any).steal(e, R.ai.mind(e, Math.random), w, 0.5);
      expect(R.hands.list[0]?.kind).toBe('steal');
      step(10);
      if (how === 'move') pos.x += 3;
      if (how === 'portal') state.crossT = state.time;
      step(40);
      if (how === 'stand') expect(R.armory.heldBy(e.id), how).toBe(w);
      else expect(R.armory.heldBy('player'), how).toBe(w);
    }
  });

  it('pull: the hand yanks him to you; he lands in front of you, reeling', () => {
    const { R, step, aimAt, input, man, freeze } = rig();
    const e = man(V(0, 0, 18));
    step(1);
    freeze(e);
    aimAt(V(0, 1.75, 18));
    step(1);
    expect(R.aim?.verb).toBe('pull');
    input.handPress = true;
    step(Math.ceil((REACH.hand.open + REACH.pull.time) * 60) + 4);
    expect(e.pos.z).toBeLessThan(3);
    expect(e.pos.z).toBeGreaterThan(0.5);
    expect(e.state).toBe('stagger');
  });

  it('a knife: a man up close dies of one stab; through a window it takes two (one if he is reeling from your pull)', () => {
    const { R, step, aimAt, input, man, freeze } = rig();
    const k = R.armory.add('knife', V(0, 0, 0));
    R.armory.give(k, 'player');
    const near = man(V(0, 0, 1.8));
    const far = man(V(2, 0, 20));
    step(1);
    freeze(near);
    freeze(far);
    aimAt(near.chest(new THREE.Vector3()));
    input.firePress = true;
    step(5);
    expect(near.alive).toBe(false);
    step(40);
    aimAt(far.chest(new THREE.Vector3()));
    input.firePress = true;
    step(2);
    expect(R.hands.list.some((w) => w.kind === 'stab')).toBe(true);
    step(30);
    expect(far.alive).toBe(true);
    expect(far.hp).toBe(REACH.enemy.hp - REACH.knife.windowDamage);
    step(30);
    aimAt(far.chest(new THREE.Vector3()));
    input.firePress = true;
    step(30);
    expect(far.alive).toBe(false);
  });

  it('pull, then the knife: he lands within a stab, and one is enough', () => {
    const { R, step, aimAt, input, man, freeze } = rig();
    const k = R.armory.add('knife', V(0, 0, 0));
    R.armory.give(k, 'player');
    const e = man(V(0, 0, 20));
    step(1);
    freeze(e);
    aimAt(V(0, 1.75, 20));
    input.handPress = true;
    step(Math.ceil((REACH.hand.open + REACH.pull.time) * 60) + 3);
    expect(e.state).toBe('stagger');
    // he's right there now: one stab up close
    aimAt(e.chest(new THREE.Vector3()));
    input.firePress = true;
    step(3);
    expect(e.alive).toBe(false);
  });

  it('a rifle: rounds hit the man under the crosshair; the 12th leaves it spent and thrown aside', () => {
    const { R, step, aimAt, input, man, freeze } = rig();
    const r = R.armory.add('rifle', V(0, 0, 0));
    R.armory.give(r, 'player');
    const e = man(V(0, 0, 15));
    step(1);
    freeze(e);
    aimAt(e.chest(new THREE.Vector3()));
    input.fire = true;
    step(30);
    expect(e.alive).toBe(false);
    aimAt(V(0, 1.5, 40));
    step(120);
    input.fire = false;
    expect(r.ammo).toBe(0);
    expect(r.holder).toBeNull();
    expect(R.armory.heldBy('player')).toBeNull();
  });

  it('their portal, redirected: he comes out where you let go of it; over the void, that is his end (a PORTAL kill)', () => {
    const { R, step, sc, man, freeze } = rig({ hole: true });
    const e = man(V(-4, 0, 10));
    step(1);
    freeze(e);
    const p = R.portals.open(e.id, V(-4, 0, 11.5), 0, V(0, 0, 3), Math.PI);
    R.ai.mind(e, Math.random).portalId = p.id;
    // your hand takes it while it opens; its exit goes out over the void (x > 10)
    expect(R.portals.grab(p)).toBe(true);
    R.portals.aim(p, V(16, 0.4, 10), Math.PI / 2);
    R.portals.release(p);
    expect(p.redirected).toBe(true);
    const t = sc.until(() => {
      R.update(1 / 60, 1 / 60, { fire: false, firePress: false, hand: false, handPress: false });
      return !e.alive;
    }, 8);
    expect(t).toBeLessThan(8);
    expect(sc.log.died.at(-1)?.ctx.cause).toBe('void');
    const ev = { enemyId: e.id, cause: 'void' } as any;
    expect(R.toolFor(ev)).toBe('redirect');
  });

  it('arrive(): not redirected he steps out on his feet where he meant to; redirected he tumbles out', () => {
    const sc = scenario();
    const e = sc.spawn('rifleman', V(0, 0, 0), 0, { reach: true }) as Enemy;
    sc.step(1);
    const P = new RedPortals();
    const a = P.open(e.id, V(0, 0, 1), 0, V(5, 0, 5), 1);
    a.t = REACH.enemy.portal.telegraph;
    arrive(sc.sys, e, a);
    expect(e.pos.x).toBe(5);
    expect(e.state).not.toBe('launched');
    const b = P.open(e.id, V(5, 0, 6), 0, V(-5, 0, -5), 0);
    b.redirected = true;
    arrive(sc.sys, e, b);
    expect(e.pos.x).toBe(-5);
    expect(e.state).toBe('launched');
  });

  it('their portals open REACH.enemy.portal.telegraph s before anyone can use them, one at a time', () => {
    const P = new RedPortals();
    const p = P.open(1, V(), 0, V(0, 0, 5), 0);
    expect(RedPortals.isOpen(p)).toBe(false);
    P.update(REACH.enemy.portal.telegraph + 0.01, () => true);
    expect(RedPortals.isOpen(p)).toBe(true);
    expect(REACH.enemy.portal.telegraph).toBeCloseTo(0.5, 5);
    expect(REACH.enemy.steal.telegraph).toBeCloseTo(0.5, 5);
  });
});

// ---------------------------------------------------------------------------
// The gate: REACH only in the lab; the missions as they were; the old verbs off
// ---------------------------------------------------------------------------

describe('REACH: the gate', () => {
  it('the lab offers REACH only (and starts there); outside the lab everything is CURRENT', () => {
    expect(VARIANTS).toContain('reach');
    expect(LAB_OFFERED).toEqual(['reach']);
    expect(readSettings(null).combatVariant).toBe('reach');
    setVariant('reach');
    expect(activeVariant()).toBe('current');
    expect(reachOn()).toBe(false);
    setLabActive(true);
    expect(reachOn()).toBe(true);
  });

  it('REACH moves on FLOW’s body and nothing else of the old variants (no POWER, no PRECISION, no ONSLAUGHT)', () => {
    expect(flowBodyOn('reach')).toBe(true);
    expect(flowOn('reach')).toBe(false);
    expect(precisionOn('reach')).toBe(false);
    expect(onslaughtOn('reach')).toBe(false);
    for (const v of ['current', 'precision', 'onslaught'] as const) expect(flowBodyOn(v)).toBe(false);
  });

  it('the old verbs are off under REACH: no blade or grab prompt, no trap targets, the PORTAL only travels', () => {
    setLabActive(true);
    setVariant('reach');
    const g = Object.create(Game.prototype) as any;
    Object.assign(g, { lab: {}, respawnT: -1, player: { body: { pos: V() } } });
    expect(g.contextAction()).toBeNull();
    expect(g.trapTargets()).toEqual([]);
    // the PORTAL key with a man under the crosshair: a door all the same
    const man = { id: 1, alive: true, kind: 'rifleman', pos: V(0, 0, 8), def: { zone: 'pier' } } as any;
    const key = new PortalKey({
      rifts: { crosshairTarget: () => ({ key: 'enemy:1', pos: V(0, 0, 8) }), gateUnderRay: () => null } as any,
      world: null as any,
      level: null as any,
      killYAt: () => -100,
      enemies: { list: [man], byKey: () => man, hold: noop, isHeld: () => false, setSink: noop, launch: noop, stagger: noop },
      props: { byKey: () => null, release: noop },
      entranceCtx: () => ({ airborne: false, playerVel: V(), camPos: V(0, 1.6, 0), camDir: V(0, 0, 1), targets: [] }) as any,
      aimRay: () => ({ origin: V(0, 1.6, 0), dir: V(0, 0, 1) }),
      playerEye: () => V(0, 1.6, 0),
      playerFeet: () => V(),
      touch: () => false,
      live: () => true,
      hangingUnderCrosshair: () => null,
      travelOnly: () => true,
    });
    expect((key as any).resolve({ airborne: false, playerVel: V(), camPos: V(0, 1.6, 0), camDir: V(0, -0.1, 1).normalize(), targets: [] }).mode).toBe('door');
  });

  it('the missions keep their own: every other variant keeps its waves; REACH plays its own three', () => {
    const a = labArena();
    expect(labWaves(a, 'current')).toBe(a.waves);
    expect(labWaves(a, 'onslaught')).not.toBe(a.waves);
    const R = labWaves(a, 'reach');
    expect(R.map((w) => w.spawns.length)).toEqual([3, 4, 6]);
    expect(labTools('reach')).toEqual(['rifle', 'knife', 'redirect', 'other']);
    expect(labTools('current')).not.toContain('rifle');
    for (const w of REACH_WAVES) {
      const fighters = w.spawns.length + 1;
      const n = w.weapons!.length;
      expect(n / fighters).toBeGreaterThanOrEqual(1.4);
      expect(n / fighters).toBeLessThanOrEqual(1.7);
      const rifles = w.weapons!.filter((q) => q.kind === 'rifle').length / n;
      expect(rifles).toBeGreaterThan(0.5);
      expect(rifles).toBeLessThan(0.75);
      expect(w.ready).toBe(true);
      // every man REACH spawns is a plain rifleman with no ground to hold
      for (const s of w.spawns) expect(s.kind).toBe('rifleman');
    }
  });

  it('a REACH wave: its men come in at the banner and wait through the countdown; the fight starts at GO', () => {
    setVariant('reach');
    const arena = labArena();
    arena.variants!.reach!.forEach((w) => (w.lead = 3));
    const spawned: number[] = [];
    let id = 0;
    const d = new LabDirector(arena, { spawn: () => (spawned.push(++id), id), alive: () => true });
    d.start();
    d.update(1);
    expect(d.phase).toBe('breather');
    expect(spawned).toHaveLength(3);
    d.update(2.1);
    expect(d.phase).toBe('fight');
    expect(spawned).toHaveLength(3);
  });

  it('every REACH string is in English and Hebrew', () => {
    const en = strings('en'), he = strings('he');
    const keys = Object.keys(en).filter((k) => k.startsWith('reach.') || /^lab\.(r\d|v\.reach|vd\.reach|tool\.(rifle|knife|redirect))$/.test(k) || /^touch\.(weapon|hand|travel)$/.test(k));
    expect(keys.length).toBeGreaterThan(30);
    for (const k of keys) {
      expect(he[k], k).toBeTruthy();
      expect(he[k], k).not.toBe(en[k]);
    }
  });
});
