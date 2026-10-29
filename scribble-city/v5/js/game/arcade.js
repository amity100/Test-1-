import * as THREE from 'three';
import { Kit, itemMats, linC } from './items.js';
import { clubMats, neonWord, pixelArt, chaser, pictureGeo, merged } from './venuekit.js';
import { upright, racer, pinball, hockey, clawBox, skee, hoops, danceMachine, frame } from './arcadebuild.js';
import { paintCarpet, paintMural, paintMarquees, paintPrizes, paintMenu, paintBoard, paintPinball, paintBeatIdle } from './arcadeart.js';
import { flashLight, makeSurface, canvasTexture } from '../render/materials.js';
import { CURB, M_BLOCKS } from '../world/mainland/plan.js';
import { ARCADE } from '../world/mainland/halls.js';
import { worldAt } from '../ui/minigame.js';
import { patronLook, kidLook, bartenderLook } from './looks.js';
import { Band, makeSong } from '../core/music.js';
import { DanceGame } from './minigames/dance.js';
import { InkInvaders } from './minigames/arcade/invaders.js';
import { PenMan } from './minigames/arcade/penman.js';
import { InkTris } from './minigames/arcade/inktris.js';
import { DoodleSnake } from './minigames/arcade/snake.js';
import { PaperPong } from './minigames/arcade/pong.js';
import { BrickSketch } from './minigames/arcade/bricks.js';
import { InkRally } from './minigames/arcade/rally.js';
import { AirHockey, paintTable } from './minigames/arcade/hockey.js';
import { ClawGame } from './minigames/arcade/claw.js';
import { chip, bestOf } from './minigames/arcade/cab.js';

// (v5, ROADMAP 12.7) INK ARCADE, on Inkwood Boulevard: a hall 32 by 52 metres of games, its face to
// the avenue - the name in neon over a canopy of chasing bulbs, a giant joystick on the roof, the
// games' posters lit beside the doors. Inside, dark and loud: forty upright cabinets in rows and an
// island, the racers along the west wall, the dance machine, the pinballs, the air hockey tables,
// the claw machines, skee-ball and hoops, the prize counter, the pizza bar, the hall of fame -
// the carpet glowing under the black light, a sunset round the walls, the lights sweeping the floor.
// Every cabinet's screen is its game playing (a demo, the game itself playing itself); at one, you
// play it - on its screen, in the hall, the camera over your shoulder (ui/minigame.js world mode).
// What the games pay out in tickets the counter turns into prizes, kept for your home (12.14).

const A = ARCADE;
const XW = A.xw;
const XE = A.xe;
const Z0 = A.z0;
const Z1 = A.z1;
const CZ = A.cz;
const HT = A.h;
const FY = CURB + 0.012;
const F = FY + 0.015;
const X = (u) => XW + u;
const Z = (v) => Z0 + v;
const DOOR = { z0: CZ - 3.5, z1: CZ + 3.5, h: 3.2 };
const BLOCK = M_BLOCKS.find((b) => b.col === A.col && b.row === A.row);
const NEAR_IN = 120;
const TICKETS = 'scribble-city-v5-tickets';
const PRIZES = 'scribble-city-v5-prizes';
export const ARCADE_AT = { x: XE + 4, z: CZ };

const GAMES = {
  invaders: { cls: InkInvaders, name: 'INK INVADERS', he: 'INK INVADERS', col: [0.1, 0.55, 0.85] },
  penman: { cls: PenMan, name: 'PEN-MAN', he: 'PEN-MAN', col: [0.95, 0.75, 0.1] },
  inktris: { cls: InkTris, name: 'INKTRIS', he: 'INKTRIS', col: [0.55, 0.25, 0.9] },
  snake: { cls: DoodleSnake, name: 'DOODLE SNAKE', he: 'DOODLE SNAKE', col: [0.15, 0.75, 0.3] },
  pong: { cls: PaperPong, name: 'PAPER PONG', he: 'PAPER PONG', col: [0.85, 0.85, 0.9] },
  bricks: { cls: BrickSketch, name: 'BRICK SKETCH', he: 'BRICK SKETCH', col: [0.95, 0.45, 0.12] },
  rally: { cls: InkRally, name: 'INK RALLY', he: 'INK RALLY', col: [0.9, 0.15, 0.45] },
};
const ROW = ['invaders', 'penman', 'inktris', 'snake', 'pong', 'bricks'];
// the demo screens: a cell each in one picture (4 across, 3 down)
const CELLS = ['invaders', 'penman', 'inktris', 'snake', 'pong', 'bricks', 'rally', 'beat'];

// ------------------------------------------------------------------ where everything stands
// (u: metres in from the west wall, v: in from the north wall; n: the way to whoever plays it)
export const PLAN = (() => {
  const cabs = [];
  for (let i = 0; i < 16; i++) cabs.push({ x: X(3.2 + i * 1.15), z: Z(0.75), n: [0, 1], game: ROW[i % 6] });
  for (let i = 0; i < 12; i++) {
    cabs.push({ x: X(6.2 + i * 1.15), z: Z(9.55), n: [0, -1], game: ROW[(i + 2) % 6] });
    cabs.push({ x: X(6.2 + i * 1.15), z: Z(10.45), n: [0, 1], game: ROW[(i + 4) % 6] });
  }
  const racers = [];
  for (let k = 0; k < 4; k++) racers.push({ x: X(1.3), z: Z(4.6 + k * 3.6), n: [1, 0] });
  const pins = [];
  for (let k = 0; k < 6; k++) pins.push({ x: X(6.6 + k * 2.2), z: Z(16.6), n: [0, 1] });
  const tables = [{ x: X(9.5), z: Z(35), n: [1, 0] }, { x: X(17.5), z: Z(35), n: [1, 0] }];
  const claws = [];
  for (let k = 0; k < 4; k++) claws.push({ x: X(31.05), z: Z(32.6 + k * 1.2), n: [-1, 0], i: k });
  const skees = [];
  for (let k = 0; k < 4; k++) skees.push({ x: X(2.1), z: Z(31.6 + k * 1.05), n: [1, 0] });
  const hoopsAt = [{ x: X(1.8), z: Z(41.5), n: [1, 0] }, { x: X(1.8), z: Z(44.2), n: [1, 0] }];
  return {
    cabs,
    racers,
    pins,
    tables,
    claws,
    skees,
    hoops: hoopsAt,
    dance: { x: X(27.4), z: Z(0.55), n: [0, 1] },
    counter: { x0: X(8.5), x1: X(23.5), z0: Z(47.3), z1: Z(48.1) },
    pizza: { x0: X(25.6), x1: X(31.65), z0: Z(45.3), z1: Z(46.1) },
    booth: { x: X(31.0), z: Z(38.6) },
    kiosk: { x: X(30.9), z: Z(19.4) },
    seats: [[X(23.4), Z(40.6)], [X(26.8), Z(40.6)]],
    board: { x: X(0.36), z: CZ, w: 4.6, h: 2.3, y: F + 2.75 },
  };
})();

export class Arcade {
  constructor(game) {
    this.game = game;
    this.shell = null;
    this.inside = null;
    this.cols = [];
    this.inCols = [];
    this.crowd = [];
    this.t = 0;
    this.tickets = load(TICKETS, 0);
    this.demos = null;
    this.playing = null;
  }

  // ------------------------------------------------------------------ the hall: its walls, its face
  buildShell() {
    const g = this.game;
    const M = itemMats();
    const CM = clubMats();
    const K = new Kit();
    const col = g.world.collision;
    const OUT = linC(0.11, 0.06, 0.18);
    const TRIM = linC(0.05, 0.03, 0.08);
    const PINK = linC(1, 0.25, 0.62);
    const CYAN = linC(0.25, 0.92, 1);
    const YEL = linC(1, 0.86, 0.25);
    const T = 0.3;
    // the walls (the east one round its doors), the roof, the parapet's lit edge
    const wall = (x0, z0, x1, z1, y0 = 0, y1 = HT) => {
      K.box(M.matte, x0, FY + y0, z0, x1, FY + y1, z1, OUT);
      if (y0 === 0) this.cols.push(col.addBox(x0, z0, x1, z1, -1, HT + 0.3, 'wall'));
    };
    wall(XW, Z0, XE, Z0 + T);
    wall(XW, Z1 - T, XE, Z1);
    wall(XW, Z0, XW + T, Z1);
    wall(XE - T, Z0, XE, DOOR.z0);
    wall(XE - T, DOOR.z1, XE, Z1);
    wall(XE - T, DOOR.z0, XE, DOOR.z1, DOOR.h, HT);
    K.box(M.matte, XW - 0.1, FY + HT, Z0 - 0.1, XE + 0.1, FY + HT + 0.3, Z1 + 0.1, TRIM);
    K.box(M.glow, XE + 0.08, FY + HT + 0.12, Z0 - 0.1, XE + 0.14, FY + HT + 0.22, Z1 + 0.1, CYAN);
    for (const z of [Z0 - 0.02, Z1 + 0.02]) K.box(M.glow, XE - 0.14, FY + 0.4, z - 0.04, XE + 0.02, FY + HT, z + 0.04, PINK);
    // (the roof, walkable, for whoever lands a helicopter on it)
    this.cols.push(col.addBox(XW, Z0, XE, Z1, HT - 0.1, HT + 0.3, 'roof'));
    // the doors: chrome frames, the glass over them, a mat of light before them
    for (const z of [DOOR.z0, DOOR.z1]) K.box(M.metal, XE - 0.34, FY, z - 0.08, XE + 0.04, FY + DOOR.h, z + 0.08, linC(0.75, 0.78, 0.85));
    K.box(M.metal, XE - 0.34, FY + DOOR.h - 0.12, DOOR.z0, XE + 0.04, FY + DOOR.h, DOOR.z1, linC(0.75, 0.78, 0.85));
    for (const s of [-1, 1]) K.box(M.glass, XE - 0.2, FY + 0.05, s < 0 ? DOOR.z0 + 0.08 : DOOR.z1 - 0.95, XE - 0.16, FY + DOOR.h - 0.12, s < 0 ? DOOR.z0 + 0.95 : DOOR.z1 - 0.08, linC(0.1, 0.12, 0.2));
    K.box(M.glow, XE + 0.2, FY + 0.005, DOOR.z0 + 0.4, XE + 2.4, FY + 0.02, DOOR.z1 - 0.4, linC(0.5, 0.12, 0.45));
    // the canopy over the doors: its lit edge, the bulbs under it (they chase: chaser())
    const cx1 = XE + 2.8;
    K.box(M.matte, XE, FY + 3.3, CZ - 5.2, cx1, FY + 3.75, CZ + 5.2, TRIM);
    K.box(M.glow, cx1, FY + 3.36, CZ - 5.2, cx1 + 0.05, FY + 3.68, CZ + 5.2, PINK);
    for (const z of [CZ - 5.2, CZ + 5.2]) K.box(M.glow, XE, FY + 3.36, z - 0.03, cx1, FY + 3.68, z + 0.03, PINK);
    const bulbs = [];
    for (let z = CZ - 5; z <= CZ + 5.01; z += 0.33) bulbs.push([cx1 - 0.12, FY + 3.25, z]);
    for (let x = XE + 0.3; x < cx1 - 0.2; x += 0.33) for (const z of [CZ - 5.0, CZ + 5.0]) bulbs.push([x, FY + 3.25, z]);
    for (let z = CZ - 4.4; z <= CZ + 4.41; z += 0.55) for (const x of [XE + 0.8, XE + 1.8]) bulbs.push([x, FY + 3.27, z]);
    // the name: big, in two colours, on its board with a lit edge
    K.box(M.matte, XE, FY + 3.95, CZ - 8.2, XE + 0.12, FY + 6.75, CZ + 8.2, linC(0.06, 0.03, 0.1));
    for (const [y0, y1, z0, z1] of [[3.95, 4.03, CZ - 8.2, CZ + 8.2], [6.67, 6.75, CZ - 8.2, CZ + 8.2], [3.95, 6.75, CZ - 8.2, CZ - 8.12], [3.95, 6.75, CZ + 8.12, CZ + 8.2]]) K.box(M.glow, XE + 0.12, FY + y0, z0, XE + 0.17, FY + y1, z1, CYAN);
    const h = 1.6;
    const cell = h / 7;
    const total = (10 * 6 - 1) * cell;
    const zl = CZ + total / 2;
    neonWord(K, M.glow, 'INK', h, XE + 0.12, FY + 4.55, zl - (17 * cell) / 2, 1, 0, PINK, 0.02, 0.08);
    neonWord(K, M.glow, 'ARCADE', h, XE + 0.12, FY + 4.55, zl - 24 * cell - (35 * cell) / 2, 1, 0, CYAN, 0.02, 0.08);
    neonWord(K, M.glow, 'GAMES · PRIZES · PIZZA', 0.34, XE + 0.12, FY + 4.12, CZ, 1, 0, YEL, 0.02, 0.05);
    // the characters of the games, in squares of light, either side of the name
    const BLOT = ['..XXXX..', '.XXXXXX.', 'XXOXXOXX', 'XXXXXXXX', 'XXXXXXXX', 'XX.XX.XX', 'X..X...X'];
    const PEN = ['..YYYY..', '.YYYYYY.', 'YYYYY...', 'YYYY....', 'YYYYY...', '.YYYYYY.', '..YYYY..'];
    const ERASE = ['.PPPPPP.', 'PPPPPPPP', 'PWWPPWWP', 'PPPPPPPP', 'BBBBBBBB', 'BBBBBBBB'];
    const pal = { X: linC(0.6, 0.3, 1), O: linC(1, 1, 1), Y: YEL, P: PINK, W: linC(1, 1, 1), B: linC(0.3, 0.5, 1) };
    pixelArt(K, M.glow, BLOT, pal, 0.24, XE, FY + 4.4, CZ + 11.2, 1, 0);
    pixelArt(K, M.glow, PEN, pal, 0.24, XE, FY + 4.4, CZ - 10.6, 1, 0);
    pixelArt(K, M.glow, ERASE, pal, 0.24, XE, FY + 4.5, CZ - 13.6, 1, 0);
    // the posters beside the doors: light boxes (their pictures the games playing, the hall's)
    this.posters = [];
    for (const [z, cell2] of [[CZ - 6.2, 'invaders'], [CZ - 9.6, 'rally'], [CZ + 6.2, 'penman'], [CZ + 9.6, 'inktris']]) {
      K.box(M.matte, XE, FY + 0.9, z - 1.42, XE + 0.14, FY + 2.68, z + 1.42, TRIM);
      for (const [y0, y1, z0, z1] of [[0.9, 0.96, z - 1.42, z + 1.42], [2.62, 2.68, z - 1.42, z + 1.42], [0.9, 2.68, z - 1.42, z - 1.36], [0.9, 2.68, z + 1.36, z + 1.42]]) K.box(M.glow, XE + 0.14, FY + y0, z0, XE + 0.18, FY + y1, z1, YEL);
      this.posters.push({ x: XE + 0.15, y: FY + 1.79, z, cell: cell2 });
    }
    // the rest of the face: four more posters further out, the lit columns between, the games'
    // characters high over them, a ticket and the hours in neon
    for (const [z, cell2] of [[CZ - 15.2, 'snake'], [CZ - 19.6, 'bricks'], [CZ + 15.2, 'pong'], [CZ + 19.6, 'beat']]) {
      K.box(M.matte, XE, FY + 0.9, z - 1.42, XE + 0.14, FY + 2.68, z + 1.42, TRIM);
      for (const [y0, y1, z0, z1] of [[0.9, 0.96, z - 1.42, z + 1.42], [2.62, 2.68, z - 1.42, z + 1.42], [0.9, 2.68, z - 1.42, z - 1.36], [0.9, 2.68, z + 1.36, z + 1.42]]) K.box(M.glow, XE + 0.14, FY + y0, z0, XE + 0.18, FY + y1, z1, z < CZ ? CYAN : PINK);
      this.posters.push({ x: XE + 0.15, y: FY + 1.79, z, cell: cell2 });
    }
    [-12.4, -17.4, -22, 12.4, 17.4, 22].forEach((dz, i) => K.box(M.glow, XE + 0.02, FY + 0.3, CZ + dz - 0.07, XE + 0.1, FY + HT - 0.2, CZ + dz + 0.07, i % 2 ? CYAN : PINK));
    const PLANE = ['......WW', '....WWWC', '..WWWWCC', 'WWWWWCC.', '..CCCC..', '....CC..'];
    const SNAKE = ['GGGGGG..', 'G....G..', 'G.GGGG..', 'G.G.....', 'GGG..RR.', '.....RR.'];
    const pal2 = { ...pal, C: CYAN, G: linC(0.4, 1, 0.45), R: linC(1, 0.25, 0.3) };
    pixelArt(K, M.glow, PLANE, pal2, 0.3, XE, FY + 4.3, CZ - 19.7, 1, 0);
    pixelArt(K, M.glow, SNAKE, pal2, 0.3, XE, FY + 4.3, CZ + 19.7, 1, 0);
    pixelArt(K, M.glow, BLOT, pal, 0.3, XE, FY + 4.3, CZ + 15.0, 1, 0);
    neonWord(K, M.glow, 'OPEN LATE', 0.55, XE + 0.02, FY + 3.2, CZ - 19.7, 1, 0, YEL, 0.02, 0.05);
    neonWord(K, M.glow, 'TICKETS', 0.55, XE + 0.02, FY + 3.2, CZ + 19.7, 1, 0, YEL, 0.02, 0.05);
    // the joystick on the roof, and its two buttons
    const jx = XE - 5;
    const jz = CZ - 12;
    K.box(M.matte, jx - 1.8, FY + HT + 0.3, jz - 1.8, jx + 1.8, FY + HT + 1.1, jz + 1.8, linC(0.06, 0.05, 0.08));
    K.box(M.glow, jx - 1.84, FY + HT + 1.0, jz - 1.84, jx + 1.84, FY + HT + 1.08, jz + 1.84, PINK);
    K.cyl(M.metal, 0.5, 0.42, FY + HT + 1.1, FY + HT + 1.5, linC(0.1, 0.1, 0.12), { axis: 'y', x: jx, z: jz, segs: 16 });
    K.cyl(M.metal, 0.3, 0.3, FY + HT + 1.5, FY + HT + 5.4, linC(0.75, 0.78, 0.85), { axis: 'y', x: jx, z: jz, segs: 14 });
    K.sphere(M.paint, 1.35, jx, FY + HT + 6.4, jz, linC(0.92, 0.06, 0.12), 1, 1, 1, 20);
    for (const [bz, c] of [[jz + 4.2, YEL], [jz + 6.8, CYAN]]) {
      K.cyl(M.matte, 1.05, 1.05, FY + HT + 0.3, FY + HT + 0.7, linC(0.06, 0.05, 0.08), { axis: 'y', x: jx, z: bz, segs: 20 });
      K.cyl(M.glow, 0.85, 0.85, FY + HT + 0.7, FY + HT + 1.05, c, { axis: 'y', x: jx, z: bz, segs: 20 });
    }
    // inside: the lining of the walls, dark, a line of light along their foot and their middle;
    // the ceiling, black
    const LIN = linC(0.07, 0.04, 0.12);
    for (const [x0, z0, x1, z1] of [[XW + T, Z0 + T, XE - T, Z0 + T + 0.04], [XW + T, Z1 - T - 0.04, XE - T, Z1 - T], [XW + T, Z0 + T, XW + T + 0.04, Z1 - T], [XE - T - 0.04, Z0 + T, XE - T, DOOR.z0], [XE - T - 0.04, DOOR.z1, XE - T, Z1 - T]]) {
      // (to the band of sunset only: over it the band itself, its own distance from the wall)
      K.box(CM.matte, x0, F, z0, x1, F + 2.5, z1, LIN);
      const ex = x1 - x0 < 0.1;
      for (const [ya, yb, c] of [[0.02, 0.1, CYAN], [2.36, 2.44, PINK]]) {
        if (ex) K.box(M.glow, x0 - 0.01, F + ya, z0, x1 + 0.01, F + yb, z1, c);
        else K.box(M.glow, x0, F + ya, z0 - 0.01, x1, F + yb, z1 + 0.01, c);
      }
    }
    K.box(CM.matte, XW + T, FY + HT - 0.08, Z0 + T, XE - T, FY + HT - 0.02, Z1 - T, linC(0.03, 0.02, 0.05));
    const group = K.build({ seed: 0.31 });
    for (const m of chaser(M, bulbs, 0.07, linC(1, 0.85, 0.45))) {
      group.add(m);
      (this.chase = this.chase || []).push(m);
    }
    group.updateMatrix();
    g.scene.add(group);
    this.shell = group;
    // (the still city's: it casts its shadow, and the rain stops at its roof - render/rain.js)
    const ml = g.world.mainland;
    for (const m of group.children) if (m !== this.chase[0] && m !== this.chase[1]) m.userData.dynamic = false;
    if (ml && ml.pipe) ml.pipe.addStatic(group);
    g.world.roofVer = (g.world.roofVer || 0) + 1;
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
    for (const id of this.cols) g.world.collision.remove(id);
    this.cols = [];
    this.shell = null;
    this.chase = null;
  }

  // ------------------------------------------------------------------ inside
  buildInside() {
    const g = this.game;
    const CM = clubMats();
    const K = new Kit();
    const col = g.world.collision;
    const touch = g.touch;
    const P = PLAN;
    const ids = (this.inCols = []);
    const prop = (x0, z0, x1, z1, h = 2) => ids.push(col.addBox(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), -1, h, 'prop'));
    const box2 = (x, z, n, hw, d0, d1) => {
      // (a machine's ground, in the world: across hw either side, d0..d1 out of its front)
      const [ax, az] = [x + n[1] * -hw + n[0] * d0, z - n[0] * -hw + n[1] * d0];
      const [bx, bz] = [x + n[1] * hw + n[0] * d1, z - n[0] * hw + n[1] * d1];
      return [ax, az, bx, bz];
    };
    const PINK = linC(1, 0.25, 0.62);
    const CYAN = linC(0.25, 0.92, 1);
    const YEL = linC(1, 0.86, 0.25);
    const VIO = linC(0.6, 0.35, 1);
    const LITS = [PINK, CYAN, YEL, linC(0.4, 1, 0.45), VIO, linC(1, 0.55, 0.2)];
    const shown = []; // [mesh-maker] pictures to add once the kit is built
    // the cabinets
    this.cabs = P.cabs.map((c, i) => {
      const G = GAMES[c.game];
      const r = upright(K, CM, c.x, c.z, F, c.n[0], c.n[1], linC(...G.col), LITS[i % LITS.length]);
      prop(...box2(c.x, c.z, c.n, 0.4, -0.42, 0.44));
      shown.push({ kind: 'screen', cell: c.game, ...r.screen, n: c.n });
      shown.push({ kind: 'marquee', name: G.name, ...r.marquee, n: c.n });
      return { ...c, ...r, kind: 'cab' };
    });
    this.racers = P.racers.map((c, i) => {
      const r = racer(K, CM, c.x, c.z, F, c.n[0], c.n[1], linC(0.85, 0.1, 0.35), LITS[(i + 1) % LITS.length]);
      prop(...box2(c.x, c.z, c.n, 0.74, -0.95, 0.3), 2.3);
      prop(...box2(c.x, c.z, c.n, 0.32, 0.6, 1.14), 1.2);
      shown.push({ kind: 'screen', cell: 'rally', ...r.screen, n: c.n });
      shown.push({ kind: 'marquee', name: 'INK RALLY', ...r.marquee, n: c.n });
      return { ...c, ...r, kind: 'racer', game: 'rally' };
    });
    this.pins = P.pins.map((c, i) => {
      const r = pinball(K, CM, c.x, c.z, F, c.n[0], c.n[1], linC(0.2, 0.1, 0.5), LITS[(i + 2) % LITS.length]);
      prop(...box2(c.x, c.z, c.n, 0.38, -0.8, 0.72), 1.9);
      shown.push({ kind: 'pinfield', ...r.field, n: c.n });
      shown.push({ kind: 'marquee', name: 'INK WIZARD', at: r.head.at, w: r.head.w, h: 0.24, n: c.n });
      return { ...c, ...r };
    });
    this.tables = P.tables.map((c) => {
      const r = hockey(K, CM, c.x, c.z, F, c.n[0], c.n[1], PINK);
      prop(...box2(c.x, c.z, c.n, 0.64, -1.1, 1.1), 0.9);
      return { ...c, ...r, kind: 'hockey' };
    });
    this.claws = P.claws.map((c, i) => {
      const r = clawBox(K, CM, c.x, c.z, F, c.n[0], c.n[1], [linC(0.95, 0.3, 0.6), linC(0.2, 0.7, 0.95), linC(0.95, 0.75, 0.2), linC(0.5, 0.3, 0.95)][i], LITS[i % LITS.length]);
      prop(...box2(c.x, c.z, c.n, 0.48, -0.48, 0.66), 2.3);
      shown.push({ kind: 'marquee', name: 'CLAW-SOME', ...r.marquee, n: c.n });
      return { ...c, ...r, kind: 'claw' };
    });
    for (const c of P.skees) {
      const r = skee(K, CM, c.x, c.z, F, c.n[0], c.n[1], linC(0.25, 0.12, 0.45), CYAN);
      prop(...box2(c.x, c.z, c.n, 0.44, -1.72, 1.62), 1.5);
      shown.push({ kind: 'marquee', name: 'SKEE-INK', ...r.marquee, n: c.n });
      c.stand = r.stand;
    }
    for (const c of P.hoops) {
      const r = hoops(K, CM, c.x, c.z, F, c.n[0], c.n[1], linC(0.1, 0.35, 0.6), YEL);
      prop(...box2(c.x, c.z, c.n, 0.57, -1.42, 1.02), 2.5);
      shown.push({ kind: 'marquee', name: 'HOOP DREAMS', ...r.marquee, n: c.n });
      c.stand = r.stand;
    }
    {
      const c = P.dance;
      const r = danceMachine(K, CM, c.x, c.z, F, c.n[0], c.n[1], linC(0.12, 0.06, 0.22), PINK);
      prop(...box2(c.x, c.z, c.n, 1.92, -0.5, 0.36), 3.3);
      shown.push({ kind: 'screen', cell: 'beat', ...r.screen, n: c.n });
      shown.push({ kind: 'marquee', name: 'INK BEAT', ...r.marquee, n: c.n });
      this.dance = { ...c, ...r, kind: 'dance' };
    }
    // the prize counter: its glass case lit, the wall of prizes behind it, the name over it
    {
      const C = P.counter;
      K.box(CM.matte, C.x0, F, C.z0, C.x1, F + 1.0, C.z1, linC(0.1, 0.05, 0.16));
      K.box(CM.glow, C.x0, F + 0.3, C.z0 - 0.01, C.x1, F + 0.86, C.z0, linC(0.55, 0.3, 0.75));
      K.box(CM.paint, C.x0 - 0.02, F + 1.0, C.z0 - 0.02, C.x1 + 0.02, F + 1.06, C.z1 + 0.02, linC(0.85, 0.85, 0.9));
      K.box(CM.glow, C.x0, F + 0.02, C.z0 - 0.02, C.x1, F + 0.08, C.z0, PINK);
      for (let k = 0, x = C.x0 + 0.6; x < C.x1 - 0.4; x += 0.9, k++) K.sphere(CM.paint, 0.11, x, F + 0.55, (C.z0 + C.z1) / 2, LITS[k % LITS.length], 1, 0.9, 1, 10);
      prop(C.x0, C.z0, C.x1, C.z1, 1.1);
      shown.push({ kind: 'prizes', x: (C.x0 + C.x1) / 2, y: F + 2.4, z: Z(51.6), w: C.x1 - C.x0 + 1, h: 3.4 });
      neonWord(K, CM.glow, 'PRIZES', 0.9, (C.x0 + C.x1) / 2, F + 4.3, Z(51.62), 0, -1, YEL, 0.02, 0.06);
      // (shelves of big soft toys at its ends)
      [C.x0 - 0.5, C.x1 + 0.5].forEach((x, j) => {
        for (let k = 0; k < 3; k++) K.sphere(CM.paint, 0.32, x, F + 0.35 + k * 0.62, Z(51.1), LITS[(k + j * 2) % LITS.length], 1, 1, 0.9, 12);
      });
    }
    // the pizza bar
    {
      const C = P.pizza;
      K.box(CM.matte, C.x0, F, C.z0, C.x1, F + 1.05, C.z1, linC(0.35, 0.12, 0.05));
      K.box(CM.paint, C.x0 - 0.02, F + 1.05, C.z0 - 0.06, C.x1, F + 1.1, C.z1, linC(0.92, 0.9, 0.85));
      K.box(CM.glow, C.x0, F + 0.9, C.z0 - 0.01, C.x1, F + 0.96, C.z0, linC(1, 0.55, 0.2));
      K.box(CM.metal, C.x0 + 0.4, F + 1.1, Z(50.6), C.x0 + 2.2, F + 2.2, Z(51.6), linC(0.6, 0.6, 0.65));
      K.box(CM.glow, C.x0 + 0.6, F + 1.3, Z(50.58), C.x0 + 2.0, F + 1.8, Z(50.6), linC(1, 0.45, 0.15));
      prop(C.x0, C.z0, C.x1, C.z1, 1.1);
      for (let k = 0; k < 4; k++) {
        const x = C.x0 + 0.8 + k * 1.4;
        K.cyl(CM.metal, 0.03, 0.03, F, F + 0.7, linC(0.7, 0.7, 0.75), { axis: 'y', x, z: C.z0 - 0.55, segs: 6 });
        K.cyl(CM.paint, 0.2, 0.2, F + 0.7, F + 0.78, PINK, { axis: 'y', x, z: C.z0 - 0.55, segs: 12 });
      }
      shown.push({ kind: 'menu', x: (C.x0 + C.x1) / 2, y: F + 2.9, z: Z(51.62), w: 4.2, h: 2.1 });
      // the tables before it
      for (const [x, z] of P.seats) {
        K.cyl(CM.metal, 0.04, 0.04, F, F + 0.74, linC(0.7, 0.7, 0.75), { axis: 'y', x, z, segs: 6 });
        K.cyl(CM.paint, 0.5, 0.5, F + 0.74, F + 0.78, linC(0.2, 0.75, 0.9), { axis: 'y', x, z, segs: 16 });
        prop(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0.8);
        for (const a of [0, Math.PI]) {
          const sx = x + Math.cos(a) * 0.85;
          K.cyl(CM.metal, 0.03, 0.03, F, F + 0.44, linC(0.7, 0.7, 0.75), { axis: 'y', x: sx, z, segs: 6 });
          K.cyl(CM.paint, 0.2, 0.2, F + 0.44, F + 0.5, YEL, { axis: 'y', x: sx, z, segs: 12 });
        }
      }
    }
    // the photo booth: its box, the curtain, the sign
    {
      const B = P.booth;
      K.box(CM.paint, B.x - 0.6, F, B.z - 0.8, B.x + 0.6, F + 2.2, B.z + 0.8, linC(0.95, 0.85, 0.2));
      K.box(CM.matte, B.x - 0.62, F + 0.3, B.z - 0.5, B.x - 0.6, F + 2.0, B.z + 0.5, linC(0.75, 0.08, 0.2));
      K.box(CM.glow, B.x - 0.64, F + 2.0, B.z - 0.6, B.x - 0.6, F + 2.16, B.z + 0.6, PINK);
      prop(B.x - 0.6, B.z - 0.8, B.x + 0.6, B.z + 0.8, 2.3);
      shown.push({ kind: 'marquee', name: 'PHOTO INK', at: [B.x - 0.645, F + 2.36, B.z], w: 1.1, h: 0.26, n: [-1, 0] });
    }
    // the card kiosk by the doors
    {
      const Kx = P.kiosk;
      K.box(CM.paint, Kx.x - 0.35, F, Kx.z - 0.6, Kx.x + 0.35, F + 1.7, Kx.z + 0.6, linC(0.15, 0.55, 0.85));
      K.box(CM.glow, Kx.x - 0.37, F + 1.0, Kx.z - 0.4, Kx.x - 0.35, F + 1.5, Kx.z + 0.4, CYAN);
      prop(Kx.x - 0.35, Kx.z - 0.6, Kx.x + 0.35, Kx.z + 0.6, 1.8);
      shown.push({ kind: 'marquee', name: 'INK CARD', at: [Kx.x - 0.375, F + 1.86, Kx.z], w: 1.0, h: 0.24, n: [-1, 0] });
    }
    // the hall of fame on the west wall, at the aisle's end
    {
      const Bd = P.board;
      K.box(CM.matte, Bd.x - 0.06, Bd.y - Bd.h / 2 - 0.12, Bd.z - Bd.w / 2 - 0.12, Bd.x, Bd.y + Bd.h / 2 + 0.12, Bd.z + Bd.w / 2 + 0.12, linC(0.04, 0.03, 0.06));
      K.box(CM.glow, Bd.x, Bd.y - Bd.h / 2 - 0.12, Bd.z - Bd.w / 2 - 0.12, Bd.x + 0.03, Bd.y + Bd.h / 2 + 0.12, Bd.z - Bd.w / 2 - 0.06, YEL);
      K.box(CM.glow, Bd.x, Bd.y - Bd.h / 2 - 0.12, Bd.z + Bd.w / 2 + 0.06, Bd.x + 0.03, Bd.y + Bd.h / 2 + 0.12, Bd.z + Bd.w / 2 + 0.12, YEL);
    }
    // the ceiling's neon: zigzags over the aisle, tubes over the rows; the sign hanging over the
    // aisle, its name on both its faces
    const yc = FY + HT - 0.3;
    for (const zc of [CZ - 2.2, CZ + 2.2]) {
      let up = true;
      for (let u = 2; u < 30; u += 1.4) {
        const z0 = zc + (up ? -0.5 : 0.5);
        const z1 = zc + (up ? 0.5 : -0.5);
        const xa = X(u);
        const xb = X(u + 1.4);
        // (a diagonal of short boxes)
        for (let k = 0; k < 6; k++) {
          const t = k / 6;
          const x = xa + (xb - xa) * t;
          const z = z0 + (z1 - z0) * t;
          K.box(CM.glow, x - 0.13, yc, z - 0.05, x + 0.13, yc + 0.05, z + 0.05, zc < CZ ? PINK : CYAN);
        }
        up = !up;
      }
    }
    for (const v of [5, 10, 16.6, 33, 40]) K.box(CM.glow, X(3), yc + 0.1, Z(v) - 0.04, X(29), yc + 0.15, Z(v) + 0.04, VIO);
    {
      const sx = X(16);
      K.box(CM.matte, sx - 0.06, FY + 4.5, CZ - 5.2, sx + 0.06, FY + 6.0, CZ + 5.2, linC(0.04, 0.02, 0.07));
      for (const s of [1, -1]) {
        neonWord(K, CM.glow, 'INK ARCADE', 0.95, sx + s * 0.06, FY + 4.78, CZ, s, 0, s > 0 ? PINK : CYAN, 0.0, 0.05);
        K.box(CM.glow, sx + s * 0.06 - 0.02, FY + 4.5, CZ - 5.2, sx + s * 0.06 + 0.02, FY + 4.56, CZ + 5.2, YEL);
      }
      for (const z of [CZ - 4.6, CZ + 4.6]) K.box(CM.metal, sx - 0.01, FY + 6.0, z - 0.01, sx + 0.01, FY + HT - 0.08, z + 0.01, linC(0.6, 0.6, 0.65));
    }
    // the claws and the toys in their boxes (each claw and each pile its own, to move)
    const group = K.build({ seed: 0.57 });
    // ---- the pictures
    const W2 = touch ? 512 : 1024;
    this.carpetTex = canvasTexture(paintCarpet(touch ? 256 : 512), { repeat: true });
    const carpetMat = makeSurface({ kind: 'uv', map: this.carpetTex, uvScale: 3, ang: 0.4, wash: 0.85, indoor: 'club', emissive: new THREE.Color(0.55, 0.55, 0.55), emMap: this.carpetTex, line: 0.3 });
    {
      const w = XE - XW - 0.6;
      const d = Z1 - Z0 - 0.6;
      const geo = new THREE.PlaneGeometry(w, d);
      geo.rotateX(-Math.PI / 2);
      geo.translate((XW + XE) / 2, F, (Z0 + Z1) / 2);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 3, (uv.getY(i) * d) / 3);
      const m = new THREE.Mesh(geo, carpetMat);
      m.frustumCulled = false;
      group.add(m);
    }
    this.muralTex = canvasTexture(paintMural(W2, touch ? 128 : 256), { repeat: true });
    const muralMat = makeSurface({ kind: 'uv', map: this.muralTex, uvScale: 8, ang: 0.6, wash: 0.85, indoor: 'club', emissive: new THREE.Color(0.7, 0.7, 0.7), emMap: this.muralTex, line: 0.3 });
    {
      // the band round the walls, over the line of light (y 2.5 to under the ceiling)
      const y0 = F + 2.5;
      const y1 = FY + HT - 0.12;
      const T = 0.3 + 0.045;
      const runs = [[XW + T, Z0 + T, XE - T, Z0 + T, 0, 1], [XE - T, Z1 - T, XW + T, Z1 - T, 0, -1], [XW + T, Z1 - T, XW + T, Z0 + T, 1, 0], [XE - T, Z0 + T, XE - T, DOOR.z0, -1, 0], [XE - T, DOOR.z1, XE - T, Z1 - T, -1, 0]];
      const geos = [];
      for (const [ax, az, bx, bz, nx, nz] of runs) {
        const len = Math.hypot(bx - ax, bz - az);
        const geo = new THREE.PlaneGeometry(len, y1 - y0);
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / 16, uv.getY(i));
        geo.rotateY(Math.atan2(nx, nz));
        geo.translate((ax + bx) / 2 + nx * 0.005, (y0 + y1) / 2, (az + bz) / 2 + nz * 0.005);
        geos.push(geo);
      }
      group.add(merged(geos, muralMat));
    }
    const mq = paintMarquees(touch ? 512 : 1024, touch ? 256 : 512);
    this.mqTex = canvasTexture(mq.c, { mips: true });
    const mqMat = makeSurface({ kind: 'uv', map: this.mqTex, uvScale: 1, ang: 0.4, wash: 0.95, indoor: 'club', emissive: new THREE.Color(1.1, 1.1, 1.1), emMap: this.mqTex, line: 0.15 });
    // the screens' picture: the games playing, a cell each (4 across, 3 down)
    const SW = touch ? 512 : 1024;
    const SH = SW / 2;
    this.screenC = document.createElement('canvas');
    this.screenC.width = SW;
    this.screenC.height = SH;
    this.screenTex = canvasTexture(this.screenC, { mips: false });
    this.screenMat = makeSurface({ kind: 'uv', map: this.screenTex, uvScale: 1, ang: 0.4, wash: 1, line: 0.1, indoor: 'club', emissive: new THREE.Color(1.15, 1.15, 1.15), emMap: this.screenTex });
    this.cellBox = {};
    CELLS.forEach((k, i) => {
      const cx = (i % 4) * (SW / 4);
      const cy = Math.floor(i / 4) * (SH / 3);
      const cw = SW / 4;
      const ch = cw * 0.6;
      this.cellBox[k] = { px: cx, py: cy, pw: cw, ph: ch, uv: [cx / SW, 1 - (cy + ch) / SH, (cx + cw) / SW, 1 - cy / SH] };
    });
    this.prizeTex = canvasTexture(paintPrizes(W2, touch ? 128 : 256), { mips: true });
    const prizeMat = makeSurface({ kind: 'uv', map: this.prizeTex, uvScale: 2, ang: 0.4, wash: 0.9, indoor: 'club', emissive: new THREE.Color(0.75, 0.75, 0.75), emMap: this.prizeTex, line: 0.25 });
    this.menuTex = canvasTexture(paintMenu(), { mips: true });
    const menuMat = makeSurface({ kind: 'uv', map: this.menuTex, uvScale: 1, ang: 0.4, wash: 0.95, indoor: 'club', emissive: new THREE.Color(1, 1, 1), emMap: this.menuTex, line: 0.15 });
    this.pinTex = canvasTexture(paintPinball(), { mips: true });
    const pinMat = makeSurface({ kind: 'uv', map: this.pinTex, uvScale: 1, ang: 0.4, wash: 0.95, indoor: 'club', emissive: new THREE.Color(0.85, 0.85, 0.85), emMap: this.pinTex, line: 0.15 });
    this.boardC = document.createElement('canvas');
    this.boardC.width = touch ? 384 : 512;
    this.boardC.height = touch ? 192 : 256;
    this.boardTex = canvasTexture(this.boardC, { mips: false });
    const boardMat = makeSurface({ kind: 'uv', map: this.boardTex, uvScale: 1, ang: 0.4, wash: 1, indoor: 'club', emissive: new THREE.Color(1, 1, 1), emMap: this.boardTex, line: 0.1 });
    this.paintBoard();
    // the air hockey tables' faces (the same picture, the puck going)
    this.tableC = document.createElement('canvas');
    this.tableC.width = touch ? 320 : 500;
    this.tableC.height = touch ? 192 : 300;
    this.tableTex = canvasTexture(this.tableC, { mips: false });
    this.tableMat = makeSurface({ kind: 'uv', map: this.tableTex, uvScale: 1, ang: 0.4, wash: 1, indoor: 'club', emissive: new THREE.Color(0.9, 0.9, 0.9), emMap: this.tableTex, line: 0.1 });
    this.tableDemo = { t: 0, puck: [500, 300], v: [380, 210], m: [[150, 300], [850, 300]] };
    paintTable(this.tableC.getContext('2d'), this.tableC.width / 1000, this.tableDemo);
    this.tableTex.needsUpdate = true;
    // the pictures: all of one pen as one shape (one draw for all the screens, one for the names)
    const by = new Map();
    const put = (mat, geo) => {
      if (!by.has(mat)) by.set(mat, []);
      by.get(mat).push(geo);
    };
    for (const tb of this.tables) {
      const S = tb.surface;
      // (the picture's across the table, its far end the picture's right: as the game draws it)
      put(this.tableMat, pictureGeo(S.len, S.wid, S.at[0], S.at[1] + 0.006, S.at[2], -tb.n[1], tb.n[0], null, true));
    }
    for (const s of shown) {
      const [nx, nz] = s.n || [0, 0];
      if (s.kind === 'screen') put(this.screenMat, pictureGeo(s.w, s.h, s.at[0] + nx * 0.004, s.at[1], s.at[2] + nz * 0.004, nx, nz, this.cellBox[s.cell].uv));
      else if (s.kind === 'marquee') put(mqMat, pictureGeo(s.w, s.h, s.at[0] + nx * 0.004, s.at[1], s.at[2] + nz * 0.004, nx, nz, mq.boxes[s.name]));
      else if (s.kind === 'pinfield') put(pinMat, pictureGeo(s.w, s.h, s.at[0], s.at[1], s.at[2], -nx, -nz, null, true));
      else if (s.kind === 'prizes') put(prizeMat, pictureGeo(s.w, s.h, s.x, s.y, s.z, 0, -1));
      else if (s.kind === 'menu') put(menuMat, pictureGeo(s.w, s.h, s.x, s.y, s.z, 0, -1));
    }
    {
      const Bd = P.board;
      put(boardMat, pictureGeo(Bd.w, Bd.h, Bd.x + 0.01, Bd.y, Bd.z, 1, 0));
    }
    // the posters outside: the games playing, as on their screens
    if (this.posters) for (const p of this.posters) put(this.screenMat, pictureGeo(2.6, 1.56, p.x, p.y, p.z, 1, 0, this.cellBox[p.cell].uv));
    for (const [mat, geos] of by) group.add(merged(geos, mat));
    this.mats = [carpetMat, muralMat, mqMat, this.screenMat, prizeMat, menuMat, pinMat, boardMat, this.tableMat];
    this.texs = [this.carpetTex, this.muralTex, this.mqTex, this.screenTex, this.prizeTex, this.menuTex, this.pinTex, this.boardTex, this.tableTex];
    // the claws and their toys
    this.buildClaws(group);
    group.updateMatrix();
    g.scene.add(group);
    this.inside = group;
    this.makeDemos();
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
    for (const c of this.claws || []) {
      for (const k of c.clawGeo || []) k.geometry.dispose();
      for (const t of c.toys || []) if (t.mesh) t.mesh.traverse((o) => o.isMesh && o.geometry.dispose());
    }
    this.claws = [];
    this.texs = [];
    this.mats = [];
    for (const id of this.inCols) g.world.collision.remove(id);
    this.inCols = [];
    this.inside = null;
    this.crowd = [];
    this.demos = null;
    this.stopMusic();
    if (g.player.fig.indoor === 'club') g.player.fig.indoor = null;
  }

  // the claw over each box, the toys in it (a pile a box, built again when one is won)
  buildClaws(group) {
    const CM = clubMats();
    const TOY = [linC(1, 0.45, 0.7), linC(0.45, 0.9, 1), linC(1, 0.88, 0.4), linC(0.6, 1, 0.5), linC(0.75, 0.55, 1), linC(1, 0.6, 0.3)];
    const NAMES = ['ארנב ורוד', 'דוב תכלת', 'אפרוח צהוב', 'צפרדע ירוקה', 'חתול סגול', 'שועל כתום'];
    for (const c of this.claws) {
      const fr = frame(new Kit(), c.x, c.z, 0, c.n[0], c.n[1]);
      c.toys = [];
      const B = c.box;
      for (let i = 0; i < 11; i++) {
        const u = B.u0 + 0.05 + ((i * 0.37) % 1) * (B.u1 - B.u0 - 0.1);
        const d = B.d0 + 0.05 + ((i * 0.61 + 0.2) % 1) * (B.d1 - B.d0 - 0.12);
        if (u < c.chute[0] + 0.16 && d > c.chute[1] - 0.14) continue;
        const k = (i + c.i) % TOY.length;
        c.toys.push({ u, d, y: c.floor + 0.08 + (i % 3) * 0.05, col: TOY[k], name: NAMES[k], r: 0.075 + (i % 2) * 0.015 });
      }
      c.fr = fr;
      c.claw = { u: c.chute[0], d: c.chute[1], y: c.top, open: 1 };
      this.pileMesh(c, group);
      c.clawMesh = new THREE.Group();
      c.clawGeo = [clawGeo(CM, 1), clawGeo(CM, 0)];
      c.clawM = new THREE.Mesh(c.clawGeo[0].geometry, CM.metal);
      c.clawM.frustumCulled = false;
      c.clawMesh.add(c.clawM);
      group.add(c.clawMesh);
      this.placeClaw(c);
    }
  }

  pileMesh(c, group = this.inside) {
    const CM = clubMats();
    if (c.pile) {
      group.remove(c.pile);
      c.pile.traverse((o) => o.isMesh && o.geometry.dispose());
    }
    const K = new Kit();
    for (const t of c.toys) {
      if (t.held) continue;
      const [x, z] = c.fr.at(t.u, t.d);
      toyParts(K, CM, x, t.y, z, t.r, t.col);
    }
    c.pile = K.build({ seed: 0.2 + c.i * 0.1 });
    group.add(c.pile);
  }

  placeClaw(c) {
    const [x, z] = c.fr.at(c.claw.u, c.claw.d);
    c.clawMesh.position.set(x, c.claw.y, z);
    c.clawMesh.rotation.y = Math.atan2(c.n[0], c.n[1]);
    c.clawM.geometry = c.clawGeo[c.claw.open > 0.5 ? 0 : 1].geometry;
    const held = c.toys.find((t) => t.held);
    if (held && held.mesh) held.mesh.position.set(x, c.claw.y - 0.16, z);
  }

  // ------------------------------------------------------------------ the screens: the games playing themselves
  makeDemos() {
    const g = this.game;
    const mk = (k) => {
      const G = GAMES[k];
      const d = new G.cls({ cab: 'DEMO' });
      const api = { game: { touch: g.touch }, audio: null, money: null, rng: Math.random, finish: () => {}, status() {}, toast() {}, world: null };
      d.start(api);
      return { k, d, api, wait: 0 };
    };
    this.demos = ['invaders', 'penman', 'inktris', 'snake', 'pong', 'bricks', 'rally'].map(mk);
    this.demoT = 0;
    this.paintDemos(0.05);
  }

  stepDemos(dt) {
    for (const D of this.demos) {
      const d = D.d;
      if (d.scene === 'over') {
        D.wait += dt;
        if (D.wait > 3) {
          D.wait = 0;
          d.fresh();
        }
        continue;
      }
      // (a few small steps: the games' own clocks)
      const n = Math.min(4, Math.ceil(dt / 0.034));
      for (let i = 0; i < n; i++) d.update(dt / n, demoInput(D.k, d));
    }
  }

  paintDemos(dt) {
    const g = this.screenC.getContext('2d');
    const SW = this.screenC.width;
    for (const D of this.demos) {
      const b = this.cellBox[D.k];
      g.save();
      g.beginPath();
      g.rect(b.px, b.py, b.pw, b.ph);
      g.clip();
      g.setTransform(b.pw / 1000, 0, 0, b.ph / 600, b.px, b.py);
      try {
        D.d.draw(g, 1000, 600);
      } catch (e) {
        // (a demo that trips is started again)
        D.d.fresh();
      }
      g.restore();
    }
    const b = this.cellBox.beat;
    paintBeatIdle(g, b.px, b.py, b.pw, b.ph, this.t);
    void SW;
    void dt;
    this.screenTex.needsUpdate = true;
  }

  paintBoard() {
    const best = {};
    for (const k of ['invaders', 'penman', 'inktris', 'snake', 'pong', 'bricks', 'rally', 'hockey']) best[k] = bestOf(k);
    paintBoard(this.boardC, best);
    this.boardTex.needsUpdate = true;
  }

  // ------------------------------------------------------------------ the people
  makeCrowd() {
    const g = this.game;
    const N = g.touch ? 0.45 : 1;
    const R = Math.random;
    const list = [];
    const person = (x, z, yaw, at, o = {}) => {
      const look = o.kid ? kidLook() : o.look || patronLook();
      list.push({ x, z, y: F, y0: F, look, scale: look.build.height, yaw, speed: 0, phase: R() * 6, seed: R() * 100, cheer: 0, sit: 0, at, indoor: 3, hop: R(), ...o });
    };
    const face = (n) => Math.atan2(-n[0], -n[1]);
    const take = (k) => R() < k * N;
    for (const c of this.cabs) {
      if (!take(0.45)) continue;
      const [x, , z] = c.stand;
      person(x, z, face(c.n), 'cab', { kid: R() < 0.3, c });
      c.busy = list[list.length - 1];
      // (a friend watching over the shoulder now and then)
      if (R() < 0.18) person(x + c.n[1] * 0.55 + c.n[0] * 0.45, z - c.n[0] * 0.55 + c.n[1] * 0.45, face(c.n) + 0.3, 'watch');
    }
    for (const c of this.racers) {
      if (!take(0.75)) continue;
      const [x, , z] = c.stand;
      person(x, z, face(c.n), 'race', { sit: 1, y: F + 0.02, c });
      c.busy = list[list.length - 1];
    }
    for (const c of this.pins) if (take(0.5)) person(c.stand[0], c.stand[2], face(c.n), 'cab');
    for (const c of PLAN.skees) if (take(0.5)) person(c.stand[0], c.stand[2], face(c.n), 'throw');
    for (const c of PLAN.hoops) if (take(0.6)) person(c.stand[0], c.stand[2], face(c.n), 'throw');
    // the hockey tables: one at each end of each (yours the near end, when you come)
    for (const tb of this.tables) {
      person(tb.far[0], tb.far[2], face([-tb.n[0], -tb.n[1]]), 'hockey');
      tb.cpu = list[list.length - 1];
      person(tb.stand[0], tb.stand[2], face(tb.n), 'hockey');
      tb.busy = list[list.length - 1];
    }
    const pads = this.dance.pads;
    person(pads[1][0], pads[1][2], face(this.dance.n), 'dance', { y: F + 0.12, y0: F + 0.12 });
    for (const c of this.claws) if (take(0.35)) person(c.stand[0], c.stand[2], face(c.n), 'cab', { kid: true });
    // the counters: behind them and before them
    const C = PLAN.counter;
    person((C.x0 + C.x1) / 2, Z(49.6), Math.PI, 'staff', { look: bartenderLook() });
    for (let k = 0; k < 3; k++) if (take(0.9)) person(C.x0 + 3 + k * 3.5 + R(), C.z0 - 0.7, 0, 'queue', { kid: k === 1 });
    const Pz = PLAN.pizza;
    person((Pz.x0 + Pz.x1) / 2, Z(48), Math.PI, 'staff', { look: bartenderLook() });
    for (let k = 0; k < 4; k++) if (take(0.5)) person(Pz.x0 + 0.8 + k * 1.4, Pz.z0 - 0.6, 0, 'eat', { sit: 1, y: F + 0.04 });
    for (const [x, z] of PLAN.seats) for (const a of [0, Math.PI]) if (take(0.6)) person(x + Math.cos(a) * 0.85, z, a === 0 ? -Math.PI / 2 : Math.PI / 2, 'eat', { sit: 1, y: F + 0.02 });
    // walking the aisles
    const lanes = [[X(2.5), X(29), Z(5.2)], [X(4), X(28), Z(13.5)], [X(3), X(29), CZ - 1], [X(3), X(29), CZ + 1.2], [X(5), X(29), Z(39)], [X(6), X(22), Z(44)]];
    for (const [xa, xb, z] of lanes) {
      for (let k = 0; k < 2; k++) {
        if (!take(0.75)) continue;
        const dir = R() < 0.5 ? 1 : -1;
        person(xa + R() * (xb - xa), z + (R() - 0.5) * 0.8, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 'walk', { xMin: xa, xMax: xb, dir, v: 0.75 + R() * 0.4, kid: R() < 0.25 });
      }
    }
    this.crowd = list;
  }

  // ------------------------------------------------------------------ the sound
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
    this.song = makeSong(this.songN % 3 === 2 ? 'disco' : 'synth', 700 + this.songN * 7);
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
  inHall(x, z) {
    return x > XW && x < XE && z > Z0 && z < Z1;
  }

  update(dt) {
    const g = this.game;
    const ml = g.world.mainland;
    if (!ml || !BLOCK) return;
    this.t += dt;
    const p = g.player;
    const built = ml.blocks && ml.blocks.has(BLOCK.id);
    if (this.failed) return;
    try {
      if (built && !this.shell) this.buildShell();
      if (!built && this.shell) this.teardownShell();
    } catch (e) {
      // (a hall that cannot stand is not tried again every frame)
      console.error('[arcade]', e);
      this.failed = true;
      return;
    }
    if (!this.shell) return;
    const d = Math.hypot(p.pos.x - (XW + XE) / 2, p.pos.z - CZ);
    if (!this.inside && d < NEAR_IN) {
      try {
        this.buildInside();
      } catch (e) {
        console.error('[arcade]', e);
        this.failed = true;
        for (const id of this.inCols) g.world.collision.remove(id);
        this.inCols = [];
        return;
      }
    }
    if (this.inside && d > NEAR_IN + 50) this.teardownInside();
    // the bulbs chase
    if (this.chase) {
      const k = Math.floor(this.t * 5) % 2;
      this.chase[0].visible = k === 0;
      this.chase[1].visible = k === 1;
    }
    if (!this.inside) return;
    const inside = this.inHall(p.pos.x, p.pos.z);
    const f = p.fig;
    if (inside && f.indoor !== 'club') f.indoor = 'club';
    else if (!inside && f.indoor === 'club') f.indoor = null;
    if (inside && !this.welcomed) {
      this.welcomed = true;
      g.hud.big('INK ARCADE', 2200);
      g.hud.toast(`כרטיסים: ${this.tickets}. משחקים במכונות, אוספים כרטיסים ומחליפים בפרסים בדלפק`, 'info', 4);
    }
    if (!inside && d > 60) this.welcomed = false;
    const cam = g.camera.position;
    const near = this.inHall(cam.x, cam.z) || Math.hypot(cam.x - XE, cam.z - CZ) < 32;
    // the screens (a few times a second, near)
    if (near && this.demos) {
      this.demoAcc = (this.demoAcc || 0) + dt;
      const every = g.touch ? 0.33 : 0.16;
      if (this.demoAcc >= every) {
        this.stepDemos(this.demoAcc);
        this.paintDemos(this.demoAcc);
        this.demoAcc = 0;
      }
      // the tables' puck
      this.tableAcc = (this.tableAcc || 0) + dt;
      if (this.tableAcc >= (g.touch ? 0.1 : 0.05)) {
        stepTable(this.tableDemo, this.tableAcc);
        paintTable(this.tableC.getContext('2d'), this.tableC.width / 1000, this.tableDemo);
        this.tableTex.needsUpdate = true;
        this.tableAcc = 0;
      }
    }
    // the music, the machines' noise
    const c = g.audio && g.audio.ctx;
    if (near && !this.band) this.startMusic();
    if (this.band && c) {
      const now = c.currentTime;
      if (now > this.songEnd - 0.05) this.nextSong(this.songEnd);
      this.band.update(now);
      const playing = g.minigames && g.minigames.isOpen;
      this.mix.gain.setTargetAtTime(inside ? (playing ? 0.18 : 0.42) : near ? 0.2 : 0, now, 0.3);
      this.lp.frequency.setTargetAtTime(inside ? 12000 : 700, now, 0.3);
      this.beat = (now - this.songT0) / (this.spb * 4);
    } else this.beat = this.t * 2;
    if (!near && this.band && d > NEAR_IN) this.stopMusic();
    if (inside && c) {
      this.bleepT = (this.bleepT || 0) - dt;
      if (this.bleepT <= 0) {
        this.bleepT = 0.18 + Math.random() * 0.4;
        let best = null;
        let bd = 14;
        for (let k = 0; k < 4; k++) {
          const cb = this.cabs[Math.floor(Math.random() * this.cabs.length)];
          const dd = Math.hypot(cb.x - p.pos.x, cb.z - p.pos.z);
          if (dd < bd) {
            bd = dd;
            best = cb;
          }
        }
        if (best) chip(g.audio, ['blip', 'shoot', 'pick', 'bounce', 'hit'][Math.floor(Math.random() * 5)], 0.25 * (1 - bd / 14));
      }
    }
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
        w.x += w.dir * w.v * dt;
        w.speed = 3.2 * w.v;
        if (w.x > w.xMax || w.x < w.xMin) {
          w.dir = -w.dir;
          w.x = Math.max(w.xMin, Math.min(w.xMax, w.x));
          w.yaw = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else if (Math.random() < dt * 0.05) {
          w.pause = 2 + Math.random() * 5;
          w.speed = 0;
        }
      } else if (w.at === 'cab' || w.at === 'race' || w.at === 'hockey') {
        // (at the controls: the hands busy, now and then a cheer)
        w.cheer = Math.sin(this.t * 0.6 + w.seed) > 0.96 ? 1 : 0.32 + 0.12 * Math.sin(this.t * 9 + w.seed);
        if (w.at === 'hockey') w.yaw += Math.sin(this.t * 3 + w.seed) * dt * 0.6;
      } else if (w.at === 'dance') {
        w.y = w.y0 + bob * 0.08;
        w.cheer = Math.floor(this.beat + w.hop * 4) % 2 === 0 ? 0.95 : 0.2;
      } else if (w.at === 'throw') {
        w.cheer = Math.sin(this.t * 2.2 + w.seed) > 0.7 ? 0.9 : 0.15;
      } else if (w.at === 'watch' || w.at === 'queue') {
        w.cheer = Math.sin(this.t * 0.9 + w.seed * 3) > 0.9 ? 0.6 : 0;
      } else if (w.at === 'eat') {
        w.cheer = Math.sin(this.t * 1.1 + w.seed) > 0.8 ? 0.4 : 0;
      }
    }
  }

  // ------------------------------------------------------------------ drawing (game/game.js)
  draw(fr) {
    if (!this.inside) return;
    const g = this.game;
    const cam = g.camera.position;
    const inCam = this.inHall(cam.x, cam.z);
    const dc = Math.hypot(cam.x - XE, cam.z - CZ);
    if (inCam || dc < 30) {
      const bodies = g.figures.bodies;
      const fwd = g.camera.getWorldDirection(_v);
      const far = g.touch ? 30 : 46;
      for (const w of this.crowd) {
        if (w.hide) continue;
        const dx = w.x - cam.x;
        const dz = w.z - cam.z;
        const dd = Math.hypot(dx, dz);
        if (dd > far || (dd > 3 && (dx * fwd.x + dz * fwd.z) / dd < -0.2)) continue;
        bodies.drawCheap(w);
      }
    }
    // the claws' cables
    for (const c of this.claws) {
      const [x, z] = c.fr.at(c.claw.u, c.claw.d);
      if (Math.hypot(x - cam.x, z - cam.z) < 14) fr.lineXYZ(x, c.top + 0.02, z, x, c.claw.y + 0.06, z, [0.7, 0.72, 0.78], 1, 8100 + c.i, 0.9, 0.001, 0);
    }
    if (!inCam && dc > 60) return;
    // the light: pools sweeping the floor, the dance floor on the beat, the counter, the tables
    const t = this.t;
    if (inCam) {
      const P = [[X(14) + Math.cos(t * 0.4) * 9, Z(12) + Math.sin(t * 0.5) * 7, _pink], [X(16) + Math.cos(t * 0.33 + 2) * 10, CZ + Math.sin(t * 0.45 + 1) * 3, _cyan], [X(15) + Math.cos(t * 0.37 + 4) * 8, Z(38) + Math.sin(t * 0.41 + 3) * 6, _yellow]];
      for (const [x, z, c] of P) flashLight(x, F + 3.2, z, 9, c, 1.5);
      const ph = this.beat - Math.floor(this.beat);
      _beat.setHSL((Math.floor(this.beat) % 6) / 6, 1, 0.6);
      flashLight(this.dance.x, F + 2.2, this.dance.z + 2.2, 7, _beat, 0.8 + 1.6 * Math.pow(1 - ph, 2));
      const C = PLAN.counter;
      flashLight((C.x0 + C.x1) / 2, F + 2.6, C.z0 - 0.5, 9, _warm, 1.4);
      flashLight(X(13.5), F + 2.6, Z(35), 8, _white, 1.1);
      flashLight(X(30.4), F + 2.0, Z(34.5), 5, _pink, 1.2);
    }
    const night = g.daynight ? g.daynight.night : 1;
    if (night > 0.15 && dc < 60) {
      flashLight(XE + 2.2, F + 2.8, CZ, 10, _warm, 1.3 * night);
      // (the face washed in colour, from lamps in the forecourt)
      if (!inCam) {
        flashLight(XE + 3.5, F + 1.0, CZ - 15, 14, _pink, 1.6 * night);
        flashLight(XE + 3.5, F + 1.0, CZ + 15, 14, _cyan, 1.6 * night);
      }
    }
  }

  // ------------------------------------------------------------------ what you can do there
  target() {
    if (!this.inside || (this.game.minigames && this.game.minigames.isOpen)) return null;
    const p = this.game.player.pos;
    if (!this.inHall(p.x, p.z)) return null;
    const near = (s, r) => Math.hypot(p.x - s[0], p.z - s[2]) < r;
    for (const c of this.cabs) if (near(c.stand, 0.55)) return { kind: 'cab', c, label: `E — לשחק ב־${GAMES[c.game].name} ($1)` };
    for (const c of this.racers) if (near(c.stand, 0.85)) return { kind: 'racer', c, label: 'E — לשבת ב־INK RALLY ($2)' };
    for (const pd of this.dance.pads) if (Math.hypot(p.x - pd[0], p.z - pd[2]) < 1.0) return { kind: 'dance', label: 'E — לרקוד ב־INK BEAT ($2)' };
    for (const tb of this.tables) if (near(tb.stand, 0.9)) return { kind: 'hockey', tb, label: 'E — לשחק הוקי אוויר ($2)' };
    for (const c of this.claws) if (near(c.stand, 0.6)) return { kind: 'claw', c, label: 'E — מכונת המנוף ($1)' };
    const C = PLAN.counter;
    if (p.x > C.x0 && p.x < C.x1 && p.z > C.z0 - 1.6 && p.z < C.z0) return { kind: 'prizes', label: `E — דלפק הפרסים (${this.tickets} כרטיסים)` };
    const Pz = PLAN.pizza;
    if (p.x > Pz.x0 && p.x < Pz.x1 && p.z > Pz.z0 - 1.5 && p.z < Pz.z0) return { kind: 'pizza', label: 'E — PIXEL PIZZA' };
    const B = PLAN.booth;
    if (Math.hypot(p.x - (B.x - 1.0), p.z - B.z) < 0.9) return { kind: 'booth', label: 'E — תא הצילום ($3)' };
    return null;
  }

  interact() {
    const tg = this.target();
    if (!tg) return false;
    const g = this.game;
    const pay = (n, who) => {
      if (!g.money || g.money.pay(n, who)) {
        g.audio.play('coins', 0.4);
        return true;
      }
      g.money.refuse(who, n);
      return false;
    };
    if (tg.kind === 'cab' || tg.kind === 'racer') {
      const c = tg.c;
      const G = GAMES[c.game];
      const fee = tg.kind === 'racer' ? 2 : 1;
      if (!g.minigames || !pay(fee, G.name)) return true;
      const S = c.screen;
      const racing = tg.kind === 'racer';
      // (the camera over your shoulder, a little above: your head at the screen's lower left)
      const world = worldAt({ at: S.at, n: c.n, w: S.w, h: S.h, stand: racing ? 1.1 : 0.745, y0: F, back: racing ? 0.5 : 0.42, up: racing ? 1.72 : 2.05, camSide: racing ? 0.45 : 0.36, fov: racing ? 44 : 40, hands: c.hands, sit: racing, glow: 1.1, exit: [c.stand[0] + c.n[0] * 0.3, c.stand[2] + c.n[1] * 0.3, Math.atan2(-c.n[0], -c.n[1])] });
      this.play(c, new G.cls({ cab: G.name, fee }), world, (r) => this.paid(r, G.name));
      return true;
    }
    if (tg.kind === 'dance') {
      if (!g.minigames || !pay(2, 'INK BEAT')) return true;
      const D = this.dance;
      const pd = D.pads[0];
      const S = D.screen;
      const world = worldAt({ at: S.at, n: D.n, w: S.w, h: S.h, stand: 0, y0: F + 0.12, back: 3.2, up: 2.4, camSide: 0.9, fov: 52, glow: 1.1, hands: [[pd[0] - 0.25, F + 1.35, pd[2]], [pd[0] + 0.25, F + 1.35, pd[2]]], exit: [pd[0], pd[2] + 2.2, Math.PI] });
      world.stand = [pd[0], pd[2], Math.atan2(-D.n[0], -D.n[1]), F + 0.12];
      this.play(D, new DanceGame({ venue: 'INK ARCADE', style: 'synth', tips: false }), world, (r) => {
        const n = Math.max(1, Math.round((r.score || 0) / 1500));
        if (r.score) this.paid({ tickets: n, score: r.score }, 'INK BEAT');
      });
      return true;
    }
    if (tg.kind === 'hockey') {
      if (!g.minigames || !pay(2, 'AIR HOCKEY')) return true;
      const tb = tg.tb;
      const S = tb.surface;
      const world = worldAt({ at: S.at, n: tb.n, w: S.len, h: S.wid, flat: true, along: true, stand: S.len / 2 + 0.36, y0: F, back: 0.42, up: 2.55, camSide: 0.42, fov: 56, lookIn: 0.28, glow: 0.8, exit: [tb.stand[0] + tb.n[0] * 0.3, tb.stand[2] + tb.n[1] * 0.3, Math.atan2(-tb.n[0], -tb.n[1])] });
      if (tb.busy) tb.busy.hide = true;
      // (the one at the far end plays you: it leans after its mallet)
      const cpu = tb.cpu;
      const far = tb.far;
      const moveCpu = (k) => {
        if (!cpu) return;
        cpu.x = far[0] + tb.n[1] * k * 0.45;
        cpu.z = far[2] - tb.n[0] * k * 0.45;
        cpu.cheer = 0.5;
      };
      this.play(tb, new AirHockey({ cab: 'AIR HOCKEY', moveCpu }), world, (r) => {
        moveCpu(0);
        if (tb.busy) tb.busy.hide = false;
        this.paid(r, 'AIR HOCKEY');
      });
      return true;
    }
    if (tg.kind === 'claw') {
      if (!g.minigames || !pay(1, 'CLAW-SOME')) return true;
      const c = tg.c;
      const [sx, sz] = c.fr.at(0, 0);
      const world = worldAt({ at: [sx, F + 1.3, sz], n: c.n, w: 0.9, h: 0.6, hidden: true, stand: 0.98, y0: F, back: 0.3, up: 2.2, camSide: 0.46, fov: 52, hands: c.hands, exit: [c.stand[0] + c.n[0] * 0.3, c.stand[2] + c.n[1] * 0.3, Math.atan2(-c.n[0], -c.n[1])] });
      this.play(c, new ClawGame({ rig: this.clawRig(c) }), world, (r) => {
        if (r && r.prize) {
          this.keep({ kind: 'plush', name: r.prize, from: 'CLAW-SOME' });
          g.hud.big('YOU GOT IT!', 1800);
          g.hud.toast(`תפסתם ${r.prize}! הוא נשמר באוסף הפרסים שלכם, לבית`, 'good', 3.5);
        } else g.hud.toast('המנוף החליק... עוד ניסיון?', 'info', 2.5);
      });
      return true;
    }
    if (tg.kind === 'prizes') {
      this.prizeMenu();
      return true;
    }
    if (tg.kind === 'pizza') {
      const menu = [['משולש פיצה', 3, 20, [0.95, 0.7, 0.3]], ['נאצ׳וס עם גבינה', 4, 20, [1, 0.8, 0.3]], ['סלאשי כחול', 2, 10, [0.3, 0.6, 1]], ['פופקורן', 2, 10, [1, 0.95, 0.75]]];
      g.dialog.show('PIXEL PIZZA', 'Fuel for the high score! What can I get you?', menu.map(([label, price, hp, colr]) => ({
        label: `${label} (+${hp} חיים) · $${price}`,
        fn: () => {
          if (!g.money || g.money.pay(price, label)) {
            const pl = g.player;
            pl.hp = Math.min(pl.maxHp, pl.hp + hp);
            pl.fig.belly = Math.min(1, pl.fig.belly + 0.2);
            pl.fig.bellyColor = colr;
            g.audio.play('coins', 0.5);
            g.hud.toast(`${label}! +${hp} חיים`, 'good', 2);
          } else g.money.refuse('PIXEL PIZZA', price);
        },
      })));
      return true;
    }
    if (tg.kind === 'booth') {
      if (!pay(3, 'PHOTO INK')) return true;
      const f = g.player.fig;
      f.armsUp = 1;
      g.audio.play('click', 0.7);
      this.boothFlash = 4;
      g.inkwell.after(2.4, () => (f.armsUp = 0));
      this.keep({ kind: 'photostrip', from: 'PHOTO INK' });
      g.hud.toast('ארבעה פלאשים, ארבע פרצופים: רצועת התמונות נשמרה באוסף שלכם', 'good', 3);
      return true;
    }
    return false;
  }

  // a machine played: its screen yours, the people near it out of the camera's way
  play(m, mod, world, cb) {
    const g = this.game;
    if (m.busy) m.busy.hide = true;
    this.playing = m;
    g.minigames.play(mod, (r) => {
      if (m.busy) m.busy.hide = false;
      this.playing = null;
      cb(r || {});
    }, { world });
  }

  // the tickets a game paid out
  paid(r, name) {
    const g = this.game;
    const n = (r && r.tickets) || 0;
    if (!n) return;
    this.tickets += n;
    save(TICKETS, this.tickets);
    g.audio.play('coins', 0.6);
    g.hud.toast(`${name}: ${n} כרטיסים יצאו מהמכונה! (סה״כ ${this.tickets})`, 'good', 3);
    this.paintBoard();
  }

  prizeMenu() {
    const g = this.game;
    const LIST = [['סוכריות דיו חמוצות (+15 חיים)', 25, 'candy'], ['מחזיק מפתחות של עט זוהר', 60, 'keychain'], ['כתם דיו מפרווה', 150, 'plush-blot'], ['מנורת PEN-MAN', 300, 'lamp'], ['מחק ענק מפרווה', 600, 'plush-eraser'], ['מכונת משחק קטנה לבית', 1500, 'mini-cabinet'], ['גביע הג׳ויסטיק המוזהב', 3000, 'trophy']];
    g.dialog.show('PRIZES', `You have ${this.tickets} tickets. Pick a prize!`, LIST.map(([label, price, kind]) => ({
      label: `${label} · ${price} כרטיסים`,
      fn: () => {
        if (this.tickets < price) {
          g.hud.toast(`חסרים ${price - this.tickets} כרטיסים. עוד כמה משחקים!`, 'info', 2.5);
          return;
        }
        this.tickets -= price;
        save(TICKETS, this.tickets);
        g.audio.play('ding', 0.6);
        if (kind === 'candy') {
          const pl = g.player;
          pl.hp = Math.min(pl.maxHp, pl.hp + 15);
          g.hud.toast('סוכריות חמוצות! +15 חיים', 'good', 2);
        } else {
          this.keep({ kind, name: label, from: 'INK ARCADE' });
          g.hud.toast(`${label}: שלכם! נשמר באוסף הפרסים, ויחכה בבית`, 'good', 3);
        }
      },
    })));
  }

  keep(item) {
    try {
      const list = JSON.parse(localStorage.getItem(PRIZES) || '[]') || [];
      list.push({ ...item, at: Date.now() });
      localStorage.setItem(PRIZES, JSON.stringify(list.slice(-60)));
    } catch (e) {
      // (no room: it is yours for now)
    }
  }

  // the claw machine's moving parts, for its game (game/minigames/arcade/claw.js)
  clawRig(c) {
    const self = this;
    return {
      box: c.box,
      chute: c.chute,
      top: c.top,
      floor: c.floor,
      toys: c.toys,
      claw: c.claw,
      set(u, d, y, open) {
        c.claw.u = u;
        c.claw.d = d;
        c.claw.y = y;
        c.claw.open = open;
        self.placeClaw(c);
      },
      grab(t) {
        t.held = true;
        const K = new Kit();
        toyParts(K, clubMats(), 0, 0, 0, t.r, t.col);
        t.mesh = K.build({ seed: 0.9 });
        t.mesh.matrixAutoUpdate = true;
        self.inside.add(t.mesh);
        self.pileMesh(c);
        self.placeClaw(c);
      },
      drop(t, u, d) {
        // (it slipped: back on the pile, where it fell)
        if (t.mesh) {
          self.inside.remove(t.mesh);
          t.mesh.traverse((o) => o.isMesh && o.geometry.dispose());
          t.mesh = null;
        }
        t.held = false;
        t.u = u;
        t.d = d;
        self.pileMesh(c);
      },
      won(t) {
        if (t.mesh) {
          self.inside.remove(t.mesh);
          t.mesh.traverse((o) => o.isMesh && o.geometry.dispose());
          t.mesh = null;
        }
        c.toys.splice(c.toys.indexOf(t), 1);
        // (the machine filled again: a new toy where it was)
        c.toys.push({ ...t, held: false, mesh: null, u: c.box.u0 + 0.1 + Math.random() * 0.4, d: c.box.d0 + 0.05 + Math.random() * 0.3 });
        self.pileMesh(c);
      },
    };
  }
}

// a toy in the claw machine: its round body, its ears, its eyes
function toyParts(K, CM, x, y, z, r, col) {
  K.sphere(CM.paint, r, x, y, z, col, 1, 0.9, 1, 10);
  K.sphere(CM.paint, r * 0.35, x - r * 0.55, y + r * 0.75, z, col, 1, 1, 1, 6);
  K.sphere(CM.paint, r * 0.35, x + r * 0.55, y + r * 0.75, z, col, 1, 1, 1, 6);
  K.sphere(CM.matte, r * 0.12, x - r * 0.32, y + r * 0.2, z + r * 0.85, linC(0.05, 0.05, 0.08), 1, 1, 1, 5);
  K.sphere(CM.matte, r * 0.12, x + r * 0.32, y + r * 0.2, z + r * 0.85, linC(0.05, 0.05, 0.08), 1, 1, 1, 5);
}

// the claw: its hub, three prongs, open or closed (its own origin at the hub)
function clawGeo(CM, open) {
  const K = new Kit();
  const STEEL = linC(0.75, 0.78, 0.85);
  K.cyl(CM.metal, 0.03, 0.03, -0.03, 0.06, STEEL, { axis: 'y', x: 0, z: 0, segs: 8 });
  const a0 = open ? 0.55 : 0.12;
  for (let k = 0; k < 3; k++) {
    const b = (k / 3) * Math.PI * 2;
    const g = new THREE.BoxGeometry(0.012, 0.15, 0.012);
    g.translate(0, -0.075, 0);
    g.rotateX(a0);
    g.rotateY(b);
    g.translate(Math.sin(b) * 0.025, -0.02, Math.cos(b) * 0.025);
    K.add(CM.metal, g, STEEL);
  }
  const grp = K.build({ seed: 0.4 });
  return grp.children[0];
}

// the demo's hands: each game played by a little of its own sense
function demoInput(k, d) {
  const inp = { left: false, right: false, up: false, down: false, a: false, b: false, hit: new Set(), at: new Map(), codes: new Map(), keys: new Set(), taps: [], drag: null };
  const R = Math.random;
  if (d.scene !== 'play') return inp;
  if (k === 'invaders') {
    const alive = (d.foes || []).filter((f) => f.alive);
    const f = alive[Math.floor((d.t * 0.7) % Math.max(1, alive.length))];
    if (f) {
      inp.left = f.x < d.px - 8;
      inp.right = f.x > d.px + 8;
    }
    if (R() < 0.3) inp.hit.add('a');
  } else if (k === 'penman') {
    if (R() < 0.08) inp.hit.add(['left', 'right', 'up', 'down'][Math.floor(R() * 4)]);
  } else if (k === 'inktris') {
    if (R() < 0.12) inp.hit.add(['left', 'right', 'a'][Math.floor(R() * 3)]);
    if (R() < 0.02) inp.hit.add('up');
  } else if (k === 'snake') {
    const [hx, hy] = d.body[0];
    const f = d.food;
    const want = f.x > hx ? 'right' : f.x < hx ? 'left' : f.y > hy ? 'down' : 'up';
    if (R() < 0.5) inp.hit.add(want);
  } else if (k === 'pong') {
    inp.up = d.ball.y < d.me.y - 20;
    inp.down = d.ball.y > d.me.y + 20;
  } else if (k === 'bricks') {
    const b = d.balls && d.balls[0];
    if (b) {
      inp.left = b.x < d.px - 10;
      inp.right = b.x > d.px + 10;
    }
  } else if (k === 'rally') {
    const s = d.seg(d.pos + 840);
    const want = -s.curve * 0.18;
    inp.left = d.x > want + 0.1;
    inp.right = d.x < want - 0.1;
  }
  return inp;
}

// the tables' own puck, when nobody of yours plays: two mallets after it
function stepTable(T, dt) {
  T.t += dt;
  const [px, py] = T.puck;
  let [vx, vy] = T.v;
  let x = px + vx * dt;
  let y = py + vy * dt;
  if (y < 40 || y > 560) {
    vy = -vy;
    y = Math.max(40, Math.min(560, y));
  }
  for (const [i, mx0] of [[0, 150], [1, 850]]) {
    const m = T.m[i];
    m[1] += Math.max(-500 * dt, Math.min(500 * dt, y - m[1]));
    m[0] = mx0 + Math.sin(T.t * 2 + i) * 40;
    if (Math.hypot(x - m[0], y - m[1]) < 60 && (i === 0 ? vx < 0 : vx > 0)) {
      vx = -vx * (1 + Math.random() * 0.1);
      vy += (Math.random() - 0.5) * 300;
    }
  }
  if (x < 20 || x > 980) {
    x = 500;
    y = 300;
    vx = (Math.random() < 0.5 ? -1 : 1) * 380;
    vy = (Math.random() - 0.5) * 400;
  }
  const sp = Math.hypot(vx, vy);
  if (sp > 900) {
    vx *= 900 / sp;
    vy *= 900 / sp;
  }
  T.puck = [x, y];
  T.v = [vx, vy];
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
const _pink = new THREE.Color(1, 0.3, 0.75);
const _cyan = new THREE.Color(0.3, 0.9, 1);
const _yellow = new THREE.Color(1, 0.85, 0.3);
const _warm = new THREE.Color(1, 0.85, 0.6);
const _white = new THREE.Color(0.9, 0.95, 1);
const _beat = new THREE.Color();
