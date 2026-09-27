import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { HitInfo, SpawnDef } from '../../src/core/contracts';
import type { Enemy } from '../../src/actors/enemies';
import { hdist } from '../../src/actors/aimath';
import { AI } from '../../src/actors/tuning';
import { spawn as levelSpawn } from '../../src/world/tower/zonekit';
import { scenario, V } from './fakes';

/**
 * Roles (DESIGN §5): every man of a mission-1 fight holds a post. A holder
 * stands at his (above the fight, out of reach on foot) and aims; an anchor
 * strafes inside his circle and may fall back once; a pusher walks at you but
 * stays in the fight. Squads cover a man in trouble. Nobody chases you around.
 */

type S = ReturnType<typeof scenario>;

const H = AI.hold;
const barks = (s: S, key: string, id?: number) => s.log.barks.filter((b) => b.key === key && (id === undefined || b.id === id)).length;

/** A flat-roofed block (x, z −8..8, 8 m up) on open ground, a nav layer on both floors. */
function roof() {
  const s = scenario();
  s.world.add({ x: -8, y: 0, z: -8 }, { x: 8, y: 8, z: 8 });
  s.sys.setNav(
    'pier',
    [
      { minX: -30, maxX: 30, minZ: -30, maxZ: 40, floorY: 0 },
      { minX: -9, maxX: 9, minZ: -9, maxZ: 9, floorY: 8 },
    ],
    s.world,
  );
  return s;
}

/** A holder on the roof's north edge, watching you in the yard 13 m out: in the fight, eyes on you. */
function holder(s: S = roof(), extra: Partial<SpawnDef> = {}) {
  s.setPlayer(0, 0, 20);
  const e = s.spawn('rifleman', V(0, 8, 6.8), 0, { role: 'holder', ...extra }) as Enemy;
  s.until(() => e.mode === 'combat' && e.seesPlayer, 4);
  return { s, e };
}

/** An anchor on open ground in a fight, you 15 m in front of him. */
function anchor(extra: Partial<SpawnDef> = {}, s: S = scenario()) {
  s.setPlayer(0, 0, 15);
  const e = s.spawn('rifleman', V(0, 0, 0), 0, { state: 'combat', role: 'anchor', ...extra }) as Enemy;
  s.until(() => e.seesPlayer, 1);
  return { s, e };
}

/** Out of everyone's sight and hearing (through a rift, far off). */
function vanish(s: S) {
  s.setPlayer(0, 0, -70);
}

describe('data: a level declares the ground each man holds', () => {
  it('the level spawn helper carries role, fallback (a copy) and leash; no role, no leash', () => {
    const fb = V(3, 0, -5);
    const d = levelSpawn('pier', 'x', 'rifleman', 1, 0, 2, 0, 'sq', { role: 'anchor', fallback: fb, leash: 4 });
    expect(d.role).toBe('anchor');
    expect(d.leash).toBe(4);
    expect(d.fallback!.equals(fb)).toBe(true);
    expect(d.fallback).not.toBe(fb);
    const plain = levelSpawn('pier', 'y', 'rifleman', 1, 0, 2, 0, 'sq');
    expect('role' in plain || 'fallback' in plain || 'leash' in plain).toBe(false);
  });

  it('spawned: his post is his spawn; the leash comes from the role unless the spawn sets it', () => {
    const s = scenario();
    const a = s.spawn('rifleman', V(1, 0, 2), 0, { role: 'anchor' }) as Enemy;
    const h = s.spawn('rifleman', V(5, 0, 2), 0, { role: 'holder' }) as Enemy;
    const p = s.spawn('warden', V(9, 0, 2), 0, { role: 'pusher' }) as Enemy;
    const l = s.spawn('rifleman', V(13, 0, 2), 0, { role: 'anchor', leash: 3 }) as Enemy;
    const n = s.spawn('rifleman', V(17, 0, 2), 0) as Enemy;
    expect(a.post.equals(V(1, 0, 2))).toBe(true);
    expect([a.leash, h.leash, p.leash, l.leash, n.leash]).toEqual([H.leash.anchor, H.leash.holder, H.leash.pusher, 3, Infinity]);
    expect([a.role, h.role, p.role, n.role]).toEqual(['anchor', 'holder', 'pusher', undefined]);
  });
});

describe('anchor: strafes inside his ground', () => {
  it('you out of range 30 m off: he closes in only as far as his leash, and every spot he picks is inside it', () => {
    const { s, e } = anchor();
    s.setPlayer(0, 0, 30);
    let far = 0, spots = 0;
    for (let i = 0; i < 60 * 20; i++) {
      s.step();
      far = Math.max(far, hdist(e.pos, e.post));
      if (e.hasSpot) {
        spots++;
        expect(hdist(e.spot, e.post)).toBeLessThanOrEqual(e.leash + 1e-6);
      }
    }
    expect(far).toBeLessThanOrEqual(e.leash + 0.5);
    expect(far).toBeGreaterThan(2); // he did move up (to the edge of his ground)
    expect(spots).toBeGreaterThan(0);
    // a man without a role walks all the way in
    const free = anchor({ role: undefined });
    free.s.setPlayer(0, 0, 30);
    free.s.step(60 * 20);
    expect(hdist(free.e.pos, V(0, 0, 0))).toBeGreaterThan(e.leash + 3);
  });

  it('his ground toward you ends at a drop: he picks a safe spot inside it with a line on you (a wall blocks the rest)', () => {
    const s = scenario();
    s.ground.enabled = false;
    s.world.add({ x: -8, y: -1, z: -8 }, { x: 8, y: 0, z: 2.5 }); // his platform ends 2.5 m in front of him
    s.world.add({ x: 1, y: 0, z: 0.6 }, { x: 8, y: 3, z: 1 }); // a wall across its east half: spots behind it can't see you
    const { e } = anchor({}, s);
    s.setPlayer(0, 0, 30); // his band (10–20 m from you) is all outside his 6 m circle
    const out = new THREE.Vector3();
    let found = 0;
    for (let i = 0; i < 40; i++) {
      e.groundTryT = -1e9;
      if (!s.sys.pickSpot(e, s.player.pos, e.tune.keepMin, e.tune.keepMax, out)) continue;
      found++;
      expect(hdist(out, e.post)).toBeLessThanOrEqual(e.leash + 1e-6);
      expect(s.world.lineOfSight(V(out.x, out.y + e.height * 0.92, out.z), s.player.chest)).toBe(true);
    }
    expect(found).toBeGreaterThan(20);
  });

  it('a goal pulled in onto something he can\'t stand on comes further in, to his side of it (not the nearest open cell beyond)', () => {
    const s = scenario();
    s.world.add({ x: -3, y: 0, z: 4.5 }, { x: 3, y: 2.6, z: 9 }); // a container across his ground's north edge
    s.sys.setNav('pier', [{ minX: -20, maxX: 20, minZ: -20, maxZ: 40, floorY: 0 }], s.world);
    const { e } = anchor({}, s);
    const leashed = (s.sys as unknown as { leashed(e: Enemy, g: THREE.Vector3, o: THREE.Vector3): THREE.Vector3 }).leashed.bind(s.sys);
    const g = s.sys.gridFor(e)!;
    const at = leashed(e, V(0, 0, 30), new THREE.Vector3());
    expect(g.walkable(at.x, at.z)).toBe(true);
    expect(at.z).toBeLessThan(4.5);
    expect(at.z).toBeGreaterThan(2.5);
    // and a hunt out there ends on this side of the container, inside his ground
    s.setPlayer(0, 0, 30);
    e.lastKnown.set(0, 0, 30);
    let far = 0;
    for (let i = 0; i < 60 * 8; i++) {
      s.step();
      far = Math.max(far, hdist(e.pos, e.post));
    }
    expect(far).toBeLessThanOrEqual(e.leash + 0.5);
    expect(e.pos.z).toBeLessThan(4.5);
  });

  it('lost you: the hunt, the search and the stand-down all happen inside his circle', () => {
    const { s, e } = anchor();
    s.setPlayer(0, 0, 22); // last seen 22 m out
    s.step(60);
    vanish(s);
    let far = 0;
    const t = s.until(() => {
      far = Math.max(far, hdist(e.pos, e.post));
      return e.mode === 'calm';
    }, 40);
    expect(t).toBeLessThan(40);
    expect(far).toBeLessThanOrEqual(e.leash + 0.5);
    expect(barks(s, 'bark.where', e.id)).toBe(1);
    expect(barks(s, 'bark.lost', e.id)).toBe(1);
  });
});

describe('holder: stands at his post and aims', () => {
  it('never leaves his 1.2 m, never looks for a spot, calls "Up top!" first and fires', () => {
    const s = roof();
    const asked: Enemy[] = [];
    const pick = s.sys.pickSpot.bind(s.sys);
    s.sys.pickSpot = (x: Enemy, c, a, b, o) => (asked.push(x), pick(x, c, a, b, o));
    const { e } = holder(s);
    expect(barks(s, 'bark.upTop', e.id)).toBe(1);
    expect(barks(s, 'bark.contact', e.id)).toBe(0);
    for (let i = 0; i < 60 * 20; i++) {
      s.step();
      expect(hdist(e.pos, e.post)).toBeLessThanOrEqual(H.leash.holder);
    }
    expect(s.log.bolts.filter((b) => b.id === e.id).length).toBeGreaterThanOrEqual(6);
    // you walk out from under him and out of sight: he looks for you from his post too
    vanish(s);
    s.until(() => e.mode === 'calm', 40);
    expect(hdist(e.pos, e.post)).toBeLessThanOrEqual(H.leash.holder + 0.6);
    expect(asked.includes(e)).toBe(false);
  });

  it('knocked 5 m along his own roof: back inside his post within 3 s, without firing on the way', () => {
    const { s, e } = holder();
    s.step(30);
    e.body!.pos.set(-5, 8, 6.8);
    s.sys.stagger(e, 0.3);
    s.until(() => e.state === 'combat', 1);
    expect(e.post.equals(V(0, 8, 6.8))).toBe(true); // same floor: his post stands
    const shots = s.log.telegraphs.length;
    const t = s.until(() => hdist(e.pos, e.post) <= H.leash.holder + H.returnSlack, 3);
    expect(t).toBeLessThan(3);
    expect(s.log.telegraphs.slice(shots).some((x) => x.id === e.id && x.t01 < 0.05)).toBe(false);
    // then he holds there and fights on
    s.step(60 * 4);
    expect(hdist(e.pos, e.post)).toBeLessThanOrEqual(H.leash.holder);
    expect(e.returning).toBe(false);
  });

  it('knocked along his roof while he searches, then he sees you: back to his post (a walk he stopped following never holds him out there)', () => {
    // (no word of you: he searches; knocked 6 m along the roof's north edge, the search walks him home)
    const s = roof();
    vanish(s);
    const e = s.spawn('rifleman', V(0, 8, 6.8), 0, { state: 'combat', role: 'holder' }) as Enemy;
    s.until(() => e.searching, 20);
    e.body!.pos.set(-6, 8, 6.8);
    s.sys.stagger(e, 0.3);
    s.until(() => e.state === 'combat' && e.hasGoal && e.pathLen > 0 && hdist(e.pos, e.post) < 5.5, 4);
    expect(hdist(e.pos, e.post)).toBeGreaterThan(H.leash.holder + H.returnSlack + 1);
    // ...and on the way you show yourself: a holder stands to aim, so that walk stops; he must still get back
    s.setPlayer(0, 0, 20);
    s.until(() => e.seesPlayer, 2);
    const t = s.until(() => hdist(e.pos, e.post) <= H.leash.holder + H.returnSlack, 4);
    expect(t, `stuck at ${e.pos.toArray().map((v) => v.toFixed(2))}`).toBeLessThan(4);
    s.step(60 * 3);
    expect(hdist(e.pos, e.post)).toBeLessThanOrEqual(H.leash.holder);
  });

  it('lost you: the search and the stand-down happen at his post (no walk toward where you were)', () => {
    const s = scenario();
    s.setPlayer(0, 0, 15);
    const e = s.spawn('rifleman', V(0, 0, 0), 0, { state: 'combat', role: 'holder' }) as Enemy;
    s.until(() => e.seesPlayer, 1);
    s.step(60);
    vanish(s);
    let far = 0;
    const t = s.until(() => {
      far = Math.max(far, hdist(e.pos, e.post));
      return e.mode === 'calm';
    }, 45);
    expect(t).toBeLessThan(45);
    expect(barks(s, 'bark.where', e.id)).toBe(1);
    expect(far).toBeLessThanOrEqual(0.3);
  });

  it('thrown down to the yard: he fights on from where he landed, as an anchor (no climb back, no fallback)', () => {
    const { s, e } = holder(roof(), { fallback: V(0, 8, 0) });
    e.body!.pos.set(3, 0, 13);
    s.sys.stagger(e, 0.3);
    s.until(() => e.state === 'combat', 1);
    expect(e.post.distanceTo(V(3, 0, 13))).toBeLessThan(0.3);
    expect(e.leash).toBe(H.leash.anchor);
    expect(e.role).toBe('anchor');
    expect(e.fellBack).toBe(true);
    const n = s.log.bolts.length;
    let far = 0;
    for (let i = 0; i < 60 * 8; i++) {
      s.step();
      far = Math.max(far, hdist(e.pos, e.post));
      expect(e.pos.y).toBeLessThan(1);
    }
    expect(far).toBeLessThanOrEqual(e.leash + 0.5);
    expect(s.log.bolts.slice(n).some((b) => b.id === e.id)).toBe(true);
    // (on the ground he's no lookout: no "Up top!" from him again)
    expect(barks(s, 'bark.upTop', e.id)).toBe(1);
  });

  it('stranded (a ledge off the walk grid): his post moves to him and he shoots from there, never frozen by the walk back', () => {
    const s = roof();
    s.world.add({ x: 40, y: 0, z: 18 }, { x: 42, y: 2.5, z: 20 }); // outside the nav bounds
    const { e } = holder(s);
    s.setPlayer(26, 0, 19);
    e.body!.pos.set(41, 2.5, 19);
    s.sys.stagger(e, 0.3);
    s.until(() => e.state === 'combat', 1);
    expect(e.stranded).toBe(true);
    expect(e.post.distanceTo(V(41, 2.5, 19))).toBeLessThan(0.05);
    const at = e.pos.clone();
    const n = s.log.bolts.length;
    s.step(60 * 5);
    expect(e.pos.distanceTo(at)).toBeLessThan(0.05);
    expect(s.log.bolts.slice(n).some((b) => b.id === e.id)).toBe(true);
  });

  it("thrown over into the next zone's yard (same height, a grid his post isn't on): he fights from where he landed, never parked at the grid's edge", () => {
    const s = scenario();
    s.sys.setNav('pier', [{ minX: -30, maxX: 30, minZ: -30, maxZ: 0, floorY: 0 }], s.world);
    s.sys.setNav('yard', [{ minX: -30, maxX: 30, minZ: 0, maxZ: 40, floorY: 0 }], s.world);
    s.setPlayer(12, 0, 12);
    const e = s.spawn('rifleman', V(0, 0, -7.4), 0, { state: 'combat', role: 'anchor' }) as Enemy;
    s.until(() => e.seesPlayer, 1);
    e.body!.pos.set(0.3, 0, 3);
    s.sys.stagger(e, 0.3);
    s.until(() => e.state === 'combat', 1);
    expect(e.post.distanceTo(V(0.3, 0, 3))).toBeLessThan(0.3);
    // (the same with no knockdown to run R3: walked or shoved over, the next look at his ground rebases him)
    const f = s.spawn('rifleman', V(4, 0, -6), 0, { state: 'combat', role: 'anchor' }) as Enemy;
    s.until(() => f.seesPlayer, 1);
    f.body!.pos.set(4, 0, 2.5);
    s.step(30);
    expect(hdist(f.post, V(4, 0, -6))).toBeGreaterThan(5);
    // both keep fighting from over there: they move and they shoot, nobody stands frozen at the edge
    const n = s.log.bolts.length;
    s.step(60 * 8);
    for (const m of [e, f]) expect(s.log.bolts.slice(n).some((b) => b.id === m.id), `${m.def.id} fires`).toBe(true);
  });

  it('thrown up onto the railing at his roof\'s edge: he steps down off it and walks back to his post (never parked on the rail)', () => {
    const s = roof();
    s.world.add({ x: 7.88, y: 8, z: -8 }, { x: 8, y: 9.1, z: 8 }, { seeThrough: true, noPortal: true, tag: 'rail' });
    s.setPlayer(0, 0, 20);
    const e = s.spawn('rifleman', V(0, 8, 0), 0, { state: 'combat', role: 'holder' }) as Enemy;
    s.until(() => e.seesPlayer, 2);
    e.body!.pos.set(7.94, 9.1, 0);
    s.sys.stagger(e, 0.3);
    s.step(60 * 6);
    expect(e.pos.y, 'off the rail, on his roof').toBeLessThan(8.2);
    expect(hdist(e.pos, V(0, 8, 0))).toBeLessThanOrEqual(H.leash.holder + H.returnSlack);
    // (had he been rebased up there, his ground would be the roof under him, not the rail's top)
    expect(e.post.y).toBe(8);
  });

  it('you come up onto his roof (a door, a swap): "He\'s up here!", once, and his squad learns where', () => {
    const s = roof();
    const mate = s.spawn('rifleman', V(0, 0, -20), Math.PI, { state: 'combat', role: 'anchor' }) as Enemy; // the block hides the roof from him
    const { e } = holder(s);
    s.step(60);
    expect(barks(s, 'bark.upHere')).toBe(0); // you on the ground: no
    s.setPlayer(-6, 8, 7.4);
    s.until(() => barks(s, 'bark.upHere') > 0, 1);
    expect(barks(s, 'bark.upHere', e.id)).toBe(1);
    expect(mate.seesPlayer).toBe(false);
    expect(hdist(mate.lastKnown, s.player.pos)).toBeLessThanOrEqual(AI.reportError * Math.SQRT2 + 1e-6);
    s.step(60 * 4);
    expect(barks(s, 'bark.upHere')).toBe(1);
  });
});

describe('anchor: one fallback, then he fights where he is', () => {
  it('you within 7 m: "Falling back!" and a run to his prepared post, which becomes his; once only', () => {
    const fb = V(0, 0, -8);
    const { s, e } = anchor({ fallback: fb });
    s.step(60 * 2);
    s.setPlayer(e.pos.x, 0, e.pos.z + 4);
    s.until(() => e.retreating, 1);
    expect(barks(s, 'bark.fallback', e.id)).toBe(1);
    const t = s.until(() => !e.retreating, 5);
    expect(t).toBeLessThan(5);
    expect(hdist(e.pos, fb)).toBeLessThan(1.5);
    expect(e.post.equals(fb)).toBe(true);
    expect(e.fellBack).toBe(true);
    // cornered: you come at him again; no second retreat, he stays in his new ground and fires
    s.setPlayer(e.pos.x + 1, 0, e.pos.z + 3);
    const n = s.log.bolts.length;
    let far = 0;
    for (let i = 0; i < 60 * 6; i++) {
      s.step();
      far = Math.max(far, hdist(e.pos, fb));
    }
    expect(barks(s, 'bark.fallback', e.id)).toBe(1);
    expect(far).toBeLessThanOrEqual(e.leash + 0.5);
    expect(s.log.bolts.slice(n).some((b) => b.id === e.id)).toBe(true);
  });

  it('never a run past you: with you nearer his fallback than him, he stands and fights', () => {
    const s = scenario();
    s.setPlayer(0, 0, -20);
    const e = s.spawn('rifleman', V(0, 0, 0), Math.PI, { state: 'combat', role: 'anchor', fallback: V(0, 0, -8) }) as Enemy;
    s.until(() => e.seesPlayer, 1);
    s.setPlayer(0, 0, -5);
    s.step(60 * 4);
    expect(barks(s, 'bark.fallback')).toBe(0);
    expect(e.fellBack).toBe(false);
    expect(e.post.equals(V(0, 0, 0))).toBe(true);
  });

  it('no fallback at all (cornered): you walk right up to him and he keeps shooting inside his ground', () => {
    const { s, e } = anchor();
    s.step(60);
    s.setPlayer(e.pos.x + 1, 0, e.pos.z + 3);
    const n = s.log.bolts.length;
    let far = 0;
    for (let i = 0; i < 60 * 6; i++) {
      s.step();
      far = Math.max(far, hdist(e.pos, e.post));
    }
    expect(e.retreating).toBe(false);
    expect(far).toBeLessThanOrEqual(e.leash + 0.5);
    expect(s.log.bolts.slice(n).some((b) => b.id === e.id)).toBe(true);
  });
});

describe('no endless chase', () => {
  /**
   * You walk straight at him from 20 m at 6 m/s and stay on him for 16 s: the
   * longest he keeps moving away from you (> 1.2 m/s), in all and in one go,
   * and the furthest he gets from his spawn.
   */
  function awayTime(extra: Partial<SpawnDef>) {
    const s = scenario();
    s.setPlayer(0, 0, 20);
    const e = s.spawn('rifleman', V(0, 0, 0), 0, { state: 'combat', ...extra }) as Enemy;
    s.until(() => e.seesPlayer, 1);
    s.step(60);
    let away = 0, run = 0, longest = 0, far = 0;
    const prev = e.pos.clone();
    for (let i = 0; i < 60 * 16; i++) {
      // you close in (at most to 2 m of him) and stay there
      const dx = e.pos.x - s.player.pos.x, dz = e.pos.z - s.player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 2) s.setPlayer(s.player.pos.x + (dx / d) * 0.1, 0, s.player.pos.z + (dz / d) * 0.1);
      s.step();
      const vx = (e.pos.x - prev.x) * 60, vz = (e.pos.z - prev.z) * 60;
      prev.copy(e.pos);
      const ax = e.pos.x - s.player.pos.x, az = e.pos.z - s.player.pos.z;
      const along = (vx * ax + vz * az) / Math.max(1e-6, Math.hypot(ax, az));
      if (along > 1.2) {
        away += 1 / 60;
        run += 1 / 60;
        longest = Math.max(longest, run);
      } else run = 0;
      far = Math.max(far, hdist(e.pos, e.def.pos));
    }
    return { away, longest, far, s, e };
  }

  it('an anchor gives ground only inside his circle and to his one fallback, in short steps; a free man keeps backing off', () => {
    const free = awayTime({});
    expect(free.far).toBeGreaterThan(H.leash.anchor + 5); // (the old way: you chase him across the map)
    const plain = awayTime({ role: 'anchor' });
    expect(plain.far).toBeLessThanOrEqual(H.leash.anchor + 0.5);
    expect(plain.longest).toBeLessThanOrEqual(2.5);
    expect(plain.away).toBeLessThan(free.away * 0.6);
    const withFb = awayTime({ role: 'anchor', fallback: V(0, 0, -6) });
    expect(barks(withFb.s, 'bark.fallback')).toBe(1);
    expect(withFb.far).toBeLessThanOrEqual(6 + H.leash.anchor + 0.5);
    expect(withFb.longest).toBeLessThanOrEqual(2.5 + 0.5); // the fallback run is the longest: 6 m at a run
  });

  it('a pusher (warden) walks at you, but never further than 18 m from where the fight put him', () => {
    const s = scenario();
    s.setPlayer(0, 0, -30);
    const w = s.spawn('warden', V(0, 0, 0), Math.PI, { state: 'combat', role: 'pusher' }) as Enemy;
    let far = 0;
    for (let i = 0; i < 60 * 20; i++) {
      s.step();
      far = Math.max(far, hdist(w.pos, w.post));
    }
    expect(far).toBeGreaterThan(H.leash.pusher - 1.5); // he came for you...
    expect(far).toBeLessThanOrEqual(H.leash.pusher + 0.5); // ...as far as the fight goes
  });
});

describe('covering fire', () => {
  const bolt = (): HitInfo => ({ source: 'bolt', amount: 5, charged: false, team: 'player', instigator: 'player' });

  /**
   * Three anchors of a squad in a zone that isn't running (they don't think:
   * the test asks for their turns). C has waited longer than A.
   */
  function queue(pressed: boolean) {
    const s = scenario(['pier']);
    const mk = (x: number) => s.spawn('rifleman', V(x, 0, 0), 0, { zone: 'yard', role: 'anchor' }) as Enemy;
    const a = mk(0), b = mk(3), c = mk(6);
    const other = s.spawn('rifleman', V(30, 0, 0), 0, { zone: 'yard', squad: 'z' }) as Enemy;
    s.step();
    a.seesPlayer = c.seesPlayer = true;
    // someone's turn has just ended: nobody new opens up for a moment
    s.sys.tryToken(other);
    s.sys.releaseToken(other);
    for (let i = 0; i < 6; i++) {
      expect(s.sys.tryToken(c)).toBe(false);
      s.step();
    }
    if (pressed) expect(s.sys.hit(b, bolt())).toBe('hurt');
    const order: Enemy[] = [];
    for (let i = 0; i < 180 && order.length < 2; i++) {
      for (const x of [a, c]) {
        if (order.includes(x)) continue;
        if (s.sys.tryToken(x)) {
          order.push(x);
          s.sys.releaseToken(x);
        }
      }
      s.step();
    }
    return { s, a, b, c, order };
  }

  it('a mate of the pressed man who sees you fires next, ahead of a longer wait; one "Covering!" a press', () => {
    const calm = queue(false);
    expect(calm.order[0]).toBe(calm.c); // the longest wait goes first
    expect(barks(calm.s, 'bark.covering')).toBe(0);
    const hot = queue(true);
    expect(hot.order[0]).toBe(hot.a);
    expect(hot.order[1]).toBe(hot.c); // (C covers too, but the call was made)
    expect(barks(hot.s, 'bark.covering')).toBe(1);
    expect(hot.s.log.barks.find((b) => b.key === 'bark.covering')!.id).toBe(hot.a.id);
  });

  it('the pressed man himself gets no cut in line, and the volley gap still holds', () => {
    const s = scenario(['pier']);
    const a = s.spawn('rifleman', V(0, 0, 0), 0, { zone: 'yard', role: 'anchor' }) as Enemy;
    const other = s.spawn('rifleman', V(30, 0, 0), 0, { zone: 'yard', squad: 'z' }) as Enemy;
    s.step();
    a.seesPlayer = true;
    s.sys.tryToken(other);
    s.sys.releaseToken(other);
    expect(s.sys.hit(a, bolt())).toBe('hurt');
    a.seesPlayer = true;
    // pressed or not, nobody opens up inside the volley gap
    expect(s.sys.tryToken(a)).toBe(false);
  });

  it('in a real fight: you close on one of them and a mate covers him; never more than two guns at once', () => {
    const s = scenario();
    s.setPlayer(0, 0, 16);
    const men = [V(-5, 0, 0), V(0, 0, 0), V(5, 0, 0)].map((p) => s.spawn('rifleman', p, 0, { state: 'combat', role: 'anchor' }) as Enemy);
    s.step(60 * 3);
    let most = 0;
    const t0 = s.clock.t;
    for (let i = 0; i < 60 * 8; i++) {
      // you stay right on the middle man
      s.setPlayer(men[1].pos.x + 1, 0, men[1].pos.z + 4);
      s.step();
      most = Math.max(most, s.sys.tokensInUse);
    }
    expect(most).toBeLessThanOrEqual(AI.maxTokens);
    const calls = s.log.barks.filter((b) => b.key === 'bark.covering' && b.t > t0);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls.every((b) => b.id !== men[1].id)).toBe(true);
  });

  it('grabbed, he presses his squad too', () => {
    const s = scenario(['pier']);
    const a = s.spawn('rifleman', V(0, 0, 0), 0, { zone: 'yard', role: 'anchor' }) as Enemy;
    const b = s.spawn('rifleman', V(3, 0, 0), 0, { zone: 'yard', role: 'anchor' }) as Enemy;
    const c = s.spawn('rifleman', V(6, 0, 0), 0, { zone: 'yard', role: 'anchor' }) as Enemy;
    s.step();
    a.seesPlayer = c.seesPlayer = true;
    for (let i = 0; i < 6; i++) {
      s.sys.tryToken(c);
      s.sys.releaseToken(c);
      s.step();
    }
    s.sys.hold(b, true);
    s.step();
    // (C just had a turn; A asks after him but covers the grabbed man)
    let first: Enemy | null = null;
    for (let i = 0; i < 120 && !first; i++) {
      if (s.sys.tryToken(a)) first = a;
      else if (s.sys.tryToken(c)) first = c;
      s.step();
    }
    expect(first).toBe(a);
  });
});

describe('calm again', () => {
  it('after a rebase and a stand-down, the idle walk goes to the post he holds now, not his spawn', () => {
    const { s, e } = holder();
    e.body!.pos.set(3, 0, 13);
    s.sys.stagger(e, 0.3);
    s.until(() => e.state === 'combat', 1);
    expect(e.post.distanceTo(e.def.pos)).toBeGreaterThan(5);
    s.step(60);
    vanish(s);
    s.until(() => e.mode === 'calm', 45);
    expect(e.mode).toBe('calm');
    s.step(60 * 8);
    expect(hdist(e.pos, e.post)).toBeLessThanOrEqual(1.3);
    expect(e.pos.y).toBeLessThan(1);
  });
});

describe('no garbage', () => {
  /** A method's body in the enemy system's source (brace-matched from its declaration). */
  const SRC = Object.values(import.meta.glob('../../src/actors/enemies.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)[0];
  function body(name: string) {
    const at = SRC.search(new RegExp(`\\n  (?:private )?${name}\\(`));
    expect(at, name).toBeGreaterThan(0);
    let i = SRC.indexOf('{', SRC.indexOf(')', at));
    const from = i;
    for (let depth = 0; i < SRC.length; i++) {
      if (SRC[i] === '{') depth++;
      else if (SRC[i] === '}' && --depth === 0) break;
    }
    return SRC.slice(from, i + 1);
  }

  it('the leash, holding ground, spot picks and turns to fire make nothing new per call (heap numbers aside)', () => {
    for (const name of ['leashed', 'holdGround', 'postOnHisFloor', 'rebase', 'pickSpot', 'spotInGround', 'tryToken', 'moveTo']) {
      const b = body(name);
      expect(b, name).not.toMatch(/\bnew\b|\.clone\(|=>|\.slice\(|\.map\(|\.filter\(/);
    }
    // a squad's press is made once, then reused
    const p = body('press');
    expect(p.match(/\{ until:/g)?.length).toBe(1);
    expect(p).toContain('if (!p)');
  });

  it('the leashed goal comes back in one scratch vector (or is the goal itself when it is inside)', () => {
    const { s, e } = anchor();
    const leashed = (s.sys as unknown as { leashed(e: Enemy, g: THREE.Vector3, o: THREE.Vector3): THREE.Vector3 }).leashed.bind(s.sys);
    const scratch = new THREE.Vector3();
    const far = V(0, 3, 40);
    expect(leashed(e, far, scratch)).toBe(scratch);
    expect(scratch.x).toBeCloseTo(0, 6);
    expect(scratch.z).toBeCloseTo(e.leash, 6);
    expect(scratch.y).toBe(3); // his goal's height kept
    const near = V(1, 0, 1);
    expect(leashed(e, near, scratch)).toBe(near);
  });
});
