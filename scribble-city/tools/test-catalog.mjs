// The air drawing's catalog, one thing at a time (ui/freedraw.js readCatalog, game/catmatch.js): each thing of each shelf
// drawn as people draw it - its own lines, a hand's wobble, a part left out - and read as the game reads it, line by line
// as it is drawn and at the end; and drawings of other things altogether (a house, a sun, a scribble) read by each shelf.
// What it tells: how often each thing is read as itself; what it is taken for when it is not; and the things that light up
// for drawings that are not them - the owner's word: "things that keep popping up as if we tried to draw them".
// usage: node tools/test-catalog.mjs [samples per level] (MEMORY=1: and with the pen's memory of a few picks - drawmemory.js)
import { BLUEPRINTS } from '../v5/js/game/blueprints.js';
import { matchCatalog, shelfIds, SHELVES, tooEarly, drawnWhole, MATCH_MIN, PICK_SLACK } from '../v5/js/game/catmatch.js';
import { DrawMemory } from '../v5/js/game/drawmemory.js';

const N = +(process.argv[2] || 16);

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// how a hand copies a thing (tools/test-recognizer.mjs, its levels)
const LEVELS = {
  good: { jit: 1.0, sscale: 0.05, srot: 0.04, sshift: 1.5, drop: 0, gsx: 0.1 },
  okay: { jit: 1.6, sscale: 0.1, srot: 0.07, sshift: 3.0, drop: 0.05, gsx: 0.15 },
  sloppy: { jit: 2.4, sscale: 0.16, srot: 0.12, sshift: 5.0, drop: 0.18, gsx: 0.2 },
};

function humanCopy(bp, lv, rnd) {
  const r = (a, b) => a + (b - a) * rnd();
  const P = LEVELS[lv];
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
  return strokes;
}

// drawings of other things altogether: each a list of lines, [[x, y], ...], y down
const arc = (cx, cy, rx, ry, a0, a1, n = 40) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / n;
  return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
});
const poly = (...p) => p;
const DOODLES = {
  circle: () => [arc(100, 100, 60, 60, 0, Math.PI * 2)],
  square: () => [poly([40, 40], [160, 40], [160, 160], [40, 160], [40, 40])],
  triangle: () => [poly([100, 30], [170, 160], [30, 160], [100, 30])],
  star: () => [poly(...Array.from({ length: 11 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; const R = i % 2 ? 28 : 70; return [100 + Math.cos(a) * R, 100 + Math.sin(a) * R]; }))],
  heart: () => [[...arc(75, 80, 25, 25, Math.PI, Math.PI * 2, 16), ...arc(125, 80, 25, 25, Math.PI, Math.PI * 2, 16), [100, 150], [50, 80]]],
  house: () => [poly([40, 90], [160, 90], [160, 180], [40, 180], [40, 90]), poly([30, 95], [100, 30], [170, 95]), poly([85, 180], [85, 130], [115, 130], [115, 180])],
  tree: () => [poly([90, 190], [90, 110]), poly([110, 190], [110, 110]), arc(100, 80, 55, 45, 0, Math.PI * 2)],
  sun: () => [arc(100, 100, 35, 35, 0, Math.PI * 2), ...Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return [[100 + Math.cos(a) * 45, 100 + Math.sin(a) * 45], [100 + Math.cos(a) * 70, 100 + Math.sin(a) * 70]]; })],
  stickman: () => [arc(100, 40, 16, 16, 0, Math.PI * 2), poly([100, 56], [100, 120]), poly([70, 80], [130, 80]), poly([100, 120], [75, 170]), poly([100, 120], [125, 170])],
  smiley: () => [arc(100, 100, 60, 60, 0, Math.PI * 2), arc(80, 85, 5, 5, 0, Math.PI * 2, 10), arc(120, 85, 5, 5, 0, Math.PI * 2, 10), arc(100, 110, 28, 20, 0.2, Math.PI - 0.2, 16)],
  flower: () => [arc(100, 70, 14, 14, 0, Math.PI * 2), ...Array.from({ length: 5 }, (_, i) => { const a = (i * 2 * Math.PI) / 5; return arc(100 + Math.cos(a) * 26, 70 + Math.sin(a) * 26, 12, 12, 0, Math.PI * 2, 16); }), poly([100, 84], [100, 190])],
  fish: () => [arc(100, 100, 55, 28, 0, Math.PI * 2), poly([150, 100], [185, 75], [185, 125], [150, 100])],
  cat: () => [arc(100, 110, 50, 40, 0, Math.PI * 2), poly([62, 85], [70, 45], [90, 72]), poly([110, 72], [130, 45], [138, 85])],
  cup: () => [poly([60, 60], [70, 160], [130, 160], [140, 60]), arc(150, 105, 18, 25, -Math.PI / 2, Math.PI / 2, 12)],
  line: () => [poly([20, 100], [200, 105])],
  twolines: () => [poly([20, 80], [200, 85]), poly([20, 120], [200, 125])],
  cross: () => [poly([40, 40], [160, 160]), poly([160, 40], [40, 160])],
  zigzag: () => [poly([20, 100], [50, 60], [80, 100], [110, 60], [140, 100], [170, 60], [200, 100])],
  spiral: () => [Array.from({ length: 80 }, (_, i) => { const a = i * 0.25; const R = 4 + i * 0.9; return [100 + Math.cos(a) * R, 100 + Math.sin(a) * R]; })],
  letterA: () => [poly([40, 170], [100, 30], [160, 170]), poly([65, 110], [135, 110])],
  arrow: () => [poly([20, 100], [180, 100]), poly([150, 70], [180, 100], [150, 130])],
  boxes: () => [poly([20, 60], [90, 60], [90, 130], [20, 130], [20, 60]), poly([110, 60], [180, 60], [180, 130], [110, 130], [110, 60])],
};
function scribble(rnd) {
  const pts = [];
  let x = 100;
  let y = 100;
  for (let i = 0; i < 120; i++) {
    x = Math.max(10, Math.min(200, x + (rnd() - 0.5) * 50));
    y = Math.max(10, Math.min(200, y + (rnd() - 0.5) * 50));
    pts.push([x, y]);
  }
  return [pts];
}
// (a doodle as a hand draws it: densified, wobbled, its size and place anywhere)
function hand(lines, rnd) {
  const s = 1 + (rnd() - 0.5) * 0.6;
  const ox = rnd() * 200;
  const oy = rnd() * 100;
  return lines.map((L) => {
    const out = [];
    for (let i = 0; i < L.length - 1; i++) {
      const a = L[i];
      const b = L[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        out.push([ox + (a[0] + (b[0] - a[0]) * t) * s + (rnd() - 0.5) * 3, oy + (a[1] + (b[1] - a[1]) * t) * s + (rnd() - 0.5) * 3]);
      }
    }
    const e = L[L.length - 1];
    out.push([ox + e[0] * s, oy + e[1] * s]);
    return out;
  });
}

// what the game says of a drawing, as ui/freedraw.js readCatalog does (no pick in the legend): the thing lit (null: none
// yet), and whether it would be made
function readAs(lines, ids, memory = null) {
  const strokes = lines.map((p) => ({ p }));
  const all = matchCatalog(strokes, ids);
  if (!all) return { lit: null };
  const top = all.best;
  let pick = null;
  let fromMemory = false;
  if (memory) {
    const m = memory.match(memory.signature(strokes));
    if (m && ids.includes(m.key)) {
      pick = m.key;
      fromMemory = true;
    }
  }
  // (as freedraw.js: the memory's pick only while the catalog says it may be it)
  if (pick && pick !== top.id) {
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
