// Compares the player's drawing with a blueprint template.
// Point clouds -> soft chamfer matching (recall: is every part of the template drawn?
// precision: is every stroke of the player part of the template?) with a small alignment search.

const SIGMA = 3.4; // template units (template is ~100 wide)
const BINS = 8; // tangent orientation bins over [0, PI)
const CELL = 1;
const MARGIN = 18;

export function resample(pts, spacing) {
  if (pts.length === 0) return [];
  const out = [[pts[0][0], pts[0][1]]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    let ax = pts[i - 1][0];
    let ay = pts[i - 1][1];
    const bx = pts[i][0];
    const by = pts[i][1];
    let seg = Math.hypot(bx - ax, by - ay);
    while (carry + seg >= spacing) {
      const t = (spacing - carry) / seg;
      ax += (bx - ax) * t;
      ay += (by - ay) * t;
      out.push([ax, ay]);
      seg = Math.hypot(bx - ax, by - ay);
      carry = 0;
    }
    carry += seg;
  }
  const last = pts[pts.length - 1];
  const lo = out[out.length - 1];
  if (Math.hypot(last[0] - lo[0], last[1] - lo[1]) > spacing * 0.3) out.push([last[0], last[1]]);
  return out;
}

// Two-pass chamfer distance transform (weights 1 / sqrt2) on a grid seeded with points.
function distanceField(points, x0, y0, w, h) {
  const INF = 1e9;
  const d = new Float32Array(w * h).fill(INF);
  for (const [px, py] of points) {
    const gx = (px - x0) / CELL;
    const gy = (py - y0) / CELL;
    const ix = Math.round(gx);
    const iy = Math.round(gy);
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const cx = ix + ox;
        const cy = iy + oy;
        if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
        const v = Math.hypot(cx - gx, cy - gy);
        const k = cy * w + cx;
        if (v < d[k]) d[k] = v;
      }
    }
  }
  const S = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      let v = d[k];
      if (x > 0) v = Math.min(v, d[k - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[k - w] + 1);
        if (x > 0) v = Math.min(v, d[k - w - 1] + S);
        if (x < w - 1) v = Math.min(v, d[k - w + 1] + S);
      }
      d[k] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const k = y * w + x;
      let v = d[k];
      if (x < w - 1) v = Math.min(v, d[k + 1] + 1);
      if (y < h - 1) {
        v = Math.min(v, d[k + w] + 1);
        if (x < w - 1) v = Math.min(v, d[k + w + 1] + S);
        if (x > 0) v = Math.min(v, d[k + w - 1] + S);
      }
      d[k] = v;
    }
  }
  return { d, x0, y0, w, h };
}

function lookup(df, x, y) {
  const gx = (x - df.x0) / CELL;
  const gy = (y - df.y0) / CELL;
  if (gx < 0 || gy < 0 || gx > df.w - 1 || gy > df.h - 1) {
    // outside the field: distance to the border + border value
    const cx = Math.min(df.w - 1, Math.max(0, gx));
    const cy = Math.min(df.h - 1, Math.max(0, gy));
    return df.d[Math.round(cy) * df.w + Math.round(cx)] + Math.hypot(gx - cx, gy - cy) * CELL;
  }
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const ix1 = Math.min(df.w - 1, ix + 1);
  const iy1 = Math.min(df.h - 1, iy + 1);
  const a = df.d[iy * df.w + ix];
  const b = df.d[iy * df.w + ix1];
  const c = df.d[iy1 * df.w + ix];
  const e = df.d[iy1 * df.w + ix1];
  return ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy) * CELL;
}

// tangent orientation (mod PI) for each point of a resampled stroke
function orientations(pts) {
  const n = pts.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (ang < 0) ang += Math.PI;
    if (ang >= Math.PI) ang -= Math.PI;
    out[i] = n > 1 ? ang : -1;
  }
  return out;
}

function binOf(ang) {
  if (ang < 0) return -1;
  return Math.floor((ang / Math.PI) * BINS + 0.5) % BINS;
}

function orientedFields(pts, angs, x0, y0, w, h) {
  const bins = [];
  for (let b = 0; b < BINS; b++) bins.push([]);
  pts.forEach((p, i) => {
    const b = binOf(angs[i]);
    if (b < 0) for (let k = 0; k < BINS; k++) bins[k].push(p);
    else bins[b].push(p);
  });
  return bins.map((list) => (list.length ? distanceField(list, x0, y0, w, h) : null));
}

// distance to the nearest point with a similar tangent direction (+-1 bin)
function lookupOriented(fields, x, y, bin) {
  if (bin < 0) {
    let m = 1e9;
    for (const f of fields) if (f) m = Math.min(m, lookup(f, x, y));
    return m;
  }
  let m = 1e9;
  for (let k = -1; k <= 1; k++) {
    const f = fields[(bin + k + BINS) % BINS];
    if (!f) continue;
    const v = lookup(f, x, y) + (k === 0 ? 0 : 0.7);
    if (v < m) m = v;
  }
  return m;
}

const templateCache = new Map();

export function templateData(bp) {
  if (templateCache.has(bp.id)) return templateCache.get(bp.id);
  const pts = [];
  const owner = [];
  const angs = [];
  let ink = 0;
  bp.strokes.forEach((s, i) => {
    const r = resample(s.pts, 1.0);
    const a = orientations(r);
    r.forEach((p, k) => {
      pts.push(p);
      owner.push(i);
      angs.push(a[k]);
    });
    for (let k = 1; k < s.pts.length; k++) ink += Math.hypot(s.pts[k][0] - s.pts[k - 1][0], s.pts[k][1] - s.pts[k - 1][1]);
  });
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const gx0 = x0 - MARGIN;
  const gy0 = y0 - MARGIN;
  const w = Math.ceil((x1 - x0 + 2 * MARGIN) / CELL) + 1;
  const h = Math.ceil((y1 - y0 + 2 * MARGIN) / CELL) + 1;
  const df = distanceField(pts, gx0, gy0, w, h);
  const odf = orientedFields(pts, angs, gx0, gy0, w, h);
  const bins = angs.map(binOf);
  const data = { pts, owner, angs, bins, ink, bbox: { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }, df, odf, grid: { gx0, gy0, w, h } };
  templateCache.set(bp.id, data);
  return data;
}

function percentile(sorted, q) {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
  return sorted[i];
}

const soft = (d) => Math.exp(-(d * d) / (SIGMA * SIGMA));

/**
 * strokes: array of arrays of [x, y] (canvas pixels, y down)
 * returns { score, grade, raw, recall, precision, transform, aligned, partCoverage, missing }
 */
export function scoreDrawing(strokes, bp) {
  const T = templateData(bp);
  const valid = strokes.filter((s) => s.length > 0);
  let total = 0;
  for (const s of valid) for (let i = 1; i < s.length; i++) total += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
  const empty = { score: 0, grade: 'fail', raw: 0, recall: 0, precision: 0, transform: null, aligned: [], partCoverage: bp.strokes.map(() => 0), missing: bp.strokes.map((s) => s.label) };
  if (valid.length === 0 || total < 10) return empty;
  // player points (resampled)
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  for (const s of valid) for (const [x, y] of s) {
    bx0 = Math.min(bx0, x);
    by0 = Math.min(by0, y);
    bx1 = Math.max(bx1, x);
    by1 = Math.max(by1, y);
  }
  const diag = Math.hypot(bx1 - bx0, by1 - by0) || 1;
  const spacing = diag / 160;
  const P = [];
  const PA = [];
  const resampled = valid.map((s) => {
    const r = s.length === 1 ? [s[0]] : resample(s, spacing);
    const a = orientations(r);
    r.forEach((p, k) => {
      P.push(p);
      PA.push(a[k]);
    });
    return r;
  });
  if (P.length < 6) return empty;
  // robust bbox
  const xs = P.map((p) => p[0]).sort((a, b) => a - b);
  const ys = P.map((p) => p[1]).sort((a, b) => a - b);
  const px0 = percentile(xs, 0.01);
  const px1 = percentile(xs, 0.99);
  const py0 = percentile(ys, 0.01);
  const py1 = percentile(ys, 0.99);
  let pw = Math.max(1, px1 - px0);
  let ph = Math.max(1, py1 - py0);
  const tb = T.bbox;
  let sx = tb.w / pw;
  let sy = tb.h / ph;
  // degenerate drawings (a single line) must not be stretched to fit
  const ratio = pw / ph / (tb.w / tb.h);
  const lr = Math.abs(Math.log(ratio));
  if (lr > 1.2) {
    const s = Math.min(sx, sy);
    sx = s;
    sy = s;
  }
  const aspectPenalty = Math.max(0.45, Math.min(1, 1 - Math.max(0, lr - 0.28) * 0.7));
  const tx = tb.x0 - px0 * sx + (tb.w - pw * sx) * 0;
  const ty = tb.y0 - py0 * sy;
  // points in initial template space
  const P0 = P.map(([x, y]) => [x * sx + tx, y * sy + ty]);
  // orientations in template space (anisotropic scaling changes angles)
  const PB = PA.map((a) => (a < 0 ? -1 : binOf(((Math.atan2(Math.sin(a) * sy, Math.cos(a) * sx) % Math.PI) + Math.PI) % Math.PI)));
  // player distance fields in that space (same grid as the template)
  const g = T.grid;
  const pdfO = orientedFields(P0, PB.map((b) => (b < 0 ? -1 : (b / BINS) * Math.PI)), g.gx0, g.gy0, g.w, g.h);
  const cx = tb.x0 + tb.w / 2;
  const cy = tb.y0 + tb.h / 2;
  const evalR = (ksx, ksy, dx, dy) => {
    // forward transform R: p -> c + (p - c) * k + d
    let prec = 0;
    for (let i = 0; i < P0.length; i++) {
      const X = cx + (P0[i][0] - cx) * ksx + dx;
      const Y = cy + (P0[i][1] - cy) * ksy + dy;
      prec += soft(lookupOriented(T.odf, X, Y, PB[i]));
    }
    prec /= P0.length;
    let rec = 0;
    const kg = Math.sqrt(ksx * ksy);
    const tp = T.pts;
    for (let i = 0; i < tp.length; i++) {
      const X = cx + (tp[i][0] - dx - cx) / ksx;
      const Y = cy + (tp[i][1] - dy - cy) / ksy;
      rec += soft(lookupOriented(pdfO, X, Y, T.bins[i]) * kg);
    }
    rec /= tp.length;
    const f = prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0;
    return { f, prec, rec };
  };
  let best = { f: -1 };
  let bestK = [1, 1, 0, 0];
  for (const ksx of [0.88, 1, 1.12]) {
    for (const ksy of [0.88, 1, 1.12]) {
      for (const dx of [-8, -4, 0, 4, 8]) {
        for (const dy of [-6, -3, 0, 3, 6]) {
          const r = evalR(ksx, ksy, dx, dy);
          if (r.f > best.f) {
            best = r;
            bestK = [ksx, ksy, dx, dy];
          }
        }
      }
    }
  }
  const [k0, k1, d0, d1] = bestK;
  for (const a of [-0.04, 0, 0.04]) {
    for (const b of [-0.04, 0, 0.04]) {
      for (const c of [-1.5, 0, 1.5]) {
        for (const e of [-1.5, 0, 1.5]) {
          const r = evalR(k0 + a, k1 + b, d0 + c, d1 + e);
          if (r.f > best.f) {
            best = r;
            bestK = [k0 + a, k1 + b, d0 + c, d1 + e];
          }
        }
      }
    }
  }
  const [ksx, ksy, ddx, ddy] = bestK;
  const toTemplate = (x, y) => {
    const X0 = x * sx + tx;
    const Y0 = y * sy + ty;
    return [cx + (X0 - cx) * ksx + ddx, cy + (Y0 - cy) * ksy + ddy];
  };
  const aligned = resampled.map((s) => s.map(([x, y]) => toTemplate(x, y)));
  // per-part coverage (for the teacher's remarks)
  const alignedPts = [];
  for (const s of aligned) for (const p of s) alignedPts.push(p);
  const adf = distanceField(alignedPts, g.gx0, g.gy0, g.w, g.h);
  const cover = bp.strokes.map(() => [0, 0]);
  T.pts.forEach(([x, y], i) => {
    const c = cover[T.owner[i]];
    c[0] += soft(lookup(adf, x, y));
    c[1]++;
  });
  const partCoverage = cover.map(([a, n]) => (n ? a / n : 0));
  const missing = [];
  bp.strokes.forEach((s, i) => {
    if (partCoverage[i] < 0.38 && !missing.includes(s.label)) missing.push(s.label);
  });
  let ink = 0;
  for (const st of aligned) for (let i = 1; i < st.length; i++) ink += Math.hypot(st[i][0] - st[i - 1][0], st[i][1] - st[i - 1][1]);
  const inkRatio = ink / Math.max(1, T.ink);
  const inkPenalty = Math.max(0.5, Math.min(1, 1 - (inkRatio - 2.2) * 0.3));
  const raw = best.f * aspectPenalty * inkPenalty;
  // calibrated mapping (see tools/test-recognizer.mjs)
  const F0 = 0.22;
  const F1 = 0.95;
  const score = Math.round(Math.max(0, Math.min(1, (raw - F0) / (F1 - F0))) ** 0.9 * 100);
  return { score, grade: gradeOf(score), raw, recall: best.rec, precision: best.prec, transform: { sx, sy, tx, ty, ksx, ksy, ddx, ddy, cx, cy }, aligned, partCoverage, missing, toTemplate };
}

export function gradeOf(score) {
  if (score >= 85) return 'perfect';
  if (score >= 62) return 'good';
  if (score >= 38) return 'wonky';
  return 'fail';
}
