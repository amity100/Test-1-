import * as THREE from 'three';
import './style.css';
import { quoteText, sourceRef } from '../content/sources';
import { narration } from '../content/introNarration';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = '') => {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export interface KeyHint { key: string; touch: string; label: string }

/** Layout of one film text event (CUT v2 typography, docs/intro-script-v2.md). */
export interface FilmTextOptions {
  /** verses: seconds from the text's start at which each word appears (speech-synced); overrides `stagger` */
  words?: readonly number[];
  /** verses: seconds between words (default 0.11) */
  stagger?: number;
  /** verses: the reference fades in this long after the last word (default 0.55 s) */
  refAfter?: number;
  /** cards and verses: the negative space of the composition the text sits in */
  side?: 'left' | 'right' | 'center';
  /** cards and verses: vertical placement */
  v?: 'top' | 'middle' | 'bottom';
  /** verses: 2 = two balanced lines (a line break between two of the catalog's words; the words are unchanged) */
  lines?: 1 | 2;
  /** verses: the last N words in gold (D1: the film's own title) */
  gold?: number;
}

/** split a catalog text into words (on spaces; a maqaf keeps two words together) — the text itself is never changed */
const splitWords = (t: string) => t.split(' ').filter((w) => w.length > 0);
/** visible width proxy of a Hebrew word: its letters without niqqud / cantillation marks */
const letters = (w: string) => w.replace(/[\u0591-\u05C7]/g, '').length;
/** index of the word after which a verse breaks into two lines of the most equal width */
function balancedBreak(words: readonly string[]): number {
  const len = words.map((w) => letters(w) + 1);
  const total = len.reduce((a, b) => a + b, 0);
  let best = 0, bd = Infinity, acc = 0;
  for (let i = 0; i < words.length - 1; i++) {
    acc += len[i];
    const d = Math.abs(total - 2 * acc);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** All DOM overlays: loading, start, cinematic letterbox & captions, title card, HUD, QTE, menus. */
export class UI {
  readonly root: HTMLDivElement;
  private loading: HTMLDivElement;
  private loadBar: HTMLDivElement;
  private loadLabel: HTMLDivElement;
  private bars: HTMLDivElement;
  private captionEl: HTMLDivElement;
  private verseEl: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private objEl: HTMLDivElement;
  private promptEl: HTMLDivElement;
  private crossEl: HTMLDivElement;
  private markerEl: HTMLDivElement;
  private healthEl: HTMLDivElement;
  private bossEl: HTMLDivElement;
  private qteEl: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private fadeEl: HTMLDivElement;
  private skipEl: HTMLButtonElement;
  private skipHintEl: HTMLDivElement;
  private prerollEl: HTMLDivElement;
  private filmLayer: HTMLDivElement;
  private counterEl: HTMLDivElement;
  private hintEl: HTMLDivElement;
  private pauseEl: HTMLDivElement;
  private endEl: HTMLDivElement;
  private timers = new Map<string, number>();
  readonly touch: boolean;
  onSkip?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
  onVolume?: (v: number) => void;
  onSensitivity?: (v: number) => void;

  constructor(parent: HTMLElement, touch: boolean) {
    this.touch = touch;
    this.root = el('div', 'ui' + (touch ? ' is-touch' : ''));
    parent.appendChild(this.root);

    // the game's logo lockup, as over the film's last shot (CUT v4): DAVID large in gold metal, דָּוִד beneath it
    this.loading = el('div', 'loading', `
      <div class="ld-inner">
        <div class="ld-title-en" data-t="${narration('davidLogo')}">${narration('davidLogo')}</div>
        <div class="ld-title">${narration('davidName')}</div>
        <div class="ld-bar"><div></div></div>
        <div class="ld-label"></div>
        <div class="ld-quote">"${quoteText('ps_23_1_2_loading')}"<span>${sourceRef('ps_23_1_2_loading')}</span></div>
      </div>`);
    this.loadBar = this.loading.querySelector('.ld-bar div') as HTMLDivElement;
    this.loadLabel = this.loading.querySelector('.ld-label') as HTMLDivElement;
    this.root.appendChild(this.loading);

    this.bars = el('div', 'letterbox', '<div class="lb-top"></div><div class="lb-bot"></div>');
    this.captionEl = el('div', 'caption');
    this.verseEl = el('div', 'verse');
    // THE LOGO (CUT v4, docs/intro-script-v4.md): the game's logo over the panorama of the film's last shot (D3) — DAVID
    // large (Cinzel, gold metal, formed from light with one sweep), דָּוִד in gold beneath it (≈45 % of its size), a thin
    // gold rule, the chapter line; every word from the narration module (src/content/introNarration.ts). Over the
    // picture with a soft glow behind it (never a card). The loading screen shows the same lockup.
    this.titleEl = el('div', 'titlecard', `
      <div class="lg">
        <h1 class="lg-en" data-t="${narration('davidLogo')}">${narration('davidLogo')}</h1>
        <div class="lg-he" data-t="${narration('davidName')}">${narration('davidName')}</div>
        <div class="lg-rule"></div>
        <div class="lg-ch">${narration('chapterTitle')}</div>
      </div>`);
    this.objEl = el('div', 'objective');
    this.hintEl = el('div', 'hint');
    this.promptEl = el('div', 'prompt');
    this.crossEl = el('div', 'crosshair', '<svg viewBox="0 0 100 100"><circle class="ring-bg" cx="50" cy="50" r="30"/><circle class="ring" cx="50" cy="50" r="30"/><circle class="dot" cx="50" cy="50" r="2.6"/></svg><div class="range">מחוץ לטווח — סובב חזק יותר</div>');
    this.markerEl = el('div', 'marker', '<div class="mk-diamond"></div><div class="mk-label"></div>');
    this.healthEl = el('div', 'health');
    this.bossEl = el('div', 'boss', '<div class="boss-name">הַדֹּב</div><div class="boss-bar"><div></div></div>');
    this.qteEl = el('div', 'qte');
    this.toastEl = el('div', 'toast');
    this.counterEl = el('div', 'counter');
    this.fadeEl = el('div', 'fade');
    this.skipEl = el('button', 'skip', touch ? 'דלג ›' : 'דלג <span class="key">Enter</span>') as HTMLButtonElement;
    this.skipEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onSkip?.();
    });
    this.skipHintEl = el('div', 'skip-hint');
    this.prerollEl = el('div', 'preroll', '<div class="pr-line"></div><div class="pr-bar"><div></div></div>');
    this.filmLayer = el('div', 'film-layer');
    this.pauseEl = el('div', 'pause');
    this.endEl = el('div', 'endcard');
    for (const e of [this.bars, this.markerEl, this.captionEl, this.verseEl, this.filmLayer, this.titleEl, this.objEl, this.hintEl, this.promptEl, this.crossEl, this.healthEl, this.bossEl, this.qteEl, this.toastEl, this.counterEl, this.skipEl, this.skipHintEl, this.fadeEl, this.prerollEl, this.pauseEl, this.endEl]) this.root.appendChild(e);
    this.buildPause();
  }

  // ------------------------------------------------------------------------------ loading/start
  setLoading(f: number, label: string) {
    this.loadBar.style.width = `${Math.round(f * 100)}%`;
    this.loadLabel.textContent = label;
  }

  showStart(quality: string, onStart: () => void) {
    this.loading.classList.add('ready');
    const inner = this.loading.querySelector('.ld-inner') as HTMLDivElement;
    const btn = el('button', 'start-btn', 'הַתְחֵל');
    const note = el('div', 'start-note', `${this.touch ? 'מומלץ לסובב את המכשיר לרוחב · ' : 'מסך מלא ואוזניות לחוויה המלאה · '}איכות: ${quality}`);
    inner.appendChild(btn);
    inner.appendChild(note);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        if (this.touch && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen().catch(() => undefined);
      } catch {
        /* ignore */
      }
      this.loading.classList.add('gone');
      setTimeout(() => this.loading.remove(), 1600);
      onStart();
    });
  }

  dismissLoading() {
    this.loading.classList.add('gone');
    setTimeout(() => this.loading.remove(), 1600);
  }

  showError(msg: string) {
    this.loadLabel.textContent = msg;
    this.loadLabel.classList.add('err');
  }

  // ------------------------------------------------------------------------------ cinematic
  /**
   * Cinematic mode. `drawn` = the bars are drawn into the image by the renderer (PostFX.setLetterbox, the intro):
   * the HTML bars stay hidden and captions follow setBars(); otherwise the HTML bars slide in (11 % each).
   */
  letterbox(on: boolean, drawn = false) {
    this.bars.classList.toggle('on', on && !drawn);
    this.root.classList.toggle('cinematic', on);
    this.root.classList.toggle('film-bars', on && drawn);
  }
  /**
   * Height of the image's letterbox bars (fraction of the viewport height per bar, e.g. engine.post.letterboxBars)
   * so captions, verses and the skip button sit just inside the picture; null = back to the CSS default.
   */
  setBars(frac: number | null) {
    const v = frac === null ? '' : `${(Math.max(0, frac) * 100).toFixed(2)}vh`;
    if (v !== this.barsVar) {
      this.barsVar = v;
      if (v) this.root.style.setProperty('--lb', v);
      else this.root.style.removeProperty('--lb');
    }
  }
  private barsVar = '';
  skip(visible: boolean) {
    this.skipEl.classList.toggle('on', visible);
  }
  /** "press again to skip" hint next to the skip button (first key / tap during the intro). */
  skipHint(on: boolean, touch = this.touch) {
    if (on) this.skipHintEl.textContent = touch ? 'הַקֵּשׁ שׁוּב כְּדֵי לְדַלֵּג' : 'לְחַץ שׁוּב כְּדֵי לְדַלֵּג';
    this.skipHintEl.classList.toggle('on', on);
    this.skipEl.classList.toggle('strong', on);
  }
  /**
   * Pre-roll card over the black before the intro (while Saul's house is being built): a quiet line and a thin
   * progress rule. null hides it.
   */
  preroll(label: string | null, progress = 0) {
    if (label === null) {
      this.prerollEl.classList.remove('on');
      return;
    }
    const line = this.prerollEl.querySelector('.pr-line') as HTMLDivElement;
    if (line.textContent !== label) line.textContent = label;
    (this.prerollEl.querySelector('.pr-bar div') as HTMLDivElement).style.width = `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
    this.prerollEl.classList.add('on');
  }

  private later(key: string, ms: number, fn: () => void) {
    const t = this.timers.get(key);
    if (t) clearTimeout(t);
    this.timers.set(key, window.setTimeout(fn, ms));
  }

  /** Location card, e.g. "בית לחם יהודה". */
  caption(title: string, sub = '', seconds = 5) {
    this.captionEl.innerHTML = `<div class="cap-title">${title}</div>${sub ? `<div class="cap-sub">${sub}</div>` : ''}`;
    this.captionEl.classList.remove('on');
    void this.captionEl.offsetWidth;
    this.captionEl.classList.add('on');
    this.later('caption', seconds * 1000, () => this.captionEl.classList.remove('on'));
  }

  /** Scripture line with reference. */
  verse(text: string, ref: string, seconds = 6) {
    this.verseEl.innerHTML = `<div class="v-text">${text}</div>${ref ? `<div class="v-ref">${ref}</div>` : ''}`;
    this.verseEl.classList.remove('on');
    void this.verseEl.offsetWidth;
    this.verseEl.classList.add('on');
    this.later('verse', seconds * 1000, () => this.verseEl.classList.remove('on'));
  }
  hideVerse() {
    this.verseEl.classList.remove('on');
  }
  hideCaption() {
    this.captionEl.classList.remove('on');
  }

  /**
   * The game's logo lockup over the picture (CUT v4: the panorama of the film's last shot D3; and over the first seconds
   * of play after a skip). Turned on at the DAVID beat; `hebrew` / `chapter` = seconds after it that דָּוִד and the
   * chapter line come in, `out` = when the whole lockup starts to fade and `outDur` how long it takes. Every part is ONE
   * CSS animation from the moment it is turned on, so the film can pin all of them to its own clock (logoAt).
   * logo(false) removes it at once.
   */
  logo(on: boolean, o: { hebrew?: number; chapter?: number; out?: number; outDur?: number } = {}) {
    const e = this.titleEl;
    if (!on) {
      e.classList.remove('on');
      return;
    }
    e.style.setProperty('--lg-he', `${(o.hebrew ?? 1).toFixed(3)}s`);
    e.style.setProperty('--lg-ch', `${(o.chapter ?? 2).toFixed(3)}s`);
    e.style.setProperty('--lg-out', `${(o.out ?? 4.4).toFixed(3)}s`);
    e.style.setProperty('--lg-outd', `${(o.outDur ?? 1.6).toFixed(3)}s`);
    e.classList.remove('on');
    void e.offsetWidth; // restart every animation of the lockup
    e.classList.add('on');
  }
  /** Pin every animation of the logo lockup to `elapsed` seconds since logo(true) (the film's clock, not the wall's). */
  logoAt(elapsed: number) {
    for (const a of this.titleEl.getAnimations({ subtree: true })) {
      a.pause();
      a.currentTime = Math.max(0, elapsed) * 1000;
    }
  }

  // ------------------------------------------------------------------------------ opening-film typography
  /**
   * One text event of the opening film (the typography of docs/intro-script-v2.md "On-screen text"; CUT v3 has seven of
   * them, docs/intro-script-v3.md), on its own element over the canvas (never tied to the canvas crossfades). The text itself comes from src/content/introNarration.ts or, for
   * 'verse', from the catalog helpers of src/content/sources.ts — it is only split into words, never changed.
   *  - 'time'    the time card: centred, large, light serif, calm — over black, then carried over the first image;
   *              resolves out of a soft blur while the tracking closes (0.5em -> 0.26em over 2.8 s), a faint bloom;
   *              melts away at the end
   *  - 'place'   a place card in the negative space: a soft mask wipe from the right (RTL), a gold rule grows under it
   *  - 'person'  `main` = the name, very large in a gold-to-cream metal gradient with one light sweep; `sub` = the
   *              title under it, small and letter-spaced
   *  - 'verse'   `main` = quoteText(id) LARGE in the lower third, word by word (`words` timing or `stagger`), a soft
   *              dark glow behind; `sub` = sourceRef(id) small, letter-spaced, fading in after the words
   *  - 'line'    a plain narration line (lower third)
   * Every animation is CSS (the film's test clock pins them to film time). Returns the element.
   */
  filmText(kind: 'time' | 'line' | 'place' | 'person' | 'verse', main: string, sub = '', seconds = 5, elapsed = 0, autoRemove = true, o: FilmTextOptions = {}): HTMLDivElement {
    const side = o.side ?? (kind === 'place' || kind === 'person' ? 'right' : 'center');
    const e = el('div', `ft ft-${kind} ft-side-${side} ft-v-${o.v ?? (kind === 'verse' || kind === 'line' ? 'bottom' : kind === 'time' ? 'middle' : 'top')}`);
    const dur = Math.max(1.6, seconds);
    let inner: string;
    if (kind === 'verse') {
      const words = splitWords(main);
      const step = o.stagger ?? 0.11;
      const at = (i: number) => (o.words && o.words[i] !== undefined ? o.words[i] : i * step);
      const brk = (o.lines ?? 1) === 2 && words.length > 1 ? balancedBreak(words) : -1;
      const gold0 = words.length - Math.max(0, Math.min(words.length, o.gold ?? 0));
      const spans = words.map((w, i) => `<span class="w${i >= gold0 ? ' gold' : ''}" style="--d:${at(i).toFixed(3)}s"${i >= gold0 ? ` data-t="${w}"` : ''}>${w}</span>${i === words.length - 1 ? '' : i === brk ? '<br>' : ' '}`).join('');
      if (brk >= 0) e.classList.add('ft-2l');
      const last = at(words.length - 1);
      e.style.setProperty('--ref', `${(last + (o.refAfter ?? 0.55)).toFixed(2)}s`);
      inner = `<div class="ft-v">${spans}</div>${sub ? `<div class="ft-ref">${sub}</div>` : ''}`;
    } else if (kind === 'person') {
      inner = `<div class="ft-name" data-t="${main}">${main}</div>${sub ? `<div class="ft-sub">${sub}</div>` : ''}`;
    } else if (kind === 'place') {
      inner = `<div class="ft-main">${main}</div><div class="ft-rule"></div>`;
    } else inner = `<div class="ft-main">${main}</div>`;
    e.innerHTML = inner;
    e.style.setProperty('--dur', `${dur}s`);
    e.style.setProperty('--out', `${Math.max(0.2, dur - (kind === 'time' ? 1.0 : 0.7))}s`);
    this.filmLayer.appendChild(e);
    if (elapsed > 0) {
      // re-shown part-way through its life (the film was sought): jump every animation of it to `elapsed`
      for (const a of e.getAnimations({ subtree: true })) a.currentTime = elapsed * 1000;
    }
    if (autoRemove) window.setTimeout(() => e.remove(), Math.max(0.1, dur - elapsed) * 1000 + 300);
    return e;
  }
  /** the logo lockup's element */
  get titleElement(): HTMLElement {
    return this.titleEl;
  }
  /** Fade out every film text now (skip / seek / end of the film). */
  clearFilmText(seconds = 0.6) {
    for (const c of Array.from(this.filmLayer.children) as HTMLElement[]) {
      if (seconds <= 0) {
        c.remove();
        continue;
      }
      c.style.transition = `opacity ${seconds}s ease`;
      c.style.animation = 'none';
      c.style.opacity = '0';
      window.setTimeout(() => c.remove(), seconds * 1000 + 50);
    }
  }
  /** Film mode: film typography rules + safe areas (class .film on the root). */
  filmMode(on: boolean) {
    this.root.classList.toggle('film', on);
  }

  // ------------------------------------------------------------------------------ HUD
  objective(text: string | null, sub = '') {
    if (!text) {
      this.objEl.classList.remove('on');
      return;
    }
    this.objEl.innerHTML = `<div class="obj-label">מְשִׂימָה</div><div class="obj-text">${text}</div>${sub ? `<div class="obj-sub">${sub}</div>` : ''}`;
    this.objEl.classList.remove('on', 'new');
    void this.objEl.offsetWidth;
    this.objEl.classList.add('on', 'new');
  }

  hint(parts: KeyHint[] | string | null, seconds = 0) {
    if (!parts) {
      this.hintEl.classList.remove('on');
      return;
    }
    if (typeof parts === 'string') this.hintEl.innerHTML = parts;
    else this.hintEl.innerHTML = parts.map((p) => `<span class="h-item"><span class="key">${this.touch ? p.touch : p.key}</span>${p.label}</span>`).join('');
    this.hintEl.classList.add('on');
    if (seconds) this.later('hint', seconds * 1000, () => this.hintEl.classList.remove('on'));
  }

  prompt(p: KeyHint | null) {
    if (!p) {
      this.promptEl.classList.remove('on');
      return;
    }
    this.promptEl.innerHTML = `<span class="key">${this.touch ? p.touch : p.key}</span><span>${p.label}</span>`;
    this.promptEl.classList.add('on');
  }

  counter(text: string | null) {
    this.counterEl.classList.toggle('on', !!text);
    if (text) this.counterEl.innerHTML = text;
  }

  crosshair(visible: boolean, power = 0, onTarget = false, inRange = true) {
    this.crossEl.classList.toggle('on', visible);
    if (!visible) return;
    const ring = this.crossEl.querySelector('.ring') as SVGCircleElement;
    const c = 2 * Math.PI * 30;
    ring.style.strokeDasharray = `${c * power} ${c}`;
    this.crossEl.classList.toggle('target', onTarget);
    this.crossEl.classList.toggle('far', !inRange && power > 0.2);
  }

  marker(camera: THREE.Camera, pos: THREE.Vector3 | null, label = '') {
    if (!pos) {
      this.markerEl.classList.remove('on');
      return;
    }
    const v = pos.clone().project(camera);
    const behind = v.z > 1;
    let x = (v.x * 0.5 + 0.5) * innerWidth;
    let y = (-v.y * 0.5 + 0.5) * innerHeight;
    if (behind) {
      x = innerWidth - x;
      y = innerHeight - 60;
    }
    const m = 44;
    const cx = Math.min(innerWidth - m, Math.max(m, x));
    const cy = Math.min(innerHeight - m - 30, Math.max(m + 40, y));
    const clamped = cx !== x || cy !== y || behind;
    this.markerEl.style.transform = `translate(${cx}px, ${cy}px)`;
    this.markerEl.classList.add('on');
    this.markerEl.classList.toggle('edge', clamped);
    const d = camera.position.distanceTo(pos);
    (this.markerEl.querySelector('.mk-label') as HTMLDivElement).textContent = `${label}${label ? ' · ' : ''}${Math.round(d)} מ׳`;
  }

  health(visible: boolean, value = 3, max = 3) {
    this.healthEl.classList.toggle('on', visible);
    if (!visible) return;
    let h = '';
    for (let i = 0; i < max; i++) h += `<div class="hp ${i < value ? 'full' : ''}"></div>`;
    this.healthEl.innerHTML = h;
  }

  boss(visible: boolean, frac = 1) {
    this.bossEl.classList.toggle('on', visible);
    (this.bossEl.querySelector('.boss-bar div') as HTMLDivElement).style.width = `${Math.max(0, frac) * 100}%`;
  }

  /** QTE overlays: mash meter, timing ring, or a single urgent press. */
  qte(kind: 'mash' | 'timing' | 'press' | null, value = 0, label = '', key: KeyHint | null = null) {
    if (!kind) {
      this.qteEl.className = 'qte';
      return;
    }
    const k = key ? `<span class="key">${this.touch ? key.touch : key.key}</span>` : '';
    if (kind === 'mash') {
      this.qteEl.innerHTML = `<div class="q-label">${label}</div><div class="q-mash"><div style="width:${value * 100}%"></div></div><div class="q-key">${k}<span>${this.touch ? 'הקש שוב ושוב' : 'לחץ שוב ושוב'}</span></div>`;
    } else if (kind === 'timing') {
      const s = 1 + value * 2.2;
      this.qteEl.innerHTML = `<div class="q-label">${label}</div><div class="q-timing"><div class="q-target"></div><div class="q-ring" style="transform:translate(-50%,-50%) scale(${s})"></div>${k}</div>`;
    } else {
      this.qteEl.innerHTML = `<div class="q-label big">${label}</div><div class="q-key pulse">${k}</div>`;
    }
    this.qteEl.className = `qte on ${kind}`;
  }

  flashQte(ok: boolean) {
    this.qteEl.classList.remove('ok', 'bad');
    void this.qteEl.offsetWidth;
    this.qteEl.classList.add(ok ? 'ok' : 'bad');
  }

  toast(title: string, body: string, seconds = 7) {
    this.toastEl.innerHTML = `<div class="t-title">${title}</div><div class="t-body">${body}</div>`;
    this.toastEl.classList.remove('on');
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('on');
    this.later('toast', seconds * 1000, () => this.toastEl.classList.remove('on'));
  }

  fade(opacity: number, seconds = 1) {
    this.fadeEl.style.transition = `opacity ${seconds}s ease`;
    this.fadeEl.style.opacity = String(opacity);
  }

  hud(on: boolean) {
    this.root.classList.toggle('hud-off', !on);
  }

  // ------------------------------------------------------------------------------ menus
  private buildPause() {
    const keys = this.touch
      ? `<tr><td>ג׳ויסטיק (שמאל)</td><td>תנועה · דחיפה לקצה = ריצה</td></tr><tr><td>גרירה (ימין)</td><td>מצלמה</td></tr><tr><td>קֶלַע</td><td>החזק לסיבוב · שחרר לקליעה</td></tr><tr><td>מַקֵּל</td><td>הכאה במקל</td></tr><tr><td>פְּעֻלָּה</td><td>אסוף · הצל · תפוס</td></tr><tr><td>הִתְחַמֵּק</td><td>קפיצת התחמקות</td></tr><tr><td>קְרִיאָה</td><td>קריאה לצאן</td></tr>`
      : `<tr><td><span class="key">W A S D</span></td><td>תנועה</td></tr><tr><td><span class="key">Shift</span></td><td>ריצה</td></tr><tr><td><span class="key">עכבר</span></td><td>מצלמה (לחץ על המסך לנעילת הסמן, או גרור עם העכבר)</td></tr><tr><td><span class="key">לחצן שמאלי</span></td><td>החזק לסיבוב הקלע · שחרר לקליעה</td></tr><tr><td><span class="key">F</span> / <span class="key">לחצן ימני</span></td><td>הכאה במקל</td></tr><tr><td><span class="key">E</span></td><td>פעולה: אסוף · הצל · תפוס</td></tr><tr><td><span class="key">Space</span></td><td>התחמקות</td></tr><tr><td><span class="key">Q</span></td><td>קריאה לצאן</td></tr><tr><td><span class="key">Esc</span></td><td>תפריט</td></tr>`;
    this.pauseEl.innerHTML = `
      <div class="p-card">
        <div class="p-title">דָּוִד</div>
        <div class="p-sub">פרק ראשון · הרועה</div>
        <button class="p-btn" data-a="resume">המשך</button>
        <table class="p-keys">${keys}</table>
        <label class="p-row">עוצמת קול <input type="range" min="0" max="1" step="0.05" value="0.9" data-a="vol"></label>
        <label class="p-row">רגישות מצלמה <input type="range" min="0.3" max="2" step="0.1" value="1" data-a="sens"></label>
        <button class="p-btn ghost" data-a="restart">התחל את הפרק מחדש</button>
      </div>`;
    this.pauseEl.querySelector('[data-a="resume"]')!.addEventListener('click', () => this.onResume?.());
    this.pauseEl.querySelector('[data-a="restart"]')!.addEventListener('click', () => this.onRestart?.());
    (this.pauseEl.querySelector('[data-a="vol"]') as HTMLInputElement).addEventListener('input', (e) => this.onVolume?.(Number((e.target as HTMLInputElement).value)));
    (this.pauseEl.querySelector('[data-a="sens"]') as HTMLInputElement).addEventListener('input', (e) => this.onSensitivity?.(Number((e.target as HTMLInputElement).value)));
  }

  pause(on: boolean) {
    this.pauseEl.classList.toggle('on', on);
  }

  endCard(on: boolean, onReplay?: () => void, onFree?: () => void) {
    if (!on) {
      this.endEl.classList.remove('on');
      return;
    }
    this.endEl.innerHTML = `
      <div class="e-inner">
        <div class="e-small">סוֹף פֶּרֶק רִאשׁוֹן</div>
        <div class="e-title">הָרֹעֶה</div>
        <div class="e-verse">"${quoteText('s1_17_36_37_endcard')}"<span>${sourceRef('s1_17_36_37_endcard')}</span></div>
        <div class="e-next"><div class="e-next-label">בַּפֶּרֶק הַבָּא</div><div class="e-next-title">הַמְּשִׁיחָה</div><div class="e-next-verse">"${quoteText('s1_16_1_fill_horn')}"<span>${sourceRef('s1_16_1_fill_horn')}</span></div></div>
        <div class="e-btns"><button class="p-btn" data-a="free">המשך לשוטט בשדה</button><button class="p-btn ghost" data-a="replay">שחק שוב</button></div>
      </div>`;
    this.endEl.querySelector('[data-a="replay"]')!.addEventListener('click', () => onReplay?.());
    this.endEl.querySelector('[data-a="free"]')!.addEventListener('click', () => onFree?.());
    this.endEl.classList.add('on');
  }
}
