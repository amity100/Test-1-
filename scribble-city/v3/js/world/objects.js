import { shared } from '../render/materials.js';

// Removable props (street lamps, hydrants, parked cars, trees...) and the rubbed-out spots
// of the city drawing. Every prop gets an id that is stamped on its vertices and strokes;
// rubbing a prop out flips its texel in uObjMask so the shaders crumble it away, and its
// collision boxes, sprites and hiding spots go with it.

// how much rubbing each kind of prop takes before it is gone
const INK = {
  lamp: 70, light: 90, hydrant: 45, trash: 40, mailbox: 55, bench: 55, dumpster: 130, car: 170,
  tree: 80, bush: 30, booth: 95, busStop: 110, barrier: 65, sandbags: 95, container: 320,
  crate: 45, cone: 18, cart: 85, signPole: 40,
  cafe: 50, stand: 60, pole: 40, chair: 30, aframe: 25,
};
const MAX_IDS = 256 * 64;
const MAX_SPOTS = 128; // remembered rubbed-out spots
const SHADER_SPOTS = 16; // the ones nearest the camera go to the shaders

export class WorldObjects {
  constructor() {
    this.list = [null];
    this.byBox = new Map(); // collision box id -> object
    this.fading = [];
    this.spots = []; // rubbed-out spots: { x, y, z, r }
    this.spotCam = { x: 0, z: 0 };
    this.maskDirty = false;
    this.shadowDirty = false;
    this.shadowT = 0;
    this.world = null;
  }

  // ------------------------------------------------------------------ while building the city
  begin(W, ch, kind, x, z) {
    // a prop built inside another prop (the car of a parked car) belongs to the outer one
    if (!ch || ch.mb.obj > 0 || this.list.length >= MAX_IDS) return 0;
    const id = this.list.length;
    const o = {
      id, kind, x, z, y: 0,
      ink: INK[kind] || 60, maxInk: INK[kind] || 60,
      state: 'here', gone: 0,
      boxes: [], trees: [], signs: [], hides: [],
      x0: x, x1: x, z0: z, z1: z, y1: 1,
      _b: W.collision.boxes.length, _t: W.trees.length, _s: W.signs.length, _h: W.hideSpots.length,
      _v: ch.mb.vcount, _l: ch.sl.length, _prev: ch.mb.obj,
    };
    this.list.push(o);
    ch.mb.obj = id;
    ch.sl.obj = id;
    return id;
  }

  end(W, ch, id, data = null) {
    if (!id) return;
    const o = this.list[id];
    const col = W.collision;
    for (let i = o._b; i < col.boxes.length; i++) {
      const b = col.boxes[i];
      o.boxes.push(i);
      this.byBox.set(i, o);
      o.x0 = Math.min(o.x0, b.x0);
      o.x1 = Math.max(o.x1, b.x1);
      o.z0 = Math.min(o.z0, b.z0);
      o.z1 = Math.max(o.z1, b.z1);
      o.y1 = Math.max(o.y1, b.y1);
    }
    for (let i = o._t; i < W.trees.length; i++) o.trees.push(i);
    for (let i = o._s; i < W.signs.length; i++) o.signs.push(i);
    for (let i = o._h; i < W.hideSpots.length; i++) o.hides.push(W.hideSpots[i]);
    if (data) o.data = data;
    if (!o.boxes.length && !o.trees.length && !o.signs.length && ch.mb.vcount === o._v && ch.sl.length === o._l) o.state = 'none';
    ch.mb.obj = o._prev;
    ch.sl.obj = o._prev;
  }

  // the sprite batches are made after the props: remember them so sprites can be hidden
  attach(world, treeBatch, signBatch, W) {
    this.world = world;
    this.treeBatch = treeBatch;
    this.signBatch = signBatch;
    this.treeDefs = W.trees;
    this.signDefs = W.signs;
  }

  // ------------------------------------------------------------------ queries
  ofBox(box) {
    return box ? this.byBox.get(box.id) || null : null;
  }

  // closest prop of a kind around (x, z) whose footprint is within r
  nearest(x, z, r, kind = null) {
    let best = null;
    let bd = r;
    for (let i = 1; i < this.list.length; i++) {
      const o = this.list[i];
      if (o.state !== 'here' || (kind && o.kind !== kind)) continue;
      const dx = Math.max(o.x0 - x, 0, x - o.x1);
      const dz = Math.max(o.z0 - z, 0, z - o.z1);
      const d = Math.hypot(dx, dz);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  within(x, z, r, out = []) {
    out.length = 0;
    for (let i = 1; i < this.list.length; i++) {
      const o = this.list[i];
      if (o.state !== 'here') continue;
      const dx = Math.max(o.x0 - x, 0, x - o.x1);
      const dz = Math.max(o.z0 - z, 0, z - o.z1);
      if (dx * dx + dz * dz < r * r) out.push(o);
    }
    return out;
  }

  // ------------------------------------------------------------------ erasing
  // Rub at a prop: it loses ink and, when it runs out, crumbles away. Returns true if it went.
  rub(o, amount) {
    if (!o || o.state !== 'here') return false;
    o.ink -= amount;
    if (o.ink > 0) return false;
    this.remove(o, true);
    return true;
  }

  // take the prop out of the world (crumbling away, or at once e.g. a parked car driven off)
  remove(o, crumble = false) {
    if (!o || o.state !== 'here') return;
    o.state = crumble ? 'fading' : 'gone';
    o.gone = crumble ? 0.02 : 1;
    const col = this.world.collision;
    for (const id of o.boxes) col.remove(id);
    if (o.boxes.length) this.world.nav.refresh(o.x0 - 1, o.z0 - 1, o.x1 + 1, o.z1 + 1);
    for (const i of o.trees) this.hideSprite(this.treeBatch, this.treeDefs, i);
    for (const i of o.signs) this.hideSprite(this.signBatch, this.signDefs, i);
    for (const h of o.hides) h.gone = true;
    this.setMask(o);
    if (crumble) this.fading.push(o);
    this.shadowDirty = true;
  }

  hideSprite(batch, defs, i) {
    if (!batch || !defs[i]) return;
    batch.setSize(i, 0, 0);
    batch.commit();
  }

  setMask(o) {
    const data = shared.uObjMask.value.image.data;
    data[o.id * 4] = Math.round(Math.min(1, o.gone) * 255);
    this.maskDirty = true;
  }

  // A spot of the drawing rubbed out to blank paper (walls, ground, anything).
  addSpot(x, y, z, r) {
    const S = this.spots;
    for (const s of S) {
      const d = Math.hypot(s.x - x, s.y - y, s.z - z);
      if (d + r <= s.r * 1.05) {
        // already blank there: rubbing on and on wears the hole a little wider (up to about a
        // doorway)
        if (s.r < 1.25) {
          s.r = Math.min(1.25, s.r + r * 0.22);
          this.uploadSpots();
        }
        return s;
      }
      if (d < s.r + r * 0.6 && r < s.r * 2) {
        // rubbing next to an old spot grows it (one slot for a whole rubbed patch)
        const nr = Math.min(12, (d + r + s.r) * 0.5);
        if (nr > s.r) {
          const k = (nr - s.r) / Math.max(d, 1e-3);
          s.x += (x - s.x) * k;
          s.y += (y - s.y) * k;
          s.z += (z - s.z) * k;
          s.r = nr;
        }
        this.uploadSpots();
        return s;
      }
    }
    if (S.length >= MAX_SPOTS) {
      // forget the smallest old spot
      let mi = 0;
      for (let i = 1; i < S.length; i++) if (S[i].r < S[mi].r) mi = i;
      S.splice(mi, 1);
    }
    const ns = { x, y, z, r };
    S.push(ns);
    this.uploadSpots();
    return ns;
  }

  uploadSpots() {
    this.spotsDirty = true;
  }

  // only the spots near the camera are worth testing in every pixel
  pickSpots(cam) {
    const S = this.spots;
    const u = shared.uWErase.value;
    let list = S;
    if (S.length > SHADER_SPOTS) {
      for (const s of S) s._d = Math.hypot(s.x - cam.x, s.z - cam.z) - s.r;
      list = S.slice().sort((a, b) => a._d - b._d).slice(0, SHADER_SPOTS);
    }
    list.forEach((s, i) => u[i].set(s.x, s.y, s.z, s.r));
    shared.uWEraseN.value = list.length;
    this.spotsDirty = false;
    this.spotCam = { x: cam.x, z: cam.z };
  }

  reset() {
    // (props stay erased across respawns: the page remembers)
  }

  update(dt, rebake, cam) {
    if (cam && (this.spotsDirty || (this.spots.length > SHADER_SPOTS && Math.hypot(cam.x - this.spotCam.x, cam.z - this.spotCam.z) > 6))) this.pickSpots(cam);
    if (this.fading.length) {
      for (const o of this.fading) {
        o.gone = Math.min(1, o.gone + dt / 0.55);
        this.setMask(o);
        if (o.gone >= 1) o.state = 'gone';
      }
      this.fading = this.fading.filter((o) => o.state === 'fading');
    }
    if (this.maskDirty) {
      shared.uObjMask.value.needsUpdate = true;
      this.maskDirty = false;
    }
    this.shadowT -= dt;
    if (this.shadowDirty && this.shadowT <= 0 && !this.fading.length) {
      this.shadowDirty = false;
      this.shadowT = 1;
      if (rebake) rebake();
    }
  }
}
