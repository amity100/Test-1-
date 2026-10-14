// Is the street's depth first (render/pipeline.js: the pens worked out once a pixel) faster on
// this computer? It depends on the graphics card: most leave out the hidden pixels before the
// pens are worked out, a software one pays for the extra pass and saves nothing. The picture is
// the same either way, so the game simply tries: a few seconds into play, frames in short turns
// with and without, and it keeps the faster. Once more after two minutes (another street, another
// load). ?depth / ?nodepth: fixed, no trying.
// (ROADMAP 11.4: and before it, the same way, the drawing in two passes - the surfaces, then the
// pens over the whole picture once a pixel - against the one pass it always was, where the player
// left it to the game: render/pipeline.js setPensMode)
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
    // (paused in the middle of one: tried again a little later)
    this.hold = 0;
    this.run = null;
    // what is tried, one after the other: the drawing in two passes (until its other shaders are
    // ready, render/pipeline.js pensOtherReady, it waits), then (11.5) the walls' depth alone first
    // (render/pipeline.js setWalls: a pass of depth much cheaper than the whole one, that leaves out
    // most of what is hidden behind them), then the whole depth first against what that chose
    this.knobs = [
      {
        key: 'pens',
        skip: () => pipe.pensFixed,
        wait: () => !pipe.pensOtherReady,
        get: () => pipe.deferred,
        set: (v) => pipe.setPens(v),
        pick: pickPens,
      },
      {
        key: 'walls',
        // (not while the whole depth is drawn first: then the walls' changes nothing)
        skip: () => pipe.wallsFixed || !pipe.walls || pipe.depthFirst,
        wait: () => false,
        get: () => pipe.wallsFirst,
        set: (v) => {
          pipe.wallsFirst = v;
        },
        pick: pickDepth,
      },
      {
        key: 'depth',
        skip: () => pipe.depthFixed,
        wait: () => false,
        get: () => pipe.depthFirst,
        set: (v) => {
          pipe.depthFirst = v;
        },
        pick: pickDepth,
      },
    ];
    this.queue = [];
    // the last answers: frame ms with and without, the card's ms, which was kept (result: the depth
    // first's, pens: the two passes', walls: the walls' depth first)
    this.result = null;
    this.pens = null;
    this.walls = null;
  }

  get busy() {
    return !!this.run;
  }

  // every frame (raw: how long it really took, s; playing: in play, not the test route; cost: what
  // the frame cost, s - with the steady pace the frames come on a fixed beat, and what they cost is
  // measured instead, game/pace.js)
  frame(raw, playing, cost = raw) {
    const pipe = this.pipe;
    if (this.run) {
      if (!playing) {
        // (paused, a menu: tried again a little later)
        this.stop();
        this.hold = this.played + 5;
        return;
      }
      this.step(cost);
      return;
    }
    if (!playing) return;
    this.played += raw;
    if (this.played < this.hold) return;
    if (!this.queue.length) {
      if (!this.at.length || this.played < this.at[0]) return;
      this.at.shift();
      this.queue = this.knobs.filter((k) => !k.skip());
    }
    // (the next one to try; one whose shaders are not ready yet waits its turn a little)
    const k = this.queue[0];
    if (!k) return;
    if (k.skip()) {
      this.queue.shift();
      return;
    }
    if (k.wait()) {
      if (this.queue.length > 1) this.queue.push(this.queue.shift());
      return;
    }
    this.queue.shift();
    this.run = { k, turn: 0, f: 0, sum: { on: 0, off: 0 }, n: { on: 0, off: 0 }, keep: k.get() };
    // (both ways' pictures kept while they are tried)
    pipe.keepSpare = true;
    k.set(false);
    this.timer.take();
    if (this.timer.ok) {
      pipe.mainTimer = this.timer;
      pipe.mainKey = () => (k.get() ? 'on' : 'off');
    }
  }

  stop() {
    const pipe = this.pipe;
    const r = this.run;
    this.run = null;
    if (r) {
      r.k.set(r.keep);
      this.queue.unshift(r.k);
    }
    pipe.mainTimer = null;
    pipe.mainKey = null;
    // (the other way's pictures let go once the way kept is drawn again: render/pipeline.js ensure)
    pipe.keepSpare = false;
  }

  step(raw) {
    const r = this.run;
    const mode = r.k.get() ? 'on' : 'off';
    if (r.f >= SKIP) {
      r.sum[mode] += raw;
      r.n[mode]++;
    }
    r.f++;
    this.timer.poll();
    if (r.f < TURN) return;
    r.f = 0;
    r.turn++;
    if (r.turn < TURNS) r.k.set(!r.k.get());
    else this.finish();
  }

  finish() {
    const r = this.run;
    const pipe = this.pipe;
    this.run = null;
    pipe.mainTimer = null;
    pipe.mainKey = null;
    this.timer.poll();
    const gpu = this.timer.take();
    const on = (r.sum.on / Math.max(1, r.n.on)) * 1000;
    const off = (r.sum.off / Math.max(1, r.n.off)) * 1000;
    const pick = r.k.pick(r.keep, on, off, gpu);
    r.k.set(pick);
    pipe.keepSpare = false;
    const res = { on: +on.toFixed(1), off: +off.toFixed(1), gpuOn: gpu.on ? +gpu.on.toFixed(2) : null, gpuOff: gpu.off ? +gpu.off.toFixed(2) : null, pick };
    if (r.k.key === 'pens') this.pens = res;
    else if (r.k.key === 'walls') this.walls = res;
    else this.result = res;
  }
}

// the card's own time for the pass, where it can be measured: with, only if it saves a tenth of it
// and the frames are no slower (the extra pass costs the processor a little). Otherwise the frames
// themselves, if they differ by more than 5%; else as it was
// (v5: where only the frames tell, the depth first has to be clearly faster, 7%, to be kept: on a
// phone the frames come and go by more than the 5% it was, and a depth first chosen by chance
// draws everything twice)
function pickDepth(keep, on, off, gpu) {
  if (gpu.on && gpu.off) return gpu.on < gpu.off * 0.9 && on < off * 1.05;
  if (on < off * 0.93) return true;
  if (off < on * 0.97) return false;
  return keep;
}

// (ROADMAP 11.4) the two passes, where the card's time tells: if the drawing takes it 5% less, and
// the frames are no slower. Otherwise by the frames, 5% either way; else as it was. (The picture is
// the same: the faster is kept)
function pickPens(keep, on, off, gpu) {
  if (gpu.on && gpu.off) return gpu.on < gpu.off * 0.95 && on < off * 1.05;
  if (on < off * 0.95) return true;
  if (off < on * 0.95) return false;
  return keep;
}
