import { toUV } from './fusedraw.js';
import { shapeOf } from './fusemark.js';
import { hull, inPoly } from './drawncar.js';
import { clamp } from '../core/util.js';

// (ROADMAP 11.26) The thing drawn is the thing on the car. Which of the category's things a drawing
// is (game/partnet.js) says what it does; what it looks like is the drawing itself - its own lines, as
// big as they were drawn by the car on the screen, set where such a thing goes and turned the way
// such a thing points: a cannon's barrel to the nose, a wing out of the side, a flame out of the
// back, a balloon over the roof standing as it was drawn. Each closed line of it is moulded into a
// solid of its own (game/inflate.js), the open lines round it into one if they have a breadth
// between them, else each a rod or a strip; the lines inked on them as they were drawn
// (game/fusedraw.js buildLook).
//
// A drawing here: lines of [x, y] in metres (x to the right on the screen, y up it - game/partpen.js
// metresOf). Its box: B { x0, x1, y0, y1, cx, cy, w, h }. Each thing's frame: its plane (game/fusedraw.js
// AX: square to the car's x, y or z, at c), where a point of the drawing goes on the car (P), what it
// turns or spins round (pivot).

const r2 = (q) => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000];
const r3 = (q) => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000, Math.round(q[2] * 1000) / 1000];

// the numbers of a car that say where things go on it (ctx: game/fuse.js drawCtx)
function carNums(ctx) {
  const D = ctx.D;
  const K = ctx.K;
  const roof = K ? K.roofY : D.h;
  const clear = K ? K.clear : 0.25;
  const hood = K && K.hood ? K.hood : null;
  return {
    D,
    roof,
    clear,
    mid: clamp(roof * 0.55, 0.45, roof - 0.1),
    hoodY: hood ? hood.y : D.h * 0.55,
    hoodZ: hood ? hood.z : D.hl * 0.6,
    noseY: clear + 0.3,
    tailY: Math.max(0.45, clear + 0.3),
    sill: clear + 0.14,
    propY: Math.max(0.3, clear + 0.05),
  };
}

// each thing: how its lines are made solid - W (how thick a closed line of it is, by its short side,
// m), open ('rod' | 'band': an open line not inside a closed one), r (a rod's radius), bw, bW (a strip's
// half width, its thickness), fill (open lines with a breadth between them: one solid round them all) -
// what it does as a model (role: game/fuse.js draw), metal; and its frame (B, C: carNums, o: { flip
// (a gun's muzzle: 1 to the right on the screen, -1 to the left), side (the drawing to the right of the
// car on the screen: 1, else -1) })
export const LOOKS = {
  cannon: {
    W: (s) => clamp(s * 0.8, 0.1, 0.5), open: 'rod', r: 0.05, fill: true, role: 'barrel', metal: true,
    // (its side as drawn, along the car on its roof, the muzzle to the nose: a turret that turns)
    frame: (B, C, o) => ({ ax: 'x', c: 0, P: (x, y) => [0, C.roof - 0.03 + (y - B.y0), -0.15 + o.flip * (x - B.cx)], pivot: [0, C.roof - 0.03, -0.15] }),
  },
  mg: {
    W: (s) => clamp(s * 0.8, 0.06, 0.3), open: 'rod', r: 0.035, fill: true, role: 'barrel', metal: true,
    // (its side as drawn, on the hood: its stock at the windscreen, the muzzle out to the front)
    frame: (B, C, o) => {
      const back = o.flip > 0 ? B.x0 : B.x1;
      const z0 = C.hoodZ - 0.4;
      return { ax: 'x', c: 0, P: (x, y) => [0, C.hoodY - 0.02 + (y - B.y0), z0 + o.flip * (x - back)], pivot: [0, C.hoodY - 0.02, z0 + 0.15] };
    },
  },
  flamer: {
    W: (s) => clamp(s * 0.5, 0.15, 0.6), open: 'band', bw: 0.07, bW: 0.12, fill: true, role: 'jet',
    // (flat out of the nose, its tip to the front)
    frame: (B, C) => ({ ax: 'y', c: C.noseY, P: (x, y) => [-(x - B.cx), C.noseY, C.D.hl + 0.02 + (y - B.y0)], pivot: [0, C.noseY, C.D.hl + 0.02] }),
  },
  bolt: {
    W: () => 0.12, open: 'band', bw: 0.07, bW: 0.1, fill: false,
    // (upright on the roof, as drawn)
    frame: (B, C) => ({ ax: 'z', c: -0.15, P: (x, y) => [-(x - B.cx), C.roof - 0.02 + (y - B.y0), -0.15], pivot: [0, C.roof - 0.02, -0.15] }),
  },
  blades: {
    W: () => 0.06, open: 'band', bw: 0.05, bW: 0.05, fill: true, mirror: true,
    // (flat out of both sides, low - its hilt at the car, its point out)
    frame: (B, C) => ({ ax: 'y', c: C.sill, P: (x, y) => [C.D.hw + 0.02 + (y - B.y0), C.sill, -0.2 + (x - B.cx)], pivot: [C.D.hw + 0.02, C.sill, -0.2] }),
  },
  wing: {
    W: (s) => clamp(s * 0.12, 0.05, 0.14), open: 'band', bw: 0.16, bW: 0.08, fill: true, flat: true, mirror: true,
    // (flat out of both sides at the doors: from its edge nearer the car out, up the screen to the nose)
    frame: (B, C, o) => {
      const root = o.side > 0 ? B.x0 : B.x1;
      return { ax: 'y', c: C.mid, P: (x, y) => [C.D.hw - 0.06 + Math.abs(x - root), C.mid, -0.1 + (y - B.cy)], pivot: [C.D.hw - 0.06, C.mid, -0.1] };
    },
  },
  balloon: {
    W: (s) => clamp(s * 0.85, 0.25, 5), open: 'rod', r: 0.025, fill: true, role: 'dballoon',
    // (standing over the roof as drawn, on its string)
    frame: (B, C) => ({ ax: 'z', c: 0, P: (x, y) => [-(x - B.cx), C.roof + 0.45 + (y - B.y0), 0], pivot: [0, C.roof + 0.45 + B.h / 2, 0], string: [0, C.roof, 0] }),
  },
  rotor: {
    W: () => 0.05, open: 'band', bw: 0.09, bW: 0.05, fill: false, role: 'rotor',
    // (seen from over it as it was drawn, over the roof on its mast)
    frame: (B, C) => ({ ax: 'y', c: C.roof + 0.3, P: (x, y) => [-(x - B.cx), C.roof + 0.3, y - B.cy], pivot: [0, C.roof + 0.3, 0], mast: [0, C.roof - 0.02, 0] }),
  },
  prop: {
    W: () => 0.07, open: 'band', bw: 0.08, bW: 0.06, fill: false, role: 'prop',
    // (behind the tail, low, facing back as drawn - turning round its middle)
    frame: (B, C) => {
      const yc = Math.max(C.propY, B.h / 2 + 0.05);
      const z = -C.D.hl - 0.1;
      return { ax: 'z', c: z, P: (x, y) => [-(x - B.cx), yc + (y - B.cy), z], pivot: [0, yc, z] };
    },
  },
  jet: {
    W: (s) => clamp(s * 0.5, 0.15, 0.6), open: 'band', bw: 0.07, bW: 0.12, fill: true, role: 'jet',
    // (flat out of the back, its tip behind)
    frame: (B, C) => ({ ax: 'y', c: C.tailY, P: (x, y) => [-(x - B.cx), C.tailY, -C.D.hl - 0.02 - (y - B.y0)], pivot: [0, C.tailY, -C.D.hl - 0.02] }),
  },
  spring: {
    W: () => 0.08, open: 'rod', r: 0.045, fill: false, role: 'dspring',
    // (under the car from its floor down, as drawn - squeezed in under it till it springs)
    frame: (B, C) => ({ ax: 'z', c: 0, P: (x, y) => [-(x - B.cx), C.clear + (y - B.y1), 0], pivot: [0, C.clear, 0], rest: clamp((C.clear - 0.03) / Math.max(0.05, B.h), 0.12, 1) }),
  },
  chute: {
    W: () => 0.06, open: 'band', bw: 0.07, bW: 0.06, fill: false, strings: true, role: 'dchute',
    // (standing on the roof as drawn - folded on it till it falls)
    frame: (B, C) => ({ ax: 'z', c: 0.1, P: (x, y) => [-(x - B.cx), C.roof - 0.02 + (y - B.y0), 0.1], pivot: [0, C.roof - 0.02, 0.1] }),
  },
  armor: {
    W: () => 0.09, open: 'band', bw: 0.05, bW: 0.07, fill: true, flat: true, mirror: true,
    // (a plate on each side, upright along it, as drawn)
    frame: (B, C) => {
      const yc = Math.max((C.clear + C.roof) * 0.5, B.h / 2 + 0.08);
      return { ax: 'x', c: C.D.hw + 0.04, P: (x, y) => [C.D.hw + 0.04, yc + (y - B.cy), x - B.cx], pivot: [C.D.hw + 0.04, yc, 0] };
    },
  },
  ram: {
    W: (s) => clamp(0.22 + s * 0.08, 0.22, 0.45), open: 'band', bw: 0.08, bW: 0.2, fill: true, flat: true,
    // (flat at the nose, low - its point to the front)
    frame: (B, C) => ({ ax: 'y', c: C.clear + 0.15, P: (x, y) => [-(x - B.cx), C.clear + 0.15, C.D.hl - 0.05 + (y - B.y0)], pivot: [0, C.clear + 0.15, C.D.hl - 0.05] }),
  },
  star: {
    W: () => 0.12, open: 'band', bw: 0.06, bW: 0.1, fill: false, role: 'star',
    // (upright on the roof as drawn, spinning round its middle)
    frame: (B, C) => ({ ax: 'z', c: -0.1, P: (x, y) => [-(x - B.cx), C.roof + 0.04 + (y - B.y0), -0.1], pivot: [0, C.roof + 0.04 + B.h / 2, -0.1] }),
  },
  smoke: {
    W: (s) => clamp(s * 0.6, 0.25, 1), open: 'band', bw: 0.1, bW: 0.2, fill: true,
    // (on its back, facing back as drawn)
    frame: (B, C) => ({ ax: 'z', c: -C.D.hl - 0.12, P: (x, y) => [-(x - B.cx), C.tailY - 0.12 + (y - B.y0), -C.D.hl - 0.12], pivot: [0, C.tailY - 0.12, -C.D.hl - 0.12] }),
  },
  spikes: {
    W: () => 0.06, open: 'band', bw: 0.05, bW: 0.06, fill: false, mirror: true,
    // (flat along both sides, low, their points out)
    frame: (B, C) => ({ ax: 'y', c: C.sill, P: (x, y) => [C.D.hw + 0.02 + (y - B.y0), C.sill, x - B.cx], pivot: [C.D.hw + 0.02, C.sill, 0] }),
  },
};

function boxOfLines(lines) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const L of lines) {
    for (const [x, y] of L) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}

// at most n points along a line
function thinTo(L, n) {
  if (L.length <= n) return L;
  const out = [];
  for (let i = 0; i < n; i++) out.push(L[Math.round((i * (L.length - 1)) / (n - 1))]);
  return out;
}

// a closed line made into a strip round an open one (half as wide as h)
function band(L, h) {
  if (L.length < 2) return null;
  const left = [];
  const right = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[Math.max(0, i - 1)];
    const b = L[Math.min(L.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const k = h * (i === 0 || i === L.length - 1 ? 0.7 : 1);
    left.push([L[i][0] - (dy / l) * k, L[i][1] + (dx / l) * k]);
    right.push([L[i][0] + (dy / l) * k, L[i][1] - (dx / l) * k]);
  }
  return left.concat(right.reverse());
}

// ------------------------------------------------------------------ what loose lines shut in
// the outline a few loose lines make together, as an eye closes them: drawn thick into a grid (gaps
// a little narrower than that closed), what they shut in filled, and pulled back in to the lines
// themselves. Lines that shut nothing in (a scribble, a zigzag): null. Else its outlines (on the
// plane, m), the biggest first
const DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DY = [0, 1, 1, 1, 0, -1, -1, -1];

function shutIn(lines) {
  const b = boxOfLines(lines);
  const long = Math.max(b.w, b.h, 1e-3);
  const N = 72;
  const cs = long / N;
  // (closing gaps of up to about 8% of its size)
  const R = clamp(Math.round((long * 0.04) / cs), 2, 4);
  const pad = R + 3;
  const W = Math.ceil(b.w / cs) + pad * 2 + 1;
  const H = Math.ceil(b.h / cs) + pad * 2 + 1;
  const ink = new Uint8Array(W * H);
  const gx = (u) => (u - b.x0) / cs + pad;
  const gy = (w) => (w - b.y0) / cs + pad;
  for (const L of lines) {
    for (let i = 0; i < L.length; i++) {
      const a = L[Math.max(0, i - 1)];
      const c = L[i];
      const n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / (cs * 0.5)));
      for (let k = 0; k <= n; k++) {
        const x = gx(a[0] + ((c[0] - a[0]) * k) / n);
        const y = gy(a[1] + ((c[1] - a[1]) * k) / n);
        for (let yy = Math.floor(y - R); yy <= Math.ceil(y + R); yy++) {
          for (let xx = Math.floor(x - R); xx <= Math.ceil(x + R); xx++) {
            if (xx < 0 || yy < 0 || xx >= W || yy >= H || (xx - x) ** 2 + (yy - y) ** 2 > R * R) continue;
            ink[yy * W + xx] = 1;
          }
        }
      }
    }
  }
  // (outside: all that is reached from the border without crossing the ink; the distance in from it)
  const dist = new Int16Array(W * H).fill(-1);
  const q = new Int32Array(W * H);
  let qh = 0;
  let qt = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && !ink[y * W + x] && dist[y * W + x] < 0) {
        dist[y * W + x] = 0;
        q[qt++] = y * W + x;
      }
    }
  }
  while (qh < qt) {
    const i = q[qh++];
    const x = i % W;
    const y = (i - x) / W;
    for (let d = 0; d < 8; d += 2) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (dist[j] >= 0 || ink[j]) continue;
      dist[j] = 0;
      q[qt++] = j;
    }
  }
  let inkN = 0;
  let inN = 0;
  for (let i = 0; i < W * H; i++) {
    if (ink[i]) inkN++;
    if (dist[i] < 0) inN++;
  }
  // (nothing much shut in: lines, not an outline)
  if (inN < inkN * 1.35) return null;
  // (in from the outside, step by step - what is at least R in is the shape, back to its lines)
  qh = 0;
  qt = 0;
  for (let i = 0; i < W * H; i++) if (dist[i] === 0) q[qt++] = i;
  while (qh < qt) {
    const i = q[qh++];
    const x = i % W;
    const y = (i - x) / W;
    for (let d = 0; d < 8; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (dist[j] >= 0) continue;
      dist[j] = dist[i] + 1;
      q[qt++] = j;
    }
  }
  const m = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (dist[i] >= R) m[i] = 1;
  // its pieces, each traced round (Moore's way), the small ones left out
  const seen = new Uint8Array(W * H);
  const parts = [];
  for (let i = 0; i < W * H; i++) {
    if (!m[i] || seen[i]) continue;
    let area = 0;
    qh = 0;
    qt = 0;
    q[qt++] = i;
    seen[i] = 1;
    let first = i;
    while (qh < qt) {
      const j = q[qh++];
      area++;
      if (j < first) first = j;
      const x = j % W;
      const y = (j - x) / W;
      for (let d = 0; d < 8; d += 2) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = ny * W + nx;
        if (!m[k] || seen[k]) continue;
        seen[k] = 1;
        q[qt++] = k;
      }
    }
    parts.push({ area, first });
  }
  if (!parts.length) return null;
  parts.sort((a, c) => c.area - a.area);
  const out = [];
  for (const P of parts) {
    if (P.area < Math.max(6, parts[0].area * 0.06)) break;
    const sx = P.first % W;
    const sy = (P.first - sx) / W;
    const pts = [];
    let x = sx;
    let y = sy;
    let back = 4;
    let firstMove = -1;
    for (let n = 0; n < W * H; n++) {
      let found = -1;
      for (let k = 1; k <= 8; k++) {
        const d = (back + k) % 8;
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && m[ny * W + nx]) {
          found = d;
          break;
        }
      }
      if (found < 0) break;
      if (n > 0 && x === sx && y === sy && found === firstMove) break;
      if (n === 0) firstMove = found;
      pts.push([x, y]);
      x += DX[found];
      y += DY[found];
      back = (found + 5) % 8;
    }
    if (pts.length < 6) continue;
    // (back to the plane, every other step, softened)
    const step = pts.length > 160 ? 3 : 2;
    const ol = [];
    for (let k = 0; k < pts.length; k += step) {
      const a = pts[(k - 1 + pts.length) % pts.length];
      const c = pts[k];
      const d = pts[(k + 1) % pts.length];
      const px = (a[0] + c[0] * 2 + d[0]) / 4;
      const py = (a[1] + c[1] * 2 + d[1]) / 4;
      ol.push([b.x0 + (px - pad) * cs, b.y0 + (py - pad) * cs]);
    }
    out.push(ol);
  }
  return out.length ? out : null;
}

// (a gun drawn side on) which end its muzzle is: the end of it thinner up and down - the barrel
// there, the grip, the stock, the wheel at the other. 1: the right on the screen
export function muzzleSide(lines, B = boxOfLines(lines)) {
  const third = B.w / 3;
  const span = (lo, hi) => {
    let a = Infinity;
    let b = -Infinity;
    for (const L of lines) {
      for (const [x, y] of L) {
        if (x < lo || x > hi) continue;
        a = Math.min(a, y);
        b = Math.max(b, y);
      }
    }
    return b > a ? b - a : 0;
  };
  const left = span(B.x0, B.x0 + third);
  const right = span(B.x1 - third, B.x1);
  return right <= left * 1.08 ? 1 : -1;
}

// the drawing (M: lines in metres, x right, y up) as the thing it was read as (id), on a car (ctx:
// game/fuse.js drawCtx). o: { flip, side } (else from the drawing). Returns { shape (for
// game/fusedraw.js buildLook), at (where it holds on the car), P3 (each point of each line, where it
// goes on the car - the ink flies there), mirror } - or null
export function lookOf(id, M, ctx, o = {}) {
  const S = LOOKS[id];
  if (!S) return null;
  const lines = M.filter((L) => L && L.length >= 2);
  if (!lines.length) return null;
  const B = boxOfLines(lines);
  const C = carNums(ctx);
  const flip = o.flip || (S.role === 'barrel' ? muzzleSide(lines, B) : 1);
  const side = o.side || 1;
  const F = S.frame(B, C, { flip, side });
  const P3 = lines.map((L) => L.map(([x, y]) => F.P(x, y)));
  const uv = P3.map((L) => L.map((X) => r2(toUV(X, F.ax))));
  // each line on its plane: closed or open, its box (by its shape as px at 200 a metre, as
  // game/fusedraw.js partOf reads one)
  const info = uv.map((L) => {
    const s = shapeOf(L.map(([u, w]) => [u * 200, -w * 200]));
    const b = boxOfLines([L]);
    return { L, closed: s.closed && L.length >= 4, short: Math.min(b.w, b.h), long: Math.max(b.w, b.h) };
  });
  const solids = [];
  const rods = [];
  for (const it of info) {
    if (!it.closed) continue;
    solids.push({ ol: thinTo(it.L, 110), W: S.W(it.short), ink: [thinTo(it.L, 56)], long: it.long });
  }
  // the open lines: on a closed one's face (inside it), inked there; the rest
  const loose = [];
  for (const it of info) {
    if (it.closed) continue;
    let home = null;
    for (const s of solids) {
      const inside = it.L.filter(([u, w]) => inPoly(u, w, s.ol)).length;
      if (inside >= it.L.length * 0.7 && (!home || s.long < home.long)) home = s;
    }
    if (home) home.ink.push(thinTo(it.L, 56));
    else loose.push(it);
  }
  // (with a breadth between them - a wing's two edges, a cloud scribbled, a balloon not closed: what
  // they shut in, as an eye closes them; lines shutting nothing in, round them all)
  if (loose.length && S.fill) {
    let all = [];
    for (const it of loose) all = all.concat(it.L);
    const b = boxOfLines(loose.map((it) => it.L));
    const short = Math.min(b.w, b.h);
    const long = Math.max(b.w, b.h);
    const shut = all.length >= 8 ? shutIn(loose.map((it) => it.L)) : null;
    if (shut) {
      // (each line on the shape it is the edge of; one sticking out of them all, a rod)
      const homes = shut.map((ol) => {
        const ob = boxOfLines([ol]);
        return { ol: thinTo(ol, 110), W: S.W(Math.min(ob.w, ob.h)), ink: [], long: Math.max(ob.w, ob.h) };
      });
      const near = (u, w, ol) => {
        if (inPoly(u, w, ol)) return true;
        const tol = long * 0.06;
        for (let i = 0, j = ol.length - 1; i < ol.length; j = i++) {
          const [ax, ay] = ol[j];
          const [bx, by] = ol[i];
          const dx = bx - ax;
          const dy = by - ay;
          const l2 = dx * dx + dy * dy || 1e-9;
          const t = clamp(((u - ax) * dx + (w - ay) * dy) / l2, 0, 1);
          if (Math.hypot(u - ax - dx * t, w - ay - dy * t) < tol) return true;
        }
        return false;
      };
      const left = [];
      for (const it of loose) {
        let best = null;
        let bn = 0;
        for (const h of homes) {
          const n = it.L.filter(([u, w]) => near(u, w, h.ol)).length;
          if (n > bn) {
            bn = n;
            best = h;
          }
        }
        if (best && bn >= it.L.length * 0.6) best.ink.push(thinTo(it.L, 56));
        else left.push(it);
      }
      for (const h of homes) solids.push(h);
      loose.length = 0;
      loose.push(...left);
    } else if (all.length >= 8 && short >= long * 0.08) {
      solids.push({ ol: thinTo(hull(all), 110), W: S.W(short), ink: loose.map((it) => thinTo(it.L, 56)), long });
      loose.length = 0;
    }
  }
  // (a parachute's canopy: its longest open line a sheet; the rest its strings)
  let longest = null;
  if (S.strings) for (const it of loose) if (!longest || it.long > longest.long) longest = it;
  for (const it of loose) {
    if (S.open === 'band' && !(S.strings && it !== longest)) {
      const ol = band(it.L, S.bw);
      if (ol) solids.push({ ol: thinTo(ol, 110).map(r2), W: S.bW, ink: [thinTo(it.L, 56)], long: it.long });
    } else rods.push({ L: thinTo(it.L, 48), r: S.strings ? 0.02 : S.r });
  }
  if (!solids.length && !rods.length) return null;
  const shape = {
    look: 1,
    ax: F.ax,
    c: Math.round(F.c * 1000) / 1000,
    solids: solids.map((s) => ({ ol: s.ol.map(r2), W: Math.round(s.W * 1000) / 1000, ink: s.ink.map((L) => L.map(r2)) })),
    rods: rods.map((r) => ({ L: r.L.map(r2), r: r.r })),
    pivot: r3(F.pivot),
    mirror: !!S.mirror,
    role: S.role || 'drawn',
    metal: !!S.metal,
  };
  if (F.string) shape.string = r3(F.string);
  if (F.mast) shape.mast = r3(F.mast);
  if (F.rest) shape.rest = Math.round(F.rest * 1000) / 1000;
  if (S.role === 'barrel') {
    // (its muzzle: the end of it to the nose - the middle of what is drawn there)
    let zmax = -Infinity;
    for (const L of P3) for (const X of L) zmax = Math.max(zmax, X[2]);
    let n = 0;
    let y = 0;
    for (const L of P3) {
      for (const X of L) {
        if (X[2] < zmax - B.w * 0.06) continue;
        y += X[1];
        n++;
      }
    }
    shape.muzzle = r3([0, y / Math.max(1, n), zmax]);
  }
  return { shape, at: r3(F.pivot), P3, mirror: !!S.mirror, flip, side };
}
