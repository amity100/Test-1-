import { el, esc, btn } from '../ui/dom';
import { t } from '../core/i18n';
import { formatTime } from '../core/MathUtil';
import type { Builder, BuilderTool } from './Builder';
import type { Tone } from './Architect';

export interface BuilderUICallbacks {
  ready(): void;
  card(): void;
  pause(): void;
}

const svg = (body: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const ICON = {
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h9a6 6 0 0 1 0 12h-3"/>'),
  redo: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9h-9a6 6 0 0 0 0 12h3"/>'),
  erase: svg('<path d="M4 15l7-7 8 8-3 3H8z"/><path d="M11 8l8 8"/><path d="M4 21h16"/>'),
  flag: svg('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'),
  dice: svg('<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="16" cy="8" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="8" cy="16" r="1.4" fill="currentColor"/><circle cx="16" cy="16" r="1.4" fill="currentColor"/>'),
  pause: svg('<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>'),
  glass: svg('<path d="M6 3h12v18H6z"/><path d="M9 6l6 9M9 12l4 6"/>'),
  roof: svg('<path d="M3 13L12 4l9 9"/><path d="M6 11v9h12v-9"/>'),
  frame: svg('<path d="M4 12h16M12 4v16"/>'),
};
const TONE_KEYS = ['toneStone', 'toneAlt', 'toneLight', 'toneAccent', 'toneGlass', 'toneDark', 'toneWood', 'toneRoof'];

/**
 * The block builder's interface: a palette of eight tones plus the eraser and the flag at the
 * bottom, and a top bar with the timer, the room count, the flag status, undo/redo, a random
 * castle, the card and Ready. Everything else happens by tapping the world.
 */
export class BuilderUI {
  readonly root: HTMLElement;
  private top: HTMLElement;
  private bar: HTMLElement;
  private hint: HTMLElement;
  private toast: HTMLElement;
  private timerEl!: HTMLElement;
  private roomsEl!: HTMLElement;
  private roomsFill!: HTMLElement;
  private statusEl!: HTMLElement;
  private undoBtn!: HTMLButtonElement;
  private redoBtn!: HTMLButtonElement;
  private swatchBtns: HTMLButtonElement[] = [];
  private toolBtns = new Map<BuilderTool, HTMLButtonElement>();
  private toastTimer = 0;
  private hintTimer = 0;
  private edits = 0;
  private unsub: (() => void)[] = [];

  constructor(parent: HTMLElement, private builder: Builder, private cb: BuilderUICallbacks, readonly compact: boolean) {
    this.root = el('div', `bldui ${compact ? 'compact' : ''}`);
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.top = el('div', 'bld-top');
    this.bar = el('div', 'bld-bar');
    this.hint = el('div', 'bld-hint');
    this.toast = el('div', 'bld-toast');
    this.toast.hidden = true;
    for (const panel of [this.top, this.bar]) {
      panel.setAttribute('data-ui', '1');
      panel.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') this.builder.uiHover = true;
      });
      panel.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'mouse') this.builder.uiHover = false;
      });
    }
    this.root.append(this.top, this.bar, this.hint, this.toast);
    this.render();
  }

  private iconBtn(parent: HTMLElement, cls: string, icon: string, label: string, onTap: () => void): HTMLButtonElement {
    const b = el('button', `bld-btn ${cls}`);
    b.innerHTML = `<span class="ico">${icon}</span>${label ? `<span class="lb">${esc(label)}</span>` : ''}`;
    b.title = label;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onTap();
    });
    parent.appendChild(b);
    return b;
  }

  render(): void {
    this.top.innerHTML = '';
    this.bar.innerHTML = '';
    // Top bar.
    if (this.compact) this.iconBtn(this.top, 'pause', ICON.pause, '', () => this.cb.pause());
    this.timerEl = el('div', 'bld-timer', '∞');
    const rooms = el('div', 'bld-roomswrap');
    this.roomsEl = el('div', 'bld-rooms', '0 / 0');
    const bar = el('div', 'bld-bar-track');
    this.roomsFill = el('div', 'fill');
    bar.appendChild(this.roomsFill);
    rooms.append(el('span', 'lbl', t('rooms')), this.roomsEl, bar);
    this.statusEl = el('div', 'bld-status');
    const actions = el('div', 'bld-actions');
    this.undoBtn = this.iconBtn(actions, 'small undo', ICON.undo, '', () => this.builder.undo());
    this.redoBtn = this.iconBtn(actions, 'small redo', ICON.redo, '', () => this.builder.redo());
    this.iconBtn(actions, 'small random', ICON.dice, this.compact ? '' : t('bldRandom'), () => this.builder.autoBuild());
    this.iconBtn(actions, 'small card', ICON.camera, '', () => this.cb.card());
    actions.appendChild(btn(t('ready'), 'primary bld-ready', () => this.cb.ready()));
    this.top.append(this.timerEl, rooms, this.statusEl, actions);
    // Palette.
    const swatches = this.builder.swatches();
    this.swatchBtns = [];
    for (let tone = 0; tone < 8; tone++) {
      const b = el('button', 'bld-swatch');
      b.dataset.tone = String(tone);
      b.style.setProperty('--sw', swatches[tone]);
      b.title = t(TONE_KEYS[tone]);
      if (tone === 4) b.innerHTML = `<span class="ico">${ICON.glass}</span>`;
      else if (tone === 7) b.innerHTML = `<span class="ico">${ICON.roof}</span>`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.builder.setTone(tone as Tone);
        if (this.builder.tool !== 'build') this.builder.setTool('build');
        this.refresh();
      });
      this.bar.appendChild(b);
      this.swatchBtns.push(b);
    }
    this.bar.appendChild(el('div', 'bld-sep'));
    this.toolBtns.clear();
    this.toolBtns.set('erase', this.iconBtn(this.bar, 'tool erase', ICON.erase, t('bldEraser'), () => this.toggleTool('erase')));
    this.toolBtns.set('flag', this.iconBtn(this.bar, 'tool flag', ICON.flag, t('bldFlag'), () => this.toggleTool('flag')));
    this.hint.textContent = t(this.compact ? 'bldHintTouch' : 'bldHintMouse');
    this.refresh();
  }

  private toggleTool(tool: BuilderTool): void {
    this.builder.setTool(this.builder.tool === tool ? 'build' : tool);
    this.refresh();
  }

  show(): void {
    this.root.hidden = false;
    this.hintTimer = 0;
    this.edits = 0;
    this.hint.hidden = false;
    this.render();
    for (const off of this.unsub) off();
    this.unsub = [
      this.builder.events.on('change', () => this.refresh()),
      this.builder.events.on('placed', () => this.countEdit()),
      this.builder.events.on('removed', () => this.countEdit()),
      this.builder.events.on('invalid', ({ key }) => this.showToast(t(key))),
    ];
  }

  hide(): void {
    this.root.hidden = true;
    for (const off of this.unsub) off();
    this.unsub = [];
    this.builder.uiHover = false;
  }

  private countEdit(): void {
    this.edits++;
    if (this.edits >= 4) this.hint.hidden = true;
  }

  showToast(text: string): void {
    this.toast.textContent = text;
    this.toast.hidden = false;
    this.toastTimer = 2.2;
  }

  update(dt: number, timeLeft: number | null): void {
    const txt = timeLeft === null ? '∞' : formatTime(timeLeft);
    if (this.timerEl.textContent !== txt) this.timerEl.textContent = txt;
    this.timerEl.classList.toggle('urgent', timeLeft !== null && timeLeft < 30);
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.hidden = true;
    }
    if (!this.hint.hidden) {
      this.hintTimer += dt;
      if (this.hintTimer > 25) this.hint.hidden = true;
    }
  }

  refresh(): void {
    const b = this.builder;
    this.roomsEl.textContent = `${b.blocks} / ${b.budget}`;
    this.roomsFill.style.width = `${Math.min(100, (100 * b.blocks) / b.budget)}%`;
    this.roomsFill.classList.toggle('full', b.blocks >= b.budget);
    let statusKey = 'flagOk';
    if (b.reach.reason === 'noFlag') statusKey = 'flagMissing';
    else if (b.reach.reason === 'sealed') statusKey = 'flagSealed';
    else if (b.reach.reason === 'flagOutside') statusKey = 'flagOutside';
    else if (b.reach.reason === 'noSpawn') statusKey = 'spawnMissing';
    else if (b.reach.reason === 'spawnUnreachable') statusKey = 'spawnUnreachable';
    this.statusEl.textContent = this.compact ? (b.reach.ok ? '⚑ ✓' : `⚑ ${t(statusKey)}`) : t(statusKey);
    this.statusEl.className = `bld-status ${b.reach.ok ? 'ok' : 'bad'}`;
    this.undoBtn.classList.toggle('off', !b.canUndo);
    this.redoBtn.classList.toggle('off', !b.canRedo);
    this.swatchBtns.forEach((s, i) => s.classList.toggle('active', b.tool === 'build' && b.tone === i));
    for (const [tool, el2] of this.toolBtns) el2.classList.toggle('active', b.tool === tool);
  }
}
