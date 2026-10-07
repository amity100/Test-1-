import { BLUEPRINTS, drawBlueprint } from '../game/blueprints.js';
import { scoreDrawing } from '../game/recognizer.js';
import { Sketcher, FONT_HAND } from '../render/sketch2d.js';

const RED = '#c81e24';
const PEN = '#1c2650';

const COMMENTS = {
  perfect: ['מושלם! כל הכבוד', 'יצירת מופת!', 'מדויק להפליא'],
  good: ['טוב מאוד', 'יפה! זה יעבוד', 'ציור טוב'],
  wonky: ['עקום... יעבוד חלקית', 'בערך... נקווה לטוב', 'יצא קצת מעוות'],
  fail: ['זה לא דומה בכלל', 'אוי... זה ייצא מקולקל', 'צריך לתרגל'],
};

/**
 * The notebook page you draw on while the city keeps running around you.
 */
export class DrawPad {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('drawpad');
    this.area = document.getElementById('draw-area');
    this.canvas = document.getElementById('draw-canvas');
    this.gradeCanvas = document.getElementById('draw-grade');
    this.ctx = this.canvas.getContext('2d');
    this.gctx = this.gradeCanvas.getContext('2d');
    this.refCanvas = document.querySelector('#draw-ref canvas');
    this.titleEl = document.getElementById('draw-title');
    this.statusEl = document.getElementById('draw-status');
    this.dangerEl = document.getElementById('draw-danger');
    this.open = false;
    this.strokes = [];
    this.current = null;
    this.bp = null;
    this.grading = false;
    this.dpr = 1;
    this._bind();
  }

  _bind() {
    const c = this.canvas;
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top, e.pressure || 0.5];
    };
    c.addEventListener('pointerdown', (e) => {
      if (!this.open || this.grading) return;
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      this.current = [pos(e)];
      this.strokes.push(this.current);
      this.game.audio.scratchStart();
      this.redraw();
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.current) return;
      e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      let moved = 0;
      for (const ev of evs) {
        const p = pos(ev);
        const last = this.current[this.current.length - 1];
        const d = Math.hypot(p[0] - last[0], p[1] - last[1]);
        if (d < 1.2) continue;
        this.current.push(p);
        moved += d;
      }
      this.game.audio.scratch(moved);
      this.drawLastSegment();
    });
    const end = () => {
      if (!this.current) return;
      this.current = null;
      this.game.audio.scratchStop();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    document.getElementById('draw-done').addEventListener('click', () => this.finish());
    document.getElementById('draw-undo').addEventListener('click', () => this.undo());
    document.getElementById('draw-clear').addEventListener('click', () => {
      this.strokes = [];
      this.redraw();
    });
    document.getElementById('draw-cancel').addEventListener('click', () => this.close(true));
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.code === 'Escape') this.close(true);
      else if (e.code === 'Enter') this.finish();
      else if (e.code === 'Backspace' || (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey))) this.undo();
    });
    window.addEventListener('resize', () => {
      if (this.open) this.layout();
    });
  }

  layout() {
    const r = this.area.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const cv of [this.canvas, this.gradeCanvas]) {
      cv.width = Math.max(10, Math.round(r.width * this.dpr));
      cv.height = Math.max(10, Math.round(r.height * this.dpr));
    }
    this.redraw();
  }

  show(bpId) {
    const bp = BLUEPRINTS[bpId];
    this.bp = bp;
    this.strokes = [];
    this.grading = false;
    this.open = true;
    this.el.classList.remove('hidden');
    this.titleEl.textContent = `מציירים: ${bp.name}`;
    this.gctx.clearRect(0, 0, this.gradeCanvas.width, this.gradeCanvas.height);
    // the "photo" reference
    const rc = this.refCanvas;
    const rctx = rc.getContext('2d');
    rctx.fillStyle = '#f7f4ec';
    rctx.fillRect(0, 0, rc.width, rc.height);
    drawBlueprint(rctx, bp, 0, 0, rc.width, rc.height, { pad: 0.08, seed: 3, width: 3 });
    requestAnimationFrame(() => this.layout());
    this.setDanger(false);
  }

  close(cancelled = false) {
    if (!this.open) return;
    this.open = false;
    this.current = null;
    this.el.classList.add('hidden');
    this.game.audio.scratchStop();
    this.game.onDrawClosed(cancelled);
  }

  undo() {
    if (this.grading) return;
    this.strokes.pop();
    this.redraw();
  }

  setDanger(on, text) {
    this.dangerEl.classList.toggle('on', !!on);
    this.statusEl.classList.toggle('danger', !!on);
    this.statusEl.textContent = on ? text || '⚠ תוקפים אותך!' : text || 'שקט… אפשר לצייר';
  }

  penWidth(p) {
    return (2.2 + (p[2] || 0.5) * 1.6) * this.dpr;
  }

  redraw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PEN;
    for (const s of this.strokes) {
      if (s.length === 1) {
        ctx.fillStyle = PEN;
        ctx.beginPath();
        ctx.arc(s[0][0] * this.dpr, s[0][1] * this.dpr, this.penWidth(s[0]) / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      for (let i = 1; i < s.length; i++) {
        ctx.lineWidth = this.penWidth(s[i]);
        ctx.beginPath();
        ctx.moveTo(s[i - 1][0] * this.dpr, s[i - 1][1] * this.dpr);
        ctx.lineTo(s[i][0] * this.dpr, s[i][1] * this.dpr);
        ctx.stroke();
      }
    }
  }

  drawLastSegment() {
    const s = this.current;
    if (!s || s.length < 2) return;
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.strokeStyle = PEN;
    const a = s[s.length - 2];
    const b = s[s.length - 1];
    ctx.lineWidth = this.penWidth(b);
    ctx.beginPath();
    ctx.moveTo(a[0] * this.dpr, a[1] * this.dpr);
    ctx.lineTo(b[0] * this.dpr, b[1] * this.dpr);
    ctx.stroke();
  }

  finish() {
    if (!this.open || this.grading) return;
    const strokes = this.strokes.map((s) => s.map((p) => [p[0], p[1]]));
    const ink = strokes.reduce((a, s) => a + s.length, 0);
    if (ink < 6) {
      this.game.hud.toast('הדף עדיין ריק…', 'info');
      return;
    }
    const res = scoreDrawing(strokes, this.bp);
    this.grading = true;
    this.showGrade(res);
    this.game.audio.play(res.grade === 'fail' ? 'fail' : res.grade === 'wonky' ? 'meh' : 'ding');
    const done = () => {
      if (!this.open) return;
      this.open = false;
      this.el.classList.add('hidden');
      this.game.onDrawingDone(this.bp, res, strokes);
    };
    this.pendingDone = setTimeout(done, 1900);
    const skip = () => {
      clearTimeout(this.pendingDone);
      this.gradeCanvas.removeEventListener('pointerdown', skip);
      done();
    };
    this.gradeCanvas.style.pointerEvents = 'auto';
    this.gradeCanvas.addEventListener('pointerdown', skip, { once: true });
    setTimeout(() => (this.gradeCanvas.style.pointerEvents = 'none'), 2000);
  }

  // Teacher's red pen: ghost of the right shape, circles around missing parts, the grade.
  showGrade(res) {
    const g = this.gctx;
    const W = this.gradeCanvas.width;
    const H = this.gradeCanvas.height;
    g.clearRect(0, 0, W, H);
    const sk = new Sketcher(g, 5);
    const d = this.dpr;
    if (res.transform) {
      const T = res.transform;
      const toCanvas = ([X, Y]) => {
        const X0 = (X - T.cx - T.ddx) / T.ksx + T.cx;
        const Y0 = (Y - T.cy - T.ddy) / T.ksy + T.cy;
        return [((X0 - T.tx) / T.sx) * d, ((Y0 - T.ty) / T.sy) * d];
      };
      g.save();
      g.globalAlpha = 0.35;
      for (const st of this.bp.strokes) sk.stroke(st.pts.map(toCanvas), { width: 2 * d, color: RED, passes: 1, jitter: 0.4 });
      g.restore();
      // circle what is missing
      const seen = new Set();
      this.bp.strokes.forEach((st, i) => {
        if (res.partCoverage[i] >= 0.38) return;
        const pts = st.pts.map(toCanvas);
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const [x, y] of pts) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const r = Math.max(14 * d, Math.max(x1 - x0, y1 - y0) * 0.65);
        sk.ellipse(cx, cy, r, r * 0.8, { width: 3 * d, color: RED, passes: 1 });
        if (!seen.has(st.label)) {
          seen.add(st.label);
          sk.text(`חסר: ${st.label}`, cx, cy + r + 18 * d, { size: 22 * d, color: RED, font: FONT_HAND, weight: 400 });
        }
      });
    }
    // grade circle
    const gx = W - 90 * d;
    const gy = 70 * d;
    sk.circle(gx, gy, 46 * d, { width: 4 * d, color: RED, passes: 2 });
    sk.text(`${res.score}`, gx, gy + 2 * d, { size: 44 * d, color: RED, font: FONT_HAND, dir: 'ltr', weight: 400 });
    const list = COMMENTS[res.grade];
    const comment = list[Math.floor(Math.random() * list.length)];
    sk.text(comment, gx - 70 * d, gy + 78 * d, { size: 32 * d, color: RED, font: FONT_HAND, align: 'right', weight: 400 });
    sk.stroke([[gx - 260 * d, gy + 100 * d], [gx - 60 * d, gy + 96 * d]], { width: 3 * d, color: RED, passes: 1 });
  }
}
