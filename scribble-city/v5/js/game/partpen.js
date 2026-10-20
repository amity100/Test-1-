import { partOf, toXYZ, floatK, wingGlide, rotorLift } from './fusedraw.js';
import { INKS } from './freeform.js';
import { clamp } from '../core/util.js';

// (ROADMAP 11.24) The part pen: drawing a part on the car you drive - said first, then drawn.
//
// The pen out in the car, a row of what it can draw: wings, floats, a rotor. One is lit, and so is its
// place on the car - out of its sides, along its sills, on its roof. The line stays on the screen,
// under the finger, wherever it is drawn; what it will do shows by the pen as it is drawn ("wings ·
// glide ×2.5"). The pen at rest (or ✓), the ink flies from the screen to that place and is the part:
// the shape drawn, as big as it was drawn by the car on the screen. Nothing is guessed - not what it
// is, not where it goes. Each kind is kept, the last one drawn: three buttons by the steering (1-3 on
// a computer) put it on in a moment, and take it off again.

export const PEN_PARTS = ['wing', 'float', 'rotor'];
// how long the pen rests before the drawing goes (ms): another line before that is more of it
export const PEN_REST = 1000;
export const PEN_REST_TOUCH = 1150;
const NAME = { wing: 'כנפיים', float: 'מצופים', rotor: 'רוטור' };
const BOOK_KEY = 'scribble-city-v5-parts';
// the ink flying from the screen to its place; how often the drawing is read while drawn; a kept part
// drawn in at its place (ms)
const FLY_MS = 420;
const LIVE_MS = 90;
const BOIL_MS = 440;
// (strong enough to read on sand, on the sea, at night: a pale halo under a deep orange line - the
// row's lit button's colour)
const MOUNT_C = [1, 0.42, 0.04];
const HALO_C = [1, 1, 0.97];
const GLOW_C = [1, 0.97, 0.78];
// what each one sounds like as it comes (core/audio.js)
const SND = { wing: 'flap', float: 'bounce', rotor: 'whoosh' };
const ICON = {
  wing: '<svg viewBox="0 0 24 24"><rect x="9" y="7" width="6" height="11" rx="2"/><path d="M9 11 L2 9.5 L2 13 L9 15 M15 11 L22 9.5 L22 13 L15 15"/></svg>',
  float: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="12" height="7" rx="2"/><path d="M12 11 V14 M2.5 14 H21.5 C21 18 18.5 19 16 19 H8 C5.5 19 3 18 2.5 14 Z M1 22 C3 21 5 23 7 22 S11 21 13 22 S17 23 19 22 S22 21 23 22"/></svg>',
  rotor: '<svg viewBox="0 0 24 24"><rect x="6" y="13" width="12" height="7" rx="2"/><path d="M12 13 V8 M2 7 C6 6 9 8 12 8 C15 8 18 6 22 7"/></svg>',
};

const fmt = (x) => (Math.round(x * 10) / 10).toString();

// what a drawing of that part does, by its size (n) and the car's weight: { text, ok }
export function statOf(type, n, mass) {
  const pct = (k) => `${Math.round(Math.min(k, 3) * 100)}%`;
  if (type === 'wing') return { text: `גלישה ×${fmt(1 / (1 - wingGlide(n)))}`, ok: true };
  if (type === 'float') {
    const k = floatK(n, mass);
    return k >= 1 ? { text: `ציפה ${pct(k)} ✓`, ok: true } : { text: `ציפה ${pct(k)} · ארוך ועבה יותר`, ok: false };
  }
  const k = rotorLift(n, mass);
  return k >= 1 ? { text: `הרמה ${pct(k)} ✓`, ok: true } : { text: `הרמה ${pct(k)} · גדול יותר`, ok: false };
}

// where each part goes on the car (ctx: game/fuse.js drawCtx): the plane its lines lie on (ax, c),
// where it holds on (A), the side it comes out of
export function mountOf(type, ctx) {
  const D = ctx.D;
  const K = ctx.K;
  const roof = K ? K.roofY : D.h;
  const clear = K ? K.clear : 0.25;
  if (type === 'wing') {
    // (flat, out of its sides at the doors' height)
    const y = clamp(roof * 0.55, 0.45, roof - 0.1);
    return { plane: { ax: 'y', c: y }, A: [D.hw, y, -0.1], face: 'side', mirror: true };
  }
  if (type === 'float') {
    // (upright, along its sills)
    return { plane: { ax: 'x', c: D.hw + 0.12 }, A: [D.hw + 0.12, clear + 0.1, 0], face: 'side', mirror: true };
  }
  // (flat, over the middle of its roof)
  return { plane: { ax: 'y', c: roof + 0.35 }, A: [0, roof, 0], face: 'top', mirror: false };
}

// the drawing (lines of screen px) on the part's plane, in metres: by how big the car is on the screen
// there (F.perPx - a metre at the car), the way it was drawn
export function toPlane(type, strokes, F, M) {
  const k = F.perPx;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const L of strokes) {
    for (const [x, y] of L) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  if (type === 'wing') {
    // (out of the car from the drawing's edge nearer the car on the screen; up the screen, to its nose)
    const root = cx >= F.box.cx ? x0 : x1;
    const hw = M.A[0];
    const zc = M.A[2];
    return strokes.map((L) => L.map(([x, y]) => [zc - (y - cy) * k, -(hw - 0.06 + Math.abs(x - root) * k)]));
  }
  if (type === 'float') {
    // (its long way along the car, whichever way it was drawn)
    let mx = 0;
    let my = 0;
    let n = 0;
    for (const L of strokes) {
      for (const [x, y] of L) {
        mx += x;
        my += y;
        n++;
      }
    }
    mx /= n;
    my /= n;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (const L of strokes) {
      for (const [x, y] of L) {
        sxx += (x - mx) * (x - mx);
        syy += (y - my) * (y - my);
        sxy += (x - mx) * (y - my);
      }
    }
    const a = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const al = (x, y) => (x - mx) * ca + (y - my) * sa;
    const cr = (x, y) => -(x - mx) * sa + (y - my) * ca;
    let a0 = Infinity;
    let a1 = -Infinity;
    let c0 = Infinity;
    let c1 = -Infinity;
    for (const L of strokes) {
      for (const [x, y] of L) {
        a0 = Math.min(a0, al(x, y));
        a1 = Math.max(a1, al(x, y));
        c0 = Math.min(c0, cr(x, y));
        c1 = Math.max(c1, cr(x, y));
      }
    }
    const am = (a0 + a1) / 2;
    const cm = (c0 + c1) / 2;
    return strokes.map((L) => L.map(([x, y]) => [(al(x, y) - am) * k, M.A[1] - (cr(x, y) - cm) * k]));
  }
  // (a rotor: seen from over it, round its middle)
  return strokes.map((L) => L.map(([x, y]) => [-(y - cy) * k, (x - cx) * k]));
}

export class PartPen {
  constructor(fz) {
    this.fz = fz;
    this.game = fz.game;
    // the part the pen draws now
    this.type = 'wing';
    this.isOpen = false;
    // the last of each kind drawn: { wing, float, rotor } (the slots)
    this.book = this.loadBook();
    if (this.book.last && PEN_PARTS.includes(this.book.last)) this.type = this.book.last;
    // the ink flying to its place: { v, from (px lines), to (the car's frame), side, c, t0, part }
    this.flights = [];
    // a part's lines drawn in at its place, glowing: { v, lines (the car's frame), c, t0 }
    this.boils = [];
    // what the drawing makes now, read as it is drawn
    this.live = null;
    this.liveAt = 0;
    this.liveTip = null;
    this.uiSig = '';
    this.slotSig = '';
    // (the kinds whose use was told this time)
    this.told = new Set();
    this.ui();
    if (typeof window !== 'undefined') {
      // (on a computer, at the wheel: 1-3 the kept parts on or off - not the weapons)
      window.addEventListener('keydown', (e) => {
        if (e.repeat || !this.slotsShown) return;
        const m = /^(Digit|Numpad)([1-3])$/.exec(e.code);
        if (!m) return;
        this.game.input.pressed.delete(e.code);
        this.toggle(PEN_PARTS[+m[2] - 1]);
      });
    }
  }

  // the part pen, or the pen as it was in 11.22 (?draw=old, or the settings): reading what is drawn
  active() {
    const g = this.game;
    if (g.params && g.params.get('draw') === 'old') return false;
    return !g.settings || g.settings.get('carPen') !== 'old';
  }

  // ------------------------------------------------------------------ the pen out, and away
  // (game/freedraw.js show) the row out; the part the world asks for (the mission's hint), or as before
  open(type = null) {
    this.isOpen = true;
    const H = this.game.mission && this.game.mission.hint;
    if (type) this.type = type;
    else if (H && PEN_PARTS.includes(H.type) && !this.book[H.type]) this.type = H.type;
    this.live = null;
    this.showRow();
    this.showLive();
  }

  close() {
    this.isOpen = false;
    this.live = null;
    this.showRow();
    this.showLive();
  }

  // the part to draw: tapped, or 1-3. The drawing still wet is that one now
  pick(type) {
    if (!PEN_PARTS.includes(type)) return;
    const changed = type !== this.type;
    this.type = type;
    this.book.last = type;
    this.saveBook();
    this.game.audio.play('click', 0.4);
    const fd = this.game.freedraw;
    if (fd && fd.group.length) {
      // (more time to see what it makes now)
      fd.groupAt = performance.now() + (this.game.touch ? PEN_REST_TOUCH : PEN_REST);
      if (changed) this.feel(fd.group.map((s) => s.P), null, true);
    }
    this.showRow();
  }

  // ------------------------------------------------------------------ the drawing, read
  // the car you drive on the screen now: { v, t, F, ctx, mass } or null
  own() {
    const g = this.game;
    const v = g.player.inVehicle;
    if (!v || v.dead || typeof window === 'undefined') return null;
    const t = this.fz.vehTarget(v);
    const F = this.fz.frameOf(t);
    if (!F) return null;
    return { v, t, F, ctx: this.fz.drawCtx(v), mass: this.fz.vehMass(v) };
  }

  // the drawing (lines of screen px) as the part chosen: { r (the part, game/fusedraw.js), uv, M }
  read(strokes, o, type = this.type) {
    const lines = strokes.filter((L) => L && L.length >= 2);
    if (!lines.length) return null;
    const M = mountOf(type, o.ctx);
    const uv = toPlane(type, lines, o.F, M);
    let r = null;
    try {
      r = partOf(type, uv, o.ctx, M.A, M.face, M.plane);
    } catch (err) {
      r = null;
    }
    return r ? { r, uv, M } : null;
  }

  // (game/freedraw.js, as it is drawn) the drawing so far: what it makes, by the pen (tip: screen px,
  // null - over the drawing)
  feel(strokes, tip, now = false) {
    const t = performance.now();
    if (tip) this.liveTip = tip;
    else this.liveTip = null;
    if (!now && t - this.liveAt < LIVE_MS) {
      this.place(strokes);
      return;
    }
    this.liveAt = t;
    const o = this.own();
    const R = o && strokes.length ? this.read(strokes, o) : null;
    this.live = R ? { type: this.type, ...statOf(this.type, R.r.n, o.mass) } : null;
    this.showLive(strokes);
  }

  // ------------------------------------------------------------------ made
  // (game/freedraw.js finishGroup) the drawing done: the part made of it, on the car - the ink flies there
  // first. strokes: lines of screen px, inkI its ink. true if it went on
  make(strokes, inkI = 1) {
    const g = this.game;
    const fz = this.fz;
    this.live = null;
    this.showLive();
    const o = this.own();
    if (!o || !strokes.length) return false;
    const R = this.read(strokes, o);
    if (!R) return false;
    const r = R.r;
    const v = o.v;
    const part = { type: r.type, v: r.v, n: r.n, at: r.at, dir: r.dir, shape: r.shape, face: r.face, ink: inkI, t0: g.time, cost: 0, id: Math.random().toString(36).slice(2, 8) };
    fz.justAdded = part;
    fz.popDelay = FLY_MS;
    const res = fz.onVehicle(v, part);
    fz.justAdded = null;
    fz.popDelay = 0;
    if (!res) return false;
    fz.stats.made++;
    fz.stats.byType[r.type] = (fz.stats.byType[r.type] || 0) + 1;
    fz.stats.onto.veh = (fz.stats.onto.veh || 0) + 1;
    fz.last = { kind: 'veh', ref: v, part, t: g.time, rt: performance.now(), alts: [], M: null };
    this.fly(v, strokes, R, inkI, part);
    this.keep(part, v, strokes);
    g.audio.play('magic', 0.4);
    // (what it does and how - once of each: no tag by the car to draw over by mistake)
    const key = `${part.type}:${res.name || ''}`;
    if (!this.told.has(key)) {
      this.told.add(key);
      const say = [res.rule, res.use].filter(Boolean).join(' · ');
      if (say) g.hud.toast(`${NAME[part.type]}: ${say}`, 'info', 3.4);
    }
    return true;
  }

  // the ink from the screen to its place on the car: each point to where it is on the part's plane, on
  // the side of the car nearer the drawing
  fly(v, strokes, R, inkI, part) {
    const pl = R.M.plane;
    const to = R.uv.map((L) => L.map((q) => toXYZ(q, pl.ax, pl.c)));
    let side = 1;
    if (R.M.mirror) {
      let sx = 0;
      let sy = 0;
      let n = 0;
      let X = 0;
      let Y = 0;
      let Z = 0;
      for (let i = 0; i < strokes.length; i++) {
        for (let j = 0; j < strokes[i].length; j++) {
          sx += strokes[i][j][0];
          sy += strokes[i][j][1];
          X += to[i][j][0];
          Y += to[i][j][1];
          Z += to[i][j][2];
          n++;
        }
      }
      const a = this.proj(v, X / n, Y / n, Z / n);
      const b = this.proj(v, -X / n, Y / n, Z / n);
      if (a && b && Math.hypot(b.x - sx / n, b.y - sy / n) < Math.hypot(a.x - sx / n, a.y - sy / n)) side = -1;
    }
    const from = strokes.map((L) => L.map((q) => q.slice()));
    const t0 = performance.now();
    this.flights.push({ v, from, to, side, c: inkI, t0, part, a: 1 });
    // (a pair - wings, floats: the other one too, the ink a little fainter)
    if (R.M.mirror) this.flights.push({ v, from, to, side: -side, c: inkI, t0, part: null, a: 0.55 });
  }

  // a point in a car's frame (x to its left, z to its nose), on the screen - { x, y } or null
  proj(v, x, y, z) {
    const c = Math.cos(v.yaw);
    const s = Math.sin(v.yaw);
    const y0 = (v.pos.y || 0) + ((v.fz && v.fz.lift) || 0) + (v.fzDip || 0);
    const q = this.fz.screen(v.pos.x + x * c + z * s, y0 + y, v.pos.z - x * s + z * c);
    return q.front ? q : null;
  }

  // landed: the ink glows into the part as it grows, with its own sound - the car takes its weight
  landed(v, part, c) {
    const g = this.game;
    this.boil(v, part, c);
    g.audio.play(SND[part.type] || 'glue', 0.55);
    try {
      if (g.touch && navigator.vibrate) navigator.vibrate([14, 40, 24]);
    } catch (err) {
      // (no buzz: no matter)
    }
    v.fzDipT = performance.now();
  }

  // a part's own lines, glowing at its place a moment (its other half too)
  boil(v, part, c) {
    const sh = part.shape;
    if (!sh) return;
    const lines = [];
    for (const L of sh.lines || []) {
      const P = L.map((q) => toXYZ(q, sh.ax, sh.c));
      lines.push(P);
      if (sh.mirror) lines.push(P.map((X) => [-X[0], X[1], X[2]]));
    }
    if (lines.length) this.boils.push({ v, lines, c: (INKS[c] || INKS[1]).c, t0: performance.now() });
  }

  // ------------------------------------------------------------------ the slots
  // (a slot, 1-3) the kept part of that kind on the car you drive - or off it, if it is on. Nothing
  // kept of it: the pen, to draw one
  toggle(type) {
    const g = this.game;
    const fz = this.fz;
    const v = g.player.inVehicle;
    if (!v || v.dead || v.kind !== 'car') return false;
    const on = v.fuse && v.fuse.parts.find((p) => p.type === type);
    if (on) {
      fz.removeVeh(v, on, true);
      if (fz.last && fz.last.part === on) fz.last = null;
      const [ax, ay, az] = on.at || [0, 1, 0];
      const c = Math.cos(v.yaw);
      const s = Math.sin(v.yaw);
      g.fx.crumbs(v.pos.x + ax * c + az * s, (v.pos.y || 0) + ay, v.pos.z - ax * s + az * c, 10, 1.8);
      g.audio.play('rubber', 0.45);
      this.slotSig = '';
      return true;
    }
    const it = this.book[type];
    if (!it) {
      if (g.freedraw && !g.freedraw.isOpen) {
        this.type = type;
        g.freedraw.show();
      }
      return false;
    }
    const part = fitPart(it, fz.drawCtx(v).D);
    part.t0 = g.time;
    part.cost = 0;
    part.id = Math.random().toString(36).slice(2, 8);
    fz.justAdded = part;
    fz.popDelay = 120;
    const res = fz.onVehicle(v, part);
    fz.justAdded = null;
    fz.popDelay = 0;
    if (!res) return false;
    this.landed(v, part, part.ink);
    fz.last = { kind: 'veh', ref: v, part, t: g.time, rt: performance.now(), alts: [], M: null };
    this.slotSig = '';
    return true;
  }

  // ------------------------------------------------------------------ the sketchbook
  loadBook() {
    try {
      const o = JSON.parse(localStorage.getItem(BOOK_KEY) || 'null');
      if (o && typeof o === 'object') return { wing: o.wing || null, float: o.float || null, rotor: o.rotor || null, last: o.last || null };
    } catch (err) {
      // (none kept)
    }
    return { wing: null, float: null, rotor: null, last: null };
  }

  saveBook() {
    try {
      localStorage.setItem(BOOK_KEY, JSON.stringify(this.book));
    } catch (err) {
      // (not kept: no matter)
    }
  }

  // the part just drawn, kept - and its look as drawn, small (its slot's picture)
  keep(part, v, strokes) {
    const D = this.fz.drawCtx(v).D;
    this.book[part.type] = { type: part.type, v: part.v, n: part.n, at: part.at, dir: part.dir, face: part.face, ink: part.ink, shape: part.shape, D: { hl: D.hl, hw: D.hw, h: D.h }, pic: picOf(strokes) };
    this.book.last = part.type;
    this.saveBook();
    this.slotSig = '';
  }

  // ------------------------------------------------------------------ each frame
  update(rdt) {
    const g = this.game;
    const now = performance.now();
    // (the ink in flight, over everything)
    if (this.flights.length || this.flyDrawn) this.drawFlights(now);
    // (the car taking a new part's weight: down a little on its springs, and back)
    const v = g.player.inVehicle;
    if (v && v.fzDipT) {
      const t = (now - v.fzDipT) / 1000;
      if (t > 1.3) {
        v.fzDipT = 0;
        v.fzDip = 0;
      } else v.fzDip = t < 0 ? 0 : -0.09 * Math.exp(-4.2 * t) * Math.cos(t * 15);
    }
    const fd = g.freedraw;
    if (this.isOpen && !(fd && fd.isOpen && fd.carOpen)) this.close();
    if (this.isOpen) {
      // (the drawing waiting to go: the bar under its number runs down)
      if (this.liveEl && this.live && fd && fd.group.length && !fd.cur) {
        const len = g.touch ? PEN_REST_TOUCH : PEN_REST;
        const k = clamp((fd.groupAt - now) / len, 0, 1);
        this.dryEl.style.transform = `scaleX(${k.toFixed(3)})`;
      } else if (this.dryEl) this.dryEl.style.transform = 'scaleX(1)';
      this.showRow();
    }
    this.showSlots();
  }

  drawFlights(now) {
    const cv = this.flyCv;
    if (!cv) return;
    const g = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(window.innerWidth * dpr);
    const H = Math.round(window.innerHeight * dpr);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    this.flyDrawn = false;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      const k = clamp((now - f.t0) / FLY_MS, 0, 1);
      if (k >= 1 || f.v.dead) {
        this.flights.splice(i, 1);
        if (!f.v.dead && f.part) this.landed(f.v, f.part, f.c);
        continue;
      }
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const ink = INKS[f.c] || INKS[1];
      for (let a = 0; a < f.from.length; a++) {
        const A = f.from[a];
        const B = f.to[a];
        g.beginPath();
        for (let j = 0; j < A.length; j++) {
          const q = this.proj(f.v, B[j][0] * f.side, B[j][1], B[j][2]);
          const x = q ? A[j][0] + (q.x - A[j][0]) * e : A[j][0];
          const y = q ? A[j][1] + (q.y - A[j][1]) * e : A[j][1];
          if (j) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        const w = 4 * (1 - 0.35 * e);
        g.globalAlpha = (k > 0.85 ? (1 - k) / 0.15 : 1) * (f.a ?? 1);
        g.strokeStyle = ink.css === '#f4efe4' ? 'rgba(40, 36, 48, 0.75)' : 'rgba(255, 252, 244, 0.85)';
        g.lineWidth = w + 3.4;
        g.stroke();
        g.strokeStyle = ink.css;
        g.lineWidth = w;
        g.stroke();
      }
      g.globalAlpha = 1;
      this.flyDrawn = true;
    }
  }

  // ------------------------------------------------------------------ drawn in the world
  // its place on the car lit while the pen draws it; a part's lines glowing in as it comes
  draw(fr) {
    const g = this.game;
    const now = performance.now();
    for (let i = this.boils.length - 1; i >= 0; i--) {
      const b = this.boils[i];
      const k = (now - b.t0) / BOIL_MS;
      if (k >= 1 || b.v.dead) {
        this.boils.splice(i, 1);
        continue;
      }
      const f = frameOf(b.v);
      const e = Math.sin(Math.PI * Math.min(1, k * 1.3));
      const c = mix(b.c, GLOW_C, Math.min(1, k * 2));
      const seed = 9100 + Math.floor(now / 40) * 7;
      for (let n = 0; n < b.lines.length; n++) runIn(fr, f, b.lines[n], c, 7 + e * 8, seed + n * 13, 1 - k * k, 0.03 * (1 - k));
    }
    if (!this.isOpen) return;
    const v = g.player.inVehicle;
    if (!v || v.dead) return;
    const f = frameOf(v);
    const fd = g.freedraw;
    const wet = !!(fd && (fd.cur || fd.group.length));
    const a = (wet ? 0.85 : 0.7) + 0.15 * Math.sin(now / 170);
    const w = 1 + 0.18 * Math.sin(now / 170);
    for (const [n, L] of mountLines(this.type, this.fz.drawCtx(v)).entries()) {
      runIn(fr, f, L, HALO_C, 16 * w, 9600 + n * 7, a * 0.8, 0);
      runIn(fr, f, L, MOUNT_C, 9 * w, 9600 + n * 7, a, 0);
    }
  }

  // ------------------------------------------------------------------ the page's own bits
  ui() {
    if (typeof document === 'undefined' || !document.body) return;
    const touch = !!this.game.touch;
    const row = document.createElement('div');
    row.className = 'pp-row';
    row.id = 'pp-row';
    row.innerHTML = `${PEN_PARTS.map((t, i) => `<button class="pp-part" data-t="${t}" aria-label="${NAME[t]}">${ICON[t]}<b>${NAME[t]}</b>${touch ? '' : `<kbd>${i + 1}</kbd>`}</button>`).join('')}<button class="pp-ok" data-ok="1" aria-label="שימו על המכונית">✓</button>`;
    const act = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      if (b.dataset.ok) {
        const fd = this.game.freedraw;
        if (fd && fd.group.length && !fd.cur) fd.finishGroup();
      } else if (b.dataset.t) this.pick(b.dataset.t);
    };
    row.addEventListener('pointerdown', act);
    for (const ev of ['mousedown', 'click', 'touchstart', 'contextmenu']) row.addEventListener(ev, (e) => e.stopPropagation());
    document.body.appendChild(row);
    const live = document.createElement('div');
    live.className = 'pp-live';
    live.id = 'pp-live';
    live.innerHTML = '<b></b><span></span><i></i>';
    document.body.appendChild(live);
    const slots = document.createElement('div');
    slots.className = 'pp-slots';
    slots.id = 'pp-slots';
    slots.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button[data-t]');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      this.toggle(b.dataset.t);
    });
    for (const ev of ['mousedown', 'click', 'touchstart', 'contextmenu']) slots.addEventListener(ev, (e) => e.stopPropagation());
    document.body.appendChild(slots);
    const cv = document.createElement('canvas');
    cv.className = 'pp-fly';
    cv.id = 'pp-fly';
    document.body.appendChild(cv);
    this.rowEl = row;
    this.liveEl = live;
    this.liveName = live.querySelector('b');
    this.liveText = live.querySelector('span');
    this.dryEl = live.querySelector('i');
    this.slotsEl = slots;
    this.flyCv = cv;
  }

  showRow() {
    const el = this.rowEl;
    if (!el) return;
    const fd = this.game.freedraw;
    const H = this.game.mission && this.game.mission.hint;
    const wet = !!(fd && fd.group.length);
    const sig = `${this.isOpen}|${this.type}|${wet}|${H ? H.type : ''}`;
    if (sig === this.uiSig) return;
    this.uiSig = sig;
    el.classList.toggle('on', this.isOpen);
    el.classList.toggle('wet', wet);
    for (const b of el.querySelectorAll('.pp-part')) {
      b.classList.toggle('on', b.dataset.t === this.type);
      b.classList.toggle('hint', !!H && b.dataset.t === H.type && b.dataset.t !== this.type);
    }
  }

  // its name and its number by the pen - or over the drawing, the pen up
  showLive(strokes) {
    const el = this.liveEl;
    if (!el) return;
    const L = this.live;
    if (!L || !this.isOpen) {
      el.classList.remove('on');
      return;
    }
    this.liveName.textContent = NAME[L.type];
    this.liveText.textContent = L.text;
    this.liveText.classList.toggle('bad', !L.ok);
    el.classList.add('on');
    this.place(strokes);
  }

  place(strokes) {
    const el = this.liveEl;
    if (!el || !this.live) return;
    let x;
    let y;
    if (this.liveTip) {
      [x, y] = this.liveTip;
      y -= this.game.touch ? 84 : 58;
    } else if (strokes && strokes.length) {
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      for (const L of strokes) {
        for (const q of L) {
          x0 = Math.min(x0, q[0]);
          x1 = Math.max(x1, q[0]);
          y0 = Math.min(y0, q[1]);
        }
      }
      x = (x0 + x1) / 2;
      y = y0 - 52;
    } else return;
    const w = el.offsetWidth || 140;
    el.style.left = `${clamp(x - w / 2, 8, window.innerWidth - w - 8)}px`;
    el.style.top = `${clamp(y, 8, window.innerHeight - 60)}px`;
  }

  // the three kept parts by the steering: at the wheel of a car, the pen away
  showSlots() {
    const el = this.slotsEl;
    if (!el) return;
    const g = this.game;
    const p = g.player;
    const v = p.inVehicle;
    const fd = g.freedraw;
    const shown = this.active() && !!v && !v.dead && v.kind === 'car' && p.mode === 'vehicle' && g.state === 'play' && !(fd && fd.isOpen) && !(g.dialog && g.dialog.open);
    this.slotsShown = shown;
    const H = g.mission && g.mission.hint;
    const on = shown && v.fuse ? PEN_PARTS.map((t) => (v.fuse.parts.some((q) => q.type === t) ? 1 : 0)).join('') : '';
    const sig = `${shown}|${on}|${H ? H.type : ''}|${PEN_PARTS.map((t) => (this.book[t] ? 1 : 0)).join('')}`;
    if (sig === this.slotSig) return;
    this.slotSig = sig;
    el.classList.toggle('on', shown);
    if (!shown) return;
    const touch = !!g.touch;
    el.innerHTML = PEN_PARTS.map((t, i) => {
      const it = this.book[t];
      const cls = ['pp-slot', it ? '' : 'empty', on[i] === '1' ? 'on' : '', H && H.type === t && on[i] !== '1' ? 'hint' : ''].filter(Boolean).join(' ');
      return `<button class="${cls}" data-t="${t}" aria-label="${NAME[t]}" title="${NAME[t]}${touch ? '' : ` (${i + 1})`}">${it && it.pic ? picSvg(it.pic, it.ink) : ICON[t]}${touch ? '' : `<kbd>${i + 1}</kbd>`}</button>`;
    }).join('');
  }
}

// ------------------------------------------------------------------ helpers
// a car of yours: from its frame to the world (x to its left, z to its nose)
function frameOf(v) {
  const c = Math.cos(v.yaw);
  const s = Math.sin(v.yaw);
  const y0 = (v.pos.y || 0) + ((v.fz && v.fz.lift) || 0) + (v.fzDip || 0);
  return { c, s, x: v.pos.x, y: y0, z: v.pos.z };
}

// a line in a car's frame, inked (j: a shake to it - the ink boiling)
function runIn(fr, f, pts, col, w, seed, a, j) {
  let px = 0;
  let py = 0;
  let pz = 0;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i];
    let x = q[0];
    let y = q[1];
    let z = q[2];
    if (j) {
      x += (Math.random() - 0.5) * j;
      y += (Math.random() - 0.5) * j;
      z += (Math.random() - 0.5) * j;
    }
    const wx = f.x + x * f.c + z * f.s;
    const wy = f.y + y;
    const wz = f.z - x * f.s + z * f.c;
    if (i) fr.lineXYZ(px, py, pz, wx, wy, wz, col, w, seed + i, a, 0.004, 0);
    px = wx;
    py = wy;
    pz = wz;
  }
}

function mix(a, b, k) {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

// where the part goes, lit on the car while it is drawn: lines in its frame
function mountLines(type, ctx) {
  const D = ctx.D;
  const M = mountOf(type, ctx);
  const out = [];
  if (type === 'wing') {
    // (along each side at the doors' height, and out of it)
    const y = M.plane.c;
    for (const sd of [1, -1]) {
      const x = sd * (D.hw + 0.04);
      out.push([[x, y, -D.hl * 0.45], [x, y, D.hl * 0.35]]);
      for (const z of [-D.hl * 0.3, 0, D.hl * 0.25]) out.push([[x + sd * 0.25, y, z + 0.13], [x + sd * 0.48, y, z], [x + sd * 0.25, y, z - 0.13]]);
    }
  } else if (type === 'float') {
    // (a band along each sill)
    const y = M.A[1];
    for (const sd of [1, -1]) {
      const x = sd * M.plane.c;
      const z0 = -D.hl * 0.78;
      const z1 = D.hl * 0.78;
      out.push([[x, y + 0.13, z0], [x, y + 0.13, z1], [x, y - 0.13, z1], [x, y - 0.13, z0], [x, y + 0.13, z0]]);
    }
  } else {
    // (its mast on the middle of the roof, its hub over it)
    const y = M.plane.c;
    out.push([[0, M.A[1], 0], [0, y, 0]]);
    const ring = [];
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      ring.push([Math.cos(a) * 0.32, y, Math.sin(a) * 0.32]);
    }
    out.push(ring);
  }
  return out;
}

// a kept part sized to another car (it.D: the car it was drawn on)
function fitPart(it, D) {
  const part = JSON.parse(JSON.stringify({ type: it.type, v: it.v, n: it.n, at: it.at, dir: it.dir, face: it.face, ink: it.ink, shape: it.shape }));
  const S = it.D;
  if (!S || !part.shape) return part;
  const kx = D.hw / S.hw;
  const ky = D.h / S.h;
  const kz = D.hl / S.hl;
  if (Math.abs(kx - 1) < 0.03 && Math.abs(ky - 1) < 0.03 && Math.abs(kz - 1) < 0.03) return part;
  // (moved with the car's sides and roof - as big as it was drawn)
  const sh = part.shape;
  const dx = D.hw - S.hw;
  const dy = D.h - S.h;
  if (sh.ax === 'x') sh.c += Math.sign(sh.c || 1) * dx;
  else if (sh.ax === 'y') {
    sh.c += part.type === 'rotor' ? dy : dy * 0.5;
    // (a wing's lines are its left one's: x out to the left, w = -x)
    if (part.type === 'wing') for (const key of ['outlines', 'rods', 'lines']) if (Array.isArray(sh[key])) sh[key] = sh[key].map((L) => L.map(([u, w]) => [u, w - dx]));
  }
  if (part.at) part.at = [part.at[0] + Math.sign(part.at[0]) * dx, part.at[1] + (part.type === 'rotor' ? dy : dy * 0.5), part.at[2]];
  if (sh.mast) sh.mast = [sh.mast[0], sh.mast[1] + dy, sh.mast[2]];
  return part;
}

// the drawing as drawn, small: its lines in a 40×28 box
function picOf(strokes) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const L of strokes) {
    for (const [x, y] of L) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const s = Math.min(34 / Math.max(1, x1 - x0), 22 / Math.max(1, y1 - y0));
  const ox = (40 - (x1 - x0) * s) / 2;
  const oy = (28 - (y1 - y0) * s) / 2;
  return strokes.map((L) => {
    const step = Math.max(1, Math.floor(L.length / 40));
    const out = [];
    for (let i = 0; i < L.length; i += step) out.push([Math.round((ox + (L[i][0] - x0) * s) * 10) / 10, Math.round((oy + (L[i][1] - y0) * s) * 10) / 10]);
    const e = L[L.length - 1];
    out.push([Math.round((ox + (e[0] - x0) * s) * 10) / 10, Math.round((oy + (e[1] - y0) * s) * 10) / 10]);
    return out;
  });
}

function picSvg(pic, inkI) {
  const ink = INKS[inkI] || INKS[1];
  const col = ink.pencil || ink.css === '#f4efe4' ? '#2a2a33' : ink.css;
  const paths = pic.map((L) => `<polyline points="${L.map(([x, y]) => `${x},${y}`).join(' ')}"/>`).join('');
  return `<svg viewBox="0 0 40 28" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

