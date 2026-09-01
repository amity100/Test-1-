import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Turning a thousand little meshes into a handful of big ones.
 *
 * Every landmark in this city is hand-built out of boxes and cylinders, which
 * is what makes it look like the place it is — and every one of those boxes was
 * its own draw call. The finished city came to twenty thousand meshes, and a
 * phone comfortably draws a few hundred: hence "מאוד איטי בפלאפון".
 *
 * A landmark is scenery, though. Almost none of it moves. So after it is built,
 * everything static is welded together by material into one mesh per material —
 * one call for all the stone, one for all the glass, one for every lit window —
 * and only the parts that actually move are left as themselves.
 *
 * Which parts move is *measured*, not guessed: the landmark's own animation is
 * run at several different times and anything whose matrix or colour shifts is
 * excluded from the weld. That way a beacon keeps blinking, a fountain keeps
 * turning and a train keeps arriving, without anybody having to remember to
 * declare them.
 */

type Tick = (t: number, st: { mine: boolean; off: boolean; dark: boolean; attention: number; busy: number }) => void;

/**
 * The states to try when looking for what moves.
 *
 * Some things only move once the place is mine — a door that breathes, a sign
 * that pulses when a job is running. Testing only the quiet state would weld
 * those shut, and the animation would go on running on a mesh nobody draws. So
 * every state the game can put a place in gets tried.
 */
const STATES = [
  { mine: false, off: false, dark: false, attention: 0, busy: 0 },
  { mine: true, off: false, dark: false, attention: 3, busy: 1 },
  { mine: false, off: true, dark: true, attention: 0, busy: 0 },
];
const STILL = STATES[0];

/** Everything under this object that is a mesh with a real geometry. */
function meshesIn(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) out.push(m);
  });
  return out;
}

/**
 * A cheap fingerprint of where a mesh is and what colour it is.
 *
 * The *world* matrix, not the local one: plenty of landmarks move a whole
 * group — a car, a crane, a train — and every mesh inside it keeps its own
 * local matrix unchanged while sliding down the road. Fingerprinting the local
 * matrix called all of those still and welded them to the pavement.
 */
function stamp(m: THREE.Mesh): string {
  const mat = m.material as THREE.Material & { color?: THREE.Color; opacity?: number };
  return `${m.matrixWorld.elements.map((n) => n.toFixed(3)).join(',')}|`
    + `${mat.color ? mat.color.getHexString() : ''}|${mat.opacity ?? ''}|${m.visible}`;
}

/**
 * Weld a built landmark down to as few meshes as it can honestly become.
 *
 * `glow` is the list of lit surfaces the game tints as the place is taken; they
 * are welded too, into a single mesh, which is returned in place of the list —
 * one mesh to tint instead of a hundred.
 */
export interface Baked {
  /** The lit surfaces, welded: one mesh to tint instead of a hundred. */
  glowParts: THREE.Mesh[];
  /**
   * Everything that moves, gathered under one switch.
   *
   * A blinking lamp two kilometres away is half a pixel, and the country is
   * three kilometres long. Sixty-five places each keeping their cars and waves
   * and beacons awake is most of the frame spent on things nobody can see, so
   * the world turns this group off for anywhere it is not looking at.
   */
  movers: THREE.Group;
}

export function bake(group: THREE.Group, glow: THREE.Mesh[], ticks: Tick[]): Baked {
  // Find what moves, by moving it.
  const all = meshesIn(group);
  group.updateMatrixWorld(true);
  const before = all.map(stamp);
  const moving = new Set<THREE.Mesh>();
  for (const t of [0.7, 3.1, 9.4, 21.8, 47.3]) {
    for (const st of STATES) for (const f of ticks) f(t, st);
    group.updateMatrixWorld(true);
    const now = all.map(stamp);
    all.forEach((m, i) => { if (now[i] !== before[i]) moving.add(m); });
  }
  // Put everything back where it started, so the city does not boot mid-animation.
  for (const f of ticks) f(0, STILL);
  group.updateMatrixWorld(true);

  const glowSet = new Set(glow);
  const byMaterial = new Map<THREE.Material, THREE.Mesh[]>();
  const glowParts: THREE.Mesh[] = [];

  for (const m of all) {
    // Anything the game holds a reference to and moves, hides or shoots a ray
    // at stays exactly where it is. `keep` is the way to say so out loud, for
    // the cases the moving-parts sweep above cannot see.
    if (moving.has(m) || m.userData.keep) { if (glowSet.has(m)) glowParts.push(m); continue; }
    const mat = m.material as THREE.Material;
    if (Array.isArray(m.material)) continue;
    const key = glowSet.has(m) ? (mat as THREE.Material) : mat;
    const list = byMaterial.get(key) ?? [];
    list.push(m);
    byMaterial.set(key, list);
  }

  for (const [mat, list] of byMaterial) {
    if (list.length < 2) {
      if (glowSet.has(list[0])) glowParts.push(list[0]);
      continue;
    }
    const geos: THREE.BufferGeometry[] = [];
    group.updateMatrixWorld(true);
    const intoGroup = group.matrixWorld.clone().invert();
    for (const m of list) {
      m.updateMatrixWorld(true);
      const g = m.geometry.clone();
      // Everything is welded in the landmark's own space, so the merged mesh
      // can sit at the origin of the group exactly as the pieces did.
      g.applyMatrix4(intoGroup.clone().multiply(m.matrixWorld));
      // Merging needs the same attributes everywhere; uv2 and colour rarely match.
      for (const name of Object.keys(g.attributes)) {
        if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      }
      if (!g.attributes.uv) {
        const n = g.attributes.position.count;
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      }
      if (!g.attributes.normal) g.computeVertexNormals();
      geos.push(g);
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;

    const one = new THREE.Mesh(merged, mat);
    one.castShadow = list[0].castShadow;
    one.receiveShadow = list[0].receiveShadow;
    // Baked pieces are already in the group's space.
    one.matrixAutoUpdate = false;
    group.add(one);
    for (const m of list) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    if (glowSet.has(list[0])) glowParts.push(one);
  }

  // Gather the moving parts under one switch. Only whole branches move across:
  // a branch with a still mesh in it would leave that mesh behind when the
  // group is switched off, and a crane would lose its tower along with its hook.
  const movers = new THREE.Group();
  movers.name = 'moves';
  for (const child of [...group.children]) {
    if (child === movers) continue;
    const under = meshesIn(child);
    if (!under.length || under.some((m) => !moving.has(m) || m.userData.keep)) continue;
    movers.add(child);
  }
  group.add(movers);

  return { glowParts, movers };
}
