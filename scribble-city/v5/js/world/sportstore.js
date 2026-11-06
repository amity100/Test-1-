import { Run, ceiling } from './stock.js';
import { roomLight } from './products.js';
import { rbox, rprint, rcyl, wp, yawOut, put, later, liveOk, frameOf } from './shopkit.js';
import { cashWrap, wallBay } from './fashion.js';
import { litWall } from './shoestore.js';
import './sportgear.js';

// (v5, ROADMAP 16.5) A sports shop of the new kind:
//
// Along the back the team's colours on their bars - the shirts, the shorts, the jackets - under the
// bay's name; on one side the running shoes on their lit wall, on the other the bikes hung on the wall
// on their hooks, a row of them, wheels and all. In the middle the bins of balls - basketballs,
// footballs, volleyballs, piled in wire bins - and the treadmill to try, its belt running (game/
// trylife.js), a running track painted on the floor before it. By the window a bike on its stand. The
// till by the window.
//
// The balls are taken out of the bin and bounced; the treadmill walked on a while; the bikes looked up
// at (game/trylife.js). The clothes are tried as in a clothes shop; the shoes come out of the stock
// room in their box, as in a shoe shop.

const DARK = [0.16, 0.16, 0.18];
const STEEL = [0.74, 0.76, 0.8];
// the team colours
const TEAM = [[0.12, 0.3, 0.62], [0.86, 0.18, 0.2], [0.98, 0.98, 0.96], [0.1, 0.1, 0.12], [0.98, 0.78, 0.18], [0.18, 0.56, 0.34], [0.95, 0.45, 0.15], [0.55, 0.6, 0.66]];
const BIKES = [[0.86, 0.18, 0.2], [0.12, 0.3, 0.62], [0.1, 0.1, 0.12], [0.98, 0.78, 0.18], [0.18, 0.56, 0.34], [0.94, 0.94, 0.92]];

function mark(R, name, run, s, t, y, face) {
  const [u, d] = run.ud(s, t);
  R.spots.marks = R.spots.marks || [];
  R.spots.marks.push({ name, u, d, y: y - R.y0, face });
}

export function sportStore(R, o = {}) {
  const fr = frameOf(R);
  R.noLamps = true;
  R.light = roomLight(R.f);
  if (R.live) R.live.S.light = R.light;
  ceiling(R, { round: true, light: [1, 0.98, 0.95] });
  const front = R.da - 1.85;
  const till = cashWrap(R, fr, o);
  // the stock room's door at the back on the till's side; the team's colours along the rest of it
  const doorW = 0.95;
  const sdU = fr.left ? R.ub - 0.3 - doorW : R.ua + 0.3;
  stockDoor(R, sdU, doorW);
  const b0 = fr.left ? R.ua + 0.15 : sdU + doorW + 0.35;
  const b1 = fr.left ? sdU - 0.35 : R.ub - 0.15;
  if (b1 - b0 > 1.2) wallBay(R, new Run(R, b0, R.db + 0.62, [1, 0], [0, 1]), b1 - b0, TEAM, 'head.team', { sport: true });
  // the side walls: the running shoes lit on the door's side; the bikes on the till's side
  const sd0 = R.db + 0.7;
  const doorSide = fr.left ? -1 : 1;
  for (const side of [-1, 1]) {
    const atDoor = side === doorSide;
    const end = atDoor ? front - 0.25 : (till ? R.da - 1.75 - 0.62 - 0.9 : front - 0.25);
    const len = end - sd0;
    if (len < 1.2) continue;
    const run = side < 0 ? new Run(R, R.ua + 0.02, sd0, [0, 1], [1, 0]) : new Run(R, R.ub - 0.02, end, [0, -1], [-1, 0]);
    if (atDoor) litWall(R, run, len, { head: 'head.run', sport: true });
    else bikeWall(R, run, len);
  }
  // the middle: the bins of balls, the treadmill
  const inner = fr.W - 2 * 1.3;
  const dm = (R.db + 0.9 + front) / 2;
  if (inner > 1.6 && front - R.db > 4) {
    const um = (R.ua + R.ub) / 2;
    balls(R, new Run(R, um - Math.min(2.2, inner) / 2, dm - 0.9, [1, 0], [0, 1]), Math.min(2.2, inner));
    treadmill(R, um, dm + 0.9);
  }
  // a bike on its stand by the window, on the door's other side
  const lo = fr.left ? R.lane[1] + 0.6 : R.ua + 0.5;
  const hi = fr.left ? (till ? till.end - 0.5 : R.ub - 0.5) : R.lane[0] - 0.6;
  if (hi - lo > 1.9) {
    const run = new Run(R, lo, R.da - 0.55, [1, 0], [0, -1]);
    rbox(R, R.psoup(false), run, (hi - lo) / 2 - 0.9, R.y0, -0.25, (hi - lo) / 2 + 0.9, R.y0 + 0.06, 0.25, [0.22, 0.22, 0.24], { skip: ['bottom'] });
    later(R, () => put(R, { line: 'bike', model: 'bike', cell: null, tint: BIKES[0] }, wp(R, run, (hi - lo) / 2, R.y0 + 0.06, 0), yawOut(R, run) + Math.PI / 2, {}));
    run.solid((hi - lo) / 2 - 0.9, -0.25, (hi - lo) / 2 + 0.9, 0.25, R.y0 + 1.0);
  }
  R.spots.big = fr.W * fr.D > 60;
  const b = R.spots.browse;
  R.spots.staff = [];
  for (let i = 0; i < 3 && b.length; i++) R.spots.staff.push(b[Math.floor(((i + 0.5) * b.length) / 3)]);
  mark(R, 'stock', new Run(R, sdU, R.db, [1, 0], [0, 1]), doorW / 2, 0.75, R.y0, [0, -1]);
}

// ------------------------------------------------------------------ the bikes on the wall
// A rail along the wall at a hand's height over the head, the bikes hung from it on their hooks, side
// on, one after another; the name over them.
function bikeWall(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const top = Math.min(R.y1 - 0.25, y0 + 2.75);
  rbox(R, S, run, 0, y0, 0, len, top, 0.02, [0.9, 0.9, 0.88], { skip: ['back'], dim: 0.96 });
  rbox(R, S, run, 0, top - 0.3, 0.02, len, top, 0.06, DARK, { skip: ['back'] });
  const nh = Math.max(1, Math.round(len / 2.4));
  for (let k = 0; k < nh; k++) rprint(R, S, run, (k * len) / nh + 0.12, top - 0.28, ((k + 1) * len) / nh - 0.12, top - 0.02, 0.061, 'head.bikes');
  // (the rail, its hooks; the bikes - two rows in a tall room, one in a low one)
  const rows = top - y0 > 2.6 ? [y0 + 1.42] : [y0 + 1.3];
  const n = Math.max(1, Math.floor((len - 0.2) / 1.85));
  for (const ry of rows) {
    rbox(R, S, run, 0.05, ry + 0.95, 0.02, len - 0.05, ry + 0.98, 0.1, STEEL, { pen: 'gloss' });
    for (let i = 0; i < n; i++) {
      const s = ((len - 0.2) * (i + 0.5)) / n + 0.1;
      for (const ds of [-0.5, 0.5]) rbox(R, S, run, s + ds - 0.01, ry + 0.62, 0.06, s + ds + 0.01, ry + 0.96, 0.26, DARK, {});
      later(R, () => put(R, { line: 'bike', model: 'bike', cell: null, tint: BIKES[(i * 3 + Math.round(ry * 10)) % BIKES.length] }, wp(R, run, s, ry, 0.27), yawOut(R, run) + Math.PI / 2, {}));
    }
  }
  // (a pump, a helmet on a shelf under them)
  rbox(R, S, run, 0.2, y0 + 0.9, 0.02, Math.min(len - 0.2, 2.2), y0 + 0.93, 0.32, [0.62, 0.52, 0.42], {});
  later(R, () => {
    for (let k = 0; k < Math.min(5, Math.floor((len - 0.4) / 0.4)); k++) {
      const s = 0.4 + k * 0.4;
      if (s > Math.min(len - 0.2, 2.2) - 0.2) break;
      // (helmets: half a ball each, the team's colours)
      put(R, { line: 'helmet', model: 'volleyball', cell: null, tint: TEAM[k % TEAM.length], cap: DARK }, wp(R, run, s, y0 + 0.93, 0.17), yawOut(R, run), { scale: 1.1 });
    }
  });
  run.solid(0, 0, len, 0.6, top);
  mark(R, 'bikes', run, len / 2, 1.3, y0, [-run.ou, -run.od]);
}

// ------------------------------------------------------------------ the bins of balls
// Wire bins on their legs, one beside another, each heaped with its kind; the sign on a stick.
function balls(R, run, len) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const kinds = [['basketball', [0.9, 0.42, 0.14], [0.14, 0.1, 0.08], 0.12], ['football', [0.97, 0.97, 0.95], [0.12, 0.12, 0.14], 0.11], ['volleyball', [0.98, 0.86, 0.3], [0.2, 0.36, 0.7], 0.105]];
  const n = Math.max(1, Math.min(3, Math.floor(len / 0.68)));
  const w = len / n;
  for (let i = 0; i < n; i++) {
    const [model, tint, cap, r] = kinds[i % kinds.length];
    const s0 = i * w + 0.04;
    const s1 = (i + 1) * w - 0.04;
    const yb = y0 + 0.32;
    const yt = y0 + 0.78;
    // (the bin: its wire sides - thin bars - its floor, its legs)
    for (const t of [-0.3, 0.3]) {
      rbox(R, S, run, s0, yt - 0.015, t - 0.008, s1, yt, t + 0.008, STEEL, { pen: 'gloss' });
      rbox(R, S, run, s0, yb, t - 0.008, s1, yb + 0.015, t + 0.008, STEEL, { pen: 'gloss' });
      for (let s = s0; s <= s1 + 0.001; s += (s1 - s0) / 6) rbox(R, S, run, s - 0.004, yb, t - 0.004, s + 0.004, yt, t + 0.004, STEEL, {});
    }
    for (const s of [s0, s1]) {
      rbox(R, S, run, s - 0.008, yt - 0.015, -0.3, s + 0.008, yt, 0.3, STEEL, { pen: 'gloss' });
      for (let t = -0.3; t <= 0.301; t += 0.1) rbox(R, S, run, s - 0.004, yb, t - 0.004, s + 0.004, yt, t + 0.004, STEEL, {});
      for (const t of [-0.28, 0.28]) rbox(R, S, run, s - 0.012, y0, t - 0.012, s + 0.012, yb, t + 0.012, DARK, {});
    }
    rbox(R, S, run, s0, yb, -0.3, s1, yb + 0.01, 0.3, [0.5, 0.52, 0.56], {});
    // (heaped: a layer and a mound over it)
    later(R, () => {
      const look = { line: 'ball', model, cell: null, tint, cap };
      for (let layer = 0; layer < 3; layer++) {
        const step = 2 * r + 0.01;
        for (let s = s0 + r + 0.02 + (layer % 2) * r; s < s1 - r; s += step) {
          for (let t = -0.3 + r + 0.02 + (layer % 2) * r; t < 0.3 - r; t += step) {
            if (layer === 2 && Math.hypot((s - (s0 + s1) / 2) / ((s1 - s0) / 2), t / 0.3) > 0.7) continue;
            put(R, look, wp(R, run, s, yb + 0.01 + layer * r * 1.6, t), yawOut(R, run) + s * 7 + t * 3, { back: layer < 2 });
          }
        }
      }
    });
    // the sign on its stick: the price
    rbox(R, S, run, (s0 + s1) / 2 - 0.006, yt, 0.29, (s0 + s1) / 2 + 0.006, yt + 0.3, 0.3, DARK, {});
    rprint(R, S, run, (s0 + s1) / 2 - 0.1, yt + 0.2, (s0 + s1) / 2 + 0.1, yt + 0.32, 0.301, `card.${(i * 3 + 2) % 10}`);
    const [u, d] = run.ud((s0 + s1) / 2, 0.75);
    R.spots.marks = R.spots.marks || [];
    R.spots.marks.push({ name: `bin.${i}`, u, d, y: yt + 0.05 - y0, face: [-run.ou, -run.od], model, tint, cap });
  }
  run.solid(0, -0.32, len, 0.32, y0 + 0.8);
}

// ------------------------------------------------------------------ the treadmill
// Its deck and the belt on it (its slats running: game/trylife.js), the side rails, the uprights and
// the console with its screen, the handles; a strip of running track on the floor before it.
export function treadmill(R, um, dm) {
  const S = R.psoup(false);
  const y0 = R.y0;
  // (its length along u: the runner faces +u's way, the console at the far end)
  const L = 1.7;
  const run = new Run(R, um - L / 2, dm, [1, 0], [0, 1]);
  rbox(R, S, run, 0, y0, -0.42, L, y0 + 0.16, 0.42, [0.22, 0.22, 0.24], { skip: ['bottom'] });
  rbox(R, S, run, 0.06, y0 + 0.16, -0.3, L - 0.3, y0 + 0.175, 0.3, [0.3, 0.3, 0.33], {});
  for (const t of [-0.36, 0.36]) rbox(R, S, run, 0, y0 + 0.16, t - 0.06, L - 0.25, y0 + 0.2, t + 0.06, [0.62, 0.64, 0.68], { pen: 'gloss' });
  // (the uprights, the console, its screen, the handles)
  for (const t of [-0.34, 0.34]) rbox(R, S, run, L - 0.28, y0 + 0.16, t - 0.03, L - 0.2, y0 + 1.25, t + 0.03, DARK, {});
  rbox(R, S, run, L - 0.34, y0 + 1.2, -0.38, L - 0.12, y0 + 1.36, 0.38, DARK, {});
  const cons = new Run(R, ...run.ud(L - 0.345, 0.2), [0, -1], [-1, 0]);
  rprint(R, S, cons, 0.06, y0 + 1.22, 0.34, y0 + 1.34, 0, 'ui.tread', { pen: 'screen' });
  for (const t of [-0.36, 0.36]) rbox(R, S, run, L - 0.7, y0 + 0.98, t - 0.02, L - 0.25, y0 + 1.02, t + 0.02, [0.62, 0.64, 0.68], { pen: 'gloss' });
  run.solid(0, -0.42, L, 0.42, y0 + 0.2);
  // (the running track before it: a red strip, its white lines)
  const tr = new Run(R, um - L / 2 - 1.4, dm, [1, 0], [0, 1]);
  rbox(R, S, tr, 0, y0, -0.4, 1.3, y0 + 0.004, 0.4, [0.74, 0.28, 0.22], {});
  for (const t of [-0.38, 0, 0.38]) rbox(R, S, tr, 0, y0 + 0.004, t - 0.012, 1.3, y0 + 0.006, t + 0.012, [0.96, 0.96, 0.94], {});
  // the marks: the belt's two ends (its slats run from the one to the other), where one walks on it
  mark(R, 'tread.a', run, 0.1, 0, y0 + 0.176, [run.au, run.ad]);
  mark(R, 'tread.b', run, L - 0.34, 0, y0 + 0.176, [run.au, run.ad]);
  mark(R, 'tread.on', run, (L - 0.3) * 0.55, 0, y0 + 0.18, [run.au, run.ad]);
  mark(R, 'tread.off', run, -0.45, 0, y0, [run.au, run.ad]);
}

// ------------------------------------------------------------------ the stock room's door
function stockDoor(R, u0, w) {
  const S = R.psoup(false);
  const y0 = R.y0;
  const run = new Run(R, u0, R.db + 0.02, [1, 0], [0, 1]);
  rbox(R, S, run, -0.06, y0, -0.02, w + 0.06, y0 + 2.18, 0.03, [0.3, 0.3, 0.33]);
  rbox(R, S, run, 0.02, y0 + 0.02, 0.03, w - 0.02, y0 + 2.1, 0.06, [0.86, 0.84, 0.8]);
  rbox(R, S, run, w - 0.2, y0 + 1.0, 0.06, w - 0.08, y0 + 1.04, 0.1, [0.74, 0.76, 0.8]);
  rprint(R, S, run, 0.2, y0 + 1.72, w - 0.2, y0 + 1.92, 0.061, 'sign.staff');
  void rcyl;
  void liveOk;
}
