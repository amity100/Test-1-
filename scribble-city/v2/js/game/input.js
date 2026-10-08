// Keys, the mouse (pointer lock), and on a phone a stick on the left and a drag on the right.
export class Input {
  constructor(canvas, touch) {
    this.canvas = canvas;
    this.touch = touch;
    this.keys = new Set();
    this.lookX = 0;
    this.lookY = 0;
    this.stick = { x: 0, y: 0 };
    this.enabled = false;
    this.locked = false;
    this.stickId = null;
    this.lookId = null;
    this.lookLast = null;
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Escape' && this.onEscape) this.onEscape();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.skipMoves = 0;
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      // the first moves after the lock can carry the whole jump of the cursor: skip them
      if (this.locked) this.skipMoves = 3;
      if (!this.locked && this.enabled && !this.touch && this.onUnlock) this.onUnlock();
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.skipMoves > 0) {
        this.skipMoves--;
        return;
      }
      if (this.locked || this.dragging) {
        this.lookX += Math.max(-150, Math.min(150, e.movementX));
        this.lookY += Math.max(-150, Math.min(150, e.movementY));
      }
    });
    canvas.addEventListener('mousedown', () => {
      if (!this.enabled || this.touch) return;
      if (!this.locked) this.lock();
      this.dragging = true;
    });
    window.addEventListener('mouseup', () => (this.dragging = false));
    // touch: the stick and the look drag
    const stickEl = document.getElementById('stick');
    const knob = document.getElementById('knob');
    const stickCenter = () => {
      const r = stickEl.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2, r.width / 2];
    };
    const onStart = (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.45 && this.stickId === null) {
          this.stickId = t.identifier;
          this.moveStick(t, stickCenter, knob);
        } else if (this.lookId === null) {
          this.lookId = t.identifier;
          this.lookLast = [t.clientX, t.clientY];
        }
      }
      e.preventDefault();
    };
    const onMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) this.moveStick(t, stickCenter, knob);
        else if (t.identifier === this.lookId) {
          this.lookX += (t.clientX - this.lookLast[0]) * 1.6;
          this.lookY += (t.clientY - this.lookLast[1]) * 1.6;
          this.lookLast = [t.clientX, t.clientY];
        }
      }
      e.preventDefault();
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) {
          this.stickId = null;
          this.stick.x = 0;
          this.stick.y = 0;
          knob.style.transform = '';
        } else if (t.identifier === this.lookId) this.lookId = null;
      }
    };
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd);
    canvas.addEventListener('touchcancel', onEnd);
  }

  moveStick(t, center, knob) {
    const [cx, cy, r] = center();
    let dx = t.clientX - cx;
    let dy = t.clientY - cy;
    const l = Math.hypot(dx, dy);
    if (l > r) {
      dx = (dx / l) * r;
      dy = (dy / l) * r;
    }
    this.stick.x = dx / r;
    this.stick.y = -dy / r;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  lock() {
    try {
      const p = this.canvas.requestPointerLock && this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {
      // dragging works too
    }
  }

  // x right, y forward, run
  move() {
    let x = 0;
    let y = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    let run = k.has('ShiftLeft') || k.has('ShiftRight');
    if (this.stickId !== null) {
      x = this.stick.x;
      y = this.stick.y;
      run = Math.hypot(x, y) > 0.92;
    }
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y, run };
  }

  consumeLook() {
    const r = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return r;
  }
}
