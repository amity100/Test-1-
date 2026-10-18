import { clamp } from '../core/util.js';
import { shapeOf, specOf, inPoly, outline, spanAt } from './drawncar.js';
import { CLASSES, VEHICLE_GROUPS } from './sketchnet.js';
import { placeOf, roleOf } from './partrole.js';
import { rideCombos } from './combos.js';

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
const TYPE = { body: 'body', cabin: 'body', hull: 'body', wheel: 'wheel', barrel: 'gun', blade: 'blade', head: 'blade', wing: 'wing', rotor: 'rotor', prop: 'prop', jet: 'jet', fin: 'fin', mast: 'line', tail: 'line', skid: 'line', sail: 'sail', balloon: 'envelope', chute: 'chute', spring: 'spring', armor: 'armor', window: 'line', deco: 'line' };
// how much ink each part takes
const INK = { body: 0, cabin: 3, hull: 2, wheel: 1.5, barrel: 5, blade: 4, head: 4, wing: 6, rotor: 10, prop: 3, jet: 5, fin: 1, tail: 1, skid: 1, mast: 0.5, sail: 4, balloon: 10, chute: 6, spring: 5, armor: 4, window: 0.5, deco: 0.5, scope: 2, mag: 2, silencer: 2 };
// what moves it (one of them, at least, or it is a statue)
const MOVERS = new Set(['wheel', 'rotor', 'wing', 'prop', 'jet', 'sail', 'balloon', 'hull']);

// ------------------------------------------------------------------ the drawing, in metres
// P: game/parts.js readParts (a ride's); strokes: the drawing's ({ p, c }, page units); inks: the
// ink table (game/freeform.js INKS). Returns the design game/drawncar.js builds (polished) - or null.
// Its body is what its lines close round (P.R: however many lines drew it), the lines that drew it
// its edges; a plane drawn from above, the same plane from its side; a bike, its frame of tubes
// (ROADMAP 11.11, parts 2) what a barrel drawn in each ink fires (as game/handparts.js ELEMENT has
// it): red fire, orange a blast, yellow a shock, green glue, blue water, purple ink, pink bounces,
// white correction fluid, neon light
const INK_EL = [null, null, 'fire', 'blast', 'shock', 'glue', 'water', 'ink', 'bounce', 'tippex', 'light'];
const EL_NAME = { fire: 'אש', blast: 'נפץ', shock: 'חשמל', glue: 'דבק', water: 'מים', ink: 'דיו', bounce: 'קופצני', tippex: 'טיפקס', light: 'אור' };
// (what each barrel is called on the card: a flamethrower, a water cannon, a ray; a machine gun
// or a cannon of its ink)
const STREAM_NAME = { fire: 'להביור', water: 'תותח מים', light: 'לייזר' };
const gunName = (gn) => (gn.el && STREAM_NAME[gn.el] ? STREAM_NAME[gn.el] : gn.down && gn.type === 'cannon' ? `פצצות${gn.el ? ` ${EL_NAME[gn.el]}` : ''}` : `${gn.type === 'cannon' ? 'תותח' : 'מקלע'}${gn.el ? ` ${EL_NAME[gn.el]}` : ''}`);

function inkOf(inks, i) {
  const ink = inks[i] || inks[0];
  return { col: ink.c.slice(), pencil: !!ink.pencil, neon: !!ink.neon };
}

// (ROADMAP 11.15) look: 'faithful' - made as drawn (game/partbuild.js), what it does by how it was
// drawn (rideSpec); 'polished' (or none) - each part the game's own
export function rideDesign(P, strokes, inks, look = null) {
  const d = rideDesign0(P, strokes, inks, look);
  if (d && look) d.look = look;
  return d;
}

function rideDesign0(P, strokes, inks, look) {
  if (!P || P.frame !== 'ride' || !P.R) return null;
  if (P.drone) return droneDesign(P, inks);
  if (P.heliTop) return heliTopDesign(P, inks);
  if (P.top) return topDesign(P, inks);
  const B = P.R.sh;
  if (!(B.w > 0)) return null;
  const types = new Set([...P.parts.map((p) => p.type), ...(P.implicit || []).map((q) => q.type)]);
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
  // (ROADMAP 11.13: a rocket - by how tall it stands)
  if (P.rocket) L = clamp((B.h / P.k) * 3.4, 5, 14) * (B.w / Math.max(1e-6, B.h));
  // (a balloon: by its envelope - a balloon is ten metres tall or so)
  const env = P.family === 'balloon' ? P.st.find((o) => o.type === 'balloon') : null;
  // (ROADMAP 11.14: a car under it, on its wheels - by the car, as long as a car is drawn so)
  const onWheels = P.parts.filter((p) => p.type === 'wheel').length >= 2;
  if (env && !P.ship && !onWheels) L = clamp((env.sh.h / P.k) * 7, 6, 16) * (B.w / env.sh.h);
  // (ROADMAP 11.13: an airship - by its envelope's length, a big one; its gondola tall enough to
  // sit in)
  if (env && P.ship) {
    let mm = clamp((env.sh.w / P.k) * 9, 16, 34) / env.sh.w;
    if (!P.R.made) mm = Math.max(mm, 1.45 / Math.max(1e-3, B.h));
    L = B.w * Math.min(mm, 30 / env.sh.w);
  }
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
  // (ROADMAP 11.14: an aircraft drawn on a boat's hull - flat along its deck, narrower at its keel, a
  // boat the network sees in it: it floats too)
  let boat = P.family === 'boat';
  // (ROADMAP 11.15: on wheels, and the player said it sails too - a hull on wheels: it floats)
  const seaSaid = !!P.sea && P.family === 'ground';
  if (!boat && (((P.family === 'copter' || P.family === 'plane') && P.guess) || seaSaid) && main && main.sh.closed) {
    const qBoat = (P.guess || []).filter(([g]) => g === 'boat').reduce((a, [, q]) => a + q, 0);
    const wAt = (y) => {
      let lo = Infinity;
      let hi = -Infinity;
      const L0 = main.pts;
      for (let a = 0, b = L0.length - 1; a < L0.length; b = a++) {
        const [xa, ya] = L0[b];
        const [xb, yb] = L0[a];
        if ((ya <= y && yb >= y) || (yb <= y && ya >= y)) {
          const x = xa + (xb - xa) * (Math.abs(yb - ya) < 1e-9 ? 0.5 : (y - ya) / (yb - ya));
          lo = Math.min(lo, x);
          hi = Math.max(hi, x);
        }
      }
      return hi > lo ? hi - lo : 0;
    };
    const ms = main.sh;
    const keelK = wAt(ms.y0 + ms.h * 0.15) / Math.max(1e-6, wAt(ms.y0 + ms.h * 0.85));
    // (or plainly a hull, whatever the network sees: flat along its deck, right to its top, and far
    // narrower at its keel)
    if ((qBoat >= 0.4 && ms.w > ms.h * 2.2 && keelK < 0.93) || (qBoat >= 0.15 && ms.w > ms.h * 2.8 && keelK < 0.86 && wAt(ms.y0 + ms.h * 0.95) > ms.w * 0.75)) boat = true;
    // (said so: a hull's shape is enough - flat along its deck, narrower at its keel)
    if (seaSaid && ms.w > ms.h * 2.2 && keelK < 0.93 && wAt(ms.y0 + ms.h * 0.95) > ms.w * 0.7) boat = true;
  }
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
    out.push({ type: 'body', part: 'body', pts: M([[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1], [b.x0, b.y0]]), ...bodyInk, made: true, box: true });
  }
  const ol = P.R.loop || null;
  for (const o of P.st) {
    const ink = inkOf(inks, o.ink);
    let type = TYPE[o.type] || 'line';
    // (the lines that drew the body: its edges, the body itself now - a body, a cabin, a hull the
    // player named that is none of its outline: a part of its own, ROADMAP 11.12)
    const edge = P.R.loop && (o.type === 'body' || o.type === 'cabin' || o.type === 'hull') && onLoop(o.pts, P.R.loop, B.size * 0.06) >= 0.5;
    if (edge || o.type === 'frame') type = 'line';
    const s = { type, part: o.type, pts: M(o.pts), ...ink, src: o.i };
    if (edge) s.edge = true;
    if (o.type === 'hull' && !edge) s.hull = true;
    if (o.type === 'spring') s.coils = o.sh.coils;
    if (o.type === 'balloon' && P.ship) s.ship = true;
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
      let [base, muz] = away(a) > away(b) ? [b, a] : [a, b];
      // (ROADMAP 11.12: the body itself a barrel - drawn round it, as long as it is: a giant
      // cannon, firing out of its nose)
      if (ol && o.sh.long > B.w * 0.6 && onLoop(o.pts, ol, B.size * 0.06) >= 0.6 && onLoop(ol, o.pts, B.size * 0.06) >= 0.7) {
        s.whole = true;
        base = [B.x0 + B.w * 0.2, B.y0 + B.h * 0.55];
        muz = [B.x1 + B.w * 0.08, B.y0 + B.h * 0.55];
        s.r = clamp(B.h * m * 0.22, 0.14, 0.55);
      }
      s.base = [base[0] * m, base[1] * m];
      s.muz = [muz[0] * m, muz[1] * m];
      s.len = o.sh.long * m;
      // (drawn in colour: what it fires - ROADMAP 11.11)
      if (INK_EL[o.ink]) s.el = INK_EL[o.ink];
    }
    if (o.type === 'blade' || o.type === 'wing' || o.type === 'rotor' || o.type === 'chute') s.len = o.sh.long * m;
    // (ROADMAP 11.13) a plane's wing drawn hanging off its body: the wing as it is from above, as
    // drawn - its sweep, its taper, its tip (ROADMAP 11.15: as drawn, on anything)
    if (o.type === 'wing' && (P.family === 'plane' || look === 'faithful')) {
      const wp = wingPlan(o, B, m);
      if (wp) Object.assign(s, wp);
    }
    out.push(s);
  }
  // (ROADMAP 11.13) one wing hanging down off its body, one rising up off it, about the same place
  // along it: one wing seen from a little above - its near half and its far half - not two (a
  // biplane's are drawn edge on, one over the other)
  if (P.family === 'plane') {
    const lo = out.filter((s) => s.type === 'wing' && s.mount === 'low' && s.plan);
    const hi = out.filter((s) => s.type === 'wing' && s.mount === 'high' && s.plan);
    if (lo.length === 1 && hi.length === 1) {
      const zr = (s) => [Math.min(...s.pts.map((q) => q[0])), Math.max(...s.pts.map((q) => q[0]))];
      const [a0, a1] = zr(lo[0]);
      const [b0, b1] = zr(hi[0]);
      const over = Math.min(a1, b1) - Math.max(a0, b0);
      if (over > Math.min(a1 - a0, b1 - b0) * 0.5) {
        const [keep, drop] = lo[0].span >= hi[0].span ? [lo[0], hi[0]] : [hi[0], lo[0]];
        keep.span = Math.max(keep.span, drop.span);
        keep.mount = 'low';
        out.splice(out.indexOf(drop), 1);
      }
    }
  }
  // (an engine drawn on a wing, or under it: one under each wing)
  if (P.family === 'plane') {
    const wingO = P.st.filter((o) => o.type === 'wing');
    for (const s of out) {
      if (s.type !== 'jet' || s.src === undefined) continue;
      const o = P.st.find((q) => q.i === s.src);
      if (!o || !(o.sh.cy < B.cy)) continue;
      const on = wingO.find((w) => o.sh.cx > w.sh.x0 - w.sh.w * 0.15 && o.sh.cx < w.sh.x1 + w.sh.w * 0.15 && o.sh.y1 > w.sh.y0 - B.h * 0.4);
      if (on) s.wing = true;
    }
  }
  // (ROADMAP 11.13: the player said it flies, and nothing drawn lifts it - game/parts.js readParts:
  // a rotor about as wide as it is long, on a mast over its middle; a wing across its middle, low)
  // (over the top of all its body's lines - its outline may be one small piece of them)
  let topY = B.y1;
  for (const o of P.st) if (o.type === 'body' || o.type === 'hull' || o.type === 'cabin') topY = Math.max(topY, o.sh.y1);
  for (const q of P.implicit || []) {
    if (q.type === 'rotor') {
      const w = B.w * 0.9;
      const y = topY + B.h * 0.28;
      out.push({ type: 'rotor', part: 'rotor', pts: M([[B.cx - w / 2, y], [B.cx + w / 2, y]]), len: w * m, ...bodyInk, made: true, implicit: true });
    } else if (q.type === 'wing' && !P.top) {
      const c = B.w * 0.26;
      const y = B.y0 + B.h * 0.3;
      out.push({ type: 'wing', part: 'wing', pts: M([[B.cx - c / 2, y], [B.cx + c / 2, y]]), len: c * m, ...bodyInk, made: true, implicit: true });
    } else if (q.type === 'prop') {
      // (ROADMAP 11.14: a wing drawn on it, nothing to push it - a small propeller at its back, standing)
      const r = clamp(B.h * 0.42, 0.2 / m, 0.9 / m);
      out.push({ type: 'prop', part: 'prop', pts: M([[B.x0 - B.w * 0.02, B.cy - r], [B.x0 - B.w * 0.02, B.cy + r]]), ...bodyInk, made: true, implicit: true, push: true });
    } else if (q.type === 'jet') {
      // (a rocket's engine: its bell under its foot, pointing down)
      const w = B.w * 0.5;
      const y = B.y0 - B.h * 0.07;
      out.push({ type: 'jet', part: 'jet', pts: M([[B.cx - w * 0.3, B.y0], [B.cx + w * 0.3, B.y0], [B.cx + w / 2, y], [B.cx - w / 2, y], [B.cx - w * 0.3, B.y0]]), ...bodyInk, made: true, implicit: true });
    }
  }
  // (wheels in its wheel arches, drawn without: game/parts.js archesOf)
  for (const a of P.arches || []) {
    const pts = [];
    for (let k = 0; k <= 24; k++) pts.push([(a.x + Math.cos((k / 24) * Math.PI * 2) * a.r) * m, (a.y + Math.sin((k / 24) * Math.PI * 2) * a.r) * m]);
    out.push({ type: 'wheel', part: 'wheel', pts, ...bodyInk, neon: false, implicit: true });
  }
  // (ROADMAP 11.11) its nose: how much of its height its front end keeps - a wedge cuts through the
  // air, a flat front pushes it (rideSpec)
  let nose;
  if (P.R.loop && P.family === 'ground') {
    const fx = P.flip ? B.x0 : B.x1;
    let lo = Infinity;
    let hi = -Infinity;
    for (const [x, y] of P.R.loop) {
      if (Math.abs(x - fx) > B.w * 0.12) continue;
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    if (hi > lo) nose = Math.round(((hi - lo) / Math.max(1e-6, B.h)) * 100) / 100;
  }
  const kin = kinOf(P);
  // (ROADMAP 11.14: the network plainly sees something that is no ride in it - a house, a fish: what
  // it is called, flying)
  // (a ladder, a bridge - boxes and lines, as any body is: only when all but certain)
  const g0 = P.guess && P.guess[0];
  if (g0 && g0[1] >= (BOXY_THING.has(g0[2]) ? 0.85 : 0.6) && THING_NOUN[g0[2]] && !VEHICLE_GROUPS.has(g0[0]) && !((P.sure || 0) >= 0.75)) kin.thing = g0[2];
  // (a fire engine's ladder, its hose: it sprays water - unless drawn in an ink of its own)
  if (kin.cls === 'firetruck') for (const s of out) if (s.part === 'barrel' && !s.el) s.el = 'water';
  // (and where on the page each metre of it is - ui/freedraw.js shows its balance there, and the
  // engineer's changes: game/engineer.js)
  const page = { m, k: P.k, x0: P.x0, y1: P.y1, flip: !!P.flip, W: (P.x1 - P.x0) * P.k };
  return { color, strokes: out, polish: true, plane: P.family === 'plane' || undefined, copter: P.family === 'copter' || undefined, airship: P.ship || undefined, rocket: P.rocket ? true : undefined, asBoat: P.family === 'boat' || undefined, nose, ...kin, page };
}

// (ROADMAP 11.13) a wing drawn from the side, as most draw one - hanging down off the body (or up
// off its top), slanting back: the wing as it is from above. How far it reaches from the body's
// middle is how far out it goes (seen at a slant: a half again further); along the body, as drawn -
// its sweep, its taper, the shape of its tip. A flat line, a wing seen edge on, has no shape to
// give: null (the plane's own size of wing). { plan: [[z, x]...] (metres, x out from the body's
// middle), span (tip to tip), mount: 'low' | 'high' }
function wingPlan(o, B, m) {
  const sh = o.sh;
  const down = sh.cy < B.cy;
  const reach = down ? B.cy - sh.y0 : sh.y1 - B.cy;
  if (sh.h < sh.w * 0.3 || reach < B.h * 0.75) return null;
  // (its root: where it leaves the body's middle - or its own edge, when it starts lower down)
  const yr = down ? Math.min(B.cy, sh.y1) : Math.max(B.cy, sh.y0);
  const loop = sh.closed ? o.pts : o.pts.concat([o.pts[0]]);
  // (how far out: as far as it reaches for its body's height - drawn reaching down one and a half
  // times as far as the body is high, its span about as long as the plane)
  const Lm = B.w * m;
  const hs = Math.min(clamp((down ? yr - sh.y0 : sh.y1 - yr) / Math.max(1e-6, B.h), 0.6, 3) * 0.4 * Lm, Lm * 0.62);
  const far = Math.max(1e-6, down ? yr - sh.y0 : sh.y1 - yr);
  const plan = loop.map(([x, y]) => [x * m, (Math.max(0, down ? yr - y : y - yr) / far) * hs]);
  if (!(hs > 0.5)) return null;
  return { plan, span: clamp(hs * 2, 2.2, 24), mount: down ? 'low' : 'high' };
}

// how much of a line lies along an outline (within tol of it)
function onLoop(pts, loop, tol) {
  let n = 0;
  for (const [x, y] of pts) {
    let best = Infinity;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const [ax, ay] = loop[j];
      const [bx, by] = loop[i];
      const dx = bx - ax;
      const dy = by - ay;
      const l2 = dx * dx + dy * dy;
      const t = l2 > 1e-12 ? clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1) : 0;
      const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
      if (d < best) best = d;
    }
    if (best <= tol) n++;
  }
  return n / Math.max(1, pts.length);
}

// where the page's point (x, y) is in a design's metres - and back (design.page)
export function toDesign(page, [x, y]) {
  const fx = page.flip ? page.W - (x - page.x0) * page.k : (x - page.x0) * page.k;
  return [fx * page.m, (page.y1 - y) * page.k * page.m];
}
export function toPage(page, [x, y]) {
  const fx = x / page.m;
  return [(page.flip ? page.W - fx : fx) / page.k + page.x0, page.y1 - y / page.m / page.k];
}

// (ROADMAP 11.11) what the network sees in it (game/parts.js readParts' guess), of the kinds its
// build can be: a motorbike, a bus, a tractor - its name by it (summary()); a submarine - it dives
// (game/drawncar.js specOf: only when the network is sure, as it changes how it goes)
const KIN_GROUPS = { ground: ['car', 'truck', 'bus', 'moto', 'bicycle', 'tractor', 'tank', 'skate'], boat: ['boat'] };
// (a kind with something of its own to show - lights on its roof, a ladder: only when the network
// is sure of it, a police car surer still - a plain car is so like one; else the plain one of its
// group)
const PLAIN = { 'police car': ['car', 0.7], ambulance: ['car', 0.55], firetruck: ['truck', 0.55] };
function kinOf(P) {
  const want = KIN_GROUPS[P.family];
  if (!want || !P.guess) return {};
  // (ROADMAP 11.14: a bike's own is a frame of lines between its wheels - a body drawn closed over
  // them is no bike's, whatever the network sees)
  const framed = P.parts.some((q) => q.type === 'frame');
  const fits = (grp) => want.includes(grp) && (framed || (grp !== 'bicycle' && grp !== 'moto'));
  let g = P.guess.find(([grp]) => fits(grp));
  // (ROADMAP 11.14: a car or something else of the road, the network all but undecided - a car)
  const g2 = g && P.guess.find(([grp]) => fits(grp) && grp !== g[0]);
  if (g && g2 && g2[0] === 'car' && g[1] - g2[1] < 0.08) g = g2;
  if (!g || !(g[1] >= (P.family === 'boat' ? 0.5 : 0.2))) return {};
  let cls = g[2];
  if (PLAIN[cls] && !(P.prob && P.prob[CLASSES.indexOf(cls)] >= PLAIN[cls][1])) cls = PLAIN[cls][0];
  return { group: g[0], cls };
}

// (ROADMAP 11.13) a plane drawn from above: built as drawn from above - its body as wide as drawn all
// along it (and as deep: round), its wings and its tailplane each the shape drawn, its engines where
// they were drawn on them, its propellers; its fin, which no one sees from above, as tall as its
// tailplane is wide. For what it can do, the same plane from its side (rideSpec reads that): its
// lines' plan (game/partbuild.js builds by it) - the wings' and the tailplane's shape from above
// ([[z, x]...], metres: z from its tail forward, x out from its middle), each engine's and
// propeller's place out along its wing (lat)
// (ROADMAP 11.13) a wing from above drawn as one line - plan: [[z, x]...], x out from its root -
// with no depth to it: as deep as c0 at its root, narrower out to its tip, the line along its
// middle (its front to +z); one drawn with its depth: as it is
function deepen(plan, c0) {
  const reach = Math.max(...plan.map((q) => q[1]));
  // (its area: a line, however it slants back, has none)
  let area = 0;
  for (let i = 0, j = plan.length - 1; i < plan.length; j = i++) area += plan[j][0] * plan[i][1] - plan[i][0] * plan[j][1];
  if (Math.abs(area) / 2 >= reach * c0 * 0.3 || !(reach > 0)) return plan;
  const n = 8;
  const mid = [];
  for (let i = 0; i <= n; i++) {
    const x = (reach * i) / n;
    let q = plan[0];
    for (const p of plan) if (Math.abs(p[1] - x) < Math.abs(q[1] - x)) q = p;
    mid.push([q[0], x, c0 * (1 - 0.45 * (i / n))]);
  }
  const lead = mid.map(([z, x, c]) => [z + c * 0.4, x]);
  const trail = mid.slice().reverse().map(([z, x, c]) => [z - c * 0.6, x]);
  const out = lead.concat(trail);
  out.push(out[0].slice());
  return out;
}

function topDesign(P, inks) {
  const T = P.top;
  const UV = ([x, y]) => [(x - T.cx) * T.ux + (y - T.cy) * T.uy, -(x - T.cx) * T.uy + (y - T.cy) * T.ux];
  let u0 = Infinity;
  let u1 = -Infinity;
  // (ROADMAP 11.14: how long the plane is - a gun out past its nose, a spring past its tail no part of
  // that: out past it, where drawn)
  const own = P.st.filter((o) => o.type !== 'barrel' && o.type !== 'spring');
  for (const o of own.length ? own : P.st) {
    for (const p of o.pts) {
      const u = UV(p)[0];
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
    }
  }
  const len = Math.max(1e-6, u1 - u0);
  const L = clamp((len / P.k) * 3.4, 4.5, 16);
  const k = L / len;
  const Zof = (u) => (T.nose > 0 ? u - u0 : u1 - u) * k;
  const main = P.st.find((o) => o.i === P.body) || P.st[0];
  const bodyInk = inkOf(inks, main.ink);
  // ---- its body from above: how wide each way, all along it (its body's lines - where its wings
  // are drawn in the same line, no wider than the rest of it)
  const NB = 24;
  const hw = new Array(NB + 1).fill(0);
  const hwMax = clamp((T.fw * k) / 2, 0.2, 1.4) * 1.35;
  // (across it at each place along it: from one side of its body to the other - half that; where
  // only one side was drawn there, nothing yet)
  const vlo = new Array(NB + 1).fill(Infinity);
  const vhi = new Array(NB + 1).fill(-Infinity);
  for (const o of P.st.filter((q) => q.type === 'body')) {
    for (const p of o.pts) {
      const [u, v] = UV(p);
      const i = clamp(Math.round((Zof(u) / L) * NB), 0, NB);
      vlo[i] = Math.min(vlo[i], v);
      vhi[i] = Math.max(vhi[i], v);
    }
  }
  for (let i = 0; i <= NB; i++) if (vhi[i] - vlo[i] > T.fw * 0.25) hw[i] = Math.min(((vhi[i] - vlo[i]) / 2) * k, hwMax);
  // (ROADMAP 11.13: its body one line, no width drawn to it - a plane's body, as wide as a plane's)
  if (!hw.some((v) => v > 0)) hw.fill(hwMax / 1.35);
  // (what no line was drawn across: between its neighbours; its two ends closing)
  for (let i = 0; i <= NB; i++) {
    if (hw[i] > 0) continue;
    let a = i - 1;
    while (a >= 0 && !(hw[a] > 0)) a--;
    let b = i + 1;
    while (b <= NB && !(hw[b] > 0)) b++;
    const va = a >= 0 ? hw[a] : 0;
    const vb = b <= NB ? hw[b] : 0;
    hw[i] = a >= 0 && b <= NB ? va + ((vb - va) * (i - a)) / (b - a) : Math.max(va, vb) * 0.6;
  }
  // (a hand's wobble smoothed away - its nose, its waist, its tail kept)
  let sm = hw.slice();
  for (let pass = 0; pass < 2; pass++) sm = sm.map((v, i) => [-2, -1, 0, 1, 2].reduce((a, d, j) => a + sm[clamp(i + d, 0, NB)] * [1, 2, 3, 2, 1][j], 0) / 9);
  const hwAt = (z) => {
    const f = clamp((z / L) * NB, 0, NB);
    const i = Math.min(NB - 1, Math.floor(f));
    const v = sm[i] + (sm[i + 1] - sm[i]) * (f - i);
    // (its nose round, its tail a cone: closed at both ends)
    const t = z / L;
    return Math.max(0.03, v * Math.min(1, Math.sqrt(Math.max(0, 1 - t) * 14), Math.sqrt(t * 22)));
  };
  const hMax = Math.max(...sm, 0.25);
  const c = hMax + 0.2;
  const yc = (z) => c + (z < L * 0.3 ? ((L * 0.3 - z) / (L * 0.3)) * hMax * 0.55 : 0);
  // its body from the side: as deep as it is wide (a tail that rises)
  const body = [];
  for (let i = 0; i <= 24; i++) {
    const z = (i / 24) * L;
    body.push([z, yc(z) + hwAt(z) * 0.95]);
  }
  for (let i = 24; i >= 0; i--) {
    const z = (i / 24) * L;
    body.push([z, yc(z) - hwAt(z) * 0.95]);
  }
  const out = [{ type: 'body', part: 'body', pts: body, ...bodyInk, made: true }];
  // ---- its wings and its tailplane: each side's shape as drawn (the side drawn bigger, if both)
  const half = (type) => {
    const S = P.st.filter((o) => o.type === type);
    // (a line drawn across it both ways is on either side: one side's)
    const sides = [1, -1].map((sg) => S.filter((o) => (o.pts.reduce((a, p) => a + UV(p)[1], 0) + 1e-9) * sg > 0));
    // (a straight line has no area: by its length, then)
    const area = (L2) => L2.reduce((a, o) => a + o.sh.w * o.sh.h + o.sh.len * 1e-4, 0);
    const use = area(sides[0]) >= area(sides[1]) ? sides[0] : sides[1];
    // (ROADMAP 11.13: a wing drawn as one line, a tailplane - no depth to it: as deep as one is)
    const c0 = type === 'wing' ? clamp(T.chord * k, L * 0.14, L * 0.3) : L * 0.1;
    return use.map((o) => {
      const plan = deepen((o.sh.closed ? o.pts : o.pts.concat([o.pts[0]])).map((p) => {
        const [u, v] = UV(p);
        return [Zof(u), Math.abs(v) * k];
      }), c0);
      // (ROADMAP 11.13: drawn off its side, not touching it - it is on it: its root at its body)
      const zm = plan.reduce((a, q) => a + q[0], 0) / plan.length;
      const root = Math.min(...plan.map((q) => q[1]));
      const at = hwAt(zm) * 0.9;
      return { o, plan: root > at * 1.25 + 0.15 ? plan.map(([z, v]) => [z, v - (root - at)]) : plan };
    });
  };
  const wingC = (plan) => {
    const zs = plan.map((q) => q[0]);
    return [Math.min(...zs), Math.max(...zs)];
  };
  // (ROADMAP 11.13) its wings and its tailplane drawn in the same line as its body - as most draw a
  // plane: what reaches out of its body, along it, is them - each one's shape from above as drawn
  // (how far out the line goes at each place along it, the side drawn bigger)
  const NL = 48;
  const edge2 = [new Array(NL + 1).fill(0), new Array(NL + 1).fill(0)];
  for (const o of P.st.filter((q) => q.type === 'body')) {
    for (let a = 1; a < o.pts.length; a++) {
      const [ua, va] = UV(o.pts[a - 1]);
      const [ub, vb] = UV(o.pts[a]);
      const n = Math.ceil((Math.abs(Zof(ub) - Zof(ua)) / (L / NL)) * 2) + 1;
      for (let q = 0; q <= n; q++) {
        const u = ua + ((ub - ua) * q) / n;
        const v = va + ((vb - va) * q) / n;
        const i = clamp(Math.round((Zof(u) / L) * NL), 0, NL);
        const sd = v > 0 ? 0 : 1;
        edge2[sd][i] = Math.max(edge2[sd][i], Math.abs(v) * k);
      }
    }
  }
  const edge = edge2[0].reduce((x, y) => x + y, 0) >= edge2[1].reduce((x, y) => x + y, 0) ? edge2[0] : edge2[1];
  const fuse = hwMax / 1.35;
  const lobes = [];
  for (let i = 0; i <= NL; ) {
    if (!(edge[i] > fuse * 1.5 + 0.15)) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 <= NL && edge[j + 1] > fuse * 1.5 + 0.15) j++;
    if (j > i) {
      const zq = (q) => (q / NL) * L;
      const plan = [[zq(i) - L / NL / 2, fuse * 0.9]];
      for (let q = i; q <= j; q++) plan.push([zq(q), edge[q]]);
      plan.push([zq(j) + L / NL / 2, fuse * 0.9]);
      plan.push(plan[0].slice());
      let a = 0;
      for (let q = i; q <= j; q++) a += edge[q] - fuse;
      lobes.push({ plan, reach: Math.max(...edge.slice(i, j + 1)), a, z0: zq(i), z1: zq(j) });
    }
    i = j + 1;
  }
  const mainLobe = lobes.reduce((b, l) => (!b || l.a > b.a ? l : b), null);
  if (!P.st.some((o) => o.type === 'wing') && mainLobe) {
    for (const l of lobes) {
      if (l !== mainLobe && l.z1 < mainLobe.z0) continue;
      out.push({ type: 'wing', part: 'wing', pts: [[l.z0, c], [l.z1, c]], span: clamp(l.reach * 2, 2.2, 26), plan: l.plan, mount: 'low', ...bodyInk, made: true });
    }
  }
  const tailLobes = !P.st.some((o) => o.type === 'fin') && mainLobe ? lobes.filter((l) => l !== mainLobe && l.z1 < mainLobe.z0) : [];
  for (const { o, plan } of half('wing')) {
    // (its chord where it leaves the body)
    const root = plan.filter((q) => q[1] < hwMax * 1.6 + 0.3);
    const [za, zb] = wingC(root.length >= 2 ? root : plan);
    const reach = Math.max(...plan.map((q) => q[1]));
    out.push({ type: 'wing', part: 'wing', pts: [[za, c], [zb, c]], span: clamp(reach * 2, 2.2, 26), plan, mount: 'low', ...inkOf(inks, o.ink), made: true });
  }
  let tailReach = 0;
  let tailRoot = null;
  for (const { o, plan } of [...half('fin'), ...tailLobes.map((l) => ({ o: main, plan: l.plan }))]) {
    const reach = Math.max(...plan.map((q) => q[1]));
    tailReach = Math.max(tailReach, reach);
    const [za, zb] = wingC(plan);
    tailRoot = tailRoot ? [Math.min(tailRoot[0], za), Math.max(tailRoot[1], zb)] : [za, zb];
    out.push({ type: 'fin', part: 'fin', pts: [[za, c + hMax * 0.2], [zb, c + hMax * 0.2]], plan, flat: true, ...inkOf(inks, o.ink), made: true });
  }
  // (its fin: up over its tail, as tall as its tailplane is wide - swept back)
  const finS = P.st.find((o) => o.type === 'fin');
  const finInk = finS ? inkOf(inks, finS.ink) : bodyInk;
  const fz0 = tailRoot ? Math.max(0.05, tailRoot[0]) : 0.1;
  const fc = tailRoot ? clamp(tailRoot[1] - tailRoot[0], L * 0.08, L * 0.22) : L * 0.14;
  const fh = clamp(tailReach ? tailReach * 0.85 : hMax * 3, 0.55, 3.2);
  const fy = yc(fz0 + fc / 2) + hwAt(fz0 + fc / 2) * 0.8;
  out.push({ type: 'fin', part: 'fin', pts: [[fz0, fy], [fz0 + fc * 0.55, fy + fh], [fz0 + fc * 0.95, fy + fh], [fz0 + fc * 1.15, fy], [fz0, fy]], ...finInk, made: true });
  // ---- its engines, where they were drawn (each one: its own side - its place out along the wing)
  for (const o of P.st.filter((q) => q.type === 'jet')) {
    let cu = 0;
    let cv = 0;
    for (const p of o.pts) {
      const [u, v] = UV(p);
      cu += u;
      cv += v;
    }
    cu /= o.pts.length;
    cv /= o.pts.length;
    const z = Zof(cu);
    const r = clamp((Math.min(o.sh.w, o.sh.h) * k) / 2, 0.22, 0.75);
    const ln = clamp(Math.max(o.sh.w, o.sh.h) * k, r * 2.2, r * 5);
    const lat = cv * k;
    const y = c - hMax * 0.55 - r * 0.6;
    const pts = [];
    for (let q = 0; q <= 12; q++) pts.push([z + (Math.cos((q / 12) * Math.PI * 2) * ln) / 2, y + Math.sin((q / 12) * Math.PI * 2) * r]);
    out.push({ type: 'jet', part: 'jet', pts, lat, ...inkOf(inks, o.ink), made: true });
  }
  // ---- its propellers: at its nose, or out on its wings, where drawn
  for (const o of P.st.filter((q) => q.type === 'prop')) {
    let cu = 0;
    let cv = 0;
    for (const p of o.pts) {
      const [u, v] = UV(p);
      cu += u;
      cv += v;
    }
    cu /= o.pts.length;
    cv /= o.pts.length;
    const z = Math.max(Zof(cu), L - 0.05);
    const lat = Math.abs(cv * k) > hMax * 1.5 ? cv * k : 0;
    const r = clamp((Math.max(o.sh.w, o.sh.h) * k) / 2, 0.45, 1.6);
    out.push({ type: 'prop', part: 'prop', pts: [[z + 0.05, c - r], [z + 0.05, c + r]], lat, ...bodyInk, made: true });
  }
  // ---- (ROADMAP 11.14) its guns: along it out of its nose (its tail) as far as drawn - on its
  // middle, level
  for (const o of P.st.filter((q) => q.type === 'barrel')) {
    let a = Infinity;
    let b = -Infinity;
    let cv = 0;
    for (const p of o.pts) {
      const [u, v] = UV(p);
      a = Math.min(a, Zof(u));
      b = Math.max(b, Zof(u));
      cv += v;
    }
    cv /= o.pts.length;
    const back = (a + b) / 2 < L / 2;
    const [zb, zm] = back ? [Math.min(b, L * 0.18), Math.min(a, -0.3)] : [Math.max(a, L * 0.82), Math.max(b, L + 0.3)];
    const y = yc(back ? 0 : L);
    const r = o.sh.closed || o.sh.endGap < o.sh.long * 0.35 ? clamp((o.sh.thick * k) / 2, 0.04, 0.3) : 0.045;
    const lat = Math.abs(cv * k) > hMax * 1.2 ? cv * k : 0;
    out.push({ type: 'gun', part: 'barrel', pts: [[zb, y], [zm, y]], base: [zb, y], muz: [zm, y], len: Math.abs(zm - zb), r, lat, ...inkOf(inks, o.ink), src: o.i });
  }
  // ---- its springs: past its tail (its nose), out of its end along it - one drawn on it, under it
  // (game/partrole.js: at its back it kicks it on, at its front a bumper, under it it jumps)
  for (const o of P.st.filter((q) => q.type === 'spring')) {
    let a = Infinity;
    let b = -Infinity;
    for (const p of o.pts) {
      const z = Zof(UV(p)[0]);
      a = Math.min(a, z);
      b = Math.max(b, z);
    }
    const n = clamp(o.sh.coils || 4, 3, 10);
    const pts = [];
    if (b < L * 0.1 || a > L * 0.9) {
      const back = b < L * 0.1;
      const z0 = back ? 0 : L;
      const ln = clamp(Math.abs(back ? -a : b - L), 0.6, 2.2);
      for (let q = 0; q <= n * 2; q++) pts.push([z0 + (back ? -1 : 1) * (q / (n * 2)) * ln, yc(z0) + (q % 2 ? 0.16 : -0.16)]);
    } else {
      const zm = (a + b) / 2;
      const yb = yc(zm) - hwAt(zm) * 0.95;
      for (let q = 0; q <= n * 2; q++) pts.push([zm + (q % 2 ? 0.18 : -0.18), yb - (q / (n * 2)) * 0.9]);
    }
    out.push({ type: 'spring', part: 'spring', pts, coils: n, ...inkOf(inks, o.ink), src: o.i });
  }
  const color = bodyInk.pencil ? [0.95, 0.93, 0.88] : bodyInk.col.slice();
  const hwPlan = [];
  for (let i = 0; i <= 48; i++) hwPlan.push([(i / 48) * L, hwAt((i / 48) * L)]);
  return { color, strokes: out, polish: true, above: true, plane: true, plan: { hw: hwPlan }, dart: T.dart };
}

// (ROADMAP 11.13) a helicopter drawn from above: its body as long and as wide as drawn, from the
// side a rounded cabin with its glass nose; its rotor over it as big as the blades were drawn, on
// its mast where they cross; its tail boom out to where it was drawn, the small rotor at its end if
// one was drawn there; skids under it
function heliTopDesign(P, inks) {
  const T = P.heliTop;
  const main = P.st.find((o) => o.i === P.body) || P.st[0];
  const ink0 = inkOf(inks, main.ink);
  const along = ([x, y]) => (x - T.tailEnd[0]) * T.ux + (y - T.tailEnd[1]) * T.uy;
  const across = ([x, y]) => -(x - T.hub[0]) * T.uy + (y - T.hub[1]) * T.ux;
  let a0 = Infinity;
  let a1 = -Infinity;
  for (const p of main.pts) {
    a0 = Math.min(a0, along(p));
    a1 = Math.max(a1, along(p));
  }
  const bl0 = Math.max(1e-3, a1 - a0);
  // (its cabin a helicopter's, as long as it was drawn big)
  const Lb = clamp((bl0 / P.k) * 3.4, 3, 12);
  const k = Lb / bl0;
  const zb0 = a0 * k;
  const zb1 = a1 * k;
  // (from above: how wide, all along it)
  const NB = 16;
  const lo = new Array(NB + 1).fill(Infinity);
  const hi = new Array(NB + 1).fill(-Infinity);
  for (const p of main.pts) {
    const i = clamp(Math.round(((along(p) - a0) / bl0) * NB), 0, NB);
    lo[i] = Math.min(lo[i], across(p) * k);
    hi[i] = Math.max(hi[i], across(p) * k);
  }
  const hw = lo.map((l, i) => (hi[i] > l ? (hi[i] - l) / 2 : 0));
  const wMax = Math.max(0.4, ...hw);
  for (let i = 0; i <= NB; i++) {
    if (hw[i] > wMax * 0.15) continue;
    let a = i - 1;
    while (a >= 0 && !(hw[a] > wMax * 0.15)) a--;
    let b = i + 1;
    while (b <= NB && !(hw[b] > wMax * 0.15)) b++;
    hw[i] = a >= 0 && b <= NB ? hw[a] + ((hw[b] - hw[a]) * (i - a)) / (b - a) : Math.max(0.05, (a >= 0 ? hw[a] : hw[b]) * 0.5);
  }
  const plan = hw.map((h, i) => [zb0 + (i / NB) * (zb1 - zb0), clamp(h, 0.05, 1.6)]);
  // its cabin from the side: rounded, its bottom rising into its tail
  const hb = clamp(wMax * 2.3, 1.1, 2.6);
  const yb = 0.55;
  const body = [];
  for (let q = 0; q <= 32; q++) {
    const t = (q / 32) * Math.PI * 2;
    const c = Math.cos(t);
    const sn = Math.sin(t);
    const z = (zb0 + zb1) / 2 + ((zb1 - zb0) / 2) * Math.sign(c) * Math.abs(c) ** (2 / 2.4);
    let y = yb + hb / 2 + (hb / 2) * Math.sign(sn) * Math.abs(sn) ** (2 / 2.4);
    const u = (z - zb0) / Math.max(1e-6, zb1 - zb0);
    if (sn < 0 && u < 0.35) y += ((0.35 - u) / 0.35) * hb * 0.32;
    body.push([z, y]);
  }
  const out = [{ type: 'body', part: 'body', pts: body, ...ink0, made: true }];
  // its rotor where the blades cross, as wide as they were drawn
  const zh = along(T.hub) * k;
  const R = Math.max(1, T.R * k);
  const rotO = P.st.filter((o) => o.type === 'rotor');
  out.push({ type: 'rotor', part: 'rotor', pts: [[zh - R, yb + hb + 0.4], [zh + R, yb + hb + 0.4]], len: R * 2, ...inkOf(inks, rotO.length ? rotO[0].ink : main.ink), made: true });
  // its tail boom out to its end; its tail rotor there, standing
  const yt = yb + hb * 0.6;
  const tailO = P.st.find((o) => o.type === 'tail');
  out.push({ type: 'line', part: 'tail', pts: [[zb0 + (zb1 - zb0) * 0.2, yt], [0.05, yt + 0.12]], ...inkOf(inks, tailO ? tailO.ink : main.ink), made: true });
  if (T.tr) {
    const r = clamp(T.tr * k, 0.3, 1.1);
    out.push({ type: 'prop', part: 'prop', pts: [[0.12, yt + 0.12 - r], [0.12, yt + 0.12 + r]], ...ink0, made: true });
  }
  out.push({ type: 'line', part: 'skid', pts: [[zb0 + (zb1 - zb0) * 0.08, 0.06], [zb1 - (zb1 - zb0) * 0.04, 0.06]], ...ink0, made: true });
  const color = ink0.pencil ? [0.85, 0.22, 0.2] : ink0.col.slice();
  return { color, strokes: out, polish: true, above: true, copter: true, plan: { hw: plan } };
}

// (ROADMAP 11.13) a drone drawn from above: its body in the middle, each rotor where it was drawn -
// out on its arms, as big as drawn, in the guard drawn round it. From the side it is flat: its
// rotors level, a little over its arms; short legs under it to stand on
function droneDesign(P, inks) {
  const Dr = P.drone;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const r of Dr.rotors) {
    x0 = Math.min(x0, r.cx - r.r);
    x1 = Math.max(x1, r.cx + r.r);
    y0 = Math.min(y0, r.cy - r.r);
    y1 = Math.max(y1, r.cy + r.r);
  }
  const spanF = Math.max(1e-3, x1 - x0, y1 - y0);
  // (one that carries someone: a few metres across, as big as it was drawn)
  const S = clamp((spanF / P.k) * 3.4, 4.4, 10);
  const k = S / spanF;
  const z0 = S * 0.5 + 0.2;
  // (up the page: its front; across it, its left +)
  const ZA = (y) => (y - Dr.cy) * k + z0;
  const LAT = (x) => -(x - Dr.cx) * k;
  const main = P.st.find((o) => o.i === Dr.body) || null;
  const rotO = P.st.filter((o) => o.type === 'rotor');
  const ink0 = inkOf(inks, (main || rotO[0] || P.st[0]).ink);
  // ---- its body: as long and as wide as drawn (a hub, if none was)
  const B = P.R.sh;
  const bz0 = ZA(B.y0);
  const bz1 = ZA(B.y1);
  const bw = Math.max(0.3, B.w * k);
  const bl = Math.max(0.3, bz1 - bz0);
  const hb = clamp(Math.min(bw, bl) * 0.42, 0.32, 1.05);
  const legH = clamp(S * 0.075, 0.3, 0.62);
  const yb = legH;
  const round = !!(main && main.sh.round);
  const n = round ? 2.4 : 4;
  const body = [];
  for (let q = 0; q <= 32; q++) {
    const t = (q / 32) * Math.PI * 2;
    const c = Math.cos(t);
    const sn = Math.sin(t);
    body.push([(bz0 + bz1) / 2 + (bl / 2) * Math.sign(c) * Math.abs(c) ** (2 / n), yb + hb / 2 + (hb / 2) * Math.sign(sn) * Math.abs(sn) ** (2 / n)]);
  }
  // (from above: its width at each place along it, from its drawn line)
  const NB = 16;
  const lo = new Array(NB + 1).fill(Infinity);
  const hi = new Array(NB + 1).fill(-Infinity);
  if (main) {
    for (const [x, y] of main.pts) {
      const i = clamp(Math.round(((ZA(y) - bz0) / bl) * NB), 0, NB);
      lo[i] = Math.min(lo[i], LAT(x));
      hi[i] = Math.max(hi[i], LAT(x));
    }
  }
  const hw = [];
  for (let i = 0; i <= NB; i++) hw.push(hi[i] > lo[i] ? (hi[i] - lo[i]) / 2 : 0);
  for (let i = 0; i <= NB; i++) {
    if (hw[i] > bw * 0.12) continue;
    let a = i - 1;
    while (a >= 0 && !(hw[a] > bw * 0.12)) a--;
    let b = i + 1;
    while (b <= NB && !(hw[b] > bw * 0.12)) b++;
    hw[i] = a >= 0 && b <= NB ? hw[a] + ((hw[b] - hw[a]) * (i - a)) / (b - a) : a >= 0 ? hw[a] : b <= NB ? hw[b] : bw / 2;
  }
  const plan = [];
  for (let i = 0; i <= NB; i++) plan.push([bz0 + (i / NB) * bl, clamp(hw[i], 0.05, bw / 2)]);
  const out = [{ type: 'body', part: 'body', pts: body, ...ink0, made: true }];
  // ---- its rotors: each out where it was drawn, level a little over its body
  const yr = yb + hb + 0.32;
  for (const r of Dr.rotors) {
    const o = P.st.find((q) => q.i === r.i);
    const R = Math.max(0.3, r.r * k);
    const z = ZA(r.cy);
    out.push({ type: 'rotor', part: 'rotor', pts: [[z - R, yr], [z + R, yr]], len: R * 2, lat: LAT(r.cx), guard: true, ...inkOf(inks, o ? o.ink : 0), src: r.i, made: true });
  }
  // (what was drawn in a rotor's ring - its blades: that rotor; the arms out to them: the game's)
  for (const o of P.st) {
    if (o.type === 'barrel') {
      const zs = o.pts.map(([, y]) => ZA(y));
      const za = Math.min(...zs);
      const zb = Math.max(...zs);
      const lat = LAT(o.sh.cx);
      out.push({ type: 'gun', part: 'barrel', pts: [[za, yb + hb * 0.35], [zb, yb + hb * 0.35]], base: [za, yb + hb * 0.35], muz: [zb, yb + hb * 0.35], len: zb - za, r: 0.06, lat, ...inkOf(inks, o.ink), src: o.i });
    } else if (o.type === 'window') {
      // (a window, a light drawn on it - a camera dome under its front, from above)
      const sh = o.sh;
      const z = ZA(sh.cy);
      const r = clamp((Math.min(sh.w, sh.h) * k) / 2, 0.1, 0.5);
      const pts = [];
      for (let q = 0; q <= 12; q++) pts.push([z + Math.cos((q / 12) * Math.PI * 2) * r, yb + hb + Math.sin((q / 12) * Math.PI * 2) * r * 0.5]);
      out.push({ type: 'line', part: 'window', pts, lat: LAT(sh.cx), ...inkOf(inks, o.ink), src: o.i });
    }
  }
  // (its legs: two skids under it, to stand on)
  out.push({ type: 'line', part: 'skid', pts: [[bz0 + bl * 0.08, 0.06], [bz1 - bl * 0.08, 0.06]], ...ink0, made: true });
  const color = ink0.pencil ? [0.22, 0.24, 0.27] : ink0.col.slice();
  return { color, strokes: out, polish: true, above: true, copter: true, drone: { n: Dr.rotors.length, round }, plan: { hw: plan } };
}

// ------------------------------------------------------------------ what it can do: the parts added up
// design: rideDesign's (or a saved one). Returns game/drawncar.js specOf's spec, its numbers the
// parts', and sum: what the card by the drawing shows (ui/freedraw.js)
export function rideSpec(design) {
  const S = design.strokes;
  const partOf = (s) => s.part || legacy(s);
  // (the lines that drew its body are the body: no part of their own)
  const of = (t) => S.filter((s) => !s.edge && partOf(s) === t);
  const bodies = S.filter((s) => s.type === 'body');
  // ---- its size, and the middle of its body
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  let area = 0;
  let bx = 0;
  let by = 0;
  for (const s of bodies) {
    const sh = shapeOf(s.pts);
    x0 = Math.min(x0, sh.x0);
    x1 = Math.max(x1, sh.x1);
    y0 = Math.min(y0, sh.y0);
    y1 = Math.max(y1, sh.y1);
    const a = sh.area || sh.w * sh.h * 0.7;
    const c = centroid(s.pts) || [sh.mx, sh.my];
    area += a;
    bx += c[0] * a;
    by += c[1] * a;
  }
  const L = x1 - x0;
  const H = y1 - y0;
  if (!bodies.length || !(L > 0)) return { ok: false, why: 'חסר גוף: צורה סגורה גדולה', sum: null };
  bx /= Math.max(1e-9, area);
  by /= Math.max(1e-9, area);
  // ---- (ROADMAP 11.12) each part: what it is, where it is (game/partrole.js) - its wheels first,
  // what the rest goes by (on wheels or not)
  const box = { x0, x1, y0, y1 };
  const role = new Map();
  const see = (s, ctx) => {
    const q = placeOf(s.pts, box);
    const r = roleOf(partOf(s), q, ctx);
    role.set(s, { v: r.v, name: r.name, say: r.say, q });
  };
  const vOf = (s) => (role.has(s) ? role.get(s).v : null);
  const fam = bodies.some((s) => s.hull) ? 'boat' : design.plane ? 'plane' : design.copter ? 'copter' : design.airship ? 'balloon' : 'ground';
  const wheelS = of('wheel');
  for (const s of wheelS) see(s, { fam });
  const rollS = wheelS.filter((s) => vOf(s) === 'wheel' || vOf(s) === 'square' || vOf(s) === 'big');
  const trackS = wheelS.filter((s) => vOf(s) === 'track');
  const roofS = wheelS.filter((s) => vOf(s) === 'roof');
  const ctx = { fam, wheels: rollS.length + trackS.length > 0, thrust: of('jet').length + of('prop').length > 0, wings: of('wing').length > 0, guns: of('barrel').length > 0, sail: of('sail').length > 0, rocket: !!design.rocket };
  for (const s of S) if (!s.edge && s.type !== 'body' && !role.has(s)) see(s, ctx);
  // (a plane drawn from above: its wings, its engines on them, as made - game/partsum.js topDesign;
  // ROADMAP 11.13: a wing drawn hanging off its body, made the wing it is from above - wingPlan)
  // (a rocket's engine added in its foot: where it is says what it does - down, it lifts)
  for (const s of S) if (s.made && !(s.implicit && s.part === 'jet') && role.has(s) && (s.part === 'wing' || s.part === 'jet')) role.get(s).v = s.part;
  for (const s of S) if (s.plan && s.part === 'wing' && role.has(s) && role.get(s).v !== 'wing') Object.assign(role.get(s), { v: 'wing', name: 'כנף', say: ctx.thrust ? 'מרימה: טס כשיש מספיק מהירות' : 'מרימה: יש לו מנוע קטן בפנים — מדחף או סילון יוסיפו מהירות' });
  // (ROADMAP 11.13: the rotor the game adds where nothing drawn lifts it - two, one over the other,
  // over it: they lift it)
  for (const s of S) if (s.implicit && s.part === 'rotor' && role.has(s)) Object.assign(role.get(s), { v: 'lift', name: 'רוטור כפול', say: 'שני רוטורים, אחד מעל השני, מסתובבים הפוך: מרים, ולא מסובב אותו סביב עצמו' });
  // (and the small one the engineer adds at a helicopter's tail - game/engineer.js: its tail rotor)
  for (const s of S) if (s.implicit && s.part === 'prop' && !s.push && role.has(s)) Object.assign(role.get(s), { v: 'tail', name: 'רוטור זנב', say: 'בזנב: מחזיק את המסוק ישר — בלעדיו הוא מסתובב סביב עצמו' });
  // (ROADMAP 11.14: the one the game adds at the back of a winged thing with nothing to push it)
  for (const s of S) if (s.implicit && s.push && role.has(s)) Object.assign(role.get(s), { v: 'pusher', name: 'מדחף דוחף', say: 'נוסף מאחור: דוחף אותו, והכנפיים מרימות' });
  // (a stream - water, fire, light - is no giant cannon however it is drawn)
  for (const s of S) if (s.el && STREAM_NAME[s.el] && role.has(s) && role.get(s).v === 'giant') Object.assign(role.get(s), { v: 'mg', name: STREAM_NAME[s.el], say: '' });
  // ---- what moves it
  const upside = !rollS.length && !trackS.length && roofS.length > 0;
  const wheelsOf = (list) =>
    list.map((s) => {
      const sh = shapeOf(s.pts);
      return { z: sh.mx, y: sh.my, r: clamp((sh.w + sh.h) / 4, 0.12, 1.3), v: vOf(s) };
    });
  // (on its roof only: it drives on its back - those are what it rolls on)
  const wheels = wheelsOf(upside ? roofS : rollS);
  const roofWheels = upside ? [] : wheelsOf(roofS);
  const tracks = trackS.map((s) => shapeOf(s.pts));
  // (the lines of one rotor - an X, a star, its blades drawn one by one - are one rotor, as wide as
  // all of them; two apart, two rotors. A rotor, a propeller lying over it: they lift it)
  const spinS = [...of('rotor'), ...of('prop')];
  const rotors = [];
  for (const s of spinS) {
    if (vOf(s) !== 'lift') continue;
    const sh = shapeOf(s.pts);
    const w = Math.max(sh.w, s.len || 0);
    // (ROADMAP 11.13: a drone's, side by side - each its own, out where it was drawn)
    const lat = s.lat || 0;
    const near = rotors.find((r) => sh.x1 > r.x0 - w * 0.3 && sh.x0 < r.x1 + w * 0.3 && Math.abs(sh.cy - r.cy) < Math.max(r.w, w) * 0.5 && Math.abs(lat - r.lat) < Math.max(r.w, w) * 0.5);
    if (near) {
      near.x0 = Math.min(near.x0, sh.x0);
      near.x1 = Math.max(near.x1, sh.x1);
      near.w = Math.max(near.x1 - near.x0, w, near.w);
      near.cx = (near.x0 + near.x1) / 2;
      near.coax = near.coax || !!s.implicit;
      // (ROADMAP 11.13: coax - the one the game adds: two, one over the other, turning against each
      // other)
    } else rotors.push({ x0: sh.x0, x1: sh.x1, w, cx: sh.cx, cy: sh.cy, h: sh.h, y0: sh.y0, y1: sh.y1, lat, guard: s.guard || undefined, coax: s.implicit || undefined });
  }
  // (and two that came to touch so: one - an X drawn line by line, its blades round one hub)
  for (let i = 0; i < rotors.length; i++) {
    for (let j = i + 1; j < rotors.length; j++) {
      const a = rotors[i];
      const b = rotors[j];
      const w = Math.min(a.w, b.w);
      if (!(b.x1 > a.x0 - w * 0.3 && b.x0 < a.x1 + w * 0.3 && Math.abs(b.cy - a.cy) < Math.max(a.w, b.w) * 0.5 && Math.abs(b.lat - a.lat) < Math.max(a.w, b.w) * 0.5)) continue;
      a.x0 = Math.min(a.x0, b.x0);
      a.x1 = Math.max(a.x1, b.x1);
      a.w = Math.max(a.x1 - a.x0, a.w, b.w);
      a.cx = (a.x0 + a.x1) / 2;
      a.coax = a.coax || b.coax;
      rotors.splice(j, 1);
      j = i;
    }
  }
  const rotorN = rotors.reduce((a, r) => a + (r.coax ? 2 : 1), 0);
  // (lying under it: a hovercraft's fans; standing up: a propeller - at its back, pushing)
  const fans = spinS.filter((s) => vOf(s) === 'hover').map((s) => shapeOf(s.pts));
  const props = spinS.filter((s) => vOf(s) === 'pusher' || vOf(s) === 'puller').map((s) => Object.assign(shapeOf(s.pts), { back: vOf(s) === 'pusher', lat: s.lat }));
  // (ROADMAP 11.13: a helicopter's tail rotor - it holds it straight, it lifts nothing)
  const tailRS = spinS.filter((s) => vOf(s) === 'tail').map((s) => shapeOf(s.pts));
  const jetS = of('jet');
  const jets = jetS.filter((s) => vOf(s) === 'jet').map((s) => Object.assign(shapeOf(s.pts), { side: s.side }));
  const vtols = jetS.filter((s) => vOf(s) === 'vtol').map((s) => shapeOf(s.pts));
  const retros = jetS.filter((s) => vOf(s) === 'retro').map((s) => shapeOf(s.pts));
  const wingS = of('wing');
  const wings = wingS.filter((s) => vOf(s) === 'wing').map((s) => Object.assign(shapeOf(s.pts), { span: s.span }));
  // (a wing standing up: a fin)
  const fins = [...of('fin'), ...wingS.filter((s) => vOf(s) === 'fin')];
  const sails = of('sail');
  const landSail = sails.some((s) => vOf(s) === 'land');
  const hulls = S.filter((s) => s.hull && s.type === 'body');
  const balloons = of('balloon');
  const barrels = of('barrel');
  const blades = of('blade');
  const heads = of('head');
  const springs = of('spring');
  const chutes = of('chute').map((s) => shapeOf(s.pts));
  const armors = of('armor');
  const sled = of('skid').some((s) => vOf(s) === 'sled');
  // ---- its weight, and where its weight is (each part's at its middle)
  const W0 = clamp(0.55 + L * 0.24, 0.9, 2.3);
  const R = rotors.length ? clamp((Math.max(...rotors.map((r) => r.w)) / 2) * 1.15, 0.8, 5.5) : 0;
  // (the wings: as long as drawn side on, front to back; across, as the plane is long)
  const span = (w) => (w.span ? clamp(w.span, 2.2, 24) : clamp(Math.max(w.w * 2.6, L * 0.95), 2.2, 16));
  const wingA = wings.reduce((a, w) => a + w.w * span(w), 0);
  const ms = [[area * W0 * 0.16, bx, by]];
  const put = (m, sh) => ms.push([m, sh.mx, sh.my]);
  for (const s of wheelS) {
    const sh = shapeOf(s.pts);
    const r = clamp((sh.w + sh.h) / 4, 0.12, 1.3);
    put(vOf(s) === 'track' ? 0.22 : 0.025 + r * r * 0.25, sh);
  }
  for (const s of barrels) put(0.03 + (s.len || 1) * (s.r || 0.05) ** 2 * 6, shapeOf(s.pts));
  for (const r of rotors) ms.push([0.12 + R * 0.03, r.cx, r.cy]);
  for (const w of wings) put(w.w * span(w) * 0.012, w);
  for (const p of props) put(0.04, p);
  for (const j of jets) put(0.1, j);
  for (const j of vtols) put(0.1, j);
  for (const j of retros) put(0.06, j);
  for (const f of fans) put(0.1, f);
  for (const s of fins) put(0.02, shapeOf(s.pts));
  for (const s of sails) put(0.04, shapeOf(s.pts));
  for (const c of chutes) put(0.06, c);
  for (const s of springs) put(0.06, shapeOf(s.pts));
  for (const s of armors) put(0.22, shapeOf(s.pts));
  for (const s of blades) put(0.05, shapeOf(s.pts));
  for (const s of heads) put(0.15, shapeOf(s.pts));
  let mass = 0;
  let cx = 0;
  let cy = 0;
  for (const [m, x, y] of ms) {
    mass += m;
    cx += m * x;
    cy += m * y;
  }
  // (a balloon pulls up what it is tied to: its weight is no weight where it is)
  const com = [cx / mass, cy / mass];
  mass = clamp(mass + balloons.length * 0.15, 0.15, 6);
  const rAvg = wheels.length ? wheels.reduce((a, w) => a + w.r, 0) / wheels.length : 0;
  // (a propeller standing up, a jet out of its back: they push it)
  const pd = (p) => Math.max(p.h, p.w * 0.8);
  let thrust = props.reduce((a, p) => a + clamp(pd(p), 0.5, 3.2) * 1.3, 0) + jets.reduce((a, j) => a + clamp(j.size, 0.3, 1.6) * 3.2, 0);
  // (a plane drawn as a plane - its body, its wings, its tail - with no engine drawn: one inside it,
  // a small one; the one drawn is stronger)
  const inner = !thrust && design.plane && wings.length > 0;
  if (inner) thrust = 1.6;
  // ---- how it goes: what it can do of each way
  // (ROADMAP 11.15: as drawn - what lifts it a little small for it still lifts it, slowly: the game
  // makes the drawing work in how it goes, not by changing its shape; the bigger it was drawn, the
  // better it does it)
  const assist = design.look === 'faithful';
  const LMIN = assist ? 0.4 : 1;
  const drive = wheels.length > 0 || tracks.length > 0 || fans.length > 0;
  const liftR = R ? (R * R * 1.15 * (1 + (rotorN - 1) * 0.6)) / mass : 0;
  // (jets under it pointing down: they lift it straight up - a rocket's engine as big as its foot
  // is wide, or as a fifth of how tall it stands: ROADMAP 11.13)
  const jCap = design.rocket ? Math.max(1.6, L * 1.1, H * 0.22) : 1.6;
  const liftJ = vtols.length ? vtols.reduce((a, j) => a + clamp(j.size, 0.3, jCap) * 1.9, 0) / mass : 0;
  const copter = (rotors.length > 0 && liftR >= LMIN) || liftJ >= LMIN;
  const liftW = wings.length ? wingA / (mass * 3.5) : 0;
  const plane = wings.length > 0 && thrust > 0 && liftW >= (assist ? 0.12 : 0.7);
  const glide = wings.length > 0 && !plane && drive;
  // (a balloon big enough for what it carries lifts it; too small - smaller than what hangs from
  // it, and too weak for its weight - it only slows its fall)
  let balloon = balloons.length > 0;
  let floaty = 0;
  if (balloon) {
    const E = shapeOf(balloons[0].pts);
    // (ROADMAP 11.13: an airship's - long, as round across as it is high)
    const vol = balloons[0].ship ? (Math.PI / 6) * E.w * E.h * E.h : (Math.PI / 6) * E.w * E.w * E.h;
    const lift = vol / (mass * 45 + 25);
    if (lift < 0.6 && (Math.PI / 4) * E.w * E.h < area * 1.2) {
      balloon = false;
      floaty = clamp(5.5 - lift * 5, 2.6, 5.5);
    }
  }
  // (a hovercraft: on the water as on the road)
  const boat = hulls.length > 0 || (sails.length > 0 && !landSail) || fans.length > 0;
  // (what it mostly is: wheels under a plane or a helicopter - small ones, under a long thin body -
  // are its landing gear: it is a plane that can roll along, not a car that flies)
  // (ROADMAP 11.13: wheels out at its two ends, a car's - a car that flies; small ones close
  // under it, a helicopter's, a plane's)
  const wz = wheels.map((w) => w.z);
  const spread = wz.length >= 2 ? (Math.max(...wz) - Math.min(...wz)) / Math.max(0.1, L) : 0;
  // (a helicopter's are under its cabin, its tail boom out behind; a car with a rotor has none)
  const boom = of('tail').length > 0;
  // (ROADMAP 11.14: tracks are no landing gear - a tank that flies; nor are a car's wheels, read as a
  // car, with only what the game added to fly it)
  const airy = design.plane || design.copter || design.airship || (wingS.some((s) => !s.implicit) && !design.group);
  // (ROADMAP 11.14: a long thin body over wheels as big as it is thick - a skateboard's deck - is on
  // wheels, no landing gear)
  const gear = drive && !tracks.length && !!airy && ((rAvg < H * 0.27 && spread < 0.55 && (wings.length > 0 || boom || !rotors.length)) || rAvg < H * 0.18 || (L / Math.max(0.1, H) > 4.8 && rAvg < H * 0.5));
  const force = plane && (gear || !drive) ? 'plane' : copter && (gear || !drive) ? 'copter' : drive ? 'car' : copter ? 'copter' : plane ? 'plane' : balloon ? 'balloon' : boat ? 'boat' : null;
  const warn = [];
  if (rotors.length && liftR < 1 && !(liftJ >= 1)) warn.push(liftR >= LMIN ? 'הרוטור קטן למשקל — מתרומם לאט. רוטור גדול יותר יטוס מהר יותר' : 'הרוטור קטן מדי למשקל — לא יתרומם. רוטור גדול יותר, או פחות משקל');
  if (vtols.length && liftJ < 1 && !(rotors.length && liftR >= 1)) warn.push(liftJ >= LMIN ? 'הסילונים שמתחת חלשים למשקל — ממריא לאט. עוד סילון ימריא מהר יותר' : 'הסילונים שמתחת חלשים מדי למשקל — לא ימריא. עוד סילון, או פחות משקל');
  if (wings.length && thrust > 0 && !plane) warn.push('הכנפיים קטנות מדי למשקל — לא ימריא');
  else if (wings.length && thrust > 0 && liftW < 0.7) warn.push('הכנפיים קטנות למשקל — צריך הרבה מהירות כדי להמריא. כנפיים גדולות יותר ימריאו מהר יותר');
  if (wings.length && !thrust && !drive) warn.push('כנפיים בלי מדחף או סילון — אין מה שיזיז אותו');
  if (inner) warn.push('לא צויר מנוע: יש לו מנוע קטן בפנים. מדחף או סילון שמציירים — מהיר יותר');
  if (floaty) warn.push('הבלון קטן מדי למשקל — לא מרים, רק מאט נפילה. בלון גדול יותר ימריא');
  if (!force) {
    const sum = summary({ ok: false, mass, L, H, wheels, warn, design, liftR, liftJ, liftW, role, com });
    // (ROADMAP 11.13: what it has that would move it, too weak - that, not "add something")
    const weak = warn.find((w) => /קטן מדי|קטנות מדי|חלשים מדי|בלי מדחף/.test(w));
    return { ok: false, why: weak || 'עוד לא זז — הוסיפו גלגלים, רוטור, כנפיים עם מדחף, מפרש או בלון', sum, mass, role, com, lifts: { R: liftR, J: liftJ, W: liftW / 0.7 } };
  }
  const abil = { drive, fly: copter && force !== 'copter' ? 'rotor' : plane && force !== 'plane' ? 'wings' : balloon && force !== 'balloon' ? 'balloon' : undefined, float: boat && force !== 'boat', gun: barrels.length > 0 };
  // (the drawing as game/drawncar.js reads one - and then its numbers, the parts')
  const spec = specOf(Object.assign({}, design, { force, abil, name: undefined }));
  if (!spec.ok) return { ok: false, why: spec.why, sum: null };
  spec.mass = mass;
  // (what it is made of, each part as it is where it is: game/partbuild.js builds it so)
  spec.role = role;
  spec.wheels = wheels.map((w) => ({ z: w.z, y: w.y, r: w.r }));
  spec.roofWheels = roofWheels.length ? roofWheels : undefined;
  spec.tracks = tracks;
  spec.upside = upside || undefined;
  spec.rotors = rotors;
  spec.tailRotor = tailRS.length ? { cx: tailRS[0].cx, cy: tailRS[0].cy, r: clamp((tailRS[0].w + tailRS[0].h) / 4, 0.25, 1.2) } : null;
  spec.props = props;
  // (ROADMAP 11.13: a plane drawn with no engine - the small one in it shows: a jet's nozzle at the
  // tail of one that looks a jet, a fighter, an airliner; a propeller on the nose of the rest)
  if (inner) {
    const k = planeNoun(S, role, { jets: [], props: [] }, design);
    spec.inner = k === 'fighter' || k === 'airliner' || k === 'jet' ? 'jet' : 'prop';
    const wi = warn.findIndex((t) => t.startsWith('לא צויר מנוע'));
    if (wi >= 0) warn[wi] = spec.inner === 'jet' ? 'לא צויר מנוע: יש לו סילון קטן בזנב. סילון או מדחף שמציירים — מהיר יותר' : 'לא צויר מנוע: יש לו מדחף קטן באף. מדחף או סילון שמציירים — מהיר יותר';
    if (spec.inner === 'prop') {
      const mb = bodies.reduce((a, b) => (!a || (shapeOf(b.pts).area || 0) > (shapeOf(a.pts).area || 0) ? b : a), null);
      const sp = mb ? spanAt(outline(mb.pts), x1 - L * 0.04) : null;
      const cy = sp ? (sp[0] + sp[1]) / 2 : (y0 + y1) / 2;
      const h = clamp(H * 1.1, 0.9, 2.2);
      spec.props = [{ x0: x1 - 0.05, x1, w: 0.05, h, cx: x1, cy, mx: x1, my: cy, y0: cy - h / 2, y1: cy + h / 2, back: false, lat: 0, made: true }];
    }
  }
  spec.jets = jets;
  spec.vtols = vtols;
  spec.retros = retros;
  spec.fans = fans;
  spec.com = com;
  const bike = S.some((s) => s.type === 'body' && s.slim) || bikeBuild(wheels, L, area);
  // ---- on wheels (on tracks, on its fans)
  if (spec.modes.drive) {
    const n = wheels.length;
    const zs = wheels.map((w) => w.z);
    for (const t of tracks) zs.push(t.x0 + Math.min(t.h, t.w * 0.2), t.x1 - Math.min(t.h, t.w * 0.2));
    const base = zs.length > 1 ? Math.max(...zs) - Math.min(...zs) : 0;
    // (ROADMAP 11.11: a pointed nose, a little faster; a flat front, a little slower)
    const noseK = design.nose === undefined ? 1 : design.nose < 0.32 ? 1.12 : design.nose > 0.82 ? 0.92 : 1;
    let top = clamp((16 + rAvg * 36 + jets.length * 5 - mass * 2.6 - (n === 1 && !tracks.length ? 6 : 0)) * noseK, 9, 48);
    let power = clamp(19 + jets.length * 3 - mass * 4.2 + Math.min(n, 4) * 0.3, 5, 24);
    let grip = clamp(3 + Math.min(n, 6) * 1.0 + rAvg * 2.5 + (fins.length ? 0.6 : 0) + (base / L) * 1.5, 3, 11);
    let steer = clamp(2.25 - base * 0.17, 0.8, 2.3);
    let slide = clamp(0.8 + grip * 0.03, 0.85, 1.2);
    const hx = {};
    // (ROADMAP 11.12) tracks: slow, never sliding, turning on the spot - over whatever is in the way
    if (tracks.length) {
      top = clamp(13 - mass * 0.8, 9, 15) * noseK;
      power = clamp(15 - mass * 2, 7, 15);
      grip = 11;
      slide = 1.2;
      steer = 1.55;
      hx.pivot = true;
      spec.crush = true;
    }
    // (square wheels: it bumps along - slower, but they hold the road)
    const sq = n ? wheels.filter((w) => w.v === 'square').length / n : 0;
    if (sq) {
      top *= 1 - 0.35 * sq;
      grip = Math.min(11, grip + 1.5 * sq);
      hx.bump = 0.08 * sq * clamp(rAvg / 0.35, 0.6, 2);
    }
    // (wheels as big as it is high: over the cars in its way)
    if (wheels.some((w) => w.v === 'big')) spec.crush = true;
    // (propellers pushing it along the road)
    const push = props.reduce((a, p) => a + clamp(pd(p), 0.5, 3.2), 0);
    if (push) {
      top += push * 3;
      power += push * 0.8;
    }
    // (a sail on wheels: a land yacht - quick on the straight, slow off the mark, silent)
    if (landSail) {
      const sa = sails.reduce((a, s) => a + (shapeOf(s.pts).area || 1), 0);
      top += clamp(5 + (sa / Math.max(1, L * H)) * 8, 5, 14);
      power *= 0.55;
      steer *= 0.85;
      hx.quiet = true;
    }
    // (a hovercraft: off the ground on its fans - it slides about)
    if (fans.length) {
      grip = clamp(grip * 0.35, 1.6, 3);
      slide = 0.6;
      top += 4;
      spec.hover = { h: clamp(H * 0.12, 0.15, 0.35) };
    }
    // (skids on the road: it drifts)
    if (sled) {
      grip *= 0.7;
      slide = 0.7;
    }
    // (a jet pointing forward: it brakes hard)
    if (retros.length) hx.brake = 1 + 0.9 * retros.length;
    // ---- (ROADMAP 11.12) its balance: where its weight is, over what it stands on
    if (zs.length >= 2 || tracks.length) {
      const floorY = upside ? Math.max(...wheels.map((w) => w.y + w.r)) : Math.min(...wheels.map((w) => w.y - w.r), ...tracks.map((t) => t.y0), y0);
      const hC = Math.max(0.15, upside ? floorY - com[1] : com[1] - floorY);
      const ssf = (W0 / 2 + 0.08) / hC;
      spec.ssf = ssf;
      // (side to side: high for how wide it is, it goes over in a hard turn - one that turns hard
      // and fast the soonest; a bike leans instead. As people draw them, 19 in 20 cars, vans,
      // buses stand wider than this: those never go over)
      if (!bike && !fans.length && ssf < TIP_SSF) hx.tipA = steer * 0.55 * top * (ssf / TIP_SSF);
      // (front to back: its weight between its wheels, or over one end)
      const zr = Math.min(...zs);
      const zf = Math.max(...zs);
      if (zf - zr > 0.2 && !fans.length) {
        const t = (com[0] - zr) / (zf - zr);
        spec.balance = t;
        if (t < -0.06) {
          spec.tilt = clamp(-t * 0.6, 0.08, 0.3);
          top *= 0.75;
          warn.push('מרכז הכובד מאחורי הגלגלים — הוא נשען על הזנב ונגרר. גלגל אחורי רחוק יותר, או פחות משקל מאחור');
        } else if (t > 1.06) {
          spec.tilt = -clamp((t - 1) * 0.6, 0.08, 0.3);
          top *= 0.75;
          warn.push('מרכז הכובד לפני הגלגלים — האף נגרר על הכביש. גלגל קדמי רחוק יותר, או פחות משקל מקדימה');
        } else if (t < 0.14) {
          hx.wheelie = clamp((0.14 - t) / 0.2 + 0.35, 0.35, 1);
          steer *= 0.8;
          warn.push('מרכז הכובד מעל הגלגלים האחוריים — האף מתרומם בהאצה, וההיגוי קל');
        } else if (t > 0.86) {
          steer *= 0.85;
          hx.dive = 1.8;
          warn.push('מרכז הכובד מעל הגלגלים הקדמיים — פונה פחות טוב וצולל בבלימה');
        }
      }
      if (hx.tipA) warn.push(roofWheels.length || upside ? 'גבוה וצר — עלול להתהפך בפנייה חדה, אבל גלגלי הגג ימשיכו לנסוע' : 'גבוה וצר — עלול להתהפך בפנייה חדה. רחב יותר, נמוך יותר, או גלגלים על הגג');
      const ends = spec.balance === undefined ? 1 : spec.balance < -0.06 || spec.balance > 1.06 ? 0.4 : spec.balance < 0.14 || spec.balance > 0.86 ? 0.75 : 1;
      spec.steady = bike ? 0.45 : clamp(Math.min(1, ssf / (TIP_SSF * 2)) * ends, 0.05, 1);
    } else spec.steady = 0.2;
    spec.handling = Object.assign({ mass: clamp(mass, 0.4, 3.2), power, top, grip, slide, steer, roll: clamp(H * 0.45, 0.2, 1.4), pitch: 0.5 }, hx);
    spec.glide = glide ? clamp(wingA / (mass * 6), 0.15, 0.75) : 0;
  }
  // ---- in the air
  if (spec.modes.copter) {
    spec.rotorR = R || clamp(L * 0.45, 1, 3);
    const lift = Math.max(liftR, liftJ);
    spec.qCopter = { speed: clamp(0.5 + (R || 2) * 0.1 + (lift - 1) * 0.25 + (liftJ >= 1 ? 0.2 : 0), 0.45, 1.5), accel: clamp(0.65 + (lift - 1) * 0.5 + (R || 2) * 0.05, 0.6, 1.4) };
    // (ROADMAP 11.15: a little small for it - it rises slowly)
    if (lift < 1) spec.qCopter.climb = clamp(lift, 0.35, 1);
    if (spec.base === 'copter') spec.q = spec.qCopter;
    // (its weight not under its rotor: it leans that way, and drifts)
    let lx = 0;
    let lw = 0;
    if (rotors.length && liftR >= 1) {
      for (const r of rotors) {
        lx += r.cx * r.w * r.w;
        lw += r.w * r.w;
      }
    } else {
      for (const j of vtols) {
        lx += j.mx * j.size;
        lw += j.size;
      }
    }
    const off = lw ? (com[0] - lx / lw) / L : 0;
    // (ROADMAP 11.13: one rotor, nothing to hold it straight - it turns its body round the other
    // way: a tail rotor holds it, a second rotor turning against it, jets)
    if (rotors.length === 1 && !rotors[0].coax && liftR >= LMIN && !tailRS.length && !(liftJ >= 1)) {
      // (ROADMAP 11.15: as drawn, the game holds it nearly straight - a tail rotor holds it all the way)
      spec.spin = assist ? 0.18 : 0.5;
      warn.push(assist ? 'רוטור אחד בלי רוטור זנב — מסתובב קצת סביב עצמו. רוטור קטן בזנב יחזיק אותו ישר' : 'רוטור אחד בלי רוטור זנב — בטיסה הוא מסתובב סביב עצמו. רוטור קטן בזנב, או רוטור שני, יחזיקו אותו ישר');
    }
    if (Math.abs(off) > 0.08) {
      spec.lean = clamp(off * 1.5, -0.3, 0.3);
      const what = rotors.length && liftR >= 1 ? 'הרוטור' : 'הסילונים';
      warn.push(off > 0 ? `${what} מאחורי מרכז הכובד — נוטה קדימה וזז לבד` : `${what} לפני מרכז הכובד — נוטה אחורה וזז לבד`);
    }
  }
  if (spec.modes.plane) {
    spec.qPlane = { speed: clamp(0.75 + thrust * 0.08 - mass * 0.04, 0.6, 1.35), accel: clamp(1.0 + thrust * 0.12 - mass * 0.04, 0.9, 2.0) };
    // (the bigger the wings for its weight, the slower it flies without falling)
    spec.stallV = clamp(17 / Math.sqrt(Math.max(0.5, liftW / 0.9)), 11, 26);
    // (its weight behind where its wings hold it: it pitches about; far ahead of them: it needs
    // more speed)
    if (wings.length) {
      let np = 0;
      let aw = 0;
      for (const w of wings) {
        const a = w.w * span(w);
        np += (w.x1 - w.w * (fins.length ? 0.45 : 0.3)) * a;
        aw += a;
      }
      const sm = (com[0] - np / aw) / L;
      if (sm < -0.06) {
        spec.pitchy = clamp(-sm * 5, 0.2, 1);
        warn.push('מרכז הכובד מאחורי הכנפיים — המטוס מיטלטל באוויר. כנפיים יותר מאחור, או משקל מקדימה');
      } else if (sm > 0.25) {
        spec.stallV = clamp(spec.stallV * 1.15, 11, 30);
        warn.push('הרבה משקל לפני הכנפיים — צריך יותר מהירות כדי להמריא');
      }
    }
    spec.takeoffV = spec.stallV + 4;
    if (spec.base === 'plane') spec.q = spec.qPlane;
  }
  // (ROADMAP 11.13: an airship - its propellers push it along where it points, it turns as it
  // goes; none drawn, small engines in its gondola push it slowly)
  if (spec.balloon && design.airship) {
    const push = props.reduce((a, p) => a + clamp(pd(p), 0.5, 3.2), 0);
    spec.balloon.ship = true;
    spec.balloon.drift = clamp(push ? 6 + push * 1.6 : 4.5, 4.5, 14);
    const envL = shapeOf(balloons[0].pts).w;
    spec.balloon.len = envL;
    spec.balloon.turn = clamp(0.55 - envL * 0.008 + fins.length * 0.04, 0.25, 0.6);
    if (!push) warn.push('לא צויר מדחף: מנועים קטנים בגונדולה מזיזים אותה לאט. מדחף מאחור — מהירה יותר');
    if (!fins.length) {
      spec.balloon.turn *= 0.7;
      warn.push('בלי סנפירים בזנב היא מתנדנדת ופונה לאט. סנפירים מאחור ייצבו אותה');
    }
  }
  // (ROADMAP 11.14: a hot air balloon with a propeller on its basket - it goes where it is steered,
  // faster)
  if (spec.balloon && !design.airship && props.length) {
    const push = props.reduce((a, p) => a + clamp(pd(p), 0.5, 3.2), 0);
    spec.balloon.drift = clamp(spec.balloon.drift + 2 + push * 1.4, 3.5, 12);
    spec.balloon.prop = true;
  }
  // (a hovercraft on the water: over it, not in it)
  if (spec.boat && fans.length) spec.boat.draft = 0;
  // ---- on the water: propellers push it along (an airboat)
  if (spec.boat && props.length) {
    const push = props.reduce((a, p) => a + clamp(pd(p), 0.5, 3.2), 0);
    spec.boat.q.speed = clamp(spec.boat.q.speed + push * 0.25, 0.6, 1.45);
    spec.boat.q.accel = Math.max(spec.boat.q.accel, 1.2);
    spec.boat.motor = true;
    spec.boat.paddle = false;
    spec.boat.sail = false;
    spec.boat.air = true;
    if (spec.base === 'boat') spec.q = spec.boat.q;
  }
  // ---- its gear
  const springOf = (v) => springs.filter((s) => vOf(s) === v);
  const jumps = springOf('jump');
  if (jumps.length) {
    const sh = shapeOf(jumps[0].pts);
    spec.spring = { jump: clamp(6 + (jumps[0].coils || 4) * 0.45 + sh.h * 1.2 + (jumps.length - 1), 6, 14) };
  } else delete spec.spring;
  // (at its back: a kick forward; at its front: a bumper that throws what it hits; on its roof: it
  // rights itself)
  const kicks = springOf('kick');
  if (kicks.length) spec.spring = Object.assign(spec.spring || {}, { kick: clamp(10 + (kicks[0].coils || 4) * 0.8, 10, 18) });
  const bumpers = springOf('bumper');
  if (bumpers.length) spec.bumper = { k: clamp(1.4 + (bumpers[0].coils || 4) * 0.12, 1.4, 2.6) };
  if (springOf('righter').length) spec.righter = true;
  if (chutes.length) {
    const c = chutes[0];
    spec.chute = { sink: clamp(3 + mass * 1.4 - (c.w / Math.max(0.5, L)) * 1.6, 2.2, 7), deploy: true, w: c.w };
  } else delete spec.chute;
  if (floaty) spec.floaty = { sink: floaty };
  spec.armor = armors.length ? clamp(0.22 + armors.length * 0.07, 0.22, 0.55) : 0;
  // (at its front: what rams - a blade, a hammer's head (harder), armour (it is hurt less))
  const rams = [...blades.filter((s) => vOf(s) === 'ram'), ...heads.filter((s) => vOf(s) === 'ram'), ...armors.filter((s) => vOf(s) === 'front')];
  if (rams.length) {
    const k = clamp(1.4 + Math.max(...rams.map((s) => s.len || shapeOf(s.pts).size)) * 0.5 + (heads.some((s) => vOf(s) === 'ram') ? 0.6 : 0), 1.4, 3.4);
    spec.ram = { k, shield: armors.some((s) => vOf(s) === 'front') || undefined };
  }
  const sides = blades.filter((s) => vOf(s) === 'side');
  const rears = blades.filter((s) => vOf(s) === 'rear');
  if (sides.length || rears.length) spec.blades = { side: sides.length ? clamp(30 + sides.reduce((a, s) => a + (s.len || 1), 0) * 14, 30, 90) : 0, rear: rears.length > 0 };
  // ---- its barrels: each fires
  spec.guns = barrels.map((s) => gunOf(s, vOf(s), mass));
  // (a sight on it: they all fire truer; a magazine: they load quicker; a silencer: nobody hears)
  const scope = of('scope').length;
  const mags = of('mag').length;
  const quiet = of('silencer').length > 0;
  for (const g of spec.guns) {
    if (scope) g.spread *= 0.55;
    if (mags) g.reload *= 0.7;
    if (quiet) g.quiet = true;
  }
  spec.gun = spec.guns.length ? { r: spec.guns[0].r, len: spec.guns[0].len, type: spec.guns[0].type } : undefined;
  delete spec.cannon;
  // ---- how much it takes, what it is called
  spec.hp = Math.round(clamp(70 + mass * 60 + area * 4, 80, 450) * (1 + spec.armor));
  let cost = 14 + area * 1.2;
  for (const s of S) cost += INK[s.part] || 0;
  spec.cost = Math.round(clamp(cost, 18, 95));
  // (ROADMAP 11.15: what its parts do together, more than each alone - game/combos.js)
  const combo = rideCombos(spec);
  // (as long as it is all: an airship by its envelope, a drone across its rotors)
  const Lall = design.rocket ? H : spec.balloon && spec.balloon.len ? spec.balloon.len : design.drone && rotors.length ? Math.max(...rotors.map((r) => r.x1)) - Math.min(...rotors.map((r) => r.x0)) : L;
  const sum = summary({ ok: true, spec, mass, L, Lall, H, area, wheels, rAvg, R, liftR, liftJ, liftW, warn, design, copter, plane, glide, boat, balloon, role, com, tracks, fans, combo });
  spec.label = sum.name;
  spec.sum = sum;
  spec.polish = true;
  // (ROADMAP 11.13: how much each kind of thing that lifts it does, 1 just enough - the card shows
  // the most of them)
  spec.lifts = { R: liftR, J: liftJ, W: liftW / 0.7 };
  return spec;
}

// (ROADMAP 11.12) how high its weight may be, for how wide it is (half its width over the height of
// its weight), before its hardest turn rolls it over - game/vehicles.js drive: the sideways pull
// (m/s²) that tips it, its hardest turn's at this, less below it
const TIP_SSF = 0.3;

// two like wheels, big for its length, and little body between them: a bike's build
function bikeBuild(wheels, L, area) {
  if (wheels.length !== 2) return false;
  const [a, b] = wheels;
  const r = (a.r + b.r) / 2;
  const wr = Math.max(a.r, b.r) / Math.max(1e-3, Math.min(a.r, b.r));
  return wr < 1.6 && r / Math.max(1e-3, L) >= 0.13 && area / (Math.PI * r * r * 2) <= 3.6;
}

// the middle of a closed outline (its area's)
function centroid(pts) {
  let a = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const c = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    a += c;
    x += (pts[j][0] + pts[i][0]) * c;
    y += (pts[j][1] + pts[i][1]) * c;
  }
  if (Math.abs(a) < 1e-9) return null;
  return [x / (3 * a), y / (3 * a)];
}

// (a design made before parts: its kinds as game/drawncar.js had them)
function legacy(s) {
  return s.type === 'gun' ? 'barrel' : s.type === 'envelope' ? 'balloon' : s.type;
}

// a barrel: what it fires, how hard, how far, how true (v: what it is where it is - game/
// partrole.js; mass: what it is on, for how far a giant one throws it back)
export function gunOf(s, v = null, mass = 1) {
  const r = s.r || 0.05;
  const len = s.len || 1;
  const cannon = r >= 0.11;
  const el = s.el || undefined;
  // (out of its underside, pointing down: what it fires falls - bombs; game/vehicles.js fires
  // along a barrel that cannot turn to where you aim)
  const down = !!(s.base && s.muz && s.muz[1] - s.base[1] > len * 0.6) || undefined;
  // (ROADMAP 11.11) drawn in blue, red, neon: a jet of water, a flamethrower, a ray - a stream of
  // it while the button is held, however thick the barrel; the rest as drawn, of their ink
  if (el === 'water' || el === 'fire' || el === 'light') {
    const speed = el === 'light' ? 150 : el === 'fire' ? 34 : 46;
    return { type: 'mg', el, down, r, len, reload: el === 'light' ? 0.12 : 0.06, dmg: Math.round(clamp((el === 'light' ? 18 : 6) + r * 90, 6, el === 'light' ? 40 : 22)), speed, spread: el === 'light' ? 0.004 : 0.05, life: el === 'fire' ? 0.75 : el === 'water' ? 1.4 : 1.6, range: Math.round(speed * (el === 'fire' ? 0.75 : el === 'water' ? 1.1 : 1.6)) };
  }
  // (ROADMAP 11.12) as long as what it is on (its body itself, drawn as a barrel): a giant cannon -
  // a heavy shell, a big blast, slow to load, and it throws what fires it back
  if (v === 'giant' || s.whole) {
    const R = Math.max(r, 0.14);
    const speed = clamp(36 + len * 2, 36, 52);
    return { type: 'cannon', giant: true, el, down, r: R, len, reload: clamp(2.6 + R * 4, 3, 5), dmg: Math.round(clamp(220 + R * 500, 260, 480)), blast: clamp(7 + R * 10, 8, 13), speed, spread: 0.006, range: Math.round(speed * 3.4), recoil: clamp(6 + (R * len * 18) / Math.max(0.4, mass), 6, 24) };
  }
  if (cannon) {
    const speed = clamp(42 + len * 5, 42, 70);
    return { type: 'cannon', el, down, r, len, reload: clamp(0.8 + r * 5, 1.0, 2.6), dmg: Math.round(clamp(80 + r * 520, 100, 240)), blast: clamp(2.5 + r * 18, 3, 8.5), speed, spread: clamp(0.03 / (1 + len * 0.8), 0.004, 0.03), range: Math.round(speed * 3.2) };
  }
  const speed = clamp(70 + len * 14, 70, 130);
  return { type: 'mg', el, down, r, len, reload: clamp(0.05 + r * 1.2, 0.07, 0.16), dmg: Math.round(clamp(6 + r * 140, 8, 20)), speed, spread: clamp(0.06 / (1 + len * 0.9), 0.007, 0.06), life: 2.5, range: Math.round(speed * 2.5) };
}

// ------------------------------------------------------------------ the card: its name, what it does, its numbers
const NOUN = {
  car: ['מכונית', 'f'],
  moto: ['אופנוע', 'm'],
  mono: ['חד־אופן', 'm'],
  bicycle: ['אופניים', 'p'],
  police: ['ניידת', 'f'],
  van: ['מסחרית', 'f'],
  pickup: ['טנדר', 'm'],
  ambulance: ['אמבולנס', 'm'],
  bus: ['אוטובוס', 'm'],
  truck: ['משאית', 'f'],
  firetruck: ['כבאית', 'f'],
  tractor: ['טרקטור', 'm'],
  skate: ['סקייטבורד', 'm'],
  speedboat: ['סירת מנוע', 'f'],
  canoe: ['קאנו', 'm'],
  sub: ['צוללת', 'f'],
  monster: ['מכונית מפלצת', 'f'],
  jetcar: ['מכונית סילון', 'f'],
  copter: ['מסוק', 'm'],
  plane: ['מטוס', 'm'],
  boat: ['סירה', 'f'],
  sailboat: ['סירת מפרש', 'f'],
  ship: ['ספינה', 'f'],
  balloon: ['כדור פורח', 'm'],
  tank: ['טנק', 'm'],
  dozer: ['דחפור', 'm'],
  crawler: ['רכב זחלים', 'm'],
  hover: ['רחפת', 'f'],
  landyacht: ['יאכטת יבשה', 'f'],
  gun: ['תותח מתגלגל', 'm'],
  jetcopter: ['רחפן סילון', 'm'],
  drone: ['רחפן', 'm'],
  rocket: ['רקטה', 'f'],
  airliner: ['מטוס נוסעים', 'm'],
  fighter: ['מטוס קרב', 'm'],
  jet: ['מטוס סילון', 'm'],
  biplane: ['מטוס דו־כנפי', 'm'],
  lightplane: ['מטוס קל', 'm'],
  tandem: ['מסוק דו־רוטורי', 'm'],
  airship: ['ספינת אוויר', 'f'],
  airboat: ['סירת ביצות', 'f'],
  still: ['פסל', 'm'],
};
const ADJ = {
  fly: ['מעופף', 'מעופפת', 'מעופפים'],
  glide: ['גולש', 'גולשת', 'גולשים'],
  float: ['אמפיבי', 'אמפיבית', 'אמפיביים'],
  armed: ['חמוש', 'חמושה', 'חמושים'],
  armor: ['משוריין', 'משוריינת', 'משוריינים'],
  jump: ['קופץ', 'קופצת', 'קופצים'],
  upside: ['הפוך', 'הפוכה', 'הפוכים'],
  sail: ['שט', 'שטה', 'שטים'],
  drive: ['נוסע', 'נוסעת', 'נוסעים'],
};
// (ROADMAP 11.14) what the network sees in it that is no ride - its noun when it goes all the same
const BOXY_THING = new Set(['ladder', 'bridge']);
const THING_NOUN = {
  house: ['בית', 'm'],
  tree: ['עץ', 'm'],
  flower: ['פרח', 'm'],
  cat: ['חתול', 'm'],
  star: ['כוכב', 'm'],
  cloud: ['ענן', 'm'],
  fish: ['דג', 'm'],
  face: ['ראש', 'm'],
  umbrella: ['מטרייה', 'f'],
  key: ['מפתח', 'm'],
  ladder: ['סולם', 'm'],
  bridge: ['גשר', 'm'],
  sword: ['חרב', 'f'],
  knife: ['סכין', 'f'],
  axe: ['גרזן', 'm'],
  hammer: ['פטיש', 'm'],
  'baseball bat': ['מחבט', 'm'],
  boomerang: ['בומרנג', 'm'],
  rifle: ['רובה', 'm'],
  pistol: ['אקדח', 'm'],
  bomb: ['פצצה', 'f'],
  shield: ['מגן', 'm'],
  spring: ['קפיץ', 'm'],
  parachute: ['מצנח', 'm'],
};
// (the network's kind of it: its noun)
const WATER_NOUN = new Set(['speedboat', 'canoe', 'sub', 'ship', 'sailboat']);
const KIN_NOUN = { car: 'car', 'police car': 'police', 'pickup truck': 'pickup', van: 'van', ambulance: 'ambulance', truck: 'truck', firetruck: 'firetruck', bus: 'bus', 'school bus': 'bus', motorbike: 'moto', bicycle: 'bicycle', tractor: 'tractor', tank: 'tank', cannon: 'tank', skateboard: 'skate', speedboat: 'speedboat', canoe: 'canoe', submarine: 'sub', 'cruise ship': 'ship', sailboat: 'sailboat' };

// (ROADMAP 11.13) a plane's kind, by what was drawn on it: two wings one over the other - a biplane;
// a row of windows, engines on its wings - an airliner; a glass canopy on its top - a fighter; a
// propeller and no jet - a light plane; a dart from above, its wings swept far back - a jet plane
function planeNoun(S, role, spec, design) {
  const of = (t) => S.filter((s) => (s.part || legacy(s)) === t);
  const wings = of('wing').filter((s) => !role.has(s) || role.get(s).v === 'wing').map((s) => shapeOf(s.pts));
  for (let a = 0; a < wings.length; a++) for (let b = a + 1; b < wings.length; b++) if (Math.min(wings[a].x1, wings[b].x1) - Math.max(wings[a].x0, wings[b].x0) > Math.min(wings[a].w, wings[b].w) * 0.4 && Math.abs(wings[a].cy - wings[b].cy) > 0.3) return 'biplane';
  const bodies = S.filter((s) => s.type === 'body').map((s) => shapeOf(s.pts));
  const top = bodies.length ? Math.max(...bodies.map((b) => b.y1)) : 0;
  const mid = bodies.length ? (Math.min(...bodies.map((b) => b.y0)) + top) / 2 : 0;
  const windows = of('window').map((s) => shapeOf(s.pts));
  const canopy = windows.some((w) => w.cy > mid + (top - mid) * 0.45 && w.w > w.h * 1.3);
  const jets = spec.jets || [];
  const onWings = S.some((s) => (s.part || legacy(s)) === 'jet' && (s.wing || (s.lat !== undefined && Math.abs(s.lat) > 0.5)));
  // (its wings swept far back, from above: a jet's - a light plane's go straight out)
  const swept = of('wing').some((s) => {
    if (!s.plan) return false;
    const reach = Math.max(...s.plan.map((q) => q[1]));
    const lead = (x0, x1) => Math.max(...s.plan.filter((q) => q[1] >= x0 && q[1] <= x1).map((q) => q[0]), -Infinity);
    const root = lead(0, reach * 0.25);
    const tip = lead(reach * 0.8, reach);
    return reach > 0 && Number.isFinite(root) && Number.isFinite(tip) && (root - tip) / reach > 0.9;
  });
  if (canopy) return 'fighter';
  if (windows.length >= 3 || onWings) return 'airliner';
  if ((design && design.dart) || swept) return 'jet';
  if ((spec.props || []).length && !jets.length) return 'lightplane';
  return 'plane';
}

const M0 = (spec) => spec.modes || {};

function summary(o) {
  const { spec, mass, L, H, wheels, warn } = o;
  const S = o.design.strokes;
  // (ROADMAP 11.12: what each part is where it is - game/partrole.js)
  const role = o.role || new Map();
  const vs = (t, v) => S.some((s) => (s.part || legacy(s)) === t && role.has(s) && role.get(s).v === v);
  const giant = spec && spec.guns && spec.guns.some((gn) => gn.giant);
  const whole = S.some((s) => s.whole);
  const has = (t) => S.some((s) => (s.part || legacy(s)) === t);
  const nBarrels = S.filter((s) => (s.part || legacy(s)) === 'barrel').length;
  // (all it fires water: a water cannon, no weapon)
  const waterOnly = nBarrels > 0 && S.every((s) => (s.part || legacy(s)) !== 'barrel' || s.el === 'water');
  // ---- its name: what it mostly is, and what else
  let noun = 'still';
  const base = spec ? spec.base : null;
  const kin = KIN_NOUN[o.design.cls] || null;
  if (base === 'car') {
    // (ROADMAP 11.11: what it is, by what the network sees in it - a motorbike, a bus, a tractor -
    // and by its build, the wheels for its body: not by how big it was drawn. Measured on people's
    // own drawings, 1,900 rides and boats: 68% named as they were drawn, 83% as near as can be)
    const n = wheels.length;
    const cannon = spec.guns && spec.guns.some((gn) => gn.type === 'cannon');
    const r = o.rAvg || 0;
    const rH = r / Math.max(1e-3, H);
    const aW = n ? (o.area || 0) / (Math.PI * r * r * n) : Infinity;
    const wr = n === 2 ? Math.max(wheels[0].r, wheels[1].r) / Math.max(1e-3, Math.min(wheels[0].r, wheels[1].r)) : 9;
    // (two like wheels, big for its length, and little body between them: a bike's build)
    const bikey = S.some((s) => s.type === 'body' && s.slim) || (n === 2 && wr < 1.6 && r / Math.max(1e-3, L) >= 0.13 && aW <= 3.6);
    let k = kin;
    if ((k === 'moto' || k === 'bicycle') && n > 2) k = null;
    if (k === 'tank' && !nBarrels) k = null;
    // (ROADMAP 11.14: a skateboard's deck is thin over its wheels - a tub on them is no skateboard)
    if (k === 'skate' && (n < 2 || rH < 0.3)) k = null;
    // (a boat's kind, for one on wheels: a car still)
    if (k && WATER_NOUN.has(k)) k = null;
    if (k === 'car' && rH >= 0.5) k = 'monster';
    if (cannon && n >= 4) k = 'tank';
    // (ROADMAP 11.14: a long thin deck over its two wheels, they as big as it is thick - a skateboard)
    const decked = n === 2 && L / Math.max(1e-3, H) > 6 && rH >= 0.3;
    noun = k || (bikey ? 'moto' : n === 1 && aW < 1.5 ? 'mono' : decked ? 'skate' : rH >= 0.5 ? 'monster' : L > 6.8 ? 'truck' : 'car');
    // (ROADMAP 11.12: on tracks - a tank with a cannon, a bulldozer with a blade at its front; on
    // its fans, a hovercraft; with a sail, a land yacht; its body a barrel, a cannon on wheels)
    // (ROADMAP 11.14: one the network sees a tank in, with a gun: a tank still)
    if (o.tracks && o.tracks.length) noun = cannon || (k === 'tank' && nBarrels) ? 'tank' : vs('blade', 'ram') ? 'dozer' : 'crawler';
    // (ROADMAP 11.14: a jet out of its back pushing it - a jet car)
    else if ((spec.jets || []).length && (noun === 'car' || noun === 'skate' || noun === 'truck' || noun === 'mono')) noun = 'jetcar';
    else if (o.fans && o.fans.length) noun = 'hover';
    else if (vs('sail', 'land')) noun = 'landyacht';
    if (whole && noun !== 'tank') noun = 'gun';
  } else if (base === 'copter') noun = o.design.rocket ? 'rocket' : !(spec.rotors && spec.rotors.length) ? 'jetcopter' : o.design.drone || spec.rotors.length >= 3 ? 'drone' : spec.rotors.length === 2 ? 'tandem' : 'copter';
  else if (base === 'plane') noun = planeNoun(S, role, spec, o.design);
  else if (base === 'balloon') noun = o.design.airship ? 'airship' : 'balloon';
  // (ROADMAP 11.14: drawn a boat, and it flies - a rotor, wings on it: the boat it is, flying)
  const asBoat = !!o.design.asBoat && base !== 'boat' && base !== 'car';
  if (base === 'boat' || asBoat) {
    // (a sail drawn: a sailboat; else the network's kind of boat - a submarine, a canoe)
    const k = kin === 'speedboat' || kin === 'canoe' || kin === 'sub' || kin === 'ship' ? kin : null;
    noun = has('sail') ? (L > 10 ? 'ship' : 'sailboat') : k || (L > 10 ? 'ship' : 'boat');
    if (spec.boat && spec.boat.air && !asBoat) noun = 'airboat';
  }
  // (ROADMAP 11.14: what the network plainly sees in it is no ride - a house, a fish, a cloud, a
  // sword - and it goes: that, going - a flying house, a fish that sails, a sword on wheels)
  const thing = spec && o.design.thing ? THING_NOUN[o.design.thing] : null;
  const [word, g] = thing || NOUN[noun];
  const adj = [];
  const say = (k) => adj.push(ADJ[k][g === 'f' ? 1 : g === 'p' ? 2 : 0]);
  if (spec) {
    const M = spec.modes;
    // (a balloon over it, all that lifts it: "with a balloon" says it - game/partsum.js below)
    if ((thing || asBoat || (base !== 'copter' && base !== 'plane' && base !== 'balloon')) && (M.copter || M.plane || (M.balloon && thing))) say('fly');
    else if (o.glide) say('glide');
    else if (thing && M.boat && !M.drive) say('sail');
    else if (thing && M.drive) say('drive');
    if (base !== 'boat' && !asBoat && M.boat && !(thing && !M.drive && !M.copter && !M.plane && !M.balloon)) say('float');
    if (nBarrels && noun !== 'tank' && !waterOnly) say('armed');
    if (spec.upside) say('upside');
    if (spec.armor) say('armor');
    if (spec.spring && spec.spring.jump && adj.length < 2) say('jump');
  }
  let name = [word, ...adj.slice(0, 2)].join(' ');
  // (nothing moves it yet, and the network sees a car, a bus, a tractor in it: that, with no wheels -
  // a plain one: a body alone is no police car yet)
  const bare = { police: 'car', ambulance: 'car', firetruck: 'truck' }[kin] || kin;
  if (noun === 'still' && bare && NOUN[bare] && !WATER_NOUN.has(bare)) name = `${NOUN[bare][0]} בלי גלגלים`;
  if (has('chute') && spec && spec.chute) name += ' עם מצנח';
  else if (giant && !whole && noun !== 'tank') name += ' עם תותח ענק';
  else if (has('blade') && spec && spec.ram && noun !== 'dozer') name += ' עם איל';
  else if (spec && spec.bumper) name += ' עם פגוש קפיץ';
  else if (spec && spec.blades && spec.blades.side) name += ' עם להבים';
  else if (waterOnly) name += ' עם תותח מים';
  else if (spec && M0(spec).balloon && base !== 'balloon') name += ' עם בלון';
  else if (spec && spec.balloon && spec.balloon.prop) name += ' עם מדחף';
  // ---- what it does (a chip each)
  const abil = [];
  if (spec) {
    const M = spec.modes;
    if (M.drive) abil.push(['move', 'נסיעה']);
    if (M.copter) abil.push(['air', 'ריחוף']);
    if (M.plane) abil.push(['air', 'טיסה']);
    if (o.glide) abil.push(['air', 'גלישה']);
    if (M.balloon) abil.push(['air', spec.balloon && spec.balloon.ship ? 'טיסה' : 'התרוממות']);
    if (M.boat) abil.push(['water', 'שיט']);
    if (spec.boat && spec.boat.dive) abil.push(['water', 'צלילה']);
    if (nBarrels) abil.push(['fire', nBarrels > 1 ? `ירי ×${nBarrels}` : 'ירי']);
    // (a barrel drawn in colour: what it fires, a chip each)
    for (const e of [...new Set((spec.guns || []).map((gn) => gn.el).filter(Boolean))]) abil.push(['el-' + e, EL_NAME[e]]);
    if (spec.ram) abil.push(['fire', 'ניגוח']);
    // (ROADMAP 11.12: what its parts make of it, where they are)
    if (o.tracks && o.tracks.length) abil.push(['move', 'זחלים']);
    if (spec.hover) abil.push(['water', 'מים ויבשה']);
    if (spec.vtols && spec.vtols.length && M.copter) abil.push(['air', 'המראה אנכית']);
    if (spec.upside) abil.push(['move', 'נוסע הפוך']);
    else if (spec.roofWheels) abil.push(['move', 'נוסע גם הפוך']);
    if (giant) abil.push(['fire', 'רתיעה']);
    if (spec.blades && spec.blades.side) abil.push(['fire', 'להבי צד']);
    if (spec.blades && spec.blades.rear) abil.push(['fire', 'להב אחורי']);
    if (spec.bumper) abil.push(['gear', 'פגוש קפיץ']);
    if (spec.spring && spec.spring.jump) abil.push(['gear', 'קפיצה']);
    if (spec.spring && spec.spring.kick) abil.push(['gear', 'זינוק']);
    if (spec.righter) abil.push(['gear', 'מתיישר']);
    if (spec.handling && spec.handling.brake) abil.push(['move', 'בלם סילון']);
    if (spec.chute) abil.push(['gear', 'מצנח']);
    if (spec.floaty) abil.push(['air', 'נפילה איטית']);
    if (spec.armor) abil.push(['gear', 'שריון']);
    if ((spec.guns || []).some((gn) => gn.quiet) || (spec.handling && spec.handling.quiet)) abil.push(['gear', 'שקט']);
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
      // (ROADMAP 11.12: how steady it stands - its weight over its wheels, low and wide or high
      // and narrow)
      if (spec.steady !== undefined) bars.push({ k: 'steady', name: 'יציבות', v: spec.steady, txt: spec.handling.tipA ? 'עלול להתהפך' : '', bad: !!spec.handling.tipA || spec.steady < 0.35 });
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
      const lift = Math.max(o.liftR || 0, o.liftJ || 0, o.liftW ? o.liftW / 0.7 : 0);
      bars.push({ k: 'lift', name: 'עילוי', v: Math.min(1, lift / 2), txt: `×${lift.toFixed(1)}`, bad: lift < 1 });
    }
    if (spec.guns.length) {
      const dps = spec.guns.reduce((a, gn) => a + gn.dmg / gn.reload, 0);
      const range = Math.max(...spec.guns.map((gn) => gn.range));
      bars.push({ k: 'fire', name: 'כוח אש', v: Math.min(1, dps / 320), txt: spec.guns.map(gunName).join(' + ') });
      bars.push({ k: 'range', name: 'טווח', v: Math.min(1, range / 330), txt: `${range} מ׳` });
    }
    if (spec.spring && spec.spring.jump) {
      const h = (spec.spring.jump * spec.spring.jump) / 40;
      bars.push({ k: 'jump', name: 'קפיצה', v: Math.min(1, h / 5), txt: `${h.toFixed(1)} מ׳` });
    }
    bars.push({ k: 'hp', name: 'עמידות', v: spec.hp / 450, txt: `${spec.hp}` });
  } else if (rotorOrWings(o)) {
    const lift = Math.max(o.liftR || 0, o.liftJ || 0, o.liftW ? o.liftW / 0.7 : 0);
    bars.push({ k: 'lift', name: 'עילוי', v: Math.min(1, lift / 2), txt: `×${lift.toFixed(1)}`, bad: lift < 1 });
  }
  // ---- (ROADMAP 11.11) what its parts make it do that no number says: a line each
  const lines = [];
  if (spec) {
    const D = o.design;
    if (spec.modes.drive && D.nose !== undefined && D.nose < 0.32) lines.push(['move', 'חרטום מחודד', 'חותך את האוויר: מהיר יותר']);
    else if (spec.modes.drive && D.nose !== undefined && D.nose > 0.82) lines.push(['move', 'חזית שטוחה', 'דוחפת את האוויר: איטי יותר']);
    for (const gn of spec.guns || []) {
      if (gn.el === 'fire') lines.push(['el-fire', 'קנה אדום', gn.type === 'mg' ? 'להביור: שורף את מה שמולו' : 'פגז שמצית']);
      else if (gn.el === 'water') lines.push(['el-water', 'קנה כחול', 'סילון מים: הודף ומכבה שריפות']);
      else if (gn.el === 'light') lines.push(['el-light', 'קנה ניאון', 'קרן אור שעוברת דרך קירות']);
      else if (gn.el) lines.push(['el-' + gn.el, `${gn.type === 'cannon' ? 'תותח' : 'מקלע'} ${EL_NAME[gn.el]}`, { glue: 'מדביק למקום', shock: 'משתק את מי שסביב', ink: 'ענן דיו שמסתיר', tippex: 'מוחק את מה שפוגע בו', blast: 'מתפוצץ', bounce: 'קופץ מהקירות' }[gn.el]]);
      if (gn.down) lines.push(['fire', 'קנה כלפי מטה', gn.type === 'cannon' ? 'מטיל פצצות' : 'יורה למטה']);
    }
  }
  // (ROADMAP 11.12) each part that is something of its own where it is: what it does there (a
  // track, a wheel on the roof, a propeller pushing from the back, a giant cannon...) - once each
  const seen = new Set();
  for (const s of S) {
    const r = role.get(s);
    if (!r || !NOTABLE.has(`${s.part || legacy(s)}:${r.v}`)) continue;
    const key = `${r.v}:${r.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push([ROLE_TONE[s.part || legacy(s)] || 'gear', r.name, r.say.replace(/^[^:]+: /, '')]);
  }
  // (ROADMAP 11.15: what its parts do together; how many things it can do; one thing short of more)
  const C = o.combo || { list: [], adv: 0, near: [] };
  return { ok: o.ok, name, abil, bars, warn, mass, L: o.Lall || L, cost: spec ? spec.cost : 0, lines: lines.slice(0, 7), com: o.com, combos: C.list, adv: C.adv, near: C.near };
}

const rotorOrWings = (o) => o.design.strokes.some((s) => s.part === 'rotor' || s.part === 'wing' || (s.part === 'jet' && o.role && o.role.has(s) && o.role.get(s).v === 'vtol'));
// (the parts that are something of their own where they are - each a line on the card; the colour
// of its chip)
const NOTABLE = new Set(['wheel:track', 'wheel:roof', 'wheel:square', 'wheel:big', 'rotor:pusher', 'rotor:puller', 'rotor:hover', 'prop:pusher', 'prop:hover', 'prop:lift', 'jet:vtol', 'jet:retro', 'wing:fin', 'barrel:giant', 'barrel:rear', 'barrel:up', 'blade:side', 'blade:rear', 'head:ram', 'head:weight', 'spring:bumper', 'spring:kick', 'spring:righter', 'sail:land', 'armor:front', 'fin:spoiler', 'fin:keel', 'skid:sled', 'scope:scope', 'mag:mag', 'silencer:silencer']);
const ROLE_TONE = { wheel: 'move', rotor: 'air', prop: 'air', jet: 'move', wing: 'air', barrel: 'fire', blade: 'fire', head: 'fire', spring: 'gear', sail: 'water', armor: 'gear', fin: 'air', skid: 'move', scope: 'fire', mag: 'fire', silencer: 'gear' };
