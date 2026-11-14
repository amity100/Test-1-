// (ROADMAP 19.2, PHONE_SPEED_PLAN.md Section 8 and Appendix B) A mesh in fewer triangles over THE SAME
// CORNERS. Nothing is made or moved: a corner is taken out by pulling it onto one of its neighbours
// (the neighbour stays exactly where it is, with its own picture, normal and moves), and the triangles
// that stood on the corner now stand on the neighbour. What comes back is only another list of
// triangles over the corners it was given - so the texture the corners live in, a face's moves, the
// pictures laid on a part, the ring where a neck begins all stay as they are and stay in step.
//
// Cheapest first, by the quadric error of Garland and Heckbert: a corner stands for the planes of the
// triangles round it (weighted by their areas); pulling it onto a neighbour costs the mean squared
// distance of the neighbour from all those planes, and a corner that has already taken others in keeps
// their planes (so the cost of a long run of collapses is the distance from the ORIGINAL surface, not
// from the last one). The square root of the cost is about how far the surface has moved, in the
// units of the corners (metres). Stops when the cheapest collapse costs more than maxErr.
//
// A collapse is refused if
//   - the corner is locked (the edge of an open surface: a limb's ends, the ring a head meets its neck
//     in, a seam of the pictures - and any corner opts.lock names),
//   - it would pinch the surface (the neighbours the two corners share must be exactly the opposite
//     corners of the edge between them: the link condition),
//   - it would turn a triangle that stays by more than opts.flipCos (cos 60 degrees) or leave it
//     with no area,
//   - the two corners' normals differ by more than opts.creaseCos (cos 45 degrees: a crease stays one),
//   - the corner's own attributes (its picture's place, its normal, the moves of a face) are not what
//     the triangles that take its place give there, within each one's tolerance (opts.attrs).
//
//   simplify(index, pos, { maxErr, nor, lock, attrs: [{ a: Float32Array, dim, tol }], target })
//     -> { index: Uint32Array, triangles, collapsed, error }   (error: the dearest collapse made, metres)

export function simplify(index, pos, opts = {}) {
  const V = (pos.length / 3) | 0;
  const T0 = (index.length / 3) | 0;
  const maxErr = opts.maxErr === undefined ? 0.003 : opts.maxErr;
  const limit = maxErr * maxErr;
  const nor = opts.nor || null;
  const creaseCos = opts.creaseCos === undefined ? 0.7 : opts.creaseCos;
  const flipCos = opts.flipCos === undefined ? 0.5 : opts.flipCos;
  const attrs = opts.attrs || [];
  const target = opts.target || 0;

  // ---- the triangles, and which triangles each corner is in
  const tv = new Int32Array(T0 * 3);
  for (let i = 0; i < tv.length; i++) tv[i] = index[i];
  const tAlive = new Uint8Array(T0);
  const vt = new Array(V);
  for (let v = 0; v < V; v++) vt[v] = [];
  let tris = 0;
  for (let t = 0; t < T0; t++) {
    const a = tv[t * 3];
    const b = tv[t * 3 + 1];
    const c = tv[t * 3 + 2];
    if (a === b || b === c || a === c) continue;
    tAlive[t] = 1;
    tris++;
    vt[a].push(t);
    vt[b].push(t);
    vt[c].push(t);
  }
  const alive = new Uint8Array(V).fill(1);
  const locked = new Uint8Array(V);
  if (opts.lock) for (let v = 0; v < V; v++) locked[v] = opts.lock[v] ? 1 : 0;

  // ---- the edges of an open surface (one triangle on them), and anything that is not a surface
  // (three on one edge): their corners stay
  const edges = new Map();
  const edge = (a, b) => {
    const k = a < b ? a * V + b : b * V + a;
    edges.set(k, (edges.get(k) || 0) + 1);
  };
  for (let t = 0; t < T0; t++) {
    if (!tAlive[t]) continue;
    const o = t * 3;
    edge(tv[o], tv[o + 1]);
    edge(tv[o + 1], tv[o + 2]);
    edge(tv[o + 2], tv[o]);
  }
  for (const [k, n] of edges) {
    if (n === 2) continue;
    const lo = Math.floor(k / V);
    locked[lo] = 1;
    locked[k - lo * V] = 1;
  }
  // (a corner in more triangles than the scratch below holds is left as it is)
  for (let v = 0; v < V; v++) if (vt[v].length > 48) locked[v] = 1;

  // ---- the quadrics
  const Q = new Float64Array(V * 10);
  const W = new Float64Array(V);
  for (let t = 0; t < T0; t++) {
    if (!tAlive[t]) continue;
    const o = t * 3;
    const a = tv[o] * 3;
    const b = tv[o + 1] * 3;
    const c = tv[o + 2] * 3;
    const e1x = pos[b] - pos[a];
    const e1y = pos[b + 1] - pos[a + 1];
    const e1z = pos[b + 2] - pos[a + 2];
    const e2x = pos[c] - pos[a];
    const e2y = pos[c + 1] - pos[a + 1];
    const e2z = pos[c + 2] - pos[a + 2];
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len < 1e-18) continue;
    nx /= len;
    ny /= len;
    nz /= len;
    const d = -(nx * pos[a] + ny * pos[a + 1] + nz * pos[a + 2]);
    const w = len * 0.5;
    const k0 = w * nx * nx;
    const k1 = w * nx * ny;
    const k2 = w * nx * nz;
    const k3 = w * nx * d;
    const k4 = w * ny * ny;
    const k5 = w * ny * nz;
    const k6 = w * ny * d;
    const k7 = w * nz * nz;
    const k8 = w * nz * d;
    const k9 = w * d * d;
    for (let s = 0; s < 3; s++) {
      const q = tv[o + s] * 10;
      Q[q] += k0;
      Q[q + 1] += k1;
      Q[q + 2] += k2;
      Q[q + 3] += k3;
      Q[q + 4] += k4;
      Q[q + 5] += k5;
      Q[q + 6] += k6;
      Q[q + 7] += k7;
      Q[q + 8] += k8;
      Q[q + 9] += k9;
      W[tv[o + s]] += w;
    }
  }

  // what it costs to pull u onto v: v's place's mean squared distance from the planes of both
  const cost = (u, v) => {
    const o = u * 10;
    const p = v * 10;
    const x = pos[v * 3];
    const y = pos[v * 3 + 1];
    const z = pos[v * 3 + 2];
    const e =
      (Q[o] + Q[p]) * x * x +
      2 * (Q[o + 1] + Q[p + 1]) * x * y +
      2 * (Q[o + 2] + Q[p + 2]) * x * z +
      2 * (Q[o + 3] + Q[p + 3]) * x +
      (Q[o + 4] + Q[p + 4]) * y * y +
      2 * (Q[o + 5] + Q[p + 5]) * y * z +
      2 * (Q[o + 6] + Q[p + 6]) * y +
      (Q[o + 7] + Q[p + 7]) * z * z +
      2 * (Q[o + 8] + Q[p + 8]) * z +
      (Q[o + 9] + Q[p + 9]);
    return e > 0 ? e / (W[u] + W[v]) : 0;
  };

  // ---- scratch
  const mark = new Int32Array(V);
  const mark2 = new Int32Array(V);
  const mark3 = new Int32Array(V);
  let mk = 0;
  let mk2 = 0;
  let mk3 = 0;
  const nbV = new Int32Array(64 * 3);
  const nbC = new Float64Array(64 * 3);
  const aff = new Int32Array(64 * 3);

  // would u pulled onto v leave a surface? (the link condition, and no triangle that stays turned over)
  const topoOK = (u, v) => {
    const lu = vt[u];
    const lv = vt[v];
    if (nor) {
      const dot = nor[u * 3] * nor[v * 3] + nor[u * 3 + 1] * nor[v * 3 + 1] + nor[u * 3 + 2] * nor[v * 3 + 2];
      if (dot < creaseCos) return false;
    }
    mk2++;
    let ne = 0;
    for (let i = 0; i < lu.length; i++) {
      const o = lu[i] * 3;
      let has = false;
      for (let s = 0; s < 3; s++) {
        const w = tv[o + s];
        if (w === v) has = true;
        else if (w !== u) mark2[w] = mk2;
      }
      if (has) ne++;
    }
    if (ne === 0) return false;
    mk3++;
    let common = 0;
    for (let i = 0; i < lv.length; i++) {
      const o = lv[i] * 3;
      for (let s = 0; s < 3; s++) {
        const w = tv[o + s];
        if (w !== u && w !== v && mark2[w] === mk2 && mark3[w] !== mk3) {
          mark3[w] = mk3;
          common++;
        }
      }
    }
    if (common !== ne) return false;
    // the triangles that stay: with v where u was, no more than flipCos turned, and with an area
    for (let i = 0; i < lu.length; i++) {
      const o = lu[i] * 3;
      const t0 = tv[o];
      const t1 = tv[o + 1];
      const t2 = tv[o + 2];
      if (t0 === v || t1 === v || t2 === v) continue;
      const a = t0 * 3;
      const b = t1 * 3;
      const c = t2 * 3;
      const e1x = pos[b] - pos[a];
      const e1y = pos[b + 1] - pos[a + 1];
      const e1z = pos[b + 2] - pos[a + 2];
      const e2x = pos[c] - pos[a];
      const e2y = pos[c + 1] - pos[a + 1];
      const e2z = pos[c + 2] - pos[a + 2];
      const ox = e1y * e2z - e1z * e2y;
      const oy = e1z * e2x - e1x * e2z;
      const oz = e1x * e2y - e1y * e2x;
      const pa = (t0 === u ? v : t0) * 3;
      const pb = (t1 === u ? v : t1) * 3;
      const pc = (t2 === u ? v : t2) * 3;
      const f1x = pos[pb] - pos[pa];
      const f1y = pos[pb + 1] - pos[pa + 1];
      const f1z = pos[pb + 2] - pos[pa + 2];
      const f2x = pos[pc] - pos[pa];
      const f2y = pos[pc + 1] - pos[pa + 1];
      const f2z = pos[pc + 2] - pos[pa + 2];
      const nx = f1y * f2z - f1z * f2y;
      const ny = f1z * f2x - f1x * f2z;
      const nz = f1x * f2y - f1y * f2x;
      const lo = Math.sqrt(ox * ox + oy * oy + oz * oz);
      const ln = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (ln < 1e-14 || lo < 1e-14) return false;
      if ((ox * nx + oy * ny + oz * nz) / (lo * ln) < flipCos) return false;
    }
    return true;
  };

  // what the triangles that take u's place give at u's place, for each attribute: the new triangle
  // that holds u's place (u's point dropped on the planes of the ones with v in u's place; the one it
  // falls most nearly inside), its corners' attribute values blended where u was, against u's own
  const attrOK = (u, v) => {
    if (!attrs.length) return true;
    const lu = vt[u];
    const px = pos[u * 3];
    const py = pos[u * 3 + 1];
    const pz = pos[u * 3 + 2];
    const vx = pos[v * 3];
    const vy = pos[v * 3 + 1];
    const vz = pos[v * 3 + 2];
    let best = -Infinity;
    let ba = -1;
    let bb = -1;
    let bwv = 0;
    let bwa = 0;
    let bwb = 0;
    for (let i = 0; i < lu.length; i++) {
      const o = lu[i] * 3;
      const t0 = tv[o];
      const t1 = tv[o + 1];
      const t2 = tv[o + 2];
      if (t0 === v || t1 === v || t2 === v) continue;
      let aa;
      let bb2;
      if (t0 === u) {
        aa = t1;
        bb2 = t2;
      } else if (t1 === u) {
        aa = t0;
        bb2 = t2;
      } else {
        aa = t0;
        bb2 = t1;
      }
      const e1x = pos[aa * 3] - vx;
      const e1y = pos[aa * 3 + 1] - vy;
      const e1z = pos[aa * 3 + 2] - vz;
      const e2x = pos[bb2 * 3] - vx;
      const e2y = pos[bb2 * 3 + 1] - vy;
      const e2z = pos[bb2 * 3 + 2] - vz;
      const wx = px - vx;
      const wy = py - vy;
      const wz = pz - vz;
      const d11 = e1x * e1x + e1y * e1y + e1z * e1z;
      const d12 = e1x * e2x + e1y * e2y + e1z * e2z;
      const d22 = e2x * e2x + e2y * e2y + e2z * e2z;
      const d1 = wx * e1x + wy * e1y + wz * e1z;
      const d2 = wx * e2x + wy * e2y + wz * e2z;
      const det = d11 * d22 - d12 * d12;
      if (det < 1e-24) continue;
      const s = (d22 * d1 - d12 * d2) / det;
      const t = (d11 * d2 - d12 * d1) / det;
      const wv = 1 - s - t;
      const m = Math.min(wv, s, t);
      if (m > best) {
        best = m;
        ba = aa;
        bb = bb2;
        bwv = wv;
        bwa = s;
        bwb = t;
      }
    }
    if (ba < 0) return true;
    // (a point just outside every one of them: held to the nearest)
    if (bwv < 0) bwv = 0;
    if (bwa < 0) bwa = 0;
    if (bwb < 0) bwb = 0;
    const sum = bwv + bwa + bwb || 1;
    bwv /= sum;
    bwa /= sum;
    bwb /= sum;
    for (let k = 0; k < attrs.length; k++) {
      const at = attrs[k];
      const A = at.a;
      const d = at.dim;
      for (let c = 0; c < d; c++) {
        const val = bwv * A[v * d + c] + bwa * A[ba * d + c] + bwb * A[bb * d + c];
        if (Math.abs(val - A[u * d + c]) > at.tol) return false;
      }
    }
    return true;
  };

  // ---- the heap of the cheapest collapse each corner has
  const hc = [];
  const hu = [];
  const hs = [];
  const push = (c, u, s) => {
    let i = hc.length;
    hc.push(c);
    hu.push(u);
    hs.push(s);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hc[p] <= c) break;
      hc[i] = hc[p];
      hu[i] = hu[p];
      hs[i] = hs[p];
      i = p;
    }
    hc[i] = c;
    hu[i] = u;
    hs[i] = s;
  };
  let pc = 0;
  let pu = 0;
  let ps = 0;
  const pop = () => {
    pc = hc[0];
    pu = hu[0];
    ps = hs[0];
    const c = hc.pop();
    const u = hu.pop();
    const s = hs.pop();
    const n = hc.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let l = i * 2 + 1;
        if (l >= n) break;
        if (l + 1 < n && hc[l + 1] < hc[l]) l++;
        if (hc[l] >= c) break;
        hc[i] = hc[l];
        hu[i] = hu[l];
        hs[i] = hs[l];
        i = l;
      }
      hc[i] = c;
      hu[i] = u;
      hs[i] = s;
    }
  };

  const bestV = new Int32Array(V).fill(-1);
  const stamp = new Int32Array(V);
  // the cheapest collapse of u that may be made, put in the heap
  const evalBest = (u) => {
    stamp[u]++;
    bestV[u] = -1;
    if (!alive[u] || locked[u]) return;
    const lu = vt[u];
    if (!lu.length) return;
    let n = 0;
    mk++;
    mark[u] = mk;
    for (let i = 0; i < lu.length; i++) {
      const o = lu[i] * 3;
      for (let s = 0; s < 3; s++) {
        const w = tv[o + s];
        if (mark[w] !== mk) {
          mark[w] = mk;
          nbV[n] = w;
          nbC[n] = cost(u, w);
          n++;
        }
      }
    }
    for (let round = 0; round < n; round++) {
      let bi = -1;
      let bc = limit;
      for (let i = 0; i < n; i++) {
        if (nbC[i] < bc) {
          bc = nbC[i];
          bi = i;
        }
      }
      if (bi < 0) return;
      const v = nbV[bi];
      if (topoOK(u, v) && attrOK(u, v)) {
        bestV[u] = v;
        push(bc, u, stamp[u]);
        return;
      }
      nbC[bi] = Infinity;
    }
  };

  for (let u = 0; u < V; u++) evalBest(u);

  let collapsed = 0;
  let worst = 0;
  while (hc.length && (!target || tris > target)) {
    pop();
    const u = pu;
    if (ps !== stamp[u] || !alive[u]) continue;
    const v = bestV[u];
    if (v < 0 || !alive[v]) {
      evalBest(u);
      continue;
    }
    if (pc > worst) worst = pc;
    // ---- u onto v
    const lu = vt[u];
    for (let i = 0; i < lu.length; i++) {
      const t = lu[i];
      const o = t * 3;
      if (tv[o] === v || tv[o + 1] === v || tv[o + 2] === v) {
        tAlive[t] = 0;
        tris--;
        for (let s = 0; s < 3; s++) {
          const w = tv[o + s];
          if (w === u) continue;
          const l = vt[w];
          const at = l.indexOf(t);
          l[at] = l[l.length - 1];
          l.pop();
        }
      } else {
        if (tv[o] === u) tv[o] = v;
        else if (tv[o + 1] === u) tv[o + 1] = v;
        else tv[o + 2] = v;
        vt[v].push(t);
      }
    }
    vt[u] = [];
    alive[u] = 0;
    stamp[u]++;
    const qo = u * 10;
    const qv = v * 10;
    for (let k = 0; k < 10; k++) Q[qv + k] += Q[qo + k];
    W[v] += W[u];
    collapsed++;
    // ---- what changed: v, and everything that now touches v
    evalBest(v);
    mk++;
    mark[v] = mk;
    const lv = vt[v];
    let n = 0;
    for (let i = 0; i < lv.length; i++) {
      const o = lv[i] * 3;
      for (let s = 0; s < 3; s++) {
        const w = tv[o + s];
        if (mark[w] !== mk) {
          mark[w] = mk;
          aff[n++] = w;
        }
      }
    }
    for (let i = 0; i < n; i++) evalBest(aff[i]);
  }

  const out = new Uint32Array(tris * 3);
  let k = 0;
  for (let t = 0; t < T0; t++) {
    if (!tAlive[t]) continue;
    out[k++] = tv[t * 3];
    out[k++] = tv[t * 3 + 1];
    out[k++] = tv[t * 3 + 2];
  }
  return { index: out, triangles: tris, collapsed, error: Math.sqrt(worst) };
}
