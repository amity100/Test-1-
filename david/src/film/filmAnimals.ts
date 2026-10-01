/*
 * filmAnimals — the flock, the lamb and the bear's eyes in the opening film's game-world shots (docs/intro-script-v2.md
 * D1, H1; director-notes-v4 §15, §18/19: "not one sheep of his flock is in frame", "the lamb walks out of frame at the
 * right edge"). Behaviour only, over the public API of src/characters/Flock.ts (Animal: position, heading, state,
 * aiEnabled, manualSpeed; the procedural gait, grazing, ear flicks, tail and the alert look are Flock's own).
 *
 *   const ff = new FilmFlock(flock, ground);
 *   on the cut into D1 (the camera already at the shot's first frame):  ff.stageInView(camera, davidFeet);
 *   every frame:                                                          ff.tick(t, dt, camera);
 *   leaving the game-world shots:                                         ff.restore();
 *   H1 every frame:  lambAtEdge(flock.lamb, t, { lift: beats.lambHead, toward: thicketPoint, walkUntil })
 *
 * Every animal placed by stageInView is inside the lens' frame (projected, with a margin), on the ground below the
 * horizon, clear of the shepherd's silhouette and of each other; a third walk slowly across the view (profiles), the
 * rest graze and take a step now and then — nobody is frozen, nobody leaves the frame (a walker that reaches the
 * frame's edge turns back).
 */
import * as THREE from 'three';
import type { Animal, Flock } from '../characters/Flock';

interface Member {
  a: Animal;
  walk: boolean;
  speed: number;
  turn: number;
  stepT: number;
  stepFor: number;
}

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const _s = new THREE.Vector3();

function hash(i: number, k: number) {
  const h = Math.sin(i * 12.9898 + k * 78.233 + 0.5) * 43758.5453;
  return h - Math.floor(h);
}

export class FilmFlock {
  private saved: { a: Animal; pos: THREE.Vector3; heading: number; ai: boolean; state: Animal['state']; speed: number }[] = [];
  private members: Member[] = [];

  constructor(readonly flock: Flock, readonly ground: (x: number, z: number) => number) {}

  /** the animals placed in view (read-only) */
  get animals() {
    return this.members.map((m) => m.a);
  }

  /**
   * Place up to `max` animals of the flock in the camera's view: on the ground between `near` and `far` metres,
   * inside the frame with a margin (NDC |x| < 0.85, -0.85 < y < horizon - 0.05), at least `clear` (NDC) from the
   * shepherd's projected feet..head line, `spacing` m apart. Call on the cut with the shot's first camera.
   */
  stageInView(camera: THREE.PerspectiveCamera, shepherd: THREE.Vector3 | null, o: { near?: number; far?: number; max?: number; clear?: number; spacing?: number; exclude?: Animal[] } = {}) {
    this.restore();
    const near = o.near ?? 5, far = o.far ?? 34, max = o.max ?? 14, clear = o.clear ?? 0.22, spacing = o.spacing ?? 1.5;
    camera.updateMatrixWorld(true);
    const cam = camera.getWorldPosition(new THREE.Vector3());
    const fwd = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    const right = _r.set(-fwd.z, 0, fwd.x);
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
    // the shepherd on screen (feet and head)
    let sx = 9, sy0 = 9, sy1 = 9;
    if (shepherd) {
      _v.copy(shepherd).project(camera);
      sx = _v.x;
      sy0 = _v.y;
      _v.copy(shepherd).add(_s.set(0, 1.8, 0)).project(camera);
      sy1 = _v.y;
    }
    const pool = this.flock.animals.filter((a) => a.state !== 'carried' && !(o.exclude ?? []).includes(a));
    const placed: THREE.Vector3[] = [];
    let k = 0;
    for (let tries = 0; tries < 400 && placed.length < max && k < pool.length; tries++) {
      const u = hash(tries, 1), w = hash(tries, 2);
      const ang = (u - 0.5) * hfov * 0.8;
      const d = near + (far - near) * Math.pow(w, 0.8);
      const dir = _f.copy(fwd).applyAxisAngle(_n.set(0, 1, 0), -ang);
      const x = cam.x + dir.x * d, z = cam.z + dir.z * d;
      const p = new THREE.Vector3(x, this.ground(x, z), z);
      // in frame, below the horizon, clear of the shepherd
      _v.copy(p).add(_s.set(0, 0.45, 0)).project(camera);
      if (_v.z > 1 || Math.abs(_v.x) > 0.85 || _v.y < -0.85 || _v.y > 0.75) continue;
      if (shepherd && Math.abs(_v.x - sx) < clear && _v.y > sy0 - 0.1 && _v.y < sy1 + 0.1) continue;
      if (placed.some((q) => q.distanceTo(p) < spacing)) continue;
      placed.push(p);
      const a = pool[k++];
      this.saved.push({ a, pos: a.position.clone(), heading: a.heading, ai: a.aiEnabled, state: a.state, speed: a.manualSpeed });
      a.position.copy(p);
      const walk = hash(tries, 3) < 0.34;
      // walkers cross the view (profiles), grazers face anywhere
      a.heading = walk ? Math.atan2(right.x, right.z) + (hash(tries, 4) < 0.5 ? 0 : Math.PI) + (hash(tries, 5) - 0.5) * 0.6 : hash(tries, 6) * Math.PI * 2;
      a.aiEnabled = false;
      a.state = walk ? 'walk' : 'graze';
      a.manualSpeed = walk ? 0.28 + 0.2 * hash(tries, 7) : 0;
      this.members.push({ a, walk, speed: a.manualSpeed, turn: (hash(tries, 8) - 0.5) * 0.25, stepT: 0.5 + hash(tries, 9) * 2.5, stepFor: 0 });
    }
    return this.members.length;
  }

  /** per frame: walkers turn gently (and back at the frame's edge), grazers take a step now and then */
  tick(_t: number, dt: number, camera?: THREE.Camera) {
    for (const m of this.members) {
      const a = m.a;
      if (m.walk) {
        a.heading += m.turn * dt;
        if (camera) {
          _v.copy(a.position).project(camera);
          // heading out of the frame: turn back in
          if (Math.abs(_v.x) > 0.8) {
            _v.copy(a.position).add(_s.set(Math.sin(a.heading), 0, Math.cos(a.heading))).project(camera);
            const out = Math.abs(_v.x) > Math.abs(_s.copy(a.position).project(camera).x);
            if (out) a.heading += Math.PI * Math.min(1, dt * 1.2);
          }
        }
        a.manualSpeed = m.speed;
        a.state = 'walk';
        continue;
      }
      // a grazer: head down, a step every few seconds (0.6-1 s at a slow walk), then grazing again
      m.stepT -= dt;
      if (m.stepT <= 0 && m.stepFor <= 0) {
        m.stepFor = 0.6 + Math.random() * 0.4;
        a.heading += (Math.random() - 0.5) * 1.2;
      }
      if (m.stepFor > 0) {
        m.stepFor -= dt;
        a.state = 'walk';
        a.manualSpeed = 0.22;
        if (m.stepFor <= 0) m.stepT = 1.8 + Math.random() * 3;
      } else {
        a.state = 'graze';
        a.manualSpeed = 0;
      }
    }
  }

  /** back to where the flock was (the game's own AI) */
  restore() {
    for (const s of this.saved) {
      s.a.position.copy(s.pos);
      s.a.heading = s.heading;
      s.a.aiEnabled = s.ai;
      s.a.state = s.state === 'carried' ? 'graze' : s.state;
      s.a.manualSpeed = s.speed;
    }
    this.saved.length = 0;
    this.members.length = 0;
  }
}

/**
 * H1: the lamb at the thicket's edge — it walks in (until `walkUntil`), grazes, and at `lift` its head comes up toward
 * `toward` (Flock's alert look: the head lifts, the ears turn), a flick of the ears, then it stands listening. It never
 * walks on out of the frame.
 */
export function lambAtEdge(lamb: Animal, t: number, o: { lift: number; toward: THREE.Vector3; walkUntil?: number; speed?: number }) {
  const a = lamb as unknown as { alert: number; alertDir: number; earFlickT: number[]; graze: number };
  lamb.aiEnabled = false;
  const walking = t < (o.walkUntil ?? 0);
  if (walking) {
    lamb.state = 'walk';
    lamb.manualSpeed = o.speed ?? 0.45;
    a.alert = 0;
    return;
  }
  lamb.manualSpeed = 0;
  if (t < o.lift) {
    lamb.state = 'graze';
    a.alert = 0;
    return;
  }
  // the head comes up and turns to the thicket; the ears flick once as it lifts
  lamb.state = 'walk';
  a.alert = 1;
  a.alertDir = Math.atan2(o.toward.x - lamb.position.x, o.toward.z - lamb.position.z);
  if (t - o.lift < 0.05 && a.earFlickT) {
    a.earFlickT[0] = 0;
    a.earFlickT[1] = 0.08;
  }
}
