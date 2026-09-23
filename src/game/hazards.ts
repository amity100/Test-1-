import * as THREE from 'three';
import type { EnemyView, HazardDef, LaserDef, RaySegment, RiftQuery, TowerLevel, V3, ZoneId } from '../core/contracts';
import type { CollisionWorld } from '../world/collision';

/** What a hazard does to someone (the game applies it). */
export interface HazardHooks {
  /** Kessler's lasers / the trench hurt the player (IFF: never once a laser went through your rift). */
  hurtPlayer(amount: number, at: V3, push: V3): void;
  /** A laser that crossed your rift cuts Kessler; the trench fries anyone off balance in it. */
  hitEnemy(e: EnemyView, amount: number, at: V3, viaRift: boolean): void;
}

interface Laser {
  def: LaserDef;
  segs: RaySegment[];
  core: THREE.Mesh[];
  glow: THREE.Mesh[];
}

interface Trench {
  def: HazardDef;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  on: boolean;
  /** Who it already hit this pulse. */
  hit: Set<string>;
}

const MAX_SEGS = 3;
/** How far a laser reaches past a rift it went into. */
const REDIRECT_RANGE = 40;
const RED = new THREE.Color(5, 0.35, 0.25);
const RED_GLOW = new THREE.Color(1.6, 0.12, 0.08);
const CYAN = new THREE.Color(0.4, 2.4, 3.6);
const CYAN_GLOW = new THREE.Color(0.1, 0.7, 1.1);
const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _push = new THREE.Vector3();

/**
 * The lab's laser curtains and electric trench. Lasers are rays that go
 * through open rifts like a beam: put your entrance in one and it comes out
 * of your exit, clearing the doorway and cutting whatever Kessler it finds.
 */
export class Hazards {
  readonly group = new THREE.Group();
  private lasers: Laser[] = [];
  private trenches: Trench[] = [];
  private playerCd = 0;
  /** Where the player was last frame (which side of a curtain they came from). */
  private lastPlayer = new THREE.Vector3();
  private lastPlayerSet = false;
  private coreMat = new THREE.MeshBasicMaterial({ color: RED, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  private glowMat = new THREE.MeshBasicMaterial({ color: RED_GLOW, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  private coreMatC = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  private glowMatC = new THREE.MeshBasicMaterial({ color: CYAN_GLOW, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

  constructor(
    level: TowerLevel,
    private world: CollisionWorld,
    private rifts: RiftQuery,
    mobile: boolean,
  ) {
    const core = new THREE.CylinderGeometry(0.012, 0.012, 1, 6, 1, true);
    const glow = new THREE.CylinderGeometry(0.05, 0.05, 1, 8, 1, true);
    for (const def of level.lasers) {
      const l: Laser = { def, segs: [], core: [], glow: [] };
      for (let i = 0; i < MAX_SEGS; i++) {
        const c = new THREE.Mesh(core, this.coreMat);
        c.frustumCulled = false;
        c.visible = false;
        this.group.add(c);
        l.core.push(c);
        if (!mobile) {
          const g = new THREE.Mesh(glow, this.glowMat);
          g.frustumCulled = false;
          g.visible = false;
          this.group.add(g);
          l.glow.push(g);
        }
      }
      this.lasers.push(l);
    }
    for (const def of level.hazards) {
      if (def.kind !== 'electric') continue;
      const size = def.box.getSize(new THREE.Vector3());
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, 0.04, size.z), mat);
      mesh.position.set((def.box.min.x + def.box.max.x) / 2, def.box.min.y + 0.06, (def.box.min.z + def.box.max.z) / 2);
      this.group.add(mesh);
      this.trenches.push({ def, mesh, mat, on: false, hit: new Set() });
    }
  }

  /** Is the trench live now (it pulses: 1 s on every period). */
  static live(def: HazardDef, time: number) {
    return time % def.period < 1;
  }

  update(dt: number, time: number, active: Set<ZoneId>, player: { pos: V3; vel: V3; radius: number; height: number; alive: boolean }, enemies: readonly EnemyView[], hooks: HazardHooks) {
    this.playerCd = Math.max(0, this.playerCd - dt);
    if (!this.lastPlayerSet) {
      this.lastPlayer.copy(player.pos);
      this.lastPlayerSet = true;
    }
    for (const l of this.lasers) {
      const on = active.has(l.def.zone);
      if (!on) {
        for (const m of l.core) m.visible = false;
        for (const m of l.glow) m.visible = false;
        continue;
      }
      // the emitter pair spans `length`; what goes into a rift on the way reaches much further
      const segs = this.rifts.raycastThrough(l.def.from, l.def.dir, l.def.length + REDIRECT_RANGE, this.world, 2);
      const first = segs[0];
      const firstLen = first ? first.from.distanceTo(first.to) : 0;
      if (first && (!first.viaEnd || firstLen > l.def.length)) {
        first.to.copy(first.from).addScaledVector(_d.copy(l.def.dir).normalize(), Math.min(l.def.length, firstLen));
        first.viaEnd = null;
        first.hit = null;
        segs.length = 1;
      }
      l.segs = segs;
      for (let i = 0; i < MAX_SEGS; i++) {
        const s = l.segs[i];
        const c = l.core[i], g = l.glow[i];
        if (!s) {
          c.visible = false;
          if (g) g.visible = false;
          continue;
        }
        place(c, s.from, s.to);
        c.material = s.charged ? this.coreMatC : this.coreMat;
        if (g) {
          place(g, s.from, s.to);
          g.material = s.charged ? this.glowMatC : this.glowMat;
        }
        // a live curtain is a wall to you: it burns and throws you back to the side you came from
        if (!s.charged && player.alive && crosses(s, player.pos, player.radius, player.height)) {
          closest(s, player.pos, _p);
          _push.set(-(s.to.z - s.from.z), 0, s.to.x - s.from.x).normalize();
          const side = Math.sign((this.lastPlayer.x - _p.x) * _push.x + (this.lastPlayer.z - _p.z) * _push.z) || 1;
          _push.multiplyScalar(side);
          const off = (player.pos.x - _p.x) * _push.x + (player.pos.z - _p.z) * _push.z;
          const need = player.radius + 0.06 - off;
          if (need > 0) {
            player.pos.x += _push.x * need;
            player.pos.z += _push.z * need;
          }
          const into = player.vel.x * _push.x + player.vel.z * _push.z;
          if (into < 0) {
            player.vel.x -= _push.x * into;
            player.vel.z -= _push.z * into;
          }
          if (this.playerCd <= 0) {
            this.playerCd = 0.8;
            hooks.hurtPlayer(20, _p.clone(), _push.clone().multiplyScalar(5).setY(2));
          }
        }
        if (s.charged) {
          for (const e of enemies) {
            if (!e.alive || !active.has(e.def.zone)) continue;
            if (crosses(s, e.pos, e.radius, e.height)) hooks.hitEnemy(e, 999, closest(s, e.pos, new THREE.Vector3()), true);
          }
        }
      }
    }
    for (const tr of this.trenches) {
      const on = active.has(tr.def.zone) && Hazards.live(tr.def, time);
      if (on !== tr.on) {
        tr.on = on;
        tr.hit.clear();
      }
      tr.mesh.visible = active.has(tr.def.zone);
      tr.mat.opacity = on ? 0.55 + 0.25 * Math.sin(time * 60) : 0.04;
      if (!on) continue;
      const b = tr.def.box;
      const inside = (p: V3) => p.x > b.min.x && p.x < b.max.x && p.z > b.min.z && p.z < b.max.z && p.y > b.min.y - 0.2 && p.y < b.max.y;
      if (player.alive && !tr.hit.has('player') && inside(player.pos)) {
        tr.hit.add('player');
        hooks.hurtPlayer(30, player.pos.clone(), new THREE.Vector3(0, 5, 0));
      }
      for (const e of enemies) {
        if (!e.alive || tr.hit.has(`e${e.id}`) || !inside(e.pos)) continue;
        // Kessler walk their own lab safely; knocked about, they're fair game
        if (e.offBalance && e.state !== 'idle' && e.state !== 'patrol' && e.state !== 'suspicious') {
          tr.hit.add(`e${e.id}`);
          hooks.hitEnemy(e, 999, e.pos.clone(), false);
        }
      }
    }
    this.lastPlayer.copy(player.pos);
  }
}

function place(m: THREE.Mesh, a: V3, b: V3) {
  _d.subVectors(b, a);
  const len = _d.length();
  m.visible = len > 1e-3;
  if (!m.visible) return;
  m.position.copy(a).addScaledVector(_d, 0.5);
  m.quaternion.setFromUnitVectors(UP, _d.divideScalar(len));
  m.scale.set(1, len, 1);
}

/** Closest point of the segment to a body's axis (at the segment's height). */
function closest(s: RaySegment, pos: V3, out: THREE.Vector3) {
  _a.copy(s.from);
  _b.subVectors(s.to, s.from);
  const L2 = _b.x * _b.x + _b.z * _b.z;
  const t = L2 > 1e-8 ? Math.max(0, Math.min(1, ((pos.x - _a.x) * _b.x + (pos.z - _a.z) * _b.z) / L2)) : 0;
  return out.copy(_a).addScaledVector(_b, t);
}

/** Does a (roughly horizontal) segment pass through a standing body's capsule? */
function crosses(s: RaySegment, pos: V3, radius: number, height: number) {
  closest(s, pos, _p);
  if (_p.y < pos.y - 0.05 || _p.y > pos.y + height) return false;
  return Math.hypot(_p.x - pos.x, _p.z - pos.z) <= radius + 0.04;
}
