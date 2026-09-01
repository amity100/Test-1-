import * as THREE from 'three';
import { RNG } from '../core/rng';
import type { Area } from '../game/types';

/**
 * The country the districts stand in.
 *
 * The city block is Tel Aviv and it is drawn in detail: roads, pavements, palm
 * trees, the sea two blocks west. It also, as generated, covered eight hundred
 * metres in every direction — which meant Haifa, Be'er Sheva and Eilat were
 * being drawn as more Tel Aviv street, and flying to any of them landed the
 * camera on an identical corner of the same city. That is the "נקודה לא קשורה"
 * the player kept arriving at: every district looked like the one he left.
 *
 * So everywhere outside the home city gets ground of its own. Each district is
 * a plate of its own colour with its own approach roads, sized to hold what is
 * in it, and between them is open country — dark scrub in the south, hills in
 * the north — so that flying from one to the next is a journey across a place
 * rather than a jump between two identical corners.
 */

/** How far the detailed Tel Aviv block reaches. Beyond this is country. */
export const CITY_REACH = 2600;

const GROUND = 0x14181c;

/** What a district's floor is made of, by what sort of district it is. */
function floorOf(kind: Area['kind']): number {
  switch (kind) {
    case 'homes': return 0x2a2723;
    case 'work': return 0x24282d;
    case 'cold': return 0x1f2429;
    case 'study': return 0x1f2a24;
    case 'moving': return 0x26282b;
    case 'talking': return 0x2a2630;
    case 'city': return 0x2b2a26;
    case 'water': return 0x1b2830;
    case 'power': return 0x2c2622;
    default: return 0x24282d;
  }
}

export interface Land {
  group: THREE.Group;
  /** Where each district's ground sits, for the camera and the labels. */
  plates: Map<string, THREE.Vector3>;
}

/**
 * Build the ground for every district outside the home city.
 *
 * Deliberately plain: a plate, a rim, a road in, and a scatter of low blocks
 * around the edge so a district reads as a settled place rather than a slab.
 * Everything a player presses is a structure standing on top of this, and the
 * ground must never compete with those for attention.
 */
export function buildLand(areas: Area[]): Land {
  const group = new THREE.Group();
  const plates = new Map<string, THREE.Vector3>();
  const rng = new RNG('land-0312');

  // The country floor, sized from where the districts actually are rather than
  // from a number typed in once: the map grew from one street to Jaffa-to-Eilat
  // and a fixed plane leaves the far ends of it standing on nothing.
  const xs = areas.map((a) => a.x);
  const zs = areas.map((a) => a.z);
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const midZ = (Math.min(...zs) + Math.max(...zs)) / 2;
  const wide = (Math.max(...xs) - Math.min(...xs)) + 3000;
  const deep = (Math.max(...zs) - Math.min(...zs)) + 3000;
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(wide, deep),
    new THREE.MeshStandardMaterial({ color: GROUND, roughness: 1 }),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.set(midX, -0.7, midZ);
  base.receiveShadow = true;
  group.add(base);

  for (const a of areas) {
    const far = Math.hypot(a.x, a.z) > CITY_REACH;
    plates.set(a.id, new THREE.Vector3(a.x, 0, a.z));
    if (!far) continue;

    const r = a.span;
    const plate = new THREE.Mesh(
      new THREE.CircleGeometry(r, 26),
      new THREE.MeshStandardMaterial({ color: floorOf(a.kind), roughness: 0.96 }),
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(a.x, -0.35, a.z);
    plate.receiveShadow = true;
    group.add(plate);

    // A rim, so the edge of a district is a line you can see from above.
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(r - 1.6, r, 26),
      new THREE.MeshBasicMaterial({
        color: 0x5ff6ff, transparent: true, opacity: 0.09, side: THREE.DoubleSide,
      }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(a.x, -0.28, a.z);
    group.add(rim);

    // The road in, pointing back the way the country runs.
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(11, r * 2.7),
      new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.98 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(a.x, -0.5, a.z + (a.z > 0 ? -r * 1.6 : r * 1.6));
    group.add(road);

    // And the low stuff a place has around its edges: sheds, walls, parked things.
    const dull = new THREE.MeshStandardMaterial({ color: 0x272c31, roughness: 0.95 });
    const n = 10 + Math.floor(rng.next() * 8);
    for (let i = 0; i < n; i++) {
      const turn = rng.next() * Math.PI * 2;
      const at = r * (0.62 + rng.next() * 0.3);
      const w = 4 + rng.next() * 9;
      const h = 2.5 + rng.next() * 4;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4 + rng.next() * 7), dull);
      m.position.set(a.x + Math.cos(turn) * at, h / 2, a.z + Math.sin(turn) * at);
      m.rotation.y = rng.next() * Math.PI;
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
  }

  return { group, plates };
}
