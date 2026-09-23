import { IS_TOUCH, QualityName } from '../config';
import type { MissionStats, Settings } from '../game/game';
import { getLang, setLang, t } from './i18n';

/** Title, pause, settings, controls and debrief screens. */
export class Menu {
  el: HTMLDivElement;
  onStart = () => {};
  onResume = () => {};
  onRestart = () => {};
  onRetry = () => {};
  onQuit = () => {};
  onSettings: (s: Settings) => void = () => {};
  onLanguage = () => {};
  private back: () => void = () => {};

  constructor(root: HTMLElement, private settings: Settings) {
    this.el = document.createElement('div');
    this.el.className = 'menu';
    root.appendChild(this.el);
  }

  private render(html: string, cls = '') {
    this.el.className = `menu on ${cls}`;
    this.el.innerHTML = html;
    this.el.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const go = b.dataset.go!;
        (this as any)[go]?.();
      });
    });
  }

  hide() {
    this.el.className = 'menu';
    this.el.innerHTML = '';
  }

  private brand() {
    return `<div class="brand"><div class="logo"><span class="ring"></span><h1>${t('title')}</h1></div><p>${t('subtitle')}</p></div>`;
  }

  showLoading(p: number) {
    if (!this.el.querySelector('.loading')) {
      this.render(`${this.brand()}<div class="loading"><div class="bar"><i></i></div><div class="load-status">${t('loading')}…</div></div>`, 'boot');
    }
    const i = this.el.querySelector('.loading .bar i') as HTMLElement;
    if (i) i.style.transform = `scaleX(${p})`;
  }

  fatal(msg: string) {
    this.render(`${this.brand()}<div class="loading"><div class="load-status">${msg}</div></div>`, 'boot');
  }

  showMain() {
    this.back = () => this.showMain();
    this.render(
      `${this.brand()}
      <div class="mission-card">
        <div class="mc-tag">MISSION 01</div>
        <h2>${t('missionName')}</h2>
        <p>${t('briefing')}</p>
      </div>
      <div class="btns">
        <button class="primary" data-go="start">${t('play')}</button>
        <button data-go="controls">${t('controls')}</button>
        <button data-go="openSettings">${t('settings')}</button>
      </div>
      <div class="lang"><button data-go="en" class="${getLang() === 'en' ? 'on' : ''}">EN</button><button data-go="he" class="${getLang() === 'he' ? 'on' : ''}">עברית</button></div>`,
      'main',
    );
  }

  showPause() {
    this.back = () => this.showPause();
    this.render(
      `<h2 class="title">${t('paused')}</h2>
      <div class="btns">
        <button class="primary" data-go="resume">${t('resume')}</button>
        <button data-go="retry">${t('retry')}</button>
        <button data-go="restart">${t('restart')}</button>
        <button data-go="controls">${t('controls')}</button>
        <button data-go="openSettings">${t('settings')}</button>
        <button data-go="quit">${t('quit')}</button>
      </div>`,
      'pause',
    );
  }

  showEnd(win: boolean, s: MissionStats, rating: string) {
    this.back = () => this.showEnd(win, s, rating);
    const mm = Math.floor(s.time / 60), ss = Math.floor(s.time % 60);
    this.render(
      `<h2 class="title ${win ? 'win' : 'fail'}">${win ? t('missionComplete') : t('missionFailed')}</h2>
      ${win ? `<div class="rating"><small>${t('rating')}</small><b>${rating}</b></div>` : ''}
      <div class="stats">
        <div><span>${t('time')}</span><b>${mm}:${String(ss).padStart(2, '0')}</b></div>
        <div><span>${t('detections')}</span><b>${s.detections}</b></div>
        <div><span>${t('kills')}</span><b>${s.kills}</b></div>
        <div><span>${t('bodiesFound')}</span><b>${s.bodiesFound}</b></div>
        <div><span>${t('riftsUsed')}</span><b>${s.rifts}</b></div>
        <div><span>${t('bestChain')}</span><b>×${s.bestChain ?? 0}</b></div>
        <div><span>${t('movesUsed')}</span><b>${s.moves ?? 0}/5</b></div>
      </div>
      <div class="btns">
        ${win ? '' : `<button class="primary" data-go="retry">${t('retry')}</button>`}
        <button class="${win ? 'primary' : ''}" data-go="restart">${t('restart')}</button>
        <button data-go="quit">${t('quit')}</button>
      </div>`,
      'end',
    );
  }

  // --- actions (called via data-go) ---
  start() { this.hide(); this.onStart(); }
  resume() { this.hide(); this.onResume(); }
  restart() { this.hide(); this.onRestart(); }
  retry() { this.hide(); this.onRetry(); }
  quit() { this.onQuit(); this.showMain(); }
  en() { setLang('en'); this.onLanguage(); this.showMain(); }
  he() { setLang('he'); this.onLanguage(); this.showMain(); }

  controls() {
    const touchHtml = `<div class="ctl-grid touchctl">
      <div><b>◯ ${getLang() === 'he' ? 'צד שמאל' : 'Left side'}</b><span>${getLang() === 'he' ? 'ג׳ויסטיק תנועה (דחיפה עד הסוף = ריצה)' : 'Move stick (push fully = sprint)'}</span></div>
      <div><b>☝ ${getLang() === 'he' ? 'צד ימין' : 'Right side'}</b><span>${getLang() === 'he' ? 'גרירה = מבט / כיוון' : 'Drag = look / aim'}</span></div>
      <div class="hl"><b>${t('rift')}</b><span>${getLang() === 'he' ? 'מצב כיוון פורטל — גרור למקם, פתח לפתוח' : 'Rift aim mode — drag to place, OPEN to open'}</span></div>
      <div class="hl"><b>${t('distance')}</b><span>${getLang() === 'he' ? 'החלק למעלה/למטה לשינוי מרחק' : 'Slide up/down to change distance'}</span></div>
      <div class="hl"><b>⇄</b><span>${getLang() === 'he' ? 'החלפה בין STRIKE ל-DROP / סיבוב היציאה' : 'Swap STRIKE ⇄ DROP / turn the exit'}</span></div>
      <div class="hl"><b>✕</b><span>${getLang() === 'he' ? 'סגירת כל הפורטלים' : 'Close all rifts'}</span></div>
      <div><b>F</b><span>${getLang() === 'he' ? 'משיכה · נשיאה · זריקה · שימוש' : 'Pull · Carry · Throw · Use'}</span></div>
    </div>`;
    this.render(`<h2 class="title">${t('controls')}</h2>${IS_TOUCH ? touchHtml : t('controlsHtml')}<div class="btns"><button class="primary" data-go="goBack">${t('back')}</button></div>`, 'panel');
  }

  openSettings() {
    const s = this.settings;
    const q = (['low', 'medium', 'high', 'ultra'] as QualityName[]).map((k) => `<button data-q="${k}" class="${s.quality === k ? 'on' : ''}">${t(k)}</button>`).join('');
    this.render(
      `<h2 class="title">${t('settings')}</h2>
      <div class="settings">
        <label>${t('quality')}<div class="seg q">${q}</div></label>
        <label>${t('sensitivity')}<input type="range" min="0.3" max="2.5" step="0.05" value="${s.sensitivity}" class="sens"/></label>
        <label>${t('invertY')}<div class="seg inv"><button data-v="0" class="${!s.invertY ? 'on' : ''}">${t('off')}</button><button data-v="1" class="${s.invertY ? 'on' : ''}">${t('on')}</button></div></label>
        <label>${t('focusSlow')}<div class="seg slow"><button data-v="1" class="${s.slowmo ? 'on' : ''}">${t('on')}</button><button data-v="0" class="${!s.slowmo ? 'on' : ''}">${t('off')}</button></div></label>
      </div>
      <div class="btns"><button class="primary" data-go="goBack">${t('back')}</button></div>`,
      'panel',
    );
    const apply = () => {
      this.onSettings({ ...this.settings });
    };
    this.el.querySelectorAll<HTMLButtonElement>('.seg.q button').forEach((b) =>
      b.addEventListener('click', () => {
        this.settings.quality = b.dataset.q as QualityName;
        apply();
        this.openSettings();
      }),
    );
    this.el.querySelectorAll<HTMLButtonElement>('.seg.inv button').forEach((b) =>
      b.addEventListener('click', () => {
        this.settings.invertY = b.dataset.v === '1';
        apply();
        this.openSettings();
      }),
    );
    this.el.querySelectorAll<HTMLButtonElement>('.seg.slow button').forEach((b) =>
      b.addEventListener('click', () => {
        this.settings.slowmo = b.dataset.v === '1';
        apply();
        this.openSettings();
      }),
    );
    const sens = this.el.querySelector('.sens') as HTMLInputElement;
    sens.addEventListener('input', () => {
      this.settings.sensitivity = parseFloat(sens.value);
      apply();
    });
  }

  goBack() {
    this.back();
  }
}
