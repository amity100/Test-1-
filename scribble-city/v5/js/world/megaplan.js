// (v5, ROADMAP 12.9b) NEON INK as one of the world's great clubs: where everything in its hall
// stands, in the frame of its room (u along the front, d out of it, y up; world/rooms.js). The hall
// is laid out from it with the block (world/venues2.js: the stage, the balconies on three sides
// and their stairs, the bars under them, the bar upstairs, the VIP sofas); the show from it again
// near you (game/partyclub.js: the wall of LED, the floor of LED, the ring chandelier, the kinetic
// ceiling, the lasers, the pyro) - the same places both times.

/** r: { ua, ub, db, da, y0, y1 } */
export function megaPlan(r) {
  const { ua, ub, db, da, y0, y1 } = r;
  const mid = (ua + ub) / 2;
  // the balconies: their depth, their floor's height
  const B = 5.2;
  const by = y0 + 5.0;
  const P = { mid, B, by };
  // the stage across the back, the DJ's booth on it, the wall of LED behind it and its two pillars
  P.stage = { u0: mid - 10.5, u1: mid + 10.5, d0: db, d1: db + 5.4, h: 1.4 };
  P.booth = { u0: mid - 2.8, u1: mid + 2.8, d0: db + 2.3, d1: db + 3.3, h: 1.15 };
  P.led = { u0: mid - 12.5, u1: mid + 12.5, y0: y0 + 2.0, y1: y1 - 1.0, d: db + 0.15 };
  P.pillars = [{ u0: mid - 16, u1: mid - 13 }, { u0: mid + 13, u1: mid + 16 }];
  P.barrier = { u0: mid - 10.5, u1: mid + 10.5, d: db + 6.4 };
  // the floor of LED before it
  P.floor = { u0: mid - 9.5, u1: mid + 9.5, d0: db + 7.0, d1: db + 23.0 };
  // the balconies on three sides (the sides from the stage's end to the front; the front one
  // across between them), the edge of each that looks down on the floor
  P.bal = [
    { u0: ua, u1: ua + B, d0: db + 7.0, d1: da, edge: 'u1' },
    { u0: ub - B, u1: ub, d0: db + 7.0, d1: da, edge: 'u0' },
    { u0: ua + B, u1: ub - B, d0: da - B, d1: da, edge: 'd0' },
  ];
  // the stairs up to them, either side of the front, rising towards the doors
  P.rise = 0.2;
  P.run = 0.3;
  P.steps = Math.round((by - y0) / P.rise);
  const sl = P.steps * P.run;
  P.stairs = [
    { u0: ua + B, u1: ua + B + 2.4, d0: da - B - sl, d1: da - B },
    { u0: ub - B - 2.4, u1: ub - B, d0: da - B - sl, d1: da - B },
  ];
  // the columns under the balconies' edges (none where the stairs come up)
  P.cols = [];
  for (let d = db + 7.0; d < da - B - 0.5; d += 6.5) {
    if (d > P.stairs[0].d0 - 0.6) continue;
    P.cols.push([ua + B, d], [ub - B, d]);
  }
  // (along the front, either side of the middle: nothing stands in the way from the doors to the stage)
  for (const off of [3.25, 9.75, 16.25]) for (const s of [-1, 1]) if (mid + s * off > ua + B + 1 && mid + s * off < ub - B - 1) P.cols.push([mid + s * off, da - B]);
  // the bars under the side balconies, along the walls; the bar upstairs against the front wall
  P.bars = [{ side: -1, d0: db + 9.5, d1: db + 24 }, { side: 1, d0: db + 9.5, d1: db + 24 }];
  P.upbar = { u0: mid - 6, u1: mid + 6, d0: da - 2.2, d1: da };
  // the VIP sofas on the side balconies, looking down on the floor
  P.vip = [];
  for (const side of [-1, 1]) for (let d = db + 9.5; d < db + 26; d += 4.6) P.vip.push({ side, u: side < 0 ? ua + 1.25 : ub - 1.25, d });
  // over the floor: the kinetic ceiling (its bars on their wires), the ring chandelier under it
  P.rig = { u0: P.floor.u0 + 0.5, u1: P.floor.u1 - 0.5, d0: P.floor.d0 + 0.5, d1: P.floor.d1 - 0.5, nu: 12, nd: 10, lo: y1 - 3.3, hi: y1 - 0.8 };
  P.ring = { u: mid, d: (P.floor.d0 + P.floor.d1) / 2, y: y0 + 7.6, r: [6.6, 4.8, 3.0] };
  return P;
}
