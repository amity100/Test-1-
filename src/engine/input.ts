import type { Action } from '../core/contracts';
import { setDevice, type Device } from '../ui/i18n';

export type { Action };
export type InputDevice = Device;

/** Look speeds (radians per pixel for mouse/touch, radians per second at full stick for pads). */
export const LOOK = {
  mouse: 0.0022,
  touch: 0.0052,
  pad: 3.2,
  /** Pad look is slowed while aiming. */
  padAimScale: 0.55,
};

/**
 * Unified input for keyboard + mouse, gamepad and touch. Systems read intent
 * (move vector, look delta, actions) and never care which device made it.
 *
 * Desktop: LMB = PORTAL (press: the entrance; hold: aim the exit in slow
 * motion; release: the exit). While it's held: RMB cancels, wheel = exit
 * distance, G flips hatch / door. STRIKES: RMB (or 1) REFLECT, Q (2) LOOP,
 * E (3) SWAP, R (4) DASH; mouse back / forward = SWAP / DASH. X / MMB close
 * your rifts; F action; Space jump; Shift sprint; C crouch; V shove; Tab
 * vision; T clip; K photo; Esc / P pause.
 *
 * Gamepad (standard mapping): RT PORTAL (held: LT cancels, Y flips, D-pad
 * left/right exit distance); LT REFLECT, Y LOOP, D-pad left/right SWAP /
 * DASH; LB close, RB shove, A jump, X action, B crouch, L3 sprint (latches
 * until the stick is released), D-pad down vision, D-pad up photo, View
 * clip, Start pause; right stick look, left stick move.
 */
export class Input {
  moveX = 0;
  moveY = 0;
  lookX = 0;
  lookY = 0;
  /** Air distance steps (wheel up / D-pad right = +1). Read with consumeWheel(). */
  wheel = 0;
  private held = new Set<Action>();
  private pressed = new Set<Action>();
  private released = new Set<Action>();
  private keys = new Set<string>();
  pointerLocked = false;
  /** Pointer lock unavailable (e.g. sandboxed iframe): read raw mouse deltas instead. */
  freeMouse = false;
  /** The game is running (mouse buttons count without pointer lock when freeMouse). */
  active = false;
  sensitivity = 1;
  invertY = false;
  enabled = true;
  /** Touch UI writes here. */
  touchMove = { x: 0, y: 0 };
  /** Called when the last used device changes (i18n device variants are switched automatically). */
  onDeviceChange: ((d: Device) => void) | null = null;

  private device: Device = 'kbm';
  /** What RMB pressed (REFLECT, or nothing when it cancelled a held PORTAL), so its release ends the same action. */
  private rmbAction: Action | null = null;
  private padPrev: boolean[] = [];
  /** Per pad button: the action its press started (the dual-use ones), so its release ends it. */
  private padHeld: (Action | null)[] = [];
  private padSprint = false;

  private keyMap: Record<string, Action> = {
    Space: 'jump',
    ShiftLeft: 'sprint',
    ShiftRight: 'sprint',
    KeyC: 'crouch',
    KeyV: 'shove',
    KeyG: 'flip',
    KeyX: 'close',
    KeyF: 'action',
    Tab: 'vision',
    KeyT: 'clip',
    KeyK: 'photo',
    Escape: 'pause',
    KeyP: 'pause',
    // the STRIKES
    Digit1: 'strike1',
    Digit2: 'strike2',
    KeyQ: 'strike2',
    Digit3: 'strike3',
    KeyE: 'strike3',
    Digit4: 'strike4',
    KeyR: 'strike4',
  };

  constructor(private canvas: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code === 'AltLeft') e.preventDefault();
      if (e.repeat) return;
      this.lastDevice = 'kbm';
      this.keys.add(e.code);
      const a = this.keyMap[e.code];
      if (a) this.down(a);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const a = this.keyMap[e.code];
      if (a) this.up(a);
    });
    window.addEventListener('blur', () => this.releaseAll());
    canvas.addEventListener('mousedown', (e) => {
      if (!this.mouseLive()) return;
      this.lastDevice = 'kbm';
      if (e.button === 0) this.down('portal');
      else if (e.button === 2) {
        // with the PORTAL in hand it lets go of it; otherwise it's REFLECT
        if (this.held.has('portal')) {
          this.tap('close');
          this.rmbAction = null;
        } else {
          this.rmbAction = 'strike1';
          this.down('strike1');
        }
      } else if (e.button === 1) {
        e.preventDefault();
        this.down('close');
      } else if (e.button === 3) this.tap('strike3'); // mouse back: SWAP
      else if (e.button === 4) this.tap('strike4'); // mouse forward: DASH
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.up('portal');
      else if (e.button === 2) {
        if (this.rmbAction) this.up(this.rmbAction);
        this.rmbAction = null;
      } else if (e.button === 1) this.up('close');
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.mouseLive() || !this.enabled) return;
      this.lookX += e.movementX * LOOK.mouse * this.sensitivity;
      this.lookY += e.movementY * LOOK.mouse * this.sensitivity * (this.invertY ? -1 : 1);
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.mouseLive()) return;
        this.wheel += -Math.sign(e.deltaY);
      },
      { passive: true },
    );
    document.addEventListener('pointerlockerror', () => {
      this.freeMouse = true;
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      if (!this.pointerLocked) for (const a of [...this.held]) this.up(a);
    });
    setDevice(this.device);
  }

  get lastDevice(): Device {
    return this.device;
  }

  set lastDevice(d: Device) {
    if (d === this.device) return;
    this.device = d;
    setDevice(d);
    this.onDeviceChange?.(d);
  }

  private mouseLive() {
    return this.pointerLocked || (this.freeMouse && this.active);
  }

  requestLock() {
    if (this.device === 'touch') return;
    const el = this.canvas as HTMLElement & { requestPointerLock?: (o?: unknown) => unknown };
    if (!el.requestPointerLock) {
      this.freeMouse = true;
      return;
    }
    const fail = () => (this.freeMouse = true);
    try {
      const p = el.requestPointerLock({ unadjustedMovement: true }) as Promise<void> | undefined;
      if (p && typeof p.catch === 'function')
        p.catch(() => {
          try {
            const p2 = el.requestPointerLock!() as Promise<void> | undefined;
            if (p2 && typeof p2.catch === 'function') p2.catch(fail);
          } catch {
            fail();
          }
        });
    } catch {
      fail();
    }
  }

  down(a: Action) {
    if (!this.held.has(a)) this.pressed.add(a);
    this.held.add(a);
  }

  up(a: Action) {
    if (this.held.has(a)) this.released.add(a);
    this.held.delete(a);
  }

  /** Press and release in the same frame. */
  tap(a: Action) {
    this.pressed.add(a);
    this.released.add(a);
  }

  isHeld(a: Action) {
    return this.held.has(a);
  }
  wasPressed(a: Action) {
    return this.pressed.has(a);
  }
  wasReleased(a: Action) {
    return this.released.has(a);
  }

  /** Release every held action and key (pause, blur, respawn). */
  releaseAll() {
    this.keys.clear();
    for (const a of [...this.held]) this.up(a);
    this.rmbAction = null;
    this.padHeld.length = 0;
    this.padSprint = false;
    this.touchMove.x = this.touchMove.y = 0;
  }

  /** Call once per frame before systems read input. */
  poll(dt: number) {
    let mx = 0,
      my = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) my += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) my -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (Math.abs(this.touchMove.x) + Math.abs(this.touchMove.y) > 0.01) {
      mx = this.touchMove.x;
      my = this.touchMove.y;
    }
    this.pollPad(dt, (x, y) => {
      if (Math.abs(x) + Math.abs(y) > 0) {
        mx = x;
        my = y;
      }
    });
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    this.moveX = mx;
    this.moveY = my;
  }

  private pollPad(dt: number, setMove: (x: number, y: number) => void) {
    const pads = typeof navigator !== 'undefined' ? navigator.getGamepads?.() : null;
    if (!pads) return;
    let p: Gamepad | null = null;
    for (const g of pads) if (g && g.connected) { p = g; break; }
    if (!p) return;
    const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
    const lx = dz(p.axes[0] ?? 0),
      ly = dz(p.axes[1] ?? 0),
      rx = dz(p.axes[2] ?? 0),
      ry = dz(p.axes[3] ?? 0);
    const btn = (i: number) => !!p!.buttons[i] && (p!.buttons[i].pressed || p!.buttons[i].value > 0.4);
    let anyBtn = false;
    for (let i = 0; i < p.buttons.length; i++) if (btn(i)) { anyBtn = true; break; }
    if (anyBtn || Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) > 0) this.lastDevice = 'pad';
    if (this.device !== 'pad') return;
    setMove(lx, -ly);
    const speed = LOOK.pad * (this.held.has('portal') ? LOOK.padAimScale : 1) * this.sensitivity;
    this.lookX += Math.sign(rx) * rx * rx * speed * dt;
    this.lookY += Math.sign(ry) * ry * ry * speed * dt * 0.7 * (this.invertY ? -1 : 1);

    const edge = (i: number, on: (() => void) | null, off: (() => void) | null) => {
      const b = btn(i);
      if (b && !this.padPrev[i]) on?.();
      else if (!b && this.padPrev[i]) off?.();
      this.padPrev[i] = b;
    };
    const hold = (i: number, a: Action) => edge(i, () => this.down(a), () => this.up(a));
    // a button that means one thing with the PORTAL in hand and another without
    const dual = (i: number, withPortal: () => void, a: Action) =>
      edge(
        i,
        () => {
          if (this.held.has('portal')) {
            withPortal();
            this.padHeld[i] = null;
          } else {
            this.padHeld[i] = a;
            this.down(a);
          }
        },
        () => {
          const was = this.padHeld[i];
          if (was) this.up(was);
          this.padHeld[i] = null;
        },
      );
    hold(7, 'portal'); // RT
    dual(6, () => this.tap('close'), 'strike1'); // LT: REFLECT (cancels a held PORTAL)
    dual(3, () => this.tap('flip'), 'strike2'); // Y: LOOP (flips a held PORTAL's exit)
    dual(14, () => (this.wheel -= 1), 'strike3'); // D-pad left: SWAP (exit nearer)
    dual(15, () => (this.wheel += 1), 'strike4'); // D-pad right: DASH (exit further)
    hold(4, 'close'); // LB
    hold(5, 'shove'); // RB
    hold(0, 'jump'); // A
    hold(2, 'action'); // X
    hold(1, 'crouch'); // B
    hold(13, 'vision'); // D-pad down
    hold(12, 'photo'); // D-pad up
    hold(8, 'clip'); // View / Back
    hold(9, 'pause'); // Start
    // L3 latches sprint until pressed again or the stick is let go
    edge(
      10,
      () => {
        this.padSprint = !this.padSprint;
        if (this.padSprint) this.down('sprint');
        else this.up('sprint');
      },
      null,
    );
    if (this.padSprint && Math.hypot(lx, ly) < 0.2) {
      this.padSprint = false;
      this.up('sprint');
    }
  }

  consumeLook() {
    const x = this.lookX,
      y = this.lookY;
    this.lookX = 0;
    this.lookY = 0;
    return { x, y };
  }

  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }
}
