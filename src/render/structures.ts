import * as THREE from 'three';
import { RNG } from '../core/rng';
import type { PlaceKind } from '../game/types';
import { bake } from './bake';
import type { ObjState, PlaceObject } from './objects';

/**
 * A place, built at the size of the thing it actually is.
 *
 * The game used to happen on one floor of one building, so a "place" was a
 * monitor on a desk and `objects.ts` built it that way: a metre and a half of
 * boxes, with a keyboard in front of it. The map is a country now, and those
 * same desk props were standing in for the port of Haifa and the national grid
 * — sixty-one of them scattered across bare ground, which is exactly why flying
 * to a district put the camera down on nothing in particular. There was nothing
 * there to look at.
 *
 * So every place outside a room is a structure: a power station has chimneys
 * and a turbine hall, a port has cranes and stacked containers, a hospital has
 * a helipad, a neighbourhood is rows of houses with their lights on. All of it
 * is boxes and cylinders generated at boot from the place's own seed — nothing
 * is loaded — and all of it lights cyan, one part at a time, as the place
 * becomes mine.
 */

const CONCRETE = new THREE.MeshStandardMaterial({ color: 0x39414a, roughness: 0.92 });
const DARKER = new THREE.MeshStandardMaterial({ color: 0x232a31, roughness: 0.9 });
const METAL = new THREE.MeshStandardMaterial({ color: 0x59636d, roughness: 0.4, metalness: 0.7 });
const ROOF = new THREE.MeshStandardMaterial({ color: 0x1b2128, roughness: 0.95 });
const GLASS = new THREE.MeshStandardMaterial({
  color: 0x121a22, roughness: 0.25, metalness: 0.6,
});

/** A face that will be lit. Kept unlit here; the world tints it as it is taken. */
const litFace = () => new THREE.MeshBasicMaterial({
  color: 0x2c3a44, transparent: true, opacity: 0.9,
  blending: THREE.AdditiveBlending, depthWrite: false,
});

/**
 * A warning lamp, the kind that sits on top of tall things.
 *
 * Its own material every time, because it writes to its own opacity as it
 * blinks — one shared material would have every warning light in the country
 * blinking in step, which is both wrong and a flicker.
 */
const blinker = () => new THREE.MeshBasicMaterial({ color: 0xff5470, transparent: true });
const DECK = new THREE.MeshStandardMaterial({ color: 0x2a2f35, roughness: 0.95 });
const HEDGE = new THREE.MeshStandardMaterial({ color: 0x1e3327, roughness: 1 });

export function makeStructure(kind: PlaceKind, seed: string): PlaceObject {
  const g = new THREE.Group();
  const glow: THREE.Mesh[] = [];
  const rng = new RNG(`build:${seed}`);
  let tick: (t: number, st: ObjState) => void = () => {};
  // Every lit surface on this structure shares one material, so the game can
  // tint the lot with one line and the welder can fuse the lot into one mesh.
  const LIT = litFace();

  const put = (m: THREE.Mesh, x = 0, y = 0, z = 0) => {
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const box = (w: number, h: number, d: number, mat: THREE.Material = CONCRETE) =>
    new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const cyl = (r1: number, r2: number, h: number, mat: THREE.Material = CONCRETE, seg = 12) =>
    new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);

  /** A wall of lit windows, as one plane — cheap, and reads at any distance. */
  const windows = (w: number, h: number, x: number, y: number, z: number, turn = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), LIT);
    m.position.set(x, y, z);
    m.rotation.y = turn;
    glow.push(m);
    g.add(m);
    return m;
  };

  /** Every structure is clicked through one invisible block around all of it. */
  const hitBox = (w: number, h: number, d: number, y = h / 2) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    m.position.y = y;
    m.userData.keep = true;
    g.add(m);
    return m;
  };

  let hit: THREE.Mesh;

  switch (kind) {
    // ── a company: towers with the lights left on ──────────────────────────
    case 'company': {
      const n = 2 + rng.int(0, 1);
      for (let i = 0; i < n; i++) {
        const w = 7 + rng.next() * 4;
        const h = 20 + rng.next() * 22;
        const x = (i - (n - 1) / 2) * 11;
        const z = rng.next() * 6 - 3;
        put(box(w, h, w * 0.85, GLASS), x, h / 2, z);
        put(box(w + 0.6, 0.8, w * 0.85 + 0.6, ROOF), x, h + 0.4, z);
        windows(w * 0.9, h * 0.82, x, h * 0.52, z + w * 0.44);
        windows(w * 0.78, h * 0.82, x + w / 2 + 0.02, h * 0.52, z, Math.PI / 2);
      }
      hit = hitBox(n * 12, 34, 16, 17);
      break;
    }

    // ── a power station: a hall, two chimneys, and a core that breathes ────
    case 'power': {
      put(box(26, 13, 16), 0, 6.5, 0);
      put(box(27, 1, 17, ROOF), 0, 13.3, 0);
      windows(24, 6, 0, 6.5, 8.1);
      const cores: THREE.Mesh[] = [];
      for (let i = 0; i < 2; i++) {
        const x = -7 + i * 14;
        put(cyl(2.6, 3.4, 40, CONCRETE, 14), x, 20, -9);
        const cap = put(cyl(2.7, 2.7, 0.8, DARKER, 14), x, 40.2, -9);
        void cap;
        const lamp = put(new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), blinker()), x, 41, -9);
        cores.push(lamp);
      }
          const core = new THREE.Mesh(new THREE.SphereGeometry(2.4, 14, 10), LIT);
      core.position.set(0, 7, 0);
      glow.push(core);
      g.add(core);
      tick = (t) => {
        const beat = 0.9 + Math.sin(t * 2.1) * 0.12;
        core.scale.setScalar(beat);
        for (const l of cores) {
          (l.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.abs(Math.sin(t * 1.1)) * 0.45;
        }
      };
      hit = hitBox(30, 42, 22, 21);
      break;
    }

    // ── water: tanks and the pipes between them ────────────────────────────
    case 'water': {
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 13;
        const r = 4.6 + rng.next() * 1.4;
        put(cyl(r, r, 11, METAL, 16), x, 5.5, 0);
        put(cyl(r + 0.3, r + 0.3, 0.6, DARKER, 16), x, 11.2, 0);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.05, r + 0.05, 1.6, 16, 1, true), LIT);
        band.position.set(x, 8.4, 0);
        glow.push(band);
        g.add(band);
      }
      const pipe = put(cyl(0.8, 0.8, 30, METAL, 8), 0, 2.2, 7);
      pipe.rotation.z = Math.PI / 2;
      put(box(6, 4, 5, CONCRETE), 0, 2, -9);
      hit = hitBox(38, 14, 22, 7);
      break;
    }

    // ── roads: an interchange, with the lights running along it ────────────
    case 'roads': {
      const deck = DECK;
      put(box(46, 1.2, 10, deck), 0, 5, 0);
      const cross = put(box(10, 1.2, 40, deck), 4, 2.4, 0);
      void cross;
      for (let i = 0; i < 4; i++) {
        const x = -18 + i * 12;
        put(box(3, 5, 3, CONCRETE), x, 2.5, 0);
      }
      for (let i = 0; i < 6; i++) {
        const x = -20 + i * 8;
        put(cyl(0.25, 0.25, 7, METAL, 6), x, 9, 5.4);
        const lamp = windows(1.6, 0.5, x, 12.4, 5.4);
        void lamp;
      }
      const flow = windows(42, 0.7, 0, 5.7, 0);
      flow.rotation.x = -Math.PI / 2;
      tick = (t) => { flow.position.x = Math.sin(t * 0.7) * 2; };
      hit = hitBox(46, 14, 40, 7);
      break;
    }

    // ── transport: a shed, a platform, and two cranes over it ──────────────
    case 'transport': {
      put(box(34, 9, 14), 0, 4.5, 0);
      put(box(35, 0.8, 15, ROOF), 0, 9.2, 0);
      windows(32, 4, 0, 4.6, 7.1);
      for (let i = 0; i < 2; i++) {
        const x = -10 + i * 20;
        put(cyl(0.6, 0.6, 26, METAL, 8), x - 4, 13, -12);
        put(cyl(0.6, 0.6, 26, METAL, 8), x + 4, 13, -12);
        const arm = put(box(2, 1.4, 22, METAL), x, 25, -6);
        void arm;
        put(box(3, 2.4, 3, DARKER), x, 22.5, -12);
      }
      for (let i = 0; i < 7; i++) {
        put(box(5, 2.6, 2.4, i % 2 ? DARKER : CONCRETE),
          -14 + (i % 4) * 9, 1.3 + Math.floor(i / 4) * 2.7, -20);
      }
      hit = hitBox(40, 28, 34, 14);
      break;
    }

    // ── talk: a mast you can see from the next district ────────────────────
    case 'talk': {
      put(box(12, 6, 10), 0, 3, 4);
      windows(10, 2.6, 0, 3.2, 9.1);
      put(cyl(1.1, 0.35, 46, METAL, 8), 0, 23, -4);
      for (let i = 0; i < 3; i++) {
        const y = 12 + i * 12;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6 - i * 0.3, 0.16, 5, 14), METAL);
        ring.rotation.x = Math.PI / 2;
        put(ring, 0, y, -4);
      }
      const dish = put(cyl(3.2, 0.2, 1.4, METAL, 14), 3.4, 30, -4);
      dish.rotation.z = -0.6;
      const beacon = put(new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), blinker()), 0, 46.5, -4);
      const wave = new THREE.Mesh(new THREE.TorusGeometry(5, 0.2, 5, 22), LIT);
      wave.rotation.x = Math.PI / 2;
      wave.position.set(0, 32, -4);
      glow.push(wave);
      g.add(wave);
      tick = (t, st) => {
        (beacon.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.abs(Math.sin(t * 1.6)) * 0.6;
        const s = 1 + ((t * 0.55) % 1) * (st.mine ? 1.6 : 0.5);
        wave.scale.setScalar(s);
      };
      hit = hitBox(16, 48, 16, 24);
      break;
    }

    // ── care: a wide block, a lit band, a helipad ──────────────────────────
    case 'care': {
      put(box(30, 16, 18), 0, 8, 0);
      put(box(31, 0.9, 19, ROOF), 0, 16.4, 0);
      windows(28, 11, 0, 8, 9.1);
      windows(16, 11, 15.1, 8, 0, Math.PI / 2);
      const pad = new THREE.Mesh(new THREE.TorusGeometry(4, 0.3, 6, 24), LIT);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(8, 17, -2);
      glow.push(pad);
      g.add(pad);
      const bar1 = windows(6, 1.1, 8, 17.05, -2);
      bar1.rotation.x = -Math.PI / 2;
      hit = hitBox(32, 20, 22, 10);
      break;
    }

    // ── study: low blocks round a courtyard ───────────────────────────────
    case 'study': {
      const spots: Array<[number, number, number, number]> = [
        [-12, 0, 14, 10], [12, 2, 12, 9], [0, -14, 20, 8],
      ];
      for (const [x, z, w, h] of spots) {
        put(box(w, h, 10), x, h / 2, z);
        put(box(w + 0.6, 0.7, 10.6, ROOF), x, h + 0.35, z);
        windows(w * 0.86, h * 0.6, x, h * 0.5, z + 5.1);
      }
      const lawn = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 12),
        HEDGE,
      );
      lawn.rotation.x = -Math.PI / 2;
      lawn.position.set(0, 0.06, 2);
      g.add(lawn);
      hit = hitBox(34, 14, 34, 7);
      break;
    }

    // ── homes: a street of houses with their lights on ────────────────────
    case 'homes': {
      for (let i = 0; i < 14; i++) {
        const x = -21 + (i % 7) * 7;
        const z = Math.floor(i / 7) * 13 - 6;
        const h = 5 + rng.next() * 4;
        put(box(5.2, h, 5.6, i % 3 ? CONCRETE : DARKER), x, h / 2, z);
        const roof = put(cyl(0, 4.2, 2.2, ROOF, 4), x, h + 1.1, z);
        roof.rotation.y = Math.PI / 4;
        if (rng.next() > 0.35) windows(3.4, h * 0.4, x, h * 0.55, z + 2.9);
      }
      hit = hitBox(46, 12, 26, 6);
      break;
    }

    // ── money: a squat vault behind columns ───────────────────────────────
    case 'money': {
      put(box(24, 14, 16), 0, 7, 0);
      put(box(26, 1.2, 18, ROOF), 0, 14.6, 0);
      for (let i = 0; i < 6; i++) {
        put(cyl(0.9, 0.9, 13, CONCRETE, 10), -10 + i * 4, 6.5, 8.6);
      }
      put(box(26, 2.4, 3, CONCRETE), 0, 15.6, 8);
      const door = windows(5, 6, 0, 4, 8.15);
      tick = (t, st) => { door.scale.setScalar(st.mine ? 1 + Math.sin(t * 1.3) * 0.05 : 1); };
      hit = hitBox(28, 18, 22, 9);
      break;
    }

    // ── city hall, and the seat of the state: steps, columns, flags ───────
    case 'city':
    case 'state': {
      const big = kind === 'state';
      const w = big ? 34 : 26;
      const h = big ? 18 : 13;
      put(box(w, h, 18), 0, h / 2, 0);
      put(box(w + 1.4, 1.2, 19.4, ROOF), 0, h + 0.6, 0);
      windows(w * 0.88, h * 0.6, 0, h * 0.52, 9.1);
      for (let i = 0; i < (big ? 8 : 6); i++) {
        const n = big ? 8 : 6;
        put(cyl(1.1, 1.1, h * 0.8, CONCRETE, 10), (i - (n - 1) / 2) * 3.8, h * 0.4, 9.6);
      }
      put(box(w * 0.9, 1, 6, CONCRETE), 0, 0.5, 12);
      put(box(w * 0.75, 1, 4, CONCRETE), 0, 1.4, 11);
      for (let i = 0; i < (big ? 2 : 1); i++) {
        const x = big ? -8 + i * 16 : 0;
        put(cyl(0.22, 0.22, 16, METAL, 6), x, h + 8, -7);
        const flag = windows(4, 2.4, x + 2, h + 14, -7);
        void flag;
      }
      hit = hitBox(w + 4, h + 18, 26, (h + 18) / 2);
      break;
    }

    default: {
      put(box(14, 10, 12), 0, 5, 0);
      windows(12, 5, 0, 5, 6.1);
      hit = hitBox(16, 12, 14, 6);
      break;
    }
  }

  hit.name = 'hit';
  // Sixty-five of these stand across the country and every box in them used to
  // be its own draw. Welded down by material, a structure costs a handful.
  const baked = bake(g, glow, [tick]);
  return { group: g, glowParts: baked.glowParts, movers: baked.movers, hit, tick };
}

/**
 * Roughly how wide a structure of this kind is, in metres.
 *
 * Used for the ring drawn round a selected place and for deciding how far back
 * the camera has to sit to have the whole of it in the picture. One table, so
 * the ring and the camera can never disagree about how big something is.
 */
export function ringSize(kind: PlaceKind): number {
  switch (kind) {
    case 'power': return 22;
    case 'transport': return 22;
    case 'roads': return 24;
    case 'homes': return 24;
    case 'study': return 20;
    case 'state': return 20;
    case 'care': return 18;
    case 'water': return 18;
    case 'city': return 16;
    case 'money': return 16;
    case 'company': return 16;
    case 'talk': return 14;
    default: return 14;
  }
}
