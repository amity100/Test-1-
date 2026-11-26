// The lines of a small svg picture (the inside of an <svg>: paths, circles, rects), as lists of points - what a hand
// copies when it draws a thing of the car's pen from its picture in the legend (game/itemcat.js icon). By arithmetic
// alone - no browser (game/buildtray.js iconLines asks the browser; the pen's reading, game/partnet.js, and its tests,
// tools/test-partpen.mjs, read the same lines here).
// Paths: M L H V C Q A Z (and their small letters); a circle, an ellipse, a rect (rounded or not, turned or not).
// Each line begun with a move is a line of its own.

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function cubic(p0, p1, p2, p3, n = 16) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const a = lerp(lerp(p0, p1, t), lerp(p1, p2, t), t);
    const b = lerp(lerp(p1, p2, t), lerp(p2, p3, t), t);
    out.push(lerp(a, b, t));
  }
  return out;
}

function quad(p0, p1, p2, n = 12) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push(lerp(lerp(p0, p1, t), lerp(p1, p2, t), t));
  }
  return out;
}

// an arc of an ellipse from p0 to p1 (the svg way of saying it), as points
function arc(p0, rx, ry, rot, large, sweep, p1, n = 20) {
  if (!rx || !ry) return [p1];
  const ph = (rot * Math.PI) / 180;
  const c = Math.cos(ph);
  const s = Math.sin(ph);
  const dx = (p0[0] - p1[0]) / 2;
  const dy = (p0[1] - p1[1]) / 2;
  const x1 = c * dx + s * dy;
  const y1 = -s * dx + c * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = Math.max(0, rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1);
  const k = (large !== sweep ? 1 : -1) * Math.sqrt(num / (rx * rx * y1 * y1 + ry * ry * x1 * x1 || 1));
  const cx1 = (k * rx * y1) / ry;
  const cy1 = (-k * ry * x1) / rx;
  const cx = c * cx1 - s * cy1 + (p0[0] + p1[0]) / 2;
  const cy = s * cx1 + c * cy1 + (p0[1] + p1[1]) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const a0 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let da = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && da > 0) da -= Math.PI * 2;
  if (sweep && da < 0) da += Math.PI * 2;
  const out = [];
  for (let i = 1; i <= n; i++) {
    const a = a0 + (da * i) / n;
    out.push([cx + c * rx * Math.cos(a) - s * ry * Math.sin(a), cy + s * rx * Math.cos(a) + c * ry * Math.sin(a)]);
  }
  return out;
}

export function pathLines(d) {
  const tok = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const out = [];
  let cur = null;
  let p = [0, 0];
  let start = [0, 0];
  let i = 0;
  let cmd = '';
  const num = () => +tok[i++];
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase();
    const at = (x, y) => (rel ? [p[0] + x, p[1] + y] : [x, y]);
    switch (cmd.toUpperCase()) {
      case 'M':
        p = at(num(), num());
        start = p;
        cur = [p];
        out.push(cur);
        // (more pairs after a move are lines)
        cmd = rel ? 'l' : 'L';
        break;
      case 'L':
        p = at(num(), num());
        cur.push(p);
        break;
      case 'H':
        p = rel ? [p[0] + num(), p[1]] : [num(), p[1]];
        cur.push(p);
        break;
      case 'V':
        p = rel ? [p[0], p[1] + num()] : [p[0], num()];
        cur.push(p);
        break;
      case 'C': {
        const a = at(num(), num());
        const b = at(num(), num());
        const e = at(num(), num());
        cur.push(...cubic(p, a, b, e));
        p = e;
        break;
      }
      case 'Q': {
        const a = at(num(), num());
        const e = at(num(), num());
        cur.push(...quad(p, a, e));
        p = e;
        break;
      }
      case 'A': {
        const rx = num();
        const ry = num();
        const rot = num();
        const large = num();
        const sweep = num();
        const e = at(num(), num());
        cur.push(...arc(p, rx, ry, rot, !!large, !!sweep, e));
        p = e;
        break;
      }
      case 'Z':
        cur.push(start);
        p = start;
        // (what comes after a close with no move: a new line from there)
        cur = [p];
        out.push(cur);
        break;
      default:
        i++;
    }
  }
  return out.filter((L) => L.length > 1);
}

const attr = (tag, k, d = 0) => {
  const m = new RegExp(`\\b${k}="([^"]*)"`).exec(tag);
  return m ? +m[1] : d;
};

// the inside of an <svg> as lines: [[[x, y], ...], ...]
export function svgLines(inner) {
  const out = [];
  for (const m of inner.matchAll(/<(path|circle|ellipse|rect)\b[^>]*>/g)) {
    const tag = m[0];
    let L = [];
    if (m[1] === 'path') {
      const d = /\bd="([^"]*)"/.exec(tag);
      if (d) L = pathLines(d[1]);
    } else if (m[1] === 'circle' || m[1] === 'ellipse') {
      const cx = attr(tag, 'cx');
      const cy = attr(tag, 'cy');
      const rx = m[1] === 'circle' ? attr(tag, 'r') : attr(tag, 'rx');
      const ry = m[1] === 'circle' ? rx : attr(tag, 'ry');
      const n = Math.max(12, Math.round(rx * 6));
      L = [Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * rx, cy + Math.sin((i / n) * Math.PI * 2) * ry])];
    } else {
      const x = attr(tag, 'x');
      const y = attr(tag, 'y');
      const w = attr(tag, 'width');
      const h = attr(tag, 'height');
      const r = Math.min(attr(tag, 'rx'), w / 2, h / 2);
      L = r > 0 ? pathLines(`M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`) : [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
    }
    const t = /transform="rotate\(([^)]*)\)"/.exec(tag);
    if (t) {
      const [a, ox = 0, oy = 0] = t[1].split(/[ ,]+/).map(Number);
      const c = Math.cos((a * Math.PI) / 180);
      const s = Math.sin((a * Math.PI) / 180);
      L = L.map((ln) => ln.map(([px, py]) => [ox + (px - ox) * c - (py - oy) * s, oy + (px - ox) * s + (py - oy) * c]));
    }
    out.push(...L);
  }
  return out;
}
