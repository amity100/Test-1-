// The air drawing's catalog, one thing at a time (ui/freedraw.js readCatalog, game/catmatch.js): each thing of each shelf
// drawn as people draw it - its own lines, a hand's wobble, a part left out - and read as the game reads it, line by line
// as it is drawn and at the end; and drawings of other things altogether (a house, a sun, a scribble) read by each shelf.
// What it tells: how often each thing is read as itself; what it is taken for when it is not; and the things that light up
// for drawings that are not them - the owner's word: "things that keep popping up as if we tried to draw them".
// usage: node tools/test-catalog.mjs [samples per level] (MEMORY=1: and with the pen's memory of a few picks - drawmemory.js;
// VARIANT=1: lines broken in two and the drawing turned a little; TARGET=1: copying a drawing found in the city - each thing
// read against itself alone, its own copies taken, other things' copies and doodles refused - ui/freedraw.js readTarget)
//
// REPORT=1 (the owner's word: "it recognises far too fast, before I have finished drawing - two lines and it is a car";
// "sometimes I draw the thing exactly and it is not recognised"; "two random lines must never be accepted"): what is
// taken and what is not, a thing at a time, on the pen's two ways of reading -
//   free   nothing picked: the drawing read against its whole shelf (readCatalog);
//   learn  the thing picked first (the legend's tap, a blueprint just photographed - ui/freedraw.js learn): read as that.
// For each: its whole drawings taken (every part there - a careful hand, a fair one, a finger on a phone, a rough finger;
// and, apart, the sloppy level that leaves parts out); its unfinished drawings taken (its first line, its first two, any
// one or two of its lines, its biggest line broken in pieces - the first of them, the first two, all of them and nothing
// else); other things' whole drawings taken for it; doodles and pairs of random lines taken for anything. "Named" is the
// legend lighting and the tag saying a name; "made" is the ✓ making it. A drawing with only details left out (each
// under a tenth of the thing's ink, a little over a tenth together: a bottle's fuse, an umbrella's handle) is no
// unfinished drawing - "you don't have to draw every detail" - and is counted apart ("all but a detail").
//   node tools/test-catalog.mjs [n] REPORT=1 [IDS=car,paint] [OUT=file.json]
// JSROOT=<a js folder>: the game's code read from there (a copy of v5/js kept from before a change - the same drawings,
// read by the old code and the new)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mulberry32, DOODLES, scribble, hand, plen, pieces, randomLines, fingerLines } from './hand.mjs';

const JSROOT = process.env.JSROOT ? path.resolve(process.env.JSROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../v5/js');
const { BLUEPRINTS } = await import(`${JSROOT}/game/blueprints.js`);
const CM = await import(`${JSROOT}/game/catmatch.js`);
const { matchCatalog, shelfIds, SHELVES, tooEarly, drawnWhole, copyReady, MATCH_MIN, PICK_SLACK } = CM;
const { DrawMemory } = await import(`${JSROOT}/game/drawmemory.js`);

const N = +(process.argv[2] || 16);

// how a hand copies a thing (tools/test-recognizer.mjs, its levels)
const LEVELS = {
  good: { jit: 1.0, sscale: 0.05, srot: 0.04, sshift: 1.5, drop: 0, gsx: 0.1 },
  okay: { jit: 1.6, sscale: 0.1, srot: 0.07, sshift: 3.0, drop: 0.05, gsx: 0.15 },
  sloppy: { jit: 2.4, sscale: 0.16, srot: 0.12, sshift: 5.0, drop: 0.18, gsx: 0.2 },
};

function humanCopy(bp, lv, rnd) {
  const r = (a, b) => a + (b - a) * rnd();
  const P = typeof lv === 'string' ? LEVELS[lv] : lv;
  const s = r(4.5, 7.5);
  const ax = 1 + r(-P.gsx, P.gsx);
  const ay = 1 + r(-P.gsx, P.gsx);
  const ox = r(30, 160);
  const oy = r(30, 120);
  // (a thing faces either way: drawn the other way round half the time)
  const flip = rnd() < 0.5;
  const strokes = [];
  for (const st of bp.strokes) {
    if (rnd() < P.drop && strokes.length) continue;
    let cx = 0;
    let cy = 0;
    for (const [x, y] of st.pts) {
      cx += x;
      cy += y;
    }
    cx /= st.pts.length;
    cy /= st.pts.length;
    const sc = 1 + r(-P.sscale, P.sscale);
    const rot = r(-P.srot, P.srot);
    const sh = [r(-P.sshift, P.sshift), r(-P.sshift, P.sshift)];
    const ph = r(0, 10);
    const pts = [];
    for (let i = 0; i < st.pts.length - 1; i++) {
      const a = st.pts[i];
      const b = st.pts[i + 1];
      const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    pts.push(st.pts[st.pts.length - 1]);
    strokes.push(
      pts.map(([x, y], i) => {
        const dx = (x - cx) * sc;
        const dy = (y - cy) * sc;
        const rx = dx * Math.cos(rot) - dy * Math.sin(rot);
        const ry = dx * Math.sin(rot) + dy * Math.cos(rot);
        const nx = Math.sin(i * 0.25 + ph) * P.jit + r(-0.3, 0.3) * P.jit;
        const ny = Math.cos(i * 0.21 + ph) * P.jit + r(-0.3, 0.3) * P.jit;
        const X = (cx + rx + sh[0] + nx) * (flip ? -1 : 1);
        return [ox + X * s * ax, oy + (cy + ry + sh[1] + ny) * s * ay];
      }),
    );
  }
  // (VARIANT=1: as a hand does it its own way - a long line broken in two where the pen was lifted, and the whole
  // drawing turned a little: how many lines it is drawn in is the hand's affair)
  if (process.env.VARIANT) {
    const out = [];
    for (const p of strokes) {
      if (p.length > 24 && rnd() < 0.5) {
        const k = Math.floor(p.length * (0.3 + 0.4 * rnd()));
        out.push(p.slice(0, k + 1), p.slice(k));
      } else out.push(p);
    }
    const a = (rnd() - 0.5) * 0.24;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    return out.map((p) => p.map(([x, y]) => [x * c - y * sn, x * sn + y * c]));
  }
  return strokes;
}

// what the game says of a drawing, as ui/freedraw.js readCatalog does: the thing lit (null: none yet), and whether it
// would be made. force: the thing picked first in the legend (ui/freedraw.js learn). The game's own say of it
// (game/catmatch.js readShelf) where the code read has one; before it had, as ui/freedraw.js said it then
function readAs(lines, ids, memory = null, force = null) {
  const strokes = lines.map((p) => ({ p }));
  if (CM.readShelf) {
    let mem = null;
    if (memory && !force) {
      const m = memory.match(memory.signature(strokes));
      if (m && ids.includes(m.key)) mem = m.key;
    }
    const R = CM.readShelf(strokes, ids, { force: force && ids.includes(force) ? force : null, mem });
    if (!R) return { lit: null };
    return { lit: R.lit, ready: !!R.ready, score: R.b.score, top: R.top.id, fromMemory: !!R.fromMemory };
  }
  const all = matchCatalog(strokes, ids);
  if (!all) return { lit: null };
  const top = all.best;
  let pick = force && ids.includes(force) ? force : null;
  let fromMemory = false;
  if (!pick && memory) {
    const m = memory.match(memory.signature(strokes));
    if (m && ids.includes(m.key)) {
      pick = m.key;
      fromMemory = true;
    }
  }
  // (as freedraw.js: the memory's pick only while the catalog says it may be it)
  if (pick && fromMemory && pick !== top.id) {
    const m = all.list.find((x) => x.id === pick);
    if (!m || top.score > m.score + PICK_SLACK || top.rank > m.rank + 2 * PICK_SLACK) pick = null;
  }
  const b = (pick && all.list.find((x) => x.id === pick)) || top;
  const early = tooEarly(top, all.have);
  if (!pick && early) return { lit: null, top: top.id, score: top.score };
  const other = pick && top.id !== b.id && top.score > b.score + PICK_SLACK && !early;
  const ready = b.score >= MATCH_MIN && drawnWhole(b, all.have) && !other;
  return { lit: b.id, ready, score: b.score, top: top.id, fromMemory };
}

const rnd = mulberry32(20261116);
const memory = process.env.MEMORY ? new DrawMemory() : null;
if (memory) {
  // (a player who picked a thing in the legend and drew it, twice each, for a few things - what the pen keeps)
  for (const id of ['rifle', 'katana', 'car', 'bike', 'paint']) {
    for (let k = 0; k < 2; k++) memory.learn(memory.signature(humanCopy(BLUEPRINTS[id], 'okay', rnd).map((p) => ({ p }))), id);
  }
}

// (ROADMAP 29.5) TARGET=1: copying one drawing - read against it alone (catmatch.js copyReady)
if (process.env.TARGET) {
  const ids = SHELVES.flatMap((sh) => shelfIds(sh));
  const only = process.env.IDS ? process.env.IDS.split(',') : ids;
  const PARTS0 = Object.values(BLUEPRINTS).filter((b) => b.kind === 'part').map((b) => b.id);
  const others = [...ids, ...PARTS0].map((id) => ({ id, S: [0, 1].map(() => humanCopy(BLUEPRINTS[id], 'okay', rnd)) }));
  const doodles = [];
  for (const [name, f] of Object.entries(DOODLES)) for (let k = 0; k < 2; k++) doodles.push({ name, S: hand(f(), rnd) });
  for (let k = 0; k < 10; k++) doodles.push({ name: 'scribble', S: scribble(rnd) });
  const rows = [];
  let tot = { own: 0, ownN: 0, oth: 0, othN: 0, doo: 0, dooN: 0 };
  for (const id of only) {
    const bp = BLUEPRINTS[id];
    if (!bp) continue;
    // (a part found in the city is read against the other parts; a thing of the shelves against its shelf)
    const PARTS = Object.values(BLUEPRINTS).filter((b) => b.kind === 'part').map((b) => b.id);
    const shelfAll = BLUEPRINTS[id].kind === 'part' ? [...PARTS, ...SHELVES.flatMap((sh) => shelfIds(sh))] : shelfIds(SHELVES.find((sh) => shelfIds(sh).includes(id)));
    const take = (S) => {
      const st = S.map((p) => ({ p }));
      if (process.env.RIVAL) {
        const all = matchCatalog(st, shelfAll);
        if (!all) return false;
        const me = all.list.find((x) => x.id === id);
        if (!me || !copyReady(me, all.have)) return false;
        const riv = all.list.find((x) => x.id !== id);
        return !(riv && riv.rank > me.rank + +process.env.RIVAL);
      }
      const all = matchCatalog(st, [id]);
      return !!(all && copyReady(all.best, all.have));
    };
    const r = { id, own: {}, other: 0, otherN: 0, by: [], doodle: 0, doodleN: doodles.length, doodBy: [] };
    for (const lv of Object.keys(LEVELS)) {
      let n = 0;
      for (let k = 0; k < N; k++) n += take(humanCopy(bp, lv, rnd)) ? 1 : 0;
      r.own[lv] = Math.round((100 * n) / N);
      tot.own += n;
      tot.ownN += N;
    }
    for (const o of others) {
      if (o.id === id) continue;
      for (const S of o.S) {
        r.otherN++;
        if (take(S)) {
          r.other++;
          if (!r.by.includes(o.id)) r.by.push(o.id);
        }
      }
    }
    for (const d of doodles) if (take(d.S)) {
      r.doodle++;
      if (!r.doodBy.includes(d.name)) r.doodBy.push(d.name);
    }
    tot.oth += r.other;
    tot.othN += r.otherN;
    tot.doo += r.doodle;
    tot.dooN += r.doodleN;
    rows.push(r);
  }
  console.table(rows.map((r) => ({ id: r.id, 'good %': r.own.good, 'okay %': r.own.okay, 'sloppy %': r.own.sloppy, 'others taken %': Math.round((100 * r.other) / Math.max(1, r.otherN)), 'taken from': r.by.slice(0, 5).join(' '), 'doodles taken': r.doodBy.join(' ') })));
  console.log(`own copies taken ${((100 * tot.own) / tot.ownN).toFixed(1)}% · other things' copies taken ${((100 * tot.oth) / tot.othN).toFixed(1)}% · doodles taken ${((100 * tot.doo) / tot.dooN).toFixed(1)}%`);
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------------------
// REPORT=1: what is taken and what is not (see the head)

// ---------------------------------------------------------------------------------------------------------------------
// REPORT=1: what is taken and what is not (see the head)
// a thing's lines as a finger draws them (tools/hand.mjs)
const fingerCopy = (bp, lv, rnd, o) => fingerLines(bp.strokes.map((st) => st.pts), lv, rnd, o);

if (process.env.REPORT) {
  const NR = +(process.argv[2] || 30);
  const only = process.env.IDS ? process.env.IDS.split(',') : null;
  const START = ['paint', 'rifle', 'mp5', 'shotgun', 'inkbomb', 'car', 'muscle', 'hyper', 'nightshift', 'streetline', 'bike', 'ramp', 'barrier', 'bridge'];
  const WHOLE = ['good', 'okay0', 'finger', 'rough'];
  // (the old levels with nothing left out: a part missing is not a whole drawing)
  const LV0 = { good: LEVELS.good, okay0: { ...LEVELS.okay, drop: 0 } };
  const shelves = SHELVES.map((sh) => ({ sh, ids: shelfIds(sh) }));
  const shelfOfId = (id) => shelves.find((q) => q.ids.includes(id));
  const allIds = shelves.flatMap((q) => q.ids);
  // the drawings: each thing's, made once from its own dice - the same whatever code reads them
  const seedOf = (id, k) => {
    let h = 2166136261 ^ k;
    for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return h >>> 0;
  };
  const D = {};
  for (const id of allIds) {
    const bp = BLUEPRINTS[id];
    const rr = mulberry32(seedOf(id, 1));
    const d = { whole: {}, sloppy: [], part: [] };
    for (const lv of WHOLE) {
      d.whole[lv] = [];
      for (let k = 0; k < NR; k++) d.whole[lv].push(LV0[lv] ? humanCopy(bp, LV0[lv], rr) : fingerCopy(bp, lv, rr).S);
    }
    for (let k = 0; k < NR; k++) d.sloppy.push(humanCopy(bp, 'sloppy', rr));
    // the unfinished ones: of a finger's drawing with each of the thing's lines one line (whole), what there is of it
    // after a line, after two
    const n = bp.strokes.length;
    // (how much of the thing's ink each of its lines is)
    const lens = bp.strokes.map((st) => plen(st.pts));
    const share = lens.map((v) => v / lens.reduce((a, b) => a + b, 0));
    for (let k = 0; k < NR; k++) {
      const F = fingerCopy(bp, 'finger', rr, { whole: true }).S;
      const big = F.reduce((m, p, i) => (plen(p) > plen(F[m]) ? i : m), 0);
      // (in the thing's own order - its biggest line first, as its drawing has it - and in any order)
      const ord = F.map((_, i) => i).sort(() => rr() - 0.5);
      for (const j of [1, 2]) {
        if (j >= n) continue;
        // (the owner's word: "you don't have to draw every detail" - a drawing with only details left out, each under a
        // tenth of the thing's ink and a little over a tenth together, is no unfinished drawing: counted apart, as
        // one that is to be taken)
        const kept = [F.map((_, i) => i).slice(0, j), ord.slice(0, j)];
        ['first', 'any'].forEach((w, q) => {
          const gone = share.filter((_, i) => !kept[q].includes(i));
          const detail = Math.max(...gone) < 0.1 && gone.reduce((a, b) => a + b, 0) <= 0.12;
          d.part.push({ kind: detail ? 'all but a detail' : `${w} ${j} of ${n}`, lines: j, detail, S: kept[q].map((i) => F[i]) });
        });
      }
      // (its biggest line - a body, a blade - in pieces: the first of them, the first two; and all of it, in two
      // pieces or three, with nothing else of the thing)
      const m = 2 + Math.floor(rr() * 3);
      const pc = pieces(F[big], m);
      d.part.push({ kind: 'piece 1 of the big line', lines: 1, S: pc.slice(0, 1) });
      if (pc.length > 2 || n > 1) d.part.push({ kind: 'pieces 1-2 of the big line', lines: 2, S: pc.slice(0, 2) });
      if (n > 1) {
        const m2 = 2 + Math.floor(rr() * 2);
        d.part.push({ kind: `the big line alone, in ${m2}`, lines: m2, S: pieces(F[big], m2) });
      }
    }
    D[id] = d;
  }
  // other drawings altogether
  const rd = mulberry32(977);
  const doodles = [];
  for (const [name, f] of Object.entries(DOODLES)) for (let k = 0; k < 4; k++) doodles.push({ name, S: hand(f(), rd) });
  for (let k = 0; k < 12; k++) doodles.push({ name: 'scribble', S: scribble(rd) });
  const pairs = [];
  for (let k = 0; k < 300; k++) pairs.push({ name: 'two lines', S: randomLines(rd, 2) });
  for (let k = 0; k < 150; k++) pairs.push({ name: 'three lines', S: randomLines(rd, 3) });

  // (DRAWINGS=<file>: the drawings themselves, of the things asked for - to look at the ones that go wrong)
  if (process.env.DRAWINGS) {
    fs.writeFileSync(process.env.DRAWINGS, JSON.stringify(Object.fromEntries((only || allIds).map((id) => [id, D[id]]))));
    process.exit(0);
  }
  const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
  const out = { n: NR, root: JSROOT, free: {}, learn: {}, doodles: {} };
  // FEATS=<file>: the numbers behind the say (game/catmatch.js wholeOf), for each drawing - how its thresholds are chosen:
  // a line a drawing: kind (whole:<level> | part:<kind> | other | doodle), the thing drawn, the thing it is held against
  // (itself; for an unfinished one and a doodle the likeliest), then its biggest part, the least of its other parts of
  // size, the ink of its details left out, cov, prec, own, score, extra, precT, each of its parts (how much of it is there :
  // how much of the thing's ink it is), rank
  if (process.env.FEATS && CM.readShelf) {
    const rows = [];
    const feat = (kind, id, m) => {
      const P = m.parts;
      let big = 0;
      for (let i = 1; i < P.length; i++) if (P[i].w > P[big].w) big = i;
      let least = 1;
      let left = 0;
      P.forEach((q, i) => {
        if (i === big) return;
        if (q.w >= CM.WHOLE.detail) least = Math.min(least, q.c);
        else if (q.c < CM.WHOLE.part) left += q.w;
      });
      rows.push([kind, id, m.id, P[big].c.toFixed(3), least.toFixed(3), left.toFixed(3), m.cov.toFixed(3), m.prec.toFixed(3), m.own.toFixed(3), m.score.toFixed(3), m.extra.toFixed(3), m.precT.toFixed(3), P.map((q) => `${q.c.toFixed(3)}:${q.w.toFixed(3)}`).join(' '), m.rank.toFixed(3)].join('\t'));
    };
    for (const id of only || allIds) {
      const sh = shelfOfId(id);
      for (const lv of WHOLE) for (const S of D[id].whole[lv]) feat(`whole:${lv}`, id, CM.readShelf(S.map((p) => ({ p })), sh.ids, { force: id }).b);
      for (const q of D[id].part) feat(`part:${q.kind.replace(/ of \d+/, '').replace(/in \d+/, 'in pieces')}`, id, CM.readShelf(q.S.map((p) => ({ p })), sh.ids).top);
      for (const q of D[id].part) feat(`partown:${q.kind.replace(/ of \d+/, '').replace(/in \d+/, 'in pieces')}`, id, CM.readShelf(q.S.map((p) => ({ p })), sh.ids, { force: id }).b);
      for (const o of allIds) if (o !== id) for (const S of D[o].whole.finger.slice(0, 3)) feat('other', o, CM.readShelf(S.map((p) => ({ p })), sh.ids, { force: id }).b);
    }
    for (const { ids } of shelves) for (const q of [...doodles, ...pairs]) feat(`doodle:${q.name}`, q.name, CM.readShelf(q.S.map((p) => ({ p })), ids).top);
    fs.writeFileSync(process.env.FEATS, rows.join('\n'));
    console.log('features written', rows.length);
    process.exit(0);
  }
  const todo = only || allIds;
  for (const id of todo) {
    const sh = shelfOfId(id);
    if (!sh) continue;
    const ids = sh.ids;
    const d = D[id];
    // ---- free: nothing picked
    const F = { whole: {}, made: 0, n: 0, other: 0, namedOther: 0, took: {}, sloppy: { made: 0, other: 0, n: 0 }, part: { named: 0, made: 0, n: 0, by: {} }, p1: { named: 0, made: 0, n: 0 }, p2: { named: 0, made: 0, n: 0 }, det: { made: 0, n: 0 } };
    for (const lv of WHOLE) {
      let ok = 0;
      for (const S of d.whole[lv]) {
        const R = readAs(S, ids);
        F.n++;
        if (R.lit === id && R.ready) {
          ok++;
          F.made++;
        } else {
          if (R.lit && R.lit !== id) {
            F.namedOther++;
            if (R.ready) {
              F.other++;
              F.took[R.lit] = (F.took[R.lit] || 0) + 1;
            }
          }
        }
      }
      F.whole[lv] = pct(ok, d.whole[lv].length);
    }
    for (const S of d.sloppy) {
      const R = readAs(S, ids);
      F.sloppy.n++;
      if (R.lit === id && R.ready) F.sloppy.made++;
      else if (R.lit && R.ready) F.sloppy.other++;
    }
    for (const q of d.part) {
      const R = readAs(q.S, ids);
      if (q.detail) {
        F.det.n++;
        if (R.lit === id && R.ready) F.det.made++;
        continue;
      }
      const b = q.lines <= 1 ? F.p1 : q.lines === 2 ? F.p2 : null;
      F.part.n++;
      if (b) b.n++;
      const by = (F.part.by[q.kind] = F.part.by[q.kind] || { named: 0, made: 0, n: 0 });
      by.n++;
      if (R.lit) {
        F.part.named++;
        by.named++;
        if (b) b.named++;
      }
      if (R.lit && R.ready) {
        F.part.made++;
        by.made++;
        if (b) b.made++;
      }
    }
    out.free[id] = F;
    // ---- learn: this thing picked
    const L = { whole: {}, made: 0, n: 0, sloppy: { made: 0, n: 0 }, part: { made: 0, n: 0, by: {} }, p1: { made: 0, n: 0 }, p2: { made: 0, n: 0 }, det: { made: 0, n: 0 }, other: 0, otherN: 0, by: {}, doodle: 0, doodleN: 0, doodBy: {} };
    for (const lv of WHOLE) {
      let ok = 0;
      for (const S of d.whole[lv]) {
        const R = readAs(S, ids, null, id);
        L.n++;
        if (R.lit === id && R.ready) {
          ok++;
          L.made++;
        }
      }
      L.whole[lv] = pct(ok, d.whole[lv].length);
    }
    for (const S of d.sloppy) {
      const R = readAs(S, ids, null, id);
      L.sloppy.n++;
      if (R.lit === id && R.ready) L.sloppy.made++;
    }
    for (const q of d.part) {
      const R = readAs(q.S, ids, null, id);
      if (q.detail) {
        L.det.n++;
        if (R.lit === id && R.ready) L.det.made++;
        continue;
      }
      const b = q.lines <= 1 ? L.p1 : q.lines === 2 ? L.p2 : null;
      const by = (L.part.by[q.kind] = L.part.by[q.kind] || { made: 0, n: 0 });
      L.part.n++;
      by.n++;
      if (b) b.n++;
      if (R.lit === id && R.ready) {
        L.part.made++;
        by.made++;
        if (b) b.made++;
      }
    }
    // (other things' whole drawings, a finger's, three of each: every other thing of every shelf)
    for (const o of allIds) {
      if (o === id) continue;
      for (const S of D[o].whole.finger.slice(0, 3)) {
        const R = readAs(S, ids, null, id);
        L.otherN++;
        if (R.lit === id && R.ready) {
          L.other++;
          L.by[o] = (L.by[o] || 0) + 1;
        }
      }
    }
    for (const q of [...doodles, ...pairs]) {
      const R = readAs(q.S, ids, null, id);
      L.doodleN++;
      if (R.lit === id && R.ready) {
        L.doodle++;
        L.doodBy[q.name] = (L.doodBy[q.name] || 0) + 1;
      }
    }
    out.learn[id] = L;
  }
  // ---- doodles, nothing picked: by each shelf
  for (const { sh, ids } of shelves) {
    const Q = { named: 0, made: 0, n: 0, by: {}, pairsNamed: 0, pairsMade: 0, pairsN: 0, pairsBy: {} };
    for (const q of doodles) {
      const R = readAs(q.S, ids);
      Q.n++;
      if (R.lit) {
        Q.named++;
        if (R.ready) {
          Q.made++;
          Q.by[`${q.name}>${R.lit}`] = (Q.by[`${q.name}>${R.lit}`] || 0) + 1;
        }
      }
    }
    for (const q of pairs) {
      const R = readAs(q.S, ids);
      Q.pairsN++;
      if (R.lit) {
        Q.pairsNamed++;
        if (R.ready) {
          Q.pairsMade++;
          Q.pairsBy[R.lit] = (Q.pairsBy[R.lit] || 0) + 1;
        }
      }
    }
    out.doodles[sh] = Q;
  }
  // ---- said
  const top3 = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ');
  const rowF = (id) => {
    const F = out.free[id];
    return { id: (START.includes(id) ? '* ' : '  ') + id, 'whole made %': pct(F.made, F.n), good: F.whole.good, okay: F.whole.okay0, finger: F.whole.finger, rough: F.whole.rough, 'sloppy(drop) %': pct(F.sloppy.made, F.sloppy.n), '1 line named/made %': `${pct(F.p1.named, F.p1.n)} / ${pct(F.p1.made, F.p1.n)}`, '2 lines named/made %': `${pct(F.p2.named, F.p2.n)} / ${pct(F.p2.made, F.p2.n)}`, 'all but a detail %': F.det.n ? pct(F.det.made, F.det.n) : '', 'made as another %': pct(F.other, F.n), 'as': top3(F.took) };
  };
  const rowL = (id) => {
    const L = out.learn[id];
    return { id: (START.includes(id) ? '* ' : '  ') + id, 'whole made %': pct(L.made, L.n), good: L.whole.good, okay: L.whole.okay0, finger: L.whole.finger, rough: L.whole.rough, 'sloppy(drop) %': pct(L.sloppy.made, L.sloppy.n), '1 line made %': pct(L.p1.made, L.p1.n), '2 lines made %': pct(L.p2.made, L.p2.n), 'all but a detail %': L.det.n ? pct(L.det.made, L.det.n) : '', 'others taken %': pct(L.other, L.otherN), from: top3(L.by), 'doodles taken %': pct(L.doodle, L.doodleN) };
  };
  console.log(`\n=== FREE (nothing picked): ${NR} drawings a level; * the start kit`);
  console.table(todo.filter((id) => out.free[id]).map(rowF));
  console.log(`\n=== LEARN (the thing picked first): ${NR} drawings a level; * the start kit`);
  console.table(todo.filter((id) => out.learn[id]).map(rowL));
  const sum = (ids, path, f) => ids.reduce((a, id) => a + (out[path][id] ? f(out[path][id]) : 0), 0);
  const tot = (ids, name) => {
    const I = ids.filter((id) => out.free[id]);
    if (!I.length) return;
    const lv3 = (path) => ['good', 'okay0', 'finger'].map((lv) => I.reduce((a, id) => a + out[path][id].whole[lv], 0) / I.length);
    const f3 = lv3('free');
    const l3 = lv3('learn');
    console.log(`${name} (${I.length} things)`);
    console.log(`  free:  whole drawings made ${pct(sum(I, 'free', (F) => F.made), sum(I, 'free', (F) => F.n))}% (good ${f3[0].toFixed(1)}, okay ${f3[1].toFixed(1)}, finger ${f3[2].toFixed(1)}; careful+fair+finger ${((f3[0] + f3[1] + f3[2]) / 3).toFixed(1)}) · with parts left out (sloppy) ${pct(sum(I, 'free', (F) => F.sloppy.made), sum(I, 'free', (F) => F.sloppy.n))}% · 1 line: named ${pct(sum(I, 'free', (F) => F.p1.named), sum(I, 'free', (F) => F.p1.n))}% made ${pct(sum(I, 'free', (F) => F.p1.made), sum(I, 'free', (F) => F.p1.n))}% · 2 lines: named ${pct(sum(I, 'free', (F) => F.p2.named), sum(I, 'free', (F) => F.p2.n))}% made ${pct(sum(I, 'free', (F) => F.p2.made), sum(I, 'free', (F) => F.p2.n))}% · all unfinished: named ${pct(sum(I, 'free', (F) => F.part.named), sum(I, 'free', (F) => F.part.n))}% made ${pct(sum(I, 'free', (F) => F.part.made), sum(I, 'free', (F) => F.part.n))}% · all but a detail made ${pct(sum(I, 'free', (F) => F.det.made), sum(I, 'free', (F) => F.det.n))}% · whole drawings made as another thing ${pct(sum(I, 'free', (F) => F.other), sum(I, 'free', (F) => F.n))}%`);
    console.log(`  learn: whole drawings made ${pct(sum(I, 'learn', (L) => L.made), sum(I, 'learn', (L) => L.n))}% (good ${l3[0].toFixed(1)}, okay ${l3[1].toFixed(1)}, finger ${l3[2].toFixed(1)}; careful+fair+finger ${((l3[0] + l3[1] + l3[2]) / 3).toFixed(1)}) · with parts left out (sloppy) ${pct(sum(I, 'learn', (L) => L.sloppy.made), sum(I, 'learn', (L) => L.sloppy.n))}% · 1 line made ${pct(sum(I, 'learn', (L) => L.p1.made), sum(I, 'learn', (L) => L.p1.n))}% · 2 lines made ${pct(sum(I, 'learn', (L) => L.p2.made), sum(I, 'learn', (L) => L.p2.n))}% · all unfinished made ${pct(sum(I, 'learn', (L) => L.part.made), sum(I, 'learn', (L) => L.part.n))}% · all but a detail made ${pct(sum(I, 'learn', (L) => L.det.made), sum(I, 'learn', (L) => L.det.n))}% · other things' drawings taken ${pct(sum(I, 'learn', (L) => L.other), sum(I, 'learn', (L) => L.otherN))}% · doodles and random lines taken ${pct(sum(I, 'learn', (L) => L.doodle), sum(I, 'learn', (L) => L.doodleN))}%`);
  };
  console.log('');
  tot(START, 'THE START KIT');
  tot(allIds, 'EVERYTHING');
  // (the unfinished drawings, by kind)
  const kinds = {};
  for (const id of todo) {
    if (!out.free[id]) continue;
    for (const [k, v] of Object.entries(out.free[id].part.by)) {
      const key = k.replace(/ of \d+/, '').replace(/in \d+/, 'in pieces');
      const q = (kinds[key] = kinds[key] || { named: 0, made: 0, n: 0, learn: 0 });
      q.named += v.named;
      q.made += v.made;
      q.n += v.n;
      q.learn += out.learn[id].part.by[k] ? out.learn[id].part.by[k].made : 0;
    }
  }
  console.log('\nunfinished drawings, by kind:');
  console.table(Object.entries(kinds).map(([k, v]) => ({ kind: k, n: v.n, 'free: named %': pct(v.named, v.n), 'free: made %': pct(v.made, v.n), 'learn: made %': pct(v.learn, v.n) })));
  console.log('doodles, nothing picked:');
  console.table(Object.entries(out.doodles).map(([sh, Q]) => ({ shelf: sh, 'doodles named %': pct(Q.named, Q.n), 'doodles made %': pct(Q.made, Q.n), as: top3(Q.by), 'random lines named %': pct(Q.pairsNamed, Q.pairsN), 'random lines made %': pct(Q.pairsMade, Q.pairsN), 'as ': top3(Q.pairsBy) })));
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out));
  process.exit(0);
}

const report = {};
for (const shelf of SHELVES) {
  const ids = shelfIds(shelf);
  const rows = [];
  const litFor = {};
  for (const id of ids) {
    const bp = BLUEPRINTS[id];
    const row = { id, n: 0, top1: 0, made: 0, midWrong: 0, mids: 0 };
    const took = {};
    for (const lv of Object.keys(LEVELS)) {
      for (let k = 0; k < N; k++) {
        const S = humanCopy(bp, lv, rnd);
        // line by line, as it is drawn: what is lit before the end that is not it
        for (let j = 1; j < S.length; j++) {
          const R = readAs(S.slice(0, j), ids, memory);
          row.mids++;
          if (R.lit && R.lit !== id) {
            row.midWrong++;
            litFor[R.lit] = (litFor[R.lit] || 0) + 1;
          }
        }
        const R = readAs(S, ids, memory);
        row.n++;
        if (R.lit === id) row.top1++;
        else {
          const w = R.lit || `(none: ${R.top})`;
          took[w] = (took[w] || 0) + 1;
          if (R.lit) litFor[R.lit] = (litFor[R.lit] || 0) + 1;
        }
        if (R.lit === id && R.ready) row.made++;
      }
    }
    row.top1 = Math.round((100 * row.top1) / row.n);
    row.made = Math.round((100 * row.made) / row.n);
    row.midWrong = Math.round((100 * row.midWrong) / Math.max(1, row.mids));
    row.takenFor = Object.entries(took).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ');
    rows.push(row);
  }
  // other things altogether
  const dood = {};
  for (const [name, f] of Object.entries(DOODLES)) {
    for (let k = 0; k < 4; k++) {
      const R = readAs(hand(f(), rnd), ids, memory);
      if (R.lit) {
        dood[R.lit] = dood[R.lit] || [];
        if (!dood[R.lit].includes(name)) dood[R.lit].push(name);
        litFor[R.lit] = (litFor[R.lit] || 0) + 1;
      }
    }
  }
  for (let k = 0; k < 12; k++) {
    const R = readAs(scribble(rnd), ids, memory);
    if (R.lit) {
      dood[R.lit] = dood[R.lit] || [];
      if (!dood[R.lit].includes('scribble')) dood[R.lit].push('scribble');
      litFor[R.lit] = (litFor[R.lit] || 0) + 1;
    }
  }
  report[shelf] = { rows, litForOthers: Object.entries(litFor).sort((a, b) => b[1] - a[1]), doodles: dood };
  console.log(`\n=== ${shelf} (${ids.length} things, ${N} copies a level x ${Object.keys(LEVELS).length} levels)`);
  console.table(rows.map((r) => ({ id: r.id, 'read as it %': r.top1, 'made %': r.made, 'wrong mid-drawing %': r.midWrong, 'taken for': r.takenFor })));
  console.log('lit for drawings of other things (count):', report[shelf].litForOthers.map(([k, v]) => `${k} ${v}`).join(', '));
  console.log('lit for doodles:', Object.entries(dood).map(([k, v]) => `${k} <- ${v.join('/')}`).join('; ') || 'none');
}
if (process.env.JSON) console.log(JSON.stringify(report));
