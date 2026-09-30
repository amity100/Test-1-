import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Game } from '../../src/game/game';
import { setLabActive, setVariant, type CombatVariant } from '../../src/game/variant';
import { V } from './helpers';

/**
 * ONSLAUGHT's glue in the Game (the blow a DODGE slips, the opening a whiff
 * leaves), on a bare Game: only the fields its hooks read are stubbed in.
 */
function bare(fields: Record<string, unknown>) {
  const g = Object.create(Game.prototype);
  Object.assign(g, fields);
  return g as any;
}
const noop = () => {};
const sink = new Proxy({}, { get: () => noop });

function rig(variant: CombatVariant, dodging: boolean) {
  setLabActive(true);
  setVariant(variant);
  const g = bare({
    time: 10,
    hp: 100,
    respawnT: -1,
    guardUntil: -1,
    dodgeSafeUntil: dodging ? 10.2 : -1,
    lastHurtT: -99,
    lab: null,
    exposedUntil: new Map(),
    rig: { shake: 0 },
    hud: sink,
    audio: sink,
    fx: sink,
    push: noop,
    player: { body: { pos: V(0, 0, 0), vel: V(0, 0, 0), onGround: true }, char: { die: noop } },
  });
  return { g, hooks: g.enemyHooks() };
}

const man = { id: 3, pos: V(0, 0, 2), chest: (o = new THREE.Vector3()) => o.set(0, 1.3, 2) } as any;

afterEach(() => {
  setVariant('current');
  setLabActive(false);
});

describe('ONSLAUGHT: the Game glue', () => {
  it('a blow during a DODGE is slipped whole in ONSLAUGHT (no hurt, no shove)', () => {
    const { g, hooks } = rig('onslaught', true);
    hooks.melee(man, 25, V(0, 3, 8));
    expect(g.hp).toBe(100);
    expect(g.player.body.vel.length()).toBe(0);
  });

  it('PRECISION and CURRENT keep their old rule (the dodge takes the hurt, the shove still lands)', () => {
    for (const v of ['precision', 'current'] as const) {
      const { g, hooks } = rig(v, true);
      hooks.melee(man, 25, V(0, 3, 8));
      expect(g.hp, v).toBe(100);
      expect(g.player.body.vel.z, v).toBe(8);
    }
  });

  it('a blow that lands hurts as always', () => {
    const { g, hooks } = rig('onslaught', false);
    hooks.melee(man, 25, V(0, 3, 8));
    expect(g.hp).toBe(75);
  });

  it('a whiff marks him open for the blade (the finisher reads exposedUntil)', () => {
    const { g, hooks } = rig('onslaught', false);
    hooks.opening(man, 0.8);
    expect(g.exposedUntil.get(3)).toBeCloseTo(10.8, 5);
    // a shorter opening never cuts a longer one short
    hooks.opening(man, 0.2);
    expect(g.exposedUntil.get(3)).toBeCloseTo(10.8, 5);
  });
});
