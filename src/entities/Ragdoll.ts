import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import type { PhysicsWorld } from '../core/PhysicsWorld';

export type PartName =
  | 'head'
  | 'chest'
  | 'hips'
  | 'leftUpperArm'
  | 'leftLowerArm'
  | 'leftHand'
  | 'rightUpperArm'
  | 'rightLowerArm'
  | 'rightHand'
  | 'leftUpperLeg'
  | 'leftLowerLeg'
  | 'rightUpperLeg'
  | 'rightLowerLeg';

export class Ragdoll {
  readonly bodies = new Map<PartName, RAPIER.RigidBody>();

  constructor(
    private physics: PhysicsWorld,
    public id: string,
    origin: Vector3,
    public color: string,
  ) {
    this.build(origin);
  }

  part(name: PartName) {
    return this.bodies.get(name)!;
  }

  position(name: PartName) {
    const p = this.part(name).translation();
    return new Vector3(p.x, p.y, p.z);
  }

  center() {
    return this.position('chest');
  }

  allParts() {
    return [...this.bodies.values()];
  }

  private body(name: PartName, pos: Vector3, half: Vector3, density = 0.8) {
    const rb = this.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setLinearDamping(3.2)
        .setAngularDamping(4.6),
    );

    const collider = this.makeCollider(half)
      .setDensity(density)
      .setFriction(1.25)
      .setRestitution(0.05);

    this.physics.world.createCollider(collider, rb);
    this.physics.register(rb.handle, `${this.id}:${name}`);
    this.bodies.set(name, rb);
    return rb;
  }

  private makeCollider(half: Vector3) {
    const thin = Math.min(half.x, half.z);
    if (half.y > thin * 1.8) {
      return RAPIER.ColliderDesc.capsule(Math.max(0.02, half.y - thin), thin);
    }
    return RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z);
  }

  private joint(a: RAPIER.RigidBody, b: RAPIER.RigidBody, pa: Vector3, pb: Vector3) {
    this.physics.world.createImpulseJoint(
      RAPIER.JointData.spherical(
        { x: pa.x, y: pa.y, z: pa.z },
        { x: pb.x, y: pb.y, z: pb.z },
      ),
      a,
      b,
      true,
    );
  }

  private build(o: Vector3) {
    const chest = this.body('chest', o.clone().add(new Vector3(0, 1.65, 0)), new Vector3(0.3, 0.36, 0.18), 1.35);
    const hips = this.body('hips', o.clone().add(new Vector3(0, 1.12, 0)), new Vector3(0.28, 0.22, 0.16), 1.2);
    const head = this.body('head', o.clone().add(new Vector3(0, 2.12, 0)), new Vector3(0.2, 0.22, 0.2), 0.65);

    this.joint(chest, hips, new Vector3(0, -0.32, 0), new Vector3(0, 0.2, 0));
    this.joint(chest, head, new Vector3(0, 0.34, 0), new Vector3(0, -0.2, 0));

    for (const s of [-1, 1] as const) {
      const side = s < 0 ? 'left' : 'right';
      const upperArm = this.body(`${side}UpperArm` as PartName, o.clone().add(new Vector3(s * 0.48, 1.52, 0)), new Vector3(0.09, 0.27, 0.09), 0.72);
      const lowerArm = this.body(`${side}LowerArm` as PartName, o.clone().add(new Vector3(s * 0.72, 1.24, 0)), new Vector3(0.08, 0.25, 0.08), 0.68);
      const hand = this.body(`${side}Hand` as PartName, o.clone().add(new Vector3(s * 0.88, 1.02, 0)), new Vector3(0.12, 0.12, 0.12), 1.15);

      this.joint(chest, upperArm, new Vector3(s * 0.3, 0.2, 0), new Vector3(0, 0.25, 0));
      this.joint(upperArm, lowerArm, new Vector3(0, -0.24, 0), new Vector3(0, 0.24, 0));
      this.joint(lowerArm, hand, new Vector3(0, -0.22, 0), new Vector3(0, 0.09, 0));

      const upperLeg = this.body(`${side}UpperLeg` as PartName, o.clone().add(new Vector3(s * 0.16, 0.7, 0)), new Vector3(0.1, 0.3, 0.1), 0.95);
      const lowerLeg = this.body(`${side}LowerLeg` as PartName, o.clone().add(new Vector3(s * 0.16, 0.22, 0)), new Vector3(0.09, 0.28, 0.09), 0.9);

      this.joint(hips, upperLeg, new Vector3(s * 0.16, -0.18, 0), new Vector3(0, 0.28, 0));
      this.joint(upperLeg, lowerLeg, new Vector3(0, -0.28, 0), new Vector3(0, 0.26, 0));
    }
  }
}
