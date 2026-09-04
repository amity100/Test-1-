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
  grapple: boolean;
  grappleReleased: boolean;
  interact: boolean;
  /** -1 none, 0..2 slot, 100 next weapon. */
  weaponSwitch: number;
  primary: boolean;
  secondary: boolean;
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
    reload: false, grenade: false, grapple: false, grappleReleased: false, interact: false,
    weaponSwitch: -1, primary: false, secondary: false, zoom: 0, panX: 0, panY: 0,
    tapped: false, tapX: 0, tapY: 0, longPress: false, heightDir: 0,
  };
}

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
  private buttonsDown = new Set<number>();
  private buttonsPressed = new Set<number>();
  private buttonsReleased = new Set<number>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  /** Cursor position in CSS pixels relative to the target. */
  cursorX = 0;
  cursorY = 0;
  pointerLocked = false;
  /** True when pointer lock is not available and we look with raw mouse deltas instead. */
  fallbackLook = false;
  fallbackActive = false;
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
    if (!this.down.has(e.code)) this.pressed.add(e.code);
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
    if (this.fallbackLook) this.fallbackActive = true;
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (this.isTouch) return;
    if (this.buttonsDown.has(e.button)) this.buttonsReleased.add(e.button);
    this.buttonsDown.delete(e.button);
  };

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.target.getBoundingClientRect();
    this.cursorX = e.clientX - rect.left;
    this.cursorY = e.clientY - rect.top;
    if (this.pointerLocked || (this.fallbackLook && this.fallbackActive)) {
      // Clamp absurd deltas some browsers emit on lock transitions.
      const dx = Math.max(-200, Math.min(200, e.movementX));
      const dy = Math.max(-200, Math.min(200, e.movementY));
      this.mouseDX += dx;
      this.mouseDY += dy;
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
    this.onLockChange?.(this.pointerLocked);
  };

  private onPointerLockError = (): void => {
    this.lockRequested = false;
    this.fallbackLook = true;
    this.fallbackActive = true;
    // We still have look control through raw mouse deltas.
    this.onLockChange?.(true);
  };

  requestPointerLock(): void {
    if (this.isTouch) {
      this.onLockChange?.(true);
      return;
    }
    if (this.pointerLocked || this.lockRequested) return;
    if (this.fallbackLook) {
      this.fallbackActive = true;
      this.onLockChange?.(true);
      return;
    }
    try {
      this.lockRequested = true;
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
  grapplePressed(): boolean {
    return this.enabled && (this.pressed.has('KeyQ') || this.virtual.grapple);
  }
  grappleReleased(): boolean {
    return this.enabled && (this.released.has('KeyQ') || this.virtual.grappleReleased);
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
    v.grapple = false;
    v.grappleReleased = false;
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
