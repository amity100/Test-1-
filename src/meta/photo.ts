/**
 * Photo mode: a free orbit / dolly / pan camera around the frozen scene, FOV
 * and tilt control, PNG capture. The game freezes simulation while active.
 */
import * as THREE from 'three';
import type { V3 } from '../core/contracts';

export interface PhotoInput {
  /** Orbit this frame in radians (already sensitivity-scaled). > 0 turns the view right. */
  lookX: number;
  /** Orbit this frame in radians. > 0 tilts the view up. */
  lookY: number;
  /** Pan rate -1..1 (right). */
  moveX: number;
  /** Pan rate -1..1 (forward). */
  moveY: number;
  /** Dolly rate -1..1 (> 0 moves closer). */
  zoom: number;
  /** Tilt (camera roll) rate -1..1. */
  roll?: number;
}

export const PHOTO_LIMITS = {
  minDist: 0.8,
  maxDist: 25,
  minPitch: -1.35,
  maxPitch: 1.45,
  /** The orbit centre can't wander further than this from where photo mode began. */
  panRadius: 12,
  /** Pan speed = max(panMin, distance × panScale) m/s. */
  panMin: 2,
  panScale: 0.9,
  /** ln(distance) per second at full zoom input. */
  zoomSpeed: 1.6,
  rollSpeed: 0.8,
  maxRoll: 0.8,
  minFov: 20,
  maxFov: 100,
  /** The camera never goes further than this below the orbit centre (stay above the floor). */
  maxBelow: 1.2,
} as const;

function clamp(x: number, a: number, b: number): number {
  return x < a ? a : x > b ? b : x;
}

export class PhotoMode {
  /** Orbit centre. */
  readonly target = new THREE.Vector3();
  distance = 4;
  /** Orbit angle around +Y (radians). */
  yaw = 0;
  /** Elevation of the camera above the centre (radians). */
  pitch = 0.2;
  /** Camera roll (radians). */
  roll = 0;

  private cam: THREE.PerspectiveCamera | null = null;
  private isActive = false;
  private origin = new THREE.Vector3();
  private savedPos = new THREE.Vector3();
  private savedQuat = new THREE.Quaternion();
  private savedUp = new THREE.Vector3(0, 1, 0);
  private savedFov = 60;
  private entry = { distance: 4, yaw: 0, pitch: 0.2, fov: 60 };
  private _fov = 60;
  private _v = new THREE.Vector3();

  get active(): boolean { return this.isActive; }

  get fov(): number { return this._fov; }
  set fov(v: number) {
    if (!Number.isFinite(v)) return;
    this._fov = clamp(v, PHOTO_LIMITS.minFov, PHOTO_LIMITS.maxFov);
    if (this.isActive && this.cam) {
      this.cam.fov = this._fov;
      this.cam.updateProjectionMatrix();
    }
  }

  enter(camera: THREE.PerspectiveCamera, target: V3): void {
    if (this.isActive) this.exit();
    this.cam = camera;
    this.savedPos.copy(camera.position);
    this.savedQuat.copy(camera.quaternion);
    this.savedUp.copy(camera.up);
    this.savedFov = camera.fov;

    this.target.copy(target);
    this.origin.copy(target);
    const off = this._v.subVectors(camera.position, target);
    let len = off.length();
    if (len < 1e-3) {
      // Camera sits on the target: back off along its view direction.
      camera.getWorldDirection(off).multiplyScalar(-1);
      len = 4;
      off.multiplyScalar(len);
    }
    this.distance = clamp(len, PHOTO_LIMITS.minDist, PHOTO_LIMITS.maxDist);
    this.yaw = Math.atan2(off.x, off.z);
    this.pitch = clamp(Math.asin(clamp(off.y / len, -1, 1)), PHOTO_LIMITS.minPitch, PHOTO_LIMITS.maxPitch);
    this.roll = 0;
    this._fov = clamp(camera.fov, PHOTO_LIMITS.minFov, PHOTO_LIMITS.maxFov);
    this.entry = { distance: this.distance, yaw: this.yaw, pitch: this.pitch, fov: this._fov };
    this.isActive = true;
    this.apply();
  }

  update(dt: number, input: PhotoInput): void {
    if (!this.isActive || !this.cam) return;
    const L = PHOTO_LIMITS;
    if (!(dt > 0) || !Number.isFinite(dt)) dt = 0;
    dt = Math.min(dt, 0.1);
    const lx = Number.isFinite(input.lookX) ? input.lookX : 0;
    const ly = Number.isFinite(input.lookY) ? input.lookY : 0;
    const mx = clamp(Number.isFinite(input.moveX) ? input.moveX : 0, -1, 1);
    const my = clamp(Number.isFinite(input.moveY) ? input.moveY : 0, -1, 1);
    const zm = clamp(Number.isFinite(input.zoom) ? input.zoom : 0, -1, 1);
    const rl = clamp(Number.isFinite(input.roll ?? 0) ? (input.roll ?? 0) : 0, -1, 1);

    this.yaw -= lx;
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    else if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
    this.pitch = clamp(this.pitch - ly, L.minPitch, L.maxPitch);

    this.distance = clamp(this.distance * Math.exp(-zm * L.zoomSpeed * dt), L.minDist, L.maxDist);
    this.roll = clamp(this.roll + rl * L.rollSpeed * dt, -L.maxRoll, L.maxRoll);

    if (mx !== 0 || my !== 0) {
      const sp = Math.max(L.panMin, this.distance * L.panScale) * dt;
      const sy = Math.sin(this.yaw);
      const cy = Math.cos(this.yaw);
      // right = (cos yaw, 0, -sin yaw), forward (view, horizontal) = (-sin yaw, 0, -cos yaw)
      this.target.x += (cy * mx - sy * my) * sp;
      this.target.z += (-sy * mx - cy * my) * sp;
      const d = this._v.subVectors(this.target, this.origin);
      const len = d.length();
      if (len > L.panRadius) this.target.copy(this.origin).addScaledVector(d, L.panRadius / len);
    }
    this.apply();
  }

  /** Back to the framing photo mode started with. */
  resetView(): void {
    if (!this.isActive) return;
    this.target.copy(this.origin);
    this.distance = this.entry.distance;
    this.yaw = this.entry.yaw;
    this.pitch = this.entry.pitch;
    this.roll = 0;
    this.fov = this.entry.fov;
    this.apply();
  }

  /** Render once, then encode that frame as PNG (same task, so WebGL content is intact). */
  capture(canvas: HTMLCanvasElement, renderFn: () => void): Promise<Blob | null> {
    return new Promise<Blob | null>((resolve) => {
      try {
        renderFn();
        if (!canvas || typeof canvas.toBlob !== 'function') {
          resolve(null);
          return;
        }
        canvas.toBlob((b) => resolve(b ?? null), 'image/png');
      } catch {
        resolve(null);
      }
    });
  }

  exit(): void {
    if (!this.isActive) return;
    this.isActive = false;
    const cam = this.cam;
    this.cam = null;
    if (!cam) return;
    cam.position.copy(this.savedPos);
    cam.quaternion.copy(this.savedQuat);
    cam.up.copy(this.savedUp);
    cam.fov = this.savedFov;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  private apply(): void {
    const cam = this.cam;
    if (!cam) return;
    const L = PHOTO_LIMITS;
    // Keep the camera above the floor-ish: limit how far below the centre it can go.
    const minSin = -L.maxBelow / this.distance;
    if (Math.sin(this.pitch) < minSin) this.pitch = Math.asin(clamp(minSin, -1, 1));
    const cp = Math.cos(this.pitch);
    cam.position.set(
      this.target.x + Math.sin(this.yaw) * cp * this.distance,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * cp * this.distance,
    );
    cam.up.set(0, 1, 0);
    cam.lookAt(this.target);
    if (this.roll !== 0) cam.rotateZ(this.roll);
    if (cam.fov !== this._fov) {
      cam.fov = this._fov;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();
  }
}
