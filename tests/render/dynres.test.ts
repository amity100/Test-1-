import { describe, expect, it } from 'vitest';
import { DynRes } from '../../src/render/dynres';

/** Feed `n` frames of `iv` ms each (cpu / gpu ms per frame); returns the time after them. */
function run(d: DynRes, t: number, n: number, iv: number, cpu: number, gpu: number | null) {
  for (let i = 0; i < n; i++) {
    t += iv;
    d.sample(t, iv, cpu, gpu);
  }
  return t;
}

describe('dynamic resolution', () => {
  it('stays at full resolution while frames are within budget', () => {
    const d = new DynRes();
    run(d, 0, 2000, 16.7, 4, 12);
    expect(d.scale).toBe(1);
    // a few slow frames in a second is not sustained overload
    let t = 0;
    for (let i = 0; i < 1200; i++) {
      const iv = i % 60 < 40 ? 25 : 16;
      t += iv;
      d.sample(t, iv, 4, 16);
    }
    expect(d.scale).toBe(1);
  });

  it('steps down under sustained GPU overload, never below the floor', () => {
    const d = new DynRes();
    // (the GPU's time follows the pixel count: each step makes frames a little faster, never fast enough)
    let t = 0;
    for (let i = 0; i < 20000; i++) {
      const iv = 33 * d.scale * d.scale;
      t += iv;
      d.sample(t, iv, 5, 30 * d.scale * d.scale);
    }
    expect(d.scale).toBeCloseTo(0.85, 6);
    expect(d.scale).toBeGreaterThanOrEqual(d.opt.floor);
  });

  it('gives the pixels back when the drop bought nothing (a 30 Hz rAF: Low Power Mode, no timer)', () => {
    const d = new DynRes();
    // every frame 33 ms whatever the resolution, little JS: looks GPU-bound without a timer
    let t = run(d, 0, 60 * 3, 33.3, 3, null);
    expect(d.scale).toBeCloseTo(0.85, 6);
    // a full window at the floor, no faster: back to full resolution...
    t = run(d, t, 60, 33.3, 3, null);
    expect(d.scale).toBe(1);
    // ...and it stays there for a minute
    t = run(d, t, 1700, 33.3, 3, null);
    expect(d.scale).toBe(1);
    // (then it may try again)
    run(d, t, 110, 33.3, 3, null);
    expect(d.scale).toBe(0.95);
  });

  it('steps 0.05 at a time, at most once a second, each on a fresh window of frames', () => {
    const d = new DynRes();
    let t = run(d, 0, 59, 25, 5, 22);
    expect(d.scale).toBe(1);
    t = run(d, t, 1, 25, 5, 22);
    expect(d.scale).toBe(0.95);
    // the next step needs another full window (60 frames at 25 ms = 1.5 s)
    t = run(d, t, 59, 25, 5, 22);
    expect(d.scale).toBe(0.95);
    run(d, t, 1, 25, 5, 22);
    expect(d.scale).toBe(0.9);
  });

  it('never steps on CPU-bound frames (timer: GPU fast; no timer: JS slow)', () => {
    const withTimer = new DynRes();
    run(withTimer, 0, 3000, 30, 25, 9);
    expect(withTimer.scale).toBe(1);
    const noTimer = new DynRes();
    run(noTimer, 0, 3000, 30, 22, null);
    expect(noTimer.scale).toBe(1);
    // ...but without a timer, slow frames with little JS are the GPU's
    const gpuBound = new DynRes();
    run(gpuBound, 0, 60, 30, 4, null);
    expect(gpuBound.scale).toBe(0.95);
  });

  it('ignores hitches (GC, tab switch, loading)', () => {
    const d = new DynRes();
    run(d, 0, 500, 150, 5, 40);
    expect(d.scale).toBe(1);
  });

  it('with a timer, steps back up after 3 s of GPU headroom', () => {
    const d = new DynRes();
    let t = run(d, 0, 60, 30, 5, 28);
    expect(d.scale).toBe(0.95);
    t = run(d, t, 170, 16.7, 4, 9); // 2.8 s
    expect(d.scale).toBe(0.95);
    run(d, t, 20, 16.7, 4, 9); // past 3 s
    expect(d.scale).toBe(1);
  });

  it('without a timer, probes up after 5 s and holds 20 s when the drop comes back (hysteresis)', () => {
    const d = new DynRes();
    let t = run(d, 0, 60, 30, 4, null);
    expect(d.scale).toBe(0.95);
    // fine at 0.95 (no longer over budget): after 5 s it probes back up
    t = run(d, t, 280, 16.7, 4, null);
    expect(d.scale).toBe(0.95);
    t = run(d, t, 40, 16.7, 4, null);
    expect(d.scale).toBe(1);
    // the drop comes back at full resolution: down again...
    t = run(d, t, 60, 30, 4, null);
    expect(d.scale).toBe(0.95);
    // ...and no new probe for 20 s, even though frames are fine again
    t = run(d, t, 900, 16.7, 4, null); // 15 s
    expect(d.scale).toBe(0.95);
    run(d, t, 420, 16.7, 4, null); // past 20 s
    expect(d.scale).toBe(1);
  });

  it('does not adapt while inactive (menus, pause, replays) and a pin wins', () => {
    const d = new DynRes();
    d.active = false;
    run(d, 0, 3000, 40, 4, 35);
    expect(d.scale).toBe(1);
    d.active = true;
    d.pinned = 1;
    expect(run(d, 0, 3000, 40, 4, 35) && d.current).toBe(1);
    d.pinned = null;
    run(d, 0, 60, 40, 4, 35);
    expect(d.current).toBe(0.95);
    d.reset();
    expect(d.current).toBe(1);
  });
});
