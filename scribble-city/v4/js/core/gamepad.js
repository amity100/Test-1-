// A gamepad (ROADMAP 2.4): the whole game with one, in the standard layout (the Xbox names; a
// PlayStation pad has the same buttons in the same places). Laid out like GTA:
//
//   on foot   left stick walk · right stick look · RT fire · LT aim · A run · X jump
//             Y car/door/talk · B photo · LB/RB (and d-pad right) weapon · d-pad up draw
//             d-pad left the phone (the phone's camera: A or RT takes the picture, B goes back)
//   driving   RT gas · LT brake/back · A handbrake · RB fire · d-pad down radio
//   flying    left stick fly · RT up · LT down · RB fire
//   anywhere  View the map · Menu pause
//
// Drawing in the air: the left stick moves a pencil, RT puts it on the paper, A is done, X takes a
// line back, Y clears, B runs away, LB/RB the other blueprints. Menus: the d-pad (or the stick)
// goes between the buttons, A presses, B goes back, the sides move a slider. The map: the stick
// moves it, RT/LT zoom, A marks the middle as the destination (or opens the sticker there), X
// lets the destination go, Y comes back to you.
//
// The pad is read once a frame; what it does goes through the same keys and flags as the
// keyboard and the mouse (core/input.js). Whichever was used last decides what the prompts say.

const DEAD = 0.2;
const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
// the prompts with the pad's buttons instead of the keys
const NAMES = [
  ['רווח/C — למעלה/למטה', 'RT/LT — למעלה/למטה'],
  ['קליק — ', 'RB — '],
  ['E — ', 'Ⓨ — '],
  ['F — ', 'Ⓑ — '],
  ['Q כדי', '⬆ כדי'],
];

function dz(v) {
  const a = Math.abs(v);
  return a < DEAD ? 0 : (Math.sign(v) * (a - DEAD)) / (1 - DEAD);
}

const $ = (id) => document.getElementById(id);

function visible(el) {
  return !!el && el.offsetParent !== null && !el.disabled;
}

export class Pad {
  constructor(game) {
    this.game = game;
    this.active = false; // the pad was the last thing used
    this.connected = false;
    this.down = new Array(17).fill(false);
    this.was = new Array(17).fill(false);
    this.ax = [0, 0, 0, 0];
    this.lt = 0;
    this.rt = 0;
    this.t = performance.now();
    this.fire = false;
    this.aim = false;
    this.focus = null;
    this.held = new Set();
    this.navT = 0;
    this.navDir = '';
    this.pen = false;
    this.cursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.cursorEl = $('pad-cursor');
    this.crossEl = $('map-cross');
    window.addEventListener('gamepadconnected', () => {
      this.connected = true;
      if (game.hud && game.state !== 'title') game.hud.toast('שלט משחק מחובר', 'info', 2);
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.connected = !!this.read();
      if (!this.connected) this.setActive(false);
    });
    // the keyboard or the mouse: the prompts go back to their keys
    const off = () => this.setActive(false);
    window.addEventListener('keydown', off);
    window.addEventListener('mousedown', off);
  }

  read() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of list || []) if (p && p.connected !== false && p.buttons && p.buttons.length) return p;
    return null;
  }

  setActive(on) {
    if (on === this.active) return;
    this.active = on;
    document.body.classList.toggle('pad', on);
    if (!on) {
      this.blur();
      if (this.cursorEl) this.cursorEl.classList.add('hidden');
      if (this.crossEl) this.crossEl.classList.add('hidden');
    }
    // (the prompt is written again in the pad's words, or the keys')
    if (this.game.hud) this.game.hud.prompt = null;
  }

  pressed(b) {
    return this.down[b] && !this.was[b];
  }

  released(b) {
    return !this.down[b] && this.was[b];
  }

  // the prompt's keys as the pad's buttons
  text(s) {
    if (!this.active || !s) return s;
    for (const [a, b] of NAMES) s = s.split(a).join(b);
    return s;
  }

  update() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.t) / 1000);
    this.t = now;
    const gp = this.read();
    if (!gp) {
      if (this.connected) this.connected = false;
      return;
    }
    this.connected = true;
    for (let i = 0; i < this.down.length; i++) {
      this.was[i] = this.down[i];
      const b = gp.buttons[i];
      this.down[i] = !!b && (b.pressed || b.value > 0.5);
    }
    this.lt = gp.buttons[B.LT] ? gp.buttons[B.LT].value || (gp.buttons[B.LT].pressed ? 1 : 0) : 0;
    this.rt = gp.buttons[B.RT] ? gp.buttons[B.RT].value || (gp.buttons[B.RT].pressed ? 1 : 0) : 0;
    for (let i = 0; i < 4; i++) this.ax[i] = dz(gp.axes[i] || 0);
    const any = this.down.some((d) => d) || this.ax.some((a) => a !== 0) || this.lt > 0.1 || this.rt > 0.1;
    if (any && !this.active) this.setActive(true);
    if (!this.active) return;
    const game = this.game;
    if (game.citymap && game.citymap.open) this.mapPad(dt);
    else if (game.phoneCam) {
      // the phone's camera: walk and look as ever, A (or RT) takes the picture, B goes back
      this.playPad(dt);
      if (this.pressed(B.A)) game.phone.shoot();
      if (this.pressed(B.B)) game.phone.camBack();
    } else if (game.airdraw && game.airdraw.open) this.drawPad(dt);
    else if (this.menuRoot()) this.menuPad(dt);
    else if (game.state === 'play') this.playPad(dt);
    if (!(game.airdraw && game.airdraw.open) && this.cursorEl) this.cursorEl.classList.add('hidden');
  }

  // ------------------------------------------------------------------ playing
  playPad(dt) {
    const game = this.game;
    const inp = game.input;
    if (this.focus) this.blur();
    const v = game.player.inVehicle;
    const [lx, ly, rx, ry] = this.ax;
    const key = (b, code) => {
      if (this.pressed(b)) {
        inp.pressed.add(code);
        inp.emit('key', code);
      }
    };
    // (a key the pad holds down, let go when the button is)
    const hold = (on, code) => {
      const had = this.held.has(code);
      if (on && !had) {
        this.held.add(code);
        inp.keys.add(code);
        inp.pressed.add(code);
        inp.emit('key', code);
      } else if (!on && had) {
        this.held.delete(code);
        inp.keys.delete(code);
      }
    };
    // the camera: the right stick, gentle near the middle
    const c = (a) => a * Math.abs(a);
    inp.lookDX += c(rx) * 1050 * dt;
    inp.lookDY += c(ry) * 700 * dt;
    let fire;
    if (v) {
      const flying = v.kind === 'copter';
      inp.pad = flying ? { x: lx, y: -ly, sprint: false } : { x: lx, y: this.rt - this.lt, sprint: false };
      inp.flyUp = flying && this.rt > 0.3;
      inp.flyDown = flying && this.lt > 0.3;
      hold(!flying && this.down[B.A], 'Space');
      fire = this.down[B.RB];
      if (this.aim) {
        this.aim = false;
        inp.aim = false;
      }
      key(B.DOWN, 'KeyR');
      key(B.R3, 'KeyV');
    } else {
      inp.pad = { x: lx, y: -ly, sprint: this.down[B.A] };
      inp.flyUp = false;
      inp.flyDown = false;
      hold(this.down[B.X], 'Space');
      fire = this.rt > 0.4;
      const aim = this.lt > 0.4;
      if (aim !== this.aim) {
        this.aim = aim;
        inp.aim = aim;
      }
      if (this.pressed(B.LB)) inp.wheel -= 1;
      if (this.pressed(B.RB) || this.pressed(B.RIGHT)) inp.wheel += 1;
      key(B.UP, 'KeyQ');
      // (the right stick pressed in: down low, ROADMAP 5.3; nothing with ?classic)
      key(B.R3, 'KeyC');
    }
    if (fire !== this.fire) {
      this.fire = fire;
      inp.fire = fire;
      if (fire) inp.firePressed = true;
    }
    key(B.Y, 'KeyE');
    key(B.B, 'KeyF');
    key(B.LEFT, 'KeyP');
    key(B.VIEW, 'KeyM');
    key(B.MENU, 'Escape');
  }

  // let go of everything the pad holds (a menu opened over the game)
  release() {
    const inp = this.game.input;
    inp.pad = null;
    inp.flyUp = false;
    inp.flyDown = false;
    for (const k of this.held) inp.keys.delete(k);
    this.held.clear();
    if (this.fire) inp.fire = false;
    if (this.aim) inp.aim = false;
    this.fire = false;
    this.aim = false;
  }

  // ------------------------------------------------------------------ menus
  menuRoot() {
    const g = this.game;
    if (g.phone && g.phone.isOpen) return $('phone');
    if (g.dialog && g.dialog.open) return $('dialog');
    if (g.album && g.album.open) return $('album');
    for (const id of ['death', 'pause', 'title']) {
      const el = $(id);
      if (el && !el.classList.contains('hidden')) return el;
    }
    return null;
  }

  items(root) {
    return [...root.querySelectorAll('button, input, select, .album-item:not(.locked)')].filter(visible);
  }

  blur() {
    if (this.focus) this.focus.classList.remove('pad-focus');
    this.focus = null;
  }

  setFocus(el) {
    if (this.focus === el) return;
    this.blur();
    this.focus = el;
    if (!el) return;
    el.classList.add('pad-focus');
    if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // the item nearest to the focus in a direction (by the screen: what is drawn to the left is left)
  step(list, dx, dy) {
    const f = this.focus.getBoundingClientRect();
    const fx = f.left + f.width / 2;
    const fy = f.top + f.height / 2;
    let best = null;
    let bd = Infinity;
    for (const el of list) {
      if (el === this.focus) continue;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2 - fx;
      const y = r.top + r.height / 2 - fy;
      const along = x * dx + y * dy;
      if (along <= 4) continue;
      const across = Math.abs(x * dy - y * dx);
      const d = along + across * 2.5;
      if (d < bd) {
        bd = d;
        best = el;
      }
    }
    return best;
  }

  // a direction from the d-pad or the stick, once and then repeating while held
  navDirection(dt) {
    const [lx, ly] = this.ax;
    let dir = '';
    if (this.down[B.UP] || ly < -0.55) dir = 'up';
    else if (this.down[B.DOWN] || ly > 0.55) dir = 'down';
    else if (this.down[B.LEFT] || lx < -0.55) dir = 'left';
    else if (this.down[B.RIGHT] || lx > 0.55) dir = 'right';
    if (!dir) {
      this.navDir = '';
      return '';
    }
    if (dir !== this.navDir) {
      this.navDir = dir;
      this.navT = 0.38;
      return dir;
    }
    this.navT -= dt;
    if (this.navT <= 0) {
      this.navT = 0.11;
      return dir;
    }
    return '';
  }

  menuPad(dt) {
    const game = this.game;
    this.release();
    const root = this.menuRoot();
    const list = this.items(root);
    if (!list.length) return;
    if (!this.focus || !list.includes(this.focus)) this.setFocus(list[0]);
    const dir = this.navDirection(dt);
    const el = this.focus;
    const range = el.tagName === 'INPUT' && el.type === 'range';
    const select = el.tagName === 'SELECT';
    if ((dir === 'left' || dir === 'right') && (range || select)) {
      // the sides move a slider, or go through a list's options (the screen is right to left)
      const s = dir === 'left' ? 1 : -1;
      if (range) {
        const st = parseFloat(el.step) || 0.1;
        const v = Math.min(parseFloat(el.max), Math.max(parseFloat(el.min), parseFloat(el.value) + s * st));
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        el.selectedIndex = Math.min(el.options.length - 1, Math.max(0, el.selectedIndex - s));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else if (dir) {
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      const next = this.step(list, d[0], d[1]);
      if (next) this.setFocus(next);
    }
    if (this.pressed(B.A)) {
      if (el.tagName === 'INPUT' && el.type === 'checkbox') el.click();
      else if (!range && !select) el.click();
    }
    if (this.pressed(B.B) || (this.pressed(B.MENU) && root.id === 'pause')) {
      if (root.id === 'phone') game.phone.back();
      else if (game.dialog && game.dialog.open) game.dialog.close(true);
      else if (game.album && game.album.open) game.album.hide();
      else if (root.id === 'pause') game.resume(false);
    }
  }

  // ------------------------------------------------------------------ drawing in the air
  drawPad(dt) {
    const game = this.game;
    const ad = game.airdraw;
    this.release();
    if (game.album && game.album.open) {
      this.menuPad(dt);
      return;
    }
    this.blur();
    if (ad.phase === 'grade') {
      if (this.pressed(B.A) || this.pressed(B.RT)) ad.startPlop();
      return;
    }
    if (ad.phase !== 'draw') return;
    // the pencil: the left stick (quick), the right stick (slow, for the small lines)
    const [lx, ly, rx, ry] = this.ax;
    const c = (a) => a * Math.abs(a);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const sp = Math.min(W, H) * 1.25;
    this.cursor.x = Math.min(W - 4, Math.max(4, this.cursor.x + (c(lx) * sp + c(rx) * sp * 0.3) * dt));
    this.cursor.y = Math.min(H - 4, Math.max(4, this.cursor.y + (c(ly) * sp + c(ry) * sp * 0.3) * dt));
    if (this.cursorEl) {
      this.cursorEl.classList.remove('hidden');
      this.cursorEl.classList.toggle('down', this.pen);
      this.cursorEl.style.transform = `translate(${this.cursor.x.toFixed(1)}px, ${this.cursor.y.toFixed(1)}px)`;
    }
    const down = this.rt > 0.35;
    if (down && !this.pen) ad.penDown(this.cursor.x, this.cursor.y);
    else if (down) ad.penMove(this.cursor.x, this.cursor.y);
    else if (this.pen) ad.penUp();
    this.pen = down;
    if (this.pressed(B.A)) ad.finish();
    if (this.pressed(B.X)) ad.undo();
    if (this.pressed(B.Y)) ad.strokes = [];
    if (this.pressed(B.B)) ad.close(true);
    if (this.pressed(B.LB)) ad.cycle(-1);
    if (this.pressed(B.RB)) ad.cycle(1);
    if (this.pressed(B.VIEW)) ad.toggleGhost();
  }

  // the pencil starts in the middle of the paper
  startDrawing() {
    this.cursor.x = window.innerWidth / 2;
    this.cursor.y = window.innerHeight * 0.45;
    this.pen = false;
  }

  // ------------------------------------------------------------------ the map
  mapPad(dt) {
    const m = this.game.citymap;
    this.release();
    this.blur();
    const [lx, ly, , ry] = this.ax;
    const v = m.view;
    const c = (a) => a * Math.abs(a);
    let changed = false;
    if (lx || ly) {
      const sp = 700 / v.k;
      v.cx += c(lx) * sp * dt;
      v.cz += c(ly) * sp * dt;
      changed = true;
    }
    const zoom = this.rt - this.lt - c(ry);
    if (Math.abs(zoom) > 0.05) {
      v.k *= Math.exp(zoom * 1.8 * dt);
      changed = true;
    }
    if (changed) {
      m.anim = null;
      m.clampView(v);
      m.dirty();
    }
    if (this.crossEl) this.crossEl.classList.remove('hidden');
    // what is under the cross
    const cx = m.W / 2;
    const cy = m.H / 2;
    const hit = m.hit(cx, cy);
    if (!m.sel) m.setHover(hit);
    if (this.pressed(B.A)) {
      const btn = m.sel ? m.card.querySelector('.card-btn') : null;
      if (btn) btn.click();
      else m.tap(cx, cy);
    }
    if (this.pressed(B.X)) m.clearTarget();
    if (this.pressed(B.Y)) m.centreOnPlayer(true);
    if (this.pressed(B.B) || this.pressed(B.VIEW) || this.pressed(B.MENU)) {
      if (m.sel) m.hideCard();
      else m.hide();
    }
  }
}
