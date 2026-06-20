import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { GAME_CONFIG } from '../core/config';
import type { PartName, Ragdoll } from './Ragdoll';
import { PuppetState } from './PuppetState';
import type { IWireInputSource, WireInputFrame } from '../multiplayer-stub/IWireInputSource';

const UP = new Vector3(0, 1, 0);

export class MarionetteController {
  state = new PuppetState();
  cross = new Vector3();
  lastFrame?: WireInputFrame;
  justSnapped = false;

  constructor(
    public ragdoll: Ragdoll,
    private input: IWireInputSource,
    private facing: 1 | -1,
  ) {
    this.cross.copy(ragdoll.center()).add(new Vector3(0, 1.35, 0));
  }

  update(dt: number) {
    const frame = this.input.update(dt);
    this.lastFrame = frame;
    this.state.activeLimb = frame.activeLimb;
    this.state.update(dt, frame.strikeHeld);
    this.cross.lerp(frame.crossTarget, 0.14);

    this.applyVelocityLimits();

    if (!this.state.isSlack) {
      this.applySuspension(frame);
      this.applyPuppetMuscles(frame);
      this.applyBalance();
    }

    this.justSnapped = false;
    if (!frame.strikeHeld && frame.releaseVelocity.length() > 1.5 && this.state.stamina > 8) {
      const body = this.ragdoll.part(frame.activeLimb);
      const impulse = frame.releaseVelocity
        .clone()
        .clampLength(0, 2.2)
        .multiplyScalar(GAME_CONFIG.puppet.snapImpulse);
      body.applyImpulse(new RAPIER.Vector3(impulse.x, impulse.y, impulse.z), true);
      this.justSnapped = true;
    }
  }

  private applySuspension(frame: WireInputFrame) {
    const chestTarget = this.cross.clone().add(new Vector3(-0.16 * this.facing, -1.02, 0));
    const hipsTarget = this.cross.clone().add(new Vector3(0.12 * this.facing, -1.48, 0));
    const headTarget = this.cross.clone().add(new Vector3(-0.12 * this.facing, -0.52, 0));

    this.pull('chest', chestTarget, GAME_CONFIG.puppet.anchorPull, GAME_CONFIG.puppet.anchorDamping);
    this.pull('hips', hipsTarget, GAME_CONFIG.puppet.anchorPull * 0.72, GAME_CONFIG.puppet.anchorDamping);
    this.pull('head', headTarget, GAME_CONFIG.puppet.anchorPull * 0.38, GAME_CONFIG.puppet.anchorDamping * 0.8);

    if (frame.strikeHeld) {
      this.pull(frame.activeLimb, frame.strikeTarget, GAME_CONFIG.puppet.strikePull, GAME_CONFIG.puppet.strikeDamping);
    }
  }

  private applyPuppetMuscles(frame: WireInputFrame) {
    const chest = this.ragdoll.position('chest');
    const hips = this.ragdoll.position('hips');
    const opponentSide = new Vector3(this.facing, 0, 0);

    for (const side of [-1, 1] as const) {
      const prefix = side < 0 ? 'left' : 'right';
      const handName = `${prefix}Hand` as PartName;
      const upperArmName = `${prefix}UpperArm` as PartName;
      const lowerArmName = `${prefix}LowerArm` as PartName;
      const upperLegName = `${prefix}UpperLeg` as PartName;
      const lowerLegName = `${prefix}LowerLeg` as PartName;

      const shoulder = chest.clone().add(new Vector3(side * 0.42, -0.04, 0));
      const relaxedHand = shoulder.clone().add(new Vector3(side * 0.34 + opponentSide.x * 0.12, -0.48, 0.06 * side));
      const handTarget = frame.strikeHeld && frame.activeLimb === handName ? frame.strikeTarget : relaxedHand;

      this.pull(upperArmName, shoulder.clone().lerp(handTarget, 0.34), GAME_CONFIG.puppet.musclePull, GAME_CONFIG.puppet.muscleDamping);
      this.pull(lowerArmName, shoulder.clone().lerp(handTarget, 0.66), GAME_CONFIG.puppet.musclePull, GAME_CONFIG.puppet.muscleDamping);
      if (!frame.strikeHeld || frame.activeLimb !== handName) {
        this.pull(handName, relaxedHand, GAME_CONFIG.puppet.musclePull * 0.65, GAME_CONFIG.puppet.muscleDamping);
      }

      const hip = hips.clone().add(new Vector3(side * 0.16, -0.06, 0));
      const knee = hip.clone().add(new Vector3(side * 0.06, -0.46, 0.03 * side));
      const foot = hip.clone().add(new Vector3(side * 0.09, -0.92, 0.08 * side));
      this.pull(upperLegName, knee, GAME_CONFIG.puppet.musclePull * 0.95, GAME_CONFIG.puppet.muscleDamping);
      this.pull(lowerLegName, foot, GAME_CONFIG.puppet.musclePull * 0.9, GAME_CONFIG.puppet.muscleDamping);
    }
  }

  private applyBalance() {
    for (const name of ['chest', 'hips', 'head'] as PartName[]) {
      this.upright(name, GAME_CONFIG.puppet.balanceTorque, GAME_CONFIG.puppet.balanceDamping);
    }
  }

  private applyVelocityLimits() {
    const max = GAME_CONFIG.puppet.maxSpeed;
    for (const body of this.ragdoll.allParts()) {
      const velocity = body.linvel();
      const v = new Vector3(velocity.x, velocity.y, velocity.z);
      if (v.length() > max) {
        v.setLength(max);
        body.setLinvel(new RAPIER.Vector3(v.x, v.y, v.z), true);
      }
    }
  }

  private pull(name: PartName, target: Vector3, strength: number, damping: number) {
    const body = this.ragdoll.part(name);
    const position = body.translation();
    const velocity = body.linvel();
    const force = target
      .clone()
      .sub(new Vector3(position.x, position.y, position.z))
      .multiplyScalar(strength)
      .sub(new Vector3(velocity.x, velocity.y, velocity.z).multiplyScalar(damping))
      .clampLength(0, 130);
    body.addForce(new RAPIER.Vector3(force.x, force.y, force.z), true);
  }

  private upright(name: PartName, strength: number, damping: number) {
    const body = this.ragdoll.part(name);
    const rotation = body.rotation();
    const angularVelocity = body.angvel();
    const currentUp = UP.clone().applyQuaternion(new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w));
    const torque = currentUp
      .cross(UP)
      .multiplyScalar(strength)
      .sub(new Vector3(angularVelocity.x, angularVelocity.y, angularVelocity.z).multiplyScalar(damping));
    body.addTorque(new RAPIER.Vector3(torque.x, torque.y, torque.z), true);
  }
}
