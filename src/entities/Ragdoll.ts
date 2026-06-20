import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import type { PhysicsWorld } from '../core/PhysicsWorld';
export type PartName = 'head'|'chest'|'hips'|'leftUpperArm'|'leftLowerArm'|'leftHand'|'rightUpperArm'|'rightLowerArm'|'rightHand'|'leftUpperLeg'|'leftLowerLeg'|'rightUpperLeg'|'rightLowerLeg';
export class Ragdoll {
  readonly bodies = new Map<PartName, RAPIER.RigidBody>();
  constructor(private physics: PhysicsWorld, public id: string, origin: Vector3, public color: string) { this.build(origin); }
  private body(name: PartName, pos: Vector3, half: Vector3, density=0.8) {
    const rb = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y,pos.z).setLinearDamping(1.1).setAngularDamping(1.6));
    this.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(half.x,half.y,half.z).setDensity(density).setFriction(0.9).setRestitution(0.28), rb);
    this.physics.register(rb.handle, `${this.id}:${name}`); this.bodies.set(name, rb); return rb;
  }
  private joint(a: RAPIER.RigidBody, b: RAPIER.RigidBody, pa: Vector3, pb: Vector3) { this.physics.world.createImpulseJoint(RAPIER.JointData.spherical({x:pa.x,y:pa.y,z:pa.z},{x:pb.x,y:pb.y,z:pb.z}), a, b, true); }
  private build(o: Vector3) {
    const chest=this.body('chest',o.clone().add(new Vector3(0,1.55,0)),new Vector3(.32,.36,.18),1.2), hips=this.body('hips',o.clone().add(new Vector3(0,1.02,0)),new Vector3(.28,.22,.16),1.1), head=this.body('head',o.clone().add(new Vector3(0,2.05,0)),new Vector3(.22,.22,.2),.7);
    this.joint(chest,hips,new Vector3(0,-.34,0),new Vector3(0,.22,0)); this.joint(chest,head,new Vector3(0,.36,0),new Vector3(0,-.22,0));
    for (const s of [-1,1] as const) { const side=s<0?'left':'right'; const ua=this.body(`${side}UpperArm` as PartName,o.clone().add(new Vector3(s*.55,1.55,0)),new Vector3(.12,.31,.12)); const la=this.body(`${side}LowerArm` as PartName,o.clone().add(new Vector3(s*.85,1.25,0)),new Vector3(.11,.28,.11)); const hand=this.body(`${side}Hand` as PartName,o.clone().add(new Vector3(s*1.04,.97,0)),new Vector3(.13,.13,.13),1.4); this.joint(chest,ua,new Vector3(s*.33,.23,0),new Vector3(0,.3,0)); this.joint(ua,la,new Vector3(0,-.3,0),new Vector3(0,.27,0)); this.joint(la,hand,new Vector3(0,-.27,0),new Vector3(0,.1,0)); const ul=this.body(`${side}UpperLeg` as PartName,o.clone().add(new Vector3(s*.19,.62,0)),new Vector3(.13,.34,.13)); const ll=this.body(`${side}LowerLeg` as PartName,o.clone().add(new Vector3(s*.19,.08,0)),new Vector3(.12,.32,.12)); this.joint(hips,ul,new Vector3(s*.18,-.2,0),new Vector3(0,.33,0)); this.joint(ul,ll,new Vector3(0,-.33,0),new Vector3(0,.31,0)); }
  }
  center(){ const c=this.bodies.get('chest')!.translation(); return new Vector3(c.x,c.y,c.z); }
}
