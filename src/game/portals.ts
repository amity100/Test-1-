import * as THREE from 'three';
import { FEEL } from '../config';
import { CollisionWorld, Collider } from '../world/collision';
import { createPortalMaterial, createSparks, PORTAL_MESH_SCALE } from '../render/portalMaterial';
import { crossing, frameNormal, orientFrame, passDirection, passPoint, passRotation, RiftFrame, toLocal, yawOf } from './portalMath';

export const RIFT_COLOR = new THREE.Color(1.0, 0.55, 0.12);
export const ANCHOR_COLOR = new THREE.Color(0.1, 0.85, 1.0);

export type PlacementKind = 'stand' | 'wall' | 'ceiling';
export type SnapKind = 'behind' | 'above' | null;
export type Invalid = 'range' | 'close' | 'los' | 'space' | 'inhibited' | 'charge' | null;

export interface SnapTarget {
  id: string;
  pos: THREE.Vector3;
  forward: THREE.Vector3;
  aware: boolean;
}

export interface Placement {
  frame: RiftFrame;
  kind: PlacementKind;
  host: Collider | null;
  exitFeet: THREE.Vector3;
  exitYaw: number;
  snap: SnapKind;
  snapId: string | null;
  invalid: Invalid;
  exposure: number;
  light: number;
  distance: number;
}

export interface RiftContext {
  world: CollisionWorld;
  snapTargets(): SnapTarget[];
  exposureAt(p: THREE.Vector3): number;
  lightAt(p: THREE.Vector3): number;
  inhibited(p: THREE.Vector3): boolean;
}

export class Portal implements RiftFrame {
  position = new THREE.Vector3();
  quaternion = new THREE.Quaternion();
  width = FEEL.portalWidth;
  height = FEEL.portalHeight;
  normal = new THREE.Vector3();
  host: Collider | null = null;
  kind: PlacementKind = 'stand';
  open = 0;
  target = 0;
  linked!: Portal;
  mesh: THREE.Mesh;
  sparks: THREE.Points;
  mat: THREE.ShaderMaterial;
  rt: THREE.WebGLRenderTarget | null = null;
  light: THREE.PointLight | null = null;
  hum: { stop(): void; move(v: THREE.Vector3): void } | null = null;
  rendered = false;

  constructor(color: THREE.Color) {
    this.mat = createPortalMaterial(color);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.width * PORTAL_MESH_SCALE.x, this.height * PORTAL_MESH_SCALE.y), this.mat);
    this.mesh.renderOrder = 20;
    this.mesh.frustumCulled = true;
    this.sparks = createSparks(color);
    this.mesh.add(this.sparks);
  }

  setFrame(f: { position: THREE.Vector3; quaternion: THREE.Quaternion }, kind: PlacementKind, host: Collider | null) {
    this.position.copy(f.position);
    this.quaternion.copy(f.quaternion);
    this.kind = kind;
    this.host = host;
    frameNormal(this, this.normal);
    this.mesh.position.copy(this.position).addScaledVector(this.normal, 0.012);
    this.mesh.quaternion.copy(this.quaternion);
    this.mesh.updateMatrixWorld(true);
  }

  get isOpen() {
    return this.open > 0.85 && this.target > 0;
  }
}

export class RiftPair {
  closeTimer = -1;
  life = 0;
  constructor(public a: Portal, public b: Portal, public kind: 'rift' | 'anchor') {
    a.linked = b;
    b.linked = a;
  }
  get portals() {
    return [this.a, this.b];
  }
  get closing() {
    return this.a.target === 0;
  }
}

export interface Traveler {
  /** Point used for crossing tests (e.g. chest). */
  prev: THREE.Vector3;
  cur: THREE.Vector3;
}

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

/**
 * Everything about rifts: placement solving (the "smart cursor"), the
 * hologram preview, opening/closing, traversal maths and rendering the
 * see-through views.
 */
export class RiftSystem {
  group = new THREE.Group();
  pairs: RiftPair[] = [];
  charges = FEEL.riftCharges;
  focus = FEEL.focusDuration;
  aiming = false;
  aimAmount = 0;
  distanceOverride: number | null = null;
  rotation = 0;
  placement: Placement | null = null;
  anchor: { frame: RiftFrame; kind: PlacementKind; host: Collider | null; exitFeet: THREE.Vector3; exitYaw: number } | null = null;
  anchorMarker: THREE.Group;
  riftsOpened = 0;

  // preview
  ghost: THREE.Mesh;
  ghostMat: THREE.ShaderMaterial;
  ghostRing: THREE.Mesh;
  ghostArrow: THREE.Mesh;
  beam: THREE.Mesh;
  private beamMat: THREE.ShaderMaterial;
  ghostFigure: THREE.Object3D | null = null;

  private lightPool: THREE.PointLight[] = [];
  private vcam = new THREE.PerspectiveCamera();
  private clipPlane = new THREE.Plane();
  private portalPool: Portal[] = [];

  constructor(private ctx: RiftContext, private scene: THREE.Scene, private renderer: THREE.WebGLRenderer, private portalScale: number, lightCount: number) {
    this.scene.add(this.group);
    this.ghostMat = createPortalMaterial(new THREE.Color(0.2, 1, 0.9));
    this.ghostMat.uniforms.uGhost.value = 1;
    this.ghostMat.depthWrite = false;
    this.ghost = new THREE.Mesh(new THREE.PlaneGeometry(FEEL.portalWidth * PORTAL_MESH_SCALE.x, FEEL.portalHeight * PORTAL_MESH_SCALE.y), this.ghostMat);
    this.ghost.renderOrder = 30;
    this.ghost.visible = false;
    this.ghost.userData.helper = true;
    this.group.add(this.ghost);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0x20ffe0, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.ghostRing = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 40), ringMat);
    this.ghostRing.rotation.x = -Math.PI / 2;
    this.ghostRing.visible = false;
    this.ghostRing.userData.helper = true;
    this.group.add(this.ghostRing);
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
    this.ghostArrow = new THREE.Mesh(ag, ringMat);
    this.ghostArrow.visible = false;
    this.ghostArrow.userData.helper = true;
    this.group.add(this.ghostArrow);

    this.beamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.2, 1, 0.9) }, uLen: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
      fragmentShader: `uniform float uTime, uLen; uniform vec3 uColor; varying vec2 vUv;
        void main(){ float dash = step(0.45, fract(vUv.y * uLen * 1.5 - uTime * 3.0)); float side = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float a = side * (0.25 + dash * 0.55) * smoothstep(0.0, 0.1, vUv.y); gl_FragColor = vec4(uColor * 2.0 * a, a); }`,
    });
    this.beam = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 1), this.beamMat);
    this.beam.visible = false;
    this.beam.userData.helper = true;
    this.beam.renderOrder = 31;
    this.group.add(this.beam);

    // anchor marker: a slowly turning beacon
    this.anchorMarker = new THREE.Group();
    const aRing = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.55, 48), new THREE.MeshBasicMaterial({ color: ANCHOR_COLOR.clone().multiplyScalar(2.5), transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    aRing.rotation.x = -Math.PI / 2;
    aRing.position.y = 0.03;
    const aBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 6, 1, true), new THREE.MeshBasicMaterial({ color: ANCHOR_COLOR.clone().multiplyScalar(1.5), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    aBeam.position.y = 1.3;
    this.anchorMarker.add(aRing, aBeam);
    this.anchorMarker.visible = false;
    this.anchorMarker.userData.helper = true;
    this.group.add(this.anchorMarker);

    for (let i = 0; i < lightCount; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 9, 1.8);
      this.lightPool.push(l);
      this.group.add(l);
    }
  }

  private makePortal(color: THREE.Color) {
    const p = this.portalPool.find((q) => !q.mesh.parent && q.mat.uniforms.uColor.value.equals(color)) ?? new Portal(color);
    if (!this.portalPool.includes(p)) this.portalPool.push(p);
    p.open = 0;
    p.target = 1;
    p.rendered = false;
    this.group.add(p.mesh);
    return p;
  }

  setPortalScale(s: number) {
    this.portalScale = s;
    for (const p of this.portalPool) {
      p.rt?.dispose();
      p.rt = null;
    }
  }

  // ------------------------------------------------------------------
  // Placement solving
  // ------------------------------------------------------------------

  /** Frame for a free-standing rift whose bottom sits on `groundY`. */
  standingFrame(x: number, groundY: number, z: number, normal: THREE.Vector3) {
    const n = _v.set(normal.x, 0, normal.z).normalize().clone();
    return { position: new THREE.Vector3(x, groundY + FEEL.portalHeight / 2 + 0.02, z), quaternion: orientFrame(n, UP) };
  }

  private standingClear(base: THREE.Vector3, n: THREE.Vector3, skip?: Collider | null) {
    const w = this.ctx.world;
    const H = FEEL.portalHeight;
    const side = _v2.set(n.z, 0, -n.x);
    // exit column
    const ex = base.x + n.x * 0.55, ez = base.z + n.z * 0.55;
    const sk = skip ? (c: Collider) => c === skip : undefined;
    if (w.overlapsCylinder(ex, ez, FEEL.playerRadius, base.y + 0.02, base.y + H - 0.05, sk)) return false;
    // both sides of the rift plane
    for (const s of [-0.45, 0, 0.45]) {
      const px = base.x + side.x * s, pz = base.z + side.z * s;
      if (w.overlapsCylinder(px, pz, 0.12, base.y + 0.05, base.y + H, sk)) return false;
    }
    // headroom
    if (w.ceilingAt(ex, ez, 0.2, base.y + 0.1) < base.y + 1.9) return false;
    // ground under the exit
    const g = w.groundAt(ex, ez, 0.15, base.y + 0.4);
    if (!(g > base.y - 0.6)) return false;
    return true;
  }

  /**
   * The smart cursor. Turns a camera ray into the best rift placement:
   * surfaces decide orientation, the wheel overrides distance, and nearby
   * unaware guards magnetise the rift behind them.
   */
  solve(camPos: THREE.Vector3, dir: THREE.Vector3, playerEye: THREE.Vector3, playerFeet: THREE.Vector3, freeAim: boolean, touch: boolean): Placement {
    const w = this.ctx.world;
    const maxRay = FEEL.riftRange + 10;
    const hit = w.raycast(camPos, dir, maxRay, { sight: true });
    const along = Math.max(0, _v.subVectors(playerEye, camPos).dot(dir));
    const aimYaw = yawOf(dir);
    const rot = this.rotation;
    let kind: PlacementKind = 'stand';
    let host: Collider | null = null;
    let frame: { position: THREE.Vector3; quaternion: THREE.Quaternion };
    let exitFeet = new THREE.Vector3();
    let exitYaw = aimYaw + rot;
    let snap: SnapKind = null;
    let snapId: string | null = null;
    const standNormal = new THREE.Vector3(Math.sin(aimYaw + rot), 0, Math.cos(aimYaw + rot));

    let point: THREE.Vector3;
    let surfaceHit = hit;
    if (this.distanceOverride !== null) {
      const t = along + this.distanceOverride;
      const limit = hit ? hit.distance - 0.4 : maxRay;
      point = camPos.clone().addScaledVector(dir, Math.min(t, limit));
      surfaceHit = null;
    } else if (hit) {
      point = hit.point.clone();
    } else {
      point = camPos.clone().addScaledVector(dir, along + FEEL.riftRange);
    }

    // clamp to rift range from the player (so the ghost slides along the ray)
    const fromEye = point.distanceTo(playerEye);
    if (fromEye > FEEL.riftRange && !surfaceHit) {
      point = playerEye.clone().add(point.clone().sub(playerEye).setLength(FEEL.riftRange));
    }

    if (surfaceHit && surfaceHit.normal.y < -0.7 && !surfaceHit.collider.noPortal) {
      // ceiling: drop out from above
      kind = 'ceiling';
      host = surfaceHit.collider;
      const q = orientFrame(new THREE.Vector3(0, -1, 0), standNormal);
      frame = { position: point.clone().add(new THREE.Vector3(0, -0.02, 0)), quaternion: q };
      exitFeet.set(point.x, point.y - 1.95, point.z);
    } else if (surfaceHit && Math.abs(surfaceHit.normal.y) < 0.3 && !surfaceHit.collider.noPortal) {
      // wall: step out of the wall, facing away from it
      kind = 'wall';
      host = surfaceHit.collider;
      const n = surfaceHit.normal.clone();
      const g = w.groundAt(point.x + n.x * 0.6, point.z + n.z * 0.6, 0.2, point.y + 0.3);
      const H = FEEL.portalHeight, W = FEEL.portalWidth;
      let cy = point.y;
      if (g > -Infinity && point.y - g < H) cy = g + H / 2 + 0.02; // sit on the floor
      // keep the rift fully on the host face
      const c = host;
      const tangentAxis = Math.abs(n.x) > 0.5 ? 'z' : 'x';
      const center = new THREE.Vector3(point.x, cy, point.z);
      const lo = (c.min as any)[tangentAxis] + W / 2 + 0.05, hi = (c.max as any)[tangentAxis] - W / 2 - 0.05;
      if (lo > hi) center.setComponent(tangentAxis === 'x' ? 0 : 2, ((c.min as any)[tangentAxis] + (c.max as any)[tangentAxis]) / 2);
      else center.setComponent(tangentAxis === 'x' ? 0 : 2, THREE.MathUtils.clamp((center as any)[tangentAxis], lo, hi));
      center.y = THREE.MathUtils.clamp(center.y, c.min.y + H / 2 + 0.02, c.max.y - H / 2 - 0.02);
      frame = { position: center, quaternion: orientFrame(n, UP) };
      exitFeet.set(center.x + n.x * 0.6, center.y - H / 2 + 0.02, center.z + n.z * 0.6);
      exitYaw = yawOf(n);
      if (lo > hi || c.max.y - c.min.y < H + 0.04) {
        // host face too small: fall back to standing in front of it
        kind = 'stand';
        host = null;
        const gy = w.groundAt(point.x + n.x * 0.9, point.z + n.z * 0.9, 0.2, point.y + 0.5);
        frame = this.standingFrame(point.x + n.x * 0.9, gy, point.z + n.z * 0.9, standNormal);
        exitFeet.set(frame.position.x + standNormal.x * 0.55, gy, frame.position.z + standNormal.z * 0.55);
        exitYaw = aimYaw + rot;
      }
    } else {
      // floor / open air / manual distance: stand the rift up on the ground below
      const gy = w.groundAt(point.x, point.z, 0.25, point.y + 0.6);
      const baseY = gy > -50 ? gy : point.y;
      frame = this.standingFrame(point.x, baseY, point.z, standNormal);
      exitFeet.set(point.x + standNormal.x * 0.55, baseY, point.z + standNormal.z * 0.55);
    }

    // ---- magnet snapping onto guards ----
    if (!freeAim) {
      const radius = touch ? FEEL.snapRadiusTouch : FEEL.snapRadius;
      let best: SnapTarget | null = null;
      let bestD = radius;
      for (const g of this.ctx.snapTargets()) {
        if (g.aware) continue;
        // distance from the aim ray or from the solved point, whichever is closer
        const dPoint = Math.hypot(g.pos.x - point.x, g.pos.z - point.z);
        _v.subVectors(g.pos, camPos).setY(g.pos.y + 1 - camPos.y);
        const proj = _v.dot(dir);
        const dRay = proj > 0 ? _v.clone().sub(dir.clone().multiplyScalar(proj)).length() : Infinity;
        const d = Math.min(dPoint, dRay * 1.4);
        if (d < bestD && g.pos.distanceTo(playerFeet) > 2.6) {
          bestD = d;
          best = g;
        }
      }
      if (best) {
        const f = best.forward;
        if (kind === 'ceiling' && Math.hypot(best.pos.x - point.x, best.pos.z - point.z) < 2.6) {
          frame.position.set(best.pos.x, frame.position.y, best.pos.z);
          exitFeet.set(best.pos.x, frame.position.y - 1.95, best.pos.z);
          snap = 'above';
          snapId = best.id;
        } else {
          for (const back of [1.55, 1.3, 1.9]) {
            const bx = best.pos.x - f.x * back, bz = best.pos.z - f.z * back;
            const gy = w.groundAt(bx, bz, 0.25, best.pos.y + 0.6);
            if (!(gy > best.pos.y - 0.6)) continue;
            const base = new THREE.Vector3(bx, gy, bz);
            const fn = new THREE.Vector3(f.x, 0, f.z).normalize();
            if (!this.standingClear(base, fn)) continue;
            frame = this.standingFrame(bx, gy, bz, fn);
            exitFeet.set(bx + fn.x * 0.55, gy, bz + fn.z * 0.55);
            exitYaw = yawOf(fn);
            kind = 'stand';
            host = null;
            snap = 'behind';
            snapId = best.id;
            break;
          }
        }
      }
    }

    // ---- validation ----
    let invalid: Invalid = null;
    const center = frame.position;
    const dist = center.distanceTo(playerEye);
    if (this.charges < 1) invalid = 'charge';
    else if (this.ctx.inhibited(center) || this.ctx.inhibited(playerFeet)) invalid = 'inhibited';
    else if (dist > FEEL.riftRange + 0.5) invalid = 'range';
    else if (dist < FEEL.riftMinDistance) invalid = 'close';
    else {
      // line of sight from the eye to the rift centre (a hair in front of it)
      const n = frameNormal(frame as any, new THREE.Vector3());
      const target = center.clone().addScaledVector(n, 0.15);
      if (!w.lineOfSight(playerEye, target, host)) invalid = 'los';
      else if (kind === 'stand') {
        const base = new THREE.Vector3(center.x, center.y - FEEL.portalHeight / 2 - 0.02, center.z);
        if (!this.standingClear(base, n)) invalid = 'space';
      } else if (kind === 'wall') {
        if (w.overlapsCylinder(exitFeet.x, exitFeet.z, FEEL.playerRadius, exitFeet.y + 0.05, exitFeet.y + 1.7, (c) => c === host)) invalid = 'space';
      } else if (kind === 'ceiling') {
        if (exitFeet.y < -0.5 || w.overlapsCylinder(exitFeet.x, exitFeet.z, FEEL.playerRadius, exitFeet.y + 0.1, exitFeet.y + 1.8, (c) => c === host)) invalid = 'space';
        const g = w.groundAt(exitFeet.x, exitFeet.z, 0.2, exitFeet.y + 1.5);
        if (g < -50) invalid = 'space';
      }
      if (!invalid) {
        for (const p of this.openPortals()) if (p.position.distanceTo(center) < 1.3) invalid = 'space';
      }
    }

    const probe = exitFeet.clone().add(new THREE.Vector3(0, 1.2, 0));
    return {
      frame: { position: frame.position, quaternion: frame.quaternion, width: FEEL.portalWidth, height: FEEL.portalHeight },
      kind,
      host,
      exitFeet,
      exitYaw,
      snap,
      snapId,
      invalid,
      exposure: this.ctx.exposureAt(probe),
      light: this.ctx.lightAt(probe),
      distance: dist,
    };
  }

  /**
   * Where the near end goes: a doorway right in front of the player (or on
   * the wall they face). Null means "no room" and the pass happens instantly.
   */
  solveNear(playerFeet: THREE.Vector3, yaw: number): { frame: RiftFrame; kind: PlacementKind; host: Collider | null } | null {
    const w = this.ctx.world;
    const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const chest = playerFeet.clone().add(new THREE.Vector3(0, 1.1, 0));
    const hit = w.raycast(chest, f, 2.0, { sight: false });
    if (hit && Math.abs(hit.normal.y) < 0.3 && !hit.collider.noPortal && hit.collider.max.y - hit.collider.min.y > FEEL.portalHeight) {
      const n = hit.normal;
      const H = FEEL.portalHeight;
      const center = new THREE.Vector3(hit.point.x, playerFeet.y + H / 2 + 0.02, hit.point.z);
      const c = hit.collider;
      const axis = Math.abs(n.x) > 0.5 ? 'z' : 'x';
      const lo = (c.min as any)[axis] + FEEL.portalWidth / 2 + 0.05, hi = (c.max as any)[axis] - FEEL.portalWidth / 2 - 0.05;
      if (lo <= hi && c.min.y <= playerFeet.y + 0.05 && c.max.y >= center.y + H / 2) {
        center.setComponent(axis === 'x' ? 0 : 2, THREE.MathUtils.clamp((center as any)[axis], lo, hi));
        return { frame: { position: center, quaternion: orientFrame(n, UP), width: FEEL.portalWidth, height: FEEL.portalHeight }, kind: 'wall', host: c };
      }
    }
    for (const d of [FEEL.nearPortalDistance, 1.1]) {
      const base = new THREE.Vector3(playerFeet.x + f.x * d, playerFeet.y, playerFeet.z + f.z * d);
      const g = w.groundAt(base.x, base.z, 0.2, playerFeet.y + 0.5);
      if (!(g > playerFeet.y - 0.5)) continue;
      base.y = g;
      const n = f.clone().negate();
      if (!this.standingClear(base, n)) continue;
      // nothing between player and the rift
      if (!w.lineOfSight(chest, base.clone().setY(g + 1.1))) continue;
      const fr = this.standingFrame(base.x, g, base.z, n);
      return { frame: { ...fr, width: FEEL.portalWidth, height: FEEL.portalHeight }, kind: 'stand', host: null };
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Opening / closing
  // ------------------------------------------------------------------

  openPair(near: { frame: RiftFrame; kind: PlacementKind; host: Collider | null }, far: { frame: RiftFrame; kind: PlacementKind; host: Collider | null }, kind: 'rift' | 'anchor') {
    // one live pair per kind: replace the older one
    for (const p of this.pairs) if (p.kind === kind && !p.closing) this.closePair(p);
    const color = kind === 'anchor' ? ANCHOR_COLOR : RIFT_COLOR;
    const a = this.makePortal(color);
    const b = this.makePortal(color);
    a.setFrame(near.frame, near.kind, near.host);
    b.setFrame(far.frame, far.kind, far.host);
    const pair = new RiftPair(a, b, kind);
    this.pairs.push(pair);
    this.riftsOpened++;
    return pair;
  }

  closePair(p: RiftPair) {
    for (const q of p.portals) q.target = 0;
    p.closeTimer = -1;
  }

  closeAll() {
    for (const p of this.pairs) if (!p.closing) this.closePair(p);
  }

  openPortals(): Portal[] {
    const out: Portal[] = [];
    for (const p of this.pairs) for (const q of p.portals) if (q.target > 0) out.push(q);
    return out;
  }

  /** Rifts that are open (or opening) — used by guards noticing them. */
  livePairs() {
    return this.pairs.filter((p) => !p.closing);
  }

  // ------------------------------------------------------------------
  // Traversal
  // ------------------------------------------------------------------

  /** If the segment prev→cur passes through an open rift, returns it. */
  findCrossing(prev: THREE.Vector3, cur: THREE.Vector3, margin = 0): Portal | null {
    for (const pair of this.pairs) {
      for (const p of pair.portals) {
        if (!p.isOpen || !p.linked.isOpen) continue;
        if (crossing(p, prev, cur, margin) >= 0) return p;
      }
    }
    return null;
  }

  /** Should a mover near rift `p` ignore its host wall (walking into the rift)? */
  hostPassable(c: Collider, pos: THREE.Vector3, radius: number) {
    for (const pair of this.pairs) {
      for (const p of pair.portals) {
        if (p.host !== c || !p.isOpen) continue;
        const l = toLocal(p, pos, _v);
        if (Math.abs(l.x) < p.width / 2 - radius * 0.3 && l.z > -1.2 && l.z < radius + 0.6 && Math.abs(l.y) < p.height / 2 + 0.5) return true;
      }
    }
    return false;
  }

  transform(from: Portal, p: THREE.Vector3, out = new THREE.Vector3()) {
    return passPoint(from, from.linked, p, out);
  }

  transformDir(from: Portal, d: THREE.Vector3, out = new THREE.Vector3()) {
    return passDirection(from, from.linked, d, out);
  }

  markPassed(p: Portal, who: 'player' | 'body') {
    const pair = this.pairs.find((q) => q.a === p || q.b === p);
    if (!pair) return;
    pair.closeTimer = who === 'player' ? FEEL.autoCloseAfterPass : Math.max(pair.closeTimer, 1.2);
    for (const q of pair.portals) q.mat.uniforms.uPulse.value = 1;
  }

  // ------------------------------------------------------------------
  // Per-frame
  // ------------------------------------------------------------------

  update(dt: number, realDt: number, t: number, audio: { riftClose(p: THREE.Vector3): void; hum(p: THREE.Vector3): any }) {
    this.charges = Math.min(FEEL.riftCharges, this.charges + dt / FEEL.riftRechargeTime);
    if (!this.aiming) this.focus = Math.min(FEEL.focusDuration, this.focus + realDt * FEEL.focusRegen);

    let li = 0;
    for (const pair of [...this.pairs]) {
      pair.life += dt;
      if (pair.closeTimer > 0) {
        pair.closeTimer -= dt;
        if (pair.closeTimer <= 0) this.closePair(pair);
      }
      for (const p of pair.portals) {
        const speed = p.target > 0 ? 1 / FEEL.portalOpenTime : 1 / FEEL.portalCloseTime;
        const prev = p.open;
        p.open = THREE.MathUtils.clamp(p.open + Math.sign(p.target - p.open) * speed * dt, 0, 1);
        if (prev === 0 && p.open > 0 && !p.hum) p.hum = audio.hum(p.position);
        if (p.target === 0 && prev > 0 && p.open === 0) {
          audio.riftClose(p.position);
          p.hum?.stop();
          p.hum = null;
        }
        const eased = p.target > 0 ? easeOutBack(p.open) : p.open;
        p.mat.uniforms.uOpen.value = eased;
        p.mat.uniforms.uTime.value = t;
        p.mat.uniforms.uPulse.value = Math.max(0, p.mat.uniforms.uPulse.value - dt * 2);
        (p.sparks.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
        (p.sparks.material as THREE.ShaderMaterial).uniforms.uOpen.value = eased;
        if (li < this.lightPool.length) {
          const L = this.lightPool[li++];
          L.position.copy(p.position).addScaledVector(p.normal, 0.5);
          L.color.copy(p.mat.uniforms.uColor.value);
          L.intensity = 3.2 * p.open * (1 + p.mat.uniforms.uPulse.value);
        }
      }
      if (pair.a.open === 0 && pair.b.open === 0 && pair.a.target === 0) {
        for (const p of pair.portals) {
          p.mesh.removeFromParent();
          p.hum?.stop();
          p.hum = null;
        }
        this.pairs.splice(this.pairs.indexOf(pair), 1);
      }
    }
    for (; li < this.lightPool.length; li++) this.lightPool[li].intensity = 0;

    this.anchorMarker.visible = !!this.anchor;
    if (this.anchor) {
      this.anchorMarker.position.copy(this.anchor.exitFeet);
      this.anchorMarker.rotation.y = t * 0.8;
    }
    this.beamMat.uniforms.uTime.value = t;
    this.ghostMat.uniforms.uTime.value = t;
  }

  /** Show / hide the placement hologram. */
  updatePreview(pl: Placement | null, handPos: THREE.Vector3, cam: THREE.Camera) {
    const show = !!pl;
    this.ghost.visible = show;
    this.ghostRing.visible = show;
    this.ghostArrow.visible = show;
    this.beam.visible = show;
    if (this.ghostFigure) this.ghostFigure.visible = show && pl!.invalid === null;
    if (!pl) return;
    const col = pl.invalid ? new THREE.Color(1, 0.18, 0.12) : pl.exposure > 0.66 ? new THREE.Color(1, 0.25, 0.15) : pl.exposure > 0.25 ? new THREE.Color(1, 0.8, 0.15) : new THREE.Color(0.15, 1, 0.85);
    this.ghostMat.uniforms.uColor.value.copy(col);
    (this.ghostRing.material as THREE.MeshBasicMaterial).color.copy(col).multiplyScalar(2);
    this.beamMat.uniforms.uColor.value.copy(col);
    this.ghost.position.copy(pl.frame.position);
    this.ghost.quaternion.copy(pl.frame.quaternion);
    this.ghostRing.position.copy(pl.exitFeet).add(new THREE.Vector3(0, 0.04, 0));
    this.ghostArrow.position.copy(pl.exitFeet).add(new THREE.Vector3(0, 0.05, 0));
    this.ghostArrow.rotation.y = pl.exitYaw;
    if (this.ghostFigure) {
      this.ghostFigure.position.copy(pl.exitFeet);
      this.ghostFigure.rotation.y = pl.exitYaw;
    }
    // beam from the gauntlet to the rift
    const to = pl.frame.position;
    const mid = handPos.clone().lerp(to, 0.5);
    const len = handPos.distanceTo(to);
    this.beam.position.copy(mid);
    this.beam.scale.set(1, len, 1);
    const dir = to.clone().sub(handPos).normalize();
    // billboard around the beam axis
    const camPos = cam.getWorldPosition(new THREE.Vector3());
    const toCam = camPos.sub(mid).normalize();
    const xAxis = new THREE.Vector3().crossVectors(dir, toCam).normalize();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, dir).normalize();
    this.beam.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, dir, zAxis));
    this.beamMat.uniforms.uLen.value = len;
  }

  // ------------------------------------------------------------------
  // Rendering the windows
  // ------------------------------------------------------------------

  renderViews(camera: THREE.PerspectiveCamera, screenW: number, screenH: number, hideForViews: THREE.Object3D[]) {
    const r = this.renderer;
    const camPos = camera.getWorldPosition(_v);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const all = this.openPortals();
    const drawable = all.filter((p) => p.open > 0.01 && p.linked.open > 0.01);
    const toRender = drawable.filter((p) => {
      const front = _v2.subVectors(camPos, p.position).dot(p.normal) > 0;
      p.mesh.updateMatrixWorld();
      return front && frustum.intersectsObject(p.mesh) && camPos.distanceTo(p.position) < 70;
    });
    for (const p of all) p.mat.uniforms.uHasView.value = 0;
    if (!toRender.length) return;
    // closest first, at most 2 per frame
    toRender.sort((a, b) => a.position.distanceToSquared(camPos) - b.position.distanceToSquared(camPos));
    const dpr = r.getPixelRatio();
    const w = Math.max(64, Math.floor(screenW * dpr * this.portalScale)), h = Math.max(64, Math.floor(screenH * dpr * this.portalScale));
    const prevTarget = r.getRenderTarget();
    const prevClip = r.clippingPlanes;
    const prevVis = hideForViews.map((o) => o.visible);
    for (const o of hideForViews) o.visible = false;
    const meshVis = all.map((p) => p.mesh.visible);
    for (const p of all) p.mesh.visible = false;

    for (const p of toRender.slice(0, 2)) {
      if (!p.rt || p.rt.width !== w || p.rt.height !== h) {
        p.rt?.dispose();
        p.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
      }
      const q = p.linked;
      // virtual camera = real camera carried through the rift
      this.vcam.copy(camera);
      passPoint(p, q, camPos, this.vcam.position);
      const rot = passRotation(p, q);
      this.vcam.quaternion.copy(rot).multiply(camera.getWorldQuaternion(new THREE.Quaternion()));
      this.vcam.updateMatrixWorld(true);
      // clip everything behind the exit rift
      this.clipPlane.setFromNormalAndCoplanarPoint(q.normal, q.position);
      this.clipPlane.constant -= 0.01;
      r.clippingPlanes = [this.clipPlane];
      // show other rifts (not this pair) inside the view
      for (const o of all) o.mesh.visible = o !== p && o !== q && o.linked !== p;
      r.setRenderTarget(p.rt);
      r.clear();
      r.render(this.scene, this.vcam);
      p.mat.uniforms.tView.value = p.rt.texture;
      p.mat.uniforms.uHasView.value = 1;
      for (const o of all) o.mesh.visible = false;
    }
    r.clippingPlanes = prevClip;
    r.setRenderTarget(prevTarget);
    hideForViews.forEach((o, i) => (o.visible = prevVis[i]));
    all.forEach((p, i) => (p.mesh.visible = meshVis[i]));
    const pr = r.getPixelRatio();
    for (const p of all) p.mat.uniforms.uScreen.value.set(screenW * pr, screenH * pr);
  }

  reset() {
    for (const p of [...this.pairs]) {
      for (const q of p.portals) {
        q.mesh.removeFromParent();
        q.hum?.stop();
        q.hum = null;
      }
    }
    this.pairs = [];
    this.anchor = null;
    this.charges = FEEL.riftCharges;
    this.focus = FEEL.focusDuration;
    this.aiming = false;
    this.distanceOverride = null;
    this.rotation = 0;
  }
}

function easeOutBack(x: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
