// (v5, characters round) Real people's motion for the city's people: recordings of real walkers,
// runners and people standing about (the CMU Graphics Lab Motion Capture Database - mocap.cs.cmu.edu,
// "free for use in research and commercial projects"; the BVH conversion by B. Hahne, from the copy at
// github.com/una-dinosauria/cmu-mocap) turned into what game/doodle.js needs to pose a body: its
// hips, the turn of its pelvis, the line of its spine and of its shoulders, where its feet are and
// when they are on the ground, its knees, and the swing of its arms - in the body's own frame and
// at the city's people's proportions (game/mocap.js plays them).
//
// usage: node tools/mocap.mjs <dir of .bvh files> [out = v5/js/game/mocapdata.js]
//   (the files: curl https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/0SS/SS_NN.bvh)
//
// What it keeps of a recording:
// - a walk or a run: one whole cycle from the middle of it (steady), from the left heel's landing to
//   its next, made to loop (what is left over at its end spread back over it), its speed and length;
// - standing: a stretch of it, made to loop with a cross-fade of its end into its start.
// Every frame is 44 numbers (the body's frame: x to its right, y up, z ahead; units: a leg's length
// 0.8895 - the city's people's - with the ankle of a flat foot 0.04 off the ground):
//   0-2 the hips (the middle of the two hip joints), 3-5 the pelvis's right (unit: from the left hip
//   joint to the right), 6-8 the spine (unit: from the hips to the base of the neck), 9-11 the
//   shoulders' right (unit), then for the right leg and the left: 12-14 / 22-24 the ankle, 15-17 /
//   25-27 the ball of the foot, 18-20 / 28-30 the knee, 21 / 31 on the ground (0..1); then for the
//   right arm and the left, in the chest's frame (its right, up the spine, ahead): 32-34 / 38-40 the
//   upper arm's direction, 35-37 / 41-43 the forearm's.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEG = 0.8895; // the city's people's leg, hip joint to ankle (game/doodle.js: 2 x 0.4448)
const ANKLE = 0.04; // a flat foot's ankle off the ground
const FPS = 30;
const NF = 44;

// what to make of which recording (subject_trial: CMU's numbering)
const CLIPS = [
  // walks: one each from many people (each person in the city walks like one of them)
  { id: '02_01', kind: 'walk' },
  { id: '05_01', kind: 'walk' },
  { id: '07_01', kind: 'walk' },
  { id: '08_01', kind: 'walk' },
  { id: '12_01', kind: 'walk' },
  { id: '16_15', kind: 'walk' },
  { id: '35_01', kind: 'walk' },
  { id: '38_01', kind: 'walk' },
  { id: '39_01', kind: 'walk' },
  { id: '69_01', kind: 'walk' },
  // slow, brisk
  { id: '07_04', kind: 'walk' },
  { id: '08_04', kind: 'walk' },
  { id: '37_01', kind: 'walk' },
  { id: '08_05', kind: 'walk' },
  // jogs and runs
  { id: '35_17', kind: 'run' },
  { id: '16_55', kind: 'run' },
  { id: '02_03', kind: 'run' },
  { id: '16_36', kind: 'run' },
  { id: '35_18', kind: 'run' },
  { id: '35_20', kind: 'run' },
  { id: '35_22', kind: 'run' },
  { id: '127_03', kind: 'run' },
  { id: '127_06', kind: 'run' },
  { id: '113_07', kind: 'run' },
  // standing: somebody waiting, somebody standing about (seconds into the recording)
  { id: '77_02', kind: 'idle', from: 0.3, to: 7.6 },
  { id: '40_10', kind: 'idle', auto: true },
  { id: '40_11', kind: 'idle', auto: true },
  // talking: explaining something with the hands (two people in one conversation)
  { id: '18_08', kind: 'talk', auto: true },
  { id: '19_08', kind: 'talk', auto: true },
];

// ------------------------------------------------------------------ the BVH file
function parse(txt) {
  const tok = txt.split(/\s+/).filter(Boolean);
  let i = 0;
  const joints = [];
  const readJoint = (name, parent) => {
    const j = { name, parent, offset: [0, 0, 0], channels: [], children: [], end: null, ch0: 0 };
    joints.push(j);
    i++; // {
    while (tok[i] !== '}') {
      const t = tok[i++];
      if (t === 'OFFSET') j.offset = [+tok[i++], +tok[i++], +tok[i++]];
      else if (t === 'CHANNELS') {
        const n = +tok[i++];
        for (let k = 0; k < n; k++) j.channels.push(tok[i++]);
      } else if (t === 'JOINT') j.children.push(readJoint(tok[i++], j));
      else if (t === 'End') {
        i += 3; // Site { OFFSET
        j.end = [+tok[i++], +tok[i++], +tok[i++]];
        i++; // }
      }
    }
    i++; // }
    return j;
  };
  while (tok[i] !== 'ROOT') i++;
  i++;
  readJoint(tok[i++], null);
  while (tok[i] !== 'MOTION') i++;
  i += 2;
  const n = +tok[i++];
  i += 2;
  const ft = +tok[i++];
  let nc = 0;
  for (const j of joints) {
    j.ch0 = nc;
    nc += j.channels.length;
  }
  const data = new Float64Array(n * nc);
  for (let k = 0; k < n * nc; k++) data[k] = +tok[i++];
  const by = {};
  for (const j of joints) by[j.name] = j;
  return { joints, by, n, ft, nc, data };
}

// rotation matrices (row-major 3x3)
const mul = (a, b) => {
  const o = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
};
const app = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const rot = (axis, deg) => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  if (axis === 'X') return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 'Y') return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
};

// every joint's place in the world, every frame (and the ends of the toes and the head)
function positions(B) {
  const P = {};
  for (const j of B.joints) P[j.name] = new Float64Array(B.n * 3);
  P.LeftToeEnd = new Float64Array(B.n * 3);
  P.RightToeEnd = new Float64Array(B.n * 3);
  const R = {};
  for (let f = 0; f < B.n; f++) {
    const d = B.data.subarray(f * B.nc, (f + 1) * B.nc);
    for (const j of B.joints) {
      let m = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      let pos = [0, 0, 0];
      for (let c = 0; c < j.channels.length; c++) {
        const ch = j.channels[c];
        const v = d[j.ch0 + c];
        if (ch.endsWith('position')) pos['XYZ'.indexOf(ch[0])] = v;
        else m = mul(m, rot(ch[0], v));
      }
      let g;
      let p;
      if (!j.parent) {
        g = m;
        p = [pos[0] + j.offset[0], pos[1] + j.offset[1], pos[2] + j.offset[2]];
      } else {
        const pg = R[j.parent.name];
        const pp = P[j.parent.name];
        const o = app(pg, j.offset);
        p = [pp[f * 3] + o[0], pp[f * 3 + 1] + o[1], pp[f * 3 + 2] + o[2]];
        g = mul(pg, m);
      }
      R[j.name] = g;
      P[j.name][f * 3] = p[0];
      P[j.name][f * 3 + 1] = p[1];
      P[j.name][f * 3 + 2] = p[2];
      if (j.end && (j.name === 'LeftToeBase' || j.name === 'RightToeBase')) {
        const e = app(g, j.end);
        const T = j.name === 'LeftToeBase' ? P.LeftToeEnd : P.RightToeEnd;
        T[f * 3] = p[0] + e[0];
        T[f * 3 + 1] = p[1] + e[1];
        T[f * 3 + 2] = p[2] + e[2];
      }
    }
  }
  return P;
}

const len = (v) => Math.hypot(v[0], v[1], v[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const nrm = (v) => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const at = (A, f) => [A[f * 3], A[f * 3 + 1], A[f * 3 + 2]];
// a joint's place at a time between frames
const atT = (A, t) => {
  const f0 = Math.max(0, Math.min(A.length / 3 - 1, Math.floor(t)));
  const f1 = Math.min(A.length / 3 - 1, f0 + 1);
  const k = Math.max(0, Math.min(1, t - f0));
  const a = at(A, f0);
  const b = at(A, f1);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};

function pct(arr, q) {
  const s = Array.from(arr).sort((a, b) => a - b);
  return s[Math.max(0, Math.min(s.length - 1, Math.round(q * (s.length - 1))))];
}

// ------------------------------------------------------------------ one recording
function convert(file, spec) {
  const B = parse(fs.readFileSync(file, 'utf8'));
  const P = positions(B);
  const legLen = len(B.by.LeftLeg.offset) + len(B.by.LeftFoot.offset);
  const s = LEG / legLen;
  const n = B.n;
  // (the first frame is the T pose the conversion added)
  const F0 = 1;
  // the feet: how high a flat foot's ankle and ball are - along the recording, as its floor was not
  // quite level (the lowest of the feet in every half second, a straight line through them)
  const fps = 1 / B.ft;
  const floorLine = (A, C) => {
    const W = Math.round(fps * 0.5);
    const xs = [];
    const ys = [];
    for (let f = F0; f + W <= n; f += Math.round(W / 2)) {
      let m = Infinity;
      for (let g = f; g < f + W; g++) m = Math.min(m, A[g * 3 + 1], C[g * 3 + 1]);
      xs.push(f + W / 2);
      ys.push(m);
    }
    const k = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / k;
    const my = ys.reduce((a, b) => a + b, 0) / k;
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < k; i++) {
      sxy += (xs[i] - mx) * (ys[i] - my);
      sxx += (xs[i] - mx) * (xs[i] - mx);
    }
    const b = k > 1 && sxx > 0 ? sxy / sxx : 0;
    // (the line through the lowest of them: a foot in the air is never the floor)
    let off = Infinity;
    for (let i = 0; i < k; i++) off = Math.min(off, ys[i] - (my + b * (xs[i] - mx)));
    const lift = Math.max(0, pct(ys.map((y, i) => y - (my + b * (xs[i] - mx))), 0.3) - off);
    return (t) => my + b * (t - mx) + off + lift * 0.5;
  };
  const ankFlatAt = floorLine(P.LeftFoot, P.RightFoot);
  const toeFlatAt = floorLine(P.LeftToeBase, P.RightToeBase);
  const contact = (side) => {
    const A = P[side + 'Foot'];
    const T = P[side + 'ToeBase'];
    const c = new Float64Array(n);
    for (let f = F0; f < n; f++) {
      const g = Math.min(n - 1, f + 1);
      const h = Math.max(F0, f - 1);
      const va = (Math.hypot(A[g * 3] - A[h * 3], A[g * 3 + 2] - A[h * 3 + 2]) / (g - h)) * fps * s;
      const vt = (Math.hypot(T[g * 3] - T[h * 3], T[g * 3 + 2] - T[h * 3 + 2]) / (g - h)) * fps * s;
      const run = spec.kind === 'run';
      const heel = (A[f * 3 + 1] - ankFlatAt(f)) * s < (run ? 0.05 : 0.035) && va < (run ? 0.9 : 0.45);
      const ball = (T[f * 3 + 1] - toeFlatAt(f)) * s < (run ? 0.045 : 0.03) && vt < (run ? 0.9 : 0.45);
      c[f] = heel || ball ? 1 : 0;
    }
    // (a frame or two of noise either way is no step)
    const o = Float64Array.from(c);
    for (let f = F0 + 2; f < n - 2; f++) {
      let m = 0;
      for (let k = -2; k <= 2; k++) m += c[f + k];
      o[f] = m >= 3 ? 1 : 0;
    }
    return o;
  };
  const CL = contact('Left');
  const CR = contact('Right');
  const hipMid = (t) => {
    const a = atT(P.LeftUpLeg, t);
    const b = atT(P.RightUpLeg, t);
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  };

  // the stretch kept, and the body's frame along it (where it is, which way it faces)
  let t0;
  let t1;
  let root; // (t) => [x, z]
  let fwd;
  let cyc = false;
  if (spec.kind === 'walk' || spec.kind === 'run') {
    // the left foot's landings
    // (a landing after a real swing - the foot off the ground a while - and the right foot down
    // in between: no flicker of the contact is a step)
    const run = spec.kind === 'run';
    const minSwing = Math.round(fps * (run ? 0.1 : 0.18));
    const minGap = Math.round(fps * (run ? 0.45 : 0.7));
    const landsOf = (C, O) => {
      const L = [];
      for (let f = F0 + 3; f < n - 3; f++) {
        if (!(C[f] && !C[f - 1])) continue;
        let off = 0;
        for (let g = f - 1; g > F0 && !C[g]; g--) off++;
        if (off < minSwing) continue;
        const last = L[L.length - 1];
        if (last !== undefined) {
          if (f - last < minGap) continue;
          let other = false;
          for (let g = last + 1; g < f; g++) if (O[g] && !O[g - 1]) other = true;
          if (!other) continue;
        }
        L.push(f);
      }
      return L;
    };
    let lands = landsOf(CL, CR);
    // (a short run with one left landing in it: a cycle from the right foot's, started where the
    // left foot lands in it)
    if (lands.length < 2) {
      const R = landsOf(CR, CL);
      if (R.length < 2) throw new Error(`${spec.id}: fewer than two steps of either foot`);
      let k = 0;
      while (k + 1 < R.length && !Array.from({ length: R[k + 1] - R[k] }, (_, i) => R[k] + i).some((g) => CL[g] && !CL[g - 1])) k++;
      if (k + 1 >= R.length) throw new Error(`${spec.id}: no left landing within a right cycle`);
      let lf = R[k];
      for (let g = R[k] + 1; g < R[k + 1]; g++)
        if (CL[g] && !CL[g - 1]) {
          lf = g;
          break;
        }
      lands = [lf, lf + (R[k + 1] - R[k])];
      if (lands[1] >= n - 1) throw new Error(`${spec.id}: too short`);
    }
    // the cycle nearest the middle
    let best = 0;
    let bd = Infinity;
    for (let k = 0; k + 1 < lands.length; k++) {
      const mid = (lands[k] + lands[k + 1]) / 2;
      const d = Math.abs(mid - n / 2);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    t0 = lands[best];
    t1 = lands[best + 1];
    const p0 = hipMid(t0);
    const p1 = hipMid(t1);
    fwd = nrm([p1[0] - p0[0], 0, p1[2] - p0[2]]);
    root = (t) => {
      const k = (t - t0) / (t1 - t0);
      return [p0[0] + (p1[0] - p0[0]) * k, p0[2] + (p1[2] - p0[2]) * k];
    };
    cyc = true;
  } else {
    // standing: the stretch asked for, or the longest stretch with the hips still
    if (spec.auto) {
      const still = new Uint8Array(n);
      for (let f = F0 + 15; f < n - 15; f++) {
        const a = hipMid(f - 15);
        const b = hipMid(f + 15);
        still[f] = (Math.hypot(b[0] - a[0], b[2] - a[2]) * s) / (30 / fps) < 0.12 ? 1 : 0;
      }
      let bs = 0;
      let bl = 0;
      for (let f = F0; f < n; ) {
        if (!still[f]) {
          f++;
          continue;
        }
        let g = f;
        while (g < n && still[g]) g++;
        if (g - f > bl) {
          bl = g - f;
          bs = f;
        }
        f = g;
      }
      const maxL = Math.round(12 * fps);
      t0 = bs + Math.max(0, Math.floor((bl - maxL) / 2));
      t1 = t0 + Math.min(bl, maxL);
    } else {
      t0 = Math.max(F0, Math.round(spec.from * fps));
      t1 = Math.min(n - 1, Math.round(spec.to * fps));
    }
    // (where it stood, facing where its hips faced, on the whole)
    let cx = 0;
    let cz = 0;
    let rx = 0;
    let rz = 0;
    let m = 0;
    for (let f = t0; f < t1; f++) {
      const h = hipMid(f);
      cx += h[0];
      cz += h[2];
      const r = sub(at(P.RightUpLeg, f), at(P.LeftUpLeg, f));
      rx += r[0];
      rz += r[2];
      m++;
    }
    cx /= m;
    cz /= m;
    // right = (-fwd.z, 0, fwd.x)  =>  fwd = (right.z, 0, -right.x)
    const rr = nrm([rx, 0, rz]);
    fwd = [rr[2], 0, -rr[0]];
    root = () => [cx, cz];
  }
  const right = [-fwd[2], 0, fwd[0]];
  const T = (t1 - t0) / fps;
  const N = Math.max(8, Math.round(T * FPS));
  // a point into the body's frame
  const loc = (p, t) => {
    const r = root(t);
    const dx = p[0] - r[0];
    const dz = p[2] - r[1];
    return [(dx * right[0] + dz * right[2]) * s, (p[1] - ankFlatAt(t)) * s + ANKLE, (dx * fwd[0] + dz * fwd[2]) * s];
  };
  // a direction into the body's frame
  const dir = (v) => nrm([v[0] * right[0] + v[2] * right[2], v[1], v[0] * fwd[0] + v[2] * fwd[2]]);
  const frame = (t) => {
    const o = new Float64Array(NF);
    const hm = hipMid(t);
    const lh = loc(hm, t);
    o.set(lh, 0);
    o.set(dir(sub(atT(P.RightUpLeg, t), atT(P.LeftUpLeg, t))), 3);
    const sp = dir(sub(atT(P.Neck, t), hm));
    o.set(sp, 6);
    const cr = dir(sub(atT(P.RightArm, t), atT(P.LeftArm, t)));
    o.set(cr, 9);
    const ti = Math.round(t);
    const legs = [
      ['Right', CR],
      ['Left', CL],
    ];
    for (let li = 0; li < 2; li++) {
      const [side, C] = legs[li];
      const b = 12 + li * 10;
      o.set(loc(atT(P[side + 'Foot'], t), t), b);
      o.set(loc(atT(P[side + 'ToeBase'], t), t), b + 3);
      o.set(loc(atT(P[side + 'Leg'], t), t), b + 6);
      o[b + 9] = C[Math.max(0, Math.min(n - 1, ti))];
    }
    // the arms, in the chest's frame (its right; up the spine, square to it; ahead)
    const cu = nrm(sub(sp, cr.map((v) => v * dot(sp, cr))));
    const cf = cross(cu, cr);
    const arms = ['Right', 'Left'];
    for (let ai = 0; ai < 2; ai++) {
      const side = arms[ai];
      const sh = atT(P[side + 'Arm'], t);
      const el = atT(P[side + 'ForeArm'], t);
      const wr = atT(P[side + 'Hand'], t);
      const u = dir(sub(el, sh));
      const fo = dir(sub(wr, el));
      const b = 32 + ai * 6;
      o[b] = dot(u, cr);
      o[b + 1] = dot(u, cu);
      o[b + 2] = dot(u, cf);
      o[b + 3] = dot(fo, cr);
      o[b + 4] = dot(fo, cu);
      o[b + 5] = dot(fo, cf);
    }
    return o;
  };
  const UNIT = [3, 6, 9, 32, 35, 38, 41];
  const renorm = (o) => {
    for (const u of UNIT) {
      const l = Math.hypot(o[u], o[u + 1], o[u + 2]) || 1;
      o[u] /= l;
      o[u + 1] /= l;
      o[u + 2] /= l;
    }
  };
  const out = [];
  if (cyc) {
    const a = frame(t0);
    const b = frame(t1);
    for (let k = 0; k < N; k++) {
      const t = t0 + ((t1 - t0) * k) / N;
      const o = frame(t);
      // (made to loop: what is left over at its end spread back over it)
      for (let c = 0; c < NF; c++) if (c !== 21 && c !== 31) o[c] -= ((b[c] - a[c]) * k) / N;
      renorm(o);
      out.push(o);
    }
  } else {
    const raw = [];
    for (let k = 0; k < N; k++) raw.push(frame(t0 + ((t1 - t0) * k) / N));
    // (made to loop: its last second faded into its first)
    const W = Math.min(Math.round(FPS * 1.2), Math.floor(N / 3));
    for (let k = 0; k < N - W; k++) {
      const o = Float64Array.from(raw[k]);
      if (k < W) {
        const w = k / W;
        const e = w * w * (3 - 2 * w);
        const tail = raw[N - W + k];
        for (let c = 0; c < NF; c++) o[c] = tail[c] + (o[c] - tail[c]) * e;
        renorm(o);
      }
      out.push(o);
    }
  }
  const speed = cyc ? (Math.hypot(...[0, 1].map((i) => root(t1)[i] - root(t0)[i])) * s) / T : 0;
  return { id: spec.id, kind: spec.kind, speed, T: cyc ? T : out.length / FPS, frames: out, legLen, s };
}

// ------------------------------------------------------------------ all of them, into the game
const dir0 = process.argv[2];
const outFile = process.argv[3] || path.join(HERE, '..', 'v5', 'js', 'game', 'mocapdata.js');
if (!dir0) {
  console.log('usage: node tools/mocap.mjs <dir of .bvh files> [out]');
  process.exit(1);
}
const Q = 1e-4;
const clips = [];
for (const spec of CLIPS) {
  const file = path.join(dir0, spec.id + '.bvh');
  if (!fs.existsSync(file)) {
    console.log('missing', file);
    continue;
  }
  let c;
  try {
    c = convert(file, spec);
  } catch (e) {
    console.log('skipped', spec.id, e.message);
    continue;
  }
  const q = new Int16Array(c.frames.length * NF);
  c.frames.forEach((o, k) => {
    for (let i = 0; i < NF; i++) q[k * NF + i] = Math.max(-32767, Math.min(32767, Math.round(o[i] / Q)));
  });
  const b64 = Buffer.from(q.buffer).toString('base64');
  clips.push({ id: c.id, kind: c.kind, speed: +c.speed.toFixed(4), T: +c.T.toFixed(4), n: c.frames.length, data: b64 });
  const f0 = c.frames[0];
  console.log(`${c.id} ${c.kind.padEnd(4)} frames ${String(c.frames.length).padStart(4)}  T ${c.T.toFixed(2)} s  speed ${c.speed.toFixed(2)} m/s  hip y ${f0[1].toFixed(3)}  (scale ${c.s.toFixed(4)})`);
  if (process.env.DUMP) fs.writeFileSync(path.join(process.env.DUMP, c.id + '.json'), JSON.stringify(c.frames.map((o) => Array.from(o))));
}
const js =
  `// (v5, characters round) Real people's motion - made by tools/mocap.mjs from the CMU Graphics Lab Motion\n` +
  `// Capture Database (mocap.cs.cmu.edu: "The data used in this project was obtained from mocap.cs.cmu.edu.\n` +
  `// The database was created with funding from NSF EIA-0196217."), BVH conversion by B. Hahne.\n` +
  `// Each clip: ${NF} numbers a frame at ${FPS} frames a second, as 16-bit integers x ${Q} (tools/mocap.mjs says what\n` +
  `// each is). Do not edit: make it again.\n` +
  `export const MOCAP = ${JSON.stringify({ fps: FPS, nf: NF, q: Q, clips }, null, 0)};\n`;
fs.writeFileSync(outFile, js);
console.log('wrote', outFile, (js.length / 1024).toFixed(0), 'KB');
