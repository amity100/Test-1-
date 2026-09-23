import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { CharacterAPI, CharacterPose, ClipName, RiftEnd } from '../../src/core/contracts';
import { LAW } from '../../src/core/contracts';
import { FEEL } from '../../src/config';
import { Player, PlayerEvents, PlayerInput } from '../../src/game/player';
import { frame, makePhysics, makeRifts, makeWorld, recorder, V } from './helpers';

function stubChar() {
  const plays: ClipName[] = [];
  const char: CharacterAPI = {
    root: new THREE.Group(),
    update() {},
    play(n) {
      plays.push(n);
    },
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
  return { char, plays };
}

function events() {
  const log = {
    steps: 0,
    jumps: 0,
    landed: [] as { speed: number; charged: boolean }[],
    damage: [] as number[],
    shoves: 0,
    crossed: [] as { from: RiftEnd; to: RiftEnd; yawDelta: number; speed: number }[],
  };
  const ev: PlayerEvents = {
    footstep: () => log.steps++,
    jumped: () => log.jumps++,
    landed: (_p, speed, charged) => log.landed.push({ speed, charged }),
    fallDamage: (a) => log.damage.push(a),
    shoved: () => log.shoves++,
    crossed: (from, to, yawDelta, speed) => log.crossed.push({ from, to, yawDelta, speed }),
  };
  return { ev, log };
}

const idle = (): PlayerInput => ({ moveX: 0, moveY: 0, camYaw: 0, jump: false, sprint: false, crouch: false, shove: false });

function setup(world = makeWorld()) {
  const rifts = makeRifts(world);
  const phys = makePhysics(world, rifts);
  const body = phys.createBody('player', { pos: V(0, 0, 0), radius: FEEL.playerRadius, height: FEEL.playerHeight });
  body.userData.manual = true;
  const { char, plays } = stubChar();
  const player = new Player(char, body);
  const pev = recorder();
  const { ev, log } = events();
  let t = 0;
  const run = (seconds: number, input: (i: number) => PlayerInput = idle, dt = 1 / 60) => {
    const n = Math.round(seconds / dt);
    for (let i = 0; i < n; i++) {
      t += dt;
      player.update(dt, input(i), world, phys, pev, ev, t);
      phys.step(dt, pev, t);
    }
  };
  return { world, rifts, phys, player, body, plays, pev, log, run };
}

describe('Player', () => {
  it('walks camera-relative, sprints faster, leaves footsteps', () => {
    const { player, run, log } = setup();
    run(1, () => ({ ...idle(), moveY: 1, camYaw: Math.PI / 2 }));
    expect(player.pos.x).toBeGreaterThan(2.5);
    expect(Math.abs(player.pos.z)).toBeLessThan(0.05);
    expect(player.yaw).toBeCloseTo(Math.PI / 2, 1);
    const x = player.pos.x;
    run(1, () => ({ ...idle(), moveY: 1, camYaw: Math.PI / 2, sprint: true }));
    expect(player.pos.x - x).toBeGreaterThan(5);
    expect(log.steps).toBeGreaterThan(4);
    expect(player.body.userData.manual).toBe(true);
  });

  it('jumps and lands, mantles a waist-high box', () => {
    const world = makeWorld();
    world.add(V(-1, 0, 1.2), V(1, 1.4, 3));
    const { player, run, log, plays } = setup(world);
    run(0.2);
    player.yaw = Math.PI; // back to the box: a plain jump
    run(1 / 60, () => ({ ...idle(), jump: true, camYaw: Math.PI }));
    expect(log.jumps).toBe(1);
    expect(player.airborne).toBe(true);
    run(1);
    expect(player.airborne).toBe(false);
    expect(plays).toContain('jumpStart');
    // facing the box (+Z): jump mantles onto it
    player.yaw = 0;
    run(1 / 60, () => ({ ...idle(), jump: true }));
    expect(player.isMantling()).toBe(true);
    run(0.8);
    expect(player.pos.y).toBeCloseTo(1.4, 3);
    expect(player.pos.z).toBeGreaterThan(1.2);
  });

  it('uncharged falls hurt: (v - 14) * 9', () => {
    const { player, run, log } = setup();
    player.teleport(V(0, 20, 0));
    run(2.5);
    expect(log.landed.length).toBe(1);
    const v = log.landed[0].speed;
    expect(v).toBeGreaterThan(28);
    expect(log.landed[0].charged).toBe(false);
    expect(log.damage.length).toBe(1);
    expect(log.damage[0]).toBeCloseTo((v - LAW.player.uncharged.hurtFrom) * LAW.player.uncharged.perMs, 5);
  });

  it('charged landings never hurt, and roll', () => {
    const { rifts, player, run, log, plays, body } = setup();
    rifts.addGate('t', frame(V(0, 0.01, 0), V(0, 1, 0), 'floor'), frame(V(30, 12, 0), V(0, -1, 0), 'air'));
    run(2.5);
    expect(log.crossed.length).toBe(1);
    expect(log.landed.length).toBe(1);
    expect(log.landed[0].charged).toBe(true);
    expect(log.landed[0].speed).toBeGreaterThan(15);
    expect(log.damage.length).toBe(0);
    expect(plays).toContain('roll');
    expect(body.charge).toBe(0);
    expect(player.pos.x).toBeGreaterThan(28);
  });

  it('walking through a door turns you to the exit direction and reports the yaw change', () => {
    const { rifts, player, run, log } = setup();
    rifts.addGate('d', frame(V(0, 1.145, 3), V(0, 0, -1), 'stand'), frame(V(20, 1.145, 0), V(1, 0, 0), 'stand'));
    run(2, () => ({ ...idle(), moveY: 1 }));
    expect(log.crossed.length).toBe(1);
    expect(log.crossed[0].yawDelta).toBeCloseTo(Math.PI / 2, 1);
    expect(player.pos.x).toBeGreaterThan(20);
  });

  it('flying out of a rift: no input keeps the momentum (honest air control)', () => {
    const world = makeWorld();
    world.add(V(30, 0, -5), V(31, 40, 5));
    const { rifts, player, run, log, body } = setup(world);
    rifts.addGate('fling', frame(V(0, 0.01, 0), V(0, 1, 0), 'floor'), frame(V(30, 20, 0), V(-1, 0, 0), 'wall'));
    player.teleport(V(0, 6, 0));
    run(0.9, idle);
    expect(log.crossed.length).toBe(1);
    const sp = log.crossed[0].speed;
    // a moment later, horizontal speed is still what came out of the wall
    expect(Math.abs(body.vel.x + sp)).toBeLessThan(0.5);
    // steering against it barely helps while charged
    const vx = body.vel.x;
    run(0.2, () => ({ ...idle(), moveY: 1, camYaw: Math.PI / 2 }));
    expect(body.vel.x - vx).toBeLessThan(1.5);
  });

  it('shove dashes ~4 m and has a cooldown', () => {
    const { player, run, log, plays } = setup();
    run(0.2);
    const z0 = player.pos.z;
    run(1 / 60, () => ({ ...idle(), shove: true }));
    run(0.4);
    expect(log.shoves).toBe(1);
    expect(plays).toContain('push');
    expect(player.pos.z - z0).toBeGreaterThan(3.3);
    expect(player.pos.z - z0).toBeLessThan(4.8);
    expect(player.shoveCooldown).toBeGreaterThan(0);
    run(1 / 60, () => ({ ...idle(), shove: true }));
    expect(log.shoves).toBe(1);
  });

  it('teleport clears momentum and charge', () => {
    const { player, body } = setup();
    body.vel.set(10, 5, 0);
    body.charge = 1;
    player.teleport(V(3, 1, 3), 1);
    expect(body.vel.length()).toBe(0);
    expect(body.charge).toBe(0);
    expect(player.yaw).toBe(1);
    expect(player.lastSafe.equals(V(3, 1, 3))).toBe(true);
  });
});
