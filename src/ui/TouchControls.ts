import { el } from './dom';
import type { Input } from '../core/Input';
import { t } from '../core/i18n';

export type TouchMode = 'none' | 'battle' | 'build';

export interface TouchCallbacks {
  pause(): void;
  weaponSlot(i: number): void;
}

interface Pointer {
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  startTime: number;
  moved: number;
  role: 'move' | 'look' | 'orbit' | 'pinch';
  longTimer: number;
  longFired: boolean;
  /** Event timestamp of the pointerdown (hardware time, unaffected by a stalled frame). */
  downStamp: number;
}

const svg = (body: string, vb = '0 0 24 24'): string => `<svg viewBox="${vb}" aria-hidden="true">${body}</svg>`;
const LONG_PRESS_MS = 480;
/** Short haptic tick where supported (Android Chrome); silently ignored elsewhere. */
export function vibrate(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}
/** Crisp vector glyphs for the on-screen buttons (stroke inherits the button colour). */
const ICON = {
  fire: svg('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>'),
  jump: svg('<path d="M12 20V5"/><path d="M6 11l6-6 6 6"/><path d="M5 21h14"/>'),
  crouch: svg('<circle cx="12" cy="5" r="2" fill="currentColor" stroke="none"/><path d="M8 12l4-3 4 3v4h-3v4"/><path d="M5 21h6"/>'),
  ads: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
  reload: svg('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 3.5V9h-5.5"/>'),
  grenade: svg('<circle cx="12" cy="14" r="6.5"/><rect x="9.5" y="2.5" width="5" height="4.5" rx="1"/><path d="M14.5 4h4"/><path d="M9.5 13.5a2.5 2.5 0 0 1 2.5-2.5"/>'),
  grapple: svg('<path d="M12 2v9"/><path d="M12 11c0 4.5-3.2 6.5-6 6.5M12 11c0 4.5 3.2 6.5 6 6.5"/><path d="M6 17.5L4 21M18 17.5L20 21"/><circle cx="12" cy="4.5" r="2"/>'),
  pause: svg('<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>'),
};

/**
 * On-screen controls for phones and tablets, laid out the way popular mobile shooters do it:
 * a floating stick on the left, drag-to-aim on the right, a large fire button under the right
 * thumb with jump/crouch in the corner, and the rarer actions tucked along the edge.
 */
export class TouchControls {
  readonly root: HTMLElement;
  private mode: TouchMode = 'none';
  private moveZone: HTMLElement;
  private lookZone: HTMLElement;
  private stickBase: HTMLElement;
  private stickKnob: HTMLElement;
  private battleButtons: HTMLElement;
  private pointers = new Map<number, Pointer>();
  private movePointer: Pointer | null = null;
  private pinchDist = 0;
  private pinchMid = { x: 0, y: 0 };
  private crouchOn = false;
  private adsOn = false;
  private fireBtn!: HTMLElement;
  private fireBadge!: HTMLElement;
  private crouchBtn!: HTMLElement;
  private adsBtn!: HTMLElement;
  private repeatTimer = 0;

  constructor(parent: HTMLElement, private input: Input, private cb: TouchCallbacks) {
    this.root = el('div', 'touch-ui');
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.moveZone = el('div', 'tz tz-move');
    this.moveZone.setAttribute('data-game', '1');
    this.lookZone = el('div', 'tz tz-look');
    this.lookZone.setAttribute('data-game', '1');
    this.stickBase = el('div', 'stick-base');
    this.stickKnob = el('div', 'stick-knob');
    this.stickBase.appendChild(this.stickKnob);
    this.stickBase.hidden = true;
    this.battleButtons = el('div', 'tb-group tb-battle');
    this.battleButtons.setAttribute('data-ui', '1');
    this.root.append(this.moveZone, this.lookZone, this.stickBase, this.battleButtons);
    this.buildBattleButtons();
    for (const zone of [this.moveZone, this.lookZone]) {
      zone.addEventListener('pointerdown', this.onPointerDown);
      zone.addEventListener('pointermove', this.onPointerMove);
      zone.addEventListener('pointerup', this.onPointerUp);
      zone.addEventListener('pointercancel', this.onPointerUp);
      zone.addEventListener('lostpointercapture', this.onPointerUp);
    }
  }

  /** Size multiplier and idle opacity of the on-screen controls (from settings). */
  applyStyle(scale: number, opacity: number): void {
    this.root.style.setProperty('--ts', String(scale));
    this.root.style.setProperty('--to', String(opacity));
  }

  /** Shows the AUTO badge on the fire button when automatic fire is active. */
  setAutoFire(on: boolean): void {
    this.fireBadge.hidden = !on;
  }

  private button(parent: HTMLElement, cls: string, icon: string, opts: { down?: () => void; up?: () => void; tap?: () => void; repeat?: () => void }): HTMLElement {
    const b = el('div', `tb ${cls}`, icon);
    b.setAttribute('data-ui', '1');
    let repeatHandle = 0;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      b.classList.add('down');
      opts.down?.();
      if (opts.repeat) {
        // Hold to repeat (after a short delay), e.g. layer up/down.
        repeatHandle = window.setTimeout(() => {
          repeatHandle = window.setInterval(() => opts.repeat?.(), 160);
        }, 380);
      }
    });
    const release = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      if (repeatHandle) {
        window.clearTimeout(repeatHandle);
        window.clearInterval(repeatHandle);
        repeatHandle = 0;
      }
      if (!b.classList.contains('down')) return;
      b.classList.remove('down');
      opts.up?.();
      // The browser still dispatches a click after this pointerup; defer UI-changing taps so that click
      // lands on this button and not on whatever the tap just revealed underneath.
      if (opts.tap) window.setTimeout(opts.tap, 0);
    };
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    parent.appendChild(b);
    return b;
  }

  private buildBattleButtons(): void {
    const v = this.input.virtual;
    const g = this.battleButtons;
    const fireDown = (): void => {
      v.fire = true;
      v.firePressed = true;
    };
    const fireUp = (): void => {
      v.fire = false;
      v.fireReleased = true;
    };
    this.fireBtn = this.button(g, 'fire', ICON.fire, { down: fireDown, up: fireUp });
    this.fireBadge = el('span', 'badge', 'AUTO');
    this.fireBadge.hidden = true;
    this.fireBtn.appendChild(this.fireBadge);
    this.button(g, 'fire fire-left', ICON.fire, { down: fireDown, up: fireUp });
    this.button(g, 'jump', ICON.jump, {
      down: () => {
        v.jump = true;
        v.jumpHeld = true;
      },
      up: () => {
        v.jumpHeld = false;
      },
    });
    this.crouchBtn = this.button(g, 'crouch', ICON.crouch, {
      tap: () => {
        this.crouchOn = !this.crouchOn;
        v.crouch = this.crouchOn;
        this.crouchBtn.classList.toggle('on', this.crouchOn);
      },
    });
    this.adsBtn = this.button(g, 'ads', ICON.ads, {
      tap: () => {
        this.adsOn = !this.adsOn;
        v.ads = this.adsOn;
        this.adsBtn.classList.toggle('on', this.adsOn);
      },
    });
    this.button(g, 'reload', ICON.reload, { tap: () => (v.reload = true) });
    this.button(g, 'grenade', ICON.grenade, { tap: () => (v.grenade = true) });
    for (let i = 0; i < 2; i++) {
      const b = this.button(g, `gadget g${i}`, ICON.grapple, {
        down: () => {
          v.gadget[i] = true;
          v.gadgetHeld[i] = true;
        },
        up: () => {
          v.gadgetHeld[i] = false;
          v.gadgetReleased[i] = true;
        },
      });
      const count = el('span', 'count', '');
      count.hidden = true;
      b.appendChild(count);
      this.gadgetBtns.push(b);
      this.gadgetCounts.push(count);
    }
    this.button(g, 'pause', ICON.pause, { tap: () => this.cb.pause() });
  }
  private gadgetBtns: HTMLElement[] = [];
  private gadgetCounts: HTMLElement[] = [];

  /** Shows the equipped kit on the two gadget buttons. */
  setGadgetIcons(icons: string[]): void {
    for (let i = 0; i < this.gadgetBtns.length; i++) {
      const b = this.gadgetBtns[i];
      const icon = icons[i] ?? '';
      if (b.dataset.icon === icon) continue;
      b.dataset.icon = icon;
      const count = this.gadgetCounts[i];
      const badge = b.querySelector('.gbadge');
      b.innerHTML = icon;
      b.appendChild(count);
      if (badge) b.appendChild(badge);
      b.hidden = !icon;
    }
  }

  /** Big pulsing label on a gadget button (e.g. UP while underground); null hides it. */
  setGadgetBadge(i: number, text: string | null): void {
    const b = this.gadgetBtns[i];
    if (!b) return;
    let badge = b.querySelector('.gbadge') as HTMLElement | null;
    if (!text) {
      if (badge) badge.hidden = true;
      return;
    }
    if (!badge) {
      badge = el('span', 'gbadge');
      b.appendChild(badge);
    }
    badge.hidden = false;
    if (badge.textContent !== text) badge.textContent = text;
  }

  /** Reflects charges and cooldown on a gadget button (charges < 0 = unlimited). */
  setGadgetState(i: number, ready: boolean, charges: number): void {
    const b = this.gadgetBtns[i];
    if (!b) return;
    b.classList.toggle('off', !ready);
    const c = this.gadgetCounts[i];
    if (charges < 0) c.hidden = true;
    else {
      c.hidden = false;
      const txt = String(charges);
      if (c.textContent !== txt) c.textContent = txt;
    }
  }

  setMode(mode: TouchMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.root.hidden = mode === 'none';
    this.battleButtons.hidden = mode !== 'battle';
    // Build mode uses the whole screen as one orbit-and-tap surface.
    this.root.classList.toggle('build', mode === 'build');
    this.pointers.clear();
    this.movePointer = null;
    this.stickBase.hidden = true;
    const v = this.input.virtual;
    v.moveX = 0;
    v.moveY = 0;
    v.fire = false;
    v.jumpHeld = false;
    v.heightDir = 0;
    v.primaryHeld = false;
    v.secondaryHeld = false;
    this.crouchOn = false;
    this.adsOn = false;
    v.crouch = false;
    v.ads = false;
    this.crouchBtn.classList.remove('on');
    this.adsBtn.classList.remove('on');
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && this.mode !== 'build') return;
    e.preventDefault();
    const zone = e.currentTarget as HTMLElement;
    zone.setPointerCapture?.(e.pointerId);
    const isMove = zone === this.moveZone && this.mode === 'battle';
    const buildLike = this.mode === 'build';
    let role: Pointer['role'] = isMove ? 'move' : this.mode === 'build' ? 'orbit' : 'look';
    // Second finger in build mode starts a pinch.
    if (buildLike && this.pointers.size === 1) {
      role = 'pinch';
      const other = this.pointers.values().next().value as Pointer;
      other.role = 'pinch';
      if (other.longTimer) window.clearTimeout(other.longTimer);
      this.pinchDist = Math.hypot(other.x - e.clientX, other.y - e.clientY);
      this.pinchMid = { x: (other.x + e.clientX) / 2, y: (other.y + e.clientY) / 2 };
    }
    const p: Pointer = { id: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, startTime: performance.now(), moved: 0, role, longTimer: 0, longFired: false, downStamp: e.timeStamp };
    this.pointers.set(e.pointerId, p);
    if (role === 'orbit') {
      // A finger held still marks a long press (haptic tick); the erase itself is decided on release from
      // the event timestamps, so a stalled frame can never turn a quick tap into a removal or lose it.
      p.longTimer = window.setTimeout(() => {
        if (this.pointers.get(p.id) !== p || p.moved >= 14 || p.role !== 'orbit') return;
        p.longFired = true;
        vibrate(12);
      }, LONG_PRESS_MS);
    }
    if (role === 'move') {
      this.movePointer = p;
      this.stickBase.hidden = false;
      this.stickBase.style.left = `${e.clientX}px`;
      this.stickBase.style.top = `${e.clientY}px`;
      this.stickKnob.style.transform = 'translate(0px, 0px)';
      this.stickBase.classList.remove('sprint');
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.moved += Math.abs(dx) + Math.abs(dy);
    if (p.moved >= 14 && p.longTimer) {
      window.clearTimeout(p.longTimer);
      p.longTimer = 0;
    }
    p.x = e.clientX;
    p.y = e.clientY;
    const v = this.input.virtual;
    if (p.role === 'move') {
      const R = 58;
      let ox = p.x - p.startX;
      let oy = p.y - p.startY;
      const len = Math.hypot(ox, oy);
      if (len > R) {
        ox *= R / len;
        oy *= R / len;
      }
      this.stickKnob.style.transform = `translate(${ox}px, ${oy}px)`;
      v.moveX = ox / R;
      v.moveY = -oy / R;
      const mag = Math.min(1, len / R);
      // Push the stick to its rim (mostly forward) to sprint.
      v.sprint = mag > 0.9 && v.moveY > 0.35;
      this.stickBase.classList.toggle('sprint', v.sprint);
    } else if (p.role === 'look' || p.role === 'orbit') {
      v.lookDX += dx;
      v.lookDY += dy;
    } else if (p.role === 'pinch') {
      const pts = Array.from(this.pointers.values()).filter((q) => q.role === 'pinch');
      if (pts.length === 2) {
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (this.pinchDist > 0) v.zoom += (this.pinchDist - d) / 120;
        this.pinchDist = d;
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        v.panX += mid.x - this.pinchMid.x;
        v.panY += mid.y - this.pinchMid.y;
        this.pinchMid = mid;
      }
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    const v = this.input.virtual;
    if (p.role === 'move') {
      this.movePointer = null;
      this.stickBase.hidden = true;
      v.moveX = 0;
      v.moveY = 0;
      v.sprint = false;
    } else if (p.role === 'look' || p.role === 'orbit') {
      if (p.longTimer) window.clearTimeout(p.longTimer);
      // Build mode: a still finger is a tap (place at the finger) or, when held long enough, a long press
      // (remove the block under the finger). Hardware timestamps decide, not frame timing.
      if (p.moved < 14 && this.mode === 'build') {
        const held = e.timeStamp - p.downStamp;
        v.tapped = true;
        v.tapX = p.x;
        v.tapY = p.y;
        if (held >= LONG_PRESS_MS) {
          v.secondary = true;
          v.longPress = true;
        }
      }
    } else if (p.role === 'pinch') {
      // Remaining finger goes back to orbit.
      for (const q of this.pointers.values()) if (q.role === 'pinch') q.role = 'orbit';
      this.pinchDist = 0;
    }
  };


  /** Lets the HUD weapon slots switch weapons on touch. */
  bindWeaponSlots(container: HTMLElement): void {
    container.addEventListener('pointerdown', (e) => {
      const slot = (e.target as HTMLElement).closest('.slot');
      if (!slot) return;
      const idx = Array.from(container.querySelectorAll('.slot')).indexOf(slot);
      if (idx >= 0) this.cb.weaponSlot(idx);
    });
  }

  get active(): boolean {
    return this.mode !== 'none';
  }
}
