import { el, btn, esc, segmented, field, slider } from './dom';
import { t, setLang, getLang } from '../core/i18n';
import { VERSION } from '../core/Version';
import { settings, type Quality, type Language } from '../core/Settings';
import { STYLE_IDS, STYLES, type StyleId } from '../world/Styles';
import type { MatchConfig, Difficulty } from '../sim/Match';
import { PALETTE } from '../world/Voxel';

export interface ScreenCallbacks {
  start(cfg: MatchConfig): void;
  resume(): void;
  quit(): void;
  playAgain(): void;
  settingsChanged(): void;
  languageChanged(): void;
  clickToPlay(): void;
  uiSound(kind: 'click' | 'hover'): void;
  /** Builds and shows the shareable fortress card. */
  card(): void;
}

export interface SummaryRow {
  name: string;
  color: string;
  delta: string;
  total: number;
  isYou: boolean;
}

export interface SummaryData {
  title: string;
  sub: string;
  rows: SummaryRow[];
}

export interface PodiumRow {
  name: string;
  score: number;
  captures: number;
  kills: number;
  defense: string;
  color: string;
  isYou: boolean;
}

type ScreenName = 'none' | 'menu' | 'setup' | 'settings' | 'howto' | 'pause' | 'summary' | 'podium' | 'click' | 'card' | 'loadout';

export interface LoadoutOption {
  id: string;
  name: string;
  desc?: string;
  icon?: string;
}

export interface LoadoutData {
  title: string;
  weapons: LoadoutOption[];
  weapon: string;
  gadgets: LoadoutOption[];
  kit: string[];
  kitSize: number;
  onWeapon(id: string): void;
  onKit(ids: string[]): void;
  onReady(): void;
}

const SETUP_KEY = 'flagkeep.setup.v1';

/** Full-screen menus and overlays. */
export class Screens {
  private root: HTMLElement;
  private current: ScreenName = 'none';
  private container: HTMLElement | null = null;
  private setup: MatchConfig;
  private settingsBack: 'menu' | 'pause' = 'menu';
  private updateReady = false;
  private lastSummary: SummaryData | null = null;
  private lastPodium: PodiumRow[] | null = null;
  private nextInEl: HTMLElement | null = null;
  private lastLoadout: LoadoutData | null = null;
  private loadoutCount: HTMLElement | null = null;

  constructor(parent: HTMLElement, private cb: ScreenCallbacks) {
    this.root = el('div', 'screens');
    parent.appendChild(this.root);
    this.setup = { playerName: settings.data.playerName, botCount: 5, difficulty: 'normal', buildTime: 300, roundTime: 240, style: 'medieval' };
    try {
      const raw = localStorage.getItem(SETUP_KEY);
      if (raw) this.setup = { ...this.setup, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button')) this.cb.uiSound('click');
    });
    this.root.addEventListener('mouseover', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button')) this.cb.uiSound('hover');
    });
  }

  get visible(): boolean {
    return this.current !== 'none';
  }
  get name(): ScreenName {
    return this.current;
  }

  hideAll(): void {
    this.current = 'none';
    this.root.innerHTML = '';
    this.container = null;
  }

  private mount(name: ScreenName, panel: HTMLElement, dim = true): void {
    this.hideAll();
    this.current = name;
    const screen = el('div', `screen ${dim ? 'dim' : ''}`);
    screen.setAttribute('data-ui', '1');
    screen.appendChild(panel);
    this.root.appendChild(screen);
    this.container = screen;
  }

  refresh(): void {
    switch (this.current) {
      case 'menu': this.showMenu(); break;
      case 'setup': this.showSetup(); break;
      case 'settings': this.showSettings(this.settingsBack); break;
      case 'howto': this.showHowTo(); break;
      case 'pause': this.showPause(); break;
      case 'summary': if (this.lastSummary) this.showRoundSummary(this.lastSummary, 0); break;
      case 'podium': if (this.lastPodium) this.showPodium(this.lastPodium); break;
      case 'loadout': if (this.lastLoadout) this.showLoadout(this.lastLoadout); break;
      default: break;
    }
  }

  /** Shows the reload pill on the menu once a newer deploy has been detected. */
  showUpdateAvailable(): void {
    this.updateReady = true;
    const pill = this.root.querySelector<HTMLElement>('.panel.menu .update-pill');
    if (pill) pill.hidden = false;
  }

  showMenu(): void {
    const p = el('div', 'panel menu');
    p.innerHTML = `<h1>FLAG<span>KEEP</span></h1><div class="tagline">${esc(t('tagline'))}</div><div class="ver">v${VERSION} · ${esc(t('versionTag'))}</div>`;
    const stack = el('div', 'stack');
    stack.append(
      btn(t('play'), 'primary', () => this.showSetup()),
      btn(t('howToPlay'), '', () => this.showHowTo()),
      btn(t('settings'), '', () => this.showSettings('menu')),
    );
    const langRow = el('div', 'row');
    langRow.style.justifyContent = 'space-between';
    langRow.style.marginTop = '18px';
    langRow.appendChild(el('span', 'muted', t('language')));
    langRow.appendChild(
      segmented<Language>([{ value: 'he', label: 'עברית' }, { value: 'en', label: 'English' }], getLang(), (l) => {
        setLang(l);
        settings.data.language = l;
        settings.save();
        this.cb.languageChanged();
        this.refresh();
      }),
    );
    const pill = btn(t('updateAvailable'), 'small update-pill', () => location.reload());
    pill.hidden = !this.updateReady;
    p.append(stack, langRow, pill);
    this.mount('menu', p, false);
  }

  showSetup(): void {
    const p = el('div', 'panel setup');
    p.innerHTML = `<h2>${esc(t('start'))}</h2>`;
    const grid = el('div', 'grid2');
    const name = el('input');
    name.type = 'text';
    name.maxLength = 16;
    name.placeholder = t('namePlaceholder');
    name.value = this.setup.playerName;
    name.addEventListener('input', () => {
      this.setup.playerName = name.value;
    });
    grid.appendChild(field(t('yourName'), name));
    grid.appendChild(
      field(
        t('bots'),
        segmented(
          [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) })),
          this.setup.botCount,
          (v) => (this.setup.botCount = v),
        ),
      ),
    );
    grid.appendChild(
      field(
        t('difficulty'),
        segmented<Difficulty>(
          [
            { value: 'easy', label: t('dEasy') },
            { value: 'normal', label: t('dNormal') },
            { value: 'hard', label: t('dHard') },
            { value: 'nightmare', label: t('dNightmare') },
          ],
          this.setup.difficulty,
          (v) => (this.setup.difficulty = v),
        ),
      ),
    );
    grid.appendChild(
      field(
        t('buildTime'),
        segmented(
          [
            { value: 180, label: t('minutes', { n: 3 }) },
            { value: 300, label: t('minutes', { n: 5 }) },
            { value: 480, label: t('minutes', { n: 8 }) },
            { value: 0, label: t('unlimited') },
          ],
          this.setup.buildTime,
          (v) => (this.setup.buildTime = v),
        ),
      ),
    );
    grid.appendChild(field(t('roundTime'), el('div', 'muted', t('minutes', { n: 4 }))));
    p.appendChild(grid);
    // Style picker
    const styles = el('div', 'styles');
    const render = (): void => {
      styles.innerHTML = '';
      for (const id of STYLE_IDS) {
        const s = STYLES[id];
        const card = el('button', `style-card ${this.setup.style === id ? 'active' : ''}`);
        const sw = el('div', 'swatches');
        for (const c of s.colors.slice(0, 6)) {
          const d = el('div', 'sw');
          d.style.background = PALETTE[c];
          sw.appendChild(d);
        }
        card.append(sw, el('div', 'sname', t(s.nameKey)));
        card.addEventListener('click', () => {
          this.setup.style = id as StyleId;
          render();
        });
        styles.appendChild(card);
      }
    };
    render();
    p.appendChild(field(t('style'), styles));
    const row = el('div', 'row');
    row.style.marginTop = '20px';
    row.style.justifyContent = 'space-between';
    row.append(
      btn(t('back'), '', () => this.showMenu()),
      btn(t('start'), 'primary', () => {
        if (!this.setup.playerName.trim()) this.setup.playerName = t('namePlaceholder');
        settings.data.playerName = this.setup.playerName;
        settings.save();
        try {
          localStorage.setItem(SETUP_KEY, JSON.stringify(this.setup));
        } catch {
          /* ignore */
        }
        this.cb.start({ ...this.setup });
      }),
    );
    p.appendChild(row);
    this.mount('setup', p);
  }

  showSettings(back: 'menu' | 'pause'): void {
    this.settingsBack = back;
    const p = el('div', 'panel settings');
    p.innerHTML = `<h2>${esc(t('settings'))}</h2>`;
    const d = settings.data;
    const stack = el('div', 'stack');
    stack.appendChild(
      field(
        t('quality'),
        segmented<Quality | 'auto'>(
          [
            { value: 'auto', label: t('qAuto') },
            { value: 'low', label: t('qLow') },
            { value: 'medium', label: t('qMedium') },
            { value: 'high', label: t('qHigh') },
            { value: 'ultra', label: t('qUltra') },
          ],
          d.quality,
          (v) => {
            d.quality = v;
            settings.save();
            this.cb.settingsChanged();
          },
        ),
      ),
    );
    stack.appendChild(field(t('sensitivity'), slider(0.2, 3, 0.05, d.sensitivity, (v) => { d.sensitivity = v; settings.save(); }, (v) => v.toFixed(2))));
    stack.appendChild(field(t('fov'), slider(60, 110, 1, d.fov, (v) => { d.fov = v; settings.save(); this.cb.settingsChanged(); }, (v) => `${v}°`)));
    stack.appendChild(field(t('volume'), slider(0, 1, 0.05, d.volume, (v) => { d.volume = v; settings.save(); this.cb.settingsChanged(); }, (v) => `${Math.round(v * 100)}%`)));
    stack.appendChild(field(t('music'), slider(0, 1, 0.05, d.music, (v) => { d.music = v; settings.save(); this.cb.settingsChanged(); }, (v) => `${Math.round(v * 100)}%`)));
    const toggles = el('div', 'row');
    toggles.appendChild(this.toggle(t('invertY'), d.invertY, (v) => { d.invertY = v; settings.save(); }));
    toggles.appendChild(this.toggle(t('showFps'), d.showFps, (v) => { d.showFps = v; settings.save(); }));
    toggles.appendChild(this.toggle(t('autoSprint'), d.autoSprint, (v) => { d.autoSprint = v; settings.save(); }));
    toggles.appendChild(this.toggle(t('aimAssist'), d.aimAssist, (v) => { d.aimAssist = v; settings.save(); }));
    stack.appendChild(toggles);
    stack.appendChild(el('div', 'muted section', t('touchSection')));
    const touchRow = el('div', 'row');
    touchRow.appendChild(this.toggle(t('autoFire'), d.autoFire, (v) => { d.autoFire = v; settings.save(); this.cb.settingsChanged(); }));

    stack.appendChild(touchRow);
    stack.appendChild(field(t('touchScale'), slider(0.75, 1.4, 0.05, d.touchScale, (v) => { d.touchScale = v; settings.save(); this.cb.settingsChanged(); }, (v) => `${Math.round(v * 100)}%`)));
    stack.appendChild(field(t('touchOpacity'), slider(0.3, 1, 0.05, d.touchOpacity, (v) => { d.touchOpacity = v; settings.save(); this.cb.settingsChanged(); }, (v) => `${Math.round(v * 100)}%`)));
    stack.appendChild(
      field(
        t('language'),
        segmented<Language>([{ value: 'he', label: 'עברית' }, { value: 'en', label: 'English' }], getLang(), (l) => {
          setLang(l);
          d.language = l;
          settings.save();
          this.cb.languageChanged();
          this.refresh();
        }),
      ),
    );
    stack.appendChild(btn(t('back'), '', () => (back === 'menu' ? this.showMenu() : this.showPause())));
    p.appendChild(stack);
    this.mount('settings', p);
  }

  private toggle(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
    const b = btn(`${value ? '☑' : '☐'} ${label}`, value ? 'active' : '', () => {
      value = !value;
      b.textContent = `${value ? '☑' : '☐'} ${label}`;
      b.classList.toggle('active', value);
      onChange(value);
    });
    return b;
  }

  showHowTo(): void {
    const p = el('div', 'panel howto');
    p.innerHTML =
      `<h2>${esc(t('htpTitle'))}</h2><ol class="htp">` +
      ['htp1', 'htp2', 'htp3', 'htp4', 'htp5', 'htp6'].map((k) => `<li>${esc(t(k))}</li>`).join('') +
      `</ol><h3>${esc(t('controls'))}</h3><ul class="ctrls">` +
      ['ctrlMove', 'ctrlJump', 'ctrlShoot', 'ctrlWeapons', 'ctrlMisc'].map((k) => `<li>${esc(t(k))}</li>`).join('') +
      `</ul>`;
    p.appendChild(btn(t('back'), '', () => this.showMenu()));
    this.mount('howto', p);
  }

  showPause(): void {
    const p = el('div', 'panel pause');
    p.innerHTML = `<h2>${esc(t('pause'))}</h2>`;
    const stack = el('div', 'stack');
    stack.append(
      btn(t('resume'), 'primary', () => this.cb.resume()),
      btn(t('settings'), '', () => this.showSettings('pause')),
      btn(t('quitToMenu'), 'danger', () => this.cb.quit()),
    );
    p.appendChild(stack);
    this.mount('pause', p);
  }

  showRoundSummary(data: SummaryData, nextIn: number): void {
    this.lastSummary = data;
    const p = el('div', 'panel summary');
    p.innerHTML = `<div class="stitle">${esc(data.title)}</div><div class="ssub">${esc(data.sub)}</div>`;
    const table = el('div', 'srows');
    for (const r of data.rows) {
      const row = el('div', `srow ${r.isYou ? 'you' : ''}`);
      row.innerHTML = `<span class="sw" style="background:${r.color}"></span><span class="n">${esc(r.name)}</span><span class="d">${esc(r.delta)}</span><span class="tot">${r.total}</span>`;
      table.appendChild(row);
    }
    p.appendChild(table);
    this.nextInEl = el('div', 'muted nextin', t('nextRound', { n: Math.ceil(nextIn) }));
    p.appendChild(this.nextInEl);
    this.mount('summary', p);
  }

  updateSummaryCountdown(nextIn: number): void {
    if (this.nextInEl && this.current === 'summary') this.nextInEl.textContent = t('nextRound', { n: Math.max(0, Math.ceil(nextIn)) });
  }

  showPodium(rows: PodiumRow[]): void {
    this.lastPodium = rows;
    const p = el('div', 'panel podium');
    const winner = rows[0];
    p.innerHTML = `<h2>${esc(t('podium'))}</h2><div class="winner"><span class="crown">👑</span> ${esc(t('winner'))}: <b style="color:${winner?.color}">${esc(winner?.name ?? '')}</b></div>`;
    const table = el('table', 'ptable');
    table.innerHTML =
      `<thead><tr><th>#</th><th></th><th>${t('score')}</th><th>${t('captures')}</th><th>${t('kills')}</th><th>${t('defenseTime')}</th></tr></thead><tbody>` +
      rows
        .map(
          (r, i) =>
            `<tr class="${r.isYou ? 'you' : ''} ${i < 3 ? `top${i + 1}` : ''}"><td>${i + 1}</td><td><span class="sw" style="background:${r.color}"></span>${esc(r.name)}</td><td class="num">${r.score}</td><td class="num">${r.captures}</td><td class="num">${r.kills}</td><td class="num">${esc(r.defense)}</td></tr>`,
        )
        .join('') +
      '</tbody>';
    p.appendChild(table);
    const row = el('div', 'row');
    row.style.marginTop = '18px';
    row.append(btn(t('playAgain'), 'primary', () => this.cb.playAgain()), btn(`📸 ${esc(t('card'))}`, '', () => this.cb.card()), btn(t('quitToMenu'), '', () => this.cb.quit()));
    p.appendChild(row);
    this.mount('podium', p);
  }

  refreshPodium(): void {
    if (this.lastPodium) this.showPodium(this.lastPodium);
  }

  /** Round-intro loadout: primary weapon and two of the five gadgets. Sits at the bottom so the flyby stays visible. */
  showLoadout(data: LoadoutData): void {
    this.lastLoadout = data;
    const p = el('div', 'panel loadout');
    const head = el('div', 'lo-head');
    head.appendChild(el('div', 'lo-title', `${data.title} · ${t('loadout')}`));
    this.loadoutCount = el('div', 'lo-count', '');
    head.appendChild(this.loadoutCount);
    p.appendChild(head);
    p.appendChild(el('div', 'lo-sec', t('pickWeapon')));
    const wrow = el('div', 'lo-weapons');
    let weapon = data.weapon;
    const chips: HTMLElement[] = [];
    for (const w of data.weapons) {
      const c = document.createElement('button');
      c.className = `lo-chip ${w.id === weapon ? 'sel' : ''}`;
      c.textContent = w.name;
      c.addEventListener('click', () => {
        weapon = w.id;
        for (let i = 0; i < chips.length; i++) chips[i].classList.toggle('sel', data.weapons[i].id === weapon);
        data.onWeapon(weapon);
      });
      chips.push(c);
      wrow.appendChild(c);
    }
    p.appendChild(wrow);
    p.appendChild(el('div', 'lo-sec', t('pickKit', { n: data.kitSize })));
    const grid = el('div', 'lo-gadgets');
    const kit = data.kit.slice(0, data.kitSize);
    const cards: HTMLElement[] = [];
    const keys = ['Q', 'F'];
    const paint = (): void => {
      data.gadgets.forEach((g, i) => {
        const idx = kit.indexOf(g.id);
        cards[i].classList.toggle('sel', idx >= 0);
        const slot = cards[i].querySelector('.slot') as HTMLElement;
        slot.hidden = idx < 0;
        slot.textContent = keys[idx] ?? String(idx + 1);
      });
    };
    for (const g of data.gadgets) {
      const c = document.createElement('button');
      c.className = 'lo-card';
      c.innerHTML = `<span class="slot" hidden></span>${g.icon ?? ''}<span class="nm">${esc(g.name)}</span><span class="ds">${esc(g.desc ?? '')}</span>`;
      c.addEventListener('click', () => {
        const at = kit.indexOf(g.id);
        if (at >= 0) kit.splice(at, 1);
        else {
          kit.push(g.id);
          while (kit.length > data.kitSize) kit.shift();
        }
        paint();
        data.onKit(kit.slice());
      });
      cards.push(c);
      grid.appendChild(c);
    }
    paint();
    p.appendChild(grid);
    const foot = el('div', 'lo-foot');
    foot.appendChild(btn(`✔ ${t('kitReady')}`, 'primary', () => data.onReady()));
    p.appendChild(foot);
    this.mount('loadout', p, false);
    this.container?.classList.add('bottom');
  }

  updateLoadoutCountdown(seconds: number): void {
    if (this.loadoutCount && this.current === 'loadout') this.loadoutCount.textContent = t('startsIn', { n: Math.max(0, Math.ceil(seconds)) });
  }

  /** Modal with the rendered fortress card: share (when supported), download, close. */
  showCard(dataUrl: string, blob: Blob | null, onClose: () => void): void {
    const p = el('div', 'panel card');
    p.innerHTML = `<h2>${esc(t('myFortress'))}</h2>`;
    const img = el('img', 'card-img');
    img.src = dataUrl;
    img.alt = t('card');
    p.appendChild(img);
    p.appendChild(el('div', 'muted small-note', esc(t('cardHint'))));
    const row = el('div', 'row');
    row.style.marginTop = '14px';
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    const file = blob ? new File([blob], 'flagkeep-fortress.png', { type: 'image/png' }) : null;
    if (file && typeof nav.share === 'function' && (!nav.canShare || nav.canShare({ files: [file] }))) {
      row.appendChild(
        btn(`⤴ ${esc(t('shareCard'))}`, 'primary', () => {
          nav.share({ files: [file], title: 'FLAGKEEP', text: t('tagline') }).catch(() => undefined);
        }),
      );
    }
    const a = document.createElement('a');
    a.className = 'btn';
    a.href = dataUrl;
    a.download = 'flagkeep-fortress.png';
    a.textContent = `⬇ ${t('download')}`;
    row.appendChild(a);
    row.appendChild(btn(t('close'), '', onClose));
    p.appendChild(row);
    this.mount('card', p);
  }

  showClickToPlay(fallback: boolean): void {
    const p = el('div', 'clickplay');
    const touch = navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches;
    p.innerHTML = `<div class="big">${esc(t(touch ? 'tapToPlay' : 'clickToPlay'))}</div>${fallback && !touch ? `<div class="muted">${esc(t('fallbackLook'))}</div>` : ''}`;
    const screen = el('div', 'screen');
    screen.setAttribute('data-ui', '1');
    screen.appendChild(p);
    screen.addEventListener('click', () => this.cb.clickToPlay());
    this.hideAll();
    this.current = 'click';
    this.root.appendChild(screen);
    this.container = screen;
  }
}
