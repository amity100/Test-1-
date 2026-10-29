import * as THREE from 'three';
import { Kit, itemMats, linC } from './items.js';
import { Band, makeSong } from '../core/music.js';
import { civilianLook } from './looks.js';
import { letter } from '../world/letters.js';
import { canvas } from '../world/kit.js';
import { flashLight, makeSurface, canvasTexture } from '../render/materials.js';
import { mBlockRect, CURB } from '../world/mainland/plan.js';
import { YARD_W } from '../world/mainland/blocks.js';
import { paintMural, MURAL_COUNT } from '../world/murals.js';
import { DrawOff, DOODLES, SUBJECTS } from './minigames/drawoff.js';
import { worldAt } from '../ui/minigame.js';
import { fairPlan, buildFair, paintFloor, paintProjection, paintLive } from './artfair.js';

// (v5, ROADMAP 12.5) Paintwood's Walls, and Art Night in them. In the yard between the backs of the
// rows of the walls' block (world/mainland/blocks.js), ten walls stand with a mural each - built
// when you are near, every day. On Art Night (game/calendar.js) the yard fills: a stage at its
// south end with the Draw-Off (game/minigames/drawoff.js: the judges are the network that knows
// drawings) and its screen, painters at their easels painting as you watch (a painting a few
// minutes, then the next), a café and a stall of prints, the lights strung over it all, jazz,
// people at the walls and in front of the stage. What you buy (a print, a painting off the easel)
// is kept for your home (ROADMAP 12.13).

const BR = mBlockRect(1, 2);
const X0 = (BR.x0 + BR.x1) / 2 - YARD_W / 2;
const X1 = X0 + YARD_W;
const Z0 = BR.z0;
const Z1 = BR.z1;
const CX = (X0 + X1) / 2;
const CZ = (Z0 + Z1) / 2;
const GY = CURB + 0.012;
const NEAR = 170;
const WALL_H = 5;
const WALL_L = 13;
// the stage at the south end, facing up the yard (north, -z)
const ST = { x0: CX - 7, x1: CX + 7, z0: Z1 - 14, z1: Z1 - 6, h: 0.9 };
const STYLES = ['jazz', 'lofi'];
const BULB = [linC(1, 0.85, 0.45), linC(1, 0.45, 0.6), linC(0.45, 0.9, 1), linC(0.6, 1, 0.5)];
const COLLECTION = 'scribble-city-v5-art';
const PAINT_PAL = [['#fff3d6', '#ff3f8e', '#2f6fe4', '#ffb347'], ['#e9f7ff', '#24a35a', '#8a5cf0', '#ff5a36'], ['#fff0f5', '#2bc4c4', '#ef476f', '#ffd166'], ['#f4f1e8', '#3a0ca3', '#f72585', '#06d6a0']];

// the walls: five down each side of the yard, a gap between them to walk through
export const WALLS = [];
for (const side of [-1, 1]) {
  for (let k = 0; k < 5; k++) {
    const z0 = Z0 + 5 + k * 17;
    const x = side < 0 ? X0 + 1.2 : X1 - 1.2;
    WALLS.push({ side, x, z0, z1: z0 + WALL_L, mural: (k * 2 + (side > 0 ? 1 : 0)) % MURAL_COUNT });
  }
}
export const ARTNIGHT_AT = { x: CX, z: CZ };

export class ArtNight {
  constructor(game) {
    this.game = game;
    this.set = null;
    this.extra = null;
    this.crowd = [];
    this.cols = [];
    this.extraCols = [];
    this.t = 0;
    this.beat = 0;
    this.cheer = 0;
    this.nightKey = -1;
    this.mine = [];
    this.champion = false;
  }

  get on() {
    const C = this.game.calendar;
    return !!C && C.active('artnight');
  }

  // ------------------------------------------------------------------ the walls (every day)
  build() {
    const g = this.game;
    const M = itemMats();
    const K = new Kit();
    const DARK = linC(0.1, 0.09, 0.12);
    const STEEL = linC(0.7, 0.72, 0.76);
    const col = g.world.collision;
    this.cols = [];
    for (const w of WALLS) {
      const x0 = w.x - 0.2;
      const x1 = w.x + 0.2;
      K.box(M.matte, x0, GY, w.z0, x1, GY + WALL_H, w.z1, linC(0.2, 0.19, 0.24));
      K.box(M.matte, x0 - 0.06, GY + WALL_H, w.z0 - 0.06, x1 + 0.06, GY + WALL_H + 0.14, w.z1 + 0.06, DARK);
      this.cols.push(col.addBox(x0, w.z0, x1, w.z1, -1, WALL_H, 'wall'));
    }
    // the arches over the ends of the yard, the name in light on each, facing the street
    for (const [z, out] of [[Z0 + 1.2, -1], [Z1 - 0.8, 1]]) {
      for (const x of [X0 + 2, X1 - 2]) K.box(M.metal, x - 0.18, GY, z - 0.18, x + 0.18, GY + 6.6, z + 0.18, STEEL);
      K.box(M.matte, X0 + 1.7, GY + 5.6, z - 0.25, X1 - 1.7, GY + 6.9, z + 0.25, DARK);
      // (read from the street: left to right is -x seen from the north, +x from the south)
      letter('PAINTWOOD WALLS', 0.95, (a0, b0, a1, b1) => {
        const xa = out < 0 ? CX - a1 : CX + a0;
        const xb = out < 0 ? CX - a0 : CX + a1;
        K.box(M.glow, xa, GY + 5.78 + b0, z + out * 0.26, xb, GY + 5.78 + b1, z + out * 0.32, BULB[0]);
      });
    }
    // the lights strung across the yard, from wall top to wall top (the wires: drawn, draw())
    this.wires = [];
    for (let k = 0; k < 6; k++) {
      const za = Z0 + 8 + k * 16;
      const zb = za + 8;
      const a = [X0 + 1.2, GY + WALL_H + 0.25, k % 2 ? zb : za];
      const b = [X1 - 1.2, GY + WALL_H + 0.25, k % 2 ? za : zb];
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 1.3, a[2] + (b[2] - a[2]) * t]);
      }
      this.wires.push(pts);
      for (let i = 1; i < 14; i += 1) K.sphere(M.glow, 0.11, pts[i][0], pts[i][1] - 0.12, pts[i][2], BULB[(i + k) % BULB.length], 1, 1.3, 1, 8);
    }
    const group = K.build({ seed: 0.43 });
    // the murals: a painting on the face of each wall towards the yard
    const touch = g.touch;
    this.muralTex = [];
    this.muralMats = [];
    for (const w of WALLS) {
      const tex = paintMural(w.mural, touch ? 512 : 1024, touch ? 200 : 400);
      const mat = makeSurface({ kind: 'uv', map: tex, uvScale: WALL_L, ang: 1.3, wash: 0.8, emissive: new THREE.Color(0.16, 0.16, 0.16), emMap: tex });
      const geo = new THREE.PlaneGeometry(WALL_L - 0.3, WALL_H - 0.35);
      geo.rotateY(w.side < 0 ? Math.PI / 2 : -Math.PI / 2);
      geo.translate(w.x - w.side * 0.215, GY + WALL_H / 2 + 0.05, (w.z0 + w.z1) / 2);
      const m = new THREE.Mesh(geo, mat);
      group.add(m);
      this.muralTex.push(tex);
      this.muralMats.push(mat);
    }
    group.updateMatrix();
    g.scene.add(group);
    this.set = group;
  }

  teardown() {
    const g = this.game;
    this.teardownNight();
    if (this.set) {
      g.scene.remove(this.set);
      this.set.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
      });
    }
    for (const t of this.muralTex || []) t.dispose();
    for (const m of this.muralMats || []) m.dispose();
    this.muralTex = [];
    this.muralMats = [];
    for (const id of this.cols) g.world.collision.remove(id);
    this.cols = [];
    this.set = null;
  }

  // ------------------------------------------------------------------ Art Night (its nights)
  buildNight() {
    const g = this.game;
    const M = itemMats();
    const K = new Kit();
    const DARK = linC(0.08, 0.07, 0.1);
    const WOOD = linC(0.42, 0.28, 0.18);
    const STEEL = linC(0.7, 0.72, 0.76);
    const col = g.world.collision;
    const S = ST;
    this.extraCols = [];
    // the stage: its deck, the line of light along its front, the steps, the backdrop with the name
    K.box(M.matte, S.x0, GY, S.z0, S.x1, GY + S.h, S.z1, WOOD);
    K.box(M.glow, S.x0, GY + S.h - 0.12, S.z0 - 0.04, S.x1, GY + S.h - 0.04, S.z0 + 0.02, BULB[1]);
    for (let k = 0; k < 3; k++) K.box(M.matte, CX - 1.4, GY, S.z0 - 1.2 + k * 0.4, CX + 1.4, GY + (k + 1) * 0.3, S.z0 - 0.8 + k * 0.4, WOOD);
    K.box(M.matte, S.x0, GY + S.h, S.z1 - 0.3, S.x1, GY + S.h + 5.4, S.z1, DARK);
    letter('DRAW-OFF', 0.9, (a0, b0, a1, b1) => K.box(M.glow, CX - a1, GY + S.h + 4.25 + b0, S.z1 - 0.36, CX - a0, GY + S.h + 4.25 + b1, S.z1 - 0.3, BULB[0]));
    // the lamps on their poles at the stage's corners
    this.lamps = [];
    for (const x of [S.x0 + 0.3, S.x1 - 0.3]) {
      K.box(M.metal, x - 0.08, GY + S.h, S.z0 + 0.3, x + 0.08, GY + S.h + 4.4, S.z0 + 0.46, STEEL);
      K.sphere(M.glow, 0.22, x, GY + S.h + 4.4, S.z0 + 0.2, BULB[0]);
      this.lamps.push([x, GY + S.h + 4.4, S.z0 + 0.2]);
    }
    // three easels on the stage for the contest's artists
    for (const dx of [-5.6, -4.1, 5.4]) easel(K, M, CX + dx, GY + S.h, S.z1 - 2.2, 0, -1, false);
    // the café and the prints, either side of the stage
    this.stalls = [];
    const stall = (x0, x1, name, kind, colr) => {
      const z0 = S.z0 + 0.5;
      const z1 = S.z1 - 0.5;
      K.box(M.paint, x0, GY, z0 + 1.2, x1, GY + 1.05, z0 + 1.9, colr);
      K.box(M.matte, x0, GY + 1.05, z0 + 1.2, x1, GY + 1.12, z0 + 1.95, WOOD);
      for (const x of [x0 + 0.1, x1 - 0.1]) K.box(M.metal, x - 0.05, GY, z0 + 0.6, x + 0.05, GY + 2.8, z0 + 0.7, STEEL);
      K.box(M.paint, x0 - 0.2, GY + 2.8, z0 + 0.3, x1 + 0.2, GY + 2.95, z1, colr);
      // its name, facing up the yard (north)
      letter(name, 0.36, (a0, b0, a1, b1) => {
        const cx = (x0 + x1) / 2;
        K.box(M.glow, cx - a1, GY + 2.3 + b0, z0 + 0.54, cx - a0, GY + 2.3 + b1, z0 + 0.6, BULB[kind === 'cafe' ? 0 : 2]);
      });
      K.box(M.matte, x0 + 0.1, GY + 2.15, z0 + 0.6, x1 - 0.1, GY + 2.85, z0 + 0.66, DARK);
      this.stalls.push({ x: (x0 + x1) / 2, z: z0 - 0.4, kind, name });
      this.extraCols.push(col.addBox(x0, z0 + 1.2, x1, z1, -1, 2.9, 'prop'));
    };
    stall(X0 + 2.2, S.x0 - 1.2, 'CAFE CUBANO', 'cafe', linC(0.95, 0.5, 0.25));
    stall(S.x1 + 1.2, X1 - 2.2, 'PRINTS', 'prints', linC(0.3, 0.4, 0.85));
    this.extraCols.push(col.addBox(S.x0, S.z0, S.x1, S.z1, -1, GY + S.h, 'wall'));
    // the fair: the pavilions, the sculptures, the installations, the bar (game/artfair.js)
    const Y = { X0, X1, Z0, Z1, CX, GY, touch: g.touch };
    this.fair = buildFair(K, M, Y, col);
    this.extraCols.push(...this.fair.cols);
    // the painters' easels at the plaza's east side, facing across it
    this.easels = [];
    this.fair.plan.easels.forEach(([x, z], i) => {
      easel(K, M, x, GY, z, -1, 0, true);
      this.extraCols.push(col.addBox(x - 0.5, z - 0.6, x + 0.5, z + 0.6, -1, 2, 'prop'));
      this.easels.push({ x, z, face: -1, i, t: Math.random() * 60, k: 0, painted: -1 });
    });
    const group = K.build({ seed: 0.71 });
    for (const m of this.fair.meshes) group.add(m);
    // the paintings on the easels, painted as you watch (a canvas each, its texture redrawn)
    for (const e of this.easels) {
      e.c = canvas(256, 192);
      e.tex = canvasTexture(e.c, { mips: false });
      e.mat = makeSurface({ kind: 'uv', map: e.tex, uvScale: 1.2, ang: 0.8, wash: 0.9, emissive: new THREE.Color(0.22, 0.22, 0.22), emMap: e.tex });
      const geo = new THREE.PlaneGeometry(1.2, 0.9);
      geo.rotateY(e.face > 0 ? Math.PI / 2 : -Math.PI / 2);
      geo.translate(e.x + e.face * 0.09, GY + 1.55, e.z);
      group.add(new THREE.Mesh(geo, e.mat));
      this.newPainting(e);
      // (the night has been going a while when you come: the paintings part done)
      e.k = 0.2 + Math.random() * 0.65;
    }
    // the screen over the stage: the contest, and your drawings when you have some
    this.screenC = canvas(512, 256);
    this.screenTex = canvasTexture(this.screenC, { mips: false });
    this.screenMat = makeSurface({ kind: 'uv', map: this.screenTex, uvScale: 6, ang: 0.4, wash: 0.95, emissive: new THREE.Color(0.85, 0.85, 0.85), emMap: this.screenTex });
    const sg = new THREE.PlaneGeometry(6.4, 3.2);
    sg.rotateY(Math.PI);
    sg.translate(CX, GY + S.h + 2.2, S.z1 - 0.34);
    group.add(new THREE.Mesh(sg, this.screenMat));
    this.paintScreen();
    group.updateMatrix();
    g.scene.add(group);
    this.extra = group;
    this.makeCrowd();
  }

  teardownNight() {
    const g = this.game;
    if (this.extra) {
      g.scene.remove(this.extra);
      this.extra.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
      });
    }
    for (const e of this.easels || []) {
      e.tex.dispose();
      e.mat.dispose();
    }
    if (this.screenTex) this.screenTex.dispose();
    if (this.screenMat) this.screenMat.dispose();
    const F = this.fair;
    if (F) for (const x of [F.photoTex, F.photoMat, F.artTex, F.artMat, F.proj.tex, F.proj.mat, F.live.tex, F.live.mat]) x.dispose();
    this.fair = null;
    this.screenTex = null;
    this.screenMat = null;
    this.easels = [];
    for (const id of this.extraCols) g.world.collision.remove(id);
    this.extraCols = [];
    this.extra = null;
    this.crowd = [];
    this.stopMusic();
  }

  // the people, where a fair's people are: at the walls, before the works in the White Cube and the
  // neon in the black box, round the balloon dog, posing on the carpet and the photographers before
  // them, at the bar and the high tables, sitting in the lounge, on the floor of light, before the
  // stage, strolling the yard's two lanes; and the fair's own - the painters, the bartenders, the
  // DJ, the gallerist, the guards at the arch, the MC and the artists on the stage
  makeCrowd() {
    const g = this.game;
    const P = this.fair.plan;
    const N = g.touch ? 0.42 : 1;
    const list = [];
    const R = Math.random;
    const person = (x, z, yaw, o = {}) => {
      const look = civilianLook();
      list.push({ x, z, y: o.y || GY, y0: o.y || GY, look, scale: look.build.height, yaw, speed: 0, phase: R() * 6, seed: R() * 100, cheer: 0, sit: 0, hop: R(), ...o });
    };
    const facing = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
    const n = (k) => Math.max(1, Math.round(k * N));
    // at the walls (not where the easels and the scaffold are)
    for (let i = 0; i < n(26); i++) {
      const w = WALLS[Math.floor(R() * WALLS.length)];
      const z = w.z0 + 1 + R() * (WALL_L - 2);
      if (P.keepOff.some((k) => k.side === w.side && z > k.z0 && z < k.z1)) continue;
      const x = w.x - w.side * (2.2 + R() * 2.5);
      person(x, z, w.side < 0 ? -Math.PI / 2 + (R() - 0.5) * 0.5 : Math.PI / 2 + (R() - 0.5) * 0.5, { at: 'look' });
    }
    // in the White Cube, before the works
    const works = this.fair.works;
    for (let i = 0; i < n(16); i++) {
      const wk = works[Math.floor(R() * works.length)];
      const d = 1.3 + R() * 0.9;
      const x = wk.x + wk.nx * d + wk.nz * (R() - 0.5) * 1.6;
      const z = wk.z + wk.nz * d - wk.nx * (R() - 0.5) * 1.6;
      if (list.some((q) => Math.hypot(q.x - x, q.z - z) < 0.6)) continue;
      person(x, z, facing(x, z, wk.x, wk.z), { at: 'look' });
    }
    // in the black box, before the neon
    const B = P.pavB;
    for (let i = 0; i < n(8); i++) {
      const north = i % 2 === 0;
      const x = CX + (R() - 0.5) * 9;
      const z = north ? B.z0 + 1.6 + R() * 1.2 : B.z1 - 1.6 - R() * 1.2;
      person(x, z, north ? Math.PI : 0, { at: 'look' });
    }
    // round the sculptures, some taking pictures of them
    for (const [sx, sz, r, k] of [[P.dog.x, P.dog.z, 3.4, 9], [P.ink.x, P.ink.z, 2.6, 3], [P.nib.x, P.nib.z, 2.2, 3]]) {
      for (let i = 0; i < n(k); i++) {
        const a = R() * Math.PI * 2;
        const x = sx + Math.cos(a) * r;
        const z = sz + Math.sin(a) * r;
        if (x > P.easels[0][0] - 1.2 || list.some((q) => Math.hypot(q.x - x, q.z - z) < 0.6)) continue;
        person(x, z, facing(x, z, sx, sz), { at: R() < 0.35 ? 'photo' : 'look' });
      }
    }
    // the carpet: two posing at the wall of logos, the photographers before them
    for (const dz of [-0.6, 0.6]) person(P.photoWall.x + 0.9, (P.photoWall.z0 + P.photoWall.z1) / 2 + dz, Math.PI / 2, { at: 'pose' });
    this.photographers = [];
    for (const [x, z] of P.photographers) {
      person(x, z, -Math.PI / 2, { at: 'photo' });
      this.photographers.push([x, z]);
    }
    // the bar: its bartenders, people at it
    const BR = P.bar;
    for (const z of [BR.z0 + 1.2, BR.z1 - 1.4]) person(BR.x - 0.95, z, Math.PI / 2, { at: 'staff' });
    for (let i = 0; i < n(5); i++) person(BR.x + 0.95 + R() * 0.3, BR.z0 + 0.5 + i * 1.0, -Math.PI / 2, { at: 'look' });
    // the high tables, two or three at each
    for (const [tx, tz] of P.tables) {
      const k = 2 + Math.floor(R() * 2);
      for (let i = 0; i < k; i++) {
        if (N < 1 && i > 1) break;
        const a = (i / k) * Math.PI * 2 + R();
        const x = tx + Math.cos(a) * 0.75;
        const z = tz + Math.sin(a) * 0.75;
        person(x, z, facing(x, z, tx, tz), { at: 'chat' });
      }
    }
    // the lounge, sitting
    for (const { x, z } of P.lounge) {
      for (const [dx, dz] of [[-0.8, -1.2], [0.2, -1.2], [1.2, -0.3], [1.2, 0.6]]) {
        if (N < 1 && dx > 1) continue;
        person(x + dx, z + dz, facing(x + dx, z + dz, x - 0.1, z), { at: 'sit', sit: 1 });
      }
    }
    // on the floor of light
    const F = P.floor;
    for (let i = 0; i < n(5); i++) person(F.x0 + 0.8 + R() * (F.x1 - F.x0 - 1.6), F.z0 + 0.8 + R() * (F.z1 - F.z0 - 1.6), R() * Math.PI * 2, { at: 'floor' });
    // before the stage
    for (let i = 0; i < n(18); i++) {
      const x = CX + (R() - 0.5) * 12;
      const z = ST.z0 - 2.5 - R() * 6;
      if (list.some((q) => Math.hypot(q.x - x, q.z - z) < 0.7)) continue;
      person(x, z, facing(x, z, CX, ST.z1), { at: 'stage', feel: 0.5 + R() * 0.5 });
    }
    // strolling the lanes beside the pavilions
    for (let i = 0; i < n(14); i++) {
      const west = R() < 0.5;
      const z = Z0 + 4 + R() * 58;
      const dir = R() < 0.5 ? 1 : -1;
      person(west ? CX - 8.4 : CX + 7.6, z, dir > 0 ? 0 : Math.PI, { at: 'walk', dir, v: 0.9 + R() * 0.5, pause: 0, zMin: Z0 + 3, zMax: Z0 + 63 });
    }
    // the fair's own
    for (const e of this.easels) {
      const px = e.x + e.face * 0.9;
      const pz = e.z + 0.95;
      person(px, pz, Math.atan2(e.x - px, e.z - pz), { at: 'painter', easel: e });
    }
    person(P.dj.x - 0.9, P.dj.z, Math.PI / 2, { at: 'dj' });
    person(CX + 4.3, P.pavA.z0 + 2.1, Math.PI, { at: 'staff' });
    person((P.info.x0 + P.info.x1) / 2, P.info.z1 - 0.4, Math.PI, { at: 'staff' });
    for (const x of [CX - 3.2, CX + 3.2]) person(x, Z0 + 2.4, Math.PI, { at: 'staff' });
    person(P.scaffold.x - 1.3, (P.scaffold.z0 + P.scaffold.z1) / 2, Math.PI / 2, { y: GY + 2.46, y0: GY + 2.46, at: 'sprayer' });
    person(CX + 2.2, ST.z0 + 1.2, Math.PI, { y: GY + ST.h, at: 'mc' });
    for (const dx of [-5.6, -4.1, 5.4]) person(CX + dx + 0.5, ST.z1 - 2.9, Math.PI - 0.4, { y: GY + ST.h, at: 'artist' });
    this.crowd = list;
  }

  // ------------------------------------------------------------------ a painting on an easel
  newPainting(e) {
    const s = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
    let seed = (Math.random() * 1e9) | 0;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    e.subject = s;
    e.strokes = DOODLES[s.c](rng);
    e.pal = PAINT_PAL[Math.floor(Math.random() * PAINT_PAL.length)];
    e.k = 0;
    e.len = 150 + Math.random() * 90;
    e.done = 0;
    e.painted = -1;
  }

  paintEasel(e) {
    const g = e.c.getContext('2d');
    const W = 256;
    const H = 192;
    const P = e.pal;
    g.fillStyle = P[0];
    g.fillRect(0, 0, W, H);
    // the background washed in first, then the lines, colour over ink, as far as it has got
    const f = Math.min(1, e.k);
    g.globalAlpha = Math.min(1, f * 3) * 0.55;
    g.fillStyle = P[3];
    g.beginPath();
    g.arc(W * 0.7, H * 0.35, 70, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    const n = e.strokes.reduce((a, s) => a + s.length, 0);
    let left = Math.floor(n * Math.max(0, (f - 0.15) / 0.75));
    const k = 1.6;
    const ox = W / 2 - 50 * k;
    const oy = H / 2 - 50 * k * 0.95;
    let si = 0;
    for (const s of e.strokes) {
      if (left <= 0) break;
      const pts = left >= s.length ? s : s.slice(0, left);
      left -= s.length;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      pts.forEach(([x, y], j) => (j ? g.lineTo(ox + x * k, oy + y * k * 0.95) : g.moveTo(ox + x * k, oy + y * k * 0.95)));
      g.strokeStyle = '#16121c';
      g.lineWidth = 7;
      g.stroke();
      g.strokeStyle = P[1 + (si % 3)];
      g.lineWidth = 4;
      g.stroke();
      si++;
    }
    if (f >= 1) {
      g.font = '700 18px "Permanent Marker", sans-serif';
      g.fillStyle = '#16121c';
      g.textAlign = 'right';
      g.fillText(['ZEB', 'LUNA', 'KIRA', 'OTTO'][e.i % 4], W - 10, H - 10);
    }
    e.tex.needsUpdate = true;
  }

  paintScreen() {
    const c = this.screenC;
    if (!c) return;
    const g = c.getContext('2d');
    const W = 512;
    const H = 256;
    g.fillStyle = '#120a14';
    g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 40px "Permanent Marker", sans-serif';
    g.fillStyle = '#ffd23f';
    g.fillText('PAINTWOOD DRAW-OFF', W / 2, 34);
    if (!this.mine.length) {
      g.font = '700 30px "Permanent Marker", sans-serif';
      g.fillStyle = '#ff5fa2';
      g.fillText('3 ROUNDS · 25 SECONDS', W / 2, 104);
      g.fillStyle = '#2fd4e4';
      g.fillText('THE JUDGES: A MACHINE', W / 2, 146);
      g.fillStyle = '#fffdf6';
      g.fillText('WIN $60 · ENTRY $5', W / 2, 196);
    } else {
      // your drawings, the last three, with the judges' word on each
      const list = this.mine.slice(-3);
      const bw = 150;
      for (let i = 0; i < list.length; i++) {
        const d = list[i];
        const x = W / 2 + (i - (list.length - 1) / 2) * (bw + 12) - bw / 2;
        const y = 66;
        g.fillStyle = '#fbf8f0';
        g.fillRect(x, y, bw, 130);
        drawStrokes(g, d.strokes, x + 8, y + 6, bw - 16, 104, '#16121c', 3);
        g.font = '700 18px "Permanent Marker", sans-serif';
        g.fillStyle = d.p >= 0.35 ? '#24a35a' : '#e8333d';
        g.fillText(`${d.c.toUpperCase()} ${Math.round(d.p * 100)}%`, x + bw / 2, y + 118);
      }
      g.font = '700 24px "Permanent Marker", sans-serif';
      g.fillStyle = this.champion ? '#ffd23f' : '#fffdf6';
      g.fillText(this.champion ? 'CHAMPION OF THE NIGHT: YOU!' : 'YOUR DRAWINGS', W / 2, 226);
    }
    this.screenTex.needsUpdate = true;
  }

  // ------------------------------------------------------------------ the music
  startMusic() {
    const a = this.game.audio;
    const c = a && a.ctx;
    if (!c || this.band) return;
    this.mix = c.createGain();
    this.mix.gain.value = 0;
    this.lp = c.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 900;
    this.mix.connect(this.lp).connect(a.musicBus || a.fx);
    this.band = new Band(c, this.mix, a.noise);
    this.songN = 0;
    this.nextSong(c.currentTime + 0.2);
  }

  nextSong(t) {
    const style = STYLES[this.songN % STYLES.length];
    this.song = makeSong(style, 500 + this.songN * 13);
    this.songT0 = t;
    this.songEnd = t + Band.length(this.song, 24);
    this.spb = 60 / this.song.bpm / 4;
    this.band.play(this.song, t, 0);
    this.songN++;
  }

  stopMusic() {
    if (this.band) this.band.stop();
    const c = this.game.audio && this.game.audio.ctx;
    if (this.mix && c) {
      const n = this.mix;
      n.gain.setTargetAtTime(0, c.currentTime, 0.2);
      setTimeout(() => n.disconnect(), 1500);
    }
    this.band = null;
    this.mix = null;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const g = this.game;
    this.t += dt;
    const p = g.player;
    const d = Math.hypot(p.pos.x - CX, p.pos.z - CZ);
    if (!this.set && d < NEAR) this.build();
    if (this.set && d > NEAR + 60) this.teardown();
    if (!this.set) return;
    const on = this.on;
    if (on && !this.extra && d < NEAR) this.buildNight();
    // (over: taken down once you have gone, or a minute and a half on)
    if (this.extra && !on) {
      this.idle = (this.idle || 0) + dt;
      if (d > 90 || this.idle > 90) {
        this.idle = 0;
        this.teardownNight();
      }
    }
    if (!this.extra) return;
    if (on) this.idle = 0;
    const c = g.audio && g.audio.ctx;
    if (on && !this.band) this.startMusic();
    if (this.band && c) {
      const now = c.currentTime;
      if (now > this.songEnd - 0.05) this.nextSong(this.songEnd);
      this.band.update(now);
      // (from the stage: clear in the yard, muffled behind the rows)
      const ds = Math.hypot(p.pos.x - CX, p.pos.z - (ST.z0 + ST.z1) / 2);
      const near = Math.max(0, Math.min(1, 1 - (ds - 10) / 110));
      const inYard = p.pos.x > X0 && p.pos.x < X1 && p.pos.z > Z0 && p.pos.z < Z1;
      this.mix.gain.setTargetAtTime(on ? 0.6 * Math.pow(near, 1.5) : 0, now, 0.3);
      this.lp.frequency.setTargetAtTime(inYard ? 600 + 15000 * Math.pow(near, 2) : 500 + 1500 * near, now, 0.3);
      this.beat = (now - this.songT0) / (this.spb * 4);
    } else this.beat = this.t * 1.6;
    if (this.cheer > 0) this.cheer = Math.max(0, this.cheer - dt * 0.35);
    // the people
    const ph = this.beat - Math.floor(this.beat);
    const bob = Math.pow(1 - ph, 3);
    for (const w of this.crowd) {
      w.phase += dt * (w.at === 'walk' ? 4.2 * w.v : 1.2);
      if (w.at === 'walk') {
        if (w.pause > 0) {
          w.pause -= dt;
          w.speed = 0;
          continue;
        }
        w.z += w.dir * w.v * dt;
        w.speed = 3.2 * w.v;
        if (w.z > (w.zMax || ST.z0 - 6) || w.z < (w.zMin || Z0 + 4)) {
          w.dir = -w.dir;
          w.z = Math.max(w.zMin || Z0 + 4, Math.min(w.zMax || ST.z0 - 6, w.z));
          w.yaw = w.dir > 0 ? 0 : Math.PI;
        } else if (Math.random() < dt * 0.04) {
          // (stops for a look at the wall on its side)
          w.pause = 3 + Math.random() * 5;
          w.speed = 0;
        }
      } else if (w.at === 'stage') {
        w.y = w.y0 + bob * 0.05 * w.feel + (this.cheer > 0.5 ? 0.1 : 0);
        w.cheer = this.cheer > 0.3 ? 1 : 0;
      } else if (w.at === 'mc') {
        w.cheer = this.contest ? 0.7 + 0.3 * bob : 0.25;
      } else if (w.at === 'artist') {
        w.cheer = this.cheer > 0.3 ? 1 : 0;
      } else if (w.at === 'painter' || w.at === 'sprayer') {
        w.cheer = 0.35 + 0.25 * Math.sin(this.t * 3 + w.seed);
      } else if (w.at === 'photo') {
        // (a phone or a camera up now and then)
        w.cheer = Math.sin(this.t * 0.7 + w.seed) > 0.4 ? 0.7 : 0;
      } else if (w.at === 'pose' || w.at === 'floor' || w.at === 'dj') {
        w.y = w.y0 + (w.at === 'pose' ? 0 : bob * 0.06);
        w.cheer = w.at === 'pose' ? 0.25 : Math.floor(this.beat + w.hop * 4) % 4 === 0 ? 0.9 : 0.2;
      } else if (w.at === 'chat') {
        w.cheer = Math.sin(this.t * 1.3 + w.seed * 3) > 0.85 ? 0.45 : 0;
      }
    }
    // the fair's moving parts (only near: the projection a few times a second, the floor of light,
    // the mural painted from the scaffold, the photographers' flashes)
    const F = this.fair;
    const near = d < 75;
    if (F && near) {
      this.projT = (this.projT || 0) - dt;
      if (this.projT <= 0) {
        this.projT = g.touch ? 0.2 : 0.1;
        paintProjection(F.proj, this.t);
      }
      this.floorT = ((this.floorT || 0) + 1) % (g.touch ? 2 : 1);
      if (this.floorT === 0) {
        const feet = [[p.pos.x, p.pos.z]];
        for (const w of this.crowd) if (w.at === 'floor') feet.push([w.x, w.z]);
        paintFloor(F.floor, this.t, feet);
      }
      const L = F.live;
      if (L.hold > 0) {
        L.hold -= dt;
        if (L.hold <= 0) L.k = 0.02;
      } else {
        L.k = Math.min(1, L.k + dt / 360);
        if (L.k >= 1) L.hold = 40;
      }
      const step = Math.floor(L.k * 90);
      if (step !== L.step) {
        L.step = step;
        paintLive(L, L.k);
      }
      // (the spray off the painter's can, at the wall)
      this.sprayT = (this.sprayT || 0) - dt;
      if (this.sprayT <= 0 && g.fx && L.hold <= 0) {
        this.sprayT = 0.5;
        const SF = F.plan.scaffold;
        const z = SF.z0 + 2 + ((this.t * 0.37) % 1) * (SF.z1 - SF.z0 - 4);
        g.fx.burst(SF.x - 0.3, GY + 3.4 + Math.sin(this.t) * 0.6, z, 6, 1.6, [1, 0.35, 0.65], 0.25, 0.35);
      }
      this.flashT = (this.flashT || 0) - dt;
      if (this.flashT <= 0 && this.photographers && this.photographers.length) {
        this.flashT = this.flashBurst > 0 ? 0.12 + Math.random() * 0.15 : 0.6 + Math.random() * 1.6;
        const [x, z] = this.photographers[Math.floor(Math.random() * this.photographers.length)];
        this.flash = { x, z, t: 0.09 };
      }
      if (this.flash) this.flash.t -= dt;
      if (this.flashBurst > 0) this.flashBurst -= dt;
    }
    // the paintings come along (only redrawn when it shows: a few times a second, and near)
    for (const e of this.easels) {
      if (e.done > 0) {
        e.done -= dt;
        if (e.done <= 0) this.newPainting(e);
        continue;
      }
      e.k = Math.min(1, e.k + dt / e.len);
      if (e.k >= 1 && !e.done) e.done = 25;
      const step = Math.floor(e.k * 60);
      const near = Math.hypot(p.pos.x - e.x, p.pos.z - e.z) < 45;
      if (near && step !== e.painted) {
        e.painted = step;
        this.paintEasel(e);
      }
    }
    // arriving: the name, once a night
    const D = g.daynight;
    const key = D ? D.day : 0;
    if (on && d < 45 && this.nightKey !== key) {
      this.nightKey = key;
      g.hud.big('ART NIGHT', 2600);
      g.audio.play('cheer', 0.4);
    }
  }

  // ------------------------------------------------------------------ drawing (game/game.js)
  draw(fr) {
    if (!this.set) return;
    const g = this.game;
    const cam = g.camera.position;
    const dc = Math.hypot(cam.x - CX, cam.z - CZ);
    // the wires the bulbs hang from
    if (dc < 120) {
      for (let k = 0; k < this.wires.length; k++) {
        const pts = this.wires[k];
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          fr.lineXYZ(a[0], a[1], a[2], b[0], b[1], b[2], [0.08, 0.07, 0.1], 2, 7700 + k * 31 + i, 0.9, 0.002, 0);
        }
      }
    }
    if (!this.extra) return;
    const bodies = g.figures.bodies;
    const fwd = g.camera.getWorldDirection(_v);
    const far = g.touch ? 70 : 110;
    for (const w of this.crowd) {
      const dx = w.x - cam.x;
      const dz = w.z - cam.z;
      const dd = Math.hypot(dx, dz);
      if (dd > far || (dd > 4 && (dx * fwd.x + dz * fwd.z) / dd < -0.3)) continue;
      bodies.drawCheap(w);
    }
    // the light at night: on the stage, under the strings
    const night = g.daynight ? g.daynight.night : 1;
    if (night > 0.15 && this.on && dc < 140) {
      for (const [x, y, z] of this.lamps) flashLight(x + (x < CX ? 2.5 : -2.5), GY + ST.h + 1.2, z + 1.2, 9, _warm, 1.1 * night);
      flashLight(CX, GY + WALL_H, Z0 + 62, 22, _bulb, 0.9 * night);
      // (the White Cube's track lights on its works, a warm pool over the bar)
      const F = this.fair;
      if (F) {
        flashLight(CX, GY + 3.2, (F.plan.pavA.z0 + F.plan.pavA.z1) / 2, 10, _white, 1.1 * night);
        flashLight(F.plan.bar.x + 1.5, GY + 3.4, (F.plan.bar.z0 + F.plan.bar.z1) / 2, 9, _warm, 1.0 * night);
        // (the sculptures lit from below, the dog in its pink)
        flashLight(F.plan.dog.x - 1.5, GY + 1.2, F.plan.dog.z - 2.8, 11, _pink, 1.8 * night);
      }
    }
    const F = this.fair;
    if (!F || dc > 110) return;
    // the photographers' flashes
    if (this.flash && this.flash.t > 0) flashLight(this.flash.x - 0.4, GY + 1.8, this.flash.z, 7, _white, 4);
    // the projector's beam, faint, to the corners of its picture
    const pr = F.proj;
    const c = PROJ_C[Math.floor(this.t / 2) % PROJ_C.length];
    for (let i = 0; i < 4; i++) fr.lineXYZ(pr.from[0], pr.from[1], pr.from[2], pr.to[i][0], pr.to[i][1], pr.z, c, 2, 7900 + i, 0.07 * night + 0.02, 0.001, 0);
  }

  // ------------------------------------------------------------------ what you can do there
  target() {
    if (!this.extra || !this.on) return null;
    const p = this.game.player.pos;
    for (const s of this.stalls) if (Math.hypot(p.x - s.x, p.z - s.z) < 2.6) return { kind: s.kind, s, label: s.kind === 'cafe' ? 'E — CAFE CUBANO: קפה ומאפה' : 'E — PRINTS: הדפסים וציורים' };
    if (p.x > ST.x0 && p.x < ST.x1 && p.z > ST.z0 - 6 && p.z < ST.z0 + 0.5) return { kind: 'contest', label: 'E — קרב ציור על הבמה ($5)' };
    const P = this.fair.plan;
    if (p.x > P.bar.x + 0.3 && p.x < P.bar.x + 2.2 && p.z > P.bar.z0 && p.z < P.bar.z1) return { kind: 'bar', label: 'E — CHAMPAGNE: בר הבועות' };
    if (p.x > P.photoWall.x + 0.2 && p.x < P.carpet.x1 && p.z > P.photoWall.z0 && p.z < P.photoWall.z1) return { kind: 'pose', label: 'E — להצטלם מול קיר הלוגואים' };
    if (p.x > P.floor.x0 && p.x < P.floor.x1 && p.z > P.floor.z0 && p.z < P.floor.z1) return { kind: 'floor', label: 'E — לרקוד על רצפת האור' };
    if (Math.hypot(p.x - (P.infinity.x - P.infinity.s / 2 - 0.8), p.z - P.infinity.z) < 1.4) return { kind: 'infinity', label: 'E — להיכנס לחדר האינסוף' };
    for (const e of this.easels) if (Math.hypot(p.x - e.x, p.z - e.z) < 2.2) return { kind: 'easel', e, label: `E — הצייר/ת ליד הכן: ${e.subject.he}` };
    return null;
  }

  interact() {
    const tg = this.target();
    if (!tg) return false;
    const g = this.game;
    if (tg.kind === 'contest') {
      if (!g.minigames) return false;
      if (g.money && !g.money.pay(5, 'Draw-Off')) {
        g.money.refuse('DRAW-OFF', 5);
        return true;
      }
      this.contest = true;
      // (ROADMAP 12.6) on the stage, at the big screen: you draw on it with the pen in your hand,
      // the yard behind you watching, the camera over your shoulder
      const S = ST;
      const world = worldAt({ at: [CX, GY + S.h + 2.2, S.z1 - 0.36], n: [0, -1], w: 6.4, stand: 1.3, side: 3.5, y0: GY + S.h, back: 4.6, up: 2.9, camSide: -1.2, pen: true, exit: [CX + 1.5, S.z0 - 2.2, Math.PI] });
      g.minigames.play(new DrawOff({ venue: 'PAINTWOOD DRAW-OFF', fee: 5 }), (r) => {
        this.contest = false;
        if (r && r.gallery && r.gallery.length) {
          this.mine.push(...r.gallery);
          if (r.won) this.champion = true;
          this.paintScreen();
        }
        if (r && r.won) {
          this.cheer = 1;
          g.hud.big('CHAMPION!', 2400);
          g.hud.toast('ניצחתם בקרב הציור! כל החצר מוחאת כפיים, והציורים שלכם על המסך', 'good', 3.5);
        } else if (r && r.place) g.hud.toast(`מקום ${r.place} בקרב הציור. הציורים שלכם על המסך מעל הבמה`, 'good', 3);
      }, { world });
      return true;
    }
    if (tg.kind === 'bar') {
      const menu = [['קוקטייל בועות ורוד (+15 חיים)', 8, 15, [1, 0.6, 0.75]], ['מים מוגזים עם לימון (+5 חיים)', 2, 5, [0.85, 0.95, 0.8]]];
      g.dialog.show('CHAMPAGNE', 'Bubbles for the artists! What can I pour you?', menu.map(([label, price, hp, colr]) => ({
        label: `${label} · $${price}`,
        fn: () => {
          if (!g.money || g.money.pay(price, label)) {
            const pl = g.player;
            pl.hp = Math.min(pl.maxHp, pl.hp + hp);
            pl.fig.belly = Math.min(1, pl.fig.belly + 0.15);
            pl.fig.bellyColor = colr;
            g.audio.play('coins', 0.5);
            g.hud.toast(`${label.split(' (')[0]}! +${hp} חיים`, 'good', 2);
          } else g.money.refuse('CHAMPAGNE', price);
        },
      })));
      return true;
    }
    if (tg.kind === 'pose') {
      // (the photographers turn to you: a burst of flashes)
      this.flashBurst = 2.2;
      this.flashT = 0;
      g.player.fig.armsUp = 1;
      g.inkwell.after(2.2, () => (g.player.fig.armsUp = 0));
      g.audio.play('click', 0.6);
      g.hud.toast('הצלמים לא מפסיקים! מחר אתם בעמוד האמנות של העיתון', 'good', 3);
      return true;
    }
    if (tg.kind === 'floor') {
      g.player.fig.dance = 1;
      g.inkwell.after(9, () => (g.player.fig.dance = 0));
      g.hud.toast('הרצפה נדלקת מתחת לכל צעד שלכם', 'good', 2.4);
      return true;
    }
    if (tg.kind === 'infinity') {
      const I = this.fair.plan.infinity;
      g.player.spawn(I.x, I.z, Math.PI / 2);
      g.hud.toast('אלפי נקודות אור, בלי סוף לכל כיוון. שקט פה.', 'info', 3);
      return true;
    }
    if (tg.kind === 'easel') {
      const e = tg.e;
      const pct = Math.round(e.k * 100);
      const lines = ['Almost there... what do you see in it?', 'Paintwood paints at night. Always has.', 'This one is for my mother.', 'Every wall here started as a sketch on a napkin.'];
      const opts = [];
      if (e.k >= 0.7) {
        opts.push({
          label: `לקנות את הציור (${e.subject.he}) · $120`,
          fn: () => {
            if (!g.money || g.money.pay(120, 'ציור מהכן')) {
              this.collect({ kind: 'painting', subject: e.subject.c, he: e.subject.he, by: ['ZEB', 'LUNA', 'KIRA', 'OTTO'][e.i % 4], price: 120 });
              g.audio.play('coins', 0.5);
              g.hud.toast(`קניתם את הציור "${e.subject.he}"! הוא נשמר באוסף שלכם ויחכה בבית`, 'good', 3);
              this.newPainting(e);
            } else g.money.refuse('PAINTER', 120);
          },
        });
      }
      g.dialog.show('PAINTER', `${lines[e.i % lines.length]} (${pct}%)`, opts.length ? opts : [{ label: 'לצפות עוד קצת', fn: () => {} }]);
      return true;
    }
    if (tg.kind === 'prints') {
      const menu = [['הדפסה קטנה של ציור קיר', 25, 'print'], ['הדפסה גדולה על קנבס', 90, 'canvas'], ['ציור מקורי של אמן מהחצר', 250, 'original']];
      g.dialog.show('PRINTS', 'Every wall in the yard, on paper. Take one home!', menu.map(([label, price, kind]) => ({
        label: `${label} · $${price}`,
        fn: () => {
          if (!g.money || g.money.pay(price, label)) {
            const m = WALLS[Math.floor(Math.random() * WALLS.length)].mural;
            this.collect({ kind, mural: m, price });
            g.audio.play('coins', 0.5);
            g.hud.toast(`${label}: נשמר באוסף שלכם, ויחכה על הקיר בבית`, 'good', 3);
          } else g.money.refuse('PRINTS', price);
        },
      })));
      return true;
    }
    const menu = [['קפסיטו (קפה קובני)', 3, 10, [0.35, 0.2, 0.12]], ['פסטליטו גויאבה', 4, 15, [0.9, 0.6, 0.3]], ['לימונדה מנגו', 5, 15, [1, 0.75, 0.25]]];
    g.dialog.show('CAFE CUBANO', '¡Oye! Coffee to keep you up all night. What will it be?', menu.map(([label, price, hp, colr]) => ({
      label: `${label} (+${hp} חיים) · $${price}`,
      fn: () => {
        if (!g.money || g.money.pay(price, label)) {
          const pl = g.player;
          pl.hp = Math.min(pl.maxHp, pl.hp + hp);
          pl.fig.belly = Math.min(1, pl.fig.belly + 0.2);
          pl.fig.bellyColor = colr;
          g.audio.play('coins', 0.5);
          g.hud.toast(`${label}! +${hp} חיים`, 'good', 2);
        } else g.money.refuse('CAFE CUBANO', price);
      },
    })));
    return true;
  }

  // what you bought, kept for your home (ROADMAP 12.13)
  collect(item) {
    try {
      const list = JSON.parse(localStorage.getItem(COLLECTION) || '[]') || [];
      list.push({ ...item, at: Date.now() });
      localStorage.setItem(COLLECTION, JSON.stringify(list.slice(-40)));
    } catch (e) {
      // (no room: it is yours for now)
    }
  }
}

// an easel facing (fx, fz) (along x or z): its legs, the ledge, the board (on the yard's, its
// painting: a mesh of its own, in front of it)
function easel(K, M, x, y, z, fx, fz, painted) {
  const W = linC(0.5, 0.34, 0.2);
  const bx = x - fx * 0.05;
  const bz = z - fz * 0.05;
  // (u across the board, v up, d out of its face)
  const B = (u0, v0, d0, u1, v1, d1, c) => {
    if (fx) K.box(M.matte, bx + fx * d0, y + v0, z + u0, bx + fx * d1, y + v1, z + u1, c);
    else K.box(M.matte, x + u0, y + v0, bz + fz * d0, x + u1, y + v1, bz + fz * d1, c);
  };
  for (const u of [-0.45, 0.45]) B(u - 0.04, 0, -0.04, u + 0.04, 2.1, 0.04, W);
  B(-0.04, 0, -0.54, 0.04, 2, -0.46, W);
  B(-0.62, 1.06, -0.12, 0.62, 1.12, 0.12, W);
  B(-0.62, 1.08, -0.03, 0.62, 2.02, 0.03, painted ? linC(0.92, 0.9, 0.86) : linC(0.98, 0.97, 0.94));
}

// a drawing's lines into a box on a canvas, kept in proportion
function drawStrokes(g, strokes, x, y, w, h, color, lw) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of strokes) {
    for (const [px, py] of s) {
      x0 = Math.min(x0, px);
      y0 = Math.min(y0, py);
      x1 = Math.max(x1, px);
      y1 = Math.max(y1, py);
    }
  }
  if (!(x1 > x0) && !(y1 > y0)) return;
  const k = Math.min(w / Math.max(1, x1 - x0), h / Math.max(1, y1 - y0));
  const ox = x + (w - (x1 - x0) * k) / 2;
  const oy = y + (h - (y1 - y0) * k) / 2;
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const s of strokes) {
    g.beginPath();
    s.forEach(([px, py], i) => (i ? g.lineTo(ox + (px - x0) * k, oy + (py - y0) * k) : g.moveTo(ox + (px - x0) * k, oy + (py - y0) * k)));
    g.stroke();
  }
}

const _v = new THREE.Vector3();
const _warm = new THREE.Color(1, 0.85, 0.6);
const _bulb = new THREE.Color(1, 0.8, 0.55);
const _white = new THREE.Color(1, 0.97, 0.92);
const _pink = new THREE.Color(1, 0.62, 0.85);
const PROJ_C = [[1, 0.4, 0.75], [0.4, 0.9, 1], [1, 0.9, 0.4], [0.6, 1, 0.6]];
