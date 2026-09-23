import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PhotoMode, PHOTO_LIMITS } from '../../src/meta/photo';

const idle = { lookX: 0, lookY: 0, moveX: 0, moveY: 0, zoom: 0 };

function setup() {
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  cam.position.set(0, 3, 6);
  cam.lookAt(0, 1, 0);
  cam.updateMatrixWorld();
  const target = new THREE.Vector3(0, 1, 0);
  const pm = new PhotoMode();
  return { cam, target, pm };
}

function looksAt(cam: THREE.PerspectiveCamera, p: THREE.Vector3): number {
  const dir = cam.getWorldDirection(new THREE.Vector3());
  const to = p.clone().sub(cam.position).normalize();
  return dir.dot(to);
}

describe('PhotoMode', () => {
  it('enter keeps the framing; exit restores the camera', () => {
    const { cam, target, pm } = setup();
    const pos0 = cam.position.clone();
    const q0 = cam.quaternion.clone();
    pm.enter(cam, target);
    expect(pm.active).toBe(true);
    expect(cam.position.distanceTo(pos0)).toBeLessThan(1e-6);
    expect(pm.distance).toBeCloseTo(Math.hypot(2, 6), 6);
    pm.update(0.016, { ...idle, lookX: 0.8, zoom: 1 });
    pm.fov = 30;
    expect(cam.fov).toBe(30);
    expect(cam.position.distanceTo(pos0)).toBeGreaterThan(0.1);
    pm.exit();
    expect(pm.active).toBe(false);
    expect(cam.position.distanceTo(pos0)).toBeLessThan(1e-9);
    expect(cam.quaternion.angleTo(q0)).toBeLessThan(1e-9);
    expect(cam.fov).toBe(60);
  });

  it('orbits around the target and always looks at it', () => {
    const { cam, target, pm } = setup();
    pm.enter(cam, target);
    const d0 = cam.position.distanceTo(target);
    for (let i = 0; i < 20; i++) pm.update(0.016, { ...idle, lookX: 0.1, lookY: 0.02 });
    expect(cam.position.distanceTo(target)).toBeCloseTo(d0, 6);
    expect(looksAt(cam, target)).toBeCloseTo(1, 6);
    // Turning the view right moves the camera to the left of the target (seen from behind).
    const { cam: c2, target: t2, pm: p2 } = setup();
    p2.enter(c2, t2);
    p2.update(0.016, { ...idle, lookX: 0.3 });
    expect(c2.position.x).toBeLessThan(0);
  });

  it('limits distance, pitch, pan radius, roll and FOV', () => {
    const { cam, target, pm } = setup();
    pm.enter(cam, target);
    for (let i = 0; i < 400; i++) pm.update(0.05, { ...idle, zoom: 1 });
    expect(pm.distance).toBeCloseTo(PHOTO_LIMITS.minDist, 6);
    for (let i = 0; i < 400; i++) pm.update(0.05, { ...idle, zoom: -1 });
    expect(pm.distance).toBeCloseTo(PHOTO_LIMITS.maxDist, 6);
    pm.update(0.016, { ...idle, lookY: -10 });
    expect(pm.pitch).toBeCloseTo(PHOTO_LIMITS.maxPitch, 6);
    pm.update(0.016, { ...idle, lookY: 10 });
    // Can't go more than maxBelow under the centre.
    expect(cam.position.y).toBeGreaterThanOrEqual(target.y - PHOTO_LIMITS.maxBelow - 1e-6);
    for (let i = 0; i < 500; i++) pm.update(0.05, { ...idle, moveX: 1, moveY: 1 });
    expect(pm.target.distanceTo(target)).toBeCloseTo(PHOTO_LIMITS.panRadius, 4);
    for (let i = 0; i < 100; i++) pm.update(0.05, { ...idle, roll: 1 });
    expect(pm.roll).toBeCloseTo(PHOTO_LIMITS.maxRoll, 6);
    pm.fov = 500;
    expect(pm.fov).toBe(PHOTO_LIMITS.maxFov);
    pm.fov = 1;
    expect(pm.fov).toBe(PHOTO_LIMITS.minFov);
    pm.fov = NaN;
    expect(pm.fov).toBe(PHOTO_LIMITS.minFov);
    pm.resetView();
    expect(pm.target.distanceTo(target)).toBe(0);
    expect(pm.roll).toBe(0);
  });

  it('pans relative to the view: forward moves the centre away from the camera', () => {
    const { cam, target, pm } = setup();
    pm.enter(cam, target);
    pm.update(0.5, { ...idle, moveY: 1 });
    expect(pm.target.z).toBeLessThan(0);
    expect(Math.abs(pm.target.x)).toBeLessThan(1e-6);
    pm.update(0.5, { ...idle, moveX: 1 });
    expect(pm.target.x).toBeGreaterThan(0);
  });

  it('ignores input when inactive and bad numbers when active', () => {
    const { cam, target, pm } = setup();
    const p0 = cam.position.clone();
    pm.update(0.016, { ...idle, lookX: 1 });
    expect(cam.position.equals(p0)).toBe(true);
    pm.enter(cam, target);
    pm.update(NaN, { lookX: NaN, lookY: Infinity, moveX: NaN, moveY: 0, zoom: NaN });
    expect(Number.isFinite(cam.position.x)).toBe(true);
    expect(cam.position.distanceTo(p0)).toBeLessThan(1e-6);
  });

  it('capture renders first, then encodes a PNG', async () => {
    const { pm } = setup();
    const order: string[] = [];
    const blob = { size: 10, type: 'image/png' } as Blob;
    const canvas = {
      toBlob(cb: (b: Blob | null) => void, type?: string) {
        order.push(`toBlob:${type}`);
        cb(blob);
      },
    } as unknown as HTMLCanvasElement;
    const got = await pm.capture(canvas, () => order.push('render'));
    expect(got).toBe(blob);
    expect(order).toEqual(['render', 'toBlob:image/png']);
    expect(await pm.capture({} as HTMLCanvasElement, () => {})).toBeNull();
    expect(await pm.capture(canvas, () => { throw new Error('x'); })).toBeNull();
  });
});
