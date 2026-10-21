import { readItem, CATS, CAT_ORDER } from './partnet.js';
import { wingGlide, rotorLift } from './fusedraw.js';
import { gunOf } from './partsum.js';
import { INKS } from './freeform.js';
import { clamp } from '../core/util.js';

// (ROADMAP 11.25) The part pen: a category said, a thing drawn - the game knows which of them.
//
// The pen out in the car, a row of three: a weapon, something it can do, protection. Over it, what
// the chosen one has, each drawn the way it is drawn (to see, not to press). The line stays on the
// screen under the finger, wherever it is drawn; as it is drawn the game says which of them it is
// (game/partnet.js) - its name and its number by the pen ("cannon · damage 154"), it lights in the
// legend, and its place on the car lights up. The pen at rest (or ✓), the ink flies to that place
// and is the thing - the game's own, as big as it was drawn by the car on the screen. None of them:
// it says so, and nothing goes on. Each category keeps the last one made: three buttons by the
// steering (1-3 on a computer) put it on in a moment, and take it off again.

export const PEN_CATS = CAT_ORDER;
// how long the pen rests before the drawing goes (ms): another line before that is more of it
export const PEN_REST = 1000;
export const PEN_REST_TOUCH = 1150;
const CAT_NAME = { weapon: 'נשק', func: 'פונקציונלי', armor: 'מיגון' };
const NONE_SAY = { weapon: 'לא זוהה נשק', func: 'לא זוהה משהו פונקציונלי', armor: 'לא זוהה מיגון' };
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
// (strong enough to read on sand, on the sea, at night: a pale halo under a deep orange line - the
// row's lit button's colour)
const MOUNT_C = [1, 0.42, 0.04];
const HALO_C = [1, 1, 0.97];

const fmt = (x) => (Math.round(x * 10) / 10).toString();
const pct = (k) => `${Math.round(Math.min(k, 3) * 100)}%`;

// ------------------------------------------------------------------ what it is, by its size
// the drawing's size by the car on the screen (F.perPx: a metre there, in px): { L (its long side,
// m), S (its short side, m) }
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
  return { L: Math.max(w, h), S: Math.min(w, h) };
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
    case 'wing': return { span: clamp(L * 0.55, 0.7, 4), chord: clamp(S * 0.8, 0.35, 1.6) };
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

// what it will do, by its numbers - as game/fuse.js applyVeh works it out: { text, ok }
export function statOf(id, n, mass) {
  switch (id) {
    case 'cannon': case 'mg': {
      const gun = gunOf({ r: n.r, len: n.len });
      return { text: `נזק ${gun.dmg} · טווח ${gun.range} מ׳`, ok: true };
    }
    case 'flamer': return { text: `טווח ${Math.round(clamp(6 + n.len * 4, 7, 18))} מ׳`, ok: true };
    case 'bolt': return { text: `טווח ${Math.round(clamp(9 + n.size * 2, 9, 14))} מ׳`, ok: true };
    case 'blades': return { text: `נזק ${Math.round(clamp(30 + n.len * 24, 30, 90))}`, ok: true };
    case 'wing': return { text: `גלישה ×${fmt(1 / (1 - wingGlide(n)))}`, ok: true };
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

// the part itself (game/fuse.js), made of one of the things and its numbers
export function partOfItem(id, n, ctx, inkI, time) {
  const it = ITEMS[id];
  const M = mountOf(id, ctx);
  const part = { type: it.type, v: it.v, n: { ...n }, at: M.at.slice(), ink: inkI, t0: time, cost: 0, item: id, id: Math.random().toString(36).slice(2, 8) };
  if (id === 'star') part.until = time + STAR_T;
  if (id === 'prop') {
    // (the floats it rides on: as long as the car - a propeller makes a boat of it)
    part.n.len = clamp(ctx.D.hl * 2 * 0.86, 2, 6);
    part.n.w = 0.6;
  }
  return part;
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
    // the ink flying to its place: { v, from (px lines), to (the car's frame), c, t0, part } - and
    // ink that was none of them, going: { from, c, t0 }
    this.flights = [];
    // what the drawing is now, read as it is drawn: { item, p, none, ranked, n, text, ok } or null
    this.live = null;
    this.liveAt = 0;
    this.liveTip = null;
    this.uiSig = '';
    this.legSig = '';
    this.slotSig = '';
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
    this.showRow();
    this.showLegend();
    this.showLive();
  }

  close() {
    this.isOpen = false;
    this.live = null;
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
  // the car you drive on the screen now: { v, t, F, ctx, mass } or null
  own() {
    const g = this.game;
    const v = g.player.inVehicle;
    if (!v || v.dead || typeof window === 'undefined') return null;
    const t = this.fz.vehTarget(v);
    const F = this.fz.frameOf(t);
    if (!F) return null;
    return { v, t, F, ctx: this.fz.drawCtx(v), mass: this.fz.vehMass(v) };
  }

  // the drawing (lines of screen px) as one of the category's things: readItem's, and if it is one,
  // its numbers and what they do - or null (nothing drawn)
  read(strokes, o, cat = this.cat) {
    const lines = strokes.filter((L) => L && L.length >= 2);
    if (!lines.length) return null;
    const r = readItem(lines, cat);
    if (!r.item) return { ...r, cat };
    const n = nOf(r.item, sizeOf(lines, o.F));
    return { ...r, cat, n, ...statOf(r.item, n, o.mass) };
  }

  // (game/freedraw.js, as it is drawn) the drawing so far: what it is, by the pen (tip: screen px,
  // null - over the drawing)
  feel(strokes, tip, now = false) {
    const t = performance.now();
    this.liveTip = tip || null;
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

  // ------------------------------------------------------------------ made
  // (game/freedraw.js finishGroup) the drawing done: what it is, on the car - the ink flies there
  // first. None of the category's things: it says so, and the ink goes. strokes: lines of screen px,
  // inkI its ink. true if something went on
  make(strokes, inkI = 1) {
    const g = this.game;
    const fz = this.fz;
    this.live = null;
    this.showLive();
    this.showLegend();
    const o = this.own();
    if (!o || !strokes.length) return false;
    const R = this.read(strokes, o);
    if (!R) return false;
    if (!R.item) {
      this.flights.push({ v: null, from: strokes.map((L) => L.map((q) => q.slice())), c: inkI, t0: performance.now() });
      g.audio.play('rubber', 0.5);
      g.hud.toast(`${NONE_SAY[R.cat]} — נסו כמו בציורים שמעל הכפתורים`, 'bad', 2.6);
      return false;
    }
    const v = o.v;
    const part = partOfItem(R.item, R.n, o.ctx, inkI, g.time);
    fz.justAdded = part;
    fz.popDelay = FLY_MS;
    const res = fz.onVehicle(v, part);
    fz.justAdded = null;
    fz.popDelay = 0;
    if (!res) return false;
    fz.stats.made++;
    fz.stats.byType[part.type] = (fz.stats.byType[part.type] || 0) + 1;
    fz.stats.onto.veh = (fz.stats.onto.veh || 0) + 1;
    fz.last = { kind: 'veh', ref: v, part, t: g.time, rt: performance.now(), alts: [], M: null };
    this.fly(v, strokes, mountOf(R.item, o.ctx), inkI, part);
    this.keep(R.cat, part, v, strokes);
    g.audio.play('magic', 0.4);
    // (what it does and how - once of each: no tag by the car to draw over by mistake)
    if (!this.told.has(R.item)) {
      this.told.add(R.item);
      const say = [res.rule, res.use].filter(Boolean).join(' · ');
      if (say) g.hud.toast(`${ITEMS[R.item].name}: ${say}`, 'info', 3.4);
    }
    return true;
  }

  // the ink from the screen to its place on the car - shrinking into it; a pair (wings, blades,
  // armour) to both sides, the second a little fainter
  fly(v, strokes, M, inkI, part) {
    const from = strokes.map((L) => L.map((q) => q.slice()));
    const t0 = performance.now();
    M.to.forEach((to, i) => this.flights.push({ v, from, to, c: inkI, t0, part: i ? null : part, a: i ? 0.55 : 1 }));
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
    const part = partOfItem(it.item, it.n, fz.drawCtx(v), it.ink, g.time);
    fz.justAdded = part;
    fz.popDelay = 120;
    const res = fz.onVehicle(v, part);
    fz.justAdded = null;
    fz.popDelay = 0;
    if (!res) return false;
    this.landed(v, part);
    fz.last = { kind: 'veh', ref: v, part, t: g.time, rt: performance.now(), alts: [], M: null };
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

  // the thing just made, kept as its category's - and its look as drawn, small (its slot's picture)
  keep(cat, part, v, strokes) {
    this.book[cat] = { item: part.item, n: part.n, ink: part.ink, pic: picOf(strokes) };
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
        const len = g.touch ? PEN_REST_TOUCH : PEN_REST;
        const k = clamp((fd.groupAt - now) / len, 0, 1);
        this.dryEl.style.transform = `scaleX(${k.toFixed(3)})`;
      } else if (this.dryEl) this.dryEl.style.transform = 'scaleX(1)';
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
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      const k = clamp((now - f.t0) / FLY_MS, 0, 1);
      if (k >= 1 || (f.v && f.v.dead)) {
        this.flights.splice(i, 1);
        if (f.v && !f.v.dead && f.part) this.landed(f.v, f.part);
        continue;
      }
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      // (the drawing's middle and size; where it goes on the screen, and how small it gets there)
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
      let ty = cy;
      let s = 1;
      let a = 1;
      if (f.v) {
        const q = this.proj(f.v, f.to[0], f.to[1], f.to[2]);
        if (q) {
          tx = q.x;
          ty = q.y;
        }
        s = 1 - 0.7 * e;
        a = (k > 0.85 ? (1 - k) / 0.15 : 1) * (f.a ?? 1);
      } else {
        // (none of them: it crumbles where it was)
        ty = cy + 40 * e;
        s = 1 + 0.15 * e;
        a = 1 - e;
      }
      const ink = INKS[f.c] || INKS[1];
      for (const A of f.from) {
        g.beginPath();
        for (let j = 0; j < A.length; j++) {
          const x = cx + (tx - cx) * e + (A[j][0] - cx) * s;
          const y = cy + (ty - cy) * e + (A[j][1] - cy) * s;
          if (j) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        const w = 4 * (1 - 0.35 * e);
        g.globalAlpha = a;
        g.strokeStyle = ink.css === '#f4efe4' ? 'rgba(40, 36, 48, 0.75)' : 'rgba(255, 252, 244, 0.85)';
        g.lineWidth = w + 3.4;
        g.stroke();
        g.strokeStyle = ink.css;
        g.lineWidth = w;
        g.stroke();
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
    for (const ev of ['mousedown', 'click', 'touchstart', 'contextmenu']) row.addEventListener(ev, (e) => e.stopPropagation());
    document.body.appendChild(row);
    // (what the category has, each as it is drawn: to see, not to press)
    const leg = document.createElement('div');
    leg.className = 'pp-legend';
    leg.id = 'pp-legend';
    document.body.appendChild(leg);
    const live = document.createElement('div');
    live.className = 'pp-live';
    live.id = 'pp-live';
    live.innerHTML = '<b></b><span></span><i></i>';
    document.body.appendChild(live);
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
    for (const ev of ['mousedown', 'click', 'touchstart', 'contextmenu']) slots.addEventListener(ev, (e) => e.stopPropagation());
    document.body.appendChild(slots);
    const cv = document.createElement('canvas');
    cv.className = 'pp-fly';
    cv.id = 'pp-fly';
    document.body.appendChild(cv);
    this.rowEl = row;
    this.legEl = leg;
    this.liveEl = live;
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

  // the category's things over the row, the one the drawing is now lit
  showLegend() {
    const el = this.legEl;
    if (!el) return;
    const L = this.live;
    const sig = `${this.isOpen}|${this.cat}|${L && L.item ? L.item : ''}`;
    if (sig === this.legSig) return;
    this.legSig = sig;
    el.classList.toggle('on', this.isOpen);
    if (!this.isOpen) return;
    el.innerHTML = CATS[this.cat].map((id) => `<div class="pp-it${L && L.item === id ? ' on' : ''}" data-i="${id}"><svg viewBox="0 0 24 24">${ITEMS[id].icon}</svg><b>${ITEMS[id].name}</b></div>`).join('');
  }

  // its name and its number by the pen - or over the drawing, the pen up
  showLive(strokes) {
    const el = this.liveEl;
    if (!el) return;
    const L = this.live;
    if (!L || !this.isOpen) {
      el.classList.remove('on');
      return;
    }
    if (L.item) {
      this.liveName.textContent = ITEMS[L.item].name;
      this.liveText.textContent = L.text;
      this.liveText.classList.toggle('bad', !L.ok);
    } else {
      this.liveName.textContent = '?';
      this.liveText.textContent = 'לא זוהה עדיין';
      this.liveText.classList.add('bad');
    }
    el.classList.toggle('none', !L.item);
    el.classList.add('on');
    this.place(strokes);
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
