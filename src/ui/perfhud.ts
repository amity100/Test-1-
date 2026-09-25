/**
 * Performance overlay (off by default; pause menu or settings): real numbers
 * from the player's own device. DOM text, written 4 times a second in one
 * go; never drawn into the canvas, so photos and clips don't show it.
 */
export interface PerfInfo {
  /** Render size in device pixels (the scene's, after the dynamic scale). */
  width: number;
  height: number;
  /** The pixel ratio in use and the device's own. */
  dpr: number;
  deviceDpr: number;
  /** Dynamic resolution scale per axis (1 = full). */
  scale: number;
  samples: number;
  preset: string;
  /** GPU ms of a recent frame (null where the browser has no timer query). */
  gpuMs: number | null;
  gpuName: string;
  /** Draw calls and triangles of the last frame: rift views, shadows and post included. */
  calls: number;
  tris: number;
}

const WINDOW_MS = 2000;
const UPDATE_MS = 250;

/** fps and frame-interval stats over a window of rAF timestamps (pure: tested). */
export function frameStats(intervals: number[]) {
  if (!intervals.length) return { fps: 0, mean: 0, p95: 0, worst: 0 };
  let sum = 0, worst = 0;
  for (const v of intervals) {
    sum += v;
    if (v > worst) worst = v;
  }
  const s = [...intervals].sort((a, b) => a - b);
  const p95 = s[Math.min(s.length - 1, Math.floor(0.95 * s.length))];
  const mean = sum / intervals.length;
  return { fps: mean > 0 ? 1000 / mean : 0, mean, p95, worst };
}

export class PerfHud {
  readonly el: HTMLPreElement;
  private on = false;
  private times: number[] = [];
  private intervals: number[] = [];
  private cpu: number[] = [];
  private gpu: number[] = [];
  private lastT = -1;
  private lastWrite = 0;

  constructor(root: HTMLElement, private info: () => PerfInfo) {
    this.el = document.createElement('pre');
    this.el.className = 'perfhud';
    this.el.setAttribute('dir', 'ltr');
    this.el.setAttribute('aria-hidden', 'true');
    this.el.style.display = 'none';
    root.appendChild(this.el);
  }

  get shown() {
    return this.on;
  }

  show(on: boolean) {
    this.on = on;
    this.el.style.display = on ? '' : 'none';
    if (on) {
      this.times.length = this.intervals.length = this.cpu.length = this.gpu.length = 0;
      this.lastT = -1;
      this.lastWrite = 0;
    }
  }

  /** One frame: its rAF timestamp and the JS ms the game spent in it. */
  frame(now: number, cpuMs: number) {
    if (!this.on) return;
    if (this.lastT >= 0) {
      const iv = now - this.lastT;
      this.times.push(now);
      this.intervals.push(iv);
      this.cpu.push(cpuMs);
      const g = this.info().gpuMs;
      this.gpu.push(g ?? NaN);
      while (this.times.length && now - this.times[0] > WINDOW_MS) {
        this.times.shift();
        this.intervals.shift();
        this.cpu.shift();
        this.gpu.shift();
      }
    }
    this.lastT = now;
    if (now - this.lastWrite >= UPDATE_MS) {
      this.lastWrite = now;
      this.write();
    }
  }

  private write() {
    const i = this.info();
    const f = frameStats(this.intervals);
    const avg = (a: number[]) => {
      let s = 0, n = 0;
      for (const v of a) if (Number.isFinite(v)) (s += v), n++;
      return n ? s / n : null;
    };
    const cpu = avg(this.cpu);
    const gpu = avg(this.gpu);
    const ms = (v: number | null) => (v == null ? 'n/a' : v.toFixed(1));
    const k = (v: number) => (v >= 1000 ? (v / 1000).toFixed(v >= 1e5 ? 0 : 1) + 'k' : String(v));
    this.el.textContent =
      `${f.fps.toFixed(f.fps < 10 ? 1 : 0)} fps  frame ${ms(f.mean)} ms  p95 ${ms(f.p95)}  worst ${ms(f.worst)}\n` +
      `cpu ${ms(cpu)} ms  gpu ${ms(gpu)} ms\n` +
      `${i.width}x${i.height}  dpr ${i.dpr.toFixed(2)}/${i.deviceDpr.toFixed(2)}  scale ${i.scale.toFixed(2)}  msaa ${i.samples}  ${i.preset}\n` +
      `draws ${i.calls}  tris ${k(i.tris)}\n` +
      i.gpuName;
  }
}
