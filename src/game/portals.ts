import * as THREE from 'three';
import { FEEL } from '../config';
import { LAW } from '../core/contracts';
import type {
  BodyKind,
  EntranceContext,
  EntranceMode,
  EntranceResult,
  ExitAim,
  ExitOrientation,
  RaySegment,
  RiftAPI,
  RiftEnd,
  RiftEndKind,
  RiftOwner,
  RiftRole,
  RiftSnap,
  ShearVictim,
  TrapTarget,
  V3,
} from '../core/contracts';
import type { Collider, CollisionWorld, RayHit } from '../world/collision';
import { createPortalMaterial, createSparks, PORTAL_MESH_SCALE } from '../render/portalMaterial';
import { crossing, frameNormal, orientFrame, passDirection, passPoint, passRotation, RiftFrame, toLocal, yawOf } from './portalMath';

export const RIFT_COLOR = new THREE.Color(1.0, 0.55, 0.12);
export const ANCHOR_COLOR = new THREE.Color(0.1, 0.85, 1.0);
export const GATE_COLOR = new THREE.Color(1.0, 0.15, 0.2);
export const BOSS_COLOR = new THREE.Color(0.75, 0.2, 1.0);

export type RiftColorKey = RiftSnap['color'];
const COLORS: Record<RiftColorKey, THREE.Color> = { entrance: RIFT_COLOR, exit: ANCHOR_COLOR, gate: GATE_COLOR, boss: BOSS_COLOR };

/** Preview colours: invalid, and what happens to something falling out. */
const INVALID_COLOR = new THREE.Color(1, 0.18, 0.12);
const OUTCOME_COLOR: Record<ExitAim['outcome'], THREE.Color> = {
  safe: new THREE.Color(0.15, 1, 0.85),
  stars: new THREE.Color(1, 0.85, 0.2),
  skull: new THREE.Color(1, 0.42, 0.1),
  splash: new THREE.Color(0.25, 0.6, 1),
  void: new THREE.Color(0.75, 0.35, 1),
};

const DOOR_W: number = FEEL.portalWidth;
const DOOR_H: number = FEEL.portalHeight;
const FLAT: number = LAW.floorEndSize;
/** Air ends the falling player drops into are a bit more forgiving. */
const CATCH_FLAT = 1.9;
const SHEAR_BAND = 0.45;
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _l = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _camPos = new THREE.Vector3();
const _camQuat = new THREE.Quaternion();
const _bd = new THREE.Vector3();
const _bt = new THREE.Vector3();
const _bx = new THREE.Vector3();
const _bz = new THREE.Vector3();
const _hits: Collider[] = [];

let nextEndId = 1;

/** One rift end: logical frame + its visuals (pooled, recoloured on reuse). */
export class Portal implements RiftEnd {
  id = nextEndId++;
  position = new THREE.Vector3();
  quaternion = new THREE.Quaternion();
  width = DOOR_W;
  height = DOOR_H;
  normal = new THREE.Vector3(0, 0, 1);
  kind: RiftEndKind = 'stand';
  host: Collider | null = null;
  linked: Portal = this;
  owner: RiftOwner = 'player';
  role: RiftRole = 'entrance';
  color: RiftColorKey = 'entrance';
  /** Visual open amount 0..1 (crossing never waits for the animation). */
  open = 0;
  target = 0;
  pulse = 0;
  openTime = FEEL.portalOpenTime;
  /** Another end links into it (a hijacked gate feeding the exit). */
  fed = false;
  /** Gate / boss id. */
  tag = '';
  root = new THREE.Group();
  mesh: THREE.Mesh;
  sparks: THREE.Points;
  mat: THREE.ShaderMaterial;
  /** Window partner: the logical link in play, the snapshot link in a replay. */
  view: Portal | null = null;
  /** Visual frame (shares the root's transform). */
  vis: RiftFrame;

  constructor() {
    this.mat = createPortalMaterial(RIFT_COLOR);
    this.mesh = new THREE.Mesh(UNIT_PLANE, this.mat);
    this.mesh.renderOrder = 20;
    this.mesh.position.z = 0.012;
    this.sparks = createSparks(RIFT_COLOR);
    this.root.add(this.mesh, this.sparks);
    this.root.visible = false;
    this.vis = { position: this.root.position, quaternion: this.root.quaternion, width: DOOR_W, height: DOOR_H };
  }

  /** Crossable: open and linked to another open end. */
  get isOpen() {
    const l = this.linked;
    return this.target > 0 && l !== this && l.target > 0;
  }

  /** Placed but nothing flows through it (drawn as a dim closed ring). */
  get dormant() {
    return this.linked === this && !this.fed;
  }

  setFrame(position: V3, quaternion: THREE.Quaternion, width: number, height: number, kind: RiftEndKind, host: Collider | null) {
    this.position.copy(position);
    this.quaternion.copy(quaternion);
    this.width = width;
    this.height = height;
    this.kind = kind;
    this.host = host;
    frameNormal(this, this.normal);
    this.syncVisual();
  }

  /** Put the visuals back on the logical frame. */
  syncVisual() {
    this.setVisual(this.position, this.quaternion, this.width, this.height);
  }

  setVisual(position: V3, quaternion: THREE.Quaternion, width: number, height: number) {
    this.root.position.copy(position);
    this.root.quaternion.copy(quaternion);
    this.vis.width = width;
    this.vis.height = height;
    this.mesh.scale.set(width * PORTAL_MESH_SCALE.x, height * PORTAL_MESH_SCALE.y, 1);
    (this.sparks.material as THREE.ShaderMaterial).uniforms.uSize.value.set(width / 2, height / 2);
    this.root.updateMatrixWorld(true);
  }

  recolor(key: RiftColorKey) {
    this.color = key;
    this.mat.uniforms.uColor.value.copy(COLORS[key]);
    (this.sparks.material as THREE.ShaderMaterial).uniforms.uColor.value.copy(COLORS[key]);
  }

  /** Push the animation state into the shader uniforms. */
  applyUniforms(time: number, openVis: number, dormant: boolean) {
    const u = this.mat.uniforms;
    u.uOpen.value = openVis;
    u.uTime.value = time;
    u.uPulse.value = this.pulse;
    u.uDormant.value = dormant ? 1 : 0;
    const su = (this.sparks.material as THREE.ShaderMaterial).uniforms;
    su.uTime.value = time;
    su.uOpen.value = dormant ? openVis * 0.35 : openVis;
    this.root.visible = openVis > 0.001;
  }
}

/** Rift events; the game assigns handlers. */
export interface RiftEvents {
  /** An end appeared (or moved) and starts opening. */
  opened(end: RiftEnd, which: 'entrance' | 'exit' | 'gate' | 'boss'): void;
  /** An end started collapsing. */
  closed(end: RiftEnd): void;
  /** A gate got relinked to the player's exit (panel or entrance on its arena end). */
  hijacked?(id: string): void;
}

export interface RiftSystemOptions {
  portalScale: number;
  lightCount: number;
  maxViews: number;
  /** Level hook: what's under a landing spot (y = ground there, -Infinity when none). */
  outcomeAt?: (x: number, z: number, y: number) => 'splash' | 'void' | null;
}

interface Gate {
  id: string;
  in: Portal;
  out: Portal;
  open: boolean;
  hijacked: boolean;
}

/** A solved end placement. */
interface Placed {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  width: number;
  height: number;
  kind: RiftEndKind;
  host: Collider | null;
}

interface Solve extends Placed {
  exitFeet: THREE.Vector3;
  exitYaw: number;
  /** What the eye must see (default: a hair in front of the centre). */
  losTarget: THREE.Vector3 | null;
  noSurface: boolean;
  overTarget: string | null;
}

type Which = 'entrance' | 'exit' | 'gate' | 'boss';

/** Nearest to the camera first (uses _camPos set by renderViews). */
function byCamDistance(a: Portal, b: Portal) {
  return a.vis.position.distanceToSquared(_camPos) - b.vis.position.distanceToSquared(_camPos);
}

function easeOutBack(x: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function hdirOf(yaw: number, out = new THREE.Vector3()) {
  return out.set(Math.sin(yaw), 0, Math.cos(yaw));
}

/** Door frame (standing / wall / air door) whose front faces `normal`. */
function doorPlaced(center: V3, normal: V3, kind: RiftEndKind, host: Collider | null): Placed {
  return { position: center.clone(), quaternion: orientFrame(normal, UP), width: DOOR_W, height: DOOR_H, kind, host };
}

/** Flat frame (floor end facing up / ceiling or hatch facing down); local +Y points along `hdir`. */
function flatPlaced(center: V3, up: boolean, hdir: V3, kind: RiftEndKind, host: Collider | null, size: number = FLAT): Placed {
  return { position: center.clone(), quaternion: orientFrame(up ? UP : DOWN, hdir), width: size, height: size, kind, host };
}

/** Distance from point p to a target's body cylinder. */
function bodyDistance(p: V3, t: TrapTarget) {
  const dr = Math.max(0, Math.hypot(p.x - t.pos.x, p.z - t.pos.z) - t.radius);
  const dy = Math.max(0, p.y - (t.pos.y + t.height), t.pos.y - p.y);
  return Math.hypot(dr, dy);
}

/** Closest point of an end's rectangle to p. */
function closestOnRect(f: Placed | Portal, p: V3, out: V3) {
  toLocal(f, p, out);
  out.x = THREE.MathUtils.clamp(out.x, -f.width / 2, f.width / 2);
  out.y = THREE.MathUtils.clamp(out.y, -f.height / 2, f.height / 2);
  out.z = 0;
  return out.applyQuaternion(f.quaternion).add(f.position);
}

/**
 * Everything about rifts: the player's pair (EXIT placed with the smart
 * cursor, ENTRANCE opened by context), Kessler gates and the boss pair,
 * traversal queries for physics / projectiles / AI, the hologram preview and
 * the see-through windows (any orientation: floors, ceilings, walls, air).
 */
export class RiftSystem implements RiftAPI {
  readonly group = new THREE.Group();
  aiming = false;
  orientation: ExitOrientation = 'auto';
  airDistance: number | null = null;
  maxViews: number;
  events: RiftEvents = { opened() {}, closed() {} };
  /** Hologram of the player shown at the exit while aiming (the game sets it). */
  ghostFigure: THREE.Object3D | null = null;

  private entrance: Portal | null = null;
  private exit: Portal | null = null;
  private gates = new Map<string, Gate>();
  private boss: { a: Portal; b: Portal } | null = null;
  /** Retired ends collapsing (visual only). */
  private closing: Portal[] = [];
  private pool: Portal[] = [];
  /** Ends that exist in play (player, gates, boss). */
  private logical: Portal[] = [];
  /** logical + closing: what's drawn in play. */
  private drawn: Portal[] = [];
  private openList: RiftEnd[] = [];
  private blockers: { pos: V3; radius: number }[] = [];
  private pendingOpened: { end: Portal; which: Which }[] = [];
  private pendingClosed: Portal[] = [];
  private time = 0;

  // replay (visual-only snapshot state)
  private replaying = false;
  private replaySet: Portal[] = [];
  private replayPool: Portal[] = [];

  // rendering
  private portalScale: number;
  private lights: THREE.PointLight[] = [];
  private rts: THREE.WebGLRenderTarget[] = [];
  private vcam = new THREE.PerspectiveCamera();
  private clipPlane = new THREE.Plane();
  private clipList = [this.clipPlane];
  private viewList: Portal[] = [];
  private hideVis: boolean[] = [];
  private rootVis: boolean[] = [];
  private helperVis: boolean[] = [];

  // preview
  private ghost: THREE.Mesh;
  private ghostMat: THREE.ShaderMaterial;
  private ring: THREE.Mesh;
  private ringMat: THREE.MeshBasicMaterial;
  private arrow: THREE.Mesh;
  private beam: THREE.Mesh;
  private beamMat: THREE.ShaderMaterial;
  private plumb: THREE.Mesh;
  private plumbMat: THREE.ShaderMaterial;
  private land: THREE.Mesh;
  private helpers: THREE.Object3D[];

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer | null, private world: CollisionWorld, opts: RiftSystemOptions) {
    this.portalScale = opts.portalScale;
    this.maxViews = opts.maxViews;
    this.outcomeAt = opts.outcomeAt ?? null;
    this.scene.add(this.group);

    this.ghostMat = createPortalMaterial(new THREE.Color(0.2, 1, 0.9));
    this.ghostMat.uniforms.uGhost.value = 1;
    this.ghostMat.depthWrite = false;
    this.ghost = new THREE.Mesh(UNIT_PLANE, this.ghostMat);
    this.ghost.renderOrder = 30;

    this.ringMat = new THREE.MeshBasicMaterial({ color: 0x20ffe0, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 40).rotateX(-Math.PI / 2), this.ringMat);
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0.95);
    arrowShape.lineTo(0.22, 0.55);
    arrowShape.lineTo(0.08, 0.58);
    arrowShape.lineTo(0.08, 0.45);
    arrowShape.lineTo(-0.08, 0.45);
    arrowShape.lineTo(-0.08, 0.58);
    arrowShape.lineTo(-0.22, 0.55);
    arrowShape.closePath();
    const ag = new THREE.ShapeGeometry(arrowShape);
    ag.rotateX(-Math.PI / 2);
    ag.scale(1, 1, -1);
    this.arrow = new THREE.Mesh(ag, this.ringMat);

    this.beamMat = createBeamMaterial();
    this.beam = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 1), this.beamMat);
    this.beam.renderOrder = 31;
    // plumb line: from an air / hatch exit down to where things land
    this.plumbMat = createBeamMaterial();
    this.plumb = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 1), this.plumbMat);
    this.plumb.renderOrder = 31;
    this.land = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 40).rotateX(-Math.PI / 2), this.ringMat);

    this.helpers = [this.ghost, this.ring, this.arrow, this.beam, this.plumb, this.land];
    for (const h of this.helpers) {
      h.visible = false;
      h.userData.helper = true;
      h.frustumCulled = false;
      this.group.add(h);
    }

    for (let i = 0; i < opts.lightCount; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 9, 1.8);
      this.lights.push(l);
      this.group.add(l);
    }
    // warm pool: no material creation during play
    for (let i = 0; i < 12; i++) this.pool.push(new Portal());
  }

  private outcomeAt: ((x: number, z: number, y: number) => 'splash' | 'void' | null) | null;

  setPortalScale(s: number) {
    this.portalScale = s;
    for (const rt of this.rts) rt.dispose();
    this.rts = [];
  }

  // ------------------------------------------------------------------
  // Ends bookkeeping
  // ------------------------------------------------------------------

  private acquire(color: RiftColorKey, role: RiftRole, owner: RiftOwner): Portal {
    const p = this.pool.pop() ?? new Portal();
    p.id = nextEndId++;
    p.linked = p;
    p.view = null;
    p.fed = false;
    p.open = 0;
    p.target = 1;
    p.pulse = 0;
    p.tag = '';
    p.openTime = FEEL.portalOpenTime;
    p.role = role;
    p.owner = owner;
    p.recolor(color);
    this.group.add(p.root);
    return p;
  }

  private release(p: Portal) {
    p.root.removeFromParent();
    p.root.visible = false;
    p.linked = p;
    p.view = null;
    p.target = 0;
    p.open = 0;
    this.pool.push(p);
  }

  /** Start collapsing an end; it stops being crossable at once. */
  private retire(p: Portal) {
    p.target = 0;
    p.fed = false;
    this.closing.push(p);
    this.pendingClosed.push(p);
  }

  /** A collapsing copy of `p` left at its current spot (when an end moves). */
  private leaveCopy(p: Portal) {
    const c = this.acquire(p.color, p.role, p.owner);
    c.setFrame(p.position, p.quaternion, p.width, p.height, p.kind, null);
    c.open = p.open;
    this.retire(c);
  }

  /** Recompute links, dormancy and the cached lists after any change. */
  private relink() {
    const en = this.entrance, ex = this.exit;
    if (en && ex) {
      en.linked = ex;
      ex.linked = en;
    } else {
      if (en) en.linked = en;
      if (ex) ex.linked = ex;
    }
    for (const g of this.gates.values()) {
      if (g.hijacked) {
        g.in.linked = ex ?? g.in;
        g.out.linked = g.out;
      } else {
        g.in.linked = g.out;
        g.out.linked = g.in;
      }
    }
    if (this.boss) {
      this.boss.a.linked = this.boss.b;
      this.boss.b.linked = this.boss.a;
    }
    const L: Portal[] = [];
    if (en) L.push(en);
    if (ex) L.push(ex);
    for (const g of this.gates.values()) L.push(g.in, g.out);
    if (this.boss) L.push(this.boss.a, this.boss.b);
    for (const p of L) p.fed = false;
    for (const p of L) if (p.target > 0 && p.linked !== p && p.linked.linked !== p) p.linked.fed = true;
    for (const p of L) p.view = p.linked !== p ? p.linked : null;
    this.logical = L;
    this.drawn = L.concat(this.closing);
    // a new array, so callers iterating the old one are undisturbed
    this.openList = L.filter((p) => p.isOpen);
  }

  playerEnds(): { entrance: RiftEnd | null; exit: RiftEnd | null } {
    return { entrance: this.entrance, exit: this.exit };
  }

  gateEnds(id: string): { in: RiftEnd | null; out: RiftEnd | null } {
    const g = this.gates.get(id);
    return { in: g?.in ?? null, out: g?.out ?? null };
  }

  hasExit() {
    return !!this.exit;
  }

  hasEntrance() {
    return !!this.entrance;
  }

  // ------------------------------------------------------------------
  // RiftQuery
  // ------------------------------------------------------------------

  openEnds(): RiftEnd[] {
    return this.openList;
  }

  findCrossing(prev: V3, cur: V3, margin = 0): RiftEnd | null {
    let best: Portal | null = null;
    let bestT = Infinity;
    const L = this.logical;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      if (!p.isOpen) continue;
      const n = p.normal, o = p.position;
      // cheap plane test before the full local-frame check
      const a = (prev.x - o.x) * n.x + (prev.y - o.y) * n.y + (prev.z - o.z) * n.z;
      if (!(a > 0)) continue;
      const b = (cur.x - o.x) * n.x + (cur.y - o.y) * n.y + (cur.z - o.z) * n.z;
      if (b > 0) continue;
      const t = crossing(p, prev, cur, margin);
      if (t >= 0 && t < bestT) {
        bestT = t;
        best = p;
      }
    }
    return best;
  }

  transformPoint(from: RiftEnd, p: V3, out = new THREE.Vector3()): V3 {
    return passPoint(from, from.linked, p, out);
  }

  transformDir(from: RiftEnd, d: V3, out = new THREE.Vector3()): V3 {
    return passDirection(from, from.linked, d, out);
  }

  holeAt(x: number, z: number, y: number, r = 0, tol = 0.6): RiftEnd | null {
    const L = this.logical;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      if (p.kind !== 'floor' || !p.isOpen) continue;
      if (Math.abs(y - p.position.y) > tol) continue;
      toLocal(p, _l.set(x, p.position.y, z), _l);
      if (Math.abs(_l.x) <= p.width / 2 + r && Math.abs(_l.y) <= p.height / 2 + r) return p;
    }
    return null;
  }

  hostPassable(c: Collider, pos: V3, radius: number): boolean {
    const L = this.logical;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      if (!p.isOpen) continue;
      const ny = p.normal.y;
      if (ny > 0.5) {
        // floor end: any collider whose top face holds it, while the mover is inside the rectangle
        if (Math.abs(c.max.y - p.position.y) > 0.15) continue;
        toLocal(p, pos, _l);
        if (Math.abs(_l.x) < p.width / 2 && Math.abs(_l.y) < p.height / 2 && _l.z > -3 && _l.z < 2.5) return true;
      } else if (ny < -0.5) {
        // ceiling end: its bottom face
        if (Math.abs(c.min.y - p.position.y) > 0.15) continue;
        toLocal(p, pos, _l);
        if (Math.abs(_l.x) < p.width / 2 && Math.abs(_l.y) < p.height / 2 && _l.z > -3 && _l.z < 3.5) return true;
      } else {
        if (p.host !== c && !faceHolds(c, p)) continue;
        toLocal(p, pos, _l);
        if (Math.abs(_l.x) < p.width / 2 - radius * 0.3 && _l.z > -1.2 && _l.z < radius + 0.6 && Math.abs(_l.y) < p.height / 2 + 0.5) return true;
      }
    }
    return false;
  }

  blocked(p: V3): boolean {
    for (const b of this.blockers) if (p.distanceToSquared(b.pos) < b.radius * b.radius) return true;
    return false;
  }

  notePass(end: RiftEnd, _who: BodyKind | 'bolt' | 'beam') {
    const p = end as Portal;
    p.pulse = 1;
    if (p.linked) p.linked.pulse = 1;
  }

  raycastThrough(origin: V3, dir: V3, maxDist: number, world: CollisionWorld, maxHops: number = LAW.beam.maxHops): RaySegment[] {
    const out: RaySegment[] = [];
    const o = origin.clone();
    const d = dir.clone().normalize();
    let remaining = maxDist;
    let hops = 0;
    let skip: Portal | null = null;
    for (let guard = 0; guard <= maxHops + 1; guard++) {
      const hit = world.raycast(o, d, remaining, { sight: true });
      const wallT = hit ? hit.distance : remaining;
      let best: Portal | null = null;
      let bestT = Infinity;
      for (const p of this.logical) {
        if (!p.isOpen || p === skip) continue;
        const denom = d.dot(p.normal);
        if (denom >= -1e-6) continue; // only into the front
        const h0 = _a.subVectors(o, p.position).dot(p.normal);
        if (h0 < 0) continue;
        const t = h0 / -denom;
        if (t > wallT + 0.05 || t >= bestT) continue;
        toLocal(p, _b.copy(o).addScaledVector(d, t), _l);
        if (Math.abs(_l.x) > p.width / 2 || Math.abs(_l.y) > p.height / 2) continue;
        best = p;
        bestT = t;
      }
      if (best) {
        const to = o.clone().addScaledVector(d, bestT);
        out.push({ from: o.clone(), to, hit: null, viaEnd: best, charged: hops > 0 });
        remaining -= bestT;
        if (hops >= maxHops || remaining <= 0) break;
        hops++;
        const exit: Portal = best.linked;
        passPoint(best, exit, to, o);
        passDirection(best, exit, d, _c);
        d.copy(_c).normalize();
        o.addScaledVector(exit.normal, 1e-3);
        skip = exit;
        continue;
      }
      out.push({ from: o.clone(), to: hit ? hit.point.clone() : o.clone().addScaledVector(d, remaining), hit, viaEnd: null, charged: hops > 0 });
      break;
    }
    return out;
  }

  // ------------------------------------------------------------------
  // EXIT: the smart cursor
  // ------------------------------------------------------------------

  /** Frame for a free-standing door whose bottom sits on `groundY`. */
  standingFrame(x: number, groundY: number, z: number, normal: V3): Placed {
    const n = _c.set(normal.x, 0, normal.z).normalize();
    return doorPlaced(_b.set(x, groundY + DOOR_H / 2 + 0.02, z), n, 'stand', null);
  }

  private standingClear(base: V3, n: V3, skip?: Collider | null) {
    const w = this.world;
    const H = DOOR_H;
    const sx = n.z, sz = -n.x;
    // exit column
    const ex = base.x + n.x * 0.55, ez = base.z + n.z * 0.55;
    const sk = skip ? (c: Collider) => c === skip : undefined;
    if (w.overlapsCylinder(ex, ez, FEEL.playerRadius, base.y + 0.02, base.y + H - 0.05, sk)) return false;
    // both sides of the rift plane
    for (const s of [-0.45, 0, 0.45]) {
      if (w.overlapsCylinder(base.x + sx * s, base.z + sz * s, 0.12, base.y + 0.05, base.y + H, sk)) return false;
    }
    // headroom
    if (w.ceilingAt(ex, ez, 0.2, base.y + 0.1) < base.y + 1.9) return false;
    // ground under the exit
    const g = w.groundAt(ex, ez, 0.15, base.y + 0.4);
    return g > base.y - 0.6;
  }

  /**
   * The walkable top of whatever was hit (climbing stacked boxes, e.g.
   * containers) and a clear standing-door spot on it near the aimed point.
   */
  private perchOn(c: Collider, point: V3, normal: V3, facing: V3): { placed: Placed; exitFeet: THREE.Vector3; facing: THREE.Vector3 } | null {
    const w = this.world;
    const ix = point.x - normal.x * 0.3, iz = point.z - normal.z * 0.3;
    let top = c;
    for (let i = 0; i < 8; i++) {
      w.queryBox(ix - 0.1, iz - 0.1, ix + 0.1, iz + 0.1, _hits);
      let above: Collider | null = null;
      for (const o of _hits) {
        if (o.enabled && o !== top && !o.seeThrough && Math.abs(o.min.y - top.max.y) < 0.15 && ix >= o.min.x - 0.1 && ix <= o.max.x + 0.1 && iz >= o.min.z - 0.1 && iz <= o.max.z + 0.1) {
          if (!above || o.id < above.id) above = o;
        }
      }
      if (!above) break;
      top = above;
    }
    if (top.noPortal || top.tag === 'bound') return null;
    if (top.max.x - top.min.x < 1.2 || top.max.z - top.min.z < 1.2) return null;
    const y = top.max.y;
    const m = 0.75;
    const cx = (top.min.x + top.max.x) / 2, cz = (top.min.z + top.max.z) / 2;
    const px = THREE.MathUtils.clamp(ix, Math.min(top.min.x + m, cx), Math.max(top.max.x - m, cx));
    const pz = THREE.MathUtils.clamp(iz, Math.min(top.min.z + m, cz), Math.max(top.max.z - m, cz));
    const dirs = [facing.clone(), facing.clone().negate(), new THREE.Vector3(facing.z, 0, -facing.x), new THREE.Vector3(-facing.z, 0, facing.x)];
    // near the aimed spot first, then toward the middle of the surface
    for (const k of [0, 0.35, 0.7, 1]) {
      const x = THREE.MathUtils.lerp(px, cx, k), z = THREE.MathUtils.lerp(pz, cz, k);
      for (const f of dirs) {
        const ex = x + f.x * 0.55, ez = z + f.z * 0.55;
        if (ex < top.min.x + 0.3 || ex > top.max.x - 0.3 || ez < top.min.z + 0.3 || ez > top.max.z - 0.3) continue;
        const base = new THREE.Vector3(x - f.x * 0.25, y, z - f.z * 0.25);
        if (!this.standingClear(base, f)) continue;
        return { placed: this.standingFrame(base.x, y, base.z, f), exitFeet: new THREE.Vector3(base.x + f.x * 0.55, y, base.z + f.z * 0.55), facing: f };
      }
    }
    return null;
  }

  aimExit(camPos: V3, dir: V3, playerEye: V3, playerFeet: V3, touch: boolean, targets: TrapTarget[]): ExitAim {
    const w = this.world;
    const maxRay = LAW.riftRange + 10;
    const hit = w.raycast(camPos, dir, maxRay, { sight: true });
    const along = Math.max(0, _a.subVectors(playerEye, camPos).dot(dir));
    const aimYaw = yawOf(dir);
    const hdir = hdirOf(aimYaw);

    let sol: Solve;
    const snap = this.orientation !== 'door' ? this.snapTarget(camPos, dir, along, hit, targets, touch ? FEEL.hatchSnapTouch : FEEL.hatchSnap, playerEye, playerFeet) : null;
    if (snap) sol = this.hatchOver(snap, playerFeet, hdir, aimYaw);
    else if (this.airDistance !== null && (!hit || along + this.airDistance < hit.distance - 0.4)) {
      sol = this.airAt(camPos.clone().addScaledVector(dir, along + this.airDistance), playerEye, hdir, aimYaw);
    } else if (hit) sol = this.surface(hit, hdir, aimYaw);
    else sol = this.airAt(camPos.clone().addScaledVector(dir, along + FEEL.airDefault), playerEye, hdir, aimYaw);

    // ---- validation ----
    const center = sol.position;
    const n = frameNormal(sol, new THREE.Vector3());
    const dist = center.distanceTo(playerEye);
    let reason: string | null = null;
    if (sol.noSurface) reason = 'aim.noSurface';
    else if (dist > LAW.riftRange + 0.5) reason = 'aim.range';
    else if (!this.canSee(playerEye, dir, sol.losTarget ?? center.clone().addScaledVector(n, 0.15), sol.host)) reason = 'aim.los';
    else if (sol.kind === 'air' && center.y > playerFeet.y + LAW.airAboveFeetMax + 1e-3) reason = 'aim.tooHigh';
    else if (this.nearSteady(sol, targets, null)) reason = 'aim.enemyClose';
    else if (this.blocked(center)) reason = 'aim.blocked';
    else if (!this.hasSpace(sol, n)) reason = 'aim.space';

    // ---- what falls out of it ----
    const flatDown = n.y < -0.5;
    const g = w.groundAt(sol.exitFeet.x, sol.exitFeet.z, 0.3, (flatDown ? center.y - 0.05 : sol.exitFeet.y + 0.3));
    if (flatDown && g > -Infinity) sol.exitFeet.y = Math.max(sol.exitFeet.y, g);
    const dropBelow = g > -Infinity ? Math.max(0, sol.exitFeet.y - g) : Infinity;
    let outcome: ExitAim['outcome'] | null = this.outcomeAt ? this.outcomeAt(sol.exitFeet.x, sol.exitFeet.z, g) : null;
    if (!outcome) {
      const v = Math.sqrt(2 * LAW.gravity * Math.min(dropBelow, 1e4));
      outcome = v >= LAW.killSpeed ? 'skull' : v >= LAW.knockSpeed ? 'stars' : 'safe';
    }
    return {
      frame: { position: sol.position, quaternion: sol.quaternion, width: sol.width, height: sol.height },
      kind: sol.kind,
      host: sol.host,
      exitFeet: sol.exitFeet,
      exitYaw: sol.exitYaw,
      valid: reason === null,
      reason,
      distance: dist,
      dropBelow,
      outcome,
      overTarget: sol.overTarget,
    };
  }

  /** Target the aim ray passes over (auto hatch), or null. */
  private snapTarget(camPos: V3, dir: V3, along: number, hit: RayHit | null, targets: TrapTarget[], radius: number, eye: V3, feet: V3): TrapTarget | null {
    const dxz2 = dir.x * dir.x + dir.z * dir.z;
    if (dxz2 < 1e-4) return null;
    const tEnd = hit ? hit.distance : LAW.riftRange + along;
    let best: TrapTarget | null = null;
    let bestD = radius;
    for (const t of targets) {
      const tt = ((t.pos.x - camPos.x) * dir.x + (t.pos.z - camPos.z) * dir.z) / dxz2;
      if (tt < along + 1 || tt > tEnd + 0.5) continue;
      const px = camPos.x + dir.x * tt, py = camPos.y + dir.y * tt, pz = camPos.z + dir.z * tt;
      const d = Math.hypot(px - t.pos.x, pz - t.pos.z);
      if (d >= bestD) continue;
      if (py < t.pos.y + 0.3) continue; // passes under him
      // no legal hatch over him from here (air ends can't be above your feet): aim at what's behind
      if (t.pos.y + t.height + (t.steady ? LAW.enemyClearance + 0.05 : 0.6) > feet.y + LAW.airAboveFeetMax + 1e-3) continue;
      // aiming at a wall past him means the wall, unless the ray is on his body
      if (hit && Math.abs(hit.normal.y) < 0.3 && (d > t.radius + 0.25 || py > t.pos.y + t.height + 0.3)) continue;
      if (!this.world.lineOfSight(eye, _a.set(t.pos.x, t.pos.y + t.height, t.pos.z))) continue;
      best = t;
      bestD = d;
    }
    return best;
  }

  /** Sky hatch straight above a target, as high as the rules allow. */
  private hatchOver(t: TrapTarget, playerFeet: V3, hdir: V3, aimYaw: number): Solve {
    const top = t.pos.y + t.height;
    const minY = top + (t.steady ? LAW.enemyClearance + 0.05 : 0.6);
    let y = Math.min(playerFeet.y + LAW.airAboveFeetMax, top + FEEL.hatchMaxAbove);
    y = Math.min(y, this.world.ceilingAt(t.pos.x, t.pos.z, 0.6, top + 0.1) - 0.3);
    // too low for the rules: keep it here so the reason shows (tooHigh / space)
    y = Math.max(y, minY);
    const center = new THREE.Vector3(t.pos.x, y, t.pos.z);
    return {
      ...flatPlaced(center, false, hdir, 'air', null),
      exitFeet: new THREE.Vector3(t.pos.x, y - FEEL.playerHeight - 0.1, t.pos.z),
      exitYaw: aimYaw,
      losTarget: center,
      noSurface: false,
      overTarget: t.key,
    };
  }

  /** Open air: a door facing along the aim (or a hatch); near the ground it stands on it. */
  private airAt(point: THREE.Vector3, eye: V3, hdir: V3, aimYaw: number): Solve {
    const d = point.distanceTo(eye);
    if (d > LAW.riftRange) point.sub(eye).multiplyScalar(LAW.riftRange / d).add(eye);
    if (this.orientation === 'hatch') {
      return {
        ...flatPlaced(point, false, hdir, 'air', null),
        exitFeet: new THREE.Vector3(point.x, point.y - FEEL.playerHeight - 0.1, point.z),
        exitYaw: aimYaw,
        losTarget: null,
        noSurface: false,
        overTarget: null,
      };
    }
    const g = this.world.groundAt(point.x, point.z, 0.3, point.y + 0.2);
    if (g > point.y - (DOOR_H / 2 + 0.6)) {
      // close above the ground: stand it on the ground
      const placed = this.standingFrame(point.x, g, point.z, hdir);
      return { ...placed, exitFeet: new THREE.Vector3(point.x + hdir.x * 0.55, g, point.z + hdir.z * 0.55), exitYaw: aimYaw, losTarget: null, noSurface: false, overTarget: null };
    }
    return {
      ...doorPlaced(point, hdir, 'air', null),
      exitFeet: new THREE.Vector3(point.x + hdir.x * 0.6, point.y - DOOR_H / 2 + 0.02, point.z + hdir.z * 0.6),
      exitYaw: aimYaw,
      losTarget: null,
      noSurface: false,
      overTarget: null,
    };
  }

  /** Snap to the surface that was hit, by its normal. */
  private surface(hit: RayHit, hdir: V3, aimYaw: number): Solve {
    const w = this.world;
    const c = hit.collider;
    const n = hit.normal;
    const p = hit.point;
    const bad = !!c.noPortal;
    if (n.y > 0.7) {
      // floor: an end lying on it, facing up
      const center = new THREE.Vector3(clampOn(p.x, c.min.x, c.max.x, FLAT / 2), p.y + 0.01, clampOn(p.z, c.min.z, c.max.z, FLAT / 2));
      return { ...flatPlaced(center, true, hdir, 'floor', c), exitFeet: center.clone().setY(center.y + 0.05), exitYaw: aimYaw, losTarget: null, noSurface: bad, overTarget: null };
    }
    if (n.y < -0.7) {
      // ceiling: things drop out of it
      const center = new THREE.Vector3(clampOn(p.x, c.min.x, c.max.x, FLAT / 2), p.y - 0.01, clampOn(p.z, c.min.z, c.max.z, FLAT / 2));
      return {
        ...flatPlaced(center, false, hdir, 'ceiling', c),
        exitFeet: new THREE.Vector3(center.x, center.y - FEEL.playerHeight - 0.1, center.z),
        exitYaw: aimYaw,
        losTarget: null,
        noSurface: bad,
        overTarget: null,
      };
    }
    // wall. Aimed near the top of a thing: perch on top of it
    if (!bad && c.max.y - p.y < FEEL.perchBand) {
      const perch = this.perchOn(c, p, n, hdir);
      if (perch) {
        return {
          ...perch.placed,
          exitFeet: perch.exitFeet,
          exitYaw: yawOf(perch.facing),
          losTarget: p.clone().addScaledVector(n, 0.1),
          noSurface: false,
          overTarget: null,
        };
      }
    }
    const H = DOOR_H, W = DOOR_W;
    const g = w.groundAt(p.x + n.x * 0.6, p.z + n.z * 0.6, 0.2, p.y + 0.3);
    let cy = p.y;
    if (g > -Infinity && p.y - g < H) cy = g + H / 2 + 0.02; // sit on the floor
    const axis = Math.abs(n.x) > 0.5 ? 'z' : 'x';
    const lo = c.min[axis] + W / 2 + 0.05, hi = c.max[axis] - W / 2 - 0.05;
    if (lo > hi || c.max.y - c.min.y < H + 0.04) {
      // host face too small: stand a door in front of it
      const gy0 = w.groundAt(p.x + n.x * 0.9, p.z + n.z * 0.9, 0.2, p.y + 0.5);
      const gy = gy0 > -50 ? gy0 : p.y;
      const placed = this.standingFrame(p.x + n.x * 0.9, gy, p.z + n.z * 0.9, hdir);
      return {
        ...placed,
        exitFeet: new THREE.Vector3(placed.position.x + hdir.x * 0.55, gy, placed.position.z + hdir.z * 0.55),
        exitYaw: aimYaw,
        losTarget: null,
        noSurface: bad,
        overTarget: null,
      };
    }
    const center = new THREE.Vector3(p.x, cy, p.z);
    center[axis] = THREE.MathUtils.clamp(center[axis], lo, hi);
    center.y = THREE.MathUtils.clamp(center.y, c.min.y + H / 2 + 0.02, c.max.y - H / 2 - 0.02);
    return {
      ...doorPlaced(center, n, 'wall', c),
      exitFeet: new THREE.Vector3(center.x + n.x * 0.6, center.y - H / 2 + 0.02, center.z + n.z * 0.6),
      exitYaw: yawOf(n),
      losTarget: null,
      noSurface: bad,
      overTarget: null,
    };
  }

  /** Line of sight from the eye, allowing a small lean past a ledge. */
  private canSee(eye: V3, dir: V3, target: V3, host: Collider | null) {
    const w = this.world;
    if (w.lineOfSight(eye, target, host)) return true;
    const h = Math.hypot(dir.x, dir.z);
    if (h < 1e-4) return false;
    const lean = _c.set(eye.x + (dir.x / h) * 0.8, eye.y, eye.z + (dir.z / h) * 0.8);
    return w.lineOfSight(eye, lean) && w.lineOfSight(lean, target, host);
  }

  /** Within LAW.enemyClearance of a steady target's body. */
  private nearSteady(f: Placed, targets: TrapTarget[], except: string | null) {
    for (const t of targets) {
      if (!t.steady || t.key === except) continue;
      _b.set(t.pos.x, t.pos.y + t.height * 0.5, t.pos.z);
      closestOnRect(f, _b, _a);
      if (bodyDistance(_a, t) < LAW.enemyClearance) return true;
    }
    return false;
  }

  /** Room for the end itself and for something to come out of it. */
  private hasSpace(s: Placed, n: V3) {
    const w = this.world;
    const c = s.position;
    const r = FEEL.playerRadius;
    const host = s.host;
    const sk = host ? (o: Collider) => o === host : undefined;
    let ok = true;
    // flat ends need a face that can hold them
    if (host && Math.abs(n.y) > 0.5 && (host.max.x - host.min.x < 1 || host.max.z - host.min.z < 1)) return false;
    if (s.kind === 'stand') ok = this.standingClear(_b.set(c.x, c.y - DOOR_H / 2 - 0.02, c.z), n);
    else if (s.kind === 'wall') ok = !w.overlapsCylinder(c.x + n.x * 0.6, c.z + n.z * 0.6, r, c.y - DOOR_H / 2 + 0.07, c.y - DOOR_H / 2 + 1.72, sk);
    else if (n.y > 0.5) ok = !w.overlapsCylinder(c.x, c.z, r, c.y + 0.05, c.y + 1.8, sk);
    else if (n.y < -0.5) ok = !w.overlapsCylinder(c.x, c.z, r, c.y - 1.9, c.y - 0.05, sk);
    else {
      // air door: the door line and the column in front of it
      const sx = n.z, sz = -n.x;
      for (const k of [-0.45, 0, 0.45]) if (w.overlapsCylinder(c.x + sx * k, c.z + sz * k, 0.12, c.y - DOOR_H / 2, c.y + DOOR_H / 2 - 0.05)) ok = false;
      if (ok && w.overlapsCylinder(c.x + n.x * 0.55, c.z + n.z * 0.55, 0.3, c.y - DOOR_H / 2 + 0.05, c.y + DOOR_H / 2 - 0.25)) ok = false;
    }
    if (!ok) return false;
    for (const p of this.logical) {
      if (p === this.exit || p.target === 0) continue;
      if (p.position.distanceTo(c) < 1.3) return false;
    }
    return true;
  }

  placeExit(aim: ExitAim): boolean {
    if (!aim.valid) return false;
    const f = aim.frame;
    if (this.exit) {
      // leave a collapsing copy; the live end moves (things in flight keep their link)
      this.leaveCopy(this.exit);
      this.exit.setFrame(f.position, f.quaternion, f.width, f.height, aim.kind, aim.host);
      this.exit.open = Math.min(this.exit.open, 0.25);
    } else {
      this.exit = this.acquire('exit', 'exit', 'player');
      this.exit.setFrame(f.position, f.quaternion, f.width, f.height, aim.kind, aim.host);
    }
    this.pendingOpened.push({ end: this.exit, which: 'exit' });
    this.relink();
    return true;
  }

  // ------------------------------------------------------------------
  // ENTRANCE: resolved by context
  // ------------------------------------------------------------------

  /** What openEntrance() would do right now, without opening anything (HUD gate hint). */
  previewEntrance(ctx: EntranceContext): EntranceResult {
    return this.solveEntrance(ctx).res;
  }

  openEntrance(ctx: EntranceContext): EntranceResult {
    const { res, placed } = this.solveEntrance(ctx);
    if (!res.ok || !placed) return res;
    if (this.entrance) this.retire(this.entrance);
    const e = this.acquire('entrance', 'entrance', 'player');
    e.openTime = FEEL.entranceOpenTime;
    e.setFrame(placed.position, placed.quaternion, placed.width, placed.height, placed.kind, placed.host);
    this.entrance = e;
    this.pendingOpened.push({ end: e, which: 'entrance' });
    this.relink();
    // an entrance on a gate's arena end hijacks it
    for (const g of this.gates.values()) {
      if (!g.hijacked && g.out.target > 0 && g.out.position.distanceTo(e.position) < 1.6) this.hijackGate(g.id);
    }
    return res;
  }

  private solveEntrance(ctx: EntranceContext): { res: EntranceResult; placed: Placed | null } {
    const fail = (mode: EntranceMode | null, reason: string, key: string | null = null) => ({ res: { ok: false, mode, targetKey: key, reason }, placed: null });
    if (!this.exit) return fail(null, 'gate.noExit');
    const w = this.world;
    const feet = ctx.playerFeet;
    let mode: EntranceMode;
    let placed: Placed | null = null;
    let key: string | null = null;
    let except: string | null = null;

    const threat = ctx.threats.length ? ctx.threats.reduce((a, b) => (b.eta < a.eta ? b : a)) : null;
    // the target under the crosshair
    let tgt: TrapTarget | null = null;
    if (!(ctx.airborne && ctx.playerVel.y < -3) && !threat) tgt = this.crosshairTarget(ctx);

    if (ctx.airborne && ctx.playerVel.y < -3) {
      // 1. falling: an end on the fall path, facing the velocity
      mode = 'air';
      placed = this.fallCatch(ctx);
      if (!placed) return fail(mode, 'gate.noSpace');
    } else if (threat) {
      // 2. CATCH: a door between you and the threat, facing it
      mode = 'catch';
      const d = _a.set(threat.from.x - feet.x, 0, threat.from.z - feet.z);
      if (d.lengthSq() < 1e-6) hdirOf(ctx.playerYaw, d);
      d.normalize();
      const bx = feet.x + d.x * 1.4, bz = feet.z + d.z * 1.4;
      const g = w.groundAt(bx, bz, 0.2, feet.y + 0.5);
      if (!ctx.airborne && g > feet.y - 0.6 && this.standingClear(_b.set(bx, g, bz), d)) placed = this.standingFrame(bx, g, bz, d);
      else placed = doorPlaced(_c.set(bx, feet.y + 1.1, bz), d, 'air', null);
    } else if (tgt) {
      // 3. TRAPDOOR under the target
      mode = 'trapdoor';
      key = except = tgt.key;
      const dist = Math.hypot(tgt.pos.x - ctx.camPos.x, tgt.pos.z - ctx.camPos.z, tgt.pos.y - ctx.camPos.y);
      if (dist > LAW.trapdoorRange) return fail(mode, 'gate.range', key);
      if (tgt.steady || !tgt.canFall) return fail(mode, 'gate.steady', key);
      const g = w.groundAt(tgt.pos.x, tgt.pos.z, 0.05, tgt.pos.y + 0.3);
      const host = w.lastGround;
      if (!(g > -Infinity) || !host || host.noPortal) return fail(mode, 'gate.noSpace', key);
      const hd = _a.set(tgt.pos.x - feet.x, 0, tgt.pos.z - feet.z);
      if (hd.lengthSq() < 1e-6) hdirOf(ctx.playerYaw, hd);
      hd.normalize();
      placed = flatPlaced(_c.set(tgt.pos.x, g + 0.01, tgt.pos.z), true, hd, 'floor', host);
    } else {
      // 4. DOOR in front of you (or on the wall you face)
      mode = 'door';
      const h = Math.hypot(ctx.camDir.x, ctx.camDir.z);
      const yaw = h > 1e-3 ? Math.atan2(ctx.camDir.x, ctx.camDir.z) : ctx.playerYaw;
      placed = this.solveDoor(feet, yaw, ctx.airborne);
      if (!placed) return fail(mode, 'gate.noSpace');
    }

    if (this.blocked(placed.position)) return fail(mode, 'gate.blocked', key);
    if (this.nearSteady(placed, ctx.targets, except)) return fail(mode, 'gate.enemyClose', key);
    if (this.exit.position.distanceTo(placed.position) < 1.0) return fail(mode, 'gate.noSpace', key);
    return { res: { ok: true, mode, targetKey: key, reason: null }, placed };
  }

  /** The target whose body is nearest the camera ray (within ~1.8 m) and in sight. */
  private crosshairTarget(ctx: EntranceContext): TrapTarget | null {
    const o = ctx.camPos, d = ctx.camDir;
    let best: TrapTarget | null = null;
    let bestD = 1.8;
    for (const t of ctx.targets) {
      // distance from the ray to the target's feet→head segment (sampled)
      let dm = Infinity;
      for (const k of [0, 0.5, 1]) {
        _a.set(t.pos.x, t.pos.y + t.height * k, t.pos.z).sub(o);
        const along = _a.dot(d);
        if (along <= 0) continue;
        dm = Math.min(dm, _a.addScaledVector(d, -along).length());
      }
      if (dm >= bestD) continue;
      if (!this.world.lineOfSight(o, _b.set(t.pos.x, t.pos.y + t.height * 0.6, t.pos.z)) && !this.world.lineOfSight(o, _b.set(t.pos.x, t.pos.y + 0.3, t.pos.z))) continue;
      best = t;
      bestD = dm;
    }
    return best;
  }

  /** Falling: an end on the predicted path, 1.5 m+ below the feet, facing the velocity. */
  private fallCatch(ctx: EntranceContext): Placed | null {
    const w = this.world;
    const v = ctx.playerVel;
    const speed = v.length();
    const c0 = _a.set(ctx.playerFeet.x, ctx.playerFeet.y + 0.9, ctx.playerFeet.z);
    const want = 1.5 + 0.08 * speed;
    const G = LAW.gravity;
    let t = want / Math.max(speed, 1);
    const yAt = (tt: number) => c0.y + v.y * tt - 0.5 * G * tt * tt;
    for (let i = 0; i < 80 && yAt(t) > ctx.playerFeet.y - 1.5; i++) t += 0.01;
    const center = new THREE.Vector3(c0.x + v.x * t, yAt(t), c0.z + v.z * t);
    const vel = new THREE.Vector3(v.x, v.y - G * t, v.z);
    const n = vel.clone().normalize().negate();
    // the ground comes first: open on it instead
    const pathLen = center.distanceTo(c0);
    const dir = _b.subVectors(center, c0).normalize();
    const hit = w.raycast(c0, dir, pathLen + 0.6, { sight: false });
    const hd = hdirOf(ctx.playerYaw, new THREE.Vector3());
    if (Math.hypot(v.x, v.z) > 0.5) hd.set(v.x, 0, v.z).normalize();
    if (hit) {
      if (hit.collider.noPortal) return null;
      if (hit.normal.y > 0.7) return flatPlaced(hit.point.clone().setY(hit.point.y + 0.01), true, hd, 'floor', hit.collider, CATCH_FLAT);
      if (hit.normal.y < -0.7) return null;
      return doorPlaced(hit.point, hit.normal, 'wall', hit.collider);
    }
    return { position: center, quaternion: orientFrame(n, Math.abs(n.y) > 0.9 ? hd : UP), width: CATCH_FLAT, height: CATCH_FLAT, kind: 'air', host: null };
  }

  /** A travel door: on the wall you face, else standing in front / beside / behind you. */
  private solveDoor(feet: V3, yaw: number, airborne: boolean): Placed | null {
    const w = this.world;
    const f = hdirOf(yaw, new THREE.Vector3());
    const chest = new THREE.Vector3(feet.x, feet.y + 1.1, feet.z);
    const hit = w.raycast(chest, f, 2.0, { sight: false });
    if (hit && Math.abs(hit.normal.y) < 0.3 && !hit.collider.noPortal && hit.collider.max.y - hit.collider.min.y > DOOR_H) {
      const n = hit.normal;
      const c = hit.collider;
      const center = new THREE.Vector3(hit.point.x, feet.y + DOOR_H / 2 + 0.02, hit.point.z);
      const axis = Math.abs(n.x) > 0.5 ? 'z' : 'x';
      const lo = c.min[axis] + DOOR_W / 2 + 0.05, hi = c.max[axis] - DOOR_W / 2 - 0.05;
      if (lo <= hi && c.min.y <= feet.y + 0.05 && c.max.y >= center.y + DOOR_H / 2) {
        center[axis] = THREE.MathUtils.clamp(center[axis], lo, hi);
        return doorPlaced(center, n, 'wall', c);
      }
    }
    if (airborne) {
      // in the air: a door in front of you, facing you
      const n = f.clone().negate();
      return doorPlaced(chest.clone().addScaledVector(f, FEEL.nearPortalDistance), n, 'air', null);
    }
    for (const off of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const fy = hdirOf(yaw + off, new THREE.Vector3());
      for (const d of [FEEL.nearPortalDistance, 1.1]) {
        const bx = feet.x + fy.x * d, bz = feet.z + fy.z * d;
        const g = w.groundAt(bx, bz, 0.2, feet.y + 0.5);
        if (!(g > feet.y - 0.5)) continue;
        const n = fy.clone().negate();
        const base = new THREE.Vector3(bx, g, bz);
        if (!this.standingClear(base, n)) continue;
        if (!w.lineOfSight(chest, base.clone().setY(g + 1.1))) continue;
        return this.standingFrame(bx, g, bz, n);
      }
    }
    return null;
  }

  /** Open the entrance at an explicit frame (game-driven: a hole right under hanging cargo). */
  openEntranceAt(frame: { position: V3; quaternion: THREE.Quaternion; width: number; height: number }, kind: RiftEndKind): boolean {
    if (!this.exit || this.blocked(frame.position)) return false;
    if (this.exit.position.distanceTo(frame.position) < 1.0) return false;
    if (this.entrance) this.retire(this.entrance);
    const e = this.acquire('entrance', 'entrance', 'player');
    e.openTime = FEEL.entranceOpenTime;
    e.setFrame(frame.position, frame.quaternion, frame.width, frame.height, kind, null);
    this.entrance = e;
    this.pendingOpened.push({ end: e, which: 'entrance' });
    this.relink();
    return true;
  }

  close(straddlers: { key: string; center: V3; radius: number }[]): ShearVictim[] {
    const victims: ShearVictim[] = [];
    for (const end of [this.entrance, this.exit]) {
      if (!end || !end.isOpen) continue;
      for (const s of straddlers) {
        if (victims.some((v) => v.key === s.key)) continue;
        toLocal(end, s.center, _l);
        if (Math.abs(_l.z) <= SHEAR_BAND && Math.abs(_l.x) <= end.width / 2 + s.radius && Math.abs(_l.y) <= end.height / 2 + s.radius) {
          victims.push({ key: s.key, at: s.center.clone() });
        }
      }
    }
    if (this.entrance) this.retire(this.entrance);
    if (this.exit) this.retire(this.exit);
    this.entrance = this.exit = null;
    this.relink();
    return victims;
  }

  // ------------------------------------------------------------------
  // Gates, boss, jammers
  // ------------------------------------------------------------------

  /** Collider an end placed by the level sits on (floors / ceilings / walls). */
  private findHost(f: RiftFrame & { kind: RiftEndKind }): Collider | null {
    const w = this.world;
    const n = frameNormal(f, new THREE.Vector3());
    const p = f.position;
    if (f.kind === 'air' || f.kind === 'stand') return null;
    if (n.y > 0.5) {
      const g = w.groundAt(p.x, p.z, 0.05, p.y + 0.05);
      return Math.abs(g - p.y) < 0.15 ? w.lastGround : null;
    }
    if (n.y < -0.5) {
      const c = w.ceilingAt(p.x, p.z, 0.05, p.y - 0.05);
      return Math.abs(c - p.y) < 0.15 ? w.lastCeiling : null;
    }
    const hit = w.raycast(_a.copy(p).addScaledVector(n, 0.3), _b.copy(n).negate(), 0.6);
    return hit ? hit.collider : null;
  }

  addGate(id: string, inFrame: RiftFrame & { kind: RiftEndKind }, outFrame: RiftFrame & { kind: RiftEndKind }) {
    const old = this.gates.get(id);
    if (old) {
      this.retire(old.in);
      this.retire(old.out);
    }
    const a = this.acquire('gate', 'gate-in', 'gate');
    const b = this.acquire('gate', 'gate-out', 'gate');
    a.tag = b.tag = id;
    a.setFrame(inFrame.position, inFrame.quaternion, inFrame.width, inFrame.height, inFrame.kind, this.findHost(inFrame));
    b.setFrame(outFrame.position, outFrame.quaternion, outFrame.width, outFrame.height, outFrame.kind, this.findHost(outFrame));
    this.gates.set(id, { id, in: a, out: b, open: true, hijacked: false });
    this.pendingOpened.push({ end: a, which: 'gate' }, { end: b, which: 'gate' });
    this.relink();
  }

  /** Remove a gate entirely (extra; addGate with the same id replaces it). */
  removeGate(id: string) {
    const g = this.gates.get(id);
    if (!g) return;
    this.retire(g.in);
    this.retire(g.out);
    this.gates.delete(id);
    this.relink();
  }

  hijackGate(id: string): boolean {
    const g = this.gates.get(id);
    if (!g || !this.exit) return false;
    if (g.hijacked) return true;
    g.hijacked = true;
    if (g.out.target > 0) {
      g.out.target = 0;
      this.pendingClosed.push(g.out);
    }
    this.relink();
    this.events.hijacked?.(id);
    return true;
  }

  isHijacked(id: string) {
    return !!this.gates.get(id)?.hijacked;
  }

  setGateOpen(id: string, open: boolean) {
    const g = this.gates.get(id);
    if (!g || g.open === open) return;
    g.open = open;
    const t = open ? 1 : 0;
    const tOut = open && !g.hijacked ? 1 : 0;
    if (open) this.pendingOpened.push({ end: g.in, which: 'gate' });
    else this.pendingClosed.push(g.in);
    if (tOut && !g.out.target) this.pendingOpened.push({ end: g.out, which: 'gate' });
    else if (!tOut && g.out.target) this.pendingClosed.push(g.out);
    g.in.target = t;
    g.out.target = tOut;
    this.relink();
  }

  setBossPair(a: (RiftFrame & { kind: RiftEndKind }) | null, b: (RiftFrame & { kind: RiftEndKind }) | null) {
    if (this.boss) {
      this.retire(this.boss.a);
      this.retire(this.boss.b);
      this.boss = null;
    }
    if (a && b) {
      const pa = this.acquire('boss', 'boss', 'boss');
      const pb = this.acquire('boss', 'boss', 'boss');
      pa.openTime = pb.openTime = FEEL.entranceOpenTime;
      pa.setFrame(a.position, a.quaternion, a.width, a.height, a.kind, this.findHost(a));
      pb.setFrame(b.position, b.quaternion, b.width, b.height, b.kind, this.findHost(b));
      this.boss = { a: pa, b: pb };
      this.pendingOpened.push({ end: pa, which: 'boss' }, { end: pb, which: 'boss' });
    }
    this.relink();
  }

  setBlockers(list: { pos: V3; radius: number }[]) {
    this.blockers = list;
  }

  // ------------------------------------------------------------------
  // Per-frame
  // ------------------------------------------------------------------

  update(dt: number, _realDt: number, time: number) {
    this.time = time;
    if (this.pendingOpened.length || this.pendingClosed.length) {
      const op = this.pendingOpened.splice(0);
      const cl = this.pendingClosed.splice(0);
      for (const o of op) this.events.opened(o.end, o.which);
      for (const c of cl) this.events.closed(c);
    }

    let released = false;
    for (const p of this.drawn) {
      const rate = p.target > 0 ? 1 / p.openTime : 1 / FEEL.portalCloseTime;
      p.open = THREE.MathUtils.clamp(p.open + Math.sign(p.target - p.open) * rate * dt, 0, 1);
      p.pulse = Math.max(0, p.pulse - dt * 2);
      if (!this.replaying) p.applyUniforms(time, p.target > 0 ? easeOutBack(p.open) : p.open, p.dormant);
    }
    for (let i = this.closing.length - 1; i >= 0; i--) {
      const p = this.closing[i];
      if (p.open > 0 || p.target > 0) continue;
      this.closing.splice(i, 1);
      this.release(p);
      released = true;
    }
    if (released) this.relink();

    // pooled lights on the visible ends
    let li = 0;
    const list = this.replaying ? this.replaySet : this.drawn;
    for (const p of list) {
      if (li >= this.lights.length) break;
      if (!p.root.visible) continue;
      const L = this.lights[li++];
      frameNormal(p.vis, _a);
      L.position.copy(p.vis.position).addScaledVector(_a, 0.5);
      L.color.copy(p.mat.uniforms.uColor.value);
      const open = this.replaying ? p.mat.uniforms.uOpen.value : p.open;
      L.intensity = 3.2 * Math.min(1, open) * (1 + p.pulse) * (p.dormant && !this.replaying ? 0.3 : 1);
    }
    for (; li < this.lights.length; li++) this.lights[li].intensity = 0;

    this.beamMat.uniforms.uTime.value = time;
    this.plumbMat.uniforms.uTime.value = time;
    this.ghostMat.uniforms.uTime.value = time;
  }

  updatePreview(aim: ExitAim | null, handPos: V3, cam: THREE.Camera) {
    const show = !!aim;
    for (const h of this.helpers) h.visible = show;
    const fig = this.ghostFigure;
    if (!aim) {
      if (fig) fig.visible = false;
      return;
    }
    const f = aim.frame;
    const n = frameNormal(f, _a);
    const hatch = n.y < -0.5;
    const col = aim.valid ? OUTCOME_COLOR[aim.outcome] : INVALID_COLOR;
    this.ghostMat.uniforms.uColor.value.copy(col);
    this.ringMat.color.copy(col).multiplyScalar(2);
    this.beamMat.uniforms.uColor.value.copy(col);
    this.plumbMat.uniforms.uColor.value.copy(col);

    this.ghost.position.copy(f.position).addScaledVector(n, 0.012);
    this.ghost.quaternion.copy(f.quaternion);
    this.ghost.scale.set(f.width * PORTAL_MESH_SCALE.x, f.height * PORTAL_MESH_SCALE.y, 1);
    this.ring.position.copy(aim.exitFeet).y += 0.04;
    this.arrow.position.copy(aim.exitFeet).y += 0.05;
    this.arrow.rotation.y = aim.exitYaw;
    this.arrow.visible = !hatch;
    if (fig) {
      fig.visible = aim.valid && !hatch;
      fig.position.copy(aim.exitFeet);
      fig.rotation.y = aim.exitYaw;
    }

    // beam from the gauntlet to the end
    const camPos = cam.getWorldPosition(_camPos);
    this.orientBeam(this.beam, this.beamMat, handPos, f.position, camPos);

    // plumb line from where things come out down to where they land
    const top = hatch ? _b.copy(f.position) : _b.copy(aim.exitFeet).setY(aim.exitFeet.y + 0.1);
    const drop = aim.dropBelow;
    const landY = Number.isFinite(drop) ? aim.exitFeet.y - drop : top.y - 30;
    const showPlumb = aim.kind !== 'floor' && top.y - landY > 0.6;
    this.plumb.visible = showPlumb;
    this.land.visible = showPlumb;
    if (showPlumb) {
      this.orientBeam(this.plumb, this.plumbMat, top, _c.set(top.x, landY, top.z), camPos);
      this.land.position.set(top.x, landY + 0.05, top.z);
    }
  }

  /** Stretch a unit beam quad from a to b, billboarded around its axis. */
  private orientBeam(mesh: THREE.Mesh, mat: THREE.ShaderMaterial, a: V3, b: V3, camPos: V3) {
    const len = a.distanceTo(b);
    const dir = _bd.subVectors(b, a).normalize();
    mesh.position.copy(a).lerp(b, 0.5);
    mesh.scale.set(1, Math.max(len, 1e-3), 1);
    const toCam = _bt.subVectors(camPos, mesh.position).normalize();
    const x = _bx.crossVectors(dir, toCam);
    if (x.lengthSq() < 1e-8) x.set(1, 0, 0);
    x.normalize();
    const z = _bz.crossVectors(x, dir).normalize();
    mesh.quaternion.setFromRotationMatrix(_m.makeBasis(x, dir, z));
    mat.uniforms.uLen.value = len;
  }

  // ------------------------------------------------------------------
  // Rendering the windows
  // ------------------------------------------------------------------

  renderViews(camera: THREE.PerspectiveCamera, screenW: number, screenH: number, hide: THREE.Object3D[]) {
    const r = this.renderer;
    if (!r) return;
    camera.updateMatrixWorld();
    camera.getWorldPosition(_camPos);
    camera.getWorldQuaternion(_camQuat);
    _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_m);
    const all = this.replaying ? this.replaySet : this.drawn;
    for (const p of all) {
      p.mat.uniforms.uHasView.value = 0;
      p.mat.uniforms.tView.value = null;
    }
    const views = this.viewList;
    views.length = 0;
    for (const p of all) {
      const q = p.view;
      if (!q || q === p || !p.root.visible || !q.root.parent) continue;
      if (p.mat.uniforms.uOpen.value < 0.01 || q.mat.uniforms.uOpen.value < 0.01) continue;
      if (!this.replaying && (p.target === 0 || q.target === 0)) continue;
      frameNormal(p.vis, _a);
      if (_b.subVectors(_camPos, p.vis.position).dot(_a) <= 0) continue; // only from the front
      if (_camPos.distanceTo(p.vis.position) > 70) continue;
      if (!_frustum.intersectsObject(p.mesh)) continue;
      views.push(p);
    }
    const dpr = r.getPixelRatio();
    const pw = screenW * dpr, ph = screenH * dpr;
    if (views.length) {
      views.sort(byCamDistance);
      if (views.length > this.maxViews) views.length = Math.max(0, this.maxViews);
      const w = Math.max(64, Math.floor(pw * this.portalScale)), h = Math.max(64, Math.floor(ph * this.portalScale));
      const prevTarget = r.getRenderTarget();
      const prevClip = r.clippingPlanes;
      const prevShadow = r.shadowMap.autoUpdate;
      r.shadowMap.autoUpdate = false; // last frame's shadow maps are fine for the windows
      const hv = this.hideVis;
      hv.length = 0;
      for (const o of hide) {
        hv.push(o.visible);
        o.visible = false;
      }
      const hs = this.helperVis;
      for (let k = 0; k < this.helpers.length; k++) {
        hs[k] = this.helpers[k].visible;
        this.helpers[k].visible = false;
      }
      const figVis = this.ghostFigure?.visible ?? false;
      if (this.ghostFigure) this.ghostFigure.visible = false;
      const rv = this.rootVis;
      rv.length = 0;
      for (const p of all) rv.push(p.root.visible);

      for (let i = 0; i < views.length; i++) {
        const p = views[i];
        const q = p.view!;
        let rt = this.rts[i];
        if (!rt || rt.width !== w || rt.height !== h) {
          rt?.dispose();
          rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
          this.rts[i] = rt;
        }
        // virtual camera = the real one carried through the rift
        this.vcam.copy(camera, false);
        passPoint(p.vis, q.vis, _camPos, this.vcam.position);
        this.vcam.quaternion.copy(passRotation(p.vis, q.vis, _q)).multiply(_camQuat);
        this.vcam.updateMatrixWorld(true);
        // clip everything behind the far end
        frameNormal(q.vis, _a);
        this.clipPlane.setFromNormalAndCoplanarPoint(_a, q.vis.position);
        this.clipPlane.constant -= 0.01;
        r.clippingPlanes = this.clipList;
        // other rifts stay visible inside the view, this pair doesn't
        for (let k = 0; k < all.length; k++) {
          const o = all[k];
          o.root.visible = rv[k] && o !== p && o !== q && o.view !== p;
        }
        r.setRenderTarget(rt);
        r.clear();
        r.render(this.scene, this.vcam);
        p.mat.uniforms.tView.value = rt.texture;
      }
      // windows seen inside other windows stay swirls (their screen mapping differs there)
      for (let i = 0; i < views.length; i++) views[i].mat.uniforms.uHasView.value = 1;

      r.clippingPlanes = prevClip;
      r.setRenderTarget(prevTarget);
      r.shadowMap.autoUpdate = prevShadow;
      for (let k = 0; k < hide.length; k++) hide[k].visible = hv[k];
      for (let k = 0; k < this.helpers.length; k++) this.helpers[k].visible = hs[k];
      if (this.ghostFigure) this.ghostFigure.visible = figVis;
      for (let k = 0; k < all.length; k++) all[k].root.visible = rv[k];
    }
    for (const p of all) p.mat.uniforms.uScreen.value.set(pw, ph);
  }

  // ------------------------------------------------------------------
  // Replay snapshots
  // ------------------------------------------------------------------

  snapshot(): RiftSnap[] {
    const out: RiftSnap[] = [];
    for (const p of this.drawn) {
      if (p.target === 0 && p.open <= 0) continue;
      out.push({
        id: p.id,
        pos: [p.position.x, p.position.y, p.position.z],
        quat: [p.quaternion.x, p.quaternion.y, p.quaternion.z, p.quaternion.w],
        kind: p.kind,
        // what is drawn (eased opening / linear closing), so replays look the same
        open: Math.max(0, p.mat.uniforms.uOpen.value as number),
        color: p.color,
        linkedId: p.linked.id,
      });
    }
    return out;
  }

  /**
   * Show a recorded state (visual only; live rifts are untouched). Applying
   * a snapshot that matches the live state returns to normal play visuals.
   */
  applySnapshot(s: RiftSnap[]) {
    if (this.matchesLive(s)) {
      this.endReplay();
      return;
    }
    if (!this.replaying) {
      this.replaying = true;
      for (const p of this.drawn) p.root.visible = false;
    }
    const set = this.replaySet;
    while (set.length < s.length) {
      const p = this.pool.pop() ?? new Portal();
      this.group.add(p.root);
      set.push(p);
    }
    while (set.length > s.length) this.releaseReplay(set.pop()!);
    for (let i = 0; i < s.length; i++) {
      const sn = s[i];
      const p = set[i];
      p.id = sn.id;
      _a.set(sn.pos[0], sn.pos[1], sn.pos[2]);
      _q2.set(sn.quat[0], sn.quat[1], sn.quat[2], sn.quat[3]);
      const flat = sn.kind === 'floor' || sn.kind === 'ceiling' || (sn.kind === 'air' && Math.abs(frameNormal({ position: _a, quaternion: _q2, width: 1, height: 1 }, _b).y) > 0.5);
      p.setFrame(_a, _q2, flat ? FLAT : DOOR_W, flat ? FLAT : DOOR_H, sn.kind, null);
      p.recolor(sn.color);
      p.open = Math.min(1, sn.open);
      p.target = 1;
      p.pulse = 0;
      p.applyUniforms(this.time, sn.open, false);
    }
    for (let i = 0; i < s.length; i++) {
      const p = set[i];
      const lid = s[i].linkedId;
      p.view = lid !== s[i].id ? set.find((q) => q.id === lid) ?? null : null;
      p.linked = p;
      p.mat.uniforms.uDormant.value = p.view ? 0 : s.some((o) => o.linkedId === p.id && o.id !== p.id) ? 0 : 1;
    }
  }

  /** Leave replay visuals (also done by applySnapshot(liveSnapshot)). */
  endReplay() {
    if (!this.replaying) return;
    this.replaying = false;
    while (this.replaySet.length) this.releaseReplay(this.replaySet.pop()!);
    for (const p of this.drawn) {
      p.syncVisual();
      p.applyUniforms(this.time, p.target > 0 ? easeOutBack(p.open) : p.open, p.dormant);
    }
  }

  private releaseReplay(p: Portal) {
    p.id = nextEndId++;
    this.release(p);
  }

  private matchesLive(s: RiftSnap[]) {
    let n = 0;
    for (const p of this.drawn) if (!(p.target === 0 && p.open <= 0)) n++;
    if (n !== s.length) return false;
    for (const sn of s) {
      const p = this.drawn.find((q) => q.id === sn.id);
      if (!p) return false;
      if (Math.abs(p.position.x - sn.pos[0]) + Math.abs(p.position.y - sn.pos[1]) + Math.abs(p.position.z - sn.pos[2]) > 1e-4) return false;
      if (Math.abs(Math.max(0, p.mat.uniforms.uOpen.value as number) - sn.open) > 1e-4) return false;
    }
    return true;
  }

  reset() {
    this.endReplay();
    for (const p of this.closing) this.release(p);
    this.closing = [];
    if (this.entrance) this.release(this.entrance);
    if (this.exit) this.release(this.exit);
    this.entrance = this.exit = null;
    if (this.boss) {
      this.release(this.boss.a);
      this.release(this.boss.b);
      this.boss = null;
    }
    // gates stay (level-owned) but come back open and un-hijacked
    for (const g of this.gates.values()) {
      g.hijacked = false;
      g.open = true;
      g.in.target = g.out.target = 1;
      g.in.open = g.out.open = 1;
    }
    this.pendingOpened.length = 0;
    this.pendingClosed.length = 0;
    this.blockers = [];
    this.aiming = false;
    this.airDistance = null;
    this.orientation = 'auto';
    for (const h of this.helpers) h.visible = false;
    if (this.ghostFigure) this.ghostFigure.visible = false;
    this.relink();
    for (const p of this.drawn) p.applyUniforms(this.time, p.open, p.dormant);
  }
}

/** Clamp a coordinate so an end of half-size `half` stays on [lo, hi] (centred if it can't). */
function clampOn(v: number, lo: number, hi: number, half: number) {
  if (hi - lo < half * 2) return (lo + hi) / 2;
  return THREE.MathUtils.clamp(v, lo + half, hi - half);
}

/** Does the collider's face lie on this (axis-aligned) wall end's plane? */
function faceHolds(c: Collider, p: Portal) {
  const n = p.normal;
  if (Math.abs(n.x) > 0.9) return Math.abs((n.x > 0 ? c.max.x : c.min.x) - p.position.x) < 0.1;
  if (Math.abs(n.z) > 0.9) return Math.abs((n.z > 0 ? c.max.z : c.min.z) - p.position.z) < 0.1;
  return false;
}

function createBeamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.2, 1, 0.9) }, uLen: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: `uniform float uTime, uLen; uniform vec3 uColor; varying vec2 vUv;
      void main(){ float dash = step(0.45, fract(vUv.y * uLen * 1.5 - uTime * 3.0)); float side = 1.0 - abs(vUv.x - 0.5) * 2.0;
      float a = side * (0.25 + dash * 0.55) * smoothstep(0.0, 0.1, vUv.y); gl_FragColor = vec4(uColor * 2.0 * a, a); }`,
  });
}
