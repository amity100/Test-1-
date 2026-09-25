/**
 * Dynamic-resolution safety net. The game renders at full resolution; only
 * when a device can't keep up for a sustained stretch (thermal throttling, a
 * weak GPU in a heavy fight) does the scene's resolution step down, a little
 * at a time, never below `floor` per axis, and it steps back up as soon as
 * there is room. Post (grade, grain, bloom size) stays at full resolution.
 *
 * Pure: fed one sample per displayed frame (rAF interval, JS ms, GPU ms when
 * the browser has a timer query), it returns the scale to render the next
 * frame at. Unit-tested (tests/render/dynres.test.ts).
 */
export interface DynResOptions {
  /** Lowest scale per axis (0.85: at least 72% of the pixels). */
  floor: number;
  step: number;
  /** A frame interval longer than this is over budget (60 fps with some slack). */
  overMs: number;
  /** Frames looked at, and how many of them must be over budget to step down. */
  window: number;
  overCount: number;
  /** Intervals longer than this are hitches (GC, a tab switch, loading), not load: ignored. */
  spikeMs: number;
  /** Time between two steps down at least. */
  cooldownMs: number;
  /** GPU-bound: timer GPU ms above this; without a timer, JS ms below cpuBoundMs. */
  gpuBoundMs: number;
  cpuBoundMs: number;
  /** With a timer: step up after upAfterMs of GPU ms below upGpuMs. */
  upGpuMs: number;
  upAfterMs: number;
  /** Without a timer: probe one step up after probeAfterMs; if the drop comes back, hold for holdMs. */
  probeAfterMs: number;
  holdMs: number;
  /**
   * At the floor, a window of frames whose mean interval isn't at least this much shorter (fraction)
   * than when the first step down was taken: the lower resolution bought nothing (a 30 Hz rAF in iOS
   * Low Power Mode or a battery saver, a compositor or CPU limit the JS timer misses). Back to full
   * resolution, and no stepping down for futileHoldMs.
   */
  minGain: number;
  futileHoldMs: number;
}

export const DYNRES_DEFAULTS: DynResOptions = {
  floor: 0.85,
  step: 0.05,
  overMs: 18.5,
  window: 60,
  overCount: 45,
  spikeMs: 100,
  cooldownMs: 1000,
  gpuBoundMs: 15,
  cpuBoundMs: 10,
  upGpuMs: 12,
  upAfterMs: 3000,
  probeAfterMs: 5000,
  holdMs: 20000,
  minGain: 0.05,
  futileHoldMs: 60000,
};

interface Sample {
  iv: number;
  over: boolean;
  cpu: number;
  gpu: number | null;
}

export class DynRes {
  readonly opt: DynResOptions;
  /** Scale per axis the scene renders at (1 = full). */
  scale = 1;
  /** Adapting (in play). Menus, pause and replays keep the scale they have. */
  active = true;
  /** A fixed scale (tests, photos, the benchmark): no adapting while set. */
  pinned: number | null = null;
  private samples: Sample[] = [];
  private lastDown = -Infinity;
  private lastChange = -Infinity;
  private goodSince = -1;
  private probing = false;
  private holdUntil = -Infinity;
  /** Mean frame interval of the window that took the first step down from full resolution (0: none). */
  private downFrom = 0;
  /** No stepping down before this (a drop that bought nothing). */
  private futileUntil = -Infinity;

  constructor(opt: Partial<DynResOptions> = {}) {
    this.opt = { ...DYNRES_DEFAULTS, ...opt };
  }

  /** The scale to render at now. */
  get current(): number {
    return this.pinned ?? this.scale;
  }

  /** Back to full resolution, history forgotten (a new level, a quality change). */
  reset() {
    this.scale = 1;
    this.samples.length = 0;
    this.lastDown = this.lastChange = this.holdUntil = this.futileUntil = -Infinity;
    this.downFrom = 0;
    this.goodSince = -1;
    this.probing = false;
  }

  /**
   * One displayed frame. `now` ms (monotonic), `intervalMs` since the previous
   * frame, `cpuMs` the JS time of the frame, `gpuMs` from a timer query (null
   * when the browser has none). Returns the scale for the next frame.
   */
  sample(now: number, intervalMs: number, cpuMs: number, gpuMs: number | null): number {
    const o = this.opt;
    if (this.pinned !== null) return this.pinned;
    if (!this.active) {
      this.samples.length = 0;
      this.goodSince = -1;
      return this.scale;
    }
    if (!(intervalMs > 0) || intervalMs > o.spikeMs) return this.scale;
    const s = this.samples;
    s.push({ iv: intervalMs, over: intervalMs > o.overMs, cpu: cpuMs, gpu: gpuMs });
    if (s.length > o.window) s.shift();

    // at the floor, a full window no faster than before the first step: the drop bought nothing
    if (s.length >= o.window && this.scale <= o.floor + 1e-6 && this.scale < 1 - 1e-6 && this.downFrom > 0) {
      if (meanInterval(s) > this.downFrom * (1 - o.minGain)) {
        this.set(1, now);
        this.futileUntil = now + o.futileHoldMs;
        this.downFrom = 0;
        this.probing = false;
        s.length = 0;
        this.goodSince = -1;
        return this.scale;
      }
    }

    // down: most of the last second over budget, and the GPU is why
    if (s.length >= o.window && this.scale > o.floor + 1e-6 && now - this.lastDown >= o.cooldownMs && now >= this.futileUntil) {
      let over = 0, cpu = 0, gpu = 0, gpuN = 0;
      for (const q of s) {
        if (q.over) over++;
        cpu += q.cpu;
        if (q.gpu != null) (gpu += q.gpu), gpuN++;
      }
      cpu /= s.length;
      const gpuBound = gpuN >= s.length / 2 ? gpu / gpuN > o.gpuBoundMs : cpu < o.cpuBoundMs;
      if (over >= o.overCount && gpuBound) {
        // a probe up that brought the drop back (within a few seconds): stay down a while
        if (this.probing && now - this.lastChange < o.probeAfterMs) this.holdUntil = now + o.holdMs;
        this.probing = false;
        if (this.scale >= 1 - 1e-6) this.downFrom = meanInterval(s);
        this.set(this.scale - o.step, now);
        this.lastDown = now;
        s.length = 0;
        this.goodSince = -1;
        return this.scale;
      }
    }

    // up
    if (this.scale < 1 - 1e-6) {
      if (gpuMs != null) {
        if (gpuMs < o.upGpuMs) {
          if (this.goodSince < 0) this.goodSince = now;
          if (now - this.goodSince >= o.upAfterMs) {
            this.set(this.scale + o.step, now);
            this.goodSince = now;
          }
        } else this.goodSince = -1;
      } else if (now - this.lastChange >= o.probeAfterMs && now >= this.holdUntil) {
        let over = 0;
        for (const q of s) if (q.over) over++;
        // (only when the recent frames aren't mostly over budget anyway)
        if (over < o.overCount) {
          this.set(this.scale + o.step, now);
          this.probing = true;
          s.length = 0;
        }
      }
    }
    return this.scale;
  }

  private set(v: number, now: number) {
    this.scale = Math.round(Math.min(1, Math.max(this.opt.floor, v)) * 100) / 100;
    this.lastChange = now;
  }
}

function meanInterval(s: readonly Sample[]): number {
  let t = 0;
  for (const q of s) t += q.iv;
  return s.length ? t / s.length : 0;
}
