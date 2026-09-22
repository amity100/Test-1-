// In-game HUD: DOM overlay driven by game state each frame.
import * as THREE from 'three';
import { i18n } from '../core/i18n.js';
import { CONFIG } from '../core/config.js';

const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
// Writing the same value back into the DOM every frame still costs a style recalculation, and on a phone that is
// milliseconds. These only touch the element when the value changed.
const txt = (e, v) => { if (e._t !== v) { e._t = v; e.textContent = v; } };
const html = (e, v) => { if (e._h !== v) { e._h = v; e.innerHTML = v; } };
const sty = (e, k, v) => { const c = e._s || (e._s = {}); if (c[k] !== v) { c[k] = v; e.style[k] = v; } };
const prop = (e, k, v) => { const c = e._p || (e._p = {}); if (c[k] !== v) { c[k] = v; e.style.setProperty(k, v); } };
const _v = new THREE.Vector3();

export class HUD {
  constructor(game, root) {
    this.game = game;
    this.root = el('div', 'hud', root);
    if (game.isTouch) this.root.classList.add('touch');
    const r = this.root;
    this.crosshair = el('div', 'crosshair', r); for (let i = 0; i < 4; i++) el('i', 'ch' + i, this.crosshair); el('b', 'dot', this.crosshair);
    this.knifeEl = el('div', 'knife-prompt', r, '');
    this.hitmarker = el('div', 'hitmarker', r); for (let i = 0; i < 4; i++) el('i', '', this.hitmarker);
    this.dmgRoot = el('div', 'dmg-root', r);
    // top-left objective
    this.objBox = el('div', 'panel objective', r);
    el('div', 'label', this.objBox, i18n.t('hud.objective'));
    this.objMain = el('div', 'obj-main', this.objBox, '');
    this.objOpt = el('div', 'obj-opt', this.objBox, '');
    this.timerBox = el('div', 'panel timer', r, ''); this.timerBox.style.display = 'none';
    // compass
    this.compass = el('div', 'compass', r); this.compassStrip = el('div', 'strip', this.compass);
    const marks = []; for (let i = -1; i <= 1; i++) for (const [deg, label] of [[0, 'N'], [45, ''], [90, 'E'], [135, ''], [180, 'S'], [225, ''], [270, 'W'], [315, '']]) marks.push(`<span style="left:${(i * 360 + deg) * 2 + 720}px" class="${label ? 'major' : ''}">${label || '·'}</span>`);
    this.compassStrip.innerHTML = marks.join('');
    // bottom-left: health + focus + alarm
    this.statusBox = el('div', 'panel status', r);
    const hp = el('div', 'hp', this.statusBox); el('span', 'label', hp, i18n.t('hud.health')); this.hpBar = el('div', 'bar', hp); this.hpFill = el('i', '', this.hpBar);
    const fo = el('div', 'focus', this.statusBox); el('span', 'label', fo, i18n.t('hud.focus')); this.focusBar = el('div', 'bar', fo); this.focusFill = el('i', '', this.focusBar);
    this.alarmChip = el('div', 'alarm-chip', this.statusBox, i18n.t('hud.alarmOn'));
    // bottom-right: weapon
    this.ammoBox = el('div', 'panel ammo', r);
    this.weaponName = el('div', 'wname', this.ammoBox, '');
    const am = el('div', 'counts', this.ammoBox); this.magEl = el('span', 'mag', am, '12'); el('span', 'sep', am, '/'); this.resEl = el('span', 'res', am, '72');
    this.reloadEl = el('div', 'reload', this.ammoBox, ''); this.grenEl = el('div', 'grenades', this.ammoBox, '');
    this.carryEl = el('div', 'carry', this.ammoBox, '');
    // center: interaction + hints
    this.prompt = el('div', 'prompt', r); this.promptRing = el('div', 'ring', this.prompt); this.promptText = el('span', '', this.prompt, '');
    this.hintEl = el('div', 'hint', r, '');
    this.toastRoot = el('div', 'toasts', r);
    this.calloutRoot = el('div', 'callouts', r);
    this.alertEl = el('div', 'alert', r, '');
    this.chainEl = el('div', 'chain', r, '');
    // top-right: who is on the radio
    this.witnessBox = el('div', 'witness-panel', r);
    el('div', 'wtitle', this.witnessBox, i18n.t('hud.witness'));
    this.witnessRows = el('div', 'wrows', this.witnessBox);
    // map
    this.mapPanel = el('div', 'map-panel', r);
    el('div', 'map-title', this.mapPanel, i18n.t('hud.map'));
    this.mapHint = el('div', 'map-hint', this.mapPanel, this.tt('hud.mapHint'));
    this.portalStatus = el('div', 'portal-status', r, '');
    this.cursor = el('div', 'vcursor', r);
    this.labels = el('div', 'labels', r);
    this.labelEls = new Map();
    this.objMarker = el('div', 'objmarker', r); this.objMarkerDist = el('span', 'dist', this.objMarker, '');
    this.objMarker.style.display = 'none';
    this.toasts = []; this.hintTimer = 0; this.hitT = 0;
    this.mapOn = false; this.focusAnim = 0;
    this.lastHint = null;
    i18n.onChange(() => this.relabel());
    this.hide();
  }

  // touch-aware string: the .touch variant when the game runs on touch controls
  tt(key, vars) { const k = this.game.isTouch && i18n.has(key + '.touch') ? key + '.touch' : key; return i18n.t(k, vars); }
  relabel() {
    this.objBox.querySelector('.label').textContent = i18n.t('hud.objective');
    this.statusBox.querySelector('.hp .label').textContent = i18n.t('hud.health');
    this.statusBox.querySelector('.focus .label').textContent = i18n.t('hud.focus');
    this.alarmChip.textContent = i18n.t('hud.alarmOn');
    this.witnessBox.querySelector('.wtitle').textContent = i18n.t('hud.witness');
    this.mapPanel.querySelector('.map-title').textContent = i18n.t('hud.map');
    this.mapHint.textContent = this.tt('hud.mapHint');
    if (this.game.script) this.game.script.setPrimary(this.game.script.primary);
  }
  show() { this.root.style.display = ''; }
  hide() { this.root.style.display = 'none'; }

  setObjective(main, opt) { this.objMain.textContent = main || ''; this.objOpt.textContent = opt || ''; this.objOpt.style.display = opt ? '' : 'none'; this.objBox.classList.add('pulse'); setTimeout(() => this.objBox.classList.remove('pulse'), 1200); }
  setTimer(sec) { if (sec == null) { this.timerBox.style.display = 'none'; return; } this.timerBox.style.display = ''; const m = Math.floor(sec / 60), s = Math.floor(sec % 60); this.timerBox.innerHTML = `<span class="label">${i18n.t('hud.extraction') === 'hud.extraction' ? i18n.t('obj.hold') : i18n.t('hud.extraction')}</span><span class="t">${m}:${s.toString().padStart(2, '0')}</span>`; }
  toast(text, ms = 2600) { const t = el('div', 'toast', this.toastRoot, text); requestAnimationFrame(() => t.classList.add('in')); setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, ms); }
  hint(key) { if (this.tutKey) return; const text = this.tt('hint.' + key); this.hintEl.innerHTML = text; this.hintEl.classList.remove('tut'); this.hintEl.classList.add('in'); this.hintTimer = 7 + text.length * 0.04; this.lastHint = key; }
  // A tutorial prompt stays on screen until it is cleared.
  tutorial(key) {
    this.tutKey = key;
    if (!key) { this.hintEl.classList.remove('in', 'tut'); this.hintTimer = 0; return; }
    this.hintEl.innerHTML = this.tt('tut.' + key); this.hintEl.classList.add('in', 'tut'); this.hintTimer = 1e9;
  }
  // Opening card: the four verbs; resolves on the first key or click.
  showIntro(onDone) {
    const t = (k) => this.tt(k);
    const touch = this.game.isTouch;
    const o = el('div', 'intro', this.game.container);
    o.innerHTML = `<div class="card"><div class="ititle">${t('intro.title')}</div>
      <div class="row"><kbd>${touch ? '✥' : 'WASD'}</kbd><span>${t('intro.move')}</span></div>
      <div class="row"><kbd>${touch ? i18n.t('touch.map') : 'TAB'}</kbd><span>${t('intro.map')}</span></div>
      <div class="row"><kbd>${touch ? i18n.t('touch.knife') : 'F'}</kbd><span>${t('intro.knife')}</span></div>
      <div class="row"><span class="ringswatch"><i></i></span><span>${t('intro.witness')}</span></div>
      <div class="skip">${t('intro.skip')}</div></div>`;
    const done = (e) => { if (e && e.type === 'keydown' && (e.code === 'Tab' || e.code === 'Escape')) e.preventDefault(); if (e && e.type === 'pointerdown') e.preventDefault(); window.removeEventListener('keydown', done, true); o.removeEventListener('pointerdown', done); o.remove(); onDone(); };
    setTimeout(() => { window.addEventListener('keydown', done, true); o.addEventListener('pointerdown', done); }, 400);
    this.introEl = o;
    return o;
  }
  callout(kind, who) {
    const name = who ? i18n.t(who.name) : '';
    const txt = i18n.t('callout.' + kind);
    const c = el('div', 'callout' + (kind === 'enemyGrenade' ? ' danger' : kind.startsWith('radio') ? ' radio' : ''), this.calloutRoot, (name ? `<b>${name}:</b> ` : '') + txt);
    setTimeout(() => { c.classList.add('out'); setTimeout(() => c.remove(), 500); }, 3600);
  }
  alert(key, ms = 2200) { this.alertEl.textContent = i18n.t(key); this.alertEl.classList.add('in'); clearTimeout(this._alertT); this._alertT = setTimeout(() => this.alertEl.classList.remove('in'), ms); }
  chain(n) {
    if (n < 2) { this.chainEl.classList.remove('on'); return; }
    this.chainEl.innerHTML = `<b>×${n}</b><span>${i18n.t('hud.chain')}</span>`;
    this.chainEl.classList.add('on'); this.chainEl.classList.remove('pop'); void this.chainEl.offsetWidth; this.chainEl.classList.add('pop');
  }
  hitMarker(head, kill) { this.hitmarker.className = 'hitmarker show' + (kill ? ' kill' : '') + (head ? ' head' : ''); this.hitT = 0.25; }
  flash(kind) { if (kind === 'weapon') { this.ammoBox.classList.add('pulse'); setTimeout(() => this.ammoBox.classList.remove('pulse'), 400); } }
  damageFrom(point, player) {
    if (!point) return;
    const dx = point.x - player.pos.x, dz = point.z - player.pos.z;
    const ang = Math.atan2(dx, dz) - player.camYaw;
    const d = el('div', 'dmg', this.dmgRoot); d.style.transform = `rotate(${-ang}rad)`;
    setTimeout(() => d.remove(), 900);
  }
  setMap(on) { this.mapOn = on; this.root.classList.toggle('map', on); }

  // ---- per frame ----
  update(realDt) {
    const g = this.game, p = g.player;
    if (!p) return;
    const spread = Math.round((p.aiming > 0.5 ? 6 : 14) + p.gun.spread * 400 + Math.min(1, Math.hypot(p.vel.x, p.vel.z) / 6) * 10);
    prop(this.crosshair, '--sp', spread + 'px');
    sty(this.crosshair, 'opacity', g.mode === 'ground' && p.alive && !p.sprinting && !p.carrying ? '1' : '0');
    this.crosshair.classList.toggle('locked', !!p.lockTarget);
    if (this.hitT > 0) { this.hitT -= realDt; if (this.hitT <= 0) this.hitmarker.className = 'hitmarker'; }
    // knife prompt
    const kt = p.knifeTarget && g.mode === 'ground' && p.alive && !g.isTouch;
    sty(this.knifeEl, 'display', kt ? '' : 'none');
    if (kt) { const silent = p.knifeTarget.state !== 'combat' && !p.knifeTarget.armor; html(this.knifeEl, `<kbd>F</kbd> ${i18n.t(p.knifeTarget.armor ? 'hud.knifeArmored' : 'hud.knife')}`); this.knifeEl.classList.toggle('loud', !silent); }
    // health / focus / alarm
    const hp = Math.max(0, p.health / p.maxHealth);
    sty(this.hpFill, 'width', (hp * 100).toFixed(1) + '%'); this.hpBar.classList.toggle('low', hp < 0.35);
    this.focusAnim += (g.focus / CONFIG.focus.max - this.focusAnim) * Math.min(1, realDt * 12);
    sty(this.focusFill, 'width', (this.focusAnim * 100).toFixed(1) + '%'); this.focusBar.parentElement.classList.toggle('on', g.focus > 0);
    sty(this.alarmChip, 'display', g.alarm ? '' : 'none');
    // weapon
    txt(this.weaponName, i18n.t(p.gun.cfg.name) + (p.hasRifle ? '  ·  1 / 2' : ''));
    txt(this.magEl, String(p.gun.mag)); txt(this.resEl, p.gun.reserve === Infinity ? '∞' : String(p.gun.reserve));
    this.magEl.classList.toggle('low', p.gun.mag <= 3);
    txt(this.reloadEl, p.gun.reloading > 0 ? i18n.t('hud.reload') + '…' : (p.gun.mag === 0 ? i18n.t('hud.empty') : ''));
    html(this.grenEl, p.grenades > 0 ? '●'.repeat(p.grenades) : '');
    txt(this.carryEl, p.carrying ? this.tt('hud.carrying') : '');
    // compass
    const deg = THREE.MathUtils.euclideanModulo(-p.camYaw * 180 / Math.PI, 360);
    this._compassW = this._compassW || this.compass.clientWidth;
    sty(this.compassStrip, 'transform', `translateX(${(-(deg * 2 + 720 - this._compassW / 2)).toFixed(1)}px)`);
    // interaction prompt
    const it = p.interact;
    if (it.target && g.mode === 'ground' && !p.carrying) { sty(this.prompt, 'display', ''); txt(this.promptText, this.tt(it.target.prompt)); prop(this.promptRing, '--p', Math.round(it.progress * 360) + 'deg'); }
    else sty(this.prompt, 'display', 'none');
    if (this.hintTimer > 0) { this.hintTimer -= realDt; if (this.hintTimer <= 0) this.hintEl.classList.remove('in'); }
    // radio panel
    this._updateWitnesses();
    // gateway status
    const ps = g.portals;
    txt(this.portalStatus, ps.state === 'open' ? this.tt('hud.portal.open') : ps.state === 'opening' ? i18n.t('hud.portal.opening') : this.tt('hud.portal.closed'));
    this.portalStatus.classList.toggle('on', ps.active);
    // map cursor
    if (this.mapOn) {
      const m = g.tacmap;
      sty(this.cursor, 'transform', `translate(${(m.cursor.x * g.width).toFixed(0)}px, ${(m.cursor.y * g.height).toFixed(0)}px)`);
      const cc = 'vcursor' + (m.hoverPlacement ? (m.hoverOK ? ' ok' : ' bad') : '');
      if (this.cursor.className !== cc) this.cursor.className = cc;
    }
    this._updateLabels();
    this._updateObjectiveMarker();
  }

  _updateWitnesses() {
    const g = this.game;
    const list = g.witnesses();
    this.witnessBox.classList.toggle('on', list.length > 0);
    const rows = this.witnessRows;
    while (rows.children.length < list.length) { const row = el('div', 'wrow', rows); el('span', 'who', row); const bar = el('div', 'bar', row); el('i', '', bar); el('span', 't', row); }
    while (rows.children.length > list.length) rows.lastChild.remove();
    list.forEach((e, i) => {
      const row = rows.children[i]; const k = e.report.t / e.report.total;
      txt(row.querySelector('.who'), `${i18n.t(e.name)}${e.zoneName ? ' · ' + i18n.t(e.zoneName) : ''} — ${i18n.t('hud.witness.' + e.report.reason)}`);
      sty(row.querySelector('.bar i'), 'width', (k * 100).toFixed(1) + '%');
      txt(row.querySelector('.t'), e.report.t.toFixed(1));
      row.classList.toggle('urgent', e.report.t < 1.3);
    });
  }

  _updateObjectiveMarker() {
    const g = this.game, cam = g.camera, m = this.objMarker;
    const target = g.script ? g.script.objectiveMarker() : null;
    if (!target || g.mode === 'map') { sty(m, 'display', 'none'); return; }
    _v.set(target.x, target.y + 1.6, target.z).project(cam);
    const behind = _v.z > 1;
    let x = (_v.x * 0.5 + 0.5) * g.width, y = (-_v.y * 0.5 + 0.5) * g.height;
    if (behind) { x = g.width - x; y = g.height - 30; }
    const pad = 40; x = Math.max(pad, Math.min(g.width - pad, x)); y = Math.max(pad, Math.min(g.height - pad, y));
    sty(m, 'display', ''); sty(m, 'transform', `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`);
    const d = Math.hypot(target.x - g.player.pos.x, target.z - g.player.pos.z);
    txt(this.objMarkerDist, Math.round(d) + ' m');
    m.classList.toggle('offscreen', behind || x === pad || x === g.width - pad || y === pad || y === g.height - pad);
  }

  _updateLabels() {
    const g = this.game, cam = g.camera;
    const seen = new Set();
    const place = (key, pos, height, markup, cls, maxDist = 45) => {
      let e = this.labelEls.get(key); if (!e) { e = el('div', 'wlabel ' + cls, this.labels); this.labelEls.set(key, e); }
      seen.add(key);
      _v.set(pos.x, pos.y + height, pos.z).project(cam);
      const behind = _v.z > 1; const x = (_v.x * 0.5 + 0.5) * g.width, y = (-_v.y * 0.5 + 0.5) * g.height;
      const dist = cam.position.distanceTo(pos);
      // on phones the right-hand strip belongs to the buttons: a label drifting under them is hidden, not fought over
      const underButtons = g.isTouch && g.mode === 'ground' && x > g.width - 150 && y > g.height * 0.2;
      if (behind || underButtons || x < -40 || x > g.width + 40 || y < -40 || y > g.height + 40 || (g.mode === 'ground' && dist > maxDist)) { sty(e, 'display', 'none'); return e; }
      sty(e, 'display', ''); sty(e, 'transform', `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`);
      sty(e, 'opacity', (g.mode === 'map' ? 1 : Math.max(0.4, 1 - dist / 70)).toFixed(2));
      if (e.innerHTML !== markup) e.innerHTML = markup;
      if (e.className !== 'wlabel ' + cls) e.className = 'wlabel ' + cls;
      return e;
    };
    const map = g.mode === 'map', p = g.player;
    for (const h of g.hostages) { if (!h.alive) continue; place('h' + h.id, h.pos, h.currentHeight + 0.35, i18n.t(h.name), 'hostage'); }
    // the marker under the crosshair: how far the gateway would open
    if (!map && p.alive && g.aimGate) { const a = g.aimGate; const d = Math.hypot(a.x - p.pos.x, a.z - p.pos.z); place('aim', a, 2.55, `${Math.round(d)} m`, 'aim' + (a.ok ? '' : ' bad'), 60); }
    // the guard a gateway would open behind
    if (!map && p.alive && p.lockTarget) { const t = p.lockTarget; place('lock', t.pos, t.currentHeight * 0.62, `<i></i><i></i><i></i><i></i><small>${this.tt(t.armor ? 'hud.lockArmored' : 'hud.lock')}</small>`, 'lock' + (t.report.active || t.armor ? ' hot' : ''), 60); }
    // guards on the radio: always shown, the ring is the countdown
    for (const e of g.enemies) {
      if (!e.alive) { if (map) place('b' + e.id, e.pos, 0.6, '✕', 'body'); continue; }
      if (e.report.active) {
        const k = e.report.t / e.report.total;
        const go = !map && e === p.lockTarget ? `<b class="go">${this.tt('hud.lockGo')}</b>` : '';
        place('r' + e.id, e.pos, e.currentHeight + 0.5, `<div class="ring" style="--p:${(k * 360).toFixed(1)}deg"><span>${Math.ceil(e.report.t)}</span></div><small>${i18n.t('hud.witness.' + e.report.reason)}</small>${go}`, 'wring' + (e.report.t < 1.3 ? ' urgent' : ''), 200);
      } else if (map && (e.seenByFriendly || e.state === 'combat')) place('e' + e.id, e.pos, e.currentHeight + 0.35, e.state === 'combat' ? '!' : e.state === 'patrol' || e.state === 'post' ? '' : '?', 'enemy');
    }
    if (map) {
      const ps = g.portals;
      if (ps.active) { place('pa', ps.a.pos, 2.6, 'A', 'portal'); place('pb', ps.b.pos, 2.6, 'B', 'portal'); }
      for (const zl of g.level.zoneLabels || []) place('z' + zl.key, { x: zl.x, y: 0, z: zl.z }, 0, i18n.t(zl.key), 'zone');
      const s = g.tacmap.suggestion, pv = g.tacmap.preview;
      const nearSugg = s && pv && Math.hypot(pv.x - s.x, pv.z - s.z) < 2.5;
      if (s && !nearSugg) place('tut', { x: s.x, y: s.y, z: s.z }, 2.8, this.tt('tut.here'), 'tut');
      if (pv && g.isTouch) place('pv', { x: pv.x, y: pv.y, z: pv.z }, 3.1, i18n.t('touch.tapAgain'), 'tut preview');
    }
    for (const [k, e] of this.labelEls) if (!seen.has(k)) sty(e, 'display', 'none');
  }
}
