import * as THREE from 'three';
import { LAW } from '../core/contracts';
import type { ActorHit, DynBody, PhysicsAPI, Projectile, ProjectileAPI, ProjectileHooks, ProjectileKind, RaySegment, RiftEnd, RiftQuery, Team, V3 } from '../core/contracts';
import type { CollisionWorld } from '../world/collision';
import { crossing, passDirection, passPoint } from '../game/portalMath';
import type { Body } from './physics';

const MAX_BOLTS = 64;
const BOLT_LEN = 0.9;
const BOLT_LOOP_WINDOW = 1;
const BOLT_CAGE_LIFE = 10;
const BOLT_HOPS = 4;

const KESSLER = new THREE.Color(2.6, 0.55, 0.18);
const CHARGED = new THREE.Color(0.35, 2.1, 2.8);

let nextProjId = 1;

class Proj implements Projectile {
  readonly id = nextProjId++;
  charged = false;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  damage = 0;
  age = 0;
  life = 1;
  crossings = 0;
  loops = 0;
  alive = true;
  body: DynBody | null = null;
  segments: RaySegment[] = [];
  beamDir?: V3;
  hitIds?: Set<string>;
  lastEndId: number | null = null;
  firedAt = 0;
  // internal
  lastEnd: RiftEnd | null = null;
  lastCrossT = -1e9;
  /** Beams: actors that stopped the beam; grenades: body crossing time seen. */
  stopKeys: Set<string> | null = null;
  bodyCrossT = -1e9;
  worldId = -1;
  crossedEnds: Set<number> | null = null;

  constructor(public kind: ProjectileKind, public team: Team, public owner: number | 'player' | null) {}
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _e = new THREE.Vector3();
const _stop = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const Z = new THREE.Vector3(0, 0, 1);
const Y = new THREE.Vector3(0, 1, 0);

/**
 * Kessler bolts (straight, fast, instanced), grenades (physics bodies with a
 * fuse) and beams (raycasts through up to two rifts). Crossing a rift
 * charges a projectile; the game decides damage / IFF in the hooks.
 * Vectors handed to hitTest are scratch: clone them to keep them.
 */
export class Projectiles implements ProjectileAPI {
  readonly list: Projectile[] = [];
  readonly group = new THREE.Group();
  private time = 0;

  private bolts: THREE.InstancedMesh;
  private grenadeMeshes: THREE.Mesh[] = [];
  private grenadeGeo = new THREE.SphereGeometry(0.13, 10, 8);
  private grenadeMat: THREE.MeshBasicMaterial;
  private grenadeMatCharged: THREE.MeshBasicMaterial;
  private beamCores: THREE.Mesh[] = [];
  private beamGlows: THREE.Mesh[] = [];
  private beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  private coreMat: THREE.MeshBasicMaterial;
  private coreMatCharged: THREE.MeshBasicMaterial;
  private glowMat: THREE.MeshBasicMaterial;
  private glowMatCharged: THREE.MeshBasicMaterial;

  constructor(private world: CollisionWorld, private rifts: RiftQuery, private physics: PhysicsAPI, private hooks: ProjectileHooks) {
    const add = (color: THREE.Color, opacity: number) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const boltGeo = new THREE.CylinderGeometry(0.045, 0.02, 1, 6, 1, true).rotateX(Math.PI / 2);
    this.bolts = new THREE.InstancedMesh(boltGeo, add(new THREE.Color(1, 1, 1), 1), MAX_BOLTS);
    this.bolts.frustumCulled = false;
    this.bolts.count = 0;
    this.bolts.setColorAt(0, KESSLER); // allocate instance colours now (no shader variant switch later)
    this.group.add(this.bolts);

    this.grenadeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.3, 0.12), toneMapped: false });
    this.grenadeMatCharged = new THREE.MeshBasicMaterial({ color: CHARGED, toneMapped: false });
    this.coreMat = add(KESSLER, 1);
    this.coreMatCharged = add(CHARGED, 1);
    this.glowMat = add(KESSLER, 0.28);
    this.glowMatCharged = add(CHARGED, 0.28);
    for (let i = 0; i < 6; i++) this.grenadeMesh(i);
    for (let i = 0; i < 6; i++) this.beamMesh(i);
  }

  private grenadeMesh(i: number) {
    while (this.grenadeMeshes.length <= i) {
      const m = new THREE.Mesh(this.grenadeGeo, this.grenadeMat);
      m.visible = false;
      this.grenadeMeshes.push(m);
      this.group.add(m);
    }
    return this.grenadeMeshes[i];
  }

  private beamMesh(i: number) {
    while (this.beamCores.length <= i) {
      const core = new THREE.Mesh(this.beamGeo, this.coreMat);
      const glow = new THREE.Mesh(this.beamGeo, this.glowMat);
      core.visible = glow.visible = false;
      core.frustumCulled = glow.frustumCulled = false;
      this.beamCores.push(core);
      this.beamGlows.push(glow);
      this.group.add(core, glow);
    }
    return i;
  }

  fireBolt(from: V3, dir: V3, team: Team, owner: number | 'player' | null, opts: { speed?: number; damage?: number } = {}): Projectile {
    const p = new Proj('bolt', team, owner);
    p.pos.copy(from);
    p.vel.copy(dir).normalize().multiplyScalar(opts.speed ?? LAW.bolt.speed);
    p.damage = opts.damage ?? LAW.bolt.damageToPlayer;
    p.life = LAW.bolt.life;
    p.firedAt = this.time;
    this.list.push(p);
    return p;
  }

  throwGrenade(from: V3, vel: V3, team: Team, owner: number | 'player' | null, fuse: number = LAW.grenade.fuse): Projectile {
    const p = new Proj('grenade', team, owner);
    const r = LAW.grenade.bodyRadius;
    p.pos.copy(from);
    p.vel.copy(vel);
    p.damage = LAW.grenade.damage;
    p.life = fuse;
    p.firedAt = this.time;
    const b = this.physics.createBody('grenade', { pos: _a.set(from.x, from.y - r, from.z), radius: r, height: r * 2, bounce: LAW.grenade.bounce, friction: 0.35, team });
    b.vel.copy(vel);
    b.spin.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
    b.userData.projectile = p.id;
    p.body = b;
    this.list.push(p);
    return p;
  }

  fireBeam(from: V3, dir: V3, team: Team, owner: number | 'player' | null, duration: number = LAW.beam.duration, damage: number = LAW.beam.damage): Projectile {
    const p = new Proj('beam', team, owner);
    p.pos.copy(from);
    p.beamDir = dir.clone().normalize();
    p.vel.copy(p.beamDir);
    p.damage = damage;
    p.life = duration;
    p.firedAt = this.time;
    p.hitIds = new Set();
    p.stopKeys = new Set();
    p.crossedEnds = new Set();
    this.list.push(p);
    this.updateBeam(p);
    return p;
  }

  update(dt: number, time: number) {
    this.time = time;
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const p = list[i] as Proj;
      if (!p.alive) continue;
      p.age += dt;
      if (p.kind === 'bolt') this.updateBolt(p, dt);
      else if (p.kind === 'grenade') this.updateGrenade(p);
      else if (p.age >= p.life) p.alive = false;
      else this.updateBeam(p);
    }
    // drop the dead (in place)
    let k = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.alive) list[k++] = p;
      else if (p.body) {
        this.physics.removeBody(p.body);
        p.body = null;
      }
    }
    list.length = k;
    this.draw();
  }

  clear() {
    for (const p of this.list) {
      p.alive = false;
      if (p.body) {
        this.physics.removeBody(p.body);
        p.body = null;
      }
    }
    this.list.length = 0;
    this.draw();
  }

  // ------------------------------------------------------------------

  private updateBolt(p: Proj, dt: number) {
    if (p.age >= p.life) {
      p.alive = false;
      return;
    }
    const speed = p.vel.length();
    let remaining = dt;
    _a.copy(p.pos);
    for (let hop = 0; hop < BOLT_HOPS && remaining > 0; hop++) {
      _b.copy(_a).addScaledVector(p.vel, remaining);
      const segLen = speed * remaining;
      const end = this.rifts.findCrossing(_a, _b, 0);
      const tc = end ? crossing(end, _a, _b, 0) : 2;
      _d.copy(p.vel).divideScalar(speed || 1);
      const hit = this.world.raycast(_a, _d, segLen, { sight: true });
      const tw = hit ? hit.distance / Math.max(segLen, 1e-6) : 2;
      // a wall end sits on its wall: the rift wins the tie
      const viaRift = !!end && tc >= 0 && tc <= tw + 0.05 / Math.max(segLen, 1e-6);
      const tStop = Math.min(1, viaRift ? tc : tw);
      _stop.copy(_a).lerp(_b, tStop);
      if (this.hitActors(p, _a, _stop, LAW.bolt.radius)) return;
      if (viaRift && end) {
        const to = end.linked;
        passPoint(end, to, _stop, _a);
        passDirection(end, to, p.vel, _c);
        p.vel.copy(_c);
        _a.addScaledVector(to.normal, 1e-3);
        const looping = p.lastEnd !== null && this.time - p.lastCrossT < BOLT_LOOP_WINDOW && (end === p.lastEnd || end.linked === p.lastEnd || p.lastEnd.linked === end);
        p.loops = looping ? p.loops + 1 : 1;
        if (p.loops >= 2) p.life = Math.max(p.life, BOLT_CAGE_LIFE);
        p.charged = true;
        p.crossings++;
        p.lastEnd = to;
        p.lastCrossT = this.time;
        p.lastEndId = to.id;
        p.hitIds?.clear(); // a returned bolt may hit its shooter
        this.rifts.notePass(end, 'bolt');
        p.pos.copy(_a); // hooks see where it came out (and may steer p.vel)
        this.hooks.onCross(p, end, to);
        remaining *= 1 - tc;
        continue;
      }
      if (hit && tw <= 1) {
        p.pos.copy(hit.point);
        this.hooks.onHitWorld(p, hit);
        p.alive = false;
        return;
      }
      _a.copy(_b);
      remaining = 0;
    }
    p.pos.copy(_a);
  }

  /** Actor hits along a→b; true when the projectile stopped. */
  private hitActors(p: Proj, a: V3, b: V3, radius: number): boolean {
    _c.copy(a);
    _d.subVectors(b, a);
    const len = _d.length();
    if (len < 1e-6) return false;
    _d.divideScalar(len);
    for (let k = 0; k < 4; k++) {
      const h: ActorHit | null = this.hooks.hitTest(_c, b, radius, p);
      if (!h) return false;
      if (p.hitIds?.has(h.key)) {
        // already went through him: look past
        _c.copy(h.point).addScaledVector(_d, 0.6);
        if (_s.subVectors(b, _c).dot(_d) <= 0) return false;
        continue;
      }
      if (this.hooks.onHitActor(p, h) === 'stop') {
        p.pos.copy(h.point);
        p.alive = false;
        return true;
      }
      if (!p.hitIds) p.hitIds = new Set();
      p.hitIds.add(h.key);
      _c.copy(h.point).addScaledVector(_d, 0.05);
      if (_s.subVectors(b, _c).dot(_d) <= 0) return false;
    }
    return false;
  }

  private updateGrenade(p: Proj) {
    const b = p.body;
    if (!b) {
      p.alive = false;
      return;
    }
    p.pos.set(b.pos.x, b.pos.y + b.radius, b.pos.z);
    p.vel.copy(b.vel);
    if (b.lastCrossT !== p.bodyCrossT && b.lastEnd) {
      p.bodyCrossT = b.lastCrossT;
      // latched: a caught grenade stays charged until it goes off (POSTAGE)
      p.charged = true;
      p.crossings++;
      p.loops = b.loops;
      p.lastEndId = b.lastEnd.id;
      const from = (b as Body).lastFrom ?? b.lastEnd.linked;
      this.hooks.onCross(p, from, b.lastEnd);
    }
    if (p.age >= p.life) {
      this.hooks.onExplode(p, p.pos);
      p.alive = false;
    }
  }

  private updateBeam(p: Proj) {
    let segs = this.rifts.raycastThrough(p.pos, p.beamDir!, LAW.beam.range, this.world, LAW.beam.maxHops);
    // out of the first rift it crosses, the game may bend it onto a target
    const k = segs.findIndex((s, i) => !!s.viaEnd && i < segs.length - 1);
    if (k >= 0 && this.hooks.steer) {
      const next = segs[k + 1];
      _e.subVectors(next.to, next.from);
      // (never bent back into the end it just left)
      if (_e.lengthSq() > 1e-8 && this.hooks.steer(p, next.from, _e.normalize()) && _e.dot(segs[k].viaEnd!.linked.normal) > 0.1) {
        let used = 0;
        for (let i = 0; i <= k; i++) used += segs[i].from.distanceTo(segs[i].to);
        const tail = this.rifts.raycastThrough(next.from, _e, Math.max(1, LAW.beam.range - used), this.world, Math.max(0, LAW.beam.maxHops - 1));
        for (const t of tail) t.charged = true;
        segs = segs.slice(0, k + 1).concat(tail);
      }
    }
    p.segments = segs;
    let crossings = 0;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (seg.viaEnd && i < segs.length - 1) {
        crossings++;
        const to = seg.viaEnd.linked;
        p.lastEndId = to.id;
        this.rifts.notePass(seg.viaEnd, 'beam');
        if (!p.crossedEnds!.has(seg.viaEnd.id)) {
          p.crossedEnds!.add(seg.viaEnd.id);
          this.hooks.onCross(p, seg.viaEnd, to);
        }
      }
      p.charged = seg.charged;
      if (this.beamActors(p, seg)) {
        segs.length = i + 1;
        break;
      }
      if (seg.hit && i === segs.length - 1 && seg.hit.collider.id !== p.worldId) {
        p.worldId = seg.hit.collider.id;
        this.hooks.onHitWorld(p, seg.hit);
      }
    }
    p.crossings = Math.max(p.crossings, crossings);
    p.loops = crossings;
  }

  /** Damages each actor once per beam; true when an actor stops the beam (segment cut there). */
  private beamActors(p: Proj, seg: RaySegment): boolean {
    _c.copy(seg.from);
    _d.subVectors(seg.to, seg.from);
    const len = _d.length();
    if (len < 1e-6) return false;
    _d.divideScalar(len);
    for (let k = 0; k < 4; k++) {
      // through a rift the beam comes out wider (easier to put on a line of them)
      const h = this.hooks.hitTest(_c, seg.to, seg.charged ? 0.7 : 0.2, p);
      if (!h) return false;
      if (p.stopKeys!.has(h.key)) {
        seg.to = h.point.clone();
        seg.hit = null;
        return true;
      }
      if (!p.hitIds!.has(h.key)) {
        p.hitIds!.add(h.key);
        if (this.hooks.onHitActor(p, h) === 'stop') {
          p.stopKeys!.add(h.key);
          seg.to = h.point.clone();
          seg.hit = null;
          return true;
        }
      }
      _c.copy(h.point).addScaledVector(_d, 0.6);
      if (_s.subVectors(seg.to, _c).dot(_d) <= 0) return false;
    }
    return false;
  }

  // ------------------------------------------------------------------
  // Visuals
  // ------------------------------------------------------------------

  private draw() {
    let nb = 0, ng = 0, ns = 0;
    for (const p of this.list as Proj[]) {
      if (!p.alive) continue;
      if (p.kind === 'bolt') {
        if (nb >= MAX_BOLTS) continue;
        const sp = p.vel.length();
        if (sp < 1e-6) continue;
        _d.copy(p.vel).divideScalar(sp);
        const len = Math.min(BOLT_LEN, p.age * sp + 0.05);
        _a.copy(p.pos).addScaledVector(_d, -len * 0.5);
        _q.setFromUnitVectors(Z, _d);
        _m.compose(_a, _q, _s.set(1, 1, len));
        this.bolts.setMatrixAt(nb, _m);
        this.bolts.setColorAt(nb, p.charged ? CHARGED : KESSLER);
        nb++;
      } else if (p.kind === 'grenade' && p.body) {
        const m = this.grenadeMesh(ng++);
        m.visible = true;
        m.position.copy(p.pos);
        m.quaternion.copy(p.body.quat);
        m.material = p.charged ? this.grenadeMatCharged : this.grenadeMat;
        // blink faster as the fuse runs out
        const left = Math.max(0, p.life - p.age);
        m.scale.setScalar(1 + 0.25 * Math.max(0, Math.sin(p.age * (8 + 30 / (left + 0.3)))));
      } else if (p.kind === 'beam') {
        const fade = 1 - Math.max(0, (p.age - p.life * 0.6) / (p.life * 0.4));
        for (const seg of p.segments) {
          const i = this.beamMesh(ns++);
          const core = this.beamCores[i], glow = this.beamGlows[i];
          _d.subVectors(seg.to, seg.from);
          const len = _d.length();
          if (len < 1e-4) {
            core.visible = glow.visible = false;
            continue;
          }
          _d.divideScalar(len);
          _q.setFromUnitVectors(Y, _d);
          const k = 0.4 + 0.6 * fade;
          placeCylinder(core, seg.from, len, 0.035 * k);
          placeCylinder(glow, seg.from, len, 0.13 * k);
          core.material = seg.charged ? this.coreMatCharged : this.coreMat;
          glow.material = seg.charged ? this.glowMatCharged : this.glowMat;
        }
      }
    }
    this.bolts.count = nb;
    this.bolts.instanceMatrix.needsUpdate = true;
    if (this.bolts.instanceColor) this.bolts.instanceColor.needsUpdate = true;
    for (let i = ng; i < this.grenadeMeshes.length; i++) this.grenadeMeshes[i].visible = false;
    for (let i = ns; i < this.beamCores.length; i++) this.beamCores[i].visible = this.beamGlows[i].visible = false;
  }
}

/** Unit cylinder from `from` along _d (orientation in _q) with length and radius. */
function placeCylinder(m: THREE.Mesh, from: V3, len: number, r: number) {
  m.visible = true;
  m.position.copy(from).addScaledVector(_d, len * 0.5);
  m.quaternion.copy(_q);
  m.scale.set(r, len, r);
}
