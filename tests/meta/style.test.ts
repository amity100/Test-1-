import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { AirEvent, CrossEvent, KillEvent, KnockEvent, TrickAward, TrickId } from '../../src/core/contracts';
import { StyleSystem, STYLE_TUNING, TRICK_POINTS, RANKS } from '../../src/meta/style';

function kill(o: Partial<KillEvent> = {}): KillEvent {
  return {
    type: 'kill', t: 0, enemyId: 1, enemyKind: 'rifleman', cause: 'impact', charged: true, speed: 0,
    fallHeight: 0, killerCrossings: 0, killerLoops: 0, victimCrossings: 0, ownShot: false, shotBy: null,
    projectileKind: null, turretShot: false, shotAge: 1, unaware: false, witnessed: true, viaTrapdoor: false,
    matador: false, byBody: false, byProp: false, byBarrel: false, byPlayer: false, playerFling: false,
    playerAirborne: false, impactorId: null, at: new THREE.Vector3(1, 2, 3), ...o,
  };
}

function cross(t: number, loops: number, who: CrossEvent['who'] = 'prop'): CrossEvent {
  return { type: 'cross', t, who, speed: 20, loops, fromKind: 'floor', toKind: 'ceiling' };
}

function air(seconds: number, crossings: number, t = 10): AirEvent {
  return { type: 'air', t, phase: 'end', seconds, crossings };
}

function knock(t: number, enemyId: number, impactorId: number | null): KnockEvent {
  return { type: 'knock', t, enemyId, cause: 'impact', impactorId, at: new THREE.Vector3() };
}

const ids = (a: TrickAward[]) => a.map((x) => x.id);

/** One kill on a fresh system. */
function one(o: Partial<KillEvent>): TrickId[] {
  return ids(new StyleSystem().push(kill(o)));
}

describe('trick detection', () => {
  it('RETURN TO SENDER: killed by his own charged bolt', () => {
    const s = new StyleSystem();
    const a = s.push(kill({ ownShot: true, projectileKind: 'bolt', shotAge: 1.2 }));
    expect(ids(a)).toEqual(['returnToSender']);
    expect(a[0].points).toBe(300);
    expect(a[0].key).toBe('trick.returnToSender');
    expect(a[0].t).toBe(0);
    expect(a[0].at?.toArray()).toEqual([1, 2, 3]);
  });

  it('award `at` is a copy, not the event vector', () => {
    const at = new THREE.Vector3(5, 5, 5);
    const a = new StyleSystem().push(kill({ ownShot: true, at }));
    at.set(0, 0, 0);
    expect(a[0].at?.x).toBe(5);
  });

  it('MIRROR: own shot within 0.35 s (also RETURN TO SENDER)', () => {
    expect(one({ ownShot: true, projectileKind: 'bolt', shotAge: 0.3 })).toEqual(['returnToSender', 'mirror']);
    expect(one({ ownShot: true, projectileKind: 'bolt', shotAge: 0.35 })).toContain('mirror');
    expect(one({ ownShot: true, projectileKind: 'bolt', shotAge: 0.36 })).not.toContain('mirror');
  });

  it('CROSSFIRE: charged bolt fired by another enemy', () => {
    expect(one({ shotBy: 7, projectileKind: 'bolt' })).toEqual(['crossfire']);
    expect(one({ shotBy: 1, enemyId: 1, projectileKind: 'bolt' })).toEqual([]);
    // Turret rounds are BORROWED GUN, not crossfire.
    expect(one({ shotBy: 7, projectileKind: 'bolt', turretShot: true })).toEqual(['borrowedGun']);
  });

  it('POSTAGE: charged grenade only', () => {
    expect(one({ projectileKind: 'grenade', charged: true })).toEqual(['postage']);
    expect(one({ projectileKind: 'grenade', charged: false })).toEqual([]);
    // Another grenadier's grenade is POSTAGE, not CROSSFIRE.
    expect(one({ projectileKind: 'grenade', charged: true, shotBy: 4 })).toEqual(['postage']);
  });

  it('FIRING LINE: charged beam only', () => {
    expect(one({ projectileKind: 'beam', charged: true })).toEqual(['firingLine']);
    expect(one({ projectileKind: 'beam', charged: false })).toEqual([]);
  });

  it('BORROWED GUN: turret round', () => {
    const a = new StyleSystem().push(kill({ turretShot: true, projectileKind: 'bolt' }));
    expect(ids(a)).toEqual(['borrowedGun']);
    expect(a[0].points).toBe(300);
  });

  it('TRAPDOOR + SPLASHDOWN + GHOST stack on one kill', () => {
    const a = new StyleSystem().push(kill({ viaTrapdoor: true, cause: 'water', unaware: true, witnessed: false, victimCrossings: 1 }));
    expect(ids(a)).toEqual(['trapdoor', 'splashdown', 'ghost']);
    expect(a.map((x) => x.points)).toEqual([200, 200, 150]);
  });

  it('SPLASHDOWN / INTO THE VOID need a rift first', () => {
    expect(one({ cause: 'water', victimCrossings: 1, charged: false })).toEqual(['splashdown']);
    expect(one({ cause: 'water', victimCrossings: 0, charged: false })).toEqual([]);
    expect(one({ cause: 'void', victimCrossings: 2, charged: false })).toEqual(['void']);
    expect(one({ cause: 'void', victimCrossings: 0, charged: false })).toEqual([]);
    expect(one({ cause: 'void', victimCrossings: 0, charged: true })).toEqual(['void']);
  });

  it('SKYFALL: fall kill from 10 m or more', () => {
    expect(one({ cause: 'fall', fallHeight: 12, victimCrossings: 1 })).toEqual(['skyfall']);
    expect(one({ cause: 'fall', fallHeight: 10 })).toEqual(['skyfall']);
    expect(one({ cause: 'fall', fallHeight: 9.9 })).toEqual([]);
    expect(one({ cause: 'impact', fallHeight: 20 })).toEqual([]);
  });

  it('MATADOR: the charge into your entrance is the trick; what kills him scores on its own', () => {
    expect(ids(new StyleSystem().push({ type: 'matador', t: 0, at: new THREE.Vector3() }))).toEqual(['matador']);
    expect(one({ matador: true, enemyKind: 'brute', cause: 'impact' })).toEqual([]);
    expect(one({ matador: true, enemyKind: 'brute', cause: 'water', victimCrossings: 1 })).toEqual(['splashdown']);
  });

  it('STRIKE kills name the strike, not TRAPDOOR', () => {
    expect(one({ strike: 'geyser', viaTrapdoor: true, cause: 'water', victimCrossings: 1 })).toEqual(['geyser', 'splashdown']);
    expect(one({ strike: 'cannon', viaTrapdoor: true, cause: 'fall', fallHeight: 14 })).toEqual(['humanCannon', 'skyfall']);
    expect(one({ strike: 'swap', cause: 'bolt' })).toEqual(['swap']);
    expect(one({ strike: 'dash', cause: 'impact', byPlayer: true })).toEqual(['dash']);
    expect(one({ strike: 'loop', viaTrapdoor: true, cause: 'fall', fallHeight: 3 })).toEqual([]);
  });

  it('RETURN TO SENDER is for bolts (his own beam is FIRING LINE only)', () => {
    expect(one({ ownShot: true, projectileKind: 'beam', charged: true, cause: 'beam', shotAge: 0.1 })).toEqual(['firingLine']);
    expect(one({ ownShot: true, projectileKind: 'bolt', charged: true, cause: 'bolt', shotAge: 1 })).toEqual(['returnToSender']);
  });

  it('HEADS UP: killed by a launched body', () => {
    expect(one({ byBody: true, impactorId: 5 })).toEqual(['headsUp']);
  });

  it('BOWLING: one impactor knocks/kills 2+ within 0.8 s, once', () => {
    const s = new StyleSystem();
    expect(ids(s.push(knock(0, 2, 9)))).toEqual([]);
    const a = s.push(kill({ t: 0.5, enemyId: 3, byBody: true, impactorId: 9 }));
    expect(ids(a)).toContain('bowling');
    // A third victim doesn't bowl again.
    const b = s.push(kill({ t: 0.9, enemyId: 4, byBody: true, impactorId: 9 }));
    expect(ids(b)).not.toContain('bowling');
  });

  it('BOWLING: the same victim twice or hits too far apart do not count', () => {
    const s = new StyleSystem();
    s.push(knock(0, 2, 9));
    expect(ids(s.push(kill({ t: 0.3, enemyId: 2, byBody: true, impactorId: 9 })))).not.toContain('bowling');
    const s2 = new StyleSystem();
    s2.push(knock(0, 2, 9));
    expect(ids(s2.push(knock(1.0, 3, 9)))).toEqual([]);
    // Knocks alone can bowl too.
    const s3 = new StyleSystem();
    s3.push(knock(0, 2, 9));
    expect(ids(s3.push(knock(0.7, 3, 9)))).toEqual(['bowling']);
    // Props bowl as well.
    const s4 = new StyleSystem();
    s4.push(kill({ t: 0, enemyId: 2, byProp: true, impactorId: 50 }));
    expect(ids(s4.push(kill({ t: 0.2, enemyId: 3, byProp: true, impactorId: 50 })))).toContain('bowling');
  });

  it('CANNONBALL: killer looped at least twice', () => {
    expect(one({ killerLoops: 2 })).toEqual(['cannonball']);
    expect(one({ killerLoops: 1 })).toEqual([]);
  });

  it('SLINGSHOT and COMET: the player body', () => {
    expect(one({ byPlayer: true, playerFling: true, speed: 14 })).toEqual(['slingshot']);
    expect(one({ byPlayer: true, speed: 18 })).toEqual(['comet']);
    expect(one({ byPlayer: true, speed: 17.9 })).toEqual([]);
    expect(one({ byPlayer: true, playerFling: true, speed: 25 })).toEqual(['slingshot', 'comet']);
    expect(one({ byPlayer: false, playerFling: true, speed: 25 })).toEqual([]);
  });

  it('GUILLOTINE, CARGO, BOOM, FINISHER', () => {
    expect(one({ cause: 'shear' })).toEqual(['guillotine']);
    expect(one({ byProp: true })).toEqual(['cargo']);
    expect(one({ byBarrel: true, byProp: true, cause: 'explosion' })).toEqual(['boom']);
    expect(one({ cause: 'blade' })).toEqual(['finisher']);
  });

  it('BOOM once per explosion; extra victims score the multi-kill', () => {
    const s = new StyleSystem();
    expect(ids(s.push(kill({ t: 1, enemyId: 1, byBarrel: true, cause: 'explosion' })))).toEqual(['boom']);
    expect(ids(s.push(kill({ t: 1.05, enemyId: 2, byBarrel: true, cause: 'explosion' })))).toEqual(['double']);
    // A second barrel later is a new BOOM.
    expect(ids(s.push(kill({ t: 3, enemyId: 3, byBarrel: true, cause: 'explosion' })))).toEqual(['boom']);
  });

  it('GHOST only when unaware and unseen', () => {
    expect(one({ unaware: true, witnessed: false })).toEqual(['ghost']);
    expect(one({ unaware: true, witnessed: true })).toEqual([]);
    expect(one({ unaware: false, witnessed: false })).toEqual([]);
  });

  it('JUGGLE: victim crossed 3+ rifts', () => {
    expect(one({ victimCrossings: 3 })).toEqual(['juggle']);
    expect(one({ victimCrossings: 2 })).toEqual([]);
  });

  it('HIJACK from the simple event', () => {
    const a = new StyleSystem().push({ type: 'hijack', t: 4, at: new THREE.Vector3(1, 0, 1) });
    expect(ids(a)).toEqual(['hijack']);
    expect(a[0].points).toBe(300);
  });

  it('events that are not tricks award nothing', () => {
    const s = new StyleSystem();
    expect(s.push({ type: 'catch', t: 0, count: 1 })).toEqual([]);
    expect(s.push({ type: 'shear', t: 0 })).toEqual([]);
    expect(s.push({ type: 'explode', t: 0 })).toEqual([]);
    expect(s.push({ type: 'zone', t: 0, zone: 'yard' })).toEqual([]);
    expect(s.push({ type: 'checkpoint', t: 0 })).toEqual([]);
    expect(s.push({ type: 'air', t: 0, phase: 'start', seconds: 0, crossings: 0 })).toEqual([]);
  });
});

describe('AIRTIME', () => {
  it('awards 100/s on landing after ≥ 3 s with a crossing', () => {
    const a = new StyleSystem().push(air(3.5, 1));
    expect(ids(a)).toEqual(['airtime']);
    expect(a[0].points).toBe(350);
    expect(a[0].suffix).toBe('3.5s');
  });

  it('needs a crossing and 3 s', () => {
    expect(new StyleSystem().push(air(5, 0))).toEqual([]);
    expect(new StyleSystem().push(air(2.9, 2))).toEqual([]);
    expect(ids(new StyleSystem().push(air(3, 1)))).toEqual(['airtime']);
  });
});

describe('LOOP ×N', () => {
  it('pays at 3/6/10 and the remainder when the run ends; total 50 + 50/loop', () => {
    const s = new StyleSystem();
    const got: TrickAward[] = [];
    for (let i = 1; i <= 12; i++) got.push(...s.push(cross(i * 0.3, i)));
    expect(got.map((a) => a.suffix)).toEqual(['×3', '×6', '×10']);
    expect(got.map((a) => a.points)).toEqual([200, 150, 200]);
    // A new run (loops reset) ends the old one: remainder for 11..12.
    const end = s.push(cross(5, 1));
    expect(end.map((a) => [a.id, a.suffix, a.points])).toEqual([['loop', '×12', 100]]);
    const total = [...got, ...end].reduce((p, a) => p + a.points, 0);
    expect(total).toBe(50 + 50 * 12);
    // Continuations are not treated as repeats.
    expect([...got, ...end].some((a) => a.halved)).toBe(false);
  });

  it('stops paying past loopPayCap (no farming an endless loop)', () => {
    const s = new StyleSystem();
    const got: TrickAward[] = [];
    for (let i = 1; i <= 60; i++) got.push(...s.push(cross(i * 0.1, i)));
    got.push(...s.push(cross(7, 1)));
    const total = got.filter((a) => a.id === 'loop').reduce((p, a) => p + a.points, 0);
    expect(total).toBe(50 + 50 * STYLE_TUNING.loopPayCap);
    expect(got.length).toBeLessThanOrEqual(5);
  });

  it('fewer than 3 loops is not a LOOP', () => {
    const s = new StyleSystem();
    expect(s.push(cross(0, 1))).toEqual([]);
    expect(s.push(cross(0.3, 2))).toEqual([]);
    expect(s.push(cross(0.6, 1))).toEqual([]);
    s.update(5, false);
    expect(s.drainLate()).toEqual([]);
  });

  it('a run that times out pays its remainder from update()', () => {
    const s = new StyleSystem();
    for (let i = 1; i <= 4; i++) s.push(cross(i * 0.3, i));
    expect(s.state.chainPoints).toBe(200);
    s.update(STYLE_TUNING.loopTimeout + 0.5, true);
    const late = s.drainLate();
    expect(late.map((a) => [a.id, a.suffix, a.points])).toEqual([['loop', '×4', 50]]);
    expect(s.state.chainPoints).toBe(250);
    expect(s.drainLate()).toEqual([]);
  });

  it('late awards are also returned by the next push()', () => {
    const s = new StyleSystem();
    for (let i = 1; i <= 5; i++) s.push(cross(i * 0.3, i));
    s.update(3, true);
    const a = s.push({ type: 'checkpoint', t: 5 });
    expect(ids(a)).toEqual(['loop']);
    expect(a[0].suffix).toBe('×5');
  });

  it('the player landing ends the player loop run before AIRTIME', () => {
    const s = new StyleSystem();
    for (let i = 1; i <= 4; i++) s.push(cross(i * 0.4, i, 'player'));
    const a = s.push(air(4, 4, 2));
    expect(ids(a)).toEqual(['loop', 'airtime']);
    expect(a[0].suffix).toBe('×4');
  });

  it('different kinds loop independently', () => {
    const s = new StyleSystem();
    const got: TrickAward[] = [];
    for (let i = 1; i <= 3; i++) {
      got.push(...s.push(cross(i * 0.3, i, 'prop')));
      got.push(...s.push(cross(i * 0.3 + 0.1, i, 'bolt')));
    }
    expect(got.length).toBe(2);
  });
});

describe('multi-kills', () => {
  it('DOUBLE / TRIPLE / MULTI within 0.6 s of the previous kill', () => {
    const s = new StyleSystem();
    const out: TrickId[][] = [];
    for (let i = 0; i < 5; i++) out.push(ids(s.push(kill({ t: i * 0.5, enemyId: i + 1 }))));
    expect(out[0]).toEqual([]);
    expect(out[1]).toEqual(['double']);
    expect(out[2]).toEqual(['triple']);
    expect(out[3]).toEqual(['multi']);
    expect(out[4]).toEqual(['multi']);
  });

  it('points and the ×N suffix beyond four', () => {
    const s = new StyleSystem();
    const all: TrickAward[] = [];
    for (let i = 0; i < 5; i++) all.push(...s.push(kill({ t: i * 0.1, enemyId: i + 1 })));
    expect(all.map((a) => a.points)).toEqual([200, 500, 1000, 500]); // 5th MULTI is a repeat → halved
    expect(all[3].suffix).toBe('×5');
  });

  it('a gap over 0.6 s restarts the count', () => {
    const s = new StyleSystem();
    s.push(kill({ t: 0 }));
    expect(ids(s.push(kill({ t: 0.61, enemyId: 2 })))).toEqual([]);
    expect(ids(s.push(kill({ t: 1.0, enemyId: 3 })))).toEqual(['double']);
  });
});

describe('repeats, chain and banking', () => {
  it('a repeat of one of the last 3 trick ids is halved', () => {
    const s = new StyleSystem();
    const a = s.push(kill({ t: 0, ownShot: true }));
    const b = s.push(kill({ t: 1, ownShot: true }));
    expect(a[0].points).toBe(300);
    expect(a[0].halved).toBeUndefined();
    expect(b[0].points).toBe(150);
    expect(b[0].halved).toBe(true);
    // Three different tricks push it out of the memory.
    s.push(kill({ t: 2, cause: 'shear' }));
    s.push(kill({ t: 3, cause: 'blade' }));
    s.push(kill({ t: 4, byProp: true }));
    const c = s.push(kill({ t: 5, ownShot: true }));
    expect(c[0].points).toBe(300);
    expect(c[0].halved).toBeUndefined();
  });

  it('chain points × variety bank when the chain window runs out', () => {
    const s = new StyleSystem();
    s.push(kill({ t: 0, ownShot: true })); // 300
    s.push(kill({ t: 1, shotBy: 5, projectileKind: 'bolt' })); // 250
    s.push(kill({ t: 2, ownShot: true })); // 150 (halved)
    expect(s.state.chainPoints).toBe(700);
    expect(s.state.variety).toBe(2);
    expect(s.state.chain.length).toBe(3);
    expect(s.state.chainT).toBe(STYLE_TUNING.chainWindow);
    expect(s.update(3.9, false)).toBeNull();
    const r = s.update(0.2, false);
    expect(r).toEqual({ banked: 1400 });
    expect(s.state.total).toBe(1400);
    expect(s.state.lastCombo).toBe(1400);
    expect(s.state.bestCombo).toBe(1400);
    expect(s.state.chain.length).toBe(0);
    expect(s.state.chainPoints).toBe(0);
    expect(s.state.variety).toBe(0);
    expect(s.lastChain.length).toBe(3);
    expect(s.lastChainSpan).toEqual({ from: 0, to: 2 });
    // A smaller second combo keeps bestCombo.
    s.push(kill({ t: 20, cause: 'blade' }));
    expect(s.update(5, false)).toEqual({ banked: 150 });
    expect(s.state.total).toBe(1550);
    expect(s.state.bestCombo).toBe(1400);
    expect(s.state.lastCombo).toBe(150);
  });

  it('the next trick within 4 s keeps the chain going', () => {
    const s = new StyleSystem();
    s.push(kill({ t: 0, cause: 'blade' }));
    expect(s.update(3.5, false)).toBeNull();
    s.push(kill({ t: 3.5, cause: 'shear' }));
    expect(s.update(3.5, false)).toBeNull();
    expect(s.state.chain.length).toBe(2);
    expect(s.update(1, false)).toEqual({ banked: (150 + 350) * 2 });
  });

  it('the chain is frozen while airborne, with a short grace on landing', () => {
    const s = new StyleSystem();
    s.push(kill({ t: 0, cause: 'blade' }));
    s.update(3.9, false);
    expect(s.update(20, true)).toBeNull();
    expect(s.state.chain.length).toBe(1);
    expect(s.update(0.5, false)).toBeNull();
    expect(s.update(0.2, false)).toEqual({ banked: 150 });
  });

  it('variety is capped at 8', () => {
    const s = new StyleSystem();
    const list: Partial<KillEvent>[] = [
      { ownShot: true }, { cause: 'shear' }, { cause: 'blade' }, { byProp: true }, { matador: true },
      { killerLoops: 3 }, { victimCrossings: 3 }, { byBody: true }, { turretShot: true }, { viaTrapdoor: true },
    ];
    list.forEach((o, i) => s.push(kill({ t: i, enemyId: i + 1, ...o })));
    expect(s.state.variety).toBe(8);
    const sum = s.state.chainPoints;
    expect(s.update(10, false)).toEqual({ banked: sum * 8 });
  });

  it('bankNow() banks immediately', () => {
    const s = new StyleSystem();
    expect(s.bankNow()).toBeNull();
    s.push(kill({ ownShot: true }));
    expect(s.bankNow()).toEqual({ banked: 300 });
    expect(s.state.chain.length).toBe(0);
  });

  it('player death loses the running chain', () => {
    const s = new StyleSystem();
    s.push(kill({ ownShot: true }));
    s.push({ type: 'death', t: 1 });
    expect(s.state.chain.length).toBe(0);
    expect(s.state.rank).toBe('D');
    expect(s.update(10, false)).toBeNull();
    expect(s.state.total).toBe(0);
  });

  it('reset() clears everything', () => {
    const s = new StyleSystem();
    s.push(kill({ ownShot: true }));
    s.update(5, false);
    s.reset();
    expect(s.state.total).toBe(0);
    expect(s.state.bestCombo).toBe(0);
    expect(s.state.rank).toBe('D');
    // History cleared: no halving.
    expect(s.push(kill({ t: 1, ownShot: true }))[0].points).toBe(300);
  });

  it('comboValue is chainPoints × variety', () => {
    const s = new StyleSystem();
    s.push(kill({ ownShot: true }));
    s.push(kill({ t: 1, cause: 'blade' }));
    expect(s.comboValue).toBe((300 + 150) * 2);
  });
});

describe('style rank', () => {
  it('points raise the rank, bigger jumps at low ranks', () => {
    const s = new StyleSystem();
    expect(s.state.rank).toBe('D');
    s.push(kill({ t: 0, cause: 'blade' })); // 150 of 250 at D
    expect(s.state.rank).toBe('D');
    expect(s.state.meter).toBeCloseTo(150 / 250, 5);
    s.push(kill({ t: 1, ownShot: true })); // +300: 100 fills D, 200 into C
    expect(s.state.rank).toBe('C');
    expect(s.state.meter).toBeCloseTo(200 / 400, 5);
    const cost = STYLE_TUNING.rankCost;
    for (let i = 1; i < cost.length; i++) expect(cost[i]).toBeGreaterThan(cost[i - 1]);
  });

  it('climbs to SSS and caps', () => {
    const s = new StyleSystem();
    for (let i = 0; i < 40; i++) s.push(kill({ t: i * 2, enemyId: i, killerLoops: 3, cause: 'shear', matador: true }));
    expect(s.state.rank).toBe('SSS');
    expect(s.state.meter).toBeLessThanOrEqual(1);
    expect(s.rankIndex).toBe(RANKS.length - 1);
  });

  it('decays continuously, faster at high ranks, down to D', () => {
    const decay = STYLE_TUNING.rankDecay;
    for (let i = 1; i < decay.length; i++) expect(decay[i]).toBeGreaterThan(decay[i - 1]);
    const s = new StyleSystem();
    s.push(kill({ t: 0, ownShot: true })); // C, meter 0.125
    const m0 = s.state.meter;
    s.update(1, false);
    expect(s.state.meter).toBeCloseTo(m0 - decay[1], 5);
    s.update(60, false);
    expect(s.state.rank).toBe('D');
    expect(s.state.meter).toBe(0);
  });

  it('a hurt event drops one rank', () => {
    const s = new StyleSystem();
    for (let i = 0; i < 6; i++) s.push(kill({ t: i, enemyId: i, killerLoops: 3, cause: 'shear' }));
    const before = s.rankIndex;
    expect(before).toBeGreaterThan(1);
    s.push({ type: 'hurt', t: 7, amount: 15 });
    expect(s.rankIndex).toBe(before - 1);
    expect(s.state.rank).toBe(RANKS[before - 1]);
    expect(s.state.meter).toBe(STYLE_TUNING.hurtMeter);
    // At D it stays D.
    const d = new StyleSystem();
    d.push({ type: 'hurt', t: 0, amount: 10 });
    expect(d.state.rank).toBe('D');
  });
});

describe('tables', () => {
  it('points match DESIGN §6', () => {
    expect(TRICK_POINTS.returnToSender).toBe(300);
    expect(TRICK_POINTS.firingLine).toBe(350);
    expect(TRICK_POINTS.cannonball).toBe(450);
    expect(TRICK_POINTS.multi).toBe(1000);
    expect(TRICK_POINTS.mirror).toBe(400);
  });
});
