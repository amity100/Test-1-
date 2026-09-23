import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { ActorHit, Projectile, ProjectileHooks, RiftEnd } from '../../src/core/contracts';
import { LAW } from '../../src/core/contracts';
import type { RayHit } from '../../src/world/collision';
import { Projectiles } from '../../src/sim/projectiles';
import { frame, makePhysics, makeRifts, makeWorld, recorder, V } from './helpers';

interface Actor {
  key: string;
  center: THREE.Vector3;
  r: number;
  res: 'stop' | 'pass';
}

function hooks(actors: Actor[] = []) {
  const log = {
    hits: [] as { key: string; charged: boolean; kind: string }[],
    world: [] as { hit: RayHit; charged: boolean }[],
    cross: [] as { p: Projectile; from: RiftEnd; to: RiftEnd }[],
    boom: [] as { p: Projectile; at: THREE.Vector3; charged: boolean }[],
  };
  const h: ProjectileHooks = {
    hitTest(a, b, radius) {
      let best: ActorHit | null = null;
      let bestT = Infinity;
      const ab = b.clone().sub(a);
      const len2 = ab.lengthSq();
      for (const ac of actors) {
        const t = len2 > 0 ? THREE.MathUtils.clamp(ac.center.clone().sub(a).dot(ab) / len2, 0, 1) : 0;
        const p = a.clone().addScaledVector(ab, t);
        if (p.distanceTo(ac.center) < ac.r + radius && t < bestT) {
          bestT = t;
          best = { key: ac.key, point: p, normal: p.clone().sub(ac.center).normalize() };
        }
      }
      return best;
    },
    onHitActor(p, hit) {
      log.hits.push({ key: hit.key, charged: p.charged, kind: p.kind });
      return actors.find((a) => a.key === hit.key)!.res;
    },
    onHitWorld(p, hit) {
      log.world.push({ hit, charged: p.charged });
    },
    onExplode(p, at) {
      log.boom.push({ p, at: at.clone(), charged: p.charged });
    },
    onCross(p, from, to) {
      log.cross.push({ p, from, to });
    },
  };
  return { h, log };
}

/** Door 5 m ahead (+Z) facing back at the origin; its partner 20 m to the side, facing +X; a wall at x = 40. */
function setup(actors: Actor[] = []) {
  const world = makeWorld();
  const wall = world.add(V(40, 0, -5), V(41, 10, 5));
  const rifts = makeRifts(world);
  rifts.addGate('g', frame(V(0, 1.15, 5), V(0, 0, -1), 'stand'), frame(V(20, 1.15, 0), V(1, 0, 0), 'stand'));
  const phys = makePhysics(world, rifts);
  const { h, log } = hooks(actors);
  const proj = new Projectiles(world, rifts, phys, h);
  return { world, wall, rifts, phys, proj, log };
}

function tick(proj: Projectiles, seconds: number, t0 = 0, dt = 1 / 60) {
  let t = t0;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    t += dt;
    proj.update(dt, t);
  }
  return t;
}

describe('projectiles', () => {
  it('a bolt crossing a rift becomes charged and changes direction', () => {
    const { proj, log, wall } = setup();
    const p = proj.fireBolt(V(0, 1.5, 0), V(0, 0, 1), 'kessler', 3);
    expect(p.charged).toBe(false);
    tick(proj, 0.3);
    expect(p.charged).toBe(true);
    expect(p.crossings).toBe(1);
    expect(p.vel.x).toBeCloseTo(LAW.bolt.speed, 3);
    expect(Math.abs(p.vel.z)).toBeLessThan(1e-6);
    expect(p.pos.x).toBeGreaterThan(20);
    expect(log.cross.length).toBe(1);
    expect(p.lastEndId).toBe(log.cross[0].to.id);
    tick(proj, 1.5, 0.3);
    expect(p.alive).toBe(false);
    expect(log.world.length).toBe(1);
    expect(log.world[0].hit.collider).toBe(wall);
    expect(log.world[0].charged).toBe(true);
    expect(proj.list.length).toBe(0);
  });

  it('bolts pass uncharged through actors that say pass, and can hit them again once charged', () => {
    const shooter: Actor = { key: 'enemy:1', center: V(0, 1.5, 1), r: 0.4, res: 'pass' };
    const target: Actor = { key: 'enemy:2', center: V(30, 1.5, 0), r: 0.4, res: 'stop' };
    const { proj, log } = setup([shooter, target]);
    const p = proj.fireBolt(V(0, 1.5, 0), V(0, 0, 1), 'kessler', 1);
    tick(proj, 1);
    expect(log.hits.map((h) => h.key)).toEqual(['enemy:1', 'enemy:2']);
    expect(log.hits[0].charged).toBe(false);
    expect(log.hits[1].charged).toBe(true);
    expect(p.alive).toBe(false);
    expect(p.pos.x).toBeLessThan(30);
  });

  it('bullet cage: a bolt looping between a floor hole and a hatch stays alive past its life', () => {
    const world = makeWorld();
    const rifts = makeRifts(world);
    rifts.addGate('cage', frame(V(0, 0.01, 0), V(0, 1, 0), 'floor'), frame(V(0, 6, 0), V(0, -1, 0), 'air'));
    const phys = makePhysics(world, rifts);
    const { h, log } = hooks();
    const proj = new Projectiles(world, rifts, phys, h);
    const p = proj.fireBolt(V(0, 3, 0), V(0, -1, 0), 'kessler', 1);
    tick(proj, 5);
    expect(p.alive).toBe(true);
    expect(p.loops).toBeGreaterThan(10);
    expect(p.life).toBe(10);
    expect(log.world.length).toBe(0);
    tick(proj, 6, 5);
    expect(p.alive).toBe(false);
  });

  it('a grenade thrown through a rift is charged when it goes off', () => {
    const { proj, phys, log } = setup();
    const ev = recorder();
    const g = proj.throwGrenade(V(0, 1.5, 0), V(0, 1.5, 8), 'kessler', 2);
    expect(phys.bodies).toContain(g.body);
    let t = 0;
    for (let i = 0; i < 150; i++) {
      t += 1 / 60;
      phys.step(1 / 60, ev, t);
      proj.update(1 / 60, t);
    }
    expect(log.cross.length).toBe(1);
    expect(log.boom.length).toBe(1);
    expect(log.boom[0].charged).toBe(true);
    expect(log.boom[0].at.x).toBeGreaterThan(20);
    expect(g.alive).toBe(false);
    expect(phys.bodies.length).toBe(0);
  });

  it('beams follow rifts; the charged segment damages each actor once', () => {
    const victim: Actor = { key: 'enemy:5', center: V(30, 1.5, 0), r: 0.4, res: 'pass' };
    const { proj, log } = setup([victim]);
    const b = proj.fireBeam(V(0, 1.5, 0), V(0, 0, 1), 'kessler', 9);
    expect(b.segments.length).toBe(2);
    tick(proj, 0.2);
    expect(b.alive).toBe(true);
    expect(log.hits).toEqual([{ key: 'enemy:5', charged: true, kind: 'beam' }]);
    expect(log.cross.length).toBe(1);
    expect(log.world.length).toBe(1);
    tick(proj, 0.3, 0.2);
    expect(b.alive).toBe(false);
    expect(log.hits.length).toBe(1);
  });

  it('a beam stopped by an actor ends at him', () => {
    const shield: Actor = { key: 'enemy:6', center: V(25, 1.5, 0), r: 0.4, res: 'stop' };
    const { proj, log } = setup([shield]);
    const b = proj.fireBeam(V(0, 1.5, 0), V(0, 0, 1), 'kessler', 9);
    expect(b.segments[1].to.x).toBeCloseTo(25, 5);
    tick(proj, 0.2);
    expect(log.hits.length).toBe(1);
    expect(b.segments[1].to.x).toBeCloseTo(25, 5);
  });

  it('CATCH: a bolt aimed at the player enters the catch door and leaves the exit charged', () => {
    const world = makeWorld();
    world.add(V(-10, 0, 20), V(10, 30, 21), { tag: 'wall' });
    const rifts = makeRifts(world);
    const eye = V(0, 1.7, 0);
    rifts.placeExit(rifts.aimExit(eye, V(0, 0.2, 1).normalize(), eye, V(0, 0, 0), false, []));
    const shooterAt = V(15, 1.4, 0);
    const res = rifts.openEntrance({
      playerFeet: V(0, 0, 0),
      playerVel: V(0, 0, 0),
      playerYaw: 0,
      airborne: false,
      camPos: V(0, 1.7, -2.5),
      camDir: V(0, 0, 1),
      threats: [{ kind: 'laser', from: shooterAt, eta: 0.6 }],
      targets: [],
    });
    expect(res.mode).toBe('catch');
    const phys = makePhysics(world, rifts);
    const { h, log } = hooks();
    const proj = new Projectiles(world, rifts, phys, h);
    const p = proj.fireBolt(shooterAt, V(0, 1.2, 0).sub(shooterAt).normalize(), 'kessler', 4);
    tick(proj, 0.8);
    expect(log.cross.length).toBe(1);
    expect(log.cross[0].to).toBe(rifts.playerEnds().exit);
    expect(p.charged).toBe(true);
    expect(p.vel.z).toBeLessThan(-LAW.bolt.speed * 0.9); // out of the wall exit, back toward the player's side
  });

  it('clear() removes everything, grenade bodies included', () => {
    const { proj, phys } = setup();
    proj.fireBolt(V(0, 1.5, 0), V(1, 0, 0), 'kessler', 1);
    proj.throwGrenade(V(0, 1.5, 0), V(1, 2, 0), 'kessler', 1);
    proj.fireBeam(V(0, 1.5, 0), V(-1, 0, 0), 'kessler', 1);
    proj.update(1 / 60, 1 / 60);
    expect(proj.list.length).toBe(3);
    proj.clear();
    expect(proj.list.length).toBe(0);
    expect(phys.bodies.length).toBe(0);
  });
});
