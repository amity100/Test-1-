import type { Input } from '../engine/input';
import { getDevice, t } from './i18n';

const LOOK_TOUCH = 0.0042;

/**
 * Photo mode overlay: title, a device-aware hint and, for touch, SNAP / EXIT /
 * zoom buttons plus drag-to-look anywhere else on screen. The game polls
 * `consumeSnap()` / `consumeExit()` / `zoom` each frame.
 */
export class PhotoUI {
  private el: HTMLDivElement;
  private snapReq = false;
  private exitReq = false;
  /** Held zoom from the +/- buttons (-1..1), as a rate. */
  zoom = 0;
  private drag: { id: number; x: number; y: number } | null = null;
  /** Touch points on the overlay (pinch zoom with two). */
  private pts = new Map<number, { x: number; y: number }>();
  private pinchD = 0;
  private pinch = 0;

  constructor(root: HTMLElement, private input: Input) {
    this.el = document.createElement('div');
    this.el.className = 'photo-ui';
    root.appendChild(this.el);
    const btn = (cls: string, fn: (down: boolean) => void) => {
      const b = this.el.querySelector(cls) as HTMLElement | null;
      if (!b) return;
      const down = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        fn(true);
      };
      const up = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        fn(false);
      };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    };
    this.render();
    btn('.ph-snap', (d) => d && (this.snapReq = true));
    btn('.ph-exit', (d) => d && (this.exitReq = true));
    btn('.ph-in', (d) => (this.zoom = d ? 1 : 0));
    btn('.ph-out', (d) => (this.zoom = d ? -1 : 0));
    // drag anywhere else to look around (touch)
    this.el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pts.size === 2) {
        this.drag = null;
        this.pinchD = this.spread();
      } else if (!this.drag) this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    this.el.addEventListener('pointermove', (e) => {
      const p = this.pts.get(e.pointerId);
      if (p) {
        p.x = e.clientX;
        p.y = e.clientY;
      }
      if (this.pts.size === 2) {
        const dd = this.spread();
        this.pinch += (dd - this.pinchD) * 0.03;
        this.pinchD = dd;
        return;
      }
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.input.lookX += (e.clientX - d.x) * LOOK_TOUCH * this.input.sensitivity;
      this.input.lookY += (e.clientY - d.y) * LOOK_TOUCH * this.input.sensitivity * (this.input.invertY ? -1 : 1);
      d.x = e.clientX;
      d.y = e.clientY;
    });
    const end = (e: PointerEvent) => {
      this.pts.delete(e.pointerId);
      if (this.drag && this.drag.id === e.pointerId) this.drag = null;
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
  }

  private render() {
    this.el.innerHTML = `
      <div class="ph-top"><b></b><span></span></div>
      <div class="ph-btns">
        <button type="button" class="ph-out" aria-label="zoom out">−</button>
        <button type="button" class="ph-snap"><i></i><span></span></button>
        <button type="button" class="ph-in" aria-label="zoom in">+</button>
      </div>
      <button type="button" class="ph-exit">✕ <span></span></button>`;
  }

  /** Texts follow the language and the device in use. */
  private refreshText() {
    const dev = getDevice();
    const set = (sel: string, text: string) => {
      const n = this.el.querySelector(sel);
      if (n) n.textContent = text;
    };
    set('.ph-top b', t('photo.title'));
    set('.ph-top span', t(dev === 'touch' ? 'photo.hint.touch' : dev === 'pad' ? 'photo.hint.pad' : 'photo.hint'));
    set('.ph-snap span', t('photo.snap'));
    set('.ph-exit span', t('photo.exit'));
  }

  show(on: boolean) {
    if (on) {
      this.refreshText();
      this.snapReq = this.exitReq = false;
      this.zoom = 0;
      this.drag = null;
      this.pts.clear();
      this.pinch = 0;
    }
    this.el.classList.toggle('on', on);
    this.el.classList.toggle('touch', getDevice() === 'touch');
  }

  /** Hidden for the shot itself (the capture is taken from the canvas, but a flash helps). */
  flash() {
    this.el.classList.remove('flash');
    void this.el.offsetWidth;
    this.el.classList.add('flash');
  }

  private spread() {
    const [a, b] = Array.from(this.pts.values());
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  /** Pinch since last call, in wheel notches (apart = closer). */
  consumePinch() {
    const r = this.pinch;
    this.pinch = 0;
    return r;
  }

  consumeSnap() {
    const r = this.snapReq;
    this.snapReq = false;
    return r;
  }

  consumeExit() {
    const r = this.exitReq;
    this.exitReq = false;
    return r;
  }
}
