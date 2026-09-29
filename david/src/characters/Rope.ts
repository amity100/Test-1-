import * as THREE from 'three';

const _t = new THREE.Vector3();
const _n = new THREE.Vector3();
const _b = new THREE.Vector3();
const _pt = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * A thin dynamic tube through a list of points (sling cords, thongs). Vertices are rewritten by `update()`;
 * frames are parallel-transported along the curve (no twisting / pinching where the cord bends), with an optional
 * Catmull-Rom subdivision between the control points so a few simulated points still give a smooth braid.
 * uv.x runs around the tube (0..1), uv.y along it (0..1): the braid texture of the wardrobe cord material expects that.
 */
export class Rope {
  readonly mesh: THREE.Mesh;
  /** control points, in the space of the mesh's parent (world space for the sling) */
  readonly points: THREE.Vector3[];
  private geo: THREE.BufferGeometry;
  private samples: THREE.Vector3[];
  private readonly rings: number;

  constructor(count: number, private radius: number, material: THREE.Material, private radial = 6, private sub = 2) {
    this.points = Array.from({ length: count }, () => new THREE.Vector3());
    this.rings = (count - 1) * sub + 1;
    this.samples = Array.from({ length: this.rings }, () => new THREE.Vector3());
    const R = radial + 1; // duplicated seam column for continuous uvs
    const verts = this.rings * R;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const uv = new Float32Array(verts * 2);
    const idx: number[] = [];
    for (let i = 0; i < this.rings; i++) {
      for (let j = 0; j < R; j++) {
        uv[(i * R + j) * 2] = j / radial;
        uv[(i * R + j) * 2 + 1] = i / (this.rings - 1);
        if (i < this.rings - 1 && j < radial) {
          const a = i * R + j, b = a + 1, c = a + R, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
    }
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  private catmull(i: number, u: number, out: THREE.Vector3) {
    const P = this.points, n = P.length;
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[Math.min(n - 1, i + 1)], p3 = P[Math.min(n - 1, i + 2)];
    const u2 = u * u, u3 = u2 * u;
    const a = -0.5 * u3 + u2 - 0.5 * u, b = 1.5 * u3 - 2.5 * u2 + 1, c = -1.5 * u3 + 2 * u2 + 0.5 * u, d = 0.5 * u3 - 0.5 * u2;
    out.set(
      p0.x * a + p1.x * b + p2.x * c + p3.x * d,
      p0.y * a + p1.y * b + p2.y * c + p3.y * d,
      p0.z * a + p1.z * b + p2.z * c + p3.z * d,
    );
  }

  /** Rebuild the tube from `points`. `taper` narrows the last ring (0..1) e.g. for a frayed free end. */
  update(taper = 0) {
    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const nor = this.geo.getAttribute('normal') as THREE.BufferAttribute;
    const S = this.samples, n = this.points.length, sub = this.sub;
    let k = 0;
    for (let i = 0; i < n - 1; i++) for (let s = 0; s < sub; s++) this.catmull(i, s / sub, S[k++]);
    S[k].copy(this.points[n - 1]);
    const R = this.radial + 1;
    // initial frame
    _t.subVectors(S[1], S[0]);
    if (_t.lengthSq() < 1e-12) _t.set(0, -1, 0);
    _t.normalize();
    _n.set(0, 1, 0);
    if (Math.abs(_t.y) > 0.9) _n.set(1, 0, 0);
    _b.crossVectors(_t, _n).normalize();
    _n.crossVectors(_b, _t).normalize();
    for (let i = 0; i < this.rings; i++) {
      if (i > 0) {
        // parallel transport: rotate the frame by the change of tangent
        _pt.subVectors(S[Math.min(this.rings - 1, i + 1)], S[i - 1]);
        if (_pt.lengthSq() > 1e-12) {
          _pt.normalize();
          _q.setFromUnitVectors(_t, _pt);
          _n.applyQuaternion(_q);
          _b.applyQuaternion(_q);
          _t.copy(_pt);
        }
      }
      const r = this.radius * (taper > 0 ? 1 - taper * Math.max(0, (i / (this.rings - 1) - 0.85) / 0.15) : 1);
      const p = S[i];
      for (let j = 0; j < R; j++) {
        const ang = (j / this.radial) * Math.PI * 2;
        const c = Math.cos(ang), s = Math.sin(ang);
        const nx = _n.x * c + _b.x * s, ny = _n.y * c + _b.y * s, nz = _n.z * c + _b.z * s;
        const v = i * R + j;
        pos.setXYZ(v, p.x + nx * r, p.y + ny * r, p.z + nz * r);
        nor.setXYZ(v, nx, ny, nz);
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
  }
}
