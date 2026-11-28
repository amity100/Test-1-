import { groundHeight } from '../world/layout.js';
import { nodeAt, lightAt } from '../world/roads.js';
import { VAN, buildVan } from './placevan.js';

// (ROADMAP 29.5) SALT & SPANNER on its round (game/placevan.js is the van itself). A loop of its own, laid along the lanes
// the traffic drives (world/roads.js): from the little beach at the foot of Ocean Drive up the boulevard's curb lane, onto
// the wide sidewalk at the pier's gate, on up to 9th Street, left, left again down Collins, left along 7th Street, right
// onto Ocean Drive going south, into the curb by Hotel Mirage, on to the end of the boulevard and round in a wide loop on
// the open ground by the water, to the beach again. It stops at the lights, waits at its left turns for what comes the
// other way, slows and stops for what is in front of it - a car, a person, you - and the traffic behind it stops for it
// (game/gadgets.js ramps: what the traffic finds in its way, game/traffic.js ahead). At each of its three stops it pulls in
// to the curb, the side lifts, the A-board and a board on a stand come out; three quarters of a minute, longer while you
// are at its counter, and it closes up, signals and goes.

const STEP = 0.5;
const VMAX = 9.5;
const A_LAT = 2.1;
const ACC = 1.7;
const DEC = 3.2;
const DEC_HARD = 7.5;
// the stops: how long, its side up
const STAY = 45;
const OPEN_AT = 1.2;
const OPEN_T = 2.4;
const HATCH_UP = 1.32;
// (where the front axle is behind the front bumper, and the back axle behind it)
const BUMP = VAN.len / 2 - VAN.axleF;
const WB = VAN.axleF - VAN.axleR;

// the round: [x, z, how far before and after the corner it is rounded] - the front axle's line
function waypoints() {
  const W = [];
  // (round the loop on the open ground at the foot of the boulevard, its east side the beach's)
  const cx = 4.5;
  const cz = 326.5;
  const R = 7;
  // (north from the beach, the boulevard's curb lane)
  W.push([11.5, 326.5, 0], [11.0, 306, 0]);
  // (onto the sidewalk at the pier's gate, along it, back into the lane)
  W.push([11.0, 262, 3], [16.0, 250, 4], [16.0, 236, 4], [11.0, 223, 4]);
  // (over into the inner lane for the left turn ahead; up to 9th Street, left; down Collins, left; along 7th, right onto the
  // boulevard going south)
  W.push([11.0, 130, 0], [7.1, 104, 0], [7.1, 27.2, 6.6], [-67.75, 27.2, 12.55], [-67.75, 166.8, 11.6], [3.0, 166.8, 9.8]);
  // (into the curb by Hotel Mirage and out again)
  W.push([3.0, 199.5, 3.5], [-1.55, 207.5, 3.5], [-1.55, 220.5, 3.5], [3.0, 228.5, 3.5]);
  // (on to the end of the boulevard, over to the right, round the loop)
  W.push([3.0, 307, 4], [-2.5, 316.5, 4]);
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI - (i / 16) * Math.PI;
    W.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R, 0]);
  }
  W.pop();
  return W;
}

// the loop as points STEP apart: x, z, the heading, how fast it may go round there
function makePath(W) {
  const n = W.length;
  const dir = (a, b) => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const L = Math.hypot(dx, dz) || 1;
    return [dx / L, dz / L, L];
  };
  // (each corner rounded: a curve from d before it to d after it, the corner its middle)
  const raw = [];
  for (let i = 0; i < n; i++) {
    const A = W[(i - 1 + n) % n];
    const B = W[i];
    const C = W[(i + 1) % n];
    const d = B[2];
    if (!d) {
      raw.push([B[0], B[1]]);
      continue;
    }
    const [ax, az, la] = dir(A, B);
    const [cx2, cz2, lc] = dir(B, C);
    const dd = Math.min(d, la * 0.49, lc * 0.49);
    const p0 = [B[0] - ax * dd, B[1] - az * dd];
    const p2 = [B[0] + cx2 * dd, B[1] + cz2 * dd];
    const m = Math.max(4, Math.ceil(dd * 2));
    for (let k = 0; k <= m; k++) {
      const t = k / m;
      const u = 1 - t;
      raw.push([u * u * p0[0] + 2 * u * t * B[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * B[1] + t * t * p2[1]]);
    }
  }
  raw.push(raw[0]);
  // (the same line, the points STEP apart along it)
  const X = [];
  const Z = [];
  let carry = 0;
  for (let i = 0; i + 1 < raw.length; i++) {
    const a = raw[i];
    const b = raw[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) continue;
    let t = carry;
    while (t < L) {
      X.push(a[0] + ((b[0] - a[0]) * t) / L);
      Z.push(a[1] + ((b[1] - a[1]) * t) / L);
      t += STEP;
    }
    carry = t - L;
  }
  const N = X.length;
  const yaw = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const k = (i - 1 + N) % N;
    yaw[i] = Math.atan2(X[j] - X[k], Z[j] - Z[k]);
  }
  // (round a bend no faster than its sideways pull allows)
  const cap = new Float32Array(N);
  const span = 4;
  for (let i = 0; i < N; i++) {
    let dh = yaw[(i + span) % N] - yaw[(i - span + N) % N];
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const k = Math.abs(dh) / (2 * span * STEP);
    cap[i] = k > 1e-4 ? Math.min(VMAX, Math.sqrt(A_LAT / k)) : VMAX;
  }
  return { x: Float32Array.from(X), z: Float32Array.from(Z), yaw, cap, n: N, len: N * STEP };
}

const _o = { x: 0, z: 0 };
const _f = { x: 0, z: 0 };
const _r = { x: 0, z: 0 };

export class VanDriver {
  constructor(game, M) {
    this.game = game;
    this.P = makePath(waypoints());
    const m = buildVan(M);
    Object.assign(this, m);
    this.group.matrixAutoUpdate = false;
    // the stops (the front axle's place on the line), the lights and the turns across the traffic
    this.stops = [
      { name: 'beach', ...this.at(11.5, 326.5 - 5.5 - VAN.axleF) },
      { name: 'pier', ...this.at(16.0, 243 - VAN.axleF) },
      { name: 'hotel', ...this.at(-1.55, 214 + VAN.axleF) },
    ];
    // (a light's line: where the front bumper stops; yield: the lane of what comes the other way - a box, the way it comes)
    this.gates = [
      { node: nodeAt(3, 4), axis: 'ns', ...this.at(11.0, 172 + BUMP) },
      { node: nodeAt(3, 3), axis: 'ns', ...this.at(7.1, 36 + BUMP), yield: { x0: 0.5, z0: -60, x1: 6.2, z1: 35, fx: 0, fz: 1 } },
      { node: nodeAt(2, 3), axis: 'ew', ...this.at(-55.2 + BUMP, 27.2), yield: { x0: -132, z0: 29.4, x1: -58, z1: 34.5, fx: 1, fz: 0 } },
      { node: nodeAt(2, 4), axis: 'ns', ...this.at(-67.75, 155.2 - BUMP), yield: { x0: -66, z0: 159, x1: -58.5, z1: 238, fx: 0, fz: -1 } },
      { node: nodeAt(3, 4), axis: 'ew', ...this.at(-6.8 - BUMP, 166.8) },
    ];
    // where it is: its front axle's distance round the loop, its speed; stopped at a stop: which, for how long
    this.s = this.stops[1].s;
    this.v = 0;
    this.stop = this.stops[1];
    this.stopT = STAY * 0.35;
    this.left = -1;
    this.lastStop = null;
    this.outT = 0;
    this.pos = { x: 0, y: 0.15, z: 0 };
    this.yawNow = 0;
    this.steer = 0;
    this.spin = 0;
    this.yv = 0.15;
    this.hatchA = HATCH_UP;
    this.t = 0;
    this.why = '';
    this.waitT = 0;
    this.yieldT = 0;
    // its drawing: the board inside the side that lifts (the same object, kept up to date)
    this.spot = { x: 0, y: 0, z: 0, nx: 1, ny: 0, nz: 0, ux: 0, uy: 1, uz: 0, w: 3.0, parked: true, moves: true };
    // what the traffic finds in its way (game/traffic.js ahead, by game/gadgets.js ramps), its front, middle and back
    // (as wide as one of the traffic's own of its width: game/traffic.js ahead, 0.8 + its half width over a car's)
    // (what free() is working with: the van's nose, its look ahead, the nearest found)
    this.fw = { look: 0, sF: 0, fx: 0, fz: 1, bx: 0, bz: 0, reach: 0, best: Infinity, who: null };
    this.blockers = [-2.2, 0, 2.2].map(() => ({ cx: 0, cz: 0, r: 0.8 + (VAN.half - 0.98), back: 0 }));
    this.boxes = null;
    this.pose(0);
  }

  // the point of the loop nearest (x, z): its s
  at(x, z) {
    const P = this.P;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < P.n; i++) {
      const d = (P.x[i] - x) ** 2 + (P.z[i] - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return { s: best * STEP, x, z, off: Math.sqrt(bd) };
  }

  // the loop at s (out: x, z)
  sample(s, out) {
    const P = this.P;
    let u = (s % P.len) / STEP;
    if (u < 0) u += P.n;
    const i = Math.floor(u) % P.n;
    const j = (i + 1) % P.n;
    const t = u - Math.floor(u);
    out.x = P.x[i] + (P.x[j] - P.x[i]) * t;
    out.z = P.z[i] + (P.z[j] - P.z[i]) * t;
    return out;
  }

  // ahead of s by (mod the loop's length)
  ahead(sEv) {
    const L = this.P.len;
    let d = (sEv - this.s) % L;
    if (d < -L / 2) d += L;
    if (d > L / 2) d -= L;
    return d;
  }

  // the colliders and the traffic's notice of it, once
  attach() {
    const g = this.game;
    const col = g.world.collision;
    // (each registered over the whole of the loop's ground, then moved with the van: the grid finds it wherever it is)
    if (col && !this.boxes) this.boxes = [0, 1, 2].map(() => col.boxes[col.addBox(-76, 18, 20, 340, 0.35, 3.2, 'car')]);
    const G = g.gadgets;
    if (G && G.ramps) for (const b of this.blockers) if (!G.ramps.includes(b)) G.ramps.push(b);
  }

  detach() {
    const g = this.game;
    if (this.boxes) for (const b of this.boxes) b.alive = false;
    this.boxes = null;
    const G = g.gadgets;
    if (G && G.ramps) for (const b of this.blockers) {
      const k = G.ramps.indexOf(b);
      if (k >= 0) G.ramps.splice(k, 1);
    }
  }

  // ------------------------------------------------------------------ a step of it
  update(dt) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t += dt;
    if (this.stop) this.atStop(dt);
    else this.drive(dt);
    this.pose(dt);
  }

  // stopped at a stop: the side up, the things out; then shut, and on
  atStop(dt) {
    const S = this.stop;
    this.v = 0;
    this.stopT += dt;
    const p = this.game.player;
    // (while you are at its counter - near its side, on foot, or copying from it - it waits)
    const near = p && !p.inVehicle && Math.abs(p.pos.y - this.pos.y) < 3 && Math.hypot(p.pos.x - this.spot.x, p.pos.z - this.spot.z) < 6;
    const F = this.game.finds;
    const copying = F && F.copying && F.copying.live === this.spot;
    const close = STAY - OPEN_T - 0.6;
    if ((near || copying) && this.stopT > close - 2) this.stopT = Math.max(OPEN_AT + OPEN_T, close - 2);
    const t = this.stopT;
    const k = t < OPEN_AT ? 0 : t < OPEN_AT + OPEN_T ? (t - OPEN_AT) / OPEN_T : t < close ? 1 : Math.max(0, 1 - (t - close) / OPEN_T);
    this.hatchA = HATCH_UP * (k * k * (3 - 2 * k));
    this.spot.parked = t >= OPEN_AT + OPEN_T && t < close;
    this.stall.visible = t > OPEN_AT + 0.6 && t < close + OPEN_T * 0.5;
    if (t >= STAY) {
      this.lastStop = S;
      this.stop = null;
      this.outT = 0;
      this.spot.parked = false;
      this.stall.visible = false;
      this.hatchA = 0;
    }
  }

  drive(dt) {
    const P = this.P;
    const s = this.s;
    let want = VMAX;
    this.why = '';
    // (the bends ahead: no faster than it can slow down for them)
    const n = Math.ceil(32 / STEP);
    const i0 = Math.floor(s / STEP);
    for (let k = 0; k < n; k++) {
      const i = (i0 + k) % P.n;
      const d = Math.max(0, k * STEP - (s - i0 * STEP));
      const v = Math.sqrt(P.cap[i] * P.cap[i] + 2 * DEC * d);
      if (v < want) want = v;
    }
    // (the next stop)
    for (const S of this.stops) {
      if (S === this.lastStop && this.outT < 20) continue;
      const d = this.ahead(S.s);
      if (d < -0.5 || d > 45) continue;
      const v = Math.sqrt(2 * DEC * 0.8 * Math.max(0, d));
      if (v < want) {
        want = v;
        this.why = 'stop';
      }
      if (d < 0.25 && this.v < 0.6) {
        this.stop = S;
        this.stopT = 0;
        this.s = S.s;
        this.v = 0;
        return;
      }
    }
    // (the lights, and across the traffic coming the other way)
    const time = this.game.traffic ? this.game.traffic.time : 0;
    for (const G of this.gates) {
      const d = this.ahead(G.s);
      if (d < -0.2 || d > 40) continue;
      let red = G.node ? lightAt(G.node, G.axis, time) !== 'g' : false;
      // (on the yellow, close to the line: through)
      if (red && G.node && lightAt(G.node, G.axis, time) === 'y' && this.v * this.v > 2 * 4.5 * Math.max(0.1, d)) red = false;
      if (!red && G.yield && d < 14 && this.oncoming(G.yield)) red = true;
      if (!red) continue;
      // (stopped once at its line, it waits there)
      const v = Math.sqrt(2 * DEC * Math.max(0, d - 0.1));
      if (v < want) {
        want = v;
        this.why = 'light';
      }
    }
    // (what is in front of it: a car, a person, you)
    const free = this.free();
    if (free < Infinity) {
      const v = Math.sqrt(2 * DEC_HARD * 0.6 * Math.max(0, free - 1.6));
      if (v < want) {
        want = v;
        this.why = 'way';
      }
    }
    if (want > this.v) this.v = Math.min(want, this.v + ACC * dt);
    else this.v = Math.max(want, this.v - (free < 6 ? DEC_HARD : DEC * 1.8) * dt);
    this.braking = this.v < this.vPrev - 0.02 || (this.v < 0.15 && want < 0.3);
    this.vPrev = this.v;
    this.waitT = this.v < 0.15 ? this.waitT + dt : 0;
    // (held up in a crossing by one of the traffic that is held up by it in turn - a car across its way, stopped for it:
    // for a few seconds it lets that one see past it, its notice kept at its back only, for whoever is behind it)
    const o = this.fw.who;
    if (this.why === 'way' && this.waitT > 4 && o && o.halfLen !== undefined && Math.abs(o.speed || 0) < 0.3 && this.yieldT <= 0) {
      let dh = (o.yaw || 0) - this.yawNow;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      if (Math.abs(dh) > 0.6) this.yieldT = 5;
    }
    if (this.yieldT > 0) this.yieldT -= dt;
    this.s = (this.s + this.v * dt) % P.len;
    this.outT += dt;
  }

  // anything of the traffic in a lane coming the other way across its turn
  oncoming(Y) {
    const T = this.game.traffic;
    if (!T) return false;
    for (const c of T.list) {
      const x = c.pos.x;
      const z = c.pos.z;
      if (x < Y.x0 || x > Y.x1 || z < Y.z0 || z > Y.z1) continue;
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      if (fx * Y.fx + fz * Y.fz > 0.5 && (Math.abs(c.speed) > 0.4 || c.dead)) return true;
    }
    return false;
  }

  // how far ahead of its front bumper the first thing in its way is (Infinity: none, within its look)
  free() {
    const g = this.game;
    const F = this.fw;
    F.look = Math.max(9, (this.v * this.v) / (2 * DEC) + 7);
    F.sF = this.s + BUMP * 0.5;
    F.fx = Math.sin(this.yawNow);
    F.fz = Math.cos(this.yawNow);
    F.bx = this.pos.x + F.fx * VAN.len * 0.5;
    F.bz = this.pos.z + F.fz * VAN.len * 0.5;
    F.reach = F.look + 4;
    F.best = Infinity;
    F.who = null;
    const p = g.player;
    if (p) {
      if (p.inVehicle) {
        const v = p.inVehicle;
        if (!(v.flies && v.alt > 2)) this.testLong(v.pos.x, v.pos.z, v.yaw || 0, (v.halfLen || 2.3) * 0.7, 1.0, v);
      } else if (p.mode !== 'dead') this.testAt(p.pos.x, p.pos.z, 0.45, p);
    }
    const V = g.vehicles ? g.vehicles.list : null;
    if (V) {
      for (let i = 0; i < V.length; i++) {
        const v = V[i];
        if (v.dead || (p && p.inVehicle === v) || (v.flies && v.alt > 2)) continue;
        this.testLong(v.pos.x, v.pos.z, v.yaw || 0, (v.halfLen || 2.0) * 0.7, 1.0, v);
      }
    }
    const T = g.traffic ? g.traffic.list : null;
    if (T) for (let i = 0; i < T.length; i++) this.testLong(T[i].pos.x, T[i].pos.z, T[i].yaw, (T[i].halfLen || 2.3) * 0.75, T[i].halfWid || 1.0, T[i]);
    const H = g.civilians ? g.civilians.list : null;
    if (H) {
      for (let i = 0; i < H.length; i++) {
        const h = H[i];
        if (!h.inside && !h.gone && h.alive !== false) this.testAt(h.pos.x, h.pos.z, 0.4, h);
      }
    }
    const E = g.enemies ? g.enemies.list : null;
    if (E) for (let i = 0; i < E.length; i++) if (E[i].alive) this.testAt(E[i].pos.x, E[i].pos.z, 0.45, E[i]);
    return F.best;
  }

  // a long thing (a car): its back, middle and front
  testLong(x, z, yaw, hl, r, who) {
    const sx = Math.sin(yaw) * hl;
    const sz = Math.cos(yaw) * hl;
    this.testAt(x - sx, z - sz, r, who);
    this.testAt(x, z, r, who);
    this.testAt(x + sx, z + sz, r, who);
  }

  // one thing at (x, z), r round: on the van's way ahead (within its look)? the nearest so far kept
  testAt(x, z, r, who) {
    const F = this.fw;
    const dx = x - F.bx;
    const dz = z - F.bz;
    if (dx > F.reach || dx < -F.reach || dz > F.reach || dz < -F.reach) return;
    // (not behind its nose)
    if (dx * F.fx + dz * F.fz < -2.5) return;
    const lim = VAN.half + r + 0.3;
    const steps = Math.ceil(F.look / STEP);
    for (let k = 0; k <= steps; k++) {
      const ds = k * STEP;
      if (ds >= F.best) return;
      this.sample(F.sF + ds, _o);
      const ex = x - _o.x;
      const ez = z - _o.z;
      if (ex * ex + ez * ez < lim * lim) {
        F.best = Math.max(0, ds - r - BUMP * 0.5);
        F.who = who;
        return;
      }
    }
  }

  // ------------------------------------------------------------------ where it is, how it stands
  pose(dt) {
    const P = this.P;
    // (its front axle on the line, its back axle on the line WB behind: the back cuts the corners, as a van's does)
    const F = this.sample(this.s, _f);
    const R = this.sample(this.s - WB, _r);
    let fx = F.x - R.x;
    let fz = F.z - R.z;
    const L = Math.hypot(fx, fz) || 1;
    fx /= L;
    fz /= L;
    const yaw = Math.atan2(fx, fz);
    const x = R.x - fx * VAN.axleR;
    const z = R.z - fz * VAN.axleR;
    // (the line's own heading at the front: the wheels turned to it)
    const i = Math.floor(((this.s % P.len) + P.len) % P.len / STEP) % P.n;
    let st = P.yaw[(i + 2) % P.n] - yaw;
    while (st > Math.PI) st -= Math.PI * 2;
    while (st < -Math.PI) st += Math.PI * 2;
    this.steer = Math.max(-0.6, Math.min(0.6, st * 1.6));
    // (up the curb onto the sidewalk and down off it: eased)
    const gy = Math.max(groundHeight(x, z), groundHeight(x + fx * 2.2, z + fz * 2.2), groundHeight(x - fx * 2.2, z - fz * 2.2));
    this.yv = dt > 0 ? this.yv + (gy - this.yv) * Math.min(1, dt * 6) : gy;
    this.pos.x = x;
    this.pos.z = z;
    this.pos.y = this.yv;
    this.yawNow = yaw;
    const G = this.group;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    G.matrix.set(c, 0, s, x, 0, 1, 0, this.yv, -s, 0, c, z, 0, 0, 0, 1);
    G.matrixWorldNeedsUpdate = true;
    // the wheels round, the front ones turned
    this.spin += (this.v * dt) / VAN.wheelR;
    this.rear.rotation.x = this.spin;
    this.fl.rotation.set(this.spin, this.steer, 0, 'YXZ');
    this.fr.rotation.set(this.spin, this.steer, 0, 'YXZ');
    this.hatch.rotation.z = -this.hatchA;
    // the lamps: the indicators (into a stop, out of one, the turns), the brake lights
    let side = 0;
    if (this.stop) side = 0;
    else {
      if (this.lastStop && this.outT < 5) side = 1;
      for (const S of this.stops) {
        const d = this.ahead(S.s);
        if (d > 0 && d < 30 && !(S === this.lastStop && this.outT < 20)) side = -1;
      }
      if (!side) {
        // (a turn within 28 m: its way)
        const j = (i + Math.round(28 / STEP)) % P.n;
        let dh = P.yaw[j] - yaw;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        if (Math.abs(dh) > 0.9) side = dh > 0 ? 1 : -1;
      }
    }
    const on = side !== 0 && this.t % 0.72 < 0.38;
    this.blinkL.visible = on && side > 0;
    this.blinkR.visible = on && side < 0;
    this.brake.visible = !this.stop && !!this.braking;
    // the traffic's notice of it
    for (let k = 0; k < 3; k++) {
      const o = this.yieldT > 0 ? -2.6 : (k - 1) * 2.2;
      this.blockers[k].cx = x + fx * o;
      this.blockers[k].cz = z + fz * o;
    }
    // its body solid, in three lengths, each the box round it
    if (this.boxes) {
      for (let k = 0; k < 3; k++) {
        const z0 = -VAN.len / 2 + (k * VAN.len) / 3;
        const z1 = z0 + VAN.len / 3;
        let ax0 = Infinity;
        let ax1 = -Infinity;
        let az0 = Infinity;
        let az1 = -Infinity;
        for (let q = 0; q < 4; q++) {
          const lz = q < 2 ? z0 : z1;
          const lx = q % 2 ? VAN.half : -VAN.half;
          const wx = x + lx * c + lz * s;
          const wz = z - lx * s + lz * c;
          if (wx < ax0) ax0 = wx;
          if (wx > ax1) ax1 = wx;
          if (wz < az0) az0 = wz;
          if (wz > az1) az1 = wz;
        }
        const b = this.boxes[k];
        // (a box turned with it is wider than it: in a little on the long sides while it turns)
        const shrink = Math.min(0.5, Math.abs(Math.sin(yaw) * Math.cos(yaw)) * 0.9);
        b.x0 = ax0 + shrink;
        b.x1 = ax1 - shrink;
        b.z0 = az0 + shrink;
        b.z1 = az1 - shrink;
        b.y0 = this.yv + 0.35;
        b.y1 = this.yv + VAN.roof;
      }
    }
    // its drawing: on the board inside, a metre in from its right side, looking out of it
    const lx = VAN.boardX - 0.012;
    const ly = VAN.floor + 1.11;
    const lz = (VAN.boardZ0 + VAN.boardZ1) / 2;
    const S = this.spot;
    S.x = x + lx * c + lz * s;
    S.y = this.yv + ly;
    S.z = z - lx * s + lz * c;
    S.nx = -c;
    S.ny = 0;
    S.nz = s;
  }
}
