import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export interface PartBuilderOptions {
  /** Texture repeats per metre; when set, UVs are box-projected in model space for even texel density. */
  uvDensity?: number;
  /** Emit skinIndex/skinWeight attributes (rigid, one bone per part) for skinned meshes. */
  skinned?: boolean;
}

const KEEP_ATTRS = new Set(['position', 'normal', 'uv']);
const tmpN = new THREE.Vector3();

/**
 * Collects many small parts and merges them into one geometry per material key, so a detailed model
 * costs a handful of draw calls instead of dozens. Keys are opaque (material names or objects), which
 * lets geometry be cached independently of per-team materials.
 */
export class PartBuilder<K = string> {
  private groups = new Map<K, THREE.BufferGeometry[]>();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpE = new THREE.Euler();
  private tmpS = new THREE.Vector3();
  private tmpP = new THREE.Vector3();
  private boneIndex = 0;

  constructor(private readonly opts: PartBuilderOptions = {}) {}

  /** Bone index applied to parts added after this call (skinned builders only). */
  bone(i: number): this {
    this.boneIndex = i;
    return this;
  }

  part(geo: THREE.BufferGeometry, key: K, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): this {
    this.tmpQ.setFromEuler(this.tmpE.set(rx, ry, rz));
    this.tmpM.compose(this.tmpP.set(x, y, z), this.tmpQ, this.tmpS.set(sx, sy, sz));
    return this.partM(geo, key, this.tmpM);
  }

  /** Adds a copy of `geo` transformed by `m`. */
  partM(geo: THREE.BufferGeometry, key: K, m: THREE.Matrix4): this {
    const g = geo.index ? geo.clone() : geo.clone();
    if (g.index === null) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
    for (const name of Object.keys(g.attributes)) if (!KEEP_ATTRS.has(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(m);
    if (this.opts.uvDensity) this.projectUVs(g, this.opts.uvDensity);
    else if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (this.opts.skinned) {
      const n = g.attributes.position.count;
      const idx = new Uint16Array(n * 4);
      const w = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        idx[i * 4] = this.boneIndex;
        w[i * 4] = 1;
      }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4));
    }
    let list = this.groups.get(key);
    if (!list) {
      list = [];
      this.groups.set(key, list);
    }
    list.push(g);
    return this;
  }

  /** Part aligned from point a to point b (Y axis of the geometry maps to the segment, scaled to its length). */
  between(geo: THREE.BufferGeometry, key: K, a: THREE.Vector3, b: THREE.Vector3, thickness = 1): this {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(thickness, len, thickness));
    return this.partM(geo, key, m);
  }

  /** Capsule with true hemispherical caps from a to b (optionally pre-multiplied by `frame`). */
  capsule(key: K, a: THREE.Vector3, b: THREE.Vector3, r: number, frame?: THREE.Matrix4, radial = 12, caps = 4): this {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), len > 1e-6 ? dir.clone().normalize() : new THREE.Vector3(0, 1, 0));
    const geo = new THREE.CapsuleGeometry(r, Math.max(0, len - 2 * r), caps, radial);
    const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
    if (frame) m.premultiply(frame);
    this.partM(geo, key, m);
    geo.dispose();
    return this;
  }

  private projectUVs(g: THREE.BufferGeometry, density: number): void {
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      tmpN.fromBufferAttribute(nor, i);
      const ax = Math.abs(tmpN.x);
      const ay = Math.abs(tmpN.y);
      const az = Math.abs(tmpN.z);
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      let u: number;
      let v: number;
      if (ax >= ay && ax >= az) {
        u = z;
        v = y;
      } else if (ay >= az) {
        u = x;
        v = z;
      } else {
        u = x;
        v = y;
      }
      uv[i * 2] = u * density;
      uv[i * 2 + 1] = v * density;
    }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  }

  /** Merges every group into one geometry per key and resets the builder. */
  merge(): Map<K, THREE.BufferGeometry> {
    const out = new Map<K, THREE.BufferGeometry>();
    for (const [key, geos] of this.groups) {
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      out.set(key, merged);
    }
    this.groups.clear();
    return out;
  }

  /** Merges and creates one mesh per key under `parent`. */
  build(parent: THREE.Object3D, materialFor: (key: K) => THREE.Material, shadows = true): THREE.Mesh[] {
    return meshesFrom(this.merge(), parent, materialFor, shadows);
  }
}

export function meshesFrom<K>(geos: Map<K, THREE.BufferGeometry>, parent: THREE.Object3D, materialFor: (key: K) => THREE.Material, shadows = true): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  for (const [key, geo] of geos) {
    const mesh = new THREE.Mesh(geo, materialFor(key));
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.name = String(key);
    parent.add(mesh);
    out.push(mesh);
  }
  return out;
}

/** Creates skinned meshes (one per key) bound to a shared skeleton. Bones must already be in the scene graph with rest transforms. */
export function skinnedMeshesFrom<K>(geos: Map<K, THREE.BufferGeometry>, parent: THREE.Object3D, skeleton: THREE.Skeleton, materialFor: (key: K) => THREE.Material, shadows = true): THREE.SkinnedMesh[] {
  const out: THREE.SkinnedMesh[] = [];
  parent.updateMatrixWorld(true);
  for (const [key, geo] of geos) {
    const mesh = new THREE.SkinnedMesh(geo, materialFor(key));
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.frustumCulled = false;
    mesh.name = String(key);
    parent.add(mesh);
    mesh.updateMatrixWorld(true);
    mesh.bind(skeleton, mesh.matrixWorld);
    out.push(mesh);
  }
  return out;
}

/** Shared primitive geometries (unit-sized; scaled per part). */
export const PRIM = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 18),
  cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cone: new THREE.ConeGeometry(0.5, 1, 14),
  sphere: new THREE.SphereGeometry(0.5, 16, 12),
  sphereLo: new THREE.SphereGeometry(0.5, 10, 8),
  hemi: new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  torus: new THREE.TorusGeometry(0.5, 0.08, 8, 24),
  torusThin: new THREE.TorusGeometry(0.5, 0.04, 6, 20),
  /** Half cylinder (curved face toward -Z), unit radius/height. */
  halfCyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, false, Math.PI / 2, Math.PI),
};

/** Rounded box with bevelled edges (armour plates, receivers). */
export function rbox(w: number, h: number, d: number, r: number, segments = 2): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, segments, Math.min(r, Math.min(w, h, d) * 0.499));
}

/** Lathe (revolved) surface from a radius profile: pairs of [radius, y]. */
export function lathe(profile: Array<[number, number]>, segments = 16): THREE.BufferGeometry {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  return new THREE.LatheGeometry(pts, segments);
}

/** Tapered cylinder / frustum along Y, height 1, centred. */
export function frustum(rTop: number, rBottom: number, segments = 14): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rTop, rBottom, 1, segments);
}

/** Shallow extruded plate with bevelled rim, centred, thickness along Z. */
export function plate(w: number, h: number, d: number, corner = 0.02, bevel = Math.min(0.01, d * 0.3)): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.min(corner, hw * 0.9, hh * 0.9);
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  const depth = Math.max(0.001, d - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Extruded polygon (XY outline) with thickness along Z, centred on Z. */
export function poly(points: Array<[number, number]>, d: number, bevel = 0): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const depth = Math.max(0.001, d - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, bevel > 0 ? { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 3 } : { depth, bevelEnabled: false, curveSegments: 3 });
  g.translate(0, 0, -depth / 2);
  return g;
}
