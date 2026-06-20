import { GAME_CONFIG } from '../core/config';
import type { StrikeLimb } from '../multiplayer-stub/IWireInputSource';
export class PuppetState {
  stamina: number = GAME_CONFIG.stamina.max; activeLimb: StrikeLimb = 'rightHand'; slackTimer = 0; tension = 0;
  update(dt: number, strikeHeld: boolean) {
    if (this.slackTimer > 0) { this.slackTimer -= dt; this.tension = 0; this.stamina = Math.min(GAME_CONFIG.stamina.max, this.stamina + GAME_CONFIG.stamina.regenPerSecond * 0.45 * dt); return; }
    this.tension = strikeHeld ? 1 : 0;
    this.stamina += (GAME_CONFIG.stamina.regenPerSecond - GAME_CONFIG.stamina.anchorCostPerSecond - (strikeHeld ? GAME_CONFIG.stamina.strikeCostPerSecond : 0)) * dt;
    if (this.stamina <= GAME_CONFIG.stamina.slackThreshold) { this.stamina = 0; this.slackTimer = GAME_CONFIG.stamina.slackSeconds; }
    this.stamina = Math.max(0, Math.min(GAME_CONFIG.stamina.max, this.stamina));
  }
  get isSlack() { return this.slackTimer > 0; }
}
