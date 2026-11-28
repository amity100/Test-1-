import { Batch } from './kit.js';
import { BoxList } from './collision.js';

// (v5) Something built only in name: its dice thrown and its props' numbers taken, as they always
// were, and nothing of it drawn or solid. An empty lot of the island is built this way now, its
// building put up on it at the end of the city (world/northend.js): everything built after the lot
// keeps its looks (the same dice) and its props their numbers (the saves remember the rubbed-out
// ones by number, world/objects.js), and the lot is free for the building.
export function ghostly(ctx, fn) {
  const keep = { B: ctx.B, col: ctx.col, footprints: ctx.footprints, objects: ctx.objects, hideSpots: ctx.hideSpots, lamps: ctx.lamps, benches: ctx.benches, seats: ctx.seats };
  const real = ctx.objects;
  ctx.B = new Batch();
  ctx.col = new BoxList();
  if (ctx.footprints) ctx.footprints = [];
  ctx.hideSpots = [];
  if (ctx.lamps) ctx.lamps = [];
  if (ctx.benches) ctx.benches = [];
  if (ctx.seats) ctx.seats = [];
  // (each prop takes its number in the city's list, and is gone from it from the start: nothing of
  // it was ever drawn, no box of it is in the city's)
  ctx.objects = real ? {
    begin(c, kind, x, z) {
      const id = real.begin(c, kind, x, z);
      return id;
    },
    end(c, id) {
      if (!id) return;
      const o = real.list[id];
      if (o) {
        o.state = 'gone';
        o.gone = 1;
        o.ghost = true;
      }
      c.B.obj = 0;
    },
  } : null;
  try {
    return fn();
  } finally {
    Object.assign(ctx, keep);
  }
}
