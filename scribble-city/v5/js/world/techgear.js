import { Model, box, tube, lathe, addMaker } from './products.js';

// (v5, ROADMAP 16.6) An electronics shop's fittings (world/techstore.js): the security puck each demo
// phone stands on, tied to the table by its coiled cord; the police scanners in their case by the
// till.

const DARK = [0.15, 0.15, 0.17];
const STEEL = [0.7, 0.72, 0.76];

// a security puck: a round dark base on the table, the post leaning back with the cradle the phone
// stands in (its lip at the front), the white light of its alarm; out of its back the coiled cord,
// round and round, to the grommet in the table (the phone lifted off it: the cord drawn stretched
// from here to the hand - game/techlife.js)
addMaker('puck', (low) => {
  const m = new Model();
  m.size = [0.06, 0.05, 0.12];
  const seg = low ? 8 : 12;
  const base = m.part('plain', DARK, 0);
  lathe(base, [[0, 0], [0.03, 0], [0.03, 0.01], [0.026, 0.014], [0, 0.014]], seg);
  // (the post and the cradle's lip)
  const p = m.part('gloss', STEEL, 1);
  tube(p, [[0, 0.014, 0.004], [0, 0.04, -0.004]], 0.005, 5);
  box(p, -0.03, 0.012, 0.012, 0.03, 0.026, 0.018, {});
  // (its alarm's light: a white dot on the front)
  box(m.part('plain', [0.95, 0.97, 1], 2), -0.004, 0.006, 0.0295, 0.004, 0.01, 0.0305, { skip: ['nz'] });
  if (!low) {
    // the coiled cord: out of its back, to the grommet 7 cm behind it
    const cord = m.part('plain', [0.1, 0.1, 0.11], 3);
    const pts = [];
    const n = 54;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const a = u * Math.PI * 2 * 6;
      const z = -0.028 - u * 0.062;
      pts.push([Math.cos(a) * 0.0055, 0.0075 + Math.sin(a) * 0.0055 - u * 0.004, z]);
    }
    tube(cord, pts, 0.0016, 3);
    // the grommet: a dark ring let into the table
    lathe(m.part('plain', [0.06, 0.06, 0.07], 4), [[0.004, 0.0008], [0.011, 0.0008], [0.012, 0]], seg, {});
  }
  // (the grommet sits behind the puck: the lathe is round its own axis, moved there)
  for (const q of m.parts) {
    if (q.sub !== 4) continue;
    for (let i = 0; i < q.n; i++) q.P[i * 3 + 2] -= 0.092;
  }
  return m;
});

// a handheld police scanner, standing: its body (the look's tint), the rubber aerial, the green of
// its little screen, the keys in rows under it
addMaker('scanner', (low) => {
  const m = new Model();
  m.size = [0.06, 0.2, 0.03];
  const body = m.part('plain', null, 0);
  box(body, -0.03, 0, -0.014, 0.03, 0.12, 0.014, {});
  // (the aerial, off one shoulder)
  tube(m.part('plain', DARK, 1), [[0.018, 0.12, 0], [0.018, 0.2, 0]], 0.005, 5);
  // the screen, lit
  box(m.part('plain', [0.62, 0.86, 0.5], 2), -0.022, 0.084, 0.014, 0.022, 0.108, 0.0152, { skip: ['nz'] });
  if (!low) {
    const k = m.part('plain', [0.32, 0.33, 0.36], 3);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) box(k, -0.02 + c * 0.015, 0.014 + r * 0.016, 0.014, -0.012 + c * 0.015, 0.024 + r * 0.016, 0.0156, { skip: ['nz'] });
  }
  return m;
});
