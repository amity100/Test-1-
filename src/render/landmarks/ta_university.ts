/**
 * Tel Aviv University, Ramat Aviv.
 *
 * The city stops at the Yarkon and starts again as lawn. Everything else on
 * this map is dense — Florentin, the market, the boulevards — and the campus is
 * the one place that is mostly grass with buildings dropped into it, which is
 * exactly how it reads from the air at night: a dark green rectangle between
 * Einstein Street on the south, Haim Levanon on the east, Klausner on the west
 * and Brodetsky along the north, with the lit blocks standing separately in it
 * and the car parks pushed right out to the kerbs.
 *
 * The middle of it is Entin Square: a broad lawn with a round pool at the
 * crossing of four paths, two straight and two on the diagonal, worn in by
 * students taking the shortest line. Gilman closes the north side of it — one
 * very long low slab of pale plaster on a stone podium, banded, with concrete
 * brise-soleil fins the whole length of its sunny face and a lecture wing
 * behind. Round the rest of the square: the Naftali social sciences block
 * standing end-on to the east, the Mexico building of the arts and the blank
 * box of the Rosenblum hall to the west, the tall narrow Smolarz auditorium
 * and the domed rotunda on the south walk.
 *
 * Two things name the place on sight. One is Botta's Cymbalista synagogue out
 * on the north-east: twin stone towers, square at the bottom, round at the top,
 * standing side by side and nowhere else in Israel. The other is the running
 * track in the south-west corner, a terracotta oval round a green infield.
 *
 * Origin is the middle of Entin Square at ground level; −z is north, so Gilman
 * is at negative z and Einstein Street runs along the positive-z edge.
 */

import * as THREE from 'three';
import type { Kit, Landmark } from './kit';
import { M } from './kit';

/** Kerb to kerb, Klausner to Haim Levanon, and up to the top of the dome. */
export const size: Landmark['size'] = { w: 486, h: 30, d: 404 };

const PI = Math.PI;
/** One storey. Four Bauhaus storeys are 14 m, so 3.5 m apiece. */
const F = 3.5;

/** Entin Square: the lawn everything else is arranged around. */
const LAWN = { x: 0, z: 6, w: 194, d: 106, top: 0.34 };

/** Anything that can be turned off the campus grid. */
interface Sited { x: number; z: number; rot?: number }

/** A teaching block: footprint, storeys, and how it is turned. */
interface Blk extends Sited {
  w: number; d: number; floors: number;
  mat: THREE.Material;
  /** Vertical brise-soleil fins across the long sunny face. */
  fins?: number;
  /** Light the back of it as well as the front. */
  both?: boolean;
}

/** A world point from a building's own local (dx, dz). */
function local(b: Sited, dx: number, dz: number): [number, number] {
  const a = b.rot ?? 0;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [b.x + dx * c + dz * s, b.z - dx * s + dz * c];
}

/** Put and glow, both working in one building's local frame. */
function tools(k: Kit, b: Sited) {
  const rot = b.rot ?? 0;
  return {
    put(w: number, h: number, d: number, mat: THREE.Material,
      dx: number, y: number, dz: number): THREE.Mesh {
      const [x, z] = local(b, dx, dz);
      const m = k.box(w, h, d, mat, x, y, z);
      m.rotation.y = rot;
      return m;
    },
    glow(w: number, h: number, dx: number, y: number, dz: number, turn: number): void {
      const [x, z] = local(b, dx, dz);
      k.lit(w, h, x, y, z, rot + turn);
    },
  };
}

/**
 * A faculty building the way the campus builds them: a stone podium, a plain
 * mass, a spandrel band standing proud every second floor so the glazing
 * between reads as a deep recess, corner piers closing the ends of that
 * recess, and fins on the face that takes the sun.
 */
function faculty(k: Kit, b: Blk): void {
  const h = b.floors * F;
  const { put, glow } = tools(k, b);

  put(b.w + 5, 1, b.d + 5, M.stone, 0, 0.5, 0);
  put(b.w, h, b.d, b.mat, 0, 1 + h / 2, 0);
  put(b.w + 1.6, 0.8, b.d + 1.6, M.concrete, 0, 1.4 + h, 0);
  put(b.w * 0.26, 2.6, b.d * 0.42, M.concrete, b.w * 0.24, 3.1 + h, 0);

  for (let i = 2; i < b.floors; i += 2) {
    put(b.w + 0.9, 1.1, b.d + 0.9, M.concrete, 0, 1 + i * F, 0);
  }
  for (const sx of [-1, 1]) {
    put(2.4, h, b.d + 0.9, b.mat, sx * (b.w / 2 - 1.2), 1 + h / 2, 0);
  }
  const n = b.fins ?? 0;
  for (let i = 0; i < n; i++) {
    put(0.4, h - 1.4, 1.3, M.concrete,
      -b.w / 2 + (b.w * (i + 0.5)) / n, 1 + (h - 1.4) / 2, b.d / 2 + 0.6);
  }

  // Lit ribbons sunk behind the bands, floor by floor.
  for (let i = 0; i < b.floors; i++) {
    glow(b.w - 5, 2, 0, 1 + i * F + 2, b.d / 2 + 0.12, 0);
    if (b.both && i % 2 === 1) glow(b.w - 5, 2, 0, 1 + i * F + 2, -b.d / 2 - 0.12, PI);
  }
  glow(b.d - 6, 2, -b.w / 2 - 0.12, 1 + F + 2, 0, -PI / 2);
}

/** The same building with the detail turned down, for the far edges. */
function block(k: Kit, b: Blk): void {
  const h = b.floors * F;
  const { put, glow } = tools(k, b);
  put(b.w + 4, 0.9, b.d + 4, M.stone, 0, 0.45, 0);
  put(b.w, h, b.d, b.mat, 0, 0.9 + h / 2, 0);
  put(b.w + 1.4, 0.7, b.d + 1.4, M.concrete, 0, 1.25 + h, 0);
  put(b.w + 0.8, 1, b.d + 0.8, M.concrete, 0, 0.9 + h / 2, 0);
  glow(b.w - 5, 2, 0, 0.9 + F + 1.9, b.d / 2 + 0.12, 0);
  glow(b.w - 5, 2, 0, 0.9 + (b.floors - 1) * F + 1.9, -b.d / 2 - 0.12, PI);
}

/** A copse. Cheaper than twenty trunks and reads the same from the air. */
function grove(k: Kit, x: number, z: number, r: number): void {
  const m = k.cyl(r * 0.82, r * 0.66, 9, M.green, 7, x, 4.5, z);
  m.rotation.y = k.rnd() * PI;
}

/** Streets, the service loop, and the car parks out at the kerbs. */
function ground(k: Kit): void {
  // The campus is grass first; everything paved is laid on top of it.
  k.slab(486, 404, M.green, 0, 0, 0.02);

  k.slab(486, 18, M.asphalt, 0, 190, 0.05);
  k.slab(18, 404, M.asphalt, 232, 0, 0.05);
  k.slab(12, 404, M.asphalt, -236, 0, 0.05);
  k.slab(486, 12, M.asphalt, 0, -194, 0.05);
  k.box(486, 0.35, 0.6, M.concrete, 0, 0.17, 180.5);
  k.box(0.6, 0.35, 404, M.concrete, 222.5, 0.17, 0);

  // The service loop, which is as close as a car gets to the middle.
  k.slab(370, 9, M.asphalt, -4, -182, 0.06);
  k.slab(9, 320, M.asphalt, 206, -12, 0.06);
  k.slab(310, 9, M.asphalt, 50, 146, 0.06);
  k.slab(9, 300, M.asphalt, -216, -20, 0.06);

  // Car parks along Einstein and behind Haim Levanon.
  k.slab(162, 30, M.asphalt, 101, 166, 0.07);
  k.slab(28, 128, M.asphalt, 216, 26, 0.07);
  k.slab(72, 24, M.asphalt, -66, 166, 0.07);
  for (let i = 0; i < 3; i++) {
    k.box(0.3, 0.06, 26, M.plaster, 40 + i * 60, 0.11, 166);
  }
  for (let i = 0; i < 5; i++) {
    k.box(1.9, 1.4, 4.4, M.metal, 28 + i * 36 + k.rnd() * 6, 0.8, 157 + (i % 2) * 17);
  }
}

/**
 * Entin Square: the kerbed lawn, the paving along Gilman and the south walk,
 * four paths crossing, and the round pool where they meet.
 */
function square(k: Kit): { water: THREE.Mesh; jet: THREE.Mesh } {
  k.box(LAWN.w + 7, 0.28, LAWN.d + 7, M.stone, LAWN.x, 0.14, LAWN.z);
  k.box(LAWN.w, LAWN.top, LAWN.d, M.green, LAWN.x, LAWN.top / 2, LAWN.z);
  k.box(184, 0.32, 30, M.stone, 0, 0.16, -62);
  k.box(212, 0.32, 26, M.stone, 6, 0.16, 74);

  const y = LAWN.top + 0.05;
  k.box(LAWN.w, 0.08, 7, M.sand, LAWN.x, y, LAWN.z);
  k.box(7, 0.08, LAWN.d, M.sand, LAWN.x, y, LAWN.z);
  for (const a of [0.52, -0.52]) {
    k.box(204, 0.08, 5.5, M.sand, LAWN.x, y, LAWN.z).rotation.y = a;
  }

  k.cyl(9.6, 9.6, 1, M.stone, 28, LAWN.x, 0.5, LAWN.z);
  const water = k.cyl(8.8, 8.8, 0.8, M.water, 28, LAWN.x, 0.62, LAWN.z);
  const jet = k.cyl(0.3, 0.55, 5, M.water, 6, LAWN.x, 3.4, LAWN.z);
  return { water, jet };
}

/**
 * The Gilman building: one long banded slab shutting off the north side of the
 * square, its fins facing the lawn, with the lecture wing behind it.
 */
function gilman(k: Kit): void {
  faculty(k, { x: 0, z: -88, w: 176, d: 22, floors: 5, mat: M.plaster, fins: 6, both: true });

  // The porch on the square, on three thin columns.
  k.box(32, 0.8, 12, M.concrete, 0, 6.4, -70);
  for (const x of [-13, 0, 13]) k.box(1.3, 6, 1.3, M.concrete, x, 3, -66);
  k.lit(26, 2.4, 0, 3.6, -76.6, 0);

  // The wing at the back, where the big lecture halls are.
  k.box(36, 14, 32, M.plaster, -64, 7.9, -114);
  k.box(37.4, 0.8, 33.4, M.concrete, -64, 15.3, -114);
  k.lit(26, 2.2, -82.2, 5.5, -114, -PI / 2);
  k.lit(26, 2.2, -82.2, 11.5, -114, -PI / 2);
}

/** The faculties standing round the square and out along the loop road. */
function faculties(k: Kit): void {
  // Naftali, social sciences, end-on to the square on the east.
  faculty(k, {
    x: 146, z: -26, w: 78, d: 42, floors: 6, mat: M.plaster, rot: -PI / 2, fins: 6, both: true,
  });
  // The Mexico building of the arts on the west, facing back across the grass.
  faculty(k, {
    x: -148, z: 4, w: 72, d: 40, floors: 4, mat: M.stone, rot: PI / 2, fins: 6,
  });
  // Rosenblum: a concert hall is a blank box with a lit foyer stuck on it.
  k.box(46, 17, 38, M.concrete, -148, 8.5, 76);
  k.box(48, 0.9, 40, M.concrete, -148, 17.5, 76);
  k.box(30, 5, 8, M.dark, -148, 2.5, 53);
  k.lit(26, 3.4, -148, 2.6, 48.9, PI);
  k.lit(12, 1.8, -148, 12, 56.8, PI);

  // The Sourasky library, north-west behind Gilman.
  faculty(k, { x: -156, z: -96, w: 56, d: 46, floors: 4, mat: M.plaster });

  // Exact sciences strung along the north: physics, maths, chemistry.
  block(k, { x: -62, z: -152, w: 52, d: 36, floors: 4, mat: M.concrete });
  block(k, { x: 14, z: -152, w: 44, d: 38, floors: 5, mat: M.plaster });
  block(k, { x: 88, z: -150, w: 44, d: 34, floors: 4, mat: M.concrete });

  // Engineering, out on the east side of the loop.
  block(k, { x: 170, z: 58, w: 56, d: 46, floors: 5, mat: M.plaster, rot: 0.12 });
  block(k, { x: 176, z: 120, w: 44, d: 34, floors: 3, mat: M.concrete, rot: 0.12 });

  // The museum block on the north-west, long and deliberately blind.
  block(k, { x: -172, z: -158, w: 62, d: 34, floors: 3, mat: M.concrete });

  // The environmental school on the north-east: one curved five-storey arc.
  for (let i = 0; i < 4; i++) {
    const a = -0.54 + i * 0.36;
    k.box(15, 17.5, 15, M.plaster, 176 + Math.sin(a) * 30, 8.75, -172 + Math.cos(a) * 30)
      .rotation.y = a;
    if (i % 2 === 0) k.lit(13, 2.4, 176 + Math.sin(a) * 22.4, 6, -172 + Math.cos(a) * 22.4, a + PI);
  }
  // A band of planting up the convex face of it — the thing it is known for.
  k.box(2.4, 15, 44, M.green, 198, 7.5, -172).rotation.y = 0.1;
}

/**
 * The rotunda on the south walk: a stone drum under a metal dome, with a
 * lantern on top. Returns the light on the lantern.
 */
function rotunda(k: Kit): THREE.Mesh {
  const x = -44;
  const z = 96;
  k.cyl(20, 21, 1, M.stone, 28, x, 0.5, z);
  k.cyl(15, 15, 9, M.plaster, 28, x, 5.5, z);
  k.cyl(16.4, 16.4, 0.9, M.concrete, 28, x, 10.4, z);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(15, 24, 10, 0, PI * 2, 0, PI / 2), M.metal,
  );
  dome.position.set(x, 10.8, z);
  dome.castShadow = true;
  dome.receiveShadow = true;
  k.g.add(dome);
  k.cyl(1.5, 2.1, 2.4, M.metal, 8, x, 26.4, z);

  // Slot windows round the drum, and the doors facing the square.
  for (let i = 0; i < 5; i++) {
    const a = -1.1 + i * 0.55;
    k.lit(5, 4, x + Math.sin(a) * 15.15, 6, z - Math.cos(a) * 15.15, PI - a);
  }
  return k.lamp(0.5, x, 28, z, 0xff5470);
}

/**
 * The Smolarz auditorium: tall, narrow, blank down both flanks because there
 * is a raked hall inside, with a glazed foyer and a canopy on the square side.
 */
function smolarz(k: Kit): void {
  const x = 58;
  const z = 96;
  k.box(46, 1, 72, M.stone, x, 0.5, z - 8);
  k.box(30, 24, 42, M.plaster, x, 13, z);
  k.box(32, 0.9, 44, M.concrete, x, 25.4, z);
  k.box(11, 2.6, 13, M.concrete, x + 6, 27.2, z + 6);
  // Ribs down the blank east flank.
  for (let i = 0; i < 3; i++) {
    k.box(0.7, 23, 1.2, M.concrete, x + 15.6, 12.5, z - 13 + i * 13);
  }
  // Foyer, canopy and the steps up to it.
  k.box(34, 6.5, 12, M.dark, x, 4.25, z - 27);
  k.box(40, 0.8, 17, M.concrete, x, 8.1, z - 29);
  for (const cx of [-17, 17]) k.cyl(0.3, 0.36, 6.7, M.metal, 6, x + cx, 4.35, z - 36);
  for (let i = 1; i <= 2; i++) {
    k.box(34 - i * 3, 1 - i * 0.33, 1.7, M.stone, x, (1 - i * 0.33) / 2, z - 42.85 - i * 1.7);
  }
  k.lit(30, 4.4, x, 4.4, z - 33.1, PI);
  k.lit(14, 1.8, x, 10.6, z - 21.2, PI);
  k.lit(24, 2, x - 15.2, 20, z, -PI / 2);
  k.lit(24, 2, x + 15.2, 8, z, PI / 2);
}

/**
 * Botta's Cymbalista synagogue on the north-east: two towers side by side,
 * square where they stand and round where they finish, with the low entrance
 * hall between them.
 */
function cymbalista(k: Kit): void {
  const x = 176;
  const z = -112;
  k.box(46, 0.9, 34, M.stone, x, 0.45, z);
  for (const dx of [-9.5, 9.5]) {
    k.box(13, 11, 13, M.stone, x + dx, 6.4, z);
    k.cyl(6.2, 6.6, 8, M.stone, 20, x + dx, 15.9, z);
    // Light spills out of the slot at the top of each drum.
    k.lit(5.5, 2, x + dx, 18.4, z + 6.05, 0);
    k.lit(7, 5, x + dx, 5.5, z + 6.6, 0);
  }
  k.box(26, 5, 12, M.stone, x, 2.5, z + 15);
  k.lit(18, 2.6, x, 2.6, z + 21.1, 0);
}

/**
 * The sports ground in the south-west corner: a terracotta oval round a green
 * infield, a small stand, and the floodlights. Returns the floodlights.
 */
function sports(k: Kit): THREE.Mesh[] {
  const x = -160;
  const z = 138;
  const track = new THREE.Mesh(new THREE.RingGeometry(24, 31, 44), M.tile);
  track.rotation.x = -PI / 2;
  track.scale.set(1.65, 1, 1);
  track.position.set(x, 0.09, z);
  track.receiveShadow = true;
  k.g.add(track);
  k.cyl(24, 24, 0.16, M.green, 36, x, 0.08, z).scale.set(1.65, 1, 1);

  k.box(44, 5, 9, M.concrete, x, 2.5, z + 36);
  k.lit(38, 1.6, x, 3.4, z + 31.4, PI);
  const flood: THREE.Mesh[] = [];
  for (const dx of [-46, 46]) {
    k.cyl(0.3, 0.45, 20, M.metal, 6, x + dx, 10, z - 26);
    flood.push(k.lamp(0.8, x + dx, 20.4, z - 26, 0xfff0c4));
  }
  return flood;
}

/**
 * The things that make it a campus and not an industrial estate: the trees,
 * the botanical garden on the west, the lamps along the main path, the flags
 * on the square and the gate on Einstein Street.
 */
function furniture(k: Kit): { flags: THREE.Mesh[]; posts: THREE.Mesh[] } {
  // Ficus down both sides of the square, along the walks, and in the gaps
  // between one faculty and the next.
  for (const [x, z] of [
    [-100, -56], [-58, -54], [58, -54], [100, -56],
    [-104, 64], [-58, 68], [32, 68], [96, 66],
    [-118, 10], [118, 10], [-20, 56], [18, 56],
    [-20, -118], [110, -120], [146, -92], [140, 90],
  ]) k.tree(x, z);

  // The botanical garden runs the length of Klausner; the rest are the copses
  // left standing in the gaps between one faculty and the next.
  grove(k, -198, -68, 11);
  grove(k, -198, -20, 12);
  grove(k, -198, 40, 10);
  grove(k, -196, 100, 10);
  grove(k, -110, -150, 12);
  grove(k, 48, -116, 10);
  grove(k, 192, -176, 9);
  grove(k, 198, 168, 9);

  // Lamp standards down the length of the main path.
  const posts: THREE.Mesh[] = [];
  for (const px of [-72, -26, 26, 72]) {
    k.cyl(0.15, 0.22, 8, M.metal, 5, px, 4.3, LAWN.z - 6);
    posts.push(k.lamp(0.34, px, 8.5, LAWN.z - 6, 0xffd7a0));
  }

  // Two flagpoles at the head of the square, in front of Gilman.
  const flags: THREE.Mesh[] = [];
  for (const px of [-12, 12]) {
    k.cyl(0.12, 0.18, 14, M.metal, 6, px, 7, -56);
    flags.push(k.box(3, 1.9, 0.1, M.canvas, px + 1.6, 12.2, -56));
  }

  // Gate 2 on Einstein: two stone piers, a barrier, the guard's booth, and the
  // university's name lit on the wall beside it.
  k.box(1.8, 5.4, 1.8, M.stone, -20, 2.7, 178);
  k.box(1.8, 5.4, 1.8, M.stone, 4, 2.7, 178);
  k.box(4.4, 3, 4, M.plaster, 10, 1.5, 176);
  k.box(11, 0.3, 0.3, M.metal, -8, 1.4, 178);
  k.box(10, 5, 0.7, M.stone, -34, 2.5, 179.6);
  k.lit(3.4, 1.6, 10, 2, 178.1, 0);
  k.lit(8, 2.2, -34, 3.2, 180, 0);
  posts.push(k.lamp(0.34, -8, 6.2, 178, 0xffd7a0));
  return { flags, posts };
}

/** Headlights on Einstein and on Haim Levanon, which never quite stop. */
function traffic(k: Kit): Array<{ m: THREE.Mesh; base: number; v: number; axis: 'x' | 'z' }> {
  const out: Array<{ m: THREE.Mesh; base: number; v: number; axis: 'x' | 'z' }> = [];
  for (let i = 0; i < 2; i++) {
    const east = i === 0;
    out.push({
      m: k.lamp(0.5, 0, 0.9, east ? 186 : 194, east ? 0xffe0a8 : 0xff5470),
      base: k.rnd() * 480, v: east ? 24 + k.rnd() * 9 : -22 - k.rnd() * 9, axis: 'x',
    });
  }
  for (let i = 0; i < 2; i++) {
    const north = i === 0;
    out.push({
      m: k.lamp(0.5, north ? 228 : 236, 0.9, 0, north ? 0xffe0a8 : 0xff5470),
      base: k.rnd() * 400, v: north ? -26 - k.rnd() * 8 : 25 + k.rnd() * 8, axis: 'z',
    });
  }
  return out;
}

export function build(k: Kit): void {
  ground(k);
  const pool = square(k);
  gilman(k);
  faculties(k);
  const beacon = rotunda(k);
  smolarz(k);
  cymbalista(k);
  const flood = sports(k);
  const { flags, posts } = furniture(k);
  const cars = traffic(k);

  k.onTick((t, st) => {
    // The pool: the surface turns slowly and the jet breathes, harder once the
    // campus is mine and somebody has thought to open the valve.
    pool.water.rotation.y = t * 0.05;
    const push = st.mine ? 1.5 : 0.7;
    pool.jet.scale.y = push * (0.85 + Math.sin(t * 1.7) * 0.15);
    pool.jet.position.y = 0.9 + 2.5 * pool.jet.scale.y;

    // The warning light on the lantern of the dome — the highest thing here.
    const period = st.mine ? 1.2 : 2.6;
    beacon.visible = !st.dark && t % period < period * 0.4;

    // Floodlights over the track burn all night, and come up when it is mine.
    for (let i = 0; i < flood.length; i++) {
      flood[i].visible = !st.dark;
      flood[i].scale.setScalar(st.mine ? 1.15 : 0.85 + Math.sin(t * 0.9 + i) * 0.06);
    }

    // The lamps down the main path run one after another when the place is
    // taken, and simply stand lit the rest of the time.
    for (let i = 0; i < posts.length; i++) {
      posts[i].visible = !st.dark;
      posts[i].scale.setScalar(st.mine ? 0.8 + 0.4 * Math.sin(t * 2.4 - i * 0.8) : 1);
    }

    for (let i = 0; i < flags.length; i++) {
      flags[i].rotation.y = Math.sin(t * 1.5 + i * 2.1) * 0.26;
      flags[i].rotation.z = Math.sin(t * 2.2 + i) * 0.07;
    }

    for (const c of cars) {
      const span = c.axis === 'x' ? 486 : 404;
      const p = ((((c.base + t * c.v) % span) + span) % span) - span / 2;
      if (c.axis === 'x') c.m.position.x = p; else c.m.position.z = p;
    }
  });
}
