import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  byWindow,
  edgeArrow,
  Hands,
  inHisEyes,
  nearSpot,
  placeWindow,
  pullLanding,
  REACH,
  reachKillTool,
  redirectOutcome,
  sideOf,
  windowFrame,
} from '../../src/game/reach';
import { Armory } from '../../src/game/weapons';
import { ReachMode, type ReachHost, type ReachInput } from '../../src/game/reachmode';
import { arrive, RedPortals } from '../../src/actors/reachai';
import { activeVariant, LAB_OFFERED, reachOn, setLabActive, setVariant, VARIANTS } from '../../src/game/variant';
import { flowBodyOn, flowOn } from '../../src/game/flow';
import { precisionOn } from '../../src/game/precision';
import { onslaughtOn } from '../../src/game/variant';
import { readSettings } from '../../src/game/settings';
import { COVER, labArena, labWaves, POOL, REACH_WAVES, RING } from '../../src/world/combatlab/layout';
import { LabDirector, labTools } from '../../src/game/labdirector';
import { Game } from '../../src/game/game';
import { RiftSystem } from '../../src/game/portals';
import { strings } from '../../src/ui/i18n';
import { CollisionWorld } from '../../src/world/collision';
import { scenario, V } from '../enemies/fakes';
import { makePhysics } from './helpers';
import type { Enemy } from '../../src/actors/enemy';
import type { DynBody, PhysicsEvents } from '../../src/core/contracts';

afterEach(() => {
  setVariant('current');
  setLabActive(false);
});

const flatWorld = () => {
  const w = new CollisionWorld();
  w.add(V(-60, -1, -60), V(60, 0, 60));
  return w;
};
const groundOf = (w: CollisionWorld) => (x: number, z: number, y: number) => w.groundAt(x, z, 0.3, y);

// ---------------------------------------------------------------------------
// Placing the window
// ---------------------------------------------------------------------------

describe('REACH: where the window opens', () => {
  const eye = V(0, 1.6, 0);

  it('on a wall: a little in front of it, looking out of it (back at you)', () => {
    const w = flatWorld();
    w.add(V(-10, 0, 12), V(10, 6, 13));
    const s = placeWindow(w, eye, V(0, 0, 1), eye, null, groundOf(w));
    expect(s.surface).toBe('wall');
    expect(s.pos.z).toBeCloseTo(12 - REACH.window.off, 3);
    expect(s.look.z).toBeCloseTo(-1, 5);
    expect(s.ok).toBe(true);
    // (never sunk into the floor: its bottom is on or over it)
    expect(s.pos.y - REACH.window.height / 2).toBeGreaterThanOrEqual(-0.01);
  });

  it('on the floor: standing on the spot you aimed at, looking where you look', () => {
    const w = flatWorld();
    const dir = V(0, -1.6, 10).normalize();
    const s = placeWindow(w, eye, dir, eye, null, groundOf(w));
    expect(s.surface).toBe('floor');
    expect(s.pos.z).toBeCloseTo(10, 1);
    expect(s.pos.y).toBeCloseTo(REACH.window.height / 2 + 0.02, 2);
    expect(s.look.z).toBeCloseTo(1, 5);
  });

  it('in mid-air: nothing within reach, it stands at REACH.range; the wheel sets it nearer, short of a wall', () => {
    const w = flatWorld();
    const up = V(0, 0.3, 1).normalize();
    const s = placeWindow(w, eye, up, eye, null, groundOf(w));
    expect(s.surface).toBe('air');
    expect(s.dist).toBeCloseTo(REACH.range, 0);
    const near = placeWindow(w, eye, up, eye, 9, groundOf(w));
    expect(near.dist).toBeCloseTo(9, 0);
    expect(near.surface).toBe('air');
    // a wall at 6 m: it wins over a mid-air 9
    w.add(V(-10, 0, 6), V(10, 9, 7));
    const wall = placeWindow(w, eye, up, eye, 9, groundOf(w));
    expect(wall.surface).toBe('wall');
    expect(wall.pos.z).toBeCloseTo(6 - REACH.window.off, 2);
  });

  it('the ray starts at the camera: distances still count from your eyes; too near you, it does not open', () => {
    const w = flatWorld();
    const cam = V(0, 2.2, -3);
    const s = placeWindow(w, cam, V(0, 0, 1), eye, 12, groundOf(w));
    expect(s.dist).toBeCloseTo(12, 0);
    w.add(V(-10, 0, 2), V(10, 6, 3));
    const close = placeWindow(w, cam, V(0, 0, 1), eye, null, groundOf(w));
    expect(close.ok).toBe(false);
  });

  it('its twin opens in front of you, facing you; the pair is a rift pair whose fronts are the near window toward you and the far one along its look', () => {
    const n = nearSpot(V(0, 0, 0), V(0, 0, 1));
    expect(n.pos.z).toBeCloseTo(REACH.window.ahead, 5);
    expect(n.look.z).toBe(-1);
    const f = windowFrame(V(0, 1, 10), V(0, 0, 1), 'air');
    expect(new THREE.Vector3(0, 0, 1).applyQuaternion(f.quaternion).z).toBeCloseTo(1, 5);
  });
});

describe('REACH: what is right by the window, and which side of a man', () => {
  it('within REACH.window.reach of its plane (either side) and its width: in reach; further, not', () => {
    const at = V(0, 1, 10), look = V(0, 0, 1);
    expect(byWindow(at, look, V(0, 1, 11.2), REACH.window.reach)).toBe(true);
    expect(byWindow(at, look, V(0, 1, 8.8), REACH.window.reach)).toBe(true);
    expect(byWindow(at, look, V(0, 1, 12.2), REACH.window.reach)).toBe(false);
    expect(byWindow(at, look, V(1.6, 1, 10.5), REACH.window.reach)).toBe(false);
    expect(byWindow(at, look, V(0, 1, 11.2), REACH.window.knife)).toBe(true);
    expect(byWindow(at, look, V(0, 1, 11.5), REACH.window.knife)).toBe(false);
  });

  it('front (±60°), side, back; a window in his eyes only close and in front', () => {
    const p = V(0, 0, 0);
    expect(sideOf(p, 0, V(0, 0, 2))).toBe('front');
    expect(sideOf(p, 0, V(2, 0, 0))).toBe('side');
    expect(sideOf(p, 0, V(0, 0, -2))).toBe('back');
    const eye = V(0, 1.6, 0);
    expect(inHisEyes(eye, 0, V(0, 1.5, 5))).toBe(true);
    expect(inHisEyes(eye, 0, V(0, 1.5, REACH.notice.range + 1))).toBe(false);
    expect(inHisEyes(eye, 0, V(0, 1.5, -3))).toBe(false);
    expect(inHisEyes(eye, 0, V(4, 1.5, 1))).toBe(false);
  });

  it('a pulled man lands on your aim, a stab away (inside the knife and in the rifle’s easy range)', () => {
    const at = pullLanding(V(1, 0, 1), V(0, 0, 1));
    expect(at.z - 1).toBeCloseTo(REACH.pull.land, 5);
    expect(REACH.pull.land).toBeLessThan(REACH.knife.melee);
  });

  it('their portal moved: the void and the water first, then a deadly height, a wall, a hard fall', () => {
    expect(redirectOutcome('void', 0, Infinity)).toBe('void');
    expect(redirectOutcome('water', 9, 0.5)).toBe('water');
    expect(redirectOutcome('floor', 7, 0.5)).toBe('high');
    expect(redirectOutcome('floor', 1, 0.8)).toBe('wall');
    expect(redirectOutcome('floor', 4, 3)).toBe('fall');
    expect(redirectOutcome('floor', 0.2, 3)).toBe('floor');
  });

  it('edge arrows: on screen none; off to a side, that way; behind you, turned round', () => {
    expect(edgeArrow(0.2, 0.1, false)).toBeNull();
    expect(edgeArrow(1.5, 0, false)).toBeCloseTo(0, 5);
    expect(edgeArrow(-1.5, 0, false)).toBeCloseTo(Math.PI, 5);
    expect(edgeArrow(0, 1.4, false)).toBeCloseTo(Math.PI / 2, 5);
    // behind: mirrored (a point projected to the right of centre is really to the left)
    expect(Math.abs(edgeArrow(0.5, 0, true)!)).toBeCloseTo(Math.PI, 5);
    expect(edgeArrow(0, 0, true)).toBeCloseTo(-Math.PI / 2, 5);
  });
});

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------

describe('REACH: weapons on the floor', () => {
  it('the race is decided on arrival: sending a hand only marks it; the first hand to TOUCH it takes it', () => {
    const A = new Armory();
    const w = A.add('rifle', V(0, 0, 0));
    expect(A.claim(w, 4)).toBe(true);
    expect(A.claim(w, 'player')).toBe(true);
    // (still on the floor for everyone)
    expect(A.free()).toHaveLength(1);
    expect(A.touch(w, 'player')).toBe(true);
    expect(A.heldBy('player')).toBe(w);
    // his hand gets there after: nothing
    expect(A.touch(w, 4)).toBe(false);
    expect(w.claim).toBeNull();
    // out of a man's hands: only if the hand was sent at him
    expect(A.touch(w, 4, 7)).toBe(false);
    expect(A.touch(w, 4, 'player')).toBe(true);
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
    let n = 0;
    while (A.fire(r)) n++;
    expect(n).toBe(12);
    expect(Armory.spent(r)).toBe(true);
    A.drop(r, V(0, 1, 0));
    expect(A.claim(r, 'player')).toBe(false);
    expect(A.touch(r, 'player')).toBe(false);
    expect(A.free()).toHaveLength(0);
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
    A.drop(w, V(20, 2, 0));
    for (let i = 0; i < 200; i++) A.update(1 / 60, ground, lost);
    expect(w.gone).toBe(true);
    const k = A.add('knife', V(3, 0, 1));
    A.drop(k, V(20, 2, 0));
    for (let i = 0; i < 200; i++) A.update(1 / 60, ground, lost);
    expect(k.gone).toBe(false);
    expect(k.pos.x).toBe(3);
  });

  it('kills by tool: a portal you moved, your round, your knife, anything else', () => {
    expect(reachKillTool('void', true, null)).toBe('redirect');
    expect(reachKillTool('bolt', false, 'rifle')).toBe('rifle');
    expect(reachKillTool('melee', false, 'knife')).toBe('knife');
    expect(reachKillTool('bolt', false, null)).toBe('other');
  });

  it('a hand lands once, after its telegraph and its way out, and is gone after', () => {
    const H = new Hands();
    const calls: number[] = [];
    let t = 0;
    H.open({ owner: 'player', kind: 'snatch', at: V(), dir: V(0, 0, 1), far: true });
    H.open({ owner: 3, kind: 'steal', at: V(), dir: V(0, 0, 1), tele: REACH.enemy.steal.telegraph });
    for (let i = 0; i < 90; i++) {
      t += 1 / 60;
      H.update(1 / 60, (w) => (calls.push(t), w.owner === 'player'));
    }
    expect(calls).toHaveLength(2);
    expect(calls[0]).toBeCloseTo(REACH.hand.out, 1);
    expect(calls[1]).toBeCloseTo(REACH.enemy.steal.telegraph + REACH.hand.out, 1);
    expect(H.list).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// REACH in a (stand-in) game: the real enemy system and its brain, a real rift system
// ---------------------------------------------------------------------------

const noop = () => {};
const sink = new Proxy({}, { get: () => noop }) as any;

function rig(o: { hole?: boolean; device?: 'kbm' | 'touch' } = {}) {
  setLabActive(true);
  setVariant('reach');
  const sc = scenario();
  if (o.hole) {
    sc.world.remove(sc.ground);
    sc.world.add({ x: -60, y: -1, z: -60 }, { x: 10, y: 0, z: 60 });
  }
  const rifts = new RiftSystem(new THREE.Scene(), null, sc.world, { portalScale: 0.5, lightCount: 2, maxViews: 2 });
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
  const marked: number[] = [];
  const state = { time: 0, crossT: -99, alive: true };
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  const host: ReachHost = {
    world: sc.world,
    enemies: sc.sys,
    fx: sink,
    audio: sink,
    camera,
    player: player as any,
    hero: hero as any,
    rifts,
    aimRay: () => ray,
    eye: (out) => out.set(pos.x, pos.y + 1.6, pos.z),
    device: () => o.device ?? 'kbm',
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
    markForAllies: (id) => marked.push(id),
  };
  const hud = { update: noop, show: noop, dispose: noop, tip: noop, callout: (k: string) => calls.push(k) };
  const R = new ReachMode(host, null, hud as any);
  sc.sys.reachBrain = R.ai;
  const input: ReachInput = { fire: false, firePress: false, window: false, hand: false, handPress: false, wheel: 0 };
  /** Men held facing one way (a set piece: their brain would turn them to you). */
  const pinned = new Map<Enemy, number>();
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      for (const [e, yaw] of pinned) e.yaw = yaw;
      state.time += 1 / 60;
      sc.player.pos.copy(pos);
      sc.player.chest.set(pos.x, pos.y + 1.3, pos.z);
      camera.position.set(pos.x, pos.y + 1.8, pos.z - 3);
      camera.lookAt(camera.position.clone().add(ray.dir));
      camera.updateMatrixWorld();
      R.update(1 / 60, 1 / 60, input);
      rifts.update(1 / 60, 1 / 60, state.time);
      input.firePress = input.handPress = false;
      sc.step(1);
    }
  };
  const aimAt = (p: THREE.Vector3) => {
    ray.origin.set(pos.x, pos.y + 1.6, pos.z);
    ray.dir.subVectors(p, ray.origin).normalize();
  };
  /** Hold WINDOW aimed at `p`, let go: the pair opens (and is fully open). */
  const openAt = (p: THREE.Vector3) => {
    aimAt(p);
    input.window = true;
    step(1);
    // (the wheel's distance: right there)
    R.airDist = V(pos.x, pos.y + 1.6, pos.z).distanceTo(p);
    step(1);
    input.window = false;
    step(Math.ceil(REACH.window.open * 60) + 1);
  };
  const press = (k: 'hand' | 'fire', n = 30) => {
    if (k === 'hand') input.handPress = true;
    else input.firePress = true;
    step(n);
  };
  const man = (at: THREE.Vector3, yaw = Math.PI) => sc.spawn('rifleman', at, yaw, { reach: true, state: 'combat' }) as Enemy;
  /** Keep a man from deciding anything for himself (a set piece), facing the way he was spawned. */
  const freeze = (e: Enemy) => {
    pinned.set(e, e.yaw);
    const m = R.ai.mind(e, Math.random);
    m.react = 99;
    m.stealCd = 99;
    m.portalCd = 99;
    m.gunT = 99;
  };
  return { sc, R, host, rifts, pos, ray, input, step, aimAt, openAt, press, man, freeze, calls, state, marked, camera };
}

describe('REACH: one window at a time', () => {
  it('hold to aim (a ghost), let go: the pair opens; a second one shuts the first; it shuts by itself after its life', () => {
    const { R, rifts, step, aimAt, input } = rig();
    aimAt(V(0, 1.5, 12));
    input.window = true;
    step(1);
    R.airDist = 12;
    step(2);
    expect(R.ghost).not.toBeNull();
    expect(R.win).toBeNull();
    input.window = false;
    step(1);
    expect(R.ghost).toBeNull();
    const first = R.win!;
    expect(first).not.toBeNull();
    expect(first.far.pos.distanceTo(V(0, 1.6, 12))).toBeLessThan(1.5);
    expect(first.near.pos.z).toBeCloseTo(REACH.window.ahead, 1);
    expect(rifts.strikeOpen()).toBe(true);
    step(Math.ceil(REACH.window.cooldown * 60) + 2);
    aimAt(V(5, 1.5, 12));
    input.window = true;
    step(2);
    input.window = false;
    step(1);
    expect(R.win!.id).not.toBe(first.id);
    // (no wheel: the aim went on to the first thing it met: here, REACH.range away)
    expect(R.win!.far.pos.distanceTo(V(0, 1.6, 0))).toBeGreaterThan(20);
    expect(rifts.strikeEnds(first.strike)).toBeNull();
    step(Math.ceil(REACH.window.life * 60) + 2);
    expect(R.win).toBeNull();
    expect(rifts.strikeOpen()).toBe(false);
  });

  it('no window: HAND says so and does nothing', () => {
    const { R, press, calls } = rig();
    R.armory.add('knife', V(0, 0, 6));
    press('hand', 10);
    expect(calls).toContain('reach.noWindow');
    expect(R.armory.heldBy('player')).toBeNull();
  });
});

describe('REACH: the hand at the far window', () => {
  it('takes a weapon right by the far window; one a step too far away is a whiff', () => {
    const { R, openAt, press, calls, step } = rig();
    const near = R.armory.add('rifle', V(0.3, 0, 13));
    const far = R.armory.add('knife', V(4, 0, 13));
    openAt(V(0, 1.5, 12));
    expect(R.plan?.verb).toBe('rifle');
    press('hand', 20);
    expect(R.armory.heldBy('player')).toBe(near);
    // the knife, 4 m to the side of a window by it: not in reach
    step(40);
    openAt(V(1.4, 1.5, 12));
    R.armory.list.forEach((w) => w === near && R.armory.drop(w, V(0, 0, -20)));
    expect(R.plan?.verb).toBe('empty');
    press('hand', 30);
    expect(calls).toContain('reach.whiff');
    expect(far.holder).toBeNull();
  });

  it('the real race: his window opened first, but your hand touched it first: it is yours (and his comes back empty)', () => {
    const { R, man, freeze, openAt, press, step } = rig();
    const e = man(V(6, 0, 16));
    step(1);
    freeze(e);
    const w = R.armory.add('rifle', V(0, 0, 13));
    // his red window opens first (telegraphed: his hand is out later)
    R.armory.claim(w, e.id);
    R.hands.open({ owner: e.id, kind: 'snatch', at: V(1, 1, 13.5), dir: V(-1, 0, -0.3), weapon: w, tele: REACH.enemy.windowTele, out: REACH.enemy.windowOut });
    openAt(V(0, 1.5, 12));
    press('hand', 40);
    expect(R.armory.heldBy('player')).toBe(w);
    expect(R.armory.heldBy(e.id)).toBeNull();
    step(1);
  });

  it('…and the other way round: his hand touched it first, yours comes back empty (TOO LATE)', () => {
    const { R, man, freeze, openAt, press, calls, step } = rig();
    const e = man(V(6, 0, 16));
    step(1);
    freeze(e);
    const w = R.armory.add('rifle', V(0, 0, 13));
    openAt(V(0, 1.5, 12));
    // both hands out at once: his is quicker
    R.hands.open({ owner: e.id, kind: 'snatch', at: V(1, 1, 13.5), dir: V(-1, 0, -0.3), weapon: w, out: 0.05 });
    press('hand', 40);
    expect(R.armory.heldBy(e.id)).toBe(w);
    expect(R.armory.heldBy('player')).toBeNull();
    expect(calls).toContain('reach.late');
  });

  it('aimed at a man, the window stands just past him along your aim (behind him if he faces you)', () => {
    const { R, man, freeze, step, aimAt, input } = rig();
    const e = man(V(0, 0, 14), Math.PI);
    step(1);
    freeze(e);
    aimAt(V(0, 1.2, 14));
    input.window = true;
    step(2);
    expect(R.ghost!.pos.z).toBeCloseTo(14 + REACH.window.past, 0);
    expect(sideOf(e.pos, e.yaw, R.ghost!.pos)).toBe('back');
    input.window = false;
  });

  it('a man walking over a weapon takes it (a touch); so do you, with empty hands', () => {
    const { R, man, step, pos } = rig();
    const e = man(V(0, 0, 20));
    const w = R.armory.add('knife', V(0.4, 0, 20.3));
    step(Math.ceil(REACH.enemy.react[1] * 60) + 20);
    expect(R.armory.heldBy(e.id)).toBe(w);
    const mine = R.armory.add('rifle', V(0.5, 0, 0.4));
    pos.set(0, 0, 0);
    step(2);
    expect(R.armory.heldBy('player')).toBe(mine);
  });

  it('pull: he goes into the far window, out of the near one, and lands on your crosshair a stab away, reeling; the window has shut behind him', () => {
    const { R, man, freeze, openAt, press, step, pos, ray } = rig();
    const e = man(V(0, 0, 13.2), 0);
    step(1);
    freeze(e);
    openAt(V(0, 1.5, 12));
    expect(R.plan?.verb).toBe('pull');
    press('hand', Math.ceil((REACH.hand.out + REACH.pull.through + REACH.pull.out) * 60) + 6);
    const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
    expect(d).toBeGreaterThan(REACH.pull.land - 0.3);
    expect(d).toBeLessThan(REACH.knife.melee);
    // on your aim
    expect(Math.abs(e.pos.x - (pos.x + ray.dir.x * d))).toBeLessThan(0.3);
    expect(e.state).toBe('stagger');
    expect(R.win).toBeNull();
  });

  it('pull, then the rifle: the rounds hit him where he lands, double on a reeling man', () => {
    const { R, man, freeze, openAt, press, step, input, aimAt, pos } = rig();
    const r = R.armory.add('rifle', V(0, 0, -20));
    R.armory.give(r, 'player');
    const e = man(V(0, 0, 13.2), 0);
    step(1);
    freeze(e);
    openAt(V(0, 1.5, 12));
    press('hand', Math.ceil((REACH.hand.out + REACH.pull.through + REACH.pull.out) * 60) + 4);
    expect(e.state).toBe('stagger');
    // the crosshair where it was: level, along your aim (over his shoulders: still a hit, he's right there)
    aimAt(V(pos.x, 1.6, pos.z + 30));
    input.fire = true;
    step(Math.ceil(REACH.rifle.interval * 60) * 2 + 2);
    input.fire = false;
    expect(e.alive).toBe(false);
  });

  it('pull, then the knife: one stab up close', () => {
    const { R, man, freeze, openAt, press, step } = rig();
    const k = R.armory.add('knife', V(0, 0, -20));
    R.armory.give(k, 'player');
    const e = man(V(0, 0, 13.2), 0);
    step(1);
    freeze(e);
    openAt(V(0, 1.5, 12));
    press('hand', Math.ceil((REACH.hand.out + REACH.pull.through + REACH.pull.out) * 60) + 4);
    press('fire', 3);
    expect(e.alive).toBe(false);
  });

  it('his rifle out of his hands from behind; from the front, once he has noticed the window, he holds on', () => {
    for (const how of ['behind', 'front'] as const) {
      const { R, man, freeze, openAt, press, step, calls } = rig();
      // facing you (yaw π) or away (yaw 0); the window just past him, on your side of the line
      const e = man(V(0, 0, 13), how === 'front' ? Math.PI : 0);
      step(1);
      freeze(e);
      const w = R.armory.add('rifle', V(9, 0, 9));
      R.armory.give(w, e.id);
      openAt(V(0, 1.5, 11.8));
      if (how === 'front') step(Math.ceil(REACH.notice.time * 60) + 4);
      expect(R.plan?.verb).toBe('disarm');
      press('hand', 30);
      if (how === 'behind') {
        expect(R.armory.heldBy('player'), how).toBe(w);
        expect(calls).toContain('reach.disarm');
      } else {
        expect(R.armory.heldBy(e.id), how).toBe(w);
        expect(calls).toContain('reach.holdsOn');
      }
    }
  });
});

describe('REACH: the weapon through the window', () => {
  it('the knife kills what is right by the far window from behind or the side; a step out of reach it misses; from the front he parries', () => {
    for (const how of ['behind', 'side', 'miss', 'front'] as const) {
      const { R, man, freeze, openAt, press, step, calls } = rig();
      const k = R.armory.add('knife', V(0, 0, -20));
      R.armory.give(k, 'player');
      const z = how === 'miss' ? 14.6 : 13;
      // behind: he looks away from the window (it's at his back); side: across; front: at it
      const yaw = how === 'front' ? Math.PI : how === 'side' ? Math.PI / 2 : 0;
      const e = man(V(0, 0, z), yaw);
      step(1);
      freeze(e);
      openAt(V(0, 1.5, 12));
      press('fire', 20);
      if (how === 'miss') {
        expect(e.alive, how).toBe(true);
        expect(calls).toContain('reach.whiff');
      } else if (how === 'front') {
        expect(e.alive, how).toBe(true);
        expect(e.hp).toBe(REACH.enemy.hp);
        expect(calls).toContain('reach.parried');
      } else expect(e.alive, how).toBe(false);
      step(1);
    }
  });

  it('up close the knife needs no window', () => {
    const { R, man, freeze, press, step, aimAt } = rig();
    const k = R.armory.add('knife', V(0, 0, -20));
    R.armory.give(k, 'player');
    const e = man(V(0, 0, 1.8));
    step(1);
    freeze(e);
    aimAt(e.chest(new THREE.Vector3()));
    press('fire', 4);
    expect(e.alive).toBe(false);
  });

  it('the rifle fired through the near window comes out of the far one; away from it, rounds go as ever', () => {
    const { R, man, freeze, step, input, aimAt, pos } = rig();
    const r = R.armory.add('rifle', V(0, 0, -20));
    R.armory.give(r, 'player');
    // a man off to the side, nowhere near your line of fire
    const e = man(V(10, 0, 14), Math.PI);
    const other = man(V(-8, 0, 12), Math.PI);
    step(1);
    freeze(e);
    freeze(other);
    aimAt(V(0, 1.6, 30));
    // the far window by him, looking the way you look (+z)
    R.openWindow({ pos: V(10, 1.5, 10), look: V(0, 0, 1), surface: 'air', dist: 14, ok: true });
    step(Math.ceil(REACH.window.open * 60) + 2);
    const w = R.win!;
    // straight ahead: the crosshair is on the near window
    aimAt(V(pos.x, w.near.pos.y, pos.z + 5));
    input.fire = true;
    step(2);
    input.fire = false;
    expect(e.hp, 'through the window').toBeLessThan(REACH.enemy.hp);
    // turned to the other man: an ordinary round
    step(20);
    aimAt(other.chest(new THREE.Vector3()));
    input.fire = true;
    step(2);
    input.fire = false;
    expect(other.hp).toBeLessThan(REACH.enemy.hp);
  });

  it('walking into the near window you come out of the far one, your speed kept (the physics does it: it is a rift pair)', () => {
    const { R, rifts, openAt, sc } = rig();
    openAt(V(0, 1.5, 12));
    const w = R.win!;
    const physics = makePhysics(sc.world, rifts);
    const b = physics.createBody('player', { pos: V(0, 0.02, 0), radius: 0.35, height: 1.8 }) as DynBody;
    const crossed: number[] = [];
    const ev: PhysicsEvents = { crossed: () => crossed.push(1), impact: noop, touch: noop, splash: noop, fellOut: noop };
    for (let i = 0; i < 60 && !crossed.length; i++) {
      b.vel.x = 0;
      b.vel.z = 5;
      physics.step(1 / 60, ev, i / 60);
    }
    expect(crossed.length).toBe(1);
    expect(b.pos.distanceTo(V(w.far.pos.x, b.pos.y, w.far.pos.z))).toBeLessThan(1.2);
    // out along the far window's look, still at walking speed
    expect(b.vel.z).toBeGreaterThan(4);
  });
});

describe('REACH: they see your window', () => {
  it('a window opening in front of a man is noticed after a beat; one at his back never is', () => {
    for (const how of ['front', 'back'] as const) {
      const { R, man, freeze, openAt, step } = rig();
      const e = man(V(0, 0, 15), how === 'front' ? Math.PI : 0);
      step(1);
      freeze(e);
      openAt(V(0, 1.5, 11));
      step(Math.ceil(REACH.notice.time * 60) + 3);
      expect(R.win!.noticed.has(e.id), how).toBe(how === 'front');
    }
  });

  it('a rifleman on the far side of your window shoots into it: the laser shows the way, the round comes out of your near window at you', () => {
    const { R, sc, man, openAt, step, rifts, pos } = rig();
    const e = man(V(0, 0, 16), Math.PI);
    step(1);
    const w = R.armory.add('rifle', V(9, 0, 9));
    R.armory.give(w, e.id);
    R.ai.mind(e, Math.random).react = 99;
    // the far window 4 m in front of him, looking at him (mid-air, along your aim)
    openAt(V(0, 1.4, 12));
    expect(R.win!.far.look.z).toBeCloseTo(1, 3);
    sc.log.bolts.length = 0;
    step(Math.ceil((REACH.notice.time + REACH.enemy.rifle.aim) * 60) + 30);
    expect(sc.log.telegraphs.some((t) => t.id === e.id && t.to.distanceTo(V(pos.x, 1.3, pos.z)) < 0.3)).toBe(true);
    const shot = sc.log.bolts.find((b) => b.id === e.id);
    expect(shot).toBeTruthy();
    // its path: into the far window, out of the near one, at your chest
    const segs = rifts.raycastThrough(shot!.from, shot!.dir, 40, sc.world, 1);
    expect(segs.length).toBe(2);
    const out = segs[1];
    const d = new THREE.Vector3().subVectors(out.to, out.from).normalize();
    const toMe = V(pos.x, pos.y + 1.3, pos.z).sub(out.from as THREE.Vector3);
    const miss = toMe.clone().sub(d.clone().multiplyScalar(toMe.dot(d))).length();
    expect(miss).toBeLessThan(0.4);
  });
});

describe('REACH: their portals', () => {
  it('your far window must be by their portal to take it; then its exit goes where you aim', () => {
    const { R, man, freeze, openAt, press, step, input, aimAt } = rig();
    const e = man(V(-4, 0, 14));
    step(1);
    freeze(e);
    const p = R.portals.open(e.id, V(-4, 0, 12.5), 0, V(0, 0, 3), Math.PI);
    openAt(V(-2, 1.5, 9));
    expect(R.plan?.verb).not.toBe('portal');
    step(Math.ceil(REACH.window.cooldown * 60));
    openAt(V(-4, 1.5, 12));
    expect(R.plan?.verb).toBe('portal');
    input.hand = true;
    press('hand', 15);
    expect(p.held).toBe(true);
    aimAt(V(8, 0, 9));
    step(15);
    input.hand = false;
    step(2);
    expect(p.redirected).toBe(true);
    expect(p.b.distanceTo(V(8, 0, 9))).toBeLessThan(1);
  });

  it('the exit up high: he comes out, falls and does not get up; the exit facing a wall: he is slammed into it', () => {
    for (const how of ['high', 'wall', 'void'] as const) {
      const { R, sc, man, freeze, step, marked } = rig({ hole: how === 'void' });
      const e = man(V(-4, 0, 10));
      step(1);
      freeze(e);
      if (how === 'wall') sc.world.add(V(-10, 0, 5.8), V(10, 6, 6.8));
      const exit = how === 'high' ? V(0, 9, 3) : how === 'wall' ? V(0, 0, 4.8) : V(16, 0.4, 10);
      const p = R.portals.open(e.id, V(-4, 0, 11.5), 0, V(0, 0, 3), Math.PI);
      R.ai.mind(e, Math.random).portalId = p.id;
      expect(R.portals.grab(p)).toBe(true);
      R.portals.aim(p, exit, how === 'void' ? Math.PI / 2 : 0);
      R.portals.release(p);
      if (how === 'wall') expect(R.outcomeAt(exit, 0)).toBe('wall');
      if (how === 'high') expect(R.outcomeAt(exit, 0)).toBe('high');
      const hp0 = e.hp;
      const t = sc.until(() => {
        R.update(1 / 60, 1 / 60, { fire: false, firePress: false, window: false, hand: false, handPress: false });
        return how === 'wall' ? e.hp < hp0 : !e.alive;
      }, 8);
      expect(t, how).toBeLessThan(8);
      expect(marked).toContain(e.id);
      expect(R.toolFor({ enemyId: e.id, cause: 'void' } as any)).toBe('redirect');
    }
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
    expect(e.state).toBe('launched');
  });

  it('their portals open REACH.enemy.portal.telegraph s before anyone can use them', () => {
    const P = new RedPortals();
    const p = P.open(1, V(), 0, V(0, 0, 5), 0);
    expect(RedPortals.isOpen(p)).toBe(false);
    P.update(REACH.enemy.portal.telegraph + 0.01, () => true);
    expect(RedPortals.isOpen(p)).toBe(true);
    expect(REACH.enemy.steal.telegraph).toBeCloseTo(0.5, 5);
  });
});

describe('REACH: what you cannot see', () => {
  it('a gun on you from behind, a portal opening off-screen, a thief: arrows at the edge; on screen, none', () => {
    const { R, man, freeze, step } = rig();
    const back = man(V(0, 0, -14), 0);
    const front = man(V(0, 0, 14), Math.PI);
    step(1);
    freeze(back);
    freeze(front);
    for (const e of [back, front]) {
      const w = R.armory.add('rifle', V(30, 0, 30));
      R.armory.give(w, e.id);
      const m = R.ai.mind(e, Math.random);
      m.gun = 'aim';
      m.gunT = 99;
    }
    R.portals.open(back.id, V(-20, 0, -5), 0, V(-12, 0, -6), 0);
    step(1);
    const kinds = R.arrows.map((a) => a.kind);
    expect(kinds).toContain('gun');
    expect(kinds).toContain('portal');
    // one gun (the one behind you): the one in front is on screen
    expect(kinds.filter((k) => k === 'gun')).toHaveLength(1);
    const gun = R.arrows.find((a) => a.kind === 'gun')!;
    expect(gun.urgent).toBe(true);
    expect(Math.sin(gun.ang)).toBeLessThan(0);
  });

  it('a thief: his red window by your hand (MOVE) and an arrow to him', () => {
    const { R, man, freeze, step } = rig();
    const e = man(V(-12, 0, -6), 0);
    step(1);
    freeze(e);
    const w = R.armory.add('rifle', V(0, 0, 0));
    R.armory.give(w, 'player');
    (R.ai as any).steal(e, R.ai.mind(e, Math.random), w, 0.5);
    step(2);
    expect(R.arrows.some((a) => a.kind === 'thief')).toBe(true);
  });

  it('he steals yours: stand still and it is gone; move away (or go through a window) in time and you keep it', () => {
    for (const how of ['stand', 'move', 'portal'] as const) {
      const { R, step, man, freeze, pos, state } = rig();
      const e = man(V(0, 0, 10));
      step(1);
      freeze(e);
      const w = R.armory.add('rifle', V(0, 0, 0));
      R.armory.give(w, 'player');
      (R.ai as any).steal(e, R.ai.mind(e, Math.random), w, 0.5);
      step(10);
      if (how === 'move') pos.x += 3;
      if (how === 'portal') state.crossT = state.time;
      step(40);
      if (how === 'stand') expect(R.armory.heldBy(e.id), how).toBe(w);
      else expect(R.armory.heldBy('player'), how).toBe(w);
    }
  });

  it('on a phone the ghost leans onto the spot behind the man nearest the crosshair (a small radius only)', () => {
    const { R, man, freeze, step, aimAt, input } = rig({ device: 'touch' });
    const e = man(V(0, 0, 14), Math.PI);
    step(1);
    freeze(e);
    aimAt(V(0.3, 1.2, 14));
    input.window = true;
    step(2);
    // behind him (he faces you: his back is further away)
    expect(R.ghost!.pos.z).toBeGreaterThan(14.5);
    aimAt(V(6, 1.2, 14));
    step(2);
    expect(R.ghost!.pos.x).toBeGreaterThan(3);
    input.window = false;
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

  it('the old verbs are off under REACH: no blade or grab prompt, no trap targets', () => {
    setLabActive(true);
    setVariant('reach');
    const g = Object.create(Game.prototype) as any;
    Object.assign(g, { lab: {}, respawnT: -1, player: { body: { pos: V() } } });
    expect(g.contextAction()).toBeNull();
    expect(g.trapTargets()).toEqual([]);
  });

  it('REACH plays its own five waves (3, 4, 5, 6, 8), ~1.3 weapons a fighter, mostly rifles; every other variant keeps its own', () => {
    const a = labArena();
    expect(labWaves(a, 'current')).toBe(a.waves);
    expect(labWaves(a, 'onslaught')).not.toBe(a.waves);
    const R = labWaves(a, 'reach');
    expect(R.map((w) => w.spawns.length)).toEqual([3, 4, 5, 6, 8]);
    expect(labTools('reach')).toEqual(['rifle', 'knife', 'redirect', 'other']);
    for (const w of REACH_WAVES) {
      const fighters = w.spawns.length + 1;
      const n = w.weapons!.length;
      expect(n / fighters).toBeGreaterThanOrEqual(1.2);
      expect(n / fighters).toBeLessThanOrEqual(1.45);
      const rifles = w.weapons!.filter((q) => q.kind === 'rifle').length / n;
      expect(rifles).toBeGreaterThan(0.5);
      expect(rifles).toBeLessThan(0.8);
      expect(w.ready).toBe(true);
      for (const s of w.spawns) expect(s.kind).toBe('rifleman');
    }
    // later waves mix the kinds of man
    expect(new Set(R[4].spawns.map((s) => s.reachRole))).toEqual(new Set(['gunner', 'rusher', 'flanker']));
  });

  it('weapons lie in the open (no cover block on one) and most are contested: about as near them as you', () => {
    const pad = V(0, 0, -24);
    for (const w of REACH_WAVES) {
      let contested = 0;
      for (const q of w.weapons!) {
        const { x, z } = q.pos;
        for (const c of COVER) expect(x > c[0] - 0.5 && x < c[2] + 0.5 && z > c[1] - 0.5 && z < c[3] + 0.5, `${x},${z} on cover`).toBe(false);
        expect(x > POOL.x0 - 0.5 && x < POOL.x1 + 0.5 && z > POOL.z0 - 0.5 && z < POOL.z1 + 0.5, `${x},${z} in the pool`).toBe(false);
        if (q.pos.y === 0) expect(Math.abs(x - RING.cx) < RING.outer + 0.5 && Math.abs(z - RING.cz) < RING.outer + 0.5, `${x},${z} under the ring`).toBe(false);
        const dMe = Math.hypot(q.pos.x - pad.x, q.pos.z - pad.z);
        const dThem = Math.min(...w.spawns.map((s) => Math.hypot(q.pos.x - s.post.x, q.pos.z - s.post.z)));
        if (dThem < dMe * 1.6 && dMe < dThem * 1.6) contested++;
      }
      expect(contested / w.weapons!.length).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('a REACH wave: its men come in at the banner and wait through a short countdown; the fight starts at GO', () => {
    setVariant('reach');
    const arena = labArena();
    arena.variants!.reach!.forEach((w, i) => (w.lead = i === 0 ? REACH.waves.first : REACH.waves.between));
    expect(REACH.waves.first).toBeLessThanOrEqual(3);
    expect(REACH.waves.between).toBeLessThanOrEqual(2.5);
    const spawned: number[] = [];
    let id = 0;
    const d = new LabDirector(arena, { spawn: () => (spawned.push(++id), id), alive: () => true });
    d.start();
    d.update(1);
    expect(d.phase).toBe('breather');
    expect(spawned).toHaveLength(3);
    d.update(REACH.waves.first);
    expect(d.phase).toBe('fight');
  });

  it('every REACH string is in English and Hebrew', () => {
    const en = strings('en'), he = strings('he');
    const keys = Object.keys(en).filter((k) => k.startsWith('reach.') || /^lab\.(r\d|v\.reach|vd\.reach|tool\.(rifle|knife|redirect))$/.test(k) || /^touch\.(weapon|hand|window)$/.test(k));
    expect(keys.length).toBeGreaterThan(50);
    for (const k of keys) {
      expect(he[k], k).toBeTruthy();
      expect(he[k], k).not.toBe(en[k]);
    }
    for (const k of Object.keys(he)) if (k.startsWith('reach.')) expect(en[k], k).toBeTruthy();
    // the old grammar is gone
    for (const k of ['reach.rule.travel', 'reach.rule.race', 'touch.travel', 'reach.verb.snatch']) expect(en[k], k).toBeUndefined();
  });
});
