import { readSheet, onPlane, toUV, toXYZ, AX, trimPart, DRAWN } from './fusedraw.js';
import { INKS } from './freeform.js';
import { clamp, damp } from '../core/util.js';

// (ROADMAP 11.23) The sheet: drawing on the car you drive, in the world itself.
//
// Where the pen goes down on it, a clear sheet stands out of that side of it - flat out of its side
// (wings), upright along it over its roof (a rotor, a balloon, a parachute), out of its tail (a
// flame), out of its nose (a ram, a cannon), upright by a wheel (a wheel, floats) - and the line goes
// onto that sheet as it is drawn: in the world, on the car, going where it goes. What it is turning
// into shows as it is drawn - its name and its number, its other half, the rotor's sweep - and the pen
// at rest, the ink boils into the thing itself. On the move the city slows down for a few seconds of
// drawing (the meter on the ▶); standing still it all but stops, and the camera goes round the car.
// Whatever is made goes into the sketchbook, a tap to put on again; the eraser takes off as much of a
// part as it rubs - half a wing rubbed out, half the glide gone. Nothing costs ink.

// the city's pace with the pen out, standing still (on the move: game/fuse.js SLOW)
export const CALM = 0.03;
// seconds of slow time to draw in on the move, and to fill up again after
const FOCUS_S = 7;
const REFILL_S = 10;
// how often the drawing is read as it is drawn (ms)
const LIVE_MS = 130;
// the ink boiling into the thing (ms), the thing growing a moment after
const BOIL_MS = 460;
export const POP_DELAY = 170;
const BOOK_KEY = 'scribble-city-v5-sketchbook';
const BOOK_MAX = 8;
// (strong enough to read on sand, on the sea, at night: a pale halo under a deep line)
const SHEET_C = [0.16, 0.52, 1];
const GHOST_C = [0.12, 0.4, 0.95];
const HINT_C = [0.1, 0.32, 0.95];
const HALO_C = [1, 1, 0.97];
const GLOW_C = [1, 0.97, 0.78];

// what each part sounds like as it comes (core/audio.js)
const SND = {
  wing: 'flap', float: 'bounce', rotor: 'whoosh', balloon: 'squeak', chute: 'chute', jet: 'roar', barrel: 'clank', spring: 'bounce',
  blade: 'slash', wheel: 'clank', magnet: 'clang', star: 'magic', bolt: 'laser', smoke: 'poof', deco3: 'glue',
};

const fmt = (x) => (Math.round(x * 10) / 10).toString();
const r3 = (q) => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000, Math.round(q[2] * 1000) / 1000];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// floats: how much of the car they hold up (1: all of it) - long and thick enough for its weight
export function floatK(n, mass) {
  return (clamp(n.len || 3.6, 1, 6) * clamp(n.w || 0.45, 0.2, 0.8) * 0.85) / (mass || 1.25);
}

// glide of wings of that size (game/fuse.js applyVeh)
export function wingGlide(n) {
  const area = clamp((n.span || 1) * (n.chord || 0.5), 0.2, 6);
  return clamp(0.32 + area * 0.16, 0.35, 0.86);
}

// the number a drawing's part shows while it is drawn: what its shape makes of it (mass: the car's)
export function statOf(r, mass = 1.25) {
  const n = r.n || {};
  const pct = (k) => `${Math.round(Math.min(k, 3) * 100)}%`;
  switch (r.type) {
    case 'wing':
      return r.v === 'spoiler' ? 'אחיזה בפניות' : `גלישה ×${fmt(1 / (1 - wingGlide(n)))}`;
    case 'rotor': {
      const k = (clamp(n.span || 2, 0.6, 9) ** 2 * 0.42) / mass;
      return k >= 1 ? `הרמה ${pct(k)} ✓` : `הרמה ${pct(k)} · גדול יותר`;
    }
    case 'balloon': {
      const k = (clamp(n.d || 1.5, 0.5, 6) ** 3 * 0.32) / mass;
      return k >= 1 ? `הרמה ${pct(k)} ✓` : `הרמה ${pct(k)} · גדול יותר`;
    }
    case 'float': {
      const k = floatK(n, mass);
      return k >= 1 ? `ציפה ${pct(k)} ✓` : `ציפה ${pct(k)} · ארוך ועבה יותר`;
    }
    case 'jet':
      return r.v === 'front' ? 'אש קדימה' : `דחף +${Math.round(clamp(6 + (n.len || 1) * 4, 7, 16))}`;
    case 'spring': {
      const j = clamp(6 + (n.coils || 3) * 0.85 + (n.len || 0.6) * 1.6, 7, 16);
      return `קפיצה ${fmt((j * j) / 40)} מ׳`;
    }
    case 'barrel':
      return `קנה ${fmt(n.len || 1)} מ׳`;
    case 'wheel':
      return { round: 'מהירות +18%', small: 'זינוק חזק', teeth: 'מטפס על מדרגות', big: 'עולה על הכול', bigteeth: 'עולה על הכול', square: 'מקרטע' }[r.v] || '';
    case 'chute':
      return 'נפילה איטית';
    case 'blade':
      return 'מעיף מהדרך';
    case 'magnet':
      return 'מושך מכוניות';
    case 'smoke':
      return 'מסך עשן';
    case 'deco3': {
      const a = n.area || 0;
      const kg = Math.round(Math.max(0.1, a) * 40);
      return r.shape && r.shape.ax === 'y' && a >= 0.4 ? `גלישה קלה · +${kg} ק״ג` : `+${kg} ק״ג`;
    }
    default:
      return '';
  }
}

export class Sheets {
  constructor(fz) {
    this.fz = fz;
    this.game = fz.game;
    // the drawing on the sheet: { v, sheet, lines: [{ w, show, paint, s, c }], cur, t0 }
    this.wet = null;
    // standing still (the city all but stops, the camera goes round) or on the move (a few slow seconds)
    this.calm = false;
    this.focus = 1;
    // the camera round the car while drawing: turned, up, closer or further; its first look round
    this.orb = { yaw: 0, yawT: 0, pitch: 0, pitchT: 0, zoom: 1, swingT: 0 };
    // what the drawing reads as now, and its ghost (its other half, its sweep)
    this.live = null;
    this.liveAt = 0;
    this.ghost = null;
    // ink boiling into the thing: { v, lines, c, t0 }
    this.boils = [];
    // dashed, on the car: what the world asks for ({ v, type })
    this.hint = null;
    this.rub = null;
    this.book = this.loadBook();
    this.el = null;
    this.liveEl = null;
    this.uiOn = false;
  }

  // ------------------------------------------------------------------ where
  // the car you drive, its frame on the screen now - { v, t, F } or null
  own() {
    const g = this.game;
    const v = g.player.inVehicle;
    if (!v || v.dead || typeof window === 'undefined') return null;
    const t = this.fz.vehTarget(v);
    const F = this.fz.frameOf(t);
    return F ? { v, t, F } : null;
  }

  // the sheet where the pen went down (screen px) on the car you drive: { face, ax, c, side, anchor,
  // rect (its corners in the car's frame), box } - null if it went down well away from it (a line for
  // something else: game/fuse.js match)
  sheetAt(o, sx, sy) {
    const F = o.F;
    const bx = F.box;
    if (sx < bx.x0 - bx.w * 0.9 || sx > bx.x1 + bx.w * 0.9 || sy < bx.y0 - bx.h * 1.7 || sy > bx.y1 + bx.h * 0.9) return null;
    const D = F.D;
    const ctx = this.fz.drawCtx(o.v);
    const K = ctx.K;
    const roof = K ? K.roofY : D.h;
    const clear = K ? K.clear : 0.25;
    const r0 = ctx.r0 || 0.34;
    const r = F.local(sx, sy);
    let p = null;
    let n = null;
    const k = F.skinAt ? F.skinAt(sx, sy) : null;
    if (k) {
      p = k.p;
      n = k.n;
    } else if (r.hit && r.face) {
      p = r.p;
      n = [0, 0, 0];
      n[r.face[0]] = r.face[1];
    }
    let face;
    if (n) {
      // (its side: by its flank and turned out that way - the shoulder of a door too, rounded up)
      if (Math.abs(p[0]) > D.hw * 0.72 && Math.abs(n[0]) > 0.22 && n[1] < 0.92 && Math.abs(p[2]) < D.hl * 0.92) face = 'side';
      else if (n[1] > 0.55) face = 'top';
      else if (Math.abs(n[0]) >= Math.abs(n[2]) * 0.8) face = 'side';
      else face = n[2] < 0 ? 'back' : 'front';
    } else {
      // (off it: the side of it the pen is by)
      p = r.p;
      const ex = Math.abs(p[0]) - D.hw;
      const ez = Math.abs(p[2]) - D.hl;
      const ey = p[1] - roof;
      if (ey > 0.1 && ey >= ex && ey >= ez) face = 'top';
      else if (ez > ex) face = p[2] < 0 ? 'back' : 'front';
      else face = 'side';
    }
    const sd = Math.sign(p[0]) || this.fz.skSide || 1;
    const { hw, hl } = D;
    // (by a wheel, low on its side: upright, the wheel's own sheet)
    let wz = null;
    if (face === 'side' && p[1] < clear + r0 * 1.9) {
      for (const s of ctx.spots) {
        if (Math.sign(s.x) !== sd) continue;
        if (Math.hypot(p[2] - s.z, p[1] - r0) < r0 * 1.35) {
          face = 'wheel';
          wz = s.z;
          break;
        }
      }
    }
    let ax = 'x';
    let c = 0;
    let rect;
    let anchor;
    if (face === 'wheel') {
      c = sd * (hw + 0.04);
      rect = [[c, 0.02, wz - r0 * 2.6], [c, 0.02, wz + r0 * 2.6], [c, r0 * 4.4, wz + r0 * 2.6], [c, r0 * 4.4, wz - r0 * 2.6]];
      anchor = [sd * hw, r0, wz];
    } else if (face === 'side') {
      ax = 'y';
      c = clamp(p[1], clear + 0.08, roof - 0.12);
      const x0 = sd * hw;
      const x1 = sd * (hw + 2.6);
      rect = [[x0, c, -hl - 0.6], [x1, c, -hl - 0.6], [x1, c, hl + 0.6], [x0, c, hl + 0.6]];
      anchor = [sd * hw, c, clamp(p[2], -hl * 0.9, hl * 0.9)];
    } else if (face === 'top') {
      rect = [[0, roof, -hl - 0.3], [0, roof, hl + 0.3], [0, roof + 2.8, hl + 0.3], [0, roof + 2.8, -hl - 0.3]];
      anchor = [clamp(p[0], -hw * 0.6, hw * 0.6), roof, clamp(p[2], -hl * 0.6, hl * 0.6)];
    } else if (face === 'back') {
      rect = [[0, 0.05, -hl + 0.4], [0, 0.05, -hl - 2.8], [0, roof + 0.9, -hl - 2.8], [0, roof + 0.9, -hl + 0.4]];
      anchor = [clamp(p[0], -hw * 0.8, hw * 0.8), clamp(p[1], clear + 0.1, roof - 0.1), -hl];
    } else {
      rect = [[0, 0.05, hl - 0.4], [0, 0.05, hl + 2.4], [0, roof + 0.6, hl + 2.4], [0, roof + 0.6, hl - 0.4]];
      anchor = [clamp(p[0], -hw * 0.8, hw * 0.8), clamp(p[1], clear + 0.1, roof - 0.1), hl];
    }
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const q of rect) {
      for (let i = 0; i < 3; i++) {
        box[i] = Math.min(box[i], q[i]);
        box[i + 3] = Math.max(box[i + 3], q[i]);
      }
    }
    const sh = { face, ax, c, side: sd, anchor: r3(anchor), rect, box };
    this.faceTo(sh, F);
    return sh;
  }

  // where a point on the screen is on the sheet: { X (on it, the car's frame), show (where its ink
  // shows: on the paint, if it is drawn on the paint), paint } - null if its ray runs along it
  point(o, sh, sx, sy) {
    const F = o.F;
    const r = F.local(sx, sy);
    let X = onPlane(r, sh.ax, sh.c);
    if (!X) return null;
    // (not out past the sheet by much)
    const B = sh.box;
    const m = 1.4;
    X = [clamp(X[0], B[0] - m, B[3] + m), clamp(X[1], B[1] - m, B[4] + m), clamp(X[2], B[2] - m, B[5] + m)];
    let k = F.skinAt ? F.skinAt(sx, sy) : null;
    if (!k && !F.skinAt && r.hit && r.face) {
      const n = [0, 0, 0];
      n[r.face[0]] = r.face[1];
      k = { p: r.p, n };
    }
    let paint = false;
    let show = X;
    if (k) {
      const tk = (k.p[0] - r.o[0]) * r.d[0] + (k.p[1] - r.o[1]) * r.d[1] + (k.p[2] - r.o[2]) * r.d[2];
      const tp = (X[0] - r.o[0]) * r.d[0] + (X[1] - r.o[1]) * r.d[1] + (X[2] - r.o[2]) * r.d[2];
      if (tk < tp - 0.04) {
        paint = true;
        show = [k.p[0] + k.n[0] * 0.03, k.p[1] + k.n[1] * 0.03, k.p[2] + k.n[2] * 0.03];
      }
    }
    return { X: r3(X), show: r3(show), paint };
  }

  // standing still, a sheet seen side on: the camera goes round till it is seen
  faceTo(sh, F) {
    if (!this.calm) return;
    const n = AX[sh.ax].n;
    const vw = F.view;
    if (Math.abs(dot3(vw, n)) >= 0.3) return;
    if (sh.ax === 'y') {
      this.orb.pitchT = Math.min(3.5, this.orb.pitchT + 1.8);
      return;
    }
    for (let d = 0.1; d < 1.7; d += 0.1) {
      for (const s of [1, -1]) {
        const a = s * d;
        const x = vw[0] * Math.cos(a) + vw[2] * Math.sin(a);
        const z = -vw[0] * Math.sin(a) + vw[2] * Math.cos(a);
        if (Math.abs(x * n[0] + vw[1] * n[1] + z * n[2]) >= 0.45) {
          this.orb.yawT = this.orb.yaw + a;
          return;
        }
      }
    }
  }

  // ------------------------------------------------------------------ the line being drawn
  // the pen down (screen px) in the car you drive: on its sheet - a new one, the drawing new. false:
  // not by it
  begin(sx, sy, inkI) {
    const o = this.own();
    if (!o) return false;
    if (this.wet && this.wet.v !== o.v) this.wet = null;
    if (!this.wet) {
      const sh = this.sheetAt(o, sx, sy);
      if (!sh) return false;
      this.wet = { v: o.v, sheet: sh, lines: [], t0: performance.now(), cur: null };
      this.game.audio.play('swish', 0.22);
    }
    const L = { w: [], show: [], paint: [], s: [], c: inkI };
    this.wet.lines.push(L);
    this.wet.cur = L;
    this.add(o, sx, sy);
    this.liveAt = 0;
    return true;
  }

  move(sx, sy) {
    const W = this.wet;
    const L = W && W.cur;
    if (!L) return;
    const q = L.s[L.s.length - 1];
    if (q && Math.hypot(sx - q[0], sy - q[1]) < 3) return;
    const o = this.own();
    if (!o || o.v !== W.v) return;
    this.add(o, sx, sy);
  }

  add(o, sx, sy) {
    const W = this.wet;
    const L = W.cur;
    if (L.w.length >= 320) return;
    const q = this.point(o, W.sheet, sx, sy);
    if (!q) return;
    L.w.push(q.X);
    L.show.push(q.show);
    L.paint.push(q.paint);
    L.s.push([sx, sy]);
  }

  // the pen up: the line it drew (null: nothing to it)
  end() {
    const W = this.wet;
    const L = W && W.cur;
    if (!L) return null;
    W.cur = null;
    if (L.w.length < 2) {
      W.lines.pop();
      if (!W.lines.length) this.done();
      return null;
    }
    this.read();
    return L;
  }

  // the line being drawn, dropped (two fingers came down: the camera)
  cancel() {
    const W = this.wet;
    if (!W || !W.cur) return;
    W.lines.pop();
    W.cur = null;
    if (!W.lines.length) this.done();
    else this.read();
  }

  undoLine() {
    const W = this.wet;
    if (!W) return;
    W.lines.pop();
    if (!W.lines.length) this.done();
    else this.read();
  }

  // the drawing made (or given up): the sheet goes
  done() {
    this.wet = null;
    this.live = null;
    this.ghost = null;
    this.showLive();
  }

  // ------------------------------------------------------------------ what it is turning into
  read() {
    this.liveAt = performance.now();
    const W = this.wet;
    if (!W) return;
    const lines = W.lines.filter((L) => L.w.length >= 2);
    let n = 0;
    for (const L of lines) n += L.w.length;
    let r = null;
    if (n >= 5) {
      try {
        r = readSheet(lines.map((L) => ({ w: L.w, paint: L.paint })), this.fz.drawCtx(W.v), W.sheet);
      } catch (err) {
        r = null;
      }
    }
    this.live = r;
    this.ghost = r && r.kind === 'part' ? this.ghostOf(r, W.v) : null;
    this.showLive();
  }

  // the rest of what it is, faint: its other half (wings, floats), the rotor's sweep, the other wheels
  ghostOf(r, v) {
    const sh = r.shape;
    if (!sh) return null;
    const out = [];
    const P = (L) => L.map((q) => toXYZ(q, sh.ax, sh.c));
    if (sh.mirror) {
      for (const L of sh.outlines.length ? sh.outlines : sh.lines) out.push(P(L).map((X) => [-X[0], X[1], X[2]]));
    } else if (r.type === 'rotor' && sh.pivot) {
      const R = (r.n.span || 2) / 2;
      const C = toXYZ(sh.pivot, sh.ax, sh.c);
      const ring = [];
      for (let i = 0; i <= 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        ring.push([C[0] + Math.cos(a) * R, C[1], C[2] + Math.sin(a) * R]);
      }
      out.push(ring);
    } else if (r.type === 'wheel' && sh.wheel) {
      const ctx = this.fz.drawCtx(v);
      const r0 = ctx.r0 || 0.34;
      for (const s of ctx.spots) {
        if (Math.sign(s.x) === Math.sign(sh.c) && Math.abs(s.z - r.at[2]) < r0 * 1.6) continue;
        const x = Math.sign(s.x) * (ctx.D.hw + 0.04);
        out.push(sh.wheel.concat([sh.wheel[0]]).map(([u, w]) => [x, Math.max(0.02, r0 + w), s.z + u]));
      }
    }
    return out.length ? out : null;
  }

  // its name and its number, by the pen
  showLive() {
    const el = this.liveEl;
    if (!el) return;
    const W = this.wet;
    const r = this.live;
    if (!W || !r || !this.uiOn) {
      el.classList.remove('on');
      return;
    }
    let text;
    if (r.kind === 'ink') text = '<b>ציור על הצבע</b>';
    else {
      const v = W.v;
      const mass = (v.handling && v.handling.mass) || 1.25;
      const st = statOf(r, mass);
      const bad = st.includes('·') && (r.type === 'rotor' || r.type === 'balloon' || r.type === 'float');
      text = `<b>${r.name || DRAWN[r.type] || ''}</b>${st ? `<span class="${bad ? 'bad' : ''}">${st}</span>` : ''}`;
    }
    if (text !== this.liveText) {
      el.innerHTML = text;
      this.liveText = text;
    }
    // (by the pen, above it: the finger does not hide it)
    const L = W.cur || W.lines[W.lines.length - 1];
    const q = L && L.s.length ? L.s[L.s.length - 1] : null;
    if (q) {
      const w = el.offsetWidth || 120;
      el.style.left = `${clamp(q[0] - w / 2, 8, window.innerWidth - w - 8)}px`;
      el.style.top = `${clamp(q[1] - 74, 8, window.innerHeight - 40)}px`;
    }
    el.classList.add('on');
  }

  // ------------------------------------------------------------------ made
  // a part just made on your car (caps: the drawing's lines, if it was drawn just now): the ink
  // boils into it, it comes with its own sound, the car takes its weight - and it goes into the
  // sketchbook
  onMade(part, v, caps) {
    const g = this.game;
    const now = performance.now();
    if (caps) {
      const lines = caps.map((c) => c.show || c.w).filter((L) => L && L.length >= 2);
      if (lines.length) this.boils.push({ v, lines, c: (INKS[part.ink] || INKS[1]).c, t0: now });
    }
    g.audio.play(SND[part.type] || 'glue', 0.55);
    try {
      if (g.touch && navigator.vibrate) navigator.vibrate([14, 40, 24]);
    } catch (err) {
      // (no buzz: no matter)
    }
    v.fzDipT = now;
    const sd = part.at ? Math.sign(part.at[0]) : 0;
    if (!(part.shape && part.shape.mirror) && sd) v.rollV = (v.rollV || 0) - sd * 0.6;
    if (part.face === 'back' || part.face === 'front') v.pitchV = (v.pitchV || 0) + (part.face === 'back' ? 0.5 : -0.5);
    // (the first time: the camera goes round it a moment - a look at what was made)
    if (!this.book.swung) {
      this.book.swung = 1;
      this.orb.swingT = now + POP_DELAY;
      this.saveBook();
    }
    if (part.shape) this.keep(part, v);
  }

  // ------------------------------------------------------------------ the sketchbook
  loadBook() {
    try {
      const o = JSON.parse(localStorage.getItem(BOOK_KEY) || 'null');
      if (o && Array.isArray(o.items)) return { swung: 0, told: {}, ...o };
    } catch (err) {
      // (none kept)
    }
    return { items: [], swung: 0, told: {} };
  }

  saveBook() {
    try {
      localStorage.setItem(BOOK_KEY, JSON.stringify(this.book));
    } catch (err) {
      // (not kept: no matter)
    }
  }

  // a part kept (the same sort again, about as big: in its place)
  keep(part, v) {
    const D = this.fz.drawCtx(v).D;
    const it = { type: part.type, v: part.v, n: part.n, at: part.at, dir: part.dir, face: part.face, ink: part.ink, shape: part.shape, D: { hl: D.hl, hw: D.hw, h: D.h }, name: DRAWN[part.type] || '' };
    const items = this.book.items;
    const a = part.n ? part.n.area || 0 : 0;
    const same = items.findIndex((o) => o.type === it.type && o.face === it.face && Math.abs(((o.n && o.n.area) || 0) - a) <= Math.max(0.15, a * 0.3));
    if (same >= 0) items.splice(same, 1);
    items.unshift(it);
    while (items.length > BOOK_MAX) items.pop();
    this.saveBook();
    this.uiBook();
  }

  // one from the sketchbook, on the car you drive now (sized to it)
  deploy(i) {
    const g = this.game;
    const it = this.book.items[i];
    const v = g.player.inVehicle;
    if (!it || !v || v.dead || !this.fz.drawCtx) return false;
    const D = this.fz.drawCtx(v).D;
    const part = fitPart(it, D);
    part.t0 = g.time;
    part.cost = 0;
    part.id = Math.random().toString(36).slice(2, 8);
    this.fz.justAdded = part;
    this.fz.popDelay = 0;
    const res = this.fz.onVehicle(v, part);
    this.fz.justAdded = null;
    if (!res) return false;
    const t = this.fz.vehTarget(v);
    this.fz.last = { kind: 'veh', ref: v, part, t: g.time, rt: performance.now(), alts: [], M: { t } };
    const c = Math.cos(v.yaw);
    const sn = Math.sin(v.yaw);
    const [ax, ay, az] = part.at || [0, 1, 0];
    g.fx.sparks(v.pos.x + ax * c + az * sn, (v.pos.y || 0) + ay, v.pos.z - ax * sn + az * c, 10, (INKS[part.ink] || INKS[1]).c);
    g.audio.play('magic', 0.4);
    this.onMade(part, v, null);
    this.fz.tag({ ...res, drawn: true }, t, 0, [], part.ink, false);
    return true;
  }

  // ------------------------------------------------------------------ the camera round the car
  // where the camera goes (s: its spot in the car's frame, game/fuse.js sketchCam), turned round,
  // up, nearer or further
  spot(s) {
    const o = this.orb;
    let yaw = o.yaw;
    if (o.swingT) {
      const k = (performance.now() - o.swingT) / 1500;
      if (k >= 1) o.swingT = 0;
      else if (k > 0) yaw += 0.8 * Math.sin(Math.PI * k);
    }
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    const k = o.zoom;
    return [(s[0] * c + s[2] * sn) * k, s[1] * k + o.pitch, (-s[0] * sn + s[2] * c) * k];
  }

  orbit(dx, dy) {
    this.orb.yawT -= dx * 0.009;
    this.orb.pitchT = clamp(this.orb.pitchT - dy * 0.014, -1.6, 3.5);
  }

  zoom(k) {
    this.orb.zoom = clamp(this.orb.zoom * k, 0.62, 1.9);
  }

  // ------------------------------------------------------------------ the pen out, and away
  // the pen out in the car you drive: standing still or on the move
  open(v) {
    this.calm = Math.abs(v.speed || 0) < 2.5 && !v.air;
    this.focus = Math.max(this.focus, 0.3);
    const o = this.orb;
    o.yaw = o.yawT = 0;
    o.pitch = o.pitchT = 0;
    o.zoom = 1;
    this.done();
    this.ui(true);
    // (each way, the first time: what it is)
    const told = this.book.told || (this.book.told = {});
    const key = this.calm ? 'calm' : 'quick';
    if (!told[key]) {
      told[key] = 1;
      this.saveBook();
      const g = this.game;
      const turn = g.touch ? 'שתי אצבעות מסובבות את המצלמה' : 'גרירה בכפתור הימני מסובבת, הגלגלת מקרבת';
      g.hud.toast(this.calm ? `עומדים — הזמן כמעט עוצר · ${turn}` : 'בנסיעה — כמה שניות של זמן איטי (הפס על ▶) · ההגה עדיין בידיים', 'info', 3.6);
    }
  }

  close() {
    if (this.rub) this.rubEnd();
    this.done();
    this.ui(false);
  }

  // the real step: the slow seconds running down (on the move) or filling up again; the camera
  // going where it was turned; the drawing read every so often
  update(rdt) {
    const fd = this.game.freedraw;
    const open = !!(fd && fd.isOpen && fd.carOpen);
    if (open && !this.calm) this.focus = Math.max(0, this.focus - rdt / FOCUS_S);
    else if (!open) this.focus = Math.min(1, this.focus + rdt / REFILL_S);
    const o = this.orb;
    o.yaw = damp(o.yaw, o.yawT, 7, rdt);
    o.pitch = damp(o.pitch, o.pitchT, 7, rdt);
    if (this.wet && this.wet.cur && performance.now() - this.liveAt > LIVE_MS) this.read();
    else if (this.wet && this.live) this.showLive();
    // (the car taking a new part's weight: down a little on its springs, and back)
    const v = this.game.player.inVehicle;
    if (v && v.fzDipT) {
      const t = (performance.now() - v.fzDipT) / 1000;
      if (t > 1.3) {
        v.fzDipT = 0;
        v.fzDip = 0;
      } else v.fzDip = t < 0 ? 0 : -0.1 * Math.exp(-4.2 * t) * Math.cos(t * 15);
    }
  }

  // ------------------------------------------------------------------ the eraser
  rubStart(sx, sy) {
    this.rub = { hits: new Map(), decor: new Set(), reach: 0.15 };
    this.rubAt(sx, sy);
  }

  // the eraser at (sx, sy): what of each part's lines it is over (on the part's own plane - the
  // mirrored half of one rubs it too), and the ink under it
  rubAt(sx, sy) {
    const R = this.rub;
    const o = this.own();
    if (!R || !o) return;
    const v = o.v;
    const F = o.F;
    const r = F.local(sx, sy);
    const reach = clamp(F.perPx * 26, 0.14, 0.7);
    R.reach = Math.max(R.reach, reach);
    for (const p of (v.fuse && v.fuse.parts) || []) {
      const sh = p.shape;
      if (!sh) continue;
      const uvs = [];
      const X = onPlane(r, sh.ax, sh.c);
      if (X) uvs.push(toUV(X, sh.ax));
      if (sh.mirror) {
        if (sh.ax === 'x') {
          const Y = onPlane(r, 'x', -sh.c);
          if (Y) uvs.push(toUV(Y, 'x'));
        } else if (X) {
          const q = toUV(X, sh.ax);
          uvs.push(sh.ax === 'y' ? [q[0], -q[1]] : [-q[0], q[1]]);
        }
      }
      if (!uvs.length) continue;
      if (!R.hits.has(p)) R.hits.set(p, []);
      R.hits.get(p).push(...uvs);
    }
    // (the ink on it: a line the eraser goes over)
    const decor = (v.fuse && v.fuse.decor) || [];
    if (decor.length) {
      const c = Math.cos(v.yaw);
      const sn = Math.sin(v.yaw);
      const lift = (v.fz && v.fz.lift) || 0;
      for (const d of decor) {
        if (R.decor.has(d)) continue;
        for (const q of d.pts) {
          const s = this.fz.screen(v.pos.x + q[0] * c + q[2] * sn, (v.pos.y || 0) + lift + q[1], v.pos.z - q[0] * sn + q[2] * c);
          if (s.front && Math.hypot(s.x - sx, s.y - sy) < 26) {
            R.decor.add(d);
            break;
          }
        }
      }
    }
  }

  // the eraser lifted: each part it went over made again of what is left of it - or off
  rubEnd() {
    const R = this.rub;
    this.rub = null;
    const g = this.game;
    const v = g.player.inVehicle;
    if (!R || !v || !v.fuse) return false;
    const said = [];
    let changed = false;
    const ctx = this.fz.drawCtx(v);
    for (const [p, hits] of R.hits) {
      const i = v.fuse.parts.indexOf(p);
      if (i < 0) continue;
      let np = p;
      try {
        np = trimPart(p, ctx, hits, R.reach);
      } catch (err) {
        np = p;
      }
      if (np === p) continue;
      changed = true;
      const name = DRAWN[p.type] || '';
      if (!np) {
        v.fuse.parts.splice(i, 1);
        said.push(`${name} נמחק`);
      } else {
        v.fuse.parts[i] = np;
        const st = statOf(np, (v.handling && v.handling.mass) || 1.25);
        said.push(`${name} קטן${st ? ` — ${st}` : ''}`);
      }
      if (this.fz.last && this.fz.last.part === p) this.fz.last = null;
    }
    if (R.decor.size) {
      v.fuse.decor = (v.fuse.decor || []).filter((d) => !R.decor.has(d));
      changed = true;
      if (!said.length) said.push('הקו נמחק');
    }
    if (!changed) return false;
    this.fz.applyVeh(v);
    this.fz.buildVeh(v);
    g.audio.play('rubber', 0.55);
    g.fx.crumbs(v.pos.x, (v.pos.y || 0) + 1, v.pos.z, 10, 1.6);
    this.fz.say(said.join(' · '), 'info');
    return true;
  }

  // ------------------------------------------------------------------ drawn in the world
  draw(fr) {
    const g = this.game;
    const now = performance.now();
    const t = g.time;
    // the ink boiling into what it made (over it as it grows)
    for (let i = this.boils.length - 1; i >= 0; i--) {
      const b = this.boils[i];
      const k = (now - b.t0) / BOIL_MS;
      if (k >= 1 || b.v.dead) {
        this.boils.splice(i, 1);
        continue;
      }
      const W = frameOf(b.v);
      const e = Math.sin(Math.PI * Math.min(1, k * 1.3));
      const c = mix(b.c, GLOW_C, Math.min(1, k * 2));
      const j = 0.035 * (1 - k);
      const seed = 9100 + Math.floor(now / 40) * 7;
      for (let n = 0; n < b.lines.length; n++) runIn(fr, W, b.lines[n], c, 8 + e * 9, seed + n * 13, 1 - k * k, j);
    }
    const v = g.player.inVehicle;
    if (!v || v.dead) return;
    const W = this.wet;
    if (W && W.v === v) {
      const f = frameOf(v);
      const sh = W.sheet;
      // (the sheet: out from where the pen went down, in a blink)
      const k = clamp((now - W.t0) / 170, 0, 1);
      const e = 1 - (1 - k) * (1 - k);
      const A = sh.anchor;
      const C = sh.rect.map((q) => [A[0] + (q[0] - A[0]) * e, A[1] + (q[1] - A[1]) * e, A[2] + (q[2] - A[2]) * e]);
      runIn(fr, f, C.concat([C[0]]), HALO_C, 9, 9300, 0.55, 0);
      runIn(fr, f, C.concat([C[0]]), SHEET_C, 4.6, 9300, 0.95, 0);
      // (faint lines across it: a pane of glass)
      for (let i = 1; i <= 3; i++) {
        const a = i / 4;
        runIn(fr, f, [lerp3(C[0], C[1], a), lerp3(C[3], C[2], a)], SHEET_C, 2.2, 9310 + i, 0.3, 0);
        runIn(fr, f, [lerp3(C[0], C[3], a), lerp3(C[1], C[2], a)], SHEET_C, 2.2, 9320 + i, 0.3, 0);
      }
      // (the lines on it, as drawn)
      for (let n = 0; n < W.lines.length; n++) {
        const L = W.lines[n];
        if (L.show.length < 2) continue;
        runIn(fr, f, L.show, HALO_C, 14, 9400 + n * 17, 0.65, 0);
        runIn(fr, f, L.show, (INKS[L.c] || INKS[1]).c, 8, 9400 + n * 17, 1, 0);
      }
      // (what it is turning into: the rest of it, dashed)
      if (this.ghost) for (let n = 0; n < this.ghost.length; n++) dashIn(fr, f, this.ghost[n], GHOST_C, 5.5, 9500 + n * 11, 0.9, t * 0.6);
    }
    // what the world asks for, dashed on the car (trace it)
    const H = this.hint;
    if (H && H.v === v) {
      const f = frameOf(v);
      const a = 0.55 + 0.35 * Math.sin(now / 160);
      for (const [n, L] of hintShapes(H.type, this.fz.drawCtx(v)).entries()) {
        dashIn(fr, f, L, HALO_C, 13, 9600 + n * 7, a * 0.7, now / 900);
        dashIn(fr, f, L, HINT_C, 7.5, 9600 + n * 7, a, now / 900);
      }
    }
  }

  // ------------------------------------------------------------------ the page's own bits
  ui(on) {
    if (typeof document === 'undefined') return;
    if (!this.el) {
      const el = document.createElement('div');
      el.className = 'fz-book';
      el.id = 'fz-book';
      el.addEventListener('pointerdown', (e) => {
        const b = e.target.closest('button[data-i]');
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        this.deploy(+b.dataset.i);
        const fd = this.game.freedraw;
        if (fd) fd.keepOut();
      });
      document.body.appendChild(el);
      const lv = document.createElement('div');
      lv.className = 'fz-live';
      lv.id = 'fz-live';
      document.body.appendChild(lv);
      this.el = el;
      this.liveEl = lv;
    }
    this.uiOn = on;
    this.uiBook();
    if (!on) this.liveEl.classList.remove('on');
  }

  uiBook() {
    const el = this.el;
    if (!el) return;
    const items = this.book.items;
    el.classList.toggle('on', !!(this.uiOn && items.length));
    if (!this.uiOn) return;
    el.innerHTML = `<span>המחברת שלי</span>${items.map((it, i) => `<button data-i="${i}" title="${it.name}">${thumb(it)}<em>${it.name}</em></button>`).join('')}`;
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

// dashed (its dashes going along: phase, 0-1)
function dashIn(fr, f, pts, col, w, seed, a, phase) {
  const D = 0.2;
  const P = 0.33;
  const s0 = (phase % 1) * P;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    const L = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    if (L < 1e-6) continue;
    for (let k = Math.floor((acc + s0) / P); ; k++) {
      const d0 = k * P - s0;
      const a0 = Math.max(d0, acc);
      const a1 = Math.min(d0 + D, acc + L);
      if (a0 >= acc + L) break;
      if (a1 > a0) runIn(fr, f, [lerp3(p, q, (a0 - acc) / L), lerp3(p, q, (a1 - acc) / L)], col, w, seed + i * 31 + k, a, 0);
    }
    acc += L;
  }
}

function lerp3(a, b, k) {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function mix(a, b, k) {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

// the shape a hint draws on the car, dashed, to trace: [[x, y, z], ...] lines in its frame
function hintShapes(type, ctx) {
  const D = ctx.D;
  const K = ctx.K;
  const roof = K ? K.roofY : D.h;
  const clear = K ? K.clear : 0.25;
  const out = [];
  if (type === 'wing') {
    const y = roof * 0.62;
    for (const sd of [1, -1]) {
      const x0 = sd * D.hw;
      const x1 = sd * (D.hw + 1.9);
      out.push([[x0, y, 0.55], [x1, y, 0.0], [x1, y, -0.6], [x0, y, -1.0], [x0, y, 0.55]]);
    }
  } else if (type === 'float') {
    for (const sd of [1, -1]) {
      const x = sd * (D.hw + 0.12);
      const z0 = -D.hl * 0.82;
      const z1 = D.hl * 0.82;
      const y0 = clear - 0.1;
      const y1 = clear + 0.32;
      const L = [];
      for (let i = 0; i <= 6; i++) {
        const a = -Math.PI / 2 + (i / 6) * Math.PI;
        L.push([x, (y0 + y1) / 2 + Math.sin(a) * (y1 - y0) / 2, z1 + Math.cos(a) * 0.25]);
      }
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI / 2 + (i / 6) * Math.PI;
        L.push([x, (y0 + y1) / 2 + Math.sin(a) * (y1 - y0) / 2, z0 + Math.cos(a) * 0.25]);
      }
      L.push(L[0]);
      out.push(L);
    }
  } else if (type === 'rotor') {
    out.push([[0, roof + 0.55, -2.1], [0, roof + 0.55, 2.1]]);
    out.push([[0, roof, 0], [0, roof + 0.55, 0]]);
  } else if (type === 'balloon') {
    const L = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      L.push([0, roof + 1.9 + Math.sin(a) * 1.0, Math.cos(a) * 1.0]);
    }
    out.push(L);
    out.push([[0, roof, 0], [0, roof + 0.9, 0]]);
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
  const sh = part.shape;
  const ax = sh.ax;
  const K = [kx, ky, kz];
  const scale = (X) => [X[0] * kx, X[1] * ky, X[2] * kz];
  const uv = (q) => toUV(scale(toXYZ(q, ax, sh.c)), ax);
  for (const key of ['outlines', 'rods', 'lines']) if (Array.isArray(sh[key])) sh[key] = sh[key].map((L) => L.map(uv));
  if (sh.pivot) sh.pivot = uv(sh.pivot);
  for (const key of ['mast', 'far', 'string']) if (Array.isArray(sh[key])) sh[key] = scale(sh[key]);
  sh.c = sh.c * K[ax === 'x' ? 0 : ax === 'y' ? 1 : 2];
  if (part.at) part.at = scale(part.at);
  return part;
}

// a kept part's look, small: its lines as drawn (on its plane)
function thumb(it) {
  const sh = it.shape;
  const lines = sh && (sh.lines || []).length ? sh.lines : sh ? sh.outlines || [] : [];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const L of lines) {
    for (const [u, w] of L) {
      x0 = Math.min(x0, u);
      x1 = Math.max(x1, u);
      y0 = Math.min(y0, -w);
      y1 = Math.max(y1, -w);
    }
  }
  if (!(x1 > x0) && !(y1 > y0)) return '<svg viewBox="0 0 40 28"></svg>';
  const s = Math.min(34 / Math.max(0.01, x1 - x0), 22 / Math.max(0.01, y1 - y0));
  const ox = (40 - (x1 - x0) * s) / 2;
  const oy = (28 - (y1 - y0) * s) / 2;
  const ink = INKS[it.ink] || INKS[1];
  const col = ink.pencil || ink.css === '#f4efe4' ? '#2a2a33' : ink.css;
  const paths = lines.map((L) => `<polyline points="${L.map(([u, w]) => `${(ox + (u - x0) * s).toFixed(1)},${(oy + (-w - y0) * s).toFixed(1)}`).join(' ')}"/>`).join('');
  return `<svg viewBox="0 0 40 28" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}
