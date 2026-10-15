import * as THREE from 'three';
import { INKS, KINDS, WEAPON_ORDER, readFree, buildWeapon, statLine } from '../game/freeform.js';
import { spawnDrawn, jetFlames } from '../game/drawncar.js';
import { makeFrame, findSpot, localBox } from '../game/materialize.js';
import { angleDiff, clamp } from '../core/util.js';
import { groundHeight } from '../world/layout.js';

// (ROADMAP 11.6, 11.7) Drawing freehand in the air, on the run. Q (the pencil on a phone, up on a
// pad) and whatever is drawn goes straight on the screen, over the street - no page in the way.
// The game goes on all the while: WASD (the stick, under the left thumb) keep running, Shift still
// sprints, and the camera turns after where you run (the mouse is drawing). As it is drawn it is
// read (game/freeform.js, with game/sketchnet.js): a small tag by the drawing says what it is
// becoming and what it can do, and offers what else it could be. Q again (✓, a right click,
// Enter) and the drawing becomes the thing where it was drawn - a weapon hangs in the air beside
// you as it turns real, then flies into your hand; a vehicle stands in the street ahead.
// Esc (✕) puts the pen away, the drawing kept for later; Z (↶) takes the last line back. The
// inks: colour as you like (the mouse wheel; pencil is no colour - the thing gets one of its own;
// neon glows, and a gun drawn in it is a laser).

const $ = (id) => document.getElementById(id);
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();

// what it can be made into instead (the tag's menu): the vehicles by kind, the weapons
const VEH_CHOICES = [['v:car', 'מכונית'], ['v:truck', 'משאית'], ['v:bus', 'אוטובוס'], ['v:moto', 'אופנוע'], ['v:tank', 'טנק'], ['v:copter', 'מסוק'], ['v:plane', 'מטוס']];

export class FreeDraw {
  constructor(game) {
    this.game = game;
    this.el = $('freedraw');
    this.isOpen = false;
    this.strokes = [];
    this.cur = null;
    this.ink = 0;
    this.force = null;
    this.R = null;
    this.presenting = null;
    this.shutAt = -1e9;
    this.U = 300;
    this.stats = { opened: 0, made: {}, failed: 0 };
    this.build();
    this.bind();
  }

  get open() {
    return this.isOpen;
  }

  // the drawing's own unit (px): half the screen's shorter side, as big as the page it once had
  unit() {
    return Math.max(150, Math.min(window.innerWidth, window.innerHeight) * 0.5);
  }

  build() {
    const sw = INKS.map((c, i) => `<button class="fd-sw${c.neon ? ' neon' : ''}${c.pencil ? ' pencil' : ''}" data-i="${i}" style="--c:${c.css}" title="${c.name}" aria-label="${c.name}"></button>`).join('');
    const chips = [['', 'אוטומטי'], ...VEH_CHOICES, ...WEAPON_ORDER.map((k) => [k, KINDS[k].name])].map(([k, n]) => `<button class="fd-chip" data-k="${k}">${n}</button>`).join('');
    this.el.innerHTML = `<canvas id="fd-air"></canvas>
      <div class="fd-zone" id="fd-zone-a"></div><div class="fd-zone" id="fd-zone-b"></div>
      <div class="fd-hint" id="fd-hint"></div>
      <div class="fd-tag hidden" id="fd-tag">
        <button class="fd-kind" id="fd-kind" title="משהו אחר"><b id="fd-name"></b><span id="fd-stats"></span></button>
        <div class="fd-alts" id="fd-alts"></div>
        <div class="fd-menu hidden" id="fd-menu">${chips}</div>
      </div>
      <div class="fd-tools" id="fd-tools">
        <div class="fd-inks" id="fd-inks">${sw}</div>
        <button class="fd-btn fd-color" id="fd-color" aria-label="צבע"><i></i></button>
        <div class="fd-ink" aria-label="דיו"><i id="fd-ink-fill"></i><i id="fd-ink-cost"></i></div>
        <button class="fd-btn" id="fd-undo" title="ביטול הקו האחרון (Z)">↶</button>
        <button class="fd-btn" id="fd-clear" title="ניקוי (Delete)">נקה</button>
        <button class="fd-btn touch-only" id="fd-album">שרטוטים</button>
        <button class="fd-btn" id="fd-close" title="סגירה, הציור נשמר (Esc)">✕</button>
        <button class="fd-btn primary" id="fd-make">✓ צרו!</button>
      </div>`;
    this.cv = $('fd-air');
    this.g = this.cv.getContext('2d');
    this.tagEl = $('fd-tag');
    this.nameEl = $('fd-name');
    this.statsEl = $('fd-stats');
    this.altsEl = $('fd-alts');
    this.hintEl = $('fd-hint');
    this.toolsEl = $('fd-tools');
    this.makeBtn = $('fd-make');
    this.menuEl = $('fd-menu');
    this.inkFill = $('fd-ink-fill');
    this.inkCost = $('fd-ink-cost');
    this.colorBtn = $('fd-color');
    this.pickInk(0);
  }

  bind() {
    const game = this.game;
    // the pen: on the whole screen (a phone: all of it but the stick's corner, the thumb's)
    const down = (e) => {
      if (!this.isOpen || this.cur) return;
      e.preventDefault();
      if (e.button === 2) {
        this.make();
        return;
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {
        // (synthetic pointers)
      }
      this.menu(false);
      this.cur = { p: [this.toPage(e)], c: this.ink, pid: e.pointerId };
      this.hintEl.classList.add('gone');
      game.audio.scratchStart();
      this.render();
    };
    const move = (e) => {
      if (!this.cur || e.pointerId !== this.cur.pid) return;
      e.preventDefault();
      let evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (!evs.length) evs = [e];
      let moved = 0;
      for (const ev of evs) moved += this.penTo(this.toPage(ev));
      if (moved) game.audio.scratch(moved * 300);
      this.render();
    };
    const up = (e) => {
      if (!this.cur || e.pointerId !== this.cur.pid) return;
      this.penUp();
    };
    for (const t of [this.cv, $('fd-zone-a'), $('fd-zone-b')]) {
      t.addEventListener('pointerdown', down);
      t.addEventListener('pointermove', move);
      t.addEventListener('pointerup', up);
      t.addEventListener('pointercancel', up);
    }
    // (the mouse wheel: the next ink)
    this.cv.addEventListener('wheel', (e) => {
      if (!this.isOpen) return;
      e.preventDefault();
      if (Math.abs(e.deltaY) > 2) this.cycleInk(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    // (nothing drawn here reaches the game under it)
    for (const ev of ['mousedown', 'mouseup', 'click', 'contextmenu', 'touchstart', 'wheel']) this.el.addEventListener(ev, (e) => e.stopPropagation());
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    // the buttons: a finger works them as it touches them - with the thumb on the stick a
    // phone sees two fingers, and a tap of the other one makes no click; the mouse clicks (and
    // the click a finger's tap may still make after is not a second press, here or beside it)
    let pressed = -1e9;
    const press = (el, fn) => {
      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        pressed = performance.now();
        fn(e);
      });
      el.addEventListener('click', (e) => {
        if (performance.now() - pressed > 800) fn(e);
      });
    };
    press($('fd-inks'), (e) => {
      const b = e.target.closest('.fd-sw');
      if (b) this.pickInk(+b.dataset.i);
    });
    press(this.colorBtn, () => this.cycleInk(1));
    press($('fd-undo'), () => this.undo());
    press($('fd-clear'), () => this.clear());
    press($('fd-close'), () => this.close());
    press($('fd-make'), () => this.make());
    press($('fd-album'), () => {
      this.close();
      game.openDraw();
    });
    press($('fd-kind'), () => this.menu(this.menuEl.classList.contains('hidden')));
    press(this.altsEl, (e) => {
      const b = e.target.closest('.fd-chip');
      if (!b) return;
      if (b.dataset.k === '…') {
        this.menu(this.menuEl.classList.contains('hidden'));
        return;
      }
      this.choose(b.dataset.k || null);
    });
    press(this.menuEl, (e) => {
      const b = e.target.closest('.fd-chip');
      if (b) this.choose(b.dataset.k || null);
    });
    // its own keys while it is out (after the game's own listener: core/input.js); the game does
    // not see them (Esc is no pause here)
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen || e.repeat) return;
      const k = e.code;
      const mine = () => game.input.pressed.delete(k);
      if (k === 'Escape') {
        mine();
        this.close();
      } else if (k === 'Enter' || k === 'NumpadEnter') {
        mine();
        this.make();
      } else if (k === 'KeyZ' || k === 'Backspace') {
        mine();
        e.preventDefault();
        this.undo();
      } else if (k === 'Delete') {
        mine();
        this.clear();
      }
    });
    window.addEventListener('resize', () => {
      if (this.isOpen) {
        this.layout();
        this.info();
        this.render();
      }
    });
  }

  // ------------------------------------------------------------------ the pen out, and away
  show() {
    const game = this.game;
    const p = game.player;
    if (this.isOpen) return;
    if (p.inVehicle) {
      game.hud.toast('צריך לצאת מהרכב כדי לצייר', 'info');
      return;
    }
    if (p.mode !== 'foot' || game.state !== 'play') return;
    this.isOpen = true;
    this.stats.opened++;
    this.el.classList.remove('hidden');
    document.body.classList.add('fd-open');
    if (!game.touch) game.input.releaseLock();
    game.input.fire = false;
    this.layout();
    this.read();
    this.render();
    if (game.pad) game.pad.startFree({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight });
    game.audio.play('pageflip', 0.4);
  }

  close() {
    if (!this.isOpen) return;
    const game = this.game;
    this.isOpen = false;
    this.shutAt = performance.now();
    if (this.cur) this.penUp(true);
    this.menu(false);
    this.el.classList.add('hidden');
    document.body.classList.remove('fd-open');
    if (game.pad) game.pad.pen = false;
    if (!game.touch && game.state === 'play') game.input.requestLock();
  }

  toggle() {
    if (!this.isOpen) this.show();
    else if (this.strokes.length) this.make();
    else this.close();
  }

  layout() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cw = Math.max(1, window.innerWidth);
    this.ch = Math.max(1, window.innerHeight);
    this.cv.width = Math.round(this.cw * dpr);
    this.cv.height = Math.round(this.ch * dpr);
    this.dpr = dpr;
    this.U = this.unit();
    this.bake();
  }

  // screen px -> the drawing's units
  toPage(e) {
    return [e.clientX / this.U, e.clientY / this.U];
  }

  // the pen on to p: how far it went
  penTo(p) {
    const c = this.cur;
    const q = c.p[c.p.length - 1];
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < 0.006) return 0;
    c.p.push([Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]);
    return d;
  }

  penUp(drop = false) {
    const c = this.cur;
    this.cur = null;
    this.game.audio.scratchStop();
    if (drop || !c) return;
    let len = 0;
    for (let i = 1; i < c.p.length; i++) len += Math.hypot(c.p[i][0] - c.p[i - 1][0], c.p[i][1] - c.p[i - 1][1]);
    // (a dot: a little round one)
    if (len < 0.012) {
      const [x, y] = c.p[0];
      c.p = [];
      for (let i = 0; i <= 8; i++) c.p.push([x + Math.cos((i / 8) * Math.PI * 2) * 0.008, y + Math.sin((i / 8) * Math.PI * 2) * 0.008]);
    }
    this.strokes.push({ p: c.p, c: c.c });
    this.bake();
    this.read();
    this.render();
  }

  // (the pad's pencil, core/gamepad.js: in screen pixels)
  padPen(x, y, down) {
    const inside = x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight;
    const p = [x / this.U, y / this.U];
    if (down && !this.cur && inside) {
      this.cur = { p: [p], c: this.ink, pid: -2 };
      this.game.audio.scratchStart();
    } else if (down && this.cur) {
      const m = this.penTo(p);
      if (m) this.game.audio.scratch(m * 300);
      this.render();
    } else if (!down && this.cur) this.penUp();
  }

  undo() {
    if (this.cur) return;
    this.strokes.pop();
    this.bake();
    this.read();
    this.render();
  }

  clear() {
    this.strokes = [];
    this.force = null;
    this.bake();
    this.read();
    this.render();
  }

  pickInk(i) {
    this.ink = i;
    this.el.querySelectorAll('.fd-sw').forEach((b) => b.classList.toggle('on', +b.dataset.i === i));
    const ink = INKS[i];
    this.colorBtn.style.setProperty('--c', ink.css);
    this.colorBtn.classList.toggle('pencil', !!ink.pencil);
    this.colorBtn.classList.toggle('neon', !!ink.neon);
  }

  menu(on) {
    this.menuEl.classList.toggle('hidden', !on);
    if (on) this.menuEl.querySelectorAll('.fd-chip').forEach((b) => b.classList.toggle('on', (b.dataset.k || null) === this.force));
    if (this.isOpen) this.place();
  }

  // it is something else: what the player picked (null: what it looks like)
  choose(k) {
    this.force = k;
    this.menu(false);
    this.read();
    this.render();
  }

  cycleInk(d) {
    this.pickInk((this.ink + d + INKS.length) % INKS.length);
  }

  // (the pad's Y) it is something else: the next of what it could be, then the rest
  cycleKind() {
    const alts = this.R && this.R.alts ? this.R.alts.map((a) => a.key) : [];
    const list = [...new Set([null, ...alts, ...VEH_CHOICES.map((v) => v[0]), ...WEAPON_ORDER])];
    this.force = list[(list.indexOf(this.force) + 1) % list.length];
    this.read();
    this.render();
  }

  // ------------------------------------------------------------------ reading it
  read() {
    this.R = this.strokes.length ? readFree(this.strokes, this.force) : null;
    this.info();
  }

  // what the tag says of it: what it is becoming, what it can do, the ink it takes, what else
  // it could be
  info() {
    const game = this.game;
    const R = this.R;
    const ink = game.ink;
    const level = ink ? ink.level : 1e9;
    const cost = R && R.cat ? R.cost : 0;
    const has = this.strokes.length > 0;
    this.tagEl.classList.toggle('hidden', !has);
    this.hintEl.classList.toggle('gone', has || !!this.cur);
    this.hintEl.textContent = game.touch ? 'ציירו באוויר — נשק או רכב · האגודל ממשיך לרוץ' : 'ציירו באוויר — נשק או רכב · WASD ממשיכים לרוץ · Q יוצרים · Esc סוגרים';
    if (has) {
      if (!R || !R.cat) {
        this.nameEl.textContent = '…';
        this.statsEl.textContent = R && R.why ? R.why : 'עוד קצת';
      } else {
        this.nameEl.textContent = (this.force ? '✎ ' : '') + R.name;
        this.statsEl.textContent = `${statLine(R)} · ${cost} דיו`;
      }
      // what else it could be (the network's next guesses), and the rest of the list
      const alts = R && R.alts ? R.alts.filter((a) => a.key !== (R.choice || null)).slice(0, 2) : [];
      this.altsEl.innerHTML = alts.map((a) => `<button class="fd-chip" data-k="${a.key}">${a.name}?</button>`).join('') + '<button class="fd-chip more" data-k="…">עוד…</button>';
    }
    const short = R && R.cat && cost > level;
    this.makeBtn.textContent = short ? 'אין מספיק דיו' : R && R.cat ? `✓ ${R.name}!` : '✓ צרו!';
    this.makeBtn.classList.toggle('off', !R || !R.cat || short);
    if (ink) {
      this.inkFill.style.width = `${clamp((level / ink.cap) * 100, 0, 100)}%`;
      const c = Math.min(cost, level);
      this.inkCost.style.width = `${clamp((c / ink.cap) * 100, 0, 100)}%`;
      this.inkCost.style.right = `${clamp(((level - c) / ink.cap) * 100, 0, 100)}%`;
      this.inkCost.classList.toggle('over', !!short);
    }
    if (has) this.place();
  }

  // the tag by the drawing: over it, or under it when there is no room (never under the tools)
  place() {
    const b = this.bounds();
    if (!b) return;
    const tag = this.tagEl;
    const w = tag.offsetWidth;
    const h = tag.offsetHeight;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const tr = this.toolsEl.getBoundingClientRect();
    const right = this.game.touch ? tr.left - 8 : W - 8;
    let x = clamp(b.x0, 8, Math.max(8, right - w));
    let y = b.y0 - h - 14;
    if (y < 8) y = Math.min(b.y1 + 14, H - h - 8);
    if (!this.game.touch) y = Math.min(y, tr.top - h - 8);
    tag.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(8, y))}px)`;
  }

  // the drawing's box on the screen (px)
  bounds() {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const s of this.strokes) {
      for (const [x, y] of s.p) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
    if (!(x1 >= x0)) return null;
    const U = this.U;
    return { x0: x0 * U, x1: x1 * U, y0: y0 * U, y1: y1 * U };
  }

  // one line in the air (g: in the drawing's units): a pale edge round it, so it shows over any
  // street, then its ink
  line(g, s) {
    const U = this.U;
    const ink = INKS[s.c] || INKS[0];
    const w = (ink.pencil ? 3.2 : 4) / U;
    g.beginPath();
    s.p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    if (s.p.length === 1) g.lineTo(s.p[0][0] + 0.001, s.p[0][1]);
    g.strokeStyle = ink.css === '#f4efe4' ? 'rgba(40, 36, 48, 0.75)' : 'rgba(255, 252, 244, 0.82)';
    g.lineWidth = w + 3.4 / U;
    g.globalAlpha = 1;
    g.stroke();
    g.strokeStyle = ink.css;
    g.lineWidth = w;
    if (ink.neon) {
      g.shadowColor = ink.css;
      g.shadowBlur = 12 * (this.dpr || 1);
    }
    g.stroke();
    g.shadowBlur = 0;
  }

  // the lines already drawn, on a picture of their own: as the pen moves only its own line is
  // drawn again (the neon's glow is slow to draw, and a phone draws the game at the same time)
  bake() {
    if (!this.baked) this.baked = document.createElement('canvas');
    const b = this.baked;
    b.width = this.cv.width;
    b.height = this.cv.height;
    const g = b.getContext('2d');
    const U = this.U;
    const dpr = this.dpr || 1;
    g.setTransform(dpr * U, 0, 0, dpr * U, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of this.strokes) this.line(g, s);
  }

  render() {
    const g = this.g;
    const dpr = this.dpr || 1;
    const U = this.U;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.cv.width, this.cv.height);
    if (!this.baked || this.baked.width !== this.cv.width || this.baked.height !== this.cv.height) this.bake();
    g.drawImage(this.baked, 0, 0);
    g.setTransform(dpr * U, 0, 0, dpr * U, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (this.cur) this.line(g, this.cur);
    // which way it points (its muzzle, its tip, its nose)
    const R = this.R;
    if (R && R.cat && !this.cur) {
      const b = this.bounds();
      const x0 = b.x0 / U;
      const x1 = b.x1 / U;
      const y0 = b.y0 / U;
      const y1 = b.y1 / U;
      let dirX;
      if (R.cat === 'vehicle') dirX = R.mirror ? -1 : 1;
      else if (R.theta) dirX = 0;
      else dirX = R.front;
      if (dirX) {
        const y = R.cat === 'vehicle' ? y1 + 0.05 : (y0 + y1) / 2;
        const x = dirX > 0 ? x1 + 0.03 : x0 - 0.03;
        const l = 0.05;
        const arrow = (style, w) => {
          g.strokeStyle = style;
          g.lineWidth = w / U;
          g.beginPath();
          if (R.cat === 'vehicle') {
            const cx = (x0 + x1) / 2;
            g.moveTo(cx - dirX * 0.06, y);
            g.lineTo(cx + dirX * 0.06, y);
            g.moveTo(cx + dirX * 0.06 - dirX * 0.025, y - 0.02);
            g.lineTo(cx + dirX * 0.06, y);
            g.lineTo(cx + dirX * 0.06 - dirX * 0.025, y + 0.02);
          } else {
            g.moveTo(x, y);
            g.lineTo(x + dirX * l, y);
            g.moveTo(x + dirX * l - dirX * 0.02, y - 0.018);
            g.lineTo(x + dirX * l, y);
            g.lineTo(x + dirX * l - dirX * 0.02, y + 0.018);
          }
          g.stroke();
        };
        arrow('rgba(255, 252, 244, 0.85)', 6);
        arrow('#e2335f', 3);
      }
    }
  }

  // ------------------------------------------------------------------ making it
  make() {
    const game = this.game;
    if (this.cur) this.penUp();
    const R = this.strokes.length ? readFree(this.strokes, this.force) : null;
    const shake = (why) => {
      this.stats.failed++;
      this.tagEl.classList.remove('shake');
      void this.tagEl.offsetWidth;
      this.tagEl.classList.add('shake');
      if (why) game.hud.toast(why, 'bad', 2.4);
      game.audio.play('meh', 0.5);
    };
    if (!R || !R.cat) {
      shake(!this.strokes.length ? 'עוד לא צויר כלום — ציירו נשק או רכב' : R && R.why ? R.why : 'זה עוד לא נראה כמו כלום — עוד כמה קווים');
      return;
    }
    const p = game.player;
    if (p.inVehicle || p.mode !== 'foot') return;
    const ink = game.ink;
    if (ink && ink.level < R.cost) {
      shake(`אין מספיק דיו (צריך ${R.cost}) — הדיו חוזר לאט, או בקבוק מחנות כלי כתיבה`);
      if (ink.el) {
        ink.el.classList.remove('flash');
        void ink.el.offsetWidth;
        ink.el.classList.add('flash');
      }
      return;
    }
    const where = this.drawnAt();
    let ok;
    if (R.cat === 'vehicle') ok = this.makeVehicle(R);
    else ok = this.makeWeapon(R, where);
    if (!ok) return;
    if (ink) ink.spend(R.cost);
    this.stats.made[R.kind] = (this.stats.made[R.kind] || 0) + 1;
    if (game.skills) game.skills.add('draw', 1);
    game.goalFlags.drew = true;
    if (R.cat === 'vehicle') {
      game.goalFlags.car = true;
      if (R.spec.cannon || R.spec.base === 'copter') game.goalFlags.heavyDrawn = true;
    }
    game.updateGoals();
    this.flyAway();
    this.strokes = [];
    this.force = null;
    this.R = null;
    this.bake();
    this.close();
  }

  // where the drawing is on the screen: its middle (px) and its size (px)
  drawnAt() {
    const b = this.bounds() || { x0: 0, x1: 10, y0: 0, y1: 10 };
    return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, w: Math.max(10, b.x1 - b.x0), h: Math.max(10, b.y1 - b.y0) };
  }

  // the screen's axes in the street: its right (level), into it (level), and the turn that shows a
  // thing side on with its front to the right (face 1) or the left (-1)
  sideOn(face) {
    const cam = this.game.camera;
    const an = new THREE.Vector3();
    cam.getWorldDirection(an);
    an.y = 0;
    if (an.lengthSq() < 1e-6) an.set(0, 0, -1);
    an.normalize();
    const ax = new THREE.Vector3().crossVectors(an, UP).normalize();
    const z = ax.clone().multiplyScalar(face);
    const x = new THREE.Vector3().crossVectors(UP, z);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, UP, z));
    return { an, ax, q, yaw: Math.atan2(z.x, z.z) };
  }

  makeWeapon(R, where) {
    const game = this.game;
    const W = game.weapons;
    const m = buildWeapon(R);
    const def = R.def;
    W.add(def, 'good', m, undefined);
    const slot = W.current;
    // (the HUD's picture of it, and the drawing again for a save: game/save.js)
    slot.strokes = this.strokes.map((s) => s.p);
    slot.free = { s: this.strokes.map((s) => ({ p: s.p, c: s.c })), force: this.force };
    // it hangs in the air where it was drawn, beside you, as it turns real; then into the hand
    const cam = game.camera;
    const D = 2.3;
    const ndc = _v.set((where.x / window.innerWidth) * 2 - 1, -(where.y / window.innerHeight) * 2 + 1, 0.5).unproject(cam);
    const dir = ndc.sub(cam.position).normalize();
    const C = cam.position.clone().addScaledVector(dir, D);
    const perPx = (2 * D * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / window.innerHeight;
    const box = localBox(m.group);
    const size = box.getSize(new THREE.Vector3());
    const so = this.sideOn(R.theta ? 1 : R.front);
    const sc = clamp((Math.max(where.w, where.h * 0.6) * perPx) / Math.max(0.05, size.z), 0.3, 5);
    const centre = box.getCenter(new THREE.Vector3()).multiplyScalar(sc).applyQuaternion(so.q);
    const frame = makeFrame(cam, C.sub(centre), so.q, sc, box);
    slot.present = { matrix: frame.matrix.clone(), k: 0 };
    const follow = new THREE.Vector3();
    this.presenting = { slot, base: frame.matrix.clone(), follow, from: game.player.pos.clone() };
    const say = `${def.name}! ${statLine(R)}`;
    game.materialize.begin({ frame, root: m.group, held: slot, follow, onReal: () => game.hud.toast(say, 'good', 2.6) });
    game.hud.updateWeapon();
    return true;
  }

  makeVehicle(R) {
    const game = this.game;
    const V = game.vehicles;
    const v = spawnDrawn(game, R.design, 0, 0, 0, false);
    if (!v) return false;
    const so = this.sideOn(R.mirror ? -1 : 1);
    v.group.position.set(0, 0, 0);
    v.group.rotation.set(0, 0, 0);
    v.group.updateMatrixWorld(true);
    const box = localBox(v.group);
    const spot = findSpot(game, v, so, box);
    if (spot) v.pos.set(spot.x, v.flies ? 0 : groundHeight(spot.x, spot.z) * 0.5, spot.z);
    else V.placeNear(v);
    v.yaw = so.yaw;
    if (v.kind === 'copter') v.pos.y = Math.max(0, groundHeight(v.pos.x, v.pos.z)) + v.alt - 1.0;
    V.add(v);
    const frame = makeFrame(game.camera, v.pos, so.q, 1, box);
    const getIn = game.touch ? 'כפתור הרכב הירוק — לעלות' : 'E — לעלות';
    const say = `${v.label}! ${getIn}`;
    game.materialize.begin({ frame, root: v.group, vehicle: v, onReal: () => game.hud.toast(say, 'good', 3) });
    v.strokes = this.strokes.map((s) => s.p);
    return true;
  }

  // the drawing in the air gives way to the thing (a copy of it, fading as it swells a little)
  flyAway() {
    try {
      const c = document.createElement('canvas');
      c.width = this.cv.width;
      c.height = this.cv.height;
      c.getContext('2d').drawImage(this.cv, 0, 0);
      c.className = 'fd-fly';
      document.body.appendChild(c);
      requestAnimationFrame(() => {
        c.style.transform = 'scale(1.04)';
        c.style.opacity = '0';
      });
      setTimeout(() => c.remove(), 700);
    } catch (err) {
      // (no copy: no matter)
    }
  }

  // a drawn vehicle got into (game/game.js enterVehicle): how it goes, the first time
  onEnter(v) {
    const game = this.game;
    const s = v.spec;
    if (!s || this.toldRide) return;
    this.toldRide = true;
    const t = game.touch;
    const tip = s.base === 'copter' ? (t ? 'כפתורי ▲▼: גובה · ירי: מטוסי נייר' : 'רווח ו־C: למעלה ולמטה · קליק: מטוסי נייר')
      : s.base === 'plane' ? (t ? 'קדימה: מצערת · צריך כביש ארוך להמראה' : 'W: מצערת · צריך כביש ארוך, ואז רווח: האף למעלה')
      : s.cannon ? (t ? 'הצריח מסתובב אחרי המבט · ירי: התותח' : 'הצריח מסתובב אחרי העכבר · קליק: התותח')
      : s.jets.length ? (t ? 'ג׳ויסטיק עד הסוף: טורבו' : 'Shift: טורבו מהסילון')
      : s.glide ? 'הכנפיים: אחרי קפיצה מרמפה הוא גולש' : null;
    if (tip) game.hud.toast(tip, 'info', 3.4);
  }

  // ------------------------------------------------------------------ each frame
  update(dt) {
    const game = this.game;
    const p = game.player;
    // (a weapon drawn on the run: it goes along with you while it turns real)
    const pr = this.presenting;
    if (pr) {
      if (!pr.slot.present) this.presenting = null;
      else {
        pr.follow.copy(p.pos).sub(pr.from);
        pr.slot.present.matrix.copy(pr.base).premultiply(_m.makeTranslation(pr.follow.x, pr.follow.y, pr.follow.z));
      }
    }
    // (the jets' flames on a drawn one you ride)
    const v = p.inVehicle;
    if (v && v.drawn) jetFlames(game, v, dt);
    if (!this.isOpen) return;
    // not on foot any more (in a car, swimming, down...), or the game stopped: the pen goes
    if (p.mode !== 'foot' || p.inVehicle || game.state !== 'play' || (game.dialog && game.dialog.open)) {
      this.close();
      return;
    }
    // the camera turns after where you run (the mouse is drawing)
    const vx = p.vel.x;
    const vz = p.vel.z;
    if (Math.hypot(vx, vz) > 1.2) {
      const d = angleDiff(game.camRig.yaw, Math.atan2(vx, vz));
      if (Math.abs(d) < 2.3) game.camRig.yaw += d * (1 - Math.exp(-1.7 * dt));
    }
    game.camRig.pitch += (-0.12 - game.camRig.pitch) * (1 - Math.exp(-2 * dt));
    // (the ink bar moves while it fills back up; the drawing is not read again for it)
    if (game.ink && Math.floor(game.time * 4) !== this.inkTick) {
      this.inkTick = Math.floor(game.time * 4);
      this.info();
    }
  }

  // ------------------------------------------------------------------ the save (game/save.js)
  save() {
    return { s: this.strokes.map((s) => ({ p: s.p, c: s.c })), ink: this.ink };
  }

  load(o) {
    if (!o) return;
    this.strokes = Array.isArray(o.s) ? o.s.filter((s) => Array.isArray(s.p) && s.p.length).map((s) => ({ p: s.p, c: Number.isInteger(s.c) && INKS[s.c] ? s.c : 0 })) : [];
    if (Number.isInteger(o.ink) && INKS[o.ink]) this.pickInk(o.ink);
  }
}
