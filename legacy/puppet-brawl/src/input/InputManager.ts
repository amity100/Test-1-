import { Camera, Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { IWireInputSource, StrikeLimb, WireInputFrame } from '../multiplayer-stub/IWireInputSource';

export class LocalPointerInput implements IWireInputSource {
  private pointer = new Vector2(0, 0.12);
  private down = false;
  private hasPointer = false;
  private last = new Vector3();
  private cur = new Vector3();
  private vel = new Vector3();
  private limb: StrikeLimb = 'rightHand';
  private release = new Vector3();
  private plane = new Plane(new Vector3(0, 1, 0), -1.35);
  private ray = new Raycaster();

  constructor(
    private element: HTMLElement,
    private camera: Camera,
    private base: () => Vector3,
  ) {
    element.addEventListener('pointermove', (event) => this.set(event));
    element.addEventListener('pointerdown', (event) => {
      this.down = true;
      this.set(event);
      element.setPointerCapture?.(event.pointerId);
    });
    element.addEventListener('pointerup', (event) => {
      this.down = false;
      this.release.copy(this.vel);
      element.releasePointerCapture?.(event.pointerId);
    });
    element.addEventListener('pointercancel', () => {
      this.down = false;
      this.release.set(0, 0, 0);
    });
    window.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'q' || event.key === '1') this.limb = 'leftHand';
      if (event.key.toLowerCase() === 'e' || event.key === '2') this.limb = 'rightHand';
    });
  }

  setLimb(limb: StrikeLimb) {
    this.limb = limb;
  }

  private set(event: PointerEvent) {
    this.hasPointer = true;
    this.pointer.set((event.clientX / innerWidth) * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
  }

  update(dt: number): WireInputFrame {
    const hit = this.projectPointer();
    if (!this.hasPointer) {
      hit.copy(this.base()).add(new Vector3(0, 0.15, 0));
    }

    hit.x = Math.max(-4.35, Math.min(4.35, hit.x));
    hit.z = Math.max(-2.35, Math.min(2.35, hit.z));

    this.last.copy(this.cur.lengthSq() === 0 ? hit : this.cur);
    this.cur.copy(hit);
    this.vel.copy(this.cur).sub(this.last).multiplyScalar(1 / Math.max(dt, 0.001)).clampLength(0, 4.8);

    const releaseVelocity = this.release.clone().clampLength(0, 4.8);
    this.release.set(0, 0, 0);

    return {
      crossTarget: hit.clone().add(new Vector3(0, 1.18, 0)),
      activeLimb: this.limb,
      strikeHeld: this.down,
      strikeTarget: hit,
      releaseVelocity,
    };
  }

  private projectPointer() {
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = new Vector3();
    this.ray.ray.intersectPlane(this.plane, hit);
    return hit.lengthSq() > 0 ? hit : this.base();
  }
}
