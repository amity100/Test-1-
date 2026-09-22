import * as THREE from 'three';
import { FEEL } from '../config';
import { CollisionWorld } from '../world/collision';

const _v = new THREE.Vector3();

/** Over-the-shoulder third-person camera with collision and aim zoom. */
export class CameraRig {
  yaw = 0;
  pitch = -0.12;
  aim = 0;
  shake = 0;
  private dist = FEEL.camDistance;
  pivot = new THREE.Vector3();
  constructor(public camera: THREE.PerspectiveCamera) {}

  look(dx: number, dy: number) {
    this.yaw -= dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy, -1.25, 0.95);
  }

  forward(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
  }

  update(dt: number, target: THREE.Vector3, crouch: number, aiming: boolean, world: CollisionWorld) {
    this.aim = THREE.MathUtils.damp(this.aim, aiming ? 1 : 0, 10, dt);
    const h = THREE.MathUtils.lerp(FEEL.camHeight, FEEL.camCrouchHeight, crouch);
    const pivotTarget = _v.set(target.x, target.y + h, target.z);
    // smooth vertical follow (stairs, landings), tight horizontal
    this.pivot.x = pivotTarget.x;
    this.pivot.z = pivotTarget.z;
    this.pivot.y = THREE.MathUtils.damp(this.pivot.y, pivotTarget.y, 14, dt);
    if (Math.abs(this.pivot.y - pivotTarget.y) > 3) this.pivot.y = pivotTarget.y;

    const wantDist = THREE.MathUtils.lerp(FEEL.camDistance, FEEL.aimDistance, this.aim);
    const shoulder = THREE.MathUtils.lerp(FEEL.camShoulder, FEEL.aimShoulder, this.aim);
    const fwd = this.forward(new THREE.Vector3());
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const shoulderPt = this.pivot.clone().addScaledVector(right, shoulder);
    // keep the shoulder offset inside walls
    const sh = world.raycast(this.pivot, right, shoulder + 0.25);
    if (sh) shoulderPt.copy(this.pivot).addScaledVector(right, Math.max(0, sh.distance - 0.25));
    const back = fwd.clone().negate();
    const hit = world.raycast(shoulderPt, back, wantDist + 0.3);
    const allowed = hit ? Math.max(0.35, hit.distance - 0.3) : wantDist;
    // pull in fast, ease out slow
    this.dist = allowed < this.dist ? allowed : THREE.MathUtils.damp(this.dist, allowed, 5, dt);
    this.camera.position.copy(shoulderPt).addScaledVector(back, this.dist);
    const ground = world.groundAt(this.camera.position.x, this.camera.position.z, 0.1, this.camera.position.y + 0.2);
    if (this.camera.position.y < ground + 0.25) this.camera.position.y = ground + 0.25;
    const look = this.camera.position.clone().add(fwd);
    this.camera.lookAt(look);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * this.shake * 0.05;
      this.camera.rotation.x += (Math.random() - 0.5) * s;
      this.camera.rotation.y += (Math.random() - 0.5) * s;
    }
    const fov = THREE.MathUtils.lerp(FEEL.fov, FEEL.aimFov, this.aim);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();
  }

  /** Aim ray: from the camera through the screen centre. */
  aimRay() {
    const o = this.camera.getWorldPosition(new THREE.Vector3());
    const d = this.camera.getWorldDirection(new THREE.Vector3());
    return { origin: o, dir: d };
  }

  /** Called when the player passes a rift: keep the view continuous. */
  rotateBy(dyaw: number) {
    this.yaw += dyaw;
  }

  snapTo(target: THREE.Vector3) {
    this.pivot.copy(target).setY(target.y + FEEL.camHeight);
    this.dist = FEEL.camDistance;
  }
}
