import { Run } from './stock.js';
import { rbox, rprint, rcyl, wp, yawOut, put, later, liveOk, fillFloor, faces } from './shopkit.js';
import { mark, begin, sides, staff } from './beauty.js';
import './hobbygear.js';

// (v5, ROADMAP 26, the owner's word: "the shops that are still empty - fill them, with things to buy and things to do in them")
// The arcade of the new kind. It was the last shop of the old kind: a row of coloured boxes along the back and one box by the
// door, nothing to play. Now:
//
// - Upright cabinets along the back wall and the sides, and in the middle back to back in pairs: each its colours, its edges
//   lit, its stick and buttons, its screen in a dark hood with its game waiting for a coin, its name lit over it. Six games,
//   the ones INK ARCADE plays (game/arcade.js): INK INVADERS, PEN-MAN, INKTRIS, DOODLE SNAKE, PAPER PONG, BRICK SKETCH.
// - Claw machines by the window, a heap of soft toys under the glass.
// - The prize counter at the till, the wall of prizes behind it: soft toys on the shelves, real (they can be bought).
// - The token machine by the door; the carpet dark with its colours lit, the neon along the walls.
//
// What is played is played (game/arcadelife.js): E at a cabinet - its game on its screen, $1; the claw machine, $1; the tickets
// they pay out turned into prizes at the counter (the tickets are INK ARCADE's own: one count, both places). The people play
// too: they come for a game, stand at a cabinet a while, their hands at it, and cheer or groan.

export const CAB_GAMES = ['invaders', 'penman', 'inktris', 'snake', 'pong', 'bricks'];
const GAME_COL = { invaders: [0.12, 0.5, 0.92], penman: [0.98, 0.78, 0.12], inktris: [0.58, 0.3, 0.92], snake: [0.2, 0.74, 0.36], pong: [0.86, 0.86, 0.9], bricks: [0.96, 0.46, 0.14] };
const NEON = [[1, 0.3, 0.66], [0.3, 0.92, 1], [1, 0.88, 0.3], [0.45, 1, 0.5], [0.66, 0.42, 1]];
const BODY = [0.07, 0.06, 0.1];
const BLACK = [0.03, 0.03, 0.04];
const STEEL = [0.72, 0.74, 0.78];
const BRIGHT = [[0.92, 0.26, 0.3], [0.98, 0.78, 0.2], [0.24, 0.6, 0.92], [0.96, 0.52, 0.2], [0.36, 0.72, 0.38], [0.62, 0.36, 0.82], [0.95, 0.5, 0.66], [0.2, 0.7, 0.72]];
const r01 = (R) => R.rng.r();
const pk = (R, a) => a[Math.floor(R.rng.r() * a.length)];

// the cabinets' count, for their names (each its own mark: cab.k - where to stand, scr.k - its screen)
function nextCab(R) {
  R.spots.cabs = (R.spots.cabs || 0) + 1;
  return R.spots.cabs - 1;
}

export function arcadeRoom(R, o = {}) {
  const { fr, till, front } = begin(R, o, [0.86, 0.78, 1]);
  carpet(R);
  // the back wall: a row of cabinets under the band
  if (fr.W > 1.4) cabRow(R, new Run(R, R.ua + 0.1, R.db + 0.02, [1, 0], [0, 1]), fr.W - 0.2, true);
  // (the side rows clear of the back row's corners: it is a cabinet deep, the side's run starts half a metre out)
  sides(R, fr, till, front, (run, len, atDoor, side) => {
    const skip = 0.4;
    if (len - skip < 0.85) return;
    if (side < 0) cabRow(R, run, len - skip, false, skip);
    else cabRow(R, run, len - skip, false, 0);
  });
  if (till) prizeWall(R, fr, till);
  frontRow(R, fr, till, front);
  // the middle: cabinets back to back, two on a side; now and then a pair of claw machines
  // (clear of the walls' rows by a player at each and a way past them: from the back row further, its players face the island's)
  fillFloor(R, front, (p, k) => {
    const [a, b] = faces(R, p);
    const L = p.u1 - p.u0;
    if (k % 4 === 3) {
      for (const run of [a, b]) clawMachine(R, run, L / 2 - 0.5, 0);
      return;
    }
    for (const run of [a, b]) for (let s = (L - 1.62) / 2; s + 0.8 <= L - (L - 1.62) / 2 + 1e-6; s += 0.82) cabinet(R, run, s, 0);
  }, { len: 1.8, depth: 1.9, aisle: 1.5, edge: 1.6, edgeBack: 2.3, most: R.low ? 4 : 10 });
  neon(R, fr);
  staff(R, fr);
}

// the carpet: dark, its colours scattered and lit under the black light
function carpet(R) {
  const S = R.psoup(false);
  const G = R.psoup(true);
  const y0 = R.y0;
  const run = new Run(R, R.ua, R.db, [1, 0], [0, 1]);
  const W = R.ub - R.ua;
  const D = R.da - R.db;
  rbox(R, S, run, 0.02, y0, 0.02, W - 0.02, y0 + 0.006, D - 0.02, [0.09, 0.06, 0.16], { skip: ['bottom'] });
  if (G.off) return;
  const n = Math.min(R.low ? 60 : 160, Math.round(W * D * 1.6));
  for (let i = 0; i < n; i++) {
    const s = 0.2 + r01(R) * (W - 0.4);
    const t = 0.2 + r01(R) * (D - 0.4);
    const a = 0.04 + r01(R) * 0.08;
    const b = r01(R) < 0.5 ? a : 0.015;
    rbox(R, G, run, s, y0 + 0.006, t, s + a, y0 + 0.008, t + b, pk(R, NEON), { pen: 'glow', skip: ['bottom'] });
  }
}

// a row of cabinets along a wall, each 0.82 wide; the band over them on the back wall
function cabRow(R, run, len, back, from = 0) {
  const n = Math.floor((len - 0.1) / 0.82);
  if (n < 1) return;
  const s0 = from + (len - n * 0.82) / 2;
  for (let i = 0; i < n; i++) cabinet(R, run, s0 + i * 0.82, 0);
  if (back) {
    const S = R.psoup(false);
    const y0 = R.y0;
    const top = Math.min(R.y1 - 0.12, y0 + 2.75);
    rbox(R, S, run, 0, top - 0.42, 0, len, top, 0.04, [0.1, 0.06, 0.2], { skip: ['back'] });
    const nh = Math.max(1, Math.round(len / 3.2));
    for (let k = 0; k < nh; k++) rprint(R, S, run, (k * len) / nh + 0.15, top - 0.39, ((k + 1) * len) / nh - 0.15, top - 0.03, 0.041, 'head.arcade', { pen: 'screen' });
  }
}

// an upright cabinet at s along the run, its back to the run's line (t0), its front out: sides in its game's colours with their
// front edges lit, the coin door, the panel with its stick and three buttons, the screen in its hood, its name lit over it
function cabinet(R, run, s, t0) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const k = nextCab(R);
  const game = CAB_GAMES[k % CAB_GAMES.length];
  const col = GAME_COL[game];
  const lit = NEON[k % NEON.length];
  const W = 0.76;
  const D = 0.72;
  const a = s + 0.03;
  const b = a + W;
  const t = (x) => t0 + x;
  // the sides, in its colours; their front edges lit
  rbox(R, S, run, a, y0, t(0), a + 0.04, y0 + 1.92, t(D), col, {});
  rbox(R, S, run, b - 0.04, y0, t(0), b, y0 + 1.92, t(D), col, {});
  rbox(R, S, run, a - 0.004, y0 + 0.02, t(D), a + 0.044, y0 + 1.9, t(D + 0.012), lit, { pen: 'glow' });
  rbox(R, S, run, b - 0.044, y0 + 0.02, t(D), b + 0.004, y0 + 1.9, t(D + 0.012), lit, { pen: 'glow' });
  // the body: its back, the lower front with the coin door
  rbox(R, S, run, a + 0.04, y0, t(0), b - 0.04, y0 + 1.92, t(0.06), BODY, { skip: ['back'] });
  rbox(R, S, run, a + 0.04, y0, t(0.48), b - 0.04, y0 + 0.86, t(0.58), BODY, {});
  rbox(R, S, run, a + 0.24, y0 + 0.52, t(0.581), a + 0.34, y0 + 0.6, t(0.586), [1, 0.32, 0.2], { pen: 'glow' });
  rbox(R, S, run, b - 0.34, y0 + 0.52, t(0.581), b - 0.24, y0 + 0.6, t(0.586), [1, 0.32, 0.2], { pen: 'glow' });
  rbox(R, S, run, a + 0.2, y0 + 0.2, t(0.581), b - 0.2, y0 + 0.44, t(0.584), [0.16, 0.15, 0.2], {});
  // the panel, out to the player: its top in its colours, the stick, three buttons
  rbox(R, S, run, a + 0.04, y0 + 0.86, t(0.3), b - 0.04, y0 + 0.98, t(D + 0.1), BODY, {});
  rbox(R, S, run, a + 0.04, y0 + 0.98, t(0.3), b - 0.04, y0 + 0.995, t(D + 0.1), col, {});
  const sx = a + 0.22;
  rcyl(R, S, run, sx, t(D - 0.06), 0.012, y0 + 0.995, 0.11, STEEL, { seg: 6 });
  rcyl(R, S, run, sx, t(D - 0.06), 0.032, y0 + 1.1, 0.05, [0.9, 0.08, 0.1], { seg: 8 });
  for (let i = 0; i < 3; i++) rcyl(R, S, run, a + 0.42 + i * 0.09, t(D - 0.06), 0.022, y0 + 0.995, 0.02, NEON[(k + i) % NEON.length], { pen: 'glow', seg: 8 });
  // the hood and the screen in it, its game waiting for a coin
  rbox(R, S, run, a + 0.04, y0 + 0.995, t(0.06), b - 0.04, y0 + 1.03, t(0.32), BODY, {});
  rbox(R, S, run, a + 0.04, y0 + 1.03, t(0.06), b - 0.04, y0 + 1.66, t(0.3), BLACK, {});
  rprint(R, S, run, a + 0.08, y0 + 1.07, b - 0.08, y0 + 1.6, t(0.301), `arc.scr.${game}`, { pen: 'screen' });
  rbox(R, S, run, a + 0.04, y0 + 1.66, t(0.06), b - 0.04, y0 + 1.7, t(0.5), BODY, {});
  // its name lit over it
  rbox(R, S, run, a + 0.04, y0 + 1.7, t(0.16), b - 0.04, y0 + 1.92, t(0.5), BODY, {});
  rprint(R, S, run, a + 0.06, y0 + 1.72, b - 0.06, y0 + 1.9, t(0.501), `arc.mq.${game}`, { pen: 'screen' });
  run.solid(a, t(0), b, t(D + 0.1), y0 + 1.92);
  // where one stands to play it, its screen (game/arcadelife.js)
  const sm = (a + b) / 2;
  mark(R, `cab.${k}`, run, sm, t(D + 0.52), y0, [-run.ou, -run.od]);
  mark(R, `scr.${k}`, run, sm, t(0.302), y0 + 1.335, [run.ou, run.od]);
  const [u, d] = run.ud(sm, t(D + 0.5));
  R.spots.browse.push({ u, d, face: [-run.ou, -run.od], what: 'play' });
}

// a claw machine at s along the run: the cabinet under the glass, the heap of soft toys in it, the claw over them, its name lit
function clawMachine(R, run, s, t0) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const k = (R.spots.claws = (R.spots.claws || 0) + 1) - 1;
  const col = [[0.95, 0.3, 0.6], [0.2, 0.7, 0.95], [0.95, 0.75, 0.2], [0.5, 0.3, 0.95]][k % 4];
  const lit = NEON[(k + 2) % NEON.length];
  const W = 0.92;
  const D = 0.92;
  const a = s + 0.04;
  const b = a + W;
  const t = (x) => t0 + x;
  rbox(R, S, run, a, y0, t(0.02), b, y0 + 0.82, t(D), col, {});
  // (its lit rim round the top of the base - a band, not a slab: seen through the glass from above, a lit floor would blaze)
  rbox(R, S, run, a - 0.005, y0 + 0.8, t(0.015), b + 0.005, y0 + 0.84, t(D + 0.005), lit, { pen: 'glow', skip: ['top', 'bottom'] });
  rbox(R, S, run, a + 0.04, y0 + 0.84, t(0.04), b - 0.04, y0 + 0.846, t(D - 0.012), col.map((c) => c * 0.55), { skip: ['bottom'] });
  // the glass box: posts at the corners, its back in the machine's colours (the toys bright against it), the top with its name.
  // (the glass is not drawn as a pane - the toys and the claw are what is seen through it - only what catches the light: its
  // edges, the glints on its front, the light strip inside along its top: world/jewels.js's cases)
  for (const [ps, pt] of [[a, t(0.02)], [b - 0.04, t(0.02)], [a, t(D - 0.04)], [b - 0.04, t(D - 0.04)]]) rbox(R, S, run, ps, y0 + 0.84, pt, ps + 0.04, y0 + 1.86, pt + 0.04, col, {});
  rbox(R, S, run, a + 0.04, y0 + 0.84, t(0.02), b - 0.04, y0 + 1.86, t(0.04), col.map((c) => c * 0.45), {});
  for (let i = 0; i < 5; i++) rbox(R, S, run, a + 0.1 + i * 0.17, y0 + 1.1 + (i % 2) * 0.3, t(0.041), a + 0.16 + i * 0.17, y0 + 1.16 + (i % 2) * 0.3, t(0.044), NEON[(k + i) % NEON.length], { pen: 'glow' });
  for (const [y, h] of [[y0 + 0.84, 0.012], [y0 + 1.848, 0.012]]) rbox(R, S, run, a + 0.04, y, t(D - 0.012), b - 0.04, y + h, t(D), [0.78, 0.86, 0.95], { pen: 'gloss' });
  for (const [s0, s1, g0, g1] of [[a + 0.1, a + 0.13, 1.42, 1.72], [a + 0.17, a + 0.18, 1.5, 1.7], [b - 0.2, b - 0.18, 1.0, 1.16]]) rprint(R, S, run, s0, y0 + g0, s1, y0 + g1, t(D - 0.006), null, { pen: 'gloss', col: [0.95, 0.98, 1] });
  rbox(R, S, run, a + 0.06, y0 + 1.79, t(0.1), b - 0.06, y0 + 1.8, t(D - 0.08), [1, 0.96, 0.86], { pen: 'glow', skip: ['top'] });
  rbox(R, S, run, a, y0 + 1.86, t(0.02), b, y0 + 2.06, t(D), col, {});
  // the chute in the front corner on the right, seen from the front (the claw game's home there: game/arcadelife.js), its flap
  // below. (which end of the run that is: the run may wind either way - x from the right end, as s)
  const pa = wp(R, run, a, y0, t(D));
  const pb = wp(R, run, b, y0, t(D));
  const yo = yawOut(R, run);
  const rightB = (pb[0] - pa[0]) * Math.cos(yo) - (pb[2] - pa[2]) * Math.sin(yo) > 0;
  const fromR = (x0, x1) => (rightB ? [b - x1, b - x0] : [a + x0, a + x1]);
  const GL = [0.78, 0.86, 0.95];
  let [c0, c1] = fromR(0.06, 0.28);
  rbox(R, S, run, c0, y0 + 0.84, t(D - 0.24), c1, y0 + 1.06, t(D - 0.22), GL, { pen: 'gloss' });
  [c0, c1] = fromR(0.26, 0.28);
  rbox(R, S, run, c0, y0 + 0.84, t(D - 0.24), c1, y0 + 1.06, t(D - 0.02), GL, { pen: 'gloss' });
  [c0, c1] = fromR(0.08, 0.3);
  rbox(R, S, run, c0, y0 + 0.3, t(D), c1, y0 + 0.5, t(D + 0.01), [0.1, 0.1, 0.12], {});
  const [h0, h1] = rightB ? [a + 0.12, b - 0.34] : [a + 0.34, b - 0.12];
  rprint(R, S, run, a + 0.06, y0 + 1.88, b - 0.06, y0 + 2.04, t(D + 0.001), 'head.prizes', { pen: 'screen' });
  // the claw's rails along the top, side to side and front to back (the claw itself moves: game/arcadelife.js)
  rbox(R, S, run, a + 0.06, y0 + 1.8, t(0.4), b - 0.06, y0 + 1.83, t(0.44), STEEL, { pen: 'gloss' });
  rbox(R, S, run, (a + b) / 2 - 0.02, y0 + 1.8, t(0.1), (a + b) / 2 + 0.02, y0 + 1.83, t(D - 0.08), STEEL, { pen: 'gloss' });
  // the panel out front: the stick and the button
  rbox(R, S, run, a + 0.1, y0 + 0.82, t(D), b - 0.1, y0 + 0.92, t(D + 0.16), BODY, {});
  rcyl(R, S, run, a + 0.3, t(D + 0.08), 0.03, y0 + 0.92, 0.1, [0.9, 0.08, 0.1], { seg: 8 });
  rcyl(R, S, run, b - 0.3, t(D + 0.08), 0.04, y0 + 0.92, 0.025, lit, { pen: 'glow', seg: 8 });
  run.solid(a, t(0.02), b, t(D + 0.16), y0 + 2.06);
  mark(R, `claw.${k}`, run, (a + b) / 2, t(D + 0.62), y0, [-run.ou, -run.od]);
  mark(R, `clawc.${k}`, run, (a + b) / 2, t(0.42), y0 + 1.3, [run.ou, run.od]);
  const [u, d] = run.ud((a + b) / 2, t(D + 0.6));
  R.spots.browse.push({ u, d, face: [-run.ou, -run.od], what: 'claw' });
  // the heap of soft toys under the glass
  later(R, () => {
    const yaw = yawOut(R, run);
    for (let i = 0; i < 14; i++) {
      const ps = h0 + r01(R) * (h1 - h0);
      const pt = t(0.14) + r01(R) * (D - 0.3);
      const py = y0 + 0.84 + (i > 7 ? 0.12 : 0);
      put(R, { line: 'teddy', model: 'teddy', cell: null, tint: pk(R, BRIGHT), cap: pk(R, BRIGHT) }, wp(R, run, ps, py, pt), yaw + (r01(R) - 0.5) * 2.4, { scale: 0.75 });
    }
  });
}

// along the window, in from the door: the token machine first, then the claw machines - on whichever side of the door has the
// longer stretch free (the till is on the side away from the door, at the window: R.lane, till.end)
function frontRow(R, fr, till, front) {
  if (front - R.db < 4) return;
  const lane = R.lane;
  const segs = fr.left
    ? [[R.ua + 0.35, lane[0] - 0.5, -1], [lane[1] + 0.5, till ? till.end - 0.7 : R.ub - 0.35, 1]]
    : [[till ? till.end + 0.7 : R.ua + 0.35, lane[0] - 0.5, -1], [lane[1] + 0.5, R.ub - 0.35, 1]];
  segs.sort((p, q) => q[1] - q[0] - (p[1] - p[0]));
  const [lo, hi, dir] = segs[0];
  if (hi - lo < 0.7) return;
  // (from the door outward: the run starts at the door's end of the stretch)
  const s0 = dir > 0 ? lo : hi;
  const run = new Run(R, s0, R.da - 0.35, [dir, 0], [0, -1]);
  const len = hi - lo;
  tokens(R, run);
  const n = Math.min(2, Math.floor((len - 0.75) / 1.05));
  for (let i = 0; i < n; i++) clawMachine(R, run, 0.75 + i * 1.05, 0.25);
}

// the wall of prizes behind the counter: shelves of soft toys (the ones there are to buy, with money - or won), the band over it
function prizeWall(R, fr, till) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const h = Math.min(2.3, R.y1 - y0 - 0.3);
  const depth = 0.34;
  const L = Math.min(2.6, fr.W * 0.35);
  // (behind the till: the side wall at the till's end of the room, by the window)
  const run = fr.left ? new Run(R, R.ub - 0.02, R.da - 0.4, [0, -1], [-1, 0]) : new Run(R, R.ua + 0.02, R.da - 0.4 - L, [0, 1], [1, 0]);
  rbox(R, S, run, 0, y0 + 1.0, 0, L, y0 + h, 0.02, [0.12, 0.08, 0.22], { skip: ['back'] });
  rbox(R, S, run, 0, y0 + h, 0, L, y0 + h + 0.3, 0.14, [0.9, 0.2, 0.42], { skip: ['back'] });
  rprint(R, S, run, 0.1, y0 + h + 0.03, L - 0.1, y0 + h + 0.27, 0.141, 'head.prizes', { pen: 'screen' });
  const ys = [y0 + 1.05, y0 + 1.5, y0 + 1.95];
  for (const y of ys) rbox(R, S, run, 0.02, y - 0.02, 0.02, L - 0.02, y, depth, [0.92, 0.92, 0.95], { skip: ['back'] });
  for (const y of ys) rbox(R, S, run, 0.02, y - 0.035, depth - 0.006, L - 0.02, y - 0.02, depth + 0.002, NEON[Math.floor(y * 10) % NEON.length], { pen: 'glow' });
  run.solid(0, 0, L, depth + 0.02, y0 + h);
  const spot = run.spot(L / 2, depth + 0.55, { shelf: ys.map((y) => y + 0.1 - y0), reach: run.at(L / 2, y0 + 1.5, depth - 0.1), what: 'toy' });
  later(R, () => {
    const yaw = yawOut(R, run);
    for (const y of ys) {
      for (let s = 0.16; s < L - 0.12; s += 0.26) {
        const live = Math.abs(y - y0 - 1.5) < 0.1 && liveOk(spot, 4);
        put(R, { line: 'toy', model: 'teddy', cell: null, tint: pk(R, [[0.72, 0.5, 0.32], [0.98, 0.8, 0.85], [0.6, 0.75, 0.95], [0.98, 0.95, 0.85], [0.6, 0.85, 0.6], [0.95, 0.4, 0.5]]), cap: pk(R, BRIGHT) }, wp(R, run, s, y, depth * 0.55), yaw + (r01(R) - 0.5) * 0.5, { live, zone: live ? spot : null, what: 'toy' });
      }
    }
  });
  mark(R, 'prizes', run, L / 2, depth + 0.5, y0, [-run.ou, -run.od]);
}

// the token machine by the door: its lit face, its tray (on the front row's run, at its start)
function tokens(R, run) {
  const S = R.psoup(false);
  const y0 = R.y0;
  rbox(R, S, run, 0.02, y0, 0.25, 0.62, y0 + 1.6, 0.67, [0.16, 0.4, 0.78], {});
  rprint(R, S, run, 0.08, y0 + 0.9, 0.56, y0 + 1.4, 0.671, 'arc.tokens', { pen: 'screen' });
  rbox(R, S, run, 0.2, y0 + 0.5, 0.67, 0.44, y0 + 0.62, 0.75, [0.7, 0.72, 0.78], { pen: 'gloss' });
  run.solid(0.02, 0.25, 0.62, 0.75, y0 + 1.6);
  mark(R, 'tokens', run, 0.32, 1.2, y0, [-run.ou, -run.od]);
}

// neon along the tops of the walls: tubes in the colours, round the room
function neon(R, fr) {
  const S = R.psoup(true);
  if (S.off) return;
  const y = Math.min(R.y1 - 0.18, R.y0 + 2.95);
  const W = R.ub - R.ua;
  const D = R.da - R.db;
  const runs = [[new Run(R, R.ua + 0.05, R.db + 0.05, [1, 0], [0, 1]), W - 0.1], [new Run(R, R.ua + 0.05, R.db + 0.05, [0, 1], [1, 0]), D - 1.2], [new Run(R, R.ub - 0.05, R.db + 0.05, [0, 1], [-1, 0]), D - 1.2]];
  runs.forEach(([run, len], i) => rbox(R, S, run, 0, y, 0, len, y + 0.05, 0.05, NEON[i % NEON.length], { pen: 'glow' }));
}
