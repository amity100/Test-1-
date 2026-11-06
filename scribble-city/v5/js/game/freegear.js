import { clamp } from '../core/util.js';
import { shapeOf, springy, turns } from './drawncar.js';
import { INKS } from './freeform.js';

// (ROADMAP 11.8) Gear drawn freehand (ui/freedraw.js): what it is comes from game/sketchnet.js (or
// the player's pick), and how good it is from its shape - as the blueprints' gadgets are graded
// (game/gadgets.js, ROADMAP 9.2), here by what is drawn:
//   - a parachute: a dome, wide and bowed, on its lines - the more lines, the steadier it comes down
//   - an umbrella: its canopy, the handle under its middle (a hook at its end: better still)
//   - a key: its bow (a ring at one end), its teeth at the other - the more teeth, the more locks
//     it opens before it bends
//   - a ladder: two rails, rungs across them - more of them, evenly spaced: a better ladder
//   - a ramp: as steep as it is drawn - a steep one throws you higher, a long low one further
//   - a bridge: its deck straight across, posts or a rail on it, an arch under it
//   - a spring: its coils - the more of them, the higher it throws you (up onto a roof)
// The shield is a weapon of its own kind (game/freeform.js: held up in front, it blocks).

export const GEAR = {
  shield: { name: 'מגן', cost: 12 },
  parachute: { name: 'מצנח', cost: 14 },
  umbrella: { name: 'מטרייה', cost: 8 },
  key: { name: 'מפתח', cost: 10 },
  ladder: { name: 'סולם', cost: 10, place: true },
  ramp: { name: 'רמפה', cost: 12, place: true },
  bridge: { name: 'גשר', cost: 16, place: true },
  spring: { name: 'קפיץ', cost: 12, place: true },
};
const GRADE_NAME = { perfect: 'מושלם', good: 'טוב', wonky: 'עקום', fail: 'גרוע' };
// (as in game/gadgets.js and game/parachute.js)
const KEY_USES = { perfect: 99, good: 8, wonky: 3, fail: 1 };
const CHUTE_SINK = { perfect: 2.6, good: 3.2, wonky: 4.6, fail: 6.5 };
// (the hero's jump: game/player.js)
const GRAVITY = 24;

// the colours it was drawn in (not the pencil's: none of its own), the most used first
function inksOf(S) {
  const len = new Map();
  for (const s of S) {
    const ink = INKS[s.c];
    if (!ink || ink.pencil) continue;
    let l = 0;
    for (let i = 1; i < s.p.length; i++) l += Math.hypot(s.p[i][0] - s.p[i - 1][0], s.p[i][1] - s.p[i - 1][1]);
    len.set(s.c, (len.get(s.c) || 0) + l);
  }
  return [...len.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => INKS[c].c.slice());
}

// the strokes y up, each with its shape (game/drawncar.js shapeOf), and all of it
function prep(S) {
  const P = S.map((s) => {
    const pts = s.p.map(([x, y]) => [x, -y]);
    return { pts, ink: s.c, sh: shapeOf(pts) };
  });
  const A = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (const o of P) {
    A.x0 = Math.min(A.x0, o.sh.x0);
    A.x1 = Math.max(A.x1, o.sh.x1);
    A.y0 = Math.min(A.y0, o.sh.y0);
    A.y1 = Math.max(A.y1, o.sh.y1);
  }
  A.w = Math.max(1e-3, A.x1 - A.x0);
  A.h = Math.max(1e-3, A.y1 - A.y0);
  A.cx = (A.x0 + A.x1) / 2;
  A.cy = (A.y0 + A.y1) / 2;
  return { P, A };
}

// how much a line bows out of the straight between its ends (or how high a closed one is for its
// width)
const bowOf = (sh) => (sh.closed ? sh.h / Math.max(1e-3, sh.w) : sh.dev);
// a line's slope (0..PI)
const angOf = (o) => {
  const p = o.pts;
  const a = Math.atan2(p[p.length - 1][1] - p[0][1], p[p.length - 1][0] - p[0][0]);
  return ((a % Math.PI) + Math.PI) % Math.PI;
};
const angDiff = (a, b) => {
  const d = Math.abs(a - b);
  return Math.min(d, Math.PI - d);
};

// the canopy of an umbrella, a parachute: the widest line up top
function canopyOf(P, A) {
  let best = null;
  for (const o of P) {
    if (o.sh.cy < A.y0 + A.h * 0.45) continue;
    if (!best || o.sh.w > best.sh.w) best = o;
  }
  return best;
}

// what the drawing is, as gear of this kind: { cat: 'gear', kind, name, grade, cost, place (put up
// somewhere rather than taken), params, line (what it does, for the tag), colors }. given: no
// drawing of its own (it came with a weapon: game/freeform.js readArmed) - a good one
export function readGear(strokes, kind, cls = null, given = false) {
  const info = GEAR[kind];
  if (!info || kind === 'shield') return null;
  const S = strokes.filter((s) => s.p.length > 1);
  const out = { cat: 'gear', kind, name: info.name, cost: info.cost, place: !!info.place, grade: 'good', params: {}, colors: inksOf(S), strokes: S, cls };
  if (!given && S.length) {
    const { P, A } = prep(S);
    const R = READ[kind](P, A, out.params);
    out.grade = R;
  } else if (kind === 'ramp') READ.ramp(null, null, out.params);
  else if (kind === 'spring') READ.spring([], null, out.params);
  out.line = lineOf(out);
  return out;
}

const READ = {
  parachute(P, A, par) {
    const c = canopyOf(P, A);
    if (!c) return 'wonky';
    const wide = c.sh.w / A.w;
    const bow = bowOf(c.sh);
    // its lines: down from the canopy (more than one in a single stroke: its turns)
    let lines = 0;
    for (const o of P) {
      if (o === c || o.sh.y1 > c.sh.y0 + c.sh.h * 0.5) continue;
      if (o.sh.h > o.sh.w * 0.5) lines += 1;
    }
    par.lines = lines;
    if (wide >= 0.65 && bow >= 0.16 && lines >= 2) return lines >= 4 ? 'perfect' : 'good';
    if (wide >= 0.5 && bow >= 0.1) return lines >= 1 ? 'good' : 'wonky';
    return 'wonky';
  },
  umbrella(P, A, par) {
    const c = canopyOf(P, A);
    if (!c) return 'wonky';
    const bow = bowOf(c.sh);
    // the handle: down from under the canopy's middle
    let handle = null;
    for (const o of P) {
      if (o === c) continue;
      if (o.sh.h > o.sh.w * 1.3 && Math.abs(o.sh.mx - c.sh.mx) < c.sh.w * 0.25 && o.sh.y0 < c.sh.y0 && (!handle || o.sh.h > handle.sh.h)) handle = o;
    }
    if (!handle) return bow >= 0.12 ? 'wonky' : 'fail';
    // a hook at its end: its lowest part goes sideways
    const low = handle.pts.filter(([, y]) => y < handle.sh.y0 + handle.sh.h * 0.25);
    let lx0 = Infinity;
    let lx1 = -Infinity;
    for (const [x] of low) {
      lx0 = Math.min(lx0, x);
      lx1 = Math.max(lx1, x);
    }
    par.hook = low.length > 2 && lx1 - lx0 > handle.sh.h * 0.12;
    if (bow >= 0.15 && c.sh.w >= A.w * 0.6) return par.hook ? 'perfect' : 'good';
    return 'wonky';
  },
  key(P, A, par) {
    // along its long way: the bow (a ring) at one end, the teeth at the other
    const along = A.w >= A.h;
    const u = (p) => (along ? p[0] : p[1]);
    const v = (p) => (along ? p[1] : p[0]);
    const u0 = along ? A.x0 : A.y0;
    const L = along ? A.w : A.h;
    let bowAt = 0;
    for (const o of P) {
      if (!o.sh.closed) continue;
      const m = (u([o.sh.mx, o.sh.my]) - u0) / L;
      if (o.sh.size < L * 0.6 && (m < 0.35 || m > 0.65)) bowAt = m < 0.5 ? -1 : 1;
    }
    par.bow = !!bowAt;
    // the teeth: how often the lines turn across at the far end
    const far = bowAt >= 0 ? (t) => t < 0.4 : (t) => t > 0.6;
    let turnsN = 0;
    for (const o of P) {
      const pts = o.pts.filter((p) => far((u(p) - u0) / L));
      if (pts.length >= 4) turnsN += turns(pts.map(v), L * 0.03);
    }
    const teeth = Math.min(6, Math.round(turnsN / 2));
    par.teeth = teeth;
    const grade = par.bow && teeth >= 3 ? 'perfect' : par.bow && teeth >= 1 ? 'good' : teeth >= 1 || par.bow ? 'wonky' : 'fail';
    par.uses = KEY_USES[grade];
    return grade;
  },
  ladder(P, A, par) {
    // the rails: the two longest lines, side by side; the rungs: short lines across them
    const long = P.slice().sort((a, b) => b.sh.len - a.sh.len);
    const big = Math.max(A.w, A.h);
    if (long.length < 2 || long[1].sh.size < big * 0.55) {
      par.rungs = 0;
      return long.length && springy(long[0].pts) >= 4 ? 'wonky' : 'fail';
    }
    const [r1, r2] = long;
    const ra = angOf(r1);
    if (angDiff(ra, angOf(r2)) > 0.45) {
      par.rungs = 0;
      return 'wonky';
    }
    const gap = Math.hypot(r1.sh.mx - r2.sh.mx, r1.sh.my - r2.sh.my);
    const rungs = P.filter((o) => o !== r1 && o !== r2 && o.sh.size < Math.max(gap * 1.8, big * 0.45) && o.sh.size > gap * 0.3 && angDiff(angOf(o), ra) > 0.8);
    par.rungs = rungs.length;
    // (evenly spaced along the rails)
    const along = rungs.map((o) => o.sh.mx * Math.cos(ra) + o.sh.my * Math.sin(ra)).sort((a, b) => a - b);
    let cv = 1;
    if (along.length >= 3) {
      const gaps = along.slice(1).map((x, i) => x - along[i]);
      const m = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - m) ** 2, 0) / gaps.length);
      cv = sd / Math.max(1e-6, m);
    }
    if (rungs.length >= 4 && cv < 0.35) return 'perfect';
    if (rungs.length >= 3) return 'good';
    return rungs.length >= 1 ? 'wonky' : 'fail';
  },
  ramp(P, A, par) {
    // as steep as it is drawn (side on: its rise over its run)
    const ratio = A ? clamp(Math.min(A.w, A.h) / Math.max(A.w, A.h), 0.12, 0.6) : 0.25;
    par.len = Math.round(clamp(6.4 - ratio * 6, 4.2, 6.2) * 100) / 100;
    par.h = Math.round(clamp(par.len * ratio, 0.7, 2.6) * 100) / 100;
    par.deg = Math.round((Math.atan2(par.h, par.len) * 180) / Math.PI);
    if (!P) return 'good';
    // a wedge drawn closed, its slope straight: the smoothest ride up
    const wedge = P.find((o) => o.sh.closed && o.sh.w >= A.w * 0.7);
    if (!wedge) return P.some((o) => o.sh.dev < 0.08 && o.sh.size > Math.max(A.w, A.h) * 0.6) ? 'good' : 'wonky';
    const straight = P.some((o) => o.sh.dev < 0.06 && o.sh.size > Math.max(A.w, A.h) * 0.6) || wedge.pts.length < 40;
    return straight ? 'perfect' : 'good';
  },
  bridge(P, A, par) {
    // its deck: a flat line all the way across
    let deck = null;
    for (const o of P) if (o.sh.w > o.sh.h * 3 && o.sh.w >= A.w * 0.7 && (!deck || o.sh.w > deck.sh.w)) deck = o;
    if (!deck) return 'wonky';
    const posts = P.filter((o) => o !== deck && o.sh.h > o.sh.w * 1.5 && o.sh.y0 >= deck.sh.y0 - A.h * 0.1).length;
    const rail = P.some((o) => o !== deck && o.sh.w > o.sh.h * 3 && o.sh.cy > deck.sh.cy + A.h * 0.08);
    const arch = P.some((o) => o !== deck && o.sh.cy < deck.sh.cy && o.sh.w > A.w * 0.4 && o.sh.dev > 0.15);
    par.posts = posts;
    if ((posts >= 2 || rail) && (arch || posts >= 4)) return 'perfect';
    if (posts >= 2 || rail || arch) return 'good';
    return deck.sh.dev < 0.08 ? 'good' : 'wonky';
  },
  spring(P, A, par) {
    // its coils (a zigzag turns back twice for each); a plate at its top: it pushes off it better
    let turnsN = 0;
    for (const o of P) turnsN = Math.max(turnsN, springy(o.pts));
    const coils = Math.round(turnsN / 2);
    const plate = A ? P.some((o) => o.sh.w > o.sh.h * 3 && o.sh.cy > A.y0 + A.h * 0.75) : false;
    par.coils = coils;
    par.power = Math.round(clamp(13 + coils * 1.5 + (plate ? 1.5 : 0), 13, 23) * 10) / 10;
    par.height = Math.round((par.power * par.power) / (2 * GRAVITY));
    if (!P.length) return 'good';
    return coils >= 5 ? 'perfect' : coils >= 3 ? 'good' : coils >= 1 ? 'wonky' : 'fail';
  },
};

// what it does, in a line (the tag)
function lineOf(R) {
  const p = R.params;
  const g = GRADE_NAME[R.grade];
  switch (R.kind) {
    case 'parachute':
      return `ירידה של ${CHUTE_SINK[R.grade]} מ׳ בשנייה · ${g}`;
    case 'umbrella':
      return `בגשם ובנפילה · ${g}`;
    case 'key':
      return `פותח ${p.uses >= 99 ? 'כל מנעול' : `${p.uses || KEY_USES[R.grade]} מנעולים`} · ${g}`;
    case 'ladder':
      return `עד הגג · ${p.rungs || 0} שלבים · ${g}`;
    case 'ramp':
      return `שיפוע ${p.deg}° · גובה ${p.h} מ׳ · ${g}`;
    case 'bridge':
      return `מגג לגג, או מהמזח · ${g}`;
    case 'spring':
      return `זינוק לגובה ${p.height} מ׳ · ${p.coils} ליפופים · ${g}`;
    default:
      return g;
  }
}
