import { el, esc, btn } from '../ui/dom';
import { t } from '../core/i18n';
import { formatTime } from '../core/MathUtil';
import type { Builder, BuilderTool } from './Builder';
import type { Tone } from './Architect';
import { TRAP_KINDS, TRAP_SLOTS, TRAP_COST, type TrapKind } from '../sim/Traps';
import { TRAP_ICON, TRAP_NAME_KEY } from '../ui/TrapIcons';

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
  ping: svg('<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2" fill="currentColor" stroke="none"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>'),
  glass: svg('<path d="M6 3h12v18H6z"/><path d="M9 6l6 9M9 12l4 6"/>'),
  roof: svg('<path d="M3 13L12 4l9 9"/><path d="M6 11v9h12v-9"/>'),
  frame: svg('<path d="M4 12h16M12 4v16"/>'),
  pillar: svg('<path d="M4 4h16M4 20h16"/><path d="M8 4v16M16 4v16"/><path d="M12 7v10"/>'),
  trap: svg('<path d="M4 20h16"/><path d="M6 20l2-8 2 8M11 20l2-10 2 10M16 20l1.5-6 1.5 6"/>'),
};
const TIPS = ['tipBridge', 'tipTraps', 'tipTerrace', 'tipColonnade', 'tipCourt', 'tipStairs', 'tipTowers'];
/** Seconds each tip stays up, and how long tips keep rotating before the hint retires. */
const TIP_SECONDS = 9;
const TIPS_TOTAL_SECONDS = 110;
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
  private sub: HTMLElement;
  private slotsEl!: HTMLElement;
  private kindBtns = new Map<TrapKind, HTMLButtonElement>();
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
  private tipTimer = 0;
  private tipIndex = -1;
  private edits = 0;
  private unsub: (() => void)[] = [];

  /** Teammates' next cells (war builds), projected to the screen. */
  private cursorLayer: HTMLElement;
  private cursorEls: HTMLElement[] = [];

  constructor(parent: HTMLElement, private builder: Builder, private cb: BuilderUICallbacks, readonly compact: boolean, readonly team = false) {
    this.root = el('div', `bldui ${compact ? 'compact' : ''} ${team ? 'team' : ''}`);
    this.cursorLayer = el('div', 'bld-cursors');
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.top = el('div', 'bld-top');
    this.bar = el('div', 'bld-bar');
    this.sub = el('div', 'bld-sub');
    this.sub.hidden = true;
    this.hint = el('div', 'bld-hint');
    this.toast = el('div', 'bld-toast');
    this.toast.hidden = true;
    for (const panel of [this.top, this.bar, this.sub]) {
      panel.setAttribute('data-ui', '1');
      panel.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') this.builder.uiHover = true;
      });
      panel.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'mouse') this.builder.uiHover = false;
      });
    }
    this.root.append(this.cursorLayer, this.top, this.bar, this.sub, this.hint, this.toast);
    this.render();
  }

  /** Where each teammate is about to build: a small tag over the cell. */
  setCursors(list: { name: string; color: string; sx: number; sy: number; visible: boolean }[]): void {
    while (this.cursorEls.length < list.length) {
      const e = el('div', 'bld-cursor');
      e.innerHTML = '<span class="dot"></span><span class="nm"></span>';
      this.cursorLayer.appendChild(e);
      this.cursorEls.push(e);
    }
    this.cursorEls.forEach((e, i) => {
      const c = list[i];
      if (!c || !c.visible) {
        e.hidden = true;
        return;
      }
      e.hidden = false;
      e.style.transform = `translate(${c.sx.toFixed(0)}px, ${c.sy.toFixed(0)}px)`;
      e.style.setProperty('--c', c.color);
      const nm = e.querySelector('.nm') as HTMLElement;
      if (nm.textContent !== c.name) nm.textContent = c.name;
    });
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

  /** Battle command map: the crew split and the supplies, and READY becomes BACK TO THE FIGHT. */
  private command: { total: number; build: number; defend: number; supplies: () => number; onChange: (build: number, defend: number) => void } | null = null;
  private suppliesEl: HTMLElement | null = null;
  private crewEls: { build: HTMLElement; defend: HTMLElement; attack: HTMLElement } | null = null;

  setCommand(c: BuilderUI['command']): void {
    this.command = c;
    this.root.classList.toggle('command', !!c);
    if (!this.root.hidden) this.render();
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
    if (!this.command) {
      this.iconBtn(actions, 'small random', ICON.dice, this.compact ? '' : t('bldRandom'), () => this.builder.autoBuild());
      this.iconBtn(actions, 'small card', ICON.camera, '', () => this.cb.card());
    }
    actions.appendChild(btn(t(this.command ? 'backToBattle' : 'ready'), 'primary bld-ready', () => this.cb.ready()));
    this.statusEl.hidden = !!this.command;
    if (this.command) {
      // Supplies and the crew split: how many build, defend and attack.
      const c = this.command;
      this.suppliesEl = el('div', 'bld-supplies');
      const crew = el('div', 'bld-crew');
      const row = (key: string, get: () => number, set: ((v: number) => void) | null): HTMLElement => {
        const r = el('div', 'crew-row');
        const val = el('span', 'val', String(get()));
        r.append(el('span', 'lbl', t(key)));
        if (set) {
          const minus = el('button', 'crew-btn', '−');
          const plus = el('button', 'crew-btn', '+');
          minus.addEventListener('click', (e) => { e.stopPropagation(); set(get() - 1); });
          plus.addEventListener('click', (e) => { e.stopPropagation(); set(get() + 1); });
          r.append(minus, val, plus);
        } else r.append(val);
        return r;
      };
      const apply = (build: number, defend: number): void => {
        build = Math.max(0, Math.min(c.total, build));
        defend = Math.max(0, Math.min(c.total - build, defend));
        c.build = build;
        c.defend = defend;
        c.onChange(build, defend);
        this.refresh();
      };
      const rb = row('crewBuild', () => c.build, (v) => apply(v, c.defend));
      const rd = row('crewDefend', () => c.defend, (v) => apply(c.build, v));
      const ra = row('crewAttack', () => c.total - c.build - c.defend, null);
      this.crewEls = { build: rb.querySelector('.val') as HTMLElement, defend: rd.querySelector('.val') as HTMLElement, attack: ra.querySelector('.val') as HTMLElement };
      crew.append(el('span', 'crew-title', t('crew')), rb, rd, ra);
      this.top.append(this.timerEl, rooms, this.suppliesEl, crew, actions);
    } else {
      this.suppliesEl = null;
      this.crewEls = null;
      this.top.append(this.timerEl, rooms, this.statusEl, actions);
    }
    // Palette.
    const swatches = this.builder.swatches();
    this.swatchBtns = [];
    for (let tone = 0; tone < 8; tone++) {
      const b = el('button', 'bld-swatch');
      b.dataset.tone = String(tone);
      b.style.setProperty('--sw', swatches[tone]);
      b.title = t(TONE_KEYS[tone]);
      if (tone === 4) b.innerHTML = `<span class="ico">${ICON.glass}</span>`;
      else if (tone === 5) b.innerHTML = `<span class="ico">${ICON.pillar}</span>`;
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
    this.toolBtns.set('trap', this.iconBtn(this.bar, 'tool trap', ICON.trap, t('bldTrap'), () => this.toggleTool('trap')));
    if (this.team) this.toolBtns.set('ping', this.iconBtn(this.bar, 'tool ping', ICON.ping, t('bldPing'), () => this.toggleTool('ping')));
    // Trap kinds (shown while the trap tool is active) with the slot counter.
    this.sub.innerHTML = '';
    this.kindBtns.clear();
    for (const kind of TRAP_KINDS) {
      const b = this.iconBtn(this.sub, `kind ${kind}`, TRAP_ICON[kind], t(TRAP_NAME_KEY[kind]), () => {
        this.builder.setTrapKind(kind);
        this.refresh();
      });
      if (TRAP_COST[kind] > 1) b.appendChild(el('span', 'cost', `×${TRAP_COST[kind]}`));
      this.kindBtns.set(kind, b);
    }
    this.slotsEl = el('div', 'slots');
    this.sub.appendChild(this.slotsEl);
    this.hint.textContent = t(this.command ? 'bldHintCommand' : this.team ? 'bldHintTeam' : this.compact ? 'bldHintTouch' : 'bldHintMouse');
    this.refresh();
  }

  private toggleTool(tool: BuilderTool): void {
    this.builder.setTool(this.builder.tool === tool ? 'build' : tool);
    this.refresh();
  }

  show(): void {
    this.root.hidden = false;
    this.hintTimer = 0;
    this.tipTimer = 0;
    this.tipIndex = -1;
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

  /** After a few edits the basic hint gives way to the rotating mechanic tips. */
  private countEdit(): void {
    this.edits++;
    if (this.edits >= 4 && this.tipIndex < 0) this.nextTip();
  }

  private nextTip(): void {
    this.tipIndex = (this.tipIndex + 1) % TIPS.length;
    this.tipTimer = 0;
    this.hint.textContent = t(TIPS[this.tipIndex]);
    this.hint.classList.remove('pop');
    void this.hint.offsetWidth;
    this.hint.classList.add('pop');
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
      if (this.tipIndex < 0 && this.hintTimer > 25) this.nextTip();
      if (this.tipIndex >= 0) {
        this.tipTimer += dt;
        if (this.tipTimer > TIP_SECONDS) this.nextTip();
      }
      if (this.hintTimer > TIPS_TOTAL_SECONDS) this.hint.hidden = true;
    }
  }

  refresh(): void {
    const b = this.builder;
    if (this.command && this.suppliesEl) {
      const txt = `${t('supplies')} ${this.command.supplies()} · ${t('orderCost', { n: 5 })}${b.orders.length ? ` · ${t('ordersPending', { n: b.orders.length })}` : ''}`;
      if (this.suppliesEl.textContent !== txt) this.suppliesEl.textContent = txt;
      if (this.crewEls) {
        this.crewEls.build.textContent = String(this.command.build);
        this.crewEls.defend.textContent = String(this.command.defend);
        this.crewEls.attack.textContent = String(this.command.total - this.command.build - this.command.defend);
      }
    }
    this.roomsEl.textContent = this.command ? `${b.blocks + b.orders.length} / ${b.budget}` : `${b.blocks} / ${b.budget}`;
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
    // Trap sub-bar.
    const trapTool = b.tool === 'trap';
    this.sub.hidden = !trapTool;
    this.root.classList.toggle('trap', trapTool);
    if (trapTool) {
      const used = b.trapSlots;
      for (const [kind, el3] of this.kindBtns) {
        el3.classList.toggle('active', b.trapKind === kind);
        el3.classList.toggle('off', used + TRAP_COST[kind] > TRAP_SLOTS);
      }
      const txt = t('trapSlots', { n: used, total: TRAP_SLOTS });
      if (this.slotsEl.textContent !== txt) this.slotsEl.textContent = txt;
      if (this.tipIndex < 0) this.hint.textContent = t('bldHintTrap');
    } else if (b.tool === 'ping') this.hint.textContent = t('bldHintPing');
    else if (this.tipIndex < 0 && !this.hint.hidden) this.hint.textContent = t(this.command ? 'bldHintCommand' : this.team ? 'bldHintTeam' : this.compact ? 'bldHintTouch' : 'bldHintMouse');
  }
}
