import * as THREE from 'three';
import { Kit, itemMats, linC } from './items.js';
import { clubMats, neonWord, chaser, pictureGeo, merged } from './venuekit.js';
import { slotMachine, blackjackTable, rouletteTable, chandelier, column, sofa } from './casinobuild.js';
import { paintCarpet, paintDamask, paintCoffers, paintTowerWindows, paintBottles, paintCurtain, paintSigns } from './casinoart.js';
import { paintArtAtlas } from '../world/murals.js';
import { flashLight, makeSurface, canvasTexture } from '../render/materials.js';
import { CURB, M_BLOCKS } from '../world/mainland/plan.js';
import { CASINO } from '../world/mainland/halls.js';
import { worldAt } from '../ui/minigame.js';
import { patronLook, bartenderLook, bouncerLook } from './looks.js';
import { Band, makeSong } from '../core/music.js';
import { SlotGame, paintSlotIdle } from './minigames/casino/slots.js';
import { Blackjack, paintBlackjackIdle } from './minigames/casino/blackjack.js';
import { Roulette, paintRouletteIdle } from './minigames/casino/roulette.js';
import { sfx } from './minigames/casino/felt.js';

// (v5, ROADMAP 12.8) PALACE OF INK, on the bay: a palace of a casino, the whole block its own. Before
// it, on Bayfront Boulevard, a forecourt of two long pools whose fountains dance at night, a portico
// of eight columns under the name in gold, a golden dome on the roof and the hotel's tower rising
// behind with its windows lit. Inside, under coffered ceilings and chandeliers, on a red carpet
// scrolled with gold: rows of slot machines (INK FORTUNE, each screen its reels turning), the pit of
// blackjack and roulette tables with their dealers, the cage, the bar, the stage with its singer,
// the lounge, and behind a velvet rope the VIP room's high stakes. Every game is played where it is
// - the slot machine on its screen, the cards and the wheel on the felt of the table (ui/minigame.js
// world mode) - with your own money.

const H = CASINO;
const XW = H.xw;
const XE = H.xe;
const Z0 = H.z0;
const Z1 = H.z1;
const CZ = H.cz;
const HT = H.h;
const FY = CURB + 0.012;
const F = FY + 0.015;
const X = (u) => XW + u;
const Z = (v) => Z0 + v;
const DOOR = { z0: CZ - 4, z1: CZ + 4, h: 4.2 };
const BLOCK = M_BLOCKS.find((b) => b.col === H.col && b.row === H.row);
const NEAR_IN = 150;
const VIP_KEY = 'scribble-city-v5-vip';
const T = 0.35;
export const CASINO_AT = { x: XE + 12, z: CZ };

// ------------------------------------------------------------------ where everything stands
export const PLAN = (() => {
  const slots = [];
  for (let u = 4; u <= 30.5; u += 1.05) slots.push({ x: X(u), z: Z(0.75), n: [0, 1] });
  for (const [v, n] of [[8.6, [0, -1]], [9.4, [0, 1]], [17.6, [0, -1]], [18.4, [0, 1]]]) for (let u = 8; u <= 24.5; u += 1.05) slots.push({ x: X(u), z: Z(v), n });
  for (let v = 25; v <= 60; v += 1.05) slots.push({ x: X(0.75), z: Z(v), n: [1, 0] });
  const tables = [];
  for (const [v, n] of [[31, [0, -1]], [47, [0, 1]]]) {
    tables.push({ kind: 'roulette', x: X(7), z: Z(v), n });
    for (const u of [13.5, 19.5, 25.5]) tables.push({ kind: 'blackjack', x: X(u), z: Z(v), n });
  }
  // the VIP room's two, behind the rope
  tables.push({ kind: 'blackjack', x: X(6.5), z: Z(68.5), n: [0, 1], vip: true });
  tables.push({ kind: 'roulette', x: X(6.5), z: Z(74.5), n: [0, -1], vip: true });
  return {
    slots,
    tables,
    cage: { x0: X(28.6), x1: X(35.4), z0: Z(26.4), z1: Z(28.2) },
    bar: { x0: X(14.5), x1: X(23.5), z0: Z(54.5), z1: Z(59.5) },
    stage: { x0: X(26), x1: X(35.6), z0: Z(69.5), z1: Z(77.6), h: 0.9 },
    vip: { x1: X(13), z0: Z(63.5), gate: [Z(68.6), Z(71.4)] },
    lounge: [[X(16), Z(67), [1, 0]], [X(16), Z(72.5), [1, 0]], [X(21), Z(64.5), [0, 1]]],
  };
})();

export class Casino {
  constructor(game) {
    this.game = game;
    this.shell = null;
    this.inside = null;
    this.cols = [];
    this.inCols = [];
    this.crowd = [];
    this.t = 0;
    this.vip = load(VIP_KEY, false);
  }

  // ------------------------------------------------------------------ the palace: its walls, its face, its tower
  buildShell() {
    const g = this.game;
    const M = itemMats();
    const CM = clubMats('casino');
    const K = new Kit();
    const col = g.world.collision;
    const STONE = linC(0.9, 0.85, 0.74);
    const STONE2 = linC(0.82, 0.76, 0.64);
    const GOLD = linC(0.85, 0.62, 0.22);
    const WARM = linC(1, 0.82, 0.5);
    const wall = (x0, z0, x1, z1, y0 = 0, y1 = HT) => {
      K.box(M.matte, x0, FY + y0, z0, x1, FY + y1, z1, STONE);
      if (y0 === 0) this.cols.push(col.addBox(x0, z0, x1, z1, -1, HT + 0.5, 'wall'));
    };
    wall(XW, Z0, XE, Z0 + T);
    wall(XW, Z1 - T, XE, Z1);
    wall(XW, Z0, XW + T, Z1);
    wall(XE - T, Z0, XE, DOOR.z0);
    wall(XE - T, DOOR.z1, XE, Z1);
    wall(XE - T, DOOR.z0, XE, DOOR.z1, DOOR.h, HT);
    // the cornice, the roof, the balustrade round it
    K.box(M.matte, XW - 0.4, FY + HT - 0.5, Z0 - 0.4, XE + 0.4, FY + HT, Z1 + 0.4, STONE2);
    K.box(M.metal, XW - 0.42, FY + HT - 0.62, Z0 - 0.42, XE + 0.42, FY + HT - 0.5, Z1 + 0.42, GOLD);
    K.box(M.matte, XW, FY + HT, Z0, XE, FY + HT + 0.3, Z1, STONE2);
    for (const [x0, z0, x1, z1] of [[XW, Z0, XE, Z0 + 0.3], [XW, Z1 - 0.3, XE, Z1], [XW, Z0, XW + 0.3, Z1], [XE - 0.3, Z0, XE, Z1]]) K.box(M.matte, x0, FY + HT + 0.3, z0, x1, FY + HT + 1.2, z1, STONE);
    this.cols.push(col.addBox(XW, Z0, XE, Z1, HT - 0.1, HT + 0.4, 'roof'));
    // the tall windows down the long sides, lit warm from inside
    for (const [z, nz] of [[Z0 - 0.02, -1], [Z1 + 0.02, 1]]) {
      for (let u = 4; u < 34; u += 4.2) {
        const x = X(u);
        K.box(M.metal, x - 1.0, FY + 1.6, z - (nz < 0 ? 0.06 : 0), x + 1.0, FY + 7.2, z + (nz > 0 ? 0.06 : 0), GOLD);
        K.box(M.glow, x - 0.85, FY + 1.75, z - (nz < 0 ? 0.08 : -0.01), x + 0.85, FY + 7.0, z + (nz > 0 ? 0.08 : -0.01), WARM);
        K.sphere(M.glow, 0.85, x, FY + 7.0, z, WARM, 1, 1, 0.08, 12);
      }
    }
    // the portico: eight columns, the entablature with the name, the pediment; the steps to the doors
    const px = XE + 3.4;
    for (let k = 0; k < 8; k++) {
      const z = CZ - 10.5 + k * 3;
      column(K, M, px, z, FY + 0.6, 9.2, 0.5);
    }
    K.box(M.matte, XE, FY, CZ - 12, px + 1.4, FY + 0.6, CZ + 12, STONE2);
    for (let k = 0; k < 3; k++) K.box(M.matte, px + 1.4 + k * 0.5, FY, CZ - 6, px + 1.9 + k * 0.5, FY + 0.6 - (k + 1) * 0.2, CZ + 6, STONE2);
    this.cols.push(col.addBox(XE, CZ - 12, px + 1.4, CZ + 12, -1, 0.6, 'step'));
    K.box(M.matte, XE, FY + 9.8, CZ - 12, px + 1.0, FY + 11.4, CZ + 12, STONE);
    K.box(M.metal, px + 0.98, FY + 9.8, CZ - 12, px + 1.06, FY + 9.95, CZ + 12, GOLD);
    K.box(M.metal, px + 0.98, FY + 11.25, CZ - 12, px + 1.06, FY + 11.4, CZ + 12, GOLD);
    for (let k = 0; k < 6; k++) {
      const w = 12 - k * 2;
      K.box(M.matte, XE, FY + 11.4 + k * 0.42, CZ - w, px + 1.0, FY + 11.82 + k * 0.42, CZ + w, k % 2 ? STONE2 : STONE);
    }
    K.box(M.matte, px + 1.0, FY + 9.97, CZ - 7.2, px + 1.07, FY + 11.23, CZ + 7.2, linC(0.22, 0.03, 0.05));
    neonWord(K, M.glow, 'PALACE OF INK', 1.05, px + 1.07, FY + 10.05, CZ, 1, 0, linC(1, 0.82, 0.35), 0.0, 0.06);
    // (the red carpet up the steps to the doors)
    K.box(M.matte, XE, FY + 0.61, CZ - 1.6, px + 2.9, FY + 0.63, CZ + 1.6, linC(0.6, 0.06, 0.1));
    // the doors: gold frames, the glass
    for (const z of [DOOR.z0, DOOR.z1]) K.box(M.metal, XE - T - 0.05, FY, z - 0.12, XE + 0.05, FY + DOOR.h, z + 0.12, GOLD);
    K.box(M.metal, XE - T - 0.05, FY + DOOR.h - 0.18, DOOR.z0, XE + 0.05, FY + DOOR.h, DOOR.z1, GOLD);
    // the dome over the pit: its drum, the dome of gold, the lantern
    const dx = X(16);
    const dz = Z(39);
    K.cyl(M.matte, 7.4, 7.4, FY + HT + 0.3, FY + HT + 2.4, STONE, { axis: 'y', x: dx, z: dz, segs: 32 });
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      K.box(M.glow, dx + Math.cos(a) * 7.42 - 0.35, FY + HT + 0.8, dz + Math.sin(a) * 7.42 - 0.35, dx + Math.cos(a) * 7.42 + 0.35, FY + HT + 2.0, dz + Math.sin(a) * 7.42 + 0.35, WARM);
    }
    {
      // (a half sphere: nothing of it under the drum, in the hall)
      const dome = new THREE.SphereGeometry(7.2, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      dome.scale(1, 0.72, 1);
      dome.translate(dx, FY + HT + 2.4, dz);
      K.add(M.paint, dome, GOLD);
    }
    K.cyl(M.matte, 1.0, 1.0, FY + HT + 7.4, FY + HT + 9.2, STONE, { axis: 'y', x: dx, z: dz, segs: 12 });
    K.sphere(M.glow, 0.9, dx, FY + HT + 9.6, dz, WARM, 1, 1, 1, 12);
    K.cyl(M.metal, 0.08, 0.02, FY + HT + 10.3, FY + HT + 12.5, GOLD, { axis: 'y', x: dx, z: dz, segs: 6 });
    // the hotel's tower: its face of windows (a picture, lit at night), its cornice, its name in red
    const tw = H.tower;
    const tx0 = X(tw.u0);
    const tx1 = X(tw.u1);
    const tz0 = Z(tw.v0);
    const tz1 = Z(tw.v1);
    K.box(M.matte, tx0, FY + HT + 0.3, tz0, tx1, FY + tw.h, tz1, STONE2);
    K.box(M.metal, tx0 - 0.4, FY + tw.h, tz0 - 0.4, tx1 + 0.4, FY + tw.h + 0.5, tz1 + 0.4, GOLD);
    // (on its roof: SKY POOL, the party over the bay - game/partyroof.js)
    neonWord(K, M.glow, 'PALACE', 3.2, tx1, FY + tw.h - 5.5, (tz0 + tz1) / 2, 1, 0, linC(1, 0.15, 0.25), 0.02, 0.2);
    // the forecourt: two long pools, their stone rims, the water; the walk between them
    this.pools = [];
    for (const [za, zb] of [[Z0 + 1, CZ - 7], [CZ + 7, Z1 - 1]]) {
      const x0 = XE + 6;
      const x1 = XE + 18.5;
      K.box(M.matte, x0 - 0.5, FY, za - 0.5, x1 + 0.5, FY + 0.55, za, STONE2);
      K.box(M.matte, x0 - 0.5, FY, zb, x1 + 0.5, FY + 0.55, zb + 0.5, STONE2);
      K.box(M.matte, x0 - 0.5, FY, za, x0, FY + 0.55, zb, STONE2);
      K.box(M.matte, x1, FY, za, x1 + 0.5, FY + 0.55, zb, STONE2);
      K.box(M.paint, x0, FY + 0.05, za, x1, FY + 0.38, zb, linC(0.12, 0.32, 0.55));
      this.cols.push(col.addBox(x0 - 0.5, za - 0.5, x1 + 0.5, zb + 0.5, -1, 0.55, 'prop'));
      this.pools.push({ x0, x1, z0: za, z1: zb });
    }
    // (lamps along the walk)
    for (const z of [CZ - 5.5, CZ + 5.5]) {
      for (let x = XE + 7; x < XE + 19; x += 4) {
        K.cyl(M.metal, 0.08, 0.08, FY, FY + 3.6, linC(0.15, 0.12, 0.08), { axis: 'y', x, z, segs: 6 });
        K.sphere(M.glow, 0.28, x, FY + 3.8, z, WARM, 1, 1, 1, 10);
      }
    }
    // inside: the wainscot of wood, the gold rail over it, the cornice under the ceiling; the ceiling
    const WD = linC(0.26, 0.12, 0.05);
    for (const [x0, z0, x1, z1] of [[XW + T, Z0 + T, XE - T, Z0 + T + 0.05], [XW + T, Z1 - T - 0.05, XE - T, Z1 - T], [XW + T, Z0 + T, XW + T + 0.05, Z1 - T], [XE - T - 0.05, Z0 + T, XE - T, DOOR.z0], [XE - T - 0.05, DOOR.z1, XE - T, Z1 - T]]) {
      K.box(CM.matte, x0, F, z0, x1, F + 1.0, z1, WD);
      const ex = x1 - x0 < 0.1;
      const gx = ex ? 0.03 : 0;
      const gz = ex ? 0 : 0.03;
      K.box(CM.metal, x0 - gx, F + 1.0, z0 - gz, x1 + gx, F + 1.08, z1 + gz, GOLD);
      K.box(CM.metal, x0 - gx * 3, FY + HT - 0.65, z0 - gz * 3, x1 + gx * 3, FY + HT - 0.5, z1 + gz * 3, GOLD);
    }
    const group = K.build({ seed: 0.61 });
    // the tower's windows, the ceiling's coffers, the walls' damask: pictures on the walls
    const touch = g.touch;
    const tws = paintTowerWindows(touch ? 128 : 256, touch ? 256 : 512);
    this.towerTex = canvasTexture(tws.c, { repeat: true });
    this.towerEm = canvasTexture(tws.e, { repeat: true });
    const towerMat = makeSurface({ kind: 'uv', map: this.towerTex, uvScale: 1, ang: 0.4, wash: 0.85, emissive: new THREE.Color(0.0, 0.0, 0.0), emMap: this.towerEm, line: 0.3 });
    this.towerMat = towerMat;
    {
      const geos = [];
      const y0 = FY + HT + 1;
      const y1 = FY + tw.h - 7;
      const faces = [[tx1 + 0.02, (tz0 + tz1) / 2, tz1 - tz0, 1, 0], [tx0 - 0.02, (tz0 + tz1) / 2, tz1 - tz0, -1, 0], [(tx0 + tx1) / 2, tz0 - 0.02, tx1 - tx0, 0, -1], [(tx0 + tx1) / 2, tz1 + 0.02, tx1 - tx0, 0, 1]];
      for (const [x, z, w, nx, nz] of faces) {
        const geo = pictureGeo(w, y1 - y0, x, (y0 + y1) / 2, z, nx, nz);
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 12, (uv.getY(i) * (y1 - y0)) / 24);
        geos.push(geo);
      }
      group.add(merged(geos, towerMat));
    }
    for (const m of chaser(M, this.bulbsOf(), 0.07, linC(1, 0.85, 0.45))) {
      group.add(m);
      (this.chase = this.chase || []).push(m);
    }
    group.updateMatrix();
    g.scene.add(group);
    this.shell = group;
    const ml = g.world.mainland;
    for (const m of group.children) if (!this.chase.includes(m)) m.userData.dynamic = false;
    if (ml && ml.pipe) ml.pipe.addStatic(group);
    g.world.roofVer = (g.world.roofVer || 0) + 1;
  }

  // the bulbs that chase: along the entablature's foot, round the steps
  bulbsOf() {
    const px = XE + 3.4;
    const out = [];
    for (let z = CZ - 11.8; z <= CZ + 11.81; z += 0.4) out.push([px + 1.12, FY + 9.72, z]);
    return out;
  }

  teardownShell() {
    const g = this.game;
    this.teardownInside();
    if (this.shell) {
      const ml = g.world.mainland;
      if (ml && ml.pipe) ml.pipe.removeStatic(this.shell);
      g.scene.remove(this.shell);
      this.shell.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
      });
      g.world.roofVer = (g.world.roofVer || 0) + 1;
    }
    if (this.towerTex) this.towerTex.dispose();
    if (this.towerEm) this.towerEm.dispose();
    if (this.towerMat) this.towerMat.dispose();
    this.towerTex = null;
    this.towerEm = null;
    this.towerMat = null;
    for (const id of this.cols) g.world.collision.remove(id);
    this.cols = [];
    this.shell = null;
    this.chase = null;
  }

  // ------------------------------------------------------------------ inside
  buildInside() {
    const g = this.game;
    const CM = clubMats('casino');
    const K = new Kit();
    const col = g.world.collision;
    const touch = g.touch;
    const P = PLAN;
    const GOLD = linC(0.85, 0.62, 0.22);
    const WARM = linC(1, 0.82, 0.5);
    const RED = linC(0.55, 0.05, 0.1);
    const ids = (this.inCols = []);
    const prop = (x0, z0, x1, z1, h = 2) => ids.push(col.addBox(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), -1, h, 'prop'));
    const box2 = (x, z, n, hw, d0, d1) => {
      const [ax, az] = [x + n[1] * -hw + n[0] * d0, z - n[0] * -hw + n[1] * d0];
      const [bx, bz] = [x + n[1] * hw + n[0] * d1, z - n[0] * hw + n[1] * d1];
      return [ax, az, bx, bz];
    };
    const LITS = [linC(1, 0.82, 0.35), linC(1, 0.3, 0.45), linC(0.4, 0.85, 1), linC(0.55, 1, 0.5)];
    const CABS = [linC(0.55, 0.05, 0.1), linC(0.08, 0.1, 0.35), linC(0.1, 0.3, 0.15), linC(0.3, 0.08, 0.35)];
    const shown = [];
    // the slot machines
    this.slots = P.slots.map((s, i) => {
      const r = slotMachine(K, CM, s.x, s.z, F, s.n[0], s.n[1], CABS[i % CABS.length], LITS[(i >> 1) % LITS.length]);
      prop(...box2(s.x, s.z, s.n, 0.37, -0.4, 0.32), 2.3);
      shown.push({ kind: 'slot', cell: i % 4, ...r.screen, n: s.n });
      shown.push({ kind: 'sign', name: 'INK FORTUNE', ...r.sign, n: s.n });
      return { ...s, ...r, i };
    });
    // the tables, their dealers' places
    this.tables = P.tables.map((t) => {
      const r = t.kind === 'blackjack' ? blackjackTable(K, CM, t.x, t.z, F, t.n[0], t.n[1]) : rouletteTable(K, CM, t.x, t.z, F, t.n[0], t.n[1]);
      const hw = t.kind === 'blackjack' ? 1.1 : 1.32;
      const hd = t.kind === 'blackjack' ? 0.7 : 0.86;
      prop(...box2(t.x, t.z, t.n, hw, -hd, hd), 0.95);
      shown.push({ kind: t.kind, ...r.surface, n: t.n });
      return { ...t, ...r };
    });
    // the signs over the pit: hung from the ceiling over each row
    for (const [v, ny] of [[29.2, -1], [48.8, 1]]) {
      const z = Z(v);
      K.box(CM.matte, X(4), FY + 5.6, z - 0.06, X(28), FY + 6.3, z + 0.06, linC(0.1, 0.05, 0.02));
      shown.push({ kind: 'sign', name: 'ROULETTE', at: [X(7), FY + 5.95, z + ny * 0.07], w: 3.6, h: 0.6, n: [0, ny] });
      shown.push({ kind: 'sign', name: 'BLACKJACK', at: [X(19.5), FY + 5.95, z + ny * 0.07], w: 6, h: 0.6, n: [0, ny] });
      for (const x of [X(5), X(27)]) K.cyl(CM.metal, 0.02, 0.02, FY + 6.3, FY + HT - 0.3, GOLD, { axis: 'y', x, z, segs: 4 });
    }
    // the pit's podium in the middle, the grand chandelier over it, the smaller ones round the hall
    K.box(CM.paint, X(14.6), F, Z(38), X(17.4), F + 1.05, Z(40), linC(0.3, 0.12, 0.05));
    K.box(CM.metal, X(14.5), F + 1.05, Z(37.9), X(17.5), F + 1.1, Z(40.1), GOLD);
    prop(X(14.6), Z(38), X(17.4), Z(40), 1.2);
    chandelier(K, CM, X(16), FY + 7.0, Z(39), 2.3, 3);
    for (const [u, v] of [[9, 4.8], [23, 4.8], [9, 13.4], [23, 13.4], [16, 22.5], [19, 57], [9, 70], [24, 66]]) chandelier(K, CM, X(u), FY + 7.6, Z(v), 1.0, 2);
    // the columns along the walls (marble, gold), the paintings between them, the sconces
    const cols = [];
    for (let v = 6; v < 76; v += 6.5) cols.push([X(1.0), Z(v)]);
    for (let u = 6.5; u < 34; u += 6.5) cols.push([X(u), Z(1.0)], [X(u), Z(77)]);
    for (const [x, z] of cols) column(K, CM, x, z, F, HT - 0.55, 0.32);
    // the cage: its counter, the brass bars, the cashiers' windows
    {
      const C = P.cage;
      K.box(CM.paint, C.x0, F, C.z0, C.x1, F + 1.1, C.z1, linC(0.3, 0.12, 0.05));
      K.box(CM.metal, C.x0, F + 1.1, C.z1 - 0.1, C.x1, F + 1.16, C.z1 + 0.05, GOLD);
      for (let x = C.x0 + 0.1; x < C.x1; x += 0.16) K.box(CM.metal, x, F + 1.16, C.z1 - 0.06, x + 0.03, F + 2.5, C.z1 - 0.03, GOLD);
      K.box(CM.metal, C.x0, F + 2.5, C.z0, C.x1, F + 2.7, C.z1, GOLD);
      K.box(CM.matte, C.x0, F, C.z0 - 1.2, C.x1, F + 3.2, C.z0, linC(0.25, 0.08, 0.06));
      prop(C.x0, C.z0 - 1.2, C.x1, C.z1, 2.8);
      shown.push({ kind: 'sign', name: 'THE CAGE', at: [(C.x0 + C.x1) / 2, F + 2.95, C.z1 - 0.02], w: 3.4, h: 0.42, n: [0, 1] });
    }
    // the bar: an island, its counter of wood and brass, the back bar of bottles in the middle
    {
      const B = P.bar;
      K.box(CM.paint, B.x0, F, B.z0, B.x1, F + 1.08, B.z1, linC(0.3, 0.12, 0.05));
      K.box(CM.metal, B.x0 - 0.15, F + 1.08, B.z0 - 0.15, B.x1 + 0.15, F + 1.14, B.z1 + 0.15, linC(0.12, 0.08, 0.06));
      K.box(CM.metal, B.x0 - 0.15, F + 0.1, B.z0 - 0.17, B.x1 + 0.15, F + 0.16, B.z1 + 0.17, GOLD);
      K.box(CM.matte, B.x0 + 2, F + 1.14, (B.z0 + B.z1) / 2 - 0.4, B.x1 - 2, F + 2.6, (B.z0 + B.z1) / 2 + 0.4, linC(0.15, 0.06, 0.03));
      prop(B.x0, B.z0, B.x1, B.z1, 1.2);
      for (const z of [B.z0 - 0.6, B.z1 + 0.6]) {
        for (let x = B.x0 + 0.6; x < B.x1 - 0.3; x += 1.1) {
          K.cyl(CM.metal, 0.03, 0.03, F, F + 0.72, GOLD, { axis: 'y', x, z, segs: 6 });
          K.cyl(CM.paint, 0.21, 0.21, F + 0.72, F + 0.8, RED, { axis: 'y', x, z, segs: 12 });
        }
      }
      for (const nz of [-1, 1]) shown.push({ kind: 'bottles', at: [(B.x0 + B.x1) / 2, F + 1.88, (B.z0 + B.z1) / 2 + nz * 0.405], w: B.x1 - B.x0 - 4.1, h: 1.4, n: [0, nz] });
      K.box(CM.matte, B.x0 + 1, FY + 4.6, (B.z0 + B.z1) / 2 - 0.05, B.x1 - 1, FY + 5.3, (B.z0 + B.z1) / 2 + 0.05, linC(0.1, 0.05, 0.02));
      for (const nz of [-1, 1]) shown.push({ kind: 'sign', name: 'THE INKWELL BAR', at: [(B.x0 + B.x1) / 2, FY + 4.95, (B.z0 + B.z1) / 2 + nz * 0.06], w: 6.4, h: 0.6, n: [0, nz] });
    }
    // the stage: its deck, the curtain behind, the piano, the microphone, the sign
    {
      const S = P.stage;
      K.box(CM.paint, S.x0, F, S.z0, S.x1, F + S.h, S.z1, linC(0.25, 0.1, 0.04));
      K.box(CM.metal, S.x0, F + S.h - 0.08, S.z0 - 0.02, S.x1, F + S.h, S.z0 + 0.02, GOLD);
      for (let k = 0; k < 3; k++) K.box(CM.paint, X(30) - 1, F, S.z0 - 0.9 + k * 0.3, X(30) + 1, F + (k + 1) * 0.3, S.z0 - 0.6 + k * 0.3, linC(0.25, 0.1, 0.04));
      prop(S.x0, S.z0, S.x1, S.z1, F + S.h);
      // the piano: its body, its lid up, its legs
      const px = X(28);
      const pz = Z(74);
      K.box(CM.paint, px - 0.75, F + S.h + 0.6, pz - 0.6, px + 0.75, F + S.h + 0.95, pz + 0.7, linC(0.02, 0.02, 0.03));
      K.box(CM.paint, px - 0.72, F + S.h + 0.95, pz - 0.6, px - 0.66, F + S.h + 1.8, pz + 0.6, linC(0.02, 0.02, 0.03));
      K.box(CM.matte, px - 0.7, F + S.h + 0.93, pz + 0.55, px + 0.7, F + S.h + 0.97, pz + 0.72, linC(0.95, 0.95, 0.92));
      for (const [lx, lz] of [[-0.6, -0.5], [0.6, -0.5], [0, 0.6]]) K.box(CM.paint, px + lx - 0.05, F + S.h, pz + lz - 0.05, px + lx + 0.05, F + S.h + 0.6, pz + lz + 0.05, linC(0.02, 0.02, 0.03));
      K.cyl(CM.metal, 0.015, 0.015, F + S.h, F + S.h + 1.5, linC(0.7, 0.7, 0.75), { axis: 'y', x: X(31.5), z: Z(72), segs: 6 });
      K.sphere(CM.matte, 0.05, X(31.5), F + S.h + 1.55, Z(72), linC(0.1, 0.1, 0.1), 1, 1.3, 1, 8);
      shown.push({ kind: 'curtain', at: [(S.x0 + S.x1) / 2, F + S.h + 2.8, Z1 - T - 0.08], w: S.x1 - S.x0, h: 5.4, n: [0, -1] });
      shown.push({ kind: 'sign', name: 'LIVE TONIGHT: LADY INKWELL', at: [(S.x0 + S.x1) / 2, FY + 6.4, Z1 - T - 0.1], w: 8, h: 0.62, n: [0, -1] });
      this.stageSpot = [X(31.5), F + S.h, Z(72)];
    }
    // the lounge's sofas, facing the stage
    for (const [x, z, n] of P.lounge) {
      sofa(K, CM, x, z, F, n[0], n[1], linC(0.5, 0.04, 0.1), 2.4);
      prop(...box2(x, z, n, 1.2, -0.42, 0.42), 0.9);
      const [tx, tz] = [x + n[0] * 1.3, z + n[1] * 1.3];
      K.cyl(CM.metal, 0.5, 0.5, F + 0.42, F + 0.46, GOLD, { axis: 'y', x: tx, z: tz, segs: 16 });
      K.cyl(CM.metal, 0.05, 0.05, F, F + 0.42, GOLD, { axis: 'y', x: tx, z: tz, segs: 6 });
    }
    // the VIP room: glass walls framed in gold, the rope at its gate, its sofas
    {
      const V = P.vip;
      const glassC = linC(0.12, 0.14, 0.2);
      K.box(CM.glass, X(0.4), F, V.z0 - 0.05, V.x1, F + 3.2, V.z0 + 0.05, glassC);
      K.box(CM.metal, X(0.4), F + 3.2, V.z0 - 0.08, V.x1 + 0.08, F + 3.35, V.z0 + 0.08, GOLD);
      K.box(CM.glass, V.x1 - 0.05, F, V.z0, V.x1 + 0.05, F + 3.2, V.gate[0], glassC);
      K.box(CM.glass, V.x1 - 0.05, F, V.gate[1], V.x1 + 0.05, F + 3.2, Z1 - T, glassC);
      K.box(CM.metal, V.x1 - 0.08, F + 3.2, V.z0, V.x1 + 0.08, F + 3.35, Z1 - T, GOLD);
      for (let x = X(2); x < V.x1; x += 2.2) K.box(CM.metal, x - 0.04, F, V.z0 - 0.07, x + 0.04, F + 3.2, V.z0 + 0.07, GOLD);
      this.inCols.push(col.addBox(X(0.4), V.z0 - 0.1, V.x1, V.z0 + 0.1, -1, 3.2, 'wall'));
      this.inCols.push(col.addBox(V.x1 - 0.1, V.z0, V.x1 + 0.1, V.gate[0], -1, 3.2, 'wall'));
      this.inCols.push(col.addBox(V.x1 - 0.1, V.gate[1], V.x1 + 0.1, Z1 - T, -1, 3.2, 'wall'));
      // the rope across the gate (its posts gold), a box while it is closed
      for (const z of V.gate) {
        K.cyl(CM.metal, 0.05, 0.05, F, F + 1.0, GOLD, { axis: 'y', x: V.x1 + 0.25, z, segs: 8 });
        K.sphere(CM.metal, 0.08, V.x1 + 0.25, F + 1.02, z, GOLD, 1, 1, 1, 8);
      }
      this.ropeAt = [V.x1 + 0.25, (V.gate[0] + V.gate[1]) / 2];
      if (!this.vip) this.ropeCol = col.addBox(V.x1 - 0.1, V.gate[0], V.x1 + 0.4, V.gate[1], -1, 1.6, 'prop');
      shown.push({ kind: 'sign', name: 'VIP', at: [V.x1 + 0.09, F + 3.7, (V.gate[0] + V.gate[1]) / 2], w: 1.6, h: 0.5, n: [1, 0] });
      sofa(K, CM, X(10.5), Z(76.6), F, 0, -1, linC(0.08, 0.06, 0.18), 2.6);
      sofa(K, CM, X(1.4), Z(71.5), F, 1, 0, linC(0.08, 0.06, 0.18), 2.6);
    }
    const group = K.build({ seed: 0.83 });
    // the rope itself (red velvet, sagging): drawn while closed (draw())
    // ---- the pictures
    this.carpetTex = canvasTexture(paintCarpet(touch ? 256 : 512), { repeat: true });
    const carpetMat = makeSurface({ kind: 'uv', map: this.carpetTex, uvScale: 4, ang: 0.4, wash: 0.85, indoor: 'casino', emissive: new THREE.Color(0.12, 0.08, 0.05), emMap: this.carpetTex, line: 0.3 });
    {
      const w = XE - XW - 2 * T;
      const d = Z1 - Z0 - 2 * T;
      const geo = new THREE.PlaneGeometry(w, d);
      geo.rotateX(-Math.PI / 2);
      geo.translate((XW + XE) / 2, F, (Z0 + Z1) / 2);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 4, (uv.getY(i) * d) / 4);
      const m = new THREE.Mesh(geo, carpetMat);
      m.frustumCulled = false;
      group.add(m);
    }
    this.damaskTex = canvasTexture(paintDamask(touch ? 128 : 256), { repeat: true });
    const damaskMat = makeSurface({ kind: 'uv', map: this.damaskTex, uvScale: 2, ang: 1.3, wash: 0.85, indoor: 'casino', line: 0.4 });
    {
      const y0 = F + 1.08;
      const y1 = FY + HT - 0.65;
      const runs = [[XW + T, Z0 + T, XE - T, Z0 + T, 0, 1], [XE - T, Z1 - T, XW + T, Z1 - T, 0, -1], [XW + T, Z1 - T, XW + T, Z0 + T, 1, 0], [XE - T, Z0 + T, XE - T, DOOR.z0, -1, 0], [XE - T, DOOR.z1, XE - T, Z1 - T, -1, 0]];
      const geos = [];
      for (const [ax, az, bx, bz, nx, nz] of runs) {
        const len = Math.hypot(bx - ax, bz - az);
        const geo = new THREE.PlaneGeometry(len, y1 - y0);
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / 1.6, (uv.getY(i) * (y1 - y0)) / 1.6);
        geo.rotateY(Math.atan2(nx, nz));
        geo.translate((ax + bx) / 2 + nx * 0.06, (y0 + y1) / 2, (az + bz) / 2 + nz * 0.06);
        geos.push(geo);
      }
      group.add(merged(geos, damaskMat));
    }
    const cof = paintCoffers(touch ? 128 : 256);
    this.cofTex = canvasTexture(cof.c, { repeat: true });
    this.cofEm = canvasTexture(cof.e, { repeat: true });
    const cofMat = makeSurface({ kind: 'uv', map: this.cofTex, uvScale: 3, ang: 0.4, wash: 0.85, indoor: 'casino', emissive: new THREE.Color(1.2, 1.0, 0.7), emMap: this.cofEm, line: 0.3 });
    {
      const w = XE - XW - 2 * T;
      const d = Z1 - Z0 - 2 * T;
      const geo = new THREE.PlaneGeometry(w, d);
      geo.rotateX(Math.PI / 2);
      geo.translate((XW + XE) / 2, FY + HT - 0.52, (Z0 + Z1) / 2);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 3, (uv.getY(i) * d) / 3);
      const m = new THREE.Mesh(geo, cofMat);
      m.frustumCulled = false;
      group.add(m);
    }
    const sg = paintSigns(touch ? 512 : 1024, touch ? 256 : 512);
    this.signTex = canvasTexture(sg.c, { mips: true });
    const signMat = makeSurface({ kind: 'uv', map: this.signTex, uvScale: 1, ang: 0.4, wash: 0.95, indoor: 'casino', emissive: new THREE.Color(1.0, 1.0, 1.0), emMap: this.signTex, line: 0.15 });
    this.bottleTex = canvasTexture(paintBottles(), { mips: true });
    const bottleMat = makeSurface({ kind: 'uv', map: this.bottleTex, uvScale: 1, ang: 0.4, wash: 0.9, indoor: 'casino', emissive: new THREE.Color(0.6, 0.55, 0.45), emMap: this.bottleTex, line: 0.25 });
    this.curtainTex = canvasTexture(paintCurtain(), { repeat: true });
    const curtainMat = makeSurface({ kind: 'uv', map: this.curtainTex, uvScale: 2, ang: 1.5, wash: 0.85, indoor: 'casino', line: 0.4 });
    // the paintings in their frames between the columns
    const art = paintArtAtlas(12, touch ? 128 : 256, touch ? 96 : 192, 4);
    this.artTex = art.tex;
    const artMat = makeSurface({ kind: 'uv', map: art.tex, uvScale: 1, ang: 0.6, wash: 0.85, indoor: 'casino', emissive: new THREE.Color(0.25, 0.22, 0.18), emMap: art.tex, line: 0.3 });
    // the screens: the slots' reels (four of them, a cell each), the tables' faces (one each kind)
    const SW = touch ? 512 : 1024;
    this.slotC = document.createElement('canvas');
    this.slotC.width = SW;
    this.slotC.height = SW * 0.3;
    this.slotTex = canvasTexture(this.slotC, { mips: false });
    this.slotMat = makeSurface({ kind: 'uv', map: this.slotTex, uvScale: 1, ang: 0.4, wash: 1, line: 0.1, indoor: 'casino', emissive: new THREE.Color(1.1, 1.1, 1.1), emMap: this.slotTex });
    this.slotCells = [0, 1, 2, 3].map((i) => {
      const cw = SW / 4;
      const ch = cw * 0.6;
      return { px: i * cw, py: 0, pw: cw, ph: ch, uv: [(i * cw) / SW, 1 - ch / (SW * 0.3), ((i + 1) * cw) / SW, 1] };
    });
    this.bjC = document.createElement('canvas');
    this.bjC.width = touch ? 320 : 500;
    this.bjC.height = touch ? 192 : 300;
    this.bjTex = canvasTexture(this.bjC, { mips: false });
    this.bjMat = makeSurface({ kind: 'uv', map: this.bjTex, uvScale: 1, ang: 0.4, wash: 1, line: 0.1, indoor: 'casino', emissive: new THREE.Color(0.55, 0.55, 0.55), emMap: this.bjTex });
    this.rlC = document.createElement('canvas');
    this.rlC.width = touch ? 320 : 500;
    this.rlC.height = touch ? 192 : 300;
    this.rlTex = canvasTexture(this.rlC, { mips: false });
    this.rlMat = makeSurface({ kind: 'uv', map: this.rlTex, uvScale: 1, ang: 0.4, wash: 1, line: 0.1, indoor: 'casino', emissive: new THREE.Color(0.55, 0.55, 0.55), emMap: this.rlTex });
    this.paintIdle(0);
    const by = new Map();
    const put = (mat, geo) => {
      if (!by.has(mat)) by.set(mat, []);
      by.get(mat).push(geo);
    };
    for (const s of shown) {
      const [nx, nz] = s.n || [0, 0];
      if (s.kind === 'slot') put(this.slotMat, pictureGeo(s.w, s.h, s.at[0] + nx * 0.004, s.at[1], s.at[2] + nz * 0.004, nx, nz, this.slotCells[s.cell].uv));
      else if (s.kind === 'sign') {
        // (as wide as its word: its height kept, at most the width it was given)
        const B = sg.boxes[s.name];
        const w = Math.min(s.w, s.h * B.aspect);
        put(signMat, pictureGeo(w, s.h, s.at[0] + nx * 0.004, s.at[1], s.at[2] + nz * 0.004, nx, nz, B.uv));
      }
      else if (s.kind === 'blackjack') put(this.bjMat, pictureGeo(s.w, s.h, s.at[0], s.at[1] + 0.004, s.at[2], -nx, -nz, null, true));
      else if (s.kind === 'roulette') put(this.rlMat, pictureGeo(s.w, s.h, s.at[0], s.at[1] + 0.004, s.at[2], -nx, -nz, null, true));
      else if (s.kind === 'bottles') put(bottleMat, pictureGeo(s.w, s.h, s.at[0], s.at[1], s.at[2], nx, nz));
      else if (s.kind === 'curtain') {
        const geo = pictureGeo(s.w, s.h, s.at[0], s.at[1], s.at[2], nx, nz);
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * s.w) / 3, uv.getY(i));
        put(curtainMat, geo);
      }
    }
    // (the paintings: on the long walls between the columns, in gold frames)
    const KF = new Kit();
    let k = 0;
    for (const [z, nz] of [[Z0 + T + 0.07, 1], [Z1 - T - 0.07, -1]]) {
      for (let u = 9.75; u < 33; u += 6.5) {
        if (nz < 0 && u > 25) continue;
        const x = X(u);
        const box = art.boxes[k++ % art.boxes.length];
        put(artMat, pictureGeo(2.4, 1.8, x, FY + 4.6, z + nz * 0.02, 0, nz, box));
        KF.box(CM.metal, x - 1.35, FY + 3.55, z - 0.04, x + 1.35, FY + 5.65, z + 0.04, GOLD);
        for (const s of [-1, 1]) KF.sphere(CM.glow, 0.12, x + s * 1.75, FY + 4.9, z + nz * 0.12, WARM, 1, 1.3, 1, 8);
      }
    }
    const frames = KF.build({ seed: 0.2 });
    for (const m of frames.children.slice()) group.add(m);
    for (const [mat, geos] of by) group.add(merged(geos, mat));
    this.mats = [carpetMat, damaskMat, cofMat, signMat, bottleMat, curtainMat, artMat, this.slotMat, this.bjMat, this.rlMat];
    this.texs = [this.carpetTex, this.damaskTex, this.cofTex, this.cofEm, this.signTex, this.bottleTex, this.curtainTex, this.artTex, this.slotTex, this.bjTex, this.rlTex];
    group.updateMatrix();
    g.scene.add(group);
    this.inside = group;
    this.makeCrowd();
  }

  teardownInside() {
    const g = this.game;
    if (this.inside) {
      g.scene.remove(this.inside);
      this.inside.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
      });
    }
    for (const t of this.texs || []) t.dispose();
    for (const m of this.mats || []) m.dispose();
    this.texs = [];
    this.mats = [];
    for (const id of this.inCols) g.world.collision.remove(id);
    if (this.ropeCol !== undefined && this.ropeCol !== null) g.world.collision.remove(this.ropeCol);
    this.ropeCol = null;
    this.inCols = [];
    this.inside = null;
    this.crowd = [];
    this.stopMusic();
    if (g.player.fig.indoor === 'casino') g.player.fig.indoor = null;
  }

  // the idle screens and faces: the reels turning, the wheel going round, a hand dealt
  paintIdle(dt) {
    const g = this.slotC.getContext('2d');
    this.slotCells.forEach((c, i) => paintSlotIdle(g, c.px, c.py, c.pw, c.ph, this.t + i * 1.7, i * 0.37));
    this.slotTex.needsUpdate = true;
    const b = this.bjC.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    paintBlackjackIdle(b, this.bjC.width, this.bjC.height, this.t);
    this.bjTex.needsUpdate = true;
    const r = this.rlC.getContext('2d');
    r.setTransform(1, 0, 0, 1, 0, 0);
    paintRouletteIdle(r, this.rlC.width, this.rlC.height, this.t);
    this.rlTex.needsUpdate = true;
    void dt;
  }

  // ------------------------------------------------------------------ the people
  makeCrowd() {
    const g = this.game;
    const N = g.touch ? 0.45 : 1;
    const R = Math.random;
    const list = [];
    const person = (x, z, yaw, at, o = {}) => {
      const look = o.look || patronLook();
      list.push({ x, z, y: F, y0: F, look, scale: look.build.height, yaw, speed: 0, phase: R() * 6, seed: R() * 100, cheer: 0, sit: 0, at, indoor: 4, hop: R(), ...o });
    };
    const face = (n) => Math.atan2(-n[0], -n[1]);
    const take = (k) => R() < k * N;
    for (const s of this.slots) {
      if (!take(0.32)) continue;
      // (on the stool: its seat 0.7 high)
      person(s.stand[0], s.stand[2], face(s.n), 'slot', { sit: 1, y: F + 0.23, y0: F + 0.23 });
      s.busy = list[list.length - 1];
    }
    for (const t of this.tables) {
      // the dealer across the table, players on its seats (yours the middle one, when you come)
      person(t.dealer[0], t.dealer[2], face([-t.n[0], -t.n[1]]), 'dealer', { look: bartenderLook() });
      t.seats.forEach((st, i) => {
        if (i === 1) return;
        if (!take(t.vip ? 0.8 : 0.7)) return;
        person(st[0], st[2], face(t.n), t.kind === 'blackjack' ? 'table' : 'bettor', t.kind === 'blackjack' ? { sit: 1, y: F + 0.27, y0: F + 0.27 } : {});
      });
    }
    person(X(16), Z(39), 0, 'pit', { look: bouncerLook() });
    // the cage's cashiers, the bar's bartenders and its drinkers
    const C = PLAN.cage;
    for (const x of [C.x0 + 1.5, C.x1 - 1.5]) person(x, C.z0 - 0.6, 0, 'staff', { look: bartenderLook() });
    const B = PLAN.bar;
    for (const z of [B.z0 + 0.6, B.z1 - 0.6]) person((B.x0 + B.x1) / 2 + (R() - 0.5) * 3, z, z < (B.z0 + B.z1) / 2 ? Math.PI : 0, 'staff', { look: bartenderLook() });
    for (const z of [B.z0 - 0.6, B.z1 + 0.6]) {
      for (let x = B.x0 + 0.6; x < B.x1 - 0.3; x += 1.1) if (take(0.5)) person(x, z, z < B.z0 ? 0 : Math.PI, 'bar', { sit: 1, y: F + 0.33, y0: F + 0.33 });
    }
    // the stage: the singer at the microphone, the pianist; the lounge on its sofas, some standing
    const S = this.stageSpot;
    person(S[0], S[2] + 0.4, Math.PI, 'singer', { y: S[1], y0: S[1], look: patronLook({ fem: true, kind: 'dress' }) });
    person(X(28) + 0.1, Z(74) - 1.0, 0.0, 'pianist', { y: S[1], y0: S[1], sit: 1 });
    for (const [x, z, n] of PLAN.lounge) {
      for (const s of [-0.6, 0.6]) if (take(0.7)) person(x + n[1] * s + n[0] * 0.1, z - n[0] * s + n[1] * 0.1, face([-n[0], -n[1]]), 'lounge', { sit: 1, y: F + 0.02 });
    }
    for (let k = 0; k < 6; k++) if (take(0.8)) person(X(27 + R() * 7), Z(64 + R() * 4), Math.PI + (R() - 0.5) * 0.6, 'audience');
    // the VIP room's few, the guard at its rope
    for (const [x, z, yaw] of [[X(9.8), Z(76.4), Math.PI], [X(11.2), Z(76.4), Math.PI], [X(2.0), Z(71), Math.PI / 2]]) if (take(0.9)) person(x, z, yaw, 'lounge', { sit: 1, y: F + 0.02 });
    person(this.ropeAt[0] + 0.6, this.ropeAt[1] - 1.6, -Math.PI / 2, 'guard', { look: bouncerLook() });
    // the doormen outside, the guests walking the floor, the waitresses with their trays
    for (const z of [DOOR.z0 - 1.2, DOOR.z1 + 1.2]) person(XE + 1.2, z, Math.PI / 2, 'guard', { look: bouncerLook() });
    const lanes = [[X(3), X(33), Z(4.6)], [X(3), X(33), Z(13.5)], [X(3), X(33), Z(23)], [X(3), X(34), CZ - 1], [X(3), X(34), CZ + 1], [X(14), X(34), Z(52)], [X(15), X(25), Z(62.5)]];
    for (const [xa, xb, z] of lanes) {
      for (let k = 0; k < 2; k++) {
        if (!take(0.8)) continue;
        const dir = R() < 0.5 ? 1 : -1;
        person(xa + R() * (xb - xa), z + (R() - 0.5) * 0.8, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 'walk', { xMin: xa, xMax: xb, dir, v: 0.6 + R() * 0.4, tray: k === 0 && R() < 0.4 });
      }
    }
    this.crowd = list;
  }

  // ------------------------------------------------------------------ the sound: a jazz trio, the floor's noise
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
    this.song = makeSong(this.songN % 3 === 1 ? 'lofi' : 'jazz', 900 + this.songN * 11);
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
  // (in the hall - not over it, on the tower's roof: game/partyroof.js)
  inHall(x, z, y = 0) {
    return x > XW && x < XE && z > Z0 && z < Z1 && y < FY + HT;
  }

  update(dt) {
    const g = this.game;
    const ml = g.world.mainland;
    if (!ml || !BLOCK || this.failed) return;
    this.t += dt;
    const p = g.player;
    const built = ml.blocks && ml.blocks.has(BLOCK.id);
    try {
      if (built && !this.shell) this.buildShell();
      if (!built && this.shell) this.teardownShell();
    } catch (e) {
      console.error('[casino]', e);
      this.failed = true;
      return;
    }
    if (!this.shell) return;
    // the tower's windows lit as night comes
    const night = g.daynight ? g.daynight.night : 1;
    if (this.towerMat) {
      const k = 1.3 * night;
      this.towerMat.uniforms.uEmissive.value.setRGB(k, k * 0.92, k * 0.75);
    }
    if (this.chase) {
      const k = Math.floor(this.t * 4) % 2;
      this.chase[0].visible = k === 0;
      this.chase[1].visible = k === 1;
    }
    const d = Math.hypot(p.pos.x - (XW + XE) / 2, p.pos.z - CZ);
    if (!this.inside && d < NEAR_IN) {
      try {
        this.buildInside();
      } catch (e) {
        console.error('[casino]', e);
        this.failed = true;
        for (const id of this.inCols) g.world.collision.remove(id);
        this.inCols = [];
        return;
      }
    }
    if (this.inside && d > NEAR_IN + 50) this.teardownInside();
    if (!this.inside) return;
    const inside = this.inHall(p.pos.x, p.pos.z, p.pos.y);
    const f = p.fig;
    if (inside && f.indoor !== 'casino') f.indoor = 'casino';
    else if (!inside && f.indoor === 'casino') f.indoor = null;
    if (inside && !this.welcomed) {
      this.welcomed = true;
      g.hud.big('PALACE OF INK', 2200);
      g.hud.toast('מכונות מזל, בלאק ג׳ק ורולטה. ההימורים בכסף שלכם. בהצלחה!', 'info', 4);
    }
    if (!inside && d > 70) this.welcomed = false;
    const cam = g.camera.position;
    const near = this.inHall(cam.x, cam.z, cam.y) || (Math.hypot(cam.x - XE, cam.z - CZ) < 40 && cam.y < FY + HT + 6);
    if (near) {
      this.idleT = (this.idleT || 0) + dt;
      if (this.idleT >= (g.touch ? 0.3 : 0.15)) {
        this.paintIdle(this.idleT);
        this.idleT = 0;
      }
    }
    const c = g.audio && g.audio.ctx;
    if (near && !this.band) this.startMusic();
    if (this.band && c) {
      const now = c.currentTime;
      if (now > this.songEnd - 0.05) this.nextSong(this.songEnd);
      this.band.update(now);
      const playing = g.minigames && g.minigames.isOpen;
      const ds = Math.hypot(p.pos.x - this.stageSpot[0], p.pos.z - this.stageSpot[2]);
      const vol = inside ? (playing ? 0.15 : 0.22 + 0.3 * Math.max(0, 1 - ds / 30)) : near ? 0.12 : 0;
      this.mix.gain.setTargetAtTime(vol, now, 0.3);
      this.lp.frequency.setTargetAtTime(inside ? 9000 : 700, now, 0.3);
      this.beat = (now - this.songT0) / (this.spb * 4);
    } else this.beat = this.t * 1.5;
    if (!near && this.band && d > NEAR_IN) this.stopMusic();
    // the floor's noise: a slot's jingle, chips
    if (inside && c) {
      this.noiseT = (this.noiseT || 0) - dt;
      if (this.noiseT <= 0) {
        this.noiseT = 0.3 + Math.random() * 0.9;
        const r = Math.random();
        sfx(g.audio, r < 0.12 ? 'win' : r < 0.6 ? 'chip' : 'reel', 0.25);
      }
    }
    // the fountains' show: at night, every two minutes, forty seconds
    this.showT = (this.t % 120) < 40 && night > 0.3;
    for (const w of this.crowd) {
      w.phase += dt * (w.at === 'walk' ? 4 * w.v : 1.2);
      if (w.at === 'walk') {
        if (w.pause > 0) {
          w.pause -= dt;
          w.speed = 0;
          continue;
        }
        w.x += w.dir * w.v * dt;
        w.speed = 3.2 * w.v;
        w.cheer = w.tray ? 0.55 : 0;
        if (w.x > w.xMax || w.x < w.xMin) {
          w.dir = -w.dir;
          w.x = Math.max(w.xMin, Math.min(w.xMax, w.x));
          w.yaw = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else if (Math.random() < dt * 0.05) {
          w.pause = 2 + Math.random() * 4;
          w.speed = 0;
        }
      } else if (w.at === 'slot') {
        // (now and then a pull of the lever, now and then a win)
        w.cheer = Math.sin(this.t * 0.5 + w.seed) > 0.97 ? 1 : Math.sin(this.t * 1.3 + w.seed * 2) > 0.8 ? 0.45 : 0.1;
      } else if (w.at === 'dealer') {
        w.cheer = 0.3 + 0.2 * Math.sin(this.t * 2 + w.seed);
      } else if (w.at === 'table' || w.at === 'bettor') {
        w.cheer = Math.sin(this.t * 0.4 + w.seed) > 0.95 ? 1 : 0.15;
      } else if (w.at === 'singer') {
        w.cheer = 0.45 + 0.35 * Math.sin(this.beat * Math.PI * 0.5);
        w.y = w.y0;
      } else if (w.at === 'pianist') {
        w.cheer = 0.35 + 0.15 * Math.sin(this.t * 7);
      } else if (w.at === 'audience' || w.at === 'lounge' || w.at === 'bar') {
        w.cheer = Math.sin(this.t * 0.8 + w.seed * 3) > 0.92 ? 0.6 : 0;
      }
    }
  }

  // ------------------------------------------------------------------ drawing (game/game.js)
  draw(fr) {
    if (!this.shell) return;
    const g = this.game;
    const cam = g.camera.position;
    const inCam = this.inHall(cam.x, cam.z, cam.y);
    const dc = Math.hypot(cam.x - XE, cam.z - CZ);
    const night = g.daynight ? g.daynight.night : 1;
    // the fountains: jets of water in the pools, swaying, rising and falling with the show
    if (!inCam && dc < 140 && this.pools) {
      const t = this.t;
      const show = this.showT;
      let id = 9100;
      for (const P of this.pools) {
        const n = 12;
        for (let i = 0; i < n; i++) {
          const z = P.z0 + ((i + 0.5) / n) * (P.z1 - P.z0);
          for (const x of [P.x0 + 3.5, P.x1 - 3.5]) {
            const ph = t * (show ? 2.2 : 0.8) + i * 0.6 + (x > P.x0 + 5 ? 1.7 : 0);
            const hgt = show ? 4 + 6 * Math.abs(Math.sin(ph)) : 1.2 + 0.4 * Math.sin(ph);
            // (arcs of water: in the show they sway over the pool, away from the walk)
            const lean = show ? Math.sin(t * 1.3 + i * 0.4) * 2.2 : 0.4;
            const pts = [];
            for (let k = 0; k <= 6; k++) {
              const s = k / 6;
              pts.push([x + lean * s, FY + 0.4 + hgt * (1 - Math.pow(1 - s, 2)) * (1 - (s > 0.85 ? (s - 0.85) * 2 : 0)), z + lean * 0.3 * s]);
            }
            const colr = show ? [0.75 + 0.25 * Math.sin(ph), 0.85, 1] : [0.8, 0.9, 1];
            for (let k = 0; k < pts.length - 1; k++) {
              const a = pts[k];
              const b = pts[k + 1];
              fr.lineXYZ(a[0], a[1], a[2], b[0], b[1], b[2], colr, show ? 3 : 2, id++, 0.75, 0.002, 0);
            }
          }
        }
      }
    }
    if (!this.inside) {
      if (night > 0.15 && dc < 120) this.outsideLights(night, inCam);
      return;
    }
    if (inCam || (dc < 34 && cam.y < FY + HT)) {
      const bodies = g.figures.bodies;
      const fwd = g.camera.getWorldDirection(_v);
      const far = g.touch ? 30 : 48;
      for (const w of this.crowd) {
        if (w.hide) continue;
        const dx = w.x - cam.x;
        const dz = w.z - cam.z;
        const dd = Math.hypot(dx, dz);
        if (dd > far || (dd > 3 && (dx * fwd.x + dz * fwd.z) / dd < -0.2)) continue;
        bodies.drawCheap(w);
      }
    }
    // the VIP rope, while it is closed: red velvet sagging between its posts
    if (!this.vip && this.ropeAt && Math.hypot(this.ropeAt[0] - cam.x, this.ropeAt[1] - cam.z) < 25) {
      const [x, zc] = this.ropeAt;
      const [za, zb] = PLAN.vip.gate;
      let prev = null;
      for (let k = 0; k <= 8; k++) {
        const s = k / 8;
        const pt = [x, F + 0.95 - Math.sin(s * Math.PI) * 0.18, za + (zb - za) * s];
        if (prev) fr.lineXYZ(prev[0], prev[1], prev[2], pt[0], pt[1], pt[2], [0.7, 0.05, 0.1], 5, 9500 + k, 1, 0.002, 0);
        prev = pt;
      }
      void zc;
    }
    if (inCam) {
      const ph = this.beat - Math.floor(this.beat);
      flashLight(X(16), FY + 6.2, Z(39), 14, _warm, 1.7);
      flashLight(X(16), FY + 3.4, Z(31), 10, _warm, 1.1);
      flashLight(X(16), FY + 3.4, Z(47), 10, _warm, 1.1);
      flashLight(X(16), FY + 4, Z(9), 13, _gold, 1.1);
      flashLight(X(19), FY + 3.6, Z(57), 9, _warm, 1.2);
      _spot.setHSL(0.92 + 0.08 * Math.sin(this.t * 0.3), 0.8, 0.6);
      flashLight(this.stageSpot[0], this.stageSpot[1] + 2.4, this.stageSpot[2] - 1.2, 7, _spot, 1.4 + 0.6 * Math.pow(1 - ph, 2));
      flashLight(X(6.5), FY + 3, Z(71.5), 9, _warm, 1.2);
      flashLight(X(31), FY + 3.4, CZ, 9, _white, 1.0);
    } else if (night > 0.15 && dc < 120) this.outsideLights(night, inCam);
  }

  outsideLights(night, inCam) {
    if (inCam) return;
    // the portico washed in warm light, the pools lit from under the water
    flashLight(XE + 6, FY + 2.5, CZ, 14, _warm, 1.6 * night);
    const show = this.showT;
    for (const [i, z] of [[0, Z0 + 18], [1, Z1 - 18]]) {
      if (show) _pool.setHSL((this.t * 0.05 + i * 0.5) % 1, 0.7, 0.6);
      else _pool.setRGB(0.55, 0.8, 1);
      flashLight(XE + 12, FY + 1.2, z, 13, _pool, (show ? 2.0 : 1.1) * night);
    }
  }

  // ------------------------------------------------------------------ what you can do there
  target() {
    if (!this.inside || (this.game.minigames && this.game.minigames.isOpen)) return null;
    const p = this.game.player.pos;
    if (!this.inHall(p.x, p.z, p.y)) return null;
    const near = (s, r) => Math.hypot(p.x - s[0], p.z - s[2]) < r;
    for (const s of this.slots) if (near(s.stand, 0.5)) return { kind: 'slot', s, label: 'E — לשבת ליד מכונת המזל INK FORTUNE' };
    for (const t of this.tables) {
      if (near(t.seats[1], t.kind === 'blackjack' ? 0.75 : 1.1)) {
        if (t.vip && !this.vip) return { kind: 'novip', label: 'E — שולחן VIP: צריך כרטיס VIP מהקופה' };
        return { kind: t.kind, t, label: t.kind === 'blackjack' ? `E — לשבת לשולחן הבלאק ג׳ק${t.vip ? ' (VIP, מ־$100)' : ' ($5–$100)'}` : `E — לשחק רולטה${t.vip ? ' (VIP, צ׳יפים של $25 ומעלה)' : ''}` };
      }
    }
    const C = PLAN.cage;
    if (p.x > C.x0 && p.x < C.x1 && p.z > C.z1 && p.z < C.z1 + 1.4) return { kind: 'cage', label: 'E — הקופה (THE CAGE)' };
    const B = PLAN.bar;
    if (p.x > B.x0 - 0.2 && p.x < B.x1 + 0.2 && ((p.z > B.z0 - 1.4 && p.z < B.z0) || (p.z > B.z1 && p.z < B.z1 + 1.4))) return { kind: 'bar', label: 'E — THE INKWELL BAR' };
    if (Math.hypot(p.x - this.ropeAt[0] - 0.6, p.z - this.ropeAt[1]) < 1.6 && !this.vip) return { kind: 'rope', label: 'E — חדר ה־VIP' };
    return null;
  }

  interact() {
    const tg = this.target();
    if (!tg) return false;
    const g = this.game;
    const back = (st, n) => [st[0] + n[0] * 0.3, st[2] + n[1] * 0.3, Math.atan2(-n[0], -n[1])];
    if (tg.kind === 'slot') {
      if (!g.minigames) return true;
      const s = tg.s;
      const S = s.screen;
      // (seated on its stool, 0.7 high: you a little up, the camera with you)
      const world = worldAt({ at: S.at, n: s.n, w: S.w, h: S.h, stand: 0.77, y0: F + 0.24, back: 0.42, up: 1.56, camSide: 0.36, fov: 42, hands: s.hands, sit: true, glow: 1.0, exit: back(s.stand, s.n) });
      this.play(s, new SlotGame({ name: 'INK FORTUNE' }), world, (r) => this.report(r, 'INK FORTUNE'));
      return true;
    }
    if (tg.kind === 'blackjack' || tg.kind === 'roulette') {
      if (!g.minigames) return true;
      const t = tg.t;
      const S = t.surface;
      const bj = t.kind === 'blackjack';
      const seat = t.seats[1];
      const d = Math.hypot(seat[0] - S.at[0], seat[2] - S.at[2]);
      // (the camera over your right shoulder, high, the felt below it; your hands on the felt's edge)
      const [nx, nz] = t.n;
      const ex = S.at[0] + nx * (S.h / 2 - 0.12);
      const ez = S.at[2] + nz * (S.h / 2 - 0.12);
      const hands = [[ex - nz * 0.2, S.at[1] + 0.03, ez + nx * 0.2], [ex + nz * 0.2, S.at[1] + 0.03, ez - nx * 0.2]];
      const world = worldAt({ at: S.at, n: t.n, w: S.w, h: S.h, flat: true, stand: d, y0: bj ? F + 0.28 : F, back: bj ? 0.14 : 0.38, up: bj ? 2.05 : 2.2, camSide: bj ? 0.34 : 0, fov: bj ? 58 : 60, lookIn: 0.12, sit: bj, glow: 0.8, hands, exit: back(seat, t.n) });
      if (!bj) world.stand = [seat[0], seat[2], Math.atan2(-t.n[0], -t.n[1]), F];
      const mod = bj ? new Blackjack({ name: t.vip ? 'HIGH LIMIT BLACKJACK' : 'BLACKJACK', vip: t.vip }) : new Roulette({ name: t.vip ? 'HIGH LIMIT ROULETTE' : 'ROULETTE', vip: t.vip });
      this.play(t, mod, world, (r) => this.report(r, bj ? 'BLACKJACK' : 'ROULETTE'));
      return true;
    }
    if (tg.kind === 'novip') {
      g.hud.toast('השולחנות האלה ל־VIP בלבד. כרטיס VIP קונים בקופה (THE CAGE) ליד הכניסה', 'info', 3.5);
      return true;
    }
    if (tg.kind === 'rope') {
      g.dialog.show('VIP', this.vip ? 'Welcome back.' : 'Members only. A VIP card from the cage, and the rope is yours.', [{ label: 'בסדר', fn: () => {} }]);
      return true;
    }
    if (tg.kind === 'cage') {
      const opts = [];
      if (!this.vip) {
        opts.push({
          label: 'כרטיס VIP: כניסה לחדר ה־VIP ולשולחנות ההימורים הגבוהים · $250',
          fn: () => {
            if (!g.money || g.money.pay(250, 'VIP')) {
              this.vip = true;
              save(VIP_KEY, true);
              if (this.ropeCol !== null && this.ropeCol !== undefined) g.world.collision.remove(this.ropeCol);
              this.ropeCol = null;
              g.audio.play('coins', 0.6);
              g.hud.toast('יש לכם כרטיס VIP! החבל בכניסה לחדר ה־VIP נפתח בשבילכם', 'good', 3.5);
            } else g.money.refuse('THE CAGE', 250);
          },
        });
      }
      const net = this.net || 0;
      opts.push({ label: net >= 0 ? `הערב אתם ברווח: $${net}` : `הערב אתם בהפסד: $${-net}`, fn: () => {} });
      g.dialog.show('THE CAGE', 'Cash is king here: you play with your own. Anything else?', opts);
      return true;
    }
    if (tg.kind === 'bar') {
      const menu = [['מרטיני עם זית (+15 חיים)', 12, 15, [0.9, 0.95, 0.8]], ['שמפניה (+15 חיים)', 18, 15, [1, 0.95, 0.7]], ['מוחיטו (+10 חיים)', 9, 10, [0.7, 1, 0.6]], ['מים מינרליים (+5 חיים)', 3, 5, [0.85, 0.95, 1]]];
      g.dialog.show('THE INKWELL BAR', 'Feeling lucky tonight? What will it be?', menu.map(([label, price, hp, colr]) => ({
        label: `${label} · $${price}`,
        fn: () => {
          if (!g.money || g.money.pay(price, label)) {
            const pl = g.player;
            pl.hp = Math.min(pl.maxHp, pl.hp + hp);
            pl.fig.belly = Math.min(1, pl.fig.belly + 0.15);
            pl.fig.bellyColor = colr;
            g.audio.play('coins', 0.5);
            g.hud.toast(`${label.split(' (')[0]}! +${hp} חיים`, 'good', 2);
          } else g.money.refuse('THE INKWELL BAR', price);
        },
      })));
      return true;
    }
    return false;
  }

  play(m, mod, world, cb) {
    const g = this.game;
    if (m.busy) m.busy.hide = true;
    g.minigames.play(mod, (r) => {
      if (m.busy) m.busy.hide = false;
      cb(r || {});
    }, { world });
  }

  // what a game came to: the evening's sum kept for the cage
  report(r, name) {
    const n = (r && r.net) || 0;
    this.net = (this.net || 0) + n;
    if (!r || (!r.spins && !r.hands)) return;
    const g = this.game;
    if (n > 0) g.hud.toast(`${name}: יצאתם ברווח של $${n}!`, 'good', 3);
    else if (n < 0) g.hud.toast(`${name}: הפסדתם $${-n}. הבית תמיד מנצח… בסוף`, 'info', 3);
    else g.hud.toast(`${name}: יצאתם בלי רווח ובלי הפסד`, 'info', 2.5);
  }
}

function load(k, d) {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v === null || v === undefined ? d : v;
  } catch (e) {
    return d;
  }
}

function save(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {
    // (no room)
  }
}

const _v = new THREE.Vector3();
const _warm = new THREE.Color(1, 0.82, 0.55);
const _gold = new THREE.Color(1, 0.75, 0.4);
const _white = new THREE.Color(1, 0.95, 0.88);
const _spot = new THREE.Color();
const _pool = new THREE.Color();
