import { GAME_CONFIG } from '../core/config';
import type { Ragdoll } from '../entities/Ragdoll';

export type MatchResult = { winner: string; reason: 'Ring-Out' | 'Posture-KO' };

const WARMUP_SECONDS = 5;

export class MatchManager {
  private low = new Map<string, number>();
  private elapsed = 0;
  result?: MatchResult;

  update(dt: number, puppets: Ragdoll[]) {
    if (this.result) return;
    this.elapsed += dt;

    // Do not allow a random startup wobble to instantly end the round.
    if (this.elapsed < WARMUP_SECONDS) return;

    for (const puppet of puppets) {
      const center = puppet.center();
      if (Math.hypot(center.x, center.z) > GAME_CONFIG.arenaRadius + 0.55) {
        this.result = { winner: puppets.find((other) => other !== puppet)?.id ?? 'none', reason: 'Ring-Out' };
        return;
      }

      const headHeight = puppet.position('head').y;
      const chestHeight = puppet.position('chest').y;
      const isDown = headHeight < GAME_CONFIG.postureKoHeight && chestHeight < GAME_CONFIG.postureKoHeight + 0.22;
      const lowTime = (this.low.get(puppet.id) ?? 0) + (isDown ? dt : -dt * 2.2);
      this.low.set(puppet.id, Math.max(0, lowTime));
      if ((this.low.get(puppet.id) ?? 0) > GAME_CONFIG.postureKoSeconds) {
        this.result = { winner: puppets.find((other) => other !== puppet)?.id ?? 'none', reason: 'Posture-KO' };
        return;
      }
    }
  }

  reset() {
    this.low.clear();
    this.elapsed = 0;
    this.result = undefined;
  }
}
