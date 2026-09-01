import * as THREE from 'three';
import { RNG } from '../../core/rng';
import type { ObjState } from '../objects';

/**
 * The box of parts every landmark is built from.
 *
 * The map is Tel Aviv, so a place has to look like the place it is. Old Jaffa
 * is stone alleys and a clock tower on a hill above the sea; the Carmel market
 * is awnings over stalls; Azrieli is a circle, a triangle and a square standing
 * together. None of that comes out of one generic "company" model, which is
 * what the player was shown when he flew to Jaffa and found a server shed on a
 * road.
 *
 * So each landmark is authored on its own, and this is what it is authored
 * with: a small, blunt kit of boxes, cylinders, slabs and lit windows, sharing
 * one palette so that fifty separately built landmarks still look like one
 * city at night. Everything is generated at boot from the place's own seed —
 * nothing is loaded, ever.
 *
 * Coordinates are metres, +x is east, −z is north, y is up, and the origin of a
 * landmark is the middle of its footprint at ground level.
 */

export const M = {
  /** Grey cast concrete: car parks, plant rooms, the backs of things. */
  concrete: new THREE.MeshStandardMaterial({ color: 0x3a4149, roughness: 0.93 }),
  /** Jerusalem/Jaffa stone, warm and pale, for anything old. */
  stone: new THREE.MeshStandardMaterial({ color: 0x8e7f66, roughness: 0.95 }),
  /** The white-ish plaster of Bauhaus Tel Aviv. */
  plaster: new THREE.MeshStandardMaterial({ color: 0x9aa0a2, roughness: 0.88 }),
  /** Dark glass for towers, so lit windows read against it. */
  glass: new THREE.MeshStandardMaterial({ color: 0x131c25, roughness: 0.22, metalness: 0.65 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x59636d, roughness: 0.38, metalness: 0.72 }),
  /** Flat roofs, tar and gravel. */
  roof: new THREE.MeshStandardMaterial({ color: 0x1c222a, roughness: 0.96 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x20262c, roughness: 0.9 }),
  /** Terracotta, for the old roofs of Jaffa and Neve Tzedek. */
  tile: new THREE.MeshStandardMaterial({ color: 0x7a4634, roughness: 0.9 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x5c4630, roughness: 0.92 }),
  sand: new THREE.MeshStandardMaterial({ color: 0x6d6350, roughness: 1 }),
  asphalt: new THREE.MeshStandardMaterial({ color: 0x24282d, roughness: 0.98 }),
  /** Grass and the ficus trees along the boulevards. */
  green: new THREE.MeshStandardMaterial({ color: 0x27402c, roughness: 1 }),
  water: new THREE.MeshStandardMaterial({
    color: 0x0b2233, roughness: 0.16, metalness: 0.5,
  }),
  /** Canvas awnings, market stalls, beach umbrellas. */
  canvas: new THREE.MeshStandardMaterial({
    color: 0x8d3f3a, roughness: 0.95, side: THREE.DoubleSide,
  }),
};

export interface Kit {
  /** Everything built goes in here. */
  g: THREE.Group;
  /** A box, placed by the middle of its own volume. */
  box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh;
  /** A cylinder or cone, placed by its middle. Four sides makes a pyramid. */
  cyl(rTop: number, rBottom: number, h: number, mat: THREE.Material,
    seg: number, x: number, y: number, z: number): THREE.Mesh;
  /** A flat slab lying on the ground: a plaza, a car park, a lawn, the sea. */
  slab(w: number, d: number, mat: THREE.Material, x: number, z: number, y?: number): THREE.Mesh;
  /**
   * A window wall. These are the parts that light up cyan as the place becomes
   * mine, so every landmark needs at least one and they should sit where the
   * real building's windows are.
   */
  lit(w: number, h: number, x: number, y: number, z: number, turnY?: number): THREE.Mesh;
  /** A small always-on lamp — aircraft warning, a buoy, a lit sign. */
  lamp(r: number, x: number, y: number, z: number, colour?: number): THREE.Mesh;
  /** A ficus or a palm. Tel Aviv has both, everywhere. */
  tree(x: number, z: number, tall?: number): void;
  /** Deterministic 0..1, so the same city is built the same way every time. */
  rnd(): number;
  /** Called every frame, for anything that moves. */
  onTick(fn: (t: number, st: ObjState) => void): void;
}

export function makeKit(seed: string): {
  kit: Kit; group: THREE.Group; glow: THREE.Mesh[]; ticks: Array<(t: number, st: ObjState) => void>;
} {
  const group = new THREE.Group();
  const glow: THREE.Mesh[] = [];
  const ticks: Array<(t: number, st: ObjState) => void> = [];
  const rng = new RNG(`tlv:${seed}`);

  const place = (m: THREE.Mesh, x: number, y: number, z: number) => {
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  const kit: Kit = {
    g: group,
    box: (w, h, d, mat, x, y, z) =>
      place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z),
    cyl: (rt, rb, h, mat, seg, x, y, z) =>
      place(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat), x, y, z),
    slab: (w, d, mat, x, z, y = 0.05) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.receiveShadow = true;
      group.add(m);
      return m;
    },
    lit: (w, h, x, y, z, turnY = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
        color: 0x2f3c46, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      m.position.set(x, y, z);
      m.rotation.y = turnY;
      glow.push(m);
      group.add(m);
      return m;
    },
    lamp: (r, x, y, z, colour = 0xff5470) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6),
        new THREE.MeshBasicMaterial({ color: colour }));
      m.position.set(x, y, z);
      group.add(m);
      return m;
    },
    tree: (x, z, tall = 1) => {
      const h = (5 + rng.next() * 4) * tall;
      place(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, h, 6), M.wood), x, h / 2, z);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(2.2 + rng.next() * 1.4, 7, 5), M.green);
      crown.scale.y = 0.72;
      place(crown, x, h + 1.4, z);
    },
    rnd: () => rng.next(),
    onTick: (fn) => { ticks.push(fn); },
  };

  return { kit, group, glow, ticks };
}

/** What a landmark module has to export. */
export interface Landmark {
  /** Footprint and height in metres, for the click box and the camera. */
  size: { w: number; h: number; d: number };
  build(k: Kit): void;
}
