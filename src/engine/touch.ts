import type { Action } from '../core/contracts';
import { Input, LOOK } from './input';
import { onLangChange, t } from '../ui/i18n';

/**
 * Phone / tablet controls (landscape). Every finger is tracked by its touch
 * identifier, so the stick, a look drag and a button all work at once.
 *
 * - Left side: floating stick (appears under the thumb; a full push sprints).
 * - Right side: drag to look.
 * - PORTAL: touch = the entrance ('portal' down); moving that finger aims the
 *   exit (look); lift = the exit ('portal' up). A quick tap lets the game
 *   place the exit. Slide onto the CANCEL zone to let go without an exit.
 *   Its caption says what a press does now (GRAB, LOAD, ...).
 * - JUMP / SHOVE / ✕ / ACTION / CROUCH: held while touched (the game reads
 *   wasPressed / isHeld). Dragging off a button also looks.
 * - ⇄ FLIP (only while aiming, left thumb), 🎬 (when offered), pause: taps.
 * - The STRIKES are their own bar (ui/strikebar).
 */

type Finger =
  | { kind: 'stick'; ox: number; oy: number; sprint: boolean }
  | { kind: 'look'; x: number; y: number }
  | { kind: 'portal'; x: number; y: number; t0: number; cancel: boolean }
  | { kind: 'btn'; el: HTMLElement; action: Action | null; x: number; y: number; sx: number; sy: number; drag: boolean };

const STICK_R = 58;
const AIM_LOOK = 0.55;

const SVG = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const ICON = {
  rift: SVG(
    '<ellipse cx="12" cy="12" rx="6.3" ry="9.6" fill="none" stroke="currentColor" stroke-width="2.4"/><ellipse cx="12" cy="12" rx="2.8" ry="5.4" fill="currentColor" opacity=".45"/>',
  ),
  jump: SVG('<path d="M5.5 12.5L12 6l6.5 6.5M5.5 19L12 12.5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  shove: SVG(
    '<path d="M9.5 12h11M16.2 7.6L20.6 12l-4.4 4.4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 7.5h4.5M2 12h4.5M3.5 16.5h4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  ),
  close: SVG('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>'),
  flip: SVG(
    '<path d="M4 8.5h15M15.5 5l3.5 3.5-3.5 3.5M20 15.5H5M8.5 12L5 15.5 8.5 19" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  crouch: SVG('<path d="M6 8.5l6 6 6-6M5 19.5h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  pause: SVG('<path d="M8.5 5.5v13M15.5 5.5v13" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'),
  clip: SVG(
    '<path fill="currentColor" d="M3 10h18v9.5c0 .8-.7 1.5-1.5 1.5h-15c-.8 0-1.5-.7-1.5-1.5z"/><path fill="currentColor" d="M2.6 8.6l-.5-2.3c-.2-.8.3-1.6 1.1-1.8l14.6-3.1c.8-.2 1.6.3 1.8 1.1l.5 2.3z"/>',
  ),
  action: SVG('<path d="M12 3.5l2.2 6.3 6.3 2.2-6.3 2.2L12 20.5l-2.2-6.3L3.5 12l6.3-2.2z" fill="currentColor"/>'),
};

/** Buttons whose finger may keep dragging to look. */
const DRAG_LOOK = new Set<string>(['jump', 'shove', 'close', 'action', 'crouch']);

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}

export class TouchControls {
  readonly el: HTMLDivElement;
  /** The game says we are aiming (visual sync). */
  aiming = false;
  /** The game says the PORTAL is in hand (a press it took and hasn't finished). */
  private portalHolding = false;
  private fingers = new Map<number, Finger>();
  private stickEl: HTMLDivElement;
  private knobEl: HTMLDivElement;
  private cancelEl: HTMLDivElement;
  private actionBtn: HTMLButtonElement;
  private actionLbl: HTMLElement;
  private portalCap: HTMLElement;
  private portalBtn: HTMLButtonElement;
  private crouchBtn: HTMLButtonElement;
  private clipBtn: HTMLButtonElement;
  private shown = true;
  private actionLabel: string | null = null;
  private portalLabel: string | null = null;
  private cancelRect: DOMRect | null = null;

  constructor(private input: Input, root: HTMLElement) {
    const el = document.createElement('div');
    el.className = 'touch';
    this.el = el;
    el.innerHTML = `
      <div class="t-zone t-left" data-t="left"></div>
      <div class="t-zone t-right" data-t="right"></div>
      <div class="t-stick"><i class="t-ring"></i><div class="t-knob"></div></div>
      <button class="t-btn t-pause" data-t="pause" type="button">${ICON.pause}</button>
      <button class="t-btn t-flip" data-t="flip" type="button">${ICON.flip}<span class="t-lbl" data-k="touch.flip"></span></button>
      <div class="t-cancel"><span>${ICON.close}</span><b data-k="touch.cancel"></b></div>
      <div class="t-cluster">
        <button class="t-btn t-action hidden" data-t="action" type="button">${ICON.action}<span class="t-lbl t-act-lbl"></span></button>
        <button class="t-btn t-rift" data-t="portal" type="button">${ICON.rift}<span class="t-lbl" data-k="touch.portal"></span><span class="t-cap"></span></button>
        <button class="t-btn t-jump" data-t="jump" type="button">${ICON.jump}<span class="t-lbl" data-k="touch.jump"></span></button>
        <button class="t-btn t-crouch" data-t="crouch" type="button">${ICON.crouch}</button>
        <button class="t-btn t-shove" data-t="shove" type="button">${ICON.shove}<span class="t-lbl" data-k="touch.shove"></span></button>
        <button class="t-btn t-close" data-t="close" type="button">${ICON.close}</button>
        <button class="t-btn t-clip hidden" data-t="clip" type="button">${ICON.clip}</button>
      </div>`;
    root.appendChild(el);
    const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
    this.stickEl = q('.t-stick');
    this.knobEl = q('.t-knob');
    this.cancelEl = q('.t-cancel');
    this.actionBtn = q('.t-action');
    this.actionLbl = q('.t-act-lbl');
    this.portalCap = q('.t-cap');
    this.portalBtn = q('.t-rift');
    this.crouchBtn = q('.t-crouch');
    this.clipBtn = q('.t-clip');
    this.labels();
    onLangChange(() => this.labels());

    el.addEventListener('touchstart', (e) => this.onStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.onMove(e), { passive: false });
    window.addEventListener('touchend', (e) => this.onEnd(e), { passive: false });
    window.addEventListener('touchcancel', (e) => this.onEnd(e), { passive: false });
    // keep the page from treating touches on the controls as clicks / scrolls
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private labels() {
    this.el.querySelectorAll<HTMLElement>('[data-k]').forEach((n) => (n.textContent = t(n.dataset.k!)));
    this.portalBtn.classList.toggle('has-cap', !!this.portalLabel);
  }

  // -------------------------------------------------------------------------
  // Public
  // -------------------------------------------------------------------------

  show(v: boolean) {
    if (v === this.shown) return;
    this.shown = v;
    this.el.style.display = v ? '' : 'none';
    if (!v) this.releaseAll();
  }

  /** Sync from the game. If the game isn't aiming while PORTAL is still held (refused, done), that finger just looks. */
  setAiming(on: boolean) {
    if (on !== this.aiming) {
      this.aiming = on;
      this.syncAimClass();
    }
    if (!on && !this.portalHolding) {
      const now = performance.now();
      for (const [id, f] of this.fingers) {
        if (f.kind === 'portal' && now - f.t0 > 400) {
          this.fingers.set(id, { kind: 'look', x: f.x, y: f.y });
          this.input.up('portal');
          this.portalBtn.classList.remove('down');
          this.el.classList.remove('rift-held');
          this.cancelEl.classList.remove('hot');
          this.syncAimClass();
        }
      }
    }
  }

  /** Sync from the game: the PORTAL press is still in hand (the finger keeps it until it lifts). */
  setPortalHeld(on: boolean) {
    this.portalHolding = on;
  }

  /** ⇄ FLIP shows while an exit you'll walk out of is being aimed (a door, a fall, a hole). */
  setFlip(on: boolean) {
    this.el.classList.toggle('flip-on', on);
  }

  /** @deprecated old name */
  syncAim(aiming: boolean) {
    this.setAiming(aiming);
  }

  setAction(label: string | null) {
    if (label === this.actionLabel) return;
    this.actionLabel = label;
    this.actionBtn.classList.toggle('hidden', !label);
    if (label) {
      this.actionLbl.textContent = label;
      this.actionBtn.classList.toggle('long', label.length > 7);
      this.actionBtn.classList.remove('pop');
      void this.actionBtn.offsetWidth;
      this.actionBtn.classList.add('pop');
    } else {
      // a finger still on it releases the action
      for (const [id, f] of this.fingers) if (f.kind === 'btn' && f.el === this.actionBtn) this.endFinger(id, f);
    }
  }

  /** Small caption on PORTAL: what a press does now (GRAB / LOAD / DOOR / ...). `mode` only styles it (AIR pulses). */
  setPortalLabel(label: string | null, mode?: string | null) {
    const key = label ? `${label}|${mode ?? ''}` : null;
    if (key === this.portalLabel) return;
    this.portalLabel = key;
    this.portalCap.textContent = label ?? '';
    this.portalBtn.classList.toggle('has-cap', !!label);
    this.portalBtn.classList.toggle('urgent', mode === 'air');
    this.portalBtn.classList.toggle('grab', mode === 'grab' || mode === 'load' || mode === 'hijack');
  }

  offerClip(v: boolean) {
    const was = !this.clipBtn.classList.contains('hidden');
    if (v === was) return;
    this.clipBtn.classList.toggle('hidden', !v);
    if (v) vibrate(12);
  }

  setCrouched(v: boolean) {
    this.crouchBtn.classList.toggle('on', v);
  }

  /** Let go of everything (pause, menus, respawn). */
  releaseAll() {
    for (const [id, f] of [...this.fingers]) this.endFinger(id, f, true);
    this.fingers.clear();
    this.input.touchMove.x = this.input.touchMove.y = 0;
    this.input.up('sprint');
    this.stickEl.classList.remove('on', 'sprint');
  }

  // -------------------------------------------------------------------------
  // Touch handling
  // -------------------------------------------------------------------------

  private syncAimClass() {
    let riftDown = false;
    for (const f of this.fingers.values()) if (f.kind === 'portal') riftDown = true;
    this.el.classList.toggle('aiming', this.aiming || riftDown);
  }

  private onStart(e: TouchEvent) {
    let handled = false;
    for (const tt of Array.from(e.changedTouches)) {
      const target = tt.target as Element | null;
      const hit = target && typeof target.closest === 'function' ? (target.closest('[data-t]') as HTMLElement | null) : null;
      if (!hit || !this.el.contains(hit)) continue;
      handled = true;
      this.input.lastDevice = 'touch';
      const role = hit.dataset.t!;
      const x = tt.clientX,
        y = tt.clientY;
      switch (role) {
        case 'left': {
          if ([...this.fingers.values()].some((f) => f.kind === 'stick')) {
            this.fingers.set(tt.identifier, { kind: 'look', x, y });
            break;
          }
          const ox = Math.max(STICK_R + 10, x),
            oy = Math.min(window.innerHeight - STICK_R - 10, Math.max(STICK_R + 10, y));
          this.fingers.set(tt.identifier, { kind: 'stick', ox, oy, sprint: false });
          this.stickEl.style.transform = `translate3d(${ox}px,${oy}px,0)`;
          this.knobEl.style.transform = 'translate3d(0,0,0)';
          this.stickEl.classList.add('on');
          this.moveStick(this.fingers.get(tt.identifier) as Extract<Finger, { kind: 'stick' }>, x, y);
          break;
        }
        case 'right':
          this.fingers.set(tt.identifier, { kind: 'look', x, y });
          break;
        case 'portal': {
          if ([...this.fingers.values()].some((f) => f.kind === 'portal')) break;
          this.fingers.set(tt.identifier, { kind: 'portal', x, y, t0: performance.now(), cancel: false });
          this.input.down('portal');
          hit.classList.add('down');
          this.el.classList.add('rift-held');
          this.cancelRect = null;
          this.syncAimClass();
          vibrate(10);
          break;
        }
        case 'pause':
          this.input.tap('pause');
          this.flash(hit);
          vibrate(8);
          break;
        case 'flip':
          this.input.tap('flip');
          this.flash(hit);
          vibrate(8);
          break;
        case 'clip':
          this.input.tap('clip');
          this.flash(hit);
          vibrate(12);
          break;
        default: {
          const action = role as Action;
          this.fingers.set(tt.identifier, { kind: 'btn', el: hit, action, x, y, sx: x, sy: y, drag: false });
          this.input.down(action);
          hit.classList.add('down');
          vibrate(8);
        }
      }
    }
    if (handled && e.cancelable) e.preventDefault();
  }

  private flash(el: HTMLElement) {
    el.classList.add('down');
    setTimeout(() => el.classList.remove('down'), 110);
  }

  private look(dx: number, dy: number, scale: number) {
    const s = LOOK.touch * this.input.sensitivity * scale;
    this.input.lookX += dx * s;
    this.input.lookY += dy * s * (this.input.invertY ? -1 : 1);
  }

  private moveStick(f: Extract<Finger, { kind: 'stick' }>, x: number, y: number) {
    let dx = x - f.ox,
      dy = y - f.oy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) {
      dx = (dx / d) * STICK_R;
      dy = (dy / d) * STICK_R;
    }
    this.knobEl.style.transform = `translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0)`;
    this.input.touchMove.x = dx / STICK_R;
    this.input.touchMove.y = -dy / STICK_R;
    // full push (to the rim and a bit beyond) sprints; hysteresis on release
    const sprint = f.sprint ? d > STICK_R * 0.85 : d > STICK_R * 1.08;
    if (sprint !== f.sprint) {
      f.sprint = sprint;
      if (sprint) {
        this.input.down('sprint');
        vibrate(6);
      } else this.input.up('sprint');
      this.stickEl.classList.toggle('sprint', sprint);
    }
  }

  private onMove(e: TouchEvent) {
    let handled = false;
    for (const tt of Array.from(e.changedTouches)) {
      const f = this.fingers.get(tt.identifier);
      if (!f) continue;
      handled = true;
      const x = tt.clientX,
        y = tt.clientY;
      switch (f.kind) {
        case 'stick':
          this.moveStick(f, x, y);
          break;
        case 'look':
          this.look(x - f.x, y - f.y, this.aiming ? AIM_LOOK : 1);
          f.x = x;
          f.y = y;
          break;
        case 'portal': {
          if (!this.cancelRect) this.cancelRect = this.cancelEl.getBoundingClientRect();
          const r = this.cancelRect,
            pad = 14;
          const over = r.width > 0 && x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
          if (over !== f.cancel) {
            f.cancel = over;
            this.cancelEl.classList.toggle('hot', over);
            if (over) vibrate(14);
          }
          if (!over) this.look(x - f.x, y - f.y, AIM_LOOK);
          f.x = x;
          f.y = y;
          break;
        }
        case 'btn': {
          if (!f.drag && Math.hypot(x - f.sx, y - f.sy) > 12) f.drag = DRAG_LOOK.has(f.action ?? '');
          if (f.drag) this.look(x - f.x, y - f.y, this.aiming ? AIM_LOOK : 1);
          f.x = x;
          f.y = y;
          break;
        }
      }
    }
    if (handled && e.cancelable) e.preventDefault();
  }

  private onEnd(e: TouchEvent) {
    for (const tt of Array.from(e.changedTouches)) {
      const f = this.fingers.get(tt.identifier);
      if (!f) continue;
      this.endFinger(tt.identifier, f);
      if (e.cancelable) e.preventDefault();
    }
  }

  private endFinger(id: number, f: Finger, silent = false) {
    this.fingers.delete(id);
    switch (f.kind) {
      case 'stick':
        this.input.touchMove.x = this.input.touchMove.y = 0;
        if (f.sprint) this.input.up('sprint');
        this.stickEl.classList.remove('on', 'sprint');
        break;
      case 'portal':
        // slid onto CANCEL: let go without an exit ('close' is read before the release)
        if (f.cancel) {
          this.input.tap('close');
          vibrate(20);
        }
        this.input.up('portal');
        this.portalBtn.classList.remove('down');
        this.el.classList.remove('rift-held');
        this.cancelEl.classList.remove('hot');
        this.syncAimClass();
        break;
      case 'btn':
        f.el.classList.remove('down');
        if (f.action) this.input.up(f.action);
        break;
    }
  }
}
