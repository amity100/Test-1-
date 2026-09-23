import type { StyleRank, ZoneId } from '../core/contracts';
import { IS_TOUCH, type QualityName } from '../config';
import { formatNumber, getDevice, getLang, setLang, t, type Lang } from './i18n';

/** Same shape as the game's Settings. */
export interface Settings {
  quality: QualityName;
  sensitivity: number;
  invertY: boolean;
  slowmo: boolean;
}

export interface RunStats {
  time: number;
  kills: number;
  bestCombo: number;
  styleTotal: number;
  tricks: number;
  deaths: number;
  challenges: number;
}

export interface ChallengeItem {
  id: string;
  title: string;
  desc: string;
  done: boolean;
  progress?: string;
}

export interface ClipOptions {
  onShare: () => void;
  onDownload?: () => void;
  onClose: () => void;
  previewUrl?: string;
  saving: boolean;
}

export const ZONE_ORDER: ZoneId[] = ['pier', 'yard', 'skeleton', 'lab', 'crown'];
const ZONE_Y: Record<ZoneId, string> = { pier: '0 m', yard: '0–24 m', skeleton: '30–42 m', lab: '60 m', crown: '90 m' };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const LOGO = `<span class="rings"><i class="rg ex"></i><i class="rg en"></i></span>`;

type Go =
  | 'start' | 'cont' | 'zones' | 'challenges' | 'controls' | 'openSettings' | 'resume' | 'retry' | 'restart'
  | 'quit' | 'goBack' | 'en' | 'he';

/** Title, pause, zones, challenges, settings, controls, end screens and the clip panel. */
export class Menu {
  el: HTMLDivElement;
  onStart = () => {};
  /** CONTINUE (shown when `continueZone` is set). */
  onContinue = () => {};
  onZone: (z: ZoneId) => void = () => {};
  /** CHALLENGES pressed. Default shows `challengeItems`; set it to refresh the list and call showChallenges(items). */
  onChallenges: () => void = () => this.showChallenges(this.challengeItems);
  onResume = () => {};
  onRestart = () => {};
  onRetry = () => {};
  onQuit = () => {};
  onSettings: (s: Settings) => void = () => {};
  onLanguage = () => {};

  /** Saved zone for CONTINUE (null hides the button). */
  continueZone: ZoneId | null = null;
  /** Zones the player may start from (ZONES list). */
  unlockedZones: ZoneId[] = ['pier'];
  challengeItems: ChallengeItem[] = [];

  private root: HTMLElement;
  private back: () => void = () => this.showMain();
  private current: () => void = () => {};
  private clipEl: HTMLDivElement | null = null;
  private clipOpts: ClipOptions | null = null;
  private ctlTab: 'kbm' | 'pad' | 'touch' | null = null;

  constructor(root: HTMLElement, private settings: Settings) {
    this.root = root;
    this.el = document.createElement('div');
    this.el.className = 'menu';
    root.appendChild(this.el);
  }

  /** Convenience for the game: saved zone + unlocked zones. */
  setProgress(p: { continueZone: ZoneId | null; unlocked: ZoneId[] }) {
    this.continueZone = p.continueZone;
    this.unlockedZones = p.unlocked.length ? p.unlocked : ['pier'];
  }

  get isOpen() {
    return this.el.classList.contains('on');
  }

  // -------------------------------------------------------------------------
  // plumbing
  // -------------------------------------------------------------------------

  private render(html: string, cls: string, redraw: () => void) {
    this.current = redraw;
    this.el.className = `menu on ${cls}`;
    this.el.innerHTML = html;
    this.el.scrollTop = 0;
    this.el.querySelectorAll<HTMLElement>('[data-go]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.go(b.dataset.go as Go);
      }),
    );
  }

  private go(g: Go) {
    switch (g) {
      case 'start': return this.start();
      case 'cont': return this.cont();
      case 'zones': return this.showZones();
      case 'challenges': return this.challenges();
      case 'controls': return this.controls();
      case 'openSettings': return this.openSettings();
      case 'resume': return this.resume();
      case 'retry': return this.retry();
      case 'restart': return this.restart();
      case 'quit': return this.quit();
      case 'goBack': return this.goBack();
      case 'en': return this.lang('en');
      case 'he': return this.lang('he');
    }
  }

  hide() {
    this.el.className = 'menu';
    this.el.innerHTML = '';
  }

  goBack() {
    this.back();
  }

  private brand(small = false) {
    return `<div class="brand${small ? ' sm' : ''}"><div class="logo">${LOGO}<h1>${t('title')}</h1></div><p>${esc(t('subtitle'))}</p></div>`;
  }

  private langSeg() {
    const l = getLang();
    return `<div class="lang" dir="ltr"><button type="button" data-go="en" class="${l === 'en' ? 'on' : ''}">EN</button><button type="button" data-go="he" class="${l === 'he' ? 'on' : ''}">עברית</button></div>`;
  }

  private backBtn() {
    return `<button type="button" class="m-back" data-go="goBack"><span class="arr">‹</span>${esc(t('menu.back'))}</button>`;
  }

  // -------------------------------------------------------------------------
  // screens
  // -------------------------------------------------------------------------

  showLoading(p: number) {
    if (!this.el.querySelector('.loading')) {
      this.render(
        `${this.brand()}<div class="loading"><div class="bar"><i></i></div><div class="load-status">${esc(t('loading'))}…</div></div>`,
        'boot',
        () => {},
      );
    }
    const i = this.el.querySelector('.loading .bar i') as HTMLElement | null;
    if (i) i.style.transform = `scaleX(${Math.max(0, Math.min(1, p))})`;
  }

  fatal(msg: string) {
    this.render(`${this.brand()}<div class="loading"><div class="load-status err">${esc(msg)}</div></div>`, 'boot', () => this.fatal(msg));
  }

  showMain() {
    this.back = () => this.showMain();
    const cz = this.continueZone;
    this.render(
      `<div class="m-main">
        <div class="m-col">
          ${this.brand()}
          <div class="btns">
            <button type="button" class="primary" data-go="start"><span>${esc(t('menu.play'))}</span></button>
            ${cz ? `<button type="button" data-go="cont"><span>${esc(t('menu.continue'))}</span><small>${esc(t(`zone.${cz}.name`))}</small></button>` : ''}
            <button type="button" data-go="zones"><span>${esc(t('menu.zones'))}</span></button>
            <button type="button" data-go="challenges"><span>${esc(t('menu.challenges'))}</span></button>
            <button type="button" data-go="controls"><span>${esc(t('menu.controls'))}</span></button>
            <button type="button" data-go="openSettings"><span>${esc(t('menu.settings'))}</span></button>
          </div>
          ${this.langSeg()}
        </div>
        <div class="m-brief">
          <div class="mc-tag">${esc(t('briefing.tag'))}</div>
          <h2>${esc(t('briefing.title'))}</h2>
          <p>${esc(t('briefing.text'))}</p>
          ${this.rules()}
        </div>
      </div>`,
      'main',
      () => this.showMain(),
    );
  }

  private rules() {
    return `<ol class="m-rules"><li><b>1</b><span>${esc(t('rule.1'))}</span></li><li><b>2</b><span>${esc(t('rule.2'))}</span></li><li><b>3</b><span>${esc(t('rule.3'))}</span></li></ol>`;
  }

  showPause() {
    this.back = () => this.showPause();
    this.render(
      `<div class="m-pause">
        <div class="m-col">
          <h2 class="title">${esc(t('menu.paused'))}</h2>
          <div class="btns">
            <button type="button" class="primary" data-go="resume"><span>${esc(t('menu.resume'))}</span></button>
            <button type="button" data-go="retry"><span>${esc(t('menu.retry'))}</span></button>
            <button type="button" data-go="restart"><span>${esc(t('menu.restart'))}</span></button>
            <button type="button" data-go="challenges"><span>${esc(t('menu.challenges'))}</span></button>
            <button type="button" data-go="controls"><span>${esc(t('menu.controls'))}</span></button>
            <button type="button" data-go="openSettings"><span>${esc(t('menu.settings'))}</span></button>
            <button type="button" data-go="quit"><span>${esc(t('menu.quit'))}</span></button>
          </div>
        </div>
        <div class="m-brief m-rulebox"><div class="mc-tag">${esc(t('menu.rules'))}</div>${this.rules()}</div>
      </div>`,
      'pause',
      () => this.showPause(),
    );
  }

  showEnd(win: boolean, s: RunStats, rank: StyleRank) {
    this.back = () => this.showEnd(win, s, rank);
    const mm = Math.floor(s.time / 60),
      ss = Math.floor(s.time % 60);
    const cell = (k: string, v: string, hl = false) =>
      `<div class="${hl ? 'hl' : ''}"><span>${esc(t(k))}</span><b dir="ltr">${v}</b></div>`;
    this.render(
      `<div class="m-end ${win ? 'win' : 'fail'}">
        <div class="end-head">
          <h2 class="title">${esc(t(win ? 'end.victory' : 'end.defeat'))}</h2>
          <p class="end-sub">${esc(t(win ? 'end.victorySub' : 'end.defeatSub'))}</p>
        </div>
        <div class="end-row">
          <div class="rank-big r-${rank}"><small>${esc(t('end.rank'))}</small><b>${rank}</b></div>
          <div class="stats">
            ${cell('end.time', `${mm}:${String(ss).padStart(2, '0')}`)}
            ${cell('end.kills', formatNumber(s.kills))}
            ${cell('end.bestCombo', formatNumber(s.bestCombo), true)}
            ${cell('end.styleTotal', formatNumber(s.styleTotal), true)}
            ${cell('end.tricks', formatNumber(s.tricks))}
            ${cell('end.challenges', formatNumber(s.challenges))}
            ${cell('end.deaths', formatNumber(s.deaths))}
          </div>
        </div>
        <div class="btns row">
          ${win ? '' : `<button type="button" class="primary" data-go="retry"><span>${esc(t('menu.retry'))}</span></button>`}
          <button type="button" class="${win ? 'primary' : ''}" data-go="restart"><span>${esc(t(win ? 'menu.playAgain' : 'menu.restart'))}</span></button>
          <button type="button" data-go="quit"><span>${esc(t('menu.quit'))}</span></button>
        </div>
      </div>`,
      `end ${win ? 'win' : 'fail'}`,
      () => this.showEnd(win, s, rank),
    );
  }

  showZones() {
    const back = this.back;
    const unlocked = new Set(this.unlockedZones);
    const cards = ZONE_ORDER.map((z, i) => {
      const open = unlocked.has(z);
      return `<button type="button" class="zc${open ? '' : ' locked'}" data-zone="${z}" ${open ? '' : 'disabled'}>
          <span class="zc-n" dir="ltr">0${i + 1}</span>
          <span class="zc-y" dir="ltr">↑ ${ZONE_Y[z]}</span>
          <b>${esc(t(`zone.${z}.name`))}</b>
          <small>${open ? esc(t(`zone.${z}.sub`)) : `🔒 ${esc(t('menu.locked'))}`}</small>
        </button>`;
    }).join('');
    this.render(
      `<div class="m-panel"><div class="m-top">${this.backBtn()}<h2 class="title">${esc(t('menu.zoneSelect'))}</h2></div><div class="zones">${cards}</div></div>`,
      'panel',
      () => this.showZones(),
    );
    this.back = back;
    this.el.querySelectorAll<HTMLButtonElement>('.zc').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (b.disabled) return;
        this.hide();
        this.onZone(b.dataset.zone as ZoneId);
      }),
    );
  }

  private challenges() {
    this.onChallenges();
  }

  showChallenges(items: ChallengeItem[] = this.challengeItems) {
    this.challengeItems = items;
    const back = this.back;
    const done = items.filter((c) => c.done).length;
    const list = items.length
      ? items
          .map(
            (c) => `<div class="ch${c.done ? ' done' : ''}${c.id.startsWith('daily') ? ' daily' : ''}">
              <i class="ch-ck"></i>
              <div class="ch-body">
                ${c.id.startsWith('daily') ? `<em class="ch-tag">${esc(t('menu.daily'))}</em>` : ''}
                <b>${esc(c.title)}</b>
                <span>${esc(c.desc)}</span>
              </div>
              <div class="ch-prog" dir="ltr">${c.done ? esc(t('menu.done')) : esc(c.progress ?? '')}</div>
            </div>`,
          )
          .join('')
      : `<p class="ch-empty">${esc(t('menu.noChallenges'))}</p>`;
    this.render(
      `<div class="m-panel"><div class="m-top">${this.backBtn()}<h2 class="title">${esc(t('menu.challenges'))}</h2>${
        items.length ? `<span class="m-count" dir="ltr">${done}/${items.length}</span>` : ''
      }</div><div class="chs">${list}</div></div>`,
      'panel',
      () => this.showChallenges(this.challengeItems),
    );
    this.back = back;
  }

  controls() {
    const back = this.back;
    const tab = this.ctlTab ?? defaultControlsTab();
    const g = (k: string) => (k.startsWith('key.') ? t(k) : k);
    const row = (key: string, desc: string, hl = false) =>
      `<div class="${hl ? 'hl' : ''}"><b dir="auto">${esc(g(key))}</b><span>${esc(t(desc))}</span></div>`;
    let body = '';
    if (tab === 'kbm') {
      body = `<div class="ctl-grid">
        ${row('WASD', 'ctl.move')}${row('key.mouse', 'ctl.look')}${row('key.space', 'ctl.jump')}${row('Shift', 'ctl.sprint')}
        ${row('C / Ctrl', 'ctl.crouch')}${row('V', 'ctl.shove')}
        ${row('key.rmb', 'ctl.aim', true)}${row('key.lmbAim', 'ctl.place', true)}${row('key.lmb', 'ctl.gate', true)}
        ${row('E', 'ctl.flip', true)}${row('key.wheel', 'ctl.dist', true)}${row('key.mmb', 'ctl.close', true)}
        ${row('F', 'ctl.action')}${row('Tab', 'ctl.vision')}${row('R', 'ctl.clip')}${row('K', 'ctl.photo')}${row('Esc', 'ctl.pause')}
      </div><p class="ctl-note">${esc(t('ctl.tab.pad'))}: ${esc(t('ctl.padLine'))}</p>`;
    } else if (tab === 'pad') {
      body = `<div class="ctl-grid">
        ${row('L', 'ctl.move')}${row('R', 'ctl.look')}${row('A', 'ctl.jump')}${row('L3', 'ctl.sprint')}${row('B', 'ctl.crouch')}${row('RB', 'ctl.shove')}
        ${row('LT', 'ctl.aim', true)}${row('RT', 'ctl.place', true)}${row('RT', 'ctl.gate', true)}${row('Y', 'ctl.flip', true)}
        ${row('D-pad ← →', 'ctl.dist', true)}${row('LB', 'ctl.close', true)}${row('X', 'ctl.action')}${row('D-pad ↓', 'ctl.vision')}
        ${row('View', 'ctl.clip')}${row('D-pad ↑', 'ctl.photo')}${row('Start', 'ctl.pause')}
      </div><p class="ctl-note">${esc(t('ctl.padLine'))}</p>`;
    } else {
      const tr = (glyph: string, desc: string, hl = false) =>
        `<div class="${hl ? 'hl' : ''}"><b dir="auto">${glyph}</b><span>${esc(t(desc))}</span></div>`;
      body = `<div class="ctl-grid touchctl">
        ${tr(`◯ ${esc(t('ctl.touch.left'))}`, 'ctl.touch.stick')}${tr(`☝ ${esc(t('ctl.touch.right'))}`, 'ctl.touch.look')}
        ${tr(`<i class="tg ex"></i>${esc(t('touch.rift'))}`, 'ctl.touch.rift', true)}${tr(`<i class="tg en"></i>${esc(t('touch.gate'))}`, 'ctl.touch.gate', true)}
        ${tr('✕', 'ctl.touch.close', true)}${tr('⇄', 'ctl.touch.flip', true)}
        ${tr(esc(t('touch.jump')), 'ctl.touch.jump')}${tr(esc(t('touch.shove')), 'ctl.touch.shove')}
        ${tr(esc(t('touch.action')), 'ctl.touch.action')}${tr(esc(t('touch.crouch')), 'ctl.touch.crouch')}${tr('🎬', 'ctl.touch.clip')}
      </div>`;
    }
    const tabBtn = (k: 'kbm' | 'pad' | 'touch') =>
      `<button type="button" data-tab="${k}" class="${tab === k ? 'on' : ''}">${esc(t(`ctl.tab.${k}`))}</button>`;
    this.render(
      `<div class="m-panel wide"><div class="m-top">${this.backBtn()}<h2 class="title">${esc(t('menu.controls'))}</h2></div>
        <div class="seg tabs">${tabBtn('kbm')}${tabBtn('pad')}${tabBtn('touch')}</div>${body}</div>`,
      'panel',
      () => this.controls(),
    );
    this.back = back;
    this.el.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.ctlTab = b.dataset.tab as 'kbm' | 'pad' | 'touch';
        this.controls();
      }),
    );
  }

  /** Controls tab to open first (defaults to the current device). */
  setControlsTab(tab: 'kbm' | 'pad' | 'touch') {
    this.ctlTab = tab;
  }

  openSettings() {
    const back = this.back;
    const s = this.settings;
    const seg = (cls: string, opts: [string, string, boolean][]) =>
      `<div class="seg ${cls}">${opts.map(([v, label, on]) => `<button type="button" data-v="${v}" class="${on ? 'on' : ''}">${esc(label)}</button>`).join('')}</div>`;
    const q = (['low', 'medium', 'high', 'ultra'] as QualityName[]).map((k) => [k, t(`set.${k}`), s.quality === k] as [string, string, boolean]);
    this.render(
      `<div class="m-panel"><div class="m-top">${this.backBtn()}<h2 class="title">${esc(t('menu.settings'))}</h2></div>
      <div class="settings">
        <label><span>${esc(t('set.quality'))}</span>${seg('q', q)}</label>
        <label><span>${esc(t('set.sensitivity'))} <em class="sens-v" dir="ltr">${s.sensitivity.toFixed(2)}</em></span><input type="range" min="0.3" max="2.5" step="0.05" value="${s.sensitivity}" class="sens" dir="ltr"/></label>
        <label><span>${esc(t('set.invertY'))}</span>${seg('inv', [['0', t('set.off'), !s.invertY], ['1', t('set.on'), s.invertY]])}</label>
        <label><span>${esc(t('set.slowmo'))}</span>${seg('slow', [['1', t('set.on'), s.slowmo], ['0', t('set.off'), !s.slowmo]])}</label>
        <label><span>${esc(t('set.language'))}</span>${this.langSeg()}</label>
      </div></div>`,
      'panel',
      () => this.openSettings(),
    );
    this.back = back;
    const apply = () => this.onSettings({ ...this.settings });
    const bind = (sel: string, f: (v: string) => void) =>
      this.el.querySelectorAll<HTMLButtonElement>(`${sel} button`).forEach((b) =>
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          f(b.dataset.v!);
          apply();
          this.openSettings();
        }),
      );
    bind('.seg.q', (v) => (this.settings.quality = v as QualityName));
    bind('.seg.inv', (v) => (this.settings.invertY = v === '1'));
    bind('.seg.slow', (v) => (this.settings.slowmo = v === '1'));
    const sens = this.el.querySelector('.sens') as HTMLInputElement;
    const sv = this.el.querySelector('.sens-v') as HTMLElement;
    sens.addEventListener('input', () => {
      this.settings.sensitivity = parseFloat(sens.value);
      sv.textContent = this.settings.sensitivity.toFixed(2);
      apply();
    });
  }

  // -------------------------------------------------------------------------
  // clip panel (over the replay; independent of the menu screens)
  // -------------------------------------------------------------------------

  showClip(opts: ClipOptions) {
    this.clipOpts = opts;
    if (!this.clipEl) {
      this.clipEl = document.createElement('div');
      this.clipEl.className = 'clip-panel';
      this.root.appendChild(this.clipEl);
      this.clipEl.addEventListener('click', (e) => {
        const b = (e.target as Element).closest('[data-c]') as HTMLElement | null;
        if (!b || !this.clipOpts) return;
        e.stopPropagation();
        const c = b.dataset.c;
        if (c === 'share' && !this.clipOpts.saving) this.clipOpts.onShare();
        else if (c === 'download' && !this.clipOpts.saving) this.clipOpts.onDownload?.();
        else if (c === 'close') this.clipOpts.onClose();
      });
    }
    const el = this.clipEl;
    const prevUrl = el.dataset.url ?? '';
    const url = opts.previewUrl ?? '';
    el.className = `clip-panel on ${opts.saving ? 'saving' : 'ready'}`;
    const video = url
      ? `<video src="${esc(url)}" autoplay loop muted playsinline></video>`
      : `<div class="cp-ph">${LOGO}<span>THRESHOLD</span></div>`;
    if (!el.firstChild || prevUrl !== url) {
      el.dataset.url = url;
      el.innerHTML = `
        <div class="cp-card">
          <div class="cp-prev">${video}<span class="cp-rec"><i></i>REPLAY</span></div>
          <div class="cp-side">
            <div class="cp-head"><b>${esc(t('clip.title'))}</b><button type="button" class="cp-x" data-c="close" aria-label="close">✕</button></div>
            <div class="cp-status"><span class="cp-spin"></span><span class="cp-txt"></span></div>
            <div class="cp-bar"><i></i></div>
            <div class="cp-btns">
              <button type="button" class="primary cp-share" data-c="share"><svg viewBox="0 0 24 24"><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5M5 12v7.5c0 .8.7 1.5 1.5 1.5h11c.8 0 1.5-.7 1.5-1.5V12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${esc(t('clip.share'))}</span></button>
              <button type="button" class="cp-dl" data-c="download"><span>${esc(t('clip.download'))}</span></button>
              <button type="button" class="cp-close" data-c="close"><span>${esc(t('clip.close'))}</span></button>
            </div>
          </div>
        </div>`;
    }
    (el.querySelector('.cp-txt') as HTMLElement).textContent = t(opts.saving ? 'clip.saving' : 'clip.ready');
    (el.querySelector('.cp-dl') as HTMLElement).style.display = opts.onDownload ? '' : 'none';
    el.querySelectorAll<HTMLButtonElement>('.cp-share, .cp-dl').forEach((b) => (b.disabled = opts.saving));
    if (!opts.saving) this.setClipProgress(1);
  }

  /** Real export progress 0..1 (optional; without it the bar is indeterminate while saving). */
  setClipProgress(p: number) {
    const i = this.clipEl?.querySelector('.cp-bar i') as HTMLElement | null;
    if (!i) return;
    this.clipEl!.classList.add('determinate');
    i.style.transform = `scaleX(${Math.max(0, Math.min(1, p)).toFixed(3)})`;
  }

  hideClip() {
    this.clipOpts = null;
    if (!this.clipEl) return;
    this.clipEl.remove();
    this.clipEl = null;
  }

  // -------------------------------------------------------------------------
  // actions
  // -------------------------------------------------------------------------

  start() {
    this.hide();
    this.onStart();
  }
  cont() {
    this.hide();
    this.onContinue();
  }
  resume() {
    this.hide();
    this.onResume();
  }
  restart() {
    this.hide();
    this.onRestart();
  }
  retry() {
    this.hide();
    this.onRetry();
  }
  quit() {
    this.onQuit();
    this.showMain();
  }
  private lang(l: Lang) {
    setLang(l);
    this.onLanguage();
    this.current();
  }
  /** @deprecated kept for older call sites */
  en() {
    this.lang('en');
  }
  /** @deprecated kept for older call sites */
  he() {
    this.lang('he');
  }
}

/** Device hint for the controls page. */
export function defaultControlsTab(): 'kbm' | 'pad' | 'touch' {
  return IS_TOUCH ? 'touch' : getDevice();
}
