import { shapeOf, springy, outline, inPoly, spanAt, turns } from './drawncar.js';
import { PGrid, simplifyLoop } from './partgrid.js';

// (ROADMAP 11.10) What each line drawn is: a part - and what the thing does is the parts added up,
// nothing else (ui/freedraw.js shows each part's name by it as it is drawn; a tap on the name
// changes it). Two kinds of thing are made of parts:
//   - a ride: a body, and what moves it - wheels (it drives), a rotor (it hovers), wings with a
//     propeller or a jet (it flies; wings alone, it glides), a sail or a floating hull (it sails), a
//     balloon (it rises) - and what else is on it: barrels (each one fires), a blade (it rams), a
//     spring (it jumps), a parachute (opened in the air), armour
//   - a thing for the hand: a grip (it is held), and on it barrels (each fires), a blade (it cuts;
//     on a gun, it stabs too), a head (it smashes), a magazine, a sight, a stock, a spring, a
//     parachute
// (parts 2) How it is read, as people really draw (tens of thousands of their drawings - Quick,
// Draw! - were read to make it so): first what kind of thing it is drawn as - a car, a helicopter, a
// plane (from the side, or from above as most draw one), a balloon, a boat - each kind with its own
// build, what game/sketchnet.js sees in it and what the player said they draw (ROADMAP 11.8) saying
// which are likely; then each line by where it is in that build. The body is what the lines close
// round, however many lines it was drawn in (game/partgrid.js) - a van drawn as four lines is a box,
// not four parts - and the wheels are what is round (or half round, or scribbled) along its bottom.
// What the build has no place for is what was added to it: a barrel out of its front, a rotor over
// it - said only when it is plainly that (a round window is no balloon, a roof line no rotor).
// Strokes in the drawing's units (x right, y down), steadied (game/inkclean.js). Read in a frame of
// its own: as wide as a car is long (4.5), y up, its front to the right (a mirror if it faces left).

export const PART = {
  body: { name: 'גוף', role: 'body' },
  cabin: { name: 'תא', role: 'body' },
  hull: { name: 'גוף צף', role: 'water' },
  frame: { name: 'שלדה', role: 'body' },
  wheel: { name: 'גלגל', role: 'move' },
  barrel: { name: 'קנה', role: 'fire' },
  blade: { name: 'להב', role: 'fire' },
  head: { name: 'ראש פטיש', role: 'fire' },
  grip: { name: 'ידית', role: 'hand' },
  mag: { name: 'מחסנית', role: 'fire' },
  scope: { name: 'כוונת', role: 'fire' },
  stock: { name: 'קת', role: 'hand' },
  guard: { name: 'מגן יד', role: 'hand' },
  wing: { name: 'כנף', role: 'air' },
  rotor: { name: 'רוטור', role: 'air' },
  prop: { name: 'מדחף', role: 'air' },
  jet: { name: 'מנוע סילון', role: 'move' },
  fin: { name: 'זנב', role: 'air' },
  mast: { name: 'תורן', role: 'deco' },
  sail: { name: 'מפרש', role: 'water' },
  balloon: { name: 'בלון', role: 'air' },
  rope: { name: 'חבל', role: 'deco' },
  chute: { name: 'מצנח', role: 'gear' },
  spring: { name: 'קפיץ', role: 'gear' },
  armor: { name: 'שריון', role: 'gear' },
  window: { name: 'חלון', role: 'deco' },
  silencer: { name: 'משתיק', role: 'fire' },
  tail: { name: 'זנב', role: 'air' },
  skid: { name: 'מגלש', role: 'deco' },
  deco: { name: 'קישוט', role: 'deco' },
};

// the parts that only a ride has, and only a thing for the hand
const RIDE_ONLY = new Set(['wheel', 'rotor', 'wing', 'prop', 'jet', 'fin', 'tail', 'skid', 'sail', 'balloon', 'hull', 'cabin', 'window', 'mast', 'rope', 'frame']);
const HAND_ONLY = new Set(['grip', 'mag', 'scope', 'stock', 'guard', 'head', 'silencer']);
// (ROADMAP 11.12) what makes it a thing held in the hand whatever it is (a ride's sight, its hammer's
// head, its silencer: a ride's still); what makes a thing for the hand a ride (its wings, a
// propeller on it: a weapon's still)
export const HELD = new Set(['grip', 'stock', 'guard']);
export const RIDES_IT = new Set(['wheel', 'rotor', 'sail', 'balloon', 'hull', 'cabin']);
// what a body is made of (the player's say: these go into it)
const BODYISH = new Set(['body', 'cabin', 'hull', 'frame']);

const FRAME_W = 4.5;

// ------------------------------------------------------------------ a line's own measures
// (x forward, y up, in the frame's units; for a line: its length along it, how slanted, how thick)
function measure(pts, kind, raw = null) {
  const sh = shapeOf(pts);
  // (steadied, game/inkclean.js: it knows - a polygon has corners, a circle none)
  if (kind === 'poly' || kind === 'line') sh.round = false;
  else if (sh.closed && (kind === 'circle' || (kind === 'ellipse' && sh.w < sh.h * 1.4 && sh.h < sh.w * 1.4))) sh.round = true;
  sh.endGap = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  // its long way (the line through it that it is longest along)
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const [x, y] of pts) {
    sxx += (x - sh.cx) ** 2;
    sxy += (x - sh.cx) * (y - sh.cy);
    syy += (y - sh.cy) ** 2;
  }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  let a0 = Infinity;
  let a1 = -Infinity;
  let b0 = Infinity;
  let b1 = -Infinity;
  for (const [x, y] of pts) {
    const a = (x - sh.cx) * ux + (y - sh.cy) * uy;
    const b = -(x - sh.cx) * uy + (y - sh.cy) * ux;
    a0 = Math.min(a0, a);
    a1 = Math.max(a1, a);
    b0 = Math.min(b0, b);
    b1 = Math.max(b1, b);
  }
  sh.long = a1 - a0;
  sh.thick = b1 - b0;
  // (level: 0, upright: pi/2)
  sh.slant = Math.abs(Math.atan2(Math.abs(uy), Math.abs(ux)));
  sh.thin = sh.long / Math.max(1e-6, sh.thick);
  sh.ux = ux;
  sh.uy = uy;
  // straight: a line, or a long thin closed one
  sh.straight = (!sh.closed && sh.dev < 0.12) || (sh.closed && sh.thin > 3.2) || (!sh.closed && sh.thin > 4.5);
  // pointed: thick at one end and coming to a point at the other (a blade, a sail's top)
  sh.point = 0;
  if (sh.long > 0) {
    const N = 6;
    const wid = new Array(N).fill(0).map(() => [Infinity, -Infinity]);
    for (const [x, y] of pts) {
      const a = (x - sh.cx) * ux + (y - sh.cy) * uy;
      const b = -(x - sh.cx) * uy + (y - sh.cy) * ux;
      const k = Math.min(N - 1, Math.max(0, Math.floor(((a - a0) / (a1 - a0 || 1)) * N)));
      wid[k][0] = Math.min(wid[k][0], b);
      wid[k][1] = Math.max(wid[k][1], b);
    }
    const w = wid.map(([lo, hi]) => (hi >= lo ? hi - lo : 0));
    const end0 = w[0];
    const end1 = w[N - 1];
    const mid = Math.max(...w.slice(1, N - 1));
    // (which end the point is at, along the long way: -1 the start, 1 the end)
    sh.point = sh.closed && mid > 0 && Math.min(end0, end1) < mid * 0.35 && Math.max(end0, end1) > mid * 0.6 ? (end1 < end0 ? 1 : -1) : 0;
    sh.tipX = sh.cx + ux * (sh.point > 0 ? a1 : a0);
    sh.tipY = sh.cy + uy * (sh.point > 0 ? a1 : a0);
  }
  // a dome: an arc bulging up (its ends lower than its middle) - or a closed half-round
  sh.dome = false;
  if (!sh.closed && pts.length > 4 && sh.w > sh.h * 1.2) {
    const m = pts.reduce((a, p) => (p[1] > a[1] ? p : a), pts[0]);
    const ends = Math.max(pts[0][1], pts[pts.length - 1][1]);
    sh.dome = m[1] - ends > Math.max(sh.h * 0.55, sh.w * 0.14) && m[0] > sh.x0 + sh.w * 0.2 && m[0] < sh.x1 - sh.w * 0.2;
  } else if (sh.closed && sh.w > sh.h * 1.3) {
    // (the flat side down: its widest low, rounded on top)
    let lowW = 0;
    let highW = 0;
    for (const [x, y] of pts) {
      if (y < sh.y0 + sh.h * 0.2) lowW = Math.max(lowW, Math.abs(x - sh.mx));
      if (y > sh.y1 - sh.h * 0.2) highW = Math.max(highW, Math.abs(x - sh.mx));
    }
    sh.dome = lowW > sh.w * 0.4 && highW < sh.w * 0.3;
  }
  sh.coils = springy(pts);
  // how often it turns back across its long way (a wave: again and again; a line: never)
  sh.wiggle = sh.closed ? 0 : turns(pts.map(([x, y]) => -(x - sh.cx) * uy + (y - sh.cy) * ux), Math.max(sh.thick * 0.22, sh.long * 0.02));
  // how much of its box it fills, an open one closed between its ends (a sail standing on a deck, a
  // cabin: a triangle about half, a box all of it)
  {
    let a = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
    sh.cfill = Math.abs(a) / 2 / Math.max(1e-6, sh.w * sh.h);
  }
  // how much of its box it fills (a triangle about half, a box all of it)
  sh.fill = sh.closed ? sh.area / Math.max(1e-6, sh.w * sh.h) : 0;
  // round enough for a wheel, drawn quickly: an oval, or most of one (an arc right round past
  // half of it) - not a box (its corners: too far out for an oval)
  sh.roundish = !!sh.round;
  sh.cover = 0;
  if (!sh.round && kind !== 'poly' && kind !== 'line' && pts.length > 6) {
    const ax = Math.max(1e-6, sh.w / 2);
    const ay = Math.max(1e-6, sh.h / 2);
    let m = 0;
    let m2 = 0;
    const ang2 = [];
    for (const [x, y] of pts) {
      const d = Math.hypot((x - sh.mx) / ax, (y - sh.my) / ay);
      m += d;
      m2 += d * d;
      ang2.push(Math.atan2(y - sh.my, x - sh.mx));
    }
    m /= pts.length;
    const cv = Math.sqrt(Math.max(0, m2 / pts.length - m * m)) / Math.max(1e-6, m);
    ang2.sort((a, b) => a - b);
    let gap = ang2[0] + Math.PI * 2 - ang2[ang2.length - 1];
    for (let i = 1; i < ang2.length; i++) gap = Math.max(gap, ang2[i] - ang2[i - 1]);
    const cover = Math.PI * 2 - gap;
    sh.cover = cover;
    sh.ecv = cv;
    const aspect = Math.max(sh.w, sh.h) / Math.max(1e-6, Math.min(sh.w, sh.h));
    sh.roundish = aspect < 2.3 && (sh.closed ? cv < 0.13 && sh.fill > 0.6 && sh.fill < 0.9 : cv < 0.1 && cover > 3.7);
  }
  // half a wheel, hanging from the body as it is often drawn - an arc round the middle of its two
  // ends, bulging down: a whole wheel there
  if (!sh.closed && pts.length > 6) {
    const [ax, ay] = pts[0];
    const [bx, by] = pts[pts.length - 1];
    const cx = (ax + bx) / 2;
    const cy = (ay + by) / 2;
    const r = Math.hypot(bx - ax, by - ay) / 2;
    if (r > 1e-3) {
      let m = 0;
      let m2 = 0;
      for (const [x, y] of pts) {
        const d = Math.hypot(x - cx, y - cy) / r;
        m += d;
        m2 += d * d;
      }
      m /= pts.length;
      const cv = Math.sqrt(Math.max(0, m2 / pts.length - m * m));
      const mid = pts[Math.floor(pts.length / 2)];
      if (cv < 0.28 && m > 0.55 && m < 1.4 && mid[1] < cy - r * 0.45 && Math.abs(ay - by) < r * 0.9) sh.cup = { cx, cy, r: r * Math.max(0.9, Math.min(1.15, m)) };
    }
  }
  // drawn over and over (a wheel scribbled in, a cloud of smoke): far more line than its box
  sh.scribble = sh.len > (sh.w + sh.h) * 2.6 && Math.min(sh.w, sh.h) > Math.max(sh.w, sh.h) * 0.35;
  // the circle it is (part of): its middle, its radius, how far it strays from it, how much of it
  // goes round - a wheel drawn as a U, a C, most of a circle, is one. (As the hand drew it: a quick
  // round one may have been steadied into a few straight sides)
  sh.fit = circleFit(raw || pts);
  if (raw && kind === 'poly') {
    const f2 = circleFit(pts);
    if (f2 && sh.fit && f2.err < sh.fit.err) sh.fit = f2;
  }
  return sh;
}

// (the circle nearest a line: least squares, Kasa's way) { cx, cy, r, err (for its radius), cover
// (how far round it goes, radians) } - or null
function circleFit(pts) {
  const n = pts.length;
  if (n < 6) return null;
  let mx = 0;
  let my = 0;
  for (const [x, y] of pts) {
    mx += x;
    my += y;
  }
  mx /= n;
  my /= n;
  let suu = 0;
  let svv = 0;
  let suv = 0;
  let suuu = 0;
  let svvv = 0;
  let suvv = 0;
  let svuu = 0;
  for (const [x, y] of pts) {
    const u = x - mx;
    const v = y - my;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-12) return null;
  const a = (suuu + suvv) / 2;
  const b = (svvv + svuu) / 2;
  const uc = (a * svv - b * suv) / det;
  const vc = (b * suu - a * suv) / det;
  const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
  if (!(r > 1e-6) || !isFinite(r)) return null;
  const cx = uc + mx;
  const cy = vc + my;
  let e = 0;
  const ang = [];
  for (const [x, y] of pts) {
    const d = Math.hypot(x - cx, y - cy) - r;
    e += d * d;
    ang.push(Math.atan2(y - cy, x - cx));
  }
  ang.sort((p, q) => p - q);
  let gap = ang[0] + Math.PI * 2 - ang[ang.length - 1];
  for (let i = 1; i < ang.length; i++) gap = Math.max(gap, ang[i] - ang[i - 1]);
  return { cx, cy, r, err: Math.sqrt(e / n) / r, cover: Math.PI * 2 - gap };
}

// ------------------------------------------------------------------ against the body
// the body: what the lines `use` close round - the thick of it (thin lines out of it - a barrel, a
// rotor, a mast - are not body), its biggest piece. Its edge, how far each cell is from it, its
// outline (the frame's units), its measures
function region(G, use, r = 2, along = false) {
  if (!use.length) return null;
  // (a line drawn round to near where it began: closed, as it was meant)
  const P = use.map((o) => (o.sh.closed && o.sh.endGap > 0 ? o.pts.concat([o.pts[0]]) : o.pts));
  let best = null;
  for (const rr of [r, r + 2]) {
    const solid = G.solid(P, rr);
    const core = G.open(solid, 2);
    const pcs = G.pieces(core);
    if (pcs.length && pcs[0].n >= 14) {
      best = { pcs, solid };
      break;
    }
  }
  // (a body drawn as an arch over its wheels, its bottom not drawn: closed along it - when nothing
  // else closes; or, said so (along: game/parts.js parseGround), when what does is a small part of
  // it all - ROADMAP 11.11)
  const big = Math.max(...use.map((o) => o.sh.size));
  const arch = (o) => !o.sh.closed && o.sh.size > big * 0.5 && o.sh.endGap < o.sh.size * 1.05 && o.sh.dev > 0.07;
  if (!best || (along && use.some(arch))) {
    const P2 = use.map((o) => (arch(o) || o.sh.closed ? o.pts.concat([o.pts[0]]) : o.pts));
    const solid = G.solid(P2, r + 1);
    const core = G.open(solid, 2);
    const pcs = G.pieces(core);
    if (pcs.length && pcs[0].n >= 14 && (!best || pcs[0].n > best.pcs[0].n * 2)) best = { pcs, solid };
  }
  if (!best) return null;
  const piece = best.pcs[0];
  const g = G.only(piece);
  const dm = G.dist(g);
  const loop = simplifyLoop(G.outline(g), G.cell * 0.55);
  if (loop.length < 3) return null;
  const sh = shapeOf(loop.concat([loop[0]]));
  sh.area = piece.n * G.cell * G.cell;
  return { g, dm, loop, sh, piece, pieces: best.pcs };
}

// a line against the body: how much of it is on the body's edge, inside it, out of it; how near it
// comes (0: it touches), how far out it goes (the frame's units)
function relate(G, R, o) {
  let fe = 0;
  let fi = 0;
  let fo = 0;
  let near = Infinity;
  let far = 0;
  const tol = 2.2;
  for (const [x, y] of o.pts) {
    const k = G.at(x, y);
    const d = k < 0 ? -99 : R.dm[k];
    if (d > tol) fi++;
    else if (d >= -tol) fe++;
    else fo++;
    near = Math.min(near, Math.max(0, -d - tol));
    far = Math.max(far, -d);
  }
  const n = Math.max(1, o.pts.length);
  return { fe: fe / n, fi: fi / n, fo: fo / n, gap: near * G.cell, far: far * G.cell };
}

// (across the outline o at the height y: how wide it is there)
function widthAt(o, y) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const [xa, ya] = o[j];
    const [xb, yb] = o[i];
    if ((ya <= y && yb >= y) || (yb <= y && ya >= y)) {
      const t = Math.abs(yb - ya) < 1e-9 ? 0.5 : (y - ya) / (yb - ya);
      const x = xa + (xb - xa) * t;
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
  }
  return hi >= lo ? hi - lo : 0;
}

// how much of a line is inside a circle
function inCircle(pts, c, k = 1.08) {
  let n = 0;
  for (const [x, y] of pts) if (Math.hypot(x - c.cx, y - c.cy) <= c.r * k) n++;
  return n / Math.max(1, pts.length);
}

// ------------------------------------------------------------------ wheels
// what could be a wheel: round, or nearly (an oval, most of one, a circle not quite closed, a
// scribbled-in one), or half of one hanging from the body - not too big, not too small. A small one
// in a bigger one is its hub
function wheelCands(st, D, over) {
  const out = [];
  for (const o of st) {
    if (over[o.i] && over[o.i] !== 'wheel') continue;
    const sh = o.sh;
    const size = Math.max(sh.w, sh.h);
    const aspect = size / Math.max(1e-6, Math.min(sh.w, sh.h));
    if (size < D.w * 0.04 || size > D.w * 0.62) continue;
    let c = null;
    let q = 0;
    const f = sh.fit;
    // (its lowest point: an arc over the top of a circle - a dome, a roof, a parachute - is no wheel)
    const low = f ? Math.min(...o.pts.map((q) => q[1])) : 0;
    if (!sh.closed && f && (f.err < 0.16 ? f.cover > 2.5 : f.err < 0.25 && f.cover > 3.1) && f.r * 2 > D.w * 0.05 && f.r * 2 < D.w * 0.6 && !sh.scribble && low < f.cy - f.r * 0.2) {
      // (a U, a C, most of a circle: the wheel it goes round)
      c = { cx: f.cx, cy: f.cy, r: f.r };
      q = 0.6 + 0.3 * Math.min(1, f.cover / 5.5) - f.err;
    } else if (sh.cup && !sh.closed && aspect > 1.4) {
      c = { cx: sh.cup.cx, cy: sh.cup.cy, r: sh.cup.r };
      q = 0.7;
    } else if (aspect <= 2.4) {
      const shut = sh.closed || sh.endGap < size * 0.42;
      // (round and round: a spiral, a loop drawn twice)
      const loops = !sh.closed && sh.cover > 5.5 && aspect <= 1.8 && sh.len > size * 2.4;
      if (shut || sh.scribble || sh.roundish || loops || (sh.cover > 4.4 && sh.ecv < 0.18)) {
        c = { cx: sh.mx, cy: sh.my, r: (sh.w + sh.h) / 4 };
        q = sh.round ? 1 : sh.roundish ? 0.9 : sh.scribble || loops ? 0.8 : sh.closed ? 0.62 : 0.55;
        if (aspect > 1.7) q *= 0.75;
        // (a box is no wheel: its corners out to its box's)
        if (sh.closed && sh.fill > 0.9) q *= 0.6;
      } else if (sh.cup) {
        c = { cx: sh.cup.cx, cy: sh.cup.cy, r: sh.cup.r };
        q = 0.6;
      }
    }
    if (over[o.i] === 'wheel' && !c) {
      c = { cx: sh.mx, cy: sh.my, r: (sh.w + sh.h) / 4 };
      q = 1;
    }
    if (c) out.push({ o, ...c, y0: c.cy - c.r, q: over[o.i] === 'wheel' ? 2 : q });
  }
  const hub = (c) => out.some((d) => d !== c && d.r > c.r * 1.35 && Math.hypot(d.cx - c.cx, d.cy - c.cy) < d.r * 0.75);
  return out.filter((c) => !hub(c) || over[c.o.i] === 'wheel');
}

// the wheels it stands on: of what could be, those along its bottom, alike - as many as fit
function wheelSet(cands, D) {
  const low = cands.filter((c) => c.q >= 2 || (c.y0 < D.y0 + D.h * 0.34 && c.cy < D.y0 + D.h * 0.56));
  let best = [];
  let bestS = 0;
  const byQ = low.slice().sort((a, b) => b.q - a.q);
  for (const seed of byQ) {
    const set = [seed];
    for (const c of byQ) {
      if (c === seed) continue;
      const ok = set.every((w) => {
        const big = Math.max(c.r, w.r);
        const ratio = big / Math.max(1e-6, Math.min(c.r, w.r));
        return ratio < 2.8 && Math.abs(c.y0 - w.y0) < big * 0.75 + D.h * 0.05 && Math.abs(c.cx - w.cx) > (c.r + w.r) * 0.72;
      });
      if (ok) set.push(c);
    }
    const s = set.reduce((a, c) => a + c.q, 0) + (set.length >= 2 ? 1.2 : 0);
    if (s > bestS) {
      bestS = s;
      best = set;
    }
  }
  // (one alone: a wheel only if it is surely one - or likely, and down at the bottom)
  if (best.length === 1 && best[0].q < 0.8 && !(best[0].q >= 0.55 && best[0].y0 < D.y0 + D.h * 0.12)) return [];
  return best.slice(0, 8);
}

// a body drawn with its wheels in its outline: its wheel arches - the bottom edge up over a wheel
// and down again - and wheels drawn as bulges under it, the edge round down and back up (ROADMAP
// 11.11). Each by its own rise and fall, not by the bottom edge's level overall: a raised bumper at
// an end is no arch. Its bottom edge as the outline has it - or as its lines are drawn, when the
// outline is closed across under an arch (body: the body's lines). [{ x, y, r }], the frame's units
function archesOf(ol, B, wheels, body = []) {
  const N = 96;
  const across = (box) => {
    const xs = [];
    for (let i = 0; i < N; i++) xs.push(box.x0 + box.w * (0.01 + (0.98 * i) / (N - 1)));
    return xs;
  };
  // (a long body: not a star, not a cloud)
  let a = [];
  if (ol && B.w >= B.h * 1.2) {
    const xs = across(B);
    a = bumpsOf(xs.map((x) => {
      const sp = spanAt(ol, x);
      return sp ? sp[0] : null;
    }), xs, B, wheels);
  }
  if (a.length + wheels.length >= 2 || !body.length) return a;
  // (as its lines are drawn: the lowest of them at each place along all of them - how high a bump
  // is, for the body's height)
  let x0 = B.x0;
  let x1 = B.x1;
  for (const pts of body) {
    for (const [x] of pts) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    }
  }
  const Bl = { x0, x1, y0: B.y0, y1: B.y1, w: x1 - x0, h: B.h };
  if (!(Bl.w >= Bl.h * 1.2)) return a;
  const xs = across(Bl);
  const lows = new Array(N).fill(null);
  for (const pts of body) {
    for (let j = 1; j < pts.length; j++) {
      const [xa, ya] = pts[j - 1];
      const [xb, yb] = pts[j];
      const i0 = Math.max(0, Math.ceil(((Math.min(xa, xb) - Bl.x0) / Bl.w - 0.01) * ((N - 1) / 0.98)));
      const i1 = Math.min(N - 1, Math.floor(((Math.max(xa, xb) - Bl.x0) / Bl.w - 0.01) * ((N - 1) / 0.98)));
      for (let i = i0; i <= i1; i++) {
        const y = Math.abs(xb - xa) < 1e-9 ? Math.min(ya, yb) : ya + ((yb - ya) * (xs[i] - xa)) / (xb - xa);
        if (lows[i] === null || y < lows[i]) lows[i] = y;
      }
    }
  }
  const b = bumpsOf(lows, xs, Bl, wheels);
  return b.length + wheels.length >= 2 ? b : a;
}

// the wheels in a bottom edge (lows: its height at each of xs, null where there is none)
function bumpsOf(lows, xs, B, wheels) {
  const N = xs.length;
  if (lows.filter((v) => v !== null).length < N * 0.6) return [];
  // (steadied a little: a shaky line's jitter is no bump)
  const L = lows.map((v, i) => {
    if (v === null) return null;
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - 1); j <= Math.min(N - 1, i + 1); j++) {
      if (lows[j] === null) continue;
      sum += lows[j];
      n++;
    }
    return sum / n;
  });
  const maxW = Math.round(N * 0.36);
  const step = xs[1] - xs[0];
  const first = L.findIndex((v) => v !== null);
  const last = N - 1 - L.slice().reverse().findIndex((v) => v !== null);
  const cands = [];
  // (up: an arch, the edge up over a wheel; down: a bulge, the edge round under one)
  for (const up of [1, -1]) {
    const v = (i) => (i < 0 || i >= N || L[i] === null ? null : L[i] * up);
    for (let p = 1; p < N - 1; p++) {
      const vp = v(p);
      if (vp === null) continue;
      // (the top of it: none higher near it)
      let top = true;
      for (let j = p - 2; j <= p + 2 && top; j++) if (j !== p && v(j) !== null && v(j) > vp + 1e-9) top = false;
      if (!top) continue;
      // (down again on both sides of it - each within a wheel's width or so)
      let lo0 = Infinity;
      let lo1 = Infinity;
      for (let j = Math.max(0, p - maxW); j < p; j++) if (v(j) !== null) lo0 = Math.min(lo0, v(j));
      for (let j = p + 1; j <= Math.min(N - 1, p + maxW); j++) if (v(j) !== null) lo1 = Math.min(lo1, v(j));
      let foot = Math.max(lo0, lo1);
      let prom = vp - foot;
      // (an arch at an end - a bumper drawn high: well down on its inner side, and down a little
      // toward its end)
      let end = false;
      if (up > 0 && prom < B.h * 0.06) {
        const front = p < N / 2;
        const inner = front ? lo1 : lo0;
        const drop = vp - v(front ? first : last);
        if (vp - inner > B.h * 0.1 && drop > Math.max(B.h * 0.04, (vp - inner) * 0.15)) {
          foot = inner;
          prom = vp - inner;
          end = true;
        }
      }
      if (!(prom > B.h * 0.035)) continue;
      // (as wide as it is, at its foot)
      let a = p;
      let b = p;
      while (a > 0 && v(a - 1) !== null && v(a - 1) > foot + prom * 0.2) a--;
      while (b < N - 1 && v(b + 1) !== null && v(b + 1) > foot + prom * 0.2) b++;
      const w = (b - a + 1) * step;
      if (w < B.w * 0.06 || w > B.w * 0.38 || (!end && (a <= first || b >= last))) continue;
      // (round, not a long gentle sag of its bottom; an arch no higher than most of the body)
      if (prom < w * 0.08) continue;
      if (up > 0 && vp > B.y0 + B.h * 0.7) continue;
      const sure = prom > B.h * 0.06 && prom >= w * (up > 0 ? 0.15 : 0.2);
      cands.push({ up, p, a, b, w, prom, sure, peak: vp * up, x: (xs[a] + xs[b]) / 2 });
    }
  }
  // (the clearest first, none over another - and with one only, its pair: a car has two wheels
  // side on, the other one's arch drawn shallower maybe, about as wide, a wheel or more apart)
  cands.sort((q, r) => r.prom / r.w - q.prom / q.w);
  const over = (c, t) => c.a <= t.b && c.b >= t.a;
  const pick = (list) => {
    const took = [];
    for (const c of list) if (c.sure && !took.some((t) => over(c, t))) took.push(c);
    if (took.length === 1 && !wheels.length) {
      const t = took[0];
      const pair = list.find((c) => !c.sure && !over(c, t) && Math.abs(c.x - t.x) > t.w * 1.6 && c.w > t.w * 0.4 && c.w < t.w * 2.5);
      if (pair) took.push(pair);
    }
    return took;
  };
  // (arches, or bulges - the bottom between two bulges is no arch, nor between two arches a bulge:
  // whichever makes its wheels, the clearer; neither alone, both)
  const ups = pick(cands.filter((c) => c.up > 0));
  const downs = pick(cands.filter((c) => c.up < 0));
  const n = (t) => t.length + wheels.length;
  const clear = (t) => t.reduce((sum, c) => sum + c.prom / c.w, 0);
  let took;
  if (n(ups) >= 2 && n(downs) >= 2) took = clear(ups) >= clear(downs) ? ups : downs;
  else if (n(ups) >= 2) took = ups;
  else if (n(downs) >= 2) took = downs;
  else took = ups.concat(downs.filter((c) => !ups.some((t) => over(c, t))));
  const out = [];
  for (const c of took) {
    let r;
    let y;
    if (c.up > 0) {
      // (an arch: the wheel up in it, its top at the arch's)
      r = Math.max(c.w * 0.47, Math.min(c.prom, c.w * 0.6));
      y = c.peak - r * 0.98;
    } else {
      // (a bulge: the wheel it goes round, its bottom at the bulge's)
      r = Math.max(c.w * 0.5, Math.min(c.prom, c.w * 0.7));
      y = c.peak + r;
    }
    if (!wheels.some((o) => Math.abs(o.cx - c.x) < r * 1.2)) out.push({ x: c.x, y, r });
  }
  // (two wheels at least, with what is drawn: one bump is no car - and a wavy line, many, none)
  return out.length + wheels.length >= 2 && took.length <= 4 ? out : [];
}

// ------------------------------------------------------------------ what was added to it
// how far a line's end stands clear over the body's top - its muzzle out over a hood, past a front
// (all the way); lights, a rack on a roof sit on it at both ends
function clearOf(pts, R) {
  const B = R.sh;
  const at = ([x, y]) => {
    const sp = R.loop ? spanAt(R.loop, x) : null;
    if (!sp && (x < B.x0 || x > B.x1)) return Infinity;
    return y - (sp ? sp[1] : B.y1);
  };
  const n = pts.length;
  const k = Math.max(1, Math.round(n * 0.12));
  let a = 0;
  let b = 0;
  for (let i = 0; i < k; i++) {
    a += at(pts[i]) / k;
    b += at(pts[n - 1 - i]) / k;
  }
  return Math.max(a, b);
}

// (what the network sees: a weapon, gear - no wheels in what hangs under it, a grip, a magazine)
const HAND_CLS = new Set(['rifle', 'pistol', 'smg', 'shotgun', 'minigun', 'launcher', 'sword', 'knife', 'axe', 'hammer', 'baseball bat', 'boomerang', 'bomb', 'shield', 'umbrella', 'parachute', 'key', 'ladder', 'spring']);
// (what the network sees it is - ROADMAP 11.11: lights, a sign, a ladder, a rack on its roof - a gun
// there only when it is out over its hood, its front; a bike's handlebars, a tractor's exhaust
// stack - no guns slanting up off it)
const ROOF_KIN = new Set(['police car', 'ambulance', 'firetruck', 'bus', 'school bus', 'van']);
const BIKE_KIN = new Set(['motorbike', 'bicycle', 'tractor']);

// a line out of the body (gap: how near it comes; L, H: the body's length and height) that is
// plainly one of the parts that make a thing do more: a barrel out of its front or back, a blade at
// its nose, a spring under it, a rotor or a balloon over it... - strict unless the player said they
// draw that kind of thing too (lenient: { air, sea, weapon })
// (wheelTop: how high its wheels come; kin: what the network sees it is)
function addedPart(o, R, r, len, wheelTop = -Infinity, kin = null) {
  const sh = o.sh;
  const B = R.sh;
  const L = B.w;
  const H = B.h;
  const gap = r.gap;
  const air = !!len.air;
  // coils: a spring (under it, or at an end)
  if (sh.coils >= 3 && sh.cy < B.cy + H * 0.2 && gap < H * 0.5) return 'spring';
  // a barrel: long, thin and straight, from it out past its front or back (or slanting up off
  // its top: a gun on a turret)
  const barrelish = sh.straight && sh.thin > 2.8 && sh.long > L * 0.12 && sh.long < L * 1.1;
  const roofed = ROOF_KIN.has(kin) || BIKE_KIN.has(kin);
  const boxy = sh.closed || sh.endGap < sh.long * 0.35;
  if (barrelish && gap < L * 0.07) {
    const past = sh.x1 > B.x1 + L * 0.1 || sh.x0 < B.x0 - L * 0.1;
    // (slanting up off its top: a gun on a turret - long; short ones spread like a fan over it
    // are a siren's light; one alone on a police car, a bus, its antenna - a gun only when thick;
    // on a bike, its handlebars)
    const upOff = (!roofed || (boxy && !BIKE_KIN.has(kin))) && sh.y0 > B.y1 - H * 0.35 && sh.slant > 0.3 && sh.slant < 1.25 && sh.y1 > B.y1 + H * 0.2 && sh.long > L * 0.24 && !(len.fan && len.fan.has(o.i));
    // (along its bottom, down among its wheels: its chassis, a bumper, a pickup's bed, a tow bar -
    // no gun)
    const low = sh.cy < B.y0 + H * 0.28 || sh.cy < wheelTop;
    if ((past && sh.slant < 0.5 && !low) || upOff) return 'barrel';
  }
  // (one out of a turret on top, forward, level - inside its length or not: a tank's gun; not as
  // long as it is, its roof's edge. Mostly out of it - or its end well out over its hood: drawn
  // close over its roof, a small drawing's edge takes in the rest)
  const clear = clearOf(o.pts, R);
  const out = r.fo > (r.far > L * 0.12 ? 0.38 : 0.55) || clear > H * 0.4;
  if ((!roofed || clear > H * 0.25) && (sh.long < L * 0.8 || kin === 'tank' || kin === 'cannon') && (sh.straight || (boxy && sh.thin > 3.2)) && sh.thin > 3 && gap < L * 0.06 && out && sh.long > L * 0.18 && sh.long < L * 1.1 && sh.slant < 0.6 && sh.cy > B.y0 + H * 0.45 && !(len.fan && len.fan.has(o.i))) return 'barrel';
  // a blade: pointed, out of its front (or back)
  if (sh.closed && sh.point && gap < L * 0.06 && (sh.tipX > B.x1 + L * 0.02 || sh.tipX < B.x0 - L * 0.02) && sh.size < L * 0.6 && Math.abs(sh.tipY - B.cy) < H * 0.8) return 'blade';
  // up over it
  const above = sh.y0 > B.y1 - H * 0.12;
  if (above) {
    const aspect = Math.max(sh.w, sh.h) / Math.max(1e-6, Math.min(sh.w, sh.h));
    // a balloon: big and round, clear of it
    if (sh.closed && sh.size > L * (air ? 0.4 : 0.6) && aspect < 1.7 && gap > H * (air ? 0.04 : 0.12) && (sh.round || sh.roundish || sh.fill > 0.62)) return 'balloon';
    // a parachute: a wide dome, clear of it
    if (sh.dome && sh.w > L * (air ? 0.4 : 0.55) && gap > H * (air ? 0.05 : 0.15)) return 'chute';
    // a rotor: long, flat and thin over its middle, clear of it (or on a mast)
    const flat = ((!sh.closed && sh.straight && sh.slant < 0.4) || (sh.closed && sh.thin > 5 && sh.slant < 0.35)) && sh.wiggle < 3;
    if (flat && sh.long > L * (air ? 0.35 : 0.5) && Math.abs(sh.cx - B.cx) < L * 0.35 && gap > H * (air ? 0.03 : 0.1)) return 'rotor';
  }
  // a wing across it, side on: long, flat and thin, level, about its middle, out past it
  if (sh.thin > 3.2 && sh.slant < 0.3 && sh.long > L * (air ? 0.3 : 0.45) && sh.cy > B.y0 + H * 0.1 && sh.cy < B.y1 - H * 0.1 && (sh.x0 < B.x0 - L * 0.08 || sh.x1 > B.x1 + L * 0.08) && sh.x0 < B.cx && sh.x1 > B.cx && r.fo > 0.3) return 'wing';
  return null;
}

// (over its top, short straight lines slanting out both ways round a point - a siren's light, the
// sun's rays, steam: none of them a gun)
function fanOver(st, B) {
  const ray = st.filter((o) => !o.sh.closed && o.sh.straight && o.sh.cy > B.y1 - B.h * 0.2 && o.sh.slant > 0.25 && o.sh.long < B.w * 0.45);
  const out = new Set();
  for (const a of ray) {
    for (const b of ray) {
      if (a === b) continue;
      // (slanting opposite ways: one up to the left, one up to the right)
      const sa = Math.sign(a.sh.ux * a.sh.uy);
      const sb = Math.sign(b.sh.ux * b.sh.uy);
      if (sa === sb || !sa || !sb) continue;
      if (Math.abs(a.sh.cy - b.sh.cy) < B.h * 0.6 && Math.abs(a.sh.cx - b.sh.cx) < B.w * 0.45) {
        out.add(a.i);
        out.add(b.i);
      }
    }
  }
  return out;
}

// (ROADMAP 11.12) what the player named something else that can still be its body - its outline, a
// barrel, a wheel: when nothing else closes round, the body is that, and that is a part of it too
function named(F, skip) {
  const { st, D, over } = F;
  return st.filter((o) => !skip.has(o.i) && over[o.i] && !BODYISH.has(over[o.i]) && o.sh.size > D.size * 0.5);
}

// ------------------------------------------------------------------ the kinds of thing, each its build
// F: the drawing as read so far ({ st, D, G, over, len }); each returns { fam, frame, labels,
// score (how well the drawing fits the build, 0..1), R (the body), main, front, arches }

// a car, a truck, a bus, a tractor, a tank, a skateboard (and a bike, its body a frame of lines)
function parseGround(F) {
  const { st, D, G, over } = F;
  const labels = {};
  const cands = wheelCands(st, D, over);
  const wheels = wheelSet(cands, D);
  const wheelI = new Set(wheels.map((c) => c.o.i));
  for (const c of wheels) labels[c.o.i] = 'wheel';
  // (a hub in a wheel, its spokes: the wheel's)
  const inWheel = (o) => wheels.some((c) => !wheelI.has(o.i) && o.sh.size < c.r * 2.3 && inCircle(o.pts, c) > 0.75);
  // (a barrel drawn as a long thin box, out past the rest of it: not body - kept out of it)
  const rest = st.filter((o) => !wheelI.has(o.i));
  const gun = new Set();
  const longest = rest.reduce((a, o) => (!a || o.sh.long > a.sh.long ? o : a), null);
  for (const o of rest) {
    const sh = o.sh;
    const boxy = sh.closed || sh.endGap < sh.long * 0.35;
    if (over[o.i] || o === longest || sh.thin < 3.2 || sh.long < D.w * 0.15 || sh.slant > 0.7 || !(sh.straight || boxy)) continue;
    // (beside a body - something big that is not it)
    if (!rest.some((q) => q !== o && q.sh.size > Math.max(sh.long * 0.8, D.w * 0.3))) continue;
    let bx0 = Infinity;
    let bx1 = -Infinity;
    let by1 = -Infinity;
    for (const q of rest) {
      if (q === o) continue;
      bx0 = Math.min(bx0, q.sh.x0);
      bx1 = Math.max(bx1, q.sh.x1);
      by1 = Math.max(by1, q.sh.y1);
    }
    // (out past the rest of it - or a long thin box up in its top half: a turret's gun)
    if (sh.x1 > bx1 + D.w * 0.06 || sh.x0 < bx0 - D.w * 0.06 || sh.y1 > by1 + D.h * 0.12 || (boxy && sh.cy > D.y0 + D.h * 0.5 && sh.long > D.w * 0.22)) gun.add(o.i);
  }
  const use = st.filter((o) => !wheelI.has(o.i) && !gun.has(o.i) && !inWheel(o) && (!over[o.i] || BODYISH.has(over[o.i])) && (o.sh.closed || o.sh.size > D.size * 0.1));
  let R = region(G, use) || region(G, use.concat(named(F, wheelI)));
  // a bike: two big wheels, and between them a frame of lines - no box of a body
  const bigWheels = wheels.length === 2 && wheels.every((c) => c.r > D.w * 0.11);
  if (bigWheels && (!R || R.sh.area < Math.PI * wheels[0].r * wheels[1].r * 0.9)) return parseBike(F, wheels, labels, inWheel);
  // (what closes a small part of it all - its body drawn as a line over it, its bottom not drawn:
  // closed along its bottom - ROADMAP 11.11)
  if (R && R.sh.area < D.w * D.h * 0.12) R = region(G, use, 2, true) || R;
  if (!R) return null;
  const B = R.sh;
  // (round ones well up inside the body are its portholes, its lights - not what it stands on)
  for (let q = wheels.length - 1; q >= 0; q--) {
    const c = wheels[q];
    const k = G.at(c.cx, c.cy - c.r);
    if (over[c.o.i] !== 'wheel' && c.cy - c.r > B.y0 + B.h * 0.3 && k >= 0 && R.dm[k] > 2.5) {
      delete labels[c.o.i];
      wheelI.delete(c.o.i);
      wheels.splice(q, 1);
    }
  }
  F.len.fan = fanOver(st, B);
  // (how high its wheels come, most of the way to their tops)
  const wheelTop = wheels.length ? wheels.reduce((a, c) => a + c.cy + c.r * 0.7, 0) / wheels.length : -Infinity;
  let main = null;
  let mainE = -1;
  for (const o of st) {
    if (labels[o.i]) continue;
    if (inWheel(o)) {
      labels[o.i] = 'deco';
      continue;
    }
    const r = relate(G, R, o);
    o.rel = r;
    if (r.fo <= 0.28) {
      if (r.fe >= 0.5 || (r.fe >= r.fi && o.sh.size > B.size * 0.3)) {
        labels[o.i] = 'body';
        const e = r.fe * o.sh.len;
        if (e > mainE) {
          mainE = e;
          main = o;
        }
      } else labels[o.i] = o.sh.closed && o.sh.cy > B.y0 + B.h * 0.35 && o.sh.size < B.w * 0.55 ? 'window' : 'deco';
      continue;
    }
    // (under it all, long and level: the road it is on, its shadow)
    if (!o.sh.closed && o.sh.straight && o.sh.slant < 0.3 && o.sh.cy < B.y0 + B.h * 0.12 && o.sh.w > B.w * 0.2) {
      labels[o.i] = 'deco';
      continue;
    }
    labels[o.i] = addedPart(o, R, r, F.len, wheelTop, F.cls) || 'deco';
  }
  // (a closed one sitting on its top, as big as a cabin: its cabin)
  for (const o of st) {
    if (labels[o.i] !== 'body' || o === main || !o.sh.closed) continue;
    if (o.sh.cy > B.y0 + B.h * 0.55 && o.sh.w < B.w * 0.8) labels[o.i] = 'cabin';
  }
  // its wheel arches drawn in it, and fewer wheels than that: its wheels in them
  const arches = wheels.length < 2 && !HAND_CLS.has(F.cls) ? archesOf(R.loop, B, wheels, st.filter((o) => labels[o.i] === 'body').map((o) => o.pts)) : [];
  // (one wheel drawn, at one end, under a long body: the other is there too, at its other end -
  // only half drawn, or hidden)
  if (wheels.length === 1 && !arches.length && B.w > B.h * 1.5) {
    const w = wheels[0];
    const x = B.cx * 2 - w.cx;
    if (Math.abs(x - w.cx) > w.r * 2.2 && x - w.r > B.x0 - B.w * 0.05 && x + w.r < B.x1 + B.w * 0.05) arches.push({ x, y: w.cy, r: w.r, guess: true });
  }
  const nW = wheels.length + arches.reduce((a, q) => a + (q.guess ? 0.6 : 1), 0);
  let score = nW >= 2 ? 1 : nW >= 1.5 ? 0.7 : nW >= 1 ? 0.45 : 0.12;
  if (B.w < B.h * 0.9) score *= 0.6;
  // which way it faces: what is out of its front (a barrel, a blade), at its back (a jet)
  let face = 0;
  for (const o of st) {
    const t = labels[o.i];
    const side = o.sh.cx > B.cx ? 1 : -1;
    if (t === 'barrel') face += side * 2;
    if (t === 'blade') face += side * 2;
    if (t === 'jet') face -= side * 1.5;
  }
  return { fam: 'ground', frame: 'ride', labels, score, R, main, front: face < 0 ? -1 : 1, arches, wheels };
}

// a bicycle, a motorbike: two big wheels, a frame of lines between and over them (the handlebars at
// its front, its seat) - and a motorbike's tank, its engine, closed shapes on the frame
function parseBike(F, wheels, labels, inWheel) {
  const { st } = F;
  const [a, b] = wheels;
  const x0 = Math.min(a.cx - a.r, b.cx - b.r);
  const x1 = Math.max(a.cx + a.r, b.cx + b.r);
  let y1 = Math.max(a.cy + a.r, b.cy + b.r);
  let main = null;
  for (const o of st) {
    if (labels[o.i]) continue;
    if (inWheel(o)) {
      labels[o.i] = 'deco';
      continue;
    }
    labels[o.i] = 'frame';
    y1 = Math.max(y1, o.sh.y1);
    if (!main || o.sh.len > main.sh.len) main = o;
  }
  const y0 = Math.min(a.cy, b.cy);
  const sh = { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, size: Math.max(x1 - x0, y1 - y0), area: (x1 - x0) * (y1 - y0) * 0.25 };
  // (which way: its handlebars - the frame's highest point, over its front wheel)
  let top = null;
  for (const o of st) if (labels[o.i] === 'frame' && (!top || o.sh.y1 > top.sh.y1)) top = o;
  const front = top ? (Math.abs(top.sh.cx - a.cx) < Math.abs(top.sh.cx - b.cx) ? (a.cx > b.cx ? 1 : -1) : b.cx > a.cx ? 1 : -1) : 1;
  return { fam: 'ground', frame: 'ride', labels, score: 1, R: { sh, loop: null, made: true, bike: true }, main, front, arches: [], wheels, bike: true };
}

// a helicopter: a body, a rotor over it (flat lines, an X), a tail out of one side, skids under
function parseCopter(F) {
  const { st, D, G, over } = F;
  const labels = {};
  const cands = wheelCands(st, D, over);
  const wheels = wheelSet(cands, D).filter((c) => c.r < D.w * 0.12);
  const wheelI = new Set(wheels.map((c) => c.o.i));
  for (const c of wheels) labels[c.o.i] = 'wheel';
  // its rotor first, kept out of its body: long and flattish, up at the top (lines, an X, blades
  // drawn as long leaves)
  const blade = (o) => o.sh.slant < 0.75 && o.sh.long > D.w * 0.16 && (o.sh.straight || o.sh.thin > (o.sh.closed ? 2.2 : 2.8)) && o.sh.wiggle < 3;
  const rotorC = new Set(st.filter((o) => !over[o.i] && !wheelI.has(o.i) && o.sh.cy > D.y0 + D.h * 0.62 && blade(o)).map((o) => o.i));
  const use = st.filter((o) => !wheelI.has(o.i) && !rotorC.has(o.i) && (!over[o.i] || BODYISH.has(over[o.i])) && (o.sh.closed || o.sh.size > D.size * 0.1));
  const R = region(G, use) || region(G, use.concat(named(F, wheelI)));
  if (!R) return null;
  const B = R.sh;
  let main = null;
  let mainE = -1;
  let rotor = 0;
  let tail = null;
  const out = [];
  for (const o of st) {
    if (rotorC.has(o.i) && o.sh.cy > B.y1 - B.h * 0.25) {
      labels[o.i] = 'rotor';
      rotor++;
    }
  }
  for (const o of st) {
    if (labels[o.i]) continue;
    const r = relate(G, R, o);
    o.rel = r;
    if (r.fo <= 0.28) {
      if (r.fe >= 0.5 || (r.fe >= r.fi && o.sh.size > B.size * 0.3)) {
        labels[o.i] = 'body';
        if (r.fe * o.sh.len > mainE) {
          mainE = r.fe * o.sh.len;
          main = o;
        }
      } else labels[o.i] = o.sh.closed ? 'window' : 'deco';
      continue;
    }
    out.push(o);
  }
  // the rotor: what is long and flattish over its top (two crossed, an X: both)
  for (const o of out) {
    const sh = o.sh;
    const flat = sh.slant < 0.62 && (sh.straight || sh.thin > 3.5) && sh.wiggle < 3;
    if (flat && sh.cy > B.y1 - B.h * 0.15 && sh.long > B.w * 0.3 && Math.abs(sh.cx - B.cx) < B.w * 0.55) {
      labels[o.i] = 'rotor';
      rotor++;
    }
  }
  // its tail: long, out of one side, about as high as it (the longest such)
  for (const o of out) {
    if (labels[o.i]) continue;
    const sh = o.sh;
    const side = sh.x1 > B.x1 + B.w * 0.12 ? 1 : sh.x0 < B.x0 - B.w * 0.12 ? -1 : 0;
    if (side && sh.slant < 0.75 && sh.cy > B.y0 - B.h * 0.2 && sh.cy < B.y1 + B.h * 0.3 && (!tail || sh.w > tail.sh.w)) tail = o;
  }
  if (tail) labels[tail.i] = 'tail';
  const tSide = tail ? (tail.sh.cx > B.cx ? 1 : -1) : 0;
  for (const o of out) {
    if (labels[o.i]) continue;
    const sh = o.sh;
    // (at the tail's end, small: its tail rotor; along it: more of the tail)
    if (tail && (tSide > 0 ? sh.cx > tail.sh.x1 - tail.sh.w * 0.3 : sh.cx < tail.sh.x0 + tail.sh.w * 0.3) && sh.size < B.size * 0.6) {
      labels[o.i] = sh.slant > 0.6 || sh.closed || sh.size < B.size * 0.3 ? 'prop' : 'tail';
      continue;
    }
    if (tail && (tSide > 0 ? sh.x0 > B.x1 - B.w * 0.1 : sh.x1 < B.x0 + B.w * 0.1) && sh.slant < 0.6) {
      labels[o.i] = 'tail';
      continue;
    }
    // skids: long and level under it (and what holds them up)
    if (sh.cy < B.y0 + B.h * 0.1 && ((sh.slant < 0.4 && sh.w > B.w * 0.25) || (sh.slant > 0.9 && sh.h < B.h * 0.6))) {
      labels[o.i] = 'skid';
      continue;
    }
    // (the rotor's mast: short, upright, between it and the rotor)
    if (rotor && sh.slant > 0.9 && sh.y0 > B.y1 - B.h * 0.3 && sh.h < B.h * 0.8) {
      labels[o.i] = 'deco';
      continue;
    }
    labels[o.i] = addedPart(o, R, o.rel, F.len) || 'deco';
  }
  const score = rotor ? Math.min(1, 0.85 + (tail ? 0.15 : 0)) : 0.08;
  return { fam: 'copter', frame: 'ride', labels, score, R, main, front: tSide > 0 ? -1 : 1, arches: [], wheels };
}

// a plane seen from above (as most draw one): the axis it is symmetric about, if it is - what is far
// out across it is there on the other side too (its wings, its tailplane), which a plane from the
// side (a fin up, wheels down) is not
function topAxis(G, st) {
  const solid = G.solid(st.map((o) => o.pts), 2);
  const { nx, ny } = G;
  const cells = [];
  let mx = 0;
  let my = 0;
  for (let k = 0; k < solid.length; k++) {
    if (!solid[k]) continue;
    const i = k % nx;
    const j = (k - i) / nx;
    cells.push(i, j);
    mx += i;
    my += j;
  }
  const n = cells.length / 2;
  if (n < 30) return [];
  mx /= n;
  my /= n;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (let q = 0; q < cells.length; q += 2) {
    const dx = cells[q] - mx;
    const dy = cells[q + 1] - my;
    xx += dx * dx;
    yy += dy * dy;
    xy += dx * dy;
  }
  const th = 0.5 * Math.atan2(2 * xy, xx - yy);
  const out = [];
  for (const ang of [th, th + Math.PI / 2, 0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    let maxA = 0;
    let maxL = 0;
    for (let q = 0; q < cells.length; q += 2) {
      const dx = cells[q] - mx;
      const dy = cells[q + 1] - my;
      maxA = Math.max(maxA, Math.abs(-dx * uy + dy * ux));
      maxL = Math.max(maxL, Math.abs(dx * ux + dy * uy));
    }
    let far = 0;
    let hit = 0;
    let up = 0;
    // (the axis may be off the middle of its mass a little: the best of a few, side to side)
    let bestOff = null;
    for (const off of [0, -1.5, 1.5]) {
      far = 0;
      hit = 0;
      up = 0;
      for (let q = 0; q < cells.length; q += 2) {
        const dx = cells[q] - mx;
        const dy = cells[q + 1] - my;
        const al = dx * ux + dy * uy;
        const ac = -dx * uy + dy * ux - off;
        if (Math.abs(ac) < maxA * 0.3) continue;
        far++;
        if (ac > 0) up++;
        // (its mirror across the axis)
        const ri = Math.round(mx + al * ux + (off - ac) * -uy);
        const rj = Math.round(my + al * uy + (off - ac) * ux);
        if (ri >= 0 && rj >= 0 && ri < nx && rj < ny && solid[rj * nx + ri]) hit++;
      }
      if (far >= n * 0.16 && up >= far * 0.3 && up <= far * 0.7) {
        const sc = hit / far;
        if (!bestOff || sc > bestOff.sc) bestOff = { sc, off };
      }
    }
    if (!bestOff || bestOff.sc < 0.6) continue;
    // (the same axis twice - the long way also one of the four tried: once)
    if (out.some((a) => Math.abs(a.ux * ux + a.uy * uy) > 0.98)) continue;
    out.push({ sc: bestOff.sc, ux, uy, cx: G.ox + (mx - uy * bestOff.off) * G.cell, cy: G.oy + (my + ux * bestOff.off) * G.cell });
  }
  return out.sort((a, b) => b.sc - a.sc);
}

// a plane: from above (wings out both sides of a long body, a smaller pair at its tail), or from
// the side (wings across its body, a fin up at its back, a propeller at its nose, jets)
function parsePlane(F) {
  const { st, D, G, over } = F;
  let top = null;
  for (const tv of topAxis(G, st).slice(0, 3)) {
    const t = planeTop(F, tv);
    if (t && (!top || t.like > top.like)) top = t;
  }
  const side = planeSide(F);
  // (from above, unless it is plainly a plane from the side: its wing, and its fin or propeller)
  if (top && side) {
    const n = (t) => Object.values(side.labels).filter((x) => x === t).length;
    const sideSure = n('wing') && (n('fin') || n('prop') || n('jet'));
    F.dbgLike = top.like;
    return sideSure && top.like < 1.9 ? side : top;
  }
  return top || side;
}

// a plane from the side: its body, a wing across it (or seen edge on in it), a fin up at its back, a
// propeller at its nose, jets; wheels under it
function planeSide(F) {
  const { st, D, G, over } = F;
  const labels = {};
  const cands = wheelCands(st, D, over);
  const wheels = wheelSet(cands, D).filter((c) => c.r < D.w * 0.1);
  const wheelI = new Set(wheels.map((c) => c.o.i));
  for (const c of wheels) labels[c.o.i] = 'wheel';
  const use = st.filter((o) => !wheelI.has(o.i) && (!over[o.i] || BODYISH.has(over[o.i])) && (o.sh.closed || o.sh.size > D.size * 0.1));
  const R = region(G, use) || region(G, use.concat(named(F, wheelI)));
  if (!R) return null;
  const B = R.sh;
  let main = null;
  let mainE = -1;
  let wing = 0;
  let face = 0;
  for (const o of st) {
    if (labels[o.i]) continue;
    const r = relate(G, R, o);
    o.rel = r;
    const sh = o.sh;
    // (a wing crosses its body: on it and out of it)
    const across = sh.slant < 0.75 && sh.long > B.w * 0.2 && sh.cx > B.x0 + B.w * 0.2 && sh.cx < B.x1 - B.w * 0.2 && (sh.thin > 2.2 || sh.point) && (sh.y0 < B.y0 + B.h * 0.25 || sh.y1 > B.y1 - B.h * 0.25) && r.gap < B.h * 0.15;
    if (r.fo > 0.2 && across) {
      labels[o.i] = 'wing';
      wing++;
      continue;
    }
    if (r.fo <= 0.28) {
      // (a wing seen edge on: long, flat and thin, level, across its middle)
      if (r.fi > 0.4 && sh.thin > 3 && sh.slant < 0.3 && sh.long > B.w * 0.22 && Math.abs(sh.cx - B.cx) < B.w * 0.3 && Math.abs(sh.cy - B.cy) < B.h * 0.4) {
        labels[o.i] = 'wing';
        wing++;
        continue;
      }
      if (r.fe >= 0.5 || (r.fe >= r.fi && sh.size > B.size * 0.3)) {
        labels[o.i] = 'body';
        if (r.fe * sh.len > mainE) {
          mainE = r.fe * sh.len;
          main = o;
        }
      } else labels[o.i] = sh.closed ? 'window' : 'deco';
      continue;
    }
    // at an end: a fin standing up over it (its back), a propeller across its nose
    const atBack = sh.cx < B.x0 + B.w * 0.25 ? -1 : sh.cx > B.x1 - B.w * 0.25 ? 1 : 0;
    if (atBack && sh.y1 > B.y1 + B.h * 0.15 && sh.cy > B.cy && sh.size < B.w * 0.5) {
      labels[o.i] = 'fin';
      face -= atBack * 1.5;
      continue;
    }
    if (atBack && sh.h > sh.w * 1.6 && sh.size < B.h * 2.2 && Math.abs(sh.cy - B.cy) < B.h * 0.6) {
      labels[o.i] = 'prop';
      face += atBack * 2;
      continue;
    }
    labels[o.i] = addedPart(o, R, r, { ...F.len, air: true }) || 'deco';
  }
  // (a body with a wing in its own outline - a long one with a big triangle under its middle)
  const score = wing ? 1 : 0.1;
  return { fam: 'plane', frame: 'ride', labels, score, R, main, front: face < 0 ? -1 : 1, arches: [], wheels };
}

// a plane from above: along its axis how wide it is - its wings where widest, its tail at an end.
// Each line: the long one along the axis its body, what reaches far out across its wings or its tail
function planeTop(F, tv) {
  const { st, G } = F;
  const { ux, uy, cx, cy } = tv;
  const UV = ([x, y]) => [(x - cx) * ux + (y - cy) * uy, -(x - cx) * uy + (y - cy) * ux];
  let u0 = Infinity;
  let u1 = -Infinity;
  for (const o of st) {
    o.uv = o.pts.map(UV);
    for (const [u] of o.uv) {
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
    }
  }
  const len = u1 - u0;
  if (len < 1e-3) return null;
  const NB = 24;
  const lo = new Array(NB).fill(Infinity);
  const hi = new Array(NB).fill(-Infinity);
  for (const o of st) {
    for (const [u, v] of o.uv) {
      const bi = Math.min(NB - 1, Math.floor(((u - u0) / len) * NB));
      lo[bi] = Math.min(lo[bi], v);
      hi[bi] = Math.max(hi[bi], v);
    }
  }
  const wid = lo.map((l, i) => (hi[i] >= l ? hi[i] - l : 0));
  const span = Math.max(...wid);
  if (span < len * 0.35) return null;
  let w0 = -1;
  let w1 = -1;
  for (let i = 0; i < NB; i++) {
    if (wid[i] >= span * 0.55) {
      if (w0 < 0) w0 = i;
      w1 = i;
    }
  }
  // (the wings about its middle, not at an end: a cross, a plane - a T is not; its body on past
  // them both ways - its nose, its tail)
  if ((w0 + w1 + 1) / 2 / NB < 0.18 || (w0 + w1 + 1) / 2 / NB > 0.82) return null;
  if (w0 < 1 || w1 > NB - 2) return null;
  // (its widest part one round thing - a balloon's envelope, a wheel, a face: no wings)
  for (const o of st) {
    const sh = o.sh;
    const aspect = Math.max(sh.w, sh.h) / Math.max(1e-6, Math.min(sh.w, sh.h));
    if (sh.closed && sh.fill > 0.62 && aspect < 1.7 && sh.size > span * 0.75) return null;
  }
  const narrow = wid.filter((w) => w > 0 && w < span * 0.3).sort((a, b) => a - b);
  const fw = narrow.length ? narrow[Math.floor(narrow.length / 2)] : span * 0.15;
  if (fw > span * 0.42) return null;
  const endW = (a, b) => Math.max(...wid.slice(a, b));
  const tailA = endW(0, 4);
  const tailB = endW(NB - 4, NB);
  const wc = (w0 + w1 + 1) / 2 / NB;
  const nose = Math.abs(tailA - tailB) > fw * 0.8 ? (tailA > tailB ? 1 : -1) : wc >= 0.5 ? 1 : -1;
  const labels = {};
  const wa = u0 + (w0 / NB) * len;
  const wb = u0 + ((w1 + 1) / NB) * len;
  const tailU = nose > 0 ? u0 : u1;
  let main = null;
  let mainL = -1;
  for (const o of st) {
    let v0 = Infinity;
    let v1 = -Infinity;
    let a = Infinity;
    let b = -Infinity;
    for (const [u, v] of o.uv) {
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
      a = Math.min(a, u);
      b = Math.max(b, u);
    }
    const reach = Math.max(Math.abs(v0), Math.abs(v1));
    const um = (a + b) / 2;
    const along = b - a;
    if (F.over[o.i]) {
      labels[o.i] = F.over[o.i];
      continue;
    }
    // (the long one along it: its body - however much else of it was drawn in the same line)
    if (along > len * 0.55) {
      labels[o.i] = 'body';
      if (along > mainL) {
        mainL = along;
        main = o;
      }
      continue;
    }
    if (reach > fw * 1.2) {
      const nearTail = Math.abs(um - tailU) < len * 0.28;
      if (nearTail && reach < span * 0.42) labels[o.i] = 'fin';
      else if (um > wa - len * 0.12 && um < wb + len * 0.12) labels[o.i] = o.sh.closed && o.sh.size < span * 0.18 ? 'jet' : 'wing';
      else labels[o.i] = nearTail ? 'fin' : 'wing';
      continue;
    }
    // (across its nose: a propeller; on it: windows)
    const atNose = Math.abs(um - (nose > 0 ? u1 : u0)) < len * 0.08;
    if (atNose && v1 - v0 > fw * 0.8 && along < len * 0.08) labels[o.i] = 'prop';
    else labels[o.i] = o.sh.closed && o.sh.size < fw * 1.5 ? 'window' : o.sh.size > len * 0.3 ? 'body' : 'deco';
  }
  if (!main) {
    // (no one line along it: the biggest is its body)
    for (const o of st) if (!main || o.sh.len > main.sh.len) main = o;
    if (main && !F.over[main.i]) labels[main.i] = 'body';
  }
  const top = { len, fw, span, chord: Math.max((wb - wa), len * 0.18), wingAt: ((wa + wb) / 2 - (nose > 0 ? u0 : u1)) * nose / len, tailSpan: Math.max(tailA, tailB), ux, uy, cx, cy, nose };
  const R = { sh: { x0: 0, x1: len, y0: 0, y1: fw, w: len, h: fw, cx: len / 2, cy: fw / 2, size: len, area: len * fw * 0.8 }, loop: null };
  // how like a plane: a long body along the axis (one line along it), wings about its middle, a
  // smaller tail at an end
  const tailR = Math.max(tailA, tailB) / span;
  const like = tv.sc + (mainL > len * 0.55 ? 0.5 : 0) + (Math.abs(wc - 0.5) < 0.25 ? 0.3 : 0) + (tailR > 0.15 && tailR < 0.7 ? 0.3 : 0) - fw / span;
  // (what it has that no one line is: its wings, its tail - where they are, as the page has it)
  const at = (u, v) => [cx + u * ux - v * uy, cy + u * uy + v * ux];
  const implicit = [];
  if (!Object.values(labels).includes('wing')) implicit.push({ type: 'wing', at: at((wa + wb) / 2, span * 0.38) });
  if (!Object.values(labels).includes('fin') && tailR > 0.12) implicit.push({ type: 'fin', at: at(tailU + (nose > 0 ? len * 0.06 : -len * 0.06), Math.max(tailA, tailB) * 0.4) });
  return { fam: 'plane', frame: 'ride', labels, score: 1, R, main, front: 1, arches: [], wheels: [], top, like, implicit };
}

// a hot-air balloon: a big round envelope over a little basket, ropes between
function parseBalloon(F) {
  const { st, D, G, over } = F;
  const labels = {};
  // (the network sees a balloon: one drawn squat is one too)
  const sure = F.cls === 'hot air balloon';
  // the envelope: the biggest round (or teardrop, or a dome open at its foot) up top
  let env = null;
  for (const o of st) {
    if (over[o.i] && over[o.i] !== 'balloon') continue;
    const sh = o.sh;
    const aspect = Math.max(sh.w, sh.h) / Math.max(1e-6, Math.min(sh.w, sh.h));
    const up = sh.cy > D.y0 + D.h * 0.45;
    const big = sh.w > D.w * 0.5 && sh.h > D.h * 0.3 && sh.h > sh.w * (sure ? 0.3 : 0.45);
    const roundish = sh.closed ? aspect < (sure ? 3 : 1.9) : sh.cover > 3.2 || (sh.dome && sh.h > sh.w * 0.45) || (sh.endGap < sh.w * 0.75 && sh.h > sh.w * 0.6 && sh.dev > 0.3);
    if ((up && big && roundish) || over[o.i] === 'balloon') if (!env || sh.w * sh.h > env.sh.w * env.sh.h) env = o;
  }
  if (!env) return null;
  labels[env.i] = 'balloon';
  const E = env.sh;
  // the basket: small, compact, under it
  let basket = null;
  for (const o of st) {
    if (o === env || (over[o.i] && !BODYISH.has(over[o.i]))) continue;
    const sh = o.sh;
    const aspect = Math.max(sh.w, sh.h) / Math.max(1e-6, Math.min(sh.w, sh.h));
    if (sh.cy < E.y0 + E.h * 0.12 && sh.size < E.w * 0.75 && sh.size > E.w * 0.08 && aspect < 3 && (sh.closed || sh.cup || sh.endGap < sh.size * 0.9) && Math.abs(sh.cx - E.cx) < E.w * 0.5) {
      if (!basket || sh.y0 < basket.sh.y0) basket = o;
    }
  }
  let R = null;
  if (basket) {
    labels[basket.i] = 'body';
    R = region(G, [basket]);
  }
  for (const o of st) {
    if (labels[o.i]) continue;
    const sh = o.sh;
    // (on the envelope: its seams, its pattern)
    const onEnv = o.pts.filter(([x, y]) => x > E.x0 - E.w * 0.05 && x < E.x1 + E.w * 0.05 && y > E.y0 - E.h * 0.05 && y < E.y1 + E.h * 0.05).length / o.pts.length;
    if (onEnv > 0.8) {
      labels[o.i] = 'deco';
      continue;
    }
    // (between it and the basket, up and down: its ropes)
    const by = basket ? basket.sh.y1 : D.y0;
    if (sh.y1 < E.y0 + E.h * 0.45 && sh.y0 > by - E.h * 0.15 && sh.slant > 0.6) {
      labels[o.i] = 'rope';
      continue;
    }
    if (basket && R) {
      const r = relate(G, R, o);
      if (r.fo < 0.3) {
        labels[o.i] = 'body';
        continue;
      }
    }
    labels[o.i] = 'deco';
  }
  const score = basket ? 1 : 0.65;
  const BB = R ? R.sh : { x0: E.cx - E.w * 0.15, x1: E.cx + E.w * 0.15, y0: E.y0 - E.h * 0.4, y1: E.y0 - E.h * 0.2, w: E.w * 0.3, h: E.h * 0.2, cx: E.cx, cy: E.y0 - E.h * 0.3, size: E.w * 0.3, area: E.w * E.h * 0.06 };
  return { fam: 'balloon', frame: 'ride', labels, score, R: R || { sh: BB, loop: null, made: true }, main: basket, front: 1, arches: [], wheels: [], env };
}

// a boat: a hull (wide, its deck level, narrower at its keel), on it a cabin, a mast with its sails
// (or a sail and its mast in one line), funnels; waves under it, round it
function parseBoat(F) {
  const { st, D, G, over, cls } = F;
  const labels = {};
  // (the sea: long wavy lines - left out of the boat's size)
  const wave = (o) => !o.sh.closed && o.sh.wiggle >= 2 && o.sh.slant < 0.35 && o.sh.w > D.w * 0.25;
  for (const o of st) if (!over[o.i] && wave(o)) labels[o.i] = 'deco';
  const ship = st.filter((o) => !labels[o.i]);
  if (!ship.length) return null;
  let bx0 = Infinity;
  let bx1 = -Infinity;
  let by0 = Infinity;
  let by1 = -Infinity;
  for (const o of ship) {
    bx0 = Math.min(bx0, o.sh.x0);
    bx1 = Math.max(bx1, o.sh.x1);
    by0 = Math.min(by0, o.sh.y0);
    by1 = Math.max(by1, o.sh.y1);
  }
  const E = { x0: bx0, x1: bx1, y0: by0, y1: by1, w: bx1 - bx0, h: by1 - by0 };
  // the hull: low, wide, flat along its top
  let hull = null;
  for (const o of ship) {
    if (over[o.i] && !BODYISH.has(over[o.i])) continue;
    const sh = o.sh;
    if (sh.w < E.w * 0.4 || sh.w < sh.h * 1.3) continue;
    if (sh.cy > E.y0 + E.h * 0.62 && !over[o.i]) continue;
    if (!hull || sh.w * Math.max(sh.h, E.h * 0.1) > hull.sh.w * Math.max(hull.sh.h, E.h * 0.1)) hull = o;
  }
  if (!hull) return null;
  const Hs = hull.sh;
  labels[hull.i] = 'hull';
  // its masts: upright lines up from its deck
  const masts = [];
  for (const o of ship) {
    if (o === hull || over[o.i]) continue;
    const sh = o.sh;
    if (!sh.closed && sh.straight && sh.slant > 1.2 && sh.y0 > Hs.y0 + Hs.h * 0.3 && sh.y1 > Hs.y1 + Hs.h * 0.6 && sh.cx > Hs.x0 && sh.cx < Hs.x1) {
      labels[o.i] = 'mast';
      masts.push(o);
    }
  }
  // (what the network sees: a sailing boat's sails, a ship's decks and funnels, a submarine's tower)
  const sailing = cls === 'sailboat';
  let sails = 0;
  for (const o of ship) {
    if (labels[o.i] || over[o.i]) continue;
    const sh = o.sh;
    const aboveDeck = sh.y0 > Hs.y1 - Hs.h * 0.4;
    // (its deck: a long line along the hull's top)
    if (!sh.closed && sh.straight && sh.slant < 0.3 && sh.w > Hs.w * 0.5 && Math.abs(sh.cy - Hs.y1) < Hs.h * 0.35) {
      labels[o.i] = 'hull';
      continue;
    }
    if (!aboveDeck) {
      // (under the deck: on the hull, or the sea)
      const on = o.pts.filter(([x, y]) => x > Hs.x0 && x < Hs.x1 && y > Hs.y0 && y < Hs.y1).length / o.pts.length;
      labels[o.i] = on > 0.7 && sh.closed ? 'window' : 'deco';
      continue;
    }
    // a sail: up over the deck, tall - a triangle (or a sail with its mast in one line); a box
    // standing on the deck is a cabin, a funnel
    const tall = sh.h > Hs.h * (sailing ? 0.8 : 1.25) && sh.h > sh.w * 0.55;
    const tri = sh.cfill < 0.62 && (sh.closed || sh.endGap < sh.size * 0.7 || sh.dev > 0.25);
    const byMast = masts.some((m) => sh.x0 < m.sh.cx + Hs.w * 0.12 && sh.x1 > m.sh.cx - Hs.w * 0.12);
    if (tall && (tri || (sailing && sh.cfill < 0.75)) && (byMast || sailing || sh.cfill < 0.55)) {
      labels[o.i] = 'sail';
      sails++;
      continue;
    }
    // (a mast drawn with its flag, slanting: still a mast)
    if (!sh.closed && sh.slant > 1.0 && sh.h > Hs.h * 1.2 && sh.w < Hs.w * 0.3) {
      labels[o.i] = 'mast';
      masts.push(o);
      continue;
    }
    // a cabin on its deck, funnels on that
    if (sh.y0 < Hs.y1 + Hs.h * 0.5 && sh.w < Hs.w * 0.9 && (sh.closed || sh.cfill > 0.45)) {
      labels[o.i] = 'cabin';
      continue;
    }
    labels[o.i] = 'deco';
  }
  // (a mast and no sail drawn by it: what is drawn off it up there is its sail)
  if (masts.length && !sails) {
    for (const o of ship) {
      if (labels[o.i] !== 'deco' && labels[o.i] !== 'cabin') continue;
      const sh = o.sh;
      if (sh.y0 > Hs.y1 && sh.size > Hs.w * 0.12 && sh.cfill < 0.65 && masts.some((m) => Math.abs(sh.cx - m.sh.cx) < Hs.w * 0.45)) {
        labels[o.i] = 'sail';
        sails++;
      }
    }
  }
  const use = ship.filter((o) => labels[o.i] === 'hull' || labels[o.i] === 'cabin' || BODYISH.has(over[o.i]));
  const R = region(G, use) || region(G, [hull], 4);
  if (!R) return null;
  // (a boat-like hull: wider at its deck than at its keel)
  const wB = R.loop ? widthAt(R.loop, R.sh.y0 + R.sh.h * 0.15) : 0;
  const wT = R.loop ? widthAt(R.loop, R.sh.y0 + R.sh.h * 0.85) : 1;
  const keel = wB < wT * 0.85;
  const score = sails || masts.length ? 1 : keel ? 0.75 : 0.45;
  // which way it faces: its bow, the end the hull comes to a point at, or narrower at the keel
  let front = 1;
  if (R.loop) {
    const lowX = [];
    for (const [x, y] of R.loop) if (y < R.sh.y0 + R.sh.h * 0.25) lowX.push(x);
    if (lowX.length) {
      const m = lowX.reduce((a, b) => a + b, 0) / lowX.length;
      front = m < R.sh.cx ? 1 : -1;
    }
  }
  return { fam: 'boat', frame: 'ride', labels, score, R, main: hull, front, arches: [], wheels: [] };
}

// ------------------------------------------------------------------ a thing for the hand
function handGuess(sh, B, o, pts, seen) {
  if (!B) return sh.coils >= 3 ? 'spring' : sh.closed ? 'body' : 'deco';
  const L = B.w;
  const H = B.h;
  const near = gapTo(pts, o) < Math.max(L, H) * 0.12;
  const out = pts.filter((p) => !inPoly(p[0], p[1], o)).length / pts.length;
  if (out < 0.15) return 'deco';
  if (sh.coils >= 3) return 'spring';
  if (sh.dome && sh.y0 > B.y1 - H * 0.2 && sh.w > L * 0.4) return 'chute';
  if (!near) return 'deco';
  // a grip: under it, upright (or slanting back), not round
  const under = sh.y1 < B.y0 + H * 0.45 && sh.cy < B.y0 + H * 0.1;
  if (under && sh.h > sh.w * 0.8 && sh.h > H * 0.5 && sh.size > Math.max(L, H) * 0.12 && !sh.round && !seen.grip) {
    seen.grip = true;
    return 'grip';
  }
  // (a sword's grip, along it out of its back end)
  if (!seen.grip && sh.w > sh.h * 1.4 && Math.abs(sh.cy - B.cy) < H * 0.6 && sh.x1 < B.x0 + L * 0.18 && sh.size < L * 0.6) {
    seen.grip = true;
    return 'grip';
  }
  // a magazine: under it, in front of the grip
  if (under && sh.closed) return 'mag';
  // a barrel: long, thin and straight, out of its front
  if (sh.straight && sh.thin > 3 && sh.slant < 0.5 && sh.x1 > B.x1 - L * 0.05 && sh.x0 > B.x0 + L * 0.3) return sh.point ? 'blade' : 'barrel';
  // a blade: pointed, out of its front
  if (sh.point && sh.x1 > B.x1 - L * 0.05) return 'blade';
  // a sight: on top, long and low
  if (sh.closed && sh.y0 > B.y1 - H * 0.35 && sh.w > sh.h * 1.4 && sh.w < L * 0.8) return 'scope';
  // a stock: out of its back end, about as high as it
  if (sh.closed && sh.x1 < B.x0 + L * 0.15 && sh.h > H * 0.45) return 'stock';
  // a guard: a short upright line across it
  if (!sh.closed && sh.straight && sh.slant > 1.1 && sh.h > H * 0.8) return 'guard';
  return 'deco';
}

// the nearest it comes to the outline o (a closed loop of points)
function gapTo(pts, o) {
  let best = Infinity;
  for (const [x, y] of pts) {
    if (inPoly(x, y, o)) return 0;
    for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
      const [ax, ay] = o[j];
      const [bx, by] = o[i];
      const dx = bx - ax;
      const dy = by - ay;
      const L2 = dx * dx + dy * dy || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
      best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
    }
  }
  return best;
}

function parseHand(F) {
  const { st, over } = F;
  let main = st.find((o) => over[o.i] === 'body') || null;
  if (!main) {
    for (const o of st) {
      if (over[o.i]) continue;
      if (o.sh.closed && !o.sh.round && o.sh.area > 0.12 && (!main || o.sh.area > main.sh.area)) main = o;
    }
  }
  if (!main) for (const o of st) if (!over[o.i] && o.sh.len > FRAME_W * 0.5 && (!main || o.sh.len > main.sh.len)) main = o;
  if (!main) return null;
  const B = main.sh;
  const ol = B.closed ? outline(main.pts) : thickLine(main.pts, Math.max(0.08, B.size * 0.04));
  const labels = {};
  const seen = {};
  const order = st.slice().sort((a, b) => a.sh.cx - b.sh.cx);
  for (const o of order) {
    if (o === main) {
      labels[o.i] = B.closed && B.point && B.thin > 2.6 ? 'blade' : 'body';
      continue;
    }
    labels[o.i] = handGuess(o.sh, B, ol, o.pts, seen);
  }
  const score = seen.grip ? 0.8 : 0.3;
  let face = 0;
  for (const o of st) {
    const t = over[o.i] || labels[o.i];
    if (t === 'barrel' || t === 'blade') face += o.sh.cx > B.cx ? 2 : -2;
    if (t === 'grip') face += o.sh.cx < B.cx ? 1 : -1;
  }
  return { fam: 'hand', frame: 'hand', labels, score, R: { sh: B, loop: ol }, main, front: face < 0 ? -1 : 1, arches: [], wheels: [] };
}

// how unmistakably a reading is its kind, by the parts only that kind has (0..1)
function sureOf(res) {
  const n = {};
  for (const t of Object.values(res.labels)) n[t] = (n[t] || 0) + 1;
  if (res.fam === 'plane') return res.top ? Math.min(0.9, Math.max(0, (res.like || 1) - 0.9)) : n.wing && n.fin && (n.prop || n.jet) ? 0.9 : n.wing && (n.fin || n.prop || n.jet) ? 0.55 : 0;
  if (res.fam === 'copter') return n.rotor && n.tail ? 0.8 : n.rotor && n.skid ? 0.6 : 0;
  if (res.fam === 'balloon') return n.balloon && n.rope && n.body ? 0.8 : 0;
  if (res.fam === 'boat') return n.mast && n.sail ? 0.8 : 0;
  if (res.fam === 'ground') return res.bike ? 0.8 : 0;
  return 0;
}

// ------------------------------------------------------------------ what kind of thing it is likely to be
const FAMS = ['ground', 'copter', 'plane', 'balloon', 'boat', 'hand'];
const FAM_OF_GROUP = { car: 'ground', truck: 'ground', bus: 'ground', tractor: 'ground', tank: 'ground', skate: 'ground', moto: 'ground', bicycle: 'ground', copter: 'copter', plane: 'plane', balloon: 'balloon', boat: 'boat', gun: 'hand', sword: 'hand', club: 'hand', bomb: 'hand', boomerang: 'hand', shield: 'hand', umbrella: 'hand', parachute: 'hand', key: 'hand', ladder: 'hand', bridge: 'hand', spring: 'hand' };
const FAM_OF_CAT = { car: ['ground'], air: ['copter', 'plane', 'balloon'], sea: ['boat'], weapon: ['hand'], gear: ['hand'] };
const PARSE = { ground: parseGround, copter: parseCopter, plane: parsePlane, balloon: parseBalloon, boat: parseBoat, hand: parseHand };

// how likely each kind is: what the network sees in it (game/sketchnet.js look()), what the player
// said they draw; nothing known, all alike
function familyPrior(ctx, hint) {
  const p = {};
  for (const f of FAMS) p[f] = 1;
  const net = ctx && ctx.net;
  if (net && net.groups && net.groups.length) {
    for (const f of FAMS) p[f] = 0.03;
    for (const [grp, q] of net.groups) {
      const f = FAM_OF_GROUP[grp];
      if (f) p[f] += q;
    }
  }
  if (hint === 'sea') p.boat += 0.5;
  const cats = ctx && ctx.cats;
  if (cats && cats.size) {
    const on = new Set([...cats].flatMap((c) => FAM_OF_CAT[c] || []));
    for (const f of FAMS) p[f] *= on.has(f) ? 3 : 0.12;
  }
  const s = FAMS.reduce((a, f) => a + p[f], 0);
  for (const f of FAMS) p[f] /= s;
  return p;
}

// ------------------------------------------------------------------ reading the parts
// strokes: [{ p, c, k }] (page units, y down). over: { [stroke index]: part } - the player's own
// choices. face: which way it faces (null: as its parts say). ctx: { net (what the network sees in
// it), cats (what the player said they draw) }. Returns { frame: 'ride' | 'hand' | null, family,
// parts: [{ i, type, auto, at: [x, y] (page units: where its name goes), choices }], flip (its
// front to the left), body (the main body line's index), R (the body: its outline and measures,
// the frame's units), the strokes in the frame's units (st: [{ pts, ink, type, sh }]), the frame's
// scale (k), arches (wheels in its wheel arches), top (a plane drawn from above) }
export function readParts(strokes, over = {}, face = null, hint = null, ctx = null) {
  const S = strokes.map((s, i) => ({ i, p: s.p, c: s.c, k: s.k, r: s.r })).filter((s) => s.p && s.p.length > 1);
  if (!S.length) return null;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const s of S) {
    for (const [x, y] of s.p) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const k = FRAME_W / Math.max(1e-3, x1 - x0, (y1 - y0) * 0.6);
  const W = (x1 - x0) * k;
  // (as drawn: x right, y up)
  const st = S.map((s) => ({ i: s.i, ink: s.c, kind: s.k, pts: dense(s.p.map(([x, y]) => [(x - x0) * k, (y1 - y) * k])), raw: s.r && s.r.length > 5 ? s.r.map(([x, y]) => [(x - x0) * k, (y1 - y) * k]) : null }));
  for (const o of st) o.sh = measure(o.pts, o.kind, o.raw);
  const D = { x0: 0, x1: W, y0: 0, y1: (y1 - y0) * k, w: W, h: (y1 - y0) * k };
  D.size = Math.max(D.w, D.h);
  const G = new PGrid(st.map((o) => o.pts), 72);
  const prior = familyPrior(ctx, hint);
  const cats = ctx && ctx.cats;
  const len = { air: !!(cats && cats.has('air')), sea: !!(cats && cats.has('sea')), weapon: !!(cats && cats.has('weapon')) };
  const F = { st, D, G, over, len, cls: ctx && ctx.net && ctx.net.best ? ctx.net.best[2] : null };
  // (the player named a part only a thing for the hand has: it is one - a ride with a sight, a
  // silencer on it, a ride still; a part only a ride has: it is one - ROADMAP 11.12)
  const picked = Object.values(over);
  const was = ctx && ctx.frame;
  const handSaid = picked.some((t) => HELD.has(t)) || (was !== 'ride' && picked.some((t) => HAND_ONLY.has(t)));
  const rideSaid = picked.some((t) => RIDES_IT.has(t)) || (was !== 'hand' && picked.some((t) => RIDE_ONLY.has(t)));
  const order = FAMS.slice().sort((a, b) => prior[b] - prior[a]);
  let best = null;
  const tried = [];
  for (const f of order) {
    if (handSaid && f !== 'hand') continue;
    if (rideSaid && f === 'hand') continue;
    // (the unlikely ones are read only while nothing fits yet)
    if (prior[f] < 0.04 && best && best.score >= 0.5) continue;
    const res = PARSE[f](F);
    if (!res) continue;
    // (the build that has a place for more of what was drawn: a little ahead)
    let all = 0;
    let known = 0;
    for (const o of st) {
      all += o.sh.len;
      if (res.labels[o.i] && res.labels[o.i] !== 'deco') known += o.sh.len;
    }
    // (a build that is unmistakable - a plane's wing, fin and propeller; a helicopter's rotor and
    // tail; a balloon on its ropes; a mast with its sail - is that, whatever the network sees)
    const sure = sureOf(res);
    res.sure = sure;
    res.total = prior[f] * res.score * (0.7 + 0.3 * (known / Math.max(1e-6, all)));

    tried.push([f, res.score, res.total]);
    if (!best || res.total > best.total) best = res;
  }
  if (!best) return null;
  // (a parachute drawn over it: the network looks again, at what is under it - a dome over a plane is
  // no car's roof - and it is read again by that; ctx.relook(the lines to look at): what it sees)
  if (ctx && ctx.relook && Object.values(best.labels).includes('chute')) {
    const net2 = ctx.relook(S.map((s) => s.i).filter((i) => best.labels[i] !== 'chute'));
    if (net2) return readParts(strokes, over, face, hint, { ...ctx, net: net2, relook: null });
  }
  // the player's own say over all (what it would be without it: for the menu's "automatic")
  const autoL = Object.assign({}, best.labels);
  for (const o of st) if (over[o.i] && PART[over[o.i]]) best.labels[o.i] = over[o.i];
  // which way it faces: the player's say, else its parts'
  const front = face === true ? -1 : face === false ? 1 : best.front || 1;
  const flip = front < 0;
  // (into the frame it is built in: its front to the right)
  const fx = flip ? (x) => W - x : (x) => x;
  const ost = st.map((o) => {
    const pts = flip ? o.pts.map(([x, y]) => [fx(x), y]) : o.pts;
    const sh = flip ? measure(pts, o.kind, o.raw ? o.raw.map(([x, y]) => [fx(x), y]) : null) : o.sh;
    return { i: o.i, ink: o.ink, kind: o.kind, pts, sh, type: best.labels[o.i] || 'deco' };
  });
  let R = null;
  if (best.R) {
    const loop = best.R.loop ? (flip ? best.R.loop.map(([x, y]) => [fx(x), y]).reverse() : best.R.loop) : null;
    const sh = loop ? Object.assign(shapeOf(loop.concat([loop[0]])), { area: best.R.sh.area }) : flip ? Object.assign({}, best.R.sh, { x0: fx(best.R.sh.x1), x1: fx(best.R.sh.x0), cx: fx(best.R.sh.cx), mx: fx(best.R.sh.mx || best.R.sh.cx) }) : best.R.sh;
    R = { loop, sh, made: !!best.R.made };
  }
  const arches = best.frame === 'ride' ? (best.arches || []).map((a) => ({ ...a, x: fx(a.x) })) : [];
  const parts = ost.map((o) => {
    const auto = autoL[o.i] && autoL[o.i] !== over[o.i] ? autoL[o.i] : over[o.i] ? 'deco' : autoL[o.i] || 'deco';
    return { i: o.i, type: o.type, auto, choices: choicesFor(o.sh, best.frame, auto), at: labelAt(strokes[o.i].p), sh: o.sh };
  });
  const main = best.main ? best.main.i : -1;
  // (the parts no one line is - wheels in its arches, a plane's wings in its outline: where their
  // names go, page units)
  const toPage = ([x, y]) => [x / k + x0, y1 - y / k];
  const implicit = (best.implicit || []).map((q) => ({ type: q.type, at: toPage(q.at) }));
  for (const a of best.frame === 'ride' ? best.arches || [] : []) implicit.push({ type: 'wheel', at: toPage([a.x, a.y + a.r]), guess: !!a.guess });
  // (what the network sees in it, each kind with its chance: game/partsum.js names it by that)
  const guess = ctx && ctx.net && ctx.net.groups ? ctx.net.groups : null;
  const prob = ctx && ctx.net && ctx.net.p ? ctx.net.p : null;
  return { frame: best.frame, family: best.fam, parts, flip, body: main, R, st: ost, k, x0, x1, y0, y1, arches, top: best.top || null, prior, score: best.score, tried, implicit, like: F.dbgLike, guess, prob };
}

// (a steadied line can be a few corners only: points along it, every so often - its shape the same)
function dense(P) {
  let len = 0;
  for (let i = 1; i < P.length; i++) len += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  const step = Math.max(0.02, len / 48);
  const out = [P[0]];
  for (let i = 1; i < P.length; i++) {
    const [ax, ay] = P[i - 1];
    const [bx, by] = P[i];
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / step);
    for (let j = 1; j <= n; j++) out.push([ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n]);
  }
  return out;
}

// how sure it is a ride, by its parts: two wheels (or its arches), a rotor, a sail, a balloon, wings
// seen from above - the rest (wings and an engine, one wheel, a hull) could be other things too
// (ui/freedraw.js asks the network then whether it is a weapon or gear instead)
export function rideEvidence(P) {
  if (!P || P.frame !== 'ride') return 0;
  const T = P.parts.map((q) => q.type);
  const wheels = T.filter((t) => t === 'wheel').length + (P.arches ? P.arches.length : 0);
  if (wheels >= 2 || T.includes('rotor') || T.includes('sail') || T.includes('balloon') || P.top) return 2;
  return T.some((t) => t === 'wheel' || t === 'wing' || t === 'hull' || t === 'prop' || t === 'jet') ? 1 : 0;
}

// a line made a thin closed band round it (a body drawn as a line)
function thickLine(pts, r) {
  const a = pts[0];
  const b = pts[pts.length - 1];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * r;
  const ny = (dx / l) * r;
  return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
}

// where a part's name goes: above its top, at its middle (page units)
function labelAt(p) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  for (const [x, y] of p) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
  }
  return [(x0 + x1) / 2, y0];
}

// what a line of this shape could be (the tag's menu): the likely ones first
function choicesFor(sh, frame, auto) {
  const out = [];
  const add = (...t) => {
    for (const x of t) if (!out.includes(x)) out.push(x);
  };
  add(auto);
  if (sh.round) add('wheel', 'window', 'jet', 'balloon', 'body', 'head');
  else if (sh.coils >= 3) add('spring', 'armor');
  else if (sh.dome) add('chute', 'wing', 'body', 'balloon');
  else if (sh.straight && sh.thin > 2.5) add('barrel', 'blade', 'wing', 'rotor', 'prop', 'skid', 'mast', 'tail', 'grip', 'armor');
  else if (sh.closed && sh.point) add('blade', 'sail', 'fin', 'wing', 'body');
  else if (sh.closed) add('body', 'cabin', 'wheel', 'grip', 'head', 'mag', 'scope', 'stock', 'hull', 'sail', 'balloon', 'blade');
  else add('body', 'wheel', 'barrel', 'wing', 'rotor', 'grip', 'blade', 'armor');
  add('deco');
  // (a ride's parts for a ride, a hand's for the hand - the rest after them)
  const mine = frame === 'hand' ? (t) => !RIDE_ONLY.has(t) : frame === 'ride' ? (t) => !HAND_ONLY.has(t) : () => true;
  return [...out.filter(mine), ...out.filter((t) => !mine(t))].slice(0, 9);
}
