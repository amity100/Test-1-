import { clamp } from '../core/util.js';
import { shapeOf, specOf, inPoly, outline } from './drawncar.js';

// (ROADMAP 11.10, the sample) What a ride does is its parts added up - each part does one thing,
// the same thing on anything it is put on, and how much of it by how big it was drawn:
//   - a wheel: it drives. The bigger the wheels, the faster; the more of them, the better they hold
//     the road; the further apart, the steadier (and the wider it turns)
//   - a rotor: it lifts - as much as it is big for what it carries (too small for the weight, it
//     will not lift: drawn bigger, or the thing lighter)
//   - wings with a propeller or a jet: it flies (the bigger the wings for the weight, the slower it
//     can fly without falling; the bigger the propeller, the jets, the faster); wings alone, on
//     wheels: it glides off a jump
//   - a sail, a floating hull: it sails; a balloon: it rises
//   - a barrel: it fires - each one, on a turret of its own. Its length is its reach and how true it
//     shoots; its thickness what it fires: a thin one a machine gun, quick; a thick one a cannon
//   - a blade at its front: it rams; a spring: it jumps (the more coils, the higher); a parachute:
//     opened in the air (G), it comes down slowly - the bigger, the slower; armour: hits hurt less
//   - and everything weighs: each part makes it heavier, slower off the mark - it has its price
// Its name is made of them too ("a flying armed car"), and the ink it takes.

// a part's kind in game/drawncar.js (its model, its spec)
const TYPE = { body: 'body', cabin: 'body', hull: 'body', wheel: 'wheel', barrel: 'gun', blade: 'blade', wing: 'wing', rotor: 'rotor', prop: 'prop', jet: 'jet', fin: 'fin', mast: 'line', tail: 'line', skid: 'line', sail: 'sail', balloon: 'envelope', chute: 'chute', spring: 'spring', armor: 'armor', window: 'line', deco: 'line' };
// how much ink each part takes
const INK = { body: 0, cabin: 3, hull: 2, wheel: 1.5, barrel: 5, blade: 4, wing: 6, rotor: 10, prop: 3, jet: 5, fin: 1, tail: 1, skid: 1, mast: 0.5, sail: 4, balloon: 10, chute: 6, spring: 5, armor: 4, window: 0.5, deco: 0.5 };
// what moves it (one of them, at least, or it is a statue)
const MOVERS = new Set(['wheel', 'rotor', 'wing', 'prop', 'jet', 'sail', 'balloon', 'hull']);

// ------------------------------------------------------------------ the drawing, in metres
// P: game/parts.js readParts (a ride's); strokes: the drawing's ({ p, c }, page units); inks: the
// ink table (game/freeform.js INKS). Returns the design game/drawncar.js builds (polished) - or null.
// Its body is what its lines close round (P.R: however many lines drew it), the lines that drew it
// its edges; a plane drawn from above, the same plane from its side; a bike, its frame of tubes
function inkOf(inks, i) {
  const ink = inks[i] || inks[0];
  return { col: ink.c.slice(), pencil: !!ink.pencil, neon: !!ink.neon };
}

export function rideDesign(P, strokes, inks) {
  if (!P || P.frame !== 'ride' || !P.R) return null;
  if (P.top) return topDesign(P, inks);
  const B = P.R.sh;
  if (!(B.w > 0)) return null;
  const types = new Set(P.parts.map((p) => p.type));
  // its real size: as long as it was drawn big (a car drawn across a third of the screen is a
  // car's length), within what its kind can be
  const bodyPage = B.w / P.k;
  let lo = 1.4;
  let hi = 12;
  if (types.has('rotor')) [lo, hi] = [3, 14];
  if (types.has('wing') && (types.has('prop') || types.has('jet'))) [lo, hi] = [4.5, 16];
  if (P.family === 'boat') [lo, hi] = [2.5, 20];
  if (P.R.bike) [lo, hi] = [1.5, 2.6];
  let L = clamp(bodyPage * 3.4, lo, hi);
  // (a balloon: by its envelope - a balloon is ten metres tall or so)
  const env = P.st.find((o) => o.type === 'balloon');
  if (env) L = clamp((env.sh.h / P.k) * 7, 6, 16) * (B.w / env.sh.h);
  const m = L / Math.max(1e-3, B.w);
  // its paint: the ink most of it is drawn in (pencil only: a paint of its own)
  const lens = new Map();
  for (const o of P.st) {
    const ink = inks[o.ink];
    if (!ink || ink.pencil || ink.neon) continue;
    lens.set(o.ink, (lens.get(o.ink) || 0) + o.sh.len);
  }
  let best = -1;
  let bestL = -1;
  for (const [c, l] of lens) {
    if (l > bestL) {
      bestL = l;
      best = c;
    }
  }
  const PAINTS = [[0.92, 0.2, 0.24], [0.22, 0.55, 0.95], [1.0, 0.78, 0.2], [0.3, 0.8, 0.45], [1.0, 0.55, 0.16], [0.55, 0.4, 0.95], [0.95, 0.93, 0.88]];
  const seed = Math.floor(Math.abs(B.w * 1000 + P.st.length * 37 + B.h * 777)) % PAINTS.length;
  const color = best >= 0 ? inks[best].c.slice() : PAINTS[seed].slice();
  const main = P.st.find((o) => o.i === P.body);
  const bodyInk = inkOf(inks, main ? main.ink : best >= 0 ? best : 0);
  const out = [];
  const M = (pts) => pts.map(([x, y]) => [x * m, y * m]);
  // the body: its outline
  const boat = P.family === 'boat';
  if (P.R.loop) out.push({ type: 'body', part: boat ? 'hull' : 'body', pts: M(P.R.loop.concat([P.R.loop[0]])), ...bodyInk, hull: boat || undefined, made: true });
  else if (P.R.bike) {
    // (a bike: a slim tank and seat over its frame, between its wheels)
    const w = P.st.filter((o) => o.type === 'wheel').map((o) => o.sh);
    const r = w.length ? w.reduce((a, q) => a + (q.w + q.h) / 4, 0) / w.length : B.h * 0.3;
    const xa = B.x0 + B.w * 0.3;
    const xb = B.x0 + B.w * 0.7;
    const y = (w.length ? Math.max(...w.map((q) => q.cy)) : B.y0) + r * 0.85;
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const t = (k / 16) * Math.PI * 2;
      pts.push([(xa + xb) / 2 + Math.cos(t) * (xb - xa) / 2, y + Math.sin(t) * r * 0.32]);
    }
    out.push({ type: 'body', part: 'body', pts: M(pts), ...bodyInk, slim: true, made: true });
  } else if (P.R.made) {
    // (a balloon with no basket drawn: one, under its envelope)
    const b = P.R.sh;
    out.push({ type: 'body', part: 'body', pts: M([[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1], [b.x0, b.y0]]), ...bodyInk, made: true });
  }
  const ol = P.R.loop || null;
  for (const o of P.st) {
    const ink = inkOf(inks, o.ink);
    let type = TYPE[o.type] || 'line';
    // (the lines that drew the body: its edges, the body itself now)
    const edge = P.R.loop && (o.type === 'body' || o.type === 'cabin' || o.type === 'hull');
    if (edge || o.type === 'frame') type = 'line';
    const s = { type, part: o.type, pts: M(o.pts), ...ink };
    if (edge) s.edge = true;
    if (o.type === 'spring') s.coils = o.sh.coils;
    // (half a wheel drawn, hanging from it - a U, a C: the whole wheel it goes round)
    if (o.type === 'wheel' && !o.sh.closed) {
      const f = o.sh.fit && o.sh.fit.cover > 2.5 && o.sh.fit.err < 0.3 ? o.sh.fit : o.sh.cup;
      if (f) {
        s.pts = [];
        for (let k = 0; k <= 24; k++) s.pts.push([(f.cx + Math.cos((k / 24) * Math.PI * 2) * f.r) * m, (f.cy + Math.sin((k / 24) * Math.PI * 2) * f.r) * m]);
      }
    }
    if (o.type === 'barrel') {
      // (a line: a thin barrel; a long closed shape: as thick as it was drawn)
      s.r = o.sh.closed || o.sh.endGap < o.sh.long * 0.35 ? clamp((o.sh.thick * m) / 2, 0.04, 0.32) : 0.045;
      // its two ends along it: the one out of the body is its muzzle
      const a = [o.sh.cx - (o.sh.ux * o.sh.long) / 2, o.sh.cy - (o.sh.uy * o.sh.long) / 2];
      const b = [o.sh.cx + (o.sh.ux * o.sh.long) / 2, o.sh.cy + (o.sh.uy * o.sh.long) / 2];
      const away = (q) => (ol && inPoly(q[0], q[1], ol) ? -1 : 0) + Math.hypot(q[0] - B.cx, q[1] - B.cy) / Math.max(1e-3, B.size);
      const [base, muz] = away(a) > away(b) ? [b, a] : [a, b];
      s.base = [base[0] * m, base[1] * m];
      s.muz = [muz[0] * m, muz[1] * m];
      s.len = o.sh.long * m;
    }
    if (o.type === 'blade' || o.type === 'wing' || o.type === 'rotor' || o.type === 'chute') s.len = o.sh.long * m;
    out.push(s);
  }
  // (wheels in its wheel arches, drawn without: game/parts.js archesOf)
  for (const a of P.arches || []) {
    const pts = [];
    for (let k = 0; k <= 24; k++) pts.push([(a.x + Math.cos((k / 24) * Math.PI * 2) * a.r) * m, (a.y + Math.sin((k / 24) * Math.PI * 2) * a.r) * m]);
    out.push({ type: 'wheel', part: 'wheel', pts, ...bodyInk, neon: false, implicit: true });
  }
  return { color, strokes: out, polish: true, plane: P.family === 'plane' || undefined };
}

// a plane drawn from above: the same plane from its side - its body as long as drawn and as thick as
// it was wide, its wings as long and as broad as drawn, its tail as tall as its tailplane was wide;
// the engines, the propeller drawn on it, there
function topDesign(P, inks) {
  const T = P.top;
  const L = clamp((T.len / P.k) * 3.4, 4.5, 16);
  const k = L / T.len;
  const h = clamp(T.fw * k * 1.1, 0.8, 1.8);
  const main = P.st.find((o) => o.i === P.body) || P.st[0];
  const bodyInk = inkOf(inks, main.ink);
  const wingS = P.st.find((o) => o.type === 'wing');
  const finS = P.st.find((o) => o.type === 'fin');
  const wingInk = wingS ? inkOf(inks, wingS.ink) : bodyInk;
  const finInk = finS ? inkOf(inks, finS.ink) : bodyInk;
  // (its body from the side: a rounded nose, a tail that thins and rises)
  const body = [];
  const prof = (t) => (h / 2) * Math.pow(Math.sin(Math.PI * clamp(t * 0.92 + 0.04, 0, 1)), 0.45) * (t < 0.35 ? 0.55 + t * 1.3 : 1);
  const mid = (t) => h / 2 + 0.2 + (t < 0.3 ? (0.3 - t) * 0.9 : 0);
  for (let i = 0; i <= 24; i++) body.push([(i / 24) * L, mid(i / 24) + prof(i / 24)]);
  for (let i = 24; i >= 0; i--) body.push([(i / 24) * L, mid(i / 24) - prof(i / 24)]);
  const c = h / 2 + 0.2;
  const wc = clamp(T.wingAt, 0.25, 0.75) * L;
  const chord = clamp(T.chord * k, L * 0.14, L * 0.4);
  const out = [{ type: 'body', part: 'body', pts: body, ...bodyInk, made: true }];
  out.push({ type: 'wing', part: 'wing', pts: [[wc - chord / 2, c], [wc + chord / 2, c]], span: clamp(T.span * k, 3, 22), len: chord, ...wingInk, made: true });
  const tail = clamp(T.tailSpan * k * 0.35, 0.6, 2.2);
  out.push({ type: 'fin', part: 'fin', pts: [[0.25, c + h * 0.3], [0.45, c + h * 0.3 + tail], [1.3, c + h * 0.3], [0.25, c + h * 0.3]], ...finInk, made: true });
  // (its engines on its wings: under them; its propeller at its nose)
  const jets = P.st.filter((o) => o.type === 'jet');
  jets.slice(0, 4).forEach((o, i) => {
    const r = clamp(o.sh.size * k * 0.35, 0.25, 0.6);
    const x = wc + chord * 0.1;
    const y = c - r - 0.05;
    const pts = [];
    for (let q = 0; q <= 12; q++) pts.push([x + Math.cos((q / 12) * Math.PI * 2) * r * 1.6, y + Math.sin((q / 12) * Math.PI * 2) * r]);
    out.push({ type: 'jet', part: 'jet', pts, ...inkOf(inks, o.ink), made: true, side: i % 2 ? -1 : 1 });
  });
  if (P.st.some((o) => o.type === 'prop')) out.push({ type: 'prop', part: 'prop', pts: [[L + 0.05, c - h * 0.7], [L + 0.05, c + h * 0.7]], ...bodyInk, made: true });
  const color = bodyInk.pencil ? [0.95, 0.93, 0.88] : bodyInk.col.slice();
  return { color, strokes: out, polish: true, above: true, plane: true };
}

// ------------------------------------------------------------------ what it can do: the parts added up
// design: rideDesign's (or a saved one). Returns game/drawncar.js specOf's spec, its numbers the
// parts', and sum: what the card by the drawing shows (ui/freedraw.js)
export function rideSpec(design) {
  const S = design.strokes;
  const of = (t) => S.filter((s) => (s.part || legacy(s)) === t);
  const bodies = S.filter((s) => s.type === 'body');
  const wheels = of('wheel').map((s) => {
    const sh = shapeOf(s.pts);
    return { z: sh.mx, y: sh.my, r: clamp((sh.w + sh.h) / 4, 0.12, 1.3) };
  });
  // (the lines of one rotor - an X, a star, its blades drawn one by one - are one rotor, as wide as
  // all of them; two apart, two rotors)
  const rotors = [];
  for (const s of of('rotor')) {
    const sh = shapeOf(s.pts);
    const w = Math.max(sh.w, s.len || 0);
    const near = rotors.find((r) => sh.x1 > r.x0 - w * 0.15 && sh.x0 < r.x1 + w * 0.15 && Math.abs(sh.cy - r.cy) < Math.max(r.w, w) * 0.35);
    if (near) {
      near.x0 = Math.min(near.x0, sh.x0);
      near.x1 = Math.max(near.x1, sh.x1);
      near.w = Math.max(near.x1 - near.x0, w, near.w);
      near.cx = (near.x0 + near.x1) / 2;
    } else rotors.push({ x0: sh.x0, x1: sh.x1, w, cx: sh.cx, cy: sh.cy, h: sh.h, y0: sh.y0, y1: sh.y1 });
  }
  const rotorN = rotors.length;
  const wings = of('wing').map((s) => shapeOf(s.pts));
  const props = of('prop').map((s) => shapeOf(s.pts));
  const jets = of('jet').map((s) => shapeOf(s.pts));
  const sails = of('sail');
  const hulls = S.filter((s) => s.hull && s.type === 'body');
  const balloons = of('balloon');
  const barrels = of('barrel');
  const blades = of('blade');
  const springs = of('spring');
  const chutes = of('chute').map((s) => shapeOf(s.pts));
  const armors = of('armor');
  const fins = of('fin');
  // ---- its size, its weight
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  let area = 0;
  for (const s of bodies) {
    const sh = shapeOf(s.pts);
    x0 = Math.min(x0, sh.x0);
    x1 = Math.max(x1, sh.x1);
    y0 = Math.min(y0, sh.y0);
    y1 = Math.max(y1, sh.y1);
    area += sh.area || sh.w * sh.h * 0.7;
  }
  const L = x1 - x0;
  const H = y1 - y0;
  if (!bodies.length || !(L > 0)) return { ok: false, why: 'חסר גוף: צורה סגורה גדולה', sum: null };
  const rAvg = wheels.length ? wheels.reduce((a, w) => a + w.r, 0) / wheels.length : 0;
  const R = rotors.length ? clamp((Math.max(...rotors.map((r) => r.w)) / 2) * 1.15, 0.8, 5.5) : 0;
  // (the wings: as long as drawn side on, front to back; across, as the plane is long)
  const span = (w) => clamp(Math.max(w.w * 2.6, L * 0.95), 2.2, 16);
  const wingA = wings.reduce((a, w) => a + w.w * span(w), 0);
  let thrust = props.reduce((a, p) => a + clamp(p.h, 0.5, 3.2) * 1.3, 0) + jets.reduce((a, j) => a + clamp(j.size, 0.3, 1.6) * 3.2, 0);
  // (a plane drawn as a plane - its body, its wings, its tail - with no engine drawn: one inside it,
  // a small one; the one drawn is stronger)
  const inner = !thrust && design.plane && wings.length > 0;
  if (inner) thrust = 1.6;
  const W0 = clamp(0.55 + L * 0.24, 0.9, 2.3);
  let mass = area * W0 * 0.16;
  mass += wheels.reduce((a, w) => a + 0.025 + w.r * w.r * 0.25, 0);
  mass += barrels.reduce((a, s) => a + 0.03 + (s.len || 1) * (s.r || 0.05) ** 2 * 6, 0);
  mass += rotorN * (0.12 + R * 0.03) + wings.reduce((a, w) => a + w.w * span(w) * 0.012, 0);
  mass += props.length * 0.04 + jets.length * 0.1 + fins.length * 0.02 + sails.length * 0.04 + balloons.length * 0.15;
  mass += chutes.length * 0.06 + springs.length * 0.06 + armors.length * 0.22 + blades.length * 0.05;
  mass = clamp(mass, 0.15, 6);
  // ---- how it goes: what it can do of each way
  const drive = wheels.length > 0;
  const liftR = R ? (R * R * 1.15 * (1 + (rotorN - 1) * 0.6)) / mass : 0;
  const copter = rotors.length > 0 && liftR >= 1;
  const liftW = wings.length ? wingA / (mass * 3.5) : 0;
  const plane = wings.length > 0 && thrust > 0 && liftW >= 0.7;
  const glide = wings.length > 0 && !plane && drive;
  const boat = hulls.length > 0 || sails.length > 0;
  const balloon = balloons.length > 0;
  // (what it mostly is: wheels under a plane or a helicopter - small ones, under a long thin body -
  // are its landing gear: it is a plane that can roll along, not a car that flies)
  const gear = drive && (rAvg < H * 0.27 || L / Math.max(0.1, H) > 4.8);
  const force = plane && (gear || !drive) ? 'plane' : copter && (gear || !drive) ? 'copter' : drive ? 'car' : copter ? 'copter' : plane ? 'plane' : balloon ? 'balloon' : boat ? 'boat' : null;
  const warn = [];
  if (rotors.length && !copter) warn.push('הרוטור קטן מדי למשקל — לא יתרומם. רוטור גדול יותר, או פחות משקל');
  if (wings.length && thrust > 0 && !plane) warn.push('הכנפיים קטנות מדי למשקל — לא ימריא');
  if (wings.length && !thrust && !drive) warn.push('כנפיים בלי מדחף או סילון — אין מה שיזיז אותו');
  if (inner) warn.push('לא צויר מנוע: יש לו מנוע קטן בפנים. מדחף או סילון שמציירים — מהיר יותר');
  if (!force) {
    const sum = summary({ ok: false, mass, L, H, wheels, warn, design, liftR, liftW });
    return { ok: false, why: 'עוד לא זז — הוסיפו גלגלים, רוטור, כנפיים עם מדחף, מפרש או בלון', sum, mass };
  }
  const abil = { drive, fly: copter && force !== 'copter' ? 'rotor' : plane && force !== 'plane' ? 'wings' : balloon && force !== 'balloon' ? 'balloon' : undefined, float: boat && force !== 'boat', gun: barrels.length > 0 };
  // (the drawing as game/drawncar.js reads one - and then its numbers, the parts')
  const spec = specOf(Object.assign({}, design, { force, abil, name: undefined }));
  if (!spec.ok) return { ok: false, why: spec.why, sum: null };
  spec.mass = mass;
  // ---- on wheels
  if (spec.modes.drive) {
    const n = wheels.length;
    const zs = wheels.map((w) => w.z);
    const base = n > 1 ? Math.max(...zs) - Math.min(...zs) : 0;
    const top = clamp(16 + rAvg * 36 + jets.length * 5 - mass * 2.6 - (n === 1 ? 6 : 0), 9, 46);
    const power = clamp(19 + jets.length * 3 - mass * 4.2 + Math.min(n, 4) * 0.3, 5, 24);
    const grip = clamp(3 + Math.min(n, 6) * 1.0 + rAvg * 2.5 + (fins.length ? 0.6 : 0) + (base / L) * 1.5, 3, 11);
    spec.handling = { mass: clamp(mass, 0.4, 3.2), power, top, grip, slide: clamp(0.8 + grip * 0.03, 0.85, 1.2), steer: clamp(2.25 - base * 0.17, 0.8, 2.3), roll: clamp(H * 0.45, 0.2, 1.4), pitch: 0.5 };
    spec.glide = glide ? clamp(wingA / (mass * 6), 0.15, 0.75) : 0;
    spec.steady = clamp((n >= 4 ? 0.8 : n === 3 ? 0.65 : n === 2 ? 0.45 : 0.2) + (base / L) * 0.25 - H * 0.05, 0, 1);
  }
  // ---- in the air
  if (spec.modes.copter) {
    spec.rotorR = R;
    spec.qCopter = { speed: clamp(0.5 + R * 0.1 + (liftR - 1) * 0.25, 0.45, 1.45), accel: clamp(0.65 + (liftR - 1) * 0.5 + R * 0.05, 0.6, 1.4) };
    if (spec.base === 'copter') spec.q = spec.qCopter;
  }
  if (spec.modes.plane) {
    spec.qPlane = { speed: clamp(0.75 + thrust * 0.08 - mass * 0.04, 0.6, 1.35), accel: clamp(1.0 + thrust * 0.12 - mass * 0.04, 0.9, 2.0) };
    // (the bigger the wings for its weight, the slower it flies without falling)
    spec.stallV = clamp(17 / Math.sqrt(Math.max(0.5, liftW / 0.9)), 11, 26);
    spec.takeoffV = spec.stallV + 4;
    if (spec.base === 'plane') spec.q = spec.qPlane;
  }
  // ---- its gear
  if (springs.length) {
    const sh = shapeOf(springs[0].pts);
    spec.spring = { jump: clamp(6 + (springs[0].coils || 4) * 0.45 + sh.h * 1.2 + (springs.length - 1), 6, 14) };
  } else delete spec.spring;
  if (chutes.length) {
    const c = chutes[0];
    spec.chute = { sink: clamp(3 + mass * 1.4 - (c.w / Math.max(0.5, L)) * 1.6, 2.2, 7), deploy: true, w: c.w };
  } else delete spec.chute;
  spec.armor = armors.length ? clamp(0.22 + armors.length * 0.07, 0.22, 0.55) : 0;
  if (blades.length) spec.ram = { k: clamp(1.4 + Math.max(...blades.map((s) => s.len || 1)) * 0.5, 1.4, 3) };
  // ---- its barrels: each fires
  spec.guns = barrels.map((s) => gunOf(s));
  spec.gun = spec.guns.length ? { r: spec.guns[0].r, len: spec.guns[0].len, type: spec.guns[0].type } : undefined;
  delete spec.cannon;
  // ---- how much it takes, what it is called
  spec.hp = Math.round(clamp(70 + mass * 60 + area * 4, 80, 450) * (1 + spec.armor));
  let cost = 14 + area * 1.2;
  for (const s of S) cost += INK[s.part] || 0;
  spec.cost = Math.round(clamp(cost, 18, 95));
  const sum = summary({ ok: true, spec, mass, L, H, wheels, rAvg, R, liftR, liftW, warn, design, copter, plane, glide, boat, balloon });
  spec.label = sum.name;
  spec.sum = sum;
  spec.polish = true;
  return spec;
}

// (a design made before parts: its kinds as game/drawncar.js had them)
function legacy(s) {
  return s.type === 'gun' ? 'barrel' : s.type === 'envelope' ? 'balloon' : s.type;
}

// a barrel: what it fires, how hard, how far, how true
export function gunOf(s) {
  const r = s.r || 0.05;
  const len = s.len || 1;
  const cannon = r >= 0.11;
  if (cannon) {
    const speed = clamp(42 + len * 5, 42, 70);
    return { type: 'cannon', r, len, reload: clamp(0.8 + r * 5, 1.0, 2.6), dmg: Math.round(clamp(80 + r * 520, 100, 240)), blast: clamp(2.5 + r * 18, 3, 8.5), speed, spread: clamp(0.03 / (1 + len * 0.8), 0.004, 0.03), range: Math.round(speed * 3.2) };
  }
  const speed = clamp(70 + len * 14, 70, 130);
  return { type: 'mg', r, len, reload: clamp(0.05 + r * 1.2, 0.07, 0.16), dmg: Math.round(clamp(6 + r * 140, 8, 20)), speed, spread: clamp(0.06 / (1 + len * 0.9), 0.007, 0.06), life: 2.5, range: Math.round(speed * 2.5) };
}

// ------------------------------------------------------------------ the card: its name, what it does, its numbers
const NOUN = {
  car: ['מכונית', 'f'],
  moto: ['אופנוע', 'm'],
  mono: ['חד־אופן', 'm'],
  truck: ['משאית', 'f'],
  monster: ['מכונית מפלצת', 'f'],
  copter: ['מסוק', 'm'],
  plane: ['מטוס', 'm'],
  boat: ['סירה', 'f'],
  sailboat: ['סירת מפרש', 'f'],
  ship: ['ספינה', 'f'],
  balloon: ['כדור פורח', 'm'],
  tank: ['טנק', 'm'],
  still: ['פסל', 'm'],
};
const ADJ = {
  fly: ['מעופף', 'מעופפת'],
  glide: ['גולש', 'גולשת'],
  float: ['אמפיבי', 'אמפיבית'],
  armed: ['חמוש', 'חמושה'],
  armor: ['משוריין', 'משוריינת'],
  jump: ['קופץ', 'קופצת'],
};

function summary(o) {
  const { spec, mass, L, wheels, warn } = o;
  const S = o.design.strokes;
  const has = (t) => S.some((s) => (s.part || legacy(s)) === t);
  const nBarrels = S.filter((s) => (s.part || legacy(s)) === 'barrel').length;
  // ---- its name: what it mostly is, and what else
  let noun = 'still';
  const base = spec ? spec.base : null;
  if (base === 'car') {
    const n = wheels.length;
    const cannon = spec.guns && spec.guns.some((gn) => gn.type === 'cannon');
    noun = n === 1 ? 'mono' : n === 2 && L < 3.2 ? 'moto' : cannon && n >= 4 ? 'tank' : (o.rAvg || 0) > 0.62 ? 'monster' : L > 6.8 ? 'truck' : 'car';
  } else if (base === 'copter') noun = 'copter';
  else if (base === 'plane') noun = 'plane';
  else if (base === 'balloon') noun = 'balloon';
  else if (base === 'boat') noun = L > 10 ? 'ship' : has('sail') ? 'sailboat' : 'boat';
  const [word, g] = NOUN[noun];
  const adj = [];
  const say = (k) => adj.push(ADJ[k][g === 'f' ? 1 : 0]);
  if (spec) {
    const M = spec.modes;
    if (base !== 'copter' && base !== 'plane' && base !== 'balloon' && (M.copter || M.plane || M.balloon)) say('fly');
    else if (o.glide) say('glide');
    if (base !== 'boat' && M.boat) say('float');
    if (nBarrels && noun !== 'tank') say('armed');
    if (spec.armor) say('armor');
    if (spec.spring && adj.length < 2) say('jump');
  }
  let name = [word, ...adj.slice(0, 2)].join(' ');
  if (has('chute') && spec && spec.chute) name += ' עם מצנח';
  else if (has('blade') && spec && spec.ram) name += ' עם איל';
  // ---- what it does (a chip each)
  const abil = [];
  if (spec) {
    const M = spec.modes;
    if (M.drive) abil.push(['move', 'נסיעה']);
    if (M.copter) abil.push(['air', 'ריחוף']);
    if (M.plane) abil.push(['air', 'טיסה']);
    if (o.glide) abil.push(['air', 'גלישה']);
    if (M.balloon) abil.push(['air', 'התרוממות']);
    if (M.boat) abil.push(['water', 'שיט']);
    if (nBarrels) abil.push(['fire', nBarrels > 1 ? `ירי ×${nBarrels}` : 'ירי']);
    if (spec.ram) abil.push(['fire', 'ניגוח']);
    if (spec.spring) abil.push(['gear', 'קפיצה']);
    if (spec.chute) abil.push(['gear', 'מצנח']);
    if (spec.armor) abil.push(['gear', 'שריון']);
  }
  // ---- its numbers (each 0..1 for its bar, and as it is said)
  const bars = [];
  if (spec) {
    const M = spec.modes;
    // (on the ground, on the water, in the air: each its own)
    if (M.drive) {
      bars.push({ k: 'speed', name: 'מהירות', v: (spec.handling.top * 3.6) / 170, txt: `${Math.round(spec.handling.top * 3.6)} קמ״ש` });
      bars.push({ k: 'accel', name: 'תאוצה', v: spec.handling.power / 24, txt: '' });
      bars.push({ k: 'grip', name: 'אחיזה', v: spec.handling.grip / 11, txt: '' });
    } else if (M.boat && spec.boat) {
      const kmh = 20 * spec.boat.q.speed * 3.6;
      bars.push({ k: 'speed', name: 'מהירות', v: kmh / 100, txt: `${Math.round(kmh)} קמ״ש` });
    }
    let air = 0;
    if (M.copter) air = Math.max(air, 24 * spec.qCopter.speed * 3.6);
    if (M.plane) air = Math.max(air, 48 * spec.qPlane.speed * 3.6);
    if (M.balloon && spec.balloon) air = Math.max(air, spec.balloon.drift * 3.6);
    if (air) bars.push({ k: 'air', name: 'בטיסה', v: air / 240, txt: `${Math.round(air)} קמ״ש` });
    if (rotorOrWings(o)) {
      const lift = Math.max(o.liftR || 0, o.liftW ? o.liftW / 0.7 : 0);
      bars.push({ k: 'lift', name: 'עילוי', v: Math.min(1, lift / 2), txt: `×${lift.toFixed(1)}`, bad: lift < 1 });
    }
    if (spec.guns.length) {
      const dps = spec.guns.reduce((a, gn) => a + gn.dmg / gn.reload, 0);
      const range = Math.max(...spec.guns.map((gn) => gn.range));
      bars.push({ k: 'fire', name: 'כוח אש', v: Math.min(1, dps / 320), txt: spec.guns.map((gn) => (gn.type === 'cannon' ? 'תותח' : 'מקלע')).join(' + ') });
      bars.push({ k: 'range', name: 'טווח', v: Math.min(1, range / 330), txt: `${range} מ׳` });
    }
    if (spec.spring) {
      const h = (spec.spring.jump * spec.spring.jump) / 40;
      bars.push({ k: 'jump', name: 'קפיצה', v: Math.min(1, h / 5), txt: `${h.toFixed(1)} מ׳` });
    }
    bars.push({ k: 'hp', name: 'עמידות', v: spec.hp / 450, txt: `${spec.hp}` });
  } else if (rotorOrWings(o)) {
    const lift = Math.max(o.liftR || 0, o.liftW ? o.liftW / 0.7 : 0);
    bars.push({ k: 'lift', name: 'עילוי', v: Math.min(1, lift / 2), txt: `×${lift.toFixed(1)}`, bad: lift < 1 });
  }
  return { ok: o.ok, name, abil, bars, warn, mass, L, cost: spec ? spec.cost : 0 };
}

const rotorOrWings = (o) => o.design.strokes.some((s) => s.part === 'rotor' || s.part === 'wing');
