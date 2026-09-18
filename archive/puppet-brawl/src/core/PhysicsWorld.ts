import RAPIER from '@dimforge/rapier3d-compat';
import { GAME_CONFIG } from './config';

export type BodySnapshot = { id: string; position: {x:number;y:number;z:number}; rotation: {x:number;y:number;z:number;w:number} };
export class PhysicsWorld {
  readonly world: RAPIER.World;
  private ids = new Map<number, string>();
  constructor() { this.world = new RAPIER.World(GAME_CONFIG.gravity); this.world.timestep = 1 / GAME_CONFIG.physicsHz; }
  register(handle: number, id: string) { this.ids.set(handle, id); }
  step() { this.world.step(); }
  snapshots(): BodySnapshot[] { const out: BodySnapshot[] = []; this.world.forEachRigidBody((b) => { const id = this.ids.get(b.handle); if (!id) return; out.push({ id, position: b.translation(), rotation: b.rotation() }); }); return out; }
  addArena() {
    const ground = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.05, 0));
    this.world.createCollider(RAPIER.ColliderDesc.cylinder(0.08, GAME_CONFIG.arenaRadius).setFriction(1.2).setRestitution(0.2), ground);
  }
}
