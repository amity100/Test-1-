import * as THREE from 'three';
import { Band, makeSong } from '../core/music.js';
import { CURB, M_BLOCKS } from '../world/mainland/plan.js';
import { VENUES } from '../world/mainland/blocks.js';

// (v5, ROADMAP 12.9) What the city's parties share (game/parties.js): where a club's room is (the
// frame its furniture was laid out in - world/mainland/venues.js, world/venues2.js), the sound of a
// party (a band of its own, a song in parts: the groove, the break, the build, the drop), a flat
// quad for a picture on the floor.

const T = 0.25;

/**
 * The room of a club on the avenue (VENUES[key], its block col,row): u along its front from the
 * south end, d out of the front (the room is d < 0), y up - the frame world/rooms.js laid it out
 * in. Returns its measures and P(u, y, d) -> [x, y, z].
 */
export function venueFrame(key) {
  const [col, row] = key.split(',').map(Number);
  const b = M_BLOCKS.find((q) => q.col === col && q.row === row);
  const v = VENUES[key];
  if (!b || !v) return null;
  const R = b.rect;
  const LEN = v.len || 30;
  const DEP = v.depth || 24;
  const zb = R.z0 + (v.z0 || 2) + LEN;
  const F = { block: b, v, name: v.name, LEN, DEP, ua: 0.5 + T, ub: LEN - 0.5 - T, da: -T, db: -(DEP - 0.8), y0: CURB, y1: CURB + (v.roomH || 6.5) };
  F.mid = (F.ua + F.ub) / 2;
  F.f0 = F.db + 3.2;
  F.f1 = Math.min(F.da - 3.5, F.f0 + 10);
  F.ty = F.y1 - 0.5;
  F.x = (d) => R.x1 + d;
  F.z = (u) => zb - u;
  F.P = (u, y, d) => [R.x1 + d, y, zb - u];
  F.U = (z) => zb - z;
  F.D = (x) => x - R.x1;
  F.inside = (x, z, m = 0) => x > R.x1 + F.db - m && x < R.x1 + F.da + m && z > zb - F.ub - m && z < zb - F.ua + m;
  F.cx = R.x1 + (F.db + F.da) / 2;
  F.cz = zb - F.mid;
  F.door = [R.x1 + 1.1, zb - 3.2];
  return F;
}

// a flat quad face up (four corners [x, z], the picture's corners in order: its top left, top
// right, bottom right, bottom left), y its height
export function floorQuad(pts, y) {
  const uv = [[0, 1], [1, 1], [1, 0], [0, 0]];
  const tri = [0, 1, 2, 0, 2, 3];
  const [a, b, c] = pts;
  // (wound so that it faces up)
  const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const order = cross > 0 ? [0, 2, 1, 0, 3, 2] : tri;
  const pos = new Float32Array(18);
  const nor = new Float32Array(18);
  const uvs = new Float32Array(12);
  order.forEach((k, i) => {
    pos.set([pts[k][0], y, pts[k][1]], i * 3);
    nor.set([0, 1, 0], i * 3);
    uvs.set(uv[k], i * 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.computeBoundingSphere();
  return g;
}

export const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/**
 * A party's sound: its own band, its songs one after another (o.styles, a song o.bars bars long; a
 * song with o.form goes in its parts - core/music.js), heard through a filter (muffled through the
 * walls, opening as the build rises). update() says where in the song it is: beat, bar.
 */
export class PartySound {
  constructor(game, o) {
    this.game = game;
    this.o = o;
    this.band = null;
    this.n = 0;
    this.beat = 0;
    this.bar = 0;
  }

  start() {
    const a = this.game.audio;
    const c = a && a.ctx;
    if (!c || this.band) return;
    this.c = c;
    this.mix = c.createGain();
    this.mix.gain.value = 0;
    this.lp = c.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 800;
    this.mix.connect(this.lp).connect(a.musicBus || a.fx);
    this.band = new Band(c, this.mix, a.noise);
    this.next(c.currentTime + 0.2);
  }

  next(t) {
    const o = this.o;
    this.song = makeSong(o.styles[this.n % o.styles.length], (o.seed || 1) + this.n * 13);
    if (o.form) this.song.form = o.form;
    this.t0 = t;
    this.spb = 60 / this.song.bpm / 4;
    this.end = t + Band.length(this.song, o.bars);
    this.band.play(this.song, t, 0);
    this.n++;
    this.cued = -1;
  }

  // (to a bar of the song now: the DJ asked for the drop)
  jump(bar) {
    if (!this.band) return;
    const now = this.c.currentTime + 0.05;
    this.band.play(this.song, now, bar * 16);
    this.t0 = now - bar * 16 * this.spb;
    this.end = this.t0 + Band.length(this.song, this.o.bars);
    this.cued = -1;
  }

  update(vol, cut) {
    if (!this.band) return;
    const now = this.c.currentTime;
    if (now > this.end - 0.05) this.next(this.end);
    this.band.update(now);
    this.mix.gain.setTargetAtTime(vol, now, 0.3);
    this.lp.frequency.setTargetAtTime(cut, now, 0.25);
    this.now = now;
    this.beat = (now - this.t0) / (this.spb * 4);
    this.bar = this.beat / 4;
  }

  // the time of a bar of this song (for what is set to happen on it)
  at(bar) {
    return this.t0 + bar * 16 * this.spb;
  }

  // a rising hiss from t0 to t1 (the build), a crash at t1 (the drop)
  riser(t0, t1) {
    const c = this.c;
    const a = this.game.audio;
    if (!c || !a.noise) return;
    const s = c.createBufferSource();
    s.buffer = a.noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2.5;
    f.frequency.setValueAtTime(300, t0);
    f.frequency.exponentialRampToValueAtTime(6000, t1);
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(0.09, t1 - 0.02);
    gn.gain.setValueAtTime(0.0001, t1);
    s.connect(f).connect(gn).connect(this.mix);
    s.start(Math.max(c.currentTime, t0));
    s.stop(t1 + 0.05);
  }

  crash(t) {
    if (!this.band) return;
    this.band.hiss(t, 2.2, 0.16, 'highpass', 4200, 0.5);
    this.band.kick(t);
  }

  stop() {
    if (this.band) this.band.stop();
    const c = this.c;
    if (this.mix && c) {
      const n = this.mix;
      n.gain.setTargetAtTime(0, c.currentTime, 0.2);
      setTimeout(() => n.disconnect(), 1500);
    }
    this.band = null;
    this.mix = null;
  }
}

// draw a party's people: the ones near enough, ahead of the camera
const _f = new THREE.Vector3();
export function drawPeople(game, list, far) {
  const cam = game.camera.position;
  const bodies = game.figures.bodies;
  const fwd = game.camera.getWorldDirection(_f);
  for (const w of list) {
    if (w.hide) continue;
    const dx = w.x - cam.x;
    const dz = w.z - cam.z;
    const d = Math.hypot(dx, dz);
    if (d > far || (d > 3 && (dx * fwd.x + dz * fwd.z) / d < -0.25)) continue;
    bodies.drawCheap(w);
  }
}

// a quad standing in the world: from (ax, az) to (bx, bz), from ya up to yb; its picture's x from
// uA at a to uB at b; wound to face (nx, nz)
export function wallQuad(ax, az, bx, bz, ya, yb, uA, uB, nx, nz) {
  const pts = [[ax, ya, az], [bx, ya, bz], [bx, yb, bz], [ax, yb, az]];
  const uv = [[uA, 0], [uB, 0], [uB, 1], [uA, 1]];
  // (which way round: the face's normal from its first corner's two edges)
  const ex = bx - ax;
  const ez = bz - az;
  const cx = -ez;
  const cz = ex;
  const order = cx * nx + cz * nz > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
  const pos = new Float32Array(18);
  const nor = new Float32Array(18);
  const uvs = new Float32Array(12);
  order.forEach((k, i) => {
    pos.set(pts[k], i * 3);
    nor.set([nx, 0, nz], i * 3);
    uvs.set(uv[k], i * 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.computeBoundingSphere();
  return g;
}

/**
 * n boxes in one mesh whose places, sizes and colours are set every frame (the kinetic ceiling's
 * bars and their wires): set(i, x, y, z, sx, sy, sz, r, g, b), then done().
 */
export class Boxes {
  constructor(n, mat) {
    const t = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    this.tp = t.attributes.position.array;
    this.V = this.tp.length / 3;
    const V = this.V;
    this.n = n;
    this.pos = new Float32Array(n * V * 3);
    this.col = new Float32Array(n * V * 3);
    const nor = new Float32Array(n * V * 3);
    const uv = new Float32Array(n * V * 2);
    const ids = new Float32Array(n * V);
    for (let i = 0; i < n; i++) {
      nor.set(t.attributes.normal.array, i * V * 3);
      uv.set(t.attributes.uv.array, i * V * 2);
      ids.fill(((i * 0.1371) % 1) * 0.8 + 0.1, i * V, (i + 1) * V);
    }
    t.dispose();
    const geo = new THREE.BufferGeometry();
    this.pa = new THREE.BufferAttribute(this.pos, 3);
    this.ca = new THREE.BufferAttribute(this.col, 3);
    this.pa.setUsage(THREE.DynamicDrawUsage);
    this.ca.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pa);
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', this.ca);
    geo.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.userData.dynamic = true;
  }

  set(i, x, y, z, sx, sy, sz, r, g, b) {
    const V = this.V;
    const tp = this.tp;
    const p = this.pos;
    const c = this.col;
    let o = i * V * 3;
    for (let k = 0; k < V; k++, o += 3) {
      p[o] = x + tp[k * 3] * sx;
      p[o + 1] = y + tp[k * 3 + 1] * sy;
      p[o + 2] = z + tp[k * 3 + 2] * sz;
      c[o] = r;
      c[o + 1] = g;
      c[o + 2] = b;
    }
  }

  done() {
    this.pa.needsUpdate = true;
    this.ca.needsUpdate = true;
  }
}

// a ring of light (the chandelier's): a torus with its colours its own, turned and tilted as a mesh
export function ringMesh(r, tube, mat) {
  const t = new THREE.TorusGeometry(r, tube, 6, 72).toNonIndexed();
  t.rotateX(Math.PI / 2);
  const n = t.attributes.position.count;
  const col = new Float32Array(n * 3).fill(1);
  const ca = new THREE.BufferAttribute(col, 3);
  ca.setUsage(THREE.DynamicDrawUsage);
  t.setAttribute('color', ca);
  t.setAttribute('aId', new THREE.BufferAttribute(new Float32Array(n).fill(0.5), 1));
  const m = new THREE.Mesh(t, mat);
  m.frustumCulled = false;
  m.userData.dynamic = true;
  m.userData.colors = col;
  m.userData.ca = ca;
  return m;
}
