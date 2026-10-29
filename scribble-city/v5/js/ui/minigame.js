// (v5, ROADMAP 12.1) A game inside the game: the cabinet in the arcade, the table in the casino,
// the dance floor at the festival. It is played on a sheet of its own over the city, which stands
// still behind it and is not drawn while the sheet covers it (the graphics card rests; a phone the
// most).
//
// A game is an object (game/minigames/*.js):
//   { title, help, pad: 'pad' | 'tap' | 'cards', start(api), update(dt, inp), draw(g, W, H) }
// It draws in its own measure, W = 1000 across and H = 600 down: the canvas is scaled to fit the
// screen, its shape kept. Each frame it is told:
//   inp: { left, right, up, down, a, b (held), hit: Set of 'left' 'right' 'up' 'down' 'a' 'b'
//          'enter' (pressed this frame), at: Map of those to when (performance.now(): a rhythm
//          game judges the moment, not the frame), taps: [[x, y, when]] (this frame, in its measure),
//          drag: { x, y, x0, y0, down } | null (a finger or the mouse held on the canvas),
//          codes: Map of the keyboard's own codes pressed this frame to when, down: Set of those held
//          (a game with keys of its own: the dance floor's D F J K) }
//   api: { finish(res), game, audio, money, rng, toast(text), status(text) }
// finish(res): the sheet closes and whoever opened it hears res ({ score, won, cash, ... }).

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down', Space: 'a', KeyJ: 'a', KeyK: 'b', ShiftLeft: 'b', ShiftRight: 'b',
  Enter: 'enter', NumpadEnter: 'enter',
};

export const MG_W = 1000;
export const MG_H = 600;

export class MiniGames {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this.mod = null;
    const el = (this.el = document.createElement('div'));
    el.id = 'minigame';
    el.className = 'hidden';
    el.innerHTML = `<div class="mg-sheet paper-card">
      <div class="mg-head"><span class="mg-title"></span><span class="mg-status"></span><span class="mg-gap"></span><button class="ps-btn mg-quit">יציאה</button></div>
      <div class="mg-stage"><canvas></canvas>
        <div class="mg-pad mg-left"><button data-k="up">▲</button><button data-k="left">◀</button><button data-k="right">▶</button><button data-k="down">▼</button></div>
        <div class="mg-pad mg-right"><button data-k="b">B</button><button data-k="a">A</button></div>
      </div>
      <div class="mg-help"></div>
    </div>`;
    document.body.appendChild(el);
    this.cv = el.querySelector('canvas');
    this.g = this.cv.getContext('2d');
    this.titleEl = el.querySelector('.mg-title');
    this.statusEl = el.querySelector('.mg-status');
    this.helpEl = el.querySelector('.mg-help');
    this.held = new Set();
    this.hit = new Set();
    this.hitAt = new Map();
    this.codes = new Map();
    this.down = new Set();
    this.taps = [];
    this.drag = null;
    el.querySelector('.mg-quit').addEventListener('click', (e) => {
      e.stopPropagation();
      this.close({ quit: true });
    });
    // (the touch pad: held while a finger is on it)
    for (const b of el.querySelectorAll('.mg-pad button')) {
      const k = b.dataset.k;
      const down = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.held.has(k)) {
          this.hit.add(k);
          this.hitAt.set(k, performance.now());
        }
        this.held.add(k);
        b.classList.add('on');
      };
      const up = (e) => {
        e.preventDefault();
        this.held.delete(k);
        b.classList.remove('on');
      };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    }
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cv.setPointerCapture(e.pointerId);
      const [x, y] = this.at(e);
      this.taps.push([x, y, performance.now()]);
      this.drag = { x, y, x0: x, y0: y, down: true, t0: performance.now() };
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      e.preventDefault();
      const [x, y] = this.at(e);
      this.drag.x = x;
      this.drag.y = y;
    });
    const up = (e) => {
      if (!this.drag) return;
      e.preventDefault();
      // (let go: the game sees the drag once more, no longer down, then it is gone)
      this.drag.down = false;
      this.dragEnded = true;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    // (nothing on the sheet reaches the city under it)
    for (const ev of ['mousedown', 'mouseup', 'click', 'contextmenu', 'touchstart', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation());
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Escape') {
        this.close({ quit: true });
        return;
      }
      if (!e.repeat) this.codes.set(e.code, performance.now());
      this.down.add(e.code);
      const k = KEYS[e.code];
      if (!k) return;
      e.preventDefault();
      if (!e.repeat) {
        this.hit.add(k);
        this.hitAt.set(k, performance.now());
      }
      this.held.add(k);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      const k = KEYS[e.code];
      if (k) this.held.delete(k);
    });
    this.loop = (ts) => this.frame(ts);
  }

  get open() {
    return this.isOpen;
  }

  // while it is open the city is not drawn (game/game.js renderFrame)
  get covering() {
    return this.isOpen;
  }

  // a game in, played until it finishes (or is left): cb(res)
  play(mod, cb, o = {}) {
    if (this.isOpen) return false;
    const game = this.game;
    this.mod = mod;
    this.cb = cb;
    this.titleEl.textContent = mod.title || '';
    this.statusEl.textContent = '';
    this.helpEl.textContent = (game.touch ? mod.helpTouch : mod.help) || mod.help || '';
    this.el.dataset.pad = mod.pad || 'pad';
    this.el.classList.toggle('touch', !!game.touch);
    this.held.clear();
    this.hit.clear();
    this.hitAt.clear();
    this.codes.clear();
    this.down.clear();
    this.taps.length = 0;
    this.drag = null;
    this.isOpen = true;
    this.el.classList.remove('hidden');
    if (!game.touch) game.input.releaseLock();
    game.input.keys.clear();
    this.fit();
    let seed = (o.seed || Date.now()) >>> 0;
    const rng = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    this.api = {
      game,
      audio: game.audio,
      money: game.money,
      rng,
      finish: (res) => this.close(res || {}),
      toast: (text, kind = 'info', s = 2) => game.hud.toast(text, kind, s),
      status: (text) => {
        this.statusEl.textContent = text;
      },
    };
    mod.start(this.api, o);
    this.last = 0;
    this.raf = requestAnimationFrame(this.loop);
    return true;
  }

  close(res) {
    if (!this.isOpen) return;
    this.isOpen = false;
    cancelAnimationFrame(this.raf);
    this.el.classList.add('hidden');
    const mod = this.mod;
    const cb = this.cb;
    this.mod = null;
    this.cb = null;
    // (left with Esc or the button: whatever the game had finished still counts)
    if (res && res.quit && mod && mod.result) res = { ...(mod.result() || {}), quit: true };
    if (mod && mod.stop) mod.stop();
    this.game.input.keys.clear();
    if (cb) cb(res || {});
  }

  // the canvas at the screen's size, in pixels (its drawing scaled to the game's measure)
  fit() {
    const stage = this.el.querySelector('.mg-stage');
    const r = stage.getBoundingClientRect();
    const k = Math.min(r.width / MG_W, r.height / MG_H) || 1;
    const css = [Math.round(MG_W * k), Math.round(MG_H * k)];
    const dpr = Math.min(window.devicePixelRatio || 1, this.game.touch ? 1.5 : 2);
    this.cv.style.width = css[0] + 'px';
    this.cv.style.height = css[1] + 'px';
    const w = Math.max(1, Math.round(css[0] * dpr));
    const h = Math.max(1, Math.round(css[1] * dpr));
    if (this.cv.width !== w || this.cv.height !== h) {
      this.cv.width = w;
      this.cv.height = h;
    }
    this.scale = w / MG_W;
  }

  // a pointer on the canvas, in the game's measure
  at(e) {
    const r = this.cv.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * MG_W, ((e.clientY - r.top) / r.height) * MG_H];
  }

  frame(ts) {
    if (!this.isOpen) return;
    const dt = this.last ? Math.min(0.05, (ts - this.last) / 1000) : 1 / 60;
    this.last = ts;
    this.fit();
    const inp = {
      left: this.held.has('left'),
      right: this.held.has('right'),
      up: this.held.has('up'),
      down: this.held.has('down'),
      a: this.held.has('a'),
      b: this.held.has('b'),
      hit: this.hit,
      at: this.hitAt,
      codes: this.codes,
      down: this.down,
      taps: this.taps,
      drag: this.drag,
    };
    const mod = this.mod;
    try {
      mod.update(dt, inp);
      if (!this.isOpen) return;
      const g = this.g;
      g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      mod.draw(g, MG_W, MG_H);
    } catch (e) {
      console.error('[minigame]', mod && mod.title, e);
      this.close({ error: true });
      return;
    }
    this.hit.clear();
    this.hitAt.clear();
    this.codes.clear();
    this.taps.length = 0;
    if (this.dragEnded) {
      this.drag = null;
      this.dragEnded = false;
    }
    this.raf = requestAnimationFrame(this.loop);
  }
}
