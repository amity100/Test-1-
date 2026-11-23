import * as THREE from 'three';
import { tr } from '../core/lang.js';
import { Kit, itemMats, linC } from './items.js';
import { addLight, lightList, makeSurface, srgb } from '../render/materials.js';
import { groundHeight } from '../world/layout.js';
import { cityLook } from './looks.js';
import { floorLine, floorDisc, floorRing, floorWord, wallWord, wallLetters, wordLen, yawBox, beam, bar, cylX } from './placekit.js';

// (ROADMAP 29.5) The boxing gym on the corner of Meridian Avenue and 9th Street (game/places.js): the two buildings that stood
// on the corner's lot - the Satellite's flats and the low block south of it - taken out of the city at run time, and the gym
// put up in their place.

// the lot: from Meridian's sidewalk to the alley's west wall, from 9th Street's sidewalk to the party wall of the Bel Air
export const LOT = { x0: -192, x1: -173, z0: 40, z1: 78 };

// ------------------------------------------------------------------ the site cleared
// What is cut out of the city's drawing: each part of it (a box, a quad, a limb - a run of corners of one id) whose middle is
// in here - a hair short of the Bel Air's wall on the party line, and the alley's things on the back wall left where they are -
// and the ladder up the south building's back from the alley, whose roof is gone
// (its north edge a little out over the sidewalk: what hung on the corner building's side - its billboard, its lamps - goes
// with it; its east edge a little into the alley: the back yard's fence, the meters on its back wall)
const CUT = [
  { x0: -192.03, x1: -172.8, z0: 39.2, z1: 77.85, y0: -5, y1: 80 },
  { x0: -173.0, x1: -172.1, z0: 62.9, z1: 64.1, y0: -1, y1: 20 },
];
const inCut = (x, y, z) => {
  for (const c of CUT) if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && y > c.y0 && y < c.y1) return true;
  return false;
};
const inLot = (x, z, pad = 0) => x > LOT.x0 - pad && x < LOT.x1 + pad && z > LOT.z0 - pad && z < LOT.z1 + pad;

// the city's pieces over the lot, each part of them in it made into nothing (its triangles' corners all one): what was cut
// kept, to put back. Returns { cut: [...], tris }
function carve(root) {
  const undo = [];
  let tris = 0;
  const box = new THREE.Box3();
  const lot = new THREE.Box3(new THREE.Vector3(CUT[0].x0, -5, CUT[0].z0), new THREE.Vector3(CUT[0].x1, 80, CUT[0].z1));
  const v = new THREE.Vector3();
  root.traverse((m) => {
    if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
    const geo = m.geometry;
    m.updateWorldMatrix(true, false);
    if (m.isInstancedMesh) {
      // (a thing drawn many times: each one standing on the lot put away, its size nothing)
      const im = m.instanceMatrix;
      const a = im.array;
      const kept = [];
      for (let i = 0; i < m.count; i++) {
        v.set(a[i * 16 + 12], a[i * 16 + 13], a[i * 16 + 14]).applyMatrix4(m.matrixWorld);
        if (!inCut(v.x, v.y + 0.5, v.z)) continue;
        kept.push([i, a.slice(i * 16, i * 16 + 16)]);
        for (let k = 0; k < 16; k++) a[i * 16 + k] = 0;
      }
      if (kept.length) {
        im.needsUpdate = true;
        undo.push({ m, inst: kept });
      }
      return;
    }
    if (!geo.boundingBox) geo.computeBoundingBox();
    box.copy(geo.boundingBox).applyMatrix4(m.matrixWorld);
    if (!box.intersectsBox(lot)) return;
    const pos = geo.attributes.position;
    const n = pos.count;
    const e = m.matrixWorld.elements;
    const ident = m.matrixWorld.equals(IDENT);
    const P = pos.array;
    const st = pos.itemSize;
    const wx = (i) => (ident ? P[i * st] : e[0] * P[i * st] + e[4] * P[i * st + 1] + e[8] * P[i * st + 2] + e[12]);
    const wy = (i) => (ident ? P[i * st + 1] : e[1] * P[i * st] + e[5] * P[i * st + 1] + e[9] * P[i * st + 2] + e[13]);
    const wz = (i) => (ident ? P[i * st + 2] : e[2] * P[i * st] + e[6] * P[i * st + 1] + e[10] * P[i * st + 2] + e[14]);
    if (pos.isInterleavedBufferAttribute) return;
    // which corners go: a part at a time (a run of corners with the same id - the ids are not unique, their runs are)
    const flag = new Uint8Array(n);
    const ids = geo.attributes.aId ? geo.attributes.aId.array : null;
    let any = false;
    if (ids) {
      let s = 0;
      while (s < n) {
        let j = s + 1;
        while (j < n && ids[j] === ids[s]) j++;
        let x0 = Infinity;
        let x1 = -Infinity;
        let y0 = Infinity;
        let y1 = -Infinity;
        let z0 = Infinity;
        let z1 = -Infinity;
        for (let i = s; i < j; i++) {
          const x = wx(i);
          const y = wy(i);
          const z = wz(i);
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
          if (z < z0) z0 = z;
          if (z > z1) z1 = z;
        }
        if (inCut((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)) {
          flag.fill(1, s, j);
          any = true;
        }
        s = j;
      }
    }
    const idx = geo.index ? geo.index.array : null;
    const nt = idx ? idx.length / 3 : n / 3;
    const cut = [];
    for (let t = 0; t < nt; t++) {
      const a = idx ? idx[t * 3] : t * 3;
      const b = idx ? idx[t * 3 + 1] : t * 3 + 1;
      const c = idx ? idx[t * 3 + 2] : t * 3 + 2;
      // (no ids: the triangle by its own middle)
      const go = ids ? flag[a] && flag[b] && flag[c] : inCut((wx(a) + wx(b) + wx(c)) / 3, (wy(a) + wy(b) + wy(c)) / 3, (wz(a) + wz(b) + wz(c)) / 3);
      if (!go) continue;
      if (idx) {
        cut.push(t, b, c);
        idx[t * 3 + 1] = a;
        idx[t * 3 + 2] = a;
      } else {
        cut.push(t, P[b * st], P[b * st + 1], P[b * st + 2], P[c * st], P[c * st + 1], P[c * st + 2]);
        for (let k = 0; k < 3; k++) {
          P[b * st + k] = P[a * st + k];
          P[c * st + k] = P[a * st + k];
        }
      }
    }
    void any;
    if (!cut.length) return;
    tris += idx ? cut.length / 3 : cut.length / 7;
    if (idx) geo.index.needsUpdate = true;
    else pos.needsUpdate = true;
    undo.push({ m, idx: !!idx, cut });
  });
  return { undo, tris };
}
const IDENT = new THREE.Matrix4();

function uncarve(undo) {
  for (const u of undo) {
    const geo = u.m.geometry;
    if (u.inst) {
      const a = u.m.instanceMatrix.array;
      for (const [i, mtx] of u.inst) a.set(mtx, i * 16);
      u.m.instanceMatrix.needsUpdate = true;
      continue;
    }
    const c = u.cut;
    if (u.idx) {
      const idx = geo.index.array;
      for (let k = 0; k < c.length; k += 3) {
        idx[c[k] * 3 + 1] = c[k + 1];
        idx[c[k] * 3 + 2] = c[k + 2];
      }
      geo.index.needsUpdate = true;
    } else {
      const P = geo.attributes.position.array;
      const st = geo.attributes.position.itemSize;
      for (let k = 0; k < c.length; k += 7) {
        const t = c[k];
        P.set([c[k + 1], c[k + 2], c[k + 3]], (t * 3 + 1) * st);
        P.set([c[k + 4], c[k + 5], c[k + 6]], (t * 3 + 2) * st);
      }
      geo.attributes.position.needsUpdate = true;
    }
  }
}

// The lot cleared of what stood on it: its drawing, its solids (the roofs' too), its props and panes of glass, the flats'
// lobby (and the things on its shelves, streamed in when you come near), its lights, the boxes that hid what was behind it,
// its footprints, the ladder up from the alley; the people's ways worked out again, the sun's far map drawn again. Returns
// what it did, to undo
export function clearSite(game) {
  const w = game.world;
  const t0 = performance.now();
  const done = { shops: [], stock: [], boxes: [], roofBoxes: [], objs: [], glass: [], lights: [], occ: [], foot: [], routes: [], hides: [] };
  const { undo, tris } = carve(w.group);
  done.carve = undo;
  done.tris = tris;
  // (solids whose middle is on the lot: the walls, the furniture of the lobby, the hedges, the forecourt's posts)
  const col = w.collision;
  col.forEachIn(LOT.x0 - 0.5, LOT.z0 - 0.5, LOT.x1 + 0.5, LOT.z1 + 0.5, (b) => {
    if (b.alive === false) return;
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    if (!inCut(cx, (b.y0 + b.y1) / 2, cz)) return;
    done.boxes.push(b.id);
  });
  for (const id of done.boxes) col.remove(id);
  const RC = w.roofs && w.roofs.col;
  if (RC) {
    RC.forEachIn(LOT.x0 - 0.5, LOT.z0 - 0.5, LOT.x1 + 0.5, LOT.z1 + 0.5, (b) => {
      if (b.alive === false) return;
      if (inCut((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2)) done.roofBoxes.push(b.id);
    });
    for (const id of done.roofBoxes) RC.remove(id);
  }
  // (the ways up onto its roofs: the alley's ladder, a fire escape)
  if (w.roofs && w.roofs.routes) {
    const R = w.roofs.routes;
    for (let i = R.length - 1; i >= 0; i--) {
      const r = R[i];
      if (!r.pts || !r.pts.some((p) => inLot(p.x, p.z, -0.05))) continue;
      done.routes.push(r);
      R.splice(i, 1);
    }
  }
  // (the props: the hedges, the tree, the lobby's panes)
  const O = w.objects;
  if (O && O.list) {
    for (const o of O.list) {
      if (!o || o.state !== 'here') continue;
      const ox = (o.x0 + o.x1) / 2;
      const oz = (o.z0 + o.z1) / 2;
      // (and the street tree on Meridian's sidewalk right before the gym's door)
      const door = o.kind === 'tree' && ox > -197.6 && ox < -194.5 && oz > 42.4 && oz < 46.4;
      if (!door && !inCut(ox, 1, oz)) continue;
      O.remove(o);
      done.objs.push(o);
    }
  }
  if (w.glass) {
    for (let i = w.glass.length - 1; i >= 0; i--) {
      const p = w.glass[i];
      if (!inCut(p.x, 1, p.z)) continue;
      done.glass.push(p);
      w.glass.splice(i, 1);
    }
  }
  // (the flats' lobby, its people: and what would have been streamed onto its shelves)
  for (const s of w.shops.slice()) {
    if (!s.door || !inLot(s.door[0], s.door[2], 0.6)) continue;
    done.shops.push(s);
    if (w.removeShop) w.removeShop(s);
    else w.shops.splice(w.shops.indexOf(s), 1);
    // (open now, its people about: let go of)
    const SL = game.streetlife;
    const a = SL && SL.active && SL.active.get(s.id);
    if (a) {
      try {
        a.dispose();
      } catch (e) {
        // (as it is)
      }
      SL.active.delete(s.id);
    }
  }
  const recs = (w.stockRecs || []).filter((r) => inCut(r.x, 1, r.z));
  if (recs.length && w.interiors) w.interiors.removeAll(recs);
  done.stock = recs;
  for (const l of lightList()) {
    if (!l || !l.on || l.dead || !inCut(l.x, l.y, l.z)) continue;
    l.on = false;
    done.lights.push(l);
  }
  // (the boxes that hide what is behind them are the walls' own solids, out already with them: any other one on the lot too)
  for (const q of w.occluders || []) {
    if (q.alive === false || !inCut((q.x0 + q.x1) / 2, 1, (q.z0 + q.z1) / 2)) continue;
    q.alive = false;
    done.occ.push(q);
  }
  const F = w.footprints || [];
  for (let i = F.length - 1; i >= 0; i--) {
    const f = F[i];
    if (!inCut((f.x0 + f.x1) / 2, 1, (f.z0 + f.z1) / 2)) continue;
    done.foot.push(f);
    F.splice(i, 1);
  }
  for (const h of w.hideSpots || []) {
    if (h.gone || !inCut(h.x, 1, h.z)) continue;
    h.gone = true;
    done.hides.push(h);
  }
  if (w.nav && w.nav.queueRefresh) w.nav.queueRefresh(LOT.x0 - 3, LOT.z0 - 3, LOT.x1 + 3, LOT.z1 + 3);
  if (w.bakeShadows) {
    try {
      w.bakeShadows();
    } catch (e) {
      // (the far map as it was)
    }
  }
  done.ms = performance.now() - t0;
  return done;
}

// all of it back as it was (game/places.js dispose)
export function restoreSite(game, done) {
  if (!done) return;
  const w = game.world;
  uncarve(done.carve || []);
  for (const id of done.boxes) {
    const b = w.collision.boxes[id];
    if (b && !b.freed) b.alive = true;
  }
  const RC = w.roofs && w.roofs.col;
  if (RC) {
    for (const id of done.roofBoxes) {
      const b = RC.boxes[id];
      if (b && !b.freed) b.alive = true;
    }
  }
  if (w.roofs && w.roofs.routes) for (const r of done.routes) w.roofs.routes.push(r);
  const O = w.objects;
  for (const o of done.objs) {
    if (o.state === 'here') continue;
    o.state = 'here';
    o.gone = 0;
    for (const id of o.boxes) {
      const b = w.collision.boxes[id];
      if (b && !b.freed) b.alive = true;
    }
    for (const h of o.hides) h.gone = false;
    if (O && O.setMask) O.setMask(o);
  }
  for (const p of done.glass) w.glass.push(p);
  for (const s of done.shops) {
    if (w.shops.includes(s)) continue;
    w.shops.push(s);
    for (const f of w.shopHooks || []) f(s, true);
  }
  if (done.stock.length && w.interiors) w.interiors.addAll(done.stock);
  for (const l of done.lights) l.on = true;
  for (const q of done.occ) q.alive = true;
  if (w.footprints) w.footprints.push(...done.foot);
  for (const h of done.hides) h.gone = false;
  if (w.nav && w.nav.queueRefresh) w.nav.queueRefresh(LOT.x0 - 3, LOT.z0 - 3, LOT.x1 + 3, LOT.z1 + 3);
  if (w.bakeShadows) {
    try {
      w.bakeShadows();
    } catch (e) {
      // (the far map as it was)
    }
  }
}

// ------------------------------------------------------------------ the gym
// 9TH STREET GYM: an old brick hall on the corner, its name in red neon over the door on Meridian and a blade of BOXING over
// the corner, the whole of its side on 9th Street a painted sign. Inside, under the steel trusses and the skylights: the ring
// in the middle on its platform, its lights hung over it, the bleachers along the alley wall; the front desk, the fight-night
// board and the champion's belt by the door, the lockers; the heavy bags on their beam, the speed bag on the back wall, the
// mitts' mat where the coach waits, the mirrors, the ropes on their rack; and in the back corner the office, its wall to the
// room left bare - the find's page goes there (spot 'ironfists').
//
// Its plan (world metres; the front, with the door, looks west onto Meridian Avenue; north is 9th Street)
export const GYM = {
  // the walls' outer faces, their thickness, their top (the roof's underside) over the floor
  x0: -191.2,
  x1: -173.0,
  z0: 40.25,
  z1: 78.0,
  T: 0.3,
  h: 8.0,
  // the room's height for the camera (the trusses' underside)
  room: 6.4,
  // the front doors in the west wall (z) and their height
  door: [43.0, 45.8],
  doorH: 2.8,
  // the ring: its middle, the canvas inside the ropes (half), the apron round them (half), the canvas's height; the camera's
  // ceiling over it (the light rig's underside, a little under it)
  ring: { x: -182.6, z: 55.0, half: 3, apron: 3.6, h: 1.0, ceil: 5.45 },
  // the office in the back corner (its north wall faces the room: the find's page on it)
  office: { x0: -180.6, z0: 70.4, h: 3.1 },
  // the clear part of that wall: its middle, its size
  board: { x: -177.4, y: 1.75, w: 3.6, h: 2.2 },
  // the heavy bags on their beam (x; the beam's z, its height), the speed bag's platform on the back wall, the mitts' mat
  bags: [-189.0, -186.4, -183.8],
  bagZ: 65.8,
  bagBeam: 3.6,
  speed: { x: -189.0, z: 76.95, y: 1.7 },
  mitts: { x: -185.4, z: 72.6 },
  // the bleachers along the east wall
  stands: { x0: -176.4, z0: 49.2, z1: 60.8 },
};

const BRICK = linC(0.8, 0.4, 0.29);
const BRICK_D = linC(0.66, 0.3, 0.22);
const BRICK_A = linC(0.74, 0.42, 0.33);
const CREAM = linC(0.93, 0.88, 0.76);
const CHAR = linC(0.15, 0.15, 0.18);
const INK = linC(0.09, 0.09, 0.11);
const WHITE = linC(0.96, 0.96, 0.94);
const YEL = linC(0.98, 0.8, 0.2);
const GOLD = linC(0.95, 0.72, 0.22);
const RED = linC(0.84, 0.1, 0.1);
const RED_D = linC(0.5, 0.07, 0.08);
const BLUE = linC(0.12, 0.28, 0.72);
const NAVY = linC(0.08, 0.11, 0.3);
const GREEN_D = linC(0.08, 0.24, 0.18);
const STEEL = linC(0.68, 0.7, 0.74);
const STEEL_D = linC(0.27, 0.28, 0.32);
const GLASS = linC(0.32, 0.44, 0.54);
const PAVE = linC(0.72, 0.7, 0.66);
const ROOF = linC(0.46, 0.46, 0.48);
const FLOOR = linC(0.58, 0.55, 0.5);
const MAT = linC(0.15, 0.15, 0.18);
const MAT_B = linC(0.13, 0.22, 0.5);
const WALL_IN = linC(0.9, 0.87, 0.78);
const DADO = linC(0.52, 0.1, 0.1);
const CEIL = linC(0.3, 0.31, 0.36);
const WOOD = linC(0.66, 0.46, 0.27);
const WOOD_D = linC(0.4, 0.26, 0.15);
const CANVAS = linC(0.88, 0.88, 0.84);
const LOCKER = linC(0.36, 0.48, 0.52);
const CHALK = linC(0.12, 0.17, 0.15);
const MIRROR = linC(0.78, 0.86, 0.92);
const TUBE = linC(0.92, 0.97, 1.0);
const LAMP = linC(1.0, 0.93, 0.76);
const NEON_R = linC(1.0, 0.14, 0.18);
const NEON_W = linC(1.0, 0.95, 0.86);
const OFFICE_W = linC(0.8, 0.84, 0.86);
const NIGHT_WIN = linC(0.42, 0.31, 0.16);
const LEATHER = [linC(0.7, 0.1, 0.1), linC(0.12, 0.12, 0.14), linC(0.62, 0.42, 0.24)];

// the inside's pens: the city's own, under the room's lamps (no sun in here; nor any shadow of theirs)
let MI = null;
export function gymMats() {
  if (MI) return MI;
  MI = {
    paint: makeSurface({ kind: 'paint', vcolor: true, gloss: 0.5, ang: 0.1, indoor: true }),
    matte: makeSurface({ kind: 'box', vcolor: true, indoor: true }),
    metal: makeSurface({ kind: 'box', vcolor: true, gloss: 0.75, indoor: true }),
    glow: makeSurface({ kind: 'neon', vcolor: true, emVColor: true, color: srgb(1, 0.95, 0.9), emissive: new THREE.Color(2.2, 2.2, 2.2), line: 0.4, indoor: true }),
  };
  for (const m of Object.values(MI)) m.userData.depth = null;
  return MI;
}

// a flat oval on a wall facing (nx, nz): a glove's painted shape
function wallOval(K, mat, color, cx, cy, cz, nx, nz, r, sx = 1, sy = 1, segs = 20) {
  const g = new THREE.CircleGeometry(r, segs);
  g.scale(sx, sy, 1);
  g.rotateY(Math.atan2(nx, nz));
  g.translate(cx, cy, cz);
  K.add(mat, g, color);
}

// a painted boxing glove on a wall facing -z (the north front), its middle at (cx, cy); s: its size, m: mirrored
function paintedGlove(K, M, cx, cy, z, s, m) {
  const d = z - 0.004;
  wallOval(K, M.paint, RED, cx, cy, d, 0, -1, 0.5 * s, 1, 1.18);
  wallOval(K, M.paint, RED, cx - m * 0.42 * s, cy - 0.12 * s, d - 0.002, 0, -1, 0.2 * s, 1, 1.5);
  wallOval(K, M.paint, linC(0.98, 0.45, 0.4), cx + m * 0.12 * s, cy + 0.2 * s, d - 0.003, 0, -1, 0.18 * s, 1.3, 0.8);
  K.box(M.paint, cx - 0.36 * s, cy - 0.95 * s, d - 0.004, cx + 0.36 * s, cy - 0.5 * s, d, WHITE);
  K.box(M.paint, cx - 0.36 * s, cy - 0.78 * s, d - 0.005, cx + 0.36 * s, cy - 0.7 * s, d, RED);
  // (the lace up to the nail it hangs from)
  K.box(M.paint, cx - 0.02 * s, cy + 0.55 * s, d - 0.004, cx + 0.02 * s, cy + 1.05 * s, d, WHITE);
}

// a poster on a wall facing (nx, nz): its middle (x, y, z) on the wall's face, w x h; the lines of it, big to small
function poster(K, M, x, y, z, nx, nz, w, h, bg, fg, lines, accent = null) {
  const rx = nz;
  const rz = -nx;
  const ax = Math.abs(rx) * (w / 2) + Math.abs(nx) * 0.006;
  const az = Math.abs(rz) * (w / 2) + Math.abs(nz) * 0.006;
  K.box(M.paint, x - ax + nx * 0.006, y - h / 2, z - az + nz * 0.006, x + ax + nx * 0.006, y + h / 2, z + az + nz * 0.006, bg);
  let yy = y + h / 2 - 0.08;
  for (const [text, size, col] of lines) {
    yy -= size * 1.35;
    wallWord(K, M.paint, col || fg, text, Math.min(size, (w * 0.86 * 7) / (text.length * 6)), x, yy, z, nx, nz, 0.016);
  }
  // (two gloves up, the fighters' - in the poster's lower half)
  if (accent) {
    for (const s of [-1, 1]) {
      const g = new THREE.CircleGeometry(w * 0.13, 14);
      g.rotateY(Math.atan2(nx, nz));
      g.translate(x + rx * s * w * 0.2 + nx * 0.02, y - h * 0.28, z + rz * s * w * 0.2 + nz * 0.02);
      K.add(M.paint, g, s < 0 ? accent : fg);
    }
  }
}

// the shell and everything in it. Y0: the ground. K: the shell (the city's pens, casting), KI: the inside (under its lamps),
// KM: what swings (the bags; one pen, its parts' corners kept in order: returned), wall(x0, z0, x1, z1, y0, y1, tag): a solid
export function buildGym(K, KI, KM, M, Y0, wall, KN = null) {
  const G = GYM;
  const MI = gymMats();
  const { x0: X0, x1: X1, z0: Z0, z1: Z1, T } = G;
  const xi0 = X0 + T;
  const xi1 = X1 - T;
  const zi0 = Z0 + T;
  const zi1 = Z1 - T;
  const top = Y0 + G.h;
  const yF = Y0 + 0.02;
  const [DA, DB] = G.door;
  const DH = G.doorH;
  // ---- the ground: the pavement before the front and along the corner, up to the city's sidewalks
  K.box(M.matte, LOT.x0, Y0 - 0.1, LOT.z0, X0, Y0 + 0.012, Z1, PAVE);
  K.box(M.matte, X0, Y0 - 0.1, LOT.z0, X1, Y0 + 0.012, Z0, PAVE);
  for (let z = 41.6; z < Z1; z += 1.6) K.box(M.paint, LOT.x0 + 0.02, Y0 + 0.012, z - 0.015, X0, Y0 + 0.016, z + 0.015, linC(0.6, 0.58, 0.55));
  // ---- the walls: brick, the front (west) round its doors; the corner's piers, the plinth, the band between the floors, the
  // cornice and the parapet's cap
  K.box(M.matte, X0, Y0, Z0, xi0, top, DA, BRICK);
  K.box(M.matte, X0, Y0 + DH, DA, xi0, top, DB, BRICK);
  K.box(M.matte, X0, Y0, DB, xi0, top, Z1, BRICK);
  wall(X0, Z0, xi0, DA, 0, top + 1);
  wall(X0, DA, xi0, DB, Y0 + DH, top + 1);
  wall(X0, DB, xi0, Z1, 0, top + 1);
  K.box(M.matte, X0, Y0, Z0, X1, top, zi0, BRICK);
  wall(X0, Z0, X1, zi0, 0, top + 1);
  K.box(M.matte, xi1, Y0, zi0, X1, top, Z1, BRICK_A);
  wall(xi1, zi0, X1, Z1, 0, top + 1);
  K.box(M.matte, xi0, Y0, zi1, xi1, top, Z1, BRICK_A);
  wall(xi0, zi1, xi1, Z1, 0, top + 1);
  // (the piers along the front, a bay each; at the corners)
  const piers = [40.25, 47.0, 53.6, 60.2, 66.8, 73.4, 77.4];
  for (const z of piers) K.box(M.matte, X0 - 0.14, Y0, Math.max(Z0, z - 0.3), X0, top - 0.25, Math.min(Z1, z + 0.3), BRICK_D);
  for (const x of [X0, X1 - 0.6]) K.box(M.matte, x, Y0, Z0 - 0.14, x + 0.6, top - 0.25, Z0, BRICK_D);
  // (the plinth, the band at the first floor, the cornice: round the two fronts)
  const band = (y0, y1, out, col) => {
    K.box(M.matte, X0 - out, Y0 + y0, Z0 - out, X0, Y0 + y1, DA, col);
    K.box(M.matte, X0 - out, Y0 + y0, DB, X0, Y0 + y1, Z1, col);
    K.box(M.matte, X0 - out, Y0 + y0, Z0 - out, X1, Y0 + y1, Z0, col);
  };
  band(0, 0.55, 0.2, CHAR);
  band(3.18, 3.36, 0.24, CREAM);
  band(G.h - 0.62, G.h - 0.3, 0.32, CREAM);
  band(G.h - 0.3, G.h - 0.22, 0.2, BRICK_D);
  K.box(M.matte, X0 - 0.32, Y0 + 3.18, DA, X0, Y0 + 3.36, DB, CREAM);
  // ---- the roof: its slab, the parapet, its cap; the skylights over the ring and the bags; a unit and its ducts; the name
  K.box(M.matte, X0, top, Z0, X1, top + 0.3, Z1, ROOF);
  wall(X0, Z0, X1, Z1, top, top + 0.3, 'floor');
  for (const [a, b, c, d] of [[X0, Z0, X1, Z0 + 0.3], [X0, Z0, X0 + 0.3, Z1], [X1 - 0.3, Z0, X1, Z1]]) {
    K.box(M.matte, a, top + 0.3, b, c, top + 0.95, d, BRICK);
    K.box(M.matte, a - 0.06, top + 0.95, b - 0.06, c + 0.06, top + 1.05, d + 0.06, CREAM);
    wall(a, b, c, d, top + 0.3, top + 1.05);
  }
  const skies = [[-182.1, 47.6], [-182.1, 55.0], [-182.1, 66.2]];
  for (const [sx, sz] of skies) {
    K.box(M.metal, sx - 1.75, top + 0.3, sz - 1.25, sx + 1.75, top + 0.5, sz + 1.25, STEEL_D);
    K.box(M.glass, sx - 1.6, top + 0.5, sz - 1.1, sx + 1.6, top + 0.85, sz + 1.1, linC(0.55, 0.7, 0.8));
    for (let k = -1; k <= 1; k++) K.box(M.metal, sx + k * 0.8 - 0.03, top + 0.85, sz - 1.12, sx + k * 0.8 + 0.03, top + 0.88, sz + 1.12, STEEL_D);
    // (from inside: the glass in the ceiling, its frame)
    K.box(M.glass, sx - 1.6, top - 0.07, sz - 1.1, sx + 1.6, top - 0.04, sz + 1.1, linC(0.62, 0.76, 0.86));
    KI.box(MI.metal, sx - 1.72, top - 0.1, sz - 1.22, sx + 1.72, top - 0.07, sz + 1.22, STEEL_D);
  }
  K.box(M.metal, -177.6, top + 0.3, 71.2, -174.8, top + 1.5, 74.6, linC(0.78, 0.79, 0.8));
  K.cyl(M.metal, 0.62, 0.62, top + 1.5, top + 1.56, STEEL_D, { axis: 'y', x: -176.2, z: 72.9, segs: 12 });
  K.box(M.metal, -178.9, top + 0.3, 72.5, -177.6, top + 0.8, 73.3, STEEL);
  floorWord(K, M.paint, WHITE, 'BOXING', 2.4, -184.8, 70.6, 1, 0, top + 0.302);
  // ---- the windows: steel frames, their glass through the wall (seen from both sides), the bars across them
  const win = (side, a0, a1, y0, y1, nu = 4) => {
    // side 'w': the front, a along z; 'n': 9th Street's side, a along x
    const W = side === 'w';
    const box = (K2, mat, u0, v0, d0, u1, v1, d1, col) => {
      if (W) K2.box(mat, Math.min(d0, d1), Y0 + v0, u0, Math.max(d0, d1), Y0 + v1, u1, col);
      else K2.box(mat, u0, Y0 + v0, Math.min(d0, d1), u1, Y0 + v1, Math.max(d0, d1), col);
    };
    const o = W ? X0 : Z0;
    const i = W ? xi0 : zi0;
    box(K, M.glass, a0, y0, o - 0.02, a1, y1, i + 0.02, GLASS);
    // (after dark: the light inside in it, behind its bars - KN, shown at night only)
    if (KN) box(KN, M.glow, a0, y0, o - 0.026, a1, y1, o - 0.021, NIGHT_WIN);
    // (the frame and the sill outside; the frame inside)
    box(K, M.metal, a0 - 0.08, y0 - 0.05, o - 0.08, a1 + 0.08, y0, o, CHAR);
    box(K, M.metal, a0 - 0.08, y1, o - 0.08, a1 + 0.08, y1 + 0.08, o, CHAR);
    box(K, M.metal, a0 - 0.08, y0, o - 0.08, a0, y1, o, CHAR);
    box(K, M.metal, a1, y0, o - 0.08, a1 + 0.08, y1, o, CHAR);
    box(K, M.matte, a0 - 0.14, y0 - 0.16, o - 0.18, a1 + 0.14, y0 - 0.05, o, CREAM);
    box(KI, MI.metal, a0 - 0.06, y0 - 0.06, i, a1 + 0.06, y0, i + 0.08, CHAR);
    box(KI, MI.metal, a0 - 0.06, y1, i, a1 + 0.06, y1 + 0.06, i + 0.05, CHAR);
    // (its panes: the bars across, both sides)
    const rows = Math.max(2, Math.round((y1 - y0) / 0.75));
    for (let k = 1; k < nu; k++) {
      const a = a0 + ((a1 - a0) * k) / nu;
      box(K, M.metal, a - 0.03, y0, o - 0.05, a + 0.03, y1, o - 0.02, CHAR);
      box(KI, MI.metal, a - 0.03, y0, i + 0.02, a + 0.03, y1, i + 0.05, CHAR);
    }
    for (let k = 1; k < rows; k++) {
      const y = y0 + ((y1 - y0) * k) / rows;
      box(K, M.metal, a0, y - 0.025, o - 0.05, a1, y + 0.025, o - 0.02, CHAR);
      box(KI, MI.metal, a0, y - 0.025, i + 0.02, a1, y + 0.025, i + 0.05, CHAR);
    }
  };
  // (the front: a tall one high in each bay - over the door a short one, the sign under it; low ones by the ring)
  for (let b = 0; b < piers.length - 1; b++) {
    const a0 = piers[b] + 0.75;
    const a1 = piers[b + 1] - 0.75;
    if (b === 0) win('w', a0, a1, 5.3, 7.0, 4);
    else win('w', a0, a1, 4.2, 7.0, 4);
    if (b === 1 || b === 2) win('w', a0 + 0.3, a1 - 0.3, 1.0, 2.6, 4);
  }
  // (9th Street's side: a window low in each of its end bays; the sign over the whole of it)
  win('n', -190.3, -186.3, 1.2, 2.9, 3);
  win('n', -178.0, -174.0, 1.2, 2.9, 3);
  // ---- the front door: its frame, the doors open in against the wall, the step, the canopy and its lamp
  K.box(M.metal, X0 - 0.1, Y0, DA - 0.12, xi0 + 0.04, Y0 + DH + 0.1, DA, RED_D);
  K.box(M.metal, X0 - 0.1, Y0, DB, xi0 + 0.04, Y0 + DH + 0.1, DB + 0.12, RED_D);
  K.box(M.metal, X0 - 0.1, Y0 + DH, DA, xi0 + 0.04, Y0 + DH + 0.1, DB, RED_D);
  for (const [za, s] of [[DA, 1], [DB, -1]]) {
    const z = za + s * 0.06;
    KI.box(MI.paint, xi0 + 0.05, yF, Math.min(z, z + s * 0.05), xi0 + 1.35, yF + DH - 0.08, Math.max(z, z + s * 0.05), RED_D);
    K.box(M.glass, xi0 + 0.18, yF + 1.0, Math.min(z, z + s * 0.06) - 0.004, xi0 + 1.22, yF + 2.5, Math.max(z, z + s * 0.06) + 0.004, GLASS);
    KI.box(MI.metal, xi0 + 0.25, yF + 0.95, Math.min(z, z + s * 0.08), xi0 + 1.15, yF + 1.0, Math.max(z, z + s * 0.08), STEEL);
  }
  K.box(M.matte, LOT.x0 + 0.1, Y0 + 0.012, DA - 0.3, X0, Y0 + 0.05, DB + 0.3, CHAR);
  K.box(M.paint, X0 - 1.35, Y0 + 3.0, DA - 0.55, X0, Y0 + 3.12, DB + 0.55, RED);
  K.box(M.paint, X0 - 1.4, Y0 + 2.82, DA - 0.55, X0 - 1.3, Y0 + 3.2, DB + 0.55, RED);
  wallWord(K, M.paint, WHITE, 'BOXING', 0.2, X0 - 1.4, Y0 + 2.92, (DA + DB) / 2, -1, 0, 0.006);
  for (const z of [DA - 0.45, DB + 0.45]) bar(K, M.metal, [X0, Y0 + 4.0, z], [X0 - 1.3, Y0 + 3.15, z], 0.04, 0.04, CHAR);
  K.box(M.glow, X0 - 0.9, Y0 + 2.96, (DA + DB) / 2 - 0.3, X0 - 0.5, Y0 + 3.0, (DA + DB) / 2 + 0.3, LAMP);
  // (the hours on a plaque beside the door)
  K.box(M.paint, X0 - 0.03, Y0 + 1.3, DB + 0.45, X0, Y0 + 2.1, DB + 1.15, CREAM);
  wallWord(K, M.paint, INK, 'OPEN', 0.1, X0 - 0.03, Y0 + 1.88, DB + 0.8, -1, 0, 0.004);
  wallWord(K, M.paint, INK, '6AM-10PM', 0.07, X0 - 0.03, Y0 + 1.68, DB + 0.8, -1, 0, 0.004);
  wallWord(K, M.paint, RED, 'ALL LEVELS', 0.065, X0 - 0.03, Y0 + 1.48, DB + 0.8, -1, 0, 0.004);
  // ---- the name in neon over the door: on its dark board, red and white
  {
    const zc = (DA + DB) / 2;
    const xb = X0 - 0.12;
    K.box(M.paint, xb, Y0 + 3.5, 41.3, X0, Y0 + 5.0, 46.6, INK);
    for (const [y0, y1, za, zb] of [[3.5, 3.56, 41.3, 46.6], [4.94, 5.0, 41.3, 46.6], [3.5, 5.0, 41.3, 41.36], [3.5, 5.0, 46.54, 46.6]]) K.box(M.glow, xb - 0.03, Y0 + y0, za, xb, Y0 + y1, zb, NEON_R);
    wallLetters(K, M.glow, NEON_R, '9TH STREET', 0.5, xb, Y0 + 4.22, zc, -1, 0, 0.01, 0.07);
    wallLetters(K, M.glow, NEON_W, 'BOXING GYM', 0.36, xb, Y0 + 3.7, zc, -1, 0, 0.01, 0.06);
  }
  // ---- the blade over the corner: BOXING down it, in red neon both ways round, on its cream board
  {
    const zc = 41.3;
    const bx0 = X0 - 1.55;
    const bx1 = X0 - 0.15;
    K.box(M.paint, bx0, Y0 + 3.7, zc - 0.12, bx1, Y0 + 7.6, zc + 0.12, CREAM);
    for (const [a, b, c, d] of [[bx0, 3.7, bx1, 3.8], [bx0, 7.5, bx1, 7.6], [bx0, 3.7, bx0 + 0.1, 7.6], [bx1 - 0.1, 3.7, bx1, 7.6]]) K.box(M.paint, a, Y0 + b, zc - 0.14, c, Y0 + d, zc + 0.14, RED);
    for (const y of [4.3, 7.0]) bar(K, M.metal, [X0, Y0 + y, zc], [bx1, Y0 + y, zc], 0.06, 0.06, CHAR);
    const word = 'BOXING';
    for (let i = 0; i < word.length; i++) {
      const y = Y0 + 6.82 - i * 0.55;
      for (const s of [-1, 1]) wallLetters(K, M.glow, NEON_R, word[i], 0.44, (bx0 + bx1) / 2, y, zc + s * 0.12, 0, s, 0.0, 0.04);
    }
    // (a glove in neon at its foot)
    for (const s of [-1, 1]) {
      const g = new THREE.TorusGeometry(0.22, 0.025, 6, 18);
      g.rotateY(s > 0 ? 0 : Math.PI);
      g.translate((bx0 + bx1) / 2, Y0 + 3.4, zc + s * 0.03);
      K.add(M.glow, g, NEON_W);
    }
    K.box(M.metal, (bx0 + bx1) / 2 - 0.02, Y0 + 3.6, zc - 0.02, (bx0 + bx1) / 2 + 0.02, Y0 + 3.7, zc + 0.02, CHAR);
  }
  // ---- 9th Street's side: the painted sign, the gloves either side of it, its lamps; the fight's bill in its case
  {
    const z = Z0;
    const sx0 = -190.4;
    const sx1 = -173.8;
    const cx = (sx0 + sx1) / 2;
    K.box(M.paint, sx0, Y0 + 4.55, z - 0.012, sx1, Y0 + 7.35, z, GREEN_D);
    for (const [a, b, c, d] of [[sx0 + 0.12, 4.67, sx1 - 0.12, 4.73], [sx0 + 0.12, 7.17, sx1 - 0.12, 7.23], [sx0 + 0.12, 4.67, sx0 + 0.18, 7.23], [sx1 - 0.18, 4.67, sx1 - 0.12, 7.23]]) K.box(M.paint, a, Y0 + b, z - 0.016, c, Y0 + d, z, CREAM);
    wallWord(K, M.paint, CREAM, '9TH STREET GYM', 0.95, cx, Y0 + 5.95, z - 0.012, 0, -1, 0.006);
    wallWord(K, M.paint, YEL, 'BOXING - TRAINING - FIGHT NIGHTS', 0.32, cx, Y0 + 5.25, z - 0.012, 0, -1, 0.006);
    wallWord(K, M.paint, CREAM, 'EST. 1961', 0.2, cx, Y0 + 4.86, z - 0.012, 0, -1, 0.006);
    paintedGlove(K, M, sx0 + 1.35, Y0 + 5.85, z - 0.012, 1.05, 1);
    paintedGlove(K, M, sx1 - 1.35, Y0 + 5.85, z - 0.012, 1.05, -1);
    for (const x of [-187.6, -182.1, -176.6]) {
      bar(K, M.metal, [x, Y0 + 7.85, z], [x, Y0 + 8.05, z - 0.55], 0.05, 0.05, CHAR);
      bar(K, M.metal, [x, Y0 + 8.05, z - 0.55], [x, Y0 + 7.8, z - 0.95], 0.05, 0.05, CHAR);
      K.cyl(M.metal, 0.08, 0.26, Y0 + 7.62, Y0 + 7.82, GREEN_D, { axis: 'y', x, z: z - 0.98, segs: 12 });
      K.cyl(M.glow, 0.24, 0.24, Y0 + 7.6, Y0 + 7.62, LAMP, { axis: 'y', x, z: z - 0.98, segs: 12 });
    }
    // (the bill in its glass case between the windows)
    K.box(M.metal, -184.1, Y0 + 0.9, z - 0.1, -180.1, Y0 + 2.95, z, CHAR);
    poster(K, M, -182.1, Y0 + 1.92, z - 0.1, 0, -1, 3.7, 1.9, RED, WHITE, [['FIGHT NIGHT', 0.3, YEL], ['FRIDAY 8PM', 0.18], ['9TH STREET GYM', 0.13]], YEL);
  }
  // ---- the alley's side: the fire door, its sign; vents
  K.box(M.metal, X1, Y0, 55.4, X1 + 0.06, Y0 + 2.2, 56.6, STEEL_D);
  K.box(M.glow, X1, Y0 + 2.35, 55.7, X1 + 0.08, Y0 + 2.55, 56.3, linC(0.3, 1, 0.45));
  for (const z of [48.0, 63.0]) K.box(M.metal, X1, Y0 + 4.6, z - 0.4, X1 + 0.12, Y0 + 5.2, z + 0.4, STEEL);

  // =================================================================== inside
  // ---- the floor (concrete), the rubber where they train, the walls' paint (a dado of red, cream above), the ceiling
  KI.box(MI.matte, xi0, Y0 - 0.1, zi0, xi1, yF, zi1, FLOOR);
  KI.box(MI.matte, xi0, yF, 62.2, -181.4, yF + 0.012, zi1, MAT);
  const liner = (a, b, c, d, nx, nz) => {
    // (a wall's inside face: x a..c, z b..d; the dado to 1.2, a white line, cream above)
    KI.box(MI.matte, a, Y0, b, c, Y0 + 1.2, d, DADO);
    KI.box(MI.matte, a - nx * 0.004, Y0 + 1.2, b - nz * 0.004, c - nx * 0.004, Y0 + 1.28, d - nz * 0.004, WHITE);
    KI.box(MI.matte, a, Y0 + 1.28, b, c, top - 0.02, d, WALL_IN);
  };
  liner(xi0, zi0, xi0 + 0.012, DA, 1, 0);
  liner(xi0, DB, xi0 + 0.012, zi1, 1, 0);
  KI.box(MI.matte, xi0, Y0 + DH + 0.1, DA, xi0 + 0.012, top - 0.02, DB, WALL_IN);
  liner(xi0, zi0, xi1, zi0 + 0.012, 0, 1);
  liner(xi1 - 0.012, zi0, xi1, zi1, -1, 0);
  liner(xi0, zi1 - 0.012, xi1, zi1, 0, -1);
  KI.box(MI.matte, xi0, top - 0.04, zi0, xi1, top - 0.01, zi1, CEIL);
  // ---- the trusses across, their struts; the strip lights hung from them
  const trusses = [44.4, 51.2, 58.8, 66.2, 72.8];
  for (const z of trusses) {
    const yb = Y0 + G.room + 0.05;
    const yt = top - 0.12;
    bar(KI, MI.metal, [xi0, yb, z], [xi1, yb, z], 0.16, 0.12, STEEL_D);
    bar(KI, MI.metal, [xi0, yt, z], [xi1, yt, z], 0.16, 0.12, STEEL_D);
    const n = 8;
    for (let k = 0; k <= n; k++) {
      const x = xi0 + ((xi1 - xi0) * k) / n;
      bar(KI, MI.metal, [x, yb, z], [x, yt, z], 0.08, 0.08, STEEL_D);
      if (k < n) {
        const x2 = xi0 + ((xi1 - xi0) * (k + 1)) / n;
        if (k % 2) bar(KI, MI.metal, [x, yb, z], [x2, yt, z], 0.06, 0.06, STEEL_D);
        else bar(KI, MI.metal, [x, yt, z], [x2, yb, z], 0.06, 0.06, STEEL_D);
      }
    }
  }
  for (const x of [-187.5, -177.7]) {
    for (const z of [44.4, 66.2, 72.8]) {
      KI.box(MI.metal, x - 0.9, Y0 + 5.9, z - 0.1, x + 0.9, Y0 + 6.0, z + 0.1, STEEL_D);
      KI.box(MI.glow, x - 0.85, Y0 + 5.86, z - 0.06, x + 0.85, Y0 + 5.9, z + 0.06, TUBE);
      for (const s of [-0.7, 0.7]) KI.box(MI.metal, x + s - 0.01, Y0 + 6.0, z - 0.01, x + s + 0.01, Y0 + G.room + 0.05, z + 0.01, STEEL_D);
    }
  }
  // =================================================================== the ring
  const R = G.ring;
  const rx = R.x;
  const rz = R.z;
  const cy = Y0 + R.h;
  const A = R.apron;
  // ---- the platform, its skirt with the gym's name, the canvas over it; the apron's blue, the logo in the middle
  KI.box(MI.matte, rx - A, Y0, rz - A, rx + A, cy - 0.08, rz + A, NAVY);
  KI.box(MI.paint, rx - A - 0.01, cy - 0.2, rz - A - 0.01, rx + A + 0.01, cy - 0.08, rz + A + 0.01, RED);
  KI.box(MI.matte, rx - A - 0.04, cy - 0.08, rz - A - 0.04, rx + A + 0.04, cy, rz + A + 0.04, CANVAS);
  wall(rx - A, rz - A, rx + A, rz + A, 0, cy, 'floor');
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) wallWord(KI, MI.paint, WHITE, '9TH STREET GYM', 0.3, rx + nx * A, Y0 + 0.32, rz + nz * A, nx, nz, 0.012);
  for (const s of [-1, 1]) {
    KI.box(MI.paint, rx - A + 0.02, cy + 0.001, rz + s * (R.half + 0.12), rx + A - 0.02, cy + 0.004, rz + s * (A - 0.02), BLUE);
    KI.box(MI.paint, rx + s * (R.half + 0.12), cy + 0.001, rz - R.half - 0.12, rx + s * (A - 0.02), cy + 0.004, rz + R.half + 0.12, BLUE);
  }
  floorRing(KI, MI.paint, RED, rx, rz, 1.12, 1.28, cy + 0.003, 40);
  floorWord(KI, MI.paint, RED, '9TH ST', 0.42, rx, rz - 0.3, 0, 1, cy + 0.003);
  floorWord(KI, MI.paint, NAVY, 'GYM', 0.36, rx, rz + 0.32, 0, 1, cy + 0.003);
  // ---- the posts, their pads (red, blue and the two white), the ropes - red, white, blue - and their ties
  const P0 = R.half + 0.15;
  const pads = [[-1, -1, RED], [1, -1, WHITE], [1, 1, BLUE], [-1, 1, WHITE]];
  for (const [sx, sz, col] of pads) {
    const px = rx + sx * P0;
    const pz = rz + sz * P0;
    KI.cyl(MI.metal, 0.07, 0.07, cy, cy + 1.42, STEEL, { axis: 'y', x: px, z: pz, segs: 10 });
    KI.cyl(MI.metal, 0.1, 0.1, cy + 1.42, cy + 1.48, STEEL_D, { axis: 'y', x: px, z: pz, segs: 10 });
    yawBox(KI, MI.matte, px - sx * 0.1, cy + 0.84, pz - sz * 0.1, 0.3, 1.16, 0.16, Math.atan2(-sx, -sz), col === RED ? RED_D : col === BLUE ? NAVY : col);
  }
  const ropes = [[0.42, BLUE], [0.82, WHITE], [1.22, RED]];
  const C4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = C4[k];
    const [bx, bz] = C4[(k + 1) % 4];
    for (const [h, col] of ropes) beam(KI, MI.paint, [rx + ax * (R.half + 0.08), cy + h, rz + az * (R.half + 0.08)], [rx + bx * (R.half + 0.08), cy + h, rz + bz * (R.half + 0.08)], 0.035, col, 8);
    for (const t of [0.33, 0.67]) {
      const x = rx + (ax + (bx - ax) * t) * (R.half + 0.08);
      const z = rz + (az + (bz - az) * t) * (R.half + 0.08);
      KI.box(MI.paint, x - 0.03, cy + 0.38, z - 0.03, x + 0.03, cy + 1.26, z + 0.03, WHITE);
    }
  }
  // (a towel over the red corner's top rope)
  yawBox(KI, MI.matte, rx - P0 + 0.5, cy + 1.08, rz - R.half - 0.08, 0.42, 0.32, 0.05, 0, WHITE);
  // ---- the steps up at the red corner, their rails
  const sx0 = rx - R.half - 0.3;
  const sx1 = rx - R.half + 0.9;
  for (let i = 0; i < 4; i++) {
    const za = rz - A - 1.4 + i * 0.35;
    const yt = Y0 + ((i + 1) * (R.h - 0.0)) / 4;
    KI.box(MI.matte, sx0, Y0, za, sx1, yt - 0.04, rz - A, WOOD_D);
    KI.box(MI.matte, sx0 - 0.02, yt - 0.04, za, sx1 + 0.02, yt, za + 0.35, WOOD);
    wall(sx0, za, sx1, za + 0.35, 0, yt, 'floor');
  }
  for (const x of [sx0 - 0.05, sx1 + 0.05]) {
    bar(KI, MI.metal, [x, Y0 + 0.95, rz - A - 1.4], [x, cy + 0.95, rz - A], 0.05, 0.05, STEEL);
    KI.box(MI.metal, x - 0.025, Y0, rz - A - 1.42, x + 0.025, Y0 + 0.95, rz - A - 1.38, STEEL);
  }
  // ---- the corners' stools and buckets, the sponge, the bottles; the timekeeper's table, the bell, the clock, his chairs
  for (const [sx, sz, col] of [[-1, -1, RED], [1, 1, BLUE]]) {
    const x = rx + sx * (A + 0.55);
    const z = rz + sz * (R.half - 0.4);
    KI.box(MI.paint, x - 0.22, Y0 + 0.56, z - 0.22, x + 0.22, Y0 + 0.62, z + 0.22, col);
    for (const [dx, dz] of [[-0.17, -0.17], [0.17, -0.17], [0.17, 0.17], [-0.17, 0.17]]) bar(KI, MI.metal, [x + dx, Y0 + 0.56, z + dz], [x + dx * 1.25, Y0, z + dz * 1.25], 0.03, 0.03, STEEL);
    wall(x - 0.25, z - 0.25, x + 0.25, z + 0.25, 0, Y0 + 0.62, 'prop');
    const bx = x;
    const bz = z + sz * 0.62;
    KI.cyl(MI.metal, 0.17, 0.2, Y0, Y0 + 0.34, col === RED ? RED_D : NAVY, { axis: 'y', x: bx, z: bz, segs: 12 });
    KI.cyl(MI.matte, 0.16, 0.16, Y0 + 0.3, Y0 + 0.31, linC(0.5, 0.66, 0.8), { axis: 'y', x: bx, z: bz, segs: 12 });
    KI.box(MI.matte, bx - 0.1, Y0 + 0.32, bz - 0.06, bx + 0.08, Y0 + 0.38, bz + 0.06, YEL);
    KI.cyl(MI.paint, 0.04, 0.04, Y0, Y0 + 0.26, WHITE, { axis: 'y', x: bx + sx * 0.28, z: bz, segs: 8 });
    wall(bx - 0.22, bz - 0.22, bx + 0.22, bz + 0.22, 0, Y0 + 0.34, 'prop');
  }
  {
    const tx0 = -189.9;
    const tx1 = -188.7;
    KI.box(MI.matte, tx0, Y0 + 0.72, 53.9, tx1, Y0 + 0.77, 56.1, WOOD);
    for (const [x, z] of [[tx0 + 0.05, 54.0], [tx1 - 0.05, 54.0], [tx0 + 0.05, 56.0], [tx1 - 0.05, 56.0]]) KI.box(MI.metal, x - 0.02, Y0, z - 0.02, x + 0.02, Y0 + 0.72, z + 0.02, STEEL_D);
    wall(tx0, 53.9, tx1, 56.1, 0, Y0 + 0.77, 'prop');
    // (the bell on its board, facing the ring; the hammer; the round clock, its lights)
    KI.box(MI.matte, tx1 - 0.25, Y0 + 0.77, 54.35, tx1 - 0.2, Y0 + 1.25, 54.85, WOOD_D);
    cylX(KI, MI.metal, 0.17, tx1 - 0.2, tx1 - 0.12, Y0 + 1.03, 54.6, GOLD, 16);
    cylX(KI, MI.metal, 0.05, tx1 - 0.12, tx1 - 0.08, Y0 + 1.03, 54.6, STEEL, 8);
    bar(KI, MI.matte, [tx0 + 0.3, Y0 + 0.79, 55.0], [tx0 + 0.75, Y0 + 0.79, 55.2], 0.03, 0.03, WOOD_D);
    KI.box(MI.matte, tx0 + 0.25, Y0 + 0.77, 55.45, tx0 + 0.85, Y0 + 1.15, 55.9, INK);
    KI.box(MI.glow, tx0 + 0.85, Y0 + 0.92, 55.5, tx0 + 0.86, Y0 + 1.08, 55.85, linC(1, 0.25, 0.2));
    for (const z of [54.4, 55.6]) {
      const x = tx0 - 0.45;
      KI.box(MI.paint, x - 0.22, Y0 + 0.44, z - 0.22, x + 0.22, Y0 + 0.48, z + 0.22, STEEL_D);
      KI.box(MI.paint, x - 0.24, Y0 + 0.48, z - 0.21, x - 0.2, Y0 + 0.9, z + 0.21, STEEL_D);
      for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [0.18, 0.18], [-0.18, 0.18]]) KI.box(MI.metal, x + dx - 0.015, Y0, z + dz - 0.015, x + dx + 0.015, Y0 + 0.44, z + dz + 0.015, STEEL);
      wall(x - 0.24, z - 0.24, x + 0.22, z + 0.24, 0, Y0 + 0.48, 'prop');
    }
  }
  // ---- the lights over the ring: a frame hung from the trusses, its lamps
  {
    const yl = Y0 + R.ceil + 0.15;
    const f = 2.5;
    for (const [a, b] of [[[-f, -f], [f, -f]], [[f, -f], [f, f]], [[f, f], [-f, f]], [[-f, f], [-f, -f]]]) bar(KI, MI.metal, [rx + a[0], yl + 0.1, rz + a[1]], [rx + b[0], yl + 0.1, rz + b[1]], 0.1, 0.14, INK);
    for (const [sx, sz] of C4) {
      const tz = sz < 0 ? 51.2 : 58.8;
      bar(KI, MI.metal, [rx + sx * f, yl + 0.17, rz + sz * f], [rx + sx * f, Y0 + G.room + 0.05, tz], 0.025, 0.025, STEEL_D);
    }
    for (const [sx, sz] of [[-1, -0.4], [-1, 0.4], [1, -0.4], [1, 0.4], [-0.4, -1], [0.4, -1], [-0.4, 1], [0.4, 1]]) {
      const x = rx + sx * f;
      const z = rz + sz * f;
      KI.box(MI.metal, x - 0.28, yl - 0.12, z - 0.28, x + 0.28, yl + 0.04, z + 0.28, INK);
      KI.box(MI.glow, x - 0.24, yl - 0.13, z - 0.24, x + 0.24, yl - 0.12, z + 0.24, LAMP);
    }
    // (the banner hung from it on the door's side: the champion's name goes on the board, this is the house's)
    KI.box(MI.paint, rx - 1.6, yl - 0.75, rz - f - 0.03, rx + 1.6, yl, rz - f + 0.03, RED);
    for (const s of [-1, 1]) wallWord(KI, MI.paint, WHITE, 'CHAMPIONS ARE MADE HERE', 0.15, rx, yl - 0.47, rz - f + s * 0.03, 0, s, 0.004);
  }
  // =================================================================== the bleachers along the alley's wall
  {
    const S = G.stands;
    const d = (xi1 - S.x0) / 3;
    for (let k = 0; k < 3; k++) {
      const xa = S.x0 + k * d;
      const yt = Y0 + 0.42 * (k + 1);
      KI.box(MI.metal, xa, Y0, S.z0, xi1, yt - 0.05, S.z1, k % 2 ? STEEL_D : linC(0.22, 0.23, 0.27));
      KI.box(MI.matte, xa - 0.04, yt - 0.05, S.z0, xa + d * 0.62, yt, S.z1, WOOD);
      wall(xa, S.z0, xi1, S.z1, 0, yt, 'floor');
    }
    for (const z of [S.z0, S.z1]) {
      bar(KI, MI.metal, [S.x0, Y0 + 0.95, z], [xi1, Y0 + 2.2, z], 0.05, 0.05, STEEL);
      KI.box(MI.metal, S.x0 - 0.025, Y0, z - 0.025, S.x0 + 0.025, Y0 + 0.95, z + 0.025, STEEL);
    }
    bar(KI, MI.metal, [xi1 - 0.12, Y0 + 2.25, S.z0], [xi1 - 0.12, Y0 + 2.25, S.z1], 0.05, 0.05, STEEL);
    // (a water bottle, a towel, a cap left on them)
    KI.cyl(MI.paint, 0.04, 0.04, Y0 + 0.42, Y0 + 0.66, BLUE, { axis: 'y', x: S.x0 + 0.3, z: 52.6, segs: 8 });
    KI.box(MI.matte, S.x0 + 1.1, Y0 + 0.84, 57.2, S.x0 + 1.5, Y0 + 0.87, 57.8, WHITE);
  }
  // =================================================================== the bags: the beam, its post; the bags themselves swing (KM)
  const movers = [];
  {
    const z = G.bagZ;
    const yb = Y0 + G.bagBeam;
    const xe = G.bags[G.bags.length - 1] + 1.5;
    KI.box(MI.metal, xi0, yb, z - 0.1, xe + 0.12, yb + 0.3, z + 0.1, RED_D);
    KI.box(MI.metal, xi0, yb, z - 0.04, xe + 0.12, yb + 0.3, z + 0.04, RED_D);
    KI.box(MI.metal, xe, Y0, z - 0.12, xe + 0.24, yb + 0.3, z + 0.12, RED_D);
    KI.box(MI.metal, xe - 0.1, Y0, z - 0.25, xe + 0.34, Y0 + 0.06, z + 0.25, STEEL_D);
    wall(xe, z - 0.12, xe + 0.24, z + 0.12, 0, yb + 0.3, 'pole');
    G.bags.forEach((bx, i) => {
      const n0 = vcount(KM);
      const col = LEATHER[i % LEATHER.length];
      const yt = Y0 + 1.92;
      const yb2 = Y0 + 0.62;
      // (the swivel, the four chains to the top of the bag)
      KM.cyl(MI.paint, 0.04, 0.04, yb - 0.16, yb, STEEL, { axis: 'y', x: bx, z, segs: 8 });
      for (const [dx, dz] of [[-0.14, 0], [0.14, 0], [0, -0.14], [0, 0.14]]) bar(KM, MI.paint, [bx, yb - 0.16, z], [bx + dx, yt + 0.04, z + dz], 0.018, 0.018, STEEL_D);
      KM.cyl(MI.paint, 0.2, 0.2, yt - 0.06, yt + 0.02, INK, { axis: 'y', x: bx, z, segs: 16 });
      KM.cyl(MI.paint, 0.2, 0.2, yb2 + 0.06, yt - 0.06, col, { axis: 'y', x: bx, z, segs: 16 });
      KM.cyl(MI.paint, 0.2, 0.17, yb2, yb2 + 0.06, INK, { axis: 'y', x: bx, z, segs: 16 });
      KM.cyl(MI.paint, 0.205, 0.205, yt - 0.5, yt - 0.36, i === 1 ? RED : WHITE, { axis: 'y', x: bx, z, segs: 16 });
      KM.cyl(MI.paint, 0.205, 0.205, yb2 + 0.3, yb2 + 0.36, i === 1 ? RED : WHITE, { axis: 'y', x: bx, z, segs: 16 });
      movers.push({ kind: 'heavy', i, n0, n1: vcount(KM), px: bx, py: yb - 0.08, pz: z, x: bx, y: Y0 + 1.3, z });
      wall(bx - 0.24, z - 0.24, bx + 0.24, z + 0.24, yb2, yt, 'prop');
      // (the floor under it, worn: where the feet go round)
      floorRing(KI, MI.matte, linC(0.24, 0.24, 0.27), bx, z - 0.75, 0.45, 0.62, yF + 0.014, 20);
    });
  }
  // ---- the speed bag: its platform on the back wall, the bag swinging under it (KM)
  {
    const S = G.speed;
    const yp = Y0 + 1.98;
    for (const s of [-1, 1]) {
      bar(KI, MI.metal, [S.x + s * 0.3, yp + 0.02, zi1], [S.x + s * 0.3, yp + 0.02, S.z - 0.2], 0.06, 0.06, STEEL_D);
      bar(KI, MI.metal, [S.x + s * 0.3, yp + 0.55, zi1], [S.x + s * 0.3, yp + 0.04, S.z - 0.1], 0.04, 0.04, STEEL_D);
    }
    KI.box(MI.matte, S.x - 0.55, yp - 0.7, zi1 - 0.03, S.x + 0.55, yp + 0.7, zi1, WOOD_D);
    KI.cyl(MI.matte, 0.45, 0.45, yp, yp + 0.07, WOOD, { axis: 'y', x: S.x, z: S.z, segs: 18 });
    KI.cyl(MI.metal, 0.05, 0.05, yp - 0.05, yp, STEEL, { axis: 'y', x: S.x, z: S.z, segs: 8 });
    const n0 = vcount(KM);
    KM.cyl(MI.paint, 0.012, 0.012, yp - 0.12, yp - 0.04, STEEL, { axis: 'y', x: S.x, z: S.z, segs: 6 });
    KM.sphere(MI.paint, 0.11, S.x, Y0 + S.y, S.z, RED, 1, 1.45, 1, 12);
    KM.sphere(MI.paint, 0.05, S.x, Y0 + S.y + 0.15, S.z, RED_D, 1, 1, 1, 8);
    movers.push({ kind: 'speed', n0, n1: vcount(KM), px: S.x, py: yp - 0.05, pz: S.z, x: S.x, y: Y0 + S.y, z: S.z });
    floorWord(KI, MI.paint, WHITE, 'SPEED', 0.2, S.x, S.z - 0.9, 0, -1, yF + 0.016);
  }
  // ---- the mitts' mat: blue, its red edge, where you stand and where the coach does
  {
    const m = G.mitts;
    KI.box(MI.matte, m.x - 1.5, yF, m.z - 1.5, m.x + 1.5, yF + 0.03, m.z + 1.5, MAT_B);
    const y = yF + 0.032;
    for (const [a, b, c, d] of [[-1.42, -1.42, 1.42, -1.42], [1.42, -1.42, 1.42, 1.42], [1.42, 1.42, -1.42, 1.42], [-1.42, 1.42, -1.42, -1.42]]) floorLine(KI, MI.paint, RED, m.x + a, m.z + b, m.x + c, m.z + d, 0.08, y);
    floorWord(KI, MI.paint, WHITE, 'MITTS', 0.3, m.x, m.z - 1.12, 0, 1, y);
    for (const s of [-1, 1]) floorDisc(KI, MI.paint, WHITE, m.x + s * 0.17, m.z - 0.49, 0.09, y, 10, 0.8, 1.4);
    floorRing(KI, MI.paint, YEL, m.x, m.z + 0.49, 0.22, 0.28, y, 20);
  }
  // ---- the mirrors along the front wall where they shadowbox; the ropes on their rack beside them
  for (let k = 0; k < 4; k++) {
    const z0 = 61.0 + k * 2.4;
    KI.box(MI.metal, xi0 + 0.012, Y0 + 0.35, z0 + 0.04, xi0 + 0.04, Y0 + 2.35, z0 + 2.36, MIRROR);
    KI.box(MI.matte, xi0 + 0.012, Y0 + 0.3, z0, xi0 + 0.05, Y0 + 0.35, z0 + 2.4, INK);
    KI.box(MI.matte, xi0 + 0.012, Y0 + 2.35, z0, xi0 + 0.05, Y0 + 2.4, z0 + 2.4, INK);
    KI.box(MI.matte, xi0 + 0.012, Y0 + 0.3, z0, xi0 + 0.05, Y0 + 2.4, z0 + 0.04, INK);
  }
  KI.box(MI.matte, xi0 + 0.012, Y0 + 0.3, 70.6, xi0 + 0.05, Y0 + 2.4, 70.64, INK);
  {
    const yr = Y0 + 1.95;
    const xr = xi0 + 0.14;
    KI.box(MI.metal, xi0, yr - 0.02, 72.0, xr + 0.02, yr + 0.02, 75.0, STEEL_D);
    const cols = [RED, BLUE, YEL, WHITE, linC(0.2, 0.7, 0.4), RED];
    for (let i = 0; i < 6; i++) {
      const z = 72.25 + i * 0.5;
      const yb = Y0 + 0.9 + (i % 2) * 0.12;
      KI.box(MI.metal, xi0, yr - 0.01, z - 0.01, xr + 0.04, yr + 0.01, z + 0.01, STEEL);
      KI.cyl(MI.paint, 0.022, 0.022, yr - 0.16, yr, WOOD_D, { axis: 'y', x: xr, z: z - 0.06, segs: 6 });
      KI.cyl(MI.paint, 0.022, 0.022, yr - 0.16, yr, WOOD_D, { axis: 'y', x: xr, z: z + 0.06, segs: 6 });
      bar(KI, MI.paint, [xr, yr - 0.16, z - 0.06], [xr + 0.02, yb, z - 0.1], 0.012, 0.012, cols[i]);
      bar(KI, MI.paint, [xr, yr - 0.16, z + 0.06], [xr + 0.02, yb, z + 0.1], 0.012, 0.012, cols[i]);
      bar(KI, MI.paint, [xr + 0.02, yb, z - 0.1], [xr + 0.02, yb, z + 0.1], 0.012, 0.012, cols[i]);
    }
    wallWord(KI, MI.paint, RED, 'SKIP 3 ROUNDS', 0.14, xi0 + 0.012, Y0 + 2.3, 73.5, 1, 0, 0.004);
  }
  // =================================================================== by the door: the desk, the cooler, the lockers, the scale
  {
    // (the front desk in the corner: its counter, the till, the sign-in sheet, the bell; the stool behind it)
    const dx0 = -190.6;
    const dx1 = -187.2;
    const dz0 = 41.05;
    const dz1 = 41.8;
    KI.box(MI.matte, dx0, Y0, dz0, dx1, Y0 + 1.0, dz1, WOOD_D);
    KI.box(MI.matte, dx0 - 0.03, Y0 + 1.0, dz0 - 0.03, dx1 + 0.06, Y0 + 1.06, dz1 + 0.06, CHAR);
    KI.box(MI.paint, dx0 + 0.2, Y0 + 0.2, dz1, dx1 - 0.2, Y0 + 0.8, dz1 + 0.012, RED);
    wallWord(KI, MI.paint, WHITE, 'SIGN IN', 0.16, (dx0 + dx1) / 2, Y0 + 0.42, dz1 + 0.012, 0, 1, 0.004);
    KI.box(MI.metal, dx0 + 0.3, Y0 + 1.06, dz0 + 0.12, dx0 + 0.75, Y0 + 1.28, dz0 + 0.5, STEEL_D);
    KI.box(MI.matte, dx1 - 0.9, Y0 + 1.06, dz0 + 0.3, dx1 - 0.6, Y0 + 1.07, dz0 + 0.62, WHITE);
    KI.cyl(MI.metal, 0.05, 0.06, Y0 + 1.06, Y0 + 1.11, GOLD, { axis: 'y', x: dx1 - 0.35, z: dz0 + 0.4, segs: 10 });
    wall(dx0, dz0, dx1, dz1, 0, Y0 + 1.06, 'prop');
    // (the water cooler, the scale with its weights)
    KI.box(MI.matte, -186.75, Y0, 40.75, -186.35, Y0 + 1.0, 41.15, WHITE);
    KI.cyl(MI.paint, 0.16, 0.16, Y0 + 1.0, Y0 + 1.45, linC(0.45, 0.7, 0.95), { axis: 'y', x: -186.55, z: 40.95, segs: 12 });
    wall(-186.8, 40.7, -186.3, 41.2, 0, Y0 + 1.45, 'prop');
    KI.box(MI.metal, -176.0, Y0, 41.0, -175.4, Y0 + 0.08, 41.6, STEEL_D);
    KI.box(MI.metal, -175.75, Y0 + 0.08, 41.05, -175.65, Y0 + 1.6, 41.15, STEEL_D);
    KI.box(MI.metal, -176.1, Y0 + 1.5, 41.05, -175.3, Y0 + 1.54, 41.15, STEEL);
    KI.box(MI.metal, -175.6, Y0 + 1.46, 41.03, -175.52, Y0 + 1.58, 41.17, GOLD);
    floorWord(KI, MI.paint, INK, 'WEIGH IN', 0.12, -175.7, 41.9, 0, 1, yF + 0.003);
    // (the lockers along the east wall, their vents and handles, a number each; the bench before them, what is left on it)
    const lx = xi1 - 0.48;
    for (let i = 0; i < 13; i++) {
      const za = 41.05 + i * 0.52;
      KI.box(MI.metal, lx, Y0, za, xi1, Y0 + 1.95, za + 0.5, i % 4 === 2 ? linC(0.3, 0.42, 0.46) : LOCKER);
      for (let v = 0; v < 3; v++) KI.box(MI.matte, lx - 0.006, Y0 + 1.6 + v * 0.07, za + 0.12, lx, Y0 + 1.63 + v * 0.07, za + 0.38, INK);
      KI.box(MI.metal, lx - 0.03, Y0 + 1.0, za + 0.38, lx, Y0 + 1.16, za + 0.42, STEEL);
      KI.box(MI.paint, lx - 0.006, Y0 + 1.42, za + 0.2, lx, Y0 + 1.5, za + 0.3, WHITE);
    }
    wall(lx, 41.05, xi1, 41.05 + 13 * 0.52, 0, Y0 + 1.95, 'prop');
    KI.box(MI.matte, lx - 0.85, Y0 + 0.42, 41.4, lx - 0.45, Y0 + 0.47, 47.4, WOOD);
    for (const z of [41.6, 44.4, 47.2]) KI.box(MI.metal, lx - 0.7, Y0, z - 0.03, lx - 0.6, Y0 + 0.42, z + 0.03, STEEL_D);
    wall(lx - 0.85, 41.4, lx - 0.45, 47.4, 0, Y0 + 0.47, 'prop');
    KI.box(MI.matte, lx - 0.82, Y0 + 0.47, 42.0, lx - 0.48, Y0 + 0.5, 42.7, WHITE);
    KI.box(MI.paint, lx - 0.8, Y0 + 0.47, 45.2, lx - 0.5, Y0 + 0.72, 45.9, RED);
    for (const dz of [0, 0.24]) KI.sphere(MI.paint, 0.11, lx - 0.65, Y0 + 0.58, 46.6 + dz, RED, 1, 0.9, 1.2, 10);
  }
  // ---- the north wall: the fight-night board (its words are the board's own: buildBoard), the champion's belt in its case
  // over it, the posters either side
  {
    const z = zi0 + 0.012;
    const B = BOARD;
    KI.box(MI.matte, B.x - B.w / 2 - 0.08, Y0 + B.y0 - 0.08, z, B.x + B.w / 2 + 0.08, Y0 + B.y0 + B.h + 0.08, z + 0.05, WOOD_D);
    KI.box(MI.matte, B.x - B.w / 2, Y0 + B.y0, z + 0.05, B.x + B.w / 2, Y0 + B.y0 + B.h, z + 0.055, CHALK);
    KI.box(MI.matte, B.x - B.w / 2, Y0 + B.y0 - 0.12, z, B.x + B.w / 2, Y0 + B.y0 - 0.08, z + 0.14, WOOD_D);
    for (const [dx, col] of [[-1.2, WHITE], [-1.0, YEL], [1.1, WHITE]]) KI.box(MI.matte, B.x + dx, Y0 + B.y0 - 0.08, z + 0.06, B.x + dx + 0.12, Y0 + B.y0 - 0.05, z + 0.09, col);
    // (the belt: its case, the red behind it, the strap, the gold)
    const bx = B.x;
    const by = Y0 + 3.45;
    KI.box(MI.matte, bx - 1.05, by - 0.45, z, bx + 1.05, by + 0.45, z + 0.08, WOOD_D);
    KI.box(MI.matte, bx - 0.97, by - 0.37, z + 0.08, bx + 0.97, by + 0.37, z + 0.085, RED_D);
    KI.box(MI.paint, bx - 0.85, by - 0.08, z + 0.085, bx + 0.85, by + 0.08, z + 0.11, INK);
    const plate = new THREE.CylinderGeometry(0.22, 0.22, 0.04, 20).rotateX(Math.PI / 2);
    plate.translate(bx, by, z + 0.12);
    KI.add(MI.metal, plate, GOLD);
    const gem = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 12).rotateX(Math.PI / 2);
    gem.translate(bx, by, z + 0.15);
    KI.add(MI.paint, gem, RED);
    for (const s of [-1, 1]) {
      KI.box(MI.metal, bx + s * 0.42 - 0.09, by - 0.11, z + 0.1, bx + s * 0.42 + 0.09, by + 0.11, z + 0.13, GOLD);
      KI.box(MI.metal, bx + s * 0.66 - 0.05, by - 0.07, z + 0.1, bx + s * 0.66 + 0.05, by + 0.07, z + 0.125, GOLD);
    }
    KI.box(MI.metal, bx - 0.4, by - 0.62, z, bx + 0.4, by - 0.5, z + 0.03, GOLD);
    wallWord(KI, MI.paint, INK, 'CHAMPION', 0.07, bx, by - 0.6, z + 0.03, 0, 1, 0.004);
    KI.box(MI.metal, bx - 0.5, by + 0.55, z, bx + 0.5, by + 0.62, z + 0.25, INK);
    KI.box(MI.glow, bx - 0.45, by + 0.54, z + 0.1, bx + 0.45, by + 0.55, z + 0.22, LAMP);
    poster(KI, MI, -185.05, Y0 + 2.05, z, 0, 1, 1.05, 1.5, YEL, INK, [['KID RICKY', 0.17], ['VS', 0.14, RED], ['BIG SAL', 0.17]], RED);
    poster(KI, MI, -179.6, Y0 + 2.05, z, 0, 1, 1.05, 1.5, BLUE, WHITE, [['TITLE', 0.17, YEL], ['NIGHT', 0.17, YEL], ['THE INK', 0.13]], RED);
  }
  // ---- the posters over the bleachers and on the back wall: the fights of the years
  const bills = [
    [RED, WHITE, [['LEFTY', 0.2], ['OKAFOR', 0.2], ['VS QUICK', 0.13, YEL]], YEL],
    [CREAM, INK, [['FIGHT', 0.22, RED], ['NIGHT', 0.22, RED], ['SAT 9PM', 0.13]], RED],
    [INK, YEL, [['MARCUS', 0.18], ['HALE', 0.22, WHITE], ['CHAMPION', 0.12]], RED],
    [BLUE, WHITE, [['GOLDEN', 0.18, YEL], ['GLOVES', 0.18, YEL], ['1979', 0.14]], WHITE],
  ];
  bills.forEach(([bg, fg, lines, acc], i) => poster(KI, MI, xi1 - 0.012, Y0 + 3.35, 50.4 + i * 3.2, -1, 0, 1.2, 1.6, bg, fg, lines, acc));
  poster(KI, MI, -187.3, Y0 + 3.6, zi1 - 0.012, 0, -1, 1.3, 1.7, linC(0.95, 0.55, 0.15), INK, [['BOXING', 0.2], ['CLASSES', 0.17], ['ALL AGES', 0.12, WHITE]], RED);
  KI.box(MI.paint, -185.6, Y0 + 4.1, zi1 - 0.025, -181.8, Y0 + 4.9, zi1 - 0.012, INK);
  wallWord(KI, MI.paint, YEL, 'NO PAIN', 0.26, -183.7, Y0 + 4.52, zi1 - 0.025, 0, -1, 0.004);
  wallWord(KI, MI.paint, WHITE, 'NO CHAMPION', 0.18, -183.7, Y0 + 4.2, zi1 - 0.025, 0, -1, 0.004);
  // (the round's clock on the wall over the bags: its red and its green)
  KI.box(MI.matte, xi0 + 0.012, Y0 + 3.0, 67.3, xi0 + 0.15, Y0 + 3.55, 68.5, INK);
  KI.box(MI.glow, xi0 + 0.15, Y0 + 3.12, 67.45, xi0 + 0.16, Y0 + 3.42, 68.05, linC(1, 0.3, 0.25));
  KI.box(MI.glow, xi0 + 0.15, Y0 + 3.2, 68.15, xi0 + 0.16, Y0 + 3.34, 68.35, linC(0.3, 1, 0.4));
  // =================================================================== the office in the back corner
  {
    const O = G.office;
    const oy = Y0 + O.h;
    const ox0 = O.x0;
    const oz0 = O.z0;
    const w = 0.15;
    // (its north wall: the room's side of it bare and pale - the find's page is hung there - a skirting at its foot)
    KI.box(MI.matte, ox0, Y0, oz0, xi1, oy, oz0 + w, OFFICE_W);
    KI.box(MI.matte, ox0, Y0, oz0 - 0.012, xi1, Y0 + 0.14, oz0, WOOD_D);
    KI.box(MI.matte, ox0 - 0.04, oy, oz0 - 0.04, xi1, oy + 0.1, zi1, WOOD_D);
    wall(ox0, oz0, xi1, oz0 + w, 0, oy);
    // (its west wall: the window onto the bags, the door)
    const wx = ox0 + w;
    const winZ = [71.3, 73.9];
    const doorZ = [75.4, 76.4];
    KI.box(MI.matte, ox0, Y0, oz0, wx, oy, winZ[0], OFFICE_W);
    KI.box(MI.matte, ox0, Y0, winZ[0], wx, Y0 + 1.0, winZ[1], OFFICE_W);
    KI.box(MI.matte, ox0, Y0 + 2.3, winZ[0], wx, oy, winZ[1], OFFICE_W);
    KI.box(MI.matte, ox0, Y0, winZ[1], wx, oy, doorZ[0], OFFICE_W);
    KI.box(MI.matte, ox0, Y0 + 2.2, doorZ[0], wx, oy, doorZ[1], OFFICE_W);
    KI.box(MI.matte, ox0, Y0, doorZ[1], wx, oy, zi1, OFFICE_W);
    K.box(M.glass, ox0 + 0.02, Y0 + 1.0, winZ[0], wx - 0.02, Y0 + 2.3, winZ[1], GLASS);
    for (const z of [winZ[0], (winZ[0] + winZ[1]) / 2, winZ[1]]) KI.box(MI.metal, ox0 - 0.02, Y0 + 1.0, z - 0.03, wx + 0.02, Y0 + 2.3, z + 0.03, CHAR);
    KI.box(MI.metal, ox0 - 0.06, Y0 + 0.97, winZ[0], wx + 0.06, Y0 + 1.02, winZ[1], CHAR);
    wall(ox0, oz0, wx, doorZ[0], 0, oy);
    wall(ox0, doorZ[1], wx, zi1, 0, oy);
    wall(ox0, doorZ[0], wx, doorZ[1], Y0 + 2.2, oy);
    // (the door, open in against the wall; OFFICE over it)
    KI.box(MI.paint, wx, Y0, doorZ[1] - 0.04, wx + 0.92, Y0 + 2.15, doorZ[1], WOOD);
    KI.box(MI.metal, wx + 0.75, Y0 + 1.0, doorZ[1] - 0.08, wx + 0.82, Y0 + 1.05, doorZ[1] - 0.04, GOLD);
    wallWord(KI, MI.paint, INK, 'OFFICE', 0.13, ox0, Y0 + 2.4, (doorZ[0] + doorZ[1]) / 2, -1, 0, 0.006);
    // (on the room's side of its north wall, off the page's part: a schedule, the clock, the extinguisher)
    const fz = oz0;
    poster(KI, MI, ox0 + 0.6, Y0 + 1.95, fz, 0, -1, 0.95, 1.3, WHITE, INK, [['CLASSES', 0.11, RED], ['MON 6PM', 0.08], ['WED 6PM', 0.08], ['SAT 10AM', 0.08]]);
    const clock = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 24).rotateX(Math.PI / 2);
    clock.translate(-174.4, Y0 + 2.45, fz - 0.03);
    KI.add(MI.matte, clock, INK);
    const face = new THREE.CylinderGeometry(0.26, 0.26, 0.01, 24).rotateX(Math.PI / 2);
    face.translate(-174.4, Y0 + 2.45, fz - 0.065);
    KI.add(MI.matte, face, WHITE);
    bar(KI, MI.matte, [-174.4, Y0 + 2.45, fz - 0.075], [-174.4, Y0 + 2.62, fz - 0.075], 0.02, 0.01, INK);
    bar(KI, MI.matte, [-174.4, Y0 + 2.45, fz - 0.075], [-174.28, Y0 + 2.4, fz - 0.075], 0.02, 0.01, RED);
    KI.cyl(MI.paint, 0.08, 0.08, Y0 + 0.3, Y0 + 0.85, RED, { axis: 'y', x: -174.1, z: fz - 0.12, segs: 10 });
    poster(KI, MI, -174.6, Y0 + 1.25, fz, 0, -1, 0.85, 1.05, YEL, INK, [['NO', 0.14], ['SPARRING', 0.1], ['W/O COACH', 0.08, RED]]);
    // (inside: the desk, its lamp and papers; the chair; the cabinet; the trophies on their shelf; the photographs)
    KI.box(MI.matte, -178.8, Y0 + 0.74, 75.6, -176.6, Y0 + 0.79, 76.7, WOOD_D);
    KI.box(MI.matte, -178.75, Y0, 75.65, -178.35, Y0 + 0.74, 76.65, WOOD_D);
    KI.box(MI.matte, -177.05, Y0, 75.65, -176.65, Y0 + 0.74, 76.65, WOOD_D);
    wall(-178.8, 75.6, -176.6, 76.7, 0, Y0 + 0.79, 'prop');
    KI.box(MI.glow, -177.3, Y0 + 1.15, 75.9, -177.0, Y0 + 1.18, 76.1, LAMP);
    bar(KI, MI.metal, [-177.15, Y0 + 0.79, 76.4], [-177.15, Y0 + 1.18, 76.0], 0.02, 0.02, STEEL_D);
    KI.box(MI.matte, -178.5, Y0 + 0.79, 75.8, -177.9, Y0 + 0.8, 76.2, WHITE);
    KI.box(MI.paint, -178.2, Y0 + 0.45, 74.8, -177.7, Y0 + 0.5, 75.3, INK);
    KI.box(MI.paint, -178.2, Y0 + 0.5, 74.75, -177.7, Y0 + 1.0, 74.8, INK);
    KI.box(MI.metal, -174.1, Y0, 71.0, -173.35, Y0 + 1.35, 71.7, STEEL);
    wall(-174.1, 71.0, -173.35, 71.7, 0, Y0 + 1.35, 'prop');
    KI.box(MI.matte, xi1 - 0.3, Y0 + 1.6, 72.2, xi1, Y0 + 1.64, 75.0, WOOD_D);
    for (let i = 0; i < 5; i++) {
      const z = 72.5 + i * 0.55;
      KI.box(MI.matte, xi1 - 0.22, Y0 + 1.64, z - 0.08, xi1 - 0.06, Y0 + 1.7, z + 0.08, INK);
      KI.cyl(MI.metal, 0.05, 0.03, Y0 + 1.7, Y0 + 1.9 + (i % 2) * 0.1, GOLD, { axis: 'y', x: xi1 - 0.14, z, segs: 8 });
      KI.sphere(MI.metal, 0.07, xi1 - 0.14, Y0 + 1.96 + (i % 2) * 0.1, z, GOLD, 1, 0.7, 1, 8);
    }
    for (let i = 0; i < 4; i++) {
      const x = -179.4 + i * 1.3;
      KI.box(MI.matte, x - 0.35, Y0 + 1.6, zi1 - 0.03, x + 0.35, Y0 + 2.1, zi1 - 0.012, INK);
      KI.box(MI.matte, x - 0.3, Y0 + 1.65, zi1 - 0.035, x + 0.3, Y0 + 2.05, zi1 - 0.03, i % 2 ? linC(0.8, 0.76, 0.66) : linC(0.6, 0.6, 0.62));
    }
    // (what is kept on its roof: the boxes, a spare bag)
    KI.box(MI.matte, -179.6, oy + 0.1, 71.0, -178.6, oy + 0.6, 71.8, linC(0.72, 0.6, 0.42));
    KI.box(MI.matte, -178.4, oy + 0.1, 71.1, -177.6, oy + 0.45, 71.7, linC(0.72, 0.6, 0.42));
    cylX(KI, MI.paint, 0.2, -176.6, -175.4, oy + 0.3, 71.4, LEATHER[1], 12);
  }
  return movers;
}

// the board's place on the north wall: its middle, its width, its foot and height over the floor
const BOARD = { x: -182.6, w: 3.6, y0: 1.0, h: 1.75 };

// how many corners a Kit's one pen has so far
function vcount(K) {
  let n = 0;
  for (const list of K.parts.values()) for (const it of list) n += it.g.attributes.position.count;
  return n;
}

// the fight-night board's words (a Kit of their own, made again when they change): the ladder from game/boxing.js ladderInfo -
// who is beaten, who is next, your record - or, without it, the night's bill
export function buildBoard(K, Y0, info) {
  const MI = gymMats();
  const B = BOARD;
  const z = GYM.z0 + GYM.T + 0.012 + 0.056;
  const y1 = Y0 + B.y0 + B.h;
  const say = (text, size, x, y, col) => wallWord(K, MI.matte, col, clean(text), size, x, y, z, 0, 1, 0.002);
  say('FIGHT NIGHT', 0.2, B.x, y1 - 0.3, YEL);
  K.box(MI.matte, B.x - 1.5, y1 - 0.36, z, B.x + 1.5, y1 - 0.345, z + 0.002, WHITE);
  if (info && info.ladder && info.ladder.length) {
    const L = info.ladder;
    const step = Math.min(0.22, 1.0 / L.length);
    L.forEach((f, i) => {
      const y = y1 - 0.58 - i * step;
      const next = f.id === info.next && !f.beaten;
      const text = `${i + 1}. ${f.name}`;
      const len = wordLen(clean(text), 0.1);
      const col = f.beaten ? linC(0.62, 0.66, 0.62) : next ? linC(1, 0.45, 0.4) : WHITE;
      say(text, 0.1, B.x - 1.45 + len / 2, y, col);
      if (f.beaten) K.box(MI.matte, B.x - 1.45, y + 0.045, z, B.x - 1.45 + len, y + 0.058, z + 0.003, WHITE);
      if (next) say('<NEXT', 0.1, B.x + 1.15, y, linC(1, 0.45, 0.4));
      else if (f.beaten) say('WON', 0.1, B.x + 1.2, y, YEL);
    });
    const r = info.record || { w: 0, l: 0, d: 0 };
    say(`RECORD ${r.w}-${r.l}-${r.d}`, 0.11, B.x - 0.75, Y0 + B.y0 + 0.12, WHITE);
    if (info.championBeaten) say('CHAMP!', 0.13, B.x + 1.0, Y0 + B.y0 + 0.12, YEL);
  } else {
    say('FRIDAY 8PM', 0.13, B.x, y1 - 0.62, WHITE);
    say('MAIN EVENT', 0.1, B.x, y1 - 0.9, linC(1, 0.45, 0.4));
    say('SIGN UP AT THE DESK', 0.08, B.x, y1 - 1.15, WHITE);
  }
}
// (the boards' letters have no quotes: names keep their nickname in single ones)
const clean = (s) => String(s).replace(/"/g, "'");

// ------------------------------------------------------------------ the gym in the game
// (game/places.js: clear() a frame, build() the next; then update() each frame, target() / interact() for the prompt and E, roomAt()
// for game/game.js player.indoor - the camera kept under its ceiling)
const COACH = () => tr('המאמן אנג׳לו', 'Coach Angelo');
// (its people come when you are this near, and go when you are this far)
const LIFE_NEAR = 55;
const LIFE_FAR = 80;
const _m4 = new THREE.Matrix4();
const _eu = new THREE.Euler();

export class Gym {
  constructor(places) {
    this.places = places;
    this.game = places.game;
    this.site = null;
    this.built = false;
    this.Y0 = 0;
    this.movers = [];
    this.people = [];
    this.coach = null;
    this.coachLook = null;
    this.coachOut = false;
    this.board = null;
    this.boardKey = null;
    this.boardT = 0;
    this.info = null;
    this.lights = [];
    this.watch = new THREE.Vector3();
    this.hookSide = 1;
  }

  // ---- a frame: the lot cleared
  clear() {
    if (!this.site) this.site = clearSite(this.game);
  }

  // ---- the next: the gym put up on it
  build() {
    const g = this.game;
    const P = this.places;
    const w = g.world;
    const G = GYM;
    const R = G.ring;
    const M = itemMats();
    const cx = (G.x0 + G.x1) / 2;
    const cz = (G.z0 + G.z1) / 2;
    const Y0 = (this.Y0 = groundHeight(cx, cz));
    this.cx = cx;
    this.cz = cz;
    const col = w.collision;
    const wall = (x0, z0, x1, z1, y0, y1, tag = 'wall') => P.cols.push(col.addBox(x0, z0, x1, z1, y0, y1, tag));
    const K = new Kit();
    const KI = new Kit();
    const KM = new Kit();
    const KN = new Kit();
    this.movers = buildGym(K, KI, KM, M, Y0, wall, KN);
    const far = (name, d) => {
      const e = P.list.find((q) => q.name === name);
      if (e) e.far = d;
    };
    P.add('gym', K, 0.61, cx, cz);
    far('gym', 320);
    P.add('gym-in', KI, 0.67, cx, cz);
    far('gym-in', 80);
    const gm = P.add('gym-move', KM, 0.73, cx, cz);
    far('gym-move', 55);
    // (the windows lit from inside after dark: shown by the gym itself, at night and near enough)
    const gn = (this.night = KN.build({ seed: 0.83 }));
    gn.name = 'place-gym-night';
    for (const m of gn.children) {
      m.frustumCulled = true;
      m.userData.noShadow = true;
    }
    gn.visible = false;
    g.scene.add(gn);
    // (what swings: its corners as they hang still, to swing from)
    this.moveMesh = gm.children[0] || null;
    if (this.moveMesh) {
      const geo = this.moveMesh.geometry;
      this.rest = geo.attributes.position.array.slice();
      this.restN = geo.attributes.normal.array.slice();
    }
    for (const m of this.movers) Object.assign(m, { ax: 0, az: 0, vx: 0, vz: 0, L: Math.max(0.15, m.py - m.y), live: false });
    // (on the map, and the minimap's picture of the city drawn before it was)
    const fp = { x0: G.x0, z0: G.z0, x1: G.x1, z1: G.z1, top: Y0 + G.h + 0.3, color: new THREE.Color(0.66, 0.29, 0.21), trim: new THREE.Color(0.93, 0.88, 0.76), awning: new THREE.Color(0.84, 0.1, 0.1), nx: -1, nz: 0 };
    if (w.footprints) w.footprints.push(fp);
    this.fp = fp;
    const hud = g.hud;
    if (hud && hud.mapCanvas && hud.mapOrigin) {
      const c2 = hud.mapCanvas.getContext('2d');
      const px = hud.mapPx || 1;
      const [ox, oz] = hud.mapOrigin;
      c2.setTransform(px, 0, 0, px, 0, 0);
      c2.fillStyle = '#c9c4d6';
      c2.strokeStyle = '#1b1430';
      c2.lineWidth = 1;
      c2.fillRect(LOT.x0 + ox, LOT.z0 + oz, LOT.x1 - LOT.x0, LOT.z1 - LOT.z0);
      c2.strokeRect(G.x0 + ox + 0.5, G.z0 + oz + 0.5, G.x1 - G.x0 - 1, G.z1 - G.z0 - 1);
      c2.setTransform(1, 0, 0, 1, 0, 0);
    }
    // (indoors for the weather, as a mall's hall is: game/weather.js)
    const xi0 = G.x0 + G.T;
    const xi1 = G.x1 - G.T;
    const zi0 = G.z0 + G.T;
    const zi1 = G.z1 - G.T;
    this.area = { x0: xi0, x1: xi1, z0: zi0, z1: zi1, y: Y0, top: G.h };
    if (w.indoorAreas) w.indoorAreas.push(this.area);
    // (the room, for game/game.js player.indoor: the camera nearer, and under the trusses)
    this.room = {
      kind: 'gym',
      floor: Y0,
      height: G.room,
      center: { x: cx, z: cz },
      inside: (x, z, pad = 0, y = null) => x > xi0 - pad && x < xi1 + pad && z > zi0 - pad && z < zi1 + pad && (y === null || (y > Y0 - 1.2 && y < Y0 + G.h - 0.4)),
    };
    // the lights: over the ring, by the door, over the bags; the neon over the door, the lamps over the sign (two, its width)
    const L = (x, y, z, r, c, i) => {
      const id = addLight(x, y, z, r, c, i);
      P.lights.push(id);
      this.lights.push(id);
    };
    L(R.x, Y0 + 5.0, R.z, 10, [1.0, 0.92, 0.78], 1.6);
    L(-184.5, Y0 + 5.6, 44.6, 9, [1.0, 0.95, 0.86], 1.0);
    L(-186.0, Y0 + 5.6, 70.0, 10, [0.95, 0.97, 1.0], 1.1);
    L(G.x0 - 1.4, Y0 + 3.4, 44.4, 8, [1.0, 0.35, 0.35], 1.0);
    L(-186.6, Y0 + 6.3, G.z0 - 1.0, 8, [1.0, 0.88, 0.66], 1.5);
    L(-177.6, Y0 + 6.3, G.z0 - 1.0, 8, [1.0, 0.88, 0.66], 1.5);
    if (w.nav && w.nav.queueRefresh) w.nav.queueRefresh(LOT.x0 - 3, LOT.z0 - 3, LOT.x1 + 3, LOT.z1 + 3);
    // the find's spot: the office's wall, its bare middle
    const B = G.board;
    P.spots.ironfists = { x: B.x, y: Y0 + B.y, z: G.office.z0 - 0.012, nx: 0, ny: 0, nz: -1, ux: 0, uy: 1, uz: 0, w: 3.0 };
    this.refreshBoard(true);
    this.built = true;
  }

  // the ring as game/boxing.js takes it: its middle, its canvas's height, its half, its turn, the ceiling over it
  ring() {
    const R = GYM.ring;
    return { x: R.x, z: R.z, y: this.Y0 + R.h, half: R.half, yaw: 0, ceil: this.Y0 + R.ceil };
  }

  // ---- the fight-night board, made again when the ladder has moved
  refreshBoard(force) {
    const B = this.game.boxing;
    let info = null;
    if (B && B.ladderInfo) {
      try {
        info = B.ladderInfo();
      } catch (e) {
        info = null;
      }
    }
    this.info = info;
    const key = info ? JSON.stringify([info.next, info.record, info.championBeaten, (info.ladder || []).map((f) => (f.beaten ? 1 : 0))]) : '-';
    if (!force && key === this.boardKey) return;
    this.boardKey = key;
    const P = this.places;
    if (this.board) {
      this.game.scene.remove(this.board);
      const k = P.list.findIndex((q) => q.group === this.board);
      if (k >= 0) P.list.splice(k, 1);
      this.board.traverse((m) => {
        if (m.isMesh) m.geometry.dispose();
      });
      this.board = null;
    }
    const KB = new Kit();
    buildBoard(KB, this.Y0, info);
    this.board = P.add('gym-board', KB, 0.79, BOARD.x, GYM.z0);
    const e = P.list.find((q) => q.group === this.board);
    if (e) e.far = 45;
  }

  // ---- each frame
  update(dt) {
    if (!this.built) return;
    try {
      this.frame(dt);
    } catch (e) {
      // (said once: the gym stands still, the game goes on)
      if (!this.err) console.error('[gym]', (this.err = e));
    }
  }

  frame(dt) {
    this.swing(dt);
    const g = this.game;
    const c = g.camera.position;
    if (this.night) this.night.visible = !!g.daynight && g.daynight.night > 0.3 && Math.abs(c.x - this.cx) < 260 && Math.abs(c.z - this.cz) < 260;
    const near = Math.abs(c.x - this.cx) < 90 && Math.abs(c.z - this.cz) < 90;
    this.boardT -= dt;
    if (this.boardT <= 0) {
      this.boardT = 1.5;
      if (near) this.refreshBoard(false);
    }
    this.life(dt);
    this.lightFigs(near);
  }

  // the bags swinging on their chains (each a pendulum: its angles towards +x and +z), their corners moved while they do
  swing(dt) {
    const mesh = this.moveMesh;
    if (!mesh) return;
    let moved = false;
    const h = Math.min(0.05, dt) / 3;
    for (const m of this.movers) {
      if (!m.live) continue;
      const k = 9.81 / m.L;
      const damp = m.kind === 'speed' ? 2.6 : 0.85;
      for (let s = 0; s < 3; s++) {
        m.vx += (-k * Math.sin(m.ax) - damp * m.vx) * h;
        m.vz += (-k * Math.sin(m.az) - damp * m.vz) * h;
        m.ax += m.vx * h;
        m.az += m.vz * h;
        // (the speed bag off the board over it: back it comes, quick)
        if (m.kind === 'speed') {
          const a = Math.hypot(m.ax, m.az);
          if (a > 1.3) {
            const nx = m.ax / a;
            const nz = m.az / a;
            m.ax = nx * 1.3;
            m.az = nz * 1.3;
            const vn = m.vx * nx + m.vz * nz;
            if (vn > 0) {
              m.vx -= 1.6 * vn * nx;
              m.vz -= 1.6 * vn * nz;
            }
          }
        }
      }
      if (Math.abs(m.ax) + Math.abs(m.az) + Math.abs(m.vx) * 0.3 + Math.abs(m.vz) * 0.3 < 0.003) {
        m.ax = m.az = m.vx = m.vz = 0;
        m.live = false;
      }
      this.pose(m);
      moved = true;
    }
    if (moved) {
      mesh.geometry.attributes.position.needsUpdate = true;
      mesh.geometry.attributes.normal.needsUpdate = true;
    }
  }

  pose(m) {
    const geo = this.moveMesh.geometry;
    const pos = geo.attributes.position.array;
    const nor = geo.attributes.normal.array;
    const R0 = this.rest;
    const N0 = this.restN;
    if (!m.live) {
      pos.set(R0.subarray(m.n0 * 3, m.n1 * 3), m.n0 * 3);
      nor.set(N0.subarray(m.n0 * 3, m.n1 * 3), m.n0 * 3);
      return;
    }
    // (towards +x: turned about z; towards +z: about x the other way)
    _m4.makeRotationFromEuler(_eu.set(-m.az, 0, m.ax, 'XYZ'));
    const e = _m4.elements;
    for (let i = m.n0; i < m.n1; i++) {
      const o = i * 3;
      const x = R0[o] - m.px;
      const y = R0[o + 1] - m.py;
      const z = R0[o + 2] - m.pz;
      pos[o] = m.px + e[0] * x + e[4] * y + e[8] * z;
      pos[o + 1] = m.py + e[1] * x + e[5] * y + e[9] * z;
      pos[o + 2] = m.pz + e[2] * x + e[6] * y + e[10] * z;
      const a = N0[o];
      const b = N0[o + 1];
      const c = N0[o + 2];
      nor[o] = e[0] * a + e[4] * b + e[8] * c;
      nor[o + 1] = e[1] * a + e[5] * b + e[9] * c;
      nor[o + 2] = e[2] * a + e[6] * b + e[10] * c;
    }
  }

  // a punch landed on a bag (game/boxing.js onHit): pushed away from you - a hook across - harder the harder it was
  hit(m, move, power) {
    const p = this.game.player.pos;
    let dx = m.x - p.x;
    let dz = m.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    const mv = String(move || '');
    const hook = mv.includes('hook');
    const up = mv.includes('upper');
    const side = hook ? (this.hookSide = -this.hookSide) : 0;
    const pw = Math.max(0, +power || 0);
    const kick = m.kind === 'speed' ? 4.2 + Math.min(2.5, pw * 0.08) : Math.min(0.95, 0.12 + pw * 0.0065);
    const f = up ? 0.45 : hook ? 0.55 : 1;
    m.vx += (dx * f - dz * side * 0.7) * kick;
    m.vz += (dz * f + dx * side * 0.7) * kick;
    m.live = true;
  }

  // ---- what E does here, and what it says: the ring (the next on the ladder), the coach's mitts, a heavy bag, the speed bag
  target() {
    if (!this.built) return null;
    const g = this.game;
    const B = g.boxing;
    const pl = g.player;
    if (!B || B.active || !pl || pl.mode !== 'foot' || pl.inVehicle) return null;
    const p = pl.pos;
    if (!this.room.inside(p.x, p.z, 0.1, p.y)) return null;
    const G = GYM;
    const R = G.ring;
    let best = null;
    let bd = Infinity;
    const take = (d, t) => {
      if (d < bd) {
        bd = d;
        best = t;
      }
    };
    if (B.startLadderBout || B.startBout) {
      const ox = Math.max(0, Math.abs(p.x - R.x) - R.apron);
      const oz = Math.max(0, Math.abs(p.z - R.z) - R.apron);
      let d = Math.hypot(ox, oz);
      // (or at the foot of its steps, coming up them)
      if (p.x > R.x - R.half - 0.9 && p.x < R.x - R.half + 1.5 && p.z > R.z - R.apron - 2.4 && p.z < R.z - R.apron) d = Math.min(d, 0.2);
      if (d < 1.0) {
        const name = this.info && this.info.nextName ? clean(this.info.nextName) : null;
        take(d + 0.3, { kind: 'ring', label: name ? tr(`E — קרב: ${name}`, `E — fight: ${name}`) : tr('E — להילחם', 'E — fight') });
      }
    }
    if (B.startTraining) {
      const m = G.mitts;
      const dm = Math.hypot(p.x - m.x, p.z - (m.z - 0.49));
      if (dm < 1.1) take(dm, { kind: 'mitts', label: tr('E — להתאמן עם המאמן', 'E — train with the coach') });
      for (const mv of this.movers) {
        const sz = mv.z - (mv.kind === 'speed' ? 0.52 : 0.82);
        const d = Math.hypot(p.x - mv.x, p.z - sz);
        if (d < 0.9) take(d, { kind: mv.kind === 'speed' ? 'speed' : 'heavy', mover: mv, label: mv.kind === 'speed' ? tr('E — שק המהירות', 'E — work the speed bag') : tr('E — להכות בשק', 'E — hit the heavy bag') });
      }
    }
    return best;
  }

  interact() {
    const t = this.target();
    if (!t) return false;
    const B = this.game.boxing;
    const y = this.Y0 + 0.02;
    try {
      if (t.kind === 'ring') {
        const o = { onEnd: () => (this.boardT = 0) };
        if (B.startLadderBout) B.startLadderBout(this.ring(), o);
        else B.startBout({ ...o, ring: this.ring() });
      } else if (t.kind === 'mitts') {
        const m = GYM.mitts;
        const ok = B.startTraining('mitts', { at: { x: m.x, z: m.z - 0.49, y, yaw: 0 }, coach: { name: COACH(), look: this.coachLook }, onEnd: () => this.coachBack() });
        if (ok) this.coachAway();
      } else {
        const mv = t.mover;
        const speed = t.kind === 'speed';
        B.startTraining(speed ? 'speedbag' : 'heavybag', {
          at: { x: mv.x, z: mv.z - (speed ? 0.52 : 0.82), y, yaw: 0 },
          bag: { x: mv.x, z: mv.z, y: mv.y },
          onHit: (move, power) => this.hit(mv, move, power),
        });
      }
    } catch (e) {
      console.error('[gym]', e);
    }
    return true;
  }

  // ---- the people: the coach on his mark, a few on the bleachers watching the ring, the one at the desk
  life() {
    const g = this.game;
    const p = g.player.pos;
    const d = Math.hypot(p.x - this.cx, p.z - this.cz);
    if (!this.peopleOn && d < LIFE_NEAR) this.spawnPeople();
    else if (this.peopleOn && d > LIFE_FAR) this.despawnPeople();
    if (!this.peopleOn) return;
    // (what the bleachers watch: the fight while there is one, else the ring; on their feet while a man is down)
    const B = g.boxing;
    const R = GYM.ring;
    const bout = B && B.active && B.mode === 'bout' && B.camFocus;
    if (bout) this.watch.set(B.camFocus.x, this.Y0 + R.h + 1.3, B.camFocus.z);
    else this.watch.set(R.x, this.Y0 + R.h + 1.0, R.z);
    const up = !!(bout && B.bout && B.bout.phase === 'count');
    for (const c of this.people) {
      if (!c.seatedAt || !c.fig) continue;
      c.fig.armsUp = up ? Math.min(1, (c.fig.armsUp || 0) + 0.1) : Math.max(0, (c.fig.armsUp || 0) - 0.05);
    }
  }

  spawnPeople() {
    const g = this.game;
    const C = g.civilians;
    this.peopleOn = true;
    if (!C || !C.spawnScripted) return;
    const look = (o) => {
      try {
        return cityLook(o);
      } catch (e) {
        return null;
      }
    };
    if (!this.coachLook) this.coachLook = look({ fem: false, kind: 'street', old: true });
    const m = GYM.mitts;
    const B = g.boxing;
    if (!(B && B.active && B.mode === 'mitts')) this.coach = this.stand(m.x, m.z + 0.49, Math.PI, this.coachLook);
    else this.coachOut = true;
    // (on the bleachers: on the first tier and the second, facing the ring)
    const S = GYM.stands;
    const d = (GYM.x1 - GYM.T - S.x0) / 3;
    for (const [k, z] of [[0, 51.4], [1, 54.6], [0, 58.2]]) {
      const x = S.x0 + k * d + 0.38;
      const c = this.sit(x, z, -Math.PI / 2, 0.42 * (k + 1), look({}));
      if (c) c.fig.lookAt = this.watch;
    }
    this.stand(-188.9, 40.82, 0, look({ fem: true }));
  }

  stand(x, z, yaw, lookOf) {
    const C = this.game.civilians;
    let c = null;
    try {
      c = C.spawnScripted(x, z, lookOf || undefined, this);
    } catch (e) {
      return null;
    }
    c.noCollide = true;
    c.brave = true;
    c.baseY = this.Y0 + 0.02 - groundHeight(x, z);
    c.yaw = yaw;
    c.faceYaw = yaw;
    c.ctrl = (civ) => {
      civ.pos.x = x;
      civ.pos.z = z;
      civ.faceYaw = yaw;
      return null;
    };
    this.people.push(c);
    return c;
  }

  sit(x, z, yaw, seat, lookOf) {
    const c = this.stand(x, z, yaw, lookOf);
    if (!c) return null;
    c.seatedAt = seat;
    c.baseY = this.Y0 + seat - 0.45 - groundHeight(x, z);
    c.fig.sit = 1;
    c.ctrl = (civ, dt) => {
      civ.pos.x = x;
      civ.pos.z = z;
      civ.faceYaw = yaw;
      civ.fig.sit = Math.min(1, civ.fig.sit + (dt || 0.03) * 3);
      return null;
    };
    return c;
  }

  despawnPeople() {
    const C = this.game.civilians;
    this.peopleOn = false;
    for (const c of this.people) if (C && C.list.includes(c)) C.remove(c);
    this.people = [];
    this.coach = null;
  }

  // the coach off his mark while the drill's own holds the mitts (game/boxing.js brings one), and back on it after
  coachAway() {
    const C = this.game.civilians;
    const c = this.coach;
    this.coachOut = true;
    if (!c) return;
    if (C && C.list.includes(c)) C.remove(c);
    const k = this.people.indexOf(c);
    if (k >= 0) this.people.splice(k, 1);
    this.coach = null;
  }

  coachBack() {
    this.coachOut = false;
    if (!this.peopleOn || this.coach) return;
    const m = GYM.mitts;
    this.coach = this.stand(m.x, m.z + 0.49, Math.PI, this.coachLook);
  }

  // the people in here lit by its lamps, as the room is (render/people.js fig.indoor); out of it, the street's light again
  // (you, every frame - out of it by any way, a respawn too; the people round it, while the camera is near)
  lightFigs(near) {
    const g = this.game;
    const R = this.room;
    const one = (f, pos) => {
      if (!f || !pos) return;
      const inside = R.inside(pos.x, pos.z, 0, pos.y);
      if (inside && !f.indoor) f.indoor = 'gym';
      else if (!inside && f.indoor === 'gym') f.indoor = null;
    };
    one(g.player.fig, g.player.pos);
    const C = g.civilians;
    if (!C || !near) return;
    for (const c of C.list) {
      const p = c.pos;
      if (Math.abs(p.x - this.cx) > 14 || Math.abs(p.z - this.cz) > 24) {
        if (c.fig && c.fig.indoor === 'gym') c.fig.indoor = null;
        continue;
      }
      one(c.fig, p);
    }
  }

  // the room at (x, z), feet at y: the gym's, or null (game/game.js player.indoor)
  roomAt(x, z, y = null) {
    return this.built && this.room.inside(x, z, -0.05, y) ? this.room : null;
  }

  dispose() {
    const g = this.game;
    const w = g.world;
    this.despawnPeople();
    if (g.player && g.player.fig && g.player.fig.indoor === 'gym') g.player.fig.indoor = null;
    if (this.area && w.indoorAreas) {
      const k = w.indoorAreas.indexOf(this.area);
      if (k >= 0) w.indoorAreas.splice(k, 1);
    }
    if (this.fp && w.footprints) {
      const k = w.footprints.indexOf(this.fp);
      if (k >= 0) w.footprints.splice(k, 1);
    }
    const LL = lightList();
    for (const id of this.lights) if (LL[id]) LL[id].on = false;
    this.lights = [];
    if (this.night) {
      g.scene.remove(this.night);
      this.night.traverse((m) => {
        if (m.isMesh) m.geometry.dispose();
      });
      this.night = null;
    }
    restoreSite(g, this.site);
    this.site = null;
    this.board = null;
    this.moveMesh = null;
    this.built = false;
  }
}
