import type * as THREE from 'three';

export interface WatchdogEvent {
  frame: number;
  /** fraction of sampled pixels that are (near) black */
  dark: number;
  /** mean luma of the sampled pixels, 0..255 */
  mean: number;
  kind: 'black' | 'blotch';
}

/**
 * Detects fully black frames and sudden large black blotches (the NaN/Inf-through-bloom signature) by
 * reading two rows of the default framebuffer right after a frame was rendered (same task, so it works
 * with preserveDrawingBuffer: false). Meant for test runs (?test=1) and field diagnostics (?watchdog=1):
 * each sample is a GPU sync, so keep `every` >= 10 in real play.
 */
export class FrameWatchdog {
  frames = 0;
  sampled = 0;
  black = 0;
  blotches = 0;
  lastDark = 0;
  lastMean = 0;
  /** frames sampled while `ignore()` returned true (intentional fades: never flagged) */
  ignored = 0;
  readonly events: WatchdogEvent[] = [];
  /**
   * Frames for which this returns true are sampled but never flagged, and the next frame is not compared with
   * them: intentional dips to black / fades, e.g. `watchdog.ignore = () => engine.post.intentionallyDark`.
   */
  ignore: (() => boolean) | null = null;
  private buf = new Uint8Array(4);
  private prevDark = -1;

  constructor(private renderer: THREE.WebGLRenderer, public every = 1) {}

  /** Call right after the frame was rendered. Returns true when the frame was flagged. */
  afterFrame(): boolean {
    this.frames++;
    if (this.every > 1 && this.frames % this.every !== 0) return false;
    const gl = this.renderer.getContext();
    if (gl.isContextLost()) return false;
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    if (w < 2 || h < 2) return false;
    if (this.buf.length < w * 4) this.buf = new Uint8Array(w * 4);
    let n = 0, dark = 0, sum = 0;
    for (const fy of [0.3, 0.55, 0.8]) {
      gl.readPixels(0, Math.floor(h * fy), w, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.buf);
      for (let x = 0; x < w; x += 2) {
        const i = x * 4;
        const l = 0.2126 * this.buf[i] + 0.7152 * this.buf[i + 1] + 0.0722 * this.buf[i + 2];
        sum += l;
        if (l < 4) dark++;
        n++;
      }
    }
    this.sampled++;
    const d = dark / Math.max(1, n);
    this.lastDark = d;
    this.lastMean = sum / Math.max(1, n);
    let flagged = false;
    if (this.ignore?.()) {
      this.ignored++;
      this.prevDark = -1;
      return false;
    }
    if (d > 0.97) {
      this.black++;
      this.events.push({ frame: this.frames, dark: d, mean: this.lastMean, kind: 'black' });
      flagged = true;
    } else if (this.prevDark >= 0 && d - this.prevDark > 0.2) {
      this.blotches++;
      this.events.push({ frame: this.frames, dark: d, mean: this.lastMean, kind: 'blotch' });
      flagged = true;
    }
    if (this.events.length > 200) this.events.splice(0, this.events.length - 200);
    this.prevDark = d;
    return flagged;
  }

  stats() {
    return { frames: this.frames, sampled: this.sampled, ignored: this.ignored, black: this.black, blotches: this.blotches, lastDark: this.lastDark, lastMean: this.lastMean, events: this.events.slice(-20) };
  }
}
