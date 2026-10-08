import * as THREE from 'three';
import { MeshBuilder } from '../render/MeshBuilder.js';
import { StrokeList, BLACK_INK } from '../render/LineBatch.js';
import { SpriteBatch } from '../render/SpriteBatch.js';
import { BAR_ZONE } from './layout.js';
import { COL } from './buildings.js';

// The Inkwell: a small, busy bar drawn in warm coloured pencil. Brick walls, a long
// counter with a back bar full of bottles, stools, a few round tables, a checkered dance
// floor by the jukebox, string lights and neon. Built once, out of sight past the river.

const W = 8; // half width (x)
const D = 6; // half depth (z); the street door is on the +z wall
const H = 4.2;
const FLOOR = BAR_ZONE.floor;
const BRICK = [0.62, 0.38, 0.32];
const WOOD = [0.55, 0.38, 0.24];
const DARKWOOD = [0.36, 0.24, 0.16];
const BRASS = [0.86, 0.68, 0.32];
const BOTTLES = [[0.35, 0.6, 0.35], [0.62, 0.36, 0.2], [0.85, 0.75, 0.4], [0.4, 0.5, 0.75], [0.75, 0.3, 0.35], [0.9, 0.9, 0.85]];

export function buildBar(scene, mats, signAtlas, collision) {
  const ox = BAR_ZONE.cx;
  const oz = BAR_ZONE.cz;
  const mb = new MeshBuilder();
  const sl = new StrokeList();
  const P = (x, y, z) => [ox + x, FLOOR + y, oz + z];
  const L = (w = 1.7, color = BLACK_INK) => ({ width: w, overshoot: 0.03, wobble: 0.012, color });
  const box = (x0, y0, z0, x1, y1, z1, color, o = {}) => {
    mb.box(P(x0, y0, z0), P(x1, y1, z1), { color, bottom: o.bottom, skipTop: o.skipTop, seed: o.seed || x0 * 3 + z0 });
    if (o.lines !== false) sl.boxEdges(P(x0, y0, z0), P(x1, y1, z1), { width: o.lw || 1.6, overshoot: 0.03, wobble: 0.01, noBottom: true });
    if (o.collide) collision.addBox(ox + x0, oz + z0, ox + x1, oz + z1, FLOOR + y0, FLOOR + y1, o.tag || 'wall');
  };
  const quad = (a, b, c, d, n, color, style = 0) => mb.quad(P(...a), P(...b), P(...c), P(...d), n, color, [[0, 0], [1, 0], [1, 1], [0, 1]], [style, 3, 3, a[0] + a[2]]);

  // ---- room shell (seen from inside)
  quad([-W, 0, D], [W, 0, D], [W, 0, -D], [-W, 0, -D], [0, 1, 0], WOOD);
  for (let x = -W + 0.6; x < W; x += 0.6) sl.seg(P(x, 0.005, -D), P(x, 0.005, D), L(1, [0.3, 0.2, 0.14]));
  quad([-W, H, -D], [W, H, -D], [W, H, D], [-W, H, D], [0, -1, 0], [0.3, 0.24, 0.22]);
  for (let x = -W + 2; x < W; x += 3) box(x - 0.15, H - 0.3, -D, x + 0.15, H, D, DARKWOOD, { lw: 1.2 });
  // walls: brick above, wood panelling below
  const wall = (a, b, n) => {
    // a, b: [x, z] ends; wall faces n
    quad([a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], H, b[1]], [a[0], H, a[1]], n, BRICK);
    quad([a[0] + n[0] * 0.02, 0, a[1] + n[2] * 0.02], [b[0] + n[0] * 0.02, 0, b[1] + n[2] * 0.02], [b[0] + n[0] * 0.02, 1.1, b[1] + n[2] * 0.02], [a[0] + n[0] * 0.02, 1.1, a[1] + n[2] * 0.02], n, WOOD);
    sl.seg(P(a[0] + n[0] * 0.03, 1.1, a[1] + n[2] * 0.03), P(b[0] + n[0] * 0.03, 1.1, b[1] + n[2] * 0.03), L(2.2));
    // a few brick courses, drawn like you'd doodle them: not every brick
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len;
    const uz = (b[1] - a[1]) / len;
    for (let y = 1.4, row = 0; y < H - 0.4; y += 0.28, row++) {
      for (let u = (row % 2) * 0.3; u < len - 0.3; u += 0.6) {
        if (((u * 7.3 + row * 3.1) % 1) > 0.42) continue;
        const x = a[0] + ux * u + n[0] * 0.025;
        const z = a[1] + uz * u + n[2] * 0.025;
        sl.seg(P(x, y, z), P(x + ux * 0.5, y, z + uz * 0.5), L(0.9, [0.38, 0.2, 0.17]));
        sl.seg(P(x, y, z), P(x, y + 0.28, z), L(0.9, [0.38, 0.2, 0.17]));
      }
    }
  };
  wall([-W, -D], [W, -D], [0, 0, 1]); // back (north)
  wall([W, D], [-W, D], [0, 0, -1]); // street side (south)
  wall([W, -D], [W, D], [-1, 0, 0]); // east
  wall([-W, D], [-W, -D], [1, 0, 0]); // west
  for (const [x0, z0, x1, z1] of [[-W - 0.4, -D - 0.4, W + 0.4, -D], [-W - 0.4, D, W + 0.4, D + 0.4], [W, -D, W + 0.4, D], [-W - 0.4, -D, -W, D]]) {
    collision.addBox(ox + x0, oz + z0, ox + x1, oz + z1, FLOOR - 1, FLOOR + H + 1, 'wall');
  }

  // ---- street windows and the door (south wall)
  for (const wx of [-1.5, 2.5]) {
    quad([wx + 1.4, 1.2, D - 0.03], [wx - 1.4, 1.2, D - 0.03], [wx - 1.4, 3.1, D - 0.03], [wx + 1.4, 3.1, D - 0.03], [0, 0, -1], [0.16, 0.2, 0.36]);
    sl.poly([P(wx - 1.4, 1.2, D - 0.04), P(wx + 1.4, 1.2, D - 0.04), P(wx + 1.4, 3.1, D - 0.04), P(wx - 1.4, 3.1, D - 0.04)], true, L(2.4));
    sl.seg(P(wx, 1.2, D - 0.04), P(wx, 3.1, D - 0.04), L(1.6));
    // street lights outside, blurred by the glass
    sl.seg(P(wx - 0.9, 2.2, D - 0.05), P(wx - 0.7, 2.25, D - 0.05), { width: 6, overshoot: 0, color: [0.98, 0.82, 0.45], alpha: 0.8 });
    sl.seg(P(wx + 0.5, 2.6, D - 0.05), P(wx + 0.62, 2.6, D - 0.05), { width: 5, overshoot: 0, color: [0.95, 0.45, 0.55], alpha: 0.7 });
  }
  const doorX = -5.6;
  quad([doorX + 0.7, 0, D - 0.03], [doorX - 0.7, 0, D - 0.03], [doorX - 0.7, 2.5, D - 0.03], [doorX + 0.7, 2.5, D - 0.03], [0, 0, -1], DARKWOOD);
  sl.poly([P(doorX - 0.7, 0, D - 0.04), P(doorX + 0.7, 0, D - 0.04), P(doorX + 0.7, 2.5, D - 0.04), P(doorX - 0.7, 2.5, D - 0.04)], true, L(2.4));
  sl.seg(P(doorX, 0, D - 0.04), P(doorX, 2.5, D - 0.04), L(1.6));
  sl.seg(P(doorX + 0.45, 1.1, D - 0.06), P(doorX + 0.55, 1.1, D - 0.06), { width: 5, overshoot: 0, color: BRASS });

  // ---- the bar counter (north) and the back bar
  const cz0 = -4.6;
  const cz1 = -3.75;
  const cx0 = -6.4;
  const cx1 = 4.2;
  box(cx0, 0, cz0, cx1, 1.02, cz1, DARKWOOD, { collide: true, tag: 'counter', lw: 2 });
  box(cx0 - 0.08, 1.02, cz0 - 0.05, cx1 + 0.08, 1.12, cz1 + 0.1, WOOD, { lw: 1.8 });
  for (let x = cx0 + 0.6; x < cx1; x += 1.2) sl.seg(P(x, 0.1, cz1 + 0.01), P(x, 0.95, cz1 + 0.01), L(1.2, [0.2, 0.13, 0.08]));
  sl.seg(P(cx0, 0.22, cz1 + 0.25), P(cx1, 0.22, cz1 + 0.25), { width: 4, overshoot: 0.02, color: BRASS });
  // back bar: cabinet, shelves, mirror and lots of bottles
  box(-6.6, 0, -D + 0.02, 4.4, 0.95, -D + 0.6, WOOD, { collide: true, tag: 'counter' });
  quad([-6.2, 1.25, -D + 0.04], [4.0, 1.25, -D + 0.04], [4.0, 2.7, -D + 0.04], [-6.2, 2.7, -D + 0.04], [0, 0, 1], [0.62, 0.7, 0.78]);
  sl.seg(P(-5.5, 2.4, -D + 0.05), P(-4.9, 1.6, -D + 0.05), L(1.1, [0.9, 0.95, 1]));
  sl.seg(P(1.2, 2.5, -D + 0.05), P(1.7, 1.8, -D + 0.05), L(1.1, [0.9, 0.95, 1]));
  for (const sy of [1.3, 1.95, 2.6]) {
    box(-6.4, sy - 0.05, -D + 0.02, 4.2, sy, -D + 0.42, DARKWOOD, { lw: 1.3 });
    for (let x = -6.2; x < 4.0; x += 0.24 + ((x * 13.7) % 0.12)) {
      const c = BOTTLES[Math.floor(Math.abs(x * 31 + sy * 7)) % BOTTLES.length];
      const bh = 0.32 + ((x * 7.9 + sy) % 0.18);
      mb.cylinder(ox + x, FLOOR + sy, oz - D + 0.22, 0.055, bh, 6, c, { cap: true });
      sl.seg(P(x - 0.055, sy, -D + 0.28), P(x - 0.055, sy + bh, -D + 0.28), L(1));
      sl.seg(P(x + 0.055, sy, -D + 0.28), P(x + 0.055, sy + bh, -D + 0.28), L(1));
      sl.seg(P(x, sy + bh, -D + 0.24), P(x, sy + bh + 0.12, -D + 0.24), L(2.2, [0.25, 0.2, 0.18]));
      if (((x * 17.3) % 1) > 0.5) sl.seg(P(x - 0.04, sy + bh * 0.45, -D + 0.29), P(x + 0.04, sy + bh * 0.45, -D + 0.29), { width: 3, overshoot: 0, color: [0.96, 0.94, 0.86] });
    }
  }
  // beer taps on the counter
  for (let i = 0; i < 4; i++) {
    const x = -1.8 + i * 0.35;
    sl.seg(P(x, 1.12, -4.3), P(x, 1.55, -4.3), { width: 4, overshoot: 0, color: BRASS });
    sl.seg(P(x, 1.55, -4.3), P(x, 1.75, -4.25), { width: 6, overshoot: 0, color: BOTTLES[i] });
  }

  // ---- stools along the counter
  const stools = [];
  for (let x = -5.6; x <= 3.4; x += 1.15) {
    stools.push({ x: ox + x, z: oz - 3.15, yaw: Math.PI });
    mb.cylinder(ox + x, FLOOR + 0.72, oz - 3.15, 0.24, 0.08, 8, [0.72, 0.18, 0.2]);
    sl.ring(ox + x, FLOOR + 0.8, oz - 3.15, 0.24, 8, L(1.4));
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) sl.seg(P(x + sx * 0.16, 0, -3.15 + sz * 0.16), P(x + sx * 0.06, 0.72, -3.15 + sz * 0.06), L(1.4, [0.3, 0.3, 0.34]));
    sl.ring(ox + x, FLOOR + 0.3, oz - 3.15, 0.13, 6, L(1.2, BRASS));
  }

  // ---- tables with chairs
  const tables = [];
  for (const [tx, tz] of [[-5.2, 1.6], [-1.4, 3.2], [2.0, 1.2]]) {
    mb.cylinder(ox + tx, FLOOR + 0.74, oz + tz, 0.62, 0.06, 12, WOOD);
    sl.ring(ox + tx, FLOOR + 0.8, oz + tz, 0.62, 12, L(1.8));
    sl.seg(P(tx, 0, tz), P(tx, 0.74, tz), L(3.4, [0.25, 0.2, 0.18]));
    sl.seg(P(tx - 0.35, 0.02, tz), P(tx + 0.35, 0.02, tz), L(2.4, [0.25, 0.2, 0.18]));
    collision.addCircle(ox + tx, oz + tz, 0.6, FLOOR, FLOOR + 0.8, 'prop');
    // a candle in a jar
    sl.seg(P(tx, 0.8, tz), P(tx, 0.92, tz), { width: 5, overshoot: 0, color: [0.9, 0.88, 0.8] });
    sl.seg(P(tx, 0.94, tz), P(tx, 1.0, tz), { width: 4, overshoot: 0, color: [1, 0.75, 0.3] });
    const seats = [];
    for (const a of [0.3, 2.4, 4.4]) {
      const sx = tx + Math.cos(a) * 1.05;
      const sz = tz + Math.sin(a) * 1.05;
      const yaw = Math.atan2(tx - sx, tz - sz);
      seats.push({ x: ox + sx, z: oz + sz, yaw });
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      box(sx - 0.24, 0.42, sz - 0.24, sx + 0.24, 0.48, sz + 0.24, DARKWOOD, { lw: 1.2 });
      // backrest behind the sitter
      const bx = sx - fx * 0.24;
      const bz = sz - fz * 0.24;
      sl.seg(P(bx - fz * 0.22, 0.48, bz + fx * 0.22), P(bx - fz * 0.22, 1.0, bz + fx * 0.22), L(1.6));
      sl.seg(P(bx + fz * 0.22, 0.48, bz - fx * 0.22), P(bx + fz * 0.22, 1.0, bz - fx * 0.22), L(1.6));
      sl.seg(P(bx - fz * 0.22, 1.0, bz + fx * 0.22), P(bx + fz * 0.22, 1.0, bz - fx * 0.22), L(2));
      for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]]) sl.seg(P(sx + lx, 0, sz + lz), P(sx + lx, 0.42, sz + lz), L(1.2));
    }
    tables.push({ x: ox + tx, z: oz + tz, seats });
  }

  // ---- dance floor and jukebox (east)
  const df = { x0: 3.6, x1: 7.6, z0: -2.2, z1: 4.4 };
  for (let i = 0, x = df.x0; x < df.x1 - 0.01; x += 0.8, i++) {
    for (let j = 0, z = df.z0; z < df.z1 - 0.01; z += 0.8, j++) {
      const c = (i + j) % 2 ? [0.94, 0.92, 0.86] : [0.2, 0.2, 0.26];
      quad([x, 0.012, z + 0.8], [x + 0.8, 0.012, z + 0.8], [x + 0.8, 0.012, z], [x, 0.012, z], [0, 1, 0], c);
    }
  }
  sl.poly([P(df.x0, 0.02, df.z0), P(df.x1, 0.02, df.z0), P(df.x1, 0.02, df.z1), P(df.x0, 0.02, df.z1)], true, L(2.2));
  const jx = 7.35;
  const jz = -3.6;
  box(jx - 0.45, 0, jz - 0.5, jx + 0.2, 1.5, jz + 0.5, [0.75, 0.25, 0.3], { collide: true, tag: 'prop', lw: 2 });
  for (let k = 0; k < 3; k++) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (i / 8);
      pts.push(P(jx - 0.47, 0.9 + Math.sin(a) * (0.45 - k * 0.12), jz + Math.cos(a) * (0.45 - k * 0.12)));
    }
    sl.poly(pts, false, { width: 4, overshoot: 0, color: [[1, 0.8, 0.3], [0.4, 0.85, 1], [1, 0.45, 0.7]][k] });
  }
  // disco ball over the floor
  const dbx = (df.x0 + df.x1) / 2;
  const dbz = (df.z0 + df.z1) / 2;
  sl.seg(P(dbx, H, dbz), P(dbx, H - 0.7, dbz), L(1.2));
  mb.cylinder(ox + dbx, FLOOR + H - 1.05, oz + dbz, 0.22, 0.36, 8, [0.85, 0.87, 0.92]);
  sl.ring(ox + dbx, FLOOR + H - 0.87, oz + dbz, 0.23, 8, L(1.6));

  // ---- string lights along the ceiling
  for (const z of [-2.2, 1.0, 4.0]) {
    let prev = P(-W + 0.3, H - 0.35, z);
    for (let i = 1; i <= 24; i++) {
      const x = -W + 0.3 + (i / 24) * (2 * W - 0.6);
      const sag = Math.sin((i / 24) * Math.PI * 6) * 0.08;
      const p = P(x, H - 0.45 + sag, z);
      sl.seg(prev, p, L(0.9, [0.2, 0.18, 0.18]));
      sl.seg(p, [p[0], p[1] - 0.06, p[2]], { width: 7, overshoot: 0, color: i % 3 === 0 ? [1, 0.55, 0.5] : [1, 0.84, 0.45], alpha: 0.95 });
      prev = p;
    }
  }

  // ---- finish
  const group = new THREE.Group();
  group.name = 'inkwell';
  const mat = mats.barSurface || mats.surface;
  group.add(new THREE.Mesh(mb.build(), mat));
  const lines = sl.toBatch(mats.line);
  group.add(lines.mesh);
  // signs: neon over the west wall, the chalk menu above the bottles, a gig poster, the exit
  const signs = new SpriteBatch(8, signAtlas.texture, { polygonOffset: true });
  const add = (rect, x, y, z, w, h, axis) => signs.add({ x: ox + x, y: FLOOR + y, z: oz + z, w, h, rect: signAtlas.rects[rect], axis, pivot: [0.5, 0.5] });
  add('bar_neon', -W + 0.06, 2.6, -0.5, 4.2, 2.1, [0, 0, -1]);
  add('bar_menu', -1.2, 3.35, -D + 0.06, 2.4, 1.2, [1, 0, 0]);
  add('bar_poster', W - 0.06, 2.4, 1.6, 2.0, 1.0, [0, 0, 1]);
  add('exit', doorX, 2.85, D - 0.06, 1.0, 0.25, [-1, 0, 0]);
  signs.commit();
  group.add(signs.mesh);
  group.visible = false;
  scene.add(group);
  return {
    group,
    origin: new THREE.Vector3(ox, FLOOR, oz),
    spawn: { x: ox + doorX, z: oz + D - 1.4, yaw: Math.PI },
    door: { x: ox + doorX, z: oz + D - 0.6 },
    stools,
    tables,
    counter: { x0: ox + cx0 + 0.4, x1: ox + cx1 - 0.4, z: oz - 3.0, behind: oz - 5.05 },
    dance: { x: ox + (df.x0 + df.x1) / 2, z: oz + (df.z0 + df.z1) / 2, x0: ox + df.x0, x1: ox + df.x1, z0: oz + df.z0, z1: oz + df.z1 },
    jukebox: { x: ox + jx - 0.8, z: oz + jz },
    disco: new THREE.Vector3(ox + dbx, FLOOR + H - 0.87, oz + dbz),
  };
}

export { COL };
