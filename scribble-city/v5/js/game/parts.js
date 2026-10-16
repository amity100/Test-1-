import { shapeOf, springy, outline, inPoly, spanAt } from './drawncar.js';

// (ROADMAP 11.10, the sample) What each line drawn is: a part, read from its shape and from where
// it is on the body - and what the thing does is the parts added up, nothing else (no guess at the
// end of what the whole drawing is; ui/freedraw.js shows each part's name by it as it is drawn, and
// a tap on the name changes it). Two kinds of thing are made of parts:
//   - a ride: a body, and what moves it - wheels (it drives), a rotor (it hovers), wings with a
//     propeller or a jet (it flies; wings alone, it glides), a sail or a floating hull (it sails), a
//     balloon (it rises) - and what else is on it: barrels (each one fires), a blade (it rams), a
//     spring (it jumps), a parachute (opened in the air), armour
//   - a thing for the hand: a grip (it is held), and on it barrels (each fires), a blade (it cuts;
//     on a gun, it stabs too), a head (it smashes), a magazine, a sight, a stock, a spring, a
//     parachute
// Strokes in the drawing's units (x right, y down), steadied (game/inkclean.js). Read in a frame of
// its own: as wide as a car is long (4.5), y up, and with its front to the right or to the left -
// whichever its parts say.

export const PART = {
  body: { name: 'גוף', role: 'body' },
  cabin: { name: 'תא', role: 'body' },
  hull: { name: 'גוף צף', role: 'water' },
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
  chute: { name: 'מצנח', role: 'gear' },
  spring: { name: 'קפיץ', role: 'gear' },
  armor: { name: 'שריון', role: 'gear' },
  window: { name: 'חלון', role: 'deco' },
  tail: { name: 'זנב', role: 'air' },
  skid: { name: 'מגלש', role: 'deco' },
  deco: { name: 'קישוט', role: 'deco' },
};

// the parts that only a ride has, and only a thing for the hand
const RIDE_ONLY = new Set(['wheel', 'rotor', 'wing', 'prop', 'jet', 'fin', 'tail', 'skid', 'sail', 'balloon', 'hull', 'cabin', 'window', 'mast']);
const HAND_ONLY = new Set(['grip', 'mag', 'scope', 'stock', 'guard', 'head']);

const FRAME_W = 4.5;

// ------------------------------------------------------------------ a line's own measures
// (x forward, y up, in the frame's units; for a line: its length along it, how slanted, how thick)
function measure(pts, kind) {
  const sh = shapeOf(pts);
  // (steadied, game/inkclean.js: it knows - a polygon has corners, a circle none)
  if (kind === 'poly' || kind === 'line') sh.round = false;
  else if (sh.closed && (kind === 'circle' || (kind === 'ellipse' && sh.w < sh.h * 1.4 && sh.h < sh.w * 1.4))) sh.round = true;
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
  // how much of its box it fills (a triangle about half, a box all of it)
  sh.fill = sh.closed ? sh.area / Math.max(1e-6, sh.w * sh.h) : 0;
  // round enough for a wheel, drawn quickly: an oval, or most of one (an arc right round past
  // half of it) - not a box (its corners: too far out for an oval)
  sh.roundish = !!sh.round;
  if (!sh.round && kind !== 'poly' && kind !== 'line' && pts.length > 6) {
    const ax = Math.max(1e-6, sh.w / 2);
    const ay = Math.max(1e-6, sh.h / 2);
    let m = 0;
    let m2 = 0;
    const ang = [];
    for (const [x, y] of pts) {
      const d = Math.hypot((x - sh.mx) / ax, (y - sh.my) / ay);
      m += d;
      m2 += d * d;
      ang.push(Math.atan2(y - sh.my, x - sh.mx));
    }
    m /= pts.length;
    const cv = Math.sqrt(Math.max(0, m2 / pts.length - m * m)) / Math.max(1e-6, m);
    ang.sort((a, b) => a - b);
    let gap = ang[0] + Math.PI * 2 - ang[ang.length - 1];
    for (let i = 1; i < ang.length; i++) gap = Math.max(gap, ang[i] - ang[i - 1]);
    const cover = Math.PI * 2 - gap;
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
      if (cv < 0.22 && m > 0.6 && m < 1.3 && mid[1] < cy - r * 0.5 && Math.abs(ay - by) < r * 0.8) sh.cup = { cx, cy, r: r * Math.max(0.9, m) };
    }
  }
  return sh;
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

// ------------------------------------------------------------------ a ride's parts
// sh: the stroke's measures; B: the body's (null: no body yet); o: the body's outline
function rideGuess(sh, B, o, pts) {
  if (!B) {
    if (sh.round) return 'wheel';
    if (sh.coils >= 3) return 'spring';
    return sh.closed && sh.area > 0.2 ? 'body' : 'deco';
  }
  const L = B.w;
  const H = B.h;
  const gap = gapTo(pts, o);
  const near = gap < L * 0.1;
  const out = pts.filter((p) => !inPoly(p[0], p[1], o)).length / pts.length;
  const inside = 1 - out;
  const offC = Math.abs(sh.cx - B.cx) / L;
  // a wheel: round, its bottom low (on the ground, or under the body's middle) - or an oval, or
  // most of a circle, down at its bottom
  if (sh.round && sh.size > L * 0.07 && sh.size < Math.max(2.4, L * 0.7) && sh.y0 < B.y0 + H * 0.45) return 'wheel';
  if (sh.roundish && sh.size > L * 0.06 && sh.size < Math.max(2.2, L * 0.55) && sh.y0 < B.y0 + H * 0.25 && sh.cy < B.cy) return 'wheel';
  if (sh.cup && sh.cup.r * 2 > L * 0.06 && sh.cup.r * 2 < L * 0.5 && sh.cy < B.y0 + H * 0.15 && sh.cup.cy < B.y0 + H * 0.35) return 'wheel';
  if (sh.closed && !sh.straight && sh.cy < B.y0 + H * 0.08 && sh.y1 < B.y0 + H * 0.5 && sh.size > L * 0.06 && sh.size < L * 0.45 && Math.max(sh.w, sh.h) < Math.min(sh.w, sh.h) * 2.5) return 'wheel';
  // a balloon: a big round one up over it
  if (sh.closed && sh.cy > B.y1 && sh.size > L * 0.55 && sh.w > sh.h * 0.55 && sh.fill > 0.55 && (sh.round || sh.roundish || sh.h > sh.w * 0.8)) return 'balloon';
  // a parachute: a dome up over it, wide, clear of it (a dome sitting on it is a turret, a cabin)
  if (sh.dome && sh.y0 > B.y1 - H * 0.15 && sh.w > L * 0.4 && (gap > H * 0.12 || sh.w > L * 0.85)) return 'chute';
  if (sh.dome && !sh.closed && gap < H * 0.12 && sh.y0 > B.y1 - H * 0.3) return 'cabin';
  // a barrel on its roof: from on it (touching it), off its middle - forward (a rotor is over
  // its middle, clear of it)
  const barrelish = sh.straight && sh.thin > 3.2 && sh.long > L * 0.15 && sh.slant < 0.6;
  if (barrelish && gap < L * 0.06 && offC > 0.12 && sh.w < L * 0.75 && sh.cy > B.y1 - H * 0.25 && out > 0.45) return 'barrel';
  // a rotor: over its top, flat, about its middle, half as long as the body at least
  if (sh.cy > B.y1 - H * 0.1 && sh.w > sh.h * 3 && sh.w > L * 0.4 && Math.abs(sh.cx - B.cx) < L * 0.3 && (!sh.closed || sh.h < L * 0.08)) return 'rotor';
  // (drawn slanting, as it is seen turning: a long straight line over its top, clear of it - two
  // of them crossed, an X)
  if (!sh.closed && sh.straight && sh.long > L * 0.35 && sh.slant < 0.75 && sh.cy > B.y1 - H * 0.05 && sh.y0 > B.y1 - H * 0.35 && Math.abs(sh.cx - B.cx) < L * 0.45 && gap > L * 0.015) return 'rotor';
  // its skids: a long flat line under it
  if (!sh.closed && sh.straight && sh.w > L * 0.3 && sh.slant < 0.3 && sh.cy < B.y0 + H * 0.05 && sh.y1 < B.y0 + H * 0.25) return 'skid';
  // a sail: up over it, coming to a point at its top
  if (sh.closed && sh.y0 > B.y1 - H * 0.2 && sh.h > sh.w * 0.6 && sh.fill > 0.3 && sh.fill < 0.62 && sh.thin < 2.8) return 'sail';
  // a mast: upright, from its top up
  if (!sh.closed && sh.straight && sh.slant > 1.2 && sh.y0 > B.y1 - H * 0.25 && sh.h > H * 0.5) return 'mast';
  // a spring: a coil or a zigzag under it (or at its end)
  if (sh.coils >= 3 && sh.cy < B.y0 + H * 0.5) return 'spring';
  // a wing drawn across it, side on: long, flat and thin, level, about its middle
  if (sh.w > sh.h * 3.2 && sh.w > L * 0.22 && sh.w < L * 0.95 && sh.slant < 0.25 && sh.h < H * 0.4 && sh.cy > B.y0 + H * 0.15 && sh.cy < B.y1 - H * 0.2 && sh.x0 > B.x0 - L * 0.08 && sh.x1 < B.x1 + L * 0.08 && (sh.closed || inside < 0.85)) return 'wing';
  // on it: drawn on its side (a window, a stripe)
  if (inside >= 0.85) return sh.closed ? 'window' : 'deco';
  // a barrel: long, thin and straight, from it out past it - level or a little up
  if (near && barrelish && out > 0.45) {
    // (not a wing: one along its middle that does not stick out past its ends)
    const past = sh.x1 > B.x1 + L * 0.03 || sh.x0 < B.x0 - L * 0.03 || sh.cy > B.y1 - H * 0.15;
    if (past) return 'barrel';
  }
  // a blade: pointed, from its front (or under it) out
  if (near && sh.point && out > 0.5 && (sh.tipX > B.x1 - L * 0.05 || sh.tipY < B.y0 + H * 0.1) && sh.size < L * 0.8) return 'blade';
  // a wing: flat, along its middle (touching it: one all under it is a skid)
  if (sh.w > sh.h * 2.5 && sh.w > L * 0.2 && sh.cy > B.y0 - H * 0.5 && sh.y1 > B.y0 && sh.cy < B.y1 + 0.1 && sh.x0 > B.x0 - L * 0.1 && sh.x1 < B.x1 + L * 0.1 && (!sh.closed || (sh.h < Math.max(0.25, L * 0.15) && sh.cy < B.cy + H * 0.3))) return 'wing';
  // up its nose: a propeller
  if (sh.h > sh.w * 1.8 && sh.cx > B.x1 - Math.max(0.35, L * 0.12)) return 'prop';
  // standing up over its back end: a fin
  if (sh.cx < B.x0 + L * 0.28 && sh.y1 > B.y1 + H * 0.2 && sh.cy > B.cy && sh.h > sh.w * 0.6 && sh.size < L * 0.45) return 'fin';
  // at its back, small, as high as it is: a jet
  if (sh.closed && sh.size < Math.max(1.1, L * 0.3) && sh.cx < B.x0 + Math.max(0.5, L * 0.2) && sh.cy > B.y0 - 0.2 && sh.cy < B.y1) return 'jet';
  // closed and up on it: a cabin, a turret
  if (sh.closed && sh.x1 > B.x0 && sh.x0 < B.x1 && sh.y0 < B.y1 + H * 0.15 && sh.y1 > B.y0) return 'cabin';
  if (sh.closed && sh.area > Math.max(0.35, B.area * 0.5)) return 'cabin';
  return 'deco';
}

// the parts read again, together: what one is depends on the others
//   - a rotor on it: a long line out of one of its ends is its tail, not a barrel
//   - a propeller or a jet and no wing yet: the flattest long line along its middle is its wing
function rideContext(st, B, guess, over, ol) {
  if (!B) return;
  const L = B.w;
  const H = B.h;
  const T = (o) => over[o.i] || guess[o.i];
  if (st.some((o) => T(o) === 'rotor')) {
    for (const o of st) {
      if (over[o.i] || guess[o.i] !== 'barrel') continue;
      const sh = o.sh;
      const outEnd = sh.x0 < B.x0 - L * 0.03 || sh.x1 > B.x1 + L * 0.03;
      if (outEnd && sh.long > L * 0.3 && sh.cy < B.y1 - H * 0.1) guess[o.i] = 'tail';
    }
  }
  if (st.some((o) => T(o) === 'prop' || T(o) === 'jet') && !st.some((o) => T(o) === 'wing')) {
    let best = null;
    for (const o of st) {
      if (over[o.i] || (guess[o.i] !== 'window' && guess[o.i] !== 'deco' && guess[o.i] !== 'cabin')) continue;
      const sh = o.sh;
      if (sh.w > sh.h * 2.6 && sh.w > L * 0.18 && sh.slant < 0.35 && sh.cy > B.y0 - H * 0.3 && sh.cy < B.y1 + H * 0.1 && (!best || sh.w / sh.h > best.sh.w / best.sh.h)) best = o;
    }
    if (best) guess[best.i] = 'wing';
    else {
      // (drawn as seen from a little off its side: the near one down from its middle, the far one up)
      for (const o of st) {
        if (over[o.i] || (guess[o.i] !== 'deco' && guess[o.i] !== 'cabin' && guess[o.i] !== 'sail' && guess[o.i] !== 'window')) continue;
        const sh = o.sh;
        const off = sh.cy > B.y1 - H * 0.1 || sh.cy < B.y0 + H * 0.1;
        if (off && !sh.round && sh.size > L * 0.18 && Math.abs(sh.cx - B.cx) < L * 0.32 && gapTo(o.pts, ol) < L * 0.08) guess[o.i] = 'wing';
      }
    }
  }
  // a long line over it from the turret on it (a tank's gun): a barrel, not a rotor
  for (const o of st) {
    if (over[o.i] || guess[o.i] !== 'rotor') continue;
    const sh = o.sh;
    const cab = st.find((q) => q !== o && T(q) === 'cabin' && gapTo(o.pts, outline(q.pts)) < L * 0.04);
    if (cab && Math.abs(sh.cx - cab.sh.cx) > cab.sh.w * 0.35) guess[o.i] = 'barrel';
  }
  // one wheel found: another like it under its other end is its other wheel (drawn less round)
  const w1 = st.filter((o) => T(o) === 'wheel');
  if (w1.length === 1) {
    const w = w1[0].sh;
    let best = null;
    for (const o of st) {
      if (over[o.i] || o === w1[0] || (guess[o.i] !== 'deco' && guess[o.i] !== 'cabin' && guess[o.i] !== 'window' && guess[o.i] !== 'jet' && guess[o.i] !== 'spring')) continue;
      const sh = o.sh;
      const like = sh.size > w.size * 0.45 && sh.size < w.size * 2.2 && Math.abs(sh.cx - w.cx) > L * 0.3 && sh.cy < B.y0 + H * 0.3 && !sh.straight;
      if (like && (!best || Math.abs(sh.cy - w.cy) < Math.abs(best.sh.cy - w.cy))) best = o;
    }
    if (best) guess[best.i] = 'wheel';
  }
  // a mast: what is drawn off it up there is its sail
  const mast = st.find((o) => T(o) === 'mast');
  if (mast && !st.some((o) => T(o) === 'sail')) {
    for (const o of st) {
      if (over[o.i] || guess[o.i] !== 'deco') continue;
      const sh = o.sh;
      if (sh.cy > B.y1 && sh.size > L * 0.15 && Math.abs(sh.cx - mast.sh.cx) < L * 0.4) guess[o.i] = 'sail';
    }
  }
}

// a body drawn with its wheel arches in it and no wheels: its wheels there (the bumps up in its
// bottom edge, each as wide as a wheel) - [{ x, y, r }], the frame's units
function archesOf(ol, B, wheels) {
  const N = 80;
  const xs = [];
  const lows = [];
  for (let i = 0; i < N; i++) {
    const x = B.x0 + B.w * (0.02 + (0.96 * i) / (N - 1));
    const sp = spanAt(ol, x);
    xs.push(x);
    lows.push(sp ? sp[0] : null);
  }
  const ok = lows.filter((v) => v !== null).sort((a, b) => a - b);
  if (ok.length < N * 0.6) return [];
  const base = ok[Math.floor(ok.length * 0.2)];
  const thr = base + B.h * 0.07;
  const out = [];
  // (a long body with a flat bottom between them: not a star, not a cloud)
  if (B.w < B.h * 1.5 || ok.filter((v) => v <= thr).length < ok.length * 0.3) return out;
  let a = -1;
  for (let i = 0; i <= N; i++) {
    const on = i < N && lows[i] !== null && lows[i] > thr;
    if (on && a < 0) a = i;
    if (!on && a >= 0) {
      const b = i - 1;
      const w = xs[b] - xs[a];
      let peak = 0;
      for (let j = a; j <= b; j++) peak = Math.max(peak, lows[j] - base);
      if (a > 1 && b < N - 2 && w > B.w * 0.08 && w < B.w * 0.38 && peak > B.h * 0.1) {
        const r = Math.max(w * 0.47, Math.min(peak, w * 0.6));
        const x = (xs[a] + xs[b]) / 2;
        if (!wheels.some((o) => Math.abs(o.sh.cx - x) < r * 1.2)) out.push({ x, y: base + peak - r * 0.98, r });
      }
      a = -1;
    }
  }
  // (two wheels at least, with what is drawn: one bump is no car)
  return out.length + wheels.length >= 2 && out.length <= 4 ? out : [];
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

// ------------------------------------------------------------------ reading the parts
// strokes: [{ p, c }] (page units, y down). over: { [stroke index]: part } - the player's own
// choices. Returns { frame: 'ride' | 'hand' | null, parts: [{ i, type, auto, at: [x, y] (page
// units: where its name goes), choices }], flip (its front to the left), body (index), the strokes
// in the frame's units (st: [{ pts, ink, type }]), and the frame's scale back (toPage) }
export function readParts(strokes, over = {}, face = null, hint = null) {
  const S = strokes.map((s, i) => ({ i, p: s.p, c: s.c, k: s.k })).filter((s) => s.p && s.p.length > 1);
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
  // read it facing right, and facing left: the way its parts make more sense
  const read = (mirror) => {
    const st = S.map((s) => ({ i: s.i, ink: s.c, kind: s.k, pts: dense(s.p.map(([x, y]) => [(mirror ? x1 - x : x - x0) * k, (y1 - y) * k])) }));
    for (const o of st) o.sh = measure(o.pts, o.kind);
    // the body: the biggest closed shape that is no wheel (a round one only if nothing else is
    // closed); the player's own say first
    let main = st.find((o) => over[o.i] === 'body' || over[o.i] === 'hull') || null;
    if (!main) {
      const other = st.some((o) => o.sh.closed && !o.sh.round && o.sh.area > 0.1);
      for (const o of st) {
        if (over[o.i]) continue;
        if (o.sh.closed && !(o.sh.round && (o.sh.size < 1.4 || other)) && o.sh.area > 0.12 && (!main || o.sh.area > main.sh.area)) main = o;
      }
      // (a big round one with a smaller one hanging under it: a balloon and its basket - the
      // basket is what it is, the balloon what lifts it)
      if (main && (main.sh.round || main.sh.roundish)) {
        const M = main.sh;
        const under = st.find((o) => o !== main && !over[o.i] && o.sh.closed && o.sh.y1 < M.y0 + M.h * 0.2 && o.sh.size < M.size * 0.55 && Math.abs(o.sh.cx - M.cx) < M.w * 0.4);
        if (under) main = under;
      }
    }
    // (none closed: the longest line is what the rest is on - a sword drawn as a line)
    if (!main) {
      for (const o of st) if (!over[o.i] && o.sh.len > FRAME_W * 0.5 && (!main || o.sh.len > main.sh.len)) main = o;
    }
    const B = main ? main.sh : null;
    const ol = main ? (main.sh.closed ? outline(main.pts) : thickLine(main.pts, Math.max(0.08, B.size * 0.04))) : null;
    const ride = {};
    const hand = {};
    const seen = {};
    // (a grip from left to right: the rear-most of the strokes under it first)
    const order = st.slice().sort((a, b) => a.sh.cx - b.sh.cx);
    for (const o of order) {
      if (o === main) {
        ride[o.i] = 'body';
        // (the body of a thing for the hand: a blade, if it is one; a hammer's head on a long
        // handle - its handle the grip)
        hand[o.i] = B.closed && B.point && B.thin > 2.6 ? 'blade' : 'body';
        continue;
      }
      ride[o.i] = rideGuess(o.sh, B, ol, o.pts);
      hand[o.i] = handGuess(o.sh, B, ol, o.pts, seen);
    }
    rideContext(st, B, ride, over, ol);
    // (a boat's hull: a body narrower at its bottom than at its top, and nothing to drive or fly
    // it: it floats)
    let arches = [];
    if (main && B.closed) {
      const rest = Object.entries(ride).filter(([i]) => +i !== main.i).map(([, t]) => t);
      const cue = rest.includes('mast') || rest.includes('sail') || hint === 'sea';
      if (cue && !over[main.i] && !rest.some((t) => t === 'wheel' || t === 'rotor' || t === 'wing' || t === 'balloon')) {
        const wB = widthAt(ol, B.y0 + B.h * 0.15);
        const wT = widthAt(ol, B.y0 + B.h * 0.85);
        if (B.w > B.h * 1.8 && wB < wT * 0.75) ride[main.i] = 'hull';
      }
      // (its wheel arches drawn in it, and fewer wheels than that: its wheels in them)
      const wheels = st.filter((o) => (over[o.i] || ride[o.i]) === 'wheel');
      if (wheels.length < 2 && ride[main.i] !== 'hull') arches = archesOf(ol, B, wheels);
    }
    // which it is: held by a grip, or ridden - by what its parts are (the player's choice first)
    const picked = Object.values(over);
    let frame;
    if (picked.some((t) => HAND_ONLY.has(t))) frame = 'hand';
    else if (picked.some((t) => RIDE_ONLY.has(t))) frame = 'ride';
    else {
      const rv = Object.values(ride);
      const thrust = rv.includes('prop') || rv.includes('jet');
      const moves = rv.filter((t) => t === 'wheel' || t === 'rotor' || (t === 'wing' && thrust) || t === 'sail' || t === 'balloon').length;
      const gripped = Object.values(hand).includes('grip');
      frame = gripped && !moves ? 'hand' : main ? 'ride' : null;
    }
    const guess = frame === 'hand' ? hand : ride;
    // how sure: parts that say which way it faces (a propeller at the nose, a jet or a fin at the
    // back, a barrel out of the front, a grip at the back)
    let score = 0;
    for (const o of st) {
      const t = over[o.i] || guess[o.i];
      if (t === 'prop' || t === 'blade') score += 2;
      // (a barrel: pointing forward, mostly; a tail: at its back)
      if (t === 'barrel') score += B && o.sh.cx < B.cx - B.w * 0.1 ? 0.5 : 2;
      if (t === 'tail') score += B && o.sh.cx < B.cx ? 2.5 : -1;
      if (t === 'jet' || t === 'fin') score += 1.5;
      if (t === 'grip' && B && o.sh.cx < B.cx) score += 1;
      if (t === 'mag' && B && o.sh.cx > B.x0 + B.w * 0.3) score += 0.5;
    }
    return { st, main, B, frame, guess, score, arches };
  };
  const a = read(false);
  const b = read(true);
  // (which way it faces: the player's say, else its parts')
  const pick = face === true ? b : face === false ? a : b.score > a.score ? b : a;
  const { st, main, frame, guess } = pick;
  const parts = st.map((o) => {
    const auto = guess[o.i] || 'deco';
    const type = over[o.i] && PART[over[o.i]] ? over[o.i] : auto;
    return { i: o.i, type, auto, choices: choicesFor(o.sh, frame, auto), at: labelAt(strokes[o.i].p), sh: o.sh };
  });
  for (const o of st) o.type = parts.find((p) => p.i === o.i).type;
  return { frame, parts, flip: pick === b, body: main ? main.i : -1, st, k, x0, x1, y0, y1, arches: frame === 'ride' ? pick.arches : [] };
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

// how sure it is a ride, by its parts: two wheels (or its arches), a rotor, a sail, a balloon - the
// rest (wings and an engine, one wheel, a hull) could be other things too (ui/freedraw.js asks the
// network then whether it is a weapon or gear instead)
export function rideEvidence(P) {
  if (!P || P.frame !== 'ride') return 0;
  const T = P.parts.map((q) => q.type);
  const wheels = T.filter((t) => t === 'wheel').length + (P.arches ? P.arches.length : 0);
  if (wheels >= 2 || T.includes('rotor') || T.includes('sail') || T.includes('balloon')) return 2;
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
  else if (sh.dome) add('chute', 'wing', 'body');
  else if (sh.straight && sh.thin > 2.5) add('barrel', 'blade', 'wing', 'rotor', 'prop', 'skid', 'mast', 'tail', 'grip', 'armor');
  else if (sh.closed && sh.point) add('blade', 'sail', 'fin', 'wing', 'body');
  else if (sh.closed) add('body', 'cabin', 'grip', 'head', 'mag', 'scope', 'stock', 'hull', 'sail', 'balloon', 'blade');
  else add('barrel', 'wing', 'rotor', 'grip', 'blade', 'armor');
  add('deco');
  // (a ride's parts for a ride, a hand's for the hand - the rest after them)
  const mine = frame === 'hand' ? (t) => !RIDE_ONLY.has(t) : frame === 'ride' ? (t) => !HAND_ONLY.has(t) : () => true;
  return [...out.filter(mine), ...out.filter((t) => !mine(t))].slice(0, 9);
}
