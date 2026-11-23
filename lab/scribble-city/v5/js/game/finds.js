import * as THREE from 'three';
import { tr } from '../core/lang.js';
import { Kit, itemMats, linC } from './items.js';
import { clamp } from '../core/util.js';
import { BLUEPRINTS, blueprintBounds } from './blueprints.js';
import { flashLight, makeSurface, canvasTexture } from '../render/materials.js';
import { canvas } from '../world/kit.js';
import { repaintBoard } from '../world/boards.js';

// (ROADMAP 29.4-29.5, the owner's word: "build it all, in order") Drawings found in the city.
//
// After the prologue the game opens with a start kit - the paint gun, the M16 pencil rifle, the marker SMG, the wax
// shotgun, the ink grenades; the cars and the motorbike; the ramp, the barrier, the bridge; and on the car the turbo,
// strong wings, the hydraulic jump, a basic machine gun and light armour. The rest of the plan's list is found: a
// drawing somewhere off to the side of a place, which stands out as you come near it - the lines catch the light from
// 25 m, a slow sheen running along them like wet ink under a lamp; from 10 m a warm light round it and the lines inked
// again one by one, as if an unseen hand went over them, a pencil's faint scratching from where it is; from 3 m: E -
// copy it. The player draws it himself, by finger, and the game reads the drawing against that one drawing alone
// (never "it looks like something else" - ui/freedraw.js copy); alike enough, it is real in front of him, with a card
// that says what it is and how it is used, and the first try of it there and then.
//
// A thing on the list is locked only once its place is in the world (a stage built): till then it stays open as it
// was. What is not on the plan's lists at all stays open, as it was. The sandbox (the settings' "every drawing and
// part unlocked") opens everything, as before.

const KEY = 'scribble-city-v5-finds';

// open from the end of the prologue (the plan's "55%")
export const START_BP = new Set(['paint', 'rifle', 'mp5', 'shotgun', 'inkbomb', 'car', 'muscle', 'hyper', 'nightshift', 'streetline', 'bike', 'ramp', 'barrier', 'bridge']);
// the car's parts at the start, and their level (the wings strong from the start: real flight - the owner's word)
// (the owner, 23.11: the helicopter's rotor too - drawn in the story's jump off the roof, his from then on)
export const START_PARTS = { turbo: 1, wing: 2, jump: 1, mg: 1, armor: 1, rotor: 1 };
// the parts whose level is found, not bought
const FOUND_LEVELS = new Set(['wing', 'turbo']);
// what a part's copy is read against: the other parts, and everything on the pen's shelves
const PART_IDS = () => Object.values(BLUEPRINTS).filter((b) => b.kind === 'part').map((b) => b.id);

// the finds. bp: a blueprint it opens (copied as that blueprint); part: a part of the car's it opens, or lv: the level of
// it it brings (copied as the part's drawing, draw); at(world, game): its place - null while that place is not built
export const FINDS = [
  {
    id: 'rl7',
    title: 'RL-7 ERASER',
    bp: 'bazooka',
    stage: 1,
    line: tr('משגר מחק ענק: כל מה שהוא פוגע בו נמחק מהדף — מכוניות, קירות, אנשים.', 'Fires a giant eraser: whatever it hits is rubbed off the page — cars, walls, people.'),
    how: { touch: tr('מחזיקים כוונת, ונגיעה בירי', 'Hold aim, tap fire'), keys: tr('קליק ימני לכוון, קליק לירות', 'Right-click to aim, click to fire') },
    tryText: tr('נסו אותו עכשיו: ירו ב-RL-7', 'Try it now: fire the RL-7'),
    where: tr('בסמטת המוחקים — מרידיאן–וושינגטון, בין רחוב 9 לרחוב 7. מקום מסוכן', "In the Erasers' alley — Meridian–Washington, between 9th and 7th. A dangerous place"),
    at: (world) => alleyWall(world, 0, 3, 118, -1),
    board: 'bazooka',
  },
  {
    id: 'booster',
    title: 'ROCKET BOOSTER',
    part: 'jet',
    draw: 'p_jet',
    stage: 1,
    line: tr('מנוע רקטי שמתחבר לכל כלי — מכונית, אופנוע, סירה, מסוק. דחיפה אדירה על דלק משלו, גם באוויר.', 'A rocket motor that goes on any ride — a car, a bike, a boat, a helicopter. A huge push on its own fuel, in the air too.'),
    how: { touch: tr('ברכב: "חלקים" ← מאיץ רקטי · כפתור הטורבו מפעיל', 'In a ride: "Parts" → Rocket Booster · the boost button fires it'), keys: tr('ברכב: Q ← חלקים ← מאיץ רקטי · Shift מפעיל', 'In a ride: Q → Parts → Rocket Booster · Shift fires it') },
    tryText: tr('נסו אותו עכשיו: הרכיבו על רכב והדליקו', 'Try it now: put it on a ride and light it'),
    where: tr('במוסך המרוצים, מעבר לרחוב 5 מול חניון הקומות', 'In the racing garage, across 5th Street from the parking garage'),
    at: (world, game) => placeSpot(game, 'rocket'),
  },
  {
    id: 'wings2',
    title: 'STORM WINGS',
    part: 'wing',
    lv: 3,
    draw: 'p_wing',
    stage: 1,
    line: tr('הכנפיים שלכם ברמה מטורפת: ממריאות מוקדם, מטפסות כמו מטוס קרב, טסות מהר יותר — עד גובה המגדלים.', 'Your wings gone wild: they lift off sooner, climb like a fighter, cruise faster — up to the towers.'),
    how: { touch: tr('על כל כלי עם כנפיים — מעכשיו בדרגה הזו', 'On every ride with wings — at this level from now on'), keys: tr('על כל כלי עם כנפיים — מעכשיו בדרגה הזו', 'On every ride with wings — at this level from now on') },
    tryText: tr('נסו אותן עכשיו: קפצו מהגג ועופו מעל המגדלים', 'Try them now: jump off the roof and fly over the towers'),
    where: tr('על גג חניון הקומות ברחוב 5, ליד הקצה', 'On the roof of the parking garage on 5th Street, by the edge'),
    at: (world, game) => placeSpot(game, 'wings'),
  },
  {
    id: 'inkhawk',
    title: 'INKHAWK H1',
    bp: 'copter',
    stage: 1,
    line: tr('מסוק תקיפה קל: ממריא מכל מקום, מרחף, יורה מטוסי נייר מהאף.', 'A light attack helicopter: takes off from anywhere, hovers, fires paper planes from its nose.'),
    how: { touch: tr('כפתורי למעלה/למטה, הג׳ויסטיק מטה, ונגיעה בירי', 'The up/down buttons, the stick steers, tap fire'), keys: tr('רווח/C למעלה ולמטה · WASD · קליק לירות', 'Space/C up and down · WASD · click to fire') },
    tryText: tr('נסו אותו עכשיו: המריאו מהמנחת', 'Try it now: take off from the pad'),
    where: tr('על מנחת המסוקים בגג במרכז העיר — וושינגטון–קולינס, רחובות 15–13', 'On the helipad on a downtown roof — Washington–Collins, 15th to 13th'),
    at: (world, game) => placeSpot(game, 'inkhawk'),
  },
  {
    id: 'dualrotor',
    title: 'DUAL ROTOR',
    part: 'rotor',
    draw: 'p_rotor2',
    stage: 1,
    line: tr('שני רוטורים על קורה: מרימים כל כלי — גם כבד — ועפים מהר וגבוה.', 'Two rotors on a beam: they lift any ride — a heavy one too — and fly fast and high.'),
    how: { touch: tr('ברכב: "חלקים" ← רוטור · כפתור הקפיצה ממריא', 'In a ride: "Parts" → Rotor · the jump button lifts off'), keys: tr('ברכב: Q ← חלקים ← רוטור · רווח ממריא', 'In a ride: Q → Parts → Rotor · Space lifts off') },
    tryText: tr('נסו אותו עכשיו: הרכיבו על רכב והמריאו', 'Try it now: put it on a ride and lift off'),
    where: tr('על גג חנות הגלישה ליד הטיילת', 'On the roof of the surf shop by the boardwalk'),
    at: (world, game) => placeSpot(game, 'dualrotor'),
  },
  {
    id: 'hoverbike',
    title: 'HOVER BIKE',
    bp: 'hoverbike',
    // (and its pods for any ride: in the parts tray from the day it is found)
    alsoPart: 'hover',
    // (its board in the van is 3.68 m wide: the page a little narrower than the spot's own)
    w: 2.8,
    stage: 1,
    line: tr('אופנוע בלי גלגלים, על שני תרמילי ריחוף: מעל הכביש, החול והים. ואת התרמילים שלו אפשר לשים על כל כלי.', 'A motorbike with no wheels, on two hover pods: over the road, the sand and the sea. And its pods go on any ride.'),
    how: { touch: tr('מציירים אותו מהעיפרון, ברכבים · ▲ קפיצה · על כלי אחר: "חלקים" ← משטחי ריחוף', 'Draw it from the pencil, under rides · ▲ hops · on another ride: "Parts" → Hover Pads'), keys: tr('מציירים אותו מהעיפרון, ברכבים · רווח קפיצה · על כלי אחר: Q ← חלקים ← משטחי ריחוף', 'Draw it from the pencil, under rides · Space hops · on another ride: Q → Parts → Hover Pads') },
    tryText: tr('נסו אותו עכשיו: עלו עליו ורכבו מהחוף אל הים', 'Try it now: get on and ride off the beach onto the sea'),
    where: tr('בוואן של המכונאי של הגולשים (SALT & SPANNER) — עוצר ליד החוף, ליד המזח וליד מלון מיראז׳', "In the surfers' mechanic's van (SALT & SPANNER) — it stops by the beach, at the pier and by Hotel Mirage"),
    at: (world, game) => placeSpot(game, 'hoverbike'),
  },
];

const BY_ID = Object.fromEntries(FINDS.map((f) => [f.id, f]));

// a place built for a find (game/places.js): its spot, or null while it is not there
function placeSpot(game, id) {
  const P = game.places;
  return P && P.spot ? P.spot(id) : null;
}

// a spot on the wall of a gang's alley: the alley of block (col, row), at z, on its east (+1) or west (-1) wall - the
// wall found by a ray from the lane's middle
function alleyWall(world, col, row, z, side) {
  const a = (world.alleys || []).find((q) => q.col === col && q.row === row);
  if (!a) return null;
  const cx = (a.x0 + a.x1) / 2;
  const col3 = world.collision;
  let x = side > 0 ? a.x1 : a.x0;
  const hit = col3 && col3.raycast(cx, 2.2, z, side, 0, 0, 12, SEE_THROUGH);
  if (hit) x = hit.x;
  return { x: x - side * 0.04, y: 2.75, z, nx: -side, ny: 0, nz: 0, ux: 0, uy: 1, uz: 0, w: 3.3 };
}

// (the owner's word: a find is a drawing on a page - a white sheet that stands out from what it is on, never ink on the wall in
// the wall's own colour) the sheet: a little wider and taller than the drawing, bowed off its surface in the middle, taped at
// the corners with masking tape; one per find, built once
// (the owner's second word: "a clear white background you can see") the drawing is printed on the sheet itself - a
// pencil's lines on white paper, in a texture - and the sheet glows a little of its own, like the island's road signs,
// so it reads white in the sun, at dusk and at night alike; the gold light runs over it as lines in the world
const PAPER_EDGE = linC(0.86, 0.83, 0.76);
const TAPE = linC(0.9, 0.84, 0.66);
// (the drawing's lines raised off the sheet a hair, in dark ink: the look's inker outlines each as it does all the city's
// edges, so the lines read bold on the white in any light - a printed line alone is washed out by the look's paper)
const INK = linC(0.07, 0.06, 0.06);
const INK_W = 0.05;
// (a stroke's pieces as one part, so the inker outlines the stroke and not each piece of it)
function mergeGeos(list) {
  const gs = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of gs) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  let k = 0;
  for (const g of gs) {
    pos.set(g.attributes.position.array, k * 3);
    nor.set(g.attributes.normal.array, k * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, k * 2);
    k += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}
const pageSize = (W, H) => [W * 1.16 + 0.24, H * 1.2 + 0.34];
// (its picture: the paper, a faint grain, the drawing in soft graphite - gone over twice, as a hand does)
function pageTexture(PW, PH, strokes, seed) {
  const cw = 1024;
  const chh = Math.max(256, Math.min(1024, Math.round((cw * PH) / PW)));
  const c = canvas(cw, chh);
  const g = c.getContext('2d');
  const sx = cw / PW;
  const sy = chh / PH;
  g.fillStyle = '#f8f6ef';
  g.fillRect(0, 0, cw, chh);
  let r = seed * 7919 + 17;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  // (the paper's grain: a few thousand specks a shade off white, and a breath of shadow toward its edges)
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(120,110,95,0.07)' : 'rgba(255,255,255,0.5)';
    g.fillRect(rnd() * cw, rnd() * chh, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  const vg = g.createRadialGradient(cw / 2, chh / 2, Math.min(cw, chh) * 0.35, cw / 2, chh / 2, Math.max(cw, chh) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(90,75,50,0.12)');
  g.fillStyle = vg;
  g.fillRect(0, 0, cw, chh);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const X = (u) => (u + PW / 2) * sx;
  const Y = (v) => (PH / 2 - v) * sy;
  for (const [pass, col, wm, j] of [
    [0, 'rgba(40,34,30,0.55)', 1.25, 0.9],
    [1, 'rgba(28,23,20,0.92)', 0.82, 0],
  ]) {
    for (const st of strokes) {
      const P = st.uv;
      if (P.length < 2) continue;
      g.strokeStyle = col;
      g.lineWidth = 0.05 * sx * wm;
      g.beginPath();
      const jx = (rnd() - 0.5) * j * 6;
      const jy = (rnd() - 0.5) * j * 6;
      g.moveTo(X(P[0][0]) + jx, Y(P[0][1]) + jy);
      for (let i = 1; i < P.length; i++) g.lineTo(X(P[i][0]) + jx + (rnd() - 0.5) * pass, Y(P[i][1]) + jy + (rnd() - 0.5) * pass);
      g.stroke();
    }
  }
  return canvasTexture(c);
}
function pageModel(W, H, strokes, seed) {
  const [PW, PH] = pageSize(W, H);
  const K = new Kit();
  const M = itemMats();
  const g = new THREE.PlaneGeometry(PW, PH, 8, 4);
  const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i) / (PW / 2);
    const y = pa.getY(i) / (PH / 2);
    // (bowed off the wall between its corners; a corner a little lifted)
    pa.setZ(i, 0.018 * (1 - x * x) * (1 - 0.5 * y * y) + (x > 0.7 && y < -0.7 ? 0.02 * (x - 0.7) * (-0.7 - y) * 11 : 0));
  }
  g.computeVertexNormals();
  // (where the sheet stands off the wall at a point of it - the same bow as its plane above)
  const bow = (u, v) => {
    const x = u / (PW / 2);
    const y = v / (PH / 2);
    return 0.018 * (1 - x * x) * (1 - 0.5 * y * y) + (x > 0.7 && y < -0.7 ? 0.02 * (x - 0.7) * (-0.7 - y) * 11 : 0);
  };
  for (const st of strokes) {
    // (points closer than 6 cm merged: fewer pieces, the same line)
    const P = [];
    for (const q of st.uv) if (!P.length || Math.hypot(q[0] - P[P.length - 1][0], q[1] - P[P.length - 1][1]) > 0.06) P.push(q);
    const last = st.uv[st.uv.length - 1];
    if (P.length && P[P.length - 1] !== last) P.push(last);
    const parts = [];
    for (let i = 0; i < P.length; i++) {
      const [u, v] = P[i];
      // (a round joint at each point, so a turn has no gap)
      const c = new THREE.CylinderGeometry(INK_W / 2, INK_W / 2, 0.012, 8);
      c.rotateX(Math.PI / 2);
      c.translate(u, v, bow(u, v) + 0.006);
      parts.push(c);
      if (i === 0) continue;
      const [u0, v0] = P[i - 1];
      const L = Math.hypot(u - u0, v - v0);
      if (L < 1e-3) continue;
      const b = new THREE.BoxGeometry(L, INK_W, 0.012);
      b.rotateZ(Math.atan2(v - v0, u - u0));
      b.translate((u + u0) / 2, (v + v0) / 2, bow((u + u0) / 2, (v + v0) / 2) + 0.006);
      parts.push(b);
    }
    if (parts.length) K.add(M.matte, mergeGeos(parts), INK);
  }
  const tex = pageTexture(PW, PH, strokes, seed);
  const paper = makeSurface({ kind: 'uv', vcolor: true, map: tex, emMap: tex, emissive: new THREE.Color(0.36, 0.36, 0.34), uvScale: PW, ang: 1.4, wash: 0.9, density: 0.4, line: 0.55 });
  K.add(paper, g, [0.86, 0.86, 0.84]);
  // (its edge seen as a thin darker line: a sheet, not a light)
  for (const [x0, y0, x1, y1] of [[-PW / 2, -PH / 2, PW / 2, -PH / 2 + 0.012], [-PW / 2, PH / 2 - 0.012, PW / 2, PH / 2], [-PW / 2, -PH / 2, -PW / 2 + 0.012, PH / 2], [PW / 2 - 0.012, -PH / 2, PW / 2, PH / 2]]) K.box(M.matte, x0, y0, 0.001, x1, y1, 0.004, PAPER_EDGE);
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const t = new THREE.BoxGeometry(0.24, 0.07, 0.004);
    t.rotateZ(sx * sy * -0.7);
    t.translate(sx * (PW / 2 - 0.05), sy * (PH / 2 - 0.05), 0.012);
    K.add(M.matte, t, TAPE);
  }
  const root = K.build({ seed: 0.41 });
  root.matrixAutoUpdate = false;
  root.userData.tex = tex;
  root.userData.paper = paper;
  return root;
}

// (a ray to the alley's wall goes past what stands in the alley)
const SEE_THROUGH = new Set(['pole', 'prop', 'tree', 'cover', 'car', 'board', 'fence', 'rail', 'furniture']);

const SHEEN_FAR = 25;
const NEAR = 10;
const REACH = 4;
// the lines: a pencil's on the wall, dark (the look pales what is light - a light line on a sunlit wall is lost); their
// light: deep gold ink, the colour of all that can be taken
const CHALK = [0.1, 0.08, 0.08];
const GOLD = [0.9, 0.56, 0.12];
const GOLD_HOT = [1.0, 0.74, 0.26];
// (on the white page the lines stay dark; the light runs along them in a deep gold that reads on white)
const GOLD_DEEP = [0.86, 0.46, 0.06];
const WARM = [1.0, 0.7, 0.36];

export class Finds {
  constructor(game) {
    this.game = game;
    this.state = this.load();
    this.spots = [];
    this.spotsAt = -1;
    this.copying = null;
    this.card = null;
    this.trying = null;
    this.vibed = new Set();
    this.scratchT = 0;
    this.fading = [];
    this.boardsDone = false;
  }

  // on: the regular game after the prologue, not the sandbox (nor ?classic, nor the lab)
  get on() {
    const g = this.game;
    if (g.classic || g.lab || !g.album || g.album.allOpen) return false;
    return !(g.prologue && g.prologue.active);
  }

  load() {
    const out = { found: [] };
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && Array.isArray(o.found)) out.found = o.found.filter((id) => BY_ID[id]);
      if (o && o.told) out.told = true;
    } catch (e) {
      // (no storage here: nothing found yet)
    }
    return out;
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch (e) {
      // ignore
    }
  }

  has(fid) {
    return this.state.found.includes(fid);
  }

  // the places, worked out once the world is there - and again while a find still has none (a place built later)
  ensureSpots() {
    const w = this.game.world;
    if (!w) return this.spots;
    if (this.spots.length === FINDS.length) return this.spots;
    const t = this.game.time || 0;
    if (this.spotsAt >= 0 && t - this.spotsAt < 2) return this.spots;
    this.spotsAt = t;
    for (const f of FINDS) {
      if (this.spots.some((s) => s.f === f)) continue;
      const live = f.at ? f.at(w, this.game) : null;
      if (!live) continue;
      const bp = BLUEPRINTS[f.draw || f.bp];
      const b = bp ? blueprintBounds(bp) : { x0: 0, y0: 0, w: 100, h: 50 };
      const W = f.w || live.w || 2.6;
      const H = (W * b.h) / Math.max(1, b.w);
      // (each stroke laid on its surface: points in metres across (u) and up (v) it, its length along it)
      const strokes = (bp ? bp.strokes : []).map((st) => {
        const uv = st.pts.map(([x, y]) => [((x - b.x0) / Math.max(1, b.w) - 0.5) * W, (0.5 - (y - b.y0) / Math.max(1, b.h)) * H]);
        let len = 0;
        const at = [0];
        for (let i = 1; i < uv.length; i++) {
          len += Math.hypot(uv[i][0] - uv[i - 1][0], uv[i][1] - uv[i - 1][1]);
          at.push(len);
        }
        return { uv, at, len, pts: uv.map(() => [0, 0, 0]) };
      });
      const total = strokes.reduce((a, q) => a + q.len, 0) || 1;
      const s = { f, live, W, H, strokes, total, seed: 4100 + FINDS.indexOf(f) * 97, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 1, page: null };
      // (its page, on its surface - not once it is taken)
      if (!this.has(f.id) && this.game.scene) {
        s.page = pageModel(W, H, strokes, s.seed);
        this.game.scene.add(s.page);
        s.page.visible = this.on;
      }
      this.place(s);
      this.spots.push(s);
    }
    return this.spots;
  }

  // its frame on its surface, from the place as it is now (a van drives on: its spot with it)
  place(s) {
    const L = s.live;
    const nx = L.nx || 0;
    const ny = L.ny || 0;
    const nz = L.nz || 0;
    let ux = L.ux;
    let uy = L.uy;
    let uz = L.uz;
    if (ux === undefined) {
      ux = 0;
      uy = 1;
      uz = 0;
    }
    // right = up x normal (a viewer facing the surface reads it left to right)
    const rx = uy * nz - uz * ny;
    const ry = uz * nx - ux * nz;
    const rz = ux * ny - uy * nx;
    s.x = L.x;
    s.y = L.y;
    s.z = L.z;
    s.nx = nx;
    s.ny = ny;
    s.nz = nz;
    // (the page on the surface; the lines on the page, a hair off it)
    if (s.page && !s.taking) {
      s.page.matrix.set(rx, ux, nx, L.x + nx * 0.012, ry, uy, ny, L.y + ny * 0.012, rz, uz, nz, L.z + nz * 0.012, 0, 0, 0, 1);
      s.page.matrixWorldNeedsUpdate = true;
    }
    const ox = L.x + nx * 0.045;
    const oy = L.y + ny * 0.045;
    const oz = L.z + nz * 0.045;
    // (the page's edge, for its light)
    const [PW, PH] = pageSize(s.W, s.H);
    s.rim = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [ox + rx * a * PW * 0.5 + ux * b * PH * 0.5, oy + ry * a * PW * 0.5 + uy * b * PH * 0.5, oz + rz * a * PW * 0.5 + uz * b * PH * 0.5]);
    for (const st of s.strokes) {
      for (let i = 0; i < st.uv.length; i++) {
        const [u, v] = st.uv[i];
        const p = st.pts[i];
        p[0] = ox + rx * u + ux * v;
        p[1] = oy + ry * u + uy * v;
        p[2] = oz + rz * u + uz * v;
      }
    }
  }

  // ------------------------------------------------------------------ what is open (ui/album.js, game/gearplay.js)
  // a find whose place is in the world, not found yet: what it gives is locked
  lockedBy(kind, id) {
    for (const s of this.ensureSpots()) {
      const f = s.f;
      if (kind === 'bp' ? f.bp !== id : f.part !== id && f.alsoPart !== id) continue;
      if (kind === 'part' && f.lv) continue;
      if (!this.has(f.id)) return f;
    }
    return null;
  }

  // (the owner, 23.11: only the start kit is open; everything else is locked till it is found - the sandbox's switch opens
  // all of it)
  bpOpen(id) {
    if (!BLUEPRINTS[id]) return false;
    if (START_BP.has(id)) return true;
    return FINDS.some((f) => f.bp === id && this.has(f.id));
  }

  partOpen(id) {
    if (id in START_PARTS) return true;
    return FINDS.some((f) => (f.part === id || f.alsoPart === id) && !f.lv && this.has(f.id));
  }

  partLevel(id) {
    let lv = START_PARTS[id] || 3;
    for (const f of FINDS) if (f.part === id && f.lv && this.has(f.id)) lv = Math.max(lv, f.lv);
    return lv;
  }

  levelLocked(id) {
    return FOUND_LEVELS.has(id);
  }

  findOf(id) {
    return FINDS.find((f) => f.bp === id || ((f.part === id || f.alsoPart === id) && !f.lv)) || null;
  }

  // where one not found yet is (the album's hint)
  where(id) {
    const f = this.findOf(id);
    if (!f || !this.ensureSpots().some((s) => s.f === f) || this.has(f.id)) return null;
    return f.where;
  }

  // ------------------------------------------------------------------ in the world
  update(dt) {
    if (!this.on) return;
    const g = this.game;
    const spots = this.ensureSpots();
    // (the printed board of a thing to be found: rubbed out by the Erasers - the drawing is on the wall nearby)
    if (!this.boardsDone && spots.length) {
      this.boardsDone = true;
      for (const s of spots) if (s.f.board && !this.has(s.f.id)) repaintBoard(s.f.board, 'erased');
    }
    // (once, the first time they are there: where to look for them - the map has each one, and the gym)
    if (!this.state.told && spots.length && g.hud) {
      this.toldT = (this.toldT || 0) + dt;
      if (this.toldT > 6) {
        this.state.told = true;
        this.save();
        g.hud.toast(g.touch ? tr('ציורים מחכים לכם בעיר — כל אחד מסומן במפה (ציורים למצוא). גם מכון האיגרוף במפה', 'Drawings are waiting for you in the city — each one is on the map (Drawings to find). The boxing gym is on it too') : tr('ציורים מחכים לכם בעיר — כל אחד מסומן במפה (M, ציורים למצוא). גם מכון האיגרוף במפה', 'Drawings are waiting for you in the city — each one is on the map (M, Drawings to find). The boxing gym is on it too'), 'info', 7);
      }
    }
    const p = g.player;
    const at = p.inVehicle ? p.inVehicle.pos : p.pos;
    this.scratchT -= dt;
    for (const s of spots) {
      if (this.has(s.f.id)) continue;
      // (a place that moves: its drawing with it)
      if (s.live.moves || s.live.parked !== undefined) this.place(s);
      const d = Math.hypot(s.x - at.x, (s.y - at.y) * 0.8, s.z - at.z);
      if (d > SHEEN_FAR + 5) {
        this.vibed.delete(s.f.id);
        continue;
      }
      // (from 10 m: a pencil's faint scratching from where it is; on a phone, a light buzz once)
      if (d < NEAR) {
        if (!this.vibed.has(s.f.id)) {
          this.vibed.add(s.f.id);
          if (g.touch && navigator.vibrate) {
            try {
              navigator.vibrate(22);
            } catch (e) {
              // optional
            }
          }
        }
        if (this.scratchT <= 0 && g.audio) {
          this.scratchT = 0.55 + Math.random() * 0.5;
          g.audio.play('scribble', 0.05 + 0.13 * (1 - d / NEAR));
        }
      }
    }
    this.tickTry(dt);
  }

  // the lines on the surface: a pencil's; from 25 m a sheen along them; from 10 m the light and the inking again
  draw(fr) {
    if (!this.on) {
      for (const s of this.spots) if (s.page) s.page.visible = false;
      return;
    }
    const g = this.game;
    const cam = g.camera.position;
    const t = g.time;
    const night = g.daynight ? g.daynight.night : 0;
    for (const s of this.spots) {
      const fade = this.fading.find((q) => q.s === s);
      if (this.has(s.f.id) && !fade) continue;
      const d = Math.hypot(s.x - cam.x, s.y - cam.y, s.z - cam.z);
      if (d > 75) continue;
      // (seen from behind its surface: nothing)
      if ((cam.x - s.x) * s.nx + (cam.y - s.y) * s.ny + (cam.z - s.z) * s.nz < 0) continue;
      const out = fade ? 1 - clamp(fade.t / 0.5, 0, 1) : 1;
      // (the high sun burns a glowing page white over its own lines: from late morning to mid afternoon the paper
      // takes less light and glows less of its own - at dusk and at night as it is)
      if (s.page && s.page.userData.paper) {
        const u = s.page.userData.paper.uniforms;
        const h = g.daynight ? g.daynight.hour : 17.6;
        const dayK = clamp((h - 7) / 2, 0, 1) * clamp((17.6 - h) / 1.2, 0, 1);
        u.uAlbedo.value.setScalar(1 - 0.32 * dayK);
        u.uEmissive.value.setRGB(0.36, 0.36, 0.34).multiplyScalar(1 - 0.85 * dayK);
      }
      const sheen = clamp((SHEEN_FAR - d) / (SHEEN_FAR - NEAR), 0, 1);
      const near = d < NEAR ? clamp((NEAR - d) / (NEAR - REACH), 0, 1) : 0;
      const lit = Math.max(sheen * 0.55, d < NEAR ? 0.6 + 0.4 * near : 0);
      // (a slow run of light along all the lines, every 3.6 s; near, one stroke at a time is gone over)
      const run = ((t % 3.6) / 2.6) * s.total;
      const ink = d < NEAR ? (t * 0.9) % (s.strokes.length + 0.6) : -1;
      let base = 0;
      s.strokes.forEach((st, k) => {
        const P = st.pts;
        const redo = ink >= k && ink < k + 1 ? (ink - k) * st.len : -1;
        for (let i = 1; i < P.length; i++) {
          const a = P[i - 1];
          const b = P[i];
          const mid = base + (st.at[i - 1] + st.at[i]) / 2;
          // the pencil's line itself: dark on the white page
          const w0 = 3.6 + lit * 1.2;
          const alpha = 0.9 * out;
          // the sheen passing: a band of deep gold a metre and a half long
          const dr = Math.abs(mid - run);
          const printed = !!s.page;
          if (sheen > 0 && dr < 0.75) {
            const k2 = (1 - dr / 0.75) * sheen;
            fr.lineXYZ(a[0], a[1], a[2], b[0], b[1], b[2], mix(CHALK, GOLD_DEEP, Math.min(1, k2 * 1.4)), w0 + 1.8 * k2, s.seed + k * 31 + i, alpha, 0.003, 0);
          } else if (!printed) fr.lineXYZ(a[0], a[1], a[2], b[0], b[1], b[2], lit > 0.5 ? mix(CHALK, GOLD_DEEP, (lit - 0.5) * 0.5) : CHALK, w0, s.seed + k * 31 + i, alpha, 0.003, 0);
          // (near: a soft warm halo round the lines on the page)
          // (on a printed page by day it would only soften the ink: there it is a night thing)
          if (lit > 0.4) fr.lineXYZ(a[0], a[1], a[2], b[0], b[1], b[2], GOLD_HOT, 9 + 6 * near, s.seed + 500 + k * 31 + i, (0.06 + 0.1 * near + 0.06 * night) * (printed ? night : 1) * out, 0.004, 0);
          // (the stroke gone over now: the pencil's line drawn fresh, up to where the hand is)
          if (redo >= 0 && st.at[i - 1] < redo) {
            const f2 = Math.min(1, (redo - st.at[i - 1]) / Math.max(1e-3, st.at[i] - st.at[i - 1]));
            const e = [a[0] + (b[0] - a[0]) * f2, a[1] + (b[1] - a[1]) * f2, a[2] + (b[2] - a[2]) * f2];
            fr.lineXYZ(a[0], a[1], a[2], e[0], e[1], e[2], GOLD_DEEP, w0 + 1.8, s.seed + 900 + k * 31 + i, out, 0.002, 0);
          }
        }
        base += st.len;
      });
      // (the page catching the light: a gold rim round its edge, from 25 m faint, near it plain - more at night)
      if (s.rim && lit > 0) {
        for (let i = 0; i < 4; i++) {
          const a = s.rim[i];
          const b = s.rim[(i + 1) % 4];
          fr.lineXYZ(a[0], a[1], a[2], b[0], b[1], b[2], GOLD_HOT, 8 + 10 * near, s.seed + 1300 + i, (0.12 + 0.3 * lit + 0.12 * night) * out, 0.004, 0);
          fr.lineXYZ(a[0], a[1], a[2], b[0], b[1], b[2], GOLD, 2.6, s.seed + 1310 + i, (0.4 + 0.5 * lit) * out, 0.003, 0);
        }
      }
      // (from 10 m: a warm light round it - more at night)
      if (d < NEAR + 4) {
        const k3 = clamp((NEAR + 4 - d) / 6, 0, 1) * out;
        // (by day the sun is light enough: more of it would burn the page white over its drawing)
        flashLight(s.x + s.nx * 1.1, s.y + s.ny * 1.1 + 0.2, s.z + s.nz * 1.1, 4.6, WARM, ((s.page ? 0.12 : 0.7) + 1.1 * night) * k3);
      }
    }
    for (const q of this.fading) {
      q.t += g.realDt || 1 / 60;
      // (the page taken off the wall: it peels away and goes to him, smaller as it goes)
      const P = q.s.page;
      if (P) {
        const k = clamp((q.t - 0.5) / 0.9, 0, 1);
        if (k >= 1) {
          P.visible = false;
          if (P.parent) P.parent.remove(P);
          q.s.page = null;
        } else if (k > 0) {
          q.s.taking = true;
          const h = g.player.pos;
          const e = k * k * (3 - 2 * k);
          const m = P.matrix.elements;
          const sc = 1 - 0.85 * e;
          const x = q.s.x + (h.x - q.s.x) * e;
          const y = q.s.y + (h.y + 1.3 - q.s.y) * e + Math.sin(e * Math.PI) * 0.6;
          const z = q.s.z + (h.z - q.s.z) * e;
          const b = q.base || (q.base = m.slice(0, 12));
          for (let i = 0; i < 11; i++) if (i % 4 !== 3) m[i] = b[i] * sc;
          m[12] = x;
          m[13] = y;
          m[14] = z;
          P.matrixWorldNeedsUpdate = true;
        }
      }
    }
    this.fading = this.fading.filter((q) => q.t < 1.4 || (q.s.page && q.s.page.visible));
    // (not finding - the prologue, the sandbox: no pages)
    for (const s of this.spots) if (s.page && !s.taking) s.page.visible = true;
  }

  // within reach and before it: E - copy it
  target() {
    if (!this.on || this.copying) return null;
    const g = this.game;
    const p = g.player;
    if (p.mode !== 'foot' || p.inVehicle) return null;
    for (const s of this.spots) {
      if (this.has(s.f.id)) continue;
      if (Math.abs(s.x - p.pos.x) > REACH + 2 || Math.abs(s.z - p.pos.z) > REACH + 2) continue;
      const dy = s.ny > 0.7 ? 0 : Math.max(0, Math.abs(s.y - (p.pos.y + 1.2)) - 1.6);
      const d = Math.hypot(s.x - p.pos.x, dy, s.z - p.pos.z);
      // (a drawing on a floor is read from on it, a little further off)
      if (d > (s.ny > 0.7 ? REACH + 1.8 : REACH)) continue;
      // (on its side, not round the corner of the wall; on the same floor as it)
      if (s.ny > 0.7) {
        if (Math.abs(p.pos.y - s.y) > 1.2) continue;
      } else if ((p.pos.x - s.x) * s.nx + (p.pos.z - s.z) * s.nz < 0.2) continue;
      // (on a van: while it stands)
      if (s.live.parked === false) return { s, wait: true, label: tr(`${s.f.title} — על הוואן; חכו שיעצור`, `${s.f.title} — on the van; wait for it to stop`) };
      return { s, label: tr(`E — להעתיק את הציור (${s.f.title})`, `E — copy the drawing (${s.f.title})`) };
    }
    return null;
  }

  interact() {
    const T = this.target();
    if (!T || T.wait) return !!(T && T.wait);
    return this.beginCopy(T.s);
  }

  // the pen opened on that one drawing: read against it alone (ui/freedraw.js copy)
  beginCopy(s) {
    const g = this.game;
    const F = g.freedraw;
    const f = s.f;
    const id = f.draw || f.bp;
    if (!F || !id) return false;
    // (facing it as he draws from it)
    const p = g.player;
    if (p.fig && s.ny < 0.7) p.faceYaw = Math.atan2(-s.nx, -s.nz);
    this.copying = s;
    const ok = F.copy(id, {
      title: f.title,
      rivals: BLUEPRINTS[id].kind === 'part' ? PART_IDS() : null,
      atY: s.ny > 0.7 ? s.y : null,
      onDone: (res) => this.found(s, res),
      onCancel: () => {
        this.copying = null;
      },
    });
    if (!ok) this.copying = null;
    return ok;
  }

  // copied, and real: kept, its drawing gone from the surface, its card, its try
  found(s, res) {
    const g = this.game;
    const f = s.f;
    this.copying = null;
    if (!this.has(f.id)) {
      this.state.found.push(f.id);
      this.save();
    }
    this.fading.push({ s, t: 0 });
    if (g.fx) {
      for (let i = 0; i < 6; i++) {
        const u = (Math.random() - 0.5) * s.W;
        g.fx.crumbs(s.x + s.nz * u + s.nx * 0.2, s.y + s.ny * 0.2 + (s.ny > 0.7 ? 0 : (Math.random() - 0.5) * s.H), s.z - s.nx * u + s.nz * 0.2, 4, 1.2);
      }
    }
    // (a part: learned for the tray - no tracing over its guide first - and on the ride you came in, if it is near)
    if (f.part) this.partFound(f);
    // (a ride found with a part of its own for other rides: that part learned for the tray too, not put on anything)
    if (f.alsoPart && g.tray && g.tray.store && g.tray.store.learned && !g.tray.store.learned[f.alsoPart] && g.tray.learnAll) g.tray.learnAll([f.alsoPart]);
    const F = g.freedraw;
    if (F) {
      F.legSig = '';
      if (F.showLegend) F.showLegend();
    }
    // (the card once it is in the hand)
    setTimeout(() => this.showCard(f, res), f.part ? 900 : 1700);
  }

  partFound(f) {
    const g = this.game;
    const T = g.tray;
    if (T && T.store && T.store.learned && !T.store.learned[f.part] && T.learnAll) T.learnAll([f.part]);
    // (a level found: the wings already on every ride take it at once)
    if (f.lv && g.fuse && g.vehicles) {
      for (const v of g.vehicles.list || []) {
        const parts = v.fuse && v.fuse.parts;
        if (!parts || !parts.some((q) => q.item === f.part)) continue;
        for (const q of parts) if (q.item === f.part) q.lv = Math.max(q.lv || 1, f.lv);
        try {
          g.fuse.applyVeh(v);
          g.fuse.buildVeh(v);
        } catch (e) {
          // (a ride that cannot be rebuilt now takes it the next time it is)
        }
      }
    }
    // (on the ride he came in, near: on it now)
    const p = g.player;
    const v = p.lastVehicle && p.lastVehicle.pos && Math.hypot(p.lastVehicle.pos.x - p.pos.x, p.lastVehicle.pos.z - p.pos.z) < 40 ? p.lastVehicle : null;
    if (!f.lv && v && T && T.attach) {
      const was = T.v;
      try {
        T.v = v;
        T.attach(f.part, { force: true, quiet: true });
      } catch (e) {
        // (not on this one: the tray has it)
      }
      T.v = was;
    }
  }

  // ------------------------------------------------------------------ the card and the first try
  showCard(f, res) {
    const g = this.game;
    css();
    if (this.card) this.card.remove();
    const el = document.createElement('div');
    el.className = 'find-card';
    const how = g.touch ? f.how.touch : f.how.keys;
    const grade = res && res.grade && !f.part ? { perfect: tr('העתקה מושלמת', 'A perfect copy'), good: tr('העתקה טובה', 'A good copy'), wonky: tr('העתקה עקומה — עובד, פחות חזק', 'A wonky copy — it works, weaker'), fail: tr('העתקה גרועה', 'A poor copy') }[res.grade] : '';
    el.innerHTML = `<div class="fc-k">${tr('נמצא', 'FOUND')}</div><div class="fc-t">${f.title}</div><div class="fc-l">${f.line}</div><div class="fc-h">${how}</div>${grade ? `<div class="fc-g">${grade}</div>` : ''}`;
    document.body.appendChild(el);
    this.card = el;
    requestAnimationFrame(() => el.classList.add('on'));
    if (g.audio) g.audio.play('pageflip', 0.6);
    setTimeout(() => {
      el.classList.remove('on');
      setTimeout(() => el.remove(), 700);
      if (this.card === el) this.card = null;
      this.startTry(f);
    }, 5600);
  }

  startTry(f) {
    const g = this.game;
    css();
    if (this.trying && this.trying.el) this.trying.el.remove();
    const el = document.createElement('div');
    el.className = 'find-try';
    el.textContent = f.tryText;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    const W = g.weapons;
    this.trying = { f, el, t: 0, from: W ? W.lastFire || 0 : 0, air: 0 };
  }

  // the first try, seen done: a weapon fired; a ride flown or driven; a part put to work
  tryDone(T, dt) {
    const g = this.game;
    const f = T.f;
    const W = g.weapons;
    if (f.bp && BLUEPRINTS[f.bp] && BLUEPRINTS[f.bp].kind === 'weapon') return !!(W && W.current && W.current.def && W.current.def.id === f.bp && (W.lastFire || 0) > T.from);
    const v = g.player.inVehicle;
    if (!v) return false;
    if (f.bp === 'copter') return v.model === 'copter' || v.kind === 'copter' ? v.pos.y - (v.groundY || 0) > 6 || (v.air && v.pos.y > 8) : false;
    // (the hover bike: ridden at speed a couple of seconds)
    if (f.bp === 'hoverbike') {
      if (v.kind === 'hoverbike' && Math.abs(v.speedAbs || v.speed || 0) > 12) T.air += dt;
      return T.air > 2;
    }
    const fz = v.fz;
    if (!fz) return false;
    if (f.part === 'jet') return !!(fz.par || fz.jet || fz.thrust) && (g.input.boost || g.input.keys.has('ShiftLeft') || g.input.keys.has('ShiftRight')) && (v.speed || 0) > 12;
    if (f.part === 'rotor') return !!fz.rotor && v.air && v.pos.y > 6;
    if (f.part === 'wing') {
      if (v.air && fz.wingCeil && v.pos.y > 45) T.air += dt;
      return T.air > 1.5;
    }
    return false;
  }

  tickTry(dt) {
    const T = this.trying;
    if (!T) return;
    const g = this.game;
    T.t += dt;
    const done = this.tryDone(T, dt);
    if (done || T.t > 150) {
      T.el.classList.remove('on');
      setTimeout(() => T.el.remove(), 600);
      this.trying = null;
      if (done) {
        g.hud.toast(T.f.part ? tr(`זה ${T.f.title}. מעכשיו הוא במגש החלקים — על כל כלי`, `That's the ${T.f.title}. It's in the parts tray now — for any ride`) : tr(`זה ${T.f.title}. מעכשיו הוא בספרייה שלכם — בעיפרון, נגיעה בו, ומוכן תוך שנייה`, `That's the ${T.f.title}. It's in your library now — the pencil, tap it, ready in a second`), 'good', 4.2);
        if (g.audio) g.audio.play('cheer', 0.5);
      }
    }
  }
}

function mix(a, b, k) {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

// (the card's look: a film's title - dark glass, a gold hairline, heavy narrow letters; nothing childish)
let cssDone = false;
function css() {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement('style');
  s.id = 'find-css';
  s.textContent = `
.find-card{position:fixed;left:max(22px,env(safe-area-inset-left));bottom:22%;z-index:40;pointer-events:none;max-width:min(420px,60vw);
 padding:14px 20px 14px 18px;background:linear-gradient(90deg,rgba(14,12,10,.82),rgba(14,12,10,.55) 70%,rgba(14,12,10,0));
 border-left:2px solid #d8a94e;color:#f3ead8;opacity:0;transform:translateX(-18px);transition:opacity .5s ease,transform .6s cubic-bezier(.2,.8,.2,1);direction:ltr;text-align:left}
.find-card.on{opacity:1;transform:none}
.find-card .fc-k{font:600 11px/1 "Rubik",sans-serif;letter-spacing:.32em;color:#d8a94e;margin-bottom:6px}
.find-card .fc-t{font:400 34px/1 "Anton","Rubik","Arial Narrow",sans-serif;letter-spacing:.04em;color:#fff4dc}
.find-card .fc-l{font:400 14px/1.35 "Rubik",sans-serif;margin-top:8px;color:#e8dcc4}
.find-card .fc-h{font:500 13px/1.3 "Rubik",sans-serif;margin-top:8px;color:#d8a94e}
.find-card .fc-g{font:400 12px/1.3 "Rubik",sans-serif;margin-top:6px;color:#bfb29a;font-style:italic}
html[dir=rtl] .find-card .fc-l,html[dir=rtl] .find-card .fc-h,html[dir=rtl] .find-card .fc-g{direction:rtl;text-align:right}
.find-try{position:fixed;left:50%;top:max(14px,env(safe-area-inset-top));z-index:40;pointer-events:none;transform:translate(-50%,-10px);opacity:0;
 padding:7px 16px;background:rgba(14,12,10,.7);border-bottom:1px solid #d8a94e;color:#f3ead8;font:500 14px/1.3 "Rubik",sans-serif;transition:opacity .4s,transform .5s}
.find-try.on{opacity:1;transform:translate(-50%,0)}
body.touch .find-card .fc-t{font-size:28px}
`;
  document.head.appendChild(s);
}

export { BY_ID as FIND_BY_ID };
