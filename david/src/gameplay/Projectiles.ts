import * as THREE from 'three';

export interface HitTarget {
  id: string;
  center: () => THREE.Vector3;
  radius: number;
  enabled: () => boolean;
  onHit: (at: THREE.Vector3, vel: THREE.Vector3) => void;
}

interface Stone { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; resting: boolean; trail: THREE.Vector3[] }

/** Sling stones: ballistic flight, sphere targets, terrain impacts, a faint motion trail. */
export class Projectiles {
  readonly group = new THREE.Group();
  readonly targets: HitTarget[] = [];
  private stones: Stone[] = [];
  private geo = new THREE.SphereGeometry(0.028, 10, 8);
  private mat = new THREE.MeshStandardMaterial({ color: 0xd8cfbd, roughness: 0.55 });
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
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.castShadow = true;
    mesh.position.copy(pos);
    this.group.add(mesh);
    this.stones.push({ mesh, vel: vel.clone(), life: 0, resting: false, trail: [pos.clone()] });
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
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
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
          if (speed < 4) s.resting = true;
        }
      }
      s.mesh.rotation.x += dt * 20;
      s.trail.push(s.mesh.position.clone());
      if (s.trail.length > 6) s.trail.shift();
    }
    // fade out & remove
    this.stones = this.stones.filter((s) => {
      if (s.life > 6) {
        this.group.remove(s.mesh);
        return false;
      }
      return true;
    });
    for (const s of this.stones) {
      if (s.resting || s.life > 1.5) continue;
      for (let i = 0; i < s.trail.length - 1 && seg < 64; i++, seg++) {
        this.trailPos.set([s.trail[i].x, s.trail[i].y, s.trail[i].z, s.trail[i + 1].x, s.trail[i + 1].y, s.trail[i + 1].z], seg * 6);
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
