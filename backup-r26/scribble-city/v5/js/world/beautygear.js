import { Model, box, tube, lathe, ball, addMaker } from './products.js';

// (v5, ROADMAP 16.7) The perfumery's, the optician's and the barber's things (world/beauty.js): the
// bottles of scent in their shapes, a tester's tray, the cup of paper strips; the frames on their
// rails, the eye-testing machine; the barber's chair, the jar of blue that the combs stand in, the
// cape, the broom, the hand mirror.

const GOLD = [0.86, 0.7, 0.36];
const STEEL = [0.74, 0.76, 0.8];
const DARK = [0.13, 0.13, 0.15];
const WHITE = [0.96, 0.96, 0.94];

// ------------------------------------------------------------------ the perfumery
// a round bottle: the glass (the look's tint: the scent's colour through it), its shoulder, the neck,
// the spray's collar and its cap (the look's cap: gold, black, silver)
addMaker('perfume', (low) => {
  const m = new Model();
  m.size = [0.07, 0.11, 0.07];
  const seg = low ? 8 : 14;
  lathe(m.part('gloss', null, 0), [[0, 0], [0.03, 0], [0.034, 0.008], [0.035, 0.04], [0.03, 0.062], [0.012, 0.07], [0.008, 0.074], [0, 0.074]], seg);
  lathe(m.part('gloss', GOLD, 1), [[0, 0.072], [0.011, 0.072], [0.011, 0.082], [0, 0.082]], seg);
  lathe(m.part('plain', 'cap', 2), [[0, 0.082], [0.016, 0.082], [0.017, 0.098], [0.012, 0.108], [0, 0.108]], seg);
  return m;
});

// a tall bottle, flat: a slab of glass with a thick base, a square cap
addMaker('perfumeTall', () => {
  const m = new Model();
  m.size = [0.05, 0.13, 0.03];
  box(m.part('gloss', null, 0), -0.024, 0, -0.014, 0.024, 0.1, 0.014, {});
  box(m.part('gloss', [0.9, 0.94, 0.98], 1), -0.025, 0, -0.015, 0.025, 0.012, 0.015, { skip: ['py'] });
  box(m.part('gloss', GOLD, 2), -0.007, 0.1, -0.007, 0.007, 0.106, 0.007, {});
  box(m.part('plain', 'cap', 3), -0.014, 0.106, -0.01, 0.014, 0.13, 0.01, {});
  return m;
});

// a cut-glass bottle: six faces round, a ball for its stopper
addMaker('perfumeFacet', (low) => {
  const m = new Model();
  m.size = [0.07, 0.12, 0.07];
  lathe(m.part('gloss', null, 0), [[0, 0], [0.032, 0], [0.036, 0.03], [0.03, 0.06], [0.01, 0.068], [0, 0.068]], 6);
  lathe(m.part('gloss', GOLD, 1), [[0, 0.066], [0.009, 0.066], [0.009, 0.076], [0, 0.076]], low ? 6 : 10);
  ball(m.part('plain', 'cap', 2), 0, 0.096, 0, 0.022, 1, low ? 5 : 7, low ? 6 : 9);
  return m;
});

// the box a bottle comes in: its colour, a band of the maker's other colour, the label on its face
addMaker('perfumeBox', () => {
  const m = new Model();
  m.size = [0.08, 0.13, 0.05];
  box(m.part('plain', null, 0), -0.04, 0, -0.025, 0.04, 0.13, 0.025, {});
  box(m.part('plain', 'cap', 1), -0.0405, 0.08, -0.0255, 0.0405, 0.096, 0.0255, {});
  return m;
});

// the testers' tray: a round mirror on a gold rim
addMaker('testerTray', (low) => {
  const m = new Model();
  m.size = [0.32, 0.012, 0.32];
  const seg = low ? 12 : 20;
  lathe(m.part('gloss', GOLD, 0), [[0, 0], [0.16, 0], [0.16, 0.012], [0.15, 0.012], [0, 0.012]], seg);
  lathe(m.part('gloss', [0.82, 0.88, 0.94], 1), [[0, 0.0125], [0.148, 0.0125]], seg);
  return m;
});

// a cup of the paper strips a scent is sprayed on, fanned out of it
addMaker('blotters', (low) => {
  const m = new Model();
  m.size = [0.07, 0.2, 0.07];
  lathe(m.part('gloss', [0.9, 0.9, 0.9], 0), [[0, 0], [0.03, 0], [0.034, 0.08], [0.03, 0.08], [0.026, 0.004], [0, 0.004]], low ? 8 : 12);
  const p = m.part('plain', WHITE, 1);
  for (let k = 0; k < (low ? 5 : 9); k++) {
    const a = (k / 9) * Math.PI * 2;
    const x = Math.cos(a) * 0.012;
    const z = Math.sin(a) * 0.012;
    box(p, x - 0.004, 0.02, z - 0.0006, x + 0.004, 0.17 + (k % 3) * 0.012, z + 0.0006, {});
  }
  return m;
});

// a jar of coffee beans (a breath of it between scents)
addMaker('beans', (low) => {
  const m = new Model();
  m.size = [0.08, 0.1, 0.08];
  lathe(m.part('gloss', [0.88, 0.92, 0.96], 0), [[0, 0], [0.038, 0], [0.04, 0.08], [0.034, 0.09], [0, 0.09]], low ? 8 : 12);
  lathe(m.part('plain', [0.32, 0.2, 0.12], 1), [[0, 0.004], [0.035, 0.004], [0.035, 0.06], [0, 0.066]], low ? 8 : 12);
  return m;
});

// ------------------------------------------------------------------ the optician
// a pair of glasses, open, facing +z: the two rims (round or square by the look's r), the bridge, the
// arms back; the lenses (clear, or dark: sunglasses - the look's cap)
addMaker('specs', (low) => {
  const m = new Model();
  m.size = [0.14, 0.05, 0.13];
  const fr = m.part('plain', null, 0);
  const n = low ? 10 : 16;
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([sx * 0.034 + Math.cos(a) * 0.026, 0.024 + Math.sin(a) * 0.019, 0]);
    }
    tube(fr, pts, 0.0028, 3);
    // the arm: from the rim's outer edge straight back, then down over the ear
    tube(fr, [[sx * 0.06, 0.03, 0], [sx * 0.064, 0.03, -0.1], [sx * 0.064, 0.012, -0.125]], 0.0022, 3);
  }
  tube(fr, [[-0.009, 0.03, 0], [0, 0.034, 0.002], [0.009, 0.03, 0]], 0.0025, 3);
  if (!low) {
    const ln = m.part('gloss', 'cap', 1);
    for (const sx of [-1, 1]) {
      const c = ln.vert(sx * 0.034, 0.024, 0, 0, 0, 1, 0.5, 0.5);
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        ln.vert(sx * 0.034 + Math.cos(a) * 0.025, 0.024 + Math.sin(a) * 0.018, 0, 0, 0, 1, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
        if (i) ln.tri(c, c + i, c + i + 1);
      }
    }
  }
  return m;
});

// the machine an eye is tested through: its dark body, the two round windows, the wheels of lenses at
// its sides, on its arm (+z: the patient's side)
addMaker('phoropter', (low) => {
  const m = new Model();
  m.size = [0.42, 0.2, 0.12];
  const b = m.part('plain', [0.18, 0.18, 0.2], 0);
  box(b, -0.2, 0, -0.04, 0.2, 0.16, 0.05, {});
  const w = m.part('plain', [0.08, 0.08, 0.09], 1);
  const n = low ? 10 : 16;
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([sx * 0.065 + Math.cos(a) * 0.025, 0.08 + Math.sin(a) * 0.025, 0.052]);
    }
    tube(w, pts, 0.006, 4);
    // (the wheels of lenses round the edges)
    lathe(m.part('plain', [0.85, 0.86, 0.88], 2), [[0, -0.005], [0.06, -0.005], [0.06, 0.005], [0, 0.005]], low ? 10 : 16);
  }
  // (the wheels: the lathe above is round its own axis - stood up and moved to each side)
  const q = m.parts[m.parts.length - 1];
  const q2 = m.parts[m.parts.length - 2];
  for (const [part, sx] of [[q2, -1], [q, 1]]) {
    for (let i = 0; i < part.n; i++) {
      const x = part.P[i * 3];
      const y = part.P[i * 3 + 1];
      const z = part.P[i * 3 + 2];
      part.P[i * 3] = sx * 0.2 + y;
      part.P[i * 3 + 1] = 0.08 + x;
      part.P[i * 3 + 2] = z;
      const nx = part.N[i * 3];
      part.N[i * 3] = part.N[i * 3 + 1];
      part.N[i * 3 + 1] = nx;
    }
  }
  // its arm, up and back to the column
  tube(m.part('gloss', STEEL, 3), [[0, 0.16, 0], [0, 0.2, -0.04], [0, 0.2, -0.3]], 0.014, 6);
  return m;
});

// ------------------------------------------------------------------ the barber
// the barber's chair, facing +z: the round chrome foot and its post, the seat and back in leather (the
// look's tint), the headrest, the arms, the footrest
addMaker('barberChair', (low) => {
  const m = new Model();
  m.size = [0.62, 1.3, 0.7];
  const seg = low ? 10 : 16;
  const ch = m.part('gloss', STEEL, 0);
  lathe(ch, [[0, 0], [0.27, 0], [0.27, 0.025], [0.2, 0.04], [0.05, 0.05], [0.05, 0.38], [0, 0.38]], seg);
  const lt = m.part('plain', null, 1);
  box(lt, -0.27, 0.38, -0.25, 0.27, 0.5, 0.27, {});
  box(lt, -0.26, 0.5, -0.3, 0.26, 1.08, -0.18, {});
  box(lt, -0.12, 1.12, -0.29, 0.12, 1.26, -0.2, {});
  // (the headrest's stem; the arms on their chrome)
  tube(ch, [[0, 1.06, -0.25], [0, 1.14, -0.25]], 0.012, 5);
  for (const sx of [-1, 1]) {
    box(lt, sx * 0.3 - 0.045, 0.66, -0.2, sx * 0.3 + 0.045, 0.7, 0.24, {});
    tube(ch, [[sx * 0.3, 0.5, 0.18], [sx * 0.3, 0.66, 0.18]], 0.012, 5);
    tube(ch, [[sx * 0.3, 0.5, -0.16], [sx * 0.3, 0.66, -0.16]], 0.012, 5);
  }
  // the footrest
  box(ch, -0.2, 0.16, 0.38, 0.2, 0.19, 0.5, {});
  tube(ch, [[-0.12, 0.38, 0.22], [-0.12, 0.18, 0.4]], 0.01, 5);
  tube(ch, [[0.12, 0.38, 0.22], [0.12, 0.18, 0.4]], 0.01, 5);
  return m;
});

// the jar of blue the combs stand in, its steel lid
addMaker('barbicide', (low) => {
  const m = new Model();
  m.size = [0.1, 0.24, 0.1];
  const seg = low ? 8 : 14;
  lathe(m.part('gloss', [0.86, 0.92, 0.96], 0), [[0, 0], [0.045, 0], [0.046, 0.2], [0, 0.2]], seg);
  lathe(m.part('gloss', [0.2, 0.55, 0.85], 1), [[0, 0.004], [0.043, 0.004], [0.043, 0.17], [0, 0.17]], seg);
  lathe(m.part('gloss', STEEL, 2), [[0, 0.2], [0.048, 0.2], [0.048, 0.215], [0.01, 0.222], [0.01, 0.235], [0, 0.235]], seg);
  // (the combs in it)
  const c = m.part('plain', DARK, 3);
  for (const x of [-0.02, 0, 0.018]) box(c, x - 0.004, 0.04, -0.002, x + 0.004, 0.19, 0.002, {});
  return m;
});

// clippers on the counter, their cord
addMaker('clippers', () => {
  const m = new Model();
  m.size = [0.05, 0.04, 0.17];
  box(m.part('plain', null, 0), -0.022, 0, -0.07, 0.022, 0.035, 0.06, {});
  box(m.part('gloss', STEEL, 1), -0.024, 0.005, 0.06, 0.024, 0.03, 0.075, {});
  tube(m.part('plain', DARK, 2), [[0, 0.015, -0.07], [0.02, 0.006, -0.12], [0.06, 0.004, -0.16]], 0.004, 4);
  return m;
});

// the cape over a customer in the chair (at their neck: game/beautylife.js): a bell of cloth to the
// knees, its colour the look's tint, a white band at the neck
addMaker('cape', (low) => {
  const m = new Model();
  m.size = [0.7, 0.6, 0.6];
  const seg = low ? 10 : 16;
  lathe(m.part('plain', null, 0), [[0.06, 0.6], [0.16, 0.56], [0.3, 0.36], [0.36, 0.06], [0.37, 0]], seg);
  lathe(m.part('plain', WHITE, 1), [[0.055, 0.6], [0.065, 0.63], [0.075, 0.6]], seg);
  return m;
});

// a broom: its handle, the head, the bristles
addMaker('broom', () => {
  const m = new Model();
  m.size = [0.32, 1.3, 0.06];
  tube(m.part('plain', [0.62, 0.46, 0.3], 0), [[0, 0.08, 0], [0, 1.3, 0]], 0.012, 5);
  box(m.part('plain', [0.2, 0.2, 0.22], 1), -0.15, 0.06, -0.025, 0.15, 0.1, 0.025, {});
  box(m.part('plain', [0.82, 0.68, 0.36], 2), -0.15, 0, -0.022, 0.15, 0.06, 0.022, {});
  return m;
});

// the hand mirror shown behind the head when it is done
addMaker('handMirror', (low) => {
  const m = new Model();
  m.size = [0.18, 0.32, 0.02];
  const n = low ? 10 : 16;
  const fr = m.part('plain', DARK, 0);
  const gl = m.part('gloss', [0.82, 0.88, 0.94], 1);
  const pts = [];
  const c = gl.vert(0, 0.22, 0.006, 0, 0, 1, 0.5, 0.5);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([Math.cos(a) * 0.085, 0.22 + Math.sin(a) * 0.095, 0]);
    gl.vert(Math.cos(a) * 0.08, 0.22 + Math.sin(a) * 0.09, 0.006, 0, 0, 1, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    if (i) gl.tri(c, c + i, c + i + 1);
  }
  tube(fr, pts, 0.008, 4);
  tube(fr, [[0, 0.12, 0], [0, 0, 0]], 0.012, 5);
  return m;
});

// a strip of paper a scent is sprayed on, held up by its end
addMaker('strip', () => {
  const m = new Model();
  m.size = [0.012, 0.15, 0.002];
  box(m.part('plain', WHITE, 0), -0.006, 0, -0.0008, 0.006, 0.15, 0.0008, {});
  return m;
});

// a tuft of cut hair on the floor: a few short strokes lying crossed (the look's tint: its colour)
addMaker('clip', () => {
  const m = new Model();
  m.size = [0.08, 0.004, 0.08];
  const p = m.part('plain', null, 0);
  for (let k = 0; k < 5; k++) {
    const a = k * 1.3;
    const l = 0.03 + (k % 3) * 0.012;
    tube(p, [[Math.cos(a) * -l, 0.002, Math.sin(a) * -l], [Math.cos(a) * l, 0.002, Math.sin(a) * l]], 0.0018, 3);
  }
  return m;
});
