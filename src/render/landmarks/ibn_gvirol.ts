import type { Kit, Landmark } from './kit';
import { M } from './kit';

/**
 * Ibn Gvirol street, where the traffic lights are.
 *
 * Not a building — a length of one of Tel Aviv's main north-south streets, the
 * one that runs past Rabin Square: four lanes with a planted median, the long
 * run of Bauhaus-era blocks each side with shops under them and balconies over,
 * bus stops, and at the junction the traffic signals themselves, which are the
 * thing the game actually takes over here. The lights cycle.
 */

export const size: Landmark['size'] = { w: 90, h: 26, d: 260 };

/** Half the carriageway, so lanes can be laid either side of the median. */
const LANE = 3.4;

export function build(k: Kit): void {
  // The road surface and its planted middle.
  k.slab(26, 250, M.asphalt, 0, 0, 0.06);
  k.slab(5, 240, M.green, 0, 0, 0.12);
  for (let i = 0; i < 14; i++) k.tree(0, -112 + i * 17.5, 0.85);

  // Lane markings, dashed, both carriageways.
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 40; i++) {
      k.slab(0.3, 3.4, M.plaster, side * LANE * 1.5, -118 + i * 6.1, 0.1);
    }
  }

  // Kerbs and pavements.
  for (const side of [-1, 1]) {
    k.slab(9, 250, M.concrete, side * 17.5, 0, 0.09);
    k.box(0.6, 0.35, 250, M.plaster, side * 13.2, 0.2, 0);
  }

  // The blocks that line it: four to six storeys, shops below, balconies above.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const z = -110 + i * 26 + k.rnd() * 4;
      const w = 16 + k.rnd() * 6;
      const floors = 4 + Math.floor(k.rnd() * 3);
      const h = floors * 3.3;
      const x = side * (26 + w / 2);
      k.box(w, h, 20, M.plaster, x, h / 2, z);
      k.box(w + 0.7, 0.6, 20.7, M.roof, x, h + 0.3, z);
      // Shopfronts at the bottom, lit, facing the street.
      k.lit(w * 0.8, 2.6, x - side * 10.1, 2.1, z, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      // Balcony bands, the horizontal lines that make this a white-city street.
      for (let f = 1; f < floors; f++) {
        k.box(w * 0.92, 0.3, 1.1, M.plaster, x - side * 10.4, f * 3.3 + 1.2, z);
        if (k.rnd() > 0.35) {
          k.lit(w * 0.7, 1.5, x - side * 10.1, f * 3.3 + 2, z,
            side > 0 ? -Math.PI / 2 : Math.PI / 2);
        }
      }
      // A solar water heater on the roof, as on every roof in this city.
      const tank = k.cyl(0.85, 0.85, 3, M.metal, 7, x + (k.rnd() - 0.5) * 8, h + 2, z);
      tank.rotation.z = Math.PI / 2;
    }
  }

  // Bus stops: a canopy, a bench, a lit timetable.
  for (const [x, z] of [[-14, -60], [14, 40]] as Array<[number, number]>) {
    k.box(1.2, 2.6, 8, M.metal, x, 1.3, z);
    k.box(3.2, 0.25, 9, M.dark, x, 2.7, z);
    k.lit(2.2, 1.4, x, 1.7, z + 4.6);
    k.box(2.4, 0.4, 0.5, M.wood, x, 0.8, z - 2);
  }

  // The signals at the junction, four heads on masts, cycling together.
  const heads: Array<{ r: THREE_Mesh; a: THREE_Mesh; g: THREE_Mesh }> = [];
  for (const [x, z] of [[-14, -8], [14, 8], [-14, 8], [14, -8]] as Array<[number, number]>) {
    k.cyl(0.2, 0.26, 6.4, M.dark, 6, x, 3.2, z);
    k.box(0.9, 2.6, 0.7, M.dark, x, 6.8, z);
    heads.push({
      r: k.lamp(0.28, x, 7.7, z + 0.4, 0xff3b30),
      a: k.lamp(0.28, x, 6.9, z + 0.4, 0xffb020),
      g: k.lamp(0.28, x, 6.1, z + 0.4, 0x35d07f),
    });
  }
  k.onTick((t) => {
    // A real cycle: long green, short amber, long red.
    const phase = (t * 0.22) % 1;
    const green = phase < 0.42;
    const amber = phase >= 0.42 && phase < 0.52;
    for (const h of heads) {
      (h.g.material as THREE_Basic).opacity = green ? 1 : 0.12;
      (h.a.material as THREE_Basic).opacity = amber ? 1 : 0.12;
      (h.r.material as THREE_Basic).opacity = !green && !amber ? 1 : 0.12;
      (h.g.material as THREE_Basic).transparent = true;
      (h.a.material as THREE_Basic).transparent = true;
      (h.r.material as THREE_Basic).transparent = true;
    }
  });
}

// Local aliases so this file needs no direct three.js import.
type THREE_Mesh = ReturnType<Kit['lamp']>;
type THREE_Basic = { opacity: number; transparent: boolean };
