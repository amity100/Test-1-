import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { crossing, orientFrame, passDirection, passPoint, passRotation, RiftFrame, yawOf } from '../src/game/portalMath';

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
