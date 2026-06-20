import './style.css';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { PhysicsWorld } from './core/PhysicsWorld';
import { SimulationClock } from './core/SimulationClock';
import { GAME_CONFIG } from './core/config';
import { Ragdoll } from './entities/Ragdoll';
import { MarionetteController } from './entities/MarionetteController';
import { LocalPointerInput } from './input/InputManager';
import { AIOpponent } from './game/AIOpponent';
import { MatchManager } from './game/MatchManager';
import { SceneManager } from './rendering/SceneManager';
import { RagdollRenderer } from './rendering/RagdollRenderer';
import { CameraRig } from './rendering/CameraRig';
import { VFX } from './rendering/VFX';
import { ClipRecorder } from './replay/ClipRecorder';
import { HUD } from './ui/HUD';
import { SFXManager } from './audio/SFXManager';

const app = document.querySelector<HTMLDivElement>('#app')!;
let sim: ReturnType<typeof createMatch>;
function createMatch(){
  app.innerHTML='';
  const scene = new SceneManager(app); const physics = new PhysicsWorld(); physics.addArena();
  const arena = new THREE.Mesh(new THREE.CylinderGeometry(GAME_CONFIG.arenaRadius, GAME_CONFIG.arenaRadius, .1, 64), new THREE.MeshStandardMaterial({color:0x8b5a2b,roughness:.9})); arena.position.y=-.05; scene.scene.add(arena);
  const player = new Ragdoll(physics,'Player',new THREE.Vector3(-1.2,0,0),'#d9904a'); const enemy = new Ragdoll(physics,'AI',new THREE.Vector3(1.2,0,0),'#6db4ff');
  const pr = new RagdollRenderer(scene.scene,player), er = new RagdollRenderer(scene.scene,enemy);
  const input = new LocalPointerInput(scene.renderer.domElement, scene.camera, () => player.center()); const pc = new MarionetteController(player,input,1); const ai = new AIOpponent(()=>enemy.center(),()=>player.center()); const ec = new MarionetteController(enemy,ai,-1);
  const match = new MatchManager(); const clock = new SimulationClock(); const cam = new CameraRig(scene.camera); const vfx = new VFX(scene.camera,scene.scene); const sfx = new SFXManager(); const recorder = new ClipRecorder(GAME_CONFIG.replaySeconds); const hud = new HUD(); hud.onLimb=l=>input.setLimb(l); hud.onRestart=()=>{sim=createMatch();};
  let elapsed=0, ended=false;
  const lines = new THREE.Group(); scene.scene.add(lines);
  function drawWire(a:THREE.Vector3,b:THREE.Vector3,color:number){ const g=new THREE.BufferGeometry().setFromPoints([a,b]); const l=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:.8})); lines.add(l); }
  function animate(){ requestAnimationFrame(animate); clock.tick((dt)=>{elapsed+=dt; pc.update(dt); ec.update(dt); physics.step(); recorder.record(elapsed,physics.snapshots()); match.update(dt,[player,enemy]); if(pc.justSnapped){sfx.snap();vfx.snap(player.center());} if(ec.justSnapped)vfx.snap(enemy.center()); if(match.result&&!ended){ended=true;sfx.ko(); hud.showResult(match.result, 'share' in navigator, async()=>{ const blob=await recorder.exportCanvas(scene.renderer.domElement); const file=new File([blob],'puppet-brawl.webm',{type:'video/webm'}); if(navigator.canShare?.({files:[file]})) await navigator.share({files:[file],title:'Puppet Brawl KO'}); else { const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=file.name; a.click(); }}); }}); pr.update(); er.update(); lines.clear(); for(const c of [pc,ec]){ const chest=c.ragdoll.bodies.get('chest')!.translation(); const hand=c.ragdoll.bodies.get(c.state.activeLimb)!.translation(); drawWire(c.cross,new THREE.Vector3(chest.x,chest.y,chest.z),0xffffff); drawWire(c.cross,new THREE.Vector3(hand.x,hand.y,hand.z),c.state.tension?0xffd166:0x6c757d);} cam.update([player.center(),enemy.center()]); vfx.update(1/60); hud.update(pc,ec); scene.render(); }
  animate(); return {scene,physics};
}
RAPIER.init().then(() => { sim = createMatch(); });
