import { sideProfile, sidePoint } from '../render/cars.js';
import { PAINTS } from '../game/garage.js';

// The paint shop (ROADMAP 4.6): the car from the side on a sheet of paper. Pick its new colour,
// then draw on it with the pens - flames, stripes, a name, whatever you like. The drawing goes
// onto both sides of the car, on its skin (render/cars.js sidePoint), drawn with the city's own
// pens (game/vehicles.js drawOn); the windows and the wheels take none of it.

const $ = (id) => document.getElementById(id);
// the pens: their colour on the paper and in the city (dark: the ink of the outlines; brighter
// than white: they glow, like neon)
export const PENS = [
  { css: '#1b1622', c: [0.05, 0.05, 0.07], name: 'דיו' },
  { css: '#ffffff', c: [0.97, 0.97, 0.95], name: 'לבן' },
  { css: '#e8333d', c: [0.95, 0.18, 0.22], name: 'אדום' },
  { css: '#ffd23f', c: [1.0, 0.84, 0.22], name: 'צהוב' },
  { css: '#33d6ff', c: [0.25, 0.85, 1.0], name: 'תכלת' },
  { css: '#4ee06a', c: [0.32, 0.9, 0.42], name: 'ירוק' },
  { css: '#ff7cc8', c: [1.0, 0.48, 0.78], name: 'ורוד' },
  { css: '#ff8a2a', c: [1.0, 0.55, 0.16], name: 'כתום' },
  { css: '#fff1a8', c: [2.6, 2.1, 0.8], name: 'ניאון זהב', glow: true },
  { css: '#ff9bf0', c: [2.4, 0.8, 2.0], name: 'ניאון ורוד', glow: true },
];
const WIDTH = { thin: { px: 3.2, w: 2.6 }, thick: { px: 7.5, w: 5.4 } };
const MAX_PTS = 450;
const STEP = 0.05; // metres between the points put on the car

const css = (c) => `rgb(${Math.round(Math.min(1, c[0]) * 255)}, ${Math.round(Math.min(1, c[1]) * 255)}, ${Math.round(Math.min(1, c[2]) * 255)})`;

export class PaintShop {
  constructor(game) {
    this.game = game;
    this.el = $('paintshop');
    this.cv = $('ps-canvas');
    this.g = this.cv.getContext('2d');
    this.isOpen = false;
    this.pen = 0;
    this.width = 'thin';
    this.strokes = [];
    this.cur = null;
    // the swatches
    const paints = $('ps-paints');
    PAINTS.forEach((p, i) => {
      const b = document.createElement('button');
      b.className = 'ps-sw';
      b.style.background = css(p.c);
      b.title = p.name;
      b.setAttribute('aria-label', p.name);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.color = p.c.slice();
        this.game.audio.play('paint', 0.5);
        this.mark();
        this.render();
      });
      b.dataset.i = i;
      paints.appendChild(b);
    });
    const pens = $('ps-pens');
    PENS.forEach((p, i) => {
      const b = document.createElement('button');
      b.className = 'ps-sw pen' + (p.glow ? ' glow' : '');
      b.style.background = p.css;
      b.title = p.name;
      b.setAttribute('aria-label', p.name);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pen = i;
        this.mark();
      });
      pens.appendChild(b);
    });
    const btn = (id, fn) => $(id).addEventListener('click', (e) => {
      e.stopPropagation();
      this.game.audio.play('click', 0.5);
      fn();
    });
    btn('ps-thin', () => {
      this.width = 'thin';
      this.mark();
    });
    btn('ps-thick', () => {
      this.width = 'thick';
      this.mark();
    });
    btn('ps-undo', () => {
      this.strokes.pop();
      this.render();
    });
    btn('ps-clear', () => {
      this.strokes = [];
      this.render();
    });
    btn('ps-cancel', () => this.close(false));
    btn('ps-done', () => this.close(true));
    // drawing on the sheet (a mouse, a finger, a pen)
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cv.setPointerCapture(e.pointerId);
      const p = this.toCar(e);
      this.cur = { pen: this.pen, width: this.width, zy: [p[0], p[1]] };
      this.render();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.cur) return;
      e.preventDefault();
      const p = this.toCar(e);
      const zy = this.cur.zy;
      const n = zy.length;
      if (Math.hypot(p[0] - zy[n - 2], p[1] - zy[n - 1]) < 0.012) return;
      zy.push(p[0], p[1]);
      this.render();
    });
    const up = (e) => {
      if (!this.cur) return;
      e.preventDefault();
      if (this.cur.zy.length >= 4) {
        this.strokes.push(this.cur);
        this.game.audio.play('scribble', 0.25);
      }
      this.cur = null;
      this.render();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    // (nothing on the sheet reaches the game under it)
    for (const ev of ['mousedown', 'mouseup', 'click', 'contextmenu', 'touchstart', 'wheel']) this.el.addEventListener(ev, (e) => e.stopPropagation());
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Escape') this.close(false);
      else if (e.code === 'Enter') this.close(true);
      else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
        this.strokes.pop();
        this.render();
      }
    });
  }

  get open() {
    return this.isOpen;
  }

  // v: the car; cb(result | null): { color, design }
  show(v, cb) {
    const game = this.game;
    this.v = v;
    this.cb = cb;
    this.kind = v.carKind || 'sedan';
    this.P = sideProfile(this.kind);
    this.color = (v.color || [0.8, 0.2, 0.2]).slice();
    // (the design it has already, to go on with)
    this.strokes = v.design && v.design.src ? v.design.src.map((s) => ({ pen: s.pen, width: s.width, zy: s.zy.slice() })) : [];
    this.cur = null;
    this.isOpen = true;
    this.el.classList.remove('hidden');
    if (!game.touch) game.input.releaseLock();
    game.input.keys.clear();
    this.fit();
    this.mark();
    this.render();
  }

  close(ok) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.add('hidden');
    const cb = this.cb;
    this.cb = null;
    const res = ok ? { color: this.color, design: this.bake() } : null;
    if (cb) cb(res);
  }

  // which swatch, which pen, which width
  mark() {
    const pi = PAINTS.findIndex((p) => p.c.every((c, i) => Math.abs(c - this.color[i]) < 0.01));
    for (const b of $('ps-paints').children) b.classList.toggle('sel', +b.dataset.i === pi);
    [...$('ps-pens').children].forEach((b, i) => b.classList.toggle('sel', i === this.pen));
    $('ps-thin').classList.toggle('sel', this.width === 'thin');
    $('ps-thick').classList.toggle('sel', this.width === 'thick');
  }

  // the car's side on the sheet: metres -> pixels (z to the right: its front is on the right)
  fit() {
    const P = this.P;
    const W = this.cv.width;
    const H = this.cv.height;
    const m = 0.3;
    const s = Math.min(W / (P.L + 2 * m), (H - 40) / (P.R + 0.35));
    this.S = s;
    this.ox = W / 2;
    this.oy = H - 26;
  }

  px(z, y) {
    return [this.ox + z * this.S, this.oy - y * this.S];
  }

  toCar(e) {
    const r = this.cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * this.cv.width;
    const y = ((e.clientY - r.top) / r.height) * this.cv.height;
    return [(x - this.ox) / this.S, (this.oy - y) / this.S];
  }

  bodyPath(g) {
    const B = this.P.body;
    g.beginPath();
    B.forEach((b, i) => {
      const [x, y] = this.px(b.z, b.top);
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    for (let i = B.length - 1; i >= 0; i--) {
      const [x, y] = this.px(B[i].z, B[i].bot);
      g.lineTo(x, y);
    }
    g.closePath();
  }

  render() {
    const g = this.g;
    const P = this.P;
    const W = this.cv.width;
    const H = this.cv.height;
    g.clearRect(0, 0, W, H);
    // the floor of the shop
    g.strokeStyle = 'rgba(40, 30, 60, 0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(20, this.oy);
    g.lineTo(W - 20, this.oy);
    g.stroke();
    // the roof and the windows
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const Rf = P.roof;
    g.beginPath();
    Rf.forEach((r, i) => {
      const [x, y] = this.px(r.z, r.y);
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    for (let i = Rf.length - 1; i >= 0; i--) {
      const [x, y] = this.px(Rf[i].z, Rf[i].yb);
      g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = css(this.color);
    g.fill();
    g.strokeStyle = '#1b1622';
    g.lineWidth = 3;
    g.stroke();
    // (the glass: inside the roof's line)
    g.save();
    g.clip();
    g.beginPath();
    Rf.forEach((r, i) => {
      const [x, y] = this.px(r.z, r.yb + (r.y - r.yb) * 0.86);
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    for (let i = Rf.length - 1; i >= 0; i--) {
      const [x, y] = this.px(Rf[i].z, Rf[i].yb + 0.02);
      g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = '#3a3f66';
    g.fill();
    g.strokeStyle = '#1b1622';
    g.lineWidth = 2;
    for (const pz of P.pillars) {
      const [x0, y0] = this.px(pz, 0);
      g.fillStyle = '#1b1622';
      g.fillRect(x0 - 4, 0, 8, y0);
    }
    g.restore();
    // the body in its colour, the design on it (only on it)
    this.bodyPath(g);
    g.fillStyle = css(this.color);
    g.fill();
    g.save();
    this.bodyPath(g);
    g.clip();
    // (a little shading under the shoulder, like the city's pens)
    const grd = g.createLinearGradient(0, this.px(0, P.R)[1], 0, this.oy);
    grd.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    grd.addColorStop(1, 'rgba(20, 10, 40, 0.22)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    for (const s of this.cur ? [...this.strokes, this.cur] : this.strokes) this.drawStroke(g, s);
    g.restore();
    this.bodyPath(g);
    g.strokeStyle = '#1b1622';
    g.lineWidth = 3.5;
    g.stroke();
    // the wheels
    for (const w of P.wheels) {
      const [x, y] = this.px(w.z, w.r);
      g.beginPath();
      g.arc(x, y, w.r * this.S, 0, Math.PI * 2);
      g.fillStyle = '#1e1c26';
      g.fill();
      g.beginPath();
      g.arc(x, y, w.r * this.S * 0.55, 0, Math.PI * 2);
      g.fillStyle = '#c9c9d2';
      g.fill();
      g.strokeStyle = '#1b1622';
      g.lineWidth = 2.5;
      g.stroke();
    }
  }

  drawStroke(g, s) {
    const pen = PENS[s.pen] || PENS[0];
    const zy = s.zy;
    g.strokeStyle = pen.css;
    g.lineWidth = WIDTH[s.width].px;
    if (pen.glow) {
      g.shadowColor = pen.css;
      g.shadowBlur = 10;
    }
    g.beginPath();
    for (let i = 0; i < zy.length; i += 2) {
      const [x, y] = this.px(zy[i], zy[i + 1]);
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    if (zy.length === 2) {
      const [x, y] = this.px(zy[0], zy[1]);
      g.lineTo(x + 0.5, y);
    }
    g.stroke();
    g.shadowBlur = 0;
  }

  // the drawing onto the car: each line walked in small steps, every step put on the car's skin
  // (a step that falls on a window or a wheel breaks the line there)
  bake() {
    if (!this.strokes.length) return null;
    const out = [];
    let total = 0;
    for (const s of this.strokes) {
      const zy = s.zy;
      const p = [];
      let gap = true;
      const put = (z, y) => {
        const q = sidePoint(this.kind, z, y, 1);
        if (!q) {
          if (!gap) p.push(null, null, null);
          gap = true;
          return;
        }
        p.push(q[0], q[1], q[2]);
        gap = false;
        total++;
      };
      put(zy[0], zy[1]);
      for (let i = 2; i < zy.length && total < MAX_PTS; i += 2) {
        const z0 = zy[i - 2];
        const y0 = zy[i - 1];
        const d = Math.hypot(zy[i] - z0, zy[i + 1] - y0);
        const n = Math.max(1, Math.ceil(d / STEP));
        for (let k = 1; k <= n; k++) put(z0 + ((zy[i] - z0) * k) / n, y0 + ((zy[i + 1] - y0) * k) / n);
      }
      // (a dot: a tiny stroke)
      if (zy.length === 2 && p.length === 3) p.push(p[0], p[1] + 0.012, p[2] + 0.012);
      if (p.length >= 6) out.push({ c: PENS[s.pen].c, w: WIDTH[s.width].w, p });
      if (total >= MAX_PTS) break;
    }
    return { src: this.strokes.map((s) => ({ pen: s.pen, width: s.width, zy: s.zy.slice() })), strokes: out };
  }
}
