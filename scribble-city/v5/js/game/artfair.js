import * as THREE from 'three';
import { linC } from './items.js';
import { letter } from '../world/letters.js';
import { canvas } from '../world/kit.js';
import { makeSurface, canvasTexture } from '../render/materials.js';
import { paintArtAtlas } from '../world/murals.js';
import { DOODLES } from './minigames/drawoff.js';

// (v5, ROADMAP 12.5ה) Art Night as an art fair, in Paintwood's Walls. From the north arch: the red
// carpet between velvet ropes, the wall of logos and the photographers' flashes, the info booth;
// a tunnel of rings of light; the White Cube - a white pavilion, its works framed and lit by spots
// on a track, a partition down its middle, the gallerist at her desk; the sculpture plaza - a giant
// balloon dog in pink chrome, INK in red letters, a pen nib in gold, painters at their easels;
// the Neon Box - a black pavilion of neon works, its face to the plaza a screen for the projector
// on its tower; an infinity room, a floor of light that lights under your feet, a giant rubber
// duck; the champagne bar with its tower of glasses, high tables in white cloth, a lounge, the
// lanterns over them, the DJ; a mural painted live from a scaffold; the Draw-Off's stage.
//
// This module builds it into the night's Kit (game/artnight.js owns it) and returns what moves
// (the projection, the floor of light, the live mural, the flashes) and where the people go.

const WHITE = linC(0.95, 0.94, 0.92);
const BLACK = linC(0.05, 0.05, 0.06);
const GOLD = linC(0.86, 0.68, 0.3);
const STEEL = linC(0.72, 0.74, 0.78);
const RED = linC(0.62, 0.05, 0.08);
const NEON = [linC(1, 0.25, 0.6), linC(0.25, 0.9, 1), linC(1, 0.85, 0.2), linC(0.5, 1, 0.45), linC(0.7, 0.45, 1)];

// a white that is lit from inside (the pavilion's walls at night)
let LIT = null;
function litMat() {
  if (!LIT) LIT = makeSurface({ kind: 'box', vcolor: true, emissive: new THREE.Color(0.42, 0.42, 0.42), emVColor: true });
  return LIT;
}

// the plan: where everything stands (numbers only)
export function fairPlan(Y) {
  const { X1, Z0, CX } = Y;
  return {
    carpet: { x0: CX - 1.4, x1: CX + 1.4, z0: Z0 + 1.8, z1: Z0 + 12 },
    photoWall: { x: CX - 3.4, z0: Z0 + 4.5, z1: Z0 + 10.5, h: 2.7 },
    photographers: [[CX + 3.0, Z0 + 6.0], [CX + 3.7, Z0 + 7.5], [CX + 2.9, Z0 + 9.0], [CX + 3.6, Z0 + 10.3]],
    info: { x0: CX + 4.8, x1: CX + 7.8, z0: Z0 + 3, z1: Z0 + 5.6 },
    rings: [Z0 + 14, Z0 + 16.4, Z0 + 18.8, Z0 + 21.2],
    pavA: { x0: CX - 7, x1: CX + 7, z0: Z0 + 24, z1: Z0 + 37, h: 3.8, door: 2.2 },
    dog: { x: CX, z: Z0 + 44.5 },
    ink: { x: CX - 6.2, z: Z0 + 44.5 },
    nib: { x: CX + 5.0, z: Z0 + 44.5 },
    easels: [[CX + 9.3, Z0 + 40.2], [CX + 9.3, Z0 + 43.6], [CX + 9.3, Z0 + 47], [CX + 9.3, Z0 + 50.4]],
    projector: { x: CX + 2.6, z: Z0 + 38.6, h: 3.6 },
    pavB: { x0: CX - 6, x1: CX + 6, z0: Z0 + 53, z1: Z0 + 63, h: 5, door: 2 },
    infinity: { x: CX + 6.4, z: Z0 + 69.4, s: 3 },
    floor: { x0: CX - 3.2, x1: CX + 3.2, z0: Z0 + 66, z1: Z0 + 72.4, n: 8 },
    duck: { x: CX - 7.4, z: Z0 + 69.4 },
    bar: { x: CX - 8.6, z0: Z0 + 76.5, z1: Z0 + 81.5 },
    tables: [[CX - 5.2, Z0 + 77.6], [CX - 2.6, Z0 + 80.4], [CX - 5.0, Z0 + 83.4], [CX - 0.4, Z0 + 77.2], [CX + 0.2, Z0 + 83.2], [CX - 2.4, Z0 + 85.6]],
    lounge: [{ x: CX + 5.4, z: Z0 + 78.6 }, { x: CX + 5.4, z: Z0 + 84.2 }],
    dj: { x: CX - 8.8, z: Z0 + 85.4 },
    scaffold: { x: X1 - 1.2, z0: Z0 + 73.5, z1: Z0 + 85.5 },
    lanterns: { x0: CX - 8, x1: CX + 8, z0: Z0 + 76, z1: Z0 + 87 },
    // (where the walls' watchers do not stand: the easels, the scaffold)
    keepOff: [{ side: 1, z0: Z0 + 38, z1: Z0 + 52 }, { side: 1, z0: Z0 + 72, z1: Z0 + 87 }],
  };
}

// a thin bar from a to b (any way: a neon tube, a scaffold's brace, a rope)
function rod(K, mat, a, b, t, color) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const L = d.length();
  if (L < 1e-4) return;
  const g = new THREE.BoxGeometry(L, t, t);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  K.add(mat, g, color);
}

// letters in light on a wall: along the wall's right (rx, rz) from its middle, h high, w out of it
function sign(K, mat, txt, cx, y, cz, rx, rz, nx, nz, h, color, depth = 0.05) {
  letter(txt, h, (a0, b0, a1, b1) => {
    const x0 = cx + rx * a0;
    const z0 = cz + rz * a0;
    const x1 = cx + rx * a1;
    const z1 = cz + rz * a1;
    K.box(mat, Math.min(x0, x1) + Math.min(0, nx * depth), y + b0, Math.min(z0, z1) + Math.min(0, nz * depth), Math.max(x0, x1) + Math.max(0, nx * depth), y + b1, Math.max(z0, z1) + Math.max(0, nz * depth), color);
  });
}

// ------------------------------------------------------------------ the build
// Y: { X0, X1, Z0, Z1, CX, GY, touch }; K, M: the night's Kit and its materials; col: collision
export function buildFair(K, M, Y, col) {
  const P = fairPlan(Y);
  const { GY, CX } = Y;
  const cols = [];
  const box = (x0, z0, x1, z1, y1, kind = 'prop') => cols.push(col.addBox(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), -1, y1, kind));
  const L = litMat();
  const meshes = [];
  const out = { plan: P, cols, meshes };

  // ---- the red carpet, its ropes, the wall of logos, the info booth
  const C = P.carpet;
  K.box(M.matte, C.x0, GY, C.z0, C.x1, GY + 0.025, C.z1, RED);
  for (const x of [C.x0 - 0.25, C.x1 + 0.25]) {
    let prev = null;
    for (let z = C.z0 + 0.5; z <= C.z1 + 0.01; z += 1.9) {
      K.cyl(M.metal, 0.05, 0.05, GY, GY + 0.95, GOLD, { axis: 'y', x, z });
      K.sphere(M.metal, 0.08, x, GY + 1.0, z, GOLD, 1, 1, 1, 8);
      if (prev !== null) {
        rod(K, M.matte, [x, GY + 0.86, prev], [x, GY + 0.78, (prev + z) / 2], 0.05, RED);
        rod(K, M.matte, [x, GY + 0.78, (prev + z) / 2], [x, GY + 0.86, z], 0.05, RED);
      }
      prev = z;
    }
  }
  const PW = P.photoWall;
  K.box(M.matte, PW.x - 0.12, GY, PW.z0, PW.x, GY + PW.h, PW.z1, BLACK);
  for (const z of [PW.z0 - 0.2, PW.z1 + 0.2]) {
    K.cyl(M.metal, 0.03, 0.03, GY, GY + 2.2, STEEL, { axis: 'y', x: PW.x + 1.2, z });
    K.box(M.glow, PW.x + 1.1, GY + 2.0, z - 0.3, PW.x + 1.16, GY + 2.5, z + 0.3, linC(1, 0.98, 0.94));
  }
  box(PW.x - 0.15, PW.z0, PW.x + 0.02, PW.z1, PW.h);
  const pw = canvas(512, 256);
  paintLogos(pw);
  const pwTex = canvasTexture(pw);
  const pwMat = makeSurface({ kind: 'uv', map: pwTex, uvScale: 3, ang: 0.6, wash: 0.92, emissive: new THREE.Color(0.25, 0.25, 0.25), emMap: pwTex });
  const pwGeo = new THREE.PlaneGeometry(PW.z1 - PW.z0 - 0.1, PW.h - 0.1);
  pwGeo.rotateY(Math.PI / 2);
  pwGeo.translate(PW.x + 0.012, GY + PW.h / 2, (PW.z0 + PW.z1) / 2);
  meshes.push(new THREE.Mesh(pwGeo, pwMat));
  out.photoTex = pwTex;
  out.photoMat = pwMat;
  const I = P.info;
  K.box(M.paint, I.x0, GY, I.z0, I.x1, GY + 1.1, I.z1, linC(0.18, 0.2, 0.32));
  K.box(M.matte, I.x0 - 0.1, GY + 2.5, I.z0 - 0.2, I.x1 + 0.1, GY + 2.62, I.z1 + 0.2, WHITE);
  for (const x of [I.x0 + 0.08, I.x1 - 0.08]) K.box(M.metal, x - 0.04, GY, I.z0 + 0.1, x + 0.04, GY + 2.5, I.z0 + 0.18, STEEL);
  sign(K, M.glow, 'INFO', (I.x0 + I.x1) / 2, GY + 1.6, I.z0 - 0.02, -1, 0, 0, -1, 0.5, NEON[1]);
  box(I.x0, I.z0 + 0.3, I.x1, I.z1, 1.2);

  // ---- the tunnel of light: rings over the way in
  for (let i = 0; i < P.rings.length; i++) {
    const g = new THREE.TorusGeometry(3.3, 0.07, 6, 48);
    g.translate(CX, GY + 0.9, P.rings[i]);
    K.add(M.glow, g, NEON[i % NEON.length]);
  }

  // ---- the White Cube: white walls lit from inside, the works framed on them
  const A = P.pavA;
  const t = 0.16;
  const wallA = (x0, z0, x1, z1) => {
    K.box(L, x0, GY, z0, x1, GY + A.h, z1, WHITE);
    box(x0, z0, x1, z1, A.h);
  };
  wallA(A.x0, A.z0, A.x0 + t, A.z1);
  wallA(A.x1 - t, A.z0, A.x1, A.z1);
  for (const z of [A.z0, A.z1 - t]) {
    wallA(A.x0, z, CX - A.door, z + t);
    wallA(CX + A.door, z, A.x1, z + t);
    K.box(L, CX - A.door, GY + 2.9, z, CX + A.door, GY + A.h, z + t, WHITE);
  }
  // the roof, its black band with the name over the doors, the floor
  K.box(M.matte, A.x0 - 0.4, GY + A.h, A.z0 - 0.4, A.x1 + 0.4, GY + A.h + 0.18, A.z1 + 0.4, WHITE);
  for (const [z, s] of [[A.z0 - 0.42, -1], [A.z1 + 0.42, 1]]) {
    K.box(M.matte, A.x0 - 0.4, GY + A.h + 0.18, Math.min(z, z - s * 0.01), A.x1 + 0.4, GY + A.h + 0.9, Math.max(z, z + s * 0.01) + (s < 0 ? 0.1 : 0), BLACK);
    sign(K, M.glow, 'WHITE CUBE', CX, GY + A.h + 0.32, z + s * 0.02, s < 0 ? -1 : 1, 0, 0, s, 0.42, WHITE);
  }
  K.box(M.paint, A.x0 + t, GY, A.z0 + t, A.x1 - t, GY + 0.03, A.z1 - t, linC(0.82, 0.82, 0.84));
  // the partition down the middle, across
  const pz = (A.z0 + A.z1) / 2;
  K.box(L, CX - 4, GY, pz - 0.1, CX + 4, GY + 3, pz + 0.1, WHITE);
  box(CX - 4, pz - 0.1, CX + 4, pz + 0.1, 3);
  // the gallerist's desk at the north door, a long white bench
  K.box(M.paint, CX + 3.2, GY, A.z0 + 0.9, CX + 5.4, GY + 1.0, A.z0 + 1.6, WHITE);
  K.box(M.paint, CX - 1.6, GY + 0.42, pz + 2.4, CX + 1.6, GY + 0.5, pz + 2.9, WHITE);
  // the works: on the side walls, beside the doors, both faces of the partition
  const works = [];
  for (const k of [0, 1, 2]) {
    const z = A.z0 + 2.4 + k * 4.1;
    works.push({ x: A.x0 + t + 0.02, z, nx: 1, nz: 0, w: 2.2, h: 1.6 });
    works.push({ x: A.x1 - t - 0.02, z, nx: -1, nz: 0, w: 2.2, h: 1.6 });
  }
  for (const x of [CX - 4.6, CX + 4.6]) {
    works.push({ x, z: A.z0 + t + 0.02, nx: 0, nz: 1, w: 2.4, h: 1.7 });
    works.push({ x, z: A.z1 - t - 0.02, nx: 0, nz: -1, w: 2.4, h: 1.7 });
  }
  for (const x of [CX - 2, CX + 2]) {
    works.push({ x, z: pz - 0.12, nx: 0, nz: -1, w: 2.6, h: 1.8 });
    works.push({ x, z: pz + 0.12, nx: 0, nz: 1, w: 2.6, h: 1.8 });
  }
  const atlas = paintArtAtlas(works.length, Y.touch ? 128 : 256, Y.touch ? 96 : 192, 4);
  const art = [];
  works.forEach((wk, i) => {
    const y = GY + 1.75;
    // the frame behind it, the light on its track over it, its label beside it
    onWall(K, M.matte, wk, 0, y - wk.h / 2 - 0.07, wk.w + 0.14, wk.h + 0.14, -0.02, -0.004, i % 3 ? BLACK : GOLD);
    K.box(M.glow, wk.x + wk.nx * 0.55 - 0.07, GY + A.h - 0.32, wk.z + wk.nz * 0.55 - 0.07, wk.x + wk.nx * 0.55 + 0.07, GY + A.h - 0.18, wk.z + wk.nz * 0.55 + 0.07, linC(1, 0.95, 0.85));
    onWall(K, M.paint, wk, wk.w / 2 + 0.3, GY + 1.3, 0.2, 0.14, -0.01, 0.006, WHITE);
    art.push({ ...wk, y, uv: atlas.boxes[i] });
  });
  // (the track the spots hang from, round the room)
  for (const [x0, z0, x1, z1] of [[A.x0 + 0.6, A.z0 + 0.6, A.x0 + 0.66, A.z1 - 0.6], [A.x1 - 0.66, A.z0 + 0.6, A.x1 - 0.6, A.z1 - 0.6], [A.x0 + 0.6, A.z0 + 0.6, A.x1 - 0.6, A.z0 + 0.66], [A.x0 + 0.6, A.z1 - 0.66, A.x1 - 0.6, A.z1 - 0.6]]) K.box(M.metal, x0, GY + A.h - 0.12, z0, x1, GY + A.h - 0.06, z1, BLACK);
  const artGeo = quads(art);
  const artMat = makeSurface({ kind: 'uv', map: atlas.tex, uvScale: 1.5, ang: 0.7, wash: 0.9, emissive: new THREE.Color(0.32, 0.32, 0.32), emMap: atlas.tex });
  meshes.push(new THREE.Mesh(artGeo, artMat));
  out.artTex = atlas.tex;
  out.artMat = artMat;
  out.works = works;
  // a mobile turning under the roof (its discs: in the night's draw, game/artnight.js)
  out.mobile = { x: CX, y: GY + A.h - 0.2, z: pz - 3.2 };

  // ---- the sculpture plaza: the balloon dog, INK, the nib
  const D = P.dog;
  K.box(M.paint, D.x - 2.1, GY, D.z - 1.2, D.x + 2.1, GY + 0.55, D.z + 1.2, WHITE);
  box(D.x - 2.1, D.z - 1.2, D.x + 2.1, D.z + 1.2, 0.6);
  balloonDog(K, M, D.x, GY + 0.55, D.z, linC(1, 0.28, 0.62));
  const N = P.ink;
  K.box(M.paint, N.x - 1.9, GY, N.z - 0.7, N.x + 1.9, GY + 0.4, N.z + 0.7, linC(0.2, 0.2, 0.22));
  letter('INK', 1.9, (a0, b0, a1, b1) => K.box(M.paint, N.x - a1, GY + 0.4 + b0, N.z - 0.3, N.x - a0, GY + 0.4 + b1, N.z + 0.3, linC(0.85, 0.06, 0.1)));
  box(N.x - 1.9, N.z - 0.7, N.x + 1.9, N.z + 0.7, 2.4);
  const B = P.nib;
  K.box(M.paint, B.x - 0.9, GY, B.z - 0.9, B.x + 0.9, GY + 0.5, B.z + 0.9, linC(0.2, 0.2, 0.22));
  penNib(K, M, B.x, GY + 0.5, B.z, GOLD);
  box(B.x - 0.9, B.z - 0.9, B.x + 0.9, B.z + 0.9, 4);

  // ---- the projector's tower over the plaza, aimed at the Neon Box
  const PJ = P.projector;
  for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) K.box(M.metal, PJ.x + dx - 0.04, GY, PJ.z + dz - 0.04, PJ.x + dx + 0.04, GY + PJ.h, PJ.z + dz + 0.04, STEEL);
  for (let y = GY + 0.6; y < GY + PJ.h; y += 0.8) rod(K, M.metal, [PJ.x - 0.35, y, PJ.z - 0.35], [PJ.x + 0.35, y + 0.4, PJ.z + 0.35], 0.03, STEEL);
  K.box(M.matte, PJ.x - 0.45, GY + PJ.h, PJ.z - 0.5, PJ.x + 0.45, GY + PJ.h + 0.5, PJ.z + 0.5, BLACK);
  K.cyl(M.glow, 0.14, 0.14, PJ.z + 0.5, PJ.z + 0.56, linC(1, 1, 0.95), { x: PJ.x, y: GY + PJ.h + 0.25 });
  box(PJ.x - 0.45, PJ.z - 0.45, PJ.x + 0.45, PJ.z + 0.45, PJ.h);

  // ---- the Neon Box: black, its doors east and west, neon works inside, the projection on its face
  const NB = P.pavB;
  const wallB = (x0, z0, x1, z1) => {
    K.box(M.matte, x0, GY, z0, x1, GY + NB.h, z1, BLACK);
    box(x0, z0, x1, z1, NB.h);
  };
  wallB(NB.x0, NB.z0, NB.x1, NB.z0 + t);
  wallB(NB.x0, NB.z1 - t, NB.x1, NB.z1);
  const bz = (NB.z0 + NB.z1) / 2;
  for (const x of [NB.x0, NB.x1 - t]) {
    wallB(x, NB.z0, x + t, bz - NB.door);
    wallB(x, bz + NB.door, x + t, NB.z1);
    K.box(M.matte, x, GY + 2.8, bz - NB.door, x + t, GY + NB.h, bz + NB.door, BLACK);
  }
  K.box(M.matte, NB.x0 - 0.3, GY + NB.h, NB.z0 - 0.3, NB.x1 + 0.3, GY + NB.h + 0.2, NB.z1 + 0.3, BLACK);
  sign(K, M.glow, 'NEON BOX', CX, GY + NB.h + 0.25, NB.z1 + 0.32, 1, 0, 0, 1, 0.5, NEON[0]);
  // the works in light: words on the long walls, a heart, a palm, a bolt
  sign(K, M.glow, 'DRAW THE NIGHT', CX, GY + 2.6, NB.z0 + t + 0.03, 1, 0, 0, 1, 0.42, NEON[1]);
  sign(K, M.glow, 'LOVE INK', CX + 2.2, GY + 2.3, NB.z1 - t - 0.03, -1, 0, 0, -1, 0.5, NEON[0]);
  neonHeart(K, M.glow, CX - 3.3, GY + 2.6, NB.z1 - t - 0.04, NEON[0]);
  neonPalm(K, M.glow, CX - 4.2, GY + 0.6, NB.z0 + t + 0.04, NEON[3]);
  neonBolt(K, M.glow, CX + 4.4, GY + 1.2, NB.z0 + t + 0.04, NEON[2]);
  neonSmile(K, M.glow, CX + 4.6, GY + 1.5, NB.z1 - t - 0.04, NEON[4]);
  K.box(M.paint, NB.x0 + t, GY, NB.z0 + t, NB.x1 - t, GY + 0.02, NB.z1 - t, linC(0.08, 0.08, 0.1));
  // the projection: a canvas the size of the box's face, lit (redrawn as it plays: game/artnight.js)
  const pc = canvas(Y.touch ? 256 : 512, Y.touch ? 107 : 213);
  const pTex = canvasTexture(pc, { mips: false });
  const pMat = makeSurface({ kind: 'uv', map: pTex, uvScale: 4, ang: 0.5, wash: 0.95, emissive: new THREE.Color(1.2, 1.2, 1.2), emMap: pTex });
  const pGeo = new THREE.PlaneGeometry(NB.x1 - NB.x0 - 0.2, NB.h - 0.25);
  pGeo.rotateY(Math.PI);
  pGeo.translate(CX, GY + NB.h / 2, NB.z0 - 0.012);
  meshes.push(new THREE.Mesh(pGeo, pMat));
  out.proj = { c: pc, tex: pTex, mat: pMat, from: [PJ.x, GY + PJ.h + 0.25, PJ.z + 0.56], to: [[NB.x0 + 0.1, GY + 0.1], [NB.x1 - 0.1, GY + 0.1], [NB.x1 - 0.1, GY + NB.h - 0.15], [NB.x0 + 0.1, GY + NB.h - 0.15]], z: NB.z0 };

  // ---- the infinity room: a black cube, dots of light inside it to the end of the world
  const IR = P.infinity;
  const h2 = IR.s / 2;
  K.box(M.matte, IR.x - h2, GY, IR.z - h2, IR.x + h2, GY + IR.s, IR.z - h2 + 0.1, BLACK);
  K.box(M.matte, IR.x - h2, GY, IR.z + h2 - 0.1, IR.x + h2, GY + IR.s, IR.z + h2, BLACK);
  K.box(M.matte, IR.x + h2 - 0.1, GY, IR.z - h2, IR.x + h2, GY + IR.s, IR.z + h2, BLACK);
  K.box(M.matte, IR.x - h2, GY, IR.z - h2, IR.x - h2 + 0.1, GY + IR.s, IR.z - 0.5, BLACK);
  K.box(M.matte, IR.x - h2, GY, IR.z + 0.5, IR.x - h2 + 0.1, GY + IR.s, IR.z + h2, BLACK);
  K.box(M.matte, IR.x - h2, GY + 2.2, IR.z - 0.5, IR.x - h2 + 0.1, GY + IR.s, IR.z + 0.5, BLACK);
  K.box(M.matte, IR.x - h2, GY + IR.s, IR.z - h2, IR.x + h2, GY + IR.s + 0.1, IR.z + h2, BLACK);
  sign(K, M.glow, 'INFINITY', IR.x - h2 - 0.03, GY + IR.s - 0.55, IR.z, 0, 1, -1, 0, 0.26, NEON[1]);
  let sd = 77;
  const rnd = () => {
    sd = (sd * 16807) % 2147483647;
    return (sd - 1) / 2147483646;
  };
  for (let i = 0; i < 70; i++) K.sphere(M.glow, 0.025 + rnd() * 0.03, IR.x - h2 + 0.3 + rnd() * (IR.s - 0.6), GY + 0.3 + rnd() * (IR.s - 0.5), IR.z - h2 + 0.3 + rnd() * (IR.s - 0.6), NEON[i % NEON.length], 1, 1, 1, 6);
  box(IR.x - h2, IR.z - h2, IR.x + h2, IR.z - h2 + 0.1, IR.s);
  box(IR.x - h2, IR.z + h2 - 0.1, IR.x + h2, IR.z + h2, IR.s);
  box(IR.x + h2 - 0.1, IR.z - h2, IR.x + h2, IR.z + h2, IR.s);

  // ---- the floor of light (its tiles: a mesh of their own, coloured as people step on them)
  out.floor = lightFloor(P.floor, GY, M.glow);
  meshes.push(out.floor.mesh);

  // ---- the giant rubber duck
  duck(K, M, P.duck.x, GY, P.duck.z);
  box(P.duck.x - 2, P.duck.z - 1.6, P.duck.x + 2, P.duck.z + 1.6, 3.2);

  // ---- the champagne bar, its back bar, the tower of glasses
  const BR = P.bar;
  K.box(M.paint, BR.x - 0.45, GY, BR.z0, BR.x + 0.45, GY + 1.05, BR.z1, WHITE);
  K.box(M.metal, BR.x - 0.5, GY + 1.05, BR.z0 - 0.05, BR.x + 0.55, GY + 1.12, BR.z1 + 0.05, GOLD);
  K.box(M.glow, BR.x + 0.45, GY + 0.15, BR.z0 + 0.1, BR.x + 0.47, GY + 0.95, BR.z1 - 0.1, linC(1, 0.82, 0.5));
  for (let i = 0; i < 3; i++) K.box(M.matte, BR.x - 1.75, GY + 0.9 + i * 0.55, BR.z0, BR.x - 1.45, GY + 0.95 + i * 0.55, BR.z1, linC(0.42, 0.28, 0.18));
  K.box(M.matte, BR.x - 1.8, GY, BR.z0, BR.x - 1.75, GY + 3.0, BR.z1, BLACK);
  for (let i = 0; i < 3; i++) {
    for (let z = BR.z0 + 0.2; z < BR.z1 - 0.1; z += 0.22) {
      const c = [linC(0.1, 0.35, 0.15), GOLD, linC(0.55, 0.1, 0.12), linC(0.85, 0.85, 0.8)][Math.floor(rnd() * 4)];
      K.cyl(M.glass, 0.04, 0.04, GY + 0.95 + i * 0.55, GY + 1.25 + i * 0.55, c, { axis: 'y', x: BR.x - 1.6, z, segs: 7 });
    }
  }
  for (let lv = 0; lv < 4; lv++) {
    const n = 4 - lv;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) K.cyl(M.glass, 0.045, 0.03, GY + 1.12 + lv * 0.12, GY + 1.24 + lv * 0.12, linC(1, 0.9, 0.6), { axis: 'y', x: BR.x - (n - 1) * 0.05 + i * 0.1, z: BR.z1 - 0.45 - (n - 1) * 0.05 + j * 0.1, segs: 7 });
  }
  for (const z of [BR.z0 + 0.9, BR.z0 + 2.5]) K.cyl(M.metal, 0.12, 0.1, GY + 1.12, GY + 1.4, STEEL, { axis: 'y', x: BR.x, z });
  box(BR.x - 1.8, BR.z0, BR.x + 0.5, BR.z1, 1.2);
  sign(K, M.glow, 'CHAMPAGNE', BR.x - 1.745, GY + 2.5, (BR.z0 + BR.z1) / 2, 0, -1, 1, 0, 0.3, GOLD, 0.03);
  // high tables in white cloth
  for (const [x, z] of P.tables) {
    K.cyl(M.paint, 0.4, 0.26, GY, GY + 1.05, WHITE, { axis: 'y', x, z, segs: 12 });
    K.cyl(M.paint, 0.42, 0.42, GY + 1.05, GY + 1.09, WHITE, { axis: 'y', x, z, segs: 12 });
    K.cyl(M.glass, 0.03, 0.03, GY + 1.09, GY + 1.27, linC(1, 0.9, 0.55), { axis: 'y', x: x + 0.12, z: z - 0.08, segs: 6 });
    box(x - 0.4, z - 0.4, x + 0.4, z + 0.4, 1.1);
  }
  // the lounge: white sofas round a low table
  for (const { x, z } of P.lounge) {
    K.box(M.paint, x - 1.4, GY, z - 1.6, x + 1.4, GY + 0.42, z - 0.9, linC(0.93, 0.9, 0.84));
    K.box(M.paint, x - 1.4, GY + 0.42, z - 1.6, x + 1.4, GY + 0.85, z - 1.4, linC(0.93, 0.9, 0.84));
    K.box(M.paint, x + 0.9, GY, z - 0.9, x + 1.6, GY + 0.42, z + 1.2, linC(0.93, 0.9, 0.84));
    K.box(M.paint, x + 1.4, GY + 0.42, z - 0.9, x + 1.6, GY + 0.85, z + 1.2, linC(0.93, 0.9, 0.84));
    K.box(M.paint, x - 0.6, GY, z - 0.5, x + 0.4, GY + 0.36, z + 0.5, linC(0.3, 0.22, 0.16));
    K.cyl(M.paint, 0.3, 0.3, GY, GY + 0.4, NEON[(Math.round(z) & 1) ? 0 : 1], { axis: 'y', x: x - 1, z: z + 0.6, segs: 10 });
    box(x - 1.4, z - 1.6, x + 1.6, z + 1.2, 0.9);
  }
  // the DJ's booth by the bar
  const DJ = P.dj;
  K.box(M.matte, DJ.x - 0.5, GY, DJ.z - 1.1, DJ.x + 0.5, GY + 1.05, DJ.z + 1.1, BLACK);
  K.box(M.glow, DJ.x + 0.5, GY + 0.2, DJ.z - 1, DJ.x + 0.52, GY + 0.9, DJ.z + 1, NEON[4]);
  for (const dz of [-0.6, 0.6]) K.cyl(M.round, 0.18, 0.18, GY + 1.05, GY + 1.1, linC(0.2, 0.2, 0.22), { axis: 'y', x: DJ.x, z: DJ.z + dz });
  box(DJ.x - 0.5, DJ.z - 1.1, DJ.x + 0.5, DJ.z + 1.1, 1.1);
  // the lanterns over the bar and the lounge
  out.lanterns = [];
  const LN = P.lanterns;
  for (let i = 0; i < 22; i++) {
    const x = LN.x0 + rnd() * (LN.x1 - LN.x0);
    const z = LN.z0 + rnd() * (LN.z1 - LN.z0);
    const y = GY + 3.9 + rnd() * 0.7;
    K.sphere(M.glow, 0.22, x, y, z, [linC(1, 0.62, 0.3), linC(1, 0.4, 0.6), linC(1, 0.85, 0.5)][i % 3], 1, 1.25, 1, 10);
    out.lanterns.push([x, y, z]);
  }

  // ---- the scaffold before the live mural (the east wall's last), its painter on top
  const SF = P.scaffold;
  const sx0 = SF.x - 2.2;
  const sx1 = SF.x - 0.45;
  for (let z = SF.z0; z <= SF.z1 + 0.01; z += 2) {
    for (const x of [sx0, sx1]) K.box(M.metal, x - 0.04, GY, z - 0.04, x + 0.04, GY + 3.6, z + 0.04, STEEL);
    rod(K, M.metal, [sx0, GY + 0.2, z], [sx1, GY + 2.4, z], 0.035, STEEL);
  }
  for (const y of [GY + 1.2, GY + 2.4]) {
    K.box(M.matte, sx0, y, SF.z0, sx1, y + 0.06, SF.z1, linC(0.55, 0.4, 0.22));
    K.box(M.metal, sx0 - 0.03, y + 0.9, SF.z0, sx0 + 0.03, y + 0.95, SF.z1, STEEL);
  }
  for (let i = 0; i < 4; i++) K.cyl(M.paint, 0.07, 0.07, GY + 2.46, GY + 2.66, NEON[i], { axis: 'y', x: sx0 + 0.3 + i * 0.25, z: SF.z0 + 1 + i * 0.4, segs: 8 });
  box(sx0 - 0.1, SF.z0, sx1, SF.z1, 2.5);
  const lc = canvas(Y.touch ? 256 : 512, Y.touch ? 100 : 200);
  const lTex = canvasTexture(lc, { mips: false });
  const lMat = makeSurface({ kind: 'uv', map: lTex, uvScale: 12, ang: 1.3, wash: 0.8, emissive: new THREE.Color(0.18, 0.18, 0.18), emMap: lTex });
  const lGeo = new THREE.PlaneGeometry(12.6, 4.6);
  lGeo.rotateY(-Math.PI / 2);
  lGeo.translate(SF.x - 0.235, GY + 2.55, (SF.z0 + SF.z1) / 2);
  meshes.push(new THREE.Mesh(lGeo, lMat));
  out.live = { c: lc, tex: lTex, mat: lMat, k: 0.25, stroke: [] };
  return out;
}

// a box on a wall's face, as the work q sees it: u across from the work's middle, from v up, w x h,
// d0..d1 out of the wall (the face the work is on)
function onWall(K, mat, q, u, v, w, h, d0, d1, color) {
  const rx = q.nz;
  const rz = -q.nx;
  const ax = q.x + rx * (u - w / 2);
  const az = q.z + rz * (u - w / 2);
  const bx = q.x + rx * (u + w / 2);
  const bz = q.z + rz * (u + w / 2);
  const xs = [ax + q.nx * d0, bx + q.nx * d0, ax + q.nx * d1, bx + q.nx * d1];
  const zs = [az + q.nz * d0, bz + q.nz * d0, az + q.nz * d1, bz + q.nz * d1];
  K.box(mat, Math.min(...xs), v, Math.min(...zs), Math.max(...xs), v + h, Math.max(...zs), color);
}

// the works' quads, one geometry: each its cell of the canvas
function quads(list) {
  const pos = [];
  const uv = [];
  const nor = [];
  for (const q of list) {
    const rx = q.nz;
    const rz = -q.nx;
    const hw = q.w / 2;
    const hh = q.h / 2;
    const a = [q.x - rx * hw, q.y - hh, q.z - rz * hw];
    const b = [q.x + rx * hw, q.y - hh, q.z + rz * hw];
    const c = [q.x + rx * hw, q.y + hh, q.z + rz * hw];
    const d = [q.x - rx * hw, q.y + hh, q.z - rz * hw];
    const [u0, v0, u1, v1] = q.uv;
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    for (let i = 0; i < 6; i++) nor.push(q.nx, 0, q.nz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  return g;
}

// the wall of logos behind the red carpet
function paintLogos(c) {
  const g = c.getContext('2d');
  g.fillStyle = '#fbf8f0';
  g.fillRect(0, 0, c.width, c.height);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let j = 0; j < 5; j++) {
    for (let i = 0; i < 4; i++) {
      const x = i * 132 + (j % 2 ? 66 : 0) + 30;
      const y = j * 52 + 26;
      if (i % 2 === j % 2) {
        g.font = '700 22px "Permanent Marker", sans-serif';
        g.fillStyle = '#e8333d';
        g.fillText('ART NIGHT', x, y);
      } else {
        g.font = '700 20px "Permanent Marker", sans-serif';
        g.fillStyle = '#16121c';
        g.fillText('PAINTWOOD', x, y);
      }
    }
  }
}

function balloonDog(K, M, x, y, z, c) {
  const s = 1.1;
  const S = (r, dx, dy, dz, sx, sy, sz) => K.sphere(M.paint, r * s, x + dx * s, y + dy * s, z + dz * s, c, sx, sy, sz, 16);
  for (const [dx, dz] of [[-0.75, -0.42], [-0.75, 0.42], [0.72, -0.42], [0.72, 0.42]]) S(0.27, dx, 0.62, dz, 1, 2.6, 1);
  S(0.44, 0, 1.38, 0, 2.4, 1, 1);
  S(0.34, 0.86, 1.92, 0, 1, 1.9, 1);
  S(0.4, 1.0, 2.55, 0, 1, 1, 1);
  S(0.24, 1.55, 2.5, 0, 2.2, 1, 1);
  for (const dz of [-0.24, 0.24]) S(0.17, 0.82, 3.0, dz, 1, 2.3, 1);
  S(0.16, -1.15, 1.85, 0, 1, 2.6, 1);
}

// a pen's nib in gold, its point up, its slit and its hole
function penNib(K, M, x, y, z, c) {
  const sh = new THREE.Shape();
  sh.moveTo(-0.62, 0);
  sh.lineTo(0.62, 0);
  sh.quadraticCurveTo(0.95, 1.5, 0, 3.6);
  sh.quadraticCurveTo(-0.95, 1.5, -0.62, 0);
  const hole = new THREE.Path();
  hole.absarc(0, 1.6, 0.18, 0, Math.PI * 2, true);
  sh.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false, curveSegments: 10 });
  g.translate(x, y, z - 0.11);
  K.add(M.metal, g, c);
  K.box(M.matte, x - 0.03, y + 1.75, z - 0.12, x + 0.03, y + 3.4, z + 0.12, linC(0.15, 0.12, 0.08));
}

function duck(K, M, x, y, z) {
  const Y = linC(1, 0.85, 0.12);
  K.sphere(M.paint, 1.2, x, y + 1.05, z, Y, 1.45, 0.85, 1.05, 18);
  K.sphere(M.paint, 0.78, x + 0.75, y + 2.3, z, Y, 1, 1, 1, 18);
  K.sphere(M.paint, 0.36, x + 1.5, y + 2.15, z, linC(1, 0.45, 0.08), 1.6, 0.55, 1, 12);
  for (const dz of [-0.36, 0.36]) K.sphere(M.paint, 0.1, x + 1.28, y + 2.55, z + dz, linC(0.05, 0.05, 0.08), 1, 1, 1, 8);
  K.sphere(M.paint, 0.4, x - 1.55, y + 1.5, z, Y, 1.3, 0.7, 0.8, 12);
}

// neon shapes on a wall facing z (the wall's plane at z): lines of tube
function neonPts(K, mat, pts, x, y, z, c, t = 0.05) {
  for (let i = 0; i < pts.length - 1; i++) rod(K, mat, [x + pts[i][0], y + pts[i][1], z], [x + pts[i + 1][0], y + pts[i + 1][1], z], t, c);
}
function neonHeart(K, mat, x, y, z, c) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push([0.04 * 16 * Math.pow(Math.sin(a), 3), 0.04 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))]);
  }
  neonPts(K, mat, pts, x, y, z, c);
}
function neonPalm(K, mat, x, y, z, c) {
  neonPts(K, mat, [[0, 0], [0.15, 1.2], [0.25, 2.4]], x, y, z, c);
  for (let k = 0; k < 5; k++) {
    const a = 0.3 + k * 0.6;
    neonPts(K, mat, [[0.25, 2.4], [0.25 + Math.cos(a) * 0.6, 2.4 + Math.sin(a) * 0.35], [0.25 + Math.cos(a) * 1.1, 2.2 + Math.sin(a) * 0.1]], x, y, z, c);
  }
}
function neonBolt(K, mat, x, y, z, c) {
  neonPts(K, mat, [[0, 2], [-0.5, 0.9], [0.05, 0.9], [-0.35, -0.2], [0.55, 1.1], [0.0, 1.1], [0.4, 2], [0, 2]], x, y, z, c);
}
function neonSmile(K, mat, x, y, z, c) {
  const ring = [];
  for (let i = 0; i <= 20; i++) ring.push([Math.cos((i / 20) * Math.PI * 2) * 0.6, 0.6 + Math.sin((i / 20) * Math.PI * 2) * 0.6]);
  neonPts(K, mat, ring, x, y, z, c);
  const smile = [];
  for (let i = 0; i <= 8; i++) smile.push([Math.cos(Math.PI + 0.4 + (i / 8) * (Math.PI - 0.8)) * 0.35, 0.5 + Math.sin(Math.PI + 0.4 + (i / 8) * (Math.PI - 0.8)) * 0.3]);
  neonPts(K, mat, smile, x, y, z, c);
  neonPts(K, mat, [[-0.2, 0.85], [-0.2, 0.95]], x, y, z, c, 0.07);
  neonPts(K, mat, [[0.2, 0.85], [0.2, 0.95]], x, y, z, c, 0.07);
}

// the floor of light: n x n tiles, their colours set each frame (who stands on it lights it)
function lightFloor(F, GY, mat) {
  const n = F.n;
  const verts = n * n * 6;
  const pos = new Float32Array(verts * 3);
  const nor = new Float32Array(verts * 3);
  const col = new Float32Array(verts * 3);
  const uv = new Float32Array(verts * 2);
  const ids = new Float32Array(verts);
  const dx = (F.x1 - F.x0) / n;
  const dz = (F.z1 - F.z0) / n;
  let k = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x0 = F.x0 + i * dx + 0.04;
      const x1 = x0 + dx - 0.08;
      const z0 = F.z0 + j * dz + 0.04;
      const z1 = z0 + dz - 0.08;
      for (const p of [[x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]]) {
        pos.set([p[0], GY + 0.03, p[1]], k * 3);
        nor.set([0, 1, 0], k * 3);
        ids[k] = ((i * 7 + j * 13) % 97) / 97;
        k++;
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, F, n, dx, dz };
}

// the floor's colours: a slow wave, and bright rings round whoever stands on it
export function paintFloor(fl, t, feet) {
  const { F, n, dx, dz } = fl;
  const a = fl.mesh.geometry.attributes.color;
  const arr = a.array;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const cx = F.x0 + (i + 0.5) * dx;
      const cz = F.z0 + (j + 0.5) * dz;
      let k = 0.12 + 0.1 * Math.sin(t * 1.5 + i * 0.7 + j * 0.5);
      let hue = (i + j + t * 0.6) % 5;
      for (const [x, z] of feet) {
        const d = Math.hypot(x - cx, z - cz);
        if (d < 1.6) {
          k = Math.max(k, 1.2 - d * 0.6);
          hue = (hue + 2) % 5;
        }
      }
      const c = NEON[Math.floor(hue)];
      const base = (j * n + i) * 18;
      for (let v = 0; v < 6; v++) {
        arr[base + v * 3] = c[0] * k;
        arr[base + v * 3 + 1] = c[1] * k;
        arr[base + v * 3 + 2] = c[2] * k;
      }
    }
  }
  a.needsUpdate = true;
}

// the projection on the Neon Box: waves of colour, the city's doodles drawn in light and gone,
// the night's name
export function paintProjection(pr, t) {
  const c = pr.c;
  const g = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const k = W / 512;
  g.fillStyle = '#05040a';
  g.fillRect(0, 0, W, H);
  const cols = ['#ff3f8e', '#2fd4e4', '#ffd23f', '#5aff8a', '#9b6bff'];
  const phase = Math.floor(t / 6) % 3;
  if (phase === 0) {
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = cols[i % 5];
      g.lineWidth = 10 * k;
      g.beginPath();
      for (let x = 0; x <= W; x += 8 * k) g.lineTo(x, H / 2 + Math.sin(x / (40 * k) + t * 2 + i) * H * 0.3 * Math.sin(t * 0.7 + i));
      g.stroke();
    }
  } else if (phase === 1) {
    // a doodle drawn in light, line by line
    const keys = Object.keys(DOODLES);
    const key = keys[Math.floor(t / 6 / 3) % keys.length];
    const st = DOODLES[key](() => 0.5);
    const f = (t % 6) / 4;
    const n = st.reduce((a, s) => a + s.length, 0);
    let left = Math.floor(n * Math.min(1, f));
    const sc = (H * 0.8) / 100;
    g.strokeStyle = cols[Math.floor(t / 6) % 5];
    g.lineWidth = 6 * k;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of st) {
      if (left <= 0) break;
      const pts = left >= s.length ? s : s.slice(0, left);
      left -= s.length;
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(W / 2 - 50 * sc + x * sc, H * 0.1 + y * sc) : g.moveTo(W / 2 - 50 * sc + x * sc, H * 0.1 + y * sc)));
      g.stroke();
    }
  } else {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${Math.round(70 * k)}px "Permanent Marker", sans-serif`;
    for (let i = 0; i < 3; i++) {
      g.fillStyle = cols[(i + Math.floor(t * 2)) % 5];
      g.fillText('ART NIGHT', W / 2 + Math.sin(t * 3 + i) * 6 * k, H / 2 + (i - 1) * 6 * k);
    }
  }
  pr.tex.needsUpdate = true;
}

// the live mural: drawn on as the night goes - a big face of the night in blocks, then lines
export function paintLive(lv, k) {
  const c = lv.c;
  const g = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  g.fillStyle = '#d9d4c8';
  g.fillRect(0, 0, W, H);
  const cols = ['#1b2b6b', '#ff3f8e', '#ffb347', '#2bc4c4', '#ffe14f', '#16121c'];
  // blocks of colour first, then the shapes, then the line over them
  const blocks = Math.min(1, k * 2.2);
  for (let i = 0; i < 6; i++) {
    const f = Math.max(0, Math.min(1, blocks * 6 - i));
    if (f <= 0) break;
    g.fillStyle = cols[i % 4];
    g.fillRect((i * W) / 6, 0, ((W / 6) * f) | 0, H);
  }
  if (k > 0.45) {
    const f = Math.min(1, (k - 0.45) / 0.3);
    g.globalAlpha = f;
    g.beginPath();
    g.arc(W * 0.5, H * 0.55, H * 0.36, 0, Math.PI * 2);
    g.fillStyle = '#f2c79a';
    g.fill();
    g.beginPath();
    g.arc(W * 0.5, H * 0.38, H * 0.38, Math.PI, 0);
    g.fillStyle = '#16121c';
    g.fill();
    g.globalAlpha = 1;
  }
  if (k > 0.72) {
    const f = Math.min(1, (k - 0.72) / 0.25);
    g.strokeStyle = '#16121c';
    g.lineWidth = Math.max(3, W / 120);
    g.beginPath();
    g.moveTo(W * 0.43, H * 0.55);
    g.lineTo(W * 0.43 + W * 0.04 * f, H * 0.55);
    g.moveTo(W * 0.53, H * 0.55);
    g.lineTo(W * 0.53 + W * 0.04 * f, H * 0.55);
    g.stroke();
    g.beginPath();
    g.arc(W * 0.5, H * 0.66, H * 0.1, 0.2, 0.2 + (Math.PI - 0.4) * f);
    g.stroke();
    g.font = `700 ${Math.round(H * 0.14)}px "Permanent Marker", sans-serif`;
    g.fillStyle = '#ffe14f';
    g.textAlign = 'right';
    if (f > 0.9) g.fillText('ART NIGHT', W - W * 0.03, H * 0.92);
  }
  lv.tex.needsUpdate = true;
}
