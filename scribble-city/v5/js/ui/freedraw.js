import * as THREE from 'three';
import { INKS, KINDS, WEAPON_ORDER, readFree, buildWeapon, statLine } from '../game/freeform.js';
import { spawnDrawn, jetFlames } from '../game/drawncar.js';
import { makeFrame, findSpot, localBox } from '../game/materialize.js';
import { angleDiff, clamp } from '../core/util.js';
import { groundHeight } from '../world/layout.js';

// (ROADMAP 11.6) Drawing freehand, on the move. Q (the pencil on a phone): a page of the notebook
// comes up in the corner - on a phone, over the right half - and whatever is drawn on it is read
// as it is drawn: a word on top says what it is becoming and what it can do (game/freeform.js).
// The game goes on all the while: WASD (the stick) keep running, the camera turns after you,
// Shift still sprints. Q again (✓, a right click, Enter) and the drawing becomes the thing - a
// weapon hangs in the air beside you as it turns real, then flies into your hand; a vehicle
// stands in the street ahead. Esc (✕, a click outside the page) puts the page away, the drawing
// kept on it for later; Z (↶) takes the last line back. The inks: colour as you like (pencil is
// no colour - the thing gets one of its own; neon glows, and a gun drawn in it is a laser).
// A tap on the word on top: it is something else (the numbers stay the drawing's).

const $ = (id) => document.getElementById(id);
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();

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
    this.stats = { opened: 0, made: {}, failed: 0 };
    this.build();
    this.bind();
  }

  get open() {
    return this.isOpen;
  }

  build() {
    const sw = INKS.map((c, i) => `<button class="fd-sw${c.neon ? ' neon' : ''}${c.pencil ? ' pencil' : ''}" data-i="${i}" style="--c:${c.css}" title="${c.name}" aria-label="${c.name}"></button>`).join('');
    const chips = [['', 'אוטומטי'], ['vehicle', 'רכב'], ...WEAPON_ORDER.map((k) => [k, KINDS[k].name])].map(([k, n]) => `<button class="fd-chip" data-k="${k}">${n}</button>`).join('');
    this.el.innerHTML = `<div class="fd-page">
      <div class="fd-top">
        <button class="fd-kind" id="fd-kind" title="מה זה יהיה (נגיעה: משהו אחר)"><b id="fd-name"></b><span id="fd-stats"></span></button>
        <div class="fd-ink" aria-label="דיו"><i id="fd-ink-fill"></i><i id="fd-ink-cost"></i></div>
      </div>
      <div class="fd-sheet"><canvas id="fd-canvas"></canvas><div class="fd-hint" id="fd-hint"></div></div>
      <div class="fd-bar">
        <div class="fd-inks" id="fd-inks">${sw}</div>
        <div class="fd-acts">
          <button class="fd-btn" id="fd-undo" title="ביטול הקו האחרון (Z)">↶</button>
          <button class="fd-btn" id="fd-clear" title="דף נקי (Delete)">נקה</button>
          <button class="fd-btn touch-only" id="fd-album">שרטוטים</button>
          <button class="fd-btn" id="fd-close" title="סגירה, הציור נשמר (Esc)">✕</button>
          <button class="fd-btn primary" id="fd-make">✓ צרו!</button>
        </div>
      </div>
      <div class="fd-menu hidden" id="fd-menu">${chips}</div>
    </div>`;
    this.page = this.el.querySelector('.fd-page');
    this.cv = $('fd-canvas');
    this.g = this.cv.getContext('2d');
    this.nameEl = $('fd-name');
    this.statsEl = $('fd-stats');
    this.hintEl = $('fd-hint');
    this.makeBtn = $('fd-make');
    this.menuEl = $('fd-menu');
    this.inkFill = $('fd-ink-fill');
    this.inkCost = $('fd-ink-cost');
    this.pickInk(0);
  }

  bind() {
    const cv = this.cv;
    const game = this.game;
    cv.addEventListener('pointerdown', (e) => {
      if (!this.isOpen || this.cur) return;
      e.preventDefault();
      if (e.button === 2) {
        this.make();
        return;
      }
      try {
        cv.setPointerCapture(e.pointerId);
      } catch (err) {
        // (synthetic pointers)
      }
      this.menu(false);
      this.cur = { p: [this.toPage(e)], c: this.ink, pid: e.pointerId };
      game.audio.scratchStart();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.cur || e.pointerId !== this.cur.pid) return;
      e.preventDefault();
      let evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (!evs.length) evs = [e];
      let moved = 0;
      for (const ev of evs) moved += this.penTo(this.toPage(ev));
      if (moved) game.audio.scratch(moved * 300);
      this.render();
    });
    const up = (e) => {
      if (!this.cur || e.pointerId !== this.cur.pid) return;
      this.penUp();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    // (nothing on the page reaches the game under it; a click on the game beside it puts it away)
    for (const ev of ['mousedown', 'mouseup', 'click', 'contextmenu', 'touchstart', 'wheel']) this.page.addEventListener(ev, (e) => e.stopPropagation());
    this.el.addEventListener('mousedown', (e) => {
      if (!this.isOpen || game.touch || e.target !== this.el) return;
      e.preventDefault();
      this.close();
    });
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    // the page's buttons: a finger works them as it touches them - with the thumb on the stick a
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
    press($('fd-undo'), () => this.undo());
    press($('fd-clear'), () => this.clear());
    press($('fd-close'), () => this.close());
    press($('fd-make'), () => this.make());
    press($('fd-album'), () => {
      this.close();
      game.openDraw();
    });
    press($('fd-kind'), () => this.menu(this.menuEl.classList.contains('hidden')));
    press(this.menuEl, (e) => {
      const b = e.target.closest('.fd-chip');
      if (!b) return;
      this.force = b.dataset.k || null;
      this.menu(false);
      this.read();
      this.render();
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
      if (this.isOpen) this.layout();
    });
  }

  // ------------------------------------------------------------------ the page
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
    if (game.pad) game.pad.startFree(this.cv.getBoundingClientRect());
    game.audio.play('pageflip', 0.5);
    if (!this.told) {
      this.told = true;
      game.hud.toast(game.touch ? 'ציירו נשק או רכב — מה שבא לכם. הג׳ויסטיק ממשיך לרוץ' : 'ציירו נשק או רכב — מה שבא לכם. WASD ממשיכים לרוץ', 'info', 3.4);
    }
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
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cw = Math.max(1, r.width);
    this.ch = Math.max(1, r.height);
    this.cv.width = Math.round(this.cw * dpr);
    this.cv.height = Math.round(this.ch * dpr);
    this.dpr = dpr;
    this.bake();
  }

  toPage(e) {
    const r = this.cv.getBoundingClientRect();
    return [(e.clientX - r.left) / Math.max(1, r.height), (e.clientY - r.top) / Math.max(1, r.height)];
  }

  // the pen on to p (page units): how far it went
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
    const r = this.cv.getBoundingClientRect();
    const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    const p = [(x - r.left) / Math.max(1, r.height), (y - r.top) / Math.max(1, r.height)];
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
  }

  menu(on) {
    this.menuEl.classList.toggle('hidden', !on);
    if (on) this.menuEl.querySelectorAll('.fd-chip').forEach((b) => b.classList.toggle('on', (b.dataset.k || null) === this.force));
  }

  cycleInk(d) {
    this.pickInk((this.ink + d + INKS.length) % INKS.length);
  }

  // (the pad's Y) it is something else: the next kind
  cycleKind() {
    const list = [null, 'vehicle', ...WEAPON_ORDER];
    this.force = list[(list.indexOf(this.force) + 1) % list.length];
    this.read();
    this.render();
  }

  // ------------------------------------------------------------------ reading it
  read() {
    this.R = this.strokes.length ? readFree(this.strokes, this.force) : null;
    this.info();
  }

  // what the page says of it: what it is becoming, what it can do, the ink it takes
  info() {
    const game = this.game;
    const R = this.R;
    const ink = game.ink;
    const level = ink ? ink.level : 1e9;
    const cost = R && R.cat ? R.cost : 0;
    if (!this.strokes.length) {
      this.nameEl.textContent = 'ציירו נשק או רכב';
      this.statsEl.textContent = 'מה שבא לכם — הצורה קובעת מה הוא עושה';
    } else if (!R || !R.cat) {
      this.nameEl.textContent = '…';
      this.statsEl.textContent = R && R.why ? R.why : 'עוד קצת';
    } else {
      this.nameEl.textContent = (this.force ? '✎ ' : '') + R.name;
      this.statsEl.textContent = `${statLine(R)} · ${cost} דיו`;
    }
    this.hintEl.textContent = this.strokes.length ? '' : game.touch ? 'ציירו כאן — הג׳ויסטיק ממשיך לרוץ' : 'ציירו כאן · WASD ממשיכים לרוץ · Q יוצרים · Esc סוגרים';
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
  }

  // one line on a page (g: in page units)
  line(g, s) {
    const H = this.ch || 1;
    const ink = INKS[s.c] || INKS[0];
    const w = (ink.pencil ? 2.6 : 3.4) / H;
    g.beginPath();
    s.p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    if (s.p.length === 1) g.lineTo(s.p[0][0] + 0.001, s.p[0][1]);
    if (ink.css === '#f4efe4') {
      g.strokeStyle = '#8a8272';
      g.lineWidth = w + 2.2 / H;
      g.stroke();
    }
    g.strokeStyle = ink.css;
    g.lineWidth = w;
    g.globalAlpha = ink.pencil ? 0.9 : 1;
    if (ink.neon) {
      g.shadowColor = ink.css;
      g.shadowBlur = 10 * (this.dpr || 1);
    }
    g.stroke();
    g.shadowBlur = 0;
    g.globalAlpha = 1;
  }

  // the lines already drawn, on a page of their own: as the pen moves only its own line is drawn
  // again (the neon's glow is slow to draw, and a phone draws the game at the same time)
  bake() {
    if (!this.baked) this.baked = document.createElement('canvas');
    const b = this.baked;
    b.width = this.cv.width;
    b.height = this.cv.height;
    const g = b.getContext('2d');
    const H = this.ch || 1;
    const dpr = this.dpr || 1;
    g.setTransform(dpr * H, 0, 0, dpr * H, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of this.strokes) this.line(g, s);
  }

  render() {
    const g = this.g;
    const dpr = this.dpr || 1;
    const H = this.ch || 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.cv.width, this.cv.height);
    if (!this.baked || this.baked.width !== this.cv.width || this.baked.height !== this.cv.height) this.bake();
    g.drawImage(this.baked, 0, 0);
    g.setTransform(dpr * H, 0, 0, dpr * H, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (this.cur) this.line(g, this.cur);
    // which way it points (its muzzle, its tip, its nose)
    const R = this.R;
    if (R && R.cat && !this.cur) {
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
      let dirX;
      if (R.cat === 'vehicle') dirX = R.mirror ? -1 : 1;
      else if (R.theta) dirX = 0;
      else dirX = R.front;
      if (dirX) {
        const y = R.cat === 'vehicle' ? y1 + 0.05 : (y0 + y1) / 2;
        const x = dirX > 0 ? x1 + 0.03 : x0 - 0.03;
        const l = 0.05;
        g.strokeStyle = '#e2335f';
        g.lineWidth = 3 / H;
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
      this.page.classList.remove('shake');
      void this.page.offsetWidth;
      this.page.classList.add('shake');
      if (why) game.hud.toast(why, 'bad', 2.4);
      game.audio.play('meh', 0.5);
    };
    if (!R || !R.cat) {
      shake(!this.strokes.length ? 'הדף ריק — ציירו נשק או רכב' : R && R.why ? R.why : 'זה עוד לא נראה כמו כלום — עוד כמה קווים');
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
    this.flyAway(where);
    this.strokes = [];
    this.force = null;
    this.R = null;
    this.close();
  }

  // where the drawing is on the screen: its middle (px) and its size (px)
  drawnAt() {
    const r = this.cv.getBoundingClientRect();
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
    const H = r.height;
    return { x: r.left + ((x0 + x1) / 2) * H, y: r.top + ((y0 + y1) / 2) * H, w: Math.max(10, (x1 - x0) * H), h: Math.max(10, (y1 - y0) * H), rect: r };
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

  // the drawing leaves the page (a copy of it, shrinking away)
  flyAway(where) {
    try {
      const c = document.createElement('canvas');
      c.width = this.cv.width;
      c.height = this.cv.height;
      c.getContext('2d').drawImage(this.cv, 0, 0);
      const r = where.rect;
      c.className = 'fd-fly';
      c.style.left = `${r.left}px`;
      c.style.top = `${r.top}px`;
      c.style.width = `${r.width}px`;
      c.style.height = `${r.height}px`;
      document.body.appendChild(c);
      requestAnimationFrame(() => {
        c.style.transform = `translate(${(window.innerWidth / 2 - where.x) * 0.35}px, ${(window.innerHeight / 2 - where.y) * 0.35}px) scale(0.55)`;
        c.style.opacity = '0';
      });
      setTimeout(() => c.remove(), 600);
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
    // not on foot any more (in a car, swimming, down...), or the game stopped: the page goes
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
