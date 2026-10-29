import { mBlockRect } from './plan.js';

// (v5, ROADMAP 12.7, 12.8) The great halls of the mainland - the arcade on Inkwood Boulevard, the
// casino - each on the east part of its block: the district's row stays on the west avenue
// (world/mainland/blocks.js), and on the east the hall stands back from the avenue behind its
// forecourt, its face to it. Plain numbers here: the block builder leaves the ground and gives the
// far view the hall's shape; game/arcade.js and game/casino.js build the hall itself near you.

export const HALL_ROW_D = 22;

function hall(col, row, w, d, h, back = 8) {
  const R = mBlockRect(col, row);
  const cz = (R.z0 + R.z1) / 2;
  return { col, row, R, xe: R.x1 - back, xw: R.x1 - back - w, z0: cz - d / 2, z1: cz + d / 2, h, cz };
}

// INK ARCADE: 32 x 52 m, 7.5 m high, its doors on the east avenue
export const ARCADE = hall(7, 1, 32, 52, 7.5);
