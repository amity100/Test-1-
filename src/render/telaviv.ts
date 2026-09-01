import * as THREE from 'three';
import { RNG } from '../core/rng';
import { M } from './landmarks/kit';

/**
 * Tel Aviv itself: the sea, the river, the sand and the streets.
 *
 * The landmarks are authored one by one, but a city is not a set of landmarks
 * on an empty plain — it is the ground between them. Without the Mediterranean
 * on the west, the Yarkon across the north and the long straight streets that
 * everybody navigates by, Azrieli and Jaffa are two models four kilometres
 * apart with nothing in between saying they are in the same city.
 *
 * Everything here is at the real place, in metres. The origin is Rabin Square
 * (32.0809 N, 34.7806 E); +x is east, −z is north, and one unit is 0.55 real
 * metres — so the whole of Tel Aviv from Jaffa to the university is about four
 * kilometres across, which is a city you can fly over rather than a continent.
 */

/** Real degrees to local metres, so the survey below can be read against a map. */
const KX = 51920;
const KZ = 61050;
export const at = (lat: number, lon: number): [number, number] =>
  [Math.round((lon - 34.7806) * KX), Math.round(-(lat - 32.0809) * KZ)];

/**
 * The coastline, north to south, from the Reading power station down past Jaffa.
 * Straight from the map: the shore bends west as it goes south, which is why
 * Jaffa sticks out into the sea and the promenade curves.
 */
const SHORE: Array<[number, number]> = [
  at(32.1080, 34.7745), at(32.1030, 34.7740), at(32.0980, 34.7708),
  at(32.0900, 34.7668), at(32.0850, 34.7658), at(32.0800, 34.7652),
  at(32.0740, 34.7635), at(32.0680, 34.7618), at(32.0620, 34.7568),
  at(32.0570, 34.7522), at(32.0520, 34.7492), at(32.0460, 34.7478),
  at(32.0400, 34.7470),
];

/** The Yarkon, running from the sea inland along the north of the city. */
const YARKON: Array<[number, number]> = [
  at(32.0990, 34.7715), at(32.0985, 34.7790), at(32.0995, 34.7880),
  at(32.1010, 34.7990), at(32.1005, 34.8110), at(32.1020, 34.8250),
];

/** The streets a person actually navigates Tel Aviv by. */
interface Street { name: string; wide: number; pts: Array<[number, number]>; }
const STREETS: Street[] = [
  { name: 'ibn-gvirol', wide: 22, pts: [at(32.0960, 34.7838), at(32.0700, 34.7818)] },
  { name: 'dizengoff', wide: 18, pts: [at(32.0960, 34.7790), at(32.0740, 34.7745), at(32.0690, 34.7715)] },
  { name: 'namir', wide: 30, pts: [at(32.1120, 34.7930), at(32.0900, 34.7880), at(32.0830, 34.7855)] },
  { name: 'ayalon', wide: 46, pts: [at(32.1080, 34.7955), at(32.0700, 34.7940), at(32.0560, 34.7880)] },
  { name: 'arlozorov', wide: 20, pts: [at(32.0870, 34.7660), at(32.0862, 34.7960)] },
  { name: 'rothschild', wide: 24, pts: [at(32.0715, 34.7800), at(32.0640, 34.7700), at(32.0600, 34.7648)] },
  { name: 'allenby', wide: 18, pts: [at(32.0740, 34.7770), at(32.0680, 34.7690), at(32.0630, 34.7620)] },
  { name: 'king-george', wide: 16, pts: [at(32.0790, 34.7740), at(32.0720, 34.7712)] },
  { name: 'hayarkon', wide: 16, pts: [at(32.0930, 34.7700), at(32.0700, 34.7648)] },
  { name: 'jerusalem-ave', wide: 20, pts: [at(32.0600, 34.7570), at(32.0510, 34.7530)] },
  { name: 'shalom', wide: 26, pts: [at(32.0730, 34.7690), at(32.0730, 34.7960)] },
  { name: 'kaplan', wide: 20, pts: [at(32.0770, 34.7780), at(32.0748, 34.7920)] },
  { name: 'bograshov', wide: 14, pts: [at(32.0770, 34.7660), at(32.0755, 34.7760)] },
  { name: 'salame', wide: 20, pts: [at(32.0600, 34.7700), at(32.0570, 34.7830)] },
  { name: 'ha-masger', wide: 18, pts: [at(32.0680, 34.7860), at(32.0570, 34.7830)] },
];

/** A flat ribbon laid along a run of points, used for water, sand and roads. */
function ribbon(pts: Array<[number, number]>, wide: number, mat: THREE.Material, y: number) {
  const left: THREE.Vector3[] = [];
  const right: THREE.Vector3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * (wide / 2);
    const nz = (dx / len) * (wide / 2);
    left.push(new THREE.Vector3(pts[i][0] + nx, y, pts[i][1] + nz));
    right.push(new THREE.Vector3(pts[i][0] - nx, y, pts[i][1] - nz));
  }
  const pos: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = left[i]; const b = right[i]; const c = left[i + 1]; const d = right[i + 1];
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    pos.push(b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}

export interface TelAviv {
  group: THREE.Group;
  tick(t: number): void;
}

/**
 * Build the city's ground: sea, sand, river, streets, and the ordinary blocks
 * that fill in between the landmarks so that the famous things stand in a city
 * rather than on a plain.
 */
export function buildTelAviv(): TelAviv {
  const group = new THREE.Group();
  const rng = new RNG('tlv-ground');
  const ticks: Array<(t: number) => void> = [];

  // ── the Mediterranean ────────────────────────────────────────────────────
  // A very large plate west of the shore, and the shoreline itself laid over it
  // as sand, so the beach reads as a strip rather than an edge.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 9000, 24, 36),
    M.water.clone(),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-3800, -0.9, 400);
  group.add(sea);
  const base = (sea.geometry as THREE.PlaneGeometry).attributes.position.clone();
  ticks.push((t) => {
    const pos = (sea.geometry as THREE.PlaneGeometry).attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = base.getX(i);
      const y = base.getY(i);
      pos.setZ(i, Math.sin(x * 0.004 + t * 0.7) * 1.6 + Math.cos(y * 0.005 - t * 0.5) * 1.2);
    }
    pos.needsUpdate = true;
  });

  interface Copy { m: THREE.Matrix4 }
  const blocks: Copy[] = [];
  const caps: Copy[] = [];
  const faces: Copy[] = [];
  const tanks: Copy[] = [];
  const panels: Copy[] = [];
  const trunks: Copy[] = [];
  const crowns: Copy[] = [];
  const lamps: Copy[] = [];
  const put = (list: Copy[], x: number, y: number, z: number,
    sx: number, sy: number, sz: number, ry = 0) => {
    const m = new THREE.Matrix4();
    m.compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
      new THREE.Vector3(sx, sy, sz));
    list.push({ m });
  };

  group.add(ribbon(SHORE, 78, M.sand, 0.1));
  // A darker wet line where the water actually meets the sand.
  group.add(ribbon(SHORE.map(([x, z]) => [x - 44, z] as [number, number]), 26,
    M.water, 0.14));

  // ── the Yarkon, and the park along it ────────────────────────────────────
  group.add(ribbon(YARKON, 190, M.green, 0.08));
  group.add(ribbon(YARKON, 34, M.water, 0.13));
  for (let i = 0; i < 90; i++) {
    const t = rng.next();
    const seg = Math.min(YARKON.length - 2, Math.floor(t * (YARKON.length - 1)));
    const f = t * (YARKON.length - 1) - seg;
    const x = YARKON[seg][0] + (YARKON[seg + 1][0] - YARKON[seg][0]) * f;
    const z = YARKON[seg][1] + (YARKON[seg + 1][1] - YARKON[seg][1]) * f;
    const off = (rng.next() - 0.5) * 170;
    if (Math.abs(off) < 26) continue;
    const h = 6 + rng.next() * 5;
    const r = 2.6 + rng.next() * 1.6;
    put(trunks, x, h / 2, z + off, 1, h, 1);
    put(crowns, x, h + 1.6, z + off, r, r * 0.7, r);
  }

  // ── the streets ──────────────────────────────────────────────────────────
  for (const st of STREETS) {
    group.add(ribbon(st.pts, st.wide, M.asphalt, 0.2));
    // Street lighting down one side, which is most of what you see at night.
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * (st.pts.length - 1);
      const seg = Math.min(st.pts.length - 2, Math.floor(t));
      const f = t - seg;
      const x = st.pts[seg][0] + (st.pts[seg + 1][0] - st.pts[seg][0]) * f;
      const z = st.pts[seg][1] + (st.pts[seg + 1][1] - st.pts[seg][1]) * f;
      put(lamps, x + st.wide / 2 + 2, 8, z, 1, 1, 1);
    }
  }

  // ── the city in between ──────────────────────────────────────────────────
  //
  // Ordinary Tel Aviv: four- to nine-storey blocks on a loose grid, denser in
  // the middle, thinning toward the edges, never on the sea or the river.
  //
  // All of it is instanced. Built a mesh at a time this was ten thousand draw
  // calls on its own, and a phone draws a few hundred before it starts to
  // stutter — which is exactly what it did. Every block is the same unit cube
  // scaled per copy, so the whole city is six calls.
  const onWater = (x: number, z: number) => {
    for (let i = 0; i < SHORE.length - 1; i++) {
      const [ax, az] = SHORE[i];
      const [bx, bz] = SHORE[i + 1];
      if (z < Math.min(az, bz) - 60 || z > Math.max(az, bz) + 60) continue;
      const f = (z - az) / ((bz - az) || 1);
      if (x < ax + (bx - ax) * f + 46) return true;
    }
    for (let i = 0; i < YARKON.length - 1; i++) {
      const [ax, az] = YARKON[i];
      const [bx, bz] = YARKON[i + 1];
      if (x < Math.min(ax, bx) - 120 || x > Math.max(ax, bx) + 120) continue;
      const f = (x - ax) / ((bx - ax) || 1);
      if (Math.abs(z - (az + (bz - az) * f)) < 100) return true;
    }
    return false;
  };

  const wall = new THREE.MeshStandardMaterial({ color: 0x8b8f8c, roughness: 0.86 });
  const glass = new THREE.MeshBasicMaterial({
    color: 0x6a5a34, transparent: true, opacity: 0.72,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  for (let i = 0; i < 2600; i++) {
    const x = -1750 + rng.next() * 4200;
    const z = -2150 + rng.next() * 4100;
    if (onWater(x, z)) continue;
    // Thin out toward the edges so the city has a middle.
    const from = Math.hypot(x - 100, (z - 200) * 0.8);
    if (rng.next() < from / 3400) continue;
    const w = 12 + rng.next() * 20;
    const d = 12 + rng.next() * 18;
    const floors = 3 + Math.floor(rng.next() * rng.next() * 12);
    const h = floors * 3.2;
    put(blocks, x, h / 2, z, w, h, d);
    put(caps, x, h + 0.35, z, w + 0.8, 0.7, d + 0.8);
    // Lit windows on the side that faces the middle of town.
    if (rng.next() > 0.25) put(faces, x, h * 0.5, z + d / 2 + 0.06, w * 0.82, h * 0.7, 1);
    // Solar water heaters: a tank on legs, on nearly every roof in Israel.
    if (rng.next() > 0.4) {
      const tx = x + (rng.next() - 0.5) * w * 0.5;
      const tz = z + (rng.next() - 0.5) * d * 0.5;
      put(tanks, tx, h + 2.2, tz, 1, 1, 1);
      put(panels, tx, h + 1.1, tz + 2.2, 1, 1, 1);
    }
  }

  const many = (geo: THREE.BufferGeometry, mat: THREE.Material, list: Copy[],
    shadow = true) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((c, i) => im.setMatrixAt(i, c.m));
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = shadow;
    im.receiveShadow = shadow;
    im.frustumCulled = false;
    group.add(im);
  };

  // Three hundred street lamps and ninety trees along the river, each of which
  // used to be its own mesh with its own material — a quarter of everything the
  // city was drawing, for scenery nobody looks at twice.
  many(new THREE.SphereGeometry(1.1, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffc07a }), lamps, false);
  many(new THREE.CylinderGeometry(0.3, 0.45, 1, 5), M.wood, trunks, false);
  many(new THREE.SphereGeometry(1, 6, 4), M.green, crowns, false);

  many(new THREE.BoxGeometry(1, 1, 1), wall, blocks);
  many(new THREE.BoxGeometry(1, 1, 1), M.roof, caps, false);
  many(new THREE.PlaneGeometry(1, 1), glass, faces, false);
  const tank = new THREE.CylinderGeometry(0.9, 0.9, 3.4, 7);
  tank.rotateZ(Math.PI / 2);
  many(tank, M.metal, tanks, false);
  const panel = new THREE.BoxGeometry(3.6, 0.2, 2.2);
  panel.rotateX(-0.5);
  many(panel, M.dark, panels, false);

  return { group, tick: (t) => { for (const f of ticks) f(t); } };
}
