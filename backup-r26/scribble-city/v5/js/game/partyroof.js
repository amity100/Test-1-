import * as THREE from 'three';
import { Kit, linC } from './items.js';
import { clubMats, pictureGeo, neonWord } from './venuekit.js';
import { sofa } from './casinobuild.js';
import { paintBottles } from './casinoart.js';
import { flashLight, makeSurface, canvasTexture } from '../render/materials.js';
import { CURB, M_BLOCKS } from '../world/mainland/plan.js';
import { CASINO } from '../world/mainland/halls.js';
import { worldAt } from '../ui/minigame.js';
import { barLook, BAR_STYLE_NAMES, bartenderLook, bouncerLook, civilianLook, modest } from './looks.js';
import { DanceGame } from './minigames/dance.js';
import { PartySound, drawPeople, floorQuad, canvas } from './partykit.js';
import { paintLED, paintPool } from './partyart.js';
import { CLUB_FORM } from './partyclub.js';

// (v5, ROADMAP 12.9) SKY POOL: the party on the roof of PALACE OF INK's tower, sixty-six storeys over
// the bay. Up in the lift from the casino's hall (on its west wall, under the tower), out onto a deck
// of wood behind glass: the pool lit from under the water down its middle, daybeds along its sides,
// the DJ under an arch of truss at the far end - its heads throwing beams up into the night over the
// city -, a wall of LED behind the decks, the bar at the near end, strings of bulbs zigzagging
// over it all, palms in their planters; and a crowd: dancing before the DJ, at the bar, on the
// daybeds, on the pool's edge, at the glass looking out over the lights of the city. The music is
// the club's kind (a groove, a break, the build, the drop - game/partyclub.js); at the drop the
// confetti cannons go off over the dancers.

const H = CASINO;
const FY = CURB + 0.012;
const TW = H.tower;
const X0 = H.xw + TW.u0;
const X1 = H.xw + TW.u1;
const Z0 = H.z0 + TW.v0;
const Z1 = H.z0 + TW.v1;
const CX = (X0 + X1) / 2;
const DECK = FY + TW.h + 0.56;
const BLOCK = M_BLOCKS.find((b) => b.col === H.col && b.row === H.row);
const NEAR = 230;
const BARS = 40;
const BPM = 124;
// the lift in the casino's hall (on its west wall under the tower), its house on the roof
const LIFT = { x: H.xw + 0.35, z: H.z0 + 22 };
const HOUSE = { x0: X0, x1: X0 + 3.6, z0: Z0, z1: Z0 + 3.6 };
const POOL = { x0: CX - 2.5, x1: CX + 2.5, z0: Z0 + 8, z1: Z0 + 24 };
const DANCE = { x0: CX - 4.2, x1: CX + 4.2, z0: Z0 + 25.5, z1: Z0 + 33.4 };
const DJ = { x: CX, z: Z1 - 3.4 };
const BAR = { x0: CX - 3.5, x1: CX + 6.3, z0: Z0 + 1.0, z1: Z0 + 3.0 };
const HUES = [0.55, 0.9, 0.12, 0.76];
const BEAM_C = [[0.3, 0.9, 1], [1, 0.35, 0.75], [1, 0.9, 0.35], [0.6, 0.45, 1]];
const pm = (a, n) => ((Math.floor(a) % n) + n) % n;
const partOf = (bar) => (bar < 16 ? 'groove' : bar < 20 ? 'break' : bar < 24 ? 'build' : 'drop');
const R = Math.random;

export class SkyPool {
  constructor(game) {
    this.game = game;
    this.set = null;
    this.crowd = [];
    this.cols = [];
    this.t = 0;
    this.clock = 0;
    this.beat = 0;
    this.bar = 0;
    this.songN = 0;
    this.part = 'off';
    this.dropped = -1;
    this.sound = new PartySound(game, { styles: ['house', 'synth', 'house', 'disco'], bars: BARS, form: CLUB_FORM, seed: 211 });
  }

  open() {
    const Rh = this.game.rhythm;
    return !Rh || Rh.open('club');
  }

  // (on the roof, or - the camera behind you - over the edge of it)
  onRoof(x, y, z, m = 1) {
    return x > X0 - m && x < X1 + m && z > Z0 - m && z < Z1 + m && y > DECK - 3;
  }

  // ------------------------------------------------------------------ the deck and everything on it
  build() {
    const g = this.game;
    const touch = g.touch;
    const CM = clubMats('club');
    const K = new Kit();
    const col = g.world.collision;
    const cols = (this.cols = []);
    const WOOD = linC(0.48, 0.3, 0.17);
    const SEAM = linC(0.3, 0.18, 0.1);
    const STONE = linC(0.93, 0.91, 0.86);
    const GOLD = linC(0.85, 0.65, 0.25);
    const BLACK = linC(0.03, 0.03, 0.04);
    const WHITE = linC(0.95, 0.94, 0.9);
    const GLASS = linC(0.5, 0.62, 0.7);
    const BULB = linC(1, 0.82, 0.5);
    const D = DECK;
    // ---- the deck of wood, its seams
    K.box(CM.matte, X0 + 0.05, D - 0.08, Z0 + 0.05, X1 - 0.05, D, Z1 - 0.05, WOOD);
    for (let x = X0 + 0.4; x < X1 - 0.2; x += 0.42) K.box(CM.matte, x, D, Z0 + 0.1, x + 0.02, D + 0.004, Z1 - 0.1, SEAM);
    cols.push(col.addBox(X0, Z0, X1, Z1, D - 0.7, D, 'roof'));
    // ---- the glass round it: panes, posts, the gold rail on top (and what keeps you from going over)
    const RAIL = 0.25;
    const edges = [[X0 + RAIL, Z0 + RAIL, X1 - RAIL, Z0 + RAIL], [X0 + RAIL, Z1 - RAIL, X1 - RAIL, Z1 - RAIL], [X0 + RAIL, Z0 + RAIL, X0 + RAIL, Z1 - RAIL], [X1 - RAIL, Z0 + RAIL, X1 - RAIL, Z1 - RAIL]];
    for (const [ax, az, bx, bz] of edges) {
      const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
      const t = 0.025;
      K.box(CM.glass, Math.min(ax, bx) - (alongX ? 0 : t), D, Math.min(az, bz) - (alongX ? t : 0), Math.max(ax, bx) + (alongX ? 0 : t), D + 1.1, Math.max(az, bz) + (alongX ? t : 0), GLASS);
      K.box(CM.metal, Math.min(ax, bx) - (alongX ? 0 : 0.05), D + 1.1, Math.min(az, bz) - (alongX ? 0.05 : 0), Math.max(ax, bx) + (alongX ? 0 : 0.05), D + 1.16, Math.max(az, bz) + (alongX ? 0.05 : 0), GOLD);
      const len = alongX ? Math.abs(bx - ax) : Math.abs(bz - az);
      for (let s = 0; s <= len + 1e-6; s += 2) {
        const px = alongX ? Math.min(ax, bx) + s : ax;
        const pz = alongX ? az : Math.min(az, bz) + s;
        K.box(CM.metal, px - 0.04, D, pz - 0.04, px + 0.04, D + 1.12, pz + 0.04, GOLD);
      }
      cols.push(col.addBox(Math.min(ax, bx) - 0.08, Math.min(az, bz) - 0.08, Math.max(ax, bx) + 0.08, Math.max(az, bz) + 0.08, D, D + 2.6, 'wall'));
    }
    // ---- the lift's house in the corner, its gold doors, its name
    {
      const { x0, x1, z0, z1 } = HOUSE;
      K.box(CM.matte, x0, D, z0, x1, D + 3.2, z1, STONE);
      K.box(CM.metal, x0 - 0.05, D + 3.2, z0 - 0.05, x1 + 0.05, D + 3.35, z1 + 0.05, GOLD);
      const dx = (x0 + x1) / 2;
      K.box(CM.metal, dx - 1.15, D, z1, dx + 1.15, D + 2.6, z1 + 0.06, GOLD);
      K.box(CM.paint, dx - 1.0, D, z1 + 0.06, dx + 1.0, D + 2.45, z1 + 0.08, linC(0.72, 0.56, 0.3));
      K.box(CM.matte, dx - 0.012, D, z1 + 0.08, dx + 0.012, D + 2.45, z1 + 0.09, linC(0.3, 0.22, 0.1));
      neonWord(K, CM.glow, 'LOBBY', 0.32, dx, D + 2.72, z1 + 0.06, 0, 1, linC(1, 0.85, 0.5), 0.0, 0.03);
      cols.push(col.addBox(x0, z0, x1, z1, D, D + 3.4, 'wall'));
    }
    // ---- the pool: its rim of white stone, the lights under its lip (the water: a picture, below)
    {
      const { x0, x1, z0, z1 } = POOL;
      const r = 0.35;
      for (const [a, b, c, d] of [[x0 - r, z0 - r, x1 + r, z0], [x0 - r, z1, x1 + r, z1 + r], [x0 - r, z0, x0, z1], [x1, z0, x1 + r, z1]]) K.box(CM.matte, a, D, b, c, D + 0.5, d, STONE);
      K.box(CM.paint, x0, D, z0, x1, D + 0.08, z1, linC(0.1, 0.45, 0.65));
      for (const [a, b, c, d] of [[x0, z0, x1, z0 + 0.05], [x0, z1 - 0.05, x1, z1], [x0, z0, x0 + 0.05, z1], [x1 - 0.05, z0, x1, z1]]) K.box(CM.glow, a, D + 0.3, b, c, D + 0.36, d, linC(0.4, 0.9, 1));
      cols.push(col.addBox(x0 - r, z0 - r, x1 + r, z1 + r, D, D + 1.0, 'prop'));
    }
    // ---- the daybeds along the pool, their parasols furled, a little table with a candle
    this.beds = [];
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const z = POOL.z0 + 1.6 + k * 4.0;
        const xa = side < 0 ? X0 + 0.7 : X1 - 2.7;
        const xb = xa + 2.0;
        K.box(CM.paint, xa, D, z - 0.65, xb, D + 0.3, z + 0.65, linC(0.35, 0.22, 0.12));
        K.box(CM.paint, xa + 0.05, D + 0.3, z - 0.6, xb - 0.05, D + 0.45, z + 0.6, WHITE);
        const hx = side < 0 ? xa + 0.2 : xb - 0.2;
        K.box(CM.paint, hx - 0.15, D + 0.45, z - 0.55, hx + 0.15, D + 0.75, z + 0.55, linC(0.2, 0.55, 0.65));
        cols.push(col.addBox(xa, z - 0.65, xb, z + 0.65, D, D + 0.45, 'prop'));
        const tz = z + 1.25;
        K.cyl(CM.paint, 0.22, 0.22, D, D + 0.45, linC(0.35, 0.22, 0.12), { axis: 'y', x: (xa + xb) / 2, z: tz, segs: 10 });
        K.sphere(CM.glow, 0.05, (xa + xb) / 2, D + 0.52, tz, BULB, 1, 1.4, 1, 6);
        // (the parasol, furled for the night: its pole, its folded cloth)
        const px = side < 0 ? xb + 0.25 : xa - 0.25;
        K.cyl(CM.metal, 0.03, 0.03, D, D + 2.6, linC(0.8, 0.8, 0.82), { axis: 'y', x: px, z: tz, segs: 6 });
        K.cyl(CM.paint, 0.12, 0.03, D + 1.5, D + 2.55, linC(0.9, 0.88, 0.8), { axis: 'y', x: px, z: tz, segs: 8 });
        this.beds.push({ x: (xa + xb) / 2, z, side });
      }
    }
    // ---- the DJ under its arch: the booth, the decks, the speakers on their stands, the heads
    {
      const { x, z } = DJ;
      K.box(CM.matte, x - 2.0, D, z - 0.5, x + 2.0, D + 1.15, z + 0.5, BLACK);
      K.box(CM.metal, x - 2.05, D + 1.15, z - 0.55, x + 2.05, D + 1.19, z + 0.55, linC(0.2, 0.2, 0.24));
      for (const s of [-1, 1]) K.cyl(CM.paint, 0.2, 0.2, D + 1.19, D + 1.23, linC(0.2, 0.2, 0.22), { axis: 'y', x: x + s * 0.7, z, segs: 14 });
      cols.push(col.addBox(x - 2.05, z - 0.55, x + 2.05, z + 0.55, D, D + 1.2, 'prop'));
      for (const s of [-1, 1]) {
        const sx = x + s * 3.6;
        for (const [ox, oz] of [[-0.3, -0.2], [0.3, -0.2], [0, 0.3]]) K.cyl(CM.metal, 0.02, 0.02, D, D + 1.3, BLACK, { axis: 'y', x: sx + ox, z: z + oz, segs: 4 });
        K.box(CM.matte, sx - 0.35, D + 1.3, z - 0.3, sx + 0.35, D + 2.4, z + 0.3, BLACK);
        for (const yy of [D + 1.55, D + 2.1]) K.cyl(CM.paint, 0.2, 0.2, z - 0.31, z - 0.29, linC(0.22, 0.22, 0.26), { x: sx, y: yy, segs: 12 });
        // the arch's posts
        K.box(CM.metal, x + s * 4.6 - 0.15, D, z + 0.25, x + s * 4.6 + 0.15, D + 5.0, z + 0.55, linC(0.75, 0.76, 0.8));
      }
      K.box(CM.metal, x - 4.75, D + 4.85, z + 0.25, x + 4.75, D + 5.15, z + 0.55, linC(0.75, 0.76, 0.8));
      this.heads = [];
      for (let k = 0; k < 6; k++) {
        const hx = x - 3.75 + k * 1.5;
        K.box(CM.matte, hx - 0.14, D + 4.55, z + 0.25, hx + 0.14, D + 4.85, z + 0.55, BLACK);
        this.heads.push({ i: k, x: hx, y: D + 4.5, z: z + 0.4 });
      }
      this.co2 = [[x - 2.6, D + 0.4, z - 0.4], [x + 2.6, D + 0.4, z - 0.4]];
      for (const [cx, , cz] of this.co2) {
        K.cyl(CM.matte, 0.12, 0.12, D, D + 0.3, BLACK, { axis: 'y', x: cx, z: cz, segs: 10 });
        K.cyl(CM.metal, 0.05, 0.05, D + 0.3, D + 0.4, linC(0.6, 0.6, 0.65), { axis: 'y', x: cx, z: cz, segs: 8 });
      }
    }
    // ---- the bar at the near end: its counter, the back bar of bottles, the stools
    {
      const { x0, x1, z0, z1 } = BAR;
      K.box(CM.paint, x0, D, z1 - 0.6, x1, D + 1.1, z1, linC(0.18, 0.1, 0.06));
      K.box(CM.metal, x0 - 0.1, D + 1.1, z1 - 0.7, x1 + 0.1, D + 1.16, z1 + 0.1, linC(0.9, 0.88, 0.84));
      K.box(CM.glow, x0, D + 0.15, z1 + 0.005, x1, D + 0.2, z1 + 0.012, linC(1, 0.7, 0.4));
      K.box(CM.paint, x0, D, z0 - 0.4, x1, D + 0.95, z0, linC(0.18, 0.1, 0.06));
      cols.push(col.addBox(x0 - 0.1, z1 - 0.7, x1 + 0.1, z1 + 0.1, D, D + 1.16, 'prop'));
      cols.push(col.addBox(x0, z0 - 0.4, x1, z0, D, D + 2.4, 'prop'));
      this.stools = [];
      for (let x = x0 + 0.5; x < x1 - 0.3; x += 0.85) {
        K.cyl(CM.metal, 0.03, 0.03, D, D + 0.74, GOLD, { axis: 'y', x, z: z1 + 0.5, segs: 6 });
        K.cyl(CM.paint, 0.2, 0.2, D + 0.74, D + 0.82, linC(0.9, 0.9, 0.86), { axis: 'y', x, z: z1 + 0.5, segs: 12 });
        this.stools.push([x, z1 + 0.5]);
      }
      neonWord(K, CM.glow, 'SKY BAR', 0.5, (x0 + x1) / 2, D + 2.55, z0 + 0.02, 0, 1, linC(0.4, 0.9, 1), 0.0, 0.04);
    }
    // ---- the lounge's sofas by the bar; the planters with their palms
    sofa(K, CM, X0 + 1.6, Z0 + 5.6, D, 1, 0, linC(0.92, 0.9, 0.84), 2.2);
    sofa(K, CM, X1 - 1.6, Z0 + 5.6, D, -1, 0, linC(0.92, 0.9, 0.84), 2.2);
    for (const [px, pz] of [[X0 + 0.9, Z1 - 0.9], [X1 - 0.9, Z1 - 0.9], [X0 + 0.9, Z0 + 7.6], [X1 - 0.9, Z0 + 7.6], [X0 + 0.9, Z0 + 24.6], [X1 - 0.9, Z0 + 24.6]]) {
      K.cyl(CM.paint, 0.45, 0.38, D, D + 0.8, linC(0.85, 0.83, 0.78), { axis: 'y', x: px, z: pz, segs: 12 });
      K.cyl(CM.paint, 0.08, 0.06, D + 0.8, D + 3.2, linC(0.45, 0.33, 0.22), { axis: 'y', x: px, z: pz, segs: 6 });
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        K.sphere(CM.paint, 0.55, px + Math.cos(a) * 0.55, D + 3.15, pz + Math.sin(a) * 0.55, linC(0.2, 0.5, 0.25), 1.4, 0.18, 0.5, 6);
      }
      cols.push(col.addBox(px - 0.45, pz - 0.45, px + 0.45, pz + 0.45, D, D + 1.0, 'prop'));
    }
    // ---- the strings of bulbs, zigzagging from side to side over the deck between their poles
    const poles = [];
    for (let z = Z0 + 5; z < Z1 - 1; z += 4) for (const x of [X0 + 0.55, X1 - 0.55]) {
      K.cyl(CM.metal, 0.04, 0.04, D, D + 4.0, BLACK, { axis: 'y', x, z, segs: 6 });
      poles.push([x, z]);
    }
    this.strings = [];
    for (let z = Z0 + 5; z + 4 < Z1 - 1; z += 4) {
      const a = [X0 + 0.55, D + 3.95, z];
      const b = [X1 - 0.55, D + 3.95, z + 4];
      this.strings.push([a, b]);
      const n = Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / (touch ? 0.9 : 0.55));
      for (let k = 1; k < n; k++) {
        const s = k / n;
        K.sphere(CM.glow, 0.06, a[0] + (b[0] - a[0]) * s, a[1] - Math.sin(s * Math.PI) * 0.8, a[2] + (b[2] - a[2]) * s, BULB, 1, 1.3, 1, 6);
      }
    }
    const group = K.build({ seed: 0.73 });
    // ---- the pictures: the water, the back bar's bottles, the LED wall behind the DJ
    const PW = touch ? 64 : 128;
    this.poolC = canvas(PW, PW * 3);
    this.poolTex = canvasTexture(this.poolC, { mips: false });
    this.poolMat = makeSurface({ kind: 'uv', map: this.poolTex, uvScale: 1, ang: 0.3, wash: 1, line: 0.05, emissive: new THREE.Color(0.9, 0.95, 1.0), emMap: this.poolTex });
    {
      const { x0, x1, z0, z1 } = POOL;
      const m = new THREE.Mesh(floorQuad([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], D + 0.42), this.poolMat);
      m.frustumCulled = false;
      group.add(m);
    }
    this.bottleTex = canvasTexture(paintBottles(touch ? 256 : 512, touch ? 128 : 256), { mips: true });
    this.bottleMat = makeSurface({ kind: 'uv', map: this.bottleTex, uvScale: 1, ang: 0.4, wash: 0.9, line: 0.2, emissive: new THREE.Color(0.6, 0.55, 0.45), emMap: this.bottleTex });
    {
      const { x0, x1, z0 } = BAR;
      const m = new THREE.Mesh(pictureGeo(x1 - x0 - 0.4, 1.3, (x0 + x1) / 2, D + 1.65, z0 + 0.01, 0, 1), this.bottleMat);
      m.frustumCulled = false;
      group.add(m);
    }
    const LW = touch ? 192 : 384;
    this.ledC = canvas(LW, Math.round(LW * 0.4));
    this.ledTex = canvasTexture(this.ledC, { mips: false });
    this.ledMat = makeSurface({ kind: 'uv', map: this.ledTex, uvScale: 1, ang: 0.3, wash: 1, line: 0.06, emissive: new THREE.Color(1.5, 1.5, 1.5), emMap: this.ledTex });
    {
      const w = 8.6;
      const h = 3.44;
      this.ledAt = [DJ.x, D + 1.35 + h / 2, DJ.z + 0.62];
      const m = new THREE.Mesh(pictureGeo(w, h, this.ledAt[0], this.ledAt[1], this.ledAt[2], 0, -1), this.ledMat);
      m.frustumCulled = false;
      group.add(m);
      this.led = m;
      const KL = new Kit();
      KL.box(CM.matte, DJ.x - w / 2 - 0.1, D + 1.25, DJ.z + 0.64, DJ.x + w / 2 + 0.1, D + 1.35 + h + 0.1, DJ.z + 0.75, BLACK);
      for (const mm of KL.build({ seed: 0.2 }).children.slice()) group.add(mm);
    }
    this.mats = [this.poolMat, this.bottleMat, this.ledMat];
    this.texs = [this.poolTex, this.bottleTex, this.ledTex];
    group.updateMatrix();
    g.scene.add(group);
    this.set = group;
    // the lobby's lift (in the casino's hall): its doors, its call button, its sign
    this.lobby = this.buildLobby(CM);
    g.scene.add(this.lobby);
    this.makeCrowd();
    this.paint();
  }

  buildLobby(CM) {
    const K = new Kit();
    const GOLD = linC(0.85, 0.65, 0.25);
    const { x, z } = LIFT;
    const xf = x + 0.03;
    K.box(CM.metal, x, FY, z - 1.35, xf + 0.08, FY + 3.3, z + 1.35, GOLD);
    K.box(CM.paint, xf + 0.08, FY, z - 1.1, xf + 0.1, FY + 3.0, z + 1.1, linC(0.72, 0.56, 0.3));
    K.box(CM.matte, xf + 0.1, FY, z - 0.012, xf + 0.11, FY + 3.0, z + 0.012, linC(0.3, 0.22, 0.1));
    K.box(CM.metal, xf + 0.08, FY + 1.1, z + 1.5, xf + 0.12, FY + 1.5, z + 1.75, linC(0.2, 0.2, 0.22));
    K.sphere(CM.glow, 0.04, xf + 0.13, FY + 1.3, z + 1.62, linC(1, 0.8, 0.4), 1, 1, 1, 6);
    neonWord(K, CM.glow, 'SKY POOL', 0.42, xf + 0.08, FY + 3.45, z, 1, 0, linC(0.4, 0.9, 1), 0.0, 0.04);
    const grp = K.build({ seed: 0.11 });
    grp.updateMatrix();
    return grp;
  }

  teardown() {
    const g = this.game;
    for (const s of [this.set, this.lobby]) {
      if (!s) continue;
      g.scene.remove(s);
      s.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
      });
    }
    for (const t of this.texs || []) t.dispose();
    for (const m of this.mats || []) m.dispose();
    for (const id of this.cols) g.world.collision.remove(id);
    this.cols = [];
    this.texs = [];
    this.mats = [];
    this.set = null;
    this.lobby = null;
    this.crowd = [];
    this.sound.stop();
  }

  // ------------------------------------------------------------------ the people
  makeCrowd() {
    const g = this.game;
    const N = g.touch ? 0.4 : 1;
    const list = [];
    const person = (x, z, yaw, at, o = {}) => {
      const look = o.look || barLook(BAR_STYLE_NAMES[Math.floor(R() * BAR_STYLE_NAMES.length)]);
      const y = o.y || DECK;
      list.push({ x, z, y, y0: y, look, scale: look.build.height, yaw, yaw0: yaw, speed: 0, phase: R() * 6, seed: R() * 100, cheer: 0, sit: 0, at, hop: R(), feel: 0.4 + R() * 0.6, ...o });
    };
    // (facing the DJ: the +z way)
    for (let x = DANCE.x0 + 0.3; x < DANCE.x1; x += 0.85) {
      for (let z = DANCE.z0 + 0.3; z < DANCE.z1; z += 0.9) {
        if (R() > 0.62 * N + 0.05) continue;
        person(x + (R() - 0.5) * 0.4, z + (R() - 0.5) * 0.4, (R() - 0.5) * (R() < 0.8 ? 0.7 : 3), 'dance');
      }
    }
    // the DJ
    const L = modest(civilianLook({ kind: 'street', pen: 'comic' }));
    L.acc = (L.acc || []).filter((a) => a !== 'headphones').concat(['headphones']);
    person(DJ.x, DJ.z + 0.15, Math.PI, 'dj', { look: L });
    // the bar: the bartenders behind it, the people on its stools and behind them
    for (const dx of [-2, 2]) person((BAR.x0 + BAR.x1) / 2 + dx, BAR.z0 + 0.45, 0, 'staff', { look: bartenderLook() });
    for (const [sx, sz] of this.stools) {
      if (R() < 0.55 * N + 0.15) person(sx, sz, Math.PI, 'bar', { sit: 1, y: DECK + 0.33 });
      if (R() < 0.3 * N) person(sx + (R() - 0.5) * 0.3, sz + 0.75, Math.PI, 'bar');
    }
    // on the daybeds; on the pool's edge, their backs to the water; at the glass, looking out
    for (const b of this.beds) {
      if (R() < 0.75 * N + 0.1) person(b.x + b.side * 0.3, b.z - 0.3, b.side < 0 ? Math.PI / 2 : -Math.PI / 2, 'lounge', { sit: 1, y: DECK - 0.02 });
      if (R() < 0.6 * N) person(b.x + b.side * 0.3, b.z + 0.3, b.side < 0 ? Math.PI / 2 : -Math.PI / 2, 'lounge', { sit: 1, y: DECK - 0.02 });
    }
    for (let z = POOL.z0 + 1; z < POOL.z1 - 0.5; z += 2.2) {
      for (const s of [-1, 1]) if (R() < 0.45 * N) person(s < 0 ? POOL.x0 - 0.45 : POOL.x1 + 0.45, z + (R() - 0.5) * 0.6, s < 0 ? -Math.PI / 2 : Math.PI / 2, 'edge', { sit: 1, y: DECK + 0.04 });
    }
    for (let k = 0; k < (g.touch ? 3 : 7); k++) {
      const s = R() < 0.5 ? -1 : 1;
      const z = Z0 + 6 + R() * (Z1 - Z0 - 12);
      person(s < 0 ? X0 + 0.65 : X1 - 0.65, z, s < 0 ? -Math.PI / 2 : Math.PI / 2, 'view');
    }
    // the security by the lift; the waiter with the tray
    person(HOUSE.x1 + 0.6, HOUSE.z1 + 0.4, Math.PI / 4, 'guard', { look: bouncerLook() });
    person(CX + 3.2, POOL.z0 - 1.2, Math.PI / 2, 'waiter', { look: bartenderLook(), tray: true, xMin: X0 + 3, xMax: X1 - 3, dir: 1, v: 0.7 });
    this.crowd = list;
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    const g = this.game;
    if (!BLOCK || this.failed) return;
    const ml = g.world.mainland;
    const p = g.player.pos;
    const built = !!(ml && ml.blocks && ml.blocks.has(BLOCK.id));
    const dist = Math.hypot(p.x - CX, p.z - (Z0 + Z1) / 2);
    if (!this.set && built && dist < NEAR) {
      try {
        this.build();
      } catch (e) {
        console.error('[sky pool]', e);
        this.failed = true;
        this.teardown();
        return;
      }
    }
    if (this.set && (!built || dist > NEAR + 40)) this.teardown();
    if (!this.set) return;
    this.t += dt;
    const on = this.open();
    const cam = g.camera.position;
    const camUp = this.onRoof(cam.x, cam.y, cam.z, 9);
    const up = this.onRoof(p.x, p.y, p.z);
    this.camUp = camUp;
    this.up = up;
    const S = this.sound;
    if (on && (up || camUp) && !S.band) S.start();
    if (S.band && (!on || !(up || camUp))) S.stop();
    const playing = !!(g.minigames && g.minigames.isOpen);
    this.dancing = playing && this.dancing;
    const running = !!(S.band && S.c && S.c.state === 'running');
    if (running) {
      const part = partOf(Math.floor(S.bar));
      S.update(playing ? 0 : 0.34, part === 'build' ? 500 + 12000 * Math.pow(Math.max(0, S.bar - 20) / 4, 2) : part === 'break' ? 2600 : 16000);
      this.beat = S.beat;
      this.bar = S.bar;
      this.songN = S.n;
      this.barSec = S.spb * 16;
      if (this.bar >= 19 && this.bar < 23.5 && S.cued !== S.n) {
        S.cued = S.n;
        S.riser(S.at(20), S.at(24) - 4 * S.spb);
        S.crash(S.at(24));
      }
    } else {
      this.clock += dt;
      this.barSec = (4 * 60) / BPM;
      const bars = this.clock / this.barSec;
      this.songN = Math.floor(bars / BARS);
      this.bar = bars - this.songN * BARS;
      this.beat = this.bar * 4;
    }
    this.part = on ? partOf(Math.floor(this.bar)) : 'off';
    this.prog = this.part === 'build' ? (this.bar - 20) / 4 : 0;
    this.dropT = this.part === 'drop' ? (this.bar - 24) * this.barSec : 99;
    this.hue = HUES[pm(this.songN, HUES.length)];
    if (this.part === 'drop' && this.dropped !== this.songN) {
      this.dropped = this.songN;
      if (up || camUp) this.drop();
    }
    if (up && !this.welcomed) {
      this.welcomed = true;
      g.hud.big('SKY POOL', 2200);
      if (on) g.hud.toast('מסיבת הגג של PALACE OF INK! E ליד הדי ג׳יי לרקוד או לבקש את הדרופ, בבר לקוקטייל, ובמעלית חזרה ללובי', 'info', 5);
    }
    if (!up) this.welcomed = false;
    if (this.led) this.led.visible = !this.dancing;
    if (camUp) {
      this.paintT = (this.paintT || 0) + dt;
      if (this.paintT >= (g.touch ? 0.12 : 0.07)) {
        this.paint();
        this.paintT = 0;
      }
    }
    if (up || camUp) this.animate(dt);
  }

  paint() {
    const s = { t: this.t, beat: this.beat, part: this.part === 'off' ? 'break' : this.part, prog: this.prog || 0, dropT: this.dropT, name: 'SKY POOL', hue: this.hue };
    paintLED(this.ledC.getContext('2d'), this.ledC.width, this.ledC.height, s);
    this.ledTex.needsUpdate = true;
    paintPool(this.poolC.getContext('2d'), this.poolC.width, this.poolC.height, this.t);
    this.poolTex.needsUpdate = true;
  }

  drop() {
    const g = this.game;
    const fx = g.fx;
    if (fx) {
      for (const [x, y, z] of this.co2) fx.spray(x, y, z, 0, 1, 0, g.touch ? 10 : 20, 11, [0.92, 0.95, 1], { cone: 0.1, len: 0.6, wide: 9, life: 0.85, grav: false });
      for (const dx of [-3, 0, 3]) fx.confetti(DJ.x + dx, DECK + 5, DJ.z - 1, g.touch ? 16 : 34, 4);
    }
    g.audio.play('whoosh', 0.35);
    g.audio.play('cheer', 0.5);
  }

  animate(dt) {
    const b = this.beat;
    const part = this.part;
    const prog = this.prog;
    const t = this.t;
    for (const w of this.crowd) {
      if (part === 'off') {
        w.cheer = 0;
        w.y = w.y0;
        if (w.at !== 'waiter') continue;
      }
      const bounce = Math.abs(Math.sin(Math.PI * (b + w.hop * 0.3)));
      if (w.at === 'dance') {
        w.sit = 0;
        if (part === 'groove') {
          w.y = w.y0 + bounce * 0.07 * w.feel;
          w.cheer = (Math.floor(b + w.hop * 4) % 4 === 0 ? 0.9 : 0.15) * w.feel * (w.hop > 0.5 ? 1 : 0.4);
        } else if (part === 'break') {
          w.y = w.y0 + Math.abs(Math.sin(t * 1.6 + w.seed)) * 0.03;
          w.cheer = w.hop > 0.85 ? 0.6 : 0;
        } else if (part === 'build') {
          const low = prog > 0.88 ? 1 : 0;
          w.sit = low * 0.32;
          w.y = w.y0 + (low ? 0 : bounce * 0.05 * (1 + prog * 2));
          w.cheer = low ? 0 : Math.min(1, prog * 1.3);
        } else {
          const big = this.dropT < this.barSec * 4 ? 1 : 0.55;
          w.y = w.y0 + Math.pow(bounce, 0.8) * (0.12 + 0.22 * big * w.feel);
          w.cheer = big > 0.9 ? 1 : (Math.floor(b * 2 + w.hop * 4) % 2 ? 1 : 0.3) * w.feel;
        }
        w.yaw = w.yaw0 + Math.sin(t * 1.4 + w.seed) * 0.3;
      } else if (w.at === 'dj') {
        w.cheer = part === 'build' ? 1 : 0.35 + 0.3 * bounce;
        w.y = w.y0 + bounce * 0.04;
      } else if (w.at === 'bar' || w.at === 'lounge' || w.at === 'edge' || w.at === 'view') {
        w.cheer = part === 'drop' && this.dropT < 3 ? 1 : Math.sin(t * 0.7 + w.seed * 3) > 0.92 ? 0.5 : 0;
        if (w.at === 'view') w.yaw = w.yaw0 + Math.sin(t * 0.2 + w.seed) * 0.5;
      } else if (w.at === 'staff') {
        w.cheer = 0.4 + 0.2 * Math.sin(t * 3 + w.seed);
      } else if (w.at === 'waiter') {
        if (w.pause > 0) {
          w.pause -= dt;
          w.speed = 0;
        } else {
          w.x += w.dir * w.v * dt;
          w.speed = 2.4;
          w.yaw = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          if (w.x > w.xMax || w.x < w.xMin) w.dir = -w.dir;
          else if (R() < dt * 0.15) w.pause = 2 + R() * 3;
        }
        w.cheer = 0.55;
        w.phase += dt * 3 * (w.speed > 0 ? 1 : 0);
      }
    }
  }

  // ------------------------------------------------------------------ drawing (game/game.js)
  draw(fr) {
    if (!this.set) return;
    const g = this.game;
    const cam = g.camera.position;
    const camUp = this.camUp;
    if (camUp) drawPeople(g, this.crowd, g.touch ? 30 : 48);
    const night = g.daynight ? g.daynight.night : 1;
    if (this.part === 'off') return;
    const b = this.beat;
    const ph = b - Math.floor(b);
    const pulse = Math.pow(1 - ph, 2);
    const t = this.t;
    const drop = this.part === 'drop';
    // the heads' beams up into the night over the city (seen from the street too)
    const dc = Math.hypot(cam.x - CX, cam.z - (Z0 + Z1) / 2);
    if (night > 0.2 && dc < 600 && this.part !== 'break') {
      let id = 7900;
      for (const h of this.heads) {
        const sw = Math.sin(t * (drop ? 1.2 : 0.6) + h.i * 1.1) * 0.7;
        const up = 0.9 + Math.sin(t * 0.5 + h.i) * 0.35;
        const len = 70;
        const ex = h.x + Math.sin(sw) * Math.cos(up) * len;
        const ey = h.y + Math.sin(up) * len;
        const ez = h.z - Math.cos(sw) * Math.cos(up) * len * 0.4 + Math.cos(sw) * Math.cos(up) * len * 0.2;
        const c = BEAM_C[pm(h.i + Math.floor(b / (drop ? 1 : 4)), BEAM_C.length)];
        const al = (0.16 + 0.3 * (drop ? pulse : 0.4)) * night;
        for (let k = -1; k <= 1; k++) fr.lineXYZ(h.x, h.y, h.z, ex + k * 1.2, ey, ez + k * 0.6, c, 6 - Math.abs(k) * 2, id++, al * (k ? 0.5 : 1), 0.002, 0);
      }
    }
    if (!camUp) return;
    // the lights of the party: warm under the bulbs, the pool's glow, the DJ's colour on the dancers
    flashLight(CX, DECK + 3.2, Z0 + 10, 13, _warm, 1.2 * night + 0.3);
    flashLight(CX, DECK + 3.2, Z0 + 21, 13, _warm, 1.2 * night + 0.3);
    flashLight(CX, DECK + 0.8, (POOL.z0 + POOL.z1) / 2, 9, _pool, 1.4);
    const c1 = BEAM_C[pm(Math.floor(b / (drop ? 1 : 2)), BEAM_C.length)];
    _c1.setRGB(c1[0], c1[1], c1[2]);
    flashLight(CX + Math.sin(t) * 2, DECK + 3.5, (DANCE.z0 + DANCE.z1) / 2, 9, _c1, 1.2 + 0.8 * pulse);
    if (drop && this.dropT < 1.2) flashLight(CX, DECK + 3, (DANCE.z0 + DANCE.z1) / 2, 16, _white, 2.5 * (1 - this.dropT / 1.2));
  }

  // ------------------------------------------------------------------ what you can do there
  target() {
    if (!this.set || (this.game.minigames && this.game.minigames.isOpen)) return null;
    const p = this.game.player.pos;
    // (in the casino's hall: the lift up)
    if (p.y < DECK - 10 && p.x < LIFT.x + 2.9 && p.x > LIFT.x && Math.abs(p.z - LIFT.z) < 1.7) return { kind: 'up', label: 'E — מעלית ל־SKY POOL: מסיבת הגג (קומה 66)' };
    if (!this.onRoof(p.x, p.y, p.z)) return null;
    const hx = (HOUSE.x0 + HOUSE.x1) / 2;
    if (Math.abs(p.x - hx) < 1.4 && p.z > HOUSE.z1 && p.z < HOUSE.z1 + 1.6) return { kind: 'down', label: 'E — מעלית חזרה ללובי של הקזינו' };
    if (this.part === 'off') return null;
    if (p.x > BAR.x0 && p.x < BAR.x1 && p.z > BAR.z1 && p.z < BAR.z1 + 1.5) return { kind: 'bar', label: 'E — SKY BAR: קוקטיילים מול הנוף' };
    if (Math.abs(p.x - DJ.x) < 2.4 && p.z < DJ.z - 0.5 && p.z > DJ.z - 1.9) return { kind: 'dj', label: 'E — לבקש מהדי ג׳יי את הדרופ ($20)' };
    if (p.x > DANCE.x0 && p.x < DANCE.x1 && p.z > DANCE.z0 && p.z < DANCE.z1) return { kind: 'dance', label: 'E — לרקוד מול הדי ג׳יי (Ink Beat)' };
    return null;
  }

  interact() {
    const tg = this.target();
    if (!tg) return false;
    const g = this.game;
    if (tg.kind === 'up' || tg.kind === 'down') {
      this.ride(tg.kind === 'up');
      return true;
    }
    if (tg.kind === 'bar') {
      const menu = [['סאנסט ספריץ על הגג (+20 חיים)', 14, 20, [1, 0.55, 0.3]], ['מוחיטו קפוא (+15 חיים)', 11, 15, [0.7, 1, 0.6]], ['לימונדה ורודה (+10 חיים)', 6, 10, [1, 0.6, 0.75]]];
      g.dialog.show('SKY BAR', 'Best view in the city. What can I get you?', menu.map(([label, price, hp, colr]) => ({
        label: `${label} · $${price}`,
        fn: () => {
          if (!g.money || g.money.pay(price, label)) {
            const pl = g.player;
            pl.hp = Math.min(pl.maxHp, pl.hp + hp);
            pl.fig.belly = Math.min(1, pl.fig.belly + 0.15);
            pl.fig.bellyColor = colr;
            g.audio.play('coins', 0.5);
            g.hud.toast(`${label.split(' (')[0]}! +${hp} חיים`, 'good', 2);
          } else g.money.refuse('SKY BAR', price);
        },
      })));
      return true;
    }
    if (tg.kind === 'dj') {
      if (this.part === 'build' || (this.part === 'drop' && this.dropT < 8)) {
        g.hud.toast('הדי ג׳יי מצביע על השמיים: זה כבר קורה!', 'info', 2.5);
        return true;
      }
      if (g.money && !g.money.pay(20, 'DJ')) {
        g.money.refuse('SKY POOL', 20);
        return true;
      }
      const S = this.sound;
      if (S.band && S.c && S.c.state === 'running') S.jump(20);
      else this.clock = (this.songN * BARS + 20) * ((4 * 60) / BPM);
      g.audio.play('coins', 0.5);
      g.hud.toast('הדי ג׳יי מרים יד אל הקהל: הדרופ בדרך!', 'good', 3);
      return true;
    }
    if (tg.kind === 'dance') {
      if (!g.minigames) return false;
      const p = g.player;
      p.fig.dance = 1;
      this.dancing = true;
      const x = Math.max(DANCE.x0 + 1, Math.min(DANCE.x1 - 1, p.pos.x));
      const stand = this.ledAt[2] - (DANCE.z0 + 2.5);
      const world = worldAt({ at: this.ledAt, n: [0, -1], w: 8.6, h: 3.44, stand, side: -(x - DJ.x), y0: DECK, back: 3.2, up: 2.6, camSide: 0, exit: [x, DANCE.z0 + 2.5, 0] });
      g.minigames.play(new DanceGame({ venue: 'SKY POOL', style: 'synth', tips: true }), (r) => {
        p.fig.dance = 0;
        this.dancing = false;
        if (r && (r.grade === 'S' || r.grade === 'A')) {
          for (const q of this.crowd) if (q.at === 'dance') q.cheer = 1;
          g.audio.play('cheer', 0.5);
          g.hud.toast('כל הגג רקד אחריכם!', 'good', 2.8);
        } else if (r && r.grade) g.hud.toast('רקדתם מעל העיר', 'good', 2.4);
      }, { world });
      return true;
    }
    return false;
  }

  // the lift: up the tower in a breath, or down to the hall
  ride(up) {
    const g = this.game;
    if (this.riding) return;
    this.riding = true;
    g.audio.play('coins', 0.25);
    g.hud.toast(up ? 'המעלית עולה… 66 קומות מעל המפרץ' : 'המעלית יורדת ללובי…', 'info', 1.6);
    const go = () => {
      this.riding = false;
      const p = g.player;
      // (out of the lift's house facing along the deck: the camera behind you over the edge, not in the house)
      const [x, y, z, yaw] = up ? [(HOUSE.x0 + HOUSE.x1) / 2 + 0.4, DECK + 0.02, HOUSE.z1 + 1.3, Math.PI / 2] : [LIFT.x + 1.4, FY + 0.02, LIFT.z, Math.PI / 2];
      p.pos.set(x, y, z);
      p.vel.set(0, 0, 0);
      p.yaw = yaw;
      p.fig.yaw = yaw;
      if (g.camRig) g.camRig.yaw = yaw;
    };
    if (g.inkwell && g.inkwell.after) g.inkwell.after(1.1, go);
    else go();
  }
}

const _warm = new THREE.Color(1, 0.8, 0.55);
const _pool = new THREE.Color(0.35, 0.85, 1);
const _white = new THREE.Color(1, 1, 1);
const _c1 = new THREE.Color();
