/** Virtual (touch / on-screen) input channel merged with keyboard and mouse. */
export interface VirtualState {
  moveX: number;
  moveY: number;
  lookDX: number;
  lookDY: number;
  fire: boolean;
  firePressed: boolean;
  fireReleased: boolean;
  jump: boolean;
  jumpHeld: boolean;
  sprint: boolean;
  crouch: boolean;
  ads: boolean;
  reload: boolean;
  grenade: boolean;
  /** Gadget kit slots (two): edge flags plus held state. */
  gadget: boolean[];
  gadgetHeld: boolean[];
  gadgetReleased: boolean[];
  interact: boolean;
  /** -1 none, 0..2 slot, 100 next weapon. */
  weaponSwitch: number;
  primary: boolean;
  secondary: boolean;
  /** Build buttons held down (continuous placing / erasing while the view turns). */
  primaryHeld: boolean;
  secondaryHeld: boolean;
  zoom: number;
  panX: number;
  panY: number;
  tapped: boolean;
  tapX: number;
  tapY: number;
  longPress: boolean;
  heightDir: number;
}

function freshVirtual(): VirtualState {
  return {
    moveX: 0, moveY: 0, lookDX: 0, lookDY: 0,
    fire: false, firePressed: false, fireReleased: false,
    jump: false, jumpHeld: false, sprint: false, crouch: false, ads: false,
    reload: false, grenade: false, gadget: [false, false], gadgetHeld: [false, false], gadgetReleased: [false, false], interact: false,
    weaponSwitch: -1, primary: false, secondary: false, primaryHeld: false, secondaryHeld: false, zoom: 0, panX: 0, panY: 0,
    tapped: false, tapX: 0, tapY: 0, longPress: false, heightDir: 0,
  };
}

const GADGET_KEYS = ['KeyQ', 'KeyF'];

/** True on phones/tablets (coarse pointer with touch points). */
export const IS_TOUCH: boolean =
  typeof window !== 'undefined' &&
  ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0) ||
    (navigator.maxTouchPoints > 1 && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)));

/**
 * Keyboard + mouse + virtual (touch) input with pointer lock and a fallback when locking is
 * unavailable. Mouse buttons are captured at window level and filtered so clicks on UI panels
 * (elements inside a `[data-ui]` container) never count as game input.
 */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  private pressedMods = new Map<string, { ctrl: boolean; shift: boolean; alt: boolean }>();
  private buttonsDown = new Set<number>();
  private buttonsPressed = new Set<number>();
  private buttonsReleased = new Set<number>();
  private buttonDownStamp = new Map<number, number>();
  private buttonDownPos = new Map<number, { x: number; y: number }>();
  private buttonUpPos = new Map<number, { x: number; y: number }>();
  private buttonHeld = new Map<number, number>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  /** Cursor position in CSS pixels relative to the target. */
  cursorX = 0;
  cursorY = 0;
  pointerLocked = false;
  /** True when pointer lock is not available here (denied by the embedding page) and we look with raw mouse deltas instead. */
  fallbackLook = false;
  fallbackActive = false;
  private lockErrors = 0;
  private lockRequestedAt = 0;
  private lockedAt = -Infinity;
  /** When false, game input is ignored (menus open). */
  enabled = true;
  onLockChange: ((locked: boolean) => void) | null = null;
  private lockRequested = false;
  readonly virtual: VirtualState = freshVirtual();
  readonly isTouch = IS_TOUCH;

  constructor(private target: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown, { passive: true });
    window.addEventListener('mouseup', this.onMouseUp, { passive: true });
    window.addEventListener('mousemove', this.onMouseMove, { passive: true });
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('contextmenu', (e) => {
      if (this.isGameTarget(e.target)) e.preventDefault();
    });
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('pointerlockerror', this.onPointerLockError);
    window.addEventListener('blur', () => this.clearAll());
    if (!('requestPointerLock' in target)) this.fallbackLook = true;
    target.setAttribute('data-game', '1');
  }

  /** Game input targets: the canvas or overlays marked data-game, unless inside a data-ui panel. */
  isGameTarget(t: EventTarget | null): boolean {
    if (!(t instanceof Element)) return false;
    const marker = t.closest('[data-ui], [data-game]');
    if (!marker) return t === this.target || t === document.body || t === document.documentElement;
    return marker.hasAttribute('data-game');
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (!this.down.has(e.code)) {
      this.pressed.add(e.code);
      this.pressedMods.set(e.code, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey });
    }
    this.down.add(e.code);
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ'].includes(e.code) && this.enabled) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
    this.released.add(e.code);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.isTouch) return; // touch devices use the virtual channel
    if (!this.isGameTarget(e.target)) return;
    this.buttonsDown.add(e.button);
    this.buttonsPressed.add(e.button);
    this.buttonDownStamp.set(e.button, e.timeStamp);
    const rect = this.target.getBoundingClientRect();
    this.buttonDownPos.set(e.button, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (this.fallbackLook) this.fallbackActive = true;
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (this.isTouch) return;
    if (this.buttonsDown.has(e.button)) {
      this.buttonsReleased.add(e.button);
      this.buttonHeld.set(e.button, e.timeStamp - (this.buttonDownStamp.get(e.button) ?? e.timeStamp));
      const rect = this.target.getBoundingClientRect();
      this.buttonUpPos.set(e.button, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    this.buttonsDown.delete(e.button);
  };

  /** Cursor position (canvas space) where a button went down / came up, from the events themselves. */
  buttonDownAt(b: number): { x: number; y: number } {
    return this.buttonDownPos.get(b) ?? { x: this.cursorX, y: this.cursorY };
  }
  buttonUpAt(b: number): { x: number; y: number } {
    return this.buttonUpPos.get(b) ?? { x: this.cursorX, y: this.cursorY };
  }

  /** How long a mouse button has been (or was, at release) held, from hardware event timestamps (ms). */
  buttonHeldMs(b: number): number {
    if (this.buttonsDown.has(b)) return performance.now() - (this.buttonDownStamp.get(b) ?? performance.now());
    return this.buttonHeld.get(b) ?? 0;
  }

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.target.getBoundingClientRect();
    this.cursorX = e.clientX - rect.left;
    this.cursorY = e.clientY - rect.top;
    if (this.pointerLocked || (this.fallbackLook && this.fallbackActive)) {
      // Raw deltas, uncapped: a fast flick on a high-DPI mouse arrives as one large coalesced event and
      // must turn the view all the way. Only the bogus jump some browsers emit right after locking is dropped.
      if (performance.now() - this.lockedAt < 40) return;
      if (Math.abs(e.movementX) > 4000 || Math.abs(e.movementY) > 4000) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    if (!this.isGameTarget(e.target)) return;
    if (this.enabled) e.preventDefault();
    this.wheel += Math.sign(e.deltaY);
  };

  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.target;
    this.lockRequested = false;
    if (this.pointerLocked) {
      this.lockErrors = 0;
      this.lockedAt = performance.now();
      this.fallbackLook = false;
    }
    this.onLockChange?.(this.pointerLocked);
  };

  private onPointerLockError = (): void => {
    this.lockRequested = false;
    this.lockErrors++;
    // One failed request is normal (a lock asked for too soon after Escape). Only when the page can
    // never lock the pointer, as inside an embedding frame without permission, do we switch to
    // the raw-delta fallback for good.
    if (this.lockErrors >= 3 || this.lockDenied()) {
      this.fallbackLook = true;
      this.fallbackActive = true;
      this.onLockChange?.(true);
    }
  };

  /** True when the embedding page's permission policy forbids pointer lock. */
  private lockDenied(): boolean {
    try {
      const fp = (document as Document & { featurePolicy?: { allowsFeature(name: string): boolean } }).featurePolicy;
      if (fp && !fp.allowsFeature('pointer-lock')) return true;
    } catch {
      /* not supported: assume allowed */
    }
    return false;
  }

  requestPointerLock(): void {
    if (this.isTouch) {
      this.onLockChange?.(true);
      return;
    }
    if (this.pointerLocked) return;
    // A request that never answered (no change, no error) must not block the next one.
    if (this.lockRequested && performance.now() - this.lockRequestedAt < 1000) return;
    if (this.fallbackLook || this.lockDenied()) {
      this.fallbackLook = true;
      this.fallbackActive = true;
      this.onLockChange?.(true);
      return;
    }
    try {
      this.lockRequested = true;
      this.lockRequestedAt = performance.now();
      const p = (this.target as HTMLElement & { requestPointerLock(opts?: { unadjustedMovement?: boolean }): Promise<void> | void }).requestPointerLock({ unadjustedMovement: true });
      if (p && typeof (p as Promise<void>).catch === 'function') {
        (p as Promise<void>).catch(() => {
          // Retry without unadjusted movement, then fall back.
          try {
            const p2 = this.target.requestPointerLock() as unknown as Promise<void> | void;
            if (p2 && typeof (p2 as Promise<void>).catch === 'function') (p2 as Promise<void>).catch(() => this.onPointerLockError());
          } catch {
            this.onPointerLockError();
          }
        });
      }
    } catch {
      this.onPointerLockError();
    }
  }

  exitPointerLock(): void {
    if (this.pointerLocked) document.exitPointerLock();
    this.fallbackActive = false;
  }

  /** True when the game currently has look control. */
  get looking(): boolean {
    return this.isTouch || this.pointerLocked || (this.fallbackLook && this.fallbackActive);
  }

  isDown(code: string): boolean {
    return this.enabled && this.down.has(code);
  }
  wasPressed(code: string): boolean {
    return this.enabled && this.pressed.has(code);
  }
  /** Modifier flags captured by the key's own event, so a modifier released before the frame still counts. */
  modsOf(code: string): { ctrl: boolean; shift: boolean; alt: boolean } | null {
    return this.pressedMods.get(code) ?? null;
  }
  wasReleased(code: string): boolean {
    return this.enabled && this.released.has(code);
  }
  /** Raw pressed check ignoring the enabled flag (for menus). */
  wasPressedRaw(code: string): boolean {
    return this.pressed.has(code);
  }
  buttonDown(b: number): boolean {
    return this.enabled && this.buttonsDown.has(b);
  }
  buttonPressed(b: number): boolean {
    return this.enabled && this.buttonsPressed.has(b);
  }
  buttonReleased(b: number): boolean {
    return this.enabled && this.buttonsReleased.has(b);
  }

  // ---------- unified game queries (keyboard/mouse + virtual) ----------
  private clamp1(v: number): number {
    return v < -1 ? -1 : v > 1 ? 1 : v;
  }
  moveX(): number {
    if (!this.enabled) return 0;
    const k = (this.down.has('KeyD') || this.down.has('ArrowRight') ? 1 : 0) - (this.down.has('KeyA') || this.down.has('ArrowLeft') ? 1 : 0);
    return this.clamp1(k + this.virtual.moveX);
  }
  moveY(): number {
    if (!this.enabled) return 0;
    const k = (this.down.has('KeyW') || this.down.has('ArrowUp') ? 1 : 0) - (this.down.has('KeyS') || this.down.has('ArrowDown') ? 1 : 0);
    return this.clamp1(k + this.virtual.moveY);
  }
  /** Legacy names kept for build-mode camera code. */
  axisX(): number {
    return this.moveX();
  }
  axisY(): number {
    return this.moveY();
  }
  /** Look delta in pixels for this frame (mouse when looking, plus touch drag). */
  lookDX(): number {
    if (!this.enabled) return 0;
    return (this.looking ? this.mouseDX : 0) + this.virtual.lookDX;
  }
  lookDY(): number {
    if (!this.enabled) return 0;
    return (this.looking ? this.mouseDY : 0) + this.virtual.lookDY;
  }
  fireHeld(): boolean {
    return this.enabled && (this.buttonsDown.has(0) || this.virtual.fire);
  }
  firePressed(): boolean {
    return this.enabled && (this.buttonsPressed.has(0) || this.virtual.firePressed);
  }
  fireReleased(): boolean {
    return this.enabled && (this.buttonsReleased.has(0) || this.virtual.fireReleased);
  }
  jumpPressed(): boolean {
    return this.enabled && (this.pressed.has('Space') || this.virtual.jump);
  }
  jumpHeld(): boolean {
    return this.enabled && (this.down.has('Space') || this.virtual.jumpHeld);
  }
  sprintHeld(): boolean {
    return this.enabled && (this.down.has('ShiftLeft') || this.down.has('ShiftRight') || this.virtual.sprint);
  }
  crouchHeld(): boolean {
    return this.enabled && (this.down.has('KeyC') || this.down.has('ControlLeft') || this.virtual.crouch);
  }
  adsHeld(): boolean {
    return this.enabled && (this.buttonsDown.has(2) || this.virtual.ads);
  }
  reloadPressed(): boolean {
    return this.enabled && (this.pressed.has('KeyR') || this.virtual.reload);
  }
  grenadePressed(): boolean {
    return this.enabled && (this.pressed.has('KeyG') || this.virtual.grenade);
  }
  /** Gadget slots: Q is slot 0, F is slot 1 (touch: the two gadget buttons). */
  gadgetPressed(i: number): boolean {
    return this.enabled && (this.pressed.has(GADGET_KEYS[i]) || this.virtual.gadget[i]);
  }
  gadgetHeld(i: number): boolean {
    return this.enabled && (this.down.has(GADGET_KEYS[i]) || this.virtual.gadgetHeld[i]);
  }
  gadgetReleased(i: number): boolean {
    return this.enabled && (this.released.has(GADGET_KEYS[i]) || this.virtual.gadgetReleased[i]);
  }
  interactPressed(): boolean {
    return this.enabled && (this.pressed.has('KeyE') || this.virtual.interact);
  }
  /** Weapon switch request: -1 none, 0..2 slot, 100 = next, 101 = previous. */
  weaponSwitch(): number {
    if (!this.enabled) return -1;
    if (this.pressed.has('Digit1')) return 0;
    if (this.pressed.has('Digit2')) return 1;
    if (this.pressed.has('Digit3')) return 2;
    if (this.wheel > 0) return 100;
    if (this.wheel < 0) return 101;
    return this.virtual.weaponSwitch;
  }

  endFrame(): void {
    this.pressed.clear();
    this.pressedMods.clear();
    this.released.clear();
    this.buttonsPressed.clear();
    this.buttonsReleased.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    const v = this.virtual;
    v.lookDX = 0;
    v.lookDY = 0;
    v.firePressed = false;
    v.fireReleased = false;
    v.jump = false;
    v.reload = false;
    v.grenade = false;
    v.gadget[0] = v.gadget[1] = false;
    v.gadgetReleased[0] = v.gadgetReleased[1] = false;
    v.interact = false;
    v.weaponSwitch = -1;
    v.primary = false;
    v.secondary = false;
    v.zoom = 0;
    v.panX = 0;
    v.panY = 0;
    v.tapped = false;
    v.longPress = false;
  }

  clearAll(): void {
    this.down.clear();
    this.buttonsDown.clear();
    Object.assign(this.virtual, freshVirtual());
    this.endFrame();
  }
}
