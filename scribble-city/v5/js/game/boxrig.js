import * as THREE from 'three';

// (ROADMAP 29.5) The boxer's body: the whole pose of somebody in a bout (game/boxing.js), made by the rig (game/doodle.js) only
// while fig.box is set - nothing of anybody else's pose goes through here. A boxing stance: the feet staggered, the knees bent,
// the weight bouncing on the balls of the feet, the fists at the chin and the elbows in, the chin down; footwork that steps and
// drags under the body as it goes in, out and round. Each punch its own path and its own body: the jab straight out with the lead
// foot sliding in, the cross with the hips and the shoulders turned through and the rear heel turned out, the hook round on a
// raised elbow with a pivot on the lead foot, the uppercut out of a dip, up. The guard, the slips (the head and the chest off the
// line), the duck; hit, the head snapping back or round, a body shot folding him, a stagger; knocked down, a fall (onto the
// seat and back, or onto a knee), the count on the canvas, and up again. All of it numbers in the body's own frame (x to its
// right, y up, z ahead - metres of a body of scale 1), worked out for an orthodox stance (the left foot and fist ahead) and
// mirrored for a southpaw; the joints put from them as the rig puts them (its ik). Nothing is made each frame.

const cl01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sst = (a, b, x) => {
  const t = cl01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
// how long getting up takes, from flat on the canvas / from a knee (game/boxing.js waits as long)
export const GETUP_BACK = 1.6;
export const GETUP_KNEE = 0.8;

// the pose's numbers: the hips' middle (hx hy hz) and the body's lean ahead and over to a side (at the neck, metres); the hips'
// and the chest's turn (radians, + to the left, as the rig's chestYaw); the feet and their toes' turn (+ toward the right), the
// knees' way; the hands' places from the neck, the elbows' way, the palms' way; the head turned, nodded, tilted from the chest
function pose() {
  return {
    hx: 0, hy: 0, hz: 0, lean: 0, side: 0, pA: 0, cA: 0,
    lx: 0, ly: 0, lz: 0, la: 0, rx: 0, ry: 0, rz: 0, ra: 0,
    klx: 0, kly: 0, klz: 1, krx: 0, kry: 0, krz: 1,
    hlx: 0, hly: 0, hlz: 0, hrx: 0, hry: 0, hrz: 0,
    elx: 0, ely: -1, elz: 0, erx: 0, ery: -1, erz: 0,
    nlx: 1, nly: 0, nlz: 0, nrx: -1, nry: 0, nrz: 0,
    hdy: 0, hdp: 0, hdr: 0, shL: 0, shR: 0,
  };
}
const KEYS = Object.keys(pose());
const NK = KEYS.length;
const _P = pose();
const _Q = pose();
const _R = pose();
function blend(P, Q, w) {
  if (w <= 0) return;
  for (let i = 0; i < NK; i++) {
    const k = KEYS[i];
    P[k] += (Q[k] - P[k]) * w;
  }
}
function copy(P, Q) {
  for (let i = 0; i < NK; i++) P[KEYS[i]] = Q[KEYS[i]];
}
// a southpaw's: the orthodox stance seen in a mirror (x the other way, the turns the other way, left and right swapped)
function swapNeg(P, a, b) {
  const t = P[a];
  P[a] = -P[b];
  P[b] = -t;
}
function swap(P, a, b) {
  const t = P[a];
  P[a] = P[b];
  P[b] = t;
}
function mirror(P) {
  P.hx = -P.hx;
  P.side = -P.side;
  P.pA = -P.pA;
  P.cA = -P.cA;
  P.hdy = -P.hdy;
  P.hdr = -P.hdr;
  swapNeg(P, 'lx', 'rx');
  swap(P, 'ly', 'ry');
  swap(P, 'lz', 'rz');
  swapNeg(P, 'la', 'ra');
  swapNeg(P, 'klx', 'krx');
  swap(P, 'kly', 'kry');
  swap(P, 'klz', 'krz');
  swapNeg(P, 'hlx', 'hrx');
  swap(P, 'hly', 'hry');
  swap(P, 'hlz', 'hrz');
  swapNeg(P, 'elx', 'erx');
  swap(P, 'ely', 'ery');
  swap(P, 'elz', 'erz');
  swapNeg(P, 'nlx', 'nrx');
  swap(P, 'nly', 'nry');
  swap(P, 'nlz', 'nrz');
  swap(P, 'shL', 'shR');
}

// each punch (game/boxing.js MOVES: 1 jab, 2 cross, 3 hook, 4 uppercut): its hand (L lead, R rear), its path, and the body at
// the full of it - the chest's and the hips' turn, the hips ahead, the lean, over to a side, the toes' pivots, the lead foot's
// slide, up or down; and the load before it (its tell, and a dip of its own: the uppercut's)
const PUNCH = [
  null,
  { hand: 'L', path: 0, cA: -0.24, pA: -0.06, hz: 0.045, lean: 0.07, side: 0.0, la: 0.0, ra: 0.0, slide: 0.11, hy: -0.012, sh: 0.03, wcA: 0.1, wpA: 0.03, wside: 0.0, why: 0.0, wlean: -0.02, load: 0 },
  { hand: 'R', path: 0, cA: 0.98, pA: 0.52, hz: 0.07, lean: 0.11, side: -0.035, la: 0.05, ra: -0.6, slide: 0.03, hy: -0.018, sh: 0.03, wcA: -0.2, wpA: -0.08, wside: 0.03, why: -0.02, wlean: -0.02, load: 0.3 },
  { hand: 'L', path: 1, cA: -0.66, pA: -0.42, hz: 0.015, lean: 0.05, side: -0.055, la: 0.8, ra: 0.1, slide: 0.0, hy: -0.022, sh: 0.045, wcA: 0.32, wpA: 0.16, wside: -0.045, why: -0.025, wlean: 0.0, load: 0.45 },
  { hand: 'R', path: 2, cA: 0.8, pA: 0.42, hz: 0.035, lean: -0.03, side: -0.02, la: 0.05, ra: -0.45, slide: 0.0, hy: 0.018, sh: 0.0, wcA: -0.32, wpA: -0.1, wside: 0.065, why: -0.08, wlean: 0.07, load: 1 },
];

// the stance and everything that stands: into P
function standing(P, B, fig, legsK) {
  const t = B.clock;
  // (the weight bouncing on the balls of the feet - a heavy man less, a tired one slower and lower)
  const bnc = (0.5 - 0.5 * Math.cos(B.bph * 2)) * 0.018 * B.bounce;
  P.hx = 0.02;
  P.hy = 0.93 * legsK - 0.032 - bnc;
  P.hz = -0.02;
  P.lean = 0.15;
  P.side = 0;
  P.pA = -0.5;
  P.cA = -0.68;
  P.lx = -0.1;
  P.ly = 0.04;
  P.lz = 0.22;
  P.la = 0.3;
  P.rx = 0.16;
  P.ry = 0.04;
  P.rz = -0.22;
  P.ra = 0.8;
  P.hlx = -0.075;
  P.hly = 0.05;
  P.hlz = 0.26;
  P.hrx = 0.07;
  P.hry = 0.075;
  P.hrz = 0.18;
  P.elx = -0.35;
  P.ely = -1;
  P.elz = -0.1;
  P.erx = 0.35;
  P.ery = -1;
  P.erz = -0.15;
  P.nlx = 0.85;
  P.nly = -0.3;
  P.nlz = 0.1;
  P.nrx = -0.85;
  P.nry = -0.3;
  P.nrz = 0.1;
  P.hdy = 0;
  P.hdp = -0.14;
  P.hdr = 0;
  P.shL = 0;
  P.shR = 0;
  // the guard held: the gloves up at the brows and in close, the elbows on the ribs, the chin tucked
  const g = B.guard;
  if (g > 0) {
    P.hlx = mix(P.hlx, -0.058, g);
    P.hly = mix(P.hly, 0.1, g);
    P.hlz = mix(P.hlz, 0.2, g);
    P.hrx = mix(P.hrx, 0.06, g);
    P.hry = mix(P.hry, 0.105, g);
    P.hrz = mix(P.hrz, 0.165, g);
    P.elx = mix(P.elx, -0.12, g);
    P.elz = mix(P.elz, 0.08, g);
    P.erx = mix(P.erx, 0.12, g);
    P.erz = mix(P.erz, 0.08, g);
    P.hdp -= 0.08 * g;
    P.lean += 0.05 * g;
    P.hy -= 0.015 * g;
    P.shL += 0.02 * g;
    P.shR += 0.02 * g;
  }
  // tired: the gloves down at the chest, squarer, the head up for air
  const td = B.tired;
  if (td > 0) {
    P.hly -= 0.14 * td;
    P.hry -= 0.14 * td;
    P.hlz -= 0.03 * td;
    P.hrz -= 0.02 * td;
    P.hlx -= 0.03 * td;
    P.hrx += 0.03 * td;
    P.lean += 0.05 * td;
    P.hdp += 0.08 * td;
    P.pA += 0.12 * td;
    P.cA += 0.14 * td;
  }
  // footwork: each foot planted and pushed back under the body as it goes, then stepped on ahead - the lead foot first going in,
  // the rear foot first going out (B.fph, the steps' clock, and B.fvx / B.fvz, how fast and which way, are game/boxing.js's)
  const vx = B.fvx;
  const vz = B.fvz;
  const v = Math.hypot(vx, vz);
  if (v > 0.02) {
    const rate = 1.7 + v * 1.5;
    const A = (v / rate) * 0.62;
    const ux = vx / v;
    const uz = vz / v;
    const lift = Math.min(1, v / 0.7) * 0.032;
    for (let i = 0; i < 2; i++) {
      // (going in, the lead foot leads; going back, the rear one)
      const lead = i === 0;
      const ahead = uz >= 0 ? lead : !lead;
      let p = B.fph + (ahead ? 0 : 0.5);
      p -= Math.floor(p);
      let gk;
      let up = 0;
      if (p < 0.62) gk = 0.5 - p / 0.62;
      else {
        const q = (p - 0.62) / 0.38;
        gk = -0.5 + (0.5 - 0.5 * Math.cos(q * Math.PI));
        up = Math.sin(q * Math.PI) * lift;
      }
      if (lead) {
        P.lx += ux * A * gk;
        P.lz += uz * A * gk;
        P.ly += up;
      } else {
        P.rx += ux * A * gk;
        P.rz += uz * A * gk;
        P.ry += up;
      }
    }
    // (a little lower and more over the front foot on the move)
    P.hy -= 0.008 * Math.min(1, v);
    P.lean += 0.02 * uz * Math.min(1, v);
  }
  // between the rounds: the gloves down by the waist, standing easier
  const rs = B.rest;
  if (rs > 0) {
    P.hlx = mix(P.hlx, -0.21, rs);
    P.hly = mix(P.hly, -0.44, rs);
    P.hlz = mix(P.hlz, 0.12, rs);
    P.hrx = mix(P.hrx, 0.21, rs);
    P.hry = mix(P.hry, -0.44, rs);
    P.hrz = mix(P.hrz, 0.12, rs);
    P.elx = mix(P.elx, -0.5, rs);
    P.elz = mix(P.elz, -0.4, rs);
    P.erx = mix(P.erx, 0.5, rs);
    P.erz = mix(P.erz, -0.4, rs);
    P.hy += 0.055 * rs;
    P.lean = mix(P.lean, 0.05, rs);
    P.pA = mix(P.pA, -0.25, rs);
    P.cA = mix(P.cA, -0.3, rs);
    P.hdp = mix(P.hdp, 0, rs);
    P.lz = mix(P.lz, 0.12, rs);
    P.rz = mix(P.rz, -0.1, rs);
    P.rx = mix(P.rx, 0.13, rs);
  }
  // won it: both gloves up over the head
  const ch = B.cheer;
  if (ch > 0) {
    const hop = Math.abs(Math.sin(t * 7)) * 0.035 * ch;
    P.hlx = mix(P.hlx, -0.24, ch);
    P.hly = mix(P.hly, 0.44, ch);
    P.hlz = mix(P.hlz, 0.08, ch);
    P.hrx = mix(P.hrx, 0.24, ch);
    P.hry = mix(P.hry, 0.44, ch);
    P.hrz = mix(P.hrz, 0.08, ch);
    P.elx = mix(P.elx, -1, ch);
    P.ely = mix(P.ely, -0.2, ch);
    P.erx = mix(P.erx, 1, ch);
    P.ery = mix(P.ery, -0.2, ch);
    P.hy += 0.06 * ch + hop;
    P.lean = mix(P.lean, -0.04, ch);
    P.hdp = mix(P.hdp, 0.3, ch);
    P.cA = mix(P.cA, -0.2, ch);
    P.pA = mix(P.pA, -0.2, ch);
  }
  // a punch: its load (and its tell), the strike, held, back to the guard
  if (B.move > 0) punch(P, B);
  // a slip: the head and the chest off the line to a side, the knees giving; slipping right turns the chest right (the lead hook
  // loaded), left turns it left (the cross loaded)
  if (B.slipT >= 0) {
    const s = B.slipT;
    const k = s < 0.07 ? sst(0, 0.07, s) : s < 0.2 ? 1 : 1 - sst(0.2, 0.34, s);
    const d = B.slipDir;
    P.side += d * 0.17 * k;
    P.hx += d * 0.035 * k;
    P.hy -= 0.045 * k;
    P.lean += 0.07 * k;
    P.cA += (d > 0 ? -0.28 : 0.3) * k;
    P.pA += (d > 0 ? -0.08 : 0.1) * k;
    P.hdr -= d * 0.22 * k;
  }
  // the duck: down on the knees, bent ahead from the hips, the gloves still up at the face
  if (B.duckT >= 0) {
    const s = B.duckT;
    const k = s < 0.09 ? sst(0, 0.09, s) : s < 0.26 ? 1 : 1 - sst(0.26, 0.4, s);
    P.hy -= 0.2 * k;
    P.lean += 0.36 * k;
    P.hz -= 0.035 * k;
    P.hdp -= 0.1 * k;
  }
  // a blow taken on the gloves: knocked back into the face, the chin in behind them
  if (B.blockT >= 0 && B.blockT < 0.25) {
    const s = B.blockT;
    const k = (s < 0.03 ? s / 0.03 : Math.max(0, 1 - (s - 0.03) / 0.18)) * B.blockK;
    P.hlz -= 0.06 * k;
    P.hrz -= 0.05 * k;
    P.hly += 0.012 * k;
    P.hry += 0.012 * k;
    P.lean -= 0.07 * k;
    P.hdp -= 0.06 * k;
  }
  // hit: in two frames, and back over a third of a second
  if (B.hitT >= 0 && B.hitT < 0.7) {
    const s = B.hitT;
    const k = B.hitK * (s < 0.035 ? s / 0.035 : Math.exp(-(s - 0.035) * 6.5));
    const hs = B.hitSide;
    const kind = B.hitKind;
    if (kind === 0) {
      // a straight one to the head: snapped back, the chin up, the gloves knocked apart
      P.lean -= 0.3 * k;
      P.hdp += 0.42 * k;
      P.hz -= 0.04 * k;
      P.hlx -= 0.04 * k;
      P.hrx += 0.04 * k;
      P.hlz -= 0.04 * k;
      P.hrz -= 0.04 * k;
      P.side += hs * 0.02 * k;
    } else if (kind === 1) {
      // a hook: the head turned round with it, the body over after it
      P.hdy += hs * 0.65 * k;
      P.hdr -= hs * 0.35 * k;
      P.side += hs * 0.08 * k;
      P.cA += hs * 0.25 * k;
      P.lean -= 0.08 * k;
      P.hlx += hs * 0.05 * k;
      P.hrx += hs * 0.05 * k;
    } else if (kind === 2) {
      // an uppercut: the chin straight up, the back arched
      P.hdp += 0.78 * k;
      P.lean -= 0.22 * k;
      P.hy += 0.012 * k;
      P.hly += 0.04 * k;
      P.hry += 0.04 * k;
    } else {
      // to the body: folded over it, the hips back, the elbow on that side down onto the ribs
      P.lean += 0.38 * k;
      P.hz -= 0.06 * k;
      P.side += hs * 0.05 * k;
      P.hdp -= 0.06 * k;
      P.hy -= 0.05 * k;
      if (hs > 0) P.hry -= 0.13 * k;
      else P.hly -= 0.13 * k;
    }
  }
  // staggered: the knees going, swaying, the gloves down, the head lolling
  const stg = B.stagger;
  if (stg > 0) {
    P.hy -= (0.05 + 0.035 * Math.abs(Math.sin(t * 4.6))) * stg;
    P.side += Math.sin(t * 2.3) * 0.09 * stg;
    P.lean += 0.05 * stg;
    P.hly -= 0.14 * stg;
    P.hry -= 0.14 * stg;
    P.hdr += Math.sin(t * 1.7) * 0.3 * stg;
    P.hdp -= 0.1 * stg;
    P.lx += Math.sin(t * 2.3 + 1) * 0.05 * stg;
    P.rx += Math.sin(t * 2.3 + 2.4) * 0.05 * stg;
  }
  // the knees the way the toes go
  P.klx = Math.sin(P.la);
  P.kly = 0.3;
  P.klz = Math.cos(P.la);
  P.krx = Math.sin(P.ra);
  P.kry = 0.3;
  P.krz = Math.cos(P.ra);
}

// the punch's numbers: how far out the fist is (e: 0 at the guard, 1 at full - a little below 0 cocked back by a tell), how far the
// body has gone into it (b), how loaded it is (w)
function punch(P, B) {
  const D = PUNCH[B.move];
  const mt = B.mt;
  const tell = B.tell;
  const su = Math.max(0.03, B.su);
  let e;
  let b;
  let w = 0;
  if (mt < tell) {
    w = sst(0, tell, mt);
    e = -0.16 * w;
    b = 0;
  } else {
    const u = (mt - tell) / su;
    if (u < 1) {
      e = Math.pow(u, D.path === 0 ? 1.35 : 1.15);
      if (tell > 0) e = mix(-0.16, 1, e);
      b = sst(0, 0.85, u);
      w = (tell > 0 ? 1 - sst(0, 0.5, u) : 0) + D.load * (u < 0.55 ? Math.sin((u / 0.55) * Math.PI) : 0);
    } else {
      const v = (mt - tell - su - B.act) / Math.max(0.05, B.rec);
      if (v <= 0) {
        e = 1 + 0.04 * Math.sin(cl01((mt - tell - su) / Math.max(0.02, B.act)) * Math.PI);
        b = 1;
      } else {
        e = (1 - cl01(v)) * (1 - cl01(v));
        b = 1 - sst(0, 0.8, v);
      }
    }
  }
  // (thrown at nothing: over-reached, the body following the arm - open to be punished)
  const over = B.whiff && b > 0.5 ? (D.path === 0 ? 0.08 : 0.05) * b : 0;
  const lvl = B.body ? 1 : 0;
  P.cA += D.cA * b + D.wcA * w;
  P.pA += D.pA * b + D.wpA * w;
  P.hz += D.hz * b;
  P.lean += D.lean * b + D.wlean * w + over + lvl * 0.09 * b;
  P.side += D.side * b + D.wside * w;
  P.la += D.la * b;
  P.ra += D.ra * b;
  P.lz += D.slide * b;
  P.hy += D.hy * b + D.why * w - lvl * 0.075 * b;
  if (D.hand === 'L') P.shL += D.sh * b;
  else P.shR += D.sh * b;
  // (a body shot: the level changed - down on the knees, over toward the punching hand, the head off the line)
  if (lvl) P.side += (D.hand === 'L' ? -0.05 : 0.05) * b;
  // the target, from the neck: the head (or the body) of whoever is in front (B.aimD centre to centre, B.aimY its height),
  // put in the pose once the neck is known (punchHand)
  B._e = e;
  B._b = b;
}

// the punching hand's place, once the neck is (N, local): straight on, round, or up from under
function punchHand(P, B, nx, ny, nz, S) {
  const D = PUNCH[B.move];
  const e = B._e;
  const L = D.hand === 'L';
  const gx = L ? P.hlx : P.hrx;
  const gy = L ? P.hly : P.hry;
  const gz = L ? P.hlz : P.hrz;
  const side = L ? -1 : 1;
  // (where it lands, from the neck: centred on the target, the fist's front at its face)
  const ty = B.aimY - ny;
  const tz = B.aimD / S - (B.body ? 0.2 : 0.14) - nz;
  // (the further, the straighter the arm and the more of the glove ahead of the wrist)
  const far = cl01((B.aimD / S - 0.7) / 0.32);
  let x;
  let y;
  let z;
  let ex;
  let ey;
  let ez;
  // (the glove's front is a hand's length past the wrist the rig puts: each path's target drawn back by as much as it needs -
  // measured, scratchpad glovegap.mjs - so that it meets the face and does not go into it)
  if (D.path === 0) {
    const tx = (L ? -0.025 : 0.01) - nx;
    x = mix(gx, tx, e);
    y = mix(gy, ty, e);
    z = mix(gz, tz - 0.03 - (B.body ? 0.02 : 0.07) * far, e);
    const k = cl01(e);
    ex = mix(side * 0.35, side * 0.55, k);
    ey = -1;
    ez = mix(-0.12, -0.05, k);
    P[L ? 'nlx' : 'nrx'] = mix(-side * 0.85, 0, k);
    P[L ? 'nly' : 'nry'] = mix(-0.3, -1, k);
    P[L ? 'nlz' : 'nrz'] = 0.1 * (1 - k);
  } else if (D.path === 1) {
    // round: a curve from the guard out wide past the shoulder and in onto the side of the target, the elbow up
    const tx = -0.05 - nx;
    const cx = -0.42;
    const cy = mix(gy, ty, 0.5) + 0.03;
    const cz = 0.22;
    const s = cl01(e);
    const a = (1 - s) * (1 - s);
    const bb = 2 * (1 - s) * s;
    const c = s * s;
    x = a * gx + bb * cx + c * tx;
    y = a * gy + bb * cy + c * ty;
    z = a * gz + bb * cz + c * Math.min(tz + (B.body ? 0.05 : -0.05 - 0.05 * far), 0.62);
    if (e < 0) {
      x = gx - e * 0.12;
      z = gz + e * 0.1;
      y = gy;
    }
    const k = sst(0, 0.5, s);
    ex = mix(side * 0.35, side * 1, k);
    ey = mix(-1, 0.5, k);
    ez = mix(-0.12, -0.3, k);
    P.nlx = mix(0.85, 0, s);
    P.nly = mix(-0.3, -1, s);
    P.nlz = 0;
  } else {
    // up from under: down by the waist with the dip, then driven up into the chin (or under the ribs), the palm to himself
    const tx = 0.02 - nx;
    const uy = ty - (B.body ? 0.02 : 0.15);
    const uz = Math.min(tz - 0.04, 0.52);
    const cx = 0.12;
    const cy = -0.36;
    const cz = 0.12;
    const s = cl01(e);
    const a = (1 - s) * (1 - s);
    const bb = 2 * (1 - s) * s;
    const c = s * s;
    x = a * gx + bb * cx + c * tx;
    y = a * gy + bb * cy + c * uy;
    z = a * gz + bb * cz + c * uz;
    if (e < 0) {
      y = gy + e * 0.5;
      z = gz + e * 0.2;
      x = gx;
    }
    ex = side * 0.25;
    ey = -1;
    ez = mix(-0.15, -0.55, s);
    P.nrx = mix(-0.85, 0, s);
    P.nry = mix(-0.3, 0, s);
    P.nrz = mix(0.1, -1, s);
  }
  if (L) {
    P.hlx = x;
    P.hly = y;
    P.hlz = z;
    P.elx = ex;
    P.ely = ey;
    P.elz = ez;
  } else {
    P.hrx = x;
    P.hry = y;
    P.hrz = z;
    P.erx = ex;
    P.ery = ey;
    P.erz = ez;
  }
}

// on the canvas: sat down hard (SIT), flat on the back (LIE), down on one knee (KNEE)
function sitPose(P, legsK) {
  P.hx = 0;
  P.hy = 0.13;
  P.hz = -0.26;
  P.lean = -0.55;
  P.side = 0;
  P.pA = -0.25;
  P.cA = -0.3;
  P.lx = -0.17;
  P.ly = 0.05;
  P.lz = 0.3;
  P.la = -0.3;
  P.rx = 0.17;
  P.ry = 0.05;
  P.rz = 0.24;
  P.ra = 0.4;
  P.hlx = -0.3;
  P.hly = -0.4;
  P.hlz = 0.02;
  P.hrx = 0.3;
  P.hry = -0.4;
  P.hrz = 0.02;
  P.elx = -0.6;
  P.ely = -1;
  P.elz = -0.2;
  P.erx = 0.6;
  P.ery = -1;
  P.erz = -0.2;
  P.nlx = 0;
  P.nly = 1;
  P.nlz = 0;
  P.nrx = 0;
  P.nry = 1;
  P.nrz = 0;
  P.hdy = 0.1;
  P.hdp = 0.32;
  P.hdr = 0.2;
  P.shL = 0;
  P.shR = 0;
  P.klx = -0.3;
  P.kly = 1;
  P.klz = 0.4;
  P.krx = 0.3;
  P.kry = 1;
  P.krz = 0.4;
}
function liePose(P) {
  P.hx = 0;
  P.hy = 0.125;
  P.hz = -0.36;
  P.lean = -1.46;
  P.side = 0;
  P.pA = -0.15;
  P.cA = -0.12;
  P.lx = -0.2;
  P.ly = 0.05;
  P.lz = 0.05;
  P.la = -0.5;
  P.rx = 0.2;
  P.ry = 0.05;
  P.rz = 0.45;
  P.ra = 0.5;
  P.hlx = -0.58;
  P.hly = -0.08;
  P.hlz = 0.12;
  P.hrx = 0.52;
  P.hry = -0.08;
  P.hrz = -0.2;
  P.elx = -1;
  P.ely = 0.35;
  P.elz = 0.1;
  P.erx = 1;
  P.ery = 0.35;
  P.erz = -0.1;
  P.nlx = 0;
  P.nly = 1;
  P.nlz = 0;
  P.nrx = 0;
  P.nry = 1;
  P.nrz = 0;
  P.hdy = 0.35;
  P.hdp = -0.18;
  P.hdr = 0.55;
  P.shL = 0;
  P.shR = 0;
  P.klx = -0.2;
  P.kly = 1;
  P.klz = 0.3;
  P.krx = 0.1;
  P.kry = 1;
  P.krz = 0.2;
}
function kneePose(P) {
  P.hx = 0.03;
  P.hy = 0.445;
  P.hz = -0.06;
  P.lean = 0.82;
  P.side = 0.02;
  P.pA = -0.3;
  P.cA = -0.4;
  P.lx = -0.12;
  P.ly = 0.04;
  P.lz = 0.32;
  P.la = 0.2;
  P.rx = 0.15;
  P.ry = 0.05;
  P.rz = -0.42;
  P.ra = 0.5;
  P.hlx = -0.04;
  P.hly = -0.3;
  P.hlz = 0.05;
  P.hrx = 0.2;
  P.hry = -0.75;
  P.hrz = 0.18;
  P.elx = -0.4;
  P.ely = -1;
  P.elz = -0.2;
  P.erx = 0.5;
  P.ery = -0.6;
  P.erz = -0.4;
  P.nlx = 0.6;
  P.nly = 0;
  P.nlz = -0.6;
  P.nrx = 0;
  P.nry = -1;
  P.nrz = 0;
  P.hdy = 0.1;
  P.hdp = -0.3;
  P.hdr = 0.1;
  P.shL = 0;
  P.shR = 0;
  P.klx = 0.15;
  P.kly = 0.4;
  P.klz = 1;
  P.krx = 0.1;
  P.kry = -1;
  P.krz = 1;
}

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _pole = new THREE.Vector3();

// a direction in the body's frame, in the world (not scaled, not moved)
function dirW(fig, x, y, z, out) {
  const r = fig.right;
  const f = fig.forward;
  return out.set(r.x * x + f.x * z, y, r.z * x + f.z * z);
}

// the whole pose: the rig's joints from fig.box. ik: the rig's own two-bone solver
export function boxPose(fig, dt, ik) {
  const B = fig.box;
  const j = fig.j;
  const S = fig.scale;
  const L = fig.look;
  const legsK = L.build.legs || 1;
  B.clock += dt;
  B.bph += dt * Math.PI * (1.9 - 0.5 * B.tired);
  // (the steps' clock and the footwork's speed, eased: game/boxing.js gives where the body is going, in its own frame)
  const kv = Math.min(1, dt * 10);
  B.fvx += (B.vx - B.fvx) * kv;
  B.fvz += (B.vz - B.fvz) * kv;
  B.fph += dt * (1.7 + Math.hypot(B.fvx, B.fvz) * 1.5);
  const P = _P;
  standing(P, B, fig, legsK);
  // on the canvas: the fall (onto the seat and back, or onto a knee), the count there, and up again
  if (B.downT >= 0 || B.getupT >= 0) floor(P, B, legsK);
  if (B.m < 0) mirror(P);
  // the joints
  const fem = L.fem;
  const bulk = fig.bulk;
  const sw = (fem ? 0.15 : 0.17) * Math.max(0.9, bulk * 0.96);
  const hw = (fem ? 0.095 : 0.085) * bulk;
  const spine = 0.5;
  const cl = Math.cos(P.lean);
  const sl = Math.sin(P.lean);
  fig.toWorld(P.hx, P.hy, P.hz, j.hip);
  let c = Math.cos(P.pA);
  let s = Math.sin(P.pA);
  fig.toWorld(P.hx + hw * c, P.hy, P.hz + hw * s, j.hipR);
  fig.toWorld(P.hx - hw * c, P.hy, P.hz - hw * s, j.hipL);
  const nx = P.hx + P.side;
  const ny = P.hy + spine * cl;
  const nz = P.hz + spine * sl;
  fig.toWorld(nx, ny, nz, j.neck);
  const hOff = 0.075 - (L.build.neck || 0) + 0.12 * fig.headScale;
  fig.toWorld(P.hx + P.side * 1.25, ny + hOff * cl, nz + hOff * sl, j.headC);
  c = Math.cos(P.cA);
  s = Math.sin(P.cA);
  const shY = 0.07;
  fig.toWorld(nx + sw * c, ny - shY + P.shR, nz + sw * s, j.shoulderR);
  fig.toWorld(nx - sw * c, ny - shY + P.shL, nz - sw * s, j.shoulderL);
  j.shoulder.copy(j.shoulderR);
  // (the punching hand, now that the neck is known: B.move's own path - mirrored for a southpaw)
  if (B.move > 0 && !(B.downT >= 0 || B.getupT >= 0)) {
    if (B.m < 0) {
      mirror(P);
      punchHand(P, B, -nx, ny, nz, S);
      mirror(P);
    } else punchHand(P, B, nx, ny, nz, S);
  }
  // the legs: each foot where the pose has it, the knee bent over the toes
  const legL = 0.47 * legsK * S;
  fig.toWorld(P.rx, P.ry, P.rz, j.footR);
  fig.toWorld(P.rx + Math.sin(P.ra) * 0.13, Math.max(0.03, P.ry - 0.01), P.rz + Math.cos(P.ra) * 0.13, j.toeR);
  fig.toWorld(P.lx, P.ly, P.lz, j.footL);
  fig.toWorld(P.lx + Math.sin(P.la) * 0.13, Math.max(0.03, P.ly - 0.01), P.lz + Math.cos(P.la) * 0.13, j.toeL);
  ik(j.hipR, j.footR, legL, legL, dirW(fig, P.krx, P.kry, P.krz, _pole), j.kneeR);
  ik(j.hipL, j.footL, legL, legL, dirW(fig, P.klx, P.kly, P.klz, _pole), j.kneeL);
  // the arms: each hand at its place (as far as the arm reaches), the elbow the pose's way
  const armK = L.build.arms || 1;
  const aU = 0.31 * armK * S;
  const aF = 0.29 * armK * S;
  const reach = (aU + aF) * 0.999;
  for (let i = 0; i < 2; i++) {
    const R = i === 0;
    const sh = R ? j.shoulderR : j.shoulderL;
    const el = R ? j.elbowR : j.elbowL;
    const hd = R ? j.handR : j.handL;
    fig.toWorld(nx + (R ? P.hrx : P.hlx), ny + (R ? P.hry : P.hly), nz + (R ? P.hrz : P.hlz), _v);
    if (_v.distanceTo(sh) > reach) _v.sub(sh).setLength(reach).add(sh);
    // (never through the canvas)
    const floorY = fig.pos.y + 0.05 * S;
    if (_v.y < floorY) _v.y = floorY;
    dirW(fig, R ? P.erx : P.elx, R ? P.ery : P.ely, R ? P.erz : P.elz, _pole);
    ik(sh, _v, aU, aF, _pole, el);
    hd.copy(_v);
    // the fist: closed, along the forearm, its palm the pose's way
    const F = R ? B._fR : B._fL;
    const N = R ? B._nR : B._nL;
    F.subVectors(hd, el);
    if (F.lengthSq() < 1e-8) F.copy(fig.forward);
    F.normalize();
    dirW(fig, R ? P.nrx : P.nlx, R ? P.nry : P.nly, R ? P.nrz : P.nlz, N);
    N.addScaledVector(F, -N.dot(F));
    if (N.lengthSq() < 1e-6) N.set(0, -1, 0).addScaledVector(F, F.y);
    N.normalize();
  }
  fig.handF[0] = B._fR;
  fig.handF[1] = B._fL;
  fig.handN[0] = B._nR;
  fig.handN[1] = B._nL;
  fig.handGrip[0] = 1;
  fig.handGrip[1] = 1;
  // the head: turned back from the chest's turn to the one in front of him (and round by a blow), the chin down; the look
  // (fig.lookAt: game/boxing.js) with the rig's own springs
  B.hdy = P.hdy - P.cA;
  B.hdp = P.hdp;
  B.hdr = P.hdr;
  fig.turnHead(dt, B.downT >= 0 || B.getupT >= 0 ? 0 : Math.max(0, P.lean) * 0.6);
  fig.chestYaw = 0;
  fig.chestYawV = 0;
  // (no hands in his pockets in a bout)
  fig.pk = 0;
  fig.pkT = 0;
  fig.pocketR = 0;
  fig.pocketL = 0;
}

// the fall and the getting up, blended out of the stance (P) and into it again
function floor(P, B, legsK) {
  const Q = _Q;
  const R = _R;
  if (B.downT >= 0) {
    const t = B.downT;
    if (B.downKind === 1) {
      // onto a knee, folded over the body shot
      kneePose(Q);
      blend(P, Q, sst(0, 0.45, t));
      return;
    }
    // the knees go, he sits down hard and goes over onto his back - a bump at each
    sitPose(Q, legsK);
    liePose(R);
    blend(P, Q, sst(0, 0.38, t));
    blend(P, R, sst(0.3, 0.78, t));
    const b1 = t > 0.36 && t < 0.5 ? Math.sin(((t - 0.36) / 0.14) * Math.PI) : 0;
    const b2 = t > 0.74 && t < 0.86 ? Math.sin(((t - 0.74) / 0.12) * Math.PI) : 0;
    P.hy += 0.022 * b1 + 0.012 * b2;
    P.lean += 0.08 * b2;
    return;
  }
  const t = B.getupT;
  if (B.downKind === 1) {
    kneePose(Q);
    copy(R, P);
    copy(P, Q);
    blend(P, R, sst(0, GETUP_KNEE, t));
    return;
  }
  // up: sat up, over onto a knee, and up into the stance
  const st = _R;
  if (t < 0.5) {
    liePose(Q);
    sitPose(P, legsK);
    blend(P, Q, 1 - sst(0, 0.5, t));
    return;
  }
  if (t < 1.0) {
    sitPose(Q, legsK);
    kneePose(P);
    blend(P, Q, 1 - sst(0.5, 1.0, t));
    return;
  }
  copy(st, P);
  kneePose(P);
  blend(P, st, sst(1.0, GETUP_BACK, t));
}

// a new fig.box: what game/boxing.js writes each frame (and the rig's own clocks)
export function newBox() {
  return {
    m: 1, clock: 0, bph: 0, fph: 0, fvx: 0, fvz: 0, vx: 0, vz: 0, bounce: 1,
    guard: 0, tired: 0, rest: 0, cheer: 0,
    move: 0, body: false, whiff: false, mt: 0, tell: 0, su: 0.1, act: 0.05, rec: 0.15, aimD: 1, aimY: 1.5,
    slipT: -1, slipDir: 1, duckT: -1, blockT: -1, blockK: 1,
    hitT: -1, hitKind: 0, hitSide: 0, hitK: 0, stagger: 0,
    downT: -1, downKind: 0, getupT: -1,
    hdy: 0, hdp: 0, hdr: 0, _e: 0, _b: 0,
    _fR: new THREE.Vector3(), _fL: new THREE.Vector3(), _nR: new THREE.Vector3(), _nL: new THREE.Vector3(),
  };
}
