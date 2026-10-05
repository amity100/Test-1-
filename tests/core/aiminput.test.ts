import { afterEach, describe, expect, it, vi } from 'vitest';
import { Input, LOOK } from '../../src/engine/input';

/** A stand-in event target (window, document, the canvas): handlers by type, dispatched by hand. */
class Bus {
  private handlers = new Map<string, ((e: any) => void)[]>();
  pointerLockElement: unknown = null;
  addEventListener(type: string, f: (e: any) => void) {
    const l = this.handlers.get(type) ?? [];
    l.push(f);
    this.handlers.set(type, l);
  }
  removeEventListener() {}
  fire(type: string, e: Record<string, unknown> = {}) {
    for (const f of this.handlers.get(type) ?? []) f({ preventDefault: () => {}, repeat: false, ...e });
  }
}

function setup() {
  const win = new Bus();
  const doc = new Bus();
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  const canvas = new Bus();
  const inp = new Input(canvas as unknown as HTMLElement);
  return { win, doc, canvas, inp };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AIM PORTAL: the desktop and pad keys', () => {
  it('pointer lock: RMB holds PORTAL, LMB FIRE, F STAB, Q GO, E PULL; the mouse looks; while his side is being picked the look writes the side choice instead', () => {
    const { win, doc, canvas, inp } = setup();
    doc.pointerLockElement = canvas;
    doc.fire('pointerlockchange');
    expect(inp.pointerLocked).toBe(true);
    canvas.fire('mousedown', { button: 2 });
    expect(inp.wasPressed('strike1')).toBe(true);
    expect(inp.isHeld('strike1')).toBe(true);
    canvas.fire('mousedown', { button: 0 });
    expect(inp.isHeld('portal')).toBe(true);
    win.fire('mouseup', { button: 0 });
    win.fire('mouseup', { button: 2 });
    expect(inp.isHeld('strike1')).toBe(false);
    for (const [code, a] of [['KeyF', 'action'], ['KeyQ', 'strike2'], ['KeyE', 'strike3']] as const) {
      win.fire('keydown', { code });
      expect(inp.wasPressed(a)).toBe(true);
      win.fire('keyup', { code });
    }
    inp.endFrame();
    // the look
    win.fire('mousemove', { movementX: 100, movementY: -20 });
    expect(inp.consumeLook().x).toBeCloseTo(100 * LOOK.mouse, 6);
    // his side being picked: the flick, not the camera
    inp.divertLook = true;
    win.fire('mousemove', { movementX: 55, movementY: 0 });
    expect(inp.consumeLook().x).toBe(0);
    expect(inp.snapX).toBeGreaterThan(0.4);
    inp.resetSnap();
    win.fire('mousemove', { movementX: 0, movementY: 300 });
    expect(inp.snapY).toBeCloseTo(-1, 5);
    // Ctrl and the middle button still hold the side key (an alias)
    win.fire('keydown', { code: 'ControlLeft' });
    expect(inp.isHeld('snap')).toBe(true);
  });

  it('without pointer lock (a sandboxed page): the same buttons count while the game runs, not before', () => {
    const { win, canvas, inp } = setup();
    inp.freeMouse = true;
    inp.active = false;
    canvas.fire('mousedown', { button: 2 });
    expect(inp.isHeld('strike1')).toBe(false);
    inp.active = true;
    canvas.fire('mousedown', { button: 2 });
    expect(inp.isHeld('strike1')).toBe(true);
    win.fire('mousemove', { movementX: 50, movementY: 0 });
    expect(inp.consumeLook().x).toBeCloseTo(50 * LOOK.mouse, 6);
  });

  it('pad: B is GO while a pair is open, crouch (the slide) otherwise; LT PORTAL, RT FIRE, X STAB', () => {
    const { inp } = setup();
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    const pad = { connected: true, axes: [0, 0, 0, 0], buttons };
    vi.stubGlobal('navigator', { getGamepads: () => [pad] });
    const press = (i: number, on: boolean) => {
      buttons[i].pressed = on;
      buttons[i].value = on ? 1 : 0;
      inp.poll(1 / 60);
    };
    press(0, true);
    press(0, false);
    expect(inp.lastDevice).toBe('pad');
    inp.endFrame();
    inp.aimGo = true;
    press(1, true);
    expect(inp.wasPressed('go')).toBe(true);
    expect(inp.wasPressed('crouch')).toBe(false);
    press(1, false);
    inp.endFrame();
    inp.aimGo = false;
    press(1, true);
    expect(inp.wasPressed('crouch')).toBe(true);
    expect(inp.wasPressed('go')).toBe(false);
    press(1, false);
    inp.endFrame();
    press(6, true);
    expect(inp.isHeld('strike1')).toBe(true);
    press(7, true);
    expect(inp.isHeld('portal')).toBe(true);
    press(2, true);
    expect(inp.isHeld('action')).toBe(true);
  });
});
