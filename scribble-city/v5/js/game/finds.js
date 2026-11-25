import * as THREE from 'three';
import { tr } from '../core/lang.js';
import { Kit, itemMats, linC } from './items.js';
import { clamp } from '../core/util.js';
import { BLUEPRINTS, blueprintBounds, BLUEPRINT_ORDER, BLUEPRINT_ROOFS } from './blueprints.js';
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
// (R26, the owner's word: "go to the blueprint and photograph it") A find is photographed, not copied at the wall: in
// reach, F or the camera button - the polaroid flies to the pencil, and it is his, still to be drawn once (ui/album.js
// known) before it is in the library for good. Big, valuable things are never out on the street: every page is small
// and off to the side - in an alley, up on a roof. A few are on the map (pin); most are not - from 30 m the game says
// one is near, and the pencil is heard scratching from 10 m.
//
// A thing on the list is locked only once its place is in the world (a stage built): till then it stays open as it
// was. What is not on the plan's lists at all stays open, as it was. The sandbox (the settings' "every drawing and
// part unlocked") opens everything, as before.

const KEY = 'scribble-city-v5-finds';

// (R27, the owner's word: "everything the player has from the first second is to be drawn first - here it is all at a tap") a
// game played before this rule kept what was drawn then: the drawn things, the parts learned and the drawings found are let go
// once, so the start is as a new player has it
(() => {
  try {
    if (localStorage.getItem('scribble-city-v5-epoch') === '27') return;
    const A = JSON.parse(localStorage.getItem('scribble-city-v5-album') || 'null');
    if (A && typeof A === 'object') {
      for (const k of Object.keys(A)) if (A[k] && typeof A[k] === 'object') A[k] = { best: null };
      localStorage.setItem('scribble-city-v5-album', JSON.stringify(A));
    }
    const T = JSON.parse(localStorage.getItem('scribble-city-v5-tray') || 'null');
    if (T && typeof T === 'object') {
      T.learned = {};
      localStorage.setItem('scribble-city-v5-tray', JSON.stringify(T));
    }
    localStorage.removeItem(KEY);
    // (and the settings' sandbox switch - every drawing and part open at a tap - off again, once)
    const S = JSON.parse(localStorage.getItem('scribble-city-v5-settings') || 'null');
    if (S && S.v && S.v.allOpen) {
      S.v.allOpen = false;
      localStorage.setItem('scribble-city-v5-settings', JSON.stringify(S));
    }
    localStorage.setItem('scribble-city-v5-epoch', '27');
  } catch (e) {
    // (no storage: a new start anyway)
  }
})();

// open from the end of the prologue (the plan's "55%")
export const START_BP = new Set(['paint', 'rifle', 'mp5', 'shotgun', 'inkbomb', 'car', 'muscle', 'hyper', 'nightshift', 'streetline', 'bike', 'ramp', 'barrier', 'bridge']);
// the car's parts at the start, and their level (the wings strong from the start: real flight - the owner's word)
// (the owner, 23.11: the helicopter's rotor too - drawn in the story's jump off the roof, his from then on)
// (R27, the owner's word: the turbo is the first drawing found in the city, in the opening's lesson - not in the start kit)
// (on with the opening's new lesson, game/prologue/director.js tutorial: till then the turbo stays in the start kit)
export const TURBO_FOUND = true;
export const START_PARTS = TURBO_FOUND ? { wing: 2, jump: 1, mg: 1, armor: 1, rotor: 1 } : { turbo: 1, wing: 2, jump: 1, mg: 1, armor: 1, rotor: 1 };
// the parts whose level is found, not bought
const FOUND_LEVELS = new Set(['wing', 'turbo']);
// what a part's copy is read against: the other parts, and everything on the pen's shelves
const PART_IDS = () => Object.values(BLUEPRINTS).filter((b) => b.kind === 'part').map((b) => b.id);

// the finds. bp: a blueprint it opens (copied as that blueprint); part: a part of the car's it opens, or lv: the level of
// it it brings (copied as the part's drawing, draw); at(world, game): its place - null while that place is not built
export const FINDS = [
  {
    id: 'turbo1',
    title: 'TURBO',
    part: 'turbo',
    draw: 'p_turbo',
    lv0: 1,
    pin: true,
    tutorial: true,
    w: 1.4,
    stage: 1,
    line: tr('טורבו ניטרו לכל כלי: לוחצים על הטורבו, והוא מזנק קדימה.', 'A nitro turbo for any ride: hit boost and it leaps forward.'),
    how: { touch: tr('ברכב: העיפרון ✏ ← טורבו, ציור להבה מאחורי הרכב · כפתור הטורבו', 'In a ride: the pencil ✏ → Turbo, a flame drawn behind it · the turbo button'), keys: tr('ברכב: Q ← טורבו, ציור להבה מאחורי הרכב · Shift', 'In a ride: Q → Turbo, a flame drawn behind it · Shift') },
    tryText: tr('נסו אותו עכשיו: ציירו אותו על מכונית ולחצו טורבו', 'Try it now: draw it on a car and hit boost'),
    where: tr('בסמטה ליד תחילת הדרך — מסומן במפה', 'In an alley near where you start — marked on the map'),
    at: (world) => hiddenSpot(world, 'turbo1', TURBO_AT),
  },
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
    w: 1.6,
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
    w: 1.5,
    pin: true,
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
    w: 1.6,
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
    w: 1.6,
    pin: true,
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
    w: 1.6,
  },
  {
    id: 'hoverbike',
    title: 'HOVER BIKE',
    bp: 'hoverbike',
    // (and its pods for any ride: in the parts tray from the day it is found)
    alsoPart: 'hover',
    // (R26, the owner's word: small, like the rest)
    w: 1.5,
    pin: true,
    stage: 1,
    line: tr('אופנוע בלי גלגלים, על שני תרמילי ריחוף: מעל הכביש, החול והים. ואת התרמילים שלו אפשר לשים על כל כלי.', 'A motorbike with no wheels, on two hover pods: over the road, the sand and the sea. And its pods go on any ride.'),
    how: { touch: tr('מציירים אותו מהעיפרון, ברכבים · ▲ קפיצה · על כלי אחר: "חלקים" ← משטחי ריחוף', 'Draw it from the pencil, under rides · ▲ hops · on another ride: "Parts" → Hover Pads'), keys: tr('מציירים אותו מהעיפרון, ברכבים · רווח קפיצה · על כלי אחר: Q ← חלקים ← משטחי ריחוף', 'Draw it from the pencil, under rides · Space hops · on another ride: Q → Parts → Hover Pads') },
    tryText: tr('נסו אותו עכשיו: עלו עליו ורכבו מהחוף אל הים', 'Try it now: get on and ride off the beach onto the sea'),
    where: tr('בוואן של המכונאי של הגולשים (SALT & SPANNER) — עוצר ליד החוף, ליד המזח וליד מלון מיראז׳', "In the surfers' mechanic's van (SALT & SPANNER) — it stops by the beach, at the pier and by Hotel Mirage"),
    at: (world, game) => placeSpot(game, 'hoverbike'),
  },
];

// (R26, the owner's word: "a weapon, a tank, a luxury car - anything big and valuable is never out on the open street; always
// in some alley, somewhere less seen, and small like the rest") the old blueprint boards - the tank over a cross street,
// the copters, the laser, the machine guns - are rubbed out (world/boards.js 'erased'), and what was on each is a small
// page hidden nearby: in the alley nearest its board, or on the roof by a roof board. Never on the map - found by
// walking the alleys and the roofs, the game saying when one is near.
export const HIDDEN_WHERE = tr('מוסתר איפשהו בעיר — בסמטאות, על הגגות. כשמתקרבים, המשחק אומר', 'Hidden somewhere in the city — in the alleys, up on the roofs. When you are close, the game tells you');
const HOW = {
  weapon: { touch: tr('מציירים אותו מהעיפרון · מחזיקים כוונת, ונגיעה בירי', 'Draw it from the pencil · hold aim, tap fire'), keys: tr('מציירים אותו מהעיפרון (Q) · קליק ימני לכוון, קליק לירות', 'Draw it from the pencil (Q) · right-click to aim, click to fire') },
  vehicle: { touch: tr('מציירים אותו מהעיפרון, ברכבים · ועולים עליו', 'Draw it from the pencil, under rides · and get on it'), keys: tr('מציירים אותו מהעיפרון (Q), ברכבים · E לעלות', 'Draw it from the pencil (Q), under rides · E to get on') },
  other: { touch: tr('מציירים אותו מהעיפרון', 'Draw it from the pencil'), keys: tr('מציירים אותו מהעיפרון (Q)', 'Draw it from the pencil (Q)') },
};
if (!TURBO_FOUND) FINDS.splice(FINDS.findIndex((f) => f.id === 'turbo1'), 1);
for (const id of [...BLUEPRINT_ORDER, ...BLUEPRINT_ROOFS]) {
  const bp = BLUEPRINTS[id];
  if (!bp || bp.hidden || START_BP.has(id) || FINDS.some((f) => f.bp === id)) continue;
  const kind = bp.kind === 'weapon' ? 'weapon' : bp.kind === 'vehicle' ? 'vehicle' : 'other';
  FINDS.push({
    id: `h_${id}`,
    title: bp.name,
    bp: id,
    hidden: true,
    w: 1.3,
    stage: 1,
    line: bp.desc || '',
    how: HOW[kind],
    tryText: kind === 'weapon' ? tr(`נסו אותו עכשיו: ירו ב${bp.name}`, `Try it now: fire the ${bp.name}`) : kind === 'vehicle' ? tr(`נסו אותו עכשיו: עלו על ${bp.name} וסעו`, `Try it now: get on the ${bp.name} and go`) : '',
    where: HIDDEN_WHERE,
    at: (world) => hiddenSpot(world, id),
  });
}

const BY_ID = Object.fromEntries(FINDS.map((f) => [f.id, f]));
// (the turbo's page: in the alley nearest where the story sets out)
const TURBO_AT = { x: 12, z: 10 };

// (R26) where a hidden page is: worked out once per world - by its old board (the nearest alley's wall; a roof board's own
// roof), or, with no board, an alley of its own
const HIDE = new WeakMap();
const SLOT_FR = [0.3, 0.7, 0.5, 0.18, 0.84, 0.4, 0.6, 0.26];
// (not alleys: open places) and what a page's wall is seen through when it is looked for (a fence or a board in front hides it)
const ALLEY_NOT = new Set(['park', 'plaza', 'motel', 'towers', 'market']);
const ALLEY_SEE = new Set(['prop', 'cover', 'car', 'furniture', 'rail']);
function hiddenSpot(world, id, anchor = null) {
  let memo = HIDE.get(world);
  if (!memo) HIDE.set(world, (memo = { at: new Map(), used: new Map(), pts: [] }));
  if (memo.at.has(id)) return memo.at.get(id);
  const col = world.collision;
  const boards = anchor ? [] : (world.billboards || []).filter((b) => b.id === id);
  let spot = null;
  const roof = boards.find((b) => b.roof);
  if (roof && col && col.pointInside) {
    // (on the roof by its board: the side of it the roof is on, read with its top toward the board)
    for (const k of [-2.4, 2.4, -3.6, 3.6]) {
      const x = roof.x + roof.nx * k;
      const z = roof.z + roof.nz * k;
      const y = roof.top;
      if (y === undefined || !col.pointInside(x, y - 0.4, z) || col.pointInside(x, y + 0.6, z)) continue;
      const s = Math.sign(k);
      spot = { x, y: y + 0.03, z, nx: 0, ny: 1, nz: 0, ux: s * roof.nx, uy: 0, uz: s * roof.nz };
      break;
    }
  }
  // (a real alley - not a park, a square, a motel's lot, the towers' or the market's - its page on a building's wall that
  // nothing stands in front of, with room for him to stand before it, and no other page within 10 m)
  const alleys = (world.alleys || []).filter((q) => !ALLEY_NOT.has(q.type));
  if (!spot && alleys.length && col) {
    const b = anchor || boards.find((q) => !q.roof);
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const ax = b ? b.x : 0;
    const az = b ? b.z : 0;
    const order = alleys
      .map((q) => ({ q, d: b ? Math.hypot((q.x0 + q.x1) / 2 - ax, (q.z0 + q.z1) / 2 - az) + (memo.used.get(q) || 0) * 40 : ((h + alleys.indexOf(q) * 7) % 97) }))
      .sort((p1, p2) => p1.d - p2.d);
    for (const { q: a } of order) {
      const cx = (a.x0 + a.x1) / 2;
      const n = memo.used.get(a) || 0;
      for (let k = 0; k < SLOT_FR.length * 2 && !spot; k++) {
        const fr = SLOT_FR[(n + k) % SLOT_FR.length];
        const side = (n + k) % 2 ? 1 : -1;
        const z = a.z0 + (a.z1 - a.z0) * fr;
        const hit = col.raycast(cx, 1.85, z, side, 0, 0, 14, ALLEY_SEE);
        if (!hit || !hit.box || hit.box.tag !== 'wall' || Math.abs(hit.x - cx) < 1.2) continue;
        const x = hit.x - side * 0.04;
        // (room to stand before it, and the wall the page is on runs on past both its edges)
        if (col.pointInside(x - side * 1.6, 1.0, z) || col.pointInside(x - side * 1.6, 1.0, z + 0.8) || col.pointInside(x - side * 1.6, 1.0, z - 0.8)) continue;
        const e1 = col.raycast(cx, 1.85, z + 0.8, side, 0, 0, 14, ALLEY_SEE);
        const e2 = col.raycast(cx, 1.85, z - 0.8, side, 0, 0, 14, ALLEY_SEE);
        if (!e1 || !e2 || Math.abs(e1.x - hit.x) > 0.3 || Math.abs(e2.x - hit.x) > 0.3) continue;
        if (memo.pts.some(([px, pz]) => Math.hypot(px - x, pz - z) < 10)) continue;
        // (nothing standing before it - a palm, a pole, a lamp, crates - within a metre and a half out from the wall)
        let blocked = false;
        const fx0 = Math.min(x, x - side * 3.4);
        const fx1 = Math.max(x, x - side * 3.4);
        col.forEachIn(fx0, z - 1.6, fx1, z + 1.6, (q) => {
          if (q.tag === 'wall' || q.y1 < 1.3 || q.y0 > 3.2) return false;
          blocked = true;
          return true;
        });
        if (blocked) continue;
        // (not over the meters or an air conditioner on that wall)
        if ((world.wallProps || []).some((q) => Math.abs(q.x - x) < 0.7 && Math.abs(q.z - z) < q.half + 0.9)) continue;
        spot = { x, y: 1.85, z, nx: -side, ny: 0, nz: 0, ux: 0, uy: 1, uz: 0 };
        memo.used.set(a, n + 1);
        memo.pts.push([x, z]);
      }
      if (spot) break;
    }
  }
  memo.at.set(id, spot);
  return spot;
}

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
  // (R26: the pages are small now - half the texture, and a phone's memory spared)
  const cw = PW < 2.2 ? 512 : 1024;
  const chh = Math.max(128, Math.min(1024, Math.round((cw * PH) / PW)));
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
// (R27) the page lit by the special vision (game/vision.js)
const VISION_GLOW = new THREE.Color(1.0, 0.62, 0.95);
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
    // (R27) the story's lesson on the find it leads to (game/prologue/director.js lessonFind): its id while it is on
    this.lesson = null;
    // (R27) the parts seen on a ride as he got into it - the ones put on after are his drawing
    this.partsSeen = new WeakSet();
  }

  // (R26, the owner's word: "from the very start of the game") the rules - the start kit open, the rest found, each thing
  // drawn once before it is in the library - from the first minute of the story on; not in the sandbox, ?classic or the lab
  get rules() {
    const g = this.game;
    return !(g.classic || g.lab || !g.album || g.album.allOpen);
  }

  // on: the pages in the city. (R27: in the story too - its opening lesson leads to the first of them, and a page marked on the map
  // is there to be found whenever he goes to it)
  get on() {
    return this.rules;
  }

  // (the story's film playing: no words of the game's own over it)
  get quiet() {
    const g = this.game;
    return typeof document !== 'undefined' && document.body.classList.contains('prologue-film');
  }

  // (R26) on the map: a few (pin) - or every one, with the settings' switch for the owner's own checks
  pinned(f) {
    const st = this.game.settings;
    return !!f.pin || !!(st && st.v && st.v.allPins);
  }

  load() {
    const out = { found: [], tried: [], coached: {} };
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && Array.isArray(o.found)) out.found = o.found.filter((id) => BY_ID[id]);
      if (o && Array.isArray(o.tried)) out.tried = o.tried.filter((id) => BY_ID[id]);
      if (o && o.coached && typeof o.coached === 'object') out.coached = o.coached;
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
      // (its page: made when he comes near it - draw(), one a frame - and kept)
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
    // (the owner, 23.11: the helicopter's rotor is his from the story's jump off the roof - not before it)
    const P = this.game.prologue;
    if (id === 'rotor' && P && P.active && !(P.sceneN >= 8)) return false;
    if (id in START_PARTS) return true;
    // (R27: the turbo is the first page found - should this world have no place for it, it is open as it was)
    if (id === 'turbo' && TURBO_FOUND && this.game.world && this.ensureSpots().length && !this.spots.some((s) => s.f.id === 'turbo1')) return true;
    return FINDS.some((f) => (f.part === id || f.alsoPart === id) && !f.lv && this.has(f.id));
  }

  partLevel(id) {
    const base = FINDS.find((f) => f.part === id && !f.lv && f.lv0 && this.has(f.id));
    let lv = START_PARTS[id] || (base ? base.lv0 : 3);
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
    return this.pinned(f) ? f.where : HIDDEN_WHERE;
  }

  // ------------------------------------------------------------------ (R26) the game's own words, one at a time
  // a short line on a card at the top of the screen - what to do now, said once (key) - queued, never two at once
  coach(key, text, o = {}) {
    if (key && this.state.coached[key]) return;
    if (key) {
      this.state.coached[key] = 1;
      this.save();
    }
    this.coachQ = this.coachQ || [];
    this.coachQ.push({ text, t: o.t || 6.5, icon: o.icon || '✎', then: o.then || null });
    if (!this.coachEl) this.nextCoach();
  }

  nextCoach() {
    const q = this.coachQ && this.coachQ.shift();
    if (!q) return;
    css();
    const el = document.createElement('div');
    el.className = 'find-coach';
    el.innerHTML = `<i>${q.icon}</i><span>${q.text}</span>`;
    document.body.appendChild(el);
    this.coachEl = el;
    requestAnimationFrame(() => el.classList.add('on'));
    if (this.game.audio) this.game.audio.play('pageflip', 0.35);
    setTimeout(() => {
      el.classList.remove('on');
      setTimeout(() => {
        el.remove();
        if (this.coachEl === el) this.coachEl = null;
        if (q.then) q.then();
        this.nextCoach();
      }, 450);
    }, q.t * 1000);
  }

  // ------------------------------------------------------------------ in the world
  // (R26) the old blueprint boards: what is not his yet rubbed out (the Erasers' work - its page is hidden nearby); all of
  // them printed again in the sandbox. Under the rules from the story's first minute: no tank over a cross street
  syncBoards(dt) {
    this.boardT = (this.boardT || 0) - dt;
    if (this.boardT > 0) return;
    this.boardT = 1;
    const w = this.game.world;
    if (!w || !w.billboards) return;
    this.boardMode = this.boardMode || {};
    const rules = this.rules;
    for (const b of w.billboards) {
      // (the start kit's own boards stay printed: those are no secret)
      const want = rules && !START_BP.has(b.id) ? 'erased' : 'print';
      if ((this.boardMode[b.id] || 'print') === want) continue;
      this.boardMode[b.id] = want;
      try {
        repaintBoard(b.id, want);
      } catch (e) {
        // (a board not in the atlas: as it is)
      }
    }
  }

  update(dt) {
    this.syncBoards(dt);
    if (!this.on) return;
    const g = this.game;
    const spots = this.ensureSpots();
    // (R26, the owner's word: "the game explains from the start that blueprints are scattered in the city") once, a little
    // after the story hands over: what they are, how they are had, that a few are on the map - and the way to the nearest
    if (!this.state.coached.handover && spots.length && g.hud && !g.paused && !(g.prologue && g.prologue.active)) {
      this.toldT = (this.toldT || 0) + dt;
      if (this.toldT > 5) {
        const map = g.touch ? tr('המפה', 'the map') : tr('המפה (M)', 'the map (M)');
        this.coach('handover', tr(`שרטוטים מוסתרים בכל העיר — כלי נשק, רכבים, חלקים. מצלמים שרטוט, והוא שלכם לצייר. כמה מהם מסומנים ב${map} בזהב; רוב השרטוטים לא — אותם מחפשים בסמטאות ועל הגגות`, `Blueprints are hidden all over the city — weapons, rides, parts. Photograph one and it's yours to draw. A few are marked in gold on ${map}; most are not — those you hunt for in the alleys and up on the roofs`), { t: 9, icon: '📷' });
        this.guideTo();
      }
    }
    const p = g.player;
    const at = p.inVehicle ? p.inVehicle.pos : p.pos;
    this.learnT = (this.learnT || 0) - dt;
    if (this.learnT <= 0) {
      this.learnT = 0.4;
      this.learnParts();
    }
    this.scratchT -= dt;
    this.nearSet = this.nearSet || new Set();
    for (const s of spots) {
      if (this.has(s.f.id)) continue;
      // (a place that moves: its drawing with it)
      if (s.live.moves || s.live.parked !== undefined) this.place(s);
      const d = Math.hypot(s.x - at.x, (s.y - at.y) * 0.8, s.z - at.z);
      // (R26, the owner's word: "when the player comes to a blueprint's area, a message pops up that one is near") from 30 m,
      // once - again only after he has been 60 m off (a van: once a game)
      if (d < 30 && !this.nearSet.has(s.f.id) && !this.quiet && this.mayTell(s.f)) {
        this.nearSet.add(s.f.id);
        if (!this.state.coached.near) this.coach('near', tr('שרטוט מוסתר קרוב! חפשו דף לבן עם קווים בזהב — כשמתקרבים שומעים עיפרון משרבט', 'A hidden blueprint is close! Look for a white page with gold lines — up close you can hear a pencil scratching'), { t: 6, icon: '✦' });
        else if (g.hud) g.hud.toast(s.ny > 0.7 ? tr('✦ שרטוט מוסתר קרוב — על גג, למעלה', '✦ A hidden blueprint is close — up on a roof') : tr('✦ שרטוט מוסתר קרוב — הסתכלו מסביב', '✦ A hidden blueprint is close — look around'), 'info', 3.2);
        if (g.audio) g.audio.play('pageflip', 0.45);
      } else if (d > 60 && !(s.live.moves || s.live.parked !== undefined)) this.nearSet.delete(s.f.id);
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

  // (R27) in the story, before its lesson has led him to the first page: no word of any other (the opening teaches one
  // thing at a time) - after it, every page as in the game
  mayTell(f) {
    const P = this.game.prologue;
    if (!(P && P.active) || !TURBO_FOUND || this.has('turbo1')) return true;
    return f.id === this.lesson;
  }

  // (R27, the owner's word: "drawn once - from then on at a tap") a part put on his ride by his own drawing (the pen) is
  // learned, as one traced over its lines in the parts tray: the parts on a ride as he got in are not his drawing
  learnParts() {
    const g = this.game;
    const v = g.player.inVehicle;
    const T = g.tray;
    if (!v || !v.fuse || !v.fuse.parts || !T || !T.store || !T.learnAll) {
      this.inRide = null;
      return;
    }
    if (this.inRide !== v) {
      this.inRide = v;
      for (const q of v.fuse.parts) this.partsSeen.add(q);
      return;
    }
    for (const q of v.fuse.parts) {
      if (this.partsSeen.has(q)) continue;
      this.partsSeen.add(q);
      if (!q.item || T.store.learned[q.item]) continue;
      T.learnAll([q.item]);
      if (T.store.learned[q.item]) this.onLearned(q.item);
    }
  }

  // (R26) the GPS to the nearest find on the map not taken yet - the first thing to go for after the story
  guideTo() {
    const g = this.game;
    if (!g.gps || !g.gps.set) return;
    const at = g.player.pos;
    let best = null;
    let bd = Infinity;
    for (const s of this.spots) {
      if (this.has(s.f.id) || !s.f.pin) continue;
      // (R27: the turbo's page before any other - the first one, near the start)
      const d = Math.hypot(s.x - at.x, s.z - at.z) - (s.f.tutorial ? 1e5 : 0);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    if (!best) return;
    try {
      g.gps.set(best.x, best.z, best.f.title);
    } catch (e) {
      // (no route there: the map has it)
    }
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
    // (R26) a page made as he comes within 90 m of it, one a frame - and kept
    if (g.scene) {
      for (const s of this.spots) {
        if (s.page || s.gone) continue;
        if (Math.hypot(s.x - cam.x, s.y - cam.y, s.z - cam.z) > 90) continue;
        s.page = pageModel(s.W, s.H, s.strokes, s.seed);
        g.scene.add(s.page);
        this.place(s);
        break;
      }
    }
    for (const s of this.spots) {
      const fade = this.fading.find((q) => q.s === s);
      if (this.has(s.f.id) && !fade) continue;
      const d = Math.hypot(s.x - cam.x, s.y - cam.y, s.z - cam.z);
      // (R27: the special vision on - the blueprint it is after lit up from far off, game/vision.js)
      const vk = g.vision && g.vision.target === s ? g.vision.k : 0;
      if (d > 75 && vk < 0.05) continue;
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
        if (vk > 0) u.uEmissive.value.lerp(VISION_GLOW, vk * (0.55 + 0.25 * Math.sin(t * 7)));
      }
      const sheen = Math.max(vk, clamp((SHEEN_FAR - d) / (SHEEN_FAR - NEAR), 0, 1));
      const near = d < NEAR ? clamp((NEAR - d) / (NEAR - REACH), 0, 1) : 0;
      const lit = Math.max(sheen * 0.55, d < NEAR ? 0.6 + 0.4 * near : 0, vk);
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
          if (lit > 0.4) fr.lineXYZ(a[0], a[1], a[2], b[0], b[1], b[2], GOLD_HOT, 9 + 6 * near + 10 * vk, s.seed + 500 + k * 31 + i, ((0.06 + 0.1 * near + 0.06 * night) * (printed ? night : 1) + 0.45 * vk) * out, 0.004, 0);
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
      // (R26, the owner's word: "go to the blueprint and photograph it to get it")
      return { s, photo: true, label: g.touch ? tr('📷 לצלם את השרטוט', '📷 Photograph the blueprint') : tr(`F — לצלם את השרטוט (${s.f.title})`, `F — photograph the blueprint (${s.f.title})`) };
    }
    return null;
  }

  interact() {
    const T = this.target();
    if (!T || T.wait) return !!(T && T.wait);
    return this.snap(T.s);
  }

  // (R26) the photo: the flash, the shutter, the polaroid to the pencil (game/game.js snapFx) - his, still to be drawn once
  snap(s) {
    const g = this.game;
    const f = s.f;
    const bp = BLUEPRINTS[f.draw || f.bp];
    const p = g.player;
    if (p.fig && s.ny < 0.7) p.faceYaw = Math.atan2(-s.nx, -s.nz);
    if (g.snapFx && bp) g.snapFx(bp, f.title);
    this.found(s);
    return true;
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

  // photographed: kept - his to draw once (R26: no tracing at the wall, nothing learned or put on a ride by itself); its card
  found(s, res) {
    const g = this.game;
    const f = s.f;
    this.copying = null;
    if (!this.has(f.id)) {
      this.state.found.push(f.id);
      this.save();
    }
    // (a level of a part he has: the wings already on every ride take it at once)
    if (f.part) this.partFound(f);
    const F = g.freedraw;
    if (F) {
      F.legSig = '';
      if (F.showLegend) F.showLegend();
    }
    // (the pen opened next on foot: this one picked, its picture, the pencil showing how - ui/freedraw.js learn)
    this.pendingLearn = f;
    // (the card once the polaroid is in the pencil)
    setTimeout(() => this.showCard(f, res), 1300);
  }

  // what it gives, to be drawn: a blueprint's id or a part's
  drawId(f) {
    return f.bp || (f.lv ? null : f.part) || null;
  }

  // (R26) drawn once - his for good (game/game.js onDrawingDone, game/buildtray.js learn): its first try, then and there
  onLearned(id) {
    const f = FINDS.find((q) => this.has(q.id) && (q.bp === id || (q.part === id && !q.lv) || q.alsoPart === id));
    if (this.pendingLearn && (this.pendingLearn.bp === id || this.pendingLearn.part === id)) this.pendingLearn = null;
    if (!f || this.state.tried.includes(f.id)) return;
    this.state.tried.push(f.id);
    this.save();
    // (R27: in the story's lesson the try is the lesson's own next step)
    const P = this.game.prologue;
    if (f.tutorial && P && P.active) return;
    if (f.tryText) setTimeout(() => this.startTry(f), 2200);
  }

  partFound(f) {
    const g = this.game;
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
  }

  // ------------------------------------------------------------------ the card and the first try
  showCard(f, res) {
    const g = this.game;
    css();
    if (this.card) this.card.remove();
    const el = document.createElement('div');
    el.className = 'find-card';
    const how = g.touch ? f.how.touch : f.how.keys;
    const bp = BLUEPRINTS[f.draw || f.bp];
    const pen = g.touch ? tr('העיפרון ✏', 'the pencil ✏') : tr('העיפרון (Q)', 'the pencil (Q)');
    // (R26) what is next, said plainly: drawn once, and it is in the library for good
    const next = f.lv
      ? tr('הכנפיים שלכם עכשיו ברמה הזו — על כל כלי עם כנפיים', 'Your wings are at this level now — on every ride with wings')
      : f.part
      ? tr(`ברכב: ${pen} ← חלקים ← ${bp ? bp.name : f.title} — ציירו אותו פעם אחת, והוא שלכם`, `In a ride: ${pen} → Parts → ${bp ? bp.name : f.title} — draw it once and it's yours`)
      : tr(`עכשיו ציירו אותו פעם אחת: ${pen} ← ${bp ? bp.name : f.title}. מאז הוא בספרייה, מוכן בנגיעה`, `Now draw it once: ${pen} → ${bp ? bp.name : f.title}. From then on it's in your library, ready at a tap`);
    el.innerHTML = `<div class="fc-k">${tr('צולם', 'PHOTOGRAPHED')}</div><div class="fc-t">${f.title}</div><div class="fc-l">${f.line}</div><div class="fc-n">${next}</div><div class="fc-h">${how}</div>`;
    document.body.appendChild(el);
    this.card = el;
    requestAnimationFrame(() => el.classList.add('on'));
    if (g.audio) g.audio.play('pageflip', 0.6);
    setTimeout(() => {
      el.classList.remove('on');
      setTimeout(() => el.remove(), 700);
      if (this.card === el) this.card = null;
      // (the first photo: the next step said once more, short, where the eye is)
      if (!f.lv) this.coach('firstphoto', f.part ? tr('השרטוט אצלכם — עכשיו ציירו אותו פעם אחת על רכב, והוא שלכם לתמיד', "The blueprint is yours — now draw it once on a ride, and it's yours for good") : tr(`השרטוט אצלכם — פתחו את העיפרון ${g.touch ? '✏' : '(Q)'} וציירו אותו פעם אחת. המשחק יראה לכם איך`, `The blueprint is yours — open the pencil ${g.touch ? '✏' : '(Q)'} and draw it once. The game will show you how`), { t: 6.5, icon: '✏' });
    }, 6200);
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
    if (f.part === 'turbo') {
      const on = !!(v.fuse && v.fuse.parts && v.fuse.parts.some((q) => q.item === 'turbo'));
      if (on && (g.input.boost || g.input.keys.has('ShiftLeft') || g.input.keys.has('ShiftRight')) && Math.abs(v.speed || 0) > 12) T.air += dt;
      return T.air > 0.6;
    }
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
.find-card .fc-h{font:500 13px/1.3 "Rubik",sans-serif;margin-top:6px;color:#bfb29a}
.find-card .fc-n{font:600 14px/1.35 "Rubik",sans-serif;margin-top:9px;color:#ffd27a}
.find-coach{position:fixed;left:50%;top:max(58px,calc(env(safe-area-inset-top) + 48px));z-index:41;pointer-events:none;display:flex;gap:10px;align-items:center;
 max-width:min(560px,86vw);padding:10px 16px;background:rgba(14,12,10,.84);border:1px solid rgba(216,169,78,.55);border-radius:10px;color:#f3ead8;
 font:500 15px/1.4 "Rubik",sans-serif;opacity:0;transform:translate(-50%,-8px);transition:opacity .4s,transform .5s cubic-bezier(.2,.8,.2,1);box-shadow:0 6px 24px rgba(0,0,0,.35)}
.find-coach.on{opacity:1;transform:translate(-50%,0)}
body.fd-open .find-coach{opacity:0!important}
.find-coach i{font-style:normal;font-size:20px;color:#ffd27a;flex:none}
html[dir=rtl] .find-coach{direction:rtl;text-align:right}
body.touch .find-coach{font-size:13px;padding:8px 12px}
.find-card .fc-g{font:400 12px/1.3 "Rubik",sans-serif;margin-top:6px;color:#bfb29a;font-style:italic}
html[dir=rtl] .find-card .fc-l,html[dir=rtl] .find-card .fc-h,html[dir=rtl] .find-card .fc-g,html[dir=rtl] .find-card .fc-n{direction:rtl;text-align:right}
.find-try{position:fixed;left:50%;top:max(14px,env(safe-area-inset-top));z-index:40;pointer-events:none;transform:translate(-50%,-10px);opacity:0;
 padding:7px 16px;background:rgba(14,12,10,.7);border-bottom:1px solid #d8a94e;color:#f3ead8;font:500 14px/1.3 "Rubik",sans-serif;transition:opacity .4s,transform .5s}
.find-try.on{opacity:1;transform:translate(-50%,0)}
body.touch .find-card .fc-t{font-size:28px}
`;
  document.head.appendChild(s);
}

export { BY_ID as FIND_BY_ID };
