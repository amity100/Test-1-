import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { GameEvent, KillEvent, StyleState, TrickAward, TrickId, ZoneId } from '../../src/core/contracts';
import {
  CHALLENGES, CHALLENGE_STORAGE_KEY, ChallengeSystem, DAILY_POOL, dailyChallengeFor, formatChallenge, localDateKey,
} from '../../src/meta/challenges';
import { StyleSystem } from '../../src/meta/style';

class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
}

class BrokenStorage implements Storage {
  get length(): number { throw new Error('denied'); }
  clear() { throw new Error('denied'); }
  getItem(): string | null { throw new Error('denied'); }
  key(): string | null { throw new Error('denied'); }
  removeItem() { throw new Error('denied'); }
  setItem() { throw new Error('QuotaExceededError'); }
}

function kill(o: Partial<KillEvent> = {}): KillEvent {
  return {
    type: 'kill', t: 0, enemyId: 1, enemyKind: 'rifleman', cause: 'impact', charged: true, speed: 0,
    fallHeight: 0, killerCrossings: 0, killerLoops: 0, victimCrossings: 0, ownShot: false, shotBy: null,
    projectileKind: null, turretShot: false, shotAge: 1, unaware: false, witnessed: true, viaTrapdoor: false,
    matador: false, byBody: false, byProp: false, byBarrel: false, byPlayer: false, playerFling: false,
    playerAirborne: false, impactorId: null, at: new THREE.Vector3(), ...o,
  };
}

const award = (id: TrickId, t = 0, points = 300): TrickAward => ({ id, key: `trick.${id}`, points, t });

function style(o: Partial<StyleState> = {}): StyleState {
  return { rank: 'D', meter: 0, chainPoints: 0, variety: 0, chain: [], chainT: 0, total: 0, bestCombo: 0, lastCombo: 0, ...o };
}

/** Real pipeline: style.push → challenges.push */
function feed(c: ChallengeSystem, s: StyleSystem, e: GameEvent): string[] {
  const a = s.push(e);
  return c.push(e, a, s.state);
}

function inZone(c: ChallengeSystem, zone: ZoneId) {
  c.push({ type: 'zone', t: 0, zone }, [], style());
}

describe('definitions', () => {
  it('3 challenges per zone with the level ids', () => {
    const zones: ZoneId[] = ['pier', 'yard', 'skeleton', 'lab', 'crown'];
    const c = new ChallengeSystem(null);
    for (const z of zones) {
      expect(c.list(z).map((x) => x.id)).toEqual([`${z}.1`, `${z}.2`, `${z}.3`]);
    }
    expect(c.list().length).toBe(15);
    expect(CHALLENGES.every((d) => d.titleKey === `challenge.${d.id}.title` && d.descKey === `challenge.${d.id}.desc`)).toBe(true);
  });
});

describe('progress', () => {
  it('pier.1: Return to Sender ×3 through the real style pipeline', () => {
    const c = new ChallengeSystem(null);
    const s = new StyleSystem();
    inZone(c, 'pier');
    expect(feed(c, s, kill({ t: 0, ownShot: true }))).toEqual([]);
    expect(c.progress('pier.1')).toMatchObject({ count: 1, goal: 3, done: false });
    expect(feed(c, s, kill({ t: 2, ownShot: true }))).toEqual([]);
    expect(feed(c, s, kill({ t: 4, ownShot: true }))).toEqual(['pier.1']);
    expect(c.progress('pier.1')).toMatchObject({ count: 3, goal: 3, done: true, ratio: 1 });
    // Only reported once.
    expect(feed(c, s, kill({ t: 6, ownShot: true }))).toEqual([]);
    expect(c.completed().has('pier.1')).toBe(true);
  });

  it('zone challenges only progress in their zone (or when the zone is unknown)', () => {
    const c = new ChallengeSystem(null);
    inZone(c, 'yard');
    c.push(kill(), [award('returnToSender')], style());
    expect(c.progress('pier.1')!.count).toBe(0);
    c.setZone(null);
    c.push(kill(), [award('returnToSender')], style());
    expect(c.progress('pier.1')!.count).toBe(1);
  });

  it('pier.2: two splashdowns within 3 s', () => {
    const c = new ChallengeSystem(null);
    inZone(c, 'pier');
    c.push(kill({ t: 1 }), [award('splashdown', 1)], style());
    expect(c.push(kill({ t: 5 }), [award('splashdown', 5)], style())).toEqual([]);
    expect(c.progress('pier.2')!.count).toBe(1);
    expect(c.push(kill({ t: 7.5 }), [award('splashdown', 7.5)], style())).toEqual(['pier.2']);
  });

  it('pier.3: S rank on the pier', () => {
    const c = new ChallengeSystem(null);
    inZone(c, 'pier');
    expect(c.push({ type: 'hurt', t: 0, amount: 5 }, [], style({ rank: 'A' }))).toEqual([]);
    expect(c.push(kill(), [award('boom')], style({ rank: 'S' }))).toEqual(['pier.3']);
  });

  it('yard: CARGO, MATADOR into the sea, AIRTIME ≥ 5', () => {
    const c = new ChallengeSystem(null);
    inZone(c, 'yard');
    expect(c.push(kill(), [award('cargo')], style())).toEqual(['yard.1']);
    expect(c.push(kill({ enemyKind: 'brute', matador: true, cause: 'void' }), [award('matador')], style())).toEqual([]);
    expect(c.push(kill({ enemyKind: 'rifleman', matador: true, cause: 'water' }), [award('matador')], style())).toEqual([]);
    expect(c.push(kill({ enemyKind: 'brute', matador: true, cause: 'water' }), [award('matador')], style())).toEqual(['yard.2']);
    expect(c.push({ type: 'air', t: 0, phase: 'end', seconds: 4.9, crossings: 2 }, [], style())).toEqual([]);
    expect(c.push({ type: 'air', t: 0, phase: 'end', seconds: 6, crossings: 0 }, [], style())).toEqual([]);
    expect(c.push({ type: 'air', t: 0, phase: 'end', seconds: 5.2, crossings: 1 }, [], style())).toEqual(['yard.3']);
  });

  it('skeleton: LOOP ×6 (progress tracks the best run), FIRING LINE, CANNONBALL', () => {
    const c = new ChallengeSystem(null);
    inZone(c, 'skeleton');
    for (let i = 1; i <= 4; i++) c.push({ type: 'cross', t: i, who: 'prop', speed: 20, loops: i, fromKind: 'floor', toKind: 'ceiling' }, [], style());
    expect(c.progress('skeleton.1')).toMatchObject({ count: 4, goal: 6 });
    c.push({ type: 'cross', t: 5, who: 'prop', speed: 20, loops: 1, fromKind: 'floor', toKind: 'ceiling' }, [], style());
    expect(c.progress('skeleton.1')!.count).toBe(4);
    expect(c.push({ type: 'cross', t: 6, who: 'bolt', speed: 26, loops: 6, fromKind: 'floor', toKind: 'ceiling' }, [], style())).toEqual(['skeleton.1']);
    expect(c.push(kill(), [award('firingLine')], style())).toEqual(['skeleton.2']);
    expect(c.push(kill(), [award('cannonball')], style())).toEqual(['skeleton.3']);
  });

  it('lab: HIJACK both gates, BORROWED GUN ×2, BOWLING', () => {
    const c = new ChallengeSystem(null);
    inZone(c, 'lab');
    expect(c.push({ type: 'hijack', t: 0 }, [award('hijack')], style())).toEqual([]);
    expect(c.push({ type: 'hijack', t: 1 }, [award('hijack')], style())).toEqual(['lab.1']);
    c.push(kill(), [award('borrowedGun')], style());
    expect(c.push(kill(), [award('borrowedGun')], style())).toEqual(['lab.2']);
    expect(c.push(kill(), [award('bowling')], style())).toEqual(['lab.3']);
  });

  it('crown: beat Voss, cannonball Voss, leap of faith', () => {
    const c = new ChallengeSystem(null);
    inZone(c, 'crown');
    expect(c.push(kill({ enemyKind: 'boss', killerLoops: 3 }), [award('cannonball')], style()).sort()).toEqual(['crown.1', 'crown.2']);
    expect(c.push({ type: 'air', t: 0, phase: 'end', seconds: 3.4, crossings: 1 }, [], style())).toEqual(['crown.3']);
  });

  it('complete() marks manual completions once', () => {
    const c = new ChallengeSystem(null);
    expect(c.complete('crown.3')).toBe(true);
    expect(c.complete('crown.3')).toBe(false);
    expect(c.complete('nope.9')).toBe(false);
    expect(c.progress('crown.3')!.done).toBe(true);
    expect(c.progress('nope.9')).toBeNull();
  });

  it('late awards without an event are accepted', () => {
    const c = new ChallengeSystem(null);
    inZone(c, 'skeleton');
    expect(c.push(null, [award('cannonball', 3)], style())).toEqual(['skeleton.3']);
  });
});

describe('daily challenge', () => {
  it('is deterministic per local date', () => {
    const a = dailyChallengeFor('2026-09-23');
    const b = dailyChallengeFor('2026-09-23');
    expect(a).toEqual(b);
    expect(a.id).toBe('daily.2026-09-23');
    expect(a.zone).toBeNull();
    // Varied across a month.
    const seen = new Set<string>();
    for (let d = 1; d <= 30; d++) seen.add(JSON.stringify(dailyChallengeFor(`2026-10-${String(d).padStart(2, '0')}`).cond));
    expect(seen.size).toBeGreaterThan(10);
  });

  it('only uses tricks from the pool and sensible templates', () => {
    const pool = new Set(DAILY_POOL.map((p) => p.trick));
    for (let d = 1; d <= 60; d++) {
      const date = new Date(2027, 0, d);
      const def = dailyChallengeFor(localDateKey(date));
      const c = def.cond;
      if (c.type === 'trick') expect(pool.has(c.trick)).toBe(true);
      else if (c.type === 'combo') expect(pool.has(c.trick!)).toBe(true);
      else throw new Error(`unexpected daily ${c.type}`);
      expect(def.descKey).toMatch(/^challenge\.daily\.(count|within|combo|air|ghost)\.desc$/);
      const txt = formatChallenge(def, 'en');
      expect(txt.title).not.toContain('{');
      expect(txt.desc).not.toContain('{');
      const he = formatChallenge(def, 'he');
      expect(he.desc).not.toContain('{');
    }
  });

  it('localDateKey uses the local calendar date', () => {
    expect(localDateKey(new Date(2026, 8, 3, 23, 59))).toBe('2026-09-03');
    expect(localDateKey(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });

  it('daily() follows now() and progresses from events', () => {
    const c = new ChallengeSystem(null);
    c.now = () => new Date(2026, 8, 23, 12);
    const d = c.daily();
    expect(d.id).toBe('daily.2026-09-23');
    expect(d.daily).toBe(true);
    expect(c.daily(new Date(2026, 8, 24)).id).toBe('daily.2026-09-24');
    // Drive it to completion with matching synthetic input.
    const cond = d.cond;
    let done: string[] = [];
    for (let i = 0; i < 10 && !done.length; i++) {
      if (cond.type === 'trick') {
        const aw = [award(cond.trick, i * 0.5)];
        if (cond.ghost) aw.push(award('ghost', i * 0.5, 150));
        done = c.push(kill({ t: i * 0.5, playerAirborne: true }), aw, style());
      } else if (cond.type === 'combo') {
        done = c.push(kill(), [award(cond.trick!)], style({ chainPoints: cond.points, variety: 1, chain: [award(cond.trick!)] }));
      }
    }
    expect(done).toEqual([d.id]);
    expect(c.daily().done).toBe(true);
  });

  it('daily templates: airborne and ghost conditions', () => {
    const c = new ChallengeSystem(null);
    // Find a date whose daily is an airborne one, and one that's a ghost one.
    let air: string | null = null;
    let ghost: string | null = null;
    for (let d = 0; d < 400 && (!air || !ghost); d++) {
      const key = localDateKey(new Date(2026, 0, 1 + d));
      const def = dailyChallengeFor(key);
      if (def.cond.type === 'trick' && def.cond.airborne) air ??= key;
      if (def.cond.type === 'trick' && def.cond.ghost) ghost ??= key;
    }
    expect(air).not.toBeNull();
    expect(ghost).not.toBeNull();
    const [ay, am, ad] = air!.split('-').map(Number);
    c.now = () => new Date(ay, am - 1, ad, 12);
    const da = c.daily();
    const trick = (da.cond as { trick: TrickId }).trick;
    expect(c.push(kill({ playerAirborne: false }), [award(trick)], style())).toEqual([]);
    expect(c.push(kill({ playerAirborne: true }), [award(trick)], style())).toEqual([da.id]);
    const [gy, gm, gd] = ghost!.split('-').map(Number);
    c.now = () => new Date(gy, gm - 1, gd, 12);
    const dg = c.daily();
    const gt = (dg.cond as { trick: TrickId }).trick;
    expect(c.push(kill(), [award(gt)], style())).toEqual([]);
    expect(c.push(kill(), [award(gt), award('ghost')], style())).toEqual([dg.id]);
  });
});

describe('persistence', () => {
  it('saves and restores completions and progress', () => {
    const st = new MemStorage();
    const a = new ChallengeSystem(st);
    a.setZone('pier');
    a.push(kill(), [award('returnToSender')], style());
    a.complete('lab.3');
    expect(st.getItem(CHALLENGE_STORAGE_KEY)).toBeTruthy();
    const b = new ChallengeSystem(st);
    expect(b.completed().has('lab.3')).toBe(true);
    expect(b.progress('pier.1')!.count).toBe(1);
  });

  it('reset() clears progress but keeps completions', () => {
    const st = new MemStorage();
    const a = new ChallengeSystem(st);
    a.setZone('pier');
    a.push(kill(), [award('returnToSender')], style());
    a.complete('yard.1');
    a.reset();
    expect(a.progress('pier.1')!.count).toBe(0);
    expect(a.completed().has('yard.1')).toBe(true);
    const b = new ChallengeSystem(st);
    expect(b.progress('pier.1')!.count).toBe(0);
    expect(b.completed().has('yard.1')).toBe(true);
  });

  it('tolerates throwing storage, null storage and corrupt data', () => {
    const broken = new ChallengeSystem(new BrokenStorage());
    broken.setZone('pier');
    expect(() => broken.push(kill(), [award('returnToSender')], style())).not.toThrow();
    expect(broken.complete('pier.3')).toBe(true);
    expect(() => broken.reset()).not.toThrow();
    expect(broken.completed().has('pier.3')).toBe(true);

    const none = new ChallengeSystem(null);
    expect(none.complete('pier.3')).toBe(true);

    const st = new MemStorage();
    st.setItem(CHALLENGE_STORAGE_KEY, '{not json');
    expect(() => new ChallengeSystem(st)).not.toThrow();
    st.setItem(CHALLENGE_STORAGE_KEY, JSON.stringify({ done: [1, 'pier.1', null], progress: { 'pier.2': 'x', 'yard.3': 0 } }));
    const c = new ChallengeSystem(st);
    expect(Array.from(c.completed())).toEqual(['pier.1']);
  });

  it('the default constructor works without localStorage (node)', () => {
    expect(() => new ChallengeSystem()).not.toThrow();
  });
});
