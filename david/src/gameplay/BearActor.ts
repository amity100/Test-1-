import * as THREE from 'three';
import { damp, dampAngle } from '../core/noise';
import { BearModel, type BearModelOptions } from '../characters/BearModel';
import type { Terrain } from '../world/Terrain';
import type { Colliders } from '../core/Colliders';

/**
 * Positions the bear model in the world: steering, ground following, slope alignment.
 * `opts.quality` picks the model's detail tier (defaults to engine.quality.name when available).
 */
export class BearActor {
  readonly model: BearModel;
  readonly pos = new THREE.Vector3();
  heading = 0;
  speed = 0;
  private pitch = 0;
  private roll = 0;
  alive = true;
  hits = 0;

  constructor(private terrain: Terrain, private colliders: Colliders, scene: THREE.Object3D, opts: BearModelOptions = {}) {
    this.model = new BearModel(opts);
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
    // align the body with the slope along the heading (the feet adapt per paw with IK)
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const hf = this.terrain.heightAt(this.pos.x + fx * 0.8, this.pos.z + fz * 0.8);
    const hb = this.terrain.heightAt(this.pos.x - fx * 0.8, this.pos.z - fz * 0.8);
    const hl = this.terrain.heightAt(this.pos.x + fz * 0.3, this.pos.z - fx * 0.3);
    const hr = this.terrain.heightAt(this.pos.x - fz * 0.3, this.pos.z + fx * 0.3);
    const standing = this.model.hold === 'rear' || this.model.hold === 'down';
    this.pitch = damp(this.pitch, -Math.atan2(hf - hb, 1.6) * (standing ? 0.2 : 0.85), 6, dt);
    this.roll = damp(this.roll, Math.atan2(hl - hr, 0.6) * (standing ? 0.1 : 0.35), 6, dt);
    const r = this.model.root;
    r.position.copy(this.pos);
    // sit at the mean height of the footprint so the IK only has to absorb small differences
    r.position.y = (hf + hb + this.pos.y * 2) / 4;
    r.rotation.set(0, 0, 0);
    r.rotateY(this.heading);
    r.rotateX(this.pitch);
    r.rotateZ(this.roll);
    this.model.speed = this.speed;
    if (this.visible) this.model.update(dt);
  }
}
