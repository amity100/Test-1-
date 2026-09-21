// Menus: loading, main, pause, settings, controls, end screens.
import { i18n } from '../core/i18n.js';

const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };

export class Menus {
  constructor(game, root) {
    this.game = game;
    this.root = el('div', 'menus', root);
    this.screens = {};
    this.settings = this.loadSettings();
    this._build();
    i18n.onChange(() => this._relabel());
  }

  loadSettings() {
    const d = { quality: this.game.isTouch ? 'medium' : 'high', sensitivity: 1.0, invertY: false, volume: 0.8, difficulty: 'normal', brightness: 1.0 };
    try { const s = JSON.parse(localStorage.getItem('vantage.settings') || '{}'); return { ...d, ...s }; } catch (e) { return d; }
  }
  saveSettings() { try { localStorage.setItem('vantage.settings', JSON.stringify(this.settings)); } catch (e) { /* ignore */ } this.game.applySettings(this.settings); }

  screen(name) { const s = el('div', 'screen ' + name, this.root); this.screens[name] = s; return s; }
  show(name) { for (const k in this.screens) this.screens[k].classList.toggle('on', k === name); this.current = name; this.root.classList.toggle('on', !!name); }
  hide() { this.show(null); }

  _btn(parent, key, onClick, cls = '') { const b = el('button', 'btn ' + cls, parent, i18n.t(key)); b.dataset.key = key; b.onclick = () => { this.game.audio.start(); this.game.audio.ui('click'); onClick(); }; b.onmouseenter = () => this.game.audio.ui('hover'); return b; }

  _build() {
    const t = i18n.t;
    // loading
    const ld = this.screen('loading');
    el('div', 'title', ld, 'VANTAGE'); this.loadText = el('div', 'sub', ld, t('menu.loading')); const bar = el('div', 'loadbar', ld); this.loadFill = el('i', '', bar);
    // main
    const mn = this.screen('main');
    el('div', 'title', mn, 'VANTAGE'); this.subtitle = el('div', 'sub', mn, t('subtitle'));
    const mission = el('div', 'mission', mn); this.missionTitle = el('div', 'mtitle', mission, t('menu.mission1')); this.briefing = el('div', 'briefing', mission, t('menu.briefing'));
    const col = el('div', 'col', mn);
    this._btn(col, 'menu.play', () => this.game.startMission(), 'primary');
    this._btn(col, 'menu.controls', () => this.show('controls'));
    this._btn(col, 'menu.settings', () => { this.settingsBack = 'main'; this.show('settings'); });
    const lang = el('div', 'langrow', mn);
    for (const [code, label] of [['en', 'English'], ['he', 'עברית']]) { const b = el('button', 'lang', lang, label); b.onclick = () => { i18n.set(code); this.game.audio.ui('click'); }; }
    this.credits = el('div', 'credits', mn, t('end.credits'));
    // pause
    const ps = this.screen('pause');
    this.pauseTitle = el('div', 'title small', ps, t('menu.paused'));
    const pc = el('div', 'col', ps);
    this._btn(pc, 'menu.resume', () => this.game.resume(), 'primary');
    this._btn(pc, 'menu.restart', () => this.game.restoreCheckpoint());
    this._btn(pc, 'menu.restartMission', () => this.game.startMission());
    this._btn(pc, 'menu.controls', () => { this.controlsBack = 'pause'; this.show('controls'); });
    this._btn(pc, 'menu.settings', () => { this.settingsBack = 'pause'; this.show('settings'); });
    this._btn(pc, 'menu.quit', () => this.game.quitToMenu());
    // controls
    const ct = this.screen('controls');
    el('div', 'title small', ct, t('menu.controls'));
    this.controlsBody = el('div', 'ctl-body', ct);
    this._btn(ct, 'menu.back', () => this.show(this.controlsBack || 'main'));
    // settings
    const st = this.screen('settings');
    el('div', 'title small', st, t('menu.settings'));
    const form = el('div', 'form', st); this.form = form;
    const row = (key) => { const r = el('div', 'row', form); el('span', 'rl', r, t(key)).dataset.key = key; return r; };
    { const r = row('menu.quality'); const sel = el('select', '', r); for (const q of ['low', 'medium', 'high', 'ultra']) { const o = el('option', '', sel, t('menu.quality.' + q)); o.value = q; o.dataset.key = 'menu.quality.' + q; } sel.value = this.settings.quality; sel.onchange = () => { this.settings.quality = sel.value; this.saveSettings(); }; }
    { const r = row('menu.difficulty'); const sel = el('select', '', r); for (const q of ['easy', 'normal', 'hard']) { const o = el('option', '', sel, t('menu.difficulty.' + q)); o.value = q; o.dataset.key = 'menu.difficulty.' + q; } sel.value = this.settings.difficulty; sel.onchange = () => { this.settings.difficulty = sel.value; this.saveSettings(); }; }
    { const r = row('menu.sensitivity'); const inp = el('input', '', r); inp.type = 'range'; inp.min = 0.3; inp.max = 2.5; inp.step = 0.05; inp.value = this.settings.sensitivity; inp.oninput = () => { this.settings.sensitivity = +inp.value; this.saveSettings(); }; }
    { const r = row('menu.brightness'); const inp = el('input', '', r); inp.type = 'range'; inp.min = 0.6; inp.max = 2.0; inp.step = 0.05; inp.value = this.settings.brightness; inp.oninput = () => { this.settings.brightness = +inp.value; this.saveSettings(); }; }
    { const r = row('menu.volume'); const inp = el('input', '', r); inp.type = 'range'; inp.min = 0; inp.max = 1; inp.step = 0.05; inp.value = this.settings.volume; inp.oninput = () => { this.settings.volume = +inp.value; this.saveSettings(); }; }
    { const r = row('menu.invertY'); const inp = el('input', '', r); inp.type = 'checkbox'; inp.checked = this.settings.invertY; inp.onchange = () => { this.settings.invertY = inp.checked; this.saveSettings(); }; }
    { const r = row('menu.language'); const sel = el('select', '', r); for (const [c, l] of [['en', 'English'], ['he', 'עברית']]) { const o = el('option', '', sel, l); o.value = c; } sel.value = i18n.lang; sel.onchange = () => i18n.set(sel.value); this.langSel = sel; }
    this._btn(st, 'menu.back', () => this.show(this.settingsBack || 'main'));
    // end
    const en = this.screen('end');
    this.endTitle = el('div', 'title small', en, ''); this.endSub = el('div', 'sub', en, '');
    this.endStats = el('div', 'stats', en);
    const ec = el('div', 'col', en);
    this.endRetry = this._btn(ec, 'end.checkpoint', () => this.game.restoreCheckpoint(), 'primary');
    this.endReplay = this._btn(ec, 'menu.restartMission', () => this.game.startMission());
    this._btn(ec, 'end.menu', () => this.game.quitToMenu());
    // click-to-resume overlay (pointer lock)
    const cl = this.screen('click');
    this.clickText = el('div', 'sub big', cl, t('menu.clickToStart'));
    cl.onclick = () => { this.game.audio.start(); this.game.resumeFromClick(); };
    this._relabel();
  }

  _relabel() {
    const t = i18n.t;
    this.root.querySelectorAll('[data-key]').forEach((e) => { e.textContent = t(e.dataset.key); });
    this.subtitle.textContent = t('subtitle'); this.missionTitle.textContent = t('menu.mission1'); this.briefing.textContent = t('menu.briefing'); this.credits.textContent = t('end.credits');
    this.pauseTitle.textContent = t('menu.paused'); this.loadText.textContent = t('menu.loading'); this.clickText.textContent = this.game.isTouch ? t('menu.clickToStart.touch') : t('menu.clickToStart');
    if (this.langSel) this.langSel.value = i18n.lang;
    const rows = [
      ['controls.ground', null],
      ['controls.move', 'W A S D'], ['controls.sprint', 'Shift'], ['controls.crouch', 'Ctrl / Z'], ['controls.jump', 'Space'], ['controls.fire', 'LMB'], ['controls.aim', 'RMB'], ['controls.reload', 'R'], ['controls.knife', 'F'], ['controls.weapon', '1 / 2 / Wheel'], ['controls.grenade', 'G'], ['controls.interact', 'E'], ['controls.throw', 'LMB'], ['controls.quickPortal', 'Q'], ['controls.lockGate', 'X'], ['controls.closePortal', 'C'], ['controls.map', 'Tab'], ['controls.pause', 'Esc'],
      ['controls.mapSection', null],
      ['controls.map.place', 'LMB'], ['controls.map.close', 'RMB'], ['controls.map.pan', 'W A S D / edges'], ['controls.map.orbit', 'Q / E / MMB'], ['controls.map.zoom', 'Wheel'], ['controls.map.center', 'F'], ['controls.map.back', 'Tab'],
    ];
    this.controlsBody.innerHTML = rows.map(([k, v]) => v === null ? `<div class="chead">${t(k)}</div>` : `<div class="crow"><span>${t(k)}</span><kbd>${v}</kbd></div>`).join('');
  }

  setLoading(p) { this.loadFill.style.width = (p * 100).toFixed(0) + '%'; }

  showEnd(win, reason, stats) {
    const t = i18n.t;
    this.endTitle.textContent = t(win ? 'end.win' : 'end.lose');
    this.endSub.textContent = win ? '' : t(reason === 'hostage' ? 'end.lose.hostage' : 'end.lose.player');
    const m = Math.floor(stats.time / 60), s = Math.floor(stats.time % 60);
    const rows = [[t('end.time'), `${m}:${s.toString().padStart(2, '0')}`], [t('end.kills'), stats.kills], [t('end.knife'), stats.knife], [t('end.chain'), stats.chain], [t('end.portals'), stats.portals], [t('end.reports'), stats.reports], [t('end.hostages'), `${stats.hostages}/2`]].map(([k, v]) => `<div class="srow"><span>${k}</span><b>${v}</b></div>`).join('');
    this.endStats.innerHTML = (win ? `<div class="rank ${stats.rank}"><span>${t('end.rank')}</span><b>${t('end.rank.' + stats.rank)}</b><span>${t('end.rank.desc.' + stats.rank)}</span></div>` : '') + rows;
    this.endRetry.style.display = win ? 'none' : '';
    this.screens.end.classList.toggle('win', win);
    this.show('end');
  }
}
