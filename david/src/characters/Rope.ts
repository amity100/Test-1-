import * as THREE from 'three';

/** A thin dynamic tube through a list of points (sling cords, straps). Vertices are rewritten each update. */
export class Rope {
  readonly mesh: THREE.Mesh;
  readonly points: THREE.Vector3[];
  private geo: THREE.BufferGeometry;
  private radial = 4;

  constructor(count: number, private radius: number, material: THREE.Material) {
    this.points = Array.from({ length: count }, () => new THREE.Vector3());
    const verts = count * this.radial;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const uv = new Float32Array(verts * 2);
    const idx: number[] = [];
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < this.radial; j++) {
        uv[(i * this.radial + j) * 2] = j / this.radial;
        uv[(i * this.radial + j) * 2 + 1] = i / (count - 1);
        if (i < count - 1) {
          const a = i * this.radial + j;
          const b = i * this.radial + ((j + 1) % this.radial);
          const c = a + this.radial;
          const d = b + this.radial;
          idx.push(a, c, b, b, c, d);
        }
      }
    }
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
  }

  /** Rebuild the tube from `points` (given in the mesh's parent space). */
  update() {
    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const nor = this.geo.getAttribute('normal') as THREE.BufferAttribute;
    const n = this.points.length;
    const t = new THREE.Vector3();
    const u = new THREE.Vector3();
    const v = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3(1, 0, 0);
    for (let i = 0; i < n; i++) {
      const p = this.points[i];
      const a = this.points[Math.max(0, i - 1)];
      const b = this.points[Math.min(n - 1, i + 1)];
      t.subVectors(b, a);
      if (t.lengthSq() < 1e-10) t.set(0, 1, 0);
      t.normalize();
      u.crossVectors(t, Math.abs(t.y) > 0.9 ? side : up).normalize();
      v.crossVectors(t, u).normalize();
      for (let j = 0; j < this.radial; j++) {
        const ang = (j / this.radial) * Math.PI * 2;
        const c = Math.cos(ang), s = Math.sin(ang);
        const nx = u.x * c + v.x * s, ny = u.y * c + v.y * s, nz = u.z * c + v.z * s;
        const k = i * this.radial + j;
        pos.setXYZ(k, p.x + nx * this.radius, p.y + ny * this.radius, p.z + nz * this.radius);
        nor.setXYZ(k, nx, ny, nz);
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
  }
}
