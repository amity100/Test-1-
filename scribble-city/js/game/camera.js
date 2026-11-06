import * as THREE from 'three';
import { clamp, damp } from '../core/util.js';

/**
 * Over-the-shoulder third person camera with wall collision.
 * yaw: direction the camera looks (forward = (sin yaw, 0, cos yaw)), pitch: up positive.
 */
export class CameraRig {
  constructor(camera, collision) {
    this.camera = camera;
    this.collision = collision;
    this.yaw = 0;
    this.pitch = -0.12;
    this.dist = 4.4;
    this.curDist = 4.4;
    this.shoulder = 0.75;
    this.height = 1.62;
    this.fov = camera.fov;
    this.baseFov = camera.fov;
    this.shake = 0;
    this.pivot = new THREE.Vector3();
    this.fwd = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.minPitch = -1.05;
    this.maxPitch = 0.85;
  }

  applyLook(dx, dy) {
    this.yaw -= dx * 0.0026;
    this.pitch = clamp(this.pitch - dy * 0.0022, this.minPitch, this.maxPitch);
  }

  /**
   * target: feet position of the followed object. opts: { dist, height, shoulder, aim }
   */
  update(dt, target, opts = {}) {
    const dist = (opts.dist || this.dist) * (opts.aim ? 0.62 : 1);
    const height = opts.height || this.height;
    const shoulder = opts.shoulder !== undefined ? opts.shoulder : this.shoulder;
    const cp = Math.cos(this.pitch);
    this.fwd.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    this.right.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    this.pivot.set(target.x, target.y + height, target.z).addScaledVector(this.right, shoulder);
    // collide camera boom
    let want = dist;
    const hit = this.collision.raycast(this.pivot.x, this.pivot.y, this.pivot.z, -this.fwd.x, -this.fwd.y, -this.fwd.z, dist + 0.3);
    if (hit) want = Math.max(0.6, hit.t - 0.35);
    // never go under the ground
    this.curDist = want < this.curDist ? want : damp(this.curDist, want, 6, dt);
    const cam = this.camera;
    cam.position.copy(this.pivot).addScaledVector(this.fwd, -this.curDist);
    if (cam.position.y < 0.35) cam.position.y = 0.35;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * 0.25;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
    }
    cam.rotation.set(this.pitch, this.yaw + Math.PI, 0, 'YXZ');
    const fov = this.baseFov * (opts.aim ? 0.8 : 1) * (opts.fovMul || 1);
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = damp(cam.fov, fov, 10, dt);
      cam.updateProjectionMatrix();
    }
  }

  addShake(a) {
    this.shake = Math.min(1.2, this.shake + a);
  }
}
