import { clamp } from '../core/util.js';
import { readFree, INKS, KINDS } from './freeform.js';
import { shapeOf } from './drawncar.js';
import { PART } from './parts.js';
import { handCombos } from './combos.js';

// (ROADMAP 11.11, parts 2) A thing for the hand, made of its parts - and each part changes what it
// does, as each part of a ride does (game/partsum.js):
//   - its barrels: each one fires (two: both together; three or more: they turn, each firing in
//     its turn). The longer, the further and truer; bent, its shots bend after whoever you aim
//     at; a silencer on it, nobody hears it
//   - the ink each is drawn in is what it fires (game/weapons.js inkHit): red fire, orange a little
//     blast, yellow a shock, green glue, blue water, purple a cloud of ink, pink bouncing balls,
//     white correction fluid (it rubs out what it hits), neon light
//   - a magazine: as big as drawn holds as much (a round one, a drum: far more); a scope along its
//     top: it zooms when you aim (a little sight: the shots go truer); a stock, a second grip: it
//     kicks less
//   - a blade on a gun's mouth: a bayonet, a stab close up; a spring: its shots bounce; wings:
//     they fly as paper planes and find who you aim at; a propeller: a gust that throws people
//     back; a parachute on it: holding it you come down slowly
//   - a blade: bent, it sweeps wider; toothed, it saws; a blade at both ends, it spins and hits all
//     round; a guard across it turns a blow; a hammer's head: the bigger, the harder it throws them
// What it is read as first is what game/freeform.js reads (the network, then its shape: a gun, a
// blade, a hammer, a bomb...); then each line: which part of it it is - and, drawn in one line,
// where its parts are in it (its grip, its barrel, its magazine: a name on each all the same).

// ------------------------------------------------------------------ what each ink fires
export const ELEMENT = {
  2: { k: 'fire', name: 'אש', line: 'מצית ושורף' },
  3: { k: 'blast', name: 'נפץ', line: 'מתפוצץ קטן' },
  4: { k: 'shock', name: 'חשמל', line: 'משתק לרגע' },
  5: { k: 'glue', name: 'דבק', line: 'מדביק למקום' },
  6: { k: 'water', name: 'מים', line: 'הודף ומכבה שריפות' },
  7: { k: 'ink', name: 'דיו', line: 'ענן דיו שמסתיר' },
  8: { k: 'bounce', name: 'קופצני', line: 'קופץ מקירות' },
  9: { k: 'tippex', name: 'טיפקס', line: 'מוחק את מה שפוגע בו' },
  10: { k: 'light', name: 'אור', line: 'קרן אור' },
};
const ELEMENT_ADJ = { fire: 'של אש', blast: 'נפיץ', shock: 'חשמלי', glue: 'של דבק', water: 'של מים', ink: 'של דיו', bounce: 'קופצני', tippex: 'של טיפקס', light: 'של אור' };
const FEM = new Set(['sword', 'bomb']);
const GUN = new Set(['pistol', 'smg', 'assault', 'rifle', 'shotgun', 'minigun', 'launcher', 'laser']);

// ------------------------------------------------------------------ reading it
// strokes: [{ p, c, k, r }] (page units, y down). over: the player's own say ({ i: part }). R0:
// game/freeform.js's reading of them, if it is already read (ui/freedraw.js reads it as it always
// has: off the lines as drawn, then built from the steadied ones).
// Returns { frame: 'hand', family: 'hand', R (game/freeform.js's reading), parts, implicit, body,
// flip, muzzles } - or null (not a weapon: a ride, gear, nothing yet)
export function readHandParts(strokes, over = {}, cats = null, R0 = null) {
  let R = R0;
  if (!R) {
    const S = strokes.map((s) => ({ p: s.p, c: s.c, raw: s.r }));
    try {
      R = readFree(S, null, cats && cats.size ? cats : null);
    } catch (err) {
      return null;
    }
  }
  if (!R || R.cat !== 'weapon' || !R.grid) return null;
  const G = R.grid;
  const cell = G.cell;
  // (a point of the page into its grid, as it was read: turned level)
  const ct = Math.cos(-R.theta);
  const st = Math.sin(-R.theta);
  const rot = R.theta ? ([x, y]) => [R.cx + (x - R.cx) * ct - (y - R.cy) * st, R.cy + (x - R.cx) * st + (y - R.cy) * ct] : (p) => p;
  const toG = (p) => {
    const [x, y] = rot(p);
    return [(x - G.ox) / cell, (y - G.oy) / cell];
  };
  const L = R.L;
  const front = R.front;
  const fEnd = front > 0 ? R.c1 : R.c0;
  const bEnd = front > 0 ? R.c0 : R.c1;
  const gun = GUN.has(R.kind);
  const margin = Math.max(1.5, R.bodyT * 0.3);
  // (from the back: how far along it, 0 at its back end, 1 at its front)
  const along = (c) => (front > 0 ? (c - R.c0) / Math.max(1, L) : (R.c1 - c) / Math.max(1, L));
  const barrelFrom = gun ? 1 - clamp(R.bl, 0.12, 0.6) : 2;
  const seg = (sg, c, r, down) => sg && c >= sg.a - 1.5 && c <= sg.b + 1.5 && (down ? r > R.bb + margin * 0.5 : true);
  const parts = [];
  // (points all along each line, a cell or so apart: a steadied line may be its two ends only)
  const strokesG = strokes.map((s) => denseG(s.p.map(toG)));
  const lens = strokes.map((s) => {
    let l = 0;
    for (let i = 1; i < s.p.length; i++) l += Math.hypot(s.p[i][0] - s.p[i - 1][0], s.p[i][1] - s.p[i - 1][1]);
    return l;
  });
  const total = lens.reduce((a, b) => a + b, 0);
  let body = -1;
  let bodyL = -1;
  const has = {};
  strokes.forEach((s, i) => {
    const P = strokesG[i];
    const sh = shapeOf(P);
    // where its points are: in the grip, the magazine, the stock (under it), over it (a sight),
    // the barrel's run (its front, in the body's band), a guard, the head end...
    const n = { grip: 0, mag: 0, stock: 0, up: 0, barrel: 0, guard: 0, blade: 0, head: 0, handle: 0, body: 0 };
    // (all of it over the body's band: a sight - ROADMAP 11.15: named so, the player's own word for
    // each line is still theirs below)
    const onTop = gun && sh.y1 <= R.bt + 0.5 && sh.y0 < R.bt - 1.5 && along(front > 0 ? sh.x1 : sh.x0) < 0.97;
    for (const [c, r] of P) {
      const a = along(c);
      if (R.kind === 'sword') {
        if (R.guard && c >= R.guard.a - 1 && c <= R.guard.b + 1) n.guard++;
        else n[(R.guard ? (front > 0 ? c > R.guard.b : c < R.guard.a) : a > 0.3) ? 'blade' : 'handle']++;
      } else if (R.kind === 'club') n[a > 0.68 ? 'head' : 'handle']++;
      else if (!gun) n.body++;
      else if (onTop) n.up++;
      else if (seg(R.grip, c, r, true)) n.grip++;
      else if (seg(R.mag, c, r, true)) n.mag++;
      else if (seg(R.stock, c, r, true)) n.stock++;
      else if (r < R.bt - margin) n.up++;
      else if (a >= barrelFrom && r >= R.bt - margin && r <= R.bb + margin) n.barrel++;
      else n.body++;
    }
    const N = Math.max(1, P.length);
    let best = 'body';
    let bv = -1;
    for (const k in n) {
      if (n[k] > bv) {
        bv = n[k];
        best = k;
      }
    }
    // (most of it in one part: that part; spread over several - a gun drawn in one line: its body)
    let type = bv / N >= 0.65 ? best : 'body';
    const map = { up: gun ? 'scope' : 'deco', handle: 'grip', head: 'head', blade: 'blade', guard: 'guard', grip: 'grip', mag: 'mag', stock: 'stock', barrel: 'barrel', body: 'body' };
    type = map[type] || type;
    // what is drawn on to it that no reading of a weapon has: a spring, a parachute, wings...
    const extra = extraPart(sh, R, P, lens[i] / Math.max(1e-6, total));
    if (extra) type = extra;
    // (what the player said it is)
    if (over[i]) type = over[i];
    if (type === 'body' && lens[i] > bodyL) {
      bodyL = lens[i];
      body = i;
    }
    has[type] = (has[type] || 0) + 1;
    parts.push({ i, type, auto: extra || (bv / N >= 0.65 ? map[best] || best : 'body'), sh, g: P, at: labelAt(s.p), len: lens[i], ink: s.c, choices: null });
  });
  // (a line out of a gun's front, past the end of the body it was drawn on, level and straight:
  // a barrel - however short the reading made its barrel, drawn so it is one)
  if (gun && body >= 0) {
    const main = parts.find((q) => q.i === body);
    const mf = front > 0 ? main.sh.x1 : main.sh.x0;
    for (const q of parts) {
      if (q === main || over[q.i] || q.type !== 'body') continue;
      const sh = q.sh;
      if (sh.w < 2 || sh.h > Math.max(1.5, sh.w * 0.35) || (sh.closed && sh.w < sh.h * 3)) continue;
      let past = 0;
      for (const [c] of q.g) if (front > 0 ? c > mf - 0.5 : c < mf + 0.5) past++;
      if (past / q.g.length < 0.6) continue;
      q.type = q.auto = 'barrel';
      has.body--;
      has.barrel = (has.barrel || 0) + 1;
    }
  }
  // (a short fat stub at a gun's mouth with no barrel drawn behind it: the barrel itself, as most
  // draw one - a silencer goes on a barrel)
  if (gun && !parts.some((q) => q.type === 'barrel')) {
    for (const q of parts) {
      if (q.type !== 'silencer' || over[q.i]) continue;
      q.type = q.auto = 'barrel';
      has.silencer--;
      has.barrel = (has.barrel || 0) + 1;
    }
  }
  // (a blade at each end, a grip between them - a staff of blades: held in its middle, not at an
  // end as a sword is)
  if (R.kind === 'sword' && parts.length >= 3) {
    const ends = (q) => {
      const a = along(q.sh.x0);
      const b = along(q.sh.x1);
      return [Math.min(a, b), Math.max(a, b)];
    };
    const tips = parts.filter((q) => !over[q.i] && q.sh.closed && q.sh.w > L * 0.2 && tapered(q.g));
    const back = tips.find((q) => ends(q)[0] < 0.12 && ends(q)[1] < 0.5);
    const fore = tips.find((q) => ends(q)[1] > 0.88 && ends(q)[0] > 0.5);
    if (back && fore) {
      const mid = [ends(back)[1], ends(fore)[0]];
      for (const q of parts) {
        if (over[q.i]) continue;
        if (q === back || q === fore) q.type = q.auto = 'blade';
        else {
          const [a, b] = ends(q);
          if (a > mid[0] - 0.08 && b < mid[1] + 0.08) q.type = q.auto = 'grip';
        }
      }
      has.grip = parts.filter((q) => q.type === 'grip').length;
      has.blade = 2;
    }
  }
  for (const q of parts) q.choices = choicesHand(q, R);
  // (what no line of its own is - the grip, the barrel, the magazine of a gun drawn in one line:
  // where each is, for its name)
  const implicit = [];
  const fromG = (c, r) => {
    const x = G.ox + c * cell;
    const y = G.oy + r * cell;
    if (!R.theta) return [x, y];
    const c2 = Math.cos(R.theta);
    const s2 = Math.sin(R.theta);
    return [R.cx + (x - R.cx) * c2 - (y - R.cy) * s2, R.cy + (x - R.cx) * s2 + (y - R.cy) * c2];
  };
  const add = (type, c, r) => implicit.push({ type, at: fromG(c, r) });
  if (gun) {
    if (R.grip && !has.grip) add('grip', R.grip.c, R.bb + R.grip.depth * 0.6);
    if (R.mag && !has.mag) add('mag', R.mag.c, R.bb + R.mag.depth * 0.6);
    if (R.stock && !has.stock) add('stock', R.stock.c, R.bb + R.stock.depth * 0.4);
    if (!has.barrel) add('barrel', fEnd - (fEnd - bEnd) * clamp(R.bl, 0.1, 0.6) * 0.5, (R.bt + R.bb) / 2);
    if (R.scope && !has.scope) add('scope', (R.c0 + R.c1) / 2, R.bt - margin * 2);
  } else if (R.kind === 'sword') {
    if (!has.blade) add('blade', fEnd - (fEnd - bEnd) * 0.35, (R.bt + R.bb) / 2);
    if (!has.grip) add('grip', bEnd + (fEnd - bEnd) * 0.08, (R.bt + R.bb) / 2);
    if (R.guard && !has.guard) add('guard', R.guard.c, R.bt - margin);
  } else if (R.kind === 'club') {
    if (!has.head) add('head', fEnd - (fEnd - bEnd) * 0.12, (R.bt + R.bb) / 2);
    if (!has.grip) add('grip', bEnd + (fEnd - bEnd) * 0.25, (R.bt + R.bb) / 2);
  }
  // (where each barrel drawn in a line of its own ends, at its front: the mouths it fires from,
  // game/freeform.js buildWeapon)
  const muzzles = [];
  if (gun) {
    for (const q of parts) {
      if (q.type !== 'barrel') continue;
      let best = null;
      for (const [c, r] of q.g) if (!best || (front > 0 ? c > best[0] : c < best[0])) best = [c, r];
      // (its mouth: the middle of its front end)
      let r0 = Infinity;
      let r1 = -Infinity;
      for (const [c, r] of q.g) {
        if (Math.abs(c - best[0]) > 1.2) continue;
        r0 = Math.min(r0, r);
        r1 = Math.max(r1, r);
      }
      muzzles.push(fromG(best[0], (r0 + r1) / 2));
    }
  }
  return { frame: 'hand', family: 'hand', R, parts, implicit, body, flip: front < 0, kind: R.kind, muzzles };
}

// a line on it that is a part no weapon read has: coils (a spring), a dome over it (a parachute),
// flat thin ones out across it (wings), a cross at an end (a propeller), a short fat one at its
// mouth (a silencer), a point out of a gun's mouth (a bayonet)
function extraPart(sh, R, P, share) {
  const L = R.L;
  const H = R.H;
  const gun = GUN.has(R.kind);
  // (the grid's rows grow downwards: its top is r0)
  let c0 = Infinity;
  let c1 = -Infinity;
  let r0 = Infinity;
  let r1 = -Infinity;
  for (const [c, r] of P) {
    c0 = Math.min(c0, c);
    c1 = Math.max(c1, c);
    r0 = Math.min(r0, r);
    r1 = Math.max(r1, r);
  }
  const w = c1 - c0;
  const h = r1 - r0;
  if (share > 0.5) return null;
  // (out of its body's band - under it, behind it: on it, a pattern, a grip's wrapping)
  const outBand = r0 > R.bb + 1 || r1 < R.bt - 1 || (R.front > 0 ? c1 < R.c0 + L * 0.1 : c0 > R.c1 - L * 0.1);
  if (sh.closed === false && outBand && turnsOf(P) >= 4 && h > R.bodyT * 0.6) return 'spring';
  const fEnd = R.front > 0 ? R.c1 : R.c0;
  const atFront = R.front > 0 ? c1 > R.c1 - 1.5 && c0 > R.c0 + L * 0.55 : c0 < R.c0 + 1.5 && c1 < R.c1 - L * 0.55;
  const pastFront = R.front > 0 ? c1 > R.c1 - 1 && c0 > R.c1 - L * 0.25 : c0 < R.c0 + 1 && c1 < R.c0 + L * 0.25;
  // (a dome up over it, wide)
  if (r1 < R.bt && w > L * 0.35 && h > 2 && domeUp(P) && r0 < R.r0 + 2) return 'chute';
  // (at its mouth, short and fatter than the barrel: a silencer)
  if (gun && pastFront && sh.closed && w > h * 1.4 && w < L * 0.3 && h > R.bodyT * 0.35 && h < R.bodyT * 1.6) return 'silencer';
  // (a blade out of a gun's mouth: a bayonet)
  if (gun && atFront && sh.closed && w > h * 2 && pointy(P)) return 'blade';
  // (a gun's wings: across its middle, out both ways over and under it - its shots fly)
  const mid = (c0 + c1) / 2;
  const midAlong = R.front > 0 ? (mid - R.c0) / L : (R.c1 - mid) / L;
  const across = r0 < R.bt - R.bodyT * 0.7 && r1 > R.bb + R.bodyT * 0.7;
  if (gun && across && midAlong > 0.25 && midAlong < 0.8 && h > w * 1.3 && !nearSeg(R, c0, c1)) return 'wing';
  // (a propeller: a thin line across its very back end, or its very front, out both ways)
  const end = R.front > 0 ? c1 < R.c0 + L * 0.08 || c0 > R.c1 - L * 0.04 : c0 > R.c1 - L * 0.08 || c1 < R.c0 + L * 0.04;
  if (gun && end && across && w < h * 0.45) return 'prop';
  return null;
}

// (a blade: one of its ends comes to a point - the other is as broad as it is)
function tapered(P) {
  let c0 = Infinity;
  let c1 = -Infinity;
  for (const [c] of P) {
    c0 = Math.min(c0, c);
    c1 = Math.max(c1, c);
  }
  const w = c1 - c0;
  if (w < 2) return false;
  const spread = (lo, hi) => {
    let r0 = Infinity;
    let r1 = -Infinity;
    for (const [c, r] of P) {
      if (c < lo || c > hi) continue;
      r0 = Math.min(r0, r);
      r1 = Math.max(r1, r);
    }
    return r1 >= r0 ? r1 - r0 : 0;
  };
  const a = spread(c0, c0 + w * 0.15);
  const b = spread(c1 - w * 0.15, c1);
  return Math.min(a, b) < Math.max(a, b) * 0.4 && Math.max(a, b) > 0.8;
}

function denseG(P) {
  const out = [P[0]];
  for (let i = 1; i < P.length; i++) {
    const [ax, ay] = P[i - 1];
    const [bx, by] = P[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let j = 1; j <= n; j++) out.push([ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n]);
  }
  return out;
}

const nearSeg = (R, c0, c1) => [R.grip, R.mag, R.stock].some((sg) => sg && c1 > sg.a - 1 && c0 < sg.b + 1);

function turnsOf(P) {
  let n = 0;
  let dir = 0;
  for (let i = 2; i < P.length; i++) {
    const d = Math.sign(P[i][0] - P[i - 1][0]);
    if (d && dir && d !== dir) n++;
    if (d) dir = d;
  }
  return n;
}

function domeUp(P) {
  const a = P[0];
  const b = P[P.length - 1];
  let top = P[0];
  for (const p of P) if (p[1] < top[1]) top = p;
  return top[1] < Math.min(a[1], b[1]) - Math.abs(b[0] - a[0]) * 0.15;
}

function pointy(P) {
  const sh = shapeOf(P);
  let near = 0;
  for (const [, r] of P) if (Math.abs(r - sh.cy) < sh.h * 0.15) near++;
  return sh.w > sh.h * 2 && near > 0;
}

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

function choicesHand(q, R) {
  // (the likely ones - and the part's menu has every other one too: game/partrole.js menuOf)
  const out = [q.type];
  const add = (...t) => {
    for (const x of t) if (!out.includes(x) && PART[x]) out.push(x);
  };
  if (GUN.has(R.kind)) add('barrel', 'grip', 'mag', 'scope', 'stock', 'silencer', 'blade', 'spring', 'wing', 'prop', 'chute', 'body');
  else add('blade', 'grip', 'guard', 'head', 'spring', 'wing', 'chute', 'body');
  add('deco');
  return out.slice(0, 9);
}

// ------------------------------------------------------------------ what it does: its parts added up
// P: readHandParts'. Returns { def (game/weapons.js's numbers, and what the parts add), sum (the
// card: its name, what it does, its numbers, what each part does) }
export function handSpec(P) {
  const R = P.R;
  const def = Object.assign({}, R.def);
  const kind = R.kind;
  const gun = GUN.has(kind);
  const by = (t) => P.parts.filter((q) => q.type === t);
  const lines = [];
  const abil = [];
  const L = R.L * R.grid.cell;
  // ---- its barrels: how many, how long, how thick, bent, flared - and what each fires
  const barrels = by('barrel').map((q) => {
    const sh = q.sh;
    const len = sh.w / Math.max(1, R.L);
    // (bent: a single line that curves - not an outline, which goes out and back)
    const bent = !sh.closed && sh.dev > 0.12 && sh.dev < 0.45 && sh.w > 3 && sh.len < Math.hypot(sh.w, sh.h) * 1.35;
    return { q, len, thick: sh.h / Math.max(1, R.bodyT), bent, el: ELEMENT[q.ink] || null };
  });
  const nB = gun ? Math.max(R.barrels || 1, barrels.length) : 0;
  // (the ink a gun's barrels are drawn in - a gun drawn in one line, its own ink)
  const bodyInk = P.body >= 0 ? P.parts.find((q) => q.i === P.body).ink : R.main;
  const els = barrels.map((b) => b.el).filter(Boolean);
  let el = els.length ? els[0] : ELEMENT[bodyInk] || null;
  if (kind === 'laser') el = null;
  let longB = false;
  if (gun) {
    if (nB === 2) {
      def.volley = 2;
      def.rate = def.rate * 0.85;
      lines.push(['fire', 'שני קנים', 'יורה משניהם בבת אחת']);
    } else if (nB >= 3 && kind !== 'minigun') {
      // (three or more: they turn, each firing in its turn - quicker and quicker as they spin up)
      def.spin = true;
      def.rate = Math.max(def.rate, 9) * 1.3;
      def.mag = def.mag ? Math.round(def.mag * 2) : def.mag;
      def.ammo = Math.max(def.ammo || 0, (def.mag || 0) * 4);
      lines.push(['fire', `${nB} קנים`, 'מסתובבים ויורים בלי הפסקה']);
    }
    const longest = barrels.reduce((a, b) => Math.max(a, b.len), R.bl || 0);
    longB = longest > 0.45 && kind !== 'launcher';
    if (longest > 0.45 && kind !== 'launcher') {
      def.speed *= 1.15;
      def.spread *= 0.75;
      lines.push(['fire', 'קנה ארוך', 'רחוק ומדויק יותר']);
    } else if (longest < 0.18 && barrels.length && kind !== 'launcher') {
      def.spread *= 1.35;
      lines.push(['fire', 'קנה קצר', 'פחות מדויק']);
    }
    if (barrels.some((b) => b.bent)) {
      def.curve = 3;
      lines.push(['fire', 'קנה מעוקל', 'הקליעים מתעקלים אל מי שמכוונים אליו']);
      abil.push(['fire', 'מתעקל']);
    }
    // its magazine: as big as drawn; round, a drum
    const mags = by('mag');
    if (mags.length && def.mag) {
      const m = mags[0].sh;
      const round = Math.max(m.w, m.h) < Math.min(m.w, m.h) * 1.5 && m.closed;
      const k = clamp(m.h / Math.max(1, R.bodyT), 0.6, 3);
      def.mag = Math.round(def.mag * (round ? 2.5 : 0.7 + k * 0.35));
      def.ammo = Math.max(def.ammo, def.mag * 4);
      lines.push(['fire', round ? 'מחסנית תוף' : 'מחסנית', `${def.mag} כדורים בכל מחסנית`]);
    }
    if (by('scope').length || R.scope) {
      // (a scope - a tube along its top, long: it zooms; a little sight on it: truer, no zoom)
      const sc = by('scope').reduce((a, q) => (!a || q.sh.w > a.sh.w ? q : a), null);
      // (one in the outline it was drawn in one line with: as the reading saw it, a scope)
      const w = sc ? sc.sh.w / Math.max(1, R.L) : 0.2;
      if (w >= 0.2) {
        def.zoom = clamp(1.5 + w * 3, 1.6, 3.2);
        def.spread *= 0.55;
        lines.push(['fire', 'כוונת', `זום ×${def.zoom.toFixed(1)} כשמכוונים, ויותר מדויק`]);
        abil.push(['fire', `כוונת ×${def.zoom.toFixed(1)}`]);
      } else {
        def.spread *= 0.8;
        lines.push(['fire', 'כוונת קטנה', 'יורה מדויק יותר']);
      }
    }
    if (by('stock').length || R.stock) {
      def.kick = (def.kick || 0.1) * 0.5;
      def.spread *= 0.85;
      lines.push(['hand', 'קת', 'בועט פחות']);
    }
    if (by('grip').length >= 2) {
      def.hands = 2;
      def.spread *= 0.85;
      lines.push(['hand', 'ידית קדמית', 'יציב יותר בשתי ידיים']);
    }
    if (by('silencer').length) {
      def.quiet = true;
      def.damage = Math.round(def.damage * 0.95);
      lines.push(['fire', 'משתיק', 'אף אחד לא שומע את הירי']);
      abil.push(['gear', 'שקט']);
    }
    const bay = by('blade')[0];
    if (bay) {
      def.bayonet = { damage: Math.round(clamp(30 + (bay.sh.w / Math.max(1, R.L)) * 80, 30, 70)), range: clamp(2 + (bay.sh.w / Math.max(1, R.L)) * 2, 2, 3.2) };
      lines.push(['fire', 'כידון', 'מקרוב: דוקר במקום לירות']);
      abil.push(['fire', 'כידון']);
    }
    if (by('wing').length) {
      def.projectile = 'plane';
      def.sound = 'whoosh';
      def.homing = 2.4 + by('wing').length * 0.6;
      def.speed = Math.min(def.speed, 34);
      def.gravity = 0;
      lines.push(['air', 'כנפיים', 'הקליעים טסים כמו מטוסי נייר ומוצאים את המטרה']);
      abil.push(['air', 'מטוסי נייר']);
    }
    if (by('prop').length) {
      def.wind = clamp(8 + by('prop')[0].sh.h / Math.max(1, R.bodyT) * 2, 8, 16);
      lines.push(['air', 'מדחף', 'משב רוח שהודף אנשים']);
      abil.push(['air', 'רוח']);
    }
  } else if (kind === 'sword') {
    const blade = by('blade')[0];
    const sh = blade ? blade.sh : null;
    if (sh && !sh.closed && sh.dev > 0.22 && sh.len < Math.hypot(sh.w, sh.h) * 1.35) {
      def.arc = (def.arc || 1.5) * 1.5;
      lines.push(['fire', 'להב מעוקל', 'מכה רחבה יותר']);
    }
    if (sh && toothed(blade.g)) {
      def.damage = Math.round(def.damage * 1.25);
      def.saw = true;
      lines.push(['fire', 'להב משונן', 'פוגע חזק יותר ומנסר קירות']);
      abil.push(['fire', 'משונן']);
    }
    // (a blade at each end of its grip: it spins)
    const bl = by('blade');
    const gp = by('grip')[0];
    const ends = gp && bl.length >= 2 && bl.some((q) => q.sh.cx < gp.sh.x0) && bl.some((q) => q.sh.cx > gp.sh.x1);
    if (ends) {
      def.arc = Math.PI * 2;
      def.rate *= 0.85;
      def.name = 'חרב כפולה';
      lines.push(['fire', 'להב כפול', 'מסתובב ופוגע מכל הצדדים']);
    }
    if (by('guard').length || R.guard) {
      def.parry = 0.3;
      lines.push(['hand', 'מגן יד', 'חוסם 30% ממכה מלפנים']);
    }
    el = ELEMENT[(blade || {}).ink] || el;
  } else if (kind === 'club') {
    const head = by('head')[0];
    if (head) {
      const k = clamp(head.sh.h / Math.max(1, R.bodyT), 1, 4);
      def.knock = (def.knock || 6) * (0.8 + k * 0.2);
      lines.push(['fire', 'ראש', `הודף פי ${(def.knock / 5).toFixed(1)}`]);
    }
    el = ELEMENT[(head || {}).ink] || el;
  }
  // ---- what it fires, by its ink (a gun's barrels, a blade, a head)
  const inkLine = (e) => {
    const k = Object.keys(ELEMENT).find((i) => ELEMENT[i] === e);
    return ['el-' + e.k, `דיו ${INKS[k].name}`, e.k === 'light' ? 'קליעי אור שעוברים דרך קירות דקים' : e.line];
  };
  // (mixed: each barrel its own - one in pencil or black fires as ever; game/weapons.js fireGun)
  const per = barrels.map((b) => (b.el ? b.el.k : null));
  const mixed = gun && kind !== 'laser' && per.length > 1 && new Set(per).size > 1;
  if (mixed) {
    def.elements = per;
    def.element = per.find(Boolean) || null;
    const seen = [];
    for (const b of barrels) if (b.el && !seen.includes(b.el)) seen.push(b.el);
    for (const e of seen.reverse()) {
      lines.unshift(inkLine(e));
      abil.unshift(['el-' + e.k, e.name]);
    }
    lines.unshift(['el-mix', 'קנים בצבעים שונים', 'כל קנה יורה משהו אחר']);
    if (per.includes('bounce')) def.bounce = Math.max(def.bounce || 0, 3);
  } else if (el && (el.k !== 'light' || (gun && kind !== 'laser'))) {
    def.element = el.k;
    lines.unshift(inkLine(el));
    abil.unshift(['el-' + el.k, el.name]);
    if (el.k === 'bounce') def.bounce = Math.max(def.bounce || 0, 3);
    if (el.k === 'water') def.damage = Math.round(def.damage * 0.5);
  }
  // ---- what is on it, for anything
  const springs = by('spring');
  if (springs.length) {
    if (gun) {
      def.bounce = Math.max(def.bounce || 0, clamp(2 + springs.length, 2, 5));
      lines.push(['gear', 'קפיץ', `הקליעים קופצים ${def.bounce} פעמים`]);
      abil.push(['gear', 'קופץ']);
    } else {
      def.knock = (def.knock || 5) * 2;
      lines.push(['gear', 'קפיץ', 'הודף פי שניים']);
    }
  }
  if (by('chute').length) {
    def.chute = true;
    lines.push(['gear', 'מצנח', 'כשמחזיקים אותו, נופלים לאט']);
    abil.push(['gear', 'מצנח']);
  }
  // (ROADMAP 11.12: any part on it - a jet: its shots faster; a fin: truer; armour: a blow blocked)
  if (by('jet').length && def.speed) {
    def.speed *= 1.45;
    lines.push(['fire', 'סילון', 'הקליעים מהירים יותר']);
  }
  if (by('fin').length && def.spread) {
    def.spread *= 0.8;
    lines.push(['fire', 'סנפיר', 'הקליעים יציבים — מדויק יותר']);
  }
  if (by('armor').length) {
    def.parry = Math.max(def.parry || 0, 0.2);
    lines.push(['gear', 'שריון', 'חוסם חלק מהמכה מלפנים']);
  }
  // ---- (ROADMAP 11.15) what its parts do together, more than each alone (game/combos.js)
  const combo = handCombos(def, {
    scope: gun && !!(by('scope').length || R.scope),
    long: longB,
    stock: gun && !!(by('stock').length || R.stock),
    wing: by('wing').length > 0,
    jet: gun && by('jet').length > 0,
    spin: !!def.spin,
    multi: gun && nB >= 2,
    mag: gun && by('mag').length > 0 && !!def.mag,
    bayonet: !!def.bayonet,
    bounce: (def.bounce || 0) > 0,
    quiet: !!def.quiet,
    prop: !!def.wind,
    chute: !!def.chute,
    guard: (def.parry || 0) > 0,
    edge: by('blade').length > 0,
    saw: !!def.saw,
    head: kind === 'club' && by('head').length > 0,
    els: new Set([...(def.elements || []), def.element].filter(Boolean)),
  });
  // ---- its name: what it is, and what its parts made it
  let name = def.name;
  const g = FEM.has(kind) ? 1 : 0;
  const adj = [];
  if (def.volley === 2) adj.push(['כפול', 'כפולה'][g]);
  if (def.quiet) adj.push(['שקט', 'שקטה'][g]);
  if (def.elements) adj.push(['צבעוני', 'צבעונית'][g]);
  else if (def.element && ELEMENT_ADJ[def.element]) adj.push(def.element === 'shock' ? ['חשמלי', 'חשמלית'][g] : def.element === 'blast' ? ['נפיץ', 'נפיצה'][g] : def.element === 'bounce' ? ['קופצני', 'קופצנית'][g] : ELEMENT_ADJ[def.element]);
  if (adj.length) name += ' ' + adj.slice(0, 2).join(' ');
  if (def.bayonet) name += ' עם כידון';
  def.name = name;
  // ---- its numbers
  const bars = [];
  if (def.kind === 'gun') {
    const per = def.damage * (def.pellets || 1) * (def.volley || 1);
    bars.push({ k: 'dmg', name: 'נזק', v: per / 160, txt: `${def.damage}${def.pellets ? `×${def.pellets}` : ''}${def.volley ? `×${def.volley}` : ''}` });
    bars.push({ k: 'rate', name: 'קצב', v: def.rate / 20, txt: `${def.rate >= 10 ? Math.round(def.rate) : def.rate.toFixed(1)} בשנייה` });
    const range = Math.round(def.speed * (def.gravity ? 1.6 : 2.6));
    bars.push({ k: 'range', name: 'טווח', v: range / 300, txt: `${range} מ׳` });
    bars.push({ k: 'acc', name: 'דיוק', v: clamp(1 - def.spread * 9, 0.05, 1), txt: '' });
    if (def.mag) bars.push({ k: 'mag', name: 'מחסנית', v: def.mag / 150, txt: `${def.mag}` });
  } else if (def.kind === 'beam') {
    bars.push({ k: 'dmg', name: 'נזק', v: def.damage / 130, txt: `${def.damage}` });
    bars.push({ k: 'range', name: 'טווח', v: def.range / 130, txt: `${Math.round(def.range)} מ׳` });
  } else if (def.kind === 'melee') {
    bars.push({ k: 'dmg', name: 'נזק', v: def.damage / 130, txt: `${def.damage}` });
    bars.push({ k: 'range', name: 'טווח', v: def.range / 4, txt: `${def.range.toFixed(1)} מ׳` });
    bars.push({ k: 'rate', name: 'מהירות', v: def.rate / 3.2, txt: `${def.rate.toFixed(1)} בשנייה` });
    if (def.knock) bars.push({ k: 'knock', name: 'הדיפה', v: def.knock / 14, txt: `×${(def.knock / 5).toFixed(1)}` });
  } else {
    bars.push({ k: 'dmg', name: 'נזק', v: def.damage / 140, txt: `${def.damage}` });
    if (def.radius) bars.push({ k: 'blast', name: 'פיצוץ', v: def.radius / 8, txt: `${def.radius.toFixed(1)} מ׳` });
  }
  if (gun) abil.unshift(['fire', def.volley ? `ירי ×${def.volley}` : 'ירי']);
  else if (def.kind === 'melee') abil.unshift(['fire', def.arc >= Math.PI * 2 ? 'סיבוב' : def.slash ? 'חיתוך' : 'מכה']);
  else abil.unshift(['fire', 'זריקה']);
  def.cost = Math.round(clamp((KINDS[kind] ? KINDS[kind].cost : 14) + lines.length * 2, 10, 40));
  const sum = { ok: true, name, abil, bars, lines, warn: [], L, cost: def.cost, kind, combos: combo.list, adv: abil.length, near: combo.near };
  return { def, sum };
}

// (a blade's edge drawn in teeth: its edge turns back again and again)
function toothed(P) {
  let n = 0;
  let dir = 0;
  for (let i = 2; i < P.length; i++) {
    const d = Math.sign(P[i][1] - P[i - 1][1]);
    if (d && dir && d !== dir) n++;
    if (d) dir = d;
  }
  return n >= 8;
}
