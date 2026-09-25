import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { crossing, orientFrame, passDirection, passPoint, passRotation, RiftFrame, yawOf } from '../src/game/portalMath';
import { windowRect } from '../src/game/portals';

function frame(pos: [number, number, number], normal: [number, number, number]): RiftFrame {
  return {
    position: new THREE.Vector3(...pos),
    quaternion: orientFrame(new THREE.Vector3(...normal), new THREE.Vector3(0, 1, 0)),
    width: 1.2,
    height: 2.2,
  };
}

describe('rift math', () => {
  it('walking into a near rift exits out of the far rift front', () => {
    // Near rift in front of the player, facing back at them (player walks +Z).
    const near = frame([0, 1.1, 2], [0, 0, -1]);
    // Far rift faces +X.
    const far = frame([10, 1.1, 10], [1, 0, 0]);
    const inside = new THREE.Vector3(0, 1.1, 2.05); // just past the near plane
    const out = passPoint(near, far, inside);
    expect(out.x).toBeCloseTo(10.05, 3);
    expect(out.z).toBeCloseTo(10, 3);
    const dir = passDirection(near, far, new THREE.Vector3(0, 0, 1));
    expect(dir.x).toBeCloseTo(1, 5);
    expect(dir.z).toBeCloseTo(0, 5);
    expect(yawOf(dir)).toBeCloseTo(Math.PI / 2, 5);
  });

  it('keeps height and mirrors lateral offset consistently', () => {
    const a = frame([0, 1, 0], [0, 0, 1]);
    const b = frame([5, 1, 0], [0, 0, 1]);
    const p = passPoint(a, b, new THREE.Vector3(0.3, 1.5, -0.1));
    // going in the front of a (moving -z), coming out of the front of b (+z)
    expect(p.y).toBeCloseTo(1.5, 5);
    expect(p.z).toBeCloseTo(0.1, 5);
    expect(p.x).toBeCloseTo(5 - 0.3, 5);
  });

  it('round trip is identity', () => {
    const a = frame([1, 2, 3], [0.3, 0, 1]);
    const b = frame([-4, 0.5, 7], [0, -1, 0]);
    const p = new THREE.Vector3(1.2, 2.4, 2.9);
    const back = passPoint(b, a, passPoint(a, b, p));
    expect(back.distanceTo(p)).toBeLessThan(1e-6);
    const q = passRotation(a, b);
    const q2 = passRotation(b, a);
    const id = q2.multiply(q);
    expect(Math.abs(id.w)).toBeCloseTo(1, 5);
  });

  it('detects crossing only from the front and inside the rect', () => {
    const a = frame([0, 1.1, 0], [0, 0, 1]);
    expect(crossing(a, new THREE.Vector3(0, 1, 0.2), new THREE.Vector3(0, 1, -0.1))).toBeGreaterThan(0);
    expect(crossing(a, new THREE.Vector3(0, 1, -0.2), new THREE.Vector3(0, 1, 0.1))).toBe(-1);
    expect(crossing(a, new THREE.Vector3(2, 1, 0.2), new THREE.Vector3(2, 1, -0.1))).toBe(-1);
  });
});

describe('rift window views', () => {
  const W = 960, H = 540;
  const cam = () => {
    const c = new THREE.PerspectiveCamera(60, W / H, 0.1, 500);
    c.position.set(0, 1.6, 0);
    c.lookAt(3, 1.2, -20);
    c.updateMatrixWorld();
    return c;
  };
  const viewProj = (c: THREE.PerspectiveCamera) => new THREE.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
  const mesh = (pos: [number, number, number], scale: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
    m.position.set(...pos);
    m.scale.setScalar(scale);
    m.updateMatrixWorld();
    return m;
  };
  /** Pixel (top-left origin) where p lands through camera c rendering into a viewport rect. */
  const pixel = (c: THREE.PerspectiveCamera, p: THREE.Vector3, r: { x: number; y: number; w: number; h: number }) => {
    const n = p.clone().project(c);
    return [r.x + ((n.x + 1) / 2) * r.w, r.y + ((1 - n.y) / 2) * r.h];
  };

  it('a far window renders only its own patch of the frame, pixel for pixel the same', () => {
    const c = cam();
    const m = mesh([3, 1.5, -18], 2.2);
    const r = { x: 0, y: 0, w: 0, h: 0 };
    expect(windowRect(m, viewProj(c), W, H, r)).toBe(true);
    // a small patch round the window's centre, inside the frame
    expect(r.w * r.h).toBeLessThan(W * H * 0.1);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(W);
    const sub = c.clone();
    sub.setViewOffset(W, H, r.x, r.y, r.w, r.h);
    for (const p of [new THREE.Vector3(3, 1.5, -18), new THREE.Vector3(3.8, 2.2, -18), new THREE.Vector3(2.5, 1, -18.5)]) {
      const [fx, fy] = pixel(c, p, { x: 0, y: 0, w: W, h: H });
      const [sx, sy] = pixel(sub, p, r);
      expect(sx).toBeCloseTo(fx, 3);
      expect(sy).toBeCloseTo(fy, 3);
      expect(fx).toBeGreaterThan(r.x);
      expect(fx).toBeLessThan(r.x + r.w);
    }
  });

  it('a window reaching behind the camera falls back to the whole frame', () => {
    const c = cam();
    const r = { x: 0, y: 0, w: 0, h: 0 };
    expect(windowRect(mesh([0, 1.6, 0.2], 3), viewProj(c), W, H, r)).toBe(false);
    expect(windowRect(mesh([0, 1.6, 30], 2), viewProj(c), W, H, r)).toBe(false);
  });
});
