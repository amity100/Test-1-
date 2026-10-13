// Is the street's depth first (render/pipeline.js: the pens worked out once a pixel) faster on
// this computer? It depends on the graphics card: most leave out the hidden pixels before the
// pens are worked out, a software one pays for the extra pass and saves nothing. The picture is
// the same either way, so the game simply tries: a few seconds into play, frames in short turns
// with and without, and it keeps the faster. Once more after two minutes (another street, another
// load). ?depth / ?nodepth: fixed, no trying.
import { GpuTimer } from '../game/perf.js';

const TURN = 20; // frames a turn
const TURNS = 8; // four with, four without, in turns
const SKIP = 3; // the first frames of a turn are not counted (the change settling)

export class DepthTrial {
  constructor(pipe, gl) {
    this.pipe = pipe;
    // (the card's own time for the pass, where the browser lets it be measured)
    this.timer = new GpuTimer(gl);
    this.at = [4, 120];
    this.played = 0;
    this.run = null;
    // the last answer: frame ms with and without, the card's ms, which was kept
    this.result = null;
  }

  get busy() {
    return !!this.run;
  }

  // every frame (raw: how long it really took, s; playing: in play, not the test route; cost: what
  // the frame cost, s - with the steady pace the frames come on a fixed beat, and what they cost is
  // measured instead, game/pace.js)
  frame(raw, playing, cost = raw) {
    const pipe = this.pipe;
    if (pipe.depthFixed) return;
    if (this.run) {
      if (!playing) {
        // (paused, a menu: tried again a little later)
        pipe.depthFirst = this.run.keep;
        pipe.mainTimer = null;
        this.run = null;
        this.at.unshift(this.played + 5);
        return;
      }
      this.step(cost);
      return;
    }
    if (!playing) return;
    this.played += raw;
    if (!this.at.length || this.played < this.at[0]) return;
    this.at.shift();
    this.run = { turn: 0, f: 0, sum: { on: 0, off: 0 }, n: { on: 0, off: 0 }, keep: pipe.depthFirst };
    pipe.depthFirst = false;
    this.timer.take();
    if (this.timer.ok) pipe.mainTimer = this.timer;
  }

  step(raw) {
    const r = this.run;
    const pipe = this.pipe;
    const mode = pipe.depthFirst ? 'on' : 'off';
    if (r.f >= SKIP) {
      r.sum[mode] += raw;
      r.n[mode]++;
    }
    r.f++;
    this.timer.poll();
    if (r.f < TURN) return;
    r.f = 0;
    r.turn++;
    if (r.turn < TURNS) pipe.depthFirst = !pipe.depthFirst;
    else this.finish();
  }

  finish() {
    const r = this.run;
    const pipe = this.pipe;
    this.run = null;
    pipe.mainTimer = null;
    this.timer.poll();
    const gpu = this.timer.take();
    const on = (r.sum.on / Math.max(1, r.n.on)) * 1000;
    const off = (r.sum.off / Math.max(1, r.n.off)) * 1000;
    // the card's own time for the pass, where it can be measured: with, only if it saves a
    // tenth of it and the frames are no slower (the extra pass costs the processor a little).
    // Otherwise the frames themselves, if they differ by more than 5%; else as it was
    // (v5: where only the frames tell, the depth first has to be clearly faster, 7%, to be kept: on
    // a phone the frames come and go by more than the 5% it was, and a depth first chosen by
    // chance draws everything twice)
    let pick = r.keep;
    if (gpu.on && gpu.off) pick = gpu.on < gpu.off * 0.9 && on < off * 1.05;
    else if (on < off * 0.93) pick = true;
    else if (off < on * 0.97) pick = false;
    pipe.depthFirst = pick;
    this.result = { on: +on.toFixed(1), off: +off.toFixed(1), gpuOn: gpu.on ? +gpu.on.toFixed(2) : null, gpuOff: gpu.off ? +gpu.off.toFixed(2) : null, pick };
  }
}
