import { el, esc, btn } from '../ui/dom';
import { t } from '../core/i18n';
import { formatTime } from '../core/MathUtil';
import type { Fortify } from './Fortify';
import { TRAP_KINDS, TRAP_COST, type TrapKind } from '../sim/Traps';
import { TRAP_ICON, TRAP_NAME_KEY, TRAP_DESC_KEY } from '../ui/TrapIcons';

export interface FortifyUICallbacks {
  ready(): void;
  pause(): void;
}

const svg = (body: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const ICON_PAUSE = svg('<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>');
/** Seconds the instruction card stays up unless dismissed or a trap is set. */
const CARD_SECONDS = 16;

/**
 * The trap walk's interface: a top bar (timer, slots, Ready), an instruction card that says in plain
 * words what to do, a picker of trap kinds along the bottom with what each one does, and a label
 * under the crosshair saying what a press would do right now.
 */
export class FortifyUI {
  readonly root: HTMLElement;
  private top: HTMLElement;
  private card: HTMLElement;
  private bar: HTMLElement;
  private hint: HTMLElement;
  private aimEl: HTMLElement;
  private toast: HTMLElement;
  private timerEl!: HTMLElement;
  private slotsEl!: HTMLElement;
  private slotsFill!: HTMLElement;
  private kindBtns = new Map<TrapKind, HTMLButtonElement>();
  private toastTimer = 0;
  private cardTimer = 0;
  private cardDismissed = false;
  private lastAim = '';
  private unsub: (() => void)[] = [];

  constructor(parent: HTMLElement, private fortify: Fortify, private cb: FortifyUICallbacks, readonly compact: boolean, private touch: boolean) {
    this.root = el('div', `bldui fortify ${compact ? 'compact' : ''}`);
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.top = el('div', 'bld-top');
    this.card = el('div', 'fort-card');
    this.bar = el('div', 'fort-bar');
    this.hint = el('div', 'bld-hint');
    this.aimEl = el('div', 'fort-aim idle');
    this.toast = el('div', 'bld-toast');
    this.toast.hidden = true;
    for (const panel of [this.top, this.card, this.bar]) panel.setAttribute('data-ui', '1');
    const cross = el('div', 'fort-cross');
    this.root.append(this.top, this.card, this.bar, this.hint, this.aimEl, this.toast, cross);
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
    // Top bar: pause (phones), timer, slots, Ready.
    this.top.innerHTML = '';
    if (this.compact) this.iconBtn(this.top, 'pause', ICON_PAUSE, '', () => this.cb.pause());
    this.timerEl = el('div', 'bld-timer', '∞');
    const slots = el('div', 'bld-roomswrap');
    this.slotsEl = el('div', 'bld-rooms', '0 / 0');
    const track = el('div', 'bld-bar-track');
    this.slotsFill = el('div', 'fill');
    track.appendChild(this.slotsFill);
    slots.append(el('span', 'lbl', t('fortifySlots')), this.slotsEl, track);
    const title = el('div', 'fort-title', esc(t('fortifyTitle')));
    const actions = el('div', 'bld-actions');
    actions.appendChild(btn(t('fortifyReady'), 'primary bld-ready', () => this.cb.ready()));
    this.top.append(this.timerEl, title, slots, actions);
    // Instruction card.
    this.card.innerHTML = `<div class="fc-title">${esc(t('fortifyTitle'))}</div><ol><li>${esc(t('fortifyStep1'))}</li><li>${esc(t(this.touch ? 'fortifyStep2Touch' : 'fortifyStep2Mouse'))}</li><li>${esc(t('fortifyStep3'))}</li></ol>`;
    const row = el('div', 'row');
    row.appendChild(btn(t('fortifyGotIt'), 'small', () => this.dismissCard()));
    this.card.appendChild(row);
    // Kind picker.
    this.bar.innerHTML = '';
    this.kindBtns.clear();
    for (const kind of TRAP_KINDS) {
      const b = this.iconBtn(this.bar, `kind ${kind}`, TRAP_ICON[kind], t(TRAP_NAME_KEY[kind]), () => {
        this.fortify.setKind(kind);
        this.refresh();
      });
      if (TRAP_COST[kind] > 1) b.appendChild(el('span', 'cost', `×${TRAP_COST[kind]}`));
      this.kindBtns.set(kind, b);
    }
    this.refresh();
  }

  show(): void {
    this.root.hidden = false;
    this.cardTimer = 0;
    this.cardDismissed = false;
    this.card.hidden = false;
    this.render();
    for (const off of this.unsub) off();
    this.unsub = [
      this.fortify.events.on('change', () => this.refresh()),
      this.fortify.events.on('placed', () => this.dismissCard()),
      this.fortify.events.on('invalid', ({ key }) => this.showToast(t(key))),
    ];
  }

  hide(): void {
    this.root.hidden = true;
    for (const off of this.unsub) off();
    this.unsub = [];
  }

  private dismissCard(): void {
    this.cardDismissed = true;
    this.card.hidden = true;
  }

  showToast(text: string): void {
    this.toast.textContent = text;
    this.toast.hidden = false;
    this.toastTimer = 2.2;
  }

  update(dt: number, timeLeft: number | null): void {
    const txt = timeLeft === null ? '∞' : formatTime(timeLeft);
    if (this.timerEl.textContent !== txt) this.timerEl.textContent = txt;
    this.timerEl.classList.toggle('urgent', timeLeft !== null && timeLeft < 15);
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.hidden = true;
    }
    if (!this.cardDismissed) {
      this.cardTimer += dt;
      if (this.cardTimer > CARD_SECONDS) this.dismissCard();
    }
    // What a press does right now.
    const a = this.fortify.aim;
    const name = t(TRAP_NAME_KEY[this.fortify.kind]);
    let cls = 'idle';
    let text: string;
    if (a.existing) {
      cls = 'rm';
      text = t('fortifyRemove', { name: t(TRAP_NAME_KEY[a.existing.kind]) });
    } else if (!a.cell) text = t('fortifyAimFloor');
    else if (a.reason) {
      cls = 'bad';
      text = t(a.reason);
    } else {
      cls = 'ok';
      text = t('fortifyPlaceHere', { name });
    }
    const key = `${cls}|${text}`;
    if (key !== this.lastAim) {
      this.lastAim = key;
      this.aimEl.className = `fort-aim ${cls}`;
      this.aimEl.textContent = text;
    }
  }

  refresh(): void {
    const f = this.fortify;
    const used = f.slots;
    this.slotsEl.textContent = `${used} / ${f.slotsTotal}`;
    this.slotsFill.style.width = `${Math.min(100, (100 * used) / f.slotsTotal)}%`;
    this.slotsFill.classList.toggle('full', used >= f.slotsTotal);
    for (const [kind, b] of this.kindBtns) {
      b.classList.toggle('active', f.kind === kind);
      b.classList.toggle('off', !f.affordable(kind));
    }
    this.hint.textContent = `${t(TRAP_NAME_KEY[f.kind])} · ${t(TRAP_DESC_KEY[f.kind])}`;
    this.lastAim = '';
  }
}
