import { Vector3 } from 'three';
import { SeededRandom } from '../core/Random';
import type { IWireInputSource, StrikeLimb, WireInputFrame } from '../multiplayer-stub/IWireInputSource';

type AIPhase = 'approach' | 'windup' | 'strike' | 'recover';

export class AIOpponent implements IWireInputSource {
  private phase: AIPhase = 'approach';
  private timer = 1.2;
  private elapsed = 0;
  private held = false;
  private limb: StrikeLimb = 'leftHand';
  private release = new Vector3();

  constructor(
    private self: () => Vector3,
    private target: () => Vector3,
    private rng = new SeededRandom(99),
  ) {}

  update(dt: number): WireInputFrame {
    this.elapsed += dt;
    const self = this.self();
    const target = this.target();
    const toTarget = target.clone().sub(self);
    const dir = toTarget.lengthSq() > 0.001 ? toTarget.normalize() : new Vector3(-1, 0, 0);

    // Give the player a real opening. The AI balances and approaches, but does not strike immediately.
    if (this.elapsed < 5) {
      return {
        crossTarget: self.clone().add(dir.multiplyScalar(0.12)).add(new Vector3(0, 1.5, 0)),
        activeLimb: this.limb,
        strikeHeld: false,
        strikeTarget: self.clone().add(new Vector3(-0.35, 1.12, 0)),
        releaseVelocity: new Vector3(),
      };
    }

    this.timer -= dt;
    if (this.timer <= 0) this.nextPhase();

    const crossTarget = self
      .clone()
      .add(dir.clone().multiplyScalar(this.phase === 'recover' ? -0.35 : 0.28))
      .add(new Vector3(this.rng.range(-0.12, 0.12), 1.5 + this.rng.range(-0.04, 0.06), this.rng.range(-0.14, 0.14)));

    const strikeTarget = target
      .clone()
      .add(new Vector3(this.rng.range(-0.12, 0.12), this.phase === 'windup' ? 1.48 : 1.1, this.rng.range(-0.12, 0.12)))
      .add(dir.clone().multiplyScalar(this.phase === 'windup' ? -0.32 : 0.1));

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
      this.timer = this.rng.range(0.42, 0.66);
      return;
    }

    if (this.phase === 'windup') {
      this.phase = 'strike';
      this.held = false;
      this.release.set(this.rng.range(-0.45, 0.45), this.rng.range(0.18, 0.55), 0).add(new Vector3(-1.45, 0, 0));
      this.timer = this.rng.range(0.32, 0.48);
      return;
    }

    if (this.phase === 'strike') {
      this.phase = 'recover';
      this.held = false;
      this.timer = this.rng.range(0.65, 1.05);
      return;
    }

    this.phase = 'approach';
    this.held = false;
    this.timer = this.rng.range(0.85, 1.3);
  }
}
