import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { HitInfo, SpawnDef } from '../../src/core/contracts';
import type { Enemy } from '../../src/actors/enemies';
import { inMelee } from '../../src/actors/onslaught';
import { AI, ONS } from '../../src/actors/tuning';
import { scenario, V } from './fakes';

type S = ReturnType<typeof scenario>;

const ons = (extra: Partial<SpawnDef> = {}): Partial<SpawnDef> => ({ state: 'combat', onslaught: true, ...extra });
/** A squad man as the lab brings him in: in the fight, told where you are. */
const informed = (s: S, e: Enemy) => {
  s.sys.inform(e, s.player.pos);
  return e;
};
const stormer = (s: S, x: number, z: number, extra: Partial<SpawnDef> = {}) =>
  informed(s, s.spawn('rifleman', V(x, 0, z), 0, ons({ archetype: 'stormer', role: 'pusher', leash: 60, id: `st-${x}-${z}`, ...extra })) as Enemy);
const suppressor = (s: S, x: number, z: number, extra: Partial<SpawnDef> = {}) =>
  informed(s, s.spawn('rifleman', V(x, 0, z), 0, ons({ archetype: 'suppressor', id: `sp-${x}-${z}`, ...extra })) as Enemy);

/** The frames the first wind-up of `id` ran: its first telegraph and the blow's moment. */
function firstBlow(s: S, id: number) {
  const tell = s.log.telegraphs.filter((t) => t.id === id && t.kind === 'melee');
  const hit = s.log.melee.find((m) => m.id === id);
  return { start: tell[0]?.t ?? NaN, hit: hit?.t ?? NaN, tell };
}

describe('ONSLAUGHT: gated to its own men', () => {
  it('an archetype without the onslaught flag is a plain rifleman (no squad state, rifleman hp)', () => {
    const s = scenario();
    const plain = s.spawn('rifleman', V(0, 0, 0), 0, { state: 'combat', archetype: 'stormer' }) as Enemy;
    expect(plain.ons).toBeNull();
    expect(plain.arch).toBeNull();
    expect(plain.hp).toBe(40);
    const st = stormer(s, 5, 0);
    expect(st.ons).not.toBeNull();
    expect(st.arch).toBe('stormer');
    expect(st.hp).toBe(ONS.stormer.hp);
    const sp = suppressor(s, -5, 0);
    expect(sp.hp).toBe(ONS.suppressor.hp);
  });

  it('plain men never book the squad: its director stays empty in a plain fight', () => {
    const s = scenario();
    for (let i = 0; i < 4; i++) s.spawn('rifleman', V(-6 + i * 4, 0, 0), 0, { state: 'combat', perch: true });
    s.step(60 * 8);
    expect(s.sys.squad.hits.length).toBe(0);
    expect(s.sys.squad.count).toBe(0);
    expect(s.log.telegraphs.some((t) => t.kind === 'melee' || t.kind === 'slam')).toBe(false);
    expect(s.log.windups.length).toBe(0);
  });

  it('a plain rifleman still reels 0.5 s from a hit; a squad man 0.2-0.4 s (hitHead from a high hit)', () => {
    const s = scenario();
    const hit = (from: THREE.Vector3): HitInfo => ({ source: 'bolt', amount: 5, charged: true, from, team: 'player', instigator: 'player' });
    const a = s.spawn('rifleman', V(0, 0, 0), 0, { state: 'combat', perch: true }) as Enemy;
    const b = s.spawn('rifleman', V(6, 0, 0), 0, ons({ perch: true })) as Enemy;
    s.step(2);
    s.sys.hit(a, hit(V(0, 1.2, 5)));
    s.sys.hit(b, hit(V(6, 2.4, 5)));
    expect(a.state).toBe('stagger');
    expect(a.holdT).toBeCloseTo(AI.hurtStagger, 5);
    expect(b.state).toBe('stagger');
    expect(b.holdT).toBeGreaterThanOrEqual(ONS.hurtStagger[0]);
    expect(b.holdT).toBeLessThanOrEqual(ONS.hurtStagger[1]);
    expect(s.char(b).clip).toBe('hitHead');
    expect(s.char(a).clip).toBe('hitChest');
  });
});

describe('ONSLAUGHT: the stormer', () => {
  it('sprints in, winds up 0.45 s behind a red tell, and lands 25 with a knock back', () => {
    const s = scenario();
    s.setPlayer(0, 0, 0);
    const e = stormer(s, 0, 20);
    // he comes in fast (well over a rifleman's run): 12 m in well under 3 s
    const run = s.until(() => Math.hypot(e.pos.x, e.pos.z) < 8, 4);
    expect(12 / run).toBeGreaterThan(4.5);
    // he sizes you up a moment, circling, before his first blow
    const t1 = s.clock.t;
    expect(s.until(() => s.log.melee.length > 0, 8)).toBeLessThan(8);
    const { start, hit, tell } = firstBlow(s, e.id);
    expect(start - t1).toBeGreaterThan(ONS.stormer.sizeUp[0] - 0.2);
    expect(hit - start).toBeGreaterThan(ONS.stormer.windup - 0.03);
    expect(hit - start).toBeLessThan(ONS.stormer.windup + 0.03);
    expect(tell[0].t01).toBeLessThan(0.1);
    expect(s.log.windups[0]).toMatchObject({ id: e.id, kind: 'strike', secs: ONS.stormer.windup });
    const m = s.log.melee[0];
    expect(m.damage).toBe(ONS.stormer.damage);
    expect(Math.hypot(m.push.x, m.push.z)).toBeCloseTo(ONS.stormer.push, 3);
    expect(s.char(e).plays).toContain('strike');
    // the blow landed: no opening
    expect(s.log.openings.length).toBe(0);
  });

  it('a dodged blow whiffs: no damage, and he is open 0.8 s', () => {
    const s = scenario();
    s.setPlayer(0, 0, 0);
    const e = stormer(s, 0, 8);
    s.until(() => e.atk === 'windup', 6);
    s.player.safe = true;
    s.until(() => e.atk === 'recover', 2);
    s.player.safe = false;
    expect(s.log.melee.length).toBe(0);
    expect(s.log.openings).toEqual([expect.objectContaining({ id: e.id, secs: ONS.stormer.whiff })]);
    // he stands in his recovery for the whole opening
    const t = s.until(() => e.atk !== 'recover', 2);
    expect(t).toBeGreaterThan(ONS.stormer.whiff - 0.05);
  });

  it('a hit mid wind-up breaks his blow', () => {
    const s = scenario();
    s.setPlayer(0, 0, 0);
    const e = stormer(s, 0, 8);
    s.until(() => e.atk === 'windup', 6);
    s.sys.hit(e, { source: 'bolt', amount: 10, charged: true, from: V(0, 1.2, 0), team: 'player', instigator: 'player' });
    s.step(40);
    expect(s.log.melee.length).toBe(0);
    expect(e.alive).toBe(true);
  });

  it('never more than two melee attackers at once, and the blows take turns (2 s apart at least)', () => {
    const s = scenario();
    s.setPlayer(0, 0, 0);
    const men = [stormer(s, -6, 6), stormer(s, 6, 6), stormer(s, 0, -7), stormer(s, 7, -5)];
    let most = 0;
    for (let i = 0; i < 60 * 14; i++) {
      s.step(1);
      most = Math.max(most, men.filter((m) => inMelee(m)).length);
    }
    expect(most).toBeLessThanOrEqual(ONS.maxMelee);
    const hits = s.log.melee.map((m) => m.t).sort((a, b) => a - b);
    expect(hits.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < hits.length; i++) expect(hits[i] - hits[i - 1]).toBeGreaterThan(ONS.meleeTurn - 0.02);
  });
});

describe('ONSLAUGHT: the suppressor', () => {
  it('an orange lock of 0.7 s, then 8-10 rounds in one long burst', () => {
    const s = scenario();
    s.setPlayer(0, 0, 15);
    const e = suppressor(s, 0, 0, { perch: true });
    s.until(() => s.log.bolts.length > 0, 6);
    s.step(90);
    const mine = s.log.bolts.filter((b) => b.id === e.id);
    const first = mine[0].t;
    const burst = mine.filter((b) => b.t - first < 2);
    expect(burst.length).toBeGreaterThanOrEqual(ONS.suppressor.rounds[0]);
    expect(burst.length).toBeLessThanOrEqual(ONS.suppressor.rounds[1]);
    const lasers = s.log.telegraphs.filter((t) => t.id === e.id && t.kind === 'laser' && t.t <= first);
    expect(first - lasers[0].t).toBeGreaterThan(ONS.suppressor.telegraph - 0.03);
    expect(first - lasers[0].t).toBeLessThan(ONS.suppressor.telegraph + 0.05);
  });

  it('his fire trails a man who keeps moving (the aim walks at 3.2 m/s)', () => {
    const s = scenario();
    s.setPlayer(0, 0, 15);
    const e = suppressor(s, 0, 0, { perch: true });
    s.until(() => e.atk === 'fire', 6);
    // you break sideways at 7 m/s through the burst
    let x = 0;
    for (let i = 0; i < 60; i++) {
      x += 7 / 60;
      s.setPlayer(x, 0, 15);
      s.player.vel.set(7, 0, 0);
      s.step(1);
    }
    expect(x - e.aimPt.x).toBeGreaterThan(3);
  });

  it('lays fire on your cover when you are pinned, and the stormers flank you from both sides', () => {
    const s = scenario();
    // a wall you can duck behind (they come round it)
    s.world.add({ x: -3, y: 0, z: 11 }, { x: 3, y: 3, z: 12 });
    s.setPlayer(6, 0, 14);
    const sp = suppressor(s, 0, 0, { perch: true });
    const a = stormer(s, -8, -8);
    const b = stormer(s, 8, -8);
    // out in the open, nobody is pinned
    s.until(() => sp.seesPlayer, 2);
    s.step(60);
    expect(s.sys.squad.flanks).toBe(0);
    // behind the wall: they know where you are, and nobody sees you
    s.setPlayer(0, 0, 14);
    s.step(15);
    expect(sp.seesPlayer).toBe(false);
    expect(s.until(() => s.sys.squad.flanks > 0, 4)).toBeGreaterThan(ONS.squad.pinned - 0.5);
    expect(s.sys.squad.pinned).toBe(true);
    expect(s.log.barks.some((q) => q.key === 'bark.flank')).toBe(true);
    // one goes round each side of you
    const side = (e: Enemy) => Math.sign(e.ons!.flank.x);
    expect(a.ons!.flankT > 0 || b.ons!.flankT > 0).toBe(true);
    expect(side(a)).not.toBe(side(b));
    // the suppressor fires into your cover without seeing you
    expect(sp.ons!.suppressT).toBeGreaterThan(0);
    s.until(() => s.log.bolts.some((q) => q.id === sp.id), 3);
    expect(s.log.bolts.some((q) => q.id === sp.id)).toBe(true);
  });

  it('his chest plate takes most of a returned round from the front; from behind it goes in whole', () => {
    const s = scenario();
    s.setPlayer(0, 0, 15);
    const sp = suppressor(s, 0, 0, { perch: true });
    s.step(30);
    const round = (from: THREE.Vector3): HitInfo => ({ source: 'bolt', amount: 60, charged: true, from, team: 'player', instigator: 'player' });
    const hp0 = sp.hp;
    s.sys.hit(sp, round(V(0, 1.3, 3)));
    expect(hp0 - sp.hp).toBeCloseTo(60 * ONS.suppressor.plate, 5);
    expect(s.log.sounds.at(-1)?.kind).toBe('clang');
    // a plain rifleman has no plate
    const r = s.spawn('rifleman', V(8, 0, 0), 0, { state: 'combat', perch: true }) as Enemy;
    s.sys.hit(r, round(V(8, 1.3, 3)));
    expect(r.alive).toBe(false);
    s.step(40);
    const hp1 = sp.hp;
    s.sys.hit(sp, round(V(0, 1.3, -3)));
    expect(hp1 - sp.hp).toBe(60);
  });

  it('a fresh squad is not pinned by the last one\'s sighting', () => {
    const s = scenario();
    s.setPlayer(0, 0, 14);
    const sp = suppressor(s, 0, 0, { perch: true });
    s.until(() => sp.seesPlayer, 2);
    s.sys.kill(sp, { source: 'void', amount: 999, charged: true, team: 'player', instigator: 'player' });
    s.step(30);
    // the next wave comes in behind a wall
    s.world.add({ x: -3, y: 0, z: 11 }, { x: 3, y: 3, z: 12 });
    suppressor(s, 0, 2, { perch: true });
    stormer(s, -8, -8);
    s.step(60 * 3);
    expect(s.sys.squad.flanks).toBe(0);
  });

  it('a stormer down: someone calls it and the suppressors open up', () => {
    const s = scenario();
    s.setPlayer(0, 0, 15);
    const sp = suppressor(s, 6, 0, { perch: true });
    const st = stormer(s, -6, 0);
    s.step(5);
    sp.reloadT = 5;
    s.sys.kill(st, { source: 'void', amount: 999, charged: true, team: 'player', instigator: 'player' });
    expect(s.log.barks.find((q) => q.key === 'bark.stormerDown')).toMatchObject({ id: sp.id });
    expect(sp.ons!.suppressT).toBeGreaterThanOrEqual(ONS.squad.avenge);
    expect(sp.reloadT).toBeLessThan(0.4);
  });
});

describe('ONSLAUGHT: the squad', () => {
  it('up to three guns at once (the plain game keeps two), never two first rounds within 0.3 s', () => {
    const count = (onslaught: boolean) => {
      const s = scenario();
      s.setPlayer(0, 0, 18);
      const men: Enemy[] = [];
      for (let i = 0; i < 7; i++) men.push(s.spawn('rifleman', V(-12 + i * 4, 0, 0), 0, { state: 'combat', perch: true, onslaught, id: `r${i}` }) as Enemy);
      let most = 0;
      for (let i = 0; i < 60 * 20; i++) {
        s.step(1);
        most = Math.max(most, men.filter((m) => m.atk === 'aim' || m.atk === 'fire').length);
      }
      return { most, s };
    };
    const plain = count(false);
    expect(plain.most).toBe(AI.maxTokens);
    const o = count(true);
    expect(o.most).toBe(ONS.maxShooters);
    // the booked landings stay apart
    const at = o.s.sys.squad.hits.map((h) => h.at).sort((a, b) => a - b);
    for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBeGreaterThan(ONS.hitGap - 1e-6);
  });

  it('the squad never loses you: out of everyone\'s sight for a minute, nobody stands down (a plain man does)', () => {
    const s = scenario();
    s.setPlayer(0, 0, 30);
    // you're behind a long wall
    s.world.add({ x: -20, y: 0, z: 26 }, { x: 20, y: 4, z: 27 });
    const a = s.spawn('rifleman', V(-4, 0, 0), 0, ons({ archetype: 'suppressor', perch: true })) as Enemy;
    const plain = s.spawn('rifleman', V(4, 0, 0), 0, { state: 'combat', perch: true }) as Enemy;
    s.sys.inform(a, s.player.pos);
    s.sys.inform(plain, s.player.pos);
    s.step(60 * 60);
    expect(plain.mode).not.toBe('combat');
    expect(a.mode).toBe('combat');
    expect(a.lastKnown.distanceTo(s.player.pos)).toBeLessThan(6);
  });

  it('a man who stands stuck is moved on (his ground comes toward you)', () => {
    const s = scenario();
    s.setPlayer(0, 0, 20);
    // a warden boxed in a pen (no way out): he can't reach you
    s.world.add({ x: -3, y: 0, z: -3 }, { x: 3, y: 3, z: -2.5 });
    s.world.add({ x: -3, y: 0, z: 2.5 }, { x: 3, y: 3, z: 3 });
    s.world.add({ x: -3, y: 0, z: -3 }, { x: -2.5, y: 3, z: 3 });
    s.world.add({ x: 2.5, y: 0, z: -3 }, { x: 3, y: 3, z: 3 });
    const w = s.spawn('warden', V(0, 0, 0), 0, ons({ role: 'pusher', leash: 3 })) as Enemy;
    const post0 = w.post.clone();
    s.step(60 * 12);
    expect(w.ons!.stuckT).toBeLessThan(ONS.squad.stuckTime + 0.1);
    expect(w.post.distanceTo(post0)).toBeGreaterThan(1);
  });
});

describe('ONSLAUGHT: the heavies', () => {
  it('the warden rushes you from mid range: a red wind-up along his line, then the shield hits for 20', () => {
    const s = scenario();
    s.setPlayer(0, 0, 7);
    const w = s.spawn('warden', V(0, 0, 0), 0, ons({ role: 'pusher', leash: 40 })) as Enemy;
    s.until(() => s.log.melee.length > 0, 6);
    expect(s.log.windups[0]).toMatchObject({ id: w.id, kind: 'rush' });
    const m = s.log.melee[0];
    expect(m.damage).toBe(ONS.warden.damage);
    expect(m.t - s.log.windups[0].t).toBeGreaterThan(ONS.warden.windup);
    expect(m.t - s.log.windups[0].t).toBeLessThan(ONS.warden.windup + 7 / ONS.warden.speed + 0.2);
  });

  it('a dodged rush runs past you and leaves him open', () => {
    const s = scenario();
    s.setPlayer(0, 0, 7);
    const w = s.spawn('warden', V(0, 0, 0), 0, ons({ role: 'pusher', leash: 40 })) as Enemy;
    s.until(() => w.atk === 'run', 6);
    s.setPlayer(4, 0, 7);
    s.until(() => w.atk === 'recover', 3);
    expect(s.log.melee.length).toBe(0);
    expect(s.log.openings.at(-1)).toMatchObject({ id: w.id, secs: ONS.warden.whiff });
  });

  it('the brute slams the ground close up: a red ring 0.8 s, 30 to anyone on the ground in it, a jump clears it', () => {
    const s = scenario();
    s.setPlayer(0, 0, 3);
    const br = s.spawn('brute', V(0, 0, 0), 0, ons({ role: 'pusher', leash: 40 })) as Enemy;
    br.chargeCd = 99;
    s.until(() => s.log.slams.length > 0, 6);
    const ring = s.log.telegraphs.filter((t) => t.id === br.id && t.kind === 'slam');
    expect(ring.length).toBeGreaterThan(30);
    expect(s.log.slams[0].t - ring[0].t).toBeCloseTo(ONS.brute.windup, 1);
    expect(ring[0].from.distanceTo(ring[0].to)).toBeCloseTo(ONS.brute.radius, 3);
    expect(s.log.melee[0]).toMatchObject({ id: br.id, damage: ONS.brute.damage });
    expect(s.log.melee[0].push.y).toBe(ONS.brute.lift);
    // after it he's open, hit or miss
    expect(s.log.openings.at(-1)).toMatchObject({ id: br.id });
    // the next: you're in the air when it lands
    s.until(() => br.atk === 'windup' && br.atkKind === 'slam', 8);
    s.player.airborne = true;
    const n = s.log.melee.length;
    s.until(() => s.log.slams.length > 1, 2);
    s.player.airborne = false;
    expect(s.log.melee.length).toBe(n);
  });

  it('the brute still charges from range (the DOOR portal can send him through)', () => {
    const s = scenario();
    s.setPlayer(0, 0, 10);
    const br = s.spawn('brute', V(0, 0, 0), 0, ons({ role: 'pusher', leash: 40 })) as Enemy;
    expect(s.until(() => br.state === 'charge', 4)).toBeLessThan(4);
  });
});

describe('ONSLAUGHT: a gun that lost you comes out after you', () => {
  it('blind 8 s: his ground widens (a plain anchor keeps his leash)', () => {
    const s = scenario();
    s.setPlayer(0, 0, 30);
    s.world.add({ x: -20, y: 0, z: 26 }, { x: 20, y: 4, z: 27 });
    const a = s.spawn('rifleman', V(-4, 0, 0), 0, { id: 'sa', state: 'combat', onslaught: true, archetype: 'suppressor', role: 'anchor', leash: 6 }) as Enemy;
    const plain = s.spawn('rifleman', V(4, 0, 0), 0, { id: 'pa', state: 'combat', role: 'anchor', leash: 6 }) as Enemy;
    s.sys.inform(a, s.player.pos);
    s.step(60 * 20);
    expect(a.leash).toBeGreaterThanOrEqual(6 + ONS.squad.widen * 2);
    expect(a.pos.z).toBeGreaterThan(8);
    expect(plain.leash).toBe(6);
  });
});
