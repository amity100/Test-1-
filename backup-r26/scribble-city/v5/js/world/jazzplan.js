// (v5, ROADMAP 12.9) BLUE VELVET's room as a jazz club: where its bandstand stands, its dance floor
// of parquet, its round tables and their chairs, its booths - in the frame of its room (u along the
// front, d out of it; world/rooms.js). The room's furniture is laid out from it with the block
// (world/venues2.js); the band, the people at the tables, the candles' light from it again near
// you (game/partyjazz.js) - the same places both times.

/** r: { ua, ub, db, da, y0, y1 } */
export function jazzPlan(r) {
  const { ua, ub, db, da } = r;
  const mid = (ua + ub) / 2;
  const stage = { u0: mid - 4.2, u1: mid + 4.2, d0: db, d1: db + 3.4, h: 0.5 };
  const floor = { u0: mid - 3.5, u1: mid + 3.5, d0: db + 3.6, d1: db + 8.4 };
  const tables = [];
  const table = (u, d) => {
    // (three chairs round it: the first on its side towards the doors, facing the band)
    const chairs = [0, 1, 2].map((k) => {
      const a = Math.PI / 2 + (k * Math.PI * 2) / 3;
      return { u: u + Math.cos(a) * 0.72, d: d + Math.sin(a) * 0.72, face: [-Math.cos(a), -Math.sin(a)] };
    });
    tables.push({ u, d, chairs });
  };
  // the tables either side of the floor, close to the band
  for (const s of [-1, 1]) for (const dd of [4.6, 7.2]) table(mid + s * 6.2, db + dd);
  // the room's tables, rows of them towards the doors, an aisle down the middle
  for (let d = db + 9.8; d < da - 3.2; d += 2.6) {
    for (let u = ua + 4.8; u < ub - 5.0; u += 2.9) {
      if (Math.abs(u - mid) < 1.4) continue;
      table(u, d);
    }
  }
  // the booths along the wall at the first end
  const booths = [];
  for (let d = db + 4.5; d < da - 3.6; d += 2.7) booths.push(d);
  // the band on the bandstand
  const band = {
    piano: { u: mid - 2.4, d: db + 1.5 },
    pianist: { u: mid - 3.75, d: db + 1.35, face: [1, 0] },
    drums: { u: mid + 0.9, d: db + 0.9 },
    drummer: { u: mid + 0.9, d: db + 0.35, face: [0, 1] },
    bass: { u: mid + 2.7, d: db + 1.7 },
    bassist: { u: mid + 3.1, d: db + 1.35, face: [-0.3, 1] },
    sax: { u: mid - 0.7, d: db + 2.5, face: [0.2, 1] },
    singer: { u: mid + 0.6, d: db + 2.95, face: [0, 1] },
  };
  return { mid, stage, floor, tables, booths, band };
}
