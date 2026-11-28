import { cityLook, kidLook, elderLook } from './looks.js';
import { CURB } from '../world/mainland/plan.js';

// (v5, ROADMAP 13.2) BAYVIEW MALL's crowd. Over and above the shoppers who go into its stores, ride
// its escalators and eat at its tables (game/mall.js MallLife), the many who are simply there, as in
// the pictures it was drawn from: strolling down the hall between its sights and round its galleries
// floor over floor, standing at the rails looking down, round the cars on their stands and at the
// pool, on their phones. They are drawn the way a party's crowd is (render/people.js drawCheap):
// no more than their walk - they step aside for you. Their ways on the ground floor are worked out
// round its furniture once (the hall's walk grid, MallLife's), and kept.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const KINDS = ['chic', 'street', 'smart', 'summer', 'knit', 'denim', 'casual', 'sporty', 'trench'];

function lookOf() {
  const r = Math.random();
  if (r < 0.07) return kidLook();
  if (r < 0.14) return elderLook(Math.random() < 0.5);
  return cityLook({ kind: pick(KINDS) });
}

export class MallCrowd {
  /** m: the mall (world/mainland/bayview.js: crowdSpots, loops, railSpots; a hall at its side,
   * world/mainland/megamall.js: crowdLoops, crowdScale too), nav: its ground's walk grid */
  constructor(game, m, nav) {
    this.game = game;
    this.m = m;
    this.nav = nav;
    this.list = [];
    this.ways = new Map();
    const touch = game.touch;
    // (a hall at its side: half the great hall's; on a phone a third)
    const k = (m.crowdScale || 1) * (touch && m.crowdScale ? 0.7 : 1);
    const nGround = Math.round((touch ? 44 : 230) * k);
    const nUp = Math.round((touch ? 10 : 32) * k);
    // (a sight in the furniture: the free spot nearest it)
    const spots = (this.spots = []);
    for (const p of m.crowdSpots || []) {
      if (nav.free(p.x, p.z)) spots.push(p);
      else {
        const c = nav.near(p.x, p.z, 8);
        if (c >= 0) spots.push(nav.center(c));
      }
    }
    // the ground floor: walking from one sight to another, or standing at one a while
    for (let i = 0; i < nGround && spots.length > 1; i++) {
      const w = this.walker(0);
      w.at = Math.floor(Math.random() * spots.length);
      const p = spots[w.at];
      w.x = p.x + (Math.random() - 0.5) * 3;
      w.z = p.z + (Math.random() - 0.5) * 3;
      if (!nav.free(w.x, w.z)) {
        w.x = p.x;
        w.z = p.z;
      }
      // (some already on their way, some standing there)
      if (Math.random() < 0.65) this.onward(w);
      else w.wait = Math.random() * 8;
      this.list.push(w);
    }
    // the galleries: round their loops, both ways (the great hall's: one a floor, round the oval; a
    // hall at its side: along each gallery and back); some at the rail
    const loops = m.crowdLoops || (m.loops || []).map((pts, lv) => (pts && lv ? { lv, pts } : null)).filter(Boolean);
    const per = new Map();
    for (const q of loops) per.set(q.lv, (per.get(q.lv) || 0) + 1);
    for (const { lv, pts: loop } of loops) {
      const L = this.lengthOf(loop);
      const n = Math.round(nUp / per.get(lv));
      for (let i = 0; i < n; i++) {
        const w = this.walker(m.levels[lv]);
        w.loop = loop;
        w.loopLen = L;
        w.s = Math.random() * L;
        w.dir = Math.random() < 0.5 ? 1 : -1;
        w.lane = (Math.random() - 0.5) * 1.4;
        // (along a gallery and back: the same side of it both ways, not across it at the turn)
        if (loop.length === 2) w.fixN = [-(loop[1][1] - loop[0][1]) / (L / 2), (loop[1][0] - loop[0][0]) / (L / 2)];
        this.list.push(w);
      }
    }
    for (const lv of per.keys()) {
      const rails = (m.railSpots || []).filter((q) => q.lv === lv);
      const nr = Math.min(rails.length, Math.round((touch ? 3 : 9) * k));
      for (let i = 0; i < nr; i++) {
        const q = rails[Math.floor((i / nr) * rails.length)];
        const w = this.walker(m.levels[lv]);
        w.x = q.x;
        w.z = q.z;
        w.yaw = q.yaw;
        w.speed = 0;
        w.rail = true;
        this.list.push(w);
      }
    }
    // little groups standing about on the ground floor, talking (two, three together)
    const h = m.hall;
    for (let g = 0; g < Math.round((touch ? 8 : 36) * k); g++) {
      let x = 0;
      let z = 0;
      let ok = false;
      for (let t = 0; t < 12 && !ok; t++) {
        x = h.x0 + 3 + Math.random() * (h.x1 - h.x0 - 6);
        z = h.z0 + 8 + Math.random() * (h.z1 - h.z0 - 16);
        ok = nav.free(x, z) && nav.free(x + 1, z) && nav.free(x, z + 1);
      }
      if (!ok) continue;
      const n = 2 + (Math.random() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random();
        const w = this.walker(0);
        w.x = x + Math.cos(a) * 0.55;
        w.z = z + Math.sin(a) * 0.55;
        w.yaw = Math.atan2(x - w.x, z - w.z);
        w.speed = 0;
        w.watch = { x, z };
        this.list.push(w);
      }
    }
    // round the cars on their stands and at the pool: standing, looking
    for (const q of m.cars || []) {
      for (let i = 0; i < (touch ? 3 : 8); i++) {
        const a = Math.random() * Math.PI * 2;
        const w = this.walker(0);
        w.x = q.x + Math.cos(a) * (q.r + 1.3 + Math.random() * 0.8);
        w.z = q.z + Math.sin(a) * (q.r + 1.3 + Math.random() * 0.8);
        if (!nav.free(w.x, w.z)) continue;
        w.yaw = Math.atan2(q.x - w.x, q.z - w.z);
        w.speed = 0;
        w.watch = q;
        this.list.push(w);
      }
    }
  }

  walker(y) {
    const look = lookOf();
    return {
      x: 0, y: CURB + y, z: 0, look, scale: look.build.height || 1, yaw: Math.random() * Math.PI * 2, speed: 0, phase: Math.random() * 6,
      seed: Math.random() * 100, sit: 0, cheer: 0, indoor: 2, pts: null, k: 0, wait: 0, pace: 1.0 + Math.random() * 0.35,
    };
  }

  lengthOf(loop) {
    let L = 0;
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      L += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    return L;
  }

  // the point s of the way along a loop, and which way it goes there
  along(loop, s, out) {
    let t = s;
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (t <= L || i === loop.length - 1) {
        const f = L > 0 ? Math.min(1, t / L) : 0;
        out.x = a[0] + (b[0] - a[0]) * f;
        out.z = a[1] + (b[1] - a[1]) * f;
        out.dx = (b[0] - a[0]) / (L || 1);
        out.dz = (b[1] - a[1]) / (L || 1);
        return out;
      }
      t -= L;
    }
    return out;
  }

  // on to another of the ground floor's sights: the way there round the furniture (kept)
  onward(w) {
    const spots = this.spots;
    let j = Math.floor(Math.random() * spots.length);
    if (j === w.at) j = (j + 1) % spots.length;
    const key = w.at * 1000 + j;
    let way = this.ways.get(key);
    if (!way) {
      const a = spots[w.at];
      const b = spots[j];
      way = this.nav.path(a.x, a.z, b.x, b.z) || [{ x: b.x, z: b.z }];
      this.ways.set(key, way);
    }
    // (each walks it a little to one side, so that they are not all in a file)
    const off = (Math.random() - 0.5) * 1.6;
    w.pts = way.map((p) => ({ x: p.x + off * 0.6, z: p.z + off * 0.4 }));
    w.k = 0;
    w.to = j;
  }

  tick(dt) {
    const pp = this.game.player.pos;
    // (nobody sees them from further off than they are drawn: they wait there)
    const h = this.m.hall;
    const far = Math.hypot(Math.max(h.x0 - pp.x, 0, pp.x - h.x1), Math.max(h.z0 - pp.z, 0, pp.z - h.z1));
    if (far > (this.game.touch ? 45 : 70)) return;
    const _o = { x: 0, z: 0, dx: 0, dz: 1 };
    for (const w of this.list) {
      if (w.loop) {
        // round the gallery's loop at a stroll, a little in or out of its line
        w.s = (w.s + w.dir * w.pace * 0.95 * dt + w.loopLen) % w.loopLen;
        this.along(w.loop, w.s, _o);
        const nx = w.fixN ? w.fixN[0] : -_o.dz;
        const nz = w.fixN ? w.fixN[1] : _o.dx;
        const tx = _o.x + nx * w.lane;
        const tz = _o.z + nz * w.lane;
        w.yaw = Math.atan2(_o.dx * w.dir, _o.dz * w.dir);
        w.x = tx;
        w.z = tz;
        w.speed = w.pace * 1.6;
        w.phase += dt * w.pace * 5.2;
        this.yieldTo(w, pp);
        continue;
      }
      if (w.rail || w.watch) {
        // (standing: now and then a look round, a shift of the weight)
        w.speed = 0;
        w.phase += dt * 0.6;
        if (w.watch && Math.random() < dt * 0.05) w.yaw = Math.atan2(w.watch.x - w.x, w.watch.z - w.z) + (Math.random() - 0.5) * 0.6;
        continue;
      }
      if (w.wait > 0) {
        w.wait -= dt;
        w.speed = 0;
        w.phase += dt * 0.6;
        if (w.wait <= 0) this.onward(w);
        continue;
      }
      if (!w.pts || w.k >= w.pts.length) {
        w.at = w.to !== undefined ? w.to : w.at;
        w.wait = 2 + Math.random() * 9;
        w.pts = null;
        continue;
      }
      const p = w.pts[w.k];
      const dx = p.x - w.x;
      const dz = p.z - w.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.35) {
        w.k++;
        continue;
      }
      const v = Math.min(d, w.pace * 1.15 * dt);
      w.x += (dx / d) * v;
      w.z += (dz / d) * v;
      const want = Math.atan2(dx, dz);
      let da = want - w.yaw;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      w.yaw += da * Math.min(1, dt * 6);
      w.speed = w.pace * 1.7;
      w.phase += dt * w.pace * 5.4;
      this.yieldTo(w, pp);
    }
  }

  // out of your way: a step aside from you as you pass
  yieldTo(w, pp) {
    if (Math.abs(pp.y - w.y) > 1.5) return;
    const dx = w.x - pp.x;
    const dz = w.z - pp.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.9 || d < 1e-3) return;
    const push = (0.9 - d) * 0.5;
    w.x += (dx / d) * push;
    w.z += (dz / d) * push;
  }

  draw() {
    const g = this.game;
    const cam = g.camera.position;
    const bodies = g.figures.bodies;
    const fwd = this._f || (this._f = cam.clone());
    g.camera.getWorldDirection(fwd);
    const far = g.touch ? 45 : 70;
    // (ROADMAP 13.4: from outside its hall - the great hall's crowd from a hall beside it, from the
    // arcade - most of it is behind the walls: whoever the walls hid at the last frame
    // (render/occlusion.js), with a metre to spare all round, is not drawn)
    const h = this.m.hall;
    const outside = cam.x < h.x0 - 2 || cam.x > h.x1 + 2 || cam.z < h.z0 - 2 || cam.z > h.z1 + 2;
    const pipe = g.pipe;
    const occ = outside && pipe && pipe.occlusionOn ? pipe.occlusion : null;
    for (const w of this.list) {
      const dx = w.x - cam.x;
      const dz = w.z - cam.z;
      const d = Math.hypot(dx, dz);
      if (d > far || (d > 3 && (dx * fwd.x + dz * fwd.z) / d < -0.3)) continue;
      if (occ && occ.hidden(w.x - 1, w.y - 0.5, w.z - 1, w.x + 1, w.y + 2.8, w.z + 1)) continue;
      bodies.drawCheap(w);
    }
  }
}
