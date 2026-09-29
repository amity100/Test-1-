import * as THREE from 'three';
import { pebbleGeometry } from '../characters/DavidModel';

export interface HitTarget {
  id: string;
  center: () => THREE.Vector3;
  radius: number;
  enabled: () => boolean;
  onHit: (at: THREE.Vector3, vel: THREE.Vector3) => void;
}

const TRAIL = 6;
interface Stone { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; life: number; resting: boolean; trail: THREE.Vector3[]; trailN: number }

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** Sling stones: ballistic flight, sphere targets, terrain impacts, a faint motion trail. No per-frame allocations. */
export class Projectiles {
  readonly group = new THREE.Group();
  readonly targets: HitTarget[] = [];
  private stones: Stone[] = [];
  private pool: Stone[] = [];
  // a smooth wadi pebble, the same shape David loads into the pouch (1 Sam 17:40 "חַלֻּקֵּי אֲבָנִים")
  private geo = pebbleGeometry(11, 1.3);
  private mat = new THREE.MeshStandardMaterial({ color: 0xd2c6ae, roughness: 0.45 });
  private trailGeo: THREE.BufferGeometry;
  private trailPos: Float32Array;
  private trailLine: THREE.LineSegments;
  onGroundHit?: (at: THREE.Vector3, speed: number) => void;

  constructor(private ground: (x: number, z: number) => number) {
    this.trailPos = new Float32Array(64 * 6);
    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.trailLine = new THREE.LineSegments(this.trailGeo, new THREE.LineBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.35, depthWrite: false }));
    this.trailLine.frustumCulled = false;
    this.group.add(this.trailLine);
  }

  fire(pos: THREE.Vector3, vel: THREE.Vector3) {
    const s = this.pool.pop() ?? {
      mesh: new THREE.Mesh(this.geo, this.mat), vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, resting: false,
      trail: Array.from({ length: TRAIL }, () => new THREE.Vector3()), trailN: 0,
    };
    s.mesh.castShadow = true;
    s.mesh.position.copy(pos);
    s.mesh.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    s.vel.copy(vel);
    // a slung stone spins fast about the axis across its flight (backspin from the pouch)
    s.spin.set(-18 - Math.random() * 8, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
    s.life = 0;
    s.resting = false;
    s.trailN = 1;
    s.trail[0].copy(pos);
    this.group.add(s.mesh);
    this.stones.push(s);
  }

  /** Solve the launch velocity to hit `target` with speed v (low arc). Falls back to 42° max range. */
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

  update(dt: number) {
    const g = 9.81;
    const a = _a, b = _b;
    let seg = 0;
    for (const s of this.stones) {
      s.life += dt;
      if (s.resting) continue;
      const steps = 4;
      const h = dt / steps;
      for (let k = 0; k < steps && !s.resting; k++) {
        a.copy(s.mesh.position);
        s.vel.y -= g * h;
        s.mesh.position.addScaledVector(s.vel, h);
        b.copy(s.mesh.position);
        // targets
        for (const t of this.targets) {
          if (!t.enabled()) continue;
          if (segSphere(a, b, t.center(), t.radius)) {
            t.onHit(b.clone(), s.vel.clone());
            s.resting = true;
            s.life = 99;
            break;
          }
        }
        if (s.resting) break;
        const gy = this.ground(b.x, b.z);
        if (b.y < gy + 0.02) {
          s.mesh.position.y = gy + 0.025;
          const speed = s.vel.length();
          this.onGroundHit?.(s.mesh.position.clone(), speed);
          s.vel.multiplyScalar(0.25);
          s.vel.y = Math.abs(s.vel.y) * 0.3;
          s.spin.multiplyScalar(0.3);
          if (speed < 4) s.resting = true;
        }
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
    const P = this.trailPos;
    for (const s of this.stones) {
      if (s.resting || s.life > 1.5) continue;
      for (let i = 0; i < s.trailN - 1 && seg < 64; i++, seg++) {
        const p = s.trail[i], q = s.trail[i + 1], o = seg * 6;
        P[o] = p.x; P[o + 1] = p.y; P[o + 2] = p.z; P[o + 3] = q.x; P[o + 4] = q.y; P[o + 5] = q.z;
      }
    }
    this.trailGeo.setDrawRange(0, seg * 2);
    (this.trailGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}

function segSphere(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, r: number) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
  const l2 = abx * abx + aby * aby + abz * abz;
  let t = l2 > 0 ? (acx * abx + acy * aby + acz * abz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + abx * t - c.x, py = a.y + aby * t - c.y, pz = a.z + abz * t - c.z;
  return px * px + py * py + pz * pz <= r * r;
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
