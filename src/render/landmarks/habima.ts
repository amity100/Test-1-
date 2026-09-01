/**
 * Habima Square, at the head of Rothschild Boulevard.
 *
 * Three institutions stand round one enormous raft of pale stone, and the raft
 * is the landmark. Karavan laid it in 2011 as a single unbroken sheet of paving
 * with concentric arcs cut across it, and dropped a circular garden into the
 * middle of it: seven wide rings of stone seating stepping down to a round lawn
 * with trees in it, three and a half metres below the square. Seen from the air
 * at night that ring is unmistakable — nowhere else in Tel Aviv has one.
 *
 * Round it: the Habima national theatre on the east, a white block behind a
 * colonnade of eleven tall square columns with a great blank wall above them
 * and the fly tower rising at the back; the Charles Bronfman Auditorium — the
 * Heichal — closing the north in one long shallow curve under a sweeping
 * canopy on thin steel columns; and the Helena Rubinstein Pavilion on the west,
 * small and boxy, a blind upper storey floating over a glazed ground floor.
 * Kadishman's tall thin steel blade stands out on the paving to the south-east,
 * where Rothschild leaves the square on the diagonal under its two rows of
 * ficus.
 *
 * Origin is the middle of the whole precinct at street level; −z is north, so
 * the Heichal is at negative z and the boulevard runs off the positive-z end.
 */

import * as THREE from 'three';
import type { Kit, Landmark } from './kit';
import { M } from './kit';

/** Kerb to kerb across the precinct, and up to the top of the fly tower. */
export const size: Landmark['size'] = { w: 222, h: 36, d: 208 };

const PI = Math.PI;

/** The raised paved raft: 100 m across, 96 m from the Heichal to Rothschild. */
const PZ = { west: -58, east: 42, north: -36, south: 60, top: 1.25 };

/** The sunken garden: seven rings of 2 m seating steps down to a 18 m lawn. */
const G = { x: -12, z: 10, r: 23, rings: 7, tread: 2, riser: 0.5 };
/** The lawn, three and a half metres under the square. */
const G_FLOOR = PZ.top - G.rings * G.riser;

/** The Heichal's front is one long shallow arc struck from far to the north. */
const HALL = { r: 140, cz: -186, half: 0.3948, segs: 9 };

/** Rothschild leaves the square on the diagonal, south-east. */
const ROTH = { a: 0.42, x: 19, z: 79 };

/**
 * Pale stone seen from the inside — the risers of the garden's rings are only
 * ever looked at from within the bowl, so they need their back faces drawn.
 */
const STONE_IN = M.stone.clone();
STONE_IN.side = THREE.DoubleSide;

/** A flat annulus of paving, which the kit has no shape for. */
function ring(k: Kit, ri: number, ro: number, mat: THREE.Material, x: number, y: number, z: number): void {
  const m = new THREE.Mesh(new THREE.RingGeometry(ri, ro, 48), mat);
  m.rotation.x = -PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  k.g.add(m);
}

/** An open drum, used for the step risers and for the skirt under the paving. */
function drum(k: Kit, r: number, h: number, y: number): void {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48, 1, true), STONE_IN);
  m.position.set(G.x, y, G.z);
  m.receiveShadow = true;
  k.g.add(m);
}

/** A point on the Heichal's arc, at a given radius out from its centre. */
function hallAt(phi: number, radius: number): [number, number] {
  return [Math.sin(phi) * radius, HALL.cz + Math.cos(phi) * radius];
}

/** A point on the boulevard: t metres along it, s metres off its middle line. */
function roth(t: number, s: number): [number, number] {
  const sa = Math.sin(ROTH.a);
  const ca = Math.cos(ROTH.a);
  return [ROTH.x + t * sa + s * ca, ROTH.z + t * ca - s * sa];
}

/** Roads, pavements and the precinct the three buildings stand in. */
function ground(k: Kit): void {
  k.slab(214, 204, M.asphalt, 0, 0, 0.02);
  k.slab(178, 188, M.concrete, -2, -2, 0.05);

  // Tarsat and Ibn Gvirol away to the west, the only real traffic here.
  k.slab(12, 192, M.asphalt, -104, -2, 0.06);
  k.box(0.5, 0.34, 192, M.concrete, -97.6, 0.17, -2);

  // Service roads behind the Heichal and behind the theatre's stage door.
  k.slab(186, 9, M.asphalt, 0, -95, 0.06);
  k.slab(9, 130, M.asphalt, 106, 4, 0.06);

  // The forecourt the Heichal's canopy reaches out over.
  k.slab(122, 24, M.stone, 0, -46, 0.08);
}

/**
 * The raft. Four sheets of paving leave a square hole for the garden, an apron
 * ring covers the corners of that hole, and two concentric arcs of darker stone
 * are cut across the whole thing the way Karavan drew them.
 */
function plaza(k: Kit): void {
  const hw = G.x - G.r;
  const he = G.x + G.r;
  const hn = G.z - G.r;
  const hs = G.z + G.r;

  const raft = (x0: number, x1: number, z0: number, z1: number) => {
    k.box(x1 - x0, PZ.top, z1 - z0, M.stone, (x0 + x1) / 2, PZ.top / 2, (z0 + z1) / 2);
  };
  raft(PZ.west, hw, PZ.north, PZ.south);
  raft(he, PZ.east, PZ.north, PZ.south);
  raft(hw, he, PZ.north, hn);
  raft(hw, he, hs, PZ.south);
  // The corners of that square hole, closed off by the paving round the garden.
  ring(k, G.r, 33, M.stone, G.x, PZ.top + 0.015, G.z);

  // Two arcs of darker stone, struck from the middle of the garden.
  ring(k, 34.5, 36, M.concrete, G.x, PZ.top + 0.03, G.z);
  ring(k, 43, 44.6, M.concrete, G.x, PZ.top + 0.03, G.z);

  // And three straight bands running out with Rothschild.
  for (let i = 0; i < 3; i++) {
    const [x, z] = roth(-40, 12 + i * 7);
    const b = k.box(1.3, 0.08, 26, M.concrete, x, PZ.top + 0.02, z);
    b.rotation.y = ROTH.a;
  }

  // The raft stands proud of the precinct all the way round.
  k.box(101, PZ.top, 0.7, M.stone, -8, PZ.top / 2, PZ.north - 0.35);
  k.box(101, PZ.top, 0.7, M.stone, -8, PZ.top / 2, PZ.south + 0.35);
  k.box(0.7, PZ.top, 97, M.stone, PZ.west - 0.35, PZ.top / 2, 12);
  k.box(0.7, PZ.top, 97, M.stone, PZ.east + 0.35, PZ.top / 2, 12);

  // Three flights off it: to Rothschild, to the pavilion, to the Heichal.
  for (let i = 1; i <= 3; i++) {
    const t = PZ.top - i * 0.31;
    k.box(46 - i * 2, t, 0.9, M.stone, 4, t / 2, PZ.south + 0.7 + (i - 1) * 0.9);
    k.box(0.9, t, 34 - i * 2, M.stone, PZ.west - 0.7 - (i - 1) * 0.9, t / 2, 6);
    k.box(40 - i * 2, t, 0.9, M.stone, -6, t / 2, PZ.north - 0.7 - (i - 1) * 0.9);
  }
}

/**
 * The sunken circular garden: rings of seating stone stepping down to a lawn
 * with three trees on it. Returns the lights sunk into the top ring, which are
 * what draws the circle out of the dark from the air.
 */
function garden(k: Kit): THREE.Mesh[] {
  for (let i = 0; i < G.rings; i++) {
    const outer = G.r - i * G.tread;
    const y = PZ.top - i * G.riser;
    ring(k, outer - G.tread, outer, M.stone, G.x, y, G.z);
    drum(k, outer - G.tread, G.riser, y - G.riser / 2);
  }
  // A skirt at the lip, so the hollow under the paving never shows.
  drum(k, G.r, 1.1, PZ.top - 0.55);

  // The lawn, and the ficus standing on it well below the square.
  k.cyl(9, 9, 0.5, M.green, 40, G.x, G_FLOOR - 0.25, G.z);
  for (let i = 0; i < 3; i++) {
    const a = 0.7 + (i * 2 * PI) / 3;
    const x = G.x + Math.cos(a) * 5.2;
    const z = G.z + Math.sin(a) * 5.2;
    const h = 6.5 + k.rnd() * 2;
    k.cyl(0.3, 0.44, h, M.wood, 6, x, G_FLOOR + h / 2, z);
    const crown = k.cyl(0.9, 3.0, 4.2, M.green, 7, x, G_FLOOR + h + 1.4, z);
    crown.rotation.y = k.rnd() * PI;
  }

  // Light in the top step, all the way round.
  const lamps: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * 2 * PI) / 10;
    const x = G.x + Math.sin(a) * 22;
    const z = G.z + Math.cos(a) * 22;
    const s = k.lit(4.6, 1.4, x, PZ.top + 0.04, z, a);
    s.rotation.order = 'YXZ';
    s.rotation.x = -PI / 2;
    lamps.push(k.lamp(0.22, x, PZ.top + 0.2, z, 0xffd7a0));
  }
  return lamps;
}

/**
 * The theatre: a stone plinth, eleven square columns fifteen metres tall, the
 * blank white wall over them, and the fly tower behind. Returns the light on
 * the fly tower and the lamps burning under the portico.
 */
function theatre(k: Kit): { beacon: THREE.Mesh; portico: THREE.Mesh[] } {
  k.box(60, 1.3, 76, M.stone, 73, 0.65, 6);
  k.box(50, 24, 64, M.plaster, 73, 13.3, 6);
  k.box(51, 0.9, 65, M.concrete, 73, 25.75, 6);

  // The colonnade, standing two metres clear of the foyer glass behind it.
  for (let i = 0; i < 11; i++) {
    k.box(1.9, 15, 1.9, M.plaster, 46, 8.8, -20 + i * 5.2);
  }
  k.box(8, 2.6, 60, M.plaster, 47, 17.6, 6);
  // The big blind wall above the portico, which carries nothing at all.
  k.box(1.2, 6.2, 60, M.plaster, 47.9, 22, 6);

  // Fly tower over the stage, and the plant beside it.
  k.box(26, 8, 32, M.plaster, 84, 29.3, 6);
  k.box(12, 3, 10, M.concrete, 60, 26.8, 26);
  k.cyl(0.26, 0.34, 1.8, M.metal, 6, 84, 34.2, 6);

  // The foyer glazing behind the columns, three storeys of it.
  for (const z of [-14, 6, 26]) k.lit(17, 10, 47.85, 7, z, -PI / 2);
  k.lit(52, 2, 47.85, 14.8, 6, -PI / 2);
  // The theatre's name, lit on the blind wall.
  k.lit(14, 2.2, 47.2, 21.4, 6, -PI / 2);
  // Rehearsal rooms and offices down the flanks; the stage door at the back.
  for (const y of [8, 16]) {
    k.lit(44, 2.2, 73, y, -26.2, PI);
    k.lit(44, 2.2, 73, y, 38.2, 0);
  }
  k.lit(30, 2.4, 98.2, 5, 6, PI / 2);
  k.lit(18, 2, 84, 29, -10.2, PI);

  // Lamps burning in the portico, between the columns rather than inside them.
  const portico = [-17.4, -7, 3.4, 13.8, 24.2]
    .map((z) => k.lamp(0.36, 44.6, 15.2, z, 0xffc27a));
  return { beacon: k.lamp(0.7, 84, 35.3, 6), portico };
}

/**
 * The Charles Bronfman Auditorium: one long shallow curve of pale wall behind a
 * canopy that sweeps out over the forecourt on thin steel columns.
 */
function heichal(k: Kit): void {
  const step = (HALL.half * 2) / (HALL.segs - 1);
  k.box(112, 22, 32, M.plaster, 0, 11, -76);
  k.box(114, 1, 34, M.concrete, 0, 22.5, -76);
  // The stage house at the back, and the plant on the roof.
  k.box(34, 4, 20, M.plaster, 0, 24, -84);
  k.box(18, 3.4, 11, M.concrete, -30, 23.7, -78);

  for (let i = 0; i < HALL.segs; i++) {
    const phi = -HALL.half + i * step;
    // The mass, its front face sitting square on the arc.
    const [mx, mz] = hallAt(phi, HALL.r - 8);
    const seg = k.box(15, 20, 16, M.plaster, mx, 10, mz);
    seg.rotation.y = phi;

    // The canopy over it, reaching eleven metres out over the forecourt.
    const [cx, cz] = hallAt(phi, HALL.r + 3);
    const can = k.box(15, 0.8, 16, M.concrete, cx, 11.5, cz);
    can.rotation.y = phi;

    // The foyer, glass from end to end under the canopy.
    const [gx, gz] = hallAt(phi, HALL.r + 0.4);
    k.lit(13.5, 8, gx, 5.4, gz, phi);
  }

  // The upper hall, lit above the canopy on concert nights.
  for (let i = 0; i < 5; i++) {
    const phi = -0.32 + i * 0.16;
    const [x, z] = hallAt(phi, HALL.r + 0.4);
    k.lit(20, 2.6, x, 16, z, phi);
  }

  // Four steel columns holding the leading edge of the canopy.
  for (let i = 0; i < 4; i++) {
    const phi = -0.3 + i * 0.2;
    const [x, z] = hallAt(phi, HALL.r + 9.5);
    k.cyl(0.3, 0.36, 11.1, M.metal, 6, x, 5.55, z);
    k.lamp(0.3, x, 10.7, z, 0xffd7a0);
  }
  // The lit fascia along the canopy's edge, facing the square.
  const [fx, fz] = hallAt(0, HALL.r + 10.9);
  k.lit(26, 1.3, fx, 10.6, fz);
}

/** The Helena Rubinstein Pavilion: a blind box floating over its glass. */
function pavilion(k: Kit): void {
  k.box(34, 1, 28, M.stone, -80, 0.5, 5);
  k.box(26, 4.4, 20, M.dark, -80, 3.2, 5);
  k.box(29, 6.2, 23, M.plaster, -80, 8.5, 5);
  k.box(30, 0.7, 24, M.concrete, -80, 11.95, 5);

  // Gallery glazing on all four sides, and the name over the entrance.
  k.lit(24, 3.6, -80, 3.2, 15.2, 0);
  k.lit(24, 3.6, -80, 3.2, -5.2, PI);
  k.lit(18, 3.6, -66.9, 3.2, 5, PI / 2);
  k.lit(18, 3.6, -93.1, 3.2, 5, -PI / 2);
  k.lit(9, 1.5, -65.4, 8.8, 5, PI / 2);

  for (let i = 1; i <= 2; i++) {
    const t = 1 - i * 0.34;
    k.box(0.8, t, 18 - i * 2, M.stone, -63.6 - (i - 1) * 0.8, t / 2, 5);
  }
  k.tree(-88, 26);
  k.tree(-70, 26);
  k.tree(-88, -14);
}

/**
 * Kadishman's blade on the paving south-east of the garden: one tall thin plate
 * of steel with a shorter one leaning off it, uplit from the plinth.
 */
function sculpture(k: Kit): THREE.Mesh[] {
  const x = 22;
  const z = 36;
  k.box(7, 0.5, 7, M.stone, x, PZ.top + 0.25, z);
  const blade = k.box(2.6, 15, 0.7, M.metal, x, PZ.top + 8, z);
  blade.rotation.z = 0.05;
  const small = k.box(1.7, 8.5, 0.6, M.metal, x + 2.5, PZ.top + 4.75, z + 0.9);
  small.rotation.z = -0.09;
  k.lit(2.3, 13, x, PZ.top + 7.6, z + 0.4);
  return [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]
    .map(([dx, dz]) => k.lamp(0.24, x + dx, PZ.top + 0.55, z + dz, 0xffb14a));
}

/** Rothschild running off the south-east corner between its two rows of ficus. */
function boulevard(k: Kit): void {
  const put = (w: number, h: number, mat: THREE.Material, s: number, y: number) => {
    const [x, z] = roth(0, s);
    const m = k.box(w, h, 40, mat, x, y, z);
    m.rotation.y = ROTH.a;
  };
  put(13, 0.3, M.stone, 0, 0.15);
  put(9, 0.14, M.asphalt, -12, 0.07);
  put(9, 0.14, M.asphalt, 12, 0.07);
  put(0.5, 0.3, M.concrete, -7, 0.15);
  put(0.5, 0.3, M.concrete, 7, 0.15);

  for (let i = 0; i < 4; i++) {
    const t = -15 + i * 10;
    const [ax, az] = roth(t, -5.4);
    const [bx, bz] = roth(t + 5, 5.4);
    k.tree(ax, az);
    k.tree(bx, bz);
  }
}

/**
 * Benches, bollards, flagpoles and the trees round the edge of the square.
 * Returns the flags on the theatre forecourt and the traffic on Ibn Gvirol.
 */
function furniture(k: Kit): {
  flags: Array<{ m: THREE.Mesh; ph: number }>;
  cars: Array<{ m: THREE.Mesh; base: number; v: number }>;
} {
  // Ficus round the precinct, on the ground beside the raft rather than in it.
  for (const z of [-26, 30, 48]) k.tree(-62, z);
  k.tree(-56, -40);
  k.tree(56, -40);
  k.tree(46, 50);
  k.tree(46, -34);
  k.tree(-40, 66);

  // Long stone benches out on the paving, the way the square is really used.
  k.box(6, 0.45, 1.1, M.stone, -40, PZ.top + 0.22, 46);
  k.box(6, 0.45, 1.1, M.stone, 26, PZ.top + 0.22, -22);
  k.box(1.1, 0.45, 6, M.stone, 34, PZ.top + 0.22, 14);
  k.box(6, 0.45, 1.1, M.stone, -34, PZ.top + 0.22, -26);

  // Tall lamp standards at the corners of the raft.
  for (const [x, z] of [[-52, -30], [36, -30], [-52, 54], [36, 54]]) {
    k.cyl(0.16, 0.22, 9, M.metal, 5, x, PZ.top + 4.5, z);
    k.lamp(0.36, x, PZ.top + 9.2, z, 0xffd7a0);
  }

  // Three flagpoles on the paving in front of the theatre's columns.
  const flags = [-8, 6, 20].map((z) => {
    k.cyl(0.13, 0.19, 12, M.metal, 6, 36, PZ.top + 6, z);
    return { m: k.box(3.2, 2, 0.12, M.canvas, 37.7, PZ.top + 10.2, z), ph: k.rnd() * 6 };
  });

  // Parked scooters and a delivery van at the theatre's stage door.
  for (let i = 0; i < 2; i++) {
    k.box(2, 1.3, 4.4, M.metal, 103.5, 0.7, -14 + i * 14 + k.rnd() * 4);
  }

  // Ibn Gvirol never empties: white going north, red going south.
  const cars = [0, 1, 2, 3, 4].map((i) => {
    const north = i % 2 === 0;
    return {
      m: k.lamp(0.5, north ? -107 : -101, 0.9, 0, north ? 0xffe0a8 : 0xff5470),
      base: k.rnd() * 200,
      v: north ? -27 - k.rnd() * 8 : 25 + k.rnd() * 8,
    };
  });
  return { flags, cars };
}

export function build(k: Kit): void {
  ground(k);
  plaza(k);
  const rim = garden(k);
  const hab = theatre(k);
  heichal(k);
  pavilion(k);
  const uplights = sculpture(k);
  boulevard(k);
  const { flags, cars } = furniture(k);

  k.onTick((t, st) => {
    // The light on the fly tower: slow while the theatre is somebody else's,
    // steady and quick once it is mine.
    const period = st.mine ? 1.3 : 2.4;
    hab.beacon.visible = !st.dark && t % period < period * 0.42;

    // The ring of light in the top step of the garden, brought up one lamp at a
    // time when the place is taken and simply burning otherwise.
    for (let i = 0; i < rim.length; i++) {
      const wave = st.mine ? 0.75 + 0.35 * Math.sin(t * 2 - i * 0.63) : 1;
      rim[i].scale.setScalar(wave);
      rim[i].visible = !st.dark;
    }

    // Uplighters on the sculpture, breathing.
    for (let i = 0; i < uplights.length; i++) {
      uplights[i].scale.setScalar(0.85 + Math.sin(t * 1.2 + i) * 0.15);
      uplights[i].visible = !st.dark;
    }

    // Lamps under the portico come on in sequence as the house fills.
    for (let i = 0; i < hab.portico.length; i++) {
      hab.portico[i].visible = !st.dark && (!st.mine || (t * 2 + i) % 5 > 1);
    }

    // The flags on the forecourt never hang still.
    for (const f of flags) {
      f.m.rotation.y = Math.sin(t * 1.6 + f.ph) * 0.24;
      f.m.rotation.z = Math.sin(t * 2.3 + f.ph) * 0.07;
    }

    for (const c of cars) {
      c.m.position.z = ((((c.base + t * c.v) % 200) + 200) % 200) - 100;
    }
  });
}
