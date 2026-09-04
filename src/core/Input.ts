/** Keyboard + mouse input with pointer lock and a graceful fallback when locking is unavailable. */
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

  constructor(private target: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    target.addEventListener('wheel', this.onWheel, { passive: false });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('pointerlockerror', this.onPointerLockError);
    window.addEventListener('blur', () => this.clearAll());
    if (!('requestPointerLock' in target)) this.fallbackLook = true;
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
    this.buttonsDown.add(e.button);
    this.buttonsPressed.add(e.button);
    if (this.fallbackLook) this.fallbackActive = true;
  };

  private onMouseUp = (e: MouseEvent): void => {
    this.buttonsDown.delete(e.button);
    this.buttonsReleased.add(e.button);
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
    return this.pointerLocked || (this.fallbackLook && this.fallbackActive);
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

  /** Movement axis helpers. */
  axisX(): number {
    return (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0) - (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
  }
  axisY(): number {
    return (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0) - (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0);
  }

  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
    this.buttonsPressed.clear();
    this.buttonsReleased.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }

  clearAll(): void {
    this.down.clear();
    this.buttonsDown.clear();
    this.endFrame();
  }
}
