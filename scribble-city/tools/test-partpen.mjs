// The car's pen, one thing at a time (game/partpen.js, game/partnet.js): a category said - a weapon, something it can
// do, protection - and a thing of it drawn on the car, as people draw it from its picture in the legend
// (game/itemcat.js icon): its own lines by a careful hand, a finger on a phone, a rough finger; and unfinished - its
// first line, its first two, any one or two of its lines, its biggest line broken off half way; and drawings that are
// none of the category's things - the other categories' things, doodles, lines of nothing.
// What it tells (the owner's word: "it recognises far too fast, before I have finished drawing"; "sometimes I draw the
// thing exactly and it is not recognised"; "two random lines must never be accepted"): for each thing, how often its
// whole drawing goes on the car as itself when the pen rests (and with ✓); how often an unfinished drawing of it goes on
// as anything when the pen rests; what is taken for it.
//   node tools/test-partpen.mjs [drawings a level]   (IDS=mg,turbo: only those; OUT=file.json; FEATS=file.tsv: the
//   network's numbers for each drawing, for choosing where the lines are)
// JSROOT=<a js folder>: the game's code read from there (a copy of v5/js kept from before a change - the same drawings,
// read by the old code and the new)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mulberry32, DOODLES, scribble, hand, plen, pieces, randomLines, fingerLines } from './hand.mjs';
import { svgLines } from './svglines.mjs';

const JSROOT = process.env.JSROOT ? path.resolve(process.env.JSROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../v5/js');
const { ITEMS, CATS } = await import(`${JSROOT}/game/itemcat.js`);
const PN = await import(`${JSROOT}/game/partnet.js`);

const N = +(process.argv[2] || 30);
const START = ['turbo', 'wing', 'jump', 'mg', 'armor', 'rotor'];
const LEVELS = ['neat', 'finger', 'rough'];
const only = process.env.IDS ? process.env.IDS.split(',') : null;

// what the pen does with a drawing left to rest, and with ✓: { rest (the thing that goes on the car when the pen has
// rested - null: none), tick (the thing that goes on with ✓), named (the thing its name says at rest) }. The game's own
// say of it (game/partnet.js penSay) where the code read has one; before it had, as game/partpen.js did it then: the
// thing read - or, not sure of two, the likelier - went on once the pen had rested a second
function penOf(lines, cat) {
  if (PN.penSay) {
    const R = PN.penSay(lines, cat);
    const it = R.item || (R.ask ? R.ask[0] : null);
    // (✓ takes what it is read as, sure or not - but never a line or two of nothing)
    return { rest: R.tier === 'sure' ? R.item : null, long: R.tier === 'sure' || R.tier === 'likely' ? it : null, tick: R.plain ? null : it, named: R.tier !== 'wait' ? it : null, r: R };
  }
  const r = PN.readItem(lines, cat);
  let ask = null;
  const [a, b] = r.ranked;
  if (a && b) {
    if (r.item && b[1] >= 0.2 && a[1] - b[1] < 0.3) ask = [a[0], b[0]];
    else if (!r.item && a[1] >= 0.3 && r.none - a[1] < 0.3) ask = [a[0], b[0]];
  }
  const it = r.item || (ask ? ask[0] : null);
  // (and its name was by the pen while it was drawn: whatever it was read as, sure or not)
  return { rest: it, long: it, tick: it, named: r.item || (ask ? ask[0] : null), r: { ...r, ask } };
}

// a thing's picture, as lines in a box a hundred across
const linesOf = (id) => svgLines(ITEMS[id].icon).map((L) => L.map(([x, y]) => [x * 4.2, y * 4.2]));
const seedOf = (id, k) => {
  let h = 2166136261 ^ k;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};
const cats = Object.keys(CATS);
const all = cats.flatMap((c) => CATS[c].map((id) => ({ id, cat: c })));
const D = {};
for (const { id } of all) {
  const src = linesOf(id);
  const rr = mulberry32(seedOf(id, 3));
  const d = { whole: {}, part: [], n: src.length };
  for (const lv of LEVELS) {
    d.whole[lv] = [];
    for (let k = 0; k < N; k++) d.whole[lv].push(fingerLines(src, lv, rr).S);
  }
  const n = src.length;
  for (let k = 0; k < N; k++) {
    const F = fingerLines(src, 'finger', rr, { whole: true }).S;
    const big = F.reduce((m, p, i) => (plen(p) > plen(F[m]) ? i : m), 0);
    const ord = F.map((_, i) => i).sort(() => rr() - 0.5);
    for (const j of [1, 2]) {
      if (j >= n) continue;
      d.part.push({ kind: `first ${j}`, lines: j, S: F.slice(0, j) });
      d.part.push({ kind: `any ${j}`, lines: j, S: ord.slice(0, j).map((i) => F[i]) });
    }
    // (its biggest line broken off: the first half of it, a third, two thirds - alone)
    const m = 2 + Math.floor(rr() * 2);
    const pc = pieces(F[big], m);
    d.part.push({ kind: 'the big line, begun', lines: 1, S: pc.slice(0, 1) });
    if (m > 2) d.part.push({ kind: 'the big line, most of it', lines: 2, S: pc.slice(0, 2) });
    if (n > 1) d.part.push({ kind: 'the big line alone', lines: 1, S: [F[big]] });
  }
  D[id] = d;
}
const rd = mulberry32(977);
const doodles = [];
for (const [name, f] of Object.entries(DOODLES)) for (let k = 0; k < 4; k++) doodles.push({ name, S: hand(f(), rd) });
for (let k = 0; k < 12; k++) doodles.push({ name: 'scribble', S: scribble(rd) });
const lines12 = [];
for (let k = 0; k < 200; k++) lines12.push({ name: 'one line', S: randomLines(rd, 1) });
for (let k = 0; k < 300; k++) lines12.push({ name: 'two lines', S: randomLines(rd, 2) });
for (let k = 0; k < 150; k++) lines12.push({ name: 'three lines', S: randomLines(rd, 3) });

const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
const top3 = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ');

if (process.env.FEATS) {
  const rows = [];
  const f = (kind, id, cat, S) => {
    const r = PN.readItem(S, cat);
    const [a, b] = r.ranked;
    rows.push([kind, id, cat, r.item || '-', a ? a[0] : '-', a ? a[1].toFixed(3) : 0, b ? b[1].toFixed(3) : 0, r.none.toFixed(3), S.length, (S.reduce((q, p) => q + plen(p), 0)).toFixed(0)].join('\t'));
  };
  for (const { id, cat } of all) {
    for (const lv of LEVELS) for (const S of D[id].whole[lv]) f(`whole:${lv}`, id, cat, S);
    for (const q of D[id].part) f(`part:${q.kind}`, id, cat, q.S);
    for (const o of all) if (o.cat !== cat) for (const S of D[o.id].whole.finger.slice(0, 2)) f('other', o.id, cat, S);
  }
  for (const cat of cats) for (const q of [...doodles, ...lines12]) f(`doodle:${q.name}`, q.name, cat, q.S);
  fs.writeFileSync(process.env.FEATS, rows.join('\n'));
  console.log('features written', rows.length);
  process.exit(0);
}

const out = { n: N, root: JSROOT, items: {}, cats: {} };
for (const { id, cat } of all) {
  if (only && !only.includes(id)) continue;
  const d = D[id];
  const I = { cat, lines: d.n, whole: {}, long: {}, tick: {}, rest: 0, restOther: 0, n: 0, took: {}, part: { rest: 0, long: 0, named: 0, n: 0, by: {} }, p1: { rest: 0, long: 0, n: 0 }, p2: { rest: 0, long: 0, n: 0 } };
  for (const lv of LEVELS) {
    let ok = 0;
    let lg = 0;
    let tk = 0;
    for (const S of d.whole[lv]) {
      const R = penOf(S, cat);
      I.n++;
      if (R.rest === id) {
        ok++;
        I.rest++;
      } else if (R.rest) {
        I.restOther++;
        I.took[R.rest] = (I.took[R.rest] || 0) + 1;
      }
      if (R.long === id) lg++;
      if (R.tick === id) tk++;
    }
    I.whole[lv] = pct(ok, d.whole[lv].length);
    I.long[lv] = pct(lg, d.whole[lv].length);
    I.tick[lv] = pct(tk, d.whole[lv].length);
  }
  for (const q of d.part) {
    const R = penOf(q.S, cat);
    const b = q.lines <= 1 ? I.p1 : I.p2;
    const by = (I.part.by[q.kind] = I.part.by[q.kind] || { rest: 0, long: 0, n: 0 });
    I.part.n++;
    b.n++;
    by.n++;
    if (R.named) I.part.named++;
    if (R.rest) {
      I.part.rest++;
      b.rest++;
      by.rest++;
    }
    if (R.long) {
      I.part.long++;
      b.long++;
      by.long++;
    }
  }
  out.items[id] = I;
}
for (const cat of cats) {
  const C = { other: 0, otherL: 0, otherN: 0, by: {}, doodle: 0, doodleL: 0, doodleN: 0, doodBy: {}, lines: 0, linesL: 0, linesN: 0, linesBy: {} };
  const count = (S, name, k, kl, kn, by) => {
    const R = penOf(S, cat);
    C[kn]++;
    if (R.long) C[kl]++;
    if (R.rest) {
      C[k]++;
      C[by][`${name}>${R.rest}`] = (C[by][`${name}>${R.rest}`] || 0) + 1;
    }
  };
  for (const o of all) if (o.cat !== cat) for (const S of D[o.id].whole.finger.slice(0, 4)) count(S, o.id, 'other', 'otherL', 'otherN', 'by');
  for (const q of doodles) count(q.S, q.name, 'doodle', 'doodleL', 'doodleN', 'doodBy');
  for (const q of lines12) count(q.S, q.name, 'lines', 'linesL', 'linesN', 'linesBy');
  out.cats[cat] = C;
}
const ids = Object.keys(out.items);
console.log(`\n=== THE CAR'S PEN: ${N} drawings a level; * the start kit. "at rest": what goes on the car once the pen has rested; "long": by the longer rest of a drawing it is less sure of; ✓: when the player says "this is it"`);
console.table(ids.map((id) => {
  const I = out.items[id];
  return { id: (START.includes(id) ? '* ' : '  ') + id, cat: I.cat, lines: I.lines, 'whole on at rest %': pct(I.rest, I.n), neat: I.whole.neat, finger: I.whole.finger, rough: I.whole.rough, 'long (n/f/r)': `${I.long.neat} / ${I.long.finger} / ${I.long.rough}`, '✓ (n/f/r)': `${I.tick.neat} / ${I.tick.finger} / ${I.tick.rough}`, 'on as another %': pct(I.restOther, I.n), as: top3(I.took), '1 line on: rest / long %': `${pct(I.p1.rest, I.p1.n)} / ${pct(I.p1.long, I.p1.n)}`, '2 lines on: rest / long %': `${pct(I.p2.rest, I.p2.n)} / ${pct(I.p2.long, I.p2.n)}` };
}));
const sum = (I, f) => I.reduce((a, id) => a + f(out.items[id]), 0);
const tot = (I, name) => {
  I = I.filter((id) => out.items[id]);
  if (!I.length) return;
  const av = (o, k) => (I.reduce((a, id) => a + out.items[id][o][k], 0) / I.length).toFixed(1);
  console.log(`${name} (${I.length} things): whole drawings on at rest: neat ${av('whole', 'neat')}%, finger ${av('whole', 'finger')}%, rough ${av('whole', 'rough')}% · by the long rest: neat ${av('long', 'neat')}%, finger ${av('long', 'finger')}%, rough ${av('long', 'rough')}% · with ✓: neat ${av('tick', 'neat')}%, finger ${av('tick', 'finger')}%, rough ${av('tick', 'rough')}% · on as another thing ${pct(sum(I, (q) => q.restOther), sum(I, (q) => q.n))}% · unfinished, on at rest: 1 line ${pct(sum(I, (q) => q.p1.rest), sum(I, (q) => q.p1.n))}%, 2 lines ${pct(sum(I, (q) => q.p2.rest), sum(I, (q) => q.p2.n))}%, all ${pct(sum(I, (q) => q.part.rest), sum(I, (q) => q.part.n))}% · unfinished, on by the long rest: 1 line ${pct(sum(I, (q) => q.p1.long), sum(I, (q) => q.p1.n))}%, 2 lines ${pct(sum(I, (q) => q.p2.long), sum(I, (q) => q.p2.n))}%, all ${pct(sum(I, (q) => q.part.long), sum(I, (q) => q.part.n))}%`);
};
console.log('');
tot(START, 'THE START KIT');
tot(ids, 'EVERYTHING');
const kinds = {};
for (const id of ids) for (const [k, v] of Object.entries(out.items[id].part.by)) {
  const q = (kinds[k] = kinds[k] || { rest: 0, long: 0, n: 0 });
  q.rest += v.rest;
  q.long += v.long;
  q.n += v.n;
}
console.log('\nunfinished drawings, by kind:');
console.table(Object.entries(kinds).map(([k, v]) => ({ kind: k, n: v.n, 'on at rest %': pct(v.rest, v.n), 'on by the long rest %': pct(v.long, v.n) })));
console.log('drawings that are none of the category\'s things (on at rest / by the long rest):');
console.table(Object.entries(out.cats).map(([cat, C]) => ({ category: cat, "other categories' things %": `${pct(C.other, C.otherN)} / ${pct(C.otherL, C.otherN)}`, as: top3(C.by), 'doodles %': `${pct(C.doodle, C.doodleN)} / ${pct(C.doodleL, C.doodleN)}`, 'as ': top3(C.doodBy), 'random lines %': `${pct(C.lines, C.linesN)} / ${pct(C.linesL, C.linesN)}`, 'as  ': top3(C.linesBy) })));
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out));
