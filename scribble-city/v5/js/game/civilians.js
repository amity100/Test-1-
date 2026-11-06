import * as THREE from 'three';
import { Doodle } from './doodle.js';
import { civilianLook, cityLook, FOLK_LIVE } from './looks.js';
import { holeRadius } from './enemies.js';
import { AVES, STREETS, BLOCK_TYPES, groundHeight, blockRect, westRect, PIER, NORTH_EDGE, SOUTH_EDGE } from '../world/layout.js';
import { NODES, CYCLE } from '../world/roads.js';
import { M_BLOCKS, mBlockRect, M_AVES } from '../world/mainland/plan.js';
import { newDog, steerDog, dogCollar, drawDog } from './dogs.js';
import { damp, dampAngle, clamp } from '../core/util.js';
import { WORK_CLOTHES, NIGHT_CLOTHES } from './rhythm.js';
import { downStep, drawStars, CIV_KO } from './fists.js';
import { shared } from '../render/materials.js';
import { waitBeat, stopWait } from './waiting.js';

const REMOVE_AT = { head: 0.45, armL: 0.45, armR: 0.45, legL: 0.42, legR: 0.42, torso: 0.36 };
// what somebody punched in the street says (ROADMAP 5.4)
const STRUCK_LINES = ['Ow!', 'Hey!!', 'What was that for?!', 'Help!', 'Are you crazy?!', 'Ouch!'];
// (ROADMAP 5.5) thrown and fallen: how long they lie before getting up, and the getting up
const LIE = 0.9;
const RISE = 0.85;
// the umbrellas of the city (sRGB): red, navy, yellow, black, green, plum, pink
const UMBRELLAS = [[0.82, 0.22, 0.24], [0.2, 0.3, 0.6], [0.95, 0.75, 0.2], [0.15, 0.15, 0.18], [0.3, 0.6, 0.45], [0.55, 0.3, 0.6], [0.92, 0.45, 0.6]];
const _ro = new THREE.Vector3();
const _rd = new THREE.Vector3();
// (ROADMAP 11.47: who is in the picture - draw)
const _pv = new THREE.Matrix4();
const _fr = new THREE.Frustum();
const _sp = new THREE.Sphere();

// The walk round a block: the middle of the sidewalks around it (col -1: the houses west of Coral
// Ave, walked up and down along the avenue). Corners: NW, NE, SE, SW.
export function sidewalkLoop(col, row) {
  // (v5, ROADMAP 11.17: a block of the mainland is col, row + 100: its sidewalks are as wide as
  // the island's, the bayfront's a metre wider)
  if (col >= 100) {
    const R = mBlockRect(col - 100, row - 100);
    const x1 = col === 100 ? R.x1 + 3 : R.x1 + 2.5;
    return [[R.x0 - 2.5, R.z0 - 2.5], [x1, R.z0 - 2.5], [x1, R.z1 + 2.5], [R.x0 - 2.5, R.z1 + 2.5]];
  }
  if (col < 0) {
    const R = westRect(row);
    const x = R.x1 + 2.5;
    return [[x, R.z0 - 2.5], [x, R.z1 + 2.5]];
  }
  const R = blockRect(col, row);
  // (v5: on Ocean Drive the walk is between the terraces and the cafés' umbrellas)
  const x1 = col === 2 ? R.x1 + 5.4 : R.x1 + 2.5;
  return [[R.x0 - 2.5, R.z0 - 2.5], [x1, R.z0 - 2.5], [x1, R.z1 + 2.5], [R.x0 - 2.5, R.z1 + 2.5]];
}

// (v5, ROADMAP 11.17) the mainland's blocks by col, row (+ 100), and what kind of street each is
// for who walks there (game/crowds.js lookFor)
const M_AT = new Map(M_BLOCKS.map((b) => [`${b.col + 100},${b.row + 100}`, b]));
export function mainBlock(col, row) {
  return M_AT.get(`${col},${row}`) || null;
}
const M_TYPE = {
  towers: 'towers', offices: 'towers', condos: 'hotels', galleria: 'towers', galleriaW: 'towers', galleriaE: 'towers', lanes: 'towers', dining: 'hotels', arena: 'plaza', plaza: 'plaza', park: 'park', domino: 'park',
  warehouses: 'gang', lofts: 'shops', walls: 'gang', clubs: 'shops', calle: 'market', bungalows: 'west', apartments: 'west', villas: 'west', mansions: 'west',
  houses: 'west', school: 'west', boulevard: 'shops', theatres: 'shops', starlight: 'shops', velvet: 'hotels', stripmall: 'shops', boardwalk: 'shops', mixed: 'shops',
};
export function blockType(col, row) {
  if (col >= 100) {
    const b = mainBlock(col, row);
    return b ? M_TYPE[b.kind] || 'shops' : 'shops';
  }
  return col < 0 ? 'west' : BLOCK_TYPES[row][col];
}
// the walks near p: [[col, row], ...] within d (the island's and the mainland's built near you)
export function walksNear(p, d, built = null) {
  const out = [];
  const near = (L) => {
    let best = Infinity;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      const b = L[(i + 1) % L.length];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
      best = Math.min(best, Math.hypot(a[0] + dx * t - p.x, a[1] + dz * t - p.z));
    }
    return best;
  };
  if (p.x > -300) {
    for (let col = -1; col < 3; col++) {
      for (let row = 0; row < 5; row++) {
        const dd = near(sidewalkLoop(col, row));
        if (dd < d) out.push([col, row, dd]);
      }
    }
  }
  if (p.x < -560) {
    for (const b of M_BLOCKS) {
      if (Math.abs(b.cx - p.x) > d + 80 || Math.abs(b.cz - p.z) > d + 80) continue;
      if (built && !built.has(b.id)) continue;
      const dd = near(sidewalkLoop(b.col + 100, b.row + 100));
      if (dd < d) out.push([b.col + 100, b.row + 100, dd]);
    }
  }
  return out;
}

// (v5) the sidewalk on the park's side, the beach walk, the edge of the water: up and down
const PROM_LINES = [15.2, 17.6, 32.2, 34.0, 15.2, 101.5, 103.5];

// (v5, ROADMAP 11.18) how likely somebody walking past stops at a shop's window, by what it sells
const WINDOW_KEEN = { fashion: 0.6, boutique: 0.6, surf: 0.5, shoes: 0.55, jewelry: 0.6, electronics: 0.5, phones: 0.5, toys: 0.45, perfume: 0.45, books: 0.4, optics: 0.35, sports: 0.45, flowers: 0.45, bakery: 0.45, icecream: 0.4, music: 0.4, gallery: 0.5 };
const WINDOW_SAYS = ['Ooh, look at that!', 'I need those.', 'Too expensive...', 'That would look great on you.', 'Next payday.', 'Should we go in?', 'Cute!', 'Not my style.'];
// (GTA IV pass) lunch carried back to the desk; the paper bags of the city's stores
const LUNCH = ['burger', 'hotdog', 'noodleBox', 'soda', 'noodleBox', 'burger'];
const BAG_COLORS = [[0.95, 0.45, 0.6], [0.98, 0.97, 0.94], [0.2, 0.22, 0.26], [0.62, 0.78, 0.92], [0.86, 0.66, 0.26], [0.55, 0.38, 0.24], [0.4, 0.68, 0.5], [0.72, 0.2, 0.24]];

const _steer = { x: 0, z: 0, k: 1 };
// (intelligence round) where a walker goes this frame instead, round something in the way
// (Civilian.avoid); the shoulders' feelers, either side of the middle one
const _av = { x: 0, z: 0 };
const FEELERS = [0, 0.26, -0.26];
// the ways tried round it, a little to one side first, then further, then nearly across
const AV_ANGLES = [0.5, 1.0, 1.5];
// (critic round) a hand on the wall (Civilian.avoid): the turns tried from the way they are going,
// round towards the wall first (round its corner), then along it, then away from it
const WF_TURNS = [Math.PI / 2, Math.PI / 4, 0, -Math.PI / 4, -Math.PI / 2, (-3 * Math.PI) / 4];
// a way out when stuck: twelve directions
// (intelligence round) a ray from (ox, oz) along (vx, vz) against a car's box (its length and width, and
// pad more all round): how far along it meets it, Infinity if it does not within maxT
function rayCar(ox, oz, vx, vz, maxT, v, pad) {
  const fx = Math.sin(v.yaw);
  const fz = Math.cos(v.yaw);
  const rx = ox - v.pos.x;
  const rz = oz - v.pos.z;
  const p0 = [rx * fx + rz * fz, rx * fz - rz * fx];
  const d0 = [vx * fx + vz * fz, vx * fz - vz * fx];
  const h0 = [v.halfLen + pad, v.halfWid + pad];
  let t0 = 0;
  let t1 = maxT;
  for (let k = 0; k < 2; k++) {
    const p = p0[k];
    const d = d0[k];
    const h = h0[k];
    if (Math.abs(d) < 1e-6) {
      if (p > h || p < -h) return Infinity;
      continue;
    }
    let ta = (-h - p) / d;
    let tb = (h - p) / d;
    if (ta > tb) {
      const q = ta;
      ta = tb;
      tb = q;
    }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return Infinity;
  }
  return t0;
}
const OUT_DIRS = Array.from({ length: 12 }, (_, i) => [Math.sin((i / 12) * Math.PI * 2), Math.cos((i / 12) * Math.PI * 2)]);

// (critic round) The crossings from corner k of block (col, row) - [col, row, corner] of each block
// across the street or the avenue (the mainland's: only those built). Corners: 0 NW, 1 NE, 2 SE, 3 SW;
// the mainland's columns run west
function crossesFrom(game, col, row, k) {
  const north = k < 2;
  const west = k === 0 || k === 3;
  const opts = [];
  if (col >= 100) {
    const live = game.world.mainland && game.world.mainland.blocks;
    const ok = (c, r) => {
      const b = mainBlock(c, r);
      return b && (!live || live.has(b.id));
    };
    if (north && ok(col, row - 1)) opts.push([col, row - 1, west ? 3 : 2]);
    if (!north && ok(col, row + 1)) opts.push([col, row + 1, west ? 0 : 1]);
    if (west && ok(col + 1, row)) opts.push([col + 1, row, north ? 1 : 2]);
    if (!west && ok(col - 1, row)) opts.push([col - 1, row, north ? 0 : 3]);
  } else {
    if (north && row > 0) opts.push([col, row - 1, west ? 3 : 2]);
    if (!north && row < 4) opts.push([col, row + 1, west ? 0 : 1]);
    if (west && col > 0) opts.push([col - 1, row, north ? 1 : 2]);
    if (west && col === 0) opts.push([-1, row, north ? 0 : 1]);
    if (!west && col < 2) opts.push([col + 1, row, north ? 0 : 3]);
  }
  return opts;
}
// (a corner of a block as one number, for the walking distances: routeField)
const cornerKey = (col, row, k) => ((col + 8) * 512 + (row + 8)) * 4 + k;
// (what a crossing costs on top of its width: the wait at the light, as metres of sidewalk)
const CROSS_WAIT = 8;
// where p is along a block's walk, from its corner 0 the way of its corners (m), how far off the walk
// it is, and the walk's whole length
function arcOf(L, x, z) {
  let s = 0;
  let best = Infinity;
  let at = 0;
  for (let i = 0; i < L.length; i++) {
    const a = L[i];
    const b = L[(i + 1) % L.length];
    const vx = b[0] - a[0];
    const vz = b[1] - a[1];
    const len = Math.hypot(vx, vz) || 1;
    const t = Math.max(0, Math.min(len, ((x - a[0]) * vx + (z - a[1]) * vz) / len));
    const d = Math.hypot(a[0] + (vx / len) * t - x, a[1] + (vz / len) * t - z);
    if (d < best) {
      best = d;
      at = s + t;
    }
    s += len;
  }
  return { s: at, off: best, per: s };
}
// the way along the walk from corner k to its corner j going dir (+1: the way of the corners)
function arcFrom(L, k, dir) {
  const n = L.length;
  const j = (k + dir + n) % n;
  return Math.hypot(L[j][0] - L[k][0], L[j][1] - L[k][1]);
}

// beyond this far from the camera a walker steps every other frame (see Civilians.update)
const FAR_STEP = 40;
// (on a phone: every other frame from this near, every third from FAR_THIRD_LOW)
const FAR_STEP_LOW = 25;
const FAR_THIRD_LOW = 55;

// (GTA IV pass) What the hands do while a line is said. Everybody who says something (every
// bubble of the city comes by Civilians.spoke) says it with their hands too - explaining with both,
// beating out the words with one, palms open at a question, a shrug, a point, a wave hello or
// goodbye, holding the belly laughing, clapping, a fist shaken after somebody who ran into them -
// and the ones they are talking with turn their heads to whoever is speaking. Only near the camera
// (past GESTURE_D nobody could tell): a few people at a time, a handful of sines each.
const GESTURE_D = 38;
// things held in both hands (or in the way of the right one): no hands free to talk with
const HANDS_FULL = new Set(['pizzaBox', 'laundry', 'book', 'newspaper', 'dough', 'guitar', 'broom', 'dumbbell', 'box', 'tray']);
const RIGHT_BUSY = new Set(['umbrella', 'cane', 'leash', 'shopBag', 'bag', 'basket']);
// (the right hand free for something - a gesture, a coin dropped in a case: nothing held in both
// hands, nothing hanging from it)
export function rightFree(fig) {
  return !HANDS_FULL.has(fig.carry) && !RIGHT_BUSY.has(fig.carry);
}
// (whole words: "Have a nice day!", "Half off!", "Hands up!" are no laugh, "History..." no hello)
const GREET_RE = /^(hi|hey|hello|bye|good ?bye|see you|see ya|later|morning|good morning|evening|good evening|night|yo|take care|ciao|welcome)\b/i;
const LAUGH_RE = /^(ha|he)(\s?h?[ae])*h?\b/i;
const POINT_RE = /(that way|over there|look at|right there|just there|this way|over here)/i;
// where the hand is for a gesture (body space: x right, y up, z forward), side 1 the right, -1
// the left; t seconds into it, ph the person's own phase (no two people move alike). false: that
// hand is not in it
export function gestureAt(kind, side, t, ph, out) {
  switch (kind) {
    case 'explain':
      out.set(side * (0.17 + 0.05 * Math.sin(3.1 * t + ph + side)), 1.02 + 0.08 * Math.sin(2.3 * t + ph * 1.7 + (side > 0 ? 0 : 1.4)), 0.3 + 0.06 * Math.cos(3.1 * t + ph));
      return true;
    case 'beat': {
      if (side < 0) return false;
      const k = Math.max(0, Math.sin(6.2 * t + ph));
      out.set(0.14, 1.06 + 0.11 * k * k, 0.34);
      return true;
    }
    case 'open': {
      const k = Math.min(1, t * 3);
      out.set(side * (0.18 + 0.16 * k), 0.98 + 0.04 * Math.sin(2 * t + ph), 0.26);
      return true;
    }
    case 'shrug': {
      if (t > 1.1) return false;
      const k = Math.sin(Math.min(1, t / 1.1) * Math.PI);
      out.set(side * (0.2 + 0.14 * k), 0.95 + 0.15 * k, 0.2);
      return true;
    }
    case 'point':
      if (side < 0) return false;
      out.set(0.3, 1.36, 0.5);
      return true;
    case 'wave':
      if (side < 0) return false;
      out.set(0.27 + 0.09 * Math.sin(9 * t + ph), 1.78, 0.1);
      return true;
    case 'laugh':
      out.set(side * 0.11, 0.98 + 0.03 * Math.sin(14 * t + ph), 0.2);
      return true;
    case 'clap':
      out.set(side * (0.015 + 0.06 * Math.abs(Math.sin(10 * t + ph))), 1.2, 0.32);
      return true;
    case 'fist':
      if (side < 0) return false;
      out.set(0.24, 1.6 + 0.05 * Math.sin(16 * t), 0.3);
      return true;
    case 'chin':
      if (side < 0) return false;
      out.set(0.05, 1.5, 0.15);
      return true;
    case 'toss': {
      // (a handful of crumbs thrown out to the pigeons)
      if (side < 0) return false;
      const k = Math.min(1, t / 0.45);
      out.set(0.18, 1.0 + 0.14 * k, 0.28 + 0.36 * k);
      return true;
    }
    case 'rest':
      // (both hands to the small of the back: a breather)
      out.set(side * 0.2, 0.96, -0.1);
      return true;
    case 'hip':
      // (a hand on the hip, the other one talking)
      if (side < 0) out.set(-0.24, 0.98, -0.02);
      else out.set(0.15 + 0.04 * Math.sin(3 * t + ph), 1.05 + 0.07 * Math.sin(2.6 * t + ph), 0.32);
      return true;
    default:
      return false;
  }
}

// a gesture for a line, from how it is said
export function gestureFor(text, tone) {
  if (tone === 'alarm') return /!$/.test(text) ? 'fist' : 'open';
  if (LAUGH_RE.test(text)) return 'laugh';
  if (GREET_RE.test(text)) return 'wave';
  if (POINT_RE.test(text)) return 'point';
  const r = Math.random();
  if (/\?$/.test(text)) return r < 0.4 ? 'open' : r < 0.6 ? 'shrug' : r < 0.85 ? 'explain' : 'hip';
  if (/!$/.test(text)) return r < 0.45 ? 'beat' : r < 0.8 ? 'explain' : 'point';
  if (/^\.\.\.|^hmm|^well/i.test(text)) return 'chin';
  return r < 0.45 ? 'explain' : r < 0.65 ? 'beat' : r < 0.8 ? 'open' : r < 0.9 ? 'hip' : 'chin';
}
/**
 * Pedestrians walking the sidewalks round their block (now and then crossing to the next one at
 * the zebra), or strolling on the promenade. They panic and run when shooting starts.
 */
class Civilian {
  constructor(mgr, bx, bz, look = null, figOpts = null) {
    this.mgr = mgr;
    this.game = mgr.game;
    this.fig = new Doodle(mgr.game.figures, look || cityLook(), { seed: Math.random() * 100, scale: look ? 1 : 0.93 + Math.random() * 0.1, ...(figOpts || {}) });
    // scripted people (shopkeepers, the little scenes on the street) are driven by ctrl(civ, dt),
    // which returns where to walk ({ x, z, speed }) or null to stand; they still panic and bleed ink
    this.ctrl = null;
    this.scripted = false;
    this.faceYaw = null;
    this.hopY = 0;
    this.inside = false; // gone into a shop for a moment
    this.pos = this.fig.pos;
    this.radius = 0.33;
    this.dying = -1;
    this.headlessT = 0;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    if (bx === 'prom') this.setProm(bz);
    else if (bx === 'line') this.setLine(bz);
    else this.setBlock(bx, bz, true);
    this.speed = 1.2 + Math.random() * 0.5;
    // (quicker in the rain: game/weather.js, Civilians.rainCheck)
    this.rush = 1;
    this.panicT = 0;
    this.yaw = 0;
    this.vel = new THREE.Vector3();
    this.stopT = 0;
    this.dodgeV = new THREE.Vector3();
    // (intelligence round) the step aside added this frame - taken off again before the next, so it
    // is never summed into the walk itself (Civilian.update)
    this.dodgeApplied = new THREE.Vector3();
    // the way round something in the way (avoid): which way, for how long, the side taken last; and
    // whether they are getting anywhere (stuck)
    this.avX = 0;
    this.avZ = 0;
    this.avT = 0;
    this.avSide = 0;
    this.avClock = Math.random() * 0.2;
    this.progT = 0;
    this.progWant = 0;
    this.progGot = 0;
    this.stuckN = 0;
    // time not yet walked (far away they step every other frame)
    this.owed = 0;
    // a fist fight (ROADMAP 5.4, game/fists.js): how dazed, reeling from a blow, on the ground (out
    // cold: ko), getting up
    this.daze = 0;
    this.reelT = 0;
    this.downT = 0;
    this.upT = 0;
    this.ko = false;
    // thrown by a car or a blast (ROADMAP 5.5, game/ragdoll.js): lying still this long; killed by
    // it (fades later)
    this.lieT = 0;
    this.ragKill = false;
    // (GTA IV pass) a line being said and the hands that go with it (gestureAt); the one they are
    // listening to; a look at you going by (game/voices.js toYou); the place at the curb while the
    // cars have the green (Civilians.curbSlot)
    this.talkUntil = 0;
    this.gest = null;
    this.gestT = 0;
    this._gR = null;
    this._gL = null;
    this._gRw = null;
    this._gLw = null;
    this.listenTo = null;
    this.listenUntil = 0;
    this.glanceAt = null;
    this.glanceUntil = 0;
    this.faceYouUntil = 0;
    this._look = null;
    this.waitAt = null;
  }

  // walk round block (col, row); fresh: start somewhere along it
  setBlock(col, row, fresh) {
    this.col = col;
    this.row = row;
    this.prom = false;
    this.loop = sidewalkLoop(col, row);
    const n = this.loop.length;
    if (fresh) {
      this.leg = Math.floor(Math.random() * n);
      const a = this.loop[this.leg];
      const b = this.loop[(this.leg + 1) % n];
      const t = Math.random();
      this.pos.set(a[0] + (b[0] - a[0]) * t + (Math.random() - 0.5) * 1.2, groundHeight(a[0], a[1]), a[1] + (b[1] - a[1]) * t + (Math.random() - 0.5) * 1.2);
      this.target = this.dir > 0 ? (this.leg + 1) % n : this.leg;
    }
  }

  // somewhere along the walk between minD and maxD from p (false if the walk never comes that close)
  placeNear(p, minD, maxD) {
    const L = this.loop;
    const n = L.length;
    for (let tries = 0; tries < 12; tries++) {
      const leg = Math.floor(Math.random() * n);
      const a = L[leg];
      const b = L[(leg + 1) % n];
      const t = Math.random();
      const x = a[0] + (b[0] - a[0]) * t + (Math.random() - 0.5) * 1.2;
      const z = a[1] + (b[1] - a[1]) * t + (Math.random() - 0.5) * 1.2;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < minD || d > maxD) continue;
      this.pos.set(x, groundHeight(x, z), z);
      if (!this.prom) this.target = this.dir > 0 ? (leg + 1) % n : leg;
      else this.target = this.dir > 0 ? 1 : 0;
      return true;
    }
    return false;
  }

  setProm(z) {
    this.prom = true;
    const x = PROM_LINES[Math.floor(Math.random() * PROM_LINES.length)];
    const za = Math.max(NORTH_EDGE + 4, z - 60 - Math.random() * 80);
    const zb = Math.min(SOUTH_EDGE + 20, z + 60 + Math.random() * 80);
    this.loop = [[x, za], [x, zb]];
    this.pos.set(x + (Math.random() - 0.5) * 1.5, groundHeight(x, z), z);
    this.target = this.dir > 0 ? 1 : 0;
  }

  // (v5, ROADMAP 11.17) up and down one of the mainland's strolls (the pier, the beach, the
  // promenades: world.walks { a, b })
  setLine(w) {
    this.prom = true;
    this.line = w;
    this.loop = [w.a, w.b];
    const t = Math.random();
    const x = w.a[0] + (w.b[0] - w.a[0]) * t;
    const z = w.a[1] + (w.b[1] - w.a[1]) * t;
    this.pos.set(x + (Math.random() - 0.5) * 1.2, groundHeight(x, z), z + (Math.random() - 0.5) * 1.2);
    this.target = this.dir > 0 ? 1 : 0;
  }

  // at a corner of the block: on round it, or across the road to the next block
  // (intelligence round) the crossings from the corner they are at: [col, row, corner] of each block
  // across the street or the avenue (the mainland's: only those built)
  crossOpts() {
    return crossesFrom(this.game, this.col, this.row, this.target);
  }

  // (intelligence round) Somewhere to get to (game/days.js: their goal): at each corner the way that
  // brings them nearest it - on round this block, back the other way, or across to the next block -
  // and never straight back over the street they just crossed. Their own block's sidewalk passing
  // the place: round it the short way, no crossing. Returns false to walk on as anybody does
  // (critic round: nearest by the way they would walk it - Civilians.routeField - not by the corner
  // nearest it as the crow flies. That had them to and fro between two corners for ever, the door
  // they were going to a few metres round the bend from one of them and never in reach; and the
  // street they had crossed for lunch was never crossed back to the office)
  routeTo(g) {
    const L = this.loop;
    const n = L.length;
    const k = this.target;
    const fwd = (k + this.dir + n) % n;
    const back = (k - this.dir + n) % n;
    const F = n === 4 && !this.prom && this.col >= 0 ? this.mgr.routeField(g) : null;
    if (F) {
      let kind = null;
      let o = null;
      if (F.col === this.col && F.row === this.row) {
        // (on this block's walk: round it the shorter way)
        const sk = arcOf(L, L[k][0], L[k][1]).s;
        const ahead = this.dir > 0 ? (F.s - sk + F.per) % F.per : (sk - F.s + F.per) % F.per;
        kind = F.per - ahead + 1 < ahead ? 'back' : 'fwd';
      } else {
        let best = Infinity;
        const dF = F.dist.get(cornerKey(this.col, this.row, fwd));
        const dB = F.dist.get(cornerKey(this.col, this.row, back));
        if (dF !== undefined) {
          best = dF + arcFrom(L, k, this.dir);
          kind = 'fwd';
        }
        if (dB !== undefined && dB + arcFrom(L, k, -this.dir) < best) {
          best = dB + arcFrom(L, k, -this.dir);
          kind = 'back';
        }
        for (const q of crossesFrom(this.game, this.col, this.row, k)) {
          const dq = F.dist.get(cornerKey(q[0], q[1], q[2]));
          if (dq === undefined) continue;
          const p = sidewalkLoop(q[0], q[1])[q[2]];
          const d = dq + Math.hypot(p[0] - L[k][0], p[1] - L[k][1]) + CROSS_WAIT;
          if (d < best) {
            best = d;
            kind = 'cross';
            o = q;
          }
        }
      }
      if (kind === 'cross') {
        this.lastBlock = [this.col, this.row];
        this.setBlock(o[0], o[1], false);
        this.target = o[2];
        this.crossing = true;
        return true;
      }
      if (kind) {
        this.crossing = false;
        if (kind === 'back') {
          this.dir = -this.dir;
          this.target = back;
        } else this.target = fwd;
        return true;
      }
    }
    // (the place on this block's walk: no crossing)
    let onWalk = false;
    for (let i = 0; i < n && !onWalk; i++) {
      const a = L[i];
      const b = L[(i + 1) % n];
      const vx = b[0] - a[0];
      const vz = b[1] - a[1];
      const l2 = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((g.x - a[0]) * vx + (g.z - a[1]) * vz) / l2));
      if (Math.hypot(a[0] + vx * t - g.x, a[1] + vz * t - g.z) < 4.5) onWalk = true;
    }
    const D = (p) => Math.hypot(p[0] - g.x, p[1] - g.z);
    let best = { d: D(L[fwd]), kind: 'fwd' };
    const db = D(L[back]) + 2;
    if (db < best.d) best = { d: db, kind: 'back' };
    if (!onWalk) {
      for (const o of this.crossOpts()) {
        const loop = sidewalkLoop(o[0], o[1]);
        const p = loop[o[2]];
        if (!p) continue;
        // (a crossing costs a wait at the light; straight back over the same street, a lot)
        let d = D(p) + 3;
        if (this.lastBlock && this.lastBlock[0] === o[0] && this.lastBlock[1] === o[1]) d += 25;
        if (d < best.d) best = { d, kind: 'cross', o };
      }
    }
    if (best.kind === 'cross') {
      this.lastBlock = [this.col, this.row];
      this.setBlock(best.o[0], best.o[1], false);
      this.target = best.o[2];
      this.crossing = true;
      return true;
    }
    this.crossing = false;
    if (best.kind === 'back') {
      this.dir = -this.dir;
      this.target = back;
    } else this.target = fwd;
    return true;
  }

  // (critic round) Somewhere new to go (game/days.js, a friend waiting: game/streetsocial.js date):
  // turned the right way at once - not on to the far corner first, away from it, and back the long way
  // round. Mid-block, the shorter of the two ways (Civilians.routeField)
  headFor(g) {
    const L = this.loop;
    if (!g || this.prom || this.crossing || this.via || this.ctrl || !L || L.length !== 4 || this.col < 0) return;
    const F = this.mgr.routeField(g);
    if (!F) return;
    const n = 4;
    const k = this.target;
    const prev = (k - this.dir + n) % n;
    let turn;
    if (F.col === this.col && F.row === this.row) {
      const s = arcOf(L, this.pos.x, this.pos.z).s;
      const ahead = this.dir > 0 ? (F.s - s + F.per) % F.per : (s - F.s + F.per) % F.per;
      turn = F.per - ahead + 2 < ahead;
    } else {
      const dk = F.dist.get(cornerKey(this.col, this.row, k));
      const dp = F.dist.get(cornerKey(this.col, this.row, prev));
      if (dk === undefined || dp === undefined) return;
      turn = dp + Math.hypot(L[prev][0] - this.pos.x, L[prev][1] - this.pos.z) + 2 < dk + Math.hypot(L[k][0] - this.pos.x, L[k][1] - this.pos.z);
    }
    if (turn) {
      this.dir = -this.dir;
      this.target = prev;
      this.crossOK = false;
      this.crossNode = undefined;
      this.mgr.stats.turned = (this.mgr.stats.turned || 0) + 1;
    }
  }

  nextCorner() {
    const n = this.loop.length;
    if (this.prom || n === 2) {
      this.target = this.target ? 0 : 1;
      return;
    }
    if (this.goal && this.routeTo(this.goal)) return;
    const k = this.target;
    if (Math.random() < 0.28 && this.col >= 100) {
      // (v5, ROADMAP 11.17: the mainland's blocks: their columns run west, and a block is there to
      // cross to only when it is built)
      const north = k < 2;
      const west = k === 0 || k === 3;
      const opts = [];
      const live = this.game.world.mainland && this.game.world.mainland.blocks;
      const ok = (c, r) => {
        const b = mainBlock(c, r);
        return b && (!live || live.has(b.id));
      };
      if (north && ok(this.col, this.row - 1)) opts.push([this.col, this.row - 1, west ? 3 : 2]);
      if (!north && ok(this.col, this.row + 1)) opts.push([this.col, this.row + 1, west ? 0 : 1]);
      if (west && ok(this.col + 1, this.row)) opts.push([this.col + 1, this.row, north ? 1 : 2]);
      if (!west && ok(this.col - 1, this.row)) opts.push([this.col - 1, this.row, north ? 0 : 3]);
      if (opts.length) {
        const [c, r, corner] = opts[Math.floor(Math.random() * opts.length)];
        this.setBlock(c, r, false);
        this.target = corner;
        this.crossing = true;
        return;
      }
    } else if (Math.random() < 0.28 && this.col < 100) {
      // the corners: 0 NW, 1 NE, 2 SE, 3 SW; across the street (north/south) or the avenue
      const north = k < 2;
      const west = k === 0 || k === 3;
      const opts = [];
      if (north && this.row > 0) opts.push([this.col, this.row - 1, west ? 3 : 2]);
      if (!north && this.row < 4) opts.push([this.col, this.row + 1, west ? 0 : 1]);
      if (west && this.col > 0) opts.push([this.col - 1, this.row, north ? 1 : 2]);
      if (west && this.col === 0) opts.push([-1, this.row, north ? 0 : 1]);
      if (!west && this.col < 2) opts.push([this.col + 1, this.row, north ? 0 : 3]);
      if (opts.length) {
        const [c, r, corner] = opts[Math.floor(Math.random() * opts.length)];
        this.setBlock(c, r, false);
        this.target = corner;
        this.crossing = true;
        return;
      }
    }
    this.crossing = false;
    this.target = (this.target + this.dir + n) % n;
  }

  get alive() {
    return this.dying < 0;
  }

  get headless() {
    return this.fig.parts.head < 0.5;
  }

  // (intelligence round) Round what stands in the way - a hydrant, a bin, a bench, a planter, the
  // works' fence, the corner of a wall - never into it, never walking on the spot against it. Five
  // times a second a feeler at knee height a step or two ahead, as wide as they are (the middle and
  // either shoulder); something there, the way bent to whichever side is free - the side taken last
  // time first, then the other (no dithering), a little first, then more - and held for a moment.
  // Not at the very end of the way: the bench they are going to sit on, the door they go into.
  // Returns where to go instead, or null
  avoid(tx, tz, speed, dt) {
    // (somebody a scene moves - at work, on a stage - is where the scene puts them)
    if (speed < 0.15 || this.noCollide || this.riding || this.scripted) {
      this.avT = 0;
      return null;
    }
    const px = this.pos.x;
    const pz = this.pos.z;
    const dx = tx - px;
    const dz = tz - pz;
    const L = Math.hypot(dx, dz);
    if (L < 0.45) {
      this.avT = 0;
      return null;
    }
    const ux = dx / L;
    const uz = dz / L;
    // (critic round) out of a pocket along its wall, a hand on it (progress): round the end of the
    // hedge, the planter, the parked van - until the way straight on is open and they are nearer
    // where they are going than where they met it
    if (this.wf) {
      const W = this.wf;
      W.t -= dt;
      W.clock -= dt;
      const T = this.loop && this.loop[this.target];
      const gx = this.via ? this.via.x : T ? T[0] : tx;
      const gz = this.via ? this.via.z : T ? T[1] : tz;
      const gd = Math.hypot(gx - px, gz - pz) || 1;
      if (W.t <= 0 || W.target !== this.target || this.ctrl) this.wf = null;
      else if (W.clock <= 0) {
        W.clock = 0.2;
        if (gd < W.d0 - 0.5 && !this.blocked((gx - px) / gd, (gz - pz) / gd, Math.min(Math.max(gd - 0.4, 0.3), 2.5))) this.wf = null;
        else {
          let found = false;
          for (let i = 0; i < WF_TURNS.length && !found; i++) {
            const a = WF_TURNS[i] * W.side;
            const c = Math.cos(a);
            const s = Math.sin(a);
            const vx = W.hx * c - W.hz * s;
            const vz = W.hx * s + W.hz * c;
            if (!this.blocked(vx, vz, 0.9)) {
              W.hx = vx;
              W.hz = vz;
              found = true;
            }
          }
          if (!found) {
            W.hx = -W.hx;
            W.hz = -W.hz;
          }
        }
      }
      if (this.wf) {
        this.avT = 0;
        _av.x = px + W.hx * 2;
        _av.z = pz + W.hz * 2;
        return _av;
      }
    }
    this.avClock -= dt;
    if (this.avClock <= 0) {
      this.avClock = 0.2;
      const reach = Math.min(L - 0.4, 0.8 + speed * 0.5);
      if (reach > 0.2) {
        if (this.blocked(ux, uz, reach)) {
          const first = this.avSide || (Math.random() < 0.5 ? 1 : -1);
          let found = false;
          for (let a = 0; a < AV_ANGLES.length && !found; a++) {
            for (let q = 0; q < 2 && !found; q++) {
              const s = q ? -first : first;
              const c = Math.cos(AV_ANGLES[a] * s);
              const n = Math.sin(AV_ANGLES[a] * s);
              const vx = ux * c - uz * n;
              const vz = ux * n + uz * c;
              if (!this.blocked(vx, vz, reach)) {
                if (!(this.avT > 0)) this.mgr.stats.avoided++;
                this.avX = vx;
                this.avZ = vz;
                this.avSide = s;
                this.avT = 0.55;
                found = true;
              }
            }
          }
          if (!found) this.avT = 0;
        } else if (this.avT > 0.2) this.avT = 0.2;
      }
    }
    if (this.avT > 0) {
      this.avT -= dt;
      const k = Math.min(L, 2);
      _av.x = px + this.avX * k;
      _av.z = pz + this.avZ * k;
      return _av;
    }
    if (this.avT <= -3) this.avSide = 0;
    else this.avT -= dt;
    return null;
  }

  // something solid at knee height within reach along (vx, vz) - from the middle or a shoulder: a
  // wall, a pole, a bench; or a car - one stopped across the crossing, one parked up on the curb, yours
  // (Civilians.carsNear: the walls do not know them)
  blocked(vx, vz, reach) {
    const col = this.game.world.collision;
    const y = this.pos.y + 0.45;
    for (let i = 0; i < FEELERS.length; i++) {
      const o = FEELERS[i];
      if (col.raycast(this.pos.x + vz * o, y, this.pos.z - vx * o, vx, 0, vz, reach + 0.33)) return true;
    }
    const cars = this.mgr.cars;
    if (cars && cars.length && !this.riding) {
      const px = this.pos.x;
      const pz = this.pos.z;
      for (let k = 0; k < cars.length; k++) {
        const v = cars[k];
        const R = reach + v.halfLen + 0.8;
        const dx = v.pos.x - px;
        const dz = v.pos.z - pz;
        if (dx > R || dx < -R || dz > R || dz < -R) continue;
        // (up on it - the roof of a car - is not in the way)
        if (this.pos.y > v.pos.y + 1.2) continue;
        for (let i = 0; i < FEELERS.length; i++) {
          const o = FEELERS[i];
          if (rayCar(px + vz * o, pz - vx * o, vx, vz, reach + 0.33, v, 0.05) < Infinity) return true;
        }
      }
    }
    return false;
  }

  // (intelligence round) getting anywhere? Meaning to walk and hardly moving for two seconds -
  // pressed into a corner the feelers missed, hemmed in - a way out: the free direction nearest to
  // where they are going (to the side, back if it must be), taken for a second and a half; a walker
  // of the sidewalk with nowhere at all to go turns round
  progress(ox, oz, speed, far, dt) {
    // (only while on the way somewhere - not on their mark, not sitting down, not across a room)
    if (speed > 0.5 && far > 0.5 && !this.noCollide && !this.scripted && !(this.fig.sit > 0.3)) this.progWant += speed * dt;
    this.progT += dt;
    if (this.progT < 1) return;
    // (how far they really got in the second - from where they were at its start to where they are
    // now: pressed into a car that pushes them back out each step, they walk the whole second and get
    // nowhere, and step by step it looked like walking)
    if (this.progX === undefined) {
      this.progX = this.pos.x;
      this.progZ = this.pos.z;
    }
    this.progGot = Math.hypot(this.pos.x - this.progX, this.pos.z - this.progZ);
    this.progX = this.pos.x;
    this.progZ = this.pos.z;
    const stuck = this.progWant > 0.6 && this.progGot < this.progWant * 0.25;
    this.stuckN = stuck ? this.stuckN + 1 : 0;
    this.progT = 0;
    this.progWant = 0;
    this.progGot = 0;
    if (this.stuckN < 2) return;
    this.stuckN = 0;
    this.mgr.stats.unstuck++;
    // (critic round) hopeless - out of a pocket and back into it again and again (the inside of a
    // garden's fence, its gate far off): where nobody can see it, back on their own sidewalk, as the
    // big games do with somebody stuck out of sight
    const tNow = this.game.time;
    const ups = this.unstuckAt || (this.unstuckAt = []);
    ups.push(tNow);
    while (ups.length && tNow - ups[0] > 45) ups.shift();
    if (ups.length >= 4 && this.warpOut()) return;
    // (critic round) stuck while following a wall already: the other way round it
    if (this.wf) {
      const W = this.wf;
      W.side = -W.side;
      W.hx = -W.hx;
      W.hz = -W.hz;
      W.t = Math.max(W.t, 8);
      return;
    }
    // (critic round) at the curb, waiting for the walk, and the place at its edge out of reach - a
    // pole, a bin: they wait where they are. (That counted as being at the corner across the street:
    // the next corner over there their goal now, not crossing any more, and they set off straight
    // over the road through the cars, the light never looked at)
    if (this.crossing && !this.crossOK) {
      if (this.waitAt) this.waitAt.walkT = 99;
      return;
    }
    // (the corner they are making for has something standing on it - a pole, a hydrant: near enough
    // is there; on round the next one) - (critic round) the corner itself, not wherever the step
    // round somebody, or the squeeze past a group, had them heading for this moment
    const T0 = this.loop && this.loop[this.target];
    if (T0) far = Math.hypot(T0[0] - this.pos.x, T0[1] - this.pos.z);
    if (far < 2 && !this.ctrl && this.loop && !this.via) {
      this.nextCorner();
      this.crossOK = false;
      this.crossNode = undefined;
      this.hurry = false;
      return;
    }
    // (what it was, for the tests: the last few)
    const log = this.mgr.stats.stuckLog || (this.mgr.stats.stuckLog = []);
    log.push({ ctrl: !!this.ctrl, scripted: !!this.scripted, far: +far.toFixed(1), x: +this.pos.x.toFixed(1), z: +this.pos.z.toFixed(1), role: this.role || null, cross: !!this.crossing, buddy: !!(this.buddyOf || this.buddy) });
    if (log.length > 40) log.shift();
    const f = this.fig.forward;
    let best = -1;
    let bs = -Infinity;
    for (let i = 0; i < OUT_DIRS.length; i++) {
      const [vx, vz] = OUT_DIRS[i];
      if (this.blocked(vx, vz, 1.2)) continue;
      // (ahead of them best, then the sides; back last)
      const s = vx * f.x + vz * f.z + Math.random() * 0.3;
      if (s > bs) {
        bs = s;
        best = i;
      }
    }
    // (critic round) stuck again where they were got out of a moment ago - the inside corner of a
    // front yard's hedge, an L of planters: the free way for a second and a half only took them out
    // and back into it, again and again. Now a hand on the wall (avoid), round it to the open
    const now = this.game.time;
    const E = this.escAt;
    const again = E && now - E.t < 12 && Math.hypot(this.pos.x - E.x, this.pos.z - E.z) < 3.5;
    this.escAt = { t: now, x: this.pos.x, z: this.pos.z };
    if (best >= 0 && again && !this.ctrl && this.loop && this.loop[this.target]) {
      const T = this.via ? [this.via.x, this.via.z] : this.loop[this.target];
      const gx = T[0] - this.pos.x;
      const gz = T[1] - this.pos.z;
      const hx = OUT_DIRS[best][0];
      const hz = OUT_DIRS[best][1];
      const cr = hx * gz - hz * gx;
      this.wf = { hx, hz, side: cr > 0 ? 1 : cr < 0 ? -1 : Math.random() < 0.5 ? 1 : -1, t: 20, clock: 0, d0: Math.hypot(gx, gz), target: this.target };
      this.avT = 0;
      this.mgr.stats.walled = (this.mgr.stats.walled || 0) + 1;
      return;
    }
    if (best >= 0) {
      this.avX = OUT_DIRS[best][0];
      this.avZ = OUT_DIRS[best][1];
      this.avT = 1.5;
    } else if (!this.ctrl && this.loop && !this.crossing) {
      // (back to the corner they came from)
      const n = this.loop.length;
      this.dir = -this.dir;
      this.target = n === 2 ? (this.target ? 0 : 1) : (this.target + this.dir + n) % n;
    }
  }

  // (critic round) out of sight - behind the camera, or far off - set back on the walk round their block,
  // at the point of it nearest them: false if it would be seen
  warpOut() {
    const L = this.loop;
    if (!L || L.length !== 4 || this.ctrl || this.scripted || this.crossing || this.prom) return false;
    const cam = this.game.camera;
    const cp = cam.position;
    const fw = cam.getWorldDirection(_rd);
    const dx = this.pos.x - cp.x;
    const dz = this.pos.z - cp.z;
    const dist = Math.hypot(dx, dz) || 1;
    if (dist < 45 && dx * fw.x + dz * fw.z > -0.2 * dist) return false;
    let best = null;
    let bd = Infinity;
    for (let i = 0; i < 4; i++) {
      const a = L[i];
      const b = L[(i + 1) % 4];
      const vx = b[0] - a[0];
      const vz = b[1] - a[1];
      const k = clamp(((this.pos.x - a[0]) * vx + (this.pos.z - a[1]) * vz) / (vx * vx + vz * vz || 1), 0, 1);
      const qx = a[0] + vx * k;
      const qz = a[1] + vz * k;
      const d = Math.hypot(qx - this.pos.x, qz - this.pos.z);
      if (d < bd) {
        bd = d;
        best = [qx, qz, i];
      }
    }
    if (!best) return false;
    this.pos.x = best[0];
    this.pos.z = best[1];
    this.vel.set(0, 0, 0);
    this.target = this.dir > 0 ? (best[2] + 1) % 4 : best[2];
    this.wf = null;
    this.via = null;
    this.avT = 0;
    this.unstuckAt.length = 0;
    this.mgr.stats.warped = (this.mgr.stats.warped || 0) + 1;
    if (this.goal) this.headFor(this.goal);
    return true;
  }

  update(dt) {
    const game = this.game;
    const fig = this.fig;
    if (this.inside) {
      // shopping: nobody sees you, the errand brings you back out
      if (this.ctrl) this.ctrl(this, dt);
      return;
    }
    if (this.dying >= 0) {
      this.dying += dt;
      if (fig.split >= 0) {
        fig.split += dt;
        fig.speed = Math.max(0, fig.speed - dt * 2.5);
        if (fig.split < 1) {
          this.pos.x += Math.sin(this.yaw) * fig.speed * dt;
          this.pos.z += Math.cos(this.yaw) * fig.speed * dt;
        }
        fig.dissolve = clamp((this.dying - 1.8) / 0.9, 0, 1);
      } else {
        fig.dead = Math.min(1, this.dying * 2.2);
        fig.speed = 0;
        // (thrown and dead: the flight first, ROADMAP 5.5)
        fig.dissolve = this.ragKill ? clamp((this.dying - 3.5) / 1.2, 0, 1) : clamp((this.dying - 1.2) / 0.9, 0, 1);
      }
      fig.update(dt);
      return;
    }
    // (thrown by a car or a blast: the body falls as it will, lies a moment, gets up and runs;
    // ROADMAP 5.5)
    if (fig.rag) {
      fig.update(dt);
      if (fig.rag.done) {
        this.lieT += dt;
        if (this.lieT > LIE) this.game.ragdolls.release(this, RISE);
      } else this.lieT = 0;
      return;
    }
    // (knocked down in a fist fight - or out cold, seeing stars - then up and away: ROADMAP 5.4)
    if ((this.downT > 0 || this.upT > 0) && this.updateDown(dt)) return;
    // (critic round: a moment at the corner cut short - a fright, a scene - the phone away again)
    if (this.pausing && (this.panicT > 0 || this.ctrl || this.cowerT > 0 || this.coverT > 0 || this.noticeT > 0 || this.callT > 0 || this.browse || this.headless)) {
      stopWait(this, this.pausing);
      this.pausing = null;
    }
    let tx;
    let tz;
    let speed = this.speed * this.rush;
    const legless = fig.parts.legL < 0.5 && fig.parts.legR < 0.5;
    const limping = (fig.parts.legL < 0.5) !== (fig.parts.legR < 0.5);
    if (this.headless) {
      // runs blind in a panic, arms flailing, zig-zagging until the body gives up
      this.headlessT += dt;
      if (this.headlessT > 11) {
        this.mgr.kill(this);
        return;
      }
      if (!this.blindDir || Math.random() < dt * 0.8) this.blindDir = this.yaw + (Math.random() - 0.5) * 2.4;
      tx = this.pos.x + Math.sin(this.blindDir) * 5;
      tz = this.pos.z + Math.cos(this.blindDir) * 5;
      speed = 5.2;
      fig.flail = 1;
      fig.stagger = 1;
      fig.armsUp = 0;
    } else if (this.panicT > 0) {
      this.panicT -= dt;
      // inside a shop: out of the door first (round the counter, not through the wall)
      const ex = this.exitRoom && !this.ctrl ? this.exitTarget() : null;
      if (ex) {
        tx = ex.x;
        tz = ex.z;
      } else if (game.brain && !game.classic) {
        // (ROADMAP 13.10) running as people run: away along the sidewalk, round the corner, through
        // the open - never into a wall; slower the further off - game/brain.js
        const g = game.brain.fleeGoal(this, dt);
        tx = g.x;
        tz = g.z;
        speed = g.speed;
      } else {
        const fx = this.pos.x - this.fearX;
        const fz = this.pos.z - this.fearZ;
        const l = Math.hypot(fx, fz) || 1;
        tx = this.pos.x + (fx / l) * 5;
        tz = this.pos.z + (fz / l) * 5;
        speed = 5.8;
        fig.armsUp = 1;
      }
      if (ex) speed = 4.4;
    } else if (this.coverT > 0) {
      // (ROADMAP 13.10) behind something - a parked car, a wall, a corner - out of the line of fire:
      // there bent low, then down, turned to it, until it goes quiet (game/brain.js)
      this.coverT -= dt;
      const cv = this.coverAt;
      const d = cv ? Math.hypot(cv.x - this.pos.x, cv.z - this.pos.z) : 0;
      this.crouchW = cv && d > 0.45 ? 0.3 : 1;
      if (cv && d > 0.45) {
        tx = cv.x;
        tz = cv.z;
        speed = d > 1.6 ? 4.6 : 2.2;
      } else {
        tx = this.pos.x;
        tz = this.pos.z;
        speed = 0;
        this.yaw = dampAngle(this.yaw, Math.atan2(this.fearX - this.pos.x, this.fearZ - this.pos.z), 5, dt);
      }
    } else if (this.cowerT > 0) {
      // (ROADMAP 13.10) down where they are, the back to it, until it is over (off the chair first,
      // if they were sitting: game/brain.js)
      this.cowerT -= dt;
      tx = this.pos.x;
      tz = this.pos.z;
      speed = 0;
      this.crouchW = 1;
      if (fig.sit > 0) fig.sit = Math.max(0, fig.sit - dt * 3);
      this.yaw = dampAngle(this.yaw, Math.atan2(this.pos.x - this.fearX, this.pos.z - this.fearZ), 6, dt);
    } else if (this.avoidT > 0 && !this.ctrl) {
      // (ROADMAP 13.10) off from it at a brisk walk, glancing back
      this.avoidT -= dt;
      fig.armsUp = 0;
      const g = game.brain.fleeGoal(this, dt, true);
      tx = g.x;
      tz = g.z;
      speed = g.speed;
    } else if (this.callT > 0 || (this.confrontT > 0 && !this.ctrl)) {
      // (ROADMAP 13.10) on the phone to the police, where they are; or up to whoever did it, to say
      // so - not too near. (ROADMAP 13.12: a call made at the counter, at a table, in the line waits
      // for nothing - what they were doing waits for it)
      tx = this.pos.x;
      tz = this.pos.z;
      speed = 0;
      if (this.callT > 0) {
        // (on the phone, still near it: a slow walk away from it as they talk - unless where they are
        // holds them: the table, the counter)
        this.callT -= dt;
        const fx = this.pos.x - this.fearX;
        const fz = this.pos.z - this.fearZ;
        const fd = Math.hypot(fx, fz);
        if (fd < 14 && fd > 0.1 && !this.ctrl) {
          tx = this.pos.x + (fx / fd) * 2;
          tz = this.pos.z + (fz / fd) * 2;
          speed = 0.9;
        }
      } else {
        this.confrontT -= dt;
        const p = game.player.pos;
        const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z) || 1;
        if (d > 3.6) {
          tx = p.x - ((p.x - this.pos.x) / d) * 3.2;
          tz = p.z - ((p.z - this.pos.z) / d) * 3.2;
          speed = 1.5;
        } else this.yaw = dampAngle(this.yaw, Math.atan2(p.x - this.pos.x, p.z - this.pos.z), 6, dt);
      }
    } else if (this.noticeT > 0) {
      // (ROADMAP 13.12) stopped by what happened: whatever they were doing - the shelf, the queue, the
      // table, the walk - waits while they turn to it (the body too, unless they are sitting) and
      // take it in (game/brain.js notice)
      this.noticeT -= dt;
      tx = this.pos.x;
      tz = this.pos.z;
      speed = 0;
      if (fig.sit < 0.3 && this.fearX !== undefined) this.yaw = dampAngle(this.yaw, Math.atan2(this.fearX - this.pos.x, this.fearZ - this.pos.z), 4, dt);
    } else if (this.ctrl) {
      fig.flail = 0;
      const fn = this.ctrl;
      const lead = this.buddyOf;
      const m = this.ctrl(this, dt);
      // (ROADMAP 13.12) a child at a parent's side, a friend at a friend's (game/crowds.js addChild,
      // Civilians.addBuddy), let go because the other one ran: not for good - they find each other
      // again once it is over (Civilians.regroup)
      if (lead && !this.ctrl && !this.buddyOf && lead.alive && !lead.gone && lead.buddy === this && lead.panicT > 0) {
        this.buddyOf = lead;
        this.regroup = fn;
      }
      if (this.inside) return;
      if (m) {
        tx = m.x;
        tz = m.z;
        speed = m.speed;
      } else {
        tx = this.pos.x;
        tz = this.pos.z;
        speed = 0;
      }
    } else if (this.exitRoom && this.exitTarget()) {
      // let go inside a shop: out onto the sidewalk before the usual walk
      fig.armsUp = 0;
      fig.flail = 0;
      const ex = this.exitTarget();
      tx = ex.x;
      tz = ex.z;
    } else if (this.browse) {
      // (v5, ROADMAP 11.18) at a shop's window: over to it, a look at what is in it, and on
      fig.armsUp = 0;
      fig.flail = 0;
      const b = this.browse;
      tx = b.x;
      tz = b.z;
      b.t -= dt;
      if (Math.hypot(tx - this.pos.x, tz - this.pos.z) < 0.35 || b.at) {
        b.at = true;
        speed = 0;
        this.yaw = dampAngle(this.yaw, b.yaw, 5, dt);
        b.look = b.look || new THREE.Vector3();
        const k = Math.sin(b.t * 0.7 + b.seed);
        b.look.set(b.x + Math.sin(b.yaw) * 1.2 + Math.cos(b.yaw) * k * 0.8, this.pos.y + 1.2 + Math.sin(b.t * 0.5) * 0.25, b.z + Math.cos(b.yaw) * 1.2 - Math.sin(b.yaw) * k * 0.8);
        fig.lookAt = b.look;
        // (a friend with them: something to say about it)
        if (b.say && b.t < b.say) {
          b.say = 0;
          if (this.buddy || this.buddyOf) this.game.bubbles.say(this, WINDOW_SAYS[Math.floor(Math.random() * WINDOW_SAYS.length)]);
        }
      }
      if (b.t <= 0 || (!b.at && b.t < -6)) {
        fig.lookAt = null;
        this.browse = null;
        this.idleT = 8 + Math.random() * 14;
      }
    } else {
      fig.armsUp = 0;
      fig.flail = 0;
      // (ROADMAP 13.12) out with a friend and parted by a fright: back at their side once it is over
      if (this.regroup) this.mgr.regroup(this);
      const t = this.loop[this.target];
      tx = t[0];
      tz = t[1];
      // (critic round) out in the road and not crossing it - shoved out into the intersection by a
      // car, let go in the middle of it, a frightened run that ended there: back onto the sidewalk
      // first, the short way - not on from there straight across the traffic to the next corner, in
      // front of the cars waiting for them to get out of the way (and they for the cars)
      this.offT = (this.offT === undefined ? Math.random() : this.offT) - dt;
      if (this.offT <= 0 && !this.via && !this.crossing && !this.prom && this.loop.length === 4) {
        this.offT = 1;
        const L = this.loop;
        const a = L[(this.target - this.dir + 4) % 4];
        const vx = t[0] - a[0];
        const vz = t[1] - a[1];
        const k = clamp(((this.pos.x - a[0]) * vx + (this.pos.z - a[1]) * vz) / (vx * vx + vz * vz || 1), 0, 1);
        const qx = a[0] + vx * k;
        const qz = a[1] + vz * k;
        // (out in the road: off the walk on its outer side, away from the block - the inside of a
        // block, a plaza, a front yard, is not the road, and the wall-follow is there for it)
        const bx = (L[0][0] + L[1][0] + L[2][0] + L[3][0]) / 4;
        const bz = (L[0][1] + L[1][1] + L[2][1] + L[3][1]) / 4;
        if (Math.hypot(qx - this.pos.x, qz - this.pos.z) > 4.2 && (this.pos.x - qx) * (bx - qx) + (this.pos.z - qz) * (bz - qz) < 0) {
          this.via = { x: qx, z: qz, until: game.time + 15 };
          const st = this.mgr.stats;
          st.offWalk = (st.offWalk || 0) + 1;
          const log = st.offLog || (st.offLog = []);
          log.push({ x: +this.pos.x.toFixed(1), z: +this.pos.z.toFixed(1), d: +Math.hypot(qx - this.pos.x, qz - this.pos.z).toFixed(1), col: this.col, row: this.row, t: this.target, day: this.day ? this.day.why : null });
          if (log.length > 20) log.shift();
        }
      }
      // (ROADMAP 13.12) off their sidewalk after a fright, something in the way of the corner: back
      // onto the sidewalk first, the short way (game/brain.js resume)
      const via = this.via;
      if (via) {
        // (critic round: a way of a few steps - out of a front yard by its path and its gate - one
        // point after the other)
        if (Math.hypot(via.x - this.pos.x, via.z - this.pos.z) < 0.8 || this.game.time > via.until) this.via = via.next || null;
        else {
          tx = via.x;
          tz = via.z;
        }
      }
      // (v5, ROADMAP 11.18) along the way: a shop's window to look in, a look at the phone, a
      // look at the time
      this.idleT = (this.idleT === undefined ? 3 + Math.random() * 10 : this.idleT) - dt;
      // (critic round: late to meet a friend - no window-shopping on the way)
      if (this.idleT <= 0 && !this.crossing && !this.jog && this.stopT <= 0 && !this.dateOf) {
        this.idleT = 5 + Math.random() * 9;
        // (GTA IV pass: an old man stops for a breather now and then, a hand to his back)
        if (this.role === 'elder' && Math.random() < 0.35) {
          this.stopT = 2.5 + Math.random() * 2.5;
          this.mgr.mime(this, 'rest', this.stopT);
        } else if (!this.mgr.windowStop(this) && Math.random() < 0.25) {
          this.stopT = 1.5 + Math.random() * 3;
          if (!fig.carry && Math.random() < 0.6) {
            fig.carry = 'phone';
            this.carryUntil = this.game.time + this.stopT + 4 + Math.random() * 12;
          }
        }
      }
      if (!this.via && Math.hypot(tx - this.pos.x, tz - this.pos.z) < 0.8) {
        this.nextCorner();
        this.crossOK = false;
        this.crossNode = undefined;
        this.hurry = false;
        if (!this.crossing && !this.dateOf && Math.random() < (this.chatty ? 0.4 : 0.15)) {
          this.stopT = 1 + Math.random() * (this.chatty ? 6 : 3);
          // (critic round) a moment at the corner with something to it - the phone, a look down the
          // street one way and the other - not standing there staring at nothing (game/waiting.js)
          this.pausing = this.pauseW || (this.pauseW = {});
        }
      }
      if (this.crossing && !this.crossOK) {
        // at the curb: across only when the cars of that road have the red light. (GTA IV pass)
        // And waited for properly: a place of one's own at the edge of the curb beside the others
        // waiting there (Civilians.curbSlot), facing across, a look up the road at the cars coming
        // now and then; when the walk turns, a beat before stepping off - each their own - and over
        // together
        const t2 = this.loop[this.target];
        const go = this.mayCross(t2[0], t2[1]);
        const w = this.waitAt;
        if (go && (!w || (w.go += dt) > w.react)) {
          this.crossOK = true;
          if (w) this.mgr.leaveCurb(this);
        } else {
          if (!w) this.mgr.curbSlot(this, t2[0], t2[1]);
          const s = this.waitAt;
          if (!go) s.go = 0;
          const wd = Math.hypot(s.x - this.pos.x, s.z - this.pos.z);
          // (up to the edge of the curb - and where something low stands in the way of it, a
          // couple of seconds of trying is enough: waiting where they are, not walking on the spot)
          if (wd > 0.25 && (s.walkT = (s.walkT || 0) + dt) < 2.5) {
            tx = s.x;
            tz = s.z;
            speed = Math.min(speed, 0.6 + wd);
          } else {
            speed = 0;
            this.faceYaw = Math.atan2(t2[0] - this.pos.x, t2[1] - this.pos.z);
            this.yaw = dampAngle(this.yaw, this.faceYaw, 4, dt);
          }
          this.mgr.curbLook(this, s, dt);
        }
      }
      // hurry across the road (an old man at his own pace; everybody quicker once the walk is
      // about to end - Civilian.lightLeft)
      if (this.crossing && this.crossOK) {
        this.hurryT = (this.hurryT || 0) - dt;
        if (this.hurryT <= 0) {
          this.hurryT = 0.5;
          const t2 = this.loop[this.target];
          this.hurry = this.lightLeft(t2[0], t2[1]) < 3;
        }
        speed *= this.jog ? 1 : this.role === 'elder' ? (this.hurry ? 1.25 : 1.05) : this.hurry ? 1.75 : 1.3;
      }
      if (this.stopT > 0) {
        this.stopT -= dt;
        speed = 0;
        if (this.pausing) waitBeat(game, this, this.pausing, dt, { street: true });
      } else if (this.pausing) {
        stopWait(this, this.pausing);
        this.pausing = null;
      }
      // (v5, ROADMAP 11.18: round the others on the sidewalk, not through them)
      // (where you can see it: past 36 m nobody can tell, and it costs a little for every walker)
      const cam = this.game.camera.position;
      const cdx = this.pos.x - cam.x;
      const cdz = this.pos.z - cam.z;
      if (speed > 0 && !this.crossing && cdx * cdx + cdz * cdz < 1296) {
        const st = this.mgr.steer(this, tx, tz, _steer);
        tx = st.x;
        tz = st.z;
        speed *= st.k;
        // (intelligence round: you in the way, no room round you, and staying there: after a few
        // seconds, back the way they came - not walking on the spot into you for ever)
        if (st.wait) {
          this.youWaitT = (this.youWaitT || 0) + dt;
          if (this.youWaitT > 4 && this.loop && !this.ctrl) {
            this.youWaitT = 0;
            const n = this.loop.length;
            this.dir = -this.dir;
            this.target = n === 2 ? (this.target ? 0 : 1) : (this.target + this.dir + n) % n;
          }
        } else if (this.youWaitT) this.youWaitT = Math.max(0, this.youWaitT - dt);
      }
    }
    if (legless) speed = Math.min(speed, 0.8);
    else if (limping) speed = Math.min(speed * 0.45, 1.8);
    // (rocked by a punch: a stagger before the run, ROADMAP 5.4)
    if (this.reelT > 0) {
      this.reelT -= dt;
      speed *= 0.2;
    }
    // (glued to the pavement: a shot of glue, a puddle of it - game/weapons.js)
    if (this.glueT > 0) {
      this.glueT -= dt;
      speed = 0;
    }
    fig.crawl = damp(fig.crawl, legless ? 1 : 0, 6, dt);
    if (!this.headless) fig.stagger = this.reelT > 0 ? 0.8 : limping ? 0.6 : 0;
    // (intelligence round) round whatever stands in the way, not into it (avoid)
    const way = this.avoid(tx, tz, speed, dt);
    if (way) {
      tx = way.x;
      tz = way.z;
    }
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    // slow down on arrival instead of overshooting (scripted people stop on their marks)
    if (this.ctrl && l < 0.6) speed *= l / 0.6;
    // (intelligence round) a step aside (dodgeV) is on top of the walk for this frame only: it was
    // added into the walk's own velocity every frame, and summed up - a half-metre step out of your
    // way became a dash of six to eleven metres at a sprint (the more frames a second, the further):
    // somebody you walked up to shot off sideways like somebody running for their life
    const dA = this.dodgeApplied;
    this.vel.x = damp(this.vel.x - dA.x, (dx / l) * speed, 6, dt) + this.dodgeV.x;
    this.vel.z = damp(this.vel.z - dA.z, (dz / l) * speed, 6, dt) + this.dodgeV.z;
    dA.copy(this.dodgeV);
    this.dodgeV.multiplyScalar(Math.exp(-5 * dt));
    const ox = this.pos.x;
    const oz = this.pos.z;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    if (!this.noCollide) {
      const hit = game.world.collision.resolveCylinder(this.pos, 0.33, 1.7, 0.5);
      // (against something: along it, not into it - what goes into it is lost, not stored up)
      if (hit.hitWall) {
        const vn = this.vel.x * hit.nx + this.vel.z * hit.nz;
        if (vn < 0) {
          this.vel.x -= hit.nx * vn;
          this.vel.z -= hit.nz * vn;
        }
      }
    }
    this.progress(ox, oz, speed, l, dt);
    // (the friend riding with you is in the car on purpose: ROADMAP 4.5)
    if (!this.riding) game.vehicles.pushOut(this.pos, 0.33);
    const gy = groundHeight(this.pos.x, this.pos.z) + (this.baseY || 0);
    // (riding: the seat holds her, over a ramp too)
    if (!this.riding) this.pos.y = this.hopY > 0 ? gy + this.hopY : damp(this.pos.y, gy, 20, dt);
    fig.air = this.hopY > 0.04;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.2) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 8, dt);
    // (the way their scene has them face - not while they are turned to what happened, or down)
    else if (this.faceYaw !== null && this.ctrl && !(this.noticeT > 0 || this.cowerT > 0 || this.coverT > 0)) this.yaw = dampAngle(this.yaw, this.faceYaw, 6, dt);
    // (intelligence round) you said hello: they turn to you, the whole of them, while they answer
    // (game/voices.js hello)
    else if (this.faceYouUntil > game.time && game.player && !(this.cowerT > 0 || this.coverT > 0)) this.yaw = dampAngle(this.yaw, Math.atan2(game.player.pos.x - this.pos.x, game.player.pos.z - this.pos.z), 5, dt);
    // (characters round) somebody looked at far round for a while, standing: they turn to them - the
    // body after the eyes, the head and the chest (game/doodle.js turnHead)
    else if (fig.turnTo !== null && fig.turnTo !== undefined && !(this.cowerT > 0 || this.coverT > 0)) this.yaw = dampAngle(this.yaw, fig.turnTo, 3, dt);
    fig.yaw = this.yaw;
    // (a jogger at a red light runs on the spot: the stride goes on where the feet stay)
    fig.speed = this.jog && this.waitAt && sp < 0.3 ? 2.6 : sp;
    // (GTA IV pass) the hands with the words, the head to whoever is talking (near the camera)
    if (this.talkUntil > 0 || this.listenTo || this.glanceUntil > 0 || this.waitAt || this._look) this.social(dt);
    // (ROADMAP 13.7) their face: afraid running from danger, in pain on the ground, the words they say
    // - render/people.js faceOf
    // (down and up again as a body goes, not at once)
    if (this.crouchW !== undefined) {
      fig.crouch += (this.crouchW - fig.crouch) * Math.min(1, dt * 7);
      if (this.crouchW === 0 && fig.crouch < 0.02) {
        fig.crouch = 0;
        this.crouchW = undefined;
      }
    }
    fig.mood = this.panicT > 0 || this.cowerT > 0 || this.coverT > 0 ? 'scared' : this.downT > 0 ? 'hurt' : null;
    fig.talk = this.talkUntil > this.game.time;
    fig.update(dt);
  }

  // the hands while a line is said (gestureAt), and where the head turns: to the one talking, to
  // you going by (game/voices.js), up the road at the traffic while waiting at the curb
  social(dt) {
    const fig = this.fig;
    const game = this.game;
    const now = game.time;
    const cam = game.camera.position;
    const near = (this.pos.x - cam.x) ** 2 + (this.pos.z - cam.z) ** 2 < GESTURE_D * GESTURE_D;
    // (taken from the curb by something else: the place there is free again)
    if (this.waitAt && (!this.crossing || this.crossOK || this.ctrl || this.panicT > 0)) this.mgr.leaveCurb(this);
    // ---- the hands
    // (a hand another system took while it was ours: the shops and the others write their reach
    // into whatever point the hand already follows - game/streetlife.js - so that point is theirs
    // now, and the words get a new one; the hand stays with what it is doing)
    if (this._gR && fig.reachR === this._gR && this._gRw && !this._gR.equals(this._gRw)) this._gR = null;
    if (this._gL && fig.reachL === this._gL && this._gLw && !this._gL.equals(this._gLw)) this._gL = null;
    // (and never over hands held up - a gun pointed at them: "Don't shoot!" with the hands up, not a
    // fist shaken at it, game/voices.js aimAt - nor over a dance)
    let on = near && this.talkUntil > now && this.gest && !this.headless && !(this.panicT > 0) && this.downT <= 0 && !fig.rag && fig.speed < 2.6 && !(fig.armsUp > 0) && !(fig.surrender > 0) && !(fig.dance > 0.3);
    if (on) {
      this.gestT += dt;
      const t = this.gestT;
      const ph = fig.seed * 1.7;
      const sitDrop = fig.sit * 0.43;
      const full = HANDS_FULL.has(fig.carry);
      // the right hand: free, or holding something light (a coffee goes with the words); on the
      // phone it stays at the ear and the left one talks
      const rOk = !full && !RIGHT_BUSY.has(fig.carry) && !(this.onCall && fig.carry === 'phone') && fig.parts.armR > 0.5 && (!fig.reachR || fig.reachR === this._gR);
      const lOk = !full && !fig.carryL && fig.parts.armL > 0.5 && (!fig.reachL || fig.reachL === this._gL);
      let usedR = false;
      let usedL = false;
      if (rOk) {
        const v = this._gR || (this._gR = new THREE.Vector3());
        if (gestureAt(this.gest, 1, t, ph, v)) {
          fig.toWorld(v.x, v.y - sitDrop, v.z, v);
          fig.reachR = v;
          (this._gRw || (this._gRw = new THREE.Vector3())).copy(v);
          usedR = true;
        }
      }
      if (lOk) {
        const v = this._gL || (this._gL = new THREE.Vector3());
        // (a one-handed gesture with the right hand busy: the left one makes it, mirrored)
        const k = !rOk && gestureAt(this.gest, 1, t, ph, v) ? -1 : 0;
        if (k || gestureAt(this.gest, -1, t, ph, v)) {
          if (k) v.x = -v.x;
          fig.toWorld(v.x, v.y - sitDrop, v.z, v);
          fig.reachL = v;
          (this._gLw || (this._gLw = new THREE.Vector3())).copy(v);
          usedL = true;
        }
      }
      if (!usedR && fig.reachR === this._gR && this._gR) fig.reachR = null;
      if (!usedL && fig.reachL === this._gL && this._gL) fig.reachL = null;
      on = usedR || usedL;
    }
    if (!on) {
      if (this._gR && fig.reachR === this._gR) fig.reachR = null;
      if (this._gL && fig.reachL === this._gL) fig.reachL = null;
      if (this.talkUntil <= now) {
        this.talkUntil = 0;
        this.gest = null;
      }
    }
    // ---- the head: the one talking to them, you (a glance), the traffic up the road
    if (this.listenUntil <= now) this.listenTo = null;
    if (this.glanceUntil <= now) {
      this.glanceUntil = 0;
      this.glanceAt = null;
    }
    let look = null;
    // (ROADMAP 13.12: what they took in - a shot, a blow - comes before the one talking, and before
    // whatever their scene has them looking at: game/brain.js look)
    const hard = !!this.glanceAt && this.glanceHard > now;
    if (near && !(this.panicT > 0)) {
      const L = this.listenTo;
      if (hard) look = this.glanceAt;
      else if (L && L.alive && !L.gone && L.fig.parts.head > 0.5 && Math.abs(L.pos.x - this.pos.x) + Math.abs(L.pos.z - this.pos.z) < 6) look = L.fig.j.headC;
      else if (this.glanceAt) look = this.glanceAt;
      else if (this.waitAt && this.waitAt.look) look = this.waitAt.look;
    } else if (near && this.glanceAt) look = this.glanceAt; // (ROADMAP 13.10: a look back, running)
    if (look) {
      if (!fig.lookAt || fig.lookAt === this._look || (hard && look === this.glanceAt)) {
        fig.lookAt = look;
        this._look = look;
      }
    } else if (this._look) {
      if (fig.lookAt === this._look) fig.lookAt = null;
      this._look = null;
    }
  }

  // on the ground after a punch or a kick (game/fists.js), and back up; then off, away from you
  updateDown(dt) {
    const fig = this.fig;
    if (!downStep(this, dt)) {
      this.ko = false;
      this.daze = 0;
      const p = this.game.player.pos;
      this.panicT = this.brave ? 0 : 8;
      this.fearX = p.x;
      this.fearZ = p.z;
      return false;
    }
    // the blow slides the body along the ground
    const v = this.dodgeV;
    this.pos.x += v.x * dt;
    this.pos.z += v.z * dt;
    v.multiplyScalar(Math.exp(-5 * dt));
    this.game.world.collision.resolveCylinder(this.pos, 0.33, 1.7, 0.5);
    this.pos.y = damp(this.pos.y, groundHeight(this.pos.x, this.pos.z), 20, dt);
    this.vel.set(0, 0, 0);
    fig.yaw = this.yaw;
    fig.armsUp = 0;
    fig.flail = 0;
    fig.stagger = 0;
    fig.update(dt);
    return true;
  }

  // may they step off the curb towards (tx, tz)? Across an avenue when its cars wait at the red
  // light, across a street when its cars do (with time enough left to reach the other side)
  mayCross(tx, tz) {
    return this.lightLeft(tx, tz) > 6;
  }

  // how long the way across to (tx, tz) is still the walkers' (s; -1: the cars have it now)
  // (the crossing found once for each way over: every frame at the curb would look through every
  // crossing of the city)
  lightLeft(tx, tz) {
    let n = this.crossNode;
    if (n === undefined) {
      const mx = (this.pos.x + tx) / 2;
      const mz = (this.pos.z + tz) / 2;
      n = null;
      let bd = 30;
      for (const m of NODES) {
        if (Math.abs(m.x - mx) > bd || Math.abs(m.z - mz) > bd) continue;
        const d = Math.hypot(m.x - mx, m.z - mz);
        if (d < bd) {
          bd = d;
          n = m;
        }
      }
      this.crossNode = n;
    }
    if (!n || !n.signal) return 99;
    const time = this.game.traffic ? this.game.traffic.time : 0;
    const ph = (((time + n.offset) % CYCLE) + CYCLE) % CYCLE;
    const acrossAve = Math.abs(tx - this.pos.x) > Math.abs(tz - this.pos.z);
    // the avenue's cars: green 0..11, yellow ..13.5, red 13.5..26; the street's: green 14.5..23
    return acrossAve ? (ph >= 13.5 ? CYCLE - ph : -1) : ph < 14.5 ? 14.5 - ph : ph >= 25.5 ? CYCLE - ph + 14.5 : -1;
  }

  // the next step out of the shop they are in: round the furniture, out of the door, a step onto
  // the sidewalk (null once outside)
  exitTarget() {
    const R = this.exitRoom;
    const s = this.exitShop;
    if (!this.exitPts) {
      this.exitPts = [];
      if (R && s && R.door && R.inside(this.pos.x, this.pos.z, 0.3)) {
        const out = 1.8 + (s.yard || 0);
        this.exitPts = [...R.path(this.pos.x, this.pos.z, R.door.x, R.door.z), { x: s.door[0], z: s.door[2] }, { x: s.door[0] + s.nx * out, z: s.door[2] + s.nz * out }];
        this.noCollide = true;
      }
    }
    const pts = this.exitPts;
    while (pts.length && Math.hypot(pts[0].x - this.pos.x, pts[0].z - this.pos.z) < 0.45) pts.shift();
    if (pts.length <= 1) this.noCollide = false;
    if (!pts.length) {
      this.exitRoom = null;
      this.exitShop = null;
      this.exitPts = null;
      return null;
    }
    return pts[0];
  }

  dispose() {
    this.fig.dispose();
  }
}

// (GTA IV pass) the places at the edge of the curb where people wait for the walk, side by side
// along it and a second row behind: [along the curb, back from it] (m)
const CURB_SLOTS = [[0, 0], [0.8, 0], [-0.8, 0], [1.6, 0], [-1.6, 0], [0.4, 0.75], [-0.4, 0.75], [1.2, 0.75], [-1.2, 0.75], [0, 1.5]];

export class Civilians {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.t = 0;
    // (ROADMAP 14.9) how many of each of the city's drawn kinds are about now (game/looks.js folkPick)
    FOLK_LIVE.of = () => {
      const a = new Uint16Array(128);
      for (const c of this.list) {
        const k = c.fig && c.fig.look ? c.fig.look.folk : undefined;
        if (k !== undefined && !c.dead) a[k]++;
      }
      return a;
    };
    // (GTA IV pass) the corners where somebody is waiting to cross: who stands where
    this.curbs = new Map();
    // (intelligence round) how often somebody went round something, and was got out of a corner
    this.stats = { avoided: 0, unstuck: 0 };
  }

  // ------------------------------------------------------------------ at the curb
  // c at a corner, waiting to cross to (tx, tz): the next free place at the edge of the curb
  // (1.9 m on from the corner of the walk, where the zebra starts), beside whoever is there
  // already; one not on a pole, a bin, a box of papers
  curbSlot(c, tx, tz) {
    const dx = tx - c.pos.x;
    const dz = tz - c.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    const ux = dx / l;
    const uz = dz / l;
    const way = Math.abs(ux) > Math.abs(uz) ? (ux > 0 ? 1 : 2) : uz > 0 ? 3 : 4;
    // (the corner known by where its crossing goes - the far corner, the same point of the walk
    // for everybody crossing there - not by where each one happened to stop: two people arriving a
    // step apart were two corners, each with its own places, and stood inside each other)
    const key = (Math.round(tx * 2) * 8191 + Math.round(tz * 2)) * 5 + way;
    let C = this.curbs.get(key);
    if (!C) {
      C = { x: c.pos.x, z: c.pos.z, ux, uz, used: [] };
      this.curbs.set(key, C);
    }
    const col = this.game.world.collision;
    for (let k = 0; k < CURB_SLOTS.length; k++) {
      const o = C.used[k];
      if (o && o !== c && o.alive && !o.gone && o.waitAt && o.waitAt.C === C) continue;
      const [lat, back] = CURB_SLOTS[k];
      const x = C.x + C.ux * (1.9 - back) - C.uz * lat;
      const z = C.z + C.uz * (1.9 - back) + C.ux * lat;
      // (room for a body there: a person is 0.33 m round)
      if (col.pointInside(x, 1.0, z, 0.36)) continue;
      C.used[k] = c;
      c.waitAt = { C, k, x, z, go: 0, react: 0.2 + Math.random() * 0.9 + (c.role === 'elder' ? 0.7 : 0), look: null, lookT: Math.random() * 2, ux, uz };
      return;
    }
    c.waitAt = { C: null, k: -1, x: c.pos.x, z: c.pos.z, go: 0, react: 0.3 + Math.random() * 0.8, look: null, lookT: Math.random() * 2, ux, uz };
  }

  leaveCurb(c) {
    const w = c.waitAt;
    if (!w) return;
    if (w.C && w.C.used[w.k] === c) w.C.used[w.k] = null;
    c.waitAt = null;
  }

  // waiting: a look up the road at the cars coming (from the left, on this side), now and then
  // the other way; somebody with a phone looks at it instead
  curbLook(c, w, dt) {
    w.lookT -= dt;
    if (w.lookT > 0) return;
    w.lookT = 1.2 + Math.random() * 2.2;
    if (c.fig.carry === 'phone' && Math.random() < 0.5) {
      w.look = null;
      return;
    }
    const v = w.look || (w.look = new THREE.Vector3());
    const s = Math.random() < 0.7 ? 1 : -1;
    v.set(c.pos.x + w.uz * 9 * s + w.ux * 3, c.pos.y + 1.4, c.pos.z - w.ux * 9 * s + w.uz * 3);
  }

  // ------------------------------------------------------------------ said, with the hands
  // (game/voices.js heard: every line said in the city) c says text: the hands go with it for as
  // long as it is said (Civilian.social), and whoever c is talking with looks at c
  spoke(c, text, tone) {
    if (!c || !c.fig || !c.alive || c.inside) return;
    const life = Math.min(3.4, 1.3 + text.length * 0.045);
    const now = this.game.time;
    c.talkUntil = now + life;
    let g = c.gestNext || gestureFor(text, tone);
    // (on the phone: no wave hello into it, no pointing - the free hand talks)
    if (c.onCall && (g === 'wave' || g === 'point')) g = 'hip';
    c.gest = g;
    c.gestNext = null;
    c.gestT = 0;
    const ex = c.convo;
    const H = c.huddle;
    const others = ex ? ex.who : H ? H.members : c.buddy ? [c.buddy] : c.buddyOf ? [c.buddyOf] : null;
    if (others) {
      for (const o of others) {
        if (o === c || !o.alive) continue;
        o.listenTo = c;
        o.listenUntil = now + life + 0.8;
      }
    }
  }

  // a gesture with nothing said (far off: a group talking where no word can be heard)
  mime(c, kind, life) {
    if (!c.alive || c.inside) return;
    c.talkUntil = this.game.time + life;
    c.gest = kind;
    c.gestT = 0;
  }

  reset() {
    for (const c of this.list) {
      c.dispose();
      c.gone = true;
    }
    this.list = [];
    this.curbs.clear();
    // (the groups, the calls, the musician: game/streetsocial.js)
    const S = this.game.crowds && this.game.crowds.social;
    if (S) S.reset();
  }

  update(dt) {
    const game = this.game;
    const p = game.anchorPos();
    this.carsNear(p);
    this.t -= dt;
    if (this.t <= 0) {
      // (four times a second, a quarter of the people each time: the same numbers, and no frame of
      // its own every second that makes a dozen of them at once - the steady pace's own beat)
      this.t = 0.25;
      // a busy city: more people on the sidewalks around you (fewer late at night: game/rhythm.js)
      const R = game.rhythm;
      const max = Math.round((game.touch ? 18 : 40) * (R ? R.people : 1));
      // despawn far ones (scripted people belong to their scene, unless it let them go)
      for (const c of this.list) if ((!c.scripted || !c.owner) && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) > 110) c.gone = true;
      this.list = this.list.filter((c) => {
        if (c.gone) c.dispose();
        return !c.gone;
      });
      // (the corners nobody waits at any more)
      if (this.curbs.size > 24) {
        for (const [k, C] of this.curbs) {
          if (!C.used.some((o) => o && o.alive && !o.gone && o.waitAt && o.waitAt.C === C)) this.curbs.delete(k);
        }
      }
      // (GTA IV pass: the street's own people standing in a group, listening to the musician, on
      // the phone, stopped to talk - game/streetsocial.js - are counted with the walkers: they are
      // the street's people, not more of them)
      const social = game.crowds && game.crowds.social;
      let free = 0;
      for (const c of this.list) if (!c.scripted || (social && c.owner === social)) free++;
      if (free > max + 1) {
        // (fewer people are out at this hour than there were: some of those out of sight go home)
        const cp = game.camera.position;
        const fw = game.camera.getWorldDirection(this._fwd || (this._fwd = new THREE.Vector3()));
        for (const c of this.list) {
          if (free <= max) break;
          if (c.scripted || c.ctrl || c.buddy || c.buddyOf || c.dog || !c.alive) continue;
          const dx = c.pos.x - cp.x;
          const dz = c.pos.z - cp.z;
          const d = Math.hypot(dx, dz) || 1;
          if (d < 30 || (dx * fw.x + dz * fw.z) / d > 0) continue;
          c.gone = true;
          free--;
        }
        this.list = this.list.filter((c) => {
          if (c.gone) c.dispose();
          return !c.gone;
        });
      }
      // (the first second fills the streets: its four turns have a quarter of the sixty each)
      this.fillTicks = (this.fillTicks || 0) + 1;
      const first = this.fillTicks <= 4;
      this.filled = true;
      // (v5, ROADMAP 11.18: a street fills up again quickly when you come into it)
      let tries = first ? 15 : 4;
      // the walks that pass near you (on the mainland: of the blocks built near you)
      const ml = game.world.mainland;
      const built = ml && ml.blocks ? new Set(ml.blocks.keys()) : null;
      const near = walksNear(p, 80, built);
      let prom = 0;
      for (const c of this.list) if (c.prom && !c.scripted) prom++;
      // (v5, ROADMAP 11.17: the strolls near you on the mainland's pier, beach and promenades)
      const lines = [];
      for (const w of game.world.walks || []) {
        const dx = w.b[0] - w.a[0];
        const dz = w.b[1] - w.a[1];
        const t = Math.max(0, Math.min(1, ((p.x - w.a[0]) * dx + (p.z - w.a[1]) * dz) / (dx * dx + dz * dz || 1)));
        if (Math.hypot(w.a[0] + dx * t - p.x, w.a[1] + dz * t - p.z) < 70) lines.push(w);
      }
      const cam = game.camera;
      const fwd = cam.getWorldDirection(this._fwd || (this._fwd = new THREE.Vector3()));
      const hr = game.daynight ? game.daynight.hour : 12;
      const evening = hr > 18 && hr < 23.5 ? 1 : hr >= 23.5 || hr < 1.5 ? 0.5 : 0;
      while (free < max && tries-- > 0) {
        // the promenade (when you are near the bay), or a block round you
        let c;
        // (a jogger is dressed for it; in the morning many are out running, and the others are
        // dressed for work; late at night for going out)
        const jog = Math.random() < (R ? R.jog : 0.07);
        // (ROADMAP 14.9: a jogger one of the city's drawn people too, in their street clothes)
        let look = jog ? cityLook({ kind: 'street' }) : null;
        const dress = R ? Math.max(R.commute, R.night) * 0.6 : 0;
        if (!look && dress > 0 && Math.random() < dress) {
          const kinds = R.commute > R.night ? WORK_CLOTHES : NIGHT_CLOTHES;
          look = cityLook({ kind: kinds[Math.floor(Math.random() * kinds.length)] });
        }
        if (lines.length && (Math.random() < 0.55 || !near.length) && prom < max * 0.7) {
          const w = lines[Math.floor(Math.random() * lines.length)];
          if (!look && !game.classic) look = game.crowds.lookFor('prom');
          c = new Civilian(this, 'line', w, look);
        } else if (p.x > -40 && (Math.random() < 0.3 || !near.length) && prom < max * 0.35) {
          const z = Math.max(NORTH_EDGE + 10, Math.min(SOUTH_EDGE, p.z + (Math.random() - 0.5) * 160));
          if (z > PIER.z0 - 4 && z < PIER.z1 + 4) continue;
          // (who walks here: game/crowds.js; ?classic: anybody, as before)
          if (!look && !game.classic) look = game.crowds.lookFor('prom');
          c = new Civilian(this, 'prom', z, look);
        } else if (near.length) {
          // (v5, ROADMAP 11.18: most of them on the sidewalks you are on and the next ones, the way
          // a busy street is busy where you are)
          if (!near.sorted) {
            near.sort((a, b) => a[2] - b[2]);
            near.sorted = true;
          }
          const [col, row] = near[Math.random() < 0.65 ? Math.floor(Math.random() * Math.min(3, near.length)) : Math.floor(Math.random() * near.length)];
          if (!look && !game.classic) look = game.crowds.lookFor(blockType(col, row));
          c = new Civilian(this, col, row, look);
        } else continue;
        if (jog) {
          c.jog = true;
          c.speed = 3.1 + Math.random() * 0.8;
        }
        // (on the way to work: in a hurry)
        else if (R && R.commute > 0) c.speed *= 1 + 0.3 * R.commute;
        // most of them close by (the street you are on is full of people; with the far crowd,
        // game/farcrowd.js, everybody whole is close by and the rest are its)
        const far = Math.random() < 0.3;
        const lo = first ? 3 : game.classic ? (far ? 45 : 16) : 16;
        const hi = game.classic ? (far ? 100 : 60) : 42;
        if (!c.placeNear(p, lo, hi)) {
          c.dispose();
          continue;
        }
        // nobody pops up in plain sight
        const vx = c.pos.x - cam.position.x;
        const vz = c.pos.z - cam.position.z;
        const vd = Math.hypot(vx, vz) || 1;
        if (!first && vd < 50 && (vx * fwd.x + vz * fwd.z) / vd > 0.25) {
          c.dispose();
          continue;
        }
        if (c.prom) prom++;
        this.list.push(c);
        free++;
        // who they are out there: a dog walker, a jogger, on the phone, with friends...
        if (!c.jog) {
          this.dressUp(c);
          if (!game.classic && c.fig.look.role) {
            game.crowds.dress(c);
            if (c.buddy) free++;
          } else if (!c.dog && !c.jog && Math.random() < 0.14 + 0.14 * evening && free < max) {
            // (friends out together; in the evening more of them, and couples)
            if (this.addBuddy(c)) free++;
          }
        }
      }
    }
    // far from the camera a plain walker takes its steps every other frame, twice as long (from
    // there nobody can tell; it halves their share of the work). Half of them move on even
    // frames, half on odd ones.
    const cam = game.camera.position;
    const social = game.crowds && game.crowds.social;
    this.frameN = (this.frameN || 0) + 1;
    // (a phone: every other frame from 25 m, and every third from 55 m - a walker that does not
    // step this frame is not posed or shaped again either: game/doodle.js shapesDirty)
    const low = !!(game.pipe && game.pipe.low);
    const far2 = (low ? FAR_STEP_LOW : FAR_STEP) ** 2;
    const far3 = low ? FAR_THIRD_LOW ** 2 : Infinity;
    this.buildGrid();
    for (let i = 0; i < this.list.length; i++) {
      const c = this.list[i];
      let step = dt + c.owed;
      // (the street's own people on the phone, stopping to talk, by the musician - game/streetsocial.js
      // - are walkers too: far away, the same every-other-frame steps)
      if ((!c.ctrl && !c.scripted && !c.headless && !c.inside) || (social && c.owner === social && !c.still)) {
        if (c.dying >= 0 || c.panicT > 0) {
          // (as near)
        } else {
          const dx = c.pos.x - cam.x;
          const dz = c.pos.z - cam.z;
          const d2 = dx * dx + dz * dz;
          const rest = d2 > far3 ? (this.frameN + i) % 3 !== 0 : d2 > far2 && ((this.frameN + i) & 1) === 1;
          if (rest) {
            c.owed = step;
            continue;
          }
        }
      } else if (c.still && c.dying < 0 && !(c.panicT > 0)) {
        // somebody sitting or waiting (game/routines.js): beyond a few metres their small moves
        // are drawn in steps of three frames
        const dx = c.pos.x - cam.x;
        const dz = c.pos.z - cam.z;
        if (dx * dx + dz * dz > 18 * 18 && (this.frameN + i) % 3) {
          c.owed = step;
          continue;
        }
      }
      c.owed = 0;
      c.update(step);
      if (c.dog) this.walkDog(c, step);
    }
    // (critic round) eyes on the street, not only on you
    this.glances(dt);
    // the rain: umbrellas open, people hurry, some wait under an awning for it to stop
    this.rainT = (this.rainT || 0) - dt;
    if (this.rainT <= 0) {
      this.rainT = 0.5;
      this.rainCheck();
    }
    if (this.list.some((c) => c.fig.dissolve >= 1)) {
      this.list = this.list.filter((c) => {
        if (c.fig.dissolve < 1) return true;
        c.dispose();
        return false;
      });
    }
  }

  // (critic round) Eyes on the street. Somebody walking along looks at what is going on round them,
  // not only at you: the one coming the other way (a look, and away - and now and then the other one
  // looks back, the eyes meet for a moment), a child, a dog, somebody talking or running, the
  // musician playing, a car tearing past or with its horn going. The curious look more and longer,
  // the timid less and quickly away; on the phone, hardly at all.
  // Only near the camera (past 30 m nobody could tell), a few people a frame
  glances(dt) {
    this.glT = (this.glT || 0) - dt;
    if (this.glT > 0) return;
    this.glT = 0.1;
    const list = this.list;
    const n = list.length;
    if (!n || this.game.classic) return;
    const game = this.game;
    const now = game.time;
    const cam = game.camera.position;
    const G = this.grid;
    const pl = game.player;
    const minds = game.minds;
    const busker = game.crowds && game.crowds.social && game.crowds.social.busker;
    const cars = this.cars;
    for (let q = 0; q < Math.min(n, 5); q++) {
      this.glI = ((this.glI || 0) + 1) % n;
      const c = list[this.glI];
      if (!c.alive || c.inside || c.headless || c.scripted || c.panicT > 0 || c.convo || c.waitAt || c.browse || c.listenTo || c.onCall) continue;
      if ((c.glanceUntil || 0) > now || (c.ambT || 0) > now || !c.fig || !c.fig.j) continue;
      if (c.fig.lookAt && c.fig.lookAt !== c._look) continue;
      const dx0 = c.pos.x - cam.x;
      const dz0 = c.pos.z - cam.z;
      if (dx0 * dx0 + dz0 * dz0 > 900) continue;
      const m = minds ? minds.of(c) : null;
      const curious = m ? m.curious : 0.5;
      const timid = m ? m.bold < 0.3 : false;
      // (the next look a while off: sooner for the curious, much later with the phone at the ear)
      c.ambT = now + (2.2 + Math.random() * 3.5) * (1.4 - curious * 0.7) * (c.fig.carry === 'phone' ? 2.5 : 1);
      const f = c.fig.forward;
      let best = null;
      let bs = 0.25;
      let who = null;
      const consider = (p, s, o) => {
        // (in front of them or to the side - nobody looks back over their shoulder at nothing)
        const ox = p.x - c.pos.x;
        const oz = p.z - c.pos.z;
        const d = Math.hypot(ox, oz) || 1;
        const ahead = (ox * f.x + oz * f.z) / d;
        if (ahead < -0.1) return;
        const sc = s * (0.6 + 0.4 * ahead) * (0.7 + Math.random() * 0.6);
        if (sc > bs) {
          bs = sc;
          best = p;
          who = o || null;
        }
      };
      // the people round them (not you - that is game/voices.js and game/minds.js - nor the friend at
      // their side, who they are talking with)
      if (G) {
        const cx = Math.floor(c.pos.x / 2);
        const cz = Math.floor(c.pos.z / 2);
        for (let i = -3; i <= 3; i++) {
          for (let j = -3; j <= 3; j++) {
            const a = G.get((cx + i) * 4096 + cz + j);
            if (!a) continue;
            for (const o of a) {
              if (o === c || o === pl || o === c.buddy || o === c.buddyOf || !o.fig || !o.fig.j || o.headless) continue;
              const d = Math.hypot(o.pos.x - c.pos.x, o.pos.z - c.pos.z);
              if (d < 1.2 || d > 7) continue;
              let s = 0.45 * (1 - d / 9);
              // (coming this way: the look people give the one they are about to pass)
              if (o.vel && o.vel.x * f.x + o.vel.z * f.z < -0.4) s += 0.3;
              if (o.role === 'kid' || o.fig.look.kid) s += 0.25;
              if (o.dog) s += 0.3;
              if (o.talkUntil > now) s += 0.2;
              if (o.panicT > 0) s += 0.6;
              if (o.jog) s += 0.15;
              consider(o.fig.j.headC, s, o);
            }
          }
        }
      }
      // the musician, playing
      if (busker && busker.c && busker.c.alive && busker.c.fig && busker.c.fig.j) {
        const d = Math.hypot(busker.c.pos.x - c.pos.x, busker.c.pos.z - c.pos.z);
        if (d < 14 && d > 1.5) consider(busker.c.fig.j.headC, 0.7 * (1 - d / 16) + curious * 0.3);
      }
      // a car going by fast, or a horn
      if (cars) {
        for (let i = 0; i < cars.length; i++) {
          const v = cars[i];
          const d = Math.hypot(v.pos.x - c.pos.x, v.pos.z - c.pos.z);
          if (d > 16 || d < 2) continue;
          const sp = Math.abs(v.speed || 0);
          // (only one that draws the eye: its horn going, or tearing past - not every car going by)
          if ((v.hornT || 0) > 0 || (v.horn || 0) > 0 || sp > 13) {
            const p = c._carLook || (c._carLook = new THREE.Vector3());
            consider(p.set(v.pos.x, (v.pos.y || 0) + 0.9, v.pos.z), 0.6 * (1 - d / 20));
          }
        }
      }
      if (!best) continue;
      const look = (timid ? 0.5 : 0.8) + Math.random() * (0.6 + curious * 1.2);
      c.glanceAt = best;
      c.glanceUntil = now + look;
      this.stats.looked = (this.stats.looked || 0) + 1;
      // (and the eyes meet, now and then: the other one looks back - a moment, then each away)
      if (who && who.alive && !who.scripted && !who.convo && !(who.glanceUntil > now) && !(who.panicT > 0) && Math.random() < 0.3 && who.fig.forward.x * (c.pos.x - who.pos.x) + who.fig.forward.z * (c.pos.z - who.pos.z) > 0) {
        who.glanceAt = c.fig.j.headC;
        who.glanceUntil = now + 0.5 + Math.random() * 0.7;
        who.ambT = now + 3;
        this.stats.eyes = (this.stats.eyes || 0) + 1;
      }
    }
  }

  // a scripted person for a shop or a street scene; owner is told when it is gone
  // (v5, ROADMAP 11.18) who is where, in cells of 2 m, for the walkers to keep out of each other's
  // way (the player too: people step round you)
  buildGrid() {
    const G = this.grid || (this.grid = new Map());
    for (const a of G.values()) a.length = 0;
    const add = (o) => {
      const k = Math.floor(o.pos.x / 2) * 4096 + Math.floor(o.pos.z / 2);
      let a = G.get(k);
      if (!a) G.set(k, (a = []));
      a.push(o);
    };
    for (const c of this.list) if (!c.inside && c.dying < 0) add(c);
    const p = this.game.player;
    if (p && p.mode === 'foot') add(p);
  }

  // (critic round) How far it is to walk to g - a place on a block's sidewalk, the door they are going
  // to - from each corner round it: along the sidewalks and over the crossings (each costs its wait at
  // the light), the shorter way round every block (the walking distance, as a person reckons it, not
  // the distance as the crow flies). A few dozen corners, once for everybody going there: kept with
  // the place a while (blocks are built as you come near, and their crossings with them). Null where
  // the place is on no block's walk
  routeField(g) {
    const now = this.game.time;
    const old = g._route;
    if (old && now - old.t < 12) return old.ok ? old : null;
    const F = { t: now, ok: false, dist: new Map(), col: 0, row: 0, s: 0, per: 0 };
    g._route = F;
    const ml = this.game.world.mainland;
    const live = ml && ml.blocks;
    let gb = null;
    let gd = 4.6;
    for (const w of walksNear(g, 4.6)) {
      if (w[0] < 0 || w[2] >= gd) continue;
      if (w[0] >= 100 && live && !live.has(mainBlock(w[0], w[1]).id)) continue;
      gd = w[2];
      gb = w;
    }
    if (!gb) return null;
    F.col = gb[0];
    F.row = gb[1];
    const GL = sidewalkLoop(F.col, F.row);
    if (GL.length !== 4) return null;
    const ga = arcOf(GL, g.x, g.z);
    F.s = ga.s;
    F.per = ga.per;
    // (Dijkstra from the place outwards: the four corners of its block first, each the shorter way
    // round to it)
    const open = [];
    const dist = F.dist;
    const put = (col, row, k, d) => {
      const key = cornerKey(col, row, k);
      const was = dist.get(key);
      if (was !== undefined && was <= d) return;
      dist.set(key, d);
      open.push({ col, row, k, d, key });
    };
    let s = 0;
    for (let i = 0; i < 4; i++) {
      const fw = (F.s - s + F.per) % F.per;
      put(F.col, F.row, i, Math.min(fw, F.per - fw));
      s += arcFrom(GL, i, 1);
    }
    const done = new Set();
    for (let guard = 0; guard < 600 && open.length; guard++) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].d < open[bi].d) bi = i;
      const q = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (done.has(q.key) || dist.get(q.key) < q.d) continue;
      done.add(q.key);
      const L = sidewalkLoop(q.col, q.row);
      const p = L[q.k];
      // (far enough: nobody going there walks from further off)
      if (Math.abs(p[0] - g.x) > 240 || Math.abs(p[1] - g.z) > 240) continue;
      put(q.col, q.row, (q.k + 1) % 4, q.d + arcFrom(L, q.k, 1));
      put(q.col, q.row, (q.k + 3) % 4, q.d + arcFrom(L, q.k, -1));
      for (const o of crossesFrom(this.game, q.col, q.row, q.k)) {
        if (o[0] < 0) continue;
        const r = sidewalkLoop(o[0], o[1])[o[2]];
        put(o[0], o[1], o[2], q.d + Math.hypot(r[0] - p[0], r[1] - p[1]) + CROSS_WAIT);
      }
    }
    F.ok = true;
    return F;
  }

  // (intelligence round) the cars near you - in the traffic, parked, yours - for the walkers' feelers
  // (Civilian.blocked): the walls do not know them, and without them a car stopped across the crossing
  // or parked up on the curb is walked into and slid along
  carsNear(p) {
    const out = this.cars || (this.cars = []);
    out.length = 0;
    const game = this.game;
    const T = game.traffic && game.traffic.list;
    if (T) {
      for (let i = 0; i < T.length; i++) {
        const v = T[i];
        if (v.poofT !== undefined || !v.halfLen) continue;
        if (Math.abs(v.pos.x - p.x) < 90 && Math.abs(v.pos.z - p.z) < 90) out.push(v);
      }
    }
    const V = game.vehicles && game.vehicles.list;
    if (V) {
      for (let i = 0; i < V.length; i++) {
        const v = V[i];
        if (v.dead || (v.flies && v.alt > 2) || !v.halfLen) continue;
        if (Math.abs(v.pos.x - p.x) < 90 && Math.abs(v.pos.z - p.z) < 90) out.push(v);
      }
    }
  }

  // where a walker heading for (tx, tz) actually goes: a step to the side of the one coming the
  // other way (to the right, as people do), slower behind one in the way; never through anybody
  steer(c, tx, tz, out) {
    out.x = tx;
    out.z = tz;
    out.k = 1;
    const G = this.grid;
    if (!G) return out;
    let dx = tx - c.pos.x;
    let dz = tz - c.pos.z;
    const l = Math.hypot(dx, dz);
    if (l < 1e-3) return out;
    dx /= l;
    dz /= l;
    const rx = dz;
    const rz = -dx;
    let side = 0;
    let slow = 1;
    let you = false;
    // (critic round) people standing in the way - a group talking, somebody on the phone: round
    // them on the side where there is room, further out; squeezing past ("Excuse me") where there is
    // none, rather than pushing against them on the spot
    let stand = 0;
    const now = this.game.time;
    const squeeze = c.squeezeT > now;
    const pl = this.game.player;
    const cx = Math.floor(c.pos.x / 2);
    const cz = Math.floor(c.pos.z / 2);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const a = G.get((cx + i) * 4096 + cz + j);
        if (!a) continue;
        for (const o of a) {
          if (o === c || o === c.buddy || o === c.buddyOf) continue;
          const ox = o.pos.x - c.pos.x;
          const oz = o.pos.z - c.pos.z;
          const d = Math.hypot(ox, oz);
          if (d > 2.2 || d < 1e-4) continue;
          const still = o !== pl && (!o.vel || o.vel.x * o.vel.x + o.vel.z * o.vel.z < 0.09);
          // (too close: apart - not while squeezing past people standing)
          if (d < 0.62 && !c.noCollide && !(squeeze && still)) {
            const push = (0.62 - d) * 0.5;
            c.pos.x -= (ox / d) * push;
            c.pos.z -= (oz / d) * push;
          }
          const ahead = (ox * dx + oz * dz) / d;
          if (ahead < 0.35) continue;
          const lat = ox * rx + oz * rz;
          if (o === pl && d < 1.3 && ahead > 0.6 && Math.abs(lat) < 0.55) you = true;
          if (squeeze && still) continue;
          if (still && d < 1.5 && Math.abs(lat) < 0.8) stand++;
          // (coming this way, or standing: round them; going the same way and slower: behind them)
          const ov = o.vel ? o.vel.x * dx + o.vel.z * dz : 0;
          const w = (2.2 - d) / 2.2;
          if (ov > 0.6 && Math.abs(lat) < 0.5 && d < 1.3) slow = Math.min(slow, 0.55);
          else side += (lat > 0.12 ? -1 : 1) * w;
        }
      }
    }
    out.k = slow;
    out.wait = false;
    if (side) {
      // (not round on the side of the wall, the shop fronts, the planters - no way past there: the
      // other side; looked at now and then, not every frame)
      if (!(c.sideAt > now)) {
        c.sideAt = now + 0.35;
        c.sideWall = (c.blocked(rx, rz, 1.0) ? 1 : 0) | (c.blocked(-rx, -rz, 1.0) ? 2 : 0);
      }
      let sg = side > 0 ? 1 : -1;
      const wall = c.sideWall || 0;
      const bad = sg > 0 ? wall & 1 : wall & 2;
      const other = sg > 0 ? wall & 2 : wall & 1;
      if (bad && !other) sg = -sg;
      else if (bad && other && stand) {
        // (nowhere round them: a moment, a word, and through - sideways, close)
        c.standT = (c.standT || 0) + 1 / 30;
        if (c.standT > 0.8) {
          c.standT = 0;
          c.squeezeT = now + 2.2;
          this.stats.squeezed = (this.stats.squeezed || 0) + 1;
          // (a word now and then - most squeeze past without one, and nobody says it twice running)
          if (this.game.voices && Math.random() < 0.3 && !(c.squeezeSaidT > now)) {
            c.squeezeSaidT = now + 30;
            this.game.voices.say(c, ['Excuse me.', 'Sorry, just squeezing past.', 'Pardon me.', 'Coming through, sorry.', 'Sorry - sorry.', 'May I?'][Math.floor(Math.random() * 6)], 'plain');
          }
        }
        out.x = c.pos.x + dx * 0.3;
        out.z = c.pos.z + dz * 0.3;
        out.k = 0.2;
        return out;
      }
      const s = Math.min(1, Math.abs(side)) * (stand ? 1.35 : 0.9) * sg;
      out.x = c.pos.x + dx * 2 + rx * s;
      out.z = c.pos.z + dz * 2 + rz * s;
    }
    if (squeeze) out.k = Math.min(out.k, 0.55);
    // (intelligence round) you standing in their way where there is no room round you - a stall on
    // one side, the wall on the other: they stop and wait ("Excuse me": game/voices.js) rather than
    // walk on the spot into you (Civilian.update: and you staying there, back the other way)
    if (you && c.blocked(rx, rz, 0.9) && c.blocked(-rx, -rz, 0.9)) {
      out.x = c.pos.x + dx * 0.3;
      out.z = c.pos.z + dz * 0.3;
      out.k = 0;
      out.wait = true;
    }
    return out;
  }

  // (v5, ROADMAP 11.18) a shop's window near somebody walking past it: now and then they stop and
  // look in (more often at the clothes, the shoes, the phones; never at a closed one)
  windowStop(c) {
    const shops = this.game.world.shops;
    if (!shops || !shops.length || c.prom) return false;
    const R = this.game.rhythm;
    let best = null;
    let bd = 4.5;
    for (const s of shops) {
      if (!s.door || s.stand || s.home || s.nx === undefined) continue;
      const dx = c.pos.x - s.door[0];
      const dz = c.pos.z - s.door[2];
      if (Math.abs(dx) > 6 || Math.abs(dz) > 6) continue;
      // (in front of it, on the sidewalk)
      const out = dx * s.nx + dz * s.nz;
      if (out < 0.4 || out > 4.5) continue;
      const d = Math.hypot(dx, dz);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    if (!best || (R && !R.open(best.kind)) || best.shut) return false;
    const keen = WINDOW_KEEN[best.kind] || 0.25;
    if (Math.random() > keen) return false;
    const rx = best.rx !== undefined ? best.rx : -best.nz;
    const rz = best.rz !== undefined ? best.rz : best.nx;
    const side = Math.random() < 0.5 ? -1 : 1;
    const along = side * (1.5 + Math.random() * 1.2);
    c.browse = {
      x: best.door[0] + rx * along + best.nx * 0.85,
      z: best.door[2] + rz * along + best.nz * 0.85,
      yaw: Math.atan2(-best.nx, -best.nz),
      t: 3 + Math.random() * 6,
      seed: Math.random() * 6,
      say: Math.random() < 0.5 ? 1.5 + Math.random() * 2 : 0,
    };
    return true;
  }

  spawnScripted(x, z, look, owner, figOpts = null) {
    const [bx, bz] = this.nearestBlock(x, z);
    const c = new Civilian(this, bx, bz, look, figOpts);
    c.pos.set(x, groundHeight(x, z), z);
    c.scripted = true;
    c.owner = owner;
    // (a store up on a floor of the mega mall: its people stand on that floor - game/streetlife.js)
    if (owner && owner.lift) {
      c.baseY = owner.lift;
      c.pos.y += owner.lift;
    }
    c.speed = 1.25;
    this.list.push(c);
    return c;
  }

  // hand a scripted person back to the city: from now on they just walk their block
  release(c) {
    if (!c) return;
    c.ctrl = null;
    c.owner = null;
    c.faceYaw = null;
    c.hopY = 0;
    c.fig.reachR = null;
    c.fig.reachL = null;
    c.fig.lookAt = null;
    c.fig.sit = 0;
    c.fig.dance = 0;
    c.fig.armsUp = 0;
    c.noCollide = false;
    c.baseY = 0;
    if (c.inside) {
      c.inside = false;
      c.fig.setVisible(true);
    }
    // (GTA IV pass: the hands down, the head free, out of a group, off the curb's place)
    c.talkUntil = 0;
    c.gest = null;
    c.listenTo = null;
    c.glanceAt = null;
    c.glanceUntil = 0;
    c._look = null;
    c.huddle = null;
    c.onCall = false;
    c.still = false;
    this.leaveCurb(c);
  }

  // somebody let go where they stand (a bench, a shop's door, the bus): on along the side of the
  // block they are on, not across it to wherever their walk last pointed
  rejoin(c) {
    if (!c || c.prom) return;
    const L = c.loop;
    const n = L.length;
    let leg = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      const a = L[i];
      const b = L[(i + 1) % n];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((c.pos.x - a[0]) * dx + (c.pos.z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
      const d = Math.hypot(a[0] + dx * t - c.pos.x, a[1] + dz * t - c.pos.z);
      if (d < bd) {
        bd = d;
        leg = i;
      }
    }
    c.target = c.dir > 0 ? (leg + 1) % n : leg;
    c.crossing = false;
    // (critic round: somewhere to be - the next shop of their errands, home: that way, the short way)
    if (c.goal) c.headFor(c.goal);
  }

  remove(c) {
    if (!c) return;
    const i = this.list.indexOf(c);
    if (i >= 0) this.list.splice(i, 1);
    // (their place at the curb free again; and gone, for whoever still knows them - the friend
    // posing for their picture, the others of their group looking at them, game/streetsocial.js)
    this.leaveCurb(c);
    c.gone = true;
    c.dispose();
  }

  // the block whose sidewalk loop passes nearest (x, z) (or the promenade)
  nearestBlock(x, z) {
    if (x > 12) return ['prom', z];
    let best = [0, 0];
    let bd = Infinity;
    // (v5, ROADMAP 11.17: the mainland's built blocks too)
    const ml = this.game.world.mainland;
    const cand = walksNear({ x, z }, 160, ml && ml.blocks ? new Set(ml.blocks.keys()) : null);
    if (!cand.length) for (let col = -1; col < 3; col++) for (let row = 0; row < 5; row++) cand.push([col, row]);
    for (const [col, row] of cand) {
      {
        const L = sidewalkLoop(col, row);
        for (let i = 0; i < L.length; i++) {
          const a = L[i];
          const b = L[(i + 1) % L.length];
          const dx = b[0] - a[0];
          const dz = b[1] - a[1];
          const l2 = dx * dx + dz * dz || 1;
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
          const d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
          if (d < bd) {
            bd = d;
            best = [col, row];
          }
        }
      }
    }
    return best;
  }

  // a walker nobody has a use for (the far crowd may take them over: game/farcrowd.js)
  plain(c) {
    // (critic round: nor somebody on their way to meet a friend - a phone call, a chat, the musician
    // took them, and the friend waited for nobody: game/streetsocial.js date)
    if (c.scripted || c.ctrl || c.owner || !c.alive || c.headless || c.panicT > 0 || c.inside || c.dog || c.buddy || c.buddyOf || c.crossing || c.photo || c.exitRoom || c.huddle || c.onCall || c.goingHome || c.meet || c.pose || c.dateOf) return false;
    // (ROADMAP 13.12: nor somebody in the middle of a reaction, or just over a fright - game/brain.js)
    if (this.game.brain && this.game.brain.busy(c)) return false;
    const P = c.fig.parts;
    return P.legL > 0.5 && P.legR > 0.5 && P.armL > 0.5 && P.armR > 0.5 && P.torso > 0.5;
  }

  // one of the far crowd coming near (game/farcrowd.js): a whole person, the same look, step and
  // way, if the street near you has room for one more
  fromFar(w) {
    const R = this.game.rhythm;
    const max = Math.round((this.game.touch ? 18 : 40) * (R ? R.people : 1));
    const social = this.game.crowds && this.game.crowds.social;
    let free = 0;
    for (const c of this.list) if (!c.scripted || (social && c.owner === social)) free++;
    if (free >= max) return null;
    const c = new Civilian(this, w.prom ? 'prom' : w.col, w.prom ? w.z : w.row, w.look);
    c.loop = w.loop;
    const n = w.loop.length;
    c.dir = w.dir;
    c.target = n === 2 ? (w.dir > 0 ? 1 : 0) : w.dir > 0 ? (w.leg + 1) % n : w.leg;
    c.pos.set(w.x, w.y, w.z);
    c.yaw = w.yaw;
    c.fig.yaw = w.yaw;
    c.fig.phase = w.phase;
    c.speed = w.speed;
    // (dressed for who they are; no friend popping up beside them out of thin air)
    if (this.game.crowds && w.look.role) this.game.crowds.dress(c, false);
    this.list.push(c);
    return c;
  }

  // somebody who just got out of a car at (x, z): walks the sidewalk of the nearest block
  spawnAt(x, z, look) {
    const [bx, bz] = this.nearestBlock(x, z);
    const c = new Civilian(this, bx, bz, look);
    c.pos.set(x, groundHeight(x, z), z);
    this.list.push(c);
    return c;
  }

  // ------------------------------------------------------------------ getting hit
  segmentHit(ox, oy, oz, dx, dy, dz, maxT) {
    let best = null;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return null;
    const ro = _ro.set(ox, oy, oz);
    const rd = _rd.set(dx / len, dy / len, dz / len);
    const len2 = dx * dx + dz * dz;
    for (const c of this.list) {
      if (!c.alive || c.inside) continue;
      let t = len2 > 1e-8 ? ((c.pos.x - ox) * dx + (c.pos.z - oz) * dz) / len2 : 0;
      t = Math.max(0, Math.min(maxT, t));
      if (Math.hypot(ox + dx * t - c.pos.x, oz + dz * t - c.pos.z) > 1.2) continue;
      const h = c.fig.raycast(ro, rd, maxT * len);
      if (h && (!best || h.t / len < best.t)) best = { t: h.t / len, civ: c, part: h.part, point: h.point };
    }
    return best;
  }

  inArc(pos, fwd, range, halfAngle) {
    const out = [];
    for (const c of this.list) {
      if (!c.alive || c.inside) continue;
      const dx = c.pos.x - pos.x;
      const dz = c.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range + 0.4) continue;
      const a = Math.acos(Math.max(-1, Math.min(1, (dx * fwd.x + dz * fwd.z) / (d || 1))));
      if (a < halfAngle || d < 0.8) out.push(c);
    }
    return out;
  }

  damage(c, point, kind, amount) {
    if (!c.alive) return;
    const game = this.game;
    const fig = c.fig;
    const res = fig.erase(point, holeRadius(kind, amount));
    game.fx.crumbs(point.x, point.y, point.z, 8, 2.5);
    game.audio.play('erase', 0.5);
    if (!this.panic(c.pos, 30, 'hurt', { victim: c, by: 'player', src: game.player.pos, armed: true })) c.panicT = c.brave ? 0 : 8;
    if (game.onCivilianHurt) game.onCivilianHurt(c);
    if (!res) return;
    const part = res.part;
    if (fig.parts[part] > 0.5 && fig.erased[part] >= REMOVE_AT[part]) {
      fig.removePart(part);
      const j = fig.j;
      const at = part === 'head' ? j.headC : fig.center;
      game.fx.crumbs(at.x, at.y, at.z, 22, 3.2);
      game.fx.smoke(at.x, at.y, at.z, 0.6);
      game.audio.play('erase', 1);
      if (part === 'torso') {
        this.kill(c, 'split');
        return;
      }
    }
    let lost = 0;
    for (const k of ['head', 'torso', 'armL', 'armR', 'legL', 'legR']) lost += fig.parts[k] < 0.5 ? 0.5 : fig.erased[k] * 0.5;
    if (lost >= 1.4 || (c.headless && fig.erased.torso > 0.25)) this.kill(c);
  }

  // (ROADMAP 5.4, not with ?classic: game/fists.js) a punch or a kick: no ink rubbed out - they
  // reel back, a kick (or enough of it) puts them down, more leaves them out cold a while; up
  // again, they run. Somebody busy (at work, at a table) only reels. Returns 'hit', 'down' or 'ko'
  struck(c, s, dir, power = 1) {
    if (!c.alive) return null;
    const game = this.game;
    const fig = c.fig;
    game.hud.hitMarker();
    fig.recoil = 1;
    fig.recoilSide = s.limb === 'L' ? 1 : s.limb === 'R' ? -1 : 0;
    c.daze += s.dmg * power;
    c.reelT = 0.7;
    if (!this.panic(c.pos, 30, 'assault', { victim: c, by: 'player', src: game.player.pos })) c.panicT = c.brave ? 0 : 8;
    c.fearX = game.player.pos.x;
    c.fearZ = game.player.pos.z;
    if (game.onCivilianHurt) game.onCivilianHurt(c);
    if (Math.random() < 0.45 && game.bubbles) game.bubbles.say(c, STRUCK_LINES[Math.floor(Math.random() * STRUCK_LINES.length)], 'alarm');
    const free = !c.scripted && !c.ctrl && !c.riding && !c.noCollide && fig.sit < 0.3;
    // shoved back a step (knocked down or out: slid along the ground, Civilian.updateDown)
    const k = s.push * (free ? 1 : 0.4);
    c.vel.x += dir.x * k;
    c.vel.z += dir.z * k;
    if (!free) return 'hit';
    if (c.downT <= 0 && c.upT <= 0) c.yaw = Math.atan2(-dir.x, -dir.z);
    const slide = () => c.dodgeV.set(dir.x * s.push * 0.7, 0, dir.z * s.push * 0.7);
    if (c.daze >= 60 && !c.ko) {
      c.ko = true;
      c.downT = CIV_KO;
      c.upT = 0;
      slide();
      if (!c.criminal) game.onCrime('koCiv', c.pos.x, c.pos.z);
      return 'ko';
    }
    if (s.down || c.daze >= 40) {
      c.downT = Math.max(c.downT, 1.6 + Math.random() * 0.6);
      c.upT = 0;
      slide();
      return 'down';
    }
    return 'hit';
  }

  explosion(x, y, z, radius) {
    const at = new THREE.Vector3();
    const R = this.game.ragdolls;
    for (const c of this.list) {
      if (!c.alive || c.inside) continue;
      const d = Math.hypot(c.pos.x - x, c.pos.y + 1 - y, c.pos.z - z);
      if (d > radius) continue;
      const f = 1 - d / radius;
      const n = 2 + Math.round(f * 3);
      for (let i = 0; i < n && c.alive; i++) {
        c.fig.ensureShapes();
        const s = c.fig.shapes[Math.floor(Math.random() * c.fig.shapes.length)];
        if (!s) break;
        at.set(x, y, z).lerp(s.c, 0.92);
        c.fig.closestSurfacePoint(at, at);
        this.damage(c, at, 'blast', 60 + 140 * f);
      }
      // (not with ?classic: thrown by it, ROADMAP 5.5)
      if (R && f > 0.3 && this.throwable(c)) {
        R.blast(c, x, z, f);
        if (!c.alive) c.ragKill = true;
      }
    }
  }

  // (ROADMAP 5.5) who can be thrown about: not one riding along, inside, held in a scene
  throwable(c) {
    return !c.riding && !c.inside && !c.noCollide && !(c.brave && !c.criminal) && c.fig.sit < 0.3;
  }

  // (ROADMAP 5.5, not with ?classic: game/ragdoll.js) the hero's car at speed, and somebody right at
  // its bumper with no time to jump clear: thrown over the bonnet. Fast, for good; slower, hurt,
  // and up and running after
  runOver(v) {
    const game = this.game;
    const sp = Math.abs(v.speed);
    const sg = Math.sign(v.speed) || 1;
    const fx = Math.sin(v.yaw) * sg;
    const fz = Math.cos(v.yaw) * sg;
    for (const c of this.list) {
      if (!c.alive || c.fig.rag || !this.throwable(c)) continue;
      const dx = c.pos.x - v.pos.x;
      const dz = c.pos.z - v.pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along < 0 || along > v.halfLen + 0.35 || side > v.halfWid + 0.3) continue;
      game.ragdolls.carHit(c, v, v.speed);
      game.fx.sprite('fx_crash', c.pos.x, c.pos.y + 1, c.pos.z, { size: 1.4, life: 0.3 });
      game.audio.play('crash', 0.5);
      if (v.kind === 'car' || v.kind === 'bike') v.hurt(3);
      if (!this.panic(c.pos, 30, 'crash', { victim: c, by: 'player', src: v.pos })) c.panicT = 8;
      c.fearX = v.pos.x;
      c.fearZ = v.pos.z;
      if (sp > 15) {
        c.ragKill = true;
        this.kill(c);
      } else if (game.onCivilianHurt) game.onCivilianHurt(c);
    }
  }

  kill(c, how) {
    if (!c.alive) return;
    c.dying = 0;
    // (out of a getting-up or a lying-down of a fist fight: ROADMAP 5.4)
    c.downT = 0;
    c.upT = 0;
    if (how === 'split') {
      c.fig.split = 0;
      c.fig.splitDir = Math.random() < 0.5 ? 1 : -1;
      c.fig.parts.torso = 0;
      c.fig.speed = Math.max(c.fig.speed, 1.5);
    }
    this.game.fx.crumbs(c.pos.x, c.pos.y + 1, c.pos.z, 26, 3.2);
    if (this.game.onCivilianKilled) this.game.onCivilianKilled(c);
  }

  // kind: what it was (game/brain.js EVENTS); o: { by, victim, src (who did it), armed }. Returns
  // true when the city's people take it in each their own way (ROADMAP 13.10), false the old way
  panic(pos, radius, kind = null, o = {}) {
    // (the cats and the birds round there are off too; the drivers react: ROADMAP 4.4)
    if (!this.game.classic && this.game.animals) this.game.animals.scare(pos, radius);
    if (!this.game.classic && this.game.traffic) this.game.traffic.scare(pos, radius);
    // (ROADMAP 13.10) not everybody near running at once, as ants do: each who sees or hears it, in
    // their own time and way - game/brain.js
    const B = this.game.brain;
    if (B && !this.game.classic) {
      B.event(kind || (radius >= 55 ? 'blast' : radius >= 25 ? 'shot' : radius >= 10 ? 'glass' : 'crash'), pos.x, pos.z, o);
      return true;
    }
    for (const c of this.list) {
      if (c.inside) continue;
      // (the friend you drew stays by your side)
      if (c.brave) continue;
      if (Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) < radius) {
        if (c.panicT <= 0 && Math.random() < 0.3) this.game.fx.mark('fx_alert', c.pos.x, c.pos.y + 2.4, c.pos.z, 0.6, 0.8);
        c.panicT = 6 + Math.random() * 3;
        c.fearX = pos.x;
        c.fearZ = pos.z;
      }
    }
    return false;
  }

  dodge(pos, f, halfLen, halfWid, speed) {
    if (Math.abs(speed) < 2) return;
    for (const c of this.list) {
      // (not the one riding in it)
      if (c.riding) continue;
      const dx = c.pos.x - pos.x;
      const dz = c.pos.z - pos.z;
      const along = dx * f.x + dz * f.z;
      const side = dx * f.z - dz * f.x;
      if (along > -halfLen && along < halfLen + Math.abs(speed) * 0.5 && Math.abs(side) < halfWid + 0.6) {
        const s = Math.sign(side) || 1;
        c.dodgeV.set(f.z * s * 7, 0, -f.x * s * 7);
        c.panicT = 4;
        c.fearX = pos.x;
        c.fearZ = pos.z;
        // ("Slow down!": game/voices.js)
        if (!this.game.classic) this.game.voices.dodged(c);
      }
    }
  }

  draw(camPos) {
    const bodies = this.game.figures.bodies;
    const cam = this.game.camera;
    // (ROADMAP 11.47) drawn only if they are in the picture, or their shadow is: the camera's own
    // view, each of them a ball round them stretched along their shadow - the lower the sun, the
    // longer it falls. Before, everybody in more than half the circle round the camera was worked
    // out, in a picture that shows less than a third of it
    cam.updateMatrixWorld();
    _pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    _fr.setFromProjectionMatrix(_pv);
    const sun = shared.uSunDir.value;
    const flat = Math.hypot(sun.x, sun.z) || 1;
    const shadow = sun.y > 0.08 ? Math.min(14, (1.9 * flat) / sun.y) : 14;
    const ox = (-sun.x / flat) * shadow * 0.5;
    const oz = (-sun.z / flat) * shadow * 0.5;
    _sp.radius = 1.4 + shadow * 0.5;
    // (and whoever is seen in the mirror: the water's, a mall's polished floor - someone up on a
    // gallery over the picture's top edge, there in the floor)
    const pipe = this.game.pipe;
    const mirror = pipe && pipe.reflections && shared.uReflOn.value > 0.5;
    const my = mirror ? (pipe.floorY !== null && pipe.floorY !== undefined ? pipe.floorY : pipe.mirrorY) : 0;
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.inside) continue;
      const dx = c.pos.x - camPos.x;
      const dz = c.pos.z - camPos.z;
      const d = Math.hypot(dx, dz);
      _sp.center.set(c.pos.x + ox, c.pos.y + 0.9, c.pos.z + oz);
      let seen = d < 130 && (d < 6 || _fr.intersectsSphere(_sp));
      if (!seen && mirror && d < 130) {
        _sp.center.set(c.pos.x, 2 * my - c.pos.y - 0.9, c.pos.z);
        seen = _fr.intersectsSphere(_sp);
      }
      c.fig.setVisible(seen);
      if (!seen) continue;
      c.fig.draw(camPos);
      if (c.dog && d < 90) drawDog(bodies, c.dog);
      // (out cold: ROADMAP 5.4)
      if (c.ko && c.downT > 0) drawStars(this.game, c.fig.j.headC, this.game.time, Math.min(1, c.downT * 2, (CIV_KO - c.downT) * 2), i);
    }
    // (the street musician's open case and its coins: game/streetsocial.js)
    const S = this.game.crowds && this.game.crowds.social;
    if (S) S.draw(this.game.figures);
  }

  // ------------------------------------------------------------------ in the rain
  // Once it rains, everyone out walking decides once what to do about it: open an umbrella (if a
  // hand is free), hurry, or wait under a shop's awning nearby; a few just walk on. When it
  // stops, the umbrellas close one by one and the waiting come out again.
  rainCheck() {
    const game = this.game;
    const rain = game.weather ? game.weather.cur.rain : 0;
    const raining = this.raining ? rain > 0.12 : rain > 0.22;
    if (!raining && !this.raining) return;
    this.raining = raining;
    for (const c of this.list) {
      if (c.scripted || !c.alive || c.headless || c.inside) continue;
      if (!raining) {
        if (c.rainMood === 'umbrella' && c.fig.carry === 'umbrella' && Math.random() < 0.25) {
          c.fig.carry = null;
          c.rainMood = null;
        } else if (c.rainMood && c.rainMood !== 'umbrella') {
          c.rush = 1;
          c.rainMood = null;
        }
        continue;
      }
      if (c.rainMood || c.ctrl || c.panicT > 0) continue;
      const r = Math.random();
      if (c.jog) c.rainMood = 'brave';
      else if (!c.fig.carry && r < 0.55) {
        c.rainMood = 'umbrella';
        c.fig.carry = 'umbrella';
        c.fig.umbrellaColor = UMBRELLAS[Math.floor(Math.random() * UMBRELLAS.length)];
      } else if (r < 0.75 && !c.dog && !c.buddy && !c.buddyOf && this.shelter(c)) c.rainMood = 'shelter';
      else if (r < 0.93) {
        c.rainMood = 'hurry';
        c.rush = 1.45 + Math.random() * 0.3;
      } else c.rainMood = 'brave';
    }
  }

  // somewhere dry to wait: under the awning of a shop front on this side of the street
  shelter(c) {
    const shops = this.game.world.shops || [];
    let best = null;
    let bd = 26;
    for (const s of shops) {
      if (!s.room || s.stand) continue;
      const dx = c.pos.x - s.door[0];
      const dz = c.pos.z - s.door[2];
      // (in front of that shop front, not behind its building)
      if (dx * s.nx + dz * s.nz < -0.2) continue;
      if (Math.abs(dx) > bd || Math.abs(dz) > bd) continue;
      if (!s.shelter) {
        // four places to stand, either side of the door, under the canvas
        s.shelter = [-2.4, -1.5, 1.5, 2.4].map((u) => ({ x: s.door[0] + s.rx * u - s.nx * 0.45, z: s.door[2] + s.rz * u - s.nz * 0.45, yaw: s.face, by: null }));
      }
      for (const sp of s.shelter) {
        if (sp.by && !sp.by.gone && sp.by.alive && sp.by.shelterAt === sp) continue;
        const d = Math.hypot(sp.x - c.pos.x, sp.z - c.pos.z);
        if (d < bd) {
          bd = d;
          best = sp;
        }
      }
    }
    if (!best) return false;
    const sp = best;
    sp.by = c;
    c.shelterAt = sp;
    c.ctrl = (me) => {
      const rain = this.game.weather ? this.game.weather.cur.rain : 0;
      if (rain < 0.12) {
        // dry again: back to the walk
        me.ctrl = null;
        me.faceYaw = null;
        me.shelterAt = null;
        sp.by = null;
        return null;
      }
      if (Math.hypot(sp.x - me.pos.x, sp.z - me.pos.z) < 0.3) {
        // under the awning, looking out at the rain
        me.faceYaw = sp.yaw;
        return null;
      }
      return { x: sp.x, z: sp.z, speed: me.speed * 1.6 };
    };
    return true;
  }

  // ------------------------------------------------------------------ the life of the sidewalk
  // A new face on the street is somebody: out walking the dog, jogging, on the phone, back from
  // the shops with a bag, with a coffee, or two friends walking and talking.
  dressUp(c) {
    const r = Math.random();
    // (on the way to work, a coffee or a bag in hand)
    const m = this.game.rhythm ? this.game.rhythm.commute : 0;
    if (c.jog) return;
    c.jog = false;
    // (GTA IV pass) lunch in hand at midday, on the way back to the desk; the shopping on the way
    // home in the afternoon and the evening, a bag in each hand now and then
    const h = this.game.daynight ? this.game.daynight.hour : 12;
    const lunch = h > 11.4 && h < 14.6 ? 1 : 0;
    const shops = h > 10 && h < 21 ? 1 : 0.3;
    if (r < 0.08) {
      c.dog = newDog(c.pos.x + 1, c.pos.z);
      c.dog.y = c.pos.y;
      c.fig.carryL = 'leash';
      c.fig.leashTo = new THREE.Vector3();
      c.speed = 1.05;
    } else if (r < 0.18) {
      c.fig.carry = 'phone';
      c.speed = 0.95 + Math.random() * 0.3;
      c.chatty = true;
    } else if (r < 0.33 + 0.17 * m) {
      c.fig.carry = 'coffee';
    } else if (r < 0.42 + 0.25 * m) {
      c.fig.carry = 'bag';
    } else if (r < 0.42 + 0.25 * m + 0.13 * lunch) {
      c.fig.carry = LUNCH[Math.floor(Math.random() * LUNCH.length)];
    } else if (r < 0.42 + 0.25 * m + 0.13 * lunch + 0.12 * shops) {
      c.fig.carryL = 'shopBag';
      c.fig.shopBagColor = BAG_COLORS[Math.floor(Math.random() * BAG_COLORS.length)];
      if (Math.random() < 0.4) c.fig.carry = 'shopBag';
      c.shopping = true;
      c.speed = Math.min(c.speed, 1.15 + Math.random() * 0.2);
    }
  }

  // a friend walking alongside c (and stopping with them to talk). o.look: who (anybody); o.couple:
  // the two hand in hand, closer (in the evening most of the pairs out are couples)
  addBuddy(c, o = {}) {
    if (c.prom || c.loop.length < 4) return null;
    const b = new Civilian(this, c.col, c.row, o.look || null);
    b.pos.set(c.pos.x + 0.8, c.pos.y, c.pos.z);
    b.scripted = false;
    b.buddyOf = c;
    c.chatty = true;
    c.buddy = b;
    const h = this.game.daynight ? this.game.daynight.hour : 12;
    const couple = o.couple !== undefined ? o.couple : Math.random() < (h > 18.5 || h < 2 ? 0.55 : 0.2);
    if (couple) b.couple = true;
    b.ctrl = this.follower(b, couple);
    this.list.push(b);
    return b;
  }

  // walking alongside their friend (b.buddyOf): beside them, a word now and then; turned to each other
  // when they stop. couple: hand in hand, closer
  follower(b, couple) {
    const gap = couple ? 0.58 : 0.85;
    const lines = ['No way!', 'Ha ha ha!', 'Seriously?', 'I know, right?', 'Let\'s get pizza.', 'Did you see that?', 'Tell me more!'];
    let talkT = 2 + Math.random() * 4;
    const follow = (me, dt) => {
      const L = me.buddyOf;
      if (!L || !L.alive || L.gone || L.panicT > 0) {
        if (L && me.fig.reachL === L.fig.j.handR) me.fig.reachL = null;
        // (in the middle of a pose for the camera: the hands down - not a peace sign held up all
        // the way down the street)
        this.endPose(me);
        me.ctrl = null;
        // (ROADMAP 13.12) the other one ran from something: apart only until it is over - then they
        // find each other again (Civilians.regroup); gone for good, on their own
        if (L && L.alive && !L.gone) me.regroup = follow;
        else me.buddyOf = null;
        return null;
      }
      // (GTA IV pass: in the picture - game/crowds.js startPhoto: over to the place, turned to the
      // camera, a pose: a peace sign by the face, a wave, the arms out, a hand on the hip)
      const P = me.pose;
      if (P) {
        if (me.fig.reachL === L.fig.j.handR) me.fig.reachL = null;
        if (!P.at && Math.hypot(P.x - me.pos.x, P.z - me.pos.z) > 0.3) return { x: P.x, z: P.z, speed: 1.5 };
        P.at = true;
        me.faceYaw = Math.atan2(L.pos.x - me.pos.x, L.pos.z - me.pos.z);
        const fg = me.fig;
        const t = this.game.time;
        if (P.kind === 'peace') fg.toWorld(0.2, 1.66, 0.12, P.hand);
        else if (P.kind === 'wave') fg.toWorld(0.3 + Math.sin(t * 9) * 0.08, 1.8, 0.1, P.hand);
        else if (P.kind === 'arms') {
          fg.toWorld(0.62, 1.42, 0.08, P.hand);
          fg.toWorld(-0.62, 1.42, 0.08, P.hand2);
        } else {
          fg.toWorld(0.25, 0.98, -0.02, P.hand);
          fg.toWorld(-0.25, 0.98, -0.02, P.hand2);
        }
        if (!fg.reachR || fg.reachR === P.hand) fg.reachR = P.hand;
        if ((P.kind === 'arms' || P.kind === 'hip') && (!fg.reachL || fg.reachL === P.hand2)) fg.reachL = P.hand2;
        return null;
      }
      const f = L.fig.forward;
      const side = L.fig.right;
      const tx = L.pos.x + side.x * gap - f.x * 0.1;
      const tz = L.pos.z + side.z * gap - f.z * 0.1;
      const d = Math.hypot(tx - me.pos.x, tz - me.pos.z);
      const lsp = Math.hypot(L.vel.x, L.vel.z);
      // (hand in hand: her left in his right, walking)
      if (couple) {
        // (the hands free for it: not round a coffee, not with the shopping bag)
        const hold = d < 0.6 && lsp > 0.3 && !me.talkUntil && L.fig.parts.armR > 0.5 && !L.fig.carry && !me.fig.carryL;
        if (hold) me.fig.reachL = L.fig.j.handR;
        else if (me.fig.reachL === L.fig.j.handR) me.fig.reachL = null;
      }
      talkT -= dt;
      if (talkT < 0) {
        talkT = 3 + Math.random() * 5;
        const p = this.game.player.pos;
        const who = Math.random() < 0.5 ? me : L;
        if (Math.hypot(who.pos.x - p.x, who.pos.z - p.z) < 18) {
          // (and the other one answers: game/voices.js)
          if (!this.game.classic) {
            if (this.game.voices.chat([who, who === me ? L : me])) talkT += 6;
          } else this.game.bubbles.say(who, lines[Math.floor(Math.random() * lines.length)]);
        }
      }
      if (lsp < 0.2 && d < 1.4) {
        // stopped: turned to each other, talking
        me.faceYaw = Math.atan2(L.pos.x - me.pos.x, L.pos.z - me.pos.z);
        return null;
      }
      return { x: tx, z: tz, speed: Math.min(4, lsp + d * 1.2) };
    };
    return follow;
  }

  // (intelligence round) two of the street's own, on together from here: b alongside c, as a friend out
  // with them is (a friend met on purpose: game/streetsocial.js date)
  pairUp(c, b, couple = false) {
    if (c.buddy || c.buddyOf || b.buddy || b.buddyOf || c.prom || !c.loop || c.loop.length < 4) return false;
    b.buddyOf = c;
    c.buddy = b;
    c.chatty = true;
    if (couple) b.couple = true;
    b.ctrl = this.follower(b, couple);
    return true;
  }

  // (ROADMAP 13.12) c, parted from the friend they were out with when the friend ran: once neither
  // is running, hiding or down any more, back to the friend's side (and on together); the friend
  // gone, on alone
  regroup(c) {
    const L = c.buddyOf;
    if (!L || !L.alive || L.gone || L.buddy !== c) {
      c.regroup = null;
      c.buddyOf = null;
      return;
    }
    if (L.panicT > 0 || L.coverT > 0 || L.cowerT > 0 || L.downT > 0 || c.ctrl) return;
    c.ctrl = c.regroup;
    c.regroup = null;
    c.via = null;
  }

  // the picture taken: the friend out of the pose, back alongside
  endPose(b) {
    const P = b && b.pose;
    if (!P) return;
    b.pose = null;
    if (b.fig.reachR === P.hand) b.fig.reachR = null;
    if (b.fig.reachL === P.hand2) b.fig.reachL = null;
  }

  walkDog(c, dt) {
    const dog = c.dog;
    const f = c.fig.forward;
    const rt = c.fig.right;
    const moving = Math.hypot(c.vel.x, c.vel.z) > 0.25;
    // trotting a little ahead and to the side; sniffing about when they stop
    const tx = c.pos.x + (moving ? f.x * 1.3 : f.x * 0.9) + rt.x * 0.45;
    const tz = c.pos.z + (moving ? f.z * 1.3 : f.z * 0.9) + rt.z * 0.45;
    steerDog(dog, tx, tz, c.panicT > 0 ? 6 : Math.max(1.4, Math.hypot(c.vel.x, c.vel.z) + 0.5), dt);
    dog.y = groundHeight(dog.x, dog.z);
    if (c.fig.leashTo) dogCollar(dog, c.fig.leashTo);
  }
}

export { AVES, STREETS };
