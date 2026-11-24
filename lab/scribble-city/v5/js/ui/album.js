import { BLUEPRINTS, BLUEPRINT_ORDER, BLUEPRINT_MORE, BLUEPRINT_NEW, BLUEPRINT_CARS, BLUEPRINT_TOOLS, drawBlueprint } from '../game/blueprints.js';
import { GRADE } from '../game/weapons.js';
import { AVES, STREETS, nearestRoadInfo, districtName } from '../world/layout.js';
import { EARLY_IDS } from '../game/drawlock.js';

import { tr } from '../core/lang.js';
const KEY = 'scribble-city-v5-album';

// For now every blueprint is open to draw from the start (to try them all). Off (ROADMAP 9.1: the
// settings' "every blueprint open", not with ?classic): only what was found in the city -
// photographed on a board in the street or up on a roof, bought in a shop, won at the arcade,
// given for a good deed or with a place you bought. The album says where the missing ones are.
export const ALL_OPEN = true;

// (ROADMAP 9.1) where the ones not on a board of their own are to be had, besides the boards
const FOUND_IN = {
  bandage: tr('במכולות שבשדרות', 'In the containers on the avenue'),
  stapler: tr('בחנות כלי העבודה', 'In the hardware store'),
  glue: tr('בחנות כלי העבודה', 'In the hardware store'),
  bike: tr('בחנות הגלישה', 'In the surf shop'),
  boomerang: tr('בחנות הגלישה', 'In the surf shop'),
  inkbomb: tr('מתנה למי שקונה את INK CLUB', 'A gift for whoever buys INK CLUB'),
  parachute: tr('מתנה למי שקונה את Star Motel', 'A gift for whoever buys the Star Motel'),
  laser: tr('מתנה למי שקונה את Pixel Arcade', 'A gift for whoever buys Pixel Arcade'),
  planes: tr('מתנה למי שקונה את Bay Cafe', 'A gift for whoever buys Bay Cafe'),
  // (ROADMAP 9.2)
  ladder: tr('בחנות כלי העבודה', 'In the hardware store'),
  ramp: tr('בחנות כלי העבודה', 'In the hardware store'),
  barrier: tr('בחנות כלי העבודה', 'In the hardware store'),
  bridge: tr('בחנות כלי העבודה', 'In the hardware store'),
  key: tr('בחנות כלי העבודה', 'In the hardware store'),
  umbrella: tr('במכולות שבשדרות', 'In the containers on the avenue'),
};

// (ROADMAP 15.2) what every new game starts knowing how to draw: a paint gun, a car, a ramp - made
// with a touch from the first minute; the rest found in the city, then learned once
export const START_KIT = ['paint', 'car', 'ramp', 'barrier'];

// the library's shelves
// (v5, ROADMAP 11.36: the weapons first - the paint gun, the pencil rifle, the eraser bazooka...)
const SHELVES = [
  [tr('נשק', 'Weapons'), (bp) => bp.kind === 'weapon'],
  [tr('כלי רכב', 'Vehicles'), (bp) => bp.kind === 'vehicle'],
  [tr('ציוד ועזרה ראשונה', 'Gear and first aid'), (bp) => bp.kind === 'gear' || bp.kind === 'heal'],
  // (ROADMAP 9.2, not with ?classic)
  [tr('כלים לבעיות בדרך', 'Tools for trouble on the way'), (bp) => bp.kind === 'tool'],
];

/**
 * Photos of blueprints the player collected. Persisted per browser (best effort).
 */
export class Album {
  constructor(game) {
    this.game = game;
    this.items = new Map(); // id -> { best }
    // (the settings' "every blueprint open", ROADMAP 9.1: game/game.js)
    this.allOpen = ALL_OPEN;
    // (round 15, game/drawlock.js) a new player's short list till the jump off the roof: the ids
    // drawn by hand so far, or null - not now
    this.early = null;
    this.el = document.getElementById('album');
    this.list = document.getElementById('album-list');
    document.getElementById('album-close').addEventListener('click', () => this.hide());
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const [id, v] of Object.entries(data)) if (BLUEPRINTS[id]) this.items.set(id, v);
    } catch (e) {
      // storage unavailable: start empty
    }
    // (ROADMAP 15.2) the start's kit: found and known from the first minute
    for (const id of START_KIT) if (BLUEPRINTS[id] && !this.items.has(id)) this.items.set(id, { best: 0, kit: true });
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(this.items)));
    } catch (e) {
      // ignore
    }
  }

  // (ROADMAP 29.5, game/finds.js) found in the city: the start's kit, what was found, and what is not to be found
  // (R26: from the story's first minute - finds.rules, not only once the pages are in the city)
  get finding() {
    const F = this.game.finds;
    return F && F.rules ? F : null;
  }

  // (R26, the owner's word: "what you have is yours still to be drawn - drawn once, it is in the library") drawn by hand
  // at least once, and the drawing was right: here (recordGrade), or over its lines in the parts tray (game/buildtray.js)
  drawn(id) {
    const it = this.items.get(id);
    if (it && (it.drawn || (it.best !== null && it.best !== undefined && !it.kit))) return true;
    const T = this.game.tray;
    return !!(T && T.store && T.store.learned && T.store.learned[`bp:${id}`]);
  }

  has(id) {
    if (this.early) return EARLY_IDS.includes(id);
    const F = this.finding;
    if (F) return F.bpOpen(id);
    return this.allOpen ? !!BLUEPRINTS[id] : this.items.has(id);
  }

  // (ROADMAP 15.2) known: learned - drawn once by hand, from its picture (or the start's kit). A known
  // thing is made with a touch, no drawing (ui/freedraw.js quick). (round 15: everything open is open
  // to be drawn - nothing is known before it has been drawn)
  known(id) {
    if (!BLUEPRINTS[id]) return false;
    if (this.early) return this.early.has(id);
    // (R26: had - the start kit or photographed - is not known till it has been drawn once; a test that does not ask for
    // the learning (?learn=1) knows what it has, as the parts tray's own tests do)
    const F = this.finding;
    if (F) {
      if (!F.bpOpen(id)) return false;
      // (a ramp, a bridge, a barrier is drawn on the world each time - game/gadgets.js DRAWN_ON: nothing to learn first)
      if (id === 'ramp' || id === 'bridge' || id === 'barrier') return true;
      const P = this.game.params;
      if (P && P.get('test') === '1' && P.get('learn') !== '1') return true;
      return this.drawn(id);
    }
    // (the owner's word, again: every weapon and ride open from the start - ready at a touch, not first drawn over its lines
    // to be learned; drawn by hand it is still read and made, as ever)
    if (this.allOpen && !this.game.classic) return true;
    const it = this.items.get(id);
    return !!(it && it.best !== null);
  }

  // found, and not learned yet: its first time is drawn by hand, over its lines (the learning)
  toLearn(id) {
    return !this.game.classic && this.has(id) && !this.known(id);
  }

  // (round 15) the short list, on (a new game's prologue, till the jump off the roof) or off
  setEarly(on) {
    if (!!on === !!this.early) return;
    this.early = on && !this.game.classic ? new Set() : null;
    const F = this.game.freedraw;
    if (F) {
      F.legSig = '';
      F.showLegend();
    }
  }

  // (ROADMAP 9.1, not with ?classic: all open, or found one by one)
  setOpen(on) {
    if (!this.game.classic) this.allOpen = on;
  }

  add(id) {
    // (ROADMAP 29.5: finding is by the drawings in the city, not by photos of the boards)
    if (this.finding) return false;
    if (this.items.has(id) || (this.game.classic && this.has(id))) return false;
    this.items.set(id, { best: null });
    this.save();
    // (everything open anyway: it is kept for the day it is not - ROADMAP 9.1)
    if (this.allOpen) return false;
    if (this.onAdd) this.onAdd(id);
    return true;
  }

  // a blueprint given (ROADMAP 9.1: with a place you bought, for a robber caught...): into the
  // album, and you are told; false if it was there already
  gift(id, from) {
    const bp = BLUEPRINTS[id];
    if (!bp || !this.add(id)) return false;
    const g = this.game;
    g.hud.toast(tr(`שרטוט חדש באלבום: ${bp.name}, ${from}! ${g.touch ? g.drawTap : g.drawKey} — לצייר אותו`, `New blueprint in the album: ${bp.name}, ${from}! ${g.touch ? g.drawTap : g.drawKey} — draw it`), 'good', 3.6);
    g.audio.play('pageflip');
    return true;
  }

  // one of the light ones still missing (not the tank, the copter, the minigun, the plane)
  giftAny(from) {
    if (this.allOpen || this.finding) return false;
    const left = this.order.filter((id) => !this.items.has(id) && BLUEPRINTS[id].difficulty <= 3);
    if (!left.length) return false;
    return this.gift(left[Math.floor(Math.random() * left.length)], from);
  }

  // where one not yet in the album is to be found: its nearest board (in the street, or up on a
  // roof) and the shops or deeds that give it
  where(id) {
    const g = this.game;
    // (ROADMAP 29.5) a drawing to be found: where it is
    const F = this.finding;
    const fw = F ? F.where(id) : null;
    if (fw) return fw;
    const p = g.player.pos;
    let best = null;
    let bd = Infinity;
    for (const b of g.world.billboards || []) {
      if (b.id !== id) continue;
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    const out = [];
    if (best) {
      const r = nearestRoadInfo(best.x, best.z);
      const road = r.aveDist < r.streetDist ? AVES[r.ave].name : STREETS[r.street].name;
      const area = districtName(best.x, best.z);
      out.push(tr(`${best.roof ? 'על גג' : 'על שלט'} ליד ${road}${area && area !== road ? `, ${area}` : ''}`, `${best.roof ? tr('על גג', 'on a roof') : tr('על שלט', 'on a sign')} by ${road}${area && area !== road ? `, ${area}` : ''}`));
    }
    // (R26: the boards are rubbed out under the rules - none of them is where a thing is had)
    if (F) return tr('עוד לא נמצא בעיר', 'Not found in the city yet');
    if (FOUND_IN[id]) out.push(FOUND_IN[id]);
    if (!out.length) out.push(tr('אולי במכונה בארקייד, עם קצת מזל', 'Maybe in a machine at the arcade, with a little luck'));
    return out.join(' · ');
  }

  // ok: the drawing was right (not a poor one) - then it is drawn, learned (R26)
  recordGrade(id, score, ok = true) {
    if (this.early && EARLY_IDS.includes(id)) this.early.add(id);
    let it = this.items.get(id);
    if (!it) {
      const F = this.finding;
      if (!this.allOpen && !(F && F.bpOpen(id))) return;
      it = { best: null };
      this.items.set(id, it);
    }
    if (it.best === null || score > it.best) it.best = score;
    if (ok) {
      it.drawn = true;
      delete it.kit;
    }
    this.save();
  }

  // (the new ones, ROADMAP 4.8: not with ?classic)
  get order() {
    return this.game.classic ? BLUEPRINT_ORDER : this._order || (this._order = [...BLUEPRINT_ORDER, ...BLUEPRINT_NEW, ...BLUEPRINT_MORE, ...BLUEPRINT_CARS, ...BLUEPRINT_TOOLS].filter((id) => BLUEPRINTS[id] && !BLUEPRINTS[id].hidden));
  }

  get size() {
    if (this.early) return EARLY_IDS.length;
    if (this.finding) return this.order.filter((id) => this.has(id)).length;
    return this.allOpen ? this.order.length : this.items.size;
  }

  // in the order of the shelves (the arrows in the drawing go through them like this)
  ids() {
    const out = [];
    for (const [, fits] of SHELVES) for (const id of this.order) if (fits(BLUEPRINTS[id]) && this.has(id)) out.push(id);
    return out;
  }

  // onPick(id): a photo was picked; onClose(): closed without picking one
  show(onPick, onClose = null) {
    this.onPick = onPick;
    this.onClose = onClose;
    this.list.innerHTML = '';
    const last = this.game.drawPick;
    for (const [title, fits] of SHELVES) {
      // (a shelf with nothing on it in this edition: not shown - the tools are not with ?classic)
      if (!this.order.some((id) => fits(BLUEPRINTS[id]))) continue;
      const head = document.createElement('div');
      head.className = 'album-shelf';
      head.textContent = title;
      this.list.appendChild(head);
      for (const id of this.order) if (fits(BLUEPRINTS[id])) this.addItem(id, id === last);
    }
    this.el.classList.remove('hidden');
    this.open = true;
  }

  addItem(id, last) {
    const bp = BLUEPRINTS[id];
    const got = this.has(id);
    const item = document.createElement('div');
    item.className = `album-item ${got ? '' : 'locked'} ${last ? 'last' : ''}`;
    const pol = document.createElement('div');
    pol.className = 'polaroid';
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 200;
    const g = c.getContext('2d');
    g.fillStyle = '#f7f4ec';
    g.fillRect(0, 0, c.width, c.height);
    if (got) drawBlueprint(g, bp, 0, 0, c.width, c.height, { pad: 0.1, width: 2.5 });
    else {
      g.fillStyle = '#c9c4b6';
      g.font = 'bold 80px Rubik, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('?', 150, 100);
    }
    pol.appendChild(c);
    const cap = document.createElement('div');
    cap.className = 'caption';
    cap.textContent = got ? bp.name : tr('עוד לא נמצא', 'Not found yet');
    pol.appendChild(cap);
    item.appendChild(pol);
    // (not found yet: where it is - ROADMAP 9.1)
    if (!got && !this.game.classic) {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = this.where(id);
      item.appendChild(hint);
    }
    const meta = document.createElement('div');
    meta.className = 'meta';
    const rec = this.items.get(id);
    const best = got && rec && rec.best !== null ? tr(` · שיא: ${rec.best}`, ` · best: ${rec.best}`) : '';
    meta.innerHTML = `<span class="stars">${'●'.repeat(bp.difficulty)}${'○'.repeat(5 - bp.difficulty)}</span> ${got ? (bp.kind === 'vehicle' ? tr('כלי רכב', 'Vehicles') : bp.kind === 'gear' ? tr('ציוד', 'Gear') : bp.kind === 'heal' ? tr('עזרה ראשונה', 'First aid') : bp.kind === 'tool' ? tr('כלי', 'Tool') : tr('נשק', 'Weapons')) : ''}${best}`;
    item.appendChild(meta);
    if (got) {
      // (ROADMAP 15.2) known: made at once (a pencil beside it to draw it anyway); found, not learned
      // yet: drawn once, by hand, over its lines
      const known = this.game.classic || this.known(id);
      const go = document.createElement('div');
      go.className = `go${known ? ' now' : ' learn'}`;
      go.textContent = this.game.classic ? tr('✏ לצייר באוויר', '✏ Draw in the air') : known ? tr('⚡ לזמן עכשיו', '⚡ Summon now') : tr('✎ לצייר פעם אחת — ומאז הוא בספרייה', '✎ Draw it once — then it\'s in your library');
      item.appendChild(go);
      if (known && !this.game.classic) {
        const dr = document.createElement('div');
        dr.className = 'go draw';
        dr.textContent = tr('✏ לצייר בעצמי', '✏ Draw it myself');
        item.appendChild(dr);
      }
      item.addEventListener('click', (e) => {
        const draw = !!e.target.closest('.draw');
        this.hide(true);
        if (this.onPick) this.onPick(id, draw);
      });
    }
    this.list.appendChild(item);
  }

  hide(picked = false) {
    if (!this.open) return;
    this.el.classList.add('hidden');
    this.open = false;
    const close = this.onClose;
    this.onClose = null;
    if (!picked && close) close();
  }
}

export { GRADE };
