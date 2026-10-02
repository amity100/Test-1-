import * as THREE from 'three';
import { pebbleGeometry } from '../characters/DavidModel';

/**
 * Something a slung stone can hit: a sphere (`center` + `radius`) or, with `segment`, a capsule (the thin cord that
 * holds the waterskin, Judg 20:16). `solid` things (the terrace wall, a log, a branch, the bear) stop the stone;
 * every target does. `onHit` gets the point, the stone's velocity and the shot that threw it (null: tossed / test).
 */
export interface HitTarget {
  id: string;
  center: () => THREE.Vector3;
  radius: number;
  enabled: () => boolean;
  onHit: (at: THREE.Vector3, vel: THREE.Vector3, shot: ShotInfo | null) => void;
  /** capsule targets: the segment's two ends (world); `center` should be its middle */
  segment?: () => readonly [THREE.Vector3, THREE.Vector3];
  /** 'target': counts as a hit for the range; 'solid': only stops the stone (sound + dust) */
  kind?: 'target' | 'solid';
  /** what the stone sounds like on it (solids): 'rock' | 'wood' | 'earth' */
  material?: 'rock' | 'wood' | 'earth' | 'clay' | 'skin';
}

/** One throw of the sling (Player fills it at the release; Projectiles resolves it into a hit or a miss). */
export interface ShotInfo {
  id: number;
  /** 0..1: how long the whirl was (speed, range, a flatter shot) */
  power: number;
  /** launch speed (m/s) */
  speed: number;
  /** release timing error in revolutions of the whirl: < 0 early, > 0 late; |timing| <= window = sweet */
  timing: number;
  /** the sweet window's half width (revolutions) at this power; the perfect window is PERFECT_FRAC of it */
  window: number;
  perfect: boolean;
  sweet: boolean;
  /** one of the five smooth stones he chose (flies truer) */
  smooth: boolean;
  /** the deviation the timing gave (degrees: + right, + up) */
  devRight: number;
  devUp: number;
  /** distance from the throw to what the reticle was on */
  aimDist: number;
  /** what the reticle was on (or the target nearest to the aim line), for the miss read-out */
  intent: HitTarget | null;
  /** the stone's closest pass by `intent` (filled during the flight): offset from its centre, world, and the distance */
  missOffset: THREE.Vector3;
  missDist: number;
  /** set when resolved */
  hit: HitTarget | null;
  resolved: boolean;
  /** where it came to rest / hit */
  at: THREE.Vector3;
  /** game time of the throw (s) and flight time */
  t0: number;
  flight: number;
  /** the throw's origin */
  from: THREE.Vector3;
}

const TRAIL = 8;
interface Stone {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  resting: boolean;
  trail: THREE.Vector3[];
  trailN: number;
  shot: ShotInfo | null;
  k: number;
  /** the whole flight as dots every PATH_STEP m (a thrown stone's path stays readable until it fades after landing) */
  path: Float32Array;
  pathN: number;
  /** the time it came down (a hit, a solid, the ground), -1 while in flight */
  landed: number;
}
/** a sling stone's radius (m): it touches a target when its centre passes within the target's radius plus this */
const STONE_R = 0.025;
/** dots of a stone's path: spacing (m), most per stone, how long they stay after the stone came down (s) */
const PATH_STEP = 0.55, PATH_MAX = 96, PATH_FADE = 1.6;

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _rel = new THREE.Vector3();
const _off = new THREE.Vector3();

/** quadratic air drag of a smooth wadi pebble (5-7 cm, 100-200 g): k = ρ·Cd·A / 2m ≈ 1.2·0.45·0.0028 / 0.3 */
export const STONE_DRAG = 0.0052;
/** rough heap stones are a little less regular: more drag */
export const STONE_DRAG_ROUGH = 0.0062;

/**
 * Sling stones: real ballistics — gravity, quadratic air drag and the wind (the same wind that moves the grass:
 * `wind` m/s, set by the range) — sphere / capsule targets, solids and terrain impacts, a short motion trail at
 * speed; each throw is resolved into a hit or a miss with the stone's closest pass by the intended target (the
 * player's read-out: high / low / left / right). No per-frame allocations in the flight loop.
 */
export class Projectiles {
  readonly group = new THREE.Group();
  readonly targets: HitTarget[] = [];
  /** wind velocity (m/s, world, horizontal) acting on the stones in flight */
  readonly wind = new THREE.Vector3();
  private stones: Stone[] = [];
  private pool: Stone[] = [];
  // a smooth wadi pebble, the same shape David loads into the pouch (1 Sam 17:40 "חַלֻּקֵּי אֲבָנִים")
  private geo = pebbleGeometry(11, 1.3);
  private mat = new THREE.MeshStandardMaterial({ color: 0xd2c6ae, roughness: 0.45 });
  private trailGeo: THREE.BufferGeometry;
  private trailPos: Float32Array;
  private trailCol: Float32Array;
  private trailLine: THREE.LineSegments;
  private time = 0;
  private pathGeo: THREE.BufferGeometry;
  private pathPos: Float32Array;
  private pathCol: Float32Array;
  private pathDots: THREE.Points;
  /** the renderer's pixel ratio (the path's dots are a few device pixels wide on every screen) */
  pxScale = 1;
  /** a stone hit the ground / a solid (sound + dust) */
  onGroundHit?: (at: THREE.Vector3, speed: number, material: 'rock' | 'wood' | 'earth' | 'clay' | 'skin') => void;
  /** every throw ends here once: a hit (`shot.hit`) or a miss (with `missOffset` / `missDist` from `intent`) */
  onResolve?: (shot: ShotInfo) => void;

  constructor(private ground: (x: number, z: number) => number) {
    this.trailPos = new Float32Array(96 * 6);
    this.trailCol = new Float32Array(96 * 8);
    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.trailGeo.setAttribute('color', new THREE.BufferAttribute(this.trailCol, 4).setUsage(THREE.DynamicDrawUsage));
    this.trailLine = new THREE.LineSegments(this.trailGeo, new THREE.LineBasicMaterial({ color: 0xfff1d0, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }));
    this.trailLine.frustumCulled = false;
    this.group.add(this.trailLine);
    // the flight's dotted path (faint, warm white; a few px on any screen): a miss shows where the stone went
    const n = PATH_MAX * 4;
    this.pathPos = new Float32Array(n * 3);
    this.pathCol = new Float32Array(n * 4);
    this.pathGeo = new THREE.BufferGeometry();
    this.pathGeo.setAttribute('position', new THREE.BufferAttribute(this.pathPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.pathGeo.setAttribute('color', new THREE.BufferAttribute(this.pathCol, 4).setUsage(THREE.DynamicDrawUsage));
    this.pathDots = new THREE.Points(this.pathGeo, new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false }));
    this.pathDots.frustumCulled = false;
    this.group.add(this.pathDots);
  }

  /** Fire a stone; `shot` (from the Player) is resolved into a hit or a miss. `drag` per stone (smooth / rough). */
  fire(pos: THREE.Vector3, vel: THREE.Vector3, shot: ShotInfo | null = null, drag = STONE_DRAG) {
    const s = this.pool.pop() ?? {
      mesh: new THREE.Mesh(this.geo, this.mat), vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, resting: false,
      trail: Array.from({ length: TRAIL }, () => new THREE.Vector3()), trailN: 0, shot: null, k: STONE_DRAG,
      path: new Float32Array(PATH_MAX * 3), pathN: 0, landed: -1,
    };
    s.mesh.castShadow = true;
    s.mesh.visible = true;
    s.mesh.position.copy(pos);
    s.mesh.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    s.vel.copy(vel);
    // a slung stone spins fast about the axis across its flight (backspin from the pouch)
    s.spin.set(-18 - Math.random() * 8, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
    s.life = 0;
    s.resting = false;
    s.trailN = 1;
    s.trail[0].copy(pos);
    s.pathN = 1;
    s.landed = -1;
    s.path[0] = pos.x;
    s.path[1] = pos.y;
    s.path[2] = pos.z;
    s.shot = shot;
    s.k = drag;
    if (shot) {
      shot.missDist = Infinity;
      shot.missOffset.set(0, 0, 0);
      shot.resolved = false;
      shot.hit = null;
      shot.t0 = this.time;
      shot.from.copy(pos);
    }
    this.group.add(s.mesh);
    this.stones.push(s);
  }

  /** stones in flight (not resting) */
  get flying() {
    let n = 0;
    for (const s of this.stones) if (!s.resting) n++;
    return n;
  }
  /** the first stone in flight (the follow camera), or null */
  firstFlying(): { pos: THREE.Vector3; vel: THREE.Vector3; shot: ShotInfo | null } | null {
    for (const s of this.stones) if (!s.resting) return { pos: s.mesh.position, vel: s.vel, shot: s.shot };
    return null;
  }

  /**
   * Predict where a throw lands (no targets): integrates the same physics as update(); used by the tuning bots and
   * tests (never by the player's aim — the game does not solve the trajectory for him).
   */
  static predict(from: THREE.Vector3, vel: THREE.Vector3, wind: THREE.Vector3, k: number, ground: (x: number, z: number) => number, maxT = 4, out = new THREE.Vector3()) {
    const p = out.copy(from), v = _a.copy(vel);
    const h = 1 / 240;
    for (let t = 0; t < maxT; t += h) {
      stepStone(p, v, wind, k, h);
      if (p.y < ground(p.x, p.z)) break;
    }
    return p;
  }

  update(dt: number) {
    this.time += dt;
    const a = _a, b = _b;
    let seg = 0;
    for (const s of this.stones) {
      s.life += dt;
      if (s.resting) continue;
      const steps = Math.max(4, Math.ceil(dt / (1 / 240)));
      const h = dt / steps;
      for (let k = 0; k < steps && !s.resting; k++) {
        a.copy(s.mesh.position);
        stepStone(s.mesh.position, s.vel, this.wind, s.k, h);
        b.copy(s.mesh.position);
        // the dotted path: a dot every PATH_STEP m of the flight
        if (s.landed < 0 && s.pathN < PATH_MAX) {
          const o = (s.pathN - 1) * 3, dx = b.x - s.path[o], dy = b.y - s.path[o + 1], dz = b.z - s.path[o + 2];
          if (dx * dx + dy * dy + dz * dz >= PATH_STEP * PATH_STEP) {
            s.path[o + 3] = b.x;
            s.path[o + 4] = b.y;
            s.path[o + 5] = b.z;
            s.pathN++;
          }
        }
        // closest pass by the intended target (for the miss read-out)
        const shot = s.shot;
        if (shot && shot.intent && !shot.resolved) {
          const c = shot.intent.center();
          const d = closestOnSeg(a, b, c, _off);
          if (d < shot.missDist) {
            shot.missDist = d;
            shot.missOffset.copy(_off).sub(c);
          }
        }
        // targets and solids
        let hitT: HitTarget | null = null;
        let best = Infinity;
        for (const t of this.targets) {
          if (!t.enabled()) continue;
          let u: number;
          if (t.segment) {
            const [p0, p1] = t.segment();
            u = segCapsule(a, b, p0, p1, t.radius + STONE_R);
          } else u = segSphere(a, b, t.center(), t.radius + STONE_R);
          if (u >= 0 && u < best) {
            best = u;
            hitT = t;
          }
        }
        if (hitT) {
          const at = a.clone().lerp(b, best);
          s.mesh.position.copy(at);
          s.resting = true;
          // gone with the hit; it is retired once its path has faded
          s.mesh.visible = false;
          if (s.landed < 0) {
            this.pathEnd(s, at);
            s.landed = this.time;
          }
          s.life = Math.max(s.life, 6 - PATH_FADE - 0.05);
          if (shot && !shot.resolved && hitT.kind !== 'solid') {
            shot.hit = hitT;
            this.resolve(shot, at);
          }
          hitT.onHit(at, s.vel.clone(), shot);
          if (hitT.kind === 'solid') {
            this.onGroundHit?.(at, s.vel.length(), hitT.material ?? 'rock');
            if (shot && !shot.resolved) this.resolve(shot, at);
          }
          break;
        }
        const gy = this.ground(b.x, b.z);
        if (b.y < gy + 0.02) {
          s.mesh.position.y = gy + 0.025;
          if (s.landed < 0) {
            this.pathEnd(s, s.mesh.position);
            s.landed = this.time;
          }
          const speed = s.vel.length();
          this.onGroundHit?.(s.mesh.position, speed, 'earth');
          s.vel.multiplyScalar(0.25);
          s.vel.y = Math.abs(s.vel.y) * 0.3;
          s.spin.multiplyScalar(0.3);
          if (shot && !shot.resolved) this.resolve(shot, s.mesh.position);
          if (speed < 4) s.resting = true;
        }
      }
      // gone far away / too long
      if (!s.resting && (s.life > 5 || s.mesh.position.y < -500)) {
        s.resting = true;
        if (s.landed < 0) s.landed = this.time;
        if (s.shot && !s.shot.resolved) this.resolve(s.shot, s.mesh.position);
      }
      s.mesh.rotation.x += s.spin.x * dt;
      s.mesh.rotation.y += s.spin.y * dt;
      s.mesh.rotation.z += s.spin.z * dt;
      // trail ring (oldest first)
      if (s.trailN < TRAIL) s.trail[s.trailN++].copy(s.mesh.position);
      else {
        const first = s.trail[0];
        for (let i = 0; i < TRAIL - 1; i++) s.trail[i] = s.trail[i + 1];
        s.trail[TRAIL - 1] = first.copy(s.mesh.position);
      }
    }
    // retire old stones (back to the pool)
    for (let i = this.stones.length - 1; i >= 0; i--) {
      const s = this.stones[i];
      if (s.life > 6) {
        this.group.remove(s.mesh);
        this.stones.splice(i, 1);
        this.pool.push(s);
      }
    }
    // a short trail behind fast stones (brighter toward the stone, only at speed)
    const P = this.trailPos, C = this.trailCol;
    for (const s of this.stones) {
      if (s.resting || s.life > 1.6) continue;
      const sp = s.vel.length();
      const alpha = Math.min(1, Math.max(0, (sp - 12) / 18));
      if (alpha <= 0.01) continue;
      for (let i = 0; i < s.trailN - 1 && seg < 96; i++, seg++) {
        const p = s.trail[i], q = s.trail[i + 1], o = seg * 6, oc = seg * 8;
        P[o] = p.x; P[o + 1] = p.y; P[o + 2] = p.z; P[o + 3] = q.x; P[o + 4] = q.y; P[o + 5] = q.z;
        const f0 = (i / (s.trailN - 1)) * alpha, f1 = ((i + 1) / (s.trailN - 1)) * alpha;
        C[oc] = 1; C[oc + 1] = 0.95; C[oc + 2] = 0.84; C[oc + 3] = f0;
        C[oc + 4] = 1; C[oc + 5] = 0.95; C[oc + 6] = 0.84; C[oc + 7] = f1;
      }
    }
    // the flights' dotted paths: faint while the stone flies (older dots fainter), then fading out after it came down
    const DP = this.pathPos, DC = this.pathCol, cap = DP.length / 3;
    let dots = 0;
    for (const s of this.stones) {
      if (!s.shot || s.pathN < 2) continue;
      const fade = s.landed < 0 ? 1 : 1 - (this.time - s.landed) / PATH_FADE;
      if (fade <= 0.01) continue;
      for (let i = 0; i < s.pathN && dots < cap; i++, dots++) {
        const o = dots * 3, oc = dots * 4, q = i * 3;
        DP[o] = s.path[q];
        DP[o + 1] = s.path[q + 1];
        DP[o + 2] = s.path[q + 2];
        DC[oc] = 1;
        DC[oc + 1] = 0.94;
        DC[oc + 2] = 0.8;
        DC[oc + 3] = 0.6 * fade * (0.45 + 0.55 * (i / (s.pathN - 1)));
      }
    }
    this.pathGeo.setDrawRange(0, dots);
    if (dots > 0) {
      (this.pathGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (this.pathGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
    (this.pathDots.material as THREE.PointsMaterial).size = 2.6 * Math.max(1, this.pxScale);
    this.trailGeo.setDrawRange(0, seg * 2);
    (this.trailGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.trailGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  /** the path's last dot where the stone came down */
  private pathEnd(s: Stone, at: THREE.Vector3) {
    if (s.pathN >= PATH_MAX) return;
    const o = s.pathN * 3;
    s.path[o] = at.x;
    s.path[o + 1] = at.y;
    s.path[o + 2] = at.z;
    s.pathN++;
  }

  private resolve(shot: ShotInfo, at: THREE.Vector3) {
    shot.resolved = true;
    shot.at.copy(at);
    shot.flight = this.time - shot.t0;
    this.onResolve?.(shot);
  }

  /** a fresh ShotInfo (the Player fills it) */
  static newShot(id: number): ShotInfo {
    return {
      id, power: 0, speed: 0, timing: 0, window: 0.12, perfect: false, sweet: false, smooth: false, devRight: 0, devUp: 0,
      aimDist: 0, intent: null, missOffset: new THREE.Vector3(), missDist: Infinity, hit: null, resolved: false,
      at: new THREE.Vector3(), t0: 0, flight: 0, from: new THREE.Vector3(),
    };
  }

  /** Solve the launch velocity to hit `target` with speed v (low arc, no drag). Kept for scripted throws and tests. */
  static solve(from: THREE.Vector3, target: THREE.Vector3, v: number, g = 9.81) {
    const d = new THREE.Vector3().subVectors(target, from);
    const x = Math.hypot(d.x, d.z);
    const y = d.y;
    const v2 = v * v;
    const disc = v2 * v2 - g * (g * x * x + 2 * y * v2);
    let ang: number;
    let inRange = true;
    if (disc < 0 || x < 0.01) {
      ang = x < 0.01 ? Math.PI / 2 : Math.PI / 4.3;
      inRange = false;
    } else ang = Math.atan2(v2 - Math.sqrt(disc), g * x);
    const hd = new THREE.Vector3(d.x, 0, d.z).normalize();
    const vel = hd.multiplyScalar(Math.cos(ang) * v);
    vel.y = Math.sin(ang) * v;
    return { vel, inRange };
  }
}

/** one integration step of a stone: gravity + quadratic drag against the air moving with the wind (semi-implicit) */
function stepStone(p: THREE.Vector3, v: THREE.Vector3, wind: THREE.Vector3, k: number, h: number) {
  const r = _rel.subVectors(v, wind);
  const sp = r.length();
  v.x -= k * sp * r.x * h;
  v.y -= (9.81 + k * sp * r.y) * h;
  v.z -= k * sp * r.z * h;
  p.addScaledVector(v, h);
}

/** segment a-b vs sphere: the parameter (0..1) of the first contact, or -1 */
function segSphere(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, r: number) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
  const l2 = abx * abx + aby * aby + abz * abz;
  let t = l2 > 0 ? (acx * abx + acy * aby + acz * abz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + abx * t - c.x, py = a.y + aby * t - c.y, pz = a.z + abz * t - c.z;
  return px * px + py * py + pz * pz <= r * r ? t : -1;
}

/** segment a-b (the stone's path this step) vs capsule p0-p1 of radius r: the parameter on a-b, or -1 */
function segCapsule(a: THREE.Vector3, b: THREE.Vector3, p0: THREE.Vector3, p1: THREE.Vector3, r: number) {
  // closest points between two segments (Ericson, Real-Time Collision Detection 5.1.9)
  const d1x = b.x - a.x, d1y = b.y - a.y, d1z = b.z - a.z;
  const d2x = p1.x - p0.x, d2y = p1.y - p0.y, d2z = p1.z - p0.z;
  const rx = a.x - p0.x, ry = a.y - p0.y, rz = a.z - p0.z;
  const A = d1x * d1x + d1y * d1y + d1z * d1z, E = d2x * d2x + d2y * d2y + d2z * d2z;
  const F = d2x * rx + d2y * ry + d2z * rz;
  let s: number, t: number;
  if (A <= 1e-12 && E <= 1e-12) { s = 0; t = 0; }
  else if (A <= 1e-12) { s = 0; t = Math.max(0, Math.min(1, F / E)); }
  else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (E <= 1e-12) { t = 0; s = Math.max(0, Math.min(1, -c / A)); }
    else {
      const bb = d1x * d2x + d1y * d2y + d1z * d2z;
      const den = A * E - bb * bb;
      s = den > 1e-12 ? Math.max(0, Math.min(1, (bb * F - c * E) / den)) : 0;
      t = (bb * s + F) / E;
      if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / A)); }
      else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (bb - c) / A)); }
    }
  }
  const qx = a.x + d1x * s - (p0.x + d2x * t), qy = a.y + d1y * s - (p0.y + d2y * t), qz = a.z + d1z * s - (p0.z + d2z * t);
  return qx * qx + qy * qy + qz * qz <= r * r ? s : -1;
}

/** distance from c to segment a-b; `out` = the closest point */
function closestOnSeg(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, out: THREE.Vector3) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const l2 = abx * abx + aby * aby + abz * abz;
  let t = l2 > 0 ? ((c.x - a.x) * abx + (c.y - a.y) * aby + (c.z - a.z) * abz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  out.set(a.x + abx * t, a.y + aby * t, a.z + abz * t);
  return out.distanceTo(c);
}

/** Ray vs sphere: distance along the ray or -1. */
export function raySphere(o: THREE.Vector3, d: THREE.Vector3, c: THREE.Vector3, r: number) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : -1;
}

/** Ray vs capsule (p0-p1, radius r): distance along the ray or -1 (sampled; fine for thin cords). */
export function rayCapsule(o: THREE.Vector3, d: THREE.Vector3, p0: THREE.Vector3, p1: THREE.Vector3, r: number) {
  let best = -1;
  for (let i = 0; i <= 12; i++) {
    const c = _off.lerpVectors(p0, p1, i / 12);
    const t = raySphere(o, d, c, r);
    if (t > 0 && (best < 0 || t < best)) best = t;
  }
  return best;
}
