import * as THREE from 'three';
import { damp, dampAngle } from '../core/noise';
import { BearModel } from '../characters/BearModel';
import type { Terrain } from '../world/Terrain';
import type { Colliders } from '../core/Colliders';

/** Positions the bear model in the world: steering, ground following, slope alignment. */
export class BearActor {
  readonly model = new BearModel();
  readonly pos = new THREE.Vector3();
  heading = 0;
  speed = 0;
  private pitch = 0;
  alive = true;
  hits = 0;

  constructor(private terrain: Terrain, private colliders: Colliders, scene: THREE.Object3D) {
    scene.add(this.model.root);
    this.model.root.visible = false;
    this.model.ground = (x, z) => terrain.heightAt(x, z);
  }

  get visible() {
    return this.model.root.visible;
  }
  set visible(v: boolean) {
    this.model.root.visible = v;
  }

  place(x: number, z: number, heading: number) {
    this.pos.set(x, this.terrain.heightAt(x, z), z);
    this.heading = heading;
    this.speed = 0;
  }

  /** Steer toward target at the given speed. Returns true when within stopDist. */
  moveTo(target: THREE.Vector3, speed: number, dt: number, stopDist = 0.8) {
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < stopDist) {
      this.speed = damp(this.speed, 0, 5, dt);
      return true;
    }
    this.heading = dampAngle(this.heading, Math.atan2(dx, dz), 4.5, dt);
    this.speed = damp(this.speed, speed, 2.5, dt);
    return false;
  }

  face(target: THREE.Vector3, dt: number, rate = 4) {
    this.heading = dampAngle(this.heading, Math.atan2(target.x - this.pos.x, target.z - this.pos.z), rate, dt);
  }

  stop(dt: number) {
    this.speed = damp(this.speed, 0, 4, dt);
  }

  update(dt: number) {
    if (this.speed > 0.01) {
      this.pos.x += Math.sin(this.heading) * this.speed * dt;
      this.pos.z += Math.cos(this.heading) * this.speed * dt;
      this.colliders.resolve(this.pos, 0.6);
    }
    this.pos.y = this.terrain.heightAt(this.pos.x, this.pos.z);
    // align body pitch with the slope along the heading
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const hf = this.terrain.heightAt(this.pos.x + fx * 0.8, this.pos.z + fz * 0.8);
    const hb = this.terrain.heightAt(this.pos.x - fx * 0.8, this.pos.z - fz * 0.8);
    this.pitch = damp(this.pitch, -Math.atan2(hf - hb, 1.6) * (this.model.hold === 'rear' ? 0 : 1), 6, dt);
    const r = this.model.root;
    r.position.copy(this.pos);
    r.position.y = Math.min(hf, hb, this.pos.y);
    r.rotation.set(0, 0, 0);
    r.rotateY(this.heading);
    r.rotateX(this.pitch);
    this.model.speed = this.speed;
    if (this.visible) this.model.update(dt);
  }
}
