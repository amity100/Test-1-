import * as THREE from 'three';
import { INKS, INK_ORDER } from '../game/inkworld.js';

// (ROADMAP 11.6, the test of "the line becomes matter") The pen on the world: Q (on a phone the
// pencil button, on a gamepad up on the cross).
//
// Out comes the pen and the city slows almost to a stop; the camera stands back a step, higher.
// The mouse (a finger, the gamepad's pencil) draws on the city itself: the line lies on whatever
// it was drawn over, and while it is drawn a word by the pen says what it is becoming and what ink
// it will take, and its shape stands there faintly (game/inkworld.js reads it). Lifted, the line
// becomes the thing - or, when it can become nothing, says why and is rubbed out.
//   1-4 or the wheel: the ink (pencil, rubber, ice, glue); Backspace: the last thing taken back,
//   half its ink with it; the right button dragged (two fingers): the camera turns; Q, Esc: away.
// The first time, a card says what lines become ("?" brings it back); the card of tries - six
// things to do with it - is kept by the side, and what was done stays done (this browser's).

const $ = (id) => document.getElementById(id);
const TIPS_KEY = 'sc5-pen-tips';
const DONE_KEY = 'sc5-pen-done';
// how slow the city goes while the pen is out
const SLOW = 0.12;
// no more points to a line than this
const MAXP = 600;
const WHAT = { pencil: 'מוצק', rubber: 'מקפיץ', ice: 'מחליק', glue: 'תופס' };
const BAD = '#e2335f';
const WALL_H = { pencil: 2.6, rubber: 2.1 };

export const TRIES = [
  { id: 'wallStop', text: 'לעצור ניידת משטרה בקיר, בדבק או בקרח' },
  { id: 'rampJump', text: 'לקפוץ ברכב מרמפה שציירתם' },
  { id: 'bridge', text: 'לעבור על גשר שציירתם' },
  { id: 'up', text: 'לעלות לגג בעזרת ציור: עמוד, סולם, מדרגות או טרמפולינה' },
  { id: 'caged', text: 'ללכוד מישהו בעיגול' },
  { id: 'drove', text: 'לנסוע בכלי רכב שתכננתם בסדנה' },
];

// the little drawings on the card: the world in grey, the line in the pen's pink, what it becomes
// dashed
const ICON = {
  wall: '<path class="w" d="M8 37 22 5M56 37 42 5"/><path class="d" d="M15 26v-10h34v10"/><path class="l" d="M14 26h36"/>',
  ramp: '<path class="w" d="M3 35h58"/><path class="d" d="M12 35h30V22z"/><path class="l" d="M8 35c14-1 26-6 34-14s12-14 14-17"/>',
  bridge: '<path class="w" d="M3 39V15h15v24M46 39V11h15v28"/><path class="d" d="M18 18l28-4"/><path class="l" d="M18 15c10-3 20-3 28-4"/>',
  ladder: '<path class="w" d="M14 39V3h34v36"/><path class="d" d="M27 33h8M27 25h8M27 17h8M27 9h8"/><path class="l" d="M31 37V5"/>',
  cage: '<path class="w" d="M32 13a3.2 3.2 0 1 0 .01 0M32 19v9M32 28l-4 7M32 28l4 7M26 22h12"/><path class="l" d="M32 5c9 0 14 7 14 17s-5 16-14 16-14-7-14-16S23 5 33 6"/>',
  pillar: '<path class="w" d="M2 36h60M42 36V5h18v31"/><path class="d" d="M16 34V9M34 34V9M16 9c0-3 18-3 18 0"/><path class="l" d="M25 31c6 0 10 1.5 10 3s-4 3-10 3-10-1.5-10-3 4-3.2 11-3"/>',
};

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch (err) {
    return null;
  }
}

function keep(key, v) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch (err) {
    // (a private window: kept for this time only)
  }
}

const _p = new THREE.Vector3();

export class InkPen {
  constructor(game) {
    this.game = game;
    this.world = game.inkWorld;
    this.el = $('inkpen');
    this.open = false;
    // how far into the pen (0..1): the slowing down, the camera's step back
    this.k = 0;
    this.ink = 'pencil';
    // the line being drawn: { ink, pts (screen), hits (where each landed), len }
    this.cur = null;
    // lines going: made (into the thing) or not (rubbed out)
    this.gone = [];
    // what the line is becoming, as it is drawn
    this.plan = null;
    this.readAt = 0;
    this.tagUntil = 0;
    this.pointers = new Map();
    this.turn = null;
    this.cw = 0;
    this.ch = 0;
    this.dpr = 1;
    this.cardOpen = false;
    this.done = load(DONE_KEY) || {};
    // (what is done already is not said again)
    for (const t of TRIES) if (this.done[t.id]) this.world.done[t.id] = true;
    this.world.onDone = (id) => this.tried(id);
    this.build();
    this.bind();
  }

  get slow() {
    return 1 - this.k * (1 - SLOW);
  }

  // ------------------------------------------------------------------ the page over the city
  build() {
    const el = this.el;
    const inks = INK_ORDER.map(
      (id, i) => `<button class="ip-ink" data-ink="${id}" style="--c:${INKS[id].css}" aria-label="${INKS[id].name}"><i></i><b>${INKS[id].name}</b><small>${WHAT[id]}</small><kbd>${i + 1}</kbd></button>`,
    ).join('');
    el.innerHTML = `<canvas id="ip-canvas"></canvas>
      <div id="ip-head">
        <div id="ip-title">העט על העולם</div>
        <div id="ip-ink" aria-label="דיו"><i id="ip-ink-fill"></i><i id="ip-ink-cost"></i></div>
        <div id="ip-hint"></div>
      </div>
      <div id="ip-tag" class="hidden"></div>
      <div id="ip-inks">${inks}</div>
      <div id="ip-side">
        <button class="ip-btn" id="ip-close">✕ חזרה <kbd>Q</kbd></button>
        <button class="ip-btn" id="ip-undo">↶ ביטול <kbd>⌫</kbd></button>
        <button class="ip-btn" id="ip-help">? איך מציירים</button>
        <button class="ip-btn" id="ip-album">שרטוטים <kbd>T</kbd></button>
        <button class="ip-btn" id="ip-shop">סדנה <kbd>B</kbd></button>
      </div>
      <div id="ip-tries" class="sticky"></div>
      <div id="ip-card" class="hidden"></div>`;
    this.canvas = $('ip-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.tagEl = $('ip-tag');
    this.hintEl = $('ip-hint');
    this.inkEl = $('ip-ink');
    this.fillEl = $('ip-ink-fill');
    this.costEl = $('ip-ink-cost');
    this.triesEl = $('ip-tries');
    this.cardEl = $('ip-card');
    this.inkBtns = [...el.querySelectorAll('.ip-ink')];
    this.renderTries();
    this.renderInks();
  }

  bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointermove', (e) => this.move(e));
    c.addEventListener('pointerup', (e) => this.up(e, false));
    c.addEventListener('pointercancel', (e) => this.up(e, true));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    for (const b of this.inkBtns) b.addEventListener('click', () => this.pick(b.dataset.ink));
    $('ip-close').addEventListener('click', () => this.close());
    $('ip-undo').addEventListener('click', () => this.undo());
    $('ip-help').addEventListener('click', () => this.tips(true));
    $('ip-album').addEventListener('click', () => {
      this.close(false);
      this.game.openDraw();
    });
    $('ip-shop').addEventListener('click', () => this.toShop());
    this.triesEl.addEventListener('click', () => this.triesEl.classList.toggle('open'));
    window.addEventListener('keydown', (e) => this.key(e));
    window.addEventListener('resize', () => {
      if (this.open) this.resize();
    });
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (W === this.cw && H === this.ch && dpr === this.dpr) return;
    this.cw = W;
    this.ch = H;
    this.dpr = dpr;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
  }

  // ------------------------------------------------------------------ out and away
  can() {
    const g = this.game;
    const p = g.player;
    if (g.state !== 'play' || g.phoneCam) return false;
    if (g.airdraw.open || g.album.open || g.dialog.open || (g.paintshop && g.paintshop.open) || (g.sketchpad && g.sketchpad.open) || (g.workshop && g.workshop.open) || (g.citymap && g.citymap.open) || (g.wheel && g.wheel.open)) return false;
    if (p.mode !== 'foot' && p.mode !== 'vehicle' && p.mode !== 'swim' && p.mode !== 'climb') {
      g.hud.toast('לא עכשיו', 'info', 1.2);
      return false;
    }
    return true;
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  show() {
    if (this.open || !this.can()) return;
    const g = this.game;
    this.open = true;
    this.el.classList.remove('hidden');
    // (the phone's buttons put away under the page: a finger there draws)
    document.body.classList.add('pen-open');
    g.input.releaseLock();
    g.input.fire = false;
    this.resize();
    this.renderInks();
    this.renderTries();
    this.hint();
    $('ip-shop').classList.toggle('hidden', !g.workshop);
    g.audio.play('pageflip', 0.45);
    if (g.pad && g.pad.active) g.pad.startDrawing();
    if (!load(TIPS_KEY)) this.tips(true);
    // (looking a little down: the street to draw on)
    this.tilt = true;
  }

  // relock: back into the game with the mouse taken (not when another page opens from here)
  close(relock = true) {
    if (!this.open) return;
    const g = this.game;
    if (this.cur) this.drop();
    this.open = false;
    this.turn = null;
    this.pointers.clear();
    this.gone = [];
    this.plan = null;
    this.tips(false);
    this.el.classList.add('hidden');
    this.tagEl.classList.add('hidden');
    document.body.classList.remove('pen-open');
    g.audio.play('pageflip', 0.3);
    if (relock && !g.touch && g.state === 'play') g.input.requestLock(true);
  }

  toShop() {
    const g = this.game;
    if (!g.workshop) return;
    if (g.player.inVehicle) {
      g.hud.toast('את הסדנה פותחים ברגל: צאו מהרכב (E)', 'info', 2);
      return;
    }
    this.close(false);
    g.workshop.show();
  }

  // ------------------------------------------------------------------ the inks
  pick(id) {
    if (!INKS[id] || this.cardOpen) return;
    if (id !== this.ink) this.game.audio.play('pop', 0.35);
    this.ink = id;
    if (this.cur) {
      this.cur.ink = id;
      this.cur.dirty = true;
    }
    this.renderInks();
  }

  cycle(d) {
    const i = INK_ORDER.indexOf(this.ink);
    this.pick(INK_ORDER[(i + d + INK_ORDER.length) % INK_ORDER.length]);
  }

  renderInks() {
    for (const b of this.inkBtns) b.classList.toggle('sel', b.dataset.ink === this.ink);
    this.el.style.setProperty('--pen', INKS[this.ink].css);
  }

  // a word under the title: what to try, by where you are
  hint() {
    const g = this.game;
    const p = g.player;
    const chased = g.police && g.police.level > 0;
    let h;
    if (p.inVehicle && chased) h = 'ניידת מאחוריכם? קו לרוחב הכביש מאחור, והיא נתקעת בו';
    else if (chased) h = 'שוטרים בדרך? עיגול סביבם, או קיר ביניכם';
    else if (p.inVehicle) h = 'קו מהכביש כלפי מעלה: רמפה · קו לרוחב הכביש: קיר';
    else if (p.pos.y > 4) h = 'על גג: קו אל הגג הבא הוא גשר';
    else h = 'קו על הקרקע: קיר · עיגול סביב מישהו: כלוב · עיגול ליד בניין: עמוד עד הגג';
    this.hintEl.textContent = h;
  }

  // ------------------------------------------------------------------ the mouse, the fingers
  down(e) {
    if (!this.open || this.cardOpen) return;
    e.preventDefault();
    const mouse = e.pointerType === 'mouse';
    if (mouse && e.button === 2) {
      // the right button: the camera turns
      this.turn = { id: e.pointerId, x: e.clientX, y: e.clientY };
      this.capture(e);
      return;
    }
    if (mouse && e.button !== 0) return;
    this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (!mouse && this.pointers.size >= 2) {
      // a second finger: not a line, the camera turning
      if (this.cur) this.drop();
      const m = this.mid();
      this.turn = { two: true, x: m[0], y: m[1] };
      return;
    }
    this.capture(e);
    this.penDown(e.clientX, e.clientY);
    // (the line is this pointer's: another one moving meanwhile - the mouse beside a finger - adds
    // nothing to it)
    if (this.cur) this.cur.pid = e.pointerId;
  }

  move(e) {
    if (!this.open) return;
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
    const T = this.turn;
    if (T) {
      if (T.two) {
        const m = this.mid();
        this.look(m[0] - T.x, m[1] - T.y, 1.8);
        T.x = m[0];
        T.y = m[1];
      } else if (e.pointerId === T.id) {
        this.look(e.clientX - T.x, e.clientY - T.y, 1);
        T.x = e.clientX;
        T.y = e.clientY;
      }
      return;
    }
    if (!this.cur || e.pointerId !== this.cur.pid) return;
    e.preventDefault();
    let evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    if (!evs.length) evs = [e];
    let moved = 0;
    for (const ev of evs) moved += this.penMove(ev.clientX, ev.clientY);
    if (moved) this.game.audio.scratch(moved * 0.5);
  }

  up(e, cancel) {
    this.pointers.delete(e.pointerId);
    if (this.turn) {
      if (this.turn.two ? this.pointers.size < 2 : e.pointerId === this.turn.id) this.turn = null;
      return;
    }
    if (!this.cur || e.pointerId !== this.cur.pid) return;
    if (cancel) this.drop();
    else this.penUp();
  }

  capture(e) {
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      // (synthetic pointers may not be capturable)
    }
  }

  mid() {
    let x = 0;
    let y = 0;
    for (const p of this.pointers.values()) {
      x += p[0];
      y += p[1];
    }
    const n = Math.max(1, this.pointers.size);
    return [x / n, y / n];
  }

  look(dx, dy, k) {
    this.game.camRig.applyLook(dx * k, dy * k);
    this.tilt = false;
  }

  key(e) {
    if (!this.open) return;
    const inp = this.game.input;
    const c = e.code;
    if (this.cardOpen) {
      if (c === 'Escape' || c === 'Enter' || c === 'Space') {
        inp.pressed.delete(c);
        this.tips(false);
      }
      return;
    }
    if (c === 'Escape') {
      inp.pressed.delete('Escape');
      this.close();
    } else if (/^Digit[1-4]$/.test(c)) {
      inp.pressed.delete(c);
      this.pick(INK_ORDER[Number(c[5]) - 1]);
    } else if (c === 'Backspace' || (c === 'KeyZ' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      this.undo();
    }
  }

  // ------------------------------------------------------------------ the line
  // (also the gamepad's pencil: core/gamepad.js)
  penDown(x, y) {
    if (!this.open || this.cardOpen) return;
    const g = this.game;
    if (g.ink && g.ink.dry) {
      this.say('אין דיו! הוא חוזר לבד עם הזמן, או בקבוק בחנות לכלי כתיבה', x, y, 'bad');
      g.audio.play('meh', 0.4);
      return;
    }
    this.cur = { ink: this.ink, pts: [], hits: [], len: 0, dirty: true, pid: -1 };
    this.plan = null;
    this.addPt(x, y);
    g.audio.scratchStart();
  }

  penMove(x, y) {
    const c = this.cur;
    if (!c) return 0;
    const l = c.pts[c.pts.length - 1];
    const d = Math.hypot(x - l[0], y - l[1]);
    if (d < 5) return 0;
    // (a long way in one move, a slow frame: the points between it too, so it lands all along)
    const n = Math.min(10, Math.floor(d / 16));
    for (let k = 1; k <= n; k++) this.addPt(l[0] + ((x - l[0]) * k) / (n + 1), l[1] + ((y - l[1]) * k) / (n + 1));
    this.addPt(x, y);
    c.len += d;
    return d;
  }

  addPt(x, y) {
    const c = this.cur;
    if (c.pts.length >= MAXP) return;
    c.pts.push([x, y]);
    c.hits.push(this.world.hitAt(x, y));
    c.dirty = true;
  }

  penUp() {
    const c = this.cur;
    if (!c) return;
    this.cur = null;
    this.game.audio.scratchStop();
    const plan = c.pts.length > 2 ? this.world.read(c.pts, c.hits, c.ink) : { why: 'קצר מדי' };
    this.land(c, plan);
  }

  // the line let go of (a second finger, the pen put away): nothing made
  drop() {
    const c = this.cur;
    if (!c) return;
    this.cur = null;
    this.plan = null;
    this.game.audio.scratchStop();
    this.gone.push({ c, t: 0, ok: false, quiet: true });
    this.tagEl.classList.add('hidden');
    this.renderCost(0);
  }

  // the pen lifted: the line becomes what it was read as, or is rubbed out with the reason
  land(c, plan) {
    const g = this.game;
    const end = c.pts[c.pts.length - 1];
    this.plan = null;
    this.renderCost(0);
    if (!plan.why && g.ink && g.ink.level + 0.01 < plan.cost) plan = { why: `חסר דיו: צריך ${plan.cost}, יש ${Math.floor(g.ink.level)}`, dry: true };
    if (plan.why) {
      this.gone.push({ c, t: 0, ok: false });
      this.say(plan.why, end[0], end[1], 'bad');
      g.audio.play('meh', 0.3);
      this.world.stats.failed++;
      if (plan.dry) {
        this.inkEl.classList.remove('flash');
        void this.inkEl.offsetWidth;
        this.inkEl.classList.add('flash');
      }
      return;
    }
    if (g.ink) g.ink.use(plan.cost, 1);
    this.world.make(plan);
    this.gone.push({ c, t: 0, ok: true, plan });
    this.say(`${plan.label}!`, end[0], end[1], 'good');
  }

  undo() {
    if (!this.open || this.cardOpen) return;
    const g = this.game;
    if (this.cur) {
      this.drop();
      return;
    }
    if (this.world.undo()) {
      g.audio.play('erase', 0.5);
      g.hud.toast('נמחק. חצי מהדיו חזר', 'info', 1.4);
    } else g.audio.play('meh', 0.25);
  }

  // a word by the pen (kind: '' as it is drawn, 'soft' - not yet anything, 'dear' - not ink enough
  // for it; 'good', 'bad' when it is lifted)
  say(text, x, y, kind = '') {
    const el = this.tagEl;
    el.textContent = text;
    el.className = kind;
    this.place(x, y);
    this.tagUntil = kind === 'good' ? performance.now() + 1300 : kind === 'bad' ? performance.now() + 2200 : Infinity;
  }

  place(x, y) {
    const W = this.cw || window.innerWidth;
    this.tagEl.style.transform = `translate(${Math.round(Math.min(Math.max(8, x + 18), W - 260))}px, ${Math.round(Math.max(60, y - 46))}px)`;
  }

  // the ink it will take, over the pen's bar
  renderCost(n) {
    const g = this.game;
    if (!g.ink) return;
    const cap = g.ink.cap;
    const lv = g.ink.level;
    const k = Math.round((lv / cap) * 1000) / 10;
    if (k !== this.shownLv) {
      this.shownLv = k;
      this.fillEl.style.width = `${k}%`;
    }
    const key = `${n}|${k}`;
    if (key === this.shownCost) return;
    this.shownCost = key;
    // (the end of what is in the pen: the part this one would take; all of it red, not enough)
    const cw = Math.min(Math.round((n / cap) * 1000) / 10, k);
    this.costEl.style.width = `${cw}%`;
    this.costEl.style.right = `${Math.max(0, k - cw)}%`;
    this.costEl.classList.toggle('over', n > lv);
    this.costEl.classList.toggle('hidden', !n);
  }

  // ------------------------------------------------------------------ the card, the tries
  tips(on) {
    const g = this.game;
    if (on === this.cardOpen) return;
    this.cardOpen = on;
    if (on) {
      if (this.cur) this.drop();
      this.cardEl.innerHTML = this.cardHTML();
      this.cardEl.classList.remove('hidden');
      $('ip-go').addEventListener('click', () => this.tips(false));
      g.audio.play('pageflip', 0.4);
    } else {
      this.cardEl.classList.add('hidden');
      keep(TIPS_KEY, 1);
    }
  }

  cardHTML() {
    const touch = this.game.touch;
    const row = (ico, a, b) => `<div class="ip-row"><svg class="ip-ico" viewBox="0 0 64 40" aria-hidden="true">${ICON[ico]}</svg><div><b>${a}</b><span>${b}</span></div></div>`;
    const inks = INK_ORDER.map((id) => `<span style="--c:${INKS[id].css}"><i></i>${INKS[id].name}: ${{ pencil: 'מוצק', rubber: 'מקפיץ ומעיף אחורה', ice: 'מחליק', glue: 'תופס במקום' }[id]}</span>`).join('');
    const keys = touch
      ? 'אצבע אחת מציירת · שתי אצבעות מסובבות את המצלמה · ✕ חוזרים למשחק'
      : 'Q פותח וסוגר · 1–4 או הגלגלת: דיו · Backspace: ביטול · גרירה עם הכפתור הימני: מצלמה';
    return `<div class="ip-sheet paper-card">
      <div class="ip-card-title">העט על העולם</div>
      <div class="ip-card-sub">מה שמציירים על העיר הופך לחומר אמיתי. המקום והצורה של הקו קובעים מה ייבנה. הזמן כמעט עוצר בינתיים.</div>
      <div class="ip-rows">
        ${row('wall', 'קו על הכביש ← קיר', 'ניידת שדוהרת לעברו מתנגשת בו')}
        ${row('ramp', 'קו מהכביש כלפי מעלה ← רמפה', 'ככל שהקו עולה גבוה יותר, הרמפה גבוהה יותר')}
        ${row('bridge', 'קו מגג לגג, או מעל המים ← גשר', 'מגג גבוה לנמוך: ירידה · תלול: מדרגות')}
        ${row('ladder', 'קו על קיר של בניין, מלמטה למעלה ← סולם', 'מטפסים בו עד הגג')}
        ${row('cage', 'עיגול סביב מישהו או סביב מכונית ← כלוב', 'בדבק: נדבק למקום · בקרח: גוש קרח')}
        ${row('pillar', 'עיגול על הקרקע ← עמוד שעולה', 'ליד בניין הוא עולה עד הגג · בגומי: טרמפולינה')}
      </div>
      <div class="ip-card-inks">${inks}</div>
      <div class="ip-card-keys">${keys}</div>
      <div class="ip-card-foot"><span>כל ציור עולה דיו (הוא חוזר לבד), ומחזיק זמן מה עד שהוא נמחק.</span><button class="btn primary" id="ip-go">בואו נצייר!</button></div>
    </div>`;
  }

  renderTries() {
    const n = TRIES.filter((t) => this.done[t.id]).length;
    const key = TRIES.map((t) => (this.done[t.id] ? 1 : 0)).join('') + (this.game.workshop ? 'w' : '');
    if (key === this.triesKey) return;
    this.triesKey = key;
    const rows = TRIES.filter((t) => t.id !== 'drove' || this.game.workshop)
      .map((t) => `<div class="g${this.done[t.id] ? ' done' : ''}"><span class="box"></span><span>${t.text}</span></div>`)
      .join('');
    this.triesEl.innerHTML = `<h4>ניסוי · ${n} מתוך ${this.game.workshop ? TRIES.length : TRIES.length - 1}</h4>${rows}`;
  }

  // one of the tries done (game/inkworld.js note; game/workshop.js for the drive)
  tried(id) {
    if (this.done[id]) return;
    const T = TRIES.find((t) => t.id === id);
    if (!T) return;
    this.done[id] = true;
    keep(DONE_KEY, this.done);
    const g = this.game;
    const all = TRIES.filter((t) => t.id !== 'drove' || g.workshop);
    const n = all.filter((t) => this.done[t.id]).length;
    g.audio.play('ding', 0.7);
    g.hud.toast(`✓ ${T.text} (${n} מתוך ${all.length})`, 'good', 3);
    if (n === all.length) {
      g.audio.play('cheer', 0.8);
      g.hud.toast('כל הניסויים בוצעו! מכאן זה רק משחק', 'good', 4);
      const P = g.player.inVehicle ? g.player.inVehicle.pos : g.player.pos;
      g.fx.confetti(P.x, P.y + 2, P.z, 40, 6);
    }
    this.renderTries();
  }

  // ------------------------------------------------------------------ every frame
  // (before the city's update: real dt) the slowing down, the wheel, the tilt
  update(dt) {
    const g = this.game;
    if (this.open && g.state !== 'play') this.close(false);
    const want = this.open ? 1 : 0;
    if (this.k !== want) {
      const step = dt / (this.open ? 0.22 : 0.16);
      this.k = want > this.k ? Math.min(want, this.k + step) : Math.max(want, this.k - step);
    }
    if (!this.open) return;
    const inp = g.input;
    if (inp.wheel) {
      if (!this.cardOpen) this.cycle(Math.sign(inp.wheel));
      inp.wheel = 0;
    }
    // (looking a little down, the street to draw on: once, as it opens)
    if (this.tilt) {
      const R = g.camRig;
      const goal = g.player.inVehicle ? -0.3 : -0.36;
      if (R.pitch > goal + 0.01) R.pitch += (goal - R.pitch) * (1 - Math.exp(-dt * 9));
      else this.tilt = false;
      if (this.k >= 1 && Math.abs(R.pitch - goal) < 0.02) this.tilt = false;
    }
  }

  // (after the camera: the lines where they lie on the city now)
  frame(dt) {
    if (!this.open) return;
    const g = this.game;
    const now = performance.now();
    const c = this.cur;
    // what the line is becoming, read again every tenth of a second while it grows
    if (c && c.dirty && now - this.readAt > 100) {
      c.dirty = false;
      this.readAt = now;
      this.plan = c.pts.length >= 3 ? this.world.read(c.pts, c.hits, c.ink) : null;
      const l = c.pts[c.pts.length - 1];
      const P = this.plan;
      if (!P || (P.why && c.len < 70)) {
        this.tagEl.classList.add('hidden');
        this.renderCost(0);
      } else if (P.why) {
        this.say(P.why, l[0], l[1], 'soft');
        this.renderCost(0);
      } else {
        const dear = g.ink && P.cost > g.ink.level;
        this.say(`${P.label} · ${P.cost} דיו${dear ? ' (אין מספיק)' : ''}`, l[0], l[1], dear ? 'dear' : '');
        this.renderCost(P.cost);
      }
    } else if (!c) {
      if (now > this.tagUntil) this.tagEl.classList.add('hidden');
      this.renderCost(0);
    } else if (c.pts.length) {
      // (the word goes along with the pen)
      const l = c.pts[c.pts.length - 1];
      if (!this.tagEl.classList.contains('hidden')) this.place(l[0], l[1]);
    }
    this.draw(dt);
  }

  draw(dt) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cw, this.ch);
    const rdt = Math.min(0.05, dt > 0 ? dt / Math.max(this.slow, 0.05) : 0.016);
    for (const G of this.gone) {
      G.t += rdt;
      const dur = G.ok ? 0.45 : G.quiet ? 0.25 : 0.8;
      const k = Math.min(1, G.t / dur);
      if (G.ok) this.stroke(G.c, INKS[G.c.ink].css, 1 - k, 1 - k * 0.7, 0);
      else this.stroke(G.c, G.quiet ? INKS[G.c.ink].css : BAD, (1 - k) * (G.quiet ? 0.6 : 1), 1, G.quiet ? 0 : Math.sin(G.t * 46) * 5 * (1 - k));
    }
    this.gone = this.gone.filter((G) => G.t < (G.ok ? 0.45 : G.quiet ? 0.25 : 0.8));
    const c = this.cur;
    if (!c) return;
    const P = this.plan;
    const ink = this.game.ink;
    if (P && !P.why) this.preview(P, ink && P.cost > ink.level ? BAD : INKS[c.ink].css);
    this.stroke(c, INKS[c.ink].css, 1, 1, 0);
  }

  // the screen point of a world point (null behind the camera)
  scr(x, y, z) {
    _p.set(x, y, z).project(this.game.camera);
    if (_p.z > 1 || _p.z < -1) return null;
    return [((_p.x + 1) / 2) * this.cw, ((1 - _p.y) / 2) * this.ch];
  }

  // a line where it landed on the city (the bits over the sky dashed, lighter)
  stroke(c, css, alpha, wk, shake) {
    if (alpha <= 0.01 || c.hits.length < 1) return;
    const ctx = this.ctx;
    const touch = this.game.touch;
    const W = (touch ? 5.5 : 4.5) * wk;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pts = [];
    for (let i = 0; i < c.hits.length; i++) {
      const h = c.hits[i];
      const s = this.scr(h.p.x, h.p.y, h.p.z);
      pts.push(s ? [s[0] + shake, s[1], h.kind === 'sky'] : null);
    }
    // the paper's halo under it, then the ink
    for (const pass of [0, 1]) {
      ctx.globalAlpha = alpha * (pass ? 1 : 0.55);
      ctx.strokeStyle = pass ? css : 'rgba(255, 250, 238, 0.95)';
      ctx.lineWidth = pass ? W : W + 4;
      let open = false;
      let sky = null;
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i];
        if (!q) {
          if (open) ctx.stroke();
          open = false;
          continue;
        }
        if (!open || q[2] !== sky) {
          if (open) {
            ctx.lineTo(q[0], q[1]);
            ctx.stroke();
          }
          ctx.setLineDash(q[2] && pass ? [9, 7] : []);
          ctx.globalAlpha = alpha * (pass ? (q[2] ? 0.7 : 1) : 0.55);
          ctx.beginPath();
          const pq = open ? pts[i - 1] : q;
          ctx.moveTo(pq[0], pq[1]);
          open = true;
          sky = q[2];
        }
        ctx.lineTo(q[0], q[1]);
      }
      if (open) ctx.stroke();
      if (pts.length === 1 && pts[0]) {
        ctx.beginPath();
        ctx.arc(pts[0][0], pts[0][1], W / 2, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      }
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // the shape of what it is becoming, faint, where it will stand
  preview(P, css) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = css;
    ctx.fillStyle = css;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    const poly = (pts, fill) => {
      const s = [];
      for (const q of pts) {
        const r = this.scr(q[0], q[1], q[2]);
        if (!r) return;
        s.push(r);
      }
      ctx.beginPath();
      ctx.moveTo(s[0][0], s[0][1]);
      for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0], s[i][1]);
      ctx.closePath();
      if (fill) {
        ctx.globalAlpha = 0.22;
        ctx.fill();
      }
      // (the paper's halo under its edges, then the ink, dashed: not there yet)
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = 'rgba(255, 250, 238, 0.95)';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.setLineDash([7, 5]);
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = css;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    };
    const ring = (x, y, z, r, n = 22) => {
      const pts = [];
      for (let i = 0; i < n; i++) pts.push([x + Math.cos((i / n) * Math.PI * 2) * r, y, z + Math.sin((i / n) * Math.PI * 2) * r]);
      return pts;
    };
    if (P.type === 'wall') {
      const H = WALL_H[P.ink] || 2.6;
      const base = Math.min(...P.pts.map((q) => q[1]));
      for (let i = 1; i < P.pts.length; i++) {
        const a = P.pts[i - 1];
        const b = P.pts[i];
        poly([[a[0], base, a[2]], [b[0], base, b[2]], [b[0], base + H, b[2]], [a[0], base + H, a[2]]], true);
      }
    } else if (P.type === 'strip') {
      for (let i = 1; i < P.pts.length; i++) {
        const a = P.pts[i - 1];
        const b = P.pts[i];
        const dx = b[0] - a[0];
        const dz = b[2] - a[2];
        const L = Math.hypot(dx, dz) || 1;
        const rx = (dz / L) * (P.w / 2);
        const rz = (-dx / L) * (P.w / 2);
        poly([[a[0] + rx, a[1] + 0.05, a[2] + rz], [b[0] + rx, b[1] + 0.05, b[2] + rz], [b[0] - rx, b[1] + 0.05, b[2] - rz], [a[0] - rx, a[1] + 0.05, a[2] - rz]], true);
      }
    } else if (P.type === 'ramp') {
      const fx = Math.sin(P.yaw);
      const fz = Math.cos(P.yaw);
      const rx = fz * (P.w / 2);
      const rz = -fx * (P.w / 2);
      const ex = P.x + fx * P.len;
      const ez = P.z + fz * P.len;
      poly([[P.x + rx, P.y, P.z + rz], [ex + rx, P.y + P.h, ez + rz], [ex - rx, P.y + P.h, ez - rz], [P.x - rx, P.y, P.z - rz]], true);
      poly([[ex + rx, P.y, ez + rz], [ex + rx, P.y + P.h, ez + rz], [ex - rx, P.y + P.h, ez - rz], [ex - rx, P.y, ez - rz]], false);
    } else if (P.type === 'bridge') {
      const [ax, ay, az] = P.a;
      const [bx, by, bz] = P.b;
      const dx = bx - ax;
      const dz = bz - az;
      const L = Math.hypot(dx, dz) || 1;
      const rx = (dz / L) * (P.w / 2);
      const rz = (-dx / L) * (P.w / 2);
      poly([[ax + rx, ay, az + rz], [bx + rx, by, bz + rz], [bx - rx, by, bz - rz], [ax - rx, ay, az - rz]], true);
    } else if (P.type === 'pad') {
      poly(ring(P.x, P.y + 0.05, P.z, P.r), true);
      if (P.kind === 'pillar' || P.kind === 'tramp') {
        const top = P.y + (P.h || 0.5);
        poly(ring(P.x, top, P.z, P.r), false);
        for (const s of [-1, 1]) {
          const a = this.scr(P.x + s * P.r, P.y, P.z);
          const b = this.scr(P.x + s * P.r, top, P.z);
          if (a && b) {
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
          }
        }
      }
    } else if (P.type === 'cage') {
      for (const T of P.targets) {
        const o = T.o.pos;
        const R = T.kind === 'car' ? Math.max(2.4, (T.o.halfLen || 2.3) + 0.5) : 0.8;
        const y = o.y || 0;
        poly(ring(o.x, y + 0.05, o.z, R), true);
        poly(ring(o.x, y + 2.3, o.z, R), false);
      }
    } else if (P.type === 'ladder') {
      const s = P.s;
      const a = this.scr(s.x, s.y, s.z);
      const b = this.scr(s.x, s.top, s.z);
      if (a && b) {
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
