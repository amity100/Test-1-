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
    this.softLook = false;        // fallback: mouse deltas without pointer lock (sandboxed iframes)
    this.lockFailures = 0; this._attempt = 0; this._failedAttempt = -1;
    this.enabled = true;
    this.listeners = {};
    // touch controls (phones): an analog stick, drag-to-look deltas and one-frame taps come from TouchControls
    this.touch = false;
    this.touchMove = { x: 0, y: 0 };
    this.touchSprint = false;
    this.tapFire = false;

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
      if (this.touch) return;
      if (this.locked || this.softLook) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    });
    document.addEventListener('mousedown', (e) => {
      if (this.touch) return;   // phones: synthetic mouse events would double every tap
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
      if (this.touch) return;
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
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) { clearTimeout(this._lockTimer); this.lockFailures = 0; }
      else if (was) this._lastUnlock = performance.now();
      this.emit('lockchange', this.locked);
    });
    document.addEventListener('pointerlockerror', () => { this.locked = false; if (this._attempt > 0) { const a = this._attempt; const unadjustedRetryPending = false; if (!unadjustedRetryPending) this._attemptFailed(a); } });
  }

  on(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name, ...args) { for (const fn of this.listeners[name] || []) fn(...args); }

  // True when mouse deltas should drive the camera (real pointer lock, the soft fallback, or touch).
  get looking() { return this.locked || this.softLook || this.touch; }
  // Movement axes: keys plus the touch stick. Returns [strafe, forward] in -1..1.
  move() {
    let mx = this.axis('KeyA', 'KeyD'), mz = this.axis('KeyS', 'KeyW');
    if (this.touch) { mx += this.touchMove.x; mz += this.touchMove.y; }
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    return [mx, mz];
  }
  get sprint() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchSprint; }

  lock() {
    this.wantLock = true;
    if ((typeof window !== 'undefined' && window.__VANTAGE_NOLOCK) || this.touch) { if (!this.locked) { this.locked = true; this.emit('lockchange', true); } return; }
    if (this.softLook) { this.emit('lockchange', true); return; }
    if (this.locked) return;
    if (!this.canvas.requestPointerLock) { this._attemptFailed(); return; }
    // Chrome refuses a new lock for ~1.25s after the user pressed Esc; wait that out (still inside the gesture window)
    const wait = Math.max(0, 1300 - (performance.now() - (this._lastUnlock || -1e9)));
    clearTimeout(this._pendingLock);
    this._pendingLock = setTimeout(() => this._requestLock(true), wait);
  }
  _requestLock(unadjusted) {
    if (this.locked || this.softLook) return;
    const attempt = ++this._attempt;
    const onReject = () => { if (this._attempt !== attempt || this.locked) return; if (unadjusted) this._requestLock(false); else this._attemptFailed(attempt); };
    try {
      const p = unadjusted ? this.canvas.requestPointerLock({ unadjustedMovement: true }) : this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(onReject);
    } catch (e) { onReject(); return; }
    clearTimeout(this._lockTimer);
    this._lockTimer = setTimeout(() => { if (!this.locked && this._attempt === attempt) this._attemptFailed(attempt); }, 1200);
  }
  _attemptFailed(attempt) {
    if (attempt !== undefined && attempt === this._failedAttempt) return; // already counted (event + rejection)
    this._failedAttempt = attempt;
    this.lockFailures++;
    if (this.lockFailures >= 2 && !this.softLook) { this.softLook = true; this.emit('softlook'); this.emit('lockchange', true); }
    else this.emit('lockerror');
  }
  unlock() {
    this.wantLock = false; clearTimeout(this._lockTimer); clearTimeout(this._pendingLock);
    if ((typeof window !== 'undefined' && window.__VANTAGE_NOLOCK) || this.touch) { if (this.locked) { this.locked = false; this.emit('lockchange', false); } return; }
    if (this.softLook) { this.emit('lockchange', false); return; }
    this._lastUnlock = performance.now();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  // -1..1 horizontal / vertical edge push of the visible cursor (soft-look turning aid)
  edgeTurn() {
    if (!this.softLook) return [0, 0];
    const w = window.innerWidth, h = window.innerHeight, m = 0.14;
    const x = this.mouse.x / w, y = this.mouse.y / h;
    const ex = x > 1 - m ? (x - (1 - m)) / m : x < m ? -(m - x) / m : 0;
    const ey = y > 1 - m ? (y - (1 - m)) / m : y < m ? -(m - y) / m : 0;
    return [Math.max(-1, Math.min(1, ex)), Math.max(-1, Math.min(1, ey))];
  }

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
    this.tapFire = false;
  }
}
