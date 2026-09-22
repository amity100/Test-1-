import { FEEL } from '../config';
import { Input } from './input';
import { t } from '../ui/i18n';

/**
 * Phone / tablet controls. Left thumb: floating joystick. Right thumb: drag
 * to look (and to aim while the rift is armed). Rift aiming is a toggle on
 * touch - tap RIFT, drag to place, tap OPEN - so nothing needs two thumbs
 * held at once.
 */
export class TouchControls {
  el: HTMLDivElement;
  private stickBase: HTMLDivElement;
  private stickKnob: HTMLDivElement;
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private lookId: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private actionBtn: HTMLButtonElement;
  private aimPanel: HTMLDivElement;
  private riftBtn: HTMLButtonElement;
  private crouchBtn: HTMLButtonElement;
  private distTrack: HTMLDivElement;
  private distId: number | null = null;
  private distLast = 0;
  aiming = false;

  constructor(private input: Input, root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'touch';
    this.el.innerHTML = `
      <div class="t-zone t-left"></div>
      <div class="t-zone t-right"></div>
      <div class="t-stick"><div class="t-knob"></div></div>
      <button class="t-btn t-pause" data-a="pause">❚❚</button>
      <div class="t-cluster">
        <button class="t-btn t-action" data-a="interact"><span>F</span></button>
        <button class="t-btn t-rift" data-a="rift"><i class="rift-ico"></i><span>${t('rift')}</span></button>
        <button class="t-btn t-anchor" data-a="anchor"><span>⚓</span></button>
        <button class="t-btn t-jump" data-a="jump"><span>⤒</span></button>
        <button class="t-btn t-crouch" data-a="crouch"><span>⤓</span></button>
        <button class="t-btn t-close" data-a="close"><span>✕</span></button>
      </div>
      <div class="t-aim">
        <button class="t-btn t-open" data-a="open"><span>${t('open')}</span></button>
        <button class="t-btn t-cancel" data-a="cancel"><span>${t('cancel')}</span></button>
        <button class="t-btn t-rot" data-a="rotL"><span>⟲</span></button>
        <button class="t-btn t-rot" data-a="rotR"><span>⟳</span></button>
        <div class="t-dist"><div class="t-dist-label">${t('distance')}</div><div class="t-dist-track"><i></i></div></div>
      </div>`;
    root.appendChild(this.el);
    this.stickBase = this.el.querySelector('.t-stick')!;
    this.stickKnob = this.el.querySelector('.t-knob')!;
    this.actionBtn = this.el.querySelector('.t-action')!;
    this.aimPanel = this.el.querySelector('.t-aim')!;
    this.riftBtn = this.el.querySelector('.t-rift')!;
    this.crouchBtn = this.el.querySelector('.t-crouch')!;
    this.distTrack = this.el.querySelector('.t-dist-track')!;

    const left = this.el.querySelector('.t-left') as HTMLElement;
    const right = this.el.querySelector('.t-right') as HTMLElement;
    left.addEventListener('touchstart', (e) => this.stickStart(e), { passive: false });
    right.addEventListener('touchstart', (e) => this.lookStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.move(e), { passive: false });
    window.addEventListener('touchend', (e) => this.end(e));
    window.addEventListener('touchcancel', (e) => this.end(e));

    this.distTrack.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const tt = e.changedTouches[0];
      this.distId = tt.identifier;
      this.distLast = tt.clientY;
    }, { passive: false });

    let anchorTimer = 0;
    let anchorHeld = false;
    this.el.querySelectorAll<HTMLButtonElement>('.t-btn').forEach((b) => {
      const a = b.dataset.a!;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        input.lastDevice = 'touch';
        b.classList.add('down');
        navigator.vibrate?.(8);
        switch (a) {
          case 'rift':
            this.setAiming(!this.aiming);
            break;
          case 'open':
            input.tap('open');
            break;
          case 'cancel':
            this.setAiming(false);
            break;
          case 'anchor':
            anchorHeld = true;
            input.down('anchor');
            anchorTimer = window.setTimeout(() => navigator.vibrate?.(30), FEEL.anchorHoldTime * 1000);
            break;
          default:
            input.down(a as any);
        }
      }, { passive: false });
      b.addEventListener('touchend', (e) => {
        e.preventDefault();
        b.classList.remove('down');
        if (a === 'anchor' && anchorHeld) {
          anchorHeld = false;
          clearTimeout(anchorTimer);
          input.up('anchor');
        } else if (!['rift', 'open', 'cancel'].includes(a)) input.up(a as any);
      }, { passive: false });
    });
  }

  setAiming(on: boolean) {
    this.aiming = on;
    if (on) this.input.down('aim');
    else this.input.up('aim');
    this.el.classList.toggle('aiming', on);
    this.riftBtn.classList.toggle('on', on);
  }

  /** Game tells us when aim ended for other reasons (opened, cancelled). */
  syncAim(aiming: boolean) {
    if (!aiming && this.aiming) {
      this.aiming = false;
      this.el.classList.remove('aiming');
      this.riftBtn.classList.remove('on');
      this.input.up('aim');
    }
  }

  setAction(label: string | null) {
    this.actionBtn.classList.toggle('hidden', !label);
    if (label) this.actionBtn.querySelector('span')!.textContent = label;
  }

  setCrouched(c: boolean) {
    this.crouchBtn.classList.toggle('on', c);
  }

  private stickStart(e: TouchEvent) {
    e.preventDefault();
    this.input.lastDevice = 'touch';
    if (this.stickId !== null) return;
    const tt = e.changedTouches[0];
    this.stickId = tt.identifier;
    this.stickOrigin = { x: tt.clientX, y: tt.clientY };
    this.stickBase.style.left = `${tt.clientX}px`;
    this.stickBase.style.top = `${tt.clientY}px`;
    this.stickBase.classList.add('on');
    this.stickKnob.style.transform = 'translate(-50%,-50%)';
  }

  private lookStart(e: TouchEvent) {
    e.preventDefault();
    this.input.lastDevice = 'touch';
    if (this.lookId !== null) return;
    const tt = e.changedTouches[0];
    this.lookId = tt.identifier;
    this.lookLast = { x: tt.clientX, y: tt.clientY };
  }

  private move(e: TouchEvent) {
    for (const tt of Array.from(e.changedTouches)) {
      if (tt.identifier === this.stickId) {
        e.preventDefault();
        const R = 56;
        let dx = tt.clientX - this.stickOrigin.x, dy = tt.clientY - this.stickOrigin.y;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
        this.stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        const mag = Math.min(1, d / R);
        const nx = dx / R, ny = -dy / R;
        this.input.touchMove.x = nx;
        this.input.touchMove.y = ny;
        if (mag > 0.97 && d > R * 1.25) this.input.down('sprint');
        else this.input.up('sprint');
      } else if (tt.identifier === this.lookId) {
        e.preventDefault();
        const dx = tt.clientX - this.lookLast.x, dy = tt.clientY - this.lookLast.y;
        this.lookLast = { x: tt.clientX, y: tt.clientY };
        const s = FEEL.touchLookSensitivity * this.input.sensitivity * (this.aiming ? 0.6 : 1);
        this.input.lookX += dx * s;
        this.input.lookY += dy * s * (this.input.invertY ? -1 : 1);
      } else if (tt.identifier === this.distId) {
        e.preventDefault();
        const dy = this.distLast - tt.clientY;
        if (Math.abs(dy) > 14) {
          this.input.wheel += Math.sign(dy);
          this.distLast = tt.clientY;
          navigator.vibrate?.(4);
        }
      }
    }
  }

  private end(e: TouchEvent) {
    for (const tt of Array.from(e.changedTouches)) {
      if (tt.identifier === this.stickId) {
        this.stickId = null;
        this.input.touchMove.x = 0;
        this.input.touchMove.y = 0;
        this.input.up('sprint');
        this.stickBase.classList.remove('on');
      } else if (tt.identifier === this.lookId) {
        this.lookId = null;
      } else if (tt.identifier === this.distId) {
        this.distId = null;
      }
    }
  }

  show(v: boolean) {
    this.el.style.display = v ? '' : 'none';
  }
}
