import * as THREE from 'three';

/**
 * Unified input: keyboard + mouse (pointer lock) and touch (virtual joystick, look-drag, buttons).
 * Edge-triggered actions are consumed with `take()`.
 */
export type Action = 'sling' | 'strike' | 'interact' | 'call' | 'dodge' | 'skip' | 'pause' | 'retry';

export class Input {
  readonly move = new THREE.Vector2(); // x = right, y = forward, magnitude 0..1
  lookDX = 0;
  lookDY = 0;
  sprint = false;
  slingHeld = false;
  interactHeld = false;
  readonly isTouch: boolean;
  enabled = true;
  private keys = new Set<string>();
  private pressed = new Set<Action>();
  private released = new Set<Action>();
  private touchMove = new THREE.Vector2();
  private touchSprint = false;
  private joyId: number | null = null;
  private joyOrigin = new THREE.Vector2();
  private lookId: number | null = null;
  private lookLast = new THREE.Vector2();
  private joyEl!: HTMLDivElement;
  private joyKnob!: HTMLDivElement;
  wheel = 0;
  lockFailed = false;
  /**
   * (play1) when the sling was let go (performance.now() of the event; 0 = a scripted release): the release is timed
   * against the whirl at the moment of the event, not at the next frame (phones run at 30 fps)
   */
  private releaseStamp = 0;
  /** (play1, touch) the finger on the sling button: it aims while it is held (drag), and throws when lifted */
  private slingTouchId: number | null = null;
  private slingTouchLast = new THREE.Vector2();
  /** (play1) touch aim sensitivity while the sling is held (px -> look units) */
  slingDragScale = 1.25;

  constructor(private canvas: HTMLCanvasElement, private uiRoot: HTMLElement) {
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    addEventListener('keydown', (e) => this.onKey(e, true));
    addEventListener('keyup', (e) => this.onKey(e, false));
    addEventListener('blur', () => { this.keys.clear(); this.slingHeld = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement !== canvas && !this.isTouch && !this.lockFailed) {
        try {
          const r = canvas.requestPointerLock?.() as unknown;
          if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => (this.lockFailed = true));
        } catch {
          this.lockFailed = true;
        }
      }
      if (e.button === 0) { this.slingHeld = true; this.pressed.add('sling'); }
      // right button: strike when the pointer is locked; otherwise it is the drag-to-look button
      if (e.button === 2 && this.pointerLocked) this.pressed.add('strike');
    });
    document.addEventListener('pointerlockerror', () => (this.lockFailed = true));
    addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.slingHeld) { this.slingHeld = false; this.released.add('sling'); this.releaseStamp = performance.now(); }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.lookDX += e.movementX;
        this.lookDY += e.movementY;
      } else if (e.buttons & 3) {
        // fallback when pointer lock is unavailable (e.g. inside an embedded frame): drag to look
        this.lookDX += e.movementX * 1.4;
        this.lookDY += e.movementY * 1.4;
      }
    });
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    if (this.isTouch) this.buildTouch();
  }

  get pointerLocked() {
    return document.pointerLockElement === this.canvas;
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const k = e.code;
    if (down && !this.keys.has(k)) {
      if (k === 'KeyE') { this.pressed.add('interact'); this.interactHeld = true; }
      if (k === 'KeyQ') this.pressed.add('call');
      if (k === 'Space') this.pressed.add('dodge');
      if (k === 'KeyF') this.pressed.add('strike');
      if (k === 'KeyR') this.pressed.add('retry'); // (play1) the sling range: try the round again
      if (k === 'Enter') this.pressed.add('skip');
      if (k === 'Escape' || k === 'KeyP') this.pressed.add('pause');
    }
    if (!down && k === 'KeyE') this.interactHeld = false;
    if (down) this.keys.add(k);
    else this.keys.delete(k);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  }

  /** Was this action pressed since the last frame? (consumes it) */
  take(a: Action) {
    const had = this.pressed.has(a);
    this.pressed.delete(a);
    return had;
  }
  takeRelease(a: Action) {
    const had = this.released.has(a);
    this.released.delete(a);
    return had;
  }
  /** Programmatic presses (used by touch buttons). */
  press(a: Action) {
    this.pressed.add(a);
  }
  /** (play1) Programmatic hold / release of the sling (tests and bots): a scripted release is timed on the frame. */
  holdSling(on: boolean) {
    if (on && !this.slingHeld) {
      this.slingHeld = true;
      this.pressed.add('sling');
    } else if (!on && this.slingHeld) {
      this.slingHeld = false;
      this.released.add('sling');
      this.releaseStamp = 0;
    }
  }
  /** (play1) seconds between the sling's release event and now (0 for scripted releases), at most 0.1 */
  releaseLag() {
    if (!this.releaseStamp) return 0;
    return Math.min(0.1, Math.max(0, (performance.now() - this.releaseStamp) / 1000));
  }

  update() {
    let x = 0, y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    this.move.set(x, y);
    if (this.move.lengthSq() > 1) this.move.normalize();
    if (this.touchMove.lengthSq() > 0.0001) this.move.copy(this.touchMove);
    this.sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchSprint;
    if (!this.enabled) this.move.set(0, 0);
  }

  consumeLook() {
    const d = new THREE.Vector2(this.lookDX, this.lookDY);
    this.lookDX = this.lookDY = 0;
    return d;
  }

  clearEdges() {
    this.pressed.clear();
    this.released.clear();
  }

  // ------------------------------------------------------------------------------------ touch
  private buildTouch() {
    const layer = document.createElement('div');
    layer.className = 'touch-layer';
    layer.innerHTML = `
      <div class="joy"><div class="joy-knob"></div></div>
      <div class="tbtns">
        <button class="tbtn big" data-a="sling">קֶלַע</button>
        <button class="tbtn" data-a="strike">מַקֵּל</button>
        <button class="tbtn" data-a="interact">פְּעֻלָּה</button>
        <button class="tbtn" data-a="dodge">הִתְחַמֵּק</button>
        <button class="tbtn small" data-a="call">קְרִיאָה</button>
      </div>`;
    this.uiRoot.appendChild(layer);
    this.joyEl = layer.querySelector('.joy') as HTMLDivElement;
    this.joyKnob = layer.querySelector('.joy-knob') as HTMLDivElement;
    layer.querySelectorAll<HTMLButtonElement>('.tbtn').forEach((b) => {
      const a = b.dataset.a as Action;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        b.classList.add('on');
        if (a === 'sling') {
          // (play1) hold the sling button to draw and whirl; the same thumb drags to aim; lifting it throws
          this.slingHeld = true;
          const t = e.changedTouches[0];
          if (t) {
            this.slingTouchId = t.identifier;
            this.slingTouchLast.set(t.clientX, t.clientY);
          }
        }
        if (a === 'interact') this.interactHeld = true;
        this.pressed.add(a);
      }, { passive: false });
      if (a === 'sling') {
        b.addEventListener('touchmove', (e) => {
          e.preventDefault();
          for (const t of Array.from(e.changedTouches)) {
            if (t.identifier !== this.slingTouchId) continue;
            this.lookDX += (t.clientX - this.slingTouchLast.x) * this.slingDragScale;
            this.lookDY += (t.clientY - this.slingTouchLast.y) * this.slingDragScale;
            this.slingTouchLast.set(t.clientX, t.clientY);
          }
        }, { passive: false });
      }
      const end = (e: Event) => {
        e.preventDefault();
        b.classList.remove('on');
        if (a === 'sling' && this.slingHeld) {
          this.slingHeld = false;
          this.released.add('sling');
          this.releaseStamp = performance.now();
          this.slingTouchId = null;
        }
        if (a === 'interact') this.interactHeld = false;
      };
      b.addEventListener('touchend', end, { passive: false });
      b.addEventListener('touchcancel', end, { passive: false });
    });
    const onStart = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.clientX < innerWidth * 0.42 && this.joyId === null) {
          this.joyId = t.identifier;
          this.joyOrigin.set(t.clientX, t.clientY);
          this.joyEl.style.left = t.clientX - 60 + 'px';
          this.joyEl.style.top = t.clientY - 60 + 'px';
          this.joyEl.classList.add('on');
        } else if (this.lookId === null) {
          this.lookId = t.identifier;
          this.lookLast.set(t.clientX, t.clientY);
        }
      }
    };
    const onMove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.joyId) {
          const dx = t.clientX - this.joyOrigin.x;
          const dy = t.clientY - this.joyOrigin.y;
          const len = Math.hypot(dx, dy);
          const max = 55;
          const k = Math.min(1, len / max);
          this.touchMove.set(dx / (len || 1), -dy / (len || 1)).multiplyScalar(k);
          this.touchSprint = len > max * 1.35;
          const cl = Math.min(len, max);
          this.joyKnob.style.transform = `translate(${(dx / (len || 1)) * cl}px, ${(dy / (len || 1)) * cl}px)`;
        } else if (t.identifier === this.lookId) {
          this.lookDX += (t.clientX - this.lookLast.x) * 1.6;
          this.lookDY += (t.clientY - this.lookLast.y) * 1.6;
          this.lookLast.set(t.clientX, t.clientY);
        }
      }
      e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.joyId) {
          this.joyId = null;
          this.touchMove.set(0, 0);
          this.touchSprint = false;
          this.joyKnob.style.transform = '';
          this.joyEl.classList.remove('on');
        }
        if (t.identifier === this.lookId) this.lookId = null;
      }
    };
    this.canvas.addEventListener('touchstart', onStart, { passive: true });
    this.canvas.addEventListener('touchmove', onMove, { passive: false });
    this.canvas.addEventListener('touchend', onEnd);
    this.canvas.addEventListener('touchcancel', onEnd);
  }

  setTouchVisible(v: boolean) {
    const l = this.uiRoot.querySelector('.touch-layer') as HTMLElement | null;
    if (l) l.style.display = v ? '' : 'none';
  }
}
