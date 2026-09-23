import * as THREE from 'three';
import type { DynBody, PhysicsAPI, PropDef, PropSnap, TowerLevel, TrapTarget, ZoneId } from '../core/contracts';

export interface Prop {
  id: string;
  key: string;
  def: PropDef;
  body: DynBody;
  mesh: THREE.Object3D;
  alive: boolean;
  /** Still on its cable. */
  hanging: boolean;
  cable: THREE.Line | null;
  /** Seconds until a queued (chain) explosion. */
  fuse: number;
  /** Was released/pushed by the player (for CARGO credit). */
  touched: boolean;
  /** Mesh origin offset from the body's feet. */
  yOffset: number;
  /** Its zone is one the game runs (current ± 1); otherwise frozen and hidden. */
  active: boolean;
}

const _q = new THREE.Quaternion();
const _off = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Dynamic props: barrels, crates, hanging loads, containers. Every prop is a
 * physics body so it obeys the same rift laws as everything else (a load
 * dropped into an entrance falls out of the exit rift-charged: CARGO).
 */
export class PropSystem {
  group = new THREE.Group();
  items: Prop[] = [];
  private byBodyId = new Map<number, Prop>();
  private spawned = new Set<ZoneId>();
  private cableMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a });

  constructor(private physics: PhysicsAPI, private level: TowerLevel) {}

  spawnZone(zone: ZoneId) {
    if (this.spawned.has(zone)) return;
    this.spawned.add(zone);
    for (const def of this.level.props) if (def.zone === zone) this.spawn(def);
  }

  private spawn(def: PropDef) {
    const radius = Math.max(0.2, Math.max(def.size.x, def.size.z) * 0.5);
    const height = Math.max(0.2, def.size.y);
    const body = this.physics.createBody('prop', {
      pos: def.pos.clone(),
      radius,
      height,
      bounce: def.kind === 'barrel' ? 0.25 : 0.1,
      friction: def.kind === 'crate' ? 0.6 : 0.8,
      team: 'neutral',
      simulate: !def.hangFrom,
    });
    body.quat.setFromAxisAngle(UP, def.yaw);
    body.userData.propId = def.id;
    const mesh = this.level.propMesh(def);
    // meshes are authored centred; bodies stand on their feet
    const bb = new THREE.Box3().setFromObject(mesh);
    const yOffset = Number.isFinite(bb.min.y) ? -bb.min.y : height / 2;
    this.group.add(mesh);
    let cable: THREE.Line | null = null;
    if (def.hangFrom) {
      const g = new THREE.BufferGeometry().setFromPoints([def.hangFrom.clone(), def.pos.clone().setY(def.pos.y + height)]);
      cable = new THREE.Line(g, this.cableMat);
      cable.frustumCulled = false;
      this.group.add(cable);
    }
    const p: Prop = { id: def.id, key: `prop:${def.id}`, def, body, mesh, alive: true, hanging: !!def.hangFrom, cable, fuse: -1, touched: false, yOffset, active: true };
    this.items.push(p);
    this.byBodyId.set(body.id, p);
    this.syncMesh(p);
    return p;
  }

  byKey(key: string) {
    return this.items.find((p) => p.key === key) ?? null;
  }

  byBody(b: DynBody) {
    return this.byBodyId.get(b.id) ?? null;
  }

  /** Cut the cable: the load falls (and keeps whatever it does next). */
  release(p: Prop) {
    if (!p.hanging) return;
    p.hanging = false;
    p.touched = true;
    p.body.simulate = true;
    p.body.vel.set(0, -0.5, 0);
    if (p.cable) {
      p.cable.removeFromParent();
      p.cable.geometry.dispose();
      p.cable = null;
    }
  }

  remove(p: Prop) {
    if (!p.alive) return;
    p.alive = false;
    p.mesh.visible = false;
    p.body.enabled = false;
    this.physics.removeBody(p.body);
    if (p.cable) {
      p.cable.removeFromParent();
      p.cable = null;
    }
  }

  trapTargets(out: TrapTarget[]) {
    for (const p of this.items) {
      if (!p.alive || !p.active || p.body.userData.manual) continue;
      out.push({ key: p.key, pos: p.body.pos, radius: p.body.radius, height: p.body.height, canFall: true, steady: false });
    }
    return out;
  }

  /** Props of zones the game isn't running sleep: no physics, not drawn. */
  setActive(zones: ReadonlySet<ZoneId>) {
    for (const p of this.items) {
      const on = zones.has(p.def.zone);
      if (on === p.active) continue;
      p.active = on;
      if (!p.alive) continue;
      p.mesh.visible = on;
      if (p.cable) p.cable.visible = on;
      if (!p.body.userData.carried) p.body.enabled = on;
    }
  }

  private syncMesh(p: Prop) {
    p.mesh.position.copy(p.body.pos);
    // rotate about the body centre, keep the feet on the floor when upright
    _q.copy(p.body.quat);
    p.mesh.quaternion.copy(_q);
    p.mesh.position.add(_off.set(0, p.yOffset, 0).applyQuaternion(_q));
  }

  update(dt: number) {
    for (const p of this.items) {
      if (!p.alive || !p.active) continue;
      if (p.hanging) {
        // gentle sway on the cable
        p.body.vel.set(0, 0, 0);
      }
      this.syncMesh(p);
      if (p.cable) {
        const a = p.cable.geometry.getAttribute('position') as THREE.BufferAttribute;
        a.setXYZ(1, p.body.pos.x, p.body.pos.y + p.body.height, p.body.pos.z);
        a.needsUpdate = true;
      }
      // tumbling props settle upright-ish once they rest
      if (p.body.onGround && p.body.vel.lengthSq() < 0.5) p.body.spin.multiplyScalar(Math.exp(-dt * 6));
    }
  }

  snapshot(): PropSnap[] {
    const out: PropSnap[] = [];
    // only what can be seen; applySnapshot hides the rest
    for (const p of this.items) {
      if (!p.alive || !p.active) continue;
      out.push({ key: p.key, pos: [p.body.pos.x, p.body.pos.y, p.body.pos.z], quat: [p.body.quat.x, p.body.quat.y, p.body.quat.z, p.body.quat.w], visible: true });
    }
    return out;
  }

  applySnapshot(s: PropSnap[]) {
    for (const p of this.items) p.mesh.visible = false;
    for (const ps of s) {
      const p = this.byKey(ps.key);
      if (!p) continue;
      p.body.pos.set(ps.pos[0], ps.pos[1], ps.pos[2]);
      p.body.quat.set(ps.quat[0], ps.quat[1], ps.quat[2], ps.quat[3]);
      p.mesh.visible = ps.visible;
      this.syncMesh(p);
    }
  }

  clear() {
    for (const p of this.items) {
      p.mesh.removeFromParent();
      p.cable?.removeFromParent();
      if (p.alive) this.physics.removeBody(p.body);
    }
    this.items = [];
    this.byBodyId.clear();
    this.spawned.clear();
  }
}
