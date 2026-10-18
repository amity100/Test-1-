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
  // (ROADMAP 11.14: a zigzag steadied into straight sides is shorter than the hand drew it - as drawn)
  sh.coils = springy(pts) || (raw && kind === 'poly' ? springy(raw) : 0);
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
  // (ROADMAP 11.16) and of the box it lies in, whichever way it lies - a slanting bar fills its own
  // all the same, a triangle half
  sh.ofill = (sh.closed ? sh.area : sh.cfill * sh.w * sh.h) / Math.max(1e-6, sh.long * sh.thick);
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
function region(G, use, r = 2, along = false, whole = false, op = 2) {
  if (!use.length) return null;
  // (a line drawn round to near where it began: closed, as it was meant)
  const P = use.map((o) => (o.sh.closed && o.sh.endGap > 0 ? o.pts.concat([o.pts[0]]) : o.pts));
  let best = null;
  for (const rr of [r, r + 2]) {
    const solid = G.solid(P, rr);
    const core = G.open(solid, op);
    const pcs = G.pieces(core);
    if (pcs.length && pcs[0].n >= 14) {
      best = { pcs, solid, lines: P };
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
    if (pcs.length && pcs[0].n >= 14 && (!best || pcs[0].n > best.pcs[0].n * 2)) best = { pcs, solid, lines: P2 };
  }
  // (ROADMAP 11.13: what closed a small part of it all - a wing's V, a window - while its outline
  // was drawn in pieces with gaps between them: closed wider, the whole of it, when that is far
  // bigger - an aircraft's, whole: said so)
  if (best && whole) {
    let ux0 = Infinity;
    let ux1 = -Infinity;
    let uy0 = Infinity;
    let uy1 = -Infinity;
    for (const o of use) {
      ux0 = Math.min(ux0, o.sh.x0);
      ux1 = Math.max(ux1, o.sh.x1);
      uy0 = Math.min(uy0, o.sh.y0);
      uy1 = Math.max(uy1, o.sh.y1);
    }
    const p0 = best.pcs[0];
    const small = p0.n * G.cell * G.cell < (ux1 - ux0) * (uy1 - uy0) * 0.06 || Math.max(p0.i1 - p0.i0 + 1, p0.j1 - p0.j0 + 1) * G.cell < Math.max(ux1 - ux0, uy1 - uy0) * 0.3;
    if (small && use.length > 1) {
      // (each loose end joined to the nearest line near it - and the two left loose, if two are, to
      // each other: an outline drawn in pieces, a part of it not drawn at all; then thicker)
      const size = Math.max(ux1 - ux0, uy1 - uy0);
      const join = [];
      const loose = [];
      use.forEach((o, i) => {
        if (o.sh.closed) return;
        for (const p of [o.pts[0], o.pts[o.pts.length - 1]]) {
          let q = null;
          let d = size * 0.12;
          use.forEach((u, j) => {
            if (j === i) return;
            for (const t of u.pts) {
              const e = Math.hypot(t[0] - p[0], t[1] - p[1]);
              if (e < d) {
                d = e;
                q = t;
              }
            }
          });
          if (q) join.push([p, q]);
          else loose.push(p);
        }
      });
      if (loose.length === 2 && Math.hypot(loose[0][0] - loose[1][0], loose[0][1] - loose[1][1]) < size * 0.7) join.push([loose[0], loose[1]]);
      for (const [PP, rr] of [[P.concat(join), r], [P.concat(join), r + 2], [P, r + 4]]) {
        const solid = G.solid(PP, rr);
        const pcs = G.pieces(G.open(solid, 2));
        if (pcs.length && pcs[0].n > best.pcs[0].n * 3) {
          best = { pcs, solid, lines: PP };
          break;
        }
      }
    }
  }
  if (!best) return null;
  const piece = best.pcs[0];
  const g = regrow(G, piece, best.solid, best.lines);
  const dm = G.dist(g);
  const loop = simplifyLoop(G.outline(g), G.cell * 0.55);
  if (loop.length < 3) return null;
  const sh = shapeOf(loop.concat([loop[0]]));
  let n = 0;
  for (let k = 0; k < g.length; k++) n += g[k];
  sh.area = n * G.cell * G.cell;
  return { g, dm, loop, sh, piece, pieces: best.pcs };
}

// (ROADMAP 11.16) the body's piece with what the thinning took off what its lines close round put
// back - a tank's hull drawn flat and coming to a point, a tail drawn tapering: the inside of a line
// drawn round is the body's to its tip. Grown from the piece through what is inside the lines (never
// across a line: a sail, a wing standing off it on a line of its own stays off it), then the lines
// round what it grew into
function regrow(G, piece, solid, lines) {
  const N = G.nx * G.ny;
  const inkD = G.dilate(G.ink(lines), 1);
  const g = G.only(piece);
  const q = piece.cells.slice();
  const nb = [1, 0, -1, 0, 0, 1, 0, -1];
  let added = 0;
  while (q.length) {
    const k = q.pop();
    const i = k % G.nx;
    const j = (k - i) / G.nx;
    for (let t = 0; t < 8; t += 2) {
      const a = i + nb[t];
      const b = j + nb[t + 1];
      if (a < 0 || b < 0 || a >= G.nx || b >= G.ny) continue;
      const kk = b * G.nx + a;
      if (g[kk] || !solid[kk] || inkD[kk]) continue;
      g[kk] = 1;
      q.push(kk);
      added++;
    }
  }
  if (!added) return g;
  const grown = G.dilate(g, 2);
  for (let k = 0; k < N; k++) if (grown[k] && solid[k]) g[k] = 1;
  return g;
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
    // (ROADMAP 11.16: a triangle at the very front or back of it all is no wheel - a cowcatcher, a
    // blade - nor a shape set against the side of a bigger one: a truck's cab, a locomotive's)
    if (!over[o.i] && sh.closed && !sh.scribble && !sh.round && sh.fill < 0.6 && (!sh.fit || sh.fit.err > 0.2) && (sh.x0 < D.x0 + D.w * 0.02 || sh.x1 > D.x1 - D.w * 0.02) && widthAt(o.pts, sh.y0 + sh.h * 0.08) > sh.w * 0.8) continue;
    if (!over[o.i] && (sh.closed || sh.endGap < sh.size * 0.5) && besideBody(o, st, D)) continue;
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
    } else if (aspect <= 2.4 && !(sh.thin > 2.8 && sh.slant > 0.3 && sh.slant < 1.25) && !(!sh.closed && o.kind === 'poly' && vTip(o.pts))) {
      // (ROADMAP 11.14: nor a V of straight lines - a flame out of its back, however close its two
      // ends are)
      // (ROADMAP 11.14: long and thin, slanting - a wing hanging under it, seen from a little above:
      // no wheel, however its box is)
      const shut = sh.closed || sh.endGap < size * 0.42;
      // (round and round: a spiral, a loop drawn twice)
      const loops = !sh.closed && sh.cover > 5.5 && aspect <= 1.8 && sh.len > size * 2.4;
      if (shut || sh.scribble || sh.roundish || loops || (sh.cover > 4.4 && sh.ecv < 0.18)) {
        c = { cx: sh.mx, cy: sh.my, r: (sh.w + sh.h) / 4 };
        q = sh.round ? 1 : sh.roundish ? 0.9 : sh.scribble || loops ? 0.8 : sh.closed ? 0.62 : 0.55;
        if (aspect > 1.7) q *= 0.75;
        // (a box is no wheel: its corners out to its box's - nor, ROADMAP 11.14, a slanting shape that
        // fills little of its box: a wing hanging under it)
        if (sh.closed && sh.fill > 0.9) q *= 0.6;
        else if (sh.closed && sh.fill < 0.6 && sh.slant > 0.3 && sh.slant < 1.25) q *= 0.6;
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

// (ROADMAP 11.16) how many times a line goes round, all told (a loop once; a puff of loops three
// times; a zigzag none)
function netTurns(P) {
  let t = 0;
  let a0 = null;
  for (let i = 2; i < P.length; i += 2) {
    const a = Math.atan2(P[i][1] - P[i - 2][1], P[i][0] - P[i - 2][0]);
    if (a0 !== null) {
      let d = a - a0;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      t += d;
    }
    a0 = a;
  }
  return t / (Math.PI * 2);
}

// (ROADMAP 11.16) how far a point is from a line (closed: round back to its start)
function toLine(p, P, closed = false) {
  let m = Infinity;
  const n = P.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = P[i];
    const b = P[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / Math.max(1e-12, dx * dx + dy * dy)));
    m = Math.min(m, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  }
  return m;
}

// (ROADMAP 11.16) a short line out from an outline - a leg, a strut: one end on it, the other well
// out of it - is no more of what it stands out from, however near its edge most of it is drawn
function sticksOut(o, R) {
  const sh = o.sh;
  const B = R.sh;
  if (sh.closed || !R.loop || sh.size > B.h * 0.8) return false;
  const p = o.pts[0];
  const q = o.pts[o.pts.length - 1];
  const a = toLine(p, R.loop, true);
  const b = toLine(q, R.loop, true);
  const far = a > b ? p : q;
  return Math.max(a, b) > Math.max(B.h * 0.1, sh.long * 0.55) && Math.min(a, b) < B.h * 0.12 && !inPoly(far[0], far[1], R.loop);
}

// (ROADMAP 11.16) how much of a line is spent in small loops, each closed where it crosses itself
// (a puff of smoke: most of it; a body outline with a curl in it, a wheel with a tail: little)
function loopShare(P, size) {
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let all = 0;
  for (let i = 1; i < P.length; i++) all += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  let inLoops = 0;
  let i = 0;
  while (i < P.length - 3) {
    let cut = -1;
    for (let j = i + 2; j < P.length - 1; j++) {
      const [a, b, c, d] = [P[i], P[i + 1], P[j], P[j + 1]];
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) {
        // (the first place it crosses back: a small loop, or the whole outline round)
        let x0 = Infinity;
        let x1 = -Infinity;
        let y0 = Infinity;
        let y1 = -Infinity;
        for (let k = i + 1; k <= j; k++) {
          x0 = Math.min(x0, P[k][0]);
          x1 = Math.max(x1, P[k][0]);
          y0 = Math.min(y0, P[k][1]);
          y1 = Math.max(y1, P[k][1]);
        }
        if (Math.max(x1 - x0, y1 - y0) < size * 0.6) cut = j;
        break;
      }
    }
    if (cut < 0) {
      i++;
      continue;
    }
    for (let k = i + 1; k <= cut; k++) inLoops += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]);
    i = cut + 1;
  }
  return inLoops / Math.max(1e-9, all);
}

// (ROADMAP 11.16) a closed shape set against the side of a bigger one - a truck's cab against its
// box, a locomotive's cab against its boiler: its side along that one's line, up and down, on one
// side of it, its middle up off that one's bottom. A wheel meets its body at its top (an arch drawn
// round it, both sides), or crosses its bottom line - never along one side
function besideBody(o, st, D) {
  const sh = o.sh;
  const r = (sh.w + sh.h) / 4;
  // (drawn fast, beside it - a little gap between them)
  const d = Math.max(sh.size * 0.08, D.size * 0.025);
  for (const q of st) {
    if (q === o || q.sh.size < sh.size * 1.15 || !(q.sh.closed || q.sh.endGap < q.sh.size * 0.4)) continue;
    if (sh.my < q.sh.y0 + r * 0.25) continue;
    // (right at its end, as high as it is, on the same ground as it - a cab's bottom is the box's: a
    // wheel there hangs lower than what it carries)
    const over = Math.min(sh.y1, q.sh.y1) - Math.max(sh.y0, q.sh.y0);
    if ((Math.abs(sh.x0 - q.sh.x1) < d * 1.2 || Math.abs(sh.x1 - q.sh.x0) < d * 1.2) && over > sh.h * 0.6 && sh.my > q.sh.y0 + r * 0.35 && Math.abs(sh.y0 - q.sh.y0) < q.sh.h * 0.15 && sh.y1 > q.sh.y0 + q.sh.h * 0.6) return true;
    // (how near to its line - not to the points it is drawn in, far apart on a long straight side;
    // set against it, not drawn across its edge - a wheel half up in its body is a wheel)
    const inQ = q.sh.closed ? o.pts.filter(([x, y]) => inPoly(x, y, q.pts)).length / o.pts.length : 0;
    if (inQ > 0.3 && inQ < 0.85) continue;
    // (one inside it, against its end: as near as its points come)
    const near = inQ < 0.3 ? o.pts.filter((p) => toLine(p, q.pts) < d * 1.1) : o.pts.filter(([x, y]) => q.pts.some(([u, v]) => Math.abs(u - x) + Math.abs(v - y) < d));
    if (near.length < o.pts.length * 0.07) continue;
    const L = near.filter(([x]) => x < sh.mx - r * 0.55);
    const Rt = near.filter(([x]) => x > sh.mx + r * 0.55);
    const side = L.length > Rt.length ? L : Rt;
    if (side.length < near.length * 0.6) continue;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [x, y] of side) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    if (y1 - y0 > sh.h * 0.4 && x1 - x0 < (y1 - y0) * 0.6) return true;
  }
  return false;
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
// (ROADMAP 11.14) a wing as most draw one, seen from a little over it: a long shape slanting off what
// it is on - closed, or open at its root, where it meets that
// (ROADMAP 11.15) a wedge: closed, coming to a point, half filled as a triangle is - a blade, a
// spike (a barrel drawn tapering fills its box)
const wedge = (sh) => sh.closed && !!sh.point && sh.fill < 0.66 && sh.thin < 5;

function wingLike(sh, thin = 3) {
  if (!(sh.slant > 0.3 && sh.slant < 1.25)) return false;
  if (sh.closed || sh.endGap < sh.long * 0.4) return sh.thin > thin;
  return sh.endGap < sh.long * 0.6 && sh.thin > 2.3 && sh.dev > 0.3;
}

function addedPart(o, R, r, len, wheelTop = -Infinity, kin = null) {
  const sh = o.sh;
  const B = R.sh;
  const L = B.w;
  const H = B.h;
  const gap = r.gap;
  const air = !!len.air;
  // (ROADMAP 11.16: the player said it flies - a zigzag lying out past its end about its middle's
  // height is a flame out of it, a jet pushing it: no spring)
  if (air && sh.coils >= 3 && sh.slant < 0.45 && sh.w > sh.h * 1.5 && Math.abs(sh.cy - B.cy) < H * 0.45 && gap < L * 0.08 && (sh.x1 < B.x0 + L * 0.08 || sh.x0 > B.x1 - L * 0.08)) return 'jet';
  // coils: a spring (under it, or at an end)
  if (sh.coils >= 3 && sh.cy < B.cy + H * 0.2 && gap < H * 0.5) return 'spring';
  // (ROADMAP 11.13: the player said it flies - a level line over the middle of its roof, not out
  // past its ends: its rotor, not a gun)
  if (air && !sh.closed && sh.straight && sh.slant < 0.25 && sh.y0 > B.y1 - H * 0.12 && Math.abs(sh.cx - B.cx) < L * 0.3 && sh.x0 > B.x0 - L * 0.1 && sh.x1 < B.x1 + L * 0.1 && sh.long > L * 0.3) return 'rotor';
  // a barrel: long, thin and straight, from it out past its front or back (or slanting up off
  // its top: a gun on a turret)
  const barrelish = sh.straight && sh.thin > 2.8 && sh.long > L * (kin === 'plane' ? 0.2 : 0.12) && sh.long < L * 1.1;
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
    const low = kin !== 'copter' && (sh.cy < B.y0 + H * 0.28 || sh.cy < wheelTop);
    if ((past && sh.slant < 0.5 && !low) || upOff) return 'barrel';
  }
  // (ROADMAP 11.14: the player said it flies - a long thin box lying along its roof: a gun on it)
  // (as long as a quarter of it at least: a police car's light bar is none)
  if (air && boxy && sh.closed && sh.thin > 5 && sh.slant < 0.25 && gap < H * 0.25 && sh.y0 > B.y1 - H * 0.2 && sh.long > L * 0.25 && sh.long < L * 0.8) return 'barrel';
  // (one out of a turret on top, forward, level - inside its length or not: a tank's gun; not as
  // long as it is, its roof's edge. Mostly out of it - or its end well out over its hood: drawn
  // close over its roof, a small drawing's edge takes in the rest)
  const clear = clearOf(o.pts, R);
  const out = r.fo > (r.far > L * 0.12 ? 0.38 : 0.55) || clear > H * 0.4;
  if ((!roofed || clear > H * 0.25) && (sh.long < L * 0.8 || kin === 'tank' || kin === 'cannon') && (sh.straight || (boxy && sh.thin > 3.2)) && sh.thin > 3 && gap < L * 0.06 && out && sh.long > L * 0.18 && sh.long < L * 1.1 && sh.slant < 0.6 && sh.cy > B.y0 + H * 0.45 && !(len.fan && len.fan.has(o.i))) return 'barrel';
  // (ROADMAP 11.14) a flame out of its back, about its middle's height - a V lying on its side, its
  // point away from it; a pointed shape the player said flies; a short tube level out of its end, a
  // nozzle: a jet, pushing it
  const out1 = sh.cx < B.cx ? -1 : 1;
  const endX = out1 < 0 ? B.x0 : B.x1;
  // (one standing up there is a propeller, read below - a flame lies along it)
  if (air && !(sh.h > sh.w * 1.6) && gap < L * 0.06 && Math.abs(sh.cy - B.cy) < H * 0.4 && sh.size > H * 0.15 && sh.size < Math.max(H * 1.2, L * 0.3) && (endX - sh.cx) * -out1 > 0 && (out1 < 0 ? sh.x0 < B.x0 - L * 0.04 : sh.x1 > B.x1 + L * 0.04)) {
    const tip = !sh.closed ? vTip(o.pts) : sh.point ? [sh.tipX, sh.tipY] : null;
    if (tip && (tip[0] - endX) * out1 > sh.w * 0.5 && Math.abs(tip[1] - B.cy) < H * 0.45) return 'jet';
    if ((sh.closed || sh.endGap < sh.long * 0.35) && sh.thin > 1.4 && sh.thin < 4 && sh.slant < 0.35 && Math.abs(sh.cy - B.cy) < H * 0.3 && sh.size > H * 0.25) return 'jet';
  }
  // (ROADMAP 11.14) the player said it flies - standing just past its front or its back, about its
  // middle's height: a propeller
  if (air && (sh.closed || sh.straight) && sh.h > sh.w * 1.6 && sh.size > H * 0.3 && sh.size < Math.max(H * 1.6, L * 0.35) && gap < L * 0.1 && Math.abs(sh.cy - B.cy) < H * 0.6 && (sh.x0 > B.x1 - L * 0.04 || sh.x1 < B.x0 + L * 0.04)) return 'prop';
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
    // (ROADMAP 11.14: on a mast of its own, wherever along it - one at each end, a drone's)
    const masted = air && o.onMast && sh.cx > B.x0 - L * 0.05 && sh.cx < B.x1 + L * 0.05;
    if (flat && sh.long > L * (masted ? 0.2 : air ? 0.35 : 0.5) && (Math.abs(sh.cx - B.cx) < L * 0.35 || masted) && (gap > H * (air ? 0.03 : 0.1) || masted)) return 'rotor';
  }
  // (ROADMAP 11.14) the player said it flies - a wing seen from a little over it, as most draw one: a
  // long shape off its middle, down from its belly or up off its back
  if (air && wingLike(sh) && sh.cx > B.x0 + L * 0.08 && sh.cx < B.x1 - L * 0.08 && gap < H * 0.25 && sh.size > H * 0.6 && sh.size < L * 0.9 && ((sh.y1 > B.y0 - H * 0.15 && sh.y0 < B.y0 - H * 0.3) || (sh.y0 < B.y1 + H * 0.15 && sh.y1 > B.y1 + H * 0.45))) return 'wing';
  // a wing across it, side on: long, flat and thin, level, about its middle, out past it
  if (sh.thin > 3.2 && sh.slant < 0.3 && sh.long > L * (air ? 0.3 : 0.45) && sh.cy > B.y0 + H * 0.1 && sh.cy < B.y1 - H * 0.1 && (sh.x0 < B.x0 - L * 0.08 || sh.x1 > B.x1 + L * 0.08) && sh.x0 < B.cx && sh.x1 > B.cx && r.fo > 0.3) return 'wing';
  return null;
}

// (ROADMAP 11.14) what its body is made of, its springs left out - coils are never a body (unless
// they are all there is)
function noCoils(use, over, D) {
  const coil = (o) => o.sh.coils >= 3 && !over[o.i] && !o.sh.closed && o.sh.size < D.size * 0.35 && (o.sh.y1 < D.y0 + D.h * 0.5 || o.sh.x1 < D.x0 + D.w * 0.2 || o.sh.x0 > D.x1 - D.w * 0.2);
  const keep = use.filter((o) => !coil(o));
  return keep.length ? keep : use;
}

// (ROADMAP 11.14) a V: a line out and back again - its point, the far end of it from where its two
// ends are (null: no V, its ends far apart, or no point to it)
function vTip(pts) {
  const a = pts[0];
  const b = pts[pts.length - 1];
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const gap = Math.hypot(a[0] - b[0], a[1] - b[1]);
  let tip = null;
  let d = 0;
  for (const p of pts) {
    const e = Math.hypot(p[0] - m[0], p[1] - m[1]);
    if (e > d) {
      d = e;
      tip = p;
    }
  }
  return tip && d > gap * 0.7 && gap > d * 0.25 ? tip : null;
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
  // (ROADMAP 11.14) a track: one long flat loop along its bottom, something as big as a body over
  // it - a tank's, a digger's (game/partrole.js: a wheel drawn so is a track); what wheels were
  // drawn, in it: its road wheels
  let track = null;
  // (the bottom of it: of what is wide and level - a wing hanging lower is none)
  const floorY = Math.min(D.y1, ...st.filter((q) => q.sh.w > D.w * 0.3 && q.sh.slant < 0.3).map((q) => q.sh.y0));
  for (const o of st) {
    if (wheelI.has(o.i) || (over[o.i] && over[o.i] !== 'wheel')) continue;
    const sh = o.sh;
    if (!(sh.closed || sh.endGap < sh.long * 0.2) || sh.w < sh.h * 2.2 || sh.w < D.w * 0.35 || sh.h > D.h * 0.35 || sh.y0 > floorY + D.h * 0.12 || sh.cy > D.y0 + D.h * 0.45) continue;
    if (!st.some((q) => q !== o && q.sh.closed && q.sh.w > sh.w * 0.6 && q.sh.y0 < sh.y1 + sh.h * 0.3 && q.sh.y0 > sh.y1 - sh.h * 0.6 && q.sh.cy > sh.y1)) continue;
    if (wheels.some((c) => c.cy - c.r < sh.y0 - sh.h * 0.1 || c.cx < sh.x0 || c.cx > sh.x1 || c.cy + c.r > sh.y1 + sh.h * 0.15)) continue;
    if (!track || sh.w > track.sh.w) track = o;
  }
  // (ROADMAP 11.16: drawn in two strokes - one half its top, the other its bottom, their ends meeting:
  // one loop, the two of them)
  let track2 = null;
  if (!track) {
    const e = D.w * 0.06;
    for (const a of st) {
      if (track || wheelI.has(a.i) || over[a.i] || a.sh.closed || a.sh.w < D.w * 0.25) continue;
      for (const b of st) {
        if (b === a || wheelI.has(b.i) || over[b.i] || b.sh.closed || b.sh.w < D.w * 0.15) continue;
        // (one end of each meeting, the loop they make nearly closed at its other)
        const ra = a.pts.slice().reverse();
        const rb = b.pts.slice().reverse();
        // (its two ends meeting the other's - near enough, drawn fast: a little apart, or over each other)
        const d2 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
        let best = null;
        for (const [p, q] of [[a.pts, b.pts], [a.pts, rb], [ra, b.pts], [ra, rb]]) {
          const g = d2(p[p.length - 1], q[0]) + d2(q[q.length - 1], p[0]);
          if (d2(p[p.length - 1], q[0]) < e * 2.5 && d2(q[q.length - 1], p[0]) < e * 2.5 && (!best || g < best.g)) best = { g, loop: p.concat(q) };
        }
        if (!best) continue;
        const sh = shapeOf(best.loop);
        if (sh.w < sh.h * 2.2 || sh.w < D.w * 0.35 || sh.h > D.h * 0.45 || sh.y0 > floorY + D.h * 0.12 || sh.cy > D.y0 + D.h * 0.45) continue;
        if (!st.some((q) => q !== a && q !== b && q.sh.closed && q.sh.w > sh.w * 0.6 && q.sh.y0 < sh.y1 + sh.h * 0.3 && q.sh.y0 > sh.y1 - sh.h * 0.6 && q.sh.cy > sh.y1)) continue;
        track = { i: a.i, sh };
        track2 = b;
        break;
      }
    }
  }
  if (track) {
    labels[track.i] = 'wheel';
    wheelI.add(track.i);
  }
  if (track2) {
    labels[track2.i] = 'wheel';
    wheelI.add(track2.i);
  }
  // (a hub in a wheel, its spokes: the wheel's)
  const inWheel = (o) => wheels.some((c) => !wheelI.has(o.i) && o.sh.size < c.r * 2.3 && inCircle(o.pts, c) > 0.75);
  // (a barrel drawn as a long thin box, out past the rest of it: not body - kept out of it)
  const rest = st.filter((o) => !wheelI.has(o.i));
  const gun = new Set();
  const longest = rest.reduce((a, o) => (!a || o.sh.long > a.sh.long ? o : a), null);
  for (const o of rest) {
    const sh = o.sh;
    const boxy = sh.closed || sh.endGap < sh.long * 0.35;
    // (ROADMAP 11.14: as thin as a gun is - a tank's hull, flat and long, is none)
    if (over[o.i] || o === longest || sh.thin < 3.2 || sh.long < D.w * 0.15 || sh.slant > 0.7 || !(sh.straight || boxy) || sh.thick > D.h * 0.2) continue;
    // (ROADMAP 11.15: a wedge, coming to a point - a blade, read below)
    if (wedge(sh)) continue;
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
  // (ROADMAP 11.15: a wedge out of its front or its back, its point well out past the rest of it -
  // a blade on it, a spike: no body either; on one that flies, a flame there is read below)
  const edged = new Set();
  for (const o of rest) {
    const sh = o.sh;
    if (over[o.i] || o === longest || !wedge(sh) || sh.size > D.w * 0.3 || sh.slant > 0.6) continue;
    let bx0 = Infinity;
    let bx1 = -Infinity;
    let by0 = Infinity;
    let by1 = -Infinity;
    for (const q of rest) {
      if (q === o || gun.has(q.i) || q.sh.size < sh.size * 1.5) continue;
      bx0 = Math.min(bx0, q.sh.x0);
      bx1 = Math.max(bx1, q.sh.x1);
      by0 = Math.min(by0, q.sh.y0);
      by1 = Math.max(by1, q.sh.y1);
    }
    if (!(bx1 > bx0)) continue;
    const fwd = sh.tipX > bx1 + D.w * 0.03 && sh.x0 > bx1 - sh.w * 0.5;
    const aft = !F.len.air && sh.tipX < bx0 - D.w * 0.03 && sh.x1 < bx0 + sh.w * 0.5;
    // (on it: touching the body's end - one held out on a pole is a flag, no blade)
    let gap = Infinity;
    for (const q of rest) {
      if (q === o || gun.has(q.i) || q.sh.size < sh.size * 1.5) continue;
      for (const [x, y] of o.pts) for (const [u, w] of q.pts) gap = Math.min(gap, Math.abs(x - u) + Math.abs(y - w));
    }
    // (ROADMAP 11.16: its point down to the road, a little under its bottom - a cowcatcher)
    if ((fwd || aft) && sh.tipY > by0 - (by1 - by0) * 0.35 && sh.tipY < by1 && gap < D.w * 0.04) edged.add(o.i);
  }
  // (ROADMAP 11.14: a flame out of its end - a V lying on its side, its point the far end of all of
  // it: no body either)
  for (const o of F.len.air ? rest : []) {
    const sh = o.sh;
    if (over[o.i] || sh.closed || sh.size > D.w * 0.35) continue;
    const tip = vTip(o.pts);
    if (!tip) continue;
    const mx = (o.pts[0][0] + o.pts[o.pts.length - 1][0]) / 2;
    const my = (o.pts[0][1] + o.pts[o.pts.length - 1][1]) / 2;
    if (Math.abs(tip[0] - mx) > Math.abs(tip[1] - my) * 1.5 && (tip[0] < D.x0 + D.w * 0.02 || tip[0] > D.x1 - D.w * 0.02)) gun.add(o.i);
  }
  // (and a propeller standing just past its end - a thin upright loop: no body either)
  for (const o of F.len.air ? rest : []) {
    const sh = o.sh;
    if (over[o.i] || gun.has(o.i) || !sh.closed || sh.h < sh.w * 2.2 || sh.size > D.h * 0.9) continue;
    let bx0 = Infinity;
    let bx1 = -Infinity;
    for (const q of rest) {
      if (q === o || q.sh.size < sh.size * 0.8) continue;
      bx0 = Math.min(bx0, q.sh.x0);
      bx1 = Math.max(bx1, q.sh.x1);
    }
    if (sh.x1 < bx0 + D.w * 0.02 || sh.x0 > bx1 - D.w * 0.02) gun.add(o.i);
  }
  // (ROADMAP 11.14: the player said it flies - a long thin shape slanting off it, out under it or
  // over it, is a wing seen from a little above, no body)
  const hangs = (o) => F.len.air && !over[o.i] && wingLike(o.sh, 3.5) && o.sh.slant > 0.35 && o.sh.slant < 1.2 && o.sh.size > D.size * 0.25 && (o.sh.y0 < D.y0 + D.h * 0.05 || o.sh.y1 > D.y1 - D.h * 0.05);
  // (ROADMAP 11.16: round and round, open - a puff of smoke, a cloud, a scribble: no body, however
  // near it is drawn. Not the drawing's main line, and not a line going round once with a curl or
  // two in it - a body drawn so)
  const biggest = Math.max(...st.map((o) => o.sh.size));
  const loopy = (o) => !o.sh.closed && !over[o.i] && o.sh.size < biggest * 0.7 && Math.abs(netTurns(o.pts)) > 1.8 && loopShare(o.pts, o.sh.size) > 0.55;
  const use = st.filter((o) => !wheelI.has(o.i) && !gun.has(o.i) && !edged.has(o.i) && !inWheel(o) && !hangs(o) && !loopy(o) && (!over[o.i] || BODYISH.has(over[o.i])) && (o.sh.closed || o.sh.size > D.size * 0.1));
  // (ROADMAP 11.14: the player said it flies - coils low under it or at its ends are its spring, no
  // part of its body; ROADMAP 11.15: on wheels too)
  const useB = noCoils(use, over, D);
  let R = region(G, useB) || region(G, use) || region(G, use.concat(named(F, wheelI)));
  // a bike: two big wheels, and between them a frame of lines - no box of a body
  // (ROADMAP 11.14: big for the two of them - a flame, a gun out past them makes it all no shorter)
  const wspan = wheels.length === 2 ? Math.max(...wheels.map((c) => c.cx + c.r)) - Math.min(...wheels.map((c) => c.cx - c.r)) : D.w;
  const bigWheels = wheels.length === 2 && wheels.every((c) => c.r > Math.min(D.w, wspan * 1.15) * 0.11);
  // (ROADMAP 11.14: a spring under it no part of what closes - a bike on a spring is a bike)
  const Rb = bigWheels && R ? region(G, noCoils(use, over, D)) : R;
  if (bigWheels && (!R || !Rb || Rb.sh.area < Math.PI * wheels[0].r * wheels[1].r * 0.9)) return parseBike(F, wheels, labels, inWheel);
  // (what closes a small part of it all - its body drawn as a line over it, its bottom not drawn:
  // closed along its bottom - ROADMAP 11.11)
  if (R && R.sh.area < D.w * D.h * 0.12) R = region(G, useB, 2, true) || R;
  // (ROADMAP 11.14: a deck - one long thin closed shape, thinner than the rest of a body is read by,
  // and what closes is a little of it: it, as drawn, its body - a skateboard's)
  const deck = useB.find((o) => o.sh.closed && o.sh.thin > 6 && o.sh.w > D.w * 0.6 && o.sh.slant < 0.2);
  if (deck && (!R || R.sh.w < deck.sh.w * 0.5)) R = region(G, [deck], 1, false, false, 1) || R;
  // (ROADMAP 11.16) a pointed shape standing off its top or hanging under it - a triangle, its point
  // away from it, its foot a small part of its length - is none of its body (a cabin is boxy, or
  // round over its top): a wing (said to fly; at its end, up off it, a tail fin), a sail (said to
  // sail, tall), else a fin - and the body is what the rest close round
  const main0 = useB.reduce((a, o) => (!a || o.sh.w * o.sh.h > a.sh.w * a.sh.h ? o : a), null);
  if (R && !deck && main0) {
    // (the body's own line: what it stands up off, hangs under)
    const B0 = main0.sh;
    const peel = {};
    for (const o of useB) {
      const sh = o.sh;
      if (o === main0 || over[o.i] || sh.size < B0.size * 0.08 || sh.w > B0.w * 0.5 || sh.thin > 4.5) continue;
      if (!(sh.closed || sh.endGap < sh.size * 0.7)) continue;
      // (half fills what it is drawn in, whichever way it lies - a triangle; a ladder, a bar
      // slanting off it fills its own)
      if (!(sh.point || sh.ofill < 0.62)) continue;
      // (a part of what it looks like from its side - its outline: a window drawn in its cabin,
      // however pointed, is none)
      if (relate(G, R, o).fe < 0.45) continue;
      // (said only to drive: standing up off it to a point, taller than its foot, not small - a
      // fin, a spoiler; a cabin drawn low and pointed stays its cabin, a siren its light, and what
      // hangs under it is its wheels)
      // (its point up - not forward: a fairing, a windscreen)
      const tip = sh.closed ? (sh.point ? [sh.tipX, sh.tipY] : null) : vTip(o.pts);
      if (!F.len.air && !F.len.sea && (BIKE_KIN.has(F.cls) || !(sh.cy > B0.y0 + B0.h * 0.6 && sh.size > B0.w * 0.18 && (sh.cx < B0.x0 + B0.w * 0.3 || sh.cx > B0.x1 - B0.w * 0.3) && sh.h > sh.w * 0.55 && tip && tip[1] > sh.y0 + sh.h * 0.75))) continue;
      // (over it or under it - not out past its ends: an engine there, a flame)
      if (sh.x1 < B0.x0 + B0.w * 0.05 || sh.x0 > B0.x1 - B0.w * 0.05) continue;
      const up = sh.cy > B0.y0 + B0.h * 0.6;
      const down = sh.cy < B0.y0 + B0.h * 0.3;
      if (!up && !down) continue;
      if (o.pts.filter(([x, y]) => !inPoly(x, y, main0.pts)).length < o.pts.length * 0.6) continue;
      const end = sh.cx < B0.x0 + B0.w * 0.22 || sh.cx > B0.x1 - B0.w * 0.22;
      peel[o.i] = F.len.air ? (end && up ? 'fin' : 'wing') : F.len.sea && up && sh.h > B0.h * 0.45 ? 'sail' : 'fin';
    }
    const ids = Object.keys(peel).map(Number);
    const R2 = ids.length ? region(G, useB.filter((o) => !(o.i in peel))) : null;
    if (R2) {
      R = R2;
      for (const i of ids) labels[i] = peel[i];
    }
  }
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
    if (edged.has(o.i)) {
      labels[o.i] = 'blade';
      continue;
    }
    const r = relate(G, R, o);
    o.rel = r;
    // (ROADMAP 11.16) one big line drawn round most of what the body is: the body, whatever thin bit of
    // it the thinning left out of what closes - a tank's hull drawn flat, coming to a point
    const bigOne = !over[o.i] && (o.sh.closed || o.sh.endGap < o.sh.size * 0.2) && o.sh.size > B.size * 0.6 && r.fo < 0.5;
    // (ROADMAP 11.15: a long thin box lying on its roof, drawn close on it - its edge along the
    // roof's: a gun on it still, no cabin; a police car's light bar (short), a fire engine's ladder
    // (long, its rungs in it) are none - unless the player said what is at its end is a silencer)
    // (on its top where it lies: its roof, its bonnet)
    const topAt = (x) => {
      const sp = R.loop ? spanAt(R.loop.concat([R.loop[0]]), Math.min(B.x1 - B.w * 0.01, Math.max(B.x0 + B.w * 0.01, x))) : null;
      return sp ? sp[1] : B.y1;
    };
    if (!over[o.i] && o.sh.closed && o.sh.thin > 6 && o.sh.slant < 0.25 && o.sh.cy > B.cy && o.sh.y0 > Math.min(B.y1 - B.h * 0.2, topAt(o.sh.cx) - B.h * 0.12) && o.sh.long > B.w * 0.15 && o.sh.long < B.w * 0.85 && r.fi < 0.5) {
      const sh = o.sh;
      const near = (q) => q.sh.x1 > sh.x0 - sh.thick * 2 && q.sh.x0 < sh.x1 + sh.thick * 2 && q.sh.y1 > sh.y0 - sh.thick * 2 && q.sh.y0 < sh.y1 + sh.thick * 2;
      const muzzled = st.some((q) => q !== o && (over[q.i] === 'silencer' || over[q.i] === 'scope') && near(q));
      const rungs = st.some((q) => q !== o && q.sh.slant > 1 && q.sh.size < sh.thick * 3 && q.sh.cx > sh.x0 && q.sh.cx < sh.x1 && q.sh.cy > sh.y0 - sh.thick && q.sh.cy < sh.y1 + sh.thick);
      const roofy = ROOF_KIN.has(F.cls) && F.clsP > 0.5;
      if (F.len.air || muzzled || !roofy || (sh.thin > 7 && sh.long > B.w * 0.3 && sh.long < B.w * 0.6 && !rungs)) {
        labels[o.i] = 'barrel';
        continue;
      }
    }
    if (r.fo <= 0.28 || bigOne) {
      if (r.fe >= 0.5 || (r.fe >= r.fi && o.sh.size > B.size * 0.3) || bigOne) {
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
    o.onMast = mastUnder(st, o, B);
    labels[o.i] = addedPart(o, R, r, F.len, wheelTop, F.cls) || 'deco';
  }
  // (a closed one sitting on its top, as big as a cabin: its cabin)
  for (const o of st) {
    if (labels[o.i] !== 'body' || o === main || !o.sh.closed) continue;
    if (o.sh.cy > B.y0 + B.h * 0.55 && o.sh.w < B.w * 0.8) labels[o.i] = 'cabin';
  }
  // its wheel arches drawn in it, and fewer wheels than that: its wheels in them
  const arches = wheels.length < 2 && !track && !HAND_CLS.has(F.cls) ? archesOf(R.loop, B, wheels, st.filter((o) => labels[o.i] === 'body').map((o) => o.pts)) : [];
  // (one wheel drawn, at one end, under a long body: the other is there too, at its other end -
  // only half drawn, or hidden)
  if (wheels.length === 1 && !track && !arches.length && B.w > B.h * 1.5) {
    const w = wheels[0];
    const x = B.cx * 2 - w.cx;
    if (Math.abs(x - w.cx) > w.r * 2.2 && x - w.r > B.x0 - B.w * 0.05 && x + w.r < B.x1 + B.w * 0.05) arches.push({ x, y: w.cy, r: w.r, guess: true });
  }
  // (a track: what it stands on, as two wheels are)
  const nW = (track ? 2 : 0) + wheels.length + arches.reduce((a, q) => a + (q.guess ? 0.6 : 1), 0);
  let score = nW >= 2 ? 1 : nW >= 1.5 ? 0.7 : nW >= 1 ? 0.45 : 0.12;
  if (B.w < B.h * 0.9) score *= 0.6;
  // which way it faces: what is out of its front (a barrel, a blade), at its back (a jet)
  let face = 0;
  for (const o of st) {
    const t = labels[o.i];
    const side = o.sh.cx > B.cx ? 1 : -1;
    if (t === 'barrel') face += side * 2;
    if (t === 'blade') face += side * 2;
    // (ROADMAP 11.14: a flame out of its end is its back - whichever way its gun points)
    if (t === 'jet') face -= side * 3;
  }
  return { fam: 'ground', frame: 'ride', labels, score, R, main, front: face < 0 ? -1 : 1, arches, wheels };
}

// a bicycle, a motorbike: two big wheels, a frame of lines between and over them (the handlebars at
// its front, its seat) - and a motorbike's tank, its engine, closed shapes on the frame
function parseBike(F, wheels, labels, inWheel) {
  const { st, over } = F;
  const [a, b] = wheels;
  const x0 = Math.min(a.cx - a.r, b.cx - b.r);
  const x1 = Math.max(a.cx + a.r, b.cx + b.r);
  let y1 = Math.max(a.cy + a.r, b.cy + b.r);
  let main = null;
  // (ROADMAP 11.14) what was added to it, out of its frame - an invention of a bike and something
  // else: coils (a spring), a propeller standing past its front or back wheel, a gun out past them,
  // a wing reaching up over its handlebars or far out past it, a rotor level over it, a balloon
  const rr = (a.r + b.r) / 2;
  const wy = Math.max(a.cy, b.cy);
  let ftop = wy + rr;
  for (const o of st) if (!labels[o.i] && !inWheel(o) && !o.sh.closed && o.sh.x0 > x0 - rr * 0.3 && o.sh.x1 < x1 + rr * 0.3) ftop = Math.max(ftop, Math.min(o.sh.y1, wy + rr * 3.2));
  const air = !!F.len.air;
  const added = (o) => {
    const sh = o.sh;
    if (over[o.i]) return null;
    const past = sh.x0 > x1 - rr * 0.15 || sh.x1 < x0 + rr * 0.15;
    // (coils, under it or out past its wheels - not its frame's own wobble)
    if (sh.coils >= 4 && !sh.closed && sh.size < rr * 2.5 && (past || sh.y1 < wy + rr * 0.2)) return 'spring';
    // (a gun: out past its wheels, mostly - the player said it is armed, or flies)
    const outL = Math.max(0, sh.x1 - x1) + Math.max(0, x0 - sh.x0);
    if ((air || F.len.weapon) && sh.straight && sh.thin > 4.5 && sh.slant < 0.4 && sh.long > rr * 1.2 && outL > sh.long * 0.55 && sh.cy > wy) return 'barrel';
    if (!air) return null;
    if (past && sh.h > sh.w * 1.6 && sh.h < rr * 3.5 && sh.size > rr * 0.5 && sh.cy > wy - rr * 0.5 && sh.cy < ftop + rr * 0.5 && (sh.closed || sh.straight)) return 'prop';
    // (ROADMAP 11.14: a flame out past a wheel - a V lying on its side, its point away from it: a jet)
    if (past && !sh.closed && sh.size < rr * 3) {
      const tip = vTip(o.pts);
      if (tip && (sh.x0 > x1 - rr * 0.15 ? tip[0] > sh.cx : tip[0] < sh.cx) && Math.abs(tip[0] - sh.cx) > sh.w * 0.3 && tip[1] > wy - rr && tip[1] < ftop + rr * 0.5) return 'jet';
    }
    const aspect = Math.max(sh.w, sh.h) / Math.max(1e-6, Math.min(sh.w, sh.h));
    if (sh.closed && sh.y0 > ftop - rr * 0.2 && sh.size > (x1 - x0) * 0.4 && aspect < 1.7 && (sh.round || sh.roundish || sh.fill > 0.62)) return 'balloon';
    if (sh.straight && sh.slant < 0.25 && sh.y0 > ftop - rr * 0.1 && sh.long > (x1 - x0) * 0.4 && Math.abs(sh.cx - (x0 + x1) / 2) < (x1 - x0) * 0.3 && (F.len.air || mastUnder(st, o, { h: rr * 2, y1: ftop }))) return 'rotor';
    if ((sh.closed || sh.endGap < sh.long * 0.4) && sh.size > rr * 1.4 && sh.thin > 2.5 && sh.slant < 1.1 && (sh.y1 > ftop + rr * 0.5 || sh.x1 > x1 + rr * 0.8 || sh.x0 < x0 - rr * 0.8)) return 'wing';
    return null;
  };
  for (const o of st) {
    if (labels[o.i]) continue;
    if (inWheel(o)) {
      labels[o.i] = 'deco';
      continue;
    }
    const t = added(o);
    if (t) {
      labels[o.i] = t;
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
// (ROADMAP 11.13) a drone from above: three or more like round shapes - its rotors, in their guards -
// all round a middle, each as far out as the rest; what is in the middle its body, the lines out to
// them its arms, what is in a rotor's ring its blades. Its front: up the page
function parseDrone(F) {
  const { st, D, G, over } = F;
  const roundO = st.filter((o) => {
    if (over[o.i] && over[o.i] !== 'rotor') return false;
    const sh = o.sh;
    if (!(sh.closed || sh.endGap < sh.long * 0.25)) return false;
    // (ROADMAP 11.14: a rotor's guard is round - a box, a funnel on a train, is none)
    return sh.w < sh.h * 1.6 && sh.h < sh.w * 1.6 && sh.size < D.size * 0.6 && sh.size > D.size * 0.08 && sh.thin < 1.8 && !(sh.closed && sh.fill > 0.9);
  });
  if (roundO.length < 3) return null;
  const sizes = roundO.map((o) => o.sh.size).sort((a, b) => a - b);
  const med = sizes[Math.floor(sizes.length / 2)];
  let rot = roundO.filter((o) => o.sh.size > med * 0.6 && o.sh.size < med * 1.6);
  const mid = (L) => {
    let x = 0;
    let y = 0;
    for (const o of L) {
      x += o.sh.cx;
      y += o.sh.cy;
    }
    return [x / L.length, y / L.length];
  };
  let [cx, cy] = mid(rot);
  // (one of them in the middle: its body, round like them)
  const far = (o) => Math.hypot(o.sh.cx - cx, o.sh.cy - cy);
  const dm0 = rot.reduce((a, o) => a + far(o), 0) / rot.length;
  const hub = rot.filter((o) => far(o) < dm0 * 0.35);
  if (hub.length === 1) {
    rot = rot.filter((o) => o !== hub[0]);
    [cx, cy] = mid(rot);
  }
  if (rot.length < 3 || rot.length > 8) return null;
  // (ROADMAP 11.14: three in a row, level - wheels under a train, seen from its side: no ring of rotors)
  if (rot.some((a) => rot.filter((b) => Math.abs(b.sh.cy - a.sh.cy) < D.h * 0.06).length >= 3)) return null;
  const ds = rot.map(far);
  const dm = ds.reduce((a, d) => a + d, 0) / ds.length;
  // (out of the middle, and each as far out as the rest - not one on another)
  if (!(dm > med * 0.55) || ds.some((d) => d < dm * 0.6 || d > dm * 1.45)) return null;
  for (let a = 0; a < rot.length; a++) for (let b = a + 1; b < rot.length; b++) if (Math.hypot(rot[a].sh.cx - rot[b].sh.cx, rot[a].sh.cy - rot[b].sh.cy) < (rot[a].sh.size + rot[b].sh.size) * 0.3) return null;
  // (all round it: no side without one)
  const ang = rot.map((o) => Math.atan2(o.sh.cy - cy, o.sh.cx - cx)).sort((a, b) => a - b);
  let gap = ang[0] + Math.PI * 2 - ang[ang.length - 1];
  for (let i = 1; i < ang.length; i++) gap = Math.max(gap, ang[i] - ang[i - 1]);
  if (gap > Math.PI * 0.95) return null;
  const labels = {};
  const rotI = new Set(rot.map((o) => o.i));
  for (const o of rot) labels[o.i] = 'rotor';
  // its body: the biggest closed shape over its middle, out of the rotors' way
  const inRotor = (x, y) => rot.some((o) => Math.hypot(x - o.sh.cx, y - o.sh.cy) < o.sh.size * 0.5);
  let body = hub.length === 1 ? hub[0] : null;
  for (const o of st) {
    if (rotI.has(o.i) || o === body || (over[o.i] && !BODYISH.has(over[o.i]))) continue;
    const sh = o.sh;
    if (!(sh.closed || sh.endGap < sh.size * 0.3)) continue;
    if (sh.cx > cx - dm * 0.45 && sh.cx < cx + dm * 0.45 && sh.cy > cy - dm * 0.45 && sh.cy < cy + dm * 0.45 && sh.size < dm * 1.5 && !inRotor(sh.cx, sh.cy)) {
      if (!body || sh.w * sh.h > body.sh.w * body.sh.h) body = o;
    }
  }
  let R = null;
  if (body) {
    labels[body.i] = 'body';
    R = region(G, [body]);
  }
  const BB = R ? R.sh : { x0: cx - med * 0.3, x1: cx + med * 0.3, y0: cy - med * 0.3, y1: cy + med * 0.3, w: med * 0.6, h: med * 0.6, cx, cy, size: med * 0.6, area: med * med * 0.36 };
  const nearRotor = (p) => rot.find((o) => Math.hypot(p[0] - o.sh.cx, p[1] - o.sh.cy) < o.sh.size * 0.62);
  const nearBody = (p) => p[0] > BB.x0 - med * 0.25 && p[0] < BB.x1 + med * 0.25 && p[1] > BB.y0 - med * 0.25 && p[1] < BB.y1 + med * 0.25;
  for (const o of st) {
    if (labels[o.i]) continue;
    const sh = o.sh;
    const a = o.pts[0];
    const b = o.pts[o.pts.length - 1];
    const inside = o.pts.filter((p) => inRotor(p[0], p[1])).length / o.pts.length;
    // (in a rotor's ring: its blades)
    if (inside > 0.8) {
      labels[o.i] = 'rotor';
      continue;
    }
    // (from its body out to a rotor: an arm)
    if ((nearBody(a) && nearRotor(b)) || (nearBody(b) && nearRotor(a)) || (sh.straight && nearRotor(a) && nearRotor(b))) {
      labels[o.i] = 'frame';
      continue;
    }
    if (R) {
      const r = relate(G, R, o);
      if (r.fo < 0.3) {
        labels[o.i] = sh.closed ? 'window' : 'deco';
        continue;
      }
    }
    // (straight out of its front, not to a rotor: a gun)
    if (!sh.closed && sh.straight && sh.slant > 0.8 && sh.y1 > BB.y1 && (nearBody(a) || nearBody(b)) && !nearRotor(a) && !nearRotor(b)) {
      labels[o.i] = 'barrel';
      continue;
    }
    labels[o.i] = 'deco';
  }
  const rotors = rot.map((o) => ({ i: o.i, cx: o.sh.cx, cy: o.sh.cy, r: o.sh.size / 2 }));
  return { fam: 'copter', frame: 'ride', labels, score: 0.97, R: R || { sh: BB, loop: null, made: true }, main: body, front: 1, arches: [], wheels: [], drone: { cx, cy, rotors, body: body ? body.i : -1 } };
}

// (ROADMAP 11.13) a helicopter from above: its rotor's blades crossed over its body (long straight
// lines crossing about their middles - two, three, a star), its tail boom out of its back, the small
// tail rotor across the boom's end. Its front: away from its tail
function parseCopterTop(F) {
  const { st, D, G, over } = F;
  const lines = st.filter((o) => (!over[o.i] || over[o.i] === 'rotor') && !o.sh.closed && o.sh.straight && o.sh.long > D.size * 0.4);
  if (lines.length < 2) return null;
  const ends = (sh) => [[sh.cx - (sh.ux * sh.long) / 2, sh.cy - (sh.uy * sh.long) / 2], [sh.cx + (sh.ux * sh.long) / 2, sh.cy + (sh.uy * sh.long) / 2]];
  // (where two cross, and how far from each one's middle - a half of it is 1)
  const cross = (a, b) => {
    const A = a.sh;
    const B = b.sh;
    const den = A.ux * B.uy - A.uy * B.ux;
    if (Math.abs(den) < Math.sin((35 * Math.PI) / 180)) return null;
    const dx = B.cx - A.cx;
    const dy = B.cy - A.cy;
    const ta = (dx * B.uy - dy * B.ux) / den;
    const tb = (dx * A.uy - dy * A.ux) / den;
    return { x: A.cx + A.ux * ta, y: A.cy + A.uy * ta, fa: Math.abs(ta) / (A.long / 2), fb: Math.abs(tb) / (B.long / 2) };
  };
  let hub = null;
  for (let a = 0; a < lines.length; a++) {
    for (let b = a + 1; b < lines.length; b++) {
      const c = cross(lines[a], lines[b]);
      if (c && c.fa < 0.45 && c.fb < 0.45 && (!hub || c.fa + c.fb < hub.f)) hub = { x: c.x, y: c.y, f: c.fa + c.fb };
    }
  }
  if (!hub) return null;
  // (every blade through the hub)
  const blades = lines.filter((o) => {
    const sh = o.sh;
    const t = (hub.x - sh.cx) * sh.ux + (hub.y - sh.cy) * sh.uy;
    const d = Math.abs(-(hub.x - sh.cx) * sh.uy + (hub.y - sh.cy) * sh.ux);
    return Math.abs(t) < sh.long * 0.25 && d < sh.long * 0.08;
  });
  if (blades.length < 2) return null;
  const R = blades.reduce((a, o) => a + o.sh.long / 2, 0) / blades.length;
  const bladeI = new Set(blades.map((o) => o.i));
  // its body: the biggest closed shape round the hub, smaller than the rotor
  let body = null;
  for (const o of st) {
    if (bladeI.has(o.i) || (over[o.i] && !BODYISH.has(over[o.i]))) continue;
    const sh = o.sh;
    if (!(sh.closed || sh.endGap < sh.size * 0.3)) continue;
    if (Math.hypot(sh.cx - hub.x, sh.cy - hub.y) > Math.max(sh.size * 0.5, R * 0.35) || sh.size > R * 1.6) continue;
    if (!body || sh.w * sh.h > body.sh.w * body.sh.h) body = o;
  }
  if (!body) return null;
  const B = body.sh;
  // its tail: long and thin out of its body - the furthest out, not a blade
  let tail = null;
  let tailEnd = null;
  for (const o of st) {
    if (bladeI.has(o.i) || o === body) continue;
    const sh = o.sh;
    const [p, q] = ends(sh);
    const dp = Math.hypot(p[0] - B.cx, p[1] - B.cy);
    const dq = Math.hypot(q[0] - B.cx, q[1] - B.cy);
    const [nr, fr] = dp < dq ? [p, q] : [q, p];
    const out = Math.max(dp, dq);
    if (sh.thin > 2.5 && sh.long > B.size * 0.55 && Math.hypot(nr[0] - B.cx, nr[1] - B.cy) < B.size * 0.75 && out > B.size * 0.8 && (!tail || out > tail.out)) {
      tail = { o, out };
      tailEnd = fr;
    }
  }
  if (!tail) return null;
  const labels = {};
  for (const o of blades) labels[o.i] = 'rotor';
  labels[body.i] = 'body';
  labels[tail.o.i] = 'tail';
  // the tail rotor: small, across the boom's end
  let tr = null;
  for (const o of st) {
    if (labels[o.i]) continue;
    const sh = o.sh;
    if (Math.hypot(sh.cx - tailEnd[0], sh.cy - tailEnd[1]) < Math.max(sh.size, B.size * 0.3) && sh.size < B.size * 0.9) {
      labels[o.i] = 'prop';
      tr = o;
    }
  }
  const Rg = region(G, [body]);
  for (const o of st) {
    if (labels[o.i]) continue;
    const r = Rg ? relate(G, Rg, o) : null;
    labels[o.i] = r && r.fo < 0.3 ? (o.sh.closed ? 'window' : 'deco') : 'deco';
  }
  const dx = hub.x - tailEnd[0];
  const dy = hub.y - tailEnd[1];
  const dl = Math.hypot(dx, dy) || 1;
  return { fam: 'copter', frame: 'ride', labels, score: 0.95, R: Rg || { sh: B, loop: null, made: true }, main: body, front: 1, arches: [], wheels: [], heliTop: { hub: [hub.x, hub.y], R, tailEnd, ux: dx / dl, uy: dy / dl, tr: tr ? tr.sh.size / 2 : 0 } };
}

// (ROADMAP 11.13) a rocket standing up: a tall closed body, pointed at its top (or a cone drawn on
// it), and its fins out at its foot or its flame under it - or both
function parseRocket(F) {
  const { st, D, G, over } = F;
  let body = null;
  for (const o of st) {
    if (over[o.i] && !BODYISH.has(over[o.i])) continue;
    const sh = o.sh;
    if (!sh.closed || sh.h < sh.w * 2 || sh.h < D.h * 0.45) continue;
    if (!body || sh.h * sh.w > body.sh.h * body.sh.w) body = o;
  }
  if (!body) return null;
  const B = body.sh;
  // (how wide it is up near its top, against its widest)
  const wAt = (pts, y) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
      const [xA, yA] = pts[b];
      const [xB, yB] = pts[a];
      if ((yA <= y && yB >= y) || (yB <= y && yA >= y)) {
        const t = Math.abs(yB - yA) < 1e-9 ? 0.5 : (y - yA) / (yB - yA);
        const x = xA + (xB - xA) * t;
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
    }
    return hi > lo ? hi - lo : 0;
  };
  let wMax = 0;
  for (let q = 1; q < 10; q++) wMax = Math.max(wMax, wAt(body.pts, B.y0 + (B.h * q) / 10));
  let pointed = wAt(body.pts, B.y1 - B.h * 0.06) < wMax * 0.45;
  const labels = { [body.i]: 'body' };
  const cones = [];
  let fins = 0;
  let flame = 0;
  let wings = 0;
  for (const o of st) {
    if (o === body || over[o.i]) continue;
    const sh = o.sh;
    // (a cone on its top)
    if (sh.y0 > B.y1 - B.h * 0.12 && sh.w < B.w * 1.3 && Math.abs(sh.cx - B.cx) < B.w * 0.4 && sh.h < B.h * 0.5) {
      labels[o.i] = 'body';
      cones.push(o);
      pointed = true;
      continue;
    }
    // (out of its sides about its middle, far: a plane's wings, from above - no rocket)
    if (sh.cy > B.y0 + B.h * 0.4 && sh.cy < B.y0 + B.h * 0.85 && (sh.x0 < B.x0 - B.w * 0.9 || sh.x1 > B.x1 + B.w * 0.9)) wings++;
    // (out of its sides at its foot: its fins)
    if (sh.cy < B.y0 + B.h * 0.45 && (sh.x0 < B.x0 - B.w * 0.18 || sh.x1 > B.x1 + B.w * 0.18) && sh.size < B.h * 0.6) {
      labels[o.i] = 'fin';
      fins++;
      continue;
    }
    // (ROADMAP 11.14: coils under its foot - a spring it stands on, it jumps)
    if (sh.coils >= 3 && !sh.closed && sh.cy < B.y0 + B.h * 0.1 && Math.abs(sh.cx - B.cx) < B.w * 0.8) {
      labels[o.i] = 'spring';
      continue;
    }
    // (under its foot: its flame)
    if (sh.cy < B.y0 + B.h * 0.04 && sh.y1 < B.y0 + B.h * 0.2 && Math.abs(sh.cx - B.cx) < B.w * 0.6 && sh.size < B.h * 0.7) {
      labels[o.i] = 'jet';
      flame++;
      continue;
    }
    const inside = o.pts.filter(([x, y]) => x > B.x0 && x < B.x1 && y > B.y0 && y < B.y1).length / o.pts.length;
    labels[o.i] = inside > 0.8 ? (sh.closed ? 'window' : 'deco') : 'deco';
  }
  if (!pointed || !(fins || flame || Object.values(labels).includes('spring')) || wings) return null;
  return { fam: 'copter', frame: 'ride', labels, score: 0.95, R: region(G, [body, ...cones]) || { sh: B, loop: null, made: true }, main: body, front: 1, arches: [], wheels: [], rocket: { fins, flame } };
}

function parseCopter(F) {
  const drone = parseDrone(F);
  if (drone) return drone;
  const heliTop = parseCopterTop(F);
  if (heliTop) return heliTop;
  const rocket = parseRocket(F);
  if (rocket) return rocket;
  const { st, D, G, over } = F;
  const labels = {};
  const cands = wheelCands(st, D, over);
  // (its wheels low down under it - a windscreen's curve up its front is none)
  const wheels = wheelSet(cands, D).filter((c) => c.r < D.w * 0.12 && c.cy < D.y0 + D.h * 0.42);
  const wheelI = new Set(wheels.map((c) => c.o.i));
  for (const c of wheels) labels[c.o.i] = 'wheel';
  // its rotor first, kept out of its body: long and flattish, up at the top (lines, an X, blades
  // drawn as long leaves)
  // (ROADMAP 11.13: or wide and flat up there however it was drawn - its blades as loops, a zigzag
  // blur - all of it in its top half)
  // (ROADMAP 11.14: a roof up there - a peak, its two ends down at its sides - is none)
  // (nor a box standing open-footed on it - a cabin drawn as three sides)
  const cabin = (o) => !o.sh.closed && !o.sh.straight && o.sh.h > o.sh.w * 0.2 && o.sh.endGap > o.sh.long * 0.6 && o.sh.cfill > 0.5;
  const blade = (o) => !cabin(o) && ((o.sh.slant < 0.75 && o.sh.long > D.w * 0.16 && (o.sh.straight || o.sh.thin > (o.sh.closed ? 2.2 : 2.8)) && o.sh.wiggle < 3) || (o.sh.slant < 0.5 && o.sh.w > D.w * 0.4 && o.sh.h < o.sh.w * 0.45 && o.sh.y0 > D.y0 + D.h * 0.45 && !o.sh.dome));
  const rotorC = new Set(st.filter((o) => !over[o.i] && !wheelI.has(o.i) && o.sh.cy > D.y0 + D.h * 0.62 && blade(o)).map((o) => o.i));
  const use = noCoils(st.filter((o) => !wheelI.has(o.i) && !rotorC.has(o.i) && (!over[o.i] || BODYISH.has(over[o.i])) && (o.sh.closed || o.sh.size > D.size * 0.1)), over, D);
  const R = region(G, use, 2, false, true) || region(G, use.concat(named(F, wheelI)));
  if (!R) return null;
  const B = R.sh;
  let main = null;
  let mainE = -1;
  let rotor = 0;
  let tail = null;
  const out = [];
  // (ROADMAP 11.16: a line out past its end at about its top's height, little of it over it - its
  // tail boom, not a rotor; a rotor is over it)
  // (out from its end - one half of a rotor drawn out from its hub over its middle is a rotor still)
  const overB = (sh) => Math.max(0, Math.min(sh.x1, B.x1) - Math.max(sh.x0, B.x0)) / Math.max(1e-6, sh.w);
  const boom = (sh) => overB(sh) < 0.4 && sh.cy < B.y1 + B.h * 0.2 && (sh.cx < B.cx ? Math.abs(sh.x1 - B.x0) : Math.abs(sh.x0 - B.x1)) < B.w * 0.2;
  for (const o of st) {
    if (rotorC.has(o.i) && o.sh.cy > B.y1 - B.h * 0.25 && !boom(o.sh)) {
      labels[o.i] = 'rotor';
      rotor++;
    }
  }
  for (const o of st) {
    if (labels[o.i]) continue;
    const r = relate(G, R, o);
    o.rel = r;
    // (ROADMAP 11.16) one big line drawn round most of what the body is: the body, whatever thin bit of
    // it the thinning left out of what closes - a tank's hull drawn flat, coming to a point
    const bigOne = !over[o.i] && (o.sh.closed || o.sh.endGap < o.sh.size * 0.2) && o.sh.size > B.size * 0.6 && r.fo < 0.5;
    if ((r.fo <= 0.28 || bigOne) && !sticksOut(o, R)) {
      if (r.fe >= 0.5 || (r.fe >= r.fi && o.sh.size > B.size * 0.3) || bigOne) {
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
    if (flat && sh.cy > B.y1 - B.h * 0.15 && sh.long > B.w * 0.3 && Math.abs(sh.cx - B.cx) < B.w * 0.55 && !boom(sh)) {
      labels[o.i] = 'rotor';
      rotor++;
    }
  }
  // (ROADMAP 11.13) none so: its rotor drawn as a shape - its blades as leaves, an X in one line -
  // the widest thing over its top
  if (!rotor) {
    let wide = null;
    for (const o of out) {
      const sh = o.sh;
      if (labels[o.i] || over[o.i] || sh.cy < B.y1 || sh.y0 < B.y1 - B.h * 0.3 || sh.w < B.w * 0.3 || sh.h > sh.w * 0.9 || Math.abs(sh.cx - B.cx) > B.w * 0.6) continue;
      if (!wide || sh.w > wide.sh.w) wide = o;
    }
    if (wide) {
      labels[wide.i] = 'rotor';
      rotor++;
    }
  }
  // (its blades drawn one by one - short lines out of its hub, as high as it: the rotor too)
  const rotS = st.filter((o) => labels[o.i] === 'rotor');
  for (const o of out) {
    const sh = o.sh;
    if (labels[o.i] || over[o.i] || sh.slant > 1.0 || sh.size > B.w * 0.6 || sh.cy < B.y1 - B.h * 0.1) continue;
    if (rotS.some((q) => Math.abs(sh.cy - q.sh.cy) < Math.max(q.sh.h, B.h * 0.12) && sh.x0 < q.sh.x1 + q.sh.long * 0.25 && sh.x1 > q.sh.x0 - q.sh.long * 0.25)) {
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
    // (ROADMAP 11.14: coils - a spring, wherever it is: no skid, no tail)
    if (sh.coils >= 3 && addedPart(o, R, o.rel, F.len) === 'spring') {
      labels[o.i] = 'spring';
      continue;
    }
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
    labels[o.i] = addedPart(o, R, o.rel, F.len, -Infinity, 'copter') || 'deco';
  }
  const score = rotor ? Math.min(1, 0.85 + (tail ? 0.15 : 0)) : 0.08;
  return { fam: 'copter', frame: 'ride', labels, score, R, main, front: tSide > 0 ? -1 : 1, arches: [], wheels };
}

// a plane seen from above (as most draw one): the axis it is symmetric about, if it is - what is far
// out across it is there on the other side too (its wings, its tailplane), which a plane from the
// side (a fin up, wheels down) is not. minSc: how alike its two sides at least; minFar: how much of
// what was drawn at least is far out across it
function topAxis(G, st, minSc = 0.6, minFar = 0.16) {
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
      if (far >= n * minFar && up >= far * 0.3 && up <= far * 0.7) {
        const sc = hit / far;
        if (!bestOff || sc > bestOff.sc) bestOff = { sc, off };
      }
    }
    if (!bestOff || bestOff.sc < minSc) continue;
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
  // (ROADMAP 11.13: its wings, its tail lines across a body drawn bigger than they are - little of
  // all that was drawn is off its axis: an axis still)
  // (ROADMAP 11.14: about the axis it is most alike both sides of, if any - a house, a rocket on its
  // wheels alike about one that is no plane's are none from above along a lesser one)
  const axes = topAxis(G, st, 0.6, 0.08);
  for (const tv of axes.filter((a) => a.sc >= axes[0].sc - 0.12).slice(0, 3)) {
    const t = planeTop(F, tv);
    if (t && (!top || t.like > top.like)) top = t;
  }
  const side = planeSide(F);
  // (ROADMAP 11.13: no wing in it from the side, nor one from above alike both sides: from above,
  // drawn freehand - its wings not quite alike, its tailplane drawn one side only - along its long
  // way, its wings out both sides about its middle as planeTop has them)
  if (!top && (!side || side.score < 0.5)) {
    for (const tv of topAxis(G, st, 0.25).filter((a) => (D.w >= D.h ? Math.abs(a.ux) > 0.8 : Math.abs(a.uy) > 0.8)).slice(0, 2)) {
      const t = planeTop(F, tv, true);
      if (t && (!top || t.like > top.like)) top = t;
    }
  }
  // (from above, unless it is plainly a plane from the side: its wing, and its fin or propeller)
  if (top && side) {
    const n = (t) => Object.values(side.labels).filter((x) => x === t).length;
    const sideSure = n('wing') && (n('fin') || n('prop') || n('jet') || side.finIn);
    F.dbgLike = top.like;
    return sideSure && top.like < 1.9 ? side : top;
  }
  return top || side;
}

// (ROADMAP 11.13) which end of an outline drawn side on rises well over the top of the rest - a fin
// drawn in the body's own line: 1 its right end, -1 its left, 0 neither (or both)
function finEnd(loop) {
  let x0 = Infinity;
  let x1 = -Infinity;
  for (const [x] of loop) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
  }
  const span = (x) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const [xa, ya] = loop[j];
      const [xb, yb] = loop[i];
      if ((xa <= x && xb >= x) || (xb <= x && xa >= x)) {
        const y = ya + (yb - ya) * (Math.abs(xb - xa) < 1e-9 ? 0.5 : (x - xa) / (xb - xa));
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
    }
    return lo <= hi ? [lo, hi] : null;
  };
  const st = [];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    const sp = span(x0 + (x1 - x0) * (0.005 + u * 0.99));
    if (sp) st.push({ u, lo: sp[0], hi: sp[1] });
  }
  const mid = st.filter((q) => q.u > 0.3 && q.u < 0.7);
  if (mid.length < 5) return 0;
  const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const top = med(mid.map((q) => q.hi));
  const h = med(mid.map((q) => q.hi - q.lo));
  const rise = (a, b) => Math.max(-Infinity, ...st.filter((q) => q.u >= a && q.u <= b).map((q) => q.hi)) - top;
  const l = rise(0, 0.28);
  const r = rise(0.72, 1);
  if (r > h * 0.45 && l < h * 0.2) return 1;
  if (l > h * 0.45 && r < h * 0.2) return -1;
  return 0;
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
  // (its body one long closed line, as most draw one: that line alone - its wing and its fin, closed
  // shapes too, are out of it)
  const long = use.filter((o) => o.sh.closed && o.sh.w > o.sh.h * 2 && o.sh.w > D.w * 0.45).sort((a, b) => b.sh.w * b.sh.h - a.sh.w * a.sh.h)[0];
  // (drawn thin, its line shaky - not quite closed: closed a little more, still alone)
  const R = (long && (region(G, [long]) || region(G, [long], 4))) || region(G, use, 2, false, true) || region(G, use.concat(named(F, wheelI)));
  if (!R) return null;
  // (and its outline that line itself: a pointed nose, a thin tail as drawn - not worn away)
  if (long && R.piece) {
    const lp = simplifyLoop(long.pts.slice(0, -1), G.cell * 0.3);
    if (lp.length >= 3) {
      R.loop = lp;
      R.sh = Object.assign(shapeOf(lp.concat([lp[0]])), { area: R.sh.area });
    }
  }
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
    // (the long closed line its body was made of: its body, however thin it was drawn)
    if (o === long) {
      labels[o.i] = 'body';
      if (r.fe * sh.len > mainE) {
        mainE = Math.max(r.fe, 0.5) * sh.len;
        main = o;
      }
      continue;
    }
    // (ROADMAP 11.14: coils - a spring, wherever it is: no fin, no propeller, no strut)
    if (sh.coils >= 3 && !over[o.i] && sh.size < B.size * 0.6 && addedPart(o, R, r, { ...F.len, air: true }) === 'spring') {
      labels[o.i] = 'spring';
      continue;
    }
    // (a cockpit's canopy: a low dome along its top - no wing, no fin, however near its end. ROADMAP
    // 11.16: its top there - a body drawn slanting is lower at one end than at the other)
    const spT = R.loop ? spanAt(R.loop.concat([R.loop[0]]), Math.min(B.x1 - B.w * 0.01, Math.max(B.x0 + B.w * 0.01, sh.cx))) : null;
    const topT = spT ? spT[1] : B.y1;
    if (sh.cx > B.x0 + B.w * 0.1 && sh.cx < B.x1 - B.w * 0.1 && sh.y0 > topT - B.h * 0.6 && sh.cy > topT - B.h * 0.15 && sh.w > sh.h * 1.4 && sh.y1 < topT + B.h * (sh.dome ? 1.1 : 0.75) && sh.w < B.w * 0.45 && r.gap < B.h * 0.35 && r.fo > 0.12 && !(sh.closed && sh.straight && sh.thin > 5)) {
      labels[o.i] = 'window';
      continue;
    }
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
      // (ROADMAP 11.13: or seen from a little under it, drawn over its body - long, thin and closed,
      // slanting across its middle and out under it; a row of windows is level, along its top)
      if (sh.closed && sh.thin > 4 && sh.slant > 0.2 && sh.slant < 0.9 && sh.long > B.w * 0.25 && Math.abs(sh.cx - B.cx) < B.w * 0.25 && sh.y0 < B.y0 + B.h * 0.2) {
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
    // (ROADMAP 11.13: a propeller is across its end's middle; a shape standing on its back there, its
    // middle over the body's top, is its fin)
    const endSp = R.loop ? spanAt(R.loop.concat([R.loop[0]]), Math.min(B.x1 - B.w * 0.02, Math.max(B.x0 + B.w * 0.02, sh.cx))) : null;
    const onTop = endSp && sh.cy > endSp[1] - (endSp[1] - endSp[0]) * 0.1;
    // (a straight line too, just past its very end and across its middle: a propeller drawn edge on)
    const past = (sh.x0 > B.x1 - B.w * 0.06 || sh.x1 < B.x0 + B.w * 0.06) && sh.y0 < B.cy && sh.y1 > B.cy;
    if (atBack && sh.h > sh.w * 1.6 && sh.size < B.h * 2.2 && Math.abs(sh.cy - B.cy) < B.h * 0.6 && (sh.closed || !sh.straight || past) && !onTop) {
      labels[o.i] = 'prop';
      face += atBack * 2;
      continue;
    }
    // (a fin: a shape standing up over its back - a thin upright line there is a strut, a mast)
    if (atBack && sh.y1 > B.y1 + B.h * 0.15 && sh.cy > B.cy && sh.size < B.w * 0.6 && (sh.w > sh.h * 0.35 || sh.closed || !sh.straight) && !(sh.straight && sh.thin > 5 && sh.slant < 0.35)) {
      labels[o.i] = 'fin';
      face -= atBack * 1.5;
      continue;
    }
    // (ROADMAP 11.15: a wide dome bowed up, well clear over it - its parachute; a biplane's upper
    // wing is flat, close over it)
    if (!sh.closed && sh.dome && sh.dev > 0.12 && sh.w > B.w * 0.4 && sh.y0 > B.y1 + B.h * 0.6) {
      labels[o.i] = 'chute';
      continue;
    }
    // (a wing seen edge on, over it or under it: long, flat and level - a biplane's two, a high
    // wing's - unless it stands on one mast over its middle: a rotor's)
    if (sh.slant < 0.22 && (sh.straight || sh.thin > 4) && sh.long > B.w * 0.25 && sh.long < B.w * 1.15 && (sh.y0 > B.y1 - B.h * 0.1 || sh.y1 < B.y0 + B.h * 0.1) && r.gap < B.h * 2.2 && sh.x1 > B.x0 + B.w * 0.15 && sh.x0 < B.x1 - B.w * 0.15 && !mastUnder(st, o, B)) {
      labels[o.i] = 'wing';
      wing++;
      continue;
    }
    // (an engine on its wing or under it: small, closed, longer than high, out of its body)
    if (sh.closed && sh.w > sh.h * 1.3 && sh.thin < 5.5 && sh.size < B.h * 1.6 && sh.size > B.h * 0.25 && sh.cy < B.y1) {
      labels[o.i] = 'jet';
      continue;
    }
    // (ROADMAP 11.13) a wing seen from a little over it or under it, as most draw one: a shape off
    // its body's middle - down from its belly (the near wing), up off its back (the far one); an
    // upright line there is a strut
    const mid = sh.cx > B.x0 + B.w * 0.22 && sh.cx < B.x1 - B.w * 0.22;
    const hang = sh.y1 > B.y0 - B.h * 0.15 && sh.y0 < B.y0 - B.h * 0.3;
    const rise = sh.y0 < B.y1 + B.h * 0.15 && sh.y1 > B.y1 + B.h * 0.45;
    if (mid && (hang || rise) && r.gap < B.h * 0.25 && sh.size > B.h * 0.5 && sh.size < B.w * 0.9 && !(sh.slant > 1.3 && (sh.straight || sh.thin > 4))) {
      labels[o.i] = 'wing';
      wing++;
      continue;
    }
    labels[o.i] = addedPart(o, R, r, { ...F.len, air: true }, -Infinity, 'plane') || 'deco';
  }
  // (a biplane's lower wing drawn along its body's bottom, as long as the one over it and under it)
  const upper = st.filter((o) => labels[o.i] === 'wing' && o.sh.slant < 0.22 && o.sh.y0 > B.y1 - B.h * 0.1);
  for (const o of st) {
    if (labels[o.i] !== 'body' || o === long || o.sh.slant > 0.15 || !(o.sh.straight || o.sh.thin > 4)) continue;
    const w = upper.find((u) => Math.abs(u.sh.long - o.sh.long) < u.sh.long * 0.35 && Math.min(u.sh.x1, o.sh.x1) - Math.max(u.sh.x0, o.sh.x0) > Math.min(u.sh.w, o.sh.w) * 0.6);
    if (w && o.sh.cy < B.cy) {
      labels[o.i] = 'wing';
      wing++;
    }
  }
  // (ROADMAP 11.15: from its parachute down to its body - its lines)
  const chuteS = st.filter((o) => labels[o.i] === 'chute');
  for (const o of chuteS.length ? st : []) {
    const t = labels[o.i];
    if (over[o.i] || o === long || (t !== 'fin' && t !== 'deco' && t !== 'frame' && t !== 'wing') || o.sh.closed || !o.sh.straight || o.sh.slant < 0.5) continue;
    const ends = [o.pts[0], o.pts[o.pts.length - 1]].sort((a, b) => b[1] - a[1]);
    const nearChute = chuteS.some((c) => c.pts.some(([x, y]) => Math.hypot(x - ends[0][0], y - ends[0][1]) < B.h * 0.4));
    const nearBody = ends[1][1] > B.y0 - B.h * 0.2 && ends[1][1] < B.y1 + B.h * 0.3 && ends[1][0] > B.x0 - B.w * 0.05 && ends[1][0] < B.x1 + B.w * 0.05;
    if (nearChute && nearBody) labels[o.i] = 'rope';
  }
  // (between its wings, or a wing and its body, up and down: the struts that hold them)
  const wingS = st.filter((o) => labels[o.i] === 'wing');
  for (const o of st) {
    const t = labels[o.i];
    if (!wingS.length || (t !== 'deco' && t !== 'rotor' && t !== 'barrel' && t !== 'body') || o === long || o.sh.slant < 1.0 || o.sh.h > B.h * 3.5) continue;
    const ends = [o.pts[0], o.pts[o.pts.length - 1]].sort((a, b) => b[1] - a[1]);
    const nearWing = (q) => wingS.some((w) => w.pts.some(([x, y]) => Math.hypot(x - q[0], y - q[1]) < B.h * 0.3));
    const nearBody = (q) => q[1] > B.y0 - B.h * 0.2 && q[1] < B.y1 + B.h * 0.2 && q[0] > B.x0 && q[0] < B.x1;
    if ((nearWing(ends[0]) && (nearWing(ends[1]) || nearBody(ends[1]))) || (nearBody(ends[0]) && nearWing(ends[1]))) labels[o.i] = 'frame';
  }
  // (ROADMAP 11.13: nothing says which way it faces - its fin drawn in its body's own line, up over
  // one end of it: that end is its tail)
  const finIn = R.loop ? finEnd(R.loop) : 0;
  if (!face) face = -finIn * 1.5;
  // (ROADMAP 11.14) a gun on its back: long, thin and straight, flat over it - out past its nose or
  // its tail, or not over the wing it has under it (a biplane's upper wing is right over the lower
  // one, on struts), or out of a turret on its back; or slanting up off its back toward its nose (a
  // wing seen from a little over it slants back) - no wing
  const lowW = st.filter((o) => labels[o.i] === 'wing' && !(o.sh.slant < 0.22 && o.sh.y0 > B.y1 - B.h * 0.1));
  const fwd = face < 0 ? -1 : 1;
  // (ROADMAP 11.16: a short straight line out of its nose, level, at its nose's height - its gun,
  // however short for how long it is; one line or two side by side, a barrel drawn quickly)
  for (const o of st) {
    if (labels[o.i] !== 'deco' || over[o.i] || o === long) continue;
    const sh = o.sh;
    if (!(sh.straight || sh.thin > 4) || sh.slant > 0.35 || sh.long < B.w * 0.08 || sh.long > B.w * 0.9) continue;
    const nose = fwd > 0 ? B.x1 : B.x0;
    const back = fwd > 0 ? sh.x0 : sh.x1;
    const tip = fwd > 0 ? sh.x1 : sh.x0;
    if ((tip - nose) * fwd < B.w * 0.04 || Math.abs(back - nose) > B.w * 0.12) continue;
    const sp = R.loop ? spanAt(R.loop.concat([R.loop[0]]), nose - fwd * B.w * 0.03) : null;
    const lo = sp ? sp[0] : B.y0;
    const hi = sp ? sp[1] : B.y1;
    if (sh.cy < lo - B.h * 0.15 || sh.cy > hi + B.h * 0.15) continue;
    // (from its very nose, as drawn - a thin nose is worn out of the body's cells)
    const gap = R.loop ? Math.min(...o.pts.map((p) => toLine(p, R.loop, true))) : (o.rel || relate(G, R, o)).gap;
    if (gap > B.w * 0.04) continue;
    labels[o.i] = 'barrel';
  }
  for (const o of st) {
    if (labels[o.i] !== 'wing' || over[o.i]) continue;
    const sh = o.sh;
    // (drawn straight - a line, a box: a curve over its back is the edge of a wing, a canopy)
    if (!sh.straight || sh.thin < 3.5 || sh.long > B.w * 0.85 || sh.y0 < B.y1 - B.h * 0.25 || !(sh.closed || o.kind === 'line' || o.kind === 'poly')) continue;
    const ends = [[sh.cx - (sh.ux * sh.long) / 2, sh.cy - (sh.uy * sh.long) / 2], [sh.cx + (sh.ux * sh.long) / 2, sh.cy + (sh.uy * sh.long) / 2]];
    let gun = false;
    if (sh.slant < 0.22) {
      // (out past its nose; or clear over its back, on no struts, not over the wing under it)
      const past = fwd > 0 ? sh.x1 > B.x1 + B.w * 0.04 : sh.x0 < B.x0 - B.w * 0.04;
      const lap = lowW.length ? Math.max(...lowW.map((w) => Math.min(w.sh.x1, sh.x1) - Math.max(w.sh.x0, sh.x0))) / Math.max(1e-6, sh.long) : 1;
      const strut = st.some((q) => q !== o && q.sh.slant > 1.0 && q.sh.h < B.h * 3 && q.sh.y1 > sh.y0 - B.h * 0.15 && q.sh.y0 < B.y1 + B.h * 0.2 && q.sh.cx > sh.x0 && q.sh.cx < sh.x1);
      const r = o.rel || relate(G, R, o);
      gun = !strut && (past || (lap < 0.45 && (r.gap > B.h * 0.05 || (sh.thin > 6 && lowW.length > 0 && !lowW.some((w) => w.sh.slant < 0.3)))));
    } else if (sh.slant < 1.2) {
      const hi = ends[0][1] > ends[1][1] ? ends[0] : ends[1];
      const lo = hi === ends[0] ? ends[1] : ends[0];
      gun = (hi[0] - lo[0]) * fwd > 0 && lo[1] > B.y1 - B.h * 0.3 && sh.thin > 4.5;
    }
    // (out of a turret: one end in a small closed shape on its back, the other out of it)
    const turret = (p) => st.some((q) => q !== o && q !== long && (q.sh.closed || q.sh.dome) && q.sh.size < B.w * 0.4 && q.sh.cy > B.y1 - B.h * 0.3 && p[0] > q.sh.x0 - B.h * 0.08 && p[0] < q.sh.x1 + B.h * 0.08 && p[1] > q.sh.y0 - B.h * 0.08 && p[1] < q.sh.y1 + B.h * 0.08);
    if (turret(ends[0]) !== turret(ends[1])) gun = true;
    if (gun) {
      labels[o.i] = 'barrel';
      wing--;
    }
  }
  // (a body with a wing in its own outline - a long one with a big triangle under its middle)
  const score = wing ? 1 : 0.1;
  // (ROADMAP 11.14: no body in it at all - a coil alone, a scribble: no plane)
  if (!wing && !Object.values(labels).includes('body')) return null;
  return { fam: 'plane', frame: 'ride', labels, score, R, main, front: face < 0 ? -1 : 1, arches: [], wheels, finIn: !!finIn };
}

// (a line over a body stood on one short upright line under its middle, down to the body: a rotor
// on its mast)
function mastUnder(st, o, B) {
  const sh = o.sh;
  return st.some((m) => {
    if (m === o || m.sh.slant < 1.1 || m.sh.h > B.h * 1.2) return false;
    const top = m.pts.reduce((a, q) => (q[1] > a[1] ? q : a), m.pts[0]);
    const bot = m.pts.reduce((a, q) => (q[1] < a[1] ? q : a), m.pts[0]);
    return Math.abs(top[0] - sh.cx) < sh.long * 0.22 && Math.abs(top[1] - sh.cy) < B.h * 0.3 && bot[1] < B.y1 + B.h * 0.3;
  });
}

// a plane from above: along its axis how wide it is - its wings where widest, its tail at an end.
// Each line: the long one along the axis its body, what reaches far out across its wings or its tail
function planeTop(F, tv, loose = false) {
  const { st, G } = F;
  const { ux, uy, cx, cy } = tv;
  const UV = ([x, y]) => [(x - cx) * ux + (y - cy) * uy, -(x - cx) * uy + (y - cy) * ux];
  for (const o of st) o.uv = o.pts.map(UV);
  const uOf = (o) => {
    let a = Infinity;
    let b = -Infinity;
    let r = 0;
    for (const [u, v] of o.uv) {
      a = Math.min(a, u);
      b = Math.max(b, u);
      r = Math.max(r, Math.abs(v));
    }
    return [a, b, r];
  };
  // (ROADMAP 11.14) what is out past its nose or its tail along it - coils, a spring; long, thin and
  // straight along its axis close to it, a gun - is no part of the plane's own shape: how long and
  // how wide it is, where its wings and tail are, without them (read as what they are below)
  let longest = null;
  for (const o of st) {
    const [a, b] = uOf(o);
    if (!longest || b - a > longest[1] - longest[0]) longest = [a, b];
  }
  const outer = new Set();
  const ll = longest[1] - longest[0];
  // (the far end of a line out past the body free - no other line's end there: a nose drawn as
  // two lines meeting at its tip is its nose)
  const free = (o, u) => !st.some((q) => q !== o && q.uv.some(([qu, qv]) => Math.abs(qu - u) < ll * 0.05 && Math.abs(qv) < ll * 0.08));
  for (const o of st) {
    if (F.over[o.i]) continue;
    const [a, b, r] = uOf(o);
    const off = Math.max(0, longest[0] - a) + Math.max(0, b - longest[1]);
    if (o.sh.coils >= 3 && off > (b - a) * 0.5) outer.add(o.i);
    else if (o.sh.straight && o.sh.thin > 3.5 && Math.abs(o.sh.ux * ux + o.sh.uy * uy) > 0.95 && off > (b - a) * 0.6 && r < ll * 0.15 && b - a < ll * 0.6 && b - a > ll * 0.1 && (b > longest[1] ? free(o, b) : free(o, a))) outer.add(o.i);
  }
  const own = st.filter((o) => !outer.has(o.i));
  let u0 = Infinity;
  let u1 = -Infinity;
  for (const o of own) {
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
  for (const o of own) {
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
  // (ROADMAP 11.13: a dart, a paper plane - its wings swept back all the way to its tail, from a
  // point at its nose)
  const dart = (w0 < 1 && w1 >= NB * 0.3 && w1 < NB - 2 && wid[NB - 1] < span * 0.3) || (w1 > NB - 2 && w0 <= NB * 0.7 && w0 >= 1 && wid[0] < span * 0.3);
  if ((w0 < 1 || w1 > NB - 2) && !dart) return null;
  // (its wings out both sides alike: a plane from the side has its wing down one side of its body
  // only, its fin up the other - no plane from above)
  let wUp = 0;
  let wDn = 0;
  for (let i = w0; i <= w1; i++) {
    wUp = Math.max(wUp, hi[i]);
    wDn = Math.max(wDn, -lo[i]);
  }
  if (Math.min(wUp, wDn) < Math.max(wUp, wDn) * 0.55) return null;
  // (its widest part one round thing - a balloon's envelope, a wheel, a face: no wings)
  for (const o of st) {
    const sh = o.sh;
    const aspect = Math.max(sh.w, sh.h) / Math.max(1e-6, Math.min(sh.w, sh.h));
    if (sh.closed && sh.fill > 0.62 && aspect < 1.7 && sh.size > span * 0.75) return null;
  }
  const narrow = wid.filter((w) => w > 0 && w < span * 0.3).sort((a, b) => a - b);
  const fw = narrow.length ? narrow[Math.floor(narrow.length / 2)] : span * 0.15;
  if (fw > span * 0.42) return null;
  // (not alike both sides: only plainly wings - short along it, far out from a thin body - not a
  // body from the side, as high as it is along much of it)
  if (loose && ((w1 - w0 + 1) / NB > 0.45 || span < fw * 2.6)) return null;
  // (its widest along most of it - an envelope, a hull: no wings)
  if ((w1 - w0 + 1) / NB > 0.75) return null;
  const endW = (a, b) => Math.max(...wid.slice(a, b));
  const tailA = endW(0, 4);
  const tailB = endW(NB - 4, NB);
  const wc = (w0 + w1 + 1) / 2 / NB;
  const nose = Math.abs(tailA - tailB) > fw * 0.8 ? (tailA > tailB ? 1 : -1) : wc >= 0.5 ? 1 : -1;
  const labels = {};
  const wa = u0 + (w0 / NB) * len;
  const wb = u0 + ((w1 + 1) / NB) * len;
  const tailU = nose > 0 ? u0 : u1;
  // (ROADMAP 11.14: where its body is along it - the longest line along it - for what is out past its
  // nose, its tail)
  let bodyU = null;
  for (const o of st) {
    let a = Infinity;
    let b = -Infinity;
    for (const [u] of o.uv) {
      a = Math.min(a, u);
      b = Math.max(b, u);
    }
    if (b - a > len * 0.55 && (!bodyU || b - a > bodyU[1] - bodyU[0])) bodyU = [a, b];
  }
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
    // (ROADMAP 11.14) coils: a spring - past its tail it kicks it on, past its nose a bumper, on it
    // it jumps (game/partsum.js topDesign puts it so); out past its nose or tail along it, a gun
    if (outer.has(o.i)) {
      labels[o.i] = o.sh.coils >= 3 ? 'spring' : 'barrel';
      continue;
    }
    // (long, thin and straight along it, close to its axis, out past its body's nose - or its tail:
    // a gun, firing ahead, or back)
    if (bodyU && o.sh.straight && o.sh.thin > 3.5 && reach < Math.max(fw * 0.9, span * 0.06) && along > len * 0.06 && along < len * 0.5 && (b > bodyU[1] + len * 0.03 || a < bodyU[0] - len * 0.03) && a < bodyU[1] + len * 0.06 && b > bodyU[0] - len * 0.06) {
      labels[o.i] = 'barrel';
      continue;
    }
    // (ROADMAP 11.13: a dot, a speck - a window, a rivet: no wing, however far out it is)
    if (o.sh.size < len * 0.04) {
      labels[o.i] = reach < fw * 1.2 ? 'window' : 'deco';
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
      const nearNose = Math.abs(um - (nose > 0 ? u1 : u0)) < len * 0.2;
      if (nearTail && reach < span * 0.42) labels[o.i] = 'fin';
      else if (um > wa - len * 0.12 && um < wb + len * 0.12) labels[o.i] = o.sh.closed && o.sh.size < span * 0.18 ? 'jet' : 'wing';
      // (ROADMAP 11.13: a little thing at its nose - a windscreen, a canopy: no wing)
      else if (nearNose && o.sh.size < span * 0.3) labels[o.i] = o.sh.closed ? 'window' : 'deco';
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
  const top = { len, fw, span, chord: Math.max((wb - wa), len * 0.18), wingAt: ((wa + wb) / 2 - (nose > 0 ? u0 : u1)) * nose / len, tailSpan: Math.max(tailA, tailB), ux, uy, cx, cy, nose, dart: dart || undefined };
  const R = { sh: { x0: 0, x1: len, y0: 0, y1: fw, w: len, h: fw, cx: len / 2, cy: fw / 2, size: len, area: len * fw * 0.8 }, loop: null };
  // how like a plane: a long body along the axis (one line along it), wings about its middle, a
  // smaller tail at an end
  const tailR = Math.max(tailA, tailB) / span;
  // (ROADMAP 11.14: far wider than it is long - a rocket on its wheels across the page, alike both
  // sides of its middle: no plane's, from above)
  const like = tv.sc + (mainL > len * 0.55 ? 0.5 : 0) + (Math.abs(wc - 0.5) < 0.25 ? 0.3 : 0) + (tailR > 0.15 && tailR < 0.7 ? 0.3 : 0) - fw / span - Math.max(0, 0.5 - len / span) * 3;
  // (what it has that no one line is: its wings, its tail - where they are, as the page has it)
  const at = (u, v) => [cx + u * ux - v * uy, cy + u * uy + v * ux];
  const implicit = [];
  if (!Object.values(labels).includes('wing')) implicit.push({ type: 'wing', at: at((wa + wb) / 2, span * 0.38) });
  if (!Object.values(labels).includes('fin') && tailR > 0.12) implicit.push({ type: 'fin', at: at(tailU + (nose > 0 ? len * 0.06 : -len * 0.06), Math.max(tailA, tailB) * 0.4) });
  return { fam: 'plane', frame: 'ride', labels, score: 1, R, main, front: 1, arches: [], wheels: [], top, like, implicit };
}

// (ROADMAP 11.13) an airship from its side: a long envelope, round at its ends - two to five times
// as long as it is high - its fins out of one end, a gondola close under its middle, a propeller
// behind it. Two of those, at least: an airship (its back the end its fins, its propeller are at)
function parseAirship(F) {
  const { st, D, G, over } = F;
  let env = null;
  for (const o of st) {
    if (over[o.i] && over[o.i] !== 'balloon') continue;
    const sh = o.sh;
    if (!sh.closed) continue;
    const asp = sh.w / Math.max(1e-6, sh.h);
    const fill = sh.area / Math.max(1e-9, sh.w * sh.h);
    if (asp < 1.8 || asp > 5 || sh.w < D.w * 0.5 || fill > 0.9 || fill < 0.55) continue;
    // (an envelope is highest about its middle: one end rising well over the rest is a plane's
    // body, its fin drawn in its line)
    if (finEnd(o.pts)) continue;
    if (!env || sh.w * sh.h > env.sh.w * env.sh.h) env = o;
  }
  if (!env) return null;
  const E = env.sh;
  // (ROADMAP 11.14: an envelope is what is highest - something as big over it, a balloon it hangs
  // from: it is what hangs; and on two wheels under it, it is a body on its wheels, no airship)
  if (st.some((o) => o !== env && o.sh.closed && o.sh.area > E.area * 0.35 && o.sh.cy > E.y1)) return null;
  const onWheels = st.filter((o) => o !== env && o.sh.closed && o.sh.round && o.sh.size < E.w * 0.35 && o.sh.y1 > E.y0 - o.sh.size * 0.4 && o.sh.y1 < E.y0 + E.h * 0.35 && o.sh.cx > E.x0 && o.sh.cx < E.x1);
  if (onWheels.length >= 2) return null;
  const labels = { [env.i]: 'balloon' };
  let gondola = null;
  const fins = [];
  const props = [];
  const atEnd = (sh) => (sh.cx < E.x0 + E.w * 0.3 ? -1 : sh.cx > E.x1 - E.w * 0.3 ? 1 : 0);
  for (const o of st) {
    if (o === env || (over[o.i] && !BODYISH.has(over[o.i]) && over[o.i] !== 'fin' && over[o.i] !== 'prop')) continue;
    const sh = o.sh;
    const end = atEnd(sh);
    // (beyond an end, standing up, small: its propeller)
    if (end && (end < 0 ? sh.x1 < E.x0 + E.w * 0.06 : sh.x0 > E.x1 - E.w * 0.06) && sh.h > sh.w * 1.2 && sh.size < E.h * 1.3 && Math.abs(sh.cy - E.cy) < E.h * 0.45) {
      props.push({ o, end });
      continue;
    }
    // (at an end, out of it above or below: a fin)
    if (end && ((sh.y1 > E.y1 - E.h * 0.2 && sh.cy > E.cy + E.h * 0.15) || (sh.y0 < E.y0 + E.h * 0.2 && sh.cy < E.cy - E.h * 0.15)) && sh.size < E.w * 0.4) {
      fins.push({ o, end });
      continue;
    }
    // (close under its middle: its gondola - a long one slanting down off it is a wing, no gondola)
    if (sh.cy < E.y0 + E.h * 0.15 && sh.y1 > E.y0 - E.h * 0.5 && Math.abs(sh.cx - E.cx) < E.w * 0.32 && sh.w < E.w * 0.55 && sh.w > E.w * 0.06 && sh.h < E.h * 0.9 && !(sh.slant > 0.3 && sh.slant < 1.25 && sh.thin > 2.2 && !sh.straight)) {
      if (!gondola || sh.w * Math.max(sh.h, 1e-3) > gondola.sh.w * Math.max(gondola.sh.h, 1e-3)) gondola = o;
    }
  }
  const ev = !!gondola + (fins.length > 0) + (props.length > 0);
  if (ev < 2) return null;
  // (its back: where its fins are, its propeller)
  const backs = [...fins, ...props].map((q) => q.end);
  const back = backs.length ? (backs.reduce((a, b) => a + b, 0) <= 0 ? -1 : 1) : -1;
  for (const q of fins) labels[q.o.i] = q.end === back ? 'fin' : 'deco';
  for (const q of props) labels[q.o.i] = 'prop';
  let R = null;
  if (gondola) {
    labels[gondola.i] = 'body';
    R = region(G, [gondola]);
  }
  for (const o of st) {
    if (labels[o.i]) continue;
    const sh = o.sh;
    // (between it and the gondola: what it hangs on)
    if (gondola && sh.y1 < E.y0 + E.h * 0.3 && sh.y0 > gondola.sh.y0 - E.h * 0.1 && sh.slant > 0.6) {
      labels[o.i] = 'rope';
      continue;
    }
    labels[o.i] = 'deco';
  }
  const BB = R ? R.sh : { x0: E.cx - E.w * 0.12, x1: E.cx + E.w * 0.12, y0: E.y0 - E.h * 0.32, y1: E.y0 + E.h * 0.02, w: E.w * 0.24, h: E.h * 0.34, cx: E.cx, cy: E.y0 - E.h * 0.15, size: E.w * 0.24, area: E.w * E.h * 0.07 };
  return { fam: 'balloon', frame: 'ride', labels, score: 1, R: R || { sh: BB, loop: null, made: true }, main: gondola, front: back < 0 ? 1 : -1, arches: [], wheels: [], env, ship: ev };
}

// a hot-air balloon: a big round envelope over a little basket, ropes between
function parseBalloon(F) {
  const ship = parseAirship(F);
  if (ship) return ship;
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
  // the basket: small, compact, under it (ROADMAP 11.14: or what hangs from it in its place - a
  // car, a boat, a house: closed, under it, far bigger than the rest that could be)
  let basket = null;
  const hung = [];
  for (const o of st) {
    if (o === env || (over[o.i] && !BODYISH.has(over[o.i]))) continue;
    const sh = o.sh;
    const aspect = Math.max(sh.w, sh.h) / Math.max(1e-6, Math.min(sh.w, sh.h));
    if (sh.cy < E.y0 + E.h * 0.12 && sh.size < E.w * 0.75 && sh.size > E.w * 0.08 && aspect < 3 && (sh.closed || sh.cup || sh.endGap < sh.size * 0.9) && Math.abs(sh.cx - E.cx) < E.w * 0.5) hung.push(o);
  }
  // (ROADMAP 11.16: the one hanging under its middle - a propeller at the basket's side, hanging as
  // low, is no basket)
  const mid = hung.filter((o) => Math.abs(o.sh.cx - E.cx) < E.w * 0.25);
  for (const o of mid.length ? mid : hung) if (!basket || o.sh.y0 < basket.sh.y0) basket = o;
  // (ROADMAP 11.14) what hangs from it in its basket's place - a car, on its wheels: closed, long,
  // all of it under it, two wheels under it - it drives on the road too
  let wheelsUnder = [];
  for (const o of st) {
    if (o === env || o === basket || over[o.i]) continue;
    const sh = o.sh;
    if (!sh.closed || sh.w < sh.h * 1.3 || sh.y1 > E.y0 + E.h * 0.05 || sh.size < E.w * 0.4 || sh.size > E.w * 2.2 || Math.abs(sh.cx - E.cx) > E.w * 0.6) continue;
    const cand = wheelCands(st.filter((q) => q !== env && q !== o), D, over).filter((c) => c.cy < sh.y0 + sh.h * 0.45 && c.cy + c.r > sh.y0 - c.r * 0.6 && c.cx > sh.x0 - c.r && c.cx < sh.x1 + c.r && c.r < sh.w * 0.4);
    const ws = wheelSet(cand, { ...D, y0: Math.min(D.y0, ...cand.map((c) => c.y0)), h: D.h });
    if (ws.length >= 2 && (!basket || ws.length > wheelsUnder.length)) {
      basket = o;
      wheelsUnder = ws;
    }
  }
  // (ROADMAP 11.14) or, far bigger than a basket, a plane, a boat: closed and long, all of it under
  // it, its ropes down to it
  if (!wheelsUnder.length) {
    for (const o of st) {
      if (o === env || o === basket || over[o.i]) continue;
      const sh = o.sh;
      // (wider than the envelope: a wide basket is a basket still)
      if (!sh.closed || sh.w < sh.h * 1.8 || sh.y1 > E.y0 + E.h * 0.05 || sh.size < E.w * 1.25 || sh.size > E.w * 2.2 || Math.abs(sh.cx - E.cx) > E.w * 0.6) continue;
      if (basket && sh.size < basket.sh.size * 1.6) continue;
      const ropes = st.some((q) => q !== o && q !== env && !q.sh.closed && q.sh.slant > 0.6 && q.sh.y1 > E.y0 - E.h * 0.25 && q.sh.y0 < sh.y1 + sh.h * 0.6 && q.sh.y0 > sh.y0);
      if (ropes) basket = o;
    }
  }
  for (const c of wheelsUnder) labels[c.o.i] = 'wheel';
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
    // (ROADMAP 11.14: up to the envelope, or straight - a fin rising off what hangs is none)
    if (sh.y1 < E.y0 + E.h * 0.45 && sh.y0 > by - E.h * 0.15 && sh.slant > 0.6 && (sh.straight || sh.y1 > E.y0 - E.h * 0.15)) {
      labels[o.i] = 'rope';
      continue;
    }
    if (basket && R) {
      const r = relate(G, R, o);
      if (r.fo < 0.3) {
        labels[o.i] = 'body';
        continue;
      }
      // (ROADMAP 11.14) what was added to what hangs from it: a gun out of it (as long as it likes -
      // a basket is small), a propeller at its side, coils under it - and the rest a ride has
      const BS = R.sh;
      if (sh.coils >= 3 && !sh.closed && r.gap < BS.h * 0.4 && sh.cy < BS.y0 + BS.h * 0.2) {
        labels[o.i] = 'spring';
        continue;
      }
      if (sh.straight && sh.thin > 4 && r.gap < BS.w * 0.08 && sh.slant < 0.7 && sh.y1 < E.y0 - E.h * 0.05 && sh.long > BS.w * 0.35 && sh.long < E.w * 1.5 && (sh.x1 > BS.x1 + BS.w * 0.25 || sh.x0 < BS.x0 - BS.w * 0.25)) {
        labels[o.i] = 'barrel';
        continue;
      }
      if (F.len.air && (sh.closed || (sh.straight && sh.long > BS.h * 0.8)) && sh.h > sh.w * 1.6 && sh.size < BS.h * 2.5 && sh.size > BS.h * 0.3 && r.gap < BS.w * 0.12 && (sh.x0 > BS.x1 - BS.w * 0.05 || sh.x1 < BS.x0 + BS.w * 0.05) && Math.abs(sh.cy - BS.cy) < BS.h * 0.8) {
        labels[o.i] = 'prop';
        continue;
      }
      const t = addedPart(o, R, r, F.len);
      labels[o.i] = t === 'blade' || (F.len.air && (t === 'wing' || t === 'jet' || t === 'fin')) ? t : 'deco';
      continue;
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
  // (ROADMAP 11.16: its deck where x is - the top of its hull's line there)
  const hullO = outline(hull.pts);
  const deckAt = (x) => {
    const sp = hullO.length >= 3 ? spanAt(hullO, Math.min(Hs.x1 - Hs.w * 0.01, Math.max(Hs.x0 + Hs.w * 0.01, x))) : null;
    return sp ? sp[1] : Hs.y1;
  };
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
  // (ROADMAP 11.14: long and thin, far wider than the widest thing closed under it - no deck: a
  // wing over it, a rotor)
  const overhang = (o) => {
    const sh = o.sh;
    if (!(sh.thin > 4.5 && sh.long > Hs.w * 0.45)) return false;
    let w = 0;
    for (const q of ship) if (q !== o && q !== hull && (q.sh.closed || q.sh.cfill > 0.45) && q.sh.y1 < sh.y0 + Hs.h * 0.15 && q.sh.y1 > sh.y0 - Hs.h * 0.8 && q.sh.x1 > sh.x0 && q.sh.x0 < sh.x1) w = Math.max(w, q.sh.w);
    return sh.long > Math.max(w, Hs.w * 0.2) * 1.4;
  };
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
    // (ROADMAP 11.16) a sail drawn square, a mast up through it - a square sail, however boxy: no
    // cabin has a mast through it
    if (masts.some((m) => m.sh.cx > sh.x0 + sh.w * 0.15 && m.sh.cx < sh.x1 - sh.w * 0.15 && Math.min(m.sh.y1, sh.y1) - Math.max(m.sh.y0, sh.y0) > sh.h * 0.5) && (sh.closed || sh.cfill > 0.45) && sh.thin < 4 && sh.size > Hs.h * 0.4) {
      labels[o.i] = 'sail';
      sails++;
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
    // (ROADMAP 11.16) a V standing on its deck, its point up off it - a shark's fin, a submarine's:
    // no cabin, a fin
    if (!sh.closed && sh.h > Hs.h * 0.25) {
      const tip = vTip(o.pts);
      const ends = [o.pts[0], o.pts[o.pts.length - 1]];
      if (tip && tip[1] > sh.y0 + sh.h * 0.6 && ends.every((p) => p[1] < deckAt(p[0]) + Hs.h * 0.3)) {
        labels[o.i] = 'fin';
        continue;
      }
    }
    // (ROADMAP 11.16) a pipe up off its deck, its other end free in the air - a periscope, an aerial,
    // a funnel's pipe: a mast of its own, no cabin
    if (!sh.closed && sh.endGap > sh.size * 0.5) {
      const [a, b] = [o.pts[0], o.pts[o.pts.length - 1]];
      const on = (p) => p[1] < deckAt(p[0]) + Hs.h * 0.15;
      const up = (p) => p[1] > deckAt(p[0]) + Hs.h * 0.3;
      // (no sailing mast: none of what says it is a sailing boat)
      if ((on(a) && up(b)) || (on(b) && up(a))) {
        labels[o.i] = 'mast';
        continue;
      }
    }
    // (ROADMAP 11.14: a long thin tube lying on its deck, out over its bow or its stern - a gun; no
    // cabin is a tube)
    if (sh.closed && sh.thin > 5 && sh.slant < 0.35 && sh.y0 < Hs.y1 + Hs.h * 0.6 && sh.long > Hs.w * 0.15 && sh.long < Hs.w * 0.6 && (sh.x1 > Hs.x1 + Hs.w * 0.03 || sh.x0 < Hs.x0 - Hs.w * 0.03)) {
      labels[o.i] = 'barrel';
      continue;
    }
    // a cabin on its deck, funnels on that (ROADMAP 11.14: one long and thin over it, far wider than
    // what is under it - no deck of it: a wing, a rotor, read below)
    if (sh.y0 < Hs.y1 + Hs.h * 0.5 && sh.w < Hs.w * 0.9 && (sh.closed || sh.cfill > 0.45) && !overhang(o)) {
      labels[o.i] = 'cabin';
      continue;
    }
    labels[o.i] = 'deco';
  }
  // (a mast and no sail drawn by it: what is drawn off it up there is its sail - ROADMAP 11.14: a
  // level line on its top, the player said it flies: its rotor, on its mast)
  const onMast = (o) => o.sh.straight && o.sh.slant < 0.25 && masts.some((m) => Math.abs(m.sh.cx - o.sh.cx) < o.sh.long * 0.22 && Math.abs(m.sh.y1 - o.sh.cy) < Hs.h * 0.35);
  if (masts.length && !sails) {
    for (const o of ship) {
      if (labels[o.i] !== 'deco' && labels[o.i] !== 'cabin') continue;
      const sh = o.sh;
      if (F.len.air && onMast(o)) continue;
      if (sh.y0 > Hs.y1 && sh.size > Hs.w * 0.12 && sh.cfill < 0.65 && masts.some((m) => Math.abs(sh.cx - m.sh.cx) < Hs.w * 0.45)) {
        labels[o.i] = 'sail';
        sails++;
      }
    }
  }
  const use = ship.filter((o) => labels[o.i] === 'hull' || labels[o.i] === 'cabin' || BODYISH.has(over[o.i]));
  const R = region(G, use) || region(G, [hull], 4);
  if (!R) return null;
  // (ROADMAP 11.14) what was added to it - an invention of a boat and something else: an engine out
  // past its stern (standing up, a propeller; lying, a jet), coils, a rotor on its mast, a long thin
  // one level over its deck (an engine on it: its wing; none, and the player said it flies: a
  // rotor), a gun on its deck
  const extra = ship.filter((o) => labels[o.i] === 'deco' && !over[o.i]);
  let pushed = false;
  for (const o of F.len.air ? extra : []) {
    const sh = o.sh;
    const end = sh.x1 < Hs.x0 + Hs.w * 0.04 || sh.x0 > Hs.x1 - Hs.w * 0.04;
    if (!end || !(sh.closed || sh.endGap < sh.size * 0.3) || sh.size > Hs.h * 1.8 || sh.size < Hs.h * 0.15 || sh.cy < Hs.y0 - Hs.h * 0.3 || sh.cy > Hs.y1 + Hs.h * 0.8) continue;
    labels[o.i] = sh.h > sh.w * 1.3 ? 'prop' : 'jet';
    pushed = true;
  }
  for (const o of extra) {
    if (labels[o.i] !== 'deco') continue;
    const sh = o.sh;
    const flat = (sh.straight || sh.thin > 4) && sh.slant < 0.3 && sh.long > Hs.w * 0.4 && sh.long < Hs.w * 1.6 && sh.y0 > Hs.y1 - Hs.h * 0.15 && Math.abs(sh.cx - Hs.cx) < Hs.w * 0.35;
    if (F.len.air && flat) {
      labels[o.i] = pushed && !onMast(o) && !mastUnder(st, o, R.sh) ? 'wing' : 'rotor';
      continue;
    }
    // (the rest a ride has: a gun, a spring, a blade - and, the player said it flies, the rest)
    const t = addedPart(o, R, relate(G, R, o), F.len);
    labels[o.i] = t && (F.len.air || (t === 'barrel' && F.len.weapon) || t === 'blade') ? t : 'deco';
  }
  // (a boat-like hull: wider at its deck than at its keel - ROADMAP 11.14: or its hull's own line so,
  // its cabins over it)
  const wB = R.loop ? widthAt(R.loop, R.sh.y0 + R.sh.h * 0.15) : 0;
  const wT = R.loop ? widthAt(R.loop, R.sh.y0 + R.sh.h * 0.85) : 1;
  const keel = wB < wT * 0.85 || (hull.sh.closed && widthAt(hull.pts, Hs.y0 + Hs.h * 0.15) < widthAt(hull.pts, Hs.y0 + Hs.h * 0.85) * 0.9);
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

// (ROADMAP 11.13) what was drawn read as no kind at all - a line, a dash, a scribble - and the
// player said it flies: a body as long as it all and as high as a body is, each line drawn on it
// (a rotor over it: readParts)
function madeRide(F) {
  const { st, D } = F;
  const h = Math.max(D.h, D.w * 0.28);
  const w = Math.max(D.w, h);
  const cx = (D.x0 + D.x1) / 2;
  const cy = (D.y0 + D.y1) / 2;
  const sh = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2, w, h, cx, cy, size: Math.max(w, h), area: w * h * 0.7 };
  const labels = {};
  let main = null;
  for (const o of st) {
    labels[o.i] = F.over[o.i] || 'deco';
    if (!main || o.sh.len > main.sh.len) main = o;
  }
  return { fam: 'copter', frame: 'ride', labels, score: 0.2, R: { sh, loop: null, made: true }, main, front: 1, arches: [], wheels: [] };
}

// how unmistakably a reading is its kind, by the parts only that kind has (0..1)
function sureOf(res) {
  const n = {};
  for (const t of Object.values(res.labels)) n[t] = (n[t] || 0) + 1;
  if (res.fam === 'plane') return res.top ? Math.min(0.9, Math.max(0, (res.like || 1) - 0.9)) : n.wing && n.fin && (n.prop || n.jet) ? 0.9 : n.wing && (n.fin || n.prop || n.jet) ? 0.55 : 0;
  if (res.fam === 'copter') return res.rocket ? (res.rocket.flame ? 0.92 : 0.8) : res.drone || res.heliTop ? 0.88 : n.rotor && n.tail ? 0.8 : n.rotor && n.skid ? 0.6 : n.rotor ? 0.55 : 0;
  if (res.fam === 'balloon') return res.ship ? 0.65 + res.ship * 0.1 : n.balloon && n.rope && n.body ? 0.8 : 0;
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
    // (ROADMAP 11.14: a ride of one kind said, a ride of another plainly drawn - a tank, a boat, a
    // car the network plainly sees, the player said flies: that, with what flies it on it - an
    // invention of two)
    const rideCat = [...cats].some((c) => c === 'car' || c === 'air' || c === 'sea');
    const seen = !!(net && net.groups && net.groups.length);
    for (const f of FAMS) {
      const plain = rideCat && seen && (f === 'ground' || f === 'boat') ? Math.min(1, Math.max(0.12, (p[f] - 0.03 - 0.5) * 4)) : 0.12;
      p[f] *= on.has(f) ? 3 : plain;
    }
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
// scale (k), arches (wheels in its wheel arches), top (a plane drawn from above) }. (ROADMAP 11.15)
// ctx.noImplicit: a Set of the parts the game would add that the player took away - not added
// (ROADMAP 11.16) strokes that go round one shape between them - a body, a wheel, a sail drawn in two
// or three strokes, the finger lifted on the way round: each stroke's end meets the next's (a little
// apart, or drawn on over it), the last back to the first. Read as one: the first stroke carries the
// whole shape, closed; the rest are parts of it. Never strokes the player named, nor two lines side by
// side that only close across their ends (a ladder's rails): what it jumps across is small for how
// thick the shape it closes is. Returns { st, pieces: [[first i, [the rest]]] }
function joinPieces(st, D, over) {
  const e1 = D.size * 0.07;
  const e2 = D.size * 0.03;
  const open = st.filter((o) => !o.sh.closed && !over[o.i] && o.sh.size > D.size * 0.04 && o.kind !== 'dot' && o.kind !== 'scribble' && o.pts.length > 2);
  if (open.length < 2 || open.length > 24) return { st, pieces: [] };
  const end = (o, e) => (e ? o.pts[o.pts.length - 1] : o.pts[0]);
  // (a point meeting a stroke: at one of its ends, or on it near one - drawn on over it)
  const meet = (p, b) => {
    const P = b.pts;
    const n = P.length;
    let best = null;
    const m = Math.max(2, Math.round(n * 0.25));
    for (let q = 0; q < n; q++) {
      if (q > m && q < n - 1 - m) continue;
      const d = Math.hypot(p[0] - P[q][0], p[1] - P[q][1]);
      const lim = q === 0 || q === n - 1 ? e1 : e2;
      if (d < lim && (!best || d < best.d)) best = { d, e: q <= m ? 0 : 1 };
    }
    return best;
  };
  const tryLoop = (chain) => {
    // chain: [{ o, rev }] in order; every end to the next one's start, the last back to the first
    let jump = 0;
    let worst = 0;
    for (let c = 0; c < chain.length; c++) {
      const a = chain[c];
      const b = chain[(c + 1) % chain.length];
      const m = meet(end(a.o, a.rev ? 0 : 1), b.o);
      if (!m || m.e !== (b.rev ? 1 : 0)) return null;
      jump += m.d;
      worst = Math.max(worst, m.d);
    }
    const pts = [];
    for (const { o, rev } of chain) pts.push(...(rev ? o.pts.slice().reverse() : o.pts));
    pts.push(pts[0].slice());
    const sh = measure(pts, 'mixed', null);
    // (round a shape that has an inside - not two lines side by side, not one drawn over and back)
    let area = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
    if (Math.abs(area) / 2 < sh.long * sh.thick * 0.3 || worst > sh.thick * 0.35) return null;
    return { jump, pts };
  };
  const cands = [];
  for (let a = 0; a < open.length; a++) {
    for (let b = 0; b < open.length; b++) {
      if (b === a) continue;
      for (const rb of [false, true]) {
        if (b > a) {
          const L = tryLoop([{ o: open[a], rev: false }, { o: open[b], rev: rb }]);
          if (L) cands.push({ ids: [a, b], chain: [{ o: open[a], rev: false }, { o: open[b], rev: rb }], ...L });
        }
        for (let c = 0; c < open.length; c++) {
          if (c === a || c === b || b < a || c < a) continue;
          for (const rc of [false, true]) {
            const ch = [{ o: open[a], rev: false }, { o: open[b], rev: rb }, { o: open[c], rev: rc }];
            const L = tryLoop(ch);
            if (L) cands.push({ ids: [a, b, c], chain: ch, ...L, jump: L.jump * 1.2 });
          }
        }
      }
    }
  }
  if (!cands.length) return { st, pieces: [] };
  cands.sort((p, q) => p.jump - q.jump);
  const used = new Set();
  const out = st.slice();
  const pieces = [];
  for (const C of cands) {
    if (C.ids.some((x) => used.has(x))) continue;
    for (const x of C.ids) used.add(x);
    const first = C.chain.reduce((m, q) => (q.o.i < m.i ? q.o : m), C.chain[0].o);
    const whole = { i: first.i, ink: first.ink, kind: 'mixed', pts: dense(C.pts), raw: null };
    whole.sh = measure(whole.pts, 'mixed', null);
    const rest = C.chain.map((q) => q.o).filter((o) => o !== first);
    out.splice(out.indexOf(first), 1, whole);
    for (const o of rest) out.splice(out.indexOf(o), 1);
    pieces.push([first.i, rest]);
  }
  return { st: out, pieces };
}

// (ROADMAP 11.16) a ladder: two long lines side by side, alike in length and way, close for how long
// they are, and short ones across from one to the other along them (its rungs - two at least, not
// only its two ends: a box drawn in four lines is no ladder) - on a fire engine's roof, hung from a
// helicopter: as drawn, no rotor, no gun, no body. Returns the strokes it is drawn in
function ladders(st, D, over) {
  const out = new Set();
  const free = st.filter((o) => !over[o.i] && !o.sh.closed && o.kind !== 'dot' && o.kind !== 'scribble');
  const rails = free.filter((o) => (o.sh.straight || o.sh.thin > 6) && o.sh.long > D.size * 0.2);
  for (let a = 0; a < rails.length; a++) {
    for (let b = a + 1; b < rails.length; b++) {
      const A = rails[a].sh;
      const B = rails[b].sh;
      let dAng = Math.abs(Math.atan2(A.uy, A.ux) - Math.atan2(B.uy, B.ux)) % Math.PI;
      dAng = Math.min(dAng, Math.PI - dAng);
      if (dAng > 0.2 || Math.min(A.long, B.long) < Math.max(A.long, B.long) * 0.65) continue;
      // (how far apart: B's middle from A's line; along A, how much of the shorter they share)
      const sep = toLine([B.cx, B.cy], rails[a].pts);
      const L = Math.min(A.long, B.long);
      if (sep < D.size * 0.02 || sep > L * 0.3) continue;
      const along = (p) => (p[0] - A.cx) * A.ux + (p[1] - A.cy) * A.uy;
      const bs = rails[b].pts.map(along);
      const lo = Math.max(-A.long / 2, Math.min(...bs));
      const hi = Math.min(A.long / 2, Math.max(...bs));
      if (hi - lo < L * 0.6) continue;
      let rungs = 0;
      let inner = 0;
      const these = [];
      for (const o of free) {
        if (o === rails[a] || o === rails[b] || o.sh.long > sep * 2.2 || o.sh.long < sep * 0.4) continue;
        const p = o.pts[0];
        const q = o.pts[o.pts.length - 1];
        const lim = sep * 0.4;
        const pa = toLine(p, rails[a].pts);
        const pb = toLine(p, rails[b].pts);
        const qa = toLine(q, rails[a].pts);
        const qb = toLine(q, rails[b].pts);
        if (!((pa < lim && qb < lim) || (pb < lim && qa < lim))) continue;
        const t = (along([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]) - lo) / Math.max(1e-6, hi - lo);
        if (t < -0.1 || t > 1.1) continue;
        rungs++;
        if (t > 0.12 && t < 0.88) inner++;
        these.push(o.i);
      }
      if (inner < 2 && !(rungs >= 3 && inner >= 1)) continue;
      // (a band across a body - a bus's windows between two long lines, the frames between them - has
      // more of the body over it along most of it: a ladder is on top)
      const nx = A.uy > 0 || (A.uy === 0 && A.ux < 0) ? A.uy : -A.uy;
      const ny = A.uy > 0 || (A.uy === 0 && A.ux < 0) ? -A.ux : A.ux;
      const up = ny >= 0 ? [nx, ny] : [-nx, -ny];
      const N = 10;
      const binOf = (p) => Math.floor(((along(p) - lo) / Math.max(1e-6, hi - lo)) * N);
      const railTop = new Array(N).fill(-Infinity);
      for (const o of [rails[a], rails[b]]) {
        for (const p of o.pts) {
          const k = binOf(p);
          if (k >= 0 && k < N) railTop[k] = Math.max(railTop[k], p[0] * up[0] + p[1] * up[1]);
        }
      }
      const lid = new Array(N).fill(false);
      const mine = new Set([rails[a].i, rails[b].i, ...these]);
      for (const o of st) {
        if (mine.has(o.i)) continue;
        for (const p of o.pts) {
          const k = binOf(p);
          if (k >= 0 && k < N && railTop[k] > -Infinity && p[0] * up[0] + p[1] * up[1] > railTop[k] + sep * 0.3) lid[k] = true;
        }
      }
      if (lid.filter(Boolean).length >= N * 0.6) continue;
      out.add(rails[a].i);
      out.add(rails[b].i);
      for (const i of these) out.add(i);
    }
  }
  return out;
}

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
  // (ROADMAP 11.16: a shape drawn in two or three strokes, the finger lifted on the way round - read
  // as the one shape it is)
  const joined = joinPieces(st, D, over);
  st.splice(0, st.length, ...joined.st);
  // (ROADMAP 11.16: a ladder drawn on it - its lines as drawn, read as no other part)
  const lad = ladders(st, D, over);
  const overP = lad.size ? Object.assign({}, over) : over;
  for (const i of lad) overP[i] = 'deco';
  const G = new PGrid(st.map((o) => o.pts), 72);
  const prior = familyPrior(ctx, hint);
  const cats = ctx && ctx.cats;
  const len = { air: !!(cats && cats.has('air')), sea: !!(cats && cats.has('sea')), weapon: !!(cats && cats.has('weapon')) };
  const F = { st, D, G, over: overP, len, cls: ctx && ctx.net && ctx.net.best ? ctx.net.best[2] : null, clsP: ctx && ctx.net && ctx.net.best ? ctx.net.best[1] : 0 };
  // (the player named a part only a thing for the hand has: it is one - a ride with a sight, a
  // silencer on it, a ride still; a part only a ride has: it is one - ROADMAP 11.12)
  const picked = Object.values(over);
  const was = ctx && ctx.frame;
  // (ROADMAP 11.13: the player said they draw a ride - an aircraft, a car, a boat, armed or not: a
  // ride it is, however much its lines look like a rifle's - a grip named on it, its handle; as
  // game/freeform.js readFree has it, a ride of one kind or more)
  const catRide = !!(cats && cats.size) && [...cats].some((c) => c === 'car' || c === 'air' || c === 'sea');
  const handSaid = !catRide && (picked.some((t) => HELD.has(t)) || (was !== 'ride' && picked.some((t) => HAND_ONLY.has(t))));
  const rideSaid = picked.some((t) => RIDES_IT.has(t)) || (was !== 'hand' && picked.some((t) => RIDE_ONLY.has(t)));
  const order = FAMS.slice().sort((a, b) => prior[b] - prior[a]);
  let best = null;
  const tried = [];
  const reads = [];
  for (const f of order) {
    if (handSaid && f !== 'hand') continue;
    if ((rideSaid || catRide) && !handSaid && f === 'hand') continue;
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
    // (ROADMAP 11.13: within what the player said they draw - a drone's rotors round its middle
    // are no motorbike's wheels, whatever the network sees in them)
    const said = !!(cats && cats.size) && [...cats].some((c) => (FAM_OF_CAT[c] || []).includes(f));
    // (a lesser likeness - a wing and a tail - does not outweigh a network that plainly sees
    // something else: a helicopter it sees in it stays one)
    const ng = ctx && ctx.net && ctx.net.best;
    // (ROADMAP 11.13: what the player said it is not - a knife it sees in a rocket they said flies -
    // no other thing it plainly is: only its shape)
    const netElse = !!(ng && FAM_OF_GROUP[ng[0]] && FAM_OF_GROUP[ng[0]] !== f && ng[1] > 0.5 && !(catRide && FAM_OF_GROUP[ng[0]] === 'hand'));
    // (and a network all but certain of something else outweighs all but the surest - an airship's
    // envelope on a plane it plainly sees is that plane's body)
    const pr = said && ((sure >= 0.85 && !(ng && ng[1] > 0.9 && sure < 0.9)) || !netElse) ? Math.max(prior[f], sure * 0.7) : prior[f];
    res.total = pr * res.score * (0.7 + 0.3 * (known / Math.max(1e-6, all)));
    res.said = said;
    tried.push([f, res.score, res.total]);
    reads.push(res);
    if (!best || res.total > best.total) best = res;
  }
  // (ROADMAP 11.14: a ride of a kind the player did not say, only because the network plainly sees
  // it - and one of a kind they said, unmistakably that (a drone's rotors round it, a plane's wing,
  // fin and propeller): that one)
  if (best && !best.said && catRide) {
    const sure = reads.filter((r) => r.said && r.sure >= 0.85 && (r.drone || r.heliTop || r.rocket || r.top || r.ship)).sort((a, b) => b.total - a.total)[0];
    if (sure) best = sure;
  }
  // (ROADMAP 11.13: the player said it flies, and none of its kinds reads in it - a line, a dash, a
  // scribble: a body of it all as drawn, a rotor over it - never a made-up aircraft in its place)
  if (!best && len.air && !handSaid) best = madeRide(F);
  if (!best) return null;
  // (a parachute drawn over it: the network looks again, at what is under it - a dome over a plane is
  // no car's roof - and it is read again by that; ctx.relook(the lines to look at): what it sees)
  if (ctx && ctx.relook && Object.values(best.labels).includes('chute')) {
    const net2 = ctx.relook(S.map((s) => s.i).filter((i) => best.labels[i] !== 'chute'));
    if (net2) return readParts(strokes, over, face, hint, { ...ctx, net: net2, relook: null });
  }
  // the player's own say over all (what it would be without it: for the menu's "automatic")
  for (const i of lad) best.labels[i] = 'deco';
  const autoL = Object.assign({}, best.labels);
  for (const o of st) if (over[o.i] && PART[over[o.i]]) best.labels[o.i] = over[o.i];
  // (ROADMAP 11.13) the player said it flies, and nothing drawn lifts it: what it is missing, where
  // it goes - game/partsum.js rideDesign makes it (a rotor on a mast over its middle, a wing across
  // it), the rest of it as drawn; never a made-up aircraft in its place
  // (a rocket drawn with no flame under it: its engine there, in its foot)
  if (len.air && best.rocket && !Object.values(best.labels).includes('jet')) best.implicit = (best.implicit || []).concat([{ type: 'jet', at: [best.R.sh.cx, best.R.sh.y0 - best.R.sh.h * 0.05] }]);
  if (len.air && best.frame === 'ride' && best.R && !best.top && !best.drone && !best.heliTop && !best.rocket) {
    const has = (t) => Object.values(best.labels).includes(t);
    const BB = best.R.sh;
    // (a jet under it, not at its tail, pointing down: it lifts - game/partrole.js roleOf's 'vtol';
    // one at its tail pushes, and lifts nothing)
    const lifts = st.some((o) => {
      if (best.labels[o.i] !== 'jet') return false;
      const u = (o.sh.cx - BB.x0) / Math.max(1e-6, BB.w);
      return o.sh.cy < BB.y0 + BB.h * 0.3 && (best.front < 0 ? 1 - u : u) >= 0.2;
    });
    // (a wing that holds it up: lying across it - or hanging far off it, as one drawn from a little
    // above; one standing up on it is a fin - game/partrole.js, game/partsum.js wingPlan)
    const winged = st.some((o) => best.labels[o.i] === 'wing' && (!(o.sh.h > o.sh.w * 1.3) || (o.sh.cy < BB.cy ? BB.cy - o.sh.y0 : o.sh.y1 - BB.cy) >= BB.h * 0.75));
    // (a rotor over it, not one lying under it - a hovercraft's fan lifts it off the ground only)
    const rotored = st.some((o) => best.labels[o.i] === 'rotor' && o.sh.cy >= BB.y0 + BB.h * 0.3);
    if (best.fam === 'copter' && !rotored && !lifts) best.implicit = (best.implicit || []).concat([{ type: 'rotor', at: [BB.cx, BB.y1 + BB.h * 0.3] }]);
    // (a body standing up, taller than long - no wing across it holds that up: a rotor over it)
    else if (best.fam === 'plane' && !winged) best.implicit = (best.implicit || []).concat([BB.h > BB.w * 1.4 ? { type: 'rotor', at: [BB.cx, BB.y1 + BB.h * 0.3] } : { type: 'wing', at: [BB.cx, BB.y0] }]);
    // (read as a thing of the road or the water - nothing on it that lifts it: a sail, a jet out of
    // its back, a parachute lift nothing, nor a wing with nothing to push it - a rotor over it, and
    // it flies as well)
    // (ROADMAP 11.14: an engine drawn on it that pushes it - a jet out of its back, a propeller -
    // and nothing that lifts it: a wing across it, and its own engine flies it as a plane's does; a
    // wing drawn and nothing to push it: a small propeller at its back for the wing)
    else if ((best.fam === 'ground' || best.fam === 'boat') && !rotored && !has('balloon') && !lifts) {
      const thrust = has('prop') || has('jet');
      if (thrust && !winged) best.implicit = (best.implicit || []).concat([{ type: 'wing', at: [BB.cx, BB.y0 + BB.h * 0.3] }]);
      else if (winged && !thrust) best.implicit = (best.implicit || []).concat([{ type: 'prop', at: [best.front < 0 ? BB.x1 : BB.x0, BB.cy] }]);
      else if (!winged) best.implicit = (best.implicit || []).concat([{ type: 'rotor', at: [BB.cx, BB.y1 + BB.h * 0.3] }]);
    }
  }
  // (ROADMAP 11.15: nothing drawn is turned away - the player said it drives (or said nothing, and it
  // is read as a thing of the road), and nothing on it moves it: two wheels under its two ends, as
  // a car's hide in its arches - dashed on the drawing, and the player can take them away)
  const said = cats && cats.size ? cats : null;
  if ((!said || said.has('car')) && !len.air && best.frame === 'ride' && best.fam === 'ground' && best.R && !(best.arches && best.arches.length)) {
    const moves = Object.values(best.labels).some((t) => t === 'wheel' || t === 'rotor' || t === 'prop' || t === 'jet' || t === 'sail' || t === 'balloon' || t === 'hull');
    if (!moves) {
      const BB = best.R.sh;
      const r = Math.max(BB.w * 0.05, Math.min(BB.h * 0.32, BB.w * 0.13));
      best.arches = [{ x: BB.x0 + BB.w * 0.2, y: BB.y0, r, given: true }, { x: BB.x1 - BB.w * 0.2, y: BB.y0, r, given: true }];
    }
  }
  // (ROADMAP 11.16: a barrel drawn as its two sides - two lines side by side, alike, close for how
  // long they are (or one drawn over again): one barrel, as thick as they are apart; the first
  // carries it, the other is its name only)
  const sides = st.filter((o) => best.labels[o.i] === 'barrel' && !over[o.i] && !o.sh.closed && (o.sh.straight || o.sh.thin > 5));
  for (let a = 0; a < sides.length; a++) {
    for (let b = a + 1; b < sides.length; b++) {
      const A = sides[a];
      const Bq = sides[b];
      if (!st.includes(A) || !st.includes(Bq)) continue;
      let dAng = Math.abs(Math.atan2(A.sh.uy, A.sh.ux) - Math.atan2(Bq.sh.uy, Bq.sh.ux)) % Math.PI;
      dAng = Math.min(dAng, Math.PI - dAng);
      const L = Math.min(A.sh.long, Bq.sh.long);
      if (dAng > 0.2 || L < Math.max(A.sh.long, Bq.sh.long) * 0.6) continue;
      const along = (p) => (p[0] - A.sh.cx) * A.sh.ux + (p[1] - A.sh.cy) * A.sh.uy;
      const bs = Bq.pts.map(along);
      if (Math.min(A.sh.long / 2, Math.max(...bs)) - Math.max(-A.sh.long / 2, Math.min(...bs)) < L * 0.6) continue;
      const sep = toLine([Bq.sh.cx, Bq.sh.cy], A.pts);
      if (sep > L * 0.35) continue;
      // (round the two: one along, the other back)
      const a1 = A.pts[A.pts.length - 1];
      const near0 = Math.hypot(a1[0] - Bq.pts[0][0], a1[1] - Bq.pts[0][1]) < Math.hypot(a1[0] - Bq.pts[Bq.pts.length - 1][0], a1[1] - Bq.pts[Bq.pts.length - 1][1]);
      const box = A.pts.concat(near0 ? Bq.pts : Bq.pts.slice().reverse());
      box.push(box[0].slice());
      const whole = { ...A, kind: 'poly', pts: dense(box), raw: null };
      whole.sh = measure(whole.pts, 'poly', null);
      st.splice(st.indexOf(A), 1, whole);
      st.splice(st.indexOf(Bq), 1);
      sides[a] = whole;
      joined.pieces.push([A.i, [Bq]]);
    }
  }
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
  // (the strokes one shape was drawn in: each of them that part, its name by it - the first carries
  // the whole of it, what is made of it; the rest are only its name)
  const pieceSt = [];
  for (const [first, rest] of joined.pieces) {
    const t = best.labels[first] || 'deco';
    for (const o of rest) {
      const pts = flip ? o.pts.map(([x, y]) => [fx(x), y]) : o.pts;
      pieceSt.push({ i: o.i, ink: o.ink, kind: o.kind, pts, sh: flip ? measure(pts, o.kind, null) : o.sh, type: t, of: first });
      best.labels[o.i] = t;
      if (autoL[first]) autoL[o.i] = autoL[first];
    }
  }
  let R = null;
  if (best.R) {
    const loop = best.R.loop ? (flip ? best.R.loop.map(([x, y]) => [fx(x), y]).reverse() : best.R.loop) : null;
    const sh = loop ? Object.assign(shapeOf(loop.concat([loop[0]])), { area: best.R.sh.area }) : flip ? Object.assign({}, best.R.sh, { x0: fx(best.R.sh.x1), x1: fx(best.R.sh.x0), cx: fx(best.R.sh.cx), mx: fx(best.R.sh.mx || best.R.sh.cx) }) : best.R.sh;
    // (ROADMAP 11.14: a bike's - its frame of lines, no body drawn: built as a bike, game/partsum.js)
    R = { loop, sh, made: !!best.R.made, bike: !!best.R.bike };
  }
  // (ROADMAP 11.15: the parts the game adds that the player took away - none)
  const noImp = ctx && ctx.noImplicit && ctx.noImplicit.size ? ctx.noImplicit : null;
  if (noImp && best.implicit) best.implicit = best.implicit.filter((q) => !noImp.has(q.type));
  const arches = best.frame === 'ride' && !(noImp && noImp.has('wheel')) ? (best.arches || []).map((a) => ({ ...a, x: fx(a.x) })) : [];
  const parts = ost.concat(pieceSt).sort((a, b) => a.i - b.i).map((o) => {
    const auto = autoL[o.i] && autoL[o.i] !== over[o.i] ? autoL[o.i] : over[o.i] ? 'deco' : autoL[o.i] || 'deco';
    return { i: o.i, type: o.type, auto, choices: choicesFor(o.sh, best.frame, auto), at: labelAt(strokes[o.i].p), sh: o.sh };
  });
  const main = best.main ? best.main.i : -1;
  // (the parts no one line is - wheels in its arches, a plane's wings in its outline: where their
  // names go, page units)
  const toPage = ([x, y]) => [x / k + x0, y1 - y / k];
  const implicit = (best.implicit || []).map((q) => ({ type: q.type, at: toPage(q.at) }));
  for (const a of best.frame === 'ride' && !(noImp && noImp.has('wheel')) ? best.arches || [] : []) implicit.push({ type: 'wheel', at: toPage([a.x, a.y + a.r]), guess: !!a.guess, given: !!a.given });
  // (what the network sees in it, each kind with its chance: game/partsum.js names it by that)
  const guess = ctx && ctx.net && ctx.net.groups ? ctx.net.groups : null;
  const prob = ctx && ctx.net && ctx.net.p ? ctx.net.p : null;
  // (a drone from above: its middle, its rotors - in the frame it is built in)
  const drone = best.drone ? { cx: fx(best.drone.cx), cy: best.drone.cy, body: best.drone.body, rotors: best.drone.rotors.map((r) => ({ ...r, cx: fx(r.cx) })) } : null;
  const H0 = best.heliTop;
  const heliTop = H0 ? { ...H0, hub: [fx(H0.hub[0]), H0.hub[1]], tailEnd: [fx(H0.tailEnd[0]), H0.tailEnd[1]], ux: flip ? -H0.ux : H0.ux } : null;
  return { frame: best.frame, family: best.fam, parts, flip, body: main, R, st: ost, k, x0, x1, y0, y1, arches, top: best.top || null, drone, heliTop, rocket: best.rocket || null, ship: !!best.ship, prior, score: best.score, sure: best.sure || 0, tried, implicit, like: F.dbgLike, guess, prob, sea: len.sea, ladder: lad.size ? [...lad] : null };
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
  if (wheels >= 2 || T.includes('rotor') || T.includes('sail') || T.includes('balloon') || P.top || P.rocket || P.drone || P.heliTop || P.ship) return 2;
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
