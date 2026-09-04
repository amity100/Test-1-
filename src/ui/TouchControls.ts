import { el } from './dom';
import type { Input } from '../core/Input';
import { t } from '../core/i18n';

export type TouchMode = 'none' | 'battle' | 'build';

export interface TouchCallbacks {
  pause(): void;
  weaponSlot(i: number): void;
  build: {
    tools(): void;
    rotate(): void;
    undo(): void;
  };
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
}

/** On-screen controls for phones and tablets: floating joystick, look area, action buttons. */
export class TouchControls {
  readonly root: HTMLElement;
  private mode: TouchMode = 'none';
  private moveZone: HTMLElement;
  private lookZone: HTMLElement;
  private stickBase: HTMLElement;
  private stickKnob: HTMLElement;
  private battleButtons: HTMLElement;
  private buildButtons: HTMLElement;
  private pointers = new Map<number, Pointer>();
  private movePointer: Pointer | null = null;
  private pinchDist = 0;
  private pinchMid = { x: 0, y: 0 };
  private crouchOn = false;
  private adsOn = false;
  private sprintLatched = false;
  private fireBtn!: HTMLElement;
  private crouchBtn!: HTMLElement;
  private adsBtn!: HTMLElement;
  private reticle: HTMLElement;
  private hint: HTMLElement;

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
    this.reticle = el('div', 'build-reticle');
    this.reticle.hidden = true;
    this.hint = el('div', 'touch-hint');
    this.hint.hidden = true;
    this.battleButtons = el('div', 'tb-group tb-battle');
    this.battleButtons.setAttribute('data-ui', '1');
    this.buildButtons = el('div', 'tb-group tb-build');
    this.buildButtons.setAttribute('data-ui', '1');
    this.root.append(this.moveZone, this.lookZone, this.stickBase, this.reticle, this.hint, this.battleButtons, this.buildButtons);
    this.buildBattleButtons();
    this.buildBuildButtons();
    for (const zone of [this.moveZone, this.lookZone]) {
      zone.addEventListener('pointerdown', this.onPointerDown);
      zone.addEventListener('pointermove', this.onPointerMove);
      zone.addEventListener('pointerup', this.onPointerUp);
      zone.addEventListener('pointercancel', this.onPointerUp);
      zone.addEventListener('lostpointercapture', this.onPointerUp);
    }
  }

  private button(parent: HTMLElement, cls: string, label: string, opts: { down?: () => void; up?: () => void; tap?: () => void }): HTMLElement {
    const b = el('div', `tb ${cls}`, label);
    b.setAttribute('data-ui', '1');
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      b.classList.add('down');
      opts.down?.();
    });
    const release = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      if ((window as unknown as { __touchDebug?: boolean }).__touchDebug) console.log(`[touch] button ${cls} ${e.type} down=${b.classList.contains('down')}`);
      if (!b.classList.contains('down')) return;
      b.classList.remove('down');
      opts.up?.();
      opts.tap?.();
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
    this.fireBtn = this.button(g, 'fire', '◉', {
      down: () => {
        v.fire = true;
        v.firePressed = true;
      },
      up: () => {
        v.fire = false;
        v.fireReleased = true;
      },
    });
    this.button(g, 'fire fire-left', '◉', {
      down: () => {
        v.fire = true;
        v.firePressed = true;
      },
      up: () => {
        v.fire = false;
        v.fireReleased = true;
      },
    });
    this.button(g, 'jump', '⤒', {
      down: () => {
        v.jump = true;
        v.jumpHeld = true;
      },
      up: () => {
        v.jumpHeld = false;
      },
    });
    this.crouchBtn = this.button(g, 'crouch', '⤓', {
      tap: () => {
        this.crouchOn = !this.crouchOn;
        v.crouch = this.crouchOn;
        this.crouchBtn.classList.toggle('on', this.crouchOn);
      },
    });
    this.adsBtn = this.button(g, 'ads', '◎', {
      tap: () => {
        this.adsOn = !this.adsOn;
        v.ads = this.adsOn;
        this.adsBtn.classList.toggle('on', this.adsOn);
      },
    });
    this.button(g, 'reload', '↻', { tap: () => (v.reload = true) });
    this.button(g, 'grenade', '●', { tap: () => (v.grenade = true) });
    this.button(g, 'grapple', '⟟', {
      down: () => (v.grapple = true),
      up: () => (v.grappleReleased = true),
    });
    this.button(g, 'swap', '⇄', { tap: () => (v.weaponSwitch = 100) });
    this.button(g, 'pause', '❚❚', { tap: () => this.cb.pause() });
  }

  private buildBuildButtons(): void {
    const v = this.input.virtual;
    const g = this.buildButtons;
    this.button(g, 'place', '＋', { tap: () => (v.primary = true) });
    this.button(g, 'remove', '－', { tap: () => (v.secondary = true) });
    this.button(g, 'rotate', '↻', { tap: () => this.cb.build.rotate() });
    this.button(g, 'undo', '↶', { tap: () => this.cb.build.undo() });
    this.button(g, 'up', '▲', { down: () => (v.heightDir = 1), up: () => (v.heightDir = 0) });
    this.button(g, 'down', '▼', { down: () => (v.heightDir = -1), up: () => (v.heightDir = 0) });
    this.button(g, 'tools', '☰', { tap: () => this.cb.build.tools() });
    this.button(g, 'pause', '❚❚', { tap: () => this.cb.pause() });
  }

  setMode(mode: TouchMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.root.hidden = mode === 'none';
    this.battleButtons.hidden = mode !== 'battle';
    this.buildButtons.hidden = mode !== 'build';
    this.reticle.hidden = mode !== 'build';
    this.hint.hidden = mode !== 'build';
    this.hint.textContent = t('touchBuildHint');
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
    this.crouchOn = false;
    this.adsOn = false;
    v.crouch = false;
    v.ads = false;
    this.crouchBtn.classList.remove('on');
    this.adsBtn.classList.remove('on');
  }

  private onPointerDown = (e: PointerEvent): void => {
    if ((window as unknown as { __touchDebug?: boolean }).__touchDebug) console.log(`[touch] down id=${e.pointerId} type=${e.pointerType} mode=${this.mode} n=${this.pointers.size}`);
    if (e.pointerType === 'mouse' && this.mode !== 'build') return;
    e.preventDefault();
    const zone = e.currentTarget as HTMLElement;
    zone.setPointerCapture?.(e.pointerId);
    const isMove = zone === this.moveZone && this.mode === 'battle';
    let role: Pointer['role'] = isMove ? 'move' : this.mode === 'build' ? 'orbit' : 'look';
    // Second finger in build mode starts a pinch.
    if (this.mode === 'build' && this.pointers.size === 1) {
      role = 'pinch';
      const other = this.pointers.values().next().value as Pointer;
      other.role = 'pinch';
      if (other.longTimer) window.clearTimeout(other.longTimer);
      this.pinchDist = Math.hypot(other.x - e.clientX, other.y - e.clientY);
      this.pinchMid = { x: (other.x + e.clientX) / 2, y: (other.y + e.clientY) / 2 };
    }
    const p: Pointer = { id: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, startTime: performance.now(), moved: 0, role, longTimer: 0, longFired: false };
    this.pointers.set(e.pointerId, p);
    if (role === 'orbit') {
      // Long press (finger held still) removes the block under the finger in build mode.
      p.longTimer = window.setTimeout(() => {
        if (this.pointers.get(p.id) !== p || p.moved >= 14 || p.role !== 'orbit') return;
        p.longFired = true;
        const v = this.input.virtual;
        v.tapped = true;
        v.tapX = p.x;
        v.tapY = p.y;
        v.secondary = true;
        v.longPress = true;
      }, 520);
    }
    if (role === 'move') {
      this.movePointer = p;
      this.stickBase.hidden = false;
      this.stickBase.style.left = `${e.clientX}px`;
      this.stickBase.style.top = `${e.clientY}px`;
      this.stickKnob.style.transform = 'translate(0px, 0px)';
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
      const R = 60;
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
      v.sprint = mag > 0.92;
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
    if ((window as unknown as { __touchDebug?: boolean }).__touchDebug) console.log(`[touch] ${e.type} id=${e.pointerId} known=${!!p} role=${p?.role} mode=${this.mode} n=${this.pointers.size}`);
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
      // Slow frames delay pointer events, so taps are judged by movement only.
      if (p.moved < 14 && !p.longFired) {
        if (this.mode === 'battle') {
          // Tap on the look side fires one shot.
          v.firePressed = true;
          v.fire = true;
          window.setTimeout(() => {
            v.fire = false;
            v.fireReleased = true;
          }, 60);
        } else if (this.mode === 'build') {
          v.tapped = true;
          v.tapX = p.x;
          v.tapY = p.y;
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
