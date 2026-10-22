import { readItem, CATS, CAT_ORDER } from './partnet.js';
import { rotorLift, takeoffOf, WING_TOP } from './fusedraw.js';
import { lookOf } from './itemlook.js';
import { designOf, variantOf, DESIGNED } from './itemdesign.js';
import { gunOf } from './partsum.js';
import { INKS } from './freeform.js';
import { clamp } from '../core/util.js';

// (ROADMAP 11.25) The part pen: a category said, a thing drawn - the game knows which of them.
//
// The pen out in the car, a row of three: a weapon, something it can do, protection. Over it, what
// the chosen one has, each drawn the way it is drawn. The line stays on the screen under the finger,
// wherever it is drawn; as it is drawn the game says which of them it is (game/partnet.js) - its name
// and its number by the pen ("cannon · damage 154"), it lights in the legend, and its place on the
// car lights up. The pen at rest (or ✓), the ink flies to that place and is the thing. None of them:
// it says so, and nothing goes on. Each category keeps the last one made: three buttons by the
// steering (1-3 on a computer) put it on in a moment, and take it off again.
//
// (ROADMAP 11.26) The thing is the drawing: what it is read as says what it does, the lines say what
// it looks like - each point of the ink flies to its own place on the car, and that is the thing
// (game/itemlook.js), as big as it was drawn by the car on the screen.
//
// (ROADMAP 11.27) The drawing decides: what it is drawn as is what goes on - nothing to tap to make
// it another. Not sure between two when the pen rests: a tip by the drawing, the two as they are
// drawn and what tells them apart ("wheel = cannon · stock = machine gun"), a little longer to draw
// it in - then the likelier of them. Drawn wrong: ↶ or the eraser, and drawn again. And the thing is
// designed (game/itemdesign.js): a machine gun, a cannon, wings, a balloon as such a thing is made,
// its proportions, its parts, its colour, its hand as drawn - the ink flies to the car, straightens
// onto it, and fills.

export const PEN_CATS = CAT_ORDER;
// how long the pen rests before the drawing goes (ms): another line before that is more of it
export const PEN_REST = 1000;
export const PEN_REST_TOUCH = 1150;
// (ROADMAP 11.26) the two likeliest this near, the second at least this likely: not sure which
export const ASK_GAP = 0.3;
export const ASK_MIN = 0.2;
// none of them, but the likeliest this likely and none of them not much more: not sure either
const ASK_NONE = 0.3;
// (ROADMAP 11.27) not sure: the tip out this much longer (ms) before the likelier goes on
export const TIP_MS = 1500;
// (ROADMAP 11.27) a moment after one went on, the legend says how to put it right
const MADE_MS = 3200;
const CAT_NAME = { weapon: 'נשק', func: 'תנועה', armor: 'הגנה' };
const NONE_SAY = { weapon: 'לא זוהה נשק', func: 'לא זוהה אמצעי תנועה', armor: 'לא זוהה אמצעי הגנה' };
// (ROADMAP 11.27) what tells each thing from the others as it is drawn - the tip's word for it
const TELL = { cannon: 'גלגל = תותח', mg: 'קת = מקלע', flamer: 'להבה = להביור', bolt: 'זיגזג = ברק', blades: 'ידית = להבים', wing: 'נוצות = כנפיים', balloon: 'סל = כדור פורח', rotor: 'איקס = רוטור', prop: 'שלושה עלים = מדחף', jet: 'אש מאחור = סילון', spring: 'סליל = קפיץ', chute: 'חוטים = מצנח', armor: 'לוח = שריון', ram: 'חוד = איל ניגוח', star: 'חמישה קצוות = כוכב', smoke: 'ענן = עשן', spikes: 'שיניים = קוצים' };
const CAT_ICON = {
  weapon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 2 V8 M12 16 V22 M2 12 H8 M16 12 H22"/></svg>',
  func: '<svg viewBox="0 0 24 24"><path d="M12 13 L2 9 L3 12 L12 16 L21 12 L22 9 Z"/><circle cx="12" cy="6" r="2.5"/><path d="M12 8.5 V13"/></svg>',
  armor: '<svg viewBox="0 0 24 24"><path d="M12 2 L20 5 V11 C20 16 16.5 19.5 12 22 C7.5 19.5 4 16 4 11 V5 Z"/></svg>',
};
// each thing: its name, the part it is (game/fuse.js), where it goes on the car, its sound, and how
// it is drawn - the legend's picture
export const ITEMS = {
  cannon: { name: 'תותח', type: 'barrel', v: 'turret', at: 'roof', snd: 'clank', icon: '<rect x="4" y="5" width="15" height="6" rx="1" transform="rotate(-18 11 8)"/><circle cx="8" cy="16" r="4.5"/><circle cx="8" cy="16" r="1"/>' },
  mg: { name: 'מקלע', type: 'barrel', v: 'front', at: 'hood', snd: 'clank', icon: '<path d="M2 8 H20 L22 7 V10 H20 V11 H11 L9 15 H6 L7 11 H4 L2 13 Z"/>' },
  flamer: { name: 'להביור', type: 'jet', v: 'front', at: 'nose', snd: 'whoosh', icon: '<path d="M12 22 C6 22 5 17 7 13 C8 15 9 15 9.5 14 C9 10 11 6 13 2 C13 6 17 8 17.5 12 C18.5 11 18.5 9.5 18 8.5 C21 12 20 22 12 22 Z"/>' },
  bolt: { name: 'ברק', type: 'bolt', at: 'roof', snd: 'zap', icon: '<path d="M14 2 L6 13 H11 L9 22 L18 10 H13 Z"/>' },
  blades: { name: 'להבים', type: 'blade', v: 'side', at: 'sides', snd: 'clank', icon: '<path d="M12 2 L14.5 5 V15 H9.5 V5 Z M7 15 H17 M12 15 V21 M10.5 21 H13.5"/>' },
  wing: { name: 'כנפיים', type: 'wing', at: 'sides', snd: 'flap', icon: '<path d="M2 13 L19 6 L22 7.5 L21 10 L4 16 Z"/>' },
  balloon: { name: 'כדור פורח', type: 'balloon', at: 'above', snd: 'whoosh', icon: '<path d="M12 2 C17 2 20 5 20 9 C20 13 16 15 15 17 H9 C8 15 4 13 4 9 C4 5 7 2 12 2 Z"/><rect x="9" y="19" width="6" height="3.5"/><path d="M9 17 V19 M15 17 V19"/>' },
  rotor: { name: 'רוטור', type: 'rotor', at: 'roof', snd: 'whoosh', icon: '<path d="M3 4 L21 20 M21 4 L3 20"/><circle cx="12" cy="12" r="2"/>' },
  prop: { name: 'מדחף', type: 'float', v: 'prop', at: 'tail', snd: 'bounce', icon: '<circle cx="12" cy="12" r="2.2"/><path d="M12 10 C9 6 10 2 12 2 C14 2 15 6 12 10 Z M13.8 13 C18 12 21 15 20 17 C19 19 15 17 13.8 13 Z M10.2 13 C6 12 3 15 4 17 C5 19 9 17 10.2 13 Z"/>' },
  jet: { name: 'סילון', type: 'jet', v: 'back', at: 'tail', snd: 'whoosh', icon: '<path d="M12 22 C6 22 5 17 7 13 C8 15 9 15 9.5 14 C9 10 11 6 13 2 C13 6 17 8 17.5 12 C18.5 11 18.5 9.5 18 8.5 C21 12 20 22 12 22 Z"/>' },
  spring: { name: 'קפיץ', type: 'spring', at: 'under', snd: 'bounce', icon: '<path d="M5 21 H19 M12 21 C4 19 20 17 12 15 C4 13 20 11 12 9 C4 7 20 5 12 3"/>' },
  chute: { name: 'מצנח', type: 'chute', at: 'roof', snd: 'flap', icon: '<path d="M2 11 C2 3 22 3 22 11 C19 9.5 15 9.5 12 11 C9 9.5 5 9.5 2 11 Z M2 11 L12 21 L22 11 M12 11 V21"/>' },
  armor: { name: 'שריון', type: 'armor', at: 'body', snd: 'clank', icon: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12 H20 M12 4 V20"/>' },
  ram: { name: 'איל ניגוח', type: 'blade', v: 'ram', at: 'nose', snd: 'clank', icon: '<path d="M12 3 L21 20 H3 Z"/>' },
  star: { name: 'כוכב', type: 'star', at: 'roof', snd: 'magic', icon: '<path d="M12 2 L14.6 8.6 L21.5 9 L16.2 13.4 L17.9 20.4 L12 16.6 L6.1 20.4 L7.8 13.4 L2.5 9 L9.4 8.6 Z"/>' },
  smoke: { name: 'ענן עשן', type: 'smoke', at: 'tail', snd: 'whoosh', icon: '<path d="M6 19 H18 C21.5 19 22.5 14.5 19.5 13 C20.5 8.5 15.5 7 14 9.5 C13 5 6.5 5.5 7.5 10.5 C3 10.5 2 19 6 19 Z"/>' },
  spikes: { name: 'קוצים', type: 'spike', at: 'sides', snd: 'clank', icon: '<path d="M2 17 L5 7 L8 17 L11 7 L14 17 L17 7 L20 17 L22 11"/>' },
};
// (the star's power lasts; the city's car weighs this, about)
const STAR_T = 10;
const BOOK_KEY = 'scribble-city-v5-pen';
// the ink flying from the screen to its place; how often the drawing is read while drawn (ms)
const FLY_MS = 420;
const LIVE_MS = 90;
// (ROADMAP 11.27) a designed thing's moment: the ink lands (FLY_MS), straightens onto it, its missing
// parts dashed in (TIDY_MS) - then it fills (FILL_MS: game/fuse.js draw, its pop), the ink going
const TIDY_MS = 380;
const FILL_MS = 420;
// (strong enough to read on sand, on the sea, at night: a pale halo under a deep orange line - the
// row's lit button's colour)
const MOUNT_C = [1, 0.42, 0.04];
const HALO_C = [1, 1, 0.97];

const fmt = (x) => (Math.round(x * 10) / 10).toString();
const pct = (k) => `${Math.round(Math.min(k, 3) * 100)}%`;

// ------------------------------------------------------------------ what it is, by its size
// the drawing's size by the car on the screen (F.perPx: a metre there, in px): { L (its long side,
// m), S (its short side, m), w (across the screen), h (up it) }
export function sizeOf(strokes, F) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const L of strokes) {
    for (const [x, y] of L) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const k = F.perPx;
  const w = Math.max(1, x1 - x0) * k;
  const h = Math.max(1, y1 - y0) * k;
  return { L: Math.max(w, h), S: Math.min(w, h), w, h };
}

// a thing's numbers (game/fuse.js applyVeh reads them) from how big it was drawn (sizeOf)
export function nOf(id, z) {
  const { L, S } = z;
  switch (id) {
    case 'cannon': return { len: clamp(L * 0.7, 0.6, 2.4), r: clamp(0.11 + S * 0.04, 0.11, 0.24), thick: true };
    case 'mg': return { len: clamp(L * 0.6, 0.5, 2.2), r: clamp(0.04 + S * 0.02, 0.04, 0.1), thick: false };
    case 'flamer': case 'jet': return { len: clamp(L / 1.2, 0.5, 3) };
    case 'bolt': return { size: clamp(L / 1.4, 0.8, 2.5) };
    case 'blades': case 'ram': case 'spikes': return { len: clamp(L / 1.6, 0.4, 3) };
    // (ROADMAP 11.27: a wing out of the side as long as it was drawn, its chord its breadth - as
    // game/itemdesign.js designs it)
    case 'wing': return { span: clamp(L * 0.8, 0.7, 3), chord: clamp(S * 0.45, 0.32, 1.25) };
    case 'balloon': return { d: clamp(S * 1.05, 0.8, 6) };
    case 'rotor': return { span: clamp(L, 0.6, 9) };
    case 'prop': return { size: clamp(L, 0.4, 1.6) };
    case 'spring': return { coils: Math.round(clamp(3 + L * 1.5, 3, 9)), len: clamp(L * 0.5, 0.4, 1.5) };
    case 'chute': return { span: clamp(L, 2.4, 8) };
    case 'armor': return { cover: clamp((L * S) / 4, 0.3, 1) };
    case 'star': return { size: clamp(L, 0.7, 1.5) };
    default: return {};
  }
}

// (an old drawing kept with only its numbers and its little picture: about how long it was)
function sizeBack(id, n) {
  switch (id) {
    case 'cannon': return (n.len || 1.2) / 0.7;
    case 'mg': return (n.len || 1) / 0.6;
    case 'flamer': case 'jet': return (n.len || 1) * 1.2;
    case 'bolt': return (n.size || 1) * 1.4;
    case 'blades': case 'ram': case 'spikes': return (n.len || 1) * 1.6;
    case 'wing': return n.span || 1.6;
    case 'balloon': return (n.d || 1.6) * 1.4;
    case 'rotor': case 'chute': return n.span || 2.5;
    case 'prop': case 'star': return n.size || 1;
    case 'spring': return (n.len || 0.6) * 2;
    case 'armor': return Math.sqrt((n.cover || 0.5) * 4) * 1.2;
    default: return 1.2;
  }
}

// what it will do, by its numbers - as game/fuse.js applyVeh works it out: { text, ok }. top: the
// car's top speed
export function statOf(id, n, mass, top = 28) {
  switch (id) {
    case 'cannon': case 'mg': {
      const gun = gunOf({ r: n.r, len: n.len });
      return { text: `נזק ${gun.dmg} · טווח ${gun.range} מ׳`, ok: true };
    }
    case 'flamer': return { text: `טווח ${Math.round(clamp(6 + n.len * 4, 7, 18))} מ׳`, ok: true };
    case 'bolt': return { text: `טווח ${Math.round(clamp(9 + n.size * 2, 9, 14))} מ׳`, ok: true };
    case 'blades': return { text: `נזק ${Math.round(clamp(30 + n.len * 24, 30, 90))}`, ok: true };
    case 'wing': {
      // (ROADMAP 11.26: wings lift it off - as fast as that, for how big they are)
      const v0 = takeoffOf(n, mass);
      return v0 <= top * WING_TOP ? { text: `ממריאה ב־${Math.round(v0 * 3.6)} קמ״ש`, ok: true } : { text: 'קטנות מדי להמריא · גדולות יותר', ok: false };
    }
    case 'balloon': {
      const k = clamp((n.d ** 3 * 0.32) / mass, 0.1, 3);
      return k >= 1 ? { text: `הרמה ${pct(k)} ✓`, ok: true } : { text: `הרמה ${pct(k)} · גדול יותר`, ok: false };
    }
    case 'rotor': {
      const k = rotorLift(n, mass);
      return k >= 1 ? { text: `הרמה ${pct(k)} ✓`, ok: true } : { text: `הרמה ${pct(k)} · גדול יותר`, ok: false };
    }
    case 'prop': return { text: 'שטה במים · עד 14 מ׳/ש', ok: true };
    case 'jet': return { text: `כוח ×${fmt(clamp(0.85 + n.len * 0.32, 0.9, 1.9))}`, ok: true };
    case 'spring': return { text: `קפיצה ${fmt(clamp(6 + n.coils * 0.85 + n.len * 1.6, 7, 16) ** 2 / 40)} מ׳`, ok: true };
    case 'chute': return { text: 'בנפילה נפתח', ok: true };
    case 'armor': return { text: `סופג ${Math.round(clamp(0.25 + n.cover * 0.55, 0.25, 0.65) * 100)}% · כבד יותר`, ok: true };
    case 'ram': return { text: `הדיפה ×${fmt(clamp(1.6 + n.len * 0.6, 1.6, 3.4))}`, ok: true };
    case 'star': return { text: `${STAR_T} שניות בלי פגע`, ok: true };
    case 'smoke': return { text: '6 שניות עשן', ok: true };
    case 'spikes': return { text: 'ניידת שנצמדת — נהרסת', ok: true };
    default: return { text: '', ok: true };
  }
}

// where a thing goes on the car (ctx: game/fuse.js drawCtx), in its frame (x to its left, z to its
// nose): { at (where it holds), to: [the point(s) the ink flies to - a pair, both sides] }
export function mountOf(id, ctx) {
  const D = ctx.D;
  const K = ctx.K;
  const roof = K ? K.roofY : D.h;
  const clear = K ? K.clear : 0.25;
  const mid = clamp(roof * 0.55, 0.45, roof - 0.1);
  let at;
  switch (ITEMS[id].at) {
    case 'roof': at = [0, roof, 0]; break;
    case 'above': at = [0, roof + 1.5, 0]; break;
    case 'hood': at = [0, K && K.hood ? K.hood.y : D.h * 0.55, K && K.hood ? K.hood.z : D.hl * 0.6]; break;
    case 'nose': at = [0, clear + 0.3, D.hl + 0.05]; break;
    case 'tail': at = [0, Math.max(0.45, clear + 0.3), -D.hl - 0.05]; break;
    case 'under': at = [0, 0.15, 0]; break;
    case 'body': at = [D.hw, mid, 0]; break;
    default: at = [D.hw + 0.1, mid, -0.1];
  }
  const pair = ITEMS[id].at === 'sides' || ITEMS[id].at === 'body';
  return { at, to: pair ? [at, [-at[0], at[1], at[2]]] : [at] };
}

// ------------------------------------------------------------------ the drawing, kept
// (ROADMAP 11.26) the drawing as drawn, in metres by the car on the screen (x to the right, y up the
// screen), and which side of the car it was drawn on: { M, side } - what the thing is made of
export function drawnOf(strokes, F) {
  const k = F.perPx;
  let sx = 0;
  let n = 0;
  for (const L of strokes) {
    for (const [x] of L) {
      sx += x;
      n++;
    }
  }
  const side = sx / Math.max(1, n) >= F.box.cx ? 1 : -1;
  return { M: strokes.map((L) => L.map(([x, y]) => [x * k, -y * k])), side };
}

// (kept: about its middle, to the centimetre, 40 points a line at most)
function compact(d, flip) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const L of d.M) {
    for (const [x, y] of L) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const r = (x) => Math.round(x * 100) / 100;
  const M = d.M.map((L) => {
    const step = Math.max(1, Math.ceil(L.length / 40));
    const out = [];
    for (let i = 0; i < L.length; i += step) out.push([r(L[i][0] - cx), r(L[i][1] - cy)]);
    const e = L[L.length - 1];
    out.push([r(e[0] - cx), r(e[1] - cy)]);
    return out;
  });
  return { M, side: d.side, flip: flip || 0 };
}

// (one kept before 11.26, with only its little picture: that, as big as its numbers say it was)
function fromPic(it) {
  if (!it.pic || !it.pic.length) return null;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const L of it.pic) {
    for (const [x, y] of L) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const k = sizeBack(it.item, it.n || {}) / Math.max(1, x1 - x0, y1 - y0);
  return { M: it.pic.map((L) => L.map(([x, y]) => [(x - x0) * k, -(y - y0) * k])), side: 1 };
}

// the part itself (game/fuse.js), made of one of the things, its numbers and its drawing d ({ M, side,
// flip }: its look - none, the game's own): { part, L (game/itemlook.js lookOf: where each point of it
// went) }
export function itemPart(id, n, ctx, inkI, time, d = null) {
  const it = ITEMS[id];
  const has = d && d.M && d.M.length;
  // (ROADMAP 11.27: the machine gun, the cannon, wings, the balloon - designed from the drawing; the
  // rest its own lines, as drawn)
  const L = has ? (DESIGNED.has(id) && designOf(id, d.M, ctx, { side: d.side, flip: d.flip, ink: INKS[inkI], n })) || lookOf(id, d.M, ctx, { side: d.side, flip: d.flip }) : null;
  const part = { type: it.type, v: it.v, n: { ...n, ...((L && L.n) || {}) }, at: L ? L.at : mountOf(id, ctx).at.slice(), ink: inkI, t0: time, cost: 0, item: id, id: Math.random().toString(36).slice(2, 8) };
  if (L) part.shape = L.shape;
  if (id === 'star') part.until = time + STAR_T;
  if (id === 'prop') {
    // (the floats it rides on: as long as the car - a propeller makes a boat of it)
    part.n.len = clamp(ctx.D.hl * 2 * 0.86, 2, 6);
    part.n.w = 0.6;
  }
  return { part, L };
}

export function partOfItem(id, n, ctx, inkI, time, d = null) {
  return itemPart(id, n, ctx, inkI, time, d).part;
}

export class PartPen {
  constructor(fz) {
    this.fz = fz;
    this.game = fz.game;
    // the category the pen draws in now
    this.cat = 'func';
    this.isOpen = false;
    // the last of each category made: { weapon, func, armor, last } (the slots)
    this.book = this.loadBook();
    if (this.book.last && PEN_CATS.includes(this.book.last)) this.cat = this.book.last;
    // the ink flying to its place: { v, from (px lines), to (the car's frame, a point for each), side,
    // c, t0, part, ms } - and ink that was none of them, going: { from, c, t0 }
    this.flights = [];
    // what the drawing is now, read as it is drawn: { item, p, none, ranked, ask, n, text, ok } or null
    this.live = null;
    this.liveAt = 0;
    this.liveTip = null;
    this.uiSig = '';
    this.legSig = '';
    this.slotSig = '';
    this.tipSig = '';
    // (ROADMAP 11.27) the pen rested not sure which of two: the tip out by the drawing, a little longer
    this.tipping = false;
    // the one just made: { v, cat, item, read, part, d, z, inkI, P3, side, rt }
    this.made = null;
    // (ROADMAP 11.27) a designed thing taking shape: what the camera leans in on - { v, at, t0, ms }
    this.focus = null;
    // what was drawn and what it was: made, and of those not sure of (the tip out)
    this.tally = { made: 0, asked: 0 };
    // (the things whose use was told this time)
    this.told = new Set();
    this.ui();
    if (typeof window !== 'undefined') {
      // (on a computer, at the wheel: 1-3 the kept ones on or off - not the weapons)
      window.addEventListener('keydown', (e) => {
        if (e.repeat || !this.slotsShown) return;
        const m = /^(Digit|Numpad)([1-3])$/.exec(e.code);
        if (!m) return;
        this.game.input.pressed.delete(e.code);
        this.toggle(PEN_CATS[+m[2] - 1]);
      });
    }
  }

  // the part pen, or the pen as it was in 11.22 (?draw=old, or the settings): reading what is drawn
  active() {
    const g = this.game;
    if (g.params && g.params.get('draw') === 'old') return false;
    return !g.settings || g.settings.get('carPen') !== 'old';
  }

  // ------------------------------------------------------------------ the pen out, and away
  // (game/freedraw.js show) the row out; the category the world asks for (the mission's hint), or as
  // before
  open(cat = null) {
    this.isOpen = true;
    const H = this.game.mission && this.game.mission.hint;
    if (cat && PEN_CATS.includes(cat)) this.cat = cat;
    else if (H && H.cat && !this.book[H.cat]) this.cat = H.cat;
    this.live = null;
    this.made = null;
    this.tipping = false;
    this.showRow();
    this.showLegend();
    this.showLive();
  }

  close() {
    this.isOpen = false;
    this.live = null;
    this.made = null;
    this.tipping = false;
    this.showRow();
    this.showLegend();
    this.showLive();
  }

  // the category to draw in: tapped, or 1-3. The drawing still wet is read in it now
  pick(cat) {
    if (!PEN_CATS.includes(cat)) return;
    const changed = cat !== this.cat;
    this.cat = cat;
    this.book.last = cat;
    this.saveBook();
    this.made = null;
    this.tipping = false;
    this.game.audio.play('click', 0.4);
    const fd = this.game.freedraw;
    if (fd && fd.group.length) {
      // (more time to see what it is now)
      fd.groupAt = performance.now() + (this.game.touch ? PEN_REST_TOUCH : PEN_REST);
      if (changed) this.feel(fd.group.map((s) => s.P), null, true);
    }
    this.showRow();
    this.showLegend();
  }

  // ------------------------------------------------------------------ the drawing, read
  // the car you drive on the screen now: { v, t, F, ctx, mass, top } or null
  own() {
    const g = this.game;
    const v = g.player.inVehicle;
    if (!v || v.dead || typeof window === 'undefined') return null;
    const t = this.fz.vehTarget(v);
    const F = this.fz.frameOf(t);
    if (!F) return null;
    return { v, t, F, ctx: this.fz.drawCtx(v), mass: this.fz.vehMass(v), top: (v.handling && v.handling.top) || 28 };
  }

  // the drawing (lines of screen px) as one of the category's things: readItem's, and if it is one,
  // its numbers and what they do - or null (nothing drawn). ask: the two it could be, not sure which
  // (the likelier first)
  read(strokes, o, cat = this.cat) {
    const lines = strokes.filter((L) => L && L.length >= 2);
    if (!lines.length) return null;
    const r = readItem(lines, cat);
    const z = sizeOf(lines, o.F);
    const R = { ...r, cat, z, ask: null };
    const [a, b] = r.ranked;
    if (a && b) {
      if (r.item && b[1] >= ASK_MIN && a[1] - b[1] < ASK_GAP) R.ask = [a[0], b[0]];
      else if (!r.item && a[1] >= ASK_NONE && r.none - a[1] < ASK_GAP) R.ask = [a[0], b[0]];
    }
    if (!r.item) return R;
    const n = nOf(r.item, z);
    const st = statOf(r.item, n, o.mass, o.top);
    // (ROADMAP 11.27: drawn pointing up, a mortar; three barrels, a minigun; feathers - said as drawn)
    const vr = variantOf(r.item, lines);
    return { ...R, n, ...st, vname: vr ? vr.name : null, text: vr ? `${vr.say} · ${st.text}` : st.text };
  }

  // (game/freedraw.js, as it is drawn) the drawing so far: what it is, by the pen (tip: screen px,
  // null - over the drawing)
  feel(strokes, tip, now = false) {
    const t = performance.now();
    this.liveTip = tip || null;
    // (the tip out, and more drawn or a line taken back: read again - the pen rests again first)
    if (this.tipping && (tip || now)) {
      this.tipping = false;
      const fd = this.game.freedraw;
      if (!tip && fd && fd.group.length) fd.groupAt = t + (this.game.touch ? PEN_REST_TOUCH : PEN_REST);
      this.showTip();
    }
    if (!now && t - this.liveAt < LIVE_MS) {
      this.place(strokes);
      return;
    }
    this.liveAt = t;
    const o = this.own();
    this.live = o && strokes.length ? this.read(strokes, o) : null;
    this.showLive(strokes);
    this.showLegend();
  }

  // (game/freedraw.js, the pen rested) not sure which of two: the tip by the drawing, and a little longer
  // to draw in what tells them apart - true; else (or the tip out that long already) it is done now
  holds() {
    const fd = this.game.freedraw;
    const L = this.live;
    if (this.tipping || !L || !L.ask || !this.isOpen || !fd || fd.cur || !fd.group.length) return false;
    this.tipping = true;
    fd.groupAt = performance.now() + TIP_MS;
    this.showTip();
    return true;
  }

  // ------------------------------------------------------------------ made
  // (game/freedraw.js finishGroup) the drawing done: what it is, on the car - the ink flies there
  // first. None of the category's things: it says so, and the ink goes. strokes: lines of screen px,
  // inkI its ink. true if something went on
  make(strokes, inkI = 1) {
    const g = this.game;
    const fz = this.fz;
    this.tipping = false;
    this.showTip();
    this.live = null;
    this.showLive();
    this.showLegend();
    const o = this.own();
    const lines = strokes.filter((L) => L && L.length >= 2);
    if (!o || !lines.length) return false;
    const R = this.read(lines, o);
    if (!R) return false;
    // (ROADMAP 11.27: not sure of two - the likelier of them, the tip said what tells them apart; none
    // of them the likeliest - none, the tip said what would make it one)
    const item = R.item;
    if (!item) {
      this.flights.push({ v: null, from: lines.map((L) => L.map((q) => q.slice())), c: inkI, t0: performance.now() });
      g.audio.play('rubber', 0.5);
      g.hud.toast(`${NONE_SAY[R.cat]} — נסו כמו בציורים שמעל הכפתורים`, 'bad', 2.6);
      return false;
    }
    const v = o.v;
    const d = drawnOf(lines, o.F);
    const n = item === R.item ? R.n : nOf(item, R.z);
    const got = this.putOn(v, item, n, d, inkI, FLY_MS);
    if (!got) return false;
    const { part, L, res } = got;
    fz.stats.made++;
    fz.stats.byType[part.type] = (fz.stats.byType[part.type] || 0) + 1;
    fz.stats.onto.veh = (fz.stats.onto.veh || 0) + 1;
    fz.last = { kind: 'veh', ref: v, part, t: g.time, rt: performance.now(), alts: [], M: null };
    const side = this.fly(v, lines, L, inkI, part);
    this.keep(R.cat, part, compact(d, L ? L.flip : 0), lines);
    this.tally.made++;
    if (R.ask) this.tally.asked++;
    this.made = { v, cat: R.cat, item, read: R.item, part, d, z: R.z, inkI, P3: L ? L.P3 : null, side, rt: performance.now(), traits: (L && L.traits) || null };
    g.audio.play('magic', 0.4);
    // (ROADMAP 11.27: a designed one - what it does, said once it has taken shape, not over it)
    if (L && L.T3) setTimeout(() => this.tell(item, res), FLY_MS + TIDY_MS + FILL_MS);
    else this.tell(item, res);
    this.legSig = '';
    this.showLegend();
    return true;
  }

  // a thing made of drawing d on the car v - the one of its kind there before off: { part, L, res } or null
  putOn(v, item, n, d, inkI, pop) {
    const fz = this.fz;
    const { part, L } = itemPart(item, n, fz.drawCtx(v), inkI, this.game.time, d);
    fz.justAdded = part;
    // (ROADMAP 11.27: designed, flown to - it fills once its ink has straightened onto it)
    fz.popDelay = L && L.T3 && pop >= FLY_MS ? pop + TIDY_MS : pop;
    const res = fz.onVehicle(v, part);
    fz.justAdded = null;
    fz.popDelay = 0;
    return res ? { part, L, res } : null;
  }

  // (what it does and how - once of each: no tag by the car to draw over by mistake)
  tell(item, res) {
    if (this.told.has(item)) return;
    this.told.add(item);
    const say = [res.rule, res.use].filter(Boolean).join(' · ');
    if (say) this.game.hud.toast(`${ITEMS[item].name}: ${say}`, 'info', 3.4);
  }

  // (a pair: the ink to the side of the car nearer where it was drawn) 1 or -1
  sideFor(v, strokes, L) {
    if (!L || !L.mirror) return 1;
    let sx = 0;
    let sy = 0;
    let n = 0;
    let X = 0;
    let Y = 0;
    let Z = 0;
    for (let i = 0; i < strokes.length; i++) {
      for (let j = 0; j < strokes[i].length; j++) {
        sx += strokes[i][j][0];
        sy += strokes[i][j][1];
        X += L.P3[i][j][0];
        Y += L.P3[i][j][1];
        Z += L.P3[i][j][2];
        n++;
      }
    }
    const a = this.proj(v, X / n, Y / n, Z / n);
    const b = this.proj(v, -X / n, Y / n, Z / n);
    return a && b && Math.hypot(b.x - sx / n, b.y - sy / n) < Math.hypot(a.x - sx / n, a.y - sy / n) ? -1 : 1;
  }

  // the ink from the screen to its place on the car: each point to where it is on the thing (ROADMAP
  // 11.26) - a pair, to the side nearer the drawing, the other a little fainter. Returns that side
  fly(v, strokes, L, inkI, part) {
    const from = strokes.map((A) => A.map((q) => q.slice()));
    const t0 = performance.now();
    if (!L) {
      // (no drawing to go by: shrinking into its place)
      const M = mountOf(part.item, this.fz.drawCtx(v));
      M.to.forEach((to, i) => this.flights.push({ v, from, at: to, c: inkI, t0, part: i ? null : part, a: i ? 0.55 : 1 }));
      return 1;
    }
    const side = this.sideFor(v, strokes, L);
    // (ROADMAP 11.27: designed - then onto the thing, its added parts dashed in, and it fills; the
    // camera leans in on it the while - game/fuse.js sketchCam)
    const tidy = L.T3 ? { tidy: L.T3, fade: L.fade, dash: L.dash } : {};
    if (L.T3) this.focus = { v, at: L.focus ? L.focus.at : L.at, k: L.focus ? L.focus.k : 0.38, t0, ms: FLY_MS + TIDY_MS + FILL_MS + 600 };
    this.flights.push({ v, from, to: L.P3, side, c: inkI, t0, part, a: 1, ...tidy });
    if (L.mirror) this.flights.push({ v, from, to: L.P3, side: -side, c: inkI, t0, part: null, a: 0.55, ...tidy });
    return side;
  }

  // a point in a car's frame (x to its left, z to its nose), on the screen - { x, y } or null
  proj(v, x, y, z) {
    const c = Math.cos(v.yaw);
    const s = Math.sin(v.yaw);
    const y0 = (v.pos.y || 0) + ((v.fz && v.fz.lift) || 0) + (v.fzDip || 0);
    const q = this.fz.screen(v.pos.x + x * c + z * s, y0 + y, v.pos.z - x * s + z * c);
    return q.front ? q : null;
  }

  // landed: its own sound as it grows into its place - the car takes its weight
  landed(v, part) {
    const g = this.game;
    g.audio.play((ITEMS[part.item] && ITEMS[part.item].snd) || 'glue', 0.55);
    try {
      if (g.touch && navigator.vibrate) navigator.vibrate([14, 40, 24]);
    } catch (err) {
      // (no buzz: no matter)
    }
    v.fzDipT = performance.now();
    const [ax, ay, az] = part.at || [0, 1, 0];
    const c = Math.cos(v.yaw);
    const s = Math.sin(v.yaw);
    g.fx.sparks(v.pos.x + ax * c + az * s, (v.pos.y || 0) + ay, v.pos.z - ax * s + az * c, 8, [1, 0.86, 0.4]);
  }

  // ------------------------------------------------------------------ the slots
  // (a slot, 1-3) the category's kept thing on the car you drive - or off it, if it is on. Nothing
  // kept of it: the pen, to draw one
  toggle(cat) {
    const g = this.game;
    const fz = this.fz;
    const v = g.player.inVehicle;
    if (!v || v.dead || v.kind !== 'car') return false;
    const it = this.book[cat];
    if (!it) {
      if (g.freedraw && !g.freedraw.isOpen) {
        this.cat = cat;
        g.freedraw.show();
      }
      return false;
    }
    const on = v.fuse && v.fuse.parts.find((p) => p.item === it.item);
    if (on) {
      fz.removeVeh(v, on, true);
      if (fz.last && fz.last.part === on) fz.last = null;
      const [ax, ay, az] = on.at || [0, 1, 0];
      const c = Math.cos(v.yaw);
      const s = Math.sin(v.yaw);
      g.fx.crumbs(v.pos.x + ax * c + az * s, (v.pos.y || 0) + ay, v.pos.z - ax * s + az * c, 10, 1.8);
      g.audio.play('rubber', 0.45);
      this.slotSig = '';
      return true;
    }
    // (as it was drawn - one kept before its drawing was: from its little picture)
    const got = this.putOn(v, it.item, it.n, it.d || fromPic(it), it.ink, 120);
    if (!got) return false;
    this.landed(v, got.part);
    fz.last = { kind: 'veh', ref: v, part: got.part, t: g.time, rt: performance.now(), alts: [], M: null };
    this.slotSig = '';
    return true;
  }

  // ------------------------------------------------------------------ the sketchbook
  loadBook() {
    const out = { weapon: null, func: null, armor: null, last: null };
    try {
      const o = JSON.parse(localStorage.getItem(BOOK_KEY) || 'null');
      if (o && typeof o === 'object') {
        for (const c of PEN_CATS) if (o[c] && ITEMS[o[c].item]) out[c] = o[c];
        out.last = o.last || null;
      }
    } catch (err) {
      // (none kept)
    }
    return out;
  }

  saveBook() {
    try {
      localStorage.setItem(BOOK_KEY, JSON.stringify(this.book));
    } catch (err) {
      // (not kept: no matter)
    }
  }

  // the thing just made, kept as its category's - its drawing (d: compact's), and its look as drawn,
  // small (its slot's picture)
  keep(cat, part, d, strokes) {
    this.book[cat] = { item: part.item, n: part.n, ink: part.ink, pic: picOf(strokes), d };
    this.book.last = cat;
    this.saveBook();
    this.slotSig = '';
  }

  // ------------------------------------------------------------------ each frame
  update(rdt) {
    const g = this.game;
    const now = performance.now();
    // (the ink in flight, over everything)
    if (this.flights.length || this.flyDrawn) this.drawFlights(now);
    // (the car taking a new part's weight: down a little on its springs, and back)
    const v = g.player.inVehicle;
    if (v && v.fzDipT) {
      const t = (now - v.fzDipT) / 1000;
      if (t > 1.3) {
        v.fzDipT = 0;
        v.fzDip = 0;
      } else v.fzDip = t < 0 ? 0 : -0.09 * Math.exp(-4.2 * t) * Math.cos(t * 15);
    }
    const fd = g.freedraw;
    if (this.isOpen && !(fd && fd.isOpen && fd.carOpen)) this.close();
    if (this.isOpen) {
      // (the drawing waiting to go: the bar under its name runs down)
      if (this.liveEl && this.live && fd && fd.group.length && !fd.cur) {
        const len = this.tipping ? TIP_MS : g.touch ? PEN_REST_TOUCH : PEN_REST;
        const k = clamp((fd.groupAt - now) / len, 0, 1);
        this.dryEl.style.transform = `scaleX(${k.toFixed(3)})`;
      } else if (this.dryEl) this.dryEl.style.transform = 'scaleX(1)';
      // (the word on putting right the one just made, a moment)
      if (this.made && !this.made.old && now - this.made.rt > MADE_MS) {
        this.made.old = true;
        this.showLegend();
      }
      this.showRow();
    }
    this.showSlots();
  }

  drawFlights(now) {
    const cv = this.flyCv;
    if (!cv) return;
    const g = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(window.innerWidth * dpr);
    const H = Math.round(window.innerHeight * dpr);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    this.flyDrawn = false;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      const T1 = f.ms || FLY_MS;
      const el = now - f.t0;
      // (ROADMAP 11.27, a designed thing: it lands, straightens onto the thing, and as the thing fills
      // the ink goes)
      const all = f.tidy ? T1 + TIDY_MS + FILL_MS : T1;
      if (el >= all || (f.v && f.v.dead)) {
        this.flights.splice(i, 1);
        if (!f.tidy && f.v && !f.v.dead && f.part) this.landed(f.v, f.part);
        continue;
      }
      if (f.tidy && !f.popped && el >= T1 + TIDY_MS) {
        f.popped = true;
        if (f.v && !f.v.dead && f.part) this.landed(f.v, f.part);
      }
      const k = clamp(el / T1, 0, 1);
      const e = ease(k);
      const e2 = f.tidy ? ease(clamp((el - T1) / TIDY_MS, 0, 1)) : 0;
      const k3 = f.tidy ? clamp((el - T1 - TIDY_MS) / FILL_MS, 0, 1) : 0;
      const ink = INKS[f.c] || INKS[1];
      // (the drawing's middle and size - where it goes on the screen, and how small, without points to
      // go to; none of them: it crumbles where it was)
      let pt = null;
      if (!f.to) {
        let x0 = Infinity;
        let x1 = -Infinity;
        let y0 = Infinity;
        let y1 = -Infinity;
        for (const A of f.from) {
          for (const q of A) {
            x0 = Math.min(x0, q[0]);
            x1 = Math.max(x1, q[0]);
            y0 = Math.min(y0, q[1]);
            y1 = Math.max(y1, q[1]);
          }
        }
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        let tx = cx;
        let ty = cy + 40 * e;
        let s = 1 + 0.15 * e;
        if (f.v) {
          const q = this.proj(f.v, f.at[0], f.at[1], f.at[2]);
          tx = q ? q.x : cx;
          ty = q ? q.y : cy;
          s = 1 - 0.7 * e;
        }
        pt = (q) => [cx + (tx - cx) * e + (q[0] - cx) * s, cy + (ty - cy) * e + (q[1] - cy) * s];
      }
      const a0 = f.v ? (f.tidy ? 1 - k3 : k > 0.85 ? (1 - k) / 0.15 : 1) * (f.a ?? 1) : 1 - e;
      const halo = ink.css === '#f4efe4' ? 'rgba(40, 36, 48, 0.75)' : 'rgba(255, 252, 244, 0.85)';
      for (let a = 0; a < f.from.length; a++) {
        const A = f.from[a];
        const B = f.to ? f.to[a] : null;
        const T = f.tidy ? f.tidy[a] : null;
        g.globalAlpha = a0 * (f.fade && f.fade[a] ? 1 - e2 : 1);
        if (g.globalAlpha <= 0.01) continue;
        g.beginPath();
        for (let j = 0; j < A.length; j++) {
          let x;
          let y;
          if (B) {
            const q = this.proj(f.v, B[j][0] * f.side, B[j][1], B[j][2]);
            x = q ? A[j][0] + (q.x - A[j][0]) * e : A[j][0];
            y = q ? A[j][1] + (q.y - A[j][1]) * e : A[j][1];
            // (straightening onto the thing: each point to its own place on its lines)
            if (T && e2 > 0 && T[j]) {
              const r = this.proj(f.v, T[j][0] * f.side, T[j][1], T[j][2]);
              if (r) {
                x += (r.x - x) * e2;
                y += (r.y - y) * e2;
              }
            }
          } else [x, y] = pt(A[j]);
          if (j) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        const w = 4 * (1 - 0.35 * e) * (1 - 0.25 * e2);
        g.strokeStyle = halo;
        g.lineWidth = w + 3.4;
        g.stroke();
        g.strokeStyle = ink.css;
        g.lineWidth = w;
        g.stroke();
      }
      // (what it must have and was not drawn: dashed in as the ink straightens)
      if (f.dash && e2 > 0) {
        g.globalAlpha = e2 * (1 - k3) * (f.a ?? 1);
        g.setLineDash([7, 6]);
        g.lineDashOffset = -el / 40;
        for (const P of f.dash) {
          g.beginPath();
          let on = false;
          for (let j = 0; j < P.length; j++) {
            const q = this.proj(f.v, P[j][0] * f.side, P[j][1], P[j][2]);
            if (!q) continue;
            if (on) g.lineTo(q.x, q.y);
            else g.moveTo(q.x, q.y);
            on = true;
          }
          g.strokeStyle = halo;
          g.lineWidth = 4.6;
          g.stroke();
          g.strokeStyle = ink.css;
          g.lineWidth = 2.2;
          g.stroke();
        }
        g.setLineDash([]);
      }
      g.globalAlpha = 1;
      this.flyDrawn = true;
    }
  }

  // ------------------------------------------------------------------ drawn in the world
  // the place on the car of what the drawing is now, lit while the pen draws it
  draw(fr) {
    if (!this.isOpen || !this.live || !this.live.item) return;
    const g = this.game;
    const v = g.player.inVehicle;
    if (!v || v.dead) return;
    const now = performance.now();
    const f = frameOf(v);
    const a = 0.85 + 0.15 * Math.sin(now / 170);
    const w = 1 + 0.18 * Math.sin(now / 170);
    for (const [n, L] of mountLines(this.live.item, this.fz.drawCtx(v)).entries()) {
      runIn(fr, f, L, HALO_C, 16 * w, 9600 + n * 7, a * 0.8);
      runIn(fr, f, L, MOUNT_C, 9 * w, 9600 + n * 7, a);
    }
  }

  // ------------------------------------------------------------------ the page's own bits
  ui() {
    if (typeof document === 'undefined' || !document.body) return;
    const touch = !!this.game.touch;
    const row = document.createElement('div');
    row.className = 'pp-row';
    row.id = 'pp-row';
    row.innerHTML = `${PEN_CATS.map((c, i) => `<button class="pp-part" data-c="${c}" aria-label="${CAT_NAME[c]}">${CAT_ICON[c]}<b>${CAT_NAME[c]}</b>${touch ? '' : `<kbd>${i + 1}</kbd>`}</button>`).join('')}<button class="pp-ok" data-ok="1" aria-label="שימו על המכונית">✓</button>`;
    const act = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      if (b.dataset.ok) {
        const fd = this.game.freedraw;
        if (fd && fd.group.length && !fd.cur) fd.finishGroup();
      } else if (b.dataset.c) this.pick(b.dataset.c);
    };
    row.addEventListener('pointerdown', act);
    const stop = (el) => {
      for (const ev of ['mousedown', 'click', 'touchstart', 'contextmenu']) el.addEventListener(ev, (e) => e.stopPropagation());
    };
    stop(row);
    document.body.appendChild(row);
    // (what the category has, each as it is drawn - to see: ROADMAP 11.27, the drawing decides)
    const leg = document.createElement('div');
    leg.className = 'pp-legend';
    leg.id = 'pp-legend';
    document.body.appendChild(leg);
    const live = document.createElement('div');
    live.className = 'pp-live';
    live.id = 'pp-live';
    live.innerHTML = '<b></b><span></span><i></i>';
    document.body.appendChild(live);
    // (ROADMAP 11.27) not sure which of two: the tip - to see, not to tap
    const tipEl = document.createElement('div');
    tipEl.className = 'pp-tip';
    tipEl.id = 'pp-tip';
    document.body.appendChild(tipEl);
    const slots = document.createElement('div');
    slots.className = 'pp-slots';
    slots.id = 'pp-slots';
    slots.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button[data-c]');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      this.toggle(b.dataset.c);
    });
    stop(slots);
    document.body.appendChild(slots);
    const cv = document.createElement('canvas');
    cv.className = 'pp-fly';
    cv.id = 'pp-fly';
    document.body.appendChild(cv);
    this.rowEl = row;
    this.legEl = leg;
    this.liveEl = live;
    this.tipEl = tipEl;
    this.liveName = live.querySelector('b');
    this.liveText = live.querySelector('span');
    this.dryEl = live.querySelector('i');
    this.slotsEl = slots;
    this.flyCv = cv;
  }

  showRow() {
    const el = this.rowEl;
    if (!el) return;
    const fd = this.game.freedraw;
    const H = this.game.mission && this.game.mission.hint;
    const wet = !!(fd && fd.group.length);
    const sig = `${this.isOpen}|${this.cat}|${wet}|${H ? H.cat : ''}`;
    if (sig === this.uiSig) return;
    this.uiSig = sig;
    el.classList.toggle('on', this.isOpen);
    el.classList.toggle('wet', wet);
    for (const b of el.querySelectorAll('.pp-part')) {
      b.classList.toggle('on', b.dataset.c === this.cat);
      b.classList.toggle('hint', !!H && b.dataset.c === H.cat && b.dataset.c !== this.cat);
    }
  }

  // the category's things over the row, the one the drawing is now lit; just made, the one it went on
  // as - and a word on how to put it right (ROADMAP 11.27: drawn again, nothing to tap)
  showLegend() {
    const el = this.legEl;
    if (!el) return;
    const L = this.live;
    const M = this.made && !this.made.old ? this.made : null;
    const lit = L && L.item ? L.item : M ? M.item : '';
    const sig = `${this.isOpen}|${this.cat}|${lit}|${L && L.ask ? L.ask.join() : ''}|${M ? 1 : 0}`;
    if (sig === this.legSig) return;
    this.legSig = sig;
    el.classList.toggle('on', this.isOpen);
    if (!this.isOpen) return;
    const say = L && L.ask ? 'עוד פרט אחד יכריע' : M ? 'לא יצא נכון? ↶ ומציירים שוב' : 'מה שמציירים — זה מה שיוצא';
    const items = CATS[this.cat].map((id) => {
      const cls = ['pp-it', lit === id ? 'on' : '', L && L.ask && L.ask.includes(id) ? 'ask' : ''].filter(Boolean).join(' ');
      return `<div class="${cls}" data-i="${id}"><svg viewBox="0 0 24 24">${ITEMS[id].icon}</svg><b>${ITEMS[id].name}</b></div>`;
    }).join('');
    el.innerHTML = `<div class="pp-say${M ? ' fix' : ''}">${say}</div><div class="pp-its">${items}</div>`;
  }

  // its name and its number by the pen - or over the drawing, the pen up. Not sure: the likelier, and
  // that a little more of it decides
  showLive(strokes) {
    const el = this.liveEl;
    if (!el) return;
    const L = this.live;
    if (!L || !this.isOpen) {
      el.classList.remove('on');
      this.showTip();
      return;
    }
    if (L.ask) {
      this.liveName.textContent = `${ITEMS[L.ask[0]].name}?`;
      this.liveText.textContent = 'עוד פרט אחד יכריע';
      this.liveText.classList.add('bad');
    } else if (L.item) {
      this.liveName.textContent = L.vname || ITEMS[L.item].name;
      this.liveText.textContent = L.text;
      this.liveText.classList.toggle('bad', !L.ok);
    } else {
      this.liveName.textContent = '?';
      this.liveText.textContent = 'לא זוהה עדיין';
      this.liveText.classList.add('bad');
    }
    el.classList.toggle('none', !L.item || !!L.ask);
    el.classList.add('on');
    this.place(strokes);
    this.showTip();
  }

  // (ROADMAP 11.27) not sure of two, the pen rested: the two as they are drawn and what tells them
  // apart, by the drawing - to see, not to tap (a line begun on it draws)
  showTip() {
    const el = this.tipEl;
    if (!el) return;
    const fd = this.game.freedraw;
    const L = this.live;
    const two = this.tipping && L && L.ask && this.isOpen && fd && !fd.cur && fd.group.length ? L.ask : null;
    const sig = two ? two.join() : '';
    if (sig !== this.tipSig) {
      this.tipSig = sig;
      el.classList.toggle('on', !!two);
      if (two) el.innerHTML = `<div class="pp-tip-h">עוד פרט אחד יכריע</div><div class="pp-tip-two">${two.map((id) => `<span><svg viewBox="0 0 24 24">${ITEMS[id].icon}</svg>${TELL[id]}</span>`).join('<i>·</i>')}</div>`;
    }
    if (!two || !this.liveEl) return;
    const [x, y] = this.tipSpot(el.offsetWidth || 220, el.offsetHeight || 56, fd.group.map((s) => s.P));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  // where the tip goes (w x h px): by the drawing, never on it nor on its name - nothing of it hidden -
  // and off the pen's row and legend if it can be
  tipSpot(w, h, strokes) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const L of strokes) {
      for (const q of L) {
        x0 = Math.min(x0, q[0]);
        x1 = Math.max(x1, q[0]);
        y0 = Math.min(y0, q[1]);
        y1 = Math.max(y1, q[1]);
      }
    }
    const pad = 18;
    const r = this.liveEl.getBoundingClientRect();
    // [x0, y0, x1, y1, how bad on it]
    const keep = [[x0 - pad, y0 - pad, x1 + pad, y1 + pad, 4], [r.left, r.top, r.right, r.bottom, 2]];
    for (const e of [this.rowEl, this.legEl]) {
      const q = e ? e.getBoundingClientRect() : null;
      if (q && q.width && q.height) keep.push([q.left, q.top, q.right, q.bottom, 1]);
    }
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const top = Math.min(r.top, y0 - pad);
    const spots = [[cx - w / 2, top - h - 8], [x1 + pad, cy - h / 2], [x0 - pad - w, cy - h / 2], [cx - w / 2, y1 + pad]];
    let best = null;
    let bad = Infinity;
    for (const [sx, sy] of spots) {
      const x = clamp(sx, 8, W - w - 8);
      const y = clamp(sy, 8, H - h - 8);
      let n = 0;
      for (const [a, b, c, d, k] of keep) n += k * Math.max(0, Math.min(x + w, c) - Math.max(x, a)) * Math.max(0, Math.min(y + h, d) - Math.max(y, b));
      if (n < bad) {
        best = [x, y];
        bad = n;
      }
      if (!n) break;
    }
    return best;
  }

  place(strokes) {
    const el = this.liveEl;
    if (!el || !this.live) return;
    let x;
    let y;
    if (this.liveTip) {
      [x, y] = this.liveTip;
      y -= this.game.touch ? 84 : 58;
    } else if (strokes && strokes.length) {
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      for (const L of strokes) {
        for (const q of L) {
          x0 = Math.min(x0, q[0]);
          x1 = Math.max(x1, q[0]);
          y0 = Math.min(y0, q[1]);
        }
      }
      x = (x0 + x1) / 2;
      y = y0 - 52;
    } else return;
    const w = el.offsetWidth || 140;
    el.style.left = `${clamp(x - w / 2, 8, window.innerWidth - w - 8)}px`;
    el.style.top = `${clamp(y, 8, window.innerHeight - 60)}px`;
  }

  // the three kept things by the steering: at the wheel of a car, the pen away
  showSlots() {
    const el = this.slotsEl;
    if (!el) return;
    const g = this.game;
    const p = g.player;
    const v = p.inVehicle;
    const fd = g.freedraw;
    const shown = this.active() && !!v && !v.dead && v.kind === 'car' && p.mode === 'vehicle' && g.state === 'play' && !(fd && fd.isOpen) && !(g.dialog && g.dialog.open);
    this.slotsShown = shown;
    const H = g.mission && g.mission.hint;
    const on = shown && v.fuse ? PEN_CATS.map((c) => (this.book[c] && v.fuse.parts.some((q) => q.item === this.book[c].item) ? 1 : 0)).join('') : '';
    const sig = `${shown}|${on}|${H ? H.cat : ''}|${PEN_CATS.map((c) => (this.book[c] ? this.book[c].item : '')).join(',')}`;
    if (sig === this.slotSig) return;
    this.slotSig = sig;
    el.classList.toggle('on', shown);
    if (!shown) return;
    const touch = !!g.touch;
    el.innerHTML = PEN_CATS.map((c, i) => {
      const it = this.book[c];
      const name = it ? `${CAT_NAME[c]}: ${ITEMS[it.item].name}` : CAT_NAME[c];
      const cls = ['pp-slot', it ? '' : 'empty', on[i] === '1' ? 'on' : '', H && H.cat === c && on[i] !== '1' ? 'hint' : ''].filter(Boolean).join(' ');
      return `<button class="${cls}" data-c="${c}" aria-label="${name}" title="${name}${touch ? '' : ` (${i + 1})`}">${it && it.pic ? picSvg(it.pic, it.ink) : CAT_ICON[c]}${touch ? '' : `<kbd>${i + 1}</kbd>`}</button>`;
    }).join('');
  }
}

// ------------------------------------------------------------------ helpers
// a car of yours: from its frame to the world (x to its left, z to its nose)
function frameOf(v) {
  const c = Math.cos(v.yaw);
  const s = Math.sin(v.yaw);
  const y0 = (v.pos.y || 0) + ((v.fz && v.fz.lift) || 0) + (v.fzDip || 0);
  return { c, s, x: v.pos.x, y: y0, z: v.pos.z };
}

// a line in a car's frame, inked
function runIn(fr, f, pts, col, w, seed, a) {
  let px = 0;
  let py = 0;
  let pz = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, y, z] = pts[i];
    const wx = f.x + x * f.c + z * f.s;
    const wy = f.y + y;
    const wz = f.z - x * f.s + z * f.c;
    if (i) fr.lineXYZ(px, py, pz, wx, wy, wz, col, w, seed + i, a, 0.004, 0);
    px = wx;
    py = wy;
    pz = wz;
  }
}

function ring(cx, cy, cz, r, plane = 'y', n = 20) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (plane === 'y') out.push([cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r]);
    else out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz]);
  }
  return out;
}

// where the thing goes, lit on the car while it is drawn: lines in its frame
function mountLines(id, ctx) {
  const D = ctx.D;
  const M = mountOf(id, ctx);
  const [, y, z] = M.at;
  switch (ITEMS[id].at) {
    case 'roof': return [ring(0, y + 0.02, 0, 0.36), [[0, y + 0.02, -0.36], [0, y + 0.02, 0.36]]];
    case 'above': return [[[0, D.h, 0], [0, y - 0.55, 0]], ring(0, y, 0, 0.55)];
    case 'hood': return [[[-0.45, y + 0.04, z], [0.45, y + 0.04, z]], [[0, y + 0.04, z], [0, y + 0.04, z + 0.5]]];
    case 'nose': return [[[-D.hw * 0.9, y, z], [D.hw * 0.9, y, z]], [[-0.3, y, z + 0.1], [0, y, z + 0.45], [0.3, y, z + 0.1]]];
    case 'tail': return [ring(0, y, z, 0.3, 'z'), [[0, y, z], [0, y, z - 0.45]]];
    case 'under': return [ring(0, y, 0, 0.55)];
    case 'body': {
      const yy = y;
      return [[[D.hw + 0.04, yy, -D.hl * 0.8], [D.hw + 0.04, yy, D.hl * 0.8], [-D.hw - 0.04, yy, D.hl * 0.8], [-D.hw - 0.04, yy, -D.hl * 0.8], [D.hw + 0.04, yy, -D.hl * 0.8]]];
    }
    default: {
      const out = [];
      for (const sd of [1, -1]) {
        const xx = sd * (D.hw + 0.04);
        out.push([[xx, y, -D.hl * 0.45], [xx, y, D.hl * 0.35]]);
        for (const zz of [-D.hl * 0.3, 0, D.hl * 0.25]) out.push([[xx + sd * 0.25, y, zz + 0.13], [xx + sd * 0.48, y, zz], [xx + sd * 0.25, y, zz - 0.13]]);
      }
      return out;
    }
  }
}

// the drawing as drawn, small: its lines in a 40×28 box
function picOf(strokes) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const L of strokes) {
    for (const [x, y] of L) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const s = Math.min(34 / Math.max(1, x1 - x0), 22 / Math.max(1, y1 - y0));
  const ox = (40 - (x1 - x0) * s) / 2;
  const oy = (28 - (y1 - y0) * s) / 2;
  return strokes.map((L) => {
    const step = Math.max(1, Math.floor(L.length / 40));
    const out = [];
    for (let i = 0; i < L.length; i += step) out.push([Math.round((ox + (L[i][0] - x0) * s) * 10) / 10, Math.round((oy + (L[i][1] - y0) * s) * 10) / 10]);
    const e = L[L.length - 1];
    out.push([Math.round((ox + (e[0] - x0) * s) * 10) / 10, Math.round((oy + (e[1] - y0) * s) * 10) / 10]);
    return out;
  });
}

function picSvg(pic, inkI) {
  const ink = INKS[inkI] || INKS[1];
  const col = ink.pencil || ink.css === '#f4efe4' ? '#2a2a33' : ink.css;
  const paths = pic.map((L) => `<polyline points="${L.map(([x, y]) => `${x},${y}`).join(' ')}"/>`).join('');
  return `<svg viewBox="0 0 40 28" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}
