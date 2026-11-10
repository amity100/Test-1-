// (ROADMAP 11.5) What the game is like on each device it is played on, kept where it can be read
// without a screenshot: the page's own store on claude.ai (the artifact's db, "perf" - one document
// for each time the game is opened, written again every minute or less of play; "bench" - each test
// route's report). Nothing here changes the picture, and nothing is kept anywhere else: opened as a
// file, or anywhere without that store, all of it stays off.
//
// Kept: the device (its graphics card as the browser names it, the browser, the screen), how the
// drawing is set up on it (and what trying the ways in play chose), and for every minute of play
// how the frames came - how many a second, the slow ones, the processor's share of each frame, the
// graphics card's (where the browser has a clock on it), the drawing's resolution. And now and then,
// while the picture stands still behind the pause menu or the start screen, each part of the drawing
// timed by itself (pipeline.js profileOne): what it costs on this device, where the player stands.

import { GpuTimer, browserName } from './perf.js';
import { shared, pens } from '../render/materials.js';
import { provokeState } from '../render/provoke.js';

export const BUILD = 'v19';
// frames by how long they took (ms): up to 8.5 (120 Hz), 12.5, 17.5 (60 Hz), 21, 25, 34.5 (30 Hz),
// 50, 67, 100, 200, longer
const EDGES = [8.5, 12.5, 17.5, 21, 25, 34.5, 50, 67, 100, 200];
// the play summed up after its first 15 seconds, then every 45 (v19: a phone's few minutes of play
// were often over before the first whole minute), and the last 90 of them kept
const FIRST_S = 15;
const EVERY_S = 45;
const KEEP = 90;
// the parts of the drawing timed by themselves, one a frame (pipeline.js profileOne)
// (split, splitRefl: the drawing and the mirror once each, timed three ways - the processor sending
// it, the wall clock until the card is done, the card's own clock; basic: in the plainest material;
// half, empty: every other thing drawn, or none; floor: nothing at all, only the waits for the card
// (every other part's own time is over it); cityRefl, cityShadow: the mirror and the sun's view
// without the people and the cars. The ones that tell most first: a set cut short is kept as far
// as it went. v19: no more pvLast, pvLastRefl - the drawing the old way, with the last corner's
// flat values, had Windows make shaders of its own for it, the picture standing still for seconds;
// it was 2.3 times slower there, and that is known now - render/provoke.js)
const IDLE = ['main', 'tiny', 'flat', 'empty', 'floor', 'basic', 'shadow', 'reflection', 'split', 'splitRefl', 'frame', 'city', 'cityRefl', 'cityShadow', 'half', 'noPens', 'noSun', 'noLamps', 'noHaze', 'noReflImg', 'flip', 'walls', 'pens', 'ink', 'glow', 'final'];
// (a set cut short is kept if it got this far)
const IDLE_PART = 4;
// (a few times each time the game is opened, a minute apart at least)
const IDLE_SETS = 4;
const IDLE_GAP = 60000;
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

// this device, the same each time the game is opened here
function deviceKey() {
  const make = () => Math.random().toString(36).slice(2, 10);
  try {
    let k = localStorage.getItem('sc5-device');
    if (!k) {
      k = make();
      localStorage.setItem('sc5-device', k);
    }
    return k;
  } catch (e) {
    return make();
  }
}

export class Telemetry {
  constructor(game) {
    this.game = game;
    this.ref = null;
    this.db = null;
    this.status = 'off';
    this.dev = deviceKey();
    this.sess = Date.now().toString(36);
    this.started = new Date().toISOString();
    this.t0 = performance.now();
    this.minutes = [];
    this.idle = [];
    this.benches = 0;
    this.writing = false;
    this.again = false;
    this.fails = 0;
    this.model = '';
    this.m = this.fresh();
    // (the frame after the page comes back is not a frame of play)
    this.skip = 0;
    this.lt = { self: 0, other: 0, t: performance.now() };
    // the graphics card's own clock on whole frames, where the browser has one: one frame in four
    this.gt = new GpuTimer(game.renderer.getContext());
    this.gtN = 0;
    this.gtOpen = false;
    this.probe = { set: null, i: 0, since: 0, last: -1e9, state: '' };
    // the shaders made so far (frame: how many more each summary)
    this.progs = -1;
    this.start();
  }

  fresh() {
    return { n: 0, live: 0, ms: new Float32Array(8192), cpu: new Float32Array(8192), hist: new Array(EDGES.length + 1).fill(0), upd: 0, ren: 0, scale: 0, scaleMin: 9, dyn: 0, refl: 0, gpu: 0, gpuN: 0, worst: 0, made: 0, madeWorst: 0 };
  }

  async start() {
    const c = typeof window !== 'undefined' && window.claude;
    if (!c || typeof c.use !== 'function') return;
    try {
      this.db = await c.use('db');
    } catch (e) {
      this.db = null;
    }
    if (!this.db) return;
    try {
      this.ref = this.db.collection('perf').doc(`${this.dev}_${this.sess}`);
    } catch (e) {
      this.ref = null;
      return;
    }
    this.status = 'on';
    try {
      if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        const h = await navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion']);
        this.model = [h.platform, h.platformVersion, h.model].filter(Boolean).join(' ');
      }
    } catch (e) {
      this.model = '';
    }
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.name === 'self') this.lt.self += e.duration;
          else this.lt.other += e.duration;
        }
      });
      po.observe({ type: 'longtask' });
    } catch (e) {
      // (not every browser tells)
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.m.n > 60) this.roll();
        this.write();
      } else this.skip = 2;
    });
    this.write();
  }

  // ---------------------------------------------------------------- every frame (game.js loop)
  frame(dt, live) {
    if (!this.ref) return;
    if (this.gt.ok && this.gt.pending.length) this.gt.poll();
    if (this.gt.ok) this.takeGpu();
    if (this.skip > 0) {
      this.skip--;
      return;
    }
    if (!live || document.hidden) return;
    const g = this.game;
    const p = g.pipe;
    const m = this.m;
    const ms = dt * 1000;
    // (shaders made since the frame before: how many, and the slowest frame that made some)
    const progs = g.renderer.info.programs ? g.renderer.info.programs.length : 0;
    if (this.progs < 0) this.progs = progs;
    if (progs > this.progs) {
      m.made += progs - this.progs;
      if (ms > m.madeWorst) m.madeWorst = ms;
    }
    this.progs = progs;
    const perf = g.perf;
    const cpu = (perf.lastUpd || 0) + (perf.lastRen || 0);
    if (m.n < m.ms.length) {
      m.ms[m.n] = ms;
      m.cpu[m.n] = cpu;
    }
    m.n++;
    m.live += dt;
    let b = 0;
    while (b < EDGES.length && ms > EDGES[b]) b++;
    m.hist[b]++;
    if (ms > m.worst) m.worst = ms;
    m.upd += perf.lastUpd || 0;
    m.ren += perf.lastRen || 0;
    m.scale += p.scale;
    if (p.scale < m.scaleMin) m.scaleMin = p.scale;
    m.dyn += p.dyn || 1;
    m.refl += shared.uReflOn.value ? 1 : 0;
    if (m.live >= (this.minutes.length ? EVERY_S : FIRST_S)) {
      this.roll();
      this.write();
    }
  }

  // (game.js renderFrame, around the drawing) the card's clock on one frame in four, while nothing
  // else has it: the numbers' panel, the test route, the trials in play
  frameBegin() {
    if (!this.ref || !this.gt.ok || this.gtOpen) return;
    const g = this.game;
    if (g.state !== 'play' || g.perf.on || g.perf.bench || g.pipe.diag || g.pipe.mainTimer || g.perf.probeLeft) return;
    if (++this.gtN % 4) return;
    this.gt.begin('frame');
    this.gtOpen = true;
  }

  frameEnd() {
    if (!this.gtOpen) return;
    this.gt.end();
    this.gtOpen = false;
  }

  takeGpu() {
    const s = this.gt.sum.frame;
    if (!s) return;
    this.m.gpu += s;
    this.m.gpuN += this.gt.n.frame;
    this.gt.sum.frame = 0;
    this.gt.n.frame = 0;
  }

  // a minute of play summed up
  roll() {
    const m = this.m;
    const g = this.game;
    const n = Math.min(m.n, m.ms.length);
    if (!n) return;
    const pct = (arr, q) => arr[Math.min(n - 1, Math.floor(q * n))];
    const ms = m.ms.slice(0, n).sort();
    const cpu = m.cpu.slice(0, n).sort();
    const avg = m.live / m.n;
    const pl = g.player;
    const lt = this.lt;
    const now = performance.now();
    const secs = Math.max(1, (now - lt.t) / 1000);
    this.minutes.push({
      at: Math.round((now - this.t0) / 1000),
      s: r1(m.live),
      n: m.n,
      fps: r1(1 / avg),
      p50: r1(pct(ms, 0.5)),
      p90: r1(pct(ms, 0.9)),
      p99: r1(pct(ms, 0.99)),
      worst: r1(m.worst),
      hist: m.hist,
      upd: r2(m.upd / m.n),
      ren: r2(m.ren / m.n),
      cpu50: r1(pct(cpu, 0.5)),
      cpu90: r1(pct(cpu, 0.9)),
      gpu: m.gpuN ? r2(m.gpu / m.gpuN) : null,
      gpuN: m.gpuN,
      scale: r2(m.scale / m.n),
      scaleMin: r2(m.scaleMin),
      dyn: r2(m.dyn / m.n),
      refl: r2(m.refl / m.n),
      mirror: r2(g.pipe.mirrorShare === undefined ? 1 : g.pipe.mirrorShare),
      taa: g.pipe.taa ? r2(g.pipe.taaFrac) : 0,
      pace: g.pace ? (g.pace.engaged ? g.pace.mode : 'free') : '',
      // (the steady pace: its beat as it is now, ms a frame)
      beat: g.pace && g.pace.engaged && g.pace.ctl ? r1(g.pace.ctl.N * g.pace.ctl.R) : null,
      // (shaders made in these frames, the slowest such frame, and how many there are now)
      made: m.made,
      madeWorst: r1(m.madeWorst),
      progs: this.progs,
      people: g.civilians && g.civilians.list ? g.civilians.list.length : 0,
      cars: g.traffic && g.traffic.list ? g.traffic.list.length : 0,
      x: Math.round(pl.pos.x),
      z: Math.round(pl.pos.z),
      ride: pl.inVehicle ? pl.inVehicle.kind || 'car' : '',
      wx: g.weather ? g.weather.kind : '',
      hour: g.daynight ? r1(g.daynight.hour) : null,
      // (long tasks a second: the game's own and the page's around it)
      ltSelf: Math.round(lt.self / secs),
      ltOther: Math.round(lt.other / secs),
      f3: g.perf.on,
    });
    if (this.minutes.length > KEEP) this.minutes.shift();
    lt.self = 0;
    lt.other = 0;
    lt.t = now;
    this.m = this.fresh();
  }

  // ---------------------------------------------------------------- the picture standing still
  // (game.js renderFrame, before the drawing) behind the pause menu or the start screen: each part
  // of the drawing timed by itself, one a frame (those frames, and the two after, are not counted
  // anywhere: perf.probeLeft)
  idleStep(center) {
    if (!this.ref) return;
    const g = this.game;
    const pr = this.probe;
    const now = performance.now();
    const pauseEl = document.getElementById('pause');
    const paused = g.state === 'paused' && pauseEl && !pauseEl.classList.contains('hidden');
    const still = (g.state === 'title' && now - this.t0 > 2500) || paused;
    // (v19: the play so far summed up and kept as the pause menu opens - a phone's game is often
    // left from it)
    if (paused && this.m.n >= 30) {
      this.roll();
      this.write();
    }
    const ok = still && !document.hidden && !g.perf.bench && !g.pipe.diag && !(g.depthTrial && g.depthTrial.busy) && !(g.citymap && g.citymap.covering);
    if (!ok || pr.state !== g.state) {
      // (a set cut short: kept as far as it went, if that is far enough)
      if (pr.set && pr.i >= IDLE_PART) this.keepSet(true);
      pr.state = ok ? g.state : '';
      pr.since = now;
      pr.set = null;
      return;
    }
    if (this.idle.length >= IDLE_SETS || now - pr.last < IDLE_GAP || now - pr.since < 1000) return;
    const p = g.pipe;
    if (!pr.set) {
      pr.set = { at: Math.round((now - this.t0) / 1000), where: g.state, ms: {} };
      pr.i = 0;
    }
    const key = IDLE[pr.i++];
    let v;
    try {
      if (key === 'split' || key === 'splitRefl') this.split(key, pr.set.ms);
      else v = p.profileOne(key, center);
    } catch (e) {
      v = undefined;
    }
    if (v !== undefined) pr.set.ms[key] = r2(v);
    g.perf.probeLeft = Math.max(g.perf.probeLeft, 3);
    if (pr.i < IDLE.length) return;
    this.keepSet(false);
  }

  // a set of the parts timed kept (part: cut short), with where and how it was drawn
  keepSet(part) {
    const g = this.game;
    const p = g.pipe;
    const pr = this.probe;
    const now = performance.now();
    const s = pr.set;
    const pl = g.player;
    if (part) s.part = pr.i;
    // (the card's own clock on the split ones: its answers came while the rest was timed)
    if (this.gt.ok) {
      this.gt.poll();
      for (const k of ['split', 'splitRefl']) {
        if (this.gt.n[k]) s.ms[k + 'Gpu'] = r2(this.gt.sum[k] / this.gt.n[k]);
        this.gt.sum[k] = 0;
        this.gt.n[k] = 0;
      }
    }
    s.size = p.size ? `${p.size.x}x${p.size.y}` : '';
    s.scale = r2(p.scale);
    s.deferred = !!p.deferred;
    s.depthFirst = !!p.depthFirst;
    s.wallsFirst = !!p.wallsFirst;
    s.reflOn = !!shared.uReflOn.value;
    s.mirror = r2(p.mirrorShare === undefined ? 1 : p.mirrorShare);
    s.x = Math.round(pl.pos.x);
    s.z = Math.round(pl.pos.z);
    s.wx = g.weather ? g.weather.kind : '';
    s.hour = g.daynight ? r1(g.daynight.hour) : null;
    s.people = g.civilians && g.civilians.list ? g.civilians.list.length : 0;
    this.idle.push(s);
    pr.set = null;
    pr.last = now;
    this.write();
  }

  // the drawing (or the mirror) once, timed three ways: the processor sending it (Js), the wall
  // clock until the card has done it (Wall), and the card's own clock where it has one (Gpu, read a
  // few frames later). Js near Wall and Gpu small: the time is in sending, not in drawing
  split(key, ms) {
    const p = this.game.pipe;
    const fn = key === 'split' ? () => p.drawMain() : () => p.renderReflection();
    const T = p.timer;
    p.timer = null;
    // (and how many draws, how many triangles)
    const info = this.game.renderer.info;
    const auto = info.autoReset;
    info.autoReset = false;
    p.syncGpu();
    info.reset();
    const t0 = performance.now();
    const timed = this.gt.ok && !this.gtOpen;
    if (timed) this.gt.begin(key);
    fn();
    if (timed) this.gt.end();
    const t1 = performance.now();
    ms[key + 'Calls'] = info.render.calls;
    ms[key + 'KTris'] = Math.round(info.render.triangles / 1000);
    p.syncGpu();
    const t2 = performance.now();
    info.autoReset = auto;
    p.timer = T;
    ms[key + 'Js'] = r2(t1 - t0);
    ms[key + 'Wall'] = r2(t2 - t0);
  }

  // ---------------------------------------------------------------- the rest
  // (perf.js) the numbers' panel found what each part costs here
  noteF3() {
    this.write();
  }

  // (perf.js endBench) the test route's report, a document of its own
  bench(text, stages) {
    if (!this.db || !this.ref) return;
    this.benches++;
    const doc = { build: BUILD, dev: this.dev, sess: this.sess, at: new Date().toISOString(), text, stages: stages ? Object.fromEntries(Object.entries(stages).map(([k, v]) => [k, r2(v || 0)])) : null };
    try {
      this.db.collection('bench').doc(`${this.dev}_${Date.now().toString(36)}`).set(doc).catch(() => {});
    } catch (e) {
      // (kept or not, the game goes on)
    }
    this.write();
  }

  doc() {
    const g = this.game;
    const p = g.pipe;
    const perf = g.perf;
    const r = g.renderer;
    const gl = r.getContext();
    const c = r.domElement;
    const t = g.depthTrial;
    const n = perf.shaderNotes();
    const d = perf.diag;
    const ctl = g.pace && g.pace.ctl;
    return {
      build: BUILD,
      dev: this.dev,
      sess: this.sess,
      started: this.started,
      updated: new Date().toISOString(),
      device: {
        gpu: p.gpuName || '',
        software: !!p.software,
        browser: browserName(),
        ua: navigator.userAgent,
        model: this.model,
        touch: !!g.touch,
        dpr: window.devicePixelRatio || 1,
        screen: `${screen.width}x${screen.height}`,
        canvas: `${c.width}x${c.height}`,
        cores: navigator.hardwareConcurrency || 0,
        memory: navigator.deviceMemory || 0,
        framed: window.top !== window,
        timer: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'),
        hz: ctl && ctl.R ? Math.round(1000 / ctl.R) : null,
        // (render/provoke.js: whether the browser lets the game choose the corner, and it does)
        provoke: provokeState(),
        // (whether the card makes shaders alongside the game - without it the other way of drawing
        // the pens is never tried, render/pipeline.js prepareOtherPens - and draws many in one call)
        parallel: !!gl.getExtension('KHR_parallel_shader_compile'),
        multiDraw: !!gl.getExtension('WEBGL_multi_draw'),
      },
      setup: {
        low: !!p.low,
        size: p.size ? `${p.size.x}x${p.size.y}` : '',
        scale: r2(p.scale),
        defaultScale: r2(p.defaultScale || p.scale),
        minScale: r2(p.minScale || 0),
        pensCan: !!pens.can,
        pensMode: p.pensMode || '',
        deferred: !!p.deferred,
        depthFirst: !!p.depthFirst,
        walls: !!p.walls,
        wallsFirst: !!p.wallsFirst,
        reflections: !!p.reflections,
        reflEvery: p.reflEvery || 1,
        taa: !!p.taa,
        pace: g.pace ? g.pace.mode : '',
        // (what trying the ways chose here before, used without trying: render/depthtrial.js)
        kept: p.trialMemo && p.trialMemo.kept ? { pens: p.trialMemo.kept.pens, walls: p.trialMemo.kept.walls, depth: p.trialMemo.kept.depth } : null,
      },
      trials: t ? { depth: t.result || null, pens: t.pens || null, walls: t.walls || null } : null,
      shaders: { n: n.n, of: n.of, retry: n.retry, first: n.first },
      minutes: this.minutes,
      idle: this.idle,
      f3: d.res || perf.passRes || perf.lastGpu ? { parts: d.res || null, clock: perf.passRes || null, gpu: perf.lastGpu || null, clockParts: !!perf.clock } : null,
      benches: this.benches,
      playedS: Math.round(this.minutes.reduce((a, x) => a + x.n / Math.max(1, x.fps), 0)),
    };
  }

  // one write at a time; another asked for meanwhile goes right after it
  async write() {
    if (!this.ref) return;
    if (this.writing) {
      this.again = true;
      return;
    }
    this.writing = true;
    let doc;
    try {
      doc = this.doc();
    } catch (e) {
      this.writing = false;
      return;
    }
    try {
      await this.ref.set(doc);
      this.fails = 0;
      this.status = 'on';
    } catch (e) {
      const code = (e && e.code) || 'unavailable';
      this.status = code;
      // (for good: this view may not keep them; a passing trouble: tried again with the next minute)
      if (code !== 'unavailable' && code !== 'resource_exhausted') this.ref = null;
      else if (++this.fails > 5) this.ref = null;
    }
    this.writing = false;
    if (this.again && this.ref) {
      this.again = false;
      this.write();
    }
  }

  // the numbers' panel's line
  line() {
    if (this.status === 'off') return '';
    return this.status === 'on' ? `המדידות נשמרות לקריאה (${this.minutes.length} סיכומים, ${this.idle.length} מדידות בעמידה)` : `שמירת המדידות לא הצליחה: ${this.status}`;
  }
}
