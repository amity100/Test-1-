import type { MarionetteController } from '../entities/MarionetteController';
import type { MatchResult } from '../game/MatchManager';

export class HUD {
  root = document.createElement('div');
  pfill = document.createElement('div');
  efill = document.createElement('div');
  prompt = document.createElement('div');
  result?: HTMLDivElement;
  onRestart = () => {};
  onLimb = (_limb: 'leftHand' | 'rightHand') => {};

  constructor() {
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="title">PUPPET BRAWL</div>
      <div class="topright">
        <button id="left">Left Wire (Q / 1)</button>
        <button id="right">Right Wire (E / 2)</button>
        <div class="hint">Drag the arena to steer. Hold, aim, release to punch.</div>
      </div>
      <div class="panel">
        <b>Controlled marionette match</b>
        <div>Player stamina</div><div class="bar"><div id="pbar" class="fill"></div></div>
        <div>AI stamina</div><div class="bar"><div id="ebar" class="fill"></div></div>
        <small>Win by ring-out or keeping the opponent down.</small>
      </div>
      <div class="prompt">Drag slowly to walk. Hold and release for a snap strike.</div>`;
    document.body.appendChild(this.root);
    this.pfill = this.root.querySelector('#pbar')!;
    this.efill = this.root.querySelector('#ebar')!;
    this.prompt = this.root.querySelector('.prompt')!;
    this.root.querySelector<HTMLButtonElement>('#left')!.onclick = () => this.onLimb('leftHand');
    this.root.querySelector<HTMLButtonElement>('#right')!.onclick = () => this.onLimb('rightHand');
  }

  update(player: MarionetteController, enemy: MarionetteController) {
    this.pfill.style.width = `${player.state.stamina}%`;
    this.efill.style.width = `${enemy.state.stamina}%`;
    this.prompt.textContent = player.state.isSlack
      ? 'Puppet Slack! Release controls for a moment and let the strings recover.'
      : 'Drag to move • Hold and aim • Release to snap • switch hands with Q/E';
  }

  showResult(result: MatchResult, canShare: boolean, share: () => void) {
    if (this.result) this.result.remove();
    this.result = document.createElement('div');
    this.result.className = 'result';
    this.result.innerHTML = `<div class="card"><h1>${result.winner} wins!</h1><p>${result.reason}</p><button id="again">Fight again</button><button id="share">${canShare ? 'Share clip' : 'Download clip'}</button></div>`;
    document.body.appendChild(this.result);
    this.result.querySelector<HTMLButtonElement>('#again')!.onclick = () => {
      this.result?.remove();
      this.result = undefined;
      this.onRestart();
    };
    this.result.querySelector<HTMLButtonElement>('#share')!.onclick = share;
  }

  destroy() {
    this.result?.remove();
    this.root.remove();
  }
}
