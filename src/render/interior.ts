import * as THREE from 'three';
import { RNG } from '../core/rng';
import { BUILDINGS, FLOOR_H, buildingOf, floorY } from './city';
import { buildWorld } from '../game/world';
import { bake } from './bake';

/**
 * What is inside the two buildings you can enter: floor slabs, partition walls,
 * desks, chairs, screens, and the odd plant. Built once, and revealed floor by
 * floor as the camera comes down through the building.
 */

/** A chair somebody can actually be sitting on. */
export interface Seat {
  building: string;
  floor: number;
  /** World position of the seat surface. */
  x: number; y: number; z: number;
  /** Which way the person on it is facing. */
  yaw: number;
  /** True for the chairs that belong to a place in the game. */
  named: boolean;
}

export interface Interior {
  group: THREE.Group;
  /** One group per floor, so a floor can be shown or hidden on its own. */
  floors: Map<string, THREE.Group>;
  /** Every chair in the building, so nobody has to sit on air. */
  seats: Seat[];
}

const key = (b: string, f: number) => `${b}:${f}`;

export function buildInteriors(): Interior {
  const group = new THREE.Group();
  const floors = new Map<string, THREE.Group>();
  const rng = new RNG('inside');

  // Where the things you can press actually are. The furniture is laid out round
  // them: nothing generic is allowed to stand inside a desk you can click on,
  // and every computer in the game gets a chair pulled up to it.
  const spots = Object.values(buildWorld().places);
  const seats: Seat[] = [];
  const near = (b: string, f: number, x: number, z: number, r: number) =>
    spots.some((p) => p.buildingId === b && p.floor === f && Math.hypot(p.x - x, p.z - z) < r);

  const slabMat = new THREE.MeshStandardMaterial({ color: 0x2e3640, roughness: 0.92 });
  // Office dividers, not walls: solid, and low enough to see the room over them.
  // As full-height translucent sheets they hung across the view like fog.
  const partMat = new THREE.MeshStandardMaterial({ color: 0x3c4652, roughness: 0.94 });
  const partTop = new THREE.MeshStandardMaterial({ color: 0x55606c, roughness: 0.7 });
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x7a6650, roughness: 0.78 });
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x3a434e, roughness: 0.72 });
  const screenOn = new THREE.MeshBasicMaterial({ color: 0x9fe8ff });
  const screenOff = new THREE.MeshBasicMaterial({ color: 0x2b343d });
  const plantMat = new THREE.MeshStandardMaterial({ color: 0x4a7553, roughness: 0.9 });
  // The rest of the room's materials, shared rather than made fresh per floor.
  // Forty-odd floors of furniture used to be eight thousand separate meshes;
  // sharing lets each floor weld down to one mesh per material.
  const carpetGround = new THREE.MeshStandardMaterial({ color: 0x2c343d, roughness: 1 });
  const carpetUp = new THREE.MeshStandardMaterial({ color: 0x394450, roughness: 1 });
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x333c46, roughness: 0.9 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x8d959c, roughness: 0.4, metalness: 0.7 });
  const slitMat = new THREE.MeshBasicMaterial({ color: 0x0b1015 });
  const tubeOn = new THREE.MeshBasicMaterial({ color: 0x4e6b7a, transparent: true, opacity: 0.85 });
  const tubeOff = new THREE.MeshBasicMaterial({ color: 0x2a333c, transparent: true, opacity: 0.5 });

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
        f === -1 ? carpetGround : carpetUp,
      );
      carpet.rotation.x = -Math.PI / 2;
      carpet.position.set(b.x, y + 0.16, b.z);
      carpet.receiveShadow = true;
      g.add(carpet);

      // A core: lifts and stairs, in the middle of every floor.
      const core = new THREE.Mesh(new THREE.BoxGeometry(6, FLOOR_H - 0.4, 5), coreMat);
      core.position.set(b.x - b.w * 0.18, y + FLOOR_H / 2, b.z + b.d * 0.2);
      g.add(core);

      // Two lift doors, so the block in the middle of the floor reads as a lift.
      for (const dx of [-1.3, 1.3]) {
        const door = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.4, 0.12), doorMat);
        door.position.set(b.x - b.w * 0.18 + dx, y + 1.3, b.z + b.d * 0.2 - 2.55);
        g.add(door);
        const slit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.3, 0.05), slitMat);
        slit.position.set(b.x - b.w * 0.18 + dx, y + 1.3, b.z + b.d * 0.2 - 2.62);
        g.add(slit);
      }

      // A couple of partitions, so a floor is rooms and not a shoebox.
      for (let i = 0; i < 2; i++) {
        const vertical = rng.chance(0.5);
        const long = rng.range(0.3, 0.55);
        const wall = new THREE.Mesh(
          vertical
            ? new THREE.BoxGeometry(0.12, 1.35, b.d * long)
            : new THREE.BoxGeometry(b.w * long, 1.35, 0.12),
          partMat,
        );
        wall.castShadow = true;
        const wx = rng.range(-b.w * 0.28, b.w * 0.32);
        const wz = rng.range(-b.d * 0.3, b.d * 0.3);
        if (near(b.id, f, wx, wz, 3.2)) continue;
        wall.position.set(b.x + wx, y + 0.85, b.z + wz);
        g.add(wall);
        // A capping rail along the top, the way these things always have.
        const cap = new THREE.Mesh(
          vertical
            ? new THREE.BoxGeometry(0.2, 0.05, b.d * long)
            : new THREE.BoxGeometry(b.w * long, 0.05, 0.2),
          partTop,
        );
        cap.position.set(b.x + wx, y + 1.55, b.z + wz);
        g.add(cap);
      }

      // Desks with chairs and screens.
      const desks = f === -1 ? 0 : Math.round(b.w * b.d / 90);
      for (let i = 0; i < desks; i++) {
        const dx = b.x + rng.range(-b.w * 0.34, b.w * 0.34);
        const dz = b.z + rng.range(-b.d * 0.34, b.d * 0.34);
        const rot = rng.chance(0.5) ? 0 : Math.PI / 2;
        // Never on top of something the player can press.
        if (near(b.id, f, dx - b.x, dz - b.z, 2.6)) continue;

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
        seats.push({
          building: b.id, floor: f,
          x: chair.position.x, y: y + 0.5, z: chair.position.z,
          // Facing the desk, which is the other way from where the chair sits.
          yaw: Math.atan2(dx - chair.position.x, dz - chair.position.z),
          named: false,
        });
      }

      // A chair pulled up to every computer that is part of the game.
      for (const p of spots) {
        if (p.buildingId !== b.id || p.floor !== f) continue;
        // Desks belong wherever people work, which is now a company.
        if (p.kind !== 'company') continue;
        const cx = b.x + p.x;
        const cz = b.z + p.z + 0.95;
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.5), chairMat);
        seat.position.set(cx, y + 0.46, cz);
        seat.castShadow = true;
        g.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.52, 0.07), chairMat);
        back.position.set(cx, y + 0.75, cz + 0.22);
        g.add(back);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), chairMat);
        stem.position.set(cx, y + 0.24, cz);
        g.add(stem);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          const foot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.26), chairMat);
          foot.position.set(cx + Math.cos(a) * 0.12, y + 0.06, cz + Math.sin(a) * 0.12);
          foot.rotation.y = -a;
          g.add(foot);
        }
        seats.push({
          building: b.id, floor: f, x: cx, y: y + 0.5, z: cz,
          yaw: Math.PI,   // looking at the screen, which faces the room
          named: true,
        });
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
      // Three strips, but one lamp: every light in view is another pass the
      // shader has to make for every surface, and with several floors open at
      // once a lamp per strip was a dozen lights on a phone. One in the middle
      // of the room lights the room; the other two read as lit tubes.
      for (let i = -1; i <= 1; i++) {
        const on = f >= 0 && (rng.chance(0.55) || i === 0);
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(b.w * 0.52, 0.06, 0.16),
          // Bright enough to read as a lit tube, dim enough not to flare the room.
          on ? tubeOn : tubeOff,
        );
        strip.position.set(b.x, y + FLOOR_H - 0.45, b.z + i * b.d * 0.3);
        g.add(strip);
      }
      if (f >= 0) {
        const lamp = new THREE.PointLight(0xbfe0f0, 78, 44, 2);
        lamp.position.set(b.x, y + FLOOR_H - 0.9, b.z);
        g.add(lamp);
      }

      // A floor is furniture and nothing else moves in it, so weld it down to
      // one mesh per material before it is ever drawn.
      bake(g, [], []);
      g.visible = false;
      group.add(g);
      floors.set(key(b.id, f), g);
    }
  }

  return { group, floors, seats };
}

/** Show the floors near the camera and hide the rest, so you can see in. */
export function revealFloors(inside: Interior, buildingId: string | null, floor: number, span: number) {
  for (const [k, g] of inside.floors) {
    const [bid, f] = k.split(':');
    g.visible = bid === buildingId && Math.abs(Number(f) - floor) <= span;
  }
}

export { key as floorKey, buildingOf };
