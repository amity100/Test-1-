import * as THREE from 'three';
import { clamp, damp, smoothstep } from '../core/noise';

export interface ShotFrame { pos: THREE.Vector3; look: THREE.Vector3; fov?: number; roll?: number }
/** vertical field of view (deg) of the follow camera (not aiming) */
export const FOLLOW_FOV = 52;
/**
 * Phones held upright: the follow camera looks down this much more (rad), so David stands in the middle of the screen
 * with his legs and feet above the touch controls (the action buttons and the joystick fill the bottom third of a
 * portrait screen; with the landscape framing his legs were under them and in the grass: "their legs disappear").
 * Full at aspect <= 0.62, none from 1.0 (landscape); faded out while aiming.
 */
const PORTRAIT_TILT = THREE.MathUtils.degToRad(11);
export type Shot = { duration: number; at: (t: number, time: number) => ShotFrame; ease?: boolean };

/** Third-person orbit camera with terrain collision, aim mode, shake, and scripted cinematic shots. */
export class CameraRig {
  yaw = Math.PI; // camera sits behind a character facing +Z when yaw = PI
  pitch = 0.12;
  dist = 3.6;
  private curDist = 3.6;
  aim = 0; // 0..1 blends to over-the-shoulder aim
  private aimW = 0;
  private shake = 0;
  private shakeT = 0;
  readonly target = new THREE.Vector3();
  private smoothTarget = new THREE.Vector3();
  private shots: Shot[] = [];
  private shotT = 0;
  private shotTotal = 0;
  onShotsDone?: () => void;
  mode: 'follow' | 'cinematic' = 'follow';
  private blendFromCine = 0;
  private lastCine: ShotFrame | null = null;
  fov = 50;
  sensitivity = 0.0024;
  private initialized = false;
  /**
   * (play1, gameplay v2 §3) the aim camera: over the right shoulder, eased in over the sling's draw (≈0.6 s, so the
   * draw never feels like lag); its field of view narrows with the distance of what the reticle is on (aimFov, set by
   * the Player: ≈38° at 12 m .. 26° at 35 m) so a jar at 30 m is still a target on a phone.
   */
  aimFov = 36;
  private aimFovCur = 36;
  /** multiplier on the look sensitivity (the Player: slower while zoomed in, touch aim friction over a target) */
  lookScale = 1;
  /** 0..1: closer and lower behind him (he kneels in the stream bed to choose a stone) */
  close = 0;
  private closeW = 0;

  /** optional solid-obstacle test for the follow camera's boom (boulders: Colliders.solidAt) */
  solid: ((x: number, y: number, z: number) => boolean) | null = null;

  constructor(private camera: THREE.PerspectiveCamera, private ground: (x: number, z: number) => number) {}

  addShake(amount: number) {
    this.shake = Math.max(this.shake, amount);
  }

  playShots(shots: Shot[], onDone?: () => void) {
    this.shots = shots;
    this.shotT = 0;
    this.shotTotal = shots.reduce((a, s) => a + s.duration, 0);
    this.mode = 'cinematic';
    this.onShotsDone = onDone;
  }

  get inCinematic() {
    return this.mode === 'cinematic';
  }
  /** (play1) 0..1: how far the aim camera has eased in */
  get aimWeight() {
    return this.aimW;
  }

  /** Abort any cinematic immediately and return to the follow camera (no completion callback). */
  stop() {
    this.shots = [];
    this.onShotsDone = undefined;
    this.mode = 'follow';
    this.blendFromCine = 0;
    this.initialized = false;
  }

  skipShots() {
    if (this.mode !== 'cinematic') return;
    this.shotT = this.shotTotal;
  }

  /** Place the follow camera behind a heading immediately (the boom at its full length, or the collision limit). */
  snapBehind(heading: number, pitch = 0.12) {
    this.yaw = heading + Math.PI;
    this.pitch = pitch;
    this.initialized = false;
    // (cut6) deterministic first frame: the boom starts at its wanted length, so the first follow frame after a snap is
    // exactly followFrame() (the opening film's last shot lands on it without a cut)
    this.curDist = this.dist;
  }

  /**
   * The frame the follow camera shows on its first frame after snapBehind(heading, pitch) with `target` (the pivot:
   * the player's position + 1.55 m) — same boom, terrain / boulder collision and look point as update(). Pure: no
   * state changes. The opening film's last shot (D3 'horizon', src/film/FilmWorld.ts) glides into exactly this frame,
   * and the game takes over without a cut.
   */
  followFrame(target: THREE.Vector3, heading: number, pitch: number, out: ShotFrame): ShotFrame {
    const yaw = heading + Math.PI;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const dir = tmpA.set(Math.sin(yaw) * cp, sp, Math.cos(yaw) * cp);
    const pivot = tmpC.copy(target);
    const solid = this.solid !== null && !this.solid(pivot.x, pivot.y, pivot.z) ? this.solid : null;
    const want = this.dist;
    let d = want;
    for (let i = 1; i <= 8; i++) {
      const s = (i / 8) * want;
      const px = pivot.x + dir.x * s, pz = pivot.z + dir.z * s, py = pivot.y + dir.y * s;
      if (py < this.ground(px, pz) + 0.35 || (solid !== null && solid(px, py, pz))) {
        d = Math.max(0.6, s - 0.3);
        break;
      }
    }
    out.pos.copy(pivot).addScaledVector(dir, d);
    out.pos.y = Math.max(out.pos.y, this.ground(out.pos.x, out.pos.z) + 0.35);
    out.look.copy(pivot).addScaledVector(dir, -4);
    this.portraitTilt(out.pos, out.look, 0);
    out.fov = FOLLOW_FOV;
    out.roll = 0;
    return out;
  }

  /** Tilt the follow camera's look point down on portrait screens (see PORTRAIT_TILT); `aimW` fades it out. */
  private portraitTilt(pos: THREE.Vector3, look: THREE.Vector3, aimW: number) {
    const k = (1 - smoothstep(0.62, 1.0, this.camera.aspect)) * (1 - aimW);
    if (k <= 0.001) return;
    const vx = look.x - pos.x, vz = look.z - pos.z;
    const h = Math.hypot(vx, vz);
    if (h < 1e-4) return;
    const th = Math.atan2(look.y - pos.y, h) - PORTRAIT_TILT * k;
    look.y = pos.y + h * Math.tan(Math.max(-1.3, th));
  }

  applyLook(dx: number, dy: number) {
    // (play1) finer while aiming through the narrower lens
    const s = this.sensitivity * this.lookScale * THREE.MathUtils.lerp(1, this.aimFovCur / FOLLOW_FOV, this.aimW);
    this.yaw -= dx * s;
    this.pitch = clamp(this.pitch + dy * s, -0.55, 0.9);
  }

  update(dt: number, time: number) {
    const cam = this.camera;
    if (this.mode === 'cinematic') {
      this.shotT += dt;
      let t = this.shotT;
      let frame: ShotFrame | null = null;
      for (const s of this.shots) {
        if (t <= s.duration) {
          let u = t / s.duration;
          if (s.ease !== false) u = u * u * (3 - 2 * u);
          frame = s.at(u, t);
          break;
        }
        t -= s.duration;
      }
      if (!frame) {
        const done = this.onShotsDone;
        this.mode = 'follow';
        this.blendFromCine = 1;
        this.onShotsDone = undefined;
        done?.();
        if ((this.mode as string) === 'cinematic') return; // a new sequence started
      } else {
        this.lastCine = { pos: frame.pos.clone(), look: frame.look.clone(), fov: frame.fov ?? 50 };
        cam.position.copy(frame.pos);
        cam.up.set(0, 1, 0);
        cam.lookAt(frame.look);
        if (frame.roll) cam.rotateZ(frame.roll);
        this.fov = frame.fov ?? 50;
        this.applyShake(dt, time);
        return;
      }
    }
    // ---------- follow
    // (play1) the aim eases in over the draw (rate 6: ~95 % in 0.5 s) and out a little faster
    this.aimW = damp(this.aimW, this.aim, this.aim > this.aimW ? 6 : 8, dt);
    this.aimFovCur = damp(this.aimFovCur, this.aimFov, 3, dt);
    this.closeW = damp(this.closeW, this.close, 2.6, dt);
    if (!this.initialized) {
      this.smoothTarget.copy(this.target);
      this.initialized = true;
    }
    this.smoothTarget.x = damp(this.smoothTarget.x, this.target.x, 14, dt);
    this.smoothTarget.z = damp(this.smoothTarget.z, this.target.z, 14, dt);
    this.smoothTarget.y = damp(this.smoothTarget.y, this.target.y, 8, dt);
    // (play1) the aim lens: over his right shoulder, 1.9 m back, aimFov vertical. Phones held upright (aspect < 0.85):
    // that lens was ≈15° across and his raised sling arm filled half the screen, so there it goes over his LEFT
    // shoulder, 2.4 m back, with a horizontal field of 0.8 × aimFov — his head at ≈80 % of the width, the sling arm
    // and the whirl at the right edge, the reticle's middle clear
    const portrait = cam.aspect < 0.85;
    const aimBoom = portrait ? 2.4 : 1.9;
    let aimLat = 0.62, aimV = this.aimFovCur;
    if (portrait) {
      const th = Math.tan(THREE.MathUtils.degToRad(0.4 * this.aimFovCur));
      aimV = THREE.MathUtils.radToDeg(2 * Math.atan(th / cam.aspect));
      aimLat = -0.6 * aimBoom * th;
    }
    const want = THREE.MathUtils.lerp(THREE.MathUtils.lerp(this.dist, 2.25, this.closeW), aimBoom, this.aimW);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = tmpA.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    const right = tmpB.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const pivot = tmpC.copy(this.smoothTarget).addScaledVector(right, -aimLat * this.aimW);
    pivot.y += 0.08 * this.aimW - 0.55 * this.closeW * (1 - this.aimW);
    // terrain (and boulder) collision along the boom; boulders are ignored while the pivot itself is inside one's
    // margin (David pressed against a rock), so the camera never jams onto his head
    const solid = this.solid !== null && !this.solid(pivot.x, pivot.y, pivot.z) ? this.solid : null;
    let d = want;
    for (let i = 1; i <= 8; i++) {
      const s = (i / 8) * want;
      const px = pivot.x + dir.x * s, pz = pivot.z + dir.z * s, py = pivot.y + dir.y * s;
      if (py < this.ground(px, pz) + 0.35 || (solid !== null && solid(px, py, pz))) {
        d = Math.max(0.6, s - 0.3);
        break;
      }
    }
    this.curDist = d < this.curDist ? d : damp(this.curDist, d, 4, dt);
    const pos = tmpD.copy(pivot).addScaledVector(dir, this.curDist);
    pos.y = Math.max(pos.y, this.ground(pos.x, pos.z) + 0.35);
    const look = tmpE.copy(pivot).addScaledVector(dir, -4);
    this.portraitTilt(pos, look, this.aimW);
    if (this.blendFromCine > 0 && this.lastCine) {
      this.blendFromCine = Math.max(0, this.blendFromCine - dt / 1.2);
      const b = this.blendFromCine * this.blendFromCine * (3 - 2 * this.blendFromCine);
      pos.lerp(this.lastCine.pos, b);
      look.lerp(this.lastCine.look, b);
    }
    cam.position.copy(pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(look);
    this.fov = THREE.MathUtils.lerp(FOLLOW_FOV - 6 * this.closeW, aimV, this.aimW);
    this.applyShake(dt, time);
  }

  private applyShake(dt: number, time: number) {
    if (this.shake > 0.001) {
      this.shakeT += dt;
      const s = this.shake;
      this.camera.rotateX((Math.sin(time * 37) + Math.sin(time * 23)) * 0.006 * s);
      this.camera.rotateY((Math.sin(time * 29 + 1) + Math.sin(time * 41)) * 0.006 * s);
      this.camera.position.y += Math.sin(time * 31) * 0.02 * s;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }
  }

  /** Horizontal forward direction of the camera (for movement). */
  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const tmpD = new THREE.Vector3();
const tmpE = new THREE.Vector3();

// ------------------------------------------------------------------------------------ shot helpers
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Linear dolly between two poses. */
export function dolly(duration: number, fromPos: THREE.Vector3, toPos: THREE.Vector3, fromLook: THREE.Vector3, toLook: THREE.Vector3, fov = 45, fovTo = fov): Shot {
  return {
    duration,
    at: (u) => ({ pos: fromPos.clone().lerp(toPos, u), look: fromLook.clone().lerp(toLook, u), fov: THREE.MathUtils.lerp(fov, fovTo, u) }),
  };
}

/** Orbit around a (possibly moving) subject. */
export function orbit(duration: number, subject: () => THREE.Vector3, radius0: number, radius1: number, ang0: number, ang1: number, h0: number, h1: number, lookH: number, fov = 40): Shot {
  return {
    duration,
    at: (u) => {
      const c = subject();
      const r = THREE.MathUtils.lerp(radius0, radius1, u);
      const a = THREE.MathUtils.lerp(ang0, ang1, u);
      const h = THREE.MathUtils.lerp(h0, h1, u);
      return { pos: new THREE.Vector3(c.x + Math.sin(a) * r, c.y + h, c.z + Math.cos(a) * r), look: new THREE.Vector3(c.x, c.y + lookH, c.z), fov };
    },
  };
}
