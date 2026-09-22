import { FEEL } from '../config';

export type Action =
  | 'aim' | 'open' | 'interact' | 'crouch' | 'sprint' | 'jump' | 'anchor' | 'close'
  | 'rotL' | 'rotR' | 'nearer' | 'farther' | 'freeAim' | 'pause' | 'tactical' | 'dive';

/**
 * Unified input for keyboard+mouse, gamepad and touch. Systems read intent
 * (move vector, look delta, actions) and never care which device produced it.
 */
export class Input {
  moveX = 0;
  moveY = 0;
  lookX = 0;
  lookY = 0;
  wheel = 0;
  private held = new Set<Action>();
  private pressed = new Set<Action>();
  private released = new Set<Action>();
  private keys = new Set<string>();
  pointerLocked = false;
  /** Pointer lock unavailable (e.g. sandboxed iframe): read raw mouse deltas instead. */
  freeMouse = false;
  active = false;
  lastDevice: 'kbm' | 'pad' | 'touch' = 'kbm';
  sensitivity = 1;
  invertY = false;
  enabled = true;
  /** Touch UI writes here. */
  touchMove = { x: 0, y: 0 };
  private padPrev: boolean[] = [];

  private keyMap: Record<string, Action> = {
    KeyC: 'crouch', ControlLeft: 'crouch', ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump',
    KeyF: 'interact', KeyE: 'rotR', KeyQ: 'rotL', KeyR: 'anchor', KeyX: 'close', AltLeft: 'freeAim',
    Escape: 'pause', KeyP: 'pause', Tab: 'tactical', KeyG: 'dive',
  };

  constructor(private canvas: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'AltLeft' || e.code === 'Space') e.preventDefault();
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
    window.addEventListener('blur', () => {
      this.keys.clear();
      for (const a of [...this.held]) this.up(a);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.pointerLocked && !(this.freeMouse && this.active)) return;
      this.lastDevice = 'kbm';
      if (e.button === 2) this.down('aim');
      if (e.button === 0) this.down('open');
      if (e.button === 1) this.down('close');
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.up('aim');
      if (e.button === 0) this.up('open');
      if (e.button === 1) this.up('close');
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!(this.pointerLocked || (this.freeMouse && this.active)) || !this.enabled) return;
      this.lookX += e.movementX * FEEL.lookSensitivity * this.sensitivity;
      this.lookY += e.movementY * FEEL.lookSensitivity * this.sensitivity * (this.invertY ? -1 : 1);
    });
    window.addEventListener('wheel', (e) => {
      if (!this.pointerLocked && !(this.freeMouse && this.active)) return;
      this.wheel += Math.sign(e.deltaY) * -1;
    }, { passive: true });
    document.addEventListener('pointerlockerror', () => {
      this.freeMouse = true;
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      if (!this.pointerLocked) for (const a of [...this.held]) this.up(a);
    });
  }

  requestLock() {
    if (this.lastDevice === 'touch') return;
    const el = this.canvas as any;
    if (!el.requestPointerLock) {
      this.freeMouse = true;
      return;
    }
    try {
      const p = el.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch)
        p.catch(() => {
          try {
            const p2 = el.requestPointerLock();
            if (p2 && p2.catch) p2.catch(() => (this.freeMouse = true));
          } catch {
            this.freeMouse = true;
          }
        });
    } catch {
      this.freeMouse = true;
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

  tap(a: Action) {
    this.pressed.add(a);
    this.released.add(a);
  }

  isHeld(a: Action) { return this.held.has(a); }
  wasPressed(a: Action) { return this.pressed.has(a); }
  wasReleased(a: Action) { return this.released.has(a); }

  /** Call once per frame before systems read input. */
  poll(dt: number) {
    let mx = 0, my = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) my += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) my -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (Math.abs(this.touchMove.x) + Math.abs(this.touchMove.y) > 0.01) {
      mx = this.touchMove.x;
      my = this.touchMove.y;
    }
    this.pollPad(dt, (x, y) => { if (Math.abs(x) + Math.abs(y) > 0) { mx = x; my = y; } });
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.moveX = mx;
    this.moveY = my;
  }

  private pollPad(dt: number, setMove: (x: number, y: number) => void) {
    const pads = navigator.getGamepads?.();
    if (!pads) return;
    const p = [...pads].find((g) => g && g.connected);
    if (!p) return;
    const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
    const lx = dz(p.axes[0] ?? 0), ly = dz(p.axes[1] ?? 0), rx = dz(p.axes[2] ?? 0), ry = dz(p.axes[3] ?? 0);
    const btn = (i: number) => !!p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.4);
    const any = Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) > 0 || p.buttons.some((b) => b.pressed);
    if (any) this.lastDevice = 'pad';
    if (this.lastDevice !== 'pad') return;
    setMove(lx, -ly);
    const aiming = this.held.has('aim');
    const speed = FEEL.padLookSpeed * (aiming ? 0.55 : 1) * this.sensitivity;
    this.lookX += Math.sign(rx) * rx * rx * speed * dt;
    this.lookY += Math.sign(ry) * ry * ry * speed * dt * 0.7 * (this.invertY ? -1 : 1);
    const map: [number, Action][] = [
      [6, 'aim'], [7, 'open'], [2, 'interact'], [1, 'crouch'], [10, 'sprint'], [0, 'jump'],
      [3, 'anchor'], [4, 'nearer'], [5, 'farther'], [14, 'rotL'], [15, 'rotR'], [9, 'pause'], [8, 'tactical'], [11, 'close'],
      [12, 'farther'], [13, 'nearer'],
    ];
    for (const [i, a] of map) {
      const b = btn(i);
      if (b && !this.padPrev[i]) {
        if (a === 'nearer') this.wheel -= 1;
        else if (a === 'farther') this.wheel += 1;
        else this.down(a);
      } else if (!b && this.padPrev[i] && a !== 'nearer' && a !== 'farther') this.up(a);
      this.padPrev[i] = b;
    }
  }

  consumeLook() {
    const x = this.lookX, y = this.lookY;
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
