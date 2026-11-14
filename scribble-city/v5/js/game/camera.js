import * as THREE from 'three';
import { clamp, damp } from '../core/util.js';

const _w = new THREE.Vector3();
const _r0 = {};
const _r1 = {};
const _r2 = {};

/**
 * Over-the-shoulder third person camera with wall collision.
 * yaw: direction the camera looks (forward = (sin yaw, 0, cos yaw)), pitch: up positive.
 */
export class CameraRig {
  constructor(camera, collision) {
    this.camera = camera;
    this.collision = collision;
    this.yaw = 0;
    this.pitch = -0.12;
    this.dist = 4.4;
    this.curDist = 4.4;
    // (how far it is lifted over something low behind you: ROADMAP 16.1)
    this.curLift = 0;
    this.shoulder = 0.75;
    this.height = 1.62;
    this.fov = camera.fov;
    this.baseFov = camera.fov;
    this.shake = 0;
    this.pivot = new THREE.Vector3();
    this.fwd = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.minPitch = -1.05;
    this.maxPitch = 0.85;
    // (zoomed in through a drawn sight: the look slower, as much as it zooms - ROADMAP 11.11)
    this.lookK = 1;
  }

  applyLook(dx, dy) {
    this.yaw -= dx * 0.0026 * this.lookK;
    this.pitch = clamp(this.pitch - dy * 0.0022 * this.lookK, this.minPitch, this.maxPitch);
  }

  /**
   * target: feet position of the followed object. opts: { dist, height, shoulder, aim }
   */
  update(dt, target, opts = {}) {
    // (a test's view from further off: its script sets camRig.over = { dist, height }; and what it
    // looks at instead of you - game/facelab.js: somebody's face, close)
    if (this.focus) target = this.focus;
    const ov = this.over;
    const dist = ov ? ov.dist : (opts.dist || this.dist) * (opts.aim ? 0.62 : 1);
    const height = ov ? ov.height : opts.height || this.height;
    const shoulder = opts.shoulder !== undefined ? opts.shoulder : this.shoulder;
    const cp = Math.cos(this.pitch);
    this.fwd.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    this.right.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    // (ROADMAP 16.1) the shoulder it looks over kept clear: from your head out to the side, no
    // further than what is there - a rail of clothes, a shelf, a wall beside you. Out of room on the
    // right, over the left one if there is more room there. (The point it turns round was put inside
    // a rail of clothes, and the camera with it: the shirts a few centimetres from it, huge.)
    let sh = shoulder;
    if (!ov && Math.abs(shoulder) > 0.05) {
      const hy = target.y + height;
      const s = Math.sign(shoulder);
      const room = (k) => {
        const h = this.collision.raycast(target.x, hy, target.z, this.right.x * k, 0, this.right.z * k, Math.abs(shoulder) + 0.3);
        return h ? Math.max(0, h.t - 0.3) : Math.abs(shoulder);
      };
      const here = room(s);
      sh = s * here;
      if (here < Math.abs(shoulder) * 0.5) {
        const there = room(-s);
        if (there > here + 0.1) sh = -s * there;
      }
    }
    const cur = this.curShoulder === undefined ? sh : this.curShoulder;
    // (closer to your head on the same side: at once - further out would be inside something;
    // anything else eased over)
    if (Math.abs(sh) < Math.abs(cur) && (sh === 0 || Math.sign(sh) === Math.sign(cur))) this.curShoulder = sh;
    else this.curShoulder = damp(cur, sh, 5, dt);
    this.pivot.set(target.x, target.y + height, target.z).addScaledVector(this.right, this.curShoulder);
    const cam = this.camera;
    if (ov) {
      this.curDist = dist;
      cam.position.copy(this.pivot).addScaledVector(this.fwd, -dist);
    } else {
      // (ROADMAP 16.1) where it wants to be: over the shoulder, the boom's length back (under a
      // ceiling, not up through it). What is in the way is looked for from your head - there is
      // always room there, you are standing in it - to that place, and the camera comes in along
      // that line: the shoulder and the boom shortened together. (From the shoulder the boom could
      // start right at a shelf behind you, and the camera was inside it however short the boom.)
      const hx = target.x;
      const hy = target.y + height;
      const hz = target.z;
      // how far it gets from your head towards that place, lifted by so much (and no higher than
      // the ceiling)
      const ray = (lift, out) => {
        const w = _w.copy(this.pivot).addScaledVector(this.fwd, -dist);
        w.y += lift;
        if (opts.maxY !== undefined && w.y > opts.maxY) w.y = Math.max(hy, opts.maxY);
        out.dx = w.x - hx;
        out.dy = w.y - hy;
        out.dz = w.z - hz;
        out.len = Math.hypot(out.dx, out.dy, out.dz) || 1e-6;
        const hit = this.collision.raycast(hx, hy, hz, out.dx, out.dy, out.dz, out.len + 0.3);
        // (never past what it hit, however close: close behind you in a narrow place - you are
        // faded out of its way, game/game.js - rather than inside a shelf or a wall, looking out)
        out.want = hit ? Math.max(0, hit.t - 0.3) : out.len;
        return out;
      };
      // (with your back to something low - a rail of clothes, a table, the counter - the boom stops
      // short at it, and you would be faded out of the camera's way: up over it instead, as far as
      // it goes. Eased up and down, never a jump.)
      // (not while aiming: the sight stays where you put it)
      let L = ray(this.curLift, _r0);
      const hiLift = 1.0;
      let wantLift = 0;
      const low = this.curLift > 0.01 ? ray(0, _r1) : L;
      if (!opts.aim && low.want < 1.4) {
        const high = Math.abs(this.curLift - hiLift) < 0.01 ? L : ray(hiLift, _r2);
        if (high.want > low.want + 0.35) wantLift = hiLift;
      }
      const lift = damp(this.curLift, wantLift, 4, dt);
      if (Math.abs(lift - this.curLift) > 1e-4) {
        this.curLift = lift;
        L = ray(lift, _r0);
      }
      this.curDist = L.want < this.curDist ? L.want : damp(this.curDist, L.want, 6, dt);
      const { dx, dy, dz, len } = L;
      let k = Math.min(1, this.curDist / len);
      cam.position.set(hx + dx * k, hy + dy * k, hz + dz * k);
      // (and wherever that puts it - a ray along an edge can pass a box by a hair - never inside
      // something, nor so near that the picture's near plane cuts into it: in towards your head)
      for (let i = 0; i < 8 && k > 0.01 && this.collision.pointInside(cam.position.x, cam.position.y, cam.position.z, 0.1); i++) {
        k *= 0.6;
        this.curDist = k * len;
        cam.position.set(hx + dx * k, hy + dy * k, hz + dz * k);
      }
    }
    // (in the bay, ROADMAP 5.2: over the water or under it, never in the surface itself)
    const minY = opts.minY !== undefined ? opts.minY : 0.35;
    if (cam.position.y < minY) cam.position.y = minY;
    if (opts.maxY !== undefined && cam.position.y > opts.maxY) cam.position.y = opts.maxY;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * 0.25;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
    }
    cam.rotation.set(this.pitch, this.yaw + Math.PI, 0, 'YXZ');
    const fov = this.baseFov * (opts.aim ? 0.8 : 1) * (opts.fovMul || 1);
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = damp(cam.fov, fov, 10, dt);
      cam.updateProjectionMatrix();
    }
  }

  // (ROADMAP 12.6) held at a place, looking at a point - a game in the world: behind your shoulder,
  // its screen in front - eased there from wherever it was (its yaw and pitch kept, so the camera
  // goes back behind you from there when the game is over)
  holdAt(dt, pos, look, fov) {
    const cam = this.camera;
    const dx = look[0] - pos[0];
    const dy = look[1] - pos[1];
    const dz = look[2] - pos[2];
    const yaw = Math.atan2(dx, dz);
    const pitch = Math.atan2(dy, Math.hypot(dx, dz));
    this.holdT = (this.holdT || 0) + dt;
    const k = this.holdT > 1.2 ? 1 : 1 - Math.exp(-dt * 6);
    let d = yaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * k;
    this.pitch += (pitch - this.pitch) * k;
    cam.position.x += (pos[0] - cam.position.x) * k;
    cam.position.y += (pos[1] - cam.position.y) * k;
    cam.position.z += (pos[2] - cam.position.z) * k;
    cam.rotation.set(this.pitch, this.yaw + Math.PI, 0, 'YXZ');
    this.curDist = this.dist;
    // (a small screen near - an arcade cabinet's: the view narrower, the screen bigger in it)
    const want = fov || this.baseFov;
    if (Math.abs(cam.fov - want) > 0.05) {
      cam.fov = damp(cam.fov, want, 6, dt);
      cam.updateProjectionMatrix();
    }
  }

  addShake(a) {
    this.shake = Math.min(1.2, this.shake + a);
  }
}
