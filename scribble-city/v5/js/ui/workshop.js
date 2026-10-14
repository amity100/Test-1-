import { PARTS, PART_NAME, PART_CSS, COLORS, readParts, shapeOf, specOf, spawnDrawn, jetFlames } from '../game/drawncar.js';

// (ROADMAP 11.6, a test: the workshop) B, or the workshop button on the pen's page. A sheet of
// paper with a vehicle drawn on it from the side: a big closed shape for its body, round ones
// low down for wheels, a flat line for wings, one over its top for a rotor, one up its nose for
// a propeller, a small one at its back for a jet (game/drawncar.js reads them; a tap on a part
// that came out as the wrong one makes it the next kind). As it is drawn, a card says what it
// is, how fast, how it holds the road, how it flies. "Build it!" - for some ink - and it stands
// in the street beside you, to get into (E). The city waits while the sheet is out.
// What was built is kept (this browser's), with four drawn ready to start from.

const $ = (id) => document.getElementById(id);
const KEEP = 'sc5-workshop';
// the sheet: so many metres along, so high
const SPAN_Z = 8;
const SPAN_Y = 4;

const TIP = {
  car: 'W/S נוסעים · רווח: בלם יד. גלגלים גדולים מחזיקים את הכביש טוב יותר',
  glider: 'הכנפיים: אחרי קפיצה מרמפה הוא גולש באוויר',
  jetcar: 'Shift: טורבו מהסילון',
  copter: 'רווח ו־C: למעלה ולמטה · קליק: מטוסי נייר',
  plane: 'W: מצערת · צריך כביש ארוך, ואז רווח: האף למעלה',
};

// circles and outlines, for the ones drawn ready
const ring = (z, y, r, n = 18) => {
  const p = [];
  for (let i = 0; i <= n; i++) p.push([z + Math.cos((i / n) * Math.PI * 2) * r, y + Math.sin((i / n) * Math.PI * 2) * r]);
  return p;
};
const closed = (pts) => pts.concat([pts[0].slice()]);
const EXAMPLES = [
  {
    name: 'מכונית',
    color: 0,
    strokes: [
      { type: 'body', pts: closed([[1.9, 0.5], [1.95, 0.95], [2.7, 1.08], [3.3, 1.5], [4.7, 1.5], [5.35, 1.08], [6.05, 0.98], [6.1, 0.5]]) },
      { type: 'wheel', pts: ring(2.85, 0.38, 0.38) },
      { type: 'wheel', pts: ring(5.15, 0.38, 0.38) },
      { type: 'line', pts: [[3.45, 1.4], [4.0, 1.4], [4.0, 1.12], [3.2, 1.12]] },
    ],
  },
  {
    name: 'מכונית סילון',
    color: 4,
    strokes: [
      { type: 'body', pts: closed([[1.6, 0.45], [1.7, 0.95], [3.0, 1.1], [3.6, 1.45], [4.6, 1.45], [5.6, 0.95], [6.7, 0.7], [6.7, 0.45]]) },
      { type: 'wheel', pts: ring(2.6, 0.42, 0.42) },
      { type: 'wheel', pts: ring(5.6, 0.32, 0.32) },
      { type: 'jet', pts: ring(1.45, 0.85, 0.3, 12) },
      { type: 'line', pts: [[1.75, 1.0], [1.95, 1.4], [2.7, 1.4]] },
    ],
  },
  {
    name: 'מסוק',
    color: 2,
    strokes: [
      { type: 'body', pts: closed([[3.0, 0.5], [2.8, 1.1], [3.2, 1.8], [4.5, 1.95], [5.6, 1.5], [5.8, 0.9], [5.2, 0.5]]) },
      { type: 'line', pts: [[3.0, 1.2], [1.2, 1.45], [1.0, 1.9]] },
      { type: 'rotor', pts: [[2.3, 2.45], [6.3, 2.45]] },
      { type: 'line', pts: [[3.0, 0.15], [5.6, 0.15]] },
    ],
  },
  {
    name: 'מטוס',
    color: 7,
    strokes: [
      { type: 'body', pts: closed([[1.4, 1.1], [1.6, 1.5], [2.2, 1.35], [5.4, 1.45], [6.4, 1.3], [6.6, 1.05], [6.2, 0.8], [2.4, 0.85]]) },
      { type: 'wing', pts: [[3.4, 1.15], [5.0, 1.15]] },
      { type: 'prop', pts: [[6.8, 0.55], [6.8, 1.75]] },
      { type: 'wheel', pts: ring(3.3, 0.24, 0.24, 12) },
      { type: 'wheel', pts: ring(5.6, 0.24, 0.24, 12) },
      { type: 'line', pts: [[1.5, 1.5], [1.2, 2.1], [1.8, 2.1], [2.2, 1.4]] },
    ],
  },
];

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEEP) || 'null') || { list: [] };
  } catch (err) {
    return { list: [] };
  }
}

function keep(v) {
  try {
    localStorage.setItem(KEEP, JSON.stringify(v));
  } catch (err) {
    // (a private window: kept for this time only)
  }
}

export class Workshop {
  constructor(game) {
    this.game = game;
    this.el = $('workshop');
    this.isOpen = false;
    this.strokes = [];
    this.cur = null;
    this.color = 0;
    this.kept = load();
    this.build();
    this.bind();
  }

  get open() {
    return this.isOpen;
  }

  build() {
    const sw = COLORS.map((c, i) => `<button class="ws-sw" data-i="${i}" style="background:${c.css}" title="${c.name}" aria-label="${c.name}"></button>`).join('');
    const legend = PARTS.map((p) => `<span style="--c:${PART_CSS[p]}">${PART_NAME[p]}</span>`).join('');
    this.el.innerHTML = `<div class="ws-sheet paper-card">
      <div class="ws-head">
        <div class="ws-title">הסדנה</div>
        <div class="ws-hint">ציירו כלי רכב מהצד, החזית ימינה. הצורה קובעת מה הוא עושה. נגיעה בחלק מחליפה את הסוג שלו</div>
        <button class="ws-btn ws-x" id="ws-close">✕ חזרה</button>
      </div>
      <div class="ws-main">
        <canvas id="ws-canvas"></canvas>
        <div class="ws-side">
          <div class="ws-kind" id="ws-kind"></div>
          <div id="ws-stats"></div>
          <div class="ws-tip" id="ws-tip"></div>
          <div class="ws-legend">${legend}</div>
        </div>
      </div>
      <div class="ws-row">
        <span class="ws-label">צבע</span><span class="ws-sws">${sw}</span>
        <span class="ws-gap"></span>
        <button class="ws-btn" id="ws-undo">↶ ביטול</button>
        <button class="ws-btn" id="ws-clear">נקה</button>
        <button class="ws-btn primary" id="ws-build">בנו את זה!</button>
      </div>
      <div class="ws-row">
        <span class="ws-label">דוגמאות</span><span class="ws-saved" id="ws-examples"></span>
        <span class="ws-label">שמורים</span><span class="ws-saved" id="ws-kept"></span>
      </div>
    </div>`;
    this.cv = $('ws-canvas');
    this.g = this.cv.getContext('2d');
    this.kindEl = $('ws-kind');
    this.statsEl = $('ws-stats');
    this.tipEl = $('ws-tip');
    this.buildBtn = $('ws-build');
    this.renderExamples();
    this.renderKept();
  }

  bind() {
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => {
      if (!this.isOpen || this.cur) return;
      e.preventDefault();
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (err) {
        // (synthetic pointers)
      }
      this.cur = { pts: [this.toM(e)], type: 'line', pid: e.pointerId };
      this.game.audio.scratchStart();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.cur || e.pointerId !== this.cur.pid) return;
      e.preventDefault();
      let evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (!evs.length) evs = [e];
      let moved = 0;
      for (const ev of evs) {
        const p = this.toM(ev);
        const q = this.cur.pts[this.cur.pts.length - 1];
        const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (d < 0.035) continue;
        this.cur.pts.push(p);
        moved += d;
      }
      if (moved) this.game.audio.scratch(moved * 60);
      this.render();
    });
    const up = (e) => {
      const c = this.cur;
      if (!c || e.pointerId !== c.pid) return;
      this.cur = null;
      this.game.audio.scratchStop();
      const sh = shapeOf(c.pts);
      if (sh.len < 0.12) this.tap(c.pts[0]);
      else {
        this.strokes.push(c);
        this.read();
      }
      this.render();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    // (nothing on the sheet reaches the game under it)
    for (const ev of ['mousedown', 'mouseup', 'click', 'contextmenu', 'touchstart', 'wheel']) this.el.addEventListener(ev, (e) => e.stopPropagation());
    $('ws-close').addEventListener('click', () => this.close());
    $('ws-undo').addEventListener('click', () => this.undo());
    $('ws-clear').addEventListener('click', () => {
      this.strokes = [];
      this.read();
      this.render();
    });
    $('ws-build').addEventListener('click', () => this.make());
    for (const b of this.el.querySelectorAll('.ws-sw')) {
      b.addEventListener('click', () => {
        this.color = +b.dataset.i;
        this.game.audio.play('paint', 0.4);
        this.mark();
        this.render();
      });
    }
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      // (the sheet's keys, not the game's: Esc here is no pause)
      this.game.input.pressed.delete(e.code);
      if (e.code === 'Escape') this.close();
      else if (e.code === 'Enter') this.make();
      else if (e.code === 'Backspace' || (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        this.undo();
      }
    });
    window.addEventListener('resize', () => {
      if (this.isOpen) this.fit();
    });
  }

  // ------------------------------------------------------------------ out and away
  show() {
    const g = this.game;
    const p = g.player;
    if (this.isOpen || g.state !== 'play') return;
    if (p.mode !== 'foot' || p.inVehicle) {
      g.hud.toast(p.inVehicle ? 'צאו מהרכב כדי לפתוח את הסדנה' : 'לא עכשיו', 'info', 1.8);
      return;
    }
    this.isOpen = true;
    this.el.classList.remove('hidden');
    if (!g.touch) g.input.releaseLock();
    g.input.keys.clear();
    g.input.fire = false;
    g.audio.play('pageflip', 0.5);
    // (the first time: the first of the ones drawn ready, to see how it goes)
    if (!this.strokes.length && !this.kept.list.length && !this.seen) this.useDesign(EXAMPLES[0]);
    this.seen = true;
    this.read();
    this.mark();
    this.fit();
  }

  close() {
    if (!this.isOpen) return;
    const g = this.game;
    this.isOpen = false;
    this.cur = null;
    this.el.classList.add('hidden');
    g.audio.play('pageflip', 0.3);
    if (!g.touch && g.state === 'play') g.input.requestLock(true);
  }

  // ------------------------------------------------------------------ the sheet
  fit() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cw = Math.max(200, r.width);
    this.ch = Math.max(100, r.height);
    this.cv.width = Math.round(this.cw * dpr);
    this.cv.height = Math.round(this.ch * dpr);
    this.dpr = dpr;
    // metres -> pixels: the ground a little over the bottom, the front to the right
    this.S = Math.min(this.cw / SPAN_Z, (this.ch - 22) / SPAN_Y);
    this.ox = (this.cw - SPAN_Z * this.S) / 2;
    this.oy = this.ch - 14;
    this.render();
  }

  px(z, y) {
    return [this.ox + z * this.S, this.oy - y * this.S];
  }

  toM(e) {
    const r = this.cv.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    return [Math.min(SPAN_Z, Math.max(0, (x - this.ox) / this.S)), Math.min(SPAN_Y, Math.max(0, (this.oy - y) / this.S))];
  }

  // a tap on a part: the next kind of part (and it stays that, whatever else is drawn)
  tap(p) {
    let best = null;
    let bd = 0.35;
    for (const s of this.strokes) {
      for (const q of s.pts) {
        const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
    }
    if (!best) return;
    best.type = PARTS[(PARTS.indexOf(best.type) + 1) % PARTS.length];
    best.fixed = true;
    this.game.audio.play('pop', 0.4);
    this.read(false);
  }

  undo() {
    if (!this.strokes.length) return;
    this.strokes.pop();
    this.game.audio.play('erase', 0.35);
    this.read();
    this.render();
  }

  design() {
    return { strokes: this.strokes, color: COLORS[this.color].c, name: this.name || null };
  }

  // what it is now: the parts read again, the card
  read(again = true) {
    if (again) readParts(this.strokes);
    this.name = null;
    const S = this.strokes.length ? specOf(this.design()) : null;
    this.spec = S;
    if (!S) {
      this.kindEl.textContent = 'דף ריק';
      this.statsEl.innerHTML = '';
      this.tipEl.innerHTML = 'מתחילים מגוף: צורה סגורה גדולה. אחר כך גלגלים, כנפיים, רוטור או מדחף';
      this.buildBtn.disabled = true;
      this.buildBtn.textContent = 'בנו את זה!';
      return;
    }
    this.kindEl.textContent = S.label || '?';
    const bar = (name, k) => `<div class="ws-stat"><span>${name}</span><span class="ws-bar"><i style="width:${Math.round(Math.max(0, Math.min(1, k)) * 100)}%"></i></span></div>`;
    this.statsEl.innerHTML = S.stats ? bar('מהירות', S.stats.speed) + bar('אחיזה', S.stats.grip) + bar('יציבות', S.stats.steady) + bar('תעופה', S.stats.air) : '';
    if (!S.ok) {
      this.tipEl.innerHTML = `<span class="ws-why">${S.why}</span>`;
      this.buildBtn.disabled = true;
      this.buildBtn.textContent = 'בנו את זה!';
      return;
    }
    const ink = this.game.ink;
    const dear = ink && ink.level < S.cost;
    this.tipEl.innerHTML = `${TIP[S.kind] || ''}<br><span class="ws-dim">${Math.round(S.L * 10) / 10} מ' אורך · ${S.wheels.length} גלגלים${S.jets.length ? ` · ${S.jets.length} סילון` : ''}</span>${dear ? `<br><span class="ws-why">חסר דיו: צריך ${S.cost}, יש ${Math.floor(ink.level)}</span>` : ''}`;
    this.buildBtn.disabled = false;
    this.buildBtn.textContent = `בנו את זה! · ${S.cost} דיו`;
  }

  mark() {
    for (const b of this.el.querySelectorAll('.ws-sw')) b.classList.toggle('sel', +b.dataset.i === this.color);
  }

  render() {
    if (!this.isOpen || !this.S) return;
    const g = this.g;
    const S = this.S;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.cw, this.ch);
    // the squares (half a metre), the ground
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(90, 120, 200, 0.16)';
    g.beginPath();
    for (let z = 0; z <= SPAN_Z + 1e-6; z += 0.5) {
      const [x] = this.px(z, 0);
      g.moveTo(x, 0);
      g.lineTo(x, this.oy);
    }
    for (let y = 0; y <= SPAN_Y + 1e-6; y += 0.5) {
      const [, yy] = this.px(0, y);
      g.moveTo(this.ox, yy);
      g.lineTo(this.ox + SPAN_Z * S, yy);
    }
    g.stroke();
    g.strokeStyle = '#1b1430';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, this.oy);
    g.lineTo(this.cw, this.oy);
    g.stroke();
    // somebody standing there, for how big it is (1.75 m)
    this.person(0.45);
    // the front
    g.fillStyle = 'rgba(27, 20, 48, 0.55)';
    g.font = `600 ${Math.round(Math.max(11, S * 0.13))}px Rubik, sans-serif`;
    g.textAlign = 'right';
    g.fillText('קדימה →', this.ox + SPAN_Z * S - 6, 18);
    // the parts: the body filled in its colour, each in its own ink; a word by each
    const col = COLORS[this.color].css;
    for (const s of this.strokes) this.part(s, col);
    if (this.cur) this.part(this.cur, col, true);
    for (const s of this.strokes) this.tag(s);
  }

  person(z) {
    const g = this.g;
    const [x, y0] = this.px(z, 0);
    const S = this.S;
    g.save();
    g.strokeStyle = 'rgba(27, 20, 48, 0.28)';
    g.fillStyle = 'rgba(27, 20, 48, 0.1)';
    g.lineWidth = 2;
    g.lineCap = 'round';
    const hy = y0 - 1.62 * S;
    g.beginPath();
    g.arc(x, hy, 0.12 * S, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(x, hy + 0.13 * S);
    g.lineTo(x, y0 - 0.85 * S);
    g.moveTo(x, y0 - 0.85 * S);
    g.lineTo(x - 0.16 * S, y0);
    g.moveTo(x, y0 - 0.85 * S);
    g.lineTo(x + 0.16 * S, y0);
    g.moveTo(x - 0.25 * S, y0 - 1.25 * S);
    g.lineTo(x, y0 - 1.38 * S);
    g.lineTo(x + 0.25 * S, y0 - 1.25 * S);
    g.stroke();
    g.restore();
  }

  part(s, col, live = false) {
    const g = this.g;
    if (s.pts.length < 2) return;
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const path = () => {
      g.beginPath();
      const [x, y] = this.px(s.pts[0][0], s.pts[0][1]);
      g.moveTo(x, y);
      for (let i = 1; i < s.pts.length; i++) {
        const [a, b] = this.px(s.pts[i][0], s.pts[i][1]);
        g.lineTo(a, b);
      }
    };
    if (!live && s.type === 'body') {
      path();
      g.closePath();
      g.globalAlpha = 0.55;
      g.fillStyle = col;
      g.fill();
      g.globalAlpha = 1;
    } else if (!live && s.type === 'wheel') {
      path();
      g.closePath();
      g.fillStyle = 'rgba(46, 42, 58, 0.35)';
      g.fill();
    }
    path();
    g.strokeStyle = live ? '#1b1430' : PART_CSS[s.type];
    g.lineWidth = live ? 3 : s.type === 'line' ? 2.5 : 3.5;
    if (s.type === 'rotor' || s.type === 'prop') g.setLineDash([10, 5]);
    g.stroke();
    g.restore();
  }

  tag(s) {
    if (s.type === 'line' && !s.fixed) return;
    const g = this.g;
    const sh = shapeOf(s.pts);
    const [x, y] = this.px(sh.x1, sh.y1);
    const text = PART_NAME[s.type];
    g.save();
    g.font = '600 12px Rubik, sans-serif';
    const w = g.measureText(text).width + 10;
    const tx = Math.min(this.cw - w - 2, x + 2);
    const ty = Math.max(2, y - 18);
    g.fillStyle = 'rgba(255, 248, 236, 0.92)';
    g.strokeStyle = PART_CSS[s.type];
    g.lineWidth = 1.5;
    g.beginPath();
    if (g.roundRect) g.roundRect(tx, ty, w, 16, 6);
    else g.rect(tx, ty, w, 16);
    g.fill();
    g.stroke();
    g.fillStyle = PART_CSS[s.type];
    g.textAlign = 'left';
    g.fillText(text, tx + 5, ty + 12);
    g.restore();
  }

  // ------------------------------------------------------------------ the ones kept, the ones drawn ready
  thumb(d) {
    const c = document.createElement('canvas');
    c.width = 144;
    c.height = 72;
    const g = c.getContext('2d');
    const s = 144 / SPAN_Z;
    g.fillStyle = '#fbf8f0';
    g.fillRect(0, 0, 144, 72);
    for (const st of d.strokes) {
      g.beginPath();
      st.pts.forEach((p, i) => (i ? g.lineTo(p[0] * s, 68 - p[1] * s) : g.moveTo(p[0] * s, 68 - p[1] * s)));
      if (st.type === 'body') {
        g.fillStyle = COLORS[d.color] ? COLORS[d.color].css : '#e8333d';
        g.globalAlpha = 0.6;
        g.fill();
        g.globalAlpha = 1;
      }
      g.strokeStyle = PART_CSS[st.type] || '#1b1430';
      g.lineWidth = 2;
      g.stroke();
    }
    return c;
  }

  renderExamples() {
    const box = $('ws-examples');
    box.innerHTML = '';
    for (const d of EXAMPLES) {
      const c = this.thumb(d);
      c.title = d.name;
      c.addEventListener('click', () => {
        this.useDesign(d);
        this.game.audio.play('pageflip', 0.35);
        this.read(false);
        this.mark();
        this.render();
      });
      box.appendChild(c);
    }
  }

  renderKept() {
    const box = $('ws-kept');
    box.innerHTML = '';
    if (!this.kept.list.length) {
      box.innerHTML = '<span class="ws-dim">מה שבונים נשמר כאן</span>';
      return;
    }
    for (const d of this.kept.list) {
      const c = this.thumb(d);
      c.title = d.name || '';
      c.addEventListener('click', () => {
        this.useDesign(d);
        this.game.audio.play('pageflip', 0.35);
        this.read(false);
        this.mark();
        this.render();
      });
      box.appendChild(c);
    }
  }

  useDesign(d) {
    this.strokes = d.strokes.map((s) => ({ type: s.type, fixed: true, pts: s.pts.map((p) => p.slice()) }));
    this.color = d.color || 0;
  }

  // ------------------------------------------------------------------ into the city
  make() {
    const g = this.game;
    const S = this.spec;
    if (!S || !S.ok) {
      g.audio.play('meh', 0.4);
      return;
    }
    if (g.ink && g.ink.level < S.cost) {
      g.audio.play('meh', 0.4);
      g.hud.toast(`חסר דיו: צריך ${S.cost}, יש ${Math.floor(g.ink.level)}. הוא חוזר לבד עם הזמן`, 'bad', 2.6);
      return;
    }
    const P = g.player;
    // in front of you, where there is room for it (else beside you)
    const yaw = P.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const need = Math.max(S.L / 2, (S.W + 1) / 2) + 1.2;
    let at = null;
    for (const d of [need + 1.5, need + 3, need + 5]) {
      for (const side of [0, 1, -1]) {
        const a = Math.atan2(fx, fz) + side * 0.7;
        const x = P.pos.x + Math.sin(a) * d;
        const z = P.pos.z + Math.cos(a) * d;
        if (!g.world.collision.pointInside(x, 1.0, z, need * 0.7) && !g.world.collision.pointInside(x, 0.4, z, need * 0.7)) {
          at = [x, z];
          break;
        }
      }
      if (at) break;
    }
    if (!at) {
      g.audio.play('meh', 0.4);
      g.hud.toast('אין כאן מקום בשבילו: צאו למקום פתוח, כמו כביש או חוף', 'bad', 2.6);
      return;
    }
    const d = this.design();
    // (sideways to you, so you see what you made)
    const v = spawnDrawn(g, d, at[0], at[1], yaw + Math.PI / 2);
    if (!v) return;
    if (g.ink) g.ink.use(S.cost, 1);
    // kept, the newest first (the same drawing not twice)
    const rec = { strokes: v.drawn.strokes, color: this.color, name: S.label };
    const key = JSON.stringify(rec.strokes);
    this.kept.list = [rec, ...this.kept.list.filter((o) => JSON.stringify(o.strokes) !== key)].slice(0, 6);
    keep(this.kept);
    this.renderKept();
    this.close();
    g.fx.crumbs(at[0], 1, at[1], 30, 5);
    g.fx.smoke(at[0], 0.8, at[1], 3);
    g.audio.play('magic', 0.8);
    g.audio.play('plop', 0.7);
    g.hud.toast(`${S.label} מוכן! ${g.touch ? 'כפתור הרכב' : 'E'} כדי להיכנס`, 'good', 3.2);
  }

  // (game/game.js enterVehicle) in one drawn here: how it goes, the first time for each kind
  onEnter(v) {
    const k = v.spec && v.spec.kind;
    if (!k || (this.told || (this.told = {}))[k]) return;
    this.told[k] = true;
    const g = this.game;
    const t = g.touch
      ? { car: 'הג׳ויסטיק: נוסעים', glider: 'קפיצה מרמפה: והוא גולש', jetcar: 'החזיקו את המקל קדימה עד הסוף: טורבו', copter: '▲▼: למעלה ולמטה', plane: 'גז עד הסוף על כביש ישר, ואז ▲: האף למעלה' }[k]
      : TIP[k];
    if (t) g.hud.toast(t, 'info', 3.6);
  }

  // a drawn one from a save (game/save.js)
  respawn(d, x, z, yaw) {
    const v = spawnDrawn(this.game, { strokes: d.strokes, color: d.color }, x, z, yaw);
    if (v) v.reveal = 1;
    return v;
  }

  // (every frame, game/game.js) a drawn one driven: the try counted (ui/inkpen.js); its jets
  update(dt) {
    const g = this.game;
    const v = g.player.inVehicle;
    if (!v || !v.drawn || v.dead) return;
    if (dt > 0) jetFlames(g, v, dt);
    if (!this.drove && (v.speedAbs > 5 || (v.flies && v.alt > 3))) {
      this.drove = true;
      if (g.inkpen) g.inkpen.tried('drove');
    }
  }
}
