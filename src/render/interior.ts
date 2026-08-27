import * as THREE from 'three';
import { RNG } from '../core/rng';
import { BUILDINGS, FLOOR_H, buildingOf, floorY } from './city';

/**
 * What is inside the two buildings you can enter: floor slabs, partition walls,
 * desks, chairs, screens, and the odd plant. Built once, and revealed floor by
 * floor as the camera comes down through the building.
 */

export interface Interior {
  group: THREE.Group;
  /** One group per floor, so a floor can be shown or hidden on its own. */
  floors: Map<string, THREE.Group>;
}

const key = (b: string, f: number) => `${b}:${f}`;

export function buildInteriors(): Interior {
  const group = new THREE.Group();
  const floors = new Map<string, THREE.Group>();
  const rng = new RNG('inside');

  const slabMat = new THREE.MeshStandardMaterial({ color: 0x3b444e, roughness: 0.9 });
  const partMat = new THREE.MeshStandardMaterial({
    color: 0x525d69, roughness: 0.85, transparent: true, opacity: 0.92,
  });
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x7a6650, roughness: 0.78 });
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x3a434e, roughness: 0.72 });
  const screenOn = new THREE.MeshBasicMaterial({ color: 0x9fe8ff });
  const screenOff = new THREE.MeshBasicMaterial({ color: 0x2b343d });
  const plantMat = new THREE.MeshStandardMaterial({ color: 0x4a7553, roughness: 0.9 });

  for (const b of BUILDINGS) {
    if (!b.inside) continue;
    for (let f = -1; f < b.floors; f++) {
      const g = new THREE.Group();
      const y = floorY(f);

      // The slab you stand on.
      const slab = new THREE.Mesh(new THREE.BoxGeometry(b.w - 1.6, 0.3, b.d - 1.6), slabMat);
      slab.position.set(b.x, y, b.z);
      slab.receiveShadow = true;
      g.add(slab);

      const carpet = new THREE.Mesh(
        new THREE.PlaneGeometry(b.w - 2, b.d - 2),
        new THREE.MeshStandardMaterial({ color: f === -1 ? 0x39424c : 0x4a5560, roughness: 1 }),
      );
      carpet.rotation.x = -Math.PI / 2;
      carpet.position.set(b.x, y + 0.16, b.z);
      carpet.receiveShadow = true;
      g.add(carpet);

      // A core: lifts and stairs, in the middle of every floor.
      const core = new THREE.Mesh(
        new THREE.BoxGeometry(6, FLOOR_H - 0.4, 5),
        new THREE.MeshStandardMaterial({ color: 0x47515c, roughness: 0.85 }),
      );
      core.position.set(b.x - b.w * 0.18, y + FLOOR_H / 2, b.z + b.d * 0.2);
      g.add(core);

      // A couple of partitions, so a floor is rooms and not a shoebox.
      for (let i = 0; i < 2; i++) {
        const vertical = rng.chance(0.5);
        const wall = new THREE.Mesh(
          vertical
            ? new THREE.BoxGeometry(0.3, FLOOR_H * 0.72, b.d * rng.range(0.3, 0.55))
            : new THREE.BoxGeometry(b.w * rng.range(0.3, 0.55), FLOOR_H * 0.72, 0.3),
          partMat,
        );
        wall.position.set(
          b.x + rng.range(-b.w * 0.28, b.w * 0.32),
          y + FLOOR_H * 0.36,
          b.z + rng.range(-b.d * 0.3, b.d * 0.3),
        );
        g.add(wall);
      }

      // Desks with chairs and screens.
      const desks = f === -1 ? 0 : Math.round(b.w * b.d / 90);
      for (let i = 0; i < desks; i++) {
        const dx = b.x + rng.range(-b.w * 0.34, b.w * 0.34);
        const dz = b.z + rng.range(-b.d * 0.34, b.d * 0.34);
        const rot = rng.chance(0.5) ? 0 : Math.PI / 2;

        const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.2), deskMat);
        desk.position.set(dx, y + 0.75, dz);
        desk.rotation.y = rot;
        desk.castShadow = true;
        g.add(desk);
        for (const [ox, oz] of [[-1, -0.45], [1, -0.45], [-1, 0.45], [1, 0.45]] as const) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.75, 0.09), chairMat);
          const c = Math.cos(rot), s = Math.sin(rot);
          leg.position.set(dx + ox * c - oz * s, y + 0.37, dz + ox * s + oz * c);
          g.add(leg);
        }

        const lit = rng.chance(0.35);
        const scr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.05), lit ? screenOn : screenOff);
        scr.position.set(dx, y + 1.12, dz);
        scr.rotation.y = rot + Math.PI;
        g.add(scr);

        const chair = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.55), chairMat);
        chair.position.set(dx - Math.sin(rot) * 1.0, y + 0.45, dz + Math.cos(rot) * 1.0);
        g.add(chair);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.08), chairMat);
        back.position.copy(chair.position).add(new THREE.Vector3(0, 0.32, 0.24));
        g.add(back);
      }

      if (f >= 0 && rng.chance(0.5)) {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.4, 8), deskMat);
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), plantMat);
        const px = b.x + rng.range(-b.w * 0.35, b.w * 0.35);
        const pz = b.z + rng.range(-b.d * 0.35, b.d * 0.35);
        pot.position.set(px, y + 0.35, pz);
        leaf.position.set(px, y + 0.95, pz);
        leaf.scale.y = 1.4;
        g.add(pot, leaf);
      }

      // Ceiling strips. A few are still on, and they are what lights the room.
      for (let i = -1; i <= 1; i++) {
        const on = f >= 0 && (rng.chance(0.55) || i === 0);
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(b.w * 0.52, 0.06, 0.16),
          new THREE.MeshBasicMaterial({
            // Bright enough to read as a lit tube, dim enough not to flare the room.
            color: on ? 0x4e6b7a : 0x2a333c,
            transparent: true, opacity: on ? 0.85 : 0.5,
          }),
        );
        strip.position.set(b.x, y + FLOOR_H - 0.45, b.z + i * b.d * 0.3);
        g.add(strip);
        if (!on) continue;
        const lamp = new THREE.PointLight(0xbfe0f0, 90, 34, 2);
        lamp.position.set(b.x, y + FLOOR_H - 0.9, b.z + i * b.d * 0.3);
        g.add(lamp);
      }

      g.visible = false;
      group.add(g);
      floors.set(key(b.id, f), g);
    }
  }

  return { group, floors };
}

/** Show the floors near the camera and hide the rest, so you can see in. */
export function revealFloors(inside: Interior, buildingId: string | null, floor: number, span: number) {
  for (const [k, g] of inside.floors) {
    const [bid, f] = k.split(':');
    g.visible = bid === buildingId && Math.abs(Number(f) - floor) <= span;
  }
}

export { key as floorKey, buildingOf };
