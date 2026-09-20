// Touch controls for phones: a floating stick under the left thumb, drag-to-look and tap-to-fire under the
// right thumb, and big buttons for the verbs (fire, knife, action, gateway, map). On the map: drag pans,
// pinch zooms, tap previews a gateway, a second tap (or OPEN) opens it.
import { i18n } from '../core/i18n.js';

const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
const STICK_R = 58, DEAD = 0.12, LOOK_SCALE = 2.6, TAP_MS = 260, TAP_PX = 12;

export class TouchControls {
  constructor(game, root) {
    this.game = game; this.input = game.input;
    this.root = el('div', 'touch', root);
    const r = this.root;
    this.zoneL = el('div', 'tz left', r); this.zoneR = el('div', 'tz right', r);
    this.stick = el('div', 'stick', r); this.knob = el('i', '', this.stick);
    this.buttons = {};
    const btn = (id, cls, label) => { const b = el('div', 'tbtn ' + cls, r, `<span>${label}</span>`); b.dataset.id = id; this.buttons[id] = b; return b; };
    btn('fire', 'fire', i18n.t('touch.fire'));
    btn('knife', 'knife', i18n.t('touch.knife'));
    btn('gate', 'gate', i18n.t('touch.gate'));
    btn('close', 'close', i18n.t('touch.close'));
    btn('action', 'action', i18n.t('touch.action'));
    btn('map', 'map', i18n.t('touch.map'));
    btn('back', 'back', i18n.t('touch.back'));
    btn('open', 'open', i18n.t('touch.open'));
    btn('crouch', 'small crouch', i18n.t('touch.crouch'));
    btn('weapon', 'small weapon', i18n.t('touch.weapon'));
    btn('reload', 'small reload', i18n.t('touch.reload'));
    btn('grenade', 'small grenade', i18n.t('touch.grenade'));
    btn('pause', 'pause', '❚❚');
    this.actionRing = el('b', 'ring', this.buttons.action);
    this.rotateNote = el('div', 'rotate-note', r, i18n.t('touch.rotate'));
    this.pointers = new Map();     // pointerId → { kind, x0, y0, x, y, t0, moved, btn }
    this.held = new Set();         // buttons currently pressed
    this.queue = [];               // one-frame actions
    this.pinch = null;
    this.bind();
    i18n.onChange(() => { for (const id in this.buttons) { const k = id === 'pause' ? null : 'touch.' + id; if (k) this.buttons[id].querySelector('span').textContent = i18n.t(k); } this.rotateNote.textContent = i18n.t('touch.rotate'); });
    this.setVisible(false);
  }

  setVisible(v) { this.root.style.display = v ? '' : 'none'; if (!v) this._releaseAll(); }

  bind() {
    const r = this.root;
    const prevent = (e) => { if (e.cancelable) e.preventDefault(); };
    // no scrolling, zooming, or synthetic mouse events from the play surface
    for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) r.addEventListener(ev, prevent, { passive: false });
    r.addEventListener('contextmenu', prevent);
    const down = (e) => {
      prevent(e);
      const b = e.target.closest ? e.target.closest('.tbtn') : null;
      const p = { kind: 'zone', x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: false, btn: null };
      if (b) { p.kind = 'button'; p.btn = b.dataset.id; this._press(p.btn, e); }
      else if (this.game.mode === 'map') { p.kind = 'map'; if (this.pointers.size === 1) { const o = [...this.pointers.values()][0]; if (o.kind === 'map') this.pinch = { d0: Math.hypot(o.x - p.x, o.y - p.y), z0: this.game.tacmap.zoom }; } }
      else if (e.clientX < window.innerWidth * 0.5) { p.kind = 'stick'; this._stickStart(p); }
      else p.kind = 'look';
      this.pointers.set(e.pointerId, p);
      try { r.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    };
    const move = (e) => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      prevent(e);
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.x0, p.y - p.y0) > TAP_PX) p.moved = true;
      if (p.kind === 'stick') this._stickMove(p);
      else if (p.kind === 'look') { this.input.mouse.dx += dx * LOOK_SCALE; this.input.mouse.dy += dy * LOOK_SCALE; }
      else if (p.kind === 'map') {
        const mapPts = [...this.pointers.values()].filter((q) => q.kind === 'map');
        if (mapPts.length >= 2 && this.pinch) { const [a, b] = mapPts; const d = Math.hypot(a.x - b.x, a.y - b.y) || 1; this.game.tacmap.setZoom(this.pinch.z0 * this.pinch.d0 / d); }
        else if (p.moved) this.game.tacmap.panScreen(dx, dy);
      }
    };
    const up = (e) => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      prevent(e);
      this.pointers.delete(e.pointerId);
      const quick = performance.now() - p.t0 < TAP_MS && !p.moved;
      if (p.kind === 'button') this._release(p.btn);
      else if (p.kind === 'stick') this._stickEnd();
      else if (p.kind === 'look') { if (quick) this.queue.push('tapFire'); }
      else if (p.kind === 'map') { if (quick && !this.pinch) this.game.tacmap.tapAt(p.x / window.innerWidth, p.y / window.innerHeight); if (this.pointers.size < 2) this.pinch = null; }
    };
    r.addEventListener('pointerdown', down);
    r.addEventListener('pointermove', move);
    r.addEventListener('pointerup', up);
    r.addEventListener('pointercancel', up);
    window.addEventListener('blur', () => this._releaseAll());
  }

  // ---- stick ----
  _stickStart(p) { this.stick.style.display = ''; this.stick.style.left = p.x0 + 'px'; this.stick.style.top = p.y0 + 'px'; this.knob.style.transform = 'translate(0,0)'; this.input.touchMove.x = 0; this.input.touchMove.y = 0; this.input.touchSprint = false; }
  _stickMove(p) {
    let dx = p.x - p.x0, dy = p.y - p.y0; const l = Math.hypot(dx, dy);
    if (l > STICK_R) { dx *= STICK_R / l; dy *= STICK_R / l; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    let mx = dx / STICK_R, my = -dy / STICK_R; const m = Math.hypot(mx, my);
    if (m < DEAD) { mx = 0; my = 0; } else { const k = (m - DEAD) / (1 - DEAD) / m; mx *= k; my *= k; }
    this.input.touchMove.x = mx; this.input.touchMove.y = my;
    this.input.touchSprint = m > 0.92 && my > 0.3;
    this.stick.classList.toggle('run', this.input.touchSprint);
  }
  _stickEnd() { this.stick.style.display = 'none'; this.input.touchMove.x = 0; this.input.touchMove.y = 0; this.input.touchSprint = false; }

  // ---- buttons ----
  _press(id, e) {
    const inp = this.input, g = this.game;
    this.held.add(id); this.buttons[id].classList.add('down');
    switch (id) {
      case 'fire': inp.mouse.left = true; inp.clicks.push({ button: 0, x: e.clientX, y: e.clientY }); this.queue.push('tapFire'); break;
      case 'knife': this.queue.push('KeyF'); break;
      case 'gate': this.queue.push('tab:KeyQ'); break;
      case 'close': this.queue.push('tab:KeyC'); break;
      case 'action': inp.keys.add('KeyE'); this.queue.push('KeyE'); break;
      case 'map': case 'back': this.queue.push('tab:Tab'); break;
      case 'open': g.tacmap.confirm(); break;
      case 'crouch': this.queue.push('ControlLeft'); break;
      case 'weapon': this.queue.push(g.player && g.player.weapon === 'pistol' ? 'Digit2' : 'Digit1'); break;
      case 'reload': this.queue.push('KeyR'); break;
      case 'grenade': this.queue.push('KeyG'); break;
      case 'pause': g.pause(); break;
    }
  }
  _release(id) {
    const inp = this.input;
    this.held.delete(id); if (this.buttons[id]) this.buttons[id].classList.remove('down');
    if (id === 'fire') { inp.mouse.left = false; inp.mouseUps.push({ button: 0 }); }
    if (id === 'action') inp.keys.delete('KeyE');
  }
  _releaseAll() {
    for (const id of [...this.held]) this._release(id);
    this.pointers.clear(); this.pinch = null; this._stickEnd();
  }

  // ---- per frame (before the player reads input) ----
  update() {
    const g = this.game, inp = this.input, p = g.player;
    for (const a of this.queue) {
      if (a === 'tapFire') inp.tapFire = true;
      else if (a.startsWith('tab:')) { const code = a.slice(4); inp.emit('keydown', code, { preventDefault() {} }); }
      else inp.pressed.add(a);
    }
    this.queue.length = 0;
    const playing = g.state === 'playing' && p && p.alive;
    this.setVisibleButtons(playing);
    if (!playing) return;
    const map = g.mode === 'map';
    const show = (id, on) => { this.buttons[id].classList.toggle('hidden', !on); };
    show('fire', !map); show('knife', !map && !!p.knifeTarget && !p.carrying); show('gate', !map); show('close', g.portals.active);
    show('action', !map && (!!p.interact.target || !!p.carrying)); show('map', !map); show('back', map); show('open', map && !!g.tacmap.preview);
    show('crouch', !map); show('weapon', !map && p.hasRifle); show('reload', !map && p.gun.mag < p.gun.cfg.magSize && p.gun.reserve > 0); show('grenade', !map && p.grenades > 0); show('pause', true);
    this.buttons.knife.classList.toggle('loud', !!p.knifeTarget && p.knifeTarget.state === 'combat');
    this.buttons.crouch.classList.toggle('on', p.crouchToggle);
    if (p.carrying) this.buttons.action.querySelector('span').textContent = i18n.t('touch.action'); 
    this.actionRing.style.setProperty('--p', (p.interact.progress * 360) + 'deg');
    this.zoneL.style.display = map ? 'none' : ''; this.zoneR.style.display = map ? 'none' : '';
    this.root.classList.toggle('map', map);
    const portrait = window.innerHeight > window.innerWidth;
    this.rotateNote.classList.toggle('on', portrait && g.time < 12);
  }
  setVisibleButtons(on) { this.root.style.display = on ? '' : 'none'; if (!on) this._releaseAll(); }
}
