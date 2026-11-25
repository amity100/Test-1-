import { picture, ready, chances } from './sketchnet.js';
import { PNET } from './partnet_w.js';
import { ITEMS, CATS as ITEM_CATS, CAT_ORDER as ITEM_ORDER } from './itemcat.js';
import { coverOf } from './catmatch.js';
import { svgLines } from './svglines.js';

// (ROADMAP 11.25) What is drawn for the car, of one category's things. The player says the
// category - a weapon, something it can do, protection - and draws; this tells which of that
// category's things it is, or that it is none of them. A small network of game/sketchnet.js's make,
// that learned from people's drawings (Quick, Draw!) and from drawings made for what that lacks, and
// from what is none of them (houses, trees, faces, flowers, scrawls...). Its weights are in
// game/partnet_w.js, whose head says what it learned from.
//
// (ROADMAP 11.28) Thirty-five things now (game/itemcat.js), each drawn as one or more of the network's
// thirty-three classes - one drawing, a thing in each category it is in: a flame is the flamethrower
// among the weapons and the turbo among what moves, a hook a harpoon and a grappling hook, a coil a jump
// and a Tesla coil, a rotor the drone and the helicopter's. A thing is as likely as all its classes
// together. (A car is one now: the drawn double.)

export const CATS = ITEM_CATS;
export const CAT_ORDER = ITEM_ORDER;
// each thing: the network's classes for its drawing
export const CLASS_OF = Object.fromEntries(Object.keys(ITEMS).map((id) => [id, ITEMS[id].cls]));
// less sure of it than this, and it is looked at mirrored too (as game/sketchnet.js does)
const MIRROR_BELOW = 0.8;
const G = PNET.size;
const OTHER = PNET.classes.indexOf('other');
// each thing's classes the network has (one it has not learned yet is no chance)
const IDX = Object.fromEntries(Object.keys(ITEMS).map((id) => [id, ITEMS[id].cls.map((c) => PNET.classes.indexOf(c)).filter((i) => i >= 0)]));

function mirrored(img) {
  const m = new Float32Array(G * G);
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) m[y * G + x] = img[y * G + G - 1 - x];
  return m;
}

// the drawing (strokes: arrays of [x, y], any units, y down), as one of a category's things:
// { item (null: none of them), p (how sure), none (how sure it is none of them), ranked: [[item, p],
// ...] (highest first) }
export function readItem(strokes, cat) {
  const items = CATS[cat];
  const lines = strokes.filter((s) => s && s.length);
  if (!items || !lines.length) return { item: null, p: 0, none: 1, ranked: [] };
  const sum = (p, id) => IDX[id].reduce((s, i) => s + p[i], 0);
  const share = (p) => {
    let s = p[OTHER];
    for (const id of items) s += sum(p, id);
    return s > 0 ? s : 1;
  };
  const img = picture(ready(lines));
  let p = chances(img, PNET);
  let s = share(p);
  if (Math.max(...items.map((id) => sum(p, id) / s), p[OTHER] / s) < MIRROR_BELOW) {
    const q = chances(mirrored(img), PNET);
    p = p.map((v, i) => (v + q[i]) / 2);
    s = share(p);
  }
  let ranked = items.map((id) => [id, sum(p, id) / s]).sort((a, b) => b[1] - a[1]);
  // (ROADMAP 11.43) a propeller and a bridge drawn from the side are alike to the network: a long
  // line across, lines down from it - what tells them is where those lines are
  // (the one rival the shape tells from it, whatever the network says; the others, if it is likely)
  let shape = null;
  if (cat === 'func') {
    shape = rotorOrBridge(lines);
    if (shape === 'rotor') ranked = favour(ranked, 'rotor', { bridge: 0, wing: 0.05, water: 0.05 });
    else if (shape === 'bridge') ranked = favour(ranked, 'bridge', { rotor: 0 });
  }
  const none = p[OTHER] / s;
  const [best, pb] = ranked[0];
  return { item: pb > none || best === shape ? best : null, p: pb, none, ranked };
}

// (ROADMAP 11.26) the two likeliest this near, the second at least this likely: not sure which
export const ASK_GAP = 0.3;
export const ASK_MIN = 0.2;
// none of them, but the likeliest this likely and none of them not much more: not sure either
const ASK_NONE = 0.3;
// a reading (readItem's): the two it could be, not sure which (the likelier first) - or null
export function askOf(r) {
  const [a, b] = r.ranked;
  if (!a || !b) return null;
  if (r.item && b[1] >= ASK_MIN && a[1] - b[1] < ASK_GAP) return [a[0], b[0]];
  if (!r.item && a[1] >= ASK_NONE && r.none - a[1] < ASK_GAP) return [a[0], b[0]];
  return null;
}

// (R27, the owner's word: "the game recognises what I draw far too fast, before I have finished drawing it"; "two random
// lines must never be accepted"; "sometimes I draw the thing exactly and it is not recognised") What the pen does with a
// drawing on the car when it rests (game/partpen.js). It took whatever the network thought likeliest of the category's
// things, a second after any line - a line alone, in the weapons, was a harpoon nine times in twenty; an unfinished
// drawing went on as something three times in four (tools/test-partpen.mjs). Now by how sure the reading is, and by
// whether the thing's picture - the one in the legend, the one a hand copies - is all there (allThere):
//   sure    the network all but certain of it (SURE_P), nearly nothing for "none of them", no other thing near it, and
//           its picture all there: it is named, and goes on once the pen has rested;
//   likely  less certain (or not sure which of two), its picture all there: named with a question, and it waits
//           longer before it goes on;
//   more    read as a thing, but not all of its picture is there yet - a plate's square without its cross, a
//           parachute's canopy without its ropes, a gun's outline half drawn (its shape still open): named with a
//           question, and nothing goes on by itself - the rest of it is drawn, or ✓ says "this is it";
//   wait    not sure at all, or a line or two of nothing (straight, a bow, one bend - unless they are an X, which is
//           the rotor, or close a shape with corners between them): no name, and nothing goes on by itself.
export const SURE_P = 0.9;
export const SURE_NONE = 0.1;
export const LIKELY_P = 0.6;
export const LIKELY_NONE = 0.25;

const lenOf = (s) => {
  let L = 0;
  for (let i = 1; i < s.length; i++) L += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
  return L;
};
// the corners of a line: how many turns of more than half a right angle it makes, seen coarsely (a hand's shake is none)
function turns(s) {
  const b = boxOf(s);
  const step = Math.max(b.w, b.h, 1e-6) * 0.12;
  // (a point every eighth of its size along it - between the points it was drawn with where they are far apart: a
  // fast hand leaves few, a mouse fewer, and each of them a corner)
  const P = [s[0]];
  let left = step;
  for (let i = 1; i < s.length; i++) {
    let x = s[i - 1][0];
    let y = s[i - 1][1];
    let d = Math.hypot(s[i][0] - x, s[i][1] - y);
    while (d >= left) {
      x += ((s[i][0] - x) * left) / d;
      y += ((s[i][1] - y) * left) / d;
      P.push([x, y]);
      d -= left;
      left = step;
    }
    left -= d;
  }
  const e = s[s.length - 1];
  const q = P[P.length - 1];
  if (Math.hypot(e[0] - q[0], e[1] - q[1]) > step * 0.5) P.push(e);
  let n = 0;
  let turned = 0;
  for (let i = 2; i < P.length; i++) {
    const a = Math.atan2(P[i - 1][1] - P[i - 2][1], P[i - 1][0] - P[i - 2][0]);
    const c = Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0]);
    let d = c - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    // (a bend gathered over the points it takes, then counted once; a bend the other way is another)
    const bent = Math.abs(d) > 0.25;
    if (bent && turned * d >= 0) turned += d;
    else {
      if (Math.abs(turned) > 0.8) n++;
      turned = bent ? d : 0;
    }
  }
  if (Math.abs(turned) > 0.8) n++;
  return n;
}
// a line of nothing much: straight, a bow, one bend - its ends well apart
function plainLine(s) {
  const b = boxOf(s);
  const size = Math.max(b.w, b.h, 1e-6);
  const chord = Math.hypot(s[0][0] - s[s.length - 1][0], s[0][1] - s[s.length - 1][1]);
  if (chord < size * 0.5) return false;
  return lenOf(s) <= chord * 1.3 || turns(s) <= 1;
}
// two lines that close a shape between them, end to end, and the shape has corners (a triangle drawn as a roof and a
// floor; two bows are a leaf, two lines side by side nothing): the shape as one line round - or null
const ROUND_NEAR = 0.2;
function roundOf(lines) {
  if (lines.length !== 2) return null;
  const [A, B] = lines;
  const all = boxOf(lines.flat());
  const near = Math.hypot(all.w, all.h) * ROUND_NEAR;
  const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const a0 = A[0];
  const a1 = A[A.length - 1];
  const b0 = B[0];
  const b1 = B[B.length - 1];
  const fwd = Math.max(d(a1, b0), d(b1, a0));
  const rev = Math.max(d(a1, b1), d(b0, a0));
  if (Math.min(fwd, rev) > near) return null;
  return A.concat(fwd <= rev ? B : B.slice().reverse());
}
// (the corners of a shape drawn round: a corner where the round begins is no corner to turns - so it is counted from
// two places, half a round apart)
function cornersRound(P) {
  const h = P.length >> 1;
  const R = P.slice(h).concat(P.slice(0, h));
  return Math.max(turns(P.concat([P[0], P[1]])), turns(R.concat([R[0], R[1]])));
}
// a shape not closed yet: an end of one of its lines with no other end near it (its own other end, or another
// line's - an outline drawn in two lines or three meets end to end). A line inside the shape, both its ends loose,
// leaves it as it is: an outline with something drawn in it
function openShape(lines) {
  const all = boxOf(lines.flat());
  const near = Math.hypot(all.w, all.h) * 0.2;
  const ends = [];
  lines.forEach((s, i) => ends.push([s[0], i], [s[s.length - 1], i]));
  let loose = 0;
  const lone = new Array(lines.length).fill(0);
  ends.forEach(([q, i], k) => {
    if (ends.some(([o], j) => j !== k && Math.hypot(o[0] - q[0], o[1] - q[1]) <= near)) return;
    loose++;
    lone[i]++;
  });
  // (lines with both ends loose are things drawn in it or by it - unless that is all there is)
  const inner = lone.filter((v) => v === 2).length;
  return lines.length === 1 ? loose > 0 : loose - inner * 2 > 0;
}
// a thing whose picture in the legend is one closed shape (a gun's outline, a flame, a triangle)
const CLOSED = Object.fromEntries(Object.keys(ITEMS).map((id) => [id, /^<path d="M[^M"]*Z"\/>$/.test(ITEMS[id].icon)]));

// (R27) all of a thing's picture there: its biggest line - the outline, the body - half of it at the least, and the
// lines not there no more than a sixth of its ink in all (a plate's bolts, a balloon's ropes; not its cross, not its
// basket); the drawing over most of the picture, and half of the drawing at least the picture. Each of the picture's lines by its own ink
// (game/catmatch.js coverOf, as the things drawn on foot are read): a line that only passes by another is not that one
// drawn. A hand is not a ruler - the numbers are loose (tools/test-partpen.mjs: whole drawings by a finger all there
// nineteen times in twenty, unfinished ones nearly never)
export const PIC = { main: 0.45, part: 0.4, left: 0.16, cov: 0.58, prec: 0.5 };
const pictureOf = (id) => () => svgLines(ITEMS[id].icon);
export function allThere(lines, id, cat) {
  // (the rotor is its X: the hub in the middle is the picture's, not the drawing's to make)
  if (id === 'rotor' && cat === 'func' && rotorOrBridge(lines) === 'rotor') return true;
  const C = coverOf(lines, id, pictureOf(id));
  if (!C || !C.parts.length) return false;
  let big = 0;
  for (let i = 1; i < C.parts.length; i++) if (C.parts[i].w > C.parts[big].w) big = i;
  if (C.parts[big].c < PIC.main) return false;
  let left = 0;
  for (const q of C.parts) if (q.c < PIC.part) left += q.w;
  return left <= PIC.left && C.cov >= PIC.cov && C.prec >= PIC.prec;
}

// the drawing as one of a category's things, and what the pen at rest does with it: readItem's, and { ask (the two it
// could be, not sure which), plain (a line or two of nothing), half (a closed shape's outline still open), whole (its
// picture all there), tier: 'sure' | 'likely' | 'more' | 'wait' }
// quick: while a line is being drawn - nothing is said of it then (game/partpen.js said), and whether its picture is
// all there is not looked at (tier 'more' at the most): the pen up, it is read in full
export function penSay(strokes, cat, quick = false) {
  const lines = strokes.filter((s) => s && s.length >= 2);
  const r = readItem(lines, cat);
  const ask = askOf(r);
  // (a line or two of nothing: each of them plain - but not an X, the rotor, nor two that close a shape with corners)
  const round = roundOf(lines);
  const plain = lines.length <= 2 && lines.every(plainLine) && !(cat === 'func' && rotorOrBridge(lines) === 'rotor') && !(round && cornersRound(round) >= 3);
  const certain = !!r.item && !ask && r.p >= SURE_P && r.none <= SURE_NONE;
  const likely = !!ask || (!!r.item && r.p >= LIKELY_P && r.none <= LIKELY_NONE);
  const it = r.item || (ask ? ask[0] : null);
  const half = !!it && CLOSED[it] && openShape(lines);
  let tier = 'wait';
  let whole = false;
  if (!plain && (certain || likely)) {
    whole = !quick && !half && allThere(lines, it, cat);
    tier = !whole ? 'more' : certain ? 'sure' : 'likely';
  }
  return { ...r, ask, plain, half, whole, tier };
}

// the likeliest one of rivals ({ id: how likely the network must think it at least }), and id the
// drawing's shape says it is: their chances changed round
function favour(ranked, id, rivals) {
  const top = ranked[0];
  const it = ranked.find((r) => r[0] === id);
  if (!it || top[0] === id || !(top[0] in rivals) || it[1] < rivals[top[0]]) return ranked;
  const out = ranked.map((r) => (r === top ? [r[0], it[1]] : r === it ? [r[0], top[1]] : r));
  return out.sort((a, b) => b[1] - a[1]);
}

function boxOf(s) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of s) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
}

// a line's height (y down) where it is at x: its point nearest across
function yAt(s, x) {
  let best = s[0];
  for (const q of s) if (Math.abs(q[0] - x) < Math.abs(best[0] - x)) best = q;
  return best[1];
}

// how far along a line (0..1) each of its points is
function along(s) {
  const out = [0];
  for (let i = 1; i < s.length; i++) out.push(out[i - 1] + Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]));
  const L = out[out.length - 1] || 1;
  return out.map((v) => v / L);
}

// two lines crossing, both about their middles (an X, a +): where along each, or null
function crossAt(a, b) {
  const ta = along(a);
  const tb = along(b);
  for (let i = 1; i < a.length; i++) {
    const [p0, p1] = [a[i - 1], a[i]];
    for (let j = 1; j < b.length; j++) {
      const [q0, q1] = [b[j - 1], b[j]];
      const rx = p1[0] - p0[0];
      const ry = p1[1] - p0[1];
      const sx = q1[0] - q0[0];
      const sy = q1[1] - q0[1];
      const d = rx * sy - ry * sx;
      if (Math.abs(d) < 1e-9) continue;
      const u = ((q0[0] - p0[0]) * sy - (q0[1] - p0[1]) * sx) / d;
      const v = ((q0[0] - p0[0]) * ry - (q0[1] - p0[1]) * rx) / d;
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) return [ta[i - 1] + (ta[i] - ta[i - 1]) * u, tb[j - 1] + (tb[j] - tb[j - 1]) * v];
    }
  }
  return null;
}

const closedLine = (s, b) => Math.hypot(s[0][0] - s[s.length - 1][0], s[0][1] - s[s.length - 1][1]) <= Math.max(b.w, b.h) * 0.35;

// (ROADMAP 11.43) a propeller (its mast one, at its middle - or a hub there, or two blades crossed
// at their middles with no rim round them: that is a wheel) or a bridge (on two piers or more, apart,
// or an arch under its deck); null: the shape does not say
export function rotorOrBridge(lines) {
  const S = lines.filter((s) => s.length > 1);
  if (!S.length) return null;
  const B = S.map(boxOf);
  const all = boxOf(S.flat());
  const size = Math.max(all.w, all.h, 1e-6);
  let k = 0;
  for (let i = 1; i < B.length; i++) if (B[i].w > B[k].w) k = i;
  const D = B[k];
  const L = D.w;
  // crossed blades
  const rim = S.some((s, i) => closedLine(s, B[i]) && Math.max(B[i].w, B[i].h) >= size * 0.6);
  if (!rim) {
    const long = S.filter((s, i) => Math.max(B[i].w, B[i].h) >= size * 0.5);
    // (crossed, not touching: their ways apart by a third of a right angle at least)
    const way = (s) => Math.atan2(s[s.length - 1][1] - s[0][1], s[s.length - 1][0] - s[0][0]);
    const apart = (a, b) => {
      const d = Math.abs(way(a) - way(b)) % Math.PI;
      return Math.min(d, Math.PI - d) > 0.6;
    };
    for (let i = 0; i < long.length; i++) {
      for (let j = i + 1; j < long.length; j++) {
        if (!apart(long[i], long[j])) continue;
        const c = crossAt(long[i], long[j]);
        if (c && c[0] > 0.3 && c[0] < 0.7 && c[1] > 0.3 && c[1] < 0.7) return 'rotor';
      }
    }
  }
  // a long line across: a blade, or a deck
  if (L < size * 0.5 || D.h > L * 0.45) return null;
  const cx = (D.x0 + D.x1) / 2;
  const supports = [];
  let hub = false;
  let arch = false;
  for (let i = 0; i < S.length; i++) {
    if (i === k) continue;
    const b = B[i];
    const s = S[i];
    if (b.h >= b.w * 1.5 && b.h >= L * 0.12) {
      // a line down from it: its top end by the line across, its other end below it
      const top = s[0][1] < s[s.length - 1][1] ? s[0] : s[s.length - 1];
      if (top[0] >= D.x0 - L * 0.05 && top[0] <= D.x1 + L * 0.05 && Math.abs(top[1] - yAt(S[k], top[0])) <= L * 0.12 && b.y1 > top[1] + L * 0.1) supports.push(top[0]);
      continue;
    }
    const bx = (b.x0 + b.x1) / 2;
    const by = (b.y0 + b.y1) / 2;
    if (closedLine(s, b) && Math.max(b.w, b.h) <= L * 0.25 && Math.abs(bx - cx) <= L * 0.22 && Math.abs(by - yAt(S[k], bx)) <= L * 0.15) {
      hub = true;
      continue;
    }
    // an arch: wide, under the line across, its middle higher than its ends
    if (b.w >= L * 0.5 && b.y0 >= D.y0 - L * 0.02 && b.h >= L * 0.08) {
      const mid = s[Math.floor(s.length / 2)][1];
      if (mid < (s[0][1] + s[s.length - 1][1]) / 2 - L * 0.06) arch = true;
    }
  }
  const spread = supports.length ? Math.max(...supports) - Math.min(...supports) : 0;
  const central = supports.length > 0 && supports.length <= 2 && supports.every((x) => Math.abs(x - cx) <= L * 0.22);
  const bridge = (supports.length >= 2 && spread >= L * 0.4) || arch;
  const rotor = central || hub;
  if (rotor && !bridge) return 'rotor';
  if (bridge && !rotor) return 'bridge';
  return null;
}
