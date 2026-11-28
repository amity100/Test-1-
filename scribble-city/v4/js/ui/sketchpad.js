// (ROADMAP 9.3, not with ?classic) A sheet to draw on, for what is drawn onto the world: a graffiti
// for a wall, a tattoo for the arm. It comes with its own pens; what it gives back is the strokes,
// in the sheet's own measure (u across, 0..1 from the left; v up, 0..1 from the bottom), each
// with the pen it was drawn with.

const MAX_PTS = 900;

export class SketchPad {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this.strokes = [];
    this.cur = null;
    this.pen = 0;
    const el = (this.el = document.createElement('div'));
    el.id = 'sketchpad';
    el.className = 'hidden';
    el.innerHTML = `<div class="ps-sheet paper-card">
      <div class="ps-head"><span class="ps-title"></span><span class="ps-hint"></span></div>
      <canvas width="1000" height="420"></canvas>
      <div class="ps-row"><span class="ps-label">עט</span><div class="ps-swatches"></div></div>
      <div class="ps-row ps-actions"><button class="ps-btn sp-undo">בטל קו</button><button class="ps-btn sp-clear">נקה</button><span class="ps-gap"></span><button class="ps-btn sp-cancel">ביטול</button><button class="ps-btn primary sp-done"></button></div>
    </div>`;
    document.body.appendChild(el);
    this.cv = el.querySelector('canvas');
    this.g = this.cv.getContext('2d');
    this.titleEl = el.querySelector('.ps-title');
    this.hintEl = el.querySelector('.ps-hint');
    this.swEl = el.querySelector('.ps-swatches');
    this.doneEl = el.querySelector('.sp-done');
    const btn = (cls, fn) => el.querySelector(cls).addEventListener('click', (e) => {
      e.stopPropagation();
      game.audio.play('click', 0.5);
      fn();
    });
    btn('.sp-undo', () => {
      this.strokes.pop();
      this.render();
    });
    btn('.sp-clear', () => {
      this.strokes = [];
      this.render();
    });
    btn('.sp-cancel', () => this.close(false));
    btn('.sp-done', () => this.close(true));
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cv.setPointerCapture(e.pointerId);
      this.cur = { pen: this.pen, pts: [this.at(e)] };
      this.render();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.cur) return;
      e.preventDefault();
      const p = this.at(e);
      const pts = this.cur.pts;
      const q = pts[pts.length - 1];
      if (Math.hypot((p[0] - q[0]) * this.aspect, p[1] - q[1]) < 0.008 || this.count() > MAX_PTS) return;
      pts.push(p);
      this.render();
    });
    const up = (e) => {
      if (!this.cur) return;
      e.preventDefault();
      if (this.cur.pts.length >= 2) {
        this.strokes.push(this.cur);
        game.audio.play('scribble', 0.25);
      }
      this.cur = null;
      this.render();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    // (nothing on the sheet reaches the game under it)
    for (const ev of ['mousedown', 'mouseup', 'click', 'contextmenu', 'touchstart', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation());
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

  count() {
    return this.strokes.reduce((n, s) => n + s.pts.length, 0) + (this.cur ? this.cur.pts.length : 0);
  }

  // o: { title, hint, done, aspect (width / height), pens: [{ css, c, name, w }], bg(g, w, h) }
  // cb(strokes | null)
  show(o, cb) {
    const game = this.game;
    this.o = o;
    this.cb = cb;
    this.strokes = [];
    this.cur = null;
    this.pen = 0;
    this.aspect = o.aspect || 2.4;
    this.cv.width = 1000;
    this.cv.height = Math.round(1000 / this.aspect);
    this.titleEl.textContent = o.title || '';
    this.hintEl.textContent = o.hint || '';
    this.doneEl.textContent = o.done || 'סיימתי!';
    this.swEl.innerHTML = '';
    o.pens.forEach((p, i) => {
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
      this.swEl.appendChild(b);
    });
    this.isOpen = true;
    this.el.classList.remove('hidden');
    if (!game.touch) game.input.releaseLock();
    game.input.keys.clear();
    this.mark();
    this.render();
  }

  close(ok) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.add('hidden');
    const cb = this.cb;
    this.cb = null;
    if (cb) cb(ok && this.strokes.length ? this.strokes : null);
  }

  mark() {
    [...this.swEl.children].forEach((b, i) => b.classList.toggle('sel', i === this.pen));
  }

  // a pointer on the sheet, in its own measure
  at(e) {
    const r = this.cv.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height))];
  }

  render() {
    const g = this.g;
    const W = this.cv.width;
    const H = this.cv.height;
    g.clearRect(0, 0, W, H);
    if (this.o.bg) this.o.bg(g, W, H);
    else {
      g.fillStyle = '#f7f4ec';
      g.fillRect(0, 0, W, H);
    }
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of this.cur ? [...this.strokes, this.cur] : this.strokes) {
      const p = this.o.pens[s.pen];
      g.strokeStyle = p.css;
      g.lineWidth = p.px || 7;
      g.beginPath();
      s.pts.forEach(([u, v], i) => (i ? g.lineTo(u * W, (1 - v) * H) : g.moveTo(u * W, (1 - v) * H)));
      if (s.pts.length === 1) g.lineTo(s.pts[0][0] * W + 0.5, (1 - s.pts[0][1]) * H);
      g.stroke();
    }
  }
}
