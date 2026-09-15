/**
 * Frame budget meter. `?debug=perf` shows where a frame goes: the JS cost of each subsystem, the
 * render submission, the GPU time when the driver exposes a timer query, and what the scene is
 * asking of the card (draw calls, triangles, resolution). Off, every call here is a property read
 * and a branch, so the instrumentation can live in the hot path all year round.
 */

interface Sample {
  /** Milliseconds accumulated since the last report. */
  acc: number;
  /** Milliseconds per frame, averaged over the last report window. */
  avg: number;
}

/** Labels are listed in this order in the overlay; anything else follows, alphabetically. */
const ORDER = ['frame', 'game', 'sim', 'bots', 'chars', 'hud', 'vfx', 'sky', 'chunks', 'submit'];

export class Perf {
  on = false;
  /** Set by the renderer each frame when a GPU timer query resolved (ms), else -1. */
  gpuMs = -1;
  private samples = new Map<string, Sample>();
  private frames = 0;
  private acc = 0;
  private el: HTMLPreElement | null = null;
  private info: () => string = () => '';
  private worstFrame = 0;
  private worstShown = 0;

  /** Timestamp for a following `add`, or 0 when the meter is off (the caller's `add` then no-ops). */
  now(): number {
    return this.on ? performance.now() : 0;
  }

  /** Adds the time since `start` to a label. */
  add(label: string, start: number): void {
    if (!this.on || start === 0) return;
    const s = this.samples.get(label);
    const ms = performance.now() - start;
    if (s) s.acc += ms;
    else this.samples.set(label, { acc: ms, avg: 0 });
  }

  /** Adds a measured millisecond count directly. */
  addMs(label: string, ms: number): void {
    if (!this.on) return;
    const s = this.samples.get(label);
    if (s) s.acc += ms;
    else this.samples.set(label, { acc: ms, avg: 0 });
  }

  /** Called once per rendered frame with the real frame time. */
  tick(rawDt: number, info: () => string): void {
    if (!this.on) return;
    this.info = info;
    this.frames++;
    this.acc += rawDt;
    this.worstFrame = Math.max(this.worstFrame, rawDt * 1000);
    if (this.acc < 1) return;
    const n = Math.max(1, this.frames);
    for (const s of this.samples.values()) {
      s.avg = s.acc / n;
      s.acc = 0;
    }
    this.worstShown = this.worstFrame;
    this.worstFrame = 0;
    this.render(n / this.acc);
    this.frames = 0;
    this.acc = 0;
  }

  /** Averages the accumulators over `frames` frames and clears them (probes drive the loop themselves). */
  snapshot(frames: number): Record<string, number> {
    for (const s of this.samples.values()) {
      s.avg = s.acc / Math.max(1, frames);
      s.acc = 0;
    }
    return this.report();
  }

  /** The last reported averages, for probes. */
  report(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, s] of this.samples) out[k] = Math.round(s.avg * 1000) / 1000;
    return out;
  }

  private render(fps: number): void {
    if (!this.el) {
      const pre = document.createElement('pre');
      pre.className = 'perf-overlay';
      pre.setAttribute('data-ui', '1');
      document.body.appendChild(pre);
      this.el = pre;
    }
    const keys = Array.from(this.samples.keys()).sort((a, b) => {
      const ia = ORDER.indexOf(a);
      const ib = ORDER.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a < b ? -1 : 1;
    });
    const lines = [`${fps.toFixed(0)} fps   worst ${this.worstShown.toFixed(1)} ms   gpu ${this.gpuMs >= 0 ? `${this.gpuMs.toFixed(1)} ms` : 'n/a'}`];
    for (const k of keys) {
      const ms = this.samples.get(k)!.avg;
      if (ms < 0.005) continue;
      lines.push(`${k.padEnd(9)} ${ms.toFixed(2)} ms`);
    }
    lines.push(this.info());
    this.el.textContent = lines.join('\n');
  }
}

export const perf = new Perf();
