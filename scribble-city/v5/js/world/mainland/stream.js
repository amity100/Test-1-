import * as THREE from 'three';

// (v5, ROADMAP 11.17) The streamer: the city too big to be built at once is built where you are.
//
// Every cell (a block of buildings, a tile of streets, a mall's inside) says where it is (a rect)
// and how it is built: a generator that does a little at a time (a lot, a building, a pen's merge)
// and yields between. Each frame the streamer spends a slice of time (a few milliseconds, more
// when you are about to reach a cell that is not there yet) building the nearest cell you need,
// and lets go of the ones you have left far behind (their meshes, their collision boxes, their
// lights and shops go with them). A cell is shown only when it is all there, in one frame, so
// nothing is ever half built in front of you; and what the graphics card needs of it goes up a
// mesh a frame before that (render.js warm), so showing it costs nothing.

const _v = new THREE.Vector3();

export class Streamer {
  /**
   * cells: [{ id, rect: {x0,x1,z0,z1}, near: m (built within), far: m (let go beyond),
   *           build(cell) -> generator yielding while it works, returning a 'live' object
   *           { group, attach(), detach() } }]
   * o: { budget: ms a frame, rush: ms when a cell is close and missing, warm(mesh) }
   */
  constructor(cells, o = {}) {
    this.cells = cells;
    this.budget = o.budget || 3;
    // (a phone: after a slow frame, less building in the next one - unless what is missing is right
    // by you)
    this.adaptive = !!o.adaptive;
    this.lastAt = 0;
    this.rush = o.rush || 9;
    this.warm = o.warm || null;
    this.scale = 1;
    // (the height you are at, for the cells that have one: null, none)
    this.y = null;
    this.job = null;
    this.live = new Map();
    this.stats = { built: 0, freed: 0, ms: 0, last: '' };
    // what to warm up before a finished cell is shown (its meshes, one a frame)
    this.pending = [];
    // cells to build again while the old one stays shown (a house drawn on a plot)
    this.redo = [];
  }

  // a cell built again in the background: shown in place of the old one, in one frame, when it is
  // all there (the old one stays until then)
  rebuild(id) {
    const c = this.cells.find((x) => x.id === id);
    if (!c || !this.live.has(id) || this.redo.includes(c) || (this.job && this.job.cell === c)) return false;
    this.redo.push(c);
    return true;
  }

  // (v5, ROADMAP 11.18) cells that come and go with what they are in (the rooms of a block of the
  // mainland: world/interiors.js)
  add(cell) {
    this.cells.push(cell);
  }

  remove(id) {
    const i = this.cells.findIndex((c) => c.id === id);
    if (i >= 0) this.cells.splice(i, 1);
    if (this.job && this.job.cell.id === id) {
      // (left half built: what it holds is let go of, world/interiors.js)
      this.job.it.return();
      this.job = null;
    }
    if (this.pending.length) {
      this.pending = this.pending.filter((p) => {
        if (p.cell.id !== id) return true;
        if (p.live.dispose) p.live.dispose();
        return false;
      });
    }
    if (this.live.has(id)) this.free(id);
  }

  // a cell built and warmed: into the city (the one it takes the place of out, the same frame)
  show(p) {
    if (p.swap) {
      const old = this.live.get(p.cell.id);
      if (old) {
        this.live.delete(p.cell.id);
        old.detach();
      }
    }
    p.live.attach();
    this.live.set(p.cell.id, p.live);
    this.stats.built++;
  }

  distTo(c, x, z) {
    const R = c.rect;
    const dx = x < R.x0 ? R.x0 - x : x > R.x1 ? x - R.x1 : 0;
    const dz = z < R.z0 ? R.z0 - z : z > R.z1 ? z - R.z1 : 0;
    // (ROADMAP 11.45: a cell on another floor - a store up in a mall, over you or under you - is
    // further off by the floors between: hidden by them)
    const dy = c.y !== undefined && this.y !== null ? Math.max(0, Math.abs(this.y - c.y) - 1.5) * 2 : 0;
    return Math.hypot(dx, dz) + dy;
  }

  // the cell to build next: the nearest one wanted and not there (ahead of you counts nearer)
  pick(x, z, vx, vz) {
    let best = null;
    let bd = Infinity;
    for (const c of this.cells) {
      if (this.live.has(c.id) || c.failed) continue;
      // (looking ahead: where you will be in two seconds)
      const d = Math.min(this.distTo(c, x, z), this.distTo(c, x + vx * 2, z + vz * 2) + 8);
      if (d > c.near * this.scale) continue;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best ? { c: best, d: bd } : null;
  }

  update(x, z, vx = 0, vz = 0, y = null) {
    this.y = y;
    const t0 = performance.now();
    const lastAt = this.lastAt;
    this.lastAt = t0;
    // let go of what is far behind (one a frame)
    for (const [id, l] of this.live) {
      const c = l.cell;
      if (this.distTo(c, x, z) > c.far * this.scale) {
        this.free(id);
        break;
      }
    }
    // a cell built and warming: one mesh a frame up to the graphics card, then shown
    if (this.pending.length) {
      const p = this.pending[0];
      if (p.meshes.length && this.warm) {
        // (ROADMAP 11.47: its shaders not made yet - waited for, the frames going on)
        if (this.warm(p.meshes[p.meshes.length - 1]) !== false) p.meshes.pop();
        return;
      }
      this.pending.shift();
      this.show(p);
      return;
    }
    if (!this.job && this.redo.length) {
      const c = this.redo.shift();
      if (this.live.has(c.id)) this.job = { cell: c, it: c.build(c), ms: 0, swap: true };
    }
    if (!this.job) {
      const n = this.pick(x, z, vx, vz);
      if (!n) return;
      this.job = { cell: n.c, it: n.c.build(n.c), ms: 0 };
    }
    // the slice of time: more when the cell is close to you and not there
    const near = this.distTo(this.job.cell, x, z);
    let slice = near < 70 ? this.rush * 1.6 : near < 140 ? this.rush : this.budget;
    if (this.adaptive) {
      const gap = lastAt ? t0 - lastAt : 0;
      if (gap > 45 && near > 40) slice = Math.min(slice, near < 140 ? this.rush * 0.5 : this.budget * 0.5);
    }
    const job = this.job;
    for (;;) {
      let r;
      try {
        r = job.it.next();
      } catch (e) {
        console.error('[stream] cell failed', job.cell.id, e);
        job.cell.failed = true;
        this.job = null;
        return;
      }
      if (r.done) {
        const live = r.value;
        this.job = null;
        job.ms += performance.now() - t0;
        this.stats.ms = Math.round(job.ms);
        this.stats.last = job.cell.id;
        live.cell = job.cell;
        const meshes = [];
        if (live.group) live.group.traverse((m) => m.isMesh && meshes.push(m));
        this.pending.push({ cell: job.cell, live, meshes, swap: !!job.swap });
        return;
      }
      if (performance.now() - t0 > slice) break;
    }
    job.ms += performance.now() - t0;
  }

  free(id) {
    const l = this.live.get(id);
    if (!l) return;
    this.live.delete(id);
    l.detach();
    this.stats.freed++;
  }

  // build everything wanted right now, all at once (the start, and a jump across the map)
  fill(x, z, maxMs = 20000, y = null) {
    this.y = y;
    const t0 = performance.now();
    for (;;) {
      while (this.pending.length) {
        const p = this.pending.shift();
        for (const m of p.meshes) if (this.warm) this.warm(m);
        this.show(p);
      }
      if (!this.job) {
        const n = this.pick(x, z, 0, 0);
        if (!n) break;
        this.job = { cell: n.c, it: n.c.build(n.c), ms: 0 };
      }
      let r;
      try {
        r = this.job.it.next();
      } catch (e) {
        console.error('[stream] cell failed', this.job.cell.id, e);
        this.job.cell.failed = true;
        this.job = null;
        continue;
      }
      if (r.done) {
        const live = r.value;
        live.cell = this.job.cell;
        const swap = !!this.job.swap;
        this.job = null;
        const meshes = [];
        if (live.group) live.group.traverse((m) => m.isMesh && meshes.push(m));
        this.pending.push({ cell: live.cell, live, meshes, swap });
      }
      if (performance.now() - t0 > maxMs) break;
    }
  }

  // how much is live (for the perf HUD and the tests)
  info() {
    return { live: this.live.size, job: this.job ? this.job.cell.id : null, pending: this.pending.length, ...this.stats };
  }
}

export { _v };
