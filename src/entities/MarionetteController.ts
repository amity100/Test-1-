import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import { GAME_CONFIG } from '../core/config';
import type { Ragdoll } from './Ragdoll';
import { PuppetState } from './PuppetState';
import type { IWireInputSource, WireInputFrame } from '../multiplayer-stub/IWireInputSource';
export class MarionetteController {
  state = new PuppetState(); cross = new Vector3(); lastFrame?: WireInputFrame; justSnapped = false;
  constructor(public ragdoll: Ragdoll, private input: IWireInputSource, private facing: 1 | -1) { this.cross.copy(ragdoll.center()).add(new Vector3(0,1.6,0)); }
  update(dt:number){ const f=this.input.update(dt); this.lastFrame=f; this.state.activeLimb=f.activeLimb; this.state.update(dt,f.strikeHeld); this.cross.lerp(f.crossTarget,0.18); if(!this.state.isSlack){ this.pull('chest', this.cross.clone().add(new Vector3(-.22*this.facing,-1.1,0)), GAME_CONFIG.puppet.anchorPull); this.pull('hips', this.cross.clone().add(new Vector3(.18*this.facing,-1.65,0)), GAME_CONFIG.puppet.anchorPull*.6); if(f.strikeHeld) this.pull(f.activeLimb, f.strikeTarget, GAME_CONFIG.puppet.strikePull); } this.justSnapped=false; if(!f.strikeHeld && f.releaseVelocity.length()>1.5 && this.state.stamina>8){ const b=this.ragdoll.bodies.get(f.activeLimb)!; const v=f.releaseVelocity.clone().multiplyScalar(GAME_CONFIG.puppet.snapImpulse); b.applyImpulse(new RAPIER.Vector3(v.x,v.y,v.z), true); this.justSnapped=true; } }
  private pull(name: string, target: Vector3, strength:number){ const b=this.ragdoll.bodies.get(name as never)!; const p=b.translation(); const lv=b.linvel(); const force=target.clone().sub(new Vector3(p.x,p.y,p.z)).multiplyScalar(strength).sub(new Vector3(lv.x,lv.y,lv.z).multiplyScalar(2.4)); b.addForce(new RAPIER.Vector3(force.x,force.y,force.z), true); }
}
