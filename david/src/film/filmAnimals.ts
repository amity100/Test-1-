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
 *                    (H2: t = H1's length + the H2 shot time — the lamb keeps listening)
 *   H1/H2 every frame: bearInThicket(bear.model, take, t) — the bear's breath and the head lifting at `eyesOpen`
 *
 * Every animal placed by stageInView is inside the lens' frame (projected, with a margin), on the ground below the
 * horizon, clear of the shepherd's silhouette and of each other; a third walk slowly across the view (profiles), the
 * rest graze and take a step now and then — nobody is frozen, nobody leaves the frame (a walker that reaches the
 * frame's edge turns back).
 */
import * as THREE from 'three';
import type { Animal, Flock } from '../characters/Flock';
import type { BearModel } from '../characters/BearModel';
import { INTRO_SHOTS } from '../content/introScript';

/** CUT v3 contract: H1 'thicket' (its length and `lambHead`), H2 'lamb' (`eyesOpen`) */
const H1 = INTRO_SHOTS.find((s) => s.take === 'thicket');
const H2 = INTRO_SHOTS.find((s) => s.take === 'lamb');
export const LAMB_BEATS = { h1: H1?.dur ?? 3, lambHead: H1?.beats?.lambHead ?? 1.8, eyesOpen: H2?.beats?.eyesOpen ?? 0.9 };

interface Member {
  a: Animal;
  walk: boolean;
  speed: number;
  turn: number;
  stepT: number;
  stepFor: number;
  /** follow mode (P3): the place behind the shepherd (along / across his way, m) and a wander phase */
  follow?: { back: number; side: number; ph: number; grazeT: number };
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
  stageInView(camera: THREE.PerspectiveCamera, shepherd: THREE.Vector3 | null, o: { near?: number; far?: number; max?: number; clear?: number; spacing?: number; exclude?: Animal[]; yMin?: number } = {}) {
    this.restore();
    const near = o.near ?? 5, far = o.far ?? 34, max = o.max ?? 14, clear = o.clear ?? 0.22, spacing = o.spacing ?? 1.5;
    // the lowest NDC y an animal may stand at (a 2.39 letterbox over a 16:9 canvas hides |y| > ~0.74)
    const yMin = o.yMin ?? -0.85;
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
      if (_v.z > 1 || Math.abs(_v.x) > 0.85 || _v.y < yMin || _v.y > 0.75) continue;
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

  private leader: (() => THREE.Vector3 | null) | null = null;
  private readonly way = new THREE.Vector3(1, 0, 0);
  private readonly lead = new THREE.Vector3();

  /**
   * P3: the flock follows its shepherd across the view in a loose drove — `count` animals placed behind him along his
   * way (`dir`, horizontal) between `back[0]` and `back[1]` m and up to `spread` m to either side; every frame (tick)
   * each one heads for its own place behind the moving shepherd: it grazes when it is there, drops behind, and walks or
   * trots to catch up — never in step, never frozen. `leader` returns the shepherd's feet each frame.
   */
  stageFollow(leader: () => THREE.Vector3 | null, dir: THREE.Vector3, o: { count?: number; back?: [number, number]; spread?: number; exclude?: Animal[] } = {}) {
    this.restore();
    const count = o.count ?? 10, back = o.back ?? [1.6, 7.5], spread = o.spread ?? 2.4;
    this.leader = leader;
    this.way.copy(dir).setY(0).normalize();
    const L = leader();
    if (!L) return 0;
    const side = _r.set(-this.way.z, 0, this.way.x);
    const pool = this.flock.animals.filter((a) => a.state !== 'carried' && a !== this.flock.lamb && !(o.exclude ?? []).includes(a));
    for (let k = 0; k < Math.min(count, pool.length); k++) {
      const a = pool[k];
      const f = { back: back[0] + (back[1] - back[0]) * hash(k, 11), side: (hash(k, 12) - 0.5) * 2 * spread, ph: hash(k, 13) * 6.28, grazeT: hash(k, 14) * 2 };
      this.saved.push({ a, pos: a.position.clone(), heading: a.heading, ai: a.aiEnabled, state: a.state, speed: a.manualSpeed });
      const x = L.x - this.way.x * f.back + side.x * f.side, z = L.z - this.way.z * f.back + side.z * f.side;
      a.position.set(x, this.ground(x, z), z);
      a.heading = Math.atan2(this.way.x, this.way.z) + (hash(k, 15) - 0.5) * 0.8;
      a.aiEnabled = false;
      a.state = 'walk';
      a.manualSpeed = 0.5;
      this.members.push({ a, walk: false, speed: 0, turn: 0, stepT: 0, stepFor: 0, follow: f });
    }
    return this.members.length;
  }

  /** per frame: walkers turn gently (and back at the frame's edge), grazers take a step now and then */
  tick(t: number, dt: number, camera?: THREE.Camera) {
    const L = this.leader ? this.leader() : null;
    if (L) this.lead.copy(L);
    for (const m of this.members) {
      const a = m.a;
      if (m.follow && L) {
        // its place behind the shepherd, wandering a little; head for it, graze when there
        const F = m.follow;
        const side = _r.set(-this.way.z, 0, this.way.x);
        const wb = F.back + 0.7 * Math.sin(t * 0.35 + F.ph), ws = F.side + 0.5 * Math.sin(t * 0.27 + 2 * F.ph);
        const tx = this.lead.x - this.way.x * wb + side.x * ws, tz = this.lead.z - this.way.z * wb + side.z * ws;
        const dx = tx - a.position.x, dz = tz - a.position.z;
        const d = Math.hypot(dx, dz);
        F.grazeT -= dt;
        if (d < 0.45 && F.grazeT <= 0) {
          // there: graze a moment (the shepherd walks on, it drops behind)
          a.state = 'graze';
          a.manualSpeed = 0;
          if (d < 0.2) F.grazeT = 0.6 + hash(Math.floor(t * 3), F.ph) * 1.2;
          continue;
        }
        const want = Math.atan2(dx, dz);
        const e = Math.atan2(Math.sin(want - a.heading), Math.cos(want - a.heading));
        a.heading += e * Math.min(1, dt * 2.5);
        a.state = 'walk';
        // a walk, a trot when it has fallen behind
        a.manualSpeed = THREE.MathUtils.clamp(0.35 + d * 0.55, 0.35, 1.9) * (0.92 + 0.16 * hash(F.ph * 10, 3));
        continue;
      }
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
    this.leader = null;
  }
}

/** per lamb: the last film time it was performed at (one-shot cues fire on crossings, safe under stepped playback) */
const lambClock = new WeakMap<Animal, number>();

/**
 * H1: the lamb at the thicket's edge — it walks in (until `walkUntil`), grazes with an ear twitching now and then, and
 * at `lift` (default: the contract's H1 `lambHead`) its head comes up toward `toward` (Flock's alert look: the head
 * lifts, the ears turn), the ears flick, it takes one hesitant step and stands listening — the ears still turning (H2:
 * t runs on past H1's length). It never walks on out of the frame.
 */
export function lambAtEdge(lamb: Animal, t: number, o: { lift?: number; toward: THREE.Vector3; walkUntil?: number; speed?: number }) {
  const a = lamb as unknown as { alert: number; alertDir: number; earFlickT: number[]; graze: number };
  const lift = o.lift ?? LAMB_BEATS.lambHead;
  lamb.aiEnabled = false;
  const last = lambClock.get(lamb) ?? -1;
  lambClock.set(lamb, t);
  const crossed = (at: number) => (last < at && t >= at) || (last > t && t >= at && t - at < 0.1);
  const flick = (left: boolean, right: boolean) => {
    if (!a.earFlickT) return;
    if (left) a.earFlickT[0] = 0;
    if (right) a.earFlickT[1] = 0.06;
  };
  // the ears twitch while it grazes (flies, a sound off in the bushes), then both at once as the head comes up, and
  // they keep turning while it listens (CUT v3: H1 is 3 s, the lamb lives on into H2)
  if (crossed(0.55)) flick(true, false);
  if (crossed(1.05)) flick(false, true);
  if (lift > 1.6 && crossed(lift - 0.35)) flick(true, false);
  if (crossed(lift)) flick(true, true);
  if (crossed(lift + 0.75)) flick(true, false);
  if (crossed(lift + 1.25)) flick(false, true);
  if (crossed(lift + 2.0)) flick(true, true);
  const walking = t < (o.walkUntil ?? 0);
  if (walking) {
    lamb.state = 'walk';
    lamb.manualSpeed = o.speed ?? 0.45;
    a.alert = 0;
    return;
  }
  lamb.manualSpeed = 0;
  if (t < lift) {
    lamb.state = 'graze';
    a.alert = 0;
    return;
  }
  // the head comes up and turns to the thicket; one hesitant step, then it stands listening (the look searching a
  // little: a sound it cannot place)
  lamb.state = 'walk';
  a.alert = 1;
  a.alertDir = Math.atan2(o.toward.x - lamb.position.x, o.toward.z - lamb.position.z) + 0.12 * Math.sin((t - lift) * 1.7) * Math.min(1, Math.max(0, t - lift - 0.9));
  const step = t > lift + 0.45 && t < lift + 0.8;
  lamb.manualSpeed = step ? 0.3 : 0;
}

/**
 * H1/H2: the bear in the dark of the thicket (CUT v3) — a slow, deep breath under the leaves in H1; in H2 the head lifts
 * toward the lamb as the eyes open at `eyesOpen` (the eye-shine is cut5's, FilmWorld), the breath quickening a little.
 * Pass take = null when leaving the film (back to the gameplay defaults).
 */
export function bearInThicket(bear: Pick<BearModel, 'breathDepth' | 'breathRate' | 'headUp'>, take: string | null, t: number) {
  if (take === 'lamb') {
    const open = THREE.MathUtils.smoothstep(t, LAMB_BEATS.eyesOpen - 0.2, LAMB_BEATS.eyesOpen + 0.6);
    bear.breathDepth = 2.2 + 0.6 * open;
    bear.breathRate = 0.75 + 0.25 * open;
    bear.headUp = open;
  } else if (take === 'thicket') {
    bear.breathDepth = 2.0;
    bear.breathRate = 0.75;
    bear.headUp = 0;
  } else {
    bear.breathDepth = 1;
    bear.breathRate = 1;
    bear.headUp = 0;
  }
}
