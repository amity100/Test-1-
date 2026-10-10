// Keyboard + mouse (pointer lock, with a drag fallback) + touch (virtual stick, look pad, buttons).

export class Input {
  constructor(canvas, touch) {
    this.canvas = canvas;
    this.touch = touch;
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered this frame
    this.lookDX = 0;
    this.lookDY = 0;
    this.fire = false;
    this.firePressed = false;
    this.aim = false;
    this.wheel = 0;
    this.move = { x: 0, y: 0 }; // x right, y forward
    this.sensitivity = 1;
    this.invertY = false;
    this.pad = null; // { x, y, sprint } from a gamepad
    this.flyUp = false;
    this.flyDown = false;
    this.enabled = false;
    this.locked = false;
    this.lockFailed = false;
    this.dragging = false;
    this.skipMoves = 0;
    this.lockRequest = null;
    this.lockFailures = 0;
    this.buttons = {};
    this.listeners = [];
    this._bind();
  }

  on(type, fn) {
    this.listeners.push([type, fn]);
  }

  emit(type, data) {
    for (const [t, fn] of this.listeners) if (t === type) fn(data);
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.code;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(k) && this.enabled) e.preventDefault();
      this.keys.add(k);
      this.pressed.add(k);
      this.emit('key', k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.fire = false;
      this.aim = false;
    });

    const c = this.canvas;
    c.addEventListener('mousedown', (e) => {
      if (!this.enabled || this.touch) return;
      if (!this.locked && !this.lockFailed) {
        this.requestLock(true);
        if (e.button === 0) return; // first click only locks the pointer
      }
      if (e.button === 0) {
        this.fire = true;
        this.firePressed = true;
      }
      if (e.button === 2) this.aim = true;
      if (!this.locked) this.dragging = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fire = false;
      if (e.button === 2) this.aim = false;
      this.dragging = false;
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled || this.touch) return;
      if (this.locked || this.dragging) {
        const mx = e.movementX || 0;
        const my = e.movementY || 0;
        // browsers report a bogus jump (cursor -> lock point) right after the lock changes,
        // and some mice/drivers produce isolated spikes: drop those instead of spinning the camera
        if (this.skipMoves > 0) {
          this.skipMoves--;
          if (Math.abs(mx) + Math.abs(my) > 40) return;
        }
        if (Math.abs(mx) > 500 || Math.abs(my) > 500) return;
        this.lookDX += mx;
        this.lookDY += my;
      }
    });
    window.addEventListener('wheel', (e) => {
      if (this.enabled) this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === c;
      this.skipMoves = 2;
      this.lockRequest = null;
      if (this.locked) this.lockFailures = 0;
      this.emit('lock', this.locked);
    });
    document.addEventListener('pointerlockerror', () => this.onLockError());
    if (this.touch) this._bindTouch();
  }

  /**
   * gesture: the request comes straight from a click. Requests made later (after a drawing is
   * graded) or right after Esc may be refused by the browser; only repeated refusals of real
   * clicks mean the page can't lock the mouse here (e.g. a sandboxed frame) -> drag-to-look.
   */
  requestLock(gesture = false) {
    if (this.touch || this.lockFailed || this.locked) return;
    if (!this.canvas.requestPointerLock) {
      this.lockFailed = true;
      return;
    }
    if (this.lockRequest && performance.now() - this.lockRequest.t < 1500) return;
    const req = { gesture, t: performance.now() };
    this.lockRequest = req;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => this.onLockError(req));
    } catch (err) {
      this.onLockError(req);
    }
  }

  onLockError(req = this.lockRequest) {
    // Chrome both rejects the promise and fires pointerlockerror: count each request once
    if (!req || req !== this.lockRequest) return;
    this.lockRequest = null;
    if (req.gesture && ++this.lockFailures >= 2) this.lockFailed = true;
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  _bindTouch() {
    const zone = document.getElementById('stick-zone');
    const base = document.getElementById('stick-base');
    const knob = document.getElementById('stick-knob');
    const look = document.getElementById('look-zone');
    let stickId = null;
    let sx = 0;
    let sy = 0;
    const R = 56;
    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      stickId = t.identifier;
      const rect = zone.getBoundingClientRect();
      sx = t.clientX;
      sy = t.clientY;
      base.style.left = `${t.clientX - rect.left}px`;
      base.style.bottom = `${rect.bottom - t.clientY}px`;
      knob.style.transform = 'translate(0px, 0px)';
    }, { passive: false });
    const moveStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickId) continue;
        let dx = t.clientX - sx;
        let dy = t.clientY - sy;
        const l = Math.hypot(dx, dy);
        if (l > R) {
          dx *= R / l;
          dy *= R / l;
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.move.x = dx / R;
        this.move.y = -dy / R;
        this.stickMag = Math.min(1, l / R);
      }
    };
    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      moveStick(e);
    }, { passive: false });
    const endStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickId) continue;
        stickId = null;
        this.move.x = 0;
        this.move.y = 0;
        this.stickMag = 0;
        knob.style.transform = 'translate(0px, 0px)';
      }
    };
    zone.addEventListener('touchend', endStick);
    zone.addEventListener('touchcancel', endStick);

    // look pad (and the fire button doubles as a look pad while held)
    const lookTouches = new Map();
    const startLook = (e, isFire) => {
      for (const t of e.changedTouches) lookTouches.set(t.identifier, { x: t.clientX, y: t.clientY, fire: isFire });
    };
    const moveLook = (e) => {
      for (const t of e.changedTouches) {
        const p = lookTouches.get(t.identifier);
        if (!p) continue;
        this.lookDX += (t.clientX - p.x) * 1.6;
        this.lookDY += (t.clientY - p.y) * 1.6;
        p.x = t.clientX;
        p.y = t.clientY;
      }
    };
    const endLook = (e) => {
      for (const t of e.changedTouches) {
        const p = lookTouches.get(t.identifier);
        if (p && p.fire) this.fire = false;
        lookTouches.delete(t.identifier);
      }
    };
    look.addEventListener('touchstart', (e) => {
      e.preventDefault();
      startLook(e, false);
    }, { passive: false });
    look.addEventListener('touchmove', (e) => {
      e.preventDefault();
      moveLook(e);
    }, { passive: false });
    look.addEventListener('touchend', endLook);
    look.addEventListener('touchcancel', endLook);

    const fireBtn = document.getElementById('btn-fire');
    fireBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.fire = true;
      this.firePressed = true;
      startLook(e, true);
    }, { passive: false });
    fireBtn.addEventListener('touchmove', (e) => {
      e.preventDefault();
      moveLook(e);
    }, { passive: false });
    fireBtn.addEventListener('touchend', (e) => {
      endLook(e);
      this.fire = false;
    });
    fireBtn.addEventListener('touchcancel', (e) => {
      endLook(e);
      this.fire = false;
    });

    const btn = (id, code, hold = false) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        el.classList.add('on');
        if (hold) this.keys.add(code);
        this.pressed.add(code);
        this.emit('key', code);
      }, { passive: false });
      const up = () => {
        el.classList.remove('on');
        if (hold) this.keys.delete(code);
      };
      el.addEventListener('touchend', up);
      el.addEventListener('touchcancel', up);
    };
    btn('btn-jump', 'Space', true);
    btn('btn-draw', 'KeyQ');
    btn('btn-photo', 'KeyF');
    btn('btn-enter', 'KeyE');
    btn('btn-swap', 'KeyX');
    btn('btn-radio', 'KeyR');
    btn('btn-view', 'KeyV');
    btn('btn-up', 'Space', true);
    btn('btn-down', 'KeyC', true);
    btn('btn-pause', 'Escape');
    btn('btn-phone', 'KeyP');
    // (not with ?classic: the fists' guard while it is held - the right click's aim; ROADMAP 5.4)
    const guard = document.getElementById('btn-guard');
    if (guard) {
      guard.addEventListener('touchstart', (e) => {
        e.preventDefault();
        guard.classList.add('on');
        this.aim = true;
      }, { passive: false });
      const off = () => {
        guard.classList.remove('on');
        this.aim = false;
      };
      guard.addEventListener('touchend', off);
      guard.addEventListener('touchcancel', off);
    }
  }

  // Movement vector from keys or stick (a gamepad's, core/gamepad.js, while it is pushed).
  readMove() {
    const pad = this.pad;
    if (pad && (pad.x || pad.y || pad.sprint)) return pad;
    if (this.touch) return { x: this.move.x, y: this.move.y, sprint: (this.stickMag || 0) > 0.92 };
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y, sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') };
  }

  consumeLook() {
    const d = { x: this.lookDX * this.sensitivity, y: this.lookDY * this.sensitivity * (this.invertY ? -1 : 1) };
    this.lookDX = 0;
    this.lookDY = 0;
    return d;
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
    this.firePressed = false;
    this.wheel = 0;
  }
}
