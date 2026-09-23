import * as THREE from 'three';
import { FEEL } from '../config';
import { CollisionWorld, Collider } from '../world/collision';
import { createPortalMaterial, createSparks, PORTAL_MESH_SCALE } from '../render/portalMaterial';
import { crossing, frameNormal, orientFrame, passDirection, passPoint, passRotation, RiftFrame, toLocal, yawOf } from './portalMath';

export const RIFT_COLOR = new THREE.Color(1.0, 0.55, 0.12);
export const ANCHOR_COLOR = new THREE.Color(0.1, 0.85, 1.0);

export type PlacementKind = 'stand' | 'wall' | 'ceiling';
export type SnapKind = 'behind' | 'above' | 'perch' | null;
export type KillMove = 'strike' | 'drop';
export type LockBlock = 'armoured' | 'sees' | 'far' | 'room' | null;
export type Invalid = 'range' | 'close' | 'los' | 'space' | 'inhibited' | 'charge' | 'drop' | null;

export interface SnapTarget {
  id: string;
  pos: THREE.Vector3;
  forward: THREE.Vector3;
  aware: boolean;
  /** Armoured: no strike from behind, only a drop from above. */
  heavy: boolean;
  /** Can be struck right now (unaware, startled, or lost sight of you). */
  strikeable: boolean;
  startled: boolean;
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
  /** A kill move is armed: OPEN performs it on `targetId`. */
  move: KillMove | null;
  targetId: string | null;
  /** A guard is locked but no kill move works; why. */
  block: LockBlock;
  /** Both strike and drop are possible (Q/E swaps). */
  canSwap: boolean;
}

export interface RiftContext {
  world: CollisionWorld;
  snapTargets(): SnapTarget[];
  /** How many other guards would see a kill on this guard. */
  witnessesOf(id: string): number;
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
  pairKind: PairKind = 'rift';

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

export type PairKind = 'rift' | 'anchor' | 'strike';

export class RiftPair {
  closeTimer = -1;
  life = 0;
  /** Guard this pair was aimed at (strike/drop target, or the snapped guard). */
  targetId: string | null = null;
  move: KillMove | null = null;
  constructor(public a: Portal, public b: Portal, public kind: PairKind) {
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
const _v3 = new THREE.Vector3();

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
  maxViews = 2;
  /** Q/E: when both STRIKE and DROP work, prefer DROP. */
  preferDrop = false;

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
   * Finds the walkable top of whatever was hit (climbing stacked boxes, e.g.
   * containers or a roof resting on a wall) and a clear spot on it near the
   * aimed point.
   */
  private perchOn(c: Collider, point: THREE.Vector3, normal: THREE.Vector3, facing: THREE.Vector3) {
    const w = this.ctx.world;
    const ix = point.x - normal.x * 0.3, iz = point.z - normal.z * 0.3;
    let top = c;
    for (let i = 0; i < 8; i++) {
      const above = w.colliders.find(
        (o) => o.enabled && o !== top && !o.seeThrough && Math.abs(o.min.y - top.max.y) < 0.15 && ix >= o.min.x - 0.1 && ix <= o.max.x + 0.1 && iz >= o.min.z - 0.1 && iz <= o.max.z + 0.1,
      );
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
    // try near the aimed spot first, then walk toward the middle of the surface
    for (const k of [0, 0.35, 0.7, 1]) {
      const x = THREE.MathUtils.lerp(px, cx, k), z = THREE.MathUtils.lerp(pz, cz, k);
      for (const f of [facing, facing.clone().negate(), new THREE.Vector3(facing.z, 0, -facing.x), new THREE.Vector3(-facing.z, 0, facing.x)]) {
        // keep the exit spot on the surface
        const ex = x + f.x * 0.55, ez = z + f.z * 0.55;
        if (ex < top.min.x + 0.3 || ex > top.max.x - 0.3 || ez < top.min.z + 0.3 || ez > top.max.z - 0.3) continue;
        const base = new THREE.Vector3(x - f.x * 0.25, y, z - f.z * 0.25);
        if (!this.standingClear(base, f)) continue;
        return { frame: this.standingFrame(base.x, y, base.z, f), exitFeet: new THREE.Vector3(base.x + f.x * 0.55, y, base.z + f.z * 0.55) };
      }
    }
    return null;
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
    // what the eye must see: normally the rift itself; for a perch, the face you aimed at
    let losTarget: THREE.Vector3 | null = null;
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
        const gy0 = w.groundAt(point.x + n.x * 0.9, point.z + n.z * 0.9, 0.2, point.y + 0.5);
        const gy = gy0 > -50 ? gy0 : point.y; // over water: stays in the air and fails as "no safe landing"
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

    // ---- perch: aiming high on a wall, or under something, lands you ON TOP of it ----
    if (surfaceHit && !surfaceHit.collider.noPortal && surfaceHit.normal.y < 0.7) {
      const hn = surfaceHit.normal;
      const high =
        hn.y < -0.7
          ? exitFeet.y - w.groundAt(exitFeet.x, exitFeet.z, 0.2, exitFeet.y + 0.3) > 2.6 // a ceiling too high to drop from
          : surfaceHit.point.y - w.groundAt(surfaceHit.point.x + hn.x * 0.6, surfaceHit.point.z + hn.z * 0.6, 0.2, surfaceHit.point.y - 0.05) > 2.6; // high on a wall
      if (high) {
        const perch = this.perchOn(surfaceHit.collider, surfaceHit.point, surfaceHit.normal, standNormal);
        if (perch) {
          frame = perch.frame;
          exitFeet.copy(perch.exitFeet);
          exitYaw = aimYaw + rot;
          kind = 'stand';
          host = null;
          snap = 'perch';
          losTarget = surfaceHit.point.clone().addScaledVector(surfaceHit.normal, 0.1);
        }
      }
    }

    // ---- lock onto a guard: STRIKE (from behind) or DROP (from the sky) ----
    let move: KillMove | null = null;
    let targetId: string | null = null;
    let block: LockBlock = null;
    let canSwap = false;
    let leanEye: THREE.Vector3 | null = null;
    if (!freeAim) {
      const radius = touch ? FEEL.snapRadiusTouch : FEEL.snapRadius;
      // you lean over a ledge to look down at a mark
      const lean = playerEye.clone().add(_v3.set(dir.x, 0, dir.z).setLength(0.8));
      if (!w.lineOfSight(playerEye, lean)) lean.copy(playerEye);
      leanEye = lean;
      let best: SnapTarget | null = null;
      let bestD = radius;
      for (const g of this.ctx.snapTargets()) {
        // distance from the aim ray or from the solved point, whichever is closer
        const dPoint = Math.hypot(g.pos.x - point.x, g.pos.z - point.z);
        _v.subVectors(g.pos, camPos).setY(g.pos.y + 1 - camPos.y);
        const proj = _v.dot(dir);
        let dRay = proj > 0 ? _v.clone().sub(dir.clone().multiplyScalar(proj)).length() : Infinity;
        // aiming at the air above him (where a DROP opens) locks him too
        _v3.set(g.pos.x, g.pos.y + 4.5, g.pos.z).sub(camPos);
        const projUp = _v3.dot(dir);
        if (projUp > 0) dRay = Math.min(dRay, _v3.sub(dir.clone().multiplyScalar(projUp)).length());
        // a startled witness is the natural next link in a chain
        const d = Math.min(dPoint, dRay * 1.4) * (g.startled ? 0.5 : 1);
        // only guards you can actually see — never through walls
        if (d < bestD && this.canSeeGuard(playerEye, lean, g.pos)) {
          bestD = d;
          best = g;
        }
      }
      if (best) {
        const g = best;
        targetId = g.id;
        const f = new THREE.Vector3(g.forward.x, 0, g.forward.z).normalize();
        // STRIKE: a rift right behind him, facing his back
        let strike: { frame: { position: THREE.Vector3; quaternion: THREE.Quaternion }; exit: THREE.Vector3 } | null = null;
        if (!g.heavy && g.strikeable) {
          for (const back of [1.55, 1.3, 1.9]) {
            const bx = g.pos.x - f.x * back, bz = g.pos.z - f.z * back;
            const gy = w.groundAt(bx, bz, 0.25, g.pos.y + 0.6);
            if (!(gy > g.pos.y - 0.6)) continue;
            const base = new THREE.Vector3(bx, gy, bz);
            if (!this.standingClear(base, f)) continue;
            strike = { frame: this.standingFrame(bx, gy, bz, f), exit: new THREE.Vector3(bx + f.x * 0.55, gy, bz + f.z * 0.55) };
            break;
          }
        }
        // DROP: a rift hanging in the air above his head, you fall on him
        let drop: { frame: { position: THREE.Vector3; quaternion: THREE.Quaternion }; exit: THREE.Vector3 } | null = null;
        if (g.strikeable || g.heavy) {
          const ceil = w.ceilingAt(g.pos.x, g.pos.z, 0.7, g.pos.y + 2.0);
          const cy = Math.min(g.pos.y + FEEL.dropMaxAbove, ceil - 1.3);
          if (cy >= g.pos.y + FEEL.dropMinAbove) {
            const c = new THREE.Vector3(g.pos.x, cy, g.pos.z);
            if (w.lineOfSight(playerEye, c.clone().add(new THREE.Vector3(0, -0.4, 0)))) {
              drop = { frame: { position: c, quaternion: orientFrame(new THREE.Vector3(0, -1, 0), f) }, exit: new THREE.Vector3(g.pos.x, cy - 1.95, g.pos.z) };
            }
          }
        }
        const reach = Math.hypot(g.pos.x - playerFeet.x, g.pos.z - playerFeet.z) <= FEEL.strikeReach + 0.5 && Math.abs(g.pos.y - playerFeet.y) <= 18;
        if (!reach) block = 'far';
        else if (!g.strikeable) block = 'sees';
        else if (strike && drop) {
          canSwap = true;
          move = this.preferDrop ? 'drop' : 'strike';
        } else if (strike) move = 'strike';
        else if (drop) move = 'drop';
        else block = g.heavy ? 'armoured' : 'room';
        const chosen = move === 'strike' ? strike : move === 'drop' ? drop : null;
        if (chosen) {
          frame = chosen.frame;
          exitFeet.copy(chosen.exit);
          exitYaw = yawOf(f);
          kind = move === 'drop' ? 'ceiling' : 'stand';
          host = null;
          snap = move === 'drop' ? 'above' : 'behind';
          snapId = g.id;
          losTarget = null;
        }
      }
    }

    // ---- validation ----
    let invalid: Invalid = null;
    const center = frame.position;
    const dist = center.distanceTo(playerEye);
    if (this.ctx.inhibited(center) || this.ctx.inhibited(playerFeet)) invalid = 'inhibited';
    else if (dist > FEEL.riftRange + 0.5) invalid = 'range';
    else if (dist < FEEL.riftMinDistance && !move) invalid = 'close';
    else {
      // line of sight from the eye to the rift centre (a hair in front of it)
      const n = frameNormal(frame as any, new THREE.Vector3());
      const target = losTarget ?? center.clone().addScaledVector(n, 0.15);
      const exitGround = w.groundAt(exitFeet.x, exitFeet.z, 0.2, exitFeet.y + 0.3);
      if (!w.lineOfSight(playerEye, target, host) && !(move && leanEye && w.lineOfSight(leanEye, target, host))) invalid = 'los';
      else if (exitFeet.y - exitGround > 4.6 && move !== 'drop') invalid = 'drop';
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
      move: invalid ? null : move,
      targetId,
      block,
      canSwap,
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
    // in front first; at a ledge or wall, beside or behind you
    for (const off of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const fy = new THREE.Vector3(Math.sin(yaw + off), 0, Math.cos(yaw + off));
      for (const d of [FEEL.nearPortalDistance, 1.1]) {
        const base = new THREE.Vector3(playerFeet.x + fy.x * d, playerFeet.y, playerFeet.z + fy.z * d);
        const g = w.groundAt(base.x, base.z, 0.2, playerFeet.y + 0.5);
        if (!(g > playerFeet.y - 0.5)) continue;
        base.y = g;
        const n = fy.clone().negate();
        if (!this.standingClear(base, n)) continue;
        if (!w.lineOfSight(chest, base.clone().setY(g + 1.1))) continue;
        const fr = this.standingFrame(base.x, g, base.z, n);
        return { frame: { ...fr, width: FEEL.portalWidth, height: FEEL.portalHeight }, kind: 'stand', host: null };
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Opening / closing
  // ------------------------------------------------------------------

  openPair(near: { frame: RiftFrame; kind: PlacementKind; host: Collider | null }, far: { frame: RiftFrame; kind: PlacementKind; host: Collider | null }, kind: PairKind) {
    // travel rifts stay open until closed (max 3); strike rifts snap shut after use
    if (kind !== 'strike') {
      const live = this.pairs.filter((p) => p.kind === kind && !p.closing);
      const max = kind === 'anchor' ? 1 : 3;
      while (live.length >= max) this.closePair(live.shift()!);
    }
    const color = kind === 'anchor' ? ANCHOR_COLOR : RIFT_COLOR;
    const a = this.makePortal(color);
    const b = this.makePortal(color);
    a.setFrame(near.frame, near.kind, near.host);
    b.setFrame(far.frame, far.kind, far.host);
    const pair = new RiftPair(a, b, kind);
    a.pairKind = b.pairKind = kind;
    if (kind === 'strike') {
      // a blade, not a doorway: open instantly
      a.open = b.open = 1;
    }
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
  private canSeeGuard(eye: THREE.Vector3, lean: THREE.Vector3, pos: THREE.Vector3) {
    const w = this.ctx.world;
    for (const from of [eye, lean]) for (const h of [1.3, 1.75]) if (w.lineOfSight(from, _v2.set(pos.x, pos.y + h, pos.z))) return true;
    return false;
  }

  /** During a strike dash only the strike pair can be crossed. */
  strikeOnly = false;

  findCrossing(prev: THREE.Vector3, cur: THREE.Vector3, margin = 0): Portal | null {
    for (const pair of this.pairs) {
      if (this.strikeOnly && pair.kind !== 'strike') continue;
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

  pairOf(p: Portal) {
    return this.pairs.find((q) => q.a === p || q.b === p) ?? null;
  }

  markPassed(p: Portal, _who: 'player' | 'body') {
    const pair = this.pairOf(p);
    if (!pair) return;
    for (const q of pair.portals) q.mat.uniforms.uPulse.value = 1;
    if (pair.kind === 'strike' && pair.closeTimer < 0) pair.closeTimer = 0.35;
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
    const drawable = all.filter((p) => p.open > 0.01 && p.linked.open > 0.01 && p.pairKind !== 'strike');
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

    for (const p of toRender.slice(0, this.maxViews)) {
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
