import * as THREE from 'three';
import { Streamer } from './mainland/stream.js';
import { buildStock } from './rooms.js';

// (v5, ROADMAP 11.18) The insides of the shops, streamed in. A shop of the real world is a thousand
// small things - the cans, the boxes, the bottles, the clothes on their hangers - and the city has
// hundreds of shops: all of them built at once would be millions of corners nobody is near. The
// rooms are laid out with their blocks (world/rooms.js: the walls, the floor, the big furniture,
// where people stand); what stands on the shelves is built here when you come near a shop (inside
// 40 m: across the street you see it full), a little a frame, shown in one frame when it is all
// there, and let go of when you have gone (past 65 m). The way the big games do their interiors.

const NEAR = 40;
const FAR = 65;

let seq = 0;

export class Interiors {
  constructor(world, o = {}) {
    this.world = world;
    this.pipe = o.pipe || null;
    this.warmFn = o.warm || null;
    this.low = !!o.low;
    // (the groups its rooms are shown in: the mainland's buckets, or one of its own)
    this.buckets = world.buckets && world.buckets.length ? world.buckets : null;
    if (!this.buckets) {
      const g = new THREE.Group();
      g.name = 'interiors';
      g.matrixAutoUpdate = false;
      world.group.add(g);
      this.buckets = [g];
    }
    this.stream = new Streamer([], { budget: o.low ? 2 : 2.5, rush: o.low ? 5 : 7, warm: this.warmFn });
    this.byRec = new Map();
    this.verts = 0;
  }

  // the rooms of a part of the city (the island's, at the start; a block's, when it is shown)
  addAll(recs) {
    for (const rec of recs || []) {
      if (this.byRec.has(rec)) continue;
      const id = `room${seq++}`;
      const r = rec.r || 4;
      const cell = {
        id,
        rect: { x0: rec.x - r, x1: rec.x + r, z0: rec.z - r, z1: rec.z + r },
        near: this.low ? NEAR - 8 : NEAR,
        far: FAR,
        rec,
        build: (c) => this.build(c),
      };
      this.byRec.set(rec, id);
      this.stream.add(cell);
    }
  }

  removeAll(recs) {
    for (const rec of recs || []) {
      const id = this.byRec.get(rec);
      if (id === undefined) continue;
      this.byRec.delete(rec);
      this.stream.remove(id);
    }
  }

  *build(c) {
    const world = this.world;
    const group = new THREE.Group();
    group.name = `stock ${c.rec.kind}`;
    group.visible = false;
    const res = yield* buildStock(c.rec, world.ctx.M, group, { merge: world.merge });
    let h = 0;
    for (let i = 0; i < c.id.length; i++) h = (h * 31 + c.id.charCodeAt(i)) >>> 0;
    const bucket = this.buckets[h % this.buckets.length];
    const self = this;
    const live = {
      group,
      verts: res.verts,
      attach() {
        bucket.add(group);
        group.updateMatrixWorld(true);
        if (self.pipe) self.pipe.addStatic(group);
        group.visible = true;
        self.verts += res.verts;
      },
      detach() {
        if (self.pipe) self.pipe.removeStatic(group);
        if (group.parent) group.parent.remove(group);
        live.dispose();
        self.verts -= res.verts;
      },
      dispose() {
        group.traverse((m) => {
          if (m.isMesh) m.geometry.dispose();
        });
      },
    };
    return live;
  }

  update(x, z, vx = 0, vz = 0) {
    this.stream.update(x, z, vx, vz);
    // (where the shops crowd together - a mall - the ring they are filled in narrows, so the
    // corners on the shelves stay within what the graphics card is given: about a million on a
    // computer, less than half that on a phone)
    const most = this.low ? 450000 : 1200000;
    const st = this.stream;
    if (this.verts > most) st.scale = Math.max(0.55, st.scale * 0.985);
    else if (this.verts < most * 0.8) st.scale = Math.min(1, st.scale * 1.01);
  }

  // everything near p now (the start; a jump across the map; the tests)
  fill(x, z, ms = 20000) {
    this.stream.fill(x, z, ms);
  }

  info() {
    return { ...this.stream.info(), verts: this.verts, rooms: this.byRec.size, scale: +this.stream.scale.toFixed(2) };
  }
}
