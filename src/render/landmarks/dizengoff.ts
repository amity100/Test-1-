import * as THREE from 'three';
import type { Kit, Landmark } from './kit';
import { M } from './kit';

/**
 * DIZENGOFF SQUARE — כיכר דיזנגוף — the raised circle.
 *
 * Genia Averbuch won the 1934 competition with a drawing of one idea: a perfect
 * circle of identical white buildings, three storeys, every corner rounded, a
 * continuous horizontal balcony band running round the whole ring like a line
 * drawn with a compass. That ring is still there and it is what names the place
 * from the air — nowhere else in Tel Aviv is a circle of buildings.
 *
 * In 1978 the junction underneath it was rebuilt: the plaza was lifted a whole
 * storey onto a concrete deck sixty metres across and the traffic was sent
 * through the undercroft beneath it, so the square became a disc floating over
 * a roundabout, reached by wide stairs and long ramps from the pavements. That
 * is the version drawn here, because that is the version everyone pictures.
 *
 * Five streets meet under it, which is the other half of the shape: Dizengoff
 * Street comes in from the north and leaves to the south, Zamenhof runs off to
 * the north-east, Pinsker to the south-south-west and Reines to the west. The
 * gaps between those five mouths are exactly where the five arcs of Bauhaus
 * frontage sit, each one ending in a fat rounded corner at the street.
 *
 * In the middle, on the deck, is Yaacov Agam's FIRE AND WATER FOUNTAIN (1986):
 * a round black drum in a round pool carrying a stack of brightly painted
 * squares and rings that turn against each other. Seen from directly above —
 * which is how the player sees it — it reads as concentric coloured circles and
 * squares slowly sliding out of alignment, and nothing else looks like it. It
 * is the one object on this map painted in colours that are not night-grey; the
 * comment on AGAM below says why.
 *
 * Origin is the centre of the deck at ROAD level, so the plaza surface is at
 * +5.84 m and the roundabout runs underneath at zero. The stated footprint
 * runs out to the ends of the five street stubs; the ring of buildings itself
 * is 117 m across. About 260 meshes and 68 lit faces, most of both spent on the
 * frontage and on the fountain.
 */

export const size: Landmark['size'] = { w: 138, h: 19, d: 138 };

/** The raised deck. */
const DECK_R = 30;
const DECK_THICK = 0.85;
/** Top of the structural slab, then the paving laid on it. */
const DECK_TOP = 5.7;
const PLAZA = DECK_TOP + 0.14;

/** Where the Bauhaus façades stand, and how deep the blocks behind them are. */
const FACE_R = 44.5;
const BLOCK_D = 14;
const FLOOR = 3.35;
const GROUND_FLOOR = 4.0;

/**
 * Agam's colours. Everything else in this city is drawn out of the shared
 * night palette so that fifty landmarks look like one town, but the fountain is
 * the single object in Tel Aviv that is defined by being brightly painted, and
 * a grey Agam is not an Agam. Five enamels, faintly self-lit so they still read
 * at two in the morning.
 */
const AGAM: THREE.MeshStandardMaterial[] = [
  new THREE.MeshStandardMaterial({ color: 0xc4392c, emissive: 0x3e0f09, roughness: 0.5 }),
  new THREE.MeshStandardMaterial({ color: 0x2270b4, emissive: 0x081f37, roughness: 0.5 }),
  new THREE.MeshStandardMaterial({ color: 0xd8a521, emissive: 0x3a2a06, roughness: 0.5 }),
  new THREE.MeshStandardMaterial({ color: 0x2f8f57, emissive: 0x0b2a19, roughness: 0.5 }),
  new THREE.MeshStandardMaterial({ color: 0xd8631f, emissive: 0x3a1706, roughness: 0.5 }),
];

/** The five street mouths, as compass bearings out from the centre. */
const ARMS: Array<{ b: number; w: number }> = [
  { b: 355, w: 19 }, // Dizengoff Street, north
  { b: 68, w: 15 }, // Zamenhof
  { b: 175, w: 19 }, // Dizengoff Street, south
  { b: 203, w: 14 }, // Pinsker
  { b: 275, w: 15 }, // Reines
];

/** The five arcs of frontage that fill the gaps between those mouths. */
const BLOCKS: Array<{ a0: number; a1: number; storeys: number }> = [
  { a0: 7, a1: 58, storeys: 4 }, // north-east, Dizengoff round to Zamenhof
  { a0: 78, a1: 163, storeys: 4 }, // the long east side
  { a0: 186, a1: 194, storeys: 3 }, // the thin wedge between Dizengoff and Pinsker
  { a0: 212, a1: 265, storeys: 3 }, // south-west, round to Reines
  { a0: 285, a1: 344, storeys: 4 }, // north-west — the cinema side
];

/** Where the deck can be got on and off: three stairs and two long ramps. */
const STAIRS = [32, 145, 240];
const RAMPS = [90, 300];
/** A ramp climbs along the tangent and lands on the rim 19 degrees further on. */
const RAMP_TOP = RAMPS.map((b) => b + 19);

const rad = (deg: number) => (deg * Math.PI) / 180;

/** A point on the circle: bearing in degrees, north is −z, east is +x. */
function at(bearing: number, r: number): [number, number] {
  const a = rad(bearing);
  return [Math.sin(a) * r, -Math.cos(a) * r];
}

/**
 * A box standing on the ring with its front face turned in to the square. Yaw
 * of −bearing sends the box's local +z at the centre and its local +x along the
 * tangent, so width runs round the circle and depth runs back off it.
 */
function ringBox(k: Kit, w: number, h: number, d: number, mat: THREE.Material,
  b: number, r: number, y: number): THREE.Mesh {
  const [x, z] = at(b, r);
  const m = k.box(w, h, d, mat, x, y, z);
  m.rotation.y = -rad(b);
  return m;
}

/** A lit face on that same ring, glowing back towards the plaza. */
function ringLit(k: Kit, w: number, h: number, b: number, r: number, y: number): THREE.Mesh {
  const [x, z] = at(b, r);
  return k.lit(w, h, x, y, z, -rad(b));
}

/** A flat annulus of paving, which the kit has no shape for. */
function pavingRing(k: Kit, ri: number, ro: number, mat: THREE.Material, y: number): void {
  const m = new THREE.Mesh(new THREE.RingGeometry(ri, ro, 44), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  k.g.add(m);
}

/** Height of a block of n storeys, parapet included. */
const blockH = (storeys: number) => GROUND_FLOOR + (storeys - 1) * FLOOR + 1.0;

/** The road, the pavements and the five streets running in under the deck. */
function ground(k: Kit): void {
  k.slab(138, 138, M.asphalt, 0, 0, 0.02);
  // One disc of pavement, its rim standing 16 cm proud as the kerb.
  k.cyl(38, 38, 0.32, M.concrete, 44, 0, 0, 0);
  // The roundabout carriageway itself, most of it roofed by the deck.
  k.cyl(31, 31, 0.06, M.asphalt, 44, 0, 0.19, 0);
  // The island the traffic turns around, carrying the deck's central core.
  k.cyl(11.5, 12, 0.55, M.concrete, 24, 0, 0.27, 0);

  for (const arm of ARMS) {
    ringBox(k, arm.w, 0.06, 44, M.asphalt, arm.b, 46, 0.2);
  }
}

/** The concrete disc, what holds it up, and what stands on it. */
function deck(k: Kit, lamps: THREE.Mesh[]): void {
  // Slab, slightly undercut so the edge throws a shadow line all the way round.
  k.cyl(DECK_R, DECK_R - 0.6, DECK_THICK, M.concrete, 40, 0, DECK_TOP - DECK_THICK / 2, 0);
  k.cyl(DECK_R - 0.6, DECK_R - 0.6, 0.14, M.sand, 40, 0, DECK_TOP + 0.07, 0);
  pavingRing(k, 10.2, 14.6, M.concrete, PLAZA + 0.02);
  pavingRing(k, 20.4, 24.8, M.concrete, PLAZA + 0.02);

  // Core and columns in the undercroft.
  k.cyl(6, 6.4, DECK_TOP - DECK_THICK - 0.55, M.concrete, 16, 0, (DECK_TOP - DECK_THICK + 0.55) / 2, 0);
  for (let i = 0; i < 8; i++) {
    const [x, z] = at(i * 45, 21);
    k.cyl(0.85, 0.95, DECK_TOP - DECK_THICK - 0.2, M.concrete, 8, x, (DECK_TOP - DECK_THICK) / 2 + 0.1, z);
  }
  // Strip lights on the underside, so the undercroft glows over the traffic.
  for (let i = 0; i < 4; i++) {
    const [x, z] = at(45 + i * 90, 19);
    const m = k.lit(9, 3, x, DECK_TOP - DECK_THICK - 0.06, z);
    m.rotation.set(Math.PI / 2, 0, rad(45 + i * 90));
  }

  // Parapet round the rim, broken wherever a stair or a ramp arrives.
  const gaps = [...STAIRS, ...RAMPS, ...RAMP_TOP];
  for (let b = 0; b < 360; b += 20) {
    const clear = gaps.every((g) => Math.abs(((b - g + 540) % 360) - 180) > 13);
    if (clear) ringBox(k, 10.6, 1.05, 0.45, M.concrete, b, 29.4, PLAZA + 0.52);
  }

  // Three lamp standards, the planters between them, and the kiosk.
  for (let i = 0; i < 3; i++) {
    const [x, z] = at(i * 120 + 15, 25.5);
    k.cyl(0.16, 0.24, 4.6, M.metal, 6, x, PLAZA + 2.3, z);
    lamps.push(k.lamp(0.36, x, PLAZA + 4.75, z, 0xffd9a0));
  }
  for (let i = 0; i < 2; i++) {
    const [x, z] = at(60 + i * 170, 23.5);
    k.cyl(2.2, 2.4, 0.9, M.concrete, 12, x, PLAZA + 0.45, z);
    k.cyl(0.5, 2.0, 3.4, M.green, 7, x, PLAZA + 2.6, z);
  }
  const [kx, kz] = at(200, 21.5);
  ringBox(k, 5, 3, 3.6, M.plaster, 200, 21.5, PLAZA + 1.5);
  ringBox(k, 5.8, 0.14, 2.0, M.canvas, 200, 19.6, PLAZA + 3.1);
  ringLit(k, 4.2, 1.6, 200, 19.7, PLAZA + 1.8);
  lamps.push(k.lamp(0.22, kx, PLAZA + 3.4, kz, 0xffbe6a));

  // Light let into the paving, running out from the fountain.
  for (let i = 0; i < 4; i++) {
    const b = 45 + i * 90;
    const [x, z] = at(b, 19);
    const m = k.lit(1.1, 16, x, PLAZA + 0.05, z);
    m.rotation.set(-Math.PI / 2, 0, -rad(b));
  }
}

/** The stairs and ramps up off the pavement. */
function approaches(k: Kit): void {
  // Stairs: each tread a full-height block, so the flight reads as solid mass.
  const steps = 5;
  for (const b of STAIRS) {
    for (let i = 0; i < steps; i++) {
      const top = PLAZA - (i * PLAZA) / steps;
      ringBox(k, 11, top, 1.4, M.concrete, b, DECK_R + 0.75 + i * 1.4, top / 2);
    }
  }
  // Ramps: long, shallow, laid along the tangent and hugging the drum. Rolling
  // about the local z axis after the yaw tips the tangent, not the radius.
  for (let i = 0; i < RAMPS.length; i++) {
    const b = RAMPS[i];
    const tilt = Math.atan2(PLAZA, 23);
    const slope = ringBox(k, 23, 0.55, 5, M.concrete, b, 33.5, PLAZA / 2 + 0.2);
    slope.rotation.set(0, -rad(b), tilt, 'YXZ');
    const wall = ringBox(k, 23, 1.0, 0.35, M.concrete, b, 36.2, PLAZA / 2 + 0.7);
    wall.rotation.set(0, -rad(b), tilt, 'YXZ');
    // The landing where the top of the ramp meets the rim of the deck.
    ringBox(k, 5.5, 0.5, 7, M.concrete, RAMP_TOP[i], 32.5, PLAZA - 0.25);
  }
}

/** One jet of water, remembered so it can be made to breathe. */
interface Jet { m: THREE.Mesh; base: number; h: number }

interface Fountain { tiers: THREE.Group[]; jets: Jet[]; fire: THREE.Mesh[]; water: THREE.Mesh }

/** A square frame of painted bar, four sides, lying flat. */
function squareFrame(g: THREE.Group, side: number, bar: number, mat: THREE.Material): void {
  const long = new THREE.BoxGeometry(side, bar, bar);
  const short = new THREE.BoxGeometry(bar, bar, side - bar * 2);
  const put = (geo: THREE.BufferGeometry, x: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 0, z);
    m.castShadow = true;
    g.add(m);
  };
  const e = side / 2 - bar / 2;
  put(long, 0, e);
  put(long, 0, -e);
  put(short, e, 0);
  put(short, -e, 0);
}

/** A painted ring, lying flat. The kit has no torus and this needs one. */
function flatRing(g: THREE.Group, r: number, tube: number, mat: THREE.Material): void {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 26), mat);
  m.rotation.x = -Math.PI / 2;
  m.castShadow = true;
  g.add(m);
}

/** Agam's fire and water fountain, standing in the middle of the deck. */
function agamFountain(k: Kit): Fountain {
  // Pool: a low drum of concrete with the water flush at its lip.
  k.cyl(9.2, 9.7, 0.9, M.concrete, 32, 0, PLAZA + 0.45, 0);
  const water = k.cyl(8.5, 8.5, 0.1, M.water, 32, 0, PLAZA + 0.82, 0);
  // The black hub the whole sculpture is hung on.
  k.cyl(1.6, 1.9, 2.9, M.dark, 14, 0, PLAZA + 2.35, 0);
  for (let i = 0; i < 4; i++) ringLit(k, 1.5, 1.2, i * 90 + 45, 1.85, PLAZA + 2.2);

  // Six tiers, squares and rings alternating, each free to turn on its own.
  const spec: Array<{ y: number; r: number; ring: boolean }> = [
    { y: 1.5, r: 4.9, ring: false },
    { y: 2.4, r: 4.2, ring: true },
    { y: 3.3, r: 3.6, ring: false },
    { y: 4.2, r: 3.0, ring: true },
    { y: 5.0, r: 2.3, ring: false },
    { y: 5.7, r: 1.6, ring: true },
  ];
  const tiers: THREE.Group[] = [];
  spec.forEach((s, i) => {
    const g = new THREE.Group();
    g.position.set(0, PLAZA + s.y, 0);
    if (s.ring) flatRing(g, s.r, 0.26, AGAM[i % AGAM.length]);
    else squareFrame(g, s.r * 2, 0.44, AGAM[i % AGAM.length]);
    k.g.add(g);
    tiers.push(g);
  });
  k.cyl(0.1, 0.34, 1.3, AGAM[0], 8, 0, PLAZA + 6.4, 0);

  // Water, and the gas burners that give the thing its name.
  const jets: Jet[] = [];
  for (let i = 0; i < 5; i++) {
    const [x, z] = at(i * 72 + 20, 6.4);
    const h = 3.4 + k.rnd() * 1.4;
    const base = PLAZA + 0.85;
    const m = k.cyl(0.05, 0.13, h, M.water, 6, x, base + h / 2, z);
    jets.push({ m, base, h });
  }
  const fire: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const [x, z] = at(i * 120 + 60, 8.0);
    fire.push(k.lamp(0.5, x, PLAZA + 1.4, z, 0xff8a2a));
  }
  return { tiers, jets, fire, water };
}

/**
 * One arc of the ring: white plaster, a projecting balcony slab at every floor
 * running the whole width, ribbon windows set behind them, flat roof.
 */
function frontage(k: Kit, b: number, span: number, storeys: number, shop: boolean): void {
  const rc = FACE_R + BLOCK_D / 2;
  const chord = 2 * rc * Math.sin(rad(span) / 2) + 0.4;
  const h = blockH(storeys) + k.rnd() * 0.5;
  ringBox(k, chord, h, BLOCK_D, M.plaster, b, rc, h / 2);

  for (let i = 0; i < storeys - 1; i++) {
    const y = GROUND_FLOOR + i * FLOOR;
    ringBox(k, chord + 0.6, 0.3, 2.0, M.plaster, b, FACE_R - 0.35, y);
  }
  for (let i = 1; i < storeys; i++) {
    ringLit(k, chord * 0.76, 1.5, b, FACE_R - 0.08, GROUND_FLOOR + (i - 1) * FLOOR + 1.75);
  }
  if (shop) {
    ringLit(k, chord * 0.62, 2.3, b, FACE_R - 0.08, 2.1);
    ringBox(k, chord * 0.7, 0.14, 2.2, M.canvas, b, FACE_R - 1.2, 3.6);
  }
  // Stair hut and a water tank or two, the way every roof here looks.
  if (k.rnd() < 0.32) ringBox(k, 3.2, 2.6, 3.0, M.plaster, b, rc + 2, h + 1.3);
  if (k.rnd() < 0.22) {
    const [x, z] = at(b + 3, rc - 3);
    k.cyl(1.1, 1.1, 1.7, M.metal, 8, x, h + 0.85, z);
  }
}

/** The whole ring of frontage, with a fat rounded corner at every street mouth. */
function frontages(k: Kit, lamps: THREE.Mesh[]): void {
  for (const blk of BLOCKS) {
    const arc = ((blk.a1 - blk.a0) * Math.PI * FACE_R) / 180;
    const n = Math.max(1, Math.round(arc / 15));
    const span = (blk.a1 - blk.a0) / n;
    for (let i = 0; i < n; i++) {
      frontage(k, blk.a0 + (i + 0.5) * span, span, blk.storeys, i % 3 === 0);
    }
    // Averbuch's rounded ends, one at each side of every street mouth.
    for (const end of [blk.a0, blk.a1]) {
      const h = blockH(blk.storeys);
      const [x, z] = at(end, FACE_R + 4.6);
      k.cyl(4.6, 4.6, h, M.plaster, 18, x, h / 2, z);
      k.cyl(5.1, 5.1, 0.3, M.plaster, 18, x, GROUND_FLOOR + (blk.storeys - 2) * FLOOR, z);
      ringLit(k, 3.4, 1.4, end, FACE_R - 0.15, GROUND_FLOOR + 1.8);
    }
  }

  // The cinema on the north-west arc: a tall lit sign facing the square.
  const [sx, sz] = at(314, FACE_R - 0.9);
  ringLit(k, 1.7, 7.0, 314, FACE_R - 0.7, 9.4);
  lamps.push(k.lamp(0.3, sx, 13.4, sz, 0xff5470));

  // Ficus on the pavement, all the way round outside the deck.
  for (const b of [24, 118, 228, 318]) {
    const [x, z] = at(b, 40);
    k.tree(x, z);
  }
}

/** A car under the deck, remembered so it can be driven. */
interface Car { b: number; lane: number; r: number; v: number; body: THREE.Mesh; head: THREE.Mesh }

function traffic(k: Kit): Car[] {
  const cars: Car[] = [];
  const pick = [ARMS[0], ARMS[2], ARMS[4]];
  for (let i = 0; i < pick.length; i++) {
    const b = pick[i].b;
    const body = ringBox(k, 1.9, 1.45, 4.4, M.dark, b, 50, 0.95);
    const head = k.lamp(0.16, 0, 0.9, 0, 0xfff0c0);
    cars.push({ b, lane: i % 2 === 0 ? -3.6 : 3.6, r: 34 + i * 11, v: 7 + k.rnd() * 4, body, head });
  }
  return cars;
}

export function build(k: Kit): void {
  const lamps: THREE.Mesh[] = [];
  ground(k);
  deck(k, lamps);
  approaches(k);
  const f = agamFountain(k);
  frontages(k, lamps);
  const cars = traffic(k);

  // How fast each tier turns, and which way. Agam's rings never agree.
  const rates = [0.11, -0.17, 0.14, -0.22, 0.19, -0.3];

  k.onTick((t, st) => {
    // The sculpture turns; once the square is ours it winds up and the tiers
    // start pulling into line with each other.
    const gain = st.mine ? 2.1 : 1;
    for (let i = 0; i < f.tiers.length; i++) {
      f.tiers[i].rotation.y = t * rates[i] * gain + (st.mine ? 0 : i * 0.3);
    }

    // Water breathing, and the burners guttering beside it.
    for (let i = 0; i < f.jets.length; i++) {
      const j = f.jets[i];
      const s = st.dark ? 0.04 : 0.4 + 0.6 * Math.abs(Math.sin(t * 1.2 + i * 0.85));
      j.m.scale.y = s;
      j.m.position.y = j.base + (j.h * s) / 2;
    }
    f.water.position.y = PLAZA + 0.82 + Math.sin(t * 0.9) * 0.02;
    for (let i = 0; i < f.fire.length; i++) {
      const p = (t * 0.7 + i * 0.33) % 1;
      f.fire[i].visible = !st.dark && p > 0.25;
      f.fire[i].scale.setScalar(0.7 + Math.abs(Math.sin(t * 6 + i)) * 0.5);
    }

    // Street and kiosk lamps go out with the power.
    for (const l of lamps) l.visible = !st.dark;

    // Traffic feeding into the roundabout under the deck, and vanishing there.
    for (const c of cars) {
      c.r -= c.v * 0.016;
      if (c.r < 29) c.r = 64;
      const a = rad(c.b);
      const x = Math.sin(a) * c.r + Math.cos(a) * c.lane;
      const z = -Math.cos(a) * c.r + Math.sin(a) * c.lane;
      const seen = c.r > 30.5;
      c.body.visible = seen;
      c.body.position.set(x, 0.95, z);
      c.head.visible = seen && !st.dark;
      c.head.position.set(x - Math.sin(a) * 2.3, 0.85, z + Math.cos(a) * 2.3);
    }
  });
}
