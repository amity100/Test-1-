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
import { GFX } from '../core/util.js';
import { folkLook } from './looks.js';

const ROUTE_SECONDS = 60;
// after the route, standing at its start a few seconds each way, to see what holds the frames up
// on the device: as it is, the drawing at its coarsest (the pixels), without the mirror, without
// the sun's view of what moves (v5), without the people and the cars (v5), and not drawn at all
// (the game alone, on the processor)
// (and as it is once more at the end: if the device has slowed down on its own meanwhile, warming
// up, the first and the last tell)
// (ROADMAP 19: 'כמו קודם' - the phone's own way of drawing, GFX, switched off for the stand: the same
// place drawn as it was before it, right after the first, on a device where it is on)
const STILL = [['רגיל', null], ['כמו קודם', 'old'], ['רזולוציה נמוכה', 'scale'], ['בלי השתקפות', 'mirror'], ['בלי צל', 'shadow'], ['בלי אנשים ומכוניות', 'life'], ['בלי ציור', 'draw'], ['שוב רגיל', null]];
const STILL_SECONDS = 5;
// (ROADMAP 19: after those, two places of the mainland where a frame is heaviest - the street east of
// Bayview Mall, looking at it, and under its dome - each stood in as it is and, where GFX is on, as it
// was before it. x, z, yaw: where the player is put; pos, look: the camera. Settled 2 seconds, then
// STILL_SECONDS counted)
const PLACES = [
  { name: 'הקניון מבחוץ', x: -700, z: -37, yaw: -1.57, pos: [-694, 2.2, -32], look: [-760, 6, -40] },
  { name: 'בתוך הקניון', x: -835, z: -37, yaw: -1.57, pos: [-828, 2.0, -37], look: [-880, 2.4, -37] },
];
// (ROADMAP 19.4, PHONE_SPEED_PLAN.md 5.1, "what a stall is made of") after the stands, a drive on the mainland
// the way a player comes into the city: out on the Venetian Causeway from the middle of the bay, ashore, round
// the corner and down the bayfront boulevard to the door of Bayview Mall - at the car's own speed in play,
// 20 m/s, for DRIVE_SECONDS. The player (unseen) goes under the camera at that speed, so the streamers (the
// mainland's blocks, the shops' insides) work as they do in play, and every frame is noted: how long it took,
// and what the streamers had in hand (the five slowest are told apart in the report)
const DRIVE_SPEED = 20;
const DRIVE_SECONDS = 30;
const DRIVE = [[-420, -379], [-560, -379], [-640, -379], [-672, -377], [-692, -365], [-700, -343], [-700, -300], [-700, -200], [-700, -100], [-700, -37]];
// (ROADMAP 19.6, the owner's word: "a test specifically for the places where the speed was improved, not the regular one that
// runs in random places") the focused test: the places where something was made faster, each seen as it is now and as it was before
// (GFX.off), the two taken turn about in blocks of a second at the same place - so the people who walk, the cars that pass and a
// phone that warms up are the same for both. x, z, yaw: where the player is put; pos, look: the camera. key: the place is also seen
// at the lowest resolution and without drawing (the card's share of the frame, and the processor's). what: what was made faster there
const FOCUS_SPOTS = [
  { id: 'island', name: 'השדרה הראשית באי', what: 'מכוניות רחוקות בפחות נקודות · אנשים לפי המרחק · חנויות לאורך הרחוב', x: 5, z: 25, yaw: Math.PI, pos: [5, 2.4, 25], look: [5, 2.1, -35], key: true },
  { id: 'crowd', name: 'קהל של 54 אנשים סביבך (3.5 עד 29 מטר)', what: 'האנשים בצורות קלות לפי המרחק', x: 5, z: 25, yaw: Math.PI, pos: [5, 1.8, 25], look: [5, 1.7, -35], crowd: true },
  { ...PLACES[0], id: 'mall_out', name: 'הרחוב מול הקניון', what: 'הסחורה שהקירות מסתירים · מכוניות חונות · אנשים', mainland: true },
  { ...PLACES[1], id: 'mall_in', name: 'בתוך הקניון, מתחת לכיפה', what: 'מאות חנויות: הסחורה שהקירות מסתירים · אנשים באולם', mainland: true, key: true },
];
// a block of one condition is a second of the game, the first 0.3 s of it not counted (the card's queue still holds the other
// condition's frames); a place is left when each condition has FOCUS_MIN frames and three rounds were made, or after FOCUS_SPOT_MAX
const FOCUS_BLOCK = 1.0;
const FOCUS_DROP = 0.3;
const FOCUS_MIN = 90;
const FOCUS_SPOT_MAX = 100000;
// the people of the crowd: their looks (game/looks.js folkLook) and the rows they stand in, metres from the camera
const CROWD_KINDS = [0, 6, 13, 21, 30, 41];
const CROWD_ROWS = [3.5, 5, 6.5, 8.5, 11, 14, 18, 23, 29];
// a place built round the player, a little a frame (buildStep): the longest it may take, ms, before the test goes on without it
const BUILD_MAX = 150000;
// where the test's state is kept (crumb, recover)
const STORE_KEY = 'sc5-bench';
// the route: along the boulevard, through the shops and the park, up the avenue into downtown,
// over the towers and out over the bay to the pier (x, height, z)
const ROUTE = [
  [5, 2.4, 25], [5, 2.4, -95], [-10, 2.4, -107], [-60, 2.4, -107], [-66, 2.4, -95], [-66, 2.4, 20],
  [-80, 2.4, 29], [-130, 2.4, 29], [-135, 2.4, 15], [-135, 2.4, -230], [-120, 20, -280], [-60, 80, -260],
  [0, 60, -100], [40, 25, 100], [30, 8, 230],
];
// (ROADMAP 19) the places of the mainland in the report: 'הקניון מבחוץ: עכשיו 31.0 (950/260) · כמו קודם 14.2 (3400/410) · …'
function placeLine(b) {
  const S = b.still;
  const out = [];
  for (let i = b.islandN; i < b.stands.length; i++) {
    const st = b.stands[i];
    const num = `${S.fps[i].toFixed(1)} (${S.tr[i].toFixed(0)}/${Math.round(S.cl[i])})`;
    if (!out.length || out[out.length - 1].place !== st.place) out.push({ place: st.place, text: [] });
    out[out.length - 1].text.push(`${st.name} ${num}`);
  }
  return out.map((o) => `${o.place.name}: ${o.text.join(' · ')}`).join(' · ');
}
// the systems of the game, timed by wrapping their methods while the numbers are shown
const SYSTEMS = [
  ['civilians', 'update'], ['civilians', 'draw'], ['traffic', 'update'], ['traffic', 'draw'], ['enemies', 'update'], ['enemies', 'draw'],
  ['player', 'update'], ['player', 'draw'], ['vehicles', 'update'], ['weapons', 'update'], ['streetlife', 'update'], ['streetlife', 'draw'],
  ['nightlife', 'update'], ['vignettes', 'update'], ['vignettes', 'draw'], ['police', 'update'], ['ambient', 'update'], ['ambient', 'draw'],
  ['fx', 'update'], ['hud', 'update'], ['signals', 'draw'], ['cars', 'end'], ['figures', 'end'],
  ['weather', 'update'], ['shutters', 'update'], ['soundscape', 'update'],
  ['routines', 'update'], ['workers', 'update'], ['workers', 'draw'], ['farCrowd', 'update'], ['farCrowd', 'draw'], ['arenaGame', 'update'], ['arenaGame', 'draw'], ['animals', 'update'], ['animals', 'draw'], ['voices', 'update'], ['fleet', 'update'], ['fleet', 'draw'], ['damage', 'update'], ['damage', 'draw'], ['garage', 'update'], ['garage', 'draw'],
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
// the steps of getting ready (main.js mark), as they are shown with the numbers
const LOAD_HE = { modules: 'הקוד', 'before city': 'הכנות', city: 'העיר', mainland: 'היבשה', interiors: 'פנים החנויות', 'shadow bake': 'אפיית הצל', 'static shadow': 'הצל הקבוע', occlusion: 'הסתרה', 'walls, waters': 'קירות ומים', solid: 'מוצקים', nav: 'דרכים', precompile: 'הכנת העטים', 'game init': 'המשחק', 'shaders ready': 'העטים בכרטיס' };
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
export function browserName() {
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

// (the report copied, or sent: the share sheet of the phone where it has one)
function copyText(text, g) {
  const done = () => g.hud.toast('הועתק', 'good', 1.5);
  const fallback = () => g.hud.toast('אי אפשר להעתיק אוטומטית: סמנו את הטקסט והעתיקו', 'warn', 3);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  } catch (e) {
    fallback();
  }
}
function shareText(text) {
  try {
    if (navigator.share) {
      navigator.share({ title: 'Beyond the Outline — דוח בדיקת ביצועים', text }).catch(() => {});
      return true;
    }
  } catch (e) {
    // (no share sheet here: it is copied instead)
  }
  return false;
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
        if (this.game.tele) this.game.tele.noteF3();
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
    // (game/telemetry.js: the processor's share of every frame, the numbers shown or not)
    const now = performance.now();
    this.lastUpd = this._fu - this._fs;
    this.lastRen = now - this._fu;
    if (!this.on && !this.bench) return;
    const upd = this.lastUpd;
    const ren = this.lastRen;
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
    if (this.bench) {
      // (ROADMAP 19.4, 5.1: the drive's frames carry what the streamers did in them)
      if (this.bench.focus) this.focusFrame(f);
      else if (this.bench.drive) {
        this.driveNote(f);
        this.bench.drive.frames.push(f);
      } else (this.bench.still ? this.bench.still.frames : this.bench.frames).push(f);
      // (and its progress on the screen, twice a second, and its crumbs where a stuck page leaves them)
      if (now - (this._progAt || 0) > 500) {
        this._progAt = now;
        this.progress(this.bench);
        this.crumb();
      }
    }
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
      this.lastGpu = Object.fromEntries(Object.entries(gpu).map(([k, v]) => [k, Math.round(v * 100) / 100]));
    }
    this.el.innerHTML = [
      `<b>${s.fps.toFixed(0)} פריימים בשנייה</b> · 1% האיטיים ${s.low1.toFixed(0)} · ${s.ms.toFixed(1)}ms`,
      `מעבד: משחק ${s.upd.toFixed(1)}ms · שליחת הציור ${s.ren.toFixed(1)}ms`,
      gpuLine,
      this.diagLine(),
      `draw calls ${Math.round(s.calls)} (${passes}) · ${(s.tris / 1e6).toFixed(2)}M משולשים`,
      `${g.pipe.reflDone ? `השתקפות: ${Math.round(g.pipe.mirrorShare * 100)}% מהתמונה שלה · ` : ''}קנה מידה ${g.pipe.scale.toFixed(2)} · ציור חכם ${g.pipe.taa ? `${Math.round(g.pipe.taaFrac * 100)}%` : 'כבוי'} · עומק קודם ${g.pipe.depthFirst ? 'כן' : 'לא'}${g.depthTrial && g.depthTrial.result ? ` (${g.depthTrial.result.on} מול ${g.depthTrial.result.off}ms)` : ''}${g.pipe.walls && !g.pipe.depthFirst ? ` · קירות קודם ${g.pipe.wallsFirst ? 'כן' : 'לא'}${g.depthTrial && g.depthTrial.walls ? ` (${g.depthTrial.walls.on} מול ${g.depthTrial.walls.off}ms)` : ''}` : ''}${pensLine(g, true)} · אנשים ${g.civilians.list ? g.civilians.list.length : 0} · מכוניות ${g.traffic.list.length}`,
      g.pace ? g.pace.line() : '',
      `<span class="perf-sys">${top}</span>`,
      `<span class="perf-sys">${g.pipe.software ? 'בלי כרטיס מסך (תוכנה): ' : ''}${g.pipe.gpuName || ''}</span>`,
      this.shaderLine(),
      this.loadLine(),
      g.tele && g.tele.line() ? `<span class="perf-sys">${g.tele.line()}</span>` : '',
    ].filter(Boolean).join('<br>');
  }

  // how long the game took to get ready on this device, step by step (main.js mark): the steps of
  // a tenth of a second or more, in seconds
  loadLine() {
    const g = this.game;
    const L = g.loadSteps;
    if (!L || !L.length) return '';
    const parts = L.filter(([, ms]) => ms >= 100).map(([k, ms]) => `${LOAD_HE[k] || k} ${(ms / 1000).toFixed(1)}`);
    return `<span class="perf-sys">טעינה ${(g.loadTotal / 1000).toFixed(1)} שנ׳: ${parts.join(' · ')}</span>`;
  }

  // ---------------------------------------------------------------- the test route
  startBench(seconds = ROUTE_SECONDS, stillSeconds = STILL_SECONDS, driveSeconds = DRIVE_SECONDS, mode = 'route') {
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
    // (ROADMAP 19) the stands of this run: the island's (the one 'כמו קודם' only where GFX is on), then the
    // mainland's places, if it is built
    const stands = STILL.filter(([, what]) => what !== 'old' || GFX.on).map(([name, what]) => ({ name, what }));
    const islandN = stands.length;
    if (g.world && g.world.mainland && g.world.mainland.fill) {
      for (const P of PLACES) {
        stands.push({ name: GFX.on ? 'עכשיו' : 'רגיל', what: null, place: P });
        if (GFX.on) stands.push({ name: 'כמו קודם', what: 'old', place: P });
      }
    }
    // (ROADMAP 19.4, 5.1: and the drive after them, where the mainland is built: driveSecs)
    const driveSecs = mode !== 'focus' && g.world && g.world.mainland && g.world.mainland.on ? driveSeconds : 0;
    this.bench = { t: 0, pts, acc, len: acc[acc.length - 1], frames: [], scale: g.pipe.scale, taaFrac: g.pipe.taaFrac, warm: 1.5, secs: seconds, stillSecs: stillSeconds, from: [pl.pos.x, pl.pos.z, pl.yaw], still: null, drive: null, driveSecs, noDraw: false, refl: g.pipe.reflections, compiles: 0, compileMs: 0, stands, islandN };
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
    // (ROADMAP 19.6) the page's own heartbeat: a main thread held for seconds - a place built in one go, a long timing - shows in
    // the gaps between the beats, and is told in the report with the stage it was in. And the test's state is kept (crumb) where it
    // survives a stuck page, to be read the next time the link is opened (recover)
    b.mode = mode;
    b.blocks = [];
    b.builds = [];
    b.crumbLines = [];
    b.wdLast = performance.now();
    b.wd = setInterval(() => {
      const now = performance.now();
      const gap = now - b.wdLast;
      b.wdLast = now;
      if (gap > 2000 && !document.hidden) b.blocks.push({ at: Math.round((now - b.t0) / 1000), gap: Math.round(gap), stage: this.stageName(b) });
    }, 500);
    // (and the page put aside - another app, the screen dark - is no stall: the beat starts again, and the test says it was cut)
    b.onVis = () => {
      b.wdLast = performance.now();
      if (document.hidden) b.interrupted = true;
    };
    document.addEventListener('visibilitychange', b.onVis);
    if (mode === 'focus') b.focus = this.focusInit(b);
    this.crumb(true);
    // the test is at the drawing's full quality: the self-adjusting resolution waits
    g.pipe.scale = g.pipe.defaultScale || g.pipe.scale;
    g.pipe.taaFrac = 0.67;
    g.player.invuln = 1e9;
    this.toggle(this.on);
    // (the screen kept awake while it runs: nobody touches it for these minutes, and a phone's screen
    // goes dark by itself, the game stopping with it)
    b.lock = null;
    try {
      if (navigator.wakeLock) {
        navigator.wakeLock
          .request('screen')
          .then((l) => {
            if (this.bench === b) b.lock = l;
            else l.release().catch(() => {});
          })
          .catch(() => {});
      }
    } catch (e) {
      b.lock = null;
    }
    // (v5: and at the very end a few seconds with the picture still, each pass timed on its own)
    g.hud.toast(mode === 'focus' ? 'בדיקה ממוקדת במקומות ששופרו: ארבעה מקומות, בכל אחד "עכשיו" מול "כמו קודם". בלי לגעת…' : driveSecs > 0 ? 'מסלול מבחן: דקה, ואחריה עוד כחצי דקה במקום, ובסוף נסיעה של חצי דקה ביבשה. בלי לגעת…' : 'מסלול מבחן: דקה, ואחריה עוד כחצי דקה במקום. בסוף התמונה עומדת כמה שניות. בלי לגעת…', 'info', 4);
  }

  // (?perftest, main.js: the owner's word - a link that runs the test by itself, without entering the game) the
  // test without the pause menu: the game is already in the city behind a card with one big button; a tap
  // on it - the one thing a browser wants before it will go full screen and sideways, where the numbers are those
  // of the game as it is played - and the test goes by itself, once the picture has stopped changing size.
  // mode 'focus': the test of the places that were made faster (focusInit), not the route. quick: a few seconds
  // of each part, to try the link itself
  autoBench(quick = false, mode = 'route') {
    const g = this.game;
    if (document.getElementById('perf-start') || document.getElementById('perf-recover')) return;
    const focus = mode === 'focus';
    const card = () => {
      const el = document.createElement('div');
      el.id = 'perf-start';
      el.style.cssText = 'position:fixed;inset:0;z-index:46;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;background:rgba(16,12,30,0.62);direction:rtl;font-family:"Rubik",system-ui,sans-serif';
      el.innerHTML =
        '<div style="max-width:min(480px,92vw);box-sizing:border-box;padding:14px 18px 16px;border-radius:14px;background:#fff8ec;color:#1b1430;text-align:center;box-shadow:0 6px 30px rgba(0,0,0,0.45)">' +
        `<div style="font-size:21px;font-weight:700;margin-bottom:6px">${focus ? 'בדיקה ממוקדת במקומות ששופרו' : 'מבחן ביצועים'}</div>` +
        `<div style="font-size:14px;line-height:1.5;margin-bottom:10px">${focus ? 'ארבעה מקומות: השדרה הראשית באי, קהל אנשים, הרחוב מול הקניון ובתוך הקניון. בכל אחד המשחק מצויר לסירוגין "עכשיו" ו"כמו קודם", כדי לראות כמה מהר נהיה. כארבע דקות. אחרי הלחיצה לא נוגעים במסך. בסוף יופיע דוח מפורט עם כפתורי "העתקה" ו"שיתוף".' : 'המבחן עובר לבד: הליכה ברחובות, עמידה במקום ובקניון, ובסוף נסיעה ביבשה. כשלוש דקות. אחרי הלחיצה לא נוגעים במסך. בסוף יופיע דוח עם כפתורי "העתקה" ו"שיתוף".'}</div>` +
        '<button data-a="go" style="font-weight:700;font-size:20px;line-height:1.2;font-family:inherit;padding:12px 30px;border:3px solid #1b1430;border-radius:12px;background:#ffd23f;color:#1b1430;box-shadow:2px 3px 0 #1b1430">התחלת המבחן</button>' +
        '<div data-a="note" style="font-size:12px;opacity:0.75;margin-top:8px">הלחיצה מעבירה את המסך למסך מלא ולרוחב, כמו במשחק</div>' +
        '</div>';
      (document.getElementById('app') || document.body).appendChild(el);
      const note = el.querySelector('[data-a="note"]');
      const portrait = () => window.innerHeight > window.innerWidth;
      const hint = () => {
        if (!el.isConnected) return;
        note.textContent = portrait() ? 'הטלפון מוחזק לאורך: הלחיצה תסובב אותו לרוחב' : 'הלחיצה מעבירה את המסך למסך מלא ולרוחב, כמו במשחק';
        setTimeout(hint, 1000);
      };
      hint();
      const begin = () => {
        el.remove();
        // (full screen and sideways, as the game takes the phone when it begins: start() in game.js)
        try {
          if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
        } catch (e) {
          // (optional: the test goes on in the screen it has)
        }
        // (a moment for the screen to settle: the test begins when the picture has kept its size for a second, and
        // the game is in play - at the latest after eight seconds; again each second if it did not begin)
        const t0 = performance.now();
        let size = '';
        let same = 0;
        const wait = () => {
          if (this.bench) return;
          const c = g.renderer.domElement;
          const sz = `${c.width}x${c.height}`;
          same = sz === size ? same + 1 : 0;
          size = sz;
          const waited = performance.now() - t0;
          if ((same >= 4 && waited > 1500 && g.state === 'play' && !(g.prologue && g.prologue.active)) || waited > 8000) {
            if (focus) {
              this.startBench(0, 0, 0, 'focus');
              if (this.bench && quick) this.bench.focus.quick = true;
            } else if (quick) this.startBench(3, 1, 4);
            else this.startBench();
            if (this.bench) return;
            setTimeout(wait, 1000);
            return;
          }
          setTimeout(wait, 250);
        };
        wait();
      };
      el.querySelector('button').addEventListener('click', begin);
    };
    // (a test that did not end the last time - the page stuck, closed, put out of memory - or ended a short while ago: what was
    // kept of it comes first, to be copied or sent; then a new one)
    if (!this.recover(card)) card();
  }

  // what a test kept of itself (crumb, finishBench), shown when the link is opened again: next() starts a new one. false: nothing to show
  recover(next) {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    } catch (e) {
      saved = null;
    }
    if (!saved || !saved.at) return false;
    const age = Date.now() - saved.at;
    if (age > (saved.done ? 30 * 60000 : 24 * 3600000)) return false;
    const mins = Math.max(0, Math.round(age / 60000));
    const text = saved.done
      ? saved.text
      : `Beyond the Outline — בדיקה שלא הסתיימה (${saved.mode === 'focus' ? 'ממוקדת' : 'מסלול'})\nהיא נעצרה בשלב: ${saved.stage} (אחרי ${saved.secs} שניות)\n${(saved.blocks || []).length ? `חסימות של הדף: ${saved.blocks.map((x) => `${x.gap}ms בשנייה ${x.at} בשלב ${x.stage}`).join(' · ')}\n` : ''}מה שנאסף עד אז:\n${(saved.lines || []).join('\n') || '(עוד לא נאסף כלום)'}`;
    const el = document.createElement('div');
    el.id = 'perf-recover';
    el.style.cssText = 'position:fixed;inset:0;z-index:47;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;background:rgba(16,12,30,0.7);direction:rtl;font-family:"Rubik",system-ui,sans-serif';
    el.innerHTML =
      '<div style="max-width:min(520px,94vw);box-sizing:border-box;padding:14px 18px 16px;border-radius:14px;background:#fff8ec;color:#1b1430;text-align:center;box-shadow:0 6px 30px rgba(0,0,0,0.45)">' +
      `<div style="font-size:19px;font-weight:700;margin-bottom:6px">${saved.done ? `הדוח של הבדיקה האחרונה (לפני ${mins} דקות)` : 'הבדיקה הקודמת לא הסתיימה'}</div>` +
      `<div style="font-size:14px;line-height:1.5;margin-bottom:10px">${saved.done ? 'אפשר להעתיק או לשלוח אותו שוב.' : `היא נעצרה בשלב: ${saved.stage} (אחרי ${saved.secs} שניות). מה שנאסף עד אז נשמר: אפשר להעתיק או לשלוח אותו.`}</div>` +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
      '<button data-a="copy" style="font-weight:700;font-size:17px;font-family:inherit;padding:9px 20px;border:3px solid #1b1430;border-radius:12px;background:#fff;color:#1b1430">העתקה</button>' +
      '<button data-a="share" style="font-weight:700;font-size:17px;font-family:inherit;padding:9px 20px;border:3px solid #1b1430;border-radius:12px;background:#fff;color:#1b1430">שיתוף</button>' +
      '<button data-a="new" style="font-weight:700;font-size:17px;font-family:inherit;padding:9px 20px;border:3px solid #1b1430;border-radius:12px;background:#ffd23f;color:#1b1430">בדיקה חדשה</button>' +
      '</div></div>';
    (document.getElementById('app') || document.body).appendChild(el);
    el.addEventListener('click', (e) => {
      const a = e.target && e.target.dataset ? e.target.dataset.a : null;
      if (a === 'copy') copyText(text, this.game);
      else if (a === 'share') {
        if (!shareText(text)) copyText(text, this.game);
      }
      else if (a === 'new') {
        el.remove();
        next();
      }
    });
    return true;
  }

  // (the test route's progress on the screen, twice a second: which part of it it is in, and how far; b: the
  // route, or null to take it away)
  progress(b) {
    let el = this._prog || null;
    if (!b) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      this._prog = null;
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'perf-progress';
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(max(8px,env(safe-area-inset-bottom)) + 4px);z-index:45;max-width:92vw;box-sizing:border-box;padding:6px 14px;border-radius:10px;background:rgba(16,12,30,0.78);color:#fff;font:600 14px/1.45 "Rubik",system-ui,sans-serif;text-align:center;direction:rtl;pointer-events:none';
      (document.getElementById('app') || document.body).appendChild(el);
      this._prog = el;
    }
    const n = b.driveSecs > 0 ? 3 : 2;
    const sec = (v, of) => `${Math.max(0, Math.min(Math.round(of), Math.round(v)))} מתוך ${Math.round(of)} שניות`;
    let part;
    if (b.focus) {
      const F = b.focus;
      part = F.spot ? `מקום ${F.i + 1} מתוך ${F.spots.length}: ${F.spot.name} · ${F.phaseHe}` : 'מתחילים';
    } else if (b.drive) part = `חלק 3 מתוך ${n}: נסיעה ביבשה, ${b.drive.build ? 'בונים את ההתחלה' : sec(b.drive.t - b.drive.settle, b.drive.secs)}`;
    else if (b.still) part = `חלק 2 מתוך ${n}: עומדים במקום, ${Math.max(1, Math.min(b.still.i + 1, b.stands.length))} מתוך ${b.stands.length}${b.still.build ? ' · בונים את המקום' : ''}`;
    else part = `חלק 1 מתוך ${n}: הליכה ברחובות, ${sec(b.t - b.warm, b.secs)}`;
    const text = `מבחן הביצועים רץ · ${part}\nבלי לגעת במסך. בסוף יופיע דוח עם כפתורי העתקה ושיתוף`;
    if (el.dataset.t !== text) {
      el.dataset.t = text;
      el.innerHTML = '';
      const lines = text.split('\n');
      el.appendChild(document.createTextNode(lines[0]));
      el.appendChild(document.createElement('br'));
      const small = document.createElement('span');
      small.style.cssText = 'font-weight:400;font-size:12px;opacity:0.85';
      small.textContent = lines[1];
      el.appendChild(small);
    }
  }

  // where the camera is at distance d along the route (Catmull-Rom through the points); R: another route's
  // (the drive's), with the same pts, acc, len
  routeAt(d, out, R = this.bench) {
    const b = R;
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
    // (ROADMAP 19.6: the focused test has its own way)
    if (b.focus) {
      this.focusStep(dt);
      return true;
    }
    // (ROADMAP 19.4, 5.1: after the stands, the drive)
    if (b.drive) {
      this.driveStep(dt);
      return true;
    }
    const cam = this.game.camera;
    // (after the route: standing still at its start)
    const at = b.still ? b.still.at : null;
    if (at) {
      // (ROADMAP 19: standing at a place of the mainland - the player was put there, and stays)
      cam.position.set(at.pos[0], at.pos[1], at.pos[2]);
      cam.lookAt(at.look[0], at.look[1], at.look[2]);
    } else {
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
    b.still = { i: -1, t: 0, frames: [], fps: [], tr: [], cl: [], at: null, place: null, settle: 1, total: 0 };
    this.nextStill();
  }

  nextStill() {
    const b = this.bench;
    const s = b.still;
    const g = this.game;
    const pipe = g.pipe;
    if (s.i >= 0) {
      const sm = this.summary(s.frames);
      s.fps.push(sm.fps);
      // (of each frame, the time not in the game's own code: the browser, the page around it, and
      // waiting for the graphics card)
      (s.gap || (s.gap = [])).push(Math.max(0, sm.ms - sm.upd - sm.ren));
      // (ROADMAP 19: and what the stand drew - thousands of triangles, and draw calls, a frame)
      s.tr.push(sm.tris / 1000);
      s.cl.push(sm.calls);
    }
    // (back as it was)
    pipe.scale = pipe.defaultScale || b.scale;
    pipe.reflections = b.refl;
    pipe.noSunPass = false;
    pipe.hideLife = false;
    b.noDraw = false;
    GFX.off = false;
    s.i++;
    s.t = 0;
    s.frames = [];
    // (v5) each pass on its own, timed straight (render/pipeline.js profile): where the island's stands
    // were, before the places of the mainland
    if (s.i === b.islandN && b.stages === undefined) {
      try {
        // (on a phone the few passes that matter: a timing of everything held the page for as long as it took)
        b.stages = this.stages(GFX.phone);
      } catch (e) {
        b.stages = null;
      }
    }
    if (s.i >= b.stands.length) {
      // (ROADMAP 19.4, 5.1: and then the drive, where the mainland is built)
      if (b.driveSecs > 0) this.beginDrive();
      else this.endBench();
      return;
    }
    const st = b.stands[s.i];
    // (ROADMAP 19) a place of the mainland: built round the player, who is put there
    const P = st.place || null;
    if (P && s.place !== P) {
      s.place = P;
      g.hud.toast(`בונים את ${P.name}…`, 'info', 4);
      // (the player put there, and the place built round him a little a frame, the picture going on - not mainland.fill, which holds
      // the page for as long as it takes: on a phone many seconds each time, and the test looked stuck. buildStep)
      g.player.spawn(P.x, P.z, P.yaw);
      g.camRig.yaw = P.yaw;
      s.build = { x: P.x, z: P.z, y: 0, t0: performance.now(), max: BUILD_MAX, name: P.name };
    }
    s.at = P;
    // (settled, not counted: a second; at a place of the mainland two, and then STILL_SECONDS counted)
    s.settle = P ? 2 : 1;
    s.total = P ? 2 + b.stillSecs : b.stillSecs;
    const what = st.what;
    if (what === 'scale') pipe.scale = pipe.minScale;
    else if (what === 'mirror') pipe.reflections = false;
    else if (what === 'shadow') pipe.noSunPass = true;
    else if (what === 'life') pipe.hideLife = true;
    else if (what === 'draw') b.noDraw = true;
    else if (what === 'old') GFX.off = true;
  }

  // ---------------------------------------------------------------- a test that cannot stop the page (ROADMAP 19.6)
  // (the owner's word: the test route "stopped after about a minute, nothing moved, and then it got stuck". What can do that: a page
  // held for tens of seconds by a place built in one go (mainland.fill), a timing of every pass (render/pipeline.js profile), or a frame
  // that threw and so was the last one - game.js tick used to ask for the next frame only at the end of one.)

  // where the test is, in words (the progress, the page's heartbeat, the crumbs)
  stageName(b) {
    if (!b) return '';
    if (b.focus) {
      const F = b.focus;
      return F.spot ? `${F.spot.name} · ${F.phaseHe || F.phase}` : 'התחלה';
    }
    if (b.drive) return `נסיעה ביבשה${b.drive.build ? ' · בונים את ההתחלה' : ''}`;
    if (b.still) {
      const s = b.still;
      const st = b.stands[s.i];
      return `עומדים במקום ${Math.max(1, s.i + 1)}/${b.stands.length}${st ? ` · ${st.name}${st.place ? ` · ${st.place.name}` : ''}` : ''}${s.build ? ' · בונים את המקום' : ''}`;
    }
    return 'הליכה ברחובות';
  }

  // the test's state kept where a stuck page leaves it: the next time the link is opened it can be read and sent (recover)
  crumb(force = false) {
    const b = this.bench;
    if (!b) return;
    const now = performance.now();
    if (!force && now - (this._crumbAt || 0) < 1500) return;
    this._crumbAt = now;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ at: Date.now(), mode: b.mode, done: false, stage: this.stageName(b), secs: Math.round((now - b.t0) / 1000), lines: (b.crumbLines || []).slice(-60), blocks: (b.blocks || []).slice(-5) }));
    } catch (e) {
      // (kept or not, the test goes on)
    }
  }

  // a frame of the loop threw (game.js loopError): a test that is running ends there, with what it has, and says what threw
  loopError(e) {
    if (this.bench) this.abortBench(e);
  }

  abortBench(e) {
    const b = this.bench;
    if (!b || b.aborting) return;
    b.aborting = true;
    b.error = `${e && e.message ? e.message : e}`.slice(0, 300) + (e && e.stack ? `\n${String(e.stack).split('\n').slice(0, 5).join('\n').slice(0, 600)}` : '');
    try {
      this.endBench();
    } catch (err) {
      // (even the report would not be made: the error alone is told, with what was kept)
      this.bench = null;
      this.progress(null);
      this.report(`Beyond the Outline — המבחן נעצר בגלל שגיאה\n${b.error}\nבשלב: ${this.stageName(b)}\nמה שנאסף עד אז:\n${(b.crumbLines || []).join('\n')}\nושגיאה נוספת בהכנת הדוח: ${err && err.message}`);
    }
  }

  // one frame's share of getting a place built round the player, as the game builds it as you come (the streamers' own updates), only many
  // to a frame - as many as fit in some 70 ms - and the picture going on: the page keeps answering, the progress shows, and nothing holds
  // it for tens of seconds the way mainland.fill does (on a phone, many seconds each time). Returns true when nothing wanted round the
  // place is missing or waiting - or when the time ran out (B.timedOut)
  buildStep(B, dt) {
    const g = this.game;
    const ml = g.world.mainland;
    const il = g.world.interiors;
    if (!ml || !ml.on) return true;
    const pos = B.pos || (B.pos = { x: B.x, z: B.z });
    const vel = B.vel || (B.vel = { x: 0, z: 0 });
    const t0 = performance.now();
    let k = 0;
    do {
      ml.update(dt, pos, vel);
      if (il) il.update(B.x, B.z, 0, 0, B.y);
      k++;
    } while (k < 60 && performance.now() - t0 < 70);
    B.calls = (B.calls || 0) + k;
    const idle = (st) => !st.job && !st.pending.length && !(st.parked && st.parked.length) && !st.pick(B.x, B.z, 0, 0);
    if (idle(ml.stream) && (!il || idle(il.stream))) return true;
    if (performance.now() - B.t0 > B.max) {
      B.timedOut = true;
      return true;
    }
    return false;
  }

  // (on a phone) the passes timed one by one, the few that matter: a timing of every way of drawing (render/pipeline.js profile: some twenty,
  // each a dozen times, and the shaders of the other way of drawing made on the way) holds the page for as long as it takes - seconds on a
  // computer, far longer on a phone
  lightStages(center) {
    const pipe = this.game.pipe;
    const T = pipe.timer;
    pipe.timer = null;
    const time = (fn, reps = 4) => {
      let best = Infinity;
      for (let k = 0; k < 2; k++) {
        pipe.syncGpu();
        const t0 = performance.now();
        for (let i = 0; i < reps; i++) fn();
        pipe.syncGpu();
        best = Math.min(best, (performance.now() - t0) / reps);
      }
      return best;
    };
    const out = {};
    try {
      out.shadow = time(() => pipe.renderShadows(center));
      out.reflection = pipe.reflections ? time(() => pipe.renderReflection()) : 0;
      out.main = time(() => pipe.drawMain());
      const life = pipe.hideMoving().slice();
      out.city = time(() => pipe.drawMain());
      for (const o of life) o.visible = true;
      out.ink = time(() => pipe.pass(pipe.steady ? pipe.mInkD : pipe.mInk, pipe.inkRT));
      out.glow = time(() => pipe.drawGlow(pipe.mBright.uniforms.tSrc.value, pipe._glowSize));
      out.final = time(() => pipe.pass(pipe.finalMat(), null));
      out.frame = time(() => pipe.render(center));
    } finally {
      pipe.timer = T;
    }
    return out;
  }

  // the lines of a report both tests end with: how the places were built, what held the page, what was cut, what threw
  healthLines(b) {
    const g = this.game;
    const L = [];
    if (b.builds && b.builds.length) L.push(`בניית המקומות לפני המדידה (שניות): ${b.builds.map((x) => `${x.name} ${(x.ms / 1000).toFixed(1)}${x.timedOut ? ' (לא הסתיימה בזמן)' : ''}`).join(' · ')}`);
    if (b.blocks && b.blocks.length) {
      const long = b.blocks.slice().sort((x, y) => y.gap - x.gap)[0];
      L.push(`חסימות של הדף (המסך לא ענה יותר משתי שניות): ${b.blocks.length} · הארוכה ${(long.gap / 1000).toFixed(1)} שניות, בשנייה ${long.at} של המבחן, בשלב: ${long.stage}`);
    } else L.push('חסימות של הדף (המסך לא ענה יותר משתי שניות): אין');
    if (b.interrupted) L.push('הבדיקה הופסקה בדרך (עברו לאפליקציה אחרת או שהמסך כבה): מה שנמדד אז לא אמין');
    if (g.loopErrors) L.push(`שגיאות בלולאת המשחק: ${g.loopErrors.n} · הראשונה: ${String(g.loopErrors.first).split('\n').slice(0, 3).join(' | ')}`);
    return L;
  }

  // ---------------------------------------------------------------- the focused test (ROADMAP 19.6)
  // (the owner's word: "a test specifically for the places where the speed was improved, not the regular one that runs in random places".)
  // Each place of FOCUS_SPOTS is stood in, built round the player if it is on the mainland, and seen in turn as the game draws it now (the
  // phone's own way, as the address asks) and as it drew before (GFX.off), a second of one and a second of the other, again and again,
  // at the same place and the same moment: what walks, what drives past and a phone that warms up are the same for both. At the places
  // marked key there are two more conditions in the turn: the lowest resolution (what the card's pixels cost) and no drawing at all
  // (the game's own code alone, the processor). The numbers of each condition are those of the frames after the first 0.3 s of its blocks

  focusInit(b) {
    const g = this.game;
    const ml = !!(g.world && g.world.mainland && g.world.mainland.on);
    return { spots: FOCUS_SPOTS.filter((sp) => !sp.mainland || ml), i: -1, spot: null, phase: 'next', phaseHe: '', t: 0, acc: {}, res: [], k: 0, cond: 'now', conds: ['now', 'before'], blockT: 0, measuring: false, spotT0: 0, over50: 0, over100: 0, frames: 0, longest: 0, crowd: null, build: null, fx: null, quick: false };
  }

  // a condition's state: as the game is, as it was before, at the lowest resolution, not drawn
  focusCond(cond) {
    const b = this.bench;
    const pipe = this.game.pipe;
    pipe.scale = pipe.defaultScale || b.scale;
    pipe.reflections = b.refl;
    pipe.noSunPass = false;
    pipe.hideLife = false;
    b.noDraw = false;
    GFX.off = false;
    if (cond === 'before') GFX.off = true;
    else if (cond === 'scale') pipe.scale = pipe.minScale;
    else if (cond === 'draw') b.noDraw = true;
  }

  // the next place (the one just done put away), or the end
  focusNext() {
    const b = this.bench;
    const F = b.focus;
    const g = this.game;
    if (F.spot) this.focusClose();
    F.i++;
    if (F.i >= F.spots.length) {
      this.endBench();
      return;
    }
    const sp = F.spots[F.i];
    F.spot = sp;
    F.acc = {};
    F.k = 0;
    F.blockT = 0;
    F.measuring = false;
    F.fx = null;
    F.t = 0;
    F.spotT0 = performance.now();
    F.conds = sp.key ? ['now', 'before', 'scale', 'draw'] : ['now', 'before'];
    this.focusCond('now');
    if (sp.mainland) {
      g.hud.toast(`בונים את ${sp.name}…`, 'info', 4);
      g.player.spawn(sp.x, sp.z, sp.yaw);
      g.camRig.yaw = sp.yaw;
      F.build = { x: sp.x, z: sp.z, y: 0, t0: performance.now(), max: BUILD_MAX, name: sp.name };
      F.phase = 'build';
      F.phaseHe = 'בונים את המקום';
    } else {
      if (sp.crowd) this.focusCrowd(sp);
      F.phase = 'settle';
      F.phaseHe = 'מתייצבים';
    }
    this.crumb(true);
  }

  // a crowd of 54 standing in rows in front of the camera, facing it: the city's own people walk away; these stay where they are put
  focusCrowd(sp) {
    const g = this.game;
    const F = this.bench.focus;
    const crowd = [];
    const x0 = sp.pos[0];
    const z0 = sp.pos[2];
    for (const d of CROWD_ROWS) {
      const sep = d <= 12 ? 1.0 : d <= 24 ? 1.3 : 1.6;
      CROWD_KINDS.forEach((kind, i) => {
        const x = x0 + (i - (CROWD_KINDS.length - 1) / 2) * sep;
        const c = g.civilians.spawnScripted(x, z0 - d, folkLook(kind), { focus: true }, null);
        c.fx = x;
        c.fz = z0 - d;
        c.yaw = 0;
        if (c.fig) c.fig.yaw = 0;
        crowd.push(c);
      });
    }
    F.crowd = crowd;
  }

  // one frame of the focused test: the camera, the player, the crowd, and the turn of the conditions
  focusStep(dt) {
    const b = this.bench;
    const F = b.focus;
    const g = this.game;
    if (F.phase === 'next') {
      this.focusNext();
      if (!this.bench) return;
    }
    const sp = F.spot;
    const cam = g.camera;
    cam.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
    cam.lookAt(sp.look[0], sp.look[1], sp.look[2]);
    if (!sp.mainland) {
      // (the city's life lives round the player: he stands under the camera)
      const gh = groundHeight(sp.x, sp.z);
      if (gh >= 0) {
        g.player.pos.set(sp.x, gh, sp.z);
        g.player.vel.set(0, 0, 0);
      }
    }
    if (F.crowd) {
      for (const c of F.crowd) {
        c.pos.x = c.fx;
        c.pos.z = c.fz;
        c.yaw = 0;
        if (c.fig) c.fig.yaw = 0;
      }
    }
    if (F.phase === 'build') {
      // (a place built round the player a little a frame, the camera held: not counted)
      if (!this.buildStep(F.build, dt)) return;
      b.builds.push({ name: sp.name, ms: Math.round(performance.now() - F.build.t0), calls: F.build.calls || 0, timedOut: !!F.build.timedOut });
      F.build = null;
      F.phase = 'settle';
      F.phaseHe = 'מתייצבים';
      F.t = 0;
      return;
    }
    if (F.phase === 'settle') {
      F.t += dt;
      if (F.t >= (F.quick ? 0.5 : 2)) {
        F.phase = 'measure';
        F.phaseHe = 'מודדים';
        F.k = 0;
        F.cond = F.conds[0];
        this.focusCond(F.cond);
        F.blockT = 0;
        F.measuring = false;
      }
      return;
    }
    // measure: the conditions turn about in blocks of a second
    F.blockT += dt;
    F.measuring = F.blockT >= FOCUS_DROP;
    if (F.blockT < FOCUS_BLOCK) return;
    // (what the change did here, taken at the end of a block of 'now')
    if (F.cond === 'now') F.fx = this.focusFx();
    F.k++;
    F.cond = F.conds[F.k % F.conds.length];
    this.focusCond(F.cond);
    F.blockT = 0;
    F.measuring = false;
    const n = (c) => (F.acc[c] ? F.acc[c].dt.length : 0);
    const want = F.quick ? 6 : FOCUS_MIN;
    const cycles = Math.floor(F.k / F.conds.length);
    const enough = F.conds.every((c) => n(c) >= want) && cycles >= (F.quick ? 1 : 3);
    if (enough || cycles >= 12 || performance.now() - F.spotT0 > FOCUS_SPOT_MAX) F.phase = 'next';
  }

  // (frameEnd) a frame of the focused test: counted for the stalls, and kept for its condition while it is measured
  focusFrame(f) {
    const F = this.bench.focus;
    if (F.phase === 'measure' || F.phase === 'settle') {
      F.frames++;
      if (f.dt > 50) F.over50++;
      if (f.dt > 100) F.over100++;
      if (f.dt > F.longest) F.longest = f.dt;
    }
    if (F.phase !== 'measure' || !F.measuring) return;
    const A = F.acc[F.cond] || (F.acc[F.cond] = { dt: [], upd: [], ren: [], calls: [], tris: [] });
    A.dt.push(f.dt);
    A.upd.push(f.upd);
    A.ren.push(f.ren);
    A.calls.push(f.calls);
    A.tris.push(f.tris);
  }

  // what the change did at this place, in numbers: the shops whose goods were left out of the picture, the people and the cars drawn in lighter shapes
  focusFx() {
    const g = this.game;
    const out = {};
    const I = g.world.interiors;
    if (I && I.viewStats) out.shops = { live: I.viewStats.live, hidden: I.viewStats.hidden };
    const c = g.camera.position;
    let near = 0;
    let lite = 0;
    for (const p of g.civilians.list || []) {
      if (p.gone || !p.fig || p.inside) continue;
      if (Math.hypot(p.pos.x - c.x, p.pos.z - c.z) > 40) continue;
      near++;
      if (p.fig._lodH || p.fig._lodB) lite++;
    }
    out.people = { near, lite };
    const cm = g.cars && g.cars._lodWas;
    if (cm && cm.size) {
      let full = 0;
      let mid = 0;
      let far = 0;
      for (const lv of cm.values()) {
        if (lv === 0) full++;
        else if (lv === 1) mid++;
        else far++;
      }
      out.cars = { full, mid, far };
    }
    return out;
  }

  // the numbers of one condition at one place
  focusSum(A) {
    const n = A.dt.length;
    const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    const dt = mean(A.dt);
    const sorted = A.dt.slice().sort((x, y) => y - x);
    const worst = sorted.slice(0, Math.max(1, Math.floor(n / 100)));
    const upd = mean(A.upd);
    const ren = mean(A.ren);
    return { n, ms: dt, fps: dt > 0 ? 1000 / dt : 0, low1: mean(worst) > 0 ? 1000 / mean(worst) : 0, upd, ren, wait: Math.max(0, dt - upd - ren), calls: mean(A.calls), tris: mean(A.tris) / 1000 };
  }

  // the place just done: its numbers put away, its crowd sent off
  focusClose() {
    const b = this.bench;
    const F = b.focus;
    const sp = F.spot;
    if (!sp) return;
    const sum = {};
    for (const c of Object.keys(F.acc)) sum[c] = this.focusSum(F.acc[c]);
    const r = { sp, sum, fx: F.fx, real: Math.round(performance.now() - F.spotT0), incomplete: F.phase !== 'next' };
    F.res.push(r);
    if (F.crowd) {
      for (const c of F.crowd) c.gone = true;
      F.crowd = null;
    }
    F.spot = null;
    b.crumbLines.push(this.focusLine(r));
    this.crumb(true);
  }

  // one line of a place: its frames a second now against before
  focusLine(r) {
    const a = r.sum.now;
    const o = r.sum.before;
    if (!a || !o) return `${r.sp.name}: לא נמדד עד הסוף`;
    const d = (a.fps / Math.max(0.01, o.fps) - 1) * 100;
    return `${r.sp.name}: ${a.fps.toFixed(1)} מול ${o.fps.toFixed(1)} פריימים בשנייה (${d >= 0 ? '+' : ''}${d.toFixed(0)}%) · פריים ${a.ms.toFixed(1)}ms מול ${o.ms.toFixed(1)}ms${r.incomplete ? ' (המקום לא נגמר)' : ''}`;
  }

  // the focused test's report
  focusText(b, { device, c, secs }) {
    const g = this.game;
    const F = b.focus;
    const f1 = (v) => (v || 0).toFixed(1);
    const yn = (v) => (v ? 'כן' : 'לא');
    const pc = (a, o) => {
      const d = (a / Math.max(0.01, o) - 1) * 100;
      return `${d >= 0 ? '+' : ''}${d.toFixed(0)}%`;
    };
    const cond = (label, x) => (x ? `  ${label}: ${f1(x.fps)} פריימים בשנייה (1% האיטיים ${f1(x.low1)}) · פריים ${f1(x.ms)}ms = משחק ${f1(x.upd)} + שליחת ציור ${f1(x.ren)} + המתנה ${f1(x.wait)} · ${Math.round(x.calls)} קריאות ציור · ${Math.round(x.tris)}K משולשים · ${x.n} פריימים` : null);
    const L = [];
    L.push(b.error ? `המבחן נעצר בגלל שגיאה (מה שנאסף עד אז בדוח): ${b.error}` : null);
    L.push(`Beyond the Outline — בדיקת ביצועים ממוקדת במקומות ששופרו (${F.res.length} מקומות, ${Math.round(secs)} שניות)`);
    L.push(`מכשיר: ${device || 'לא ידוע'}`);
    L.push(`מסך: ${c.width}×${c.height} · קנה מידה ${g.pipe.scale.toFixed(2)} · ${navigator.userAgent.includes('Mobile') ? 'טלפון' : 'מחשב'} · דפדפן: ${browserName()}${b.battery ? ` · סוללה ${Math.round(b.battery.level * 100)}%${b.battery.charging ? ' בטעינה' : ''}` : ''}`);
    L.push(`מה ש"עכשיו" כולל (הטלפון מצייר כך כשהקישור מבקש): חנויות שהקירות מסתירים את הסחורה שלהן ${yn(GFX.shopView)} · מכוניות רחוקות בפחות נקודות ${yn(GFX.carLod)} · אנשים בצורות קלות לפי המרחק ${yn(GFX.folkLod)} · מעבר סיום קל ${yn(GFX.finalLite)}. "כמו קודם": כל אלה כבויים.${GFX.on ? '' : ' (כאן החלקים כבויים - מחשב או ?oldgfx: אין מה להשוות)'}`);
    L.push('');
    L.push('תקציר: פריימים בשנייה "עכשיו" מול "כמו קודם". כל מקום נמדד בבלוקים של שנייה לסירוגין, באותו מקום ובאותו רגע:');
    for (const r of F.res) L.push(`  ${this.focusLine(r)}`);
    L.push('');
    L.push('פירוט לפי מקום:');
    F.res.forEach((r, i) => {
      const S = r.sum;
      L.push(`${i + 1}. ${r.sp.name} — מה שופר כאן: ${r.sp.what}${r.incomplete ? ' (המקום לא נגמר: המבחן נעצר)' : ''}`);
      L.push(cond('עכשיו', S.now));
      L.push(cond('כמו קודם', S.before));
      if (S.now && S.before) L.push(`  ההפרש: ${pc(S.now.fps, S.before.fps)} פריימים בשנייה · ${(S.now.ms - S.before.ms >= 0 ? '+' : '') + f1(S.now.ms - S.before.ms)}ms בפריים · ${Math.round(S.now.calls - S.before.calls)} קריאות ציור · ${Math.round(S.now.tris - S.before.tris)}K משולשים`);
      if (S.scale) L.push(cond('עכשיו ברזולוציה הנמוכה ביותר', S.scale));
      if (S.draw) L.push(`  עכשיו בלי ציור בכלל (קוד המשחק לבד): משחק ${f1(S.draw.upd)}ms בפריים`);
      if (S.now) {
        const w = S.now.ms > 0 ? S.now.wait / S.now.ms : 0;
        const part = w > 0.5 ? `הכרטיס (ההמתנה היא ${Math.round(w * 100)}% מהפריים)` : w > 0.25 ? `מעורב (ההמתנה ${Math.round(w * 100)}% מהפריים)` : `המעבד (ההמתנה רק ${Math.round(w * 100)}% מהפריים)`;
        const more = S.scale ? ` · ברזולוציה נמוכה ${pc(S.scale.fps, S.now.fps)} פריימים בשנייה` : '';
        L.push(`  מה מחזיק את הפריים כאן: ${part}${more}`);
      }
      const fx = r.fx;
      if (fx) {
        const parts = [];
        if (fx.shops) parts.push(`חנויות שהסחורה שלהן הוסתרה: ${fx.shops.hidden} מתוך ${fx.shops.live} שנטענו`);
        if (fx.people) parts.push(`אנשים עד 40 מטר: ${fx.people.near}, מהם בצורות קלות ${fx.people.lite}`);
        if (fx.cars) parts.push(`מכוניות עומדות: ${fx.cars.full} מלאות, ${fx.cars.mid} בינוניות, ${fx.cars.far} רחוקות`);
        if (parts.length) L.push(`  מה קרה כאן בפועל: ${parts.join(' · ')}`);
      }
    });
    L.push('');
    L.push(`פריימים בזמן המדידות: ${F.frames} · מעל 50ms: ${F.over50} · מעל 100ms: ${F.over100} · הארוך ביותר ${f1(F.longest)}ms · הכנת שיידרים בזמן הבדיקה: ${b.compiles} (${Math.round(b.compileMs)}ms)`);
    L.push(`מהירות המכשיר (ms לאותה עבודה, פחות זה מהר יותר): מעבד בהתחלה ${f1(b.cpu[0])}, בסוף ${f1(b.cpu[1])} · כרטיס מסך בהתחלה ${f1(b.gpuMs[0])}, בסוף ${f1(b.gpuMs[1])}`);
    L.push(b.po ? `משימות ארוכות בכל שנייה: של המשחק ${(b.busy.self / secs).toFixed(0)}ms · של הדף שמסביב ${(b.busy.other / secs).toFixed(0)}ms` : 'משימות ארוכות: הדפדפן לא מאפשר למדוד');
    for (const x of this.healthLines(b)) L.push(x);
    L.push(`${F.quick ? 'ריצה קצרה (לבדיקת הקישור): ' : ''}כל בלוק: ${FOCUS_BLOCK} שנייה, ${FOCUS_DROP} שנייה ראשונות לא נספרות; לכל מצב לפחות ${F.quick ? 6 : FOCUS_MIN} פריימים בכל מקום.`);
    return L;
  }

  // ---------------------------------------------------------------- the drive (ROADMAP 19.4, 5.1)
  // The stands are done: the player is put where the drive begins with everything round it built (as
  // after a jump across the map), and the drive begins after a short settle. The two streamers' own
  // calls are timed and noted for as long as it lasts (driveStep, driveNote), and put back at its end
  beginDrive() {
    const b = this.bench;
    const g = this.game;
    const ml = g.world.mainland;
    const il = g.world.interiors;
    // the curve through the drive's points, cut in pieces of two metres along it: a Catmull-Rom curve has no
    // even speed through points that are unevenly spaced (a short piece between long ones is gone through at
    // twice the speed), and the drive is to be at 20 m/s all the way
    const ctrl = { pts: DRIVE.map(([x, z]) => ({ x, y: 0, z })), acc: [0], len: 0 };
    for (let i = 1; i < ctrl.pts.length; i++) ctrl.acc.push(ctrl.acc[i - 1] + Math.hypot(ctrl.pts[i].x - ctrl.pts[i - 1].x, ctrl.pts[i].z - ctrl.pts[i - 1].z));
    ctrl.len = ctrl.acc[ctrl.acc.length - 1];
    const pts = [];
    {
      const q = {};
      let along = 0;
      let next = 0;
      let px = 0;
      let pz = 0;
      for (let s = 0; s <= ctrl.len; s += 0.25) {
        this.routeAt(s, q, ctrl);
        if (s > 0) along += Math.hypot(q.x - px, q.z - pz);
        px = q.x;
        pz = q.z;
        if (along >= next) {
          pts.push({ x: q.x, y: 0, z: q.z });
          next += 2;
        }
      }
      const e = ctrl.pts[ctrl.pts.length - 1];
      pts.push({ x: e.x, y: 0, z: e.z });
    }
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    const mem = () => (performance.memory ? performance.memory.usedJSHeapSize : 0);
    const D = {
      pts, acc, len: acc[acc.length - 1], t: 0, d: 0, settle: 2.5, secs: b.driveSecs, frames: [], n: 0,
      // what the streamers did in the frame that is going on (driveNote puts it on the frame, then clears it)
      ml: 0, il: 0, job: '', done: false, shown: '', warmed: '', freed: 0, far: false, ijob: '', pend: 0,
      // and over the whole drive
      built: 0, freedAll: 0, miss: 1e9, missId: '', missAt: 0, compiles0: b.compiles, compileMs0: b.compileMs, mem,
      mem0: mem(), restore: null, build: null,
    };
    b.drive = D;
    g.hud.toast('נוסעים ביבשה…', 'info', 4);
    const x0 = DRIVE[0][0];
    const z0 = DRIVE[0][1];
    const yaw = Math.atan2(DRIVE[1][0] - x0, DRIVE[1][1] - z0);
    // (the player put at the start, and its surroundings built a little a frame, the camera held there: driveStep)
    g.player.spawn(x0, z0, yaw);
    g.camRig.yaw = yaw;
    D.build = { x: x0, z: z0, y: 0, t0: performance.now(), max: BUILD_MAX, name: 'תחילת הנסיעה' };
    // the two streamers' calls, each timed and noted (put back at the end: endBench)
    const s = ml.stream;
    const mUpdate = ml.update;
    ml.update = function driveUpdate(dt, pos, vel) {
      const st = s.stats;
      const built0 = st.built;
      const freed0 = st.freed;
      const last0 = st.last;
      const head = s.pending[0] || null;
      const left0 = head ? head.meshes.length : 0;
      const far0 = this.farAt;
      const t0 = performance.now();
      const r = mUpdate.call(this, dt, pos, vel);
      D.ml = performance.now() - t0;
      // (the cell it worked on, or finished, in this frame; the one it warmed up to the card or showed)
      D.job = s.job ? s.job.cell.id : st.last !== last0 ? st.last : '';
      D.done = st.last !== last0;
      if (st.built > built0) {
        D.shown = head ? head.cell.id : '?';
        D.built += st.built - built0;
      } else if (head && head.meshes.length < left0) D.warmed = `${head.cell.id} (${head.meshes.length})`;
      D.freed = st.freed - freed0;
      D.freedAll += D.freed;
      D.far = this.farAt !== far0;
      D.pend = s.pending.length;
      return r;
    };
    let iUpdate = null;
    if (il && il.update) {
      iUpdate = il.update;
      il.update = function driveUpdate2(x, z, vx, vz, y) {
        const t0 = performance.now();
        const r = iUpdate.call(this, x, z, vx, vz, y);
        D.il = performance.now() - t0;
        const j = this.stream && this.stream.job;
        D.ijob = j ? j.cell.id : '';
        return r;
      };
    }
    D.restore = () => {
      delete ml.update;
      if (iUpdate) delete il.update;
    };
  }

  // the camera and the player along the drive, a frame at a time
  driveStep(dt) {
    const b = this.bench;
    const D = b.drive;
    const g = this.game;
    const cam = g.camera;
    if (D.build) {
      // (held at the start while its surroundings are built; the settle begins when they are)
      if (this.buildStep(D.build, dt)) {
        b.builds.push({ name: D.build.name, ms: Math.round(performance.now() - D.build.t0), calls: D.build.calls || 0, timedOut: !!D.build.timedOut });
        D.build = null;
        D.t = 0;
      }
    } else D.t += dt;
    const run = D.t - D.settle;
    const d = Math.max(0, Math.min(D.len, run * DRIVE_SPEED));
    D.d = d;
    const p = this.routeAt(d, this._p || (this._p = {}), D);
    const q = this.routeAt(d + 14, this._q || (this._q = {}), D);
    const gh = groundHeight(p.x, p.z);
    const y = Math.max(0, gh) + 2.4;
    cam.position.set(p.x, y, p.z);
    cam.lookAt(q.x, y - 0.5, q.z);
    // (the city's life lives round the player: he goes under the camera, at the speed of the drive)
    if (gh >= 0) {
      const pl = g.player;
      pl.pos.set(p.x, gh, p.z);
      pl.vel.set(0, 0, 0);
    }
    // (every few frames: how far from the car the nearest cell the streamer wants and has not got is)
    if (run > 0 && (D.n++ & 7) === 0) {
      const s = g.world.mainland.stream;
      for (const c of s.cells) {
        if (s.live.has(c.id) || c.failed) continue;
        const m = s.distTo(c, p.x, p.z);
        if (m < D.miss) {
          D.miss = m;
          D.missId = c.id;
          D.missAt = d;
        }
      }
    }
    // (the first moments settle, and what was being built for the start; they are not counted)
    if (run < 0) {
      D.frames.length = 0;
      D.miss = 1e9;
      D.built = 0;
      D.freedAll = 0;
      D.compiles0 = b.compiles;
      D.compileMs0 = b.compileMs;
      D.mem0 = D.mem();
    } else if (run >= D.secs || d >= D.len - 1e-3) this.endBench();
  }

  // (frameEnd) what the streamers did in this frame, put on its record
  driveNote(f) {
    const D = this.bench.drive;
    f.dm = D.d;
    f.at = Math.max(0, D.t - D.settle);
    f.ml = D.ml;
    f.il = D.il;
    f.job = D.job;
    f.done = D.done;
    f.shown = D.shown;
    f.warmed = D.warmed;
    f.freed = D.freed;
    f.far = D.far;
    f.pend = D.pend || 0;
    f.ijob = D.ijob;
    f.mem = D.mem();
    D.ml = D.il = D.freed = 0;
    D.job = D.shown = D.warmed = D.ijob = '';
    D.done = D.far = false;
  }

  // the drive's lines of the report
  driveLines(b) {
    const D = b.drive;
    // (the frames of the drive itself: not the settle before it)
    const fr = D ? D.frames.filter((f) => f.at > 0) : [];
    if (fr.length < 2) return [];
    const sm = this.summary(fr);
    const n = fr.length;
    const over = (ms) => fr.filter((f) => f.dt > ms).length;
    const n50 = over(50);
    const n100 = over(100);
    const pc = (k) => Math.round((100 * k) / n);
    // (the heap of the page's code: how much it grew, and how many times it fell by a megabyte or more - a collection)
    let gcs = 0;
    for (let i = 1; i < n; i++) {
      if (fr[i].mem && fr[i - 1].mem && fr[i - 1].mem - fr[i].mem > 1e6) {
        gcs++;
        fr[i].gc = (fr[i - 1].mem - fr[i].mem) / 1e6;
      }
    }
    const mb = (v) => (v / 1e6).toFixed(0);
    const heap = fr[0].mem ? `זיכרון הקוד ${mb(D.mem0)}→${mb(fr[n - 1].mem)} מ"ב, ${gcs} איסופי זבל` : 'זיכרון הקוד: הדפדפן לא מאפשר למדוד';
    const ms = (v) => (v || 0).toFixed(0);
    const worst = fr.slice().sort((x, y) => y.dt - x.dt).slice(0, 5);
    const what = (f) => {
      const rest = Math.max(0, f.dt - f.upd - f.ren);
      const parts = [];
      if (f.job) parts.push(`${f.done ? 'סיימה' : 'בונה'} ${f.job}`);
      if (f.warmed) parts.push(`העלאה לכרטיס ${f.warmed}`);
      if (f.shown) parts.push(`הוצג ${f.shown}`);
      if (f.freed) parts.push(`שוחררו ${f.freed}`);
      if (f.far) parts.push('הצללים הרחוקים זזו');
      const ml = `היבשה ${f.ml.toFixed(1)}ms${parts.length ? ` (${parts.join(' · ')}${f.pend ? ` · ממתינים ${f.pend}` : ''})` : ''}`;
      const sh = f.il > 0.05 ? ` · חנויות ${f.il.toFixed(1)}ms${f.ijob ? ` (${f.ijob})` : ''}` : '';
      const gc = f.gc ? ` · הזיכרון ירד ${f.gc.toFixed(1)} מ"ב (איסוף זבל)` : '';
      const who = rest > 0.6 * f.dt ? 'מחוץ לקוד המשחק: ההמתנה לכרטיס או לדפדפן' : f.ml + f.il > 0.4 * f.dt ? 'הבנייה' : f.upd > f.ren ? 'קוד המשחק' : 'שליחת הציור';
      return `${who} · ${ml}${sh}${gc}`;
    };
    const lines = [
      `נסיעה ביבשה, מהגשר אל הקניון (${Math.round(sm.ms * n / 1000)} שניות, ${DRIVE_SPEED} מ' לשנייה, ${n} פריימים): פריימים בשנייה ${sm.fps.toFixed(1)} · 1% האיטיים ${sm.low1.toFixed(1)} · הפריים האיטי ביותר ${sm.worst.toFixed(0)}ms`,
      `בנסיעה: פריימים מעל 50ms ${n50} (${pc(n50)}%) · מעל 100ms ${n100} (${pc(n100)}%) · הארוך ביותר ${sm.worst.toFixed(0)}ms · מעבד: משחק ${sm.upd.toFixed(1)}ms, שליחת הציור ${sm.ren.toFixed(1)}ms`,
      `הבנייה בנסיעה: הוצגו ${D.built} תאים, שוחררו ${D.freedAll} · הכי קרוב שהיה חסר ${D.miss < 1e8 ? `${D.miss.toFixed(0)} מ' (${D.missId}, במטר ${Math.round(D.missAt)} של הנסיעה)` : '-'} · הכנת שיידרים בנסיעה ${b.compiles - D.compiles0} (${Math.round(b.compileMs - D.compileMs0)}ms) · ${heap}`,
      'חמשת הפריימים האיטיים ביותר בנסיעה, ומה נבנה בהם:',
    ];
    worst.forEach((f, i) => {
      lines.push(`  ${i + 1}. ${f.dt.toFixed(0)}ms בשנייה ${f.at.toFixed(1)} (מטר ${Math.round(f.dm)}): משחק ${ms(f.upd)} · שליחת ציור ${ms(f.ren)} · מחוץ לקוד ${ms(Math.max(0, f.dt - f.upd - f.ren))} — ${what(f)}`);
    });
    return lines;
  }

  // the passes timed one by one where the test stands (as the game draws it: the sun's box ahead of
  // the camera)
  stages(light = false) {
    const g = this.game;
    const cam = g.camera;
    cam.updateMatrixWorld();
    const f = cam.getWorldDirection(this._f || (this._f = new THREE.Vector3()));
    const c = cam.position;
    const center = new THREE.Vector3(c.x + f.x * 35, 0, c.z + f.z * 35);
    return light ? this.lightStages(center) : g.pipe.profile(center);
  }

  stillStep(dt) {
    const b = this.bench;
    const s = b.still;
    // (a place of the mainland being built round the player, a little a frame: not counted)
    if (s.build) {
      if (!this.buildStep(s.build, dt)) {
        s.frames.length = 0;
        return;
      }
      b.builds.push({ name: s.build.name, ms: Math.round(performance.now() - s.build.t0), calls: s.build.calls || 0, timedOut: !!s.build.timedOut });
      s.build = null;
      s.t = 0;
    }
    s.t += dt;
    // (the first second settles: not counted - two at a place of the mainland, which is still filling in)
    if (s.t < (s.settle || 1)) s.frames.length = 0;
    if (s.t >= (s.total || this.bench.stillSecs)) this.nextStill();
  }

  endBench() {
    const g = this.game;
    const b = this.bench;
    // (the focused test: the place it is at put away - its crowd sent off - and its numbers kept)
    if (b.focus && b.focus.spot) this.focusClose();
    const s = this.summary(b.frames);
    b.cpu.push(cpuSpeed());
    b.gpuMs.push(gpuSpeed(g.renderer));
    if (b.po) b.po.disconnect();
    const secs = Math.max(1, (performance.now() - b.t0) / 1000);
    const gpu = b.gpuRoute !== undefined ? b.gpuRoute : this.gpu.ok ? this.gpu.take(true) : null;
    this.bench = null;
    if (b.unhook) b.unhook();
    // (ROADMAP 19.6: the page's heartbeat stopped)
    if (b.wd) clearInterval(b.wd);
    if (b.onVis) document.removeEventListener('visibilitychange', b.onVis);
    // (ROADMAP 19.4, 5.1: the streamers' calls as they were)
    if (b.drive && b.drive.restore) b.drive.restore();
    // (the screen let go of, and the progress taken off it)
    try {
      if (b.lock) b.lock.release().catch(() => {});
    } catch (e) {
      // (it goes dark by itself again)
    }
    this.progress(null);
    g.pipe.scale = b.scale;
    g.pipe.taaFrac = b.taaFrac;
    g.pipe.reflections = b.refl;
    g.pipe.noSunPass = false;
    g.pipe.hideLife = false;
    GFX.off = false;
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
    // (ROADMAP 19.6: the focused test has a report of its own)
    if (b.focus) {
      this.finishBench(b, this.focusText(b, { device, c, secs }).filter((x) => x !== null && x !== undefined).join('\n'), null);
      return;
    }
    const st = b.stages;
    const ms = (v) => (v || 0).toFixed(1);
    const lines = [
      b.error ? `המבחן נעצר בגלל שגיאה (מה שנאסף עד אז בדוח): ${b.error}` : '',
      `Beyond the Outline — מסלול מבחן (${Math.round(b.secs)} שניות, ${b.frames.length} פריימים)`,
      `מכשיר: ${device || 'לא ידוע'}`,
      `מסך: ${c.width}×${c.height} · קנה מידה ${g.pipe.scale.toFixed(2)} · ציור חכם ${g.pipe.taa ? `${Math.round(g.pipe.taaFrac * 100)}%` : 'כבוי'} · ${navigator.userAgent.includes('Mobile') ? 'טלפון' : 'מחשב'}`,
      `פריימים בשנייה, ממוצע: ${s.fps.toFixed(1)} · 1% האיטיים: ${s.low1.toFixed(1)} · הפריים האיטי ביותר: ${s.worst.toFixed(1)}ms`,
      g.pace && g.pace.on ? `קצב הפריימים במשחק: יציב (${{ auto: 'אוטומטי', 60: '60', 30: '30' }[g.pace.mode]}) · המסלול עצמו נמדד בקצב הרגיל` : 'קצב הפריימים במשחק: רגיל',
      `פריימים: עד 17ms ${share(0, 17.5)}% · עד 34ms ${share(17.5, 34.5)}% · יותר ${share(34.5, 1e9)}% · הכנת שיידרים ${b.compiles} (${Math.round(b.compileMs)}ms)`,
      b.still && b.still.fps.length >= b.islandN ? `עומדים במקום, פריימים בשנייה: ${b.stands.slice(0, b.islandN).map(({ name }, i) => `${name} ${b.still.fps[i].toFixed(1)}`).join(' · ')}` : '',
      b.still && b.still.gap && b.still.gap.length >= b.islandN ? `מזה, זמן בכל פריים מחוץ לקוד המשחק (ms): ${b.stands.slice(0, b.islandN).map(({ name }, i) => `${name} ${b.still.gap[i].toFixed(0)}`).join(' · ')}` : '',
      // (ROADMAP 19) what each stand drew: thousands of triangles / draw calls a frame
      b.still && b.still.tr.length >= b.islandN ? `עומדים במקום, אלפי משולשים / קריאות ציור: ${b.stands.slice(0, b.islandN).map(({ name }, i) => `${name} ${b.still.tr[i].toFixed(0)}/${Math.round(b.still.cl[i])}`).join(' · ')}` : '',
      // (and the places of the mainland: frames a second (thousands of triangles / draw calls))
      b.still && b.stands.length > b.islandN && b.still.fps.length === b.stands.length ? placeLine(b) : '',
      // (ROADMAP 19.4, 5.1: the drive on the mainland: the stalls and what the streamers had in hand then)
      ...this.driveLines(b),
      ...this.healthLines(b),
      `דפדפן: ${browserName()}${window.top !== window ? ' · בתוך מסגרת' : ''} · המשחק פתוח ${b.open.toFixed(0)} דקות${b.battery ? ` · סוללה ${Math.round(b.battery.level * 100)}%${b.battery.charging ? ' בטעינה' : ''}` : ''}`,
      `מהירות המכשיר (ms לאותה עבודה, פחות זה מהר יותר): מעבד בהתחלה ${b.cpu[0].toFixed(1)}, בסוף ${b.cpu[1].toFixed(1)} · כרטיס מסך בהתחלה ${b.gpuMs[0].toFixed(1)}, בסוף ${b.gpuMs[1].toFixed(1)}`,
      b.po ? `משימות ארוכות בכל שנייה: של המשחק ${(b.busy.self / secs).toFixed(0)}ms · של הדף שמסביב ${(b.busy.other / secs).toFixed(0)}ms` : 'משימות ארוכות: הדפדפן לא מאפשר למדוד',
      `מעבד: משחק ${s.upd.toFixed(2)}ms · שליחת הציור ${s.ren.toFixed(2)}ms`,
      `עומק קודם: ${g.pipe.depthFirst ? 'כן' : 'לא'}${g.depthTrial && g.depthTrial.result ? ` (נבדק: עם ${g.depthTrial.result.on}ms, בלי ${g.depthTrial.result.off}ms)` : ''} · עומק הקירות קודם: ${g.pipe.wallsFirst && g.pipe.walls ? 'כן' : 'לא'}${g.depthTrial && g.depthTrial.walls ? ` (נבדק: עם ${g.depthTrial.walls.on}ms, בלי ${g.depthTrial.walls.off}ms)` : ''}`,
      pensLine(g, false),
      st ? `כל שלב לבד, נמדד ישירות בסוף (ms): צל ${ms(st.shadow)} · השתקפות ${ms(st.reflection)} · ציור ${ms(st.main)}${g.pipe.deferred && st.pens !== undefined ? ` (מזה העטים ${ms(st.pens)})` : ''} · דיו ${ms(st.ink)} · זוהר ${ms(st.glow)} · סיום ${ms(st.final)} · פריים שלם ${ms(st.frame)}` : 'כל שלב לבד: המדידה לא הצליחה',
      st && st.other ? `הציור בדרך השנייה (ms): ${g.pipe.deferred ? 'בשלב אחד, כמו קודם' : 'בשני שלבים'} ${ms(st.other)} · ככה: ${ms(st.main)}` : '',
      st && st.flip !== undefined ? `הציור (ms): כמו שהוא ${ms(st.main)} · בלי אנשים ומכוניות ${ms(st.city)} · ב-1/16 מהפיקסלים ${ms(st.tiny)} · ${g.pipe.wallsFirst ? 'בלי' : 'עם'} עומק הקירות קודם ${ms(st.walls)} · ${g.pipe.depthFirst ? 'בלי' : 'עם'} עומק קודם מלא ${ms(st.flip)}${st.kill !== undefined ? ` · בחומרים הישנים (עם discard) ${ms(st.kill)}` : ''}` : st ? `הציור (ms): כמו שהוא ${ms(st.main)} · בלי אנשים ומכוניות ${ms(st.city)}` : '',
      st && st.noPens !== undefined ? `הציור בלי חלק אחד (ms): בלי העטים ${ms(st.noPens)} · בלי הצל של השמש ${ms(st.noSun)} · בלי הפנסים ${ms(st.noLamps)} · בלי הערפל ${ms(st.noHaze)} · רק צבע ${ms(st.flat)} · בלי ההשתקפות ברחוב ${ms(st.noReflImg)} · המראה ${g.pipe.mirrorPlain ? 'עם' : 'בלי'} עטים ${ms(st.reflFlip)} (ככה: ${ms(st.reflection)})` : '',
      gpu && Object.keys(gpu).length ? `כרטיס מסך: ${PASSES.filter((p) => gpu[p] !== undefined).map((p) => `${PASS_HE[p]} ${gpu[p].toFixed(2)}ms`).join(' · ')}` : 'כרטיס מסך: הדפדפן לא מאפשר למדוד',
      `draw calls: ממוצע ${Math.round(s.calls)} · שיא ${s.maxCalls} · ${(s.tris / 1e6).toFixed(2)}M משולשים`,
      `לפי מעבר: ${PASSES.filter((p) => s.pass[p] !== undefined).map((p) => `${PASS_HE[p]} ${Math.round(s.pass[p])}`).join(' · ')}`,
      `מערכות (ms): ${Object.entries(s.sys).sort((a, b2) => b2[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(' · ')}`,
      this.shaderLine(false) || `הכנת השיידרים: בלי הערות של הדפדפן (${this.shaderNotes().of})`,
    ];
    const text = lines.filter(Boolean).join('\n');
    this.finishBench(b, text, st);
  }

  // the report shown, and kept where the next visit finds it (recover), and sent where there is a store (game/telemetry.js)
  finishBench(b, text, st) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ at: Date.now(), mode: b.mode, done: true, text }));
    } catch (e) {
      // (kept or not, it is shown)
    }
    this.report(text);
    if (this.game.tele) this.game.tele.bench(text, st);
  }

  report(text) {
    const g = this.game;
    let el = document.getElementById('perf-report');
    if (!el) {
      el = document.createElement('div');
      el.id = 'perf-report';
      el.className = 'overlay';
      el.innerHTML = '<div class="sheet small"><h2>תוצאות המבחן</h2><pre></pre><div class="sheet-foot"><button class="btn" data-a="copy">העתקה</button> <button class="btn" data-a="share">שיתוף</button> <button class="btn primary" data-a="close">סגירה</button></div></div>';
      (document.getElementById('app') || document.body).appendChild(el);
      el.addEventListener('click', (e) => {
        const a = e.target && e.target.dataset ? e.target.dataset.a : null;
        if (a === 'copy') copyText(el.querySelector('pre').textContent, g);
        else if (a === 'share') {
          // (the phone's own share sheet, where it has one - to a chat, a mail, a note; else copied)
          const t = el.querySelector('pre').textContent;
          if (!shareText(t)) copyText(t, g);
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
