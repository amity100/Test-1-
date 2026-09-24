import type { Input } from '../engine/input';
import type { Action } from '../core/contracts';
import { getDevice, onLangChange, t } from './i18n';

const ICONS: Record<string, string> = {
  // two rings, a shot bouncing back
  reflect: '<svg viewBox="0 0 24 24"><ellipse cx="6" cy="12" rx="3" ry="7" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="18" cy="12" rx="3" ry="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 3 6 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // a ring above, a ring below, and the fall between them going round
  loop: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="4" rx="6" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="12" cy="20" rx="6" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v9M9 13l3 3 3-3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // two arrows passing each other
  swap: '<svg viewBox="0 0 24 24"><path d="M4 8h14M14.5 4.5L18 8l-3.5 3.5M20 16H6M9.5 12.5L6 16l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // a ring and a streak out of it
  dash: '<svg viewBox="0 0 24 24"><ellipse cx="5" cy="12" rx="2.6" ry="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 12h11M16 8l4 4-4 4M9 8h4M9 16h4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const IDS = ['reflect', 'loop', 'swap', 'dash'];
const KEYS: Record<string, string> = { reflect: 'RMB', loop: 'Q', swap: 'E', dash: 'R' };
const PAD: Record<string, string> = { reflect: 'LT', loop: 'Y', swap: '◀', dash: '▶' };
const ACTION: Record<string, Action> = { reflect: 'strike1', loop: 'strike2', swap: 'strike3', dash: 'strike4' };

/**
 * The four STRIKE buttons (touch: held while touched, so LOOP's second press
 * can be held to aim; desktop / pad: key hints) with cooldown sweeps, the
 * rift charge pips, and a lock-on reticle over the target.
 */
export class StrikeBar {
  private el: HTMLDivElement;
  private reticle: HTMLDivElement;
  private btns: Record<string, HTMLButtonElement> = {};
  private last: Record<string, string> = {};
  private shown = true;
  private pips: HTMLDivElement;
  private pipKey = '';
  /** Touch identifier holding each button. */
  private finger: Record<string, number | null> = {};

  constructor(root: HTMLElement, private input: Input) {
    this.el = document.createElement('div');
    this.el.className = 'strikes';
    for (const id of IDS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `sk sk-${id}`;
      b.innerHTML = `<i class="sk-cd"></i>${ICONS[id]}<span class="sk-name"></span><kbd></kbd>`;
      const down = () => {
        this.input.down(ACTION[id]);
        b.classList.add('down');
        navigator.vibrate?.(10);
      };
      const up = () => {
        this.input.up(ACTION[id]);
        b.classList.remove('down');
      };
      b.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.input.lastDevice = 'touch';
          if (this.finger[id] != null) return;
          this.finger[id] = e.changedTouches[0]?.identifier ?? 0;
          down();
        },
        { passive: false },
      );
      const end = (e: TouchEvent) => {
        const f = this.finger[id];
        if (f == null) return;
        for (const tt of Array.from(e.changedTouches)) {
          if (tt.identifier !== f) continue;
          e.preventDefault();
          this.finger[id] = null;
          up();
        }
      };
      window.addEventListener('touchend', end, { passive: false });
      window.addEventListener('touchcancel', end, { passive: false });
      b.addEventListener('mousedown', (e) => {
        // desktop plays on keys; a click still works when the mouse is free
        if (document.pointerLockElement) return;
        e.preventDefault();
        e.stopPropagation();
        down();
        const release = () => {
          up();
          window.removeEventListener('mouseup', release);
        };
        window.addEventListener('mouseup', release);
      });
      this.el.appendChild(b);
      this.btns[id] = b;
      this.finger[id] = null;
    }
    this.pips = document.createElement('div');
    this.pips.className = 'sk-pips';
    this.el.appendChild(this.pips);
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
    this.last = {};
    for (const id in this.btns) {
      const b = this.btns[id];
      (b.querySelector('.sk-name') as HTMLElement).textContent = t(`strike.${id}`);
      (b.querySelector('kbd') as HTMLElement).textContent = dev === 'pad' ? PAD[id] : KEYS[id];
    }
    this.el.classList.toggle('sk-touch', dev === 'touch');
  }

  show(v: boolean) {
    if (v === this.shown) return;
    this.shown = v;
    this.el.style.display = v ? '' : 'none';
    if (!v) {
      this.reticle.classList.remove('on');
      this.releaseAll();
    }
  }

  /** Let go of any strike held by touch (pause, menus). */
  releaseAll() {
    for (const id of IDS) {
      if (this.finger[id] == null) continue;
      this.finger[id] = null;
      this.input.up(ACTION[id]);
      this.btns[id].classList.remove('down');
    }
  }

  /** While the PORTAL is in hand the strikes step back (and don't take touches). */
  setDimmed(v: boolean) {
    this.el.classList.toggle('dim', v);
  }

  /**
   * cooling: 0 ready .. 1 just used, per strike. target: screen point of the
   * lock-on (null = none in reach). armed: a strike whose key now does its
   * second part (LOOP: geyser / cannon).
   */
  update(cooling: Record<string, number>, target: { x: number; y: number } | null, charges = 3, max = 3, armed: Record<string, boolean> = {}) {
    const pk = `${Math.floor(charges)}|${Math.round((charges % 1) * 10)}|${max}`;
    if (pk !== this.pipKey) {
      const was = parseInt(this.pipKey.split('|')[0] || String(max), 10);
      this.pipKey = pk;
      let html = '';
      for (let i = 0; i < max; i++) {
        const f = Math.max(0, Math.min(1, charges - i));
        html += `<i class="${f >= 1 ? 'full' : ''}" style="--f:${f.toFixed(2)}"></i>`;
      }
      this.pips.innerHTML = html;
      if (Math.floor(charges) > was) {
        this.pips.classList.remove('gain');
        void this.pips.offsetWidth;
        this.pips.classList.add('gain');
      }
    }
    const dev = getDevice();
    if (this.el.classList.contains('sk-touch') !== (dev === 'touch')) this.labels();
    for (const id in this.btns) {
      const c = Math.max(0, Math.min(1, cooling[id] ?? 0));
      const arm = !!armed[id];
      const key = `${c > 0 ? Math.ceil(c * 20) : 0}|${target ? 1 : 0}|${arm ? 1 : 0}`;
      if (key === this.last[id]) continue;
      this.last[id] = key;
      const b = this.btns[id];
      b.style.setProperty('--cd', String(c));
      b.classList.toggle('ready', c <= 0 && (!!target || id === 'dash'));
      b.classList.toggle('cooling', c > 0);
      b.classList.toggle('armed', arm);
      (b.querySelector('.sk-name') as HTMLElement).textContent = t(arm ? `strike.${id}.again` : `strike.${id}`);
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
