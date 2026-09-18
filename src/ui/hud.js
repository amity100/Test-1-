// In-game HUD: DOM overlay driven by game state each frame.
import * as THREE from 'three';
import { i18n } from '../core/i18n.js';

const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
const _v = new THREE.Vector3();

export class HUD {
  constructor(game, root) {
    this.game = game;
    this.root = el('div', 'hud', root);
    const r = this.root;
    // crosshair
    this.crosshair = el('div', 'crosshair', r); for (let i = 0; i < 4; i++) el('i', 'ch' + i, this.crosshair); el('b', 'dot', this.crosshair);
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
    // bottom-left: health + squad
    this.statusBox = el('div', 'panel status', r);
    const hp = el('div', 'hp', this.statusBox); el('span', 'label', hp, i18n.t('hud.health')); this.hpBar = el('div', 'bar', hp); this.hpFill = el('i', '', this.hpBar);
    this.squadBox = el('div', 'squad', this.statusBox);
    this.squadRows = [];
    // bottom-right: ammo
    this.ammoBox = el('div', 'panel ammo', r);
    this.weaponName = el('div', 'wname', this.ammoBox, 'M4');
    const am = el('div', 'counts', this.ammoBox); this.magEl = el('span', 'mag', am, '30'); el('span', 'sep', am, '/'); this.resEl = el('span', 'res', am, '180');
    this.reloadEl = el('div', 'reload', this.ammoBox, ''); this.grenEl = el('div', 'grenades', this.ammoBox, '');
    this.squadModeEl = el('div', 'squadmode', this.ammoBox, '');
    // center: interaction + hints
    this.prompt = el('div', 'prompt', r); this.promptRing = el('div', 'ring', this.prompt); this.promptText = el('span', '', this.prompt, '');
    this.hintEl = el('div', 'hint', r, '');
    this.toastRoot = el('div', 'toasts', r);
    this.calloutRoot = el('div', 'callouts', r);
    this.alertEl = el('div', 'alert', r, '');
    // architect
    this.archPanel = el('div', 'arch-panel', r);
    el('div', 'arch-title', this.archPanel, i18n.t('hud.architect'));
    const en = el('div', 'energy', this.archPanel); el('span', 'label', en, i18n.t('hud.energy')); this.energyBar = el('div', 'bar', en); this.energyFill = el('i', '', this.energyBar); this.energyNum = el('span', 'num', en, '100');
    this.archHint = el('div', 'arch-hint', this.archPanel, i18n.t('hud.architectHint'));
    this.tooltip = el('div', 'tooltip', r);
    this.dragStatus = el('div', 'drag-status', r);
    this.cursor = el('div', 'vcursor', r);
    this.labels = el('div', 'labels', r);
    this.labelEls = new Map();
    this.objMarker = el('div', 'objmarker', r); this.objMarkerDist = el('span', 'dist', this.objMarker, '');
    this.objMarker.style.display = 'none';
    this.toasts = []; this.hintTimer = 0; this.hitT = 0;
    this.archOn = false; this.energyAnim = 100;
    this.lastHint = null;
    i18n.onChange(() => this.relabel());
    this.hide();
  }

  relabel() {
    this.objBox.querySelector('.label').textContent = i18n.t('hud.objective');
    this.statusBox.querySelector('.label').textContent = i18n.t('hud.health');
    this.archPanel.querySelector('.arch-title').textContent = i18n.t('hud.architect');
    this.archPanel.querySelector('.energy .label').textContent = i18n.t('hud.energy');
    this.archHint.textContent = i18n.t('hud.architectHint');
    if (this.game.script) this.game.script.setPrimary(this.game.script.primary);
  }
  show() { this.root.style.display = ''; }
  hide() { this.root.style.display = 'none'; }

  setObjective(main, opt) { this.objMain.textContent = main || ''; this.objOpt.textContent = opt || ''; this.objOpt.style.display = opt ? '' : 'none'; this.objBox.classList.add('pulse'); setTimeout(() => this.objBox.classList.remove('pulse'), 1200); }
  setTimer(sec) { if (sec == null) { this.timerBox.style.display = 'none'; return; } this.timerBox.style.display = ''; const m = Math.floor(sec / 60), s = Math.floor(sec % 60); this.timerBox.innerHTML = `<span class="label">${i18n.t('hud.extraction')}</span><span class="t">${m}:${s.toString().padStart(2, '0')}</span>`; }
  toast(text, ms = 2600) { const t = el('div', 'toast', this.toastRoot, text); requestAnimationFrame(() => t.classList.add('in')); setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, ms); }
  hint(key) { const text = i18n.t('hint.' + key); this.hintEl.innerHTML = text; this.hintEl.classList.add('in'); this.hintTimer = 7 + text.length * 0.04; this.lastHint = key; }
  callout(kind, who) {
    const name = who ? i18n.t(who.name) : '';
    const n = kind === 'contact' ? 3 : 1;
    const txt = i18n.t('callout.' + kind + (n > 1 ? 1 + Math.floor(Math.random() * n) : ''));
    const c = el('div', 'callout' + (kind === 'enemyGrenade' ? ' danger' : ''), this.calloutRoot, (name ? `<b>${name}:</b> ` : '') + txt);
    setTimeout(() => { c.classList.add('out'); setTimeout(() => c.remove(), 500); }, 3200);
  }
  alert(key, ms = 2200) { this.alertEl.textContent = i18n.t(key); this.alertEl.classList.add('in'); clearTimeout(this._alertT); this._alertT = setTimeout(() => this.alertEl.classList.remove('in'), ms); }
  hitMarker(head, kill) { this.hitmarker.className = 'hitmarker show' + (kill ? ' kill' : '') + (head ? ' head' : ''); this.hitT = 0.25; }
  flash(kind) { /* reserved for weapon switch feedback */ }
  damageFrom(point, player) {
    if (!point) return;
    const dx = point.x - player.pos.x, dz = point.z - player.pos.z;
    const ang = Math.atan2(dx, dz) - player.camYaw; // relative to camera
    const d = el('div', 'dmg', this.dmgRoot); d.style.transform = `rotate(${-ang}rad)`;
    setTimeout(() => d.remove(), 900);
  }
  setArchitect(on) { this.archOn = on; this.root.classList.toggle('architect', on); }
  setModuleTooltip(mod, reachOK, energyOK) {
    if (!mod) { this.tooltip.style.display = 'none'; return; }
    this.tooltip.style.display = '';
    const cost = mod.cfg.cost;
    this.tooltip.innerHTML = `<b>${i18n.t(mod.cfg.label)}</b><span class="${energyOK ? '' : 'bad'}">${i18n.t('module.cost')}: ${cost}</span>${reachOK ? '' : `<span class="bad">${i18n.t('hud.invalid.reach')}</span>`}`;
  }
  setDragStatus(ok, reason, mod) {
    if (ok === null || ok === undefined) { this.dragStatus.style.display = 'none'; return; }
    this.dragStatus.style.display = ''; this.dragStatus.className = 'drag-status ' + (ok ? 'ok' : 'bad');
    this.dragStatus.textContent = ok ? `${i18n.t(mod.cfg.label)} · −${mod.cfg.cost}` : reason;
  }

  // ---- per frame ----
  update(realDt) {
    const g = this.game, p = g.player;
    if (!p) return;
    // crosshair spread
    const spread = (p.aiming > 0.5 ? 6 : 14) + p.gun.spread * 400 + Math.min(1, Math.hypot(p.vel.x, p.vel.z) / 6) * 10;
    this.crosshair.style.setProperty('--sp', spread + 'px');
    this.crosshair.style.opacity = g.mode === 'ground' && p.alive && !p.sprinting ? 1 : 0;
    if (this.hitT > 0) { this.hitT -= realDt; if (this.hitT <= 0) this.hitmarker.className = 'hitmarker'; }
    // health
    const hp = Math.max(0, p.health / p.maxHealth);
    this.hpFill.style.width = (hp * 100).toFixed(1) + '%'; this.hpBar.classList.toggle('low', hp < 0.35);
    // ammo
    this.magEl.textContent = p.gun.mag; this.resEl.textContent = p.gun.reserve === Infinity ? '∞' : p.gun.reserve;
    this.magEl.classList.toggle('low', p.gun.mag <= 6);
    this.reloadEl.textContent = p.gun.reloading > 0 ? i18n.t('hud.reload') + '…' : (p.gun.mag === 0 ? i18n.t('hud.empty') : '');
    this.grenEl.innerHTML = '●'.repeat(p.grenades) + '<span class="dim">' + '○'.repeat(Math.max(0, 3 - p.grenades)) + '</span>';
    this.squadModeEl.textContent = i18n.t(g.squadMode === 'hold' ? 'hud.squadHold' : g.squadMode === 'move' ? 'hud.squadMove' : 'hud.squadFollow');
    // squad rows
    const squad = g.squad;
    while (this.squadRows.length < squad.length) { const row = el('div', 'srow', this.squadBox); const n = el('span', 'name', row); const bar = el('div', 'bar', row); const fill = el('i', '', bar); const st = el('span', 'st', row); this.squadRows.push({ row, n, fill, st, bar }); }
    squad.forEach((s, i) => { const r = this.squadRows[i]; r.n.textContent = i18n.t(s.name); r.fill.style.width = (Math.max(0, s.health / s.maxHealth) * 100).toFixed(0) + '%'; r.row.classList.toggle('downed', s.downed); r.row.classList.toggle('dead', s.dead); r.st.textContent = s.downed ? i18n.t('hud.downed') + ' ' + Math.ceil(s.downTimer) : s.dead ? '✕' : ''; });
    // compass
    const deg = THREE.MathUtils.euclideanModulo(-p.camYaw * 180 / Math.PI, 360);
    this.compassStrip.style.transform = `translateX(${-(deg * 2 + 720 - this.compass.clientWidth / 2)}px)`;
    // interaction prompt
    const it = p.interact;
    if (it.target && g.mode === 'ground') { this.prompt.style.display = ''; this.promptText.textContent = i18n.t(it.target.prompt); this.promptRing.style.setProperty('--p', (it.progress * 360) + 'deg'); }
    else this.prompt.style.display = 'none';
    // hint timeout
    if (this.hintTimer > 0) { this.hintTimer -= realDt; if (this.hintTimer <= 0) this.hintEl.classList.remove('in'); }
    // architect
    if (this.archOn) {
      const a = g.architect;
      this.energyAnim += (a.energy - this.energyAnim) * Math.min(1, realDt * 10);
      this.energyFill.style.width = (this.energyAnim / 100 * 100).toFixed(1) + '%'; this.energyNum.textContent = Math.floor(a.energy);
      this.cursor.style.transform = `translate(${a.cursor.x * g.width}px, ${a.cursor.y * g.height}px)`;
      this.tooltip.style.transform = `translate(${a.cursor.x * g.width + 18}px, ${a.cursor.y * g.height + 18}px)`;
      this.cursor.className = 'vcursor' + (a.dragging ? ' drag' : a.hover ? ' hover' : '');
    }
    this._updateLabels();
    this._updateObjectiveMarker();
  }

  _updateObjectiveMarker() {
    const g = this.game, cam = g.camera, m = this.objMarker;
    const target = g.script ? g.script.objectiveMarker() : null;
    if (!target || g.mode === 'architect') { m.style.display = 'none'; return; }
    _v.set(target.x, target.y + 1.6, target.z).project(cam);
    const behind = _v.z > 1;
    let x = (_v.x * 0.5 + 0.5) * g.width, y = (-_v.y * 0.5 + 0.5) * g.height;
    if (behind) { x = g.width - x; y = g.height - 30; }
    const pad = 40; x = Math.max(pad, Math.min(g.width - pad, x)); y = Math.max(pad, Math.min(g.height - pad, y));
    m.style.display = ''; m.style.transform = `translate(${x}px, ${y}px)`;
    const d = Math.hypot(target.x - g.player.pos.x, target.z - g.player.pos.z);
    this.objMarkerDist.textContent = Math.round(d) + ' m';
    m.classList.toggle('offscreen', behind || x === pad || x === g.width - pad || y === pad || y === g.height - pad);
  }

  _updateLabels() {
    const g = this.game, cam = g.camera;
    const seen = new Set();
    const place = (key, ch, text, cls) => {
      let e = this.labelEls.get(key); if (!e) { e = el('div', 'wlabel ' + cls, this.labels); this.labelEls.set(key, e); }
      seen.add(key);
      _v.set(ch.pos.x, ch.pos.y + ch.currentHeight + 0.35, ch.pos.z).project(cam);
      const behind = _v.z > 1; const x = (_v.x * 0.5 + 0.5) * g.width, y = (-_v.y * 0.5 + 0.5) * g.height;
      const dist = cam.position.distanceTo(ch.pos);
      if (behind || x < 0 || x > g.width || y < 0 || y > g.height || (g.mode === 'ground' && dist > 45)) { e.style.display = 'none'; return; }
      e.style.display = ''; e.style.transform = `translate(${x}px, ${y}px)`; e.style.opacity = Math.max(0.35, 1 - dist / 60);
      e.textContent = text; e.className = 'wlabel ' + cls;
    };
    for (const s of g.squad) { if (s.dead) continue; place('s' + s.slot, s, i18n.t(s.name) + (s.downed ? ' · ' + i18n.t('hud.downed') : ''), s.downed ? 'squad downed' : 'squad'); }
    for (const h of g.hostages) { if (!h.alive) continue; place('h' + h.id, h, i18n.t(h.name), 'hostage'); }
    if (g.mode === 'architect') for (const e of g.enemies) { if (e.alive && e.seenByFriendly) place('e' + e.id, e, e.state === 'combat' ? '!' : e.state === 'patrol' ? '' : '?', 'enemy'); }
    for (const [k, e] of this.labelEls) if (!seen.has(k)) e.style.display = 'none';
  }
}
