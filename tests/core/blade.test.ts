import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { CharacterAPI, CharacterPose, EnemyView } from '../../src/core/contracts';
import { FEEL } from '../../src/config';
import { BLADE, HiddenBlade } from '../../src/game/blade';
import { Player, type PlayerEvents, type PlayerInput } from '../../src/game/player';
import { makePhysics, makeRifts, makeWorld, recorder, V } from './helpers';

/** A stand-in enemy: what the blade reads of an EnemyView. */
function fakeEnemy(pos: THREE.Vector3, o: Partial<{ state: EnemyView['state']; zone: string; radius: number }> = {}) {
  return {
    alive: true,
    state: o.state ?? 'idle',
    pos: pos.clone(),
    radius: o.radius ?? 0.42,
    height: 1.8,
    def: { zone: o.zone ?? 'pier' },
    chest(out = new THREE.Vector3()) {
      return out.set(this.pos.x, this.pos.y + 1.3, this.pos.z);
    },
  };
}
type Fake = ReturnType<typeof fakeEnemy>;

function rig(enemies: Fake[], world = makeWorld()) {
  const blade = new HiddenBlade({ world, enemies: enemies as unknown as EnemyView[], live: (e) => e.def.zone === 'pier' });
  return { blade, world };
}

const FWD = V(0, 0, 1);
const BACK = V(0, 0, -1);
const feet = V(0, 0, 0);
/** Who the blade picks (null: nobody), and whether it's a lunge. */
const pickOf = (blade: HiddenBlade, facing = FWD, look = facing) => {
  const t = blade.pick(feet, facing, look);
  return t ? { enemy: t.enemy as unknown as Fake, lunge: t.lunge } : null;
};

describe('hidden blade: who it reaches', () => {
  it('in reach (2 m past his body) from any side, no lunge', () => {
    const e = fakeEnemy(V(0, 0, -(BLADE.reach + 0.42 - 0.05))); // behind you
    const { blade } = rig([e]);
    expect(pickOf(blade)).toEqual({ enemy: e, lunge: false });
  });

  it('a lunge reaches 3.5 m past his body, only ahead of you', () => {
    const e = fakeEnemy(V(0, 0, BLADE.lunge + 0.42 - 0.05));
    const { blade } = rig([e]);
    expect(pickOf(blade)).toEqual({ enemy: e, lunge: true });
    // behind you: out of reach and no lunge
    expect(pickOf(blade, BACK)).toBeNull();
    // ...unless that's where the camera looks
    expect(pickOf(blade, BACK, FWD)).toEqual({ enemy: e, lunge: true });
    // too far
    e.pos.z = BLADE.lunge + 0.42 + 0.05;
    expect(pickOf(blade)).toBeNull();
    // ~50° off your nose is the edge
    const a = Math.acos(BLADE.lungeCone);
    e.pos.set(Math.sin(a - 0.05) * 3.5, 0, Math.cos(a - 0.05) * 3.5);
    expect(pickOf(blade)?.lunge).toBe(true);
    e.pos.set(Math.sin(a + 0.05) * 3.5, 0, Math.cos(a + 0.05) * 3.5);
    expect(pickOf(blade)).toBeNull();
  });

  it('a lunge needs him about level; in reach allows a step up or down', () => {
    const e = fakeEnemy(V(0, BLADE.lungeRise + 0.1, 3.5));
    const { blade, world } = rig([e]);
    world.add(V(-1, 0, 3), V(1, BLADE.lungeRise + 0.1, 4)); // he's on a crate
    expect(pickOf(blade)).toBeNull();
    e.pos.set(0, 1.1, 2);
    expect(pickOf(blade)).toEqual({ enemy: e, lunge: false });
    e.pos.y = BLADE.reachRise + 0.1;
    expect(pickOf(blade)).toBeNull();
  });

  it('never through a wall or a fence; a lunge needs a clear run and floor', () => {
    const e = fakeEnemy(V(0, 0, 1.8));
    const { blade, world } = rig([e]);
    const wall = world.add(V(-2, 0, 0.8), V(2, 3, 1));
    expect(pickOf(blade)).toBeNull();
    wall.enabled = false;
    const fence = world.add(V(-2, 0, 0.8), V(2, 1.5, 1), { seeThrough: true });
    expect(pickOf(blade)).toBeNull();
    fence.enabled = false;
    expect(pickOf(blade)).not.toBeNull();
    // a knee-high rail in the way stops a lunge (not a stab in reach over it)
    e.pos.z = 3.6;
    const rail = world.add(V(-2, 0, 1.5), V(2, 0.7, 1.6));
    expect(pickOf(blade)).toBeNull();
    rail.enabled = false;
    expect(pickOf(blade)?.lunge).toBe(true);
    // a gap in the floor between you
    const w2 = makeWorld(false);
    w2.add(V(-5, -2, -5), V(5, 0, 1.2));
    w2.add(V(-5, -2, 2.8), V(5, 0, 8));
    expect(pickOf(rig([e], w2).blade)).toBeNull();
  });

  it('in reach beats a lunge; then the nearest, favouring the one ahead', () => {
    const lunge = fakeEnemy(V(0, 0, 3));
    const side = fakeEnemy(V(2.2, 0, 0));
    const { blade } = rig([lunge, side]);
    expect(pickOf(blade)?.enemy).toBe(side);
    const ahead = fakeEnemy(V(0, 0, 1.2));
    const behind = fakeEnemy(V(0, 0, -1.1));
    expect(pickOf(rig([behind, ahead]).blade)?.enemy).toBe(ahead);
  });

  it('skips the dead, fights you are not in, and lunges at a body in flight', () => {
    const dead = fakeEnemy(V(0, 0, 1));
    dead.alive = false;
    const away = fakeEnemy(V(0, 0, 1.2), { zone: 'yard' });
    const flying = fakeEnemy(V(0, 0, 3.5), { state: 'launched' });
    const { blade } = rig([dead, away, flying]);
    expect(pickOf(blade)).toBeNull();
    // in reach, a flying man can still be cut
    flying.pos.z = 1.5;
    expect(pickOf(blade)).toEqual({ enemy: flying, lunge: false });
  });
});

describe('hidden blade: timing', () => {
  it('cools down 0.8 s between stabs', () => {
    const e = fakeEnemy(V(0, 0, 1.5));
    const { blade } = rig([e]);
    const t = blade.pick(feet, FWD, FWD)!;
    expect(blade.ready).toBe(true);
    // 1.5 m off: a step in first
    expect(blade.start(t.enemy, feet)).toBe(false);
    expect(blade.lunging!.t).toBeCloseTo((1.5 - 0.42 - BLADE.lungeStop) / BLADE.lungeSpeed + 0.1, 5);
    expect(blade.ready).toBe(false);
    // (you never moved: time's up with him still in reach, so it strikes anyway)
    const dir = V(0, 0, 0);
    let r = blade.update(1 / 60, feet, dir);
    while (r === 'go') r = blade.update(1 / 60, feet, dir);
    expect(r).toBe('strike');
    while (blade.cd > 1 / 120) {
      expect(blade.ready).toBe(false);
      blade.update(1 / 60, feet, dir);
    }
    blade.update(1 / 60, feet, dir);
    expect(blade.ready).toBe(true);
    // right there: it strikes at once, and he's still offered through the cooldown (the press just waits)
    t.enemy.pos.z = 0.9;
    expect(blade.start(t.enemy, feet)).toBe(true);
    expect(blade.lunging).toBeNull();
    expect(blade.ready).toBe(false);
    expect(blade.cd).toBe(BLADE.cooldown);
    expect(blade.pick(feet, FWD, FWD)?.enemy).toBe(t.enemy);
  });

  it('the blade snaps out, holds, and slides back in', () => {
    const { blade } = rig([fakeEnemy(V(0, 0, 0.9))]);
    expect(blade.extension()).toBe(0);
    blade.start(blade.pick(feet, FWD, FWD)!.enemy, feet);
    const dir = V(0, 0, 0);
    blade.update(0.06, feet, dir);
    expect(blade.extension()).toBe(1);
    blade.update(BLADE.show - 0.06 - 0.05, feet, dir);
    expect(blade.extension()).toBeGreaterThan(0);
    expect(blade.extension()).toBeLessThan(1);
    blade.update(0.1, feet, dir);
    expect(blade.extension()).toBe(0);
  });
});

describe('hidden blade: the lunge', () => {
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
  const idle: PlayerInput = { moveX: 0, moveY: 0, camYaw: 0, jump: false, sprint: true, crouch: false, shove: false };

  /** The real player controller lunging as the game drives it; returns how it ended and when. */
  function lungeAt(e: Fake, move: (dt: number) => void = () => {}) {
    const world = makeWorld();
    const phys = makePhysics(world, makeRifts(world));
    const body = phys.createBody('player', { pos: V(0, 0, 0), radius: FEEL.playerRadius, height: FEEL.playerHeight });
    body.userData.manual = true;
    body.onGround = true;
    const player = new Player(stubChar(), body);
    let steps = 0;
    const ev: PlayerEvents = { footstep: () => steps++, jumped() {}, landed() {}, fallDamage() {}, shoved() {}, crossed() {} };
    const blade = new HiddenBlade({ world, enemies: [e as unknown as EnemyView], live: () => true });
    const t = blade.pick(body.pos, player.forward(V(0, 0, 0)), FWD)!;
    expect(blade.start(t.enemy, body.pos)).toBe(false);
    player.lunge(V(e.pos.x, 0, e.pos.z), BLADE.lungeSpeed, blade.lunging!.t);
    const dir = V(0, 0, 0);
    const dt = 1 / 60;
    for (let i = 1; i <= 60; i++) {
      move(dt);
      player.update(dt, idle, world, phys, recorder(), ev, i * dt);
      const r = blade.update(dt, body.pos, dir);
      if (r === 'go') player.lunge(dir, BLADE.lungeSpeed, blade.lunging!.t);
      else if (r) {
        player.endLunge();
        return { r, t: i * dt, player, steps };
      }
    }
    return { r: null, t: Infinity, player, steps };
  }

  it('steps in on a man in reach before the blade lands', () => {
    const e = fakeEnemy(V(0, 0, -2.3)); // in reach, behind you
    const { r, t, player } = lungeAt(e);
    expect(r).toBe('strike');
    expect(t).toBeLessThan(0.15);
    expect(Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z)).toBeLessThan(e.radius + BLADE.lungeStop + 0.3);
  });

  it('closes a 3.5 m gap in about a fifth of a second, silently, and strikes', () => {
    const e = fakeEnemy(V(0.5, 0, 3.8));
    const { r, t, player, steps } = lungeAt(e);
    expect(r).toBe('strike');
    expect(t).toBeLessThan(0.3);
    const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
    expect(d).toBeLessThan(e.radius + BLADE.lungeStop + 0.3);
    expect(d).toBeGreaterThan(e.radius + FEEL.playerRadius);
    expect(player.lunging).toBe(false);
    expect(Math.hypot(player.vel.x, player.vel.z)).toBe(0);
    // sprint held, yet no footsteps to hear
    expect(steps).toBe(0);
    // facing him
    expect(player.yaw).toBeCloseTo(Math.atan2(e.pos.x, e.pos.z), 1);
  });

  it('steers onto a man walking across, and misses one who got away', () => {
    const walker = fakeEnemy(V(0, 0, 3.6));
    expect(lungeAt(walker, (dt) => (walker.pos.x += 3.4 * dt)).r).toBe('strike');
    const flung = fakeEnemy(V(0, 0, 3.6));
    const { r, t } = lungeAt(flung, (dt) => (flung.pos.z += 20 * dt));
    expect(r).toBe('miss');
    expect(t).toBeLessThanOrEqual(BLADE.lungeTime + 0.02);
  });
});
