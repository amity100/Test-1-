// The frame's own numbers, to see where the time goes on any computer or phone (ROADMAP 0.1).
//
// F3 (or ` , or the pause menu) shows them over the game: frames per second and the slowest 1%,
// the milliseconds of each part of the game on the processor and of each pass of the picture on
// the graphics card (where the browser can time it), and the draw calls and triangles of each
// pass. The pause menu also runs the test route: a fixed 60-second drive of the camera through
// the city, the same every time, that ends in a report to copy (so two builds, or two devices,
// can be compared on the same streets).

import { groundHeight } from '../world/layout.js';

const ROUTE_SECONDS = 60;
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
];
const PASSES = ['shadow', 'reflection', 'main', 'ink', 'rain', 'glow', 'final'];
const PASS_HE = { shadow: 'צל', reflection: 'השתקפות', main: 'ציור', ink: 'דיו', rain: 'גשם', glow: 'זוהר', final: 'סיום' };

// time on the graphics card, pass by pass (EXT_disjoint_timer_query_webgl2; the answers come a
// few frames late, so they are averaged)
class GpuTimer {
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

export class Perf {
  constructor(game) {
    this.game = game;
    this.on = false;
    this.gpu = new GpuTimer(game.renderer.getContext());
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
    const pipe = this.game.pipe;
    pipe.timer = on || this.bench ? this : null;
    this.game.renderer.info.autoReset = !(on || this.bench);
    if ((on || this.bench) && !this.wrapped) this.wrap();
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
      o[m] = function wrapped(...a) {
        if (!self.on && !self.bench) return f(...a);
        const t0 = performance.now();
        const r = f(...a);
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
  }

  end() {
    const info = this.game.renderer.info.render;
    const l = this._label;
    this.passCalls[l] = (this.passCalls[l] || 0) + info.calls - this._c0;
    this.passTris[l] = (this.passTris[l] || 0) + info.triangles - this._t0;
    this.gpu.end();
  }

  // ---------------------------------------------------------------- every frame
  frameStart() {
    this._fs = performance.now();
    if (this.on || this.bench) this.game.renderer.info.reset();
  }

  afterUpdate() {
    this._fu = performance.now();
  }

  frameEnd(rawDt) {
    if (!this.on && !this.bench) return;
    const now = performance.now();
    const upd = this._fu - this._fs;
    const ren = now - this._fu;
    this.gpu.poll();
    const f = { dt: rawDt * 1000, upd, ren, calls: 0, tris: 0, pass: {} };
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
    if (this.bench) this.bench.frames.push(f);
    if (this.on && now - this.shownAt > 250) {
      this.shownAt = now;
      this.show();
    }
  }

  // ---------------------------------------------------------------- the panel
  summary(frames) {
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
    if (gpu && !Object.keys(gpu).length) gpuLine = this.gpuLine || 'כרטיס מסך: מודדים…';
    else if (gpu) {
      const tot = PASSES.reduce((a, p) => a + (gpu[p] || 0), 0);
      gpuLine = `כרטיס מסך ${tot.toFixed(1)}ms: ` + PASSES.filter((p) => gpu[p] !== undefined).map((p) => `${PASS_HE[p]} ${gpu[p].toFixed(1)}`).join(' · ');
      this.gpuLine = gpuLine;
    }
    this.el.innerHTML = [
      `<b>${s.fps.toFixed(0)} FPS</b> · 1% האיטיים ${s.low1.toFixed(0)} · ${s.ms.toFixed(1)}ms`,
      `מעבד: משחק ${s.upd.toFixed(1)}ms · שליחת הציור ${s.ren.toFixed(1)}ms`,
      gpuLine,
      `draw calls ${Math.round(s.calls)} (${passes}) · ${(s.tris / 1e6).toFixed(2)}M משולשים`,
      `קנה מידה ${g.pipe.scale.toFixed(2)} · אנשים ${g.civilians.list ? g.civilians.list.length : 0} · מכוניות ${g.traffic.list.length}`,
      `<span class="perf-sys">${top}</span>`,
    ].join('<br>');
  }

  // ---------------------------------------------------------------- the test route
  startBench(seconds = ROUTE_SECONDS) {
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
    this.bench = { t: 0, pts, acc, len: acc[acc.length - 1], frames: [], scale: g.pipe.scale, warm: 1.5, secs: seconds, from: [pl.pos.x, pl.pos.z, pl.yaw] };
    this.gpu.take(true);
    // the test is at the drawing's full quality: the self-adjusting resolution waits
    g.pipe.scale = g.pipe.defaultScale || g.pipe.scale;
    g.player.invuln = 1e9;
    this.toggle(this.on);
    g.hud.toast('מסלול מבחן: 60 שניות, בלי לגעת…', 'info', 3);
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
    const d = (Math.max(0, b.t - b.warm) / b.secs) * b.len;
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
    if (b.t >= b.warm + b.secs) this.endBench();
    return true;
  }

  endBench() {
    const g = this.game;
    const b = this.bench;
    const s = this.summary(b.frames);
    const gpu = this.gpu.ok ? this.gpu.take(true) : null;
    this.bench = null;
    g.pipe.scale = b.scale;
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
    const lines = [
      `עיר השרבוטים — מסלול מבחן (${Math.round(b.secs)} שניות, ${b.frames.length} פריימים)`,
      `מכשיר: ${device || 'לא ידוע'}`,
      `מסך: ${c.width}×${c.height} · קנה מידה ${g.pipe.scale.toFixed(2)} · ${navigator.userAgent.includes('Mobile') ? 'טלפון' : 'מחשב'}`,
      `FPS ממוצע: ${s.fps.toFixed(1)} · 1% האיטיים: ${s.low1.toFixed(1)} · הפריים האיטי ביותר: ${s.worst.toFixed(1)}ms`,
      `מעבד: משחק ${s.upd.toFixed(2)}ms · שליחת הציור ${s.ren.toFixed(2)}ms`,
      gpu && Object.keys(gpu).length ? `כרטיס מסך: ${PASSES.filter((p) => gpu[p] !== undefined).map((p) => `${PASS_HE[p]} ${gpu[p].toFixed(2)}ms`).join(' · ')}` : 'כרטיס מסך: הדפדפן לא מאפשר למדוד',
      `draw calls: ממוצע ${Math.round(s.calls)} · שיא ${s.maxCalls} · ${(s.tris / 1e6).toFixed(2)}M משולשים`,
      `לפי מעבר: ${PASSES.filter((p) => s.pass[p] !== undefined).map((p) => `${PASS_HE[p]} ${Math.round(s.pass[p])}`).join(' · ')}`,
      `מערכות (ms): ${Object.entries(s.sys).sort((a, b2) => b2[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(' · ')}`,
    ];
    this.report(lines.join('\n'));
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
