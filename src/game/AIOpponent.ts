import { Vector3 } from 'three';
import { SeededRandom } from '../core/Random';
import type { IWireInputSource, StrikeLimb, WireInputFrame } from '../multiplayer-stub/IWireInputSource';

type AIPhase = 'approach' | 'windup' | 'strike' | 'recover';

export class AIOpponent implements IWireInputSource {
  private phase: AIPhase = 'approach';
  private timer = 0.9;
  private held = false;
  private limb: StrikeLimb = 'leftHand';
  private release = new Vector3();

  constructor(
    private self: () => Vector3,
    private target: () => Vector3,
    private rng = new SeededRandom(99),
  ) {}

  update(dt: number): WireInputFrame {
    this.timer -= dt;
    if (this.timer <= 0) this.nextPhase();

    const self = this.self();
    const target = this.target();
    const toTarget = target.clone().sub(self);
    const dir = toTarget.lengthSq() > 0.001 ? toTarget.normalize() : new Vector3(-1, 0, 0);

    const crossTarget = self
      .clone()
      .add(dir.clone().multiplyScalar(this.phase === 'recover' ? -0.55 : 0.42))
      .add(new Vector3(this.rng.range(-0.16, 0.16), 1.5 + this.rng.range(-0.06, 0.08), this.rng.range(-0.18, 0.18)));

    const strikeTarget = target
      .clone()
      .add(new Vector3(this.rng.range(-0.16, 0.16), this.phase === 'windup' ? 1.55 : 1.12, this.rng.range(-0.14, 0.14)))
      .add(dir.clone().multiplyScalar(this.phase === 'windup' ? -0.45 : 0.16));

    const releaseVelocity = this.release.clone();
    this.release.set(0, 0, 0);

    return {
      crossTarget,
      activeLimb: this.limb,
      strikeHeld: this.held,
      strikeTarget,
      releaseVelocity,
    };
  }

  private nextPhase() {
    if (this.phase === 'approach') {
      this.phase = 'windup';
      this.held = true;
      this.limb = this.rng.pick(['leftHand', 'rightHand']);
      this.timer = this.rng.range(0.32, 0.52);
      return;
    }

    if (this.phase === 'windup') {
      this.phase = 'strike';
      this.held = false;
      this.release.set(this.rng.range(-0.8, 0.8), this.rng.range(0.25, 0.9), 0).add(new Vector3(-2.4, 0, 0));
      this.timer = this.rng.range(0.28, 0.42);
      return;
    }

    if (this.phase === 'strike') {
      this.phase = 'recover';
      this.held = false;
      this.timer = this.rng.range(0.55, 0.9);
      return;
    }

    this.phase = 'approach';
    this.held = false;
    this.timer = this.rng.range(0.7, 1.1);
  }
}
