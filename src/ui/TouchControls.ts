import { el, btn } from './dom';
import type { Input } from '../core/Input';
import { t } from '../core/i18n';
import { settings, type TouchLayout, type ButtonPlace } from '../core/Settings';

export type TouchMode = 'none' | 'battle' | 'build' | 'fortify';

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

interface ButtonOpts {
  down?: () => void;
  up?: () => void;
  tap?: () => void;
  repeat?: () => void;
  /** Dragging on the held button turns the view (fire and aim buttons, as in popular mobile shooters). */
  aim?: boolean;
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
  knife: svg('<path d="M4 20l9-9"/><path d="M13 11l7-7-2 6-4 4z" fill="currentColor"/><path d="M10 14l-2 2"/>'),
  map: svg('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/><path d="M6 10h2M16 12h2"/>'),
  place: svg('<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 20h16"/><path d="M6 17h12"/>'),
};

/**
 * Where each button sits by default, as fractions of the screen (landscape phone), laid out the way
 * popular mobile shooters do it: the right thumb rests on a big fire button with aim, jump and crouch
 * on an arc around it, knife and reload a little further in, grenade and gadgets up the right edge, and
 * a second fire button above the stick for the left thumb. Sizes are multipliers of the base size.
 */
export const DEFAULT_LAYOUT: TouchLayout = {
  fire: { x: 0.925, y: 0.6, s: 1 },
  fireLeft: { x: 0.068, y: 0.44, s: 1 },
  jump: { x: 0.842, y: 0.87, s: 1 },
  crouch: { x: 0.748, y: 0.885, s: 1 },
  ads: { x: 0.836, y: 0.645, s: 1 },
  knife: { x: 0.736, y: 0.7, s: 1 },
  reload: { x: 0.83, y: 0.43, s: 1 },
  grenade: { x: 0.935, y: 0.36, s: 1 },
  gadget0: { x: 0.933, y: 0.19, s: 1 },
  gadget1: { x: 0.863, y: 0.25, s: 1 },
  map: { x: 0.24, y: 0.1, s: 0.85 },
};
/** Fortify walk: the PLACE button takes the fire spot; jump and crouch keep clear of the trap picker. */
const FORTIFY_LAYOUT: TouchLayout = {
  place: { x: 0.925, y: 0.6, s: 1 },
  fjump: { x: 0.86, y: 0.86, s: 1 },
  fcrouch: { x: 0.93, y: 0.33, s: 1 },
};
const BASE_SIZE: Record<string, number> = { fire: 92, fireLeft: 68, jump: 66, crouch: 58, ads: 54, knife: 50, reload: 50, grenade: 50, gadget0: 48, gadget1: 48, map: 48, place: 92, fjump: 66, fcrouch: 56 };
/** Buttons the player may move and resize. */
export const EDITABLE = Object.keys(DEFAULT_LAYOUT);

/** A left-handed layout: everything mirrored across the middle. */
export function mirrorLayout(layout: TouchLayout): TouchLayout {
  const out: TouchLayout = {};
  for (const [id, p] of Object.entries(layout)) out[id] = { x: 1 - p.x, y: p.y, s: p.s };
  return out;
}

/**
 * On-screen controls for phones and tablets: a floating stick on the left, drag-to-aim anywhere else
 * (including on a held fire or aim button), and buttons whose places and sizes the player can change.
 */
export class TouchControls {
  readonly root: HTMLElement;
  private mode: TouchMode = 'none';
  private moveZone: HTMLElement;
  private lookZone: HTMLElement;
  private stickBase: HTMLElement;
  private stickKnob: HTMLElement;
  private battleButtons: HTMLElement;
  private fortifyButtons: HTMLElement;
  private pointers = new Map<number, Pointer>();
  private movePointer: Pointer | null = null;
  private pinchDist = 0;
  private pinchMid = { x: 0, y: 0 };
  private crouchOn = false;
  private adsOn = false;
  private fireBtn!: HTMLElement;
  private fireBadge!: HTMLElement;
  private crouchBtns: HTMLElement[] = [];
  private adsBtn!: HTMLElement;
  private gadgetBtns: HTMLElement[] = [];
  private gadgetCounts: HTMLElement[] = [];
  /** Every positioned button by layout id (jump/crouch exist in two groups). */
  private placed = new Map<string, HTMLElement[]>();
  private layout: TouchLayout = { ...DEFAULT_LAYOUT };
  private mapBtn!: HTMLElement;

  /** Shows the command-map button (team modes only). */
  setMapButton(on: boolean): void {
    this.mapBtn.hidden = !on;
  }
  private scale = 1;
  // Layout editor.
  private editing = false;
  private editor: HTMLElement | null = null;
  private selected = '';
  private dragId: string | null = null;
  private dragPointer = -1;
  private editDone: (() => void) | null = null;
  private sizeSlider: HTMLInputElement | null = null;

  constructor(parent: HTMLElement, private input: Input, private cb: TouchCallbacks) {
    this.root = el('div', 'touch-ui');
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.lookZone = el('div', 'tz tz-look');
    this.lookZone.setAttribute('data-game', '1');
    this.moveZone = el('div', 'tz tz-move');
    this.moveZone.setAttribute('data-game', '1');
    this.stickBase = el('div', 'stick-base');
    this.stickKnob = el('div', 'stick-knob');
    this.stickBase.appendChild(this.stickKnob);
    this.stickBase.hidden = true;
    this.battleButtons = el('div', 'tb-group tb-battle');
    this.battleButtons.setAttribute('data-ui', '1');
    this.fortifyButtons = el('div', 'tb-group tb-fortify');
    this.fortifyButtons.setAttribute('data-ui', '1');
    this.fortifyButtons.hidden = true;
    this.root.append(this.lookZone, this.moveZone, this.stickBase, this.battleButtons, this.fortifyButtons);
    this.buildBattleButtons();
    this.buildFortifyButtons();
    for (const zone of [this.moveZone, this.lookZone]) {
      zone.addEventListener('pointerdown', this.onPointerDown);
      zone.addEventListener('pointermove', this.onPointerMove);
      zone.addEventListener('pointerup', this.onPointerUp);
      zone.addEventListener('pointercancel', this.onPointerUp);
      zone.addEventListener('lostpointercapture', this.onPointerUp);
    }
    window.addEventListener('resize', () => this.applyLayout());
    this.setLayout(settings.data.touchLayout);
  }

  /** Size multiplier and idle opacity of the on-screen controls (from settings). */
  applyStyle(scale: number, opacity: number): void {
    this.scale = scale;
    this.root.style.setProperty('--ts', String(scale));
    this.root.style.setProperty('--to', String(opacity));
    this.applyLayout();
  }

  /** Places and sizes from settings over the defaults. */
  setLayout(layout: TouchLayout): void {
    this.layout = { ...DEFAULT_LAYOUT };
    for (const id of EDITABLE) {
      const p = layout[id];
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) this.layout[id] = { x: Math.min(0.97, Math.max(0.03, p.x)), y: Math.min(0.97, Math.max(0.05, p.y)), s: Math.min(1.6, Math.max(0.6, p.s || 1)) };
    }
    this.applyLayout();
  }

  private placeOf(id: string): ButtonPlace {
    if (id === 'place') return this.layout.fire;
    return this.layout[id] ?? FORTIFY_LAYOUT[id] ?? DEFAULT_LAYOUT[id] ?? DEFAULT_LAYOUT.fire;
  }

  /** Positions every button from its layout entry (centre fractions → pixels, size → px). */
  private applyLayout(): void {
    const W = window.innerWidth;
    const H = window.innerHeight;
    for (const [id, els] of this.placed) {
      const p = this.placeOf(id);
      const size = (BASE_SIZE[id] ?? 56) * p.s * this.scale;
      for (const b of els) {
        b.style.left = `${p.x * W - size / 2}px`;
        b.style.top = `${p.y * H - size / 2}px`;
        b.style.width = `${size}px`;
        b.style.height = `${size}px`;
      }
    }
  }

  /** Shows the AUTO badge on the fire button when automatic fire is active. */
  setAutoFire(on: boolean): void {
    this.fireBadge.hidden = !on;
  }

  private button(parent: HTMLElement, id: string, cls: string, icon: string, opts: ButtonOpts): HTMLElement {
    const b = el('div', `tb ${cls}`, icon);
    b.setAttribute('data-ui', '1');
    b.dataset.id = id;
    let repeatHandle = 0;
    let aimId = -1;
    let ax = 0;
    let ay = 0;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.editing) {
        this.beginDrag(id, e);
        return;
      }
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      b.classList.add('down');
      opts.down?.();
      if (opts.aim) {
        aimId = e.pointerId;
        ax = e.clientX;
        ay = e.clientY;
      }
      if (opts.repeat) {
        // Hold to repeat (after a short delay), e.g. layer up/down.
        repeatHandle = window.setTimeout(() => {
          repeatHandle = window.setInterval(() => opts.repeat?.(), 160);
        }, 380);
      }
    });
    b.addEventListener('pointermove', (e) => {
      if (this.editing || e.pointerId !== aimId) return;
      // A finger sliding on a held fire/aim button keeps turning the view.
      this.input.virtual.lookDX += e.clientX - ax;
      this.input.virtual.lookDY += e.clientY - ay;
      ax = e.clientX;
      ay = e.clientY;
    });
    const release = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      if (this.editing) return;
      aimId = -1;
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
    const list = this.placed.get(id) ?? [];
    list.push(b);
    this.placed.set(id, list);
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
    this.fireBtn = this.button(g, 'fire', 'fire', ICON.fire, { down: fireDown, up: fireUp, aim: true });
    this.fireBadge = el('span', 'badge', 'AUTO');
    this.fireBadge.hidden = true;
    this.fireBtn.appendChild(this.fireBadge);
    this.button(g, 'fireLeft', 'fire fire-left', ICON.fire, { down: fireDown, up: fireUp, aim: true });
    this.button(g, 'jump', 'jump', ICON.jump, {
      down: () => {
        v.jump = true;
        v.jumpHeld = true;
      },
      up: () => {
        v.jumpHeld = false;
      },
    });
    this.crouchBtns.push(this.button(g, 'crouch', 'crouch', ICON.crouch, { tap: () => this.toggleCrouch() }));
    this.adsBtn = this.button(g, 'ads', 'ads', ICON.ads, {
      tap: () => {
        this.adsOn = !this.adsOn;
        v.ads = this.adsOn;
        this.adsBtn.classList.toggle('on', this.adsOn);
      },
      aim: true,
    });
    this.button(g, 'knife', 'knife', ICON.knife, { tap: () => (v.melee = true) });
    this.mapBtn = this.button(g, 'map', 'map', ICON.map, { tap: () => (v.map = true) });
    this.mapBtn.hidden = true;
    this.button(g, 'reload', 'reload', ICON.reload, { tap: () => (v.reload = true) });
    this.button(g, 'grenade', 'grenade', ICON.grenade, { tap: () => (v.grenade = true) });
    for (let i = 0; i < 2; i++) {
      const b = this.button(g, `gadget${i}`, `gadget g${i}`, ICON.grapple, {
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
    const pause = el('div', 'tb pause', ICON.pause);
    pause.setAttribute('data-ui', '1');
    pause.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.editing) window.setTimeout(() => this.cb.pause(), 0);
    });
    g.appendChild(pause);
  }

  private buildFortifyButtons(): void {
    const v = this.input.virtual;
    const g = this.fortifyButtons;
    const place = this.button(g, 'place', 'fire place', ICON.place, {
      down: () => {
        v.fire = true;
        v.firePressed = true;
      },
      up: () => {
        v.fire = false;
        v.fireReleased = true;
      },
      aim: true,
    });
    place.appendChild(el('span', 'badge lbl', t('fortifyPlace')));
    this.button(g, 'fjump', 'jump', ICON.jump, {
      down: () => {
        v.jump = true;
        v.jumpHeld = true;
      },
      up: () => {
        v.jumpHeld = false;
      },
    });
    this.crouchBtns.push(this.button(g, 'fcrouch', 'crouch', ICON.crouch, { tap: () => this.toggleCrouch() }));
  }

  private toggleCrouch(): void {
    this.crouchOn = !this.crouchOn;
    this.input.virtual.crouch = this.crouchOn;
    for (const b of this.crouchBtns) b.classList.toggle('on', this.crouchOn);
  }

  /** Relabels the PLACE button after a language change. */
  refreshLabels(): void {
    const lbl = this.fortifyButtons.querySelector('.badge.lbl');
    if (lbl) lbl.textContent = t('fortifyPlace');
  }

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
      b.hidden = !icon && !this.editing;
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
    if (this.editing) return; // the editor decides what shows until it closes
    this.showMode();
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
    for (const b of this.crouchBtns) b.classList.remove('on');
    this.adsBtn.classList.remove('on');
  }

  private showMode(): void {
    const mode = this.mode;
    this.root.hidden = mode === 'none';
    this.battleButtons.hidden = mode !== 'battle';
    this.fortifyButtons.hidden = mode !== 'fortify';
    // Build mode uses the whole screen as one orbit-and-tap surface.
    this.root.classList.toggle('build', mode === 'build');
    this.root.classList.toggle('walk', mode === 'battle' || mode === 'fortify');
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.editing) return;
    if (e.pointerType === 'mouse' && this.mode !== 'build') return;
    e.preventDefault();
    const zone = e.currentTarget as HTMLElement;
    zone.setPointerCapture?.(e.pointerId);
    const walk = this.mode === 'battle' || this.mode === 'fortify';
    const isMove = zone === this.moveZone && walk;
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
        // The stick follows a thumb that drifts past the rim, so long runs never fight the base.
        const k = R / len;
        p.startX += ox * (1 - k) * 0.35;
        p.startY += oy * (1 - k) * 0.35;
        ox = p.x - p.startX;
        oy = p.y - p.startY;
        const l2 = Math.hypot(ox, oy);
        if (l2 > R) {
          ox *= R / l2;
          oy *= R / l2;
        }
        this.stickBase.style.left = `${p.startX}px`;
        this.stickBase.style.top = `${p.startY}px`;
      }
      this.stickKnob.style.transform = `translate(${ox}px, ${oy}px)`;
      v.moveX = ox / R;
      v.moveY = -oy / R;
      const mag = Math.min(1, Math.hypot(ox, oy) / R);
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

  // ------------------------------------------------------------------ layout editor
  /**
   * Opens the layout editor: every battle button is shown and can be dragged; tapping one selects it
   * for the size slider. Presets: the default layout and a mirrored left-handed one. Saved on Done.
   */
  editLayout(onDone: () => void): void {
    if (this.editing) return;
    this.editing = true;
    this.editDone = onDone;
    this.root.hidden = false;
    this.root.classList.add('editing');
    this.root.classList.remove('build');
    this.battleButtons.hidden = false;
    this.fortifyButtons.hidden = true;
    for (const b of this.gadgetBtns) b.hidden = false;
    const ed = el('div', 'tl-editor');
    ed.setAttribute('data-ui', '1');
    ed.innerHTML = `<div class="tl-title">${t('layoutTitle')}</div><div class="tl-hint">${t('layoutHint')}</div>`;
    const sizeRow = el('div', 'row');
    const sizeLbl = el('span', 'muted', t('layoutSize'));
    const slider = el('input');
    slider.type = 'range';
    slider.min = '0.6';
    slider.max = '1.6';
    slider.step = '0.05';
    slider.value = '1';
    slider.disabled = true;
    slider.addEventListener('input', () => {
      if (!this.selected) return;
      this.layout[this.selected] = { ...this.layout[this.selected], s: parseFloat(slider.value) };
      this.applyLayout();
    });
    this.sizeSlider = slider;
    sizeRow.append(sizeLbl, slider);
    const actions = el('div', 'row');
    actions.append(
      btn(t('layoutReset'), 'small', () => {
        this.layout = { ...DEFAULT_LAYOUT };
        this.select('');
        this.applyLayout();
      }),
      btn(t('layoutMirror'), 'small', () => {
        this.layout = mirrorLayout(this.layout);
        this.applyLayout();
      }),
      btn(t('layoutDone'), 'primary small', () => this.finishEdit()),
    );
    ed.append(sizeRow, actions);
    this.root.appendChild(ed);
    this.editor = ed;
    window.addEventListener('pointermove', this.onEditMove);
    window.addEventListener('pointerup', this.onEditUp);
    window.addEventListener('pointercancel', this.onEditUp);
    this.select('');
    this.applyLayout();
  }

  get isEditing(): boolean {
    return this.editing;
  }

  private select(id: string): void {
    this.selected = id;
    for (const [bid, els] of this.placed) for (const b of els) b.classList.toggle('sel', bid === id && id !== '');
    if (this.sizeSlider) {
      this.sizeSlider.disabled = !id;
      if (id) this.sizeSlider.value = String(this.layout[id]?.s ?? 1);
    }
  }

  private beginDrag(id: string, e: PointerEvent): void {
    if (!EDITABLE.includes(id)) return;
    this.select(id);
    this.dragId = id;
    this.dragPointer = e.pointerId;
  }

  private onEditMove = (e: PointerEvent): void => {
    if (!this.dragId || e.pointerId !== this.dragPointer) return;
    const p = this.layout[this.dragId];
    const x = Math.min(0.97, Math.max(0.03, e.clientX / window.innerWidth));
    const y = Math.min(0.97, Math.max(0.05, e.clientY / window.innerHeight));
    this.layout[this.dragId] = { x, y, s: p.s };
    this.applyLayout();
  };

  private onEditUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.dragPointer) return;
    this.dragId = null;
    this.dragPointer = -1;
  };

  private finishEdit(): void {
    settings.data.touchLayout = { ...this.layout };
    settings.save();
    this.editing = false;
    this.editor?.remove();
    this.editor = null;
    this.sizeSlider = null;
    this.select('');
    window.removeEventListener('pointermove', this.onEditMove);
    window.removeEventListener('pointerup', this.onEditUp);
    window.removeEventListener('pointercancel', this.onEditUp);
    this.root.classList.remove('editing');
    for (let i = 0; i < this.gadgetBtns.length; i++) this.gadgetBtns[i].hidden = !this.gadgetBtns[i].dataset.icon;
    this.showMode();
    const done = this.editDone;
    this.editDone = null;
    done?.();
  }

  /** Current layout (tests). */
  get currentLayout(): TouchLayout {
    return { ...this.layout };
  }
}
