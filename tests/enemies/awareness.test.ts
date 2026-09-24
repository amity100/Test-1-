import { describe, expect, it } from 'vitest';
import { aimSpread } from '../../src/actors/behaviors';
import type { Enemy } from '../../src/actors/enemies';
import { seePlayer } from '../../src/actors/perception';
import { AI } from '../../src/actors/tuning';
import { scenario, V } from './fakes';

/** A rifleman in a fight, who has had a good look at you (player 15 m ahead). */
function engaged(perch = false) {
  const s = scenario();
  s.step();
  const e = s.spawn('rifleman', V(0, 0, 0), 0, { state: 'combat', perch }) as Enemy;
  s.until(() => e.seesPlayer, 1);
  s.step(30);
  return { s, e };
}

/** Gone through a rift: far off, out of everyone's sight. */
function vanish(s: ReturnType<typeof scenario>) {
  s.setPlayer(0, 0, -70);
  return s.clock.t;
}

describe('what they know', () => {
  it("joiners get the spotter's last known spot (give or take), never the truth, and hold fire until they see you", () => {
    const s = scenario();
    const spotter = s.spawn('rifleman', V(0, 0, 5), 0) as Enemy; // player 10 m ahead
    const mate = s.spawn('rifleman', V(-20, 0, -20), Math.PI) as Enemy; // far, facing away
    s.until(() => spotter.mode === 'combat', 4);
    expect(mate.mode).toBe('combat');
    const seen = s.player.pos.clone();
    expect(mate.seesPlayer).toBe(false);
    expect(mate.lastKnown.equals(seen)).toBe(false);
    expect(Math.abs(mate.lastKnown.x - spotter.lastKnown.x)).toBeLessThanOrEqual(AI.reportError);
    expect(Math.abs(mate.lastKnown.z - spotter.lastKnown.z)).toBeLessThanOrEqual(AI.reportError);
    // you slip away: nobody learns where you went
    const t0 = vanish(s);
    const d0 = mate.pos.distanceTo(seen);
    s.step(60 * 4);
    expect(mate.lastKnown.distanceTo(seen)).toBeLessThan(AI.reportError * Math.SQRT2 + 1e-6);
    expect(spotter.lastKnown.distanceTo(seen)).toBeLessThan(0.5);
    expect(mate.pos.distanceTo(seen)).toBeLessThan(d0 - 5); // he came to look
    // nobody fires at what they can't see (a lock already running may finish on your old spot)
    expect(s.log.telegraphs.some((t) => t.id === mate.id)).toBe(false);
    expect(s.log.telegraphs.some((t) => t.t > t0 + 1)).toBe(false);
  });

  it('in combat he looks ±90° over his full sight range, not all round; up close he feels you anyway', () => {
    const s = scenario();
    const e = s.spawn('rifleman', V(0, 0, 0), 0) as Enemy;
    s.step();
    e.mode = 'combat';
    e.yaw = 0;
    const at = (deg: number, r: number) => {
      const a = (deg * Math.PI) / 180;
      s.setPlayer(Math.sin(a) * r, 0, Math.cos(a) * r);
      return seePlayer(e, s.ctx) >= 0;
    };
    expect(at(80, 10)).toBe(true);
    expect(at(100, 10)).toBe(false);
    expect(at(180, 10)).toBe(false);
    expect(at(180, AI.nearSense - 0.5)).toBe(true);
    expect(at(0, 30)).toBe(true);
    expect(at(0, 34)).toBe(false); // 32 m: no 1.25x once he's fighting
  });
});

describe('losing track', () => {
  it('no word of you for 5 s: he searches where you were; 12 s later he stands down, then calms', () => {
    const { s, e } = engaged();
    const seen = e.lastKnown.clone();
    const t0 = vanish(s);
    const tSearch = s.until(() => e.searching, 8);
    expect(tSearch).toBeGreaterThan(AI.loseTrack - 0.3);
    expect(tSearch).toBeLessThan(AI.loseTrack + AI.loseTrackVary + 0.3);
    expect(e.mode).toBe('combat');
    expect(s.log.barks.some((b) => b.key === 'bark.where' && b.id === e.id)).toBe(true);
    // a careful walk over to your last known spot, then a look around nearby
    let closest = Infinity;
    const tDown = s.until(() => {
      closest = Math.min(closest, Math.hypot(e.pos.x - seen.x, e.pos.z - seen.z));
      return e.mode !== 'combat';
    }, 16);
    expect(closest).toBeLessThan(1);
    expect(tDown).toBeGreaterThan(AI.search.time - 0.3);
    expect(tDown).toBeLessThan(AI.search.time + AI.search.vary + 0.3);
    expect(e.mode).toBe('suspicious');
    expect(e.state).toBe('suspicious');
    expect(e.searching).toBe(false);
    expect(e.alertT).toBeGreaterThan(0);
    expect(s.sys.isHot('pier')).toBe(false);
    expect(s.log.barks.some((b) => b.key === 'bark.lost' && b.id === e.id)).toBe(true);
    // he never fired at you while you were gone
    expect(s.log.telegraphs.some((t) => t.t > t0 + 1)).toBe(false);
    const tCalm = s.until(() => e.mode === 'calm', 12);
    expect(tCalm).toBeLessThan(9);
  });

  it('after standing down he notices you again faster than a fresh guard', () => {
    const { s, e } = engaged();
    vanish(s);
    s.until(() => e.mode === 'calm', 30);
    // back at his post, still on edge; you walk into view 12 m in front of it
    s.until(() => Math.hypot(e.pos.x, e.pos.z) < 1.2, 20);
    s.step(60);
    expect(e.alertT).toBeGreaterThan(0);
    s.setPlayer(0, 0, 12);
    const alert = s.until(() => e.mode === 'combat', 6);
    const fresh = scenario();
    fresh.setPlayer(0, 0, 12);
    const g = fresh.spawn('rifleman', V(0, 0, 0), 0) as Enemy;
    const calm = fresh.until(() => g.mode === 'combat', 6);
    expect(alert).toBeLessThan(calm * 0.7);
  });

  it('a searching man who sees you again calls it and re-engages after a short reaction', () => {
    const { s, e } = engaged();
    vanish(s);
    s.until(() => e.searching, 8);
    s.step(60 * 2);
    // you step back into view in front of him
    const f = e.forward(V());
    s.setPlayer(e.pos.x + f.x * 10, 0, e.pos.z + f.z * 10);
    const back = s.clock.t;
    const seenIn = s.until(() => e.seesPlayer, 1);
    expect(seenIn).toBeLessThan(AI.senseInterval + 0.05);
    s.step();
    expect(e.searching).toBe(false);
    expect(s.log.barks.some((b) => b.key === 'bark.there' && b.id === e.id)).toBe(true);
    s.until(() => e.atk === 'aim', 3);
    const react = s.clock.t - back;
    expect(react).toBeGreaterThan(AI.reacquire[0]);
    expect(react).toBeLessThan(AI.reacquire[1] + AI.senseInterval + 0.1);
  });

  it('a noise while he searches brings him to it', () => {
    const { s, e } = engaged();
    vanish(s);
    s.until(() => e.searching, 8);
    s.player.noise.push({ at: V(-12, 0, 6), radius: 20 });
    s.step();
    s.player.noise.length = 0;
    expect(e.searching).toBe(false);
    expect(e.lastKnown.distanceTo(V(-12, 0, 6))).toBeLessThan(1e-6);
    s.step(60 * 6);
    expect(Math.hypot(e.pos.x + 12, e.pos.z - 6)).toBeLessThan(1.5);
  });
});

describe('fire rhythm', () => {
  it('riflemen hold fire beyond their effective range and close in', () => {
    const s = scenario();
    s.step();
    s.setPlayer(0, 0, 28);
    const post = s.spawn('rifleman', V(0, 0, 0), 0, { state: 'combat', perch: true }) as Enemy;
    s.step(60 * 6);
    expect(post.seesPlayer).toBe(true);
    expect(s.log.telegraphs.length).toBe(0);
    s.setPlayer(0, 0, 18);
    s.until(() => s.log.bolts.length > 0, 4);
    expect(s.log.bolts.length).toBeGreaterThan(0);

    const w = scenario();
    w.step();
    w.setPlayer(0, 0, 32);
    const walker = w.spawn('rifleman', V(0, 0, 0), 0, { state: 'combat' }) as Enemy;
    w.until(() => w.log.bolts.length > 0, 12);
    const first = w.log.telegraphs[0];
    expect(Math.hypot(first.from.x, first.from.z - 32)).toBeLessThan(AI.rifle.range);
    expect(walker.pos.z).toBeGreaterThan(8);
  });

  it('no metronome: the pause between his bursts varies', () => {
    const s = scenario();
    s.step();
    s.setPlayer(0, 0, 12);
    const e = s.spawn('rifleman', V(0, 0, 0), 0, { state: 'combat', perch: true }) as Enemy;
    const starts: number[] = [];
    let prev = e.atk;
    for (let i = 0; i < 60 * 60; i++) {
      s.step();
      if (e.atk === 'aim' && prev !== 'aim') starts.push(s.clock.t);
      prev = e.atk;
    }
    const gaps = starts.slice(1).map((t, i) => t - starts[i]);
    expect(gaps.length).toBeGreaterThan(8);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(1.5);
  });

  it('after a shooter’s turn the squad pauses before the next one opens up', () => {
    const s = scenario();
    s.step();
    const list = [-8, -4, 0, 4, 8].map((x) => s.spawn('rifleman', V(x, 0, 0), 0, { state: 'combat', perch: true }) as Enemy);
    const busy = (e: Enemy) => e.atk === 'aim' || e.atk === 'fire';
    const was = list.map(busy);
    let lastEnd = -Infinity;
    let checked = 0;
    for (let i = 0; i < 60 * 20; i++) {
      s.step();
      list.forEach((e, k) => {
        const now = busy(e);
        if (now && !was[k]) {
          expect(s.clock.t - lastEnd).toBeGreaterThan(AI.volleyGap[0] - 0.02);
          checked++;
        }
        if (!now && was[k]) lastEnd = s.clock.t;
        was[k] = now;
      });
    }
    expect(checked).toBeGreaterThan(8);
    expect(AI.volleyGap[0]).toBeGreaterThanOrEqual(0.5);
  });

  it('two shooters never lock on in the same breath', () => {
    const s = scenario();
    s.step();
    const list = [-8, -4, 0, 4, 8].map((x) => s.spawn('rifleman', V(x, 0, 0), 0, { state: 'combat', perch: true }) as Enemy);
    const was = list.map(() => false);
    let last = -Infinity;
    let starts = 0;
    for (let i = 0; i < 60 * 20; i++) {
      s.step();
      list.forEach((e, k) => {
        const now = e.atk === 'aim' || e.atk === 'fire';
        if (now && !was[k]) {
          expect(s.clock.t - last).toBeGreaterThan(AI.volleyStagger[0] - 0.02);
          last = s.clock.t;
          starts++;
        }
        was[k] = now;
      });
    }
    expect(starts).toBeGreaterThan(8);
    expect(AI.volleyStagger[0]).toBeGreaterThanOrEqual(0.2);
  });

  it('aim opens with range and your speed, and settles with a long clear look', () => {
    expect(aimSpread(25, 0, 10)).toBeGreaterThan(aimSpread(10, 0, 10));
    expect(aimSpread(15, 6, 10)).toBeGreaterThan(aimSpread(15, 0, 10) * 2);
    expect(aimSpread(15, 0, 0)).toBeCloseTo(aimSpread(15, 0, 10) * AI.rifle.coldAim, 9);
    expect(aimSpread(15, 0, AI.rifle.settle)).toBeCloseTo(aimSpread(15, 0, 60), 9);

    // measured: bolts stray further from the laser at a far, sprinting target than a near, still one
    const stray = (dist: number, speed: number) => {
      const s = scenario();
      s.step();
      s.setPlayer(0, 0, dist);
      s.player.vel.set(speed, 0, 0);
      const e = s.spawn('rifleman', V(0, 0, 0), 0, { state: 'combat', perch: true }) as Enemy;
      s.until(() => s.log.bolts.length >= 24, 60);
      let sum = 0;
      for (const b of s.log.bolts) {
        const lock = s.log.telegraphs.find((t) => t.id === e.id && t.t === b.t)!;
        sum += Math.acos(Math.min(1, b.dir.dot(lock.to.clone().sub(b.from).normalize())));
      }
      return sum / s.log.bolts.length;
    };
    expect(stray(22, 6)).toBeGreaterThan(stray(8, 0) * 2);
  });
});
