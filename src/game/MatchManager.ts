import { GAME_CONFIG } from '../core/config';
import type { Ragdoll } from '../entities/Ragdoll';

export type MatchResult = { winner: string; reason: 'Ring-Out' | 'Posture-KO' };

export class MatchManager {
  private low = new Map<string, number>();
  result?: MatchResult;

  update(dt: number, puppets: Ragdoll[]) {
    if (this.result) return;

    for (const puppet of puppets) {
      const center = puppet.center();
      if (Math.hypot(center.x, center.z) > GAME_CONFIG.arenaRadius + 0.25) {
        this.result = { winner: puppets.find((other) => other !== puppet)?.id ?? 'none', reason: 'Ring-Out' };
        return;
      }

      const headHeight = puppet.position('head').y;
      const lowTime = (this.low.get(puppet.id) ?? 0) + (headHeight < GAME_CONFIG.postureKoHeight ? dt : -dt * 1.5);
      this.low.set(puppet.id, Math.max(0, lowTime));
      if ((this.low.get(puppet.id) ?? 0) > GAME_CONFIG.postureKoSeconds) {
        this.result = { winner: puppets.find((other) => other !== puppet)?.id ?? 'none', reason: 'Posture-KO' };
        return;
      }
    }
  }

  reset() {
    this.low.clear();
    this.result = undefined;
  }
}
