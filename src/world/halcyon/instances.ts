import * as THREE from 'three';
import { Builder, V, rng } from '../tower/kit';
import { leafCard } from './kit';
import { SUN_DIR } from './layout';
import { LEAF } from './textures';

/**
 * Street furniture templates: one geometry per part (a lamp's shaft, head and
 * glass; a tree's trunk and crown...), placed into the chunk's own merged
 * geometry (no extra draw per part: a chunk's lamps and trees cost nothing
 * beyond its material buckets). Templates: origin at the foot, +Y up, facing +Z.
 */
export interface Part {
  geo: THREE.BufferGeometry;
  key: string;
  cast: boolean;
  /** Few of them: merged into the chunk's own geometry instead (saves a draw). */
  merge: boolean;
  /** Parts placed with it, same transform and tint (a crown's solid core). */
  with?: string[];
}

/** Parts drawn as instanced meshes (one draw each per chunk) rather than merged: none now, merging is cheaper in draws. */
const INSTANCED = new Set<string>();

const WARM = new THREE.Color(3.2, 2.05, 1.0);

/** Every part the city places, built once per level (fewer segments on phones). */
export function makeParts(mobile: boolean): Record<string, Part> {
  const seg = mobile ? 6 : 10;
  const parts: Record<string, Part> = {};
  const one = (name: string, key: string, cast: boolean, draw: (b: Builder) => void) => {
    const b = new Builder();
    draw(b);
    const geo = b.take(key);
    if (!geo) throw new Error(`empty part ${name}`);
    parts[name] = { geo, key, cast, merge: !INSTANCED.has(name) };
  };
  const iron = 0x20252d, gilt = 0xc9a24a;

  // ---- street lamp: plinth, a shaft (1 m, scaled to height), the lantern head and its glass
  const ls = mobile ? 6 : 8;
  // (base and shaft cast: the chunk's 'iron' bucket; the ornate head doesn't)
  one('lampBase', 'iron', true, (b) => {
    b.cylinder('iron', V(0, 0, 0), V(0, 0.18, 0), 0.26, iron, ls, 1, false, 0.24);
    b.cylinder('iron', V(0, 0.18, 0), V(0, 0.55, 0), 0.2, iron, ls, 1, true, 0.12);
    if (!mobile) b.cylinder('iron', V(0, 0.5, 0), V(0, 0.58, 0), 0.15, gilt, ls, 1, false);
  });
  one('lampShaft', 'iron', true, (b) => b.cylinder('iron', V(0, 0, 0), V(0, 1, 0), 0.075, iron, ls, 1, false, 0.065));
  one('lampHead', 'metal', true, (b) => {
    b.cylinder('metal', V(0, 0, 0), V(0, 0.12, 0), 0.11, gilt, ls, 1, false, 0.08);
    b.cylinder('metal', V(0, 0.12, 0), V(0, 0.18, 0), 0.24, iron, ls, 1, true, 0.2);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b.box('metal', x * 0.19 - 0.02, 0.18, z * 0.19 - 0.02, x * 0.19 + 0.02, 0.78, z * 0.19 + 0.02, iron, 1, { ao: 0 });
    b.cylinder('metal', V(0, 0.78, 0), V(0, 1.08, 0), 0.05, iron, ls, 1, true, 0.32);
    b.cylinder('metal', V(0, 1.08, 0), V(0, 1.24, 0), 0.025, gilt, 6, 1, false, 0.05);
  });
  one('lampGlass', 'emissive', false, (b) => b.cylinder('emissive', V(0, 0.18, 0), V(0, 0.78, 0), 0.16, WARM, mobile ? 4 : 8, 1, true, 0.19));
  // hanging lantern (origin at its ring) and a 1 m chain
  one('lanternHang', 'metal', true, (b) => {
    b.cylinder('metal', V(0, -0.1, 0), V(0, 0, 0), 0.05, gilt, 6, 1, true);
    b.cylinder('metal', V(0, -0.34, 0), V(0, -0.1, 0), 0.3, iron, 8, 1, true, 0.06);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b.box('metal', x * 0.22 - 0.02, -1.0, z * 0.22 - 0.02, x * 0.22 + 0.02, -0.34, z * 0.22 + 0.02, iron, 1, { ao: 0 });
    b.cylinder('metal', V(0, -1.08, 0), V(0, -1.0, 0), 0.2, iron, 8, 1, true, 0.28);
    b.cylinder('metal', V(0, -1.3, 0), V(0, -1.08, 0), 0.02, gilt, 6, 1, true, 0.12);
  });
  one('lanternGlass', 'emissive', false, (b) => b.cylinder('emissive', V(0, -1.0, 0), V(0, -0.34, 0), 0.19, WARM, mobile ? 4 : 8, 1, true, 0.2));
  one('chain', 'metal', false, (b) => b.box('metal', -0.02, 0, -0.02, 0.02, 1, 0.02, iron, 1, { ao: 0 }));

  // ---- gilt bollard (0.6 m) that marks a deliberate throw edge
  one('bollard', 'metal', true, (b) => {
    const s8 = mobile ? 6 : 8;
    b.cylinder('metal', V(0, 0, 0), V(0, 0.46, 0), 0.17, gilt, s8, 1, false, 0.15);
    if (!mobile) b.cylinder('metal', V(0, 0.46, 0), V(0, 0.52, 0), 0.19, gilt, s8, 1, false);
    b.cylinder('metal', V(0, 0.52, 0), V(0, 0.66, 0), 0.19, gilt, s8, 1, false, 0.02);
  });

  // ---- red maple: trunk with three limbs, a crown of faceted leaf clumps
  one('treeTrunk', 'paint', true, (b) => {
    const bark = 0x4a3a2e;
    b.cylinder('paint', V(0, 0, 0), V(0, 2.3, 0), 0.16, bark, 6, 1, false, 0.1);
    b.beam('paint', V(0, 1.8, 0), V(0.7, 3.0, 0.2), 0.1, 0.1, bark);
    b.beam('paint', V(0, 1.9, 0), V(-0.6, 3.1, 0.4), 0.1, 0.1, bark);
    b.beam('paint', V(0, 2.1, 0), V(0.1, 3.3, -0.7), 0.1, 0.1, bark);
  });
  // (crowns: alpha-cut leaf cards scattered through an ellipsoid, normals outward from its centre so the crown
  // shades as one soft mass, lighter on top; red maples and green limes)
  // (a maple's sun-side cards warm toward this: the concept's glowing red canopies)
  const SUNLIT = new THREE.Color(0xd8452a);
  const crown = (b: Builder, seed: number, hue: () => THREE.Color, rx: number, ry: number, cy: number, sunTint = 0) => {
    const r = rng(seed);
    const cards = mobile ? 12 : 26;
    const C = V(0, cy, 0);
    for (let i = 0; i < cards; i++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2;
      const d = 0.45 + 0.55 * Math.sqrt(r());
      const p = V(Math.sqrt(1 - u * u) * Math.cos(a) * rx * d, cy + u * ry * d, Math.sqrt(1 - u * u) * Math.sin(a) * rx * d);
      const s = (1.3 + r() * 0.7) * (0.8 + 0.2 * d);
      // a card facing roughly outward, turned at random about that direction
      const f = p.clone().sub(C).normalize().add(V(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9)).normalize();
      let rt = V(0, 1, 0).cross(f);
      if (rt.lengthSq() < 1e-4) rt = V(1, 0, 0);
      rt.normalize();
      const up = f.clone().cross(rt).normalize();
      const spin = r() * Math.PI;
      const R = rt.clone().multiplyScalar(Math.cos(spin)).addScaledVector(up, Math.sin(spin));
      const U = f.clone().cross(R).normalize();
      const P = [p.clone().addScaledVector(R, -s / 2).addScaledVector(U, -s / 2), p.clone().addScaledVector(R, s / 2).addScaledVector(U, -s / 2), p.clone().addScaledVector(R, s / 2).addScaledVector(U, s / 2), p.clone().addScaledVector(R, -s / 2).addScaledVector(U, s / 2)];
      const N = P.map((q) => q.clone().sub(C).multiply(V(1 / rx, 1 / ry, 1 / rx)).add(V(0, 0.35, 0)).normalize());
      const tint = hue();
      if (sunTint > 0) tint.lerp(SUNLIT, sunTint * Math.max(0, p.clone().sub(C).normalize().dot(SUN_DIR)));
      leafCard(b, P, N, LEAF.clump, tint, true, (q) => 0.72 + 0.3 * THREE.MathUtils.clamp((q.y - cy) / ry + 0.5, 0, 1));
    }
  };
  // a solid leafy core inside each crown (0.7 of its size): no sky shows through the cards' gaps
  // (bright vertex colours: the leafy map under them is a mid grey)
  const core = (name: string, color: THREE.Color, rx: number, ry: number, cy: number) =>
    one(name, 'leaves', true, (b) => {
      const g = new THREE.IcosahedronGeometry(1, mobile ? 0 : 1).scale(rx * 0.7, ry * 0.7, rx * 0.7).translate(0, cy, 0);
      b.geo('leaves', g, color);
      g.dispose();
    });
  core('treeCoreRed', new THREE.Color().setRGB(1.9, 0.18, 0.08), 1.55, 1.15, 3.75);
  core('treeCoreGreen', new THREE.Color().setRGB(0.45, 0.85, 0.28), 1.4, 1.35, 3.9);
  one('treeCrown', 'foliage', true, (b) => {
    const r = rng(17);
    crown(b, 17, () => new THREE.Color().setHSL(0.005 + r() * 0.035, 0.78, 0.36 + r() * 0.14), 1.55, 1.15, 3.75, 0.6);
  });
  parts.treeCrown.with = ['treeCoreRed'];
  one('treeGreen', 'foliage', true, (b) => {
    const r = rng(23);
    crown(b, 23, () => new THREE.Color().setHSL(0.2 + r() * 0.08, 0.5, 0.28 + r() * 0.12), 1.4, 1.35, 3.9);
  });
  parts.treeGreen.with = ['treeCoreGreen'];
  // flowers in a box (window boxes, balconies)
  one('flowers', 'foliage', false, (b) => {
    const n = [V(0, 1, 0), V(0, 1, 0), V(0, 1, 0), V(0, 1, 0)];
    for (const [a, s] of [[0, 0.7], [Math.PI / 2, 0.7], [Math.PI / 4, 0.6]]) {
      const R = V(Math.cos(a), 0, Math.sin(a)).multiplyScalar(s / 2);
      leafCard(b, [V(-R.x, 0, -R.z), V(R.x, 0, R.z), V(R.x, s * 0.8, R.z), V(-R.x, s * 0.8, -R.z)], n, LEAF.flowers, 0xffffff, true);
    }
  });

  // ---- café furniture: a bistro table, a chair, a striped parasol
  one('cafeTable', 'metal', true, (b) => {
    b.cylinder('metal', V(0, 0.7, 0), V(0, 0.75, 0), 0.4, 0xd8cdb4, seg, 1, true);
    b.cylinder('metal', V(0, 0.04, 0), V(0, 0.7, 0), 0.035, iron, 6, 1, false);
    b.cylinder('metal', V(0, 0, 0), V(0, 0.04, 0), 0.24, iron, 6, 1, true);
  });
  one('chair', 'metal', true, (b) => {
    b.box('metal', -0.2, 0.44, -0.2, 0.2, 0.47, 0.2, 0x8e1c18, 1, { ao: 0 });
    // (legs as two thin frames, a hooped back)
    for (const z of [-0.17, 0.15]) {
      b.box('metal', -0.18, 0, z, -0.15, 0.44, z + 0.03, iron, 1, { ao: 0, skipBottom: true });
      b.box('metal', 0.15, 0, z, 0.18, 0.44, z + 0.03, iron, 1, { ao: 0, skipBottom: true });
    }
    for (const x of [-0.18, 0.15]) b.box('metal', x, 0.47, 0.15, x + 0.03, 0.9, 0.18, iron, 1, { ao: 0 });
    b.box('metal', -0.18, 0.74, 0.15, 0.18, 0.9, 0.18, iron, 1, { ao: 0 });
  });
  one('parasol', 'paint', true, (b) => {
    const n = mobile ? 8 : 12, R = 1.6, top = 2.75, rim = 2.25;
    b.cylinder('paint', V(0, 0, 0), V(0, top + 0.15, 0), 0.03, 0xd8cdb4, 6, 1, false);
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      const c = k % 2 ? 0xefe3cc : 0xa8281f;
      const p0 = V(Math.cos(a0) * R, rim, Math.sin(a0) * R), p1 = V(Math.cos(a1) * R, rim, Math.sin(a1) * R);
      const apex = V(0, top, 0);
      // (a triangle each side: the canopy is seen from above and from under it)
      b.quad('paint', p1, p0, apex, apex, c);
      b.quad('paint', p0, p1, apex, apex, new THREE.Color(c).multiplyScalar(0.55));
      // valance
      b.quad('paint', V(p1.x, rim - 0.22, p1.z), V(p0.x, rim - 0.22, p0.z), p0, p1, c);
    }
  });

  // ---- park bench: timber slats on cast-iron ends (1.8 m along X)
  one('benchWood', 'paint', true, (b) => {
    for (let k = 0; k < 3; k++) b.box('paint', -0.9, 0.42, -0.22 + k * 0.15, 0.9, 0.46, -0.1 + k * 0.15, 0x7a4a2c, 1, { ao: 0 });
    for (let k = 0; k < 2; k++) b.box('paint', -0.9, 0.58 + k * 0.16, 0.2, 0.9, 0.68 + k * 0.16, 0.24, 0x7a4a2c, 1, { ao: 0 });
  });
  one('benchIron', 'metal', true, (b) => {
    for (const x of [-0.8, 0.8]) {
      b.box('metal', x - 0.03, 0, -0.24, x + 0.03, 0.42, -0.18, iron, 1, { ao: 0 });
      b.box('metal', x - 0.03, 0, 0.18, x + 0.03, 0.9, 0.24, iron, 1, { ao: 0 });
      b.box('metal', x - 0.03, 0.38, -0.24, x + 0.03, 0.42, 0.24, iron, 1, { ao: 0 });
    }
  });

  // ---- a stone urn on a roof balustrade, with a little trailing ivy
  one('urn', 'trim', false, (b) => {
    const prof = [
      [0.0, 0], [0.2, 0], [0.2, 0.1], [0.12, 0.16], [0.1, 0.24], [0.26, 0.38], [0.3, 0.55], [0.22, 0.68], [0.28, 0.72], [0.28, 0.78], [0.0, 0.78],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(prof, seg);
    b.geo('trim', g, 0xefe5d0);
    g.dispose();
  });

  // ---- brazier: a bronze bowl on three legs (the low flame is its own part)
  one('brazier', 'metal', true, (b) => {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      b.beam('metal', V(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45), V(Math.cos(a) * 0.2, 0.8, Math.sin(a) * 0.2), 0.05, 0.05, 0x6e5034);
    }
    const bowl = new THREE.SphereGeometry(0.5, seg, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, 1.15, 0);
    b.geo('metal', bowl, 0x8a6a3e);
    bowl.dispose();
  });
  one('flame', 'emissive', false, (b) => {
    const g = new THREE.ConeGeometry(0.32, 0.55, 5).translate(0, 1.4, 0);
    b.geo('emissive', g, new THREE.Color(2.2, 1.0, 0.3));
    g.dispose();
  });
  return parts;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _y = new THREE.Vector3(0, 1, 0);

/**
 * Collects the parts placed in one chunk: build() makes one InstancedMesh per
 * instanced part used; merged parts go straight into the chunk's builder.
 */
export class Instancer {
  private sets = new Map<string, { m: number[]; c: number[] | null }>();
  constructor(private parts: Record<string, Part>, private mb: Builder) {}

  /** Place `name` at (x, y, z) turned by `yaw` about +Y, scaled (sxz across, sy up); optional tint. */
  add(name: string, x: number, y: number, z: number, yaw = 0, sy = 1, sxz = 1, tint?: THREE.ColorRepresentation) {
    const part = this.parts[name];
    if (!part) throw new Error(`no part ${name}`);
    // (companions first: they share the scratch matrix)
    for (const w of part.with ?? []) this.add(w, x, y, z, yaw, sy, sxz, tint);
    _q.setFromAxisAngle(_y, yaw);
    _m.compose(_p.set(x, y, z), _q, _s.set(sxz, sy, sxz));
    if (part.merge) {
      this.mb.geoColored(part.key, part.geo, _m, tint);
      return;
    }
    let s = this.sets.get(name);
    if (!s) this.sets.set(name, (s = { m: [], c: null }));
    const n = s.m.length / 16;
    s.m.push(..._m.elements);
    if (tint !== undefined || s.c) {
      if (!s.c) s.c = new Array(n * 3).fill(1);
      const c = new THREE.Color(tint ?? 0xffffff);
      s.c.push(c.r, c.g, c.b);
    }
  }

  get count() {
    let n = 0;
    for (const s of this.sets.values()) n += s.m.length / 16;
    return n;
  }

  build(materials: Record<string, THREE.Material>, name: string) {
    const g = new THREE.Group();
    g.name = name;
    for (const [part, s] of this.sets) {
      const p = this.parts[part];
      const n = s.m.length / 16;
      const im = new THREE.InstancedMesh(p.geo, materials[p.key], n);
      im.instanceMatrix.array.set(s.m);
      if (s.c) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(s.c), 3);
      im.computeBoundingSphere();
      im.castShadow = p.cast;
      im.receiveShadow = true;
      im.name = `${name}:${part}`;
      g.add(im);
    }
    this.sets.clear();
    return g;
  }
}
