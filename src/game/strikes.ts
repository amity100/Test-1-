import * as THREE from 'three';
import { LAW, type EnemyView, type RiftEndKind, type V3, type ZoneId } from '../core/contracts';
import { orientFrame, type RiftFrame } from './portalMath';
import type { RiftSystem } from './portals';
import type { CollisionWorld } from '../world/collision';

/**
 * STRIKES: three fixed rift attacks, one press each, no set-up. Both ends open
 * at once in your colours, do their one thing, and close by themselves.
 *
 *  1 MIRROR  a catch door in front of you facing him, the other end beside him
 *            facing him: his bullets (grenades, beams) come straight back.
 *  2 GEYSER  the floor opens under him and spits him up out of an end that
 *            faces the sky (over the water / the drop if there is one near).
 *  3 DROP    the floor opens under him and he comes out high up: over the
 *            water or off the edge if there's one near, else out of the sky.
 *
 * They run on rift charge (3): one each, slowly regained, and every kill your
 * own free rift work makes gives one back, so the two feed each other. The
 * free rift pair stays yours for everything else.
 */
export type StrikeId = 'mirror' | 'geyser' | 'drop';
export const STRIKES: StrikeId[] = ['mirror', 'geyser', 'drop'];

export const STRIKE = {
  /** Lock-on: enemies within this range, in sight, near the crosshair. */
  range: 32,
  /** Cone around the aim (radians) for picking the target. */
  cone: 0.42,
  /** Short lockout per strike after use (s). */
  cooldown: { mirror: 1.5, geyser: 1.5, drop: 1.5 } as Record<StrikeId, number>,
  /** Rift charge: a strike costs one; they come back slowly, and a kill your own rift work made refunds one. */
  maxCharges: 3,
  regen: 9,
  mirrorLife: 3.2,
  mirrorAside: 3.2,
  geyserSpeed: 21,
  geyserLife: 0.8,
  dropLife: 0.8,
  dropSky: 16,
  dropOut: 9,
  /** How far to look for water / a drop to send him into. */
  edgeSearch: 22,
};

export interface StrikeHost {
  rifts: RiftSystem;
  world: CollisionWorld;
  level: { seaY: number; isSea(p: V3): boolean };
  enemies: { list: readonly EnemyView[]; launch(v: EnemyView, vel?: V3): void };
  active: ReadonlySet<ZoneId>;
  playerFeet(): V3;
  playerEye(): V3;
  aimRay(): { origin: V3; dir: V3 };
}

export interface StrikeResult {
  ok: boolean;
  /** i18n key of why not. */
  reason?: string;
  target?: EnemyView;
  /** Where the show is (for FX / camera). */
  at?: V3;
}

type Frame = RiftFrame & { kind: RiftEndKind };

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

export class Strikes {
  readonly cd: Record<StrikeId, number> = { mirror: 0, geyser: 0, drop: 0 };
  /** 0..maxCharges (fractional: the next one filling up). */
  charges: number = STRIKE.maxCharges;
  /** The MIRROR in play: its exit keeps beside him, facing him. */
  private mirrorOn: { id: number; t: EnemyView; side: THREE.Vector3; life: number; pos: THREE.Vector3 } | null = null;

  constructor(private h: StrikeHost) {}

  reset() {
    for (const k of STRIKES) this.cd[k] = 0;
    this.charges = STRIKE.maxCharges;
    this.mirrorOn = null;
  }

  /** A kill your freeform rift work made: one charge back. */
  refund(n = 1) {
    this.charges = Math.min(STRIKE.maxCharges, this.charges + n);
  }

  update(dt: number) {
    for (const k of STRIKES) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.charges = Math.min(STRIKE.maxCharges, this.charges + dt / STRIKE.regen);
    const m = this.mirrorOn;
    if (m) {
      m.life -= dt;
      if (m.life <= 0) this.mirrorOn = null;
      // (he's down: the pair stays up for what's still in flight, it just stops following)
      else if (!m.t.alive) this.mirrorOn = null;
      else {
        // follow him (smoothly), always facing him
        const want = _a.set(m.t.pos.x + m.side.x * STRIKE.mirrorAside, m.t.pos.y, m.t.pos.z + m.side.z * STRIKE.mirrorAside);
        m.pos.lerp(want, 1 - Math.exp(-dt * 8));
        const face = _b.set(m.t.pos.x - m.pos.x, 0, m.t.pos.z - m.pos.z);
        if (face.lengthSq() > 1e-4) {
          const f = this.door(m.pos, face.normalize(), m.t.pos.y);
          if (f) this.h.rifts.moveStrikeExit(m.id, f);
        }
      }
    }
  }

  /** 0 = ready, 1 = just used (or no charge: how far the next one is from full). */
  cooling(id: StrikeId) {
    const lock = this.cd[id] / STRIKE.cooldown[id];
    return this.charges >= 1 ? lock : Math.max(lock, 1 - (this.charges % 1));
  }

  /** The enemy a strike would hit now: closest to the crosshair, in range and in sight. */
  target(): EnemyView | null {
    const { origin, dir } = this.h.aimRay();
    const eye = this.h.playerEye();
    let best: EnemyView | null = null;
    let bestScore = Infinity;
    for (const e of this.h.enemies.list) {
      if (!e.alive || !this.h.active.has(e.def.zone)) continue;
      const c = e.chest(_a);
      const d = c.distanceTo(eye);
      if (d > STRIKE.range) continue;
      _b.subVectors(c, origin);
      const along = _b.dot(dir);
      if (along <= 0) continue;
      const ang = Math.acos(Math.min(1, along / Math.max(1e-6, _b.length())));
      // a body right by the ray counts even if the angle is wide (close range)
      const off = _b.addScaledVector(dir, -along).length();
      if (ang > STRIKE.cone && off > 1.4) continue;
      if (!this.h.world.lineOfSight(eye, c)) continue;
      const score = ang + d * 0.004;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  fire(id: StrikeId): StrikeResult {
    if (this.cd[id] > 0) return { ok: false, reason: 'strike.cooldown' };
    if (this.charges < 1) return { ok: false, reason: 'strike.noCharge' };
    const t = this.target();
    if (!t) return { ok: false, reason: 'strike.noTarget' };
    // turrets are bolted down, and Voss only goes when he's stunned or down
    if (id !== 'mirror' && (t.kind === 'turret' || (t.kind === 'boss' && t.state !== 'stunned' && t.state !== 'downed'))) return { ok: false, reason: 'strike.anchored', target: t };
    const r = id === 'mirror' ? this.mirror(t) : id === 'geyser' ? this.geyser(t) : this.drop(t);
    if (r.ok) {
      this.cd[id] = STRIKE.cooldown[id];
      this.charges -= 1;
    }
    return r;
  }

  // ------------------------------------------------------------------

  private mirror(t: EnemyView): StrikeResult {
    const h = this.h;
    const feet = h.playerFeet();
    const tc = t.chest(new THREE.Vector3());
    // his side of you: a door 1.4 m out, its face toward him
    const toT = _a.set(tc.x - feet.x, 0, tc.z - feet.z);
    if (toT.lengthSq() < 1e-4) return { ok: false, reason: 'strike.tooClose' };
    toT.normalize();
    const catchAt = new THREE.Vector3(feet.x + toT.x * 1.4, feet.y, feet.z + toT.z * 1.4);
    const a = this.door(catchAt, toT);
    if (!a) return { ok: false, reason: 'gate.noSpace' };
    // beside him (whichever side is clear), facing him
    const side = _b.set(-toT.z, 0, toT.x);
    let b: Frame | null = null;
    let sideUsed = 1;
    for (const s of [1, -1]) {
      sideUsed = s;
      const p = new THREE.Vector3(t.pos.x + side.x * s * STRIKE.mirrorAside, t.pos.y, t.pos.z + side.z * s * STRIKE.mirrorAside);
      const face = new THREE.Vector3(t.pos.x - p.x, 0, t.pos.z - p.z).normalize();
      if (!h.world.lineOfSight(_c.set(p.x, t.pos.y + 1.2, p.z), tc)) continue;
      if (h.rifts.blocked(p)) continue;
      b = this.door(p, face, t.pos.y);
      if (b) break;
    }
    if (!b) return { ok: false, reason: 'gate.noSpace' };
    if (h.rifts.blocked(a.position)) return { ok: false, reason: 'gate.blocked' };
    const id = h.rifts.openStrike(a, b, STRIKE.mirrorLife, 0, t.id);
    this.mirrorOn = { id, t, side: side.clone().multiplyScalar(sideUsed), life: STRIKE.mirrorLife, pos: new THREE.Vector3(b.position.x, t.pos.y, b.position.z) };
    return { ok: true, target: t, at: b.position.clone() };
  }

  private geyser(t: EnemyView): StrikeResult {
    const h = this.h;
    const under = this.floorUnder(t);
    if (!under) return { ok: false, reason: 'strike.noFloor' };
    // over the water / the drop if there's one near, else right beside him
    const edge = this.findEdge(t, 3, STRIKE.edgeSearch);
    let at: THREE.Vector3;
    if (edge) at = edge.clone();
    else {
      at = new THREE.Vector3();
      let found = false;
      const f = new THREE.Vector3(t.pos.x - h.playerFeet().x, 0, t.pos.z - h.playerFeet().z).normalize();
      for (const ang of [0, 0.8, -0.8, 1.6, -1.6, Math.PI]) {
        const d = f.clone().applyAxisAngle(UP, ang);
        at.set(t.pos.x + d.x * 3, t.pos.y, t.pos.z + d.z * 3);
        const g = h.world.groundAt(at.x, at.z, 0.4, t.pos.y + 1);
        if (!(g > t.pos.y - 1.5) || !h.world.lineOfSight(_a.set(t.pos.x, t.pos.y + 1, t.pos.z), _b.set(at.x, g + 1, at.z))) continue;
        at.y = g;
        found = true;
        break;
      }
      if (!found) at.set(t.pos.x, t.pos.y, t.pos.z);
    }
    // the sky end: flat, facing up, a little off the ground; the ceiling decides how high he goes
    const out: Frame = { position: at.clone().setY(at.y + 0.35), quaternion: orientFrame(UP, new THREE.Vector3(0, 0, 1)), width: LAW.floorEndSize, height: LAW.floorEndSize, kind: 'air' };
    if (h.rifts.blocked(under.position) || h.rifts.blocked(out.position)) return { ok: false, reason: 'gate.blocked' };
    const ceil = h.world.ceilingAt(at.x, at.z, 0.4, at.y + 2);
    const room = Math.min(STRIKE.geyserSpeed, Math.sqrt(2 * LAW.gravity * Math.max(2, ceil - at.y - 2)));
    h.rifts.openStrike(under, out, STRIKE.geyserLife, room);
    h.enemies.launch(t, new THREE.Vector3(0, -7, 0));
    return { ok: true, target: t, at: out.position.clone() };
  }

  private drop(t: EnemyView): StrikeResult {
    const h = this.h;
    const under = this.floorUnder(t);
    if (!under) return { ok: false, reason: 'strike.noFloor' };
    const edge = this.findEdge(t, 3, STRIKE.edgeSearch);
    let out: Frame;
    let boost: number;
    if (edge) {
      // out over the edge: a door facing away from him, thrown out into the drop
      const face = new THREE.Vector3(edge.x - t.pos.x, 0, edge.z - t.pos.z).normalize();
      out = { position: new THREE.Vector3(edge.x, Math.max(edge.y, h.level.seaY + 1) + 1.2, edge.z), quaternion: orientFrame(face, UP), width: 1.3, height: 2.4, kind: 'air' };
      boost = STRIKE.dropOut;
    } else {
      // out of the sky above him: as high as the roof over him allows
      const g = under.position.y;
      const ceil = h.world.ceilingAt(t.pos.x, t.pos.z, 0.6, g + 2);
      const y = Math.min(g + STRIKE.dropSky, ceil - 0.6);
      if (y - g < 5) return { ok: false, reason: 'strike.noRoom' };
      const off = new THREE.Vector3(t.pos.x - h.playerFeet().x, 0, t.pos.z - h.playerFeet().z).normalize().multiplyScalar(1.5);
      out = { position: new THREE.Vector3(t.pos.x + off.x, y, t.pos.z + off.z), quaternion: orientFrame(DOWN, new THREE.Vector3(0, 0, 1)), width: LAW.floorEndSize, height: LAW.floorEndSize, kind: 'air' };
      boost = 8;
    }
    if (h.rifts.blocked(under.position) || h.rifts.blocked(out.position)) return { ok: false, reason: 'gate.blocked' };
    h.rifts.openStrike(under, out, STRIKE.dropLife, boost);
    h.enemies.launch(t, new THREE.Vector3(0, -7, 0));
    return { ok: true, target: t, at: out.position.clone() };
  }

  // ------------------------------------------------------------------

  /** A floor end right under his feet (on a surface rifts can take). */
  private floorUnder(t: EnemyView): Frame | null {
    const w = this.h.world;
    const g = w.groundAt(t.pos.x, t.pos.z, 0.05, t.pos.y + 0.3);
    const host = w.lastGround;
    if (!(g > -Infinity) || !host || host.noPortal || t.pos.y - g > 1.5) return null;
    return { position: new THREE.Vector3(t.pos.x, g + 0.01, t.pos.z), quaternion: orientFrame(UP, new THREE.Vector3(0, 0, 1)), width: LAW.floorEndSize, height: LAW.floorEndSize, kind: 'floor' };
  }

  /** Nearest point past an edge (the sea, or a drop of 12 m+) from him, or null. */
  private findEdge(t: EnemyView, minD: number, maxD: number): THREE.Vector3 | null {
    const h = this.h;
    const w = h.world;
    const from = _c.set(t.pos.x, t.pos.y + 1.2, t.pos.z);
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    const p = new THREE.Vector3();
    for (let d = minD; d <= maxD; d += 2.5) {
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        p.set(t.pos.x + Math.sin(a) * d, t.pos.y, t.pos.z + Math.cos(a) * d);
        const g = w.groundAt(p.x, p.z, 0.3, t.pos.y + 1);
        const sea = h.level.isSea(p) && !(g > h.level.seaY - 0.5);
        const drop = !(g > t.pos.y - 12);
        if (!sea && !drop) continue;
        // it must be open air there (not inside a wall) and reachable to look at
        if (w.ceilingAt(p.x, p.z, 0.3, t.pos.y + 0.5) < t.pos.y + 3.5) continue;
        if (!w.lineOfSight(from, _a.set(p.x, t.pos.y + 1.2, p.z))) continue;
        if (d < bestD) {
          bestD = d;
          best = p.clone().setY(sea ? Math.max(h.level.seaY, t.pos.y) : t.pos.y);
        }
      }
      if (best) break;
    }
    return best;
  }

  /** A standing door at `at` (on the ground there, else in the air), face along `face`. */
  private door(at: V3, face: V3, refY?: number): Frame | null {
    const w = this.h.world;
    const top = (refY ?? at.y) + 1;
    const g = w.groundAt(at.x, at.z, 0.3, top);
    const y = g > (refY ?? at.y) - 1.5 ? g : refY ?? at.y;
    const f = this.h.rifts.standingFrame(at.x, y, at.z, face);
    return { position: f.position.clone(), quaternion: f.quaternion.clone(), width: f.width, height: f.height, kind: 'stand' };
  }
}
