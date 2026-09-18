// Keyboard / mouse / pointer-lock handling. Gameplay code polls state; UI subscribes to events.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();     // keys pressed this frame
    this.released = new Set();
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, wheel: 0, buttons: 0, left: false, right: false, middle: false };
    this.clicks = [];             // {button, x, y} this frame
    this.mouseUps = [];
    this.locked = false;
    this.wantLock = false;
    this.enabled = true;
    this.listeners = {};

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const c = e.code;
      this.keys.add(c);
      this.pressed.add(c);
      this.emit('keydown', c, e);
      if (['Tab', 'Space', 'KeyF', 'KeyQ', 'KeyR', 'KeyE', 'KeyG', 'KeyC'].includes(c) && this.enabled) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = this.mouse.middle = false; this.mouse.buttons = 0; });

    document.addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    });
    document.addEventListener('mousedown', (e) => {
      if (e.target !== canvas && !canvas.contains(e.target)) return;
      this.mouse.buttons = e.buttons;
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 1) this.mouse.middle = true;
      if (e.button === 2) this.mouse.right = true;
      this.clicks.push({ button: e.button, x: e.clientX, y: e.clientY, shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey });
      this.emit('mousedown', e);
      if (this.wantLock && !this.locked) this.lock();
    });
    document.addEventListener('mouseup', (e) => {
      this.mouse.buttons = e.buttons;
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 1) this.mouse.middle = false;
      if (e.button === 2) this.mouse.right = false;
      this.mouseUps.push({ button: e.button, x: e.clientX, y: e.clientY });
      this.emit('mouseup', e);
    });
    document.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('contextmenu', (e) => { if (e.target === canvas) e.preventDefault(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.emit('lockchange', this.locked);
    });
    document.addEventListener('pointerlockerror', () => { this.locked = false; this.emit('lockerror'); });
  }

  on(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name, ...args) { for (const fn of this.listeners[name] || []) fn(...args); }

  lock() {
    this.wantLock = true;
    if (typeof window !== 'undefined' && window.__VANTAGE_NOLOCK) { if (!this.locked) { this.locked = true; this.emit('lockchange', true); } return; }
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { this.canvas.requestPointerLock(); } catch (e) { /* ignore */ } });
    } catch (e) {
      try { this.canvas.requestPointerLock(); } catch (e2) { /* ignore */ }
    }
  }
  unlock() { this.wantLock = false; if (typeof window !== 'undefined' && window.__VANTAGE_NOLOCK) { if (this.locked) { this.locked = false; this.emit('lockchange', false); } return; } if (document.pointerLockElement) document.exitPointerLock(); }

  down(code) { return this.keys.has(code); }
  justPressed(code) { return this.pressed.has(code); }
  justReleased(code) { return this.released.has(code); }
  axis(neg, pos) { return (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0); }

  // Called at the end of every frame.
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
    this.clicks.length = 0; this.mouseUps.length = 0;
  }
}
