// The steady pace (ROADMAP 11.3: a choice in the settings, "קצב הפריימים"). As it always was, a
// frame is drawn at every refresh of the screen, as fast as it can be, and the drawing's resolution
// steps down or up by a tenth when a second of frames was slow or fast (game/game.js loop): fast
// most of the time, then a slow frame now and then, and a step you can see. The steady pace does
// what the biggest games do instead:
//
//  1. A fixed beat. The screen shows a picture at every refresh (60 times a second, 120 on some); a
//     new one is drawn every N of them, always the same N, so each picture stays on the screen as
//     long as the one before (N: what this device keeps up, or what the player picked).
//  2. Even time. Each frame moves the game on by just those N refreshes, not by the clock's jitter,
//     so what moves, moves evenly.
//  3. The drawing's resolution follows how long the frames take, a pixel or two at a time
//     (render/pipeline.js dyn). The pictures it is drawn into are made big enough once: nothing is
//     made anew for it, and nothing the smart drawing has gathered is lost. What is measured is the
//     time from the frame's start to when the graphics card has finished it (a fence put in its
//     queue after the frame), so a frame running long is seen before a frame is late, not after.
//  4. Heavy work spread over more frames: the still city's next shadow map in eight slices, one a
//     frame (render/pipeline.js updateStatic).
// What is far away is not left out more for it: things showing up as you look at them would be a
// jump of their own (the city already leaves out what is too far to make out).

// the screens' refresh rates (Hz), to snap a measured one to
const SNAP = [24, 30, 48, 50, 60, 72, 75, 85, 90, 100, 120, 144, 165, 180, 240];
// a steady beat is between these (frames a second)
const MAX_FPS = 92;
const MIN_FPS = 27;
// a frame against its time (N refreshes): over HI it has to get lighter, under LO it may get
// heavier, and a change aims at MID
const HI = 0.82;
const MID = 0.72;
const LO = 0.6;
export const PACE_MODES = ['free', 'auto', '60', '30'];

// The decisions alone (no browser in them: tools/pace-sim.mjs runs them against a made-up device).
export class PaceControl {
  constructor() {
    // auto: the fastest beat the frames keep; 60, 30: that beat (as near as the screen allows)
    this.mode = 'auto';
    // the screen's refresh (ms), the beat (refreshes a frame), and the beats to choose from
    this.R = 1000 / 60;
    this.N = 1;
    this.level = 0;
    this.choices = [1];
    // the drawing's size against its own (render/pipeline.js dyn): its limits, as wanted, as drawn
    this.lo = 1;
    this.hi = 1;
    this.taa = false;
    this.want = 1;
    this.dyn = 1;
    // the drawn frames counted, and the first whose measure counts since the last change
    this.frame = 0;
    this.changedAt = 0;
    this.reset();
    // (auto) a faster beat not tried again before this (ms), and for how long the last time
    this.retryAt = [];
    this.backoff = [];
    this.upAt = -1e9;
  }

  reset() {
    // the frame's time to the card's end (ms) and the processor's part of it: quick to rise, slow
    // to fall (a heavy frame counts at once, light ones little by little)
    this.ema = 0;
    this.cpuE = 0;
    // (measures over the frame's time one after another, and late frames lately: one alone is a
    // hiccup - a pause of the page, a frame the card took long over - and fewer pixels would not
    // have helped it; two close together are the load)
    this.hot = 0;
    this.lateHeat = 0;
    this.calm = 0;
    this.strain = 0;
    this.ease = 0;
    this.boost = 0;
    this.cpuBound = false;
  }

  setRefresh(R) {
    this.R = R;
    this.pickBeat();
  }

  pickBeat() {
    const R = this.R;
    const c = [];
    for (let n = 1; n <= 10; n++) {
      const f = 1000 / (n * R);
      if (f <= MAX_FPS + 0.5 && f >= MIN_FPS) c.push(n);
    }
    if (!c.length) c.push(1);
    this.choices = c;
    // (60 or 30: the beat of the screen's nearest to it, the faster one if between two)
    const fixed = (fps) => Math.max(1, Math.floor(1000 / fps / R + 0.15));
    if (this.mode === '60') this.N = fixed(60);
    else if (this.mode === '30') this.N = fixed(30);
    else {
      this.level = Math.min(this.level, c.length - 1);
      this.N = c[this.level];
    }
  }

  // the drawing's limits (render/pipeline.js), and whether it is the smart drawing
  setLimits(lo, hi, taa) {
    this.lo = lo;
    this.hi = hi;
    this.taa = taa;
    this.want = Math.min(hi, Math.max(lo, this.want));
    if (this.apply()) this.changedAt = this.frame + 1;
  }

  // the size drawn, from the size wanted: with the smart drawing just that (a pixel or two less or
  // more each frame, gathered over the frames, is nothing you can see); without it in steps of
  // 2.5%, so the picture does not swim while the size moves. True if it changed
  apply() {
    let d = this.want;
    if (!this.taa) {
      const q = Math.min(this.hi, Math.max(this.lo, Math.round(d * 40) / 40));
      const atEnd = (d <= this.lo + 1e-6 && this.dyn > this.lo + 1e-6) || (d >= this.hi - 1e-6 && this.dyn < this.hi - 1e-6);
      d = Math.abs(d - this.dyn) >= 0.02 || atEnd ? q : this.dyn;
    }
    if (d === this.dyn) return false;
    this.dyn = d;
    return true;
  }

  // a drawn frame finished on the graphics card, L ms after it began, cpu of them the processor's
  // (frameNo: which frame; now: ms). True when the drawing's size or the beat changed
  measure(frameNo, L, cpu, now) {
    this.lateHeat *= 0.95;
    if (frameNo < this.changedAt) return false;
    const up = (e, x) => (e <= 0 ? x : x > e ? e + 0.5 * (x - e) : e + 0.08 * (x - e));
    this.ema = up(this.ema, L);
    this.cpuE = up(this.cpuE, cpu);
    this.hot = L > HI * this.N * this.R ? this.hot + 1 : 0;
    return this.decide(now);
  }

  decide(now) {
    const B = this.N * this.R;
    // the graphics card's part beyond the processor's: the part the pixels make
    const card = Math.max(0.3, this.ema - this.cpuE);
    const over = this.ema > HI * B && this.hot >= 2;
    let w = this.want;
    // (the processor alone fills the frame's time: fewer pixels would not make it shorter)
    this.cpuBound = this.cpuE > HI * B * 0.92;
    if (over) {
      this.calm = 0;
      // (the card's part made as short as leaves the frame at MID, or at least a tenth of it)
      const room = Math.max(MID * B, this.cpuE + 0.1 * B) - this.cpuE;
      if (!this.cpuBound) w *= Math.max(0.92, Math.min(0.99, Math.sqrt(room / card)));
    } else {
      this.calm++;
      // (more pixels only after a while of frames with room to spare, and slowly: while the frame
      // they would make still has room in it - more room left over the drawing's own size)
      if (this.calm > 20) {
        let w2 = Math.min(this.hi, w * (this.boost > 0 ? 1.015 : this.taa ? 1.004 : 1.003));
        // (to the drawing's own size first, then over it)
        if (w < 1 && w2 > 1) w2 = 1;
        const pred = this.cpuE + card * (w2 / this.dyn) ** 2;
        if (pred < (w2 > 1 + 1e-6 ? LO : MID) * B) w = w2;
      }
    }
    if (this.boost > 0) this.boost--;
    this.want = Math.min(this.hi, Math.max(this.lo, w));
    const beat = this.mode === 'auto' ? this.autoBeat(now, card, over) : false;
    const changed = this.apply() || beat;
    if (changed) this.changedAt = this.frame + 1;
    return changed;
  }

  // (auto) a slower beat when even the fewest pixels do not fit the frames in it; a faster one when
  // they would fit it with most of the pixels, for a few seconds on end
  autoBeat(now, card, over) {
    const c = this.choices;
    const floor = this.want <= this.lo + 1e-3;
    if (over && (floor || this.cpuBound)) this.strain++;
    else this.strain = Math.max(0, this.strain - 2);
    if (this.strain >= 40 && this.level < c.length - 1) {
      // (a faster beat tried a moment ago that did not hold: not again for a while, longer each time)
      if (now - this.upAt < 8000) {
        const b = (this.backoff[this.level] = Math.min(300000, (this.backoff[this.level] || 10000) * 2));
        this.retryAt[this.level] = now + b;
      }
      this.level++;
      this.N = c[this.level];
      this.strain = 0;
      this.ease = 0;
      this.calm = 0;
      // (the pixels come back quicker after it)
      this.boost = 90;
      return true;
    }
    if (this.level > 0 && now >= (this.retryAt[this.level - 1] || 0)) {
      const Bf = c[this.level - 1] * this.R;
      const d = Math.max(this.lo, 0.8);
      const pred = this.cpuE + card * (d / this.dyn) ** 2;
      this.ease = pred < MID * Bf ? this.ease + 1 : 0;
      if (this.ease >= 150) {
        this.level--;
        this.N = c[this.level];
        // (the drawing as big as the faster beat leaves room for, and no bigger than it was)
        const room = Math.max(0.05, MID * Bf - this.cpuE);
        this.want = Math.max(this.lo, Math.min(this.want, this.dyn * Math.sqrt(room / card)));
        this.ease = 0;
        this.strain = 0;
        this.calm = 0;
        this.upAt = now;
        return true;
      }
    } else this.ease = 0;
    return false;
  }

  // a drawn frame came k refreshes after its beat (the one before ran long, or the page held it up)
  lateFrame(k) {
    this.calm = 0;
    this.lateHeat += 1;
    if (this.lateHeat < 1.6) return;
    if (!this.cpuBound && this.want > this.lo) {
      this.want = Math.max(this.lo, this.want * 0.97);
      if (this.apply()) this.changedAt = this.frame + 1;
    }
    if (this.mode === 'auto' && (this.want <= this.lo + 1e-3 || this.cpuBound)) this.strain += 4 * Math.min(k, 3);
  }
}

export class Pace {
  constructor(game) {
    this.game = game;
    this.pipe = game.pipe;
    const gl = (this.gl = game.renderer.getContext());
    this.fenceOk = typeof gl.fenceSync === 'function';
    this.ctl = new PaceControl();
    this.mode = 'free';
    // the pipeline in the steady pace (not during the test route: game.js loop)
    this.engaged = false;
    this.justFreed = false;
    this.frozen = false;
    // the screen's refresh, measured between two animation frames with none drawn in between (the
    // one left out is quick: the gap is the screen's own)
    this.pure = new Float64Array(24);
    this.sorted = new Float64Array(24);
    this.pureN = 0;
    this.pureI = 0;
    this.pureNew = 0;
    this.lastTs = 0;
    this.lastDrawTs = 0;
    this.cb = 0;
    this.skipped = false;
    // (drawn every other refresh for a few frames, to measure it: when it is turned on, and when the
    // time between frames stops matching it)
    this.calib = 0;
    this.drift = 1;
    this.lateRun = 0;
    // the real time from the last drawn frame to this one (ms), refreshes it was late by
    this.interval = 1000 / 60;
    this.late = 0;
    // the fences in the card's queue (records kept for reuse: nothing made each frame)
    this.q = [];
    this.pool = [];
    this.pollT = 0;
    this.pollFn = () => this.poll();
    this.lastL = 0;
    // (the panel: of the last 240 frames, how many came on their beat)
    this.onTime = new Uint8Array(240);
    this.otI = 0;
    this.otN = 0;
    this.otSum = 0;
  }

  get on() {
    return this.mode !== 'free';
  }

  // the measured cost of a frame for the depth trial (render/depthtrial.js), s
  get cost() {
    return this.lastL > 0 ? this.lastL / 1000 : this.interval / 1000;
  }

  setMode(m) {
    if (!PACE_MODES.includes(m)) m = 'free';
    if (m === this.mode) return;
    this.mode = m;
    const c = this.ctl;
    c.mode = m === 'free' ? 'auto' : m;
    c.level = 0;
    c.retryAt.length = 0;
    c.backoff.length = 0;
    c.upAt = -1e9;
    c.pickBeat();
    // (the beat begins afresh, measured again)
    if (this.engaged) this.begin();
  }

  // the pipeline in the steady pace, or as it always was (each animation frame, game.js loop)
  engage(on) {
    if (on === this.engaged) return;
    this.engaged = on;
    const p = this.pipe;
    if (on) {
      // (the drawing at its own size to begin with: the steady pace moves it from there)
      if (p.defaultScale) p.scale = p.defaultScale;
      if (p.defaultTaaFrac) p.taaFrac = p.defaultTaaFrac;
      p.steady = true;
      this.begin();
    } else {
      p.steady = false;
      p.dyn = 1;
      if (p.reflEveryDefault) p.reflEvery = p.reflEveryDefault;
      this.justFreed = true;
      this.drain();
    }
  }

  begin() {
    const c = this.ctl;
    c.want = 1;
    c.dyn = 1;
    c.reset();
    c.changedAt = c.frame + 1;
    this.pipe.dyn = 1;
    this.limits();
    this.calib = 6;
    this.pureN = 0;
    this.pureNew = 0;
    this.lastDrawTs = 0;
    this.drift = 1;
    this.lateRun = 0;
    this.otN = 0;
    this.otSum = 0;
    this.otI = 0;
  }

  // dyn's limits: those of the resolution the drawing may come down to and go up to (main.js)
  limits() {
    const p = this.pipe;
    const lo = p.taa ? p.taaMin / p.taaFrac : (p.minScale || p.scale) / p.scale;
    const hi = p.taa ? p.taaMax / p.taaFrac : (p.maxScale || p.scale) / p.scale;
    this.ctl.setLimits(Math.min(1, lo), Math.max(1, hi), p.taa);
    p.dynMax = this.ctl.hi;
    this.toPipe();
  }

  toPipe() {
    const p = this.pipe;
    const c = this.ctl;
    p.dyn = c.dyn;
    // (the mirror under the street every frame when there is time for it: a phone draws it every
    // other one at 60 a second, main.js)
    if (p.reflEveryDefault) p.reflEvery = c.N * c.R >= 25 ? 1 : p.reflEveryDefault;
  }

  // Each animation frame (ts: its time, ms): 0 to leave it out, else the game's step for it (s)
  beat(ts) {
    const iv = this.lastTs ? ts - this.lastTs : 0;
    this.lastTs = ts;
    if (this.skipped && iv > 2 && iv < 70) this.refresh(iv);
    // (the card's answers looked at here too, between the quick looks after each frame)
    if (this.q.length && !this.pollT) this.poll();
    const c = this.ctl;
    const R = c.R;
    if (!this.lastDrawTs || ts - this.lastDrawTs > 1000) {
      // the first frame, or back from a pause in the browser (another tab): drawn at once, the
      // game moved on as it always was (at most a twentieth of a second)
      const el = this.lastDrawTs ? ts - this.lastDrawTs : R;
      this.lastDrawTs = ts;
      this.cb = 0;
      this.skipped = false;
      this.interval = el;
      this.late = 0;
      c.frame++;
      return Math.min(0.05, el / 1000);
    }
    this.cb++;
    const el = ts - this.lastDrawTs;
    // refreshes since the last drawn frame (counted, or by the time, if the page held some up)
    const vb = Math.max(this.cb, Math.floor(el / R + 0.3));
    const n = this.calib > 0 ? 2 : c.N;
    if (vb < n) {
      this.skipped = true;
      return 0;
    }
    this.skipped = false;
    if (this.calib > 0) this.calib--;
    this.lastDrawTs = ts;
    this.cb = 0;
    this.interval = el;
    this.late = vb - n;
    c.frame++;
    this.limits();
    // (the time between frames not what the refreshes say: the screen's refresh is not what was
    // measured, measured again. Or frames late one after another with time to spare in them: the
    // browser itself gives fewer frames than the screen shows - a phone saving its battery)
    this.drift += (el / (vb * R) - this.drift) * 0.05;
    this.lateRun = this.late > 0 && c.ema < 0.5 * n * R ? this.lateRun + 1 : 0;
    if (this.calib === 0 && (this.drift < 0.85 || this.drift > 1.18 || this.lateRun > 30)) {
      this.calib = 6;
      this.drift = 1;
      this.lateRun = 0;
      this.pureN = 0;
      this.pureNew = 0;
    }
    if (this.calib === 0) {
      const ok = this.late === 0 ? 1 : 0;
      if (this.otN < this.onTime.length) this.otN++;
      else this.otSum -= this.onTime[this.otI];
      this.onTime[this.otI] = ok;
      this.otSum += ok;
      this.otI = (this.otI + 1) % this.onTime.length;
      if (this.late > 0 && !this.frozen) {
        c.lateFrame(this.late);
        this.toPipe();
      }
    }
    return Math.min(0.05, (vb * R) / 1000);
  }

  // a gap between two animation frames with nothing drawn between them (ms): the screen's refresh
  refresh(iv) {
    this.pure[this.pureI] = iv;
    this.pureI = (this.pureI + 1) % this.pure.length;
    if (this.pureN < this.pure.length) this.pureN++;
    if (++this.pureNew < (this.calib > 0 ? 4 : 8)) return;
    this.pureNew = 0;
    // the middle one of them (one held up by the page does not count)
    const a = this.sorted;
    const n = this.pureN;
    for (let i = 0; i < n; i++) {
      const v = this.pure[i];
      let j = i;
      while (j > 0 && a[j - 1] > v) {
        a[j] = a[j - 1];
        j--;
      }
      a[j] = v;
    }
    const med = a[n >> 1];
    let R = med;
    for (const hz of SNAP) {
      const r = 1000 / hz;
      if (Math.abs(med - r) < r * 0.035) {
        R = r;
        break;
      }
    }
    const c = this.ctl;
    if (Math.abs(R - c.R) > c.R * 0.03) {
      c.setRefresh(R);
      this.toPipe();
    }
  }

  // the frame is sent to the graphics card (t0: when it began, t1: now; drawn: the city was drawn):
  // a fence after it in the card's queue, looked at until the card has passed it
  sent(t0, t1, drawn) {
    if (!this.fenceOk || this.q.length >= 6) return;
    const gl = this.gl;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) return;
    gl.flush();
    const f = this.pool.pop() || { sync: null, t0: 0, t1: 0, seen: 0, drawn: false, n: 0 };
    f.sync = sync;
    f.t0 = t0;
    f.t1 = t1;
    f.seen = t1;
    f.drawn = drawn;
    f.n = this.ctl.frame;
    this.q.push(f);
    if (!this.pollT) this.pollT = setTimeout(this.pollFn, 1);
  }

  poll() {
    this.pollT = 0;
    const gl = this.gl;
    const now = performance.now();
    while (this.q.length) {
      const f = this.q[0];
      if (gl.getSyncParameter(f.sync, gl.SYNC_STATUS) !== gl.SIGNALED) {
        f.seen = now;
        break;
      }
      gl.deleteSync(f.sync);
      f.sync = null;
      this.q.shift();
      this.pool.push(f);
      // (finished somewhere between the last look and this one)
      const L = (f.seen + now) / 2 - f.t0;
      this.lastL = L;
      if (f.drawn && !this.frozen && this.engaged && this.ctl.measure(f.n, L, f.t1 - f.t0, now)) this.toPipe();
    }
    // (looked at again soon while the card should be at it; after that, at each animation frame)
    if (this.q.length && now - this.q[0].t1 < this.ctl.N * this.ctl.R * 1.5) this.pollT = setTimeout(this.pollFn, 2);
  }

  drain() {
    if (this.pollT) clearTimeout(this.pollT);
    this.pollT = 0;
    for (const f of this.q) {
      this.gl.deleteSync(f.sync);
      f.sync = null;
      this.pool.push(f);
    }
    this.q.length = 0;
  }

  // the performance panel's line (game/perf.js)
  line() {
    if (!this.on) return 'קצב: רגיל (כמה שיותר פריימים)';
    if (!this.engaged) return 'קצב: יציב (עומד בזמן מסלול המבחן)';
    const c = this.ctl;
    const fps = 1000 / (c.N * c.R);
    const name = { auto: 'יציב, אוטומטי', 60: 'יציב 60', 30: 'יציב 30' }[this.mode];
    const ot = this.otN ? Math.round((this.otSum / this.otN) * 100) : 100;
    const hz = Math.round(1000 / c.R);
    return `קצב: ${name} · ${fps.toFixed(fps < 50 && fps % 1 > 0.05 ? 1 : 0)} בשנייה (מסך ${hz}Hz) · בזמן ${ot}% · רזולוציה ${Math.round(this.pipe.dyn * 100)}% · פריים עד סוף הציור ${c.ema.toFixed(1)}ms (מעבד ${c.cpuE.toFixed(1)})${c.cpuBound ? ' · המעבד מגביל' : ''}${this.calib > 0 ? ' · מודד את המסך' : ''}`;
  }
}
