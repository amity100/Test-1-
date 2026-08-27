import * as THREE from 'three';
import { RNG } from '../core/rng';

/**
 * A block of Tel Aviv at three in the morning.
 *
 * Two of the buildings are real places you go inside — they are built floor by
 * floor with rooms, desks and screens. The rest are the city around them:
 * massing, lit windows, street lamps and a few cars still moving.
 */

export interface BuildingSpec {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  floors: number;
  /** Enterable buildings get interiors; the rest are just skyline. */
  inside: boolean;
  rotation?: number;
}

export const FLOOR_H = 4.2;
export const BUILDINGS: BuildingSpec[] = [
  { id: 'helios', x: 0, z: 0, w: 30, d: 26, floors: 15, inside: true },
  { id: 'across', x: 78, z: -14, w: 24, d: 22, floors: 8, inside: true },
  { id: 'flats', x: -66, z: 54, w: 20, d: 18, floors: 6, inside: false },
];

const CY = new THREE.Color('#5ff6ff');

export interface CityParts {
  group: THREE.Group;
  /** Outer shells, so they can be faded away when you go inside. */
  shells: Map<string, THREE.Mesh[]>;
  windows: Map<string, THREE.InstancedMesh>;
}

/** Where a floor's slab sits, in world height. */
export function floorY(floor: number): number {
  return floor * FLOOR_H;
}

export function buildingOf(id: string): BuildingSpec | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

/** World position of a spot given as building · floor · metres in the room. */
export function spotAt(buildingId: string, floor: number, x: number, z: number, y: number): THREE.Vector3 {
  const b = buildingOf(buildingId);
  if (!b) return new THREE.Vector3(x, floorY(floor) + y, z);
  return new THREE.Vector3(b.x + x, floorY(floor) + y, b.z + z);
}

export function buildCity(): CityParts {
  const group = new THREE.Group();
  const rng = new RNG('tel-aviv-0312');
  const shells = new Map<string, THREE.Mesh[]>();
  const windows = new Map<string, THREE.InstancedMesh>();

  // ── ground and streets ────────────────────────────────────────────────────
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ color: 0x090e14, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.4;
  ground.receiveShadow = true;
  group.add(ground);

  const asphalt = new THREE.MeshStandardMaterial({ color: 0x14191f, roughness: 0.8 });
  const roads: Array<[number, number, number, number]> = [
    [44, 0, 26, 900], [0, 60, 900, 24], [-92, 0, 22, 900], [0, -104, 900, 20],
  ];
  for (const [x, z, w, d] of roads) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), asphalt);
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, -0.3, z);
    r.receiveShadow = true;
    group.add(r);
    // Lane markings, so a street reads as a street from above.
    const dash = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(w, d) * 0.05, Math.max(w, d) * 0.9),
      new THREE.MeshBasicMaterial({ color: 0x3a4652 }),
    );
    dash.rotation.x = -Math.PI / 2;
    if (w > d) dash.rotation.z = Math.PI / 2;
    dash.position.set(x, -0.24, z);
    group.add(dash);
  }

  const kerb = new THREE.MeshStandardMaterial({ color: 0x1b222a, roughness: 0.9 });
  for (const [x, z, w, d] of roads) {
    const pave = new THREE.Mesh(
      new THREE.PlaneGeometry(w > d ? w : w + 14, w > d ? d + 14 : d),
      kerb,
    );
    pave.rotation.x = -Math.PI / 2;
    pave.position.set(x, -0.36, z);
    pave.receiveShadow = true;
    group.add(pave);
  }

  // ── the buildings you can enter ───────────────────────────────────────────
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x1b2530, roughness: 0.62, metalness: 0.24,
    transparent: true, opacity: 1,
  });

  for (const b of BUILDINGS) {
    const h = b.floors * FLOOR_H;
    const parts: THREE.Mesh[] = [];

    // Four walls as separate meshes, so the near ones can dissolve on approach.
    const wall = (w: number, d: number, ox: number, oz: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), shellMat.clone());
      m.position.set(b.x + ox, h / 2, b.z + oz);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.building = b.id;
      group.add(m);
      parts.push(m);
      return m;
    };
    const t = 0.7;
    wall(b.w, t, 0, -b.d / 2);
    wall(b.w, t, 0, b.d / 2);
    wall(t, b.d, -b.w / 2, 0);
    wall(t, b.d, b.w / 2, 0);

    // Roof, and a plinth so it sits on the pavement rather than floating.
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 1.4, 0.8, b.d + 1.4), shellMat.clone());
    roof.position.set(b.x, h, b.z);
    roof.castShadow = true;
    group.add(roof);
    parts.push(roof);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 3, 0.8, b.d + 3),
      new THREE.MeshStandardMaterial({ color: 0x11171e, roughness: 0.9 }),
    );
    base.position.set(b.x, 0, b.z);
    base.receiveShadow = true;
    group.add(base);

    shells.set(b.id, parts);
    windows.set(b.id, litWindows(group, b, rng));
  }

  // ── the rest of the block ─────────────────────────────────────────────────
  const filler = new THREE.BoxGeometry(1, 1, 1);
  const fillerMat = new THREE.MeshStandardMaterial({ color: 0x121a22, roughness: 0.85, metalness: 0.1 });
  const far = new THREE.InstancedMesh(filler, fillerMat, 90);
  const m4 = new THREE.Matrix4();
  let n = 0;
  for (let i = 0; i < 90; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = 130 + rng.next() * 430;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const w = 16 + rng.next() * 26;
    const d = 16 + rng.next() * 26;
    const hh = 12 + rng.next() * rng.next() * 90;
    m4.makeTranslation(x, hh / 2, z);
    m4.scale(new THREE.Vector3(w, hh, d));
    far.setMatrixAt(n++, m4);
  }
  far.count = n;
  far.castShadow = true;
  far.receiveShadow = true;
  group.add(far);

  // Windows on the far towers: one instanced sheet of little emissive squares.
  const glass = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1.5, 1.0),
    new THREE.MeshBasicMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
    2600,
  );
  let g = 0;
  for (let i = 0; i < 2600; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = 130 + rng.next() * 430;
    const hh = 12 + rng.next() * 80;
    const y = 4 + rng.next() * hh;
    m4.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r);
    m4.multiply(new THREE.Matrix4().makeRotationY(-a + Math.PI / 2));
    if (rng.chance(0.6)) continue;
    glass.setMatrixAt(g++, m4);
  }
  glass.count = g;
  group.add(glass);

  // ── street lamps ──────────────────────────────────────────────────────────
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x2a333c, roughness: 0.7 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  for (let i = -4; i <= 5; i++) {
    for (const [lx, lz, rot] of [[44 - 15, i * 62, 0], [i * 62, 60 - 14, Math.PI / 2]] as const) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 9, 6), lampMat);
      pole.position.set(lx, 4.5, lz);
      group.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.24, 0.24), lampMat);
      arm.position.set(lx + Math.cos(rot) * 1.6, 8.9, lz + Math.sin(rot) * 1.6);
      arm.rotation.y = rot;
      group.add(arm);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), bulbMat);
      bulb.position.set(lx + Math.cos(rot) * 3.1, 8.7, lz + Math.sin(rot) * 3.1);
      group.add(bulb);
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(3.6, 18),
        new THREE.MeshBasicMaterial({ color: 0xffb24a, transparent: true, opacity: 0.035 }),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(bulb.position.x, -0.18, bulb.position.z);
      group.add(pool);
    }
  }

  return { group, shells, windows };
}

/** The lit windows of a building you can enter — some on, most off. */
function litWindows(group: THREE.Group, b: BuildingSpec, rng: RNG): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1.7, 1.15),
    new THREE.MeshBasicMaterial({ color: 0xd6f0fa, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    b.floors * 40,
  );
  const m = new THREE.Matrix4();
  let n = 0;
  for (let f = 0; f < b.floors; f++) {
    const y = f * FLOOR_H + FLOOR_H * 0.55;
    for (let side = 0; side < 4; side++) {
      const along = side < 2 ? b.w : b.d;
      const count = Math.floor(along / 3.4);
      for (let k = 0; k < count; k++) {
        if (!rng.chance(0.34)) continue;
        const t = (k + 0.5) / count - 0.5;
        if (side === 0) m.makeTranslation(b.x + t * b.w, y, b.z - b.d / 2 - 0.5);
        else if (side === 1) m.makeTranslation(b.x + t * b.w, y, b.z + b.d / 2 + 0.5);
        else if (side === 2) m.makeTranslation(b.x - b.w / 2 - 0.5, y, b.z + t * b.d);
        else m.makeTranslation(b.x + b.w / 2 + 0.5, y, b.z + t * b.d);
        if (side >= 2) m.multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
        mesh.setMatrixAt(n++, m);
      }
    }
  }
  mesh.count = n;
  group.add(mesh);
  return mesh;
}

export { CY };
