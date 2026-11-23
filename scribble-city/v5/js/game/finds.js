import { tr } from '../core/lang.js';
import { clamp } from '../core/util.js';
import { BLUEPRINTS, blueprintBounds } from './blueprints.js';
import { flashLight } from '../render/materials.js';
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
export const START_PARTS = { turbo: 1, wing: 2, jump: 1, mg: 1, armor: 1 };
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
    title: 'WINGS — LEVEL 2',
    part: 'wing',
    lv: 3,
    draw: 'p_wing',
    stage: 1,
    line: tr('הכנפיים שלכם, חזקות יותר: ממריאות מוקדם, מטפסות כמו מטוס קרב, טסות מהר יותר — עד גובה המגדלים.', 'Your wings, stronger: they lift off sooner, climb like a fighter, cruise faster — up to the towers.'),
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

// (a ray to the alley's wall goes past what stands in the alley)
const SEE_THROUGH = new Set(['pole', 'prop', 'tree', 'cover', 'car', 'board', 'fence', 'rail', 'furniture']);

const SHEEN_FAR = 25;
const NEAR = 10;
const REACH = 3.2;
// the lines: a pencil's on the wall, dark (the look pales what is light - a light line on a sunlit wall is lost); their
// light: deep gold ink, the colour of all that can be taken
const CHALK = [0.14, 0.11, 0.1];
const GOLD = [0.9, 0.56, 0.12];
const GOLD_HOT = [1.0, 0.74, 0.26];
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
      const W = live.w || 2.6;
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
      const s = { f, live, W, H, strokes, total, seed: 4100 + FINDS.indexOf(f) * 97, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 1 };
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
    // (lifted a hair off it, so the lines are not in the wall)
    const ox = L.x + nx * 0.03;
    const oy = L.y + ny * 0.03;
    const oz = L.z + nz * 0.03;
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
      if ((kind === 'bp' ? f.bp : f.part) !== id) continue;
      if (kind === 'part' && f.lv) continue;
      if (!this.has(f.id)) return f;
    }
    return null;
  }

  bpOpen(id) {
    if (!BLUEPRINTS[id]) return false;
    if (START_BP.has(id)) return true;
    return !this.lockedBy('bp', id);
  }

  partOpen(id) {
    if (id in START_PARTS) return true;
    return !this.lockedBy('part', id);
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
    return FINDS.find((f) => f.bp === id || (f.part === id && !f.lv)) || null;
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
    if (!this.on) return;
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
      const out = fade ? 1 - clamp(fade.t / 1.4, 0, 1) : 1;
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
          // the pencil's line itself
          const w0 = 3.4 + lit * 1.6;
          const col = lit > 0 ? mix(CHALK, GOLD, lit * 0.85) : CHALK;
          const alpha = (0.62 + lit * 0.38) * out;
          // the sheen passing: a band of hot gold a metre and a half long
          const dr = Math.abs(mid - run);
          if (sheen > 0 && dr < 0.75) {
            const k2 = (1 - dr / 0.75) * sheen;
            fr.lineXYZ(a[0], a[1], a[2], b[0], b[1], b[2], GOLD_HOT, w0 + 2.2 * k2, s.seed + k * 31 + i, Math.min(1, alpha + 0.4 * k2) * out, 0.003, 0);
          } else fr.lineXYZ(a[0], a[1], a[2], b[0], b[1], b[2], col, w0, s.seed + k * 31 + i, alpha, 0.003, 0);
          // (near: a soft halo round the lines - a glow, not sparks)
          if (lit > 0.2) fr.lineXYZ(a[0], a[1], a[2], b[0], b[1], b[2], GOLD_HOT, 12 + 8 * near, s.seed + 500 + k * 31 + i, (0.1 + 0.12 * lit + 0.08 * night) * out, 0.004, 0);
          // (the stroke gone over now: the pencil's line drawn fresh, up to where the hand is)
          if (redo >= 0 && st.at[i - 1] < redo) {
            const f2 = Math.min(1, (redo - st.at[i - 1]) / Math.max(1e-3, st.at[i] - st.at[i - 1]));
            const e = [a[0] + (b[0] - a[0]) * f2, a[1] + (b[1] - a[1]) * f2, a[2] + (b[2] - a[2]) * f2];
            fr.lineXYZ(a[0], a[1], a[2], e[0], e[1], e[2], GOLD_HOT, w0 + 2.2, s.seed + 900 + k * 31 + i, out, 0.002, 0);
          }
        }
        base += st.len;
      });
      // (from 10 m: a warm light round it - more at night)
      if (d < NEAR + 4) {
        const k3 = clamp((NEAR + 4 - d) / 6, 0, 1) * out;
        flashLight(s.x + s.nx * 1.1, s.y + s.ny * 1.1 + 0.2, s.z + s.nz * 1.1, 4.6, WARM, (0.7 + 1.1 * night) * k3);
      }
    }
    for (const q of this.fading) q.t += g.realDt || 1 / 60;
    this.fading = this.fading.filter((q) => q.t < 1.4);
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
