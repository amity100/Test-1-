// The frame's own numbers, to see where the time goes on any computer or phone (ROADMAP 0.1).
//
// F3 (or ` , or the pause menu) shows them over the game: frames per second and the slowest 1%,
// the milliseconds of each part of the game on the processor and of each pass of the picture on
// the graphics card (where the browser can time it), and the draw calls and triangles of each
// pass. The pause menu also runs the test route: a fixed 60-second drive of the camera through
// the city, the same every time, that ends in a report to copy (so two builds, or two devices,
// can be compared on the same streets).

import * as THREE from 'three';
import { groundHeight } from '../world/layout.js';
import { shared } from '../render/materials.js';

const ROUTE_SECONDS = 60;
// after the route, standing at its start a few seconds each way, to see what holds the frames up
// on the device: as it is, the drawing at its coarsest (the pixels), without the mirror, without
// the sun's view of what moves (v5), without the people and the cars (v5), and not drawn at all
// (the game alone, on the processor)
// (and as it is once more at the end: if the device has slowed down on its own meanwhile, warming
// up, the first and the last tell)
const STILL = [['רגיל', null], ['רזולוציה נמוכה', 'scale'], ['בלי השתקפות', 'mirror'], ['בלי צל', 'shadow'], ['בלי אנשים ומכוניות', 'life'], ['בלי ציור', 'draw'], ['שוב רגיל', null]];
const STILL_SECONDS = 5;
// the route: along the boulevard, through the shops and the park, up the avenue into downtown,
// over the towers and out over the bay to the pier (x, height, z)
const ROUTE = [
  [5, 2.4, 25], [5, 2.4, -95], [-10, 2.4, -107], [-60, 2.4, -107], [-66, 2.4, -95], [-66, 2.4, 20],
  [-80, 2.4, 29], [-130, 2.4, 29], [-135, 2.4, 15], [-135, 2.4, -230], [-120, 20, -280], [-60, 80, -260],
  [0, 60, -100], [40, 25, 100], [30, 8, 230],
];
// the systems of the game, timed by wrapping their methods while the numbers are shown
const SYSTEMS = [
  ['civilians', 'update'], ['civilians', 'draw'], ['traffic', 'update'], ['traffic', 'draw'], ['enemies', 'update'], ['enemies', 'draw'],
  ['player', 'update'], ['player', 'draw'], ['vehicles', 'update'], ['weapons', 'update'], ['streetlife', 'update'], ['streetlife', 'draw'],
  ['nightlife', 'update'], ['vignettes', 'update'], ['vignettes', 'draw'], ['police', 'update'], ['ambient', 'update'], ['ambient', 'draw'],
  ['fx', 'update'], ['hud', 'update'], ['signals', 'draw'], ['cars', 'end'], ['figures', 'end'],
  ['weather', 'update'], ['shutters', 'update'], ['soundscape', 'update'],
  ['routines', 'update'], ['workers', 'update'], ['workers', 'draw'], ['farCrowd', 'update'], ['farCrowd', 'draw'], ['animals', 'update'], ['animals', 'draw'], ['voices', 'update'], ['fleet', 'update'], ['fleet', 'draw'], ['damage', 'update'], ['damage', 'draw'], ['garage', 'update'], ['garage', 'draw'],
];
// (pens: drawn in two passes, ROADMAP 11.4 - the pens over the whole picture after the surfaces)
const PASSES = ['shadow', 'reflection', 'main', 'pens', 'ink', 'taa', 'rain', 'glow', 'final'];
const PASS_HE = { shadow: 'צל', reflection: 'השתקפות', main: 'ציור', pens: 'עטים', ink: 'דיו', taa: 'איחוד', rain: 'גשם', glow: 'זוהר', final: 'סיום' };
// (ROADMAP 11.4) What each part of the drawing costs on this graphics card, found by itself while the
// numbers are shown (diagStep): for a while after they are opened, now and then the drawing is made
// once more before the frame's own, with one part left out (render/glsl.js uProbe), and timed on
// the card. The frame shown is the frame as it is. tiny: at a sixteenth of its pixels (what its
// points and draws cost by themselves); city: without the people and the cars
const DIAG = [['all', 0], ['noPens', 1], ['noSun', 2], ['noLamps', 4], ['noHaze', 8], ['flat', 16], ['tiny', 0], ['city', 0]];
const DIAG_HE = { all: 'כמו שהוא', noPens: 'בלי העטים', noSun: 'בלי הצל', noLamps: 'בלי הפנסים', noHaze: 'בלי הערפל', flat: 'רק צבע', tiny: 'ב־1/16 מהפיקסלים', city: 'בלי אנשים ומכוניות' };
// (until each part was timed three times, no longer than a minute and a half)
const DIAG_N = 3;
const DIAG_MS = 90000;

// how the drawing is made now, and what trying the two ways found (render/depthtrial.js)
function pensLine(g, short) {
  const p = g.pipe;
  if (!p.pensCan) return short ? '' : 'ציור העטים: בשלב אחד (המחשב הזה לא יכול בשני שלבים)';
  const now = p.deferred ? 'בשני שלבים' : 'בשלב אחד';
  const t = g.depthTrial && g.depthTrial.pens;
  const tried = t ? (t.gpuOn && t.gpuOff ? `שני שלבים ${t.gpuOn}ms, שלב אחד ${t.gpuOff}ms בכרטיס` : `שני שלבים ${t.on}ms, שלב אחד ${t.off}ms לפריים`) : '';
  if (short) return ` · עטים ${now}${t ? ` (${tried})` : ''}`;
  const mode = { auto: 'אוטומטי', two: 'בשני שלבים', one: 'בשלב אחד' }[p.pensMode] || p.pensMode;
  return `ציור העטים: ${now} · הבחירה בהגדרות: ${mode}${t ? ` · נבדק במשחק: ${tried}` : p.pensMode === 'auto' ? ' · עוד לא נבדק במשחק' : ''}`;
}

// (v5) What the device itself was like during the test: its browser, how fast its processor and
// its graphics card were at the start and at the end (the same fixed work each time: a phone that
// has warmed up slows down, and two tests on one phone are only comparable at the same speed), and
// how much of each second the browser spent on other things than the game (the page around it).
function browserName() {
  const ua = navigator.userAgent;
  const v = (re) => {
    const m = ua.match(re);
    return m ? m[1] : '';
  };
  if (/SamsungBrowser\//.test(ua)) return `Samsung Internet ${v(/SamsungBrowser\/(\d+)/)}`;
  if (/Firefox\//.test(ua)) return `Firefox ${v(/Firefox\/(\d+)/)}`;
  if (/EdgA?\//.test(ua)) return `Edge ${v(/EdgA?\/(\d+)/)}`;
  // (an app's own browser, WebView, says "wv")
  if (/Chrome\//.test(ua)) return `${/; wv\)/.test(ua) ? 'WebView (דפדפן בתוך אפליקציה)' : 'Chrome'} ${v(/Chrome\/(\d+)/)}`;
  if (/Safari\//.test(ua)) return `Safari ${v(/Version\/([\d.]+)/)}`;
  return 'לא ידוע';
}

// the processor: a fixed sum (ms)
function cpuSpeed() {
  const t0 = performance.now();
  let x = 0;
  for (let i = 1; i < 3000000; i++) x += Math.sqrt(i) * (i & 7);
  cpuSpeed.sink = x;
  return performance.now() - t0;
}

// the graphics card: a fixed picture drawn 16 times into a square of 512, waited for (ms)
let gpuTest = null;
function gpuSpeed(r) {
  if (!gpuTest) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uK: { value: 1 } },
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform float uK; void main() { vec2 p = gl_FragCoord.xy * 0.01; float a = 0.0; for (int i = 0; i < 32; i++) { float f = float(i); a += sin(p.x * f + uK) * cos(p.y - f); } gl_FragColor = vec4(a * 0.01, 0.0, 0.0, 1.0); }',
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    gpuTest = { rt: new THREE.WebGLRenderTarget(512, 512, { depthBuffer: false }), scene, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), px: new Uint8Array(4) };
  }
  const t = gpuTest;
  const keep = r.getRenderTarget();
  const auto = r.autoClear;
  r.autoClear = false;
  r.setRenderTarget(t.rt);
  // (what the card still has to do first, and the picture made ready: not counted)
  r.render(t.scene, t.cam);
  r.readRenderTargetPixels(t.rt, 0, 0, 1, 1, t.px);
  const t0 = performance.now();
  for (let i = 0; i < 16; i++) r.render(t.scene, t.cam);
  r.readRenderTargetPixels(t.rt, 0, 0, 1, 1, t.px);
  const ms = performance.now() - t0;
  r.setRenderTarget(keep);
  r.autoClear = auto;
  return ms;
}

// time on the graphics card, pass by pass (EXT_disjoint_timer_query_webgl2; the answers come a
// few frames late, so they are averaged)
export class GpuTimer {
  constructor(gl) {
    this.gl = gl;
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.free = [];
    this.pending = [];
    this.open = null;
    this.sum = {};
    this.n = {};
    // (and the whole test route's, kept apart from the panel's)
    this.bsum = {};
    this.bn = {};
  }

  get ok() {
    return !!this.ext;
  }

  begin(label) {
    if (!this.ext || this.open) return;
    const gl = this.gl;
    const q = this.free.pop() || gl.createQuery();
    gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.open = { q, label };
  }

  end() {
    if (!this.open) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.open);
    this.open = null;
  }

  poll() {
    if (!this.ext || !this.pending.length) return;
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    const keep = [];
    for (const p of this.pending) {
      if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) {
        keep.push(p);
        continue;
      }
      const ns = gl.getQueryParameter(p.q, gl.QUERY_RESULT);
      if (!disjoint) {
        this.sum[p.label] = (this.sum[p.label] || 0) + ns / 1e6;
        this.n[p.label] = (this.n[p.label] || 0) + 1;
        this.bsum[p.label] = (this.bsum[p.label] || 0) + ns / 1e6;
        this.bn[p.label] = (this.bn[p.label] || 0) + 1;
      }
      this.free.push(p.q);
    }
    this.pending = keep;
  }

  // average ms per frame of each pass since the last take() (bench: of the test route)
  take(bench = false) {
    const sum = bench ? this.bsum : this.sum;
    const n = bench ? this.bn : this.n;
    const out = {};
    for (const k of Object.keys(sum)) out[k] = sum[k] / Math.max(1, n[k]);
    if (bench) {
      this.bsum = {};
      this.bn = {};
    } else {
      this.sum = {};
      this.n = {};
    }
    return out;
  }
}

// (where the browser has no clock on the graphics card - a phone's, an app's own browser) the same
// by the wall clock: the card waited for before and after (render/pipeline.js profile), so what is
// timed is the processor sending it and the card drawing it, together. Each time the frame stops
// until the card has done all it was given: only now and then, for a few seconds after the numbers
// are opened (Perf.diagDue)
export class ClockTimer {
  constructor(r) {
    this.r = r;
    this.rt = null;
    this.px = new Uint8Array(4);
    // (as GpuTimer: nothing comes late here)
    this.pending = [];
    this.open = null;
    this.sum = {};
    this.n = {};
  }

  get ok() {
    return true;
  }

  sync() {
    const r = this.r;
    if (!this.rt) this.rt = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    const keep = r.getRenderTarget();
    r.setRenderTarget(this.rt);
    r.clear();
    r.readRenderTargetPixels(this.rt, 0, 0, 1, 1, this.px);
    r.setRenderTarget(keep);
  }

  begin(label) {
    if (this.open) return;
    this.sync();
    this.open = { label, t0: performance.now() };
  }

  end() {
    const o = this.open;
    if (!o) return;
    this.open = null;
    this.sync();
    this.sum[o.label] = (this.sum[o.label] || 0) + performance.now() - o.t0;
    this.n[o.label] = (this.n[o.label] || 0) + 1;
  }

  poll() {}

  // average ms of each since the last take(); peek: without starting over
  take(peek = false) {
    const out = {};
    for (const k of Object.keys(this.sum)) out[k] = this.sum[k] / Math.max(1, this.n[k]);
    if (!peek) {
      this.sum = {};
      this.n = {};
    }
    return out;
  }
}

export class Perf {
  constructor(game) {
    this.game = game;
    this.on = false;
    this.gpu = new GpuTimer(game.renderer.getContext());
    // (what each part of the drawing costs here: diagStep. Where the card has no clock, by the wall
    // clock: the parts, and the frame's own passes on the frames they are timed - clock)
    const gt = new GpuTimer(game.renderer.getContext());
    this.diag = { timer: gt.ok ? gt : new ClockTimer(game.renderer), until: 0, last: 0, i: 0, n: 0, res: null };
    this.clock = this.gpu.ok ? null : new ClockTimer(game.renderer);
    this.passRes = null;
    // a frame that is timed (diagDue), and how many more are left out of what the frames are said to
    // take - the panel's, the resolution's pace's and the trials' (game.js): the timing made them slower
    this.probing = false;
    this.probeLeft = 0;
    this.probed = false;
    this.frameMs = [];
    this.sys = {};
    this.passCalls = {};
    this.passTris = {};
    this.updateMs = 0;
    this.renderMs = 0;
    this.wrapped = false;
    this.bench = null;
    this.el = document.createElement('div');
    this.el.id = 'perf';
    this.el.className = 'hidden';
    document.getElementById('app') ? document.getElementById('app').appendChild(this.el) : document.body.appendChild(this.el);
    this.shownAt = 0;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3' || e.code === 'Backquote') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  toggle(on = !this.on) {
    this.on = on;
    this.el.classList.toggle('hidden', !on);
    const box = document.getElementById('opt-perf');
    if (box) box.checked = on;
    if (this.onToggle) this.onToggle(on);
    const pipe = this.game.pipe;
    pipe.timer = on || this.bench ? this : null;
    this.game.renderer.info.autoReset = !(on || this.bench);
    if ((on || this.bench) && !this.wrapped) this.wrap();
    // (each part of the drawing timed by itself for a while, each time the numbers are opened)
    const d = this.diag;
    if (on && d.timer.ok) {
      d.until = performance.now() + DIAG_MS;
      d.timer.take();
      d.res = null;
      d.i = 0;
      if (this.clock) {
        this.clock.take();
        this.passRes = null;
      }
      pipe.diag = (p) => this.diagStep(p);
    } else pipe.diag = null;
  }

  // (as a frame begins) whether a part of the drawing is timed in this one: a third of a second
  // apart, not on the test route, not while two ways of drawing are being tried in play
  // (render/depthtrial.js), until every part was timed often enough
  diagDue(now) {
    const d = this.diag;
    if (!this.game.pipe.diag || this.bench || now > d.until || now - d.last < 330) return false;
    if (this.game.depthTrial && this.game.depthTrial.busy) {
      d.until = Math.max(d.until, now + 2000);
      return false;
    }
    if (d.i >= DIAG.length * DIAG_N) return false;
    d.last = now;
    return true;
  }

  // (render/pipeline.js render, before the frame's own drawing) once in a while the drawing with one
  // part left out, timed on the graphics card; the frame's own is drawn over it as it always is
  diagStep(pipe) {
    const d = this.diag;
    const now = performance.now();
    d.timer.poll();
    if (this.bench) return;
    // (every part timed often enough: the answers wanted a moment, then shown)
    if (d.i >= DIAG.length * DIAG_N) d.until = Math.min(d.until, now);
    if (now > d.until) {
      // (the card's last answers come a few frames late: all of them waited for, a few seconds at most)
      if (!d.timer.pending.length || now > d.until + 5000) {
        d.res = d.timer.take();
        if (this.clock) this.passRes = this.clock.take();
        pipe.diag = null;
      }
      return;
    }
    if (!this.probing) return;
    const [k, bit] = DIAG[d.i++ % DIAG.length];
    const probe = shared.uProbe;
    probe.value = bit;
    let vps = null;
    let life = null;
    if (k === 'tiny') {
      vps = [pipe.gRT, pipe.G.pen, pipe.G.over].filter(Boolean).map((t) => [t.viewport, t.viewport.clone()]);
      for (const [vp, keep] of vps) vp.set(0, 0, Math.max(1, Math.floor(keep.z / 4)), Math.max(1, Math.floor(keep.w / 4)));
    }
    if (k === 'city') life = pipe.hideMoving().slice();
    d.timer.begin(k);
    pipe.drawMain();
    d.timer.end();
    probe.value = 0;
    if (vps) for (const [vp, keep] of vps) vp.copy(keep);
    if (life) for (const o of life) o.visible = true;
  }

  // (ROADMAP 11.5) What the browser said while it made the game's shaders, once it said anything. On
  // Windows it turns each one into Direct3D's own, and where that fails with the usual settings it
  // quietly tries again with fewer ("skip optimization": the same picture, drawn much slower).
  // Looked at again only when more shaders were made
  shaderNotes() {
    const r = this.game.renderer;
    const progs = r.info.programs || [];
    if (this._notes && this._notesN === progs.length) return this._notes;
    this._notesN = progs.length;
    const gl = r.getContext();
    let n = 0;
    let retry = 0;
    let first = '';
    for (const p of progs) {
      let log = '';
      try {
        log = (gl.getProgramInfoLog(p.program) || '').trim();
      } catch (e) {
        log = '';
      }
      if (!log) continue;
      n++;
      if (/retrying|failed/i.test(log)) retry++;
      if (!first) first = log.replace(/\s+/g, ' ').slice(0, 200);
    }
    this._notes = { n, retry, first, of: progs.length };
    return this._notes;
  }

  shaderLine(html = true) {
    const t = this.shaderNotes();
    if (!t.n) return '';
    const esc = (x) => (html ? x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : x);
    const txt = `הכנת השיידרים: ${t.n} מתוך ${t.of} עם הערות של הדפדפן${t.retry ? ` (${t.retry} נבנו שוב בהגדרות חלשות יותר)` : ''}: ${esc(t.first)}`;
    return html ? `<span class="perf-sys">${txt}</span>` : txt;
  }

  // the line of the numbers that says what each part of the drawing costs here
  diagLine() {
    const d = this.diag;
    if (!d.timer.ok) return '';
    if (!d.res) {
      const done = Math.min(100, Math.round((d.i / (DIAG.length * DIAG_N)) * 100));
      return d.until > 0 ? `<span class="perf-sys">מודדים כמה כל חלק בציור עולה במחשב הזה… ${done}%${this.clock ? ' (בזמן המדידה התמונה נעצרת לרגע כמה פעמים)' : ''}</span>` : '';
    }
    const r = d.res;
    const parts = DIAG.filter(([k]) => r[k] !== undefined).map(([k]) => `${DIAG_HE[k]} ${r[k].toFixed(1)}`);
    return `הציור, כל חלק לבד (${this.clock ? 'ms בשעון, מעבד וכרטיס יחד' : 'ms בכרטיס'}): ${parts.join(' · ')}`;
  }

  // time the game's systems by wrapping their methods (nothing is wrapped until the numbers are
  // first shown: no cost at all before that)
  wrap() {
    this.wrapped = true;
    const g = this.game;
    for (const [k, m] of SYSTEMS) {
      const o = g[k];
      if (!o || typeof o[m] !== 'function') continue;
      const f = o[m].bind(o);
      const label = `${k}.${m}`;
      const self = this;
      o[m] = function wrapped(a, b, c, d) {
        if (!self.on && !self.bench) return f(a, b, c, d);
        const t0 = performance.now();
        const r = f(a, b, c, d);
        self.sys[label] = (self.sys[label] || 0) + performance.now() - t0;
        return r;
      };
    }
  }

  // ---------------------------------------------------------------- the pipeline's passes
  // (Pipeline calls these around each pass while the numbers are shown)
  begin(label) {
    const info = this.game.renderer.info.render;
    this._c0 = info.calls;
    this._t0 = info.triangles;
    this._label = label;
    this.gpu.begin(label);
    // (no clock on the card: on the frames that are timed, each pass by the wall clock)
    if (this.probing && this.clock) this.clock.begin(label);
  }

  end() {
    const info = this.game.renderer.info.render;
    const l = this._label;
    this.passCalls[l] = (this.passCalls[l] || 0) + info.calls - this._c0;
    this.passTris[l] = (this.passTris[l] || 0) + info.triangles - this._t0;
    this.gpu.end();
    if (this.clock && this.clock.open) this.clock.end();
  }

  // ---------------------------------------------------------------- every frame
  frameStart() {
    this._fs = performance.now();
    // (a frame where a part of the drawing is timed: it and the two after it are not counted)
    this.probing = this.diagDue(this._fs);
    if (this.probing) this.probeLeft = Math.max(this.probeLeft, 3);
    if (this.on || this.bench) this.game.renderer.info.reset();
  }

  afterUpdate() {
    this._fu = performance.now();
  }

  frameEnd(rawDt) {
    // (game.js: this frame left out of the resolution's pace and of the trials)
    this.probed = this.probeLeft > 0;
    if (this.probeLeft > 0) this.probeLeft--;
    this.probing = false;
    if (!this.on && !this.bench) return;
    const now = performance.now();
    const upd = this._fu - this._fs;
    const ren = now - this._fu;
    this.gpu.poll();
    const f = { dt: rawDt * 1000, upd, ren, calls: 0, tris: 0, pass: {}, probe: this.probed };
    for (const k of Object.keys(this.passCalls)) {
      f.pass[k] = this.passCalls[k];
      f.calls += this.passCalls[k];
      f.tris += this.passTris[k];
    }
    f.sys = this.sys;
    this.sys = {};
    this.passCalls = {};
    this.passTris = {};
    this.frameMs.push(f);
    if (this.frameMs.length > 240) this.frameMs.shift();
    if (this.bench) (this.bench.still ? this.bench.still.frames : this.bench.frames).push(f);
    if (this.on && now - this.shownAt > 250) {
      this.shownAt = now;
      this.show();
    }
  }

  // ---------------------------------------------------------------- the panel
  summary(frames) {
    // (the frames the panel's own timing made slower, left out)
    const fair = frames.filter((f) => !f.probe);
    if (fair.length) frames = fair;
    const n = Math.max(1, frames.length);
    const dts = frames.map((f) => f.dt).filter((d) => d > 0);
    const avgDt = dts.reduce((a, b) => a + b, 0) / Math.max(1, dts.length);
    const sorted = [...dts].sort((a, b) => b - a);
    const worst1 = sorted.slice(0, Math.max(1, Math.floor(sorted.length / 100)));
    const low1 = worst1.reduce((a, b) => a + b, 0) / Math.max(1, worst1.length);
    const avg = (fn) => frames.reduce((a, f) => a + fn(f), 0) / n;
    const sys = {};
    for (const f of frames) for (const [k, v] of Object.entries(f.sys || {})) sys[k] = (sys[k] || 0) + v / n;
    const pass = {};
    for (const f of frames) for (const [k, v] of Object.entries(f.pass)) pass[k] = (pass[k] || 0) + v / n;
    return {
      fps: avgDt > 0 ? 1000 / avgDt : 0,
      low1: low1 > 0 ? 1000 / low1 : 0,
      ms: avgDt,
      worst: sorted[0] || 0,
      upd: avg((f) => f.upd),
      ren: avg((f) => f.ren),
      calls: avg((f) => f.calls),
      maxCalls: Math.max(0, ...frames.map((f) => f.calls)),
      tris: avg((f) => f.tris),
      sys,
      pass,
    };
  }

  show() {
    const s = this.summary(this.frameMs.slice(-120));
    const g = this.game;
    const gpu = this.gpu.ok ? this.gpu.take() : null;
    const top = Object.entries(s.sys).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(' · ');
    const passes = PASSES.filter((p) => s.pass[p] !== undefined).map((p) => `${PASS_HE[p]} ${Math.round(s.pass[p])}`).join(' · ');
    let gpuLine = 'כרטיס מסך: הדפדפן לא מאפשר למדוד';
    // (no clock on the card: each pass by the wall clock, on the frames that were timed)
    const c = this.clock ? this.passRes || this.clock.take(true) : null;
    if (c && Object.keys(c).length) {
      const tot = PASSES.reduce((a, p) => a + (c[p] || 0), 0);
      gpuLine = `כל שלב בשעון (מעבד וכרטיס יחד) ${tot.toFixed(1)}ms: ` + PASSES.filter((p) => c[p] !== undefined).map((p) => `${PASS_HE[p]} ${c[p].toFixed(1)}`).join(' · ');
    } else if (this.clock && this.diag.until > performance.now()) gpuLine = 'כרטיס מסך: הדפדפן לא מאפשר למדוד ישירות – מודדים בשעון…';
    if (gpu && !Object.keys(gpu).length) gpuLine = this.gpuLine || 'כרטיס מסך: מודדים…';
    else if (gpu) {
      const tot = PASSES.reduce((a, p) => a + (gpu[p] || 0), 0);
      gpuLine = `כרטיס מסך ${tot.toFixed(1)}ms: ` + PASSES.filter((p) => gpu[p] !== undefined).map((p) => `${PASS_HE[p]} ${gpu[p].toFixed(1)}`).join(' · ');
      this.gpuLine = gpuLine;
    }
    this.el.innerHTML = [
      `<b>${s.fps.toFixed(0)} פריימים בשנייה</b> · 1% האיטיים ${s.low1.toFixed(0)} · ${s.ms.toFixed(1)}ms`,
      `מעבד: משחק ${s.upd.toFixed(1)}ms · שליחת הציור ${s.ren.toFixed(1)}ms`,
      gpuLine,
      this.diagLine(),
      `draw calls ${Math.round(s.calls)} (${passes}) · ${(s.tris / 1e6).toFixed(2)}M משולשים`,
      `קנה מידה ${g.pipe.scale.toFixed(2)} · ציור חכם ${g.pipe.taa ? `${Math.round(g.pipe.taaFrac * 100)}%` : 'כבוי'} · עומק קודם ${g.pipe.depthFirst ? 'כן' : 'לא'}${g.depthTrial && g.depthTrial.result ? ` (${g.depthTrial.result.on} מול ${g.depthTrial.result.off}ms)` : ''}${pensLine(g, true)} · אנשים ${g.civilians.list ? g.civilians.list.length : 0} · מכוניות ${g.traffic.list.length}`,
      g.pace ? g.pace.line() : '',
      `<span class="perf-sys">${top}</span>`,
      `<span class="perf-sys">${g.pipe.software ? 'בלי כרטיס מסך (תוכנה): ' : ''}${g.pipe.gpuName || ''}</span>`,
      this.shaderLine(),
    ].filter(Boolean).join('<br>');
  }

  // ---------------------------------------------------------------- the test route
  startBench(seconds = ROUTE_SECONDS, stillSeconds = STILL_SECONDS) {
    const g = this.game;
    if (this.bench) return;
    const pl = g.player;
    if (pl.inVehicle || pl.mode !== 'foot') {
      g.hud.toast('את מסלול המבחן מתחילים ברגל', 'warn', 2.5);
      return;
    }
    if (g.police.level > 0) g.police.clear();
    const pts = ROUTE.map((p) => ({ x: p[0], y: p[1], z: p[2] }));
    // the length along the route (for an even speed)
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z));
    // (the device's speed before anything else: its own little picture is not one of the game's
    // shaders counted below)
    const cpu0 = cpuSpeed();
    const gpu0 = gpuSpeed(g.renderer);
    this.bench = { t: 0, pts, acc, len: acc[acc.length - 1], frames: [], scale: g.pipe.scale, taaFrac: g.pipe.taaFrac, warm: 1.5, secs: seconds, stillSecs: stillSeconds, from: [pl.pos.x, pl.pos.z, pl.yaw], still: null, noDraw: false, refl: g.pipe.reflections, compiles: 0, compileMs: 0 };
    this.gpu.take(true);
    // the shaders made ready on the way (each a pause where it is first seen: on a phone, long)
    const b = this.bench;
    const gl = g.renderer.getContext();
    const cs = gl.compileShader;
    const gp = gl.getProgramParameter;
    gl.compileShader = function compileShader(s) {
      b.compiles++;
      return cs.call(this, s);
    };
    gl.getProgramParameter = function getProgramParameter(p, k) {
      const t0 = performance.now();
      const r = gp.call(this, p, k);
      b.compileMs += performance.now() - t0;
      return r;
    };
    b.unhook = () => {
      delete gl.compileShader;
      delete gl.getProgramParameter;
    };
    // (v5) the device: its browser, its speed now (and again at the end), the long tasks of the
    // page around the game, how long the game has been open, the battery
    b.open = performance.now() / 60000;
    b.cpu = [cpu0];
    b.gpuMs = [gpu0];
    b.busy = { self: 0, other: 0 };
    try {
      b.po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.name === 'self') b.busy.self += e.duration;
          else b.busy.other += e.duration;
        }
      });
      b.po.observe({ type: 'longtask' });
    } catch (e) {
      b.po = null;
    }
    b.battery = null;
    try {
      if (navigator.getBattery) navigator.getBattery().then((bt) => (b.battery = { level: bt.level, charging: bt.charging })).catch(() => {});
    } catch (e) {
      b.battery = null;
    }
    b.t0 = performance.now();
    // the test is at the drawing's full quality: the self-adjusting resolution waits
    g.pipe.scale = g.pipe.defaultScale || g.pipe.scale;
    g.pipe.taaFrac = 0.67;
    g.player.invuln = 1e9;
    this.toggle(this.on);
    // (v5: and at the very end a few seconds with the picture still, each pass timed on its own)
    g.hud.toast('מסלול מבחן: דקה, ואחריה עוד כחצי דקה במקום. בסוף התמונה עומדת כמה שניות. בלי לגעת…', 'info', 4);
  }

  // where the camera is at distance d along the route (Catmull-Rom through the points)
  routeAt(d, out) {
    const b = this.bench;
    const pts = b.pts;
    d = Math.max(0, Math.min(b.len - 1e-3, d));
    let i = 1;
    while (b.acc[i] < d) i++;
    const k = (d - b.acc[i - 1]) / Math.max(1e-6, b.acc[i] - b.acc[i - 1]);
    const p0 = pts[Math.max(0, i - 2)];
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = pts[Math.min(pts.length - 1, i + 1)];
    const cr = (a, b1, c, e, t) => 0.5 * (2 * b1 + (-a + c) * t + (2 * a - 5 * b1 + 4 * c - e) * t * t + (-a + 3 * b1 - 3 * c + e) * t * t * t);
    out.x = cr(p0.x, p1.x, p2.x, p3.x, k);
    out.y = cr(p0.y, p1.y, p2.y, p3.y, k);
    out.z = cr(p0.z, p1.z, p2.z, p3.z, k);
    return out;
  }

  // the camera on the route (called by the game after its own camera)
  benchCamera(dt) {
    const b = this.bench;
    if (!b) return false;
    b.t += dt;
    const cam = this.game.camera;
    // (after the route: standing still at its start)
    const d = b.still ? 0 : (Math.max(0, b.t - b.warm) / b.secs) * b.len;
    const p = this.routeAt(d, this._p || (this._p = {}));
    const q = this.routeAt(d + 14, this._q || (this._q = {}));
    cam.position.set(p.x, p.y, p.z);
    cam.lookAt(q.x, Math.min(q.y, p.y) - (p.y > 10 ? 6 : 0.3), q.z);
    // the city's life lives around the player: the player (unseen) rides along under the camera
    const gh = groundHeight(p.x, p.z);
    if (gh >= 0) {
      const pl = this.game.player;
      pl.pos.set(p.x, gh, p.z);
      pl.vel.set(0, 0, 0);
    }
    // (the first moments settle; they are not counted)
    if (b.t < b.warm) {
      b.frames.length = 0;
      this.gpu.take(true);
    }
    if (b.still) this.stillStep(dt);
    else if (b.t >= b.warm + b.secs) this.beginStill();
    return true;
  }

  // the route is done: standing at its start, a few seconds each way (STILL)
  beginStill() {
    const b = this.bench;
    b.gpuRoute = this.gpu.ok ? this.gpu.take(true) : null;
    b.still = { i: -1, t: 0, frames: [], fps: [] };
    this.nextStill();
  }

  nextStill() {
    const b = this.bench;
    const s = b.still;
    const pipe = this.game.pipe;
    if (s.i >= 0) {
      const sm = this.summary(s.frames);
      s.fps.push(sm.fps);
      // (of each frame, the time not in the game's own code: the browser, the page around it, and
      // waiting for the graphics card)
      (s.gap || (s.gap = [])).push(Math.max(0, sm.ms - sm.upd - sm.ren));
    }
    // (back as it was)
    pipe.scale = pipe.defaultScale || b.scale;
    pipe.reflections = b.refl;
    pipe.noSunPass = false;
    pipe.hideLife = false;
    b.noDraw = false;
    s.i++;
    s.t = 0;
    s.frames = [];
    if (s.i >= STILL.length) {
      // (v5) and each pass on its own, timed straight (render/pipeline.js profile)
      try {
        b.stages = this.stages();
      } catch (e) {
        b.stages = null;
      }
      this.endBench();
      return;
    }
    const what = STILL[s.i][1];
    if (what === 'scale') pipe.scale = pipe.minScale;
    else if (what === 'mirror') pipe.reflections = false;
    else if (what === 'shadow') pipe.noSunPass = true;
    else if (what === 'life') pipe.hideLife = true;
    else if (what === 'draw') b.noDraw = true;
  }

  // the passes timed one by one where the test stands (as the game draws it: the sun's box ahead of
  // the camera)
  stages() {
    const g = this.game;
    const cam = g.camera;
    cam.updateMatrixWorld();
    const f = cam.getWorldDirection(this._f || (this._f = new THREE.Vector3()));
    const c = cam.position;
    return g.pipe.profile(new THREE.Vector3(c.x + f.x * 35, 0, c.z + f.z * 35));
  }

  stillStep(dt) {
    const s = this.bench.still;
    s.t += dt;
    // (the first second settles: not counted)
    if (s.t < 1) s.frames.length = 0;
    if (s.t >= this.bench.stillSecs) this.nextStill();
  }

  endBench() {
    const g = this.game;
    const b = this.bench;
    const s = this.summary(b.frames);
    b.cpu.push(cpuSpeed());
    b.gpuMs.push(gpuSpeed(g.renderer));
    if (b.po) b.po.disconnect();
    const secs = Math.max(1, (performance.now() - b.t0) / 1000);
    const gpu = b.gpuRoute !== undefined ? b.gpuRoute : this.gpu.ok ? this.gpu.take(true) : null;
    this.bench = null;
    if (b.unhook) b.unhook();
    g.pipe.scale = b.scale;
    g.pipe.taaFrac = b.taaFrac;
    g.pipe.reflections = b.refl;
    g.pipe.noSunPass = false;
    g.pipe.hideLife = false;
    // how the frames came: in time for a 60 Hz screen, for 30, or later
    const dts = b.frames.map((f) => f.dt);
    const share = (lo, hi) => Math.round((100 * dts.filter((x) => x > lo && x <= hi).length) / Math.max(1, dts.length));
    g.player.spawn(b.from[0], b.from[1], b.from[2]);
    g.camRig.yaw = b.from[2];
    this.toggle(this.on);
    const gl = g.renderer.getContext();
    let device = '';
    try {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      device = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    } catch (e) {
      device = '';
    }
    const c = g.renderer.domElement;
    const st = b.stages;
    const ms = (v) => (v || 0).toFixed(1);
    const lines = [
      `עיר השרבוטים — מסלול מבחן (${Math.round(b.secs)} שניות, ${b.frames.length} פריימים)`,
      `מכשיר: ${device || 'לא ידוע'}`,
      `מסך: ${c.width}×${c.height} · קנה מידה ${g.pipe.scale.toFixed(2)} · ציור חכם ${g.pipe.taa ? `${Math.round(g.pipe.taaFrac * 100)}%` : 'כבוי'} · ${navigator.userAgent.includes('Mobile') ? 'טלפון' : 'מחשב'}`,
      `פריימים בשנייה, ממוצע: ${s.fps.toFixed(1)} · 1% האיטיים: ${s.low1.toFixed(1)} · הפריים האיטי ביותר: ${s.worst.toFixed(1)}ms`,
      g.pace && g.pace.on ? `קצב הפריימים במשחק: יציב (${{ auto: 'אוטומטי', 60: '60', 30: '30' }[g.pace.mode]}) · המסלול עצמו נמדד בקצב הרגיל` : 'קצב הפריימים במשחק: רגיל',
      `פריימים: עד 17ms ${share(0, 17.5)}% · עד 34ms ${share(17.5, 34.5)}% · יותר ${share(34.5, 1e9)}% · הכנת שיידרים ${b.compiles} (${Math.round(b.compileMs)}ms)`,
      b.still && b.still.fps.length === STILL.length ? `עומדים במקום, פריימים בשנייה: ${STILL.map(([name], i) => `${name} ${b.still.fps[i].toFixed(1)}`).join(' · ')}` : '',
      b.still && b.still.gap && b.still.gap.length === STILL.length ? `מזה, זמן בכל פריים מחוץ לקוד המשחק (ms): ${STILL.map(([name], i) => `${name} ${b.still.gap[i].toFixed(0)}`).join(' · ')}` : '',
      `דפדפן: ${browserName()}${window.top !== window ? ' · בתוך מסגרת' : ''} · המשחק פתוח ${b.open.toFixed(0)} דקות${b.battery ? ` · סוללה ${Math.round(b.battery.level * 100)}%${b.battery.charging ? ' בטעינה' : ''}` : ''}`,
      `מהירות המכשיר (ms לאותה עבודה, פחות זה מהר יותר): מעבד בהתחלה ${b.cpu[0].toFixed(1)}, בסוף ${b.cpu[1].toFixed(1)} · כרטיס מסך בהתחלה ${b.gpuMs[0].toFixed(1)}, בסוף ${b.gpuMs[1].toFixed(1)}`,
      b.po ? `משימות ארוכות בכל שנייה: של המשחק ${(b.busy.self / secs).toFixed(0)}ms · של הדף שמסביב ${(b.busy.other / secs).toFixed(0)}ms` : 'משימות ארוכות: הדפדפן לא מאפשר למדוד',
      `מעבד: משחק ${s.upd.toFixed(2)}ms · שליחת הציור ${s.ren.toFixed(2)}ms`,
      `עומק קודם: ${g.pipe.depthFirst ? 'כן' : 'לא'}${g.depthTrial && g.depthTrial.result ? ` (נבדק: עם ${g.depthTrial.result.on}ms, בלי ${g.depthTrial.result.off}ms)` : ''} · עומק הקירות קודם: ${g.pipe.wallsFirst && g.pipe.walls ? 'כן' : 'לא'}`,
      pensLine(g, false),
      st ? `כל שלב לבד, נמדד ישירות בסוף (ms): צל ${ms(st.shadow)} · השתקפות ${ms(st.reflection)} · ציור ${ms(st.main)}${g.pipe.deferred ? ` (מזה העטים ${ms(st.pens)})` : ''} · דיו ${ms(st.ink)} · זוהר ${ms(st.glow)} · סיום ${ms(st.final)} · פריים שלם ${ms(st.frame)}` : 'כל שלב לבד: המדידה לא הצליחה',
      st && st.other ? `הציור בדרך השנייה (ms): ${g.pipe.deferred ? 'בשלב אחד, כמו קודם' : 'בשני שלבים'} ${ms(st.other)} · ככה: ${ms(st.main)}` : '',
      st ? `הציור (ms): כמו שהוא ${ms(st.main)} · בלי אנשים ומכוניות ${ms(st.city)} · ב-1/16 מהפיקסלים ${ms(st.tiny)} · ${g.pipe.wallsFirst ? 'בלי' : 'עם'} עומק הקירות קודם ${ms(st.walls)} · ${g.pipe.depthFirst ? 'בלי' : 'עם'} עומק קודם מלא ${ms(st.flip)}${st.kill !== undefined ? ` · בחומרים הישנים (עם discard) ${ms(st.kill)}` : ''}` : '',
      st && st.noPens !== undefined ? `הציור בלי חלק אחד (ms): בלי העטים ${ms(st.noPens)} · בלי הצל של השמש ${ms(st.noSun)} · בלי הפנסים ${ms(st.noLamps)} · בלי הערפל ${ms(st.noHaze)} · רק צבע ${ms(st.flat)} · בלי ההשתקפות ברחוב ${ms(st.noReflImg)} · המראה ${g.pipe.mirrorPlain ? 'עם' : 'בלי'} עטים ${ms(st.reflFlip)} (ככה: ${ms(st.reflection)})` : '',
      gpu && Object.keys(gpu).length ? `כרטיס מסך: ${PASSES.filter((p) => gpu[p] !== undefined).map((p) => `${PASS_HE[p]} ${gpu[p].toFixed(2)}ms`).join(' · ')}` : 'כרטיס מסך: הדפדפן לא מאפשר למדוד',
      `draw calls: ממוצע ${Math.round(s.calls)} · שיא ${s.maxCalls} · ${(s.tris / 1e6).toFixed(2)}M משולשים`,
      `לפי מעבר: ${PASSES.filter((p) => s.pass[p] !== undefined).map((p) => `${PASS_HE[p]} ${Math.round(s.pass[p])}`).join(' · ')}`,
      `מערכות (ms): ${Object.entries(s.sys).sort((a, b2) => b2[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(' · ')}`,
      this.shaderLine(false) || `הכנת השיידרים: בלי הערות של הדפדפן (${this.shaderNotes().of})`,
    ];
    this.report(lines.filter(Boolean).join('\n'));
  }

  report(text) {
    const g = this.game;
    let el = document.getElementById('perf-report');
    if (!el) {
      el = document.createElement('div');
      el.id = 'perf-report';
      el.className = 'overlay';
      el.innerHTML = '<div class="sheet small"><h2>תוצאות מסלול המבחן</h2><pre></pre><div class="sheet-foot"><button class="btn" data-a="copy">העתקה</button> <button class="btn primary" data-a="close">סגירה</button></div></div>';
      (document.getElementById('app') || document.body).appendChild(el);
      el.addEventListener('click', (e) => {
        const a = e.target && e.target.dataset ? e.target.dataset.a : null;
        if (a === 'copy') {
          try {
            navigator.clipboard.writeText(el.querySelector('pre').textContent);
            g.hud.toast('הועתק', 'good', 1.5);
          } catch (err) {
            // no clipboard: the text can be selected by hand
          }
        } else if (a === 'close') {
          el.classList.add('hidden');
          this.reportOpen = false;
          if (!g.touch && g.state === 'play') g.input.requestLock();
        }
      });
    }
    el.querySelector('pre').textContent = text;
    el.classList.remove('hidden');
    this.lastReport = text;
    // (letting go of the mouse is not a pause here)
    this.reportOpen = true;
    g.input.releaseLock();
  }
}
