import type { Input } from '../engine/input';
import type { Action } from '../core/contracts';
import { getDevice, onLangChange, t } from './i18n';

const ICONS: Record<string, string> = {
  // two rings, an arrow bouncing back
  mirror: '<svg viewBox="0 0 24 24"><ellipse cx="6" cy="12" rx="3" ry="7" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="18" cy="12" rx="3" ry="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 3 6 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // a floor ring and an arrow up
  geyser: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="19" rx="7" ry="2.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // an arrow falling off a ledge
  drop: '<svg viewBox="0 0 24 24"><path d="M3 8h8v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15 3c3 3 4 8 3 14M14.5 13.5L18 17l3-3.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const KEYS: Record<string, string> = { mirror: '1', geyser: '2', drop: '3' };
const PAD: Record<string, string> = { mirror: 'R3', geyser: '◀', drop: '▶' };
const ACTION: Record<string, Action> = { mirror: 'strike1', geyser: 'strike2', drop: 'strike3' };

/**
 * The three STRIKE buttons (tappable on touch, key hints on desktop / pad)
 * with cooldown sweeps, and a lock-on reticle over the target.
 */
export class StrikeBar {
  private el: HTMLDivElement;
  private reticle: HTMLDivElement;
  private btns: Record<string, HTMLButtonElement> = {};
  private last: Record<string, string> = {};
  private shown = true;

  constructor(root: HTMLElement, private input: Input) {
    this.el = document.createElement('div');
    this.el.className = 'strikes';
    for (const id of ['mirror', 'geyser', 'drop']) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `sk sk-${id}`;
      b.innerHTML = `<i class="sk-cd"></i>${ICONS[id]}<span class="sk-name"></span><kbd></kbd>`;
      const press = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.input.lastDevice = 'touch';
        this.input.tap(ACTION[id]);
        b.classList.add('down');
        setTimeout(() => b.classList.remove('down'), 120);
        navigator.vibrate?.(10);
      };
      b.addEventListener('touchstart', press, { passive: false });
      b.addEventListener('mousedown', (e) => {
        // desktop plays on keys; a click still works when the mouse is free
        if (document.pointerLockElement) return;
        press(e);
      });
      this.el.appendChild(b);
      this.btns[id] = b;
    }
    root.appendChild(this.el);
    this.reticle = document.createElement('div');
    this.reticle.className = 'sk-reticle';
    this.reticle.innerHTML = '<i></i><i></i><i></i><i></i>';
    root.appendChild(this.reticle);
    this.labels();
    onLangChange(() => this.labels());
  }

  private labels() {
    const dev = getDevice();
    for (const id in this.btns) {
      const b = this.btns[id];
      (b.querySelector('.sk-name') as HTMLElement).textContent = t(`strike.${id}`);
      (b.querySelector('kbd') as HTMLElement).textContent = dev === 'pad' ? PAD[id] : KEYS[id];
    }
    this.el.classList.toggle('touch', dev === 'touch');
  }

  show(v: boolean) {
    if (v === this.shown) return;
    this.shown = v;
    this.el.style.display = v ? '' : 'none';
    if (!v) this.reticle.classList.remove('on');
  }

  /**
   * cooling: 0 ready .. 1 just used, per strike. target: screen point of the
   * lock-on (null = none in reach).
   */
  update(cooling: Record<string, number>, target: { x: number; y: number } | null) {
    const dev = getDevice();
    if (this.el.classList.contains('touch') !== (dev === 'touch')) this.labels();
    for (const id in this.btns) {
      const c = Math.max(0, Math.min(1, cooling[id] ?? 0));
      const key = `${c > 0 ? Math.ceil(c * 20) : 0}|${target ? 1 : 0}`;
      if (key === this.last[id]) continue;
      this.last[id] = key;
      const b = this.btns[id];
      b.style.setProperty('--cd', String(c));
      b.classList.toggle('ready', c <= 0 && !!target);
      b.classList.toggle('cooling', c > 0);
      if (c <= 0 && this.last[id + ':was'] === '1') {
        b.classList.remove('pop');
        void b.offsetWidth;
        b.classList.add('pop');
      }
      this.last[id + ':was'] = c > 0 ? '1' : '0';
    }
    const r = this.reticle;
    if (target && this.shown) {
      r.classList.add('on');
      r.style.transform = `translate3d(${target.x.toFixed(1)}px, ${target.y.toFixed(1)}px, 0)`;
    } else r.classList.remove('on');
  }
}
