import { Camera, Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { IWireInputSource, StrikeLimb, WireInputFrame } from '../multiplayer-stub/IWireInputSource';
export class LocalPointerInput implements IWireInputSource {
  private pointer = new Vector2(); private down=false; private last = new Vector3(); private cur = new Vector3(); private vel = new Vector3(); private limb: StrikeLimb='rightHand'; private release = new Vector3(); private plane = new Plane(new Vector3(0,1,0), -1.55); private ray = new Raycaster();
  constructor(private element: HTMLElement, private camera: Camera, private base: () => Vector3) { element.addEventListener('pointermove',e=>this.set(e)); element.addEventListener('pointerdown',e=>{this.down=true; this.set(e);}); element.addEventListener('pointerup',()=>{this.down=false; this.release.copy(this.vel);}); window.addEventListener('keydown',e=>{ if(e.key.toLowerCase()==='q') this.limb='leftHand'; if(e.key.toLowerCase()==='e') this.limb='rightHand';}); }
  setLimb(l: StrikeLimb){this.limb=l;}
  private set(e:PointerEvent){this.pointer.set((e.clientX/innerWidth)*2-1,-(e.clientY/innerHeight)*2+1);}
  update(dt:number): WireInputFrame { this.ray.setFromCamera(this.pointer,this.camera); const hit=new Vector3(); this.ray.ray.intersectPlane(this.plane,hit); if(!hit.length()) hit.copy(this.base()); hit.x=Math.max(-4.5,Math.min(4.5,hit.x)); hit.z=Math.max(-2.5,Math.min(2.5,hit.z)); this.last.copy(this.cur); this.cur.copy(hit); this.vel.copy(this.cur).sub(this.last).multiplyScalar(1/Math.max(dt,.001)); const rv=this.release.clone(); this.release.set(0,0,0); return { crossTarget: hit.clone().add(new Vector3(0,1.2,0)), activeLimb:this.limb, strikeHeld:this.down, strikeTarget:hit, releaseVelocity:rv }; }
}
